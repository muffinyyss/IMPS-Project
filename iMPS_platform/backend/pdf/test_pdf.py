# backend/pdf/test_pdf.py
from fastapi import APIRouter, HTTPException, Response
from fpdf import FPDF
from pathlib import Path
from urllib.parse import quote
import re

router = APIRouter(prefix="/pdf", tags=["pdf"])  # ใช้ prefix เดิมแทนของเก่า

# ---------- ฟอนต์ ----------
CANDIDATES = ["THSarabunNew.ttf", "Sarabun-Regular.ttf"]


def get_font_path() -> str:
    here = Path(__file__).parent
    fonts_dir = here / "fonts"
    for name in CANDIDATES:
        p = fonts_dir / name
        if p.exists():
            return str(p)
    raise FileNotFoundError("ไม่พบฟอนต์ไทยใน backend/pdf/fonts/")


ZWSP = "\u200b"


def soft_wrap(s: str, hard_chunk: int = 40) -> str:
    if not s:
        return ""
    text = str(s)
    text = re.sub("([\u0e00-\u0e7f])", lambda m: m.group(1) + ZWSP, text)

    def breaker(m):
        w = m.group(0)
        return ZWSP.join(w[i : i + hard_chunk] for i in range(0, len(w), hard_chunk))

    return re.sub(r"\S{" + str(hard_chunk) + r",}", breaker, text)


def safe_filename(name: str) -> str:
    bad = '\\/:*?"<>|'
    for ch in bad:
        name = name.replace(ch, "_")
    name = name.strip() or "report"
    return f"{name}.pdf"


def build_pdf_bytes(payload: dict) -> bytes:
    station = payload.get("station", "-")
    model = payload.get("model", "-")
    serial = payload.get("serial", "-")
    date = payload.get("date", "-")
    inspector = payload.get("inspector", "-")
    summary = payload.get("summary", "-")
    checklist = payload.get("checklist", [])  # [{item, pf, remark}]

    pdf = FPDF()
    pdf.set_margins(12, 12, 12)
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    try:
        font_path = get_font_path()
        pdf.add_font("THSarabun", "", font_path, uni=True)
        font = "THSarabun"
    except Exception:
        font = "Arial"

    content_w = pdf.w - pdf.l_margin - pdf.r_margin

    # Title
    pdf.set_font(font, size=18)
    pdf.cell(0, 10, soft_wrap(f"PM Report (TEST) - {station}"), ln=1)

    # Header K/V
    pdf.set_font(font, size=12)

    def kv(label, value):
        h, lw = 7, 40
        pdf.cell(lw, h, soft_wrap(label), border=0)
        pdf.multi_cell(content_w - lw, h, soft_wrap(value))

    kv("Station", station)
    kv("Model", model)
    kv("Serial", serial)
    kv("Date", date)
    kv("Inspector", inspector)
    pdf.ln(2)

    # Checklist
    pdf.set_font(font, size=14)
    pdf.cell(0, 8, "Checklist", ln=1)
    pdf.set_font(font, size=12)
    th_h = 8
    cw = [12, 90, 25, content_w - 12 - 90 - 25]  # No., Item, PF, Remark

    def th(text, w):
        pdf.set_fill_color(233, 233, 233)
        pdf.cell(w, th_h, text, border=1, ln=0, align="C", fill=True)

    th("#", cw[0])
    th("Item", cw[1])
    th("PF", cw[2])
    th("Remark", cw[3])
    pdf.ln(th_h)

    for i, row in enumerate(checklist, start=1):
        item = str(row.get("item") or "-")
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

        h = 8
        pdf.cell(cw[0], h, str(i), border=1, ln=0, align="C")
        pdf.cell(cw[1], h, soft_wrap(item), border=1, ln=0)
        pdf.cell(cw[2], h, pf, border=1, ln=0, align="C", fill=True)
        pdf.multi_cell(cw[3], h, soft_wrap(remark), border=1)

    pdf.ln(2)
    pdf.set_font(font, size=14)
    pdf.cell(0, 8, "Summary", ln=1)
    pdf.set_font(font, size=12)
    pdf.multi_cell(content_w, 8, soft_wrap(summary))

    out = pdf.output(dest="S")
    return (
        out if isinstance(out, (bytes, bytearray)) else out.encode("latin1", "ignore")
    )


@router.post("/form/preview")
async def preview_from_form(payload: dict):
    try:
        pdf_bytes = build_pdf_bytes(payload)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"PDF error: {type(e).__name__}: {e}"
        )
    filename = safe_filename(
        f"PM_TEST_{payload.get('station','-')}_{payload.get('date','')}"
    )
    cd = f"inline; filename={quote(filename)}; filename*=UTF-8''{quote(filename)}"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": cd, "Cache-Control": "no-store"},
    )


@router.post("/form/download")
async def download_from_form(payload: dict):
    try:
        pdf_bytes = build_pdf_bytes(payload)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"PDF error: {type(e).__name__}: {e}"
        )
    filename = safe_filename(
        f"PM_TEST_{payload.get('station','-')}_{payload.get('date','')}"
    )
    cd = f"attachment; filename={quote(filename)}; filename*=UTF-8''{quote(filename)}"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": cd, "Cache-Control": "no-store"},
    )
