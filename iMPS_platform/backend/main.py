from fastapi import FastAPI,HTTPException,Depends, status,Request,Query,APIRouter, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder 
from fastapi.security import OAuth2PasswordRequestForm,OAuth2PasswordBearer
from jose import JWTError,jwt
from datetime import datetime,timedelta, UTC, timezone, timedelta, time
from passlib.hash import bcrypt
from pymongo.errors import OperationFailure, PyMongoError
from pymongo import MongoClient
from pydantic import BaseModel
from bson.objectid import ObjectId
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import json, os, asyncio
from pdf.pdf_routes import router as pdf_router
from fastapi.responses import StreamingResponse
from typing import List, Any,Dict
import bcrypt
from dateutil import parser as dtparser
from bson.decimal128 import Decimal128

SECRET_KEY = "supersecret"  # ใช้จริงควรเก็บเป็น env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
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
MDB_collection = MDB_DB.get_collection("nongKhae")

# @app.get("/")
# async def homepage():
#     return {"message": "Helloo World"}


def create_access_token(data: dict, expires_delta: int = 15):
    expire = datetime.utcnow() + timedelta(minutes=expires_delta)
    data.update({"exp": expire})
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

class LoginRequest(BaseModel):
    username: str
    password: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],  # เปลี่ยนเป็น port 3001 ชั่วคราวครับ เชลซีกับพี่โจ้ รัน 3000 ไม่ได้
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/login/")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = users_collection.find_one({"username": form_data.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not bcrypt.checkpw(form_data.password.encode("utf-8"), user["password"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # generate tokens
    access_token = create_access_token({"sub": user["username"]})
    refresh_token = create_access_token({"sub": user["username"]}, expires_delta=60*24)

    # update refresh token in DB
    users_collection.update_one(
        {"_id": user["_id"]},
        # {"$push": {"refreshTokens": {"token": refresh_token, "expiresAt": datetime.utcnow() + timedelta(days=1)}}}
        {"$set": {
        "refreshTokens": [{
            "token": refresh_token,  # แนะนำให้เก็บแบบ hash ดูหัวข้อ Security ด้านล่าง
            "createdAt": datetime.utcnow(),
            "expiresAt": datetime.utcnow() + timedelta(days=7),
        }]
    }}
    )

    return {
        "message": "Login success ✅",
        "access_token": access_token,
        "refresh_token": refresh_token, 
        "user":{
            "username": user["username"],
            "role":user["role"],
            "company": user["company"],
            "station_id": user["station_id"],
            "role": user["role"]
        }
    }

@app.post("/refresh")
async def refresh(refresh_token: str):
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")

        user = users_collection.find_one({"username": username})
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
            {"sub": username}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {"access_token": new_access_token}

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
@app.post("/logout")
async def logout(username: str, refresh_token: str):
    users_collection.update_one(
        {"username": username},
        {"$pull": {"refreshTokens": {"token": refresh_token}}}
    )
    return {"msg": "Logged out successfully"}

# def create_access_token(data: dict, expires_delta: int = 15):
#     expire = datetime.utcnow() + timedelta(minutes=expires_delta)
#     data.update({"exp": expire})
#     return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

class LoginRequest(BaseModel):
    username: str
    password: str



app.include_router(pdf_router)

class LoginRequest(BaseModel):
    username: str
    password: str

@app.get("/")
async def users():
    users = users_collection.find()
    username = [user["username"] for user in users]
    if username:
        return {"username":username}
    else:
        raise HTTPException(status_code=404,detail="users not found")
    
class users(BaseModel):
    username: str
    email: str
    password: str
    phone: str
    company: str
    password: str
    phone: str
    company: str
#create
@app.post("/insert_users/")
async def create_users(users: users):
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


# @app.get("/MDB/")
# def list_mdb():
#     docs = MDB_collection.find_one({}, {"password": 0},sort=[("Datetime",-1)])  # ซ่อน password ถ้ามี
   
#     if not docs:
#         raise HTTPException(status_code=404, detail="MDB not found")
    
#     return {"MDB": jsonable_encoder(docs, custom_encoder={ObjectId: str})}
    
# DT_FIELD = "Datetime"  # <-- ใช้ชื่อตามสคีมาที่ให้มา

# def parse_iso(s: str) -> datetime:
#     # s ตัวอย่าง: "2025-09-15T12:55:21.559518"
#     # จากที่ให้มาเป็น naive (ไม่มี timezone) — ใช้ fromisoformat ได้ตรง ๆ
#     return datetime.fromisoformat(s)

# def isoformat(dt: datetime) -> str:
#     # ให้รูปแบบเหมือนใน DB (มี microseconds, ไม่มี timezone)
#     return dt.isoformat(timespec="microseconds")

# def to_json(doc) -> str:
#     # ใส่ตัวแปลงที่คุณใช้อยู่ (เช่น orjson.dumps(doc).decode() หรือ custom)
#     import json
#     from bson import ObjectId
#     def default(o):
#         if isinstance(o, ObjectId):
#             return str(o)
#         return o
#     return json.dumps(doc, default=default, ensure_ascii=False)

# @app.get("/MDB/history")
# async def mdb(request: Request, station_id: str | None = None, hours: int = 24):
#     """
#     SSE: ส่ง snapshot ย้อนหลัง `hours` ชั่วโมงจาก Datetime ล่าสุด แล้วสตรีมของใหม่ต่อ
#     ไม่พลาดเอกสารที่แทรกระหว่างรอบ (sort ตาม (Datetime, _id))
#     """
#     headers = {
#         "Content-Type": "text/event-stream",
#         "Cache-Control": "no-cache",
#         "Connection": "keep-alive",
#         "X-Accel-Buffering": "no",
#     }

#     async def event_generator():
#         # ----- base query (รองรับ station_id เป็น str/number) -----
#         q = {}
#         if station_id is not None:
#             in_list = [str(station_id)]
#             try:
#                 in_list.append(int(str(station_id)))
#             except ValueError:
#                 pass
#             q["station_id"] = {"$in": in_list}

#         # ----- หาเอกสารล่าสุดตามฟิลด์เวลา -----
#         latest = await MDB_collection.find_one(q, sort=[(DT_FIELD, -1), ("_id", -1)])
#         if not latest:
#             # ไม่มีข้อมูล -> ส่ง keep-alive ต่อ
#             yield ": keep-alive\n\n"
#             while True:
#                 if await request.is_disconnected():
#                     break
#                 yield ": keep-alive\n\n"
#                 await asyncio.sleep(60)
#             return

#         latest_str = latest[DT_FIELD]                # string ISO จาก DB
#         latest_dt  = parse_iso(latest_str)
#         start_dt   = latest_dt - timedelta(hours=hours)
#         start_str  = isoformat(start_dt)

#         # ----- snapshot: เอกสารในช่วง [start_str, latest_str] เรียงเก่า -> ใหม่ -----
#         last_dt_str = None
#         last_id = None
#         window_q = {**q, DT_FIELD: {"$gte": start_str, "$lte": latest_str}}
#         async for doc in MDB_collection.find(window_q, sort=[(DT_FIELD, 1), ("_id", 1)]):
#             last_dt_str = doc[DT_FIELD]
#             last_id     = doc["_id"]
#             yield f"event: init\ndata: {to_json(doc)}\n\n"

#         # ----- วนเช็กของใหม่แบบไม่ตกหล่น -----
#         while True:
#             if await request.is_disconnected():
#                 break

#             cond = q.copy()
#             if last_dt_str is not None and last_id is not None:
#                 # ดึงเอกสารที่ Datetime มากกว่า หรือ Datetime เท่ากันแต่ _id ใหม่กว่า
#                 cond["$or"] = [
#                     {DT_FIELD: {"$gt": last_dt_str}},
#                     {DT_FIELD: last_dt_str, "_id": {"$gt": last_id}},
#                 ]

#             sent_any = False
#             async for doc in MDB_collection.find(cond, sort=[(DT_FIELD, 1), ("_id", 1)]):
#                 sent_any   = True
#                 last_dt_str = doc[DT_FIELD]
#                 last_id     = doc["_id"]
#                 yield f"data: {to_json(doc)}\n\n"

#             if not sent_any:
#                 yield ": keep-alive\n\n"

#             await asyncio.sleep(3)  # ปรับได้ (1–5 วิ ถ้าอยากไวขึ้น)

#     return StreamingResponse(event_generator(), headers=headers)

def parse_iso_dt(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail=f"Bad datetime: {s}")

# @app.get("/MDB/history")
# async def get_history(
#     station_id: int = Query(...),
#     start: str = Query(...),  # เช่น "2025-09-01T00:00:00Z"
#     end: str = Query(...),    # เช่น "2025-09-15T23:59:59Z"
#     limit: int = Query(50000, ge=1, le=200000),
# ) -> List[Any]:
#     start_dt = parse_iso_dt(start)
#     end_dt = parse_iso_dt(end)

#     count = await MDB_collection.count_documents({
#         "station_id": 7,
#         "Datetime": {"$gte": "2025-09-1400:00:00Z", "$lte": "2025-09-163:59:59Z"}
#     })
#     print(count)

#     # ทดลองดู sample document
#     sample = await MDB_collection.find_one({"station_id": station_id}, {"Datetime": 1})
#     if not sample:
#         return []

#     dt_val = sample.get("Datetime")

#     if isinstance(dt_val, str):
#         # ถ้าใน DB เก็บเป็น string → ใช้ string ช่วงเวลา
#         q = {
#             "station_id": station_id,
#             "Datetime": {"$gte": start, "$lte": end}
#         }
#     else:
#         # ถ้าใน DB เก็บเป็น datetime object → ใช้ datetime object
#         q = {
#             "station_id": station_id,
#             "Datetime": {"$gte": start_dt, "$lte": end_dt}
#         }

#     cursor = MDB_collection.find(q).sort("Datetime", 1).limit(limit)
#     docs = []
#     async for d in cursor:
#         d["_id"] = str(d["_id"])
#         docs.append(d)
#     return docs


# @app.get("/MDB/history")
# async def get_history(
#     station_id: int = Query(..., description="ID ของ turbine/station"),
#     start: str = Query(..., description="วันที่เริ่มต้นในรูปแบบ ISO string"),
#     end: str = Query(..., description="วันที่สิ้นสุดในรูปแบบ ISO string"),
#     limit: int = Query(None, description="จำนวน record สูงสุดที่จะดึง")
# ):
#     """
#     ดึงข้อมูล history ของ station_id ตามช่วง start-end
#     """
#     # แปลง string เป็น datetime
#     start_dt = datetime.fromisoformat(start)
#     end_dt = datetime.fromisoformat(end)

#     # query MongoDB
#     query = {
#         "station_id": station_id,
#         "ts": { "$gte": start_dt, "$lte": end_dt }  # สมมติว่า field ใน DB คือ ts
#     }

#     cursor = MDB_collection.find(query).sort("ts", 1)  # เรียงตามเวลา ascending
#     if limit:
#         cursor = cursor.limit(limit)

#     # แปลงผลเป็น list ของ dict พร้อม serialize datetime เป็น string
#     result = []
#     for doc in cursor:
#         doc["_id"] = str(doc["_id"])  # แปลง ObjectId เป็น string
#         doc["ts"] = doc["ts"].isoformat()  # แปลง datetime เป็น ISO string
#         result.append(doc)

#     return result


# @app.get("/MDB/history")
# async def get_history(
#     station_id: int = Query(..., description="ID ของ turbine/station"),
#     start: str = Query(..., description="วันที่เริ่มต้นในรูปแบบ ISO string"),
#     end: str = Query(..., description="วันที่สิ้นสุดในรูปแบบ ISO string")
#     # ,limit: int = Query(None, description="จำนวน record สูงสุดที่จะดึง")
# ):
#     try:
#         # แปลง string เป็น datetime
#         start_dt = datetime.fromisoformat(start)
#         end_dt = datetime.fromisoformat(end)

#         print(f"Querying station_id={station_id} from {start_dt} to {end_dt}")

#         # query MongoDB
#         query = {
#             "station_id": station_id,
#             "Datetime": {
#                 "$gte": start_dt.isoformat(),  # แปลงเป็น ISO string
#                 "$lte": end_dt.isoformat()
#             }
#         }

#         cursor = MDB_collection.find(query).sort("Datetime", 1)
#         # if limit:
#         #     cursor = cursor.limit(limit)

#         # ใช้ async for หรือ to_list()
#         result = await cursor.to_list(length=None)  # limit แนะนำเพื่อป้องกันดึงข้อมูลเยอะเกินไป

#         # แปลง ObjectId และ datetime
#         for doc in result:
#             doc["_id"] = str(doc["_id"])
#             # doc["Datetime"] = doc["Datetime"].isoformat()

#         print(f"Found {len(result)} records")
#         return result

#     except Exception as e:
#         print("Error in get_history:", e)
#         raise HTTPException(status_code=500, detail=str(e))

@app.get("/MDB/history")
async def stream_history(
    station_id: int = Query(..., description="ID ของ turbine/station"),
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


# @app.get("/MDB/history/last24")
# async def get_last_24h(
#     station_id: int = Query(...),
#     step_sec: int = Query(60, ge=5, le=3600),
#     limit: int = Query(20000, ge=1, le=200000),
# ) -> List[Any]:
#     end_dt = datetime.now(timezone.utc)
#     start_dt = end_dt - timedelta(hours=24)

#     # DB ของคุณเก็บ Datetime เป็น "string" ISO → ใช้ string ช่วงเวลา
#     start_iso = start_dt.isoformat().replace("+00:00", "Z")
#     end_iso   = end_dt.isoformat().replace("+00:00", "Z")

#     pipeline = [
#         {"$match": {
#             "station_id": station_id,
#             "Datetime": {"$gte": start_iso, "$lte": end_iso}
#         }},
#         # แปลง string → date เพื่อทำ bin เป็น step_sec
#         {"$addFields": {
#             "_dt": {"$dateFromString": {"dateString": "$Datetime"}}
#         }},
#         # ดึงฟิลด์ตาม schema จริงของคุณ
#         {"$project": {
#             "_id": 0,
#             "_dt": 1,
#             "VL1N": 1, "VL2N": 1, "VL3N": 1, "I1": 1, "I2": 1, "I3": 1, "PL1N": 1, "PL2N": 1, "PL3N": 1
#         }},
#         # ทำ bin ตาม step_sec
#         {"$addFields": {
#             "bin": {
#                 "$toDate": {
#                     "$subtract": [
#                         {"$toLong": "$_dt"},
#                         {"$mod": [{"$toLong": "$_dt"}, step_sec * 1000]}
#                     ]
#                 }
#             }
#         }},
#         # คำนวณค่าเฉลี่ยราย bin
#         {"$group": {
#             "_id": "$bin",
#             "VL1N": {"$avg": "$VL1N"},
#             "VL2N": {"$avg": "$VL2N"},
#             "VL3N": {"$avg": "$VL3N"},
#             "I1": {"$avg": "$I1"},
#             "I2": {"$avg": "$I2"},
#             "I3": {"$avg": "$I3"},
#             "PL1N": {"$avg": "$PL1N"},
#             "PL2N": {"$avg": "$PL2N"},
#             "PL3N": {"$avg": "$PL3N"},
#         }},
#         {"$sort": {"_id": 1}},
#         {"$limit": limit},
#         # คืนค่า timestamp เป็น ISO และ (ถ้าจำเป็น) map ชื่อกลับเป็น L1/L2/L3 ให้ frontend เดิมใช้ต่อได้
#         {"$project": {
#             "t": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%SZ", "date": "$_id"}},
#             "L1": "$VL1N",
#             "L2": "$VL2N",
#             "L3": "$VL3N",
#             "I1": "$I1",
#             "I2": "$I2",
#             "I3": "$I3",
#             "W1": "$PL1N",
#             "W2": "$PL2N",
#             "W3": "$PL3N",
#             "_id": 0
#         }},
#     ]

#     cursor = MDB_collection.aggregate(pipeline, allowDiskUse=True, maxTimeMS=10000)
#     out = []
#     async for d in cursor:
#         out.append(d)
#     return out

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
# async def get_last_24h(request: Request) -> StreamingResponse:
#     headers = {
#         "Content-Type": "text/event-stream",
#         "Cache-Control": "no-cache",
#         "Connection": "keep-alive",
#         "X-Accel-Buffering": "no",  # กัน proxy buffering
#     }

#     return StreamingResponse(change_stream_generator(), headers=headers)

# @app.get("/MDB/history/last24")
# async def get_last_24h(
#     request: Request,
#     station_id: int = Query(...),
#     step_sec: int = Query(300, ge=5, le=3600),
#     limit: int = Query(20000, ge=1, le=200000),
# ) -> StreamingResponse:
#     """
#     ส่งข้อมูลย้อนหลัง 24 ชม. และอัปเดตข้อมูลทุก 1-3 วินาที
#     """
#     headers = {
#         "Content-Type": "text/event-stream",
#         "Cache-Control": "no-cache",
#         "Connection": "keep-alive",
#         "X-Accel-Buffering": "no",  # กัน proxy บัฟเฟอร์
#     }

#     async def event_generator():
#         # ---- ดึงข้อมูลย้อนหลัง 24 ชม. ----
#         end_dt = datetime.now(timezone.utc)
#         start_dt = end_dt - timedelta(hours=24)

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

#         # ส่งข้อมูลย้อนหลัง 24 ชม. (snapshot)
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

#             await asyncio.sleep(3)  # เช็กข้อมูลใหม่ทุก 3 วินาที

#     return StreamingResponse(event_generator(), headers=headers)
@app.get("/MDB/history/last24")
async def get_last_24h(
    request: Request,
    station_id: int = Query(...),
    step_sec: int = Query(300, ge=5, le=3600),
    limit: int = Query(20000, ge=1, le=200000),
) -> StreamingResponse:
    """
    ส่งข้อมูลตั้งแต่เที่ยงคืนของวันนี้ และอัปเดตข้อมูลทุก 1-3 วินาที
    """
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  # กัน proxy บัฟเฟอร์
    }

    async def event_generator():
        # ---- ดึงข้อมูลตั้งแต่เที่ยงคืนของวันนี้ ----
        end_dt = datetime.now(timezone.utc)
        # กำหนดเวลาเริ่มต้นเป็นเที่ยงคืนของวันนี้
        start_dt = datetime.combine(end_dt.date(), time.min, tzinfo=timezone.utc)

        start_iso = start_dt.isoformat().replace("+00:00", "Z")
        end_iso = end_dt.isoformat().replace("+00:00", "Z")

        pipeline = [
            {"$match": {
                "station_id": station_id,
                "Datetime": {"$gte": start_iso, "$lte": end_iso}
            }},
            {"$addFields": {
                "_dt": {"$dateFromString": {"dateString": "$Datetime"}}
            }},
            {"$project": {
                "_id": 0,
                "_dt": 1,
                "VL1N": 1, "VL2N": 1, "VL3N": 1, "I1": 1, "I2": 1, "I3": 1,
                "PL1N": 1, "PL2N": 1, "PL3N": 1
            }},
            {"$addFields": {
                "bin": {
                    "$toDate": {
                        "$subtract": [
                            {"$toLong": "$_dt"},
                            {"$mod": [{"$toLong": "$_dt"}, step_sec * 1000]}
                        ]
                    }
                }
            }},
            {"$group": {
                "_id": "$bin",
                "VL1N": {"$avg": "$VL1N"},
                "VL2N": {"$avg": "$VL2N"},
                "VL3N": {"$avg": "$VL3N"},
                "I1": {"$avg": "$I1"},
                "I2": {"$avg": "$I2"},
                "I3": {"$avg": "$I3"},
                "PL1N": {"$avg": "$PL1N"},
                "PL2N": {"$avg": "$PL2N"},
                "PL3N": {"$avg": "$PL3N"}
            }},
            {"$sort": {"_id": 1}},
            {"$limit": limit},
            {"$project": {
                "t": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%SZ", "date": "$_id"}},
                "L1": "$VL1N",
                "L2": "$VL2N",
                "L3": "$VL3N",
                "I1": "$I1",
                "I2": "$I2",
                "I3": "$I3",
                "W1": "$PL1N",
                "W2": "$PL2N",
                "W3": "$PL3N",
                "_id": 0
            }}
        ]

        # ส่งข้อมูลตั้งแต่เที่ยงคืนของวันนี้ (snapshot)
        cursor = MDB_collection.aggregate(pipeline, allowDiskUse=True, maxTimeMS=10000)
        sent_any = False
        async for d in cursor:
            sent_any = True
            yield f"data: {json.dumps(d)}\n\n"

        # เช็กข้อมูลใหม่ทุก 1–3 วินาที
        last_time = end_dt
        while True:
            if await request.is_disconnected():
                break

                
            # ดึงข้อมูลที่มี timestamp ล่าสุดกว่าที่เราเคยส่งไป
            # q = {
            #     "station_id": station_id,
            #     "Datetime": {"$gt": last_time.isoformat().replace("+00:00", "Z")}
            # }
            if isinstance(last_time, str):
                last_time = datetime.fromisoformat(last_time)

            q = {
                "station_id": station_id,
                "Datetime": {"$gt": last_time.isoformat().replace("+00:00", "Z")}
            }

            cursor = MDB_collection.find(
                q,
                sort=[("Datetime", 1)],
                limit=500,
                projection={"_id": 1, "Datetime": 1, "VL1N": 1, "VL2N": 1, "VL3N": 1, "I1": 1, "I2": 1, "I3": 1, "PL1N": 1, "PL2N": 1, "PL3N": 1}
            )

            sent_any = False
            async for doc in cursor:
                last_time = doc["Datetime"]
                payload = {
                    "t": last_time,
                    "L1": to_float(doc.get("VL1N")),
                    "L2": to_float(doc.get("VL2N")),
                    "L3": to_float(doc.get("VL3N")),
                    "I1": to_float(doc.get("I1")),
                    "I2": to_float(doc.get("I2")),
                    "I3": to_float(doc.get("I3")),
                    "W1": to_float(doc.get("PL1N")),
                    "W2": to_float(doc.get("PL2N")),
                    "W3": to_float(doc.get("PL3N"))
                }
                yield f"data: {json.dumps(payload)}\n\n"
                sent_any = True

            # ถ้าไม่มีข้อมูลใหม่ก็ส่ง keep-alive
            if not sent_any:
                yield ": keep-alive\n\n"

            await asyncio.sleep(300)  # เช็กข้อมูลใหม่ทุก 3 วินาที

    return StreamingResponse(event_generator(), headers=headers)

def floor_bin(dt: datetime, step_sec: int) -> datetime:
    epoch_ms = int(dt.timestamp() * 1000)
    bin_ms = epoch_ms - (epoch_ms % (step_sec * 1000))
    return datetime.fromtimestamp(bin_ms / 1000, tz=timezone.utc)



def to_json(doc):
    doc = dict(doc)
    doc["_id"] = str(doc["_id"])
    return json.dumps(doc, default=str)

@app.get("/MDB/stream")
async def mdb_stream(
    request: Request,
    station_id: int = Query(...),
    step_sec: int = Query(60, ge=5, le=3600),
):
    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    async def event_generator():
        # ส่งค่าให้ client รู้ว่าจะ reconnect ในกี่ ms ถ้าหลุด
        yield "retry: 3000\n\n"

        q = {"station_id": station_id}
        last_iso = None  # Datetime ล่าสุดที่ได้ส่งไปแล้ว

        # ส่ง snapshot ล่าสุดทันที
        latest = await MDB_collection.find_one(q, sort=[("Datetime", -1)])
        if latest:
            last_iso = latest.get("Datetime")
            yield f"event: init\ndata: {to_json(latest)}\n\n"
        else:
            yield ": keep-alive\n\n"

        while True:
            if await request.is_disconnected():
                break

            # ดึงเฉพาะเอกสารที่ Datetime > last_iso
            mq = {"station_id": station_id}
            if last_iso:
                mq["Datetime"] = {"$gt": last_iso}

            cursor = MDB_collection.find(mq).sort("Datetime", 1).limit(500)
            sent_any = False
            async for d in cursor:
                last_iso = d["Datetime"]
                # map เป็น payloadที่กราฟคุณรอ (เช่น L1/L2/L3)
                payload = {
                    "t": last_iso,                # ISO จาก DB (UTC)
                    "L1": float(d.get("VL1N", 0)),
                    "L2": float(d.get("VL2N", 0)),
                    "L3": float(d.get("VL3N", 0)),
                    "I1": float(d.get("I1", 0)),
                    "I2": float(d.get("I2", 0)),
                    "I3": float(d.get("I3", 0)),
                    "W1": float(d.get("PL1N", 0)),
                    "W2": float(d.get("PL2N", 0)),
                    "W3": float(d.get("PL3N", 0)),
                }
                yield f"data: {json.dumps(payload)}\n\n"
                sent_any = True

            if not sent_any:
                yield ": keep-alive\n\n"

            await asyncio.sleep(2)  # ← ปรับเป็น 1–3 วิ ตามความถี่ที่ต้องการ

    return StreamingResponse(event_generator(), headers=headers)