from fastapi import FastAPI,HTTPException,Depends

from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError,jwt
from datetime import datetime,timedelta, UTC
from passlib.hash import bcrypt

from pymongo import MongoClient
from pydantic import BaseModel
from bson.objectid import ObjectId
from fastapi.middleware.cors import CORSMiddleware
from pdf.pdf_routes import router as pdf_router
import bcrypt

SECRET_KEY = "supersecret"  # ใช้จริงควรเก็บเป็น env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

app = FastAPI()

client = MongoClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")
db = client["iMPS"]
users_collection = db["users"]
station_collection = db["stations"]
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
        {"$push": {"refreshTokens": {"token": refresh_token, "expiresAt": datetime.utcnow() + timedelta(days=1)}}}
    )

    return {
        "message": "Login success ✅",
        "access_token": access_token,
        "refresh_token": refresh_token
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # หรือ ["*"] ชั่วคราวเพื่อทดสอบ
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdf_router)

class LoginRequest(BaseModel):
    username: str
    password: str



# @app.post("/login/")
# async def login_user(data: LoginRequest):
#     user = users_collection.find_one({"username": data.username})

#     if not user or user["password"] != data.password:
#         raise HTTPException(status_code=401,detail="Invalid username or password")
    
#     return {"message": "Login success","username":user["username"]}

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
    stations = station_collection.find(query,{"_id":0,"name":1})
    return [station["name"] for station in stations]