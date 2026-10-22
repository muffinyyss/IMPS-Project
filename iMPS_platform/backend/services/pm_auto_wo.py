"""
services/pm_auto_wo.py
======================
ปิดรับใบงาน PM จาก Maximo แล้วให้ iMPS ออกใบงาน PM เอง (ตัดสินใจ 2026-10-22)

สวิตช์เดียวทั้งระบบ (admin เปิด/ปิดที่หน้า PM List) เก็บที่ iMPS.system_settings {_id: "pm_wo_source"}
  maximo_intake_closed = true
    - POST /maximo/pm/open (IN06) ตอบ 423 กลับไปหา Maximo ไม่สร้างใบงาน
      ของที่ยิงมาจดไว้ที่ iMPS.maximo_pm_open_rejected (ดูย้อนหลังได้)
    - POST /pm-maximo/sync (pull) ตอบ 423 เหมือนกัน
    - loop ใน main.py ออกใบงานของเดือนปัจจุบันให้เอง (run_forever)
  maximo_intake_closed = false → รับจาก Maximo ตามเดิม ระบบหยุดออกใบเอง
  ใบงาน Maximo ที่รับไว้ก่อนปิดรับ ยังส่งปิดงาน (IN03/IN09/IN02) เข้า Maximo ตามปกติ

รอบ PM ฟิกตามวัน commissioning ของตู้ชาร์จ (ไม่เลื่อนตามวันที่ทำ/ปิดใบจริง)
  วันครบรอบ = commissioningDate + 6, 12, 18 … เดือน (PM_AUTO_WO_INTERVAL_MONTHS)
  ออกใบในเดือนที่ถึงกำหนด (เวลาไทย) — ไม่ย้อนออกของเดือนที่ผ่านไปแล้ว
  ตู้ที่ครบรอบเดือนเดียวกันในสถานีเดียวกัน = ใบงานเดียว (pm_date = วันครบรอบที่เร็วที่สุด)
  อุปกรณ์ระดับสถานี (Station/MDB/CCB/CB_BOX) ไปกับรอบของตู้ที่ commissioning เร็วที่สุดในสถานี
  — ทั้งหมดเป็นแค่ค่าติ๊กตั้งต้นในหน้าวางแผน planner แก้ได้ตามปกติ
  ตู้ที่ is_active=false / ไม่มีวัน commissioning / ไม่มี SN ไม่ถูกนับ (preview บอกจำนวน)

ใบที่ออก เก็บใน iMPS.maximo_pm_open เหมือนใบที่ planner เปิดเอง
  origin = imps-manual → ไม่ยิงอะไรเข้า Maximo (pm_maximo_out ข้ามใบ manual อยู่แล้ว)
  สถานะ OPEN, planning_status = pending, selected_equipment = [] → planner วางแผนเหมือนใบ IN06
  (ยังไม่มี planner_company → vendor ยังไม่เห็นจนกว่าต้นทางวางแผน, ช่างยังเริ่ม PM ไม่ได้)
  + auto_generated / auto_key / auto_cycle / auto_due[] / auto_due_equipment[]
    auto_due_equipment ถูกส่งเป็น selected_equipment ตั้งต้นของหน้าวางแผน (pm_equipment_choices)

กันออกซ้ำ
  - iMPS.pm_auto_wo_keys {_id: "<station_id>:<YYYY-MM>"} จองก่อนสร้าง — ลบใบทิ้งแล้วก็ไม่ออกซ้ำ
  - ข้ามสถานีที่มีใบงาน PM (ทุกที่มา) ที่ pm_date อยู่ในเดือนนั้นแล้ว (เช่น Maximo เปิดมาก่อนปิดรับ)

env
  PM_MAXIMO_INTAKE_CLOSED   ค่าตั้งต้นตอนยังไม่เคยกดสวิตช์ (false)
  PM_AUTO_WO_INTERVAL_MONTHS (6)
  PM_AUTO_WO_CHECK_MINUTES  (60, ≤0 = ไม่รัน loop — ยังกด "ออกใบงานตอนนี้" ได้)
"""
from __future__ import annotations

import asyncio
import calendar
import logging
import os
import re
import time
from datetime import date, datetime, timezone
from typing import Any, Iterable, Optional
from zoneinfo import ZoneInfo

log = logging.getLogger("pm_auto_wo")

TH_TZ = ZoneInfo("Asia/Bangkok")
SETTINGS_ID = "pm_wo_source"
INTERVAL_MONTHS = max(int(os.getenv("PM_AUTO_WO_INTERVAL_MONTHS", "6") or 6), 1)
CHECK_MINUTES = float(os.getenv("PM_AUTO_WO_CHECK_MINUTES", "60") or 0)
DEFAULT_CLOSED = os.getenv("PM_MAXIMO_INTAKE_CLOSED", "false").strip().lower() in ("1", "true", "yes")
SYSTEM_USER = "system"
FIXED_TYPES = ("station", "mdb", "ccb", "cbbox")

_CACHE_TTL_S = 15.0
_cache: dict[str, Any] = {"at": 0.0, "doc": None}


# ══════════════════════════════════════════════════════════════════
# ส่วนคำนวณล้วน ๆ (ไม่แตะ DB) — test_pm_auto_wo.py ทดสอบตรงนี้
# ══════════════════════════════════════════════════════════════════
def parse_commissioning(value: Any) -> Optional[date]:
    """วัน commissioning ของตู้ → date (รับ ISO, ISO datetime, dd/mm/yyyy, ปี พ.ศ.) ไม่รู้จัก = None"""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        dt = value if value.tzinfo is None else value.astimezone(TH_TZ)
        return dt.date()
    if isinstance(value, date):
        return value
    s = str(value).strip()
    if not s or s == "-":
        return None
    d: Optional[date] = None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        # เก็บเป็น UTC (เช่น 2024-03-14T17:00:00Z) = วันที่ 15 เวลาไทย
        d = (dt.astimezone(TH_TZ) if dt.tzinfo else dt).date()
    except ValueError:
        m = re.match(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})", s)
        if m:
            try:
                d = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
            except ValueError:
                d = None
        else:
            m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
            if m:
                try:
                    d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
                except ValueError:
                    d = None
    if d and d.year > 2400:  # กรอกเป็น พ.ศ.
        try:
            d = d.replace(year=d.year - 543)
        except ValueError:  # 29 ก.พ. ของปีที่ไม่ใช่ปีอธิกสุรทิน
            d = d.replace(year=d.year - 543, day=28)
    return d


def month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def parse_month(value: Optional[str], today: Optional[date] = None) -> tuple[int, int]:
    """'2026-10' → (2026, 10); ว่าง = เดือนปัจจุบันตามเวลาไทย"""
    if not value:
        t = today or datetime.now(TH_TZ).date()
        return t.year, t.month
    m = re.match(r"^\s*(\d{4})-(\d{1,2})\s*$", str(value))
    if not m or not (1 <= int(m.group(2)) <= 12):
        raise ValueError("month ต้องเป็นรูปแบบ YYYY-MM")
    return int(m.group(1)), int(m.group(2))


def due_in_month(
    commissioned: date, year: int, month: int, interval: int = INTERVAL_MONTHS
) -> Optional[tuple[int, date]]:
    """ตู้ที่ commissioning วันนี้ ครบรอบ PM ในเดือน year-month ไหม → (รอบที่, วันครบรอบ) / None

    รอบฟิก: เดือนที่ +interval, +2×interval … นับจากเดือน commissioning (เดือนที่ commissioning เองไม่นับ)
    วันที่ที่ไม่มีในเดือนนั้น (31 → ก.พ.) ใช้วันสุดท้ายของเดือน
    """
    diff = (year * 12 + month) - (commissioned.year * 12 + commissioned.month)
    if diff <= 0 or diff % interval:
        return None
    last = calendar.monthrange(year, month)[1]
    return diff // interval, date(year, month, min(commissioned.day, last))


def plan_month(
    chargers: Iterable[dict],
    year: int,
    month: int,
    interval: int = INTERVAL_MONTHS,
    labels: Optional[dict[tuple[str, str], str]] = None,
) -> dict:
    """จัดตู้ที่ครบรอบในเดือนนี้เป็นใบงานรายสถานี (ยังไม่แตะ DB)

    chargers: เอกสารตู้จาก iMPS.charger (ใช้ station_id, SN, chargerNo, commissioningDate, is_active)
    คืน {"stations": [{station_id, pm_date, chargers[], include_fixed, equipment[]}], "missing": [...], "inactive": n}
    """
    labels = labels or {}
    by_station: dict[str, list[dict]] = {}
    missing: list[dict] = []
    inactive = 0
    for c in chargers:
        sid = str(c.get("station_id") or "").strip()
        sn = str(c.get("SN") or "").strip()
        if not sid or not sn or sn == "-":
            continue
        if c.get("is_active") is False:
            inactive += 1
            continue
        comm = parse_commissioning(c.get("commissioningDate"))
        if not comm:
            missing.append({"station_id": sid, "sn": sn, "value": c.get("commissioningDate")})
            continue
        by_station.setdefault(sid, []).append({**c, "_sid": sid, "_sn": sn, "_comm": comm})

    out: list[dict] = []
    for sid in sorted(by_station):
        rows = by_station[sid]
        # ตู้ที่ commissioning เร็วที่สุด = รอบของอุปกรณ์ระดับสถานี
        anchor = min(rows, key=lambda r: (r["_comm"], r["_sn"]))
        due: list[dict] = []
        for r in sorted(rows, key=lambda r: (r.get("chargerNo") or 0, r["_sn"])):
            hit = due_in_month(r["_comm"], year, month, interval)
            if not hit:
                continue
            cycle, due_date = hit
            due.append({
                "sn": r["_sn"],
                "label": labels.get((sid, r["_sn"])) or f"Charger {r.get('chargerNo') or ''}".strip(),
                "location": (str(r.get("maximo_location") or "").strip() or None),
                "commissioning_date": r["_comm"].isoformat(),
                "due_date": due_date.isoformat(),
                "cycle": cycle,
            })
        if not due:
            continue
        include_fixed = any(d["sn"] == anchor["_sn"] for d in due)
        equipment = [
            {"type": "charger", "sn": d["sn"], "label": d["label"], **({"location": d["location"]} if d["location"] else {})}
            for d in due
        ] + ([{"type": t} for t in FIXED_TYPES] if include_fixed else [])
        out.append({
            "station_id": sid,
            "pm_date": min(d["due_date"] for d in due),
            "chargers": due,
            "include_fixed": include_fixed,
            "equipment": equipment,
        })
    return {"stations": out, "missing": missing, "inactive": inactive}


# ══════════════════════════════════════════════════════════════════
# สวิตช์ปิดรับ
# ══════════════════════════════════════════════════════════════════
def _settings_coll():
    from config import client
    return client["iMPS"]["system_settings"]


def _keys_coll():
    from config import client
    return client["iMPS"]["pm_auto_wo_keys"]


def _rejected_coll():
    from config import client
    return client["iMPS"]["maximo_pm_open_rejected"]


async def get_settings(fresh: bool = False) -> dict:
    now = time.monotonic()
    if not fresh and _cache["doc"] is not None and now - _cache["at"] < _CACHE_TTL_S:
        return _cache["doc"]
    doc = await _settings_coll().find_one({"_id": SETTINGS_ID}) or {}
    if "maximo_intake_closed" not in doc:
        doc = {**doc, "maximo_intake_closed": DEFAULT_CLOSED}
    _cache.update(at=now, doc=doc)
    return doc


async def intake_closed() -> bool:
    """ปิดรับใบงาน PM จาก Maximo อยู่หรือไม่ — อ่านไม่ได้ (DB ล่ม) = ใช้ค่าตั้งต้นจาก env"""
    try:
        return bool((await get_settings()).get("maximo_intake_closed"))
    except Exception as e:
        log.warning(f"  ⚠️ อ่านสวิตช์ปิดรับใบงาน Maximo ไม่ได้ ใช้ค่าตั้งต้น ({DEFAULT_CLOSED}): {e}")
        return DEFAULT_CLOSED


async def set_intake_closed(closed: bool, who: str) -> dict:
    now = datetime.now(timezone.utc)
    await _settings_coll().update_one(
        {"_id": SETTINGS_ID},
        {
            "$set": {"maximo_intake_closed": bool(closed), "changed_by": who, "changed_at": now},
            "$push": {"history": {"$each": [{"closed": bool(closed), "by": who, "at": now}], "$slice": -50}},
        },
        upsert=True,
    )
    _cache.update(at=0.0, doc=None)
    log.info(f"  🔀 ใบงาน PM: {'ปิดรับจาก Maximo — iMPS ออกใบเอง' if closed else 'กลับมารับจาก Maximo'} โดย {who}")
    return await get_settings(fresh=True)


async def record_rejected(inbound: dict) -> None:
    """จดของที่ Maximo ยิงมาตอนปิดรับ — พังก็ไม่เป็นไร (ตอบ Maximo ไปแล้วว่าไม่รับ)"""
    try:
        await _rejected_coll().insert_one({**inbound, "at": datetime.now(timezone.utc)})
    except Exception as e:
        log.warning(f"  ⚠️ จด IN06 ที่ปฏิเสธไม่สำเร็จ: {e}")


def serialize_settings(doc: dict) -> dict:
    def _iso(v):
        return v.isoformat() if isinstance(v, datetime) else v

    last = doc.get("last_run") or {}
    return {
        "maximo_intake_closed": bool(doc.get("maximo_intake_closed")),
        "auto_generate": bool(doc.get("maximo_intake_closed")),
        "changed_by": doc.get("changed_by"),
        "changed_at": _iso(doc.get("changed_at")),
        "interval_months": INTERVAL_MONTHS,
        "check_minutes": CHECK_MINUTES,
        "last_run": {**last, "at": _iso(last.get("at"))} if last else None,
    }


# ══════════════════════════════════════════════════════════════════
# ออกใบงาน
# ══════════════════════════════════════════════════════════════════
def _load_chargers(station_ids: Optional[list[str]] = None) -> list[dict]:
    from config import charger_collection
    q: dict = {"station_id": {"$in": station_ids}} if station_ids else {}
    return list(charger_collection.find(
        q,
        {"_id": 0, "station_id": 1, "SN": 1, "chargerNo": 1, "commissioningDate": 1,
         "is_active": 1, "maximo_location": 1},
    ))


def _load_stations(station_ids: list[str]) -> dict[str, dict]:
    from config import station_collection
    if not station_ids:
        return {}
    docs = station_collection.find(
        {"station_id": {"$in": station_ids}},
        {"_id": 0, "station_id": 1, "station_name": 1, "maximo_location": 1, "company": 1},
    )
    return {str(d.get("station_id")): d for d in docs}


async def _existing_in_month(station_id: str, mkey: str) -> Optional[str]:
    """ใบงาน PM ของสถานีนี้ที่ pm_date อยู่ในเดือนนั้นแล้ว (ทุกที่มา) → wonum"""
    from routers.pm_maximo import _open_coll
    doc = await _open_coll().find_one(
        {"station_id": station_id, "pm_date": {"$regex": f"^{re.escape(mkey)}"}},
        {"wonum": 1},
    )
    return str(doc.get("wonum") or "-") if doc else None


def _describe(station: dict, sid: str, plan: dict) -> str:
    names = ", ".join(c["label"] or c["sn"] for c in plan["chargers"])
    fixed = " + Station/MDB/CCB/CB_BOX" if plan["include_fixed"] else ""
    return f"PM ตามรอบ {INTERVAL_MONTHS} เดือน (commissioning) — {station.get('station_name') or sid}: {names}{fixed}"


async def preview_month(year: int, month: int, station_ids: Optional[list[str]] = None) -> dict:
    from routers.pm_maximo import _charger_no_labels
    chargers = _load_chargers(station_ids)
    labels = _charger_no_labels({str(c.get("station_id") or "") for c in chargers})
    plan = plan_month(chargers, year, month, labels=labels)
    stations = _load_stations([p["station_id"] for p in plan["stations"]])
    mkey = month_key(year, month)
    keys = {
        d["_id"]: d
        async for d in _keys_coll().find(
            {"_id": {"$in": [f"{p['station_id']}:{mkey}" for p in plan["stations"]]}}
        )
    }
    for p in plan["stations"]:
        st = stations.get(p["station_id"]) or {}
        p["station_name"] = st.get("station_name") or p["station_id"]
        claimed = keys.get(f"{p['station_id']}:{mkey}")
        existing = None if claimed else await _existing_in_month(p["station_id"], mkey)
        p["wonum"] = (claimed or {}).get("wonum") or existing
        p["state"] = "generated" if claimed else ("exists" if existing else "pending")
    return {"month": mkey, "interval_months": INTERVAL_MONTHS, **plan}


async def generate_for_month(
    year: Optional[int] = None,
    month: Optional[int] = None,
    *,
    who: str = SYSTEM_USER,
    station_ids: Optional[list[str]] = None,
) -> dict:
    """ออกใบงานของเดือนนั้น (ค่าตั้งต้น = เดือนปัจจุบันเวลาไทย) — เรียกซ้ำได้ ไม่ออกซ้ำ"""
    from pymongo.errors import DuplicateKeyError
    from routers.pm_maximo import MANUAL_WO_ORIGIN, _next_manual_wonum, _open_coll

    if year is None or month is None:
        year, month = parse_month(None)
    mkey = month_key(year, month)
    preview = await preview_month(year, month, station_ids)
    stations = _load_stations([p["station_id"] for p in preview["stations"]])

    created: list[dict] = []
    skipped: list[dict] = []
    errors: list[dict] = []
    for p in preview["stations"]:
        sid = p["station_id"]
        if p["state"] != "pending":
            skipped.append({"station_id": sid, "reason": p["state"], "wonum": p.get("wonum")})
            continue
        key = f"{sid}:{mkey}"
        now = datetime.now(timezone.utc)
        try:
            await _keys_coll().insert_one({"_id": key, "station_id": sid, "month": mkey, "at": now, "by": who})
        except DuplicateKeyError:
            skipped.append({"station_id": sid, "reason": "generated"})
            continue

        st = stations.get(sid) or {}
        doc: dict[str, Any] = {
            "location": str(st.get("maximo_location") or "").strip() or sid,
            "description": _describe(st, sid, p),
            "pm_date": p["pm_date"],
            "status": "OPEN",
            "company": (str(st.get("company") or "").strip() or None),
            "station_id": sid,
            "sn": None,
            "origin": MANUAL_WO_ORIGIN,
            "created_by": who,
            "receivedAt": now,
            "updatedAt": now,
            # ยังไม่วางแผน — planner ต้นทางวางแผนเหมือนใบที่ Maximo เปิดมา
            "selected_equipment": [],
            "planning_status": "pending",
            "assignees": [],
            "auto_generated": True,
            "auto_key": key,
            "auto_cycle": mkey,
            "auto_due": p["chargers"],
            "auto_due_equipment": p["equipment"],
        }
        wonum = None
        for _ in range(5):
            candidate = await _next_manual_wonum()
            if await _open_coll().find_one({"wonum": candidate}, {"_id": 1}):
                continue
            try:
                await _open_coll().insert_one({**doc, "wonum": candidate})
                wonum = candidate
                break
            except Exception as e:
                log.warning(f"  ⚠️ ออกใบงาน PM อัตโนมัติ {candidate} ไม่สำเร็จ ลองเลขถัดไป: {e}")
        if not wonum:
            await _keys_coll().delete_one({"_id": key})
            errors.append({"station_id": sid, "reason": "ออกเลขใบงานไม่สำเร็จ"})
            continue
        await _keys_coll().update_one({"_id": key}, {"$set": {"wonum": wonum}})
        created.append({"station_id": sid, "wonum": wonum, "pm_date": p["pm_date"],
                        "chargers": [c["sn"] for c in p["chargers"]]})
        log.info(f"  ✅ ออกใบงาน PM อัตโนมัติ {wonum} ({sid}, รอบ {mkey}, {len(p['chargers'])} ตู้) โดย {who}")

    result = {
        "month": mkey,
        "created": created,
        "skipped": skipped,
        "errors": errors,
        "missing_commissioning": len(preview["missing"]),
        "inactive": preview["inactive"],
    }
    try:
        await _settings_coll().update_one(
            {"_id": SETTINGS_ID},
            {"$set": {"last_run": {
                "at": datetime.now(timezone.utc), "by": who, "month": mkey,
                "created": len(created), "skipped": len(skipped), "errors": len(errors),
                "wonums": [c["wonum"] for c in created][:50],
            }}},
            upsert=True,
        )
        _cache.update(at=0.0, doc=None)
    except Exception as e:
        log.warning(f"  ⚠️ จดผลการออกใบงานอัตโนมัติไม่สำเร็จ: {e}")
    return result


async def ensure_indexes() -> None:
    try:
        from routers.pm_maximo import _open_coll
        await _open_coll().create_index("auto_key", sparse=True)
    except Exception:
        pass


async def run_forever() -> None:
    """loop ใน lifespan — ปิดรับจาก Maximo อยู่ = ออกใบของเดือนนี้ทุก CHECK_MINUTES"""
    if CHECK_MINUTES <= 0:
        log.info("  · ออกใบงาน PM อัตโนมัติ: ปิด loop (PM_AUTO_WO_CHECK_MINUTES ≤ 0)")
        return
    await ensure_indexes()
    await asyncio.sleep(60)  # ให้ระบบขึ้นครบก่อน
    while True:
        try:
            if await intake_closed():
                res = await generate_for_month()
                if res["created"] or res["errors"]:
                    log.info(f"  📅 ออกใบงาน PM อัตโนมัติ {res['month']}: "
                             f"สร้าง {len(res['created'])}, ข้าม {len(res['skipped'])}, ผิดพลาด {len(res['errors'])}")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.warning(f"  ⚠️ รอบออกใบงาน PM อัตโนมัติล้ม: {e}")
        await asyncio.sleep(CHECK_MINUTES * 60)
