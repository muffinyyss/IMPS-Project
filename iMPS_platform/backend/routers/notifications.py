# routers/notifications.py
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SENDER_EMAIL

from fastapi import APIRouter, Depends, Request, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel, Field
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
    if hasattr(request.app.state, "errorDB"):
        return request.app.state.errorDB
    try:
        from main import errorDB
        return errorDB
    except ImportError:
        raise HTTPException(status_code=500, detail="errorDB not configured")


def get_charger_collection(request: Request):
    try:
        from main import client
        return client["iMPS"]["charger"]
    except ImportError:
        raise HTTPException(status_code=500, detail="charger collection not configured")


def get_stations_collection(request: Request):
    try:
        from main import client
        return client["iMPS"]["stations"]
    except ImportError:
        raise HTTPException(status_code=500, detail="stations collection not configured")


def get_users_collection(request: Request):
    """ดึง users collection จาก iMPS database"""
    try:
        from main import client
        return client["iMPS"]["users"]
    except ImportError:
        raise HTTPException(status_code=500, detail="users collection not configured")


def get_email_rules_collection(request: Request):
    """ดึง email_notification_rules collection จาก iMPS database"""
    try:
        from main import client
        return client["iMPS"]["email_notification_rules"]
    except ImportError:
        raise HTTPException(status_code=500, detail="email_notification_rules collection not configured")


async def lookup_station_name(request: Request, station_id: str) -> str:
    if not station_id:
        return station_id
    try:
        stations_coll = get_stations_collection(request)
        station = await stations_coll.find_one({"station_id": station_id})
        if station and station.get("station_name"):
            return station.get("station_name")
    except Exception as e:
        print(f"[notifications] Lookup station name error: {e}")
    return station_id


async def lookup_charger_info(request: Request, chargebox_id: str) -> dict:
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


# ================================================================
# Email Rule Models
# ================================================================

class EmailRuleCreate(BaseModel):
    """Body สำหรับสร้าง/อัปเดต email rule"""
    id: Optional[str] = None           # ถ้ามี = update, ไม่มี = create
    station_id: str
    station_name: str = ""
    chargebox_id: str = "all"           # "all" หรือ chargeBoxID เฉพาะ
    user_ids: List[str] = Field(default_factory=list)
    notify_types: List[str] = Field(default_factory=lambda: ["error", "warning"])
    enabled: bool = True


class EmailRuleOut(BaseModel):
    id: str
    station_id: str
    station_name: str
    chargebox_id: str
    user_ids: List[str]
    notify_types: List[str]
    enabled: bool
    created_by: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


def format_email_rule(doc: dict) -> dict:
    """Convert MongoDB document → response dict"""
    return {
        "id": str(doc["_id"]),
        "station_id": doc.get("station_id", ""),
        "station_name": doc.get("station_name", ""),
        "chargebox_id": doc.get("chargebox_id", "all"),
        "user_ids": doc.get("user_ids", []),
        "notify_types": doc.get("notify_types", []),
        "enabled": doc.get("enabled", True),
        "created_by": doc.get("created_by"),
        "createdAt": doc["createdAt"].isoformat() if isinstance(doc.get("createdAt"), datetime) else doc.get("createdAt"),
        "updatedAt": doc["updatedAt"].isoformat() if isinstance(doc.get("updatedAt"), datetime) else doc.get("updatedAt"),
    }


# ================================================================
# Email Rule Endpoints
# ================================================================

@router.get("/email-rules")
async def get_email_rules(
    request: Request,
    station_id: Optional[str] = Query(None, description="กรองตาม station_id"),
    # current: UserClaims = Depends(get_current_user),
):
    """ดึง email rules ทั้งหมด (หรือกรองตาม station_id)"""
    coll = get_email_rules_collection(request)

    query = {}
    if station_id:
        query["station_id"] = station_id

    cursor = coll.find(query).sort("createdAt", -1)
    docs = await cursor.to_list(length=200)

    return {
        "rules": [format_email_rule(d) for d in docs],
        "total": len(docs),
    }


@router.post("/email-rules")
async def upsert_email_rule(
    request: Request,
    body: EmailRuleCreate,
    # current: UserClaims = Depends(get_current_user),
):
    """
    สร้างหรืออัปเดต email rule
    - ถ้า body.id มีค่าและเจอใน DB → update
    - ถ้าไม่มี → insert ใหม่
    """
    coll = get_email_rules_collection(request)
    now = datetime.now(timezone.utc)

    # Validate
    if not body.station_id:
        raise HTTPException(status_code=400, detail="station_id is required")
    if not body.user_ids:
        raise HTTPException(status_code=400, detail="user_ids is required")
    if not body.notify_types:
        raise HTTPException(status_code=400, detail="notify_types is required")

    # Validate notify_types
    valid_types = {"info", "warning", "success", "error"}
    for nt in body.notify_types:
        if nt not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid notify_type: {nt}")

    # ===== Update existing =====
    if body.id:
        # ลอง parse เป็น ObjectId ก่อน ถ้าไม่ได้ก็ค้นหาจาก rule_id field
        existing = None
        try:
            existing = await coll.find_one({"_id": ObjectId(body.id)})
        except Exception:
            existing = await coll.find_one({"rule_id": body.id})

        if existing:
            update_data = {
                "station_id": body.station_id,
                "station_name": body.station_name,
                "chargebox_id": body.chargebox_id,
                "user_ids": body.user_ids,
                "notify_types": body.notify_types,
                "enabled": body.enabled,
                "updatedAt": now,
            }
            await coll.update_one({"_id": existing["_id"]}, {"$set": update_data})

            updated = await coll.find_one({"_id": existing["_id"]})
            return {"success": True, "rule": format_email_rule(updated)}

    # ===== Create new =====
    doc = {
        "station_id": body.station_id,
        "station_name": body.station_name,
        "chargebox_id": body.chargebox_id,
        "user_ids": body.user_ids,
        "notify_types": body.notify_types,
        "enabled": body.enabled,
        "rule_id": body.id or f"rule-{int(now.timestamp() * 1000)}",
        # "created_by": current.user_id,  # เปิดเมื่อมี auth
        "createdAt": now,
        "updatedAt": now,
    }
    result = await coll.insert_one(doc)
    doc["_id"] = result.inserted_id

    return {"success": True, "rule": format_email_rule(doc)}


@router.delete("/email-rules/{rule_id}")
async def delete_email_rule(
    request: Request,
    rule_id: str,
    # current: UserClaims = Depends(get_current_user),
):
    """ลบ email rule"""
    coll = get_email_rules_collection(request)

    # ลอง ObjectId ก่อน → fallback เป็น rule_id field
    deleted = False
    try:
        result = await coll.delete_one({"_id": ObjectId(rule_id)})
        if result.deleted_count > 0:
            deleted = True
    except Exception:
        pass

    if not deleted:
        result = await coll.delete_one({"rule_id": rule_id})
        deleted = result.deleted_count > 0

    if not deleted:
        raise HTTPException(status_code=404, detail="Rule not found")

    return {"success": True, "deleted_id": rule_id}


# ================================================================
# Email Sending Helper (เรียกจาก SSE หรือ notification flow)
# ================================================================

async def send_email_smtp(to: list[str], subject: str, body: str):
    """ส่งอีเมลจริงผ่าน SMTP"""
    if not SMTP_USER or not SMTP_PASS:
        print("[email-notify] ❌ SMTP credentials not configured")
        return False

    try:
        msg = MIMEMultipart()
        msg["Subject"] = subject
        msg["From"] = SENDER_EMAIL
        msg["To"] = ", ".join(to)
        msg.attach(MIMEText(body, "plain", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

        print(f"[email-notify] ✅ Email sent to: {to}")
        return True
    except Exception as e:
        print(f"[email-notify] ❌ SMTP error: {e}")
        return False
    
async def check_and_send_email(request: Request, notification: dict):
    try:
        rules_coll = get_email_rules_collection(request)
        users_coll = get_users_collection(request)

        station_id = notification.get("station_id", "")
        sn = notification.get("sn", "")
        chargebox_id = notification.get("chargebox_id", "")
        notif_type = notification.get("type", "error")

        # ★ ถ้า station_id ว่างหรือเป็น SN → ลอง lookup อีกครั้ง
        if not station_id or station_id == sn:
            try:
                charger_coll = get_charger_collection(request)
                charger = await charger_coll.find_one({"SN": sn})
                if charger:
                    station_id = charger.get("station_id", "")
                    if not chargebox_id:
                        chargebox_id = charger.get("chargeBoxID", "")
            except Exception as e:
                print(f"[email-notify] SN lookup fallback error: {e}")

        if not station_id:
            print(f"[email-notify] No station_id for SN={sn}, skipping")
            return

        # ★ Query rules ที่ match station + enabled + type
        query = {
            "station_id": station_id,
            "enabled": True,
            "notify_types": notif_type,
        }

        cursor = rules_coll.find(query)
        rules = await cursor.to_list(length=100)

        if not rules:
            # ★ ไม่มี rule → ไม่ส่ง email
            print(f"[email-notify] No rules for station={station_id} type={notif_type}, skip")
            return

        for rule in rules:
            # เช็ค chargebox/SN filter
            rule_chargebox = rule.get("chargebox_id", "all")
            if rule_chargebox != "all":
                if rule_chargebox != chargebox_id and rule_chargebox != sn:
                    continue

            # ดึง email ของ users ใน rule
            user_ids = rule.get("user_ids", [])
            if not user_ids:
                continue

            user_oids = []
            for uid in user_ids:
                try:
                    user_oids.append(ObjectId(uid))
                except Exception:
                    continue

            users_cursor = users_coll.find(
                {"_id": {"$in": user_oids}},
                {"email": 1, "username": 1}
            )
            users = await users_cursor.to_list(length=200)
            recipient_emails = [u["email"] for u in users if u.get("email")]

            if not recipient_emails:
                continue

            # ★ สร้าง email
            station_name = notification.get("station_name", station_id)
            head = notification.get("head", "")
            error_msg = notification.get("error", "New notification")

            subject = f"[{station_name}] {notif_type.upper()}: {error_msg}"
            body_text = f"Station: {station_name}\nSN: {sn}\n"
            if head:
                body_text += f"Head: {head}\n"
            if chargebox_id:
                body_text += f"ChargeBox ID: {chargebox_id}\n"
            body_text += (
                f"Type: {notif_type}\n"
                f"Message: {error_msg}\n"
                f"Time: {notification.get('timestamp', '-')}\n"
            )

            await send_email_smtp(
                to=recipient_emails,
                subject=subject,
                body=body_text,
            )

            # TODO: เปลี่ยนเป็น SMTP จริง

    except Exception as e:
        print(f"[email-notify] Error: {e}")
# ===== API Endpoints (เดิม) =====

async def lookup_station_by_sn(request: Request, sn: str) -> dict:
    """ค้นหา station จาก SN ของ charger"""
    if not sn:
        return {}
    try:
        charger_coll = get_charger_collection(request)
        charger = await charger_coll.find_one({"SN": sn})
        if charger:
            station_id = charger.get("station_id", "")
            station_name = ""
            if station_id:
                stations_coll = get_stations_collection(request)
                station = await stations_coll.find_one({"station_id": station_id})
                if station:
                    station_name = station.get("station_name", station_id)

            return {
                "station_id": station_id,
                "station_name": station_name,
                "chargebox_id": charger.get("chargeBoxID", ""),
                "charger_no": charger.get("chargerNo"),
                "sn": sn,
            }
    except Exception as e:
        print(f"[notifications] Lookup SN error: {e}")
    return {"sn": sn}

def parse_fault_message(message: str) -> dict:
    """
    Parse "KungPhatthana:Head 1: EMERGENCY STOP ACTIVIVE"
    → { "source": "KungPhatthana", "head": "Head 1", "error": "EMERGENCY STOP ACTIVIVE" }
    """
    if not message:
        return {"source": "", "head": "", "error": ""}
    
    parts = message.split(":", 2)  # แยกสูงสุด 3 ส่วน
    if len(parts) >= 3:
        return {
            "source": parts[0].strip(),
            "head": parts[1].strip(),
            "error": parts[2].strip(),
        }
    elif len(parts) == 2:
        return {
            "source": parts[0].strip(),
            "head": "",
            "error": parts[1].strip(),
        }
    return {"source": "", "head": "", "error": message.strip()}


@router.get("/all")
async def get_all_notifications(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    unread_only: bool = Query(default=False),
):
    errorDB = get_error_db(request)
    all_notifications = []

    collection_names = await errorDB.list_collection_names()
    collection_names = [c for c in collection_names if not c.startswith("system.")]

    print(f"[notifications] Found {len(collection_names)} SN collections: {collection_names}")

    # ★ cache SN → station info เพื่อไม่ต้อง query ซ้ำทุก doc
    sn_cache: dict[str, dict] = {}

    for sn in collection_names:
        try:
            # Lookup SN → station info (ใช้ cache)
            if sn not in sn_cache:
                sn_cache[sn] = await lookup_station_by_sn(request, sn)
            station_info = sn_cache[sn]

            coll = errorDB[sn]
            cursor = coll.find({}).sort("_id", -1).limit(limit)
            docs = await cursor.to_list(None)

            for doc in docs:
                # ★ Parse message field แทน error field
                raw_message = doc.get("message") or doc.get("error") or ""
                parsed = parse_fault_message(raw_message)

                notification = {
                    "id": str(doc.get("_id")),
                    "station_id": station_info.get("station_id", sn),
                    "station_name": station_info.get("station_name") or parsed.get("source") or sn,
                    "chargebox_id": station_info.get("chargebox_id", ""),
                    "charger_no": station_info.get("charger_no"),
                    "sn": sn,
                    "error": parsed.get("error") or raw_message,
                    "head": parsed.get("head", ""),
                    "error_code": doc.get("error_code") or doc.get("errorCode"),
                    "timestamp": _get_timestamp(doc),
                    "read": doc.get("read", False),
                    "type": _determine_type_from_message(raw_message),
                }
                all_notifications.append(notification)

        except Exception as e:
            print(f"[notifications] Error fetching from SN {sn}: {e}")
            continue

    all_notifications.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    if unread_only:
        all_notifications = [n for n in all_notifications if not n.get("read")]

    all_notifications = all_notifications[:limit]

    return {
        "notifications": all_notifications,
        "total": len(all_notifications),
        "unread_count": sum(1 for n in all_notifications if not n.get("read")),
        "stations": collection_names,
    }

@router.get("/count")
async def get_notification_count(request: Request):
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
async def notifications_stream(request: Request):
    """SSE stream สำหรับ real-time notifications จากทุก stations — พร้อมส่ง email"""
    errorDB = get_error_db(request)

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
        last_ids = {}
        station_name_cache = {}
        sn_cache = {} 

        async def get_charger_info(chargebox_id: str) -> dict:
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

        for sn in collection_names:
            try:
                coll = errorDB[sn]
                latest = await coll.find_one({}, sort=[("_id", -1)])

                if latest:
                    last_ids[sn] = latest.get("_id")
                    raw_message = latest.get("message") or latest.get("error") or ""
                    parsed = parse_fault_message(raw_message)

                    if sn not in sn_cache:
                        sn_cache[sn] = await lookup_station_by_sn(request, sn)
                    station_info = sn_cache[sn]

                    initial_notifications.append({
                        "id": str(latest.get("_id")),
                        "station_id": station_info.get("station_id", sn),
                        "station_name": station_info.get("station_name") or parsed.get("source") or sn,
                        "chargebox_id": station_info.get("chargebox_id", ""),
                        "charger_no": station_info.get("charger_no"),
                        "sn": sn,
                        "error": parsed.get("error") or raw_message,
                        "head": parsed.get("head", ""),
                        "timestamp": _get_timestamp(latest),
                        "read": latest.get("read", False),
                        "type": _determine_type_from_message(raw_message),
                    })
            except Exception as e:
                print(f"[notifications] Init error for {sn}: {e}")
                continue

        if initial_notifications:
            yield f"event: init\ndata: {to_json(initial_notifications)}\n\n"
        else:
            yield ": keep-alive\n\n"

        # ----- Watch for updates -----
        while True:
            if await request.is_disconnected():
                break

            collection_names = await errorDB.list_collection_names()
            collection_names = [c for c in collection_names if not c.startswith("system.")]

            for station_id in collection_names:
                try:
                    coll = errorDB[station_id]
                    latest = await coll.find_one({}, sort=[("_id", -1)])

                    if latest and latest.get("_id") != last_ids.get(station_id):
                        last_ids[station_id] = latest.get("_id")
                        raw_message = latest.get("message") or latest.get("error") or ""
                        parsed = parse_fault_message(raw_message)

                        if station_id not in sn_cache:
                            sn_cache[station_id] = await lookup_station_by_sn(request, station_id)
                        station_info = sn_cache[station_id]

                        notification = {
                            "id": str(latest.get("_id")),
                            "station_id": station_info.get("station_id", station_id),
                            "station_name": station_info.get("station_name") or parsed.get("source") or station_id,
                            "chargebox_id": station_info.get("chargebox_id", ""),
                            "charger_no": station_info.get("charger_no"),
                            "sn": station_id,  # collection name = SN
                            "error": parsed.get("error") or raw_message,
                            "head": parsed.get("head", ""),
                            "timestamp": _get_timestamp(latest),
                            "read": latest.get("read", False),
                            "type": _determine_type_from_message(raw_message),
                        }

                        yield f"event: new\ndata: {to_json(notification)}\n\n"

                        # ★ ส่ง email ถ้ามี rule ที่ match
                        try:
                            await check_and_send_email(request, notification)
                        except Exception as email_err:
                            print(f"[email-notify] Error in SSE: {email_err}")

                except Exception as e:
                    print(f"[notifications] Watch error for {station_id}: {e}")
                    continue

            yield ": keep-alive\n\n"
            await asyncio.sleep(30)

    return StreamingResponse(event_generator(), headers=headers)


@router.post("/{notification_id}/read")
async def mark_as_read(
    request: Request,
    notification_id: str,
    station_id: str = Query(None, description="(deprecated) station_id เดิม"),
    sn: str = Query(None, description="SN = ชื่อ collection ใน errorDB"),
):
    errorDB = get_error_db(request)
    # ★ ใช้ sn เป็นหลัก, fallback เป็น station_id (backward compat)
    collection_name = sn or station_id
    if not collection_name:
        raise HTTPException(status_code=400, detail="sn or station_id is required")
    try:
        validate_station_id(collection_name)
        coll = errorDB[collection_name]
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
    station_id: Optional[str] = Query(None),
):
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
    station_id: str = Query(None),
    sn: str = Query(None, description="SN = ชื่อ collection ใน errorDB"),
):
    errorDB = get_error_db(request)
    collection_name = sn or station_id
    if not collection_name:
        raise HTTPException(status_code=400, detail="sn or station_id is required")
    try:
        validate_station_id(collection_name)
        coll = errorDB[collection_name]
        result = await coll.delete_one({"_id": ObjectId(notification_id)})
        return {"success": result.deleted_count > 0}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ===== Private Helper Functions =====

def _get_timestamp(doc: dict):
    ts = doc.get("timestamp") or doc.get("created_at") or doc.get("createdAt")
    if isinstance(ts, datetime):
        return ts.isoformat()
    return ts

def _determine_type(doc: dict) -> str:
    # ★ ดูจาก message ด้วย (ไม่ใช่แค่ error)
    error_text = str(doc.get("message") or doc.get("error", "")).lower()
    return _classify_error_text(error_text)


def _determine_type_from_message(message: str) -> str:
    return _classify_error_text(message.lower())


def _classify_error_text(error_text: str) -> str:
    if any(kw in error_text for kw in ["emergency", "offline", "disconnect", "fail", "critical", "overcurrent", "fault"]):
        return "error"
    if any(kw in error_text for kw in ["warning", "maintenance", "pm", "low", "high"]):
        return "warning"
    if any(kw in error_text for kw in ["success", "complete", "approved", "done"]):
        return "success"
    if any(kw in error_text for kw in ["info", "update", "notice"]):
        return "info"
    return "error"