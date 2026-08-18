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
from datetime import datetime, timezone
from typing import Any, Optional

from bson.objectid import ObjectId
from fastapi import HTTPException
from pydantic import BaseModel, Field

from deps import UserClaims

# ── สถานะในflow ──
PM_STATUS_DRAFT = "draft"
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

    if not str(doc.get("work_start") or "").strip() or not str(doc.get("work_finish") or "").strip():
        raise HTTPException(
            status_code=400,
            detail="กรุณากรอกเวลาเริ่มงานและเวลาเสร็จงานก่อนส่งปิดใบงาน",
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


def post_submit_fields(body: Any) -> dict:
    """ฟิลด์เพิ่มเติมตอนบันทึก Post-PM ที่ทุกชนิดใช้ร่วมกัน"""
    return {
        "work_start": (getattr(body, "work_start", None) or "").strip(),
        "work_finish": (getattr(body, "work_finish", None) or "").strip(),
        "wonum": (getattr(body, "wonum", None) or "").strip(),
    }
