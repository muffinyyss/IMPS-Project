"""
สิทธิ์การเข้าถึงไฟล์ใต้ /uploads

เดิม /uploads ถูก mount ด้วย StaticFiles ตรงๆ ทำให้รูป PM/CM และ PDF ทุกไฟล์
ดาวน์โหลดได้โดยไม่ต้องล็อกอิน ขอแค่รู้ URL — ไฟล์พวกนี้คือหลักฐานงานของลูกค้า

กติกาที่ใช้คือกติกาเดียวกับที่เหลือของระบบ (station_match_query) ไม่เขียนกฎใหม่
เพื่อไม่ให้สิทธิ์สองชุดเพี้ยนออกจากกันเมื่อมีการแก้ role ในอนาคต
"""
import logging
import os
import pathlib
from typing import Optional

from bson import ObjectId

from fastapi import HTTPException

from brand_scope import assert_sn_in_scope, brand_scope_of, charger_in_scope
from config import station_collection, charger_collection
from deps import UserClaims
from routers.stations import station_match_query

_log = logging.getLogger("uvicorn.error")

# เซกเมนต์ที่ 2 ของ path คือ station_id
STATION_KINDS = {
    "cbboxpm", "ccbpm", "cm", "mdbpm", "stationpm",
    "cbboxpmurl", "ccbpmurl", "mdbpmurl", "stationpmurl", "cmurl",
    "stations",
}

# เซกเมนต์ที่ 2 ของ path คือ SN ของตู้ชาร์จ
SN_KINDS = {"pm", "dctest", "actest", "pmurl", "dcurl", "acurl"}

# เซกเมนต์ที่ 2 คือ _id ของ charger
CHARGER_ID_KINDS = {"chargers"}

# ไม่เปิดผ่าน /uploads เลย — PDF มี endpoint ของตัวเองที่ตรวจสิทธิ์อยู่แล้ว
DENIED_KINDS = {"pdf_cache"}


def _station_id_for_sn(sn: str) -> Optional[str]:
    doc = charger_collection.find_one({"SN": sn}, {"station_id": 1})
    return str(doc["station_id"]) if doc and doc.get("station_id") else None


def _station_id_for_charger_id(charger_id: str) -> Optional[str]:
    try:
        oid = ObjectId(charger_id)
    except Exception:
        return None
    doc = charger_collection.find_one({"_id": oid}, {"station_id": 1})
    return str(doc["station_id"]) if doc and doc.get("station_id") else None


def user_can_access_station(current: UserClaims, station_id: str) -> bool:
    """ใช้ match query เดียวกับหน้า EV Station — staff เห็นหมด, owner ตามสถานีที่เป็นเจ้าของ"""
    q = station_match_query(current)
    if q is None:
        return False
    if q == {}:
        return True
    # ต้องใช้ $and — ถ้า merge ด้วย {**q, "station_id": ...} คีย์ station_id ของ q
    # จะถูกเขียนทับ เหลือแต่เงื่อนไขที่ผู้เรียกคุมได้ = ไม่มีการตรวจสิทธิ์เลย
    return station_collection.count_documents(
        {"$and": [q, {"station_id": station_id}]}, limit=1
    ) > 0


def assert_station_access(current: UserClaims, station_id: str) -> None:
    """ใช้ที่ endpoint อัปโหลดที่รับ station_id มาเป็น Form field"""
    if not station_id or not user_can_access_station(current, station_id):
        raise HTTPException(status_code=403, detail="Forbidden station")


def assert_sn_access(current: UserClaims, sn: str) -> None:
    """ใช้ที่ endpoint ของตู้ชาร์จที่อ้างด้วย SN"""
    station_id = _station_id_for_sn(sn) if sn else None
    if not station_id or not user_can_access_station(current, station_id):
        raise HTTPException(status_code=403, detail="Forbidden station")
    # สถานีผ่านแล้วไม่พอ — สถานีที่ปนยี่ห้อเข้าถึงได้ แต่ตู้ยี่ห้ออื่นในนั้นเข้าไม่ได้
    assert_sn_in_scope(current, sn)


def resolve_upload_path(rel_path: str) -> pathlib.Path:
    """แปลงเป็น path จริงพร้อมกัน path traversal — คืน 404 เสมอถ้าไม่เข้าเงื่อนไข ไม่บอกว่าไฟล์มีอยู่จริงมั้ย"""
    from routers.pm_helpers import UPLOADS_ROOT

    base = pathlib.Path(UPLOADS_ROOT).resolve()
    try:
        target = (base / rel_path).resolve()
    except Exception:
        raise HTTPException(status_code=404, detail="Not found")

    if not str(target).startswith(str(base) + os.sep) or not target.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return target


def assert_upload_access(current: UserClaims, rel_path: str) -> None:
    parts = [p for p in rel_path.replace("\\", "/").split("/") if p]
    if len(parts) < 2:
        raise HTTPException(status_code=403, detail="Forbidden")

    kind, owner = parts[0], parts[1]

    if kind in DENIED_KINDS:
        raise HTTPException(status_code=403, detail="Forbidden")

    # ไฟล์ที่ผูกกับตู้ตัวใดตัวหนึ่ง ต้องผ่านทั้งสิทธิ์สถานีและยี่ห้อที่บริษัทดูแล
    charger_doc = None
    if kind in STATION_KINDS:
        station_id = owner
    elif kind in SN_KINDS:
        station_id = _station_id_for_sn(owner)
        charger_doc = charger_collection.find_one({"SN": owner}, {"brand": 1})
    elif kind in CHARGER_ID_KINDS:
        station_id = _station_id_for_charger_id(owner)
        try:
            charger_doc = charger_collection.find_one({"_id": ObjectId(owner)}, {"brand": 1})
        except Exception:
            charger_doc = None
    else:
        # path รูปแบบใหม่ที่ยังไม่ได้ map — ยังต้องล็อกอิน แต่ผูกกับสถานีไม่ได้
        # log ไว้เพื่อให้เพิ่มเข้า map ทีหลัง อย่าปล่อยเงียบ
        _log.warning("uploads: ไม่รู้จัก kind %r (path=%r) — บังคับแค่ต้องล็อกอิน", kind, rel_path)
        return

    if not station_id or not user_can_access_station(current, station_id):
        raise HTTPException(status_code=403, detail="Forbidden")

    if charger_doc is not None and not charger_in_scope(charger_doc, brand_scope_of(current)):
        raise HTTPException(status_code=403, detail="Forbidden")
