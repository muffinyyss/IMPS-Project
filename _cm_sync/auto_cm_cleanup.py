"""
ลบใบงาน CM Auto (auto_generated=True) ใน DB CMReport

  python3 auto_cm_cleanup.py                         # ดูอย่างเดียว (ค่าเริ่มต้น ไม่ลบ)
  python3 auto_cm_cleanup.py --status "Wait for approve"   # กรองตามสถานะ (ใส่ซ้ำได้)
  python3 auto_cm_cleanup.py --delete [--status ...]  # backup เป็นไฟล์ JSON แล้วค่อยลบ
  python3 auto_cm_cleanup.py --restore <ไฟล์ backup>  # คืนข้อมูลจาก backup

ต้องรันจากโฟลเดอร์ backend (อ่าน MONGO_URI จาก backend/.env)
"""
import os, sys, json
from collections import Counter
from datetime import datetime
from pymongo import MongoClient
from bson import json_util

env = os.path.join(os.getcwd(), ".env")
if os.path.exists(env):
    for line in open(env, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
uri = os.getenv("MONGO_URI") or sys.exit("ไม่พบ MONGO_URI — ต้องรันจากโฟลเดอร์ backend")
db = MongoClient(uri)["CMReport"]

a = sys.argv[1:]
statuses = [a[i + 1] for i, x in enumerate(a) if x == "--status"]

if "--restore" in a:
    path = a[a.index("--restore") + 1]
    docs = json_util.loads(open(path, encoding="utf-8").read())
    n = 0
    for coll, items in docs.items():
        for d in items:
            if not db[coll].find_one({"_id": d["_id"]}):
                db[coll].insert_one(d); n += 1
    sys.exit(print(f"คืนข้อมูลแล้ว {n} ใบ"))

q = {"auto_generated": True}
if statuses:
    q["status"] = {"$in": statuses}

found, by_status, by_coll, with_maximo = {}, Counter(), Counter(), 0
for c in db.list_collection_names():
    if c.startswith(("system.", "_")):
        continue
    docs = list(db[c].find(q))
    if docs:
        found[c] = docs
        by_coll[c] = len(docs)
        for d in docs:
            by_status[d.get("status")] += 1
            if d.get("maximo_ticket_id"):
                with_maximo += 1

total = sum(by_coll.values())
print(f"เงื่อนไข: {q}")
print(f"ใบ CM Auto ที่ตรงเงื่อนไข: {total} ใบ ใน {len(by_coll)} สถานี")
print("ตามสถานะ:", dict(by_status))
print(f"มีเลข Maximo SR แล้ว: {with_maximo} ใบ (ลบใน iMPS แล้ว SR ใน Maximo ยังอยู่)")
for c, n in by_coll.most_common():
    print(f"  {c}: {n}")

if "--delete" not in a:
    sys.exit(print("\n(โหมดดูอย่างเดียว — ยังไม่ได้ลบอะไร ใส่ --delete เพื่อลบจริง)"))
if total == 0:
    sys.exit(print("ไม่มีอะไรให้ลบ"))

bk = os.path.expanduser(f"~/auto_cm_backup_{datetime.now():%Y%m%d_%H%M%S}.json")
open(bk, "w", encoding="utf-8").write(json_util.dumps(found, ensure_ascii=False))
print(f"\nbackup {total} ใบไว้ที่ {bk}")
if input(f"พิมพ์ DELETE เพื่อยืนยันลบ {total} ใบ: ").strip() != "DELETE":
    sys.exit(print("ยกเลิก ไม่ได้ลบ"))
deleted = 0
for c, docs in found.items():
    deleted += db[c].delete_many({"_id": {"$in": [d["_id"] for d in docs]}}).deleted_count
print(f"ลบแล้ว {deleted} ใบ  (คืนได้ด้วย: python3 auto_cm_cleanup.py --restore {bk})")
