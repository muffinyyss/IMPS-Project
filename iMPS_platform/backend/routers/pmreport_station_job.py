"""
routers/pmreport_station_job.py
===============================
ใบ PM สถานี "ใบเดียว 4 ส่วน" — Station / MDB / CCB / CB_BOX

ที่มา: เดิม 4 ชนิดนี้เป็นคนละเอกสาร คนละเลขที่ คนละ PDF คนละคิวอนุมัติ
ทั้งที่ช่างเข้าสถานีรอบเดียวแล้วตรวจทั้ง 4 อย่างพร้อมกัน ตอนนี้รวมเป็น
เอกสารใบเดียว (1 เลขที่ / 1 PDF / อนุมัติครั้งเดียว) ที่ข้างในแบ่งเป็น 4 ส่วน
กรอกแยกทีละส่วนได้

โครงเก็บข้อมูล — ตั้งใจไม่ย้ายเนื้อ checklist ออกจากที่เดิม:
  stationPMJob.<station_id>   ← เอกสารแม่ (เลขที่, วันที่, สถานะรวม, ใบงาน Maximo)
  stationPMReport.<station_id> / MDBPMReport.<...> / CCBPMReport / CBBOXPMReport
                              ← เนื้อ checklist ของแต่ละส่วน (เหมือนเดิมทุกอย่าง)
                                ผูกกลับมาที่แม่ด้วย field job_id
ผลคือฟอร์มกรอก, การอัปโหลดรูป และ template PDF ของแต่ละส่วนใช้ของเดิมได้ทั้งหมด
ส่วนเลขที่เอกสาร/ชื่อเอกสารให้ลูกทุกใบ "ยืมของแม่" ใบเดียวกัน

PDF: /stationpmjob/{job_id}/pdf — เรนเดอร์ PDF ของแต่ละส่วนด้วย template
เดิม แล้วต่อกันเป็นไฟล์เดียวด้วย pypdf
"""

from __future__ import annotations

import io
import logging
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from config import station_collection
from deps import UserClaims, get_current_user
from routers import pm_flow
from routers.pm_helpers import (
    get_cbboxpmreport_collection_for,
    get_ccbpmreport_collection_for,
    get_mdbpmreport_collection_for,
    get_stationpmjob_collection_for,
    get_stationpmreport_collection_for,
    _next_issue_id_no_conflict,
    _next_year_seq,
    get_stationpmurl_coll_upload,
)

log = logging.getLogger("uvicorn.error")

router = APIRouter()

# 4 ส่วนของใบ PM สถานี — ลำดับนี้คือลำดับที่โชว์ในหน้าเว็บและเรียงหน้าใน PDF
SECTIONS: tuple[str, ...] = ("station", "mdb", "ccb", "cbbox")

SECTION_LABELS: dict[str, dict[str, str]] = {
    "station": {"th": "สถานี", "en": "Station"},
    "mdb": {"th": "MDB", "en": "MDB"},
    "ccb": {"th": "CCB", "en": "CCB"},
    "cbbox": {"th": "CB_BOX", "en": "CB_BOX"},
}

# ชนิดส่วน → template PDF ของ /pdf/{kind}/{id}/export เดิม
SECTION_PDF_KIND: dict[str, str] = {
    "station": "station",
    "mdb": "mdb",
    "ccb": "ccb",
    "cbbox": "cbbox",
}

JobStatus = Literal["draft", "Wait for approve", "Closed"]


def section_collection(section: str, station_id: str):
    """collection ที่เก็บเนื้อ checklist ของส่วนนั้น (ของเดิม ไม่ได้ย้าย)"""
    getter = {
        "station": get_stationpmreport_collection_for,
        "mdb": get_mdbpmreport_collection_for,
        "ccb": get_ccbpmreport_collection_for,
        "cbbox": get_cbboxpmreport_collection_for,
    }.get(section)
    if not getter:
        raise HTTPException(status_code=400, detail=f"ส่วนของเอกสารไม่ถูกต้อง: {section}")
    return getter(station_id)


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


def derive_job_status(section_states: list[dict]) -> str:
    """
    สถานะของใบแม่ = สรุปจากส่วนที่กรอกแล้ว

      ยังไม่มีส่วนไหนถูกกรอก / มีส่วนที่ยังเป็น draft → draft
      ส่วนที่กรอกแล้วรออนุมัติอยู่อย่างน้อย 1 ส่วน    → Wait for approve
      กรอกแล้วและปิดครบทุกส่วนที่มี                  → Closed

    ใบที่ยังไม่ได้เริ่มกรอกไม่ถ่วงสถานะ — ช่างอาจไม่ได้ตรวจครบทั้ง 4 ส่วนในรอบนั้น
    """
    filled = [s for s in section_states if s.get("report_id")]
    if not filled:
        return pm_flow.PM_STATUS_DRAFT
    statuses = [_norm_status(s.get("status")) for s in filled]
    if any(not _is_closed(x) and not _is_wait(x) for x in statuses):
        return pm_flow.PM_STATUS_DRAFT
    if any(_is_wait(x) for x in statuses):
        return pm_flow.PM_STATUS_WAIT_APPROVE
    return pm_flow.PM_STATUS_CLOSED


async def _section_states(job: dict) -> list[dict]:
    """สถานะของทั้ง 4 ส่วนในใบนี้ — อ่านจากใบลูกจริง ไม่ได้เชื่อค่าที่ cache ไว้"""
    station_id = str(job.get("station_id") or "")
    job_id = str(job.get("_id"))
    out: list[dict] = []
    for section in SECTIONS:
        try:
            coll = section_collection(section, station_id)
            doc = await coll.find_one(
                {"job_id": job_id},
                {"_id": 1, "status": 1, "side": 1, "inspector": 1, "updatedAt": 1, "summary": 1},
                sort=[("createdAt", -1)],
            )
        except Exception as e:  # collection ยังไม่มี = ยังไม่เคยกรอกส่วนนี้
            log.warning(f"  ⚠️ อ่านส่วน {section} ของใบ {job_id} ไม่สำเร็จ: {e}")
            doc = None
        out.append({
            "section": section,
            "label": SECTION_LABELS[section],
            "report_id": str(doc["_id"]) if doc else "",
            "status": _norm_status(doc.get("status")) if doc else "",
            "side": (doc or {}).get("side") or "",
            "inspector": (doc or {}).get("inspector") or "",
        })
    return out


def _serialize_job(job: dict, sections: list[dict]) -> dict:
    status = derive_job_status(sections)
    done = sum(1 for s in sections if s.get("report_id"))
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
        return {"ok": True, "created": False, "job": _serialize_job(existing, await _section_states(existing))}

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
    return {"ok": True, "created": True, "job": _serialize_job(saved, await _section_states(saved))}


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
    items = [_serialize_job(j, await _section_states(j)) for j in docs]
    return {"items": items, "total": len(items)}


@router.get("/stationpmjob/{job_id}")
async def get_station_pm_job(
    job_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """รายละเอียดใบ 1 ใบ + สถานะของทั้ง 4 ส่วน (ให้หน้า hub เอาไปแสดง)"""
    station_id = station_id.strip()
    jobs = get_stationpmjob_collection_for(station_id)
    job = await jobs.find_one({"_id": pm_flow.to_oid(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบ PM สถานี id={job_id}")
    return {"job": _serialize_job(job, await _section_states(job))}


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

    results: list[dict] = []
    for state in await _section_states(job):
        if not state["report_id"] or not _is_wait(state["status"]):
            continue
        coll = section_collection(state["section"], station_id)
        try:
            await pm_flow.approve(coll, ObjectId(state["report_id"]), {"station_id": station_id}, current)
            results.append({"section": state["section"], "ok": True})
        except HTTPException as e:
            results.append({"section": state["section"], "ok": False, "detail": e.detail})

    sections = await _section_states(job)
    status = derive_job_status(sections)
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
    return {"ok": True, "results": results, "job": _serialize_job(fresh, sections)}


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
        coll = section_collection(state["section"], station_id)
        try:
            await pm_flow.reject(coll, ObjectId(state["report_id"]), {"station_id": station_id}, current, body.remark)
            results.append({"section": state["section"], "ok": True})
        except HTTPException as e:
            results.append({"section": state["section"], "ok": False, "detail": e.detail})

    sections = await _section_states(job)
    await jobs.update_one(
        {"_id": job["_id"]},
        {"$set": {
            "status": derive_job_status(sections),
            "reject_remark": body.remark,
            "rejected_by": current.username or current.sub,
        }},
    )
    fresh = await jobs.find_one({"_id": job["_id"]}) or job
    return {"ok": True, "results": results, "job": _serialize_job(fresh, sections)}


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
    PDF ของทั้งใบ = PDF ของแต่ละส่วนต่อกันตามลำดับ Station → MDB → CCB → CB_BOX

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
        coll = section_collection(state["section"], station_id)
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
            log.warning(f"  ⚠️ สร้าง PDF ส่วน {state['section']} ของใบ {job_id} ไม่สำเร็จ: {e}")
            continue
        try:
            writer.append(io.BytesIO(part))
            included.append(state["section"])
        except Exception as e:
            log.warning(f"  ⚠️ ต่อ PDF ส่วน {state['section']} ไม่สำเร็จ: {e}")

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
