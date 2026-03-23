"""Device utilization routes (by SN)"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
import json, re, asyncio

from config import deviceDB, _ensure_utc_iso
from deps import UserClaims, get_current_user

router = APIRouter()

# ----------------------------------------------------------------------- helpers
def get_device_collection_for(station_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    return deviceDB.get_collection(str(station_id))


async def _ensure_util_index(coll):
    try:
        await coll.create_index([("timestamp", -1), ("_id", -1)])
    except Exception:
        pass


# ----------------------------------------------------------------------- NEW: REST endpoint
@router.get("/utilization/latest")
async def utilization_latest(
    sn: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดึงข้อมูล utilization ล่าสุดของสถานี (REST polling)
    ใช้แทน SSE สำหรับ client ที่ต้องการ Authorization header
    """
    coll = get_device_collection_for(sn)

    latest = await coll.find_one({}, sort=[("timestamp", -1), ("_id", -1)])

    if not latest:
        raise HTTPException(status_code=404, detail="No data found for this station")

    # แปลง ObjectId → string
    latest["_id"] = str(latest["_id"])

    # normalize timestamp_utc
    latest["timestamp_utc"] = _ensure_utc_iso(latest.get("timestamp_utc"))

    # เพิ่ม field "timestamp" ที่ frontend ใช้ display (ถ้ายังไม่มี)
    if "timestamp" not in latest and latest.get("timestamp_utc"):
        latest["timestamp"] = latest["timestamp_utc"]

    return latest


# ----------------------------------------------------------------------- SSE (เดิม — คงไว้)
@router.get("/utilization/stream")
async def utilization_stream(
    request: Request,
    sn: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    coll = get_device_collection_for(sn)
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    async def event_generator():
        latest = await coll.find_one({}, sort=[("timestamp", -1), ("_id", -1)])
        if latest:
            latest["_id"] = str(latest["_id"])
            latest["timestamp_utc"] = _ensure_utc_iso(latest.get("timestamp_utc"))
            yield f"event: init\ndata: {json.dumps(latest)}\n\n"

        try:
            async with coll.watch(full_document="updateLookup") as stream:
                async for change in stream:
                    if await request.is_disconnected():
                        break
                    doc = change.get("fullDocument")
                    if not doc:
                        continue
                    doc["_id"] = str(doc["_id"])
                    doc["timestamp_utc"] = _ensure_utc_iso(doc.get("timestamp_utc"))
                    yield f"data: {json.dumps(doc)}\n\n"
        except Exception:
            last_id = latest.get("_id") if latest else None
            while not await request.is_disconnected():
                doc = await coll.find_one({}, sort=[("timestamp_utc", -1), ("_id", -1)])
                if doc and str(doc["_id"]) != str(last_id):
                    last_id = str(doc["_id"])
                    doc["_id"] = last_id
                    doc["timestamp_utc"] = _ensure_utc_iso(doc.get("timestamp_utc"))
                    yield f"data: {json.dumps(doc)}\n\n"
                else:
                    yield ": keep-alive\n\n"
                await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)


# ----------------------------------------------------------------------- device keys
@router.get("/station/{sn}/device-keys")
async def get_station_device_keys(
    sn: str,
    current: UserClaims = Depends(get_current_user),
):
    coll = get_device_collection_for(sn)
    latest = await coll.find_one({}, sort=[("timestamp", -1), ("_id", -1)])

    if not latest:
        return {"keys": []}

    fields_to_exclude = {"_id", "timestamp", "timestamp_utc"}
    keys = sorted(k for k in latest.keys() if k not in fields_to_exclude)
    return {"keys": keys}