"""
services/pm_maximo_retry.py
===========================
ส่งชุดปิดงาน (IN03 → IN09 → IN02 CLOSED) ของใบ PM สถานีที่ส่งไม่ผ่านซ้ำให้เองเป็นระยะ

ที่มา: planner อนุมัติแล้วใบใน iMPS เป็น Closed ทันที แต่ถ้า Maximo ล่ม/ตอบ error ตอนนั้น
ใบงานใน Maximo จะยังเปิดค้าง เดิมต้องมีคนเปิดใบเจอเองแล้วกด "ส่งเข้า Maximo ใหม่"

กติกา:
  - เลือกเฉพาะใบที่ close_out_job จดธง maximo_pending=true ไว้ (ใบเก่าก่อนมีธงไม่ถูกแตะ)
  - เส้นที่ผ่านแล้วไม่ยิงซ้ำ (IN03/IN09 จำผล, IN02 กันสถานะเดิมที่ผ่านแล้ว) — เรียกซ้ำได้ปลอดภัย
  - ถอยห่างขึ้นเรื่อย ๆ (PM_MAXIMO_RETRY_MINUTES × 2^(ครั้งที่-1) สูงสุด 12 ชม.)
    ครบ PM_MAXIMO_RETRY_MAX ครั้งแล้วหยุด (gave_up) — ธง maximo_pending ยังอยู่ให้หน้า PM List เห็น
    กด "ส่งเข้า Maximo ใหม่" เอง = เริ่มนับใหม่
  - สถานะการลองเก็บที่ stationPMJob.maximo_retry = {attempts, last_at, next_at, gave_up}
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

log = logging.getLogger("pm_maximo_retry")

RETRY_MINUTES = float(os.getenv("PM_MAXIMO_RETRY_MINUTES", "15"))
MAX_ATTEMPTS = int(os.getenv("PM_MAXIMO_RETRY_MAX", "10"))
MAX_DELAY_MINUTES = 12 * 60


def next_delay(attempts: int) -> timedelta:
    """ครั้งที่ 1 → 15 นาที, 2 → 30, 3 → 60 … ไม่เกิน 12 ชม."""
    minutes = RETRY_MINUTES * (2 ** max(attempts - 1, 0))
    return timedelta(minutes=min(minutes, MAX_DELAY_MINUTES))


def _due_query(now: datetime) -> dict:
    return {
        "maximo_pending": True,
        "maximo_retry.gave_up": {"$ne": True},
        "$or": [
            {"maximo_retry.next_at": {"$exists": False}},
            {"maximo_retry.next_at": {"$lte": now}},
        ],
    }


async def retry_pending_closes() -> dict:
    """รอบเดียว: ไล่ทุกสถานี ส่งใบที่ถึงเวลาลองใหม่ — คืนสรุปจำนวน"""
    from config import stationPMJobDB
    from routers.pmreport_station_job import _is_closed, close_out_job
    from services.pm_maximo_out import PM_MAXIMO_ENABLED

    stats = {"tried": 0, "done": 0, "failed": 0, "gave_up": 0}
    if not PM_MAXIMO_ENABLED:
        return stats

    now = datetime.now(timezone.utc)
    for station_id in await stationPMJobDB.list_collection_names():
        coll = stationPMJobDB[station_id]
        try:
            jobs = await coll.find(_due_query(now)).to_list(length=50)
        except Exception as e:
            log.warning(f"  ⚠️ อ่านใบ PM สถานี {station_id} ไม่สำเร็จ: {e}")
            continue
        for job in jobs:
            if not _is_closed(str(job.get("status") or "")):
                continue  # ถูกตีกลับ/เปิดใหม่หลังอนุมัติ — ไม่ใช่งานของ retry
            stats["tried"] += 1
            attempts = int((job.get("maximo_retry") or {}).get("attempts") or 0) + 1
            try:
                out = await close_out_job(job, station_id, memo="auto re-sync")
            except Exception as e:  # close_out_job ไม่ควร raise แต่กันไว้ไม่ให้ loop ตาย
                log.warning(f"  ⚠️ auto re-sync {job.get('issue_id')} ล้ม: {e}")
                out = {"maximo_pending": True}

            if not out.get("maximo_pending"):
                stats["done"] += 1
                log.info(f"  ✅ auto re-sync {job.get('issue_id')} ({job.get('wonum')}) ปิดใน Maximo แล้ว")
                continue

            gave_up = attempts >= MAX_ATTEMPTS
            stats["gave_up" if gave_up else "failed"] += 1
            await coll.update_one({"_id": job["_id"]}, {"$set": {"maximo_retry": {
                "attempts": attempts,
                "last_at": now,
                "next_at": now + next_delay(attempts),
                "gave_up": gave_up,
            }}})
            log.warning(
                f"  ⏳ auto re-sync {job.get('issue_id')} ({job.get('wonum')}) ยังไม่ผ่าน "
                f"ครั้งที่ {attempts}/{MAX_ATTEMPTS}" + (" — หยุดลองแล้ว รอคนกดส่งใหม่" if gave_up else "")
            )
    return stats


async def run_forever() -> None:
    """background task ของ main.py — ล้มรอบไหนก็ลองรอบถัดไป"""
    if RETRY_MINUTES <= 0:
        log.info("  · PM Maximo auto re-sync ปิดอยู่ (PM_MAXIMO_RETRY_MINUTES<=0)")
        return
    while True:
        await asyncio.sleep(RETRY_MINUTES * 60)
        try:
            stats = await retry_pending_closes()
            if stats["tried"]:
                log.info(f"  🔁 PM Maximo auto re-sync: {stats}")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.warning(f"  ⚠️ PM Maximo auto re-sync รอบนี้ล้ม: {e}")
