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
    user_id: Optional[str] = None
    username: str
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
            user_id=payload.get("user_id"), 
            username=payload.get("username"),
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
        "user_id": str(user["_id"]),
        "username": user.get("username"),
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
            "user_id": str(user["_id"]),
            "username": user.get("username"),
            "email": user["email"],
            "role": user.get("role", "user"),
            "company": user.get("company"),
            "station_id": station_ids,
        }
    }

# @app.get("/my-stations/detail")
# def my_stations_detail(current: UserClaims = Depends(get_current_user)):
#     # ดึงรายละเอียดเฉพาะสถานีที่ user มีสิทธิ์
#     docs = list(station_collection.find(
#         {"station_id": {"$in": current.station_ids}},
#         {"_id": 0, "station_id": 1, "station_name": 1}
#     ))
#     return {"stations": docs}

# @app.get("/my-stations/detail")
# def my_stations_detail(current: UserClaims = Depends(get_current_user)):
#     # ถ้าเป็น admin → เห็นทุกสถานี
#     if current.role == "admin":
#         docs = list(
#             station_collection.find(
#                 {},
#                 {"_id": 0, "station_id": 1, "station_name": 1}
#             )
#         )
#         return {"stations": docs}

#     # ถ้าไม่ใช่ admin → เห็นเฉพาะ station_ids ใน token
#     docs = list(
#         station_collection.find(
#             {"station_id": {"$in": current.station_ids}},
#             {"_id": 0, "station_id": 1, "station_name": 1}
#         )
#     )
#     return {"stations": docs}

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

# @app.get("/all-stations/")
# def all_stations():
#     docs = list(station_collection.find({}))
#     # แปลง ObjectId ทุกฟิลด์ในเอกสารให้เป็น str
#     docs = jsonable_encoder(docs, custom_encoder={ObjectId: str})
#     # เอาทุกฟิลด์ ยกเว้น password และ refreshTokens
#     # cursor = station_collection.find({})
#     # docs = list(cursor)

#     # ถ้าจะส่ง _id ไปด้วย ต้องแปลง ObjectId -> str
#     for d in docs:
#         if "_id" in d:
#             d["_id"] = str(d["_id"])

#     return {"stations": docs}

# @app.get("/all-stations/")
# def all_stations(current: UserClaims = Depends(get_current_user)):
#     # admin เห็นทั้งหมด, owner เห็นเฉพาะของตัวเอง
#     if current.role == "admin":
#         query = {}
#     else:
#         # owner/role อื่น เห็นเฉพาะที่ user_id ตรง uid
#         if not current.user_id:
#             raise HTTPException(status_code=401, detail="Missing uid in token")
#         # query = {"user_id": current.user_id}
#         conds = [{"user_id": current.user_id}]
#         try:
#             conds.append({"user_id": ObjectId(current.user_id)})
#         except Exception:
#             pass
#         query = {"$or": conds}

#     docs = list(station_collection.find(query))
#     docs = jsonable_encoder(docs, custom_encoder={ObjectId: str})
#     for d in docs:
#         if "_id" in d:
#             d["_id"] = str(d["_id"])
#     return {"stations": docs}

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
        "user_id": str(doc["user_id"]),       # string สำหรับ client
        "username": owner_username,           # ส่งกลับให้ table โชว์ได้เลย
        "is_active": doc["is_active"],
        "createdAt": doc["createdAt"],
        # "updatedAt": None,  # จะใส่ก็ได้ถ้าอยากให้ schemaเหมือน PATCH เป๊ะ
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

class StationUpdate(BaseModel):
    station_name: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    SN: Optional[str] = None
    WO: Optional[str] = None
    # status: Optional[bool] = None
    is_active: Optional[bool] = None
    user_id: str | None = None 


ALLOW_FIELDS_ADMIN = {"station_id", "station_name", "brand", "model", "SN", "WO", "status","is_active", "user_id"}
# ALLOW_FIELDS_NONADMIN = {"status"}

def to_object_id_or_400(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid user_id")

from bson import ObjectId
from typing import Any, Dict
from fastapi import HTTPException, Depends

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

            # ถ้าไม่อยากเก็บ username คู่กัน ให้แน่ใจว่าเราไม่เซ็ต/ไม่เก็บฟิลด์นี้
            # ถ้าเคยมี username อยู่แล้วและต้องการลบทิ้ง สามารถเพิ่ม $unset ตอน update ได้ (ดูข้างล่าง)
    # else:
    #     payload = {k: v for k, v in incoming.items() if k in ALLOW_FIELDS_NONADMIN}
    #     if not payload:
    #         raise HTTPException(status_code=400, detail="only status can be updated")

    # ตรวจชนิด status ให้เป็น bool
    # if "status" in payload and not isinstance(payload["status"], bool):
    #     raise HTTPException(status_code=400, detail="status must be boolean")
    
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