# routers/pm_all_stations.py

from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone
from typing import Optional
import asyncio
import traceback
import re
from bson import ObjectId

from config import (
    charger_collection,
    PMReportDB, PMUrlDB,
    MDBPMReportDB, MDBPMUrlDB,
    CCBPMReportDB, CCBPMUrlDB,
    CBBOXPMReportDB, CBBOXPMUrlDB,
    stationPMReportDB, stationPMUrlDB,
)
from deps import UserClaims, get_current_user
from routers.stations import load_station_scope
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

PROJECTION = {
    "_id": 1, "doc_name": 1, "issue_id": 1, "wonum": 1,
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
        # เลขใบงาน Maximo ที่ผูกไว้ตอนช่างเปิดฟอร์มจากใบงานที่ planner assign
        "wonum":         doc.get("wonum") or "",
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

    # ── 1–2. Stations + chargers ที่ผู้เรียกเห็นได้ (sync PyMongo) ─────
    # กติกาเดียวกับหน้า EV Station และ Test — เดิม find({}) ส่งทุกสถานีให้ทุกบัญชี
    try:
        stations, chargers = await loop.run_in_executor(
            None,
            lambda: load_station_scope(
                current, station_id,
                station_fields=("station_id", "station_name", "company"),
                charger_fields=("SN", "chargeBoxID", "station_id", "brand"),
            ),
        )
    except Exception:
        traceback.print_exc()
        stations, chargers = [], []

    if not stations:
        return {"reports": [], "total": 0, "stations_count": 0}

    station_ids      = [s["station_id"] for s in stations]
    station_name_map = {s["station_id"]: s.get("station_name", "-") for s in stations}
    # บริษัทเจ้าของสถานี — PM Dashboard ใช้กรอง COMPANY (แพทเทิร์นเดียวกับ CM)
    station_company_map = {s["station_id"]: (s.get("company") or "") for s in stations}

    sn_list = [
        (c["SN"], c.get("station_id", ""))
        for c in chargers
        if c.get("SN") and c["SN"] not in ("-", "", None)
    ]

    # ── ยี่ห้อของตู้ (สำหรับตัวกรอง BRAND ของ PM Dashboard) ──
    # เอกสารชนิด CHARGER รู้ SN จึงระบุยี่ห้อได้ตรงตัว ส่วน MDB/CCB/CB-BOX/STATION
    # เป็นเอกสารระดับสถานี — ใช้ยี่ห้อของสถานีได้เฉพาะตอนทุกตู้เป็นยี่ห้อเดียวกัน
    # (เกณฑ์เดียวกับ _brand_clause_for_station ฝั่ง CM)
    sn_brand_map: dict[str, str] = {}
    brands_by_station: dict[str, list[str]] = {}
    for c in chargers:
        brand = str(c.get("brand") or "").strip()
        sn = c.get("SN")
        if sn and brand:
            sn_brand_map[sn] = brand
        sid = c.get("station_id") or ""
        if sid and brand:
            seen = brands_by_station.setdefault(sid, [])
            if brand not in seen:
                seen.append(brand)
    station_brand_map = {
        sid: brands[0] for sid, brands in brands_by_station.items() if len(brands) == 1
    }

    # ── 3. Fetch all sources concurrently ───────────────────────
    # CHARGER → keyed ด้วย SN ; MDB/CCB/CB-BOX/STATION → keyed ด้วย station_id
    # นับ "เอกสาร" ทั้ง report form + ไฟล์อัปโหลด (URL) ให้ตรงกับคอลัมน์/การ์ด
    # ยิงเฉพาะ collection ที่มีอยู่จริง — ดู _existing_collection_names
    existing = await _existing_collection_names(
        [db for _, pairs, _ in _PM_TYPE_SOURCES for db, _ in pairs]
    )
    station_pairs = [(sid, sid) for sid in station_ids]

    tasks = []
    for idx in (0, 1):            # 0 = report form, 1 = ไฟล์อัปโหลด (URL) — คงลำดับเดิม
        for label, pairs, mode in _PM_TYPE_SOURCES:
            db, fn = pairs[idx]
            have = existing.get(db.name)   # None = ถามไม่สำเร็จ → ยิงทุกคีย์เหมือนเดิม
            for key, sid in (sn_list if mode == "sn" else station_pairs):
                if have is not None and key not in have:
                    continue
                tasks.append(_fetch_sn_source(label, fn, key, sid, limit_per_source))

    all_results = await asyncio.gather(*tasks, return_exceptions=True)

    all_reports: list[dict] = []
    for result in all_results:
        if isinstance(result, list):
            all_reports.extend(result)

    # ── 4. Enrich + Filter + Sort ───────────────────────────────
    # ── 4. Enrich + Filter + Sort ───────────────────────────────
    for r in all_reports:
        sid = r.get("station_id", "")
        r["station_name"] = station_name_map.get(sid, "-")
        r["company"] = station_company_map.get(sid, "")
        r["charger_brand"] = (
            sn_brand_map.get(r.get("sn") or "")
            or station_brand_map.get(sid, "")
        )

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
# แต่ละคู่เป็น (db, getter) — ต้องรู้ db เพื่อถามชื่อ collection ที่มีจริงครั้งเดียวต่อ db
_PM_TYPE_SOURCES = [
    ("CHARGER", [(PMReportDB, get_pmreport_collection_for),
                 (PMUrlDB, get_pmurl_coll_upload)], "sn"),
    ("MDB",     [(MDBPMReportDB, get_mdbpmreport_collection_for),
                 (MDBPMUrlDB, get_mdbpmurl_coll_upload)], "sid"),
    ("CCB",     [(CCBPMReportDB, get_ccbpmreport_collection_for),
                 (CCBPMUrlDB, get_ccbpmurl_coll_upload)], "sid"),
    ("CB-BOX",  [(CBBOXPMReportDB, get_cbboxpmreport_collection_for),
                 (CBBOXPMUrlDB, get_cbboxpmurl_coll_upload)], "sid"),
    ("STATION", [(stationPMReportDB, get_stationpmreport_collection_for),
                 (stationPMUrlDB, get_stationpmurl_coll_upload)], "sid"),
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


async def _existing_collection_names(dbs) -> dict[str, set[str] | None]:
    """ชื่อ collection ที่มีอยู่จริง ถามครั้งเดียวต่อ DB

    PM เก็บ 1 collection ต่อ SN / ต่อ station_id กระจายใน 10 DB ถ้าไม่ถามก่อน
    เราจะยิง count/find/distinct ไปยัง collection ที่ "ไม่มีอยู่" หลายพันครั้งต่อ 1 request
    (355 สถานี × 4 ชนิด × 2 + 692 SN × 2 = 4,224 คำสั่ง โดยมีจริงแค่ ~240)

    ค่า None = ถามไม่สำเร็จ → ผู้เรียกต้องถอยไปใช้คีย์ทั้งหมดเหมือนเดิม (กันหน้าเว็บว่าง)
    """
    uniq = {db.name: db for db in dbs}
    results = await asyncio.gather(
        *(db.list_collection_names() for db in uniq.values()), return_exceptions=True
    )
    out: dict[str, set[str] | None] = {}
    for name, names in zip(uniq.keys(), results):
        if isinstance(names, BaseException):
            traceback.print_exception(names)
            out[name] = None
        else:
            out[name] = {n for n in names if not n.startswith("system.")}
    return out


def _keys_present(existing: dict[str, set[str] | None], db, keys):
    """คัดเฉพาะคีย์ที่มี collection อยู่จริงใน db นั้น (ถามไม่สำเร็จ → คืนทั้งหมดตามเดิม)"""
    have = existing.get(db.name)
    return keys if have is None else [k for k in keys if k in have]


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
        stations, chargers = await loop.run_in_executor(None, load_station_scope, current)
    except Exception:
        traceback.print_exc()
        stations, chargers = [], []

    station_ids = [s["station_id"] for s in stations if s.get("station_id")]
    empty = {"counts": {}, "by_type": {t: 0 for t in _PM_TYPES}, "total": 0, "stations_count": 0}
    if not station_ids:
        return empty

    # SN ต่อสถานี
    sns_by_station: dict[str, list[str]] = {sid: [] for sid in station_ids}
    for c in chargers:
        sn = c.get("SN")
        sid = c.get("station_id", "")
        if sn and sn not in ("-", "", None) and sid in sns_by_station:
            sns_by_station[sid].append(sn)

    # นับเฉพาะ collection ที่มีอยู่จริง — ดู _existing_collection_names
    existing = await _existing_collection_names(
        [db for _, pairs, _ in _PM_TYPE_SOURCES for db, _ in pairs]
    )

    # counts[sid] = { TYPE: n, ... , "total": n }  → คอลัมน์เลือกแสดงตาม type ได้
    counts: dict[str, dict] = {sid: {t: 0 for t in _PM_TYPES} for sid in station_ids}

    jobs: list[tuple[str, str]] = []      # (station_id, type label) ขนานกับ tasks
    tasks = []
    for label, pairs, mode in _PM_TYPE_SOURCES:
        for db, fn in pairs:
            for sid in station_ids:
                keys = sns_by_station.get(sid, []) if mode == "sn" else [sid]
                for key in _keys_present(existing, db, keys):
                    try:
                        coll = fn(key)
                    except Exception:
                        continue      # คีย์ผิดรูป (เช่น station_id แปลก) — ข้ามเหมือนเดิม
                    jobs.append((sid, label))
                    tasks.append(_count_collection(coll, date_filter))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    for (sid, label), n in zip(jobs, results):
        if isinstance(n, int):
            counts[sid][label] += n

    by_type: dict[str, int] = {t: 0 for t in _PM_TYPES}
    for sid, per_type in counts.items():
        per_type["total"] = sum(per_type[t] for t in _PM_TYPES)
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
        stations, chargers = await loop.run_in_executor(None, load_station_scope, current)
    except Exception:
        traceback.print_exc()
        stations, chargers = [], []

    station_ids = [s["station_id"] for s in stations if s.get("station_id")]
    if not station_ids:
        return {"months": []}

    sns = [c["SN"] for c in chargers if c.get("SN") and c["SN"] not in ("-", "", None)]

    months: set[str] = set()

    async def _collect(coll):
        for d in await _distinct_pm_dates(coll):
            if isinstance(d, str) and re.match(r"^\d{4}-\d{2}", d):
                months.add(d[:7])

    existing = await _existing_collection_names(
        [db for _, pairs, _ in _PM_TYPE_SOURCES for db, _ in pairs]
    )

    tasks = []
    for _label, pairs, mode in _PM_TYPE_SOURCES:
        keys = sns if mode == "sn" else station_ids
        for db, fn in pairs:
            for key in _keys_present(existing, db, keys):
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
    # ลบถาวร = สิทธิ์ super admin เท่านั้น (admin ธรรมดาลบใบงานไม่ได้) — เหมือน DELETE /cmreport/{id}
    if not getattr(current, "is_super_admin", False):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not allowed to delete")

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