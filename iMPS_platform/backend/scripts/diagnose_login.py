"""
วินิจฉัยว่าทำไม /login/ ของ account หนึ่งถึง 500 (หน้า HTML → frontend "Unexpected token '<'").

ใช้กับ DB ตัวจริง:
    set MONGO_URI=mongodb://<user>:<pass>@<host>:27017/?authSource=admin
    python diagnose_login.py thanakron.m@evolt.co.th

จะรายงาน: มี document ซ้ำ email ไหม, password เป็น bcrypt ที่ใช้ได้ไหม, station_id เป็นชนิดอะไร
(ObjectId/ชนิดที่ไม่ใช่ string ทำให้ jwt.encode พังตอน login)
"""
import os
import re
import sys

from pymongo import MongoClient

BCRYPT_RE = re.compile(r"^\$2[aby]\$\d{2}\$.{53}$")


def main():
    email = (sys.argv[1] if len(sys.argv) > 1 else "").strip().lower()
    if not email:
        print("usage: python diagnose_login.py <email>")
        sys.exit(1)

    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    users = MongoClient(uri)["iMPS"]["users"]

    # ค้นแบบ case-insensitive เผื่อ email ถูกเก็บต่างตัวพิมพ์
    docs = list(users.find({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}))
    print(f"MONGO_URI target : {uri.split('@')[-1]}")
    print(f"email            : {email}")
    print(f"documents found  : {len(docs)}", "  ⚠️ ซ้ำ! login จะอ่านตัวแรกเสมอ" if len(docs) > 1 else "")
    print("-" * 60)

    for i, d in enumerate(docs, 1):
        pw = d.get("password")
        if not isinstance(pw, str):
            pw_status = f"❌ ชนิด {type(pw).__name__} (ไม่ใช่ string) → bcrypt.checkpw พัง"
        elif BCRYPT_RE.match(pw):
            pw_status = "✅ bcrypt ใช้ได้"
        else:
            pw_status = f"❌ ไม่ใช่ bcrypt (len={len(pw)}, prefix={pw[:7]!r}) → ValueError: Invalid salt"

        sid = d.get("station_id")
        sid_types = sorted({type(x).__name__ for x in sid}) if isinstance(sid, list) else type(sid).__name__
        sid_bad = isinstance(sid, list) and any(not isinstance(x, str) for x in sid)
        sid_status = "❌ มีชนิดที่ไม่ใช่ string (เช่น ObjectId) → jwt.encode พัง" if sid_bad else "✅ ok"

        print(f"[doc #{i}] _id={d.get('_id')}")
        print(f"  role       : {d.get('role')}")
        print(f"  password   : {pw_status}")
        print(f"  station_id : {sid!r}")
        print(f"               types={sid_types}  {sid_status}")
        print("-" * 60)

    if not docs:
        print("ไม่พบ user ตาม email นี้ (ลองเช็คตัวพิมพ์/ช่องว่าง)")


if __name__ == "__main__":
    main()
