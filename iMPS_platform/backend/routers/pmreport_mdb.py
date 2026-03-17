"""PM Report routes for MDB"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone, date
from dateutil.relativedelta import relativedelta
from bson.objectid import ObjectId
from typing import List, Dict, Any, Optional, Literal
import re, json, uuid, pathlib

from config import MDBPMReportDB, MDBPMUrlDB, station_collection, _validate_station_id, th_tz, _ensure_utc_iso
from deps import UserClaims, get_current_user
from routers.pm_helpers import (
    UPLOADS_ROOT,
    ALLOWED_EXTS,
    MAX_FILE_MB,
    _safe_name,
    _ext,
    get_mdbpmreport_collection_for,
    get_mdbpmurl_coll_upload,
    _latest_issue_id_anywhere,
    _next_issue_id,
    _latest_doc_name_anywhere,
    _next_year_seq,
    _next_issue_id_no_conflict,
)

router = APIRouter()


@router.get("/mdbpmreport/preview-issueid")
async def mdbpmreport_preview_issueid(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดู issue_id ถัดไป (PM-CG-YYMM-XX) โดยไม่ออกเลขจริง
    ใช้หาเลขไปโชว์บนฟอร์มเฉย ๆ
    """
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    pm_type = "MB"

    latest = await _latest_issue_id_anywhere(station_id, pm_type, d,source="mdb")

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"

    if not latest:
        next_issue = f"{prefix}01"
    else:
        m = re.search(r"(\d+)$", latest)
        cur = int(m.group(1)) if m else 0
        next_issue = f"{prefix}{cur+1:02d}"

    return {"issue_id": next_issue}

#     ดึง doc_name ล่าสุดของสถานี (ปีเดียวกับ pm_date)
#     เพื่อใช้คำนวณเลขถัดไปที่ frontend
    
@router.get("/mdbpmreport/preview-docname")
async def preview_docname(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    year = d.year

    latest = await _latest_doc_name_anywhere(station_id, year,source="mdb")

    if not latest:
        next_doc = f"{station_id}_1/{year}"
    else:
        import re
        m = re.search(r"_(\d+)/\d{4}$", latest)
        current_num = int(m.group(1)) if m else 0
        next_doc = f"{station_id}_{current_num + 1}/{year}"

    return {"doc_name": next_doc}


# ------------------------------------------------------------------
# new PM Report (MDB)
# ------------------------------------------------------------------

# ============================================
# MDB PM Report Backend - Updated for New Structure
# ============================================
# การเปลี่ยนแปลงหลัก:
# 1. ข้อ 4 - Dynamic Breaker Main (เพิ่มได้หลายตัว)
# 2. ข้อ 5 - Breaker Charger ตามจำนวน charger จริง
# 3. โครงสร้างคำถามใหม่ 9 ข้อ (แทน 11 ข้อเดิม)
# 4. Photo upload รองรับ key format ใหม่
# ============================================

from pydantic import BaseModel
from typing import Dict, Any, Optional, List, Literal
from datetime import datetime, timezone
from fastapi import HTTPException, Query, Form, File, UploadFile, Depends
from bson import ObjectId
from bson.errors import InvalidId
import re
import pathlib
import secrets

# ============================================
# 1. UPDATE: MDBPMSubmitIn (Pre-PM)
# ============================================

class MDBPMSubmitIn(BaseModel):
    side: Literal["pre", "post"]
    station_id: str
    job: Dict[str, Any]
    measures_pre: Dict[str, Any]
    rows_pre: Optional[Dict[str, Dict[str, Any]]] = None 
    q4_items: Optional[List[Dict[str, str]]] = None  
    charger_count: Optional[int] = None  
    pm_date: str
    issue_id: Optional[str] = None
    doc_name: Optional[str] = None
    inspector: Optional[str] = None


# ============================================
# 2. UPDATE: MDBPMPostIn (Post-PM)
# ============================================

class MDBPMPostIn(BaseModel):
    report_id: Optional[str] = None
    station_id: str
    rows: Dict[str, Any]
    measures: Dict[str, Any]
    summary: str
    summaryCheck: Optional[str] = None
    dust_filter: Optional[str] = None
    side: Literal["post", "after"]

# ============================================
# 3. UPDATE: Pre-PM Submit Endpoint
# ============================================

@router.post("/mdbpmreport/pre/submit")
async def mdbpmreport_pre_submit(body: MDBPMSubmitIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    coll = get_mdbpmreport_collection_for(station_id)
    db = coll.database

    pm_type = str(body.job.get("pm_type") or "MB").upper()
    body.job["pm_type"] = pm_type

    url_coll = get_mdbpmurl_coll_upload(station_id)

    try:
        d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    # Issue ID logic (unchanged)
    client_issue = body.issue_id 
    issue_id: str | None = None    

    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        valid_fmt = client_issue.startswith(prefix)
        rep_exists = await coll.find_one({"station_id": station_id, "issue_id": client_issue})
        url_exists = await url_coll.find_one({"issue_id": client_issue})
        unique = not (rep_exists or url_exists)

        if valid_fmt and unique:
            issue_id = client_issue

    if not issue_id:
        while True:
            candidate = await _next_issue_id(db, station_id, pm_type, d, pad=2)
            rep_exists = await coll.find_one({"issue_id": candidate})
            url_exists = await url_coll.find_one({"issue_id": candidate})
            if not rep_exists and not url_exists:
                issue_id = candidate
                break

    # Doc name logic (unchanged)
    client_docName = body.doc_name
    doc_name = None
    if client_docName:
        year = f"{d.year}"
        prefix = f"{station_id}_"
        valid_fmt = client_docName.startswith(prefix)

        rep_exists = await coll.find_one({"station_id": station_id, "doc_name": client_docName})
        url_exists = await url_coll.find_one({"doc_name": client_docName})
        unique = not (rep_exists or url_exists)

        if valid_fmt and unique:
            doc_name = client_docName
 
    if not doc_name:
        year_seq = await _next_year_seq(db, station_id, pm_type, d)
        year = d.year
        doc_name = f"{station_id}_{year_seq}/{year}"

    inspector = body.inspector
    
    # === UPDATED DOCUMENT STRUCTURE ===
    doc = {
        "station_id": station_id,
        "doc_name": doc_name,
        "issue_id": issue_id,
        "job": body.job,
        
        # NEW: Store measures_pre with new structure
        "measures_pre": body.measures_pre,
        
        # NEW: Store rows_pre
        "rows_pre": body.rows_pre or {},
        
        # NEW: Store dynamic items configuration
        "q4_items": body.q4_items or [{"key": "r4_1", "label": "4.1) Breaker Main ตัวที่ 1"}],
        "charger_count": body.charger_count or 1,
        
        "pm_date": body.pm_date,
        "inspector": inspector,
        "photos_pre": {},
        "status": "draft",
        "side": body.side,
        "timestamp": datetime.now(timezone.utc),
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id), 
        "issue_id": issue_id,
        "doc_name": doc_name,
    }


# ============================================
# 4. UPDATE: Post-PM Submit Endpoint
# ============================================

@router.post("/mdbpmreport/submit")
async def mdbpmreport_post_submit(body: MDBPMPostIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    coll = get_mdbpmreport_collection_for(station_id)

    if body.report_id:
        try:
            oid = ObjectId(body.report_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="invalid report_id")

        existing = await coll.find_one({"_id": oid, "station_id": station_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Report not found")

        update_fields = {
            "rows": body.rows,
            
            # NEW: measures with new structure
            "measures": body.measures,
            
            "summary": body.summary,
            "summaryCheck": body.summaryCheck,
            "dust_filter": body.dust_filter,
            "side": "post",
            "timestamp_post": datetime.now(timezone.utc),
        }

        await coll.update_one({"_id": oid}, {"$set": update_fields})

        return {
            "ok": True,
            "report_id": body.report_id,
        }
    
    # Insert new (fallback - normally should update existing)
    doc = {
        "station_id": station_id,
        "rows": body.rows,
        "measures": body.measures,
        "summary": body.summary,
        "summaryCheck": body.summaryCheck,
        "dust_filter": body.dust_filter,
        "status": "draft",
        "photos": {},
        "side": "post",
        "timestamp": datetime.now(timezone.utc),
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id), 
    }


# ============================================
# 5. UPDATE: Photo Upload - Support New Key Formats
# ============================================

# NEW: Updated regex pattern to support all key formats
PHOTO_GROUP_PATTERN = r"(g\d+|r\d+_\d+)"

# Key formats:
# - g1, g2, g3     -> Simple questions (Q1, Q2, Q3)
# - r4_1, r4_2     -> Dynamic Breaker Main items
# - r5_1, r5_2     -> Charger Breaker items  
# - g6             -> CCB (Q6)
# - r7_1, r7_2...  -> Trip Test items (Q7)
# - g8, g9         -> Simple questions (Q8, Q9)

@router.post("/mdbpmreport/{report_id}/pre/photos")
async def mdbpmreport_upload_photos_pre(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),
    files: List[UploadFile] = File(...),
):
    # Validate group format
    if not re.fullmatch(PHOTO_GROUP_PATTERN, group):
        raise HTTPException(status_code=400, detail=f"Bad group key format: {group}")

    # === UPDATED: Storage key mapping ===
    # For dynamic items (r4_1, r4_2, r5_1, r5_2, r7_1, etc.), keep the full key
    # For simple questions (g1, g2, etc.), keep as-is
    storage_key = group
    
    # Special handling for Trip Test (Q7) - merge into g7
    if re.match(r"r7_\d+", group):
        storage_key = "g7"

    coll = get_mdbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    # Folder path
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "mdbpm" / station_id / report_id / "pre" / storage_key
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = _ext(f.filename or "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/mdbpm/{station_id}/{report_id}/pre/{storage_key}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "uploadedAt": datetime.now(timezone.utc)
        })

    # Update document
    await coll.update_one(
        {"_id": oid},
        {"$push": {f"photos_pre.{storage_key}": {"$each": saved}}}
    )

    return {"ok": True, "count": len(saved), "group": group, "storage_key": storage_key, "files": saved}


@router.post("/mdbpmreport/{report_id}/post/photos")
async def mdbpmreport_upload_photos_post(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),
    files: List[UploadFile] = File(...),
    remark: Optional[str] = Form(None),
):
    # Validate group format
    if not re.fullmatch(PHOTO_GROUP_PATTERN, group):
        raise HTTPException(status_code=400, detail=f"Bad group key format: {group}")

    # Storage key mapping (same as pre)
    storage_key = group

    coll = get_mdbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    dest_dir = pathlib.Path(UPLOADS_ROOT) / "mdbpm" / station_id / report_id / "post" / storage_key
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/mdbpm/{station_id}/{report_id}/post/{storage_key}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos.{storage_key}": {"$each": saved}},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    return {"ok": True, "count": len(saved), "group": group, "storage_key": storage_key, "files": saved}


# ============================================
# 6. UPDATE: Get Report - Return New Fields
# ============================================

@router.get("/mdbpmreport/get")
async def mdbpmreport_get(station_id: str, report_id: str, current: UserClaims = Depends(get_current_user)):
    coll = get_mdbpmreport_collection_for(station_id)
    doc = await coll.find_one({"_id": ObjectId(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="not found")

    doc["_id"] = str(doc["_id"])
    
    # Ensure new fields are present (for backward compatibility)
    if "q4_items" not in doc:
        doc["q4_items"] = [{"key": "r4_1", "label": "4.1) Breaker Main ตัวที่ 1"}]
    if "charger_count" not in doc:
        doc["charger_count"] = 1
    if "rows_pre" not in doc:
        doc["rows_pre"] = {}
    
    return doc


# ============================================
# 7. UPDATE: List Endpoint - Include New Fields
# ============================================

@router.get("/mdbpmreport/list")
async def mdbpmreport_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    coll = get_mdbpmreport_collection_for(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find(
        {}, 
        {
            "_id": 1, 
            "issue_id": 1, 
            "doc_name": 1, 
            "pm_date": 1,
            "inspector": 1,
            "side": 1, 
            "createdAt": 1,
            "charger_count": 1,  # NEW
        }
    ).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    # URL mapping (unchanged)
    pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
    url_by_day: Dict[str, str] = {}
    if pm_dates:
        ucoll = get_mdbpmurl_coll_upload(station_id)
        ucur = ucoll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
        url_docs = await ucur.to_list(length=10_000)
        for u in url_docs:
            day = u.get("pm_date")
            first_url = (u.get("urls") or [None])[0]
            if day and first_url and day not in url_by_day:
                url_by_day[day] = first_url

    items = [{
        "id": str(it["_id"]),
        "issue_id": it.get("issue_id"),
        "doc_name": it.get("doc_name"),
        "inspector": it.get("inspector"),
        "side": it.get("side"), 
        "pm_date": it.get("pm_date"),
        "charger_count": it.get("charger_count", 1),  # NEW
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("pm_date") or "", ""),
    } for it in items_raw]

    return {
        "items": items, 
        "pm_date": [it.get("pm_date") for it in items_raw if it.get("pm_date")], 
        "page": page, 
        "pageSize": pageSize, 
        "total": total
    }
