"""MDB (Main Distribution Board) data: SSE stream, history, peak-power, error codes"""
from typing_extensions import Literal
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import StreamingResponse, Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone, time, date
from bson.objectid import ObjectId
from bson.decimal128 import Decimal128
from pymongo.errors import DuplicateKeyError
from dateutil import parser as dtparser
from email.message import EmailMessage
from typing import List, Dict, Any, Optional
from zoneinfo import ZoneInfo
import json, re, asyncio
import aiosmtplib

from config import (
    get_mdb_collection_for, to_json, _ensure_utc_iso, _to_utc_dt, to_float,
    floor_bin, MDB_realtime_DB, MDB_history_DB, errorDB, th_tz,
    stations_coll_async, users_coll_async, email_log_coll,
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SENDER_EMAIL,
)
from deps import UserClaims, get_current_user

router = APIRouter()

# =====================================================================
#  SSE real-time (query-param style)
# =====================================================================
async def mdb_query(request: Request, station_id: str = Query(...), current: UserClaims = Depends(get_current_user)):
    """
    SSE via query param:
    - sends latest snapshot immediately (event: init)
    - then polls for new data
    """
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    coll = MDB_realtime_DB[station_id]

    async def event_generator():
        last_ts = None                                          # <<< FIX: was last_id
        latest = await coll.find_one({"_id": "latest"})
        if latest:
            latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
            last_ts = latest.get("timestamp")                   # <<< FIX: track timestamp
            yield "retry: 3000\n"
            yield "event: init\n"
            yield f"data: {to_json(latest)}\n\n"
        else:
            yield "retry: 3000\n\n"

        while True:
            if await request.is_disconnected():
                break

            doc = await coll.find_one({"_id": "latest"})        # <<< FIX: query "latest" explicitly
            if doc:
                doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                ts = doc.get("timestamp")                       # <<< FIX: define ts
                if ts and ts != last_ts:                        # <<< FIX: compare timestamps
                    last_ts = ts
                    yield f"data: {to_json(doc)}\n\n"
                else:
                    yield ": keep-alive\n\n"
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(3)

    return StreamingResponse(event_generator(), headers=headers)

# =====================================================================
#  Date-range helpers
# =====================================================================
def _coerce_date_range(start: str, end: str) -> tuple[str, str]:
    def _norm(s: str, is_end: bool=False) -> str:
        if "T" not in s:  # date only
            hhmmss = "23:59:59.999" if is_end else "00:00:00.000"
            dt = datetime.fromisoformat(f"{s}T{hhmmss}+07:00")
            iso_th = dt.astimezone(th_tz).isoformat()

            test = dt.astimezone(timezone.utc).isoformat()
            return iso_th
            
        has_tz = bool(re.search(r'(Z|[+\-]\d{2}:\d{2})$', s))
        if not has_tz:
            dt = datetime.fromisoformat(s + "+07:00")
        else:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    try:
        return _norm(start, False), _norm(end, True)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad date range")

# =====================================================================
#  History (SSE stream with aggregation)
# =====================================================================
@router.get("/MDB/history")
async def stream_history(
    request: Request,
    station_id: str = Query(...),
    start: str = Query(...),  
    end: str = Query(...),    
    every: str = Query("5m"), 
    current: UserClaims = Depends(get_current_user),
):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", start) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", end):
        raise HTTPException(status_code=400, detail="start/end must be YYYY-MM-DD")
    if start > end:
        start, end = end, start

    tz_th = ZoneInfo("Asia/Bangkok")
    now_th = datetime.now(tz_th)

    def coerce_day_bound_th(datestr: str, bound: Literal["start", "end"], now_th: datetime) -> datetime:
        tz_th = ZoneInfo("Asia/Bangkok")
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", datestr):
            if bound == "start":
                dt_th = datetime.fromisoformat(f"{datestr}T00:00:00").replace(tzinfo=tz_th)
                return dt_th.astimezone(timezone.utc)
            else:
                if datestr == now_th.strftime("%Y-%m-%d"):
                    return now_th.astimezone(timezone.utc)
                dt_th = datetime.fromisoformat(f"{datestr}T23:59:59.999").replace(tzinfo=tz_th)
                return dt_th.astimezone(timezone.utc)

        if re.search(r"(Z|[+\-]\d{2}:\d{2})$", datestr):
            return datetime.fromisoformat(datestr.replace("Z", "+00:00")).astimezone(timezone.utc)

        return datetime.fromisoformat(datestr).replace(tzinfo=tz_th).astimezone(timezone.utc)

    def _ensure_iso_with_tz(val: Any, tz: ZoneInfo) -> str | None:
        if val is None:
            return None
        if isinstance(val, str):
            try:
                dt = datetime.fromisoformat(val.replace("Z", "+00:00")) if re.search(r"(Z|[+\-]\d{2}:\d{2})$", val) \
                    else datetime.fromisoformat(val).replace(tzinfo=timezone.utc)
            except Exception:
                return val
        elif isinstance(val, datetime):
            dt = val if val.tzinfo else val.replace(tzinfo=timezone.utc)
        else:
            return None
        return dt.astimezone(tz).isoformat(timespec="milliseconds")
        
    UNIT_MAP = {"s": "second", "m": "minute", "h": "hour"}

    def parse_every(s: str) -> tuple[str, int]:
        m = re.fullmatch(r"(\d+)([smh])$", s.strip())
        if not m:
            return ("minute", 5)
        n, u = int(m.group(1)), m.group(2)
        return (UNIT_MAP[u], max(1, n))

    start_utc = coerce_day_bound_th(start, "start", now_th)
    end_utc   = coerce_day_bound_th(end,   "end",   now_th)

    coll = MDB_history_DB[station_id] 

    unit, bin_size = parse_every(every)

    prefix = [
        {
            "$addFields": {
                "ts": {
                    "$let": { "vars": { "t": "$timestamp", "d": "$Datetime" }, "in":
                        { "$cond": [
                            { "$ne": ["$$t", None] },
                            { "$switch": {
                                "branches": [
                                    { "case": { "$eq": [ { "$type": "$$t" }, "date"   ] }, "then": "$$t" },
                                    { "case": { "$eq": [ { "$type": "$$t" }, "string" ] }, "then": {
                                        "$cond": [
                                            { "$regexMatch": { "input": "$$t", "regex": r"(Z|[+\-]\d{2}:\d{2})$" } },
                                            { "$toDate": "$$t" },
                                            { "$dateFromString": { "dateString": "$$t", "timezone": "+07:00", "onError": None, "onNull": None } }
                                        ]
                                    }},
                                ],
                                "default": None
                            }},
                            { "$switch": {
                                "branches": [
                                    { "case": { "$eq": [ { "$type": "$$d" }, "date"   ] }, "then": "$$d" },
                                    { "case": { "$eq": [ { "$type": "$$d" }, "string" ] }, "then": {
                                        "$cond": [
                                            { "$regexMatch": { "input": "$$d", "regex": r"(Z|[+\-]\d{2}:\d{2})$" } },
                                            { "$toDate": "$$d" },
                                            { "$dateFromString": { "dateString": "$$d", "timezone": "+07:00", "onError": None, "onNull": None } }
                                        ]
                                    }},
                                ],
                                "default": None
                            }}
                        ] }
                    }
                }
            }
        },
        { "$addFields": { "dayTH": { "$dateToString": { "date": "$ts", "format": "%Y-%m-%d", "timezone": "+07:00" }}}},
        { "$match": { "dayTH": { "$gte": start, "$lte": end } }},
        { "$match": { "$expr": { "$and": [
            { "$gte": ["$ts", start_utc] },
            { "$lte": ["$ts", end_utc] }
        ]}}}
    ]

    group_stage = {
        "$group": {
            "_id": {
                "bucket": {
                    "$dateTrunc": {
                        "date": "$ts",
                        "unit": unit,
                        "binSize": bin_size,
                        "timezone": "+07:00"
                    }
                }
            },
            "VL1N": {"$avg": {"$convert": {"input": "$VL1N", "to": "double", "onError": None, "onNull": None}}},
            "VL2N": {"$avg": {"$convert": {"input": "$VL2N", "to": "double", "onError": None, "onNull": None}}},
            "VL3N": {"$avg": {"$convert": {"input": "$VL3N", "to": "double", "onError": None, "onNull": None}}},
            "I1":   {"$avg": {"$convert": {"input": "$I1",   "to": "double", "onError": None, "onNull": None}}},
            "I2":   {"$avg": {"$convert": {"input": "$I2",   "to": "double", "onError": None, "onNull": None}}},
            "I3":   {"$avg": {"$convert": {"input": "$I3",   "to": "double", "onError": None, "onNull": None}}},
            "PL1N": {"$avg": {"$convert": {"input": "$PL1N", "to": "double", "onError": None, "onNull": None}}},
            "PL2N": {"$avg": {"$convert": {"input": "$PL2N", "to": "double", "onError": None, "onNull": None}}},
            "PL3N": {"$avg": {"$convert": {"input": "$PL3N", "to": "double", "onError": None, "onNull": None}}},
        }
    }
    sort_stage = { "$sort": { "_id.bucket": 1 } }
    project_stage = {
        "$project": {
            "_id": 0,
            "timestamp": "$_id.bucket",
            "VL1N": 1, "VL2N": 1, "VL3N": 1,
            "I1": 1, "I2": 1, "I3": 1,
            "PL1N": 1, "PL2N": 1, "PL3N": 1,
        }
    }

    pipeline = prefix + [group_stage, sort_stage, project_stage]
    cursor = coll.aggregate(pipeline, allowDiskUse=True)

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    async def event_generator():
        try:
            cnt = await coll.aggregate(prefix + [group_stage, {"$count":"n"}]).to_list(length=1)
            n = cnt[0]["n"] if cnt else 0

            yield "retry: 3000\n"
            yield f"event: stats\ndata: {json.dumps({'matched': n})}\n\n"

            sent = 0
            async for doc in cursor:
                if await request.is_disconnected():
                    break

                ts_val = doc.get("timestamp")
                if ts_val is not None:
                    doc["timestamp"] = _ensure_iso_with_tz(ts_val, ZoneInfo("Asia/Bangkok"))

                yield f"data: {json.dumps(doc, ensure_ascii=False)}\n\n"
                sent += 1
                await asyncio.sleep(0.001)

            if sent == 0:
                yield "event: empty\ndata: no documents in range\n\n"
            else:
                yield ": keep-alive\n\n"
        except Exception as e:
            yield f"event: server-error\ndata: {json.dumps({'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)

@router.get("/MDB/history/debug")
async def mdb_history_debug(station_id: str, start: str, end: str):
    start_iso, end_iso = _coerce_date_range(start, end)
    start_key, end_key = start_iso.rstrip("Z"), end_iso.rstrip("Z")
    coll = MDB_history_DB[station_id]
    q = {"timestamp": {"$gte": start_key, "$lte": end_key}}
    docs = await coll.find(q, {"_id":0,"timestamp":1}).sort("timestamp", 1).limit(5).to_list(length=5)
    n = await coll.count_documents(q)
    return {"matched": n, "start_key": start_key, "end_key": end_key, "sample": docs}

def extract_token(authorization: str | None, access_token: str | None):
    if authorization and authorization.startswith("Bearer "):
        return authorization.split(" ", 1)[1]
    if access_token:
        return access_token
    raise HTTPException(status_code=401, detail="Not authenticated")

# =====================================================================
#  SSE real-time (path-param style) — MAIN ENDPOINT
# =====================================================================
@router.get("/MDB/{station_id}")
async def mdb(request: Request, station_id: str, current: UserClaims = Depends(get_current_user)):
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    coll = MDB_realtime_DB[station_id]

    async def event_generator():
        last_ts = None                                          # <<< FIX: use timestamp, not _id

        # -- init: send latest snapshot --
        latest = await coll.find_one({"_id": "latest"})
        if latest:
            latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
            last_ts = latest.get("timestamp")                   # <<< FIX
            yield f"event: init\ndata: {to_json(latest)}\n\n"
        else:
            yield ": keep-alive\n\n"

        # -- real-time via Change Stream --
        pipeline = [
            {"$match": {"operationType": {"$in": ["insert", "update", "replace"]}}}
        ]
        
        try:
            async with coll.watch(
                pipeline,
                full_document="updateLookup",                   # <<< FIX: get full doc on update
            ) as stream:
                async for change in stream:
                    if await request.is_disconnected():
                        break
                    
                    doc = change.get("fullDocument")            # <<< FIX: .get() instead of []
                    if not doc:
                        continue                                # <<< FIX: skip if None

                    doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                    ts = doc.get("timestamp")

                    # Only send when timestamp actually changed (dedup)
                    if ts and ts != last_ts:                    # <<< FIX
                        last_ts = ts
                        yield f"data: {to_json(doc)}\n\n"
                    
        except Exception as e:
            print(f"Change stream error: {e}, falling back to polling")

            # -- fallback: polling by timestamp --
            while True:
                if await request.is_disconnected():
                    break
                    
                doc = await coll.find_one({"_id": "latest"})    # <<< FIX: query "latest"
                if doc:
                    doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                    ts = doc.get("timestamp")                   # <<< FIX: define ts

                    if ts and ts != last_ts:                    # <<< FIX: compare timestamp
                        last_ts = ts
                        yield f"data: {to_json(doc)}\n\n"
                    else:
                        yield ": keep-alive\n\n"
                else:
                    yield ": keep-alive\n\n"
                    
                await asyncio.sleep(3)                          # <<< FIX: 3s matches Pi send rate

    return StreamingResponse(event_generator(), headers=headers)

# =====================================================================
#  Peak Power
# =====================================================================
@router.get("/MDB/{station_id}/peak-power")
async def mdb_peak_power(station_id: str, current_user: UserClaims = Depends(get_current_user)):
    """
    Peak PL1N, PL2N, PL3N, PL123N from all history data.
    Filters out values > 150000.
    """
    coll = MDB_history_DB[station_id]
    
    pipeline = [
        {
            "$match": {
                "$and": [
                    {
                        "$expr": {
                            "$lte": [
                                {"$convert": {"input": "$PL1N", "to": "double", "onError": None, "onNull": 150001}},
                                150000
                            ]
                        }
                    },
                    {
                        "$expr": {
                            "$lte": [
                                {"$convert": {"input": "$PL2N", "to": "double", "onError": None, "onNull": 150001}},
                                150000
                            ]
                        }
                    },
                    {
                        "$expr": {
                            "$lte": [
                                {"$convert": {"input": "$PL3N", "to": "double", "onError": None, "onNull": 150001}},
                                150000
                            ]
                        }
                    },
                    {
                        "$expr": {
                            "$lte": [
                                {"$convert": {"input": "$PL123N", "to": "double", "onError": None, "onNull": 150001}},
                                150000
                            ]
                        }
                    }
                ]
            }
        },
        {
            "$group": {
                "_id": None,
                "PL1N_peak":   {"$max": {"$convert": {"input": "$PL1N",   "to": "double", "onError": None, "onNull": None}}},
                "PL2N_peak":   {"$max": {"$convert": {"input": "$PL2N",   "to": "double", "onError": None, "onNull": None}}},
                "PL3N_peak":   {"$max": {"$convert": {"input": "$PL3N",   "to": "double", "onError": None, "onNull": None}}},
                "PL123N_peak": {"$max": {"$convert": {"input": "$PL123N", "to": "double", "onError": None, "onNull": None}}},
            }
        },
        {
            "$project": {
                "_id": 0,
                "PL1N_peak":   {"$round": ["$PL1N_peak", 2]},
                "PL2N_peak":   {"$round": ["$PL2N_peak", 2]},
                "PL3N_peak":   {"$round": ["$PL3N_peak", 2]},
                "PL123N_peak": {"$round": ["$PL123N_peak", 2]},
            }
        }
    ]
    
    result = await coll.aggregate(pipeline).to_list(length=1)
    
    if result:
        return result[0]
    else:
        return {"PL1N_peak": None, "PL2N_peak": None, "PL3N_peak": None, "PL123N_peak": None}

# =====================================================================
#  Error Code & Email Notification
# =====================================================================
async def _resolve_user_id_by_chargebox(chargebox_id: Optional[str]) -> Optional[str]:
    if not chargebox_id:
        return None
    doc = await stations_coll_async.find_one(
        {"chargeBoxID": chargebox_id},
        projection={"user_id": 1}
    )
    if not doc:
        return None
    return str(doc.get("user_id")) if doc.get("user_id") is not None else None

async def _resolve_user_email_by_user_id(user_id: Optional[str]) -> Optional[str]:
    if not user_id:
        return None

    queries = []
    if ObjectId.is_valid(user_id):
        queries.append({"_id": ObjectId(user_id)})
    queries.append({"_id": user_id})

    for q in queries:
        doc = await users_coll_async.find_one(q, projection={"email": 1})
        if doc:
            return doc.get("email")
    return None

async def _send_email_async(to_email: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = SENDER_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    await aiosmtplib.send(
        msg,
        hostname=SMTP_HOST,
        port=SMTP_PORT,
        start_tls=True,
        username=SMTP_USER,
        password=SMTP_PASS,
        timeout=30,
    )

async def send_error_email_once(to_email: str | None, chargebox_id: str | None, error_text: str | None, doc_id) -> bool:
    if not to_email or not error_text:
        return False

    key = str(doc_id)
    now_th = datetime.now(th_tz)

    try:
        await email_log_coll.insert_one({
            "_id": key,
            "status": "pending",
            "to": to_email,
            "chargeBoxID": chargebox_id,
            "createdAt": now_th,
        })
    except DuplicateKeyError:
        return False

    subject = f"[IMPS Error] {chargebox_id or '-'}"
    body = (
        f"เรียนผู้ใช้,\n\n"
        f"มี Error จากสถานี/อุปกรณ์: {chargebox_id or '-'}\n"
        f"เวลา (TH): {now_th:%Y-%m-%d %H:%M:%S}\n\n"
        f"รายละเอียด:\n{error_text}\n\n"
        f"-- ระบบ iMPS"
    )
    try:
        await _send_email_async(to_email, subject, body)
        await email_log_coll.update_one({"_id": key}, {"$set": {"status": "sent", "sentAt": datetime.now(th_tz)}})
        return True
    except Exception:
        await email_log_coll.delete_one({"_id": key})
        raise

def get_errorCode_collection_for(station_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    return errorDB.get_collection(str(station_id))

@router.get("/error/{station_id}")
async def error_stream(request: Request, station_id: str, current: UserClaims = Depends(get_current_user)):
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    coll = get_errorCode_collection_for(station_id)

    async def event_generator():
        last_id = None

        latest = await coll.find_one({}, sort=[("_id", -1)])
        if latest and ("error" in latest):
            last_id = latest.get("_id")

            chargebox_id = latest.get("Chargebox_ID")
            user_id = await _resolve_user_id_by_chargebox(chargebox_id)
            email = await _resolve_user_email_by_user_id(user_id)

            try:
                await send_error_email_once(email, chargebox_id, latest.get("error"), last_id)
            except Exception as e:
                print(f"[email] init send failed for {last_id}: {e}")

            payload = {
                "Chargebox_ID": chargebox_id,
                "user_id": user_id,
                "email": email,
                "error": latest.get("error"),
            }
        else:
            yield ": keep-alive\n\n"

        while True:
            if await request.is_disconnected():
                break

            doc = await coll.find_one({}, sort=[("_id", -1)])
            if doc and doc.get("_id") != last_id and ("error" in doc):
                last_id = doc.get("_id")

                chargebox_id = doc.get("Chargebox_ID")
                user_id = await _resolve_user_id_by_chargebox(chargebox_id)
                email = await _resolve_user_email_by_user_id(user_id)
                
                try:
                    await send_error_email_once(email, chargebox_id, doc.get("error"), last_id)
                except Exception as e:
                    print(f"[email] update send failed for {last_id}: {e}")

                payload = {
                    "Chargebox_ID": chargebox_id,
                    "user_id": user_id,
                    "email": email,
                    "error": doc.get("error"),
                }
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(60)

    return StreamingResponse(event_generator(), headers=headers)

# =====================================================================
#  Equipment CRUD
# =====================================================================
class EquipmentCreate(BaseModel):
    station_id: str
    topic: str
    broker: str

@router.post("/MDB/equipment")
async def add_equipment(
    body: EquipmentCreate,
    current: UserClaims = Depends(get_current_user),
):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", body.station_id):
        raise HTTPException(400, "Bad station_id")

    await MDB_realtime_DB[body.station_id].update_one(
        {"_id": "config"},
        {"$set": {
            "topic": body.topic,
            "broker": body.broker,
            "created_by": current.user_id,
            "created_at": datetime.now(th_tz).isoformat(),
        }},
        upsert=True,
    )
    return {"message": "created", "station_id": body.station_id}