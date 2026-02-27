"""
Auto CM Watcher — ฝังใน FastAPI
================================
Triggers:
  1) Edge Box offline เกิน 5 นาที  (stationsOnOff DB)
  2) Router temp เกิน 75°C          (monitorCBM DB)
  3) Charger Gun temp >= 200°C       (monitorCBM DB)
  4) PE CUT >= 5 ครั้ง/วัน/หัว หรือ เกิดติดต่อกัน 3 วัน/หัว (FaultStatus DB)
  5) IMD SELF CHECK >= 5 ครั้ง/วัน/หัว หรือ เกิดติดต่อกัน 3 วัน/หัว (FaultStatus DB)
  *) เพิ่ม fault trigger ใหม่ได้ง่ายใน FAULT_TRIGGERS list
"""

import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from config import client, CBM_DB, charger_onoff, CMReportDB, th_tz

from services.maximo import create_sr as maximo_create_sr

from routers.cmreport import (
    get_next_cm_issue_id,
    get_next_cm_doc_name,
    get_cmreport_collection_for,
    _ensure_cm_indexes,
)

# ══════════════════════════════════════════════════════════════════
# CONFIG
# ══════════════════════════════════════════════════════════════════
OFFLINE_THRESHOLD_MIN = int(os.getenv("OFFLINE_THRESHOLD", "5"))
ROUTER_TEMP_THRESHOLD = float(os.getenv("ROUTER_TEMP_THRESHOLD", "75"))
GUN_TEMP_THRESHOLD = float(os.getenv("GUN_TEMP_THRESHOLD", "200"))
CHECK_INTERVAL_SEC = int(os.getenv("CM_CHECK_INTERVAL", "60"))

# ── Trigger 4+: Fault-based (PE CUT, IMD SELF CHECK, ...) ──
PE_CUT_DAILY_THRESHOLD = int(os.getenv("PE_CUT_DAILY_THRESHOLD", "5"))
PE_CUT_CONSEC_DAYS = int(os.getenv("PE_CUT_CONSEC_DAYS", "3"))

# ตาราง fault triggers — เพิ่ม fault ใหม่ได้ง่าย
FAULT_TRIGGERS = [
    {
        "name": "PE CUT",
        "regex": "PE CUT",
        "trigger_prefix": "pe_cut",
        "daily_threshold": PE_CUT_DAILY_THRESHOLD,
        "consec_days": PE_CUT_CONSEC_DAYS,
        "severity_daily": "Critical",
        "severity_consec": "High",
    },
    {
        "name": "IMD SELF CHECK",
        "regex": "IMD SELF CHECK",
        "trigger_prefix": "imd_self_check",
        "daily_threshold": int(os.getenv("IMD_DAILY_THRESHOLD", "5")),
        "consec_days": int(os.getenv("IMD_CONSEC_DAYS", "3")),
        "severity_daily": "Critical",
        "severity_consec": "High",
    },
]

GUN_TEMP_FIELDS = {
    "charger_gun_temp_plus1":  "หัว 1 ขั้ว Plus (+)",
    "charger_gun_temp_plus2":  "หัว 2 ขั้ว Plus (+)",
    "charger_gan_temp_minus1": "หัว 1 ขั้ว Minus (−)",
    "charger_gan_temp_minus2": "หัว 2 ขั้ว Minus (−)",
}

# ══════════════════════════════════════════════════════════════════
# LOGGING
# ══════════════════════════════════════════════════════════════════
log = logging.getLogger("auto_cm_watcher")
if not log.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(name)s] %(message)s", "%H:%M:%S"))
    log.addHandler(handler)
    log.setLevel(logging.INFO)

# ══════════════════════════════════════════════════════════════════
# STATE
# ══════════════════════════════════════════════════════════════════
_task = None
_sn_cache: dict[str, dict | None] = {}

_imps = client["iMPS"]
_charger_col = _imps["charger"]
_stations_col = _imps["stations"]

# ── FaultStatus DB ──
_fault_db = client["FaultStatus"]


# ══════════════════════════════════════════════════════════════════
# SHARED HELPERS
# ══════════════════════════════════════════════════════════════════
def _parse_ts(ts_str: str) -> datetime | None:
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError, TypeError):
        return None

def _to_thai_str(ts_str: str) -> str:
    """แปลง ISO timestamp → เวลาไทย สำหรับแสดงผล"""
    dt = _parse_ts(ts_str)
    if not dt:
        return ts_str or "-"
    return dt.astimezone(th_tz).strftime("%Y-%m-%d %H:%M:%S")

async def _lookup_station(sn: str) -> dict | None:
    if sn in _sn_cache:
        return _sn_cache[sn]

    doc = await _charger_col.find_one({"$or": [{"SN": sn}, {"sn": sn}]})

    if not doc or not doc.get("station_id"):
        _sn_cache[sn] = None
        return None
    
    charger_maximo = doc.get("maximo_location", "")

    station_doc = await _stations_col.find_one({"station_id": doc.get("station_id", "")})
    station_maximo = station_doc.get("maximo_location", "") if station_doc else ""

    info = {
        "station_id": doc.get("station_id", ""),
        "maximo_location": charger_maximo or station_maximo,  # ← charger > station
        "charger_name": doc.get("charger_name", ""),
        "charger_no": doc.get("chargerNo") or doc.get("charger_no", ""),
        "chargebox_id": doc.get("chargeBoxID", ""),
        "sn": sn,
    }
    _sn_cache[sn] = info
    return info


def _extract_sn_from_fault_collection(col_name: str) -> str:
    """
    FaultStatus collection name → SN ที่ใช้ lookup charger
    เช่น F1500124001 → ตัดตัว F ข้างหน้า → 1500124001
    ถ้า format ไม่ตรง ก็ return ตัวเดิม
    """
    if col_name.startswith("F") and len(col_name) > 1:
        return col_name[1:]
    return col_name


async def _create_auto_cm(
    station_id: str, sn: str, info: dict,
    trigger_key: str, severity: str,
    problem_text: str, remarks_text: str,
) -> bool:
    """Shared: สร้าง CM report สำหรับทุก trigger type"""
    faulty = f"charger_{info.get('charger_no', '1')}"
    found_date = datetime.now(th_tz).date().isoformat()

    issue_id = await get_next_cm_issue_id(station_id, found_date)
    doc_name = await get_next_cm_doc_name(station_id, found_date)

    station_doc = await _stations_col.find_one({"station_id": station_id})
    location = station_doc.get("station_name", station_id) if station_doc else station_id

    coll = get_cmreport_collection_for(station_id)
    await _ensure_cm_indexes(coll)

    cm_doc = {
        "issue_id": issue_id,
        "doc_name": doc_name,
        "station_id": station_id,
        "found_date": found_date,
        "faulty_equipment": faulty,
        "severity": severity,
        "status": "Open",
        "problem_details": problem_text,
        "remarks_open": remarks_text,
        "location": location,
        "reported_by": "System (Auto CM)",
        "auto_generated": True,
        "auto_trigger": trigger_key,
        "charger_sn": sn,
        "photos_problem": {},
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    try:
        result = await coll.insert_one(cm_doc)

        cm_doc["maximo_ticket_id"] = None
        
        maximo_loc = info.get("maximo_location", "")
        if maximo_loc:
            desc = f"[iMPS Auto CM] {location} / {info.get('charger_name', 'Unknown')} (SN: {sn}) / {trigger_key}"
            sr = await maximo_create_sr(
                description=desc[:250],
                location=maximo_loc,
                severity=severity,
            )
            if sr:
                ticket_id = sr.get("ticketid")
                await coll.update_one(
                    {"_id": result.inserted_id},
                    {"$set": {"maximo_ticket_id": ticket_id}}
                )
                log.info(f"🎫 Maximo SR linked: {ticket_id}")

        log.info(
            f"  ✅ CM created → id: {result.inserted_id}, "
            f"issue_id: {issue_id}, doc_name: {doc_name}"
        )
        return True
    except Exception as e:
        log.error(f"  ❌ Insert failed: {e}")
        return False


async def _has_open_auto_cm(station_id: str, sn: str, trigger_key: str) -> bool:
    """Shared: เช็ค duplicate สำหรับทุก trigger type"""
    col = CMReportDB[station_id]
    existing = await col.find_one({
        "auto_trigger": trigger_key,
        "status": {"$in": ["Open", "In Progress"]},
        "$or": [
            {"charger_sn": sn},
            {"problem_details": {"$regex": sn, "$options": "i"}},
        ],
    })
    return existing is not None


# ══════════════════════════════════════════════════════════════════
# ▶ TRIGGER 1: Edge Box offline
# ══════════════════════════════════════════════════════════════════
async def _get_all_edgebox_sn() -> list[str]:
    cols = await charger_onoff.list_collection_names()
    return [c for c in cols if not c.startswith("system.")]


async def _get_latest_edgebox_doc(sn: str) -> dict | None:
    return await charger_onoff[sn].find_one(sort=[("payload.timestamp", -1)])


def _is_edgebox_offline_over_threshold(doc: dict) -> tuple[bool, str]:
    payload = doc.get("payload", {})
    if payload.get("value") != 0:
        return False, ""
    ts_str = payload.get("timestamp", "")
    ts = _parse_ts(ts_str)
    if not ts:
        return False, ""
    if datetime.now(timezone.utc) - ts >= timedelta(minutes=OFFLINE_THRESHOLD_MIN):
        return True, ts_str
    return False, ""


async def _check_all_edgebox():
    sn_list = await _get_all_edgebox_sn()
    log.info(f"📡 [Edge Box] Checking {len(sn_list)} device(s)...")
    created = 0

    for sn in sn_list:
        doc = await _get_latest_edgebox_doc(sn)
        if not doc:
            continue

        if doc.get("payload", {}).get("value") == 1:
            continue

        is_over, offline_since = _is_edgebox_offline_over_threshold(doc)
        if not is_over:
            continue

        log.info(f"  🔴 Edge Box {sn} offline > {OFFLINE_THRESHOLD_MIN}m since {_to_thai_str(offline_since)}")

        info = await _lookup_station(sn)
        if not info:
            continue

        station_id = info["station_id"]

        if await _has_open_auto_cm(station_id, sn, "edgebox_offline"):
            log.info(f"  📋 Edge Box {sn} → CM already open, skip")
            continue

        charger_label = info.get("charger_name") or f"Charger {info.get('charger_no', sn)}"
        problem = (
            f"[Auto CM] ตู้ชาร์จ {charger_label} (SN: {sn}) "
            f"Edge Box offline เกิน {OFFLINE_THRESHOLD_MIN} นาที\n"
            f"Edge Box offline since: {_to_thai_str(offline_since)}\n"
            f"ระบบตรวจพบและสร้าง CM report อัตโนมัติ"
        )
        remarks = f"Auto-generated: Edge Box offline > {OFFLINE_THRESHOLD_MIN} min"

        log.info(f"  📝 Edge Box {sn} → Creating CM for station {station_id}...")
        if await _create_auto_cm(station_id, sn, info, "edgebox_offline", "Critical", problem, remarks):
            created += 1

    log.info(f"  ✅ [Edge Box] Done — created {created} new CM report(s)")


async def _auto_note_edgebox_online():
    for sn in await _get_all_edgebox_sn():
        info = await _lookup_station(sn)
        if not info:
            continue

        station_id = info["station_id"]
        col = CMReportDB[station_id]

        open_cms = await col.find({
            "auto_trigger": "edgebox_offline",
            "status": "Open",
            "$or": [
                {"charger_sn": sn},
                {"problem_details": {"$regex": sn, "$options": "i"}},
            ],
        }).to_list(length=50)

        if not open_cms:
            continue

        doc = await _get_latest_edgebox_doc(sn)
        if not doc or doc.get("payload", {}).get("value") != 1:
            continue

        online_ts = doc.get("payload", {}).get("timestamp", "")

        for cm in open_cms:
            await col.update_one(
                {"_id": cm["_id"]},
                {
                    "$set": {"updated_at": datetime.now(timezone.utc)},
                    "$push": {
                        "auto_notes": {
                            "text": f"Edge Box {sn} กลับมา online แล้ว ({_to_thai_str(online_ts)})",
                            "at": datetime.now(timezone.utc),
                        }
                    },
                },
            )
            log.info(f"  📝 Edge Box {sn} back online → noted CM {cm['_id']}")


# ══════════════════════════════════════════════════════════════════
# ▶ TRIGGER 2: Router temp > 75°C
# ══════════════════════════════════════════════════════════════════
async def _get_all_cbm_sn() -> list[str]:
    cols = await CBM_DB.list_collection_names()
    return [c for c in cols if not c.startswith("system.")]


async def _get_latest_cbm_doc(sn: str) -> dict | None:
    return await CBM_DB[sn].find_one(sort=[("timestamp", -1)])


def _is_router_temp_over_threshold(doc: dict) -> tuple[bool, float, str]:
    """Returns (is_over, temp_value, timestamp_str)"""
    temp = doc.get("router_temp")
    if temp is None:
        return False, 0, ""

    try:
        temp_val = float(temp)
    except (ValueError, TypeError):
        return False, 0, ""

    if temp_val <= ROUTER_TEMP_THRESHOLD:
        return False, temp_val, ""

    ts_str = doc.get("timestamp", "")
    return True, temp_val, ts_str


async def _check_all_router_temp():
    sn_list = await _get_all_cbm_sn()
    log.info(f"🌡️  [Router Temp] Checking {len(sn_list)} device(s)...")
    created = 0

    for sn in sn_list:
        doc = await _get_latest_cbm_doc(sn)
        if not doc:
            continue

        is_over, temp_val, ts_str = _is_router_temp_over_threshold(doc)
        if not is_over:
            continue

        log.info(f"  🔥 Router {sn} temp {temp_val}°C > {ROUTER_TEMP_THRESHOLD}°C ({ts_str})")

        info = await _lookup_station(sn)
        if not info:
            continue

        station_id = info["station_id"]

        if await _has_open_auto_cm(station_id, sn, "router_temp_high"):
            log.info(f"  📋 Router {sn} → CM already open, skip")
            continue

        charger_label = info.get("charger_name") or f"Charger {info.get('charger_no', sn)}"
        problem = (
            f"[Auto CM] ตู้ชาร์จ {charger_label} (SN: {sn}) "
            f"Router temperature สูงเกินกำหนด: {temp_val}°C (threshold: {ROUTER_TEMP_THRESHOLD}°C)\n"
            f"Detected at: {_to_thai_str(ts_str)}\n"
            f"ระบบตรวจพบและสร้าง CM report อัตโนมัติ"
        )
        remarks = f"Auto-generated: Router temp {temp_val}°C > {ROUTER_TEMP_THRESHOLD}°C"

        log.info(f"  📝 Router {sn} → Creating CM for station {station_id}...")
        if await _create_auto_cm(station_id, sn, info, "router_temp_high", "High", problem, remarks):
            created += 1

    log.info(f"  ✅ [Router Temp] Done — created {created} new CM report(s)")


async def _auto_note_router_temp_normal():
    """ถ้า temp กลับมาปกติ → ใส่ note"""
    for sn in await _get_all_cbm_sn():
        info = await _lookup_station(sn)
        if not info:
            continue

        station_id = info["station_id"]
        col = CMReportDB[station_id]

        open_cms = await col.find({
            "auto_trigger": "router_temp_high",
            "status": "Open",
            "$or": [
                {"charger_sn": sn},
                {"problem_details": {"$regex": sn, "$options": "i"}},
            ],
        }).to_list(length=50)

        if not open_cms:
            continue

        doc = await _get_latest_cbm_doc(sn)
        if not doc:
            continue

        temp = doc.get("router_temp")
        try:
            temp_val = float(temp)
        except (ValueError, TypeError):
            continue

        if temp_val > ROUTER_TEMP_THRESHOLD:
            continue  # ยังสูงอยู่

        ts_str = doc.get("timestamp", "")

        for cm in open_cms:
            await col.update_one(
                {"_id": cm["_id"]},
                {
                    "$set": {"updated_at": datetime.now(timezone.utc)},
                    "$push": {
                        "auto_notes": {
                            "text": f"Router {sn} temp กลับมาปกติ ({temp_val}°C) ({_to_thai_str(ts_str)})",
                            "at": datetime.now(timezone.utc),
                        }
                    },
                },
            )
            log.info(f"  📝 Router {sn} temp normal ({temp_val}°C) → noted CM {cm['_id']}")


# ══════════════════════════════════════════════════════════════════
# ▶ TRIGGER 3: Charger Gun temp >= 200°C
# ══════════════════════════════════════════════════════════════════
def _check_gun_temp_fields(doc: dict) -> list[tuple[str, str, float]]:
    """
    เช็ค 4 fields:
      charger_gun_temp_plus1, charger_gun_temp_plus2,
      charger_gan_temp_minus1, charger_gan_temp_minus2
    Returns list of (field_name, friendly_name, temp_value) ที่ >= threshold
    """
    over_fields = []
    for field, friendly in GUN_TEMP_FIELDS.items():
        val = doc.get(field)
        if val is None:
            continue
        try:
            temp_val = float(val)
        except (ValueError, TypeError):
            continue
        if temp_val >= GUN_TEMP_THRESHOLD:
            over_fields.append((field, friendly, temp_val))
    return over_fields


async def _check_all_gun_temp():
    sn_list = await _get_all_cbm_sn()
    log.info(f"🔫 [Gun Temp] Checking {len(sn_list)} device(s)...")
    created = 0

    for sn in sn_list:
        doc = await _get_latest_cbm_doc(sn)
        if not doc:
            continue

        over_fields = _check_gun_temp_fields(doc)
        if not over_fields:
            continue

        ts_str = doc.get("timestamp", "")
        fields_detail = ", ".join(f"{friendly}: {v}°C" for _, friendly, v in over_fields)
        max_temp = max(v for _, _, v in over_fields)

        log.info(f"  🔥 Gun {sn} temp over threshold: {fields_detail} ({ts_str})")

        info = await _lookup_station(sn)
        if not info:
            continue

        station_id = info["station_id"]

        if await _has_open_auto_cm(station_id, sn, "gun_temp_high"):
            log.info(f"  📋 Gun {sn} → CM already open, skip")
            continue

        charger_label = info.get("charger_name") or f"Charger {info.get('charger_no', sn)}"
        positions = ", ".join(f"{friendly}: {v}°C" for _, friendly, v in over_fields)
        problem = (
            f"[Auto CM] ตู้ชาร์จ {charger_label} (SN: {sn}) "
            f"Charger Gun temperature สูงเกินกำหนด — {positions} "
            f"(threshold: {GUN_TEMP_THRESHOLD}°C)\n"
            f"Detected at: {_to_thai_str(ts_str)}\n"
            f"ระบบตรวจพบและสร้าง CM report อัตโนมัติ"
        )
        remarks = f"Auto-generated: Gun temp {fields_detail} >= {GUN_TEMP_THRESHOLD}°C"

        log.info(f"  📝 Gun {sn} → Creating CM for station {station_id}...")
        if await _create_auto_cm(station_id, sn, info, "gun_temp_high", "Critical", problem, remarks):
            created += 1

    log.info(f"  ✅ [Gun Temp] Done — created {created} new CM report(s)")


async def _auto_note_gun_temp_normal():
    """ถ้า gun temp กลับมาปกติทุก field → ใส่ note"""
    for sn in await _get_all_cbm_sn():
        info = await _lookup_station(sn)
        if not info:
            continue

        station_id = info["station_id"]
        col = CMReportDB[station_id]

        open_cms = await col.find({
            "auto_trigger": "gun_temp_high",
            "status": "Open",
            "$or": [
                {"charger_sn": sn},
                {"problem_details": {"$regex": sn, "$options": "i"}},
            ],
        }).to_list(length=50)

        if not open_cms:
            continue

        doc = await _get_latest_cbm_doc(sn)
        if not doc:
            continue

        # เช็คว่ายังมี field ไหนเกินอยู่ไหม
        over_fields = _check_gun_temp_fields(doc)
        if over_fields:
            continue  # ยังสูงอยู่

        # ดึงค่าปัจจุบันทุก field มาแสดงใน note
        current_vals = []
        for field, friendly in GUN_TEMP_FIELDS.items():
            val = doc.get(field)
            if val is not None:
                try:
                    current_vals.append(f"{friendly}: {float(val)}°C")
                except (ValueError, TypeError):
                    pass

        ts_str = doc.get("timestamp", "")
        vals_text = ", ".join(current_vals) if current_vals else "N/A"

        for cm in open_cms:
            await col.update_one(
                {"_id": cm["_id"]},
                {
                    "$set": {"updated_at": datetime.now(timezone.utc)},
                    "$push": {
                        "auto_notes": {
                            "text": (
                                f"Gun temp {sn} กลับมาปกติแล้ว "
                                f"({vals_text}) ({_to_thai_str(ts_str)})"
                            ),
                            "at": datetime.now(timezone.utc),
                        }
                    },
                },
            )
            log.info(f"  📝 Gun {sn} temp normal → noted CM {cm['_id']}")


# ══════════════════════════════════════════════════════════════════
# ▶ TRIGGER 4+: Generic Fault Triggers (PE CUT, IMD SELF CHECK, ...)
#   แยกนับต่อหัว — ≥N ครั้ง/วัน/หัว หรือ เกิดติดต่อกัน M วัน/หัว
# ══════════════════════════════════════════════════════════════════
import re

_HEAD_PATTERN = re.compile(r"Head\s*(\d+)", re.IGNORECASE)


async def _get_all_fault_collections() -> list[str]:
    cols = await _fault_db.list_collection_names()
    return [c for c in cols if not c.startswith("system.")]


def _extract_head_from_message(msg: str) -> str | None:
    m = _HEAD_PATTERN.search(msg)
    return m.group(1) if m else None


async def _count_fault_per_head_in_range(
    col_name: str, fault_regex: str, start_str: str, end_str: str
) -> dict[str, int]:
    """
    นับ fault (ตาม regex) แยกต่อหัว ในช่วง [start, end)
    รองรับ timestamp ทั้ง datetime และ string
    """
    col = _fault_db[col_name]
    start_dt = datetime.fromisoformat(start_str)
    end_dt = datetime.fromisoformat(end_str)

    query_base = {"message": {"$regex": fault_regex, "$options": "i"}}

    # ลอง datetime ก่อน
    docs = await col.find(
        {**query_base, "timestamp": {"$gte": start_dt, "$lt": end_dt}},
        {"message": 1},
    ).to_list(length=500)

    # fallback string comparison
    if not docs:
        docs = await col.find(
            {**query_base, "timestamp": {"$gte": start_str, "$lt": end_str}},
            {"message": 1},
        ).to_list(length=500)

    counts: dict[str, int] = {}
    for d in docs:
        head = _extract_head_from_message(d.get("message", "")) or "unknown"
        counts[head] = counts.get(head, 0) + 1
    return counts


async def _has_fault_for_head_in_range(
    col_name: str, fault_regex: str, head: str,
    start_str: str, end_str: str,
) -> bool:
    counts = await _count_fault_per_head_in_range(
        col_name, fault_regex, start_str, end_str
    )
    return counts.get(head, 0) > 0


async def _has_open_auto_cm_fault(
    station_id: str, sn: str, trigger_key: str,
) -> bool:
    col = CMReportDB[station_id]
    existing = await col.find_one({
        "auto_trigger": trigger_key,
        "status": {"$in": ["Open", "In Progress"]},
        "$or": [
            {"charger_sn": sn},
            {"problem_details": {"$regex": sn, "$options": "i"}},
        ],
    })
    return existing is not None


async def _check_all_fault_triggers():
    """
    วนทุก FAULT_TRIGGERS × ทุก collection × แยกต่อหัว
    """
    col_names = await _get_all_fault_collections()
    fault_names = ", ".join(ft["name"] for ft in FAULT_TRIGGERS)
    log.info(
        f"⚡ [Fault Triggers] Checking {len(col_names)} collection(s) "
        f"for [{fault_names}] (per-head)..."
    )
    created = 0

    now_th = datetime.now(th_tz)
    today = now_th.date()
    today_start = datetime(today.year, today.month, today.day, tzinfo=th_tz).isoformat()
    tomorrow_start = (
        datetime(today.year, today.month, today.day, tzinfo=th_tz) + timedelta(days=1)
    ).isoformat()

    for col_name in col_names:
        sn = _extract_sn_from_fault_collection(col_name)

        for ft in FAULT_TRIGGERS:
            fault_name = ft["name"]
            fault_regex = ft["regex"]
            trigger_prefix = ft["trigger_prefix"]
            daily_threshold = ft["daily_threshold"]
            consec_days_threshold = ft["consec_days"]
            severity_daily = ft["severity_daily"]
            severity_consec = ft["severity_consec"]

            # ── นับวันนี้แยกต่อหัว ──
            today_per_head = await _count_fault_per_head_in_range(
                col_name, fault_regex, today_start, tomorrow_start
            )

            if not today_per_head:
                continue  # วันนี้ไม่มี fault นี้เลย → skip

            for head in today_per_head:
                today_count = today_per_head[head]
                trigger_reason = ""
                severity = severity_consec

                # ── เงื่อนไข A: วันนี้ >= threshold ──
                if today_count >= daily_threshold:
                    trigger_reason = (
                        f"{fault_name} Head {head} เกิด {today_count} ครั้งในวันนี้ "
                        f"(threshold: {daily_threshold} ครั้ง/วัน/หัว)"
                    )
                    severity = severity_daily

                # ── เงื่อนไข B: เกิดติดต่อกัน >= N วัน ──
                if not trigger_reason:
                    consec_days = 0
                    for day_offset in range(consec_days_threshold):
                        check_date = today - timedelta(days=day_offset)
                        day_start = datetime(
                            check_date.year, check_date.month, check_date.day,
                            tzinfo=th_tz,
                        ).isoformat()
                        day_end = (
                            datetime(
                                check_date.year, check_date.month, check_date.day,
                                tzinfo=th_tz,
                            )
                            + timedelta(days=1)
                        ).isoformat()

                        if await _has_fault_for_head_in_range(
                            col_name, fault_regex, head, day_start, day_end
                        ):
                            consec_days += 1
                        else:
                            break

                    if consec_days >= consec_days_threshold:
                        trigger_reason = (
                            f"{fault_name} Head {head} เกิดติดต่อกัน {consec_days} วัน "
                            f"(threshold: {consec_days_threshold} วันติดต่อกัน)"
                        )

                if not trigger_reason:
                    continue

                log.info(f"  ⚡ {col_name} (SN:{sn}) Head {head} → {trigger_reason}")

                info = await _lookup_station(sn)
                if not info:
                    log.info(f"  ⚠️  {col_name} (SN:{sn}) → station not found, skip")
                    continue

                station_id = info["station_id"]
                trigger_key = f"{trigger_prefix}_head_{head}"

                if await _has_open_auto_cm_fault(station_id, sn, trigger_key):
                    log.info(
                        f"  📋 {fault_name} {sn} Head {head} → CM already open, skip"
                    )
                    continue

                charger_label = (
                    info.get("charger_name")
                    or f"Charger {info.get('charger_no', sn)}"
                )
                problem = (
                    f"[Auto CM] ตู้ชาร์จ {charger_label} (SN: {sn}) — Head {head}\n"
                    f"{fault_name} detected — {trigger_reason}\n"
                    f"จำนวน Head {head} วันนี้: {today_count} ครั้ง\n"
                    f"ระบบตรวจพบและสร้าง CM report อัตโนมัติ"
                )
                remarks = f"Auto-generated: Head {head} — {trigger_reason}"

                log.info(
                    f"  📝 {fault_name} {sn} Head {head} "
                    f"→ Creating CM for station {station_id}..."
                )
                if await _create_auto_cm(
                    station_id, sn, info, trigger_key, severity, problem, remarks
                ):
                    created += 1

    log.info(f"  ✅ [Fault Triggers] Done — created {created} new CM report(s)")


async def _auto_note_fault_resolved():
    """
    ถ้าวันนี้ไม่มี fault ของหัวนั้น → ใส่ note
    """
    now_th = datetime.now(th_tz)
    today = now_th.date()
    today_start = datetime(today.year, today.month, today.day, tzinfo=th_tz).isoformat()
    tomorrow_start = (
        datetime(today.year, today.month, today.day, tzinfo=th_tz) + timedelta(days=1)
    ).isoformat()

    for col_name in await _get_all_fault_collections():
        sn = _extract_sn_from_fault_collection(col_name)
        info = await _lookup_station(sn)
        if not info:
            continue

        station_id = info["station_id"]
        col = CMReportDB[station_id]

        for ft in FAULT_TRIGGERS:
            fault_name = ft["name"]
            fault_regex = ft["regex"]
            trigger_prefix = ft["trigger_prefix"]

            # หา open CM ของ fault type นี้
            open_cms = await col.find({
                "auto_trigger": {"$regex": f"^{trigger_prefix}_head_"},
                "status": "Open",
                "$or": [
                    {"charger_sn": sn},
                    {"problem_details": {"$regex": sn, "$options": "i"}},
                ],
            }).to_list(length=50)

            if not open_cms:
                continue

            # นับวันนี้แยกหัว
            today_per_head = await _count_fault_per_head_in_range(
                col_name, fault_regex, today_start, tomorrow_start
            )

            for cm in open_cms:
                trigger = cm.get("auto_trigger", "")
                head = trigger.replace(f"{trigger_prefix}_head_", "")

                if today_per_head.get(head, 0) > 0:
                    continue  # ยังเกิดอยู่

                existing_notes = cm.get("auto_notes", [])
                note_marker = (
                    f"ไม่พบ {fault_name} Head {head} วันที่ {today.isoformat()}"
                )
                if any(note_marker in n.get("text", "") for n in existing_notes):
                    continue

                await col.update_one(
                    {"_id": cm["_id"]},
                    {
                        "$set": {"updated_at": datetime.now(timezone.utc)},
                        "$push": {
                            "auto_notes": {
                                "text": (
                                    f"{note_marker} "
                                    f"สำหรับ SN: {sn} — อาการอาจหายแล้ว "
                                    f"(กรุณาตรวจสอบโดยช่าง)"
                                ),
                                "at": datetime.now(timezone.utc),
                            }
                        },
                    },
                )
                log.info(
                    f"  📝 {fault_name} {sn} Head {head} "
                    f"no occurrence today → noted CM {cm['_id']}"
                )


# ══════════════════════════════════════════════════════════════════
# MAIN LOOP — รันทุก trigger
# ══════════════════════════════════════════════════════════════════
async def _run_loop():
    log.info(
        f"🔄 Auto CM Watcher started "
        f"(every {CHECK_INTERVAL_SEC}s, "
        f"Edge Box threshold: {OFFLINE_THRESHOLD_MIN}m, "
        f"Router temp threshold: {ROUTER_TEMP_THRESHOLD}°C, "
        f"Gun temp threshold: {GUN_TEMP_THRESHOLD}°C, "
        f"PE CUT threshold: {PE_CUT_DAILY_THRESHOLD}/day or {PE_CUT_CONSEC_DAYS} consec. days, "
        f"Fault triggers: {len(FAULT_TRIGGERS)})"
    )
    await asyncio.sleep(5)

    while True:
        try:
            # Trigger 1: Edge Box offline
            await _check_all_edgebox()
            await _auto_note_edgebox_online()

            # Trigger 2: Router temp > 75°C
            await _check_all_router_temp()
            await _auto_note_router_temp_normal()

            # Trigger 3: Charger Gun temp >= 200°C
            await _check_all_gun_temp()
            await _auto_note_gun_temp_normal()

            # Trigger 4+: Fault-based (PE CUT, IMD SELF CHECK, ...)
            await _check_all_fault_triggers()
            await _auto_note_fault_resolved()

        except Exception as e:
            log.error(f"❌ Watcher error: {e}", exc_info=True)
        await asyncio.sleep(CHECK_INTERVAL_SEC)


# ══════════════════════════════════════════════════════════════════
# PUBLIC — เรียกจาก main.py
# ══════════════════════════════════════════════════════════════════
def start_watcher():
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_run_loop())
        log.info("✅ Auto CM Watcher task created")


async def stop_watcher():
    global _task
    if _task and not _task.done():
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        log.info("⛔ Auto CM Watcher stopped")