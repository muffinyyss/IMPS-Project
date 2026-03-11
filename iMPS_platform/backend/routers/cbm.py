"""CBM (Condition-Based Monitoring) SSE stream"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import StreamingResponse
import json, re, asyncio
from typing import Optional

from config import CBM_DB, charger_coll_async, to_json
from deps import UserClaims, get_current_user

router = APIRouter()


def get_cbm_collection_for(SN: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(SN)):
        raise HTTPException(status_code=400, detail="Bad SN")
    return CBM_DB.get_collection(str(SN))


@router.get("/CBM")
async def cbm_query(
    request: Request,
    SN: str = Query(...),
    fields: Optional[str] = Query(None),
    current: UserClaims = Depends(get_current_user),
):
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    coll = get_cbm_collection_for(SN)

    async def find_charger_meta(SN: str):
        doc = await charger_coll_async.find_one(
            {"SN": SN},
            projection={"_id": 0, "pipeline_config.hardware": 1},  # ✅ path ที่ถูกต้อง
        )
        return doc

    charger_meta = await find_charger_meta(SN)

    def extract_hardware(meta: dict | None) -> dict:
        if not meta:
            return {}
        # ✅ hardware อยู่ใน pipeline_config.hardware
        hw = (meta.get("pipeline_config") or {}).get("hardware") or {}
        return {
            "powerModuleCount": hw.get("powerModuleCount"),
            "dcContractorCount": hw.get("dcContractorCount"),
            "dcFanCount": hw.get("dcFanCount"),
            "fanType": hw.get("fanType"),
            "energyMeterType": hw.get("energyMeterType"),
        }

    hardware_info = extract_hardware(charger_meta)
    print(f"[CBM] hardware_info = {hardware_info}")

    # ─── Build MongoDB projection ────────────────────────────────────────
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
            doc = await coll.find_one({}, sort=[("_id", -1)], projection=projection)
        else:
            doc = await coll.find_one({}, sort=[("_id", -1)])

        if not doc:
            return None

        # ✅ Inject hardware เข้าไปใน SSE document ทุกครั้ง
        if hardware_info:
            doc["hardware"] = hardware_info

        return doc

    async def event_generator():
        last_id = None
        latest = await find_latest()
        if latest:
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
                last_id = doc.get("_id")
                yield f"data: {to_json(doc)}\n\n"
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)