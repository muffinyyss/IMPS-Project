"""
routers/pm_scope.py
===================
แบ่งงานในใบ PM สถานีใบเดียวระหว่าง "ทีมต้นทาง" (planner ที่วางแผนใบงาน เช่น EGAT)
กับผู้ทำ PM ตู้ชาร์จที่ planner เลือกให้รายตู้ (vendor เช่น EDS หรือ outsource)

ที่มา: ตู้ชาร์จแต่ละตู้ใครทำ PM ไม่ตายตัว — บางตู้ vendor ทำเอง บางตู้ EGAT ทำเอง
บางตู้ outsource ทำ planner ต้นทางจึงเลือก "ผู้ทำ PM" ให้ทุกตู้ทุกใบงาน
(selected_equipment[].by — ว่าง = ทีมของ planner เอง) ส่วนอุปกรณ์ระดับสถานี
(Station/MDB/CCB/CB_BOX) เป็นของทีมต้นทางเสมอ
ทุกคนยังกรอกในเอกสารใบเดียวกัน (1 เลขที่ / 1 PDF / อนุมัติครั้งเดียว)

ข้อมูลที่ใช้ (ใบงาน iMPS.maximo_pm_open):
  selected_equipment[].by   ผู้ทำ PM ของตู้นั้น (ชื่อ vendor / outsource จากหน้า Company)
  vendor_plans[]            ใบส่งต่อให้ vendor ที่มี planner ของตัวเอง (assignees = ทีมที่ vendor ส่ง)
  planner_company           บริษัทของ planner ต้นทาง (ไว้แสดง "งานของ ...")

กติกาสิทธิ์กรอก:
  - admin / owner (และ super_admin) กรอกได้ทุกส่วน
  - planner ของบริษัทต้นทาง (planner_company) ดูแลทั้งใบ แก้ได้ทุกส่วน
  - คนของผู้ทำ PM รายใดรายหนึ่ง (company = ชื่อนั้น หรืออยู่ในทีมที่ vendor รายนั้นมอบหมาย)
      → กรอกได้เฉพาะตู้ที่ planner เลือกให้รายนั้น
      (ผู้รับผิดชอบที่ไม่ได้ถูกเลือกให้ตู้ไหนเลย = นับเป็นทีมต้นทาง)
  - คนอื่น (ทีมต้นทาง) → ทุกส่วนยกเว้นตู้ที่เลือกให้คนอื่นทำ
  - ใบที่ไม่มีตู้ไหนเลือกผู้ทำ PM เป็นคนอื่น / ไม่ได้ผูกใบงาน → ไม่จำกัด (เหมือนเดิม)
"""
from __future__ import annotations

import logging
from typing import Any, Iterable, Optional

from bson import ObjectId
from fastapi import HTTPException

from deps import UserClaims

log = logging.getLogger("pm_scope")

CHARGER_SECTION = "charger"

# role ที่ไม่ถูกจำกัดตามบริษัท — ดูภาพรวมทั้งระบบ
BYPASS_ROLES = {"admin", "owner", "super_admin"}


def _norm(v: Any) -> str:
    return str(v or "").strip().lower()


# ──────────────────────────────────────────────────────────────────
# ตู้ → ผู้ทำ PM (ใช้ตอนวางแผน)
# ──────────────────────────────────────────────────────────────────

def chargers_by_party(items: list[dict]) -> dict[str, tuple[str, list[str]]]:
    """
    อุปกรณ์ในแผน → {ผู้ทำ PM ตัวพิมพ์เล็ก: (ชื่อ, [SN ...])}
    นับเฉพาะตู้ชาร์จที่ planner เลือกผู้ทำ PM เป็นคนอื่น (by ไม่ว่าง)
    """
    out: dict[str, tuple[str, list[str]]] = {}
    for i in items or []:
        if _norm(i.get("type")) != CHARGER_SECTION:
            continue
        by = str(i.get("by") or "").strip()
        sn = str(i.get("sn") or "").strip()
        if by and sn:
            out.setdefault(by.lower(), (by, []))[1].append(sn)
    return out


# ──────────────────────────────────────────────────────────────────
# ใครเป็นเจ้าของส่วนไหน
# ──────────────────────────────────────────────────────────────────

def scoped_chargers(wo: dict | None) -> dict[str, str]:
    """SN ตัวพิมพ์เล็ก → ผู้ทำ PM ที่ไม่ใช่ทีมต้นทาง"""
    out: dict[str, str] = {}
    # ใบส่งต่อที่ผูกตู้ไว้ (ข้อมูลรุ่นก่อนที่ยังไม่มี by รายตู้)
    for v in (wo or {}).get("vendor_plans") or []:
        name = str(v.get("vendor") or "").strip()
        for sn in v.get("chargers") or []:
            if str(sn or "").strip():
                out[_norm(sn)] = name
    for _key, (name, sns) in chargers_by_party((wo or {}).get("selected_equipment") or []).items():
        for sn in sns:
            out[_norm(sn)] = name
    return out


def user_party(wo: dict | None, username: str, company: str) -> Optional[str]:
    """
    ผู้ทำ PM รายที่ผู้ใช้คนนี้สังกัด — ชื่อบริษัทตรงกับผู้ทำ PM ของตู้ไหนสักตู้
    หรืออยู่ในทีมที่ vendor รายนั้นมอบหมาย (แผนรอบ 2) ไม่ใช่ใครเลย = None (ทีมต้นทาง)
    """
    u, c = _norm(username), _norm(company)
    parties = {_norm(p): p for p in scoped_chargers(wo).values()}
    for v in (wo or {}).get("vendor_plans") or []:
        name = str(v.get("vendor") or "").strip()
        if name:
            parties.setdefault(_norm(name), name)
    if c and c in parties:
        return parties[c]
    for v in (wo or {}).get("vendor_plans") or []:
        team = {_norm(x) for x in (v.get("assignees") or [])}
        if (u and u in team) or (c and c in team):
            return str(v.get("vendor") or "").strip() or None
    return None


def section_owner(wo: dict | None, section: str, sn: str = "") -> str:
    """ชื่อบริษัทเจ้าของส่วนนั้น — vendor ที่รับตู้นั้น หรือบริษัทของ planner ต้นทาง ("" = ไม่ทราบ)"""
    if _norm(section) == CHARGER_SECTION:
        vendor = scoped_chargers(wo).get(_norm(sn))
        if vendor:
            return vendor
    return str((wo or {}).get("planner_company") or "").strip()


def can_edit_section(wo: dict | None, role: str, username: str, company: str, section: str, sn: str = "") -> bool:
    if _norm(role) in BYPASS_ROLES:
        return True
    # planner ต้นทางดูแลทั้งใบ (ตรวจ/แก้ก่อนอนุมัติได้ทุกส่วน รวมตู้ของ vendor)
    if _norm(role) == "planner" and company and _norm(company) == _norm((wo or {}).get("planner_company")):
        return True
    scope = scoped_chargers(wo)
    if not scope:
        return True  # ไม่มีตู้ที่ให้คนอื่นทำ = ไม่จำกัด
    party = user_party(wo, username, company)
    party_of_section = scope.get(_norm(sn)) if _norm(section) == CHARGER_SECTION else None
    if party is not None:
        if _norm(party) not in {_norm(p) for p in scope.values()}:
            return True  # ส่งต่อแบบเดิม (ไม่ได้ผูกตู้) — ทำได้ทั้งใบ
        return bool(party_of_section) and _norm(party_of_section) == _norm(party)
    return not party_of_section


def annotate_sections(sections: list[dict], wo: dict | None, current: UserClaims, company: str) -> None:
    """เติม owner / editable ให้แถวสถานะของแต่ละส่วน (in-place) — หน้ารวมใช้ล็อกปุ่ม"""
    scoped = bool(scoped_chargers(wo))
    for s in sections:
        sec, sn = s.get("section") or "", s.get("sn") or ""
        s["owner"] = section_owner(wo, sec, sn) if scoped else ""
        s["editable"] = can_edit_section(wo, current.role, current.username or current.sub, company, sec, sn)


# ──────────────────────────────────────────────────────────────────
# อ่านใบงาน / ตรวจสิทธิ์
# ──────────────────────────────────────────────────────────────────

async def wos_by_wonum(wonums: Iterable[str]) -> dict[str, dict]:
    from config import client

    wanted = sorted({str(w or "").strip() for w in wonums} - {""})
    if not wanted:
        return {}
    out: dict[str, dict] = {}
    try:
        cursor = client["iMPS"]["maximo_pm_open"].find(
            {"wonum": {"$in": wanted}},
            {"_id": 0, "wonum": 1, "vendor_plans": 1, "planner_company": 1, "selected_equipment": 1},
        )
        async for wo in cursor:
            out[str(wo.get("wonum") or "")] = wo
    except Exception as e:
        log.warning(f"  ⚠️ อ่านใบงาน {wanted} ไม่สำเร็จ: {e}")
    return out


def company_of(current: UserClaims) -> str:
    from routers.pm_maximo import _company_of
    return _company_of(current)


async def guard(
    current: UserClaims,
    section: str,
    coll,
    *,
    report_id: Optional[str] = None,
    job_id: Optional[str] = None,
    station_id: Optional[str] = None,
    sn: str = "",
) -> None:
    """
    กันไม่ให้บันทึก/อัปโหลดรูป/ส่งส่วนที่เป็นงานของบริษัทอื่นในใบ PM สถานี
    ใบเดี่ยวที่ไม่ได้ผูกกับใบแม่ (ไม่มี job_id) ไม่ตรวจ — เหมือนเดิม
    """
    if _norm(current.role) in BYPASS_ROLES:
        return
    job_id = (job_id or "").strip()
    station_id = (station_id or "").strip()
    if (not job_id or not station_id) and report_id:
        try:
            doc = await coll.find_one({"_id": ObjectId(str(report_id))}, {"job_id": 1, "station_id": 1, "sn": 1})
        except Exception:
            doc = None
        if doc:
            job_id = job_id or str(doc.get("job_id") or "").strip()
            station_id = station_id or str(doc.get("station_id") or "").strip()
            sn = sn or str(doc.get("sn") or "").strip()
    if not job_id:
        return
    if not station_id and sn:
        from config import charger_collection
        ch = charger_collection.find_one({"SN": sn}, {"station_id": 1}) or {}
        station_id = str(ch.get("station_id") or "").strip()
    if not station_id:
        return

    from routers.pm_helpers import get_stationpmjob_collection_for
    try:
        job = await get_stationpmjob_collection_for(station_id).find_one({"_id": ObjectId(job_id)}, {"wonum": 1})
    except Exception:
        job = None
    wonum = str((job or {}).get("wonum") or "").strip()
    if not wonum:
        return
    wo = (await wos_by_wonum([wonum])).get(wonum)
    company = company_of(current)
    if not can_edit_section(wo, current.role, current.username or current.sub, company, section, sn):
        owner = section_owner(wo, section, sn) or "ทีมอื่น"
        raise HTTPException(status_code=403, detail=f"ส่วนนี้เป็นงานของ {owner} — บริษัทของคุณกรอกส่วนนี้ไม่ได้")
