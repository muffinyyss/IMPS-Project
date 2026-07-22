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
OPEN_WO_STATUSES = {"WAPPR", "APPR", "INPRG", "WMATL", "WSCH"}

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
