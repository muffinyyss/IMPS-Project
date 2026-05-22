# routers/notifications.py
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SENDER_EMAIL

from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel, Field
import json
import re

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)

# FIX #2: เรียง specific keywords ก่อน generic เสมอ (Python หยุด match ตัวแรกที่เจอ)
FAULT_THRESHOLDS: list[tuple[str, int]] = [
    # threshold 1 — most specific first
    ("output short circuit",                  1),
    ("duplicate module id",                   1),
    ("input phase lost",                      1),
    ("input asymmetric",                      1),
    ("input under voltage",                   1),
    ("output over voltage",                   1),
    ("no isolation fault",                    1),
    ("imd self check",                        1),
    ("inactive",                              1),
    ("ev can current range",                  1),
    ("pe cut",                                1),
    ("charging connector temperature",        1),
    ("cp measures only 0v",                   1),

    # threshold 2
    ("can communication error",               2),

    # threshold 3
    ("discharge abnormal",                    3),
    ("module protection",                     3),
    ("power module fan error",                3),
    ("over temperature",                      3),
    ("pfc circuit abnormal",                  3),
    ("pfc circuit disabled",                  3),
    ("internal communication loss",           3),
    ("can error",                             3),
    ("load distribution",                     3),

    # threshold 5
    ("power units not ready",                 5),
    ("no active power module",                5),
    ("power module error",                    5),

    # threshold 10 — specific
    ("sdp timeout",                          10),
    ("supportedappprotocol timeout",         10),
    ("sessionsetup timeout",                 10),
    ("servicediscovery timeout",             10),
    ("servicepaymentselection timeout",      10),
    ("contractauthentication timeout",       10),
    ("chargeparameterdiscovery timeout",     10),
    ("cablecheck timeout",                   10),
    ("precharge timeout",                    10),
    ("powerdelivery timeout",                10),
    ("insulation_fault",                     10),
    ("user error shutdown",                  10),
    ("emergency stop",                       10),
    ("stuck in initialization state",        10),
    ("stuck in initialization secc ok",      10),
    ("stuck in initialization contrac",      10),

    # threshold 10 — generic fallback (ต้องอยู่ท้ายสุด!)
    ("error",                                10),
]

DEFAULT_FAULT_THRESHOLD = 5

_fault_counters: dict[tuple, int] = {}
_fault_sent: set[tuple] = set()

def _get_threshold(error: str) -> int:
    error_lower = error.strip().lower()
    for keyword, threshold in FAULT_THRESHOLDS:
        if keyword in error_lower:
            return threshold
    return DEFAULT_FAULT_THRESHOLD

def _increment_fault(sn: str, error: str) -> int:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    key = (sn, error.strip().lower(), today)
    _fault_counters[key] = _fault_counters.get(key, 0) + 1
    return _fault_counters[key]

def _cleanup_old_counters():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for k in [k for k in _fault_counters if k[2] != today]:
        del _fault_counters[k]
    for k in [k for k in _fault_sent if k[2] != today]:  # ✅ ล้าง sent ของเมื่อวานด้วย
        _fault_sent.discard(k)

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
    try:
        from main import client
        return client["iMPS"]["users"]
    except ImportError:
        raise HTTPException(status_code=500, detail="users collection not configured")


def get_email_rules_collection(request: Request):
    try:
        from main import client
        return client["iMPS"]["email_notification_rules"]
    except ImportError:
        raise HTTPException(status_code=500, detail="email_notification_rules collection not configured")


# ================================================================
# Email Rule Models
# ================================================================

class EmailRuleCreate(BaseModel):
    id: Optional[str] = None
    station_id: str
    station_name: str = ""
    chargebox_id: str = "all"
    user_ids: List[str] = Field(default_factory=list)
    enabled: bool = True


def format_email_rule(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "station_id": doc.get("station_id", ""),
        "station_name": doc.get("station_name", ""),
        "chargebox_id": doc.get("chargebox_id", "all"),
        "user_ids": doc.get("user_ids", []),
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
):
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
):
    coll = get_email_rules_collection(request)
    now = datetime.now(timezone.utc)

    if not body.station_id:
        raise HTTPException(status_code=400, detail="station_id is required")
    if not body.user_ids:
        raise HTTPException(status_code=400, detail="user_ids is required")

    if body.id:
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
                "enabled": body.enabled,
                "updatedAt": now,
            }
            await coll.update_one({"_id": existing["_id"]}, {"$set": update_data})
            updated = await coll.find_one({"_id": existing["_id"]})
            return {"success": True, "rule": format_email_rule(updated)}

    doc = {
        "station_id": body.station_id,
        "station_name": body.station_name,
        "chargebox_id": body.chargebox_id,
        "user_ids": body.user_ids,
        "enabled": body.enabled,
        "rule_id": body.id or f"rule-{int(now.timestamp() * 1000)}",
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
):
    coll = get_email_rules_collection(request)
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
# Email Sending Helper
# ================================================================

async def send_email_smtp(to: list[str], subject: str, body: str):
    """FIX #1: ส่งอีเมลใน thread pool ไม่บล็อก async event loop"""
    if not SMTP_USER or not SMTP_PASS:
        print("[email-notify] ❌ SMTP credentials not configured")
        return False

    def _send_blocking():
        msg = MIMEMultipart()
        msg["Subject"] = subject
        msg["From"] = SENDER_EMAIL
        msg["To"] = ", ".join(to)
        msg.attach(MIMEText(body, "plain", "utf-8"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)

    try:
        await asyncio.to_thread(_send_blocking)
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
        error_msg = notification.get("error", "")

        # นับ fault และเช็ค threshold
        _cleanup_old_counters()
        current_count = _increment_fault(sn, error_msg)
        threshold = _get_threshold(error_msg)

        if current_count < threshold:
            print(f"[email-notify] fault count {current_count}/{threshold} SN={sn} — ยังไม่ส่ง")
            return

        # ✅ เช็คว่าส่งไปแล้ววันนี้หรือยัง
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        sent_key = (sn, error_msg.strip().lower(), today)

        if sent_key in _fault_sent:
            print(f"[email-notify] already sent today SN={sn} error='{error_msg}' — skip")
            return

        print(f"[email-notify] threshold reached ({current_count}/{threshold}) SN={sn} → sending email")


        # Lookup station จาก SN ถ้ายังไม่มี
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

        # FIX (all station): ไม่ return ถ้า station_id ว่าง — ยังหา rule "all" ได้
        if not station_id:
            print(f"[email-notify] No station_id for SN={sn}, will only match 'all' rules")

        # Build query ให้ครอบ "all" เสมอ
        query_conditions = [{"station_id": "all"}]
        if station_id:
            query_conditions.append({"station_id": station_id})

        query = {
            "$or": query_conditions,
            "enabled": True,
        }

        cursor = rules_coll.find(query)
        rules = await cursor.to_list(length=100)

        if not rules:
            print(f"[email-notify] No rules for station={station_id or 'unknown'}, skip")
            return

        # FIX #3: dedup recipients ข้าม rules ทั้งหมด ก่อนส่ง
        all_recipients: set[str] = set()

        for rule in rules:
            # เช็ค chargebox/SN filter
            rule_chargebox = rule.get("chargebox_id", "all")
            if rule_chargebox != "all":
                if rule_chargebox != chargebox_id and rule_chargebox != sn:
                    continue

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

            for u in users:
                email = u.get("email")
                if email:
                    all_recipients.add(email)

        if not all_recipients:
            print(f"[email-notify] No recipient emails found, skip")
            return

        # สร้าง email และส่งครั้งเดียว
        station_name = notification.get("station_name", station_id)
        head = notification.get("head", "")
        final_error_msg = notification.get("error", "New notification")

        subject = f"[{station_name}] FAULT: {final_error_msg}"
        body_text = f"Station: {station_name}\nSN: {sn}\n"
        if head:
            body_text += f"Head: {head}\n"
        if chargebox_id:
            body_text += f"ChargeBox ID: {chargebox_id}\n"
        ts = notification.get('timestamp', '')
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            formatted_time = dt.strftime("%d/%m/%Y %H:%M:%S")
        except Exception:
            formatted_time = ts or "-"

        body_text += (
            f"Message: {final_error_msg} (เกิดขึ้น {current_count} ครั้งวันนี้)\n"
            f"Time: {formatted_time}\n"
        )

        success = await send_email_smtp(
            to=list(all_recipients),
            subject=subject,
            body=body_text,
        )
        if success:
            _fault_sent.add(sent_key)

    except Exception as e:
        print(f"[email-notify] Error: {e}")


# ===== Station Lookup =====

async def lookup_station_by_sn(request: Request, sn: str) -> dict:
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
    parts = message.split(":", 2)
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


# ================================================================
# API Endpoints
# ================================================================

@router.get("/all")
async def get_all_notifications(
    request: Request,
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    unread_only: bool = Query(default=False),
):
    dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc) if date_from else None
    dt_to = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc) if date_to else None

    errorDB = get_error_db(request)
    all_notifications = []

    collection_names = await errorDB.list_collection_names()
    collection_names = [c for c in collection_names if not c.startswith("system.")]

    print(f"[notifications] Found {len(collection_names)} SN collections: {collection_names}")

    sn_cache: dict[str, dict] = {}

    for sn in collection_names:
        try:
            if sn not in sn_cache:
                sn_cache[sn] = await lookup_station_by_sn(request, sn)
            station_info = sn_cache[sn]

            coll = errorDB[sn]
            cursor = coll.find({}).sort("_id", -1)
            docs = await cursor.to_list(None)

            for doc in docs:
                ts = _get_timestamp(doc)
                if (dt_from or dt_to) and ts:
                    try:
                        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        if dt.tzinfo is None:
                            dt = dt.replace(tzinfo=timezone.utc)
                        if dt_from and dt < dt_from:
                            continue
                        if dt_to and dt > dt_to:
                            continue
                    except Exception as e:
                        print(f"[notifications] timestamp parse error: {ts} — {e}")

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
                }
                all_notifications.append(notification)

        except Exception as e:
            print(f"[notifications] Error fetching from SN {sn}: {e}")
            continue

    all_notifications.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    if unread_only:
        all_notifications = [n for n in all_notifications if not n.get("read")]

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

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    async def event_generator():
        last_ids = {}
        sn_cache = {}

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
                            "sn": station_id,
                            "error": parsed.get("error") or raw_message,
                            "head": parsed.get("head", ""),
                            "timestamp": _get_timestamp(latest),
                            "read": latest.get("read", False),
                        }

                        yield f"event: new\ndata: {to_json(notification)}\n\n"

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

@router.get("/debug/fault-counters")
async def get_fault_counters(request: Request):
    """ดู fault counters ปัจจุบัน + faults ทั้งหมดของวันนี้จาก DB"""
    from datetime import datetime, timezone

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    dt_start = datetime.strptime(today, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    dt_end = dt_start.replace(hour=23, minute=59, second=59)

    # ===== In-memory counters =====
    counter_result = []
    for (sn, error, date), count in _fault_counters.items():
        threshold = _get_threshold(error)
        counter_result.append({
            "sn": sn,
            "error": error,
            "date": date,
            "count": count,
            "threshold": threshold,
            "reached": count >= threshold,
        })
    counter_result.sort(key=lambda x: x["count"], reverse=True)

    # ===== Faults from DB today =====
    errorDB = get_error_db(request)
    db_faults = []
    total_today = 0

    try:
        collection_names = await errorDB.list_collection_names()
        collection_names = [c for c in collection_names if not c.startswith("system.")]

        for sn in collection_names:
            try:
                coll = errorDB[sn]
                # นับ + ดึง docs ของวันนี้
                docs = await coll.find({}).sort("_id", -1).to_list(None)

                sn_count = 0
                for doc in docs:
                    ts = _get_timestamp(doc)
                    if not ts:
                        continue
                    try:
                        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        if dt.tzinfo is None:
                            dt = dt.replace(tzinfo=timezone.utc)
                        if dt < dt_start or dt > dt_end:
                            continue
                    except Exception:
                        continue

                    raw = doc.get("message") or doc.get("error") or ""
                    parsed = parse_fault_message(raw)
                    error_text = parsed.get("error") or raw

                    db_faults.append({
                        "sn": sn,
                        "error": error_text,
                        "head": parsed.get("head", ""),
                        "timestamp": ts,
                        "threshold": _get_threshold(error_text),
                    })
                    sn_count += 1

                total_today += sn_count

            except Exception as e:
                print(f"[debug] Error reading {sn}: {e}")
                continue

    except Exception as e:
        db_faults = [{"error": f"DB error: {e}"}]

    db_faults.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    return {
        "today": today,
        # in-memory counters
        "counters": {
            "total_tracked": len(counter_result),
            "reached_threshold": [r for r in counter_result if r["reached"]],
            "pending": [r for r in counter_result if not r["reached"]],
        },
        # faults from DB
        "db_today": {
            "total": total_today,
            "faults": db_faults,
        },
    }

@router.get("/debug/watcher-status")
async def watcher_status():
    import main
    task = main.email_watcher_task
    if task is None:
        return {"status": "task is None — lifespan ไม่ได้ start watcher"}
    return {
        "task_exists": True,
        "task_done": task.done(),
        "task_cancelled": task.cancelled(),
        "task_exception": str(task.exception()) if task.done() and not task.cancelled() else None,
    }