"""User & Auth routes: login, register, me, refresh, logout, CRUD"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, timedelta, timezone
from bson.objectid import ObjectId
from pymongo.errors import DuplicateKeyError
from jose import jwt, ExpiredSignatureError, JWTError
from typing import List, Optional, Union
import bcrypt, uuid, json

from config import (
    SECRET_KEY, ALGORITHM, ACCESS_COOKIE_NAME,
    ACCESS_TOKEN_EXPIRE_MINUTES_TECHNICIAN, ACCESS_TOKEN_EXPIRE_MINUTES_DEFAULT,
    SESSION_IDLE_MINUTES_TECHNICIAN, SESSION_IDLE_MINUTES_DEFAULT,
    REFRESH_TOKEN_EXPIRE_DAYS,
    users_collection, station_collection, charger_collection,
    create_access_token,
)
from deps import UserClaims, get_current_user

router = APIRouter()

def to_object_id_or_400(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid ObjectId: {s}")

class LoginRequest(BaseModel):
    email: str
    password: str

class AiPackage(BaseModel):
    enabled: bool = False
    # expires_at: Optional[datetime] = None

# class UserUpdate(BaseModel):
#     username: str | None = None
#     email: EmailStr | None = None
#     tel: str | None = None
#     company: str | None = None
#     role: str | None = None
#     is_active: bool | None = None
#     password: str | None = None
#     station_id: Optional[List[str]] = None

@router.post("/login/")
def login(body: LoginRequest, response: Response):
    user = users_collection.find_one(
        {"email": body.email},
        {"_id": 1, "email": 1, "username": 1, "password": 1, "role": 1, "company": 1, "station_id": 1},
    )
    if not user or not bcrypt.checkpw(body.password.encode("utf-8"), user["password"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    station_ids = user.get("station_id", [])
    if not isinstance(station_ids, list):
        station_ids = [station_ids]

    # 👇 สร้าง session id + ตีตราเวลา
    now = datetime.now(timezone.utc)
    sid = str(uuid.uuid4())
    
    # กำหนด token expire time ตามบทบาท
    user_role = user.get("role", "user")
    if user_role == "technician":
        token_expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES_TECHNICIAN  # 24 ชั่วโมง
    else:
        token_expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES_DEFAULT  # 15 นาที

    jwt_token = create_access_token({
        "sub": user["email"],
        "user_id": str(user["_id"]),
        "username": user.get("username"),
        "role": user_role,
        "company": user.get("company"),
        "station_ids": station_ids,
        "sid": sid,  # ⬅️ แนบ session id ไว้ใน access token
    }, expires_delta=timedelta(minutes=token_expire_minutes))

    refresh_token = create_access_token({"sub": user["email"]}, expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))

    # ✅ ผูก session ใน DB (เก็บ lastActiveAt ไว้เช็ค idle)
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "refreshTokens": [{
                "sid": sid,
                "token": refresh_token,
                "createdAt": now,
                "lastActiveAt": now,
                "expiresAt": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            }]
        }}
    )

    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=jwt_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=int(timedelta(minutes=token_expire_minutes).total_seconds()),
        path="/",
    )

    return {
        "message": "ok",
        "access_token": jwt_token,
        "refresh_token": refresh_token,
        "user": {
            "user_id": str(user["_id"]),
            "username": user.get("username"),
            "email": user["email"],
            "role": user.get("role", "user"),
            "company": user.get("company"),
            "station_id": station_ids,
        }
    }

@router.get("/me/ai-package")
def get_ai_package(current: UserClaims = Depends(get_current_user)):
    if current.role == "admin":
        return {"has_access": True, "role": "admin"}

    user = users_collection.find_one(
        {"_id": ObjectId(current.user_id)},
        {"ai_package": 1}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    pkg = user.get("ai_package", {})
    enabled = pkg.get("enabled", False)
    # expires_at = pkg.get("expires_at")

    # is_expired = False
    # if expires_at:
    #     expiry = expires_at if isinstance(expires_at, datetime) else datetime.fromisoformat(str(expires_at))
    #     if expiry.tzinfo is None:
    #         expiry = expiry.replace(tzinfo=timezone.utc)
    #     is_expired = datetime.now(timezone.utc) > expiry

    has_access = enabled

    return {
        "has_access": has_access,
        "enabled": enabled,
        "role": current.role,
    }

@router.get("/me")
def me(current: UserClaims = Depends(get_current_user)):
    if not current.user_id:
        raise HTTPException(status_code=401, detail="Missing uid in token")

    u = users_collection.find_one(
        {"_id": ObjectId(current.user_id)},
        {"_id": 1, "username": 1, "email": 1, "role": 1, "company": 1, "tel": 1,"station_id":1},
    )
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": str(u["_id"]),
        "username": u.get("username") or "",
        "email": u.get("email") or "",
        "role": u.get("role") or "",
        "company": u.get("company") or "",
        "tel": u.get("tel") or "",
        "station_id": u.get("station_id") or [],
    }

@router.get("/my-stations/detail")
def my_stations_detail(current: UserClaims = Depends(get_current_user)):
    proj = {"_id": 0, "station_id": 1, "station_name": 1}

    if current.role == "admin":
        docs = list(station_collection.find({}, proj))
        return {"stations": docs}

    # Technician → ดึง stations จาก station_id ใน user profile
    if current.role == "technician":
        # station_ids มาจาก JWT token ของผู้ใช้
        if not current.station_ids or len(current.station_ids) == 0:
            return {"stations": []}
        
        # ค้นหา stations ที่มี station_id ตรงกับ station_ids ของ user
        docs = list(station_collection.find(
            {"station_id": {"$in": current.station_ids}},
            proj
        ))
        return {"stations": docs}

    # Owner/Other roles → หา station ที่เป็นของ user นี้ (รองรับทั้ง str และ ObjectId)
    conds = [{"user_id": current.user_id}]
    try:
        conds.append({"user_id": ObjectId(current.user_id)})
    except Exception:
        pass

    docs = list(station_collection.find({"$or": conds}, proj))
    return {"stations": docs}

@router.get("/station/info")
def station_info(
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),   # ดึง claims จาก JWT
):
    # ดึงข้อมูลจากคอลเลกชัน stations
    doc = station_collection.find_one(
        {"station_id": station_id},
        # เลือก field ที่อยากคืน (ตัด _id ออกเพื่อลด serialize ปัญหา ObjectId)
        {
            "_id": 0, 
            "station_id": 1, 
            "station_name": 1, 
            "SN": 1, 
            "WO": 1,
            "brand":1, 
            "PLCFirmware": 1, 
            "PIFirmware": 1, 
            "RTFirmware": 1, 
            "chargeBoxID": 1, 
            "commit_date" :1,
            "warranty_year": 1,
            "model": 1, 
            "status": 1, 
            "module1_isActive":1, 
            "module2_isActive":1, 
            "module3_isActive":1, 
            "module4_isActive":1, 
            "module5_isActive":1, 
            "module6_isActive":1, 
            "module7_isActive":1,
            "chargerNo":1,
            "chargingCables":1
        }
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Station not found")

    return {"station": doc}

@router.get("/charger/info")
def charger_info(
    station_id: str = Query(None),
    sn: str = Query(None),
    current: UserClaims = Depends(get_current_user),
):
    query = {}
    if sn:
        query = {"SN": sn}
    elif station_id:
        query["station_id"] = station_id
    else:
        raise HTTPException(status_code=400, detail="station_id or sn required")
    
    doc = charger_collection.find_one(query, {"_id": 0})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    station = station_collection.find_one(
        {"station_id": doc.get("station_id")},
        {"_id": 0, "station_name": 1}
    )
    
    doc["station_name"] = station.get("station_name", "-") if station else "-"

    return {"station": doc}

# @router.get("/station/info/public")
# def station_info_public(
#     station_id: str = Query(...)
# ):
#     doc = station_collection.find_one(
#         {"station_id": station_id},
#         {"_id": 0, "station_id": 1, "station_name": 1, "SN": 1, "WO": 1,"chargeBoxID": 1,
#          "model": 1,"power":1, "status": 1,"brand":1,"chargerNo":1,"chargingCables":1}
#     )
#     if not doc:
#         raise HTTPException(status_code=404, detail="Station not found")
#     return {"station": doc}

@router.get("/station/info/public")
def station_info_public(
    station_id: Optional[str] = Query(None),
    sn: Optional[str] = Query(None),
):
    """
    Get charger/station info by station_id OR sn
    """
    if not station_id and not sn:
        raise HTTPException(status_code=400, detail="Either station_id or sn is required")

    doc = None

    # ถ้ามี sn ให้ค้นหาจาก charger collection ก่อน
    if sn:
        # ค้นหา charger จาก SN
        charger_doc = charger_collection.find_one(
            {"SN": sn},
            {
                "_id": 0,
                "SN": 1,
                "chargeBoxID": 1,
                "station_id": 1,
                "brand": 1,
                "model": 1,
                "power": 1,
                "chargerNo": 1,
                "PIFirmware":1,
                "numberOfCables": 1,
                "is_active": 1,
                
            }
        )
        if not charger_doc:
            raise HTTPException(status_code=404, detail=f"Charger with SN '{sn}' not found")

        # ดึง station_id จาก charger
        station_id = charger_doc.get("station_id")

        # ดึงข้อมูล station เพื่อเอา station_name
        station_doc = None
        if station_id:
            station_doc = station_collection.find_one(
                {"station_id": station_id},
                {"_id": 0, "station_name": 1}
            )

        # สร้าง response โดยรวมข้อมูลจาก charger + station
        doc = {
            "station_id": station_id,
            "station_name": station_doc.get("station_name", "") if station_doc else "",
            "SN": charger_doc.get("SN"),
            "chargeBoxID": charger_doc.get("chargeBoxID"),
            "brand": charger_doc.get("brand"),
            "model": charger_doc.get("model"),
            "power": charger_doc.get("power"),
            "chargerNo": charger_doc.get("chargerNo"),
            "PIFirmware": charger_doc.get("PIFirmware"),
            "chargingCables": charger_doc.get("numberOfCables", 1),
            "status": charger_doc.get("is_active", True),
        }

    else:
        # ค้นหาจาก station_id (logic เดิม)
        doc = station_collection.find_one(
            {"station_id": station_id},
            {
                "_id": 0,
                "station_id": 1,
                "station_name": 1,
                "SN": 1,
                "WO": 1,
                "chargeBoxID": 1,
                "model": 1,
                "power": 1,
                "status": 1,
                "brand": 1,
                "chargerNo": 1,
                "PIFirmware":1,
                "chargingCables": 1,
            }
        )
        if not doc:
            raise HTTPException(status_code=404, detail="Station not found")

    return {"station": doc}

@router.get("/get_history")
def get_history(
    station_id: str = Query(...),
    start: str = Query(...),
    end: str = Query(...),
    current: UserClaims = Depends(get_current_user),  # ← อ่านสิทธิ์จาก JWT
):
    # ✅ เช็คสิทธิ์ก่อนคิวรีทุกครั้ง
    if station_id not in set(current.station_ids):
        raise HTTPException(status_code=403, detail="Forbidden station_id")

class RefreshIn(BaseModel):
    refresh_token: str

@router.post("/refresh")
def refresh(body: RefreshIn, response: Response):
    try:
        payload = jwt.decode(body.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = users_collection.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        entry = next((t for t in user.get("refreshTokens", []) if t.get("token") == body.refresh_token), None)
        if not entry:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        now = datetime.now(timezone.utc)
        if entry.get("expiresAt") and now > entry["expiresAt"]:
            raise HTTPException(status_code=401, detail="refresh_token_expired")

        # กำหนด idle timeout ตามบทบาท
        user_role = user.get("role", "user")
        if user_role == "technician":
            idle_timeout = SESSION_IDLE_MINUTES_TECHNICIAN  # None = ไม่มี idle timeout
        else:
            idle_timeout = SESSION_IDLE_MINUTES_DEFAULT  # 15 นาที
        
        # ตรวจสอบ idle timeout
        idle_at = entry.get("lastActiveAt")
        if idle_timeout is not None and idle_at and (now - idle_at) > timedelta(minutes=idle_timeout):
            raise HTTPException(status_code=401, detail="session_idle_timeout")

        # กำหนด token expire time ตามบทบาท
        if user_role == "technician":
            token_expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES_TECHNICIAN  # 24 ชั่วโมง
        else:
            token_expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES_DEFAULT  # 15 นาที

        # สร้าง access ใหม่ (คง sid เดิม)
        station_ids = user.get("station_id", [])
        if not isinstance(station_ids, list):
            station_ids = [station_ids]

        new_access = create_access_token({
            "sub": user["email"],
            "user_id": str(user["_id"]),
            "username": user.get("username"),
            "role": user_role,
            "company": user.get("company"),
            "station_ids": station_ids,
            "sid": entry.get("sid"),
        }, expires_delta=timedelta(minutes=token_expire_minutes))

        # อัปเดต lastActiveAt
        users_collection.update_one(
            {"_id": user["_id"], "refreshTokens.token": body.refresh_token},
            {"$set": {"refreshTokens.$.lastActiveAt": now}}
        )

        # ⚠️ ตั้งคุกกี้ access ใหม่ให้ SSE ทำงานต่อได้
        response.set_cookie(
            key=ACCESS_COOKIE_NAME,
            value=new_access,
            httponly=True,
            secure=False,          # โปรดดูข้อ 2 ด้านล่าง
            samesite="lax",        # โปรดดูข้อ 2 ด้านล่าง
            max_age=int(timedelta(minutes=token_expire_minutes).total_seconds()),
            path="/",
        )
        return {"access_token": new_access}
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="refresh_token_expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
@router.post("/logout")
async def logout(email: str, refresh_token: str):
    result = users_collection.update_one(
        {"email": email, "refreshTokens.token": refresh_token},
        {"$pull": {"refreshTokens": {"token": refresh_token}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Token not found or already logged out")
    return {"msg": "Logged out successfully"}


@router.get("/username")
async def users():
    # ✅ ดึงมาเฉพาะ role = "owner"
    cursor = users_collection.find({"role": "owner"})
    usernames = [u["username"] for u in cursor]

    if not usernames:
        raise HTTPException(status_code=404, detail="owners not found")

    return {"username": usernames}
    
class register(BaseModel):
    username: str
    email: str
    password: str
    tel: str
    company: str
    role: str

@router.post("/insert_users/")
async def create_users(users: register):
    # ✅ เช็ค email ซ้ำ
    if users_collection.find_one({"email": users.email}):
        raise HTTPException(status_code=400, detail="อีเมลนี้ถูกใช้งานแล้ว")

    # hash password
    hashed_pw = bcrypt.hashpw(users.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    now = datetime.now(timezone.utc)

    allowed_roles = ["admin", "owner"]
    role = users.role if users.role in allowed_roles else "owner"

    users_collection.insert_one(
    {
        "username" : users.username,
        "email":users.email,
        "password":hashed_pw,
        "tel":users.tel,
        "refreshTokens": [],
        "role": role,
        "company":users.company,
        "createdAt": now,
        "updatedAt": now,
    })
    return {"username": users.username, "email": users.email}


@router.get("/all-users/")
def all_users(current: UserClaims = Depends(get_current_user)):
    # อนุญาตเฉพาะ admin (จะเพิ่ม owner ก็ได้ตามนโยบาย)
    if current.role != "admin":
        raise HTTPException(status_code=403, detail="forbidden")

    cursor = users_collection.find({}, {"password": 0, "refreshTokens": 0})
    docs = list(cursor)
    for d in docs:
        if "_id" in d:
            d["_id"] = str(d["_id"])
    return {"users": docs}

class addUsers(BaseModel):
    username:str
    email:str
    password:str
    tel:str
    company_name:str
    station_id:Optional[Union[str, int, List[Union[str, int]]]] = None
    role:str 
    ai_package: Optional[AiPackage] = None

class UserOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    role: str
    company: str
    station_id: List[str] = Field(default_factory=list)
    tel: str

@router.post("/add_users/", response_model=UserOut, status_code=201)
def insert_users(body: addUsers, current: UserClaims = Depends(get_current_user)):
    if current.role != "admin":
        raise HTTPException(status_code=403, detail="forbidden")

    email = body.email.lower()
    hashed = bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    station_ids: List[str] = []
    if body.station_id is not None and body.station_id != "":
        if isinstance(body.station_id, list):
            station_ids = [str(x) for x in body.station_id if str(x).strip() != ""]
        else:
            station_ids = [str(body.station_id)]

    doc = {
        "username": body.username.strip(),
        "email": email,
        "password": hashed,
        "role": body.role,
        "company": (body.company_name or "").strip() or None,
        "tel": (body.tel or "").strip() or None,
        "station_id": station_ids,
        "refreshTokens": [],
        "createdAt": datetime.now(timezone.utc),
        "ai_package": body.ai_package.model_dump() if body.ai_package else {"enabled": False},
    }

    try:
        res = users_collection.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Email already exists")

    return {
        "id": str(res.inserted_id),
        "username": doc["username"],
        "email": doc["email"],
        "role": doc["role"],
        "company": doc.get("company"),
        "station_id": doc["station_id"],
        "tel": doc.get("tel"),
        "createdAt": doc["createdAt"],
    }

@router.delete("/delete_users/{user_id}", status_code=204)
def delete_user(user_id: str, current: UserClaims = Depends(get_current_user)):
    # (ทางเลือก) บังคับสิทธิ์เฉพาะ admin/owner
    if current.role not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")

    res = users_collection.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    # 204 No Content
    return Response(status_code=204)

class UserUpdate(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    tel : str | None = None      # ใช้ "phone" ให้สอดคล้องเอกสารที่คุณมี
    company: str | None = None
    role: str | None = None       # admin เท่านั้นที่แก้ได้
    is_active: bool | None = None # admin เท่านั้นที่แก้ได้
    password: str | None = None   # จะถูกแฮชเสมอถ้ามีค่า
    station_id: Optional[List[str]] = None  # สำหรับ technician
    ai_package: Optional[AiPackage] = None

def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# ฟิลด์ที่อนุญาต
ALLOW_FIELDS_ADMIN_USER = {"username","email","password","role","company","tel","is_active","station_id","ai_package"}  
ALLOW_FIELDS_SELF_USER  = {"username", "email", "tel", "company", "password"}


@router.patch("/user_update/{id}", response_model=UserOut)
def update_user(id: str, body: UserUpdate, current: UserClaims = Depends(get_current_user)):
    oid = to_object_id_or_400(id)

    doc = users_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="user not found")

    # ── Permission: admin ทำได้ทั้งหมด, owner ได้เฉพาะของตัวเอง, อื่น ๆ ห้าม
    # if current.role == "admin":
    #     pass  # ผ่าน
    # elif current.role == "owner":
    #     if current.user_id != str(oid):
    #         raise HTTPException(status_code=403, detail="forbidden")
    # else:
    #     # กันบทบาทอื่น ๆ (เช่น user) ไม่ให้เข้ามาอัปเดต
    #     raise HTTPException(status_code=403, detail="forbidden")

    # ── เตรียม incoming fields
    incoming = {
        k: (v.strip() if isinstance(v, str) else v)
        for k, v in body.model_dump(exclude_none=True).items()
    }
    if not incoming:
        raise HTTPException(status_code=400, detail="no fields to update")

    # ── จำกัดฟิลด์ตามบทบาท
    # แนะนำให้ประกาศสองชุดนี้ไว้ด้านบนไฟล์หรือไฟล์ settings:
    ALLOW_FIELDS_ADMIN_USER = {"username","email","password","role","company","tel","is_active","station_id","ai_package"}
    ALLOW_FIELDS_SELF_OWNER = {"username", "email", "password", "tel"}   # ปรับตามที่อยากให้แก้เองได้
    if current.role == "admin":
        allowed = ALLOW_FIELDS_ADMIN_USER
    else:  # owner
        allowed = ALLOW_FIELDS_SELF_OWNER

    payload = {k: v for k, v in incoming.items() if k in allowed}
    if not payload:
        # raise HTTPException(status_code=400, detailฟแ="no permitted fields to update")
        raise HTTPException(status_code=400, detail="no permitted fields to update")

    # ── แฮชรหัสผ่านถ้ามี
    if "password" in payload:
        payload["password"] = hash_password(payload["password"])

    # ── validate station_id (ต้องเป็น list of strings)
    if "station_id" in payload:
        if payload["station_id"] is None:
            payload["station_id"] = []
        elif not isinstance(payload["station_id"], list):
            raise HTTPException(status_code=400, detail="station_id must be a list of strings")
        else:
            # ตรวจสอบว่าทั้งหมดเป็น string
            if not all(isinstance(s, str) for s in payload["station_id"]):
                raise HTTPException(status_code=400, detail="station_id must contain only strings")

    # ── validate is_active (admin เท่านั้นที่เข้ามาถึงบรรทัดนี้ได้อยู่แล้ว)
    if "is_active" in payload and not isinstance(payload["is_active"], bool):
        raise HTTPException(status_code=400, detail="is_active must be boolean")

    now = datetime.now(timezone.utc)

    if "ai_package" in payload and hasattr(payload["ai_package"], "model_dump"):
        payload["ai_package"] = payload["ai_package"].model_dump()
    payload["updatedAt"] = now

    try:
        users_collection.update_one({"_id": oid}, {"$set": payload})
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="duplicate email or username")

    newdoc = users_collection.find_one({"_id": oid}) or {}
    created_at = newdoc.get("createdAt") or now
    if "createdAt" not in newdoc:
        users_collection.update_one({"_id": oid}, {"$set": {"createdAt": created_at}})

    return {
        "id": str(newdoc["_id"]),
        "username": newdoc.get("username", ""),
        "email": newdoc.get("email", ""),
        "role": newdoc.get("role", ""),
        "company": (newdoc.get("company") or ""),
        "station_id": list(newdoc.get("station_id") or []),
        "tel": (newdoc.get("tel") or ""),
        "createdAt": created_at,
        "updatedAt": newdoc.get("updatedAt", now),
    }

