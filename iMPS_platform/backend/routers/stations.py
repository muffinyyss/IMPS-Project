"""Station & Charger CRUD routes"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, Path, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson.objectid import ObjectId
from bson.errors import InvalidId
from zoneinfo import ZoneInfo
from pymongo.errors import DuplicateKeyError
from typing import List, Dict, Any, Optional
import json, re, uuid, pathlib, secrets

from config import (
    users_collection, station_collection, charger_collection,
    charger_onoff, _validate_station_id, th_tz,
)
from deps import UserClaims, get_current_user
from routers.pm_helpers import (
    UPLOADS_ROOT,
)

router = APIRouter()

@router.get("/stations/")
async def get_stations(q:str = ""):
    """ค้นหาสถานนี"""
    query = {"station_name":{"$regex":  q, "$options": "i"}} if q else {}
    stations = station_collection.find(query,{"_id":0,"station_name":1})
    return [station["station_name"] for station in stations]


@router.get("/owner/stations/")
async def get_stations(q: str = "", current: UserClaims = Depends(get_current_user)):
    # current_user คือ str(_id)
    user_obj_id = ObjectId(current.user_id)

    # ดึง station_id ของ user
    user = users_collection.find_one({"_id": user_obj_id}, {"station_id": 1})
    if not user or "station_id" not in user:
        return []

    station_ids = user["station_id"]

    # filter stations ตาม station_id ของ user + query
    query_filter = {"station_id": {"$in": station_ids}}
    if q:
        query_filter["station_name"] = {"$regex": q, "$options": "i"}

    stations = station_collection.find(query_filter, {"_id": 0, "station_name": 1, "station_id": 1})
    return [{"station_name": s["station_name"], "station_id": s["station_id"]} for s in stations]


@router.get("/selected/station/{station_id}")
async def get_station_detail(station_id: str, current: UserClaims = Depends(get_current_user)):
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    # แปลงทุกอย่างให้ JSON ได้
    return jsonable_encoder(
        station,
        custom_encoder={
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }
    )


# --------------------------------------- station ---------------------------
def parse_iso_utc(s: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None

#     อ่านเอกสารล่าสุดจาก stationsOnOff/<station_id>
#     โครงสร้าง doc:
#         }},


#     SN:str
#     WO:str 
#     PLCFirmware:str 
#     PIFirmware:str 
#     RTFirmware:str
#     chargeBoxID: str 


#     SN:str
#     WO:str 
#     PLCFirmware:str 
#     PIFirmware:str 
#     RTFirmware:str 
#     chargeBoxID:str


def to_object_id_or_400(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid user_id")

#     เซฟไฟล์ลงโฟลเดอร์ /uploads/stations/<station_id>/
#     คืนค่า URL ที่ฝั่ง Frontend ใช้แสดงได้เลย (/uploads/...)


#         updated[kind] = url

@router.get("/owners")
async def get_owners():
    cursor = users_collection.find({"role": "owner"}, {"_id": 1, "username": 1})
    owners = [{"user_id": str(u["_id"]), "username": u["username"]} for u in cursor]

    if not owners:
        raise HTTPException(status_code=404, detail="owners not found")

    return {"owners": owners}

#             out[sid] = _latest_onoff_bool(sid)
#             out[sid] = False

async def latest_onoff(sn: str) -> Dict[str, Any]:
    """
    อ่านเอกสารล่าสุดจาก stationsOnOff/<sn>
    โครงสร้าง doc:
      { payload: { value: 0/1, timestamp: "ISO-UTC" }, ... }
    """
    try:
        coll = charger_onoff.get_collection(sn)
        
        # ใช้ await สำหรับ Motor (async)
        cursor = coll.find().sort([("payload.timestamp", -1), ("_id", -1)]).limit(1)
        docs = await cursor.to_list(length=1)
        doc = docs[0] if docs else None
        
        if not doc:
            return {"status": None, "statusAt": None}

        payload = doc.get("payload", {})
        val = payload.get("value", None)
        ts = payload.get("timestamp", None)

        # แปลงเป็น bool ชัดเจน: 1/true => True, 0/false => False, อื่นๆ -> None
        if isinstance(val, (int, bool)):
            status = bool(val)
        else:
            try:
                status = bool(int(val))
            except Exception:
                status = None

        status_at = parse_iso_utc(ts) if isinstance(ts, str) else None
        return {"status": status, "statusAt": status_at}
    
    except Exception as e:
        print(f"[latest_onoff] Error for SN {sn}: {e}")
        return {"status": None, "statusAt": None}
    
@router.get("/charger-onoff/{sn}")
async def station_onoff_latest(sn: str, current: UserClaims = Depends(get_current_user)):
    data = await latest_onoff(str(sn))  # เพิ่ม await
    status_at_iso = (
        data["statusAt"].astimezone(ZoneInfo("Asia/Bangkok")).isoformat()
        if data["statusAt"] else None
    )
    return {"sn": sn, "status": data["status"], "statusAt": status_at_iso}


def parse_iso_any_tz(s: str) -> datetime | None:
    if not isinstance(s, str):
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        try:
            return datetime.fromisoformat(s + "+00:00")
        except Exception:
            return None
        
# ------------------------------------ new station
# ----- Charger Models -----
class ChargerCreate(BaseModel):
    chargeBoxID: str
    chargerNo: Optional[int] = None  # Auto-generated if not provided
    brand: str
    model: str
    SN: str
    WO: str
    power: Optional[str] = ""
    PLCFirmware: str
    PIFirmware: str
    RTFirmware: str
    commissioningDate: Optional[str] = None
    warrantyYears: Optional[int] = 1
    numberOfCables: Optional[int] = 1
    is_active: Optional[bool] = True
    location: Optional[str] = ""
    description: Optional[str] = ""
    ocppUrl: Optional[str] = ""
    chargerType: Optional[str] = "DC"

class ChargerUpdate(BaseModel):
    chargeBoxID: Optional[str] = None
    chargerNo: Optional[int] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    SN: Optional[str] = None
    WO: Optional[str] = None
    power: Optional[str] = None
    PLCFirmware: Optional[str] = None
    PIFirmware: Optional[str] = None
    RTFirmware: Optional[str] = None
    commissioningDate: Optional[str] = None
    warrantyYears: Optional[int] = None
    numberOfCables: Optional[int] = None
    is_active: Optional[bool] = None
    location: Optional[str] = None
    description: Optional[str] = None
    ocppUrl: Optional[str] = None
    chargerType: Optional[str] = None

class ChargerOut(BaseModel):
    id: str
    station_id: str
    chargeBoxID: str
    chargerNo: Optional[int] = None
    brand: str
    model: str
    SN: str
    WO: str
    power: Optional[str] = ""
    PLCFirmware: str
    PIFirmware: str
    RTFirmware: str
    commissioningDate: Optional[str] = None
    warrantyYears: Optional[int] = 1
    numberOfCables: Optional[int] = 1
    is_active: Optional[bool] = True
    location: Optional[str] = ""
    description: Optional[str] = ""
    ocppUrl: Optional[str] = ""
    chargerType: Optional[str] = ""
    status: Optional[bool] = None
    images: Optional[dict] = None
    createdAt: Optional[datetime] = None

# ----- Station Models -----
class StationCreate(BaseModel):
    station_id: str
    station_name: str
    user_id: Optional[str] = None
    owner: Optional[str] = None  # username (fallback)
    is_active: Optional[bool] = True
    location: Optional[str] = ""
    description: Optional[str] = ""

class StationUpdate(BaseModel):
    station_name: Optional[str] = None
    is_active: Optional[bool] = None
    user_id: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None

class StationOut(BaseModel):
    id: str
    station_id: str
    station_name: str
    user_id: str
    username: Optional[str] = None
    is_active: bool
    location: Optional[str] = ""
    description: Optional[str] = ""
    status: Optional[bool] = None
    stationImage: Optional[str] = None
    chargers: List[ChargerOut] = []
    createdAt: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.astimezone(ZoneInfo("Asia/Bangkok")).isoformat()
        }

# ----- Combined Create (Station + Chargers) -----
class StationWithChargersCreate(BaseModel):
    """For creating Station with Chargers in one request"""
    station: StationCreate
    chargers: List[ChargerCreate]

class StationWithChargersOut(BaseModel):
    station: StationOut
    chargers: List[ChargerOut]

# ============================================================
# Helper Functions
# ============================================================

def to_object_id(s: str) -> ObjectId:
    """Convert string to ObjectId or raise 400"""
    try:
        return ObjectId(s)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid ID format")


def get_username_by_user_id(user_id: ObjectId) -> Optional[str]:
    """Get username from user_id"""
    user = users_collection.find_one({"_id": user_id}, {"username": 1})
    return user.get("username") if user else None


def get_charger_status(station_id: str, chargeBoxID: str) -> bool:
    """Get latest Charger status from stationOnOff"""
    try:
        coll = charger_onoff.get_collection(str(station_id))
        doc = coll.find_one(
            {"payload.chargeBoxID": chargeBoxID},
            sort=[("payload.timestamp", -1), ("_id", -1)]
        )
        if not doc:
            return False
        val = doc.get("payload", {}).get("value", 0)
        return bool(int(val)) if not isinstance(val, bool) else val
    except Exception:
        return False

def get_station_status(station_id: str) -> bool:
    """Get latest Station status"""
    try:
        coll = charger_onoff.get_collection(str(station_id))
        doc = coll.find_one(sort=[("payload.timestamp", -1), ("_id", -1)])
        if not doc:
            return False
        val = doc.get("payload", {}).get("value", 0)
        return bool(int(val)) if not isinstance(val, bool) else val
    except Exception:
        return False


def get_next_charger_no(station_id: str) -> int:
    """Get next chargerNo for a station"""
    max_charger = charger_collection.find_one(
        {"station_id": station_id},
        sort=[("chargerNo", -1)]
    )
    if max_charger and max_charger.get("chargerNo"):
        return max_charger["chargerNo"] + 1
    return 1


def format_charger(doc: dict, include_status: bool = True) -> ChargerOut:
    """Convert charger document to ChargerOut"""
    charger_id = str(doc["_id"])
    station_id = doc.get("station_id", "")
    
    status = None
    if include_status:
        status = get_charger_status(station_id, doc.get("chargeBoxID", ""))
    
    return ChargerOut(
        id=charger_id,
        station_id=station_id,
        chargeBoxID=doc.get("chargeBoxID", ""),
        chargerNo=doc.get("chargerNo"),
        brand=doc.get("brand", ""),
        model=doc.get("model", ""),
        SN=doc.get("SN", ""),
        WO=doc.get("WO", ""),
        power=doc.get("power", ""),
        PLCFirmware=doc.get("PLCFirmware", ""),
        PIFirmware=doc.get("PIFirmware", ""),
        RTFirmware=doc.get("RTFirmware", ""),
        commissioningDate=doc.get("commissioningDate"),
        warrantyYears=doc.get("warrantyYears", 1),
        numberOfCables=doc.get("numberOfCables", 1),
        is_active=doc.get("is_active", True),
        location=doc.get("location", ""),
        description=doc.get("description", ""),
        ocppUrl=doc.get("ocppUrl", ""),
        chargerType=doc.get("chargerType", ""),
        status=status,
        images=doc.get("images", {}),
        createdAt=doc.get("createdAt"),
    )

def format_station_with_chargers(station_doc: dict, charger_docs: List[dict]) -> StationOut:
    """Convert station document + chargers to StationOut"""
    station_id = station_doc.get("station_id", "")
    user_id = station_doc.get("user_id")
    user_id_str = str(user_id) if user_id else ""
    
    # Get username
    username = None
    if user_id:
        username = get_username_by_user_id(user_id if isinstance(user_id, ObjectId) else to_object_id(user_id))
    
    # Get status
    status = get_station_status(station_id)
    
    # Format chargers
    chargers = [format_charger(c) for c in charger_docs]
    
    return StationOut(
        id=str(station_doc["_id"]),
        station_id=station_id,
        station_name=station_doc.get("station_name", ""),
        user_id=user_id_str,
        username=username,
        is_active=bool(station_doc.get("is_active", False)),
        location=station_doc.get("location", ""),
        description=station_doc.get("description", ""),
        status=status,
        stationImage=station_doc.get("images", {}).get("station"),
        chargers=chargers,
        createdAt=station_doc.get("createdAt"),
    )


# ============================================================
# Image Upload Helpers
# ============================================================

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 3 * 1024 * 1024  # 3 MB


def _ensure_dir(p: pathlib.Path):
    p.mkdir(parents=True, exist_ok=True)


async def save_image(folder: str, item_id: str, kind: str, upload: UploadFile) -> str:
    """
    Save image and return URL
    folder: "stations" or "chargers"
    """
    if upload.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {upload.content_type}")
    
    data = await upload.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="File too large (> 3MB)")
    
    subdir = pathlib.Path(UPLOADS_ROOT) / folder / item_id
    _ensure_dir(subdir)
    
    ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }.get(upload.content_type, "")
    
    fname = f"{kind}-{uuid.uuid4().hex}{ext}"
    dest = subdir / fname
    
    with open(dest, "wb") as f:
        f.write(data)
    
    return f"/uploads/{folder}/{item_id}/{fname}"


# ---------------------------------------------------------
# GET /all-stations/ - Get all Stations with Chargers
# ---------------------------------------------------------

def to_object_id_safe(s: str):
    """Convert string to ObjectId, return original string if failed"""
    try:
        return ObjectId(s)
    except:
        return s
    
@router.get("/all-stations/")
def get_all_stations(
    current: UserClaims = Depends(get_current_user)
):
    """Get all Stations with Chargers (nested)"""
    
    # Debug
    print(f"=== DEBUG ===")
    print(f"user_id: {current.user_id}, role: {current.role}")
    
    # Filter by role
    if current.role == "admin":
        match_query = {}
    elif current.role == "technician":
        if current.station_ids and len(current.station_ids) > 0:
            match_query = {"station_id": {"$in": current.station_ids}}
        else:
            return {"stations": []}
    else:
        # Owner - ลองทั้ง string และ ObjectId
        match_query = {
            "$or": [
                {"user_id": current.user_id},
                {"user_id": to_object_id_safe(current.user_id)}
            ]
        }
    
    print(f"match_query: {match_query}")
    
    # Get stations
    stations_cursor = station_collection.find(match_query)
    stations_list = list(stations_cursor)
    print(f"Found {len(stations_list)} stations")
    
    result = []
    for station_doc in stations_list:
        station_id = station_doc.get("station_id")
        chargers_cursor = charger_collection.find({"station_id": station_id}).sort("chargerNo", 1)
        charger_docs = list(chargers_cursor)
        station_out = format_station_with_chargers(station_doc, charger_docs)
        result.append(station_out.dict())
    
    return {"stations": result}

# ---------------------------------------------------------
# POST /add_stations/ - Create Station with Chargers
# ---------------------------------------------------------
@router.post("/add_stations/", status_code=201)
def create_station_with_chargers(
    body: StationWithChargersCreate,
):
    """Create new Station with Chargers"""
    
    station_data = body.station
    chargers_data = body.chargers
    
    # Validate station_id
    station_id = station_data.station_id.strip()
    if not station_id:
        raise HTTPException(status_code=400, detail="station_id is required")
    
    # Check duplicate station_id
    if station_collection.find_one({"station_id": station_id}):
        raise HTTPException(status_code=409, detail="station_id already exists")
    
    # Resolve owner
    owner_oid = None
    if station_data.user_id:
        owner_oid = to_object_id(station_data.user_id)
    elif station_data.owner:
        user = users_collection.find_one({"username": station_data.owner.strip()}, {"_id": 1})
        if not user:
            raise HTTPException(status_code=400, detail="Invalid owner username")
        owner_oid = user["_id"]
    
    now = datetime.now(timezone.utc)
    
    # 1) Insert Station
    station_doc = {
        "station_id": station_id,
        "station_name": station_data.station_name.strip(),
        "user_id": owner_oid,
        "is_active": station_data.is_active if station_data.is_active is not None else True,
        "location": station_data.location.strip() if station_data.location else "",
        "description": station_data.description.strip() if station_data.description else "",
        "images": {},
        "createdAt": now,
    }
    
    try:
        station_result = station_collection.insert_one(station_doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="station_id already exists")
    
    # 2) Insert Chargers
    created_chargers = []
    for idx, charger in enumerate(chargers_data):
        # Use provided chargerNo or auto-generate
        charger_no = charger.chargerNo if charger.chargerNo else idx + 1
        
        charger_doc = {
            "station_id": station_id,
            "chargeBoxID": charger.chargeBoxID.strip(),
            "chargerNo": charger_no,
            "brand": charger.brand.strip(),
            "model": charger.model.strip(),
            "SN": charger.SN.strip(),
            "WO": charger.WO.strip(),
            "power": charger.power.strip() if charger.power else "",
            "PLCFirmware": charger.PLCFirmware.strip(),
            "PIFirmware": charger.PIFirmware.strip(),
            "RTFirmware": charger.RTFirmware.strip(),
            "commissioningDate": charger.commissioningDate,
            "warrantyYears": charger.warrantyYears if charger.warrantyYears else 1,
            "numberOfCables": charger.numberOfCables if charger.numberOfCables else 1,
            "is_active": charger.is_active if charger.is_active is not None else True,
            "location": charger.location.strip() if charger.location else "",
            "description": charger.description.strip() if charger.description else "",
            "ocppUrl": charger.ocppUrl.strip() if charger.ocppUrl else "",
            "chargerType": charger.chargerType if charger.chargerType else "DC",
            "images": {},
            "createdAt": now,
        }
        charger_result = charger_collection.insert_one(charger_doc)
        charger_doc["_id"] = charger_result.inserted_id
        created_chargers.append(charger_doc)
    
    # 3) Format response
    station_doc["_id"] = station_result.inserted_id
    station_out = format_station_with_chargers(station_doc, created_chargers)
    
    return {
        "id": str(station_result.inserted_id),
        "station": station_out.dict(),
        "chargers": [format_charger(c, include_status=False).dict() for c in created_chargers],
    }

# ---------------------------------------------------------
# PATCH /update_stations/{id} - Update Station
# ---------------------------------------------------------
@router.patch("/update_stations/{id}")
def update_station(
    id: str,
    body: StationUpdate,
):
    """Update Station data (not including Chargers)"""
    
    oid = to_object_id(id)
    station = station_collection.find_one({"_id": oid})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # TODO: Check permission
    
    update_data = {}
    if body.station_name is not None:
        update_data["station_name"] = body.station_name.strip()
    if body.is_active is not None:
        update_data["is_active"] = body.is_active
    if body.location is not None:
        update_data["location"] = body.location.strip()
    if body.description is not None:
        update_data["description"] = body.description.strip()
    
    # เมื่อเปลี่ยน user_id ให้ดึง username มา update ด้วย
    if body.user_id is not None:
        new_user_oid = to_object_id(body.user_id)
        update_data["user_id"] = new_user_oid
        
        # ดึง username จาก users collection
        user = users_collection.find_one({"_id": new_user_oid})
        if user:
            update_data["username"] = user.get("username", "")
        else:
            raise HTTPException(status_code=400, detail="User not found")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    station_collection.update_one({"_id": oid}, {"$set": update_data})
    
    # Return updated station
    updated = station_collection.find_one({"_id": oid})
    chargers = list(charger_collection.find({"station_id": updated["station_id"]}).sort("chargerNo", 1))
    
    return format_station_with_chargers(updated, chargers).dict()

# ---------------------------------------------------------
# DELETE /delete_stations/{id} - Delete Station and all Chargers
# ---------------------------------------------------------
@router.delete("/delete_stations/{id}", status_code=204)
def delete_station(
    id: str,
):
    """Delete Station and all related Chargers"""
    
    oid = to_object_id(id)
    station = station_collection.find_one({"_id": oid})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # TODO: Check permission
    
    station_id = station["station_id"]
    
    # Delete all chargers of this station
    charger_collection.delete_many({"station_id": station_id})
    
    # Delete station
    station_collection.delete_one({"_id": oid})
    
    return Response(status_code=204)


# ---------------------------------------------------------
# POST /add_charger/{station_id} - Add Charger to Station
# ---------------------------------------------------------
@router.post("/add_charger/{station_id}", status_code=201)
def add_charger_to_station(
    station_id: str,
    body: ChargerCreate,
):
    """Add new Charger to existing Station"""
    
    # Check if station exists
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # TODO: Check permission
    
    # Get next chargerNo if not provided
    charger_no = body.chargerNo if body.chargerNo else get_next_charger_no(station_id)
    
    charger_doc = {
        "station_id": station_id,
        "chargeBoxID": body.chargeBoxID.strip(),
        "chargerNo": charger_no,
        "brand": body.brand.strip(),
        "model": body.model.strip(),
        "SN": body.SN.strip(),
        "WO": body.WO.strip(),
        "power": body.power.strip() if body.power else "",
        "PLCFirmware": body.PLCFirmware.strip(),
        "PIFirmware": body.PIFirmware.strip(),
        "RTFirmware": body.RTFirmware.strip(),
        "commissioningDate": body.commissioningDate,
        "warrantyYears": body.warrantyYears if body.warrantyYears else 1,
        "numberOfCables": body.numberOfCables if body.numberOfCables else 1,
        "is_active": body.is_active if body.is_active is not None else True,
        "location": body.location.strip() if body.location else "",
        "description": body.description.strip() if body.description else "",
        "ocppUrl": body.ocppUrl.strip() if body.ocppUrl else "",
        "chargerType": body.chargerType if body.chargerType else "DC",
        "images": {},
        "createdAt": datetime.now(timezone.utc),
    }
    
    result = charger_collection.insert_one(charger_doc)
    charger_doc["_id"] = result.inserted_id
    
    return format_charger(charger_doc, include_status=False).dict()


# ---------------------------------------------------------
# PATCH /update_charger/{id} - Update Charger
# ---------------------------------------------------------
@router.patch("/update_charger/{id}")
def update_charger(
    id: str,
    body: ChargerUpdate,
):
    """Update Charger data"""
    
    oid = to_object_id(id)
    charger = charger_collection.find_one({"_id": oid})
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    # TODO: Check permission via station owner
    update_data = {}
    
    # String fields
    for field in ["chargeBoxID", "brand", "model", "SN", "WO", "power", "PLCFirmware", "PIFirmware", "RTFirmware", "commissioningDate", "location", "description", "ocppUrl", "chargerType"]:
        value = getattr(body, field, None)
        if value is not None:
            update_data[field] = value.strip() if isinstance(value, str) else value
    
    # Integer fields
    for field in ["chargerNo", "warrantyYears", "numberOfCables"]:
        value = getattr(body, field, None)
        if value is not None:
            update_data[field] = value
    
    # Boolean fields
    if body.is_active is not None:
        update_data["is_active"] = body.is_active
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    charger_collection.update_one({"_id": oid}, {"$set": update_data})
    
    updated = charger_collection.find_one({"_id": oid})
    return format_charger(updated).dict()


# ---------------------------------------------------------
# DELETE /delete_charger/{id} - Delete Charger
# ---------------------------------------------------------
@router.delete("/delete_charger/{id}", status_code=204)
def delete_charger(
    id: str,
):
    """Delete Charger"""
    
    oid = to_object_id(id)
    charger = charger_collection.find_one({"_id": oid})
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    # TODO: Check permission
    
    charger_collection.delete_one({"_id": oid})
    return Response(status_code=204)


# ---------------------------------------------------------
# POST /stations/{station_id}/upload-image - Upload Station image
# ---------------------------------------------------------
@router.post("/stations/{station_id}/upload-image")
async def upload_station_image(
    station_id: str,
    station: Optional[UploadFile] = File(None),
):
    """Upload image for Station"""
    
    doc = station_collection.find_one({"station_id": station_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # TODO: Check permission
    
    if not station:
        return {"updated": False, "images": doc.get("images", {})}
    
    url = await save_image("stations", station_id, "station", station)
    
    images = doc.get("images", {})
    images["station"] = url
    
    station_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"images": images, "updatedAt": datetime.now(timezone.utc)}}
    )
    
    return {"updated": True, "images": images}


# ---------------------------------------------------------
# POST /chargers/{charger_id}/upload-images - Upload Charger images
# ---------------------------------------------------------
@router.post("/chargers/{charger_id}/upload-images")
async def upload_charger_images(
    charger_id: str,
    mdb: Optional[UploadFile] = File(None),
    charger: Optional[UploadFile] = File(None),
    device: Optional[UploadFile] = File(None),
):
    """Upload images for Charger (mdb, charger, device)"""
    
    oid = to_object_id(charger_id)
    doc = charger_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    # TODO: Check permission
    
    updated_images = {}
    for kind, upload in {"mdb": mdb, "charger": charger, "device": device}.items():
        if upload is None:
            continue
        url = await save_image("chargers", charger_id, kind, upload)
        updated_images[kind] = url
    
    if not updated_images:
        return {"updated": False, "images": doc.get("images", {})}
    
    images = doc.get("images", {})
    images.update(updated_images)
    
    charger_collection.update_one(
        {"_id": oid},
        {"$set": {"images": images, "updatedAt": datetime.now(timezone.utc)}}
    )
    
    return {"updated": True, "images": images}


# ---------------------------------------------------------
# GET /station/{station_id} - Get single Station with Chargers
# ---------------------------------------------------------
@router.get("/station/{station_id}")
def get_station(
    station_id: str,
):
    """Get single Station with Chargers"""
    
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    chargers = list(charger_collection.find({"station_id": station_id}).sort("chargerNo", 1))
    
    return format_station_with_chargers(station, chargers).dict()


# ---------------------------------------------------------
# GET /chargers/{station_id} - Get Chargers of Station
# ---------------------------------------------------------
@router.get("/chargers/{station_id}")
def get_chargers_by_station(
    station_id: str,
):
    """Get all Chargers of a Station"""
    
    chargers = list(charger_collection.find({"station_id": station_id}).sort("chargerNo", 1))
    return {"chargers": [format_charger(c).dict() for c in chargers]}
