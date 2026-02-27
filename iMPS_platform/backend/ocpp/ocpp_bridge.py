"""
ocpp/ocpp_bridge.py — HTTP client เรียก CSMS API
★ ไม่มี RFID — สั่ง RemoteStart/RemoteStop ตรง ๆ

Flow:
  Step 2: remote_start() → CSMS → Edgebox → Charger
  Step 6: remote_stop()  → CSMS → Edgebox → Charger
"""
import os
import httpx

CSMS_HTTP_URL = os.getenv("CSMS_HTTP_URL", "http://localhost:8080")
CSMS_CP_ID = os.getenv("CSMS_CP_ID", "TACT30KW")


def generate_id_tag(user_id: str) -> str:
    """
    สร้าง idTag จาก userId
    OCPP ยังต้องใช้ แต่ไม่ลงทะเบียน RFID ที่ CSMS
    """
    tag = "U" + user_id.upper()
    return tag[:20]


async def remote_start(connector_id: int, id_tag: str) -> dict:
    """
    Step 2: RemoteStart → CSMS → Edgebox → Charger
    connector_id=1 → หัว 1 | connector_id=2 → หัว 2
    """
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(f"{CSMS_HTTP_URL}/api/command", json={
            "cp_id": CSMS_CP_ID,
            "command": "remote_start",
            "connector_id": connector_id,
            "id_tag": id_tag,
        })
        r.raise_for_status()
        return r.json()


async def remote_stop(transaction_id: int) -> dict:
    """
    Step 6: RemoteStop → CSMS → Edgebox → Charger
    """
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(f"{CSMS_HTTP_URL}/api/command", json={
            "cp_id": CSMS_CP_ID,
            "command": "remote_stop",
            "transaction_id": transaction_id,
        })
        r.raise_for_status()
        return r.json()


async def get_charge_points() -> list:
    """ดึงสถานะ charge points ทั้งหมดจาก CSMS"""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{CSMS_HTTP_URL}/api/charge_points")
        r.raise_for_status()
        return r.json()