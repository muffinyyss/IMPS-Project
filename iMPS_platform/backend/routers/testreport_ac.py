"""AC Test Report routes"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Form, Path
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from datetime import datetime, timezone, date
from bson.objectid import ObjectId
from typing import List, Dict, Any, Optional, Literal
import re, json, uuid, pathlib, secrets

from config import normalize_pm_date, ACTestReportDB, ACUrlDB, station_collection, _validate_station_id, th_tz, _ensure_utc_iso
from deps import UserClaims, get_current_user
from routers.pm_helpers import (
    UPLOADS_ROOT, ALLOWED_DOC_EXTS, MAX_DOC_FILE_MB,
    ALLOWED_IMAGE_EXTS, MAX_IMAGE_FILE_MB,
    _safe_name, _ext, _key_for_index, _normalize_tick_to_pass,
    get_ac_testreport_collection_for, get_acurl_coll_upload,
)

router = APIRouter()

@router.get("/actestreport/list")
async def actestreport_list(
    sn: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    coll = get_ac_testreport_collection_for(sn)
    skip = (page - 1) * pageSize

    # ★★★ เพิ่ม issue_id และ document_name ใน projection ★★★
    cursor = coll.find({}, {
        "_id": 1, 
        "inspection_date": 1, 
        "createdAt": 1,
        "issue_id": 1,           # ★ เพิ่ม
        "document_name": 1,      # ★ เพิ่ม
        "head": 1,               # ★ เพิ่ม
    }).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)
    
    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    # --- ดึงไฟล์จาก ACUrlDB โดย map ด้วย inspection_date (string) ---
    ac_dates = [it.get("inspection_date") for it in items_raw if it.get("inspection_date")]
    urls_coll = get_acurl_coll_upload(sn)
    url_by_day: dict[str, str] = {}

    if ac_dates:
        ucur = urls_coll.find({"inspection_date": {"$in": ac_dates}}, {"inspection_date": 1, "urls": 1})
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

    ac_date_arr = [it.get("inspection_date") for it in items_raw if it.get("inspection_date")]
    return {"items": items, "inspection_date": ac_date_arr, "page": page, "pageSize": pageSize, "total": total}


# ★★★ เพิ่ม endpoint /acreport/next-ids ★★★
@router.get("/acreport/next-ids")
async def acreport_next_ids(
    sn: str = Query(...),  
    chargerNo: str = Query(...),
    inspection_date: str = Query(None),
):
    _validate_station_id(sn)
    
    if not chargerNo:
        raise HTTPException(status_code=400, detail="chargerNo is required")
    
    coll = get_ac_testreport_collection_for(sn)
    
    # กำหนด date
    if inspection_date:
        ac_date = normalize_pm_date(inspection_date)
    else:
        ac_date = datetime.now(th_tz).date().isoformat()
    
    try:
        d = datetime.strptime(ac_date, "%Y-%m-%d").date()
    except ValueError:
        d = datetime.now(th_tz).date()
    
    yymm = f"{d.year % 100:02d}{d.month:02d}"
    year = d.year
    
    # ★★★ นับจาก documents จริงใน collection ★★★
    
    # 1. หา issue_id ล่าสุดที่มีอยู่จริง
    prefix_pattern = f"^AC-CG{chargerNo}-{yymm}-"
    existing_issues = await coll.find(
        {"issue_id": {"$regex": prefix_pattern}},
        {"issue_id": 1}
    ).to_list(length=1000)
    
    # หาเลขสูงสุด
    max_issue_seq = 0
    for doc in existing_issues:
        match = re.match(rf"^AC-CG{chargerNo}-{yymm}-(\d+)$", doc.get("issue_id", ""))
        if match:
            max_issue_seq = max(max_issue_seq, int(match.group(1)))
    
    next_issue_seq = max_issue_seq + 1
    preview_issue_id = f"AC-CG{chargerNo}-{yymm}-{next_issue_seq:02d}"
    
    # 2. หา document_name ล่าสุดที่มีอยู่จริง
    doc_prefix_pattern = f"^AC-CG{chargerNo}-\\d+/{year}$"
    existing_docs = await coll.find(
        {"document_name": {"$regex": doc_prefix_pattern}},
        {"document_name": 1}
    ).to_list(length=1000)
    
    # หาเลขสูงสุด
    max_doc_seq = 0
    for doc in existing_docs:
        match = re.match(rf"^AC-CG{chargerNo}-(\d+)/{year}$", doc.get("document_name", ""))
        if match:
            max_doc_seq = max(max_doc_seq, int(match.group(1)))
    
    next_doc_seq = max_doc_seq + 1
    preview_doc_name = f"AC-CG{chargerNo}-{next_doc_seq:02d}/{year}"
    
    return {
        "issue_id": preview_issue_id,
        "document_name": preview_doc_name,
        "inspection_date": ac_date,
        "is_preview": True,
    }


class ACSubmitIn(BaseModel):
    sn: str
    chargerNo: Optional[str] = None
    document_name: Optional[str] = None
    issue_id: Optional[str] = None 
    head: Dict[str, Any]
    inspection_date: Optional[str] = None
    equipment: Optional[Any] = None  # EquipmentBlock
    electrical_safety: Dict[str, Any] = Field(default_factory=dict)
    charger_safety: Dict[str, Any] = Field(default_factory=dict)
    remarks: Dict[str, Any] = Field(default_factory=dict)
    symbol: Optional[str] = None
    phaseSequence: Optional[str] = None
    signature: Optional[Any] = None  # SignatureBlock
    test_files: Optional[Dict[str, Any]] = None  # ★★★ เพิ่มใหม่ ★★★

@router.post("/actestreport/{report_id}/test-files")
async def ac_testreport_upload_test_files(
    report_id: str,
    sn: str = Form(...),
    test_type: str = Form(...),          # "electrical" หรือ "charger"
    item_index: int = Form(...),         # index ของหัวข้อทดสอบ
    round_index: int = Form(...),        # รอบที่ (0, 1, 2)
    handgun: str = Form(...),            # "h1" (สำหรับ AC ใช้แค่ h1)
    file: UploadFile = File(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    อัปโหลดไฟล์เอกสารสำหรับการทดสอบ AC
    - test_type: "electrical" (ACTest1Grid) หรือ "charger" (ACTest2Grid)
    - item_index: index ของหัวข้อทดสอบ
    - round_index: รอบที่ทดสอบ (0, 1, 2)
    - handgun: "h1" (AC ใช้แค่ h1)
    """
    # Auth

    # Validate handgun (AC ใช้แค่ h1)
    if handgun not in ("h1",):
        raise HTTPException(status_code=400, detail="handgun must be 'h1' for AC")
    
    # Validate test_type
    if test_type not in ("electrical", "charger"):
        raise HTTPException(status_code=400, detail="test_type must be 'electrical' or 'charger'")

    # Get report
    coll = get_ac_testreport_collection_for(sn)
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
    # Structure: /uploads/actest/{sn}/{report_id}/test_files/{test_type}/{item_index}/{round_index}/{handgun}/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "actest" / sn / report_id / "test_files" / test_type / str(item_index) / str(round_index) / handgun
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Save file
    fname = _safe_name(file.filename or f"file_{secrets.token_hex(3)}.{ext}")
    path = dest_dir / fname
    with open(path, "wb") as out:
        out.write(data)

    url_path = f"/uploads/actest/{sn}/{report_id}/test_files/{test_type}/{item_index}/{round_index}/{handgun}/{fname}"
    
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

@router.delete("/actestreport/{report_id}/test-files")
async def ac_testreport_delete_test_file(
    report_id: str,
    sn: str = Query(...),
    test_type: str = Query(...),
    item_index: int = Query(...),
    round_index: int = Query(...),
    handgun: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ลบไฟล์เอกสารสำหรับการทดสอบ AC
    """
    # Auth

    # Validate
    if handgun not in ("h1",):
        raise HTTPException(status_code=400, detail="handgun must be 'h1' for AC")
    
    if test_type not in ("electrical", "charger"):
        raise HTTPException(status_code=400, detail="test_type must be 'electrical' or 'charger'")

    # Get report
    coll = get_ac_testreport_collection_for(sn)
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


async def _ensure_ac_indexes(coll):
    try:
        await coll.create_index([("createdAt", -1), ("_id", -1)])
    except Exception:
        pass
@router.post("/actestreport/{report_id}/photos")
async def ac_testreport_upload_photos(
    report_id: str,
    sn: str = Form(...),
    item_index: int = Form(...),
    files: list[UploadFile] = File(...),
    remark: str | None = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    # auth

    # รายงานต้องอยู่ในสถานีนี้
    coll = get_ac_testreport_collection_for(sn)
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

    # โฟลเดอร์ปลายทาง (ใช้ actest แทน dctest)
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "actest" / sn / report_id / key
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

        url_path = f"/uploads/actest/{sn}/{report_id}/{key}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc),
            "index": item_index,
        })

    # อัปเดตเอกสารรายงาน: push ลง photos.<key>
    await coll.update_one(
        {"_id": oid},
        {"$push": {f"photos.{key}": {"$each": saved}}, "$set": {"updatedAt": datetime.now(timezone.utc)}}
    )

    return {"ok": True, "count": len(saved), "key": key, "files": saved}


# ====== (Optional) เพิ่ม finalize endpoint สำหรับ AC ======
@router.post("/actestreport/{report_id}/finalize")
async def ac_testreport_finalize(
    report_id: str,
    sn: str = Form(...),
    current: UserClaims = Depends(get_current_user),
):

    coll = get_ac_testreport_collection_for(sn)
    from bson import ObjectId
    oid = ObjectId(report_id)
    res = await coll.update_one(
        {"_id": oid},
        {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}

@router.post("/acreport/submit")
async def acreport_submit(body: ACSubmitIn, current: UserClaims = Depends(get_current_user)):
    sn = body.sn.strip()
    chargerNo = (body.chargerNo or "").strip()
    
    if not chargerNo:
        raise HTTPException(status_code=400, detail="chargerNo is required")
    
    # Auth: admin ผ่านหมด, คนทั่วไปต้องมีสิทธิ์ใน station นี้

    coll = get_ac_testreport_collection_for(sn)
    await _ensure_ac_indexes(coll)

    # กำหนด ac_date
    ac_date_src = body.inspection_date or body.head.get("inspection_date")
    if ac_date_src:
        ac_date = normalize_pm_date(ac_date_src)
    else:
        ac_date = datetime.now(th_tz).date().isoformat()

    try:
        d = datetime.strptime(ac_date, "%Y-%m-%d").date()
    except ValueError:
        d = datetime.now(th_tz).date()

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    year = d.year

    # ★★★ Generate issue_id จาก documents จริง ★★★
    prefix_pattern = f"^AC-CG{chargerNo}-{yymm}-"
    existing_issues = await coll.find(
        {"issue_id": {"$regex": prefix_pattern}},
        {"issue_id": 1}
    ).to_list(length=1000)
    
    max_issue_seq = 0
    for doc in existing_issues:
        match = re.match(rf"^AC-CG{chargerNo}-{yymm}-(\d+)$", doc.get("issue_id", ""))
        if match:
            max_issue_seq = max(max_issue_seq, int(match.group(1)))
    
    issue_id = f"AC-CG{chargerNo}-{yymm}-{max_issue_seq + 1:02d}"
    
    # ★★★ Generate document_name จาก documents จริง ★★★
    doc_prefix_pattern = f"^AC-CG{chargerNo}-\\d+/{year}$"
    existing_docs = await coll.find(
        {"document_name": {"$regex": doc_prefix_pattern}},
        {"document_name": 1}
    ).to_list(length=1000)
    
    max_doc_seq = 0
    for doc in existing_docs:
        match = re.match(rf"^AC-CG{chargerNo}-(\d+)/{year}$", doc.get("document_name", ""))
        if match:
            max_doc_seq = max(max_doc_seq, int(match.group(1)))
    
    doc_name = f"AC-CG{chargerNo}-{max_doc_seq + 1:02d}/{year}"

    # ★★★ ตรวจสอบซ้ำ (race condition protection) ★★★
    exists = await coll.find_one({"$or": [{"issue_id": issue_id}, {"document_name": doc_name}]})
    if exists:
        raise HTTPException(status_code=409, detail="Duplicate issue_id or document_name, please retry")

    electrical_safety = _normalize_tick_to_pass(body.electrical_safety or {})
    charger_safety = _normalize_tick_to_pass(body.charger_safety or {})
    
    doc = {
        "sn": sn,
        "chargerNo": chargerNo,
        "document_name": doc_name,
        "issue_id": issue_id,
        "inspector": (body.head or {}).get("inspector") or "",
        "inspection_date": ac_date,
        "head": body.head,
        "equipment": body.equipment if body.equipment else {"manufacturers": [], "models": [], "serialNumbers": []},
        "electrical_safety": electrical_safety,
        "charger_safety": charger_safety,
        "remarks": body.remarks or {},
        "symbol": body.symbol,
        "phaseSequence": body.phaseSequence,
        "signature": body.signature.dict() if body.signature else None,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
        "photos": {},
        "test_files": body.test_files or {},  # ★★★ เพิ่มใหม่ ★★★
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id),
        "issue_id": issue_id,
        "document_name": doc_name
    }
