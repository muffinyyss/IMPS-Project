# backend/pdf/pdf_routes.py
from fastapi import APIRouter, Response, HTTPException, Query
from fpdf import FPDF
from pathlib import Path
from urllib.parse import quote
from bson import ObjectId
from bson.errors import InvalidId
import os
import re
from main import client1 as pymongo_client
from datetime import datetime, date
from fastapi.responses import RedirectResponse

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
PMREPORT_DB_NAME = "PMReport"
db = pymongo_client[PMREPORT_DB_NAME]

# โฟลเดอร์จริงของไฟล์อัปโหลด
UPLOADS_DIR = os.getenv("UPLOADS_DIR", "")


# ---------- Helper Functions ----------
def safe_filename(name: str) -> str:
    """ทำให้ชื่อไฟล์ปลอดภัย"""
    bad = '\\/:*?"<>|'
    for ch in bad:
        name = name.replace(ch, "_")
    name = name.strip()
    return name or "report"


ZWSP = "\u200b"


def soft_wrap(s: str, hard_chunk: int = 40) -> str:
    """แทรก zero-width space เพื่อช่วยตัดบรรทัด"""
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
    """บังคับตัดบรรทัดทุก n ตัวอักษร (สำรองกรณีฟอนต์ไม่รองรับ)"""
    s = str(text)
    return "\n".join(s[i : i + n] for i in range(0, len(s), n))


def map_upload_url_to_path(url: str) -> str | None:
    """
    แปลง URL ทรัพยากร /uploads/... ให้เป็นพาธจริงในดิสก์
    """
    if not UPLOADS_DIR or not url:
        return None
    url = url.strip()
    if not url.startswith("/uploads/"):
        return None
    rel = url[len("/uploads/") :]  # ตัด prefix
    return str(Path(UPLOADS_DIR) / rel)


def _validate_station_id(station_id: str):
    """ตรวจสอบความถูกต้องของ station_id"""
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")


def get_pmreport_collection_for(station_id: str):
    """ดึง collection จาก station_id"""
    _validate_station_id(station_id)
    return db[str(station_id)]


# ---------- สร้าง PDF (รูปแบบใหม่เท่านั้น) ----------
def make_pm_report_pdf_bytes(doc: dict) -> bytes:
    """
    สร้าง PDF ด้วย FPDF เฉพาะ Layout แบบใหม่ (Enhanced)
    """
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

    # เตรียมข้อมูล
    station_id = doc.get("station_id", "-")
    job = doc.get("job", {}) or {}
    rows = doc.get("rows", {}) or {}
    measures = doc.get("measures", {}) or {}
    summary = doc.get("summary", "")
    status = doc.get("status", "")
    pm_date = doc.get("pm_date", job.get("date", "")) or ""

    content_w = pdf.w - pdf.l_margin - pdf.r_margin

    # ========== Layout แบบใหม่ (สวยงามขึ้น) ==========
    # Header พื้นหลังสี
    pdf.set_fill_color(41, 128, 185)  # สีน้ำเงิน
    pdf.rect(0, 0, pdf.w, 30, "F")

    pdf.set_text_color(255, 255, 255)  # ตัวอักษรสีขาว
    pdf.set_font(font_family, size=20)
    pdf.set_y(10)
    title = soft_wrap(f"PM Report - {station_id}")
    try:
        pdf.cell(content_w, 10, title, ln=1, align="C")
    except:
        pdf.cell(content_w, 10, force_wrap(title, 40), ln=1, align="C")

    pdf.set_text_color(0, 0, 0)  # กลับเป็นสีดำ
    pdf.set_y(35)

    # Info Section แบบกล่อง
    pdf.set_fill_color(245, 245, 245)
    y_start = pdf.get_y()
    pdf.rect(pdf.l_margin, y_start, content_w, 60, "F")

    pdf.set_font(font_family, size=12)
    pdf.set_y(y_start + 5)

    def kv_enhanced(label: str, value: str):
        h = 7
        lw = 50
        vw = content_w - lw - 4
        pdf.set_x(pdf.l_margin + 2)
        pdf.set_font(font_family, size=11)
        pdf.cell(lw, h, soft_wrap(label), border=0)
        pdf.set_font(font_family, size=11)
        pdf.cell(vw, h, soft_wrap(value), border=0, ln=1)

    kv_enhanced("Station ID:", station_id)
    kv_enhanced("Station Name:", str(job.get("station_name") or "-"))
    kv_enhanced("Model:", str(job.get("model") or "-"))
    kv_enhanced("Serial No.:", str(job.get("sn") or "-"))
    kv_enhanced("Charger No.:", str(job.get("chargerNo") or "-"))
    kv_enhanced("Inspector:", str(job.get("inspector") or "-"))
    kv_enhanced("PM Date:", str(pm_date or "-"))

    pdf.set_y(y_start + 65)

    # Checklist
    pdf.set_font(font_family, size=14)
    pdf.set_text_color(41, 128, 185)
    pdf.cell(0, 8, "Checklist", ln=1)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)

    pdf.set_font(font_family, size=12)
    th_h = 8
    col_w = [20, 60, content_w - 20 - 60 - 28, 28]

    def th(text, w):
        pdf.set_fill_color(52, 152, 219)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(w, th_h, text, border=1, ln=0, align="C", fill=True)
        pdf.set_text_color(0, 0, 0)

    th("#", col_w[0])
    th("Item", col_w[1])
    th("Remark", col_w[2])
    th("P/F", col_w[3])
    pdf.ln(th_h)

    def sort_key(k):
        try:
            return int(k[1:]) if k.startswith("r") else 9999
        except:
            return 9999

    for i, key in enumerate(sorted(rows.keys(), key=sort_key), start=1):
        row = rows.get(key, {}) or {}
        pf = str(row.get("pf") or "-").upper()
        remark = str(row.get("remark") or "")

        if pf == "PASS":
            pdf.set_fill_color(220, 255, 220)
        elif pf == "FAIL":
            pdf.set_fill_color(255, 220, 220)
        elif pf == "NA":
            pdf.set_fill_color(235, 235, 235)
        else:
            pdf.set_fill_color(255, 255, 255)

        pdf.cell(col_w[0], th_h, str(i), border=1, ln=0, align="C")
        pdf.cell(col_w[1], th_h, key, border=1, ln=0, align="L")

        x_before = pdf.get_x()
        y_before = pdf.get_y()
        pdf.multi_cell(col_w[2], th_h, soft_wrap(remark) or "-", border=1)
        y_after = pdf.get_y()
        cell_height = max(th_h, y_after - y_before)

        pdf.set_xy(x_before + col_w[2], y_before)
        pdf.cell(col_w[3], cell_height, pf, border=1, ln=1, align="C", fill=True)

    pdf.ln(3)

    # Measures
    if measures:
        pdf.set_font(font_family, size=14)
        pdf.set_text_color(41, 128, 185)
        pdf.cell(0, 8, "Measures", ln=1)
        pdf.set_text_color(0, 0, 0)
        pdf.ln(2)
        pdf.set_font(font_family, size=12)

        m17 = measures.get("m17", {}) or {}
        if m17:
            th("Point", 80)
            th("Value", 40)
            th("Unit", 30)
            pdf.ln(th_h)
            for point, obj in m17.items():
                val = str((obj or {}).get("value", ""))
                unit = str((obj or {}).get("unit", ""))
                pdf.cell(80, 8, point, border=1)
                pdf.cell(40, 8, val, border=1, align="R")
                pdf.cell(30, 8, unit, border=1, ln=1, align="C")
            pdf.ln(2)

        cp = measures.get("cp", {}) or {}
        if cp:
            th("CP", 80)
            th("Value", 40)
            th("Unit", 30)
            pdf.ln(th_h)
            pdf.cell(80, 8, "Control Pilot", border=1)
            pdf.cell(40, 8, str(cp.get("value", "")), border=1, align="R")
            pdf.cell(30, 8, str(cp.get("unit", "")), border=1, ln=1, align="C")
            pdf.ln(2)

    # Summary
    pdf.set_font(font_family, size=14)
    pdf.set_text_color(41, 128, 185)
    pdf.cell(0, 8, "Summary", ln=1)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font(font_family, size=12)
    try:
        pdf.multi_cell(content_w, 8, soft_wrap(summary or "-"))
    except:
        pdf.multi_cell(content_w, 8, force_wrap(summary or "-", 40))
    pdf.ln(2)

    pdf.set_font(font_family, size=12)
    pdf.cell(0, 7, f"Overall Status: {status or '-'}", ln=1)

    # Photos
    photos = doc.get("photos") or {}
    if UPLOADS_DIR and photos:
        pdf.ln(5)
        pdf.set_font(font_family, size=14)
        pdf.set_text_color(41, 128, 185)
        pdf.cell(0, 8, "Photos", ln=1)
        pdf.set_text_color(0, 0, 0)
        pdf.ln(2)

        cols = 3
        gutter = 3
        img_w = (content_w - (gutter * (cols - 1))) / cols
        img_h = img_w * 0.75

        x0 = pdf.l_margin
        y0 = pdf.get_y()
        x = x0
        y = y0
        col_idx = 0

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
                    continue

                if y + img_h > (pdf.h - pdf.b_margin):
                    pdf.add_page()
                    x, y = x0, pdf.get_y()

                try:
                    pdf.image(local_path, x=x, y=y, w=img_w)
                    fname = os.path.basename(local_path)
                    pdf.set_xy(x, y + img_h + 1)
                    pdf.set_font(font_family, size=9)
                    pdf.multi_cell(img_w, 4, soft_wrap(fname, 20), align="C")
                except Exception as e:
                    print(f"⚠️ Cannot load image {local_path}: {e}")

                col_idx += 1
                if col_idx % cols == 0:
                    x = x0
                    y += img_h + 10
                else:
                    x += img_w + gutter

        pdf.set_xy(x0, y + img_h + 10)

    # Output
    out = pdf.output(dest="S")
    if isinstance(out, (bytes, bytearray)):
        return bytes(out)
    elif isinstance(out, str):
        return out.encode("latin1", "ignore")
    return bytes(out)


# ---------- API Endpoint (HTML-only) ----------
# @router.get("/{id}/file-html")
# async def get_pm_report_enhanced(
#     id: str,
#     station_id: str = Query(..., description="เช่น Klongluang3"),
#     dl: bool = Query(False),
# ):
#     """ดาวน์โหลด/แสดง PDF (Layout แบบใหม่เท่านั้น)"""
#     try:
#         oid = ObjectId(id)
#     except InvalidId:
#         raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

#     coll = get_pmreport_collection_for(station_id)
#     doc = coll.find_one({"_id": oid})
#     if not doc:
#         raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

#     try:
#         pdf_bytes = make_pm_report_pdf_bytes(doc)
#     except Exception as e:
#         import traceback

#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=f"PDF generation error: {str(e)}")

#     filename = safe_filename(
#         f"PM_Enhanced_{doc.get('station_id','unknown')}_{doc.get('pm_date', '')}.pdf"
#     )
#     disposition = "attachment" if dl else "inline"
#     cd = f"{disposition}; filename=report.pdf; filename*=UTF-8''{quote(filename)}"

#     return Response(
#         content=pdf_bytes,
#         media_type="application/pdf",
#         headers={"Content-Disposition": cd, "Cache-Control": "no-store"},
#     )




router = APIRouter(prefix="/pdf", tags=["pdf"])

# ... (ฟังก์ชัน helper: safe_filename, get_pmreport_collection_for, make_pm_report_pdf_bytes etc. คงเดิม)

def _extract_station_and_date(doc: dict, fallback_station: str = "unknown"):
    st = str(doc.get("station_id") or fallback_station or "unknown").strip()
    raw_pm = doc.get("pm_date") or (doc.get("job") or {}).get("date") or ""
    if isinstance(raw_pm, dict) and "$date" in raw_pm:
        raw_pm = str(raw_pm["$date"])
    else:
        raw_pm = str(raw_pm)
    pm_date_only = raw_pm.split("T")[0][:10] if raw_pm else ""
    pm_date_only = pm_date_only.replace("-", "")  # 👈 เปลี่ยนขีดเป็นขีดล่าง
    return st, pm_date_only


@router.get("/{id}/{slug}.pdf")
async def get_pm_report_named(
    id: str,
    slug: str,
    station_id: str = Query(..., description="เช่น Klongluang3"),
    dl: bool = Query(False),
):
    """เสิร์ฟ PDF โดยชื่อที่แสดงจะมาจาก segment สุดท้ายของ URL (slug)."""
    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

    coll = get_pmreport_collection_for(station_id)
    doc = coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

    pdf_bytes = make_pm_report_pdf_bytes(doc)

    # ตั้งชื่อไฟล์สำหรับดาวน์โหลด (กันเหนียว)
    st, pm_date_only = _extract_station_and_date(doc, station_id)
    base_name = f"{st}_{pm_date_only}.pdf" if pm_date_only else f"{st}.pdf"
    filename = safe_filename(base_name)

    disposition = "attachment" if dl else "inline"
    cd = (
        f'{disposition}; '
        f'filename="{filename}"; '
        f"filename*=UTF-8''{quote(filename)}"
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": cd, "Cache-Control": "no-store"},
    )

@router.get("/{id}/file-html")
async def get_pm_report_enhanced(
    id: str,
    station_id: str = Query(..., description="เช่น Klongluang3"),
    dl: bool = Query(False),
):
    """
    เดิมใช้เสิร์ฟ PDF ตรง ๆ
    ตอนนี้เปลี่ยนเป็น redirect ไปยัง URL ที่มีชื่อไฟล์ใน path เพื่อให้ Viewer แสดงชื่อถูกต้อง
    """
    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="รูปแบบ id ไม่ถูกต้อง")

    coll = get_pmreport_collection_for(station_id)
    doc = coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

    st, pm_date_only = _extract_station_and_date(doc, station_id)
    base_name = f"{st}_{pm_date_only}" if pm_date_only else f"{st}"
    slug = quote(safe_filename(base_name).replace(".pdf", ""), safe="")  # ไม่ใส่ .pdf ใน slug

    # ประกอบ URL ใหม่: /pdf/{id}/{slug}.pdf?station_id=...&dl=...
    target = f"/pdf/{id}/{slug}.pdf?station_id={quote(station_id)}&dl={int(bool(dl))}"
    return RedirectResponse(url=target, status_code=307)
