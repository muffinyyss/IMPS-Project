from fastapi import APIRouter, Response, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from bson import ObjectId
from bson.errors import InvalidId
from main import client1 as pymongo_client
from datetime import datetime
import os
import pathlib
import shutil
from routers.pm_helpers import UPLOADS_ROOT

# import template ทั้งหมด
from .templates.pdf_charger import generate_pdf as pdf_charger
from .templates.pdf_mdb import generate_pdf as pdf_mdb
from .templates.pdf_ccb import generate_pdf as pdf_ccb
from .templates.pdf_cbbox import generate_pdf as pdf_cbbox
from .templates.pdf_station import generate_pdf as pdf_station
from .templates.pdf_cm import generate_pdf as pdf_cm
from .templates.pdf_dctest import generate_pdf as pdf_dc
from .templates.pdf_actest import generate_pdf as pdf_ac

router = APIRouter(prefix="/pdf", tags=["pdf"])

TEMPLATE_MAP = {
    "charger": {"db": "PMReport", "func": pdf_charger},
    "mdb": {"db": "MDBPMReport", "func": pdf_mdb},
    "ccb": {"db": "CCBPMReport", "func": pdf_ccb},
    "cbbox": {"db": "CBBOXPMReport", "func": pdf_cbbox},
    "station": {"db": "stationPMReport", "func": pdf_station},
    "cm": {"db": "CMReport", "func": pdf_cm},
    "dc": {"db": "DCTestReport", "func": pdf_dc},
    "ac": {"db": "ACTestReport", "func": pdf_ac},
}

# template ที่มีรูปให้ลบหลัง export
PM_TEMPLATES_WITH_PHOTOS = {"charger", "mdb", "ccb", "cbbox", "station"}


def _delete_report_photos(template: str, coll_key: str, report_id: str, coll) -> None:
    """ลบรูปบน disk และ unset photos ใน MongoDB หลัง export PDF สำเร็จ"""
    if template not in PM_TEMPLATES_WITH_PHOTOS:
        return

    # ลบโฟลเดอร์รูปบน disk
    report_dir = pathlib.Path(UPLOADS_ROOT) / "pm" / coll_key / report_id
    if report_dir.exists():
        shutil.rmtree(report_dir, ignore_errors=True)

    # unset photos ใน MongoDB
    try:
        oid = ObjectId(report_id)
        coll.update_one(
            {"_id": oid},
            {
                "$unset": {"photos_pre": "", "photos": ""},
                "$set": {"has_photos": False},
            },
        )
    except Exception:
        pass


@router.get("/{template}/{id}/export")
async def export_pdf_redirect(
    request: Request,
    template: str,
    id: str,
    sn: str = Query(None),
    station_id: str = Query(None),
    dl: bool = Query(False),
    lang: str = Query("th", description="Language: 'th' or 'en'"),
    photos_base_url: str | None = Query(None),
    public_dir: str | None = Query(None),
    photos_headers: str | None = Query(None),
):
    """Redirect to proper filename URL"""
    if template not in TEMPLATE_MAP:
        raise HTTPException(status_code=400, detail=f"ไม่พบ template '{template}'")

    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

    if template in ["charger", "ac", "dc"]:
        coll_key = sn
        if not coll_key:
            raise HTTPException(status_code=400, detail="ต้องระบุ sn สำหรับ template charger")
    else:
        coll_key = station_id
        if not coll_key:
            raise HTTPException(status_code=400, detail="ต้องระบุ station_id สำหรับ template นี้")

    db_info = TEMPLATE_MAP[template]
    db = pymongo_client[db_info["db"]]
    coll = db[coll_key]

    data = coll.find_one({"_id": oid})
    if not data:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลเอกสารนี้")

    pm_templates = ["charger", "mdb", "ccb", "cbbox", "station", "cm", "dc", "ac"]
    if template in pm_templates:
        issue_id = data.get("issue_id")

        if not issue_id:
            timestamp = data.get("created_at") or data.get("createdAt") or data.get("date") or data.get("timestamp")
            if timestamp:
                if isinstance(timestamp, str):
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                date_str = timestamp.strftime("%y%m%d")
            else:
                date_str = data["_id"].generation_time.strftime("%y%m%d")
            issue_id = f"{template.upper()}-{coll_key}-{date_str}"

        filename = f"{issue_id}.pdf"

    if template in ["charger", "ac", "dc"]:
        query_params = f"?sn={sn}"
    else:
        query_params = f"?station_id={station_id}"
    query_params += f"&lang={lang}"
    if dl:
        query_params += "&dl=true"
    if photos_base_url:
        query_params += f"&photos_base_url={photos_base_url}"
    if public_dir:
        query_params += f"&public_dir={public_dir}"
    if photos_headers:
        query_params += f"&photos_headers={photos_headers}"

    redirect_url = f"/pdf/{template}/{id}/{filename}{query_params}"
    return RedirectResponse(url=redirect_url, status_code=307)


@router.get("/{template}/{id}/{filename}")
async def export_pdf(
    request: Request,
    template: str,
    id: str,
    filename: str,
    sn: str = Query(None),
    station_id: str = Query(None),
    dl: bool = Query(False),
    lang: str = Query("th", description="Language: 'th' or 'en'"),
    photos_base_url: str | None = Query(None, description="เช่น http://localhost:3000"),
    public_dir: str | None = Query(None, description="absolute path ไปยังโฟลเดอร์ public"),
    photos_headers: str | None = Query(None, description="เช่น 'Authorization: Bearer XXX|Cookie: sid=YYY'"),
):
    """
    Export PDF with photo support:
      /pdf/charger/{id}/PM-CG-2407-01.pdf?sn=F1500624011&lang=en
      /pdf/mdb/{id}/PM-MB-2601-01.pdf?station_id=Klongluang3&lang=en
    """
    if template not in TEMPLATE_MAP:
        raise HTTPException(status_code=400, detail=f"ไม่พบ template '{template}'")

    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

    if template in ["charger", "ac", "dc"]:
        coll_key = sn
        if not coll_key:
            raise HTTPException(status_code=400, detail="ต้องระบุ sn สำหรับ template charger")
    else:
        coll_key = station_id
        if not coll_key:
            raise HTTPException(status_code=400, detail="ต้องระบุ station_id สำหรับ template นี้")

    db_info = TEMPLATE_MAP[template]
    db = pymongo_client[db_info["db"]]
    coll = db[coll_key]

    data = coll.find_one({"_id": oid})
    if not data:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลเอกสารนี้")

    # เช็ค cache ก่อน gen
    cache_path = pathlib.Path(UPLOADS_ROOT) / "pdf_cache" / (coll_key or "unknown") / f"{id}_{lang}.pdf"
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    if cache_path.exists():
        pdf_bytes = cache_path.read_bytes()
    else:
        if public_dir:
            os.environ["PUBLIC_DIR"] = public_dir
        if photos_base_url:
            os.environ["PHOTOS_BASE_URL"] = photos_base_url
        if photos_headers:
            os.environ["PHOTOS_HEADERS"] = photos_headers

        if not os.environ.get("APP_BASE_URL"):
            base_url = str(request.base_url).rstrip('/')
            os.environ["APP_BASE_URL"] = base_url

        try:
            pdf_bytes = db_info["func"](data, lang=lang)
        except TypeError:
            pdf_bytes = db_info["func"](data)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการสร้าง PDF: {str(e)}")

        cache_path.write_bytes(pdf_bytes)

    # ✅ ลบรูปหลัง serve PDF สำเร็จ เฉพาะเมื่อ cache ครบทั้ง 2 ภาษาแล้ว
    cache_dir = pathlib.Path(UPLOADS_ROOT) / "pdf_cache" / (coll_key or "unknown")
    both_cached = all((cache_dir / f"{id}_{l}.pdf").exists() for l in ("th", "en"))
    if both_cached:
        _delete_report_photos(template, coll_key, id, coll)

    headers = {
        "Content-Disposition": f'{"attachment" if dl else "inline"}; filename="{filename}"',
        "Content-Type": "application/pdf",
    }

    return Response(pdf_bytes, media_type="application/pdf", headers=headers)