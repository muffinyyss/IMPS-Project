# from fastapi import APIRouter, Response
# from fpdf import FPDF
# from pathlib import Path
# from urllib.parse import quote

# router = APIRouter(prefix="/pdf", tags=["pdf"])

# CANDIDATES = ["THSarabunNew.ttf", "TH Sarabun New.ttf", "Sarabun-Regular.ttf"]

# def get_font_path() -> str:
#     here = Path(__file__).parent
#     fonts_dir = here / "fonts"
#     for name in CANDIDATES:
#         p = fonts_dir / name
#         if p.exists():
#             return str(p)
#     raise FileNotFoundError("ไม่พบฟอนต์ไทยใน backend/pdf/fonts/")

# def make_pdf_bytes(title_text: str = "รายงานระบบ iMPS") -> bytes:
#     pdf = FPDF()
#     pdf.add_page()
#     font_path = get_font_path()
#     pdf.add_font("THSarabun", "", font_path)
#     pdf.set_font("THSarabun", size=16)

#     pdf.cell(0, 10, title_text, new_x="LMARGIN", new_y="NEXT")
#     pdf.cell(0, 10, "ไฟล์นี้สร้างในหน่วยความจำและส่งให้ดาวน์โหลด", new_x="LMARGIN", new_y="NEXT")

#     out = pdf.output(dest="S")
#     # ✅ รองรับทุกชนิดที่ fpdf อาจคืนมา
#     if isinstance(out, (bytes, bytearray)):
#         return bytes(out)           # แปลง bytearray -> bytes
#     elif isinstance(out, str):
#         return out.encode("latin1") # บางเวอร์ชันคืน str
#     else:
#         return bytes(out)           # กันเหนียว


# @router.get("/download")
# async def download_pdf(filename: str = "รายงาน.pdf"):
#     pdf_bytes = make_pdf_bytes()
#     if not filename.lower().endswith(".pdf"):
#         filename += ".pdf"
#     ascii_fallback = "report.pdf"
#     cd = f"attachment; filename={ascii_fallback}; filename*=UTF-8''{quote(filename)}"
#     return Response(content=pdf_bytes, media_type="application/pdf",
#                     headers={"Content-Disposition": cd, "Cache-Control": "no-store"})


# backend/pdf/pdf_routes.py
from fastapi import APIRouter, Response, HTTPException
from fpdf import FPDF
from pathlib import Path
from urllib.parse import quote
from pymongo import MongoClient
from bson import ObjectId

router = APIRouter(prefix="/pdf", tags=["pdf"])

# ---------- ฟอนต์ไทย ----------
CANDIDATES = ["THSarabunNew.ttf", "TH Sarabun New.ttf", "Sarabun-Regular.ttf"]

def get_font_path() -> str:
    here = Path(__file__).parent                # .../backend/pdf
    fonts_dir = here / "fonts"                  # .../backend/pdf/fonts
    for name in CANDIDATES:
        p = fonts_dir / name
        if p.exists():
            return str(p)
    raise FileNotFoundError("ไม่พบฟอนต์ไทยใน backend/pdf/fonts/")

# ---------- เชื่อม MongoDB ----------
# ใช้ URI เดียวกับ main.py ของคุณ
MONGO_URI = "mongodb://imps_platform:eds_imps@203.154.130.132:27017/"
client = MongoClient(MONGO_URI)
db = client["iMPS"]
pm_reports_collection = db["pm_reports"]  # เปลี่ยนชื่อ collection ให้ตรงของจริง

# ---------- helper ----------
def safe_filename(name: str) -> str:
    bad = '\\/:*?"<>|'
    for ch in bad:
        name = name.replace(ch, "_")
    name = name.strip()
    return name or "report"

# ---------- สร้าง PDF จากข้อมูลรายงานหนึ่งรายการ ----------
def make_pm_report_pdf_bytes(doc: dict) -> bytes:
    pdf = FPDF()
    pdf.add_page()

    # ฟอนต์ไทย
    font_path = get_font_path()
    pdf.add_font("THSarabun", "", font_path)
    pdf.set_font("THSarabun", size=16)

    # หัวเรื่อง
    title = f"PM Report - {doc.get('name', '(no name)')}"
    pdf.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("THSarabun", size=14)

    # ---- ตัวอย่างฟิลด์ (แก้ให้ตรง schema ของคุณ) ----
    lines = [
        f"ID: {str(doc.get('_id'))}",
        f"Date: {doc.get('date', '-')}",
        f"Position: {doc.get('position', '-')}",
        f"Status: {doc.get('status', '-')}",
        f"Note: {doc.get('note', '-')}",
    ]
    for line in lines:
        pdf.multi_cell(0, 8, line)  # ให้ตัดบรรทัดอัตโนมัติ

    out = pdf.output(dest="S")
    if isinstance(out, (bytes, bytearray)):
        return bytes(out)
    elif isinstance(out, str):
        return out.encode("latin1")
    else:
        return bytes(out)

# ---------- ดาวน์โหลดตาม id ----------
@router.get("/{id}/download")
async def download_pm_report_by_id(id: str):
    # ถ้า _id ใน Mongo เป็น ObjectId:
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

    doc = pm_reports_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารตาม id นี้")

    pdf_bytes = make_pm_report_pdf_bytes(doc)

    # ตั้งชื่อไฟล์จากข้อมูลจริง (รองรับไทย)
    base = safe_filename(f"PM_{doc.get('name','unknown')}_{doc.get('date','')}")
    filename = f"{base}.pdf"

    ascii_fallback = "report.pdf"
    cd = f"attachment; filename={ascii_fallback}; filename*=UTF-8''{quote(filename)}"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": cd, "Cache-Control": "no-store"},
    )


# ---------- (ถ้าอยากคง endpoint เก่าไว้ด้วย) ดาวน์โหลดตัวอย่างทั่วไปรวม ๆ ----------
@router.get("/download")
async def download_sample(filename: str = "รายงาน.pdf"):
    # ตัวอย่างเก่า ใช้ข้อความคงที่
    pdf = FPDF()
    pdf.add_page()
    font_path = get_font_path()
    pdf.add_font("THSarabun", "", font_path)
    pdf.set_font("THSarabun", size=16)
    pdf.cell(0, 10, "รายงานระบบ iMPS", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 10, "ไฟล์นี้สร้างในหน่วยความจำและส่งให้ดาวน์โหลด", new_x="LMARGIN", new_y="NEXT")

    out = pdf.output(dest="S")
    pdf_bytes = bytes(out) if isinstance(out, (bytes, bytearray)) else out.encode("latin1")

    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    ascii_fallback = "report.pdf"
    cd = f"attachment; filename={ascii_fallback}; filename*=UTF-8''{quote(filename)}"
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": cd, "Cache-Control": "no-store"})
