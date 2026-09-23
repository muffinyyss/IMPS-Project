"""
ซ่อมรูป HEIC ที่ถูกอัปขึ้นไปก่อนหน้านี้ ให้กลับมาเปิดดูได้

ก่อนแก้บั๊ก (ดู image_convert.py) ไฟล์จาก iPhone ที่อัปเข้ามาจะค้างอยู่ 2 แบบ:

  1. ฟอร์ม PM / test report — router เปลี่ยนนามสกุลเป็น .jpg เสมอ แต่แปลงไบต์ไม่ได้
     ไฟล์บนดิสก์จึงเป็น "ไบต์ HEIC ในชื่อ .jpg" → เปิดไม่ขึ้นทั้งบนเว็บและใน PDF
     เคสนี้แปลงไบต์ทับที่เดิมได้เลย ชื่อไฟล์/URL ไม่เปลี่ยน ไม่ต้องแตะ MongoDB

  2. ฟอร์ม CM — เก็บไฟล์ดิบชื่อ .heic → ต้องเขียนเป็น .jpg แล้วตามไปแก้ URL ใน
     MongoDB ด้วย ไม่งั้นหน้าเว็บยังชี้ไปไฟล์เดิมที่ถูกลบไปแล้ว

วิธีใช้ (ดูอย่างเดียวก่อน แล้วค่อยลงมือ):

    python scripts/fix_heic_uploads.py --dry-run
    python scripts/fix_heic_uploads.py

ตัวเลือก:
    --uploads-root PATH   ระบุโฟลเดอร์ uploads เอง (ปกติอ่านจาก env UPLOADS_ROOT)
    --mongo-uri URI       ระบุ MongoDB เอง (ปกติอ่านจาก env MONGO_URI)
    --no-db               แปลงไฟล์อย่างเดียว ไม่แตะ MongoDB
    --keep-backup         เก็บไฟล์ HEIC เดิมไว้เป็น <ชื่อเดิม>.heic-orig

รันซ้ำได้ ไฟล์ที่แปลงแล้วจะไม่เข้าเงื่อนไขอีก (magic bytes ไม่ใช่ HEIC แล้ว)
"""
from __future__ import annotations

import argparse
import os
import pathlib
import sys

# ให้ import image_convert จาก backend/ ได้ตอนรันสคริปต์จากที่ไหนก็ได้
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from image_convert import HEIF_SUPPORTED, normalize_image_bytes, sniff_image_kind  # noqa: E402

# prefix แรกใน /uploads/<prefix>/... → ชื่อ MongoDB ที่เก็บ url ของไฟล์นั้น
# (ดู url_path ใน routers/*.py)
DB_BY_PREFIX = {
    "pm": "PMReport",
    "mdbpm": "MDBPMReport",
    "ccbpm": "CCBPMReport",
    "cbboxpm": "CBBOXPMReport",
    "stationpm": "stationPMReport",
    "cm": "CMReport",
    "dctest": "DCTestReport",
    "actest": "ACTestReport",
}


def _rewrite(node, old: str, new: str):
    """แทนที่สตริง url เดิมด้วยของใหม่ทั่วทั้งเอกสาร (คืน True ถ้ามีการแก้)"""
    changed = False
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, str):
                if v == old:
                    node[k] = new
                    changed = True
                elif k == "filename" and v == old.rsplit("/", 1)[-1]:
                    node[k] = new.rsplit("/", 1)[-1]
                    changed = True
            elif _rewrite(v, old, new):
                changed = True
    elif isinstance(node, list):
        for v in node:
            if _rewrite(v, old, new):
                changed = True
    return changed


def main() -> int:
    ap = argparse.ArgumentParser(description="แปลงไฟล์ HEIC ที่ค้างอยู่ใน uploads/ ให้เป็น JPEG")
    ap.add_argument("--uploads-root", default=os.getenv("UPLOADS_ROOT", "./uploads"))
    ap.add_argument("--mongo-uri", default=os.getenv("MONGO_URI", "mongodb://localhost:27017/"))
    ap.add_argument("--dry-run", action="store_true", help="แสดงรายการที่จะแก้ แต่ยังไม่เขียนจริง")
    ap.add_argument("--no-db", action="store_true", help="ไม่ต้องอัปเดต URL ใน MongoDB")
    ap.add_argument("--keep-backup", action="store_true", help="เก็บไฟล์ HEIC เดิมไว้")
    args = ap.parse_args()

    if not HEIF_SUPPORTED:
        print("ERROR: ไม่มี pillow-heif — ติดตั้งก่อนด้วย  pip install pillow-heif", file=sys.stderr)
        return 2

    root = pathlib.Path(args.uploads_root).resolve()
    if not root.is_dir():
        print(f"ERROR: ไม่พบโฟลเดอร์ {root}", file=sys.stderr)
        return 2

    db_client = None
    if not args.no_db and not args.dry_run:
        from pymongo import MongoClient

        db_client = MongoClient(args.mongo_uri)

    scanned = converted = renamed = failed = 0

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        scanned += 1
        try:
            with open(path, "rb") as fh:
                head = fh.read(16)
        except OSError as e:
            print(f"  ! อ่านไม่ได้: {path} ({e})")
            failed += 1
            continue

        if sniff_image_kind(head) not in ("heic", "avif"):
            continue

        rel = path.relative_to(root).as_posix()
        print(f"พบ HEIC: /uploads/{rel}")

        if args.dry_run:
            converted += 1
            continue

        try:
            data = path.read_bytes()
            out, _ext = normalize_image_bytes(data, path.name, max_width=1920, quality=85)
        except Exception as e:
            print(f"  ! แปลงไม่สำเร็จ: {e}")
            failed += 1
            continue

        if path.suffix.lower() in (".jpg", ".jpeg"):
            # ชื่อถูกอยู่แล้ว (เคส PM) — เขียนทับได้เลย URL ใน DB ไม่ต้องแก้
            if args.keep_backup:
                path.with_suffix(path.suffix + ".heic-orig").write_bytes(data)
            path.write_bytes(out)
            converted += 1
            print("  → เขียนทับเป็น JPEG แล้ว (ชื่อไฟล์เดิม)")
            continue

        # เคส CM: ต้องเปลี่ยนนามสกุลเป็น .jpg แล้วตามไปแก้ URL ใน MongoDB
        new_path = path.with_suffix(".jpg")
        if new_path.exists():
            new_path = path.with_name(f"{path.stem}_converted.jpg")
        new_path.write_bytes(out)

        old_url = f"/uploads/{rel}"
        new_url = f"/uploads/{new_path.relative_to(root).as_posix()}"

        db_ok = args.no_db
        if db_client is not None:
            db_ok = _update_db(db_client, rel, old_url, new_url)

        if db_ok:
            if args.keep_backup:
                path.rename(path.with_suffix(path.suffix + ".heic-orig"))
            else:
                path.unlink()
            renamed += 1
            converted += 1
            print(f"  → {new_url}")
        else:
            # อัปเดต DB ไม่สำเร็จ → อย่าลบไฟล์เดิม ไม่งั้นรูปหายถาวร
            new_path.unlink(missing_ok=True)
            failed += 1
            print("  ! อัปเดต URL ใน MongoDB ไม่สำเร็จ — คงไฟล์เดิมไว้ ยังไม่แก้")

    print(
        f"\nสแกน {scanned} ไฟล์ | แปลง {converted} | เปลี่ยนชื่อ+แก้ DB {renamed} | ล้มเหลว {failed}"
        + ("  (dry-run: ยังไม่เขียนอะไรลงดิสก์)" if args.dry_run else "")
    )
    return 1 if failed else 0


def _update_db(client, rel: str, old_url: str, new_url: str) -> bool:
    """หาเอกสารที่อ้าง url เดิมแล้วแก้เป็น url ใหม่ — คืน False ถ้าไม่เจอ/แก้ไม่ได้"""
    parts = rel.split("/")
    db_name = DB_BY_PREFIX.get(parts[0])
    if not db_name or len(parts) < 3:
        print(f"  ! ไม่รู้ว่า url นี้เก็บอยู่ DB ไหน: /uploads/{rel}")
        return False

    # /uploads/<prefix>/<identifier>/<report_id>/...  — identifier = sn หรือ station_id
    identifier = parts[1]
    db = client[db_name]
    coll = db[identifier]

    hit = False
    for doc in coll.find({}):
        body = {k: v for k, v in doc.items() if k != "_id"}
        if _rewrite(body, old_url, new_url):
            coll.update_one({"_id": doc["_id"]}, {"$set": body})
            hit = True
    if not hit:
        print(f"  ! ไม่พบเอกสารที่อ้าง {old_url} ใน {db_name}.{identifier}")
    return hit


if __name__ == "__main__":
    raise SystemExit(main())
