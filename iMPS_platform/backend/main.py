from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import mqtt_client, BROKER_HOST, BROKER_PORT

async def lifespan(app: FastAPI):
    mqtt_client.connect_async(BROKER_HOST, BROKER_PORT, keepalive=60)
    mqtt_client.loop_start()
    try:
        yield
    finally:
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