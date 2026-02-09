"""CM (Corrective Maintenance) Report routes"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from datetime import datetime, timezone, date
from bson.objectid import ObjectId
from typing import List, Dict, Any, Optional, Literal
import re, json, uuid, pathlib, secrets, os

from config import (
    normalize_pm_date, _ensure_utc_iso,
    CMReportDB, CMUrlDB, DCTestReportDB, DCUrlDB,
    station_collection, _validate_station_id, th_tz,
)

ALLOWED_EXTS = {"jpg", "jpeg", "png", "webp", "gif", "pdf", "heic", "heif"}
MAX_FILE_MB = 20
from deps import UserClaims, get_current_user

router = APIRouter()

# ---------------------------------------------------------------------
def get_cmreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    coll = CMReportDB.get_collection(str(station_id))
    return coll

def get_cmurl_coll_upload(station_id: str):
    _validate_station_id(station_id)
    coll = CMUrlDB.get_collection(str(station_id))
    return coll

# ==================== ISSUE_ID & DOC_NAME HELPERS ====================

def make_cm_issue_prefix(station_id: str, date_iso: str) -> str:
    """สร้าง prefix สำหรับ issue_id: CM-{station_id}-{yymm}-"""
    d = datetime.fromisoformat(date_iso) if date_iso else datetime.now(th_tz)
    yy = str(d.year)[2:]  # 2 หลักท้าย
    mm = str(d.month).zfill(2)
    return f"CM-{station_id}-{yy}{mm}-"

def make_cm_doc_prefix(station_id: str, date_iso: str) -> str:
    """สร้าง prefix สำหรับ doc_name: CM-{station_id}-{yyyy}-"""
    d = datetime.fromisoformat(date_iso) if date_iso else datetime.now(th_tz)
    yyyy = str(d.year)
    return f"CM-{station_id}-{yyyy}-"

async def get_next_cm_issue_id(station_id: str, found_date: str) -> str:
    """
    หา issue_id ถัดไปจากทั้ง cmreport และ cmurl collections
    Format: CM-{station_id}-{yymm}-{xx}
    """
    prefix = make_cm_issue_prefix(station_id, found_date)
    
    report_coll = get_cmreport_collection_for(station_id)
    url_coll = get_cmurl_coll_upload(station_id)
    
    # หาจากทั้งสอง collections
    all_ids = []
    
    # จาก cmreport
    cursor1 = report_coll.find(
        {"issue_id": {"$regex": f"^{re.escape(prefix)}"}},
        {"issue_id": 1}
    )
    async for doc in cursor1:
        if doc.get("issue_id"):
            all_ids.append(doc["issue_id"])
    
    # จาก cmurl
    cursor2 = url_coll.find(
        {"issue_id": {"$regex": f"^{re.escape(prefix)}"}},
        {"issue_id": 1}
    )
    async for doc in cursor2:
        if doc.get("issue_id"):
            all_ids.append(doc["issue_id"])
    
    if not all_ids:
        return f"{prefix}01"
    
    # หาเลขสูงสุด
    max_num = 0
    for issue_id in all_ids:
        if issue_id.startswith(prefix):
            tail = issue_id[len(prefix):]
            match = re.match(r"(\d+)", tail)
            if match:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num
    
    next_num = max_num + 1
    return f"{prefix}{str(next_num).zfill(2)}"

async def get_next_cm_doc_name(station_id: str, found_date: str) -> str:
    """
    หา doc_name ถัดไปจากทั้ง cmreport และ cmurl collections
    Format: CM-{station_id}-{yyyy}-{xx}
    """
    prefix = make_cm_doc_prefix(station_id, found_date)
    
    report_coll = get_cmreport_collection_for(station_id)
    url_coll = get_cmurl_coll_upload(station_id)
    
    all_names = []
    
    # จาก cmreport
    cursor1 = report_coll.find(
        {"doc_name": {"$regex": f"^{re.escape(prefix)}"}},
        {"doc_name": 1}
    )
    async for doc in cursor1:
        if doc.get("doc_name"):
            all_names.append(doc["doc_name"])
    
    # จาก cmurl
    cursor2 = url_coll.find(
        {"doc_name": {"$regex": f"^{re.escape(prefix)}"}},
        {"doc_name": 1}
    )
    async for doc in cursor2:
        if doc.get("doc_name"):
            all_names.append(doc["doc_name"])
    
    if not all_names:
        return f"{prefix}01"
    
    # หาเลขสูงสุด
    max_num = 0
    for doc_name in all_names:
        if doc_name.startswith(prefix):
            tail = doc_name[len(prefix):]
            match = re.match(r"(\d+)", tail)
            if match:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num
    
    next_num = max_num + 1
    return f"{prefix}{str(next_num).zfill(2)}"

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
    issue_id = await get_next_cm_issue_id(station_id, found_date_normalized)
    
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
    """หา doc_name ล่าสุดสำหรับปีนั้น"""
    
    found_date_normalized = normalize_pm_date(found_date)
    prefix = make_cm_doc_prefix(station_id, found_date_normalized)
    
    report_coll = get_cmreport_collection_for(station_id)
    url_coll = get_cmurl_coll_upload(station_id)
    
    # หา doc_name ล่าสุดจากทั้งสอง collections
    latest = None
    max_num = 0
    
    for coll in [report_coll, url_coll]:
        cursor = coll.find(
            {"doc_name": {"$regex": f"^{re.escape(prefix)}"}},
            {"doc_name": 1}
        ).sort("doc_name", -1).limit(10)
        
        async for doc in cursor:
            name = doc.get("doc_name", "")
            if name.startswith(prefix):
                tail = name[len(prefix):]
                match = re.match(r"(\d+)", tail)
                if match:
                    num = int(match.group(1))
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
        "faulty_equipment": 1,  # เพิ่ม flat fields
        "severity": 1,
        "problem_details": 1,
        "location": 1,
        "job": 1,
        "repair_result": 1,
        "repair_result_remark": 1,
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
            "status": it.get("status") or job.get("status") or "",
            "faulty_equipment": it.get("faulty_equipment") or job.get("faulty_equipment") or "",
            "problem_details": it.get("problem_details") or job.get("problem_details") or "",
            "severity": it.get("severity") or job.get("severity") or "",
            "location": it.get("location") or job.get("location") or "",
            "repair_result": it.get("repair_result") or job.get("repair_result") or "",
            "repair_result_remark": it.get("repair_result_remark") or "",
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": url_by_day.get(it.get("cm_date") or "", ""),
        })

    return {
        "items": items, 
        "page": page, 
        "pageSize": pageSize, 
        "total": total
    }


# ตำแหน่งโฟลเดอร์บนเครื่องเซิร์ฟเวอร์
UPLOADS_ROOT = os.getenv("UPLOADS_ROOT", "./uploads")
os.makedirs(UPLOADS_ROOT, exist_ok=True)

# เสิร์ฟไฟล์คืนให้ Frontend ผ่าน /uploads/...
# NOTE: move to main.py → app.mount("/uploads", StaticFiles(directory=UPLOADS_ROOT, html=False), name="uploads")


def _safe_name(name: str) -> str:
    # กัน path traversal และอักขระแปลก ๆ
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
    location: str | None = Form(None),        # ✅ เพิ่มใหม่
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
            "location": location or "",         # ✅ เพิ่มใหม่
            "uploadedAt": uploaded_at,
        })

    await coll.update_one(
        {"_id": oid},
        {"$push": {f"{photo_field}.{group}": {"$each": saved}}}
    )

    # ✅ return uploadedAt as ISO string + location
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
    reportDate: str = Form(...),                 # "YYYY-MM-DD" หรือ ISO
    files: list[UploadFile] = File(...),
    status: str = Form(...),  
    current: UserClaims = Depends(get_current_user),
):
    # auth

    # ตรวจ/เตรียมคอลเลกชัน
    coll = get_cmurl_coll_upload(station_id)

    # parse วันที่เป็น UTC datetime (มีฟังก์ชันอยู่แล้ว)
    cm_date = normalize_pm_date(reportDate)

    # สร้าง issue_id และ doc_name อัตโนมัติ
    issue_id = await get_next_cm_issue_id(station_id, cm_date)
    doc_name = await get_next_cm_doc_name(station_id, cm_date)

    # โฟลเดอร์ปลายทาง: /uploads/cmurl/<station_id>/<YYYY-MM-DD>/
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
        "doc_name": doc_name,           # เพิ่ม
        "issue_id": issue_id,           # เพิ่ม
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

    # สร้าง filter ตามสถานะ
    mongo_filter: dict = {}
    if status:
        want = (status or "").strip()
        mongo_filter["$or"] = [
            {"status": {"$regex": f"^{re.escape(want)}$", "$options": "i"}},
            {"job.status": {"$regex": f"^{re.escape(want)}$", "$options": "i"}},
        ]

    projection = {
        "_id": 1, 
        "doc_name": 1,      # เพิ่ม
        "issue_id": 1,      # เพิ่ม
        "cm_date": 1, 
        "reportDate": 1,
        "urls": 1, 
        "createdAt": 1,
        "status": 1, 
        "job": 1,
        "inspector": 1,     # เพิ่ม
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
    remarks_open: str = ""          # เปลี่ยนจาก remarks เป็น remarks_open
    location: str = ""
    reported_by: Optional[str] = None


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
        "remarks_open": body.remarks_open,      # เปลี่ยนจาก remarks เป็น remarks_open
        "status": "Open",
        "photos_problem": {},
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
        
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id),
        "doc_name": doc_name,
        "issue_id": issue_id,
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
    status: Literal["Open", "In Progress", "Closed"]
    job: Optional[Dict[str, Any]] = None
    inspector: Optional[str] = None

ALLOWED_STATUS: set[str] = {"Open", "In Progress", "Closed"}

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

    # ✅ เพิ่ม: บันทึก inspector
    if body.inspector:
        updates["inspector"] = body.inspector

    if body.job is not None:
        # ✅ แก้ไข: เพิ่ม "cause"
        allowed_job_keys = {
            "issue_id", "found_date", "location", "wo", "sn",
            "equipment_list", "problem_details", "problem_type", "severity",
            "reported_by", "assignee", "initial_cause", "corrective_actions",
            "resolved_date", "repair_result", "preventive_action", 
            "remarks", "remarks_open",
            "faulty_equipment",
            "repaired_equipment",
            "inprogress_remarks",
            "cause", "problem_type_other","repair_result_remark", # ✅ เพิ่มใหม่
        }
        
        if "status" in body.job:
            js = body.job["status"]
            if js not in ALLOWED_STATUS:
                raise HTTPException(status_code=400, detail="Invalid job.status")
            updates["status"] = js

        for k, v in body.job.items():
            if k in allowed_job_keys:
                updates[k] = v  # บันทึกเป็น flat field แทน job.xxx

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

#---------------------------------------------------------------------- Test Report (DC)
def get_dc_testreport_collection_for(sn: str):
    _validate_station_id(sn)
    coll = DCTestReportDB.get_collection(str(sn))
    return coll

def get_dcurl_coll_upload(sn: str):
    _validate_station_id(sn)
    coll = DCUrlDB.get_collection(str(sn))
    return coll
