# # backend/pdf/pdf_routes.py
# from fastapi import APIRouter, Response, HTTPException , Query
# from fpdf import FPDF
# from pathlib import Path
# from urllib.parse import quote
# from pymongo import MongoClient
# from bson import ObjectId
# from bson.errors import InvalidId
# import re

# router = APIRouter(prefix="/pdf", tags=["pdf"])

# # ---------- ฟอนต์ไทย ----------
# # CANDIDATES = ["THSarabunNew.ttf", "TH Sarabun New.ttf", "Sarabun-Regular.ttf"]
# CANDIDATES = [
#     "THSarabunNew.ttf",
#     "Sarabun-Regular.ttf",
#     "THSarabunNew Bold.ttf",
#     "THSarabunNew Italic.ttf",
#     "THSarabunNew BoldItalic.ttf",
# ]

# def get_font_path() -> str:
#     here = Path(__file__).parent                # .../backend/pdf
#     fonts_dir = here / "fonts"                  # .../backend/pdf/fonts
#     for name in CANDIDATES:
#         p = fonts_dir / name
#         if p.exists():
#             return str(p)
#     raise FileNotFoundError("ไม่พบฟอนต์ไทยใน backend/pdf/fonts/")

# # ---------- เชื่อม MongoDB ----------
# # ใช้ URI เดียวกับ main.py ของคุณ
# MONGO_URI = "mongodb://imps_platform:eds_imps@203.154.130.132:27017/"
# client = MongoClient(MONGO_URI)
# db = client["PMReport"]
# pm_reports_collection = db["Klongluang3"]  # เปลี่ยนชื่อ collection ให้ตรงของจริง

# # ---------- helper ----------
# def safe_filename(name: str) -> str:
#     bad = '\\/:*?"<>|'
#     for ch in bad:
#         name = name.replace(ch, "_")
#     name = name.strip()
#     return name or "report"

# ZWSP = "\u200b"

# def soft_wrap(s: str, hard_chunk: int = 40) -> str:
#     if not s:
#         return ""
#     text = str(s)
#     # แทรก ZWSP หลังตัวอักษรไทย
#     text = re.sub('([\u0E00-\u0E7F])', lambda m: m.group(1) + ZWSP, text)
#     # ตัดโทเคนยาวที่ไม่มีช่องว่าง
#     def breaker(m):
#         w = m.group(0)
#         return ZWSP.join(w[i:i+hard_chunk] for i in range(0, len(w), hard_chunk))
#     text = re.sub(r'\S{' + str(hard_chunk) + r',}', breaker, text)
#     return text

# def force_wrap(text: str, n: int = 30) -> str:
#     """ fallback: บังคับตัดบรรทัดทุก n ตัวอักษร """
#     s = str(text)
#     return "\n".join(s[i:i+n] for i in range(0, len(s), n))


# def make_pm_report_pdf_bytes(doc: dict) -> bytes:
#     pdf = FPDF()
#     pdf.set_margins(12, 12, 12)
#     pdf.set_auto_page_break(auto=True, margin=15)
#     pdf.add_page()

#     # ฟอนต์ไทย
#     try:
#         font_path = get_font_path()
#         pdf.add_font("THSarabun", "", font_path, uni=True)
#         font_family = "THSarabun"
#     except Exception:
#         font_family = "Arial"

#     measures = (doc.get("measures") or {})
#     photos   = (doc.get("photos") or {})

#     title  = soft_wrap(f"PM Reportt - {doc.get('station_id', '-')}")
#     lines = [
#         soft_wrap(f"ID: {str(doc.get('_id'))}"),
#         soft_wrap(f"Station: {doc.get('station_id', '-')}"),
#         soft_wrap(f"PM Date: {doc.get('pm_date', '-')}"),
#         soft_wrap(f"Status: {doc.get('status') or photos.get('status', '-')}"),
#         soft_wrap(f"Summary: {measures.get('summary', '-')}"),
#     ]

#     # ตั้งความกว้างกระดาษใช้งานให้ชัดเจน
#     content_w = pdf.w - pdf.l_margin - pdf.r_margin  # = pdf.epw ใน fpdf2

#     # ตั้งฟอนต์
#     if font_family == "Arial":
#         pdf.set_font("Arial", size=16)
#         def latin1_safe(s): return str(s).encode("latin1", "ignore").decode("latin1")
#         title = latin1_safe(title)
#         lines = [latin1_safe(x) for x in lines]
#     else:
#         pdf.set_font("THSarabun", size=16)

#     # หัวเรื่อง
#     try:
#         pdf.cell(content_w, 10, title, ln=1)
#     except Exception:
#         pdf.cell(content_w, 10, force_wrap(title, 40), ln=1)

#     # เนื้อหา
#     pdf.set_font(font_family, size=14)
#     for line in lines:
#         try:
#             pdf.multi_cell(content_w, 8, line)
#         except Exception:
#             # fallback: บังคับตัดบรรทัดเป็นช่วงสั้น ๆ
#             pdf.multi_cell(content_w, 8, force_wrap(line, 30))

#     out = pdf.output(dest="S")
#     if isinstance(out, (bytes, bytearray)):
#         return bytes(out)
#     elif isinstance(out, str):
#         return out.encode("latin1", "ignore")
#     return bytes(out)

# @router.get("/{id}/file")
# async def get_pm_report_file(id: str, dl: bool = Query(False)):
#     try:
#         oid = ObjectId(id)
#     except InvalidId:
#         raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

#     doc = pm_reports_collection.find_one({"_id": oid})
#     if not doc:
#         raise HTTPException(status_code=404, detail="ไม่พบเอกสารตาม id นี้")

#     try:
#         pdf_bytes = make_pm_report_pdf_bytes(doc)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"PDF generation error: {type(e).__name__}: {e}")

#     filename = safe_filename(f"PM_{doc.get('station_id','unknown')}_{doc.get('pm_date','')}.pdf")
#     ascii_fallback = "report.pdf"
#     disposition = "attachment" if dl else "inline"   # ⬅️ ตรงนี้สลับได้
#     cd = f"{disposition}; filename={ascii_fallback}; filename*=UTF-8''{quote(filename)}"

#     return Response(
#         content=pdf_bytes,
#         media_type="application/pdf",
#         headers={"Content-Disposition": cd, "Cache-Control": "no-store"},
#     )

# @router.get("/{id}/download")
# async def download_pm_report_by_id(id: str):
#     # รองรับทั้ง ObjectId และกัน error รายละเอียดออกมาให้ debug ง่าย
#     try:
#         oid = ObjectId(id)
#     except InvalidId:
#         raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

#     doc = pm_reports_collection.find_one({"_id": oid})
#     if not doc:
#         raise HTTPException(status_code=404, detail="ไม่พบเอกสารตาม id นี้")

#     try:
#         pdf_bytes = make_pm_report_pdf_bytes(doc)
#     except Exception as e:
#         # โยนสาเหตุชัด ๆ เพื่อ debug (พอเสถียรแล้วจะเปลี่ยนเป็น log ก็ได้)
#         raise HTTPException(status_code=500, detail=f"PDF generation error: {type(e).__name__}: {e}")

#     # base = safe_filename(f"PM_{doc.get('station_id','unknown')}_{doc.get('pm_date','')}")
#     base = safe_filename(f"PM_{doc.get('station_id','unknown')}_{doc.get('pm_date','')}")

#     filename = f"{base}.pdf"
#     ascii_fallback = "report.pdf"
#     cd = f"attachment; filename={ascii_fallback}; filename*=UTF-8''{quote(filename)}"
#     return Response(
#         content=pdf_bytes,
#         media_type="application/pdf",
#         headers={"Content-Disposition": cd, "Cache-Control": "no-store"},
#     )


# # ---------- (ถ้าอยากคง endpoint เก่าไว้ด้วย) ดาวน์โหลดตัวอย่างทั่วไปรวม ๆ ----------
# @router.get("/download")
# async def download_sample(filename: str = "รายงาน.pdf"):
#     pdf = FPDF()
#     pdf.set_margins(12, 12, 12)
#     pdf.add_page()
#     font_path = get_font_path()
#     pdf.add_font("THSarabun", "", font_path, uni=True)
#     pdf.set_font("THSarabun", size=16)

#     content_w = pdf.w - pdf.l_margin - pdf.r_margin
#     pdf.cell(content_w, 10, soft_wrap("รายงานระบบ iMPS"), ln=1)
#     pdf.multi_cell(content_w, 8, soft_wrap("ไฟล์นี้สร้างในหน่วยความจำและส่งให้ดาวน์โหลด"))

#     out = pdf.output(dest="S")
#     pdf_bytes = bytes(out) if isinstance(out, (bytes, bytearray)) else out.encode("latin1")

#     if not filename.lower().endswith(".pdf"):
#         filename += ".pdf"
#     ascii_fallback = "report.pdf"
#     cd = f"attachment; filename={ascii_fallback}; filename*=UTF-8''{quote(filename)}"
#     return Response(content=pdf_bytes, media_type="application/pdf",
#                     headers={"Content-Disposition": cd, "Cache-Control": "no-store"})

# backend/pdf/pdf_routes.py
from fastapi import APIRouter, Response, HTTPException, Query
from fpdf import FPDF
from pathlib import Path
from urllib.parse import quote
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId
import os
import re

router = APIRouter(prefix="/pdf", tags=["pdf"])

# ---------- ฟอนต์ไทย ----------
CANDIDATES = [
    "THSarabunNew.ttf",
    "Sarabun-Regular.ttf",
    "THSarabunNew Bold.ttf",
    "THSarabunNew Italic.ttf",
    "THSarabunNew BoldItalic.ttf",
]


def get_font_path() -> str:
    here = Path(__file__).parent  # .../backend/pdf
    fonts_dir = here / "fonts"  # .../backend/pdf/fonts
    for name in CANDIDATES:
        p = fonts_dir / name
        if p.exists():
            return str(p)
    raise FileNotFoundError("ไม่พบฟอนต์ไทยใน backend/pdf/fonts/")


# ---------- เชื่อม MongoDB ----------
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI)

PMREPORT_DB = os.getenv("PMREPORT_DB", "PMReport")
PMREPORT_COLLECTION = os.getenv("PMREPORT_COLLECTION", "Klongluang3")
db = client[PMREPORT_DB]
pm_reports_collection = db[PMREPORT_COLLECTION]

# โฟลเดอร์จริงของไฟล์อัปโหลด (ถ้าตั้งค่านี้ จะพยายามแทรกรูปลง PDF)
UPLOADS_DIR = os.getenv("UPLOADS_DIR", "")  # ตัวอย่าง: /var/www/app/static/uploads


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
    text = re.sub("([\u0e00-\u0e7f])", lambda m: m.group(1) + ZWSP, text)

    # ตัดโทเคนยาวที่ไม่มีช่องว่าง
    def breaker(m):
        w = m.group(0)
        return ZWSP.join(w[i : i + hard_chunk] for i in range(0, len(w), hard_chunk))

    text = re.sub(r"\S{" + str(hard_chunk) + r",}", breaker, text)
    return text


def force_wrap(text: str, n: int = 30) -> str:
    """fallback: บังคับตัดบรรทัดทุก n ตัวอักษร"""
    s = str(text)
    return "\n".join(s[i : i + n] for i in range(0, len(s), n))


def map_upload_url_to_path(url: str) -> str | None:
    """
    แปลง URL ทรัพยากร /uploads/... ให้เป็นพาธจริงในดิสก์ ถ้าเซ็ต UPLOADS_DIR ไว้
    เช่น URL: /uploads/pm/Klongluang3/<id>/g1/file.jpg
         พาธ: {UPLOADS_DIR}/pm/Klongluang3/<id>/g1/file.jpg
    """
    if not UPLOADS_DIR or not url:
        return None
    url = url.strip()
    if not url.startswith("/uploads/"):
        return None
    rel = url[len("/uploads/") :]  # ตัด prefix
    return str(Path(UPLOADS_DIR) / rel)


# ---------- สร้าง PDF ----------
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

    # เตรียมข้อมูลจากสคีมาที่ให้มา
    station_id = doc.get("station_id", "-")
    job = doc.get("job", {}) or {}
    rows = doc.get("rows", {}) or {}
    measures = doc.get("measures", {}) or {}
    summary = doc.get("summary", "")
    status = doc.get("status", "")
    pm_date = doc.get("pm_date", job.get("date", "")) or ""

    # ความกว้างเนื้อหา
    content_w = pdf.w - pdf.l_margin - pdf.r_margin  # epw

    # ตั้งฟอนต์เริ่ม
    pdf.set_font(font_family, size=16)

    # ชื่อรายงาน
    title = soft_wrap(f"PM Report - {station_id}")
    try:
        pdf.cell(content_w, 10, title, ln=1)
    except Exception:
        pdf.cell(content_w, 10, force_wrap(title, 40), ln=1)

    # บล็อคข้อมูลหัวกระดาษ (Job/Station)
    pdf.set_font(font_family, size=13)

    def kv(label: str, value: str):
        """แสดง label: value สั้น ๆ สองคอลัมน์"""
        label = soft_wrap(label)
        value = soft_wrap(value)
        h = 7
        lw = 42
        vw = content_w - lw
        pdf.set_font(font_family, size=12)
        pdf.cell(lw, h, label, border=0)
        pdf.multi_cell(vw, h, value)

    kv("Station ID", station_id)
    kv("Station Name", str(job.get("station_name") or "-"))
    kv("Model", str(job.get("model") or "-"))
    kv("Serial No.", str(job.get("sn") or "-"))
    kv("Charger No.", str(job.get("chargerNo") or "-"))
    kv("Inspector", str(job.get("inspector") or "-"))
    kv("PM Date", str(pm_date or "-"))
    pdf.ln(2)

    # ---------- Checklist (rows r1..rN) ----------
    pdf.set_font(font_family, size=14)
    pdf.cell(0, 8, "Checklist", ln=1)

    pdf.set_font(font_family, size=12)
    th_h = 8
    col_w = [20, 55, content_w - 20 - 55 - 28, 28]  # No., Item, Remark, PF

    def th(text, w):
        pdf.set_fill_color(230, 230, 230)
        pdf.cell(w, th_h, text, border=1, ln=0, align="C", fill=True)

    th("#", col_w[0])
    th("Item", col_w[1])
    th("Remark", col_w[2])
    th("PF", col_w[3])
    pdf.ln(th_h)

    def sort_key(k):
        try:
            return int(k[1:]) if k.startswith("r") else 9999
        except:
            return 9999

    # NOTE: ชื่อรายการจริงของ r1..r19 ยังไม่ทราบ → แสดงเป็น key ไปก่อน
    for i, key in enumerate(sorted(rows.keys(), key=sort_key), start=1):
        row = rows.get(key, {}) or {}
        pf = str(row.get("pf") or "-").upper()
        remark = str(row.get("remark") or "")

        # สีพื้นตาม PF
        if pf == "PASS":
            pdf.set_fill_color(220, 255, 220)
        elif pf == "FAIL":
            pdf.set_fill_color(255, 220, 220)
        elif pf == "NA":
            pdf.set_fill_color(235, 235, 235)
        else:
            pdf.set_fill_color(255, 255, 255)

        # วาดทีละช่อง (ง่ายและเสถียร)
        h = 8
        pdf.cell(col_w[0], h, str(i), border=1, ln=0, align="C")
        pdf.cell(col_w[1], h, key, border=1, ln=0, align="L")
        x, y = pdf.get_x(), pdf.get_y()
        pdf.multi_cell(col_w[2], h, soft_wrap(remark) or "-", border=1)
        new_y = pdf.get_y()
        pdf.set_xy(x + col_w[2], y)
        pdf.cell(col_w[3], h, pf, border=1, ln=1, align="C", fill=True)
        # หมายเหตุ: ถ้า remark สูงหลายบรรทัด PF จะสูงคงที่ 1 บรรทัด เพื่อความเรียบง่าย

    pdf.ln(2)

    # ---------- Measures ----------
    pdf.set_font(font_family, size=14)
    pdf.cell(0, 8, "Measures", ln=1)
    pdf.set_font(font_family, size=12)

    # m17 (แรงดัน)
    m17 = measures.get("m17", {}) or {}
    if m17:
        th("Point", 60)
        th("Value", 30)
        th("Unit", 22)
        pdf.ln(th_h)
        for point, obj in m17.items():
            val = str((obj or {}).get("value", ""))
            unit = str((obj or {}).get("unit", ""))
            pdf.cell(60, 8, point, border=1)
            pdf.cell(30, 8, val, border=1, align="R")
            pdf.cell(22, 8, unit, border=1, ln=1, align="C")
        pdf.ln(1)

    # cp
    cp = measures.get("cp", {}) or {}
    if cp:
        th("CP", 60)
        th("Value", 30)
        th("Unit", 22)
        pdf.ln(th_h)
        pdf.cell(60, 8, "Control Pilot", border=1)
        pdf.cell(30, 8, str(cp.get("value", "")), border=1, align="R")
        pdf.cell(22, 8, str(cp.get("unit", "")), border=1, ln=1, align="C")
        pdf.ln(1)

    # ---------- Summary / Status ----------
    pdf.set_font(font_family, size=14)
    pdf.cell(0, 8, "Summary", ln=1)
    pdf.set_font(font_family, size=12)
    try:
        pdf.multi_cell(content_w, 8, soft_wrap(summary or "-"))
    except Exception:
        pdf.multi_cell(content_w, 8, force_wrap(summary or "-", 40))
    pdf.ln(1)

    pdf.set_font(font_family, size=12)
    pdf.cell(0, 7, f"Overall Status: {status or '-'}", ln=1)

    # ---------- Photos (ออปชัน: ถ้ามีพาธไฟล์จริง) ----------
    photos = doc.get("photos") or {}
    if UPLOADS_DIR and photos:
        pdf.ln(2)
        pdf.set_font(font_family, size=14)
        pdf.cell(0, 8, "Photos", ln=1)
        pdf.set_font(font_family, size=11)

        # grid 3 คอลัมน์
        cols = 3
        gutter = 3
        img_w = (content_w - (gutter * (cols - 1))) / cols
        img_h = img_w * 0.75  # อัตราส่วนคร่าว ๆ

        x0 = pdf.l_margin
        y0 = pdf.get_y()
        x = x0
        y = y0
        col_idx = 0

        # เดินตามกลุ่ม g1..gN ตามลำดับ
        def sort_g(k):
            try:
                return int(k[1:]) if k.startswith("g") else 9999
            except:
                return 9999

        for gkey in sorted(photos.keys(), key=sort_g):
            arr = photos.get(gkey) or []
            for item in arr:
                url = str(item.get("url") or "")
                local_path = map_upload_url_to_path(url)
                if not local_path or not Path(local_path).exists():
                    continue  # ข้ามถ้าไม่มีพาธจริง

                # ตรวจว่าพื้นที่พอในหน้าไหม
                if y + img_h > (pdf.h - pdf.b_margin):
                    pdf.add_page()
                    x, y = x0, pdf.get_y()

                try:
                    pdf.image(local_path, x=x, y=y, w=img_w)
                except Exception:
                    # ถ้ารูปมีปัญหา ให้ข้ามรูปนั้นไป
                    pass

                # คำอธิบายสั้นใต้รูป (ชื่อไฟล์)
                fname = os.path.basename(local_path)
                pdf.set_xy(x, y + img_h + 1)
                pdf.multi_cell(img_w, 5, soft_wrap(fname, 20), align="C")

                # ไปคอลัมน์ถัดไป
                col_idx += 1
                if col_idx % cols == 0:
                    # ขึ้นแถวใหม่
                    x = x0
                    y += img_h + 10  # 10 = ระยะเผื่อ caption
                else:
                    x += img_w + gutter

        # ขยับ cursor ลงบรรทัดถัดไปให้เรียบร้อย
        pdf.set_xy(x0, y + img_h + 10)

    # ---------- Output ----------
    out = pdf.output(dest="S")
    if isinstance(out, (bytes, bytearray)):
        return bytes(out)
    elif isinstance(out, str):
        return out.encode("latin1", "ignore")
    return bytes(out)


# ---------- Endpoints ----------
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
        raise HTTPException(
            status_code=500, detail=f"PDF generation error: {type(e).__name__}: {e}"
        )

    filename = safe_filename(
        f"PM_{doc.get('station_id','unknown')}_{doc.get('pm_date', doc.get('job',{}).get('date',''))}.pdf"
    )
    ascii_fallback = "report.pdf"
    disposition = "attachment" if dl else "inline"
    cd = f"{disposition}; filename={ascii_fallback}; filename*=UTF-8''{quote(filename)}"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": cd, "Cache-Control": "no-store"},
    )


@router.get("/{id}/download")
async def download_pm_report_by_id(id: str):
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
        raise HTTPException(
            status_code=500, detail=f"PDF generation error: {type(e).__name__}: {e}"
        )

    base = safe_filename(
        f"PM_{doc.get('station_id','unknown')}_{doc.get('pm_date', doc.get('job',{}).get('date',''))}"
    )
    filename = f"{base}.pdf"
    ascii_fallback = "report.pdf"
    cd = f"attachment; filename={ascii_fallback}; filename*=UTF-8''{quote(filename)}"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": cd, "Cache-Control": "no-store"},
    )


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
    pdf_bytes = (
        bytes(out) if isinstance(out, (bytes, bytearray)) else out.encode("latin1")
    )

    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    ascii_fallback = "report.pdf"
    cd = f"attachment; filename={ascii_fallback}; filename*=UTF-8''{quote(filename)}"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": cd, "Cache-Control": "no-store"},
    )
