"""
services/maximo.py
==================
Maximo IESB API — async client สำหรับเรียกจาก Auto CM Watcher
- query_locations(): ดึง location list
- create_sr(): สร้าง Service Request
"""

import os
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

# SSL context — dev server ใช้ self-signed cert
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE


# ══════════════════════════════════════════════════════════════════
# Priority Mapping: CM severity → Maximo reportedpriority
# ══════════════════════════════════════════════════════════════════
SEVERITY_TO_PRIORITY = {
    "Critical": 1,  # Urgent
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
        severity:     Critical/High/Medium/Low → map เป็น reportedpriority 1-4
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