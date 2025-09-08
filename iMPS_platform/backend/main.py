from fastapi import FastAPI,HTTPException
from pymongo import MongoClient
from pydantic import BaseModel
from bson.objectid import ObjectId
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI()

client = MongoClient("mongodb://imps_platform:eds_imps@203.154.130.132:27017/")
db = client["iMPS"]
users_collection = db["users"]

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

@app.get("/")
async def users():
    users = users_collection.find()
    username = [user["username"] for user in users]
    if username:
        return {"username":username}
    else:
        raise HTTPException(status_code=404,detail="users not found")