"""CM (Corrective Maintenance) Report routes"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from datetime import datetime, timezone, date
from bson.objectid import ObjectId
from pymongo import ReturnDocument
from typing import List, Dict, Any, Optional, Literal
import re, json, uuid, pathlib, secrets, os, shutil

from config import (
    normalize_pm_date, _ensure_utc_iso,
    CMReportDB, CMUrlDB, DCTestReportDB, DCUrlDB,
    station_collection, users_collection, charger_coll_async, users_coll_async,
    _validate_station_id_th, th_tz,
)
from services.maximo import create_sr as maximo_create_sr          # ← A) เพิ่ม
from services import cm_maximo                                     # interface IN01–IN09
import inspect                                                     # ← รองรับทั้ง sync/async

# ไฟล์แนบหน้า Open ของ CM — เอกสาร + รูปภาพ + วิดีโอตามรายการที่อนุญาต
# หมายเหตุ: /cmurl/upload-files ยังบังคับ pdf อย่างเดียวของมันเอง
ALLOWED_EXTS = {
    "pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "txt", "csv",
    "jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "bmp",
    "mp4", "mov", "mkv", "avi", "webm", "wmv",
}
MAX_FILE_MB = 20
MAX_CM_PHOTOS_PER_GROUP = 10
from deps import UserClaims, get_current_user
from brand_scope import brand_scope_of
from uploads_access import assert_station_access, assert_sn_access

router = APIRouter()

# ---------------------------------------------------------------------
def grant_station_to_assignees(usernames: list[str], station_id: str) -> int:
    """
    ช่างที่ถูก assign งาน CM ต้องเห็นสถานีนั้นในหน้า EV Station

    technician เห็นเฉพาะสถานีใน station_id ของตัวเอง — ตอน assign จึงต้องเติมสถานีเข้าไปให้
    $addToSet = เพิ่มอย่างเดียว ไม่ซ้ำ และไม่ถอนคืนตอนงานปิด (สิทธิ์สะสม)
    จำกัดที่ role technician เท่านั้น — role อื่นเห็นสถานีตามกติกาของตัวเองอยู่แล้ว ไม่ต้องยุ่ง
    """
    names = [u for u in (usernames or []) if isinstance(u, str) and u.strip()]
    if not names or not station_id:
        return 0
    res = users_collection.update_many(
        {"username": {"$in": names}, "role": "technician"},
        {"$addToSet": {"station_id": station_id}},
    )
    return res.modified_count


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

def _status_or_conditions(status: str) -> list[dict]:
    """เงื่อนไข match status — รองรับหลายค่าคั่นด้วย , (เช่น "in progress,wait for approve") เช็คทั้ง status และ job.status"""
    conds: list[dict] = []
    for w in (s.strip() for s in status.split(",")):
        if not w:
            continue
        rx = {"$regex": f"^{re.escape(w)}$", "$options": "i"}
        conds.append({"status": rx})
        conds.append({"job.status": rx})
        if w.lower() in {"wait for approve", "wo - wait for approve"}:
            wo_rx = {"$regex": r"^WO\s*-\s*wait\s+for\s+approve$", "$options": "i"}
            conds.append({"repair_result": wo_rx})
            conds.append({"job.repair_result": wo_rx})
    return conds


def _assignee_scope(current: UserClaims) -> dict:
    """
    ช่างเห็นได้เฉพาะใบที่ถูก assign ให้ตัวเองตอน planner วางแผน — ใบของคนอื่นไม่มีสิทธิ์เห็น
    role อื่นเห็นตามปกติ. คืน filter เปล่าถ้าไม่ต้องจำกัด
    """
    if (current.role or "").lower() != "technician":
        return {}
    # username ว่าง = ระบุตัวไม่ได้ → ไม่ให้เห็นอะไรเลย ปลอดภัยกว่าเห็นหมด
    username = (current.username or "").strip() or "__no_assignee__"
    # รองรับทั้ง schema ปัจจุบัน (assignees) และข้อมูลเก่า/ข้อมูลที่ถูกเก็บใน job
    # โดยยังคงบังคับให้ match ผู้รับผิดชอบคนนี้เท่านั้น
    return {
        "$or": [
            {"assignees": username},
            {"job.assignees": username},
            {"assignee": username},
            {"job.assignee": username},
        ]
    }


# ==================== BRAND SCOPE (บริษัทผู้ดูแล ↔ ยี่ห้อตู้ชาร์จ) ====================
# EDS ดูแลเฉพาะตู้ FlexxFast → พนักงาน EDS เห็นเฉพาะใบงานของตู้ยี่ห้อนี้
# EGAT (และบริษัทอื่น) เห็นทุกใบ | admin/owner เห็นทุกใบเสมอ ไม่ว่าสังกัดไหน
#
# กติกา company → brand อยู่ที่ brand_scope.py ที่เดียว — ที่นี่มีแค่ส่วนที่เป็นของ CM
# โดยเฉพาะ คือกฎ "ใบที่ไม่ระบุตู้" ซึ่งเข้มกว่าการดูตู้ทั่วไป
# filter ที่ไม่มีทางแมตช์เอกสารไหน — ใช้ตอนพิสูจน์ยี่ห้อไม่ได้ (ไม่มีข้อมูลตู้)
_MATCH_NOTHING: dict = {"_id": {"$in": []}}




def _charger_keys(doc: dict) -> set[str]:
    """ค่า faulty_equipment ที่หมายถึงตู้นี้ — ใบงานเก่าเก็บได้หลายรูปแบบ"""
    keys = set()
    for v in (doc.get("chargerNo"), doc.get("charger_id"), doc.get("charger_no")):
        if v not in (None, ""):
            keys.add(f"charger_{v}")
    return keys


# ==================== ตัวตนของตู้ชาร์จบนใบงาน CM ====================
# ใบงานอ้างถึงตู้ได้ 2 ทาง — auto CM เก็บ charger_sn ตรง ๆ ส่วนใบที่คนเปิดเก็บเป็น
# faulty_equipment = "charger_<เลขตู้>" (ใบรุ่นใหม่ใช้ failure class ระดับสถานี จึงไม่ระบุตู้)
# ผู้ใช้ต้องเห็น "ชื่อตู้ / เลขตู้ / ยี่ห้อ(บริษัทที่ถือครอง)" บนใบงาน จึง resolve ที่ backend
# ที่เดียว แทนที่จะให้ทุกหน้าจอไปยิง /chargers เอง

_EMPTY_CHARGER_INDEX: dict = {"by_key": {}, "station_brand": "", "brands": []}


async def _charger_index_for_station(station_id: str) -> dict:
    """
    ดัชนีตู้ของสถานี — คืน {"by_key": {...}, "station_brand": str, "brands": [...]}

    by_key มีทั้งคีย์ "charger_<เลข/ไอดี>" และ "sn:<serial ตัวพิมพ์เล็ก>"
    station_brand = ยี่ห้อของทั้งสถานี ใช้กับใบที่ไม่ระบุตู้ (failure class ระดับสถานี)
    และมีค่าเฉพาะตอนทุกตู้เป็นยี่ห้อเดียวกัน — เกณฑ์เดียวกับ _brand_clause_for_station
    """
    try:
        charger_docs = await charger_coll_async.find(
            {"station_id": station_id},
            {
                "chargerNo": 1, "charger_no": 1, "charger_id": 1, "chargeBoxID": 1, "charger_name": 1,
                "SN": 1, "sn": 1, "brand": 1, "model": 1,
            },
        ).sort("chargerNo", 1).to_list(length=1_000)
    except Exception:
        # ข้อมูลตู้เป็นส่วนเสริม — อ่านไม่ได้ก็ยังต้องคืนใบงานได้ตามปกติ
        return dict(_EMPTY_CHARGER_INDEX)

    by_key: dict[str, dict] = {}
    brands: list[str] = []
    for index, charger in enumerate(charger_docs):
        number = charger.get("chargerNo") or charger.get("charger_no")
        charger_id = charger.get("charger_id")
        name = str(charger.get("charger_name") or f"Charger {number or index + 1}").strip()
        sn = str(charger.get("SN") or charger.get("sn") or "").strip()
        brand = str(charger.get("brand") or "").strip()
        info = {
            "chargeBoxID": str(charger.get("chargeBoxID") or "").strip(),
            "charger_name": name,
            "charger_no": number if number not in (None, "") else None,
            "charger_sn": sn,
            "charger_brand": brand,
            "charger_model": str(charger.get("model") or "").strip(),
            "label": f"{name} ({sn})" if sn else name,
        }
        if brand and brand not in brands:
            brands.append(brand)
        for key in (number, charger_id):
            if key not in (None, ""):
                by_key[f"charger_{str(key).strip().lower()}"] = info
        if sn:
            by_key[f"sn:{sn.lower()}"] = info

    return {
        "by_key": by_key,
        "station_brand": brands[0] if len(brands) == 1 else "",
        "brands": brands,
    }


def _charger_identity(
    index: dict,
    faulty_equipment: str,
    charger_sn: str,
    charger_no=None,
    fallback: dict | None = None,
) -> dict:
    """ชื่อ/เลข/ยี่ห้อของตู้บนใบงานหนึ่งใบ — คีย์ SN มาก่อนเพราะแม่นกว่าเลขตู้"""
    by_key = index.get("by_key") or {}
    sn = (charger_sn or "").strip()
    no = str(charger_no or "").strip()
    info = (by_key.get(f"sn:{sn.lower()}") if sn else None) \
        or (by_key.get(f"charger_{no.lower()}") if no else None) \
        or by_key.get(str(faulty_equipment or "").strip().lower()) \
        or (fallback or {}) \
        or {}
    return {
        "chargeBoxID": info.get("chargeBoxID", ""),
        "charger_name": info.get("charger_name", ""),
        "charger_no": info.get("charger_no"),
        "charger_sn": info.get("charger_sn") or sn,
        "charger_model": info.get("charger_model", ""),
        # ใบที่ไม่ระบุตู้ → ใช้ยี่ห้อของทั้งสถานี (มีค่าเฉพาะสถานียี่ห้อเดียว)
        "charger_brand": info.get("charger_brand") or index.get("station_brand") or "",
        "charger_label": info.get("label", ""),
    }
async def _charger_clause_for_sn(station_id: str, sn: str) -> dict | None:
    """
    เงื่อนไขกรองใบงานให้เหลือเฉพาะตู้ที่เลือก — None = ไม่กรอง (เข้าหน้าแบบระดับสถานี)

    เข้าหน้า CM ผ่านการ์ดตู้ชาร์จ → ส่ง sn มาด้วย จะเห็นเฉพาะใบของตู้นั้น
    เข้าผ่าน CM Dashboard / ระดับสถานี → ไม่ส่ง sn จะเห็นทุกใบของสถานี

    ใบใหม่เก็บ charger_sn ตรง ๆ แต่ใบเก่าเก็บแค่ charger_no หรือ
    faulty_equipment=charger_N — เลย resolve เลขตู้จาก SN มาช่วย match ด้วย
    ไม่งั้นใบเก่าของตู้เดียวกันจะหายไปจากมุมมองรายตู้
    """
    sn = (sn or "").strip()
    if not sn:
        return None

    rx = {"$regex": f"^{re.escape(sn)}$", "$options": "i"}
    clauses: list[dict] = [{"charger_sn": rx}, {"job.charger_sn": rx}]

    charger = await charger_coll_async.find_one(
        {"station_id": station_id, "$or": [{"SN": rx}, {"sn": rx}]},
        {"chargerNo": 1, "charger_id": 1, "charger_no": 1},
    )
    keys = sorted(_charger_keys(charger)) if charger else []
    if keys:
        numbers: list = []
        for k in keys:
            n = k.removeprefix("charger_")
            numbers.append(n)
            if n.isdigit():
                numbers.append(int(n))  # ใบเก่าบางใบเก็บ charger_no เป็นตัวเลข
        clauses.extend([
            {"faulty_equipment": {"$in": keys}},
            {"job.faulty_equipment": {"$in": keys}},
            {"charger_no": {"$in": numbers}},
            {"job.charger_no": {"$in": numbers}},
        ])
    return {"$or": clauses}


async def _brand_clause_for_station(station_id: str, current: UserClaims) -> dict | None:
    """
    เงื่อนไขกรองใบงานของสถานีนี้ตามยี่ห้อตู้ — None = ไม่ต้องกรอง

    • ใบที่ระบุตู้ (faulty_equipment = charger_N) → ดูยี่ห้อของตู้นั้นตรง ๆ
    • ใบที่ไม่ระบุตู้ (failure code ระดับสถานี เช่น DCCHARGER) → เห็นเฉพาะสถานี
      ที่ตู้ทุกตู้เป็นยี่ห้อนั้น เพราะพิสูจน์ไม่ได้ว่าใบนี้เป็นของตู้ไหน
    """
    # CM rule: EDS เห็นเฉพาะ FlexxFast ทุก role ยกเว้น super_admin
    # ใช้ lower-case เทียบทั้งสองฝั่งเพื่อไม่ผูกกับรูปแบบตัวพิมพ์ใน user/charger data
    if getattr(current, "is_super_admin", False):
        brand = None
    elif (current.company or "").strip().lower() == "eds":
        brand = "flexxfast"
    elif (current.company or "").strip().lower() == "egat":
        # EGAT can load every brand; the selected Company/Brand filters are
        # applied afterward by the CM Dashboard and CM List.
        brand = None
    else:
        brand = brand_scope_of(current)
    if not brand:
        return None

    direct_brand_clauses = [
        {"charger_brand": {"$regex": f"^{re.escape(brand)}$", "$options": "i"}},
        {"job.charger_brand": {"$regex": f"^{re.escape(brand)}$", "$options": "i"}},
    ]

    chargers = await charger_coll_async.find(
        {"station_id": station_id},
        {"brand": 1, "chargerNo": 1, "charger_id": 1, "charger_no": 1, "SN": 1, "sn": 1},
    ).to_list(length=1000)
    if not chargers:
        return {"$or": direct_brand_clauses}
        return _MATCH_NOTHING  # ไม่มีข้อมูลตู้ = พิสูจน์ยี่ห้อไม่ได้

    in_brand = [c for c in chargers if str(c.get("brand") or "").strip().lower() == brand]
    if not in_brand:
        return {"$or": direct_brand_clauses}
        return _MATCH_NOTHING
    if len(in_brand) == len(chargers):
        return None  # ทั้งสถานีเป็นยี่ห้อนี้ → เห็นได้ทุกใบ

    keys = sorted({k for c in in_brand for k in _charger_keys(c)})
    sns = sorted({str(c.get("SN") or c.get("sn") or "").strip().lower() for c in in_brand
                  if str(c.get("SN") or c.get("sn") or "").strip()})
    if not keys and not sns:
        return _MATCH_NOTHING
    # รองรับทั้งใบเก่าที่ใช้ faulty_equipment=charger_N และใบใหม่ที่เก็บ
    # failure class เดิมไว้ พร้อม charger_no/charger_sn เพื่อแยกใบตามตู้
    clauses = list(direct_brand_clauses)
    if keys:
        clauses.extend([
            {"faulty_equipment": {"$in": keys}},
            {"job.faulty_equipment": {"$in": keys}},
            {"charger_no": {"$in": [k.removeprefix("charger_") for k in keys]}},
            {"job.charger_no": {"$in": [k.removeprefix("charger_") for k in keys]}},
        ])
    if sns:
        clauses.extend([
            {"charger_sn": {"$in": sns}},
            {"job.charger_sn": {"$in": sns}},
        ])
    return {"$or": clauses}


async def _assert_can_open_cm(
    station_id: str,
    faulty_equipment: str,
    current: UserClaims,
    charger_no: str | None = None,
    charger_sn: str = "",
) -> None:
    """
    เปิดใบงานได้เฉพาะตู้ยี่ห้อที่บริษัทตัวเองดูแล

    ใช้เกณฑ์เดียวกับการมองเห็น — ไม่งั้นจะเปิดใบที่ตัวเองมองไม่เห็นทันทีหลังกดบันทึก
    """
    clause = await _brand_clause_for_station(station_id, current)
    if clause is None:
        return  # ไม่ถูกจำกัด หรือทั้งสถานีเป็นยี่ห้อที่ดูแลอยู่
    allowed_keys = set()
    allowed_numbers = set()
    allowed_sns = set()
    if clause is not _MATCH_NOTHING:
        for part in clause.get("$or") or []:
            if "faulty_equipment" in part:
                allowed_keys.update(part["faulty_equipment"].get("$in") or [])
            if "charger_no" in part:
                allowed_numbers.update(str(v).strip().lower() for v in part["charger_no"].get("$in") or [])
            if "charger_sn" in part:
                allowed_sns.update(str(v).strip().lower() for v in part["charger_sn"].get("$in") or [])
    selected_key = f"charger_{str(charger_no).strip()}".lower() if charger_no not in (None, "") else ""
    if (
        (faulty_equipment or "").strip() in allowed_keys
        or selected_key in allowed_keys
        or str(charger_no or "").strip().lower() in allowed_numbers
        or str(charger_sn or "").strip().lower() in allowed_sns
    ):
        return
    raise HTTPException(
        status_code=403,
        detail="เปิดใบงานได้เฉพาะตู้ยี่ห้อที่บริษัทของคุณดูแล (สถานีนี้ไม่ใช่)",
    )


def _merge_clause(mongo_filter: dict, clause: dict | None) -> dict:
    """รวมเงื่อนไขเพิ่มแบบไม่ชน $or ที่ filter หลักใช้อยู่ (status ใช้ $or)"""
    if clause:
        mongo_filter.setdefault("$and", []).append(clause)
    return mongo_filter


@router.get("/cmreport/list")
async def cmreport_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    sn: str | None = Query(None),
    current: UserClaims = Depends(get_current_user),
):
    coll = get_cmreport_collection_for(station_id)
    skip = (page - 1) * pageSize

    # Filter by status if provided
    mongo_filter: dict = {}
    if status and (conds := _status_or_conditions(status)):
        mongo_filter["$or"] = conds
    _merge_clause(mongo_filter, _assignee_scope(current))
    _merge_clause(mongo_filter, await _brand_clause_for_station(station_id, current))
    _merge_clause(mongo_filter, await _charger_clause_for_sn(station_id, sn or ""))

    cursor = coll.find(mongo_filter, {
        "_id": 1,
        "doc_name": 1,
        "issue_id": 1,
        "cm_date": 1,
        "found_date": 1,
        "found_time": 1,
        "status": 1,
        "stage": 1,
        "reject_remark": 1,
        "reported_by": 1,
        "inspector": 1,
        "approved_by": 1,
        "faulty_equipment": 1,
        "charger_no": 1,
        "charger_sn": 1,
        "severity": 1,
        "problem_details": 1,
        "location": 1,
        "job": 1,
        "assignees": 1,
        "sched_start": 1,
        "sched_finish": 1,
        "repair_result": 1,
        "repair_result_remark": 1,
        "maximo_ticket_id": 1,                                     # ← C) เพิ่ม
        "maximo_wonum": 1,
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
            "found_date": it.get("found_date") or job.get("found_date") or "",
            "found_time": it.get("found_time") or job.get("found_time") or "",
            "reported_by": it.get("reported_by") or job.get("reported_by") or "",
            "inspector": it.get("inspector") or job.get("inspector") or "",
            "approved_by": it.get("approved_by") or "",
            "status": it.get("status") or job.get("status") or "",
            "stage": it.get("stage") or job.get("stage") or "",
            "reject_remark": it.get("reject_remark") or "",
            "faulty_equipment": it.get("faulty_equipment") or job.get("faulty_equipment") or "",
            "charger_no": it.get("charger_no") or job.get("charger_no") or "",
            "charger_sn": it.get("charger_sn") or job.get("charger_sn") or "",
            "problem_details": it.get("problem_details") or job.get("problem_details") or "",
            "severity": it.get("severity") or job.get("severity") or "",
            "location": it.get("location") or job.get("location") or "",
            "assignees": it.get("assignees") or job.get("assignees") or [],
            "sched_start": it.get("sched_start") or job.get("sched_start") or "",
            "sched_finish": it.get("sched_finish") or job.get("sched_finish") or "",
            "repair_result": it.get("repair_result") or job.get("repair_result") or "",
            "repair_result_remark": it.get("repair_result_remark") or "",
            "maximo_ticket_id": it.get("maximo_ticket_id") or "",  # ← C) เพิ่ม
            "maximo_wonum": it.get("maximo_wonum") or "",
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": url_by_day.get(it.get("cm_date") or "", ""),
        })

    return {
        "items": items,
        "page": page,
        "pageSize": pageSize,
        "total": total
    }


async def _cm_items_for_station(station_id: str, station_name: str, status: str | None,
                                station_company: str = "",
                                scope: dict | None = None,
                                current: UserClaims | None = None) -> list[dict]:
    """ดึง CM report ของสถานีเดียว (merge กับ CMUrl ด้วย cm_date) + ใส่ station info"""
    coll = get_cmreport_collection_for(station_id)

    mongo_filter: dict = {}
    if status and (conds := _status_or_conditions(status)):
        mongo_filter["$or"] = conds
    if scope:
        _merge_clause(mongo_filter, scope)
    if current is not None:
        _merge_clause(mongo_filter, await _brand_clause_for_station(station_id, current))

    cursor = coll.find(mongo_filter, {
        "_id": 1, "doc_name": 1, "issue_id": 1, "cm_date": 1, "found_date": 1, "status": 1,
        "stage": 1, "reject_remark": 1,
        "reported_by": 1, "inspector": 1, "approved_by": 1, "faulty_equipment": 1, "severity": 1, "company": 1,
        "charger_no": 1, "charger_sn": 1,
        "chargeBoxID": 1, "chargebox_id": 1, "charger_name": 1,
        "charger_model": 1, "charger_brand": 1,
        "problem_details": 1, "location": 1, "job": 1, "repair_result": 1,
        # analyse CM dashboard : cause / correction (codes Maximo)
        "cause": 1, "problem_type": 1, "repaired_equipment": 1,
        "assignees": 1, "sched_start": 1, "sched_finish": 1,
        "repair_result_remark": 1, "maximo_ticket_id": 1, "maximo_wonum": 1, "createdAt": 1,
        # ตัวตนของตู้ + ที่มาของใบ (auto CM vs คนเปิด) — ใช้กรอง/แยกกลุ่มใน CM dashboard
        "charger_sn": 1, "auto_generated": 1, "auto_trigger": 1,
    }).sort([("createdAt", -1), ("_id", -1)])
    items_raw = await cursor.to_list(length=10_000)

    # ใบงานรุ่นเก่าเก็บ faulty_equipment เป็น charger_1 / charger_<id>
    # จึงแนบ label + ชื่อ/เลข/ยี่ห้อของตู้ไว้ให้ dashboard แสดงผล โดยไม่เปลี่ยนค่า raw เดิม
    charger_index = await _charger_index_for_station(station_id)

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

    def resolve_cm_date(it: dict, job: dict) -> str | None:
        # เอกสารจาก /cmreport/submit เก็บวันที่ใน found_date (ไม่มี cm_date) —
        # fallback: cm_date → found_date → วันที่จาก createdAt (เขตเวลาไทย)
        for v in (it.get("cm_date"), it.get("found_date"), job.get("cm_date"), job.get("found_date")):
            if isinstance(v, str) and re.match(r"^\d{4}-\d{2}-\d{2}", v):
                return v[:10]
        created = it.get("createdAt")
        if isinstance(created, datetime):
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            return created.astimezone(th_tz).date().isoformat()
        return None

    def as_list(*candidates) -> list[str]:
        """Champs multi-valeurs (cause / problem_type / repaired_equipment) —
        les fiches anciennes les stockent parfois en chaîne simple."""
        for v in candidates:
            if isinstance(v, list):
                vals = [str(x).strip() for x in v if str(x or "").strip()]
                if vals:
                    return vals
            elif isinstance(v, str) and v.strip():
                return [v.strip()]
        return []

    out = []
    for it in items_raw:
        job = it.get("job", {})
        faulty_equipment = it.get("faulty_equipment") or job.get("faulty_equipment") or ""
        charger = _charger_identity(
            charger_index,
            faulty_equipment,
            it.get("charger_sn") or job.get("charger_sn") or "",
            it.get("charger_no") or job.get("charger_no") or "",
            fallback={
                "chargeBoxID": it.get("chargeBoxID") or it.get("chargebox_id") or job.get("chargeBoxID") or job.get("chargebox_id") or "",
                "charger_name": it.get("charger_name") or job.get("charger_name") or "",
                "charger_no": it.get("charger_no") or job.get("charger_no"),
                "charger_sn": it.get("charger_sn") or job.get("charger_sn") or "",
                "charger_model": it.get("charger_model") or job.get("charger_model") or "",
                "charger_brand": it.get("charger_brand") or job.get("charger_brand") or "",
                "label": it.get("charger_name") or job.get("charger_name") or "",
            },
        )
        out.append({
            "id": str(it["_id"]),
            "station_id": station_id,
            "station_name": station_name,
            "company": str(it.get("company") or job.get("company") or station_company).strip(),
            "doc_name": it.get("doc_name") or "",
            "issue_id": it.get("issue_id") or job.get("issue_id") or "",
            "cm_date": resolve_cm_date(it, job),
            "reported_by": it.get("reported_by") or job.get("reported_by") or "",
            "inspector": it.get("inspector") or job.get("inspector") or "",
            "approved_by": it.get("approved_by") or "",
            "status": it.get("status") or job.get("status") or "",
            "stage": it.get("stage") or "",
            "reject_remark": it.get("reject_remark") or "",
            "faulty_equipment": faulty_equipment,
            "faulty_equipment_label": charger["charger_label"],
            # ตัวตนของตู้ที่ใบงานนี้อ้างถึง — ชื่อ / เลขตู้ / S/N / ยี่ห้อ (บริษัทที่ถือครอง)
            "chargeBoxID": charger["chargeBoxID"],
            "charger_name": charger["charger_name"],
            "charger_no": charger["charger_no"],
            "charger_sn": charger["charger_sn"],
            "charger_model": charger["charger_model"],
            "charger_brand": charger["charger_brand"],
            # ใบที่ระบบเปิดเองจาก fault/alarm — แยกจากใบที่ผู้ใช้กรอกเอง
            "auto_generated": bool(it.get("auto_generated")),
            "auto_trigger": it.get("auto_trigger") or "",
            # codes Maximo exploités par le CM dashboard (cause / remedy)
            "cause": as_list(it.get("cause"), job.get("cause")),
            "problem_type": as_list(it.get("problem_type"), job.get("problem_type")),
            "repaired_equipment": as_list(it.get("repaired_equipment"), job.get("repaired_equipment")),
            "problem_details": it.get("problem_details") or job.get("problem_details") or "",
            "severity": it.get("severity") or job.get("severity") or "",
            "location": it.get("location") or job.get("location") or "",
            "assignees": it.get("assignees") or job.get("assignees") or [],
            "sched_start": it.get("sched_start") or job.get("sched_start") or "",
            "sched_finish": it.get("sched_finish") or job.get("sched_finish") or "",
            "repair_result": it.get("repair_result") or job.get("repair_result") or "",
            "repair_result_remark": it.get("repair_result_remark") or "",
            "maximo_ticket_id": it.get("maximo_ticket_id") or "",
            "maximo_wonum": it.get("maximo_wonum") or "",
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
                station_query, {"_id": 0, "station_id": 1, "station_name": 1, "company": 1, "user_id": 1, "username": 1}
            )),
        )
    except Exception:
        stations = []

    if not stations:
        return {"items": [], "total": 0, "stations_count": 0}

    # Company ของ CM คือ company ของ owner ที่ผูกกับสถานี ไม่ใช่ brand ของ charger
    # รองรับทั้งข้อมูลสถานีรุ่นใหม่ที่เก็บ company ตรง ๆ และข้อมูลเดิมที่อ้าง owner user
    try:
        owner_ids = [s.get("user_id") for s in stations if isinstance(s.get("user_id"), ObjectId)]
        owner_names = [str(s.get("username") or "").strip() for s in stations if s.get("username")]
        owner_query = []
        if owner_ids:
            owner_query.append({"_id": {"$in": owner_ids}})
        if owner_names:
            owner_query.append({"username": {"$in": owner_names}})
        owner_docs = await users_coll_async.find(
            {"$or": owner_query} if owner_query else {"_id": None},
            {"_id": 1, "username": 1, "company": 1},
        ).to_list(length=10_000)
    except Exception:
        owner_docs = []

    company_by_id = {str(u.get("_id")): str(u.get("company") or "").strip() for u in owner_docs}
    company_by_name = {str(u.get("username") or "").strip().lower(): str(u.get("company") or "").strip() for u in owner_docs}
    for station in stations:
        station["company"] = (
            str(station.get("company") or "").strip()
            or company_by_id.get(str(station.get("user_id")), "")
            or company_by_name.get(str(station.get("username") or "").strip().lower(), "")
        )

    scope = _assignee_scope(current)
    tasks = [
        _cm_items_for_station(s["station_id"], s.get("station_name", "-"), status, s.get("company", ""), scope, current)
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


async def _assert_can_edit_cm(coll, oid, station_id: str, current: UserClaims) -> dict:
    """
    สิทธิ์แก้ข้อมูลใบงาน (ใช้ร่วมกับ PATCH /status):
    admin/owner/planner แก้ได้ตามด่านของตัวเอง — cs แก้ได้เฉพาะใบที่ตัวเองเปิดและยังอยู่ด่าน cs
    (เคสถูก planner ตีกลับมาให้แก้)
    """
    doc = await coll.find_one(
        {"_id": oid, "station_id": station_id},
        {"reported_by": 1, "status": 1, "stage": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if (current.role or "").lower() != "cs":
        return doc

    cur_status = str(doc.get("status") or "").strip().lower()
    cur_stage = str(doc.get("stage") or "").strip().lower()
    at_cs_stage = cur_status == "open" or (cur_status == "wait for approve" and cur_stage == "cs_approval")
    is_reporter = (doc.get("reported_by") or "").strip().lower() == (current.username or "").strip().lower()
    if not (is_reporter and at_cs_stage):
        raise HTTPException(status_code=403, detail="CS can only edit their own work order while it is awaiting review")
    return doc


class CMDraftIn(BaseModel):
    station_id: str
    draft_data: Dict[str, Any]


@router.post("/cmreport/{report_id}/draft")
async def cmreport_save_draft(
    report_id: str,
    body: CMDraftIn,
    current: UserClaims = Depends(get_current_user),
):
    """เก็บ draft ของฟอร์มซ่อม เพื่อให้รูป/ข้อมูลชุดที่เพิ่มกลับมาหลัง refresh"""
    station_id = body.station_id.strip()
    assert_station_access(current, station_id)
    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    await _assert_can_edit_cm(coll, oid, station_id, current)
    now = datetime.now(timezone.utc)
    result = await coll.update_one(
        {"_id": oid, "station_id": station_id},
        {"$set": {
            "cm_draft": body.draft_data,
            "cm_draft_saved_at": now,
            "cm_draft_saved_by": current.username,
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True, "savedAt": now.isoformat()}


@router.get("/cmreport/{report_id}/draft")
async def cmreport_load_draft(
    report_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    station_id = station_id.strip()
    assert_station_access(current, station_id)
    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    await _assert_can_edit_cm(coll, oid, station_id, current)
    doc = await coll.find_one(
        {"_id": oid, "station_id": station_id},
        {"cm_draft": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    draft = doc.get("cm_draft")
    return {"ok": True, "draft": draft, "hasDraft": isinstance(draft, dict) and bool(draft)}


@router.delete("/cmreport/{report_id}/draft")
async def cmreport_delete_draft(
    report_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    station_id = station_id.strip()
    assert_station_access(current, station_id)
    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    await _assert_can_edit_cm(coll, oid, station_id, current)
    result = await coll.update_one(
        {"_id": oid, "station_id": station_id},
        {"$unset": {"cm_draft": "", "cm_draft_saved_at": "", "cm_draft_saved_by": ""}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}

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
    # ตรวจสิทธิ์สถานีก่อนแตะข้อมูล — เดิมเช็คแค่ว่า field ตรงกับ document
    # ซึ่งผู้เรียกคุมได้ทั้งคู่ จึงยิงข้ามสถานีได้
    assert_station_access(current, station_id)
    
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

    doc = await coll.find_one(
        {"_id": oid},
        {"_id": 1, "station_id": 1, photo_field: 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    existing_groups = doc.get(photo_field) or {}
    existing_photos = existing_groups.get(group) if isinstance(existing_groups, dict) else []
    existing_count = len(existing_photos) if isinstance(existing_photos, list) else 0
    if existing_count + len(files) > MAX_CM_PHOTOS_PER_GROUP:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_CM_PHOTOS_PER_GROUP} photos per group",
        )

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

    # Re-check atomically so concurrent uploads cannot push a group beyond the limit.
    result = await coll.update_one(
        {
            "_id": oid,
            "station_id": station_id,
            "$expr": {
                "$lte": [
                    {
                        "$add": [
                            {"$size": {"$ifNull": [f"${photo_field}.{group}", []]}},
                            len(saved),
                        ]
                    },
                    MAX_CM_PHOTOS_PER_GROUP,
                ]
            },
        },
        {"$push": {f"{photo_field}.{group}": {"$each": saved}}}
    )
    if result.matched_count == 0:
        for item in saved:
            try:
                (dest_dir / item["filename"]).unlink(missing_ok=True)
            except OSError:
                pass
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_CM_PHOTOS_PER_GROUP} photos per group",
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


@router.delete("/cmreport/{report_id}/photos")
async def cmreport_delete_photo(
    report_id: str,
    station_id: str = Query(...),
    group: str = Query(...),
    url: str = Query(..., description="url ของรูปที่จะลบ (ค่าเดียวกับที่เก็บใน photos_{phase})"),
    phase: str = Query("problem"),
    current: UserClaims = Depends(get_current_user),
):
    """ลบรูปทีละใบออกจากใบงาน — ใช้ตอนแก้ไขใบที่ถูกตีกลับ (รูปเดิมผิดต้องเปลี่ยน)"""
    assert_station_access(current, station_id)

    if phase not in ("problem", "repair"):
        raise HTTPException(status_code=400, detail="phase must be 'problem' or 'repair'")
    if not re.fullmatch(r"[a-z][a-z0-9_]*", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    await _assert_can_edit_cm(coll, oid, station_id, current)

    photo_field = f"photos_{phase}"
    res = await coll.update_one(
        {"_id": oid, "station_id": station_id},
        {"$pull": {f"{photo_field}.{group}": {"url": url}},
         "$set": {"updatedAt": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    # ลบไฟล์จริงด้วย — จำกัดให้อยู่ใต้โฟลเดอร์ของใบงานนี้เท่านั้น กัน path traversal จาก url ที่ส่งมา
    try:
        base = (pathlib.Path(UPLOADS_ROOT) / "cm" / station_id / report_id).resolve()
        rel = url.split(f"/uploads/cm/{station_id}/{report_id}/", 1)
        if len(rel) == 2:
            target = (base / rel[1]).resolve()
            if target.is_file() and target.is_relative_to(base):
                target.unlink()
    except Exception as e:
        import logging
        logging.getLogger("cmreport").warning(f"delete photo file failed: {e}")

    return {"ok": True}


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
    # ตรวจสิทธิ์สถานีก่อนแตะข้อมูล — เดิมเช็คแค่ว่า field ตรงกับ document
    # ซึ่งผู้เรียกคุมได้ทั้งคู่ จึงยิงข้ามสถานีได้
    assert_station_access(current, station_id)
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
    sn: str | None = Query(None),
):
    coll = get_cmurl_coll_upload(station_id)
    skip = (page - 1) * pageSize

    mongo_filter: dict = {}
    if status and (conds := _status_or_conditions(status)):
        mongo_filter["$or"] = conds
    # PDF ที่อัปโหลดเป็นเอกสารระดับสถานี ไม่มี charger_sn → มุมมองรายตู้จะไม่เห็น
    _merge_clause(mongo_filter, await _charger_clause_for_sn(station_id, sn or ""))

    projection = {
        "_id": 1, 
        "doc_name": 1,
        "issue_id": 1,
        "cm_date": 1, 
        "reportDate": 1,
        "urls": 1, 
        "createdAt": 1,
        "status": 1, 
        "stage": 1,
        "repair_result": 1,
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
            "stage": it.get("stage") or (it.get("job") or {}).get("stage") or "",
            "repair_result": it.get("repair_result") or (it.get("job") or {}).get("repair_result") or "",
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
    found_time: str = ""  # เวลาแจ้ง (HH:MM)
    faulty_equipment: str = ""
    severity: str = ""
    problem_details: str = ""
    remarks_open: str = ""
    location: str = ""
    reported_by: Optional[str] = None
    reporter_signature: str = ""  # ลายเซ็นผู้แจ้ง (dataURL PNG)
    # ใบที่เลือก failure class ระดับ Charger จะถูกสร้างแยกต่อหนึ่งตู้
    charger_no: Optional[str] = None
    charger_sn: str = ""


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
    await _assert_can_open_cm(station_id, body.faulty_equipment, current, body.charger_no, body.charger_sn)

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
        "found_time": (body.found_time or "").strip() or datetime.now(th_tz).strftime("%H:%M"),
        "location": body.location,
        "reported_by": body.reported_by or current.username,
        # flat fields
        "faulty_equipment": body.faulty_equipment,
        "charger_no": body.charger_no,
        "charger_sn": (body.charger_sn or "").strip(),
        "severity": body.severity,
        "problem_details": body.problem_details,
        "remarks_open": body.remarks_open,
        "reporter_signature": body.reporter_signature,
        # cs เปิดใบงาน → รอ head cs อนุมัติ; ใช้ชื่อ "Wait for approve" ร่วมกับด่านปิดงาน
        # แยกกันด้วย stage: "cs_approval" (ด่าน cs head) vs "close_approval" (ด่านช่างซ่อมเสร็จ)
        "status": "Wait for approve",
        "stage": "cs_approval",
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
        if body.charger_no or body.charger_sn or (body.faulty_equipment and body.faulty_equipment.startswith("charger_")):
            from config import client as mongo_client
            charger_col = mongo_client["iMPS"]["charger"]
            # ใบใหม่ส่ง charger_no/SN แยกมา ส่วนใบเก่ายังรองรับ charger_1
            charger_no_str = str(body.charger_no or body.faulty_equipment.replace("charger_", "")).strip()
            charger_query = {"station_id": station_id}
            charger_or = []
            if charger_no_str:
                if charger_no_str.isdigit():
                    charger_or.append({"chargerNo": int(charger_no_str)})
                charger_or.extend([{"charger_no": charger_no_str}, {"charger_id": charger_no_str}])
            if body.charger_sn.strip():
                charger_or.extend([{"SN": body.charger_sn.strip()}, {"sn": body.charger_sn.strip()}])
            if charger_or:
                charger_query["$or"] = charger_or
            charger_doc = await charger_col.find_one(charger_query)
            if charger_doc:
                charger_maximo = charger_doc.get("maximo_location", "")

        # 3) ใช้ charger > station (เหมือน auto watcher)
        maximo_loc = charger_maximo or station_maximo

        print(f"[DEBUG-PATCH-V2] maximo_loc={maximo_loc}")

        if maximo_loc:
            print(f"[DEBUG-V3] calling maximo_create_sr, type={type(maximo_create_sr)}, is_coroutine={inspect.iscoroutinefunction(maximo_create_sr)}")
            charger_label = body.charger_no or body.charger_sn or body.faulty_equipment
            desc = f"[iMPS CM] {station_name} / {charger_label} / {body.problem_details}"
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


@router.delete("/cmreport/{report_id}/rollback")
async def cmreport_rollback_new(
    report_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """ลบใบ CM ที่เพิ่งสร้างไว้ชั่วคราว เมื่อไฟล์แนบหรือการบันทึกขั้นถัดไปล้มเหลว"""
    station_id = station_id.strip()
    assert_station_access(current, station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    coll = get_cmreport_collection_for(station_id)
    doc = await coll.find_one({"_id": oid, "station_id": station_id})
    if not doc:
        return {"ok": True, "deleted": False}

    role_lower = (current.role or "").lower()
    is_owner = (doc.get("reported_by") or "").strip().lower() == (current.username or "").strip().lower()
    if role_lower not in {"admin", "planner"} and not current.is_super_admin and not is_owner:
        raise HTTPException(status_code=403, detail="Only the creator can rollback this report")

    status = str(doc.get("status") or "").strip().lower()
    stage = str(doc.get("stage") or "").strip().lower()
    if status != "wait for approve" or stage != "cs_approval":
        raise HTTPException(status_code=409, detail="Report is no longer in the initial save state")

    result = await coll.delete_one({"_id": oid, "station_id": station_id})
    if result.deleted_count:
        report_dir = (pathlib.Path(UPLOADS_ROOT) / "cm" / station_id / report_id).resolve()
        uploads_root = pathlib.Path(UPLOADS_ROOT).resolve()
        if report_dir.is_relative_to(uploads_root):
            shutil.rmtree(report_dir, ignore_errors=True)
    return {"ok": True, "deleted": bool(result.deleted_count)}

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

    # กันช่างเปิดใบของคนอื่นด้วยการยิง URL ตรง — ต้องกรองใน query ไม่ใช่แค่ซ่อนในตาราง
    # (รวมถึงใบของตู้ยี่ห้อที่บริษัทตัวเองไม่ได้ดูแล)
    detail_filter: dict = {"_id": oid, "station_id": station_id}
    _merge_clause(detail_filter, _assignee_scope(current))
    _merge_clause(detail_filter, await _brand_clause_for_station(station_id, current))
    doc = await coll.find_one(detail_filter)
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    nested_job = doc.get("job") if isinstance(doc.get("job"), dict) else {}

    # ตัวตนของตู้ที่ใบงานนี้อ้างถึง — ฟอร์ม CM ต้องโชว์ ชื่อตู้ / เลขตู้ / บริษัทที่ถือครอง
    charger = _charger_identity(
        await _charger_index_for_station(station_id),
        doc.get("faulty_equipment") or nested_job.get("faulty_equipment") or "",
        doc.get("charger_sn") or nested_job.get("charger_sn") or "",
        doc.get("charger_no") or nested_job.get("charger_no") or "",
        fallback={
            "chargeBoxID": doc.get("chargeBoxID") or doc.get("chargebox_id") or nested_job.get("chargeBoxID") or nested_job.get("chargebox_id") or "",
            "charger_name": doc.get("charger_name") or nested_job.get("charger_name") or "",
            "charger_no": doc.get("charger_no") or nested_job.get("charger_no"),
            "charger_sn": doc.get("charger_sn") or nested_job.get("charger_sn") or "",
            "charger_model": doc.get("charger_model") or nested_job.get("charger_model") or "",
            "charger_brand": doc.get("charger_brand") or nested_job.get("charger_brand") or "",
            "label": doc.get("charger_name") or nested_job.get("charger_name") or "",
        },
    )

    return {
        "id": str(doc["_id"]),
        "station_id": doc.get("station_id"),
        "charger_name": charger["charger_name"],
        "chargeBoxID": charger["chargeBoxID"],
        "charger_no": charger["charger_no"],
        "charger_sn": charger["charger_sn"],
        "charger_model": charger["charger_model"],
        "charger_brand": charger["charger_brand"],
        "auto_generated": bool(doc.get("auto_generated")),
        "auto_trigger": doc.get("auto_trigger") or "",
        "doc_name": doc.get("doc_name") or "",
        "issue_id": doc.get("issue_id") or "",
        "found_date": doc.get("found_date"),
        "found_time": doc.get("found_time") or "",
        "cm_date": doc.get("cm_date") or doc.get("found_date") or "",
        "reported_by": doc.get("reported_by") or "",
        # รองรับข้อมูลเก่าที่เก็บ status/stage ไว้ใน job
        "status": doc.get("status") or nested_job.get("status") or "",
        "stage": doc.get("stage") or nested_job.get("stage") or "",
        "maximo_ticket_id": doc.get("maximo_ticket_id") or "",     # ← D) เพิ่ม
        # เลขใบสั่งงาน Maximo (IN01) — ได้มาตอน planner วางแผน
        "maximo_wonum": doc.get("maximo_wonum") or "",
        "maximo_location": doc.get("maximo_location") or "",
        
        # flat fields จาก Open
        "faulty_equipment": doc.get("faulty_equipment") or "",
        "charger_no": doc.get("charger_no") or nested_job.get("charger_no") or "",
        "charger_sn": doc.get("charger_sn") or nested_job.get("charger_sn") or "",
        "severity": doc.get("severity") or "",
        "problem_details": doc.get("problem_details") or "",
        "remarks_open": doc.get("remarks_open") or "",
        "location": doc.get("location") or "",

        # flat fields จาก Planning
        "sched_start": doc.get("sched_start") or "",
        "sched_finish": doc.get("sched_finish") or "",
        "assignees": doc.get("assignees") or nested_job.get("assignees") or [],
        # วันที่/เวลาที่ planner วางแผน (ประทับตอนเปิดฟอร์มเข้ามาวางแผน) — แสดงอย่างเดียว แก้ไม่ได้
        "planned_date": doc.get("planned_date") or "",
        "planned_time": doc.get("planned_time") or "",
        # ประวัติแผนรอบก่อน ๆ — ใบที่ติดรออะไหล่/รอหน้างานแล้ววางแผนใหม่ จะเก็บรอบเดิมไว้ที่นี่
        # flat fields ด้านบนคือ "แผนรอบล่าสุด" เสมอ (list/filter ยังอ่านจากตรงนั้นเหมือนเดิม)
        "plan_history": doc.get("plan_history") or [],
        # ประวัติผลซ่อมรอบก่อน ๆ — ช่างบันทึกเป็นสถานะรอ (material/site) แล้วกลับมาซ่อมใหม่
        # flat fields ของ InProgress ด้านล่างคือ "รอบที่กำลังทำอยู่" (ว่างระหว่างรอ)
        "repair_history": doc.get("repair_history") or nested_job.get("repair_history") or [],

        # flat fields จาก InProgress
        "inspector": doc.get("inspector") or "",
        "approved_by": doc.get("approved_by") or "",
        "cause": doc.get("cause") or nested_job.get("cause") or "",
        "problem_type": doc.get("problem_type") or nested_job.get("problem_type") or "",
        "problem_type_other": doc.get("problem_type_other") or "",
        "repair_result": doc.get("repair_result") or "",
        "corrective_actions": doc.get("corrective_actions") or nested_job.get("corrective_actions") or [],
        "preventive_action": doc.get("preventive_action") or [],
        "repaired_equipment": doc.get("repaired_equipment") or nested_job.get("repaired_equipment") or [],
        "inprogress_remarks": doc.get("inprogress_remarks") or "",
        "repair_result_remark": doc.get("repair_result_remark") or "",
        "resolved_date": doc.get("resolved_date") or "",
        "start_repair_date": doc.get("start_repair_date") or "",
        "signature": doc.get("signature") or "",
        "reporter_signature": doc.get("reporter_signature") or "",
        "start_repair_time": doc.get("start_repair_time") or "",
        "resolved_time": doc.get("resolved_time") or "",

        # เหตุผลที่ถูกตีกลับ — ช่างต้องเห็นว่าต้องแก้อะไร
        "reject_remark": doc.get("reject_remark") or "",
        "rejected_by": doc.get("rejected_by") or "",
        # เหตุผลที่ยกเลิก — แสดงในหน้ารายละเอียดใบงาน Cancelled
        "cancel_remark": doc.get("cancel_remark") or "",
        "cancelled_by": doc.get("cancelled_by") or "",

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
    status: Literal[
        "Open", "In Progress", "Pending", "Wait for approve",
        "Wait for schedule", "Complete", "Closed", "Cancelled",
    ]
    job: Optional[Dict[str, Any]] = None
    inspector: Optional[str] = None

# "Complete" คงไว้เพื่ออ่านข้อมูลเก่า — งานปิดใหม่ใช้ "Closed"
ALLOWED_STATUS: set[str] = {
    "Open", "In Progress", "Pending", "Wait for approve",
    "Wait for schedule", "Complete", "Closed", "Cancelled",
}

# ระหว่างรออนุมัติ ผลหลังซ่อมค้างเป็น WO placeholder ("WO - wait for approve")
# พอ planner อนุมัติปิดงานต้องกลายเป็น "แก้ไขสำเร็จ" ซึ่งเป็นค่าที่ฟอร์มใบงานปิดใช้จริง
# ค่าที่ช่างระบุชัดเจนแล้ว (แก้ไขไม่สำเร็จ / ไม่พบปัญหา) ให้คงไว้ ไม่ทับ
CM_CLOSED_REPAIR_RESULT = "แก้ไขสำเร็จ"
CM_PENDING_REPAIR_RESULTS: list[str] = ["", "WO - wait for approve"]

@router.patch("/cmreport/{report_id}/status")
async def cmreport_update_status(
    report_id: str,
    body: CMStatusUpdateIn,
    current: UserClaims = Depends(get_current_user),
):
    role_lower = (current.role or "").lower()

    station_id = body.station_id.strip()
    if body.status not in ALLOWED_STATUS:
        raise HTTPException(status_code=400, detail="Invalid status")


    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    # cs เปิดใบงานเป็นหลัก — แก้ได้เฉพาะใบที่ตัวเองเปิดและยังอยู่ด่าน cs
    # (เคส planner ตีกลับมาให้แก้ ถ้าห้ามทั้งหมด ใบจะค้างไม่มีใครแก้ได้)
    if role_lower == "cs":
        cur_doc = await _assert_can_edit_cm(coll, oid, station_id, current)
        # cs เลื่อนสถานะเองไม่ได้ — บังคับคงสถานะ/ด่านเดิมไว้เสมอ (แก้ข้อมูลอย่างเดียว)
        body.status = cur_doc.get("status") or "Wait for approve"
        if body.job is not None:
            body.job.pop("status", None)
            body.job["stage"] = cur_doc.get("stage") or "cs_approval"

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
            "sched_start", "sched_finish", "assignees",
            "planned_date", "planned_time", "plan_history", "repair_history",
            "resolved_date", "repair_result", "preventive_action", 
            "remarks", "remarks_open",
            "faulty_equipment",
            "charger_no", "charger_sn",
            "repaired_equipment",
            "inprogress_remarks",
            "cause", "problem_type_other","repair_result_remark","start_repair_date",
            "signature", "start_repair_time", "resolved_time", "reporter_signature",
            "stage", "reject_remark",
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

    # PATCH /status ใช้โดยฟอร์มซ่อม — ถ้าใบขึ้นเป็น "Wait for approve" จากด่านนี้ = ด่านปิดงาน
    # ปั๊ม stage ให้อัตโนมัติเพื่อแยกจากด่าน cs (คงค่าที่ส่งมาโดยตรงถ้ามี)
    if str(updates.get("status", "")).strip().lower() == "wait for approve" and "stage" not in updates:
        updates["stage"] = "close_approval"

    # ปิดงานตรงจากฟอร์มซ่อม (planner กรอกผลเอง = ไม่ต้องรออนุมัติ)
    # — สิทธิ์และการประทับผู้อนุมัติต้องเหมือนเส้นทาง POST /approve
    if str(updates.get("status", "")).strip().lower() == "closed":
        if (current.role or "").lower() not in CM_APPROVE_ROLES:
            raise HTTPException(status_code=403, detail="Only planner or admin can close")
        now = datetime.now(timezone.utc)
        updates.setdefault("approved_by", current.username)
        updates.setdefault("approved_at", now)

        # ปิดงานแล้วผลหลังซ่อมต้องเป็นค่าจริง ไม่ใช่ WO placeholder ที่ใช้ตอนรออนุมัติ
        repair_result = updates.get("repair_result")
        if repair_result is None:
            cur_doc = await coll.find_one(
                {"_id": oid, "station_id": station_id}, {"repair_result": 1}
            )
            repair_result = (cur_doc or {}).get("repair_result")
        if str(repair_result or "").strip() in CM_PENDING_REPAIR_RESULTS:
            updates["repair_result"] = CM_CLOSED_REPAIR_RESULT

    updates["updatedAt"] = datetime.now(timezone.utc)

    # ใบของตู้ยี่ห้อที่บริษัทตัวเองไม่ได้ดูแล = มองไม่เห็น จึงต้องแก้ไม่ได้ด้วย (กันยิง API ตรง)
    update_filter: dict = {"_id": oid, "station_id": station_id}
    _merge_clause(update_filter, await _brand_clause_for_station(station_id, current))
    res = await coll.update_one(update_filter, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    # ทำหลังอัปเดตสำเร็จเท่านั้น — จะได้ไม่แจกสิทธิ์ให้ใบงานที่บันทึกไม่ผ่าน
    if updates.get("assignees"):
        grant_station_to_assignees(updates["assignees"], station_id)

    # ── ส่งต่อให้ Maximo (IN01 เปิด WO ตอนวางแผน / IN02 สถานะ / IN05+IN09 ตอนปิดงาน) ──
    # อ่านใบงานหลังบันทึกเพื่อให้ข้อมูลที่ส่งไปตรงกับที่เก็บจริง
    fresh = await coll.find_one({"_id": oid}) or {}
    maximo_result = await cm_maximo.safe_sync_report(
        coll, oid, fresh, memo=f"iMPS {fresh.get('issue_id') or ''} — {updates['status']}"
    )

    return {"ok": True, "status": updates["status"], "maximo": maximo_result}


# ── ขั้นตอน Approve ตาม flow CM: ซ่อมเสร็จ → "Wait for approve" → planner/admin อนุมัติ → "Closed"
CM_APPROVE_ROLES: set[str] = {"admin", "planner"}


@router.post("/cmreport/{report_id}/approve")
async def cmreport_approve(
    report_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    if (current.role or "").lower() not in CM_APPROVE_ROLES:
        raise HTTPException(status_code=403, detail="Only planner or admin can approve")

    station_id = station_id.strip()
    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    now = datetime.now(timezone.utc)
    approve_filter: dict = {
            "_id": oid,
            "station_id": station_id,
            # รองรับทั้งข้อมูลใหม่ที่เก็บ status แบบ flat และข้อมูลเก่าที่อยู่ใน job
            "$or": [
                {"status": {"$regex": "^wait for approve$", "$options": "i"}},
                {"job.status": {"$regex": "^wait for approve$", "$options": "i"}},
            ],
            # เฉพาะด่านปิดงาน (close_approval / ข้อมูลเก่าที่ไม่มี stage)
            # — กันเผลอปิดใบที่รอ head CS อนุมัติ
            "$nor": [
                {"stage": {"$regex": "^cs_approval$", "$options": "i"}},
                {"job.stage": {"$regex": "^cs_approval$", "$options": "i"}},
            ],
    }
    # planner ของบริษัทที่ไม่ได้ดูแลยี่ห้อนี้ อนุมัติปิดใบไม่ได้ (มองไม่เห็นใบตั้งแต่แรก)
    _merge_clause(approve_filter, await _brand_clause_for_station(station_id, current))
    res = await coll.update_one(
        approve_filter,
        # ใช้ pipeline update เพราะต้องอ่านค่า repair_result เดิมมาตัดสินใจแบบ atomic
        [{"$set": {
            "status": "Closed",
            # อนุมัติแล้ว = แก้ไขสำเร็จ (คงค่าที่ช่างระบุเองไว้ เช่น "แก้ไขไม่สำเร็จ" / "ไม่พบปัญหา")
            "repair_result": {
                "$cond": [
                    {"$in": [{"$ifNull": ["$repair_result", ""]}, CM_PENDING_REPAIR_RESULTS]},
                    CM_CLOSED_REPAIR_RESULT,
                    "$repair_result",
                ]
            },
            "approved_by": {"$literal": current.username},
            "approved_at": now,
            "updatedAt": now,
        }}],
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found or not in 'Wait for approve' status")

    # ปิดงานแล้ว → ส่งสถานะ (IN02) + ผลวิเคราะห์ (IN05) + เวลาช่าง (IN09) เข้า Maximo
    fresh = await coll.find_one({"_id": oid}) or {}
    maximo_result = await cm_maximo.safe_sync_report(
        coll, oid, fresh, memo=f"closed by {current.username}"
    )

    return {"ok": True, "status": "Closed", "maximo": maximo_result}


class CMRejectIn(BaseModel):
    remark: str = Field(..., min_length=1, description="เหตุผลที่ตีกลับ — ช่างต้องรู้ว่าต้องแก้อะไร")


@router.post("/cmreport/{report_id}/reject")
async def cmreport_reject(
    report_id: str,
    body: CMRejectIn,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """ตีกลับใบงานจากช่าง → In Progress เพื่อให้ planner วางแผน/มอบหมายใหม่"""
    if (current.role or "").lower() not in CM_APPROVE_ROLES:
        raise HTTPException(status_code=403, detail="Only planner or admin can reject")

    remark = body.remark.strip()
    if not remark:
        raise HTTPException(status_code=400, detail="remark is required")

    station_id = station_id.strip()
    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    now = datetime.now(timezone.utc)
    res = await coll.update_one(
        {
            "_id": oid,
            "station_id": station_id,
            "$or": [
                {
                    "status": {"$regex": "^wait for approve$", "$options": "i"},
                    # เฉพาะด่านปิดงาน — ด่าน cs ใช้ /planner-reject แทน
                    "stage": {"$ne": "cs_approval"},
                },
                {
                    # รองรับข้อมูลเก่าที่สถานะหลักยังเป็น In Progress แต่ใช้ marker รออนุมัติ
                    "status": {"$regex": "^in progress$", "$options": "i"},
                    "repair_result": {"$regex": "^WO - wait for approve$", "$options": "i"},
                    "stage": {"$ne": "cs_approval"},
                },
            ],
        },
        {
            "$set": {
                "status": "In Progress",
                "repair_result": "WO - wait for scheduled",
                "repair_result_remark": "",
                # ตีกลับให้ technician คนเดิมแก้ไขต่อ จึงต้องคงผู้รับผิดชอบและกำหนดการเดิมไว้
                "reject_remark": remark,
                "rejected_by": current.username,
                "rejected_at": now,
                "updatedAt": now,
            },
            "$unset": {
                "stage": "",
            },
        },
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found or not awaiting technician approval")

    return {"ok": True, "status": "In Progress"}


# ── ขั้นตอนตาม flow: cs เปิดใบงาน (Wait for approve/cs_approval) → planner อนุมัติ SR
#    → "Wait for schedule" ให้ planner วางแผนต่อ (ยกเลิก cs head — planner อนุมัติเอง)
CS_APPROVE_ROLES: set[str] = {"admin", "planner"}


class CMApproveIn(BaseModel):
    remark: str = ""  # ความคิดเห็นตอนอนุมัติ (ไม่บังคับ)


@router.post("/cmreport/{report_id}/cs-approve")
async def cmreport_cs_approve(
    report_id: str,
    body: CMApproveIn | None = None,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """planner อนุมัติ SR ที่ cs เพิ่งเปิด → เดินหน้าเป็น 'Wait for schedule'"""
    if (current.role or "").lower() not in CS_APPROVE_ROLES:
        raise HTTPException(status_code=403, detail="Only planner or admin can approve")

    approve_remark = (body.remark.strip() if body and body.remark else "")
    station_id = station_id.strip()
    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    now = datetime.now(timezone.utc)
    res = await coll.update_one(
        {
            "_id": oid,
            "station_id": station_id,
            # รองรับใบใหม่ (Wait for approve + stage cs_approval) และใบเก่า/auto ที่เป็น Open
            "$or": [
                {"status": {"$regex": "^open$", "$options": "i"}},
                {
                    "status": {"$regex": "^wait for approve$", "$options": "i"},
                    "stage": "cs_approval",
                },
            ],
        },
        {
            "$set": {
                "status": "Wait for schedule",
                "cs_approved_by": current.username,
                "cs_approved_at": now,
                "cs_approve_remark": approve_remark,
                "updatedAt": now,
            },
            # เคลียร์ stage และเหตุผลตีกลับด่าน cs (ถ้าเคยถูกตีกลับ) — กันค้างไปโผล่ในฟอร์มขั้นถัดไป
            "$unset": {"stage": "", "reject_remark": "", "rejected_by": "", "rejected_at": ""},
        },
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found or not awaiting CS approval")

    return {"ok": True, "status": "Wait for schedule"}


# ── planner ตีกลับใบงานขั้นวางแผน (Wait for schedule) → กลับไปหา cs (Wait for approve/cs_approval)
PLANNER_REJECT_ROLES: set[str] = {"admin", "planner"}


@router.post("/cmreport/{report_id}/planner-reject")
async def cmreport_planner_reject(
    report_id: str,
    body: CMRejectIn,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """planner ตีกลับใบขั้นวางแผน → กลับไปหา cs ให้แก้ไข/ยกเลิก (พร้อมเหตุผล)"""
    if (current.role or "").lower() not in PLANNER_REJECT_ROLES:
        raise HTTPException(status_code=403, detail="Only planner or admin can reject")

    remark = body.remark.strip()
    if not remark:
        raise HTTPException(status_code=400, detail="remark is required")

    station_id = station_id.strip()
    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    now = datetime.now(timezone.utc)
    res = await coll.update_one(
        {
            "_id": oid,
            "station_id": station_id,
            "status": {"$regex": "^wait for schedule$", "$options": "i"},
        },
        {"$set": {
            "status": "Wait for approve",
            "stage": "cs_approval",
            "reject_remark": remark,
            "rejected_by": current.username,
            "rejected_at": now,
            "updatedAt": now,
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found or not in 'Wait for schedule' status")

    return {"ok": True, "status": "Wait for approve"}


# ── head cs ตีกลับใบงานด่าน cs → คืนให้ cs ผู้เปิดแก้ไข (คงสถานะ Wait for approve/cs_approval) พร้อมเหตุผล
@router.post("/cmreport/{report_id}/cs-reject")
async def cmreport_cs_reject(
    report_id: str,
    body: CMRejectIn,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """planner ตีกลับ SR ที่ cs เปิดมา → คืนให้ cs แก้ไข (คงสถานะ Wait for approve) พร้อมเหตุผล"""
    if (current.role or "").lower() not in CS_APPROVE_ROLES:
        raise HTTPException(status_code=403, detail="Only planner or admin can reject")

    remark = body.remark.strip()
    if not remark:
        raise HTTPException(status_code=400, detail="remark is required")

    station_id = station_id.strip()
    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    now = datetime.now(timezone.utc)
    res = await coll.update_one(
        {
            "_id": oid,
            "station_id": station_id,
            "status": {"$regex": "^wait for approve$", "$options": "i"},
            "stage": "cs_approval",
        },
        {
            "$set": {
                # คงสถานะ Wait for approve/cs_approval — แค่แนบเหตุผลให้ cs ผู้เปิดเห็นแล้วแก้ไข
                "status": "Wait for approve",
                "stage": "cs_approval",
                "reject_remark": remark,
                "rejected_by": current.username,
                "rejected_at": now,
                "updatedAt": now,
            },
        },
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found or not awaiting CS approval")

    return {"ok": True, "status": "Wait for approve"}


# ── ยกเลิกใบงานที่ยังไม่ปิด → Cancelled (ไปแสดงใน tab Closed)
#    planner/admin ยกเลิกตอนรีวิว/วางแผนได้
PLANNER_CANCEL_ROLES: set[str] = {"admin", "owner", "planner"}
TECHNICIAN_CANCEL_ROLE = "technician"


class CMCancelIn(BaseModel):
    remark: str = Field("", description="เหตุผลที่ยกเลิกใบงาน (ถ้ามี)")


@router.post("/cmreport/{report_id}/cancel")
async def cmreport_cancel(
    report_id: str,
    body: CMCancelIn | None = None,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """ยกเลิกใบงานที่ยังไม่ปิด (ทุกสถานะยกเว้น complete/closed/cancelled) → Cancelled"""
    current_role = (current.role or "").strip().lower()
    if current_role not in PLANNER_CANCEL_ROLES and current_role != TECHNICIAN_CANCEL_ROLE:
        raise HTTPException(
            status_code=403,
            detail="Only planner, admin, or assigned technician can cancel",
        )

    station_id = station_id.strip()
    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    remark = (body.remark.strip() if body and body.remark else "")
    now = datetime.now(timezone.utc)
    cancel_filter = {
        "_id": oid,
        "station_id": station_id,
        # ยกเลิกได้เฉพาะใบที่ยังไม่ปิด/ยังไม่ถูกยกเลิก
        "status": {"$not": {"$regex": "^(complete|closed|cancelled)$", "$options": "i"}},
    }
    if current_role == TECHNICIAN_CANCEL_ROLE:
        _merge_clause(cancel_filter, _assignee_scope(current))

    res = await coll.update_one(
        cancel_filter,
        {"$set": {
            "status": "Cancelled",
            "cancel_remark": remark,
            "cancelled_by": current.username,
            "cancelled_at": now,
            "updatedAt": now,
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found or already closed/cancelled")

    # ยกเลิกใบที่เปิด WO ไว้แล้ว ต้องยกเลิกฝั่ง Maximo ตามไปด้วย (IN02 → CAN)
    fresh = await coll.find_one({"_id": oid}) or {}
    maximo_result = await cm_maximo.safe_sync_report(
        coll, oid, fresh, memo=remark or f"cancelled by {current.username}"
    )

    return {"ok": True, "status": "Cancelled", "maximo": maximo_result}


@router.delete("/cmreport/{report_id}")
async def cmreport_delete(
    report_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    # ลบถาวร = สิทธิ์ super admin เท่านั้น
    if not current.is_super_admin:
        raise HTTPException(status_code=403, detail="Not allowed to delete")

    station_id = station_id.strip()
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    # ลองลบจาก CM report ก่อน (จับคู่ station_id) → ถ้าไม่เจอลองแบบไม่ผูก station → สุดท้ายลองจาก cmurl (ไฟล์อัปโหลด)
    coll = get_cmreport_collection_for(station_id)
    res = await coll.delete_one({"_id": oid, "station_id": station_id})
    if res.deleted_count == 0:
        res = await coll.delete_one({"_id": oid})
    if res.deleted_count == 0:
        url_coll = get_cmurl_coll_upload(station_id)
        res = await url_coll.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    return {"ok": True}
