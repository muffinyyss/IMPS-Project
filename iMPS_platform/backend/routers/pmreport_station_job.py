"""
routers/pmreport_station_job.py
===============================
ใบ PM สถานี "ใบเดียว 5 ส่วน" — Station / MDB / CCB / CB_BOX / Charger

ที่มา: เดิม 5 ชนิดนี้เป็นคนละเอกสาร คนละเลขที่ คนละ PDF คนละคิวอนุมัติ
ทั้งที่ช่างเข้าสถานีรอบเดียวแล้วตรวจทั้งหมดพร้อมกัน ตอนนี้รวมเป็น
เอกสารใบเดียว (1 เลขที่ / 1 PDF / อนุมัติครั้งเดียว) ที่ข้างในแบ่งเป็น 5 ส่วน
กรอกแยกทีละส่วนได้

ส่วน Charger ต่างจากอีก 4 ส่วนตรงที่สถานีหนึ่งมีหลายตู้ จึงมีใบย่อยได้หลายใบ
(ตู้ละ 1 ใบ) แต่ยังนับเป็น "ส่วนที่ 5" ส่วนเดียว และใช้เลขที่เอกสารใบเดียวกัน

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

import io
import logging
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

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

# 5 ส่วนของใบ PM สถานี — ลำดับนี้คือลำดับที่โชว์ในหน้าเว็บและเรียงหน้าใน PDF
SECTIONS: tuple[str, ...] = ("station", "mdb", "ccb", "cbbox", "charger")

# ส่วนที่ผูกกับตู้ (keyed ด้วย SN) ไม่ใช่กับสถานี — มีใบย่อยได้หลายใบในส่วนเดียว
CHARGER_SECTION = "charger"

SECTION_LABELS: dict[str, dict[str, str]] = {
    "station": {"th": "สถานี", "en": "Station"},
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

    Returns: {"status", "ready_to_submit", "missing": [state ของส่วนที่ยังขาด]}
    """
    filled = [s for s in section_states if s.get("report_id")]
    statuses = [_norm_status(s.get("status")) for s in filled]
    # ปิดหมดแล้ว = อนุมัติไปแล้ว — ใบที่อนุมัติไว้ก่อนมีกติกาครบแผนก็ยังเป็น Closed
    if filled and all(_is_closed(x) for x in statuses):
        return {"status": pm_flow.PM_STATUS_CLOSED, "ready_to_submit": False, "missing": []}

    def sent(s: dict) -> bool:
        st = _norm_status(s.get("status"))
        return bool(s.get("report_id")) and (_is_wait(st) or _is_closed(st))

    present = {section_key(s["section"], s.get("sn") or "") for s in section_states}
    need = (required & present) if required else set()
    if not need:
        need = present
    missing = [
        s for s in section_states
        if not sent(s) and (section_key(s["section"], s.get("sn") or "") in need or s.get("report_id"))
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
            {"_id": 1, "status": 1, "side": 1, "inspector": 1, "updatedAt": 1, "summary": 1},
            sort=[("_id", -1)] if section == CHARGER_SECTION else [("createdAt", -1)],
        )
    except Exception as e:  # collection ยังไม่มี = ยังไม่เคยกรอกส่วนนี้
        log.warning(f"  ⚠️ อ่านส่วน {section}{f'/{sn}' if sn else ''} ของใบ {job_id} ไม่สำเร็จ: {e}")
        return None


def _state_row(section: str, label: dict, doc: dict | None, sn: str = "", charger_no: str = "") -> dict:
    return {
        "section": section,
        "label": label,
        "sn": sn,
        "charger_no": charger_no,
        "report_id": str(doc["_id"]) if doc else "",
        "status": _norm_status(doc.get("status")) if doc else "",
        "side": (doc or {}).get("side") or "",
        "inspector": (doc or {}).get("inspector") or "",
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
                out.append(_state_row(section, label, doc, sn=sn, charger_no=no))
            continue
        doc = await _find_section_report(section, station_id, "", job_id)
        out.append(_state_row(section, SECTION_LABELS[section], doc))
    return out


def _sections_done(sections: list[dict]) -> int:
    """
    นับ "ส่วนที่กรอกแล้ว" แบบ 1 ส่วน = 1 หน่วย เต็มที่ 5

    ส่วน charger มีหลายใบย่อย นับว่ากรอกแล้วต่อเมื่อครบทุกตู้ของสถานี
    """
    done = 0
    for section in SECTIONS:
        rows = [s for s in sections if s.get("section") == section]
        if rows and all(s.get("report_id") for s in rows):
            done += 1
    return done


def _iso(v: Any) -> str:
    return v.isoformat() if isinstance(v, datetime) else (v or "")


def _serialize_job(job: dict, sections: list[dict], required: set[SectionKey] | None = None) -> dict:
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
        "sections_total": len(SECTIONS),
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
    }


# ══════════════════════════════════════════════════════════════════
# เปิดใบใหม่ / หาใบเดิมของรอบนั้น
# ══════════════════════════════════════════════════════════════════

class OpenJobIn(BaseModel):
    station_id: str
    pm_date: str                      # YYYY-MM-DD
    wonum: Optional[str] = None
    inspector: Optional[str] = None


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

    existing = await jobs.find_one(
        {"wonum": wonum} if wonum else {"pm_date": pm_date, "wonum": {"$in": ["", None]}}
    )
    if existing:
        return {"ok": True, "created": False,
                "job": _serialize_job(existing, await _section_states(existing), await job_planned_keys(existing))}

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
    }
    res = await jobs.insert_one(doc)
    saved = await jobs.find_one({"_id": res.inserted_id}) or {**doc, "_id": res.inserted_id}
    log.info(f"  ✅ เปิดใบ PM สถานี {issue_id} ({station_id}, wonum={wonum or '-'})")
    return {"ok": True, "created": True,
            "job": _serialize_job(saved, await _section_states(saved), await job_planned_keys(saved))}


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
    chargers = station_chargers(station_id)   # ทุกใบในหน้านี้เป็นสถานีเดียวกัน
    plans = await planned_keys_by_wonum([str(j.get("wonum") or "") for j in docs])
    items = [
        _serialize_job(j, await _section_states(j, chargers), plans.get(str(j.get("wonum") or "").strip()))
        for j in docs
    ]
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
    job = await get_stationpmjob_collection_for(station_id).find_one({"wonum": wonum}, {"_id": 1})
    return {"id": str(job["_id"]) if job else ""}


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
    return {"job": _serialize_job(job, await _section_states(job), await job_planned_keys(job))}


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
# ช่างกด "ปิดใบงาน" — ส่งทั้งใบเข้าคิวอนุมัติ
# ══════════════════════════════════════════════════════════════════

class SubmitJobIn(BaseModel):
    work_start: str                       # datetime-local ของไทย "YYYY-MM-DDTHH:MM"
    work_finish: str
    maximo_labor: list[str] = []          # laborcode ที่ลงเวลาเข้า Maximo (IN09)
    maximo_contractor: str = ""           # ชื่อจริง เมื่อเลือกรหัสกลางของผู้รับเหมา


@router.post("/stationpmjob/{job_id}/submit")
async def submit_station_pm_job(
    job_id: str,
    body: SubmitJobIn,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ส่งทั้งใบให้ planner อนุมัติ — ใบจะเป็น Wait for approve ก็ต่อเมื่อช่างกดตรงนี้
    (ส่งครบทุกส่วนแล้วยังไม่ขึ้นเอง ช่างจะได้ทบทวนทั้งใบก่อน)

    กดได้เมื่อส่งครบทุกส่วนตามแผน และไม่มีส่วนที่ยังแก้ค้างอยู่
    เวลาทำงาน + ช่างที่ลงเวลา Maximo กรอกครั้งเดียวตรงนี้ (ไม่ต้องกรอกซ้ำทุกส่วน)
    แล้วเขียนลงใบลูกทุกใบ เพราะตอนอนุมัติ IN09 อ่านจากใบลูก
    """
    from services.cm_maximo import CONTRACTOR_LABOR_CODE

    work_start, work_finish = pm_flow.validate_work_time(body.work_start, body.work_finish)
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
    }
    station_id = station_id.strip()
    jobs = get_stationpmjob_collection_for(station_id)
    job = await jobs.find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")

    required = await job_planned_keys(job)
    sections = await _section_states(job)
    progress = job_progress(sections, required, _job_submitted(job))
    if progress["status"] != pm_flow.PM_STATUS_DRAFT:
        raise HTTPException(status_code=409, detail=f"ใบนี้เป็น {progress['status']} อยู่แล้ว")
    if not progress["ready_to_submit"]:
        names = ", ".join((s.get("label") or {}).get("th") or s["section"] for s in progress["missing"])
        raise HTTPException(
            status_code=400,
            detail=f"ยังกรอกไม่ครบ: {names}" if names else "ยังไม่มีส่วนไหนถูกกรอก",
        )

    # เขียนลงใบลูกทุกใบที่ส่งแล้วก่อน — ใบแม่จะได้ไม่ขึ้นรออนุมัติทั้งที่ใบลูกยังไม่มีเวลา
    for state in sections:
        if not state["report_id"]:
            continue
        sn = state.get("sn") or ""
        coll = section_collection(state["section"], station_id, sn)
        await coll.update_one({"_id": ObjectId(state["report_id"])}, {"$set": work})

    now = datetime.now(timezone.utc)
    await jobs.update_one(
        {"_id": job["_id"]},
        {"$set": {
            **work,
            "submitted_at": now,
            "submitted_by": current.username or current.sub,
            "status": pm_flow.PM_STATUS_WAIT_APPROVE,
            "updatedAt": now,
        }},
    )
    fresh = await jobs.find_one({"_id": job["_id"]}) or job
    log.info(f"  ✅ ปิดใบงาน PM สถานี {fresh.get('issue_id') or job_id} → รออนุมัติ ({current.username or current.sub})")
    return {"ok": True, "job": _serialize_job(fresh, sections, required)}


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
    if _job_submitted(job):
        raise HTTPException(status_code=409, detail="ใบนี้กดปิดใบงานแล้ว แก้ไขไม่ได้")

    group = (body.group or "").strip()
    url = (body.url or "").strip()
    if not group or "." in group or "$" in group or not url:
        raise HTTPException(status_code=400, detail="Bad photo reference")

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
# อนุมัติ / ตีกลับ ทั้งใบ (ทุกส่วนพร้อมกัน)
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
    return {"ok": True, "results": results, "job": _serialize_job(fresh, sections, required)}


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
    await jobs.update_one(
        {"_id": job["_id"]},
        {
            "$set": {
                "status": derive_job_status(sections, required),
                "reject_remark": body.remark,
                "rejected_by": current.username or current.sub,
            },
            # ตีกลับ = ช่างต้องแก้แล้วกด "ปิดใบงาน" ใหม่
            "$unset": {"submitted_at": "", "submitted_by": ""},
        },
    )
    fresh = await jobs.find_one({"_id": job["_id"]}) or job
    return {"ok": True, "results": results, "job": _serialize_job(fresh, sections, required)}


# ══════════════════════════════════════════════════════════════════
# PDF ใบเดียวจบ — ต่อ PDF ของแต่ละส่วนเข้าด้วยกัน
# ══════════════════════════════════════════════════════════════════

@router.get("/stationpmjob/{job_id}/pdf")
async def export_station_pm_job_pdf(
    job_id: str,
    station_id: str = Query(...),
    lang: str = Query("th"),
    dl: int = Query(0, description="1 = ดาวน์โหลด, 0 = เปิดดูในเบราว์เซอร์"),
    current: UserClaims = Depends(get_current_user),
):
    """
    PDF ของทั้งใบ = PDF ของแต่ละส่วนต่อกันตามลำดับ
    Station → MDB → CCB → CB_BOX → Charger (ตู้ละชุด เรียงตามหมายเลขตู้)

    ใช้ template เดิมของแต่ละชนิด (ไม่ได้เขียนใหม่) แล้วรวมไฟล์ด้วย pypdf
    ส่วนที่ยังไม่ได้กรอกจะถูกข้ามไป
    """
    from pypdf import PdfWriter

    station_id = station_id.strip()
    jobs = get_stationpmjob_collection_for(station_id)
    job = await jobs.find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")

    # import ตรงนี้ กัน import วนกับ pdf_routes1 ที่ import main
    from pdf.pdf_routes1 import TEMPLATE_MAP

    writer = PdfWriter()
    included: list[str] = []
    for state in await _section_states(job):
        if not state["report_id"]:
            continue
        kind = SECTION_PDF_KIND[state["section"]]
        info = TEMPLATE_MAP.get(kind)
        if not info:
            continue
        coll = section_collection(state["section"], station_id, state.get("sn") or "")
        doc = await coll.find_one({"_id": ObjectId(state["report_id"])})
        if not doc:
            continue
        # ให้ทุกส่วนพิมพ์เลขที่/ชื่อเอกสารของใบแม่ — เป็นเอกสารใบเดียวกัน
        doc = {**doc, "issue_id": job.get("issue_id") or doc.get("issue_id"),
               "doc_name": job.get("doc_name") or doc.get("doc_name")}
        try:
            part = info["func"](doc, lang=lang)
        except TypeError:
            part = info["func"](doc)
        except Exception as e:
            log.warning(f"  ⚠️ สร้าง PDF ส่วน {state['section']} {state.get('sn') or ''} ของใบ {job_id} ไม่สำเร็จ: {e}")
            continue
        try:
            writer.append(io.BytesIO(part))
            included.append(f"{state['section']}:{state['sn']}" if state.get("sn") else state["section"])
        except Exception as e:
            log.warning(f"  ⚠️ ต่อ PDF ส่วน {state['section']} {state.get('sn') or ''} ไม่สำเร็จ: {e}")

    if not included:
        raise HTTPException(status_code=404, detail="ใบนี้ยังไม่มีส่วนไหนถูกกรอก จึงยังไม่มี PDF")

    buf = io.BytesIO()
    writer.write(buf)
    writer.close()
    data = buf.getvalue()

    filename = f"{(job.get('issue_id') or job_id)}.pdf".replace("/", "-")
    disposition = "attachment" if dl else "inline"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "X-PM-Sections": ",".join(included),
        },
    )
