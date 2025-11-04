# backend/pdf/pdf_routes.py
from fastapi import APIRouter, Response, HTTPException, Query
from fastapi.responses import RedirectResponse
from fpdf import FPDF, HTMLMixin
from pathlib import Path
from urllib.parse import quote
from bson import ObjectId
from bson.errors import InvalidId
from main import client1 as pymongo_client
import os, re

router = APIRouter(prefix="/pdf", tags=["pdf"])

# ---------- ฟอนต์ไทย ----------
FONT_FILES = {
    "": "THSarabunNew.ttf",
    "B": "THSarabunNew Bold.ttf",
    "I": "THSarabunNew Italic.ttf",
    "BI": "THSarabunNew BoldItalic.ttf",
}


def get_font_path() -> str:
    here = Path(__file__).parent
    fonts_dir = here / "fonts"
    for name in CANDIDATES:
        p = fonts_dir / name
        if p.exists():
            return str(p)
    raise FileNotFoundError("ไม่พบฟอนต์ไทยใน backend/pdf/fonts/")

def add_all_thsarabun_fonts(pdf: FPDF):
    """เพิ่มฟอนต์ THSarabun ทั้ง 4 สไตล์: Regular, Bold, Italic, BoldItalic"""
    fonts_dir = Path(__file__).parent / "fonts"
    
    # ตรวจสอบและเพิ่มฟอนต์ทุกสไตล์
    for style, filename in FONT_FILES.items():
        font_path = fonts_dir / filename
        if not font_path.exists():
            # ถ้าหาฟอนต์ Bold/Italic ไม่เจอ อาจต้องใช้ฟอนต์ Regular แทนสำหรับสไตล์นั้นๆ
            # แต่เพื่อหลีกเลี่ยง FPDFException เราจะยกเว้นการเพิ่มฟอนต์สไตล์นั้นไปเลย
            # หรือแค่ข้ามไปถ้าใช้ FPDF
            pass # FPDF จะใช้ฟอนต์ที่ใกล้เคียงที่สุดถ้าหาไม่เจอ (แต่กรณีนี้คือต้องการให้มี)
        else:
            pdf.add_font("THSarabun", style, str(font_path), uni=True)
            
    # เราจะตั้งค่าหลักที่ Regular แต่เพื่อให้มั่นใจว่า Bold ถูกโหลดสำหรับ <th>
    if not (fonts_dir / FONT_FILES[""]).exists():
         raise FileNotFoundError("ไม่พบฟอนต์ THSarabunNew.ttf ใน backend/pdf/fonts/")

# ---------- เชื่อม MongoDB ----------
PMREPORT_DB_NAME = "PMReport"
db = pymongo_client[PMREPORT_DB_NAME]

UPLOADS_DIR = os.getenv("UPLOADS_DIR", "")


# ---------- Helper ----------
def safe_filename(name: str) -> str:
    bad = '\\/:*?"<>|'
    for ch in bad:
        name = name.replace(ch, "_")
    name = name.strip()
    return name or "report"


def _validate_station_id(station_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")


def get_pmreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    return db[str(station_id)]


def _extract_station_and_date(doc: dict, fallback_station: str = "unknown"):
    st = str(doc.get("station_id") or fallback_station or "unknown").strip()
    raw_pm = doc.get("pm_date") or (doc.get("job") or {}).get("date") or ""
    raw_pm = str(raw_pm)
    pm_date_only = raw_pm.split("T")[0][:10].replace("-", "")
    return st, pm_date_only


# ---------- ใช้ fpdf2 + HTML ----------
class HTML2PDF(FPDF, HTMLMixin):
    pass


def make_pm_report_html_pdf_bytes(doc: dict) -> bytes:
    pdf = HTML2PDF()
    pdf.add_page()

    # ฟอนต์ไทย: โหลดทุกสไตล์
    try:
        add_all_thsarabun_fonts(pdf)
        # กำหนดฟอนต์หลัก
        pdf.set_font("THSarabun", size=14)
    except FileNotFoundError:
         # ในกรณีที่ฟอนต์หลักหายไปจริงๆ
        pdf.set_font("Arial", size=12)
    except Exception:
         # หากมีปัญหาอื่น ให้ใช้ฟอนต์สำรอง
        pdf.set_font("Arial", size=12)

    # ดึงข้อมูล
    station_id = doc.get("station_id", "-")
    job = doc.get("job", {}) or {}
    summary = doc.get("summary", "-")
    pm_date = doc.get("pm_date", job.get("date", "-"))

    # HTML Template
    # **ลบ <colgroup> และ <col> ออกเพื่อแก้ Warning/Potential Error**
    html = f"""
    <h1 align="center">PM Report - {station_id}</h1>
    <table border="1" width="100%" align="center">
        <tr>
            <th width="30%">Station Name</th><td width="70%">{job.get("station_name", "-")}</td>
        </tr>
        <tr><th width="30%">Model</th><td width="70%">{job.get("model", "-")}</td></tr>
        <tr><th width="30%">Serial No.</th><td width="70%">{job.get("sn", "-")}</td></tr>
        <tr><th width="30%">Inspector</th><td width="70%">{job.get("inspector", "-")}</td></tr>
        <tr><th width="30%">PM Date</th><td width="70%">{pm_date}</td></tr>
    </table>

    <br><b>Summary:</b><br>
    <p>{summary}</p>
    """

    pdf.write_html(html)

    return bytes(pdf.output(dest="S"))
# ---------- API Endpoint ----------
@router.get("/{id}/export-html")
async def export_pdf_from_html(
    id: str,
    station_id: str = Query(..., description="เช่น Klongluang3"),
    dl: bool = Query(False),
):
    """สร้าง PDF จาก HTML"""
    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID ไม่ถูกต้อง")

    coll = get_pmreport_collection_for(station_id)
    doc = coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

    pdf_bytes = make_pm_report_html_pdf_bytes(doc)

    st, pm_date = _extract_station_and_date(doc, station_id)
    filename = safe_filename(f"{pm_date}_{st}.pdf")

    disposition = "attachment" if dl else "inline"
    cd = f"{disposition}; filename={filename}; filename*=UTF-8''{quote(filename)}"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": cd,
            "Cache-Control": "no-store",
        },
    )


# ---------- Redirect (optional) ----------
@router.get("/{id}/file-html")
async def get_pm_report_redirect(
    id: str,
    station_id: str = Query(...),
    dl: bool = Query(False),
):
    """Redirect เพื่อให้ชื่อไฟล์สวยงาม"""
    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID ไม่ถูกต้อง")

    coll = get_pmreport_collection_for(station_id)
    doc = coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

    st, pm_date = _extract_station_and_date(doc, station_id)
    slug = quote(f"{pm_date}_{st}")
    target = f"/pdf/{id}/export-html?station_id={station_id}&dl={int(bool(dl))}"
    return RedirectResponse(url=target, status_code=307)


# from fastapi import APIRouter, Response, HTTPException, Query
# from fastapi.responses import RedirectResponse
# from fpdf import FPDF, HTMLMixin
# from pathlib import Path
# from urllib.parse import quote
# from bson import ObjectId
# from bson.errors import InvalidId
# from main import client1 as pymongo_client
# import os
# import re
# import html as _html

# router = APIRouter(prefix="/pdf", tags=["pdf"])

# class HTML2PDF(FPDF, HTMLMixin):
#     pass

# def safe_filename(name: str) -> str:
#     bad = '\\/:*?"<>|'
#     for ch in bad:
#         name = name.replace(ch, "_")
#     name = name.strip()
#     return name or "report"

# def _validate_station_id(station_id: str):
#     if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
#         raise HTTPException(status_code=400, detail="Bad station_id")

# def get_pmreport_collection_for(station_id: str):
#     _validate_station_id(station_id)
#     return pymongo_client["PMReport"][str(station_id)]

# def _extract_station_and_date(doc: dict, fallback_station: str = "unknown"):
#     st = str(doc.get("station_id") or fallback_station or "unknown").strip()
#     raw_pm = doc.get("pm_date") or (doc.get("job") or {}).get("date") or ""
#     raw_pm = str(raw_pm)
#     pm_date_only = raw_pm.split("T")[0][:10].replace("-", "")
#     return st, pm_date_only

# def convert_br_to_newline(text: str) -> str:
#     if not text:
#         return ""
#     # แทนที่แท็ก <br> ทุกรูปแบบด้วย \n
#     return re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)


# def make_pm_report_html_pdf_bytes(doc: dict) -> bytes:
#     pdf = HTML2PDF()
#     pdf.add_page()

#     fonts_dir = Path(__file__).parent / "fonts"
#     try:
#         pdf.add_font("THSarabun", "", str(fonts_dir / "THSarabunNew.ttf"), uni=True)
#         pdf.add_font("THSarabun", "B", str(fonts_dir / "THSarabunNew Bold.ttf"), uni=True)
#         pdf.add_font("THSarabun", "I", str(fonts_dir / "THSarabunNew Italic.ttf"), uni=True)
#         pdf.add_font("THSarabun", "BI", str(fonts_dir / "THSarabunNew BoldItalic.ttf"), uni=True)
#         pdf.set_font("THSarabun", size=14)
#     except Exception as e:
#         pdf.set_font("Arial", size=12)

#     job = doc.get("job", {}) or {}

#     # แปลง <br> เป็น \n ทุกรายการที่อาจมี และ Escape HTML
#     station_id = _html.escape(convert_br_to_newline(str(doc.get("station_id", "-"))))
#     summary = _html.escape(convert_br_to_newline(str(doc.get("summary", "-"))))
#     pm_date = _html.escape(convert_br_to_newline(str(doc.get("pm_date", job.get("date", "-")))))
#     inspector = _html.escape(convert_br_to_newline(str(job.get("inspector", "-"))))
#     station_name = _html.escape(convert_br_to_newline(str(job.get("station_name", "-"))))
#     model = _html.escape(convert_br_to_newline(str(job.get("model", "-"))))
#     sn = _html.escape(convert_br_to_newline(str(job.get("sn", "-"))))

#     # สร้าง HTML Template
#     # **ส่วนที่แก้ไขคือในตารางลายเซ็นต์ด้านล่าง (บรรทัด 171-197) เปลี่ยน \n เป็น <br>**
#     html = f"""
#     <h2 align="center"><b>Preventive Maintenance Checklist - เครื่องอัดประจุไฟฟ้า</b></h2>
#     <h4 align="center">Electricity Generating Authority of Thailand (EGAT)</h4>
#     <p align="center"><i>53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130</i></p>

#     <table border="1" width="100%" cellspacing="0" cellpadding="3">
#         <tr>
#             <th width="25%">สถานที่</th><td width="25%">{station_name}</td>
#             <th width="25%">วันที่ตรวจ</th><td width="25%">{pm_date}</td>
#         </tr>
#         <tr>
#             <th>Model</th><td>{model}</td>
#             <th>Serial No.</th><td>{sn}</td>
#         </tr>
#         <tr>
#             <th>ผู้ตรวจสอบ</th><td>{inspector}</td>
#             <th>รหัสสถานี</th><td>{station_id}</td>
#         </tr>
#     </table>

#     <h4><b>รายการตรวจสอบ (Checklist)</b></h4>
#     <table border="1" width="100%" cellspacing="0" cellpadding="3">
#         <tr align="center" bgcolor="#f0f0f0">
#             <th width="10%">ลำดับ</th>
#             <th width="60%">รายการตรวจ</th>
#             <th width="15%">ผลตรวจ</th>
#             <th width="15%">หมายเหตุ</th>
#         </tr>
#         <tr>
#             <td align="center">1</td><td>ตรวจสอบสภาพทั่วไป</td>
#             <td align="center">Pass</td><td>-</td>
#         </tr>
#         <tr>
#             <td align="center">2</td><td>ตรวจสอบดักซีล, ซิลิโคนกันซึม</td>
#             <td align="center">Pass</td><td>-</td>
#         </tr>
#         <tr>
#             <td align="center">3</td><td>ตรวจสอบสายอัดประจุ</td>
#             <td align="center">Fail</td><td>สายชาร์จชำรุด</td>
#         </tr>
#         <tr>
#             <td align="center">4</td><td>ตรวจสอบหัวจ่ายอัดประจุ</td>
#             <td align="center">Fail</td><td>มีฝุ่นอุดตัน</td>
#         </tr>
#         <tr>
#             <td align="center">5</td><td>ตรวจสอบปุ่มหยุดฉุกเฉิน</td>
#             <td align="center">Pass</td><td>-</td>
#         </tr>
#         <tr>
#             <td align="center">6</td><td>ตรวจสอบป้ายเตือน / QR CODE</td>
#             <td align="center">Pass</td>
#             <td>-</td>
#         </tr>
#         <tr>
#             <td align="center">7</td><td>ตรวจสอบอุปกรณ์ไฟฟ้าและแรงดัน</td>
#             <td align="center">Pass</td><td>-</td>
#         </tr>
#         <tr>
#             <td align="center">8</td><td>ทดสอบการอัดประจุ</td>
#             <td align="center">N/A</td><td>-</td>
#         </tr>
#         <tr>
#             <td align="center">9</td><td>ทำความสะอาด</td>
#             <td align="center">Pass</td><td>-</td>
#         </tr>
#     </table>

#     <p><b>สรุปผลการตรวจสอบ:</b> {summary}</p>

#     <table width="100%" cellspacing="0" cellpadding="5" border="0">
#         <tr align="center">
#             <td width="33%">
#                 <b>Performed by</b><br>
#                 ( {inspector} )<br>
#                 Date: {pm_date}
#             </td>
#             <td width="33%">
#                 <b>Approved by</b><br>
#                 ( นายศราวุฒิ คำแสน )<br>
#                 Date: {pm_date}
#             </td>
#             <td width="33%">
#                 <b>Witnessed by</b><br>
#                 ( นายกิตติกานต์ ป่าไพร )<br>
#                 Date: {pm_date}
#             </td>
#         </tr>
#     </table>

#     <p align="center" style="font-size:12px">
#         <i>Pass = ผ่าน | Fail = ไม่ผ่าน | N/A = ไม่พบ</i><br>
#         <i>เอกสารรหัส: EV-F-27</i>
#     </p>
#     """

#     pdf.write_html(html)
#     return bytes(pdf.output(dest="S"))


# @router.get("/{id}/export-html")
# async def export_pdf_from_html(
#     id: str,
#     station_id: str = Query(..., description="เช่น Klongluang3"),
#     dl: bool = Query(False),
# ):
#     try:
#         oid = ObjectId(id)
#     except InvalidId:
#         raise HTTPException(status_code=400, detail="ID ไม่ถูกต้อง")

#     coll = get_pmreport_collection_for(station_id)
#     doc = coll.find_one({"_id": oid})
#     if not doc:
#         raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

#     pdf_bytes = make_pm_report_html_pdf_bytes(doc)
#     st, pm_date = _extract_station_and_date(doc, station_id)
#     filename = safe_filename(f"{pm_date}_{st}.pdf")

#     disposition = "attachment" if dl else "inline"
#     cd = f"{disposition}; filename={filename}; filename*=UTF-8''{quote(filename)}"

#     return Response(
#         content=pdf_bytes,
#         media_type="application/pdf",
#         headers={
#             "Content-Disposition": cd,
#             "Cache-Control": "no-store",
#         },
#     )


# @router.get("/{id}/file-html")
# async def get_pm_report_redirect(
#     id: str,
#     station_id: str = Query(...),
#     dl: bool = Query(False),
# ):
#     try:
#         oid = ObjectId(id)
#     except InvalidId:
#         raise HTTPException(status_code=400, detail="ID ไม่ถูกต้อง")

#     coll = get_pmreport_collection_for(station_id)
#     doc = coll.find_one({"_id": oid})
#     if not doc:
#         raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

#     st, pm_date = _extract_station_and_date(doc, station_id)
#     target = f"/pdf/{id}/export-html?station_id={station_id}&dl={int(bool(dl))}"
#     return RedirectResponse(url=target, status_code=307)
