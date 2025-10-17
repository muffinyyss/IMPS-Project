

# backend/pdf/pdf_routes.py
from fastapi import APIRouter, Response, HTTPException , Query
from fpdf import FPDF
from pathlib import Path
from urllib.parse import quote
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId
import re

router = APIRouter(prefix="/pdf", tags=["pdf"])

# ---------- ฟอนต์ไทย ----------
# CANDIDATES = ["THSarabunNew.ttf", "TH Sarabun New.ttf", "Sarabun-Regular.ttf"]
CANDIDATES = [
    "THSarabunNew.ttf",
    "Sarabun-Regular.ttf",
    "THSarabunNew Bold.ttf",
    "THSarabunNew Italic.ttf",
    "THSarabunNew BoldItalic.ttf",
]

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
db = client["PMReport"]
pm_reports_collection = db["Klongluang3"]  # เปลี่ยนชื่อ collection ให้ตรงของจริง

# ---------- helper ----------
def safe_filename(name: str) -> str:
    bad = '\\/:*?"<>|'
    for ch in bad:
        name = name.replace(ch, "_")
    name = name.strip()
    return name or "report"

ZWSP = "\u200b"

def soft_wrap(s: str, hard_chunk: int = 40) -> str:
    if not s:
        return ""
    text = str(s)
    # แทรก ZWSP หลังตัวอักษรไทย
    text = re.sub('([\u0E00-\u0E7F])', lambda m: m.group(1) + ZWSP, text)
    # ตัดโทเคนยาวที่ไม่มีช่องว่าง
    def breaker(m):
        w = m.group(0)
        return ZWSP.join(w[i:i+hard_chunk] for i in range(0, len(w), hard_chunk))
    text = re.sub(r'\S{' + str(hard_chunk) + r',}', breaker, text)
    return text

def force_wrap(text: str, n: int = 30) -> str:
    """ fallback: บังคับตัดบรรทัดทุก n ตัวอักษร """
    s = str(text)
    return "\n".join(s[i:i+n] for i in range(0, len(s), n))


def make_pm_report_pdf_bytes(doc: dict) -> bytes:
    pdf = FPDF()
    pdf.set_margins(12, 12, 12)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # ฟอนต์ไทย
    try:
        font_path = get_font_path()
        pdf.add_font("THSarabun", "", font_path, uni=True)
        font_family = "THSarabun"
    except Exception:
        font_family = "Arial"

    measures = (doc.get("measures") or {})
    photos   = (doc.get("photos") or {})

    title  = soft_wrap(f"PM Reportt - {doc.get('station_id', '-')}")
    lines = [
        soft_wrap(f"ID: {str(doc.get('_id'))}"),
        soft_wrap(f"Station: {doc.get('station_id', '-')}"),
        soft_wrap(f"PM Date: {doc.get('pm_date', '-')}"),
        soft_wrap(f"Status: {doc.get('status') or photos.get('status', '-')}"),
        soft_wrap(f"Summary: {measures.get('summary', '-')}"),
    ]

    # ตั้งความกว้างกระดาษใช้งานให้ชัดเจน
    content_w = pdf.w - pdf.l_margin - pdf.r_margin  # = pdf.epw ใน fpdf2

    # ตั้งฟอนต์
    if font_family == "Arial":
        pdf.set_font("Arial", size=16)
        def latin1_safe(s): return str(s).encode("latin1", "ignore").decode("latin1")
        title = latin1_safe(title)
        lines = [latin1_safe(x) for x in lines]
    else:
        pdf.set_font("THSarabun", size=16)

    # หัวเรื่อง
    try:
        pdf.cell(content_w, 10, title, ln=1)
    except Exception:
        pdf.cell(content_w, 10, force_wrap(title, 40), ln=1)

    # เนื้อหา
    pdf.set_font(font_family, size=14)
    for line in lines:
        try:
            pdf.multi_cell(content_w, 8, line)
        except Exception:
            # fallback: บังคับตัดบรรทัดเป็นช่วงสั้น ๆ
            pdf.multi_cell(content_w, 8, force_wrap(line, 30))

    out = pdf.output(dest="S")
    if isinstance(out, (bytes, bytearray)):
        return bytes(out)
    elif isinstance(out, str):
        return out.encode("latin1", "ignore")
    return bytes(out)

@router.get("/{id}/file")
async def get_pm_report_file(id: str, dl: bool = Query(False)):
    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

    doc = pm_reports_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารตาม id นี้")

    try:
        pdf_bytes = make_pm_report_pdf_bytes(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation error: {type(e).__name__}: {e}")

    filename = safe_filename(f"PM_{doc.get('station_id','unknown')}_{doc.get('pm_date','')}.pdf")
    ascii_fallback = "report.pdf"
    disposition = "attachment" if dl else "inline"   # ⬅️ ตรงนี้สลับได้
    cd = f"{disposition}; filename={ascii_fallback}; filename*=UTF-8''{quote(filename)}"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": cd, "Cache-Control": "no-store"},
    )

@router.get("/{id}/download")
async def download_pm_report_by_id(id: str):
    # รองรับทั้ง ObjectId และกัน error รายละเอียดออกมาให้ debug ง่าย
    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

    doc = pm_reports_collection.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสารตาม id นี้")

    try:
        pdf_bytes = make_pm_report_pdf_bytes(doc)
    except Exception as e:
        # โยนสาเหตุชัด ๆ เพื่อ debug (พอเสถียรแล้วจะเปลี่ยนเป็น log ก็ได้)
        raise HTTPException(status_code=500, detail=f"PDF generation error: {type(e).__name__}: {e}")

    # base = safe_filename(f"PM_{doc.get('station_id','unknown')}_{doc.get('pm_date','')}")
    base = safe_filename(f"PM_{doc.get('station_id','unknown')}_{doc.get('pm_date','')}")

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
    pdf = FPDF()
    pdf.set_margins(12, 12, 12)
    pdf.add_page()
    font_path = get_font_path()
    pdf.add_font("THSarabun", "", font_path, uni=True)
    pdf.set_font("THSarabun", size=16)

    content_w = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.cell(content_w, 10, soft_wrap("รายงานระบบ iMPS"), ln=1)
    pdf.multi_cell(content_w, 8, soft_wrap("ไฟล์นี้สร้างในหน่วยความจำและส่งให้ดาวน์โหลด"))

    out = pdf.output(dest="S")
    pdf_bytes = bytes(out) if isinstance(out, (bytes, bytearray)) else out.encode("latin1")

    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    ascii_fallback = "report.pdf"
    cd = f"attachment; filename={ascii_fallback}; filename*=UTF-8''{quote(filename)}"
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": cd, "Cache-Control": "no-store"})

