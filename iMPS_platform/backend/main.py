from fastapi import FastAPI,HTTPException,Depends, status,Request
from fastapi.encoders import jsonable_encoder 
from fastapi.security import OAuth2PasswordRequestForm,OAuth2PasswordBearer
from jose import JWTError,jwt
from datetime import datetime,timedelta, UTC
from passlib.hash import bcrypt
from pymongo.errors import OperationFailure, PyMongoError
# from pymongo import MongoClient
from pydantic import BaseModel
from bson.objectid import ObjectId
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import json, os, asyncio
from pdf.pdf_routes import router as pdf_router
from fastapi.responses import StreamingResponse

import bcrypt

SECRET_KEY = "supersecret"  # ใช้จริงควรเก็บเป็น env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7


from pdf.pdf_routes import router as pdf_router

app = FastAPI()

# client = MongoClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")
client = AsyncIOMotorClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")

db = client["iMPS"]
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
    allow_origins=["http://localhost:3000"],  # หรือ ["*"] ชั่วคราวเพื่อทดสอบ
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
    