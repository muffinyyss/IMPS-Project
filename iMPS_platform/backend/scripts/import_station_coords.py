"""
นำเข้าพิกัด (latitude / longitude) ของสถานีจากไฟล์ CSV เข้า iMPS.stations (สำหรับหน้าแผนที่)

ไฟล์ CSV ต้องมี
  - คอลัมน์ระบุสถานี อย่างน้อย 1 อัน: station_id / maximo_location (Location) / station_name (ชื่อสถานี)
  - พิกัด: แยก 2 คอลัมน์ (lat + lng / ละติจูด + ลองจิจูด)
           หรือคอลัมน์เดียวแบบ "13.7563, 100.5018" (พิกัด / coordinates / lat,long)
ชื่อหัวคอลัมน์ไม่ต้องตรงเป๊ะ สคริปต์เดาให้ — หรือระบุเองด้วย --key-col / --lat-col / --lng-col / --coord-col

    set MONGO_URI=mongodb://<user>:<pass>@<host>:27017/?authSource=admin
    python import_station_coords.py stations.csv              # dry-run — แสดงผลการจับคู่อย่างเดียว
    python import_station_coords.py stations.csv --apply      # เขียนจริง
    python import_station_coords.py stations.csv --overwrite  # ทับพิกัดเดิมที่มีอยู่แล้วด้วย (ปกติข้าม)

พิกัดที่อยู่นอกประเทศไทยจะถูกข้าม (มักเป็นการสลับ lat/lng หรือพิมพ์ผิด) — ถ้าสลับกันชัดเจนจะสลับคืนให้
"""
import argparse
import csv
import os
import re
import sys

from pymongo import MongoClient

TH_LAT = (5.5, 20.5)
TH_LNG = (97.3, 105.7)

KEY_CANDIDATES = {
    "station_id": ["station_id", "stationid", "รหัสสถานี", "station id"],
    "maximo_location": ["maximo_location", "location", "maximo location", "maximo"],
    "station_name": ["station_name", "ชื่อสถานี", "สถานี", "station name", "station", "name", "maximo_desc", "description"],
}
LAT_CANDIDATES = ["latitude", "lat", "ละติจูด", "ละติจูต"]
LNG_CANDIDATES = ["longitude", "lng", "long", "lon", "ลองจิจูด", "ลองติจูด"]
COORD_CANDIDATES = ["gps", "พิกัด", "coordinates", "coordinate", "coords", "lat,long", "lat,lng", "latlong", "latlng", "gps", "location gps", "google map"]

NUM_PAIR = re.compile(r"(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)")


def norm(h: str) -> str:
    return re.sub(r"\s+", " ", (h or "").replace("﻿", "")).strip().lower()


def find_col(headers, candidates):
    nh = {norm(h): h for h in headers}
    for c in candidates:
        if c in nh:
            return nh[c]
    for c in candidates:  # contains
        for k, h in nh.items():
            if c in k:
                return h
    return None


def to_float(v):
    try:
        s = str(v).strip().replace(" ", "")
        return float(s) if s else None
    except ValueError:
        return None


def in_th(lat, lng):
    return TH_LAT[0] <= lat <= TH_LAT[1] and TH_LNG[0] <= lng <= TH_LNG[1]


def key_norm(v):
    # ไม่สนช่องว่าง/ตัวพิมพ์ — ชื่อสถานีใน Excel กับในระบบมักเว้นวรรคไม่ตรงกัน
    return re.sub(r"\s+", "", str(v or "")).lower()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--overwrite", action="store_true", help="ทับพิกัดที่มีอยู่แล้ว")
    ap.add_argument("--key-col"); ap.add_argument("--key-field", choices=list(KEY_CANDIDATES))
    ap.add_argument("--lat-col"); ap.add_argument("--lng-col"); ap.add_argument("--coord-col")
    args = ap.parse_args()

    with open(args.csv_path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        sys.exit("[!] CSV ว่าง")
    headers = list(rows[0].keys())

    # ── คอลัมน์ระบุสถานี ──
    key_col, key_field = args.key_col, args.key_field
    if not key_col:
        for field, cands in KEY_CANDIDATES.items():
            col = find_col(headers, cands)
            if col:
                key_col, key_field = col, field
                break
    if not key_col:
        sys.exit(f"[!] หาคอลัมน์ระบุสถานีไม่เจอ — ระบุด้วย --key-col  (หัวคอลัมน์: {headers})")
    key_field = key_field or "station_name"

    # ── คอลัมน์พิกัด ──
    lat_col = args.lat_col or (None if args.coord_col else find_col(headers, LAT_CANDIDATES))
    lng_col = args.lng_col or (None if args.coord_col else find_col(headers, LNG_CANDIDATES))
    coord_col = args.coord_col or (None if (lat_col and lng_col) else find_col(headers, COORD_CANDIDATES))
    if not ((lat_col and lng_col) or coord_col):
        sys.exit(f"[!] หาคอลัมน์พิกัดไม่เจอ — ระบุด้วย --lat-col/--lng-col หรือ --coord-col  (หัวคอลัมน์: {headers})")

    print(f"[i] จับคู่ด้วย '{key_col}' → stations.{key_field}")
    print(f"[i] พิกัดจาก " + (f"'{lat_col}' + '{lng_col}'" if lat_col and lng_col else f"'{coord_col}'"))

    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    stations = MongoClient(uri)["iMPS"]["stations"]
    index = {}
    for d in stations.find({}, {"station_id": 1, "station_name": 1, "maximo_location": 1, "maximo_desc": 1,
                                "latitude": 1, "longitude": 1}):
        fields = [key_field] + (["maximo_desc"] if key_field == "station_name" else [])
        for fld in fields:
            k = key_norm(d.get(fld))
            if k:
                index.setdefault(k, []).append(d)

    updates, skipped = [], []
    for i, r in enumerate(rows, start=2):
        key = key_norm(r.get(key_col))
        if not key:
            continue
        if lat_col and lng_col:
            lat, lng = to_float(r.get(lat_col)), to_float(r.get(lng_col))
        else:
            m = NUM_PAIR.search(str(r.get(coord_col) or ""))
            lat, lng = (float(m.group(1)), float(m.group(2))) if m else (None, None)
        if lat is None or lng is None:
            skipped.append((i, key, "ไม่มีพิกัด"))
            continue
        if not in_th(lat, lng):
            if in_th(lng, lat):
                print(f"[~] แถว {i} {key}: lat/lng สลับกัน → สลับคืน")
                lat, lng = lng, lat
            else:
                skipped.append((i, key, f"พิกัดอยู่นอกประเทศไทย ({lat}, {lng})"))
                continue
        docs = {str(d["_id"]): d for d in index.get(key, [])}
        if not docs:
            skipped.append((i, key, "ไม่พบสถานีในระบบ"))
            continue
        if len(docs) > 1:
            skipped.append((i, key, f"ชื่อซ้ำ {len(docs)} สถานี — ต้องแก้มือ"))
            continue
        d = next(iter(docs.values()))
        if d.get("latitude") is not None and not args.overwrite:
            if (round(float(d["latitude"]), 7), round(float(d["longitude"]), 7)) != (round(lat, 7), round(lng, 7)):
                skipped.append((i, key, f"มีพิกัดอยู่แล้ว ({d['latitude']}, {d['longitude']}) — ใช้ --overwrite เพื่อทับ"))
            continue
        updates.append((d, round(lat, 7), round(lng, 7)))

    for d, lat, lng in updates:
        print(f"[+] {d.get('station_id')} {d.get('station_name')}: {lat}, {lng}")
    for i, key, why in skipped:
        print(f"[!] ข้ามแถว {i} '{key}': {why}")
    no_coord = stations.count_documents({"$or": [{"latitude": None}, {"latitude": {"$exists": False}}]})
    print(f"\n[i] จะอัปเดต {len(updates)} สถานี, ข้าม {len(skipped)} แถว (ตอนนี้ในระบบยังไม่มีพิกัด {no_coord} สถานี)")

    if not args.apply:
        print("[i] dry-run — รันซ้ำด้วย --apply เพื่อเขียนจริง")
        return
    n = 0
    for d, lat, lng in updates:
        n += stations.update_one({"_id": d["_id"]}, {"$set": {"latitude": lat, "longitude": lng}}).modified_count
    print(f"[✓] เขียนพิกัดแล้ว {n} สถานี")


if __name__ == "__main__":
    main()
