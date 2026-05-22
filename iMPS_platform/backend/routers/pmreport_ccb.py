"""PM Report routes for CCB"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Form, Path
from fastapi.responses import Response, JSONResponse, StreamingResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from datetime import datetime, timedelta, timezone, date
from dateutil.relativedelta import relativedelta
from bson.objectid import ObjectId
from bson.errors import InvalidId
from bson.decimal128 import Decimal128
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional, Literal
import re, json, uuid, pathlib, secrets, os, asyncio
import zipfile

from config import (
    normalize_pm_date, CCBPMReportDB, CCBPMUrlDB,
    station_collection, _validate_station_id, th_tz, _ensure_utc_iso,
)
from deps import UserClaims, get_current_user
from routers.pm_helpers import (
    UPLOADS_ROOT,
    ALLOWED_EXTS,
    MAX_FILE_MB,
    _safe_name,
    _ext,
    parse_iso_any_tz,
    get_ccbpmreport_collection_for,
    get_ccbpmurl_coll_upload,
    _latest_issue_id_anywhere,
    _next_issue_id,
    _next_issue_id_no_conflict,
    _latest_doc_name_from_pmreport,
    _latest_doc_name_anywhere,
    _next_year_seq,
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


# ============================================
# Helpers
# ============================================

async def _get_station_by_id(station_id: str) -> dict:
    """Get station document by station_id, raise 404 if not found"""
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail=f"Station with ID '{station_id}' not found")
    return station


def _compute_next_pm_date_str(pm_date_str: str | None) -> str | None:
    if not pm_date_str:
        return None
    try:
        d = datetime.fromisoformat(pm_date_str).date()
    except ValueError:
        return None
    next_d = d + relativedelta(months=+6)
    return next_d.isoformat()


async def _latest_pm_date_from_ccbpmreport(station_id: str) -> dict | None:
    _validate_station_id(station_id)
    coll = CCBPMReportDB.get_collection(str(station_id))

    pipeline = [
        {"$addFields": {
            "_ts": {
                "$ifNull": [
                    {
                        "$cond": [
                            {"$eq": [{"$type": "$timestamp"}, "string"]},
                            {"$dateFromString": {
                                "dateString": "$timestamp",
                                "timezone": "UTC",
                                "onError": None,
                                "onNull": None
                            }},
                            "$timestamp"
                        ]
                    },
                    {"$toDate": "$_id"}
                ]
            }
        }},
        {"$sort": {"_ts": -1, "_id": -1}},
        {"$limit": 1},
        {"$project": {"_id": 1, "pm_date": 1, "timestamp": 1}}
    ]

    cursor = coll.aggregate(pipeline)
    docs = await cursor.to_list(length=1)
    return docs[0] if docs else None


async def _ccbpmreport_latest_core(station_id: str, current: UserClaims):
    """Get latest PM report info for a CCB by station_id"""
    _validate_station_id(station_id)

    station = await _get_station_by_id(station_id)

    pm_latest = await _latest_pm_date_from_ccbpmreport(station_id)
    pm_date = pm_latest.get("pm_date") if pm_latest else None

    ts_raw = (pm_latest.get("timestamp") if pm_latest else None) or station.get("createdAt")

    ts_dt = (parse_iso_any_tz(ts_raw) if isinstance(ts_raw, str)
             else (ts_raw if isinstance(ts_raw, datetime) else None))
    ts_utc = ts_dt.astimezone(ZoneInfo("UTC")).isoformat() if ts_dt else None
    ts_th  = ts_dt.astimezone(ZoneInfo("Asia/Bangkok")).isoformat() if ts_dt else None

    pm_next_date = _compute_next_pm_date_str(pm_date)

    return {
        "_id": str(station["_id"]),
        "station_id": station_id,
        "pm_date": pm_date,
        "pm_next_date": pm_next_date,
        "timestamp": ts_raw,
        "timestamp_utc": ts_utc,
        "timestamp_th": ts_th,
        "source": "stations + CCBPMReportDB",
    }


def serialize_doc(doc):
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for k, v in doc.items():
            if isinstance(v, ObjectId):
                result[k] = str(v)
            elif isinstance(v, datetime):
                result[k] = v.isoformat()
            elif isinstance(v, Decimal128):
                result[k] = float(v.to_decimal())
            else:
                result[k] = serialize_doc(v)
        return result
    return doc


def parse_report_date_to_utc(s: str) -> datetime:
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
        tz_th = ZoneInfo("Asia/Bangkok")
        dt_th = datetime.fromisoformat(s + "T00:00:00").replace(tzinfo=tz_th)
        return dt_th.astimezone(timezone.utc)
    if s.endswith("Z"):
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)
    if re.search(r"[+\-]\d{2}:\d{2}$", s):
        return datetime.fromisoformat(s).astimezone(timezone.utc)
    return datetime.fromisoformat(s + "+07:00").astimezone(timezone.utc)


# ============================================
# Pydantic Models
# ============================================

class CCBPMSubmitIn(BaseModel):
    side: Literal["pre"]
    station_id: str
    job: Dict[str, Any]
    rows_pre: Dict[str, Dict[str, Any]]
    measures_pre: Dict[str, Any]
    subBreakerCount: int = 1
    pm_date: str
    issue_id: Optional[str] = None
    doc_name: Optional[str] = None
    inspector: Optional[str] = None
    comment_pre: Optional[str] = None


class CCBPMPostIn(BaseModel):
    report_id: str | None = None
    station_id: str
    rows: dict
    measures: dict
    subBreakerCount: int = 1
    summary: str
    summaryCheck: str | None = None
    side: Literal["post", "after"]


# ============================================
# Preview endpoints
# ============================================

@router.get("/ccbpmreport/preview-issueid")
async def ccbpmreport_preview_issueid(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """Preview next issue_id without actually generating it"""
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    pm_type = "CC"
    latest = await _latest_issue_id_anywhere(station_id, pm_type, d, source="ccb")

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"

    if not latest:
        next_issue = f"{prefix}01"
    else:
        m = re.search(r"(\d+)$", latest)
        cur = int(m.group(1)) if m else 0
        next_issue = f"{prefix}{cur+1:02d}"

    return {"issue_id": next_issue}


@router.get("/ccbpmreport/latest-docname")
async def ccbpmreport_latest_docname(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """Get latest doc_name for calculating next number at frontend"""
    latest = await _latest_doc_name_from_pmreport(station_id, pm_date, source="ccb")
    return {
        "doc_name": latest.get("doc_name") if latest else None,
        "station_id": station_id,
        "pm_date": pm_date,
    }


@router.get("/ccbpmreport/preview-docname")
async def preview_docname(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """Preview next doc_name without actually generating it"""
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    year = d.year
    latest = await _latest_doc_name_anywhere(station_id, year, source="ccb")

    if not latest:
        next_doc = f"{station_id}_1/{year}"
    else:
        m = re.search(r"_(\d+)/\d{4}$", latest)
        current_num = int(m.group(1)) if m else 0
        next_doc = f"{station_id}_{current_num + 1}/{year}"

    return {"doc_name": next_doc}


# ============================================
# Get / List / Latest
# ============================================

@router.get("/ccbpmreport/get")
async def ccbpmreport_get(
    station_id: str,
    report_id: str,
    current: UserClaims = Depends(get_current_user),
):
    coll = get_ccbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    return serialize_doc(doc)


@router.get("/ccbpmreport/list")
async def ccbpmreport_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current: UserClaims = Depends(get_current_user),
):
    """List PM reports for a CCB by station_id"""
    coll = get_ccbpmreport_collection_for(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find(
        {},
        {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector": 1,
         "side": 1, "has_photos": 1, "createdAt": 1},
    ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
    url_by_day: Dict[str, str] = {}

    if pm_dates:
        ucoll = get_ccbpmurl_coll_upload(station_id)
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
        "pm_date": it.get("pm_date"),
        "side": it.get("side"),
        "inspector": it.get("inspector"),
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("pm_date") or "", ""),
        "has_photos": True if it.get("has_photos") else None,
    } for it in items_raw]

    pm_date_arr = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
    return {
        "items": items,
        "pm_date": pm_date_arr,
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }


@router.get("/ccbpmreport/latest/{station_id}")
async def ccbpmreport_latest_by_path(
    station_id: str = Path(..., description="Station ID"),
    current: UserClaims = Depends(get_current_user),
):
    """Get latest PM info for a CCB by station_id (path param)"""
    return await _ccbpmreport_latest_core(station_id, current)


# ============================================
# Pre-PM Submit
# ============================================

@router.post("/ccbpmreport/pre/submit")
async def ccbpmreport_pre_submit(
    body: CCBPMSubmitIn,
    current: UserClaims = Depends(get_current_user),
):
    station_id = body.station_id.strip()
    coll = get_ccbpmreport_collection_for(station_id)
    url_coll = get_ccbpmurl_coll_upload(station_id)
    db = coll.database

    pm_type = str(body.job.get("pm_type") or "CC").upper()
    body.job["pm_type"] = pm_type

    try:
        d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    client_issue = body.issue_id
    client_doc = body.doc_name

    # parallel existence checks (issue_id / doc_name)
    tasks: list = []
    prefix = ""

    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        if client_issue.startswith(prefix):
            tasks.append(coll.find_one({"issue_id": client_issue}, {"_id": 1}))
            tasks.append(url_coll.find_one({"issue_id": client_issue}, {"_id": 1}))
        else:
            tasks.append(asyncio.sleep(0))
            tasks.append(asyncio.sleep(0))
    else:
        tasks.append(asyncio.sleep(0))
        tasks.append(asyncio.sleep(0))

    if client_doc:
        tasks.append(coll.find_one({"doc_name": client_doc}, {"_id": 1}))
        tasks.append(url_coll.find_one({"doc_name": client_doc}, {"_id": 1}))
    else:
        tasks.append(asyncio.sleep(0))
        tasks.append(asyncio.sleep(0))

    results = await asyncio.gather(*tasks)

    # Resolve issue_id
    issue_id: str | None = None
    if client_issue and client_issue.startswith(prefix):
        rep_exists, url_exists = results[0], results[1]
        if not rep_exists and not url_exists:
            issue_id = client_issue

    if not issue_id:
        issue_id = await _next_issue_id_no_conflict(db, coll, url_coll, station_id, pm_type, d)

    # Resolve doc_name
    doc_name: str | None = None
    if client_doc and client_doc.startswith(f"{station_id}_"):
        rep_exists, url_exists = results[2], results[3]
        if not rep_exists and not url_exists:
            doc_name = client_doc

    if not doc_name:
        year_seq = await _next_year_seq(db, station_id, pm_type, d)
        doc_name = f"{station_id}_{year_seq}/{d.year}"

    # Reuse existing draft (same station/date/pre) if exists
    existing_draft = await coll.find_one(
        {"station_id": station_id, "pm_date": body.pm_date, "side": "pre", "status": "draft"},
        {"_id": 1, "issue_id": 1, "doc_name": 1},
    )

    if existing_draft:
        await coll.update_one(
            {"_id": existing_draft["_id"]},
            {"$set": {
                "job": body.job,
                "rows_pre": body.rows_pre,
                "measures_pre": body.measures_pre,
                "subBreakerCount": body.subBreakerCount,
                "inspector": body.inspector,
                "comment_pre": body.comment_pre,
                "timestamp": datetime.now(timezone.utc),
            }},
        )
        return {
            "ok": True,
            "report_id": str(existing_draft["_id"]),
            "issue_id": existing_draft.get("issue_id") or issue_id,
            "doc_name": existing_draft.get("doc_name") or doc_name,
        }

    doc = {
        "station_id": station_id,
        "doc_name": doc_name,
        "issue_id": issue_id,
        "job": body.job,
        "rows_pre": body.rows_pre,
        "measures_pre": body.measures_pre,
        "subBreakerCount": body.subBreakerCount,
        "pm_date": body.pm_date,
        "inspector": body.inspector,
        "comment_pre": body.comment_pre,
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

@router.post("/ccbpmreport/submit")
async def ccbpmreport_post_submit(
    body: CCBPMPostIn,
    current: UserClaims = Depends(get_current_user),
):
    """Submit Post-PM report for a CCB"""
    station_id = body.station_id.strip()
    coll = get_ccbpmreport_collection_for(station_id)

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
            "measures": body.measures,
            "subBreakerCount": body.subBreakerCount,
            "summary": body.summary,
            "summaryCheck": body.summaryCheck,
            "side": "post",
            "timestamp_post": datetime.now(timezone.utc),
        }

        await coll.update_one({"_id": oid}, {"$set": update_fields})
        return {"ok": True, "report_id": body.report_id}

    # Auto-discover latest draft
    existing_draft = await coll.find_one(
        {"station_id": station_id, "side": "post", "status": "draft"},
        {"_id": 1},
        sort=[("timestamp", -1)],
    )

    update_fields = {
        "rows": body.rows,
        "measures": body.measures,
        "subBreakerCount": body.subBreakerCount,
        "summary": body.summary,
        "summaryCheck": body.summaryCheck,
        "side": "post",
        "timestamp_post": datetime.now(timezone.utc),
    }

    if existing_draft:
        await coll.update_one({"_id": existing_draft["_id"]}, {"$set": update_fields})
        return {"ok": True, "report_id": str(existing_draft["_id"])}

    doc = {
        "station_id": station_id,
        **update_fields,
        "photos": {},
        "status": "draft",
        "timestamp": datetime.now(timezone.utc),
    }
    res = await coll.insert_one(doc)
    return {"ok": True, "report_id": str(res.inserted_id)}


# ============================================
# Photo Upload (Pre / Post)
# ============================================

# Regex pattern for photo group keys: g1, g3_1, g9, g10_2, etc.
PHOTO_GROUP_PATTERN = re.compile(r"^g\d+(_\d+)?$")


@router.post("/ccbpmreport/{report_id}/pre/photos")
async def ccbpmreport_upload_photos_pre(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),
    files: List[UploadFile] = File(...),
    current: UserClaims = Depends(get_current_user),
):
    """Upload Pre-PM photos for a CCB report"""
    if not PHOTO_GROUP_PATTERN.match(group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_ccbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one(
        {"_id": oid},
        {"_id": 1, "station_id": 1, f"photos_pre.{group}": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    MAX_PHOTOS_PER_GROUP = 10
    existing_count = len((doc.get("photos_pre") or {}).get(group, []))
    remaining = MAX_PHOTOS_PER_GROUP - existing_count
    if remaining <= 0:
        return {"ok": True, "count": 0, "group": group, "files": [], "skipped": "group_full"}
    files = files[:remaining]

    dest_dir = pathlib.Path(UPLOADS_ROOT) / "ccbpm" / station_id / report_id / "pre" / group
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

        data = resize_image_bytes(data, max_width=1280, quality=75)

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.jpg")
        fname = pathlib.Path(fname).stem + ".jpg"
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/ccbpm/{station_id}/{report_id}/pre/{group}/{fname}"
        saved.append({
            "filename": fname,
            "url": url_path,
            "uploadedAt": datetime.now(timezone.utc),
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos_pre.{group}": {"$each": saved}},
            "$set": {"has_photos": True, "updatedAt": datetime.now(timezone.utc)},
        },
    )
    if not saved:
        raise HTTPException(status_code=400, detail="No files were saved")

    return {"ok": True, "count": len(saved), "group": group, "files": saved}


@router.post("/ccbpmreport/{report_id}/post/photos")
async def ccbpmreport_upload_photos_post(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),
    files: List[UploadFile] = File(...),
    remark: Optional[str] = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    """Upload Post-PM photos for a CCB report"""
    if not PHOTO_GROUP_PATTERN.match(group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_ccbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one(
        {"_id": oid},
        {"_id": 1, "station_id": 1, f"photos.{group}": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    MAX_PHOTOS_PER_GROUP = 10
    existing_count = len((doc.get("photos") or {}).get(group, []))
    remaining = MAX_PHOTOS_PER_GROUP - existing_count
    if remaining <= 0:
        return {"ok": True, "count": 0, "group": group, "files": [], "skipped": "group_full"}
    files = files[:remaining]

    dest_dir = pathlib.Path(UPLOADS_ROOT) / "ccbpm" / station_id / report_id / "post" / group
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

        data = resize_image_bytes(data, max_width=1280, quality=75)

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.jpg")
        fname = pathlib.Path(fname).stem + ".jpg"
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/ccbpm/{station_id}/{report_id}/post/{group}/{fname}"
        saved.append({
            "filename": fname,
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc),
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos.{group}": {"$each": saved}},
            "$set": {"has_photos": True, "updatedAt": datetime.now(timezone.utc)},
        },
    )
    if not saved:
        raise HTTPException(status_code=400, detail="No files were saved")

    return {"ok": True, "count": len(saved), "group": group, "files": saved}


# ============================================
# Finalize
# ============================================

@router.post("/ccbpmreport/{report_id}/finalize")
async def ccbpmreport_finalize(
    report_id: str,
    station_id: str = Form(...),
    current: UserClaims = Depends(get_current_user),
):
    coll = get_ccbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid, "station_id": station_id}, {"_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    res = await coll.update_one(
        {"_id": oid},
        {"$set": {
            "status": "submitted",
            "submittedAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
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
# CCB PM URL (PDF Upload + List)
# ============================================

@router.post("/ccbpmurl/upload-files", status_code=201)
async def ccbpmurl_upload_files(
    station_id: str = Form(...),
    reportDate: str = Form(...),
    files: List[UploadFile] = File(...),
    issue_id: Optional[str] = Form(None),
    doc_name: Optional[str] = Form(None),
    inspector: Optional[str] = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    """Upload PM PDF files for a CCB"""
    coll = get_ccbpmurl_coll_upload(station_id)
    rep_coll = get_ccbpmreport_collection_for(station_id)

    pm_date = normalize_pm_date(reportDate)
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

    pm_type = "CC"

    # Resolve issue_id
    final_issue_id: str | None = None
    client_issue = (issue_id or "").strip()

    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        valid_fmt = client_issue.startswith(prefix)

        url_exists = await coll.find_one({"issue_id": client_issue})
        rep_exists = await rep_coll.find_one({"issue_id": client_issue})
        unique = not (url_exists or rep_exists)

        if valid_fmt and unique:
            final_issue_id = client_issue

    if not final_issue_id:
        final_issue_id = await _next_issue_id_no_conflict(
            coll.database, rep_coll, coll, station_id, pm_type, d, pad=2
        )

    # Reuse year_seq from existing report if possible
    year_seq: int | None = None
    rep = await rep_coll.find_one(
        {"issue_id": final_issue_id},
        {"year_seq": 1, "pm_date": 1},
    )
    if rep and rep.get("year_seq") is not None:
        year_seq = int(rep["year_seq"])

    if year_seq is None:
        year_seq = await _next_year_seq(coll.database, station_id, pm_type, d)

    year = d.year

    # Resolve doc_name
    final_doc_name: str | None = None
    if doc_name:
        candidate = doc_name.strip()
        ok_format = candidate.startswith(f"{station_id}_")

        rep_exists = await rep_coll.find_one({"doc_name": candidate})
        url_exists = await coll.find_one({"doc_name": candidate})
        unique = not (rep_exists or url_exists)

        if ok_format and unique:
            final_doc_name = candidate

    if not final_doc_name:
        final_doc_name = f"{station_id}_{year_seq}/{year}"

    # Save files
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "ccbpmurl" / station_id / pm_date
    dest_dir.mkdir(parents=True, exist_ok=True)

    urls: list[str] = []
    metas: list[dict] = []

    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext != "pdf":
            raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

        data = await f.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail=f"Empty file: {f.filename}")
        if not data[:5].startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail=f"Invalid PDF file: {f.filename}")
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
        dest = dest_dir / fname
        with open(dest, "wb") as out:
            out.write(data)

        urls.append(f"/uploads/ccbpmurl/{station_id}/{pm_date}/{fname}")
        metas.append({"name": f.filename, "size": len(data)})

    inspector_clean = (inspector or "").strip() or None

    now = datetime.now(timezone.utc)
    doc = {
        "station_id": station_id,
        "pm_date": pm_date,
        "issue_id": final_issue_id,
        "inspector": inspector_clean,
        "year": year,
        "year_seq": year_seq,
        "doc_name": final_doc_name,
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
        "year_seq": year_seq,
        "doc_name": final_doc_name,
        "inspector": inspector_clean,
    }


@router.get("/ccbpmurl/list")
async def ccbpmurl_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current: UserClaims = Depends(get_current_user),
):
    """List PM URL documents for a CCB"""
    coll = get_ccbpmurl_coll_upload(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find(
        {},
        {"_id": 1, "issue_id": 1, "doc_name": 1, "inspector": 1,
         "pm_date": 1, "reportDate": 1, "urls": 1, "createdAt": 1},
    ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    def _pm_date_from(doc: dict) -> str | None:
        s = doc.get("pm_date")
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
    pm_date_arr = []

    for it in items_raw:
        pm_date_str = _pm_date_from(it)
        if pm_date_str:
            pm_date_arr.append(pm_date_str)

        urls = it.get("urls") or []
        first_url = urls[0] if urls else ""

        items.append({
            "id": str(it["_id"]),
            "pm_date": pm_date_str,
            "issue_id": it.get("issue_id"),
            "inspector": it.get("inspector"),
            "doc_name": it.get("doc_name"),
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": first_url,
            "urls": urls,
        })

    return {
        "items": items,
        "pm_date": [d for d in pm_date_arr if d],
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }


# ============================================
# Migration & Photos ZIP
# ============================================

@router.post("/ccbpmreport/migrate/has-photos")
async def migrate_has_photos_endpoint(
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """One-time migration: set has_photos=True for docs that have photos but missing the flag"""
    coll = get_ccbpmreport_collection_for(station_id)
    result = await coll.update_many(
        {
            "has_photos": {"$exists": False},
            "$or": [
                {"photos_pre": {"$ne": {}, "$exists": True}},
                {"photos": {"$ne": {}, "$exists": True}},
            ],
        },
        {"$set": {"has_photos": True}},
    )
    return {"ok": True, "modified": result.modified_count}


@router.get("/ccbpmreport/{report_id}/photos/zip")
async def download_photos_zip(
    report_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """Download all Pre & Post photos of a report as a single ZIP file"""
    coll = get_ccbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one(
        {"_id": oid, "station_id": station_id},
        {"photos_pre": 1, "photos": 1, "has_photos": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    if not doc.get("has_photos"):
        raise HTTPException(status_code=404, detail="No photos found")

    # รวม photos_pre และ photos เข้าด้วยกัน
    all_photos: list[tuple[str, str]] = []  # (zip_path, disk_path)

    photos_pre: dict = doc.get("photos_pre") or {}
    for group, items in photos_pre.items():
        for item in (items or []):
            fname = item.get("filename", "")
            if not fname:
                continue
            disk_path = pathlib.Path(UPLOADS_ROOT) / "ccbpm" / station_id / report_id / "pre" / group / fname
            all_photos.append((f"pre/{group}/{fname}", str(disk_path)))

    photos_post: dict = doc.get("photos") or {}
    for group, items in photos_post.items():
        for item in (items or []):
            fname = item.get("filename", "")
            if not fname:
                continue
            disk_path = pathlib.Path(UPLOADS_ROOT) / "ccbpm" / station_id / report_id / "post" / group / fname
            all_photos.append((f"post/{group}/{fname}", str(disk_path)))

    if not all_photos:
        raise HTTPException(status_code=404, detail="No photos found")

    # สร้าง ZIP ใน memory
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for zip_path, disk_path in all_photos:
            p = pathlib.Path(disk_path)
            if p.exists():
                zf.write(p, arcname=zip_path)

    zip_buffer.seek(0)
    zip_filename = f"photos_{station_id}_{report_id}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )