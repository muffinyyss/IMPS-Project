"""
routers/pmreport_station_job.py
===============================
ใบ PM สถานี "ใบเดียว 2 ส่วนหลัก" — Station / Charger

ที่มา: เดิม 5 ชนิดนี้เป็นคนละเอกสาร คนละเลขที่ คนละ PDF คนละคิวอนุมัติ
ทั้งที่ช่างเข้าสถานีรอบเดียวแล้วตรวจทั้งหมดพร้อมกัน ตอนนี้รวมเป็น
เอกสารใบเดียว (1 เลขที่ / 1 PDF / อนุมัติครั้งเดียว) ที่หน้าเว็บแบ่งเป็น 2 ส่วนหลัก
โดย Station รวมแบบตรวจ Station/MDB/CCB/CB_BOX และ Charger เป็นอีกส่วนหนึ่ง

ส่วน Charger ต่างจาก Station ตรงที่สถานีหนึ่งมีหลายตู้ จึงมีใบย่อยได้หลายใบ
(ตู้ละ 1 ใบ) แต่ยังนับเป็นส่วนหลักเดียว และใช้เลขที่เอกสารใบเดียวกัน

โครงเก็บข้อมูล — ตั้งใจไม่ย้ายเนื้อ checklist ออกจากที่เดิม:
  stationPMJob.<station_id>   ← เอกสารแม่ (เลขที่, วันที่, สถานะรวม, ใบงาน Maximo)
  stationPMReport.<station_id> / MDBPMReport.<...> / CCBPMReport / CBBOXPMReport
                              ← เนื้อ checklist ของแต่ละส่วน (เหมือนเดิมทุกอย่าง)
                                ผูกกลับมาที่แม่ด้วย field job_id
  PMReport.<SN>               ← ส่วน Charger — keyed ด้วย SN ของตู้ ไม่ใช่ station_id
                                ผูกกลับมาที่แม่ด้วย field job_id เหมือนกัน
ผลคือฟอร์มกรอก, การอัปโหลดรูป และ template PDF ของแต่ละส่วนใช้ของเดิมได้ทั้งหมด
ส่วนเลขที่เอกสาร/ชื่อเอกสารให้ลูกทุกใบ "ยืมของแม่" ใบเดียวกัน

PDF: /stationpmjob/{job_id}/pdf — เรนเดอร์ PDF ของแต่ละส่วนด้วย template
เดิม แล้วต่อกันเป็นไฟล์เดียวด้วย pypdf (ส่วน Charger ต่อท้ายทีละตู้)
"""

from __future__ import annotations

import asyncio
import io
import logging
import pathlib
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from config import charger_collection, station_collection
from deps import UserClaims, get_current_user
from routers import pm_flow
from routers.pm_helpers import (
    get_cbboxpmreport_collection_for,
    get_ccbpmreport_collection_for,
    get_mdbpmreport_collection_for,
    get_pmreport_collection_for,
    get_stationpmjob_collection_for,
    get_stationpmreport_collection_for,
    _next_issue_id_no_conflict,
    _next_year_seq,
    get_stationpmurl_coll_upload,
)

log = logging.getLogger("uvicorn.error")

router = APIRouter()

# ฟอร์มจริง 5 ชนิดของใบ PM — ลำดับในหน้าเว็บ (PDF ทั้งใบเรียงตู้ชาร์จก่อน ดู build_job_pdf)
SECTIONS: tuple[str, ...] = ("station", "mdb", "ccb", "cbbox", "charger")

# กลุ่มที่แสดงในหน้าเว็บ — ยุบ MDB/CCB/CB_BOX เข้าใต้ Station
SECTION_GROUPS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("station", ("station", "mdb", "ccb", "cbbox")),
    ("charger", ("charger",)),
)

# ส่วนที่ผูกกับตู้ (keyed ด้วย SN) ไม่ใช่กับสถานี — มีใบย่อยได้หลายใบในส่วนเดียว
CHARGER_SECTION = "charger"
# ลำดับส่วนในเล่ม PDF ทั้งใบ (ต่างจาก SECTIONS ที่หน้าเว็บใช้)
PDF_SECTION_ORDER: dict[str, int] = {"charger": 0, "station": 1, "cbbox": 2, "mdb": 3, "ccb": 4}

SECTION_LABELS: dict[str, dict[str, str]] = {
    "station": {"th": "Station", "en": "Station"},
    "mdb": {"th": "MDB", "en": "MDB"},
    "ccb": {"th": "CCB", "en": "CCB"},
    "cbbox": {"th": "CB_BOX", "en": "CB_BOX"},
    "charger": {"th": "ตู้ชาร์จ", "en": "Charger"},
}

# ชนิดส่วน → template PDF ของ /pdf/{kind}/{id}/export เดิม
SECTION_PDF_KIND: dict[str, str] = {
    "station": "station",
    "mdb": "mdb",
    "ccb": "ccb",
    "cbbox": "cbbox",
    "charger": "charger",
}

JobStatus = Literal["draft", "Wait for approve", "Closed"]


def section_collection(section: str, station_id: str, sn: str = ""):
    """
    collection ที่เก็บเนื้อ checklist ของส่วนนั้น (ของเดิม ไม่ได้ย้าย)

    ส่วน charger แยกเป็นรายตู้ จึงต้องส่ง sn มาด้วย — อีก 4 ส่วนใช้ station_id
    """
    if section == CHARGER_SECTION:
        sn = (sn or "").strip()
        if not sn:
            raise HTTPException(status_code=400, detail="ส่วน charger ต้องระบุ SN ของตู้")
        return get_pmreport_collection_for(sn)
    getter = {
        "station": get_stationpmreport_collection_for,
        "mdb": get_mdbpmreport_collection_for,
        "ccb": get_ccbpmreport_collection_for,
        "cbbox": get_cbboxpmreport_collection_for,
    }.get(section)
    if not getter:
        raise HTTPException(status_code=400, detail=f"ส่วนของเอกสารไม่ถูกต้อง: {section}")
    return getter(station_id)


def section_scope_filter(section: str, station_id: str, sn: str = "") -> dict:
    """filter ที่จำกัดขอบเขตใบลูกของส่วนนั้น — ใช้ตอน approve/reject"""
    if section == CHARGER_SECTION:
        return {"sn": (sn or "").strip()}
    return {"station_id": station_id}


def station_chargers(station_id: str) -> list[dict]:
    """
    ตู้ชาร์จทั้งหมดของสถานี — เรียงตามหมายเลขตู้ ลำดับส่วนในใบจะได้ไม่สลับไปมา

    อ่านไม่ได้ = ไม่โชว์ใบย่อยของส่วน charger ส่วนอื่นยังใช้งานได้ตามปกติ
    """
    try:
        docs = list(charger_collection.find(
            {"station_id": station_id},
            {"_id": 0, "SN": 1, "chargerNo": 1, "chargerType": 1, "brand": 1, "model": 1},
        ))
    except Exception as e:
        log.warning(f"  ⚠️ อ่านรายชื่อตู้ชาร์จของสถานี {station_id} ไม่สำเร็จ: {e}")
        return []
    out = [d for d in docs if str(d.get("SN") or "").strip() not in ("", "-")]
    out.sort(key=lambda d: (str(d.get("chargerNo") or "~"), str(d.get("SN") or "")))
    return out


def _norm_status(raw: Any) -> str:
    """สถานะของใบลูก — ใบเก่าไม่มี status ถือว่าปิดแล้ว (เหมือน pm_flow.list_fields)"""
    s = str(raw or "").strip()
    if not s:
        return pm_flow.PM_LEGACY_CLOSED_STATUS
    return s


def _is_closed(status: str) -> bool:
    return str(status).strip().lower() in pm_flow.PM_CLOSED_STATUSES


def _is_wait(status: str) -> bool:
    return str(status).strip().lower() == pm_flow.PM_STATUS_WAIT_APPROVE.lower()


SectionKey = tuple[str, str]


def section_key(section: str, sn: str = "") -> SectionKey:
    """ตัวระบุใบลูก 1 ใบในใบแม่ — ส่วน charger แยกรายตู้ด้วย SN อีก 4 ส่วนมีใบเดียว"""
    return (section, (sn or "").strip() if section == CHARGER_SECTION else "")


def planned_section_keys(wo: dict | None) -> set[SectionKey] | None:
    """
    อุปกรณ์ที่ planner เลือกไว้ในแผนของใบงาน → ส่วนในใบที่ต้องกรอก
    type ของ selected_equipment ใช้ชื่อชุดเดียวกับ SECTIONS อยู่แล้ว
    ไม่มีแผน = None (ถือว่าต้องครบทุกส่วน)
    """
    keys: set[SectionKey] = set()
    for item in (wo or {}).get("selected_equipment") or []:
        t = str(item.get("type") or "").strip().lower()
        if t not in SECTIONS:
            continue
        if t == CHARGER_SECTION:
            sn = str(item.get("sn") or "").strip()
            if sn:
                keys.add(section_key(t, sn))
        else:
            keys.add(section_key(t))
    return keys or None


async def planned_keys_by_wonum(wonums: list[str]) -> dict[str, set[SectionKey] | None]:
    """แผนของใบงานหลายใบในครั้งเดียว — หน้าตารางไม่ต้องถาม DB ทีละใบ"""
    from config import client

    wanted = sorted({(w or "").strip() for w in wonums} - {""})
    if not wanted:
        return {}
    out: dict[str, set[SectionKey] | None] = {}
    try:
        cursor = client["iMPS"]["maximo_pm_open"].find(
            {"wonum": {"$in": wanted}}, {"_id": 0, "wonum": 1, "selected_equipment": 1}
        )
        async for wo in cursor:
            out[str(wo.get("wonum") or "")] = planned_section_keys(wo)
    except Exception as e:
        log.warning(f"  ⚠️ อ่านแผนของใบงาน {wanted} ไม่สำเร็จ: {e}")
    return out


async def job_planned_keys(job: dict) -> set[SectionKey] | None:
    wonum = str(job.get("wonum") or "").strip()
    if not wonum:
        return None
    return (await planned_keys_by_wonum([wonum])).get(wonum)


def _sent(s: dict) -> bool:
    """ส่วนที่ "ส่งแล้ว" = ช่างกดส่งจากฟอร์ม (Wait for approve) หรือปิดแล้ว"""
    st = _norm_status(s.get("status"))
    return bool(s.get("report_id")) and (_is_wait(st) or _is_closed(st))


def _needed_keys(section_states: list[dict], required: set[SectionKey] | None) -> set[SectionKey]:
    """ส่วนที่ต้องกรอกตามแผน — ไม่มีแผน / แผนไม่ตรงกับส่วนที่สถานีมีเลย = ทุกส่วนของใบ"""
    present = {section_key(s["section"], s.get("sn") or "") for s in section_states}
    need = (required & present) if required else set()
    return need or present


def _mark_plan(section_states: list[dict], required: set[SectionKey] | None) -> None:
    """เติม in_plan / sent ให้แถวสถานะ (in-place) — ใช้แบ่งว่าแต่ละฝ่ายต้องส่งส่วนไหน"""
    need = _needed_keys(section_states, required)
    for s in section_states:
        s["in_plan"] = section_key(s["section"], s.get("sn") or "") in need or bool(s.get("report_id"))
        s["sent"] = _sent(s)


def job_progress(
    section_states: list[dict],
    required: set[SectionKey] | None = None,
    submitted: bool = False,
) -> dict:
    """
    สถานะของใบแม่ + ใบพร้อมให้ช่างกด "ปิดใบงาน" หรือยัง

      ปิดครบทุกส่วนที่กรอก (planner อนุมัติทั้งใบแล้ว)          → Closed
      ช่างกด "ปิดใบงาน" แล้ว และส่งครบทุกส่วนในแผน           → Wait for approve
      นอกนั้น (ยังไม่ครบ / มีส่วนที่ยังแก้อยู่ / ครบแต่ยังไม่กด)  → draft (In Progress)

    ส่วนที่ "ส่งแล้ว" = ใบลูกที่ช่างกดส่งจากฟอร์ม (Wait for approve) หรือปิดแล้ว
    ส่วนที่บันทึกไว้แต่ยังเป็น draft (เช่นโดนตีกลับ) ยังไม่นับ

    required = ส่วนที่ planner เลือกไว้ในแผน (planned_section_keys)
    ไม่มีแผน หรือแผนไม่ตรงกับส่วนที่สถานีมีเลย → ต้องครบทุกส่วนของใบ
    ส่วนนอกแผนไม่ต้องรอ แต่ถ้ากรอกไว้แล้วก็ต้องส่งให้เรียบร้อยก่อน

    ส่วนที่ช่างกด N/A (ไม่มีอุปกรณ์นี้ / ไม่ต้องตรวจรอบนี้) ไม่ต้องกรอก — ไม่นับเป็นส่วนที่ขาด

    Returns: {"status", "ready_to_submit", "missing": [state ของส่วนที่ยังขาด]}
    """
    filled = [s for s in section_states if s.get("report_id")]
    statuses = [_norm_status(s.get("status")) for s in filled]
    # ปิดหมดแล้ว = อนุมัติไปแล้ว — ใบที่อนุมัติไว้ก่อนมีกติกาครบแผนก็ยังเป็น Closed
    if filled and all(_is_closed(x) for x in statuses):
        return {"status": pm_flow.PM_STATUS_CLOSED, "ready_to_submit": False, "missing": []}

    need = _needed_keys(section_states, required)
    missing = [
        s for s in section_states
        if not s.get("na") and not _sent(s)
        and (section_key(s["section"], s.get("sn") or "") in need or s.get("report_id"))
    ]

    if not missing and filled and submitted:
        return {"status": pm_flow.PM_STATUS_WAIT_APPROVE, "ready_to_submit": False, "missing": []}
    return {
        "status": pm_flow.PM_STATUS_DRAFT,
        "ready_to_submit": bool(filled) and not missing,
        "missing": missing,
    }


def derive_job_status(
    section_states: list[dict],
    required: set[SectionKey] | None = None,
    submitted: bool = False,
) -> str:
    return job_progress(section_states, required, submitted)["status"]


def _job_submitted(job: dict) -> bool:
    """ช่างกด "ปิดใบงาน" แล้ว (ตีกลับจะล้างค่านี้ ต้องกดใหม่หลังแก้)"""
    return bool(job.get("submitted_at"))


async def _find_section_report(section: str, station_id: str, sn: str, job_id: str) -> dict | None:
    """ใบลูกของส่วนนั้นในใบแม่ใบนี้ — ไม่มี = ยังไม่ได้กรอก"""
    try:
        coll = section_collection(section, station_id, sn)
        return await coll.find_one(
            {"job_id": job_id},
            {"_id": 1, "status": 1, "side": 1, "inspector": 1, "updatedAt": 1, "summary": 1,
             "reject_remark": 1, "rejected_by": 1},
            sort=[("_id", -1)] if section == CHARGER_SECTION else [("createdAt", -1)],
        )
    except Exception as e:  # collection ยังไม่มี = ยังไม่เคยกรอกส่วนนี้
        log.warning(f"  ⚠️ อ่านส่วน {section}{f'/{sn}' if sn else ''} ของใบ {job_id} ไม่สำเร็จ: {e}")
        return None


def _state_row(
    section: str, label: dict, doc: dict | None, sn: str = "", charger_no: str = "", na: bool = False,
) -> dict:
    return {
        "section": section,
        "label": label,
        "sn": sn,
        "charger_no": charger_no,
        "report_id": str(doc["_id"]) if doc else "",
        "status": _norm_status(doc.get("status")) if doc else "",
        "side": (doc or {}).get("side") or "",
        "inspector": (doc or {}).get("inspector") or "",
        # เหตุผลที่ planner ตีกลับส่วนนี้ — ล้างเองเมื่อช่างส่งฟอร์มใหม่ (pm_flow.finalize)
        "reject_remark": (doc or {}).get("reject_remark") or "",
        "rejected_by": (doc or {}).get("rejected_by") or "",
        # N/A ได้เฉพาะส่วนที่ยังไม่มีเอกสาร — กรอกไปแล้วถือว่าไม่ใช่ N/A
        "na": bool(na and not doc),
    }


def _na_keys(job: dict) -> set[SectionKey]:
    """ส่วนที่ช่างกด N/A ไว้ในใบนี้"""
    return {
        section_key(str(x.get("section") or ""), str(x.get("sn") or ""))
        for x in job.get("na_sections") or []
    }


async def _section_states(job: dict, chargers: list[dict] | None = None) -> list[dict]:
    """
    สถานะของทุกส่วนในใบนี้ — อ่านจากใบลูกจริง ไม่ได้เชื่อค่าที่ cache ไว้

    ส่วน charger คืนมาหลายแถว (ตู้ละแถว) ฝั่งหน้าเว็บจับกลุ่มด้วย field section
    สถานีที่ยังไม่มีตู้ในระบบจะไม่มีแถวของส่วนนี้เลย

    chargers ส่งมาได้ถ้าผู้เรียกดึงรายชื่อตู้ไว้แล้ว (หน้าตารางวนหลายใบของสถานี
    เดียวกัน ไม่ต้องถาม DB ซ้ำทุกใบ)
    """
    station_id = str(job.get("station_id") or "")
    job_id = str(job.get("_id"))
    if chargers is None:
        chargers = station_chargers(station_id)
    na_keys = _na_keys(job)
    out: list[dict] = []
    for section in SECTIONS:
        if section == CHARGER_SECTION:
            for ch in chargers:
                sn = str(ch.get("SN") or "").strip()
                no = str(ch.get("chargerNo") or "").strip()
                doc = await _find_section_report(section, station_id, sn, job_id)
                label = {
                    "th": f"ตู้ชาร์จ {no}" if no else sn,
                    "en": f"Charger {no}" if no else sn,
                }
                out.append(_state_row(
                    section, label, doc, sn=sn, charger_no=no, na=section_key(section, sn) in na_keys,
                ))
            continue
        doc = await _find_section_report(section, station_id, "", job_id)
        out.append(_state_row(section, SECTION_LABELS[section], doc, na=section_key(section) in na_keys))
    return out


def _sections_done(sections: list[dict]) -> int:
    """
    นับ "ส่วนหลักที่กรอกแล้ว" เต็มที่ 2: Station และ Charger

    Station ต้องครบ Station/MDB/CCB/CB_BOX ส่วน Charger ต้องครบทุกตู้ของสถานี
    """
    done = 0
    for _group, member_sections in SECTION_GROUPS:
        rows = [s for s in sections if s.get("section") in member_sections]
        has_every_member = all(
            any(s.get("section") == member for s in rows)
            for member in member_sections
        )
        if has_every_member and rows and all(s.get("report_id") or s.get("na") for s in rows):
            done += 1
    return done


def _iso(v: Any) -> str:
    return v.isoformat() if isinstance(v, datetime) else (v or "")


def _serialize_job(job: dict, sections: list[dict], required: set[SectionKey] | None = None) -> dict:
    from routers import pm_lock

    _mark_plan(sections, required)
    # ใครกำลังกรอกส่วนไหนอยู่ (ล็อกรายส่วนที่ยังไม่หมดอายุ) — หน้ารวมโชว์ชื่อบนปุ่มของส่วนนั้น
    locks = pm_lock.active_locks(job)
    for s in sections:
        key = pm_lock.section_lock_field(s["section"], s.get("sn") or "")[len("locks."):]
        s["locked_by"] = locks.get(key, "")
    progress = job_progress(sections, required, _job_submitted(job))
    status = progress["status"]
    done = _sections_done(sections)
    return {
        "id": str(job.get("_id")),
        "station_id": job.get("station_id") or "",
        "station_name": job.get("station_name") or "",
        "issue_id": job.get("issue_id") or "",
        "doc_name": job.get("doc_name") or "",
        "pm_date": job.get("pm_date") or "",
        "wonum": job.get("wonum") or "",
        "inspector": job.get("inspector") or "",
        "status": status,
        "sections": sections,
        "sections_done": done,
        "sections_total": len(SECTION_GROUPS),
        "approved_by": job.get("approved_by") or "",
        "approved_at": job.get("approved_at").isoformat() if isinstance(job.get("approved_at"), datetime) else (job.get("approved_at") or ""),
        "reject_remark": job.get("reject_remark") or "",
        "createdAt": job.get("createdAt").isoformat() if isinstance(job.get("createdAt"), datetime) else (job.get("createdAt") or ""),
        # ปุ่ม "ปิดใบงาน" — กดได้เมื่อส่งครบทุกส่วนในแผนแล้ว ไม่ครบก็บอกว่าขาดส่วนไหน
        "ready_to_submit": progress["ready_to_submit"],
        "missing": [s.get("label") or {"th": s["section"], "en": s["section"]} for s in progress["missing"]],
        "submitted_by": job.get("submitted_by") or "",
        "submitted_at": _iso(job.get("submitted_at")),
        "work_start": job.get("work_start") or "",
        "work_finish": job.get("work_finish") or "",
        "maximo_labor": job.get("maximo_labor") or [],
        "maximo_contractor": job.get("maximo_contractor") or "",
        "imps_labor": job.get("imps_labor") or [],
        # ผลการยิงชุดปิดงานเข้า Maximo (IN03 / IN09 / IN02) — มีเฉพาะใบงานที่ Maximo เปิดมา
        "maximo_sync": _serialize_maximo_sync(job),
        # เวลาทำงาน + ผู้ลงเวลาที่แต่ละฝ่ายส่ง (ใบที่แบ่งงาน EGAT / vendor / outsource ส่งแยกกัน)
        "work_entries": [_serialize_entry(e) for e in job.get("work_entries") or [] if isinstance(e, dict)],
        # ฝ่ายที่กด "เริ่ม PM" แล้ว — None = ใบรุ่นก่อนมีการเริ่มรายฝ่าย (_with_ownership ใช้ตัดสิน)
        "party_starts": _serialize_starts(job),
    }


def _serialize_starts(job: dict) -> list[dict] | None:
    starts = job.get("party_starts")
    if not isinstance(starts, list):
        return None
    return [
        {"key": e.get("key") or "", "party": e.get("party") or "", "by": e.get("by") or "", "at": _iso(e.get("at"))}
        for e in starts if isinstance(e, dict)
    ]


def _serialize_entry(e: dict) -> dict:
    mx = e.get("maximo") or {}
    return {
        "key": e.get("key") or "",
        "party": e.get("party") or "",
        "work_start": e.get("work_start") or "",
        "work_finish": e.get("work_finish") or "",
        "maximo_labor": e.get("maximo_labor") or [],
        "maximo_contractor": e.get("maximo_contractor") or "",
        "imps_labor": e.get("imps_labor") or [],
        "submitted": bool(e.get("submitted")),
        "submitted_by": e.get("submitted_by") or "",
        "submitted_at": _iso(e.get("submitted_at")),
        "vendor_approved": bool(e.get("vendor_approved")),
        "vendor_approved_by": e.get("vendor_approved_by") or "",
        "vendor_approved_at": _iso(e.get("vendor_approved_at")),
        **({"maximo": {"ok": bool(mx.get("ok")), "sent_codes": mx.get("sent_codes") or [],
                       "errors": [str(x)[:200] for x in mx.get("errors") or []]}} if mx else {}),
    }


def _serialize_maximo_sync(job: dict) -> dict:
    """maximo_sync ของใบ → JSON — ตัด request/response ดิบออก (หน้าเว็บใช้แค่ผ่าน/ไม่ผ่าน)"""
    out: dict = {}
    for key, entry in (job.get("maximo_sync") or {}).items():
        if not isinstance(entry, dict):
            continue
        out[key] = {
            "ok": bool(entry.get("ok")),
            "at": _iso(entry.get("at")),
            **({"status": entry["status"]} if entry.get("status") else {}),
            **({"error": str(entry.get("error"))[:300]} if entry.get("error") else {}),
            **({"errors": [str(x)[:200] for x in entry.get("errors") or []]} if entry.get("errors") else {}),
        }
    return out


# ══════════════════════════════════════════════════════════════════
# ฝ่ายที่ต้องส่งงานในใบ — แบ่งตามผู้ทำ PM ที่ planner เลือก (routers/pm_scope.py)
#   ใบที่ไม่ได้แบ่งงาน = ฝ่ายเดียว (ทีมต้นทาง) ปิดใบงานครั้งเดียวเหมือนเดิม
#   ใบที่แบ่งงาน = แต่ละฝ่ายกด "ส่งงาน" ของตัวเอง พร้อมเวลาทำงาน + ผู้ลงเวลาของฝ่ายนั้น
#   ครบทุกฝ่าย → Wait for approve → อนุมัติ → IN09 ลงเวลาแยกต่อฝ่าย
# ══════════════════════════════════════════════════════════════════

def _pkey(name: str) -> str:
    return (name or "").strip().lower()


def job_parties(sections: list[dict], wo: dict | None) -> dict[str, dict]:
    """
    {key: {"name", "states": [แถวสถานะ]}} — นับเฉพาะส่วนในแผน (หรือที่กรอกแล้ว) ที่ไม่ใช่ N/A
    ต้องผ่าน _mark_plan มาก่อน (ใช้ in_plan / sent)
    """
    from routers import pm_scope

    out: dict[str, dict] = {}
    for s in sections:
        if s.get("na") or not s.get("in_plan"):
            continue
        name = pm_scope.section_owner(wo, s["section"], s.get("sn") or "")
        out.setdefault(_pkey(name), {"name": name, "states": []})["states"].append(s)
    return out


def user_party_key(wo: dict | None, current: UserClaims, company: str) -> str:
    """
    ฝ่ายของผู้ใช้คนนี้ในใบ — ผู้ทำ PM ที่ได้รับตู้ / ทีมต้นทาง (บริษัทของ planner)
    คนนอกใบงาน (pm_scope.is_participant) = "" — ไม่ถูกนับเป็นทีมต้นทาง (เดิม planner EDS กดเริ่ม PM
    ใบที่ EGAT ทำเองทั้งหมดได้ และถูกจดเป็นการเริ่มของฝ่าย EGAT)
    """
    from routers import pm_scope

    if not pm_scope.is_participant(wo, current.role, current.username or current.sub, company):
        return ""
    if pm_scope.scoped_items(wo):
        party = pm_scope.user_party(wo, current.username or current.sub, company)
        if party:
            return _pkey(party)
    return _pkey((wo or {}).get("planner_company") or "")


# ══════════════════════════════════════════════════════════════════
# เริ่ม PM รายฝ่าย (2026-10-22)
#   เดิมมีแค่คนแรกที่กด "เริ่ม PM" (ปกติช่างทีมต้นทาง) ที่ได้ผ่านหน้าใบงาน — ใบ PM สถานีเปิดแล้ว
#   ช่างฝ่ายอื่น (เช่น EDS) กดจาก PM List ก็เด้งเข้าหน้ารวมเลย ไม่มีปุ่มเริ่มงานของตัวเอง
#   และเวลาเริ่มตั้งต้นตอนส่งงานก็ยืมเวลาที่ทีมต้นทางรับงาน
#   ตอนนี้: แต่ละฝ่ายกด "เริ่ม PM" ของตัวเอง → stationPMJob.party_starts[] = {key, party, by, at}
# ══════════════════════════════════════════════════════════════════

def party_started(
    job_out: dict, key: str, party: dict, n_parties: int, origin_key: str, entries: list[dict]
) -> dict | None:
    """
    เวลาที่ฝ่ายนี้กดเริ่ม PM {"by", "at"} — None = ยังไม่เริ่ม
    ใบรุ่นก่อน (ไม่มี party_starts): ทีมต้นทาง / ใบฝ่ายเดียว ถือว่าเริ่มตอนเปิดใบ
    ฝ่ายที่บันทึกส่วนของตัวเองหรือส่งงานไปแล้ว ถือว่าเริ่มแล้ว (ใบที่ทำค้างไว้ก่อนมีปุ่มนี้)
    """
    starts = job_out.get("party_starts")
    hit = next((e for e in starts or [] if e.get("key") == key), None)
    if hit:
        return {"by": hit.get("by") or "", "at": hit.get("at") or ""}
    if starts is None and (key == origin_key or n_parties <= 1):
        return {"by": "", "at": job_out.get("createdAt") or ""}
    if any(s.get("report_id") for s in party["states"]) or any(e.get("key") == key for e in entries):
        return {"by": "", "at": ""}
    return None


async def _record_party_start(jobs, job: dict, current: UserClaims) -> None:
    """จดว่าฝ่ายของคนที่กด "เริ่ม PM" เริ่มงานแล้ว — กดซ้ำ/ฝ่ายเดิมกดอีกคนไม่ทับเวลาแรก"""
    from routers import pm_scope

    wonum = str(job.get("wonum") or "").strip()
    wo = (await pm_scope.wos_by_wonum([wonum])).get(wonum) if wonum else None
    key = user_party_key(wo, current, pm_scope.company_of(current))
    if not key:
        return  # คนนอกใบงาน / admin ที่ไม่มีฝ่าย — ไม่จดเป็นการเริ่มของฝ่ายไหน
    if any(isinstance(e, dict) and e.get("key") == key for e in job.get("party_starts") or []):
        return
    party = pm_scope.user_party(wo, current.username or current.sub, pm_scope.company_of(current)) \
        if pm_scope.scoped_items(wo) else None
    entry = {
        "key": key,
        "party": party or str((wo or {}).get("planner_company") or "").strip(),
        "by": current.username or current.sub,
        "at": datetime.now(timezone.utc),
    }
    if not isinstance(job.get("party_starts"), list):
        # ใบรุ่นก่อน: ฝ่ายที่ถือว่าเริ่มตอนเปิดใบ (ทีมต้นทาง / ใบฝ่ายเดียว) ต้องจดไว้ก่อน
        # ไม่งั้นพอมี party_starts แล้ว ฝ่ายนั้นจะกลายเป็น "ยังไม่เริ่ม"
        sections = await _section_states(job)
        _mark_plan(sections, await job_planned_keys(job))
        parties = job_parties(sections, wo)
        origin_key = _pkey((wo or {}).get("planner_company") or "")
        seed = [
            {"key": k, "party": p["name"], "by": job.get("created_by") or "", "at": job.get("createdAt")}
            for k, p in parties.items()
            if k != key and (k == origin_key or len(parties) <= 1)
        ]
        res = await jobs.update_one(
            {"_id": job["_id"], "party_starts": {"$exists": False}},
            {"$set": {"party_starts": seed + [entry]}},
        )
        if res.modified_count:
            job["party_starts"] = seed + [entry]
            return
        job["party_starts"] = (await jobs.find_one({"_id": job["_id"]}, {"party_starts": 1}) or {}).get("party_starts") or []
    # key อาจมีจุด (ชื่อบริษัท) จึงเก็บเป็น array แทน sub-document; กันซ้ำด้วย $ne ตอนเขียน
    res = await jobs.update_one(
        {"_id": job["_id"], "party_starts.key": {"$ne": key}},
        {"$push": {"party_starts": entry}},
    )
    if res.modified_count and not any(e.get("key") == key for e in job["party_starts"] if isinstance(e, dict)):
        job["party_starts"].append(entry)


async def wo_party_started(station_id: str, wonum: str, party: str) -> bool | None:
    """
    ฝ่ายนี้ (เช่น vendor EDS) กด "เริ่ม PM" ในใบ PM สถานีของใบงานนี้แล้วหรือยัง
    — หน้าวางแผนใช้ตัดสินว่า planner ของ vendor ยังแก้แผนของบริษัทตัวเองได้ไหม
    (ทีมต้นทางเปิดใบไปก่อน ไม่ได้แปลว่าทีมของ vendor เริ่มงานแล้ว)
    None = ยังไม่มีใบ PM สถานีของใบงานนี้ (ให้คนเรียกตัดสินเอง); ใบที่ส่งงานไปแล้ว = ถือว่าเริ่มแล้ว
    """
    station_id = (station_id or "").strip()
    wonum = (wonum or "").strip()
    key = _pkey(party)
    if not station_id or not wonum or not key:
        return None
    job = await get_stationpmjob_collection_for(station_id).find_one({"wonum": wonum})
    if not job:
        return None
    if _job_submitted(job):
        return True
    if any(isinstance(e, dict) and e.get("key") == key for e in job.get("party_starts") or []):
        return True
    sections = await _section_states(job)
    _mark_plan(sections, await job_planned_keys(job))
    wo = await _job_wo(job)
    parties = job_parties(sections, wo)
    p = parties.get(key)
    if p is None:
        # ไม่มีส่วนของฝ่ายนี้ในใบ (เช่น N/A หมด) — นับจากที่จดไว้เท่านั้น
        return False
    origin_key = _pkey((wo or {}).get("planner_company") or "")
    entries = job.get("work_entries") or []
    return party_started(job, key, p, len(parties), origin_key, entries) is not None


def _party_done(key: str, party: dict, entries: list[dict]) -> bool:
    """ฝ่ายนี้ส่งงานแล้ว = มี work_entry ที่ส่งแล้ว และทุกส่วนของฝ่ายยังอยู่ในสถานะส่งแล้ว"""
    entry = next((e for e in entries if e.get("key") == key), None)
    return bool(entry and entry.get("submitted")) and all(s.get("sent") for s in party["states"])


# ══════════════════════════════════════════════════════════════════
# อนุมัติชั้นแรกโดย planner ของ vendor — เฉพาะฟอร์มตู้ชาร์จ (ตัดสินใจ 2026-10-21)
#   ตู้ที่มอบให้ vendor ที่มี planner ของตัวเอง (มีใบส่งต่อใน vendor_plans เช่น EDS)
#   ฝ่าย vendor ส่งงาน → planner ของ vendor ตรวจ (ตีกลับรายฟอร์มได้) แล้วกด "อนุมัติงานของ <vendor>"
#   ครั้งเดียวทั้งฝ่าย → ค่อยนับว่าฝ่ายนั้นส่งครบ → ครบทุกฝ่าย = Wait for approve ให้ planner ต้นทาง
#   ตีกลับฟอร์มของฝ่ายนั้นทีหลัง (ใครตีก็ตาม) / ฝ่ายส่งงานใหม่ = ต้องผ่าน planner ของ vendor อีกรอบ
#   ส่วนระดับสถานี (Station/MDB/CCB/CB_BOX) และ outsource (ไม่มี planner) ไป planner ต้นทางตรงเหมือนเดิม
#   ผลเก็บที่ work_entries ของฝ่ายนั้น: vendor_approved / vendor_approved_by / vendor_approved_at
# ══════════════════════════════════════════════════════════════════

def review_vendors(wo: dict | None) -> dict[str, str]:
    """vendor ที่มี planner ของตัวเองในใบงานนี้ {key: ชื่อ} — ไม่นับบริษัทของ planner ต้นทาง"""
    origin = _pkey((wo or {}).get("planner_company") or "")
    out: dict[str, str] = {}
    for v in (wo or {}).get("vendor_plans") or []:
        name = str(v.get("vendor") or "").strip()
        if name and _pkey(name) != origin:
            out[_pkey(name)] = name
    return out


def party_needs_vendor_review(key: str, party: dict, wo: dict | None) -> bool:
    """ฝ่ายนี้เป็น vendor ที่มี planner และมีฟอร์มตู้ชาร์จในแผน (ไม่ N/A)"""
    return key in review_vendors(wo) and any(s.get("section") == CHARGER_SECTION for s in party["states"])


def vendor_review_state(key: str, party: dict, entries: list[dict], wo: dict | None) -> str:
    """
    "" = ไม่ต้องผ่าน planner ของ vendor | "waiting" = ฝ่ายยังไม่ได้ส่งงาน (หรือมีฟอร์มโดนตีกลับ)
    "pending" = รอ planner ของ vendor อนุมัติ | "approved" = planner ของ vendor อนุมัติแล้ว
    """
    if not party_needs_vendor_review(key, party, wo):
        return ""
    if not _party_done(key, party, entries):
        return "waiting"
    entry = next((e for e in entries if e.get("key") == key), None) or {}
    return "approved" if entry.get("vendor_approved") else "pending"


def _party_cleared(key: str, party: dict, entries: list[dict], wo: dict | None) -> bool:
    """ฝ่ายนี้พร้อมให้ planner ต้นทางอนุมัติ = ส่งงานแล้ว และผ่าน planner ของ vendor แล้ว (ถ้าต้องผ่าน)"""
    return _party_done(key, party, entries) and vendor_review_state(key, party, entries, wo) in ("", "approved")


def vendor_reviewer_key(wo: dict | None, current: UserClaims, company: str) -> str:
    """planner ของ vendor ที่ต้องตรวจฟอร์มตู้ชาร์จของฝ่ายตัวเองในใบนี้ → key ฝ่าย ไม่ใช่ = "" """
    if (current.role or "").strip().lower() != "planner":
        return ""
    key = user_party_key(wo, current, company)
    return key if key in review_vendors(wo) else ""


def is_origin_approver(wo: dict | None, current: UserClaims, company: str) -> bool:
    """อนุมัติ / ตีกลับทั้งใบได้ = admin / planner ที่ไม่ใช่ planner ของ vendor ในใบนี้"""
    if (current.role or "").strip().lower() not in pm_flow.PM_APPROVE_ROLES:
        return False
    return not vendor_reviewer_key(wo, current, company)


# ══════════════════════════════════════════════════════════════════
# สรุปสถานะรายฝ่าย (2026-10-22) — หน้า PM List / หน้ารวมใช้โชว์บรรทัดรอง "รอใคร" ใต้สถานะหลัก
#   สถานะหลักของใบยังเป็นชุดเดิม (In Progress / Wait for approve / Closed) ตรงกับ Maximo
#   state ของฝ่าย: not_started | in_progress | ready (กรอกครบ ยังไม่กดส่งงาน) | rejected (มีฟอร์มโดนตีกลับ)
#                 | vendor_review (รอ planner ของ vendor) | submitted (ส่งครบ พร้อมให้ planner ต้นทาง)
# ══════════════════════════════════════════════════════════════════

def _party_state(
    key: str, party: dict, entries: list[dict], wo: dict | None, started: bool, job_status: str,
) -> str:
    if job_status != pm_flow.PM_STATUS_DRAFT:
        return "submitted"
    if _party_cleared(key, party, entries, wo):
        return "submitted"
    if vendor_review_state(key, party, entries, wo) == "pending":
        return "vendor_review"
    states = party["states"]
    if any(s.get("report_id") and not s.get("sent") and str(s.get("reject_remark") or "").strip() for s in states):
        return "rejected"
    if states and all(s.get("sent") for s in states):
        return "ready"
    if started or any(s.get("report_id") for s in states):
        return "in_progress"
    return "not_started"


def party_summaries(
    sections: list[dict], wo: dict | None, job_out: dict, entries: list[dict], job_status: str,
) -> list[dict]:
    """
    [{key, name, state, done, total}] ของทุกฝ่ายในใบ — sections ต้องผ่าน _mark_plan มาก่อน
    job_out ต้องมี party_starts (None = ใบรุ่นก่อน) / createdAt สำหรับ party_started
    """
    parties = job_parties(sections, wo)
    origin_key = _pkey((wo or {}).get("planner_company") or "")
    out = []
    for key, p in parties.items():
        started = party_started(job_out, key, p, len(parties), origin_key, entries) is not None
        out.append({
            "key": key,
            "name": p["name"],
            "state": _party_state(key, p, entries, wo, started, job_status),
            "done": sum(1 for s in p["states"] if s.get("sent")),
            "total": len(p["states"]),
        })
    return out


async def _job_wo(job: dict) -> dict | None:
    from routers import pm_scope

    wonum = str(job.get("wonum") or "").strip()
    return (await pm_scope.wos_by_wonum([wonum])).get(wonum) if wonum else None


def _assert_origin_approver(wo: dict | None, current: UserClaims) -> None:
    from routers import pm_scope

    pm_flow.assert_approver(current)
    company = pm_scope.company_of(current)
    vendor = vendor_reviewer_key(wo, current, company)
    if vendor:
        name = review_vendors(wo).get(vendor) or company
        raise HTTPException(
            status_code=403,
            detail=f"planner ของ {name} อนุมัติได้เฉพาะงานตู้ชาร์จของ {name} — อนุมัติ/ตีกลับทั้งใบเป็นของ planner ต้นทาง",
        )


async def _with_ownership(jobs: list[dict], current: UserClaims) -> list[dict]:
    """
    เติม owner / editable ให้ทุกส่วนของใบ (in-place) ตามการแบ่งงานกับ vendor
    — ตู้ที่เป็นงานของ vendor (เช่น EDS) ทีมต้นทางกรอกไม่ได้ และกลับกัน (routers/pm_scope.py)
    """
    from routers import pm_scope

    if not jobs:
        return jobs
    wos = await pm_scope.wos_by_wonum(j.get("wonum") or "" for j in jobs)
    company = pm_scope.company_of(current)
    for j in jobs:
        wonum = str(j.get("wonum") or "").strip()
        wo = wos.get(wonum)
        pm_scope.annotate_sections(j.get("sections") or [], wo, current, company)
        # ใบงานที่ Maximo เปิดมา = ปิดงานแล้วยิงเข้า Maximo + ลงเวลาด้วย laborcode
        # ใบงานที่เปิดเองใน iMPS = ไม่ยิงอะไรเข้า Maximo ลงผู้ปฏิบัติงานด้วยบัญชี iMPS
        j["from_maximo"] = bool(wonum) and str((wo or {}).get("origin") or "").strip().lower() != "imps-manual"

        # ฝ่ายที่ต้องส่งงาน + สถานะของแต่ละฝ่าย (หน้ารวมใช้โชว์ปุ่ม "ส่งงานของ ..." และสถานะ)
        parties = job_parties(j.get("sections") or [], wo)
        entries = j.get("work_entries") or []
        for s in j.get("sections") or []:
            s["vendor_review"] = ""
        out_parties = []
        origin_key = _pkey((wo or {}).get("planner_company") or "")
        started: dict[str, dict | None] = {
            key: party_started(j, key, p, len(parties), origin_key, entries) for key, p in parties.items()
        }
        my_key = user_party_key(wo, current, company)
        bypass = (current.role or "").strip().lower() in pm_scope.BYPASS_ROLES
        for key, p in parties.items():
            review = vendor_review_state(key, p, entries, wo)
            entry = next((e for e in entries if e.get("key") == key), None) or {}
            # ฟอร์มตู้ชาร์จของฝ่ายนี้รอ / ผ่าน planner ของ vendor แล้ว — หน้ารวม/ฟอร์มใช้ตัดสินว่าใครตรวจได้
            # ยังไม่ผ่าน planner ของ vendor (waiting / pending) = ฝ่ายอื่น (planner ต้นทาง) ดูได้อย่างเดียว
            # ไม่มีปุ่มแก้ไข จนกว่า planner ของ vendor จะอนุมัติ (2026-10-22) — admin/owner ยังทำแทนได้
            hold = (review in ("waiting", "pending") and key != my_key and not bypass
                    and j.get("status") == pm_flow.PM_STATUS_DRAFT)
            for s in p["states"]:
                if s.get("section") == CHARGER_SECTION:
                    s["vendor_review"] = review
                    if hold:
                        s["editable"] = False
            out_parties.append({
                "key": key,
                "name": p["name"],
                "ready": all(s.get("sent") for s in p["states"]),
                "missing": [s.get("label") or {"th": s["section"], "en": s["section"]}
                            for s in p["states"] if not s.get("sent")],
                "submitted": _party_done(key, p, entries),
                "vendor_review": review,
                "state": _party_state(key, p, entries, wo, started[key] is not None, j.get("status") or ""),
                "done": sum(1 for s in p["states"] if s.get("sent")),
                "total": len(p["states"]),
                "vendor_approved_by": (entry.get("vendor_approved_by") or "") if review == "approved" else "",
                # กด "เริ่ม PM" แล้ว — เวลาเริ่มตั้งต้นตอนส่งงานของฝ่ายนี้
                "started": started[key] is not None,
                "started_at": (started[key] or {}).get("at") or "",
                "started_by": (started[key] or {}).get("by") or "",
            })
        j["parties"] = out_parties
        j["my_party"] = my_key
        # มีงานในใบนี้ไหม — ไม่มี = ดูได้อย่างเดียว (ไม่มีปุ่มเริ่ม PM / ส่งงาน)
        j["participant"] = pm_scope.is_participant(wo, current.role, current.username or current.sub, company)
        # ฝ่ายของคนที่ login ยังไม่ได้กด "เริ่ม PM" — หน้า PM List พาไปหน้าใบงานก่อน / หน้ารวมขึ้นปุ่มให้
        # ไม่มีส่วนของตัวเองในใบ / ใบที่ส่งงานไปแล้ว = ไม่ต้องเริ่ม
        j["my_started"] = (
            j["my_party"] not in started
            or started[j["my_party"]] is not None
            or j.get("status") != pm_flow.PM_STATUS_DRAFT
        )
        j["split"] = len(parties) > 1
        # planner ของ vendor = ตรวจ/อนุมัติเฉพาะฟอร์มตู้ชาร์จของฝ่ายตัวเอง / อนุมัติทั้งใบเป็นของ planner ต้นทาง
        j["vendor_reviewer"] = vendor_reviewer_key(wo, current, company)
        j["can_approve"] = is_origin_approver(wo, current, company)
    return jobs


# ══════════════════════════════════════════════════════════════════
# เปิดใบใหม่ / หาใบเดิมของรอบนั้น
# ══════════════════════════════════════════════════════════════════

class OpenJobIn(BaseModel):
    station_id: str
    pm_date: str                      # YYYY-MM-DD
    wonum: Optional[str] = None
    inspector: Optional[str] = None


# งานเบื้องหลังที่ยิงแล้วไม่รอผล — ต้องเก็บ reference ไว้ ไม่งั้น task โดน GC กลางทาง
_bg_tasks: set = set()


def _in_background(coro) -> None:
    task = asyncio.create_task(coro)
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)


def _start_in_progress(job: dict, who: str) -> None:
    """
    ช่างเปิดใบ PM สถานี = งานเริ่มจริงแล้ว → IN02 INPRG (ถ้ายังไม่เคยยิงผ่าน)

    เดิมยิง INPRG แค่ตอน planner วางแผนเสร็จ และพักไว้ถ้ายังมี vendor ที่ยังไม่วางแผน
    → ทีมเราเริ่มงานไปแล้วแต่ Maximo ยังค้าง APPR และถ้า vendor ไม่วางแผนเลย
    ใบงานจะค้างไปจนปิด (ปิด WO จาก APPR ไม่ผ่าน)
    ยิงเฉพาะใบที่ยังไม่ส่งงาน — ห้ามดึงใบที่รออนุมัติ/ปิดแล้วกลับเป็น INPRG
    sync_in_progress ข้ามใบงานที่เปิดเองใน iMPS และกันยิงซ้ำสถานะเดิมอยู่แล้ว
    ไม่รอผล: Maximo ช้า/ล่มต้องไม่ทำให้ช่างเปิดใบไม่ได้
    """
    wonum = str(job.get("wonum") or "").strip()
    if not wonum or job.get("submitted_at"):
        return
    status = str(job.get("status") or "").strip()
    if status and (_is_closed(status) or _is_wait(status)):
        return
    from services import pm_maximo_out
    _in_background(pm_maximo_out.safe_sync_in_progress(wonum, memo=f"PM started by {who}"))


@router.post("/stationpmjob/open")
async def open_station_pm_job(
    body: OpenJobIn,
    current: UserClaims = Depends(get_current_user),
):
    """
    เปิดใบ PM สถานีของรอบนั้น — มีอยู่แล้วคืนใบเดิม (ไม่ออกเลขซ้ำ)

    ใบ 1 ใบ = 1 สถานี + 1 รอบ PM โดยยึดใบงาน Maximo เป็นหลักถ้ามี
    (ใบงานเดียวกันต้องได้เอกสารใบเดียว แม้ช่างจะกรอกคนละวัน)
    ไม่มีใบงานก็ยึดวันที่ PM แทน
    """
    station_id = (body.station_id or "").strip()
    if not station_id:
        raise HTTPException(status_code=400, detail="station_id is required")

    pm_date = (body.pm_date or "").strip()
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    wonum = (body.wonum or "").strip()
    jobs = get_stationpmjob_collection_for(station_id)

    # คนนอกใบงาน (เช่น planner/ช่าง EDS ในใบที่ planner EGAT ให้ EGAT ทำเองทั้งหมด) เริ่ม PM ไม่ได้
    if wonum:
        from routers import pm_scope
        wo = (await pm_scope.wos_by_wonum([wonum])).get(wonum)
        company = pm_scope.company_of(current)
        # ใบงานที่ไม่ได้มอบให้บริษัทนี้ (รวมใบที่ planner ต้นทางยังไม่วางแผน) — ไม่เห็น จึงเริ่ม PM ไม่ได้
        pm_scope.assert_wo_visible(wo, current)
        if not pm_scope.is_participant(wo, current.role, current.username or current.sub, company):
            raise HTTPException(status_code=403, detail=pm_scope.not_participant_detail(wo, company))

    existing = await jobs.find_one(
        {"wonum": wonum} if wonum else {"pm_date": pm_date, "wonum": {"$in": ["", None]}}
    )
    if existing:
        # ใบเปิดไว้แล้ว (เช่น ช่างทีมต้นทางกดไปก่อน) — ฝ่ายของคนที่กดตอนนี้เริ่มงานของตัวเอง
        await _record_party_start(jobs, existing, current)
        job_out = _serialize_job(existing, await _section_states(existing), await job_planned_keys(existing))
        await _with_ownership([job_out], current)
        # ใบที่เปิดไว้ก่อนมีกติกานี้ (INPRG ยังค้างรอ vendor) — ตามยิงให้ตอนมีคนเปิดใบ
        if job_out.get("status") == pm_flow.PM_STATUS_DRAFT:
            _start_in_progress(existing, current.username or current.sub)
        return {"ok": True, "created": False, "job": job_out}

    station = station_collection.find_one({"station_id": station_id}, {"_id": 0, "station_name": 1}) or {}

    # เลขที่/ชื่อเอกสารของใบแม่ — ใช้ pm_type "ST" ชุดเดียวกับเอกสารสถานีเดิม
    # ใบลูกทุกส่วนจะยืมเลขนี้ไปใช้ ไม่ออกเลขของตัวเองอีก
    report_coll = get_stationpmreport_collection_for(station_id)
    url_coll = get_stationpmurl_coll_upload(station_id)

    # ตัวนับเลขที่เอกสารอยู่ฝั่ง stationPMReport ซึ่งไม่เห็นใบแม่ที่ยังไม่มีส่วนไหน
    # ถูกกรอก (และไม่เห็นใบเก่าที่ย้ายเข้ามาด้วย) — เดินเลขต่อจนกว่าจะไม่ชนของจริง
    issue_id = ""
    for _ in range(20):
        issue_id = await _next_issue_id_no_conflict(
            report_coll.database, report_coll, url_coll, station_id, "ST", d
        )
        if not await jobs.find_one({"issue_id": issue_id}, {"_id": 1}):
            break

    doc_name = ""
    for _ in range(20):
        year_seq = await _next_year_seq(report_coll.database, station_id, "ST", d)
        doc_name = f"{station_id}_{year_seq}/{d.year}"
        if not await jobs.find_one({"doc_name": doc_name}, {"_id": 1}):
            break

    doc = {
        "station_id": station_id,
        "station_name": station.get("station_name") or station_id,
        "issue_id": issue_id,
        "doc_name": doc_name,
        "pm_date": pm_date,
        "wonum": wonum,
        "inspector": (body.inspector or "").strip(),
        "created_by": current.username or current.sub,
        "createdAt": datetime.now(timezone.utc),
        # มีตั้งแต่เปิดใบ (ว่างได้) = ใบรุ่นใหม่ ฝ่ายอื่นต้องกด "เริ่ม PM" ของตัวเอง
        "party_starts": [],
    }
    res = await jobs.insert_one(doc)
    saved = await jobs.find_one({"_id": res.inserted_id}) or {**doc, "_id": res.inserted_id}
    await _record_party_start(jobs, saved, current)
    log.info(f"  ✅ เปิดใบ PM สถานี {issue_id} ({station_id}, wonum={wonum or '-'})")
    _start_in_progress(saved, current.username or current.sub)
    job_out = _serialize_job(saved, await _section_states(saved), await job_planned_keys(saved))
    await _with_ownership([job_out], current)
    return {"ok": True, "created": True, "job": job_out}


@router.get("/stationpmjob/list")
async def list_station_pm_jobs(
    station_id: str = Query(...),
    limit: int = Query(200, ge=1, le=1000),
    current: UserClaims = Depends(get_current_user),
):
    """ใบ PM สถานีทั้งหมดของสถานีนี้ — ใหม่สุดก่อน"""
    station_id = station_id.strip()
    jobs = get_stationpmjob_collection_for(station_id)
    docs = await jobs.find({}).sort([("pm_date", -1), ("_id", -1)]).limit(limit).to_list(length=limit)
    # แต่ละบริษัทเห็นเฉพาะใบงานที่ตัวเองได้รับมอบหมาย (pm_scope.wo_visible)
    from routers import pm_scope
    docs = await pm_scope.filter_visible(docs, current)
    chargers = station_chargers(station_id)   # ทุกใบในหน้านี้เป็นสถานีเดียวกัน
    plans = await planned_keys_by_wonum([str(j.get("wonum") or "") for j in docs])
    items = [
        _serialize_job(j, await _section_states(j, chargers), plans.get(str(j.get("wonum") or "").strip()))
        for j in docs
    ]
    await _with_ownership(items, current)
    return {"items": items, "total": len(items)}


@router.get("/stationpmjob/by-wonum")
async def find_station_pm_job_by_wonum(
    station_id: str = Query(...),
    wonum: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ใบ PM สถานีของใบงาน Maximo นี้ (มี = ช่างกด "เริ่ม PM" ไปแล้ว)
    หน้า PM List ใช้ตัดสินว่าจะพาเข้าหน้ารวม 5 ส่วน หรือหน้าข้อมูลใบงาน
    ต้องประกาศก่อน /stationpmjob/{job_id} ไม่งั้น "by-wonum" โดนจับเป็น job_id
    """
    station_id = station_id.strip()
    wonum = wonum.strip()
    if not station_id or not wonum:
        return {"id": ""}
    job = await get_stationpmjob_collection_for(station_id).find_one({"wonum": wonum})
    if not job:
        return {"id": "", "my_started": False}
    await _assert_job_visible(job, current)
    # ฝ่ายของคนที่กดยังไม่ได้เริ่ม PM → หน้า PM List พาไปหน้าใบงาน (ปุ่ม "เริ่ม PM") แทนหน้ารวม
    job_out = _serialize_job(job, await _section_states(job), await job_planned_keys(job))
    await _with_ownership([job_out], current)
    return {"id": str(job["_id"]), "my_started": bool(job_out.get("my_started", True))}


@router.get("/stationpmjob/{job_id}")
async def get_station_pm_job(
    job_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """รายละเอียดใบ 1 ใบ + สถานะของทุกส่วน (ให้หน้า hub เอาไปแสดง)"""
    station_id = station_id.strip()
    jobs = get_stationpmjob_collection_for(station_id)
    job = await jobs.find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")
    await _assert_job_visible(job, current)
    job_out = _serialize_job(job, await _section_states(job), await job_planned_keys(job))
    await _with_ownership([job_out], current)
    return {"job": job_out}


async def _assert_job_visible(job: dict, current: UserClaims) -> None:
    """ใบ PM สถานีของใบงานที่ไม่ได้มอบให้บริษัทนี้ = เปิดตรงด้วยลิงก์ / job_id ไม่ได้ (หน้า list ซ่อนไว้แล้ว)"""
    wonum = str((job or {}).get("wonum") or "").strip()
    if not wonum:
        return
    from routers import pm_scope
    viewer = pm_scope.wo_viewer(current)
    if viewer.bypass:
        return
    wo = (await pm_scope.wos_by_wonum([wonum])).get(wonum)
    if not pm_scope.wo_visible(wo, viewer):
        raise HTTPException(status_code=403, detail=pm_scope.not_visible_detail(wo))


# ══════════════════════════════════════════════════════════════════
# ลบใบ PM ทั้งใบ — super admin เท่านั้น (เหมือนลบใบงาน CM)
# ══════════════════════════════════════════════════════════════════

def assert_super_admin(current: UserClaims) -> None:
    """ลบถาวร = super admin เท่านั้น (admin ธรรมดาลบไม่ได้) — กติกาเดียวกับ DELETE /cmreport/{id}"""
    if not getattr(current, "is_super_admin", False):
        raise HTTPException(status_code=403, detail="เฉพาะ super admin ที่ลบใบงาน PM ได้")


async def delete_job_cascade(station_id: str, job: dict) -> dict:
    """
    ลบใบแม่ + เอกสารของทุกส่วนที่ผูกอยู่ (Station/MDB/CCB/CB_BOX + ตู้ชาร์จทุกตู้)
    คืนจำนวนเอกสารที่ลบของแต่ละส่วน — ไฟล์รูปในโฟลเดอร์ uploads ไม่ได้ลบตาม
    """
    job_id = str(job["_id"])
    removed: dict[str, int] = {}
    for section in SECTIONS:
        sns = [str(c.get("SN") or "").strip() for c in station_chargers(station_id)] \
            if section == CHARGER_SECTION else [""]
        for sn in sns:
            if section == CHARGER_SECTION and not sn:
                continue
            try:
                res = await section_collection(section, station_id, sn).delete_many({"job_id": job_id})
            except Exception as e:
                log.warning(f"  ⚠️ ลบส่วน {section}{f'/{sn}' if sn else ''} ของใบ {job_id} ไม่สำเร็จ: {e}")
                continue
            if res.deleted_count:
                key = f"{section}:{sn}" if sn else section
                removed[key] = removed.get(key, 0) + res.deleted_count
    await get_stationpmjob_collection_for(station_id).delete_one({"_id": job["_id"]})
    return removed


async def delete_wo_doc(wonum: str) -> int:
    """ลบใบงานออกจาก iMPS.maximo_pm_open — ใบงานจาก Maximo จะกลับมาอีกถ้า Maximo ยังส่งมาตอน sync"""
    from config import client

    wonum = (wonum or "").strip()
    if not wonum:
        return 0
    res = await client["iMPS"]["maximo_pm_open"].delete_many({"wonum": wonum})
    return res.deleted_count


@router.delete("/stationpmjob/{job_id}")
async def delete_station_pm_job(
    job_id: str,
    station_id: str = Query(...),
    with_wo: bool = Query(True, description="ลบใบงาน (maximo_pm_open) ของใบนี้ด้วย"),
    current: UserClaims = Depends(get_current_user),
):
    """
    ลบใบ PM สถานีทั้งใบ ทุกสถานะ — เอกสารทุกส่วน + ใบแม่ + ใบงานต้นทาง (ถ้ามี)
    ไม่ลบใบงานด้วย ใบงานจะกลับไปขึ้นในหน้า PM List เป็นแถว Open/In Progress อีกครั้ง
    """
    assert_super_admin(current)
    station_id = station_id.strip()
    job = await get_stationpmjob_collection_for(station_id).find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")
    removed = await delete_job_cascade(station_id, job)
    wo_removed = await delete_wo_doc(str(job.get("wonum") or "")) if with_wo else 0
    log.info(f"  🗑️ ลบใบ PM สถานี {job.get('issue_id') or job_id} ({station_id}) "
             f"ส่วน={removed} ใบงาน={wo_removed} โดย {current.username or current.sub}")
    return {"ok": True, "deleted_sections": removed, "deleted_wo": wo_removed}


# ══════════════════════════════════════════════════════════════════
# เลขที่เอกสารที่ใบลูกยืมไปใช้
# ══════════════════════════════════════════════════════════════════

async def job_numbering(station_id: str, job_id: str) -> dict:
    """
    (issue_id, doc_name, pm_date, wonum) ของใบแม่ — ใบลูกเรียกตอนบันทึกครั้งแรก
    เพื่อจะได้ไม่ออกเลขเอกสารของตัวเอง คืน {} ถ้าไม่ได้ผูกกับใบแม่
    """
    job_id = (job_id or "").strip()
    if not job_id:
        return {}
    try:
        job = await get_stationpmjob_collection_for(station_id).find_one({"_id": ObjectId(job_id)})
    except Exception:
        return {}
    if not job:
        return {}
    return {
        "job_id": str(job["_id"]),
        "issue_id": job.get("issue_id") or "",
        "doc_name": job.get("doc_name") or "",
        "pm_date": job.get("pm_date") or "",
        "wonum": job.get("wonum") or "",
    }


# ══════════════════════════════════════════════════════════════════
# ล็อกกันกรอกชนกัน — ทีละส่วน (routers/pm_lock.py)
#   ฟอร์มของส่วนยิง POST ตอนเปิดในโหมดกรอก แล้วต่ออายุทุก 30 วิ / DELETE ตอนออกจากหน้า
# ══════════════════════════════════════════════════════════════════

def _lock_target(job_id: str, station_id: str, section: str, sn: str):
    section = (section or "").strip().lower()
    if section not in SECTIONS:
        raise HTTPException(status_code=400, detail=f"ส่วนของเอกสารไม่ถูกต้อง: {section}")
    from routers import pm_lock
    sn = (sn or "").strip() if section == CHARGER_SECTION else ""
    jobs = get_stationpmjob_collection_for((station_id or "").strip())
    return jobs, {"_id": pm_flow.to_oid(job_id)}, pm_lock.section_lock_field(section, sn)


@router.post("/stationpmjob/{job_id}/lock")
async def lock_station_pm_section(
    job_id: str,
    station_id: str = Query(...),
    section: str = Query(...),
    sn: str = Query(""),
    current: UserClaims = Depends(get_current_user),
):
    """ขอ/ต่ออายุสิทธิ์กรอกส่วนนี้ — คนอื่นถืออยู่ได้ held_by_me=false + ชื่อคนถือ (HTTP 200)"""
    from routers import pm_lock
    jobs, flt, field = _lock_target(job_id, station_id, section, sn)
    return await pm_lock.acquire(jobs, flt, field, current)


@router.delete("/stationpmjob/{job_id}/lock")
async def unlock_station_pm_section(
    job_id: str,
    station_id: str = Query(...),
    section: str = Query(...),
    sn: str = Query(""),
    current: UserClaims = Depends(get_current_user),
):
    """ปล่อยสิทธิ์กรอกส่วนนี้ — ไม่ยิงก็แค่รอหมดอายุเอง"""
    from routers import pm_lock
    jobs, flt, field = _lock_target(job_id, station_id, section, sn)
    return await pm_lock.release(jobs, flt, field, current)


# ══════════════════════════════════════════════════════════════════
# ช่างกด "ปิดใบงาน" — ส่งทั้งใบเข้าคิวอนุมัติ
# ══════════════════════════════════════════════════════════════════

class SubmitJobIn(BaseModel):
    work_start: str                       # datetime-local ของไทย "YYYY-MM-DDTHH:MM"
    work_finish: str
    maximo_labor: list[str] = []          # laborcode ที่ลงเวลาเข้า Maximo (IN09)
    maximo_contractor: str = ""           # ชื่อจริง เมื่อเลือกรหัสกลางของผู้รับเหมา
    # ใบที่ไม่ได้ผูกกับใบงาน Maximo (ไม่มี wonum / ใบงานที่เปิดเองใน iMPS) — ไม่มีอะไรให้ลงเวลาใน Maximo
    # จึงเลือกผู้ปฏิบัติงานจากบัญชี iMPS ใน company เดียวกับคนที่ login แทน
    imps_labor: list[str] = []
    # ฝ่ายที่ส่ง (ใบที่แบ่งงาน) — ปกติคิดจากผู้ใช้เอง admin / owner ระบุแทนฝ่ายอื่นได้
    party: Optional[str] = None


@router.post("/stationpmjob/{job_id}/submit")
async def submit_station_pm_job(
    job_id: str,
    body: SubmitJobIn,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ส่งงานของฝ่ายตัวเองในใบ (ปิดใบงาน) — ใบจะเป็น Wait for approve เมื่อทุกฝ่ายส่งครบ
    (ใบที่ไม่ได้แบ่งงานมีฝ่ายเดียว = กดครั้งเดียวจบเหมือนเดิม)

    กดได้เมื่อทุกส่วนของฝ่ายตัวเองส่งครบตามแผนแล้ว
    เวลาทำงาน + ผู้ลงเวลาของฝ่ายนั้นกรอกตรงนี้ เก็บไว้ที่ work_entries ของใบ (ฝ่ายละ 1 รายการ
    ส่งซ้ำ = แก้ของเดิม) และเขียนลงใบลูกของฝ่ายนั้นด้วย
    ตอนอนุมัติ IN09 ลงเวลาแยกต่อฝ่าย (Maximo รับหลายครั้งต่อ WO ได้)
    ผู้ลงเวลาเป็น laborcode ของ Maximo เฉพาะใบงานที่ Maximo เปิดมา นอกนั้นเป็นบัญชี iMPS
    """
    from services.cm_maximo import CONTRACTOR_LABOR_CODE
    from routers.company import coworker_usernames

    work_start, work_finish = pm_flow.validate_work_time(body.work_start, body.work_finish)
    station_id = station_id.strip()
    jobs = get_stationpmjob_collection_for(station_id)
    job = await jobs.find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")

    from services.pm_maximo_out import is_manual_wonum

    wonum = str(job.get("wonum") or "").strip()
    # ใบงานที่เปิดเองใน iMPS ไม่มีใน Maximo — ลงผู้ปฏิบัติงานด้วยบัญชี iMPS เหมือนใบที่ไม่ผูกใบงาน
    if wonum and not await is_manual_wonum(wonum):
        labor = list(dict.fromkeys(str(c).strip() for c in body.maximo_labor if str(c or "").strip()))
        contractor = (body.maximo_contractor or "").strip()
        has_contractor_code = any(c.upper() == CONTRACTOR_LABOR_CODE for c in labor)
        if has_contractor_code and not contractor:
            raise HTTPException(status_code=400, detail="เลือกรหัสผู้รับเหมาแล้ว กรุณาระบุชื่อผู้รับเหมา")
        work = {
            "work_start": work_start,
            "work_finish": work_finish,
            "maximo_labor": labor,
            "maximo_contractor": contractor if has_contractor_code else "",
            "imps_labor": [],
        }
    else:
        # ไม่มีใบงาน Maximo — ผู้ปฏิบัติงานต้องเป็นบัญชี iMPS ใน company เดียวกับคนกดปิดใบงาน
        allowed = {u.lower(): u for u in await coworker_usernames(current)}
        picked = list(dict.fromkeys(str(u).strip() for u in body.imps_labor if str(u or "").strip()))
        if not picked:
            raise HTTPException(status_code=400, detail="กรุณาเลือกผู้ปฏิบัติงานอย่างน้อย 1 คน")
        outside = [u for u in picked if u.lower() not in allowed]
        if outside:
            raise HTTPException(status_code=400, detail=f"ไม่ใช่บัญชีในบริษัทเดียวกัน: {', '.join(outside)}")
        work = {
            "work_start": work_start,
            "work_finish": work_finish,
            "maximo_labor": [],
            "maximo_contractor": "",
            "imps_labor": [allowed[u.lower()] for u in picked],
        }

    from routers import pm_scope

    required = await job_planned_keys(job)
    sections = await _section_states(job)
    _mark_plan(sections, required)
    progress = job_progress(sections, required, _job_submitted(job))
    if progress["status"] != pm_flow.PM_STATUS_DRAFT:
        raise HTTPException(status_code=409, detail=f"ใบนี้เป็น {progress['status']} อยู่แล้ว")

    wo = (await pm_scope.wos_by_wonum([wonum])).get(wonum) if wonum else None
    parties = job_parties(sections, wo)
    if not parties or not any(s.get("report_id") for s in sections):
        raise HTTPException(status_code=400, detail="ยังไม่มีส่วนไหนถูกกรอก")

    role = (current.role or "").strip().lower()
    if body.party is not None and role in pm_scope.BYPASS_ROLES:
        key = _pkey(body.party)
    else:
        key = user_party_key(wo, current, pm_scope.company_of(current))
    party = parties.get(key)
    if not party:
        raise HTTPException(status_code=403, detail="ใบนี้ไม่มีส่วนที่เป็นงานของบริษัทคุณ")
    missing = [s for s in party["states"] if not s.get("sent")]
    if missing:
        names = ", ".join((s.get("label") or {}).get("th") or s["section"] for s in missing)
        raise HTTPException(status_code=400, detail=f"ยังกรอกไม่ครบ: {names}")

    # เขียนลงใบลูกของฝ่ายนี้ — เอกสารรายส่วนมีเวลาทำงานของคนที่ทำส่วนนั้นจริง
    for state in party["states"]:
        if not state["report_id"]:
            continue
        coll = section_collection(state["section"], station_id, state.get("sn") or "")
        await coll.update_one({"_id": ObjectId(state["report_id"])}, {"$set": work})

    now = datetime.now(timezone.utc)
    who = current.username or current.sub
    entry = {"key": key, "party": party["name"], **work,
             "submitted": True, "submitted_by": who, "submitted_at": now}
    entries = [e for e in job.get("work_entries") or [] if isinstance(e, dict) and e.get("key") != key]
    entries.append(entry)
    # ฝ่าย vendor ที่มีฟอร์มตู้ชาร์จ ต้องผ่าน planner ของ vendor ก่อน (entry ใหม่ = ยังไม่ผ่าน)
    all_done = all(_party_cleared(k, p, entries, wo) for k, p in parties.items())
    needs_review = party_needs_vendor_review(key, party, wo)

    update: dict = {"work_entries": entries, "updatedAt": now}
    if len(parties) == 1:
        # ใบฝ่ายเดียว: เก็บที่ตัวใบด้วยเหมือนเดิม (หน้าเว็บรุ่นก่อน / รายงานที่อ่านจากใบ)
        update.update(work)
    if all_done:
        update.update({
            "submitted_at": now,
            "submitted_by": who,
            "status": pm_flow.PM_STATUS_WAIT_APPROVE,
        })
    await jobs.update_one({"_id": job["_id"]}, {"$set": update})
    fresh = await jobs.find_one({"_id": job["_id"]}) or job
    log.info(
        f"  ✅ ส่งงานใบ PM สถานี {fresh.get('issue_id') or job_id} ฝ่าย {party['name'] or '-'} ({who})"
        + (" → ครบทุกฝ่าย รออนุมัติ" if all_done else "")
        + (f" → รอ planner ของ {party['name']} อนุมัติ" if needs_review else "")
    )
    job_out = _serialize_job(fresh, await _section_states(fresh), required)
    await _with_ownership([job_out], current)
    return {"ok": True, "all_submitted": all_done, "vendor_review": needs_review, "job": job_out}


# ══════════════════════════════════════════════════════════════════
# N/A — ส่วนที่ไม่ต้องกรอกในใบนี้ (เช่นสถานีไม่มีอุปกรณ์นั้น)
# ══════════════════════════════════════════════════════════════════

class SectionNaIn(BaseModel):
    section: str
    sn: str = ""                          # ส่วน charger เท่านั้น
    na: bool = True                       # False = ยกเลิก N/A กลับไปต้องกรอกเหมือนเดิม


@router.post("/stationpmjob/{job_id}/section-na")
async def set_section_na(
    job_id: str,
    body: SectionNaIn,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    กด/ยกเลิก N/A ของส่วนหนึ่งในใบ — ส่วนที่ N/A ไม่ต้องกรอก ไม่นับเป็นส่วนที่ขาดตอนปิดใบงาน
    และไม่อยู่ใน PDF

    ทำได้เฉพาะตอนใบยังไม่ได้กด "ปิดใบงาน" และส่วนนั้นยังไม่มีเอกสาร
    (กรอกไปแล้วต้องใช้เอกสารนั้น — กัน N/A ทับข้อมูลที่ตรวจไว้แล้วเงียบ ๆ)
    """
    station_id = station_id.strip()
    section = (body.section or "").strip().lower()
    if section not in SECTIONS:
        raise HTTPException(status_code=400, detail=f"ส่วนของเอกสารไม่ถูกต้อง: {body.section}")
    sn = (body.sn or "").strip() if section == CHARGER_SECTION else ""

    jobs = get_stationpmjob_collection_for(station_id)
    job = await jobs.find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")
    if _job_submitted(job):
        raise HTTPException(status_code=409, detail="ใบนี้กดปิดใบงานแล้ว แก้ไขไม่ได้")

    sections = await _section_states(job)
    state = next((s for s in sections if section_key(s["section"], s.get("sn") or "") == section_key(section, sn)), None)
    if not state:
        raise HTTPException(status_code=404, detail="ไม่พบส่วนนี้ในใบ")
    if body.na and state["report_id"]:
        raise HTTPException(status_code=409, detail="ส่วนนี้กรอกไปแล้ว จึงกด N/A ไม่ได้")
    # N/A ได้เฉพาะส่วนที่เป็นงานของบริษัทตัวเอง (ตู้ของ vendor ให้ vendor ตัดสินเอง)
    from routers import pm_scope
    await pm_scope.guard(current, section, None, job_id=job_id, station_id=station_id, sn=sn)

    entry = {"section": section, "sn": sn}
    await jobs.update_one(
        {"_id": job["_id"]},
        {("$addToSet" if body.na else "$pull"): {"na_sections": entry},
         "$set": {"updatedAt": datetime.now(timezone.utc)}},
    )
    fresh = await jobs.find_one({"_id": job["_id"]}) or job
    log.info(f"  {'⛔ N/A' if body.na else '↩️ ยกเลิก N/A'} ส่วน {section}{f'/{sn}' if sn else ''} "
             f"ของใบ {fresh.get('issue_id') or job_id} ({current.username or current.sub})")
    job_out = _serialize_job(fresh, await _section_states(fresh), await job_planned_keys(fresh))
    await _with_ownership([job_out], current)
    return {"ok": True, "job": job_out}


# ══════════════════════════════════════════════════════════════════
# แก้ส่วนที่ส่งแล้ว — ลบรูปเดิมของส่วนนั้น (ก่อนกด "ปิดใบงาน" เท่านั้น)
# ══════════════════════════════════════════════════════════════════

# role ที่แก้ส่วนที่ส่งแล้วได้ — ต้องตรงกับหน้าเว็บ (StationPmJobTables PM_EDIT_SENT_ROLES)
EDIT_SENT_ROLES = {"technician", "planner", "admin", "super_admin"}


class DeleteSectionPhotoIn(BaseModel):
    section: str
    sn: str = ""                          # ส่วน charger เท่านั้น
    report_id: str
    group: str                            # คีย์กลุ่มรูปใน photos ของใบลูก (g16, r7, g10_1 …)
    url: str                              # url ของรูปที่จะลบ (ตามที่เก็บใน photos)


@router.post("/stationpmjob/{job_id}/section-photo/delete")
async def delete_section_photo(
    job_id: str,
    body: DeleteSectionPhotoIn,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ลบรูปที่อัปโหลดไปแล้วของส่วนหนึ่งในใบ — ใช้ตอนช่างกด "แก้ไข" ส่วนที่ส่งแล้วแล้วเอารูปเดิมออก

    แก้ได้เฉพาะตอนใบยังไม่ได้กด "ปิดใบงาน" (และส่วนนั้นยังไม่ปิด) — หลังจากนั้นเอกสาร
    อยู่ในมือผู้อนุมัติแล้ว ห้ามเปลี่ยน
    """
    from uploads_access import assert_station_access, resolve_upload_path

    if (current.role or "").strip().lower() not in EDIT_SENT_ROLES:
        raise HTTPException(status_code=403, detail="เฉพาะ technician / planner / admin ที่แก้ไขส่วนที่ส่งแล้วได้")
    station_id = station_id.strip()
    assert_station_access(current, station_id)
    job = await get_stationpmjob_collection_for(station_id).find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")
    # กดปิดใบงานแล้ว = อยู่ในมือผู้อนุมัติ — ช่างแก้ไม่ได้ แต่ผู้อนุมัติแก้ก่อนอนุมัติได้
    # (ปุ่ม "แก้ไข" ในฟอร์มตอนตรวจ) ส่วนที่ปิดแล้วยังห้ามแก้ตามเดิม (เช็คด้านล่าง)
    if _job_submitted(job) and (current.role or "").strip().lower() not in pm_flow.PM_APPROVE_ROLES:
        raise HTTPException(status_code=409, detail="ใบนี้กดปิดใบงานแล้ว แก้ไขไม่ได้")

    group = (body.group or "").strip()
    url = (body.url or "").strip()
    if not group or "." in group or "$" in group or not url:
        raise HTTPException(status_code=400, detail="Bad photo reference")

    # มีคนอื่นกำลังกรอกส่วนนี้อยู่ = ห้ามแตะรูป
    from routers import pm_lock
    await pm_lock.assert_free(
        get_stationpmjob_collection_for(station_id), {"_id": job["_id"]},
        pm_lock.section_lock_field(body.section, body.sn), current, "ส่วนนี้",
    )

    # ฟอร์มตู้ชาร์จที่ planner ของ vendor อนุมัติแล้ว — ช่างแก้ไม่ได้ (กติกาเดียวกับ pm_scope.guard)
    if body.section == CHARGER_SECTION and (current.role or "").strip().lower() not in pm_flow.PM_APPROVE_ROLES:
        from routers import pm_scope
        owner = _pkey(pm_scope.section_owner(await _job_wo(job), body.section, body.sn))
        entry = next((e for e in job.get("work_entries") or [] if isinstance(e, dict) and e.get("key") == owner), {})
        if entry.get("submitted") and entry.get("vendor_approved"):
            raise HTTPException(status_code=409, detail="ฟอร์มนี้ planner ของ vendor อนุมัติแล้ว แก้ไขไม่ได้")

    coll = section_collection(body.section, station_id, body.sn)
    oid = pm_flow.to_oid(body.report_id)
    doc = await coll.find_one({"_id": oid, "job_id": job_id}, {"_id": 1, "status": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารของส่วนนี้ในใบ")
    if _is_closed(_norm_status(doc.get("status"))):
        raise HTTPException(status_code=409, detail="ส่วนนี้ปิดแล้ว แก้ไขไม่ได้")

    res = await coll.update_one(
        {"_id": oid},
        {"$pull": {f"photos.{group}": {"url": url}}, "$set": {"updatedAt": datetime.now(timezone.utc)}},
    )

    # ไฟล์ไม่ได้ใช้แล้ว — ลบทิ้งเท่าที่ทำได้ (resolve_upload_path กัน path traversal ให้)
    # ลบไม่ได้ก็ไม่เป็นไร เอกสารไม่อ้างถึงแล้ว
    if res.modified_count and url.startswith("/uploads/"):
        try:
            resolve_upload_path(url[len("/uploads/"):]).unlink()
        except Exception:
            pass

    return {"ok": True, "removed": res.modified_count}


# ══════════════════════════════════════════════════════════════════
# อนุมัติ / ตีกลับ ทั้งใบ (ทุกส่วนพร้อมกัน) — ตีกลับรายส่วนอยู่ถัดลงไป (reject-section)
# ══════════════════════════════════════════════════════════════════

@router.post("/stationpmjob/{job_id}/approve")
async def approve_station_pm_job(
    job_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    อนุมัติทั้งใบ = อนุมัติทุกส่วนที่รออนุมัติอยู่

    เดินทีละส่วนด้วย pm_flow.approve ตัวเดิม ส่วนที่ยังไม่ได้กรอกหรือปิดไปแล้วข้าม
    ให้ผลลัพธ์รายส่วนกลับไปด้วย จะได้รู้ว่าส่วนไหนไม่ผ่านเพราะอะไร
    """
    pm_flow.assert_approver(current)
    station_id = station_id.strip()
    jobs = get_stationpmjob_collection_for(station_id)
    job = await jobs.find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")
    # planner ของ vendor อนุมัติได้แค่ฟอร์มตู้ชาร์จของฝ่ายตัวเอง (vendor-approve) ไม่ใช่ทั้งใบ
    _assert_origin_approver(await _job_wo(job), current)

    # อนุมัติได้เฉพาะใบที่ส่งครบทุกส่วนในแผนแล้ว — กันปิดใบทั้งที่ช่างยังทำไม่เสร็จ
    required = await job_planned_keys(job)
    states = await _section_states(job)
    if derive_job_status(states, required, _job_submitted(job)) != pm_flow.PM_STATUS_WAIT_APPROVE:
        raise HTTPException(
            status_code=409,
            detail="ช่างยังไม่ได้กดปิดใบงาน หรือยังส่งไม่ครบทุกส่วนตามแผน จึงยังอนุมัติไม่ได้",
        )

    results: list[dict] = []
    for state in states:
        if not state["report_id"] or not _is_wait(state["status"]):
            continue
        sn = state.get("sn") or ""
        coll = section_collection(state["section"], station_id, sn)
        scope = section_scope_filter(state["section"], station_id, sn)
        try:
            await pm_flow.approve(coll, ObjectId(state["report_id"]), scope, current)
            results.append({"section": state["section"], "sn": sn, "ok": True})
        except HTTPException as e:
            results.append({"section": state["section"], "sn": sn, "ok": False, "detail": e.detail})

    sections = await _section_states(job)
    status = derive_job_status(sections, required, _job_submitted(job))
    await jobs.update_one(
        {"_id": job["_id"]},
        {"$set": {
            "status": status,
            "approved_by": current.username or current.sub,
            "approved_at": datetime.now(timezone.utc),
            "reject_remark": "",
        }},
    )
    fresh = await jobs.find_one({"_id": job["_id"]}) or job

    # อนุมัติแล้ว = ปิดงาน → สร้าง PDF รวมเก็บไว้ แล้วยิงชุดปิดงานเข้า Maximo (เฉพาะใบงานที่ Maximo เปิดมา)
    closing = await close_out_job(fresh, station_id, memo=f"approved by {current.username or current.sub}") \
        if _is_closed(status) else {}
    fresh = await jobs.find_one({"_id": job["_id"]}) or fresh
    return {"ok": True, "results": results, **closing, "job": _serialize_job(fresh, sections, required)}


async def close_out_job(job: dict, station_id: str, *, memo: str = "") -> dict:
    """
    งานหลังอนุมัติปิดใบ — ห้าม raise (ใบปิดไปแล้ว ล้มตรงนี้ต้องไม่ทำให้การอนุมัติพัง)

      1. สร้าง PDF รวมทั้งใบเก็บ cache (ลิงก์ที่แนบเข้า Maximo เปิดแล้วได้ไฟล์ทันที)
      2. ใบงานที่ Maximo เปิดมา → ยิง IN03 (แนบลิงก์ PDF รวม) → IN09 (เวลาช่าง) → IN02 CLOSED
         ทีละเส้น ผลจดไว้ที่ maximo_sync ของใบ PM สถานี
         ใบงานที่เปิดเองใน iMPS / ใบที่ไม่ได้ผูกใบงาน → ไม่ยิงอะไรเข้า Maximo
    """
    from services import pm_maximo_out

    out: dict = {}
    try:
        from services.pm_maximo_out import PDF_LANG
        await build_job_pdf(job, station_id, PDF_LANG)
        out["pdf"] = {"ok": True}
    except Exception as e:
        log.warning(f"  ⚠️ สร้าง PDF ใบ {job.get('issue_id') or job.get('_id')} ไม่สำเร็จ: {e}")
        out["pdf"] = {"ok": False, "reason": str(getattr(e, "detail", "") or e)}

    wonum = str(job.get("wonum") or "").strip()
    if not wonum:
        out["maximo"] = {"skipped": "ใบนี้ไม่ได้ผูกกับใบงาน"}
    elif await pm_maximo_out.is_manual_wonum(wonum):
        out["maximo"] = {"skipped": pm_maximo_out.MANUAL_SKIP_REASON}
    else:
        out["maximo"] = await pm_maximo_out.safe_sync_closed(
            get_stationpmjob_collection_for(station_id), job["_id"], job,
            memo=memo, link=pm_maximo_out.job_pdf_url(job, station_id),
            # ใบที่ส่งงานแยกฝ่าย → IN09 ลงเวลาแยกต่อฝ่าย / ใบรุ่นก่อนใช้เวลาชุดเดียวที่ตัวใบ
            per_party_labor=bool(job.get("work_entries")),
        )
        log.info(f"  📤 ปิดใบงาน {wonum} เข้า Maximo: {out['maximo']}")

    # ธงให้ auto-retry (services/pm_maximo_retry.py) และหน้า PM List รู้ว่า Maximo ยังไม่ปิด
    pending = not maximo_close_done(out.get("maximo"))
    try:
        update: dict = {"$set": {"maximo_pending": pending}}
        if not pending:
            update["$unset"] = {"maximo_retry": ""}
        await get_stationpmjob_collection_for(station_id).update_one({"_id": job["_id"]}, update)
    except Exception as e:
        log.warning(f"  ⚠️ จดธง maximo_pending ของใบ {job.get('issue_id') or job.get('_id')} ไม่สำเร็จ: {e}")
    out["maximo_pending"] = pending
    return out


def maximo_close_done(result: Any) -> bool:
    """ชุดปิดงานจบแล้วหรือยัง — IN02 CLOSED ผ่าน หรือไม่มีอะไรต้องส่ง (ใบเปิดเอง / ปิด integration)"""
    if not isinstance(result, dict) or result.get("error"):
        return False
    if result.get("skipped"):
        return True
    return bool((result.get("IN02") or {}).get("ok"))


# role ที่สั่งยิงชุดปิดงานเข้า Maximo ซ้ำได้ — ตรงกับ PM_SYNC_ROLES ของ pm_maximo
JOB_RESYNC_ROLES = {"admin", "owner", "planner"}


@router.post("/stationpmjob/{job_id}/maximo-sync")
async def resync_station_pm_job(
    job_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ยิงชุดปิดงาน (IN03 → IN09 → IN02 CLOSED) ของใบที่อนุมัติแล้วใหม่ — ใช้เมื่อรอบก่อนล้ม
    เส้นที่ผ่านแล้วไม่ยิงซ้ำ (IN03/IN09 จำผลไว้, IN02 กันสถานะเดิม)
    """
    if (current.role or "").strip().lower() not in JOB_RESYNC_ROLES:
        raise HTTPException(status_code=403, detail="เฉพาะ planner / owner / admin ที่สั่งส่งเข้า Maximo ใหม่ได้")
    station_id = station_id.strip()
    jobs = get_stationpmjob_collection_for(station_id)
    job = await jobs.find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")
    if not _is_closed(str(job.get("status") or "")):
        raise HTTPException(status_code=409, detail="ใบนี้ยังไม่ได้อนุมัติปิดงาน")
    # กดส่งเองแล้ว = เริ่มนับ auto-retry ใหม่ (ใบที่ retry จนยอมแพ้ไปแล้วจะกลับมาลองต่อ)
    await jobs.update_one({"_id": job["_id"]}, {"$unset": {"maximo_retry": ""}})
    closing = await close_out_job(job, station_id, memo=f"re-sync by {current.username or current.sub}")
    fresh = await jobs.find_one({"_id": job["_id"]}) or job
    job_out = _serialize_job(fresh, await _section_states(fresh), await job_planned_keys(fresh))
    await _with_ownership([job_out], current)
    return {"ok": True, **closing, "job": job_out}


@router.post("/stationpmjob/{job_id}/reject")
async def reject_station_pm_job(
    job_id: str,
    body: pm_flow.PMRejectIn,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """ตีกลับทั้งใบ — ทุกส่วนที่รออนุมัติกลับไปเป็น draft ให้ช่างแก้"""
    pm_flow.assert_approver(current)
    station_id = station_id.strip()
    jobs = get_stationpmjob_collection_for(station_id)
    job = await jobs.find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")
    _assert_origin_approver(await _job_wo(job), current)

    results: list[dict] = []
    for state in await _section_states(job):
        if not state["report_id"] or not _is_wait(state["status"]):
            continue
        sn = state.get("sn") or ""
        coll = section_collection(state["section"], station_id, sn)
        scope = section_scope_filter(state["section"], station_id, sn)
        try:
            await pm_flow.reject(coll, ObjectId(state["report_id"]), scope, current, body.remark)
            results.append({"section": state["section"], "sn": sn, "ok": True})
        except HTTPException as e:
            results.append({"section": state["section"], "sn": sn, "ok": False, "detail": e.detail})

    sections = await _section_states(job)
    required = await job_planned_keys(job)
    # ทุกฝ่ายต้องส่งงานใหม่ — เก็บเวลา/ผู้ลงเวลาเดิมไว้เติมให้ตอนกดส่งใหม่
    # ฟอร์มตู้ชาร์จของ vendor ต้องผ่าน planner ของ vendor อีกรอบ
    entries = [{**e, **_REOPENED} for e in job.get("work_entries") or [] if isinstance(e, dict)]
    await jobs.update_one(
        {"_id": job["_id"]},
        {
            "$set": {
                "status": derive_job_status(sections, required),
                "reject_remark": body.remark,
                "rejected_by": current.username or current.sub,
                **({"work_entries": entries} if entries else {}),
            },
            # ตีกลับ = ช่างต้องแก้แล้วกด "ปิดใบงาน" ใหม่
            "$unset": {"submitted_at": "", "submitted_by": ""},
        },
    )
    fresh = await jobs.find_one({"_id": job["_id"]}) or job
    return {"ok": True, "results": results, "job": _serialize_job(fresh, sections, required)}


# ══════════════════════════════════════════════════════════════════
# อนุมัติชั้น vendor — planner ของ vendor (เช่น EDS) อนุมัติฟอร์มตู้ชาร์จของฝ่ายตัวเองทีเดียว
# ══════════════════════════════════════════════════════════════════

class VendorApproveIn(BaseModel):
    # admin อนุมัติแทน vendor รายใดก็ได้ — ไม่ระบุ = รายเดียวที่รออยู่
    party: Optional[str] = None


@router.post("/stationpmjob/{job_id}/vendor-approve")
async def vendor_approve_station_pm_job(
    job_id: str,
    body: VendorApproveIn | None = None,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    planner ของ vendor อนุมัติงานตู้ชาร์จของฝ่ายตัวเองในใบ (ชั้นแรก) — แล้วส่งต่อให้ planner ต้นทาง

    กดได้เมื่อฝ่ายนั้นกด "ส่งงาน" แล้ว และทุกฟอร์มของฝ่ายยังอยู่ในสถานะส่งแล้ว
    ครบทุกฝ่าย (และทุกฝ่าย vendor ผ่าน planner ของตัวเองแล้ว) → ใบเป็น Wait for approve
    ฟอร์มยังเป็น Wait for approve เหมือนเดิม (ปิดจริงตอน planner ต้นทางอนุมัติทั้งใบ)
    """
    from routers import pm_scope

    station_id = station_id.strip()
    jobs = get_stationpmjob_collection_for(station_id)
    job = await jobs.find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")

    required = await job_planned_keys(job)
    sections = await _section_states(job)
    _mark_plan(sections, required)
    if job_progress(sections, required, _job_submitted(job))["status"] != pm_flow.PM_STATUS_DRAFT:
        raise HTTPException(status_code=409, detail="ใบนี้ส่งให้ planner ต้นทางแล้ว")

    wo = await _job_wo(job)
    parties = job_parties(sections, wo)
    entries = [e for e in job.get("work_entries") or [] if isinstance(e, dict)]
    role = (current.role or "").strip().lower()
    if role == "admin":
        if body and body.party:
            key = _pkey(body.party)
        else:
            pending = [k for k, p in parties.items() if vendor_review_state(k, p, entries, wo) == "pending"]
            if len(pending) != 1:
                raise HTTPException(status_code=400, detail="ระบุฝ่าย vendor ที่จะอนุมัติแทน (party)")
            key = pending[0]
    else:
        key = vendor_reviewer_key(wo, current, pm_scope.company_of(current))
        if not key:
            raise HTTPException(status_code=403, detail="เฉพาะ planner ของ vendor ที่รับงานตู้ชาร์จในใบนี้")

    party = parties.get(key)
    name = (party or {}).get("name") or review_vendors(wo).get(key) or key
    review = vendor_review_state(key, party, entries, wo) if party else ""
    if not review:
        raise HTTPException(status_code=400, detail=f"ใบนี้ไม่มีฟอร์มตู้ชาร์จของ {name} ที่ต้องอนุมัติ")
    if review == "waiting":
        raise HTTPException(status_code=409, detail=f"ฝ่าย {name} ยังไม่ได้ส่งงาน หรือมีฟอร์มที่ยังแก้อยู่")
    if review == "approved":
        raise HTTPException(status_code=409, detail=f"งานของ {name} อนุมัติไปแล้ว")

    now = datetime.now(timezone.utc)
    who = current.username or current.sub
    entries = [
        {**e, "vendor_approved": True, "vendor_approved_by": who, "vendor_approved_at": now}
        if e.get("key") == key else e
        for e in entries
    ]
    all_done = all(_party_cleared(k, p, entries, wo) for k, p in parties.items())
    update: dict = {"work_entries": entries, "updatedAt": now}
    if all_done:
        last = max((e for e in entries if e.get("submitted")),
                   key=lambda e: _iso(e.get("submitted_at")), default={})
        update.update({
            "submitted_at": now,
            "submitted_by": last.get("submitted_by") or who,
            "status": pm_flow.PM_STATUS_WAIT_APPROVE,
        })
    await jobs.update_one({"_id": job["_id"]}, {"$set": update})
    fresh = await jobs.find_one({"_id": job["_id"]}) or job
    log.info(
        f"  ✅ planner {name} อนุมัติงานตู้ชาร์จของใบ {fresh.get('issue_id') or job_id} ({who})"
        + (" → ครบทุกฝ่าย รอ planner ต้นทางอนุมัติ" if all_done else "")
    )
    job_out = _serialize_job(fresh, await _section_states(fresh), required)
    await _with_ownership([job_out], current)
    return {"ok": True, "all_submitted": all_done, "job": job_out}


# ══════════════════════════════════════════════════════════════════
# ตีกลับรายส่วน — planner ตีกลับเฉพาะฟอร์มที่ต้องแก้ ฟอร์มอื่นยังรออนุมัติอยู่เหมือนเดิม
#   - ใบลูกของส่วนนั้นกลับเป็น draft (pm_flow.reject) ส่วนอื่นไม่แตะ
#   - ใบแม่กลับเป็น In Progress: ฝ่ายเจ้าของส่วนนั้นแก้ → ส่งฟอร์มใหม่ → กด "ส่งงาน / ปิดใบงาน"
#     อีกครั้ง (เวลาทำงาน/ผู้ลงเวลาเดิมเติมให้) — ฝ่ายอื่นในใบที่แบ่งงานไม่ต้องส่งใหม่
#   - ระหว่างที่ใบยังรอแก้ (draft ที่มี reject_remark) ตีกลับส่วนอื่นเพิ่มได้อีก
# ══════════════════════════════════════════════════════════════════

class SectionRejectIn(BaseModel):
    section: str
    sn: str = ""                          # ส่วน charger เท่านั้น
    remark: str = Field(..., min_length=1, description="เหตุผลที่ตีกลับ — ช่างต้องรู้ว่าต้องแก้อะไร")


def _rejected_summary(sections: list[dict]) -> str:
    """เหตุผลรวมของใบ = ส่วนที่โดนตีกลับและยังไม่ได้ส่งใหม่ เช่น "MDB: …; ตู้ชาร์จ 2: …" """
    parts: list[str] = []
    for s in sections:
        remark = str(s.get("reject_remark") or "").strip()
        if not remark or _sent(s):
            continue
        label = (s.get("label") or {}).get("th") or s["section"]
        parts.append(f"{label}: {remark}")
    return "; ".join(parts)


def _can_reject_section(job: dict, job_status: str) -> bool:
    """ใบอยู่ในมือผู้อนุมัติ = รออนุมัติทั้งใบ หรือเพิ่งตีกลับบางส่วนไปแล้วและยังรอแก้"""
    if _is_wait(job_status):
        return True
    return job_status == pm_flow.PM_STATUS_DRAFT and bool(str(job.get("reject_remark") or "").strip())


# work_entry ที่ต้องส่งใหม่ — ล้างผลอนุมัติของ planner vendor ด้วย (ต้องผ่าน vendor อีกรอบ)
_REOPENED = {"submitted": False, "vendor_approved": False, "vendor_approved_by": "", "vendor_approved_at": None}


def _reopen_entries(entries: list, owner_key: str, single_party: bool) -> list[dict]:
    """
    work_entries หลังตีกลับรายส่วน — เฉพาะฝ่ายเจ้าของส่วนนั้นกลับเป็นยังไม่ส่ง (ค่าเดิมเก็บไว้เติมให้)
    ใบฝ่ายเดียว: รายการเดียวของใบกลับเป็นยังไม่ส่ง (ไม่ต้องเทียบ key — ใบรุ่นก่อนอาจคิด key ต่างกัน)
    """
    return [
        {**e, **_REOPENED} if (single_party or e.get("key") == owner_key) else e
        for e in entries or [] if isinstance(e, dict)
    ]


@router.post("/stationpmjob/{job_id}/reject-section")
async def reject_station_pm_section(
    job_id: str,
    body: SectionRejectIn,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """ตีกลับเฉพาะส่วนเดียวของใบ (ฟอร์มที่ planner เปิดตรวจอยู่) — ส่วนอื่นไม่ต้องแก้/ส่งใหม่"""
    from routers import pm_scope

    pm_flow.assert_approver(current)
    remark = (body.remark or "").strip()
    if not remark:
        raise HTTPException(status_code=400, detail="กรุณาระบุเหตุผลที่ตีกลับ")
    section = (body.section or "").strip().lower()
    if section not in SECTIONS:
        raise HTTPException(status_code=400, detail=f"ส่วนของเอกสารไม่ถูกต้อง: {body.section}")
    sn = (body.sn or "").strip() if section == CHARGER_SECTION else ""

    station_id = station_id.strip()
    jobs = get_stationpmjob_collection_for(station_id)
    job = await jobs.find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")

    required = await job_planned_keys(job)
    sections = await _section_states(job)
    _mark_plan(sections, required)
    wo = await _job_wo(job)
    parties = job_parties(sections, wo)
    entries_now = job.get("work_entries") or []
    owner_key = _pkey(pm_scope.section_owner(wo, section, sn))
    owner_party = parties.get(owner_key)
    review = vendor_review_state(owner_key, owner_party, entries_now, wo) \
        if owner_party and section == CHARGER_SECTION else ""
    vendor_key = vendor_reviewer_key(wo, current, pm_scope.company_of(current))

    if vendor_key:
        # planner ของ vendor — ตีกลับได้เฉพาะฟอร์มตู้ชาร์จของฝ่ายตัวเองที่รอตัวเองอนุมัติอยู่
        if section != CHARGER_SECTION or owner_key != vendor_key:
            raise HTTPException(status_code=403, detail="ตีกลับได้เฉพาะฟอร์มตู้ชาร์จที่เป็นงานของบริษัทคุณ")
        if review != "pending":
            raise HTTPException(
                status_code=409,
                detail="ฟอร์มนี้ไม่ได้รอคุณอนุมัติ (ฝ่ายของคุณยังไม่ได้ส่งงาน หรืออนุมัติไปแล้ว)",
            )
    else:
        if not _can_reject_section(job, derive_job_status(sections, required, _job_submitted(job))):
            raise HTTPException(status_code=409, detail="ใบนี้ยังไม่ได้ส่งอนุมัติ จึงยังตีกลับไม่ได้")
        # ฟอร์มที่ฝ่าย vendor ส่งงานมาแล้ว รอ planner ของ vendor อยู่ — ให้ vendor ตรวจก่อน
        if review == "pending":
            name = review_vendors(wo).get(owner_key) or owner_key
            raise HTTPException(status_code=409, detail=f"ฟอร์มนี้รอ planner ของ {name} อนุมัติก่อน")
    target = section_key(section, sn)
    state = next((s for s in sections if section_key(s["section"], s.get("sn") or "") == target), None)
    if not state or not state["report_id"]:
        raise HTTPException(status_code=404, detail="ส่วนนี้ยังไม่ได้กรอก")
    if not _is_wait(state["status"]):
        raise HTTPException(status_code=409, detail="ส่วนนี้ไม่ได้รออนุมัติ (ยังไม่ได้ส่ง หรือปิดไปแล้ว)")

    await pm_flow.reject(
        section_collection(section, station_id, sn), ObjectId(state["report_id"]),
        section_scope_filter(section, station_id, sn), current, remark,
    )

    # ฝ่ายเจ้าของส่วนนี้ต้องกดส่งงานใหม่ ฝ่ายอื่นยังนับว่าส่งแล้ว
    entries = _reopen_entries(entries_now, owner_key, single_party=len(parties) <= 1)

    fresh_sections = await _section_states(job)
    now = datetime.now(timezone.utc)
    who = current.username or current.sub
    if vendor_key:
        # ตีกลับในชั้น vendor — ใบยังไม่ถึงมือ planner ต้นทาง ไม่แตะเหตุผล/สถานะของใบแม่
        # (เหตุผลอยู่ที่ใบลูก หน้ารวมโชว์รายฟอร์มอยู่แล้ว)
        await jobs.update_one(
            {"_id": job["_id"]},
            {"$set": {"updatedAt": now, **({"work_entries": entries} if entries else {})}},
        )
        fresh = await jobs.find_one({"_id": job["_id"]}) or job
        log.info(
            f"  ↩️ planner {vendor_key} ตีกลับตู้ {sn} ของใบ {fresh.get('issue_id') or job_id} ({who}): {remark}"
        )
        job_out = _serialize_job(fresh, fresh_sections, required)
        await _with_ownership([job_out], current)
        return {"ok": True, "job": job_out}

    await jobs.update_one(
        {"_id": job["_id"]},
        {
            "$set": {
                "status": derive_job_status(fresh_sections, required),
                "reject_remark": _rejected_summary(fresh_sections) or remark,
                "rejected_by": who,
                "rejected_at": now,
                "updatedAt": now,
                **({"work_entries": entries} if entries else {}),
            },
            # ใบกลับไปอยู่ในมือช่าง — ส่งฟอร์มที่แก้แล้วกด "ส่งงาน / ปิดใบงาน" ใหม่
            "$unset": {"submitted_at": "", "submitted_by": ""},
        },
    )
    fresh = await jobs.find_one({"_id": job["_id"]}) or job
    log.info(
        f"  ↩️ ตีกลับส่วน {section}{f'/{sn}' if sn else ''} ของใบ {fresh.get('issue_id') or job_id} ({who}): {remark}"
    )
    job_out = _serialize_job(fresh, fresh_sections, required)
    await _with_ownership([job_out], current)
    return {"ok": True, "job": job_out}


# ══════════════════════════════════════════════════════════════════
# PDF ใบเดียวจบ — ต่อ PDF ของแต่ละส่วนเข้าด้วยกัน
# ══════════════════════════════════════════════════════════════════

def _page_number_overlay(count: int, lang: str):
    """
    PDF เลขหน้า "หน้า N" ตำแหน่งเดียวกับที่ template PM วาดเอง (มุมขวาบน)
    ใช้ทับหน้าที่เรียงใหม่แล้ว — เลขหน้าของแต่ละส่วนเริ่ม 1 ใหม่ทุกส่วน ใช้ในใบรวมไม่ได้
    """
    from fpdf import FPDF
    from pypdf import PdfReader
    from pdf.templates.pdf_station import FONT_MAIN, add_all_thsarabun_fonts

    pdf = FPDF(unit="mm", format="A4")
    pdf.set_auto_page_break(False)
    thai = add_all_thsarabun_fonts(pdf)
    font = "THSarabun" if thai else "Helvetica"
    # ไม่มีฟอนต์ไทยก็พิมพ์ภาษาไทยไม่ได้ — ใช้คำอังกฤษแทน
    label = "หน้า" if thai and lang != "en" else "Page"
    for n in range(1, count + 1):
        pdf.add_page()
        pdf.set_font(font, "", FONT_MAIN - 1)
        text = f"{label} {n}"
        w = pdf.get_string_width(text) + 4
        pdf.set_xy(pdf.w - pdf.r_margin - w, 5)
        pdf.cell(w, 4, text, align="R")
    return PdfReader(io.BytesIO(bytes(pdf.output())))


def job_pdf_cache_path(station_id: str, job_id: str, lang: str, part: str = "") -> pathlib.Path:
    """ไฟล์ PDF รวมของใบที่อนุมัติแล้ว — สร้างตอนอนุมัติ ลิงก์ใน Maximo เปิดแล้วได้ไฟล์ทันที
    part = "station" / "charger" คือ PDF ของการ์ดนั้นในหน้ารวม (แยกไฟล์ cache)"""
    from routers.pm_helpers import UPLOADS_ROOT
    suffix = f"_{part}" if part else ""
    # _v2 = ช่องลายเซ็นมี planner ต้นทางเป็นพยานของตู้ vendor (2026-10-22) — ไฟล์รุ่นก่อนไม่ถูกใช้ต่อ
    # _v3 = แก้ขนาดตัวอักษรในตาราง checklist เพี้ยนเป็น 6pt หลังแถวแรก (2026-10-22)
    # _v4 = PDF ทั้งใบเรียงตู้ชาร์จก่อน แล้วตามด้วยอุปกรณ์ไฟฟ้า Station/MDB/CCB/CB_BOX (2026-10-22)
    # _v5 = ชื่อสถานียาวไม่ตกบรรทัด — ขยายคอลัมน์ซ้ายของบล็อกข้อมูลงาน (2026-10-22)
    # _v6 = ชื่อเอกสารหัวกระดาษไม่ล้นกรอบ, CCB ข้อ 9 ไม่ขาด, "วันที่ :" ใต้ลายเซ็นตามภาษา (2026-10-22)
    # _v7 = ป้าย/หัวตารางตามภาษาทุกฟอร์ม, ที่อยู่เดียวกัน, วันที่ 22/10/2569, วันที่อนุมัติใต้ลายเซ็น, ผลตรวจ 3 ช่อง (2026-10-22)
    # _v8 = บล็อกข้อมูลงาน 2 คอลัมน์เท่ากัน / _v9 = เรียงตู้ชาร์จ → Station → CB_BOX → MDB → CCB, ป้าย Pass/Fail/N/A 11pt (2026-10-22)
    return pathlib.Path(UPLOADS_ROOT) / "pdf_cache" / "stationPMJob" / station_id / f"{job_id}{suffix}_{lang}_v9.pdf"


# การ์ดในหน้ารวมใบ PM สถานี → ส่วนที่อยู่ในการ์ดนั้น (PDF รายการ์ด)
PDF_PARTS: dict[str, set[str]] = {
    "station": {"station", "mdb", "ccb", "cbbox"},
    "charger": {CHARGER_SECTION},
}


def _approval_date(value) -> str:
    """เวลาอนุมัติ (เก็บเป็น UTC) → "YYYY-MM-DD" ตามเวลาไทย สำหรับวันที่ใต้ลายเซ็นใน PDF — ไม่มี = "" """
    from datetime import timedelta
    if not value:
        return ""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value[:10]
    if not isinstance(value, datetime):
        return ""
    if value.tzinfo is None:  # Mongo คืน datetime แบบไม่มี tz แต่เป็น UTC
        value = value.replace(tzinfo=timezone.utc)
    return (value.astimezone(timezone(timedelta(hours=7)))).strftime("%Y-%m-%d")


async def _charger_vendor_approvers(job: dict, states: list[dict]) -> dict[str, tuple[str, str]]:
    """
    {sn: (ชื่อ planner ของ vendor ที่อนุมัติตู้นั้น, วันที่อนุมัติ)} — เฉพาะตู้ที่มอบให้ vendor ที่มี planner ของตัวเอง
    (เช่น EDS) และ planner คนนั้นอนุมัติแล้ว ใช้ใส่ช่อง "ผู้อนุมัติ" ใน PDF ของตู้นั้น
    """
    from routers import pm_scope

    wonum = str(job.get("wonum") or "").strip()
    if not wonum:
        return {}
    try:
        wo = (await pm_scope.wos_by_wonum([wonum])).get(wonum)
    except Exception as e:
        log.warning(f"  ⚠️ อ่านใบงาน {wonum} เพื่อหาผู้อนุมัติของ vendor ไม่สำเร็จ: {e}")
        return {}
    vendors = review_vendors(wo)
    entries = {e.get("key"): e for e in job.get("work_entries") or [] if isinstance(e, dict)}
    out: dict[str, tuple[str, str]] = {}
    for s in states:
        sn = s.get("sn") or ""
        if s.get("section") != CHARGER_SECTION or not sn:
            continue
        key = _pkey(pm_scope.section_owner(wo, CHARGER_SECTION, sn))
        entry = entries.get(key) or {}
        if key in vendors and entry.get("vendor_approved"):
            out[sn] = (str(entry.get("vendor_approved_by") or ""), _approval_date(entry.get("vendor_approved_at")))
    return out


def _render_job_pdf(parts: list[tuple[dict, dict, dict]], lang: str) -> bytes:
    """
    เรนเดอร์จริง (บล็อก) — parts = [(state, doc, template info)] เรียงตามลำดับส่วนแล้ว
    checklist ของทุกส่วนก่อน แล้วตามด้วยรูปของทุกส่วน + เลขหน้าต่อเนื่องทั้งเล่ม
    """
    from pypdf import PdfReader, PdfWriter

    checklist_pages: list = []
    photo_pages: list = []
    for state, doc, info in parts:
        kinds: list[str] = []
        try:
            part = info["func"](doc, lang=lang, page_kinds=kinds, show_page_no=False)
        except Exception as e:
            log.warning(f"  ⚠️ สร้าง PDF ส่วน {state['section']} {state.get('sn') or ''} ไม่สำเร็จ: {e}")
            continue
        try:
            pages = PdfReader(io.BytesIO(part)).pages
        except Exception as e:
            log.warning(f"  ⚠️ อ่าน PDF ส่วน {state['section']} {state.get('sn') or ''} ไม่สำเร็จ: {e}")
            continue
        if len(kinds) != len(pages):
            # ไม่ควรเกิด — แยกไม่ได้ก็เก็บทั้งส่วนไว้ช่วง checklist ดีกว่าทำหน้าหาย
            log.warning(f"  ⚠️ ชนิดหน้าของส่วน {state['section']} ไม่ครบ ({len(kinds)}/{len(pages)}) — ไม่แยกรูป")
            kinds = ["checklist"] * len(pages)
        for page, kind in zip(pages, kinds):
            (photo_pages if kind == "photos" else checklist_pages).append(page)

    if not checklist_pages and not photo_pages:
        raise ValueError("ไม่มีส่วนไหนเรนเดอร์ได้")

    writer = PdfWriter()
    for page in checklist_pages + photo_pages:
        writer.add_page(page)
    numbers = _page_number_overlay(len(writer.pages), lang)
    for page, number in zip(writer.pages, numbers.pages):
        page.merge_page(number)
    buf = io.BytesIO()
    writer.write(buf)
    writer.close()
    return buf.getvalue()


async def build_job_pdf(job: dict, station_id: str, lang: str, part: str = "") -> tuple[bytes, list[str]]:
    """
    PDF ของทั้งใบ — ใช้ template เดิมของแต่ละชนิด เรียง Charger ก่อน (ตู้ละชุด ตามหมายเลขตู้)
    แล้วตามด้วยอุปกรณ์ไฟฟ้า Station → CB_BOX → MDB → CCB ส่วนที่ยังไม่ได้กรอกจะถูกข้าม
    part = "station" (Station + MDB + CCB + CB_BOX) / "charger" (ทุกตู้) = PDF ของการ์ดนั้นอย่างเดียว
    ทุกแบบเรียง checklist ของทุกส่วนก่อน แล้วรูปตามหลัง
    ช่องลายเซ็นพิมพ์ชื่อผู้ทำ (inspector ของฟอร์ม) และผู้อนุมัติ
    (ตู้ของ vendor ที่มี planner เอง = planner vendor ที่อนุมัติ / อื่น ๆ = ผู้อนุมัติทั้งใบ เมื่อปิดใบแล้ว)

    ใบที่อนุมัติแล้วใช้ไฟล์ใน cache (สร้างไว้ตอนอนุมัติ) — ไม่มีก็สร้างแล้วเก็บไว้
    ใบที่ยังไม่ปิดเรนเดอร์สดทุกครั้ง (เนื้อหายังเปลี่ยนได้)
    Raises HTTPException 404 เมื่อยังไม่มีส่วนไหนถูกกรอก
    """
    # import ตรงนี้ กัน import วนกับ pdf_routes1 ที่ import main
    from pdf.pdf_routes1 import TEMPLATE_MAP

    job_id = str(job["_id"])
    closed = _is_closed(str(job.get("status") or ""))
    cache = job_pdf_cache_path(station_id, job_id, lang, part)
    if closed and cache.exists():
        return cache.read_bytes(), ["cache"]

    wanted = PDF_PARTS.get(part) if part else None
    states = [s for s in await _section_states(job) if wanted is None or s["section"] in wanted]
    # ลำดับในเล่ม: ตู้ชาร์จ → Station → CB_BOX → MDB → CCB — sort แบบ stable จึงคงลำดับตู้เดิม
    # (SECTIONS ไม่แก้ เพราะหน้าเว็บ/ตารางใช้ลำดับนั้น)
    states.sort(key=lambda s: PDF_SECTION_ORDER.get(s["section"], len(PDF_SECTION_ORDER)))
    vendor_approvers = await _charger_vendor_approvers(job, states)
    job_approver = str(job.get("approved_by") or "") if closed else ""
    job_approved_date = _approval_date(job.get("approved_at")) if closed else ""

    parts: list[tuple[dict, dict, dict]] = []
    included: list[str] = []
    for state in states:
        if not state["report_id"]:
            continue
        info = TEMPLATE_MAP.get(SECTION_PDF_KIND[state["section"]])
        if not info:
            continue
        coll = section_collection(state["section"], station_id, state.get("sn") or "")
        doc = await coll.find_one({"_id": ObjectId(state["report_id"])})
        if not doc:
            continue
        # ให้ทุกส่วนพิมพ์เลขที่/ชื่อเอกสารของใบแม่ — เป็นเอกสารใบเดียวกัน
        # ช่องลายเซ็น: ตู้ของ vendor ที่มี planner เอง (อนุมัติ 2 ชั้น) = Approved by planner vendor
        # + Witnessed by planner ต้นทางที่อนุมัติปิดใบ / ส่วนอื่น = Approved by planner ต้นทาง, Witnessed ว่าง
        vendor_approver, vendor_approved_date = vendor_approvers.get(state.get("sn") or "") or ("", "")
        doc = {**doc, "issue_id": job.get("issue_id") or doc.get("issue_id"),
               "doc_name": job.get("doc_name") or doc.get("doc_name"),
               "_signers": {
                   "performed": str(doc.get("inspector") or state.get("inspector") or ""),
                   "approved": vendor_approver or job_approver,
                   "witnessed": job_approver if vendor_approver else "",
                   # วันที่ใต้ลายเซ็น: ผู้ปฏิบัติงาน = วันที่ PM (template ใส่เอง) / ผู้อนุมัติ, ผู้เห็นชอบ = วันที่อนุมัติ
                   "approved_date": vendor_approved_date if vendor_approver else job_approved_date,
                   "witnessed_date": job_approved_date if vendor_approver else "",
               }}
        parts.append((state, doc, info))
        included.append(f"{state['section']}:{state['sn']}" if state.get("sn") else state["section"])

    if not parts:
        raise HTTPException(
            status_code=404,
            detail="ส่วนนี้ยังไม่มีฟอร์มที่กรอกแล้ว จึงยังไม่มี PDF" if part
            else "ใบนี้ยังไม่มีส่วนไหนถูกกรอก จึงยังไม่มี PDF",
        )

    # รูปในเอกสารอ้างด้วย path สัมพัทธ์ — ตอนไม่มี request (สร้างตอนอนุมัติ) ต้องมี base URL จาก env
    import os
    if not os.environ.get("APP_BASE_URL"):
        base = os.getenv("PUBLIC_BASE_URL", os.getenv("FRONTEND_BASE_URL", "")).rstrip("/")
        if base:
            os.environ["APP_BASE_URL"] = base

    try:
        data = await asyncio.to_thread(_render_job_pdf, parts, lang)
    except ValueError:
        raise HTTPException(status_code=500, detail="สร้าง PDF ของใบนี้ไม่สำเร็จ")
    except Exception as e:
        # ต่อ PDF ไม่สำเร็จ (เช่น server ยังไม่ได้ติดตั้ง pypdf) — บอกสาเหตุแทน "Internal Server Error" เปล่า ๆ
        log.exception(f"  ⚠️ ต่อ PDF ใบ {job.get('issue_id') or job_id} ไม่สำเร็จ")
        raise HTTPException(status_code=500, detail=f"สร้าง PDF ของใบนี้ไม่สำเร็จ: {type(e).__name__}: {e}")

    if closed:
        try:
            cache.parent.mkdir(parents=True, exist_ok=True)
            # เขียนไฟล์ชั่วคราวก่อนแล้วค่อย rename — กันคนเปิดระหว่างเขียนแล้วได้ไฟล์ครึ่งใบ
            tmp = cache.with_suffix(".pdf.part")
            tmp.write_bytes(data)
            tmp.replace(cache)
        except Exception as e:
            log.warning(f"  ⚠️ เก็บ PDF ใบ {job_id} ลง cache ไม่สำเร็จ: {e}")
    return data, included


@router.get("/stationpmjob/{job_id}/pdf")
async def export_station_pm_job_pdf(
    job_id: str,
    station_id: str = Query(...),
    lang: str = Query("th"),
    dl: int = Query(0, description="1 = ดาวน์โหลด, 0 = เปิดดูในเบราว์เซอร์"),
    part: str = Query("", description="station = การ์ด Station (Station/MDB/CCB/CB_BOX), charger = การ์ดตู้ชาร์จ, ว่าง = ทั้งใบ"),
    current: UserClaims = Depends(get_current_user),
):
    """PDF ของทั้งใบ หรือของการ์ดเดียว (ดู build_job_pdf)"""
    station_id = station_id.strip()
    part = part.strip().lower()
    if part and part not in PDF_PARTS:
        raise HTTPException(status_code=400, detail=f"part ไม่ถูกต้อง: {part}")
    jobs = get_stationpmjob_collection_for(station_id)
    job = await jobs.find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")

    # PDF รายการ์ดโหลดได้เฉพาะใบที่อนุมัติแล้ว (Closed) — ตรงกับปุ่มในหน้ารวม
    if part and not _is_closed(str(job.get("status") or "")):
        raise HTTPException(status_code=409, detail="โหลด PDF ได้หลังอนุมัติใบงานแล้ว (Closed)")

    data, included = await build_job_pdf(job, station_id, lang, part)

    filename = f"{(job.get('issue_id') or job_id)}{f'_{part}' if part else ''}.pdf".replace("/", "-")
    disposition = "attachment" if dl else "inline"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "X-PM-Sections": ",".join(included),
        },
    )
