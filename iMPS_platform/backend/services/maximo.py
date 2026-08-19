"""
services/maximo.py
==================
Maximo IESB API — async client

เดิม (Auto CM Watcher / PM):
- query_locations():  ดึง location list
- create_sr():        สร้าง Service Request (ใช้ฝั่ง CM)
- query_workorders(): ดึงใบงาน PM ที่ EGAT เปิดไว้ใน Maximo เข้ามาแสดงใน iMPS

ชุด interface ตามเอกสาร EGAT_IESB_Payload_Structure_v1 (ใช้กับใบงาน CM):
    IN01  create_workorder()    POST ZAPIWO             สร้าง Maximo Work Order
    IN02  update_wo_status()    POST ZAPIWOSTATUS       เปลี่ยนสถานะ WO
    IN03  attach_wo_link()      POST ZAPIATTACHWO       แนบ Link Attachment
    IN04  query_failure_list()  GET  ZAPIFAILURELIST    ตาราง failure code
    IN05  report_wo_failure()   POST ZAPIFAILUREREPORT  บันทึก Failure ให้ WO
    IN06  (ขาเข้า)              webhook                 Maximo → iMPS เปิดใบงาน
    IN07  query_locations()     GET  ZAPILOCATION       location list (มีอยู่เดิม)
    IN08  query_labor()         GET  ZAPIPERSON         รายชื่อช่าง (labor list)
    IN09  create_labtrans()     POST ZAPILABTRANS       Actual Labor (time confirm)

⚠️ เอกสารที่ได้รับมามีแค่ "รายการ interface + endpoint" ไม่มีสเปกฟิลด์ของ payload
   ชื่อฟิลด์ที่ใช้ด้านล่างจึงอิง attribute จริงของ Object Structure แต่ละตัว
   (ตรวจด้วย GET …?oslc.select=* บน DEV) ถ้าฝั่ง Maximo กำหนดมาต่างจากนี้
   override ได้ทาง env ทั้งชื่อ OS และโหมด POST โดยไม่ต้องแก้โค้ด
"""

import os
import re
import ssl
import json
import logging
import httpx
from datetime import datetime, timedelta
from typing import Any, Iterable
from zoneinfo import ZoneInfo

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
MAXIMO_ORG_ID = os.getenv("MAXIMO_ORG_ID", "EGAT")
MAXIMO_COST_CENTER = os.getenv("MAXIMO_COST_CENTER", "N402040")
# craft ที่มีจริงใน Maximo DEV: CRAFT01 / EVMAIN / EPMAIN / ESMAIN / CRAFTES
# (ค่าเดิมในโค้ดคือ "EVMAINT" ซึ่ง Maximo ปฏิเสธด้วย BMXAA4191E)
MAXIMO_CRAFT = os.getenv("MAXIMO_CRAFT", "EVMAIN")
MAXIMO_ENABLED = os.getenv("MAXIMO_ENABLED", "true").lower() == "true"

# ── Work Order (PM) ──
# ชื่อ Object Structure สำหรับเปิดใบงาน WO — ปรับได้ผ่าน env ถ้า EGAT ตั้งชื่ออื่น
MAXIMO_WO_OS = os.getenv("MAXIMO_WO_OS", "ZAPIWO")
MAXIMO_WO_WORKTYPE = os.getenv("MAXIMO_WO_WORKTYPE", "PM")

# ── Object Structure ของ interface ชุด CM (IN01–IN09) ──
MAXIMO_WOSTATUS_OS = os.getenv("MAXIMO_WOSTATUS_OS", "ZAPIWOSTATUS")
MAXIMO_ATTACHWO_OS = os.getenv("MAXIMO_ATTACHWO_OS", "ZAPIATTACHWO")
MAXIMO_FAILURELIST_OS = os.getenv("MAXIMO_FAILURELIST_OS", "ZAPIFAILURELIST")
MAXIMO_FAILUREREPORT_OS = os.getenv("MAXIMO_FAILUREREPORT_OS", "ZAPIFAILUREREPORT")
MAXIMO_PERSON_OS = os.getenv("MAXIMO_PERSON_OS", "ZAPIPERSON")
# LABOR เป็นคนละ object กับ PERSON — คนที่ลงเวลาได้ต้องมีเรคคอร์ดที่นี่
# (ไม่มี ZAPILABOR ให้ใช้ ต้องยิง MXLABOR ซึ่งเป็น OS มาตรฐานของ Maximo)
MAXIMO_LABOR_OS = os.getenv("MAXIMO_LABOR_OS", "MXLABOR")
MAXIMO_LABTRANS_OS = os.getenv("MAXIMO_LABTRANS_OS", "ZAPILABTRANS")

# worktype ของใบงาน CM ที่ iMPS เปิดเข้า Maximo
MAXIMO_CM_WORKTYPE = os.getenv("MAXIMO_CM_WORKTYPE", "CM")
# doctype ของ attachment (IN03) — ต้องเป็นค่าที่มีอยู่ใน DOCTYPES ของ Maximo
MAXIMO_DOCTYPE = os.getenv("MAXIMO_DOCTYPE", "Attachments")
# urltype ของ link attachment — สเปค EGAT ระบุว่าใช้ "URL"
# (เคยลอง "WEB" → BMXAA4024E ไม่มีใน domain, "FILE" → iface#nodocinfo)
MAXIMO_URLTYPE = os.getenv("MAXIMO_URLTYPE", "URL")

# ── ฟิลด์ที่ Maximo DEV ปฏิเสธ ณ ตอนทดสอบ (2026-08-06) — ปิดไว้ก่อน ──
# zcraft   : BMXAA4191E ค่าไม่อยู่ใน domain (ไม่มี WO ใบไหนในระบบตั้งค่านี้เลย)
# failurecode ระดับ WO ตอนสร้าง (IN01) : เคยโดน BMXAA4534E เลยปิดไว้
#   — flag นี้คุมเฉพาะ IN01 เท่านั้น ส่วน IN05 สเปคระบุว่า failurecode เป็น
#     Required จึงส่งเสมอ ไม่ผ่าน flag (ไม่ส่งจะโดน BMXAA0030E)
#   — ยืนยัน 2026-08-18: IN05 ตั้ง failurecode ให้ WO เองได้ ไม่ต้องพึ่ง IN01
#     และ location ไม่จำเป็นต้องผูก failure class ไว้ก่อน
MAXIMO_SEND_ZCRAFT = os.getenv("MAXIMO_SEND_ZCRAFT", "false").lower() == "true"
MAXIMO_SEND_WO_FAILURECODE = os.getenv("MAXIMO_SEND_WO_FAILURECODE", "false").lower() == "true"
# reasonforchange เป็นฟิลด์สั้น (BMXAA4049E maximumlength) — 0 = ไม่ส่งเลย
MAXIMO_REASON_MAXLEN = int(os.getenv("MAXIMO_REASON_MAXLEN", "0"))
# สถานะเริ่มต้นของ WO ที่เพิ่งสร้าง (ว่าง = ปล่อยให้ Maximo ใช้ค่า default ของระบบ)
MAXIMO_CM_WO_STATUS = os.getenv("MAXIMO_CM_WO_STATUS", "")

# แหล่งข้อมูล location: "api" = Maximo API จริง (default), "db" = MongoDB
# (collection iMPS.maximo_locations — ข้อมูลอยู่บน server อยู่แล้วแบบเดียวกับ
# CM dashboard; create_sr ยังยิง API จริงเสมอ)
MAXIMO_SOURCE = os.getenv("MAXIMO_SOURCE", "api").lower()
_USE_DB_SOURCE = MAXIMO_SOURCE in ("db", "local")

# SSL context — dev server ใช้ self-signed cert
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

# วัน/เวลาที่ส่งเข้า Maximo ต้องมี offset — ข้อมูลใน iMPS เป็นเวลาไทยทั้งหมด
_TH_TZ = ZoneInfo("Asia/Bangkok")


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
# HTTP helpers (ใช้ร่วมกันทุก interface ชุด CM)
# ══════════════════════════════════════════════════════════════════
class MaximoError(RuntimeError):
    """เรียก Maximo ไม่สำเร็จ — เก็บ status/รายละเอียดไว้ให้ผู้เรียกบันทึกลง DB"""

    def __init__(self, message: str, status: int | None = None, body: str = ""):
        super().__init__(message)
        self.status = status
        self.body = body[:1000]
        # Maximo บอกชื่อ attribute ที่ค่าไม่ผ่านมาใน errorattrname (เช่น BMXAA4191E)
        # ดึงออกมาไว้ให้ผู้เรียกรู้ว่าต้องแก้ฟิลด์ไหน โดยไม่ต้องมานั่ง parse JSON เอง
        self.attr = ""
        self.reason_code = ""
        self.objpath = ""
        try:
            err = (json.loads(body or "{}") or {}).get("Error") or {}
            self.attr = str(err.get("errorattrname") or "")
            self.reason_code = str(err.get("reasonCode") or "")
            # ชั้นที่ผิด เช่น "workorder" หรือ "workorder/failurereport"
            self.objpath = str(err.get("errorobjpath") or "")
        except (json.JSONDecodeError, AttributeError):
            pass


def _headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    h = {"apikey": MAXIMO_API_KEY, "Content-Type": "application/json"}
    if extra:
        h.update({k: v for k, v in extra.items() if v})
    return h


def _clean(payload: dict) -> dict:
    """ตัด key ที่ค่าเป็น None/"" ออก — Maximo จะ error ถ้าส่ง attribute ว่างมาให้"""
    return {k: v for k, v in payload.items() if v not in (None, "")}


async def _post(
    os_name: str,
    payload: dict | list,
    *,
    method_override: str | None = None,
    patchtype: str | None = None,
    properties: str | None = None,
    timeout: int = 30,
    trace: dict | None = None,
) -> dict:
    """
    POST เข้า Object Structure

    method_override:
        None    — สร้างเรคคอร์ดใหม่ (IN01)
        "SYNC"  — มีอยู่แล้วให้อัปเดต ไม่มีให้สร้าง (อ้าง natural key = wonum+siteid)
                  เป็นวิธีมาตรฐานของ Maximo REST สำหรับ IN02/IN03/IN05/IN09
        "PATCH" — อัปเดตอย่างเดียว
    patchtype "MERGE" = รวมกับ child collection เดิม ไม่ลบของที่มีอยู่ทิ้ง
    """
    if not MAXIMO_ENABLED:
        raise MaximoError("Maximo disabled (MAXIMO_ENABLED=false)")

    url = f"{MAXIMO_BASE_URL}/{os_name}"
    headers = _headers({
        "x-method-override": method_override or "",
        "patchtype": patchtype or "",
        "properties": properties or "",
    })
    # เก็บสิ่งที่ยิงไปไว้ให้ผู้เรียกจดลงใบงาน — ไล่ปัญหาได้โดยไม่ต้องเปิด log server
    if trace is not None:
        trace["os"] = os_name
        trace["method_override"] = method_override or "POST"
        trace["request"] = payload
    try:
        async with httpx.AsyncClient(verify=_ssl_ctx, timeout=timeout) as client:
            resp = await client.post(url, params={"lean": 1}, headers=headers, json=payload)
    except Exception as e:
        raise MaximoError(f"{os_name}: {type(e).__name__}: {e}") from e

    if trace is not None:
        trace["http"] = resp.status_code

    if resp.status_code not in (200, 201, 204):
        if trace is not None:
            trace["response"] = resp.text[:1000]
        raise MaximoError(
            f"{os_name} failed: HTTP {resp.status_code}",
            status=resp.status_code,
            body=resp.text,
        )

    if trace is not None:
        # 204 = สำเร็จแบบไม่มี body (IN05 ตอบแบบนี้)
        trace["response"] = resp.text[:1000] if resp.content else f"HTTP {resp.status_code} (no content)"

    if not resp.content:
        return {}
    try:
        data = resp.json()
    except json.JSONDecodeError:
        return {"_raw": resp.text[:500]}
    # Maximo ตอบ list เมื่อยิงเป็น bulk — คืนตัวแรกให้ผู้เรียกใช้ต่อได้ตรง ๆ
    if isinstance(data, list):
        return data[0] if data else {}
    return data


async def _get_all(os_name: str, params: dict, *, page_size: int = 200, timeout: int = 60) -> list[dict]:
    """GET แบบไล่ทุกหน้า — คืน member ทั้งหมด (raise MaximoError ถ้าเรียกไม่ผ่าน)"""
    if not MAXIMO_ENABLED:
        raise MaximoError("Maximo disabled (MAXIMO_ENABLED=false)")

    url = f"{MAXIMO_BASE_URL}/{os_name}"
    members: list[dict] = []
    page = 1
    try:
        async with httpx.AsyncClient(verify=_ssl_ctx, timeout=timeout) as client:
            while True:
                q = {"Content-Type": "application/json", "lean": 1,
                     "oslc.pageSize": page_size, "pageno": page, **params}
                resp = await client.get(url, params=q, headers={"apikey": MAXIMO_API_KEY})
                if resp.status_code != 200:
                    raise MaximoError(
                        f"{os_name} query failed: HTTP {resp.status_code}",
                        status=resp.status_code,
                        body=resp.text,
                    )
                batch = resp.json().get("member", [])
                if not batch:
                    break
                members.extend(batch)
                if len(batch) < page_size:
                    break
                page += 1
    except MaximoError:
        raise
    except Exception as e:
        raise MaximoError(f"{os_name}: {type(e).__name__}: {e}") from e

    return members


def _maximo_datetime(value: Any) -> str | None:
    """
    แปลงวัน/เวลาฝั่ง iMPS เป็นรูปแบบที่ Maximo รับ (ISO 8601 + offset ไทย)

    รับได้ทั้ง "2026-08-06", "2026-08-06T09:30", datetime และ ISO เต็ม
    """
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        s = str(value).strip().replace("Z", "+00:00")
        if len(s) == 10:            # YYYY-MM-DD
            s += "T00:00:00"
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_TH_TZ)
    return dt.isoformat(timespec="seconds")


def _split_datetime(value: Any) -> tuple[str | None, str | None]:
    """แยกเป็น (date, datetime) สำหรับ LABTRANS ที่มีทั้ง startdate และ starttime"""
    iso = _maximo_datetime(value)
    if not iso:
        return None, None
    return iso[:10], iso


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


# field ที่ขอจาก Maximo — ตัวหลักคือ pmtype / location / targstartdate (= pm_date)
# ถ้า EGAT ตั้งชื่อ attribute ต่างจากนี้ override ได้ด้วย env MAXIMO_WO_SELECT
WO_SELECT = os.getenv(
    "MAXIMO_WO_SELECT",
    "wonum,description,location,status,worktype,pmtype,targstartdate,targcompdate",
)


async def query_workorders(
    locations: list[str] | None = None,
    worktype: str | None = None,
    statuses: list[str] | None = None,
) -> list[dict] | None:
    """
    ดึงใบงาน (Work Order) จาก Maximo — ใช้ดึงใบงาน PM ที่ EGAT เปิดไว้เข้ามาแสดงใน iMPS

    Args:
        locations: จำกัดเฉพาะ location เหล่านี้ (ว่าง = ทุก location)
        worktype:  default "PM"
        statuses:  จำกัดสถานะ เช่น ["APPR", "INPRG"] (ว่าง = ทุกสถานะ)

    Returns:
        [{"wonum": "...", "description": "...", "location": "...", ...}, ...] หรือ None ถ้า error
    """
    if not MAXIMO_ENABLED:
        return None

    locations = [c for c in dict.fromkeys(locations or []) if c]

    where = [f'worktype="{worktype or MAXIMO_WO_WORKTYPE}"']
    if locations:
        where.append("location in [" + ",".join(f'"{c}"' for c in locations) + "]")
    if statuses:
        where.append("status in [" + ",".join(f'"{s}"' for s in statuses) + "]")

    url = f"{MAXIMO_BASE_URL}/{MAXIMO_WO_OS}"
    headers = {"apikey": MAXIMO_API_KEY}
    page_size = 100
    all_members: list[dict] = []
    page = 1

    try:
        async with httpx.AsyncClient(verify=_ssl_ctx, timeout=60) as client:
            while True:
                params = {
                    "Content-Type": "application/json",
                    "lean": 1,
                    "oslc.select": WO_SELECT,
                    "oslc.where": " and ".join(where),
                    "oslc.pageSize": page_size,
                    "pageno": page,
                }
                resp = await client.get(url, params=params, headers=headers)

                if resp.status_code != 200:
                    log.error(
                        f"Maximo WO query failed: {resp.status_code} — {resp.text[:300]}"
                    )
                    return None if not all_members else all_members

                members = resp.json().get("member", [])
                if not members:
                    break

                all_members.extend(members)
                if len(members) < page_size:
                    break
                page += 1

        log.info(f"  🧾 Maximo work orders: {len(all_members)} found")
        return all_members

    except Exception as e:
        log.error(f"  ❌ Maximo WO query error: {e}")
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


# ══════════════════════════════════════════════════════════════════
# IN01 — สร้าง Maximo Work Order  (POST ZAPIWO)
# ══════════════════════════════════════════════════════════════════
async def create_workorder(
    description: str,
    location: str,
    *,
    severity: str = "Medium",
    worktype: str | None = None,
    sched_start: Any = None,
    sched_finish: Any = None,
    target_start: Any = None,
    target_finish: Any = None,
    reported_by: str | None = None,
    supervisor: str | None = None,
    failure_code: str | None = None,
    imps_wonum: str | None = None,
    asset_num: str | None = None,
    extra: dict | None = None,
    trace: dict | None = None,
) -> dict:
    """
    เปิดใบสั่งงาน (Work Order) ใน Maximo จากใบงาน CM ของ iMPS

    Args:
        description: หัวเรื่องงาน (ตัดที่ 100 ตัวอักษรตามความยาว attribute ของ Maximo)
        location:    รหัส Maximo location เช่น "EGT0327-EV-BTL01GU201"
        severity:    Urgent/High/Medium/Low → map เป็น wopriority 1–4
        imps_wonum:  เลขใบงานฝั่ง iMPS (issue_id) — เก็บที่ field zimpswonum
                     ของ Maximo เพื่ออ้างอิงกลับสองทาง
        failure_code: failure class ของ Maximo (DCCHARGER/ACCHARGER/STATION)

    Returns:
        เรคคอร์ดที่ Maximo ตอบกลับ — อย่างน้อยมี wonum

    Raises:
        MaximoError เมื่อเรียกไม่สำเร็จ
    """
    if not location:
        raise MaximoError("location is required to create a work order")

    payload = _clean({
        "description": (description or "")[:100],
        "location": location,
        "siteid": MAXIMO_SITE_ID,
        "orgid": MAXIMO_ORG_ID,
        "worktype": worktype or MAXIMO_CM_WORKTYPE,
        "status": MAXIMO_CM_WO_STATUS,
        "wopriority": SEVERITY_TO_PRIORITY.get(severity, 3),
        "zcostcenter": MAXIMO_COST_CENTER,
        "zcraft": MAXIMO_CRAFT if MAXIMO_SEND_ZCRAFT else None,
        "assetnum": asset_num,
        "failurecode": failure_code if MAXIMO_SEND_WO_FAILURECODE else None,
        "reportedby": reported_by,
        "supervisor": supervisor,
        "zimpswonum": imps_wonum,
        "schedstart": _maximo_datetime(sched_start),
        "schedfinish": _maximo_datetime(sched_finish),
        "targstartdate": _maximo_datetime(target_start or sched_start),
        "targcompdate": _maximo_datetime(target_finish or sched_finish),
        "reportdate": _maximo_datetime(datetime.now(_TH_TZ)),
        **(extra or {}),
    })

    data = await _post(MAXIMO_WO_OS, payload, properties="wonum,status,description", trace=trace)
    log.info(f"  🧾 Maximo WO created: {data.get('wonum')} (location={location}, imps={imps_wonum})")
    return data


# ══════════════════════════════════════════════════════════════════
# IN02 — เปลี่ยนสถานะ Maximo Work Order  (POST ZAPIWOSTATUS)
# ══════════════════════════════════════════════════════════════════
async def update_wo_status(
    wonum: str,
    status: str,
    *,
    memo: str | None = None,
    status_date: Any = None,
    extra: dict | None = None,
    trace: dict | None = None,
) -> dict:
    """
    เปลี่ยนสถานะใบสั่งงานใน Maximo (APPR / INPRG / COMP / CLOSE / CAN …)

    ยิงแบบ SYNC + MERGE = "มีอยู่แล้วให้อัปเดต" โดยอ้าง natural key (wonum + siteid)
    """
    wonum = (wonum or "").strip()
    if not wonum:
        raise MaximoError("wonum is required")
    if not status:
        raise MaximoError("status is required")

    payload = _clean({
        "wonum": wonum,
        "siteid": MAXIMO_SITE_ID,
        "orgid": MAXIMO_ORG_ID,
        "status": status,
        "statusdate": _maximo_datetime(status_date or datetime.now(_TH_TZ)),
        # ยาวเกินโดน BMXAA4049E — ตัดตามความยาวที่ตั้งไว้ (0 = ไม่ส่งเลย)
        "reasonforchange": (memo or "")[:MAXIMO_REASON_MAXLEN] or None,
        **(extra or {}),
    })

    data = await _post(
        MAXIMO_WOSTATUS_OS, payload,
        method_override="SYNC", patchtype="MERGE",
        properties="wonum,status", trace=trace,
    )
    log.info(f"  🔁 Maximo WO {wonum} → status {status}")
    return data


# ══════════════════════════════════════════════════════════════════
# IN03 — แนบ Link Attachment ให้ Work Order  (POST ZAPIATTACHWO)
# ══════════════════════════════════════════════════════════════════
def maximo_safe_url(url: str) -> str:
    """
    ตัดลิงก์ให้เหลือ query param ตัวเดียวก่อนส่งเข้า Maximo (IN03)

    EGAT ยืนยัน 2026-08-19: ลิงก์ที่มี & ต่อท้าย (…?station_id=X&lang=th&dl=true)
    กดจาก Maximo แล้วเปิดไม่ได้ (401/404) พอเหลือ param เดียวก็เปิดได้ทันที
    ทั้งที่ DOCINFO ฝั่ง Maximo เก็บ urlname ไว้ครบทุกตัวอักษร (ตรวจด้วย MXAPIDOCINFO)
    ⇒ ตัวที่ทำพังอยู่ระหว่างทางฝั่งเขา ไม่ใช่ payload ที่เราส่ง

    ตัดเฉพาะตอนยิงออกเท่านั้น ลิงก์ฝั่ง iMPS ยังเต็มเหมือนเดิม — param ตัวแรกคือ
    ตัวที่ route /pdf ต้องใช้หาเอกสาร (sn/station_id) ที่เหลือเป็นของแต่ง
    (lang/dl) ซึ่ง route มี default ให้อยู่แล้ว
    """
    base, sep, query = (url or "").partition("?")
    if not sep or "&" not in query:
        return url
    first = query.split("&", 1)[0]
    dropped = query.split("&", 1)[1]
    log.info(f"  ✂️ ตัด query ออกจากลิงก์ก่อนส่งเข้า Maximo: {dropped}")
    return f"{base}?{first}" if first else base


async def attach_wo_link(
    wonum: str,
    url: str,
    *,
    name: str | None = None,
    description: str | None = None,
    doctype: str | None = None,
    trace: dict | None = None,
) -> dict:
    """
    แนบลิงก์เอกสาร (URL) เข้ากับใบสั่งงาน — ส่งแค่ลิงก์ ไม่ได้อัปโหลดไฟล์เข้า Maximo

    payload ตามสเปค EGAT (POST ZAPIATTACHWO, x-method-override: BULK):
        [{
          "_action": "AddChange",
          "siteid": "IESB", "orgid": "EGAT",
          "wonum": "WO26100014",
          "doclinks": [{
            "addinfo": "1",              ← ให้ Maximo สร้าง DOCINFO ให้เอง
            "description": "ชื่อไฟล์",
            "doctype": "Attachments",
            "document": "ID ของไฟล์",
            "upload": "0",               ← ไม่ได้อัปไฟล์ขึ้น network
            "urlname": "<URL>",          ← ตัว URL อยู่ที่ field นี้ ไม่ใช่ weburl
            "urltype": "URL"
          }]
        }]

    ⚠️ addinfo ขาดไม่ได้ — ไม่ส่งจะโดน "iface#nodocinfo"
    ⚠️ urltype ต้องเป็น "URL" (ค่า WEB ไม่มีใน domain URLTYPE → BMXAA4024E)
    ตอบกลับสำเร็จเป็น 204 No Content
    """
    wonum = (wonum or "").strip()
    if not wonum:
        raise MaximoError("wonum is required")
    if not url:
        raise MaximoError("url is required")

    url = maximo_safe_url(url)
    doc_name = (name or url.rsplit("/", 1)[-1] or "attachment")[:100]
    payload = [_clean({
        "_action": "AddChange",
        "siteid": MAXIMO_SITE_ID,
        "orgid": MAXIMO_ORG_ID,
        "wonum": wonum,
        "doclinks": [_clean({
            "addinfo": "1",
            "description": (description or doc_name)[:250],
            "doctype": doctype or MAXIMO_DOCTYPE,
            "document": doc_name,
            "upload": "0",
            "urlname": url,
            "urltype": MAXIMO_URLTYPE,
        })],
    })]

    data = await _post(MAXIMO_ATTACHWO_OS, payload, method_override="BULK", trace=trace)
    log.info(f"  📎 Maximo WO {wonum} ← attachment {doc_name}")
    return data


# ══════════════════════════════════════════════════════════════════
# IN04 — Query Maximo Failure Code  (GET ZAPIFAILURELIST)
# ══════════════════════════════════════════════════════════════════
async def query_failure_list() -> list[dict]:
    """
    ดึงตาราง failure code ทั้งต้นไม้ (failure class → problem → cause → remedy)

    Maximo คืนมาเป็น node แบน ๆ ผูกกันด้วย failurelist (id) / parent
    การประกอบเป็นลำดับชั้นอยู่ที่ services/cm_maximo.py
    """
    members = await _get_all(
        MAXIMO_FAILURELIST_OS,
        {"oslc.select": "*", "_dropnulls": 0},
    )
    log.info(f"  🧩 Maximo failure list: {len(members)} nodes")
    return members


# ══════════════════════════════════════════════════════════════════
# IN05 — บันทึก Failure ให้ Maximo Work Order  (POST ZAPIFAILUREREPORT)
# ══════════════════════════════════════════════════════════════════
async def report_wo_failure(
    wonum: str,
    *,
    failure_code: str,
    problem_code: str | None = None,
    cause_code: str | None = None,
    remedy_code: str | None = None,
    remarks: str | None = None,
    fail_date: Any = None,
    trace: dict | None = None,
) -> dict:
    """
    รายงานผลวิเคราะห์ความเสียหายของใบสั่งงาน (problem → cause → remedy)

    payload ตามสเปค EGAT (POST ZAPIFAILUREREPORT, x-method-override: BULK):
        [{
          "_action": "AddChange",
          "siteid": "IESB", "orgid": "EGAT",
          "wonum": "WO26100014",
          "failurecode": "DCCHARGER",          ← failure class ระดับ WO (Required)
          "failurereport": [
            {"failurecode": "UN2STCHG", "type": "PROBLEM"},
            {"failurecode": "EMERBUTP", "type": "CAUSE"},
            {"failurecode": "RECHECK",  "type": "REMEDY"}
          ]
        }]

    ⚠️ failurecode ระดับ WO ขาดไม่ได้ — ไม่ส่งจะโดน BMXAA0030E
       "A failure class is required to report a failure"
    ตอบกลับสำเร็จเป็น 204 No Content
    """
    wonum = (wonum or "").strip()
    if not wonum:
        raise MaximoError("wonum is required")
    if not failure_code:
        raise MaximoError("failure_code is required")

    # 1 แถวต่อ 1 ชั้น — สเปคแยก type ชัดเจน ไม่ได้ยัดรวมเป็นแถวเดียว
    rows = [
        {"failurecode": code.strip().upper(), "type": kind}
        for code, kind in (
            (problem_code or "", "PROBLEM"),
            (cause_code or "", "CAUSE"),
            (remedy_code or "", "REMEDY"),
        )
        if str(code or "").strip()
    ]
    if not rows:
        raise MaximoError("ต้องมี problem/cause/remedy อย่างน้อย 1 อย่าง")

    payload = [_clean({
        "_action": "AddChange",
        "siteid": MAXIMO_SITE_ID,
        "orgid": MAXIMO_ORG_ID,
        "wonum": wonum,
        "failurecode": failure_code.strip().upper(),
        "failurereport": rows,
        # สเปคไม่ได้ระบุ 2 ฟิลด์นี้ไว้ แต่ Maximo รับได้และมีประโยชน์ตอนสอบย้อนหลัง
        "remarks": (remarks or "")[:250] or None,
        "faildate": _maximo_datetime(fail_date) if fail_date else None,
    })]

    data = await _post(MAXIMO_FAILUREREPORT_OS, payload, method_override="BULK", trace=trace)
    log.info(
        f"  🩺 Maximo WO {wonum} ← failure {failure_code}/"
        f"{problem_code}/{cause_code}/{remedy_code}"
    )
    return data


# ══════════════════════════════════════════════════════════════════
# IN08 — Query Maximo Labor List  (GET ZAPIPERSON)
# ══════════════════════════════════════════════════════════════════
async def query_labor(cost_center: str | None = None) -> list[dict]:
    """
    รายชื่อคนที่มอบหมายงานได้ — กรองด้วย cost center ของหน่วยงาน EV

    Returns: [{"personid": "595503", "displayname": "…"}, …]
    """
    cc = (cost_center or MAXIMO_COST_CENTER or "").strip()
    params = {"oslc.select": "personid,displayname,status,primaryemail,zcostcenter"}
    if cc:
        params["oslc.where"] = f'zcostcenter="{cc}"'

    members = await _get_all(MAXIMO_PERSON_OS, params)
    log.info(f"  👷 Maximo labor list: {len(members)} persons (cost center {cc or '-'})")
    return members


async def workorders_exist(wonums: list[str]) -> dict[str, dict]:
    """
    เช็คว่า wonum ไหนมีอยู่จริงใน Maximo — ถามทีเดียวทั้งชุด

    ใบงานที่ยิงเข้ามาทาง IN06 อาจเป็นเลขที่ไม่เคยถูกสร้างจริง (เช่น payload
    ตัวอย่างจากเอกสารสเปค) พอไปยิง IN02 กลับจะโดน BMXAA1496E
    "The WORKORDER record does not exist" — เช็คก่อนจะได้รู้ตั้งแต่ต้น

    Returns: {wonum: {status, worktype, location, description}} เฉพาะใบที่มีจริง
    """
    codes = [str(w).strip() for w in wonums if str(w or "").strip()]
    if not codes:
        return {}

    where = "wonum in [" + ",".join(f'"{c}"' for c in codes) + "]"
    members = await _get_all(
        MAXIMO_WO_OS,
        {"oslc.select": "wonum,status,worktype,location,description", "oslc.where": where},
    )
    return {str(m.get("wonum") or "").strip(): m for m in members if m.get("wonum")}


async def query_labor_records(active_only: bool = True) -> list[dict]:
    """
    เรคคอร์ด LABOR จริงใน Maximo — คนที่ลงเวลา (IN09) ได้ต้องอยู่ในลิสต์นี้

    ต่างจาก query_labor() ที่ยิง ZAPIPERSON: PERSON มีทุกคนในองค์กร แต่ LABOR
    มีเฉพาะคนที่ตั้งค่าให้ลงเวลาได้ ส่งรหัสที่ไม่มีใน LABOR จะโดน BMXAA2627E

    Returns: [{"laborcode": "597082", "personid": "597082", "status": "ACTIVE"}, …]
    """
    params = {"oslc.select": "laborcode,personid,status,orgid"}
    if active_only:
        params["oslc.where"] = 'status="ACTIVE"'
    members = await _get_all(MAXIMO_LABOR_OS, params)
    log.info(f"  🧰 Maximo labor records: {len(members)}")
    return members


# ══════════════════════════════════════════════════════════════════
# IN09 — บันทึก Actual Labor / Time Confirm  (POST ZAPILABTRANS)
# ══════════════════════════════════════════════════════════════════
async def create_labtrans(
    wonum: str,
    labor_code: str,
    *,
    start: Any,
    finish: Any = None,
    regular_hours: float | None = None,
    craft: str | None = None,
    location: str | None = None,
    memo: str | None = None,
    trace: dict | None = None,
) -> dict:
    """
    ลงเวลาทำงานจริงของช่าง 1 คน กับใบสั่งงาน 1 ใบ

    Args:
        labor_code: รหัสช่างฝั่ง Maximo (personid จาก IN08)
        start/finish: วัน-เวลาเริ่ม/เสร็จ (ISO string หรือ datetime)
        regular_hours: ชั่วโมงทำงาน — ไม่ส่งมาจะคำนวณจาก start→finish ให้
    """
    wonum = (wonum or "").strip()
    labor_code = (labor_code or "").strip()
    if not wonum:
        raise MaximoError("wonum is required")
    if not labor_code:
        raise MaximoError("labor_code is required")

    start_date, start_dt = _split_datetime(start)
    finish_date, finish_dt = _split_datetime(finish)
    if not start_dt:
        raise MaximoError("start datetime is required")

    if regular_hours is None and start_dt and finish_dt:
        delta = datetime.fromisoformat(finish_dt) - datetime.fromisoformat(start_dt)
        regular_hours = round(max(delta.total_seconds(), 0) / 3600, 2)

    payload = _clean({
        "refwo": wonum,
        "laborcode": labor_code,
        "siteid": MAXIMO_SITE_ID,
        "orgid": MAXIMO_ORG_ID,
        "transtype": "WORK",
        # craft ต้องตรงกับ craft ที่ผูกกับ labor คนนั้น ไม่งั้นโดน BMXAA2634E craftmismatch
        # ไม่ระบุมา = ปล่อยให้ Maximo เติม craft หลักของ labor ให้เอง
        "craft": craft,
        "location": location,
        "startdate": start_date,
        "startdatetime": start_dt,
        "starttime": start_dt,
        "finishdate": finish_date,
        "finishdatetime": finish_dt,
        "finishtime": finish_dt,
        "regularhrs": regular_hours,
        "memo": (memo or "")[:250] or None,
    })

    data = await _post(MAXIMO_LABTRANS_OS, payload, properties="labtransid,refwo,laborcode", trace=trace)
    log.info(f"  ⏱️  Maximo labtrans: WO {wonum} / {labor_code} / {regular_hours}h")
    return data
