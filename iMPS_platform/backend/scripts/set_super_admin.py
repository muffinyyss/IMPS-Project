"""
ตั้ง role ของบัญชี super admin (thatsawan) → "super_admin" (รันครั้งเดียว)

ใช้กับ DB ตัวจริง:
    set MONGO_URI=mongodb://<user>:<pass>@<host>:27017/?authSource=admin
    python set_super_admin.py

หรือระบุ username อื่น:
    python set_super_admin.py someusername

super_admin ทำได้ทุกอย่างเหมือน admin (backend normalize เป็น admin) + สิทธิ์พิเศษ:
สลับ role ผ่าน dropdown, จัดการผู้ใช้, ลบข้อมูลถาวร
"""
import os
import sys

from pymongo import MongoClient

SUPER_ADMIN_ROLE = "super_admin"
DEFAULT_USERNAME = "thatsawan"


def main():
    username = (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_USERNAME).strip()
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    users = MongoClient(uri)["iMPS"]["users"]

    doc = users.find_one({"username": username}, {"_id": 1, "username": 1, "role": 1, "email": 1})
    if not doc:
        print(f"[!] ไม่พบผู้ใช้ username={username!r} ใน iMPS.users")
        sys.exit(1)

    print(f"[i] พบผู้ใช้: username={doc.get('username')} email={doc.get('email')} role เดิม={doc.get('role')!r}")
    if doc.get("role") == SUPER_ADMIN_ROLE:
        print("[=] role เป็น super_admin อยู่แล้ว ไม่ต้องทำอะไร")
        return

    res = users.update_one({"_id": doc["_id"]}, {"$set": {"role": SUPER_ADMIN_ROLE}})
    if res.modified_count == 1:
        print(f"[✓] อัปเดต role → {SUPER_ADMIN_ROLE} สำเร็จ (ต้อง login ใหม่เพื่อให้ JWT อัปเดต)")
    else:
        print("[!] อัปเดตไม่สำเร็จ (matched แต่ไม่ได้ modify?)")


if __name__ == "__main__":
    main()
