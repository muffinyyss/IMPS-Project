from fastapi import FastAPI,HTTPException
from pymongo import MongoClient
from pydantic import BaseModel
from bson.objectid import ObjectId
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI()

client = MongoClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")
db = client["iMPS"]
users_collection = db["users"]
station_collection = db["stations"]
# @app.get("/")
# async def homepage():
#     return {"message": "Helloo World"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # หรือ ["*"] ชั่วคราวเพื่อทดสอบ
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/login/")
async def login_user(data: LoginRequest):
    user = users_collection.find_one({"username": data.username})

    if not user or user["password"] != data.password:
        raise HTTPException(status_code=401,detail="Invalid username or password")
    
    return {"message": "Login success","username":user["username"]}

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

#create
@app.post("/insert_users/")
async def create_users(users: users):
    result = users_collection.insert_one(users.dict())
    return {
        "id": str(result.inserted_id),
        "username" : users.username,
        "email":users.email
    }

@app.get("/stations/")
async def get_stations(q:str = ""):
    """ค้นหาสถานนี"""
    query = {"name":{"$regex":  q, "$options": "i"}} if q else {}
    stations = station_collection.find(query,{"_id":0,"name":1})
    return [station["name"] for station in stations]