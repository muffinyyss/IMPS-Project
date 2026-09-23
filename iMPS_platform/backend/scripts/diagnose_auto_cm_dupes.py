"""
วินิจฉัยใบงาน CM Auto ที่เปิดซ้ำ — อ่านอย่างเดียว ไม่แก้ข้อมูล

รัน:  python scripts/diagnose_auto_cm_dupes.py [--days 30]
ต้องมี MONGO_URI (โหลดจาก backend/.env ให้อัตโนมัติ)

รายงาน 3 ส่วน:
  A) ใบซ้ำ "เป๊ะ" — station+charger_sn+auto_trigger เดียวกัน createdAt ห่างกันไม่เกิน N นาที
  B) ใบซ้ำ "ตู้เดียวอาการเดียว" — station+charger_sn เดียวกัน เปิดพร้อมกันหลาย trigger_key
  C) collection ที่ชนกัน — FaultStatus/edgeboxStatus/monitorCBM ที่ map ไปเป็น SN เดียวกัน
"""
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# โหลด .env แบบง่าย ๆ (ไม่พึ่ง python-dotenv)
env_path = os.path.join(HERE, ".env")
if os.path.exists(env_path):
    with open(env_path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

URI = os.getenv("MONGO_URI")
if not URI:
    sys.exit("MONGO_URI not set")

DAYS = 30
NEAR_MIN = 10  # createdAt ห่างกันไม่เกินกี่นาที ถึงนับว่า "เปิดพร้อมกัน"
for i, a in enumerate(sys.argv):
    if a == "--days" and i + 1 < len(sys.argv):
        DAYS = int(sys.argv[i + 1])
    if a == "--near" and i + 1 < len(sys.argv):
        NEAR_MIN = int(sys.argv[i + 1])

cli = MongoClient(URI)
cm_db = cli["CMReport"]
since = datetime.now(timezone.utc) - timedelta(days=DAYS)

rows = []
for name in cm_db.list_collection_names():
    if name.startswith("system.") or name.startswith("_"):
        continue
    for d in cm_db[name].find(
        {"auto_generated": True},
        {"issue_id": 1, "doc_name": 1, "auto_trigger": 1, "charger_sn": 1,
         "status": 1, "stage": 1, "createdAt": 1, "found_date": 1, "found_time": 1},
    ):
        created = d.get("createdAt")
        if isinstance(created, datetime):
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if created < since:
                continue
        rows.append({
            "station": name,
            "sn": d.get("charger_sn") or "",
            "trigger": d.get("auto_trigger") or "",
            "status": d.get("status") or "",
            "stage": d.get("stage") or "",
            "issue_id": d.get("issue_id") or "",
            "doc_name": d.get("doc_name") or "",
            "created": created,
            "_id": d["_id"],
        })

print(f"=== auto CM ทั้งหมด {DAYS} วันล่าสุด: {len(rows)} ใบ ===\n")

# ── A) ซ้ำเป๊ะ ──
by_key = defaultdict(list)
for r in rows:
    by_key[(r["station"], r["sn"], r["trigger"])].append(r)

print(f"--- A) ใบซ้ำเป๊ะ (station+SN+auto_trigger เดียวกัน, createdAt ห่าง <= {NEAR_MIN} นาที) ---")
found_a = 0
for key, items in sorted(by_key.items()):
    items.sort(key=lambda x: x["created"] or datetime.min.replace(tzinfo=timezone.utc))
    burst = []
    for r in items:
        if burst and r["created"] and burst[-1]["created"] and \
                (r["created"] - burst[-1]["created"]) <= timedelta(minutes=NEAR_MIN):
            burst.append(r)
            continue
        if len(burst) > 1:
            found_a += 1
            print(f"  ⚠ {key[0]} / SN={key[1]} / {key[2]} → {len(burst)} ใบ")
            for b in burst:
                print(f"      {b['created']}  {b['issue_id']:<20} {b['doc_name']:<24} status={b['status']} ({b['_id']})")
        burst = [r]
    if len(burst) > 1:
        found_a += 1
        print(f"  ⚠ {key[0]} / SN={key[1]} / {key[2]} → {len(burst)} ใบ")
        for b in burst:
            print(f"      {b['created']}  {b['issue_id']:<20} {b['doc_name']:<24} status={b['status']} ({b['_id']})")
if not found_a:
    print("  (ไม่พบ)")

# ── A2) ซ้ำเป๊ะ ไม่จำกัดเวลา + ใบเดิมยังไม่ปิด ──
CLOSED = re.compile(r"^\s*(complete|completed|closed|close)\s*$", re.I)
print(f"\n--- A2) station+SN+trigger เดียวกัน ที่มีใบ 'ยังไม่ปิด' มากกว่า 1 ใบ ณ ตอนนี้ ---")
found_a2 = 0
for key, items in sorted(by_key.items()):
    openish = [r for r in items if not CLOSED.match(r["status"])]
    if len(openish) > 1:
        found_a2 += 1
        print(f"  ⚠ {key[0]} / SN={key[1]} / {key[2]} → {len(openish)} ใบที่ยังไม่ปิด")
        for b in sorted(openish, key=lambda x: x["created"] or datetime.min.replace(tzinfo=timezone.utc)):
            print(f"      {b['created']}  {b['issue_id']:<20} status={b['status']:<18} stage={b['stage']}")
if not found_a2:
    print("  (ไม่พบ)")

# ── B) ตู้เดียว อาการเดียว หลาย trigger_key ──
print(f"\n--- B) station+SN เดียวกัน เปิดหลาย trigger_key ภายใน {NEAR_MIN} นาที ---")
by_sn = defaultdict(list)
for r in rows:
    by_sn[(r["station"], r["sn"])].append(r)
found_b = 0
for key, items in sorted(by_sn.items()):
    items.sort(key=lambda x: x["created"] or datetime.min.replace(tzinfo=timezone.utc))
    burst = []
    def flush(bs):
        global found_b
        trigs = {b["trigger"] for b in bs}
        if len(bs) > 1 and len(trigs) > 1:
            found_b += 1
            print(f"  ⚠ {key[0]} / SN={key[1]} → {len(bs)} ใบ / {len(trigs)} trigger ที่ {bs[0]['created']}")
            for b in bs:
                print(f"      {b['created']}  {b['trigger']:<34} {b['issue_id']:<20} status={b['status']}")
    for r in items:
        if burst and r["created"] and burst[-1]["created"] and \
                (r["created"] - burst[-1]["created"]) <= timedelta(minutes=NEAR_MIN):
            burst.append(r)
            continue
        flush(burst)
        burst = [r]
    flush(burst)
if not found_b:
    print("  (ไม่พบ)")

# ── C) collection ที่ map เป็น SN เดียวกัน ──
print("\n--- C) collection ชนกัน (map ไป SN เดียวกัน) ---")
def sn_of_fault(c):
    return c[1:] if c.startswith("F") and len(c) > 1 else c

for db_name, mapper in (("FaultStatus", sn_of_fault),
                        ("edgeboxStatus", lambda c: c),
                        ("monitorCBM", lambda c: c)):
    names = [c for c in cli[db_name].list_collection_names() if not c.startswith("system.")]
    m = defaultdict(list)
    for c in names:
        m[mapper(c)].append(c)
    clash = {k: v for k, v in m.items() if len(v) > 1}
    print(f"  {db_name}: {len(names)} collection, ชนกัน {len(clash)} กลุ่ม")
    for k, v in clash.items():
        print(f"    ⚠ SN {k} ← {v}")

# ── D) สรุป trigger ที่ซ้ำบ่อยสุด ──
print("\n--- D) trigger ที่เปิดใบบ่อยสุด ---")
cnt = defaultdict(int)
for r in rows:
    cnt[r["trigger"]] += 1
for t, n in sorted(cnt.items(), key=lambda x: -x[1]):
    print(f"  {n:>5}  {t}")
