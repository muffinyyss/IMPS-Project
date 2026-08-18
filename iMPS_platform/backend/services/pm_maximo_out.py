"""
services/pm_maximo_out.py
=========================
ขาออกของฝั่ง PM: iMPS → Maximo  (คู่กับ routers/pm_maximo.py ที่เป็นขาเข้า)

ต่างจาก CM ตรงที่ PM **ไม่เปิด WO เอง** (ไม่มี IN01) และ **ไม่มี IN05 failure report**
— Maximo เป็นคนเปิดใบงาน WSCHD ส่งเข้ามาทาง IN06 แล้ว iMPS ยิงกลับตาม sequencing
ที่ตกลงกับ EGAT (Maximo x iMPS — PM):

  1. IN06  (ขาเข้า)                     Maximo สร้าง WO (WSCHD) → iMPS สร้างใบงาน OPEN
  2. IN02  update_wo_status(INPRG)      planner assign → ใบงานเข้าสถานะ In Progress
  3. IN03  attach_wo_link(url)          ช่างกรอกเสร็จ แนบลิงก์เอกสาร
  4. IN09  create_labtrans()            เวลาทำงานจริงของช่าง
  5. IN02  update_wo_status(COMP)       ปิดสถานะ ต้องเป็นเส้นสุดท้ายเสมอ

ขั้น 3–5 ยิงทีละเส้นเรียงกัน (ห้ามส่งพร้อมกัน) และ IN02 COMP ต้องอยู่ท้ายสุด
เพราะพอ WO ขึ้น COMP แล้ว Maximo ไม่ให้แนบเอกสาร/ลงเวลาเพิ่มอีก

wonum มาจากฟิลด์ `wonum` บนเอกสาร PM ซึ่งผูกไว้ตอนช่างเปิดฟอร์มจากใบงานที่
planner assign — ใบที่ไม่มี wonum (สร้างเองไม่ได้มาจาก Maximo) จะข้ามไปเงียบ ๆ
"""

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any

from config import client
from services import maximo
from services.cm_maximo import resolve_labor_code
from services.maximo import MaximoError

log = logging.getLogger("pm_maximo_out")

# เปิด/ปิดแยกจากฝั่ง CM — เปิดใช้งานทีละระบบได้ตอนขึ้น production
PM_MAXIMO_ENABLED = os.getenv("PM_MAXIMO_ENABLED", "true").lower() == "true"

# ลิงก์ที่แนบเข้า Maximo ต้องเปิดจากภายนอกได้ — ไฟล์ใน iMPS เก็บเป็น path
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", os.getenv("FRONTEND_BASE_URL", "")).rstrip("/")

# สถานะที่ยิงตอนปิดงาน — ใช้ COMP เหมือน CM ไม่ใช่ CLOSE
# (CLOSE ใน Maximo ปิดตายแก้ไม่ได้อีก ปล่อยให้ EGAT เป็นคนกดเอง)
PM_CLOSE_STATUS = os.getenv("MAXIMO_PM_CLOSE_STATUS", "COMP").strip().upper()

# สถานะตอน planner assign งานให้ช่าง (ขั้น 2 ของ sequencing)
PM_INPROGRESS_STATUS = os.getenv("MAXIMO_PM_INPRG_STATUS", "INPRG").strip().upper()

# หน่วงระหว่าง interface ตอนปิดงาน — ใช้ค่าเดียวกับฝั่ง CM
# (EGAT ระบุว่าส่งพร้อมกันไม่ได้ ต้องรอ Maximo commit เส้นก่อนหน้าก่อน)
MAXIMO_STEP_DELAY = float(os.getenv("MAXIMO_STEP_DELAY", "2"))


async def _settle() -> None:
    """รอ Maximo commit เส้นที่เพิ่งยิงไป ก่อนยิงเส้นถัดไป"""
    if MAXIMO_STEP_DELAY > 0:
        await asyncio.sleep(MAXIMO_STEP_DELAY)


def _open_coll():
    """iMPS.maximo_pm_open — ใบงาน PM ที่ Maximo เปิดเข้ามา (มี assignees ของแผน)"""
    return client["iMPS"]["maximo_pm_open"]


async def _record(coll, report_id, interface: str, ok: bool, **detail) -> None:
    """จดผลลง maximo_sync.<interface> ของเอกสาร — ล้มตรงนี้ต้องไม่กระทบใบงาน"""
    entry = {
        "ok": ok,
        "at": datetime.now(timezone.utc),
        **{k: v for k, v in detail.items() if v is not None},
    }
    try:
        await coll.update_one({"_id": report_id}, {"$set": {f"maximo_sync.{interface}": entry}})
    except Exception as e:
        log.warning(f"  ⚠️ record maximo_sync.{interface} failed: {e}")


def _err_detail(e: Exception) -> str:
    """ข้อความ error + body ดิบจาก Maximo — body คือที่มีรหัส BMXAA บอกสาเหตุจริง"""
    msg = str(e)
    body = getattr(e, "body", "") or ""
    return f"{msg} | {body[:400]}" if body else msg


def _skip(reason: str) -> dict:
    return {"ok": False, "skipped": True, "reason": reason}


def _fail(e: Exception) -> dict:
    detail: dict[str, Any] = {"ok": False, "error": str(e)}
    if isinstance(e, MaximoError) and e.body:
        detail["body"] = e.body
    return detail


def public_url(path: str) -> str:
    """path ของไฟล์/หน้าใน iMPS → URL เต็มที่ Maximo เปิดได้"""
    p = (path or "").strip()
    if not p or p.startswith(("http://", "https://")):
        return p
    if not PUBLIC_BASE_URL:
        return ""
    return f"{PUBLIC_BASE_URL}/{p.lstrip('/')}"


def report_url(report: dict, report_id: Any) -> str:
    """
    ลิงก์ PDF เอกสาร PM — ใช้แนบเข้า Maximo (IN03)

    แนบตัวเอกสาร PDF ไม่ใช่หน้าเว็บ คนที่เปิดจาก Maximo จะได้ไฟล์เลย
    ยิงตอนปิดงานเท่านั้น ตอนนั้น PDF ถึงจะมีเนื้อหาครบ
    """
    if not PUBLIC_BASE_URL:
        return ""
    sn = (report.get("sn") or "").strip()
    station_id = (report.get("station_id") or "").strip()
    scope = f"sn={sn}" if sn else f"station_id={station_id}"
    return f"{PUBLIC_BASE_URL}/pdf/charger/{report_id}/export?{scope}&lang=th&dl=1"


async def push_status(
    coll, report_id, report: dict, *, status: str = "", memo: str = ""
) -> dict:
    """IN02 — ส่งสถานะ WO ไป Maximo (ไม่ระบุ status = สถานะปิดงาน)"""
    wonum = (report.get("wonum") or "").strip()
    if not wonum:
        return _skip("เอกสารนี้ไม่ได้ผูกกับใบงาน Maximo")

    target = (status or PM_CLOSE_STATUS).strip().upper()

    # ยิงซ้ำสถานะเดิมไม่มีประโยชน์ และ Maximo error ว่าเปลี่ยนเป็นค่าเดิมไม่ได้
    if (report.get("maximo_sync") or {}).get("IN02", {}).get("status") == target:
        return {"ok": True, "status": target, "unchanged": True}

    try:
        await maximo.update_wo_status(wonum, target, memo=memo)
    except MaximoError as e:
        log.warning(f"  ⚠️ IN02 status push failed (WO {wonum} → {target}): {e}")
        result = _fail(e)
        await _record(coll, report_id, "IN02", False, wonum=wonum, status=target, **result)
        return result

    await _record(coll, report_id, "IN02", True, wonum=wonum, status=target)
    return {"ok": True, "wonum": wonum, "status": target}


async def push_attachment(
    coll, report_id, report: dict, url: str, *, name: str = "", description: str = ""
) -> dict:
    """IN03 — แนบลิงก์เอกสาร PM เข้ากับ WO"""
    wonum = (report.get("wonum") or "").strip()
    if not wonum:
        return _skip("เอกสารนี้ไม่ได้ผูกกับใบงาน Maximo")

    link = public_url(url)
    if not link:
        return _skip("ตั้งค่า PUBLIC_BASE_URL ก่อน ถึงจะสร้างลิงก์ที่ Maximo เปิดได้")

    try:
        await maximo.attach_wo_link(
            wonum, link,
            name=name or f"{report.get('issue_id') or 'PM'}.pdf",
            description=description or f"iMPS PM {report.get('doc_name') or ''}".strip(),
        )
    except MaximoError as e:
        log.warning(f"  ⚠️ IN03 attach failed (WO {wonum}): {e}")
        result = _fail(e)
        await _record(coll, report_id, "IN03", False, wonum=wonum, url=link, **result)
        return result

    await _record(coll, report_id, "IN03", True, wonum=wonum, url=link)
    return {"ok": True, "wonum": wonum, "url": link}


async def push_labor_time(coll, report_id, report: dict) -> dict:
    """
    IN09 — ลงเวลาช่างที่ planner assign ไว้ในใบงาน

    PM ไม่ได้เก็บเวลาเข้า-ออกงานรายคนแบบ CM จึงใช้ช่วงเวลาของเอกสารแทน:
      start/finish = work_start / work_finish ที่ช่างกรอกในฟอร์ม Post-PM
      (เอกสารเก่าที่ไม่มีช่องนี้ ถอยไปใช้ timestamp / submittedAt ของเอกสาร)
    ช่างมาจาก assignees ของแผนใน maximo_pm_open — ไม่มีก็ถอยไปใช้ inspector
    """
    wonum = (report.get("wonum") or "").strip()
    if not wonum:
        return _skip("เอกสารนี้ไม่ได้ผูกกับใบงาน Maximo")

    def _iso(v: Any) -> str:
        if isinstance(v, datetime):
            return v.astimezone(timezone.utc).isoformat()
        return str(v or "").strip()

    # ช่างกรอกเวลาทำงานจริงไว้ในฟอร์ม Post-PM — ใช้ตัวนี้ก่อนเสมอ
    # ที่เหลือเป็น fallback ของเอกสารเก่าที่บันทึกก่อนมีช่องกรอกเวลา
    start = str(report.get("work_start") or "").strip()         or _iso(report.get("timestamp")) or str(report.get("pm_date") or "").strip()
    finish = str(report.get("work_finish") or "").strip()         or _iso(report.get("submittedAt")) or _iso(report.get("timestamp_post"))
    if not start:
        return _skip("ยังไม่มีวันเวลาเริ่มงาน")

    wo = await _open_coll().find_one({"wonum": wonum}, {"assignees": 1, "location": 1}) or {}
    assignees = [str(a).strip() for a in (wo.get("assignees") or []) if str(a or "").strip()]
    if not assignees:
        inspector = str(report.get("inspector") or "").strip()
        assignees = [inspector] if inspector else []
    if not assignees:
        return _skip("ใบงานยังไม่มีช่างที่รับผิดชอบ")

    location = wo.get("location") or None

    sent, errors, unmapped = 0, [], []
    for username in assignees:
        labor = resolve_labor_code(username)
        if not labor:
            # ยังไม่ได้ผูก users.maximo_laborcode — ยิงไปก็โดน BMXAA2627E เปล่า ๆ
            unmapped.append(username)
            continue
        try:
            await maximo.create_labtrans(
                wonum, labor,
                start=start, finish=finish or None,
                location=location,
                memo=f"iMPS PM {report.get('issue_id') or ''}",
            )
            sent += 1
        except MaximoError as e:
            log.warning(f"  ⚠️ IN09 labtrans failed (WO {wonum} / {labor}): {_err_detail(e)}")
            errors.append(f"{username}: {_err_detail(e)}")

    ok = sent > 0 and not errors and not unmapped
    await _record(coll, report_id, "IN09", ok, wonum=wonum, sent=sent,
                  total=len(assignees), errors=errors or None, unmapped=unmapped or None)
    if ok:
        return {"ok": True, "wonum": wonum, "sent": sent}
    return {"ok": False, "wonum": wonum, "sent": sent, "total": len(assignees),
            "errors": errors, "unmapped": unmapped}


async def sync_in_progress(wonum: str, *, memo: str = "") -> dict:
    """
    ขั้น 2 — planner assign เสร็จ ใบงานเข้าสถานะ In Progress

    ตอนนี้ยังไม่มีเอกสาร PM (ช่างยังไม่เริ่มกรอก) จึงจดผลไว้ที่ตัวใบงาน
    ใน maximo_pm_open แทน
    """
    if not PM_MAXIMO_ENABLED:
        return {"skipped": "PM_MAXIMO_ENABLED=false"}

    wonum = (wonum or "").strip()
    if not wonum:
        return _skip("wonum ว่าง")

    coll = _open_coll()
    wo = await coll.find_one({"wonum": wonum}) or {}
    if not wo:
        return _skip(f"ไม่พบใบงาน wonum={wonum}")

    return await push_status(
        coll, wo["_id"], {**wo, "wonum": wonum},
        status=PM_INPROGRESS_STATUS, memo=memo,
    )


async def safe_sync_in_progress(wonum: str, *, memo: str = "") -> dict:
    """sync_in_progress แบบกลืน exception — Maximo ล่มต้องไม่ทำให้ assign ล้ม"""
    try:
        return await sync_in_progress(wonum, memo=memo)
    except Exception as e:
        log.warning(f"  ⚠️ PM Maximo INPRG error ({wonum}): {e}")
        return {"error": str(e)}


def _blocking_failures(results: dict) -> list[str]:
    """
    เส้นที่ "ยิงแล้วไม่ผ่าน" ก่อนถึงขั้นปิดสถานะ

    แยกจาก skipped: skipped = ไม่มีอะไรให้ส่ง (เช่นยังไม่ตั้ง PUBLIC_BASE_URL,
    ใบงานไม่มีช่าง) ปล่อยผ่านได้ ส่วน failed = Maximo ปฏิเสธ ต้องแก้แล้วยิงซ้ำ
    ก่อน ไม่งั้นพอ WO ขึ้น COMP แล้วจะเติมย้อนหลังไม่ได้อีกเลย
    """
    return [
        name for name, r in results.items()
        if isinstance(r, dict) and not r.get("ok") and not r.get("skipped")
    ]


async def sync_closed(coll, report_id, report: dict, *, memo: str = "") -> dict:
    """
    ขั้น 3–5 ของ sequencing — ยิงทีละเส้นเรียงกัน เรียกซ้ำได้ปลอดภัย
    (IN02 กันยิงซ้ำสถานะเดิม, IN03 แนบครั้งเดียวพอ)
    """
    if not PM_MAXIMO_ENABLED:
        return {"skipped": "PM_MAXIMO_ENABLED=false"}

    out: dict[str, Any] = {}

    # ── 3. IN03 แนบลิงก์เอกสาร (ครั้งเดียวพอ) ──
    if not (report.get("maximo_sync") or {}).get("IN03", {}).get("ok"):
        out["IN03"] = await push_attachment(coll, report_id, report, report_url(report, report_id))

    # ── 4. IN09 เวลาทำงานจริงของช่าง ──
    await _settle()
    out["IN09"] = await push_labor_time(coll, report_id, report)

    # ── 5. IN02 ปิดสถานะเป็นเส้นสุดท้าย ──
    # ต้องยิง 3–4 ให้ครบก่อน มีเส้นไหนไม่ผ่านห้ามปิด WO
    # (COMP แล้ว Maximo ไม่ให้แนบเอกสาร/ลงเวลาเพิ่มอีก)
    failed = _blocking_failures(out)
    if failed:
        log.warning(
            f"  ⏸️  ไม่ปิด WO {report.get('wonum')} — {', '.join(failed)} ยังไม่ผ่าน"
        )
        out["IN02"] = _skip(f"รอ {', '.join(failed)} ผ่านก่อนถึงจะปิด WO ได้")
        return out

    await _settle()
    out["IN02"] = await push_status(coll, report_id, report, memo=memo)

    return out


async def safe_sync_closed(coll, report_id, report: dict, *, memo: str = "") -> dict:
    """sync_closed แบบกลืนทุก exception — Maximo ล่มต้องไม่ทำให้ปิดใบงานล้ม"""
    try:
        return await sync_closed(coll, report_id, report, memo=memo)
    except Exception as e:
        log.warning(f"  ⚠️ PM Maximo sync error ({report.get('issue_id')}): {e}")
        return {"error": str(e)}
