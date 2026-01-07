from fastapi import APIRouter, Response, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from bson import ObjectId
from bson.errors import InvalidId
from main import client1 as pymongo_client
import os

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

# mapping ระหว่าง template กับ database และฟังก์ชัน generate_pdf
TEMPLATE_MAP = {
    # PM report
    "charger": {"db": "PMReport", "func": pdf_charger},
    "mdb": {"db": "MDBPMReport", "func": pdf_mdb},
    "ccb": {"db": "CCBPMReport", "func": pdf_ccb},
    "cbbox": {"db": "CBBOXPMReport", "func": pdf_cbbox},
    "station": {"db": "stationPMReport", "func": pdf_station},
    "cm": {"db": "CMReport", "func": pdf_cm},
    
    # Test report
    "dc": {"db": "DCTestReport", "func": pdf_dc},
    "ac": {"db": "ACTestReport", "func": pdf_ac},
}


@router.get("/{template}/{id}/export")
async def export_pdf_redirect(
    request: Request,
    template: str,
    id: str,
    sn: str = Query(...),
    dl: bool = Query(False),
    lang: str = Query("th", description="Language: 'th' or 'en'"),  # เพิ่ม lang parameter
    photos_base_url: str | None = Query(None),
    public_dir: str | None = Query(None),
    photos_headers: str | None = Query(None),
):
    """
    Redirect to proper filename URL
    """
    # ตรวจสอบว่า template มีใน mapping ไหม
    if template not in TEMPLATE_MAP:
        raise HTTPException(status_code=400, detail=f"ไม่พบ template '{template}'")

    # ตรวจสอบ ObjectId
    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

    # เลือก database และ collection ตามประเภท template
    db_info = TEMPLATE_MAP[template]
    db = pymongo_client[db_info["db"]]
    coll = db[sn]

    # ดึงข้อมูลจาก MongoDB
    data = coll.find_one({"_id": oid})
    if not data:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลเอกสารนี้")

    # ตั้งชื่อไฟล์
    pm_templates = ["charger", "mdb", "ccb", "cbbox", "station", "cm"]
    if template in pm_templates:
        issue_id = data.get("issue_id")
        if not issue_id:
            issue_id = str(data.get("_id"))
        filename = f"{issue_id}.pdf"
    else:
        filename = f"{template.upper()}-{sn}.pdf"

    # สร้าง URL ใหม่พร้อม query parameters
    query_params = f"?sn={sn}"
    query_params += f"&lang={lang}"  # เพิ่ม lang ใน redirect URL
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
    sn: str = Query(...),
    dl: bool = Query(False),
    lang: str = Query("th", description="Language: 'th' or 'en'"),  # เพิ่ม lang parameter
    photos_base_url: str | None = Query(None, description="เช่น http://localhost:3000"),
    public_dir: str | None = Query(None, description="absolute path ไปยังโฟลเดอร์ public"),
    photos_headers: str | None = Query(None, description="เช่น 'Authorization: Bearer XXX|Cookie: sid=YYY'"),
):
    """
    Export PDF with photo support:
      /pdf/charger/{id}/PM-CG-2407-01.pdf?sn=F1500624011&lang=en
    """

    # ตรวจสอบว่า template มีใน mapping ไหม
    if template not in TEMPLATE_MAP:
        raise HTTPException(status_code=400, detail=f"ไม่พบ template '{template}'")

    # ตรวจสอบ ObjectId
    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

    # เลือก database และ collection ตามประเภท template
    db_info = TEMPLATE_MAP[template]
    db = pymongo_client[db_info["db"]]
    coll = db[sn]

    # ดึงข้อมูลจาก MongoDB
    data = coll.find_one({"_id": oid})
    if not data:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลเอกสารนี้")
    
    # ตั้งค่า environment variables ก่อนเรียก generate_pdf
    if public_dir:
        os.environ["PUBLIC_DIR"] = public_dir
    if photos_base_url:
        os.environ["PHOTOS_BASE_URL"] = photos_base_url
    if photos_headers:
        os.environ["PHOTOS_HEADERS"] = photos_headers
        
    # ถ้าไม่ส่งมา ให้ใช้ request.base_url
    if not os.environ.get("APP_BASE_URL"):
        base_url = str(request.base_url).rstrip('/')
        os.environ["APP_BASE_URL"] = base_url

    # สร้าง PDF - ส่ง lang ไปด้วย
    try:
        pdf_bytes = db_info["func"](data, lang=lang)
    except TypeError:
        # Fallback: ถ้า function ยังไม่รองรับ lang parameter
        pdf_bytes = db_info["func"](data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการสร้าง PDF: {str(e)}")

    # สร้าง headers สำหรับ response
    headers = {
        "Content-Disposition": f'{"attachment" if dl else "inline"}; filename="{filename}"',
        "Content-Type": "application/pdf"
    }

    return Response(pdf_bytes, media_type="application/pdf", headers=headers)