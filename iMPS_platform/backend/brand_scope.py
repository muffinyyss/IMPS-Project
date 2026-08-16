"""
ขอบเขตการเห็นข้อมูลตามยี่ห้อตู้ชาร์จที่บริษัทผู้ดูแลรับผิดชอบ

EDS ดูแลเฉพาะตู้ FlexxFast → พนักงาน EDS (cs/planner/technician) เห็นเฉพาะตู้ยี่ห้อนี้
EGAT และบริษัทอื่นเห็นทุกยี่ห้อ | admin/owner ไม่ถูกจำกัดไม่ว่าสังกัดไหน

สถานีที่มีตู้ปนหลายยี่ห้อ → ยังเห็นสถานีได้ แต่รายการตู้ถูกกรองเหลือเฉพาะยี่ห้อที่ดูแล
เพราะงานจริงมีสถานีที่ EDS ดูแลบางตู้ในสถานีที่ EGAT ใช้ร่วม

ต่างจากการ "เปิดใบงาน CM" ที่เข้มกว่า — ต้องเป็นยี่ห้อนั้นทั้งสถานี เพราะฟอร์มเลือกได้แค่
failure class ระดับสถานี ระบุไม่ได้ว่าเป็นตู้ไหน (ดู _brand_clause_for_station ใน cmreport.py)

โมดูลนี้เป็นเจ้าของกติกา company → brand เพียงที่เดียว — ฝั่ง frontend มีสำเนาไว้เตือนผู้ใช้
ล่วงหน้าที่ src/utils/brandScope.ts แต่การบังคับจริงอยู่ที่นี่
"""
import re
import time
from typing import Any, Dict, Iterable, List, Optional

from bson import ObjectId
from fastapi import HTTPException

from config import charger_collection, users_collection
from deps import UserClaims

FLEXXFAST_BRAND = "flexxfast"

# role ที่ผูกกับบริษัทผู้ดูแล — admin/owner ดูภาพรวมทั้งระบบจึงไม่ถูกจำกัด
BRAND_SCOPED_ROLES = {"planner", "technician", "cs"}

# company (ตัวพิมพ์เล็ก) → ยี่ห้อที่บริษัทนั้นดูแล
COMPANY_BRAND_SCOPE: Dict[str, str] = {"eds": FLEXXFAST_BRAND}

# station_id ที่มีตู้ยี่ห้อนั้นอยู่ — เปลี่ยนไม่บ่อย แต่ถูกถามแทบทุก request ที่ตรวจสิทธิ์
# (/uploads ตรวจทีละไฟล์) จึง cache สั้น ๆ พอไม่ให้ยิง distinct รัว ๆ แต่ยังตามการแก้ยี่ห้อทัน
_STATION_IDS_TTL_SECONDS = 60
_station_ids_cache: Dict[str, tuple] = {}


def brand_regex(brand: str) -> dict:
    """ยี่ห้อใน DB พิมพ์มาไม่เหมือนกัน (FlexxFast / flexxfast) — เทียบแบบไม่สนตัวพิมพ์"""
    return {"$regex": f"^{re.escape(brand)}$", "$options": "i"}


def _company_of(current: UserClaims) -> str:
    company = (current.company or "").strip()
    if company or not current.user_id:
        return company
    # JWT ออกก่อนที่ admin จะกรอก company ให้ — อ่านค่าล่าสุดจาก DB แทนที่จะปล่อยผ่าน
    try:
        user = users_collection.find_one({"_id": ObjectId(current.user_id)}, {"company": 1})
    except Exception:
        return ""
    return str((user or {}).get("company") or "").strip()


def brand_scope_of(current: UserClaims) -> Optional[str]:
    """ยี่ห้อที่ user คนนี้ถูกจำกัดให้เห็น — None = เห็นทุกยี่ห้อ"""
    if getattr(current, "is_super_admin", False):
        return None
    if (current.role or "").strip().lower() not in BRAND_SCOPED_ROLES:
        return None
    return COMPANY_BRAND_SCOPE.get(_company_of(current).lower())


def brand_of(doc: Any) -> str:
    return str((doc or {}).get("brand") or "").strip().lower()


def charger_in_scope(doc: Any, scope: Optional[str]) -> bool:
    """ตู้ที่ไม่ได้ระบุยี่ห้อถือว่าอยู่นอกขอบเขต — พิสูจน์ไม่ได้ว่าเป็นของบริษัทนี้"""
    return not scope or brand_of(doc) == scope


def filter_chargers(docs: Iterable[Any], scope: Optional[str]) -> List[Any]:
    if not scope:
        return list(docs)
    return [c for c in docs if brand_of(c) == scope]


def scoped_station_ids(scope: str) -> List[str]:
    """station_id ที่มีตู้ยี่ห้อนี้อย่างน้อย 1 ตู้ — สถานีที่ยังไม่มีข้อมูลตู้เลยจะไม่ติดมา"""
    now = time.monotonic()
    cached = _station_ids_cache.get(scope)
    if cached and now - cached[0] < _STATION_IDS_TTL_SECONDS:
        return cached[1]
    ids = [
        str(sid)
        for sid in charger_collection.distinct("station_id", {"brand": brand_regex(scope)})
        if sid
    ]
    _station_ids_cache[scope] = (now, ids)
    return ids


def station_brand_clause(current: UserClaims) -> Optional[dict]:
    """เงื่อนไขกรอง collection stations ตามยี่ห้อ — None = ไม่ต้องกรอง"""
    scope = brand_scope_of(current)
    if not scope:
        return None
    return {"station_id": {"$in": scoped_station_ids(scope)}}


def assert_charger_in_scope(current: UserClaims, charger_doc: Any) -> None:
    """กันการยิงตรงด้วย SN/_id ของตู้ยี่ห้ออื่นในสถานีที่ปนยี่ห้อ (สถานีเข้าถึงได้ แต่ตู้ไม่ใช่)"""
    if not charger_in_scope(charger_doc, brand_scope_of(current)):
        raise HTTPException(status_code=403, detail="Forbidden charger brand")


def assert_sn_in_scope(current: UserClaims, sn: str) -> None:
    scope = brand_scope_of(current)
    if not scope:
        return
    doc = charger_collection.find_one({"SN": sn}, {"brand": 1}) if sn else None
    if not charger_in_scope(doc, scope):
        raise HTTPException(status_code=403, detail="Forbidden charger brand")
