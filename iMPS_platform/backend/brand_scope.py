"""
ขอบเขตการเห็นข้อมูลตามยี่ห้อตู้ชาร์จที่บริษัทผู้ดูแลรับผิดชอบ

EDS ดูแลเฉพาะตู้ FlexxFast → พนักงาน EDS (cs/planner/technician) เห็นเฉพาะตู้ยี่ห้อนี้
technician ของบริษัทอื่นเห็นทุกสถานีและทุกยี่ห้อเพื่อปฏิบัติงานภาคสนาม
EGAT และบริษัทอื่นเห็นทุกยี่ห้อ | admin/owner ไม่ถูกจำกัดไม่ว่าสังกัดไหน

สถานีที่มีตู้ปนหลายยี่ห้อ → ยังเห็นสถานีได้ แต่รายการตู้ถูกกรองเหลือเฉพาะยี่ห้อที่ดูแล
เพราะงานจริงมีสถานีที่ EDS ดูแลบางตู้ในสถานีที่ EGAT ใช้ร่วม

ต่างจากการ "เปิดใบงาน CM" ที่เข้มกว่า — ต้องเป็นยี่ห้อนั้นทั้งสถานี เพราะฟอร์มเลือกได้แค่
failure class ระดับสถานี ระบุไม่ได้ว่าเป็นตู้ไหน (ดู _brand_clause_for_station ใน cmreport.py)

โมดูลนี้เป็นเจ้าของกติกา company → brand เพียงที่เดียว — ฝั่ง frontend มีสำเนาไว้เตือนผู้ใช้
ล่วงหน้าที่ src/utils/brandScope.ts แต่การบังคับจริงอยู่ที่นี่

ข้อยกเว้น — งาน PM ที่ได้รับมอบ: planner ต้นทางเลือก "ผู้ทำ PM" รายอุปกรณ์ได้ และจ้าง vendor
ทำทั้งสถานีได้ (ดู routers/pm_scope.py) ถ้ามอบงานให้ EDS ในสถานีที่ไม่มีตู้ FlexxFast เลย
ช่าง EDS ต้องเปิดสถานีนั้นและตู้ที่ได้รับมอบได้ ไม่งั้นงานเดินต่อไม่ได้
→ brand_scope_of คืน BrandScope ที่พก station_id / SN ของงานที่ได้รับมอบไว้ด้วย
  (จากใบงาน iMPS.maximo_pm_open ที่ selected_equipment[].by หรือ vendor_plans[].vendor
  เป็นบริษัทนี้ ภายใน ASSIGNED_WORK_DAYS วันย้อนหลังจากวันที่ PM)
  ตู้ยี่ห้ออื่นที่ไม่ได้รับมอบในสถานีเดียวกันยังถูกกรองออกเหมือนเดิม
"""
import logging
import os
import re
import time
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

from bson import ObjectId
from fastapi import HTTPException

from config import charger_collection, db, users_collection
from deps import UserClaims

log = logging.getLogger("brand_scope")

FLEXXFAST_BRAND = "flexxfast"

# role ที่ผูกกับบริษัทผู้ดูแล — admin/owner ดูภาพรวมทั้งระบบจึงไม่ถูกจำกัด
BRAND_SCOPED_ROLES = {"planner", "technician", "cs"}

# company (ตัวพิมพ์เล็ก) → ยี่ห้อที่บริษัทนั้นดูแล
COMPANY_BRAND_SCOPE: Dict[str, str] = {"eds": FLEXXFAST_BRAND}

# station_id ที่มีตู้ยี่ห้อนั้นอยู่ — เปลี่ยนไม่บ่อย แต่ถูกถามแทบทุก request ที่ตรวจสิทธิ์
# (/uploads ตรวจทีละไฟล์) จึง cache สั้น ๆ พอไม่ให้ยิง distinct รัว ๆ แต่ยังตามการแก้ยี่ห้อทัน
_STATION_IDS_TTL_SECONDS = 60
_station_ids_cache: Dict[str, tuple] = {}

# งาน PM ที่ได้รับมอบ — นับใบงานที่วันที่ PM ไม่เก่ากว่านี้ (ช่างยังต้องเปิดดูเอกสาร/PDF
# ของงานที่ทำไปแล้วได้ระยะหนึ่ง) ใบงานในระบบไม่เปลี่ยน status ตอนปิดใน iMPS จึงใช้อายุแทน
ASSIGNED_WORK_DAYS = int(os.getenv("BRAND_SCOPE_ASSIGNED_DAYS", "180"))
_ASSIGNED_TTL_SECONDS = 60
_assigned_cache: Dict[str, tuple] = {}
_EMPTY: frozenset = frozenset()


class BrandScope(str):
    """
    ยี่ห้อที่บริษัทดูแล (ใช้เหมือน str เดิมทุกที่) + งาน PM ที่ได้รับมอบนอกยี่ห้อนั้น

      extra_station_ids  สถานีที่มีงานมอบให้บริษัทนี้ — เห็นสถานีได้แม้ไม่มีตู้ยี่ห้อที่ดูแล
      extra_sns          ตู้ที่มอบให้บริษัทนี้ทำ PM — เห็นตู้ได้แม้เป็นยี่ห้ออื่น
    """
    extra_station_ids: frozenset = _EMPTY
    extra_sns: frozenset = _EMPTY

    def __new__(cls, brand: str, station_ids: Iterable[str] = (), sns: Iterable[str] = ()):
        obj = super().__new__(cls, brand)
        obj.extra_station_ids = frozenset(s for s in station_ids if s)
        obj.extra_sns = frozenset(s for s in sns if s)
        return obj


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


def _norm(v: Any) -> str:
    return str(v or "").strip().lower()


def _wo_sns_for(wo: dict, company_lc: str) -> set:
    """SN ของตู้ในใบงานนี้ที่มอบให้บริษัทนี้ทำ PM (กติกาเดียวกับ pm_scope.scoped_items)"""
    equipment = wo.get("selected_equipment") or []
    sns = {
        str(i.get("sn") or "").strip()
        for i in equipment
        if _norm(i.get("by")) == company_lc and _norm(i.get("type")) == "charger"
    }
    for v in wo.get("vendor_plans") or []:
        if _norm(v.get("vendor")) != company_lc:
            continue
        chargers = {str(sn or "").strip() for sn in (v.get("chargers") or [])}
        sns |= chargers
        if not chargers - {""} and not [x for x in (v.get("sections") or []) if _norm(x)]:
            # ใบส่งต่อรุ่นเก่าแบบไม่ผูกอุปกรณ์ = ทำได้ทั้งใบ (เหมือน pm_scope.can_edit_section)
            sns |= {
                str(i.get("sn") or "").strip()
                for i in equipment
                if _norm(i.get("type")) == "charger"
            }
    sns.discard("")
    return sns


def assigned_work(company: str) -> Tuple[frozenset, frozenset]:
    """(station_id, SN) ที่มีงาน PM มอบให้บริษัทนี้ — cache สั้น ๆ เหมือน scoped_station_ids"""
    key = _norm(company)
    if not key:
        return _EMPTY, _EMPTY
    now = time.monotonic()
    cached = _assigned_cache.get(key)
    if cached and now - cached[0] < _ASSIGNED_TTL_SECONDS:
        return cached[1]

    name_re = {"$regex": f"^\\s*{re.escape(company.strip())}\\s*$", "$options": "i"}
    since = date.today() - timedelta(days=ASSIGNED_WORK_DAYS)
    since_dt = datetime(since.year, since.month, since.day)
    query = {"$and": [
        {"$or": [{"selected_equipment.by": name_re}, {"vendor_plans.vendor": name_re}]},
        # pm_date เป็นได้ทั้ง "YYYY-MM-DD" และ datetime — Mongo เทียบข้ามชนิดไม่ได้จึงต้องใส่ทั้งคู่
        {"$or": [
            {"pm_date": {"$gte": since.isoformat()}},
            {"pm_date": {"$gte": since_dt}},
            {"pm_date": {"$in": [None, ""]}},
        ]},
    ]}

    station_ids: set = set()
    sns: set = set()
    try:
        cursor = db["maximo_pm_open"].find(
            query, {"_id": 0, "station_id": 1, "selected_equipment": 1, "vendor_plans": 1}
        )
        for wo in cursor:
            sid = str(wo.get("station_id") or "").strip()
            if sid:
                station_ids.add(sid)
            sns |= _wo_sns_for(wo, key)
        if sns:
            # ใบงานที่ยังไม่ได้ผูก station_id — ตามสถานีจากตู้ที่ได้รับมอบแทน
            station_ids |= {
                str(sid) for sid in charger_collection.distinct("station_id", {"SN": {"$in": sorted(sns)}})
                if sid
            }
    except Exception as e:
        # อ่านไม่ได้ = ถอยกลับไปกติกายี่ห้ออย่างเดียว (แคบกว่า ไม่เปิดสิทธิ์เกิน)
        log.warning(f"  ⚠️ อ่านงาน PM ที่มอบให้ {company} ไม่สำเร็จ: {e}")
        return _EMPTY, _EMPTY

    result = (frozenset(station_ids), frozenset(sns))
    _assigned_cache[key] = (now, result)
    return result


def invalidate_assigned_work() -> None:
    """ล้าง cache งานที่ได้รับมอบ — เรียกหลังบันทึกแผน PM ให้ช่าง vendor เห็นสถานีทันที"""
    _assigned_cache.clear()


def brand_scope_of(current: UserClaims) -> Optional[str]:
    """ยี่ห้อที่ user คนนี้ถูกจำกัดให้เห็น — None = เห็นทุกยี่ห้อ

    คืน BrandScope (เป็น str) ที่พกงาน PM ที่ได้รับมอบนอกยี่ห้อมาด้วย
    """
    if getattr(current, "is_super_admin", False):
        return None
    if (current.role or "").strip().lower() not in BRAND_SCOPED_ROLES:
        return None
    company = _company_of(current)
    brand = COMPANY_BRAND_SCOPE.get(company.lower())
    if not brand:
        return None
    station_ids, sns = assigned_work(company)
    return BrandScope(brand, station_ids, sns)


def brand_of(doc: Any) -> str:
    return str((doc or {}).get("brand") or "").strip().lower()


def charger_in_scope(doc: Any, scope: Optional[str]) -> bool:
    """ตู้ที่ไม่ได้ระบุยี่ห้อถือว่าอยู่นอกขอบเขต — พิสูจน์ไม่ได้ว่าเป็นของบริษัทนี้
    ยกเว้นตู้ที่ได้รับมอบงาน PM (ต้องมี SN ใน doc — projection ต้องขอ SN มาด้วย)"""
    if not scope or brand_of(doc) == scope:
        return True
    sn = str((doc or {}).get("SN") or "").strip()
    return bool(sn) and sn in getattr(scope, "extra_sns", _EMPTY)


def filter_chargers(docs: Iterable[Any], scope: Optional[str]) -> List[Any]:
    if not scope:
        return list(docs)
    return [c for c in docs if charger_in_scope(c, scope)]


def charger_brand_clause(scope: str) -> dict:
    """เงื่อนไขกรอง collection charger ตาม scope — ยี่ห้อที่ดูแล หรือตู้ที่ได้รับมอบงาน PM"""
    clause = {"brand": brand_regex(str(scope))}
    extra = sorted(getattr(scope, "extra_sns", _EMPTY))
    return {"$or": [clause, {"SN": {"$in": extra}}]} if extra else clause


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
    ids = set(scoped_station_ids(str(scope))) | set(getattr(scope, "extra_station_ids", _EMPTY))
    return {"station_id": {"$in": sorted(ids)}}


def assert_charger_in_scope(current: UserClaims, charger_doc: Any) -> None:
    """กันการยิงตรงด้วย SN/_id ของตู้ยี่ห้ออื่นในสถานีที่ปนยี่ห้อ (สถานีเข้าถึงได้ แต่ตู้ไม่ใช่)"""
    if not charger_in_scope(charger_doc, brand_scope_of(current)):
        raise HTTPException(status_code=403, detail="Forbidden charger brand")


def assert_sn_in_scope(current: UserClaims, sn: str) -> None:
    scope = brand_scope_of(current)
    if not scope:
        return
    doc = charger_collection.find_one({"SN": sn}, {"brand": 1, "SN": 1}) if sn else None
    if not charger_in_scope(doc, scope):
        raise HTTPException(status_code=403, detail="Forbidden charger brand")
