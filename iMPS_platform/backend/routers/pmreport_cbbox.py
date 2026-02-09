"""PM Report routes for CB-BOX"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone, date
from dateutil.relativedelta import relativedelta
from bson.objectid import ObjectId
from bson.errors import InvalidId
from typing import List, Dict, Any, Optional, Literal
import re, json, uuid, pathlib, secrets

from config import normalize_pm_date, CBBOXPMReportDB, CBBOXPMUrlDB, station_collection, _validate_station_id, th_tz, _ensure_utc_iso
from deps import UserClaims, get_current_user
from routers.pm_helpers import (
    UPLOADS_ROOT,
    ALLOWED_EXTS,
    MAX_FILE_MB,
    _safe_name,
    _ext,
    get_cbboxpmreport_collection_for,
    get_cbboxpmurl_coll_upload,
    _latest_issue_id_anywhere,
    _next_issue_id,
    _latest_doc_name_from_pmreport,
    _latest_doc_name_anywhere,
    _next_year_seq,
    _next_issue_id_no_conflict,
)

router = APIRouter()


class CBBOXPMSubmitIn(BaseModel):
    side: Literal["pre", "post"]
    station_id: str
    job: Dict[str, Any]         # โครงงาน (location/date/inspector ฯลฯ)
    rows_pre: Dict[str, Dict[str, Any]]  # ✅ เพิ่ม rows_pre {"r1": {"pf": "...", "remark": "..."}, ...}
    measures_pre: Dict[str, Dict[str, Any]]  # {"m5": {...}}
    pm_date: str                # "YYYY-MM-DD"
    issue_id: Optional[str] = None
    doc_name: Optional[str] = None 
    inspector: Optional[str] = None
    dropdownQ1: Optional[str] = None  # ✅ dropdown Q1
    dropdownQ2: Optional[str] = None  # ✅ dropdown Q2
    comment_pre: Optional[str] = None  # ✅ เพิ่ม comment สำหรับ Pre mode

@router.get("/cbboxpmreport/preview-issueid")
async def cbboxpmreport_preview_issueid(
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

    pm_type = "CB"

    latest = await _latest_issue_id_anywhere(station_id, pm_type, d,source="cbbox")

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"

    if not latest:
        next_issue = f"{prefix}01"
    else:
        m = re.search(r"(\d+)$", latest)
        cur = int(m.group(1)) if m else 0
        next_issue = f"{prefix}{cur+1:02d}"

    return {"issue_id": next_issue}

@router.get("/cbboxpmreport/latest-docname")
async def cbboxpmreport_latest_docname(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดึง doc_name ล่าสุดของสถานี (ปีเดียวกับ pm_date)
    เพื่อใช้คำนวณเลขถัดไปที่ frontend
    """
    latest = await _latest_doc_name_from_pmreport(station_id, pm_date, source="cbbox")
    
    return {
        "doc_name": latest.get("doc_name") if latest else None,
        "station_id": station_id,
        "pm_date": pm_date
    }

@router.get("/cbboxpmreport/preview-docname")
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

    latest = await _latest_doc_name_anywhere(station_id, year,source="cbbox")

    if not latest:
        next_doc = f"{station_id}_1/{year}"
    else:
        import re
        m = re.search(r"_(\d+)/\d{4}$", latest)
        current_num = int(m.group(1)) if m else 0
        next_doc = f"{station_id}_{current_num + 1}/{year}"

    return {"doc_name": next_doc}

@router.post("/cbboxpmreport/pre/submit")
async def cbboxpmreport_submit(body: CBBOXPMSubmitIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    coll = get_cbboxpmreport_collection_for(station_id)
    db = coll.database

    pm_type = str(body.job.get("pm_type") or "CB").upper()
    body.job["pm_type"] = pm_type

    url_coll = get_cbboxpmurl_coll_upload(station_id)

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
        unique = not await coll.find_one({"station_id": station_id, "issue_id": client_issue})
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
        year = f"{d.year}"
        prefix = f"{station_id}_"
        valid_fmt = client_docName.startswith(prefix)

        url_coll = get_cbboxpmurl_coll_upload(station_id)
        rep_exists = await coll.find_one({"station_id": station_id, "doc_name": client_docName})
        url_exists = await url_coll.find_one({"doc_name": client_docName})
        unique = not (rep_exists or url_exists)

        if valid_fmt and unique:
            doc_name = client_docName
 
    if not doc_name:
        year_seq = await _next_year_seq(db, station_id, pm_type, d)
        year = d.year
        doc_name = f"{station_id}_{year_seq}/{year}"

    doc = {
        "station_id": station_id,
        "doc_name": doc_name,
        "issue_id": issue_id,
        "job": body.job,
        "dropdownQ1": body.dropdownQ1,  # ✅ dropdown Q1
        "dropdownQ2": body.dropdownQ2,  # ✅ dropdown Q2
        "rows_pre": body.rows_pre,      # ✅ เพิ่ม rows_pre
        "measures_pre": body.measures_pre,
        "comment_pre": body.comment_pre,  # ✅ เพิ่ม comment สำหรับ Pre mode
        "pm_date": body.pm_date,
        "status": "draft",
        "photos_pre": {},
        "inspector": body.inspector,
        "side": body.side,
        "createdAt": datetime.now(timezone.utc),
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id),
        "issue_id": issue_id,
        "doc_name": doc_name,
    }
       
class CBBOXPMPostIn(BaseModel):
    report_id: str | None = None
    station_id: str
    rows: dict
    measures: dict
    summary: str
    summaryCheck: str | None = None
    dropdownQ1: Optional[str] = None  # ✅ dropdown Q1
    dropdownQ2: Optional[str] = None  # ✅ dropdown Q2
    side: Literal["post", "after"]

@router.post("/cbboxpmreport/submit")
async def cbboxpmreport_submit(body: CBBOXPMPostIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    coll = get_cbboxpmreport_collection_for(station_id)
    db = coll.database

    url_coll = get_cbboxpmurl_coll_upload(station_id)

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
            "summary": body.summary,
            "summaryCheck": body.summaryCheck,
            "dropdownQ1": body.dropdownQ1,  # ✅ dropdown Q1
            "dropdownQ2": body.dropdownQ2,  # ✅ dropdown Q2
            "side": "post",
            "updatedAt": datetime.now(timezone.utc),
        }

        await coll.update_one({"_id": oid}, {"$set": update_fields})

        return {
            "ok": True,
            "report_id": body.report_id,
        }

    doc = {
        "station_id": station_id,
        "rows": body.rows,
        "summary": body.summary,
        "summaryCheck": body.summaryCheck,
        "measures": body.measures, 
        "status": "draft",
        "photos": {},
        "side": body.side,
        "updatedAt": datetime.now(timezone.utc),
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id),
    }

@router.get("/cbboxpmreport/get")
async def cbboxpmreport_get(station_id: str, report_id: str, current: UserClaims = Depends(get_current_user)):
    coll = get_cbboxpmreport_collection_for(station_id)
    doc = await coll.find_one({"_id": ObjectId(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="not found")

    doc["_id"] = str(doc["_id"])
    return doc


@router.get("/cbboxpmreport/list")
async def cbboxpmreport_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    coll = get_cbboxpmreport_collection_for(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find({}, {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector" : 1,"side":1, "createdAt": 1}).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    # ผูก URL PDF รายวันจาก CCBPMUrlDB (ถ้ามี)
    pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
    url_by_day: Dict[str, str] = {}
    if pm_dates:
        ucoll = get_cbboxpmurl_coll_upload(station_id)
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
        "inspector": it.get("inspector"),
        "side":it.get("side"),
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("pm_date") or "", ""),
    } for it in items_raw]

    return {"items": items, "pm_date": [it.get("pm_date") for it in items_raw if it.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}

@router.post("/cbboxpmreport/{report_id}/pre/photos")
async def cbboxpmreport_upload_photos(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),                   # "g1" .. "g11"
    files: List[UploadFile] = File(...),
):
    if not re.fullmatch(r"g\d+", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_cbboxpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    # โฟลเดอร์: /uploads/cbboxpm/{station_id}/{report_id}/{group}/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "cbboxpm" / station_id / report_id / "pre" / group
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/cbboxpm/{station_id}/{report_id}/pre/{group}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos_pre.{group}": {"$each": saved}},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    return {"ok": True, "count": len(saved), "group": group, "files": saved}


@router.post("/cbboxpmreport/{report_id}/post/photos")
async def cbboxpmreport_upload_photos(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),                   # "g1" .. "g11"
    files: List[UploadFile] = File(...),
    remark: Optional[str] = Form(None),
):
    if not re.fullmatch(r"g\d+", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_cbboxpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    # โฟลเดอร์: /uploads/cbboxpm/{station_id}/{report_id}/{group}/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "cbboxpm" / station_id / report_id / "post" / group
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/cbboxpm/{station_id}/{report_id}/post/{group}/{fname}"
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
            "$push": {f"photos.{group}": {"$each": saved}},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    return {"ok": True, "count": len(saved), "group": group, "files": saved}

@router.post("/cbboxpmreport/{report_id}/finalize")
async def cbboxpmreport_finalize(
    report_id: str,
    station_id: str = Form(...),
):
    coll = get_cbboxpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    res = await coll.update_one(
        {"_id": oid},
        {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}

@router.post("/cbboxpmurl/upload-files", status_code=201)
async def cbboxpmurl_upload_files(
    station_id: str = Form(...),
    reportDate: str = Form(...),            # "YYYY-MM-DD" หรือ ISO -> จะ normalize เป็น YYYY-MM-DD
    files: List[UploadFile] = File(...),    # อนุญาตเฉพาะ .pdf
    issue_id: Optional[str] = Form(None),
    doc_name: Optional[str] = Form(None),
    inspector: Optional[str] = Form(None),
):
    coll = get_cbboxpmurl_coll_upload(station_id)
    pm_date = normalize_pm_date(reportDate)  # คืน YYYY-MM-DD

    pm_type = "CB"
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

    rep_coll = get_cbboxpmreport_collection_for(station_id)
    final_issue_id = None
    client_issue = (issue_id or "").strip()

    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        valid_fmt = client_issue.startswith(prefix)

        # ตรวจ uniqueness ในทั้ง 2 คอลเลกชัน
        url_exists = await coll.find_one({"issue_id": client_issue})
        rep_exists = await rep_coll.find_one({"issue_id": client_issue})
        unique = not (url_exists or rep_exists)

        if valid_fmt and unique:
            final_issue_id = client_issue

    if not final_issue_id:
        while True:
            candidate = await _next_issue_id(coll.database, station_id, pm_type, d, pad=2)
            url_exists = await coll.find_one({"issue_id": candidate})
            rep_exists = await rep_coll.find_one({"issue_id": candidate})
            if not url_exists and not rep_exists:
                final_issue_id = candidate
                break

    year_seq: int | None = None
    # พยายาม reuse year_seq จาก PMReportDB ถ้ามีอยู่แล้ว (issue_id เดียวกัน)
    rep = await get_cbboxpmreport_collection_for(station_id).find_one(
        {"issue_id": final_issue_id},
        {"year_seq": 1, "pm_date": 1},
    )
    if rep and rep.get("year_seq") is not None:
        year_seq = int(rep["year_seq"])

    # ถ้าไม่มีค่า year_seq จาก PMReport → ออกใหม่จาก pm_year_sequences
    if year_seq is None:
        year_seq = await _next_year_seq(coll.database, station_id, pm_type, d)

    year = d.year
    final_doc_name: str | None = None

    if doc_name:
        candidate = doc_name.strip()

        ok_format = candidate.startswith(f"{station_id}_")

        rep_coll = get_cbboxpmreport_collection_for(station_id)
        rep_exists = await rep_coll.find_one({"doc_name": candidate})
        url_exists = await coll.find_one({"doc_name": candidate})
        unique = not (rep_exists or url_exists)

        if ok_format and unique:
            final_doc_name = candidate

    if not final_doc_name:
        final_doc_name = f"{station_id}_{year_seq}/{year}"

    doc_name = final_doc_name

    # เก็บไว้ที่ /uploads/mdbpmurl/<station_id>/<YYYY-MM-DD>/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "cbboxpmurl" / station_id / pm_date
    dest_dir.mkdir(parents=True, exist_ok=True)


    urls, metas = [], []
    for f in files:
        ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext != "pdf":
            raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url = f"/uploads/cbboxpmurl/{station_id}/{pm_date}/{fname}"
        urls.append(url)
        metas.append({"name": f.filename, "size": len(data)})
    
    inspector_clean = (inspector or "").strip() or None
    now = datetime.now(timezone.utc)
    res = await coll.insert_one({
        "station": station_id,
        "issue_id": final_issue_id, 
        "inspector": inspector_clean,
        "doc_name": doc_name,
        "pm_date": pm_date,
        "urls": urls,
        "meta": {"files": metas},
        "source": "upload-files",
        "createdAt": now,
        "updatedAt": now,
    })
    return {"ok": True, "inserted_id": str(res.inserted_id), "count": len(urls), "urls": urls,"issue_id": final_issue_id,"doc_name": doc_name,"inspector": inspector_clean}

@router.get("/cbboxpmurl/list")
async def cbboxpmurl_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    coll = get_cbboxpmurl_coll_upload(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find(
        {},
        {"_id": 1, "issue_id": 1,"doc_name": 1,"inspector":1, "pm_date": 1, "urls": 1, "createdAt": 1}
    ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    items = []
    for it in items_raw:
        urls = it.get("urls") or []
        first_url = urls[0] if urls else ""
        items.append({
            "id": str(it["_id"]),
            "pm_date": it.get("pm_date"),
            "issue_id": it.get("issue_id"),
            "inspector": it.get(("inspector")), 
            "doc_name": it.get("doc_name"),
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": first_url,
            "urls": urls,
        })

    return {"items": items, "pm_date": [i["pm_date"] for i in items if i.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}
