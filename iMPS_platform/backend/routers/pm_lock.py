"""
routers/pm_lock.py
==================
ล็อกกันกรอกชนกันของงาน PM — กลไกเดียวกับใบงาน CM (routers/cmreport.py: cm_lock)

ใครเปิดฟอร์มในโหมดกรอกก่อนได้สิทธิ์แก้ คนที่เข้าทีหลังดูได้อย่างเดียวจนกว่าคนแรกจะออก
ล็อกมีอายุ PM_LOCK_TTL_SECONDS หน้าเว็บต่ออายุให้ทุก 30 วิ (src/app/dashboard/pm-report/lib/lock.ts)
ปิดจอ/เน็ตหลุดจึงหลุดล็อกเองโดยไม่ต้องมีใครไปปลด

ใช้ 2 ที่:
  - ส่วนของใบ PM สถานี (Station / MDB / CCB / CB_BOX / ตู้ชาร์จรายตู้) — ล็อกทีละส่วน ไม่ใช่ทั้งใบ
    เพราะหลายฝ่ายกรอกคนละส่วนพร้อมกันได้ เก็บที่ใบแม่ stationPMJob.locks.<key>
    (ส่วนที่ยังไม่เคยบันทึกยังไม่มีเอกสารของตัวเอง จึงต้องเก็บที่ใบแม่)
  - แผนของใบงาน (หน้าวางแผน) — เก็บที่ maximo_pm_open.plan_lock
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

from deps import UserClaims

PM_LOCK_TTL_SECONDS = 120


def section_lock_field(section: str, sn: str = "") -> str:
    """ชื่อฟิลด์ล็อกของส่วนในใบแม่ — key เดียวกับ pm_scope.item_key (ตัด . / $ ที่ Mongo ไม่รับในชื่อฟิลด์)"""
    from routers.pm_scope import item_key
    key = item_key(section, sn).replace(".", "_").replace("$", "_")
    return f"locks.{key}"


def _me(current: UserClaims) -> str:
    return str(current.username or current.sub or "").strip()


def _utc(v: Any) -> datetime | None:
    """Mongo คืน datetime แบบ naive ที่เป็น UTC — ใส่ tzinfo ให้ก่อนเทียบ"""
    if not isinstance(v, datetime):
        return None
    return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v


def _get(doc: dict | None, field: str) -> dict:
    cur: Any = doc or {}
    for part in field.split("."):
        if not isinstance(cur, dict):
            return {}
        cur = cur.get(part)
    return cur if isinstance(cur, dict) else {}


def holder_of(doc: dict | None, field: str, now: datetime | None = None) -> str:
    """ชื่อคนที่ถือล็อกอยู่ ณ ตอนนี้ — ว่าง = ไม่มีใครถือ หรือหมดอายุแล้ว"""
    entry = _get(doc, field)
    by = str(entry.get("by") or "").strip()
    if not by:
        return ""
    expires = _utc(entry.get("expires_at"))
    return "" if expires and expires <= (now or datetime.now(timezone.utc)) else by


def active_locks(doc: dict | None, prefix: str = "locks") -> dict[str, str]:
    """ล็อกที่ยังไม่หมดอายุทั้งหมดใต้ prefix → {key: คนถือ}"""
    now = datetime.now(timezone.utc)
    out: dict[str, str] = {}
    for key in (_get(doc, prefix) or {}):
        who = holder_of(doc, f"{prefix}.{key}", now)
        if who:
            out[key] = who
    return out


def _same(a: str, b: str) -> bool:
    return a.strip().lower() == b.strip().lower()


async def acquire(coll, doc_filter: dict, field: str, current: UserClaims) -> dict:
    """
    ขอ/ต่ออายุสิทธิ์กรอก — คนอื่นถืออยู่ = held_by_me=false พร้อมชื่อคนถือ (ไม่ใช่ error
    เพราะยังเปิดดูได้ปกติ) หน้าเว็บวนขอใหม่เรื่อย ๆ พอคนแรกออกก็ได้สิทธิ์ต่อเอง
    """
    me = _me(current)
    if not me:
        raise HTTPException(status_code=400, detail="Missing username in token")

    async def _try_take() -> dict | None:
        now = datetime.now(timezone.utc)
        expires = now + timedelta(seconds=PM_LOCK_TTL_SECONDS)
        res = await coll.update_one(
            {
                **doc_filter,
                # ยังไม่มีใครถือ / เป็นของเราเอง / ของคนอื่นแต่หมดอายุแล้ว → ยึดได้
                "$or": [
                    {field: {"$exists": False}},
                    {field: None},
                    {f"{field}.by": me},
                    {f"{field}.expires_at": {"$lte": now}},
                ],
            },
            {"$set": {field: {"by": me, "at": now, "expires_at": expires}}},
        )
        if not res.matched_count:
            return None
        return {"ok": True, "held_by_me": True, "locked_by": me,
                "expires_at": expires.isoformat(), "ttl": PM_LOCK_TTL_SECONDS}

    taken = await _try_take()
    if taken:
        return taken
    doc = await coll.find_one(doc_filter, {field: 1})
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")
    holder = holder_of(doc, field)
    if not holder:
        # หมดอายุ/ถูกปล่อยระหว่างสองคำสั่ง — ลองยึดอีกรอบเดียวพอ
        taken = await _try_take()
        if taken:
            return taken
        doc = await coll.find_one(doc_filter, {field: 1})
        holder = holder_of(doc, field)
    return {"ok": True, "held_by_me": _same(holder, me), "locked_by": holder, "ttl": PM_LOCK_TTL_SECONDS}


async def release(coll, doc_filter: dict, field: str, current: UserClaims) -> dict:
    """ปล่อยสิทธิ์ — ได้เฉพาะล็อกของตัวเอง (กันแท็บค้างไปปลดล็อกของคนอื่นตอนปิด)"""
    await coll.update_one({**doc_filter, f"{field}.by": _me(current)}, {"$unset": {field: ""}})
    return {"ok": True}


async def assert_free(coll, doc_filter: dict, field: str, current: UserClaims, what: str) -> None:
    """
    กันบันทึกทับ — คนอื่นถือล็อกอยู่ ห้ามเขียน (หน้าเว็บสลับเป็นดูอย่างเดียวให้แล้ว
    แต่แท็บที่เปิดค้างไว้ก่อนหน้ายังยิง API ได้อยู่)
    """
    doc = await coll.find_one(doc_filter, {field: 1})
    holder = holder_of(doc, field)
    if holder and not _same(holder, _me(current)):
        raise HTTPException(
            status_code=409,
            detail=f"{what}กำลังถูกแก้ไขโดย {holder} — รอให้ปิดฟอร์มก่อนถึงจะบันทึกได้",
        )
