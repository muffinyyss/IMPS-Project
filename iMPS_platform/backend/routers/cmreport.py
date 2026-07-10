"""CM (Corrective Maintenance) Report routes"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from datetime import datetime, timezone, date
from bson.objectid import ObjectId
from pymongo import ReturnDocument
from typing import List, Dict, Any, Optional, Literal
import re, json, uuid, pathlib, secrets, os

from config import (
    normalize_pm_date, _ensure_utc_iso,
    CMReportDB, CMUrlDB, DCTestReportDB, DCUrlDB,
    station_collection, _validate_station_id_th, th_tz,
)
from services.maximo import create_sr as maximo_create_sr          # ← A) เพิ่ม
import inspect                                                     # ← รองรับทั้ง sync/async

ALLOWED_EXTS = {"jpg", "jpeg", "png", "webp", "gif", "pdf", "heic", "heif"}
MAX_FILE_MB = 20
from deps import UserClaims, get_current_user

router = APIRouter()

# ---------------------------------------------------------------------
def get_cmreport_collection_for(station_id: str):
    _validate_station_id_th(station_id)
    coll = CMReportDB.get_collection(str(station_id))
    return coll

def get_cmurl_coll_upload(station_id: str):
    _validate_station_id_th(station_id)
    coll = CMUrlDB.get_collection(str(station_id))
    return coll

# ==================== ISSUE_ID & DOC_NAME HELPERS ====================

def make_cm_doc_prefix(station_id: str) -> str:
    """สร้าง prefix สำหรับ doc_name: {station_id}_"""
    return f"{station_id}_"

# counter กลางสำหรับ running number ของ CM issue_id (เลขเดียวทั้งระบบ ไม่แยกสถานี)
CM_ISSUE_COUNTER_COLL = CMReportDB.get_collection("_cm_issue_counter")
CM_ISSUE_COUNTER_KEY = "cm_issue_id"

def _format_cm_issue_id(seq: int) -> str:
    return f"CM-{seq:03d}"

async def get_next_cm_issue_id(station_id: str = "", found_date: str = "") -> str:
    """
    ออก issue_id ถัดไปแบบ atomic ($inc บน counter เดียว) — เลขไม่ซ้ำแม้สร้างพร้อมกัน
    Format: CM-001, CM-002, ... (เกิน 999 จะเป็น CM-1000 ต่อเนื่อง)
    station_id/found_date คงไว้เพื่อ backward compatibility ของผู้เรียกเดิม
    """
    doc = await CM_ISSUE_COUNTER_COLL.find_one_and_update(
        {"_id": CM_ISSUE_COUNTER_KEY},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return _format_cm_issue_id(int(doc["seq"]))

async def peek_next_cm_issue_id() -> str:
    """ดู issue_id ถัดไปโดยไม่ขยับ counter (สำหรับ preview เท่านั้น)"""
    doc = await CM_ISSUE_COUNTER_COLL.find_one({"_id": CM_ISSUE_COUNTER_KEY})
    seq = int(doc.get("seq", 0)) if doc else 0
    return _format_cm_issue_id(seq + 1)

async def get_next_cm_doc_name(station_id: str, found_date: str) -> str:
    """
    หา doc_name ถัดไป
    Format: {station_id}_{seq}/{year}  เช่น ST001_1/2025, ST001_2/2025
    """
    d = datetime.fromisoformat(found_date) if found_date else datetime.now(th_tz)
    year = d.year
    prefix = make_cm_doc_prefix(station_id)  # "{station_id}_"

    report_coll = get_cmreport_collection_for(station_id)
    url_coll = get_cmurl_coll_upload(station_id)

    # regex: {station_id}_\d+/{year}
    pattern = f"^{re.escape(prefix)}\\d+/{year}$"

    all_names = []
    for coll in [report_coll, url_coll]:
        cursor = coll.find(
            {"doc_name": {"$regex": pattern}},
            {"doc_name": 1}
        )
        async for doc in cursor:
            if doc.get("doc_name"):
                all_names.append(doc["doc_name"])

    if not all_names:
        return f"{prefix}1/{year}"

    # หา seq สูงสุดจาก pattern {station_id}_{seq}/{year}
    max_seq = 0
    for name in all_names:
        m = re.search(r"_(\d+)/\d{4}$", name)
        if m:
            num = int(m.group(1))
            if num > max_seq:
                max_seq = num

    return f"{prefix}{max_seq + 1}/{year}"

# ==================== PREVIEW ENDPOINTS ====================

@router.get("/cmreport/preview-docname")
async def cmreport_preview_docname(
    station_id: str = Query(...),
    found_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """Preview doc_name ที่จะได้รับสำหรับวันที่ระบุ"""
    
    found_date_normalized = normalize_pm_date(found_date)
    doc_name = await get_next_cm_doc_name(station_id, found_date_normalized)
    issue_id = await peek_next_cm_issue_id()
    
    return {
        "doc_name": doc_name,
        "issue_id": issue_id,
        "found_date": found_date_normalized,
    }

@router.get("/cmreport/latest-docname")
async def cmreport_latest_docname(
    station_id: str = Query(...),
    found_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    found_date_normalized = normalize_pm_date(found_date)
    d = datetime.fromisoformat(found_date_normalized) if found_date_normalized else datetime.now(th_tz)
    year = d.year
    prefix = make_cm_doc_prefix(station_id)  # ← new signature (no date)
    pattern = f"^{re.escape(prefix)}\\d+/{year}$"

    report_coll = get_cmreport_collection_for(station_id)
    url_coll = get_cmurl_coll_upload(station_id)

    latest = None
    max_num = 0

    for coll in [report_coll, url_coll]:
        cursor = coll.find(
            {"doc_name": {"$regex": pattern}},
            {"doc_name": 1}
        ).sort("doc_name", -1).limit(10)

        async for doc in cursor:
            name = doc.get("doc_name", "")
            m = re.search(r"_(\d+)/\d{4}$", name)
            if m:
                num = int(m.group(1))
                if num > max_num:
                    max_num = num
                    latest = name

    return {"doc_name": latest}

# ==================== UPDATED LIST ENDPOINTS ====================

@router.get("/cmreport/list")
async def cmreport_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
):
    coll = get_cmreport_collection_for(station_id)
    skip = (page - 1) * pageSize

    # Filter by status if provided
    mongo_filter: dict = {}
    if status:
        want = status.strip()
        mongo_filter["$or"] = [
            {"status": {"$regex": f"^{re.escape(want)}$", "$options": "i"}},
            {"job.status": {"$regex": f"^{re.escape(want)}$", "$options": "i"}},
        ]

    cursor = coll.find(mongo_filter, {
        "_id": 1, 
        "doc_name": 1,
        "issue_id": 1,
        "cm_date": 1, 
        "status": 1, 
        "reported_by": 1,
        "inspector": 1,
        "faulty_equipment": 1,
        "severity": 1,
        "problem_details": 1,
        "location": 1,
        "job": 1,
        "repair_result": 1,
        "repair_result_remark": 1,
        "maximo_ticket_id": 1,                                     # ← C) เพิ่ม
        "createdAt": 1
    }).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)
    
    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents(mongo_filter)

    # ดึงไฟล์จาก CMUrl โดย map ด้วย cm_date
    cm_dates = [it.get("cm_date") for it in items_raw if it.get("cm_date")]
    urls_coll = get_cmurl_coll_upload(station_id)
    url_by_day: dict[str, str] = {}

    if cm_dates:
        ucur = urls_coll.find({"cm_date": {"$in": cm_dates}}, {"cm_date": 1, "status": 1, "urls": 1})
        url_docs = await ucur.to_list(length=10_000)
        for u in url_docs:
            day = u.get("cm_date")
            first_url = (u.get("urls") or [None])[0]
            if day and first_url and day not in url_by_day:
                url_by_day[day] = first_url

    items = []
    for it in items_raw:
        job = it.get("job", {})
        items.append({
            "id": str(it["_id"]),
            "doc_name": it.get("doc_name") or "",
            "issue_id": it.get("issue_id") or job.get("issue_id") or "",
            "cm_date": it.get("cm_date"),
            "reported_by": it.get("reported_by") or job.get("reported_by") or "",
            "inspector": it.get("inspector") or job.get("inspector") or "",
            "status": it.get("status") or job.get("status") or "",
            "faulty_equipment": it.get("faulty_equipment") or job.get("faulty_equipment") or "",
            "problem_details": it.get("problem_details") or job.get("problem_details") or "",
            "severity": it.get("severity") or job.get("severity") or "",
            "location": it.get("location") or job.get("location") or "",
            "repair_result": it.get("repair_result") or job.get("repair_result") or "",
            "repair_result_remark": it.get("repair_result_remark") or "",
            "maximo_ticket_id": it.get("maximo_ticket_id") or "",  # ← C) เพิ่ม
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": url_by_day.get(it.get("cm_date") or "", ""),
        })

    return {
        "items": items,
        "page": page,
        "pageSize": pageSize,
        "total": total
    }


async def _cm_items_for_station(station_id: str, station_name: str, status: str | None) -> list[dict]:
    """ดึง CM report ของสถานีเดียว (merge กับ CMUrl ด้วย cm_date) + ใส่ station info"""
    coll = get_cmreport_collection_for(station_id)

    mongo_filter: dict = {}
    if status:
        want = status.strip()
        mongo_filter["$or"] = [
            {"status": {"$regex": f"^{re.escape(want)}$", "$options": "i"}},
            {"job.status": {"$regex": f"^{re.escape(want)}$", "$options": "i"}},
        ]

    cursor = coll.find(mongo_filter, {
        "_id": 1, "doc_name": 1, "issue_id": 1, "cm_date": 1, "status": 1,
        "reported_by": 1, "inspector": 1, "faulty_equipment": 1, "severity": 1,
        "problem_details": 1, "location": 1, "job": 1, "repair_result": 1,
        "repair_result_remark": 1, "maximo_ticket_id": 1, "createdAt": 1,
    }).sort([("createdAt", -1), ("_id", -1)])
    items_raw = await cursor.to_list(length=10_000)

    # map ไฟล์จาก CMUrl ด้วย cm_date
    cm_dates = [it.get("cm_date") for it in items_raw if it.get("cm_date")]
    url_by_day: dict[str, str] = {}
    if cm_dates:
        urls_coll = get_cmurl_coll_upload(station_id)
        ucur = urls_coll.find({"cm_date": {"$in": cm_dates}}, {"cm_date": 1, "urls": 1})
        for u in await ucur.to_list(length=10_000):
            day = u.get("cm_date")
            first_url = (u.get("urls") or [None])[0]
            if day and first_url and day not in url_by_day:
                url_by_day[day] = first_url

    out = []
    for it in items_raw:
        job = it.get("job", {})
        out.append({
            "id": str(it["_id"]),
            "station_id": station_id,
            "station_name": station_name,
            "doc_name": it.get("doc_name") or "",
            "issue_id": it.get("issue_id") or job.get("issue_id") or "",
            "cm_date": it.get("cm_date"),
            "reported_by": it.get("reported_by") or job.get("reported_by") or "",
            "inspector": it.get("inspector") or job.get("inspector") or "",
            "status": it.get("status") or job.get("status") or "",
            "faulty_equipment": it.get("faulty_equipment") or job.get("faulty_equipment") or "",
            "problem_details": it.get("problem_details") or job.get("problem_details") or "",
            "severity": it.get("severity") or job.get("severity") or "",
            "location": it.get("location") or job.get("location") or "",
            "repair_result": it.get("repair_result") or job.get("repair_result") or "",
            "repair_result_remark": it.get("repair_result_remark") or "",
            "maximo_ticket_id": it.get("maximo_ticket_id") or "",
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": url_by_day.get(it.get("cm_date") or "", ""),
        })
    return out


@router.get("/cmreport/list-all")
async def cmreport_list_all(
    status: str | None = Query(None),
    station_id: str | None = Query(None),
    limit: int = Query(10000, ge=1, le=50000, description="Max items to return"),
    skip: int = Query(0, ge=0, description="Items to skip (for pagination)"),
    current: UserClaims = Depends(get_current_user),
):
    """รวม CM report จากทุกสถานี (สำหรับหน้า CM report (All))"""
    import asyncio
    loop = asyncio.get_event_loop()

    station_query = {"station_id": station_id} if station_id else {}
    try:
        stations = await loop.run_in_executor(
            None,
            lambda: list(station_collection.find(
                station_query, {"_id": 0, "station_id": 1, "station_name": 1}
            )),
        )
    except Exception:
        stations = []

    if not stations:
        return {"items": [], "total": 0, "stations_count": 0}

    tasks = [
        _cm_items_for_station(s["station_id"], s.get("station_name", "-"), status)
        for s in stations
        if s.get("station_id")
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    items: list[dict] = []
    for r in results:
        if isinstance(r, list):
            items.extend(r)

    items.sort(key=lambda x: x.get("createdAt") or x.get("cm_date") or "", reverse=True)
    total = len(items)
    return {
        "items": items[skip : skip + limit],
        "total": total,
        "skip": skip,
        "limit": limit,
        "stations_count": len(stations),
    }


# ตำแหน่งโฟลเดอร์บนเครื่องเซิร์ฟเวอร์
UPLOADS_ROOT = os.getenv("UPLOADS_ROOT", "./uploads")
os.makedirs(UPLOADS_ROOT, exist_ok=True)

def _safe_name(name: str) -> str:
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return base[:120] or secrets.token_hex(4)

def _ext(fname: str) -> str:
    return (fname.rsplit(".",1)[-1].lower() if "." in fname else "")

@router.post("/cmreport/{report_id}/photos")
async def cmreport_upload_photos(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),
    phase: str = Form("problem"),
    files: list[UploadFile] = File(...),
    remark: str | None = Form(None),
    location: str | None = Form(None),     
    created_at: str | None = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    
    if phase not in ("problem", "repair"):
        raise HTTPException(status_code=400, detail="phase must be 'problem' or 'repair'")
    photo_field = f"photos_{phase}"

    if not re.fullmatch(r"[a-z][a-z0-9_]*", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_cmreport_collection_for(station_id)
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id":1, "station_id":1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    dest_dir = pathlib.Path(UPLOADS_ROOT) / "cm" / station_id / report_id / group
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    total = 0
    for f in files:
        ext = _ext(f.filename or "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        total += len(data)
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/cm/{station_id}/{report_id}/{group}/{fname}"
        uploaded_at = datetime.now(timezone.utc)
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "remark": remark or "",
            "location": location or "",  
            "uploadedAt": created_at or uploaded_at.isoformat(),
        })

    await coll.update_one(
        {"_id": oid},
        {"$push": {f"{photo_field}.{group}": {"$each": saved}}}
    )

    return {
        "ok": True, 
        "count": len(saved), 
        "group": group, 
        "phase": phase, 
        "files": [
            {
                **s, 
                "uploadedAt": s["uploadedAt"].isoformat() if isinstance(s["uploadedAt"], datetime) else s["uploadedAt"]
            } 
            for s in saved
        ]
    }


@router.post("/cmreport/{report_id}/finalize")
async def cmreport_finalize(
    report_id: str,
    station_id: str = Form(...),
    current: UserClaims = Depends(get_current_user),
):

    coll = get_cmreport_collection_for(station_id)
    from bson import ObjectId
    oid = ObjectId(report_id)
    res = await coll.update_one(
        {"_id": oid},
        {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}

@router.post("/cmurl/upload-files", status_code=201)
async def cmurl_upload_files(
    station_id: str = Form(...),
    reportDate: str = Form(...),
    files: list[UploadFile] = File(...),
    status: str = Form(...),  
    current: UserClaims = Depends(get_current_user),
):
    coll = get_cmurl_coll_upload(station_id)

    cm_date = normalize_pm_date(reportDate)

    issue_id = await get_next_cm_issue_id(station_id, cm_date)
    doc_name = await get_next_cm_doc_name(station_id, cm_date)

    subdir = cm_date
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "cmurl" / station_id / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)

    urls = []
    metas = []
    total_size = 0

    for f in files:
        ext = (f.filename.rsplit(".",1)[-1].lower() if "." in f.filename else "")
        if ext not in ALLOWED_EXTS or ext != "pdf":
            raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

        data = await f.read()
        total_size += len(data)
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        safe = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
        dest = dest_dir / safe
        with open(dest, "wb") as out:
            out.write(data)

        url = f"/uploads/cmurl/{station_id}/{subdir}/{safe}"
        urls.append(url)
        metas.append({"name": f.filename, "size": len(data)})

    now = datetime.now(timezone.utc)

    doc = {
        "station": station_id,
        "doc_name": doc_name,
        "issue_id": issue_id,
        "cm_date": cm_date,
        "status": (status or "").strip(), 
        "urls": urls,
        "meta": {"files": metas},
        "source": "upload-files",
        "createdAt": now,
        "updatedAt": now,
    }
    res = await coll.insert_one(doc)

    return {
        "ok": True, 
        "inserted_id": str(res.inserted_id), 
        "doc_name": doc_name,
        "issue_id": issue_id,
        "count": len(urls), 
        "urls": urls
    }

@router.get("/cmurl/list")
async def cmurl_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
):
    coll = get_cmurl_coll_upload(station_id)
    skip = (page - 1) * pageSize

    mongo_filter: dict = {}
    if status:
        want = (status or "").strip()
        mongo_filter["$or"] = [
            {"status": {"$regex": f"^{re.escape(want)}$", "$options": "i"}},
            {"job.status": {"$regex": f"^{re.escape(want)}$", "$options": "i"}},
        ]

    projection = {
        "_id": 1, 
        "doc_name": 1,
        "issue_id": 1,
        "cm_date": 1, 
        "reportDate": 1,
        "urls": 1, 
        "createdAt": 1,
        "status": 1, 
        "job": 1,
        "inspector": 1,
        "reported_by": 1,
        "faulty_equipment": 1,
    }

    cursor = (
        coll.find(mongo_filter, projection)
            .sort([("createdAt", -1), ("_id", -1)])
            .skip(skip)
            .limit(pageSize)
    )

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents(mongo_filter)

    def _cm_date_from(doc: dict) -> str | None:
        s = doc.get("cm_date")
        if isinstance(s, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
            return s
        rd = doc.get("reportDate")
        if isinstance(rd, datetime):
            return rd.astimezone(th_tz).date().isoformat()
        if isinstance(rd, str):
            try:
                dt = datetime.fromisoformat(rd.replace("Z", "+00:00"))
            except Exception:
                try:
                    dt = datetime.fromisoformat(rd).replace(tzinfo=th_tz)
                except Exception:
                    return None
            return dt.astimezone(th_tz).date().isoformat()
        return None

    items = []

    for it in items_raw:
        cm_date_str = _cm_date_from(it)
        urls = it.get("urls") or []
        first_url = urls[0] if urls else ""

        items.append({
            "id": str(it["_id"]),
            "doc_name": it.get("doc_name") or "",
            "issue_id": it.get("issue_id") or "",
            "cm_date": cm_date_str,
            "inspector": it.get("inspector") or "",
            "reported_by": it.get("reported_by") or "",
            "faulty_equipment": it.get("faulty_equipment") or "",
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "status": (it.get("status") or (it.get("job") or {}).get("status") or ""),
            "file_url": first_url,
            "urls": urls,
        })

    return {
        "items": items,
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }


class CMSubmitIn(BaseModel):
    station_id: str
    found_date: Optional[str] = None
    faulty_equipment: str = ""
    severity: str = ""
    problem_details: str = ""
    remarks_open: str = ""
    location: str = ""
    reported_by: Optional[str] = None
    reporter_signature: str = ""  # ลายเซ็นผู้แจ้ง (dataURL PNG)


async def _ensure_cm_indexes(coll):
    try:
        await coll.create_index([("createdAt", -1), ("_id", -1)])
        await coll.create_index("issue_id", sparse=True)
        await coll.create_index("doc_name", sparse=True)
    except Exception:
        pass

@router.post("/cmreport/submit")
async def cmreport_submit(body: CMSubmitIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()

    coll = get_cmreport_collection_for(station_id)
    await _ensure_cm_indexes(coll)

    # กำหนด found_date
    if body.found_date:
        found_date = normalize_pm_date(body.found_date)
    else:
        found_date = datetime.now(th_tz).date().isoformat()

    # สร้าง issue_id และ doc_name อัตโนมัติ
    issue_id = await get_next_cm_issue_id(station_id, found_date)
    doc_name = await get_next_cm_doc_name(station_id, found_date)

    doc = {
        "station_id": station_id,
        "doc_name": doc_name,
        "issue_id": issue_id,
        "found_date": found_date,
        "location": body.location,
        "reported_by": body.reported_by or current.username,
        # flat fields
        "faulty_equipment": body.faulty_equipment,
        "severity": body.severity,
        "problem_details": body.problem_details,
        "remarks_open": body.remarks_open,
        "reporter_signature": body.reporter_signature,
        "status": "Open",
        "photos_problem": {},
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
        
    }

    res = await coll.insert_one(doc)

    # ══════════════════════════════════════════════════════════════
    # B) ยิง Maximo SR (ถ้ามี maximo_location)
    #    lookup: charger-level ก่อน → fallback station-level
    #    (เหมือน auto_cm_watcher._lookup_station)
    # ══════════════════════════════════════════════════════════════
    maximo_ticket_id = None
    try:
        # 1) Station info
        st_doc = station_collection.find_one(
            {"station_id": station_id},
            {"maximo_location": 1, "station_name": 1}
        )
        station_name = (st_doc or {}).get("station_name", station_id)
        station_maximo = (st_doc or {}).get("maximo_location", "")

        # 2) Charger-level maximo_location (ถ้า faulty_equipment ระบุ charger)
        charger_maximo = ""
        if body.faulty_equipment and body.faulty_equipment.startswith("charger_"):
            from config import client as mongo_client
            charger_col = mongo_client["iMPS"]["charger"]
            # ดึง charger_no จาก faulty_equipment เช่น "charger_1" → "1"
            charger_no_str = body.faulty_equipment.replace("charger_", "")
            charger_query = {"station_id": station_id}
            # รองรับทั้ง int และ string
            if charger_no_str.isdigit():
                charger_query["$or"] = [
                    {"chargerNo": int(charger_no_str)},
                    {"charger_no": charger_no_str},
                    {"charger_id": charger_no_str},
                ]
            else:
                charger_query["$or"] = [
                    {"charger_no": charger_no_str},
                    {"charger_id": charger_no_str},
                ]
            charger_doc = await charger_col.find_one(charger_query)
            if charger_doc:
                charger_maximo = charger_doc.get("maximo_location", "")

        # 3) ใช้ charger > station (เหมือน auto watcher)
        maximo_loc = charger_maximo or station_maximo

        print(f"[DEBUG-PATCH-V2] maximo_loc={maximo_loc}")

        if maximo_loc:
            print(f"[DEBUG-V3] calling maximo_create_sr, type={type(maximo_create_sr)}, is_coroutine={inspect.iscoroutinefunction(maximo_create_sr)}")
            desc = f"[iMPS CM] {station_name} / {body.faulty_equipment} / {body.problem_details}"
            result = maximo_create_sr(
                description=desc[:250],
                location=maximo_loc,
                severity=body.severity or "Medium",
            )
            # รองรับทั้ง sync และ async (บาง environment อาจ wrap เป็น sync)
            # sr = await result if inspect.isawaitable(result) else result
            if inspect.isawaitable(result):
                sr = await result
            else:
                sr = result

            if sr:
                maximo_ticket_id = sr.get("ticketid")
                await coll.update_one(
                    {"_id": res.inserted_id},
                    {"$set": {"maximo_ticket_id": maximo_ticket_id}}
                )
    except Exception as e:
        import logging
        logging.getLogger("cmreport").warning(f"Maximo SR failed: {e}")

    # ── ส่งอีเมลแจ้ง "เปิดใบงาน CM" (manual) ──
    try:
        from routers.notifications import send_cm_open_email
        await send_cm_open_email(doc, source="manual")
    except Exception as mail_err:
        import logging
        logging.getLogger("cmreport").warning(f"send_cm_open_email failed: {mail_err}")

    return {
        "ok": True,
        "report_id": str(res.inserted_id),
        "doc_name": doc_name,
        "issue_id": issue_id,
        "maximo_ticket_id": maximo_ticket_id,                      # ← B) เพิ่ม
    }

@router.get("/cmreport/{report_id}")
async def cmreport_detail_path(
    report_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid, "station_id": station_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    return {
        "id": str(doc["_id"]),
        "station_id": doc.get("station_id"),
        "doc_name": doc.get("doc_name") or "",
        "issue_id": doc.get("issue_id") or "",
        "found_date": doc.get("found_date"),
        "cm_date": doc.get("cm_date") or doc.get("found_date") or "",
        "reported_by": doc.get("reported_by") or "",
        "status": doc.get("status") or "",
        "maximo_ticket_id": doc.get("maximo_ticket_id") or "",     # ← D) เพิ่ม
        
        # flat fields จาก Open
        "faulty_equipment": doc.get("faulty_equipment") or "",
        "severity": doc.get("severity") or "",
        "problem_details": doc.get("problem_details") or "",
        "remarks_open": doc.get("remarks_open") or "",
        "location": doc.get("location") or "",
        
        # flat fields จาก InProgress
        "inspector": doc.get("inspector") or "",
        "cause": doc.get("cause") or "",
        "problem_type": doc.get("problem_type") or "",
        "problem_type_other": doc.get("problem_type_other") or "",
        "repair_result": doc.get("repair_result") or "",
        "corrective_actions": doc.get("corrective_actions") or [],
        "preventive_action": doc.get("preventive_action") or [],
        "repaired_equipment": doc.get("repaired_equipment") or [],
        "inprogress_remarks": doc.get("inprogress_remarks") or "",
        "repair_result_remark": doc.get("repair_result_remark") or "",
        "resolved_date": doc.get("resolved_date") or "",
        "start_repair_date": doc.get("start_repair_date") or "",
        "signature": doc.get("signature") or "",
        "reporter_signature": doc.get("reporter_signature") or "",
        "start_repair_time": doc.get("start_repair_time") or "",
        "resolved_time": doc.get("resolved_time") or "",

        "photos_problem": doc.get("photos_problem", {}),
        "photos_repair": doc.get("photos_repair", {}),
        "createdAt": _ensure_utc_iso(doc.get("createdAt")),
        "updatedAt": _ensure_utc_iso(doc.get("updatedAt")),
    }


@router.get("/cmreport/detail")
async def cmreport_detail_query(
    id: str = Query(..., alias="id"),
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    return await cmreport_detail_path(id, station_id, current)

class CMStatusUpdateIn(BaseModel):
    station_id: str
    status: Literal["Open", "In Progress", "Pending", "Closed"]
    job: Optional[Dict[str, Any]] = None
    inspector: Optional[str] = None

ALLOWED_STATUS: set[str] = {"Open", "In Progress", "Pending", "Closed"}

@router.patch("/cmreport/{report_id}/status")
async def cmreport_update_status(
    report_id: str,
    body: CMStatusUpdateIn,
    current: UserClaims = Depends(get_current_user),
):
    station_id = body.station_id.strip()
    if body.status not in ALLOWED_STATUS:
        raise HTTPException(status_code=400, detail="Invalid status")


    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    updates: Dict[str, Any] = {
        "status": body.status,
    }

    if body.inspector:
        updates["inspector"] = body.inspector

    if body.job is not None:
        allowed_job_keys = {
            "issue_id", "found_date", "location", "wo", "sn",
            "equipment_list", "problem_details", "problem_type", "severity",
            "reported_by","inspector", "assignee", "initial_cause", "corrective_actions",
            "resolved_date", "repair_result", "preventive_action", 
            "remarks", "remarks_open",
            "faulty_equipment",
            "repaired_equipment",
            "inprogress_remarks",
            "cause", "problem_type_other","repair_result_remark","start_repair_date",
            "signature", "start_repair_time", "resolved_time", "reporter_signature",
        }

        if "status" in body.job:
            js = body.job["status"]
            if js not in ALLOWED_STATUS:
                raise HTTPException(status_code=400, detail="Invalid job.status")
            updates["status"] = js

        for k, v in body.job.items():
            if k in allowed_job_keys:
                updates[k] = v

        if "found_date" in body.job and body.job.get("found_date"):
            try:
                updates.setdefault("cm_date", normalize_pm_date(body.job["found_date"]))
            except Exception:
                pass

    updates["updatedAt"] = datetime.now(timezone.utc)

    res = await coll.update_one({"_id": oid, "station_id": station_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    return {"ok": True, "status": updates["status"]}