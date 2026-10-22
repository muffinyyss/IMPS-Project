"""
routers/pm_auto_wo.py
=====================
สวิตช์ "ปิดรับใบงาน PM จาก Maximo" + การออกใบงาน PM เองตามรอบ commissioning ของตู้
ตรรกะอยู่ที่ services/pm_auto_wo.py

  GET  /pm-maximo/intake               ทุกคนที่ล็อกอิน — หน้า PM List ใช้โชว์แถบสถานะ
  PUT  /pm-maximo/intake {closed}      admin — ปิดรับ = ออกใบของเดือนนี้ให้ทันที
  GET  /pm-maximo/auto-wo/preview      planner/owner/admin — ตู้/สถานีที่ครบรอบในเดือนนั้น
  POST /pm-maximo/auto-wo/run          admin — ออกใบของเดือนนั้นตอนนี้ (ไม่ต้องรอ loop)
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from deps import UserClaims, get_current_user
from services import pm_auto_wo

router = APIRouter(tags=["pm-auto-wo"])

PREVIEW_ROLES = {"admin", "owner", "planner"}


class IntakeIn(BaseModel):
    closed: bool


def _role(current: UserClaims) -> str:
    return (current.role or "").strip().lower()


def _assert_admin(current: UserClaims) -> None:
    if _role(current) != "admin":
        raise HTTPException(status_code=403, detail="เฉพาะ admin ที่เปิด/ปิดรับใบงานจาก Maximo ได้")


def _month_or_400(month: Optional[str]) -> tuple[int, int]:
    try:
        return pm_auto_wo.parse_month(month)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pm-maximo/intake")
async def get_pm_intake(current: UserClaims = Depends(get_current_user)):
    doc = await pm_auto_wo.get_settings(fresh=True)
    return {**pm_auto_wo.serialize_settings(doc), "can_toggle": _role(current) == "admin"}


@router.put("/pm-maximo/intake")
async def set_pm_intake(body: IntakeIn, current: UserClaims = Depends(get_current_user)):
    _assert_admin(current)
    who = current.username or current.sub
    doc = await pm_auto_wo.set_intake_closed(body.closed, who)
    run = None
    if body.closed:
        # ปิดรับกลางเดือน = ตู้ที่ครบรอบเดือนนี้ได้ใบทันที ไม่ต้องรอ loop รอบถัดไป
        run = await pm_auto_wo.generate_for_month(who=who)
        doc = await pm_auto_wo.get_settings(fresh=True)
    return {**pm_auto_wo.serialize_settings(doc), "can_toggle": True, "run": run}


@router.get("/pm-maximo/auto-wo/preview")
async def preview_auto_wo(
    month: Optional[str] = Query(None, description="YYYY-MM — ว่าง = เดือนนี้ (เวลาไทย)"),
    current: UserClaims = Depends(get_current_user),
):
    if _role(current) not in PREVIEW_ROLES:
        raise HTTPException(status_code=403, detail="Only planner, owner or admin")
    year, mon = _month_or_400(month)
    return await pm_auto_wo.preview_month(year, mon)


@router.post("/pm-maximo/auto-wo/run")
async def run_auto_wo(
    month: Optional[str] = Query(None, description="YYYY-MM — ว่าง = เดือนนี้ (เวลาไทย)"),
    current: UserClaims = Depends(get_current_user),
):
    _assert_admin(current)
    if not await pm_auto_wo.intake_closed():
        raise HTTPException(
            status_code=409,
            detail="ยังรับใบงานจาก Maximo อยู่ — ปิดรับก่อน ระบบจึงจะออกใบงานเอง",
        )
    year, mon = _month_or_400(month)
    return await pm_auto_wo.generate_for_month(year, mon, who=current.username or current.sub)
