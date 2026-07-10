"""
services/maximo.py
==================
Maximo IESB API — async client สำหรับเรียกจาก Auto CM Watcher
- query_locations(): ดึง location list
- create_sr(): สร้าง Service Request
"""

import os
import re
import ssl
import logging
import httpx
from datetime import datetime, timedelta

log = logging.getLogger("maximo_api")

# ══════════════════════════════════════════════════════════════════
# CONFIG — ใช้ env var หรือ default (DEV)
# ══════════════════════════════════════════════════════════════════
MAXIMO_BASE_URL = os.getenv(
    "MAXIMO_BASE_URL",
    "https://mmsiesb-dev.egat.co.th/maximo/api/os",
)
MAXIMO_API_KEY = os.getenv(
    "MAXIMO_API_KEY",
    "2n3h0kbvkksvgakpktkod72hlcdlqkmruakme4op",
)
MAXIMO_SITE_ID = os.getenv("MAXIMO_SITE_ID", "IESB")
MAXIMO_COST_CENTER = os.getenv("MAXIMO_COST_CENTER", "N402040")
MAXIMO_CRAFT = os.getenv("MAXIMO_CRAFT", "EVMAINT")
MAXIMO_ENABLED = os.getenv("MAXIMO_ENABLED", "true").lower() == "true"

# แหล่งข้อมูล location: "api" = Maximo API จริง (default), "db" = MongoDB
# (collection iMPS.maximo_locations — ข้อมูลอยู่บน server อยู่แล้วแบบเดียวกับ
# CM dashboard; create_sr ยังยิง API จริงเสมอ)
MAXIMO_SOURCE = os.getenv("MAXIMO_SOURCE", "api").lower()
_USE_DB_SOURCE = MAXIMO_SOURCE in ("db", "local")

# SSL context — dev server ใช้ self-signed cert
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE


# ══════════════════════════════════════════════════════════════════
# Priority Mapping: CM severity → Maximo reportedpriority
# ══════════════════════════════════════════════════════════════════
SEVERITY_TO_PRIORITY = {
    "Urgent": 1,
    "Critical": 1,  # legacy alias of Urgent
    "High": 2,
    "Medium": 3,
    "Low": 4,
}


# ══════════════════════════════════════════════════════════════════
# API Functions
# ══════════════════════════════════════════════════════════════════
async def create_sr(
    description: str,
    location: str,
    severity: str = "Medium",
    target_start: str | None = None,
    target_finish: str | None = None,
) -> dict | None:
    """
    สร้าง Service Request ใน Maximo

    Args:
        description:  คำอธิบายปัญหา
        location:     รหัสพื้นที่ Maximo เช่น "EGT0327-EV"
        severity:     Urgent/High/Medium/Low → map เป็น reportedpriority 1-4
        target_start:  วันเป้าหมายเข้าตรวจสอบ (YYYY-MM-DD)
        target_finish: วันเป้าหมายแก้ไขเสร็จ (YYYY-MM-DD)

    Returns:
        {"ticketid": "SR26100001", ...} หรือ None ถ้า error
    """
    if not MAXIMO_ENABLED:
        log.info("  ⏭️  Maximo disabled (MAXIMO_ENABLED=false), skip SR creation")
        return None

    if not location:
        log.warning("  ⚠️  Maximo location is empty, skip SR creation")
        return None

    if target_start is None:
        target_start = datetime.now().strftime("%Y-%m-%d")
    if target_finish is None:
        target_finish = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    priority = SEVERITY_TO_PRIORITY.get(severity, 3)

    url = f"{MAXIMO_BASE_URL}/ZAPISR"
    params = {"lean": 1}
    headers = {
        "apikey": MAXIMO_API_KEY,
        "Content-Type": "application/json",
        "properties": "ticketid",
    }
    payload = {
        "description": description[:250],  # Maximo อาจจำกัดความยาว
        "assetsiteid": MAXIMO_SITE_ID,
        "siteid": MAXIMO_SITE_ID,
        "zcostcenter": MAXIMO_COST_CENTER,
        "location": location,
        "zcraft": MAXIMO_CRAFT,
        "reportedpriority": priority,
        "targetstart": target_start,
        "targetfinish": target_finish,
    }

    try:
        async with httpx.AsyncClient(verify=_ssl_ctx, timeout=30) as client:
            resp = await client.post(url, params=params, headers=headers, json=payload)

        if resp.status_code in (200, 201):
            data = resp.json()
            ticket_id = data.get("ticketid", "N/A")
            log.info(f"  🎫 Maximo SR created: {ticket_id} (location: {location})")
            return data
        else:
            log.error(
                f"  ❌ Maximo SR failed: {resp.status_code} — {resp.text[:300]}"
            )
            return None

    except Exception as e:
        log.error(f"  ❌ Maximo API error: {e}")
        return None


async def query_locations(location_filter: str = "%-EV%") -> list[dict] | None:
    """
    ดึง location list จาก Maximo (รองรับ pagination)

    Returns:
        [{"location": "EGT0327-EV", "description": "..."}, ...] หรือ None
    """
    if not MAXIMO_ENABLED:
        return None

    if _USE_DB_SOURCE:
        return await _db_query_locations(location_filter)

    url = f"{MAXIMO_BASE_URL}/ZAPILOCATION"
    headers = {"apikey": MAXIMO_API_KEY}
    page_size = 100
    all_members = []
    page = 1

    try:
        async with httpx.AsyncClient(verify=_ssl_ctx, timeout=30) as client:
            while True:
                params = {
                    "Content-Type": "application/json",
                    "lean": 1,
                    "oslc.select": "location,description",
                    "oslc.pageSize": page_size,
                    "pageno": page,
                }
                if location_filter:
                    params["oslc.where"] = f'location="{location_filter}"'

                resp = await client.get(url, params=params, headers=headers)

                if resp.status_code != 200:
                    log.error(f"Maximo location query failed: {resp.status_code}")
                    break

                data = resp.json()
                members = data.get("member", [])
                if not members:
                    break

                all_members.extend(members)

                if len(members) < page_size:
                    break
                page += 1

        log.info(f"  📍 Maximo locations: {len(all_members)} found")
        return all_members

    except Exception as e:
        log.error(f"  ❌ Maximo location query error: {e}")
        return None


async def query_locations_by_codes(codes: list[str]) -> list[dict] | None:
    """
    ดึง location ตามรหัสที่ระบุ (exact match) ด้วย oslc.where `location in [...]`
    ใช้สำหรับดึง station root (เช่น "HMP0002") ที่ไม่มี -EV ต่อท้าย

    Returns:
        [{"location": "HMP0002", "description": "HomeproRatchburi"}, ...] หรือ None
    """
    if not MAXIMO_ENABLED:
        return None

    codes = [c for c in dict.fromkeys(codes) if c]  # unique + ตัดค่าว่าง
    if not codes:
        return []

    if _USE_DB_SOURCE:
        return await _db_query_locations_by_codes(codes)

    url = f"{MAXIMO_BASE_URL}/ZAPILOCATION"
    headers = {"apikey": MAXIMO_API_KEY}
    in_list = ",".join(f'"{c}"' for c in codes)
    params = {
        "Content-Type": "application/json",
        "lean": 1,
        "oslc.select": "location,description",
        "oslc.where": f"location in [{in_list}]",
        "oslc.pageSize": max(len(codes), 1),
    }

    try:
        async with httpx.AsyncClient(verify=_ssl_ctx, timeout=30) as client:
            resp = await client.get(url, params=params, headers=headers)
        if resp.status_code != 200:
            log.error(f"Maximo location-by-codes query failed: {resp.status_code}")
            return None
        return resp.json().get("member", [])
    except Exception as e:
        log.error(f"  ❌ Maximo location-by-codes query error: {e}")
        return None


# ตู้ชาร์จ = location ที่ลงท้ายด้วย -BTLxxGUxxx (ไม่รวม sub-component เช่น -A01, -F01)
CHARGER_LOCATION_RE = re.compile(r"-BTL\d+GU\d+$", re.IGNORECASE)


async def query_charger_locations(station_code: str) -> list[dict] | None:
    """
    ดึง location ของตู้ชาร์จ (…-EV-BTLxxGUxxx) ใต้ station ที่ระบุ

    Args:
        station_code: รับได้ทั้ง station root ("PTG0001") และ EV location ("PTG0001-EV")

    Returns:
        [{"location": "PTG0001-EV-BTL01GU201", "description": "DC Charger 120kW"}, ...]
        หรือ None ถ้า error
    """
    if not MAXIMO_ENABLED:
        return None

    root = station_code[:-3] if station_code.upper().endswith("-EV") else station_code
    ev_location = f"{root}-EV"

    if _USE_DB_SOURCE:
        try:
            cursor = _db_coll().find(
                {"parent": ev_location, "location": {"$regex": CHARGER_LOCATION_RE.pattern, "$options": "i"}},
                {"_id": 0, "location": 1, "description": 1},
            ).sort("location", 1)
            members = await cursor.to_list(length=None)
            log.info(f"  🔌 Maximo chargers (db) under {ev_location}: {len(members)}")
            return members
        except Exception as e:
            log.error(f"  ❌ DB maximo charger query error: {e}")
            return None

    members = await query_locations(f"{ev_location}-BTL%")
    if members is None:
        return None
    return [m for m in members if CHARGER_LOCATION_RE.search(m.get("location") or "")]


# ══════════════════════════════════════════════════════════════════
# DB source (MongoDB iMPS.maximo_locations — ข้อมูลอยู่บน server เหมือน CM dashboard)
# ══════════════════════════════════════════════════════════════════
def _db_coll():
    from config import client  # motor async client (lazy import กัน circular)
    return client["iMPS"]["maximo_locations"]


def _like_to_regex(pattern: str) -> str:
    """แปลง SQL LIKE pattern ของ Maximo (ใช้ %) เป็น regex เช่น "%-EV%" → "^.*\\-EV.*$" """
    return "^" + ".*".join(re.escape(p) for p in pattern.split("%")) + "$"


async def _db_query_locations(location_filter: str) -> list[dict] | None:
    try:
        query = {}
        if location_filter:
            query["location"] = {"$regex": _like_to_regex(location_filter), "$options": "i"}
        cursor = _db_coll().find(
            query, {"_id": 0, "location": 1, "description": 1}
        ).sort("location", 1)
        members = await cursor.to_list(length=None)
        log.info(f"  📍 Maximo locations (db): {len(members)} found")
        return members
    except Exception as e:
        log.error(f"  ❌ DB maximo location query error: {e}")
        return None


async def _db_query_locations_by_codes(codes: list[str]) -> list[dict] | None:
    try:
        cursor = _db_coll().find(
            {"location": {"$in": codes}}, {"_id": 0, "location": 1, "description": 1}
        ).sort("location", 1)
        return await cursor.to_list(length=None)
    except Exception as e:
        log.error(f"  ❌ DB maximo location-by-codes query error: {e}")
        return None
