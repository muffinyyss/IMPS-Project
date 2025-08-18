from fastapi import FastAPI
from pymongo import MongoClient
from pydantic import BaseModel
from bson.objectid import ObjectId

app = FastAPI()

client = MongoClient("mongodb://localhost:27017")
db = client["iMPS"]
usersCollection = db["users"]
MDBCollection = db["MDB"]

@app.get("/")
def getUsers():
    users = list(usersCollection.find({},{"_id":0}))
    user_sets = {}
    for i,user in enumerate(users,start=1):
        user_sets[f"user{i}"] = user 
    return user_sets
# def getMDB():
#     MDB = list(MDBCollection.find({},{"_id":0}))
    

