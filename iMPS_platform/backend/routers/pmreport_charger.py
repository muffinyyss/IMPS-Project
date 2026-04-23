"""PM Report routes for Chargers (SN-based)"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Form, Path
from fastapi.responses import Response, JSONResponse, StreamingResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from datetime import datetime, timedelta, timezone, date
from dateutil.relativedelta import relativedelta
from bson.objectid import ObjectId
from pymongo import ReturnDocument
from bson.errors import InvalidId
from bson.decimal128 import Decimal128
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional, Literal
import re, json, uuid, pathlib, secrets, os, asyncio
import zipfile

from config import (
    PMReportDB, PMUrlDB, charger_collection, station_collection,
    _validate_station_id, th_tz,
    MDBPMReportDB, MDBPMUrlDB, CCBPMReportDB, CCBPMUrlDB,
    CBBOXPMReportDB, CBBOXPMUrlDB, normalize_pm_date, _ensure_utc_iso,
)
from deps import UserClaims, get_current_user
from routers.pm_helpers import (
    UPLOADS_ROOT,
    ALLOWED_EXTS,
    MAX_FILE_MB,
    _validate_sn,
    _safe_name,
    _ext,
    parse_iso_any_tz,
    get_pmreport_collection_for,
    get_pmurl_coll_upload,
    get_mdbpmreport_collection_for,
    get_mdbpmurl_coll_upload,
    get_ccbpmreport_collection_for,
    get_ccbpmurl_coll_upload,
    get_cbboxpmreport_collection_for,
    get_cbboxpmurl_coll_upload,
    get_stationpmreport_collection_for,
    get_stationpmurl_coll_upload,
    _get_collections_for_source,
    _latest_issue_id_anywhere,
    _next_issue_id,
    _next_issue_id_no_conflict,
    _latest_doc_name_from_pmreport,
    _latest_doc_name_anywhere,
    _next_year_seq,
)

from PIL import Image
from io import BytesIO

import tempfile

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

async def _get_charger_by_sn(sn: str) -> dict:
    """Get charger document by SN, raise 404 if not found"""
    charger = charger_collection.find_one({"SN": sn})
    if not charger:
        raise HTTPException(status_code=404, detail=f"Charger with SN '{sn}' not found")
    return charger

def _compute_next_pm_date_str(pm_date_str: str | None) -> str | None:
    if not pm_date_str:
        return None
    try:
        d = datetime.fromisoformat(pm_date_str).date()
    except ValueError:
        return None
    next_d = d + relativedelta(months=+6)
    return next_d.isoformat()

async def _latest_pm_date_from_pmreport(sn: str) -> dict | None:
    _validate_sn(sn)
    coll = PMReportDB.get_collection(str(sn))

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

async def _pmreport_latest_core(sn: str, current: UserClaims):
    """Get latest PM report info for a charger by SN"""
    _validate_sn(sn)

    charger = await _get_charger_by_sn(sn)

    pi_fw  = charger.get("PIFirmware")
    plc_fw = charger.get("PLCFirmware")
    rt_fw  = charger.get("RTFirmware")
    station_id = charger.get("station_id")

    pm_latest = await _latest_pm_date_from_pmreport(sn)
    pm_date = pm_latest.get("pm_date") if pm_latest else None

    ts_raw = (pm_latest.get("timestamp") if pm_latest else None) or charger.get("createdAt")

    ts_dt = (parse_iso_any_tz(ts_raw) if isinstance(ts_raw, str)
             else (ts_raw if isinstance(ts_raw, datetime) else None))
    ts_utc = ts_dt.astimezone(ZoneInfo("UTC")).isoformat() if ts_dt else None
    ts_th  = ts_dt.astimezone(ZoneInfo("Asia/Bangkok")).isoformat() if ts_dt else None

    pm_next_date = _compute_next_pm_date_str(pm_date)

    return {
        "_id": str(charger["_id"]),
        "sn": sn,
        "station_id": station_id,
        "chargeBoxID": charger.get("chargeBoxID"),
        "pi_firmware": pi_fw,
        "plc_firmware": plc_fw,
        "rt_firmware": rt_fw,
        "pm_date": pm_date,
        "pm_next_date": pm_next_date,
        "timestamp": ts_raw,
        "timestamp_utc": ts_utc,
        "timestamp_th": ts_th,
        "source": "chargers + PMReportDB",
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

@router.get("/pmreport/get")
async def pmreport_get(sn: str, report_id: str, current: UserClaims = Depends(get_current_user)):
    coll = get_pmreport_collection_for(sn)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")
    doc = await coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return serialize_doc(doc)


@router.get("/pmreport/list")
async def pmreport_list(
    sn: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current: UserClaims = Depends(get_current_user),
):
    """List PM reports for a charger by SN"""
    coll = get_pmreport_collection_for(sn)
    skip = (page - 1) * pageSize

    cursor = coll.find({}, {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector": 1, "side": 1, "has_photos": 1, "createdAt": 1}).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)
    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
    urls_coll = get_pmurl_coll_upload(sn)
    url_by_day: dict[str, str] = {}

    if pm_dates:
        ucur = urls_coll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
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
        "inspector": it.get("inspector"),
        "side": it.get("side"),
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("pm_date") or "", ""),
        "has_photos": True if it.get("has_photos") else None,
    } for it in items_raw]

    pm_date_arr = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
    return {"items": items, "pm_date": pm_date_arr, "page": page, "pageSize": pageSize, "total": total}


@router.get("/pmreport/latest/{sn}")
async def pmreport_latest_by_path(
    sn: str = Path(..., description="Charger Serial Number"),
    current: UserClaims = Depends(get_current_user),
):
    """Get latest PM info for a charger by SN (path param)"""
    return await _pmreport_latest_core(sn, current)

class PMMeasureRow(BaseModel):
    value: str = ""
    unit: str = "V"

class PMMeasures(BaseModel):
    m16: Dict[str, PMMeasureRow] = Field(default_factory=dict)
    cp: PMMeasureRow = PMMeasureRow()

class PMRowPF(BaseModel):
    pf: Optional[Literal["PASS","FAIL","NA",""]] = ""
    remark: Optional[str] = ""

class PMSubmitIn(BaseModel):
    side: Literal["pre", "post"]
    sn: str
    job: dict
    measures_pre: dict
    rows_pre: Optional[dict[str, Any]] = None
    pm_date: str
    issue_id: Optional[str] = None
    doc_name: Optional[str] = None
    inspector: Optional[str] = None
    summary_pre: Optional[str] = None

@router.get("/pmreport/preview-issueid")
async def pmreport_preview_issueid(
    sn: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """Preview next issue_id without actually generating it"""
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    pm_type = "CG"
    latest = await _latest_issue_id_anywhere(sn, pm_type, d)

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"

    if not latest:
        next_issue = f"{prefix}01"
    else:
        m = re.search(r"(\d+)$", latest)
        cur = int(m.group(1)) if m else 0
        next_issue = f"{prefix}{cur+1:02d}"

    return {"issue_id": next_issue}

@router.get("/pmreport/latest-docname")
async def pmreport_latest_docname(
    sn: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """Get latest doc_name for calculating next number at frontend"""
    latest = await _latest_doc_name_from_pmreport(sn, pm_date)
    return {
        "doc_name": latest.get("doc_name") if latest else None,
        "sn": sn,
        "pm_date": pm_date
    }

@router.get("/pmreport/preview-docname")
async def preview_docname(
    sn: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """Preview next doc_name without actually generating it"""
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    year = d.year
    latest = await _latest_doc_name_anywhere(sn, year)

    if not latest:
        next_doc = f"{sn}_1/{year}"
    else:
        m = re.search(r"_(\d+)/\d{4}$", latest)
        current_num = int(m.group(1)) if m else 0
        next_doc = f"{sn}_{current_num + 1}/{year}"

    return {"doc_name": next_doc}

@router.post("/pmreport/pre/submit")
async def pmreport_pre_submit(body: PMSubmitIn, current: UserClaims = Depends(get_current_user)):
    sn = body.sn.strip()
    coll = get_pmreport_collection_for(sn)
    url_coll = get_pmurl_coll_upload(sn)
    db = coll.database

    pm_type = str(body.job.get("pm_type") or "CG").upper()
    body.job["pm_type"] = pm_type

    try:
        d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    charger_task = _get_charger_by_sn(sn)

    client_issue = body.issue_id
    client_doc = body.doc_name

    tasks = [charger_task]

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

    charger = results[0]
    station_id = charger.get("station_id")

    issue_id = None
    if client_issue and client_issue.startswith(prefix):
        rep_exists, url_exists = results[1], results[2]
        if not rep_exists and not url_exists:
            issue_id = client_issue

    if not issue_id:
        issue_id = await _next_issue_id_no_conflict(db, coll, url_coll, sn, pm_type, d)

    doc_name = None
    if client_doc and client_doc.startswith(f"{sn}_"):
        rep_exists, url_exists = results[3], results[4]
        if not rep_exists and not url_exists:
            doc_name = client_doc

    if not doc_name:
        year_seq = await _next_year_seq(db, sn, pm_type, d)
        doc_name = f"{sn}_{year_seq}/{d.year}"

    existing_draft = await coll.find_one(
        {"sn": sn, "pm_date": body.pm_date, "side": "pre", "status": "draft"},
        {"_id": 1, "issue_id": 1, "doc_name": 1},
    )

    if existing_draft:
        await coll.update_one(
            {"_id": existing_draft["_id"]},
            {"$set": {
                "station_id": station_id,
                "chargeBoxID": charger.get("chargeBoxID"),
                "job": body.job,
                "rows_pre": body.rows_pre or {},
                "measures_pre": body.measures_pre,
                "inspector": body.inspector,
                "summary_pre": body.summary_pre or "",
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
        "sn": sn,
        "station_id": station_id,
        "chargeBoxID": charger.get("chargeBoxID"),
        "doc_name": doc_name,
        "issue_id": issue_id,
        "job": body.job,
        "rows_pre": body.rows_pre or {},
        "measures_pre": body.measures_pre,
        "pm_date": body.pm_date,
        "inspector": body.inspector,
        "summary_pre": body.summary_pre or "",
        "photos_pre": {},
        "status": "draft",
        "side": body.side,
        "timestamp": datetime.now(timezone.utc),
    }
    res = await coll.insert_one(doc)
    return {"ok": True, "report_id": str(res.inserted_id), "issue_id": issue_id, "doc_name": doc_name}


class PMPostIn(BaseModel):
    report_id: str | None = None
    sn: str
    rows: dict
    measures: dict
    summary: str
    summaryCheck: str | None = None
    dust_filter: Dict[str, bool] | None = None
    side: Literal["post", "after"]

@router.post("/pmreport/submit")
async def pmreport_post_submit(
    body: PMPostIn,
    current: UserClaims = Depends(get_current_user)
):
    """Submit Post-PM report for a charger"""
    sn = body.sn.strip()
    coll = get_pmreport_collection_for(sn)
    db = coll.database
    url_coll = get_pmurl_coll_upload(sn)

    if body.report_id:
        try:
            oid = ObjectId(body.report_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="invalid report_id")

        existing = await coll.find_one({"_id": oid, "sn": sn})
        if not existing:
            raise HTTPException(status_code=404, detail="Report not found")

        update_fields = {
            "rows": body.rows,
            "measures": body.measures,
            "summary": body.summary,
            "summaryCheck": body.summaryCheck,
            "dust_filter": body.dust_filter,
            "side": "post",
            "timestamp_post": datetime.now(timezone.utc),
        }

        await coll.update_one({"_id": oid}, {"$set": update_fields})
        return {"ok": True, "report_id": body.report_id}

    charger = await _get_charger_by_sn(sn)

    existing_draft = await coll.find_one(
        {"sn": sn, "side": "post", "status": "draft"},
        {"_id": 1},
        sort=[("timestamp", -1)],
    )

    update_fields = {
        "rows": body.rows,
        "measures": body.measures,
        "summary": body.summary,
        "summaryCheck": body.summaryCheck,
        "dust_filter": body.dust_filter,
        "side": "post",
        "timestamp_post": datetime.now(timezone.utc),
    }

    if existing_draft:
        await coll.update_one({"_id": existing_draft["_id"]}, {"$set": update_fields})
        return {"ok": True, "report_id": str(existing_draft["_id"])}

    doc = {
        "sn": sn,
        "station_id": charger.get("station_id"),
        "chargeBoxID": charger.get("chargeBoxID"),
        **update_fields,
        "photos": {},
        "status": "draft",
        "timestamp": datetime.now(timezone.utc),
    }
    res = await coll.insert_one(doc)
    return {"ok": True, "report_id": str(res.inserted_id)}


@router.post("/pmreport/{report_id}/pre/photos")
async def pmreport_upload_pre_photos(
    report_id: str,
    sn: str = Form(...),
    group: str = Form(...),
    files: list[UploadFile] = File(...),
    current: UserClaims = Depends(get_current_user),
):
    """Upload Pre-PM photos for a charger report"""
    if not re.fullmatch(r"g\d+(_\d+)?", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_pmreport_collection_for(sn)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "sn": 1, f"photos_pre.{group}": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("sn") != sn:
        raise HTTPException(status_code=400, detail="sn mismatch")

    MAX_PHOTOS_PER_GROUP = 10
    existing_count = len((doc.get("photos_pre") or {}).get(group, []))
    if existing_count >= MAX_PHOTOS_PER_GROUP:
        raise HTTPException(status_code=400, detail=f"Max {MAX_PHOTOS_PER_GROUP} photos per group")
    files = files[:MAX_PHOTOS_PER_GROUP - existing_count]

    dest_dir = pathlib.Path(UPLOADS_ROOT) / "pm" / sn / report_id / "pre" / group
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

        url_path = f"/uploads/pm/{sn}/{report_id}/pre/{group}/{fname}"
        saved.append({
            "filename": fname,
            "url": url_path,
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos_pre.{group}": {"$each": saved}},
            "$set": {"has_photos": True},
        }
    )
    if not saved:
        raise HTTPException(status_code=400, detail="No files were saved")

    return {"ok": True, "count": len(saved), "group": group, "files": saved}


@router.post("/pmreport/{report_id}/post/photos")
async def pmreport_upload_post_photos(
    report_id: str,
    sn: str = Form(...),
    group: str = Form(...),
    files: list[UploadFile] = File(...),
    remark: str | None = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    """Upload Post-PM photos for a charger report"""
    if not re.fullmatch(r"g\d+(_\d+)?", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_pmreport_collection_for(sn)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "sn": 1, f"photos.{group}": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("sn") != sn:
        raise HTTPException(status_code=400, detail="sn mismatch")

    MAX_PHOTOS_PER_GROUP = 10
    existing_count = len((doc.get("photos") or {}).get(group, []))
    if existing_count >= MAX_PHOTOS_PER_GROUP:
        raise HTTPException(status_code=400, detail=f"Max {MAX_PHOTOS_PER_GROUP} photos per group")
    files = files[:MAX_PHOTOS_PER_GROUP - existing_count]

    dest_dir = pathlib.Path(UPLOADS_ROOT) / "pm" / sn / report_id / "post" / group
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

        url_path = f"/uploads/pm/{sn}/{report_id}/post/{group}/{fname}"
        saved.append({
            "filename": fname,
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos.{group}": {"$each": saved}},
            "$set": {"has_photos": True},
        }
    )
    if not saved:
        raise HTTPException(status_code=400, detail="No files were saved")

    return {"ok": True, "count": len(saved), "group": group, "files": saved}


@router.post("/pmreport/{report_id}/finalize")
async def pmreport_finalize(report_id: str, sn: str = Form(...), current: UserClaims = Depends(get_current_user)):
    coll = get_pmreport_collection_for(sn)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    res = await coll.update_one(
        {"_id": oid},
        {"$set": {
            "status": "submitted",
            "submittedAt": datetime.now(timezone.utc),
        }}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    for lang in ("th", "en"):
        cache_path = pathlib.Path(UPLOADS_ROOT) / "pdf_cache" / sn / f"{report_id}_{lang}.pdf"
        if cache_path.exists():
            cache_path.unlink()

    return {"ok": True}


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

def normalize_pm_date(s: str) -> str:
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
        return s
    if s.endswith("Z") or re.search(r"[+\-]\d{2}:\d{2}$", s):
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    else:
        dt = datetime.fromisoformat(s).replace(tzinfo=th_tz)
    return dt.astimezone(th_tz).date().isoformat()

@router.post("/pmurl/upload-files", status_code=201)
async def pmurl_upload_files(
    sn: str = Form(...),
    reportDate: str = Form(...),
    files: list[UploadFile] = File(...),
    issue_id: Optional[str] = Form(None),
    doc_name: Optional[str] = Form(None),
    inspector: Optional[str] = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    """Upload PM PDF files for a charger"""
    charger = await _get_charger_by_sn(sn)
    station_id = charger.get("station_id")

    coll = get_pmurl_coll_upload(sn)
    pm_date = normalize_pm_date(reportDate)

    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

    pm_type = "CG"

    rep_coll = get_pmreport_collection_for(sn)
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
            coll.database, rep_coll, coll, sn, pm_type, d, pad=2
        )

    year_seq: int | None = None

    rep = await get_pmreport_collection_for(sn).find_one(
        {"issue_id": final_issue_id},
        {"year_seq": 1, "pm_date": 1},
    )
    if rep and rep.get("year_seq") is not None:
        year_seq = int(rep["year_seq"])

    if year_seq is None:
        year_seq = await _next_year_seq(coll.database, sn, pm_type, d)

    year = d.year
    final_doc_name: str | None = None

    if doc_name:
        candidate = doc_name.strip()
        ok_format = candidate.startswith(f"{sn}_")

        rep_exists = await rep_coll.find_one({"doc_name": candidate})
        url_exists = await coll.find_one({"doc_name": candidate})
        unique = not (rep_exists or url_exists)

        if ok_format and unique:
            final_doc_name = candidate

    if not final_doc_name:
        final_doc_name = f"{sn}_{year_seq}/{year}"

    doc_name = final_doc_name

    subdir = pm_date
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "pmurl" / sn / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)

    urls: list[str] = []
    metas: list[dict] = []
    total_size = 0

    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext != "pdf":
            raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

        data = await f.read()
        if len(data) == 0:
            raise HTTPException(status_code=400, detail=f"Empty file: {f.filename}")
        if not data[:5].startswith(b"%PDF-"):
            raise HTTPException(status_code=400, detail=f"Invalid PDF file: {f.filename}")
        total_size += len(data)
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        safe = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
        dest = dest_dir / safe
        with open(dest, "wb") as out:
            out.write(data)

        url = f"/uploads/pmurl/{sn}/{subdir}/{safe}"
        urls.append(url)
        metas.append({"name": f.filename, "size": len(data)})

    inspector_clean = (inspector or "").strip() or None

    now = datetime.now(timezone.utc)
    doc = {
        "sn": sn,
        "station_id": station_id,
        "chargeBoxID": charger.get("chargeBoxID"),
        "pm_date": pm_date,
        "issue_id": final_issue_id,
        "inspector": inspector_clean,
        "year": year,
        "year_seq": year_seq,
        "doc_name": doc_name,
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
        "doc_name": doc_name,
        "inspector": inspector_clean,
    }


@router.get("/pmurl/list")
async def pmurl_list(
    sn: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current: UserClaims = Depends(get_current_user),
):
    """List PM URL documents for a charger"""
    coll = get_pmurl_coll_upload(sn)
    skip = (page - 1) * pageSize

    cursor = coll.find(
        {},
        {"_id": 1, "issue_id": 1, "doc_name": 1, "inspector": 1, "pm_date": 1, "reportDate": 1, "urls": 1, "createdAt": 1}
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
            "inspector": it.get("inspector"),
            "doc_name": it.get("doc_name"),
            "issue_id": it.get("issue_id"),
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


@router.post("/pmreport/migrate/has-photos")
async def migrate_has_photos_endpoint(
    sn: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """One-time migration: set has_photos=True for docs that have photos but missing the flag"""
    coll = get_pmreport_collection_for(sn)
    result = await coll.update_many(
        {
            "has_photos": {"$exists": False},
            "$or": [
                {"photos_pre": {"$ne": {}, "$exists": True}},
                {"photos": {"$ne": {}, "$exists": True}},
            ]
        },
        {"$set": {"has_photos": True}}
    )
    return {"ok": True, "modified": result.modified_count}



@router.get("/pmreport/{report_id}/photos/zip")
async def download_photos_zip(
    report_id: str,
    sn: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    coll = get_pmreport_collection_for(sn)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one(
        {"_id": oid, "sn": sn},
        {"photos_pre": 1, "photos": 1, "has_photos": 1}
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
            disk_path = pathlib.Path(UPLOADS_ROOT) / "pm" / sn / report_id / "pre" / group / fname
            zip_path = f"pre/{group}/{fname}"
            all_photos.append((zip_path, str(disk_path)))

    photos_post: dict = doc.get("photos") or {}
    for group, items in photos_post.items():
        for item in (items or []):
            fname = item.get("filename", "")
            if not fname:
                continue
            disk_path = pathlib.Path(UPLOADS_ROOT) / "pm" / sn / report_id / "post" / group / fname
            zip_path = f"post/{group}/{fname}"
            all_photos.append((zip_path, str(disk_path)))
            
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
    zip_filename = f"photos_{sn}_{report_id}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
    )