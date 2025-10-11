"use client"

from fastapi import FastAPI,HTTPException,Depends, status,Request,Query,APIRouter, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder 
from fastapi.security import OAuth2PasswordRequestForm,OAuth2PasswordBearer
from jose import JWTError,jwt
from jose.exceptions import ExpiredSignatureError
from datetime import datetime, timedelta, UTC, timezone, time
from pymongo.errors import OperationFailure, PyMongoError,DuplicateKeyError
from pymongo import MongoClient
from pydantic import BaseModel,EmailStr,constr, Field
from bson.objectid import ObjectId
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import json, os, asyncio
from pdf.pdf_routes import router as pdf_router
from fastapi.responses import StreamingResponse,Response
from typing import List, Any,Dict, Optional, Union, Literal
import bcrypt
from dateutil import parser as dtparser
from bson.decimal128 import Decimal128
from fastapi import Path
import uuid
from zoneinfo import ZoneInfo
import re
from fastapi import HTTPException, Depends
from fastapi.responses import JSONResponse
from dateutil.relativedelta import relativedelta

SECRET_KEY = "supersecret"  # ใช้จริงควรเก็บเป็น env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7


app = FastAPI()

client1 = MongoClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")
client = AsyncIOMotorClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")

deviceDB = client["utilizationFactor"]
settingDB = client["settingParameter"]

db = client1["iMPS"]
users_collection = db["users"]
station_collection = db["stations"]

MDB_DB = client["MDB"]
PMReportDB = client["PMReport"]



# MDB_collection = MDB_DB["nongKhae"]
def get_mdb_collection_for(station_id: str):
    # กันชื่อคอลเลกชันแปลก ๆ / injection: อนุญาต a-z A-Z 0-9 _ -
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    return MDB_DB.get_collection(str(station_id))

def _ensure_utc_iso(v):
    """
    รับ string เวลาแบบ 'YYYY-MM-DDTHH:MM:SS(.ffffff)' ที่ 'ไม่มีโซนเวลา'
    → เติม 'Z' ให้เป็น UTC ISO เสมอ
    """
    if isinstance(v, str) and re.match(r'^\d{4}-\d{2}-\d{2}T', v) and not re.search(r'(Z|[+\-]\d{2}:\d{2})$', v):
        return v + 'Z'
    return v


# def create_access_token(data: dict, expires_delta: int | timedelta = 15):
#     if isinstance(expires_delta, int):
#         expire = datetime.utcnow() + timedelta(minutes=expires_delta)
#     else:
#         expire = datetime.utcnow() + expires_delta
#     data.update({"exp": expire})
#     return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

def create_access_token(data: dict, expires_delta: int | timedelta = 15):
    to_encode = dict(data)
    expire = (datetime.now(timezone.utc) + (timedelta(minutes=expires_delta) if isinstance(expires_delta, int) else expires_delta))
    to_encode["exp"] = int(expire.timestamp())
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

class LoginRequest(BaseModel):
    email: str
    password: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],  # เปลี่ยนเป็น port 3001 ชั่วคราวครับ เชลซีกับพี่โจ้ รัน 3000 ไม่ได้
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login/")

class UserClaims(BaseModel):
    sub: str
    user_id: Optional[str] = None
    username: str
    role: str = "user"
    company: Optional[str] = None
    station_ids: List[str] = []
    

def get_current_user(request: Request) -> UserClaims:
    # 1) ลองอ่านจากคุกกี้ (ใช้กับ SSE)
    token = request.cookies.get(ACCESS_COOKIE_NAME)

    # 2) สำรอง: Authorization: Bearer ...
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.removeprefix("Bearer ").strip()

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="invalid_token")

        station_ids = payload.get("station_ids") or []
        if not isinstance(station_ids, list):
            station_ids = [station_ids]

        return UserClaims(
            sub=sub,
            user_id=payload.get("user_id"),
            username=payload.get("username"),
            role=payload.get("role", "user"),
            company=payload.get("company"),
            station_ids=station_ids,
        )
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="token_expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="invalid_token")

ACCESS_COOKIE_NAME = "access_token"

#####################loginnn
# @app.post("/login/")
# def login(form_data: OAuth2PasswordRequestForm = Depends()):
#     user = users_collection.find_one(
#         {"email": form_data.username},
#         {"_id": 1, "email": 1, "username": 1, "password": 1, "role": 1, "company": 1, "station_id": 1},
#     )
#     invalid_cred = HTTPException(status_code=401, detail="Invalid email or password")
#     if not user or not bcrypt.checkpw(form_data.password.encode("utf-8"), user["password"].encode("utf-8")):
#         raise invalid_cred

#     # ทำให้ station_ids เป็น list เสมอ
#     station_ids = user.get("station_id", [])
#     if not isinstance(station_ids, list):
#         station_ids = [station_ids]

#     # ▶ Access Token ใส่สิทธิ์ไว้เลย
#     access_token = create_access_token({
#         "sub": user["email"],
#         "user_id": str(user["_id"]),
#         "username": user.get("username"),
#         "role": user.get("role", "user"),
#         "company": user.get("company"),
#         "station_ids": station_ids,
#     })

#     # ▶ Refresh Token (มีหรือไม่มีก็ได้ตามที่คุณใช้อยู่)
#     refresh_token = create_access_token({"sub": user["email"]}, expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))

#     # อัปเดต refresh token ใน DB (จะเก็บ hash ก็ได้ ตามแนวทางที่คุยกันก่อนหน้า)
#     users_collection.update_one({"_id": user["_id"]}, {"$set": {
#         "refreshTokens": [{
#             "token": refresh_token,
#             "createdAt": datetime.utcnow(),
#             "expiresAt": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
#         }]
#     }})

#     return {
#         "message": "Login success ✅",
#         "access_token": access_token,
#         "refresh_token": refresh_token,
#         "user": {
#             "user_id": str(user["_id"]),
#             "username": user.get("username"),
#             "email": user["email"],
#             "role": user.get("role", "user"),
#             "company": user.get("company"),
#             "station_id": station_ids,
#         }
#     }

@app.post("/login/")
def login(body: LoginRequest, response: Response):
    # หา user
    user = users_collection.find_one(
        {"email": body.email},
        {"_id": 1, "email": 1, "username": 1, "password": 1, "role": 1, "company": 1, "station_id": 1},
    )
    if not user or not bcrypt.checkpw(body.password.encode("utf-8"), user["password"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # ให้ station_id เป็น list เสมอ
    station_ids = user.get("station_id", [])
    if not isinstance(station_ids, list):
        station_ids = [station_ids]

    # ออก access token
    jwt_token = create_access_token({
        "sub": user["email"],
        "user_id": str(user["_id"]),
        "username": user.get("username"),
        "role": user.get("role", "user"),
        "company": user.get("company"),
        "station_ids": station_ids,
    }, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))

    # ออก refresh token (ถ้าใช้)
    refresh_token = create_access_token({"sub": user["email"]}, expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    users_collection.update_one({"_id": user["_id"]}, {"$set": {
        "refreshTokens": [{
            "token": refresh_token,
            "createdAt": datetime.now(timezone.utc),
            "expiresAt": datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        }]
    }})

    # คุกกี้สำหรับ SSE (สำคัญ)
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=jwt_token,
        httponly=True,
        secure=False,          # 👈 dev บน http://localhost ให้ False
        samesite="lax",        # 👈 dev ข้ามพอร์ตบ่อย ใช้ "lax" (ถ้า cross-domain จริงค่อยใช้ "none"+secure=True)
        max_age=int(timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES).total_seconds()),
        path="/",
    )

    # คืนให้ frontend เก็บด้วย (ใช้กับ fetch อื่นๆ)
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

@app.get("/my-stations/detail")
def my_stations_detail(current: UserClaims = Depends(get_current_user)):
    proj = {"_id": 0, "station_id": 1, "station_name": 1}

    if current.role == "admin":
        docs = list(station_collection.find({}, proj))
        return {"stations": docs}

    # non-admin → หา station ที่เป็นของ user นี้ (รองรับทั้ง str และ ObjectId)
    conds = [{"user_id": current.user_id}]
    try:
        conds.append({"user_id": ObjectId(current.user_id)})
    except Exception:
        pass

    docs = list(station_collection.find({"$or": conds}, proj))
    return {"stations": docs}

@app.get("/station/info")
def station_info(
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),   # ดึง claims จาก JWT
):
    # เช็คสิทธิ์ก่อน (ข้อ 5)
    # if station_id not in set(current.station_ids):
    if current.role != "admin" and station_id not in set(current.station_ids):
        raise HTTPException(status_code=403, detail="Forbidden station_id")

    # ดึงข้อมูลจากคอลเลกชัน stations
    doc = station_collection.find_one(
        {"station_id": station_id},
        # เลือก field ที่อยากคืน (ตัด _id ออกเพื่อลด serialize ปัญหา ObjectId)
        {"_id": 0, "station_id": 1, "station_name": 1, "SN": 1, "WO": 1, "PLCFirmware": 1, "PIFirmware": 1, "RTFirmware": 1, "chargeBoxID": 1, "model": 1, "chargeBoxID": 1, "status": 1}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Station not found")

    return {"station": doc}

@app.get("/get_history")
def get_history(
    station_id: str = Query(...),
    start: str = Query(...),
    end: str = Query(...),
    current: UserClaims = Depends(get_current_user),  # ← อ่านสิทธิ์จาก JWT
):
    # ✅ เช็คสิทธิ์ก่อนคิวรีทุกครั้ง
    if station_id not in set(current.station_ids):
        raise HTTPException(status_code=403, detail="Forbidden station_id")


@app.post("/refresh")
async def refresh(refresh_token: str):
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = users_collection.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        token_exists = next((t for t in user.get("refreshTokens", []) if t["token"] == refresh_token), None)
        if not token_exists:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        # <<< ออก access token พร้อม claims ครบถ้วน >>>
        station_ids = user.get("station_id", [])
        if not isinstance(station_ids, list):
            station_ids = [station_ids]

        new_access_token = create_access_token({
            "sub": user["email"],
            "user_id": str(user["_id"]),
            "username": user.get("username"),
            "role": user.get("role", "user"),
            "company": user.get("company"),
            "station_ids": station_ids,
        }, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))

        return {"access_token": new_access_token}
    except ExpiredSignatureError:
        # refresh token หมดอายุ
        raise HTTPException(status_code=401, detail="refresh_token_expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
@app.post("/logout")
async def logout(email: str, refresh_token: str):
    result = users_collection.update_one(
        {"email": email, "refreshTokens.token": refresh_token},
        {"$pull": {"refreshTokens": {"token": refresh_token}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Token not found or already logged out")
    return {"msg": "Logged out successfully"}


app.include_router(pdf_router)


@app.get("/username")
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
    phone: str
    company: str
#create
@app.post("/insert_users/")
async def create_users(users: register):
    # hash password
    hashed_pw = bcrypt.hashpw(users.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    users_collection.insert_one(
    {
        "username" : users.username,
        "email":users.email,
        "password":hashed_pw,
        "phone":users.phone,
        "refreshTokens": [],
        "role":"Technician",
        "company":users.company,
    })

@app.get("/stations/")
async def get_stations(q:str = ""):
    """ค้นหาสถานนี"""
    query = {"station_name":{"$regex":  q, "$options": "i"}} if q else {}
    stations = station_collection.find(query,{"_id":0,"station_name":1})
    return [station["station_name"] for station in stations]

def to_json(doc: dict | None) -> str:
    if not doc:
        return "{}"
    d = dict(doc)
    d.pop("password", None)
    if isinstance(d.get("_id"), ObjectId):
        d["_id"] = str(d["_id"])
    return json.dumps(d, ensure_ascii=False, default=str)

# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")  # ชี้ไป endpoint login
# decode JWT 
    
@app.get("/owner/stations/")
async def get_stations(q: str = "", current: UserClaims = Depends(get_current_user)):
    # current_user คือ str(_id)
    user_obj_id = ObjectId(current.user_id)

    # ดึง station_id ของ user
    user = users_collection.find_one({"_id": user_obj_id}, {"station_id": 1})
    if not user or "station_id" not in user:
        return []

    station_ids = user["station_id"]

    # filter stations ตาม station_id ของ user + query
    query_filter = {"station_id": {"$in": station_ids}}
    if q:
        query_filter["station_name"] = {"$regex": q, "$options": "i"}

    stations = station_collection.find(query_filter, {"_id": 0, "station_name": 1, "station_id": 1})
    return [{"station_name": s["station_name"], "station_id": s["station_id"]} for s in stations]


@app.get("/selected/station/{station_id}")
async def get_station_detail(station_id: str, current: UserClaims = Depends(get_current_user)):
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    # ✅ แปลง _id เป็น string
    station["_id"] = str(station["_id"])

    return station

# @app.get("/selected/station/{station_id}")
# async def get_station_detail(station_id: str, current: UserClaims = Depends(get_current_user)):
#     # (ถ้าจะเช็คสิทธิ์ด้วย เพิ่มเงื่อนไขนี้)
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")

#     station = station_collection.find_one({"station_id": station_id})
#     if not station:
#         raise HTTPException(status_code=404, detail="Station not found")

#     # ✅ แปลงทุกชนิดพิเศษให้ serializable
#     payload = jsonable_encoder(
#         station,
#         custom_encoder={
#             ObjectId: str,
#             Decimal128: lambda d: float(d.to_decimal()),
#             datetime: lambda dt: dt.astimezone(ZoneInfo("Asia/Bangkok")).isoformat()
#         }
#     )
#     return JSONResponse(content=payload)

@app.get("/MDB")
async def mdb_query(request: Request, station_id: str = Query(...), current: UserClaims = Depends(get_current_user)):
    """
    SSE แบบ query param:
    - ส่ง snapshot ล่าสุดทันที (event: init)
    - จากนั้น polling ของใหม่เป็นช่วง ๆ
    """
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    coll = get_mdb_collection_for(station_id)

    async def event_generator():
        last_id = None
        latest = await coll.find_one({}, sort=[("_id", -1)])  # ⬅️ ไม่ต้อง filter station_id ภายในแล้ว
        if latest:
            latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
            last_id = latest.get("_id")
            yield "retry: 3000\n"
            yield "event: init\n"
            yield f"data: {to_json(latest)}\n\n"
        else:
            yield "retry: 3000\n\n"

        while True:
            if await request.is_disconnected():
                break

            doc = await coll.find_one({}, sort=[("_id", -1)])
            if doc and doc.get("_id") != last_id:
                doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                last_id = doc.get("_id")
                yield f"data: {to_json(doc)}\n\n"
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)

@app.get("/MDB/{station_id}")
async def mdb(request: Request, station_id: str, current: UserClaims = Depends(get_current_user)):
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    coll = get_mdb_collection_for(station_id)  # ⬅️ ใช้ coll ตามสถานี

    async def event_generator():
        last_id = None

        latest = await coll.find_one({}, sort=[("_id", -1)])
        if latest:
            latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
            last_id = latest.get("_id")
            yield f"event: init\ndata: {to_json(latest)}\n\n"
        else:
            yield ": keep-alive\n\n"

        while True:
            if await request.is_disconnected():
                break

            doc = await coll.find_one({}, sort=[("_id", -1)])
            if doc and doc.get("_id") != last_id:
                doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                last_id = doc.get("_id")
                yield f"data: {to_json(doc)}\n\n"
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(60)

    return StreamingResponse(event_generator(), headers=headers)

def parse_iso_dt(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail=f"Bad datetime: {s}")


# @app.get("/MDB/history")
# async def stream_history(
#     station_id: str = Query(..., description="ID ของ turbine/station"),
#     start: str = Query(..., description="วันที่เริ่มต้นในรูปแบบ ISO string"),
#     end: str = Query(..., description="วันที่สิ้นสุดในรูปแบบ ISO string")
# ):
#     print(f"Querying station_id={station_id} from {start} to {end}")

#     query = {
#         "station_id": station_id,
#         "Datetime": {"$gte": start, "$lte": end}
#     }

#     projection = {
#         "_id": 1,
#         "station_id": 1,
#         "VL1N": 1,
#         "VL2N": 1,
#         "VL3N": 1,
#         "I1": 1,
#         "I2": 1,
#         "I3": 1,
#         "PL1N": 1,
#         "PL2N": 1,
#         "PL3N": 1,
#         "Datetime": 1
#     }

#     cursor = MDB_collection.find(query, projection).sort("Datetime", 1)

#     async def event_generator():
#         try:
#             async for doc in cursor:   # iterate ทีละ record จาก Mongo
#                 doc["_id"] = str(doc["_id"])
#                 # ส่งเป็น SSE format → ต้องขึ้นต้นด้วย "data:" และจบด้วย \n\n
#                 yield f"data: {json.dumps(doc)}\n\n"
#                 await asyncio.sleep(0.01)  # กัน browser ค้าง (ปรับตามจริง)
#         except Exception as e:
#             print("Error in SSE generator:", e)
#             yield f"event: error\ndata: {str(e)}\n\n"

#     return StreamingResponse(event_generator(), media_type="text/event-stream")

def _coerce_date_range(start: str, end: str) -> tuple[str, str]:
    # รับได้ทั้ง "YYYY-MM-DD" และ ISO ครบเวลา
    try:
        def _norm(s: str, end: bool=False) -> str:
            if "T" in s:
                # เป็น ISO อยู่แล้ว
                dt = parse_iso_dt(s)  # ใช้ helper ด้านบน
            else:
                # เป็นแค่วัน -> เติมเวลา
                if end:
                    dt = datetime.fromisoformat(f"{s}T23:59:59.999+00:00")
                else:
                    dt = datetime.fromisoformat(f"{s}T00:00:00+00:00")
            return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        return _norm(start, end=False), _norm(end, end=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad date range")

@app.get("/MDB/history")
async def stream_history(
    request: Request,
    station_id: str = Query(..., description="ID ของ turbine/station"),
    start: str = Query(..., description="เริ่ม (YYYY-MM-DD หรือ ISO)"),
    end: str = Query(..., description="สิ้นสุด (YYYY-MM-DD หรือ ISO)"),
):
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    start_iso, end_iso = _coerce_date_range(start, end)
    coll = get_mdb_collection_for(station_id)   # ⬅️ ใช้ coll ตามสถานี

    query = {"timestamp": {"$gte": start_iso, "$lte": end_iso}}
    projection = {
        "_id": 1, "station_id": 1, "timestamp": 1,
        "VL1N": 1, "VL2N": 1, "VL3N": 1,
        "I1": 1, "I2": 1, "I3": 1,
        "PL1N": 1, "PL2N": 1, "PL3N": 1,
    }

    cursor = coll.find(query, projection).sort("timestamp", 1)

    async def event_generator():
        try:
            yield "retry: 3000\n\n"
            sent_any = False
            # async for doc in cursor:
            #     doc["_id"] = str(doc["_id"])
            #     yield f"data: {json.dumps(doc)}\n\n"
            #     sent_any = True
            #     await asyncio.sleep(0.001)
            async for doc in cursor:
                doc["_id"] = str(doc["_id"])
                if "timestamp" in doc:
                    doc["timestamp"] = _ensure_utc_iso(doc["timestamp"])
                yield f"data: {json.dumps(doc)}\n\n"
                sent_any = True
                await asyncio.sleep(0.001)
            if not sent_any:
                yield ": keep-alive\n\n"
        except Exception as e:
            yield f"event: error\ndata: {str(e)}\n\n"

    return StreamingResponse(event_generator(), headers=headers)

def to_float(x, default=0.0):
    try:
        if x is None:
            return default
        if isinstance(x, (int, float)):
            return float(x)
        if isinstance(x, Decimal128):
            return float(x.to_decimal())
        s = str(x).strip().replace(",", ".")
        return float(s)
    except Exception:
        return default

async def change_stream_generator(station_id: str):
    coll = get_mdb_collection_for(station_id)
    async with coll.watch() as cs:
        async for change in cs:
            doc = change.get("fullDocument")
            if not doc:
                continue
            payload = {
                "t": _ensure_utc_iso(doc.get("timestamp")),
                "L1": doc.get("VL1N"),
                "L2": doc.get("VL2N"),
                "L3": doc.get("VL3N"),
                "I1": doc.get("I1"),
                "I2": doc.get("I2"),
                "I3": doc.get("I3"),
                "W1": doc.get("PL1N"),
                "W2": doc.get("PL2N"),
                "W3": doc.get("PL3N"),
            }
            yield f"data: {json.dumps(payload)}\n\n"



def floor_bin(dt: datetime, step_sec: int) -> datetime:
    epoch_ms = int(dt.timestamp() * 1000)
    bin_ms = epoch_ms - (epoch_ms % (step_sec * 1000))
    return datetime.fromtimestamp(bin_ms / 1000, tz=timezone.utc)

# def to_json(doc):
#     doc = dict(doc)
#     doc["_id"] = str(doc["_id"])
#     return json.dumps(doc, default=str)

################ Users
@app.get("/all-users/")
def all_users():
    # เอาทุกฟิลด์ ยกเว้น password และ refreshTokens
    cursor = users_collection.find({}, {"password": 0, "refreshTokens": 0})
    docs = list(cursor)

    # ถ้าจะส่ง _id ไปด้วย ต้องแปลง ObjectId -> str
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

class UserOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    role: str
    company: str
    station_id: List[str] = Field(default_factory=list)
    tel: str
    # payment: Optional[bool] = None

@app.post("/add_users/", response_model=UserOut, status_code=201)
def insert_users(body: addUsers):
    email = body.email.lower()
    hashed = bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    # station_id -> list[str]
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
        # "company": (body.company_name or body.company or "").strip() or None,
        "company": (body.company_name or "").strip() or None,
        "tel": (body.tel or "").strip() or None,
        # "payment": (body.payment.lower() == "y"),
        "station_id": station_ids,
        "refreshTokens": [],
        "createdAt": datetime.now(timezone.utc),
        
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
        # "payment": doc.get("payment"),
        "createdAt": doc["createdAt"],
    }

@app.delete("/delete_users/{user_id}", status_code=204)
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

def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# ฟิลด์ที่อนุญาต
ALLOW_FIELDS_ADMIN_USER = {"username", "email", "tel", "company", "role", "is_active", "password"}
ALLOW_FIELDS_SELF_USER  = {"username", "email", "tel", "company", "password"}


# ===== Endpoint =====
@app.patch("/user_update/{id}", response_model=UserOut)
def update_user(id: str, body: UserUpdate, current: UserClaims = Depends(get_current_user)):
    oid = to_object_id_or_400(id)

    doc = users_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="user not found")

    if current.role != "admin" and current.user_id != str(oid):
        raise HTTPException(status_code=403, detail="forbidden")

    incoming = {
        k: (v.strip() if isinstance(v, str) else v)
        for k, v in body.model_dump(exclude_none=True).items()
    }
    if not incoming:
        raise HTTPException(status_code=400, detail="no fields to update")

    allowed = ALLOW_FIELDS_ADMIN_USER if current.role == "admin" else ALLOW_FIELDS_SELF_USER
    payload = {k: v for k, v in incoming.items() if k in allowed}
    if not payload:
        raise HTTPException(status_code=400, detail="no permitted fields to update")

    if "password" in payload:
        payload["password"] = hash_password(payload["password"])

    if "is_active" in payload and not isinstance(payload["is_active"], bool):
        raise HTTPException(status_code=400, detail="is_active must be boolean")

    now = datetime.now(timezone.utc)
    payload["updatedAt"] = now

    try:
        users_collection.update_one({"_id": oid}, {"$set": payload})
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="duplicate email or username")

    newdoc = users_collection.find_one({"_id": oid}) or {}
    created_at = newdoc.get("createdAt") or now
    if "createdAt" not in newdoc:
        users_collection.update_one({"_id": oid}, {"$set": {"createdAt": created_at}})

    # ✅ ใช้ tel ไม่ใช่ phone
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


def parse_iso_utc(s: str) -> Optional[datetime]:
    try:
        # "2025-09-29T16:19:54.659Z"
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None

def latest_onoff(station_id: str) -> Dict[str, Any]:
    """
    อ่านเอกสารล่าสุดจาก stationsOnOff/<station_id>
    โครงสร้าง doc:
      { payload: { value: 0/1, timestamp: "ISO-UTC" }, ... }
    """
    coll = stationOnOff.get_collection(station_id)
    doc = coll.find_one(
        sort=[("payload.timestamp", -1), ("_id", -1)]
    )
    if not doc:
        return {"status": None, "statusAt": None}

    payload = doc.get("payload", {})
    val = payload.get("value", None)
    ts = payload.get("timestamp", None)

    # แปลงเป็น bool ชัดเจน: 1/true => True, 0/false => False, อื่นๆ -> None
    if isinstance(val, (int, bool)):
        status = bool(val)
    else:
        try:
            status = bool(int(val))
        except Exception:
            status = None

    status_at = parse_iso_utc(ts) if isinstance(ts, str) else None
    return {"status": status, "statusAt": status_at}

@app.get("/all-stations/")
def all_stations(current: UserClaims = Depends(get_current_user)):
    # 1) สร้างเงื่อนไข match ตาม role
    if current.role == "admin":
        match_query = {}
    else:
        if not current.user_id:
            raise HTTPException(status_code=401, detail="Missing uid in token")
        # รองรับทั้งกรณีเก็บ user_id เป็น string หรือ ObjectId
        conds = [{"user_id": current.user_id}]
        try:
            conds.append({"user_id": ObjectId(current.user_id)})
        except Exception:
            pass
        match_query = {"$or": conds}

    pipeline = [
        {"$match": match_query},

        # 2) แปลง user_id -> ObjectId ถ้าเป็น string (เพื่อ lookup)
        {"$addFields": {
            "user_obj_id": {
                "$cond": [
                    {"$eq": [{"$type": "$user_id"}, "string"]},
                    {"$toObjectId": "$user_id"},
                    "$user_id"  # ถ้าเป็น ObjectId อยู่แล้ว ให้ใช้เดิม
                ]
            }
        }},

        # 3) ดึง username (และฟิลด์อื่นๆจาก users) ด้วย $lookup
        {"$lookup": {
            "from": "users",              # ชื่อ collection ของ user
            "localField": "user_obj_id",  # _id ใน users เป็น ObjectId
            "foreignField": "_id",
            "as": "owner"
        }},
        {"$addFields": {
            "username": {"$arrayElemAt": ["$owner.username", 0]},
            # เพิ่มได้ถ้าต้องการ เช่น email/phone/company
            # "owner_email": {"$arrayElemAt": ["$owner.email", 0]},
        }},

        # 4) ไม่ต้องส่ง array owner กับฟิลด์ช่วยแปลงออกไป
        {"$project": {"owner": 0, "user_obj_id": 0}},
    ]

    docs = list(station_collection.aggregate(pipeline))

    # ★ เติมสถานะล่าสุดแบบเรียลไทม์ต่อสถานี
    for d in docs:
        sid = d.get("station_id")
        try:
            last = latest_onoff(str(sid))
        except Exception:
            last = {"status": None, "statusAt": None}
        d["status"] = last["status"]          # true/false/None
        d["statusAt"] = last["statusAt"]      # datetime | None

    docs = jsonable_encoder(docs, custom_encoder={ObjectId: str})
    for d in docs:
        if "_id" in d:
            d["_id"] = str(d["_id"])
    return {"stations": docs}

class addStations(BaseModel):
    station_id:str
    station_name:str
    brand:str
    model:str
    SN:str
    WO:str 
    PLCFirmware:str 
    PIFirmware:str 
    RTFirmware:str
    chargeBoxID: str 
    user_id: Optional[str] = None  
    owner: Optional[str] = None
    is_active:Optional[bool] = None

class StationOut(BaseModel):
    id: str
    station_id:str
    station_name:str
    brand:str
    model:str
    SN:str
    WO:str 
    PLCFirmware:str 
    PIFirmware:str 
    RTFirmware:str 
    chargeBoxID:str
    user_id: str 
    username: Optional[str] = None
    is_active:  Optional[bool] = None
    createdAt: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.astimezone(ZoneInfo("Asia/Bangkok")).isoformat()
        }


@app.post("/add_stations/", response_model=StationOut, status_code=201)
def insert_stations(
    body: addStations,
    current: UserClaims = Depends(get_current_user)
):
    # 1) ตัด/ทำความสะอาด string fields
    station_id   = body.station_id.strip()
    station_name = body.station_name.strip()
    brand        = body.brand.strip()
    model        = body.model.strip()
    SN           = body.SN.strip()
    WO           = body.WO.strip()
    PLCFirmware           = body.PLCFirmware.strip()
    PIFirmware           = body.PIFirmware.strip()
    RTFirmware           = body.RTFirmware.strip()
    chargeBoxID           = body.chargeBoxID.strip()

    # (ถ้าต้องการบังคับรูปแบบ station_id)
    # if not re.fullmatch(r"[A-Za-z0-9_]+", station_id):
    #     raise HTTPException(status_code=422, detail="station_id must be [A-Za-z0-9_]")

    # 2) ตัดสินใจ owner เหมือนแนวคิดของ update:
    #    - admin: อนุญาตส่ง user_id (24hex) หรือ owner(username) มากำหนดเจ้าของ
    #             ถ้าไม่ส่งเลย จะ fallback เป็น current.user_id
    #    - non-admin: บังคับเป็น current.user_id (ห้ามสวมสิทธิ์)
    if current.role == "admin":
        owner_oid = None
        if body.user_id:
            owner_oid = to_object_id_or_400(body.user_id)
        elif body.owner:
            u = users_collection.find_one({"username": body.owner.strip()}, {"_id": 1})
            if not u:
                raise HTTPException(status_code=400, detail="invalid owner username")
            owner_oid = u["_id"]
        else:
            if not current.user_id:
                raise HTTPException(status_code=401, detail="Missing uid in token")
            owner_oid = to_object_id_or_400(current.user_id)
    else:
        if not current.user_id:
            raise HTTPException(status_code=401, detail="Missing uid in token")
        owner_oid = to_object_id_or_400(current.user_id)

    # 3) is_active เป็น boolean ชัดเจน
    is_active = True if body.is_active is None else bool(body.is_active)

    # 4) สร้างเอกสาร (เก็บเป็น UTC และเก็บ user_id เป็น ObjectId เหมือนใน PATCH)
    doc: Dict[str, Any] = {
        "station_id": station_id,
        "station_name": station_name,
        "brand": brand,
        "model": model,
        "SN": SN,
        "WO": WO,
        "PLCFirmware": PLCFirmware,
        "PIFirmware": PIFirmware,
        "RTFirmware": RTFirmware,
        "chargeBoxID": chargeBoxID,
        "user_id": owner_oid,                 # ObjectId ใน DB
        "is_active": is_active,
        "createdAt": datetime.now(timezone.utc),
    }

    # 5) insert + จัดการ duplicate key ของ station_id
    try:
        res = station_collection.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="station_id already exists")

    # 6) หา username เพื่อส่งกลับ (เหมือนสิ่งที่คุณอยากได้ใน table)
    owner_doc = users_collection.find_one({"_id": owner_oid}, {"username": 1})
    owner_username = owner_doc.get("username") if owner_doc else None

    # 7) ส่งกลับรูปแบบเดียวกับ PATCH: user_id เป็น string, แถม username
    return {
        "id": str(res.inserted_id),
        "station_id": doc["station_id"],
        "station_name": doc["station_name"],
        "brand": doc["brand"],
        "model": doc["model"],
        "SN": doc["SN"],
        "WO": doc["WO"],
        "PLCFirmware": doc["PLCFirmware"],
        "PIFirmware": doc["PIFirmware"],
        "RTFirmware": doc["RTFirmware"],
        "chargeBoxID": doc["chargeBoxID"],
        "user_id": str(doc["user_id"]),       # string สำหรับ client
        "username": owner_username,           # ส่งกลับให้ table โชว์ได้เลย
        "is_active": doc["is_active"],
        "createdAt": doc["createdAt"],
        # "updatedAt": None,  # จะใส่ก็ได้ถ้าอยากให้ schemaเหมือน PATCH เป๊ะ
    }


@app.delete("/delete_stations/{id}", status_code=204)
def delete_station(id: str, current: UserClaims = Depends(get_current_user)):
    if current.role not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    res = station_collection.delete_one({"_id":  oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Station not found")
    return Response(status_code=204)

class StationUpdate(BaseModel):
    station_name: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    SN: Optional[str] = None
    WO: Optional[str] = None
    PLCFirmware: Optional[str] = None
    PIFirmware: Optional[str] = None
    RTFirmware: Optional[str] = None
    chargeBoxID: Optional[str] = None
    # status: Optional[bool] = None
    is_active: Optional[bool] = None
    user_id: str | None = None 


ALLOW_FIELDS_ADMIN = {"station_id", "station_name", "brand", "model", "SN", "WO", "PLCFirmware", "PIFirmware", "RTFirmware", "chargeBoxID", "status","is_active", "user_id"}
# ALLOW_FIELDS_NONADMIN = {"status"}

def to_object_id_or_400(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid user_id")


@app.patch("/update_stations/{id}", response_model=StationOut)
def update_station(
    id: str,
    body: StationUpdate,
    current: UserClaims = Depends(get_current_user)
):
    # ตรวจ id สถานี
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid id")

    # หา station
    st = station_collection.find_one({"_id": oid})
    if not st:
        raise HTTPException(status_code=404, detail="station not found")

    # สิทธิ์: non-admin ต้องเป็น owner เท่านั้น
    if current.role != "admin":
        st_owner = st.get("user_id")  # อาจเป็น ObjectId
        st_owner_str = str(st_owner) if st_owner is not None else None
        if not current.user_id or current.user_id != st_owner_str:
            raise HTTPException(status_code=403, detail="forbidden")

    # เตรียมข้อมูลเข้า
    incoming: Dict[str, Any] = {
        k: (v.strip() if isinstance(v, str) else v)
        for k, v in body.model_dump(exclude_none=True).items()
    }
    if not incoming:
        raise HTTPException(status_code=400, detail="no fields to update")

    # ทำ allowlist + map owner (เฉพาะ admin)
    if current.role == "admin":
        payload = {k: v for k, v in incoming.items() if k in ALLOW_FIELDS_ADMIN}

        # ถ้า admin ส่ง user_id มา → แปลงเป็น ObjectId และ validate
        if "user_id" in payload:
            user_id_raw = payload["user_id"]

            # รองรับสองแบบ: ส่งมาเป็น id (24hex) หรือส่งมาเป็น username
            udoc = None
            if isinstance(user_id_raw, str) and len(user_id_raw) == 24:
                # น่าจะเป็น ObjectId string
                udoc = users_collection.find_one({"_id": to_object_id_or_400(user_id_raw)})
            else:
                # เผื่อกรณีหน้าบ้านส่ง username มา (ไม่แนะนำ แต่กันไว้)
                udoc = users_collection.find_one({"username": user_id_raw})

            if not udoc:
                raise HTTPException(status_code=400, detail="invalid user_id")

            # ✅ เก็บเป็น ObjectId ใน DB
            payload["user_id"] = udoc["_id"]
    

    if "is_active" in payload and not isinstance(payload["is_active"], bool):
        raise HTTPException(status_code=400, detail="is_active must be boolean")

    # สร้างคำสั่ง update
    update_doc: Dict[str, Any] = {"$set": payload}

    # ถ้าต้องการ “ลบ” ฟิลด์ username เดิมออกจาก stations (ให้เหลือเฉพาะ user_id)
    # ให้เพิ่มบรรทัดนี้ (ปลอดภัย ใส่ได้ตลอด):
    update_doc["$unset"] = {"username": ""}

    # อัปเดต
    res = station_collection.update_one({"_id": oid}, update_doc)
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="station not found")

    # อ่านคืน
    doc = station_collection.find_one({"_id": oid})
    created_at = doc.get("createdAt")
    if created_at is None:
        created_at = datetime.now(timezone.utc)   # 👈 กันค่า None
    return {
        "id": str(doc["_id"]),
        "station_id": doc.get("station_id", ""),
        "station_name": doc.get("station_name", ""),
        "brand": doc.get("brand", ""),
        "model": doc.get("model", ""),
        "SN": doc.get("SN", ""),
        "WO": doc.get("WO", ""),
        "PLCFirmware": doc.get("PLCFirmware", ""),
        "PIFirmware": doc.get("PIFirmware", ""),
        "RTFirmware": doc.get("RTFirmware", ""),
        "chargeBoxID": doc.get("chargeBoxID", ""),
        "createdAt": created_at,  
        # ส่งกลับเป็น string เพื่อให้ฝั่ง client ใช้ง่าย
        "user_id": str(doc["user_id"]) if doc.get("user_id") else "",
        "username": doc.get("username"),
        "is_active": bool(doc.get("is_active", False)),
        "updatedAt": datetime.now(timezone.utc)
    }

@app.get("/owners")
async def get_owners():
    cursor = users_collection.find({"role": "owner"}, {"_id": 1, "username": 1})
    owners = [{"user_id": str(u["_id"]), "username": u["username"]} for u in cursor]

    if not owners:
        raise HTTPException(status_code=404, detail="owners not found")

    return {"owners": owners}

stationOnOff = client1["stationsOnOff"]
class StationIdsIn(BaseModel):
    station_ids: List[str]

def _latest_onoff_bool(sid: str) -> bool:
    coll = stationOnOff.get_collection(str(sid))
    doc = coll.find_one(sort=[("payload.timestamp", -1), ("_id", -1)])  # ← เอาเอกสารล่าสุดจริง ๆ
    if not doc:
        return False
    payload = doc.get("payload", {})
    val = payload.get("value", 0)
    # map เป็น bool ให้ชัด
    if isinstance(val, bool):
        return val
    try:
        return bool(int(val))
    except Exception:
        return False

@app.post("/station-onoff/bulk")
def get_station_onoff_bulk(body: StationIdsIn):
    out: Dict[str, bool] = {}
    for sid in body.station_ids:
        try:
            out[sid] = _latest_onoff_bool(sid)
        except Exception:
            out[sid] = False
    return {"status": out}

@app.get("/station-onoff/{station_id}")
def station_onoff_latest(station_id: str, current: UserClaims = Depends(get_current_user)):
    if current.role != "admin" and station_id not in set(current.station_ids):
        raise HTTPException(status_code=403, detail="Forbidden station_id")

    data = latest_onoff(str(station_id))
    status_at_iso = (
        data["statusAt"].astimezone(ZoneInfo("Asia/Bangkok")).isoformat()
        if data["statusAt"] else None
    )
    return {"station_id": station_id, "status": data["status"], "statusAt": status_at_iso}

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
        
def get_pmreport_collection_for(station_id: str):
    # กันชื่อแปลก ๆ
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    return PMReportDB.get_collection(str(station_id))

# async def _pmreport_latest_core(station_id: str, current: UserClaims):
#     if current.role != "admin" and station_id not in set(current.station_ids):
#         raise HTTPException(status_code=403, detail="Forbidden station_id")

#     coll = get_pmreport_collection_for(station_id)
#     pipeline = [
#         {"$addFields": {
#             "_ts": {
#                 "$ifNull": [
#                     {
#                         "$cond": [
#                             {"$eq": [{"$type": "$timestamp"}, "string"]},
#                             {"$dateFromString": {
#                                 "dateString": "$timestamp",
#                                 "timezone": "UTC",
#                                 "onError": None,
#                                 "onNull": None
#                             }},
#                             "$timestamp"
#                         ]
#                     },
#                     {"$toDate": "$_id"}
#                 ]
#             }
#         }},
#         {"$sort": {"_ts": -1, "_id": -1}},
#         {"$limit": 1},
#         {"$project": {"_id": 1, "pi_firmware": 1, "plc_firmware": 1, "rt_firmware": 1, "pm_date": 1, "timestamp": 1}}
#     ]
#     cursor = coll.aggregate(pipeline)
#     docs = await cursor.to_list(length=1)
#     if not docs:
#         raise HTTPException(status_code=404, detail="PMReport not found")

#     doc = docs[0]

#     ts_raw = doc.get("timestamp")
#     ts_dt = (parse_iso_any_tz(ts_raw) if isinstance(ts_raw, str)
#              else (ts_raw if isinstance(ts_raw, datetime) else None))
#     ts_utc = ts_dt.astimezone(ZoneInfo("UTC")).isoformat() if ts_dt else None
#     ts_th  = ts_dt.astimezone(ZoneInfo("Asia/Bangkok")).isoformat() if ts_dt else None

#     return {
#         "_id": str(doc["_id"]),
#         "pi_firmware": doc.get("pi_firmware"),
#         "plc_firmware": doc.get("plc_firmware"),
#         "rt_firmware": doc.get("rt_firmware"),
#         "pm_date": doc.get("pm_date"),
#         "timestamp": ts_raw,      # raw ใน DB
#         "timestamp_utc": ts_utc,  # แปลงแล้ว
#         "timestamp_th": ts_th,    # แปลงแล้ว
#     }

def _compute_next_pm_date_str(pm_date_str: str | None) -> str | None:
    if not pm_date_str:
        return None
    # pm_date เก็บเป็น "YYYY-MM-DD"
    try:
        d = datetime.fromisoformat(pm_date_str).date()  # date object
    except ValueError:
        return None
    next_d = d + relativedelta(months=+6)              # ← ตรง 6 เดือน
    return next_d.isoformat()     

def _pick_latest_from_pm_reports(pm_reports: list[dict] | None):
    """เลือกอันล่าสุดจาก array pm_reports โดยดู timestamp (string/datetime)"""
    if not pm_reports:
        return None

    def _to_dt(x):
        ts = x.get("timestamp")
        if isinstance(ts, str):
            try:
                return parse_iso_any_tz(ts)
            except Exception:
                return None
        if isinstance(ts, datetime):
            return ts
        return None

    pm_reports_sorted = sorted(
        pm_reports,
        key=lambda r: (_to_dt(r) or datetime.min.replace(tzinfo=ZoneInfo("UTC")))
    )
    return pm_reports_sorted[-1] if pm_reports_sorted else None


# async def _pmreport_latest_core(station_id: str, current: UserClaims):
#     # --- auth เดิม ---
#     if current.role != "admin" and station_id not in set(current.station_ids):
#         raise HTTPException(status_code=403, detail="Forbidden station_id")
#     if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
#         raise HTTPException(status_code=400, detail="Bad station_id")

#     # --- ดึงจากคอลเลกชัน stations ---
#     # ลองหาโดย station_id (ถ้าของคุณบางเคสเก็บ _id เป็น station_id ก็เสริม OR ได้)
#     st = station_collection.find_one(
#         {"station_id": station_id},
#         {
#             "_id": 1,
#             # top-level firmwares ที่มีในสคีมาของคุณ
#             "PIFirmware": 1,
#             "PLCFirmware": 1,
#             "RTFirmware": 1,
#             # "pm_date": 1,
#             "timestamp": 1,     # ถ้ามี
#             "updatedAt": 1,     # fallback เวลา
#             # ถ้าคุณเก็บประวัติ PM เป็น array
#             "pm_reports": 1,    # [{ pi_firmware, plc_firmware, rt_firmware, pm_date, timestamp }, ...]
#         }
#     )
#     if not st:
#         raise HTTPException(status_code=404, detail="Station not found")

#     latest = _pick_latest_from_pm_reports(st.get("pm_reports"))
#     src = latest or st

#     # map ค่า firmware: รองรับทั้งชื่อฟิลด์แบบ pm_report (snake) และ stations (Camel/Pascal)
#     pi_fw  = src.get("pi_firmware")  or src.get("PIFirmware")
#     plc_fw = src.get("plc_firmware") or src.get("PLCFirmware")
#     rt_fw  = src.get("rt_firmware")  or src.get("RTFirmware")
#     # pm_date = src.get("pm_date")

#     # เวลา: ใช้ของ src ก่อน ถ้าไม่มีค่อย fallback ไปที่ doc สถานี
#     ts_raw = src.get("timestamp") or st.get("timestamp") or st.get("updatedAt")

#     ts_dt = (parse_iso_any_tz(ts_raw) if isinstance(ts_raw, str)
#              else (ts_raw if isinstance(ts_raw, datetime) else None))
#     ts_utc = ts_dt.astimezone(ZoneInfo("UTC")).isoformat() if ts_dt else None
#     ts_th  = ts_dt.astimezone(ZoneInfo("Asia/Bangkok")).isoformat() if ts_dt else None

#     return {
#         "_id": str(st["_id"]),
#         "pi_firmware": pi_fw,
#         "plc_firmware": plc_fw,
#         "rt_firmware": rt_fw,
#         # "pm_date": pm_date,
#         "timestamp": ts_raw,      # raw จาก stations/pm_reports
#         "timestamp_utc": ts_utc,  # แปลงแล้ว
#         "timestamp_th": ts_th,    # แปลงแล้ว
#         "source": "stations.pm_reports" if latest else "stations",  # เผื่อ debug
#     }

async def _pmreport_latest_core(station_id: str, current: UserClaims):
    # --- auth & validate ---
    if current.role != "admin" and station_id not in set(current.station_ids):
        raise HTTPException(status_code=403, detail="Forbidden station_id")
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")

    # 1) ดึงจาก stations
    st = station_collection.find_one(
        {"station_id": station_id},
        {"_id": 1, "PIFirmware": 1, "PLCFirmware": 1, "RTFirmware": 1, "timestamp": 1, "updatedAt": 1}
    )
    if not st:
        raise HTTPException(status_code=404, detail="Station not found")

    pi_fw  = st.get("PIFirmware")
    plc_fw = st.get("PLCFirmware")
    rt_fw  = st.get("RTFirmware")

    # 2) ดึง pm_date ล่าสุดจาก PMReportDB
    pm_latest = await _latest_pm_date_from_pmreport(station_id)
    pm_date = pm_latest.get("pm_date") if pm_latest else None

    # เวลา: ใช้ timestamp จาก pm report ถ้ามี ไม่งั้น fallback ไปของสถานี
    ts_raw = (pm_latest.get("timestamp") if pm_latest else None) or st.get("timestamp") or st.get("updatedAt")

    ts_dt = (parse_iso_any_tz(ts_raw) if isinstance(ts_raw, str)
             else (ts_raw if isinstance(ts_raw, datetime) else None))
    ts_utc = ts_dt.astimezone(ZoneInfo("UTC")).isoformat() if ts_dt else None
    ts_th  = ts_dt.astimezone(ZoneInfo("Asia/Bangkok")).isoformat() if ts_dt else None

    pm_next_date = _compute_next_pm_date_str(pm_date)

    return {
        "_id": str(st["_id"]),
        "pi_firmware": pi_fw,
        "plc_firmware": plc_fw,
        "rt_firmware": rt_fw,
        "pm_date": pm_date,              # ← มาจาก PMReportDB
        "pm_next_date": pm_next_date, 
        "timestamp": ts_raw,             # pmreport.timestamp ถ้ามี
        "timestamp_utc": ts_utc,
        "timestamp_th": ts_th,
        "source": "stations + PMReportDB",  # เผื่อ debug
    }

# --- helper: เอา pm_date ล่าสุดจาก PMReportDB/<station_id> ---
async def _latest_pm_date_from_pmreport(station_id: str) -> dict | None:
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    coll = PMReportDB.get_collection(str(station_id))

    pipeline = [
        {"$addFields": {
            "_ts": {
                "$ifNull": [
                    {
                        "$cond": [
                            {"$eq": [{"$type": "$timestamp"}, "string"]},
                            {"$dateFromString": {
                                "dateString": "$timestamp",
                                "timezone": "UTC",
                                "onError": None,
                                "onNull": None
                            }},
                            "$timestamp"
                        ]
                    },
                    {"$toDate": "$_id"}
                ]
            }
        }},
        {"$sort": {"_ts": -1, "_id": -1}},
        {"$limit": 1},
        {"$project": {"_id": 1, "pm_date": 1, "timestamp": 1}}
    ]

    cursor = coll.aggregate(pipeline)
    docs = await cursor.to_list(length=1)
    return docs[0] if docs else None

# เดิม (path param) → เปลี่ยนให้เรียก helper
@app.get("/pmreport/latest/{station_id}")
async def pmreport_latest(station_id: str, current: UserClaims = Depends(get_current_user)):
    return await _pmreport_latest_core(station_id, current)

# ใหม่ (query param) → ให้รองรับรูปแบบ /pmreport/latest/?station_id=...
@app.get("/pmreport/latest/")
async def pmreport_latest_q(
    station_id: str = Query(..., description="เช่น Klongluang3"),
    current: UserClaims = Depends(get_current_user),
):
    return await _pmreport_latest_core(station_id, current)

# device page
def get_device_collection_for(station_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    return deviceDB.get_collection(str(station_id))

# (เลือกได้) สร้างดัชนีแบบ lazy ต่อสถานีที่ถูกเรียกใช้
async def _ensure_util_index(coll):
    try:
        await coll.create_index([("timestamp", -1), ("_id", -1)])
    except Exception:
        pass

@app.get("/utilization/stream")
async def utilization_stream(request: Request, station_id: str = Query(...), current: UserClaims = Depends(get_current_user)):
    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")

    coll = get_device_collection_for(station_id)
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    async def event_generator():
        # ส่ง snapshot ล่าสุดก่อน
        latest = await coll.find_one({}, sort=[("timestamp", -1), ("_id", -1)])
        if latest:
            latest["_id"] = str(latest["_id"])
            latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
            yield f"event: init\ndata: {json.dumps(latest)}\n\n"

        # ต่อด้วย change stream (ต้องเป็น replica set / Atlas tier ที่รองรับ)
        try:
            async with coll.watch(full_document='updateLookup') as stream:
                async for change in stream:
                    if await request.is_disconnected():
                        break
                    doc = change.get("fullDocument")
                    if not doc:
                        continue
                    doc["_id"] = str(doc["_id"])
                    doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                    yield f"data: {json.dumps(doc)}\n\n"
        except Exception:
            # fallback: ถ้าใช้ไม่ได้ (เช่น standalone) ให้ polling
            last_id = latest.get("_id") if latest else None
            while not await request.is_disconnected():
                doc = await coll.find_one({}, sort=[("timestamp", -1), ("_id", -1)])
                if doc and str(doc["_id"]) != str(last_id):
                    last_id = str(doc["_id"])
                    doc["_id"] = last_id
                    doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                    yield f"data: {json.dumps(doc)}\n\n"
                else:
                    yield ": keep-alive\n\n"
                await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)

# device page
def get_setting_collection_for(station_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    return settingDB.get_collection(str(station_id))

# (เลือกได้) สร้างดัชนีแบบ lazy ต่อสถานีที่ถูกเรียกใช้
async def _ensure_util_index(coll):
    try:
        await coll.create_index([("timestamp", -1), ("_id", -1)])
    except Exception:
        pass

@app.get("/setting/stream")
async def setting_stream(request: Request, station_id: str = Query(...), current: UserClaims = Depends(get_current_user)):
    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")

    coll = get_setting_collection_for(station_id)
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    async def event_generator():
        # ส่ง snapshot ล่าสุดก่อน
        latest = await coll.find_one({}, sort=[("timestamp", -1), ("_id", -1)])
        if latest:
            latest["_id"] = str(latest["_id"])
            latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
            yield f"event: init\ndata: {json.dumps(latest)}\n\n"

        # ต่อด้วย change stream (ต้องเป็น replica set / Atlas tier ที่รองรับ)
        try:
            async with coll.watch(full_document='updateLookup') as stream:
                async for change in stream:
                    if await request.is_disconnected():
                        break
                    doc = change.get("fullDocument")
                    if not doc:
                        continue
                    doc["_id"] = str(doc["_id"])
                    doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                    yield f"data: {json.dumps(doc)}\n\n"
        except Exception:
            # fallback: ถ้าใช้ไม่ได้ (เช่น standalone) ให้ polling
            last_id = latest.get("_id") if latest else None
            while not await request.is_disconnected():
                doc = await coll.find_one({}, sort=[("timestamp", -1), ("_id", -1)])
                if doc and str(doc["_id"]) != str(last_id):
                    last_id = str(doc["_id"])
                    doc["_id"] = last_id
                    doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                    yield f"data: {json.dumps(doc)}\n\n"
                else:
                    yield ": keep-alive\n\n"
                await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)

@app.get("/setting")
async def setting_query(request: Request, station_id: str = Query(...), current: UserClaims = Depends(get_current_user)):
    """
    SSE แบบ query param:
    - ส่ง snapshot ล่าสุดทันที (event: init)
    - จากนั้น polling ของใหม่เป็นช่วง ๆ
    """
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    coll = get_setting_collection_for(station_id)

    async def event_generator():
        last_id = None
        latest = await coll.find_one({}, sort=[("_id", -1)])  # ⬅️ ไม่ต้อง filter station_id ภายในแล้ว
        if latest:
            latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
            last_id = latest.get("_id")
            yield "retry: 3000\n"
            yield "event: init\n"
            yield f"data: {to_json(latest)}\n\n"
        else:
            yield "retry: 3000\n\n"

        while True:
            if await request.is_disconnected():
                break

            doc = await coll.find_one({}, sort=[("_id", -1)])
            if doc and doc.get("_id") != last_id:
                doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                last_id = doc.get("_id")
                yield f"data: {to_json(doc)}\n\n"
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)

