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

import logging
import os
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from config import client, station_collection, charger_collection
from deps import get_current_user, UserClaims
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


def _resolve_owner(location: str) -> dict:
    """
    map location ที่ Maximo ส่งมา → station_id / sn ของ iMPS (reverse lookup)
    """
    if not location:
        return {}

    charger = charger_collection.find_one(
        {"maximo_location": location}, {"SN": 1, "station_id": 1}
    )
    if charger:
        return {"station_id": charger.get("station_id"), "sn": charger.get("SN")}

    st = station_collection.find_one(
        {"maximo_location": location}, {"station_id": 1}
    )
    if st:
        return {"station_id": st.get("station_id"), "sn": None}

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
# 4) Open — Maximo ยิงเข้ามาตอน "เปิดใบงาน PM"
#     contract 4 field ที่ iMPS ต้องได้รับ:
#       location, pm_date, wonum, status
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
# alias ที่ frontend/Maximo อาจส่งมา → normalize เป็น key มาตรฐาน
EQUIP_ALIASES = {"cb_box": "cbbox", "cbbox": "cbbox", "cb-box": "cbbox"}


class PMWorkOrderOpenIn(BaseModel):
    """
    ใบงาน PM ที่ Maximo เปิดแล้วยิงเข้ามา — 5 field ที่ iMPS ต้องได้รับ:
      location — รหัส Maximo location "ระดับสถานี" เช่น "PTG0001-EV"
      pm_date  — วันที่นัด PM (YYYY-MM-DD หรือ ISO datetime)
      wonum    — Maximo Work Order Number ใช้เป็น key กันซ้ำ/อ้างอิงตอนส่งกลับ
      status   — สถานะฝั่ง Maximo (WAPPR/APPR/INPRG/COMP/…)
      company  — บริษัท/ผู้ดูแลสถานี
    (description ส่งมาก็เก็บให้ ไม่ส่งก็ได้)
    """
    location: str
    pm_date: str
    wonum: str
    status: str
    company: str
    description: Optional[str] = None

    class Config:
        extra = "allow"


class PMWorkOrderOpenBatchIn(BaseModel):
    workorders: list[PMWorkOrderOpenIn] = Field(default_factory=list)

    class Config:
        # กัน single-body ที่ field ไม่ครบ หลุดมาถูกตีความเป็น batch ว่าง
        extra = "forbid"


def _normalize_open(raw: dict) -> dict | None:
    """แปลง WO ที่ Maximo ส่งมาเป็น shape ที่เก็บ — คืน None ถ้าไม่มี location"""
    location = str(raw.get("location") or "").strip()
    if not location:
        return None

    owner = _resolve_owner(location)

    return {
        "location": location,
        "description": raw.get("description"),
        "pm_date": _norm_pm_date(raw.get("pm_date")),
        "wonum": str(raw.get("wonum") or "").strip() or None,
        "status": raw.get("status"),
        "company": raw.get("company"),
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


async def _upsert_open(items: list[dict]) -> dict:
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
        res = await coll.update_one(
            _open_dedup_key(doc),
            {
                "$set": doc,
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


@router.post("/maximo/pm/open")
async def maximo_pm_open(
    body: PMWorkOrderOpenIn | PMWorkOrderOpenBatchIn,
    x_maximo_token: str | None = Header(default=None, alias="X-Maximo-Token"),
):
    """
    รับใบงาน PM ที่ Maximo เปิด (push/webhook)

    ยิงได้ทั้งใบเดียว (location = ระดับสถานี):
        {
          "location": "PTG0001-EV",
          "pm_date": "2026-07-22",
          "wonum": "WO26070001",
          "status": "APPR",
          "company": "PTG"
        }
    และเป็น batch:
        { "workorders": [ {…}, {…} ] }

    ป้องกันด้วย shared secret ใน header X-Maximo-Token (env MAXIMO_WEBHOOK_SECRET)
    """
    if not MAXIMO_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=503,
            detail="MAXIMO_WEBHOOK_SECRET is not configured on this server",
        )
    if x_maximo_token != MAXIMO_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="invalid X-Maximo-Token")

    if isinstance(body, PMWorkOrderOpenBatchIn):
        items = [w.model_dump() for w in body.workorders]
    else:
        items = [body.model_dump()]

    if not items:
        return {"status": "OK"}

    missing = [i for i, it in enumerate(items) if not str(it.get("location") or "").strip()]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"location จำเป็นต้องมี — ขาดในรายการลำดับ {missing}",
        )

    stats = await _upsert_open(items)
    log.info(f"  📥 Maximo PM open: {stats} ({len(items)} received)")
    # ตอบกลับ Maximo แค่ status: OK (รายละเอียด inserted/updated ดูได้จาก log)
    return {"status": "OK"}


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
    limit: int = Query(50, ge=1, le=200),
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
            scope.append({"location": station_location})
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
    return {"items": [_serialize_open(d) for d in docs], "total": len(docs)}


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
    equipment: list[EquipmentItem] = Field(default_factory=list)


async def _find_open_wo(wonum: str) -> dict | None:
    return await _open_coll().find_one({"wonum": wonum})


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

    station_id = doc.get("station_id")
    chargers: list[dict] = []
    if station_id:
        # charger_collection เป็น pymongo (sync) — วนตรง ๆ ได้
        for c in charger_collection.find(
            {"station_id": station_id},
            {"_id": 0, "SN": 1, "chargeBoxID": 1, "name": 1, "maximo_location": 1},
        ):
            chargers.append({
                "type": "charger",
                "sn": c.get("SN"),
                "label": c.get("name") or c.get("chargeBoxID") or c.get("SN"),
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

    items: list[dict] = []
    for e in body.equipment:
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
        item = {"type": etype}
        if e.sn:
            item["sn"] = e.sn.strip()
        if e.location:
            item["location"] = e.location.strip()
        if e.label:
            item["label"] = e.label
        items.append(item)

    res = await _open_coll().update_one(
        {"wonum": wonum},
        {"$set": {
            "selected_equipment": items,
            "selected_at": datetime.now(timezone.utc),
            "selected_by": current.username or current.sub,
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"ไม่พบใบงาน wonum={wonum}")

    doc = await _find_open_wo(wonum)
    log.info(f"  ✅ PM equipment selected for {wonum}: {len(items)} item(s)")
    return {"ok": True, "wonum": wonum, "item": _serialize_open(doc)}
