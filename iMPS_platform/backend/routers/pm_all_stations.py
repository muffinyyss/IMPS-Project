# routers/pm_all_stations.py

from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone
from typing import Optional
import asyncio
import traceback
from bson import ObjectId

from config import charger_collection, station_collection
from deps import UserClaims, get_current_user
from routers.pm_helpers import (
    get_pmreport_collection_for,
    get_mdbpmreport_collection_for,
    get_ccbpmreport_collection_for,
    get_cbboxpmreport_collection_for,
    get_stationpmreport_collection_for,
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
    tasks = (
        [_fetch_reports_for_sn(sn, sid, limit_per_source) for sn, sid in sn_list]
        + [_fetch_station_level_reports(sid, limit_per_source) for sid in station_ids]
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


# ===== PM report count per station (เร็ว: ใช้ count_documents) =====

# กรอง side == pre ออก ให้ตรงกับที่แสดงในหน้า all-stations
_COUNT_FILTER = {"side": {"$nin": ["pre", "Pre", "PRE"]}}


async def _count_collection(coll) -> int:
    """count_documents รองรับทั้ง Motor (async) และ PyMongo (sync)"""
    try:
        maybe = coll.count_documents(_COUNT_FILTER)
        if asyncio.iscoroutine(maybe):
            return await maybe
        return int(maybe)
    except Exception:
        return 0


@router.get("/pm-reports/counts")
async def get_pm_report_counts(
    current: UserClaims = Depends(get_current_user),
):
    """คืนจำนวน PM report ต่อสถานี: { counts: { station_id: n } } (นับครบ ไม่ติด limit)"""
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
        return {"counts": {}}

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

    sn_list = [
        (c["SN"], c.get("station_id", ""))
        for c in chargers
        if c.get("SN") and c["SN"] not in ("-", "", None)
    ]

    async def _count_sn(sn: str, sid: str):
        total = 0
        for label, fn in PM_SOURCES:
            if label == "STATION":
                continue  # STATION นับจาก station_id แยกด้านล่าง
            try:
                total += await _count_collection(fn(sn))
            except Exception:
                pass
        return (sid, total)

    async def _count_station(sid: str):
        try:
            return (sid, await _count_collection(get_stationpmreport_collection_for(sid)))
        except Exception:
            return (sid, 0)

    tasks = (
        [_count_sn(sn, sid) for sn, sid in sn_list]
        + [_count_station(sid) for sid in station_ids]
    )
    results = await asyncio.gather(*tasks, return_exceptions=True)

    counts: dict[str, int] = {sid: 0 for sid in station_ids}
    for r in results:
        if isinstance(r, tuple):
            sid, n = r
            counts[sid] = counts.get(sid, 0) + n

    return {"counts": counts, "stations_count": len(station_ids)}


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