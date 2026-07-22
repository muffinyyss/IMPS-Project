# routers/pm_all_stations.py

from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone
from typing import Optional
import asyncio
import traceback
import re
from bson import ObjectId

from config import charger_collection, station_collection
from deps import UserClaims, get_current_user
from routers.pm_helpers import (
    get_pmreport_collection_for,
    get_mdbpmreport_collection_for,
    get_ccbpmreport_collection_for,
    get_cbboxpmreport_collection_for,
    get_stationpmreport_collection_for,
    get_pmurl_coll_upload,
    get_mdbpmurl_coll_upload,
    get_ccbpmurl_coll_upload,
    get_cbboxpmurl_coll_upload,
    get_stationpmurl_coll_upload,
)

router = APIRouter()

PM_SOURCES = [
    ("CHARGER",    get_pmreport_collection_for),
    ("MDB",   get_mdbpmreport_collection_for),
    ("CCB",   get_ccbpmreport_collection_for),
    ("CB-BOX", get_cbboxpmreport_collection_for),
    ("STATION", get_stationpmreport_collection_for)
]

PROJECTION = {
    "_id": 1, "doc_name": 1, "issue_id": 1,
    "pm_date": 1, "status": 1, "inspector": 1,
    "side": 1, "sn": 1, "SN": 1,  # ← เพิ่ม SN
    "chargeBoxID": 1,
    "station_id": 1, "createdAt": 1, "timestamp": 1,
    "urls": 1, "url": 1, "file_url": 1,
    }


# ===== Helpers =====

def _to_iso(val) -> str:
    if val is None:
        return ""
    if isinstance(val, datetime):
        return val.astimezone(timezone.utc).isoformat()
    return str(val)


def _serialize_report(doc: dict, source: str, station_id: str) -> dict:
    doc_id = str(doc.get("_id", ""))

    file_url = _first_url(doc)

    if not file_url and doc_id:
        source_map = {
            "CHARGER": "charger",
            "MDB":     "mdb",
            "CCB":     "ccb",
            "CB-BOX":  "cbbox",
            "STATION": "station",
        }
        pdf_type = source_map.get(source, "charger")

        # charger → ใช้ sn, ส่วน mdb/ccb/cbbox/station → ใช้ station_id
        # (ตรงกับ endpoint /pdf/{template}/{id}/export)
        if pdf_type == "charger":
            sn = doc.get("sn") or doc.get("SN") or ""
            if sn and sn not in ("-", ""):
                file_url = f"/pdf/{pdf_type}/{doc_id}/export?sn={sn}"
            else:
                file_url = f"/pdf/{pdf_type}/{doc_id}/export"
        else:
            sid = doc.get("station_id") or station_id or ""
            if sid and sid not in ("-", ""):
                file_url = f"/pdf/{pdf_type}/{doc_id}/export?station_id={sid}"
            else:
                file_url = f"/pdf/{pdf_type}/{doc_id}/export"

    return {
        "id":            doc_id,
        "document_name": doc.get("doc_name") or doc.get("document_name") or "-",
        "issue_id":      doc.get("issue_id") or "-",
        "pm_type":       source,
        "pm_date":       doc.get("pm_date") or "-",
        "status":        doc.get("status") or "submitted",
        "technician":    doc.get("inspector") or doc.get("technician") or "-",
        "sn":            doc.get("sn") or doc.get("SN") or "-",
        "chargeBoxID":   doc.get("chargeBoxID") or "-",
        "station_id":    doc.get("station_id") or station_id,
        "side":          doc.get("side") or "-",
        "created_at":    _to_iso(doc.get("createdAt") or doc.get("timestamp")),
        "file_url":      file_url,
    }

def _first_url(doc: dict) -> str:
    """ดึง URL แรกจาก urls field หรือ url field"""
    urls = doc.get("urls") or []
    if urls and isinstance(urls, list):
        return urls[0]
    return doc.get("url") or doc.get("file_url") or ""


async def _query_collection(coll, projection: dict, limit: int) -> list[dict]:
    """
    ดึงข้อมูลจาก collection ไม่ว่าจะเป็น Motor (async) หรือ PyMongo (sync)
    """
    try:
        cursor = coll.find({}, projection).sort(
            [("createdAt", -1), ("_id", -1)]
        ).limit(limit)

        # Motor async cursor มี to_list()
        if hasattr(cursor, "to_list"):
            return await cursor.to_list(length=limit)

        # PyMongo sync cursor → run in thread executor
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: list(cursor))

    except Exception:
        traceback.print_exc()
        return []


async def _fetch_sn_source(
    source_label: str,
    get_coll_fn,
    sn: str,
    station_id: str,
    limit: int,
) -> list[dict]:
    try:
        coll = get_coll_fn(sn)
        docs = await _query_collection(coll, PROJECTION, limit)
        return [_serialize_report(d, source_label, station_id) for d in docs]
    except Exception:
        traceback.print_exc()
        return []


async def _fetch_reports_for_sn(
    sn: str,
    station_id: str,
    limit_per_source: int,
) -> list[dict]:
    tasks = [
        _fetch_sn_source(label, fn, sn, station_id, limit_per_source)
        for label, fn in PM_SOURCES
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    combined = []
    for r in results:
        if isinstance(r, list):
            combined.extend(r)
    return combined


async def _fetch_station_level_reports(
    station_id: str,
    limit: int,
) -> list[dict]:
    try:
        coll = get_stationpmreport_collection_for(station_id)
        docs = await _query_collection(coll, PROJECTION, limit)
        return [_serialize_report(d, "STATION", station_id) for d in docs]
    except Exception:
        traceback.print_exc()
        return []


# ===== Endpoint =====

@router.get("/pm-reports/all-stations")
async def get_all_station_pm_reports(
    station_id:       Optional[str] = Query(None),
    pm_type:          Optional[str] = Query(None),
    status:           Optional[str] = Query(None),
    limit_per_source: int           = Query(50, ge=1, le=200),
    current: UserClaims = Depends(get_current_user),
):
    loop = asyncio.get_event_loop()

    # ── 1. Stations (sync PyMongo) ──────────────────────────────
    station_query = {"station_id": station_id} if station_id else {}

    try:
        stations = await loop.run_in_executor(
            None,
            lambda: list(
                station_collection.find(
                    station_query,
                    {"_id": 0, "station_id": 1, "station_name": 1}
                )
            )
        )
    except Exception:
        traceback.print_exc()
        stations = []

    if not stations:
        return {"reports": [], "total": 0, "stations_count": 0}

    station_ids      = [s["station_id"] for s in stations]
    station_name_map = {s["station_id"]: s.get("station_name", "-") for s in stations}

    # ── 2. Chargers (sync PyMongo) ──────────────────────────────
    try:
        chargers = await loop.run_in_executor(
            None,
            lambda: list(
                charger_collection.find(
                    {"station_id": {"$in": station_ids}},
                    {"_id": 0, "SN": 1, "chargeBoxID": 1, "station_id": 1}
                )
            )
        )
    except Exception:
        traceback.print_exc()
        chargers = []

    sn_list = [
        (c["SN"], c.get("station_id", ""))
        for c in chargers
        if c.get("SN") and c["SN"] not in ("-", "", None)
    ]

    # ── 3. Fetch all sources concurrently ───────────────────────
    # CHARGER → keyed ด้วย SN ; MDB/CCB/CB-BOX/STATION → keyed ด้วย station_id
    # นับ "เอกสาร" ทั้ง report form + ไฟล์อัปโหลด (URL) ให้ตรงกับคอลัมน์/การ์ด
    _station_keyed_report = [
        ("MDB",     get_mdbpmreport_collection_for),
        ("CCB",     get_ccbpmreport_collection_for),
        ("CB-BOX",  get_cbboxpmreport_collection_for),
        ("STATION", get_stationpmreport_collection_for),
    ]
    _station_keyed_url = [
        ("MDB",     get_mdbpmurl_coll_upload),
        ("CCB",     get_ccbpmurl_coll_upload),
        ("CB-BOX",  get_cbboxpmurl_coll_upload),
        ("STATION", get_stationpmurl_coll_upload),
    ]
    tasks = (
        # report forms
        [_fetch_sn_source("CHARGER", get_pmreport_collection_for, sn, sid, limit_per_source)
         for sn, sid in sn_list]
        + [_fetch_sn_source(label, fn, sid, sid, limit_per_source)
           for sid in station_ids for label, fn in _station_keyed_report]
        # uploaded files (URL)
        + [_fetch_sn_source("CHARGER", get_pmurl_coll_upload, sn, sid, limit_per_source)
           for sn, sid in sn_list]
        + [_fetch_sn_source(label, fn, sid, sid, limit_per_source)
           for sid in station_ids for label, fn in _station_keyed_url]
    )

    all_results = await asyncio.gather(*tasks, return_exceptions=True)

    all_reports: list[dict] = []
    for result in all_results:
        if isinstance(result, list):
            all_reports.extend(result)

    # ── 4. Enrich + Filter + Sort ───────────────────────────────
    # ── 4. Enrich + Filter + Sort ───────────────────────────────
    for r in all_reports:
        r["station_name"] = station_name_map.get(r.get("station_id", ""), "-")

    # ✅ กรอง pre ออก
    all_reports = [r for r in all_reports if r.get("side") not in ("pre", "Pre", "PRE")]

    if pm_type:
        all_reports = [r for r in all_reports if r.get("pm_type") == pm_type]
    if status:
        all_reports = [r for r in all_reports if r.get("status") == status]

    all_reports.sort(key=lambda r: r.get("pm_date") or "", reverse=True)

    return {
        "reports":        all_reports,
        "total":          len(all_reports),
        "stations_count": len(station_ids),
    }


# ===== PM document count per station (เร็ว: ใช้ count_documents) =====
# นับเอกสารทั้งหมดของสถานี = report form + เอกสารอัปโหลด (URL) ทุก source
#   CHARGER  → keyed ด้วย SN (PMReport / PMReportURL)
#   MDB/CCB/CB-BOX/STATION → keyed ด้วย station_id
# (ตรงกับที่แสดงเป็นแถวในตาราง PM report per-station ซึ่ง concat report + url)

# แต่ละ type: (label, [report getter, url getter], key_mode)
#   key_mode "sn"  → นับต่อ SN ของตู้ชาร์จในสถานี
#   key_mode "sid" → นับต่อ station_id
_PM_TYPE_SOURCES = [
    ("CHARGER", [get_pmreport_collection_for, get_pmurl_coll_upload], "sn"),
    ("MDB",     [get_mdbpmreport_collection_for, get_mdbpmurl_coll_upload], "sid"),
    ("CCB",     [get_ccbpmreport_collection_for, get_ccbpmurl_coll_upload], "sid"),
    ("CB-BOX",  [get_cbboxpmreport_collection_for, get_cbboxpmurl_coll_upload], "sid"),
    ("STATION", [get_stationpmreport_collection_for, get_stationpmurl_coll_upload], "sid"),
]
_PM_TYPES = [t[0] for t in _PM_TYPE_SOURCES]


async def _count_collection(coll, filt: dict) -> int:
    """count_documents รองรับทั้ง Motor (async awaitable) และ PyMongo (sync int)"""
    try:
        maybe = coll.count_documents(filt)
        if hasattr(maybe, "__await__"):   # motor: awaitable (ไม่ใช่ native coroutine เสมอไป)
            return int(await maybe)
        return int(maybe)
    except Exception:
        return 0


@router.get("/pm-reports/counts")
async def get_pm_report_counts(
    month: Optional[str] = Query(None, description="กรองตามเดือน รูปแบบ YYYY-MM"),
    year: Optional[str] = Query(None, description="กรองตามปี รูปแบบ YYYY (ถ้าไม่ได้ระบุ month)"),
    current: UserClaims = Depends(get_current_user),
):
    """
    คืนจำนวนเอกสาร PM (report + upload, ครบทุก source):
      { counts: {station_id: {...by type, total}}, by_type: {TYPE: n}, total: n }
    - month=YYYY-MM → นับเฉพาะเดือนนั้น
    - year=YYYY     → นับทั้งปีนั้น (เมื่อไม่ได้ระบุ month)
    (อิงจาก pm_date)
    """
    loop = asyncio.get_event_loop()

    # filter ตามเดือน/ปี (pm_date เป็น string "YYYY-MM-DD") — month มาก่อน year
    date_filter: dict = {}
    if month and re.fullmatch(r"\d{4}-\d{2}", month):
        date_filter = {"pm_date": {"$regex": f"^{re.escape(month)}"}}
    elif year and re.fullmatch(r"\d{4}", year):
        date_filter = {"pm_date": {"$regex": f"^{re.escape(year)}-"}}

    try:
        stations = await loop.run_in_executor(
            None,
            lambda: list(station_collection.find({}, {"_id": 0, "station_id": 1})),
        )
    except Exception:
        traceback.print_exc()
        stations = []

    station_ids = [s["station_id"] for s in stations if s.get("station_id")]
    empty = {"counts": {}, "by_type": {t: 0 for t in _PM_TYPES}, "total": 0, "stations_count": 0}
    if not station_ids:
        return empty

    try:
        chargers = await loop.run_in_executor(
            None,
            lambda: list(charger_collection.find(
                {"station_id": {"$in": station_ids}},
                {"_id": 0, "SN": 1, "station_id": 1},
            )),
        )
    except Exception:
        traceback.print_exc()
        chargers = []

    # SN ต่อสถานี
    sns_by_station: dict[str, list[str]] = {sid: [] for sid in station_ids}
    for c in chargers:
        sn = c.get("SN")
        sid = c.get("station_id", "")
        if sn and sn not in ("-", "", None) and sid in sns_by_station:
            sns_by_station[sid].append(sn)

    async def _count_station_by_type(sid: str):
        per_type: dict[str, int] = {}
        for label, getters, mode in _PM_TYPE_SOURCES:
            n = 0
            keys = sns_by_station.get(sid, []) if mode == "sn" else [sid]
            for key in keys:
                for fn in getters:
                    try:
                        n += await _count_collection(fn(key), date_filter)
                    except Exception:
                        pass
            per_type[label] = n
        return (sid, per_type)

    results = await asyncio.gather(
        *[_count_station_by_type(sid) for sid in station_ids],
        return_exceptions=True,
    )

    # counts[sid] = { TYPE: n, ... , "total": n }  → คอลัมน์เลือกแสดงตาม type ได้
    counts: dict[str, dict] = {}
    by_type: dict[str, int] = {t: 0 for t in _PM_TYPES}
    for r in results:
        if isinstance(r, tuple):
            sid, per_type = r
            per_type = {t: per_type.get(t, 0) for t in _PM_TYPES}
            per_type["total"] = sum(per_type.values())
            counts[sid] = per_type
            for t in _PM_TYPES:
                by_type[t] += per_type[t]

    return {
        "counts": counts,
        "by_type": by_type,
        "total": sum(by_type.values()),
        "stations_count": len(station_ids),
    }


async def _distinct_pm_dates(coll) -> list:
    """distinct('pm_date') รองรับทั้ง Motor (awaitable) และ PyMongo (sync list)"""
    try:
        maybe = coll.distinct("pm_date")
        if hasattr(maybe, "__await__"):
            return list(await maybe)
        return list(maybe)
    except Exception:
        return []


@router.get("/pm-reports/months")
async def get_pm_report_months(current: UserClaims = Depends(get_current_user)):
    """
    คืนรายการเดือน (YYYY-MM) ที่มีเอกสาร PM อยู่จริง เรียงจากใหม่ → เก่า
    ใช้สร้างตัวเลือกใน dropdown ให้เริ่มตั้งแต่เดือนที่มีเอกสารเท่านั้น
    """
    loop = asyncio.get_event_loop()
    try:
        stations = await loop.run_in_executor(
            None,
            lambda: list(station_collection.find({}, {"_id": 0, "station_id": 1})),
        )
    except Exception:
        traceback.print_exc()
        stations = []

    station_ids = [s["station_id"] for s in stations if s.get("station_id")]
    if not station_ids:
        return {"months": []}

    try:
        chargers = await loop.run_in_executor(
            None,
            lambda: list(charger_collection.find(
                {"station_id": {"$in": station_ids}},
                {"_id": 0, "SN": 1},
            )),
        )
    except Exception:
        traceback.print_exc()
        chargers = []

    sns = [c["SN"] for c in chargers if c.get("SN") and c["SN"] not in ("-", "", None)]

    months: set[str] = set()

    async def _collect(coll):
        for d in await _distinct_pm_dates(coll):
            if isinstance(d, str) and re.match(r"^\d{4}-\d{2}", d):
                months.add(d[:7])

    tasks = []
    for _label, getters, mode in _PM_TYPE_SOURCES:
        keys = sns if mode == "sn" else station_ids
        for key in keys:
            for fn in getters:
                try:
                    tasks.append(_collect(fn(key)))
                except Exception:
                    pass

    await asyncio.gather(*tasks, return_exceptions=True)

    return {"months": sorted(months, reverse=True)}


@router.delete("/pmreport/{report_id}")
async def delete_pmreport(
    report_id: str,
    current: UserClaims = Depends(get_current_user),
):
    return await _delete_report_by_id(report_id, get_pmreport_collection_for, current)

@router.delete("/mdbpmreport/{report_id}")
async def delete_mdbpmreport(report_id: str, current: UserClaims = Depends(get_current_user)):
    return await _delete_report_by_id(report_id, get_mdbpmreport_collection_for, current)

@router.delete("/ccbpmreport/{report_id}")
async def delete_ccbpmreport(report_id: str, current: UserClaims = Depends(get_current_user)):
    return await _delete_report_by_id(report_id, get_ccbpmreport_collection_for, current)

@router.delete("/cbboxpmreport/{report_id}")
async def delete_cbboxpmreport(report_id: str, current: UserClaims = Depends(get_current_user)):
    return await _delete_report_by_id(report_id, get_cbboxpmreport_collection_for, current)

@router.delete("/stationpmreport/{report_id}")
async def delete_stationpmreport(report_id: str, current: UserClaims = Depends(get_current_user)):
    return await _delete_report_by_id(report_id, get_stationpmreport_collection_for, current)


async def _delete_report_by_id(report_id: str, get_coll_fn, current) -> dict:
    """
    ค้นหา report จาก _id ใน all SN collections แล้วลบ
    เนื่องจากไม่รู้ SN → scan ทุก collection ที่ได้จาก charger list
    """
    loop = asyncio.get_event_loop()
    try:
        oid = ObjectId(report_id)
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid report_id")

    # ดึง SN ทั้งหมด
    try:
        chargers = await loop.run_in_executor(
            None,
            lambda: list(charger_collection.find({}, {"_id": 0, "SN": 1}))
        )
    except Exception:
        chargers = []

    sn_list = [c["SN"] for c in chargers if c.get("SN") and c["SN"] not in ("-", "")]

    for sn in sn_list:
        try:
            coll = get_coll_fn(sn)
            result = await loop.run_in_executor(
                None,
                lambda c=coll: c.delete_one({"_id": oid})
            )
            if result.deleted_count > 0:
                return {"deleted": True, "id": report_id}
        except Exception:
            continue

    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Report not found")