"use client"
from zoneinfo import ZoneInfo
from fastapi import FastAPI,HTTPException,Depends, status,Request,Query,APIRouter, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder 
from fastapi.security import OAuth2PasswordRequestForm,OAuth2PasswordBearer
from jose import JWTError,jwt
from jose.exceptions import ExpiredSignatureError
from datetime import datetime, timedelta, UTC, timezone, time, date
from pymongo.errors import OperationFailure, PyMongoError,DuplicateKeyError
from pymongo import MongoClient,ReturnDocument
from pydantic import BaseModel,EmailStr,constr, Field
from bson.objectid import ObjectId
from bson.errors import InvalidId  
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import json, os, asyncio

from fastapi.responses import StreamingResponse,Response
from typing import List, Any,Dict, Optional, Union, Literal,Mapping
import bcrypt
from dateutil import parser as dtparser
from bson.decimal128 import Decimal128
from fastapi import Path,UploadFile, File, Form
# from fastapi import UploadFile, File, Form
# from pathlib import Path 
from starlette.staticfiles import StaticFiles
import uuid
from zoneinfo import ZoneInfo
import re
from fastapi import HTTPException, Depends
from fastapi.responses import JSONResponse
from dateutil.relativedelta import relativedelta
import pathlib, secrets
from email.message import EmailMessage
import aiosmtplib
import paho.mqtt.client as mqtt
from contextlib import asynccontextmanager

SECRET_KEY = "supersecret"  # ใช้จริงควรเก็บเป็น env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES_TECHNICIAN = 1440  # 24 ชั่วโมง
ACCESS_TOKEN_EXPIRE_MINUTES_DEFAULT = 1440  # 24 ชั่วโมง (user อื่น)
SESSION_IDLE_MINUTES_TECHNICIAN = None  # technician ไม่มี idle timeout
SESSION_IDLE_MINUTES_DEFAULT = 15  # user อื่น idle 15 นาที แล้วเด้ง
REFRESH_TOKEN_EXPIRE_DAYS = 7
th_tz = ZoneInfo("Asia/Bangkok")

# .env หรือผ่านตัวแปรแวดล้อม
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "eds194655@gmail.com")
SMTP_PASS = os.getenv("SMTP_PASS", "depllvpufjwtpysc")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "eds194655@gmail.com")

# BASE = Path(__file__).parent
# app = FastAPI()

client1 = MongoClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")
client = AsyncIOMotorClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")

deviceDB = client["utilizationFactor"]
settingDB = client["settingParameter"]
errorDB = client["errorCode"]

db = client1["iMPS"]
users_collection = db["users"]
station_collection = db["stations"]
charger_collection = db["charger"]

station_collection.create_index("station_id", unique=True)
charger_collection.create_index("station_id")  # foreign key
charger_collection.create_index("chargeBoxID")

charger_onoff = client["stationsOnOff"]

MDB_DB = client["MDB"]

CBM_DB = client["monitorCBM"]

PMReportDB = client["PMReport"]
PMUrlDB = client["PMReportURL"]

MDBPMReportDB = client["MDBPMReport"]
MDBPMUrlDB = client["MDBPMReportURL"]

CCBPMReportDB = client["CCBPMReport"]
CCBPMUrlDB = client["CCBPMReportURL"]

CBBOXPMReportDB = client["CBBOXPMReport"]
CBBOXPMUrlDB = client["CBBOXPMReportURL"]

DCTestReportDB = client["DCTestReport"]
DCUrlDB = client["DCUrl"]

ACTestReportDB = client["ACTestReport"]
ACUrlDB = client["ACUrl"]

stationPMReportDB = client["stationPMReport"]
stationPMUrlDB = client["stationPMReportURL"]

CMReportDB = client["CMReport"]
CMUrlDB = client["CMReportURL"]

outputModule1 = client["OutputModule1"]
outputModule2 = client["OutputModule2"]
outputModule3 = client["OutputModule3"]
outputModule4 = client["OutputModule4"]
outputModule5 = client["OutputModule5"]
outputModule6 = client["OutputModule6"]
outputModule7 = client["OutputModule7"]

inputModule1 = client["module1MdbDustPrediction"]
inputModule2 = client["module2ChargerDustPrediction"]
inputModule3 = client["module3ChargerOfflineAnalysis"]
inputModule4 = client["module4AbnormalPowerPrediction"]
inputModule5 = client["module5NetworkProblemPrediction"]
inputModule6 = client["module6DcChargerRulPrediction"]
inputModule7 = client["module7ChargerPowerIssue"]

# ปรับให้รองรับหลายโมดูล
MODULES = ["module1", "module2", "module3", "module4", "module5", "module6", "module7"]

OUTPUT_DBS = {
    "module1": outputModule1,
    "module2": outputModule2,
    "module3": outputModule3,
    "module4": outputModule4,
    "module5": outputModule5,
    "module6": outputModule6,
    "module7": outputModule7,
}

INPUT_DBS = {
    "module1": inputModule1,
    "module2": inputModule2,
    "module3": inputModule3,
    "module4": inputModule4,
    "module5": inputModule5,
    "module6": inputModule6,
    "module7": inputModule7,
}


imps_db_async = client["iMPS"]
stations_coll_async = imps_db_async["stations"]
users_coll_async = imps_db_async["users"]
email_log_coll = imps_db_async["errorEmailLog"]

MDB_collection = MDB_DB["Klongluang3"]

BROKER_HOST = "212.80.215.42"
BROKER_PORT = 1883
MQTT_TOPIC  = "iMPS/Test/settingPLC"
MQTT_CLIENT_ID = "imps-backend-setting-plc"
mqtt_client = mqtt.Client(client_id=MQTT_CLIENT_ID, clean_session=True)

def _on_connect(client, userdata, flags, rc):
    pass

def _on_disconnect(client, userdata, rc):
    pass

mqtt_client.on_connect = _on_connect
mqtt_client.on_disconnect = _on_disconnect

async def lifespan(app: FastAPI):
    # ใช้ connect_async + loop_start เพื่อไม่ block event loop
    mqtt_client.connect_async(BROKER_HOST, BROKER_PORT, keepalive=60)
    mqtt_client.loop_start()
    try:
        yield
    finally:
        try:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
        except Exception as e:
            print(f"[MQTT] disconnect error: {e}")

app = FastAPI(lifespan=lifespan)

# CORS (ระบุ origin จริงในโปรดักชัน)
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:3001"],  # ระบุให้ตรง
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
#     expose_headers=["ETag"],
#     max_age=86400,
# )

def _validate_station_id(station_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")

def get_mdb_collection_for(station_id: str):
    # กันชื่อคอลเลกชันแปลก ๆ / injection: อนุญาต a-z A-Z 0-9 _ -
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    return MDB_DB.get_collection(str(station_id))

def to_json(obj) -> str:
    # บังคับให้เป็น single-line และรองรับ UTF-8
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))



def _ensure_utc_iso(v):
    """
    คืนค่าเป็นสตริง ISO-8601 (UTC 'Z') เสมอ
    - ถ้าเป็น datetime → แปลงเป็น UTC + เติม 'Z'
    - ถ้าเป็นสตริง ISO ที่ไม่มีโซนเวลา → เติม 'Z'
    - อย่างอื่น → คืนเดิม
    """
    if isinstance(v, datetime):
        return v.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    if isinstance(v, str) and re.match(r'^\d{4}-\d{2}-\d{2}T', v) and not re.search(r'(Z|[+\-]\d{2}:\d{2})$', v):
        return v + 'Z'
    return v

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
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "https://203.154.130.132:3000",
        "https://203.154.130.132:3001",
        "https://imps.egatdiamond.co.th", 
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["ETag"],              # ให้ FE อ่าน ETag ได้ (ใช้ใน /outputModule6)
    max_age=86400  
)



oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login/")

class UserClaims(BaseModel):
    sub: str
    user_id: Optional[str] = None
    username: Optional[str] = None
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

@app.post("/login/")
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

@app.get("/me")
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

@app.get("/my-stations/detail")
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

@app.get("/station/info")
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

@app.get("/charger/info")
def charger_info(
    station_id: str = Query(None),
    sn: str = Query(None),
    current: UserClaims = Depends(get_current_user),
):
    query = {}
    if sn:
        # ลอง query หลาย field ด้วยค่าเดียวกัน
        query = {"$or": [
            {"SN": sn},
            {"chargeBoxID": sn},
            {"station_id": sn}
        ]}
    elif station_id:
        query["station_id"] = station_id
    else:
        raise HTTPException(status_code=400, detail="station_id or sn required")
    
    print(f"[DEBUG] query={query}")
    
    doc = charger_collection.find_one(query, {"_id": 0})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    # ดึง station_name
    station = station_collection.find_one(
        {"station_id": doc.get("station_id")},
        {"_id": 0, "station_name": 1}
    )
    
    doc["station_name"] = station.get("station_name", "-") if station else "-"

    return {"station": doc}

# @app.get("/station/info/public")
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

@app.get("/station/info/public")
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

class RefreshIn(BaseModel):
    refresh_token: str

@app.post("/refresh")
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
    
@app.post("/logout")
async def logout(email: str, refresh_token: str):
    result = users_collection.update_one(
        {"email": email, "refreshTokens.token": refresh_token},
        {"$pull": {"refreshTokens": {"token": refresh_token}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Token not found or already logged out")
    return {"msg": "Logged out successfully"}


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
    tel: str
    company: str
#create
@app.post("/insert_users/")
async def create_users(users: register):
    # hash password
    hashed_pw = bcrypt.hashpw(users.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    now = datetime.now(timezone.utc)

    users_collection.insert_one(
    {
        "username" : users.username,
        "email":users.email,
        "password":hashed_pw,
        "tel":users.tel,
        "refreshTokens": [],
        "role":"Technician",
        "company":users.company,
        "createdAt": now,   # ✅ เพิ่ม
        "updatedAt": now,   # ✅ เพิ่ม
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


# @app.get("/selected/station/{station_id}")
# async def get_station_detail(station_id: str, current: UserClaims = Depends(get_current_user)):
#     station = station_collection.find_one({"station_id": station_id})
#     if not station:
#         raise HTTPException(status_code=404, detail="Station not found")

#     # ✅ แปลง _id เป็น string
#     station["_id"] = str(station["_id"])

#     return station

@app.get("/selected/station/{station_id}")
async def get_station_detail(station_id: str, current: UserClaims = Depends(get_current_user)):
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    # แปลงทุกอย่างให้ JSON ได้
    return jsonable_encoder(
        station,
        custom_encoder={
            ObjectId: str,
            datetime: lambda v: v.isoformat()
        }
    )

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

def _coerce_date_range(start: str, end: str) -> tuple[str, str]:
    def _norm(s: str, is_end: bool=False) -> str:
        if "T" not in s:  # วันล้วน
            hhmmss = "23:59:59.999" if is_end else "00:00:00.000"
            dt = datetime.fromisoformat(f"{s}T{hhmmss}+07:00")
            # print("521",dt)
            # print("522",dt.astimezone(timezone.utc).isoformat())
            iso_th = dt.astimezone(th_tz).isoformat()
            # print("iso_th", iso_th)

            test = dt.astimezone(timezone.utc).isoformat()
            # print("526",dt)
            # print("527",type(dt.astimezone(timezone.utc).isoformat().replace("+00:00", "T")))
            # print("528",type(dt))
            # return dt.astimezone(timezone.utc).isoformat().replace("+07:00", "T")
            return iso_th
            
            # return dt
        # มี T แล้ว แต่ไม่มี timezone → ถือเป็นเวลาไทย
        has_tz = bool(re.search(r'(Z|[+\-]\d{2}:\d{2})$', s))
        if not has_tz:
            dt = datetime.fromisoformat(s + "+07:00")
            # print("528",dt)
        else:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            # print("531",datetime.fromisoformat(s))
            # print("532",dt)
        # print("533",dt.astimezone(timezone.utc).isoformat())    
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    try:
        return _norm(start, False), _norm(end, True)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad date range")
    
@app.get("/MDB/history")
async def stream_history(
    request: Request,
    station_id: str = Query(...),
    start: str = Query(...),  
    end: str = Query(...),    
    every: str = Query("5m"), 
    current: UserClaims = Depends(get_current_user),
):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", start) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", end):
        raise HTTPException(status_code=400, detail="start/end must be YYYY-MM-DD")
    if start > end:
        start, end = end, start

    tz_th = ZoneInfo("Asia/Bangkok")
    now_th = datetime.now(tz_th)

    def coerce_day_bound_th(datestr: str, bound: Literal["start", "end"], now_th: datetime) -> datetime:
        tz_th = ZoneInfo("Asia/Bangkok")
        # วันที่ล้วน → บังคับขอบวันไทย
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", datestr):
            if bound == "start":
                dt_th = datetime.fromisoformat(f"{datestr}T00:00:00").replace(tzinfo=tz_th)
                return dt_th.astimezone(timezone.utc)
            else:
                # ถ้า end เป็น "วันนี้" → ใช้เวลาปัจจุบันของไทย (กันกราฟลากไปอนาคต)
                if datestr == now_th.strftime("%Y-%m-%d"):
                    return now_th.astimezone(timezone.utc)
                # มิฉะนั้น ปลายวันไทย
                dt_th = datetime.fromisoformat(f"{datestr}T23:59:59.999").replace(tzinfo=tz_th)
                return dt_th.astimezone(timezone.utc)

        # มีโซนเวลาอยู่แล้ว (Z หรือ ±HH:MM) → ใช้ตามนั้น
        if re.search(r"(Z|[+\-]\d{2}:\d{2})$", datestr):
            return datetime.fromisoformat(datestr.replace("Z", "+00:00")).astimezone(timezone.utc)

        # เป็น datetime ไม่มีโซน → ตีความเป็นไทย แล้วแปลงเป็น UTC
        return datetime.fromisoformat(datestr).replace(tzinfo=tz_th).astimezone(timezone.utc)

    def ensure_dt_with_current_time_th(datestr: str) -> datetime:
        """
        - 'YYYY-MM-DD'                  -> เติมเวลาเป็นเวลาปัจจุบันของไทย แล้วตีความเป็นเวลาไทย (+07:00)
        - 'YYYY-MM-DDTHH[:MM[:SS]]'    -> ถ้าไม่มีโซนเวลา ให้ตีความเป็นเวลาไทย (+07:00)
        - ลงท้ายด้วย 'Z' หรือมี '+/-HH:MM' -> ใช้โซนที่มากับสตริง
        แล้วคืนค่าเป็น UTC datetime
        """
        # เติมเวลาไทยปัจจุบัน หากเป็นวันที่ล้วน
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", datestr):
            datestr = f"{datestr}T{now_th.strftime('%H:%M:%S')}"

        # มีโซนเวลาแล้ว (Z หรือ +/-HH:MM)
        if re.search(r"(Z|[+\-]\d{2}:\d{2})$", datestr):
            # รองรับ 'Z' ให้เป็น +00:00
            dt = datetime.fromisoformat(datestr.replace("Z", "+00:00"))
            return dt.astimezone(timezone.utc)

        # ไม่มีโซนเวลา -> ตีความว่าเป็น "เวลาไทย" (+07:00) แล้วค่อยแปลงเป็น UTC
        naive = datetime.fromisoformat(datestr)        # ไม่ผูกโซนก่อน
        dt_th = naive.replace(tzinfo=tz_th)            # ← ตรงนี้คือการ “ผูก +07:00”
        return dt_th.astimezone(timezone.utc)          # ← แปลงเป็น UTC (ผล = ลบ 7 ชม.)

    def _ensure_iso_with_tz(val: Any, tz: ZoneInfo) -> str | None:
        """
        รับค่า datetime (หรือสตริง) แล้วคืนค่า ISO8601 ที่มีโซนเวลาเป้าหมาย (เช่น +07:00)
        """
        if val is None:
            return None
        if isinstance(val, str):
            try:
                # parse ทั้งกรณีมี Z/offset หรือไม่มีโซน
                dt = datetime.fromisoformat(val.replace("Z", "+00:00")) if re.search(r"(Z|[+\-]\d{2}:\d{2})$", val) \
                    else datetime.fromisoformat(val).replace(tzinfo=timezone.utc)
            except Exception:
                return val  # ถ้า parse ไม่ได้ ก็ส่งกลับเดิม (กันพัง)
        elif isinstance(val, datetime):
            dt = val if val.tzinfo else val.replace(tzinfo=timezone.utc)
        else:
            return None
        return dt.astimezone(tz).isoformat(timespec="milliseconds")
        
    UNIT_MAP = {"s": "second", "m": "minute", "h": "hour"}

    def parse_every(s: str) -> tuple[str, int]:
        """
        แปลงสตริงเช่น '5m', '15m', '1h' → (unit, binSize)
        ดีฟอลต์ = ('minute', 5)
        """
        m = re.fullmatch(r"(\d+)([smh])$", s.strip())
        if not m:
            return ("minute", 5)
        n, u = int(m.group(1)), m.group(2)
        return (UNIT_MAP[u], max(1, n))
    # start_utc = ensure_dt_with_current_time_th(start)
    # print("565",start_utc)
    # end_utc   = ensure_dt_with_current_time_th(end)
    # print("567",end_utc)

    start_utc = coerce_day_bound_th(start, "start", now_th)
    end_utc   = coerce_day_bound_th(end,   "end",   now_th)

    coll = get_mdb_collection_for(station_id)

    # ไม่ใช้ $regexReplace/$replaceOne — แยก case ด้วย $regexMatch + $toDate/$dateFromString
    def _parse_string(varname: str):
        # ถ้ามีโซนเวลา (Z หรือ ±HH:MM) → ให้ Mongo แปลงเองด้วย $toDate
        # ถ้าไม่มีโซนเวลา → ตีความเป็นเวลาไทยด้วย $dateFromString timezone "+07:00"
        return {
            "$cond": [
                { "$regexMatch": { "input": f"$${varname}", "regex": r"(Z|[+\-]\d{2}:\d{2})$" } },
                { "$toDate": f"$${varname}" },
                { "$dateFromString": {
                    "dateString": f"$${varname}",
                    "timezone": "+07:00",
                    "onError": None,
                    "onNull": None
                } }
            ]
        }

    # แปลงค่า sampling interval
    unit, bin_size = parse_every(every)

    # ---------- prefix เดิม: ts/dayTH + match 2 ชั้น ----------
    prefix = [
        {   # ✅ ts: แปลง timestamp/Datetime ให้เป็น Date
            "$addFields": {
                "ts": {
                    "$let": { "vars": { "t": "$timestamp", "d": "$Datetime" }, "in":
                        { "$cond": [
                            { "$ne": ["$$t", None] },
                            { "$switch": {
                                "branches": [
                                    { "case": { "$eq": [ { "$type": "$$t" }, "date"   ] }, "then": "$$t" },
                                    { "case": { "$eq": [ { "$type": "$$t" }, "string" ] }, "then": {
                                        "$cond": [
                                            { "$regexMatch": { "input": "$$t", "regex": r"(Z|[+\-]\d{2}:\d{2})$" } },
                                            { "$toDate": "$$t" },
                                            { "$dateFromString": { "dateString": "$$t", "timezone": "+07:00", "onError": None, "onNull": None } }
                                        ]
                                    }},
                                ],
                                "default": None
                            }},
                            { "$switch": {
                                "branches": [
                                    { "case": { "$eq": [ { "$type": "$$d" }, "date"   ] }, "then": "$$d" },
                                    { "case": { "$eq": [ { "$type": "$$d" }, "string" ] }, "then": {
                                        "$cond": [
                                            { "$regexMatch": { "input": "$$d", "regex": r"(Z|[+\-]\d{2}:\d{2})$" } },
                                            { "$toDate": "$$d" },
                                            { "$dateFromString": { "dateString": "$$d", "timezone": "+07:00", "onError": None, "onNull": None } }
                                        ]
                                    }},
                                ],
                                "default": None
                            }}
                        ] }
                    }
                }
            }
        },
        { "$addFields": { "dayTH": { "$dateToString": { "date": "$ts", "format": "%Y-%m-%d", "timezone": "+07:00" }}}},
        { "$match": { "dayTH": { "$gte": start, "$lte": end } }},  # ชั้นที่ 1: วันไทย
        { "$match": { "$expr": { "$and": [
            { "$gte": ["$ts", start_utc] },  # ชั้นที่ 2: ts อยู่ในช่วง
            { "$lte": ["$ts", end_utc] }
        ]}}}
    ]

    # ---------- downsample ด้วย $dateTrunc ----------
    group_stage = {
        "$group": {
            "_id": {
                "bucket": {
                    "$dateTrunc": {
                        "date": "$ts",
                        "unit": unit,         # second / minute / hour
                        "binSize": bin_size,  # เช่น 5
                        "timezone": "+07:00"  # อิงเวลาไทย
                    }
                }
            },
            # ค่าเฉลี่ยเพื่อให้กราฟสมูท (กันกรณีค่ามาเป็น string ด้วย $convert)
            "VL1N": {"$avg": {"$convert": {"input": "$VL1N", "to": "double", "onError": None, "onNull": None}}},
            "VL2N": {"$avg": {"$convert": {"input": "$VL2N", "to": "double", "onError": None, "onNull": None}}},
            "VL3N": {"$avg": {"$convert": {"input": "$VL3N", "to": "double", "onError": None, "onNull": None}}},
            "I1":   {"$avg": {"$convert": {"input": "$I1",   "to": "double", "onError": None, "onNull": None}}},
            "I2":   {"$avg": {"$convert": {"input": "$I2",   "to": "double", "onError": None, "onNull": None}}},
            "I3":   {"$avg": {"$convert": {"input": "$I3",   "to": "double", "onError": None, "onNull": None}}},
            "PL1N": {"$avg": {"$convert": {"input": "$PL1N", "to": "double", "onError": None, "onNull": None}}},
            "PL2N": {"$avg": {"$convert": {"input": "$PL2N", "to": "double", "onError": None, "onNull": None}}},
            "PL3N": {"$avg": {"$convert": {"input": "$PL3N", "to": "double", "onError": None, "onNull": None}}},
        }
    }
    sort_stage = { "$sort": { "_id.bucket": 1 } }
    project_stage = {
        "$project": {
            "_id": 0,
            "timestamp": "$_id.bucket",  # หรือ "$_id.bucket" ถ้าใช้ dateTrunc
            "VL1N": 1, "VL2N": 1, "VL3N": 1,
            "I1": 1, "I2": 1, "I3": 1,
            "PL1N": 1, "PL2N": 1, "PL3N": 1,
        }
    }

    pipeline = prefix + [group_stage, sort_stage, project_stage]
    cursor = coll.aggregate(pipeline, allowDiskUse=True)


    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    async def event_generator():
        try:
            # base = pipeline[:-2]
            # cnt = await coll.aggregate(base + [{"$count": "n"}]).to_list(length=1)
            # n = cnt[0]["n"] if cnt else 0
            cnt = await coll.aggregate(prefix + [group_stage, {"$count":"n"}]).to_list(length=1)
            n = cnt[0]["n"] if cnt else 0

            yield "retry: 3000\n"
            yield f"event: stats\ndata: {json.dumps({'matched': n})}\n\n"

            sent = 0
            async for doc in cursor:
                if await request.is_disconnected():
                    break

                # ✅ อย่าแตะ _id ถ้าไม่ได้ใช้งาน (หลีกเลี่ยง KeyError)
                # ถ้าจำเป็นจริง ๆ ค่อยทำแบบปลอดภัย:
                # _id_val = doc.get("_id", None)
                # if _id_val is not None:
                #     try:
                #         doc["_id"] = str(_id_val)
                #     except Exception:
                #         doc["_id"] = json.dumps(_id_val, default=str, ensure_ascii=False)

                # ✅ ให้แน่ใจว่า timestamp เป็น ISO string (รองรับทั้ง Date/str)
                ts_val = doc.get("timestamp")
                if ts_val is not None:
                    doc["timestamp"] = _ensure_iso_with_tz(ts_val, ZoneInfo("Asia/Bangkok"))

                yield f"data: {json.dumps(doc, ensure_ascii=False)}\n\n"
                sent += 1
                await asyncio.sleep(0.001)

            if sent == 0:
                yield "event: empty\ndata: no documents in range\n\n"
            else:
                yield ": keep-alive\n\n"
        except Exception as e:
            yield f"event: server-error\ndata: {json.dumps({'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)

@app.get("/MDB/history/debug")
async def mdb_history_debug(station_id: str, start: str, end: str):
    start_iso, end_iso = _coerce_date_range(start, end)
    start_key, end_key = start_iso.rstrip("Z"), end_iso.rstrip("Z")
    coll = get_mdb_collection_for(station_id)
    q = {"timestamp": {"$gte": start_key, "$lte": end_key}}
    docs = await coll.find(q, {"_id":0,"timestamp":1}).sort("timestamp", 1).limit(5).to_list(length=5)
    n = await coll.count_documents(q)
    return {"matched": n, "start_key": start_key, "end_key": end_key, "sample": docs}

def extract_token(authorization: str | None, access_token: str | None):
    if authorization and authorization.startswith("Bearer "):
        return authorization.split(" ", 1)[1]
    if access_token:
        return access_token
    raise HTTPException(status_code=401, detail="Not authenticated")
    
# @app.get("/MDB/{station_id}")
# async def mdb(request: Request, station_id: str, current: UserClaims = Depends(get_current_user)):
#     headers = {
#         "Content-Type": "text/event-stream",
#         "Cache-Control": "no-cache",
#         "Connection": "keep-alive",
#         "X-Accel-Buffering": "no",
#     }

#     coll = get_mdb_collection_for(station_id)  # ⬅️ ใช้ coll ตามสถานี

#     async def event_generator():
#         last_id = None

#         latest = await coll.find_one({}, sort=[("_id", -1)])
#         if latest:
#             latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
#             last_id = latest.get("_id")
#             yield f"event: init\ndata: {to_json(latest)}\n\n"
#         else:
#             yield ": keep-alive\n\n"

#         while True:
#             if await request.is_disconnected():
#                 break

#             doc = await coll.find_one({}, sort=[("_id", -1)])
#             if doc and doc.get("_id") != last_id:
#                 doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
#                 last_id = doc.get("_id")
#                 yield f"data: {to_json(doc)}\n\n"
#             else:
#                 yield ": keep-alive\n\n"

#             await asyncio.sleep(1)

#     return StreamingResponse(event_generator(), headers=headers)

@app.get("/MDB/{station_id}")
async def mdb(request: Request, station_id: str, current: UserClaims = Depends(get_current_user)):
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    coll = get_mdb_collection_for(station_id)

    async def event_generator():
        # ส่งข้อมูลล่าสุดก่อน
        latest = await coll.find_one({}, sort=[("_id", -1)])
        if latest:
            latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
            yield f"event: init\ndata: {to_json(latest)}\n\n"
        else:
            yield ": keep-alive\n\n"

        # เปิด Change Stream เพื่อรับข้อมูลแบบ real-time
        pipeline = [
            {"$match": {"operationType": "insert"}}  # ฟังเฉพาะ insert
        ]
        
        try:
            async with coll.watch(pipeline) as stream:
                async for change in stream:
                    if await request.is_disconnected():
                        break
                    
                    doc = change["fullDocument"]
                    doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                    yield f"data: {to_json(doc)}\n\n"
                    
        except Exception as e:
            print(f"Change stream error: {e}")
            # Fallback เป็น polling ถ้า Change Stream ไม่ทำงาน
            last_id = latest.get("_id") if latest else None
            while True:
                if await request.is_disconnected():
                    break
                    
                doc = await coll.find_one({}, sort=[("_id", -1)])
                if doc and doc.get("_id") != last_id:
                    doc["timestamp"] = doc.get("timestamp")
                    last_id = doc.get("_id")
                    yield f"data: {to_json(doc)}\n\n"
                else:
                    yield ": keep-alive\n\n"
                    
                await asyncio.sleep(1)

    return StreamingResponse(event_generator(), headers=headers)

@app.get("/MDB/{station_id}/peak-power")
async def mdb_peak_power(station_id: str, current_user: UserClaims = Depends(get_current_user)):
    """
    ดึงค่า PL1N, PL2N, PL3N, PL123N ที่สูงที่สุด (peak) จากข้อมูล database ทั้งหมด
    ข้อมูลเข้า database เรื่อย ๆ ดังนั้นจะหาค่าสูงสุดตั้งแต่เริ่มต้น
    กรองเฉพาะข้อมูลที่ไม่เกิน 150000
    """
    coll = get_mdb_collection_for(station_id)
    
    # Pipeline aggregation หาค่า max จากข้อมูลทั้งหมด
    pipeline = [
        {
            "$match": {
                "$and": [
                    {
                        "$expr": {
                            "$lte": [
                                {
                                    "$convert": {
                                        "input": "$PL1N",
                                        "to": "double",
                                        "onError": None,
                                        "onNull": 150001
                                    }
                                },
                                150000
                            ]
                        }
                    },
                    {
                        "$expr": {
                            "$lte": [
                                {
                                    "$convert": {
                                        "input": "$PL2N",
                                        "to": "double",
                                        "onError": None,
                                        "onNull": 150001
                                    }
                                },
                                150000
                            ]
                        }
                    },
                    {
                        "$expr": {
                            "$lte": [
                                {
                                    "$convert": {
                                        "input": "$PL3N",
                                        "to": "double",
                                        "onError": None,
                                        "onNull": 150001
                                    }
                                },
                                150000
                            ]
                        }
                    },
                    {
                        "$expr": {
                            "$lte": [
                                {
                                    "$convert": {
                                        "input": "$PL123N",
                                        "to": "double",
                                        "onError": None,
                                        "onNull": 150001
                                    }
                                },
                                150000
                            ]
                        }
                    }
                ]
            }
        },
        {
            "$group": {
                "_id": None,
                "PL1N_peak": {
                    "$max": {
                        "$convert": {
                            "input": "$PL1N",
                            "to": "double",
                            "onError": None,
                            "onNull": None
                        }
                    }
                },
                "PL2N_peak": {
                    "$max": {
                        "$convert": {
                            "input": "$PL2N",
                            "to": "double",
                            "onError": None,
                            "onNull": None
                        }
                    }
                },
                "PL3N_peak": {
                    "$max": {
                        "$convert": {
                            "input": "$PL3N",
                            "to": "double",
                            "onError": None,
                            "onNull": None
                        }
                    }
                },
                "PL123N_peak": {
                    "$max": {
                        "$convert": {
                            "input": "$PL123N",
                            "to": "double",
                            "onError": None,
                            "onNull": None
                        }
                    }
                },
            }
        },
        {
            "$project": {
                "_id": 0,
                "PL1N_peak": {"$round": ["$PL1N_peak", 2]},
                "PL2N_peak": {"$round": ["$PL2N_peak", 2]},
                "PL3N_peak": {"$round": ["$PL3N_peak", 2]},
                "PL123N_peak": {"$round": ["$PL123N_peak", 2]},
            }
        }
    ]
    
    result = await coll.aggregate(pipeline).to_list(length=1)
    
    if result:
        return result[0]
    else:
        return {"PL1N_peak": None, "PL2N_peak": None, "PL3N_peak": None, "PL123N_peak": None}
    

# ------------------------------------------------------------------------------------------
#  erorr code old
# -----------------------------------------------------------------------------------------

async def _resolve_user_id_by_chargebox(chargebox_id: Optional[str]) -> Optional[str]:
    if not chargebox_id:
        return None
    doc = await stations_coll_async.find_one(
        {"chargeBoxID": chargebox_id},
        projection={"user_id": 1}
    )
    if not doc:
        return None
    return str(doc.get("user_id")) if doc.get("user_id") is not None else None

async def _resolve_user_email_by_user_id(user_id: Optional[str]) -> Optional[str]:
    if not user_id:
        return None

    queries = []
    if ObjectId.is_valid(user_id):
        queries.append({"_id": ObjectId(user_id)})
    queries.append({"_id": user_id})  # เผื่อกรณีเก็บเป็น string

    for q in queries:
        doc = await users_coll_async.find_one(q, projection={"email": 1})
        if doc:
            return doc.get("email")
    return None

async def _send_email_async(to_email: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = SENDER_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    # STARTTLS (port 587). ถ้าใช้ SMTPS (465) ให้เปลี่ยนเป็น use_tls=True และไม่ต้อง starttls
    await aiosmtplib.send(
        msg,
        hostname=SMTP_HOST,
        port=SMTP_PORT,
        start_tls=True,
        username=SMTP_USER,
        password=SMTP_PASS,
        timeout=30,
    )

async def send_error_email_once(to_email: str | None, chargebox_id: str | None, error_text: str | None, doc_id) -> bool:
    """
    ส่งเมลแจ้ง error แค่ครั้งเดียวต่อเอกสาร error (_id)
    - ใช้ collection iMPS.errorEmailLog เก็บ _id เป็น unique key
    - ถ้าส่งสำเร็จอัปเดตสถานะเป็น sent
    - ถ้าส่งล้มเหลว ลบล็อกออกเพื่อให้พยายามใหม่ครั้งหน้า
    """
    if not to_email or not error_text:
        return False

    key = str(doc_id)  # รองรับ ObjectId/str
    now_th = datetime.now(th_tz)

    # ขั้นที่ 1: กันซ้ำด้วยการ insert ล็อก (pending) ถ้ามีอยู่แล้ว -> ไม่ต้องส่ง
    try:
        await email_log_coll.insert_one({
            "_id": key,                    # ทำให้ unique key เป็น doc_id ของ error
            "status": "pending",
            "to": to_email,
            "chargeBoxID": chargebox_id,
            "createdAt": now_th,
        })
    except DuplicateKeyError:
        return False  # เคยส่งหรือกำลังส่งอยู่แล้ว

    # ขั้นที่ 2: สร้าง subject/body แล้วส่งอีเมล
    subject = f"[IMPS Error] {chargebox_id or '-'}"
    body = (
        f"เรียนผู้ใช้,\n\n"
        f"มี Error จากสถานี/อุปกรณ์: {chargebox_id or '-'}\n"
        f"เวลา (TH): {now_th:%Y-%m-%d %H:%M:%S}\n\n"
        f"รายละเอียด:\n{error_text}\n\n"
        f"-- ระบบ iMPS"
    )
    try:
        await _send_email_async(to_email, subject, body)
        await email_log_coll.update_one({"_id": key}, {"$set": {"status": "sent", "sentAt": datetime.now(th_tz)}})
        return True
    except Exception:
        # ถ้าส่งล้มเหลว ลบล็อก pending ออก เพื่อให้ลองส่งใหม่ได้ในรอบถัดไป
        await email_log_coll.delete_one({"_id": key})
        raise

def get_errorCode_collection_for(station_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    return errorDB.get_collection(str(station_id))

@app.get("/error/{station_id}")
async def error_stream(request: Request, station_id: str, current: UserClaims = Depends(get_current_user)):
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    coll = get_errorCode_collection_for(station_id)

    async def event_generator():
        last_id = None

        # ----- init -----
        latest = await coll.find_one({}, sort=[("_id", -1)])
        if latest and ("error" in latest):
            last_id = latest.get("_id")

            chargebox_id = latest.get("Chargebox_ID")
            user_id = await _resolve_user_id_by_chargebox(chargebox_id)
            email = await _resolve_user_email_by_user_id(user_id)

            try:
                await send_error_email_once(email, chargebox_id, latest.get("error"), last_id)
            except Exception as e:
                # ไม่ให้ตกสตรีม: log แล้วไปต่อ
                print(f"[email] init send failed for {last_id}: {e}")

            payload = {
                "Chargebox_ID": chargebox_id,
                "user_id": user_id,
                "email": email,
                "error": latest.get("error"),
            }
            # yield f"event: init\ndata: {to_json(payload)}\n\n"
        else:
            yield ": keep-alive\n\n"

        # ----- updates -----
        while True:
            if await request.is_disconnected():
                break

            doc = await coll.find_one({}, sort=[("_id", -1)])
            if doc and doc.get("_id") != last_id and ("error" in doc):
                last_id = doc.get("_id")

                chargebox_id = doc.get("Chargebox_ID")
                user_id = await _resolve_user_id_by_chargebox(chargebox_id)
                email = await _resolve_user_email_by_user_id(user_id)
                
                try:
                    await send_error_email_once(email, chargebox_id, doc.get("error"), last_id)
                except Exception as e:
                    print(f"[email] update send failed for {last_id}: {e}")

                payload = {
                    "Chargebox_ID": chargebox_id,
                    "user_id": user_id,
                    "email": email,
                    "error": doc.get("error"),
                }
                # yield f"data: {to_json(payload)}\n\n"
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(60)

    return StreamingResponse(event_generator(), headers=headers)

# ----------------------------------------------------------------------------------------
# notification
# ----------------------------------------------------------------------------------------

from routers.notifications import router as notifications_router

app.include_router(notifications_router)

# ------------------------------------------------------------------------------------------

def parse_iso_dt(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail=f"Bad datetime: {s}")


def _to_utc_dt(iso_str: str) -> datetime:
    # รับ ISO ที่อาจลงท้าย Z หรือไม่ก็ได้ แล้วบังคับเป็น aware UTC
    s = iso_str
    if s.endswith("Z"):
        s = s.replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)  # ได้ทั้ง aware/naive
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt

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
# @app.get("/all-users/")
# def all_users():
#     # เอาทุกฟิลด์ ยกเว้น password และ refreshTokens
#     cursor = users_collection.find({}, {"password": 0, "refreshTokens": 0})
#     docs = list(cursor)

#     # ถ้าจะส่ง _id ไปด้วย ต้องแปลง ObjectId -> str
#     for d in docs:
#         if "_id" in d:
#             d["_id"] = str(d["_id"])

#     return {"users": docs}

@app.get("/all-users/")
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

class UserOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    role: str
    company: str
    station_id: List[str] = Field(default_factory=list)
    tel: str

@app.post("/add_users/", response_model=UserOut, status_code=201)
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
    station_id: Optional[List[str]] = None  # สำหรับ technician

def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# ฟิลด์ที่อนุญาต
ALLOW_FIELDS_ADMIN_USER = {"username", "email", "tel", "company", "role", "is_active", "password", "station_id"}
ALLOW_FIELDS_SELF_USER  = {"username", "email", "tel", "company", "password"}


@app.patch("/user_update/{id}", response_model=UserOut)
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
    ALLOW_FIELDS_ADMIN_USER = {"username","email","password","role","company","tel","is_active","station_id"}
    ALLOW_FIELDS_SELF_OWNER = {"username","email","password","tel"}  # ปรับตามที่อยากให้แก้เองได้
    if current.role == "admin":
        allowed = ALLOW_FIELDS_ADMIN_USER
    else:  # owner
        allowed = ALLOW_FIELDS_SELF_OWNER

    payload = {k: v for k, v in incoming.items() if k in allowed}
    if not payload:
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

# --------------------------------------- station ---------------------------
def parse_iso_utc(s: str) -> Optional[datetime]:
    try:
        # "2025-09-29T16:19:54.659Z"
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None

# def latest_onoff(station_id: str) -> Dict[str, Any]:
#     """
#     อ่านเอกสารล่าสุดจาก stationsOnOff/<station_id>
#     โครงสร้าง doc:
#       { payload: { value: 0/1, timestamp: "ISO-UTC" }, ... }
#     """
#     coll = charger_onoff.get_collection(station_id)
#     doc = coll.find_one(
#         sort=[("payload.timestamp", -1), ("_id", -1)]
#     )
#     if not doc:
#         return {"status": None, "statusAt": None}

#     payload = doc.get("payload", {})
#     val = payload.get("value", None)
#     ts = payload.get("timestamp", None)

#     # แปลงเป็น bool ชัดเจน: 1/true => True, 0/false => False, อื่นๆ -> None
#     if isinstance(val, (int, bool)):
#         status = bool(val)
#     else:
#         try:
#             status = bool(int(val))
#         except Exception:
#             status = None

#     status_at = parse_iso_utc(ts) if isinstance(ts, str) else None
#     return {"status": status, "statusAt": status_at}

# @app.get("/all-stations/")
# def all_stations(current: UserClaims = Depends(get_current_user)):
#     # 1) สร้างเงื่อนไข match ตาม role
#     if current.role == "admin":
#         match_query = {}
#     else:
#         if not current.user_id:
#             raise HTTPException(status_code=401, detail="Missing uid in token")
#         # รองรับทั้งกรณีเก็บ user_id เป็น string หรือ ObjectId
#         conds = [{"user_id": current.user_id}]
#         try:
#             conds.append({"user_id": ObjectId(current.user_id)})
#         except Exception:
#             pass
#         match_query = {"$or": conds}

#     pipeline = [
#         {"$match": match_query},

#         # 2) แปลง user_id -> ObjectId ถ้าเป็น string (เพื่อ lookup)
#         {"$addFields": {
#             "user_obj_id": {
#                 "$cond": [
#                     {"$eq": [{"$type": "$user_id"}, "string"]},
#                     {"$toObjectId": "$user_id"},
#                     "$user_id"  # ถ้าเป็น ObjectId อยู่แล้ว ให้ใช้เดิม
#                 ]
#             }
#         }},

#         # 3) ดึง username (และฟิลด์อื่นๆจาก users) ด้วย $lookup
#         {"$lookup": {
#             "from": "users",              # ชื่อ collection ของ user
#             "localField": "user_obj_id",  # _id ใน users เป็น ObjectId
#             "foreignField": "_id",
#             "as": "owner"
#         }},
#         {"$addFields": {
#             "username": {"$arrayElemAt": ["$owner.username", 0]},
#             # เพิ่มได้ถ้าต้องการ เช่น email/phone/company
#             # "owner_email": {"$arrayElemAt": ["$owner.email", 0]},
#         }},

#         # 4) ไม่ต้องส่ง array owner กับฟิลด์ช่วยแปลงออกไป
#         {"$project": {"owner": 0, "user_obj_id": 0}},
#     ]

#     docs = list(station_collection.aggregate(pipeline))

#     # ★ เติมสถานะล่าสุดแบบเรียลไทม์ต่อสถานี
#     for d in docs:
#         sid = d.get("station_id")
#         try:
#             last = latest_onoff(str(sid))
#         except Exception:
#             last = {"status": None, "statusAt": None}
#         d["status"] = last["status"]          # true/false/None
#         d["statusAt"] = last["statusAt"]      # datetime | None

#     docs = jsonable_encoder(docs, custom_encoder={ObjectId: str})
#     for d in docs:
#         if "_id" in d:
#             d["_id"] = str(d["_id"])
#     return {"stations": docs}

# class addStations(BaseModel):
#     station_id:str
#     station_name:str
#     brand:str
#     model:str
#     SN:str
#     WO:str 
#     PLCFirmware:str 
#     PIFirmware:str 
#     RTFirmware:str
#     chargeBoxID: str 
#     user_id: Optional[str] = None  
#     owner: Optional[str] = None
#     is_active:Optional[bool] = None


# class StationOut(BaseModel):
#     id: str
#     station_id:str
#     station_name:str
#     brand:str
#     model:str
#     SN:str
#     WO:str 
#     PLCFirmware:str 
#     PIFirmware:str 
#     RTFirmware:str 
#     chargeBoxID:str
#     user_id: str 
#     username: Optional[str] = None
#     is_active:  Optional[bool] = None
#     images: Optional[dict] = None   # ⬅️ เพิ่มบรรทัดนี้
#     createdAt: Optional[datetime] = None
#     class Config:
#         json_encoders = {
#             datetime: lambda v: v.astimezone(ZoneInfo("Asia/Bangkok")).isoformat()
#         }


# @app.post("/add_stations/", response_model=StationOut, status_code=201)
# def insert_stations(
#     body: addStations,
#     current: UserClaims = Depends(get_current_user)
# ):
#     # 1) ตัด/ทำความสะอาด string fields
#     station_id   = body.station_id.strip()
#     station_name = body.station_name.strip()
#     brand        = body.brand.strip()
#     model        = body.model.strip()
#     SN           = body.SN.strip()
#     WO           = body.WO.strip()
#     PLCFirmware           = body.PLCFirmware.strip()
#     PIFirmware           = body.PIFirmware.strip()
#     RTFirmware           = body.RTFirmware.strip()
#     chargeBoxID           = body.chargeBoxID.strip()

#     if current.role == "admin":
#         owner_oid = None
#         if body.user_id:
#             owner_oid = to_object_id_or_400(body.user_id)
#         elif body.owner:
#             u = users_collection.find_one({"username": body.owner.strip()}, {"_id": 1})
#             if not u:
#                 raise HTTPException(status_code=400, detail="invalid owner username")
#             owner_oid = u["_id"]
#         else:
#             if not current.user_id:
#                 raise HTTPException(status_code=401, detail="Missing uid in token")
#             owner_oid = to_object_id_or_400(current.user_id)
#     else:
#         if not current.user_id:
#             raise HTTPException(status_code=401, detail="Missing uid in token")
#         owner_oid = to_object_id_or_400(current.user_id)

#     # 3) is_active เป็น boolean ชัดเจน
#     is_active = True if body.is_active is None else bool(body.is_active)


#     doc: Dict[str, Any] = {
#         "station_id": station_id,
#         "station_name": station_name,
#         "brand": brand,
#         "model": model,
#         "SN": SN,
#         "WO": WO,
#         "PLCFirmware": PLCFirmware,
#         "PIFirmware": PIFirmware,
#         "RTFirmware": RTFirmware,
#         "chargeBoxID": chargeBoxID,
#         "user_id": owner_oid,
#         "is_active": is_active,
#         "images": {},      
#         "createdAt": datetime.now(timezone.utc),
#     }

#     # 5) insert + จัดการ duplicate key ของ station_id
#     try:
#         res = station_collection.insert_one(doc)
#     except DuplicateKeyError:
#         raise HTTPException(status_code=409, detail="station_id already exists")

#     # 6) หา username เพื่อส่งกลับ (เหมือนสิ่งที่คุณอยากได้ใน table)
#     owner_doc = users_collection.find_one({"_id": owner_oid}, {"username": 1})
#     owner_username = owner_doc.get("username") if owner_doc else None

 
#     return {
#         "id": str(res.inserted_id),
#         "station_id": doc["station_id"],
#         "station_name": doc["station_name"],
#         "brand": doc["brand"],
#         "model": doc["model"],
#         "SN": doc["SN"],
#         "WO": doc["WO"],
#         "PLCFirmware": doc["PLCFirmware"],
#         "PIFirmware": doc["PIFirmware"],
#         "RTFirmware": doc["RTFirmware"],
#         "chargeBoxID": doc["chargeBoxID"],
#         "user_id": str(doc["user_id"]),
#         "username": owner_username,
#         "is_active": doc["is_active"],
#         "images": doc.get("images", {}),        # ⬅️ เพิ่ม
#         "createdAt": doc["createdAt"],
        
#     }

# @app.delete("/delete_stations/{id}", status_code=204)
# def delete_station(id: str, current: UserClaims = Depends(get_current_user)):
#     if current.role not in ("admin", "owner"):
#         raise HTTPException(status_code=403, detail="Forbidden")
#     try:
#         oid = ObjectId(id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Invalid id")
#     res = station_collection.delete_one({"_id":  oid})
#     if res.deleted_count == 0:
#         raise HTTPException(status_code=404, detail="Station not found")
#     return Response(status_code=204)

# class StationUpdate(BaseModel):
#     station_name: Optional[str] = None
#     brand: Optional[str] = None
#     model: Optional[str] = None
#     SN: Optional[str] = None
#     WO: Optional[str] = None
#     PLCFirmware: Optional[str] = None
#     PIFirmware: Optional[str] = None
#     RTFirmware: Optional[str] = None
#     chargeBoxID: Optional[str] = None
#     # status: Optional[bool] = None
#     images: Optional[dict] = None
#     is_active: Optional[bool] = None
#     user_id: str | None = None 


# ALLOW_FIELDS_ADMIN = {"station_id", "station_name", "brand", "model", "SN", "WO", "PLCFirmware", "PIFirmware", "RTFirmware", "chargeBoxID", "status","is_active", "user_id","images"}
# # ALLOW_FIELDS_NONADMIN = {"status"}

def to_object_id_or_400(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid user_id")

# # ===== Helpers สำหรับรูปสถานี =====
# STATION_IMG_ALLOWED = {"image/jpeg", "image/png", "image/webp"}
# STATION_IMG_MAX_BYTES = 3 * 1024 * 1024  # 3 MB

# def _ensure_dir(p: pathlib.Path):
#     p.mkdir(parents=True, exist_ok=True)

# async def save_station_image(station_id: str, kind: str, up: UploadFile) -> str:
#     """
#     เซฟไฟล์ลงโฟลเดอร์ /uploads/stations/<station_id>/
#     คืนค่า URL ที่ฝั่ง Frontend ใช้แสดงได้เลย (/uploads/...)
#     """
#     if up.content_type not in STATION_IMG_ALLOWED:
#         raise HTTPException(status_code=415, detail=f"Unsupported file type: {up.content_type}")

#     data = await up.read()
#     if len(data) > STATION_IMG_MAX_BYTES:
#         raise HTTPException(status_code=413, detail="File too large (> 3MB)")

#     # ปลายทาง
#     subdir = pathlib.Path(UPLOADS_ROOT) / "stations" / station_id
#     _ensure_dir(subdir)

#     # ชื่อไฟล์: kind-uuid.ext
#     ext = {
#         "image/jpeg": ".jpg",
#         "image/png": ".png",
#         "image/webp": ".webp",
#     }.get(up.content_type, "")
#     fname = f"{kind}-{uuid.uuid4().hex}{ext}"
#     dest  = subdir / fname

#     with open(dest, "wb") as f:
#         f.write(data)

#     # URL สำหรับเอาไปแสดง
#     url = f"/uploads/stations/{station_id}/{fname}"
#     return url

# @app.patch("/update_stations/{id}", response_model=StationOut)
# def update_station(
#     id: str,
#     body: StationUpdate,
#     current: UserClaims = Depends(get_current_user)
# ):
#     # ตรวจ id สถานี
#     try:
#         oid = ObjectId(id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="invalid id")

#     # หา station
#     st = station_collection.find_one({"_id": oid})
#     if not st:
#         raise HTTPException(status_code=404, detail="station not found")

#     # สิทธิ์: non-admin ต้องเป็น owner เท่านั้น
#     if current.role != "admin":
#         st_owner = st.get("user_id")  # อาจเป็น ObjectId
#         st_owner_str = str(st_owner) if st_owner is not None else None
#         if not current.user_id or current.user_id != st_owner_str:
#             raise HTTPException(status_code=403, detail="forbidden")

#     # เตรียมข้อมูลเข้า
#     incoming: Dict[str, Any] = {
#         k: (v.strip() if isinstance(v, str) else v)
#         for k, v in body.model_dump(exclude_none=True).items()
#     }
#     if not incoming:
#         raise HTTPException(status_code=400, detail="no fields to update")

#     # ทำ allowlist + map owner (เฉพาะ admin)
#     if current.role == "admin":
#         payload = {k: v for k, v in incoming.items() if k in ALLOW_FIELDS_ADMIN}

#         # ถ้า admin ส่ง user_id มา → แปลงเป็น ObjectId และ validate
#         if "user_id" in payload:
#             user_id_raw = payload["user_id"]

#             # รองรับสองแบบ: ส่งมาเป็น id (24hex) หรือส่งมาเป็น username
#             udoc = None
#             if isinstance(user_id_raw, str) and len(user_id_raw) == 24:
#                 # น่าจะเป็น ObjectId string
#                 udoc = users_collection.find_one({"_id": to_object_id_or_400(user_id_raw)})
#             else:
#                 # เผื่อกรณีหน้าบ้านส่ง username มา (ไม่แนะนำ แต่กันไว้)
#                 udoc = users_collection.find_one({"username": user_id_raw})

#             if not udoc:
#                 raise HTTPException(status_code=400, detail="invalid user_id")

#             # ✅ เก็บเป็น ObjectId ใน DB
#             payload["user_id"] = udoc["_id"]
    

#     if "is_active" in payload and not isinstance(payload["is_active"], bool):
#         raise HTTPException(status_code=400, detail="is_active must be boolean")

#     # สร้างคำสั่ง update
#     update_doc: Dict[str, Any] = {"$set": payload}

#     # ถ้าต้องการ “ลบ” ฟิลด์ username เดิมออกจาก stations (ให้เหลือเฉพาะ user_id)
#     # ให้เพิ่มบรรทัดนี้ (ปลอดภัย ใส่ได้ตลอด):
#     update_doc["$unset"] = {"username": ""}

#     # อัปเดต
#     res = station_collection.update_one({"_id": oid}, update_doc)
#     if res.matched_count == 0:
#         raise HTTPException(status_code=404, detail="station not found")

#     # อ่านคืน
#     doc = station_collection.find_one({"_id": oid})
#     created_at = doc.get("createdAt")
#     if created_at is None:
#         created_at = datetime.now(timezone.utc)   # 👈 กันค่า None
#     return {
#         "id": str(doc["_id"]),
#         "station_id": doc.get("station_id", ""),
#         "station_name": doc.get("station_name", ""),
#         "brand": doc.get("brand", ""),
#         "model": doc.get("model", ""),
#         "SN": doc.get("SN", ""),
#         "WO": doc.get("WO", ""),
#         "PLCFirmware": doc.get("PLCFirmware", ""),
#         "PIFirmware": doc.get("PIFirmware", ""),
#         "RTFirmware": doc.get("RTFirmware", ""),
#         "chargeBoxID": doc.get("chargeBoxID", ""),
#         "createdAt": created_at,  
#         # ส่งกลับเป็น string เพื่อให้ฝั่ง client ใช้ง่าย
#         "user_id": str(doc["user_id"]) if doc.get("user_id") else "",
#         "username": doc.get("username"),
#         "is_active": bool(doc.get("is_active", False)),
#         "images": doc.get("images", {}),       # ✅ ใส่ภาพกลับไปด้วย
#         "updatedAt": datetime.now(timezone.utc)
#     }

# @app.post("/stations/{station_id}/upload-images")
# async def upload_station_images(
#     station_id: str,
#     station: Optional[UploadFile] = File(None),
#     mdb: Optional[UploadFile]     = File(None),
#     charger: Optional[UploadFile] = File(None),
#     device: Optional[UploadFile]  = File(None),
#     current: UserClaims = Depends(get_current_user),
# ):
#     # หาเอกสารสถานี
#     doc = station_collection.find_one({"station_id": station_id})
#     if not doc:
#         raise HTTPException(status_code=404, detail="station not found")

#     # เช็คสิทธิ์: admin ผ่าน / owner เท่านั้น
#     owner_str = str(doc.get("user_id")) if doc.get("user_id") else None
#     if current.role != "admin" and current.user_id != owner_str:
#         raise HTTPException(status_code=403, detail="forbidden")

#     updated: dict[str, str] = {}
#     for kind, up in {"station": station, "mdb": mdb, "charger": charger, "device": device}.items():
#         if up is None:
#             continue
#         url = await save_station_image(station_id, kind, up)
#         updated[kind] = url

#     if not updated:
#         return {"updated": False, "images": doc.get("images", {})}

#     images = doc.get("images", {})
#     images.update(updated)

#     station_collection.update_one(
#         {"_id": doc["_id"]},
#         {"$set": {"images": images, "updatedAt": datetime.now(timezone.utc)}}
#     )

#     return {"updated": True, "images": images}

@app.get("/owners")
async def get_owners():
    cursor = users_collection.find({"role": "owner"}, {"_id": 1, "username": 1})
    owners = [{"user_id": str(u["_id"]), "username": u["username"]} for u in cursor]

    if not owners:
        raise HTTPException(status_code=404, detail="owners not found")

    return {"owners": owners}

# stationOnOff = client1["stationsOnOff"]
# class StationIdsIn(BaseModel):
#     station_ids: List[str]

# def _latest_onoff_bool(sid: str) -> bool:
#     coll = stationOnOff.get_collection(str(sid))
#     doc = coll.find_one(sort=[("payload.timestamp", -1), ("_id", -1)])  # ← เอาเอกสารล่าสุดจริง ๆ
#     if not doc:
#         return False
#     payload = doc.get("payload", {})
#     val = payload.get("value", 0)
#     # map เป็น bool ให้ชัด
#     if isinstance(val, bool):
#         return val
#     try:
#         return bool(int(val))
#     except Exception:
#         return False

# @app.post("/station-onoff/bulk")
# def get_station_onoff_bulk(body: StationIdsIn):
#     out: Dict[str, bool] = {}
#     for sid in body.station_ids:
#         try:
#             out[sid] = _latest_onoff_bool(sid)
#         except Exception:
#             out[sid] = False
#     return {"status": out}

async def latest_onoff(sn: str) -> Dict[str, Any]:
    """
    อ่านเอกสารล่าสุดจาก stationsOnOff/<sn>
    โครงสร้าง doc:
      { payload: { value: 0/1, timestamp: "ISO-UTC" }, ... }
    """
    try:
        coll = charger_onoff.get_collection(sn)
        
        # ใช้ await สำหรับ Motor (async)
        cursor = coll.find().sort([("payload.timestamp", -1), ("_id", -1)]).limit(1)
        docs = await cursor.to_list(length=1)
        doc = docs[0] if docs else None
        
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
    
    except Exception as e:
        print(f"[latest_onoff] Error for SN {sn}: {e}")
        return {"status": None, "statusAt": None}
    
@app.get("/charger-onoff/{sn}")
async def station_onoff_latest(sn: str, current: UserClaims = Depends(get_current_user)):
    data = await latest_onoff(str(sn))  # เพิ่ม await
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
        
# ------------------------------------ new station
# ----- Charger Models -----
class ChargerCreate(BaseModel):
    chargeBoxID: str
    chargerNo: Optional[int] = None  # Auto-generated if not provided
    brand: str
    model: str
    SN: str
    WO: str
    power: Optional[str] = ""
    PLCFirmware: str
    PIFirmware: str
    RTFirmware: str
    commissioningDate: Optional[str] = None
    warrantyYears: Optional[int] = 1
    numberOfCables: Optional[int] = 1
    is_active: Optional[bool] = True  # NEW: Charger active status

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
    is_active: Optional[bool] = None  # NEW: Charger active status

class ChargerOut(BaseModel):
    id: str
    station_id: str
    chargeBoxID: str
    chargerNo: Optional[int] = None
    brand: str
    model: str
    SN: str
    WO: str
    power: Optional[str] = ""
    PLCFirmware: str
    PIFirmware: str
    RTFirmware: str
    commissioningDate: Optional[str] = None
    warrantyYears: Optional[int] = 1
    numberOfCables: Optional[int] = 1
    is_active: Optional[bool] = True  # NEW: Charger active status
    status: Optional[bool] = None
    images: Optional[dict] = None
    createdAt: Optional[datetime] = None

# ----- Station Models -----
class StationCreate(BaseModel):
    station_id: str
    station_name: str
    user_id: Optional[str] = None
    owner: Optional[str] = None  # username (fallback)
    is_active: Optional[bool] = True

class StationUpdate(BaseModel):
    station_name: Optional[str] = None
    is_active: Optional[bool] = None
    user_id: Optional[str] = None

class StationOut(BaseModel):
    id: str
    station_id: str
    station_name: str
    user_id: str
    username: Optional[str] = None
    is_active: bool
    status: Optional[bool] = None
    stationImage: Optional[str] = None
    chargers: List[ChargerOut] = []
    createdAt: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.astimezone(ZoneInfo("Asia/Bangkok")).isoformat()
        }

# ----- Combined Create (Station + Chargers) -----
class StationWithChargersCreate(BaseModel):
    """For creating Station with Chargers in one request"""
    station: StationCreate
    chargers: List[ChargerCreate]

class StationWithChargersOut(BaseModel):
    station: StationOut
    chargers: List[ChargerOut]

# ============================================================
# Helper Functions
# ============================================================

def to_object_id(s: str) -> ObjectId:
    """Convert string to ObjectId or raise 400"""
    try:
        return ObjectId(s)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid ID format")


def get_username_by_user_id(user_id: ObjectId) -> Optional[str]:
    """Get username from user_id"""
    user = users_collection.find_one({"_id": user_id}, {"username": 1})
    return user.get("username") if user else None


def get_charger_status(station_id: str, chargeBoxID: str) -> bool:
    """Get latest Charger status from stationOnOff"""
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
    """Get latest Station status"""
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
    """Get next chargerNo for a station"""
    max_charger = charger_collection.find_one(
        {"station_id": station_id},
        sort=[("chargerNo", -1)]
    )
    if max_charger and max_charger.get("chargerNo"):
        return max_charger["chargerNo"] + 1
    return 1


def format_charger(doc: dict, include_status: bool = True) -> ChargerOut:
    """Convert charger document to ChargerOut"""
    charger_id = str(doc["_id"])
    station_id = doc.get("station_id", "")
    
    status = None
    if include_status:
        status = get_charger_status(station_id, doc.get("chargeBoxID", ""))
    
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
        status=status,
        images=doc.get("images", {}),
        createdAt=doc.get("createdAt"),
    )

def format_station_with_chargers(station_doc: dict, charger_docs: List[dict]) -> StationOut:
    """Convert station document + chargers to StationOut"""
    station_id = station_doc.get("station_id", "")
    user_id = station_doc.get("user_id")
    user_id_str = str(user_id) if user_id else ""
    
    # Get username
    username = None
    if user_id:
        username = get_username_by_user_id(user_id if isinstance(user_id, ObjectId) else to_object_id(user_id))
    
    # Get status
    status = get_station_status(station_id)
    
    # Format chargers
    chargers = [format_charger(c) for c in charger_docs]
    
    return StationOut(
        id=str(station_doc["_id"]),
        station_id=station_id,
        station_name=station_doc.get("station_name", ""),
        user_id=user_id_str,
        username=username,
        is_active=bool(station_doc.get("is_active", False)),
        status=status,
        stationImage=station_doc.get("images", {}).get("station"),
        chargers=chargers,
        createdAt=station_doc.get("createdAt"),
    )


# ============================================================
# Image Upload Helpers
# ============================================================

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 3 * 1024 * 1024  # 3 MB


def _ensure_dir(p: pathlib.Path):
    p.mkdir(parents=True, exist_ok=True)


async def save_image(folder: str, item_id: str, kind: str, upload: UploadFile) -> str:
    """
    Save image and return URL
    folder: "stations" or "chargers"
    """
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


# ---------------------------------------------------------
# GET /all-stations/ - Get all Stations with Chargers
# ---------------------------------------------------------
# @app.get("/all-stations/")
# def get_all_stations(
#     # current: UserClaims = Depends(get_current_user)
# ):
#     """Get all Stations with Chargers (nested)"""
    
#     # TODO: Add filter by role
#     # if current.role == "admin":
#     #     match_query = {}
#     # else:
#     #     match_query = {"user_id": to_object_id(current.user_id)}
    
#     match_query = {}
    
#     # Get stations
#     stations_cursor = station_collection.find(match_query)
    
#     result = []
#     for station_doc in stations_cursor:
#         station_id = station_doc.get("station_id")
        
#         # Get chargers for this station (sorted by chargerNo)
#         chargers_cursor = charger_collection.find({"station_id": station_id}).sort("chargerNo", 1)
#         charger_docs = list(chargers_cursor)
        
#         # Format and add to result
#         station_out = format_station_with_chargers(station_doc, charger_docs)
#         result.append(station_out.dict())
    
#     return {"stations": result}

def to_object_id_safe(s: str):
    """Convert string to ObjectId, return original string if failed"""
    try:
        return ObjectId(s)
    except:
        return s
    
@app.get("/all-stations/")
def get_all_stations(
    current: UserClaims = Depends(get_current_user)
):
    """Get all Stations with Chargers (nested)"""
    
    # Debug
    print(f"=== DEBUG ===")
    print(f"user_id: {current.user_id}, role: {current.role}")
    
    # Filter by role
    if current.role == "admin":
        match_query = {}
    elif current.role == "technician":
        if current.station_ids and len(current.station_ids) > 0:
            match_query = {"station_id": {"$in": current.station_ids}}
        else:
            return {"stations": []}
    else:
        # Owner - ลองทั้ง string และ ObjectId
        match_query = {
            "$or": [
                {"user_id": current.user_id},
                {"user_id": to_object_id_safe(current.user_id)}
            ]
        }
    
    print(f"match_query: {match_query}")
    
    # Get stations
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
# POST /add_stations/ - Create Station with Chargers
# ---------------------------------------------------------
@app.post("/add_stations/", status_code=201)
def create_station_with_chargers(
    body: StationWithChargersCreate,
    # current: UserClaims = Depends(get_current_user)
):
    """Create new Station with Chargers"""
    
    station_data = body.station
    chargers_data = body.chargers
    
    # Validate station_id
    station_id = station_data.station_id.strip()
    if not station_id:
        raise HTTPException(status_code=400, detail="station_id is required")
    
    # Check duplicate station_id
    if station_collection.find_one({"station_id": station_id}):
        raise HTTPException(status_code=409, detail="station_id already exists")
    
    # Resolve owner
    owner_oid = None
    if station_data.user_id:
        owner_oid = to_object_id(station_data.user_id)
    elif station_data.owner:
        user = users_collection.find_one({"username": station_data.owner.strip()}, {"_id": 1})
        if not user:
            raise HTTPException(status_code=400, detail="Invalid owner username")
        owner_oid = user["_id"]
    # else:
    #     owner_oid = to_object_id(current.user_id)
    
    now = datetime.now(timezone.utc)
    
    # 1) Insert Station
    station_doc = {
        "station_id": station_id,
        "station_name": station_data.station_name.strip(),
        "user_id": owner_oid,
        "is_active": station_data.is_active if station_data.is_active is not None else True,
        "images": {},
        "createdAt": now,
    }
    
    try:
        station_result = station_collection.insert_one(station_doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="station_id already exists")
    
    # 2) Insert Chargers
    created_chargers = []
    for idx, charger in enumerate(chargers_data):
        # Use provided chargerNo or auto-generate
        charger_no = charger.chargerNo if charger.chargerNo else idx + 1
        
        charger_doc = {
            "station_id": station_id,
            "chargeBoxID": charger.chargeBoxID.strip(),
            "chargerNo": charger_no,
            "brand": charger.brand.strip(),
            "model": charger.model.strip(),
            "SN": charger.SN.strip(),
            "WO": charger.WO.strip(),
            "power": charger.power.strip() if charger.power else "",
            "PLCFirmware": charger.PLCFirmware.strip(),
            "PIFirmware": charger.PIFirmware.strip(),
            "RTFirmware": charger.RTFirmware.strip(),
            "commissioningDate": charger.commissioningDate,
            "warrantyYears": charger.warrantyYears if charger.warrantyYears else 1,
            "numberOfCables": charger.numberOfCables if charger.numberOfCables else 1,
            "is_active": charger.is_active if charger.is_active is not None else True,
            "images": {},
            "createdAt": now,
        }
        charger_result = charger_collection.insert_one(charger_doc)
        charger_doc["_id"] = charger_result.inserted_id
        created_chargers.append(charger_doc)
    
    # 3) Format response
    station_doc["_id"] = station_result.inserted_id
    station_out = format_station_with_chargers(station_doc, created_chargers)
    
    return {
        "id": str(station_result.inserted_id),
        "station": station_out.dict(),
        "chargers": [format_charger(c, include_status=False).dict() for c in created_chargers],
    }

# ---------------------------------------------------------
# PATCH /update_stations/{id} - Update Station
# ---------------------------------------------------------
@app.patch("/update_stations/{id}")
def update_station(
    id: str,
    body: StationUpdate,
    # current: UserClaims = Depends(get_current_user)
):
    """Update Station data (not including Chargers)"""
    
    oid = to_object_id(id)
    station = station_collection.find_one({"_id": oid})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # TODO: Check permission
    # if current.role != "admin" and str(station.get("user_id")) != current.user_id:
    #     raise HTTPException(status_code=403, detail="Forbidden")
    
    update_data = {}
    if body.station_name is not None:
        update_data["station_name"] = body.station_name.strip()
    if body.is_active is not None:
        update_data["is_active"] = body.is_active
    
    # เมื่อเปลี่ยน user_id ให้ดึง username มา update ด้วย
    if body.user_id is not None:
        new_user_oid = to_object_id(body.user_id)
        update_data["user_id"] = new_user_oid
        
        # ดึง username จาก users collection
        user = users_collection.find_one({"_id": new_user_oid})
        if user:
            update_data["username"] = user.get("username", "")
        else:
            raise HTTPException(status_code=400, detail="User not found")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    station_collection.update_one({"_id": oid}, {"$set": update_data})
    
    # Return updated station
    updated = station_collection.find_one({"_id": oid})
    chargers = list(charger_collection.find({"station_id": updated["station_id"]}).sort("chargerNo", 1))
    
    return format_station_with_chargers(updated, chargers).dict()

# ---------------------------------------------------------
# DELETE /delete_stations/{id} - Delete Station and all Chargers
# ---------------------------------------------------------
@app.delete("/delete_stations/{id}", status_code=204)
def delete_station(
    id: str,
    # current: UserClaims = Depends(get_current_user)
):
    """Delete Station and all related Chargers"""
    
    oid = to_object_id(id)
    station = station_collection.find_one({"_id": oid})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # TODO: Check permission
    
    station_id = station["station_id"]
    
    # Delete all chargers of this station
    charger_collection.delete_many({"station_id": station_id})
    
    # Delete station
    station_collection.delete_one({"_id": oid})
    
    return Response(status_code=204)


# ---------------------------------------------------------
# POST /add_charger/{station_id} - Add Charger to Station
# ---------------------------------------------------------
@app.post("/add_charger/{station_id}", status_code=201)
def add_charger_to_station(
    station_id: str,
    body: ChargerCreate,
    # current: UserClaims = Depends(get_current_user)
):
    """Add new Charger to existing Station"""
    
    # Check if station exists
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # TODO: Check permission
    
    # Get next chargerNo if not provided
    charger_no = body.chargerNo if body.chargerNo else get_next_charger_no(station_id)
    
    charger_doc = {
        "station_id": station_id,
        "chargeBoxID": body.chargeBoxID.strip(),
        "chargerNo": charger_no,
        "brand": body.brand.strip(),
        "model": body.model.strip(),
        "SN": body.SN.strip(),
        "WO": body.WO.strip(),
        "power": body.power.strip() if body.power else "",
        "PLCFirmware": body.PLCFirmware.strip(),
        "PIFirmware": body.PIFirmware.strip(),
        "RTFirmware": body.RTFirmware.strip(),
        "commissioningDate": body.commissioningDate,
        "warrantyYears": body.warrantyYears if body.warrantyYears else 1,
        "numberOfCables": body.numberOfCables if body.numberOfCables else 1,
        "is_active": body.is_active if body.is_active is not None else True,
        "images": {},
        "createdAt": datetime.now(timezone.utc),
    }
    
    result = charger_collection.insert_one(charger_doc)
    charger_doc["_id"] = result.inserted_id
    
    return format_charger(charger_doc, include_status=False).dict()


# ---------------------------------------------------------
# PATCH /update_charger/{id} - Update Charger
# ---------------------------------------------------------
@app.patch("/update_charger/{id}")
def update_charger(
    id: str,
    body: ChargerUpdate,
    # current: UserClaims = Depends(get_current_user)
):
    """Update Charger data"""
    
    oid = to_object_id(id)
    charger = charger_collection.find_one({"_id": oid})
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    # TODO: Check permission via station owner
    # station = stations_collection.find_one({"station_id": charger["station_id"]})
    # if current.role != "admin" and str(station.get("user_id")) != current.user_id:
    #     raise HTTPException(status_code=403, detail="Forbidden")
    
    update_data = {}
    
    # String fields
    for field in ["chargeBoxID", "brand", "model", "SN", "WO", "power", "PLCFirmware", "PIFirmware", "RTFirmware", "commissioningDate"]:
        value = getattr(body, field, None)
        if value is not None:
            update_data[field] = value.strip() if isinstance(value, str) else value
    
    # Integer fields
    for field in ["chargerNo", "warrantyYears", "numberOfCables"]:
        value = getattr(body, field, None)
        if value is not None:
            update_data[field] = value
    
    # Boolean fields
    if body.is_active is not None:
        update_data["is_active"] = body.is_active
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_data["updatedAt"] = datetime.now(timezone.utc)
    
    charger_collection.update_one({"_id": oid}, {"$set": update_data})
    
    updated = charger_collection.find_one({"_id": oid})
    return format_charger(updated).dict()


# ---------------------------------------------------------
# DELETE /delete_charger/{id} - Delete Charger
# ---------------------------------------------------------
@app.delete("/delete_charger/{id}", status_code=204)
def delete_charger(
    id: str,
    # current: UserClaims = Depends(get_current_user)
):
    """Delete Charger"""
    
    oid = to_object_id(id)
    charger = charger_collection.find_one({"_id": oid})
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    # TODO: Check permission
    
    charger_collection.delete_one({"_id": oid})
    return Response(status_code=204)


# ---------------------------------------------------------
# POST /stations/{station_id}/upload-image - Upload Station image
# ---------------------------------------------------------
@app.post("/stations/{station_id}/upload-image")
async def upload_station_image(
    station_id: str,
    station: Optional[UploadFile] = File(None),
    # current: UserClaims = Depends(get_current_user)
):
    """Upload image for Station"""
    
    doc = station_collection.find_one({"station_id": station_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # TODO: Check permission
    
    if not station:
        return {"updated": False, "images": doc.get("images", {})}
    
    url = await save_image("stations", station_id, "station", station)
    
    images = doc.get("images", {})
    images["station"] = url
    
    station_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"images": images, "updatedAt": datetime.now(timezone.utc)}}
    )
    
    return {"updated": True, "images": images}


# ---------------------------------------------------------
# POST /chargers/{charger_id}/upload-images - Upload Charger images
# ---------------------------------------------------------
@app.post("/chargers/{charger_id}/upload-images")
async def upload_charger_images(
    charger_id: str,
    mdb: Optional[UploadFile] = File(None),
    charger: Optional[UploadFile] = File(None),
    device: Optional[UploadFile] = File(None),
    # current: UserClaims = Depends(get_current_user)
):
    """Upload images for Charger (mdb, charger, device)"""
    
    oid = to_object_id(charger_id)
    doc = charger_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    # TODO: Check permission
    
    updated_images = {}
    for kind, upload in {"mdb": mdb, "charger": charger, "device": device}.items():
        if upload is None:
            continue
        url = await save_image("chargers", charger_id, kind, upload)
        updated_images[kind] = url
    
    if not updated_images:
        return {"updated": False, "images": doc.get("images", {})}
    
    images = doc.get("images", {})
    images.update(updated_images)
    
    charger_collection.update_one(
        {"_id": oid},
        {"$set": {"images": images, "updatedAt": datetime.now(timezone.utc)}}
    )
    
    return {"updated": True, "images": images}


# ---------------------------------------------------------
# GET /station/{station_id} - Get single Station with Chargers
# ---------------------------------------------------------
@app.get("/station/{station_id}")
def get_station(
    station_id: str,
    # current: UserClaims = Depends(get_current_user)
):
    """Get single Station with Chargers"""
    
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    chargers = list(charger_collection.find({"station_id": station_id}).sort("chargerNo", 1))
    
    return format_station_with_chargers(station, chargers).dict()


# ---------------------------------------------------------
# GET /chargers/{station_id} - Get Chargers of Station
# ---------------------------------------------------------
@app.get("/chargers/{station_id}")
def get_chargers_by_station(
    station_id: str,
    # current: UserClaims = Depends(get_current_user)
):
    """Get all Chargers of a Station"""
    
    chargers = list(charger_collection.find({"station_id": station_id}).sort("chargerNo", 1))
    return {"chargers": [format_charger(c).dict() for c in chargers]}


# -------------------------------------------------- PMReport (charger)   
#     
# def get_pmreport_collection_for(station_id: str):
#     _validate_station_id(station_id)
#     coll = PMReportDB.get_collection(str(station_id))
#     return coll

# def _compute_next_pm_date_str(pm_date_str: str | None) -> str | None:
#     if not pm_date_str:
#         return None
#     # pm_date เก็บเป็น "YYYY-MM-DD"
#     try:
#         d = datetime.fromisoformat(pm_date_str).date()  # date object
#     except ValueError:
#         return None
#     next_d = d + relativedelta(months=+6)              # ← ตรง 6 เดือน
#     return next_d.isoformat()     

# # --- helper: เอา pm_date ล่าสุดจาก PMReportDB/<station_id> ---
# async def _latest_pm_date_from_pmreport(station_id: str) -> dict | None:
#     if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
#         raise HTTPException(status_code=400, detail="Bad station_id")
#     coll = PMReportDB.get_collection(str(station_id))

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
#         {"$project": {"_id": 1, "pm_date": 1, "timestamp": 1}}
#     ]

#     cursor = coll.aggregate(pipeline)
#     docs = await cursor.to_list(length=1)
#     return docs[0] if docs else None

# async def _pmreport_latest_core(station_id: str, current: UserClaims):
#     # --- auth & validate ---
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
#     if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
#         raise HTTPException(status_code=400, detail="Bad station_id")

#     # 1) ดึงจาก stations
#     st = station_collection.find_one(
#         {"station_id": station_id},
#         {"_id": 1, "PIFirmware": 1, "PLCFirmware": 1, "RTFirmware": 1, "timestamp": 1, "updatedAt": 1}
#     )
#     if not st:
#         raise HTTPException(status_code=404, detail="Station not found")

#     pi_fw  = st.get("PIFirmware")
#     plc_fw = st.get("PLCFirmware")
#     rt_fw  = st.get("RTFirmware")

#     # 2) ดึง pm_date ล่าสุดจาก PMReportDB
#     pm_latest = await _latest_pm_date_from_pmreport(station_id)
#     pm_date = pm_latest.get("pm_date") if pm_latest else None

#     # เวลา: ใช้ timestamp จาก pm report ถ้ามี ไม่งั้น fallback ไปของสถานี
#     ts_raw = (pm_latest.get("timestamp") if pm_latest else None) or st.get("timestamp") or st.get("updatedAt")

#     ts_dt = (parse_iso_any_tz(ts_raw) if isinstance(ts_raw, str)
#              else (ts_raw if isinstance(ts_raw, datetime) else None))
#     ts_utc = ts_dt.astimezone(ZoneInfo("UTC")).isoformat() if ts_dt else None
#     ts_th  = ts_dt.astimezone(ZoneInfo("Asia/Bangkok")).isoformat() if ts_dt else None

#     pm_next_date = _compute_next_pm_date_str(pm_date)

#     return {
#         "_id": str(st["_id"]),
#         "pi_firmware": pi_fw,
#         "plc_firmware": plc_fw,
#         "rt_firmware": rt_fw,
#         "pm_date": pm_date,              # ← มาจาก PMReportDB
#         "pm_next_date": pm_next_date, 
#         "timestamp": ts_raw,             # pmreport.timestamp ถ้ามี
#         "timestamp_utc": ts_utc,
#         "timestamp_th": ts_th,
#         "source": "stations + PMReportDB",  # เผื่อ debug
#     }

# @app.get("/pmreport/get")
# async def pmreport_get(station_id: str, report_id: str, current: UserClaims = Depends(get_current_user)):
#     coll = get_pmreport_collection_for(station_id)
#     doc = await coll.find_one({"_id": ObjectId(report_id)})
#     if not doc:
#         raise HTTPException(status_code=404, detail="not found")

#     doc["_id"] = str(doc["_id"])
#     return doc

# @app.get("/pmreport/list")
# async def pmreport_list(
#     station_id: str = Query(...),
#     page: int = Query(1, ge=1),
#     pageSize: int = Query(20, ge=1, le=100),
# ):
#     coll = get_pmreport_collection_for(station_id)
#     skip = (page - 1) * pageSize

#     cursor = coll.find({}, {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector" : 1,"side" : 1, "createdAt": 1}).sort(
#         [("createdAt", -1), ("_id", -1)]
#     ).skip(skip).limit(pageSize)
#     items_raw = await cursor.to_list(length=pageSize)
#     total = await coll.count_documents({})

#     # --- ดึงไฟล์จาก PMReportURL โดย map ด้วย pm_date (string) ---
#     pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
#     urls_coll = get_pmurl_coll_upload(station_id)
#     url_by_day: dict[str, str] = {}

#     if pm_dates:
#         ucur = urls_coll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
#         url_docs = await ucur.to_list(length=10_000)
#         for u in url_docs:
#             day = u.get("pm_date")
#             first_url = (u.get("urls") or [None])[0]
#             if day and first_url and day not in url_by_day:
#                 url_by_day[day] = first_url

#     items = [{
#         "id": str(it["_id"]),
#         "issue_id": it.get("issue_id"),
#         "doc_name": it.get("doc_name"),
#         "pm_date": it.get("pm_date"),
#         "inspector": it.get("inspector"),
#         "side" : it.get("side"),
#         "createdAt": _ensure_utc_iso(it.get("createdAt")),
#         "file_url": url_by_day.get(it.get("pm_date") or "", ""),
#     } for it in items_raw]

#     pm_date_arr = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
#     return {"items": items, "pm_date": pm_date_arr, "page": page, "pageSize": pageSize, "total": total}

# # เดิม (path param) → เปลี่ยนให้เรียก helper
# @app.get("/pmreport/latest/{station_id}")
# async def pmreport_latest(station_id: str, current: UserClaims = Depends(get_current_user)):
#     return await _pmreport_latest_core(station_id, current)

# # ใหม่ (query param) → ให้รองรับรูปแบบ /pmreport/latest/?station_id=...
# @app.get("/pmreport/latest/")
# async def pmreport_latest_q(
#     station_id: str = Query(..., description="เช่น Klongluang3"),
#     current: UserClaims = Depends(get_current_user),
# ):
#     return await _pmreport_latest_core(station_id, current)

# class PMMeasureRow(BaseModel):
#     value: str = ""
#     unit: str = "V"

# class PMMeasures(BaseModel):
#     m16: Dict[str, PMMeasureRow] = Field(default_factory=dict)  # L1-L2, L2-L3, ...
#     cp: PMMeasureRow = PMMeasureRow()

# class PMRowPF(BaseModel):
#     pf: Optional[Literal["PASS","FAIL","NA",""]] = ""
#     remark: Optional[str] = ""

# class PMSubmitIn(BaseModel):
#     side: Literal["pre", "post"]
#     station_id: str
#     job: dict
#     measures_pre: dict
#     rows_pre: Optional[dict[str, Any]] = None
#     pm_date:str
#     issue_id: Optional[str] = None
#     doc_name: Optional[str] = None 
#     inspector: Optional[str] = None 

# async def _latest_issue_id_anywhere(
#     station_id: str,
#     pm_type: str,
#     d: date,
#     source: Literal["charger", "mdb", "ccb", "cbbox", "station"] = "charger",
# ) -> str | None:
#     """
#     source = "pm"    -> ใช้ get_pmreport_collection_for + get_pmurl_coll_upload
#     source = "mdbpm" -> ใช้ get_mdbpmreport_collection_for + get_mdbpmurl_coll_upload
#     """
#     if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
#         raise HTTPException(status_code=400, detail="Bad station_id")

#     yymm = f"{d.year % 100:02d}{d.month:02d}"
#     prefix = f"PM-{pm_type}-{yymm}-"

#     if source == "charger":
#         rep_coll = get_pmreport_collection_for(station_id)
#         url_coll = get_pmurl_coll_upload(station_id)
#     elif source == "mdb": 
#         rep_coll = get_mdbpmreport_collection_for(station_id)
#         url_coll = get_mdbpmurl_coll_upload(station_id)
#     elif source == "ccb": 
#         rep_coll = get_ccbpmreport_collection_for(station_id)
#         url_coll = get_ccbpmurl_coll_upload(station_id)
#     elif source == "cbbox": 
#         rep_coll = get_cbboxpmreport_collection_for(station_id)
#         url_coll = get_cbboxpmurl_coll_upload(station_id)
#     elif source == "station": 
#         rep_coll = get_stationpmreport_collection_for(station_id)
#         url_coll = get_stationpmurl_coll_upload(station_id)

#     pipeline = [
#         {"$match": {"issue_id": {"$regex": f"^{prefix}\\d+$"}}},
#         {"$project": {"issue_id": 1}},
#     ]

#     rep_docs = await rep_coll.aggregate(pipeline).to_list(length=1000)
#     url_docs = await url_coll.aggregate(pipeline).to_list(length=1000)

#     best = None
#     best_n = 0

#     for ddoc in rep_docs + url_docs:
#         s = ddoc.get("issue_id") or ""
#         m = re.search(r"(\d+)$", s)
#         if not m:
#             continue
#         n = int(m.group(1))
#         if n > best_n:
#             best_n = n
#             best = s

#     return best

# async def _next_issue_id(db, station_id: str, pm_type: str, d, pad: int = 2) -> str:
#     yymm = f"{d.year % 100:02d}{d.month:02d}"
#     seq = await db.pm_sequences.find_one_and_update(
#         {"station_id": station_id, "pm_type": pm_type, "yymm": yymm},
#         {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
#         upsert=True,
#         return_document=ReturnDocument.AFTER,
#     )
#     return f"PM-{pm_type}-{yymm}-{int(seq['n']):0{pad}d}"

# @app.get("/pmreport/preview-issueid")
# async def pmreport_preview_issueid(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """
#     ดู issue_id ถัดไป (PM-CG-YYMM-XX) โดยไม่ออกเลขจริง
#     ใช้หาเลขไปโชว์บนฟอร์มเฉย ๆ
#     """
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     pm_type = "CG"

#     latest = await _latest_issue_id_anywhere(station_id, pm_type, d)

#     yymm = f"{d.year % 100:02d}{d.month:02d}"
#     prefix = f"PM-{pm_type}-{yymm}-"

#     if not latest:
#         next_issue = f"{prefix}01"
#     else:
#         m = re.search(r"(\d+)$", latest)
#         cur = int(m.group(1)) if m else 0
#         next_issue = f"{prefix}{cur+1:02d}"

#     return {"issue_id": next_issue}

# async def _latest_doc_name_from_pmreport(
#     station_id: str,
#     pm_date: str,
#     source: Literal["charger", "mdb", "ccb", "cbbox", "station"] = "charger",
# ) -> dict | None:
#     """
#     ดึง doc_name ล่าสุดจาก PMReportDB/<station_id> หรือ MDBPMReportDB/<station_id>
#     ที่เป็นปีเดียวกับ pm_date

#     source = "pm"    -> ใช้ PMReportDB
#     source = "mdbpm" -> ใช้ MDBPMReportDB
#     """
#     if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
#         raise HTTPException(status_code=400, detail="Bad station_id")
    
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#         year = d.year
#     except ValueError:
#         return None
    
#     # เลือก DB ตาม source
#     if source == "charger":
#         coll = PMReportDB.get_collection(str(station_id))
#     elif source == "mdb": 
#         coll = MDBPMReportDB.get_collection(str(station_id))
#     elif source == "ccb": 
#         coll = CCBPMReportDB.get_collection(str(station_id))
#     elif source == "cbbox": 
#         coll = CBBOXPMReportDB.get_collection(str(station_id))
#     elif source == "station": 
#         coll = stationPMReportDB.get_collection(str(station_id))
    
#     pipeline = [
#         {
#             "$match": {
#                 "doc_name": {"$regex": f"^{station_id}_\\d+/{year}$"}
#             }
#         },
#         {"$sort": {"_id": -1}},
#         {"$limit": 1},
#         {"$project": {"_id": 1, "doc_name": 1}}
#     ]
    
#     cursor = coll.aggregate(pipeline)
#     docs = await cursor.to_list(length=1)
#     return docs[0] if docs else None

# async def _latest_doc_name_anywhere(
#     station_id: str,
#     year: int,
#     source: Literal["charger", "mdb", "ccb", "cbbox", "station"] = "charger",
# ) -> str | None:
#     pattern = f"^{station_id}_\\d+/{year}$"

#     # เลือก collection ตาม source
#     if source == "charger":
#         rep_coll = get_pmreport_collection_for(station_id)
#         url_coll = get_pmurl_coll_upload(station_id)
#     elif source == "mdb": 
#         rep_coll = get_mdbpmreport_collection_for(station_id)
#         url_coll = get_mdbpmurl_coll_upload(station_id)
#     elif source == "ccb": 
#         rep_coll = get_ccbpmreport_collection_for(station_id)
#         url_coll = get_ccbpmurl_coll_upload(station_id)
#     elif source == "cbbox": 
#         rep_coll = get_cbboxpmreport_collection_for(station_id)
#         url_coll = get_cbboxpmurl_coll_upload(station_id)
#     elif source == "station": 
#         rep_coll = get_stationpmreport_collection_for(station_id)
#         url_coll = get_stationpmurl_coll_upload(station_id)

#     pipeline = [
#         {"$match": {"doc_name": {"$regex": pattern}}},
#         {"$project": {"doc_name": 1}},
#     ]

#     rep_docs = await rep_coll.aggregate(pipeline).to_list(length=1000)
#     url_docs = await url_coll.aggregate(pipeline).to_list(length=1000)

#     best_seq = 0
#     best_name = None

#     for d in rep_docs + url_docs:
#         name = d.get("doc_name") or ""
#         m = re.search(r"_(\d+)/\d{4}$", name)
#         if not m:
#             continue
#         seq = int(m.group(1))
#         if seq > best_seq:
#             best_seq = seq
#             best_name = name

#     return best_name

# @app.get("/pmreport/latest-docname")
# async def pmreport_latest_docname(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """
#     ดึง doc_name ล่าสุดของสถานี (ปีเดียวกับ pm_date)
#     เพื่อใช้คำนวณเลขถัดไปที่ frontend
#     """
#     # auth ถ้าต้องการ
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
    
#     latest = await _latest_doc_name_from_pmreport(station_id, pm_date)
    
#     return {
#         "doc_name": latest.get("doc_name") if latest else None,
#         "station_id": station_id,
#         "pm_date": pm_date
#     }

# async def _next_year_seq(
#     db,
#     station_id: str,
#     d: date,
#     kind: Literal["pm", "cm"] = "pm",
#     pm_type: str | None = None,
# ) -> int:
#     """
#     ออกเลขลำดับรายปี ต่อ station_id + (pm_type) + year

#     PM: แยกตาม station_id + pm_type + year
#         เช่น Klongluang3 + CG + 2025 → 1, 2, 3, ...

#     CM: แยกตาม station_id + year อย่างเดียว
#         เช่น Klongluang3 + 2025 → 1, 2, 3, ...
#     """
#     year = d.year
#     seq = await db.pm_year_sequences.find_one_and_update(
#         {"station_id": station_id, "pm_type": pm_type, "year": year},
#         {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
#         upsert=True,
#         return_document=ReturnDocument.AFTER,
#     )
#     return int(seq["n"])

# @app.get("/pmreport/preview-docname")
# async def preview_docname(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     year = d.year

#     latest = await _latest_doc_name_anywhere(station_id, year)

#     if not latest:
#         next_doc = f"{station_id}_1/{year}"
#     else:
#         import re
#         m = re.search(r"_(\d+)/\d{4}$", latest)
#         current_num = int(m.group(1)) if m else 0
#         next_doc = f"{station_id}_{current_num + 1}/{year}"

#     return {"doc_name": next_doc}

# @app.post("/pmreport/pre/submit")
# async def pmreport_submit(body: PMSubmitIn, current: UserClaims = Depends(get_current_user)):
#     station_id = body.station_id.strip()
#     coll = get_pmreport_collection_for(station_id)
#     db = coll.database

#     pm_type = str(body.job.get("pm_type") or "CG").upper()
#     body.job["pm_type"] = pm_type

#     url_coll = get_pmurl_coll_upload(station_id)

#     try:
#         d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     client_issue = body.issue_id
#     issue_id: str | None = None    

#     if client_issue:
#         yymm = f"{d.year % 100:02d}{d.month:02d}"
#         prefix = f"PM-{pm_type}-{yymm}-"
#         valid_fmt = client_issue.startswith(prefix)
#         rep_exists = await coll.find_one({"station_id": station_id, "issue_id": client_issue})
#         url_exists = await url_coll.find_one({"issue_id": client_issue})
#         unique = not (rep_exists or url_exists)

#         if valid_fmt and unique:
#             issue_id = client_issue
    
#     if not issue_id:
#         while True:
#             candidate = await _next_issue_id(db, station_id, pm_type, d, pad=2)
#             rep_exists = await coll.find_one({"issue_id": candidate})
#             url_exists = await url_coll.find_one({"issue_id": candidate})
#             if not rep_exists and not url_exists:
#                 issue_id = candidate
#                 break

#     client_docName = body.doc_name
#     doc_name = None
#     if client_docName:
#         year = f"{d.year}"
#         prefix = f"{station_id}_"
#         valid_fmt = client_docName.startswith(prefix)

#         url_coll = get_pmurl_coll_upload(station_id)
#         rep_exists = await coll.find_one({"station_id": station_id, "doc_name": client_docName})
#         url_exists = await url_coll.find_one({"doc_name": client_docName})
#         unique = not (rep_exists or url_exists)

#         if valid_fmt and unique:
#             doc_name = client_docName
 
#     if not doc_name:
#         year_seq = await _next_year_seq(db, station_id, pm_type, d)
#         year = d.year
#         doc_name = f"{station_id}_{year_seq}/{year}"

#     inspector = body.inspector
#     doc = {
#         "station_id": station_id,
#         "doc_name": doc_name,
#         "issue_id": issue_id,
#         "job": body.job,
#         "rows_pre": body.rows_pre or {},      # 👈 เพิ่ม - เก็บ pf และ remark จากหน้า Pre
#         "measures_pre": body.measures_pre,
#         "pm_date": body.pm_date,
#         "inspector": inspector,
#         "photos_pre": {},
#         "status": "draft",
#         "side": body.side,
#         "timestamp": datetime.now(timezone.utc),
#     }
#     res = await coll.insert_one(doc)
#     return {
#         "ok": True,
#         "report_id": str(res.inserted_id),
#         "issue_id": issue_id,
#         "doc_name": doc_name,
#     }

# class PMPostIn(BaseModel):
#     report_id: str | None = None      # 👈 เพิ่ม
#     station_id: str
#     # issue_id: str | None = None
#     # job: dict
#     rows: dict
#     measures: dict
#     summary: str
#     # pm_date: str
#     # doc_name: str | None = None
#     summaryCheck: str | None = None
#     dust_filter: Dict[str, bool] | None = None
#     side: Literal["post", "after"]

# @app.post("/pmreport/submit")
# async def pmreport_submit(
#     body: PMPostIn,
#     current: UserClaims = Depends(get_current_user)
# ):
#     station_id = body.station_id.strip()
#     coll = get_pmreport_collection_for(station_id)
#     db = coll.database
#     url_coll = get_pmurl_coll_upload(station_id)

#     # pm_type = str(body.job.get("pm_type") or "CG").upper()
#     # body.job["pm_type"] = pm_type

#     # try:
#     #     d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
#     # except ValueError:
#     #     raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     # ---------- กรณี 1: มี report_id → UPDATE doc เดิม (pre+post อยู่ในตัวเดียว) ----------
#     if body.report_id:
#         try:
#             oid = ObjectId(body.report_id)
#         except InvalidId:
#             raise HTTPException(status_code=400, detail="invalid report_id")

#         existing = await coll.find_one({"_id": oid, "station_id": station_id})
#         if not existing:
#             raise HTTPException(status_code=404, detail="Report not found")

#         # reuse ค่าเดิม ไม่ gen ใหม่
#         # issue_id = existing.get("issue_id")
#         # doc_name = existing.get("doc_name")
#         # inspector = body.inspector or existing.get("inspector") or current.username

#         update_fields = {
#             # "job": body.job,
#             "rows": body.rows,
#             "measures": body.measures,          # ใช้เป็นค่าหลัง PM
#             "summary": body.summary,
#             "summaryCheck": body.summaryCheck,
#             # "pm_date": body.pm_date,
#             # "inspector": inspector,
#             "dust_filter": body.dust_filter,
#             # "doc_name": doc_name,
#             "side": "post",                     # ตอนนี้อยู่ฝั่ง post แล้ว
#             "timestamp_post": datetime.now(timezone.utc),
#         }

#         await coll.update_one({"_id": oid}, {"$set": update_fields})

#         return {
#             "ok": True,
#             "report_id": body.report_id,
#             # "issue_id": issue_id,
#             # "doc_name": doc_name,
#         }

#     doc = {
#         "station_id": station_id,
#         # "issue_id": issue_id,
#         # "job": body.job,
#         "rows": body.rows,
#         "measures": body.measures,
#         "summary": body.summary,
#         "summaryCheck": body.summaryCheck,
#         # "pm_date": body.pm_date,
#         # "inspector": inspector,
#         "dust_filter": body.dust_filter,
#         # "doc_name": doc_name,
#         "photos": {},
#         "status": "draft",
#         "side": "post",
#         "timestamp": datetime.now(timezone.utc),
#     }
#     res = await coll.insert_one(doc)
#     return {
#         "ok": True,
#         "report_id": str(res.inserted_id),
#         # "issue_id": issue_id,
#         # "doc_name": doc_name,
#     }

# # ตำแหน่งโฟลเดอร์บนเครื่องเซิร์ฟเวอร์
# UPLOADS_ROOT = os.getenv("UPLOADS_ROOT", "./uploads")
# os.makedirs(UPLOADS_ROOT, exist_ok=True)

# # เสิร์ฟไฟล์คืนให้ Frontend ผ่าน /uploads/...
# app.mount("/uploads", StaticFiles(directory=UPLOADS_ROOT, html=False), name="uploads")

# ALLOWED_EXTS = {"jpg","jpeg","png","webp","gif"}
# MAX_FILE_MB = 10

# def _safe_name(name: str) -> str:
#     # กัน path traversal และอักขระแปลก ๆ
#     base = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
#     return base[:120] or secrets.token_hex(4)

# def _ext(fname: str) -> str:
#     return (fname.rsplit(".",1)[-1].lower() if "." in fname else "")

# @app.post("/pmreport/{report_id}/pre/photos")
# async def pmreport_upload_photos(
#     report_id: str,
#     station_id: str = Form(...),
#     group: str = Form(...),                   # เช่น "g1", "g3_0", "g10_1"
#     files: list[UploadFile] = File(...),
# ):
#     # แก้ regex ให้รองรับ g1, g3_0, g10_1
#     if not re.fullmatch(r"g\d+(_\d+)?", group):
#         raise HTTPException(status_code=400, detail="Bad group key")

#     coll = get_pmreport_collection_for(station_id)
#     from bson import ObjectId
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")


#     # ยืนยันว่ารายงานนี้อยู่ใน station นี้
#     doc = await coll.find_one({"_id": oid}, {"_id":1, "station_id":1})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Report not found")
#     if doc.get("station_id") != station_id:
#         raise HTTPException(status_code=400, detail="station_id mismatch")

#     # โฟลเดอร์ปลายทาง
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "pm" / station_id / report_id / "pre" / group
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     saved = []
#     total = 0
#     for f in files:
#         ext = _ext(f.filename or "")
#         if ext not in ALLOWED_EXTS:
#             raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

#         data = await f.read()
#         total += len(data)
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         # URL สำหรับแสดงบน Frontend
#         url_path = f"/uploads/pm/{station_id}/{report_id}/pre/{group}/{fname}"
#         saved.append({
#             "filename": fname,
#             "size": len(data),
#             "url": url_path,
#             # "remark": remark or "",
#             "uploadedAt": datetime.now(timezone.utc)
#         })

#     # อัปเดตเอกสาร PMReport: push ลง photos.<group>
#     await coll.update_one(
#         {"_id": oid},
#         {"$push": {f"photos_pre.{group}": {"$each": saved}}}
#     )

#     return {"ok": True, "count": len(saved), "group": group, "files": saved}


# @app.post("/pmreport/{report_id}/post/photos")
# async def pmreport_upload_photos(
#     report_id: str,
#     station_id: str = Form(...),
#     group: str = Form(...),                   # เช่น "g1", "g3_0", "g10_1", "g11_0"
#     files: list[UploadFile] = File(...),
#     remark: str | None = Form(None),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
#     if not re.fullmatch(r"g\d+(_\d+)?", group):
#         raise HTTPException(status_code=400, detail="Bad group key")

#     coll = get_pmreport_collection_for(station_id)
#     from bson import ObjectId
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     # ยืนยันว่ารายงานนี้อยู่ใน station นี้
#     doc = await coll.find_one({"_id": oid}, {"_id":1, "station_id":1})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Report not found")
#     if doc.get("station_id") != station_id:
#         raise HTTPException(status_code=400, detail="station_id mismatch")

#     # โฟลเดอร์ปลายทาง
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "pm"  / station_id / report_id / "post" /  group
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     saved = []
#     total = 0
#     for f in files:
#         ext = _ext(f.filename or "")
#         if ext not in ALLOWED_EXTS:
#             raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

#         data = await f.read()
#         total += len(data)
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         # URL สำหรับแสดงบน Frontend
#         url_path = f"/uploads/pm/{station_id}/{report_id}/post/{group}/{fname}"
#         saved.append({
#             "filename": fname,
#             "size": len(data),
#             "url": url_path,
#             "remark": remark or "",
#             "uploadedAt": datetime.now(timezone.utc)
#         })

#     # อัปเดตเอกสาร PMReport: push ลง photos.<group>
#     await coll.update_one(
#         {"_id": oid},
#         {"$push": {f"photos.{group}": {"$each": saved}}}
#     )

#     return {"ok": True, "count": len(saved), "group": group, "files": saved}

# @app.post("/pmreport/{report_id}/finalize")
# async def pmreport_finalize(
#     report_id: str,
#     station_id: str = Form(...),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")

#     coll = get_pmreport_collection_for(station_id)
    
#     from bson import ObjectId
#     oid = ObjectId(report_id)
#     res = await coll.update_one(
#         {"_id": oid},
#         {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc)}}
#     )
#     if res.matched_count == 0:
#         raise HTTPException(status_code=404, detail="Report not found")
#     return {"ok": True}

# def parse_report_date_to_utc(s: str) -> datetime:
#     # 'YYYY-MM-DD' => ตีความเป็นต้นวันเวลาไทย แล้วแปลงเป็น UTC
#     if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
#         tz_th = ZoneInfo("Asia/Bangkok")
#         dt_th = datetime.fromisoformat(s + "T00:00:00").replace(tzinfo=tz_th)
#         return dt_th.astimezone(timezone.utc)
#     # ISO ที่ลงท้าย Z หรือมีออฟเซ็ต
#     if s.endswith("Z"):
#         return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)
#     if re.search(r"[+\-]\d{2}:\d{2}$", s):
#         return datetime.fromisoformat(s).astimezone(timezone.utc)
#     # ไม่มีโซน → ถือเป็นเวลาไทย
#     return datetime.fromisoformat(s + "+07:00").astimezone(timezone.utc)

# def get_pmurl_coll_upload(station_id: str):
#     _validate_station_id(station_id)
#     coll = PMUrlDB.get_collection(str(station_id))
#     # # เก็บวันที่แบบ Date จริงไว้ query ช่วงวันที่
#     # try:
#     #     coll.create_index([("reportDate", 1)])
#     #     coll.create_index([("createdAt", -1), ("_id", -1)])
#     # except Exception:
#     #     pass
#     return coll

# # --- เพิ่มให้รองรับ PDF ---
# ALLOWED_EXTS = {"jpg","jpeg","png","webp","gif","pdf"}  # <<-- เพิ่ม pdf
# MAX_FILE_MB = 20  # เผื่อไฟล์ใหญ่ขึ้น

# def _safe_name(name: str) -> str:
#     base = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
#     return base[:120] or secrets.token_hex(4)

# def normalize_pm_date(s: str) -> str:
#     """
#     รับได้ทั้ง:
#       - 'YYYY-MM-DD'           -> คืนเดิม
#       - ISO (มี Z/offset หรือไม่มี) -> ตีความเป็นเวลาไทย แล้วคืน date().isoformat()
#     คืนค่าเป็น 'YYYY-MM-DD' (ไม่เก็บเวลา)
#     """
#     if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
#         return s
#     # มีโซนเวลา
#     if s.endswith("Z") or re.search(r"[+\-]\d{2}:\d{2}$", s):
#         dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
#     else:
#         # ไม่มีโซนเวลา -> ถือเป็นเวลาไทย
#         dt = datetime.fromisoformat(s).replace(tzinfo=th_tz)
#     return dt.astimezone(th_tz).date().isoformat()

# @app.post("/pmurl/upload-files", status_code=201)
# async def pmurl_upload_files(
#     station_id: str = Form(...),
#     reportDate: str = Form(...),                 # "YYYY-MM-DD" หรือ ISO
#     files: list[UploadFile] = File(...),
#     issue_id: Optional[str] = Form(None),
#     doc_name: Optional[str] = Form(None),
#     inspector: Optional[str] = Form(None),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # auth (ถ้าจะเปิดใช้ก็เอา comment ออก)
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")

#     # ตรวจ/เตรียมคอลเลกชัน
#     coll = get_pmurl_coll_upload(station_id)

#     # แปลงวันที่จาก form ให้เป็น 'YYYY-MM-DD' (ไทย) ด้วย helper เดิม
#     pm_date = normalize_pm_date(reportDate)

#     # parse เป็น date object เพื่อใช้หา seq
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

#     # ชนิด PM (ตอนนี้ fix เป็น CG)
#     pm_type = "CG"

#     # -------------------------
#     # 1) ตัดสินใจเลือก issue_id
#     # -------------------------
#     rep_coll = get_pmreport_collection_for(station_id)
#     final_issue_id: str | None = None
#     client_issue = (issue_id or "").strip()

#     if client_issue:
#         yymm = f"{d.year % 100:02d}{d.month:02d}"
#         prefix = f"PM-{pm_type}-{yymm}-"
#         valid_fmt = client_issue.startswith(prefix)

#         url_exists = await coll.find_one({"issue_id": client_issue})
#         rep_exists = await rep_coll.find_one({"issue_id": client_issue})
#         unique = not (url_exists or rep_exists)

#         if valid_fmt and unique:
#             final_issue_id = client_issue

#     if not final_issue_id:
#         while True:
#             candidate = await _next_issue_id(coll.database, station_id, pm_type, d, pad=2)
#             url_exists = await coll.find_one({"issue_id": candidate})
#             rep_exists = await rep_coll.find_one({"issue_id": candidate})
#             if not url_exists and not rep_exists:
#                 final_issue_id = candidate
#                 break

#     year_seq: int | None = None

#     # พยายาม reuse year_seq จาก PMReportDB ถ้ามีอยู่แล้ว (issue_id เดียวกัน)
#     rep = await get_pmreport_collection_for(station_id).find_one(
#         {"issue_id": final_issue_id},
#         {"year_seq": 1, "pm_date": 1},
#     )
#     if rep and rep.get("year_seq") is not None:
#         year_seq = int(rep["year_seq"])

#     # ถ้าไม่มีค่า year_seq จาก PMReport → ออกใหม่จาก pm_year_sequences
#     if year_seq is None:
#         year_seq = await _next_year_seq(coll.database, station_id, pm_type, d)

#     year = d.year
#     final_doc_name: str | None = None

#     if doc_name:
#         candidate = doc_name.strip()

#         ok_format = candidate.startswith(f"{station_id}_")

#         rep_coll = get_pmreport_collection_for(station_id)
#         rep_exists = await rep_coll.find_one({"doc_name": candidate})
#         url_exists = await coll.find_one({"doc_name": candidate})
#         unique = not (rep_exists or url_exists)

#         if ok_format and unique:
#             final_doc_name = candidate

#     if not final_doc_name:
#         final_doc_name = f"{station_id}_{year_seq}/{year}"

#     doc_name = final_doc_name
#     # -------------------------
#     # 3) เซฟไฟล์ PDF ลงดิสก์
#     # -------------------------
#     subdir = pm_date  # ใช้ YYYY-MM-DD เป็นโฟลเดอร์ย่อย
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "pmurl" / station_id / subdir
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     urls: list[str] = []
#     metas: list[dict] = []
#     total_size = 0

#     for f in files:
#         # ตรวจว่าเป็น PDF เท่านั้น
#         ext = (f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext not in ALLOWED_EXTS or ext != "pdf":
#             raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

#         data = await f.read()
#         total_size += len(data)
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(
#                 status_code=413,
#                 detail=f"File too large (> {MAX_FILE_MB} MB)"
#             )

#         safe = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
#         dest = dest_dir / safe
#         with open(dest, "wb") as out:
#             out.write(data)

#         url = f"/uploads/pmurl/{station_id}/{subdir}/{safe}"
#         urls.append(url)
#         metas.append({"name": f.filename, "size": len(data)})

#     inspector_clean = (inspector or "").strip() or None
#     # -------------------------
#     # 4) บันทึกลง Mongo
#     # -------------------------
#     now = datetime.now(timezone.utc)
#     doc = {
#         "station": station_id,
#         "pm_date": pm_date,          # 'YYYY-MM-DD'
#         "issue_id": final_issue_id,  # PM-CG-YYMM-XX
#         "inspector": inspector_clean,
#         "year": year,                # 2025
#         "year_seq": year_seq,        # 1, 2, 3, ...
#         "doc_name": doc_name,            # Klongluang3_CG_1/2025
#         "urls": urls,
#         "meta": {"files": metas},
#         "source": "upload-files",
#         "createdAt": now,
#         "updatedAt": now,
#     }
#     res = await coll.insert_one(doc)

#     return {
#         "ok": True,
#         "inserted_id": str(res.inserted_id),
#         "count": len(urls),
#         "urls": urls,
#         "issue_id": final_issue_id,
#         "year_seq": year_seq,
#         "doc_name": doc_name,
#         "inspector": inspector_clean,
#     }

# @app.get("/pmurl/list")
# async def pmurl_list(
#     station_id: str = Query(...),
#     page: int = Query(1, ge=1),
#     pageSize: int = Query(20, ge=1, le=100),
# ):
#     """
#     ดึงรายการไฟล์ PM (PDF) ที่อัปโหลดไว้ต่อสถานี จาก PMUrlDB/<station_id>
#     - รองรับทั้งเอกสารที่เก็บ pm_date (string 'YYYY-MM-DD') และ reportDate (Date/ISO)
#     - เรียงจากใหม่ไปเก่า (createdAt desc, _id desc)
#     - รูปแบบผลลัพธ์ให้เหมือน /pmreport/list (มี file_url สำหรับลิงก์ตัวแรก)
#     """
#     coll = get_pmurl_coll_upload(station_id)
#     skip = (page - 1) * pageSize

#     # ดึงเฉพาะฟิลด์ที่จำเป็น
#     cursor = coll.find(
#         {},
#         {"_id": 1, "issue_id": 1, "doc_name": 1,"inspector":1, "pm_date": 1, "reportDate": 1, "urls": 1, "createdAt": 1}
#     ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

#     items_raw = await cursor.to_list(length=pageSize)
#     total = await coll.count_documents({})

#     def _pm_date_from(doc: dict) -> str | None:
#         """
#         แปลงวันที่ในเอกสารให้ได้ string 'YYYY-MM-DD'
#         - ถ้ามี pm_date (string) → คืนค่านั้น
#         - ถ้ามี reportDate (datetime/string) → แปลงเป็นวันไทย แล้ว .date().isoformat()
#         """
#         # รุ่นใหม่: เก็บเป็น pm_date (string)
#         s = doc.get("pm_date")
#         if isinstance(s, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
#             return s

#         # รุ่นเก่า: เก็บเป็น reportDate (Date/ISO)
#         rd = doc.get("reportDate")
#         if isinstance(rd, datetime):
#             return rd.astimezone(th_tz).date().isoformat()
#         if isinstance(rd, str):
#             try:
#                 dt = datetime.fromisoformat(rd.replace("Z", "+00:00"))
#             except Exception:
#                 # เผื่อไม่มีโซนเวลา → ถือเป็นเวลาไทย
#                 try:
#                     dt = datetime.fromisoformat(rd).replace(tzinfo=th_tz)
#                 except Exception:
#                     return None
#             return dt.astimezone(th_tz).date().isoformat()

#         return None

#     items = []
#     pm_date_arr = []

#     for it in items_raw:
#         pm_date_str = _pm_date_from(it)
#         if pm_date_str:
#             pm_date_arr.append(pm_date_str)

#         urls = it.get("urls") or []
#         first_url = urls[0] if urls else ""

#         items.append({
#             "id": str(it["_id"]),
#             "pm_date": pm_date_str, 
#             "inspector": it.get(("inspector")), 
#             "doc_name": it.get("doc_name"),
#             "issue_id": it.get("issue_id"),                       # 'YYYY-MM-DD' | None
#             "createdAt": _ensure_utc_iso(it.get("createdAt")),
#             "file_url": first_url,                          # ไฟล์แรก (ไว้ให้ปุ่มดาวน์โหลด)
#             "urls": urls,                                   # เผื่อฟรอนต์อยากแสดงทั้งหมด
#         })

#     return {
#         "items": items,
#         "pm_date": [d for d in pm_date_arr if d],          # ให้เหมือน /pmreport/list
#         "page": page,
#         "pageSize": pageSize,
#         "total": total,
#     }


# -----------------------------------------------------------------------------------
# new PM Report (Charger)
# -----------------------------------------------------------------------------------
# ============================================================
# PM Report API - ใช้ SN (Charger Serial Number) แทน station_id
# ============================================================

# def _validate_sn(sn: str):
#     """Validate SN format"""
#     if not sn or not re.fullmatch(r"[A-Za-z0-9_\-]+", str(sn)):
#         raise HTTPException(status_code=400, detail="Bad SN format")

# def get_pmreport_collection_for(sn: str):
#     """Get PM Report collection by Charger SN"""
#     _validate_sn(sn)
#     coll = PMReportDB.get_collection(str(sn))
#     return coll

# def get_pmurl_coll_upload(sn: str):
#     """Get PM URL collection by Charger SN"""
#     _validate_sn(sn)
#     coll = PMUrlDB.get_collection(str(sn))
#     return coll

# async def _get_charger_by_sn(sn: str) -> dict:
#     """Get charger document by SN, raise 404 if not found"""
#     charger = charger_collection.find_one({"SN": sn})
#     if not charger:
#         raise HTTPException(status_code=404, detail=f"Charger with SN '{sn}' not found")
#     return charger

# def _compute_next_pm_date_str(pm_date_str: str | None) -> str | None:
#     if not pm_date_str:
#         return None
#     try:
#         d = datetime.fromisoformat(pm_date_str).date()
#     except ValueError:
#         return None
#     next_d = d + relativedelta(months=+6)
#     return next_d.isoformat()     

# # --- helper: เอา pm_date ล่าสุดจาก PMReportDB/<sn> ---
# async def _latest_pm_date_from_pmreport(sn: str) -> dict | None:
#     _validate_sn(sn)
#     coll = PMReportDB.get_collection(str(sn))

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
#         {"$project": {"_id": 1, "pm_date": 1, "timestamp": 1}}
#     ]

#     cursor = coll.aggregate(pipeline)
#     docs = await cursor.to_list(length=1)
#     return docs[0] if docs else None

# async def _pmreport_latest_core(sn: str, current: UserClaims):
#     """Get latest PM report info for a charger by SN"""
#     _validate_sn(sn)
    
#     # 1) ดึงข้อมูล Charger จาก SN
#     charger = await _get_charger_by_sn(sn)
    
#     pi_fw  = charger.get("PIFirmware")
#     plc_fw = charger.get("PLCFirmware")
#     rt_fw  = charger.get("RTFirmware")
#     station_id = charger.get("station_id")

#     # 2) ดึง pm_date ล่าสุดจาก PMReportDB
#     pm_latest = await _latest_pm_date_from_pmreport(sn)
#     pm_date = pm_latest.get("pm_date") if pm_latest else None

#     # เวลา: ใช้ timestamp จาก pm report ถ้ามี ไม่งั้น fallback ไปของ charger
#     ts_raw = (pm_latest.get("timestamp") if pm_latest else None) or charger.get("createdAt")

#     ts_dt = (parse_iso_any_tz(ts_raw) if isinstance(ts_raw, str)
#              else (ts_raw if isinstance(ts_raw, datetime) else None))
#     ts_utc = ts_dt.astimezone(ZoneInfo("UTC")).isoformat() if ts_dt else None
#     ts_th  = ts_dt.astimezone(ZoneInfo("Asia/Bangkok")).isoformat() if ts_dt else None

#     pm_next_date = _compute_next_pm_date_str(pm_date)

#     return {
#         "_id": str(charger["_id"]),
#         "sn": sn,
#         "station_id": station_id,
#         "chargeBoxID": charger.get("chargeBoxID"),
#         "pi_firmware": pi_fw,
#         "plc_firmware": plc_fw,
#         "rt_firmware": rt_fw,
#         "pm_date": pm_date,
#         "pm_next_date": pm_next_date, 
#         "timestamp": ts_raw,
#         "timestamp_utc": ts_utc,
#         "timestamp_th": ts_th,
#         "source": "chargers + PMReportDB",
#     }

# @app.get("/pmreport/get")
# async def pmreport_get(sn: str, report_id: str, current: UserClaims = Depends(get_current_user)):
#     """Get a specific PM report by SN and report_id"""
#     coll = get_pmreport_collection_for(sn)
#     doc = await coll.find_one({"_id": ObjectId(report_id)})
#     if not doc:
#         raise HTTPException(status_code=404, detail="not found")

#     doc["_id"] = str(doc["_id"])
#     return doc

# @app.get("/pmreport/list")
# async def pmreport_list(
#     sn: str = Query(...),
#     page: int = Query(1, ge=1),
#     pageSize: int = Query(20, ge=1, le=100),
# ):
#     """List PM reports for a charger by SN"""
#     coll = get_pmreport_collection_for(sn)
#     skip = (page - 1) * pageSize

#     cursor = coll.find({}, {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector": 1, "side": 1, "createdAt": 1}).sort(
#         [("createdAt", -1), ("_id", -1)]
#     ).skip(skip).limit(pageSize)
#     items_raw = await cursor.to_list(length=pageSize)
#     total = await coll.count_documents({})

#     # --- ดึงไฟล์จาก PMReportURL โดย map ด้วย pm_date (string) ---
#     pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
#     urls_coll = get_pmurl_coll_upload(sn)
#     url_by_day: dict[str, str] = {}

#     if pm_dates:
#         ucur = urls_coll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
#         url_docs = await ucur.to_list(length=10_000)
#         for u in url_docs:
#             day = u.get("pm_date")
#             first_url = (u.get("urls") or [None])[0]
#             if day and first_url and day not in url_by_day:
#                 url_by_day[day] = first_url

#     items = [{
#         "id": str(it["_id"]),
#         "issue_id": it.get("issue_id"),
#         "doc_name": it.get("doc_name"),
#         "pm_date": it.get("pm_date"),
#         "inspector": it.get("inspector"),
#         "side": it.get("side"),
#         "createdAt": _ensure_utc_iso(it.get("createdAt")),
#         "file_url": url_by_day.get(it.get("pm_date") or "", ""),
#     } for it in items_raw]

#     pm_date_arr = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
#     return {"items": items, "pm_date": pm_date_arr, "page": page, "pageSize": pageSize, "total": total}

# # เดิม (path param)
# @app.get("/pmreport/latest/{sn}")
# async def pmreport_latest(sn: str, current: UserClaims = Depends(get_current_user)):
#     """Get latest PM info for a charger by SN (path param)"""
#     return await _pmreport_latest_core(sn, current)

# # ใหม่ (query param)
# @app.get("/pmreport/latest/")
# async def pmreport_latest_q(
#     sn: str = Query(..., description="Charger Serial Number"),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """Get latest PM info for a charger by SN (query param)"""
#     return await _pmreport_latest_core(sn, current)

# class PMMeasureRow(BaseModel):
#     value: str = ""
#     unit: str = "V"

# class PMMeasures(BaseModel):
#     m16: Dict[str, PMMeasureRow] = Field(default_factory=dict)
#     cp: PMMeasureRow = PMMeasureRow()

# class PMRowPF(BaseModel):
#     pf: Optional[Literal["PASS","FAIL","NA",""]] = ""
#     remark: Optional[str] = ""

# class PMSubmitIn(BaseModel):
#     side: Literal["pre", "post"]
#     sn: str  # Changed from station_id to sn
#     job: dict
#     measures_pre: dict
#     rows_pre: Optional[dict[str, Any]] = None
#     pm_date: str
#     issue_id: Optional[str] = None
#     doc_name: Optional[str] = None 
#     inspector: Optional[str] = None 

# async def _latest_issue_id_anywhere(
#     identifier: str,  # sn สำหรับ charger, station_id สำหรับอื่นๆ
#     pm_type: str,
#     d: date,
#     source: Literal["charger", "mdb", "ccb", "cbbox", "station"] = "charger",
# ) -> str | None:
#     """Find latest issue_id from both report and URL collections"""
#     if source == "charger":
#         _validate_sn(identifier)
#     else:
#         _validate_station_id(identifier)

#     yymm = f"{d.year % 100:02d}{d.month:02d}"
#     prefix = f"PM-{pm_type}-{yymm}-"

#     if source == "charger":
#         rep_coll = get_pmreport_collection_for(identifier)          # ✅ เปลี่ยนจาก sn
#         url_coll = get_pmurl_coll_upload(identifier)                # ✅ เปลี่ยนจาก sn
#     elif source == "mdb": 
#         rep_coll = get_mdbpmreport_collection_for(identifier)       # ✅ เปลี่ยนจาก sn
#         url_coll = get_mdbpmurl_coll_upload(identifier)             # ✅ เปลี่ยนจาก sn
#     elif source == "ccb": 
#         rep_coll = get_ccbpmreport_collection_for(identifier)       # ✅ เปลี่ยนจาก sn
#         url_coll = get_ccbpmurl_coll_upload(identifier)             # ✅ เปลี่ยนจาก sn
#     elif source == "cbbox": 
#         rep_coll = get_cbboxpmreport_collection_for(identifier)     # ✅ เปลี่ยนจาก sn
#         url_coll = get_cbboxpmurl_coll_upload(identifier)           # ✅ เปลี่ยนจาก sn
#     elif source == "station": 
#         rep_coll = get_stationpmreport_collection_for(identifier)   # ✅ เปลี่ยนจาก sn
#         url_coll = get_stationpmurl_coll_upload(identifier)         # ✅ เปลี่ยนจาก sn

#     pipeline = [
#         {"$match": {"issue_id": {"$regex": f"^{prefix}\\d+$"}}},
#         {"$project": {"issue_id": 1}},
#     ]

#     rep_docs = await rep_coll.aggregate(pipeline).to_list(length=1000)
#     url_docs = await url_coll.aggregate(pipeline).to_list(length=1000)

#     best = None
#     best_n = 0

#     for ddoc in rep_docs + url_docs:
#         s = ddoc.get("issue_id") or ""
#         m = re.search(r"(\d+)$", s)
#         if not m:
#             continue
#         n = int(m.group(1))
#         if n > best_n:
#             best_n = n
#             best = s

#     return best

# async def _next_issue_id(db, sn: str, pm_type: str, d, pad: int = 2) -> str:
#     """Generate next issue_id for a charger"""
#     yymm = f"{d.year % 100:02d}{d.month:02d}"
#     seq = await db.pm_sequences.find_one_and_update(
#         {"sn": sn, "pm_type": pm_type, "yymm": yymm},
#         {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
#         upsert=True,
#         return_document=ReturnDocument.AFTER,
#     )
#     return f"PM-{pm_type}-{yymm}-{int(seq['n']):0{pad}d}"

# @app.get("/pmreport/preview-issueid")
# async def pmreport_preview_issueid(
#     sn: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """Preview next issue_id without actually generating it"""
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     pm_type = "CG"

#     latest = await _latest_issue_id_anywhere(sn, pm_type, d)

#     yymm = f"{d.year % 100:02d}{d.month:02d}"
#     prefix = f"PM-{pm_type}-{yymm}-"

#     if not latest:
#         next_issue = f"{prefix}01"
#     else:
#         m = re.search(r"(\d+)$", latest)
#         cur = int(m.group(1)) if m else 0
#         next_issue = f"{prefix}{cur+1:02d}"

#     return {"issue_id": next_issue}

# async def _latest_doc_name_from_pmreport(
#     identifier: str,
#     pm_date: str,
#     source: Literal["charger", "mdb", "ccb", "cbbox", "station"] = "charger",
# ) -> dict | None:
#     """Get latest doc_name from PMReportDB for the same year"""
#     if source == "charger":
#         _validate_sn(identifier)
#     else:
#         _validate_station_id(identifier)
    
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#         year = d.year
#     except ValueError:
#         return None
    
#     if source == "charger":
#         coll = PMReportDB.get_collection(str(identifier))           # ✅ เปลี่ยนจาก sn
#     elif source == "mdb": 
#         coll = MDBPMReportDB.get_collection(str(identifier))        # ✅ เปลี่ยนจาก sn
#     elif source == "ccb": 
#         coll = CCBPMReportDB.get_collection(str(identifier))        # ✅ เปลี่ยนจาก sn
#     elif source == "cbbox": 
#         coll = CBBOXPMReportDB.get_collection(str(identifier))      # ✅ เปลี่ยนจาก sn
#     elif source == "station": 
#         coll = stationPMReportDB.get_collection(str(identifier))    # ✅ เปลี่ยนจาก sn
    
#     pipeline = [
#         {
#             "$match": {
#                 "doc_name": {"$regex": f"^{identifier}_\\d+/{year}$"}  # ✅ เปลี่ยนจาก sn
#             }
#         },
#         {"$sort": {"_id": -1}},
#         {"$limit": 1},
#         {"$project": {"_id": 1, "doc_name": 1}}
#     ]
    
#     cursor = coll.aggregate(pipeline)
#     docs = await cursor.to_list(length=1)
#     return docs[0] if docs else None

# async def _latest_doc_name_anywhere(
#     sn: str,
#     year: int,
#     source: Literal["charger", "mdb", "ccb", "cbbox", "station"] = "charger",
# ) -> str | None:
#     """Find latest doc_name from both report and URL collections"""
#     pattern = f"^{sn}_\\d+/{year}$"

#     if source == "charger":
#         rep_coll = get_pmreport_collection_for(sn)
#         url_coll = get_pmurl_coll_upload(sn)
#     elif source == "mdb": 
#         rep_coll = get_mdbpmreport_collection_for(sn)
#         url_coll = get_mdbpmurl_coll_upload(sn)
#     elif source == "ccb": 
#         rep_coll = get_ccbpmreport_collection_for(sn)
#         url_coll = get_ccbpmurl_coll_upload(sn)
#     elif source == "cbbox": 
#         rep_coll = get_cbboxpmreport_collection_for(sn)
#         url_coll = get_cbboxpmurl_coll_upload(sn)
#     elif source == "station": 
#         rep_coll = get_stationpmreport_collection_for(sn)
#         url_coll = get_stationpmurl_coll_upload(sn)

#     pipeline = [
#         {"$match": {"doc_name": {"$regex": pattern}}},
#         {"$project": {"doc_name": 1}},
#     ]

#     rep_docs = await rep_coll.aggregate(pipeline).to_list(length=1000)
#     url_docs = await url_coll.aggregate(pipeline).to_list(length=1000)

#     best_seq = 0
#     best_name = None

#     for d in rep_docs + url_docs:
#         name = d.get("doc_name") or ""
#         m = re.search(r"_(\d+)/\d{4}$", name)
#         if not m:
#             continue
#         seq = int(m.group(1))
#         if seq > best_seq:
#             best_seq = seq
#             best_name = name

#     return best_name

# @app.get("/pmreport/latest-docname")
# async def pmreport_latest_docname(
#     sn: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """Get latest doc_name for calculating next number at frontend"""
#     latest = await _latest_doc_name_from_pmreport(sn, pm_date)
    
#     return {
#         "doc_name": latest.get("doc_name") if latest else None,
#         "sn": sn,
#         "pm_date": pm_date
#     }

# async def _next_year_seq(
#     db,
#     sn: str,
#     pm_type: str,
#     d: date,
# ) -> int:
#     """Generate next year sequence number for a charger"""
#     year = d.year
#     seq = await db.pm_year_sequences.find_one_and_update(
#         {"sn": sn, "pm_type": pm_type, "year": year},
#         {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
#         upsert=True,
#         return_document=ReturnDocument.AFTER,
#     )
#     return int(seq["n"])

# @app.get("/pmreport/preview-docname")
# async def preview_docname(
#     sn: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """Preview next doc_name without actually generating it"""
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     year = d.year

#     latest = await _latest_doc_name_anywhere(sn, year)

#     if not latest:
#         next_doc = f"{sn}_1/{year}"
#     else:
#         m = re.search(r"_(\d+)/\d{4}$", latest)
#         current_num = int(m.group(1)) if m else 0
#         next_doc = f"{sn}_{current_num + 1}/{year}"

#     return {"doc_name": next_doc}

# # @app.post("/pmreport/pre/submit")
# # async def pmreport_pre_submit(body: PMSubmitIn, current: UserClaims = Depends(get_current_user)):
# #     """Submit Pre-PM report for a charger"""
# #     sn = body.sn.strip()
    
# #     # Validate charger exists
# #     charger = await _get_charger_by_sn(sn)
# #     station_id = charger.get("station_id")
    
# #     coll = get_pmreport_collection_for(sn)
# #     db = coll.database

# #     pm_type = str(body.job.get("pm_type") or "CG").upper()
# #     body.job["pm_type"] = pm_type

# #     url_coll = get_pmurl_coll_upload(sn)

# #     try:
# #         d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
# #     except ValueError:
# #         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

# #     client_issue = body.issue_id
# #     issue_id: str | None = None    

# #     if client_issue:
# #         yymm = f"{d.year % 100:02d}{d.month:02d}"
# #         prefix = f"PM-{pm_type}-{yymm}-"
# #         valid_fmt = client_issue.startswith(prefix)
# #         rep_exists = await coll.find_one({"sn": sn, "issue_id": client_issue})
# #         url_exists = await url_coll.find_one({"issue_id": client_issue})
# #         unique = not (rep_exists or url_exists)

# #         if valid_fmt and unique:
# #             issue_id = client_issue
    
# #     if not issue_id:
# #         while True:
# #             candidate = await _next_issue_id(db, sn, pm_type, d, pad=2)
# #             rep_exists = await coll.find_one({"issue_id": candidate})
# #             url_exists = await url_coll.find_one({"issue_id": candidate})
# #             if not rep_exists and not url_exists:
# #                 issue_id = candidate
# #                 break

# #     client_docName = body.doc_name
# #     doc_name = None
# #     if client_docName:
# #         year = f"{d.year}"
# #         prefix = f"{sn}_"
# #         valid_fmt = client_docName.startswith(prefix)

# #         rep_exists = await coll.find_one({"sn": sn, "doc_name": client_docName})
# #         url_exists = await url_coll.find_one({"doc_name": client_docName})
# #         unique = not (rep_exists or url_exists)

# #         if valid_fmt and unique:
# #             doc_name = client_docName
 
# #     if not doc_name:
# #         year_seq = await _next_year_seq(db, sn, pm_type, d)
# #         year = d.year
# #         doc_name = f"{sn}_{year_seq}/{year}"

# #     inspector = body.inspector
# #     doc = {
# #         "sn": sn,
# #         "station_id": station_id,  # Keep reference to station
# #         "chargeBoxID": charger.get("chargeBoxID"),
# #         "doc_name": doc_name,
# #         "issue_id": issue_id,
# #         "job": body.job,
# #         "rows_pre": body.rows_pre or {},
# #         "measures_pre": body.measures_pre,
# #         "pm_date": body.pm_date,
# #         "inspector": inspector,
# #         "photos_pre": {},
# #         "status": "draft",
# #         "side": body.side,
# #         "timestamp": datetime.now(timezone.utc),
# #     }
# #     res = await coll.insert_one(doc)
# #     return {
# #         "ok": True,
# #         "report_id": str(res.inserted_id),
# #         "issue_id": issue_id,
# #         "doc_name": doc_name,
# #     }

# async def _next_issue_id_no_conflict(db, coll, url_coll, sn, pm_type, d, pad=2):
#     """Generate next issue_id with atomic sequence — no while loop"""
#     yymm = f"{d.year % 100:02d}{d.month:02d}"
#     prefix = f"PM-{pm_type}-{yymm}-"
    
#     # ใช้ atomic findOneAndUpdate — ไม่ต้อง loop
#     seq = await db.pm_sequences.find_one_and_update(
#         {"sn": sn, "pm_type": pm_type, "yymm": yymm},
#         {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
#         upsert=True,
#         return_document=ReturnDocument.AFTER,
#     )
#     return f"{prefix}{int(seq['n']):0{pad}d}"

# @app.post("/pmreport/pre/submit")
# async def pmreport_pre_submit(body: PMSubmitIn, current: UserClaims = Depends(get_current_user)):
#     sn = body.sn.strip()
#     coll = get_pmreport_collection_for(sn)
#     url_coll = get_pmurl_coll_upload(sn)
#     db = coll.database

#     pm_type = str(body.job.get("pm_type") or "CG").upper()
#     body.job["pm_type"] = pm_type

#     try:
#         d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     # ============ ⚡ รัน parallel แทน sequential ============
#     charger_task = _get_charger_by_sn(sn)

#     # validate issue_id + doc_name พร้อมกัน
#     client_issue = body.issue_id
#     client_doc = body.doc_name

#     tasks = [charger_task]

#     if client_issue:
#         yymm = f"{d.year % 100:02d}{d.month:02d}"
#         prefix = f"PM-{pm_type}-{yymm}-"
#         if client_issue.startswith(prefix):
#             tasks.append(coll.find_one({"issue_id": client_issue}, {"_id": 1}))    # idx 1
#             tasks.append(url_coll.find_one({"issue_id": client_issue}, {"_id": 1})) # idx 2
#         else:
#             tasks.append(asyncio.sleep(0))  # placeholder
#             tasks.append(asyncio.sleep(0))
#     else:
#         tasks.append(asyncio.sleep(0))
#         tasks.append(asyncio.sleep(0))

#     if client_doc:
#         tasks.append(coll.find_one({"doc_name": client_doc}, {"_id": 1}))    # idx 3
#         tasks.append(url_coll.find_one({"doc_name": client_doc}, {"_id": 1})) # idx 4
#     else:
#         tasks.append(asyncio.sleep(0))
#         tasks.append(asyncio.sleep(0))

#     results = await asyncio.gather(*tasks)

#     charger = results[0]
#     station_id = charger.get("station_id")

#     # ---- resolve issue_id ----
#     issue_id = None
#     if client_issue and client_issue.startswith(prefix):
#         rep_exists, url_exists = results[1], results[2]
#         if not rep_exists and not url_exists:
#             issue_id = client_issue

#     if not issue_id:
#         issue_id = await _next_issue_id_no_conflict(db, coll, url_coll, sn, pm_type, d)

#     # ---- resolve doc_name ----
#     doc_name = None
#     if client_doc and client_doc.startswith(f"{sn}_"):
#         rep_exists, url_exists = results[3], results[4]
#         if not rep_exists and not url_exists:
#             doc_name = client_doc

#     if not doc_name:
#         year_seq = await _next_year_seq(db, sn, pm_type, d)
#         doc_name = f"{sn}_{year_seq}/{d.year}"

#     # ---- insert ----
#     doc = {
#         "sn": sn,
#         "station_id": station_id,
#         "chargeBoxID": charger.get("chargeBoxID"),
#         "doc_name": doc_name,
#         "issue_id": issue_id,
#         "job": body.job,
#         "rows_pre": body.rows_pre or {},
#         "measures_pre": body.measures_pre,
#         "pm_date": body.pm_date,
#         "inspector": body.inspector,
#         "photos_pre": {},
#         "status": "draft",
#         "side": body.side,
#         "timestamp": datetime.now(timezone.utc),
#     }
#     res = await coll.insert_one(doc)
#     return {"ok": True, "report_id": str(res.inserted_id), "issue_id": issue_id, "doc_name": doc_name}

# class PMPostIn(BaseModel):
#     report_id: str | None = None
#     sn: str  # Changed from station_id to sn
#     rows: dict
#     measures: dict
#     summary: str
#     summaryCheck: str | None = None
#     dust_filter: Dict[str, bool] | None = None
#     side: Literal["post", "after"]

# @app.post("/pmreport/submit")
# async def pmreport_post_submit(
#     body: PMPostIn,
#     current: UserClaims = Depends(get_current_user)
# ):
#     """Submit Post-PM report for a charger"""
#     sn = body.sn.strip()
#     coll = get_pmreport_collection_for(sn)
#     db = coll.database
#     url_coll = get_pmurl_coll_upload(sn)

#     # ---------- กรณี 1: มี report_id → UPDATE doc เดิม ----------
#     if body.report_id:
#         try:
#             oid = ObjectId(body.report_id)
#         except InvalidId:
#             raise HTTPException(status_code=400, detail="invalid report_id")

#         existing = await coll.find_one({"_id": oid, "sn": sn})
#         if not existing:
#             raise HTTPException(status_code=404, detail="Report not found")

#         update_fields = {
#             "rows": body.rows,
#             "measures": body.measures,
#             "summary": body.summary,
#             "summaryCheck": body.summaryCheck,
#             "dust_filter": body.dust_filter,
#             "side": "post",
#             "timestamp_post": datetime.now(timezone.utc),
#         }

#         await coll.update_one({"_id": oid}, {"$set": update_fields})

#         return {
#             "ok": True,
#             "report_id": body.report_id,
#         }

#     # ---------- กรณี 2: ไม่มี report_id → INSERT ใหม่ ----------
#     # Validate charger exists
#     charger = await _get_charger_by_sn(sn)
    
#     doc = {
#         "sn": sn,
#         "station_id": charger.get("station_id"),
#         "chargeBoxID": charger.get("chargeBoxID"),
#         "rows": body.rows,
#         "measures": body.measures,
#         "summary": body.summary,
#         "summaryCheck": body.summaryCheck,
#         "dust_filter": body.dust_filter,
#         "photos": {},
#         "status": "draft",
#         "side": "post",
#         "timestamp": datetime.now(timezone.utc),
#     }
#     res = await coll.insert_one(doc)
#     return {
#         "ok": True,
#         "report_id": str(res.inserted_id),
#     }

# # ตำแหน่งโฟลเดอร์บนเครื่องเซิร์ฟเวอร์
# UPLOADS_ROOT = os.getenv("UPLOADS_ROOT", "./uploads")
# os.makedirs(UPLOADS_ROOT, exist_ok=True)

# app.mount("/uploads", StaticFiles(directory=UPLOADS_ROOT, html=False), name="uploads")

# ALLOWED_EXTS = {"jpg","jpeg","png","webp","gif","pdf"}
# MAX_FILE_MB = 20

# def _safe_name(name: str) -> str:
#     base = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
#     return base[:120] or secrets.token_hex(4)

# def _ext(fname: str) -> str:
#     return (fname.rsplit(".",1)[-1].lower() if "." in fname else "")

# @app.post("/pmreport/{report_id}/pre/photos")
# async def pmreport_upload_pre_photos(
#     report_id: str,
#     sn: str = Form(...),
#     group: str = Form(...),
#     files: list[UploadFile] = File(...),
# ):
#     """Upload Pre-PM photos for a charger report"""
#     if not re.fullmatch(r"g\d+(_\d+)?", group):
#         raise HTTPException(status_code=400, detail="Bad group key")

#     coll = get_pmreport_collection_for(sn)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     doc = await coll.find_one({"_id": oid}, {"_id": 1, "sn": 1})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Report not found")
#     if doc.get("sn") != sn:
#         raise HTTPException(status_code=400, detail="sn mismatch")

#     # โฟลเดอร์ปลายทาง - ใช้ sn แทน station_id
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "pm" / sn / report_id / "pre" / group
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     saved = []
#     for f in files:
#         ext = _ext(f.filename or "")
#         if ext not in ALLOWED_EXTS:
#             raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url_path = f"/uploads/pm/{sn}/{report_id}/pre/{group}/{fname}"
#         saved.append({
#             "filename": fname,
#             "size": len(data),
#             "url": url_path,
#             "uploadedAt": datetime.now(timezone.utc)
#         })

#     await coll.update_one(
#         {"_id": oid},
#         {"$push": {f"photos_pre.{group}": {"$each": saved}}}
#     )

#     return {"ok": True, "count": len(saved), "group": group, "files": saved}

# @app.post("/pmreport/{report_id}/post/photos")
# async def pmreport_upload_post_photos(
#     report_id: str,
#     sn: str = Form(...),
#     group: str = Form(...),
#     files: list[UploadFile] = File(...),
#     remark: str | None = Form(None),
# ):
#     """Upload Post-PM photos for a charger report"""
#     if not re.fullmatch(r"g\d+(_\d+)?", group):
#         raise HTTPException(status_code=400, detail="Bad group key")

#     coll = get_pmreport_collection_for(sn)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     doc = await coll.find_one({"_id": oid}, {"_id": 1, "sn": 1})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Report not found")
#     if doc.get("sn") != sn:
#         raise HTTPException(status_code=400, detail="sn mismatch")

#     # โฟลเดอร์ปลายทาง - ใช้ sn แทน station_id
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "pm" / sn / report_id / "post" / group
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     saved = []
#     for f in files:
#         ext = _ext(f.filename or "")
#         if ext not in ALLOWED_EXTS:
#             raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url_path = f"/uploads/pm/{sn}/{report_id}/post/{group}/{fname}"
#         saved.append({
#             "filename": fname,
#             "size": len(data),
#             "url": url_path,
#             "remark": remark or "",
#             "uploadedAt": datetime.now(timezone.utc)
#         })

#     await coll.update_one(
#         {"_id": oid},
#         {"$push": {f"photos.{group}": {"$each": saved}}}
#     )

#     return {"ok": True, "count": len(saved), "group": group, "files": saved}

# @app.post("/pmreport/{report_id}/finalize")
# async def pmreport_finalize(
#     report_id: str,
#     sn: str = Form(...),
# ):
#     """Finalize a PM report"""
#     coll = get_pmreport_collection_for(sn)
    
#     oid = ObjectId(report_id)
#     res = await coll.update_one(
#         {"_id": oid},
#         {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc)}}
#     )
#     if res.matched_count == 0:
#         raise HTTPException(status_code=404, detail="Report not found")
#     return {"ok": True}

# def parse_report_date_to_utc(s: str) -> datetime:
#     if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
#         tz_th = ZoneInfo("Asia/Bangkok")
#         dt_th = datetime.fromisoformat(s + "T00:00:00").replace(tzinfo=tz_th)
#         return dt_th.astimezone(timezone.utc)
#     if s.endswith("Z"):
#         return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)
#     if re.search(r"[+\-]\d{2}:\d{2}$", s):
#         return datetime.fromisoformat(s).astimezone(timezone.utc)
#     return datetime.fromisoformat(s + "+07:00").astimezone(timezone.utc)

# def normalize_pm_date(s: str) -> str:
#     if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
#         return s
#     if s.endswith("Z") or re.search(r"[+\-]\d{2}:\d{2}$", s):
#         dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
#     else:
#         dt = datetime.fromisoformat(s).replace(tzinfo=th_tz)
#     return dt.astimezone(th_tz).date().isoformat()

# @app.post("/pmurl/upload-files", status_code=201)
# async def pmurl_upload_files(
#     sn: str = Form(...),
#     reportDate: str = Form(...),
#     files: list[UploadFile] = File(...),
#     issue_id: Optional[str] = Form(None),
#     doc_name: Optional[str] = Form(None),
#     inspector: Optional[str] = Form(None),
# ):
#     """Upload PM PDF files for a charger"""
#     # Validate charger exists
#     charger = await _get_charger_by_sn(sn)
#     station_id = charger.get("station_id")
    
#     coll = get_pmurl_coll_upload(sn)
#     pm_date = normalize_pm_date(reportDate)

#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

#     pm_type = "CG"

#     # -------------------------
#     # 1) ตัดสินใจเลือก issue_id
#     # -------------------------
#     rep_coll = get_pmreport_collection_for(sn)
#     final_issue_id: str | None = None
#     client_issue = (issue_id or "").strip()

#     if client_issue:
#         yymm = f"{d.year % 100:02d}{d.month:02d}"
#         prefix = f"PM-{pm_type}-{yymm}-"
#         valid_fmt = client_issue.startswith(prefix)

#         url_exists = await coll.find_one({"issue_id": client_issue})
#         rep_exists = await rep_coll.find_one({"issue_id": client_issue})
#         unique = not (url_exists or rep_exists)

#         if valid_fmt and unique:
#             final_issue_id = client_issue

#     if not final_issue_id:
#         while True:
#             candidate = await _next_issue_id(coll.database, sn, pm_type, d, pad=2)
#             url_exists = await coll.find_one({"issue_id": candidate})
#             rep_exists = await rep_coll.find_one({"issue_id": candidate})
#             if not url_exists and not rep_exists:
#                 final_issue_id = candidate
#                 break

#     year_seq: int | None = None

#     rep = await get_pmreport_collection_for(sn).find_one(
#         {"issue_id": final_issue_id},
#         {"year_seq": 1, "pm_date": 1},
#     )
#     if rep and rep.get("year_seq") is not None:
#         year_seq = int(rep["year_seq"])

#     if year_seq is None:
#         year_seq = await _next_year_seq(coll.database, sn, pm_type, d)

#     year = d.year
#     final_doc_name: str | None = None

#     if doc_name:
#         candidate = doc_name.strip()
#         ok_format = candidate.startswith(f"{sn}_")

#         rep_exists = await rep_coll.find_one({"doc_name": candidate})
#         url_exists = await coll.find_one({"doc_name": candidate})
#         unique = not (rep_exists or url_exists)

#         if ok_format and unique:
#             final_doc_name = candidate

#     if not final_doc_name:
#         final_doc_name = f"{sn}_{year_seq}/{year}"

#     doc_name = final_doc_name

#     # -------------------------
#     # 3) เซฟไฟล์ PDF ลงดิสก์
#     # -------------------------
#     subdir = pm_date
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "pmurl" / sn / subdir
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     urls: list[str] = []
#     metas: list[dict] = []
#     total_size = 0

#     for f in files:
#         ext = (f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext not in ALLOWED_EXTS or ext != "pdf":
#             raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

#         data = await f.read()
#         total_size += len(data)
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(
#                 status_code=413,
#                 detail=f"File too large (> {MAX_FILE_MB} MB)"
#             )

#         safe = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
#         dest = dest_dir / safe
#         with open(dest, "wb") as out:
#             out.write(data)

#         url = f"/uploads/pmurl/{sn}/{subdir}/{safe}"
#         urls.append(url)
#         metas.append({"name": f.filename, "size": len(data)})

#     inspector_clean = (inspector or "").strip() or None

#     # -------------------------
#     # 4) บันทึกลง Mongo
#     # -------------------------
#     now = datetime.now(timezone.utc)
#     doc = {
#         "sn": sn,
#         "station_id": station_id,
#         "chargeBoxID": charger.get("chargeBoxID"),
#         "pm_date": pm_date,
#         "issue_id": final_issue_id,
#         "inspector": inspector_clean,
#         "year": year,
#         "year_seq": year_seq,
#         "doc_name": doc_name,
#         "urls": urls,
#         "meta": {"files": metas},
#         "source": "upload-files",
#         "createdAt": now,
#         "updatedAt": now,
#     }
#     res = await coll.insert_one(doc)

#     return {
#         "ok": True,
#         "inserted_id": str(res.inserted_id),
#         "count": len(urls),
#         "urls": urls,
#         "issue_id": final_issue_id,
#         "year_seq": year_seq,
#         "doc_name": doc_name,
#         "inspector": inspector_clean,
#     }

# @app.get("/pmurl/list")
# async def pmurl_list(
#     sn: str = Query(...),
#     page: int = Query(1, ge=1),
#     pageSize: int = Query(20, ge=1, le=100),
# ):
#     """List PM URL documents for a charger"""
#     coll = get_pmurl_coll_upload(sn)
#     skip = (page - 1) * pageSize

#     cursor = coll.find(
#         {},
#         {"_id": 1, "issue_id": 1, "doc_name": 1, "inspector": 1, "pm_date": 1, "reportDate": 1, "urls": 1, "createdAt": 1}
#     ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

#     items_raw = await cursor.to_list(length=pageSize)
#     total = await coll.count_documents({})

#     def _pm_date_from(doc: dict) -> str | None:
#         s = doc.get("pm_date")
#         if isinstance(s, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
#             return s

#         rd = doc.get("reportDate")
#         if isinstance(rd, datetime):
#             return rd.astimezone(th_tz).date().isoformat()
#         if isinstance(rd, str):
#             try:
#                 dt = datetime.fromisoformat(rd.replace("Z", "+00:00"))
#             except Exception:
#                 try:
#                     dt = datetime.fromisoformat(rd).replace(tzinfo=th_tz)
#                 except Exception:
#                     return None
#             return dt.astimezone(th_tz).date().isoformat()

#         return None

#     items = []
#     pm_date_arr = []

#     for it in items_raw:
#         pm_date_str = _pm_date_from(it)
#         if pm_date_str:
#             pm_date_arr.append(pm_date_str)

#         urls = it.get("urls") or []
#         first_url = urls[0] if urls else ""

#         items.append({
#             "id": str(it["_id"]),
#             "pm_date": pm_date_str, 
#             "inspector": it.get("inspector"), 
#             "doc_name": it.get("doc_name"),
#             "issue_id": it.get("issue_id"),
#             "createdAt": _ensure_utc_iso(it.get("createdAt")),
#             "file_url": first_url,
#             "urls": urls,
#         })

#     return {
#         "items": items,
#         "pm_date": [d for d in pm_date_arr if d],
#         "page": page,
#         "pageSize": pageSize,
#         "total": total,
#     }

def _validate_sn(sn: str):
    """Validate SN format"""
    if not sn or not re.fullmatch(r"[A-Za-z0-9_\-]+", str(sn)):
        raise HTTPException(status_code=400, detail="Bad SN format")

def get_pmreport_collection_for(sn: str):
    """Get PM Report collection by Charger SN"""
    _validate_sn(sn)
    coll = PMReportDB.get_collection(str(sn))
    return coll

def get_pmurl_coll_upload(sn: str):
    """Get PM URL collection by Charger SN"""
    _validate_sn(sn)
    coll = PMUrlDB.get_collection(str(sn))
    return coll

async def _get_charger_by_sn(sn: str) -> dict:
    """Get charger document by SN, raise 404 if not found"""
    # FIX #1: เพิ่ม await — charger_collection เป็น Motor async collection
    charger = charger_collection.find_one({"SN": sn})
    if not charger:
        raise HTTPException(status_code=404, detail=f"Charger with SN '{sn}' not found")
    return charger

def _compute_next_pm_date_str(pm_date_str: str | None) -> str | None:
    if not pm_date_str:
        return None
    try:
        d = datetime.fromisoformat(pm_date_str).date()
    except ValueError:
        return None
    next_d = d + relativedelta(months=+6)
    return next_d.isoformat()     

# --- helper: เอา pm_date ล่าสุดจาก PMReportDB/<sn> ---
async def _latest_pm_date_from_pmreport(sn: str) -> dict | None:
    _validate_sn(sn)
    coll = PMReportDB.get_collection(str(sn))

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

async def _pmreport_latest_core(sn: str, current: UserClaims):
    """Get latest PM report info for a charger by SN"""
    _validate_sn(sn)
    
    # 1) ดึงข้อมูล Charger จาก SN
    charger = await _get_charger_by_sn(sn)
    
    pi_fw  = charger.get("PIFirmware")
    plc_fw = charger.get("PLCFirmware")
    rt_fw  = charger.get("RTFirmware")
    station_id = charger.get("station_id")

    # 2) ดึง pm_date ล่าสุดจาก PMReportDB
    pm_latest = await _latest_pm_date_from_pmreport(sn)
    pm_date = pm_latest.get("pm_date") if pm_latest else None

    # เวลา: ใช้ timestamp จาก pm report ถ้ามี ไม่งั้น fallback ไปของ charger
    ts_raw = (pm_latest.get("timestamp") if pm_latest else None) or charger.get("createdAt")

    ts_dt = (parse_iso_any_tz(ts_raw) if isinstance(ts_raw, str)
             else (ts_raw if isinstance(ts_raw, datetime) else None))
    ts_utc = ts_dt.astimezone(ZoneInfo("UTC")).isoformat() if ts_dt else None
    ts_th  = ts_dt.astimezone(ZoneInfo("Asia/Bangkok")).isoformat() if ts_dt else None

    pm_next_date = _compute_next_pm_date_str(pm_date)

    return {
        "_id": str(charger["_id"]),
        "sn": sn,
        "station_id": station_id,
        "chargeBoxID": charger.get("chargeBoxID"),
        "pi_firmware": pi_fw,
        "plc_firmware": plc_fw,
        "rt_firmware": rt_fw,
        "pm_date": pm_date,
        "pm_next_date": pm_next_date, 
        "timestamp": ts_raw,
        "timestamp_utc": ts_utc,
        "timestamp_th": ts_th,
        "source": "chargers + PMReportDB",
    }

def serialize_doc(doc):
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]  # วน list
    if isinstance(doc, dict):
        result = {}
        for k, v in doc.items():
            if isinstance(v, ObjectId):
                result[k] = str(v)              # ObjectId → string
            elif isinstance(v, datetime):
                result[k] = v.isoformat()       # datetime → "2025-02-06T12:00:00"
            elif isinstance(v, Decimal128):
                result[k] = float(v.to_decimal())  # Decimal128 → float
            else:
                result[k] = serialize_doc(v)    # วน recursive ถ้าเป็น nested dict/list
        return result
    return doc

@app.get("/pmreport/get")
async def pmreport_get(sn: str, report_id: str, current: UserClaims = Depends(get_current_user)):
    coll = get_pmreport_collection_for(sn)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")
    doc = await coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return serialize_doc(doc)  # ← ✅ แปลง ObjectId เป็น string

# FIX #2: เพิ่ม auth ให้ pmreport_list
@app.get("/pmreport/list")
async def pmreport_list(
    sn: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current: UserClaims = Depends(get_current_user),
):
    """List PM reports for a charger by SN"""
    coll = get_pmreport_collection_for(sn)
    skip = (page - 1) * pageSize

    cursor = coll.find({}, {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector": 1, "side": 1, "createdAt": 1}).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)
    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    # --- ดึงไฟล์จาก PMReportURL โดย map ด้วย pm_date (string) ---
    pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
    urls_coll = get_pmurl_coll_upload(sn)
    url_by_day: dict[str, str] = {}

    if pm_dates:
        ucur = urls_coll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
        url_docs = await ucur.to_list(length=10_000)
        for u in url_docs:
            day = u.get("pm_date")
            first_url = (u.get("urls") or [None])[0]
            if day and first_url and day not in url_by_day:
                url_by_day[day] = first_url

    items = [{
        "id": str(it["_id"]),
        "issue_id": it.get("issue_id"),
        "doc_name": it.get("doc_name"),
        "pm_date": it.get("pm_date"),
        "inspector": it.get("inspector"),
        "side": it.get("side"),
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("pm_date") or "", ""),
    } for it in items_raw]

    pm_date_arr = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
    return {"items": items, "pm_date": pm_date_arr, "page": page, "pageSize": pageSize, "total": total}


# ใหม่ (query param)
@app.get("/pmreport/latest/{sn}")
async def pmreport_latest_by_path(
    sn: str = Path(..., description="Charger Serial Number"),
    current: UserClaims = Depends(get_current_user),
):
    """Get latest PM info for a charger by SN (path param)"""
    return await _pmreport_latest_core(sn, current)

class PMMeasureRow(BaseModel):
    value: str = ""
    unit: str = "V"

class PMMeasures(BaseModel):
    m16: Dict[str, PMMeasureRow] = Field(default_factory=dict)
    cp: PMMeasureRow = PMMeasureRow()

class PMRowPF(BaseModel):
    pf: Optional[Literal["PASS","FAIL","NA",""]] = ""
    remark: Optional[str] = ""

class PMSubmitIn(BaseModel):
    side: Literal["pre", "post"]
    sn: str  # Changed from station_id to sn
    job: dict
    measures_pre: dict
    rows_pre: Optional[dict[str, Any]] = None
    pm_date: str
    issue_id: Optional[str] = None
    doc_name: Optional[str] = None 
    inspector: Optional[str] = None 

def _get_collections_for_source(
    identifier: str,
    source: Literal["charger", "mdb", "ccb", "cbbox", "station"],
) -> tuple:
    """FIX #5: รวม if/elif chain ไว้ที่เดียว — มี else raise เพื่อป้องกัน unbound variable"""
    if source == "charger":
        _validate_sn(identifier)
        return get_pmreport_collection_for(identifier), get_pmurl_coll_upload(identifier)
    
    if source != "charger":
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

async def _latest_issue_id_anywhere(
    identifier: str,  # sn สำหรับ charger, station_id สำหรับอื่นๆ
    pm_type: str,
    d: date,
    source: Literal["charger", "mdb", "ccb", "cbbox", "station"] = "charger",
) -> str | None:
    """Find latest issue_id from both report and URL collections"""
    # FIX #5: ใช้ helper function แทน if/elif chain ที่ไม่มี else
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
    """Generate next issue_id for a charger"""
    yymm = f"{d.year % 100:02d}{d.month:02d}"
    seq = await db.pm_sequences.find_one_and_update(
        {"sn": sn, "pm_type": pm_type, "yymm": yymm},
        {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"PM-{pm_type}-{yymm}-{int(seq['n']):0{pad}d}"

@app.get("/pmreport/preview-issueid")
async def pmreport_preview_issueid(
    sn: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """Preview next issue_id without actually generating it"""
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    pm_type = "CG"

    latest = await _latest_issue_id_anywhere(sn, pm_type, d)

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"

    if not latest:
        next_issue = f"{prefix}01"
    else:
        m = re.search(r"(\d+)$", latest)
        cur = int(m.group(1)) if m else 0
        next_issue = f"{prefix}{cur+1:02d}"

    return {"issue_id": next_issue}

async def _latest_doc_name_from_pmreport(
    identifier: str,
    pm_date: str,
    source: Literal["charger", "mdb", "ccb", "cbbox", "station"] = "charger",
) -> dict | None:
    """Get latest doc_name from PMReportDB for the same year"""
    # FIX #5: ใช้ helper function
    rep_coll, _ = _get_collections_for_source(identifier, source)
    
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
        year = d.year
    except ValueError:
        return None
    
    pipeline = [
        {
            "$match": {
                "doc_name": {"$regex": f"^{re.escape(identifier)}_\\d+/{year}$"}
            }
        },
        {"$sort": {"_id": -1}},
        {"$limit": 1},
        {"$project": {"_id": 1, "doc_name": 1}}
    ]
    
    cursor = rep_coll.aggregate(pipeline)
    docs = await cursor.to_list(length=1)
    return docs[0] if docs else None

async def _latest_doc_name_anywhere(
    sn: str,
    year: int,
    source: Literal["charger", "mdb", "ccb", "cbbox", "station"] = "charger",
) -> str | None:
    """Find latest doc_name from both report and URL collections"""
    # FIX #5: ใช้ helper function
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

@app.get("/pmreport/latest-docname")
async def pmreport_latest_docname(
    sn: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """Get latest doc_name for calculating next number at frontend"""
    latest = await _latest_doc_name_from_pmreport(sn, pm_date)
    
    return {
        "doc_name": latest.get("doc_name") if latest else None,
        "sn": sn,
        "pm_date": pm_date
    }

async def _next_year_seq(
    db,
    sn: str,
    pm_type: str,
    d: date,
) -> int:
    """Generate next year sequence number for a charger"""
    year = d.year
    seq = await db.pm_year_sequences.find_one_and_update(
        {"sn": sn, "pm_type": pm_type, "year": year},
        {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return int(seq["n"])

@app.get("/pmreport/preview-docname")
async def preview_docname(
    sn: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """Preview next doc_name without actually generating it"""
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    year = d.year

    latest = await _latest_doc_name_anywhere(sn, year)

    if not latest:
        next_doc = f"{sn}_1/{year}"
    else:
        m = re.search(r"_(\d+)/\d{4}$", latest)
        current_num = int(m.group(1)) if m else 0
        next_doc = f"{sn}_{current_num + 1}/{year}"

    return {"doc_name": next_doc}

async def _next_issue_id_no_conflict(db, coll, url_coll, sn, pm_type, d, pad=2):
    """Generate next issue_id with atomic sequence — no while loop"""
    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"
    
    # ใช้ atomic findOneAndUpdate — ไม่ต้อง loop
    seq = await db.pm_sequences.find_one_and_update(
        {"sn": sn, "pm_type": pm_type, "yymm": yymm},
        {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"{prefix}{int(seq['n']):0{pad}d}"

@app.post("/pmreport/pre/submit")
async def pmreport_pre_submit(body: PMSubmitIn, current: UserClaims = Depends(get_current_user)):
    sn = body.sn.strip()
    coll = get_pmreport_collection_for(sn)
    url_coll = get_pmurl_coll_upload(sn)
    db = coll.database

    pm_type = str(body.job.get("pm_type") or "CG").upper()
    body.job["pm_type"] = pm_type

    try:
        d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    # ============ ⚡ รัน parallel แทน sequential ============
    charger_task = _get_charger_by_sn(sn)

    # validate issue_id + doc_name พร้อมกัน
    client_issue = body.issue_id
    client_doc = body.doc_name

    tasks = [charger_task]

    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        if client_issue.startswith(prefix):
            tasks.append(coll.find_one({"issue_id": client_issue}, {"_id": 1}))    # idx 1
            tasks.append(url_coll.find_one({"issue_id": client_issue}, {"_id": 1})) # idx 2
        else:
            tasks.append(asyncio.sleep(0))  # placeholder
            tasks.append(asyncio.sleep(0))
    else:
        tasks.append(asyncio.sleep(0))
        tasks.append(asyncio.sleep(0))

    if client_doc:
        tasks.append(coll.find_one({"doc_name": client_doc}, {"_id": 1}))    # idx 3
        tasks.append(url_coll.find_one({"doc_name": client_doc}, {"_id": 1})) # idx 4
    else:
        tasks.append(asyncio.sleep(0))
        tasks.append(asyncio.sleep(0))

    results = await asyncio.gather(*tasks)

    charger = results[0]
    station_id = charger.get("station_id")

    # ---- resolve issue_id ----
    issue_id = None
    if client_issue and client_issue.startswith(prefix):
        rep_exists, url_exists = results[1], results[2]
        if not rep_exists and not url_exists:
            issue_id = client_issue
    
    if not issue_id:
        issue_id = await _next_issue_id_no_conflict(db, coll, url_coll, sn, pm_type, d)

    # ---- resolve doc_name ----
    doc_name = None
    if client_doc and client_doc.startswith(f"{sn}_"):
        rep_exists, url_exists = results[3], results[4]
        if not rep_exists and not url_exists:
            doc_name = client_doc

    if not doc_name:
        year_seq = await _next_year_seq(db, sn, pm_type, d)
        doc_name = f"{sn}_{year_seq}/{d.year}"

    # ======================================================================
    # ⚡ FIX: Idempotent — ถ้ามี draft สำหรับ sn + pm_date + side="pre"
    #   อยู่แล้ว → update แทน insert → ป้องกัน document ซ้ำ
    # ======================================================================
    existing_draft = await coll.find_one(
        {"sn": sn, "pm_date": body.pm_date, "side": "pre", "status": "draft"},
        {"_id": 1, "issue_id": 1, "doc_name": 1},
    )

    if existing_draft:
        # ⚡ มี draft อยู่แล้ว → update doc เดิม + คืน report_id เดิม
        await coll.update_one(
            {"_id": existing_draft["_id"]},
            {"$set": {
                "station_id": station_id,
                "chargeBoxID": charger.get("chargeBoxID"),
                "job": body.job,
                "rows_pre": body.rows_pre or {},
                "measures_pre": body.measures_pre,
                "inspector": body.inspector,
                "timestamp": datetime.now(timezone.utc),
            }},
        )
        return {
            "ok": True,
            "report_id": str(existing_draft["_id"]),
            "issue_id": existing_draft.get("issue_id") or issue_id,
            "doc_name": existing_draft.get("doc_name") or doc_name,
        }

    # ⚡ ไม่มี draft → insert ใหม่ตามปกติ
    doc = {
        "sn": sn,
        "station_id": station_id,
        "chargeBoxID": charger.get("chargeBoxID"),
        "doc_name": doc_name,
        "issue_id": issue_id,
        "job": body.job,
        "rows_pre": body.rows_pre or {},
        "measures_pre": body.measures_pre,
        "pm_date": body.pm_date,
        "inspector": body.inspector,
        "photos_pre": {},
        "status": "draft",
        "side": body.side,
        "timestamp": datetime.now(timezone.utc),
    }
    res = await coll.insert_one(doc)
    return {"ok": True, "report_id": str(res.inserted_id), "issue_id": issue_id, "doc_name": doc_name}


class PMPostIn(BaseModel):
    report_id: str | None = None
    sn: str  # Changed from station_id to sn
    rows: dict
    measures: dict
    summary: str
    summaryCheck: str | None = None
    dust_filter: Dict[str, bool] | None = None
    side: Literal["post", "after"]

@app.post("/pmreport/submit")
async def pmreport_post_submit(
    body: PMPostIn,
    current: UserClaims = Depends(get_current_user)
):
    """Submit Post-PM report for a charger"""
    sn = body.sn.strip()
    coll = get_pmreport_collection_for(sn)
    db = coll.database
    url_coll = get_pmurl_coll_upload(sn)

    # ---------- กรณี 1: มี report_id → UPDATE doc เดิม ----------
    if body.report_id:
        try:
            oid = ObjectId(body.report_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="invalid report_id")

        existing = await coll.find_one({"_id": oid, "sn": sn})
        if not existing:
            raise HTTPException(status_code=404, detail="Report not found")

        update_fields = {
            "rows": body.rows,
            "measures": body.measures,
            "summary": body.summary,
            "summaryCheck": body.summaryCheck,
            "dust_filter": body.dust_filter,
            "side": "post",
            "timestamp_post": datetime.now(timezone.utc),
        }

        await coll.update_one({"_id": oid}, {"$set": update_fields})

        return {
            "ok": True,
            "report_id": body.report_id,
        }

    # ---------- กรณี 2: ไม่มี report_id ----------
    # Validate charger exists
    charger = await _get_charger_by_sn(sn)

    # ======================================================================
    # ⚡ FIX: Idempotent — ถ้ามี draft สำหรับ sn + side="post" + status="draft"
    #   อยู่แล้ว → update แทน insert → ป้องกัน document ซ้ำ
    # ======================================================================
    existing_draft = await coll.find_one(
        {"sn": sn, "side": "post", "status": "draft"},
        {"_id": 1},
        sort=[("timestamp", -1)],  # เอาอันล่าสุด
    )

    update_fields = {
        "rows": body.rows,
        "measures": body.measures,
        "summary": body.summary,
        "summaryCheck": body.summaryCheck,
        "dust_filter": body.dust_filter,
        "side": "post",
        "timestamp_post": datetime.now(timezone.utc),
    }

    if existing_draft:
        # ⚡ มี draft อยู่แล้ว → update doc เดิม
        await coll.update_one({"_id": existing_draft["_id"]}, {"$set": update_fields})
        return {
            "ok": True,
            "report_id": str(existing_draft["_id"]),
        }

    # ⚡ ไม่มี draft → insert ใหม่
    doc = {
        "sn": sn,
        "station_id": charger.get("station_id"),
        "chargeBoxID": charger.get("chargeBoxID"),
        **update_fields,
        "photos": {},
        "status": "draft",
        "timestamp": datetime.now(timezone.utc),
    }
    res = await coll.insert_one(doc)
    return {
        "ok": True,
        "report_id": str(res.inserted_id),
    }

# ตำแหน่งโฟลเดอร์บนเครื่องเซิร์ฟเวอร์
UPLOADS_ROOT = os.getenv("UPLOADS_ROOT", "./uploads")
os.makedirs(UPLOADS_ROOT, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOADS_ROOT, html=False), name="uploads")

ALLOWED_EXTS = {"jpg","jpeg","png","webp","gif","pdf"}
MAX_FILE_MB = 20

# FIX #4 & #6: เติม unique suffix + ป้องกันชื่อพิเศษ เช่น "." หรือ ".."
def _safe_name(name: str) -> str:
    # ลบอักขระที่ไม่ปลอดภัย
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    # ป้องกันชื่อที่เป็น path พิเศษ (., ..) หรือขึ้นต้นด้วยจุด
    base = base.lstrip(".")
    base = base[:120] if base else ""
    # เติม unique suffix กันไฟล์ชื่อซ้ำทับกัน
    stem, dot, ext = base.rpartition(".")
    if not stem:
        stem = ext or secrets.token_hex(4)
        ext = ""
        dot = ""
    unique = f"{stem}_{secrets.token_hex(3)}{dot}{ext}"
    return unique

def _ext(fname: str) -> str:
    return (fname.rsplit(".",1)[-1].lower() if "." in fname else "")

# FIX #2: เพิ่ม auth ให้ upload pre photos
@app.post("/pmreport/{report_id}/pre/photos")
async def pmreport_upload_pre_photos(
    report_id: str,
    sn: str = Form(...),
    group: str = Form(...),
    files: list[UploadFile] = File(...),
    current: UserClaims = Depends(get_current_user),
):
    """Upload Pre-PM photos for a charger report"""
    if not re.fullmatch(r"g\d+(_\d+)?", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_pmreport_collection_for(sn)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "sn": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("sn") != sn:
        raise HTTPException(status_code=400, detail="sn mismatch")

    # โฟลเดอร์ปลายทาง - ใช้ sn แทน station_id
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "pm" / sn / report_id / "pre" / group
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = _ext(f.filename or "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/pm/{sn}/{report_id}/pre/{group}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {"$push": {f"photos_pre.{group}": {"$each": saved}}}
    )

    return {"ok": True, "count": len(saved), "group": group, "files": saved}

# FIX #2: เพิ่ม auth ให้ upload post photos
@app.post("/pmreport/{report_id}/post/photos")
async def pmreport_upload_post_photos(
    report_id: str,
    sn: str = Form(...),
    group: str = Form(...),
    files: list[UploadFile] = File(...),
    remark: str | None = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    """Upload Post-PM photos for a charger report"""
    if not re.fullmatch(r"g\d+(_\d+)?", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_pmreport_collection_for(sn)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "sn": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("sn") != sn:
        raise HTTPException(status_code=400, detail="sn mismatch")

    # โฟลเดอร์ปลายทาง - ใช้ sn แทน station_id
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "pm" / sn / report_id / "post" / group
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = _ext(f.filename or "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/pm/{sn}/{report_id}/post/{group}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {"$push": {f"photos.{group}": {"$each": saved}}}
    )

    return {"ok": True, "count": len(saved), "group": group, "files": saved}

# FIX #2: เพิ่ม auth ให้ finalize
@app.post("/pmreport/{report_id}/finalize")
async def pmreport_finalize(report_id: str, sn: str = Form(...), current: UserClaims = Depends(get_current_user)):
    coll = get_pmreport_collection_for(sn)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")
    res = await coll.update_one(
        {"_id": oid},
        {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}

def parse_report_date_to_utc(s: str) -> datetime:
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
        tz_th = ZoneInfo("Asia/Bangkok")
        dt_th = datetime.fromisoformat(s + "T00:00:00").replace(tzinfo=tz_th)
        return dt_th.astimezone(timezone.utc)
    if s.endswith("Z"):
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)
    if re.search(r"[+\-]\d{2}:\d{2}$", s):
        return datetime.fromisoformat(s).astimezone(timezone.utc)
    return datetime.fromisoformat(s + "+07:00").astimezone(timezone.utc)

def normalize_pm_date(s: str) -> str:
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
        return s
    if s.endswith("Z") or re.search(r"[+\-]\d{2}:\d{2}$", s):
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    else:
        dt = datetime.fromisoformat(s).replace(tzinfo=th_tz)
    return dt.astimezone(th_tz).date().isoformat()

@app.post("/pmurl/upload-files", status_code=201)
async def pmurl_upload_files(
    sn: str = Form(...),
    reportDate: str = Form(...),
    files: list[UploadFile] = File(...),
    issue_id: Optional[str] = Form(None),
    doc_name: Optional[str] = Form(None),
    inspector: Optional[str] = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    """Upload PM PDF files for a charger"""
    # Validate charger exists
    charger = await _get_charger_by_sn(sn)
    station_id = charger.get("station_id")
    
    coll = get_pmurl_coll_upload(sn)
    pm_date = normalize_pm_date(reportDate)

    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

    pm_type = "CG"

    # -------------------------
    # 1) ตัดสินใจเลือก issue_id
    # -------------------------
    rep_coll = get_pmreport_collection_for(sn)
    final_issue_id: str | None = None
    client_issue = (issue_id or "").strip()

    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        valid_fmt = client_issue.startswith(prefix)

        url_exists = await coll.find_one({"issue_id": client_issue})
        rep_exists = await rep_coll.find_one({"issue_id": client_issue})
        unique = not (url_exists or rep_exists)

        if valid_fmt and unique:
            final_issue_id = client_issue

    # FIX #3: ใช้ atomic sequence แทน while True loop
    if not final_issue_id:
        final_issue_id = await _next_issue_id_no_conflict(
            coll.database, rep_coll, coll, sn, pm_type, d, pad=2
        )

    year_seq: int | None = None

    rep = await get_pmreport_collection_for(sn).find_one(
        {"issue_id": final_issue_id},
        {"year_seq": 1, "pm_date": 1},
    )
    if rep and rep.get("year_seq") is not None:
        year_seq = int(rep["year_seq"])

    if year_seq is None:
        year_seq = await _next_year_seq(coll.database, sn, pm_type, d)

    year = d.year
    final_doc_name: str | None = None

    if doc_name:
        candidate = doc_name.strip()
        ok_format = candidate.startswith(f"{sn}_")

        rep_exists = await rep_coll.find_one({"doc_name": candidate})
        url_exists = await coll.find_one({"doc_name": candidate})
        unique = not (rep_exists or url_exists)

        if ok_format and unique:
            final_doc_name = candidate

    if not final_doc_name:
        final_doc_name = f"{sn}_{year_seq}/{year}"

    doc_name = final_doc_name

    # -------------------------
    # 3) เซฟไฟล์ PDF ลงดิสก์
    # -------------------------
    subdir = pm_date
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "pmurl" / sn / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)

    urls: list[str] = []
    metas: list[dict] = []
    total_size = 0

    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "")
        # FIX #7: ลบเงื่อนไขซ้ำซ้อน — เช็คแค่ ext != "pdf"
        if ext != "pdf":
            raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

        data = await f.read()
        total_size += len(data)
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail=f"File too large (> {MAX_FILE_MB} MB)"
            )

        safe = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
        dest = dest_dir / safe
        with open(dest, "wb") as out:
            out.write(data)

        url = f"/uploads/pmurl/{sn}/{subdir}/{safe}"
        urls.append(url)
        metas.append({"name": f.filename, "size": len(data)})

    inspector_clean = (inspector or "").strip() or None

    # -------------------------
    # 4) บันทึกลง Mongo
    # -------------------------
    now = datetime.now(timezone.utc)
    doc = {
        "sn": sn,
        "station_id": station_id,
        "chargeBoxID": charger.get("chargeBoxID"),
        "pm_date": pm_date,
        "issue_id": final_issue_id,
        "inspector": inspector_clean,
        "year": year,
        "year_seq": year_seq,
        "doc_name": doc_name,
        "urls": urls,
        "meta": {"files": metas},
        "source": "upload-files",
        "createdAt": now,
        "updatedAt": now,
    }
    res = await coll.insert_one(doc)

    return {
        "ok": True,
        "inserted_id": str(res.inserted_id),
        "count": len(urls),
        "urls": urls,
        "issue_id": final_issue_id,
        "year_seq": year_seq,
        "doc_name": doc_name,
        "inspector": inspector_clean,
    }

# FIX #2: เพิ่ม auth ให้ pmurl_list
@app.get("/pmurl/list")
async def pmurl_list(
    sn: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    current: UserClaims = Depends(get_current_user),
):
    """List PM URL documents for a charger"""
    coll = get_pmurl_coll_upload(sn)
    skip = (page - 1) * pageSize

    cursor = coll.find(
        {},
        {"_id": 1, "issue_id": 1, "doc_name": 1, "inspector": 1, "pm_date": 1, "reportDate": 1, "urls": 1, "createdAt": 1}
    ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    def _pm_date_from(doc: dict) -> str | None:
        s = doc.get("pm_date")
        if isinstance(s, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
            return s

        rd = doc.get("reportDate")
        if isinstance(rd, datetime):
            return rd.astimezone(th_tz).date().isoformat()
        if isinstance(rd, str):
            try:
                dt = datetime.fromisoformat(rd.replace("Z", "+00:00"))
            except Exception:
                try:
                    dt = datetime.fromisoformat(rd).replace(tzinfo=th_tz)
                except Exception:
                    return None
            return dt.astimezone(th_tz).date().isoformat()

        return None

    items = []
    pm_date_arr = []

    for it in items_raw:
        pm_date_str = _pm_date_from(it)
        if pm_date_str:
            pm_date_arr.append(pm_date_str)

        urls = it.get("urls") or []
        first_url = urls[0] if urls else ""

        items.append({
            "id": str(it["_id"]),
            "pm_date": pm_date_str, 
            "inspector": it.get("inspector"), 
            "doc_name": it.get("doc_name"),
            "issue_id": it.get("issue_id"),
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": first_url,
            "urls": urls,
        })

    return {
        "items": items,
        "pm_date": [d for d in pm_date_arr if d],
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }

# -------------------------------------------------- PMReportPage (MDB)       
# def get_mdbpmreport_collection_for(station_id: str):
#     _validate_station_id(station_id)
#     return MDBPMReportDB.get_collection(str(station_id))

# def get_mdbpmurl_coll_upload(station_id: str):
#     _validate_station_id(station_id)
#     return MDBPMUrlDB.get_collection(str(station_id))

# class MDBPMSubmitIn(BaseModel):
#     side: Literal["pre", "post"]
#     station_id: str
#     job: Dict[str, Any]         # โครงงาน (location/date/inspector ฯลฯ)
#     measures_pre: Dict[str, Dict[str, Any]] 
#     # rows: Dict[str, Dict[str, Any]]  # {"r1": {"pf": "...", "remark": "..."}, ...}
#     # measures: Dict[str, Dict[str, Any]]  # {"m4": {...}, "m5": {...}, ..., "m8": {...}}
#     # summary: str
#     pm_date: str                # "YYYY-MM-DD"
#     issue_id: Optional[str] = None
#     doc_name: Optional[str] = None
#     # summaryCheck: Optional[Literal["PASS","FAIL","NA"]] = None
#     inspector: Optional[str] = None 
#     # dust_filter: Optional[str] = None

@app.get("/mdbpmreport/preview-issueid")
async def mdbpmreport_preview_issueid(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดู issue_id ถัดไป (PM-CG-YYMM-XX) โดยไม่ออกเลขจริง
    ใช้หาเลขไปโชว์บนฟอร์มเฉย ๆ
    """
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    pm_type = "MB"

    latest = await _latest_issue_id_anywhere(station_id, pm_type, d,source="mdb")

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"

    if not latest:
        next_issue = f"{prefix}01"
    else:
        m = re.search(r"(\d+)$", latest)
        cur = int(m.group(1)) if m else 0
        next_issue = f"{prefix}{cur+1:02d}"

    return {"issue_id": next_issue}

# @app.get("/mdbpmreport/latest-docname")
# async def mdbpmreport_latest_docname(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """
#     ดึง doc_name ล่าสุดของสถานี (ปีเดียวกับ pm_date)
#     เพื่อใช้คำนวณเลขถัดไปที่ frontend
#     """
#     # auth ถ้าต้องการ
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
    
#     latest = await _latest_doc_name_from_pmreport(station_id, pm_date, source="mdb")
    
#     return {
#         "doc_name": latest.get("doc_name") if latest else None,
#         "station_id": station_id,
#         "pm_date": pm_date
#     }

@app.get("/mdbpmreport/preview-docname")
async def preview_docname(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    year = d.year

    latest = await _latest_doc_name_anywhere(station_id, year,source="mdb")

    if not latest:
        next_doc = f"{station_id}_1/{year}"
    else:
        import re
        m = re.search(r"_(\d+)/\d{4}$", latest)
        current_num = int(m.group(1)) if m else 0
        next_doc = f"{station_id}_{current_num + 1}/{year}"

    return {"doc_name": next_doc}

# @app.post("/mdbpmreport/pre/submit")
# async def mdbpmreport_submit(body: MDBPMSubmitIn, current: UserClaims = Depends(get_current_user)):
#     station_id = body.station_id.strip()
#     coll = get_mdbpmreport_collection_for(station_id)
#     db = coll.database

#     pm_type = str(body.job.get("pm_type") or "MB").upper()
#     body.job["pm_type"] = pm_type

#     url_coll = get_mdbpmurl_coll_upload(station_id)

#     try:
#         d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     client_issue = body.issue_id 
#     issue_id: str | None = None    

#     if client_issue:
#         yymm = f"{d.year % 100:02d}{d.month:02d}"
#         prefix = f"PM-{pm_type}-{yymm}-"
#         valid_fmt = client_issue.startswith(prefix)
#         # unique = not await coll.find_one({"station_id": station_id, "issue_id": client_issue})
#         rep_exists = await coll.find_one({"station_id": station_id, "issue_id": client_issue})
#         url_exists = await url_coll.find_one({"issue_id": client_issue})
#         unique = not (rep_exists or url_exists)

#         if valid_fmt and unique:
#             issue_id = client_issue

#     if not issue_id:
#         while True:
#             candidate = await _next_issue_id(db, station_id, pm_type, d, pad=2)
#             rep_exists = await coll.find_one({"issue_id": candidate})
#             url_exists = await url_coll.find_one({"issue_id": candidate})
#             if not rep_exists and not url_exists:
#                 issue_id = candidate
#                 break

#     client_docName = body.doc_name
#     doc_name = None
#     if client_docName:
#         year = f"{d.year}"
#         prefix = f"{station_id}_"
#         valid_fmt = client_docName.startswith(prefix)

#         url_coll = get_mdbpmurl_coll_upload(station_id)
#         rep_exists = await coll.find_one({"station_id": station_id, "doc_name": client_docName})
#         url_exists = await url_coll.find_one({"doc_name": client_docName})
#         unique = not (rep_exists or url_exists)

#         if valid_fmt and unique:
#             doc_name = client_docName
 
#     if not doc_name:
#         year_seq = await _next_year_seq(db, station_id, pm_type, d)
#         year = d.year
#         doc_name = f"{station_id}_{year_seq}/{year}"

#     inspector = body.inspector
#     doc = {
#         "station_id": station_id,
#         "doc_name": doc_name,
#         "issue_id": issue_id,
#         "job": body.job,
#         # "rows": body.rows,
#         "measures_pre": body.measures_pre,         # m4..m8
#         # "summary": body.summary,
#         # "summaryCheck": body.summaryCheck,
#         "pm_date": body.pm_date,           # string YYYY-MM-DD (ตามฟรอนต์)
#         "inspector": inspector,
#         # "dust_filter": body.dust_filter,
#         "photos_pre": {},
#         "status": "draft",
#         "side": body.side,
#         # "createdAt": datetime.now(timezone.utc),
#         # "updatedAt": datetime.now(timezone.utc),
#         "timestamp": datetime.now(timezone.utc),

#     }

#     res = await coll.insert_one(doc)
#     return {
#         "ok": True, 
#         "report_id": str(res.inserted_id), 
#         "issue_id": issue_id,
#         "doc_name": doc_name,
#     }

# class MDBPMPostIn(BaseModel):
#     report_id: str | None = None      # 👈 เพิ่ม
#     station_id: str
#     # issue_id: str | None = None
#     # job: dict
#     rows: dict
#     measures: dict
#     summary: str
#     # pm_date: str
#     # doc_name: str | None = None
#     summaryCheck: str | None = None
#     dust_filter: str | None = None
#     side: Literal["post", "after"]

# @app.post("/mdbpmreport/submit")
# async def mdbpmreport_submit(body: MDBPMPostIn, current: UserClaims = Depends(get_current_user)):
#     station_id = body.station_id.strip()
#     coll = get_mdbpmreport_collection_for(station_id)
#     db = coll.database

#     url_coll = get_mdbpmurl_coll_upload(station_id)

#     if body.report_id:
#         try:
#             oid = ObjectId(body.report_id)
#         except InvalidId:
#             raise HTTPException(status_code=400, detail="invalid report_id")

#         existing = await coll.find_one({"_id": oid, "station_id": station_id})
#         if not existing:
#             raise HTTPException(status_code=404, detail="Report not found")

#         update_fields = {
#             # "job": body.job,
#             "rows": body.rows,
#             "measures": body.measures,          # ใช้เป็นค่าหลัง PM
#             "summary": body.summary,
#             "summaryCheck": body.summaryCheck,
#             # "pm_date": body.pm_date,
#             # "inspector": inspector,
#             "dust_filter": body.dust_filter,
#             # "doc_name": doc_name,
#             "side": "post",                     # ตอนนี้อยู่ฝั่ง post แล้ว
#             "timestamp_post": datetime.now(timezone.utc),
#         }

#         await coll.update_one({"_id": oid}, {"$set": update_fields})

#         return {
#             "ok": True,
#             "report_id": body.report_id,
#             # "issue_id": issue_id,
#             # "doc_name": doc_name,
#         }
    
#     doc = {
#         "station_id": station_id,
#         # "doc_name": doc_name,
#         # "issue_id": issue_id,
#         # "job": body.job,
#         "rows": body.rows,
#         "measures": body.measures,         # m4..m8
#         "summary": body.summary,
#         "summaryCheck": body.summaryCheck,
#         # "pm_date": body.pm_date,           # string YYYY-MM-DD (ตามฟรอนต์)
#         # "inspector": inspector,
#         "dust_filter": body.dust_filter,
#         "status": "draft",
#         "photos": {},                      # จะถูกเติมใน /photos
#         # "createdAt": datetime.now(timezone.utc),
#         # "updatedAt": datetime.now(timezone.utc),
#         "side": "post",
#         "timestamp": datetime.now(timezone.utc),
#     }

#     res = await coll.insert_one(doc)
#     return {
#         "ok": True, 
#         "report_id": str(res.inserted_id), 
#         # "issue_id": issue_id,
#         # "doc_name": doc_name,
#     }

# @app.get("/mdbpmreport/get")
# async def mdbpmreport_get(station_id: str, report_id: str, current: UserClaims = Depends(get_current_user)):
#     coll = get_mdbpmreport_collection_for(station_id)
#     doc = await coll.find_one({"_id": ObjectId(report_id)})
#     if not doc:
#         raise HTTPException(status_code=404, detail="not found")

#     doc["_id"] = str(doc["_id"])
#     return doc

# @app.get("/mdbpmreport/list")
# async def mdbpmreport_list(
#     station_id: str = Query(...),
#     page: int = Query(1, ge=1),
#     pageSize: int = Query(20, ge=1, le=100),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")

#     coll = get_mdbpmreport_collection_for(station_id)
#     skip = (page - 1) * pageSize

#     cursor = coll.find({}, {"_id": 1, "issue_id": 1, "doc_name": 1 , "pm_date": 1,"inspector":1,"side":1, "createdAt": 1}).sort(
#         [("createdAt", -1), ("_id", -1)]
#     ).skip(skip).limit(pageSize)

#     items_raw = await cursor.to_list(length=pageSize)
#     total = await coll.count_documents({})

#     # ผูก URL PDF รายวันจาก MDBPMUrlDB (ถ้ามี)
#     pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
#     url_by_day: Dict[str, str] = {}
#     if pm_dates:
#         ucoll = get_mdbpmurl_coll_upload(station_id)
#         ucur = ucoll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
#         url_docs = await ucur.to_list(length=10_000)
#         for u in url_docs:
#             day = u.get("pm_date")
#             first_url = (u.get("urls") or [None])[0]
#             if day and first_url and day not in url_by_day:
#                 url_by_day[day] = first_url

#     items = [{
#         "id": str(it["_id"]),
#         "issue_id": it.get("issue_id"),
#         "doc_name": it.get("doc_name"),
#         "inspector": it.get(("inspector")),
#         "side":it.get("side"), 
#         "pm_date": it.get("pm_date"),
#         "createdAt": _ensure_utc_iso(it.get("createdAt")),
#         "file_url": url_by_day.get(it.get("pm_date") or "", ""),
#     } for it in items_raw]

#     return {"items": items, "pm_date": [it.get("pm_date") for it in items_raw if it.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}

# @app.post("/mdbpmreport/{report_id}/pre/photos")
# async def mdbpmreport_upload_photos(
#     report_id: str,
#     station_id: str = Form(...),
#     group: str = Form(...),                   # เช่น "g1" .. "g10"
#     files: list[UploadFile] = File(...),
#     # remark: str | None = Form(None),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
#     # Accept both formats: "g1", "g2" (simple questions) and "r9_1", "r9_2" (group sub-items)
#     if not re.fullmatch(r"(g\d+|r\d+_\d+)", group):
#         raise HTTPException(status_code=400, detail=f"Bad group key format: {group}")

#     # Map group key to database storage key:
#     # - "g1" -> "g1", "g2" -> "g2", etc. (keep g prefix)
#     # - "r9_1", "r9_2", "r9_3", "r9_4" -> "g9" (all merged into question 9 with g prefix)
#     storage_key = group
#     group_match = re.match(r"r(\d+)_\d+", group)
#     if group_match:  # Convert r9_1 format to g9
#         question_num = group_match.group(1)  # Extract question number (e.g., "9")
#         storage_key = f"g{question_num}"  # Add g prefix for database
#     # else: keep group as-is (e.g., "g1" stays "g1")

#     coll = get_mdbpmreport_collection_for(station_id)
#     from bson import ObjectId
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     # ยืนยันว่ารายงานนี้อยู่ใน station นี้
#     doc = await coll.find_one({"_id": oid}, {"_id":1, "station_id":1})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Report not found")
#     if doc.get("station_id") != station_id:
#         raise HTTPException(status_code=400, detail="station_id mismatch")

#     # โฟลเดอร์ปลายทาง (use storage_key for consistent path)
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "mdbpm" / station_id / report_id  / "pre" / storage_key
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     saved = []
#     total = 0
#     for f in files:
#         ext = _ext(f.filename or "")
#         if ext not in ALLOWED_EXTS:
#             raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

#         data = await f.read()
#         total += len(data)
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         # URL สำหรับแสดงบน Frontend (use storage_key for consistent URL)
#         url_path = f"/uploads/mdbpm/{station_id}/{report_id}/pre/{storage_key}/{fname}"
#         saved.append({
#             "filename": fname,
#             "size": len(data),
#             "url": url_path,
#             # "remark": remark or "",
#             "uploadedAt": datetime.now(timezone.utc)
#         })

#     # อัปเดตเอกสาร PMReport: push ลง photos_pre.<storage_key>
#     # Note: storage_key already calculated above
#     await coll.update_one(
#         {"_id": oid},
#         {"$push": {f"photos_pre.{storage_key}": {"$each": saved}}}
#     )

#     return {"ok": True, "count": len(saved), "group": group, "files": saved}



# @app.post("/mdbpmreport/{report_id}/post/photos")
# async def mdbpmreport_upload_photos(
#     report_id: str,
#     station_id: str = Form(...),
#     group: str = Form(...),                   # "g1" .. "g11"
#     files: List[UploadFile] = File(...),
#     remark: Optional[str] = Form(None),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
#     # Accept both formats: "g1", "g2" (simple questions) and "r9_1", "r9_2" (group sub-items)
#     if not re.fullmatch(r"(g\d+|r\d+_\d+)", group):
#         raise HTTPException(status_code=400, detail=f"Bad group key format: {group}")

#     # Map group key to database storage key:
#     # - "g1" -> "g1", "g2" -> "g2", etc. (keep g prefix)
#     # - "r9_1", "r9_2", "r9_3", "r9_4" -> "g9" (all merged into question 9 with g prefix)
#     storage_key = group
#     group_match = re.match(r"r(\d+)_\d+", group)
#     if group_match:  # Convert r9_1 format to g9
#         question_num = group_match.group(1)  # Extract question number (e.g., "9")
#         storage_key = f"g{question_num}"  # Add g prefix for database
#     # else: keep group as-is (e.g., "g1" stays "g1")

#     coll = get_mdbpmreport_collection_for(station_id)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Report not found")
#     if doc.get("station_id") != station_id:
#         raise HTTPException(status_code=400, detail="station_id mismatch")

#     # โฟลเดอร์: /uploads/mdbpm/{station_id}/{report_id}/{group}/
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "mdbpm" / station_id / report_id / "post" / storage_key
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     saved = []
#     for f in files:
#         ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext not in ALLOWED_EXTS:
#             raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url_path = f"/uploads/mdbpm/{station_id}/{report_id}/post/{storage_key}/{fname}"
#         saved.append({
#             "filename": fname,
#             "size": len(data),
#             "url": url_path,
#             "remark": remark or "",
#             "uploadedAt": datetime.now(timezone.utc)
#         })

#     # Note: storage_key mapping already done above (before file operations)
#     await coll.update_one(
#         {"_id": oid},
#         {
#             "$push": {f"photos.{storage_key}": {"$each": saved}},
#             "$set": {"updatedAt": datetime.now(timezone.utc)}
#         }
#     )
#     return {"ok": True, "count": len(saved), "group": group, "files": saved}

# @app.post("/mdbpmreport/{report_id}/finalize")
# async def mdbpmreport_finalize(
#     report_id: str,
#     station_id: str = Form(...),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")

#     coll = get_mdbpmreport_collection_for(station_id)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     # (ออปชัน) ตรวจความครบถ้วนก่อน finalize ได้ที่นี่
#     res = await coll.update_one(
#         {"_id": oid},
#         {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}}
#     )
#     if res.matched_count == 0:
#         raise HTTPException(status_code=404, detail="Report not found")
#     return {"ok": True}

# @app.post("/mdbpmurl/upload-files", status_code=201)
# async def mdbpmurl_upload_files(
#     station_id: str = Form(...),
#     reportDate: str = Form(...),            # "YYYY-MM-DD" หรือ ISO -> จะ normalize เป็น YYYY-MM-DD
#     files: List[UploadFile] = File(...),    # อนุญาตเฉพาะ .pdf
#     issue_id: Optional[str] = Form(None),
#     doc_name: Optional[str] = Form(None),
#     inspector: Optional[str] = Form(None),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     coll = get_mdbpmurl_coll_upload(station_id)
#     pm_date = normalize_pm_date(reportDate)  # คืน YYYY-MM-DD

#     # เก็บไว้ที่ /uploads/mdbpmurl/<station_id>/<YYYY-MM-DD>/
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "mdbpmurl" / station_id / pm_date
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     pm_type = "MB"
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

#     rep_coll = get_mdbpmreport_collection_for(station_id)
#     final_issue_id = None
#     client_issue = (issue_id or "").strip()

#     if client_issue:
#         yymm = f"{d.year % 100:02d}{d.month:02d}"
#         prefix = f"PM-{pm_type}-{yymm}-"
#         valid_fmt = client_issue.startswith(prefix)

#         url_exists = await coll.find_one({"issue_id": client_issue})
#         rep_exists = await rep_coll.find_one({"issue_id": client_issue})
#         unique = not (url_exists or rep_exists)

#         if valid_fmt and unique:
#             final_issue_id = client_issue

#     if not final_issue_id:
#         while True:
#             candidate = await _next_issue_id(coll.database, station_id, pm_type, d, pad=2)
#             url_exists = await coll.find_one({"issue_id": candidate})
#             rep_exists = await rep_coll.find_one({"issue_id": candidate})
#             if not url_exists and not rep_exists:
#                 final_issue_id = candidate
#                 break

#     year_seq: int | None = None

#     # พยายาม reuse year_seq จาก PMReportDB ถ้ามีอยู่แล้ว (issue_id เดียวกัน)
#     rep = await get_mdbpmreport_collection_for(station_id).find_one(
#         {"issue_id": final_issue_id},
#         {"year_seq": 1, "pm_date": 1},
#     )
#     if rep and rep.get("year_seq") is not None:
#         year_seq = int(rep["year_seq"])

#     # ถ้าไม่มีค่า year_seq จาก PMReport → ออกใหม่จาก pm_year_sequences
#     if year_seq is None:
#         year_seq = await _next_year_seq(coll.database, station_id, pm_type, d)

#     year = d.year
#     final_doc_name: str | None = None

#     if doc_name:
#         candidate = doc_name.strip()

#         ok_format = candidate.startswith(f"{station_id}_")

#         rep_coll = get_mdbpmreport_collection_for(station_id)
#         rep_exists = await rep_coll.find_one({"doc_name": candidate})
#         url_exists = await coll.find_one({"doc_name": candidate})
#         unique = not (rep_exists or url_exists)

#         if ok_format and unique:
#             final_doc_name = candidate

#     if not final_doc_name:
#         final_doc_name = f"{station_id}_{year_seq}/{year}"

#     doc_name = final_doc_name

#     # เก็บไว้ที่ /uploads/mdbpmurl/<station_id>/<YYYY-MM-DD>/
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "mdbpmurl" / station_id / pm_date
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     urls, metas = [], []
#     for f in files:
#         ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext != "pdf":
#             raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url = f"/uploads/mdbpmurl/{station_id}/{pm_date}/{fname}"
#         urls.append(url)
#         metas.append({"name": f.filename, "size": len(data)})

#     inspector_clean = (inspector or "").strip() or None
#     now = datetime.now(timezone.utc)
#     res = await coll.insert_one({
#         "station": station_id,
#         "pm_date": pm_date,
#         "inspector": inspector_clean,
#         "doc_name": doc_name,
#         "issue_id": final_issue_id, 
#         "urls": urls,
#         "meta": {"files": metas},
#         "source": "upload-files",
#         "createdAt": now,
#         "updatedAt": now,
#     })
#     return {"ok": True, "inserted_id": str(res.inserted_id), "count": len(urls), "urls": urls,"issue_id": final_issue_id,"doc_name": doc_name,"inspector": inspector_clean,}

# @app.get("/mdbpmurl/list")
# async def mdbpmurl_list(
#     station_id: str = Query(...),
#     page: int = Query(1, ge=1),
#     pageSize: int = Query(20, ge=1, le=100),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     coll = get_mdbpmurl_coll_upload(station_id)
#     skip = (page - 1) * pageSize

#     cursor = coll.find(
#         {},
#         {"_id": 1, "issue_id": 1, "doc_name": 1,"inspector":1, "pm_date": 1, "urls": 1, "createdAt": 1}
#     ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

#     items_raw = await cursor.to_list(length=pageSize)
#     total = await coll.count_documents({})

#     items = []
#     for it in items_raw:
#         urls = it.get("urls") or []
#         first_url = urls[0] if urls else ""
#         items.append({
#             "id": str(it["_id"]),
#             "pm_date": it.get("pm_date"),
#             "issue_id": it.get("issue_id"),
#             "inspector": it.get(("inspector")), 
#             "doc_name": it.get("doc_name"),
#             "createdAt": _ensure_utc_iso(it.get("createdAt")),
#             "file_url": first_url,
#             "urls": urls,
#         })

#     return {"items": items, "pm_date": [i["pm_date"] for i in items if i.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}

# ------------------------------------------------------------------
# new PM Report (MDB)
# ------------------------------------------------------------------

# ============================================
# MDB PM Report Backend - Updated for New Structure
# ============================================
# 
# การเปลี่ยนแปลงหลัก:
# 1. ข้อ 4 - Dynamic Breaker Main (เพิ่มได้หลายตัว)
# 2. ข้อ 5 - Breaker Charger ตามจำนวน charger จริง
# 3. โครงสร้างคำถามใหม่ 9 ข้อ (แทน 11 ข้อเดิม)
# 4. Photo upload รองรับ key format ใหม่
#
# ============================================

def get_mdbpmreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    return MDBPMReportDB.get_collection(str(station_id))

def get_mdbpmurl_coll_upload(station_id: str):
    _validate_station_id(station_id)
    return MDBPMUrlDB.get_collection(str(station_id))

from pydantic import BaseModel
from typing import Dict, Any, Optional, List, Literal
from datetime import datetime, timezone
from fastapi import HTTPException, Query, Form, File, UploadFile, Depends
from bson import ObjectId
from bson.errors import InvalidId
import re
import pathlib
import secrets

# ============================================
# 1. UPDATE: MDBPMSubmitIn (Pre-PM)
# ============================================

class MDBPMSubmitIn(BaseModel):
    side: Literal["pre", "post"]
    station_id: str
    job: Dict[str, Any]
    measures_pre: Dict[str, Any]
    rows_pre: Optional[Dict[str, Dict[str, Any]]] = None 
    q4_items: Optional[List[Dict[str, str]]] = None  
    charger_count: Optional[int] = None  
    pm_date: str
    issue_id: Optional[str] = None
    doc_name: Optional[str] = None
    inspector: Optional[str] = None


# ============================================
# 2. UPDATE: MDBPMPostIn (Post-PM)
# ============================================

class MDBPMPostIn(BaseModel):
    report_id: Optional[str] = None
    station_id: str
    rows: Dict[str, Any]
    measures: Dict[str, Any]
    summary: str
    summaryCheck: Optional[str] = None
    dust_filter: Optional[str] = None
    side: Literal["post", "after"]

# ============================================
# 3. UPDATE: Pre-PM Submit Endpoint
# ============================================

@app.post("/mdbpmreport/pre/submit")
async def mdbpmreport_pre_submit(body: MDBPMSubmitIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    coll = get_mdbpmreport_collection_for(station_id)
    db = coll.database

    pm_type = str(body.job.get("pm_type") or "MB").upper()
    body.job["pm_type"] = pm_type

    url_coll = get_mdbpmurl_coll_upload(station_id)

    try:
        d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    # Issue ID logic (unchanged)
    client_issue = body.issue_id 
    issue_id: str | None = None    

    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        valid_fmt = client_issue.startswith(prefix)
        rep_exists = await coll.find_one({"station_id": station_id, "issue_id": client_issue})
        url_exists = await url_coll.find_one({"issue_id": client_issue})
        unique = not (rep_exists or url_exists)

        if valid_fmt and unique:
            issue_id = client_issue

    if not issue_id:
        while True:
            candidate = await _next_issue_id(db, station_id, pm_type, d, pad=2)
            rep_exists = await coll.find_one({"issue_id": candidate})
            url_exists = await url_coll.find_one({"issue_id": candidate})
            if not rep_exists and not url_exists:
                issue_id = candidate
                break

    # Doc name logic (unchanged)
    client_docName = body.doc_name
    doc_name = None
    if client_docName:
        year = f"{d.year}"
        prefix = f"{station_id}_"
        valid_fmt = client_docName.startswith(prefix)

        rep_exists = await coll.find_one({"station_id": station_id, "doc_name": client_docName})
        url_exists = await url_coll.find_one({"doc_name": client_docName})
        unique = not (rep_exists or url_exists)

        if valid_fmt and unique:
            doc_name = client_docName
 
    if not doc_name:
        year_seq = await _next_year_seq(db, station_id, pm_type, d)
        year = d.year
        doc_name = f"{station_id}_{year_seq}/{year}"

    inspector = body.inspector
    
    # === UPDATED DOCUMENT STRUCTURE ===
    doc = {
        "station_id": station_id,
        "doc_name": doc_name,
        "issue_id": issue_id,
        "job": body.job,
        
        # NEW: Store measures_pre with new structure
        # {
        #   "m4": {"r4_1": {"L1-N": {"value": "220", "unit": "V"}, ...}, "r4_2": {...}},
        #   "m5": {"r5_1": {...}, "r5_2": {...}},
        #   "m6": {"L1-N": {...}, ...}
        # }
        "measures_pre": body.measures_pre,
        
        # NEW: Store rows_pre
        "rows_pre": body.rows_pre or {},
        
        # NEW: Store dynamic items configuration
        "q4_items": body.q4_items or [{"key": "r4_1", "label": "4.1) Breaker Main ตัวที่ 1"}],
        "charger_count": body.charger_count or 1,
        
        "pm_date": body.pm_date,
        "inspector": inspector,
        "photos_pre": {},
        "status": "draft",
        "side": body.side,
        "timestamp": datetime.now(timezone.utc),
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id), 
        "issue_id": issue_id,
        "doc_name": doc_name,
    }


# ============================================
# 4. UPDATE: Post-PM Submit Endpoint
# ============================================

@app.post("/mdbpmreport/submit")
async def mdbpmreport_post_submit(body: MDBPMPostIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    coll = get_mdbpmreport_collection_for(station_id)

    if body.report_id:
        try:
            oid = ObjectId(body.report_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="invalid report_id")

        existing = await coll.find_one({"_id": oid, "station_id": station_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Report not found")

        update_fields = {
            "rows": body.rows,
            
            # NEW: measures with new structure
            # {
            #   "m4": {"r4_1": {...}, "r4_2": {...}},
            #   "m5": {"r5_1": {...}, "r5_2": {...}},
            #   "m6": {...}
            # }
            "measures": body.measures,
            
            "summary": body.summary,
            "summaryCheck": body.summaryCheck,
            "dust_filter": body.dust_filter,
            "side": "post",
            "timestamp_post": datetime.now(timezone.utc),
        }

        await coll.update_one({"_id": oid}, {"$set": update_fields})

        return {
            "ok": True,
            "report_id": body.report_id,
        }
    
    # Insert new (fallback - normally should update existing)
    doc = {
        "station_id": station_id,
        "rows": body.rows,
        "measures": body.measures,
        "summary": body.summary,
        "summaryCheck": body.summaryCheck,
        "dust_filter": body.dust_filter,
        "status": "draft",
        "photos": {},
        "side": "post",
        "timestamp": datetime.now(timezone.utc),
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id), 
    }


# ============================================
# 5. UPDATE: Photo Upload - Support New Key Formats
# ============================================

# NEW: Updated regex pattern to support all key formats
PHOTO_GROUP_PATTERN = r"(g\d+|r\d+_\d+)"

# Key formats:
# - g1, g2, g3     -> Simple questions (Q1, Q2, Q3)
# - r4_1, r4_2     -> Dynamic Breaker Main items
# - r5_1, r5_2     -> Charger Breaker items  
# - g6             -> CCB (Q6)
# - r7_1, r7_2...  -> Trip Test items (Q7)
# - g8, g9         -> Simple questions (Q8, Q9)

@app.post("/mdbpmreport/{report_id}/pre/photos")
async def mdbpmreport_upload_photos_pre(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),
    files: List[UploadFile] = File(...),
):
    # Validate group format
    if not re.fullmatch(PHOTO_GROUP_PATTERN, group):
        raise HTTPException(status_code=400, detail=f"Bad group key format: {group}")

    # === UPDATED: Storage key mapping ===
    # For dynamic items (r4_1, r4_2, r5_1, r5_2, r7_1, etc.), keep the full key
    # For simple questions (g1, g2, etc.), keep as-is
    storage_key = group
    
    # Special handling for Trip Test (Q7) - merge into g7
    if re.match(r"r7_\d+", group):
        storage_key = "g7"

    coll = get_mdbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    # Folder path
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "mdbpm" / station_id / report_id / "pre" / storage_key
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = _ext(f.filename or "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/mdbpm/{station_id}/{report_id}/pre/{storage_key}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "uploadedAt": datetime.now(timezone.utc)
        })

    # Update document
    await coll.update_one(
        {"_id": oid},
        {"$push": {f"photos_pre.{storage_key}": {"$each": saved}}}
    )

    return {"ok": True, "count": len(saved), "group": group, "storage_key": storage_key, "files": saved}


@app.post("/mdbpmreport/{report_id}/post/photos")
async def mdbpmreport_upload_photos_post(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),
    files: List[UploadFile] = File(...),
    remark: Optional[str] = Form(None),
):
    # Validate group format
    if not re.fullmatch(PHOTO_GROUP_PATTERN, group):
        raise HTTPException(status_code=400, detail=f"Bad group key format: {group}")

    # Storage key mapping (same as pre)
    # storage_key = group
    # if re.match(r"r7_\d+", group):
    #     storage_key = "g7"
    storage_key = group

    coll = get_mdbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    dest_dir = pathlib.Path(UPLOADS_ROOT) / "mdbpm" / station_id / report_id / "post" / storage_key
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/mdbpm/{station_id}/{report_id}/post/{storage_key}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos.{storage_key}": {"$each": saved}},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    return {"ok": True, "count": len(saved), "group": group, "storage_key": storage_key, "files": saved}


# ============================================
# 6. UPDATE: Get Report - Return New Fields
# ============================================

@app.get("/mdbpmreport/get")
async def mdbpmreport_get(station_id: str, report_id: str, current: UserClaims = Depends(get_current_user)):
    coll = get_mdbpmreport_collection_for(station_id)
    doc = await coll.find_one({"_id": ObjectId(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="not found")

    doc["_id"] = str(doc["_id"])
    
    # Ensure new fields are present (for backward compatibility)
    if "q4_items" not in doc:
        doc["q4_items"] = [{"key": "r4_1", "label": "4.1) Breaker Main ตัวที่ 1"}]
    if "charger_count" not in doc:
        doc["charger_count"] = 1
    if "rows_pre" not in doc:
        doc["rows_pre"] = {}
    
    return doc


# ============================================
# 7. UPDATE: List Endpoint - Include New Fields
# ============================================

@app.get("/mdbpmreport/list")
async def mdbpmreport_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    coll = get_mdbpmreport_collection_for(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find(
        {}, 
        {
            "_id": 1, 
            "issue_id": 1, 
            "doc_name": 1, 
            "pm_date": 1,
            "inspector": 1,
            "side": 1, 
            "createdAt": 1,
            "charger_count": 1,  # NEW
        }
    ).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    # URL mapping (unchanged)
    pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
    url_by_day: Dict[str, str] = {}
    if pm_dates:
        ucoll = get_mdbpmurl_coll_upload(station_id)
        ucur = ucoll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
        url_docs = await ucur.to_list(length=10_000)
        for u in url_docs:
            day = u.get("pm_date")
            first_url = (u.get("urls") or [None])[0]
            if day and first_url and day not in url_by_day:
                url_by_day[day] = first_url

    items = [{
        "id": str(it["_id"]),
        "issue_id": it.get("issue_id"),
        "doc_name": it.get("doc_name"),
        "inspector": it.get("inspector"),
        "side": it.get("side"), 
        "pm_date": it.get("pm_date"),
        "charger_count": it.get("charger_count", 1),  # NEW
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("pm_date") or "", ""),
    } for it in items_raw]

    return {
        "items": items, 
        "pm_date": [it.get("pm_date") for it in items_raw if it.get("pm_date")], 
        "page": page, 
        "pageSize": pageSize, 
        "total": total
    }


# -------------------------------------------------- PMReportPage (CCB)       
# def get_ccbpmreport_collection_for(station_id: str):
#     _validate_station_id(station_id)
#     return CCBPMReportDB.get_collection(str(station_id))

# def get_ccbpmurl_coll_upload(station_id: str):
#     _validate_station_id(station_id)
#     return CCBPMUrlDB.get_collection(str(station_id))

# class CCBPMSubmitIn(BaseModel):
#     side: Literal["pre", "post"]
#     station_id: str
#     job: Dict[str, Any]         # โครงงาน (location/date/inspector ฯลฯ)
#     # rows: Dict[str, Dict[str, Any]]  # {"r1": {"pf": "...", "remark": "..."}, ...}
#     measures_pre : Dict[str, Dict[str, Any]]  # {"m4": {...}, "m5": {...}, ..., "m8": {...}}
#     # summary: str
#     pm_date: str                # "YYYY-MM-DD"
#     issue_id: Optional[str] = None
#     doc_name: Optional[str] = None 
#     # summaryCheck: Optional[Literal["PASS","FAIL","NA"]] = None
#     inspector: Optional[str] = None

# @app.get("/ccbpmreport/preview-issueid")
# async def ccbpmreport_preview_issueid(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """
#     ดู issue_id ถัดไป (PM-CG-YYMM-XX) โดยไม่ออกเลขจริง
#     ใช้หาเลขไปโชว์บนฟอร์มเฉย ๆ
#     """
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     pm_type = "CC"

#     latest = await _latest_issue_id_anywhere(station_id, pm_type, d,source="ccb")

#     yymm = f"{d.year % 100:02d}{d.month:02d}"
#     prefix = f"PM-{pm_type}-{yymm}-"

#     if not latest:
#         next_issue = f"{prefix}01"
#     else:
#         m = re.search(r"(\d+)$", latest)
#         cur = int(m.group(1)) if m else 0
#         next_issue = f"{prefix}{cur+1:02d}"

#     return {"issue_id": next_issue}

# @app.get("/ccbpmreport/latest-docname")
# async def ccbpmreport_latest_docname(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """
#     ดึง doc_name ล่าสุดของสถานี (ปีเดียวกับ pm_date)
#     เพื่อใช้คำนวณเลขถัดไปที่ frontend
#     """
#     # auth ถ้าต้องการ
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
    
#     latest = await _latest_doc_name_from_pmreport(station_id, pm_date, source="ccb")
    
#     return {
#         "doc_name": latest.get("doc_name") if latest else None,
#         "station_id": station_id,
#         "pm_date": pm_date
#     }

# @app.get("/ccbpmreport/preview-docname")
# async def preview_docname(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     year = d.year

#     latest = await _latest_doc_name_anywhere(station_id, year,source="ccb")

#     if not latest:
#         next_doc = f"{station_id}_1/{year}"
#     else:
#         import re
#         m = re.search(r"_(\d+)/\d{4}$", latest)
#         current_num = int(m.group(1)) if m else 0
#         next_doc = f"{station_id}_{current_num + 1}/{year}"

#     return {"doc_name": next_doc}

# @app.post("/ccbpmreport/pre/submit")
# async def ccbpmreport_submit(body: CCBPMSubmitIn, current: UserClaims = Depends(get_current_user)):
#     station_id = body.station_id.strip()
#     coll = get_ccbpmreport_collection_for(station_id)
#     db = coll.database

#     pm_type = str(body.job.get("pm_type") or "CC").upper()
#     body.job["pm_type"] = pm_type

#     url_coll = get_ccbpmurl_coll_upload(station_id)

#     try:
#         d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     client_issue = body.issue_id 
#     issue_id: str | None = None    

#     if client_issue:
#         yymm = f"{d.year % 100:02d}{d.month:02d}"
#         prefix = f"PM-{pm_type}-{yymm}-"
#         valid_fmt = client_issue.startswith(prefix)

#         # ⭐ เช็คทั้ง PMReportDB + PMUrlDB
#         # url_coll = get_pmurl_coll_upload(station_id)
#         rep_exists = await coll.find_one({"station_id": station_id, "issue_id": client_issue})
#         url_exists = await url_coll.find_one({"issue_id": client_issue})
#         unique = not (rep_exists or url_exists)

#         if valid_fmt and unique:
#             issue_id = client_issue
    
#     # if not issue_id:
#     #     issue_id = await _next_issue_id(db, station_id, pm_type, d, pad=2)
#     if not issue_id:
#         while True:
#             candidate = await _next_issue_id(db, station_id, pm_type, d, pad=2)
#             rep_exists = await coll.find_one({"issue_id": candidate})
#             url_exists = await url_coll.find_one({"issue_id": candidate})
#             if not rep_exists and not url_exists:
#                 issue_id = candidate
#                 break
   
#     client_docName = body.doc_name
#     doc_name = None
#     if client_docName:
#         year = f"{d.year}"
#         prefix = f"{station_id}_"
#         valid_fmt = client_docName.startswith(prefix)

#         url_coll = get_ccbpmurl_coll_upload(station_id)
#         rep_exists = await coll.find_one({"station_id": station_id, "doc_name": client_docName})
#         url_exists = await url_coll.find_one({"doc_name": client_docName})
#         unique = not (rep_exists or url_exists)

#         if valid_fmt and unique:
#             doc_name = client_docName
 
#     if not doc_name:
#         year_seq = await _next_year_seq(db, station_id, pm_type, d)
#         year = d.year
#         doc_name = f"{station_id}_{year_seq}/{year}"

#     inspector = body.inspector
#     # เก็บเอกสารเป็น draft ก่อน
#     doc = {
#         "station_id": station_id,
#         "doc_name": doc_name,
#         "issue_id": issue_id,
#         "job": body.job,
#         # "rows": body.rows,
#         "measures_pre": body.measures_pre,         # m4..m8
#         # "summary": body.summary,
#         # "summaryCheck": body.summaryCheck,
#         "pm_date": body.pm_date,           # string YYYY-MM-DD (ตามฟรอนต์)
#         "status": "draft",
#         # "photos": {},                      # จะถูกเติมใน /photos
#         "photos_pre": {},
#         "inspector": inspector,
#         "side": body.side,
#         # "createdAt": datetime.now(timezone.utc),
#         # "updatedAt": datetime.now(timezone.utc),
#         "timestamp": datetime.now(timezone.utc),
#     }

#     res = await coll.insert_one(doc)
#     return {
#         "ok": True, 
#         "report_id": str(res.inserted_id), 
#         "issue_id": issue_id,
#         "doc_name": doc_name,
#     }

# class CCBPMPostIn(BaseModel):
#     report_id: str | None = None      # 👈 เพิ่ม
#     station_id: str
#     # issue_id: str | None = None
#     # job: dict
#     rows: dict
#     measures: dict
#     summary: str
#     # pm_date: str
#     # doc_name: str | None = None
#     summaryCheck: str | None = None
#     # dust_filter: str | None = None
#     side: Literal["post", "after"]

# @app.post("/ccbpmreport/submit")
# async def ccbpmreport_submit(body: CCBPMPostIn, current: UserClaims = Depends(get_current_user)):
#     station_id = body.station_id.strip()
#     coll = get_ccbpmreport_collection_for(station_id)
#     db = coll.database

#     url_coll = get_ccbpmurl_coll_upload(station_id)

   
#     if body.report_id:
#         try:
#             oid = ObjectId(body.report_id)
#         except InvalidId:
#             raise HTTPException(status_code=400, detail="invalid report_id")

#         existing = await coll.find_one({"_id": oid, "station_id": station_id})
#         if not existing:
#             raise HTTPException(status_code=404, detail="Report not found")

#         # reuse ค่าเดิม ไม่ gen ใหม่
#         # issue_id = existing.get("issue_id")
#         # doc_name = existing.get("doc_name")
#         # inspector = body.inspector or existing.get("inspector") or current.username

#         update_fields = {
#             # "job": body.job,
#             "rows": body.rows,
#             "measures": body.measures,          # ใช้เป็นค่าหลัง PM
#             "summary": body.summary,
#             "summaryCheck": body.summaryCheck,
#             # "pm_date": body.pm_date,
#             # "inspector": inspector,
#             # "dust_filter": body.dust_filter,
#             # "doc_name": doc_name,
#             "side": "post",                     # ตอนนี้อยู่ฝั่ง post แล้ว
#             "timestamp_post": datetime.now(timezone.utc),
#         }

#         await coll.update_one({"_id": oid}, {"$set": update_fields})

#         return {
#             "ok": True,
#             "report_id": body.report_id,
#             # "issue_id": issue_id,
#             # "doc_name": doc_name,
#         }
    
#     doc = {
#         "station_id": station_id,
#         # "doc_name": doc_name,
#         # "issue_id": issue_id,
#         # "job": body.job,
#         "rows": body.rows,
#         "measures": body.measures,         # m4..m8
#         "summary": body.summary,
#         "summaryCheck": body.summaryCheck,
#         # "pm_date": body.pm_date,           # string YYYY-MM-DD (ตามฟรอนต์)
#         # "inspector": inspector,
#         # "dust_filter": body.dust_filter,
#         "status": "draft",
#         "photos": {},                      # จะถูกเติมใน /photos
#         # "createdAt": datetime.now(timezone.utc),
#         # "updatedAt": datetime.now(timezone.utc),
#         "side": "post",
#         "timestamp": datetime.now(timezone.utc),
#     }

#     res = await coll.insert_one(doc)
#     return {
#         "ok": True, 
#         "report_id": str(res.inserted_id), 
#         # "issue_id": issue_id,
#         # "doc_name": doc_name,
#     }

# @app.get("/ccbpmreport/get")
# async def ccbpmreport_get(station_id: str, report_id: str, current: UserClaims = Depends(get_current_user)):
#     coll = get_ccbpmreport_collection_for(station_id)
#     doc = await coll.find_one({"_id": ObjectId(report_id)})
#     if not doc:
#         raise HTTPException(status_code=404, detail="not found")

#     doc["_id"] = str(doc["_id"])
#     return doc

# @app.get("/ccbpmreport/list")
# async def ccbpmreport_list(
#     station_id: str = Query(...),
#     page: int = Query(1, ge=1),
#     pageSize: int = Query(20, ge=1, le=100),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     coll = get_ccbpmreport_collection_for(station_id)
#     skip = (page - 1) * pageSize

#     cursor = coll.find({}, {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector" : 1,"side":1, "createdAt": 1}).sort(
#         [("createdAt", -1), ("_id", -1)]
#     ).skip(skip).limit(pageSize)

#     items_raw = await cursor.to_list(length=pageSize)
#     total = await coll.count_documents({})

#     # ผูก URL PDF รายวันจาก CCBPMUrlDB (ถ้ามี)
#     pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
#     url_by_day: Dict[str, str] = {}
#     if pm_dates:
#         ucoll = get_ccbpmurl_coll_upload(station_id)
#         ucur = ucoll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
#         url_docs = await ucur.to_list(length=10_000)
#         for u in url_docs:
#             day = u.get("pm_date")
#             first_url = (u.get("urls") or [None])[0]
#             if day and first_url and day not in url_by_day:
#                 url_by_day[day] = first_url

#     items = [{
#         "id": str(it["_id"]),
#         "issue_id": it.get("issue_id"),
#         "doc_name": it.get("doc_name"),
#         "pm_date": it.get("pm_date"),
#         "side":it.get("side"), 
#         "inspector": it.get("inspector"),
#         "createdAt": _ensure_utc_iso(it.get("createdAt")),
#         "file_url": url_by_day.get(it.get("pm_date") or "", ""),
#     } for it in items_raw]

#     return {"items": items, "pm_date": [it.get("pm_date") for it in items_raw if it.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}

# @app.post("/ccbpmreport/{report_id}/pre/photos")
# async def ccbpmreport_upload_photos(
#     report_id: str,
#     station_id: str = Form(...),
#     group: str = Form(...),                   # "r1" .. "r10", "r9_0" .. "r9_5"
#     files: List[UploadFile] = File(...),
#     # remark: Optional[str] = Form(None),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
#     if not re.fullmatch(r"r\d+(_\d+)?", group):
#         raise HTTPException(status_code=400, detail="Bad group key")

#     coll = get_ccbpmreport_collection_for(station_id)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Report not found")
#     if doc.get("station_id") != station_id:
#         raise HTTPException(status_code=400, detail="station_id mismatch")

#     # โฟลเดอร์: /uploads/ccbpm/{station_id}/{report_id}/{group}/
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "ccbpm" / station_id / report_id / "pre" / group
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     saved = []
#     for f in files:
#         ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext not in ALLOWED_EXTS:
#             raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url_path = f"/uploads/ccbpm/{station_id}/{report_id}/pre/{group}/{fname}"
#         saved.append({
#             "filename": fname,
#             "size": len(data),
#             "url": url_path,
#             # "remark": remark or "",
#             "uploadedAt": datetime.now(timezone.utc)
#         })

#     await coll.update_one(
#         {"_id": oid},
#         {
#             "$push": {f"photos_pre.{group}": {"$each": saved}},
#             "$set": {"updatedAt": datetime.now(timezone.utc)}
#         }
#     )
#     return {"ok": True, "count": len(saved), "group": group, "files": saved}


# @app.post("/ccbpmreport/{report_id}/post/photos")
# async def ccbpmreport_upload_photos(
#     report_id: str,
#     station_id: str = Form(...),
#     group: str = Form(...),                   # "r1" .. "r10", "r9_0" .. "r9_5"
#     files: List[UploadFile] = File(...),
#     remark: Optional[str] = Form(None),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
#     if not re.fullmatch(r"r\d+(_\d+)?", group):
#         raise HTTPException(status_code=400, detail="Bad group key")

#     coll = get_ccbpmreport_collection_for(station_id)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Report not found")
#     if doc.get("station_id") != station_id:
#         raise HTTPException(status_code=400, detail="station_id mismatch")

#     # โฟลเดอร์: /uploads/ccbpm/{station_id}/{report_id}/{group}/
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "ccbpm" / station_id / report_id / "post" / group
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     saved = []
#     for f in files:
#         ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext not in ALLOWED_EXTS:
#             raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url_path = f"/uploads/ccbpm/{station_id}/{report_id}/post/{group}/{fname}"
#         saved.append({
#             "filename": fname,
#             "size": len(data),
#             "url": url_path,
#             "remark": remark or "",
#             "uploadedAt": datetime.now(timezone.utc)
#         })

#     await coll.update_one(
#         {"_id": oid},
#         {
#             "$push": {f"photos.{group}": {"$each": saved}},
#             "$set": {"updatedAt": datetime.now(timezone.utc)}
#         }
#     )
#     return {"ok": True, "count": len(saved), "group": group, "files": saved}

# @app.post("/ccbpmreport/{report_id}/finalize")
# async def ccbpmreport_finalize(
#     report_id: str,
#     station_id: str = Form(...),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")

#     coll = get_ccbpmreport_collection_for(station_id)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     # (ออปชัน) ตรวจความครบถ้วนก่อน finalize ได้ที่นี่
#     res = await coll.update_one(
#         {"_id": oid},
#         {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}}
#     )
#     if res.matched_count == 0:
#         raise HTTPException(status_code=404, detail="Report not found")
#     return {"ok": True}

# @app.post("/ccbpmurl/upload-files", status_code=201)
# async def ccbpmurl_upload_files(
#     station_id: str = Form(...),
#     reportDate: str = Form(...),            # "YYYY-MM-DD" หรือ ISO -> จะ normalize เป็น YYYY-MM-DD
#     files: List[UploadFile] = File(...),    # อนุญาตเฉพาะ .pdf
#     # current: UserClaims = Depends(get_current_user),
#     issue_id: Optional[str] = Form(None),
#     doc_name: Optional[str] = Form(None),
#     inspector: Optional[str] = Form(None),
# ):
#     coll = get_ccbpmurl_coll_upload(station_id)
#     pm_date = normalize_pm_date(reportDate)  # คืน YYYY-MM-DD

#     pm_type = "CC"
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

#     rep_coll = get_ccbpmreport_collection_for(station_id)
#     final_issue_id = None
#     client_issue = (issue_id or "").strip()

#     if client_issue:
#         yymm = f"{d.year % 100:02d}{d.month:02d}"
#         prefix = f"PM-{pm_type}-{yymm}-"
#         valid_fmt = client_issue.startswith(prefix)

#         url_exists = await coll.find_one({"issue_id": client_issue})
#         rep_exists = await rep_coll.find_one({"issue_id": client_issue})
#         unique = not (url_exists or rep_exists)

#         if valid_fmt and unique:
#             final_issue_id = client_issue

#     if not final_issue_id:
#         while True:
#             candidate = await _next_issue_id(coll.database, station_id, pm_type, d, pad=2)
#             url_exists = await coll.find_one({"issue_id": candidate})
#             rep_exists = await rep_coll.find_one({"issue_id": candidate})
#             if not url_exists and not rep_exists:
#                 final_issue_id = candidate
#                 break
        
#     year_seq: int | None = None

#     # พยายาม reuse year_seq จาก PMReportDB ถ้ามีอยู่แล้ว (issue_id เดียวกัน)
#     rep = await get_ccbpmreport_collection_for(station_id).find_one(
#         {"issue_id": final_issue_id},
#         {"year_seq": 1, "pm_date": 1},
#     )
#     if rep and rep.get("year_seq") is not None:
#         year_seq = int(rep["year_seq"])

#     # ถ้าไม่มีค่า year_seq จาก PMReport → ออกใหม่จาก pm_year_sequences
#     if year_seq is None:
#         year_seq = await _next_year_seq(coll.database, station_id, pm_type, d)

#     year = d.year
#     final_doc_name: str | None = None

#     if doc_name:
#         candidate = doc_name.strip()

#         ok_format = candidate.startswith(f"{station_id}_")

#         rep_coll = get_ccbpmreport_collection_for(station_id)
#         rep_exists = await rep_coll.find_one({"doc_name": candidate})
#         url_exists = await coll.find_one({"doc_name": candidate})
#         unique = not (rep_exists or url_exists)

#         if ok_format and unique:
#             final_doc_name = candidate

#     if not final_doc_name:
#         final_doc_name = f"{station_id}_{year_seq}/{year}"

#     doc_name = final_doc_name
    
#     # เก็บไว้ที่ /uploads/ccbpmurl/<station_id>/<YYYY-MM-DD>/
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "ccbpmurl" / station_id / pm_date
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     urls, metas = [], []
#     for f in files:
#         ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext != "pdf":
#             raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url = f"/uploads/ccbpmurl/{station_id}/{pm_date}/{fname}"
#         urls.append(url)
#         metas.append({"name": f.filename, "size": len(data)})

#     inspector_clean = (inspector or "").strip() or None
#     now = datetime.now(timezone.utc)
#     res = await coll.insert_one({
#         "station": station_id,
#         "pm_date": pm_date,
#         "issue_id": final_issue_id, 
#         "inspector": inspector_clean,
#         "doc_name": doc_name,
#         "urls": urls,
#         "meta": {"files": metas},
#         "source": "upload-files",
#         "createdAt": now,
#         "updatedAt": now,
#     })
#     return {"ok": True, "inserted_id": str(res.inserted_id), "count": len(urls), "urls": urls,"issue_id": final_issue_id,"doc_name": doc_name,"inspector": inspector_clean,}

# @app.get("/ccbpmurl/list")
# async def ccbpmurl_list(
#     station_id: str = Query(...),
#     page: int = Query(1, ge=1),
#     pageSize: int = Query(20, ge=1, le=100),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     coll = get_ccbpmurl_coll_upload(station_id)
#     skip = (page - 1) * pageSize

#     cursor = coll.find(
#         {},
#         {"_id": 1, "issue_id": 1,"doc_name": 1,"inspector":1, "pm_date": 1, "urls": 1, "createdAt": 1}
#     ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

#     items_raw = await cursor.to_list(length=pageSize)
#     total = await coll.count_documents({})

#     items = []
#     for it in items_raw:
#         urls = it.get("urls") or []
#         first_url = urls[0] if urls else ""
#         items.append({
#             "id": str(it["_id"]),
#             "pm_date": it.get("pm_date"),
#             "issue_id": it.get("issue_id"),
#             "inspector": it.get(("inspector")), 
#             "doc_name": it.get("doc_name"),
#             "createdAt": _ensure_utc_iso(it.get("createdAt")),
#             "file_url": first_url,
#             "urls": urls,
#         })

#     return {"items": items, "pm_date": [i["pm_date"] for i in items if i.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}
#
# ------------------------------------------------------------------------
# new ccb pm report
# ------------------------------------------------------------------------
def get_ccbpmreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    return CCBPMReportDB.get_collection(str(station_id))

def get_ccbpmurl_coll_upload(station_id: str):
    _validate_station_id(station_id)
    return CCBPMUrlDB.get_collection(str(station_id))

class CCBPMSubmitIn(BaseModel):
    side: Literal["pre", "post"]
    station_id: str
    job: Dict[str, Any]         # โครงงาน (location/date/inspector ฯลฯ)
    rows_pre: Dict[str, Dict[str, Any]]  # {"r1": {"pf": "...", "remark": "..."}, ...}
    measures_pre: Dict[str, Any]  # {"m9": {...}, "m10_1": {...}, "m10_2": {...}, ...}
    subBreakerCount: int = 1    # จำนวนเบรกเกอร์วงจรย่อย (1-6)
    pm_date: str                # "YYYY-MM-DD"
    issue_id: Optional[str] = None
    doc_name: Optional[str] = None 
    inspector: Optional[str] = None
    comment_pre: Optional[str] = None

@app.get("/ccbpmreport/preview-issueid")
async def ccbpmreport_preview_issueid(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดู issue_id ถัดไป (PM-CG-YYMM-XX) โดยไม่ออกเลขจริง
    ใช้หาเลขไปโชว์บนฟอร์มเฉย ๆ
    """
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    pm_type = "CC"

    latest = await _latest_issue_id_anywhere(station_id, pm_type, d, source="ccb")

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"

    if not latest:
        next_issue = f"{prefix}01"
    else:
        m = re.search(r"(\d+)$", latest)
        cur = int(m.group(1)) if m else 0
        next_issue = f"{prefix}{cur+1:02d}"

    return {"issue_id": next_issue}

@app.get("/ccbpmreport/latest-docname")
async def ccbpmreport_latest_docname(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดึง doc_name ล่าสุดของสถานี (ปีเดียวกับ pm_date)
    เพื่อใช้คำนวณเลขถัดไปที่ frontend
    """
    latest = await _latest_doc_name_from_pmreport(station_id, pm_date, source="ccb")
    
    return {
        "doc_name": latest.get("doc_name") if latest else None,
        "station_id": station_id,
        "pm_date": pm_date
    }

@app.get("/ccbpmreport/preview-docname")
async def preview_docname(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    year = d.year

    latest = await _latest_doc_name_anywhere(station_id, year, source="ccb")

    if not latest:
        next_doc = f"{station_id}_1/{year}"
    else:
        import re
        m = re.search(r"_(\d+)/\d{4}$", latest)
        current_num = int(m.group(1)) if m else 0
        next_doc = f"{station_id}_{current_num + 1}/{year}"

    return {"doc_name": next_doc}

@app.post("/ccbpmreport/pre/submit")
async def ccbpmreport_pre_submit(body: CCBPMSubmitIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    coll = get_ccbpmreport_collection_for(station_id)
    db = coll.database

    pm_type = str(body.job.get("pm_type") or "CC").upper()
    body.job["pm_type"] = pm_type

    url_coll = get_ccbpmurl_coll_upload(station_id)

    try:
        d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    client_issue = body.issue_id 
    issue_id: str | None = None    

    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        valid_fmt = client_issue.startswith(prefix)

        rep_exists = await coll.find_one({"station_id": station_id, "issue_id": client_issue})
        url_exists = await url_coll.find_one({"issue_id": client_issue})
        unique = not (rep_exists or url_exists)

        if valid_fmt and unique:
            issue_id = client_issue
    
    if not issue_id:
        while True:
            candidate = await _next_issue_id(db, station_id, pm_type, d, pad=2)
            rep_exists = await coll.find_one({"issue_id": candidate})
            url_exists = await url_coll.find_one({"issue_id": candidate})
            if not rep_exists and not url_exists:
                issue_id = candidate
                break
   
    client_docName = body.doc_name
    doc_name = None
    if client_docName:
        year = f"{d.year}"
        prefix = f"{station_id}_"
        valid_fmt = client_docName.startswith(prefix)

        url_coll = get_ccbpmurl_coll_upload(station_id)
        rep_exists = await coll.find_one({"station_id": station_id, "doc_name": client_docName})
        url_exists = await url_coll.find_one({"doc_name": client_docName})
        unique = not (rep_exists or url_exists)

        if valid_fmt and unique:
            doc_name = client_docName
 
    if not doc_name:
        year_seq = await _next_year_seq(db, station_id, pm_type, d)
        year = d.year
        doc_name = f"{station_id}_{year_seq}/{year}"

    inspector = body.inspector

    # เก็บเอกสารเป็น draft ก่อน
    doc = {
        "station_id": station_id,
        "doc_name": doc_name,
        "issue_id": issue_id,
        "job": body.job,
        "rows_pre": body.rows_pre,
        "measures_pre": body.measures_pre,  # {"main": {...}, "subs": {"1": {...}, ...}}
        "subBreakerCount": body.subBreakerCount,
        "pm_date": body.pm_date,
        "status": "draft",
        "photos_pre": {},
        "inspector": inspector,
        "comment_pre": body.comment_pre,
        "side": body.side,
        "timestamp": datetime.now(timezone.utc),
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id), 
        "issue_id": issue_id,
        "doc_name": doc_name,
    }

class CCBPMPostIn(BaseModel):
    report_id: str | None = None
    station_id: str
    rows: dict
    measures: dict  # {"m9": {...}, "m10_1": {...}, "m10_2": {...}, ...}
    subBreakerCount: int = 1
    summary: str
    summaryCheck: str | None = None
    side: Literal["post", "after"]

@app.post("/ccbpmreport/submit")
async def ccbpmreport_post_submit(body: CCBPMPostIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    coll = get_ccbpmreport_collection_for(station_id)
    db = coll.database

    url_coll = get_ccbpmurl_coll_upload(station_id)

    if body.report_id:
        try:
            oid = ObjectId(body.report_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="invalid report_id")

        existing = await coll.find_one({"_id": oid, "station_id": station_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Report not found")

        update_fields = {
            "rows": body.rows,
            "measures": body.measures,
            "subBreakerCount": body.subBreakerCount,
            "summary": body.summary,
            "summaryCheck": body.summaryCheck,
            "side": "post",
            "timestamp_post": datetime.now(timezone.utc),
        }

        await coll.update_one({"_id": oid}, {"$set": update_fields})

        return {
            "ok": True,
            "report_id": body.report_id,
        }
    
    doc = {
        "station_id": station_id,
        "rows": body.rows,
        "measures": body.measures,
        "subBreakerCount": body.subBreakerCount,
        "summary": body.summary,
        "summaryCheck": body.summaryCheck,
        "status": "draft",
        "photos": {},
        "side": "post",
        "timestamp": datetime.now(timezone.utc),
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id), 
    }

@app.get("/ccbpmreport/get")
async def ccbpmreport_get(station_id: str, report_id: str, current: UserClaims = Depends(get_current_user)):
    coll = get_ccbpmreport_collection_for(station_id)
    doc = await coll.find_one({"_id": ObjectId(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="not found")

    doc["_id"] = str(doc["_id"])
    return doc

@app.get("/ccbpmreport/list")
async def ccbpmreport_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    coll = get_ccbpmreport_collection_for(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find({}, {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector": 1, "side": 1, "createdAt": 1}).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    # ผูก URL PDF รายวันจาก CCBPMUrlDB (ถ้ามี)
    pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
    url_by_day: Dict[str, str] = {}
    if pm_dates:
        ucoll = get_ccbpmurl_coll_upload(station_id)
        ucur = ucoll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
        url_docs = await ucur.to_list(length=10_000)
        for u in url_docs:
            day = u.get("pm_date")
            first_url = (u.get("urls") or [None])[0]
            if day and first_url and day not in url_by_day:
                url_by_day[day] = first_url

    items = [{
        "id": str(it["_id"]),
        "issue_id": it.get("issue_id"),
        "doc_name": it.get("doc_name"),
        "pm_date": it.get("pm_date"),
        "side": it.get("side"), 
        "inspector": it.get("inspector"),
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("pm_date") or "", ""),
    } for it in items_raw]

    return {"items": items, "pm_date": [it.get("pm_date") for it in items_raw if it.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}

# Regex pattern for photo group keys:
# - g1 to g11 (simple questions)
# - g3_1, g3_2, g4_1, g4_2, etc. (group questions)
# - g9 (Main Breaker)
# - g10_1 to g10_6 (Sub Breakers)
PHOTO_GROUP_PATTERN = re.compile(r"^g\d+(_\d+)?$")

@app.post("/ccbpmreport/{report_id}/pre/photos")
async def ccbpmreport_upload_photos_pre(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),  # "r1", "r9_main", "r10_sub1" .. "r10_sub6"
    files: List[UploadFile] = File(...),
):
    if not PHOTO_GROUP_PATTERN.match(group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_ccbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    # โฟลเดอร์: /uploads/ccbpm/{station_id}/{report_id}/pre/{group}/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "ccbpm" / station_id / report_id / "pre" / group
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/ccbpm/{station_id}/{report_id}/pre/{group}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos_pre.{group}": {"$each": saved}},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    return {"ok": True, "count": len(saved), "group": group, "files": saved}


@app.post("/ccbpmreport/{report_id}/post/photos")
async def ccbpmreport_upload_photos_post(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),  # "r1", "r9_main", "r10_sub1" .. "r10_sub6"
    files: List[UploadFile] = File(...),
    remark: Optional[str] = Form(None),
):
    if not PHOTO_GROUP_PATTERN.match(group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_ccbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    # โฟลเดอร์: /uploads/ccbpm/{station_id}/{report_id}/post/{group}/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "ccbpm" / station_id / report_id / "post" / group
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/ccbpm/{station_id}/{report_id}/post/{group}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos.{group}": {"$each": saved}},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    return {"ok": True, "count": len(saved), "group": group, "files": saved}

@app.post("/ccbpmreport/{report_id}/finalize")
async def ccbpmreport_finalize(
    report_id: str,
    station_id: str = Form(...),
):
    coll = get_ccbpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    res = await coll.update_one(
        {"_id": oid},
        {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}

@app.post("/ccbpmurl/upload-files", status_code=201)
async def ccbpmurl_upload_files(
    station_id: str = Form(...),
    reportDate: str = Form(...),
    files: List[UploadFile] = File(...),
    issue_id: Optional[str] = Form(None),
    doc_name: Optional[str] = Form(None),
    inspector: Optional[str] = Form(None),
):
    coll = get_ccbpmurl_coll_upload(station_id)
    pm_date = normalize_pm_date(reportDate)

    pm_type = "CC"
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

    rep_coll = get_ccbpmreport_collection_for(station_id)
    final_issue_id = None
    client_issue = (issue_id or "").strip()

    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        valid_fmt = client_issue.startswith(prefix)

        url_exists = await coll.find_one({"issue_id": client_issue})
        rep_exists = await rep_coll.find_one({"issue_id": client_issue})
        unique = not (url_exists or rep_exists)

        if valid_fmt and unique:
            final_issue_id = client_issue

    if not final_issue_id:
        while True:
            candidate = await _next_issue_id(coll.database, station_id, pm_type, d, pad=2)
            url_exists = await coll.find_one({"issue_id": candidate})
            rep_exists = await rep_coll.find_one({"issue_id": candidate})
            if not url_exists and not rep_exists:
                final_issue_id = candidate
                break
        
    year_seq: int | None = None

    rep = await get_ccbpmreport_collection_for(station_id).find_one(
        {"issue_id": final_issue_id},
        {"year_seq": 1, "pm_date": 1},
    )
    if rep and rep.get("year_seq") is not None:
        year_seq = int(rep["year_seq"])

    if year_seq is None:
        year_seq = await _next_year_seq(coll.database, station_id, pm_type, d)

    year = d.year
    final_doc_name: str | None = None

    if doc_name:
        candidate = doc_name.strip()

        ok_format = candidate.startswith(f"{station_id}_")

        rep_coll = get_ccbpmreport_collection_for(station_id)
        rep_exists = await rep_coll.find_one({"doc_name": candidate})
        url_exists = await coll.find_one({"doc_name": candidate})
        unique = not (rep_exists or url_exists)

        if ok_format and unique:
            final_doc_name = candidate

    if not final_doc_name:
        final_doc_name = f"{station_id}_{year_seq}/{year}"

    doc_name = final_doc_name
    
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "ccbpmurl" / station_id / pm_date
    dest_dir.mkdir(parents=True, exist_ok=True)

    urls, metas = [], []
    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext != "pdf":
            raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url = f"/uploads/ccbpmurl/{station_id}/{pm_date}/{fname}"
        urls.append(url)
        metas.append({"name": f.filename, "size": len(data)})

    inspector_clean = (inspector or "").strip() or None
    now = datetime.now(timezone.utc)
    res = await coll.insert_one({
        "station": station_id,
        "pm_date": pm_date,
        "issue_id": final_issue_id, 
        "inspector": inspector_clean,
        "doc_name": doc_name,
        "urls": urls,
        "meta": {"files": metas},
        "source": "upload-files",
        "createdAt": now,
        "updatedAt": now,
    })
    return {"ok": True, "inserted_id": str(res.inserted_id), "count": len(urls), "urls": urls, "issue_id": final_issue_id, "doc_name": doc_name, "inspector": inspector_clean}

@app.get("/ccbpmurl/list")
async def ccbpmurl_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    coll = get_ccbpmurl_coll_upload(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find(
        {},
        {"_id": 1, "issue_id": 1, "doc_name": 1, "inspector": 1, "pm_date": 1, "urls": 1, "createdAt": 1}
    ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    items = []
    for it in items_raw:
        urls = it.get("urls") or []
        first_url = urls[0] if urls else ""
        items.append({
            "id": str(it["_id"]),
            "pm_date": it.get("pm_date"),
            "issue_id": it.get("issue_id"),
            "inspector": it.get("inspector"), 
            "doc_name": it.get("doc_name"),
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": first_url,
            "urls": urls,
        })

    return {"items": items, "pm_date": [i["pm_date"] for i in items if i.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}
# -------------------------------------------------- PMReportPage (CB-BOX)       
# def get_cbboxpmreport_collection_for(station_id: str):
#     _validate_station_id(station_id)
#     return CBBOXPMReportDB.get_collection(str(station_id))

# def get_cbboxpmurl_coll_upload(station_id: str):
#     _validate_station_id(station_id)
#     return CBBOXPMUrlDB.get_collection(str(station_id))

# class CBBOXPMSubmitIn(BaseModel):
#     side: Literal["pre", "post"]
#     station_id: str
#     job: Dict[str, Any]         # โครงงาน (location/date/inspector ฯลฯ)
#     # rows: Dict[str, Dict[str, Any]]  # {"r1": {"pf": "...", "remark": "..."}, ...}
#     measures_pre: Dict[str, Dict[str, Any]]  # {"m4": {...}, "m5": {...}, ..., "m8": {...}}
#     # summary: str
#     pm_date: str                # "YYYY-MM-DD"
#     issue_id: Optional[str] = None
#     doc_name: Optional[str] = None 
#     # summaryCheck: Optional[Literal["PASS","FAIL","NA"]] = None
#     inspector: Optional[str] = None
#     dropdownQ1: Optional[str] = None  # ✅ เพิ่ม dropdown Q1
#     dropdownQ2: Optional[str] = None  # ✅ เพิ่ม dropdown Q2

# @app.get("/cbboxpmreport/preview-issueid")
# async def cbboxpmreport_preview_issueid(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """
#     ดู issue_id ถัดไป (PM-CG-YYMM-XX) โดยไม่ออกเลขจริง
#     ใช้หาเลขไปโชว์บนฟอร์มเฉย ๆ
#     """
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     pm_type = "CB"

#     latest = await _latest_issue_id_anywhere(station_id, pm_type, d,source="cbbox")

#     yymm = f"{d.year % 100:02d}{d.month:02d}"
#     prefix = f"PM-{pm_type}-{yymm}-"

#     if not latest:
#         next_issue = f"{prefix}01"
#     else:
#         m = re.search(r"(\d+)$", latest)
#         cur = int(m.group(1)) if m else 0
#         next_issue = f"{prefix}{cur+1:02d}"

#     return {"issue_id": next_issue}

# @app.get("/cbboxpmreport/latest-docname")
# async def cbboxpmreport_latest_docname(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """
#     ดึง doc_name ล่าสุดของสถานี (ปีเดียวกับ pm_date)
#     เพื่อใช้คำนวณเลขถัดไปที่ frontend
#     """
#     # auth ถ้าต้องการ
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
    
#     latest = await _latest_doc_name_from_pmreport(station_id, pm_date, source="cbbox")
    
#     return {
#         "doc_name": latest.get("doc_name") if latest else None,
#         "station_id": station_id,
#         "pm_date": pm_date
#     }

# @app.get("/cbboxpmreport/preview-docname")
# async def preview_docname(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     year = d.year

#     latest = await _latest_doc_name_anywhere(station_id, year,source="cbbox")

#     if not latest:
#         next_doc = f"{station_id}_1/{year}"
#     else:
#         import re
#         m = re.search(r"_(\d+)/\d{4}$", latest)
#         current_num = int(m.group(1)) if m else 0
#         next_doc = f"{station_id}_{current_num + 1}/{year}"

#     return {"doc_name": next_doc}

# @app.post("/cbboxpmreport/pre/submit")
# async def cbboxpmreport_submit(body: CBBOXPMSubmitIn, current: UserClaims = Depends(get_current_user)):
#     station_id = body.station_id.strip()
#     coll = get_cbboxpmreport_collection_for(station_id)
#     db = coll.database

#     pm_type = str(body.job.get("pm_type") or "CB").upper()
#     body.job["pm_type"] = pm_type

#     url_coll = get_cbboxpmurl_coll_upload(station_id)

#     try:
#         d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     client_issue = body.issue_id 
#     issue_id: str | None = None

#     if client_issue:
#         yymm = f"{d.year % 100:02d}{d.month:02d}"
#         prefix = f"PM-{pm_type}-{yymm}-"
#         valid_fmt = client_issue.startswith(prefix)

#         rep_exists = await coll.find_one({"station_id": station_id, "issue_id": client_issue})
#         url_exists = await url_coll.find_one({"issue_id": client_issue})
#         unique = not await coll.find_one({"station_id": station_id, "issue_id": client_issue})
#         if valid_fmt and unique:
#             issue_id = client_issue

#     # if not issue_id:
#     #     issue_id = await _next_issue_id(db, station_id, pm_type, d, pad=2)
        
#     if not issue_id:
#         while True:
#             candidate = await _next_issue_id(db, station_id, pm_type, d, pad=2)
#             rep_exists = await coll.find_one({"issue_id": candidate})
#             url_exists = await url_coll.find_one({"issue_id": candidate})
#             if not rep_exists and not url_exists:
#                 issue_id = candidate
#                 break

#     client_docName = body.doc_name
#     doc_name = None
#     if client_docName:
#         year = f"{d.year}"
#         prefix = f"{station_id}_"
#         valid_fmt = client_docName.startswith(prefix)

#         url_coll = get_cbboxpmurl_coll_upload(station_id)
#         rep_exists = await coll.find_one({"station_id": station_id, "doc_name": client_docName})
#         url_exists = await url_coll.find_one({"doc_name": client_docName})
#         unique = not (rep_exists or url_exists)

#         if valid_fmt and unique:
#             doc_name = client_docName
 
#     if not doc_name:
#         year_seq = await _next_year_seq(db, station_id, pm_type, d)
#         year = d.year
#         doc_name = f"{station_id}_{year_seq}/{year}"

#     doc = {
#         "station_id": station_id,
#         "doc_name": doc_name,
#         "issue_id": issue_id,
#         "job": body.job,
#         "dropdownQ1" : body.dropdownQ1,  # ✅ เพิ่ม dropdown Q1
#         "dropdownQ2" : body.dropdownQ2,  # ✅ เพิ่ม dropdown Q2
#         # "rows": body.rows,
#         "measures_pre": body.measures_pre,         # m4..m8
#         # "summary": body.summary,
#         # "summaryCheck": body.summaryCheck,
#         "pm_date": body.pm_date,           # string YYYY-MM-DD (ตามฟรอนต์)
#         "status": "draft",
#         "photos_pre": {},                      # จะถูกเติมใน /photos
#         "inspector": body.inspector,
#         "side": body.side,
#         "createdAt": datetime.now(timezone.utc),
#         # "updatedAt": datetime.now(timezone.utc),
#         # "timestamp": datetime.now(timezone.utc),
#     }

#     res = await coll.insert_one(doc)
#     return {
#         "ok": True, 
#         "report_id": str(res.inserted_id),
#         "issue_id": issue_id,
#         "doc_name": doc_name,
#     }
       
# class CBBOXPMPostIn(BaseModel):
#     report_id: str | None = None      # 👈 เพิ่ม
#     station_id: str
#     # issue_id: str | None = None
#     # job: dict
#     rows: dict
#     measures: dict
#     summary: str
#     # pm_date: str
#     # doc_name: str | None = None
#     summaryCheck: str | None = None
#     dropdownQ1: Optional[str] = None  # ✅ เพิ่ม dropdown Q1
#     dropdownQ2: Optional[str] = None  # ✅ เพิ่ม dropdown Q2
#     # dust_filter: str | None = None
#     side: Literal["post", "after"]

# @app.post("/cbboxpmreport/submit")
# async def cbboxpmreport_submit(body: CBBOXPMPostIn, current: UserClaims = Depends(get_current_user)):
#     station_id = body.station_id.strip()
#     coll = get_cbboxpmreport_collection_for(station_id)
#     db = coll.database

#     url_coll = get_cbboxpmurl_coll_upload(station_id)

#     if body.report_id:
#         try:
#             oid = ObjectId(body.report_id)
#         except InvalidId:
#             raise HTTPException(status_code=400, detail="invalid report_id")

#         existing = await coll.find_one({"_id": oid, "station_id": station_id})
#         if not existing:
#             raise HTTPException(status_code=404, detail="Report not found")

#         update_fields = {
#             # "job": body.job,
#             "rows": body.rows,
#             "measures": body.measures,          # ใช้เป็นค่าหลัง PM
#             "summary": body.summary,
#             "summaryCheck": body.summaryCheck,
#             # "pm_date": body.pm_date,
#             # "inspector": inspector,
#             # "dust_filter": body.dust_filter,
#             # "doc_name": doc_name,
#             "dropdownQ1": body.dropdownQ1,  # ✅ เพิ่ม dropdown Q1
#             "dropdownQ2": body.dropdownQ2,  # ✅ เพิ่ม dropdown Q2
#             "side": "post",                     # ตอนนี้อยู่ฝั่ง post แล้ว
#             "updatedAt": datetime.now(timezone.utc),
#         }

#         await coll.update_one({"_id": oid}, {"$set": update_fields})

#         return {
#             "ok": True,
#             "report_id": body.report_id,
#             # "issue_id": issue_id,
#             # "doc_name": doc_name,
#         }

#     doc = {
#         "station_id": station_id,
#         # "doc_name": doc_name,
#         # "issue_id": issue_id,
#         # "job": body.job,
#         "rows": body.rows,
#         # "measures_pre": body.measures_pre,         # m4..m8
#         "summary": body.summary,
#         "summaryCheck": body.summaryCheck,
#         "measures": body.measures, 
#         # "pm_date": body.pm_date,           # string YYYY-MM-DD (ตามฟรอนต์)
#         "status": "draft",
#         "photos": {},                      # จะถูกเติมใน /photos
#         # "inspector": body.inspector,
#         "side": body.side,
#         # "createdAt": datetime.now(timezone.utc),
#         "updatedAt": datetime.now(timezone.utc),
#         # "timestamp": datetime.now(timezone.utc),
#     }

#     res = await coll.insert_one(doc)
#     return {
#         "ok": True, 
#         "report_id": str(res.inserted_id),
#         # "issue_id": issue_id,
#         # "doc_name": doc_name,
#     }

# @app.get("/cbboxpmreport/get")
# async def cbboxpmreport_get(station_id: str, report_id: str, current: UserClaims = Depends(get_current_user)):
#     coll = get_cbboxpmreport_collection_for(station_id)
#     doc = await coll.find_one({"_id": ObjectId(report_id)})
#     if not doc:
#         raise HTTPException(status_code=404, detail="not found")

#     doc["_id"] = str(doc["_id"])
#     return doc


# @app.get("/cbboxpmreport/list")
# async def cbboxpmreport_list(
#     station_id: str = Query(...),
#     page: int = Query(1, ge=1),
#     pageSize: int = Query(20, ge=1, le=100),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     coll = get_cbboxpmreport_collection_for(station_id)
#     skip = (page - 1) * pageSize

#     cursor = coll.find({}, {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector" : 1,"side":1, "createdAt": 1}).sort(
#         [("createdAt", -1), ("_id", -1)]
#     ).skip(skip).limit(pageSize)

#     items_raw = await cursor.to_list(length=pageSize)
#     total = await coll.count_documents({})

#     # ผูก URL PDF รายวันจาก CCBPMUrlDB (ถ้ามี)
#     pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
#     url_by_day: Dict[str, str] = {}
#     if pm_dates:
#         ucoll = get_cbboxpmurl_coll_upload(station_id)
#         ucur = ucoll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
#         url_docs = await ucur.to_list(length=10_000)
#         for u in url_docs:
#             day = u.get("pm_date")
#             first_url = (u.get("urls") or [None])[0]
#             if day and first_url and day not in url_by_day:
#                 url_by_day[day] = first_url

#     items = [{
#         "id": str(it["_id"]),
#         "issue_id": it.get("issue_id"),
#         "doc_name": it.get("doc_name"),
#         "pm_date": it.get("pm_date"),
#         "inspector": it.get("inspector"),
#         "side":it.get("side"),
#         "createdAt": _ensure_utc_iso(it.get("createdAt")),
#         "file_url": url_by_day.get(it.get("pm_date") or "", ""),
#     } for it in items_raw]

#     return {"items": items, "pm_date": [it.get("pm_date") for it in items_raw if it.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}

# @app.post("/cbboxpmreport/{report_id}/pre/photos")
# async def cbboxpmreport_upload_photos(
#     report_id: str,
#     station_id: str = Form(...),
#     group: str = Form(...),                   # "g1" .. "g11"
#     files: List[UploadFile] = File(...),
#     # remark: Optional[str] = Form(None),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
#     if not re.fullmatch(r"g\d+", group):
#         raise HTTPException(status_code=400, detail="Bad group key")

#     coll = get_cbboxpmreport_collection_for(station_id)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Report not found")
#     if doc.get("station_id") != station_id:
#         raise HTTPException(status_code=400, detail="station_id mismatch")

#     # โฟลเดอร์: /uploads/cbboxpm/{station_id}/{report_id}/{group}/
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "cbboxpm" / station_id / report_id / "pre" / group
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     saved = []
#     for f in files:
#         ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext not in ALLOWED_EXTS:
#             raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url_path = f"/uploads/cbboxpm/{station_id}/{report_id}/pre/{group}/{fname}"
#         saved.append({
#             "filename": fname,
#             "size": len(data),
#             "url": url_path,
#             # "remark": remark or "",
#             "uploadedAt": datetime.now(timezone.utc)
#         })

#     await coll.update_one(
#         {"_id": oid},
#         {
#             "$push": {f"photos_pre.{group}": {"$each": saved}},
#             "$set": {"updatedAt": datetime.now(timezone.utc)}
#         }
#     )
#     return {"ok": True, "count": len(saved), "group": group, "files": saved}


# @app.post("/cbboxpmreport/{report_id}/post/photos")
# async def cbboxpmreport_upload_photos(
#     report_id: str,
#     station_id: str = Form(...),
#     group: str = Form(...),                   # "g1" .. "g11"
#     files: List[UploadFile] = File(...),
#     remark: Optional[str] = Form(None),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
#     if not re.fullmatch(r"g\d+", group):
#         raise HTTPException(status_code=400, detail="Bad group key")

#     coll = get_cbboxpmreport_collection_for(station_id)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Report not found")
#     if doc.get("station_id") != station_id:
#         raise HTTPException(status_code=400, detail="station_id mismatch")

#     # โฟลเดอร์: /uploads/cbboxpm/{station_id}/{report_id}/{group}/
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "cbboxpm" / station_id / report_id / "post" / group
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     saved = []
#     for f in files:
#         ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext not in ALLOWED_EXTS:
#             raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url_path = f"/uploads/cbboxpm/{station_id}/{report_id}/post/{group}/{fname}"
#         saved.append({
#             "filename": fname,
#             "size": len(data),
#             "url": url_path,
#             "remark": remark or "",
#             "uploadedAt": datetime.now(timezone.utc)
#         })

#     await coll.update_one(
#         {"_id": oid},
#         {
#             "$push": {f"photos.{group}": {"$each": saved}},
#             "$set": {"updatedAt": datetime.now(timezone.utc)}
#         }
#     )
#     return {"ok": True, "count": len(saved), "group": group, "files": saved}

# @app.post("/cbboxpmreport/{report_id}/finalize")
# async def cbboxpmreport_finalize(
#     report_id: str,
#     station_id: str = Form(...),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")

#     coll = get_cbboxpmreport_collection_for(station_id)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     # (ออปชัน) ตรวจความครบถ้วนก่อน finalize ได้ที่นี่
#     res = await coll.update_one(
#         {"_id": oid},
#         {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}}
#     )
#     if res.matched_count == 0:
#         raise HTTPException(status_code=404, detail="Report not found")
#     return {"ok": True}

# @app.post("/cbboxpmurl/upload-files", status_code=201)
# async def cbboxpmurl_upload_files(
#     station_id: str = Form(...),
#     reportDate: str = Form(...),            # "YYYY-MM-DD" หรือ ISO -> จะ normalize เป็น YYYY-MM-DD
#     files: List[UploadFile] = File(...),    # อนุญาตเฉพาะ .pdf
#     # current: UserClaims = Depends(get_current_user),
#     issue_id: Optional[str] = Form(None),
#     doc_name: Optional[str] = Form(None),
#     inspector: Optional[str] = Form(None),
# ):
#     coll = get_cbboxpmurl_coll_upload(station_id)
#     pm_date = normalize_pm_date(reportDate)  # คืน YYYY-MM-DD

#     pm_type = "CB"
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

#     rep_coll = get_cbboxpmreport_collection_for(station_id)
#     final_issue_id = None
#     client_issue = (issue_id or "").strip()

#     if client_issue:
#         yymm = f"{d.year % 100:02d}{d.month:02d}"
#         prefix = f"PM-{pm_type}-{yymm}-"
#         valid_fmt = client_issue.startswith(prefix)

#         # ตรวจ uniqueness ในทั้ง 2 คอลเลกชัน
#         url_exists = await coll.find_one({"issue_id": client_issue})
#         rep_exists = await rep_coll.find_one({"issue_id": client_issue})
#         unique = not (url_exists or rep_exists)

#         if valid_fmt and unique:
#             final_issue_id = client_issue

#     # if not final_issue_id:
#     #     # ออกเลขถัดไปแบบ atomic จาก pm_sequences
#     #     final_issue_id = await _next_issue_id(coll.database, station_id, pm_type, d, pad=2)
#     if not final_issue_id:
#         while True:
#             candidate = await _next_issue_id(coll.database, station_id, pm_type, d, pad=2)
#             url_exists = await coll.find_one({"issue_id": candidate})
#             rep_exists = await rep_coll.find_one({"issue_id": candidate})
#             if not url_exists and not rep_exists:
#                 final_issue_id = candidate
#                 break

#     year_seq: int | None = None
#     # พยายาม reuse year_seq จาก PMReportDB ถ้ามีอยู่แล้ว (issue_id เดียวกัน)
#     rep = await get_cbboxpmreport_collection_for(station_id).find_one(
#         {"issue_id": final_issue_id},
#         {"year_seq": 1, "pm_date": 1},
#     )
#     if rep and rep.get("year_seq") is not None:
#         year_seq = int(rep["year_seq"])

#     # ถ้าไม่มีค่า year_seq จาก PMReport → ออกใหม่จาก pm_year_sequences
#     if year_seq is None:
#         year_seq = await _next_year_seq(coll.database, station_id, pm_type, d)

#     year = d.year
#     final_doc_name: str | None = None

#     if doc_name:
#         candidate = doc_name.strip()

#         ok_format = candidate.startswith(f"{station_id}_")

#         rep_coll = get_cbboxpmreport_collection_for(station_id)
#         rep_exists = await rep_coll.find_one({"doc_name": candidate})
#         url_exists = await coll.find_one({"doc_name": candidate})
#         unique = not (rep_exists or url_exists)

#         if ok_format and unique:
#             final_doc_name = candidate

#     if not final_doc_name:
#         final_doc_name = f"{station_id}_{year_seq}/{year}"

#     doc_name = final_doc_name

#     # เก็บไว้ที่ /uploads/mdbpmurl/<station_id>/<YYYY-MM-DD>/
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "cbboxpmurl" / station_id / pm_date
#     dest_dir.mkdir(parents=True, exist_ok=True)


#     urls, metas = [], []
#     for f in files:
#         ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext != "pdf":
#             raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url = f"/uploads/cbboxpmurl/{station_id}/{pm_date}/{fname}"
#         urls.append(url)
#         metas.append({"name": f.filename, "size": len(data)})
    
#     inspector_clean = (inspector or "").strip() or None
#     now = datetime.now(timezone.utc)
#     res = await coll.insert_one({
#         "station": station_id,
#         "issue_id": final_issue_id, 
#         "inspector": inspector_clean,
#         "doc_name": doc_name,
#         "pm_date": pm_date,
#         "urls": urls,
#         "meta": {"files": metas},
#         "source": "upload-files",
#         "createdAt": now,
#         "updatedAt": now,
#     })
#     return {"ok": True, "inserted_id": str(res.inserted_id), "count": len(urls), "urls": urls,"issue_id": final_issue_id,"doc_name": doc_name,"inspector": inspector_clean}

# @app.get("/cbboxpmurl/list")
# async def cbboxpmurl_list(
#     station_id: str = Query(...),
#     page: int = Query(1, ge=1),
#     pageSize: int = Query(20, ge=1, le=100),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     coll = get_cbboxpmurl_coll_upload(station_id)
#     skip = (page - 1) * pageSize

#     cursor = coll.find(
#         {},
#         {"_id": 1, "issue_id": 1,"doc_name": 1,"inspector":1, "pm_date": 1, "urls": 1, "createdAt": 1}
#     ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

#     items_raw = await cursor.to_list(length=pageSize)
#     total = await coll.count_documents({})

#     items = []
#     for it in items_raw:
#         urls = it.get("urls") or []
#         first_url = urls[0] if urls else ""
#         items.append({
#             "id": str(it["_id"]),
#             "pm_date": it.get("pm_date"),
#             "issue_id": it.get("issue_id"),
#             "inspector": it.get(("inspector")), 
#             "doc_name": it.get("doc_name"),
#             "createdAt": _ensure_utc_iso(it.get("createdAt")),
#             "file_url": first_url,
#             "urls": urls,
#         })

#     return {"items": items, "pm_date": [i["pm_date"] for i in items if i.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}

# ---------------------------------------------------------------------------
# new cb-box
# ---------------------------------------------------------------------------
def get_cbboxpmreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    return CBBOXPMReportDB.get_collection(str(station_id))

def get_cbboxpmurl_coll_upload(station_id: str):
    _validate_station_id(station_id)
    return CBBOXPMUrlDB.get_collection(str(station_id))

class CBBOXPMSubmitIn(BaseModel):
    side: Literal["pre", "post"]
    station_id: str
    job: Dict[str, Any]         # โครงงาน (location/date/inspector ฯลฯ)
    rows_pre: Dict[str, Dict[str, Any]]  # ✅ เพิ่ม rows_pre {"r1": {"pf": "...", "remark": "..."}, ...}
    measures_pre: Dict[str, Dict[str, Any]]  # {"m5": {...}}
    pm_date: str                # "YYYY-MM-DD"
    issue_id: Optional[str] = None
    doc_name: Optional[str] = None 
    inspector: Optional[str] = None
    dropdownQ1: Optional[str] = None  # ✅ dropdown Q1
    dropdownQ2: Optional[str] = None  # ✅ dropdown Q2
    comment_pre: Optional[str] = None  # ✅ เพิ่ม comment สำหรับ Pre mode

@app.get("/cbboxpmreport/preview-issueid")
async def cbboxpmreport_preview_issueid(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดู issue_id ถัดไป (PM-CG-YYMM-XX) โดยไม่ออกเลขจริง
    ใช้หาเลขไปโชว์บนฟอร์มเฉย ๆ
    """
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    pm_type = "CB"

    latest = await _latest_issue_id_anywhere(station_id, pm_type, d,source="cbbox")

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"

    if not latest:
        next_issue = f"{prefix}01"
    else:
        m = re.search(r"(\d+)$", latest)
        cur = int(m.group(1)) if m else 0
        next_issue = f"{prefix}{cur+1:02d}"

    return {"issue_id": next_issue}

@app.get("/cbboxpmreport/latest-docname")
async def cbboxpmreport_latest_docname(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดึง doc_name ล่าสุดของสถานี (ปีเดียวกับ pm_date)
    เพื่อใช้คำนวณเลขถัดไปที่ frontend
    """
    latest = await _latest_doc_name_from_pmreport(station_id, pm_date, source="cbbox")
    
    return {
        "doc_name": latest.get("doc_name") if latest else None,
        "station_id": station_id,
        "pm_date": pm_date
    }

@app.get("/cbboxpmreport/preview-docname")
async def preview_docname(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    year = d.year

    latest = await _latest_doc_name_anywhere(station_id, year,source="cbbox")

    if not latest:
        next_doc = f"{station_id}_1/{year}"
    else:
        import re
        m = re.search(r"_(\d+)/\d{4}$", latest)
        current_num = int(m.group(1)) if m else 0
        next_doc = f"{station_id}_{current_num + 1}/{year}"

    return {"doc_name": next_doc}

@app.post("/cbboxpmreport/pre/submit")
async def cbboxpmreport_submit(body: CBBOXPMSubmitIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    coll = get_cbboxpmreport_collection_for(station_id)
    db = coll.database

    pm_type = str(body.job.get("pm_type") or "CB").upper()
    body.job["pm_type"] = pm_type

    url_coll = get_cbboxpmurl_coll_upload(station_id)

    try:
        d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    client_issue = body.issue_id 
    issue_id: str | None = None

    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        valid_fmt = client_issue.startswith(prefix)

        rep_exists = await coll.find_one({"station_id": station_id, "issue_id": client_issue})
        url_exists = await url_coll.find_one({"issue_id": client_issue})
        unique = not await coll.find_one({"station_id": station_id, "issue_id": client_issue})
        if valid_fmt and unique:
            issue_id = client_issue

    if not issue_id:
        while True:
            candidate = await _next_issue_id(db, station_id, pm_type, d, pad=2)
            rep_exists = await coll.find_one({"issue_id": candidate})
            url_exists = await url_coll.find_one({"issue_id": candidate})
            if not rep_exists and not url_exists:
                issue_id = candidate
                break

    client_docName = body.doc_name
    doc_name = None
    if client_docName:
        year = f"{d.year}"
        prefix = f"{station_id}_"
        valid_fmt = client_docName.startswith(prefix)

        url_coll = get_cbboxpmurl_coll_upload(station_id)
        rep_exists = await coll.find_one({"station_id": station_id, "doc_name": client_docName})
        url_exists = await url_coll.find_one({"doc_name": client_docName})
        unique = not (rep_exists or url_exists)

        if valid_fmt and unique:
            doc_name = client_docName
 
    if not doc_name:
        year_seq = await _next_year_seq(db, station_id, pm_type, d)
        year = d.year
        doc_name = f"{station_id}_{year_seq}/{year}"

    doc = {
        "station_id": station_id,
        "doc_name": doc_name,
        "issue_id": issue_id,
        "job": body.job,
        "dropdownQ1": body.dropdownQ1,  # ✅ dropdown Q1
        "dropdownQ2": body.dropdownQ2,  # ✅ dropdown Q2
        "rows_pre": body.rows_pre,      # ✅ เพิ่ม rows_pre
        "measures_pre": body.measures_pre,
        "comment_pre": body.comment_pre,  # ✅ เพิ่ม comment สำหรับ Pre mode
        "pm_date": body.pm_date,
        "status": "draft",
        "photos_pre": {},
        "inspector": body.inspector,
        "side": body.side,
        "createdAt": datetime.now(timezone.utc),
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id),
        "issue_id": issue_id,
        "doc_name": doc_name,
    }
       
class CBBOXPMPostIn(BaseModel):
    report_id: str | None = None
    station_id: str
    rows: dict
    measures: dict
    summary: str
    summaryCheck: str | None = None
    dropdownQ1: Optional[str] = None  # ✅ dropdown Q1
    dropdownQ2: Optional[str] = None  # ✅ dropdown Q2
    side: Literal["post", "after"]

@app.post("/cbboxpmreport/submit")
async def cbboxpmreport_submit(body: CBBOXPMPostIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    coll = get_cbboxpmreport_collection_for(station_id)
    db = coll.database

    url_coll = get_cbboxpmurl_coll_upload(station_id)

    if body.report_id:
        try:
            oid = ObjectId(body.report_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="invalid report_id")

        existing = await coll.find_one({"_id": oid, "station_id": station_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Report not found")

        update_fields = {
            "rows": body.rows,
            "measures": body.measures,
            "summary": body.summary,
            "summaryCheck": body.summaryCheck,
            "dropdownQ1": body.dropdownQ1,  # ✅ dropdown Q1
            "dropdownQ2": body.dropdownQ2,  # ✅ dropdown Q2
            "side": "post",
            "updatedAt": datetime.now(timezone.utc),
        }

        await coll.update_one({"_id": oid}, {"$set": update_fields})

        return {
            "ok": True,
            "report_id": body.report_id,
        }

    doc = {
        "station_id": station_id,
        "rows": body.rows,
        "summary": body.summary,
        "summaryCheck": body.summaryCheck,
        "measures": body.measures, 
        "status": "draft",
        "photos": {},
        "side": body.side,
        "updatedAt": datetime.now(timezone.utc),
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id),
    }

@app.get("/cbboxpmreport/get")
async def cbboxpmreport_get(station_id: str, report_id: str, current: UserClaims = Depends(get_current_user)):
    coll = get_cbboxpmreport_collection_for(station_id)
    doc = await coll.find_one({"_id": ObjectId(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="not found")

    doc["_id"] = str(doc["_id"])
    return doc


@app.get("/cbboxpmreport/list")
async def cbboxpmreport_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    coll = get_cbboxpmreport_collection_for(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find({}, {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector" : 1,"side":1, "createdAt": 1}).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    # ผูก URL PDF รายวันจาก CCBPMUrlDB (ถ้ามี)
    pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
    url_by_day: Dict[str, str] = {}
    if pm_dates:
        ucoll = get_cbboxpmurl_coll_upload(station_id)
        ucur = ucoll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
        url_docs = await ucur.to_list(length=10_000)
        for u in url_docs:
            day = u.get("pm_date")
            first_url = (u.get("urls") or [None])[0]
            if day and first_url and day not in url_by_day:
                url_by_day[day] = first_url

    items = [{
        "id": str(it["_id"]),
        "issue_id": it.get("issue_id"),
        "doc_name": it.get("doc_name"),
        "pm_date": it.get("pm_date"),
        "inspector": it.get("inspector"),
        "side":it.get("side"),
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("pm_date") or "", ""),
    } for it in items_raw]

    return {"items": items, "pm_date": [it.get("pm_date") for it in items_raw if it.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}

@app.post("/cbboxpmreport/{report_id}/pre/photos")
async def cbboxpmreport_upload_photos(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),                   # "g1" .. "g11"
    files: List[UploadFile] = File(...),
):
    if not re.fullmatch(r"g\d+", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_cbboxpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    # โฟลเดอร์: /uploads/cbboxpm/{station_id}/{report_id}/{group}/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "cbboxpm" / station_id / report_id / "pre" / group
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/cbboxpm/{station_id}/{report_id}/pre/{group}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos_pre.{group}": {"$each": saved}},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    return {"ok": True, "count": len(saved), "group": group, "files": saved}


@app.post("/cbboxpmreport/{report_id}/post/photos")
async def cbboxpmreport_upload_photos(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),                   # "g1" .. "g11"
    files: List[UploadFile] = File(...),
    remark: Optional[str] = Form(None),
):
    if not re.fullmatch(r"g\d+", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_cbboxpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    # โฟลเดอร์: /uploads/cbboxpm/{station_id}/{report_id}/{group}/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "cbboxpm" / station_id / report_id / "post" / group
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/cbboxpm/{station_id}/{report_id}/post/{group}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos.{group}": {"$each": saved}},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    return {"ok": True, "count": len(saved), "group": group, "files": saved}

@app.post("/cbboxpmreport/{report_id}/finalize")
async def cbboxpmreport_finalize(
    report_id: str,
    station_id: str = Form(...),
):
    coll = get_cbboxpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    res = await coll.update_one(
        {"_id": oid},
        {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}

@app.post("/cbboxpmurl/upload-files", status_code=201)
async def cbboxpmurl_upload_files(
    station_id: str = Form(...),
    reportDate: str = Form(...),            # "YYYY-MM-DD" หรือ ISO -> จะ normalize เป็น YYYY-MM-DD
    files: List[UploadFile] = File(...),    # อนุญาตเฉพาะ .pdf
    issue_id: Optional[str] = Form(None),
    doc_name: Optional[str] = Form(None),
    inspector: Optional[str] = Form(None),
):
    coll = get_cbboxpmurl_coll_upload(station_id)
    pm_date = normalize_pm_date(reportDate)  # คืน YYYY-MM-DD

    pm_type = "CB"
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

    rep_coll = get_cbboxpmreport_collection_for(station_id)
    final_issue_id = None
    client_issue = (issue_id or "").strip()

    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        valid_fmt = client_issue.startswith(prefix)

        # ตรวจ uniqueness ในทั้ง 2 คอลเลกชัน
        url_exists = await coll.find_one({"issue_id": client_issue})
        rep_exists = await rep_coll.find_one({"issue_id": client_issue})
        unique = not (url_exists or rep_exists)

        if valid_fmt and unique:
            final_issue_id = client_issue

    if not final_issue_id:
        while True:
            candidate = await _next_issue_id(coll.database, station_id, pm_type, d, pad=2)
            url_exists = await coll.find_one({"issue_id": candidate})
            rep_exists = await rep_coll.find_one({"issue_id": candidate})
            if not url_exists and not rep_exists:
                final_issue_id = candidate
                break

    year_seq: int | None = None
    # พยายาม reuse year_seq จาก PMReportDB ถ้ามีอยู่แล้ว (issue_id เดียวกัน)
    rep = await get_cbboxpmreport_collection_for(station_id).find_one(
        {"issue_id": final_issue_id},
        {"year_seq": 1, "pm_date": 1},
    )
    if rep and rep.get("year_seq") is not None:
        year_seq = int(rep["year_seq"])

    # ถ้าไม่มีค่า year_seq จาก PMReport → ออกใหม่จาก pm_year_sequences
    if year_seq is None:
        year_seq = await _next_year_seq(coll.database, station_id, pm_type, d)

    year = d.year
    final_doc_name: str | None = None

    if doc_name:
        candidate = doc_name.strip()

        ok_format = candidate.startswith(f"{station_id}_")

        rep_coll = get_cbboxpmreport_collection_for(station_id)
        rep_exists = await rep_coll.find_one({"doc_name": candidate})
        url_exists = await coll.find_one({"doc_name": candidate})
        unique = not (rep_exists or url_exists)

        if ok_format and unique:
            final_doc_name = candidate

    if not final_doc_name:
        final_doc_name = f"{station_id}_{year_seq}/{year}"

    doc_name = final_doc_name

    # เก็บไว้ที่ /uploads/mdbpmurl/<station_id>/<YYYY-MM-DD>/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "cbboxpmurl" / station_id / pm_date
    dest_dir.mkdir(parents=True, exist_ok=True)


    urls, metas = [], []
    for f in files:
        ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext != "pdf":
            raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url = f"/uploads/cbboxpmurl/{station_id}/{pm_date}/{fname}"
        urls.append(url)
        metas.append({"name": f.filename, "size": len(data)})
    
    inspector_clean = (inspector or "").strip() or None
    now = datetime.now(timezone.utc)
    res = await coll.insert_one({
        "station": station_id,
        "issue_id": final_issue_id, 
        "inspector": inspector_clean,
        "doc_name": doc_name,
        "pm_date": pm_date,
        "urls": urls,
        "meta": {"files": metas},
        "source": "upload-files",
        "createdAt": now,
        "updatedAt": now,
    })
    return {"ok": True, "inserted_id": str(res.inserted_id), "count": len(urls), "urls": urls,"issue_id": final_issue_id,"doc_name": doc_name,"inspector": inspector_clean}

@app.get("/cbboxpmurl/list")
async def cbboxpmurl_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    coll = get_cbboxpmurl_coll_upload(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find(
        {},
        {"_id": 1, "issue_id": 1,"doc_name": 1,"inspector":1, "pm_date": 1, "urls": 1, "createdAt": 1}
    ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    items = []
    for it in items_raw:
        urls = it.get("urls") or []
        first_url = urls[0] if urls else ""
        items.append({
            "id": str(it["_id"]),
            "pm_date": it.get("pm_date"),
            "issue_id": it.get("issue_id"),
            "inspector": it.get(("inspector")), 
            "doc_name": it.get("doc_name"),
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": first_url,
            "urls": urls,
        })

    return {"items": items, "pm_date": [i["pm_date"] for i in items if i.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}


# -------------------------------------------------- PMReportPage (station)       
# def get_stationpmreport_collection_for(station_id: str):
#     _validate_station_id(station_id)
#     return stationPMReportDB.get_collection(str(station_id))

# def get_stationpmurl_coll_upload(station_id: str):
#     _validate_station_id(station_id)
#     return stationPMUrlDB.get_collection(str(station_id))

# class stationPMSubmitIn(BaseModel):
#     side: Literal["pre", "post"]
#     station_id: str
#     job: Dict[str, Any]         # โครงงาน (location/date/inspector ฯลฯ)
#     # rows: Dict[str, Dict[str, Any]]  # {"r1": {"pf": "...", "remark": "..."}, ...}
#     # measures: Dict[str, Dict[str, Any]]  # {"m4": {...}, "m5": {...}, ..., "m8": {...}}
#     # summary: str
#     pm_date: str                # "YYYY-MM-DD"
#     issue_id: Optional[str] = None
#     doc_name: Optional[str] = None 
#     # summaryCheck: Optional[Literal["PASS","FAIL","NA"]] = None
#     inspector: Optional[str] = None

# @app.get("/stationpmreport/preview-issueid")
# async def stationpmreport_preview_issueid(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """
#     ดู issue_id ถัดไป (PM-CG-YYMM-XX) โดยไม่ออกเลขจริง
#     ใช้หาเลขไปโชว์บนฟอร์มเฉย ๆ
#     """
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     pm_type = "ST"

#     latest = await _latest_issue_id_anywhere(station_id, pm_type, d,source="station")

#     yymm = f"{d.year % 100:02d}{d.month:02d}"
#     prefix = f"PM-{pm_type}-{yymm}-"

#     if not latest:
#         next_issue = f"{prefix}01"
#     else:
#         m = re.search(r"(\d+)$", latest)
#         cur = int(m.group(1)) if m else 0
#         next_issue = f"{prefix}{cur+1:02d}"

#     return {"issue_id": next_issue}

# @app.get("/stationpmreport/latest-docname")
# async def stationpmreport_latest_docname(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     """
#     ดึง doc_name ล่าสุดของสถานี (ปีเดียวกับ pm_date)
#     เพื่อใช้คำนวณเลขถัดไปที่ frontend
#     """
#     latest = await _latest_doc_name_from_pmreport(station_id, pm_date, source="station")
    
#     return {
#         "doc_name": latest.get("doc_name") if latest else None,
#         "station_id": station_id,
#         "pm_date": pm_date
#     }

# @app.get("/stationpmreport/preview-docname")
# async def preview_docname(
#     station_id: str = Query(...),
#     pm_date: str = Query(...),
#     current: UserClaims = Depends(get_current_user),
# ):
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     year = d.year

#     latest = await _latest_doc_name_anywhere(station_id, year,source="station")

#     if not latest:
#         next_doc = f"{station_id}_1/{year}"
#     else:
#         import re
#         m = re.search(r"_(\d+)/\d{4}$", latest)
#         current_num = int(m.group(1)) if m else 0
#         next_doc = f"{station_id}_{current_num + 1}/{year}"

#     return {"doc_name": next_doc}

# @app.post("/stationpmreport/pre/submit")
# async def stationpmreport_submit(body: stationPMSubmitIn, current: UserClaims = Depends(get_current_user)):
#     station_id = body.station_id.strip()
#     coll = get_stationpmreport_collection_for(station_id)
#     db = coll.database

#     pm_type = str(body.job.get("pm_type") or "ST").upper()
#     body.job["pm_type"] = pm_type

#     url_coll = get_stationpmurl_coll_upload(station_id)

#     try:
#         d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

#     client_issue = body.issue_id 
#     issue_id: str | None = None
#     if client_issue:
#         yymm = f"{d.year % 100:02d}{d.month:02d}"
#         prefix = f"PM-{pm_type}-{yymm}-"
#         valid_fmt = client_issue.startswith(prefix)
        
#         rep_exists = await coll.find_one({"station_id": station_id, "issue_id": client_issue})
#         url_exists = await url_coll.find_one({"issue_id": client_issue})
#         unique = not await coll.find_one({"station_id": station_id, "issue_id": client_issue})
#         if valid_fmt and unique:
#             issue_id = client_issue

#     # if not issue_id:
#     #     issue_id = await _next_issue_id(db, station_id, pm_type, d, pad=2)
#     if not issue_id:
#             while True:
#                 candidate = await _next_issue_id(db, station_id, pm_type, d, pad=2)
#                 rep_exists = await coll.find_one({"issue_id": candidate})
#                 url_exists = await url_coll.find_one({"issue_id": candidate})
#                 if not rep_exists and not url_exists:
#                     issue_id = candidate
#                     break  

#     client_docName = body.doc_name
#     doc_name = None
#     if client_docName:
#         year = f"{d.year}"
#         prefix = f"{station_id}_"
#         valid_fmt = client_docName.startswith(prefix)

#         url_coll = get_stationpmurl_coll_upload(station_id)
#         rep_exists = await coll.find_one({"station_id": station_id, "doc_name": client_docName})
#         url_exists = await url_coll.find_one({"doc_name": client_docName})
#         unique = not (rep_exists or url_exists)

#         if valid_fmt and unique:
#             doc_name = client_docName
 
#     if not doc_name:
#         year_seq = await _next_year_seq(db, station_id, pm_type, d)
#         year = d.year
#         doc_name = f"{station_id}_{year_seq}/{year}"

#     # เก็บเอกสารเป็น draft ก่อน
#     doc = {
#         "station_id": station_id,
#         "issue_id": issue_id,
#         "doc_name": doc_name,
#         "job": body.job,
#         # "rows": body.rows,
#         # "measures": body.measures,         # m4..m8
#         # "summary": body.summary,
#         # "summaryCheck": body.summaryCheck,
#         "pm_date": body.pm_date,           # string YYYY-MM-DD (ตามฟรอนต์)
#         "status": "draft",
#         "photos_pre": {},                      # จะถูกเติมใน /photos
#         "side": body.side,
#         "inspector": body.inspector,
#         "createdAt": datetime.now(timezone.utc),
#         # "updatedAt": datetime.now(timezone.utc),
#     }

#     res = await coll.insert_one(doc)
#     return {
#         "ok": True, 
#         "report_id": str(res.inserted_id),
#         "issue_id": issue_id,
#         "doc_name": doc_name,
#     }

# class stationPMPostIn(BaseModel):
#     report_id: str | None = None      # 👈 เพิ่ม
#     station_id: str
#     # issue_id: str | None = None
#     # job: dict
#     rows: dict
#     # measures: dict
#     summary: str
#     # pm_date: str
#     # doc_name: str | None = None
#     summaryCheck: str | None = None
#     # dust_filter: str | None = None
#     side: Literal["post", "after"]

# @app.post("/stationpmreport/submit")
# async def stationpmreport_submit(body: stationPMPostIn, current: UserClaims = Depends(get_current_user)):
#     station_id = body.station_id.strip()
#     coll = get_stationpmreport_collection_for(station_id)
#     db = coll.database

#     # pm_type = str(body.job.get("pm_type") or "ST").upper()
#     # body.job["pm_type"] = pm_type

#     url_coll = get_stationpmurl_coll_upload(station_id)

#     if body.report_id:
#         try:
#             oid = ObjectId(body.report_id)
#         except InvalidId:
#             raise HTTPException(status_code=400, detail="invalid report_id")

#         existing = await coll.find_one({"_id": oid, "station_id": station_id})
#         if not existing:
#             raise HTTPException(status_code=404, detail="Report not found")

#         update_fields = {
#             # "job": body.job,
#             "rows": body.rows,
#             # "measures": body.measures,          # ใช้เป็นค่าหลัง PM
#             "summary": body.summary,
#             "summaryCheck": body.summaryCheck,
#             # "pm_date": body.pm_date,
#             # "inspector": inspector,
#             # "dust_filter": body.dust_filter,
#             # "doc_name": doc_name,
#             "side": "post",                     # ตอนนี้อยู่ฝั่ง post แล้ว
#             "updatedAt": datetime.now(timezone.utc),
#         }
    
#         await coll.update_one({"_id": oid}, {"$set": update_fields})

#         return {
#             "ok": True,
#             "report_id": body.report_id,
#             # "issue_id": issue_id,
#             # "doc_name": doc_name,
#         }
#     # เก็บเอกสารเป็น draft ก่อน
#     doc = {
#         "station_id": station_id,
#         # "issue_id": issue_id,
#         # "doc_name": doc_name,
#         # "job": body.job,
#         "rows": body.rows,
#         # "measures": body.measures,         # m4..m8
#         "summary": body.summary,
#         "summaryCheck": body.summaryCheck,
#         # "pm_date": body.pm_date,           # string YYYY-MM-DD (ตามฟรอนต์)
#         "status": "draft",
#         "photos": {},                      # จะถูกเติมใน /photos
#         # "inspector": body.inspector,
#         # "createdAt": datetime.now(timezone.utc),
#         "side": "post",
#         "updatedAt": datetime.now(timezone.utc),
#     }

#     res = await coll.insert_one(doc)
#     return {"ok": True, "report_id": str(res.inserted_id)}

# @app.get("/stationpmreport/get")
# async def stationpmreport_get(station_id: str, report_id: str, current: UserClaims = Depends(get_current_user)):
#     coll = get_stationpmreport_collection_for(station_id)
#     doc = await coll.find_one({"_id": ObjectId(report_id)})
#     if not doc:
#         raise HTTPException(status_code=404, detail="not found")

#     doc["_id"] = str(doc["_id"])
#     return doc

# @app.get("/stationpmreport/list")
# async def ccbpmreport_list(
#     station_id: str = Query(...),
#     page: int = Query(1, ge=1),
#     pageSize: int = Query(20, ge=1, le=100),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     coll = get_stationpmreport_collection_for(station_id)
#     skip = (page - 1) * pageSize

#     cursor = coll.find({}, {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector" : 1,"side":1, "createdAt": 1}).sort(
#         [("createdAt", -1), ("_id", -1)]
#     ).skip(skip).limit(pageSize)

#     items_raw = await cursor.to_list(length=pageSize)
#     total = await coll.count_documents({})

#     # ผูก URL PDF รายวันจาก MDBPMUrlDB (ถ้ามี)
#     pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
#     url_by_day: Dict[str, str] = {}
#     if pm_dates:
#         ucoll = get_stationpmurl_coll_upload(station_id)
#         ucur = ucoll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
#         url_docs = await ucur.to_list(length=10_000)
#         for u in url_docs:
#             day = u.get("pm_date")
#             first_url = (u.get("urls") or [None])[0]
#             if day and first_url and day not in url_by_day:
#                 url_by_day[day] = first_url

#     items = [{
#         "id": str(it["_id"]),
#         "issue_id": it.get("issue_id"),
#         "doc_name": it.get("doc_name"),
#         "pm_date": it.get("pm_date"),
#         "side":it.get("side"),
#         "inspector": it.get("inspector"),
#         "createdAt": _ensure_utc_iso(it.get("createdAt")),
#         "file_url": url_by_day.get(it.get("pm_date") or "", ""),
#     } for it in items_raw]

#     return {"items": items, "pm_date": [it.get("pm_date") for it in items_raw if it.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}

# @app.post("/stationpmreport/{report_id}/pre/photos")
# async def stationpmreport_upload_photos(
#     report_id: str,
#     station_id: str = Form(...),
#     group: str = Form(...),                   # "r1" .. "r10"
#     files: List[UploadFile] = File(...),
#     # remark: Optional[str] = Form(None),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
#     if not re.fullmatch(r"r\d+", group):
#         raise HTTPException(status_code=400, detail="Bad group key")

#     coll = get_stationpmreport_collection_for(station_id)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Report not found")
#     if doc.get("station_id") != station_id:
#         raise HTTPException(status_code=400, detail="station_id mismatch")

#     # โฟลเดอร์: /uploads/mdbpm/{station_id}/{report_id}/{group}/
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "stationpm" / station_id / report_id / "pre" / group
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     saved = []
#     for f in files:
#         ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext not in ALLOWED_EXTS:
#             raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url_path = f"/uploads/stationpm/{station_id}/{report_id}/pre/{group}/{fname}"
#         saved.append({
#             "filename": fname,
#             "size": len(data),
#             "url": url_path,
#             # "remark": remark or "",
#             "uploadedAt": datetime.now(timezone.utc)
#         })

#     await coll.update_one(
#         {"_id": oid},
#         {
#             "$push": {f"photos_pre.{group}": {"$each": saved}},
#             "$set": {"updatedAt": datetime.now(timezone.utc)}
#         }
#     )
#     return {"ok": True, "count": len(saved), "group": group, "files": saved}

# @app.post("/stationpmreport/{report_id}/post/photos")
# async def stationpmreport_upload_photos(
#     report_id: str,
#     station_id: str = Form(...),
#     group: str = Form(...),                   # "r1" .. "r10"
#     files: List[UploadFile] = File(...),
#     remark: Optional[str] = Form(None),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")
#     if not re.fullmatch(r"r\d+", group):
#         raise HTTPException(status_code=400, detail="Bad group key")

#     coll = get_stationpmreport_collection_for(station_id)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
#     if not doc:
#         raise HTTPException(status_code=404, detail="Report not found")
#     if doc.get("station_id") != station_id:
#         raise HTTPException(status_code=400, detail="station_id mismatch")

#     # โฟลเดอร์: /uploads/mdbpm/{station_id}/{report_id}/{group}/
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "stationpm" / station_id / report_id / "post" / group
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     saved = []
#     for f in files:
#         ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext not in ALLOWED_EXTS:
#             raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url_path = f"/uploads/stationpm/{station_id}/{report_id}/post/{group}/{fname}"
#         saved.append({
#             "filename": fname,
#             "size": len(data),
#             "url": url_path,
#             "remark": remark or "",
#             "uploadedAt": datetime.now(timezone.utc)
#         })

#     await coll.update_one(
#         {"_id": oid},
#         {
#             "$push": {f"photos.{group}": {"$each": saved}},
#             "$set": {"updatedAt": datetime.now(timezone.utc)}
#         }
#     )
#     return {"ok": True, "count": len(saved), "group": group, "files": saved}

# @app.post("/stationpmreport/{report_id}/finalize")
# async def stationpmreport_finalize(
#     report_id: str,
#     station_id: str = Form(...),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     # if current.role != "admin" and station_id not in set(current.station_ids):
#     #     raise HTTPException(status_code=403, detail="Forbidden station_id")

#     coll = get_stationpmreport_collection_for(station_id)
#     try:
#         oid = ObjectId(report_id)
#     except Exception:
#         raise HTTPException(status_code=400, detail="Bad report_id")

#     # (ออปชัน) ตรวจความครบถ้วนก่อน finalize ได้ที่นี่
#     res = await coll.update_one(
#         {"_id": oid},
#         {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}}
#     )
#     if res.matched_count == 0:
#         raise HTTPException(status_code=404, detail="Report not found")
#     return {"ok": True}

# @app.post("/stationpmurl/upload-files", status_code=201)
# async def stationmurl_upload_files(
#     station_id: str = Form(...),
#     reportDate: str = Form(...),            # "YYYY-MM-DD" หรือ ISO -> จะ normalize เป็น YYYY-MM-DD
#     files: List[UploadFile] = File(...),    # อนุญาตเฉพาะ .pdf
#     # current: UserClaims = Depends(get_current_user),
#     issue_id: Optional[str] = Form(None),
#     doc_name: Optional[str] = Form(None),
#     inspector: Optional[str] = Form(None),
# ):
#     coll = get_stationpmurl_coll_upload(station_id)
#     pm_date = normalize_pm_date(reportDate)  # คืน YYYY-MM-DD

#     pm_type = "ST"
#     try:
#         d = datetime.strptime(pm_date, "%Y-%m-%d").date()
#     except ValueError:
#         raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

#     rep_coll = get_stationpmreport_collection_for(station_id)
#     final_issue_id = None
#     client_issue = (issue_id or "").strip()

#     if client_issue:
#         yymm = f"{d.year % 100:02d}{d.month:02d}"
#         prefix = f"PM-{pm_type}-{yymm}-"
#         valid_fmt = client_issue.startswith(prefix)

#         # ตรวจ uniqueness ในทั้ง 2 คอลเลกชัน
#         url_exists = await coll.find_one({"issue_id": client_issue})
#         rep_exists = await rep_coll.find_one({"issue_id": client_issue})
#         unique = not (url_exists or rep_exists)

#         if valid_fmt and unique:
#             final_issue_id = client_issue

#     if not final_issue_id:
#         while True:
#             candidate = await _next_issue_id(coll.database, station_id, pm_type, d, pad=2)
#             url_exists = await coll.find_one({"issue_id": candidate})
#             rep_exists = await rep_coll.find_one({"issue_id": candidate})
#             if not url_exists and not rep_exists:
#                 final_issue_id = candidate
#                 break

#     year_seq: int | None = None
#     # พยายาม reuse year_seq จาก PMReportDB ถ้ามีอยู่แล้ว (issue_id เดียวกัน)
#     rep = await get_stationpmreport_collection_for(station_id).find_one(
#         {"issue_id": final_issue_id},
#         {"year_seq": 1, "pm_date": 1},
#     )
#     if rep and rep.get("year_seq") is not None:
#         year_seq = int(rep["year_seq"])

#     # ถ้าไม่มีค่า year_seq จาก PMReport → ออกใหม่จาก pm_year_sequences
#     if year_seq is None:
#         year_seq = await _next_year_seq(coll.database, station_id, pm_type, d)

#     year = d.year
#     final_doc_name: str | None = None

#     if doc_name:
#         candidate = doc_name.strip()

#         ok_format = candidate.startswith(f"{station_id}_")

#         rep_coll = get_stationpmreport_collection_for(station_id)
#         rep_exists = await rep_coll.find_one({"doc_name": candidate})
#         url_exists = await coll.find_one({"doc_name": candidate})
#         unique = not (rep_exists or url_exists)

#         if ok_format and unique:
#             final_doc_name = candidate

#     if not final_doc_name:
#         final_doc_name = f"{station_id}_{year_seq}/{year}"

#     doc_name = final_doc_name

#     # เก็บไว้ที่ /uploads/mdbpmurl/<station_id>/<YYYY-MM-DD>/
#     dest_dir = pathlib.Path(UPLOADS_ROOT) / "stationpmurl" / station_id / pm_date
#     dest_dir.mkdir(parents=True, exist_ok=True)

#     urls, metas = [], []
#     for f in files:
#         ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
#         if ext != "pdf":
#             raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

#         data = await f.read()
#         if len(data) > MAX_FILE_MB * 1024 * 1024:
#             raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

#         fname = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
#         path = dest_dir / fname
#         with open(path, "wb") as out:
#             out.write(data)

#         url = f"/uploads/stationpmurl/{station_id}/{pm_date}/{fname}"
#         urls.append(url)
#         metas.append({"name": f.filename, "size": len(data)})

#     inspector_clean = (inspector or "").strip() or None
#     now = datetime.now(timezone.utc)
#     res = await coll.insert_one({
#         "station": station_id,
#         "pm_date": pm_date,
#         "issue_id": final_issue_id, 
#         "inspector": inspector_clean,
#         "doc_name": doc_name,
#         "urls": urls,
#         "meta": {"files": metas},
#         "source": "upload-files",
#         "createdAt": now,
#         "updatedAt": now,
#     })
#     return {"ok": True, "inserted_id": str(res.inserted_id), "count": len(urls), "urls": urls,"issue_id": final_issue_id,"doc_name": doc_name,"inspector": inspector_clean}

# @app.get("/stationpmurl/list")
# async def stationpmurl_list(
#     station_id: str = Query(...),
#     page: int = Query(1, ge=1),
#     pageSize: int = Query(20, ge=1, le=100),
#     # current: UserClaims = Depends(get_current_user),
# ):
#     coll = get_stationpmurl_coll_upload(station_id)
#     skip = (page - 1) * pageSize

#     cursor = coll.find(
#         {},
#         {"_id": 1, "issue_id": 1,"doc_name": 1,"inspector":1, "pm_date": 1, "urls": 1, "createdAt": 1}
#     ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

#     items_raw = await cursor.to_list(length=pageSize)
#     total = await coll.count_documents({})

#     items = []
#     for it in items_raw:
#         urls = it.get("urls") or []
#         first_url = urls[0] if urls else ""
#         items.append({
#             "id": str(it["_id"]),
#             "pm_date": it.get("pm_date"),
#             "issue_id": it.get("issue_id"),
#             "inspector": it.get(("inspector")), 
#             "doc_name": it.get("doc_name"),
#             "createdAt": _ensure_utc_iso(it.get("createdAt")),
#             "file_url": first_url,
#             "urls": urls,
#         })

#     return {"items": items, "pm_date": [i["pm_date"] for i in items if i.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}

# -------------------------------------------------------------------------------
# new PM Report (Station)
# -------------------------------------------------------------------------------
def get_stationpmreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    return stationPMReportDB.get_collection(str(station_id))

def get_stationpmurl_coll_upload(station_id: str):
    _validate_station_id(station_id)
    return stationPMUrlDB.get_collection(str(station_id))

class stationPMSubmitIn(BaseModel):
    side: Literal["pre", "post"]
    station_id: str
    job: Dict[str, Any]         # โครงงาน (location/date/inspector ฯลฯ)
    rows_pre: Dict[str, Dict[str, Any]]
    pm_date: str                # "YYYY-MM-DD"
    issue_id: Optional[str] = None
    doc_name: Optional[str] = None 
    comment_pre: Optional[str] = None
    inspector: Optional[str] = None

@app.get("/stationpmreport/preview-issueid")
async def stationpmreport_preview_issueid(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดู issue_id ถัดไป (PM-CG-YYMM-XX) โดยไม่ออกเลขจริง
    ใช้หาเลขไปโชว์บนฟอร์มเฉย ๆ
    """
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    pm_type = "ST"

    latest = await _latest_issue_id_anywhere(station_id, pm_type, d,source="station")

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    prefix = f"PM-{pm_type}-{yymm}-"

    if not latest:
        next_issue = f"{prefix}01"
    else:
        m = re.search(r"(\d+)$", latest)
        cur = int(m.group(1)) if m else 0
        next_issue = f"{prefix}{cur+1:02d}"

    return {"issue_id": next_issue}

@app.get("/stationpmreport/latest-docname")
async def stationpmreport_latest_docname(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ดึง doc_name ล่าสุดของสถานี (ปีเดียวกับ pm_date)
    เพื่อใช้คำนวณเลขถัดไปที่ frontend
    """
    latest = await _latest_doc_name_from_pmreport(station_id, pm_date, source="station")
    
    return {
        "doc_name": latest.get("doc_name") if latest else None,
        "station_id": station_id,
        "pm_date": pm_date
    }

@app.get("/stationpmreport/preview-docname")
async def preview_docname(
    station_id: str = Query(...),
    pm_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    year = d.year

    latest = await _latest_doc_name_anywhere(station_id, year,source="station")

    if not latest:
        next_doc = f"{station_id}_1/{year}"
    else:
        import re
        m = re.search(r"_(\d+)/\d{4}$", latest)
        current_num = int(m.group(1)) if m else 0
        next_doc = f"{station_id}_{current_num + 1}/{year}"

    return {"doc_name": next_doc}

@app.post("/stationpmreport/pre/submit")
async def stationpmreport_submit(body: stationPMSubmitIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    coll = get_stationpmreport_collection_for(station_id)
    db = coll.database

    pm_type = str(body.job.get("pm_type") or "ST").upper()
    body.job["pm_type"] = pm_type

    url_coll = get_stationpmurl_coll_upload(station_id)

    try:
        d = datetime.strptime(body.pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="pm_date must be YYYY-MM-DD")

    # === Issue ID Generation ===
    client_issue = body.issue_id 
    issue_id: str | None = None
    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        valid_fmt = client_issue.startswith(prefix)
        
        rep_exists = await coll.find_one({"station_id": station_id, "issue_id": client_issue})
        url_exists = await url_coll.find_one({"issue_id": client_issue})
        unique = not await coll.find_one({"station_id": station_id, "issue_id": client_issue})
        if valid_fmt and unique:
            issue_id = client_issue

    if not issue_id:
        while True:
            candidate = await _next_issue_id(db, station_id, pm_type, d, pad=2)
            rep_exists = await coll.find_one({"issue_id": candidate})
            url_exists = await url_coll.find_one({"issue_id": candidate})
            if not rep_exists and not url_exists:
                issue_id = candidate
                break  

    # === Doc Name Generation ===
    client_docName = body.doc_name
    doc_name = None
    if client_docName:
        year = f"{d.year}"
        prefix = f"{station_id}_"
        valid_fmt = client_docName.startswith(prefix)

        url_coll = get_stationpmurl_coll_upload(station_id)
        rep_exists = await coll.find_one({"station_id": station_id, "doc_name": client_docName})
        url_exists = await url_coll.find_one({"doc_name": client_docName})
        unique = not (rep_exists or url_exists)

        if valid_fmt and unique:
            doc_name = client_docName
 
    if not doc_name:
        year_seq = await _next_year_seq(db, station_id, pm_type, d)
        year = d.year
        doc_name = f"{station_id}_{year_seq}/{year}"

    # === Create Document ===
    doc = {
        "station_id": station_id,
        "issue_id": issue_id,
        "doc_name": doc_name,
        "job": body.job,
        "rows_pre": body.rows_pre,        # ✅ NEW: Store Pre mode rows (pf + remark)
        "comment_pre": body.comment_pre,  # ✅ NEW: Store Pre mode comment
        "pm_date": body.pm_date,
        "status": "draft",
        "photos_pre": {},
        "side": body.side,
        "inspector": body.inspector,
        "createdAt": datetime.now(timezone.utc),
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id),
        "issue_id": issue_id,
        "doc_name": doc_name,
    }

class stationPMPostIn(BaseModel):
    report_id: str | None = None      # 👈 เพิ่ม
    station_id: str
    rows: dict
    summary: str
    summaryCheck: str | None = None
    side: Literal["post", "after"]

@app.post("/stationpmreport/submit")
async def stationpmreport_post_submit(body: stationPMPostIn, current: UserClaims = Depends(get_current_user)):
    """Post mode submission - updates existing report"""
    station_id = body.station_id.strip()
    coll = get_stationpmreport_collection_for(station_id)
    db = coll.database

    url_coll = get_stationpmurl_coll_upload(station_id)

    if body.report_id:
        try:
            oid = ObjectId(body.report_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="invalid report_id")

        existing = await coll.find_one({"_id": oid, "station_id": station_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Report not found")

        update_fields = {
            "rows": body.rows,
            "summary": body.summary,
            "summaryCheck": body.summaryCheck,
            "side": "post",
            "updatedAt": datetime.now(timezone.utc),
        }
    
        await coll.update_one({"_id": oid}, {"$set": update_fields})

        return {
            "ok": True,
            "report_id": body.report_id,
        }

    # Fallback: create new document (shouldn't happen normally)
    doc = {
        "station_id": station_id,
        "rows": body.rows,
        "summary": body.summary,
        "summaryCheck": body.summaryCheck,
        "status": "draft",
        "photos": {},
        "side": "post",
        "updatedAt": datetime.now(timezone.utc),
    }

    res = await coll.insert_one(doc)
    return {"ok": True, "report_id": str(res.inserted_id)}

@app.get("/stationpmreport/get")
async def stationpmreport_get(station_id: str, report_id: str, current: UserClaims = Depends(get_current_user)):
    """Get report - returns all fields including rows_pre and comment_pre"""
    coll = get_stationpmreport_collection_for(station_id)
    doc = await coll.find_one({"_id": ObjectId(report_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="not found")

    doc["_id"] = str(doc["_id"])
    return doc

@app.get("/stationpmreport/list")
async def ccbpmreport_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    # current: UserClaims = Depends(get_current_user),
):
    coll = get_stationpmreport_collection_for(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find({}, {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "inspector" : 1,"side":1, "createdAt": 1}).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    # ผูก URL PDF รายวันจาก MDBPMUrlDB (ถ้ามี)
    pm_dates = [it.get("pm_date") for it in items_raw if it.get("pm_date")]
    url_by_day: Dict[str, str] = {}
    if pm_dates:
        ucoll = get_stationpmurl_coll_upload(station_id)
        ucur = ucoll.find({"pm_date": {"$in": pm_dates}}, {"pm_date": 1, "urls": 1})
        url_docs = await ucur.to_list(length=10_000)
        for u in url_docs:
            day = u.get("pm_date")
            first_url = (u.get("urls") or [None])[0]
            if day and first_url and day not in url_by_day:
                url_by_day[day] = first_url

    items = [{
        "id": str(it["_id"]),
        "issue_id": it.get("issue_id"),
        "doc_name": it.get("doc_name"),
        "pm_date": it.get("pm_date"),
        "side":it.get("side"),
        "inspector": it.get("inspector"),
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("pm_date") or "", ""),
    } for it in items_raw]

    return {"items": items, "pm_date": [it.get("pm_date") for it in items_raw if it.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}

@app.post("/stationpmreport/{report_id}/pre/photos")
async def stationpmreport_upload_photos(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),                   # "r1" .. "r10"
    files: List[UploadFile] = File(...),
    # remark: Optional[str] = Form(None),
    # current: UserClaims = Depends(get_current_user),
):
    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")
    if not re.fullmatch(r"r\d+", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_stationpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    # โฟลเดอร์: /uploads/mdbpm/{station_id}/{report_id}/{group}/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "stationpm" / station_id / report_id / "pre" / group
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/stationpm/{station_id}/{report_id}/pre/{group}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            # "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos_pre.{group}": {"$each": saved}},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    return {"ok": True, "count": len(saved), "group": group, "files": saved}

@app.post("/stationpmreport/{report_id}/post/photos")
async def stationpmreport_upload_photos(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),                   # "r1" .. "r10"
    files: List[UploadFile] = File(...),
    remark: Optional[str] = Form(None),
    # current: UserClaims = Depends(get_current_user),
):
    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")
    if not re.fullmatch(r"r\d+", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_stationpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1, "station_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    # โฟลเดอร์: /uploads/mdbpm/{station_id}/{report_id}/{group}/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "stationpm" / station_id / report_id / "post" / group
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/stationpm/{station_id}/{report_id}/post/{group}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc)
        })

    await coll.update_one(
        {"_id": oid},
        {
            "$push": {f"photos.{group}": {"$each": saved}},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )
    return {"ok": True, "count": len(saved), "group": group, "files": saved}

@app.post("/stationpmreport/{report_id}/finalize")
async def stationpmreport_finalize(
    report_id: str,
    station_id: str = Form(...),
    # current: UserClaims = Depends(get_current_user),
):
    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")

    coll = get_stationpmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    # (ออปชัน) ตรวจความครบถ้วนก่อน finalize ได้ที่นี่
    res = await coll.update_one(
        {"_id": oid},
        {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc), "updatedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}

@app.post("/stationpmurl/upload-files", status_code=201)
async def stationmurl_upload_files(
    station_id: str = Form(...),
    reportDate: str = Form(...),            # "YYYY-MM-DD" หรือ ISO -> จะ normalize เป็น YYYY-MM-DD
    files: List[UploadFile] = File(...),    # อนุญาตเฉพาะ .pdf
    # current: UserClaims = Depends(get_current_user),
    issue_id: Optional[str] = Form(None),
    doc_name: Optional[str] = Form(None),
    inspector: Optional[str] = Form(None),
):
    coll = get_stationpmurl_coll_upload(station_id)
    pm_date = normalize_pm_date(reportDate)  # คืน YYYY-MM-DD

    pm_type = "ST"
    try:
        d = datetime.strptime(pm_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="reportDate/pm_date must be YYYY-MM-DD")

    rep_coll = get_stationpmreport_collection_for(station_id)
    final_issue_id = None
    client_issue = (issue_id or "").strip()

    if client_issue:
        yymm = f"{d.year % 100:02d}{d.month:02d}"
        prefix = f"PM-{pm_type}-{yymm}-"
        valid_fmt = client_issue.startswith(prefix)

        # ตรวจ uniqueness ในทั้ง 2 คอลเลกชัน
        url_exists = await coll.find_one({"issue_id": client_issue})
        rep_exists = await rep_coll.find_one({"issue_id": client_issue})
        unique = not (url_exists or rep_exists)

        if valid_fmt and unique:
            final_issue_id = client_issue

    if not final_issue_id:
        while True:
            candidate = await _next_issue_id(coll.database, station_id, pm_type, d, pad=2)
            url_exists = await coll.find_one({"issue_id": candidate})
            rep_exists = await rep_coll.find_one({"issue_id": candidate})
            if not url_exists and not rep_exists:
                final_issue_id = candidate
                break

    year_seq: int | None = None
    # พยายาม reuse year_seq จาก PMReportDB ถ้ามีอยู่แล้ว (issue_id เดียวกัน)
    rep = await get_stationpmreport_collection_for(station_id).find_one(
        {"issue_id": final_issue_id},
        {"year_seq": 1, "pm_date": 1},
    )
    if rep and rep.get("year_seq") is not None:
        year_seq = int(rep["year_seq"])

    # ถ้าไม่มีค่า year_seq จาก PMReport → ออกใหม่จาก pm_year_sequences
    if year_seq is None:
        year_seq = await _next_year_seq(coll.database, station_id, pm_type, d)

    year = d.year
    final_doc_name: str | None = None

    if doc_name:
        candidate = doc_name.strip()

        ok_format = candidate.startswith(f"{station_id}_")

        rep_coll = get_stationpmreport_collection_for(station_id)
        rep_exists = await rep_coll.find_one({"doc_name": candidate})
        url_exists = await coll.find_one({"doc_name": candidate})
        unique = not (rep_exists or url_exists)

        if ok_format and unique:
            final_doc_name = candidate

    if not final_doc_name:
        final_doc_name = f"{station_id}_{year_seq}/{year}"

    doc_name = final_doc_name

    # เก็บไว้ที่ /uploads/mdbpmurl/<station_id>/<YYYY-MM-DD>/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "stationpmurl" / station_id / pm_date
    dest_dir.mkdir(parents=True, exist_ok=True)

    urls, metas = [], []
    for f in files:
        ext = (f.filename.rsplit(".",1)[-1].lower() if f.filename and "." in f.filename else "")
        if ext != "pdf":
            raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

        data = await f.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url = f"/uploads/stationpmurl/{station_id}/{pm_date}/{fname}"
        urls.append(url)
        metas.append({"name": f.filename, "size": len(data)})

    inspector_clean = (inspector or "").strip() or None
    now = datetime.now(timezone.utc)
    res = await coll.insert_one({
        "station": station_id,
        "pm_date": pm_date,
        "issue_id": final_issue_id, 
        "inspector": inspector_clean,
        "doc_name": doc_name,
        "urls": urls,
        "meta": {"files": metas},
        "source": "upload-files",
        "createdAt": now,
        "updatedAt": now,
    })
    return {"ok": True, "inserted_id": str(res.inserted_id), "count": len(urls), "urls": urls,"issue_id": final_issue_id,"doc_name": doc_name,"inspector": inspector_clean}

@app.get("/stationpmurl/list")
async def stationpmurl_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    # current: UserClaims = Depends(get_current_user),
):
    coll = get_stationpmurl_coll_upload(station_id)
    skip = (page - 1) * pageSize

    cursor = coll.find(
        {},
        {"_id": 1, "issue_id": 1,"doc_name": 1,"inspector":1, "pm_date": 1, "urls": 1, "createdAt": 1}
    ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    items = []
    for it in items_raw:
        urls = it.get("urls") or []
        first_url = urls[0] if urls else ""
        items.append({
            "id": str(it["_id"]),
            "pm_date": it.get("pm_date"),
            "issue_id": it.get("issue_id"),
            "inspector": it.get(("inspector")), 
            "doc_name": it.get("doc_name"),
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": first_url,
            "urls": urls,
        })

    return {"items": items, "pm_date": [i["pm_date"] for i in items if i.get("pm_date")], "page": page, "pageSize": pageSize, "total": total}



#----------------------------------------------------------------------
# CM Report
# ---------------------------------------------------------------------
def get_cmreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    coll = CMReportDB.get_collection(str(station_id))
    return coll

def get_cmurl_coll_upload(station_id: str):
    _validate_station_id(station_id)
    coll = CMUrlDB.get_collection(str(station_id))
    return coll

# ==================== ISSUE_ID & DOC_NAME HELPERS ====================

def make_cm_issue_prefix(station_id: str, date_iso: str) -> str:
    """สร้าง prefix สำหรับ issue_id: CM-{station_id}-{yymm}-"""
    d = datetime.fromisoformat(date_iso) if date_iso else datetime.now(th_tz)
    yy = str(d.year)[2:]  # 2 หลักท้าย
    mm = str(d.month).zfill(2)
    return f"CM-{station_id}-{yy}{mm}-"

def make_cm_doc_prefix(station_id: str, date_iso: str) -> str:
    """สร้าง prefix สำหรับ doc_name: CM-{station_id}-{yyyy}-"""
    d = datetime.fromisoformat(date_iso) if date_iso else datetime.now(th_tz)
    yyyy = str(d.year)
    return f"CM-{station_id}-{yyyy}-"

async def get_next_cm_issue_id(station_id: str, found_date: str) -> str:
    """
    หา issue_id ถัดไปจากทั้ง cmreport และ cmurl collections
    Format: CM-{station_id}-{yymm}-{xx}
    """
    prefix = make_cm_issue_prefix(station_id, found_date)
    
    report_coll = get_cmreport_collection_for(station_id)
    url_coll = get_cmurl_coll_upload(station_id)
    
    # หาจากทั้งสอง collections
    all_ids = []
    
    # จาก cmreport
    cursor1 = report_coll.find(
        {"issue_id": {"$regex": f"^{re.escape(prefix)}"}},
        {"issue_id": 1}
    )
    async for doc in cursor1:
        if doc.get("issue_id"):
            all_ids.append(doc["issue_id"])
    
    # จาก cmurl
    cursor2 = url_coll.find(
        {"issue_id": {"$regex": f"^{re.escape(prefix)}"}},
        {"issue_id": 1}
    )
    async for doc in cursor2:
        if doc.get("issue_id"):
            all_ids.append(doc["issue_id"])
    
    if not all_ids:
        return f"{prefix}01"
    
    # หาเลขสูงสุด
    max_num = 0
    for issue_id in all_ids:
        if issue_id.startswith(prefix):
            tail = issue_id[len(prefix):]
            match = re.match(r"(\d+)", tail)
            if match:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num
    
    next_num = max_num + 1
    return f"{prefix}{str(next_num).zfill(2)}"

async def get_next_cm_doc_name(station_id: str, found_date: str) -> str:
    """
    หา doc_name ถัดไปจากทั้ง cmreport และ cmurl collections
    Format: CM-{station_id}-{yyyy}-{xx}
    """
    prefix = make_cm_doc_prefix(station_id, found_date)
    
    report_coll = get_cmreport_collection_for(station_id)
    url_coll = get_cmurl_coll_upload(station_id)
    
    all_names = []
    
    # จาก cmreport
    cursor1 = report_coll.find(
        {"doc_name": {"$regex": f"^{re.escape(prefix)}"}},
        {"doc_name": 1}
    )
    async for doc in cursor1:
        if doc.get("doc_name"):
            all_names.append(doc["doc_name"])
    
    # จาก cmurl
    cursor2 = url_coll.find(
        {"doc_name": {"$regex": f"^{re.escape(prefix)}"}},
        {"doc_name": 1}
    )
    async for doc in cursor2:
        if doc.get("doc_name"):
            all_names.append(doc["doc_name"])
    
    if not all_names:
        return f"{prefix}01"
    
    # หาเลขสูงสุด
    max_num = 0
    for doc_name in all_names:
        if doc_name.startswith(prefix):
            tail = doc_name[len(prefix):]
            match = re.match(r"(\d+)", tail)
            if match:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num
    
    next_num = max_num + 1
    return f"{prefix}{str(next_num).zfill(2)}"

# ==================== PREVIEW ENDPOINTS ====================

@app.get("/cmreport/preview-docname")
async def cmreport_preview_docname(
    station_id: str = Query(...),
    found_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """Preview doc_name ที่จะได้รับสำหรับวันที่ระบุ"""
    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")
    
    found_date_normalized = normalize_pm_date(found_date)
    doc_name = await get_next_cm_doc_name(station_id, found_date_normalized)
    issue_id = await get_next_cm_issue_id(station_id, found_date_normalized)
    
    return {
        "doc_name": doc_name,
        "issue_id": issue_id,
        "found_date": found_date_normalized,
    }

@app.get("/cmreport/latest-docname")
async def cmreport_latest_docname(
    station_id: str = Query(...),
    found_date: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """หา doc_name ล่าสุดสำหรับปีนั้น"""
    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")
    
    found_date_normalized = normalize_pm_date(found_date)
    prefix = make_cm_doc_prefix(station_id, found_date_normalized)
    
    report_coll = get_cmreport_collection_for(station_id)
    url_coll = get_cmurl_coll_upload(station_id)
    
    # หา doc_name ล่าสุดจากทั้งสอง collections
    latest = None
    max_num = 0
    
    for coll in [report_coll, url_coll]:
        cursor = coll.find(
            {"doc_name": {"$regex": f"^{re.escape(prefix)}"}},
            {"doc_name": 1}
        ).sort("doc_name", -1).limit(10)
        
        async for doc in cursor:
            name = doc.get("doc_name", "")
            if name.startswith(prefix):
                tail = name[len(prefix):]
                match = re.match(r"(\d+)", tail)
                if match:
                    num = int(match.group(1))
                    if num > max_num:
                        max_num = num
                        latest = name
    
    return {"doc_name": latest}

# ==================== UPDATED LIST ENDPOINTS ====================

@app.get("/cmreport/list")
async def cmreport_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
):
    coll = get_cmreport_collection_for(station_id)
    skip = (page - 1) * pageSize

    # Filter by status if provided
    mongo_filter: dict = {}
    if status:
        want = status.strip()
        mongo_filter["$or"] = [
            {"status": {"$regex": f"^{re.escape(want)}$", "$options": "i"}},
            {"job.status": {"$regex": f"^{re.escape(want)}$", "$options": "i"}},
        ]

    cursor = coll.find(mongo_filter, {
        "_id": 1, 
        "doc_name": 1,
        "issue_id": 1,
        "cm_date": 1, 
        "status": 1, 
        "reported_by": 1,
        "faulty_equipment": 1,  # เพิ่ม flat fields
        "severity": 1,
        "problem_details": 1,
        "location": 1,
        "job": 1,
        "repair_result": 1,
        "createdAt": 1
    }).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)
    
    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents(mongo_filter)

    # ดึงไฟล์จาก CMUrl โดย map ด้วย cm_date
    cm_dates = [it.get("cm_date") for it in items_raw if it.get("cm_date")]
    urls_coll = get_cmurl_coll_upload(station_id)
    url_by_day: dict[str, str] = {}

    if cm_dates:
        ucur = urls_coll.find({"cm_date": {"$in": cm_dates}}, {"cm_date": 1, "status": 1, "urls": 1})
        url_docs = await ucur.to_list(length=10_000)
        for u in url_docs:
            day = u.get("cm_date")
            first_url = (u.get("urls") or [None])[0]
            if day and first_url and day not in url_by_day:
                url_by_day[day] = first_url

    items = []
    for it in items_raw:
        job = it.get("job", {})
        items.append({
            "id": str(it["_id"]),
            "doc_name": it.get("doc_name") or "",
            "issue_id": it.get("issue_id") or job.get("issue_id") or "",
            "cm_date": it.get("cm_date"),
            "reported_by": it.get("reported_by") or job.get("reported_by") or "",
            "status": it.get("status") or job.get("status") or "",
            "faulty_equipment": it.get("faulty_equipment") or job.get("faulty_equipment") or "",
            "severity": it.get("severity") or job.get("severity") or "",
            "location": it.get("location") or job.get("location") or "",
            "repair_result": it.get("repair_result") or job.get("repair_result") or "",
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": url_by_day.get(it.get("cm_date") or "", ""),
        })

    return {
        "items": items, 
        "page": page, 
        "pageSize": pageSize, 
        "total": total
    }


# ตำแหน่งโฟลเดอร์บนเครื่องเซิร์ฟเวอร์
UPLOADS_ROOT = os.getenv("UPLOADS_ROOT", "./uploads")
os.makedirs(UPLOADS_ROOT, exist_ok=True)

# เสิร์ฟไฟล์คืนให้ Frontend ผ่าน /uploads/...
app.mount("/uploads", StaticFiles(directory=UPLOADS_ROOT, html=False), name="uploads")

# ALLOWED_EXTS = {"jpg","jpeg","png","webp","gif"}
# MAX_FILE_MB = 10

def _safe_name(name: str) -> str:
    # กัน path traversal และอักขระแปลก ๆ
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return base[:120] or secrets.token_hex(4)

def _ext(fname: str) -> str:
    return (fname.rsplit(".",1)[-1].lower() if "." in fname else "")

@app.post("/cmreport/{report_id}/photos")
async def cmreport_upload_photos(
    report_id: str,
    station_id: str = Form(...),
    group: str = Form(...),
    phase: str = Form("problem"),       # ✅ เพิ่ม: "problem" หรือ "repair"
    files: list[UploadFile] = File(...),
    remark: str | None = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    
    if phase not in ("problem", "repair"):
        raise HTTPException(status_code=400, detail="phase must be 'problem' or 'repair'")
    photo_field = f"photos_{phase}"

    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")
    if not re.fullmatch(r"[a-z][a-z0-9_]*", group):
        raise HTTPException(status_code=400, detail="Bad group key")

    coll = get_cmreport_collection_for(station_id)
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    # ยืนยันว่ารายงานนี้อยู่ใน station นี้
    doc = await coll.find_one({"_id": oid}, {"_id":1, "station_id":1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    if doc.get("station_id") != station_id:
        raise HTTPException(status_code=400, detail="station_id mismatch")

    # โฟลเดอร์ปลายทาง
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "cm" / station_id / report_id / group
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    total = 0
    for f in files:
        ext = _ext(f.filename or "")
        if ext not in ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        total += len(data)
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        # URL สำหรับแสดงบน Frontend
        url_path = f"/uploads/cm/{station_id}/{report_id}/{group}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc)
        })

    # อัปเดตเอกสาร PMReport: push ลง photos.<group>
    await coll.update_one(
        {"_id": oid},
        {"$push": {f"{photo_field}.{group}": {"$each": saved}}}
    )

    return {"ok": True, "count": len(saved), "group": group, "phase": phase, "files": saved}

@app.post("/cmreport/{report_id}/finalize")
async def cmreport_finalize(
    report_id: str,
    station_id: str = Form(...),
    current: UserClaims = Depends(get_current_user),
):
    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")

    coll = get_cmreport_collection_for(station_id)
    from bson import ObjectId
    oid = ObjectId(report_id)
    res = await coll.update_one(
        {"_id": oid},
        {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}

@app.post("/cmurl/upload-files", status_code=201)
async def cmurl_upload_files(
    station_id: str = Form(...),
    reportDate: str = Form(...),                 # "YYYY-MM-DD" หรือ ISO
    files: list[UploadFile] = File(...),
    status: str = Form(...),  
    current: UserClaims = Depends(get_current_user),
):
    # auth
    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")

    # ตรวจ/เตรียมคอลเลกชัน
    coll = get_cmurl_coll_upload(station_id)

    # parse วันที่เป็น UTC datetime (มีฟังก์ชันอยู่แล้ว)
    cm_date = normalize_pm_date(reportDate)

    # สร้าง issue_id และ doc_name อัตโนมัติ
    issue_id = await get_next_cm_issue_id(station_id, cm_date)
    doc_name = await get_next_cm_doc_name(station_id, cm_date)

    # โฟลเดอร์ปลายทาง: /uploads/cmurl/<station_id>/<YYYY-MM-DD>/
    subdir = cm_date
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "cmurl" / station_id / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)

    urls = []
    metas = []
    total_size = 0

    for f in files:
        ext = (f.filename.rsplit(".",1)[-1].lower() if "." in f.filename else "")
        if ext not in ALLOWED_EXTS or ext != "pdf":
            raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

        data = await f.read()
        total_size += len(data)
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        safe = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
        dest = dest_dir / safe
        with open(dest, "wb") as out:
            out.write(data)

        url = f"/uploads/cmurl/{station_id}/{subdir}/{safe}"
        urls.append(url)
        metas.append({"name": f.filename, "size": len(data)})

    now = datetime.now(timezone.utc)

    doc = {
        "station": station_id,
        "doc_name": doc_name,           # เพิ่ม
        "issue_id": issue_id,           # เพิ่ม
        "cm_date": cm_date,
        "status": (status or "").strip(), 
        "urls": urls,
        "meta": {"files": metas},
        "source": "upload-files",
        "createdAt": now,
        "updatedAt": now,
    }
    res = await coll.insert_one(doc)

    return {
        "ok": True, 
        "inserted_id": str(res.inserted_id), 
        "doc_name": doc_name,
        "issue_id": issue_id,
        "count": len(urls), 
        "urls": urls
    }

@app.get("/cmurl/list")
async def cmurl_list(
    station_id: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
):
    coll = get_cmurl_coll_upload(station_id)
    skip = (page - 1) * pageSize

    # สร้าง filter ตามสถานะ
    mongo_filter: dict = {}
    if status:
        want = (status or "").strip()
        mongo_filter["$or"] = [
            {"status": {"$regex": f"^{re.escape(want)}$", "$options": "i"}},
            {"job.status": {"$regex": f"^{re.escape(want)}$", "$options": "i"}},
        ]

    projection = {
        "_id": 1, 
        "doc_name": 1,      # เพิ่ม
        "issue_id": 1,      # เพิ่ม
        "cm_date": 1, 
        "reportDate": 1,
        "urls": 1, 
        "createdAt": 1,
        "status": 1, 
        "job": 1,
        "inspector": 1,     # เพิ่ม
    }

    cursor = (
        coll.find(mongo_filter, projection)
            .sort([("createdAt", -1), ("_id", -1)])
            .skip(skip)
            .limit(pageSize)
    )

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents(mongo_filter)

    def _cm_date_from(doc: dict) -> str | None:
        s = doc.get("cm_date")
        if isinstance(s, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
            return s
        rd = doc.get("reportDate")
        if isinstance(rd, datetime):
            return rd.astimezone(th_tz).date().isoformat()
        if isinstance(rd, str):
            try:
                dt = datetime.fromisoformat(rd.replace("Z", "+00:00"))
            except Exception:
                try:
                    dt = datetime.fromisoformat(rd).replace(tzinfo=th_tz)
                except Exception:
                    return None
            return dt.astimezone(th_tz).date().isoformat()
        return None

    items = []

    for it in items_raw:
        cm_date_str = _cm_date_from(it)
        urls = it.get("urls") or []
        first_url = urls[0] if urls else ""

        items.append({
            "id": str(it["_id"]),
            "doc_name": it.get("doc_name") or "",
            "issue_id": it.get("issue_id") or "",
            "cm_date": cm_date_str,
            "inspector": it.get("inspector") or "",
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "status": (it.get("status") or (it.get("job") or {}).get("status") or ""),
            "file_url": first_url,
            "urls": urls,
        })

    return {
        "items": items,
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }


class CMSubmitIn(BaseModel):
    station_id: str
    found_date: Optional[str] = None
    faulty_equipment: str = ""
    severity: str = ""
    problem_details: str = ""
    remarks_open: str = ""          # เปลี่ยนจาก remarks เป็น remarks_open
    location: str = ""
    reported_by: Optional[str] = None


async def _ensure_cm_indexes(coll):
    try:
        await coll.create_index([("createdAt", -1), ("_id", -1)])
        await coll.create_index("issue_id", sparse=True)
        await coll.create_index("doc_name", sparse=True)
    except Exception:
        pass

@app.post("/cmreport/submit")
async def cmreport_submit(body: CMSubmitIn, current: UserClaims = Depends(get_current_user)):
    station_id = body.station_id.strip()
    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")

    coll = get_cmreport_collection_for(station_id)
    await _ensure_cm_indexes(coll)

    # กำหนด found_date
    if body.found_date:
        found_date = normalize_pm_date(body.found_date)
    else:
        found_date = datetime.now(th_tz).date().isoformat()

    # สร้าง issue_id และ doc_name อัตโนมัติ
    issue_id = await get_next_cm_issue_id(station_id, found_date)
    doc_name = await get_next_cm_doc_name(station_id, found_date)

    doc = {
        "station_id": station_id,
        "doc_name": doc_name,
        "issue_id": issue_id,
        "found_date": found_date,
        "location": body.location,
        "reported_by": body.reported_by or current.username,
        # flat fields
        "faulty_equipment": body.faulty_equipment,
        "severity": body.severity,
        "problem_details": body.problem_details,
        "remarks_open": body.remarks_open,      # เปลี่ยนจาก remarks เป็น remarks_open
        "status": "Open",
        "photos_problem": {},
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
        
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id),
        "doc_name": doc_name,
        "issue_id": issue_id,
    }



@app.get("/cmreport/{report_id}")
async def cmreport_detail_path(
    report_id: str,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    # auth
    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")

    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid, "station_id": station_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    job = doc.get("job", {})
    
    return {
        "id": str(doc["_id"]),
        "station_id": doc.get("station_id"),
        "doc_name": doc.get("doc_name") or "",
        "issue_id": doc.get("issue_id") or job.get("issue_id") or "",
        "found_date": doc.get("found_date"),
        "cm_date": doc.get("cm_date") or doc.get("found_date") or "",
        "reported_by": doc.get("reported_by") or job.get("reported_by") or "",
        "status": doc.get("status") or job.get("status") or "",
        
        # flat fields
        "faulty_equipment": doc.get("faulty_equipment") or job.get("faulty_equipment") or "",
        "severity": doc.get("severity") or job.get("severity") or "",
        "problem_details": doc.get("problem_details") or job.get("problem_details") or "",
        "remarks_open": doc.get("remarks_open") or job.get("remarks") or "",
        "location": doc.get("location") or job.get("location") or "",
        
        # ✅ เพิ่มใหม่ - ข้อมูล In Progress
        "inspector": doc.get("inspector") or "",
        "cause": doc.get("cause") or "",
        "problem_type": doc.get("problem_type") or "",
        "repair_result": doc.get("repair_result") or "",
        "corrective_actions": doc.get("corrective_actions") or [],
        "preventive_action": doc.get("preventive_action") or [],
        "repaired_equipment": doc.get("repaired_equipment") or [],
        "inprogress_remarks": doc.get("inprogress_remarks") or "",
        "resolved_date": doc.get("resolved_date") or "",
        
        "photos_problem": doc.get("photos_problem", {}),
        "photos_repair": doc.get("photos_repair", {}),
        "createdAt": _ensure_utc_iso(doc.get("createdAt")),
        "updatedAt": _ensure_utc_iso(doc.get("updatedAt")),
    }

@app.get("/cmreport/detail")
async def cmreport_detail_query(
    id: str = Query(..., alias="id"),
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    return await cmreport_detail_path(id, station_id, current)

class CMStatusUpdateIn(BaseModel):
    station_id: str
    status: Literal["Open", "In Progress", "Closed"]
    job: Optional[Dict[str, Any]] = None
    summary: Optional[str] = None
    cm_date: Optional[str] = None
    inspector: Optional[str] = None

ALLOWED_STATUS: set[str] = {"Open", "In Progress", "Closed"}

@app.patch("/cmreport/{report_id}/status")
async def cmreport_update_status(
    report_id: str,
    body: CMStatusUpdateIn,
    current: UserClaims = Depends(get_current_user),
):
    station_id = body.station_id.strip()
    if body.status not in ALLOWED_STATUS:
        raise HTTPException(status_code=400, detail="Invalid status")

    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")

    coll = get_cmreport_collection_for(station_id)
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    updates: Dict[str, Any] = {
        "status": body.status,
    }

    # ✅ เพิ่ม: บันทึก inspector
    if body.inspector:
        updates["inspector"] = body.inspector

    if body.job is not None:
        # ✅ แก้ไข: เพิ่ม "cause"
        allowed_job_keys = {
            "issue_id", "found_date", "location", "wo", "sn",
            "equipment_list", "problem_details", "problem_type", "severity",
            "reported_by", "assignee", "initial_cause", "corrective_actions",
            "resolved_date", "repair_result", "preventive_action", 
            "remarks", "remarks_open",
            "faulty_equipment",
            "repaired_equipment",
            "inprogress_remarks",
            "cause",  # ✅ เพิ่มใหม่
        }
        
        if "status" in body.job:
            js = body.job["status"]
            if js not in ALLOWED_STATUS:
                raise HTTPException(status_code=400, detail="Invalid job.status")
            updates["status"] = js

        for k, v in body.job.items():
            if k in allowed_job_keys:
                updates[k] = v  # บันทึกเป็น flat field แทน job.xxx

        if "found_date" in body.job and body.job.get("found_date"):
            try:
                updates.setdefault("cm_date", normalize_pm_date(body.job["found_date"]))
            except Exception:
                pass

    updates["updatedAt"] = datetime.now(timezone.utc)

    res = await coll.update_one({"_id": oid, "station_id": station_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")

    return {"ok": True, "status": updates["status"]}

#---------------------------------------------------------------------- Test Report (DC)
def get_dc_testreport_collection_for(sn: str):
    _validate_station_id(sn)
    coll = DCTestReportDB.get_collection(str(sn))
    return coll

def get_dcurl_coll_upload(sn: str):
    _validate_station_id(sn)
    coll = DCUrlDB.get_collection(str(sn))
    return coll

@app.get("/dctestreport/list")
async def dctestreport_list(
    sn: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    coll = get_dc_testreport_collection_for(sn)
    skip = (page - 1) * pageSize

    # ★★★ เพิ่ม issue_id และ document_name ใน projection ★★★
    cursor = coll.find({}, {
        "_id": 1, 
        "inspection_date": 1, 
        "createdAt": 1,
        "issue_id": 1,           # ★ เพิ่ม
        "document_name": 1,      # ★ เพิ่ม
        "head": 1,               # ★ เพิ่ม (เผื่อ issue_id อยู่ใน head)
    }).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)
    
    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    # --- ดึงไฟล์จาก PMReportURL โดย map ด้วย pm_date (string) ---
    dc_dates = [it.get("inspection_date") for it in items_raw if it.get("inspection_date")]
    urls_coll = get_dcurl_coll_upload(sn)
    url_by_day: dict[str, str] = {}

    if dc_dates:
        ucur = urls_coll.find({"inspection_date": {"$in": dc_dates}}, {"inspection_date": 1, "urls": 1})
        url_docs = await ucur.to_list(length=10_000)
        for u in url_docs:
            day = u.get("inspection_date")
            first_url = (u.get("urls") or [None])[0]
            if day and first_url and day not in url_by_day:
                url_by_day[day] = first_url

    # ★★★ เพิ่ม issue_id และ document_name ใน response ★★★
    items = [{
        "id": str(it["_id"]),
        "inspection_date": it.get("inspection_date"),
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("inspection_date") or "", ""),
        "issue_id": it.get("issue_id") or it.get("head", {}).get("issue_id") or "",      # ★ เพิ่ม
        "document_name": it.get("document_name") or it.get("issue_id") or "",            # ★ เพิ่ม
        "inspector": it.get("head", {}).get("inspector") or "", 
    } for it in items_raw]

    dc_date_arr = [it.get("inspection_date") for it in items_raw if it.get("inspection_date")]
    return {"items": items, "inspection_date": dc_date_arr, "page": page, "pageSize": pageSize, "total": total}

# ตำแหน่งโฟลเดอร์บนเครื่องเซิร์ฟเวอร์
UPLOADS_ROOT = os.getenv("UPLOADS_ROOT", "./uploads")
os.makedirs(UPLOADS_ROOT, exist_ok=True)

# เสิร์ฟไฟล์คืนให้ Frontend ผ่าน /uploads/...
app.mount("/uploads", StaticFiles(directory=UPLOADS_ROOT, html=False), name="uploads")

# ALLOWED_EXTS = {"jpg","jpeg","png","webp","gif"}
# MAX_FILE_MB = 10

def _safe_name(name: str) -> str:
    # กัน path traversal และอักขระแปลก ๆ
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return base[:120] or secrets.token_hex(4)

def _ext(fname: str) -> str:
    return (fname.rsplit(".",1)[-1].lower() if "." in fname else "")

# ---- config ไฟล์/อัปโหลด (ถ้ายังไม่มีให้วางไว้ด้านบน) ----
ALLOWED_IMAGE_EXTS = {"jpg", "jpeg", "png", "webp", "gif"}
MAX_IMAGE_FILE_MB = 10

PHOTO_GROUP_KEYS = [
    "nameplate",       # index 0
    "charger",         # index 1
    "testingEquipment", # index 2
    "testingEquipmentNameplate",             # index 3
    "gun1",            # index 4
    "gun2",            # index 5
]

def _key_for_index(i: int) -> str:
    return PHOTO_GROUP_KEYS[i] if 0 <= i < len(PHOTO_GROUP_KEYS) else f"extra{i-5}"

@app.post("/dctestreport/{report_id}/photos")
async def dc_testreport_upload_photos(
    report_id: str,
    sn: str = Form(...),
    item_index: int = Form(...),               # <<-- เปลี่ยนจาก group → index
    files: list[UploadFile] = File(...),
    remark: str | None = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    # auth
    # if current.role != "admin" and sn not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden sn")

    # รายงานต้องอยู่ในสถานีนี้
    coll = get_dc_testreport_collection_for(sn)
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    # doc = await coll.find_one({"_id": oid}, {"_id": 1, "sn": 1})
    doc = await coll.find_one({"_id": oid}, {"_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    # if doc.get("sn") != sn:
    #     raise HTTPException(status_code=400, detail="sn mismatch")

    # แปลง index → ชื่อคีย์โฟลเดอร์/คีย์ในเอกสาร
    key = _key_for_index(item_index)  # e.g. nameplate/charger/.../extra1

    # โฟลเดอร์ปลายทาง
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "dctest" / sn / report_id / key
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1].lower() if "." in (f.filename or "") else "")
        if ext not in ALLOWED_IMAGE_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_IMAGE_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_IMAGE_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/dctest/{sn}/{report_id}/{key}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc),
            "index": item_index,          # เก็บ index เผื่ออ้างอิงกลับ
        })

    # อัปเดตเอกสารรายงาน: push ลง photos.<key>
    await coll.update_one(
        {"_id": oid},
        {"$push": {f"photos.{key}": {"$each": saved}}, "$set": {"updatedAt": datetime.now(timezone.utc)}}
    )

    return {"ok": True, "count": len(saved), "key": key, "files": saved}

@app.post("/dctestreport/{report_id}/finalize")
async def dc_testreport_finalize(
    report_id: str,
    sn: str = Form(...),
    current: UserClaims = Depends(get_current_user),
):
    # if current.role != "admin" and sn not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden sn")

    coll = get_dc_testreport_collection_for(sn)
    from bson import ObjectId
    oid = ObjectId(report_id)
    res = await coll.update_one(
        {"_id": oid},
        {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}

@app.post("/dcurl/upload-files", status_code=201)
async def dcurl_upload_files(
    sn: str = Form(...),
    reportDate: str = Form(...),                 # "YYYY-MM-DD" หรือ ISO
    files: list[UploadFile] = File(...),
    current: UserClaims = Depends(get_current_user),
):
    # auth
    # if current.role != "admin" and sn not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden sn")

    # ตรวจ/เตรียมคอลเลกชัน
    coll = get_dcurl_coll_upload(sn)

    # parse วันที่เป็น UTC datetime (มีฟังก์ชันอยู่แล้ว)
    dc_date = normalize_pm_date(reportDate)

    # โฟลเดอร์ปลายทาง: /uploads/pmurl/<sn>/<YYYY-MM-DD>/
    # subdir = report_dt_utc.astimezone(th_tz).date().isoformat()
    subdir = dc_date
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "dcurl" / sn / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)

    urls = []
    metas = []
    total_size = 0

    for f in files:
        ext = (f.filename.rsplit(".",1)[-1].lower() if "." in f.filename else "")
        if ext not in ALLOWED_EXTS or ext != "pdf":
            raise HTTPException(status_code=400, detail=f"Only PDF allowed, got: {ext}")

        data = await f.read()
        total_size += len(data)
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_FILE_MB} MB)")

        safe = _safe_name(f.filename or f"file_{secrets.token_hex(3)}.pdf")
        dest = dest_dir / safe
        with open(dest, "wb") as out:
            out.write(data)

        url = f"/uploads/dcurl/{sn}/{subdir}/{safe}"   # ← จะเสิร์ฟได้จาก StaticFiles ที่ mount ไว้แล้ว
        urls.append(url)
        metas.append({"name": f.filename, "size": len(data)})

    now = datetime.now(timezone.utc)
    doc = {
        "station": sn,
        "dc_date": dc_date,   
        "urls": urls,
        "meta": {"files": metas},
        "source": "upload-files",
        "createdAt": now,
        "updatedAt": now,
    }
    res = await coll.insert_one(doc)

    return {"ok": True, "inserted_id": str(res.inserted_id), "count": len(urls), "urls": urls}

@app.get("/dcurl/list")
async def dcurl_list(
    sn: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    """
    ดึงรายการไฟล์ PM (PDF) ที่อัปโหลดไว้ต่อสถานี จาก PMUrlDB/<sn>
    - รองรับทั้งเอกสารที่เก็บ pm_date (string 'YYYY-MM-DD') และ reportDate (Date/ISO)
    - เรียงจากใหม่ไปเก่า (createdAt desc, _id desc)
    - รูปแบบผลลัพธ์ให้เหมือน /pmreport/list (มี file_url สำหรับลิงก์ตัวแรก)
    """
    coll = get_dcurl_coll_upload(sn)
    skip = (page - 1) * pageSize

    # ดึงเฉพาะฟิลด์ที่จำเป็น
    cursor = coll.find(
        {},
        {"_id": 1, "dc_date": 1, "reportDate": 1, "urls": 1, "createdAt": 1}
    ).sort([("createdAt", -1), ("_id", -1)]).skip(skip).limit(pageSize)

    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    def _dc_date_from(doc: dict) -> str | None:
        """
        แปลงวันที่ในเอกสารให้ได้ string 'YYYY-MM-DD'
        - ถ้ามี pm_date (string) → คืนค่านั้น
        - ถ้ามี reportDate (datetime/string) → แปลงเป็นวันไทย แล้ว .date().isoformat()
        """
        # รุ่นใหม่: เก็บเป็น pm_date (string)
        s = doc.get("dc_date")
        if isinstance(s, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}$", s):
            return s

        # รุ่นเก่า: เก็บเป็น reportDate (Date/ISO)
        rd = doc.get("reportDate")
        if isinstance(rd, datetime):
            return rd.astimezone(th_tz).date().isoformat()
        if isinstance(rd, str):
            try:
                dt = datetime.fromisoformat(rd.replace("Z", "+00:00"))
            except Exception:
                # เผื่อไม่มีโซนเวลา → ถือเป็นเวลาไทย
                try:
                    dt = datetime.fromisoformat(rd).replace(tzinfo=th_tz)
                except Exception:
                    return None
            return dt.astimezone(th_tz).date().isoformat()

        return None

    items = []
    dc_date_arr = []

    for it in items_raw:
        dc_date_str = _dc_date_from(it)
        if dc_date_str:
            dc_date_arr.append(dc_date_str)

        urls = it.get("urls") or []
        first_url = urls[0] if urls else ""

        items.append({
            "id": str(it["_id"]),
            "dc_date": dc_date_str,                         # 'YYYY-MM-DD' | None
            "createdAt": _ensure_utc_iso(it.get("createdAt")),
            "file_url": first_url,                          # ไฟล์แรก (ไว้ให้ปุ่มดาวน์โหลด)
            "urls": urls,                                   # เผื่อฟรอนต์อยากแสดงทั้งหมด
        })

    return {
        "items": items,
        "dc_date": [d for d in dc_date_arr if d],          # ให้เหมือน /pmreport/list
        "page": page,
        "pageSize": pageSize,
        "total": total,
    }

class EquipmentBlock(BaseModel):
    manufacturers: List[str] = []
    models: List[str] = []
    serialNumbers: List[str] = []

SymbolLiteral = Literal["", "pass", "notPass", "notTest"]
PhaseLiteral  = Literal["", "L1L2L3", "L3L2L1"]

class PersonSig(BaseModel):
    name: str = ""
    signature: str = ""   # เก็บ path/ข้อมูลลายเซ็น (หรือข้อความ)
    date: str = ""        # "YYYY-MM-DD"
    company: str = ""

class ResponsibilityBlock(BaseModel):
    performed: PersonSig = PersonSig()
    approved:  PersonSig = PersonSig()
    witnessed: PersonSig = PersonSig()

class SignatureBlock(BaseModel):
    responsibility: ResponsibilityBlock = ResponsibilityBlock()

# ===== เพิ่ม config สำหรับไฟล์เอกสาร =====
ALLOWED_DOC_EXTS = {"pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"}
MAX_DOC_FILE_MB = 20

# ===== เพิ่ม endpoint ใหม่สำหรับ upload ไฟล์ในการทดสอบ =====
@app.post("/dctestreport/{report_id}/test-files")
async def dc_testreport_upload_test_files(
    report_id: str,
    sn: str = Form(...),
    test_type: str = Form(...),          # "electrical" หรือ "charger"
    item_index: int = Form(...),         # index ของหัวข้อทดสอบ
    round_index: int = Form(...),        # รอบที่ (0, 1, 2)
    handgun: str = Form(...),            # "h1" หรือ "h2"
    file: UploadFile = File(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    อัปโหลดไฟล์เอกสารสำหรับการทดสอบ
    - test_type: "electrical" (DCTest1Grid) หรือ "charger" (DCTest2Grid)
    - item_index: index ของหัวข้อทดสอบ (0-10 สำหรับ electrical, 0-6 สำหรับ charger)
    - round_index: รอบที่ทดสอบ (0, 1, 2)
    - handgun: "h1" หรือ "h2"
    """
    # Auth
    # if current.role != "admin" and sn not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden sn")

    # Validate handgun
    if handgun not in ("h1", "h2"):
        raise HTTPException(status_code=400, detail="handgun must be 'h1' or 'h2'")
    
    # Validate test_type
    if test_type not in ("electrical", "charger"):
        raise HTTPException(status_code=400, detail="test_type must be 'electrical' or 'charger'")

    # Get report
    coll = get_dc_testreport_collection_for(sn)
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    # Validate file extension
    ext = (file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "")
    if ext not in ALLOWED_DOC_EXTS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

    # Read and validate size
    data = await file.read()
    if len(data) > MAX_DOC_FILE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large (> {MAX_DOC_FILE_MB} MB)")

    # Create destination directory
    # Structure: /uploads/dctest/{sn}/{report_id}/test_files/{test_type}/{item_index}/{round_index}/{handgun}/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "dctest" / sn / report_id / "test_files" / test_type / str(item_index) / str(round_index) / handgun
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Save file
    fname = _safe_name(file.filename or f"file_{secrets.token_hex(3)}.{ext}")
    path = dest_dir / fname
    with open(path, "wb") as out:
        out.write(data)

    url_path = f"/uploads/dctest/{sn}/{report_id}/test_files/{test_type}/{item_index}/{round_index}/{handgun}/{fname}"
    
    file_data = {
        "filename": fname,
        "originalName": file.filename,
        "size": len(data),
        "url": url_path,
        "ext": ext,
        "uploadedAt": datetime.now(timezone.utc),
    }

    # Update document: store in test_files.{test_type}.{item_index}.{round_index}.{handgun}
    field_path = f"test_files.{test_type}.{item_index}.{round_index}.{handgun}"
    await coll.update_one(
        {"_id": oid},
        {
            "$set": {
                field_path: file_data,
                "updatedAt": datetime.now(timezone.utc)
            }
        }
    )

    return {
        "ok": True,
        "file": file_data,
        "test_type": test_type,
        "item_index": item_index,
        "round_index": round_index,
        "handgun": handgun,
    }


@app.delete("/dctestreport/{report_id}/test-files")
async def dc_testreport_delete_test_file(
    report_id: str,
    sn: str = Query(...),
    test_type: str = Query(...),
    item_index: int = Query(...),
    round_index: int = Query(...),
    handgun: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ลบไฟล์เอกสารสำหรับการทดสอบ
    """
    # Auth
    # if current.role != "admin" and sn not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden sn")

    # Validate
    if handgun not in ("h1", "h2"):
        raise HTTPException(status_code=400, detail="handgun must be 'h1' or 'h2'")
    
    if test_type not in ("electrical", "charger"):
        raise HTTPException(status_code=400, detail="test_type must be 'electrical' or 'charger'")

    # Get report
    coll = get_dc_testreport_collection_for(sn)
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    # Get current file info to delete from disk
    doc = await coll.find_one({"_id": oid}, {f"test_files.{test_type}.{item_index}.{round_index}.{handgun}": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    # Try to delete file from disk
    try:
        file_info = doc.get("test_files", {}).get(test_type, {}).get(str(item_index), {}).get(str(round_index), {}).get(handgun)
        if file_info and file_info.get("url"):
            file_path = pathlib.Path(UPLOADS_ROOT) / file_info["url"].lstrip("/uploads/")
            if file_path.exists():
                file_path.unlink()
    except Exception as e:
        print(f"Warning: Could not delete file from disk: {e}")

    # Remove from document
    field_path = f"test_files.{test_type}.{item_index}.{round_index}.{handgun}"
    await coll.update_one(
        {"_id": oid},
        {
            "$unset": {field_path: ""},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )

    return {"ok": True}

class DCSubmitIn(BaseModel):
    sn: str
    chargerNo: Optional[str] = None
    document_name: Optional[str] = None
    issue_id: Optional[str] = None 
    job: Dict[str, Any]          # โครงสร้างตามฟอร์ม (issue_id, found_date, ... )
    head: Dict[str,Any]
    inspection_date: Optional[str] = None  # "YYYY-MM-DD" หรือ ISO; ถ้าไม่ส่งมาจะ fallback เป็น job.found_date
    equipment: Optional[EquipmentBlock] = None
    electrical_safety: Dict[str, Any] = Field(default_factory=dict)
    charger_safety: Dict[str, Any] = Field(default_factory=dict)
    remarks: Dict[str, Any] = Field(default_factory=dict)
    phaseSequence: Optional[str] = None 
    test_files: Optional[Dict[str, Any]] = None
    # signature: Optional[SignatureBlock] = None 

async def _ensure_dc_indexes(coll):
    try:
        await coll.create_index([("createdAt", -1), ("_id", -1)])
        # ถ้าอยากกันซ้ำเลขใบงานในแต่ละสถานี: เปิด unique issue_id ก็ได้ (ถ้าแน่ใจว่า unique)
        # await coll.create_index("issue_id", unique=True, sparse=True)
    except Exception:
        pass

def _normalize_tick_to_pass(obj):
    if isinstance(obj, dict):
        return {k: _normalize_tick_to_pass(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_normalize_tick_to_pass(v) for v in obj]
    if isinstance(obj, str):
        return "pass" if obj == "✓" else obj
    return obj

async def _next_dc_issue_id(db, sn: str, chargerNo: str, d: date, pad: int = 2) -> str:
    """Generate next DC issue_id using atomic sequence"""
    yymm = f"{d.year % 100:02d}{d.month:02d}"
    seq = await db.dc_sequences.find_one_and_update(
        {"sn": sn, "chargerNo": chargerNo, "yymm": yymm},  # ★ เพิ่ม chargerNo
        {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"DC-CG{chargerNo}-{yymm}-{int(seq['n']):0{pad}d}"  # ★ ใช้ chargerNo


async def _next_dc_year_seq(db, sn: str, chargerNo: str, d: date) -> int:
    """Generate next DC year sequence for doc_name"""
    year = d.year
    seq = await db.dc_year_sequences.find_one_and_update(
        {"sn": sn, "chargerNo": chargerNo, "year": year},  # ★ เพิ่ม chargerNo
        {"$inc": {"n": 1}, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return int(seq["n"])

@app.get("/dcreport/next-ids")
async def dcreport_next_ids(
    sn: str = Query(...),
    chargerNo: str = Query(...),
    inspection_date: str = Query(None),
):
    _validate_station_id(sn)
    
    if not chargerNo:
        raise HTTPException(status_code=400, detail="chargerNo is required")
    
    coll = get_dc_testreport_collection_for(sn)
    
    # กำหนด date
    if inspection_date:
        dc_date = normalize_pm_date(inspection_date)
    else:
        dc_date = datetime.now(th_tz).date().isoformat()
    
    try:
        d = datetime.strptime(dc_date, "%Y-%m-%d").date()
    except ValueError:
        d = datetime.now(th_tz).date()
    
    yymm = f"{d.year % 100:02d}{d.month:02d}"
    year = d.year
    
    # ★★★ FIXED: นับจาก documents จริงใน collection ★★★
    
    # 1. หา issue_id ล่าสุดที่มีอยู่จริง
    prefix_pattern = f"^DC-CG{chargerNo}-{yymm}-"
    existing_issues = await coll.find(
        {"issue_id": {"$regex": prefix_pattern}},
        {"issue_id": 1}
    ).to_list(length=1000)
    
    # หาเลขสูงสุด
    max_issue_seq = 0
    for doc in existing_issues:
        match = re.match(rf"^DC-CG{chargerNo}-{yymm}-(\d+)$", doc.get("issue_id", ""))
        if match:
            max_issue_seq = max(max_issue_seq, int(match.group(1)))
    
    next_issue_seq = max_issue_seq + 1
    preview_issue_id = f"DC-CG{chargerNo}-{yymm}-{next_issue_seq:02d}"
    
    # 2. หา document_name ล่าสุดที่มีอยู่จริง
    doc_prefix_pattern = f"^DC-CG{chargerNo}-\\d+/{year}$"
    existing_docs = await coll.find(
        {"document_name": {"$regex": doc_prefix_pattern}},
        {"document_name": 1}
    ).to_list(length=1000)
    
    # หาเลขสูงสุด
    max_doc_seq = 0
    for doc in existing_docs:
        match = re.match(rf"^DC-CG{chargerNo}-(\d+)/{year}$", doc.get("document_name", ""))
        if match:
            max_doc_seq = max(max_doc_seq, int(match.group(1)))
    
    next_doc_seq = max_doc_seq + 1
    preview_doc_name = f"DC-CG{chargerNo}-{next_doc_seq:02d}/{year}"
    
    return {
        "issue_id": preview_issue_id,
        "document_name": preview_doc_name,
        "inspection_date": dc_date,
        "is_preview": True,
    }

@app.post("/dcreport/submit")
async def dcreport_submit(body: DCSubmitIn, current: UserClaims = Depends(get_current_user)):
    sn = body.sn.strip()
    chargerNo = (body.chargerNo or "").strip()
    
    if not chargerNo:
        raise HTTPException(status_code=400, detail="chargerNo is required")

    coll = get_dc_testreport_collection_for(sn)
    await _ensure_dc_indexes(coll)

    # กำหนด dc_date
    dc_date_src = body.inspection_date or body.head.get("inspection_date")
    if dc_date_src:
        dc_date = normalize_pm_date(dc_date_src)
    else:
        dc_date = datetime.now(th_tz).date().isoformat()

    try:
        d = datetime.strptime(dc_date, "%Y-%m-%d").date()
    except ValueError:
        d = datetime.now(th_tz).date()

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    year = d.year

    # ★★★ FIXED: นับจาก documents จริงใน collection ★★★
    
    # 1. หา issue_id ถัดไปจาก documents จริง
    prefix_pattern = f"^DC-CG{chargerNo}-{yymm}-"
    existing_issues = await coll.find(
        {"issue_id": {"$regex": prefix_pattern}},
        {"issue_id": 1}
    ).to_list(length=1000)
    
    max_issue_seq = 0
    for doc in existing_issues:
        match = re.match(rf"^DC-CG{chargerNo}-{yymm}-(\d+)$", doc.get("issue_id", ""))
        if match:
            max_issue_seq = max(max_issue_seq, int(match.group(1)))
    
    issue_id = f"DC-CG{chargerNo}-{yymm}-{max_issue_seq + 1:02d}"
    
    # 2. หา document_name ถัดไปจาก documents จริง
    doc_prefix_pattern = f"^DC-CG{chargerNo}-\\d+/{year}$"
    existing_docs = await coll.find(
        {"document_name": {"$regex": doc_prefix_pattern}},
        {"document_name": 1}
    ).to_list(length=1000)
    
    max_doc_seq = 0
    for doc in existing_docs:
        match = re.match(rf"^DC-CG{chargerNo}-(\d+)/{year}$", doc.get("document_name", ""))
        if match:
            max_doc_seq = max(max_doc_seq, int(match.group(1)))
    
    doc_name = f"DC-CG{chargerNo}-{max_doc_seq + 1:02d}/{year}"

    # ★★★ ตรวจสอบซ้ำอีกครั้ง (race condition protection) ★★★
    exists = await coll.find_one({"$or": [{"issue_id": issue_id}, {"document_name": doc_name}]})
    if exists:
        raise HTTPException(status_code=409, detail="Duplicate issue_id or document_name, please retry")

    # Normalize tick symbols
    electrical_safety = _normalize_tick_to_pass(body.electrical_safety or {})
    charger_safety = _normalize_tick_to_pass(body.charger_safety or {})
    
    doc = {
        "sn": sn,
        "chargerNo": chargerNo,
        "document_name": doc_name,
        "issue_id": issue_id,
        "inspector": (body.head or {}).get("inspector") or "",
        "inspection_date": dc_date,
        "head": body.head,
        "equipment": body.equipment.dict() if body.equipment else {"manufacturers": [], "models": [], "serialNumbers": []},
        "electrical_safety": electrical_safety,
        "charger_safety": charger_safety,
        "remarks": body.remarks or {},
        "phaseSequence": body.phaseSequence,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
        "photos": {},
        "test_files": body.test_files or {},
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id), 
        "issue_id": issue_id,
        "document_name": doc_name
    }

#---------------------------------------------------------------------- Test Report (AC)
def get_ac_testreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    coll = ACTestReportDB.get_collection(str(station_id))
    return coll

def get_acurl_coll_upload(station_id: str):
    _validate_station_id(station_id)
    coll = ACUrlDB.get_collection(str(station_id))
    return coll

@app.get("/actestreport/list")
async def actestreport_list(
    sn: str = Query(...),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    coll = get_ac_testreport_collection_for(sn)
    skip = (page - 1) * pageSize

    # ★★★ เพิ่ม issue_id และ document_name ใน projection ★★★
    cursor = coll.find({}, {
        "_id": 1, 
        "inspection_date": 1, 
        "createdAt": 1,
        "issue_id": 1,           # ★ เพิ่ม
        "document_name": 1,      # ★ เพิ่ม
        "head": 1,               # ★ เพิ่ม
    }).sort(
        [("createdAt", -1), ("_id", -1)]
    ).skip(skip).limit(pageSize)
    
    items_raw = await cursor.to_list(length=pageSize)
    total = await coll.count_documents({})

    # --- ดึงไฟล์จาก ACUrlDB โดย map ด้วย inspection_date (string) ---
    ac_dates = [it.get("inspection_date") for it in items_raw if it.get("inspection_date")]
    urls_coll = get_acurl_coll_upload(sn)
    url_by_day: dict[str, str] = {}

    if ac_dates:
        ucur = urls_coll.find({"inspection_date": {"$in": ac_dates}}, {"inspection_date": 1, "urls": 1})
        url_docs = await ucur.to_list(length=10_000)
        for u in url_docs:
            day = u.get("inspection_date")
            first_url = (u.get("urls") or [None])[0]
            if day and first_url and day not in url_by_day:
                url_by_day[day] = first_url

    # ★★★ เพิ่ม issue_id และ document_name ใน response ★★★
    items = [{
        "id": str(it["_id"]),
        "inspection_date": it.get("inspection_date"),
        "createdAt": _ensure_utc_iso(it.get("createdAt")),
        "file_url": url_by_day.get(it.get("inspection_date") or "", ""),
        "issue_id": it.get("issue_id") or it.get("head", {}).get("issue_id") or "",      # ★ เพิ่ม
        "document_name": it.get("document_name") or it.get("issue_id") or "",            # ★ เพิ่ม
        "inspector": it.get("head", {}).get("inspector") or "", 
    } for it in items_raw]

    ac_date_arr = [it.get("inspection_date") for it in items_raw if it.get("inspection_date")]
    return {"items": items, "inspection_date": ac_date_arr, "page": page, "pageSize": pageSize, "total": total}


# ★★★ เพิ่ม endpoint /acreport/next-ids ★★★
@app.get("/acreport/next-ids")
async def acreport_next_ids(
    sn: str = Query(...),  
    chargerNo: str = Query(...),
    inspection_date: str = Query(None),
):
    _validate_station_id(sn)
    
    if not chargerNo:
        raise HTTPException(status_code=400, detail="chargerNo is required")
    
    coll = get_ac_testreport_collection_for(sn)
    
    # กำหนด date
    if inspection_date:
        ac_date = normalize_pm_date(inspection_date)
    else:
        ac_date = datetime.now(th_tz).date().isoformat()
    
    try:
        d = datetime.strptime(ac_date, "%Y-%m-%d").date()
    except ValueError:
        d = datetime.now(th_tz).date()
    
    yymm = f"{d.year % 100:02d}{d.month:02d}"
    year = d.year
    
    # ★★★ นับจาก documents จริงใน collection ★★★
    
    # 1. หา issue_id ล่าสุดที่มีอยู่จริง
    prefix_pattern = f"^AC-CG{chargerNo}-{yymm}-"
    existing_issues = await coll.find(
        {"issue_id": {"$regex": prefix_pattern}},
        {"issue_id": 1}
    ).to_list(length=1000)
    
    # หาเลขสูงสุด
    max_issue_seq = 0
    for doc in existing_issues:
        match = re.match(rf"^AC-CG{chargerNo}-{yymm}-(\d+)$", doc.get("issue_id", ""))
        if match:
            max_issue_seq = max(max_issue_seq, int(match.group(1)))
    
    next_issue_seq = max_issue_seq + 1
    preview_issue_id = f"AC-CG{chargerNo}-{yymm}-{next_issue_seq:02d}"
    
    # 2. หา document_name ล่าสุดที่มีอยู่จริง
    doc_prefix_pattern = f"^AC-CG{chargerNo}-\\d+/{year}$"
    existing_docs = await coll.find(
        {"document_name": {"$regex": doc_prefix_pattern}},
        {"document_name": 1}
    ).to_list(length=1000)
    
    # หาเลขสูงสุด
    max_doc_seq = 0
    for doc in existing_docs:
        match = re.match(rf"^AC-CG{chargerNo}-(\d+)/{year}$", doc.get("document_name", ""))
        if match:
            max_doc_seq = max(max_doc_seq, int(match.group(1)))
    
    next_doc_seq = max_doc_seq + 1
    preview_doc_name = f"AC-CG{chargerNo}-{next_doc_seq:02d}/{year}"
    
    return {
        "issue_id": preview_issue_id,
        "document_name": preview_doc_name,
        "inspection_date": ac_date,
        "is_preview": True,
    }


class ACSubmitIn(BaseModel):
    sn: str
    chargerNo: Optional[str] = None
    document_name: Optional[str] = None
    issue_id: Optional[str] = None 
    head: Dict[str, Any]
    inspection_date: Optional[str] = None
    equipment: Optional[Any] = None  # EquipmentBlock
    electrical_safety: Dict[str, Any] = Field(default_factory=dict)
    charger_safety: Dict[str, Any] = Field(default_factory=dict)
    remarks: Dict[str, Any] = Field(default_factory=dict)
    symbol: Optional[str] = None
    phaseSequence: Optional[str] = None
    signature: Optional[Any] = None  # SignatureBlock
    test_files: Optional[Dict[str, Any]] = None  # ★★★ เพิ่มใหม่ ★★★

@app.post("/actestreport/{report_id}/test-files")
async def ac_testreport_upload_test_files(
    report_id: str,
    sn: str = Form(...),
    test_type: str = Form(...),          # "electrical" หรือ "charger"
    item_index: int = Form(...),         # index ของหัวข้อทดสอบ
    round_index: int = Form(...),        # รอบที่ (0, 1, 2)
    handgun: str = Form(...),            # "h1" (สำหรับ AC ใช้แค่ h1)
    file: UploadFile = File(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    อัปโหลดไฟล์เอกสารสำหรับการทดสอบ AC
    - test_type: "electrical" (ACTest1Grid) หรือ "charger" (ACTest2Grid)
    - item_index: index ของหัวข้อทดสอบ
    - round_index: รอบที่ทดสอบ (0, 1, 2)
    - handgun: "h1" (AC ใช้แค่ h1)
    """
    # Auth
    # if current.role != "admin" and sn not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden sn")

    # Validate handgun (AC ใช้แค่ h1)
    if handgun not in ("h1",):
        raise HTTPException(status_code=400, detail="handgun must be 'h1' for AC")
    
    # Validate test_type
    if test_type not in ("electrical", "charger"):
        raise HTTPException(status_code=400, detail="test_type must be 'electrical' or 'charger'")

    # Get report
    coll = get_ac_testreport_collection_for(sn)
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    # Validate file extension
    ext = (file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "")
    if ext not in ALLOWED_DOC_EXTS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

    # Read and validate size
    data = await file.read()
    if len(data) > MAX_DOC_FILE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large (> {MAX_DOC_FILE_MB} MB)")

    # Create destination directory
    # Structure: /uploads/actest/{sn}/{report_id}/test_files/{test_type}/{item_index}/{round_index}/{handgun}/
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "actest" / sn / report_id / "test_files" / test_type / str(item_index) / str(round_index) / handgun
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Save file
    fname = _safe_name(file.filename or f"file_{secrets.token_hex(3)}.{ext}")
    path = dest_dir / fname
    with open(path, "wb") as out:
        out.write(data)

    url_path = f"/uploads/actest/{sn}/{report_id}/test_files/{test_type}/{item_index}/{round_index}/{handgun}/{fname}"
    
    file_data = {
        "filename": fname,
        "originalName": file.filename,
        "size": len(data),
        "url": url_path,
        "ext": ext,
        "uploadedAt": datetime.now(timezone.utc),
    }

    # Update document: store in test_files.{test_type}.{item_index}.{round_index}.{handgun}
    field_path = f"test_files.{test_type}.{item_index}.{round_index}.{handgun}"
    await coll.update_one(
        {"_id": oid},
        {
            "$set": {
                field_path: file_data,
                "updatedAt": datetime.now(timezone.utc)
            }
        }
    )

    return {
        "ok": True,
        "file": file_data,
        "test_type": test_type,
        "item_index": item_index,
        "round_index": round_index,
        "handgun": handgun,
    }

@app.delete("/actestreport/{report_id}/test-files")
async def ac_testreport_delete_test_file(
    report_id: str,
    sn: str = Query(...),
    test_type: str = Query(...),
    item_index: int = Query(...),
    round_index: int = Query(...),
    handgun: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """
    ลบไฟล์เอกสารสำหรับการทดสอบ AC
    """
    # Auth
    # if current.role != "admin" and sn not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden sn")

    # Validate
    if handgun not in ("h1",):
        raise HTTPException(status_code=400, detail="handgun must be 'h1' for AC")
    
    if test_type not in ("electrical", "charger"):
        raise HTTPException(status_code=400, detail="test_type must be 'electrical' or 'charger'")

    # Get report
    coll = get_ac_testreport_collection_for(sn)
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    # Get current file info to delete from disk
    doc = await coll.find_one({"_id": oid}, {f"test_files.{test_type}.{item_index}.{round_index}.{handgun}": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    # Try to delete file from disk
    try:
        file_info = doc.get("test_files", {}).get(test_type, {}).get(str(item_index), {}).get(str(round_index), {}).get(handgun)
        if file_info and file_info.get("url"):
            file_path = pathlib.Path(UPLOADS_ROOT) / file_info["url"].lstrip("/uploads/")
            if file_path.exists():
                file_path.unlink()
    except Exception as e:
        print(f"Warning: Could not delete file from disk: {e}")

    # Remove from document
    field_path = f"test_files.{test_type}.{item_index}.{round_index}.{handgun}"
    await coll.update_one(
        {"_id": oid},
        {
            "$unset": {field_path: ""},
            "$set": {"updatedAt": datetime.now(timezone.utc)}
        }
    )

    return {"ok": True}


async def _ensure_ac_indexes(coll):
    try:
        await coll.create_index([("createdAt", -1), ("_id", -1)])
    except Exception:
        pass
@app.post("/actestreport/{report_id}/photos")
async def ac_testreport_upload_photos(
    report_id: str,
    sn: str = Form(...),
    item_index: int = Form(...),
    files: list[UploadFile] = File(...),
    remark: str | None = Form(None),
    current: UserClaims = Depends(get_current_user),
):
    # auth
    # if current.role != "admin" and sn not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden sn")

    # รายงานต้องอยู่ในสถานีนี้
    coll = get_ac_testreport_collection_for(sn)
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Bad report_id")

    doc = await coll.find_one({"_id": oid}, {"_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    # แปลง index → ชื่อคีย์โฟลเดอร์/คีย์ในเอกสาร
    key = _key_for_index(item_index)  # e.g. nameplate/charger/.../extra1

    # โฟลเดอร์ปลายทาง (ใช้ actest แทน dctest)
    dest_dir = pathlib.Path(UPLOADS_ROOT) / "actest" / sn / report_id / key
    dest_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1].lower() if "." in (f.filename or "") else "")
        if ext not in ALLOWED_IMAGE_EXTS:
            raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")

        data = await f.read()
        if len(data) > MAX_IMAGE_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File too large (> {MAX_IMAGE_FILE_MB} MB)")

        fname = _safe_name(f.filename or f"image_{secrets.token_hex(3)}.{ext}")
        path = dest_dir / fname
        with open(path, "wb") as out:
            out.write(data)

        url_path = f"/uploads/actest/{sn}/{report_id}/{key}/{fname}"
        saved.append({
            "filename": fname,
            "size": len(data),
            "url": url_path,
            "remark": remark or "",
            "uploadedAt": datetime.now(timezone.utc),
            "index": item_index,
        })

    # อัปเดตเอกสารรายงาน: push ลง photos.<key>
    await coll.update_one(
        {"_id": oid},
        {"$push": {f"photos.{key}": {"$each": saved}}, "$set": {"updatedAt": datetime.now(timezone.utc)}}
    )

    return {"ok": True, "count": len(saved), "key": key, "files": saved}


# ====== (Optional) เพิ่ม finalize endpoint สำหรับ AC ======
@app.post("/actestreport/{report_id}/finalize")
async def ac_testreport_finalize(
    report_id: str,
    sn: str = Form(...),
    current: UserClaims = Depends(get_current_user),
):
    # if current.role != "admin" and sn not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden sn")

    coll = get_ac_testreport_collection_for(sn)
    from bson import ObjectId
    oid = ObjectId(report_id)
    res = await coll.update_one(
        {"_id": oid},
        {"$set": {"status": "submitted", "submittedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"ok": True}

@app.post("/acreport/submit")
async def acreport_submit(body: ACSubmitIn, current: UserClaims = Depends(get_current_user)):
    sn = body.sn.strip()
    chargerNo = (body.chargerNo or "").strip()
    
    if not chargerNo:
        raise HTTPException(status_code=400, detail="chargerNo is required")
    
    # Auth: admin ผ่านหมด, คนทั่วไปต้องมีสิทธิ์ใน station นี้
    # if current.role != "admin" and sn not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")

    coll = get_ac_testreport_collection_for(sn)
    await _ensure_ac_indexes(coll)

    # กำหนด ac_date
    ac_date_src = body.inspection_date or body.head.get("inspection_date")
    if ac_date_src:
        ac_date = normalize_pm_date(ac_date_src)
    else:
        ac_date = datetime.now(th_tz).date().isoformat()

    try:
        d = datetime.strptime(ac_date, "%Y-%m-%d").date()
    except ValueError:
        d = datetime.now(th_tz).date()

    yymm = f"{d.year % 100:02d}{d.month:02d}"
    year = d.year

    # ★★★ Generate issue_id จาก documents จริง ★★★
    prefix_pattern = f"^AC-CG{chargerNo}-{yymm}-"
    existing_issues = await coll.find(
        {"issue_id": {"$regex": prefix_pattern}},
        {"issue_id": 1}
    ).to_list(length=1000)
    
    max_issue_seq = 0
    for doc in existing_issues:
        match = re.match(rf"^AC-CG{chargerNo}-{yymm}-(\d+)$", doc.get("issue_id", ""))
        if match:
            max_issue_seq = max(max_issue_seq, int(match.group(1)))
    
    issue_id = f"AC-CG{chargerNo}-{yymm}-{max_issue_seq + 1:02d}"
    
    # ★★★ Generate document_name จาก documents จริง ★★★
    doc_prefix_pattern = f"^AC-CG{chargerNo}-\\d+/{year}$"
    existing_docs = await coll.find(
        {"document_name": {"$regex": doc_prefix_pattern}},
        {"document_name": 1}
    ).to_list(length=1000)
    
    max_doc_seq = 0
    for doc in existing_docs:
        match = re.match(rf"^AC-CG{chargerNo}-(\d+)/{year}$", doc.get("document_name", ""))
        if match:
            max_doc_seq = max(max_doc_seq, int(match.group(1)))
    
    doc_name = f"AC-CG{chargerNo}-{max_doc_seq + 1:02d}/{year}"

    # ★★★ ตรวจสอบซ้ำ (race condition protection) ★★★
    exists = await coll.find_one({"$or": [{"issue_id": issue_id}, {"document_name": doc_name}]})
    if exists:
        raise HTTPException(status_code=409, detail="Duplicate issue_id or document_name, please retry")

    electrical_safety = _normalize_tick_to_pass(body.electrical_safety or {})
    charger_safety = _normalize_tick_to_pass(body.charger_safety or {})
    
    doc = {
        "sn": sn,
        "chargerNo": chargerNo,
        "document_name": doc_name,
        "issue_id": issue_id,
        "inspector": (body.head or {}).get("inspector") or "",
        "inspection_date": ac_date,
        "head": body.head,
        "equipment": body.equipment if body.equipment else {"manufacturers": [], "models": [], "serialNumbers": []},
        "electrical_safety": electrical_safety,
        "charger_safety": charger_safety,
        "remarks": body.remarks or {},
        "symbol": body.symbol,
        "phaseSequence": body.phaseSequence,
        "signature": body.signature.dict() if body.signature else None,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
        "photos": {},
        "test_files": body.test_files or {},  # ★★★ เพิ่มใหม่ ★★★
    }

    res = await coll.insert_one(doc)
    return {
        "ok": True, 
        "report_id": str(res.inserted_id),
        "issue_id": issue_id,
        "document_name": doc_name
    }

# ----------------------------------------------------------------------- device page (SN)
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
async def utilization_stream(request: Request, sn: str = Query(...), current: UserClaims = Depends(get_current_user)):
    # if current.role != "admin" and station_id not in set(current.station_ids):
    #     raise HTTPException(status_code=403, detail="Forbidden station_id")

    coll = get_device_collection_for(sn)
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
            latest["timestamp_utc"] = _ensure_utc_iso(latest.get("timestamp_utc"))
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
                    doc["timestamp_utc"] = _ensure_utc_iso(doc.get("timestamp_utc"))
                    yield f"data: {json.dumps(doc)}\n\n"
        except Exception:
            # fallback: ถ้าใช้ไม่ได้ (เช่น standalone) ให้ polling
            last_id = latest.get("_id") if latest else None
            while not await request.is_disconnected():
                doc = await coll.find_one({}, sort=[("timestamp_utc", -1), ("_id", -1)])
                if doc and str(doc["_id"]) != str(last_id):
                    last_id = str(doc["_id"])
                    doc["_id"] = last_id
                    doc["timestamp_utc"] = _ensure_utc_iso(doc.get("timestamp_utc"))
                    yield f"data: {json.dumps(doc)}\n\n"
                else:
                    yield ": keep-alive\n\n"
                await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)

@app.get("/station/{sn}/device-keys")
async def get_station_device_keys(
    sn: str, 
    current: UserClaims = Depends(get_current_user)
):
    """
    ดึงเฉพาะ device keys สำหรับแสดงใน dropdown
    sn = Serial Number ของ charger เช่น F1500624011
    Returns: { "keys": ["DC_power_contractor1", "FUSE1", "Router", ...] }
    """
    coll = get_device_collection_for(sn)
    
    latest = await coll.find_one({}, sort=[("timestamp", -1), ("_id", -1)])
    
    if not latest:
        return {"keys": []}
    
    # ลบ field ที่ไม่ต้องการแล้วเอาเฉพาะ keys
    fields_to_exclude = {"_id", "timestamp", "timestamp_utc"}
    keys = [k for k in latest.keys() if k not in fields_to_exclude]
    
    # เรียงลำดับตามชื่อ
    keys.sort()
    
    return {"keys": keys}

# ---------------------------------------------------------------------------------------
# device page (station_id)
# ---------------------------------------------------------------------------------------
# @app.get("/utilization/stream")
# async def utilization_stream(
#     request: Request, 
#     station_id: str = Query(...),  # ✅ เปลี่ยนจาก sn เป็น station_id
#     current: UserClaims = Depends(get_current_user)
# ):
#     coll = get_device_collection_for(station_id) 
#     headers = {
#         "Content-Type": "text/event-stream",
#         "Cache-Control": "no-cache",
#         "Connection": "keep-alive",
#         "X-Accel-Buffering": "no",
#     }

#     async def event_generator():
#         # ส่ง snapshot ล่าสุดก่อน
#         latest = await coll.find_one({}, sort=[("timestamp", -1), ("_id", -1)])
#         if latest:
#             latest["_id"] = str(latest["_id"])
#             latest["timestamp_utc"] = _ensure_utc_iso(latest.get("timestamp_utc"))
#             yield f"event: init\ndata: {json.dumps(latest)}\n\n"

#         # ต่อด้วย change stream (ต้องเป็น replica set / Atlas tier ที่รองรับ)
#         try:
#             async with coll.watch(full_document='updateLookup') as stream:
#                 async for change in stream:
#                     if await request.is_disconnected():
#                         break
#                     doc = change.get("fullDocument")
#                     if not doc:
#                         continue
#                     doc["_id"] = str(doc["_id"])
#                     doc["timestamp_utc"] = _ensure_utc_iso(doc.get("timestamp_utc"))
#                     yield f"data: {json.dumps(doc)}\n\n"
#         except Exception:
#             # fallback: ถ้าใช้ไม่ได้ (เช่น standalone) ให้ polling
#             last_id = latest.get("_id") if latest else None
#             while not await request.is_disconnected():
#                 doc = await coll.find_one({}, sort=[("timestamp_utc", -1), ("_id", -1)])
#                 if doc and str(doc["_id"]) != str(last_id):
#                     last_id = str(doc["_id"])
#                     doc["_id"] = last_id
#                     doc["timestamp_utc"] = _ensure_utc_iso(doc.get("timestamp_utc"))
#                     yield f"data: {json.dumps(doc)}\n\n"
#                 else:
#                     yield ": keep-alive\n\n"
#                 await asyncio.sleep(5)

#     return StreamingResponse(event_generator(), headers=headers)


#-------------------------------------------------------------------- setting page
def get_setting_collection_for(SN: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(SN)):
        raise HTTPException(status_code=400, detail="Bad SN")
    return settingDB.get_collection(str(SN))

# (เลือกได้) สร้างดัชนีแบบ lazy ต่อสถานีที่ถูกเรียกใช้
async def _ensure_util_index(coll):
    try:
        await coll.create_index([("timestamp", -1), ("_id", -1)])
    except Exception:
        pass

@app.get("/setting/stream")
async def setting_stream(request: Request, SN: str = Query(...), current: UserClaims = Depends(get_current_user)):
    coll = get_setting_collection_for(SN)
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    async def event_generator():
        latest = await coll.find_one({}, sort=[("timestamp", -1), ("_id", -1)])
        if latest:
            latest["_id"] = str(latest["_id"])
            latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
            yield f"event: init\ndata: {json.dumps(latest)}\n\n"

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
async def setting_query(request: Request, SN: str = Query(...), current: UserClaims = Depends(get_current_user)):
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    coll = get_setting_collection_for(SN)

    async def event_generator():
        last_id = None
        latest = await coll.find_one({}, sort=[("_id", -1)])
        if latest:
            latest["timestamp"] = latest.get("timestamp")
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
                doc["timestamp"] = doc.get("timestamp")
                last_id = doc.get("_id")
                yield f"data: {to_json(doc)}\n\n"
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)

from pdf import pdf_routes1
app.include_router(pdf_routes1.router)

class PLCMaxSetting(BaseModel):
    SN: str = Field(..., min_length=1)
    dynamic_max_current1: Optional[float] = None
    dynamic_max_power1: Optional[float] = None

@app.post("/setting/PLC/MAX")
async def setting_plc_max(payload: PLCMaxSetting):
    now_iso = datetime.now().isoformat()

    try:
        incoming = payload.model_dump(exclude_unset=True)
    except Exception:
        incoming = payload.dict(exclude_unset=True)

    SN = incoming.get("SN", payload.SN)

    keys = ("dynamic_max_current1", "dynamic_max_power1")
    changes = {k: float(incoming[k]) for k in keys if k in incoming}

    print(f"[{now_iso}] รับค่าจาก Front:")
    print(f"  SN = {SN}")
    print("  dynamic_max_current1 =", changes.get("dynamic_max_current1", "(no change)"), "A")
    print("  dynamic_max_power1  =", changes.get("dynamic_max_power1",  "(no change)"), "kW")

    if not changes:
        return {
            "ok": True,
            "message": "ไม่มีฟิลด์ที่เปลี่ยนแปลง (ไม่ส่ง MQTT)",
            "timestamp": now_iso,
            "mqtt": {
                "broker": f"{BROKER_HOST}:{BROKER_PORT}",
                "topic": MQTT_TOPIC,
                "published": False,
            },
            "data": {"SN": SN, "timestamp": now_iso},
        }

    msg = {
        "SN": SN,
        **changes,
        "timestamp": now_iso,
    }
    payload_str = json.dumps(msg, ensure_ascii=False)

    published = False
    try:
        pub_result = mqtt_client.publish(MQTT_TOPIC, payload_str, qos=1, retain=False)
        pub_result.wait_for_publish(timeout=2.0)
        published = pub_result.is_published()
        rc = pub_result.rc
        print(f"[MQTT] publish rc={rc}, published={published}, topic={MQTT_TOPIC}")
    except Exception as e:
        print(f"[MQTT] publish error: {e}")
        published = False

    return {
        "ok": True,
        "message": "รับค่าจาก frontend แล้ว และพยายามส่ง MQTT แล้ว (เฉพาะฟิลด์ที่เปลี่ยน)",
        "timestamp": now_iso,
        "mqtt": {
            "broker": f"{BROKER_HOST}:{BROKER_PORT}",
            "topic": MQTT_TOPIC,
            "published": bool(published),
        },
        "data": msg,
    }


class PLCCPCommand(BaseModel):
    SN: str
    cp_status1: Literal["start", "stop"]

@app.post("/setting/PLC/CP")
async def setting_plc_cp(payload: PLCCPCommand):
    now_iso = datetime.now().isoformat()

    print(f"[{now_iso}] รับค่าจาก Front:")
    print(f"  SN = {payload.SN}")
    print(f"  cp_status1 = {payload.cp_status1}")

    msg = {
        "SN": payload.SN,
        "cp_status1": payload.cp_status1,
        "timestamp": now_iso,
    }
    payload_str = json.dumps(msg, ensure_ascii=False)

    try:
        pub_result = mqtt_client.publish(MQTT_TOPIC, payload_str, qos=1, retain=False)
        pub_result.wait_for_publish(timeout=2.0)
        published = pub_result.is_published()
        rc = pub_result.rc
        print(f"[MQTT] publish rc={rc}, published={published}, topic={MQTT_TOPIC}")
    except Exception as e:
        print(f"[MQTT] publish error: {e}")
        published = False

    return {
        "ok": True,
        "message": "รับค่าจาก frontend แล้ว และพยายามส่ง MQTT แล้ว",
        "timestamp": now_iso,
        "mqtt": {
            "broker": f"{BROKER_HOST}:{BROKER_PORT}",
            "topic": MQTT_TOPIC,
            "published": bool(published),
        },
        "data": msg,
    }

class PLCH2MaxSetting(BaseModel):
    SN: str = Field(..., min_length=1)
    dynamic_max_current2: Optional[float] = None
    dynamic_max_power2: Optional[float] = None

@app.post("/setting/PLC/MAXH2")
async def setting_plc_maxh2(payload: PLCH2MaxSetting):
    now_iso = datetime.now().isoformat()

    try:
        incoming = payload.model_dump(exclude_unset=True)
    except Exception:
        incoming = payload.dict(exclude_unset=True)

    SN = incoming.get("SN", payload.SN)

    keys = ("dynamic_max_current2", "dynamic_max_power2")
    changes = {k: float(incoming[k]) for k in keys if k in incoming}

    if not changes:
        raise HTTPException(
            status_code=400,
            detail="At least one of dynamic_max_current2 or dynamic_max_power2 is required"
        )

    print(f"[{now_iso}] รับค่าจาก Front: SN={SN}")
    print("  dynamic_max_current2 =", changes.get("dynamic_max_current2", "(no change)"), "A")
    print("  dynamic_max_power2  =", changes.get("dynamic_max_power2", "(no change)"), "kW")

    msg = {"SN": SN, **changes, "timestamp": now_iso}
    payload_str = json.dumps(msg, ensure_ascii=False)

    published = False
    try:
        pub_result = mqtt_client.publish(MQTT_TOPIC, payload_str, qos=1, retain=False)
        pub_result.wait_for_publish(timeout=2.0)
        published = pub_result.is_published()
        rc = pub_result.rc
        print(f"[MQTT] publish rc={rc}, published={published}, topic={MQTT_TOPIC}")
    except Exception as e:
        print(f"[MQTT] publish error: {e}")
        published = False

    return {
        "ok": True,
        "message": "ส่งเฉพาะฟิลด์ที่เปลี่ยน",
        "timestamp": now_iso,
        "mqtt": {
            "broker": f"{BROKER_HOST}:{BROKER_PORT}",
            "topic": MQTT_TOPIC,
            "published": bool(published),
        },
        "data": msg,
    }

class PLCH2CPCommand(BaseModel):
    SN: str
    cp_status2: Literal["start", "stop"]

@app.post("/setting/PLC/CPH2")
async def setting_plc_cph2(payload: PLCH2CPCommand):
    now_iso = datetime.now().isoformat()

    print(f"[{now_iso}] รับค่าจาก Front:")
    print(f"  SN = {payload.SN}")
    print(f"  cp_status2 = {payload.cp_status2}")

    msg = {
        "SN": payload.SN,
        "cp_status2": payload.cp_status2,
        "timestamp": now_iso,
    }
    payload_str = json.dumps(msg, ensure_ascii=False)

    try:
        pub_result = mqtt_client.publish(MQTT_TOPIC, payload_str, qos=1, retain=False)
        pub_result.wait_for_publish(timeout=2.0)
        published = pub_result.is_published()
        rc = pub_result.rc
        print(f"[MQTT] publish rc={rc}, published={published}, topic={MQTT_TOPIC}")
    except Exception as e:
        print(f"[MQTT] publish error: {e}")
        published = False

    return {
        "ok": True,
        "message": "รับค่าจาก frontend แล้ว และพยายามส่ง MQTT แล้ว",
        "timestamp": now_iso,
        "mqtt": {
            "broker": f"{BROKER_HOST}:{BROKER_PORT}",
            "topic": MQTT_TOPIC,
            "published": bool(published),
        },
        "data": msg,
    }

# --------------------------------------------------------------------- CBM Page
def get_cbm_collection_for(station_id: str):
    # กันชื่อคอลเลกชันแปลก ๆ / injection: อนุญาต a-z A-Z 0-9 _ -
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    return CBM_DB.get_collection(str(station_id))

@app.get("/CBM")
async def cbm_query(request: Request, station_id: str = Query(...), current: UserClaims = Depends(get_current_user)):
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
    coll = get_cbm_collection_for(station_id)

    async def event_generator():
        last_id = None
        latest = await coll.find_one({}, sort=[("_id", -1)])  # ⬅️ ไม่ต้อง filter station_id ภายในแล้ว
        if latest:
            # latest["timestamp"] = _ensure_utc_iso(latest.get("timestamp"))
            latest["timestamp"] = latest.get("timestamp")
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
                # doc["timestamp"] = _ensure_utc_iso(doc.get("timestamp"))
                doc["timestamp"] = doc.get("timestamp")
                last_id = doc.get("_id")
                yield f"data: {to_json(doc)}\n\n"
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), headers=headers)

# -------------------------------------------------------------- AI
def get_outputModule6_collection_for(station_id: str):
    # กันชื่อคอลเลกชันแปลก ๆ / injection: อนุญาต a-z A-Z 0-9 _ -
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    return outputModule6.get_collection(str(station_id))

@app.get("/outputModule6")
async def get_latest(
    request: Request,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    coll = get_outputModule6_collection_for(station_id)
    doc = await coll.find_one({}, sort=[("_id", -1)])
    if not doc:
        raise HTTPException(status_code=404, detail="No data")

    # ✅ ต้องใส่เครื่องหมายอัญประกาศรอบ ETag ตามสเปก
    etag = f"\"{str(doc['_id'])}\""

    inm = request.headers.get("if-none-match")
    # ✅ ใช้ Response เปล่า ไม่ต้องมี body/JSONResponse
    if inm and etag in inm:
        return Response(status_code=304)

    # ถ้าจะส่ง body ต้องแปลง _id ก่อน
    doc["_id"] = str(doc["_id"])
    payload = jsonable_encoder(doc)

    resp = JSONResponse(content=payload)
    resp.headers["ETag"] = etag
    # ถ้า endpoint มี auth แนะนำให้ใช้ private
    resp.headers["Cache-Control"] = "private, max-age=86400, stale-while-revalidate=604800"
    return resp

@app.get("/outputModule6/progress")
async def get_module6_progress(
    request: Request,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """ดึงค่า progress/health index จาก MongoDB สำหรับ module 6"""
    coll = get_outputModule6_collection_for(station_id)
    doc = await coll.find_one({}, sort=[("_id", -1)])
    
    if not doc:
        return JSONResponse(content={"progress": 0})
    
    # สมมติว่าค่า health index/progress อยู่ในฟิลด์ 'health_index' หรือ 'rul_percentage'
    # ปรับตามโครงสร้างข้อมูลจริงของคุณ
    progress = doc.get("health_index", 0)  # หรือ doc.get("rul_percentage", 0)
    
    etag = f"\"{str(doc['_id'])}\""
    inm = request.headers.get("if-none-match")
    
    if inm and etag in inm:
        return Response(status_code=304)
    
    resp = JSONResponse(content={"progress": progress})
    resp.headers["ETag"] = etag
    resp.headers["Cache-Control"] = "private, max-age=60, stale-while-revalidate=300"
    return resp

@app.get("/modules/detail")
async def get_module_detail(
    request: Request,
    module_id: str = Query(..., description="เช่น module1..module7"),
    station_id: str = Query(..., description="ชื่อสถานี เช่น Klongluang3"),
    current: UserClaims = Depends(get_current_user),
):
    if module_id not in MODULES:
        raise HTTPException(status_code=400, detail="Unknown module_id")

    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")

    input_doc = None
    output_doc = None

    # --- OUTPUT ---
    try:
        out_db = OUTPUT_DBS.get(module_id)
        if out_db is not None:
            out_coll = out_db.get_collection(str(station_id))
            output_doc = await out_coll.find_one({}, sort=[("_id", -1)])
    except Exception as e:
        print("get_module_detail output error:", e)

    # --- INPUT ---
    try:
        in_db = INPUT_DBS.get(module_id)
        if in_db is not None:
            in_coll = in_db.get_collection(str(station_id))
            input_doc = await in_coll.find_one({}, sort=[("_id", -1)])
    except Exception as e:
        print("get_module_detail input error:", e)

    # 🔧 แปลง ObjectId → str ด้วย custom_encoder
    input_enc = jsonable_encoder(
        input_doc,
        custom_encoder={ObjectId: str},
    ) if input_doc else None

    output_enc = jsonable_encoder(
        output_doc,
        custom_encoder={ObjectId: str},
    ) if output_doc else None

    payload = {
        "module_id": module_id,
        "station_id": station_id,
        "input": input_enc,
        "output": output_enc,
    }

    resp = JSONResponse(content=payload)
    resp.headers["Cache-Control"] = "no-store"
    return resp



# สำหรับ modules อื่นๆ ทำแบบเดียวกัน
@app.get("/modules/progress")
async def get_all_modules_progress(
    request: Request,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """ดึงค่า progress ของทุก modules พร้อมกัน"""
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    
    result = {}
    
    # Module 1 - MDB Filters
    try:
        coll1 = outputModule1.get_collection(str(station_id))
        doc1 = await coll1.find_one({}, sort=[("_id", -1)])
        result["module1"] = doc1.get("health").get("health_index", 0) if doc1 else 0
    except:
        result["module1"] = 0
    try:
        coll2 = outputModule2.get_collection(str(station_id))
        doc2 = await coll2.find_one({}, sort=[("_id", -1)])
        result["module2"] = doc2.get("health_index_percent", 0) if doc2 else 0
    except:
        result["module2"] = 0
    
    # Module 3 - Online/Offline
    try:
        coll3 = outputModule3.get_collection(str(station_id))
        doc3 = await coll3.find_one({}, sort=[("_id", -1)])
        result["module3"] = doc3.get("health_index", 0) if doc3 else 0
    except:
        result["module3"] = 0
    
    # Module 4 - Power Supply
    try:
        coll4 = outputModule4.get_collection(str(station_id))
        doc4 = await coll4.find_one({}, sort=[("_id", -1)])
        result["module4"] = doc4.get("health_index", 0) if doc4 else 0
    except:
        result["module4"] = 0
    
    # Module 5 - Network
    try:
        coll5 = outputModule5.get_collection(str(station_id))
        doc5 = await coll5.find_one({}, sort=[("_id", -1)])
        result["module5"] = doc5.get("health").get("health_index",0) if doc5 else 0
    except:
        result["module5"] = 0
    
    # Module 6 - RUL
    try:
        coll6 = outputModule6.get_collection(str(station_id))
        doc6 = await coll6.find_one({}, sort=[("_id", -1)])
        result["module6"] = doc6.get("overall_health").get("average_health_index",0) if doc6 else 0
    except:
        result["module6"] = 0
    
    # Module 7 - Root Cause Analysis
    try:
        coll7 = outputModule7.get_collection(str(station_id))
        doc7 = await coll7.find_one({}, sort=[("_id", -1)])
        result["module7"] = doc7.get("health_index",0) if doc7 else 0
    except:
        result["module7"] = 0
    
    # คำนวณ overall health index (ค่าเฉลี่ยของทุก modules)
    module_values = list(result.values())
    overall_health = round(sum(module_values) / len(module_values), 2) if module_values else 0
    result["overall"] = overall_health
    
    resp = JSONResponse(content=result)
    resp.headers["Cache-Control"] = "private, max-age=60"
    return resp


def get_station_collection():
    return station_collection

class ModuleToggleIn(BaseModel):
    enabled: bool

@app.patch("/station/{station_id}/{module_id}", status_code=204)
async def patch_module_toggle(
    station_id: str,
    module_id: str,
    body: ModuleToggleIn,
    current: UserClaims = Depends(get_current_user),
):
    # ตรวจสอบว่า station_id ถูกต้อง
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", station_id):
        raise HTTPException(status_code=400, detail="Bad station_id")

    # ตรวจสอบว่า module_id เป็นโมดูลที่ถูกต้อง
    if module_id not in MODULES:
        raise HTTPException(status_code=400, detail="Invalid module_id")

    coll = get_station_collection()
    now = datetime.now(timezone.utc)

    # สร้างชื่อของฟิลด์ตาม module_id ที่ได้รับมา
    module_field = f"{module_id}_isActive"

    # อัปเดตสถานะโมดูล
    res = coll.update_one(
        {"station_id": station_id},
        {"$set": {
            module_field: body.enabled,
            "updatedAt": now,
            # "updated_by": getattr(current, "sub", None),
        }},
        upsert=False,   # ถ้าอยากสร้างเอกสารใหม่เมื่อไม่เจอ ให้ True
    )

    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Station not found")
