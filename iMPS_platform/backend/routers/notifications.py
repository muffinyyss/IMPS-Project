# routers/notifications.py
from fastapi import APIRouter, Depends, Request, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import asyncio
import json
import re

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


# ===== Helper Functions =====

def to_json(obj) -> str:
    """Convert object to JSON string"""
    def default(o):
        if isinstance(o, datetime):
            return o.isoformat()
        if isinstance(o, ObjectId):
            return str(o)
        return str(o)
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def validate_station_id(station_id: str):
    """Validate station_id format"""
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")


def get_error_db(request: Request):
    """
    ดึง errorDB จาก app.state หรือ import จาก main
    ต้องเพิ่มใน main.py: app.state.errorDB = errorDB
    """
    # วิธีที่ 1: ถ้าตั้งค่าใน app.state (แนะนำ)
    if hasattr(request.app.state, "errorDB"):
        return request.app.state.errorDB
    
    # วิธีที่ 2: import ตรงจาก main (fallback)
    try:
        from main import errorDB
        return errorDB
    except ImportError:
        raise HTTPException(status_code=500, detail="errorDB not configured")


def get_charger_collection(request: Request):
    """ดึง charger collection จาก iMPS database"""
    try:
        from main import client
        return client["iMPS"]["charger"]
    except ImportError:
        raise HTTPException(status_code=500, detail="charger collection not configured")


def get_stations_collection(request: Request):
    """ดึง stations collection จาก iMPS database"""
    try:
        from main import client
        return client["iMPS"]["stations"]
    except ImportError:
        raise HTTPException(status_code=500, detail="stations collection not configured")


async def lookup_station_name(request: Request, station_id: str) -> str:
    """
    ดึง station_name จาก stations collection โดยใช้ station_id
    """
    if not station_id:
        return station_id
    
    try:
        stations_coll = get_stations_collection(request)
        station = await stations_coll.find_one({"station_id": station_id})
        
        if station and station.get("station_name"):
            return station.get("station_name")
    except Exception as e:
        print(f"[notifications] Lookup station name error: {e}")
    
    return station_id  # fallback to station_id


async def lookup_charger_info(request: Request, chargebox_id: str) -> dict:
    """
    ดึงข้อมูล charger จาก charger collection โดยใช้ chargeBoxID
    Returns: {"charger_no": 1, "sn": "SN-001", "station_name": "..."}
    """
    if not chargebox_id:
        return {}
    
    try:
        charger_coll = get_charger_collection(request)
        charger = await charger_coll.find_one({"chargeBoxID": chargebox_id})
        
        if charger:
            return {
                "charger_no": charger.get("chargerNo"),
                "sn": charger.get("SN"),
                "station_name": charger.get("station_name"),
            }
    except Exception as e:
        print(f"[notifications] Lookup charger error: {e}")
    
    return {}


# ===== API Endpoints =====

@router.get("/all")
async def get_all_notifications(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    unread_only: bool = Query(default=False),
    # current: UserClaims = Depends(get_current_user),  # เปิดใช้เมื่อต้องการ auth
):
    """
    ดึง notifications จากทุก collections ใน errorCode database
    
    Database structure:
    - errorCode (database)
      - Klongluang3 (collection = station 1)
      - StationB (collection = station 2)
      - ...
    """
    errorDB = get_error_db(request)
    
    all_notifications = []
    
    # ดึงชื่อทุก collections (= ทุกสถานี)
    collection_names = await errorDB.list_collection_names()
    # กรอง system collections ออก
    collection_names = [c for c in collection_names if not c.startswith("system.")]
    
    print(f"[notifications] Found {len(collection_names)} stations: {collection_names}")
    
    for station_name in collection_names:
        try:
            coll = errorDB[station_name]
            
            # ดึง documents จาก collection นี้
            cursor = coll.find({}).sort("_id", -1).limit(limit)
            docs = await cursor.to_list(None)
            
            # Lookup station name from stations collection
            real_station_name = await lookup_station_name(request, station_name)
            
            for doc in docs:
                chargebox_id = doc.get("Chargebox_ID") or doc.get("chargebox_id")
                
                # Lookup charger info (chargerNo, SN)
                charger_info = await lookup_charger_info(request, chargebox_id)
                
                notification = {
                    "id": str(doc.get("_id")),
                    "station_id": station_name,
                    "station_name": real_station_name,
                    "chargebox_id": chargebox_id,
                    "charger_no": charger_info.get("charger_no"),
                    "sn": charger_info.get("sn"),
                    "error": doc.get("error") or doc.get("errorMessage") or doc.get("message"),
                    "error_code": doc.get("error_code") or doc.get("errorCode"),
                    "timestamp": _get_timestamp(doc),
                    "read": doc.get("read", False),
                    "type": _determine_type(doc),
                }
                all_notifications.append(notification)
                
        except Exception as e:
            print(f"[notifications] Error fetching from {station_name}: {e}")
            continue
    
    # เรียงตาม timestamp (ใหม่สุดก่อน)
    all_notifications.sort(
        key=lambda x: x.get("timestamp") or "", 
        reverse=True
    )
    
    # กรองเฉพาะยังไม่อ่าน
    if unread_only:
        all_notifications = [n for n in all_notifications if not n.get("read")]
    
    # จำกัดจำนวน
    all_notifications = all_notifications[:limit]
    
    return {
        "notifications": all_notifications,
        "total": len(all_notifications),
        "unread_count": sum(1 for n in all_notifications if not n.get("read")),
        "stations": collection_names,
    }


@router.get("/count")
async def get_notification_count(
    request: Request,
    # current: UserClaims = Depends(get_current_user),
):
    """ดึงจำนวน notifications ที่ยังไม่อ่าน (สำหรับแสดง badge บน navbar)"""
    errorDB = get_error_db(request)
    
    unread_count = 0
    total_count = 0
    
    collection_names = await errorDB.list_collection_names()
    collection_names = [c for c in collection_names if not c.startswith("system.")]
    
    for station_name in collection_names:
        try:
            coll = errorDB[station_name]
            total = await coll.count_documents({})
            unread = await coll.count_documents({"read": {"$ne": True}})
            total_count += total
            unread_count += unread
        except Exception as e:
            print(f"[notifications] Count error for {station_name}: {e}")
            continue
    
    return {
        "total_count": total_count,
        "unread_count": unread_count,
    }


@router.get("/stream")
async def notifications_stream(
    request: Request,
    # current: UserClaims = Depends(get_current_user),
):
    """SSE stream สำหรับ real-time notifications จากทุก stations"""
    errorDB = get_error_db(request)
    
    # Get collections for lookup
    try:
        charger_coll = get_charger_collection(request)
    except:
        charger_coll = None
    
    try:
        stations_coll = get_stations_collection(request)
    except:
        stations_coll = None
    
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    async def event_generator():
        last_ids = {}  # เก็บ ID ล่าสุดของแต่ละ collection
        station_name_cache = {}  # Cache station names
        
        async def get_charger_info(chargebox_id: str) -> dict:
            """Lookup charger info"""
            if not chargebox_id or not charger_coll:
                return {}
            try:
                charger = await charger_coll.find_one({"chargeBoxID": chargebox_id})
                if charger:
                    return {
                        "charger_no": charger.get("chargerNo"),
                        "sn": charger.get("SN"),
                    }
            except:
                pass
            return {}
        
        async def get_station_name(station_id: str) -> str:
            """Lookup station name from stations collection"""
            if station_id in station_name_cache:
                return station_name_cache[station_id]
            
            if not stations_coll:
                return station_id
            
            try:
                station = await stations_coll.find_one({"station_id": station_id})
                if station and station.get("station_name"):
                    station_name_cache[station_id] = station.get("station_name")
                    return station.get("station_name")
            except:
                pass
            
            return station_id
        
        # ----- Initial load -----
        collection_names = await errorDB.list_collection_names()
        collection_names = [c for c in collection_names if not c.startswith("system.")]
        
        initial_notifications = []
        
        for station_id in collection_names:
            try:
                coll = errorDB[station_id]
                latest = await coll.find_one({}, sort=[("_id", -1)])
                
                if latest:
                    last_ids[station_id] = latest.get("_id")
                    chargebox_id = latest.get("Chargebox_ID")
                    charger_info = await get_charger_info(chargebox_id)
                    real_station_name = await get_station_name(station_id)
                    
                    initial_notifications.append({
                        "id": str(latest.get("_id")),
                        "station_id": station_id,
                        "station_name": real_station_name,
                        "chargebox_id": chargebox_id,
                        "charger_no": charger_info.get("charger_no"),
                        "sn": charger_info.get("sn"),
                        "error": latest.get("error"),
                        "timestamp": _get_timestamp(latest),
                        "read": latest.get("read", False),
                        "type": _determine_type(latest),
                    })
            except Exception as e:
                print(f"[notifications] Init error for {station_id}: {e}")
                continue
        
        if initial_notifications:
            yield f"event: init\ndata: {to_json(initial_notifications)}\n\n"
        else:
            yield ": keep-alive\n\n"
        
        # ----- Watch for updates -----
        while True:
            if await request.is_disconnected():
                break
            
            # Refresh collection list
            collection_names = await errorDB.list_collection_names()
            collection_names = [c for c in collection_names if not c.startswith("system.")]
            
            for station_id in collection_names:
                try:
                    coll = errorDB[station_id]
                    latest = await coll.find_one({}, sort=[("_id", -1)])
                    
                    if latest and latest.get("_id") != last_ids.get(station_id):
                        last_ids[station_id] = latest.get("_id")
                        chargebox_id = latest.get("Chargebox_ID")
                        charger_info = await get_charger_info(chargebox_id)
                        real_station_name = await get_station_name(station_id)
                        
                        notification = {
                            "id": str(latest.get("_id")),
                            "station_id": station_id,
                            "station_name": real_station_name,
                            "chargebox_id": chargebox_id,
                            "charger_no": charger_info.get("charger_no"),
                            "sn": charger_info.get("sn"),
                            "error": latest.get("error"),
                            "timestamp": _get_timestamp(latest),
                            "read": False,
                            "type": _determine_type(latest),
                        }
                        
                        yield f"event: new\ndata: {to_json(notification)}\n\n"
                        
                except Exception as e:
                    print(f"[notifications] Watch error for {station_id}: {e}")
                    continue
            
            yield ": keep-alive\n\n"
            await asyncio.sleep(30)  # Check ทุก 30 วินาที
    
    return StreamingResponse(event_generator(), headers=headers)


@router.post("/{notification_id}/read")
async def mark_as_read(
    request: Request,
    notification_id: str,
    station_id: str = Query(..., description="ชื่อ collection (station)"),
    # current: UserClaims = Depends(get_current_user),
):
    """Mark notification เป็นอ่านแล้ว"""
    errorDB = get_error_db(request)
    
    try:
        validate_station_id(station_id)
        coll = errorDB[station_id]
        result = await coll.update_one(
            {"_id": ObjectId(notification_id)},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
        )
        
        return {"success": result.modified_count > 0}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/read-all")
async def mark_all_as_read(
    request: Request,
    station_id: Optional[str] = Query(None, description="ชื่อ collection (ถ้าไม่ระบุจะ mark ทุก station)"),
    # current: UserClaims = Depends(get_current_user),
):
    """Mark ทุก notifications เป็นอ่านแล้ว"""
    errorDB = get_error_db(request)
    
    if station_id:
        collection_names = [station_id]
    else:
        collection_names = await errorDB.list_collection_names()
        collection_names = [c for c in collection_names if not c.startswith("system.")]
    
    updated_count = 0
    for name in collection_names:
        try:
            coll = errorDB[name]
            result = await coll.update_many(
                {"read": {"$ne": True}},
                {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
            )
            updated_count += result.modified_count
        except Exception as e:
            print(f"[notifications] Mark all read error for {name}: {e}")
            continue
    
    return {"success": True, "updated_count": updated_count}


@router.delete("/{notification_id}")
async def delete_notification(
    request: Request,
    notification_id: str,
    station_id: str = Query(..., description="ชื่อ collection (station)"),
    # current: UserClaims = Depends(get_current_user),
):
    """ลบ notification"""
    errorDB = get_error_db(request)
    
    try:
        validate_station_id(station_id)
        coll = errorDB[station_id]
        result = await coll.delete_one({"_id": ObjectId(notification_id)})
        
        return {"success": result.deleted_count > 0}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ===== Private Helper Functions =====

def _get_timestamp(doc: dict):
    """ดึง timestamp จาก document"""
    ts = doc.get("timestamp") or doc.get("created_at") or doc.get("createdAt")
    if isinstance(ts, datetime):
        return ts.isoformat()
    return ts


def _determine_type(doc: dict) -> str:
    """กำหนดประเภท notification จากข้อมูล error"""
    error_text = str(doc.get("error", "")).lower()
    
    # Critical errors
    if any(kw in error_text for kw in ["offline", "disconnect", "fail", "critical", "overcurrent"]):
        return "error"
    
    # Warnings
    if any(kw in error_text for kw in ["warning", "maintenance", "pm", "low", "high"]):
        return "warning"
    
    # Success
    if any(kw in error_text for kw in ["success", "complete", "approved", "done"]):
        return "success"
    
    # Info
    if any(kw in error_text for kw in ["info", "update", "notice"]):
        return "info"
    
    return "error"  # Default