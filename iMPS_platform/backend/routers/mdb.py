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
    floor_bin, MDB_DB, errorDB, th_tz,
    stations_coll_async, users_coll_async, email_log_coll,
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SENDER_EMAIL,
)
from deps import UserClaims, get_current_user

router = APIRouter()

async def mdb_query(request: Request, station_id: str = Query(...), current: UserClaims = Depends(get_current_user)):
    """
    SSE แบบ query param:
    - ส่ง snapshot ล่าสุดทันที (event: init)
    - จากนั้น polling ของใหม่เป็นช่วง ๆ
    """
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    coll = get_mdb_collection_for(station_id)

    async def event_generator():
        last_id = None
        latest = await coll.find_one({}, sort=[("_id", -1)])  # ⬅️ ไม่ต้อง filter station_id ภายในแล้ว
        if latest:
            latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
            last_id = latest.get("_id")
            yield "retry: 3000\n"
            yield "event: init\n"
            yield f"data: {to_json(latest)}\n\n"
        else:
            yield "retry: 3000\n\n"

        while True:
            if await request.is_disconnected():
                break

            doc = await coll.find_one({}, sort=[("_id", -1)])
            if doc and doc.get("_id") != last_id:
                doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                last_id = doc.get("_id")
                yield f"data: {to_json(doc)}\n\n"
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)

def _coerce_date_range(start: str, end: str) -> tuple[str, str]:
    def _norm(s: str, is_end: bool=False) -> str:
        if "T" not in s:  # วันล้วน
            hhmmss = "23:59:59.999" if is_end else "00:00:00.000"
            dt = datetime.fromisoformat(f"{s}T{hhmmss}+07:00")
            iso_th = dt.astimezone(th_tz).isoformat()

            test = dt.astimezone(timezone.utc).isoformat()
            return iso_th
            
        # มี T แล้ว แต่ไม่มี timezone → ถือเป็นเวลาไทย
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
        # วันที่ล้วน → บังคับขอบวันไทย
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", datestr):
            if bound == "start":
                dt_th = datetime.fromisoformat(f"{datestr}T00:00:00").replace(tzinfo=tz_th)
                return dt_th.astimezone(timezone.utc)
            else:
                # ถ้า end เป็น "วันนี้" → ใช้เวลาปัจจุบันของไทย (กันกราฟลากไปอนาคต)
                if datestr == now_th.strftime("%Y-%m-%d"):
                    return now_th.astimezone(timezone.utc)
                # มิฉะนั้น ปลายวันไทย
                dt_th = datetime.fromisoformat(f"{datestr}T23:59:59.999").replace(tzinfo=tz_th)
                return dt_th.astimezone(timezone.utc)

        # มีโซนเวลาอยู่แล้ว (Z หรือ ±HH:MM) → ใช้ตามนั้น
        if re.search(r"(Z|[+\-]\d{2}:\d{2})$", datestr):
            return datetime.fromisoformat(datestr.replace("Z", "+00:00")).astimezone(timezone.utc)

        # เป็น datetime ไม่มีโซน → ตีความเป็นไทย แล้วแปลงเป็น UTC
        return datetime.fromisoformat(datestr).replace(tzinfo=tz_th).astimezone(timezone.utc)

    def ensure_dt_with_current_time_th(datestr: str) -> datetime:
        """
        - 'YYYY-MM-DD'                  -> เติมเวลาเป็นเวลาปัจจุบันของไทย แล้วตีความเป็นเวลาไทย (+07:00)
        - 'YYYY-MM-DDTHH[:MM[:SS]]'    -> ถ้าไม่มีโซนเวลา ให้ตีความเป็นเวลาไทย (+07:00)
        - ลงท้ายด้วย 'Z' หรือมี '+/-HH:MM' -> ใช้โซนที่มากับสตริง
        แล้วคืนค่าเป็น UTC datetime
        """
        # เติมเวลาไทยปัจจุบัน หากเป็นวันที่ล้วน
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", datestr):
            datestr = f"{datestr}T{now_th.strftime('%H:%M:%S')}"

        # มีโซนเวลาแล้ว (Z หรือ +/-HH:MM)
        if re.search(r"(Z|[+\-]\d{2}:\d{2})$", datestr):
            # รองรับ 'Z' ให้เป็น +00:00
            dt = datetime.fromisoformat(datestr.replace("Z", "+00:00"))
            return dt.astimezone(timezone.utc)

        # ไม่มีโซนเวลา -> ตีความว่าเป็น "เวลาไทย" (+07:00) แล้วค่อยแปลงเป็น UTC
        naive = datetime.fromisoformat(datestr)        # ไม่ผูกโซนก่อน
        dt_th = naive.replace(tzinfo=tz_th)            # ← ตรงนี้คือการ “ผูก +07:00”
        return dt_th.astimezone(timezone.utc)          # ← แปลงเป็น UTC (ผล = ลบ 7 ชม.)

    def _ensure_iso_with_tz(val: Any, tz: ZoneInfo) -> str | None:
        """
        รับค่า datetime (หรือสตริง) แล้วคืนค่า ISO8601 ที่มีโซนเวลาเป้าหมาย (เช่น +07:00)
        """
        if val is None:
            return None
        if isinstance(val, str):
            try:
                # parse ทั้งกรณีมี Z/offset หรือไม่มีโซน
                dt = datetime.fromisoformat(val.replace("Z", "+00:00")) if re.search(r"(Z|[+\-]\d{2}:\d{2})$", val) \
                    else datetime.fromisoformat(val).replace(tzinfo=timezone.utc)
            except Exception:
                return val  # ถ้า parse ไม่ได้ ก็ส่งกลับเดิม (กันพัง)
        elif isinstance(val, datetime):
            dt = val if val.tzinfo else val.replace(tzinfo=timezone.utc)
        else:
            return None
        return dt.astimezone(tz).isoformat(timespec="milliseconds")
        
    UNIT_MAP = {"s": "second", "m": "minute", "h": "hour"}

    def parse_every(s: str) -> tuple[str, int]:
        """
        แปลงสตริงเช่น '5m', '15m', '1h' → (unit, binSize)
        ดีฟอลต์ = ('minute', 5)
        """
        m = re.fullmatch(r"(\d+)([smh])$", s.strip())
        if not m:
            return ("minute", 5)
        n, u = int(m.group(1)), m.group(2)
        return (UNIT_MAP[u], max(1, n))
    start_utc = coerce_day_bound_th(start, "start", now_th)
    end_utc   = coerce_day_bound_th(end,   "end",   now_th)

    coll = get_mdb_collection_for(station_id)

    # ไม่ใช้ $regexReplace/$replaceOne — แยก case ด้วย $regexMatch + $toDate/$dateFromString
    def _parse_string(varname: str):
        # ถ้ามีโซนเวลา (Z หรือ ±HH:MM) → ให้ Mongo แปลงเองด้วย $toDate
        # ถ้าไม่มีโซนเวลา → ตีความเป็นเวลาไทยด้วย $dateFromString timezone "+07:00"
        return {
            "$cond": [
                { "$regexMatch": { "input": f"$${varname}", "regex": r"(Z|[+\-]\d{2}:\d{2})$" } },
                { "$toDate": f"$${varname}" },
                { "$dateFromString": {
                    "dateString": f"$${varname}",
                    "timezone": "+07:00",
                    "onError": None,
                    "onNull": None
                } }
            ]
        }

    # แปลงค่า sampling interval
    unit, bin_size = parse_every(every)

    # ---------- prefix เดิม: ts/dayTH + match 2 ชั้น ----------
    prefix = [
        {   # ✅ ts: แปลง timestamp/Datetime ให้เป็น Date
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
        { "$match": { "dayTH": { "$gte": start, "$lte": end } }},  # ชั้นที่ 1: วันไทย
        { "$match": { "$expr": { "$and": [
            { "$gte": ["$ts", start_utc] },  # ชั้นที่ 2: ts อยู่ในช่วง
            { "$lte": ["$ts", end_utc] }
        ]}}}
    ]

    # ---------- downsample ด้วย $dateTrunc ----------
    group_stage = {
        "$group": {
            "_id": {
                "bucket": {
                    "$dateTrunc": {
                        "date": "$ts",
                        "unit": unit,         # second / minute / hour
                        "binSize": bin_size,  # เช่น 5
                        "timezone": "+07:00"  # อิงเวลาไทย
                    }
                }
            },
            # ค่าเฉลี่ยเพื่อให้กราฟสมูท (กันกรณีค่ามาเป็น string ด้วย $convert)
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
            "timestamp": "$_id.bucket",  # หรือ "$_id.bucket" ถ้าใช้ dateTrunc
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

                # ✅ อย่าแตะ _id ถ้าไม่ได้ใช้งาน (หลีกเลี่ยง KeyError)
                # ถ้าจำเป็นจริง ๆ ค่อยทำแบบปลอดภัย:
                # ✅ ให้แน่ใจว่า timestamp เป็น ISO string (รองรับทั้ง Date/str)
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
    coll = get_mdb_collection_for(station_id)
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
    

@router.get("/MDB/{station_id}")
async def mdb(request: Request, station_id: str, current: UserClaims = Depends(get_current_user)):
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    coll = get_mdb_collection_for(station_id)

    async def event_generator():
        # ส่งข้อมูลล่าสุดก่อน
        latest = await coll.find_one({}, sort=[("_id", -1)])
        if latest:
            latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
            yield f"event: init\ndata: {to_json(latest)}\n\n"
        else:
            yield ": keep-alive\n\n"

        # เปิด Change Stream เพื่อรับข้อมูลแบบ real-time
        pipeline = [
            {"$match": {"operationType": "insert"}}  # ฟังเฉพาะ insert
        ]
        
        try:
            async with coll.watch(pipeline) as stream:
                async for change in stream:
                    if await request.is_disconnected():
                        break
                    
                    doc = change["fullDocument"]
                    doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                    yield f"data: {to_json(doc)}\n\n"
                    
        except Exception as e:
            print(f"Change stream error: {e}")
            # Fallback เป็น polling ถ้า Change Stream ไม่ทำงาน
            last_id = latest.get("_id") if latest else None
            while True:
                if await request.is_disconnected():
                    break
                    
                doc = await coll.find_one({}, sort=[("_id", -1)])
                if doc and doc.get("_id") != last_id:
                    doc["timestamp"] = doc.get("timestamp")
                    last_id = doc.get("_id")
                    yield f"data: {to_json(doc)}\n\n"
                else:
                    yield ": keep-alive\n\n"
                    
                await asyncio.sleep(1)

    return StreamingResponse(event_generator(), headers=headers)

@router.get("/MDB/{station_id}/peak-power")
async def mdb_peak_power(station_id: str, current_user: UserClaims = Depends(get_current_user)):
    """
    ดึงค่า PL1N, PL2N, PL3N, PL123N ที่สูงที่สุด (peak) จากข้อมูล database ทั้งหมด
    ข้อมูลเข้า database เรื่อย ๆ ดังนั้นจะหาค่าสูงสุดตั้งแต่เริ่มต้น
    กรองเฉพาะข้อมูลที่ไม่เกิน 150000
    """
    coll = get_mdb_collection_for(station_id)
    
    # Pipeline aggregation หาค่า max จากข้อมูลทั้งหมด
    pipeline = [
        {
            "$match": {
                "$and": [
                    {
                        "$expr": {
                            "$lte": [
                                {
                                    "$convert": {
                                        "input": "$PL1N",
                                        "to": "double",
                                        "onError": None,
                                        "onNull": 150001
                                    }
                                },
                                150000
                            ]
                        }
                    },
                    {
                        "$expr": {
                            "$lte": [
                                {
                                    "$convert": {
                                        "input": "$PL2N",
                                        "to": "double",
                                        "onError": None,
                                        "onNull": 150001
                                    }
                                },
                                150000
                            ]
                        }
                    },
                    {
                        "$expr": {
                            "$lte": [
                                {
                                    "$convert": {
                                        "input": "$PL3N",
                                        "to": "double",
                                        "onError": None,
                                        "onNull": 150001
                                    }
                                },
                                150000
                            ]
                        }
                    },
                    {
                        "$expr": {
                            "$lte": [
                                {
                                    "$convert": {
                                        "input": "$PL123N",
                                        "to": "double",
                                        "onError": None,
                                        "onNull": 150001
                                    }
                                },
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
                "PL1N_peak": {
                    "$max": {
                        "$convert": {
                            "input": "$PL1N",
                            "to": "double",
                            "onError": None,
                            "onNull": None
                        }
                    }
                },
                "PL2N_peak": {
                    "$max": {
                        "$convert": {
                            "input": "$PL2N",
                            "to": "double",
                            "onError": None,
                            "onNull": None
                        }
                    }
                },
                "PL3N_peak": {
                    "$max": {
                        "$convert": {
                            "input": "$PL3N",
                            "to": "double",
                            "onError": None,
                            "onNull": None
                        }
                    }
                },
                "PL123N_peak": {
                    "$max": {
                        "$convert": {
                            "input": "$PL123N",
                            "to": "double",
                            "onError": None,
                            "onNull": None
                        }
                    }
                },
            }
        },
        {
            "$project": {
                "_id": 0,
                "PL1N_peak": {"$round": ["$PL1N_peak", 2]},
                "PL2N_peak": {"$round": ["$PL2N_peak", 2]},
                "PL3N_peak": {"$round": ["$PL3N_peak", 2]},
                "PL123N_peak": {"$round": ["$PL123N_peak", 2]},
            }
        }
    ]
    
    result = await coll.aggregate(pipeline).to_list(length=1)
    
    if result:
        return result[0]
    else:
        return {"PL1N_peak": None, "PL2N_peak": None, "PL3N_peak": None, "PL123N_peak": None}
    

# ─── Error Code & Email Notification ─────────────────────────
# ------------------------------------------------------------------------------------------
#  erorr code old
# -----------------------------------------------------------------------------------------

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
    queries.append({"_id": user_id})  # เผื่อกรณีเก็บเป็น string

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
    """
    ส่งเมลแจ้ง error แค่ครั้งเดียวต่อเอกสาร error (_id)
    - ใช้ collection iMPS.errorEmailLog เก็บ _id เป็น unique key
    - ถ้าส่งสำเร็จอัปเดตสถานะเป็น sent
    - ถ้าส่งล้มเหลว ลบล็อกออกเพื่อให้พยายามใหม่ครั้งหน้า
    """
    if not to_email or not error_text:
        return False

    key = str(doc_id)  # รองรับ ObjectId/str
    now_th = datetime.now(th_tz)

    # ขั้นที่ 1: กันซ้ำด้วยการ insert ล็อก (pending) ถ้ามีอยู่แล้ว -> ไม่ต้องส่ง
    try:
        await email_log_coll.insert_one({
            "_id": key,                    # ทำให้ unique key เป็น doc_id ของ error
            "status": "pending",
            "to": to_email,
            "chargeBoxID": chargebox_id,
            "createdAt": now_th,
        })
    except DuplicateKeyError:
        return False  # เคยส่งหรือกำลังส่งอยู่แล้ว

    # ขั้นที่ 2: สร้าง subject/body แล้วส่งอีเมล
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
        # ถ้าส่งล้มเหลว ลบล็อก pending ออก เพื่อให้ลองส่งใหม่ได้ในรอบถัดไป
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

        # ----- init -----
        latest = await coll.find_one({}, sort=[("_id", -1)])
        if latest and ("error" in latest):
            last_id = latest.get("_id")

            chargebox_id = latest.get("Chargebox_ID")
            user_id = await _resolve_user_id_by_chargebox(chargebox_id)
            email = await _resolve_user_email_by_user_id(user_id)

            try:
                await send_error_email_once(email, chargebox_id, latest.get("error"), last_id)
            except Exception as e:
                # ไม่ให้ตกสตรีม: log แล้วไปต่อ
                print(f"[email] init send failed for {last_id}: {e}")

            payload = {
                "Chargebox_ID": chargebox_id,
                "user_id": user_id,
                "email": email,
                "error": latest.get("error"),
            }
        else:
            yield ": keep-alive\n\n"

        # ----- updates -----
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
