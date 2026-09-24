# routers/test_all_stations.py
"""
Test Dashboard / Test List — เอกสาร Test Report (DC + AC) ของทุกสถานีในคำขอเดียว

งาน Test = คำขอจากภายนอกที่ EGAT รับไปดำเนินการ (เช่น บริษัทอื่นขอให้ EGAT ไปทดสอบ/ซ่อมตู้ชาร์จ EV)
จึงไม่มีใบงาน Maximo — ข้อมูลมาจาก iMPS อย่างเดียว ทุก collection ตั้งชื่อด้วย SN ของตู้:
  DCTestReport/<SN> · ACTestReport/<SN>  — ฟอร์ม Test ที่กรอกในระบบ
  DCUrl/<SN>        · ACUrl/<SN>         — PDF ที่อัปโหลดเข้ามาแทนการกรอกฟอร์ม

แพทเทิร์นเดียวกับ /pm-reports/all-stations แต่กรองสถานี/ตู้ตามสิทธิ์ของผู้เรียก
(station_match_query + brand scope) — งานของลูกค้าภายนอกต้องไม่รั่วข้ามบริษัท
"""

import asyncio
import re
import traceback
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query

from config import ACTestReportDB, ACUrlDB, DCTestReportDB, DCUrlDB, th_tz
from deps import UserClaims, get_current_user
from routers.stations import load_station_scope

router = APIRouter()

# (ชนิดตู้, ที่มา, database)
TEST_SOURCES = [
    ("DC", "report", DCTestReportDB),
    ("AC", "report", ACTestReportDB),
    ("DC", "upload", DCUrlDB),
    ("AC", "upload", ACUrlDB),
]

REPORT_PROJECTION = {
    "_id": 1, "document_name": 1, "issue_id": 1, "inspection_date": 1, "status": 1,
    "inspector": 1, "head.inspector": 1, "head.issue_id": 1,
    "signature.responsibility.performed.name": 1, "createdAt": 1,
}

UPLOAD_PROJECTION = {
    "_id": 1, "document_name": 1, "issue_id": 1, "dc_date": 1, "ac_date": 1,
    "inspection_date": 1, "reportDate": 1, "urls": 1, "meta.files": 1, "createdAt": 1,
}


# ===== Helpers =====

def _to_iso(val) -> str:
    if val is None:
        return ""
    if isinstance(val, datetime):
        dt = val if val.tzinfo else val.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    return str(val)


def _th_day(val) -> str:
    """วันที่ → 'YYYY-MM-DD' ตามเวลาไทย · '' ถ้าอ่านไม่ได้

    datetime จาก Mongo ไม่มี tz = UTC · สตริงไม่มี tz = เวลาไทย (กติกาเดียวกับ /dcurl/list)
    """
    if isinstance(val, datetime):
        dt = val if val.tzinfo else val.replace(tzinfo=timezone.utc)
        return dt.astimezone(th_tz).date().isoformat()
    s = str(val or "").strip()
    if not s:
        return ""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return s
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=th_tz)
    return dt.astimezone(th_tz).date().isoformat()


def _serialize_report(doc: dict, test_type: str, sn: str) -> dict:
    doc_id = str(doc.get("_id", ""))
    head = doc.get("head") or {}
    performed = (((doc.get("signature") or {}).get("responsibility") or {}).get("performed") or {}).get("name")
    return {
        "id": doc_id,
        "source": "report",
        "document_name": doc.get("document_name") or doc.get("issue_id") or "-",
        "issue_id": doc.get("issue_id") or head.get("issue_id") or "-",
        "test_type": test_type,
        "test_date": _th_day(doc.get("inspection_date")) or _th_day(doc.get("createdAt")),
        # finalize ตั้ง "submitted" — ใบเก่าที่ไม่มี status ถือว่าส่งแล้วเหมือนฝั่ง PM
        "status": doc.get("status") or "submitted",
        # ลำดับเดียวกับตาราง Test Report เดิม: ผู้ลงชื่อ performed ก่อน แล้วค่อย inspector
        "technician": performed or head.get("inspector") or doc.get("inspector") or "-",
        "sn": sn,
        "created_at": _to_iso(doc.get("createdAt")),
        "file_url": f"/pdf/{test_type.lower()}/{doc_id}/export?sn={quote(sn, safe='')}" if doc_id else "",
    }


def _serialize_upload(doc: dict, test_type: str, sn: str) -> dict:
    urls = doc.get("urls") or []
    first = urls[0] if isinstance(urls, list) and urls else ""
    if isinstance(first, dict):
        first = first.get("url") or ""
    files = ((doc.get("meta") or {}).get("files") or [])
    file_name = files[0].get("name") if files and isinstance(files[0], dict) else ""
    return {
        "id": str(doc.get("_id", "")),
        "source": "upload",
        "document_name": doc.get("document_name") or file_name or (str(first).rsplit("/", 1)[-1] if first else "-"),
        "issue_id": doc.get("issue_id") or "-",
        "test_type": test_type,
        "test_date": (
            _th_day(doc.get("dc_date") or doc.get("ac_date") or doc.get("inspection_date"))
            or _th_day(doc.get("reportDate"))
            or _th_day(doc.get("createdAt"))
        ),
        # PDF ที่อัปโหลด = เอกสารฉบับจบแล้ว
        "status": "submitted",
        "technician": "-",
        "sn": sn,
        "created_at": _to_iso(doc.get("createdAt")),
        "file_url": str(first or ""),
    }


async def _fetch_docs(db, sn: str, projection: dict, limit: int) -> list[dict]:
    try:
        cursor = db.get_collection(sn).find({}, projection).sort([("createdAt", -1), ("_id", -1)]).limit(limit)
        return await cursor.to_list(length=limit)
    except Exception:
        traceback.print_exc()
        return []


def _load_scope(current: UserClaims, station_id: Optional[str]) -> tuple[list[dict], list[dict]]:
    """สถานี + ตู้ที่ผู้เรียกเห็นได้ — กติกาเดียวกับ /pm-reports/* (ดู load_station_scope)"""
    return load_station_scope(
        current, station_id,
        station_fields=("station_id", "station_name", "company"),
        charger_fields=("SN", "station_id", "brand"),
    )


# ===== Endpoint =====

@router.get("/test-reports/all-stations")
async def get_all_station_test_reports(
    station_id: Optional[str] = Query(None),
    test_type: Optional[str] = Query(None, description="DC | AC"),
    limit_per_source: int = Query(50, ge=1, le=200),
    current: UserClaims = Depends(get_current_user),
):
    loop = asyncio.get_running_loop()
    try:
        stations, chargers = await loop.run_in_executor(None, _load_scope, current, station_id)
    except Exception:
        traceback.print_exc()
        stations, chargers = [], []

    station_name_map = {s["station_id"]: s.get("station_name") or "-" for s in stations if s.get("station_id")}
    station_company_map = {s["station_id"]: s.get("company") or "" for s in stations if s.get("station_id")}

    sn_station: dict[str, str] = {}
    sn_brand: dict[str, str] = {}
    for c in chargers:
        sn = str(c.get("SN") or "").strip()
        if not sn or sn == "-":
            continue
        sn_station[sn] = c.get("station_id") or ""
        sn_brand[sn] = str(c.get("brand") or "").strip()

    if not sn_station:
        return {"reports": [], "total": 0, "stations_count": len(station_name_map)}

    wanted = (test_type or "").strip().upper()
    sources = [s for s in TEST_SOURCES if not wanted or s[0] == wanted]

    # collection = SN → ถามชื่อ collection ที่มีจริงครั้งเดียวต่อ DB แทนการยิงทุกตู้ × 4 DB
    existing = await asyncio.gather(*(db.list_collection_names() for _, _, db in sources), return_exceptions=True)

    jobs: list[tuple[str, str, str]] = []
    tasks = []
    for (ttype, kind, db), names in zip(sources, existing):
        if isinstance(names, BaseException):
            traceback.print_exception(names)
            continue
        projection = REPORT_PROJECTION if kind == "report" else UPLOAD_PROJECTION
        for sn in sorted(set(names) & sn_station.keys()):
            jobs.append((ttype, kind, sn))
            tasks.append(_fetch_docs(db, sn, projection, limit_per_source))

    results = await asyncio.gather(*tasks)

    reports: list[dict] = []
    for (ttype, kind, sn), docs in zip(jobs, results):
        serialize = _serialize_report if kind == "report" else _serialize_upload
        sid = sn_station[sn]
        for doc in docs:
            row = serialize(doc, ttype, sn)
            row["station_id"] = sid
            row["station_name"] = station_name_map.get(sid, "-")
            row["company"] = station_company_map.get(sid, "")
            row["charger_brand"] = sn_brand.get(sn, "")
            reports.append(row)

    reports.sort(key=lambda r: (r.get("test_date") or "", r.get("created_at") or ""), reverse=True)

    return {
        "reports": reports,
        "total": len(reports),
        "stations_count": len(station_name_map),
    }
