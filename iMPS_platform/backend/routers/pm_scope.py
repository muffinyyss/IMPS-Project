"""
routers/pm_scope.py
===================
แบ่งงานในใบ PM สถานีใบเดียวระหว่าง "ทีมต้นทาง" (planner ที่วางแผนใบงาน เช่น EGAT)
กับ vendor ที่ดูแลตู้ชาร์จบางตู้ (เช่น EDS)

ที่มา: planner ต้นทางเลือกอุปกรณ์ครบทุกชิ้นของสถานี แต่ตู้ชาร์จบางตู้มี vendor
ดูแลอยู่ (ช่อง Vendor ของตู้ในหน้า EV Stations) → ตู้พวกนั้นเป็นงานของ vendor
ส่วนที่เหลือ (Station/MDB/CCB/CB_BOX + ตู้ที่ไม่มี vendor) เป็นงานของทีมต้นทาง
ทุกคนยังกรอกในเอกสารใบเดียวกัน (1 เลขที่ / 1 PDF / อนุมัติครั้งเดียว)

ข้อมูลที่ใช้ (ใบงาน iMPS.maximo_pm_open):
  vendor_plans[].chargers = [SN ...]   ตู้ที่ส่งต่อให้ vendor รายนั้น
                                        (คิดให้ตอน planner ต้นทางบันทึกแผน — ดู pm_maximo.set_pm_equipment)
  planner_company                       บริษัทของ planner ต้นทาง (ไว้แสดง "งานของ ...")

กติกาสิทธิ์กรอก:
  - admin / owner (และ super_admin) กรอกได้ทุกส่วน
  - planner ของบริษัทต้นทาง (planner_company) ดูแลทั้งใบ แก้ได้ทุกส่วน
  - คนของ vendor (company = vendor หรือชื่ออยู่ในทีมที่ vendor มอบหมาย)
      → กรอกได้เฉพาะตู้ที่ส่งต่อให้ vendor ตัวเอง
      (vendor ที่ถูกส่งต่อแบบไม่มีตู้ผูก = ใบส่งต่อแบบเดิม กรอกได้ทุกส่วน)
  - คนอื่น (ทีมต้นทางและ outsource ของทีมต้นทาง) → ทุกส่วนยกเว้นตู้ของ vendor
  - ใบที่ไม่มีตู้ส่งต่อเลย / ไม่ได้ผูกใบงาน → ไม่จำกัด (เหมือนเดิมทุกอย่าง)
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
# ตู้ → vendor (ใช้ตอนวางแผน)
# ──────────────────────────────────────────────────────────────────

def charger_vendors(station_id: str, sns: Iterable[str]) -> dict[str, str]:
    """SN ของตู้ → ชื่อ vendor ตามช่อง Vendor ของตู้ (ตู้ที่ไม่ได้ระบุ vendor ไม่อยู่ในผล)"""
    from config import charger_collection

    wanted = [str(s).strip() for s in sns if str(s or "").strip()]
    if not wanted:
        return {}
    query: dict = {"SN": {"$in": wanted}}
    if station_id:
        query["station_id"] = station_id
    out: dict[str, str] = {}
    try:
        for ch in charger_collection.find(query, {"_id": 0, "SN": 1, "vendor": 1}):
            vendor = str(ch.get("vendor") or "").strip()
            if vendor and vendor not in ("-",):
                out[str(ch.get("SN") or "").strip()] = vendor
    except Exception as e:
        log.warning(f"  ⚠️ อ่าน vendor ของตู้ {wanted} ไม่สำเร็จ: {e}")
    return out


def chargers_by_vendor(station_id: str, items: list[dict]) -> dict[str, tuple[str, list[str]]]:
    """
    อุปกรณ์ที่เลือกในแผน → {vendor ตัวพิมพ์เล็ก: (ชื่อ vendor, [SN ...])}
    นับเฉพาะตู้ชาร์จที่มี vendor ระบุไว้
    """
    sns = [str(i.get("sn") or "").strip() for i in items if _norm(i.get("type")) == CHARGER_SECTION]
    out: dict[str, tuple[str, list[str]]] = {}
    for sn, vendor in charger_vendors(station_id, sns).items():
        name, lst = out.setdefault(vendor.lower(), (vendor, []))
        lst.append(sn)
    return out


# ──────────────────────────────────────────────────────────────────
# ใครเป็นเจ้าของส่วนไหน
# ──────────────────────────────────────────────────────────────────

def scoped_chargers(wo: dict | None) -> dict[str, str]:
    """SN ตัวพิมพ์เล็ก → ชื่อ vendor ที่รับตู้นั้น"""
    out: dict[str, str] = {}
    for v in (wo or {}).get("vendor_plans") or []:
        name = str(v.get("vendor") or "").strip()
        for sn in v.get("chargers") or []:
            if str(sn or "").strip():
                out[_norm(sn)] = name
    return out


def user_vendor_plan(wo: dict | None, username: str, company: str) -> Optional[dict]:
    """ใบส่งต่อของ vendor ที่ผู้ใช้คนนี้สังกัด (บริษัทตรง หรืออยู่ในทีมที่ vendor มอบหมาย)"""
    u, c = _norm(username), _norm(company)
    for v in (wo or {}).get("vendor_plans") or []:
        if c and _norm(v.get("vendor")) == c:
            return v
    for v in (wo or {}).get("vendor_plans") or []:
        team = {_norm(x) for x in (v.get("assignees") or [])}
        if (u and u in team) or (c and c in team):
            return v
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
        return True  # ไม่มีตู้ส่งต่อ = ไม่จำกัด
    mine = user_vendor_plan(wo, username, company)
    vendor_of_section = scope.get(_norm(sn)) if _norm(section) == CHARGER_SECTION else None
    if mine is not None:
        if not (mine.get("chargers") or []):
            return True  # ส่งต่อแบบเดิม (ไม่ได้ผูกตู้) — ทำได้ทั้งใบ
        return bool(vendor_of_section) and _norm(vendor_of_section) == _norm(mine.get("vendor"))
    return not vendor_of_section


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
            {"_id": 0, "wonum": 1, "vendor_plans": 1, "planner_company": 1},
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
