from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import mqtt_client, BROKER_HOST, BROKER_PORT, errorDB, client
import asyncio


# ===== Background Email Watcher =====
email_watcher_task = None


async def email_watcher():
    """Background task: เช็ค fault ใหม่ทุก 30 วิ แล้วส่ง email ตาม rules"""
    from routers.notifications import (
        parse_fault_message, _get_timestamp,
        _determine_type_from_message, send_email_smtp,
    )
    from bson import ObjectId

    last_ids = {}
    sn_cache = {}

    print("[email-watcher] ✅ Started")

    while True:
        try:
            collection_names = await errorDB.list_collection_names()
            collection_names = [c for c in collection_names if not c.startswith("system.")]

            for sn in collection_names:
                try:
                    coll = errorDB[sn]
                    latest = await coll.find_one({}, sort=[("_id", -1)])

                    if not latest or latest.get("_id") == last_ids.get(sn):
                        continue

                    last_ids[sn] = latest.get("_id")

                    # ★ Lookup SN → station info (ใช้ cache)
                    if sn not in sn_cache:
                        charger = await client["iMPS"]["charger"].find_one({"SN": sn})
                        if charger:
                            sid = charger.get("station_id", "")
                            station = await client["iMPS"]["stations"].find_one({"station_id": sid})
                            sn_cache[sn] = {
                                "station_id": sid,
                                "station_name": station.get("station_name", sid) if station else sid,
                                "chargebox_id": charger.get("chargeBoxID", ""),
                                "charger_no": charger.get("chargerNo"),
                                "sn": sn,
                            }
                        else:
                            sn_cache[sn] = {"sn": sn}

                    station_info = sn_cache[sn]
                    raw_message = latest.get("message") or latest.get("error") or ""
                    parsed = parse_fault_message(raw_message)

                    notification = {
                        "station_id": station_info.get("station_id", sn),
                        "station_name": station_info.get("station_name") or parsed.get("source") or sn,
                        "chargebox_id": station_info.get("chargebox_id", ""),
                        "sn": sn,
                        "error": parsed.get("error") or raw_message,
                        "head": parsed.get("head", ""),
                        "timestamp": _get_timestamp(latest),
                        "type": _determine_type_from_message(raw_message),
                    }

                    # ★ เช็ค rules แล้วส่ง email
                    await _send_email_for_notification(notification, send_email_smtp)

                except Exception as e:
                    print(f"[email-watcher] Error for {sn}: {e}")

        except Exception as e:
            print(f"[email-watcher] Loop error: {e}")

        await asyncio.sleep(1)


async def _send_email_for_notification(notification: dict, send_email_smtp):
    """เช็ค rules แล้วส่ง email — ไม่ต้องมี request"""
    from bson import ObjectId

    try:
        rules_coll = client["iMPS"]["email_notification_rules"]
        users_coll = client["iMPS"]["users"]

        station_id = notification.get("station_id", "")
        sn = notification.get("sn", "")
        chargebox_id = notification.get("chargebox_id", "")
        notif_type = notification.get("type", "error")

        if not station_id:
            return

        rules = await rules_coll.find({
            "station_id": station_id,
            "enabled": True,
            "notify_types": notif_type,
        }).to_list(length=100)

        if not rules:
            return

        for rule in rules:
            rule_cb = rule.get("chargebox_id", "all")
            if rule_cb != "all" and rule_cb != chargebox_id and rule_cb != sn:
                continue

            user_ids = rule.get("user_ids", [])
            if not user_ids:
                continue

            user_oids = []
            for uid in user_ids:
                try:
                    user_oids.append(ObjectId(uid))
                except Exception:
                    continue

            users = await users_coll.find(
                {"_id": {"$in": user_oids}}, {"email": 1}
            ).to_list(length=200)

            emails = [u["email"] for u in users if u.get("email")]
            if not emails:
                continue

            station_name = notification.get("station_name", station_id)
            head = notification.get("head", "")
            error_msg = notification.get("error", "New notification")

            subject = f"[{station_name}] {notif_type.upper()}: {error_msg}"
            body = f"Station: {station_name}\nSN: {sn}\n"
            if head:
                body += f"Head: {head}\n"
            # if chargebox_id:
            #     body += f"ChargeBox ID: {chargebox_id}\n"
            body += f"Type: {notif_type}\nMessage: {error_msg}\nTime: {notification.get('timestamp', '-')}\n"

            await send_email_smtp(to=emails, subject=subject, body=body)

    except Exception as e:
        print(f"[email-watcher] Send error: {e}")


# ===== Lifespan (ตัวเดียว — รวม MQTT + errorDB + email watcher) =====
async def lifespan(app: FastAPI):
    global email_watcher_task

    # ★ set app.state ให้ notifications router ใช้ได้
    app.state.errorDB = errorDB
    app.state.mongo_client = client

    # ★ MQTT
    mqtt_client.connect_async(BROKER_HOST, BROKER_PORT, keepalive=60)
    mqtt_client.loop_start()

    # ★ Start email watcher
    email_watcher_task = asyncio.create_task(email_watcher())

    try:
        yield
    finally:
        # Stop email watcher
        if email_watcher_task:
            email_watcher_task.cancel()
            print("[shutdown] Email watcher stopped")
        try:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
        except Exception as e:
            print(f"[MQTT] disconnect error: {e}")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "https://203.154.130.132:3000",
        "https://203.154.130.132:3001",
        "https://imps.egatdiamond.co.th",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["ETag"],
    max_age=86400,
)


# ─── Static Files ─────────────────────────────────────────────
import os
from starlette.staticfiles import StaticFiles

UPLOADS_ROOT = os.getenv("UPLOADS_ROOT", "./uploads")
os.makedirs(UPLOADS_ROOT, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_ROOT, html=False), name="uploads")

from config import client1  # re-export for pdf_routes1.py

# ─── PDF Routes ───────────────────────────────────────────────
try:
    from pdf import pdf_routes1
    app.include_router(pdf_routes1.router)
except ImportError as e:
    import traceback
    print(f"⚠️  PDF routes not loaded: {e}")
    traceback.print_exc()
except Exception as e:
    import traceback
    print(f"⚠️  PDF routes error: {e}")
    traceback.print_exc()

# ─── Include Routers ──────────────────────────────────────────
from routers.users import router as users_router
from routers.stations import router as stations_router
from routers.mdb import router as mdb_router
from routers.device import router as device_router
from routers.setting import router as setting_router
from routers.cbm import router as cbm_router
from routers.ai import router as ai_router
from routers.cmreport import router as cmreport_router
from routers.pmreport_charger import router as pmreport_charger_router
from routers.pmreport_mdb import router as pmreport_mdb_router
from routers.pmreport_ccb import router as pmreport_ccb_router
from routers.pmreport_cbbox import router as pmreport_cbbox_router
from routers.pmreport_station import router as pmreport_station_router
from routers.testreport_dc import router as testreport_dc_router
from routers.testreport_ac import router as testreport_ac_router
from routers.notifications import router as notifications_router

app.include_router(users_router)
app.include_router(stations_router)
app.include_router(mdb_router)
app.include_router(device_router)
app.include_router(setting_router)
app.include_router(cbm_router)
app.include_router(ai_router)
app.include_router(cmreport_router)
app.include_router(pmreport_charger_router)
app.include_router(pmreport_mdb_router)
app.include_router(pmreport_ccb_router)
app.include_router(pmreport_cbbox_router)
app.include_router(pmreport_station_router)
app.include_router(testreport_dc_router)
app.include_router(testreport_ac_router)
app.include_router(notifications_router)