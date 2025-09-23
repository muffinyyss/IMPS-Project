from fastapi import FastAPI,HTTPException,Depends, status,Request,Query,APIRouter, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder 
from fastapi.security import OAuth2PasswordRequestForm,OAuth2PasswordBearer
from jose import JWTError,jwt
from datetime import datetime,timedelta, UTC, timezone, timedelta, time
from passlib.hash import bcrypt
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

SECRET_KEY = "supersecret"  # ใช้จริงควรเก็บเป็น env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

from pdf.pdf_routes import router as pdf_router

app = FastAPI()

client1 = MongoClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")
client = AsyncIOMotorClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")

db = client1["iMPS"]
users_collection = db["users"]
station_collection = db["stations"]


MDB_DB = client["MDB"]
# MDB_collection = MDB_DB["nongKhae"]
MDB_collection = MDB_DB.get_collection("NongKhae")


def create_access_token(data: dict, expires_delta: int | timedelta = 15):
    if isinstance(expires_delta, int):
        expire = datetime.utcnow() + timedelta(minutes=expires_delta)
    else:
        expire = datetime.utcnow() + expires_delta
    data.update({"exp": expire})
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

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
    role: str = "user"
    company: Optional[str] = None
    station_ids: List[str] = []

def get_current_user(token: str = Depends(oauth2_scheme)) -> UserClaims:
    cred_exc = HTTPException(status_code=401, detail="Could not validate credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise cred_exc
        station_ids = payload.get("station_ids") or []
        if not isinstance(station_ids, list):
            station_ids = [station_ids]
        return UserClaims(
            sub=sub,
            role=payload.get("role", "user"),
            company=payload.get("company"),
            station_ids=station_ids,
        )
    except JWTError:
        raise cred_exc

#####################login
@app.post("/login/")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = users_collection.find_one(
        {"email": form_data.username},
        {"_id": 1, "email": 1, "username": 1, "password": 1, "role": 1, "company": 1, "station_id": 1},
    )
    invalid_cred = HTTPException(status_code=401, detail="Invalid email or password")
    if not user or not bcrypt.checkpw(form_data.password.encode("utf-8"), user["password"].encode("utf-8")):
        raise invalid_cred

    # ทำให้ station_ids เป็น list เสมอ
    station_ids = user.get("station_id", [])
    if not isinstance(station_ids, list):
        station_ids = [station_ids]

    # ▶ Access Token ใส่สิทธิ์ไว้เลย
    access_token = create_access_token({
        "sub": user["email"],
        "role": user.get("role", "user"),
        "company": user.get("company"),
        "station_ids": station_ids,
    })

    # ▶ Refresh Token (มีหรือไม่มีก็ได้ตามที่คุณใช้อยู่)
    refresh_token = create_access_token({"sub": user["email"]}, expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))

    # อัปเดต refresh token ใน DB (จะเก็บ hash ก็ได้ ตามแนวทางที่คุยกันก่อนหน้า)
    users_collection.update_one({"_id": user["_id"]}, {"$set": {
        "refreshTokens": [{
            "token": refresh_token,
            "createdAt": datetime.utcnow(),
            "expiresAt": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        }]
    }})

    return {
        "message": "Login success ✅",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "username": user.get("username"),
            "email": user["email"],
            "role": user.get("role", "user"),
            "company": user.get("company"),
            "station_id": station_ids,
        }
    }

@app.get("/my-stations/detail")
def my_stations_detail(current: UserClaims = Depends(get_current_user)):
    # ดึงรายละเอียดเฉพาะสถานีที่ user มีสิทธิ์
    docs = list(station_collection.find(
        {"station_id": {"$in": current.station_ids}},
        {"_id": 0, "station_id": 1, "station_name": 1}
    ))
    return {"stations": docs}

@app.get("/station/info")
def station_info(
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),   # ดึง claims จาก JWT
):
    # เช็คสิทธิ์ก่อน (ข้อ 5)
    if station_id not in set(current.station_ids):
        raise HTTPException(status_code=403, detail="Forbidden station_id")

    # ดึงข้อมูลจากคอลเลกชัน stations
    doc = station_collection.find_one(
        {"station_id": station_id},
        # เลือก field ที่อยากคืน (ตัด _id ออกเพื่อลด serialize ปัญหา ObjectId)
        {"_id": 0, "station_id": 1, "station_name": 1, "SN": 1, "WO": 1, "model": 1, "status": 1}
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

        user = users_collection.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        # ตรวจสอบว่ามี refresh token ใน users มั้ย
        token_exists = next(
            (t for t in user.get("refreshTokens", []) if t["token"] == refresh_token), None
        )
        if not token_exists:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        # ออก access token ใหม่
        new_access_token = create_access_token(
            {"sub": email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {"access_token": new_access_token}

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


@app.get("/")
async def users():
    users = users_collection.find()
    username = [user["username"] for user in users]
    if username:
        return {"username":username}
    else:
        raise HTTPException(status_code=404,detail="users not found")
    
class register(BaseModel):
    username: str
    email: str
    password: str
    phone: str
    company: str
    phone: str
    company: str
#create
@app.post("/insert_users/")
async def create_users(users: register):
    # hash password
    hashed_pw = bcrypt.hashpw(users.password.encode("utf-8"), bcrypt.gensalt())
    hashed_pw_str = hashed_pw.decode("utf-8")

    users_collection.insert_one(
    {
        "username" : users.username,
        "email":users.email,
        "password":hashed_pw_str,
        "phone":users.phone,
        "refreshTokens": [],
        "role":"Technician",
        "company":users.company,
    })

@app.get("/stations/")
async def get_stations(q:str = ""):
    """ค้นหาสถานนี"""
    query = {"name":{"$regex":  q, "$options": "i"}} if q else {}
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

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")  # ชี้ไป endpoint login
# decode JWT 
def get_current_user2(token: str = Depends(oauth2_scheme)):
    print("Incoming token:", token)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        print("Decoded email:", email)  # << เพิ่ม log ตรงนี้

        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = users_collection.find_one({"email": email})
        print("User found:", user)  # << เพิ่ม log ตรงนี้

        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return str(user["_id"])
    except JWTError as e:
        print("JWTError:", str(e))
        raise HTTPException(status_code=401, detail="Invalid token")
    
@app.get("/owner/stations/")
async def get_stations(q: str = "", current_user: str = Depends(get_current_user2)):
    # current_user คือ str(_id)
    user_obj_id = ObjectId(current_user)

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
async def get_station_detail(station_id: str, current_user: str = Depends(get_current_user2)):
    station = station_collection.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    # ✅ แปลง _id เป็น string
    station["_id"] = str(station["_id"])

    return station

@app.get("/MDB")
async def mdb(request: Request, station_id: str | None = None):
    """
    SSE แบบไม่ใช้ Change Streams:
    - ส่ง snapshot ล่าสุดทันที
    - จากนั้นเช็กของใหม่ทุก ๆ 3 วินาที ถ้ามีจึงส่งต่อ
    """
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  # กัน proxy บัฟเฟอร์
    }

    async def event_generator():
        # ----- เตรียม query (รองรับ station_id เป็น str/number) -----
        q = {}
        if station_id is not None:
            in_list = [str(station_id)]
            try:
                in_list.append(int(str(station_id)))
            except ValueError:
                pass
            q["station_id"] = {"$in": in_list}

        # ----- ส่ง snapshot ล่าสุดทันที -----
        last_id = None
        latest = await MDB_collection.find_one(q, sort=[("_id", -1)])
        if latest:
            last_id = latest.get("_id")
            yield f"event: init\ndata: {to_json(latest)}\n\n"
        else:
            # ไม่มีข้อมูลก็ยังส่ง keep-alive ค้างต่อไปได้
            yield ": keep-alive\n\n"

        # ----- วนเช็กของใหม่ทุก 3 วิ (ปรับได้) -----
        while True:
            if await request.is_disconnected():
                break

            doc = await MDB_collection.find_one(q, sort=[("_id", -1)])
            if doc and doc.get("_id") != last_id:
                last_id = doc.get("_id")
                yield f"data: {to_json(doc)}\n\n"
            else:
                # กัน proxy/timeouts
                yield ": keep-alive\n\n"

            await asyncio.sleep(60)  # ปรับเป็น 1–5 วิ ตามที่ต้องการ

    return StreamingResponse(event_generator(), headers=headers)

@app.get("/MDB/{station_id}")
async def mdb(request: Request, station_id: str, current_user: str = Depends(get_current_user2)):
    """
    SSE แบบไม่ใช้ Change Streams:
    - ส่ง snapshot ล่าสุดทันที
    - จากนั้นเช็กของใหม่ทุก ๆ 60 วินาที ถ้ามีจึงส่งต่อ
    """
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  # กัน proxy บัฟเฟอร์
    }

    async def event_generator():
        # ----- เตรียม query (รองรับ station_id เป็น str/number) -----
        in_list = [str(station_id)]
        try:
            in_list.append(int(str(station_id)))
        except ValueError:
            pass
        q = {"station_id": {"$in": in_list}}

        # ----- ส่ง snapshot ล่าสุดทันที -----
        last_id = None
        latest = await MDB_collection.find_one(q, sort=[("_id", -1)])
        if latest:
            last_id = latest.get("_id")
            yield f"event: init\ndata: {to_json(latest)}\n\n"
        else:
            yield ": keep-alive\n\n"

        # ----- วนเช็กของใหม่ทุก 60 วิ -----
        while True:
            if await request.is_disconnected():
                break

            doc = await MDB_collection.find_one(q, sort=[("_id", -1)])
            if doc and doc.get("_id") != last_id:
                last_id = doc.get("_id")
                yield f"data: {to_json(doc)}\n\n"
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(60)  # ปรับช่วงเวลา polling ได้

    return StreamingResponse(event_generator(), headers=headers)

def parse_iso_dt(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail=f"Bad datetime: {s}")


@app.get("/MDB/history")
async def stream_history(
    station_id: str = Query(..., description="ID ของ turbine/station"),
    start: str = Query(..., description="วันที่เริ่มต้นในรูปแบบ ISO string"),
    end: str = Query(..., description="วันที่สิ้นสุดในรูปแบบ ISO string")
):
    print(f"Querying station_id={station_id} from {start} to {end}")

    query = {
        "station_id": station_id,
        "Datetime": {"$gte": start, "$lte": end}
    }

    projection = {
        "_id": 1,
        "station_id": 1,
        "VL1N": 1,
        "VL2N": 1,
        "VL3N": 1,
        "I1": 1,
        "I2": 1,
        "I3": 1,
        "PL1N": 1,
        "PL2N": 1,
        "PL3N": 1,
        "Datetime": 1
    }

    cursor = MDB_collection.find(query, projection).sort("Datetime", 1)

    async def event_generator():
        try:
            async for doc in cursor:   # iterate ทีละ record จาก Mongo
                doc["_id"] = str(doc["_id"])
                # ส่งเป็น SSE format → ต้องขึ้นต้นด้วย "data:" และจบด้วย \n\n
                yield f"data: {json.dumps(doc)}\n\n"
                await asyncio.sleep(0.01)  # กัน browser ค้าง (ปรับตามจริง)
        except Exception as e:
            print("Error in SSE generator:", e)
            yield f"event: error\ndata: {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# @app.get("/MDB/history/{station_id}")
# async def stream_history_sse(
#     request: Request,
#     station_id: str = Path(..., description="ID ของ turbine/station"),
#     start: str = Query(..., description="วันที่เริ่มต้นในรูปแบบ ISO string"),
#     end: str = Query(..., description="วันที่สิ้นสุดในรูปแบบ ISO string")
# ):
#     print("✅ เข้า route /MDB/history แล้วจ้า")
#     headers = {
#         "Content-Type": "text/event-stream",
#         "Cache-Control": "no-cache",
#         "Connection": "keep-alive",
#         "X-Accel-Buffering": "no",
#     }

#     # แปลงวันเวลาเป็น datetime object (ถ้าต้องการใช้ใน Mongo)
#     def parse_iso(s: str) -> datetime:
#         try:
#             return datetime.fromisoformat(s.replace("Z", "+00:00"))
#         except Exception:
#             raise HTTPException(status_code=400, detail=f"Bad datetime: {s}")

#     query = {
#         "station_id": station_id,
#         "Datetime": {
#             "$gte": parse_iso(start),
#             "$lte": parse_iso(end)
#         }
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
#             async for doc in cursor:
#                 print("ส่ง doc:", doc)
#                 doc["_id"] = str(doc["_id"])
#                 yield f"data: {json.dumps(doc)}\n\n"
#                 await asyncio.sleep(0.01)  # กัน browser ค้าง
#         except Exception as e:
#             yield f"event: error\ndata: {str(e)}\n\n"

#     return StreamingResponse(event_generator(), headers=headers)



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

async def change_stream_generator():
    # MongoDB Change Stream
    change_stream = MDB_collection.watch()

    async for change in change_stream:
        # ดึงข้อมูลใหม่จาก change stream
        if "fullDocument" in change:
            doc = change["fullDocument"]
            # สร้าง payload ที่จะส่งไปยัง client
            payload = {
                "t": doc["Datetime"],
                "L1": doc["VL1N"],
                "L2": doc["VL2N"],
                "L3": doc["VL3N"],
                "I1": doc["I1"],
                "I2": doc["I2"],
                "I3": doc["I3"],
                "W1": doc["PL1N"],
                "W2": doc["PL2N"],
                "W3": doc["PL3N"]
            }
            # ส่งข้อมูลไปยัง client
            yield f"data: {json.dumps(payload)}\n\n"


# @app.get("/MDB/history/last24")
# async def get_last_24h(
#     request: Request,
#     station_id: int = Query(...),
#     step_sec: int = Query(300, ge=5, le=3600),
#     limit: int = Query(20000, ge=1, le=200000),
# ) -> StreamingResponse:
#     """
#     ส่งข้อมูลตั้งแต่เที่ยงคืนของวันนี้ และอัปเดตข้อมูลทุก 1-3 วินาที
#     """
#     headers = {
#         "Content-Type": "text/event-stream",
#         "Cache-Control": "no-cache",
#         "Connection": "keep-alive",
#         "X-Accel-Buffering": "no",  # กัน proxy บัฟเฟอร์
#     }

#     async def event_generator():
#         # ---- ดึงข้อมูลตั้งแต่เที่ยงคืนของวันนี้ ----
#         end_dt = datetime.now(timezone.utc)
#         # กำหนดเวลาเริ่มต้นเป็นเที่ยงคืนของวันนี้
#         start_dt = datetime.combine(end_dt.date(), time.min, tzinfo=timezone.utc)

#         start_iso = start_dt.isoformat().replace("+00:00", "Z")
#         end_iso = end_dt.isoformat().replace("+00:00", "Z")

#         pipeline = [
#             {"$match": {
#                 "station_id": station_id,
#                 "Datetime": {"$gte": start_iso, "$lte": end_iso}
#             }},
#             {"$addFields": {
#                 "_dt": {"$dateFromString": {"dateString": "$Datetime"}}
#             }},
#             {"$project": {
#                 "_id": 0,
#                 "_dt": 1,
#                 "VL1N": 1, "VL2N": 1, "VL3N": 1, "I1": 1, "I2": 1, "I3": 1,
#                 "PL1N": 1, "PL2N": 1, "PL3N": 1
#             }},
#             {"$addFields": {
#                 "bin": {
#                     "$toDate": {
#                         "$subtract": [
#                             {"$toLong": "$_dt"},
#                             {"$mod": [{"$toLong": "$_dt"}, step_sec * 1000]}
#                         ]
#                     }
#                 }
#             }},
#             {"$group": {
#                 "_id": "$bin",
#                 "VL1N": {"$avg": "$VL1N"},
#                 "VL2N": {"$avg": "$VL2N"},
#                 "VL3N": {"$avg": "$VL3N"},
#                 "I1": {"$avg": "$I1"},
#                 "I2": {"$avg": "$I2"},
#                 "I3": {"$avg": "$I3"},
#                 "PL1N": {"$avg": "$PL1N"},
#                 "PL2N": {"$avg": "$PL2N"},
#                 "PL3N": {"$avg": "$PL3N"}
#             }},
#             {"$sort": {"_id": 1}},
#             {"$limit": limit},
#             {"$project": {
#                 "t": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%SZ", "date": "$_id"}},
#                 "L1": "$VL1N",
#                 "L2": "$VL2N",
#                 "L3": "$VL3N",
#                 "I1": "$I1",
#                 "I2": "$I2",
#                 "I3": "$I3",
#                 "W1": "$PL1N",
#                 "W2": "$PL2N",
#                 "W3": "$PL3N",
#                 "_id": 0
#             }}
#         ]

#         # ส่งข้อมูลตั้งแต่เที่ยงคืนของวันนี้ (snapshot)
#         cursor = MDB_collection.aggregate(pipeline, allowDiskUse=True, maxTimeMS=10000)
#         sent_any = False
#         async for d in cursor:
#             sent_any = True
#             yield f"data: {json.dumps(d)}\n\n"

#         # เช็กข้อมูลใหม่ทุก 1–3 วินาที
#         last_time = end_dt
#         while True:
#             if await request.is_disconnected():
#                 break

                
#             # ดึงข้อมูลที่มี timestamp ล่าสุดกว่าที่เราเคยส่งไป
#             # q = {
#             #     "station_id": station_id,
#             #     "Datetime": {"$gt": last_time.isoformat().replace("+00:00", "Z")}
#             # }
#             if isinstance(last_time, str):
#                 last_time = datetime.fromisoformat(last_time)

#             q = {
#                 "station_id": station_id,
#                 "Datetime": {"$gt": last_time.isoformat().replace("+00:00", "Z")}
#             }

#             cursor = MDB_collection.find(
#                 q,
#                 sort=[("Datetime", 1)],
#                 limit=500,
#                 projection={"_id": 1, "Datetime": 1, "VL1N": 1, "VL2N": 1, "VL3N": 1, "I1": 1, "I2": 1, "I3": 1, "PL1N": 1, "PL2N": 1, "PL3N": 1}
#             )

#             sent_any = False
#             async for doc in cursor:
#                 last_time = doc["Datetime"]
#                 payload = {
#                     "t": last_time,
#                     "L1": to_float(doc.get("VL1N")),
#                     "L2": to_float(doc.get("VL2N")),
#                     "L3": to_float(doc.get("VL3N")),
#                     "I1": to_float(doc.get("I1")),
#                     "I2": to_float(doc.get("I2")),
#                     "I3": to_float(doc.get("I3")),
#                     "W1": to_float(doc.get("PL1N")),
#                     "W2": to_float(doc.get("PL2N")),
#                     "W3": to_float(doc.get("PL3N"))
#                 }
#                 yield f"data: {json.dumps(payload)}\n\n"
#                 sent_any = True

#             # ถ้าไม่มีข้อมูลใหม่ก็ส่ง keep-alive
#             if not sent_any:
#                 yield ": keep-alive\n\n"

#             await asyncio.sleep(300)  # เช็กข้อมูลใหม่ทุก 3 วินาที

#     return StreamingResponse(event_generator(), headers=headers)

def floor_bin(dt: datetime, step_sec: int) -> datetime:
    epoch_ms = int(dt.timestamp() * 1000)
    bin_ms = epoch_ms - (epoch_ms % (step_sec * 1000))
    return datetime.fromtimestamp(bin_ms / 1000, tz=timezone.utc)



def to_json(doc):
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    return json.dumps(doc, default=str)

# @app.get("/MDB/stream")
# async def mdb_stream(
#     request: Request,
#     station_id: int = Query(...),
#     step_sec: int = Query(60, ge=5, le=3600),
# ):
#     headers = {
#         "Content-Type": "text/event-stream",
#         "Cache-Control": "no-cache",
#         "Connection": "keep-alive",
#         "X-Accel-Buffering": "no",
#     }

#     async def event_generator():
#         # ส่งค่าให้ client รู้ว่าจะ reconnect ในกี่ ms ถ้าหลุด
#         yield "retry: 3000\n\n"

#         q = {"station_id": station_id}
#         last_iso = None  # Datetime ล่าสุดที่ได้ส่งไปแล้ว

#         # ส่ง snapshot ล่าสุดทันที
#         latest = await MDB_collection.find_one(q, sort=[("Datetime", -1)])
#         if latest:
#             last_iso = latest.get("Datetime")
#             yield f"event: init\ndata: {to_json(latest)}\n\n"
#         else:
#             yield ": keep-alive\n\n"

#         while True:
#             if await request.is_disconnected():
#                 break

#             # ดึงเฉพาะเอกสารที่ Datetime > last_iso
#             mq = {"station_id": station_id}
#             if last_iso:
#                 mq["Datetime"] = {"$gt": last_iso}

#             cursor = MDB_collection.find(mq).sort("Datetime", 1).limit(500)
#             sent_any = False
#             async for d in cursor:
#                 last_iso = d["Datetime"]
#                 # map เป็น payloadที่กราฟคุณรอ (เช่น L1/L2/L3)
#                 payload = {
#                     "t": last_iso,                # ISO จาก DB (UTC)
#                     "L1": float(d.get("VL1N", 0)),
#                     "L2": float(d.get("VL2N", 0)),
#                     "L3": float(d.get("VL3N", 0)),
#                     "I1": float(d.get("I1", 0)),
#                     "I2": float(d.get("I2", 0)),
#                     "I3": float(d.get("I3", 0)),
#                     "W1": float(d.get("PL1N", 0)),
#                     "W2": float(d.get("PL2N", 0)),
#                     "W3": float(d.get("PL3N", 0)),
#                 }
#                 yield f"data: {json.dumps(payload)}\n\n"
#                 sent_any = True

#             if not sent_any:
#                 yield ": keep-alive\n\n"

#             await asyncio.sleep(2)  # ← ปรับเป็น 1–3 วิ ตามความถี่ที่ต้องการ

#     return StreamingResponse(event_generator(), headers=headers)

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
        "company": (body.company_name or body.company or "").strip() or None,
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

@app.get("/all-stations/")
def all_stations():
    # เอาทุกฟิลด์ ยกเว้น password และ refreshTokens
    cursor = station_collection.find({})
    docs = list(cursor)

    # ถ้าจะส่ง _id ไปด้วย ต้องแปลง ObjectId -> str
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

class StationOut(BaseModel):
    id: str
    station_id:str
    station_name:str
    brand:str
    model:str
    SN:str
    WO:str 
    # payment: Optional[bool] = None

@app.post("/add_stations/", response_model=StationOut, status_code=201)
def insert_stations(body: addStations):
    doc = {
        "station_id": body.station_id.strip(),
        "station_name": body.station_name.strip(),
        "brand": body.brand.strip(),
        "model": body.model.strip(),
        "SN": body.SN.strip(),
        "WO": body.WO.strip(),
        "createdAt": datetime.now(timezone.utc),
    }

    try:
        res = station_collection.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="station_id already exists")

    return {
        "id": str(res.inserted_id),
        "station_id": doc["station_id"],
        "station_name": doc["station_name"],
        "brand": doc["brand"],
        "model": doc["model"],
        "SN": doc["SN"],
        "WO": doc["WO"],
        # "createdAt": doc["createdAt"],
    }

@app.delete("/delete_stations/{station_id}", status_code=204)
def delete_user(station_id: str, current: UserClaims = Depends(get_current_user)):
    # (ทางเลือก) บังคับสิทธิ์เฉพาะ admin/owner
    if current.role not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        oid = ObjectId(station_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")

    res = station_collection.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    # 204 No Content
    return Response(status_code=204)