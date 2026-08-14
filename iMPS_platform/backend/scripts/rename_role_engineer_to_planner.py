"""
เปลี่ยนชื่อ role "engineer" → "planner" ใน iMPS.users (รันครั้งเดียว)

โค้ดฝั่ง backend/frontend ใช้ชื่อ "planner" หมดแล้ว และมี canonical_role() ใน config.py
คอย map "engineer" → "planner" ให้ user เก่าที่ยังไม่ถูก migrate ยังใช้งานได้ต่อ
สคริปต์นี้แก้ค่าใน DB ให้ตรงกับโค้ด เพื่อให้เลิกพึ่ง alias ได้ในอนาคต

    set MONGO_URI=mongodb://<user>:<pass>@<host>:27017/?authSource=admin
    python rename_role_engineer_to_planner.py          # dry-run — แค่แสดงว่าจะแก้อะไรบ้าง
    python rename_role_engineer_to_planner.py --apply  # เขียนจริง

หมายเหตุ: JWT ที่ออกไปแล้วยังถือ role เดิมได้ถึง 24 ชม. แต่ deps.get_current_user()
normalize ให้แล้ว จึงไม่ต้องบังคับให้ทุกคน login ใหม่
"""
import os
import sys

from pymongo import MongoClient

OLD_ROLE = "engineer"
NEW_ROLE = "planner"


def main():
    apply_changes = "--apply" in sys.argv[1:]
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    users = MongoClient(uri)["iMPS"]["users"]

    # role ใน DB อาจมีตัวใหญ่ปน (Engineer / ENGINEER) — จับให้ครบด้วย regex ไม่สนตัวพิมพ์
    query = {"role": {"$regex": f"^{OLD_ROLE}$", "$options": "i"}}
    docs = list(users.find(query, {"_id": 1, "username": 1, "email": 1, "role": 1}))

    if not docs:
        print(f"[=] ไม่พบบัญชีที่ role = {OLD_ROLE} — ไม่ต้องแก้")
        return

    for d in docs:
        print(f"[~] {d.get('username') or d.get('email')}: {d.get('role')} → {NEW_ROLE}")

    if not apply_changes:
        print(f"\n[i] dry-run: จะแก้ {len(docs)} บัญชี")
        print("[i] รันซ้ำด้วย --apply เพื่อเขียนจริง")
        return

    res = users.update_many(query, {"$set": {"role": NEW_ROLE}})
    print(f"\n[✓] อัปเดต {res.modified_count} บัญชี → role = {NEW_ROLE}")


if __name__ == "__main__":
    main()
