"""
routers/pm_flow.py
==================
ตรรกะกลางของ flow ใบงาน PM — ใช้ร่วมกันทั้ง 5 ชนิด (charger / mdb / ccb / cbbox / station)

  Maximo เปิดใบงาน (IN06) → planner assign → technician กรอก (draft)
  → กด finalize = "Wait for approve" → planner approve = "Closed"
  (reject = กลับไป "draft" ให้ช่างแก้)

charger ใช้ SN เป็น key ส่วนอีก 4 ชนิดใช้ station_id — ตรงนี้ต่างกันแค่ตัวแปร
`scope_field` ที่ผู้เรียกส่งเข้ามา ที่เหลือเหมือนกันหมด
"""

import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Any, Optional

from bson.objectid import ObjectId
from fastapi import HTTPException
from pydantic import BaseModel, Field

from deps import UserClaims

# ── สถานะในflow ──
PM_STATUS_DRAFT = "draft"
# เวลาที่ช่างกรอกเป็นเวลาท้องถิ่นไทย ไม่มี timezone ติดมา เทียบกับ now ต้องใช้โซนเดียวกัน
_TH_TZ = ZoneInfo("Asia/Bangkok")

PM_STATUS_WAIT_APPROVE = "Wait for approve"
PM_STATUS_CLOSED = "Closed"

# ด่านอนุมัติปิดงาน — ตั้งชื่อให้ตรงกับ CM เผื่ออนาคตมีด่านอนุมัติอื่นเพิ่ม
PM_STAGE_CLOSE_APPROVAL = "close_approval"

# ใบเก่าปิดด้วย "submitted" ก่อนมี flow อนุมัติ — นับเป็นปิดแล้วเวลาแสดงผล
PM_LEGACY_CLOSED_STATUS = "submitted"
PM_CLOSED_STATUSES = {PM_STATUS_CLOSED.lower(), PM_LEGACY_CLOSED_STATUS}

PM_APPROVE_ROLES: set[str] = {"admin", "planner"}

# ฟิลด์ที่ list endpoint ต้องดึงเพิ่มเพื่อให้ตารางแสดงสถานะได้
LIST_PROJECTION = {
    "status": 1, "stage": 1, "wonum": 1,
    "approved_by": 1, "approved_at": 1,
    "reject_remark": 1, "rejected_by": 1, "submittedAt": 1,
}


class PMRejectIn(BaseModel):
    remark: str = Field(..., min_length=1, description="เหตุผลที่ตีกลับ — ช่างต้องรู้ว่าต้องแก้อะไร")


def status_or_conditions(status: str) -> list[dict]:
    """เงื่อนไข match status — รองรับหลายค่าคั่นด้วย , และเทียบแบบไม่สนตัวพิมพ์"""
    conds: list[dict] = []
    for w in (x.strip() for x in status.split(",")):
        if not w:
            continue
        conds.append({"status": {"$regex": f"^{re.escape(w)}$", "$options": "i"}})
        # "Closed" ต้องเห็นใบเก่าที่ยังเป็น submitted ด้วย
        if w.lower() == PM_STATUS_CLOSED.lower():
            conds.append({"status": PM_LEGACY_CLOSED_STATUS})
    return conds


def assert_approver(current: UserClaims) -> None:
    if (current.role or "").strip().lower() not in PM_APPROVE_ROLES:
        raise HTTPException(status_code=403, detail="Only planner or admin can approve")


def to_oid(report_id: str) -> ObjectId:
    try:
        return ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")


def list_fields(it: dict, ensure_utc_iso) -> dict:
    """ฟิลด์สถานะที่แนบไปกับทุกแถวใน list endpoint"""
    return {
        # ใบเก่าไม่มี status เลย = ปิดไปแล้วก่อนมี flow อนุมัติ
        "status": it.get("status") or PM_LEGACY_CLOSED_STATUS,
        "stage": it.get("stage") or "",
        "wonum": it.get("wonum") or "",
        "approved_by": it.get("approved_by") or "",
        "approved_at": ensure_utc_iso(it.get("approved_at")),
        "reject_remark": it.get("reject_remark") or "",
        "rejected_by": it.get("rejected_by") or "",
        "submittedAt": ensure_utc_iso(it.get("submittedAt")),
    }


async def finalize(coll, oid: ObjectId, scope_filter: dict) -> None:
    """
    ช่างกดส่ง = เข้าคิวรอ planner อนุมัติ (ไม่ปิดงานเอง)

    ตรวจก่อน 2 อย่าง: ปิดไปแล้วห้ามส่งซ้ำ · ต้องมีเวลาทำงานครบ (ใช้ส่ง IN09)
    """
    doc = await coll.find_one(
        {**scope_filter, "_id": oid},
        {"_id": 1, "status": 1, "work_start": 1, "work_finish": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    if str(doc.get("status") or "").strip().lower() in PM_CLOSED_STATUSES:
        raise HTTPException(status_code=409, detail="Report is already closed")

    work_start = str(doc.get("work_start") or "").strip()
    work_finish = str(doc.get("work_finish") or "").strip()
    if not work_start or not work_finish:
        raise HTTPException(
            status_code=400,
            detail="กรุณากรอกเวลาเริ่มงานและเวลาเสร็จงานก่อนส่งปิดใบงาน",
        )

    # Maximo ตีกลับ IN09 ด้วย BMXAA2641E ถ้าเวลาทำงานยังมาไม่ถึง
    # ("You cannot enter actual labor with future dates and times")
    # ปล่อยผ่าน = ใบงานปิดฝั่งเราแต่ปิด WO ฝั่งเขาไม่ได้ ต้องตามแก้ย้อนหลัง
    # เผื่อ 5 นาที ให้นาฬิกาเครื่องช่างคลาดจากเซิร์ฟเวอร์ได้บ้าง
    limit = (datetime.now(_TH_TZ) + timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M")
    future = [v for v in (work_start, work_finish) if v > limit]
    if future:
        raise HTTPException(
            status_code=400,
            detail=(
                f"เวลาทำงานเป็นเวลาในอนาคต ({', '.join(future)}) — "
                "Maximo ไม่รับ กรุณาแก้ก่อนส่งปิดใบงาน"
            ),
        )

    now = datetime.now(timezone.utc)
    res = await coll.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": PM_STATUS_WAIT_APPROVE,
                "stage": PM_STAGE_CLOSE_APPROVAL,
                "submittedAt": now,
                "updatedAt": now,
            },
            # ส่งใหม่หลังโดนตีกลับ → ล้างเหตุผลเดิม ไม่ให้ค้างหลอกผู้อนุมัติ
            "$unset": {"reject_remark": "", "rejected_by": "", "rejected_at": ""},
        },
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")


async def approve(coll, oid: ObjectId, scope_filter: dict, current: UserClaims) -> dict:
    """planner/admin อนุมัติปิดใบงาน: "Wait for approve" → "Closed" """
    assert_approver(current)

    now = datetime.now(timezone.utc)
    res = await coll.update_one(
        {
            **scope_filter,
            "_id": oid,
            "status": {"$regex": f"^{PM_STATUS_WAIT_APPROVE}$", "$options": "i"},
        },
        {
            "$set": {
                "status": PM_STATUS_CLOSED,
                "approved_by": current.username,
                "approved_at": now,
                "updatedAt": now,
            },
            "$unset": {"stage": "", "reject_remark": "", "rejected_by": "", "rejected_at": ""},
        },
    )
    if res.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Report not found or not in 'Wait for approve' status",
        )
    return {"ok": True, "status": PM_STATUS_CLOSED}


async def reject(
    coll, oid: ObjectId, scope_filter: dict, current: UserClaims, remark: str
) -> dict:
    """planner/admin ตีกลับใบงานให้ช่างแก้: "Wait for approve" → "draft" """
    assert_approver(current)

    remark = (remark or "").strip()
    if not remark:
        raise HTTPException(status_code=400, detail="remark is required")

    now = datetime.now(timezone.utc)
    res = await coll.update_one(
        {
            **scope_filter,
            "_id": oid,
            "status": {"$regex": f"^{PM_STATUS_WAIT_APPROVE}$", "$options": "i"},
        },
        {
            "$set": {
                # กลับเป็น draft = ช่างคนเดิมเปิดฟอร์มแก้ต่อได้เหมือนเดิม
                "status": PM_STATUS_DRAFT,
                "reject_remark": remark,
                "rejected_by": current.username,
                "rejected_at": now,
                "updatedAt": now,
            },
            "$unset": {"stage": "", "submittedAt": ""},
        },
    )
    if res.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Report not found or not in 'Wait for approve' status",
        )
    return {"ok": True, "status": PM_STATUS_DRAFT}


# ── ความครบถ้วนของใบงาน 1 ใบ ──
# ใบงาน Maximo 1 ใบครอบอุปกรณ์ได้หลายตัว (planner เลือกไว้ตอนวางแผน) และอุปกรณ์
# แต่ละตัวมีเอกสาร PM ของตัวเอง คนละ collection — จะยิงปิดงานเข้า Maximo ได้
# ต่อเมื่อ **ปิดครบทุกตัว** ไม่งั้น WO จะถูกปิดทั้งที่ยังทำไม่เสร็จ

_TYPE_LABEL = {"charger": "Charger", "mdb": "MDB", "ccb": "CCB",
               "cbbox": "CB_BOX", "station": "Station"}


def _equip_label(item: dict) -> str:
    t = str(item.get("type") or "").strip().lower()
    if t == "charger":
        return item.get("label") or item.get("sn") or "Charger"
    return _TYPE_LABEL.get(t, t or "-")


def _coll_for_equip(item: dict, station_id: str):
    """อุปกรณ์ 1 ตัว → collection ของเอกสาร PM ชนิดนั้น"""
    from routers.pm_helpers import (
        get_pmreport_collection_for, get_mdbpmreport_collection_for,
        get_ccbpmreport_collection_for, get_cbboxpmreport_collection_for,
        get_stationpmreport_collection_for,
    )

    t = str(item.get("type") or "").strip().lower()
    if t == "charger":
        sn = str(item.get("sn") or "").strip()
        # charger เก็บแยกตาม SN ไม่ใช่ station_id
        return get_pmreport_collection_for(sn) if sn else None
    getter = {
        "mdb": get_mdbpmreport_collection_for,
        "ccb": get_ccbpmreport_collection_for,
        "cbbox": get_cbboxpmreport_collection_for,
        "station": get_stationpmreport_collection_for,
    }.get(t)
    return getter(station_id) if getter and station_id else None


async def wo_reports(wonum: str) -> list[dict]:
    """
    เอกสาร PM ทุกใบที่ผูกกับใบงาน Maximo ใบนี้

    ใบงาน 1 ใบครอบได้หลายอุปกรณ์ = หลายเอกสาร คนละคอลเลกชันกันด้วย
    ไล่ตาม selected_equipment ที่ planner เลือกไว้ ซึ่งเป็นตัวเดียวกับที่
    wo_completion ใช้ตัดสินว่าปิดครบหรือยัง
    """
    from config import client

    wonum = (wonum or "").strip()
    if not wonum:
        return []

    wo = await client["iMPS"]["maximo_pm_open"].find_one({"wonum": wonum}) or {}
    station_id = (wo.get("station_id") or "").strip()

    out: list[dict] = []
    for item in wo.get("selected_equipment") or []:
        coll = _coll_for_equip(item, station_id)
        if coll is None:
            continue
        try:
            doc = await coll.find_one(
                {"wonum": wonum},
                {"_id": 1, "issue_id": 1, "status": 1, "maximo_sync": 1},
            )
        except Exception:
            doc = None
        if not doc:
            continue
        out.append({
            "equipment": _equip_label(item),
            "type": str(item.get("type") or ""),
            "report_id": str(doc.get("_id")),
            "issue_id": doc.get("issue_id") or "",
            "status": doc.get("status") or "",
            "maximo_sync": doc.get("maximo_sync") or {},
        })
    return out


async def wo_completion(wonum: str) -> dict:
    """
    ใบงาน Maximo ใบนี้ปิดครบทุกอุปกรณ์ที่ planner เลือกไว้หรือยัง

    Returns:
        {"required": n, "done": m, "missing": [ชื่ออุปกรณ์…], "complete": bool}
        ไม่มีใบงาน / planner ไม่ได้เลือกอุปกรณ์ไว้ → complete=True (ไม่มีอะไรให้รอ)
    """
    from config import client

    wonum = (wonum or "").strip()
    if not wonum:
        return {"required": 0, "done": 0, "missing": [], "complete": True}

    wo = await client["iMPS"]["maximo_pm_open"].find_one({"wonum": wonum}) or {}
    items = wo.get("selected_equipment") or []
    if not items:
        return {"required": 0, "done": 0, "missing": [], "complete": True}

    station_id = (wo.get("station_id") or "").strip()
    closed_cond = {"$or": status_or_conditions(PM_STATUS_CLOSED)}

    done, missing = 0, []
    for item in items:
        coll = _coll_for_equip(item, station_id)
        label = _equip_label(item)
        if coll is None:
            missing.append(label)
            continue
        try:
            hit = await coll.find_one({"wonum": wonum, **closed_cond}, {"_id": 1})
        except Exception:
            hit = None
        if hit:
            done += 1
        else:
            missing.append(label)

    return {
        "required": len(items),
        "done": done,
        "missing": missing,
        "complete": not missing,
    }


def post_submit_fields(body: Any) -> dict:
    """ฟิลด์เพิ่มเติมตอนบันทึก Post-PM ที่ทุกชนิดใช้ร่วมกัน"""
    fields = {
        "work_start": (getattr(body, "work_start", None) or "").strip(),
        "work_finish": (getattr(body, "work_finish", None) or "").strip(),
        # laborcode ที่ช่างเลือกเอง + ชื่อผู้รับเหมา (ถ้าเลือกรหัสกลาง) — ใช้ส่ง IN09
        "maximo_labor": list(getattr(body, "maximo_labor", None) or []),
        "maximo_contractor": (getattr(body, "maximo_contractor", None) or "").strip(),
    }

    # wonum ว่าง = "ไม่รู้" ไม่ใช่ "ให้ลบ" — เลขนี้ผูกตั้งแต่ตอนบันทึก Pre-PM
    # ถ้าเขียนทับด้วยค่าว่างตอน Post ใบงานจะหลุดจาก Maximo ทันที ปิดงานแล้วก็
    # ยิงกลับไม่ได้ เพราะ wo_completion กับ sync ทั้งชุดอ่านจากฟิลด์นี้
    wonum = (getattr(body, "wonum", None) or "").strip()
    if wonum:
        fields["wonum"] = wonum
    return fields
