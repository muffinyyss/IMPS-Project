"""PLC Settings routes (read/write via MQTT)"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Literal, Optional
import json, re, asyncio, logging

from config import settingDB, _ensure_utc_iso, to_json, mqtt_client, MQTT_TOPIC, BROKER_HOST, BROKER_PORT, charger_collection
from deps import UserClaims, get_current_user

router = APIRouter()

# -------------------------------------------------------------------- helpers
def get_setting_collection_for(SN: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(SN)):
        raise HTTPException(status_code=400, detail="Bad SN")
    return settingDB.get_collection(str(SN))


async def _ensure_util_index(coll):
    try:
        await coll.create_index([("timestamp", -1), ("_id", -1)])
    except Exception:
        pass


# -------------------------------------------------------------------- NEW: REST endpoint
@router.get("/setting/latest")
async def setting_latest(
    SN: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดึงข้อมูล setting ล่าสุดของ charger (REST polling)
    ใช้แทน SSE สำหรับ client ที่ต้องการ Authorization header
    """
    coll = get_setting_collection_for(SN)

    latest = await coll.find_one({}, sort=[("_id", -1)])

    if not latest:
        raise HTTPException(status_code=404, detail="No data found for this SN")

    latest["_id"] = str(latest["_id"])
    latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))

    return latest


# -------------------------------------------------------------------- SSE (เดิม — คงไว้)
@router.get("/setting/stream")
async def setting_stream(
    request: Request,
    SN: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    coll = get_setting_collection_for(SN)
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
            latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
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
                    doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                    yield f"data: {json.dumps(doc)}\n\n"
        except Exception:
            last_id = latest.get("_id") if latest else None
            while not await request.is_disconnected():
                doc = await coll.find_one({}, sort=[("timestamp", -1), ("_id", -1)])
                if doc and str(doc["_id"]) != str(last_id):
                    last_id = str(doc["_id"])
                    doc["_id"] = last_id
                    doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                    yield f"data: {json.dumps(doc)}\n\n"
                else:
                    yield ": keep-alive\n\n"
                await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)


@router.get("/setting")
async def setting_query(
    request: Request,
    SN: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    coll = get_setting_collection_for(SN)

    async def event_generator():
        last_id = None
        latest = await coll.find_one({}, sort=[("_id", -1)])
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
            doc = await coll.find_one({}, sort=[("_id", -1)])
            if doc and doc.get("_id") != last_id:
                doc["timestamp"] = doc.get("timestamp")
                last_id = doc.get("_id")
                yield f"data: {to_json(doc)}\n\n"
            else:
                yield ": keep-alive\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)


# -------------------------------------------------------------------- MQTT endpoints (เดิม — ไม่เปลี่ยน)

class PLCMaxSetting(BaseModel):
    SN: str = Field(..., min_length=1)
    dynamic_max_current1: Optional[float] = None
    dynamic_max_power1: Optional[float] = None

@router.post("/setting/PLC/MAX")
async def setting_plc_max(payload: PLCMaxSetting):
    now_iso = datetime.now().isoformat()
    try:
        incoming = payload.model_dump(exclude_unset=True)
    except Exception:
        incoming = payload.dict(exclude_unset=True)
    SN = incoming.get("SN", payload.SN)
    keys = ("dynamic_max_current1", "dynamic_max_power1")
    changes = {k: float(incoming[k]) for k in keys if k in incoming}
    if not changes:
        return {"ok": True, "message": "ไม่มีฟิลด์ที่เปลี่ยนแปลง", "timestamp": now_iso, "mqtt": {"published": False}, "data": {"SN": SN, "timestamp": now_iso}}
    msg = {"SN": SN, **changes, "timestamp": now_iso}
    payload_str = json.dumps(msg, ensure_ascii=False)
    published = False
    try:
        pub_result = mqtt_client.publish(MQTT_TOPIC, payload_str, qos=1, retain=False)
        pub_result.wait_for_publish(timeout=2.0)
        published = pub_result.is_published()
    except Exception as e:
        print(f"[MQTT] publish error: {e}")
    return {"ok": True, "message": "ส่ง MQTT แล้ว", "timestamp": now_iso, "mqtt": {"broker": f"{BROKER_HOST}:{BROKER_PORT}", "topic": MQTT_TOPIC, "published": bool(published)}, "data": msg}


class PLCCPCommand(BaseModel):
    SN: str
    cp_status1: Literal["start", "stop"]

@router.post("/setting/PLC/CP")
async def setting_plc_cp(payload: PLCCPCommand):
    now_iso = datetime.now().isoformat()
    msg = {"SN": payload.SN, "cp_status1": payload.cp_status1, "timestamp": now_iso}
    payload_str = json.dumps(msg, ensure_ascii=False)
    published = False
    try:
        pub_result = mqtt_client.publish(MQTT_TOPIC, payload_str, qos=1, retain=False)
        pub_result.wait_for_publish(timeout=2.0)
        published = pub_result.is_published()
    except Exception as e:
        print(f"[MQTT] publish error: {e}")
        published = False
    return {"ok": True, "message": "ส่ง MQTT แล้ว", "timestamp": now_iso, "mqtt": {"broker": f"{BROKER_HOST}:{BROKER_PORT}", "topic": MQTT_TOPIC, "published": bool(published)}, "data": msg}


class PLCH2MaxSetting(BaseModel):
    SN: str = Field(..., min_length=1)
    dynamic_max_current2: Optional[float] = None
    dynamic_max_power2: Optional[float] = None

@router.post("/setting/PLC/MAXH2")
async def setting_plc_maxh2(payload: PLCH2MaxSetting):
    now_iso = datetime.now().isoformat()
    try:
        incoming = payload.model_dump(exclude_unset=True)
    except Exception:
        incoming = payload.dict(exclude_unset=True)
    SN = incoming.get("SN", payload.SN)
    keys = ("dynamic_max_current2", "dynamic_max_power2")
    changes = {k: float(incoming[k]) for k in keys if k in incoming}
    if not changes:
        raise HTTPException(status_code=400, detail="At least one of dynamic_max_current2 or dynamic_max_power2 is required")
    msg = {"SN": SN, **changes, "timestamp": now_iso}
    payload_str = json.dumps(msg, ensure_ascii=False)
    published = False
    try:
        pub_result = mqtt_client.publish(MQTT_TOPIC, payload_str, qos=1, retain=False)
        pub_result.wait_for_publish(timeout=2.0)
        published = pub_result.is_published()
    except Exception as e:
        print(f"[MQTT] publish error: {e}")
    return {"ok": True, "message": "ส่งเฉพาะฟิลด์ที่เปลี่ยน", "timestamp": now_iso, "mqtt": {"broker": f"{BROKER_HOST}:{BROKER_PORT}", "topic": MQTT_TOPIC, "published": bool(published)}, "data": msg}


class PLCH2CPCommand(BaseModel):
    SN: str
    cp_status2: Literal["start", "stop"]

@router.post("/setting/PLC/CPH2")
async def setting_plc_cph2(payload: PLCH2CPCommand):
    now_iso = datetime.now().isoformat()
    msg = {"SN": payload.SN, "cp_status2": payload.cp_status2, "timestamp": now_iso}
    payload_str = json.dumps(msg, ensure_ascii=False)
    published = False
    try:
        pub_result = mqtt_client.publish(MQTT_TOPIC, payload_str, qos=1, retain=False)
        pub_result.wait_for_publish(timeout=2.0)
        published = pub_result.is_published()
    except Exception as e:
        print(f"[MQTT] publish error: {e}")
        published = False
    return {"ok": True, "message": "ส่ง MQTT แล้ว", "timestamp": now_iso, "mqtt": {"broker": f"{BROKER_HOST}:{BROKER_PORT}", "topic": MQTT_TOPIC, "published": bool(published)}, "data": msg}


class ChargerSettingBody(BaseModel):
    SN: str
    chargeBoxID: Optional[str] = None
    ocppUrl: Optional[str] = None

@router.patch("/charger/setting")
def update_charger_setting(
    body: ChargerSettingBody,
    current: UserClaims = Depends(get_current_user),
):
    """อัปเดต Charger Setting + ส่ง MQTT"""
    now_iso = datetime.now(timezone.utc).isoformat()

    updates = {}
    if body.chargeBoxID is not None:
        updates["chargeBoxID"] = body.chargeBoxID
    if body.ocppUrl is not None:
        updates["ocppUrl"] = body.ocppUrl

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = charger_collection.update_one({"SN": body.SN}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Charger not found")

    mqtt_published = False
    if body.ocppUrl is not None:
        if not mqtt_client.is_connected():
            try:
                mqtt_client.reconnect()
                import time
                for _ in range(10):
                    if mqtt_client.is_connected():
                        break
                    time.sleep(0.5)
            except Exception as e:
                print(f"[MQTT] Reconnect failed: {e}")

        msg = {"SN": body.SN, "chargeBoxID": body.chargeBoxID, "ocppUrl": body.ocppUrl, "action": "ocpp_update", "timestamp": now_iso}
        try:
            pub_result = mqtt_client.publish(MQTT_TOPIC, json.dumps(msg, ensure_ascii=False), qos=1, retain=False)
            pub_result.wait_for_publish(timeout=5.0)
            mqtt_published = pub_result.is_published()
        except Exception as e:
            print(f"[MQTT] Error: {e}")

    return {
        "ok": True,
        "message": "Charger setting updated",
        "modified": result.modified_count,
        "timestamp": now_iso,
        "debug": {
            "mongodb_matched": result.matched_count,
            "mongodb_modified": result.modified_count,
            "mqtt_connected": mqtt_client.is_connected(),
            "mqtt_published": mqtt_published,
            "mqtt_topic": MQTT_TOPIC,
        },
    }