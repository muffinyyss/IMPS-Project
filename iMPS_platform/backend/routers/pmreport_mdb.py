"""PM Report routes for MDB"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone, date
from dateutil.relativedelta import relativedelta
from bson.objectid import ObjectId
from typing import List, Dict, Any, Optional, Literal
import re, json, uuid, pathlib, secrets
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
from PIL import Image
from io import BytesIO

def resize_image_bytes(data: bytes, max_width: int = 1920, quality: int = 85) -> bytes:
    """Resize รูปถ้าใหญ่เกิน max_width, return JPEG bytes"""
    try:
        img = Image.open(BytesIO(data))
        if img.width <= max_width:
            return data
        ratio = max_width / img.width
        new_size = (max_width, int(img.height * ratio))
        img = img.resize(new_size, Image.LANCZOS)
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        elif img.mode != "RGB":
            img = img.convert("RGB")
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        return buf.getvalue()
    except Exception:
        return data
    
router = APIRouter()


@router.get("/mdbpmreport/preview-issueid")
async def mdbpmreport_preview_issueid(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    pm_type = "MB"
    latest = await _latest_issue_id_anywhere(station_id, pm_type, d, source="mdb")

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"

    if not latest:
        next_issue = f"{prefix}01"
    else:
        m = re.search(r"(\d+)$", latest)
        cur = int(m.group(1)) if m else 0
        next_issue = f"{prefix}{cur+1:02d}"

    return {"issue_id": next_issue}


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
    latest = await _latest_doc_name_anywhere(station_id, year, source="mdb")

    if not latest:
        next_doc = f"{station_id}_1/{year}"
    else:
        m = re.search(r"_(\d+)/\d{4}$", latest)
        current_num = int(m.group(1)) if m else 0
        next_doc = f"{station_id}_{current_num + 1}/{year}"

    return {"doc_name": next_doc}


# ============================================
# Pydantic Models
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
    q6_items: Optional[List[Dict[str, str]]] = None


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
# Pre-PM Submit
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

    client_docName = body.doc_name
    doc_name = None
    if client_docName:
        prefix = f"{station_id}_"
        valid_fmt = client_docName.startswith(prefix)
        rep_exists = await coll.find_one({"station_id": station_id, "doc_name": client_docName})
        url_exists = await url_coll.find_one({"doc_name": client_docName})
        unique = not (rep_exists or url_exists)
        if valid_fmt and unique:
            doc_name = client_docName

    if not doc_name:
        year_seq = await _next_year_seq(db, station_id, pm_type, d)
        doc_name = f"{station_id}_{year_seq}/{d.year}"

    doc = {
        "station_id": station_id,
        "doc_name": doc_name,
        "issue_id": issue_id,
        "job": body.job,
        "measures_pre": body.measures_pre,
        "rows_pre": body.rows_pre or {},
        "q4_items": body.q4_items or [{"key": "r4_1", "label": "4.1) Breaker Main ตัวที่ 1"}],
        "q6_items": body.q6_items or [{"key": "r6_1", "label": "6.1) Breaker CCB ตัวที่ 1"}],
        "charger_count": body.charger_count or 1,
        "pm_date": body.pm_date,
        "inspector": body.inspector,
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
# Post-PM Submit
# ============================================

@router.post("/mdbpmreport/submit")
async def mdbpmreport_post_submit(body: MDBPMPostIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    coll = get_mdbpmreport_collection_for(station_id)

    if body.report_id:
        try:
            oid = ObjectId(body.report_id)
        except Exception:
            raise HTTPException(status_code=400, detail="invalid report_id")

        existing = await coll.find_one({"_id": oid, "station_id": station_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Report not found")

        await coll.update_one({"_id": oid}, {"$set": {
            "rows": body.rows,
            "measures": body.measures,
            "summary": body.summary,
            "summaryCheck": body.summaryCheck,
            "dust_filter": body.dust_filter,
            "side": "post",
            "timestamp_post": datetime.now(timezone.utc),
        }})
        return {"ok": True, "report_id": body.report_id}

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
    return {"ok": True, "report_id": str(res.inserted_id)}


# ============================================
# Photo Upload
# ============================================

PHOTO_GROUP_PATTERN = r"(g\d+|r\d+_\d+)"


@router.post("/mdbpmreport/{report_id}/pre/photos")
async def mdbpmreport_upload_photos_pre(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),
    files: List[UploadFile] = File(...),
    current: UserClaims = Depends(get_current_user),
):
    if not re.fullmatch(PHOTO_GROUP_PATTERN, group):
        raise HTTPException(status_code=400, detail=f"Bad group key format: {group}")

    storage_key = group
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

    dest_dir = pathlib.Path(UPLOADS_ROOT) / "mdbpm" / station_id / report_id / "pre" / storage_key
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = _ext(f.filename or "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail=f"Empty file: {f.filename}")
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        saved.append({
            "filename": fname,
            "url": f"/uploads/mdbpm/{station_id}/{report_id}/pre/{storage_key}/{fname}",
            "uploadedAt": datetime.now(timezone.utc),
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos_pre.{storage_key}": {"$each": saved}},
            "$set": {"has_photos": True},
        },
    )
    return {"ok": True, "count": len(saved), "group": group, "storage_key": storage_key, "files": saved}


@router.post("/mdbpmreport/{report_id}/post/photos")
async def mdbpmreport_upload_photos_post(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),
    files: List[UploadFile] = File(...),
    remark: Optional[str] = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    if not re.fullmatch(PHOTO_GROUP_PATTERN, group):
        raise HTTPException(status_code=400, detail=f"Bad group key format: {group}")

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
        ext = _ext(f.filename or "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail=f"Empty file: {f.filename}")
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        saved.append({
            "filename": fname,
            "url": f"/uploads/mdbpm/{station_id}/{report_id}/post/{storage_key}/{fname}",
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc),
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos.{storage_key}": {"$each": saved}},
            "$set": {"has_photos": True, "updatedAt": datetime.now(timezone.utc)},
        },
    )
    return {"ok": True, "count": len(saved), "group": group, "storage_key": storage_key, "files": saved}


# ============================================
# Get / List
# ============================================

@router.get("/mdbpmreport/get")
async def mdbpmreport_get(station_id: str, report_id: str, current: UserClaims = Depends(get_current_user)):
    coll = get_mdbpmreport_collection_for(station_id)
    doc = await coll.find_one({"_id": ObjectId(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="not found")

    doc["_id"] = str(doc["_id"])

    # backward compatibility
    if "q4_items" not in doc:
        doc["q4_items"] = [{"key": "r4_1", "label": "4.1) Breaker Main ตัวที่ 1"}]
    if "charger_count" not in doc:
        doc["charger_count"] = 1
    if "rows_pre" not in doc:
        doc["rows_pre"] = {}
    if "q6_items" not in doc:
        doc["q6_items"] = [{"key": "r6_1", "label": "6.1) Breaker CCB ตัวที่ 1"}]

    return doc


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
        {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector": 1, "side": 1, "createdAt": 1, "charger_count": 1},
    ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

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
        "charger_count": it.get("charger_count", 1),
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("pm_date") or "", ""),
    } for it in items_raw]

    return {
        "items": items,
        "pm_date": [it.get("pm_date") for it in items_raw if it.get("pm_date")],
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }


# ============================================
# Finalize
# ============================================

@router.post("/mdbpmreport/{report_id}/finalize")
async def mdbpmreport_finalize(
    report_id: str,
    station_id: str = Form(...),
    current: UserClaims = Depends(get_current_user),
):
    coll = get_mdbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid, "station_id": station_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    res = await coll.update_one(
        {"_id": oid},
        {"$set": {
            "status": "submitted",
            "submittedAt": datetime.now(timezone.utc),
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    # ลบ PDF cache เผื่อมีค้างอยู่
    for lang in ("th", "en"):
        cache_path = pathlib.Path(UPLOADS_ROOT) / "pdf_cache" / station_id / f"{report_id}_{lang}.pdf"
        if cache_path.exists():
            cache_path.unlink()

    return {"ok": True, "report_id": report_id}


# ============================================
# MDB PM URL (PDF Upload + List)
# ============================================

class MDBPMUrlUploadIn(BaseModel):
    station_id: str
    reportDate: str
    issue_id: Optional[str] = None
    doc_name: Optional[str] = None
    inspector: Optional[str] = None


@router.post("/mdbpmurl/upload-files", status_code=201)
async def mdbpmurl_upload_files(
    station_id: str = Form(...),
    reportDate: str = Form(...),
    files: List[UploadFile] = File(...),
    issue_id: Optional[str] = Form(None),
    doc_name: Optional[str] = Form(None),
    inspector: Optional[str] = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    coll = get_mdbpmurl_coll_upload(station_id)
    rep_coll = get_mdbpmreport_collection_for(station_id)

    try:
        d = datetime.strptime(reportDate[:10], "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="reportDate must be YYYY-MM-DD")

    pm_date = d.isoformat()
    pm_type = "MB"
    year = d.year

    # Resolve issue_id
    final_issue_id = None
    if issue_id:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        if issue_id.startswith(prefix):
            rep_ex = await rep_coll.find_one({"issue_id": issue_id})
            url_ex = await coll.find_one({"issue_id": issue_id})
            if not rep_ex and not url_ex:
                final_issue_id = issue_id

    if not final_issue_id:
        latest = await _latest_issue_id_anywhere(station_id, pm_type, d, source="mdb")
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        if not latest:
            final_issue_id = f"{prefix}01"
        else:
            m = re.search(r"(\d+)$", latest)
            cur = int(m.group(1)) if m else 0
            final_issue_id = f"{prefix}{cur+1:02d}"

    # Resolve doc_name
    final_doc_name = None
    if doc_name:
        candidate = doc_name.strip()
        if candidate.startswith(f"{station_id}_"):
            rep_ex = await rep_coll.find_one({"doc_name": candidate})
            url_ex = await coll.find_one({"doc_name": candidate})
            if not rep_ex and not url_ex:
                final_doc_name = candidate

    if not final_doc_name:
        latest_doc = await _latest_doc_name_anywhere(station_id, year, source="mdb")
        if not latest_doc:
            final_doc_name = f"{station_id}_1/{year}"
        else:
            m = re.search(r"_(\d+)/\d{4}$", latest_doc)
            num = int(m.group(1)) if m else 0
            final_doc_name = f"{station_id}_{num+1}/{year}"

    # Save files
    subdir = pm_date
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "mdbpmurl" / station_id / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)

    urls = []
    metas = []
    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext != "pdf":
            raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")
        data = await f.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail=f"Empty file: {f.filename}")
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large")
        safe = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
        with open(dest_dir / safe, "wb") as out:
            out.write(data)
        urls.append(f"/uploads/mdbpmurl/{station_id}/{subdir}/{safe}")
        metas.append({"name": f.filename, "size": len(data)})

    now = datetime.now(timezone.utc)
    doc = {
        "station_id": station_id,
        "pm_date": pm_date,
        "issue_id": final_issue_id,
        "doc_name": final_doc_name,
        "inspector": (inspector or "").strip() or None,
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
        "count": len(urls),
        "urls": urls,
        "issue_id": final_issue_id,
        "doc_name": final_doc_name,
    }


@router.get("/mdbpmurl/list")
async def mdbpmurl_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current: UserClaims = Depends(get_current_user),
):
    coll = get_mdbpmurl_coll_upload(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find(
        {},
        {"_id": 1, "issue_id": 1, "doc_name": 1, "inspector": 1, "pm_date": 1, "urls": 1, "createdAt": 1}
    ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    items = [{
        "id": str(it["_id"]),
        "pm_date": it.get("pm_date"),
        "inspector": it.get("inspector"),
        "doc_name": it.get("doc_name"),
        "issue_id": it.get("issue_id"),
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": (it.get("urls") or [""])[0],
        "urls": it.get("urls") or [],
    } for it in items_raw]

    return {
        "items": items,
        "pm_date": [it.get("pm_date") for it in items_raw if it.get("pm_date")],
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }