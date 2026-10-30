"""
ซิงก์สถานีจากไฟล์ "ข้อมูลสถานี" (Excel) เข้า iMPS.stations — ผูก Maximo location + พิกัด
และสร้างสถานีที่ยังไม่มีในระบบ (พร้อมตู้ชาร์จจาก Maximo)

ไฟล์ข้อมูล: scripts/station_master.csv (แปลงจาก Excel แล้ว จับคู่ Maximo ไว้ให้แล้ว ตรวจ/แก้ได้ก่อนรัน)
  คอลัมน์หลัก: excel_row, name_th, maximo_location, maximo_desc, station_name, latitude, longitude,
               charger1_brand..charger4_brand, charger1_power..charger4_power, note

ขั้นตอนต่อแถว
  1) หาสถานีเดิมในระบบ ตามลำดับ:
       stations.maximo_location (ตัด -EV… ออกก่อนเทียบ) → ตู้ชาร์จที่ maximo_location อยู่ใต้รหัสนี้
       → ชื่อ (station_name / maximo_desc / station_id เทียบกับชื่อไทย, ชื่อ Maximo, slug) แบบไม่สนช่องว่าง/ตัวพิมพ์
  2) เจอ 1 สถานี → เติม maximo_location / maximo_desc / latitude / longitude ที่ยังว่าง
       ค่าเดิมไม่ตรงกับไฟล์ = รายงานเป็น conflict ไม่แตะ (ใส่ --overwrite เพื่อทับ)
       ไม่แตะชื่อสถานี / owner / ตู้ชาร์จของสถานีเดิม
  3) ไม่เจอ → สร้างสถานีใหม่ แบบเดียวกับฟอร์ม Add Station (เลือกจาก Maximo):
       station_name = station_name ในไฟล์ (ชื่ออังกฤษจาก Maximo), station_id = slug ของชื่อ
       (ซ้ำ → ต่อท้ายด้วยรหัส Maximo), owner = --owner (ค่าตั้งต้น EGAT)
       ตู้ชาร์จ = location …-EV-BTLxxGUxxx ใต้สถานีนั้นใน Maximo (SN ว่าง ให้กรอกทีหลังในหน้าเว็บ)
       ยี่ห้อตู้เติมจาก Excel เมื่อจำนวนตู้ใน Excel เท่ากับใน Maximo
  4) เจอหลายสถานี / สถานีเดิมถูกจับคู่ซ้ำ → ข้าม รายงานให้แก้มือ

รัน (บน server, จาก iMPS_platform/backend):
    python scripts/sync_stations_from_excel.py scripts/station_master.csv             # dry-run
    python scripts/sync_stations_from_excel.py scripts/station_master.csv --apply     # เขียนจริง
ตัวเลือก
    --owner EGAT          username ของ owner สถานีใหม่
    --overwrite           ทับ maximo_location / พิกัด ที่มีค่าอยู่แล้วแต่ไม่ตรงกับไฟล์
    --no-create           ไม่สร้างสถานีใหม่ (อัปเดตอย่างเดียว)
    --no-chargers         สร้างสถานีใหม่โดยไม่สร้างตู้ชาร์จ
    --skip-unmapped       ไม่สร้างสถานีที่ไม่มีรหัส Maximo
    --maximo-csv FILE     ใช้ไฟล์ export ของ Maximo (location,description) แทนการเรียก Maximo จริง

MONGO_URI: อ่านจาก environment ก่อน ไม่มีจะอ่านจาก backend/.env
ทุกครั้งที่รันจะเขียนรายงาน <ไฟล์ข้อมูล>_report_<เวลา>.csv ไว้ข้างไฟล์ข้อมูล
"""
import argparse
import asyncio
import csv
import os
import pathlib
import re
import sys
from datetime import datetime, timezone

from pymongo import MongoClient

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
TH_LAT = (5.5, 20.5)
TH_LNG = (97.3, 105.7)
ROOT_RE = re.compile(r"^[A-Z]{3}\d{4}$")
CHARGER_LOC_RE = re.compile(r"-BTL\d+GU\d+$", re.IGNORECASE)
CHARGER_DESC_RE = re.compile(r"^(AC|DC)\s*Charger\s*([\d.]+)\s*kW", re.IGNORECASE)
ACTOR = "import:sync_stations_from_excel"


# ───────────────────────── helpers ─────────────────────────
def read_uri() -> str:
    uri = os.getenv("MONGO_URI")
    if uri:
        return uri
    env = BACKEND_DIR / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("MONGO_URI="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return "mongodb://localhost:27017/"


def load_backend_env():
    """ให้ services.maximo เห็นค่า MAXIMO_* จาก backend/.env (ไม่ทับค่าที่ตั้งไว้แล้ว)"""
    env = BACKEND_DIR / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def masked(uri: str) -> str:
    return re.sub(r"://[^@/]*@", "://***@", uri)


def key_norm(v) -> str:
    """เทียบชื่อแบบไม่สนช่องว่าง / ตัวพิมพ์ / _ / zero-width space"""
    return re.sub(r"[\s_​]+", "", str(v or "")).lower()


def slug(name: str) -> str:
    """เหมือน generateStationId() ในฟอร์ม Add Station"""
    s = re.sub(r"[^฀-๿A-Za-z0-9\s]", "", (name or "").strip())
    return re.sub(r"\s+", "_", s.strip())


def root_of(loc: str) -> str:
    """'PTG0001-EV-BTL01GU201' / 'PTG0001-EV' / 'PTG0001' → 'PTG0001'"""
    return (loc or "").strip().upper().split("-EV")[0]


def to_float(v):
    try:
        s = str(v).strip()
        return float(s) if s else None
    except ValueError:
        return None


def charger_name(loc: str) -> str:
    loc = (loc or "").strip()
    return loc.split("-EV-")[-1] if "-EV-" in loc else ""


def charger_order(loc: str):
    return ([int(n) for n in re.findall(r"\d+", charger_name(loc))], loc)


def same_coord(a, b) -> bool:
    return a is not None and b is not None and round(float(a), 7) == round(float(b), 7)


# ───────────────────────── Maximo ─────────────────────────
class MaximoSource:
    """description ของ station root + รายการตู้ชาร์จ จากไฟล์ export หรือ Maximo จริง"""

    def __init__(self, csv_path=None):
        self.csv_path = csv_path
        self.desc = {}
        self.chargers = {}
        self.label = ""

    def load(self, codes):
        codes = sorted({c for c in codes if c})
        if self.csv_path:
            self._load_csv(codes)
        else:
            self._load_live(codes)

    def _load_csv(self, codes):
        self.label = f"ไฟล์ {self.csv_path}"
        rows = {}
        with open(self.csv_path, encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f):
                loc = (r.get("location") or "").strip()
                if loc:
                    rows[loc] = (r.get("description") or "").strip()
        wanted = set(codes)
        for loc, d in rows.items():
            if loc in wanted:
                self.desc[loc] = d
            elif CHARGER_LOC_RE.search(loc) and root_of(loc) in wanted and loc.upper().startswith(root_of(loc) + "-EV-"):
                self.chargers.setdefault(root_of(loc), []).append({"location": loc, "description": d})

    def _load_live(self, codes):
        load_backend_env()
        sys.path.insert(0, str(BACKEND_DIR))
        from services import maximo as mx  # noqa: E402

        if not mx.MAXIMO_ENABLED:
            sys.exit("[!] MAXIMO_ENABLED=false — ใช้ --maximo-csv แทน")
        self.label = f"Maximo ({'DB iMPS.maximo_locations' if mx._USE_DB_SOURCE else mx.MAXIMO_BASE_URL})"

        async def run():
            for i in range(0, len(codes), 50):
                got = await mx.query_locations_by_codes(codes[i:i + 50])
                if got is None:
                    sys.exit("[!] ดึง location จาก Maximo ไม่สำเร็จ — ลองใหม่ หรือใช้ --maximo-csv")
                for m in got:
                    self.desc[(m.get("location") or "").strip()] = (m.get("description") or "").strip()
            for c in codes:
                if c not in self.desc:
                    continue
                got = await mx.query_charger_locations(c)
                if got is None:
                    sys.exit(f"[!] ดึงตู้ชาร์จของ {c} จาก Maximo ไม่สำเร็จ — ลองใหม่ หรือใช้ --maximo-csv")
                self.chargers[c] = got

        asyncio.run(run())


# ───────────────────────── main ─────────────────────────
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv_path")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--overwrite", action="store_true")
    ap.add_argument("--owner", default="EGAT")
    ap.add_argument("--no-create", action="store_true")
    ap.add_argument("--no-chargers", action="store_true")
    ap.add_argument("--skip-unmapped", action="store_true")
    ap.add_argument("--maximo-csv")
    args = ap.parse_args()

    with open(args.csv_path, encoding="utf-8-sig", newline="") as f:
        rows = [{k: (v or "").strip() for k, v in r.items()} for r in csv.DictReader(f)]
    if not rows:
        sys.exit("[!] ไฟล์ว่าง")

    uri = read_uri()
    print(f"[i] MongoDB: {masked(uri)}")
    db = MongoClient(uri, serverSelectionTimeoutMS=10000)["iMPS"]
    stations, chargers, users = db["stations"], db["charger"], db["users"]

    # ── Maximo ──
    mx = MaximoSource(args.maximo_csv)
    mx.load(r["maximo_location"] for r in rows)
    print(f"[i] Maximo จาก {mx.label}: พบ {len(mx.desc)} สถานี, ตู้ชาร์จ {sum(len(v) for v in mx.chargers.values())} ตู้")

    # ── index สถานีเดิม ──
    st_docs = list(stations.find({}, {"station_id": 1, "station_name": 1, "maximo_location": 1, "maximo_desc": 1,
                                       "latitude": 1, "longitude": 1}))
    by_id = {d["_id"]: d for d in st_docs}
    by_sid = {d.get("station_id"): d["_id"] for d in st_docs}
    by_code, by_name = {}, {}
    for d in st_docs:
        if d.get("maximo_location"):
            by_code.setdefault(root_of(d["maximo_location"]), set()).add(d["_id"])
        for fld in ("station_name", "maximo_desc", "station_id"):
            k = key_norm(d.get(fld))
            if k:
                by_name.setdefault(k, set()).add(d["_id"])
    for c in chargers.find({"maximo_location": {"$regex": "-EV-", "$options": "i"}}, {"station_id": 1, "maximo_location": 1}):
        oid = by_sid.get(c.get("station_id"))
        if oid:
            by_code.setdefault(root_of(c["maximo_location"]), set()).add(oid)
    codes_of = {}  # _id สถานีเดิม → รหัส Maximo ที่ผูกอยู่ (จากสถานีเองและจากตู้ชาร์จ)
    for c, ids in by_code.items():
        for oid in ids:
            codes_of.setdefault(oid, set()).add(c)
    master_codes = {r["maximo_location"].upper() for r in rows if r.get("maximo_location")}
    print(f"[i] สถานีในระบบตอนนี้ {len(st_docs)} สถานี")

    # ── owner ──
    owner_oid, owner_name = None, args.owner
    u = users.find_one({"username": args.owner}, {"_id": 1, "username": 1}) or users.find_one(
        {"username": {"$regex": f"^{re.escape(args.owner)}$", "$options": "i"}}, {"_id": 1, "username": 1})
    if u:
        owner_oid, owner_name = u["_id"], u.get("username", args.owner)
        print(f"[i] owner สถานีใหม่: {owner_name} ({owner_oid})")
    else:
        print(f"[!] ไม่พบ user '{args.owner}' — สถานีใหม่จะเก็บแค่ชื่อ owner ไม่ผูก user_id (เหมือนฟอร์มเมื่อพิมพ์ owner ใหม่)")

    used_sids = set(by_sid)
    claimed = {}           # _id สถานีเดิม → excel_row ที่จับคู่ไปแล้ว
    report, updates, creates = [], [], []

    for r in rows:
        row_no = r.get("excel_row", "")
        code = r.get("maximo_location", "").upper()
        live_desc = mx.desc.get(code, "")
        if code and not live_desc:
            note = "ไม่พบรหัสนี้ใน Maximo"
        else:
            note = ""
        lat, lng = to_float(r.get("latitude")), to_float(r.get("longitude"))
        if lat is not None and lng is not None and not (TH_LAT[0] <= lat <= TH_LAT[1] and TH_LNG[0] <= lng <= TH_LNG[1]):
            if TH_LAT[0] <= lng <= TH_LAT[1] and TH_LNG[0] <= lat <= TH_LNG[1]:
                lat, lng = lng, lat
            else:
                note = "; ".join(x for x in [note, f"พิกัดนอกประเทศไทย ({lat}, {lng}) — ไม่ใช้"] if x)
                lat = lng = None
        maximo_desc = live_desc or r.get("maximo_desc", "")
        rep = {"excel_row": row_no, "name_th": r.get("name_th"), "maximo_location": code, "maximo_desc": maximo_desc,
               "action": "", "station_id": "", "changes": "", "note": "; ".join(x for x in [r.get("note", ""), note] if x)}

        # 1) หาสถานีเดิม
        found = set(by_code.get(code, set())) if code else set()
        how = "maximo_location" if found else ""
        if not found:
            for k in {key_norm(r.get("name_th")), key_norm(maximo_desc), key_norm(r.get("station_name")),
                      key_norm(slug(r.get("station_name", "")))} - {""}:
                found |= by_name.get(k, set())
            # ชื่อตรงแต่สถานีนั้นผูกกับรหัส Maximo ของแถวอื่นในไฟล์อยู่แล้ว (เช่น "PTG Tak" มี 2 รหัส) = คนละสถานี
            found = {oid for oid in found if not (codes_of.get(oid, set()) & (master_codes - {code}))}
            how = "ชื่อ" if found else ""

        if len(found) > 1:
            rep.update(action="SKIP_AMBIGUOUS", station_id=", ".join(sorted(by_id[i]["station_id"] for i in found)),
                       changes=f"เจอ {len(found)} สถานีจาก{how} — ต้องแก้มือ")
            report.append(rep)
            continue

        if found:
            oid = next(iter(found))
            d = by_id[oid]
            rep["station_id"] = d.get("station_id")
            if oid in claimed:
                rep.update(action="SKIP_DUPLICATE", changes=f"สถานีนี้ถูกจับคู่กับแถว {claimed[oid]} ไปแล้ว")
                report.append(rep)
                continue
            claimed[oid] = row_no
            sets, conflicts = {}, []
            cur_root = root_of(d.get("maximo_location"))
            if code:
                if not cur_root:
                    sets["maximo_location"] = code
                    if maximo_desc:
                        sets["maximo_desc"] = maximo_desc
                elif cur_root != code:
                    conflicts.append(f"maximo_location เดิม {d.get('maximo_location')} ≠ {code}")
                    if args.overwrite:
                        sets["maximo_location"] = code
                        sets["maximo_desc"] = maximo_desc
                elif not (d.get("maximo_desc") or "").strip() and maximo_desc:
                    sets["maximo_desc"] = maximo_desc
            if lat is not None:
                if d.get("latitude") is None:
                    sets.update(latitude=round(lat, 7), longitude=round(lng, 7))
                elif not (same_coord(d.get("latitude"), lat) and same_coord(d.get("longitude"), lng)):
                    conflicts.append(f"พิกัดเดิม ({d.get('latitude')}, {d.get('longitude')}) ≠ ({round(lat, 7)}, {round(lng, 7)})")
                    if args.overwrite:
                        sets.update(latitude=round(lat, 7), longitude=round(lng, 7))
            changes = ", ".join(f"{k}={v}" for k, v in sets.items())
            if conflicts:
                changes = "; ".join(x for x in [changes, "CONFLICT: " + " | ".join(conflicts) + ("" if args.overwrite else " (ไม่ทับ)")] if x)
            rep.update(action=("UPDATE" if sets else ("CONFLICT" if conflicts else "NO_CHANGE")) + f" (จับคู่จาก{how})",
                       changes=changes)
            if sets:
                updates.append((oid, sets))
            report.append(rep)
            continue

        # 2) สร้างใหม่
        if args.no_create:
            rep.update(action="SKIP_NOT_FOUND", changes="ไม่พบในระบบ (--no-create)")
            report.append(rep)
            continue
        if (not code or not live_desc) and args.skip_unmapped:
            rep.update(action="SKIP_UNMAPPED", changes="ไม่มีรหัส Maximo (--skip-unmapped)")
            report.append(rep)
            continue
        name = r.get("station_name") or maximo_desc or r.get("name_th")
        sid = slug(name) or f"STATION_{code or row_no}"
        if sid in used_sids:
            sid = f"{sid}_{code or row_no}"
        if sid in used_sids:
            rep.update(action="SKIP_ID_TAKEN", station_id=sid, changes="station_id ซ้ำ — ต้องแก้มือ")
            report.append(rep)
            continue
        used_sids.add(sid)
        st_doc = {
            "station_id": sid, "station_name": name, "user_id": owner_oid, "username": owner_name,
            "is_active": True, "maximo_location": code if live_desc else "", "maximo_desc": maximo_desc if live_desc else "",
            "warranty_status": "", "investment_scope": [], "io_code": "",
            "latitude": round(lat, 7) if lat is not None else None,
            "longitude": round(lng, 7) if lng is not None else None,
            "images": {},
        }
        ch_docs = []
        if not args.no_chargers and live_desc:
            mlist = sorted(mx.chargers.get(code, []), key=lambda m: charger_order(m["location"]))
            excel = [(r.get(f"charger{k}_brand", ""), r.get(f"charger{k}_power", "")) for k in range(1, 5)]
            excel = [e for e in excel if e[0] or e[1]]
            use_excel = len(excel) == len(mlist)
            brand_skipped = 0
            for i, m in enumerate(mlist):
                desc = (m.get("description") or "").strip()
                mm = CHARGER_DESC_RE.match(desc)
                ex_brand, ex_power = excel[i] if use_excel else ("", "")
                ex_kw = re.sub(r"(?i)\s*kw$", "", ex_power).strip()
                # เติมยี่ห้อจาก Excel เฉพาะเมื่อกำลังไฟตรงกับ Maximo (กันใส่ยี่ห้อผิดตู้)
                if ex_brand and mm and ex_kw and to_float(ex_kw) != to_float(mm.group(2)):
                    ex_brand = ""
                    brand_skipped += 1
                power = mm.group(2) if mm else ex_kw
                ch_docs.append({
                    "station_id": sid, "chargeBoxID": "", "chargerNo": i + 1,
                    "charger_name": charger_name(m["location"]),
                    "brand": ex_brand, "manufacturer": "", "vendor": "", "model": "", "SN": "", "WO": "",
                    "power": power, "PLCFirmware": "", "PIFirmware": "", "RTFirmware": "",
                    "commissioningDate": None, "warrantyYears": 1, "numberOfCables": 1, "is_active": True,
                    "maximo_location": m["location"], "maximo_desc": desc, "ocppUrl": "",
                    "chargerType": mm.group(1).upper() if mm else "DC", "images": {},
                })
            if brand_skipped:
                rep["note"] = "; ".join(x for x in [rep["note"], f"กำลังไฟใน Excel ไม่ตรง Maximo {brand_skipped} ตู้ — ไม่เติมยี่ห้อตู้นั้น"] if x)
            if mlist and not use_excel and excel:
                rep["note"] = "; ".join(x for x in [rep["note"], f"ตู้ใน Excel {len(excel)} ตู้ ≠ Maximo {len(mlist)} ตู้ — ไม่เติมยี่ห้อ"] if x)
        rep.update(action="CREATE", station_id=sid,
                   changes=f"station_name={name}; ตู้ชาร์จ {len(ch_docs)} ตู้"
                           + ("" if st_doc["latitude"] is not None else "; ไม่มีพิกัด")
                           + ("" if st_doc["maximo_location"] else "; ไม่มี Maximo"))
        creates.append((st_doc, ch_docs))
        report.append(rep)

    # ── สรุป ──
    for rep in report:
        print(f"[{rep['action']}] แถว {rep['excel_row']} {rep['name_th']} → {rep['station_id'] or '-'}"
              f"  {rep['changes']}" + (f"  ⚠ {rep['note']}" if rep['note'] else ""))
    counts = {}
    for rep in report:
        a = rep["action"].split(" ")[0]
        counts[a] = counts.get(a, 0) + 1
    print("\n[i] สรุป: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    print(f"[i] จะอัปเดต {len(updates)} สถานี, สร้างใหม่ {len(creates)} สถานี / ตู้ชาร์จ {sum(len(c) for _, c in creates)} ตู้")

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    rpath = pathlib.Path(args.csv_path).with_name(f"{pathlib.Path(args.csv_path).stem}_report_{stamp}{'' if args.apply else '_dryrun'}.csv")
    with open(rpath, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(report[0].keys()))
        w.writeheader()
        w.writerows(report)
    print(f"[i] รายงาน: {rpath}")

    if not args.apply:
        print("[i] dry-run — ยังไม่เขียนอะไรลง DB  ตรวจรายงานแล้วรันซ้ำด้วย --apply")
        return

    now = datetime.now(timezone.utc)
    actor = ACTOR
    n_up = 0
    for oid, sets in updates:
        sets = dict(sets, updatedAt=now, updatedBy=ACTOR)
        n_up += stations.update_one({"_id": oid}, {"$set": sets}).modified_count
    n_st = n_ch = 0
    for st_doc, ch_docs in creates:
        if stations.find_one({"station_id": st_doc["station_id"]}, {"_id": 1}):
            print(f"[!] ข้าม {st_doc['station_id']}: มีอยู่แล้ว (ถูกสร้างระหว่างรัน)")
            continue
        stations.insert_one(dict(st_doc, createdAt=now, createdBy=actor))
        n_st += 1
        if ch_docs:
            chargers.insert_many([dict(c, createdAt=now, createdBy=actor) for c in ch_docs])
            n_ch += len(ch_docs)
    print(f"[✓] อัปเดต {n_up} สถานี, สร้างสถานี {n_st} สถานี, ตู้ชาร์จ {n_ch} ตู้")


if __name__ == "__main__":
    main()
