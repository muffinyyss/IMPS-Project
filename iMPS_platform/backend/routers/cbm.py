"""CBM (Condition-Based Monitoring) SSE stream"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import StreamingResponse
import json, re, asyncio
from typing import Optional

from config import CBM_DB, to_json
from deps import UserClaims, get_current_user

router = APIRouter()


# --------------------------------------------------------------------- CBM Page
def get_cbm_collection_for(SN: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(SN)):
        raise HTTPException(status_code=400, detail="Bad SN")
    return CBM_DB.get_collection(str(SN))


@router.get("/CBM")
async def cbm_query(
    request: Request,
    SN: str = Query(...),
    fields: Optional[str] = Query(
        None,
        description="Comma-separated field names, e.g. 'voltage,current,temp'. "
                    "ถ้าไม่ส่ง → return ทุก field",
    ),
    current: UserClaims = Depends(get_current_user),
):
    """
    SSE แบบ query param:
    - ส่ง snapshot ล่าสุดทันที (event: init)
    - จากนั้น polling ของใหม่เป็นช่วง ๆ

    fields param:
    - ไม่ส่ง → return ทุก field (ใช้ตอนเปิด modal เลือก field)
    - ส่ง    → return เฉพาะ field ที่ระบุ + timestamp
    """
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    coll = get_cbm_collection_for(SN)

    # ─── Build MongoDB projection ───
    projection = None
    if fields:
        field_list = [f.strip() for f in fields.split(",") if f.strip()]
        if field_list:
            projection = {"_id": 1, "timestamp": 1}
            for f in field_list:
                if re.fullmatch(r"[A-Za-z0-9_]+", f):
                    projection[f] = 1

    async def find_latest():
        if projection:
            return await coll.find_one(
                {}, sort=[("_id", -1)], projection=projection
            )
        return await coll.find_one({}, sort=[("_id", -1)])

    async def event_generator():
        last_id = None
        latest = await find_latest()
        if latest:
            latest["timestamp"] = latest.get("timestamp")
            last_id = latest.get("_id")
            yield "retry: 3000\n"
            yield "event: init\n"
            yield f"data: {to_json(latest)}\n\n"
        else:
            yield "retry: 3000\n\n"

        while True:
            if await request.is_disconnected():
                break

            doc = await find_latest()
            if doc and doc.get("_id") != last_id:
                doc["timestamp"] = doc.get("timestamp")
                last_id = doc.get("_id")
                yield f"data: {to_json(doc)}\n\n"
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)