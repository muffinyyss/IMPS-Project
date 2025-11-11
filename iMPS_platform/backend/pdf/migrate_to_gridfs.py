# migrate_to_gridfs.py
from pymongo import MongoClient
from gridfs import GridFSBucket
from bson import ObjectId
from pathlib import Path
import os, json

MONGO_URI = "mongodb://localhost:27017"
DB_NAME   = "PMReport"           # db ของ template charger
PUBLIC    = r"D:/.../iMPS_platform/public"   # โฟลเดอร์ที่มี uploads
STATION   = "Klongluang3"        # คอลเล็กชัน
BUCKET    = "pm_photos"          # ชื่อ bucket ที่จะใช้

cli = MongoClient(MONGO_URI)
db  = cli[DB_NAME]
fs  = GridFSBucket(db, bucket_name=BUCKET)
coll = db[STATION]

for doc in coll.find({"photos": {"$exists": True}}):
    changed = False
    for gk, arr in (doc["photos"] or {}).items():
        for item in arr or []:
            if item.get("gridfs_id"):   # ข้ามถ้าเคยย้ายแล้ว
                continue
            url = (item.get("url") or "").lstrip("/")
            p = Path(PUBLIC) / url
            if p.exists():
                with open(p, "rb") as f:
                    fid = fs.upload_from_stream(item.get("filename") or p.name, f)
                item["gridfs_id"] = fid    # <<< เก็บ id กลับที่เอกสาร
                changed = True
    if changed:
        coll.update_one({"_id": doc["_id"]}, {"$set": {"photos": doc["photos"]}})
print("done")
