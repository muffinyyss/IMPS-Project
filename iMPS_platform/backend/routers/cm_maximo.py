"""
routers/cm_maximo.py
====================
endpoint ฝั่ง CM ที่คุยกับ Maximo ตามเอกสาร EGAT_IESB_Payload_Structure_v1

  GET  /cm-maximo/failure-codes   IN04  ตาราง failure → problem → cause → remedy
                                        (ฟอร์ม CM เอาไปทำ dropdown ต่อกัน)
  GET  /cm-maximo/labor           IN08  รายชื่อช่างสำหรับมอบหมายงาน
  GET  /cm-maximo/{id}/sync       -     ดูสถานะการ sync ของใบงาน 1 ใบ
  POST /cm-maximo/{id}/sync       -     ยิงซ้ำ (IN01/IN02/IN05/IN09) หลัง Maximo ล่ม
  POST /cm-maximo/{id}/attach     IN03  แนบลิงก์เอกสารเข้ากับ WO
  POST /maximo/cm/work-order      IN06  Maximo เปิดใบงาน CM เข้ามาที่ iMPS (ขาเข้า)
"""

import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from config import normalize_pm_date, station_collection, th_tz
from deps import UserClaims, get_current_user
from uploads_access import assert_station_access
from services import cm_maximo

log = logging.getLogger("cm_maximo_api")
router = APIRouter(tags=["cm-maximo"])

# secret ที่ Maximo ต้องแนบมาใน header X-Maximo-Token (ใช้ตัวเดียวกับฝั่ง PM)
MAXIMO_WEBHOOK_SECRET = os.getenv("MAXIMO_WEBHOOK_SECRET", "")


def _oid(report_id: str) -> ObjectId:
    try:
        return ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")


async def _load_report(
    station_id: str, report_id: str, current: UserClaims
) -> tuple[Any, ObjectId, dict]:
    """หาใบงาน CM + collection ของสถานีนั้น (ตรวจสิทธิ์สถานีก่อนแตะข้อมูล)"""
    from routers.cmreport import get_cmreport_collection_for

    assert_station_access(current, station_id)
    coll = get_cmreport_collection_for(station_id)
    oid = _oid(report_id)
    doc = await coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return coll, oid, doc


# ══════════════════════════════════════════════════════════════════
# IN04 — ตาราง failure code สำหรับ dropdown ในฟอร์ม CM
# ══════════════════════════════════════════════════════════════════
@router.get("/cm-maximo/failure-codes")
async def cm_failure_codes(
    refresh: bool = Query(False, description="ดึงจาก Maximo ใหม่แทนการอ่าน cache"),
    all_classes: bool = Query(
        False, alias="all",
        description="เอา failure class ทั้งระบบ ไม่กรองเฉพาะของงาน EV",
    ),
    current: UserClaims = Depends(get_current_user),
):
    """
    failure class → problem → cause → remedy ทั้งต้นไม้ — ฟอร์ม CM ใช้ทำ dropdown 4 ชั้น
    (อุปกรณ์ที่เสียหาย → ปัญหา → สาเหตุ → การแก้ไข)

    ปกติอ่านจาก cache ใน MongoDB (เร็วและทน Maximo ล่ม) — refresh=1 เมื่อ EGAT
    เพิ่งแก้ตารางฝั่ง Maximo
    """
    data = await cm_maximo.get_failure_codes(refresh=refresh)
    classes = data.get("classes", [])
    matrix = data.get("matrix", [])

    # Maximo มี failure class ของงานอื่นปนมาด้วย (METER, ACRASH, LORATEST …)
    # ฟอร์ม CM ต้องเห็นเฉพาะของงาน EV ไม่งั้น dropdown รกจนเลือกผิด
    if not all_classes and cm_maximo.CM_FAILURE_CLASSES:
        allowed = set(cm_maximo.CM_FAILURE_CLASSES)
        classes = [c for c in classes if (c.get("code") or "").upper() in allowed]
        matrix = [row for row in matrix if (row[0] or "").upper() in allowed]

    return {
        "classes": classes,
        "matrix": matrix,
        # บทบาทของแต่ละ class — หน้า open ใช้เลือกว่าสถานีนี้ควรเห็นตัวไหน
        "roles": cm_maximo.CM_CLASS_ROLES,
        "syncedAt": (
            data["syncedAt"].isoformat() if isinstance(data.get("syncedAt"), datetime) else None
        ),
        "stale": bool(data.get("stale")),
        "error": data.get("error"),
    }


# ══════════════════════════════════════════════════════════════════
# IN08 — รายชื่อช่าง
# ══════════════════════════════════════════════════════════════════
@router.get("/cm-maximo/labor")
async def cm_labor(
    refresh: bool = Query(False),
    current: UserClaims = Depends(get_current_user),
):
    """รายชื่อคนใน cost center EV ของ Maximo — ใช้จับคู่กับช่างที่มอบหมายในใบงาน"""
    people = await cm_maximo.get_labor(refresh=refresh)
    return {"items": people, "total": len(people)}


# ══════════════════════════════════════════════════════════════════
# สถานะการ sync ของใบงาน + ยิงซ้ำ
# ══════════════════════════════════════════════════════════════════
def _serialize_sync(doc: dict) -> dict:
    sync = doc.get("maximo_sync") or {}
    out = {}
    for key, entry in sync.items():
        if not isinstance(entry, dict):
            continue
        at = entry.get("at")
        out[key] = {
            **{k: v for k, v in entry.items() if k != "at"},
            "at": at.isoformat() if isinstance(at, datetime) else None,
        }
    return out


@router.get("/cm-maximo/{report_id}/sync")
async def cm_sync_status(
    report_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """ดูว่าใบงานนี้ยิงอะไรเข้า Maximo ไปแล้วบ้าง — ใช้แสดงในฟอร์มและตอน debug"""
    _, _, doc = await _load_report(station_id, report_id, current)
    return {
        "issue_id": doc.get("issue_id") or "",
        "maximo_wonum": doc.get("maximo_wonum") or "",
        "maximo_ticket_id": doc.get("maximo_ticket_id") or "",
        "maximo_location": doc.get("maximo_location") or "",
        "interfaces": _serialize_sync(doc),
    }


# ยิงซ้ำได้เฉพาะคนที่คุมใบงาน — ช่างทั่วไปไม่ต้องยุ่งกับ integration
CM_SYNC_ROLES: set[str] = {"admin", "owner", "engineer"}


@router.post("/cm-maximo/{report_id}/sync")
async def cm_sync_retry(
    report_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """ยิงทุก interface ที่ถึงจังหวะของใบงานนี้ใหม่ (ใช้เมื่อรอบก่อนล้มเพราะ Maximo ล่ม)"""
    if (current.role or "").lower() not in CM_SYNC_ROLES and not current.is_super_admin:
        raise HTTPException(status_code=403, detail="Only engineer, owner or admin can re-sync")

    coll, oid, doc = await _load_report(station_id, report_id, current)
    result = await cm_maximo.safe_sync_report(
        coll, oid, doc, memo=f"manual re-sync by {current.username}"
    )
    fresh = await coll.find_one({"_id": oid}) or {}
    return {
        "ok": True,
        "result": result,
        "maximo_wonum": fresh.get("maximo_wonum") or "",
        "interfaces": _serialize_sync(fresh),
    }


# ══════════════════════════════════════════════════════════════════
# IN03 — แนบลิงก์เอกสารเข้ากับ WO
# ══════════════════════════════════════════════════════════════════
class AttachIn(BaseModel):
    url: str = Field(..., description="path ในระบบ iMPS หรือ URL เต็ม")
    name: str = ""
    description: str = ""


@router.post("/cm-maximo/{report_id}/attach")
async def cm_attach(
    report_id: str,
    body: AttachIn,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """แนบลิงก์ (PDF ใบงาน / รูปหน้างาน) เข้ากับใบสั่งงานใน Maximo"""
    coll, oid, doc = await _load_report(station_id, report_id, current)
    result = await cm_maximo.push_attachment(
        coll, oid, doc, body.url, name=body.name, description=body.description
    )
    if not result.get("ok"):
        # ไม่ใช่ error ของ iMPS — บอกสาเหตุกลับไปให้หน้าจอแสดงได้
        return {"ok": False, **result}
    return {"ok": True, **result}


# ══════════════════════════════════════════════════════════════════
# IN06 — Maximo เปิดใบงาน CM เข้ามาที่ iMPS (ขาเข้า)
# ══════════════════════════════════════════════════════════════════
class MaximoCMWorkOrderIn(BaseModel):
    """
    ใบงาน CM ที่เปิดจากฝั่ง Maximo แล้วส่งเข้ามาให้ iMPS

    location — Maximo location ใช้หาว่าเป็นสถานี/ตู้ไหนของ iMPS
    wonum    — เลขใบสั่งงานฝั่ง Maximo (key กันซ้ำ)
    """
    location: str
    wonum: str
    description: str = ""
    status: str = ""
    worktype: str = ""
    reportdate: Optional[str] = None
    reportedby: Optional[str] = None
    failurecode: Optional[str] = None
    priority: Optional[int] = None

    class Config:
        extra = "allow"


# reportedpriority ของ Maximo → severity ของ CM
_PRIORITY_TO_SEVERITY = {1: "Urgent", 2: "High", 3: "Medium", 4: "Low"}


def _station_of_location(location: str) -> dict:
    """Maximo location → station ของ iMPS (ลองระดับตู้ก่อน แล้วค่อยระดับสถานี)"""
    from config import charger_collection

    loc = (location or "").strip()
    if not loc:
        return {}
    charger = charger_collection.find_one(
        {"maximo_location": loc}, {"station_id": 1, "SN": 1, "charger_no": 1}
    )
    if charger:
        return {
            "station_id": charger.get("station_id"),
            "sn": charger.get("SN"),
            "charger_no": charger.get("charger_no"),
        }
    st = station_collection.find_one({"maximo_location": loc}, {"station_id": 1})
    return {"station_id": (st or {}).get("station_id")}


@router.post("/maximo/cm/work-order")
async def maximo_cm_work_order(
    body: MaximoCMWorkOrderIn,
    x_maximo_token: str | None = Header(default=None, alias="X-Maximo-Token"),
):
    """
    รับใบงาน CM ที่ Maximo เปิด → สร้างใบงานในระบบ iMPS ให้อัตโนมัติ

    ใบที่เข้ามาทางนี้ข้ามด่านอนุมัติของ CS (Maximo อนุมัติมาแล้ว) จึงเริ่มที่
    "Wait for schedule" ให้ engineer วางแผนต่อได้เลย
    ยิง wonum เดิมซ้ำ = อัปเดตใบเดิม ไม่สร้างซ้ำ
    """
    if not MAXIMO_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="MAXIMO_WEBHOOK_SECRET is not configured")
    if x_maximo_token != MAXIMO_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="invalid X-Maximo-Token")

    owner = _station_of_location(body.location)
    station_id = owner.get("station_id")
    if not station_id:
        raise HTTPException(
            status_code=404,
            detail=f"ไม่มีสถานี/ตู้ที่ผูกกับ location {body.location!r} ในระบบ iMPS",
        )

    from routers.cmreport import (
        get_cmreport_collection_for, get_next_cm_doc_name, get_next_cm_issue_id,
    )

    coll = get_cmreport_collection_for(station_id)
    wonum = body.wonum.strip()

    existing = await coll.find_one({"maximo_wonum": wonum}, {"_id": 1, "issue_id": 1})
    now = datetime.now(timezone.utc)

    if existing:
        await coll.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "problem_details": body.description or "",
                "maximo_status": body.status or "",
                "updatedAt": now,
            }},
        )
        return {"status": "OK", "report_id": str(existing["_id"]),
                "issue_id": existing.get("issue_id") or "", "created": False}

    found_date = normalize_pm_date(body.reportdate) if body.reportdate else \
        datetime.now(th_tz).date().isoformat()
    issue_id = await get_next_cm_issue_id(station_id, found_date)
    doc_name = await get_next_cm_doc_name(station_id, found_date)

    # dropdown "อุปกรณ์ที่เสียหาย" ดึงรหัสจาก Maximo ตรง ๆ อยู่แล้ว เก็บตามที่ส่งมาได้เลย
    # (รหัสชุดเก่าของ iMPS ยังอ่านได้ผ่าน failureCodeLabel ฝั่งหน้าจอ)
    faulty = (body.failurecode or "").strip().upper()

    doc = {
        "station_id": station_id,
        "doc_name": doc_name,
        "issue_id": issue_id,
        "found_date": found_date,
        "found_time": datetime.now(th_tz).strftime("%H:%M"),
        "location": body.location,
        "reported_by": body.reportedby or "MAXIMO",
        "faulty_equipment": faulty,
        "severity": _PRIORITY_TO_SEVERITY.get(body.priority or 0, "Medium"),
        "problem_details": body.description or "",
        "remarks_open": "",
        # Maximo อนุมัติมาแล้ว → ข้ามด่าน CS ไปรอ engineer วางแผน
        "status": "Wait for schedule",
        "photos_problem": {},
        "origin": "maximo",
        "maximo_wonum": wonum,
        "maximo_location": body.location,
        "maximo_status": body.status or "",
        "createdAt": now,
        "updatedAt": now,
    }
    if owner.get("sn"):
        doc["sn"] = owner["sn"]

    res = await coll.insert_one(doc)
    log.info(f"  📥 Maximo CM work order {wonum} → iMPS {issue_id} ({station_id})")
    return {"status": "OK", "report_id": str(res.inserted_id),
            "issue_id": issue_id, "created": True}
