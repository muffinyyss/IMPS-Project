"""DC Test Report routes"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Form, Path
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from datetime import datetime, timezone, date
from bson.objectid import ObjectId
from pymongo import ReturnDocument
from typing import List, Dict, Any, Optional, Literal
import re, json, uuid, pathlib, secrets, os
from starlette.staticfiles import StaticFiles

from config import normalize_pm_date, DCTestReportDB, DCUrlDB, station_collection, _validate_station_id, th_tz, _ensure_utc_iso, PMUrlDB, ACTestReportDB, ACUrlDB
from deps import UserClaims, get_current_user
from routers.pm_helpers import (
    UPLOADS_ROOT, ALLOWED_EXTS, MAX_FILE_MB,
    ALLOWED_DOC_EXTS, MAX_DOC_FILE_MB,
    ALLOWED_IMAGE_EXTS, MAX_IMAGE_FILE_MB,
    PHOTO_GROUP_KEYS, _key_for_index, _normalize_tick_to_pass,
    _safe_name, _ext,
    get_dc_testreport_collection_for, get_dcurl_coll_upload,
    get_ac_testreport_collection_for, get_acurl_coll_upload,
)

router = APIRouter()

def get_dc_testreport_collection_for(sn: str):
    _validate_station_id(sn)
    coll = DCTestReportDB.get_collection(str(sn))
    return coll

def get_dcurl_coll_upload(sn: str):
    _validate_station_id(sn)
    coll = DCUrlDB.get_collection(str(sn))
    return coll


@router.get("/dctestreport/list")
async def dctestreport_list(
    sn: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    coll = get_dc_testreport_collection_for(sn)
    skip = (page - 1) * pageSize

    # ★★★ เพิ่ม issue_id และ document_name ใน projection ★★★
    cursor = coll.find({}, {
        "_id": 1, 
        "inspection_date": 1, 
        "createdAt": 1,
        "issue_id": 1,           # ★ เพิ่ม
        "document_name": 1,      # ★ เพิ่ม
        "head": 1,               # ★ เพิ่ม (เผื่อ issue_id อยู่ใน head)
    }).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)
    
    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    # --- ดึงไฟล์จาก PMReportURL โดย map ด้วย pm_date (string) ---
    dc_dates = [it.get("inspection_date") for it in items_raw if it.get("inspection_date")]
    urls_coll = get_dcurl_coll_upload(sn)
    url_by_day: dict[str, str] = {}

    if dc_dates:
        ucur = urls_coll.find({"inspection_date": {"$in": dc_dates}}, {"inspection_date": 1, "urls": 1})
        url_docs = await ucur.to_list(length=10_000)
        for u in url_docs:
            day = u.get("inspection_date")
            first_url = (u.get("urls") or [None])[0]
            if day and first_url and day not in url_by_day:
                url_by_day[day] = first_url

    # ★★★ เพิ่ม issue_id และ document_name ใน response ★★★
    items = [{
        "id": str(it["_id"]),
        "inspection_date": it.get("inspection_date"),
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("inspection_date") or "", ""),
        "issue_id": it.get("issue_id") or it.get("head", {}).get("issue_id") or "",      # ★ เพิ่ม
        "document_name": it.get("document_name") or it.get("issue_id") or "",            # ★ เพิ่ม
        "inspector": it.get("head", {}).get("inspector") or "", 
    } for it in items_raw]

    dc_date_arr = [it.get("inspection_date") for it in items_raw if it.get("inspection_date")]
    return {"items": items, "inspection_date": dc_date_arr, "page": page, "pageSize": pageSize, "total": total}

# ตำแหน่งโฟลเดอร์บนเครื่องเซิร์ฟเวอร์

# เสิร์ฟไฟล์คืนให้ Frontend ผ่าน /uploads/...


# ---- config ไฟล์/อัปโหลด (ถ้ายังไม่มีให้วางไว้ด้านบน) ----


@router.post("/dctestreport/{report_id}/photos")
async def dc_testreport_upload_photos(
    report_id: str,
    sn: str = Form(...),
    item_index: int = Form(...),               # <<-- เปลี่ยนจาก group → index
    files: list[UploadFile] = File(...),
    remark: str | None = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    # auth

    # รายงานต้องอยู่ในสถานีนี้
    coll = get_dc_testreport_collection_for(sn)
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    # แปลง index → ชื่อคีย์โฟลเดอร์/คีย์ในเอกสาร
    key = _key_for_index(item_index)  # e.g. nameplate/charger/.../extra1

    # โฟลเดอร์ปลายทาง
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "dctest" / sn / report_id / key
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1].lower() if "." in (f.filename or "") else "")
        if ext not in ALLOWED_IMAGE_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_IMAGE_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_IMAGE_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/dctest/{sn}/{report_id}/{key}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc),
            "index": item_index,          # เก็บ index เผื่ออ้างอิงกลับ
        })

    # อัปเดตเอกสารรายงาน: push ลง photos.<key>
    await coll.update_one(
        {"_id": oid},
        {"$push": {f"photos.{key}": {"$each": saved}}, "$set": {"updatedAt": datetime.now(timezone.utc)}}
    )

    return {"ok": True, "count": len(saved), "key": key, "files": saved}

@router.post("/dctestreport/{report_id}/finalize")
async def dc_testreport_finalize(
    report_id: str,
    sn: str = Form(...),
    current: UserClaims = Depends(get_current_user),
):

    coll = get_dc_testreport_collection_for(sn)
    from bson import ObjectId
    oid = ObjectId(report_id)
    res = await coll.update_one(
        {"_id": oid},
        {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}

@router.post("/dcurl/upload-files", status_code=201)
async def dcurl_upload_files(
    sn: str = Form(...),
    reportDate: str = Form(...),                 # "YYYY-MM-DD" หรือ ISO
    files: list[UploadFile] = File(...),
    current: UserClaims = Depends(get_current_user),
):
    # auth

    # ตรวจ/เตรียมคอลเลกชัน
    coll = get_dcurl_coll_upload(sn)

    # parse วันที่เป็น UTC datetime (มีฟังก์ชันอยู่แล้ว)
    dc_date = normalize_pm_date(reportDate)

    # โฟลเดอร์ปลายทาง: /uploads/pmurl/<sn>/<YYYY-MM-DD>/
    subdir = dc_date
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "dcurl" / sn / subdir
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

        url = f"/uploads/dcurl/{sn}/{subdir}/{safe}"   # ← จะเสิร์ฟได้จาก StaticFiles ที่ mount ไว้แล้ว
        urls.append(url)
        metas.append({"name": f.filename, "size": len(data)})

    now = datetime.now(timezone.utc)
    doc = {
        "station": sn,
        "dc_date": dc_date,   
        "urls": urls,
        "meta": {"files": metas},
        "source": "upload-files",
        "createdAt": now,
        "updatedAt": now,
    }
    res = await coll.insert_one(doc)

    return {"ok": True, "inserted_id": str(res.inserted_id), "count": len(urls), "urls": urls}

@router.get("/dcurl/list")
async def dcurl_list(
    sn: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    """
    ดึงรายการไฟล์ PM (PDF) ที่อัปโหลดไว้ต่อสถานี จาก PMUrlDB/<sn>
    - รองรับทั้งเอกสารที่เก็บ pm_date (string 'YYYY-MM-DD') และ reportDate (Date/ISO)
    - เรียงจากใหม่ไปเก่า (createdAt desc, _id desc)
    - รูปแบบผลลัพธ์ให้เหมือน /pmreport/list (มี file_url สำหรับลิงก์ตัวแรก)
    """
    coll = get_dcurl_coll_upload(sn)
    skip = (page - 1) * pageSize

    # ดึงเฉพาะฟิลด์ที่จำเป็น
    cursor = coll.find(
        {},
        {"_id": 1, "dc_date": 1, "reportDate": 1, "urls": 1, "createdAt": 1}
    ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    def _dc_date_from(doc: dict) -> str | None:
        """
        แปลงวันที่ในเอกสารให้ได้ string 'YYYY-MM-DD'
        - ถ้ามี pm_date (string) → คืนค่านั้น
        - ถ้ามี reportDate (datetime/string) → แปลงเป็นวันไทย แล้ว .date().isoformat()
        """
        # รุ่นใหม่: เก็บเป็น pm_date (string)
        s = doc.get("dc_date")
        if isinstance(s, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
            return s

        # รุ่นเก่า: เก็บเป็น reportDate (Date/ISO)
        rd = doc.get("reportDate")
        if isinstance(rd, datetime):
            return rd.astimezone(th_tz).date().isoformat()
        if isinstance(rd, str):
            try:
                dt = datetime.fromisoformat(rd.replace("Z", "+00:00"))
            except Exception:
                # เผื่อไม่มีโซนเวลา → ถือเป็นเวลาไทย
                try:
                    dt = datetime.fromisoformat(rd).replace(tzinfo=th_tz)
                except Exception:
                    return None
            return dt.astimezone(th_tz).date().isoformat()

        return None

    items = []
    dc_date_arr = []

    for it in items_raw:
        dc_date_str = _dc_date_from(it)
        if dc_date_str:
            dc_date_arr.append(dc_date_str)

        urls = it.get("urls") or []
        first_url = urls[0] if urls else ""

        items.append({
            "id": str(it["_id"]),
            "dc_date": dc_date_str,                         # 'YYYY-MM-DD' | None
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": first_url,                          # ไฟล์แรก (ไว้ให้ปุ่มดาวน์โหลด)
            "urls": urls,                                   # เผื่อฟรอนต์อยากแสดงทั้งหมด
        })

    return {
        "items": items,
        "dc_date": [d for d in dc_date_arr if d],          # ให้เหมือน /pmreport/list
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }

class EquipmentBlock(BaseModel):
    manufacturers: List[str] = []
    models: List[str] = []
    serialNumbers: List[str] = []

SymbolLiteral = Literal["", "pass", "notPass", "notTest"]
PhaseLiteral  = Literal["", "L1L2L3", "L3L2L1"]

class PersonSig(BaseModel):
    name: str = ""
    signature: str = ""   # เก็บ path/ข้อมูลลายเซ็น (หรือข้อความ)
    date: str = ""        # "YYYY-MM-DD"
    company: str = ""

class ResponsibilityBlock(BaseModel):
    performed: PersonSig = PersonSig()
    approved:  PersonSig = PersonSig()
    witnessed: PersonSig = PersonSig()

class SignatureBlock(BaseModel):
    responsibility: ResponsibilityBlock = ResponsibilityBlock()

# ===== เพิ่ม config สำหรับไฟล์เอกสาร =====

# ===== เพิ่ม endpoint ใหม่สำหรับ upload ไฟล์ในการทดสอบ =====
@router.post("/dctestreport/{report_id}/test-files")
async def dc_testreport_upload_test_files(
    report_id: str,
    sn: str = Form(...),
    test_type: str = Form(...),          # "electrical" หรือ "charger"
    item_index: int = Form(...),         # index ของหัวข้อทดสอบ
    round_index: int = Form(...),        # รอบที่ (0, 1, 2)
    handgun: str = Form(...),            # "h1" หรือ "h2"
    file: UploadFile = File(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    อัปโหลดไฟล์เอกสารสำหรับการทดสอบ
    - test_type: "electrical" (DCTest1Grid) หรือ "charger" (DCTest2Grid)
    - item_index: index ของหัวข้อทดสอบ (0-10 สำหรับ electrical, 0-6 สำหรับ charger)
    - round_index: รอบที่ทดสอบ (0, 1, 2)
    - handgun: "h1" หรือ "h2"
    """
    # Auth

    # Validate handgun
    if handgun not in ("h1", "h2"):
        raise HTTPException(status_code=400, detail="handgun must be 'h1' or 'h2'")
    
    # Validate test_type
    if test_type not in ("electrical", "charger"):
        raise HTTPException(status_code=400, detail="test_type must be 'electrical' or 'charger'")

    # Get report
    coll = get_dc_testreport_collection_for(sn)
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    # Validate file extension
    ext = (file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "")
    if ext not in ALLOWED_DOC_EXTS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

    # Read and validate size
    data = await file.read()
    if len(data) > MAX_DOC_FILE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large (> {MAX_DOC_FILE_MB} MB)")

    # Create destination directory
    # Structure: /uploads/dctest/{sn}/{report_id}/test_files/{test_type}/{item_index}/{round_index}/{handgun}/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "dctest" / sn / report_id / "test_files" / test_type / str(item_index) / str(round_index) / handgun
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Save file
    fname = _safe_name(file.filename or f"file_{secrets.token_hex(3)}.{ext}")
    path = dest_dir / fname
    with open(path, "wb") as out:
        out.write(data)

    url_path = f"/uploads/dctest/{sn}/{report_id}/test_files/{test_type}/{item_index}/{round_index}/{handgun}/{fname}"
    
    file_data = {
        "filename": fname,
        "originalName": file.filename,
        "size": len(data),
        "url": url_path,
        "ext": ext,
        "uploadedAt": datetime.now(timezone.utc),
    }

    field_path = f"test_files.{test_type}.{item_index}.{round_index}.{handgun}"
    await coll.update_one(
        {"_id": oid},
        {
            "$set": {
                field_path: file_data,
                "updatedAt": datetime.now(timezone.utc)
            }
        }
    )

    return {
        "ok": True,
        "file": file_data,
        "test_type": test_type,
        "item_index": item_index,
        "round_index": round_index,
        "handgun": handgun,
    }


@router.delete("/dctestreport/{report_id}/test-files")
async def dc_testreport_delete_test_file(
    report_id: str,
    sn: str = Query(...),
    test_type: str = Query(...),
    item_index: int = Query(...),
    round_index: int = Query(...),
    handgun: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ลบไฟล์เอกสารสำหรับการทดสอบ
    """
    # Auth

    # Validate
    if handgun not in ("h1", "h2"):
        raise HTTPException(status_code=400, detail="handgun must be 'h1' or 'h2'")
    
    if test_type not in ("electrical", "charger"):
        raise HTTPException(status_code=400, detail="test_type must be 'electrical' or 'charger'")

    # Get report
    coll = get_dc_testreport_collection_for(sn)
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    # Get current file info to delete from disk
    doc = await coll.find_one({"_id": oid}, {f"test_files.{test_type}.{item_index}.{round_index}.{handgun}": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    # Try to delete file from disk
    try:
        file_info = doc.get("test_files", {}).get(test_type, {}).get(str(item_index), {}).get(str(round_index), {}).get(handgun)
        if file_info and file_info.get("url"):
            file_path = pathlib.Path(UPLOADS_ROOT) / file_info["url"].lstrip("/uploads/")
            if file_path.exists():
                file_path.unlink()
    except Exception as e:
        print(f"Warning: Could not delete file from disk: {e}")

    # Remove from document
    field_path = f"test_files.{test_type}.{item_index}.{round_index}.{handgun}"
    await coll.update_one(
        {"_id": oid},
        {
            "$unset": {field_path: ""},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )

    return {"ok": True}

class DCSubmitIn(BaseModel):
    sn: str
    chargerNo: Optional[str] = None
    document_name: Optional[str] = None
    issue_id: Optional[str] = None 
    job: Dict[str, Any]          # โครงสร้างตามฟอร์ม (issue_id, found_date, ... )
    head: Dict[str,Any]
    inspection_date: Optional[str] = None  # "YYYY-MM-DD" หรือ ISO; ถ้าไม่ส่งมาจะ fallback เป็น job.found_date
    equipment: Optional[EquipmentBlock] = None
    electrical_safety: Dict[str, Any] = Field(default_factory=dict)
    charger_safety: Dict[str, Any] = Field(default_factory=dict)
    remarks: Dict[str, Any] = Field(default_factory=dict)
    phaseSequence: Optional[str] = None 
    test_files: Optional[Dict[str, Any]] = None

async def _ensure_dc_indexes(coll):
    try:
        await coll.create_index([("createdAt", -1), ("_id", -1)])
        # ถ้าอยากกันซ้ำเลขใบงานในแต่ละสถานี: เปิด unique issue_id ก็ได้ (ถ้าแน่ใจว่า unique)
    except Exception:
        pass


async def _next_dc_issue_id(db, sn: str, chargerNo: str, d: date, pad: int = 2) -> str:
    """Generate next DC issue_id using atomic sequence"""
    yymm = f"{d.year % 100:02d}{d.month:02d}"
    seq = await db.dc_sequences.find_one_and_update(
        {"sn": sn, "chargerNo": chargerNo, "yymm": yymm},  # ★ เพิ่ม chargerNo
        {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"DC-CG{chargerNo}-{yymm}-{int(seq['n']):0{pad}d}"  # ★ ใช้ chargerNo


async def _next_dc_year_seq(db, sn: str, chargerNo: str, d: date) -> int:
    """Generate next DC year sequence for doc_name"""
    year = d.year
    seq = await db.dc_year_sequences.find_one_and_update(
        {"sn": sn, "chargerNo": chargerNo, "year": year},  # ★ เพิ่ม chargerNo
        {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return int(seq["n"])

@router.get("/dcreport/next-ids")
async def dcreport_next_ids(
    sn: str = Query(...),
    chargerNo: str = Query(...),
    inspection_date: str = Query(None),
):
    _validate_station_id(sn)
    
    if not chargerNo:
        raise HTTPException(status_code=400, detail="chargerNo is required")
    
    coll = get_dc_testreport_collection_for(sn)
    
    # กำหนด date
    if inspection_date:
        dc_date = normalize_pm_date(inspection_date)
    else:
        dc_date = datetime.now(th_tz).date().isoformat()
    
    try:
        d = datetime.strptime(dc_date, "%Y-%m-%d").date()
    except ValueError:
        d = datetime.now(th_tz).date()
    
    yymm = f"{d.year % 100:02d}{d.month:02d}"
    year = d.year
    
    # ★★★ FIXED: นับจาก documents จริงใน collection ★★★
    
    # 1. หา issue_id ล่าสุดที่มีอยู่จริง
    prefix_pattern = f"^DC-CG{chargerNo}-{yymm}-"
    existing_issues = await coll.find(
        {"issue_id": {"$regex": prefix_pattern}},
        {"issue_id": 1}
    ).to_list(length=1000)
    
    # หาเลขสูงสุด
    max_issue_seq = 0
    for doc in existing_issues:
        match = re.match(rf"^DC-CG{chargerNo}-{yymm}-(\d+)$", doc.get("issue_id", ""))
        if match:
            max_issue_seq = max(max_issue_seq, int(match.group(1)))
    
    next_issue_seq = max_issue_seq + 1
    preview_issue_id = f"DC-CG{chargerNo}-{yymm}-{next_issue_seq:02d}"
    
    # 2. หา document_name ล่าสุดที่มีอยู่จริง
    doc_prefix_pattern = f"^DC-CG{chargerNo}-\\d+/{year}$"
    existing_docs = await coll.find(
        {"document_name": {"$regex": doc_prefix_pattern}},
        {"document_name": 1}
    ).to_list(length=1000)
    
    # หาเลขสูงสุด
    max_doc_seq = 0
    for doc in existing_docs:
        match = re.match(rf"^DC-CG{chargerNo}-(\d+)/{year}$", doc.get("document_name", ""))
        if match:
            max_doc_seq = max(max_doc_seq, int(match.group(1)))
    
    next_doc_seq = max_doc_seq + 1
    preview_doc_name = f"DC-CG{chargerNo}-{next_doc_seq:02d}/{year}"
    
    return {
        "issue_id": preview_issue_id,
        "document_name": preview_doc_name,
        "inspection_date": dc_date,
        "is_preview": True,
    }

@router.post("/dcreport/submit")
async def dcreport_submit(body: DCSubmitIn, current: UserClaims = Depends(get_current_user)):
    sn = body.sn.strip()
    chargerNo = (body.chargerNo or "").strip()
    
    if not chargerNo:
        raise HTTPException(status_code=400, detail="chargerNo is required")

    coll = get_dc_testreport_collection_for(sn)
    await _ensure_dc_indexes(coll)

    # กำหนด dc_date
    dc_date_src = body.inspection_date or body.head.get("inspection_date")
    if dc_date_src:
        dc_date = normalize_pm_date(dc_date_src)
    else:
        dc_date = datetime.now(th_tz).date().isoformat()

    try:
        d = datetime.strptime(dc_date, "%Y-%m-%d").date()
    except ValueError:
        d = datetime.now(th_tz).date()

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    year = d.year

    # ★★★ FIXED: นับจาก documents จริงใน collection ★★★
    
    # 1. หา issue_id ถัดไปจาก documents จริง
    prefix_pattern = f"^DC-CG{chargerNo}-{yymm}-"
    existing_issues = await coll.find(
        {"issue_id": {"$regex": prefix_pattern}},
        {"issue_id": 1}
    ).to_list(length=1000)
    
    max_issue_seq = 0
    for doc in existing_issues:
        match = re.match(rf"^DC-CG{chargerNo}-{yymm}-(\d+)$", doc.get("issue_id", ""))
        if match:
            max_issue_seq = max(max_issue_seq, int(match.group(1)))
    
    issue_id = f"DC-CG{chargerNo}-{yymm}-{max_issue_seq + 1:02d}"
    
    # 2. หา document_name ถัดไปจาก documents จริง
    doc_prefix_pattern = f"^DC-CG{chargerNo}-\\d+/{year}$"
    existing_docs = await coll.find(
        {"document_name": {"$regex": doc_prefix_pattern}},
        {"document_name": 1}
    ).to_list(length=1000)
    
    max_doc_seq = 0
    for doc in existing_docs:
        match = re.match(rf"^DC-CG{chargerNo}-(\d+)/{year}$", doc.get("document_name", ""))
        if match:
            max_doc_seq = max(max_doc_seq, int(match.group(1)))
    
    doc_name = f"DC-CG{chargerNo}-{max_doc_seq + 1:02d}/{year}"

    # ★★★ ตรวจสอบซ้ำอีกครั้ง (race condition protection) ★★★
    exists = await coll.find_one({"$or": [{"issue_id": issue_id}, {"document_name": doc_name}]})
    if exists:
        raise HTTPException(status_code=409, detail="Duplicate issue_id or document_name, please retry")

    # Normalize tick symbols
    electrical_safety = _normalize_tick_to_pass(body.electrical_safety or {})
    charger_safety = _normalize_tick_to_pass(body.charger_safety or {})
    
    doc = {
        "sn": sn,
        "chargerNo": chargerNo,
        "document_name": doc_name,
        "issue_id": issue_id,
        "inspector": (body.head or {}).get("inspector") or "",
        "inspection_date": dc_date,
        "head": body.head,
        "equipment": body.equipment.dict() if body.equipment else {"manufacturers": [], "models": [], "serialNumbers": []},
        "electrical_safety": electrical_safety,
        "charger_safety": charger_safety,
        "remarks": body.remarks or {},
        "phaseSequence": body.phaseSequence,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
        "photos": {},
        "test_files": body.test_files or {},
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id), 
        "issue_id": issue_id,
        "document_name": doc_name
    }

#---------------------------------------------------------------------- Test Report (AC)

