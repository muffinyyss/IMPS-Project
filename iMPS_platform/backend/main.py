from fastapi import FastAPI, Request
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
async def _warm_maximo_master_data() -> None:
    """
    เตรียมตาราง failure code (IN04) + รายชื่อช่าง (IN08) ให้ dropdown ของฟอร์ม CM

    ฟอร์มอ่านจาก cache ใน MongoDB อย่างเดียว ไม่ได้ยิง Maximo เอง — ที่นี่จึงเป็นจุด
    เดียวที่ตัดสินว่า cache จะมีข้อมูลไหม ไล่ 3 ชั้น:
      1) cache มีอยู่แล้ว (ปกติ — อยู่ข้าม restart) → ไม่ต้องทำอะไร
      2) cache ว่าง → ดึงจาก Maximo
      3) Maximo ล่มด้วย → เติมจากไฟล์ seed ที่ติดมากับ repo
    ทั้งหมดห้าม throw — Maximo ล่มต้องไม่ทำให้ backend ขึ้นไม่ได้
    """
    import logging

    from services import cm_maximo

    log = logging.getLogger("startup")
    need_seed = False

    for name, coll, sync in (
        ("failure codes", cm_maximo._failure_coll(), cm_maximo.sync_failure_codes),
        ("labor list", cm_maximo._labor_coll(), cm_maximo.sync_labor),
    ):
        try:
            if await coll.count_documents({}, limit=1):
                continue
            await sync()
        except Exception as e:
            log.warning(f"  ⚠️ warm Maximo {name} failed: {e}")
            need_seed = True

    if need_seed:
        try:
            await cm_maximo.restore_from_seed()
        except Exception as e:
            log.warning(f"  ⚠️ restore master data from seed failed: {e}")


async def _refresh_maximo_master_data() -> None:
    """
    sync master data ซ้ำเป็นระยะ — ตารางฝั่ง Maximo เปลี่ยนแล้วระบบต้องตามทัน
    โดยไม่ต้องรอ restart หรือรอคนกด refresh เอง

    ล้มเหลวไม่กระทบอะไร cache เดิมยังอยู่ (sync_failure_codes กันการเขียนทับด้วย
    ข้อมูลว่าง/ไม่ครบไว้แล้ว)
    """
    import asyncio
    import logging
    import os

    from services import cm_maximo

    log = logging.getLogger("startup")
    hours = float(os.getenv("MAXIMO_MASTER_REFRESH_HOURS", "24"))
    if hours <= 0:
        return

    while True:
        await asyncio.sleep(hours * 3600)
        for name, sync in (("failure codes", cm_maximo.sync_failure_codes),
                           ("labor list", cm_maximo.sync_labor)):
            try:
                await sync()
            except Exception as e:
                log.warning(f"  ⚠️ refresh Maximo {name} failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    import logging

    from routers.cmreport import ensure_cm_indexes

    app.state.errorDB = errorDB
    app.state.mongo_client = client

    # index ของ CMReport ทุกสถานี — ทำใน thread เพื่อไม่หน่วง startup (pymongo เป็น sync)
    try:
        n = await asyncio.to_thread(ensure_cm_indexes)
        logging.getLogger("startup").info(f"  ✓ CM indexes ensured on {n} collections")
    except Exception as e:
        logging.getLogger("startup").warning(f"  ⚠️ ensure CM indexes failed: {e}")

    start_watcher()
    await _warm_maximo_master_data()
    refresher = asyncio.create_task(_refresh_maximo_master_data())

    yield

    refresher.cancel()
    await stop_watcher()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


# ─── Global error handler: ตอบ JSON เสมอ ไม่ปล่อยให้ 500 หลุดเป็นหน้า HTML ───
# กันเคส frontend res.json() พังด้วย "Unexpected token '<', "<html>...": ถ้ามี exception ที่ไม่ถูก handle
# ให้ log traceback ไว้ดูสาเหตุจริง แล้วส่ง JSON กลับแทน (HTTPException/validation ยังทำงานตามเดิม)
import logging
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

_log = logging.getLogger("uvicorn.error")


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    _log.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


# ─── Log 422 ของ upload รูป: ดูว่า multipart body มาถึงจริงมั้ย ───
# เคส "sn/group/files หายพร้อมกันทั้งหมด" = body parse ไม่ออก ไม่ใช่ frontend ไม่ได้ส่ง
# log content-type/length ไว้เพื่อแยกว่าเป็นชื่อไฟล์เพี้ยน หรือ proxy ตัด body ทิ้ง
from fastapi.exceptions import RequestValidationError


@app.exception_handler(RequestValidationError)
async def _validation_exception_handler(request: Request, exc: RequestValidationError):
    if request.url.path.endswith("/photos"):
        _log.warning(
            "422 on %s | content-type=%r content-length=%r errors=%s",
            request.url.path,
            request.headers.get("content-type"),
            request.headers.get("content-length"),
            exc.errors(),
        )
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(exc.errors())})


# ─── Security headers + hide server banner (pentest #5, #6) ───
from starlette.middleware.base import BaseHTTPMiddleware

_SECURITY_HEADERS = {
    "X-XSS-Protection": "1; mode=block",
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": (
        # blob: จำเป็นสำหรับ preview รูปที่ผู้ใช้เพิ่งแนบ — หน้าฟอร์มสร้าง blob URL
        # จากไฟล์ในเครื่องผู้ใช้เองผ่าน URL.createObjectURL ไม่ได้โหลดจากภายนอก
        # ถ้าไม่อนุญาต <img src="blob:..."> จะโหลดไม่ขึ้นและโชว์ alt แทนรูปทุกใบ
        "default-src https:; img-src 'self' data: blob:; "
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


# ─── Uploaded Files ───────────────────────────────────────────
# เดิม mount ด้วย StaticFiles ตรงๆ ทำให้รูป PM/CM และ PDF ทุกไฟล์โหลดได้โดยไม่ต้อง
# ล็อกอิน ขอแค่รู้ URL — เปลี่ยนเป็น route ที่ต้องมี session และตรวจสิทธิ์สถานีก่อนเสมอ
#
# ใช้ cookie ได้เพราะ get_current_user อ่าน access_token cookie ก่อน Bearer header
# ซึ่งจำเป็น: <img src="/uploads/..."> แนบ Authorization header ไม่ได้ แต่ browser
# ส่ง cookie ให้อัตโนมัติเมื่อเป็น same-origin
import os
from fastapi import Depends
from fastapi.responses import FileResponse, Response, StreamingResponse

from routers.pm_helpers import UPLOADS_ROOT
from deps import get_current_user, UserClaims
from uploads_access import assert_upload_access, resolve_upload_path

os.makedirs(UPLOADS_ROOT, exist_ok=True)

_UPLOAD_MEDIA_TYPES = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".webm": "video/webm",
    ".wmv": "video/x-ms-wmv",
}


def _upload_media_type(target):
    import mimetypes
    return mimetypes.guess_type(str(target))[0] or _UPLOAD_MEDIA_TYPES.get(target.suffix.lower()) or "application/octet-stream"


def _iter_file_range(target, start: int, length: int, chunk_size: int = 1024 * 1024):
    with target.open("rb") as stream:
        stream.seek(start)
        remaining = length
        while remaining > 0:
            chunk = stream.read(min(chunk_size, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@app.get("/uploads/{rel_path:path}")
def serve_upload(request: Request, rel_path: str, current: UserClaims = Depends(get_current_user)):
    target = resolve_upload_path(rel_path)   # กัน path traversal + 404 ถ้าไม่ใช่ไฟล์
    assert_upload_access(current, rel_path)
    media_type = _upload_media_type(target)
    headers = {"Accept-Ranges": "bytes"}

    range_header = request.headers.get("range")
    if range_header and media_type.startswith("video/"):
        file_size = target.stat().st_size
        try:
            unit, value = range_header.split("=", 1)
            if unit.strip().lower() != "bytes" or "," in value:
                raise ValueError
            start_text, end_text = value.split("-", 1)
            if start_text.strip():
                start = int(start_text)
                end = int(end_text) if end_text.strip() else file_size - 1
            else:
                suffix_length = int(end_text)
                start = max(file_size - suffix_length, 0)
                end = file_size - 1
            if file_size == 0 or start < 0 or start >= file_size or end < start:
                raise ValueError
            end = min(end, file_size - 1)
        except (ValueError, TypeError):
            return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

        length = end - start + 1
        headers.update({
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(length),
        })
        return StreamingResponse(
            _iter_file_range(target, start, length),
            status_code=206,
            media_type=media_type,
            headers=headers,
        )

    return FileResponse(target, media_type=media_type, headers=headers)

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
from routers.cm_maximo import router as cm_maximo_router
from routers.ai_agent import router as ai_agent_router
from routers.company import router as company_router

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
app.include_router(cm_maximo_router)
app.include_router(ai_agent_router)
app.include_router(company_router)
