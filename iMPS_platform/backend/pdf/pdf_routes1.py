from fastapi import APIRouter, Response, HTTPException, Query, Request
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

router = APIRouter(prefix="/pdf", tags=["pdf"])

# ✅ mapping ระหว่าง template กับ database และฟังก์ชัน generate_pdf
TEMPLATE_MAP = {
    "charger": {"db": "PMReport", "func": pdf_charger},
    "mdb": {"db": "MDBPMReport", "func": pdf_mdb},
    "ccb": {"db": "CCBPMReport", "func": pdf_ccb},
    "cbbox": {"db": "CBBOXPMReport", "func": pdf_cbbox},
    "station": {"db": "stationPMReport", "func": pdf_station},
}


@router.get("/{template}/{id}/export")
async def export_pdf(
    request: Request,
    template: str,
    id: str,
    station_id: str = Query(...),
    dl: bool = Query(False),
    photos_base_url: str | None = Query(None, description="เช่น http://localhost:3000"),
    public_dir: str | None = Query(None, description="absolute path ไปยังโฟลเดอร์ public"),
    photos_headers: str | None = Query(None, description="เช่น 'Authorization: Bearer XXX|Cookie: sid=YYY'"),
):
    """
    Export PDF with photo support:
      /pdf/charger/{id}/export?station_id=Klongluang3
    
    ถ้ารูปไม่ขึ้น ลองเพิ่ม:
      &public_dir=/path/to/iMPS_platform/public
      หรือ
      &photos_base_url=http://localhost:3000
    """

    # ตรวจสอบว่า template มีใน mapping ไหม
    if template not in TEMPLATE_MAP:
        raise HTTPException(status_code=400, detail=f"ไม่พบ template '{template}'")

    # ตรวจสอบ ObjectId
    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

    # ✅ เลือก database และ collection ตามประเภท template
    db_info = TEMPLATE_MAP[template]
    db = pymongo_client[db_info["db"]]
    coll = db[station_id]

    # ✅ ดึงข้อมูลจาก MongoDB
    data = coll.find_one({"_id": oid})
    if not data:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลเอกสารนี้")
    
    # ✅ ตั้งค่า environment variables ก่อนเรียก generate_pdf
    if public_dir:
        os.environ["PUBLIC_DIR"] = public_dir
    if photos_base_url:
        os.environ["PHOTOS_BASE_URL"] = photos_base_url
    if photos_headers:
        os.environ["PHOTOS_HEADERS"] = photos_headers

    # ✅ สร้าง PDF
    try:
        pdf_bytes = db_info["func"](data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการสร้าง PDF: {str(e)}")

    # ✅ ตั้งชื่อไฟล์
    filename = f"PM-{template.capitalize()}-{station_id}.pdf"
    headers = {
        "Content-Disposition": f'{"attachment" if dl else "inline"}; filename="{filename}"'
    }

    return Response(pdf_bytes, media_type="application/pdf", headers=headers)











# from fastapi import APIRouter, Response, HTTPException, Query, Request
# from bson import ObjectId
# from bson.errors import InvalidId
# from main import client1 as pymongo_client
# import os

# # import template ทั้งหมด
# from .templates.pdf_charger import generate_pdf as pdf_charger
# from .templates.pdf_mdb import generate_pdf as pdf_mdb
# from .templates.pdf_ccb import generate_pdf as pdf_ccb
# from .templates.pdf_cbbox import generate_pdf as pdf_cbbox
# from .templates.pdf_station import generate_pdf as pdf_station

# router = APIRouter(prefix="/pdf", tags=["pdf"])

# # ✅ mapping ระหว่าง template กับ database และฟังก์ชัน generate_pdf
# TEMPLATE_MAP = {
#     "charger": {"db": "PMReport", "func": pdf_charger},
#     "mdb": {"db": "MDBPMReport", "func": pdf_mdb},
#     "ccb": {"db": "CCBPMReport", "func": pdf_ccb},
#     "cbbox": {"db": "CBBOXPMReport", "func": pdf_cbbox},
#     "station": {"db": "stationPMReport", "func": pdf_station},
# }

# @router.get("/{template}/{id}/export")
# async def export_pdf(
#     request: Request,
#     template: str,                   # เช่น charger, mdb, ccb, cbbox, station
#     id: str,
#     station_id: str = Query(...),
#     dl: bool = Query(False),
#     photos_base_url: str | None = Query(None, description="เช่น https://your-domain.com"),
#     public_dir: str | None = Query(None, description="absolute path ไปยังโฟลเดอร์ public"),
#     photos_headers: str | None = Query(None, description="เช่น 'Authorization: Bearer XXX|Cookie: sid=YYY'"),
# ):
#     """
#     ใช้แบบเดิมได้:
#       /pdf/charger/{id}/export?station_id=Klongluang3
#     และถ้ารูปไม่ขึ้น ให้ลองอย่างใดอย่างหนึ่ง:
#       /pdf/charger/{id}/export?station_id=Klongluang3&public_dir=/var/www/iMPS_platform/public
#       /pdf/charger/{id}/export?station_id=Klongluang3&photos_base_url=http://localhost:3000
#     """

#     # ตรวจสอบว่า template มีใน mapping ไหม
#     if template not in TEMPLATE_MAP:
#         raise HTTPException(status_code=400, detail=f"ไม่พบ template '{template}'")

#     # ตรวจสอบ ObjectId
#     try:
#         oid = ObjectId(id)
#     except InvalidId:
#         raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

#     # ✅ เลือก database และ collection ตามประเภท template
#     db_info = TEMPLATE_MAP[template]
#     db = pymongo_client[db_info["db"]]
#     coll = db[station_id]

#     # ✅ ดึงข้อมูลจาก MongoDB
#     data = coll.find_one({"_id": oid})
#     if not data:
#         raise HTTPException(status_code=404, detail="ไม่พบข้อมูลเอกสารนี้")

#     # ✅ สร้าง PDF ด้วย template ที่ตรงกัน
#     pdf_bytes = db_info["func"](data)
#     # ✅ สร้าง PDF ด้วย template ที่ตรงกัน
#     # pdf_bytes = db_info["func"](
#     #     data,
#     #     photos_base_url=photos_base_url,
#     #     public_dir=public_dir,
#     # )


#     # ✅ ตั้งชื่อไฟล์
#     filename = f"PM-{template.capitalize()}-{station_id}.pdf"
#     headers = {
#         "Content-Disposition": f'{"attachment" if dl else "inline"}; filename="{filename}"'
#     }

#     return Response(pdf_bytes, media_type="application/pdf", headers=headers)
