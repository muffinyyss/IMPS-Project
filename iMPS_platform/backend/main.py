from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config import errorDB, client

# ===== Auto CM Watcher =====
from routers.auto_cm_watcher import start_watcher, stop_watcher

# ===== Background Email Watcher (ยกเลิกแล้ว) =====
# เดิมส่งอีเมลตาม fault ดิบครบ threshold — ตอนนี้ย้ายไปส่งตอน "เปิดใบงาน CM" แทน
# (auto_cm_watcher / cmreport submit → routers.notifications.send_cm_open_email)
# คงตัวแปรไว้เป็น None เพื่อไม่ให้ /notifications/debug/watcher-status พัง
email_watcher_task = None


# ===== Lifespan =====
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.errorDB = errorDB
    app.state.mongo_client = client

    start_watcher()

    yield

    await stop_watcher()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


# ─── Security headers + hide server banner (pentest #5, #6) ───
from starlette.middleware.base import BaseHTTPMiddleware

_SECURITY_HEADERS = {
    "X-XSS-Protection": "1; mode=block",
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": (
        "default-src https:; img-src 'self' data:; "
        "script-src 'self'; style-src 'self' 'unsafe-inline';"
    ),
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "no-referrer",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        for k, v in _SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        # ซ่อนข้อมูลเวอร์ชัน server/service (X-Powered-By)
        response.headers["Server"] = "server"
        if "X-Powered-By" in response.headers:
            del response.headers["X-Powered-By"]
        return response


app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "https://203.154.130.132:3000",
        "https://203.154.130.132:3001",
        "https://imps.egatdiamond.co.th",
        "https://imps.egat.co.th",
        "https://imps-dev.egat.co.th",
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
from routers.pm_all_stations import router as pm_all_stations_router
from routers.pm_maximo import router as pm_maximo_router

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
app.include_router(pm_all_stations_router)
app.include_router(pm_maximo_router)
