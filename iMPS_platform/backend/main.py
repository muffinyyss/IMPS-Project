from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config import errorDB, client
import asyncio

# ===== Auto CM Watcher =====
from routers.auto_cm_watcher import start_watcher, stop_watcher

# ===== Background Email Watcher =====
email_watcher_task = None


async def email_watcher():
    """Background task: เช็ค fault ใหม่ทุก 30 วิ แล้วส่ง email ตาม rules"""
    from routers.notifications import (
        parse_fault_message, _get_timestamp,
        send_email_smtp,
        _cleanup_old_counters, _increment_fault,
        _get_threshold, _reset_fault,
    )
    from bson import ObjectId

    last_ids: dict = {}
    sn_cache: dict = {}

    print("[email-watcher] ✅ Started")

    while True:
        try:
            collection_names = await errorDB.list_collection_names()
            collection_names = [c for c in collection_names if not c.startswith("system.")]

            for sn in collection_names:
                try:
                    coll = errorDB[sn]
                    latest = await coll.find_one({}, sort=[("_id", -1)])

                    if not latest:
                        continue

                    # ครั้งแรกที่เห็น SN → จำ ID ไว้ ไม่ส่ง
                    if sn not in last_ids:
                        last_ids[sn] = latest.get("_id")
                        continue

                    # ไม่มีอะไรใหม่
                    if latest.get("_id") == last_ids.get(sn):
                        continue

                    last_ids[sn] = latest.get("_id")

                    # Lookup station info (cache)
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
                    error_msg = parsed.get("error") or raw_message

                    # เช็ค threshold ก่อนส่ง
                    _cleanup_old_counters()
                    current_count = _increment_fault(sn, error_msg)
                    threshold = _get_threshold(error_msg)

                    if current_count < threshold:
                        print(f"[email-watcher] {current_count}/{threshold} SN={sn} — ยังไม่ส่ง")
                        continue

                    print(f"[email-watcher] threshold reached ({current_count}/{threshold}) SN={sn} → sending")
                    _reset_fault(sn, error_msg)

                    station_id = station_info.get("station_id", sn)
                    chargebox_id = station_info.get("chargebox_id", "")

                    # Query ครอบ "all" เสมอ
                    query_conditions = [{"station_id": "all"}]
                    if station_id:
                        query_conditions.append({"station_id": station_id})

                    rules_coll = client["iMPS"]["email_notification_rules"]
                    users_coll = client["iMPS"]["users"]

                    rules = await rules_coll.find({
                        "$or": query_conditions,
                        "enabled": True,
                    }).to_list(length=100)

                    if not rules:
                        print(f"[email-watcher] No rules for station={station_id or 'unknown'}, skip")
                        continue

                    # dedup recipients ข้าม rules ทั้งหมด
                    all_recipients: set[str] = set()

                    for rule in rules:
                        rule_cb = rule.get("chargebox_id", "all")
                        if rule_cb != "all" and rule_cb != chargebox_id and rule_cb != sn:
                            continue

                        user_oids = []
                        for uid in rule.get("user_ids", []):
                            try:
                                user_oids.append(ObjectId(uid))
                            except Exception:
                                continue

                        if not user_oids:
                            continue

                        users = await users_coll.find(
                            {"_id": {"$in": user_oids}}, {"email": 1}
                        ).to_list(length=200)

                        for u in users:
                            if u.get("email"):
                                all_recipients.add(u["email"])

                    if not all_recipients:
                        print(f"[email-watcher] No recipient emails found, skip")
                        continue

                    station_name = station_info.get("station_name") or parsed.get("source") or sn
                    head = parsed.get("head", "")

                    subject = f"[{station_name}] FAULT: {error_msg}"
                    body = f"Station: {station_name}\nSN: {sn}\n"
                    if head:
                        body += f"Head: {head}\n"
                    if chargebox_id:
                        body += f"ChargeBox ID: {chargebox_id}\n"
                    body += f"Message: {error_msg}\nTime: {_get_timestamp(latest) or '-'}\n"

                    await send_email_smtp(to=list(all_recipients), subject=subject, body=body)

                except Exception as e:
                    print(f"[email-watcher] Error for SN={sn}: {e}")
                    continue

        except Exception as e:
            print(f"[email-watcher] Loop error: {e}")

        await asyncio.sleep(30)


# ===== Lifespan =====
@asynccontextmanager
async def lifespan(app: FastAPI):
    global email_watcher_task

    app.state.errorDB = errorDB
    app.state.mongo_client = client

    email_watcher_task = asyncio.create_task(email_watcher())
    start_watcher()

    yield

    await stop_watcher()
    if email_watcher_task:
        email_watcher_task.cancel()
        try:
            await email_watcher_task
        except asyncio.CancelledError:
            pass
    print("[email-watcher] ■ Stopped")


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

from routers.pm_helpers import UPLOADS_ROOT
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