"""
routers/pm_scope.py
===================
แบ่งงานในใบ PM สถานีใบเดียวระหว่าง "ทีมต้นทาง" (planner ที่วางแผนใบงาน เช่น EGAT)
กับผู้ทำ PM ที่ planner เลือกให้อุปกรณ์แต่ละชิ้น (vendor เช่น EDS หรือ outsource)

ที่มา: อุปกรณ์แต่ละชิ้นใครทำ PM ไม่ตายตัว — บางตู้ vendor ทำเอง บางตู้ EGAT ทำเอง
บางตู้ outsource ทำ และบางใบจ้าง vendor ทำทั้งสถานี (Station/MDB/CCB/CB_BOX + ทุกตู้)
planner ต้นทางจึงเลือก "ผู้ทำ PM" ให้อุปกรณ์ทุกชิ้นทุกใบงาน
(selected_equipment[].by — ว่าง = ทีมของ planner เอง ซึ่งเป็นค่าตั้งต้นของทุกชิ้น)
ทุกคนยังกรอกในเอกสารใบเดียวกัน (1 เลขที่ / 1 PDF / อนุมัติครั้งเดียว)

ข้อมูลที่ใช้ (ใบงาน iMPS.maximo_pm_open):
  selected_equipment[].by   ผู้ทำ PM ของอุปกรณ์ชิ้นนั้น (ชื่อ vendor / outsource จากหน้า Company)
  vendor_plans[]            ใบส่งต่อให้ vendor ที่มี planner ของตัวเอง (assignees = ทีมที่ vendor ส่ง,
                            chargers = SN ของตู้ / sections = ส่วนระดับสถานี ที่เป็นงานของรายนั้น)
  planner_company           บริษัทของ planner ต้นทาง (ไว้แสดง "งานของ ...")

ส่วนของเอกสาร = ชนิดอุปกรณ์ (station / mdb / ccb / cbbox / charger) — ตู้ชาร์จแยกตาม SN (item_key)

กติกาสิทธิ์กรอก:
  - admin / owner (และ super_admin) กรอกได้ทุกส่วน
  - planner ของบริษัทต้นทาง (planner_company) ดูแลทั้งใบ แก้ได้ทุกส่วน
  - คนของผู้ทำ PM รายใดรายหนึ่ง (company = ชื่อนั้น หรืออยู่ในทีมที่ vendor รายนั้นมอบหมาย)
      → กรอกได้เฉพาะส่วนที่ planner เลือกให้รายนั้น
      (ผู้รับผิดชอบที่ไม่ได้ถูกเลือกให้ส่วนไหนเลย = นับเป็นทีมต้นทาง)
  - ทีมต้นทาง (company เดียวกับ planner_company หรือถูกติ๊กเป็นผู้รับผิดชอบ) → ทุกส่วนยกเว้นส่วนที่เลือกให้คนอื่นทำ
      (ให้คนอื่นทำทุกส่วน = ทีมต้นทางกรอกไม่ได้เลย เหลือ planner ต้นทางตรวจ/อนุมัติ)
  - คนนอกใบงาน (ไม่ได้อยู่ในข้อไหนเลย เช่น planner/ช่าง EDS ในใบที่ EGAT ทำเองทั้งหมด) → กรอกไม่ได้เลย
      และกด "เริ่ม PM" ไม่ได้ (is_participant — แก้ 2026-10-22)
  - ใบที่ไม่ได้ผูกใบงาน / ใบงานรุ่นก่อนที่ไม่มี planner_company → ไม่จำกัด (เหมือนเดิม)
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


def item_key(section: Any, sn: Any = "") -> str:
    """key ของส่วนในเอกสาร — ตู้ชาร์จแยกด้วย SN ("charger:<sn>") ที่เหลือใช้ชื่อส่วนตรง ๆ ("mdb")"""
    sec = _norm(section)
    return f"{CHARGER_SECTION}:{_norm(sn)}" if sec == CHARGER_SECTION else sec


# ──────────────────────────────────────────────────────────────────
# อุปกรณ์ → ผู้ทำ PM (ใช้ตอนวางแผน)
# ──────────────────────────────────────────────────────────────────

def items_by_party(items: list[dict]) -> dict[str, tuple[str, list[str], list[str]]]:
    """
    อุปกรณ์ในแผน → {ผู้ทำ PM ตัวพิมพ์เล็ก: (ชื่อ, [SN ตู้ ...], [ส่วนระดับสถานี ...])}
    นับเฉพาะอุปกรณ์ที่ planner เลือกผู้ทำ PM เป็นคนอื่น (by ไม่ว่าง)
    ผู้ทำ PM ทุกรายในผลได้อย่างน้อย 1 ชิ้นเสมอ — ใบส่งต่อที่สร้างจากผลนี้จึงผูกอุปกรณ์เสมอ
    """
    out: dict[str, tuple[str, list[str], list[str]]] = {}
    for i in items or []:
        by = str(i.get("by") or "").strip()
        sec = _norm(i.get("type"))
        if not by or not sec:
            continue
        if sec == CHARGER_SECTION:
            sn = str(i.get("sn") or "").strip()
            if sn:
                out.setdefault(by.lower(), (by, [], []))[1].append(sn)
        else:
            out.setdefault(by.lower(), (by, [], []))[2].append(sec)
    return out


# ──────────────────────────────────────────────────────────────────
# ใครเป็นเจ้าของส่วนไหน
# ──────────────────────────────────────────────────────────────────

def scoped_items(wo: dict | None) -> dict[str, str]:
    """item_key → ผู้ทำ PM ที่ไม่ใช่ทีมต้นทาง (ส่วนที่ไม่อยู่ในผล = ทีมต้นทาง)"""
    out: dict[str, str] = {}
    # ใบส่งต่อที่ผูกอุปกรณ์ไว้ (ข้อมูลรุ่นก่อนที่ยังไม่มี by รายชิ้น)
    for v in (wo or {}).get("vendor_plans") or []:
        name = str(v.get("vendor") or "").strip()
        for sn in v.get("chargers") or []:
            if str(sn or "").strip():
                out[item_key(CHARGER_SECTION, sn)] = name
        for sec in v.get("sections") or []:
            if _norm(sec):
                out[item_key(sec)] = name
    for _key, (name, sns, secs) in items_by_party((wo or {}).get("selected_equipment") or []).items():
        for sn in sns:
            out[item_key(CHARGER_SECTION, sn)] = name
        for sec in secs:
            out[item_key(sec)] = name
    return out


def user_party(wo: dict | None, username: str, company: str) -> Optional[str]:
    """
    ผู้ทำ PM รายที่ผู้ใช้คนนี้สังกัด — ชื่อบริษัทตรงกับผู้ทำ PM ของตู้ไหนสักตู้
    หรืออยู่ในทีมที่ vendor รายนั้นมอบหมาย (แผนรอบ 2) ไม่ใช่ใครเลย = None (ทีมต้นทาง)
    """
    u, c = _norm(username), _norm(company)
    parties = {_norm(p): p for p in scoped_items(wo).values()}
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


def is_participant(wo: dict | None, role: str, username: str, company: str) -> bool:
    """
    ผู้ใช้คนนี้มีงานในใบงานนี้ไหม — ไม่มี = เปิด/เริ่ม PM/กรอกไม่ได้ (ดูได้อย่างเดียว)

    ปัญหาเดิม (2026-10-22): ใครที่ไม่ใช่ vendor ในใบถูกนับเป็น "ทีมต้นทาง" หมด
    → planner EDS เห็นสถานีที่มีตู้ของ EDS แล้วกด "เริ่ม PM" ใบที่ planner EGAT ให้ EGAT ทำเองทั้งหมดได้
    (และการกดนั้นถูกจดเป็นการเริ่มงานของฝ่าย EGAT)

    มีงาน = admin / owner | company เดียวกับ planner ต้นทาง | ผู้ทำ PM ที่ได้รับอุปกรณ์ / มีใบส่งต่อ /
    อยู่ในทีมที่ vendor มอบหมาย | ถูกติ๊กเป็นผู้รับผิดชอบของแผนต้นทาง (ชื่อผู้ใช้ หรือชื่อบริษัท outsource)
    ใบที่ไม่ได้ผูกใบงาน / ใบงานรุ่นก่อนที่ไม่มี planner_company = ไม่จำกัด (บอกไม่ได้ว่าใครเป็นทีมต้นทาง)
    """
    if _norm(role) in BYPASS_ROLES:
        return True
    origin = _norm((wo or {}).get("planner_company"))
    if not wo or not origin:
        return True
    u, c = _norm(username), _norm(company)
    if c and c == origin:
        return True
    if user_party(wo, username, company) is not None:
        return True
    ticked = {_norm(a) for a in (wo.get("assignees") or [])}
    ticked.discard("")
    return bool((u and u in ticked) or (c and c in ticked))


def not_participant_detail(wo: dict | None, company: str) -> str:
    origin = str((wo or {}).get("planner_company") or "").strip() or "planner ต้นทาง"
    who = (company or "").strip() or "คุณ"
    return f"ใบงานนี้ {origin} ไม่ได้มอบหมายงานให้ {who} — ดูได้อย่างเดียว เริ่ม PM / กรอกไม่ได้"


def section_owner(wo: dict | None, section: str, sn: str = "") -> str:
    """ชื่อบริษัทเจ้าของส่วนนั้น — ผู้ทำ PM ที่รับส่วนนั้น หรือบริษัทของ planner ต้นทาง ("" = ไม่ทราบ)"""
    vendor = scoped_items(wo).get(item_key(section, sn))
    if vendor:
        return vendor
    return str((wo or {}).get("planner_company") or "").strip()


def can_edit_section(wo: dict | None, role: str, username: str, company: str, section: str, sn: str = "") -> bool:
    if _norm(role) in BYPASS_ROLES:
        return True
    # planner ต้นทางดูแลทั้งใบ (ตรวจ/แก้ก่อนอนุมัติได้ทุกส่วน รวมตู้ของ vendor)
    if _norm(role) == "planner" and company and _norm(company) == _norm((wo or {}).get("planner_company")):
        return True
    # คนนอกใบงาน (เช่น EDS ในใบที่ EGAT ทำเองทั้งหมด) — ไม่ได้นับเป็นทีมต้นทางอีกต่อไป
    if not is_participant(wo, role, username, company):
        return False
    scope = scoped_items(wo)
    if not scope:
        return True  # ไม่มีส่วนที่ให้คนอื่นทำ = ทีมต้นทาง/ผู้รับผิดชอบที่ติ๊กไว้กรอกได้ทุกส่วน
    party = user_party(wo, username, company)
    party_of_section = scope.get(item_key(section, sn))
    if party is not None:
        if _norm(party) not in {_norm(p) for p in scope.values()}:
            return True  # ส่งต่อแบบเดิม (ไม่ได้ผูกอุปกรณ์) — ทำได้ทั้งใบ
        return bool(party_of_section) and _norm(party_of_section) == _norm(party)
    return not party_of_section


def annotate_sections(sections: list[dict], wo: dict | None, current: UserClaims, company: str) -> None:
    """เติม owner / editable ให้แถวสถานะของแต่ละส่วน (in-place) — หน้ารวมใช้ล็อกปุ่ม"""
    scoped = bool(scoped_items(wo))
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
            {"_id": 0, "wonum": 1, "vendor_plans": 1, "planner_company": 1, "selected_equipment": 1, "origin": 1,
             "assignees": 1},
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
    และส่วนที่มีคนอื่นกำลังกรอกอยู่ (ล็อกรายส่วน — routers/pm_lock.py)
    ใบเดี่ยวที่ไม่ได้ผูกกับใบแม่ (ไม่มี job_id) ไม่ตรวจ — เหมือนเดิม
    """
    bypass = _norm(current.role) in BYPASS_ROLES
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
    from routers import pm_lock
    try:
        oid = ObjectId(job_id)
    except Exception:
        return
    jobs = get_stationpmjob_collection_for(station_id)
    # มีคนอื่นถือล็อกของส่วนนี้อยู่ = ห้ามเขียนทับ (ใช้กับทุก role — admin ก็ทับงานคนอื่นไม่ได้)
    await pm_lock.assert_free(jobs, {"_id": oid}, pm_lock.section_lock_field(section, sn), current, "ส่วนนี้")
    if bypass:
        return
    try:
        job = await jobs.find_one({"_id": oid}, {"wonum": 1, "work_entries": 1})
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
    # ฟอร์มตู้ชาร์จที่ planner ของ vendor อนุมัติแล้ว (routers/pmreport_station_job.py vendor-approve)
    # ช่างแก้ต่อไม่ได้ — ต้องให้ planner ตีกลับก่อน (planner แก้ก่อนอนุมัติได้เหมือนเดิม)
    if _norm(section) == CHARGER_SECTION and _norm(current.role) != "planner":
        owner = section_owner(wo, section, sn)
        entry = next(
            (e for e in (job or {}).get("work_entries") or []
             if isinstance(e, dict) and _norm(e.get("key")) == _norm(owner)),
            None,
        )
        if entry and entry.get("submitted") and entry.get("vendor_approved"):
            raise HTTPException(
                status_code=409,
                detail=f"ฟอร์มนี้ planner ของ {owner} อนุมัติแล้ว — แก้ไขไม่ได้ จนกว่าจะถูกตีกลับ",
            )
