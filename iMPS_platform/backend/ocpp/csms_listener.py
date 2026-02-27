"""
ocpp/csms_listener.py — WebSocket listener รับ event จาก CSMS

รองรับ connector 1 (หัว 1) และ connector 2 (หัว 2) แยกอิสระ

Events จาก CSMS:
  StartTransaction   → emit chargingStarted  (Step 3)
  MeterValues        → emit meterUpdate      (Step 4, ทุก ~5s)
  StopTransaction    → emit chargingStopped  (Step 7)
  StatusNotification → emit connectorStatus  (broadcast)
"""
import os
import json
import asyncio
import logging
from datetime import datetime, timezone

import websockets
from bson import ObjectId

logger = logging.getLogger("csms_listener")

CSMS_WS_URL = os.getenv("CSMS_WS_URL", "ws://localhost:8080/ws")
CSMS_CP_ID = os.getenv("CSMS_CP_ID", "TACT30KW")

# ===== In-Memory Maps =====
id_tag_to_user: dict[str, str] = {}       # idTag → userId
txn_to_session: dict[int, str] = {}        # transactionId → sessionId
session_start_time: dict[str, float] = {}  # sessionId → epoch


def register_id_tag_user(id_tag: str, user_id: str):
    """เรียกตอน startCharging — จับคู่ idTag กับ userId"""
    id_tag_to_user[id_tag] = user_id


# ===== Init =====

async def init_csms_listener(sio, sessions_coll):
    """เริ่ม WebSocket listener — เรียกจาก main.py startup"""
    asyncio.create_task(_ws_loop(sio, sessions_coll))
    logger.info(f"[CSMS] Listener started → {CSMS_WS_URL}")


async def _ws_loop(sio, coll):
    attempt = 0
    while True:
        try:
            async with websockets.connect(CSMS_WS_URL) as ws:
                logger.info("✅ [CSMS] WebSocket connected")
                attempt = 0
                await ws.send(json.dumps({"action": "subscribe", "cp_id": CSMS_CP_ID}))

                async for raw in ws:
                    try:
                        await _handle(sio, coll, json.loads(raw))
                    except Exception as e:
                        logger.error(f"[CSMS] Message error: {e}")

        except Exception as e:
            attempt += 1
            delay = min(5 * attempt, 30)
            logger.warning(f"⚠️ [CSMS] Disconnected ({e}). Retry {attempt} in {delay}s")
            if attempt >= 10:
                await asyncio.sleep(60)
                attempt = 0
            else:
                await asyncio.sleep(delay)


async def _handle(sio, coll, msg: dict):
    event = msg.get("event")
    cp_id = msg.get("cp_id", "")
    data = msg.get("data", {})

    if event == "StartTransaction":
        await _on_start_txn(sio, coll, data)
    elif event == "MeterValues":
        await _on_meter(sio, coll, data)
    elif event == "StopTransaction":
        await _on_stop_txn(sio, coll, data)
    elif event == "StatusNotification":
        await _on_status(sio, coll, cp_id, data)


# ===== Step 3: StartTransaction → chargingStarted =====

async def _on_start_txn(sio, coll, data: dict):
    connector_id = data.get("connector")
    id_tag = data.get("idTag", "")
    txn_id = data.get("txnId")
    meter_start = data.get("meterStart", 0)

    logger.info(f"[CSMS] StartTransaction connector={connector_id} txnId={txn_id}")

    session = await coll.find_one({
        "idTag": id_tag,
        "state": "Preparing",
        "status": "Active",
    })
    if not session:
        logger.warning(f"[CSMS] No Preparing session for idTag={id_tag}")
        return

    session_id = str(session["_id"])

    await coll.update_one({"_id": session["_id"]}, {"$set": {
        "transactionId": txn_id,
        "meterStart": meter_start,
        "state": "Charging",
        "startTime": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }})

    txn_to_session[txn_id] = session_id
    session_start_time[session_id] = asyncio.get_event_loop().time()

    emit_data = {
        "sessionId": session_id,
        "connectorId": connector_id,
        "transactionId": txn_id,
        "state": "Charging",
    }
    user_id = id_tag_to_user.get(id_tag)
    if user_id:
        await sio.emit("chargingStarted", emit_data, room=f"user:{user_id}")
    await sio.emit("chargingStarted", emit_data, room=f"session:{session_id}")

    logger.info(f"[CSMS] ▶ Session {session_id} → Charging (connector {connector_id})")


# ===== Step 4: MeterValues → meterUpdate =====

async def _on_meter(sio, coll, data: dict):
    connector_id = data.get("connector")
    txn_id = data.get("txnId")
    values = data.get("values", {})

    session_id = txn_to_session.get(txn_id)
    if not session_id:
        return

    session = await coll.find_one({"_id": ObjectId(session_id)})
    if not session:
        return

    soc = _pf(values.get("SoC", ""), "%")
    power_kw = _pf(values.get("Power.Active.Import", ""), " kW")
    energy_kwh = _pf(values.get("Energy.Active.Import.Register", ""), " kWh")
    voltage = _pf(values.get("Voltage", ""), " V")
    current_a = _pf(values.get("Current.Import", ""), " A")

    start_t = session_start_time.get(session_id, asyncio.get_event_loop().time())
    charging_time = int(asyncio.get_event_loop().time() - start_t)
    meter_start_kwh = (session.get("meterStart") or 0) / 1000
    energy_charged = max(0, energy_kwh - meter_start_kwh) if energy_kwh > 0 else session.get("energyCharged", 0)
    price = session.get("pricePerKwh", 7.5)
    total_price = energy_charged * price
    carbon = energy_charged * 0.5

    upd = {
        "powerKw": power_kw,
        "energyCharged": round(energy_charged, 4),
        "chargingTime": charging_time,
        "totalPrice": round(total_price, 2),
        "carbonReduce": round(carbon, 4),
        "updatedAt": datetime.now(timezone.utc),
    }
    if soc > 0:
        upd["soc"] = soc
    await coll.update_one({"_id": session["_id"]}, {"$set": upd})

    await sio.emit("meterUpdate", {
        "sessionId": session_id,
        "connectorId": connector_id,
        "soc": soc if soc > 0 else session.get("soc", 0),
        "powerKw": power_kw,
        "energyCharged": round(energy_charged, 4),
        "chargingTime": charging_time,
        "totalPrice": round(total_price, 2),
        "carbonReduce": round(carbon, 4),
        "voltage": voltage,
        "currentA": current_a,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }, room=f"session:{session_id}")


# ===== Step 7: StopTransaction → chargingStopped =====

async def _on_stop_txn(sio, coll, data: dict):
    txn_id = data.get("txnId")
    meter_stop = data.get("meterStop", 0)
    reason = data.get("reason", "")

    session_id = txn_to_session.get(txn_id)
    if not session_id:
        return

    session = await coll.find_one({"_id": ObjectId(session_id)})
    if not session:
        return

    await coll.update_one({"_id": session["_id"]}, {"$set": {
        "state": "Stopped",
        "status": "Inactive",
        "meterStop": meter_stop,
        "endTime": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }})

    emit_data = {
        "sessionId": session_id,
        "connectorId": session.get("connectorId"),
        "energyCharged": session.get("energyCharged", 0),
        "chargingTime": session.get("chargingTime", 0),
        "totalPrice": session.get("totalPrice", 0),
        "carbonReduce": session.get("carbonReduce", 0),
        "reason": reason,
    }
    user_id = id_tag_to_user.get(session.get("idTag", ""))
    if user_id:
        await sio.emit("chargingStopped", emit_data, room=f"user:{user_id}")
    await sio.emit("chargingStopped", emit_data, room=f"session:{session_id}")

    txn_to_session.pop(txn_id, None)
    session_start_time.pop(session_id, None)
    id_tag_to_user.pop(session.get("idTag", ""), None)

    logger.info(f"[CSMS] ⏹ Session {session_id} → Stopped (connector {session.get('connectorId')})")


# ===== StatusNotification → connectorStatus =====

async def _on_status(sio, coll, cp_id: str, data: dict):
    connector_id = data.get("connector")
    status = data.get("status", "")
    error_code = data.get("error", "NoError")

    await sio.emit("connectorStatus", {
        "cpId": cp_id,
        "connectorId": connector_id,
        "status": status,
        "errorCode": error_code,
    })

    if status in ("Available", "Finishing"):
        orphan = await coll.find_one({
            "connectorId": connector_id,
            "state": {"$in": ["Preparing", "Charging"]},
            "status": "Active",
        })
        if orphan:
            sid = str(orphan["_id"])
            await coll.update_one({"_id": orphan["_id"]}, {"$set": {
                "state": "Stopped", "status": "Inactive",
                "endTime": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
            }})
            stop_data = {
                "sessionId": sid, "connectorId": connector_id,
                "energyCharged": orphan.get("energyCharged", 0),
                "chargingTime": orphan.get("chargingTime", 0),
                "totalPrice": orphan.get("totalPrice", 0),
                "carbonReduce": orphan.get("carbonReduce", 0),
                "reason": "ConnectorAvailable",
            }
            uid = id_tag_to_user.get(orphan.get("idTag", ""))
            if uid:
                await sio.emit("chargingStopped", stop_data, room=f"user:{uid}")
            await sio.emit("chargingStopped", stop_data, room=f"session:{sid}")
            logger.info(f"[CSMS] Fallback cleanup: session {sid}")


def _pf(val: str, suffix: str = "") -> float:
    try:
        return float(val.replace(suffix, "").strip())
    except (ValueError, AttributeError):
        return 0.0