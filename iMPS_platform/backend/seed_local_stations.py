"""
Seed local MongoDB with station + charger data for LOCAL DEV (server is down).

Builds station_collection + charger_collection from the real pipeline station
configs in ../../pipeline/config/stations/*.json, and attaches every station to
the local admin user (admin@local) so they show up in the dashboard.

Run:  python seed_local_stations.py
Re-runnable (idempotent upsert by station_id / SN).
"""
import os, glob, json
from datetime import datetime, timezone
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
STATIONS_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "pipeline", "config", "stations"
)
ADMIN_EMAIL = "admin@local"

# Nice display names for the known configs (fallback = "PT <stationId>")
NAME_MAP = {
    "Klongluang3": "PT คลองหลวง 3",
    "klongluang3": "PT คลองหลวง 3",
    "Amphawa1": "PT อัมพวา 1",
    "Ayuthaya3": "PT พระนครศรีอยุธยา 3",
    "Banbueng1": "PT บ้านบึง 1",
    "Banbueng9": "PT บ้านบึง 9",
    "Banbueng10": "PT บ้านบึง 10",
    "BangBuaThong4": "PT บางบัวทอง 4",
    "BangBuaThong9": "PT บางบัวทอง 9",
    "PaIn1": "PT บางปะอิน 1",
    "PEATest": "PEA Test Station",
}

BRANDS = ["FLEXXFAST", "SINIO", "STAR CHARGE"]


def main():
    c = MongoClient(MONGO_URI)
    db = c["iMPS"]
    users = db["users"]
    stations = db["stations"]
    chargers = db["charger"]

    admin = users.find_one({"email": ADMIN_EMAIL})
    if not admin:
        raise SystemExit(
            f"[seed] admin user {ADMIN_EMAIL} not found — seed the admin first."
        )
    admin_id = admin["_id"]
    now = datetime.now(timezone.utc)

    files = sorted(glob.glob(os.path.join(STATIONS_DIR, "*.json")))
    if not files:
        raise SystemExit(f"[seed] no station configs found in {STATIONS_DIR}")

    seeded_ids = []
    for i, path in enumerate(files):
        with open(path, encoding="utf-8") as f:
            cfg = json.load(f)

        sid = cfg.get("stationId") or os.path.splitext(os.path.basename(path))[0]
        sn = cfg.get("serialNumber") or f"LOCAL-SN-{sid}"
        name = NAME_MAP.get(sid, f"PT {sid}")
        hw = cfg.get("hardware", {})

        # ---- station doc ----
        stations.update_one(
            {"station_id": sid},
            {
                "$set": {
                    "station_id": sid,
                    "station_name": name,
                    "user_id": admin_id,
                    "username": "admin",
                    "owner": "admin",
                    "is_active": True,
                    "maximo_location": "",
                    "maximo_desc": "",
                    "images": {},
                    "updatedAt": now,
                    "updatedBy": "seed",
                },
                "$setOnInsert": {"createdAt": now, "createdBy": "seed"},
            },
            upsert=True,
        )

        # ---- charger doc (1 per station) ----
        pipeline_config = {
            "hardware": hw,
            "topics": cfg.get("topics", {}),
            "collections": cfg.get("collections", {}),
            "service_life": cfg.get("serviceLife", cfg.get("service_life", {})),
        }
        chargers.update_one(
            {"SN": sn},
            {
                "$set": {
                    "station_id": sid,
                    "SN": sn,
                    "chargeBoxID": sid,
                    "chargerNo": 1,
                    "brand": BRANDS[i % len(BRANDS)],
                    "model": "DC-150kW",
                    "power": "150",
                    "chargerType": "DC",
                    "PLCFirmware": "1.0.0",
                    "PIFirmware": "1.0.0",
                    "RTFirmware": "1.0.0",
                    "warrantyYears": 2,
                    "numberOfCables": 2,
                    "is_active": True,
                    "pipeline_config": pipeline_config,
                    "images": {},
                    "updatedAt": now,
                    "updatedBy": "seed",
                },
                "$setOnInsert": {"createdAt": now, "createdBy": "seed"},
            },
            upsert=True,
        )
        seeded_ids.append(sid)
        print(f"[seed] {sid:16s} -> station '{name}' + charger {sn}")

    # ---- attach all stations to admin user ----
    users.update_one(
        {"_id": admin_id},
        {"$addToSet": {"station_id": {"$each": seeded_ids}}},
    )

    print(f"\n[seed] done. {len(seeded_ids)} stations seeded and linked to {ADMIN_EMAIL}")
    print(f"[seed] stations total: {stations.count_documents({})}, "
          f"chargers total: {chargers.count_documents({})}")


if __name__ == "__main__":
    main()
