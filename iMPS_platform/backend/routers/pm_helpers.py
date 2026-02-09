"""Shared helpers for PM/CM/Test reports: issue_id, doc_name, file upload utils"""
from fastapi import HTTPException
from datetime import datetime, timezone, date
from pymongo import ReturnDocument
from typing import Literal
import re, os, secrets

from config import (
    _validate_station_id,
    PMReportDB, PMUrlDB,
    MDBPMReportDB, MDBPMUrlDB,
    CCBPMReportDB, CCBPMUrlDB,
    CBBOXPMReportDB, CBBOXPMUrlDB,
    stationPMReportDB, stationPMUrlDB,
)

# ─── File Upload Constants ────────────────────────────────────
UPLOADS_ROOT = os.getenv("UPLOADS_ROOT", "./uploads")
os.makedirs(UPLOADS_ROOT, exist_ok=True)

ALLOWED_EXTS = {"jpg", "jpeg", "png", "webp", "gif", "pdf", "heic", "heif"}
MAX_FILE_MB = 20


# ─── SN Validation ────────────────────────────────────────────
def _validate_sn(sn: str):
    if not sn or not re.fullmatch(r"[A-Za-z0-9_\-]+", str(sn)):
        raise HTTPException(status_code=400, detail="Bad SN format")


# ─── Collection Getters (charger) ─────────────────────────────
def get_pmreport_collection_for(sn: str):
    _validate_sn(sn)
    return PMReportDB.get_collection(str(sn))

def get_pmurl_coll_upload(sn: str):
    _validate_sn(sn)
    return PMUrlDB.get_collection(str(sn))


# ─── Collection Getters (MDB) ─────────────────────────────────
def get_mdbpmreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    return MDBPMReportDB.get_collection(str(station_id))

def get_mdbpmurl_coll_upload(station_id: str):
    _validate_station_id(station_id)
    return MDBPMUrlDB.get_collection(str(station_id))


# ─── Collection Getters (CCB) ─────────────────────────────────
def get_ccbpmreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    return CCBPMReportDB.get_collection(str(station_id))

def get_ccbpmurl_coll_upload(station_id: str):
    _validate_station_id(station_id)
    return CCBPMUrlDB.get_collection(str(station_id))


# ─── Collection Getters (CB-BOX) ──────────────────────────────
def get_cbboxpmreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    return CBBOXPMReportDB.get_collection(str(station_id))

def get_cbboxpmurl_coll_upload(station_id: str):
    _validate_station_id(station_id)
    return CBBOXPMUrlDB.get_collection(str(station_id))


# ─── Collection Getters (Station) ─────────────────────────────
def get_stationpmreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    return stationPMReportDB.get_collection(str(station_id))

def get_stationpmurl_coll_upload(station_id: str):
    _validate_station_id(station_id)
    return stationPMUrlDB.get_collection(str(station_id))


# ─── Source Router ─────────────────────────────────────────────
def _get_collections_for_source(
    identifier: str,
    source: Literal["charger", "mdb", "ccb", "cbbox", "station"],
) -> tuple:
    """Return (report_coll, url_coll) pair for the given source type."""
    if source == "charger":
        _validate_sn(identifier)
        return get_pmreport_collection_for(identifier), get_pmurl_coll_upload(identifier)

    _validate_station_id(identifier)

    if source == "mdb":
        return get_mdbpmreport_collection_for(identifier), get_mdbpmurl_coll_upload(identifier)
    elif source == "ccb":
        return get_ccbpmreport_collection_for(identifier), get_ccbpmurl_coll_upload(identifier)
    elif source == "cbbox":
        return get_cbboxpmreport_collection_for(identifier), get_cbboxpmurl_coll_upload(identifier)
    elif source == "station":
        return get_stationpmreport_collection_for(identifier), get_stationpmurl_coll_upload(identifier)
    else:
        raise ValueError(f"Unknown source: {source}")


# ─── Shared Async Helpers ─────────────────────────────────────
async def _latest_issue_id_anywhere(
    identifier: str,
    pm_type: str,
    d: date,
    source: Literal["charger", "mdb", "ccb", "cbbox", "station"] = "charger",
) -> str | None:
    """Find latest issue_id from both report and URL collections."""
    rep_coll, url_coll = _get_collections_for_source(identifier, source)

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"

    pipeline = [
        {"$match": {"issue_id": {"$regex": f"^{prefix}\\d+$"}}},
        {"$project": {"issue_id": 1}},
    ]

    rep_docs = await rep_coll.aggregate(pipeline).to_list(length=1000)
    url_docs = await url_coll.aggregate(pipeline).to_list(length=1000)

    best = None
    best_n = 0
    for ddoc in rep_docs + url_docs:
        s = ddoc.get("issue_id") or ""
        m = re.search(r"(\d+)$", s)
        if not m:
            continue
        n = int(m.group(1))
        if n > best_n:
            best_n = n
            best = s

    return best


async def _next_issue_id(db, sn: str, pm_type: str, d, pad: int = 2) -> str:
    """Generate next issue_id using atomic sequence."""
    yymm = f"{d.year % 100:02d}{d.month:02d}"
    seq = await db.pm_sequences.find_one_and_update(
        {"sn": sn, "pm_type": pm_type, "yymm": yymm},
        {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"PM-{pm_type}-{yymm}-{int(seq['n']):0{pad}d}"


async def _next_issue_id_no_conflict(db, coll, url_coll, sn, pm_type, d, pad=2):
    """Generate next issue_id with atomic sequence — no while loop."""
    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"

    seq = await db.pm_sequences.find_one_and_update(
        {"sn": sn, "pm_type": pm_type, "yymm": yymm},
        {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"{prefix}{int(seq['n']):0{pad}d}"


async def _latest_doc_name_from_pmreport(
    identifier: str,
    pm_date: str,
    source: Literal["charger", "mdb", "ccb", "cbbox", "station"] = "charger",
) -> dict | None:
    """Get latest doc_name from report collection for the same year."""
    rep_coll, _ = _get_collections_for_source(identifier, source)

    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
        year = d.year
    except ValueError:
        return None

    pipeline = [
        {"$match": {"doc_name": {"$regex": f"^{re.escape(identifier)}_\\d+/{year}$"}}},
        {"$sort": {"_id": -1}},
        {"$limit": 1},
        {"$project": {"_id": 1, "doc_name": 1}},
    ]

    cursor = rep_coll.aggregate(pipeline)
    docs = await cursor.to_list(length=1)
    return docs[0] if docs else None


async def _latest_doc_name_anywhere(
    sn: str,
    year: int,
    source: Literal["charger", "mdb", "ccb", "cbbox", "station"] = "charger",
) -> str | None:
    """Find latest doc_name from both report and URL collections."""
    rep_coll, url_coll = _get_collections_for_source(sn, source)

    pattern = f"^{re.escape(sn)}_\\d+/{year}$"

    pipeline = [
        {"$match": {"doc_name": {"$regex": pattern}}},
        {"$project": {"doc_name": 1}},
    ]

    rep_docs = await rep_coll.aggregate(pipeline).to_list(length=1000)
    url_docs = await url_coll.aggregate(pipeline).to_list(length=1000)

    best_seq = 0
    best_name = None
    for d in rep_docs + url_docs:
        name = d.get("doc_name") or ""
        m = re.search(r"_(\d+)/\d{4}$", name)
        if not m:
            continue
        seq = int(m.group(1))
        if seq > best_seq:
            best_seq = seq
            best_name = name

    return best_name


async def _next_year_seq(db, sn: str, pm_type: str, d: date) -> int:
    """Generate next year sequence number."""
    year = d.year
    seq = await db.pm_year_sequences.find_one_and_update(
        {"sn": sn, "pm_type": pm_type, "year": year},
        {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return int(seq["n"])


# ─── File Name Helpers ─────────────────────────────────────────
def _safe_name(name: str) -> str:
    """Sanitize filename: remove unsafe chars, add unique suffix."""
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    base = base.lstrip(".")
    base = base[:120] if base else ""
    stem, dot, ext = base.rpartition(".")
    if not stem:
        stem = ext or secrets.token_hex(4)
        ext = ""
        dot = ""
    unique = f"{stem}_{secrets.token_hex(3)}{dot}{ext}"
    return unique


def _ext(fname: str) -> str:
    """Extract lowercase file extension."""
    return (fname.rsplit(".", 1)[-1].lower() if "." in fname else "")


def parse_iso_any_tz(s: str) -> datetime | None:
    """Parse ISO datetime string with any timezone (or none). Returns None on failure."""
    if not isinstance(s, str):
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        try:
            return datetime.fromisoformat(s + "+00:00")
        except Exception:
            return None


# ─── Test Report Shared Helpers ────────────────────────────────
from config import ACTestReportDB, ACUrlDB, DCTestReportDB, DCUrlDB

ALLOWED_DOC_EXTS = {"pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"}
MAX_DOC_FILE_MB = 20

ALLOWED_IMAGE_EXTS = {"jpg", "jpeg", "png", "webp", "gif"}
MAX_IMAGE_FILE_MB = 10

PHOTO_GROUP_KEYS = [
    "nameplate",       # index 0
    "charger",         # index 1
    "testingEquipment", # index 2
    "testingEquipmentNameplate",  # index 3
    "gun1",            # index 4
    "gun2",            # index 5
]


def _key_for_index(i: int) -> str:
    return PHOTO_GROUP_KEYS[i] if 0 <= i < len(PHOTO_GROUP_KEYS) else f"extra{i-5}"


def _normalize_tick_to_pass(obj):
    """Convert ✓ to 'pass' recursively."""
    if isinstance(obj, dict):
        return {k: _normalize_tick_to_pass(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_normalize_tick_to_pass(v) for v in obj]
    if isinstance(obj, str):
        return "pass" if obj == "✓" else obj
    return obj


def get_dc_testreport_collection_for(sn: str):
    _validate_station_id(sn)
    return DCTestReportDB.get_collection(str(sn))

def get_dcurl_coll_upload(sn: str):
    _validate_station_id(sn)
    return DCUrlDB.get_collection(str(sn))

def get_ac_testreport_collection_for(sn: str):
    _validate_station_id(sn)
    return ACTestReportDB.get_collection(str(sn))

def get_acurl_coll_upload(sn: str):
    _validate_station_id(sn)
    return ACUrlDB.get_collection(str(sn))
