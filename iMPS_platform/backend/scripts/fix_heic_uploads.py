"""
ซ่อมรูป HEIC ที่ถูกอัปขึ้นไปก่อนหน้านี้ ให้กลับมาเปิดดูได้

ก่อนแก้บั๊ก (ดู image_convert.py) ไฟล์จาก iPhone ที่อัปเข้ามาจะค้างอยู่ 2 แบบ:

  1. ฟอร์ม PM / test report — router เปลี่ยนนามสกุลเป็น .jpg เสมอ แต่แปลงไบต์ไม่ได้
     ไฟล์บนดิสก์จึงเป็น "ไบต์ HEIC ในชื่อ .jpg" → เปิดไม่ขึ้นทั้งบนเว็บและใน PDF
     เคสนี้แปลงไบต์ทับที่เดิมได้เลย ชื่อไฟล์/URL ไม่เปลี่ยน ไม่ต้องแตะ MongoDB

  2. ฟอร์ม CM — เก็บไฟล์ดิบชื่อ .heic → ต้องเขียนเป็น .jpg แล้วตามไปแก้ URL ใน
     MongoDB ด้วย ไม่งั้นหน้าเว็บยังชี้ไปไฟล์เดิมที่ถูกลบไปแล้ว

วิธีใช้ — รันจาก backend/ (ดูอย่างเดียวก่อน แล้วค่อยลงมือ):

    python3 scripts/fix_heic_uploads.py --dry-run
    python3 scripts/fix_heic_uploads.py

หมายเหตุ: เซิร์ฟเวอร์ dev (Ubuntu, Python 3.10) ไม่มี alias `python` มีแต่ `python3`
ส่วนเครื่อง dev Windows ใช้ `python` ได้ตามปกติ

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
BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# โหลด backend/.env ให้เหมือนที่ config.py ทำ — ไม่งั้นสคริปต์จะไปใช้ค่า default
# (uploads ที่ ./uploads ของ cwd และ mongo ที่ localhost) ซึ่ง "ไม่ error แต่ผิดที่"
# แล้วรายงานว่าไม่เจอไฟล์/ไม่เจอเอกสาร ทั้งที่จริงยังไม่ได้ซ่อมอะไรเลย
try:
    from dotenv import load_dotenv

    load_dotenv(BACKEND_DIR / ".env")
except Exception:
    pass

from image_convert import HEIF_SUPPORTED, normalize_image_bytes, sniff_image_kind  # noqa: E402

# prefix แรกใน /uploads/<prefix>/... → ชื่อ MongoDB ที่เก็บ url ของไฟล์นั้น
# (ดู url_path ใน routers/*.py)
#
# ไม่มี "stations" ในตารางนี้โดยตั้งใจ: routers/stations.py ตั้งชื่อไฟล์เองเป็น
# `{kind}-{uuid}.{jpg|png|webp}` เสมอ ไม่เคยเป็น .heic จึงเข้าเคส "เขียนทับที่เดิม"
# ตลอด ไม่ต้องแก้ URL ใน DB — ถ้าวันหนึ่งเจอ .heic ใต้ stations/ สคริปต์จะไม่แตะ
# แล้วฟ้องว่าไม่รู้ว่าเก็บ URL ไว้ที่ไหน (ปลอดภัยกว่าเดาแล้วลบไฟล์ทิ้ง)
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
    # เทียบ path จาก backend/ ไม่ใช่ cwd — ค่า UPLOADS_ROOT ใน .env เป็น "./uploads"
    # ซึ่งแอปตีความจาก backend/ ตอนรัน uvicorn ถ้าสคริปต์ตีจาก cwd จะไปคนละที่
    ap.add_argument("--uploads-root", default=os.getenv("UPLOADS_ROOT", "./uploads"))
    # ไม่ใส่ default localhost — ถ้าไม่มี MONGO_URI ต้องฟ้อง ไม่ใช่ไปต่อ DB ว่าง
    # แล้วรายงานว่า "ไม่พบเอกสารที่อ้าง url นี้" ซึ่งอ่านแล้วเข้าใจผิดว่าข้อมูลหาย
    ap.add_argument("--mongo-uri", default=os.getenv("MONGO_URI"))
    ap.add_argument("--dry-run", action="store_true", help="แสดงรายการที่จะแก้ แต่ยังไม่เขียนจริง")
    ap.add_argument("--no-db", action="store_true",
                    help="ไม่แตะ MongoDB — แปลงเฉพาะไฟล์ที่ไม่ต้องเปลี่ยนนามสกุล "
                         "ไฟล์ .heic ที่ต้องแก้ URL ด้วยจะถูกข้าม")
    ap.add_argument("--keep-backup", action="store_true", help="เก็บไฟล์ HEIC เดิมไว้")
    args = ap.parse_args()

    if not HEIF_SUPPORTED:
        print("ERROR: ไม่มี pillow-heif — ติดตั้งก่อนด้วย  pip install pillow-heif", file=sys.stderr)
        return 2

    root = pathlib.Path(args.uploads_root)
    if not root.is_absolute():
        root = (BACKEND_DIR / root).resolve()
    root = root.resolve()
    if not root.is_dir():
        print(f"ERROR: ไม่พบโฟลเดอร์ {root}", file=sys.stderr)
        print("       ระบุเองด้วย --uploads-root /path/to/uploads", file=sys.stderr)
        return 2
    print(f"uploads: {root}")

    db_client = None
    if not args.no_db and not args.dry_run:
        if not args.mongo_uri:
            print("ERROR: ไม่มี MONGO_URI (ทั้งใน backend/.env และ environment)", file=sys.stderr)
            print("       ใส่เองด้วย --mongo-uri ... หรือถ้าจะแปลงไฟล์อย่างเดียวใช้ --no-db",
                  file=sys.stderr)
            return 2
        from pymongo import MongoClient

        db_client = MongoClient(args.mongo_uri, serverSelectionTimeoutMS=10000)
        try:
            db_client.admin.command("ping")
        except Exception as e:
            print(f"ERROR: ต่อ MongoDB ไม่ได้: {e}", file=sys.stderr)
            return 2
        print(f"mongo:   {args.mongo_uri.split('@')[-1]}")

    scanned = converted = renamed = failed = skipped = 0

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        # ไฟล์สำรองจาก --keep-backup เป็นไบต์ HEIC อยู่แล้วโดยตั้งใจ ถ้าไม่ข้าม
        # การรันซ้ำจะไปเข้าเคส "เปลี่ยนนามสกุล" แล้วพยายามแก้ URL ใน Mongo ที่ไม่มีอยู่จริง
        if path.name.endswith(".heic-orig"):
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
        #
        # --no-db แปลว่า "ห้ามแตะ DB" จึงเปลี่ยนชื่อไฟล์ไม่ได้ด้วย — เปลี่ยนแล้วไม่ได้แก้ URL
        # ตาม รูปจะหายจากหน้าเว็บทันที ข้ามไปแล้วบอกให้รันใหม่โดยไม่ใส่ --no-db
        if args.no_db:
            print("  ! ข้าม: ไฟล์นี้ต้องเปลี่ยนนามสกุลและแก้ URL ใน MongoDB "
                  "แต่สั่ง --no-db ไว้ (รันใหม่โดยไม่ใส่ --no-db)")
            skipped += 1
            continue

        new_path = path.with_suffix(".jpg")
        if new_path.exists():
            new_path = path.with_name(f"{path.stem}_converted.jpg")
        new_path.write_bytes(out)

        old_url = f"/uploads/{rel}"
        new_url = f"/uploads/{new_path.relative_to(root).as_posix()}"

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
        f"\nสแกน {scanned} ไฟล์ | แปลง {converted} | เปลี่ยนชื่อ+แก้ DB {renamed}"
        + (f" | ข้าม {skipped}" if skipped else "")
        + f" | ล้มเหลว {failed}"
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
