"""
แปลง email ของ user เดิมใน iMPS.users ให้เป็นตัวพิมพ์เล็กทั้งหมด (รันครั้งเดียว)

จำเป็นหลังแก้ backend ให้ normalize email ทุกจุด (login / forgot-password /
reset-password / add_users / insert_users / user_update): user ที่ถูกสร้างไว้ก่อนหน้า
และมีตัวใหญ่ค้างใน DB จะ login ไม่ได้ เพราะฝั่ง query lower แล้วแต่ค่าใน DB ยังไม่ lower

    set MONGO_URI=mongodb://<user>:<pass>@<host>:27017/?authSource=admin
    python normalize_user_emails.py          # dry-run — แค่แสดงว่าจะแก้อะไรบ้าง
    python normalize_user_emails.py --apply  # เขียนจริง
"""
import os
import sys

from pymongo import MongoClient


def main():
    apply_changes = "--apply" in sys.argv[1:]
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    users = MongoClient(uri)["iMPS"]["users"]

    docs = list(users.find({}, {"_id": 1, "username": 1, "email": 1}))
    targets = []
    for d in docs:
        email = d.get("email")
        if isinstance(email, str) and email != email.strip().lower():
            targets.append((d, email.strip().lower()))

    if not targets:
        print(f"[=] ตรวจ {len(docs)} บัญชี — email เป็นตัวพิมพ์เล็กครบแล้ว ไม่ต้องแก้")
        return

    # กันชนกัน: ถ้า lower แล้วไปซ้ำกับบัญชีอื่น ต้องให้คนตัดสินใจเอง (unique index จะ reject อยู่แล้ว)
    existing = {d["email"] for d in docs if isinstance(d.get("email"), str)}
    conflicts = []
    safe = []
    for d, new_email in targets:
        if new_email in existing or sum(1 for _, e in targets if e == new_email) > 1:
            conflicts.append((d, new_email))
        else:
            safe.append((d, new_email))

    for d, new_email in safe:
        print(f"[~] {d.get('username')}: {d['email']} → {new_email}")
    for d, new_email in conflicts:
        print(f"[!] ข้าม {d.get('username')}: {d['email']} → {new_email} (ซ้ำกับบัญชีอื่น — ต้องแก้มือ)")

    if not apply_changes:
        print(f"\n[i] dry-run: จะแก้ {len(safe)} บัญชี, ข้าม {len(conflicts)} บัญชี")
        print("[i] รันซ้ำด้วย --apply เพื่อเขียนจริง")
        return

    updated = 0
    for d, new_email in safe:
        res = users.update_one({"_id": d["_id"]}, {"$set": {"email": new_email}})
        updated += res.modified_count
    print(f"\n[✓] อัปเดต {updated} บัญชี (ข้าม {len(conflicts)} บัญชีที่ชนกัน)")
    if conflicts:
        print("[!] บัญชีที่ชนกันยัง login ไม่ได้จนกว่าจะรวม/ลบตัวซ้ำด้วยมือ")


if __name__ == "__main__":
    main()
