"""
routers/pm_maximo.py
====================
รับใบงาน PM ที่เปิดจาก Maximo เข้ามาแสดงในหน้า PM report ของแต่ละ tab
(charger / mdb / ccb / cb-box / station)

รับได้ 2 ทาง:
  1) pull  — iMPS ยิง GET ไปถาม Maximo เอง (services.maximo.query_workorders)
  2) push  — Maximo ยิง POST /maximo/pm-workorder เข้ามาตอนเปิดใบงาน (webhook)

ทั้งสองทางลงที่ collection เดียวกัน: iMPS.maximo_pm_workorders (unique key = wonum)
แล้ว frontend อ่านผ่าน GET /pm-maximo/work-orders

หมายเหตุ: iMPS ไม่ยิงไปเปิดใบงานที่ Maximo — การกด "เพิ่ม PM report" ในระบบ
เป็นงานฝั่ง iMPS ล้วน ๆ
"""

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

from config import client, station_collection, charger_collection
from deps import get_current_user, UserClaims
from services import maximo as maximo_svc
from routers import pm_flow
from services.maximo import query_workorders

log = logging.getLogger("pm_maximo")
router = APIRouter(tags=["pm-maximo"])

PMSource = Literal["charger", "mdb", "ccb", "cbbox", "station"]

# secret ที่ Maximo ต้องแนบมาใน header X-Maximo-Token เวลายิง webhook เข้ามา
MAXIMO_WEBHOOK_SECRET = os.getenv("MAXIMO_WEBHOOK_SECRET", "")

# สถานะที่ถือว่า "ใบงานยังเปิดอยู่"
# OPEN = ค่า default ของ IN06 (Maximo → iMPS), ที่เหลือเป็นสถานะมาตรฐานฝั่ง Maximo
OPEN_WO_STATUSES = {"OPEN", "WAPPR", "APPR", "INPRG", "WMATL", "WSCH"}

# ── PM type → tab ──
# pm_type เป็นตัวชี้ว่าใบงานนี้เป็นของ tab ไหน (location อย่างเดียวแยกไม่ได้
# เพราะ mdb/ccb/cb-box/station ใช้ location ของสถานีร่วมกัน)
PM_TYPE_TO_SOURCE: dict[str, str] = {
    "CG": "charger",
    "MB": "mdb",
    "CC": "ccb",
    "CB": "cbbox",
    "ST": "station",
}
SOURCE_TO_PM_TYPE = {v: k for k, v in PM_TYPE_TO_SOURCE.items()}


def _norm_pm_type(value: Any) -> str:
    """รับ pm_type จาก Maximo — รองรับทั้ง 'CG' และชื่อเต็ม 'charger'"""
    s = str(value or "").strip().upper()
    if s in PM_TYPE_TO_SOURCE:
        return s
    return SOURCE_TO_PM_TYPE.get(s.lower(), "")


def _norm_pm_date(value: Any) -> str:
    """normalize เป็น YYYY-MM-DD — รองรับ ISO datetime ที่ Maximo ส่งมา"""
    s = str(value or "").strip()
    if not s:
        return ""
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return s[:10]


def _wo_coll():
    """iMPS.maximo_pm_workorders — motor async collection"""
    return client["iMPS"]["maximo_pm_workorders"]


# ══════════════════════════════════════════════════════════════════
# Location resolve
# ══════════════════════════════════════════════════════════════════
def _locations_for(source: str, identifier: str) -> tuple[list[str], str]:
    """
    หา maximo location ที่เกี่ยวข้องกับ tab/อุปกรณ์ที่กำลังดูอยู่

    charger → location ของตู้ (SN นั้น)
    ที่เหลือ → location ของสถานี

    Returns: (locations, station_id)
    """
    if source == "charger":
        charger = charger_collection.find_one(
            {"SN": identifier}, {"station_id": 1, "maximo_location": 1}
        ) or {}
        station_id = charger.get("station_id") or ""
        loc = charger.get("maximo_location") or ""
        if loc:
            return [loc], station_id
    else:
        station_id = identifier

    st = station_collection.find_one(
        {"station_id": station_id}, {"maximo_location": 1}
    ) or {}
    loc = st.get("maximo_location") or ""
    return ([loc] if loc else []), station_id


def _station_scope(source: str, identifier: str) -> tuple[str, str]:
    """
    หา station_id + maximo location "ระดับสถานี" ของ tab/อุปกรณ์ที่กำลังดูอยู่

    ใบงาน IN06 เปิดมาระดับสถานี — tab charger ที่ส่ง SN มา จึงต้อง map SN
    กลับเป็นสถานีก่อน ไม่งั้นจะไปเทียบกับ location ของตู้ (คนละระดับกัน)

    Returns: (station_id, station_location)
    """
    if source == "charger":
        charger = charger_collection.find_one(
            {"SN": identifier}, {"station_id": 1}
        ) or {}
        station_id = charger.get("station_id") or ""
    else:
        station_id = identifier

    if not station_id:
        return "", ""

    st = station_collection.find_one(
        {"station_id": station_id}, {"maximo_location": 1}
    ) or {}
    return station_id, (st.get("maximo_location") or "")


def _location_variants(location: str) -> list[str]:
    """
    รหัส location เดียวกันแต่เขียนต่างกัน — Maximo ส่ง "PTG0001-EV" มาได้ ขณะที่
    iMPS อาจเก็บ station root "PTG0001" ไว้ (หรือกลับกัน) เทียบตรง ๆ จะไม่เจอกัน
    แล้วใบงานจะเข้ามาแต่ไม่โผล่ในหน้า PM report

    Returns: [ตัวเดิม, แบบไม่มี -EV, แบบมี -EV] (ไม่ซ้ำ)
    """
    loc = (location or "").strip()
    if not loc:
        return []

    out = [loc]

    # location ระดับตู้ที่ Maximo ส่งมา เช่น "HMP0002-EV-BTL01GU001" หรือ
    # "ZOO0001-ES-WAC21GU001" — ตัดหางให้เหลือระดับสถานี ("HMP0002-EV")
    # ไม่งั้น reverse lookup ไม่เจอสถานี แล้วใบงานจะไม่โผล่ในหน้า PM report
    m = re.match(r"^(?P<station>.+?-(?:EV|ES))-.+$", loc, re.IGNORECASE)
    if m:
        out.append(m.group("station"))

    # ระดับสถานีลองทั้งแบบมีและไม่มี -EV ต่อท้าย (iMPS กับ Maximo เขียนคนละแบบได้)
    # ไม่ขยายให้ location ระดับตู้ เพราะ "…-BTL01GU001-EV" ไม่มีทางตรงกับอะไร
    station_level = [x for x in out if x.upper().endswith("-EV")] or [loc]
    for base in station_level:
        root = base[:-3] if base.upper().endswith("-EV") else base
        out.extend([root, f"{root}-EV"])

    return list(dict.fromkeys(x for x in out if x))


def _resolve_owner(location: str) -> dict:
    """
    map location ที่ Maximo ส่งมา → station_id / sn ของ iMPS (reverse lookup)
    """
    variants = _location_variants(location)
    if not variants:
        return {}

    # เทียบแบบไม่สนตัวพิมพ์เล็ก/ใหญ่ และเผื่อช่องว่างหัวท้ายที่ติดมาจากการพิมพ์
    # (เคสจริง: ตั้ง maximo_location เป็น "hmp0002-ev " แล้วหาไม่เจอทั้งที่ตั้งถูก)
    cond = {"$or": [
        {"maximo_location": {"$regex": rf"^\s*{re.escape(v)}\s*$", "$options": "i"}}
        for v in variants
    ]}

    charger = charger_collection.find_one(cond, {"SN": 1, "station_id": 1})
    if charger:
        return {"station_id": charger.get("station_id"), "sn": charger.get("SN")}

    st = station_collection.find_one(cond, {"station_id": 1})
    if st:
        return {"station_id": st.get("station_id"), "sn": None}

    log.warning(
        "  ⚠️  Maximo location %r ไม่ตรงกับ maximo_location ของสถานี/ตู้ไหนเลย "
        "— ใบงานจะเก็บไว้แต่ไม่ผูกกับ station_id (ลองแล้ว: %s)",
        location, variants,
    )
    return {}


# ══════════════════════════════════════════════════════════════════
# Normalize + upsert
# ══════════════════════════════════════════════════════════════════
def _normalize(raw: dict, origin: str) -> dict | None:
    """
    แปลง WO ดิบจาก Maximo เป็น shape ที่ iMPS ใช้

    3 field ที่ต้องมี: pm_type, location, pm_date
    (pm_date ยอมให้ fallback มาจาก targstartdate/schedstart ที่ Maximo ส่งมาด้วย)
    คืน None ถ้าขาดตัวใดตัวหนึ่ง → นับเป็น skipped
    """
    pm_type = _norm_pm_type(raw.get("pm_type") or raw.get("pmtype") or raw.get("zpmtype"))
    location = str(raw.get("location") or "").strip()
    pm_date = _norm_pm_date(
        raw.get("pm_date")
        or raw.get("pmdate")
        or raw.get("targstartdate")
        or raw.get("schedstart")
    )

    if not (pm_type and location and pm_date):
        return None

    owner = _resolve_owner(location)

    return {
        # ── 3 ตัวหลักจาก Maximo ──
        "pm_type": pm_type,
        "location": location,
        "pm_date": pm_date,
        "source": PM_TYPE_TO_SOURCE[pm_type],   # tab ที่ใบงานนี้สังกัด
        # ── ข้อมูลประกอบ (ถ้า Maximo ส่งมาด้วย) ──
        "wonum": str(raw.get("wonum") or "").strip() or None,
        "description": raw.get("description"),
        "status": raw.get("status"),
        "worktype": raw.get("worktype"),
        "targcompdate": raw.get("targcompdate"),
        # ── map กลับเข้าระบบ iMPS ──
        "station_id": owner.get("station_id"),
        "sn": owner.get("sn"),
        "origin": origin,             # "pull" | "webhook"
        "raw": raw,
        "updatedAt": datetime.now(timezone.utc),
    }


def _dedup_key(doc: dict) -> dict:
    """wonum ถ้ามี — ไม่มีก็ใช้ 3 ตัวหลักเป็น key แทน"""
    if doc.get("wonum"):
        return {"wonum": doc["wonum"]}
    return {
        "pm_type": doc["pm_type"],
        "location": doc["location"],
        "pm_date": doc["pm_date"],
    }


async def _upsert_many(items: list[dict], origin: str) -> dict:
    coll = _wo_coll()
    try:
        await coll.create_index("wonum", sparse=True)
        await coll.create_index([("pm_type", 1), ("location", 1), ("pm_date", 1)])
        await coll.create_index([("station_id", 1), ("source", 1), ("status", 1)])
    except Exception:
        pass

    inserted = updated = skipped = 0
    for raw in items:
        doc = _normalize(raw, origin)
        if not doc:
            skipped += 1
            continue
        res = await coll.update_one(
            _dedup_key(doc),
            {"$set": doc, "$setOnInsert": {"receivedAt": datetime.now(timezone.utc)}},
            upsert=True,
        )
        if res.upserted_id:
            inserted += 1
        elif res.modified_count:
            updated += 1

    return {"inserted": inserted, "updated": updated, "skipped": skipped}


# ══════════════════════════════════════════════════════════════════
# 1) Webhook — Maximo ยิงเข้ามาตอนเปิดใบงาน
# ══════════════════════════════════════════════════════════════════
class MaximoWorkOrderIn(BaseModel):
    """
    3 field ที่ต้องส่งมา:
      pm_type  — CG (charger) / MB (mdb) / CC (ccb) / CB (cb-box) / ST (station)
      location — รหัส Maximo location เช่น "PTG0001-EV-BTL01GU201"
      pm_date  — วันที่ทำ PM (YYYY-MM-DD หรือ ISO datetime)
    ที่เหลือเป็น optional — ส่งมาก็เก็บให้ ไม่ส่งก็ได้
    """
    pm_type: str
    location: str
    pm_date: str

    wonum: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    worktype: Optional[str] = None
    targcompdate: Optional[str] = None

    class Config:
        extra = "allow"


class MaximoWorkOrderBatchIn(BaseModel):
    workorders: list[MaximoWorkOrderIn] = Field(default_factory=list)


@router.post("/maximo/pm-workorder")
async def maximo_pm_workorder_webhook(
    body: MaximoWorkOrderIn | MaximoWorkOrderBatchIn,
    x_maximo_token: str | None = Header(default=None, alias="X-Maximo-Token"),
):
    """
    รับใบงาน PM ที่ Maximo เปิด — ยิงได้ทั้งใบเดียวและเป็น batch {"workorders": [...]}
    ป้องกันด้วย shared secret ใน header X-Maximo-Token (env MAXIMO_WEBHOOK_SECRET)
    """
    if not MAXIMO_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=503,
            detail="MAXIMO_WEBHOOK_SECRET is not configured on this server",
        )
    if x_maximo_token != MAXIMO_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="invalid X-Maximo-Token")

    if isinstance(body, MaximoWorkOrderBatchIn):
        items = [w.model_dump() for w in body.workorders]
    else:
        items = [body.model_dump()]

    if not items:
        return {"ok": True, "received": 0, "inserted": 0, "updated": 0, "skipped": 0}

    bad = [
        str(it.get("pm_type"))
        for it in items
        if not _norm_pm_type(it.get("pm_type"))
    ]
    if bad:
        raise HTTPException(
            status_code=400,
            detail=f"pm_type ไม่ถูกต้อง: {', '.join(sorted(set(bad)))} "
                   f"— ต้องเป็น {', '.join(PM_TYPE_TO_SOURCE)}",
        )

    stats = await _upsert_many(items, origin="webhook")
    log.info(f"  📥 Maximo webhook: {stats} ({len(items)} received)")
    return {"ok": True, "received": len(items), **stats}


# ══════════════════════════════════════════════════════════════════
# 2) Pull — iMPS ไปดึงจาก Maximo เอง
# ══════════════════════════════════════════════════════════════════
async def sync_workorders(locations: list[str] | None = None) -> dict:
    """ดึง WO จาก Maximo แล้ว upsert ลง DB — คืน stats"""
    members = await query_workorders(locations=locations)
    if members is None:
        return {"ok": False, "reason": "maximo_unavailable"}
    stats = await _upsert_many(members, origin="pull")
    return {"ok": True, "fetched": len(members), **stats}


@router.post("/pm-maximo/sync")
async def pm_maximo_sync(
    source: Optional[PMSource] = Query(None),
    identifier: Optional[str] = Query(None),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดึงใบงาน PM จาก Maximo เข้ามาเก็บใน iMPS
    - ไม่ส่ง source/identifier = ดึงทุก location
    - ส่งมา = ดึงเฉพาะ location ของ tab/อุปกรณ์นั้น
    """
    locations = None
    if source and identifier:
        locations, _ = _locations_for(source, identifier.strip())
        if not locations:
            raise HTTPException(
                status_code=400, detail="อุปกรณ์/สถานีนี้ยังไม่ได้ผูก Maximo location"
            )

    result = await sync_workorders(locations)
    if not result.get("ok"):
        raise HTTPException(status_code=502, detail="เรียก Maximo ไม่สำเร็จ")
    return result


# ══════════════════════════════════════════════════════════════════
# 3) Read — frontend อ่านใบงานที่รับเข้ามา
# ══════════════════════════════════════════════════════════════════
def _serialize(doc: dict) -> dict:
    return {
        "pm_type": doc.get("pm_type"),
        "location": doc.get("location"),
        "pm_date": doc.get("pm_date"),
        "source": doc.get("source"),
        "wonum": doc.get("wonum"),
        "description": doc.get("description"),
        "status": doc.get("status"),
        "worktype": doc.get("worktype"),
        "targcompdate": doc.get("targcompdate"),
        "station_id": doc.get("station_id"),
        "sn": doc.get("sn"),
        "origin": doc.get("origin"),
        "receivedAt": (
            doc["receivedAt"].isoformat() if isinstance(doc.get("receivedAt"), datetime) else None
        ),
    }


@router.get("/pm-maximo/work-orders")
async def pm_maximo_work_orders(
    source: PMSource = Query(...),
    identifier: str = Query(..., description="SN สำหรับ charger, station_id สำหรับ tab อื่น"),
    only_open: bool = Query(True, description="เอาเฉพาะใบงานที่ยังเปิดอยู่"),
    refresh: bool = Query(False, description="ดึงจาก Maximo ใหม่ก่อนอ่าน"),
    limit: int = Query(50, ge=1, le=200),
    current: UserClaims = Depends(get_current_user),
):
    """ใบงาน PM จาก Maximo ของ tab/อุปกรณ์ที่กำลังดูอยู่"""
    identifier = (identifier or "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="identifier is required")

    locations, station_id = _locations_for(source, identifier)

    if refresh and locations:
        await sync_workorders(locations)

    # pm_type คือตัวแยก tab — location ของ mdb/ccb/cb-box/station เป็นตัวเดียวกัน
    q: dict[str, Any] = {"pm_type": SOURCE_TO_PM_TYPE[source]}
    if locations:
        q["location"] = {"$in": locations}
    elif source == "charger":
        q["sn"] = identifier
    else:
        q["station_id"] = station_id

    if only_open:
        # ใบงานที่ Maximo ไม่ได้ส่ง status มา ถือว่ายังเปิดอยู่
        q["$or"] = [
            {"status": {"$in": list(OPEN_WO_STATUSES)}},
            {"status": {"$in": [None, ""]}},
        ]

    cursor = _wo_coll().find(q).sort([("pm_date", -1), ("_id", -1)]).limit(limit)
    docs = await cursor.to_list(length=limit)

    return {
        "items": [_serialize(d) for d in docs],
        "total": len(docs),
        "locations": locations,
        "station_id": station_id,
    }


# ══════════════════════════════════════════════════════════════════
# 4) Open — Maximo ยิงเข้ามาตอน "เปิดใบงาน PM"  (IN06)
#     field ที่ iMPS รับ: location, pm_date, wonum, status, company (+description)
#     บังคับจริงแค่ location — ที่เหลือขาดได้ (จะเตือนกลับไปใน response.warnings)
#
#    รับ payload แบบยืดหยุ่นโดยตั้งใจ: ชื่อฟิลด์ไม่สนตัวพิมพ์เล็ก/ใหญ่ รับชื่อพ้อง
#    (targstartdate/schedstart → pm_date) และรับได้ทั้ง object เดียว, array,
#    {"workorders":[…]} และ {"member":[…]} — เพราะ integration ฝั่ง Maximo
#    เปลี่ยนทรง payload ได้ตามที่ตั้งค่าไว้ เราไม่อยากให้ล้มทั้งใบเพราะ 422
#
#    ⚠️ location ที่ Maximo ส่งมาเป็น "ระดับสถานี" (station-level) — 1 ใบงาน
#    ต่อ 1 สถานี ไม่ได้ระบุอุปกรณ์ ผู้ใช้ต้องมาเลือกใน iMPS เองว่าจะ PM
#    อุปกรณ์ตัวไหนบ้าง (เลือกได้หลายตัว) → เก็บที่ field selected_equipment
#    ผ่าน POST /maximo/pm/{wonum}/equipment (ไม่ได้มาจาก Maximo)
#
#    ลงที่ collection iMPS.maximo_pm_open (แยกจาก maximo_pm_workorders
#    ของ pull/webhook เดิม เพื่อไม่ให้ 2 contract ปนกัน) — dedup ด้วย wonum
# ══════════════════════════════════════════════════════════════════
def _open_coll():
    """iMPS.maximo_pm_open — motor async collection"""
    return client["iMPS"]["maximo_pm_open"]


# ประเภทอุปกรณ์ที่เลือก PM ได้ในสถานีหนึ่ง ๆ (ตรงกับ tab ใน PM report)
EQUIP_TYPES = {"charger", "mdb", "ccb", "cbbox", "station"}
PM_PLANNING_ROLES = {"admin", "owner", "planner"}
# alias ที่ frontend/Maximo อาจส่งมา → normalize เป็น key มาตรฐาน
EQUIP_ALIASES = {"cb_box": "cbbox", "cbbox": "cbbox", "cb-box": "cbbox"}


# ── ชื่อฟิลด์ที่ Maximo (หรือ IESB) อาจส่งมา → key มาตรฐานของ iMPS ──
# เทียบแบบ case-insensitive และตัด _ / - / ช่องว่างออกก่อน เพราะ Maximo ส่ง
# attribute เป็นตัวพิมพ์ใหญ่ (LOCATION) บ้าง camelCase บ้าง แล้วแต่ integration
_FIELD_ALIASES: dict[str, str] = {
    # location (ระดับสถานี)
    "location": "location", "loc": "location", "zlocation": "location",
    "locationnum": "location", "siteloc": "location",
    # pm_date — Maximo เรียกวันนัดงานได้หลายชื่อแล้วแต่ object structure
    "pmdate": "pm_date", "zpmdate": "pm_date",
    "targstartdate": "pm_date", "targetstart": "pm_date",
    "schedstart": "pm_date", "startdate": "pm_date", "scheduledate": "pm_date",
    # wonum
    "wonum": "wonum", "wonumber": "wonum", "workorderid": "wonum",
    "woid": "wonum", "zwonum": "wonum",
    # status
    "status": "status", "wostatus": "status", "zstatus": "status",
    # company
    "company": "company", "companyname": "company", "zcompany": "company",
    # description
    "description": "description", "desc": "description",
    "zdescription": "description", "shortdesc": "description",
}

# key ที่ Maximo อาจใช้ห่อ list ของใบงานมา (batch)
_BATCH_KEYS = ("workorders", "workorder", "member", "wo", "data", "items")


def _alias_key(key: str) -> str:
    """'TARG_START_DATE' → 'targstartdate' → 'pm_date' (ไม่รู้จักก็คืนชื่อเดิม lowercase)"""
    flat = re.sub(r"[\s_\-.]", "", str(key)).lower()
    return _FIELD_ALIASES.get(flat, str(key).strip().lower())


def _canon(raw: Any) -> dict:
    """
    ทำ payload 1 ใบงานให้เป็น key มาตรฐาน

    - ชื่อฟิลด์ case-insensitive + ตัด _ - . ออก (LOCATION / Location / pm-date)
    - ค่า scalar ที่ไม่ใช่ string (เช่น status ส่งมาเป็นตัวเลข) แปลงเป็น string ให้
    - key ที่ไม่รู้จัก เก็บไว้ตามเดิม ไม่ทิ้ง
    """
    if not isinstance(raw, dict):
        return {}

    def _coerce(v: Any) -> Any:
        # status/company ที่ส่งมาเป็นตัวเลขล้วน ไม่ควรตกไปเพราะ type ไม่ตรง
        return str(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else v

    out: dict[str, Any] = {}
    # รอบแรก: ชื่อพ้อง (targstartdate → pm_date) — ใครมาก่อนได้ก่อน
    for k, v in raw.items():
        key = _alias_key(k)
        if out.get(key) in (None, ""):
            out[key] = _coerce(v)
    # รอบสอง: ชื่อจริงทับชื่อพ้องเสมอ — ถ้าส่ง targstartdate มาพร้อม pm_date
    # ต้องได้ค่าจาก pm_date ไม่ใช่ค่าที่ alias เขียนทิ้งไว้
    for k, v in raw.items():
        key = re.sub(r"[\s\-.]", "_", str(k).strip()).lower()
        if key in _FIELD_ALIASES.values() and v not in (None, ""):
            out[key] = _coerce(v)
    return out


def _extract_items(payload: Any) -> list[dict]:
    """
    ดึง list ของใบงานออกจาก body — รองรับทุกทรงที่ Maximo ยิงมาได้

      {...}                       ใบเดียว
      [{...}, {...}]              array ตรง ๆ (bulk ของ Maximo REST)
      {"workorders": [...]}       batch ตามสัญญาเดิม
      {"member": [...]}           ทรงมาตรฐานของ Maximo OSLC
      {"ZAPIWO": {"member": [...]}}  publish channel ที่ห่ออีกชั้น
    """
    if isinstance(payload, list):
        return [_canon(x) for x in payload if isinstance(x, dict)]

    if not isinstance(payload, dict):
        return []

    lowered = {str(k).strip().lower(): v for k, v in payload.items()}
    for key in _BATCH_KEYS:
        val = lowered.get(key)
        if isinstance(val, list):
            return [_canon(x) for x in val if isinstance(x, dict)]
        if isinstance(val, dict):
            # ห่ออีกชั้น เช่น {"ZAPIWO": {"member": [...]}} — ไล่เข้าไปข้างใน
            return _extract_items(val)

    # envelope ชั้นเดียวที่ key เป็นชื่อ object structure: {"ZAPIWO": {...}}
    if len(payload) == 1:
        only = next(iter(payload.values()))
        if isinstance(only, (list, dict)):
            inner = _extract_items(only)
            if inner:
                return inner

    return [_canon(payload)]


def _normalize_open(raw: dict) -> dict | None:
    """แปลง WO ที่ Maximo ส่งมาเป็น shape ที่เก็บ — คืน None ถ้าไม่มี location"""
    location = str(raw.get("location") or "").strip()
    if not location:
        return None

    owner = _resolve_owner(location)

    def _text(key: str) -> str | None:
        v = raw.get(key)
        return str(v).strip() or None if v not in (None, "") else None

    def _upper(key: str) -> str | None:
        """wonum/status สเปกระบุ type = UPPER — เก็บเป็นตัวพิมพ์ใหญ่เสมอ
        ไม่งั้น status ตัวเล็กจะไม่ match OPEN_WO_STATUSES แล้วใบงานหายจากหน้า PM"""
        v = _text(key)
        return v.upper() if v else None

    return {
        "location": location,
        "description": _text("description"),
        "pm_date": _norm_pm_date(raw.get("pm_date")),
        "wonum": _upper("wonum"),
        # สเปก IN06 กำหนด Default = OPEN เมื่อ Maximo ไม่ได้ส่ง status มา
        "status": _upper("status") or "OPEN",
        "company": _text("company"),
        # ── map กลับเข้าระบบ iMPS ──
        "station_id": owner.get("station_id"),
        "sn": owner.get("sn"),
        "origin": "maximo-open",
        "raw": raw,
        "updatedAt": datetime.now(timezone.utc),
    }


def _open_dedup_key(doc: dict) -> dict:
    """ใช้ wonum เป็น key กันซ้ำ (ยิง wonum เดิมซ้ำ = อัปเดตใบเดิม)"""
    if doc.get("wonum"):
        return {"wonum": doc["wonum"]}
    # กันเหนียว: ถ้าไม่มี wonum ใช้ location + pm_date
    return {"location": doc["location"], "pm_date": doc.get("pm_date")}


async def _upsert_open(items: list[dict], inbound: dict | None = None) -> dict:
    coll = _open_coll()
    try:
        await coll.create_index("wonum", sparse=True)
        await coll.create_index([("location", 1), ("pm_date", -1)])
        await coll.create_index([("station_id", 1), ("status", 1)])
    except Exception:
        pass

    inserted = updated = skipped = 0
    for raw in items:
        doc = _normalize_open(raw)
        if not doc:
            skipped += 1
            continue
        # เก็บของดิบที่ Maximo ยิงมา + สิ่งที่เราตอบกลับ ไว้ดูย้อนหลังได้
        # (ที่ผ่านมามีแต่ log ฝั่ง server ซึ่งหมุนทิ้งแล้วตามไม่ได้)
        set_doc = dict(doc)
        if inbound is not None:
            set_doc["maximo_inbound"] = {**inbound, "item": raw}

        res = await coll.update_one(
            _open_dedup_key(doc),
            {
                "$set": set_doc,
                # selected_equipment เป็นค่าที่ผู้ใช้เลือกฝั่ง iMPS — ตั้งค่าเริ่มต้น
                # เฉพาะตอน insert เท่านั้น เพื่อไม่ให้ Maximo ยิงซ้ำมาล้างของที่เลือกไว้
                "$setOnInsert": {
                    "receivedAt": datetime.now(timezone.utc),
                    "selected_equipment": [],
                },
            },
            upsert=True,
        )
        if res.upserted_id:
            inserted += 1
        elif res.modified_count:
            updated += 1

    return {"inserted": inserted, "updated": updated, "skipped": skipped}


# header ที่รับ shared secret ได้ — Maximo/IESB บาง integration ตั้ง custom header
# ไม่ได้ เลยรับ apikey / Authorization: Bearer ให้ด้วย (ค่าเดียวกัน ไม่ได้ลดความปลอดภัย)
_TOKEN_HEADERS = ("x-maximo-token", "apikey", "x-api-key", "authorization")


def _extract_token(request: Request) -> tuple[str, list[str]]:
    """คืน (token ที่เจอ, ชื่อ header ที่ client ส่งมาจริง) — ไว้ log ตอน auth ไม่ผ่าน"""
    seen: list[str] = []
    token = ""
    for name in _TOKEN_HEADERS:
        val = (request.headers.get(name) or "").strip()
        if not val:
            continue
        seen.append(name)
        if name == "authorization":
            val = re.sub(r"^Bearer\s+", "", val, flags=re.IGNORECASE).strip()
        if not token:
            token = val
    return token, seen


@router.post("/maximo/pm/open")
@router.post("/maximo/pm/open/")   # กัน client ที่เติม / ท้าย URL แล้วไม่ตาม 307 redirect
async def maximo_pm_open(
    request: Request,
    verbose: bool = Query(False, description="ตอบรายละเอียด inserted/updated/warnings ด้วย (ใช้ตอนดีบัก)"),
):
    """
    รับใบงาน PM ที่ Maximo เปิด (push/webhook — IN06)

    ยิงได้ทั้งใบเดียว (location = ระดับสถานี):
        {
          "location": "PTG0001-EV",
          "pm_date": "2026-07-22",
          "wonum": "WO26070001",
          "status": "APPR",
          "company": "PTG"
        }
    เป็น batch: { "workorders": [ {…}, {…} ] } หรือ array ตรง ๆ [ {…}, {…} ]

    ตั้งใจรับแบบยืดหยุ่น — ชื่อฟิลด์ไม่สนตัวพิมพ์เล็ก/ใหญ่, รับชื่อพ้อง
    (targstartdate/schedstart → pm_date, workorderid → wonum ฯลฯ), field เดียว
    ที่ขาดไม่ได้คือ location ส่วน pm_date/wonum/status/company ขาดได้แต่จะเตือนกลับไป
    เพื่อไม่ให้ integration ล้มทั้งใบเพราะฟิลด์ประกอบตัวเดียว

    ป้องกันด้วย shared secret (env MAXIMO_WEBHOOK_SECRET) ส่งมาทาง header
    X-Maximo-Token / apikey / X-API-Key / Authorization: Bearer <secret>
    """
    ctype = request.headers.get("content-type") or "-"
    body_bytes = await request.body()

    if not MAXIMO_WEBHOOK_SECRET:
        log.error("  ❌ IN06 rejected: MAXIMO_WEBHOOK_SECRET ไม่ได้ตั้งค่าบน server นี้")
        raise HTTPException(
            status_code=503,
            detail="MAXIMO_WEBHOOK_SECRET is not configured on this server",
        )

    token, seen_headers = _extract_token(request)
    if token != MAXIMO_WEBHOOK_SECRET:
        log.warning(
            "  🔒 IN06 auth failed — token headers ที่ได้รับ=%s (ต้องส่ง X-Maximo-Token), "
            "content-type=%r, %d bytes",
            seen_headers or "ไม่มีเลย", ctype, len(body_bytes),
        )
        raise HTTPException(
            status_code=401,
            detail="invalid or missing shared secret — ส่งมาทาง header X-Maximo-Token",
        )

    # parse เอง ไม่ผ่าน pydantic body model: Maximo จะได้ไม่โดน 422 ที่อ่านไม่รู้เรื่อง
    # และ log เห็น body จริงทุกครั้งแม้ payload ผิดทรง (422 ของ FastAPI ไม่เข้ามาถึงตรงนี้)
    try:
        payload = json.loads(body_bytes or b"")
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        log.warning(
            "  ❌ IN06 body ไม่ใช่ JSON: %s | content-type=%r | body=%r",
            e, ctype, body_bytes[:500],
        )
        raise HTTPException(status_code=400, detail=f"body ต้องเป็น JSON: {e}")

    items = _extract_items(payload)
    log.info(
        "  📥 IN06 received: %d item(s) | content-type=%r | body=%s",
        len(items), ctype, (body_bytes[:1000].decode("utf-8", "replace") or "-"),
    )

    if not items:
        raise HTTPException(
            status_code=400,
            detail="ไม่พบใบงานใน body — ส่งเป็น object ใบเดียว, array "
                   'หรือ {"workorders": [...]}',
        )

    no_location = [i for i, it in enumerate(items) if not str(it.get("location") or "").strip()]
    if no_location:
        got = sorted({k for it in items for k in it})
        log.warning("  ❌ IN06 ขาด location ในลำดับ %s | key ที่ได้รับ=%s", no_location, got)
        raise HTTPException(
            status_code=400,
            detail=f"location จำเป็นต้องมี — ขาดในรายการลำดับ {no_location} "
                   f"(key ที่ได้รับ: {', '.join(got) or 'ไม่มี'})",
        )

    # field ที่สเปกระบุ Required=Y แต่ไม่ได้ส่งมา — รับเข้าไปก่อน ไม่ปฏิเสธทั้งใบ
    # (company สเปกเป็น Required=N จึงไม่นับ)
    warnings = [
        f"item[{i}] ไม่ได้ส่ง {f}"
        for i, it in enumerate(items)
        for f in ("pm_date", "wonum", "status")
        if not str(it.get(f) or "").strip()
    ]
    if warnings:
        log.warning("  ⚠️  IN06 field ไม่ครบ: %s", "; ".join(warnings))

    response_body = {"status": "OK"}
    inbound = {
        "at": datetime.now(timezone.utc),
        "content_type": ctype,
        "token_headers": seen_headers or None,
        # body ดิบทั้งก้อน (ตัดที่ 4000 ตัว) — เห็นว่าเขาส่งมาจริง ๆ หน้าตาแบบไหน
        "raw_body": (body_bytes[:4000].decode("utf-8", "replace") or None),
        "received": len(items),
        "warnings": warnings or None,
        "response": response_body,
    }

    stats = await _upsert_open(items, inbound=inbound)
    log.info(f"  ✅ IN06 stored: {stats} ({len(items)} received)")

    # สเปก IN06 กำหนด response ไว้แค่ {"status": "OK"} — ตอบเกินไปกว่านี้ไม่ได้
    # เผื่อฝั่ง EGAT validate schema ตอน UAT. รายละเอียดดูจาก log หรือ ?verbose=1
    if verbose:
        return {"status": "OK", "received": len(items), **stats, "warnings": warnings}
    return {"status": "OK"}


@router.get("/maximo/pm/ping")
@router.post("/maximo/pm/ping")
async def maximo_pm_ping(request: Request):
    """
    ให้ฝั่ง Maximo ทดสอบได้เองว่าติดตรงไหน โดยไม่ต้องยิงใบงานจริงเข้ามา

      404/timeout → ยิงไม่ถึง iMPS (network / nginx / URL ผิด)
      503         → ถึงแล้ว แต่ server ยังไม่ได้ตั้ง MAXIMO_WEBHOOK_SECRET
      401         → ถึงแล้ว แต่ token ผิด/ไม่ได้ส่ง (ดู token_headers_received)
      200         → เชื่อมต่อ + auth ผ่าน เหลือแค่รูป payload
    """
    token, seen_headers = _extract_token(request)
    if not MAXIMO_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=503,
            detail="MAXIMO_WEBHOOK_SECRET is not configured on this server",
        )
    if token != MAXIMO_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=401,
            detail={
                "message": "invalid or missing shared secret",
                "token_headers_received": seen_headers,
                "expected_header": "X-Maximo-Token",
            },
        )
    return {
        "status": "OK",
        "endpoint": "POST /maximo/pm/open",
        "required_fields": ["location"],
        "optional_fields": ["pm_date", "wonum", "status", "company", "description"],
    }


def _serialize_open(doc: dict) -> dict:
    return {
        "location": doc.get("location"),
        "description": doc.get("description"),
        "pm_date": doc.get("pm_date"),
        "wonum": doc.get("wonum"),
        "status": doc.get("status"),
        "company": doc.get("company"),
        "station_id": doc.get("station_id"),
        "sn": doc.get("sn"),
        "origin": doc.get("origin"),
        # อุปกรณ์ที่ผู้ใช้เลือกจะ PM ในฝั่ง iMPS (เลือกได้หลายตัว)
        "selected_equipment": doc.get("selected_equipment") or [],
        "selected_at": (
            doc["selected_at"].isoformat() if isinstance(doc.get("selected_at"), datetime) else None
        ),
        "selected_by": doc.get("selected_by"),
        "assignees": doc.get("assignees") or [],
        "planned_at": doc.get("planned_at"),
        "planned_by": doc.get("planned_by"),
        "sched_start": doc.get("sched_start"),
        "sched_finish": doc.get("sched_finish"),
        "planning_status": doc.get("planning_status") or "pending",
        "receivedAt": (
            doc["receivedAt"].isoformat() if isinstance(doc.get("receivedAt"), datetime) else None
        ),
    }


@router.get("/maximo/pm/open")
async def list_maximo_pm_open(
    source: Optional[PMSource] = Query(None, description="tab ที่กำลังดูอยู่ใน PM report"),
    identifier: Optional[str] = Query(
        None, description="SN สำหรับ charger, station_id สำหรับ tab อื่น"
    ),
    location: Optional[str] = Query(None, description="กรองตาม Maximo location"),
    station_id: Optional[str] = Query(None, description="กรองตาม station_id ของ iMPS"),
    only_open: bool = Query(True, description="เอาเฉพาะใบงานที่ยังเปิดอยู่"),
    verify: bool = Query(True, description="เช็คกับ Maximo ว่า wonum มีอยู่จริงไหม"),
    # หน้า PM List ดึงรวมทุกสถานีในครั้งเดียว จึงต้องเพดานสูงกว่าหน้า tab เดี่ยว
    limit: int = Query(50, ge=1, le=1000),
    current: UserClaims = Depends(get_current_user),
):
    """
    อ่านใบงาน PM ที่ Maximo เปิดเข้ามาทาง IN06 (protected — ต้อง login)

    กรองได้ 2 แบบ:
      - source + identifier — ใช้จากหน้า PM report แต่ละ tab (charger ส่ง SN มา
        ระบบจะ map กลับเป็นสถานีให้เอง เพราะใบงาน IN06 เป็นระดับสถานี)
      - location / station_id — กรองตรง ๆ
    ไม่ส่งอะไรมาเลย = เอาทุกใบ
    """
    and_clauses: list[dict[str, Any]] = []

    if source and (identifier or "").strip():
        sid, station_location = _station_scope(source, identifier.strip())
        if not (sid or station_location):
            # อุปกรณ์/สถานีนี้ยังผูกกับ Maximo ไม่ได้ — ไม่มีใบงานให้แสดง
            return {"items": [], "total": 0}
        # station_id ของ WO มาจาก reverse lookup ตอนรับเข้า ซึ่งจะว่างถ้าสถานี
        # ยังไม่ได้ตั้ง maximo_location → เทียบ location ควบไว้ด้วยกันเหนียว
        scope = [{"station_id": sid}] if sid else []
        if station_location:
            # เทียบทั้ง "PTG0001" และ "PTG0001-EV" — Maximo กับ iMPS เขียนคนละแบบได้
            scope.append({"location": {"$in": _location_variants(station_location)}})
        and_clauses.append({"$or": scope})

    if location:
        and_clauses.append({"location": location.strip()})
    if station_id:
        and_clauses.append({"station_id": station_id.strip()})
    if only_open:
        # ใบงานที่ Maximo ไม่ได้ส่ง status มา ถือว่ายังเปิดอยู่
        and_clauses.append({
            "$or": [
                {"status": {"$in": list(OPEN_WO_STATUSES)}},
                {"status": {"$in": [None, ""]}},
            ]
        })

    q: dict[str, Any] = {"$and": and_clauses} if and_clauses else {}

    cursor = _open_coll().find(q).sort([("pm_date", -1), ("_id", -1)]).limit(limit)
    docs = await cursor.to_list(length=limit)

    # ── กรองตามอุปกรณ์ที่ planner เลือกไว้ ──
    # ใบงาน Maximo เป็นระดับสถานี ถ้าไม่กรอง ใบเดียวจะโผล่ครบทุก tab และทุกตู้
    # ในสถานี ทั้งที่ planner เลือก PM แค่บางตัว
    #   ยังไม่ได้วางแผน (selected_equipment ว่าง) → โชว์ทุก tab ให้ planner หาเจอ
    #   วางแผนแล้ว → โชว์เฉพาะ tab/ตู้ ที่ถูกเลือก
    if source:
        want = _norm_equip_type(source)
        ident = (identifier or "").strip()

        def _picked(d: dict) -> bool:
            items = d.get("selected_equipment") or []
            if not items:
                return True
            for e in items:
                if _norm_equip_type(e.get("type")) != want:
                    continue
                if want != "charger":
                    return True
                # charger เจาะจงถึงตู้ — ไม่ระบุ identifier ก็ถือว่าเอาหมด
                if not ident or str(e.get("sn") or "").strip() == ident:
                    return True
            return False

        docs = [d for d in docs if _picked(d)]

    # ใบที่รับเข้ามาตอนสถานียังไม่ได้ตั้ง maximo_location จะมี station_id ว่างค้างอยู่
    # ลองหาใหม่ตอนอ่าน แล้วเขียนกลับให้ถาวร (ไม่ต้องรอ Maximo ยิงซ้ำ)
    for d in docs:
        if not (d.get("station_id") or "").strip():
            sid = _station_id_of_wo(d)
            if sid:
                d["station_id"] = sid
                try:
                    await _open_coll().update_one({"_id": d["_id"]}, {"$set": {"station_id": sid}})
                except Exception as e:
                    log.warning(f"  ⚠️ backfill station_id ของ {d.get('wonum')} ไม่สำเร็จ: {e}")

    items = [_serialize_open(d) for d in docs]

    # เช็คว่าใบไหนมีอยู่จริงใน Maximo — ถามทีเดียวทั้งชุด
    # ล้มก็ปล่อยผ่าน (คืน exists_in_maximo = None = ยังไม่รู้) ไม่บล็อกการแสดงผล
    if verify:
        try:
            found = await maximo_svc.workorders_exist([i.get("wonum") for i in items])
            for i in items:
                wn = str(i.get("wonum") or "").strip()
                hit = found.get(wn)
                i["exists_in_maximo"] = bool(hit) if wn else None
                if hit:
                    i["maximo_status"] = hit.get("status")
                    i["maximo_worktype"] = hit.get("worktype")
        except Exception as e:
            log.warning(f"  ⚠️ เช็ค wonum กับ Maximo ไม่สำเร็จ: {e}")
            for i in items:
                i["exists_in_maximo"] = None

    return {"items": items, "total": len(items)}


# ══════════════════════════════════════════════════════════════════
# 5) Select equipment — ผู้ใช้เลือกอุปกรณ์ที่จะ PM ในฝั่ง iMPS
#    Maximo ส่งใบงานมาระดับสถานี → ผู้ใช้เลือกได้หลายอุปกรณ์ต่อ 1 ใบงาน
# ══════════════════════════════════════════════════════════════════
def _norm_equip_type(value: Any) -> str:
    s = str(value or "").strip().lower()
    return EQUIP_ALIASES.get(s, s)


class EquipmentItem(BaseModel):
    """1 อุปกรณ์ที่เลือกจะ PM — charger ระบุ sn ด้วย, อุปกรณ์ระดับสถานีใส่แค่ type"""
    type: str                          # charger / mdb / ccb / cbbox / station
    sn: Optional[str] = None           # สำหรับ charger (ระบุตู้)
    location: Optional[str] = None     # maximo location ของอุปกรณ์ (ถ้ามี)
    label: Optional[str] = None        # ชื่อไว้โชว์


class SelectEquipmentIn(BaseModel):
    # None = ไม่แตะรายการอุปกรณ์เดิม (หน้าวางแผน PM ไม่ได้ให้เลือกอุปกรณ์แล้ว)
    # []   = ล้างรายการทิ้ง
    equipment: Optional[list[EquipmentItem]] = None
    planned_at: Optional[str] = None
    sched_start: Optional[str] = None
    sched_finish: Optional[str] = None
    assignees: list[str] = Field(default_factory=list)


async def _find_open_wo(wonum: str) -> dict | None:
    return await _open_coll().find_one({"wonum": wonum})


def _station_id_of_wo(wo: dict) -> str:
    """
    station_id ของใบงาน — ถ้าตอนรับเข้า reverse lookup ไม่ติด (สถานี/ตู้ยังไม่ได้ตั้ง
    maximo_location ตอนนั้น) ให้ลองหาจาก location ซ้ำอีกรอบ ไม่งั้นรายการอุปกรณ์
    จะว่างเปล่าทั้งที่สถานีมีตู้อยู่
    """
    sid = (wo.get("station_id") or "").strip()
    if sid:
        return sid
    return (_resolve_owner(wo.get("location") or "") or {}).get("station_id") or ""


# ══════════════════════════════════════════════════════════════════
# สถานะการ sync ของเอกสาร PM + ยิงซ้ำ (คู่กับ /cm-maximo/{id}/sync ของฝั่ง CM)
# ══════════════════════════════════════════════════════════════════
PM_SYNC_ROLES: set[str] = {"admin", "owner", "planner"}


def _serialize_sync(doc: dict) -> dict:
    """maximo_sync ของเอกสาร → JSON (datetime → ISO)"""
    out: dict[str, Any] = {}
    for key, entry in (doc.get("maximo_sync") or {}).items():
        if not isinstance(entry, dict):
            continue
        at = entry.get("at")
        out[key] = {
            **{k: v for k, v in entry.items() if k != "at"},
            "at": at.isoformat() if isinstance(at, datetime) else None,
        }
    return out


async def _load_pm_report(report_id: str, sn: str):
    """เอกสาร PM ของ charger + collection ของ SN นั้น"""
    from routers.pm_helpers import get_pmreport_collection_for

    coll = get_pmreport_collection_for(sn)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")
    doc = await coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return coll, oid, doc


@router.get("/pm-maximo/wo/{wonum}/sync")
async def pm_wo_sync_status(
    wonum: str,
    current: UserClaims = Depends(get_current_user),
):
    """
    ใบงาน PM 1 ใบ: Maximo ส่งอะไรเข้ามา (IN06) และเรายิงอะไรกลับไปแล้วบ้าง

    ใช้ได้ตั้งแต่ยังไม่มีเอกสาร PM (ด่านวางแผนของ planner) ต่างจาก
    /pm-maximo/{report_id}/sync ที่ต้องมีเอกสารก่อน
    """
    wonum = (wonum or "").strip()
    wo = await _find_open_wo(wonum)
    if not wo:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบงาน wonum={wonum}")

    inbound = dict(wo.get("maximo_inbound") or {})
    if isinstance(inbound.get("at"), datetime):
        inbound["at"] = inbound["at"].isoformat()

    # None = เช็คกับ Maximo ไม่ได้ (ไม่ใช่ "ไม่มี")
    try:
        found = await maximo_svc.workorders_exist([wonum])
        exists = wonum in found
        in_maximo = found.get(wonum) or None
    except Exception as e:
        log.warning(f"  ⚠️ เช็ค wonum {wonum} กับ Maximo ไม่สำเร็จ: {e}")
        exists, in_maximo = None, None

    # IN03/IN09/IN02(COMP) จดไว้บนเอกสาร PM ไม่ใช่บนใบงาน — ใบงานมีแต่ IN02(INPRG)
    # ถ้าอ่านแค่ใบงาน หน้านี้จะค้างอยู่ที่ INPRG ตลอดกาลทั้งที่ปิดงานไปแล้ว
    reports = await pm_flow.wo_reports(wonum)

    merged = _serialize_sync(wo)
    for rep in reports:
        rep["interfaces"] = _serialize_sync(rep)
        rep.pop("maximo_sync", None)
        # เอกสารเป็นตัวยิงจริง ทับของใบงานได้เลยเมื่อชนกัน (IN02 COMP มาทีหลัง INPRG)
        merged.update(rep["interfaces"])

    return {
        "wonum": wonum,
        "exists_in_maximo": exists,
        "maximo_workorder": in_maximo,
        "location": wo.get("location") or "",
        "station_id": _station_id_of_wo(wo),
        "planning_status": wo.get("planning_status") or "pending",
        "assignees": wo.get("assignees") or [],
        # ขาเข้า: IN06 ที่ Maximo ยิงมา + response ที่เราตอบกลับ
        "inbound": inbound or None,
        # ขาออก: รวมของใบงาน (IN02 INPRG ตอน assign) กับของเอกสารทุกใบในใบงานนี้
        "interfaces": merged,
        # แยกรายเอกสารไว้ด้วย ใบงานเดียวมีได้หลายอุปกรณ์
        "reports": reports,
        "progress": await pm_flow.wo_completion(wonum),
    }


@router.get("/pm-maximo/{report_id}/sync")
async def pm_sync_status(
    report_id: str,
    sn: str = Query(..., description="SN ของตู้ (เอกสาร PM charger เก็บแยกตาม SN)"),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดูว่าเอกสาร PM ใบนี้ยิงอะไรเข้า Maximo ไปแล้วบ้าง

    รวม 2 ที่ไว้ให้ในครั้งเดียว:
      report    — IN03 / IN09 / IN02 (COMP) ที่จดไว้บนเอกสาร PM
      workorder — IN02 (INPRG) ที่จดไว้บนใบงานใน maximo_pm_open ตอน planner assign
    """
    _, _, doc = await _load_pm_report(report_id, sn.strip())
    wonum = (doc.get("wonum") or "").strip()

    wo_sync: dict = {}
    if wonum:
        wo = await _open_coll().find_one({"wonum": wonum}) or {}
        wo_sync = _serialize_sync(wo)

    return {
        "issue_id": doc.get("issue_id") or "",
        "doc_name": doc.get("doc_name") or "",
        "status": doc.get("status") or "",
        "wonum": wonum,
        "sn": sn,
        "station_id": doc.get("station_id") or "",
        "interfaces": _serialize_sync(doc),
        "workorder_interfaces": wo_sync,
    }


@router.post("/pm-maximo/{report_id}/sync")
async def pm_sync_retry(
    report_id: str,
    sn: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """ยิงชุดปิดงาน (IN03 → IN09 → IN02 COMP) ใหม่ — ใช้เมื่อรอบก่อนล้ม"""
    role = (current.role or "").strip().lower()
    if role not in PM_SYNC_ROLES and not getattr(current, "is_super_admin", False):
        raise HTTPException(status_code=403, detail="Only planner, owner or admin can re-sync")

    coll, oid, doc = await _load_pm_report(report_id, sn.strip())

    from services import pm_maximo_out
    result = await pm_maximo_out.safe_sync_closed(
        coll, oid, doc, memo=f"manual re-sync by {current.username}"
    )
    fresh = await coll.find_one({"_id": oid}) or {}
    return {"ok": True, "result": result, "interfaces": _serialize_sync(fresh)}


@router.get("/maximo/pm/{wonum}/equipment-choices")
async def pm_equipment_choices(
    wonum: str,
    current: UserClaims = Depends(get_current_user),
):
    """
    รายการอุปกรณ์ที่เลือก PM ได้ภายใต้สถานีของใบงานนี้
    (ตู้ชาร์จทุกตู้ในสถานี + อุปกรณ์ระดับสถานี mdb/ccb/cbbox/station)
    ให้ frontend เอาไปทำ checkbox เลือกหลายตัว
    """
    wonum = (wonum or "").strip()
    doc = await _find_open_wo(wonum)
    if not doc:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบงาน wonum={wonum}")

    station_id = _station_id_of_wo(doc)
    chargers: list[dict] = []
    if station_id:
        # charger_collection เป็น pymongo (sync) — วนตรง ๆ ได้
        cursor = charger_collection.find(
            {"station_id": station_id},
            {"_id": 0, "SN": 1, "chargeBoxID": 1, "name": 1, "charger_name": 1,
             "maximo_location": 1, "chargerNo": 1},
        ).sort([("chargerNo", 1), ("SN", 1)])
        for idx, c in enumerate(cursor, start=1):
            # ตู้ที่ไม่มี SN เลือกไปก็บันทึกไม่ผ่าน (type charger บังคับ sn) — ไม่ต้องเสนอ
            if not str(c.get("SN") or "").strip() or c.get("SN") == "-":
                continue
            # ป้ายชื่อใช้หมายเลขตู้ ("Charger 1", "Charger 2") ไม่ใช่ location ของ Maximo
            # ซึ่งเป็นรหัสที่ผู้ใช้อ่านแล้วไม่รู้ว่าเป็นตู้ไหน — ไม่มี chargerNo ก็ไล่ตามลำดับ
            charger_no = c.get("chargerNo") or idx
            chargers.append({
                "type": "charger",
                "sn": c.get("SN"),
                "label": f"Charger {charger_no}",
                "location": c.get("maximo_location"),
            })

    fixed = [{"type": t} for t in ("mdb", "ccb", "cbbox", "station")]

    return {
        "wonum": wonum,
        "station_id": station_id,
        "location": doc.get("location"),
        "chargers": chargers,          # เลือกได้หลายตู้
        "fixed": fixed,                # อุปกรณ์ระดับสถานี
        "selected_equipment": doc.get("selected_equipment") or [],
    }


@router.post("/maximo/pm/{wonum}/equipment")
async def set_pm_equipment(
    wonum: str,
    body: SelectEquipmentIn,
    current: UserClaims = Depends(get_current_user),
):
    """
    บันทึกอุปกรณ์ที่ผู้ใช้เลือกจะ PM (เลือกได้หลายตัว) ผูกกับใบงาน Maximo ระดับสถานี
    ยิงทับได้ — ส่ง list ใหม่มาแทนของเดิมทั้งชุด
    """
    wonum = (wonum or "").strip()
    if not wonum:
        raise HTTPException(status_code=400, detail="wonum is required")

    role = (current.role or "").strip().lower()
    if role not in PM_PLANNING_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Only planner, owner or admin can plan PM equipment",
        )

    wo = await _find_open_wo(wonum)
    if not wo:
        raise HTTPException(status_code=404, detail=f"PM work order not found: {wonum}")

    # ใบที่เลขไม่มีอยู่จริงใน Maximo วางแผนไปก็ยิงสถานะกลับไม่ได้ (BMXAA1496E)
    # เตือนตั้งแต่ตอนกด Assign ดีกว่าไปพังตอนปิดงาน
    # เช็คกับ Maximo ไม่ได้ (ล่ม/เน็ตมีปัญหา) = ปล่อยผ่าน ไม่บล็อกงาน
    try:
        found = await maximo_svc.workorders_exist([wonum])
    except Exception as e:
        log.warning(f"  ⚠️ เช็ค wonum {wonum} กับ Maximo ไม่สำเร็จ ปล่อยผ่าน: {e}")
        found = {wonum: {}}
    if wonum not in found:
        raise HTTPException(
            status_code=409,
            detail=f"ใบงาน {wonum} ไม่มีอยู่จริงใน Maximo — วางแผนแล้วส่งสถานะกลับไม่ได้ "
                   f"(อาจเป็น payload ทดสอบที่ยิงเข้ามา) กรุณาตรวจกับฝั่ง Maximo ก่อน",
        )

    # ไม่รู้ว่าเป็นสถานีไหนใน iMPS = สร้างเอกสาร PM ไม่ได้ (ทุกชนิด key ด้วย station_id
    # หรือ SN ของตู้ในสถานี) วางแผนไปก็ทำงานต่อไม่ได้ — กันตั้งแต่ตรงนี้
    if not _station_id_of_wo(wo):
        raise HTTPException(
            status_code=409,
            detail=f"location {wo.get('location') or '-'} ไม่ตรงกับสถานีไหนใน iMPS — "
                   f"ถ้าเป็นสถานีที่เราดูแล ให้ตั้ง maximo_location ที่หน้า EV Stations ก่อน "
                   f"ถ้าไม่ใช่ ให้ข้ามใบงานนี้ไป",
        )

    items: list[dict] = []
    seen: set[str] = set()
    for e in (body.equipment or []):
        etype = _norm_equip_type(e.type)
        if etype not in EQUIP_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"ประเภทอุปกรณ์ไม่ถูกต้อง: {e.type} — ต้องเป็น {', '.join(sorted(EQUIP_TYPES))}",
            )
        if etype == "charger" and not (e.sn or "").strip():
            raise HTTPException(
                status_code=400, detail="charger ต้องระบุ sn ของตู้ที่จะ PM"
            )
        key = f"charger:{(e.sn or '').strip()}" if etype == "charger" else etype
        if key in seen:
            raise HTTPException(status_code=400, detail="Duplicate equipment in PM plan")
        seen.add(key)

        item = {"type": etype}
        if etype == "charger":
            station_id = _station_id_of_wo(wo)
            if not station_id:
                raise HTTPException(
                    status_code=409,
                    detail="This PM work order is not mapped to an iMPS station",
                )
            sn = (e.sn or "").strip()
            charger = charger_collection.find_one(
                {"station_id": station_id, "SN": sn},
                {"SN": 1, "chargeBoxID": 1, "name": 1, "charger_name": 1, "maximo_location": 1},
            )
            if not charger:
                raise HTTPException(
                    status_code=400,
                    detail=f"Charger SN={sn} is not in this work order station",
                )
            item["sn"] = sn
            item["location"] = (charger.get("maximo_location") or "").strip() or None
            item["label"] = (
                charger.get("name")
                or charger.get("charger_name")
                or charger.get("chargeBoxID")
                or sn
            )
        else:
            if e.location:
                item["location"] = e.location.strip()
            if e.label:
                item["label"] = e.label
        items.append(item)

    now = datetime.now(timezone.utc)
    planned_at_value = (body.planned_at or now.isoformat()).strip()
    sched_start_value = (body.sched_start or "").strip()
    sched_finish_value = (body.sched_finish or "").strip()
    assignees = [str(x).strip() for x in body.assignees if str(x or "").strip()]

    # ไม่ส่ง equipment มา = คงรายการเดิมไว้ (ผู้เรียกที่ยังมี picker ส่ง list มาเหมือนเดิม)
    keep_equipment = body.equipment is None
    effective_items = (wo.get("selected_equipment") or []) if keep_equipment else items

    # วางแผนเสร็จเมื่อเลือกอุปกรณ์แล้ว "หรือ" มีกำหนดการ + ช่างครบ
    # (หน้าวางแผน PM มอบหมายด้วยกำหนดการ+ช่างอย่างเดียว ไม่ได้เลือกอุปกรณ์)
    schedule_complete = bool(sched_start_value and sched_finish_value and assignees)
    planning_status = "planned" if (effective_items or schedule_complete) else "pending"

    update: dict = {
        "selected_at": now,
        "selected_by": current.username or current.sub,
        "planning_status": planning_status,
        "planned_at": planned_at_value,
        "planned_by": current.username or current.sub,
        "sched_start": sched_start_value,
        "sched_finish": sched_finish_value,
        "assignees": assignees,
    }
    if not keep_equipment:
        update["selected_equipment"] = items

    res = await _open_coll().update_one({"wonum": wonum}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบงาน wonum={wonum}")

    doc = await _find_open_wo(wonum)
    log.info(f"  ✅ PM plan saved for {wonum}: {len(effective_items)} equipment item(s), status={planning_status}")

    # ── ขั้น 2 ของ sequencing: assign เสร็จ = ใบงานเข้าสถานะ In Progress ──
    # ยิงเฉพาะตอนวางแผนครบจริง ไม่ใช่ทุกครั้งที่กดบันทึก
    maximo_result = None
    if planning_status == "planned":
        from services import pm_maximo_out
        maximo_result = await pm_maximo_out.safe_sync_in_progress(
            wonum, memo=f"assigned by {current.username or current.sub}"
        )

    return {"ok": True, "wonum": wonum, "item": _serialize_open(doc), "maximo": maximo_result}
