"""Station & Charger CRUD routes"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, Path, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson.objectid import ObjectId
from bson.errors import InvalidId
from zoneinfo import ZoneInfo
from pymongo.errors import DuplicateKeyError
from typing import List, Dict, Any, Optional
import json, re, uuid, pathlib, secrets

from config import (
    users_collection, station_collection, charger_collection,
    charger_onoff, _validate_station_id, th_tz, settingDB,
)
from deps import UserClaims, get_current_user
from routers.pm_helpers import (
    UPLOADS_ROOT,
)

router = APIRouter()

@router.get("/stations/")
async def get_stations(q:str = ""):
    """ค้นหาสถานนี"""
    query = {"station_name":{"$regex":  q, "$options": "i"}} if q else {}
    stations = station_collection.find(query,{"_id":0,"station_name":1})
    return [station["station_name"] for station in stations]


@router.get("/owner/stations/")
async def get_stations(q: str = "", current: UserClaims = Depends(get_current_user)):
    user_obj_id = ObjectId(current.user_id)
    user = users_collection.find_one({"_id": user_obj_id}, {"station_id": 1})
    if not user or "station_id" not in user:
        return []
    station_ids = user["station_id"]
    query_filter = {"station_id": {"$in": station_ids}}
    if q:
        query_filter["station_name"] = {"$regex": q, "$options": "i"}
    stations = station_collection.find(query_filter, {"_id": 0, "station_name": 1, "station_id": 1})
    return [{"station_name": s["station_name"], "station_id": s["station_id"]} for s in stations]


@router.get("/selected/station/{station_id}")
async def get_station_detail(station_id: str, current: UserClaims = Depends(get_current_user)):
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return jsonable_encoder(
        station,
        custom_encoder={ObjectId: str, datetime: lambda v: v.isoformat()}
    )


# --------------------------------------- helpers ---------------------------
def parse_iso_utc(s: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def to_object_id_or_400(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid user_id")


@router.get("/owners")
async def get_owners():
    cursor = users_collection.find({"role": "owner"}, {"_id": 1, "username": 1})
    owners = [{"user_id": str(u["_id"]), "username": u["username"]} for u in cursor]
    if not owners:
        raise HTTPException(status_code=404, detail="owners not found")
    return {"owners": owners}


async def latest_onoff(sn: str) -> Dict[str, Any]:
    try:
        coll = charger_onoff.get_collection(sn)
        cursor = coll.find().sort([("payload.timestamp", -1), ("_id", -1)]).limit(1)
        docs = await cursor.to_list(length=1)
        doc = docs[0] if docs else None
        if not doc:
            return {"status": None, "statusAt": None}
        payload = doc.get("payload", {})
        val = payload.get("value", None)
        ts = payload.get("timestamp", None)
        if isinstance(val, (int, bool)):
            status = bool(val)
        else:
            try:
                status = bool(int(val))
            except Exception:
                status = None
        status_at = parse_iso_utc(ts) if isinstance(ts, str) else None
        return {"status": status, "statusAt": status_at}
    except Exception as e:
        print(f"[latest_onoff] Error for SN {sn}: {e}")
        return {"status": None, "statusAt": None}

    
@router.get("/charger-onoff/{sn}")
async def station_onoff_latest(sn: str, current: UserClaims = Depends(get_current_user)):
    data = await latest_onoff(str(sn))
    status_at_iso = (
        data["statusAt"].astimezone(ZoneInfo("Asia/Bangkok")).isoformat()
        if data["statusAt"] else None
    )
    return {"sn": sn, "status": data["status"], "statusAt": status_at_iso}


def parse_iso_any_tz(s: str) -> datetime | None:
    if not isinstance(s, str):
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        try:
            return datetime.fromisoformat(s + "+00:00")
        except Exception:
            return None


# ============================================================
# Models
# ============================================================

class ChargerCreate(BaseModel):
    chargeBoxID: Optional[str] = ""
    chargerNo: Optional[int] = None
    brand: str
    model: str
    SN: str
    WO: Optional[str] = ""
    power: Optional[str] = ""
    PLCFirmware: Optional[str] = ""
    PIFirmware: Optional[str] = ""
    RTFirmware: Optional[str] = ""
    commissioningDate: Optional[str] = None
    warrantyYears: Optional[int] = 1
    numberOfCables: Optional[int] = 1
    is_active: Optional[bool] = True
    location: Optional[str] = ""
    description: Optional[str] = ""
    ocppUrl: Optional[str] = ""
    chargerType: Optional[str] = "DC"

class ChargerUpdate(BaseModel):
    chargeBoxID: Optional[str] = None
    chargerNo: Optional[int] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    SN: Optional[str] = None
    WO: Optional[str] = None
    power: Optional[str] = None
    PLCFirmware: Optional[str] = None
    PIFirmware: Optional[str] = None
    RTFirmware: Optional[str] = None
    commissioningDate: Optional[str] = None
    warrantyYears: Optional[int] = None
    numberOfCables: Optional[int] = None
    is_active: Optional[bool] = None
    location: Optional[str] = None
    description: Optional[str] = None
    ocppUrl: Optional[str] = None
    chargerType: Optional[str] = None

class ChargerOut(BaseModel):
    id: str
    station_id: str
    chargeBoxID: Optional[str] = ""
    chargerNo: Optional[int] = None
    brand: str
    model: str
    SN: str
    WO: Optional[str] = ""
    power: Optional[str] = ""
    PLCFirmware: Optional[str] = ""
    PIFirmware: Optional[str] = ""
    RTFirmware: Optional[str] = ""
    commissioningDate: Optional[str] = None
    warrantyYears: Optional[int] = 1
    numberOfCables: Optional[int] = 1
    is_active: Optional[bool] = True
    location: Optional[str] = ""
    description: Optional[str] = ""
    ocppUrl: Optional[str] = ""
    chargerType: Optional[str] = ""
    status: Optional[bool] = None
    images: Optional[dict] = None       # { "charger": [url, ...], "device": [...], "mdb": [...] }
    createdAt: Optional[datetime] = None
    createdBy: Optional[str] = None
    updatedAt: Optional[datetime] = None
    updatedBy: Optional[str] = None

class StationCreate(BaseModel):
    station_id: str
    station_name: str
    user_id: Optional[str] = None
    owner: Optional[str] = None
    is_active: Optional[bool] = True
    location: Optional[str] = ""
    description: Optional[str] = ""

class StationUpdate(BaseModel):
    station_name: Optional[str] = None
    is_active: Optional[bool] = None
    user_id: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None

class StationOut(BaseModel):
    id: str
    station_id: str
    station_name: str
    user_id: str
    username: Optional[str] = None
    is_active: bool
    location: Optional[str] = ""
    description: Optional[str] = ""
    status: Optional[bool] = None
    stationImage: Optional[str] = None       # backward compat — รูปแรก
    stationImages: Optional[list] = []       # ← ใหม่: list ทั้งหมด
    chargers: List[ChargerOut] = []
    createdAt: Optional[datetime] = None
    createdBy: Optional[str] = None
    updatedAt: Optional[datetime] = None
    updatedBy: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.astimezone(ZoneInfo("Asia/Bangkok")).isoformat()
        }

class StationWithChargersCreate(BaseModel):
    station: StationCreate
    chargers: List[ChargerCreate]

class StationWithChargersOut(BaseModel):
    station: StationOut
    chargers: List[ChargerOut]


# ============================================================
# Normalize images — backward compat (string → list)
# ============================================================

def _normalize_images(images: Any) -> dict:
    """
    แปลง images ให้เป็น format ใหม่ (list) เสมอ
    เก่า: {"charger": "/uploads/x.jpg"}
    ใหม่: {"charger": ["/uploads/x.jpg", ...]}
    """
    if not isinstance(images, dict):
        return {}
    result = {}
    for key, val in images.items():
        if isinstance(val, list):
            result[key] = val
        elif isinstance(val, str) and val:
            result[key] = [val]
        else:
            result[key] = []
    return result


# ============================================================
# Helper Functions
# ============================================================

def to_object_id(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid ID format")


def get_username_by_user_id(user_id: ObjectId) -> Optional[str]:
    user = users_collection.find_one({"_id": user_id}, {"username": 1})
    return user.get("username") if user else None


def get_actor_id(current: UserClaims) -> str:
    return current.user_id


def get_charger_status(station_id: str, chargeBoxID: str) -> bool:
    try:
        coll = charger_onoff.get_collection(str(station_id))
        doc = coll.find_one(
            {"payload.chargeBoxID": chargeBoxID},
            sort=[("payload.timestamp", -1), ("_id", -1)]
        )
        if not doc:
            return False
        val = doc.get("payload", {}).get("value", 0)
        return bool(int(val)) if not isinstance(val, bool) else val
    except Exception:
        return False

def get_station_status(station_id: str) -> bool:
    try:
        coll = charger_onoff.get_collection(str(station_id))
        doc = coll.find_one(sort=[("payload.timestamp", -1), ("_id", -1)])
        if not doc:
            return False
        val = doc.get("payload", {}).get("value", 0)
        return bool(int(val)) if not isinstance(val, bool) else val
    except Exception:
        return False


def get_next_charger_no(station_id: str) -> int:
    max_charger = charger_collection.find_one(
        {"station_id": station_id},
        sort=[("chargerNo", -1)]
    )
    if max_charger and max_charger.get("chargerNo"):
        return max_charger["chargerNo"] + 1
    return 1


def format_charger(doc: dict, include_status: bool = True) -> ChargerOut:
    charger_id = str(doc["_id"])
    station_id = doc.get("station_id", "")
    status = None
    if include_status:
        status = get_charger_status(station_id, doc.get("chargeBoxID", ""))
    
    normalized = _normalize_images(doc.get("images", {}))
    
    return ChargerOut(
        id=charger_id,
        station_id=station_id,
        chargeBoxID=doc.get("chargeBoxID", ""),
        chargerNo=doc.get("chargerNo"),
        brand=doc.get("brand", ""),
        model=doc.get("model", ""),
        SN=doc.get("SN", ""),
        WO=doc.get("WO", ""),
        power=doc.get("power", ""),
        PLCFirmware=doc.get("PLCFirmware", ""),
        PIFirmware=doc.get("PIFirmware", ""),
        RTFirmware=doc.get("RTFirmware", ""),
        commissioningDate=doc.get("commissioningDate"),
        warrantyYears=doc.get("warrantyYears", 1),
        numberOfCables=doc.get("numberOfCables", 1),
        is_active=doc.get("is_active", True),
        location=doc.get("location", ""),
        description=doc.get("description", ""),
        ocppUrl=doc.get("ocppUrl", ""),
        chargerType=doc.get("chargerType", ""),
        status=status,
        images=normalized,
        createdAt=doc.get("createdAt"),
        createdBy=doc.get("createdBy"),
        updatedAt=doc.get("updatedAt"),
        updatedBy=doc.get("updatedBy"),
    )

def format_station_with_chargers(station_doc: dict, charger_docs: List[dict]) -> StationOut:
    station_id = station_doc.get("station_id", "")
    user_id = station_doc.get("user_id")
    user_id_str = str(user_id) if user_id else ""
    
    username = None
    if user_id:
        username = get_username_by_user_id(user_id if isinstance(user_id, ObjectId) else to_object_id(user_id))
    
    status = get_station_status(station_id)
    chargers = [format_charger(c) for c in charger_docs]
    
    normalized = _normalize_images(station_doc.get("images", {}))
    station_image_list = normalized.get("station", [])
    
    return StationOut(
        id=str(station_doc["_id"]),
        station_id=station_id,
        station_name=station_doc.get("station_name", ""),
        user_id=user_id_str,
        username=username,
        is_active=bool(station_doc.get("is_active", False)),
        location=station_doc.get("location", ""),
        description=station_doc.get("description", ""),
        status=status,
        stationImage=station_image_list[0] if station_image_list else None,
        stationImages=station_image_list,
        chargers=chargers,
        createdAt=station_doc.get("createdAt"),
        createdBy=station_doc.get("createdBy"),
        updatedAt=station_doc.get("updatedAt"),
        updatedBy=station_doc.get("updatedBy"),
    )


# ============================================================
# Image Upload Helpers
# ============================================================

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 3 * 1024 * 1024   # 3 MB per file
MAX_IMAGES_PER_KIND = 5              # สูงสุด 5 รูปต่อประเภท


def _ensure_dir(p: pathlib.Path):
    p.mkdir(parents=True, exist_ok=True)


async def save_image(folder: str, item_id: str, kind: str, upload: UploadFile) -> str:
    if upload.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {upload.content_type}")
    
    data = await upload.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="File too large (> 3MB)")
    
    subdir = pathlib.Path(UPLOADS_ROOT) / folder / item_id
    _ensure_dir(subdir)
    
    ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }.get(upload.content_type, "")
    
    fname = f"{kind}-{uuid.uuid4().hex}{ext}"
    dest = subdir / fname
    
    with open(dest, "wb") as f:
        f.write(data)
    
    return f"/uploads/{folder}/{item_id}/{fname}"


async def save_multiple_images(folder: str, item_id: str, kind: str, uploads: List[UploadFile]) -> List[str]:
    """Save multiple images, return list of URLs"""
    urls = []
    for upload in uploads:
        if upload.filename:
            url = await save_image(folder, item_id, kind, upload)
            urls.append(url)
    return urls


# ---------------------------------------------------------
# GET /all-stations/
# ---------------------------------------------------------

def to_object_id_safe(s: str):
    try:
        return ObjectId(s)
    except:
        return s
    
@router.get("/all-stations/")
def get_all_stations(
    current: UserClaims = Depends(get_current_user)
):
    print(f"=== DEBUG ===")
    print(f"user_id: {current.user_id}, role: {current.role}")
    
    if current.role == "admin":
        match_query = {}
    elif current.role == "technician":
        if current.station_ids and len(current.station_ids) > 0:
            match_query = {"station_id": {"$in": current.station_ids}}
        else:
            return {"stations": []}
    else:
        match_query = {
            "$or": [
                {"user_id": current.user_id},
                {"user_id": to_object_id_safe(current.user_id)}
            ]
        }
    
    print(f"match_query: {match_query}")
    
    stations_cursor = station_collection.find(match_query)
    stations_list = list(stations_cursor)
    print(f"Found {len(stations_list)} stations")
    
    result = []
    for station_doc in stations_list:
        station_id = station_doc.get("station_id")
        chargers_cursor = charger_collection.find({"station_id": station_id}).sort("chargerNo", 1)
        charger_docs = list(chargers_cursor)
        station_out = format_station_with_chargers(station_doc, charger_docs)
        result.append(station_out.dict())
    
    return {"stations": result}


# ---------------------------------------------------------
# POST /add_stations/
# ---------------------------------------------------------
@router.post("/add_stations/", status_code=201)
def create_station_with_chargers(
    body: StationWithChargersCreate,
    current: UserClaims = Depends(get_current_user),
):
    station_data = body.station
    chargers_data = body.chargers
    
    station_id = station_data.station_id.strip()
    if not station_id:
        raise HTTPException(status_code=400, detail="station_id is required")
    
    if station_collection.find_one({"station_id": station_id}):
        raise HTTPException(status_code=409, detail="station_id already exists")
    
    owner_oid = None
    if station_data.user_id:
        owner_oid = to_object_id(station_data.user_id)
    elif station_data.owner:
        user = users_collection.find_one({"username": station_data.owner.strip()}, {"_id": 1})
        if not user:
            raise HTTPException(status_code=400, detail="Invalid owner username")
        owner_oid = user["_id"]
    
    now = datetime.now(timezone.utc)
    actor = get_actor_id(current)
    
    station_doc = {
        "station_id": station_id,
        "station_name": station_data.station_name.strip(),
        "user_id": owner_oid,
        "is_active": station_data.is_active if station_data.is_active is not None else True,
        "location": station_data.location.strip() if station_data.location else "",
        "description": station_data.description.strip() if station_data.description else "",
        "images": {},
        "createdAt": now,
        "createdBy": actor,
    }
    
    try:
        station_result = station_collection.insert_one(station_doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="station_id already exists")
    
    created_chargers = []
    for idx, charger in enumerate(chargers_data):
        charger_no = charger.chargerNo if charger.chargerNo else idx + 1
        charger_doc = {
            "station_id": station_id,
            "chargeBoxID": charger.chargeBoxID.strip() if charger.chargeBoxID else "",
            "chargerNo": charger_no,
            "brand": charger.brand.strip(),
            "model": charger.model.strip(),
            "SN": charger.SN.strip(),
            "WO": charger.WO.strip() if charger.WO else "",
            "power": charger.power.strip() if charger.power else "",
            "PLCFirmware": charger.PLCFirmware.strip() if charger.PLCFirmware else "",
            "PIFirmware": charger.PIFirmware.strip() if charger.PIFirmware else "",
            "RTFirmware": charger.RTFirmware.strip() if charger.RTFirmware else "",
            "commissioningDate": charger.commissioningDate,
            "warrantyYears": charger.warrantyYears if charger.warrantyYears else 1,
            "numberOfCables": charger.numberOfCables if charger.numberOfCables else 1,
            "is_active": charger.is_active if charger.is_active is not None else True,
            "location": charger.location.strip() if charger.location else "",
            "description": charger.description.strip() if charger.description else "",
            "ocppUrl": charger.ocppUrl.strip() if charger.ocppUrl else "",
            "chargerType": charger.chargerType if charger.chargerType else "DC",
            "images": {},
            "createdAt": now,
            "createdBy": actor,
        }
        charger_result = charger_collection.insert_one(charger_doc)
        charger_doc["_id"] = charger_result.inserted_id
        created_chargers.append(charger_doc)
    
    station_doc["_id"] = station_result.inserted_id
    station_out = format_station_with_chargers(station_doc, created_chargers)
    
    return {
        "id": str(station_result.inserted_id),
        "station": station_out.dict(),
        "chargers": [format_charger(c, include_status=False).dict() for c in created_chargers],
    }


# ---------------------------------------------------------
# PATCH /update_stations/{id}
# ---------------------------------------------------------
@router.patch("/update_stations/{id}")
def update_station(
    id: str,
    body: StationUpdate,
    current: UserClaims = Depends(get_current_user),
):
    oid = to_object_id(id)
    station = station_collection.find_one({"_id": oid})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    update_data = {}
    if body.station_name is not None:
        update_data["station_name"] = body.station_name.strip()
    if body.is_active is not None:
        update_data["is_active"] = body.is_active
    if body.location is not None:
        update_data["location"] = body.location.strip()
    if body.description is not None:
        update_data["description"] = body.description.strip()
    
    if body.user_id is not None:
        new_user_oid = to_object_id(body.user_id)
        update_data["user_id"] = new_user_oid
        user = users_collection.find_one({"_id": new_user_oid})
        if user:
            update_data["username"] = user.get("username", "")
        else:
            raise HTTPException(status_code=400, detail="User not found")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    update_data["updatedBy"] = get_actor_id(current)
    
    station_collection.update_one({"_id": oid}, {"$set": update_data})
    
    updated = station_collection.find_one({"_id": oid})
    chargers = list(charger_collection.find({"station_id": updated["station_id"]}).sort("chargerNo", 1))
    
    return format_station_with_chargers(updated, chargers).dict()


# ---------------------------------------------------------
# DELETE /delete_stations/{id}
# ---------------------------------------------------------
@router.delete("/delete_stations/{id}", status_code=204)
def delete_station(
    id: str,
    current: UserClaims = Depends(get_current_user),
):
    oid = to_object_id(id)
    station = station_collection.find_one({"_id": oid})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    station_id = station["station_id"]
    charger_collection.delete_many({"station_id": station_id})
    station_collection.delete_one({"_id": oid})
    return Response(status_code=204)


# ---------------------------------------------------------
# POST /add_charger/{station_id}
# ---------------------------------------------------------
@router.post("/add_charger/{station_id}", status_code=201)
def add_charger_to_station(
    station_id: str,
    body: ChargerCreate,
    current: UserClaims = Depends(get_current_user),
):
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    charger_no = body.chargerNo if body.chargerNo else get_next_charger_no(station_id)
    
    now = datetime.now(timezone.utc)
    actor = get_actor_id(current)
    
    charger_doc = {
        "station_id": station_id,
        "chargeBoxID": body.chargeBoxID.strip() if body.chargeBoxID else "",
        "chargerNo": charger_no,
        "brand": body.brand.strip(),
        "model": body.model.strip(),
        "SN": body.SN.strip(),
        "WO": body.WO.strip() if body.WO else "",
        "power": body.power.strip() if body.power else "",
        "PLCFirmware": body.PLCFirmware.strip() if body.PLCFirmware else "",
        "PIFirmware": body.PIFirmware.strip() if body.PIFirmware else "",
        "RTFirmware": body.RTFirmware.strip() if body.RTFirmware else "",
        "commissioningDate": body.commissioningDate,
        "warrantyYears": body.warrantyYears if body.warrantyYears else 1,
        "numberOfCables": body.numberOfCables if body.numberOfCables else 1,
        "is_active": body.is_active if body.is_active is not None else True,
        "location": body.location.strip() if body.location else "",
        "description": body.description.strip() if body.description else "",
        "ocppUrl": body.ocppUrl.strip() if body.ocppUrl else "",
        "chargerType": body.chargerType if body.chargerType else "DC",
        "images": {},
        "createdAt": now,
        "createdBy": actor,
    }
    
    result = charger_collection.insert_one(charger_doc)
    charger_doc["_id"] = result.inserted_id
    return format_charger(charger_doc, include_status=False).dict()


# ---------------------------------------------------------
# PATCH /update_charger/{id}
# ---------------------------------------------------------
@router.patch("/update_charger/{id}")
def update_charger(
    id: str,
    body: ChargerUpdate,
    current: UserClaims = Depends(get_current_user),
):
    oid = to_object_id(id)
    charger = charger_collection.find_one({"_id": oid})
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    update_data = {}
    for field in ["chargeBoxID", "brand", "model", "SN", "WO", "power", "PLCFirmware", "PIFirmware", "RTFirmware", "commissioningDate", "location", "description", "ocppUrl", "chargerType"]:
        value = getattr(body, field, None)
        if value is not None:
            update_data[field] = value.strip() if isinstance(value, str) else value
    
    for field in ["chargerNo", "warrantyYears", "numberOfCables"]:
        value = getattr(body, field, None)
        if value is not None:
            update_data[field] = value
    
    if body.is_active is not None:
        update_data["is_active"] = body.is_active
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    update_data["updatedBy"] = get_actor_id(current)
    
    charger_collection.update_one({"_id": oid}, {"$set": update_data})
    
    updated = charger_collection.find_one({"_id": oid})
    return format_charger(updated).dict()


# ---------------------------------------------------------
# DELETE /delete_charger/{id}
# ---------------------------------------------------------
@router.delete("/delete_charger/{id}", status_code=204)
def delete_charger(
    id: str,
    current: UserClaims = Depends(get_current_user),
):
    oid = to_object_id(id)
    charger = charger_collection.find_one({"_id": oid})
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    charger_collection.delete_one({"_id": oid})
    return Response(status_code=204)


# ============================================================
# Image Upload — Multi-image support
# ============================================================

# ---------------------------------------------------------
# POST /stations/{station_id}/upload-image  — รับหลายรูป (append)
# ---------------------------------------------------------
@router.post("/stations/{station_id}/upload-image")
async def upload_station_image(
    station_id: str,
    station: List[UploadFile] = File([]),
    current: UserClaims = Depends(get_current_user),
):
    """Upload image(s) for Station — append ต่อท้าย list เดิม"""
    
    doc = station_collection.find_one({"station_id": station_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # กรอง empty
    valid = [f for f in station if f.filename]
    if not valid:
        return {"updated": False, "images": _normalize_images(doc.get("images", {}))}
    
    images = _normalize_images(doc.get("images", {}))
    existing = images.get("station", [])
    
    if len(existing) + len(valid) > MAX_IMAGES_PER_KIND:
        raise HTTPException(
            status_code=400,
            detail=f"สูงสุด {MAX_IMAGES_PER_KIND} รูป (ตอนนี้มี {len(existing)} รูป)"
        )
    
    new_urls = await save_multiple_images("stations", station_id, "station", valid)
    existing.extend(new_urls)
    images["station"] = existing
    
    station_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "images": images,
            "updatedAt": datetime.now(timezone.utc),
            "updatedBy": get_actor_id(current),
        }}
    )
    
    return {"updated": True, "images": images}


# ---------------------------------------------------------
# POST /chargers/{charger_id}/upload-images  — รับหลายรูปต่อประเภท (append)
# ---------------------------------------------------------
@router.post("/chargers/{charger_id}/upload-images")
async def upload_charger_images(
    charger_id: str,
    mdb: List[UploadFile] = File([]),
    charger: List[UploadFile] = File([]),
    device: List[UploadFile] = File([]),
    current: UserClaims = Depends(get_current_user),
):
    """Upload image(s) for Charger — append ต่อท้าย list เดิม"""
    
    oid = to_object_id(charger_id)
    doc = charger_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    images = _normalize_images(doc.get("images", {}))
    any_updated = False
    
    for kind, uploads in {"mdb": mdb, "charger": charger, "device": device}.items():
        valid = [u for u in uploads if u.filename]
        if not valid:
            continue
        
        existing = images.get(kind, [])
        if len(existing) + len(valid) > MAX_IMAGES_PER_KIND:
            raise HTTPException(
                status_code=400,
                detail=f"สูงสุด {MAX_IMAGES_PER_KIND} รูป {kind} (ตอนนี้มี {len(existing)} รูป)"
            )
        
        new_urls = await save_multiple_images("chargers", charger_id, kind, valid)
        existing.extend(new_urls)
        images[kind] = existing
        any_updated = True
    
    if not any_updated:
        return {"updated": False, "images": images}
    
    charger_collection.update_one(
        {"_id": oid},
        {"$set": {
            "images": images,
            "updatedAt": datetime.now(timezone.utc),
            "updatedBy": get_actor_id(current),
        }}
    )
    
    return {"updated": True, "images": images}


# ---------------------------------------------------------
# DELETE — ลบรูปทีละรูป
# ---------------------------------------------------------
class DeleteImageRequest(BaseModel):
    kind: str       # "charger" | "device" | "mdb" | "station"
    url: str        # URL ของรูปที่ต้องการลบ


@router.delete("/stations/{station_id}/delete-image")
def delete_station_image(
    station_id: str,
    body: DeleteImageRequest,
    current: UserClaims = Depends(get_current_user),
):
    """ลบรูปทีละรูปจาก station"""
    doc = station_collection.find_one({"station_id": station_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Station not found")
    
    images = _normalize_images(doc.get("images", {}))
    kind_list = images.get(body.kind, [])
    
    if body.url not in kind_list:
        raise HTTPException(status_code=404, detail="Image not found")
    
    kind_list.remove(body.url)
    images[body.kind] = kind_list
    
    station_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "images": images,
            "updatedAt": datetime.now(timezone.utc),
            "updatedBy": get_actor_id(current),
        }}
    )
    
    # ลบไฟล์จริง (ไม่ error ถ้าไม่เจอ)
    try:
        file_path = pathlib.Path(UPLOADS_ROOT).parent / body.url.lstrip("/")
        if file_path.exists():
            file_path.unlink()
    except Exception:
        pass
    
    return {"deleted": True, "images": images}


@router.delete("/chargers/{charger_id}/delete-image")
def delete_charger_image(
    charger_id: str,
    body: DeleteImageRequest,
    current: UserClaims = Depends(get_current_user),
):
    """ลบรูปทีละรูปจาก charger"""
    oid = to_object_id(charger_id)
    doc = charger_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    images = _normalize_images(doc.get("images", {}))
    kind_list = images.get(body.kind, [])
    
    if body.url not in kind_list:
        raise HTTPException(status_code=404, detail="Image not found")
    
    kind_list.remove(body.url)
    images[body.kind] = kind_list
    
    charger_collection.update_one(
        {"_id": oid},
        {"$set": {
            "images": images,
            "updatedAt": datetime.now(timezone.utc),
            "updatedBy": get_actor_id(current),
        }}
    )
    
    try:
        file_path = pathlib.Path(UPLOADS_ROOT).parent / body.url.lstrip("/")
        if file_path.exists():
            file_path.unlink()
    except Exception:
        pass
    
    return {"deleted": True, "images": images}


# ---------------------------------------------------------
# GET /station/{station_id}
# ---------------------------------------------------------
@router.get("/station/{station_id}")
def get_station(station_id: str):
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    chargers = list(charger_collection.find({"station_id": station_id}).sort("chargerNo", 1))
    return format_station_with_chargers(station, chargers).dict()


# ---------------------------------------------------------
# GET /chargers/{station_id}
# ---------------------------------------------------------
@router.get("/chargers/{station_id}")
def get_chargers_by_station(station_id: str):
    chargers = list(charger_collection.find({"station_id": station_id}).sort("chargerNo", 1))
    return {"chargers": [format_charger(c).dict() for c in chargers]}


class AvailabilityOut(BaseModel):
    station_id: str
    total: int
    available: int

@router.get("/station-availability/{station_id}")
async def get_station_availability(station_id: str):
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    chargers = list(charger_collection.find({"station_id": station_id}, {"SN": 1}))

    total = 0
    available = 0
    per_charger = []

    for charger in chargers:
        sn = charger.get("SN", "")
        if not sn or sn == "-":
            continue
        try:
            coll = settingDB[sn]
            doc = await coll.find_one({}, {"_id": 0}, sort=[("_id", -1)])
            if not doc:
                continue
            c_total = 0
            c_available = 0
            n = 1
            while f"icp{n}" in doc:
                c_total += 1
                try:
                    icp = int(doc.get(f"icp{n}", 0))
                    usl = int(doc.get(f"usl{n}", 1))
                except (ValueError, TypeError):
                    n += 1
                    continue
                if icp == 1 and usl == 0:
                    c_available += 1
                n += 1
            total += c_total
            available += c_available
            per_charger.append({"sn": sn, "total": c_total, "available": c_available})
        except Exception as e:
            print(f"[availability] Error for SN {sn}: {e}")
            continue

    return {
        "station_id": station_id,
        "total": total,
        "available": available,
        "chargers": per_charger,
    }