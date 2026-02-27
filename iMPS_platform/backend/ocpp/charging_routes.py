"""
ocpp/charging_routes.py — Start/Stop ผ่าน OCPP (ไม่มี RFID)

★ ตัด RFID — กด Start → RemoteStart ตรง ๆ
★ รองรับ 2 หัวชาร์จ (connector 1, 2)
★ เฉพาะ Admin / Owner ที่กดได้

Flow:
  1. App  → POST /api/charging/start { connectorId: 1 or 2 }
  2. Backend → RemoteStart → CSMS → Edgebox → Charger
  3. CSMS → StartTransaction → Backend → Socket.IO → App
  4. CSMS → MeterValues (5s) → Backend → Socket.IO → App
  5. App  → POST /api/charging/{id}/stop
  6. Backend → RemoteStop → CSMS → Edgebox → Charger
  7. CSMS → StopTransaction → Backend → Socket.IO → App
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId

from deps import UserClaims, get_current_user
from ocpp.ocpp_bridge import generate_id_tag, remote_start, remote_stop
from ocpp.csms_listener import register_id_tag_user

router = APIRouter(prefix="/api/charging", tags=["charging"])

# MongoDB collections (set จาก main.py)
_sessions_coll = None
_stations_coll = None


def set_collections(sessions_coll, stations_coll):
    global _sessions_coll, _stations_coll
    _sessions_coll = sessions_coll
    _stations_coll = stations_coll


# ===== Role Check =====
ALLOWED_ROLES = {"Admin", "Owner", "admin", "owner"}


def _check_role(user: UserClaims):
    role = getattr(user, "role", None) or ""
    if role not in ALLOWED_ROLES:
        raise HTTPException(403, f"Role '{role}' ไม่มีสิทธิ์สั่งชาร์จ (ต้องเป็น Admin หรือ Owner)")


# ===== Models =====

class StartRequest(BaseModel):
    stationId: str
    chargerId: str
    connectorId: int  # 1 = หัว 1, 2 = หัว 2


# ===== POST /api/charging/start =====

@router.post("/start")
async def start_charging(req: StartRequest, current: UserClaims = Depends(get_current_user)):
    """
    Step 1: App กด Start
    Step 2: RemoteStart → CSMS (ไม่มี RFID)
    """
    _check_role(current)

    if not _sessions_coll:
        raise HTTPException(500, "Database not initialized")

    user_id = str(getattr(current, "id", None) or getattr(current, "sub", "unknown"))
    connector_id = req.connectorId

    # กันซ้อน
    existing = await _sessions_coll.find_one({
        "connectorId": connector_id,
        "status": "Active",
        "state": {"$in": ["Preparing", "Charging"]},
    })
    if existing:
        raise HTTPException(409, f"หัวชาร์จ {connector_id} กำลังใช้งานอยู่")

    # หาราคา
    price_per_kwh = 7.5
    if _stations_coll:
        station = await _stations_coll.find_one({"_id": ObjectId(req.stationId)})
        if station:
            for ch in station.get("chargers", []):
                if ch.get("id") == req.chargerId or ch.get("connectorId") == connector_id:
                    price_per_kwh = ch.get("pricePerKwh", 7.5)
                    break

    # idTag (OCPP ยังต้องใช้ แต่ไม่ลงทะเบียน RFID)
    id_tag = generate_id_tag(user_id)

    # สร้าง session
    now = datetime.now(timezone.utc)
    session_doc = {
        "userId": user_id,
        "stationId": req.stationId,
        "chargerId": req.chargerId,
        "connectorId": connector_id,
        "idTag": id_tag,
        "transactionId": None,
        "meterStart": None,
        "meterStop": None,
        "state": "Preparing",
        "status": "Active",
        "soc": 0,
        "powerKw": 0,
        "energyCharged": 0,
        "chargingTime": 0,
        "pricePerKwh": price_per_kwh,
        "totalPrice": 0,
        "carbonReduce": 0,
        "startTime": None,
        "endTime": None,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await _sessions_coll.insert_one(session_doc)
    session_id = str(result.inserted_id)

    register_id_tag_user(id_tag, user_id)

    # ★ RemoteStart ตรง ๆ — ไม่มี RFID
    try:
        await remote_start(connector_id, id_tag)
    except Exception as e:
        await _sessions_coll.delete_one({"_id": result.inserted_id})
        raise HTTPException(502, f"CSMS RemoteStart error: {e}")

    print(f"✅ [Charging] Start → connector={connector_id} session={session_id} user={user_id}")

    return {
        "success": True,
        "message": f"สั่งเริ่มชาร์จหัว {connector_id} แล้ว รอ charger ตอบ...",
        "data": {
            "session": {
                "_id": session_id,
                "state": "Preparing",
                "connectorId": connector_id,
                "idTag": id_tag,
            }
        },
    }


# ===== POST /api/charging/{sessionId}/stop =====

@router.post("/{session_id}/stop")
async def stop_charging(session_id: str, current: UserClaims = Depends(get_current_user)):
    """
    Step 5: App กด Stop
    Step 6: RemoteStop → CSMS
    """
    _check_role(current)

    if not _sessions_coll:
        raise HTTPException(500, "Database not initialized")

    session = await _sessions_coll.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(404, "Session not found")

    if session.get("state") not in ("Preparing", "Charging"):
        raise HTTPException(400, f"Session state={session.get('state')} ไม่สามารถหยุดได้")

    txn_id = session.get("transactionId")
    connector_id = session.get("connectorId", "?")

    if txn_id:
        try:
            await remote_stop(txn_id)
        except Exception as e:
            raise HTTPException(502, f"CSMS RemoteStop error: {e}")
    else:
        await _sessions_coll.update_one({"_id": session["_id"]}, {"$set": {
            "state": "Stopped", "status": "Inactive",
            "endTime": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        }})

    print(f"⏹ [Charging] Stop → connector={connector_id} session={session_id}")
    return {"success": True, "message": f"สั่งหยุดชาร์จหัว {connector_id} แล้ว"}


# ===== GET /api/charging/active =====

@router.get("/active")
async def get_active_sessions(current: UserClaims = Depends(get_current_user)):
    """ดึง Active sessions ทั้ง 2 หัว"""
    if not _sessions_coll:
        return {"success": True, "data": {"1": None, "2": None}}

    sessions = await _sessions_coll.find({
        "status": "Active",
        "state": {"$in": ["Preparing", "Charging"]},
    }).sort("createdAt", -1).to_list(10)

    result = {"1": None, "2": None}
    for s in sessions:
        cid = str(s.get("connectorId", ""))
        if cid in result and result[cid] is None:
            result[cid] = _fmt(s)

    return {"success": True, "data": result}


# ===== GET /api/charging/active/{connectorId} =====

@router.get("/active/{connector_id}")
async def get_active_by_connector(connector_id: int, current: UserClaims = Depends(get_current_user)):
    """ดึง Active session เฉพาะหัว (1 หรือ 2)"""
    if not _sessions_coll:
        return {"success": True, "data": None}

    s = await _sessions_coll.find_one({
        "connectorId": connector_id,
        "status": "Active",
        "state": {"$in": ["Preparing", "Charging"]},
    }, sort=[("createdAt", -1)])

    return {"success": True, "data": _fmt(s) if s else None}


# ===== GET /api/charging/history =====

@router.get("/history")
async def get_history(limit: int = 20, connector_id: Optional[int] = None, current: UserClaims = Depends(get_current_user)):
    if not _sessions_coll:
        return {"success": True, "data": []}

    query: dict = {"status": "Inactive"}
    if connector_id:
        query["connectorId"] = connector_id

    sessions = await _sessions_coll.find(query).sort("endTime", -1).limit(limit).to_list(limit)

    return {
        "success": True,
        "data": [{
            "_id": str(s["_id"]),
            "connectorId": s.get("connectorId"),
            "energyCharged": s.get("energyCharged", 0),
            "chargingTime": s.get("chargingTime", 0),
            "totalPrice": s.get("totalPrice", 0),
            "startTime": s.get("startTime"),
            "endTime": s.get("endTime"),
        } for s in sessions],
    }


def _fmt(s: dict) -> dict:
    return {
        "_id": str(s["_id"]),
        "state": s.get("state"),
        "connectorId": s.get("connectorId"),
        "soc": s.get("soc", 0),
        "powerKw": s.get("powerKw", 0),
        "energyCharged": s.get("energyCharged", 0),
        "chargingTime": s.get("chargingTime", 0),
        "totalPrice": s.get("totalPrice", 0),
    }