# backend/pdf/templates/pdf_charger.py
from fpdf import FPDF, HTMLMixin
from pathlib import Path
from datetime import datetime, date
import os
import re
from typing import Optional, Tuple, List, Dict, Any, Union
import base64
from io import BytesIO
try:
    import requests   # optional ถ้าไม่มี base_url ก็ไม่จำเป็น
except Exception:
    requests = None


# -------------------- ฟอนต์ไทย --------------------
FONT_CANDIDATES: Dict[str, List[str]] = {
    "":  ["THSarabunNew.ttf", "TH Sarabun New.ttf", "THSarabun.ttf", "TH SarabunPSK.ttf"],
    "B": ["THSarabunNew-Bold.ttf", "THSarabunNew Bold.ttf", "TH Sarabun New Bold.ttf", "THSarabun Bold.ttf"],
    "I": ["THSarabunNew-Italic.ttf", "THSarabunNew Italic.ttf", "TH Sarabun New Italic.ttf", "THSarabun Italic.ttf"],
    "BI":["THSarabunNew-BoldItalic.ttf", "THSarabunNew BoldItalic.ttf", "TH Sarabun New BoldItalic.ttf", "THSarabun BoldItalic.ttf"],
}

def add_all_thsarabun_fonts(pdf: FPDF, family_name: str = "THSarabun") -> bool:
    """
    โหลดฟอนต์ TH Sarabun โดยค้นทั้ง:
      - <this file>/fonts            (เช่น backend/pdf/templates/fonts)
      - <this file>/../fonts         (เช่น backend/pdf/fonts)
      - โฟลเดอร์ฟอนต์ของระบบ (Windows/macOS/Linux)
    คืนค่า True ถ้าโหลด regular ("") ได้สำเร็จ
    """

    here = Path(__file__).parent
    search_dirs = [
        here / "fonts",               # backend/pdf/templates/fonts
        here.parent / "fonts",        # backend/pdf/fonts ตรงกับที่คุณเก็บไว้
        Path("C:/Windows/Fonts"),     # Windows
        Path("/Library/Fonts"),       # macOS system
        Path(os.path.expanduser("~/Library/Fonts")),  # macOS user
        Path("/usr/share/fonts"),     # Linux
        Path("/usr/local/share/fonts"),
    ]
    search_dirs = [d for d in search_dirs if d.exists()]

    def _find_first_existing(cands: List[str]) -> Optional[Path]:
        for d in search_dirs:
            for fn in cands:
                p = d / fn
                if p.exists() and p.is_file():
                    return p
        return None

    loaded_regular = False
    for style, candidates in FONT_CANDIDATES.items():
        p = _find_first_existing(candidates)
        if not p:
            continue
        try:
            # fpdf2 ต้อง uni=True เพื่อรองรับ Unicode/ภาษาไทย
            pdf.add_font(family_name, style, str(p), uni=True)
            if style == "":
                loaded_regular = True
        except Exception:
            # กันเคส "add ซ้ำ" หรือ error ยิบย่อย—ข้ามไปโหลด style อื่นต่อ
            pass

    return loaded_regular



# -------------------- ชื่อหัวข้อแถวจากโค้ด --------------------
ROW_TITLES = {
    "r1": "ตรวจสอบสภาพทั่วไป",
    "r2": "ตรวจสอบดักซีล, ซิลิโคนกันซึม",
    "r3": "ตรวจสอบสายอัดประจุ",
    "r4": "ตรวจสอบหัวจ่ายอัดประจุ",
    "r5": "ตรวจสอบปุ่มหยุดฉุกเฉิน",
    "r6": "ตรวจสอบ QR CODE",
    "r7": "ป้ายเตือนระวังไฟฟ้าช็อก",
    "r8": "ป้ายเตือนต้องการระบายอากาศ",
    "r9": "ป้ายเตือนปุ่มฉุกเฉิน",
    "r10": "วัดแรงดันวงจรควบคุมการอัดประจุ",
    "r11": "ตรวจสอบแผ่นกรองระบายอากาศ",
    "r12": "ตรวจสอบจุดต่อทางไฟฟ้า",
    "r13": "ตรวจสอบคอนแทคเตอร์",
    "r14": "ตรวจสอบอุปกรณ์ป้องกันไฟกระชาก",
    "r15": "ตรวจสอบแรงดันไฟฟ้าที่พิน CP",
    "r16": "ตรวจสอบลำดับเฟส",
    "r17": "วัดแรงดันไฟฟ้าด้านเข้า",
    "r18": "ทดสอบการอัดประจุ",
    "r19": "ทำความสะอาด",
}

# -------------------- Helpers / Layout constants --------------------
LINE_W_OUTER = 0.45
LINE_W_INNER = 0.22
PADDING_X = 2.0
PADDING_Y = 1.2
FONT_MAIN = 13.0
FONT_SMALL = 13.0
LINE_H = 6.8
ROW_MIN_H = 9
CHECKBOX_SIZE = 4.0

class HTML2PDF(FPDF, HTMLMixin):
    pass

def _draw_check(pdf: FPDF, x: float, y: float, size: float, checked: bool):
    pdf.rect(x, y, size, size)
    if checked:
        lw_old = pdf.line_width
        pdf.set_line_width(0.6)
        pdf.line(x + 0.7, y + size * 0.55, x + size * 0.40, y + size - 0.7)
        pdf.line(x + size * 0.40, y + size - 0.7, x + size - 0.7, y + 0.7)
        pdf.set_line_width(lw_old)

def _norm_result(val: str) -> str:
    s = (str(val) if val is not None else "").strip().lower()
    if s in ("pass", "p", "true", "ok", "1", "✔", "✓"):
        return "pass"
    if s in ("fail", "f", "false", "0", "x", "✗", "✕"):
        return "fail"
    return "na"

def _split_lines(pdf: FPDF, width: float, text: str, line_h: float):
    text = "" if text is None else str(text)
    try:
        lines = pdf.multi_cell(width, line_h, text, border=0, split_only=True)
    except TypeError:
        avg_char_w = max(pdf.get_string_width("ABCDEFGHIJKLMNOPQRSTUVWXYZ") / 26.0, 1)
        max_chars = max(int(width / avg_char_w), 1)
        lines, buf = [], text
        while buf:
            lines.append(buf[:max_chars])
            buf = buf[max_chars:]
    return lines, max(line_h, len(lines) * line_h)

def _cell_text_in_box(pdf: FPDF, x: float, y: float, w: float, h: float, text: str,
                      align="L", lh=LINE_H, valign="middle"):
    pdf.rect(x, y, w, h)
    inner_x = x + PADDING_X
    inner_w = w - 2 * PADDING_X
    text = "" if text is None else str(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    def _wrap_paragraph(paragraph: str) -> List[str]:
        words = paragraph.split(" ")
        lines, cur = [], ""
        for wd in words:
            candidate = wd if not cur else (cur + " " + wd)
            if pdf.get_string_width(candidate) <= inner_w:
                cur = candidate
            else:
                if cur:
                    lines.append(cur)
                if pdf.get_string_width(wd) <= inner_w:
                    cur = wd
                else:
                    buf = wd
                    while buf:
                        k = 1
                        while k <= len(buf) and pdf.get_string_width(buf[:k]) <= inner_w:
                            k += 1
                        lines.append(buf[:k-1])
                        buf = buf[k-1:]
                    cur = ""
        if cur:
            lines.append(cur)
        return lines

    paragraphs = text.split("\n")
    lines: List[str] = []
    for p in paragraphs:
        if p == "":
            lines.append("")
            continue
        lines.extend(_wrap_paragraph(p))

    content_h = max(lh, len(lines) * lh)

    # ปรับตำแหน่งให้ชิดบนสุดจริง ๆ ถ้า valign == "top"
    if valign == "top":
        start_y = y + PADDING_Y
    elif valign == "bottom":
        start_y = y + h - content_h - PADDING_Y
    else:  # middle
        start_y = y + max((h - content_h) / 2.0, PADDING_Y)

    cur_y = start_y
    pdf.set_xy(inner_x, cur_y)
    for ln in lines:
        if cur_y > y + h - lh:
            break
        pdf.set_xy(inner_x, cur_y)
        pdf.cell(inner_w, lh, ln, border=0, ln=1, align=align)
        cur_y += lh
    pdf.set_xy(x + w, y)


def _format_m17(measures: dict) -> str:
    ms = (measures or {}).get("m17") or {}
    order = [
        "L1-L2", "L2-L3", "L3-L1",
        "L1-N", "L2-N", "L3-N",
        "L1-G", "L2-G", "L3-G",
        "N-G"
    ]
    def fmt(k: str) -> str:
        d = ms.get(k) or {}
        val = (d.get("value") or "").strip()
        unit = (d.get("unit") or "").strip()
        return f"{k} = {val}{unit}" if val else f"{k} = -"
    lines = [fmt(k) for k in order]
    return "\n".join(lines)

def _parse_date_flex(s: str) -> Optional[datetime]:
    if not s:
        return None
    s = str(s)
    m = re.match(r"^\s*(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        y, mo, d = map(int, m.groups())
        try:
            return datetime(y, mo, d)
        except ValueError:
            pass
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s[:19], fmt)
        except Exception:
            pass
    return None

def _fmt_date_thai_like_sample(val) -> str:
    if isinstance(val, (datetime, date)):
        d = datetime(val.year, val.month, val.day)
    else:
        d = _parse_date_flex(str(val)) if val is not None else None
    if not d:
        return str(val) if val else "-"
    year_be_2 = (d.year + 543) % 100
    return d.strftime(f"%d-%b-{year_be_2:02d}")

def _resolve_logo_path() -> Optional[Path]:
    # ตำแหน่งไฟล์ตามรูปของคุณ: .../iMPS_platform/public/img
    # โครงสร้างไฟล์นี้อยู่ที่ .../iMPS_platform/backend/pdf/templates/pdf_charger.py
    # ต้องไต่ขึ้น 3 ชั้นไปที่ iMPS_platform แล้วค่อยลง public/img
    names = [
        "logo_egat.png", "logo_egatev.png", "logo_egat_ev.png",
        "egat_logo.png", "logo-ct.png", "logo_ct.png",
        "logo_egat.jpg", "logo_egat.jpeg",
    ]
    roots = [
        Path(__file__).parent / "assets",                     # backend/pdf/templates/assets
        Path(__file__).parent.parent / "assets",              # backend/pdf/assets
        Path(__file__).resolve().parents[3] / "public" / "img",        # ✅ iMPS_platform/public/img
        Path(__file__).resolve().parents[3] / "public" / "img" / "logo",# iMPS_platform/public/img/logo
    ]
    for root in roots:
        if not root.exists():
            continue
        for nm in names:
            p = root / nm
            if p.exists() and p.is_file():
                return p
    return None

def _draw_job_info_block(pdf: FPDF, base_font: str, x: float, y: float, w: float,
                         station_name: str, model: str, sn: str, pm_date: str) -> float:
    row_h = 8.5
    col_w = w / 2.0
    label_w = 30
    box_h = row_h * 2
    pdf.set_line_width(LINE_W_INNER)
    pdf.rect(x, y, w, box_h)
    pdf.line(x + col_w, y, x + col_w, y + box_h)   # คอลัมน์
    pdf.line(x, y + row_h, x + w, y + row_h)       # แถว

    def _item(x0, y0, label, value):
        pdf.set_xy(x0 + 2, y0 + 1.5)
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.cell(label_w, row_h - 3, label, border=0, align="L")
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.set_xy(x0 + 2 + label_w, y0 + 1.5)
        pdf.cell(col_w - label_w - 4, row_h - 3, str(value or "-"), border=0, align="L")

    _item(x, y, "Station", station_name)
    _item(x + col_w, y, "Serial No.", sn)
    _item(x, y + row_h, "Model", model)
    _item(x + col_w, y + row_h, "PM Date", pm_date)

    return y + box_h


def _r_idx(k: str) -> int:
    m = re.match(r"r(\d+)$", k.lower())
    return int(m.group(1)) if m else 10_000


def _rows_to_checks(rows: dict, measures: Optional[dict] = None) -> List[dict]:
    if not isinstance(rows, dict):
        return []
    items: List[dict] = []
    measures = measures or {}
    for key in sorted(rows.keys(), key=_r_idx):
        idx = _r_idx(key)
        data = rows.get(key) or {}
        title = ROW_TITLES.get(key, f"รายการที่ {idx}")
        remark = (data.get("remark") or "").strip()
        if key.lower() == "r17":
            mtxt = _format_m17(measures or {})
            if mtxt:
                remark = mtxt
        if key.lower() == "r15":
            cp_value = (measures.get("cp", {}) or {}).get("value", "-")
            cp_unit = (measures.get("cp", {}) or {}).get("unit", "")
            remark = f"CP = {cp_value}{cp_unit}"
        items.append({
            "idx": idx,
            "text": f"{idx}. {title}",
            "result": _norm_result(data.get("pf", "")),
            "remark": remark,
        })
    return items


def _draw_items_table_header(pdf: FPDF, base_font: str, x: float, y: float, item_w: float, result_w: float, remark_w: float):
    header_h = 9.0
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(item_w, header_h, "Item", border=1, align="C")
    pdf.cell(result_w, header_h, "Result", border=1, align="C")
    pdf.cell(remark_w, header_h, "Remark", border=1, ln=1, align="C")
    y += header_h
    pdf.set_fill_color(255, 230, 100)
    pdf.set_xy(x, y)
    pdf.cell(item_w + result_w + remark_w, 8, "เครื่องอัดประจุไฟฟ้า เครื่องที่ 1", border=1, ln=1, align="L", fill=True)
    return y + 8

def _draw_result_cell(pdf: FPDF, base_font: str, x: float, y: float, w: float, h: float, result: str):
    pdf.rect(x, y, w, h)
    col_w = w / 3.0
    labels = [("Pass", result == "pass"), ("Fail", result == "fail"), ("N/A", result == "na")]
    pdf.set_font(base_font, "", FONT_SMALL)
    for i, (lab, chk) in enumerate(labels):
        sx = x + i * col_w
        if i > 0:
            pdf.line(sx, y, sx, y + h)
        text_w = pdf.get_string_width(lab)
        content_w = CHECKBOX_SIZE + 1.6 + text_w
        start_x = sx + (col_w - content_w) / 2.0
        start_y = y + (h - CHECKBOX_SIZE) / 2.0
        _draw_check(pdf, start_x, start_y, CHECKBOX_SIZE, chk)
        pdf.set_xy(start_x + CHECKBOX_SIZE + 1.6, y + (h - LINE_H) / 2.0)
        pdf.cell(text_w, LINE_H, lab, border=0, ln=0, align="L")
    pdf.set_xy(x + w, y)

def _draw_summary_checklist(pdf: FPDF, base_font: str, x: float, y: float, summary_check: str):
    pass_checked = summary_check == "PASS"
    fail_checked = summary_check == "FAIL"
    na_checked = summary_check == "N/A"
    pdf.set_font(base_font, "", FONT_MAIN)
    start_x = x
    _draw_check(pdf, start_x, y, CHECKBOX_SIZE, pass_checked)
    pdf.set_xy(start_x + CHECKBOX_SIZE + 2, y - 0.5)
    pdf.cell(15, LINE_H, "PASS", align="L")
    start_x += 25
    _draw_check(pdf, start_x, y, CHECKBOX_SIZE, fail_checked)
    pdf.set_xy(start_x + CHECKBOX_SIZE + 2, y - 0.5)
    pdf.cell(15, LINE_H, "FAIL", align="L")
    start_x += 25
    _draw_check(pdf, start_x, y, CHECKBOX_SIZE, na_checked)
    pdf.set_xy(start_x + CHECKBOX_SIZE + 2, y - 0.5)
    pdf.cell(15, LINE_H, "N/A", align="L")
    return y + LINE_H

def _output_pdf_bytes(pdf: FPDF) -> bytes:
    """
    รองรับ fpdf2 หลายเวอร์ชัน: บางเวอร์ชันคืน bytearray, บางเวอร์ชันคืน str (latin1)
    """
    data = pdf.output(dest="S")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    # fpdf2 เก่าอาจคืน str
    return data.encode("latin1")


def _draw_header(pdf: FPDF, base_font: str, issue_id: str = "-", inset_mm: float = 6.0) -> float:
    # ใช้ระยะเดียวกับกรอบนอก ไม่อิง l_margin/r_margin
    page_w = pdf.w - 2*inset_mm
    x0 = inset_mm
    y_top = inset_mm

    col_left, col_mid = 40, 120
    col_right = page_w - col_left - col_mid
    h_all = 30
    h_right_top = 12

    pdf.set_line_width(LINE_W_INNER)

    # โลโก้
    pdf.rect(x0, y_top, col_left, h_all)
    logo_path = _resolve_logo_path()
    if logo_path:
        IMG_W = 35
        img_x = x0 + (col_left - IMG_W) / 2
        img_y = y_top + (h_all - 16) / 2
        try:
            pdf.image(logo_path.as_posix(), x=img_x, y=img_y, w=IMG_W)
        except Exception:
            pass

    # กล่องกลาง
    box_x = x0 + col_left
    pdf.rect(box_x, y_top, col_mid, h_all)
    pdf.set_font(base_font, "B", 25)
    line_h = 6.2
    start_y = y_top + (h_all - line_h) / 2
    pdf.set_xy(box_x + 3, start_y)
    pdf.cell(col_mid - 6, line_h, "EV Charger Safety Test", align="C")

    # กล่องขวา (Page/Issue)
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_right_top)
    pdf.rect(xr, y_top + h_right_top, col_right, h_all - h_right_top)

    pdf.set_xy(xr, y_top + 4)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.cell(col_right, 6, f"Page {pdf.page_no()}", align="C")

    pdf.set_xy(xr, y_top + h_right_top + (h_all - h_right_top) / 2 - 5)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.multi_cell(col_right, 6, f"Issue ID\n{issue_id}", align="C")

    return y_top + h_all


def _kv_underline(pdf: FPDF, base_font: str, x: float, y: float, w: float,
                  label: str, value: str = "", row_h: float = 8.0,
                  label_w: float = 28.0, colon_w: float = 3.0):
    """Label : ________ (ปรับ label อัตโนมัติถ้าช่องแคบ และกันเส้นใต้ติดลบ)"""
    # คำนวณ label_w แบบปลอดภัยเมื่อช่อง w แคบ
    min_gap = 6.0  # เผื่อช่องว่างหลังโคลอนก่อนเริ่มเส้นใต้
    eff_label_w = min(label_w, max(w - colon_w - min_gap, 12.0))

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(eff_label_w, row_h, label, border=0, align="L")
    pdf.cell(colon_w, row_h, ":", border=0, align="C")

    lx1 = x + eff_label_w + colon_w + 1.5
    lx2 = x + w - 2.0
    ly  = y + row_h - 2.2

    lw_old = pdf.line_width
    pdf.set_line_width(0.35)

    # วาดเส้นใต้เฉพาะเมื่อมีระยะพอ
    if lx2 > lx1 + 1.0:
        pdf.line(lx1, ly, lx2, ly)

    pdf.set_line_width(lw_old)

    # วาดค่า value โดยไม่ล้นขอบ w
    if value and str(value).strip() != "-":
        text_x = x + eff_label_w + colon_w + 2.0
        text_w = max(2.0, w - (eff_label_w + colon_w + 4.0))
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.set_xy(text_x, y + 0.7)
        pdf.cell(text_w, row_h - 1.4, str(value), border=0, align="L")

def _draw_ev_header_form(pdf: FPDF, base_font: str, x: float, y: float, w: float,
                         manufacturer: str = "", model: str = "", power: str = "",
                         serial_no: str = "", location: str = "",
                         firmware: str = "", inspection_date: str = "",
                         power_w_mm: float = 32.0,   # 👈 กำหนดกว้างช่อง Power ที่นี่ (เช่น 28–36)
                         gap_mm: float = 4.0) -> float:

    row_h = 6
    left_w = w / 2.0
    right_w = w - left_w

    lx, rx = x, x + left_w
    y0 = y

    # แถวที่ 1
    _kv_underline(pdf, base_font, lx, y0, left_w,  "Manufacturer", manufacturer, row_h)
    _kv_underline(pdf, base_font, rx, y0, right_w, "Location",     location,     row_h)
    y0 += row_h

    # แถวที่ 2  (Model + Power)
    model_w = max(left_w - power_w_mm - gap_mm, 40.0)  # เผื่อขั้นต่ำของ Model
    _kv_underline(pdf, base_font, lx, y0, model_w,          "Model",  model,  row_h)
    _kv_underline(pdf, base_font, lx + model_w + gap_mm, y0, power_w_mm,
              "Power", power, row_h, label_w=10.0, colon_w=2.0)
    _kv_underline(pdf, base_font, rx, y0, right_w, "Firmware Version", firmware, row_h)
    y0 += row_h

    # แถวที่ 3
    _kv_underline(pdf, base_font, lx, y0, left_w,  "Serial Number",  serial_no,       row_h)
    _kv_underline(pdf, base_font, rx, y0, right_w, "Inspection Date", inspection_date, row_h)
    y0 += row_h

    return y0 + 2

def _kv_inline(pdf: FPDF, base_font: str, x: float, y: float, w: float,
               label: str, value: str = "", row_h: float = 8.0,
               label_w: float = 25.0, colon_w: float = 3.0):
    """เวอร์ชันสั้น ใช้เรียง 3 ช่องในบรรทัดเดียว (Manufacturer / Model / Serial Number)"""
    _kv_underline(pdf, base_font, x, y, w, label, value, row_h, label_w, colon_w)


def _draw_equipment_ident_details(pdf: FPDF, base_font: str, x: float, y: float, w: float,
                                  items: List[Dict[str, str]] | None = None,
                                  num_rows: int = 2) -> float:
    
    pdf.rect(6, 36, 198, 255)
    """หัวข้อ Equipment Identification Details + 2 บรรทัด (ตามภาพ)"""
    pdf.set_font(base_font, "BU", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(w, 2, "Equipment Identification Details", border=0, ln=1, align="L")
    y = pdf.get_y() + 1.0 

    row_h = 6.0
    num_w = 5.0
    # แบ่งความกว้างสามช่วง
    col1_w = (w - num_w) * 0.34
    col2_w = (w - num_w) * 0.28
    col3_w = (w - num_w) * 0.36

    items = items or []
    total = max(num_rows, len(items))

    for i in range(total):
        m = items[i].get("manufacturer", "") if i < len(items) else ""
        mo = items[i].get("model", "")        if i < len(items) else ""
        sn = items[i].get("serial_no", "")    if i < len(items) else ""

        # ลำดับ
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.set_xy(x, y)
        pdf.cell(num_w, row_h, str(i + 1), border=0, align="L")

        cx = x + num_w
        _kv_inline(pdf, base_font, cx, y, col1_w, "Manufacturer", m, row_h)
        cx += col1_w + 2
        _kv_inline(pdf, base_font, cx, y, col2_w, "Model", mo, row_h,15)
        cx += col2_w + 2
        _kv_inline(pdf, base_font, cx, y, col3_w, "Serial Number", sn, row_h)

        y += row_h

    return y

def draw_testing_topics_safety_section(pdf, x, y, base_font, font_size,
                                       table_width=None, safety=None):
    """
    วาดหัวข้อ
      'Testing Topics for Safety (Specifically Power Supply/Input Side)'
    + ตารางตามรูป (Electrical Safety table)

    เริ่มวาดที่ตำแหน่ง (x, y)
    คืนค่า y ตำแหน่งหลังจบตาราง
    """
    def _fmt_pe(entry: dict | None) -> str:
        """
        ใช้แปลง object เช่น {"h1": "2", "result": "PASS"} → "2 / PASS"
        ถ้าได้มาไม่ครบจะคืนอย่างใดอย่างหนึ่ง หรือว่างเปล่า
        """
        if not isinstance(entry, dict):
            return ""
        h1 = str(entry.get("h1") or "").strip()
        res = str(entry.get("result") or "").strip()
        if h1 and res:
            return f"{h1} / {res}"
        return h1 or res

    if table_width is None:
        table_width = pdf.w - pdf.l_margin - pdf.r_margin

    # ---------- ความกว้างคอลัมน์ ----------
    col_cat     = 20   # Electrical Safety (แนวตั้ง)
    col_pe      = 30   # PE.Continuity...
    col_item    = 25   # Left/Right/Front/Back/...
    col_test    = 28   # 1st / 2nd / 3rd TEST
    
    col_remark  = table_width - (col_cat + col_pe + col_item + 3 * col_test)

    h_header1 = 5 
    h_header2 = 7
    h_row     = 5

    # ---------- 1) หัวข้อบรรทัดบน ----------
    pdf.set_xy(x, y)
    pdf.set_font(base_font, "BU", font_size)
    pdf.cell(
        table_width, 6,
        "Testing Topics for Safety (Specifically Power Supply/Input Side)",
        border=0,
        ln=1,
        align="L",
    )

    y = pdf.get_y() + 2
    table_y0 = y
    lw_old = pdf.line_width
    pdf.set_line_width(0.3)

    # ---------- 2) Header แถวที่ 1 ----------
    pdf.set_font(base_font, "B", font_size)
    
    # ไม่วาดคอลัมน์ Electrical Safety ใน header (ตามรูป)
    pdf.set_xy(x + col_cat, y)
    
    # Testing Checklist
    pdf.cell(col_pe + col_item, h_header1+h_header2, "Testing Checklist", 1, 0, "C")
    
    # Test Results
    pdf.cell(
        col_test * 3,
        h_header1,
        "Test Results (Record as Pass/Fail) or Numeric Results",
        1,
        0,
        "C",
    )
    
    # Remark (merge 2 แถว)
    pdf.cell(col_remark, h_header1 + h_header2, "Remark", 1, 0, "C")
    
    y += h_header1

    # ---------- 3) Header แถวที่ 2 ----------
    pdf.set_xy(x + col_cat, y)
    
    # ช่องว่างใต้ Testing Checklist
    # pdf.cell(col_pe, h_header2, "", 1, 0, "C")
    # pdf.cell(col_item, h_header2, "", 1, 0, "C")
    # ช่องว่างใต้ Testing Checklist (merge col_pe + col_item)
    pdf.cell(col_pe + col_item, h_header2, "", 0, 0, "C")
    
    # Test columns
    pdf.cell(col_test, h_header2, "1st TEST", 1, 0, "C")
    pdf.cell(col_test, h_header2, "2nd TEST", 1, 0, "C")
    pdf.cell(col_test, h_header2, "3rd TEST", 1, 0, "C")
    
    y += h_header2
    y_body_start = y

    pdf.set_font(base_font, "", font_size)

    # ---------- 4) ส่วน PE.Continuity ----------
    items = [
        "Left Cover",
        "Right Cover",
        "Front Cover",
        "Back Cover",
        "Charger Stand",
        "Charger Case",
    ]

    # วาดกล่องใหญ่ PE.Continuity
    pe_rows = len(items)
    pe_h = pe_rows * h_row
    pdf.rect(x + col_cat, y, col_pe, pe_h)

    # ข้อความใน PE.Continuity
    pe_text_lines = [
        "PE.Continuity",
        "protective",
        "Conductors of",
        "Charger",
    ]
    text_total_h = len(pe_text_lines) * 4.0
    text_y = y + (pe_h - text_total_h) / 2.0
    
    pdf.set_font(base_font, "", font_size - 1)
    for i, ln in enumerate(pe_text_lines):
        pdf.set_xy(x + col_cat, text_y + i * 4.0)
        pdf.cell(col_pe, 4.0, ln, 0, 0, "C")
    pdf.set_font(base_font, "", font_size)

    # วาดแถว Left/Right/Front/Back/Stand/Case
    for txt in items:
        row_y = y

        # คอลัมน์ Electrical Safety (ว่างไว้)
        pdf.set_xy(x, row_y)
        # pdf.cell(col_cat, h_row, "", 1, 0, "C")
        pdf.cell(col_cat, h_row, "", 0, 0, "C")  # border=0

        # ข้ามพื้นที่ PE.Continuity
        pdf.set_xy(x + col_cat + col_pe, row_y)

        # คอลัมน์รายการ
        pdf.cell(col_item, h_row, txt, 1, 0, "L")

        # Test columns
        pdf.cell(col_test, h_row, "", 1, 0, "C")
        pdf.cell(col_test, h_row, "", 1, 0, "C")
        pdf.cell(col_test, h_row, "", 1, 0, "C")

        # Remark
        pdf.cell(col_remark, h_row, "", 1, 0, "L")

        y += h_row

    # ---------- 5) RCD type rows ----------
    rcd_rows = [
        ("RCD type A", "-", "mA"),
        ("RCD type F", "-", "mA"),
        ("RCD type B", "-", "mA"),
    ]

    for label, val, unit in rcd_rows:
        pdf.set_xy(x, y)
        
        # Electrical Safety (ว่าง)
        # pdf.cell(col_cat, h_row, "", 1, 0, "C")
        pdf.cell(col_cat, h_row, "", 0, 0, "C")
        
        # RCD type label
        pdf.cell(col_pe, h_row, label, 1, 0, "L")
        
        # แบ่งช่อง item เป็น 2 ส่วน
        w1 = col_item * 0.35
        w2 = col_item * 0.65
        pdf.cell(w1, h_row, val, 1, 0, "C")
        pdf.cell(w2, h_row, unit, 1, 0, "L")
        
        # Test columns
        pdf.cell(col_test, h_row, "", 1, 0, "C")
        pdf.cell(col_test, h_row, "", 1, 0, "C")
        pdf.cell(col_test, h_row, "", 1, 0, "C")
        
        # Remark
        pdf.cell(col_remark, h_row, "", 1, 0, "L")
        
        y += h_row

    # ---------- 6) Power standby ----------
    pdf.set_xy(x, y)
    # pdf.cell(col_cat, h_row, "", 1, 0, "C")
    pdf.cell(col_cat, h_row, "", 0, 0, "C")
    pdf.cell(col_pe, h_row, "Power standby", 1, 0, "L")
    pdf.cell(col_item, h_row, "", 1, 0, "C")
    
    # L1=, L2=, L3= พร้อมหน่วย A
    pdf.set_font(base_font, "", font_size - 1)
    pdf.cell(col_test, h_row, "L1=          A", 1, 0, "L")
    pdf.cell(col_test, h_row, "L2=          A", 1, 0, "L")
    pdf.cell(col_test, h_row, "L3=          A", 1, 0, "L")
    pdf.set_font(base_font, "", font_size)
    
    pdf.cell(col_remark, h_row, "", 1, 0, "L")
    
    y += h_row
    y_body_end = y

    # ---------- 7) Electrical Safety แนวตั้ง ----------
    body_height = y_body_end - y_body_start
    pdf.rect(x, y_body_start, col_cat, body_height)
    
    pdf.set_font(base_font, "B", 20)
    text = "Electrical Safety"
    text_width = pdf.get_string_width(text)
    
    text_x = x + col_cat / 2.0
    text_y = y_body_start + (body_height + text_width) / 2.0
    
    # ถ้า FPDF ไม่รองรับ rotation context manager ให้ใช้วิธีนี้แทน:
    try:
        with pdf.rotation(90, text_x, text_y):
            pdf.set_xy(text_x, text_y)
            pdf.cell(0, 0, text, 0, 0, "L")
    except:
        # สำรอง: เขียนแยกเป็น 2 บรรทัด
        text_lines = ["Electrical", "Safety"]
        line_h = 4.5
        total_h = len(text_lines) * line_h
        text_y2 = y_body_start + (body_height - total_h) / 2.0
        for i, ln in enumerate(text_lines):
            pdf.set_xy(x + 1, text_y2 + i * line_h)
            pdf.cell(col_cat - 2, line_h, ln, 0, 0, "C")

    # ---------- 8) กรอบนอกเส้นหนา ----------
    pdf.set_line_width(0.8)
    pdf.rect(x, table_y0, table_width, y_body_end - table_y0)
    pdf.set_line_width(lw_old)

    pdf.set_font(base_font, "", font_size)
    return y

# -------------------- Photo helpers (ปรับใหม่) --------------------
def _guess_img_type_from_ext(path_or_url: str) -> str:
    ext = os.path.splitext(str(path_or_url).lower())[1]
    if ext in (".png",):
        return "PNG"
    if ext in (".jpg", ".jpeg"):
        return "JPEG"
    return ""

def _find_public_root() -> Optional[Path]:
    env_dir = os.getenv("PUBLIC_DIR")
    if env_dir:
        p = Path(env_dir)
        if p.exists():
            return p
    cur = Path(__file__).resolve()
    for parent in [cur.parent, *cur.parents]:
        cand = parent / "public"
        if cand.exists():
            return cand
    return None

def _env_photo_headers() -> Optional[dict]:
    raw = os.getenv("PHOTOS_HEADERS") or ""
    hdrs = {}
    for seg in raw.split("|"):
        seg = seg.strip()
        if not seg or ":" not in seg:
            continue
        k, v = seg.split(":", 1)
        hdrs[k.strip()] = v.strip()
    return hdrs or None

def _load_image_source_from_urlpath(
    url_path: str,
) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
    if not url_path:
        return None, None

    print(f"[DEBUG] 🔍 กำลังหารูป: {url_path}")

    # Normalize
    raw = str(url_path).strip()
    # If it's already an absolute file path
    p_abs = Path(raw)
    if p_abs.is_absolute() and p_abs.exists() and p_abs.is_file():
        print(f"[DEBUG] ✅ พบเป็น absolute path: {p_abs}")
        return p_abs.as_posix(), _guess_img_type_from_ext(p_abs.as_posix())

    # Strip leading slash for easier joins
    clean_path = raw.lstrip("/")

    # If raw looks like a relative path containing "uploads/" remove leading "uploads/" when joining
    if clean_path.startswith("uploads/"):
        rel_after_uploads = clean_path[len("uploads/") :]
    else:
        rel_after_uploads = clean_path

    # 1) Try to find backend/uploads by searching parents for a folder named "backend"
    current_file = Path(__file__).resolve()
    backend_root = None
    for p in current_file.parents:
        if p.name.lower() == "backend" and p.exists():
            backend_root = p
            break
    # fallback: try a couple of reasonable parents (two levels up)
    if backend_root is None:
        for i in range(1, 4):
            cand = current_file.parents[i] if i < len(current_file.parents) else None
            if cand and (cand / "backend").exists():
                backend_root = cand / "backend"
                break

    tried_paths = []
    if backend_root is not None:
        uploads_root = backend_root / "uploads"
        if uploads_root.exists():
            candidate = uploads_root / rel_after_uploads
            tried_paths.append(candidate)
            print(f"[DEBUG] 📂 ตรวจสอบ backend/uploads: {candidate}")
            if candidate.exists() and candidate.is_file():
                print(f"[DEBUG] ✅ เจอไฟล์ใน backend/uploads: {candidate}")
                return candidate.as_posix(), _guess_img_type_from_ext(candidate.as_posix())

    # 2) Try sibling location: current_file.parents.../uploads (covers case project root/uploads)
    for i in range(0, min(5, len(current_file.parents))):
        cand_root = current_file.parents[i] / "uploads"
        candidate = cand_root / rel_after_uploads
        tried_paths.append(candidate)
        print(f"[DEBUG] 📂 ตรวจสอบ (parent-level {i}) : {candidate}")
        if candidate.exists() and candidate.is_file():
            print(f"[DEBUG] ✅ เจอไฟล์: {candidate}")
            return candidate.as_posix(), _guess_img_type_from_ext(candidate.as_posix())

    # 3) Try CWD/uploads
    cwd_uploads = Path.cwd() / "uploads"
    candidate = cwd_uploads / rel_after_uploads
    tried_paths.append(candidate)
    print(f"[DEBUG] 📂 ตรวจสอบไฟล์ที่ CWD: {candidate}")
    if candidate.exists() and candidate.is_file():
        print(f"[DEBUG] ✅ เจอไฟล์ที่ CWD: {candidate}")
        return candidate.as_posix(), _guess_img_type_from_ext(candidate.as_posix())

    # 4) Try public root if exists
    public_root = _find_public_root()
    if public_root:
        candidate = public_root / clean_path
        tried_paths.append(candidate)
        print(f"[DEBUG] 📂 ลองหาใน public: {candidate}")
        if candidate.exists() and candidate.is_file():
            print(f"[DEBUG] ✅ เจอไฟล์ใน public: {candidate}")
            return candidate.as_posix(), _guess_img_type_from_ext(candidate.as_posix())

    # 5) If url_path itself looks like a relative filename (no folders), try searching inside common subfolders
    #    (e.g., doc contains only "image.png") — try inside typical category folders
    filename_only = Path(clean_path).name
    common_folders = ["charger", "circuit_breaker", "gun1", "gun2", "nameplate", "rcd"]
    for root_try in (backend_root, Path.cwd(), public_root):
        if not root_try:
            continue
        for cf in common_folders:
            candidate = root_try / "uploads" / "dctest" / cf / filename_only
            tried_paths.append(candidate)
            if candidate.exists() and candidate.is_file():
                print(f"[DEBUG] ✅ เจอไฟล์โดยค้นหา common folders: {candidate}")
                return candidate.as_posix(), _guess_img_type_from_ext(candidate.as_posix())

    # 6) Try HTTP if base url provided
    base_url = os.getenv("PHOTOS_BASE_URL") or os.getenv("APP_BASE_URL") or ""
    print(f"[DEBUG] PHOTOS_BASE_URL = {base_url}")
    if base_url and requests is not None:
        full_url = base_url.rstrip("/") + "/" + clean_path.lstrip("/")
        print(f"[DEBUG] 🌐 พยายามดาวน์โหลดจาก: {full_url}")
        try:
            resp = requests.get(full_url, headers=_env_photo_headers(), timeout=10)
            resp.raise_for_status()
            print(f"[DEBUG] ✅ ดาวน์โหลดสำเร็จ: {len(resp.content)} bytes")
            bio = BytesIO(resp.content)
            return bio, _guess_img_type_from_ext(full_url)
        except Exception as e:
            print(f"[DEBUG] ❌ ดาวน์โหลดล้มเหลว: {e}")

    # Nothing found
    print("[DEBUG] ❌ ไม่พบรูปภาพจากทุกวิธี — paths tried:")
    for p in tried_paths:
        print("  -", p)
    return None, None

def _get_photo_items_for_idx(doc: dict, idx: int) -> List[dict]:
    """
    อ่านรูปจาก doc["photos"]["g{idx}"] → list ของ dict ที่มี key 'url'
    """
    photos = ((doc.get("photos") or {}).get(f"g{idx}") or [])
    out = []
    for p in photos:
        if isinstance(p, dict) and p.get("url"):
            out.append(p)
    return out[:PHOTO_MAX_PER_ROW]



# -------------------------------------
# 🔸 ค่าคงที่เกี่ยวกับตารางรูปภาพ
# -------------------------------------
PHOTO_MAX_PER_ROW = 3
PHOTO_IMG_MAX_H = 60
PHOTO_GAP = 3
PHOTO_PAD_X = 2
PHOTO_PAD_Y = 4
PHOTO_ROW_MIN_H = 15

def _draw_photos_table_header(
    pdf: FPDF, base_font: str, x: float, y: float, q_w: float, g_w: float
) -> float:
    header_h = 9.0
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_xy(x, y)
    pdf.cell(q_w, header_h, "ข้อ / คำถาม", border=1, align="C")
    pdf.cell(g_w, header_h, "รูปภาพประกอบ", border=1, ln=1, align="C")
    return y + header_h

def _draw_picture_page(pdf: FPDF, base_font: str, issue_id: str, doc: dict):
    """วาดหน้ารูปภาพแบบ 2 คอลัมน์ตามรูปแบบที่กำหนด"""
    pdf.add_page()

    x0 = 10
    page_w = pdf.w - 20

    # วาด header แบบพิเศษสำหรับหน้า PICTURE
    inset_mm = 10
    y_top = inset_mm
    col_left, col_mid = 40, 120
    col_right = page_w - col_left - col_mid
    h_all = 30
    h_right_top = 15

    pdf.set_line_width(LINE_W_INNER)

    # โลโก้
    pdf.rect(x0, y_top, col_left, h_all)
    logo_path = _resolve_logo_path()
    if logo_path:
        IMG_W = 35
        img_x = x0 + (col_left - IMG_W) / 2
        img_y = y_top + (h_all - 16) / 2
        try:
            pdf.image(logo_path.as_posix(), x=img_x, y=img_y, w=IMG_W)
        except Exception:
            pass

    # กล่องกลาง - แสดง "Photos"
    box_x = x0 + col_left
    pdf.rect(box_x, y_top, col_mid, h_all)
    pdf.set_font(base_font, "B", 28)
    pdf.set_xy(box_x, y_top + (h_all - 8) / 2)
    pdf.cell(col_mid, 8, "Photos", align="C")
    
    # pdf.set_font(base_font, "", 18)
    # pdf.set_xy(box_x, y_top + h_all + 2)  # เลื่อนลงมานิดหน่อยจากกล่อง Photos
    # pdf.cell(col_mid, 8, "DC Charger Test", align="C")

    # กล่องขวา - แสดง Page / Issue ID
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_right_top)
    pdf.rect(xr, y_top + h_right_top, col_right, h_all - h_right_top)

    pdf.set_xy(xr, y_top + 4)
    pdf.set_font(base_font, "", FONT_MAIN)
    # แก้ไข: แสดงหมายเลขหน้าปัจจุบัน (pdf.page_no())
    pdf.cell(col_right, 6, f"Page {pdf.page_no()}", align="C") 

    pdf.set_xy(xr, y_top + h_right_top + (h_all - h_right_top) / 2 - 3)
    pdf.set_font(base_font, "B", 16)
    # แก้ไข: แสดง issue_id แทน "2 / 2"
    pdf.cell(col_right, 8, issue_id, align="C") 

    y = y_top + h_all + 5

    # ดึงรูปภาพจาก doc
    photos = doc.get("photos", {}) or {}

    # กำหนดหมวดหมู่รูปภาพ
    photo_categories = [
        ("nameplate", "Nameplate"),
        ("charger", "Charger"),
        ("circuit_breaker", "Circuit Breaker"),
        ("rcd", "RCD"),
        ("gun1", "GUN 1"),
        ("gun2", "GUN 2"),
    ]

    # ตั้งค่าขนาดกรอบรูป - ลดขนาดให้พอดีในหน้าเดียว
    col_w = (page_w - 10) / 2  # ความกว้างแต่ละคอลัมน์
    img_h = 55  # ลดความสูงจาก 70 เป็น 55
    label_h = 6  # ลดความสูง label จาก 7 เป็น 6
    total_h = img_h + label_h
    gap_between_rows = 3  # ระยะห่างระหว่างแถว

    # คำนวณพื้นที่ที่ต้องการทั้งหมด
    total_needed = (total_h * 3) + (gap_between_rows * 2)  # 3 แถว + ช่องว่าง 2 ช่อง
    available_space = pdf.h - y - 20  # พื้นที่ว่างที่เหลือ

    # ถ้าพื้นที่ไม่พอ ให้ปรับขนาดรูปให้เล็กลง
    if total_needed > available_space:
        scale_factor = available_space / total_needed
        img_h = int(img_h * scale_factor)
        total_h = img_h + label_h
        gap_between_rows = 2

    # วาดรูปภาพทีละคู่ (2 คอลัมน์)
    for i in range(0, len(photo_categories), 2):
        # คอลัมน์ซ้าย
        cat_key_left = photo_categories[i][0]
        cat_name_left = photo_categories[i][1]
        photo_list_left = photos.get(cat_key_left, [])

        x_left = x0

        # วาดกรอบรูปซ้าย
        pdf.rect(x_left, y, col_w, img_h)

        # แสดงรูปถ้ามี
        if photo_list_left and len(photo_list_left) > 0:
            url_path = photo_list_left[0].get("url", "")
            src, img_type = _load_image_source_from_urlpath(url_path)
            if src:
                try:
                    pdf.image(
                        src,
                        x=x_left + 2,
                        y=y + 2,
                        w=col_w - 4,
                        h=img_h - 4,
                        type=(img_type or None),
                    )
                except Exception as e:
                    print(f"[DEBUG] ❌ ไม่สามารถแสดงรูป: {e}")

        # วาดชื่อหมวดหมู่ซ้าย
        pdf.rect(x_left, y + img_h, col_w, label_h)
        pdf.set_xy(x_left, y + img_h + 0.5)
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.cell(col_w, label_h - 1, cat_name_left, border=0, align="C")

        # คอลัมน์ขวา (ถ้ามี)
        if i + 1 < len(photo_categories):
            cat_key_right = photo_categories[i + 1][0]
            cat_name_right = photo_categories[i + 1][1]
            photo_list_right = photos.get(cat_key_right, [])

            x_right = x0 + col_w + 10

            # วาดกรอบรูปขวา
            pdf.rect(x_right, y, col_w, img_h)

            # แสดงรูปถ้ามี
            if photo_list_right and len(photo_list_right) > 0:
                url_path = photo_list_right[0].get("url", "")
                src, img_type = _load_image_source_from_urlpath(url_path)
                if src:
                    try:
                        pdf.image(
                            src,
                            x=x_right + 2,
                            y=y + 2,
                            w=col_w - 4,
                            h=img_h - 4,
                            type=(img_type or None),
                        )
                    except Exception as e:
                        print(f"[DEBUG] ❌ ไม่สามารถแสดงรูป: {e}")

            # วาดชื่อหมวดหมู่ขวา
            pdf.rect(x_right, y + img_h, col_w, label_h)
            pdf.set_xy(x_right, y + img_h + 0.5)
            pdf.set_font(base_font, "B", FONT_MAIN)
            pdf.cell(col_w, label_h - 1, cat_name_right, border=0, align="C")

        y += total_h + gap_between_rows  # เพิ่ม y สำหรับแถวถัดไป


def _draw_photos_row(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    q_w: float,
    g_w: float,
    question_text: str,
    image_items: List[dict],
) -> float:
    """
    วาด 1 แถว: ซ้ายข้อความ, ขวารูป ≤ PHOTO_MAX_PER_ROW
    """
    _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)
    img_h = PHOTO_IMG_MAX_H
    row_h = max(ROW_MIN_H, text_h, img_h + 2 * PADDING_Y)

    # ซ้าย: คำถาม
    _cell_text_in_box(
        pdf, x, y, q_w, row_h, question_text, align="L", lh=LINE_H, valign="top"
    )

    # ขวา: รูป
    gx = x + q_w
    pdf.rect(gx, y, g_w, row_h)

    slot_w = (
        g_w - 2 * PADDING_X - (PHOTO_MAX_PER_ROW - 1) * PHOTO_GAP
    ) / PHOTO_MAX_PER_ROW
    cx = gx + PADDING_X
    cy = y + (row_h - img_h) / 2.0

    images = (image_items or [])[:PHOTO_MAX_PER_ROW]
    pdf.set_font(base_font, "", FONT_MAIN)

    for i in range(PHOTO_MAX_PER_ROW):
        if i > 0:
            pdf.line(cx - (PHOTO_GAP / 2.0), y, cx - (PHOTO_GAP / 2.0), y + row_h)

        if i < len(images):
            url_path = (images[i] or {}).get("url", "")
            src, img_type = _load_image_source_from_urlpath(url_path)
            if src is not None:
                try:
                    pdf.image(
                        src, x=cx, y=cy, w=slot_w, h=img_h, type=(img_type or None)
                    )
                except Exception:
                    pdf.set_xy(cx, cy + (img_h - LINE_H) / 2.0)
                    pdf.cell(slot_w, LINE_H, "-", border=0, align="C")
            else:
                pdf.set_xy(cx, cy + (img_h - LINE_H) / 2.0)
                pdf.cell(slot_w, LINE_H, "-", border=0, align="C")
        cx += slot_w + PHOTO_GAP

    pdf.set_xy(x + q_w + g_w, y)
    return row_h

def make_pm_report_html_pdf_bytes(doc: dict) -> bytes:
    pdf = HTML2PDF(unit="mm", format="A4")
    pdf.set_margins(left=10, top=10, right=10)
    pdf.set_auto_page_break(auto=True, margin=12)

    # ---- โหลดฟอนต์ไทยให้แน่นอนก่อน set_font ----
    base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
    pdf.set_font(base_font, size=FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)

    # job = doc.get("job", {}) or {}
    # station_name = job.get("station_name", "-")
    # model = job.get("model", "-")
    # sn = job.get("sn", "-")
    # pm_date = _fmt_date_thai_like_sample(doc.get("pm_date", job.get("date", "-")))
    issue_id = str(doc.get("issue_id", "-"))

    # checks = _rows_to_checks(doc.get("rows") or {}, doc.get("measures") or {})

    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left
    EDGE_ALIGN_FIX = (LINE_W_OUTER - LINE_W_INNER) / 2.0

    col_left, col_mid = 40, 120
    col_right = page_w - col_left - col_mid
    h_all = 30
    h_right_top = 12
    pdf.set_line_width(LINE_W_INNER)

    # เริ่มหน้าแรกด้วย add_page แล้วเรียก header ทันที (สำคัญ)
    pdf.add_page()
    # _draw_page_frame(pdf, inset_mm=6)   # 👈 ปรับเป็น 5–8 ได้ตามต้องการ (ขอบกระดาษ)
    y = _draw_header(pdf, base_font, issue_id)

    # ====== ฟอร์มรายละเอียดตามภาพ ======
    head = doc.get("head", {}) or {}
    manufacturer = head.get("manufacturer")
    model        = head.get("model", "")
    power        = head.get("power", "")
    serial_no    = head.get("serial_number", "")
    location     = head.get("location", "")
    firmware     = head.get("firmware_version", "")
    inspection   = str(doc.get("inspection_date") or "")

    y = _draw_ev_header_form(pdf, base_font, x0, y, page_w,
                         manufacturer, model, power, serial_no,
                         location, firmware, inspection,
                         power_w_mm=30.0) 

    # หัวข้อ Equipment Identification Details (รองรับข้อมูลถ้ามี ไม่มีก็วาดช่องเปล่า 2 บรรทัด)
    # equip_items = (doc.get("equipments") or [])  # [{manufacturer, model, serial_no}, ...]
    # y = _draw_equipment_ident_details(pdf, base_font, x0, y, page_w, equip_items, num_rows=5)

    eq = doc.get("equipment") or {}

    mans = eq.get("manufacturers") or []
    mods = eq.get("models") or []
    sns  = eq.get("serialNumbers") or []

    rows = max(len(mans), len(mods), len(sns))

    equip_items = []
    for i in range(rows):
        equip_items.append({
            "manufacturer": mans[i] if i < len(mans) else "",
            "model":        mods[i] if i < len(mods) else "",
            "serial_no":    sns[i]  if i < len(sns)  else "",
        })

    y = _draw_equipment_ident_details(pdf, base_font, x0, y, page_w, equip_items, num_rows=5)

    # เว้นระยะนิดหน่อยแล้ววาดตาราง
    y += 2

    y = draw_testing_topics_safety_section(
        pdf,
        x=x0 + EDGE_ALIGN_FIX,
        y=y,
        base_font=base_font,
        font_size=FONT_MAIN,
    )
    # ตารางรายการ
    # x_table = x0 + EDGE_ALIGN_FIX
    # table_total_w = page_w - 2 * EDGE_ALIGN_FIX
    # pdf.set_line_width(LINE_W_INNER)
    # pdf.set_font(base_font, "", FONT_MAIN)

    item_w = 65
    result_w = 64
    remark_w = page_w - item_w - result_w

    # _ensure_space ต้องถูกนิยามหลังจาก y ถูกประกาศ (เพื่อให้ nonlocal ถูกต้อง)
    def _ensure_space(height_needed: float):
        nonlocal y
        if y + height_needed > (pdf.h - pdf.b_margin):
            pdf.add_page()
            y = _draw_header(pdf, base_font, issue_id)
            # หลังขึ้นหน้าใหม่ ให้วาด header แล้ววาดหัวตารางด้วย
            # y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w)
            pdf.set_font(base_font, "", FONT_MAIN)

    pdf.set_font(base_font, "", FONT_MAIN)

    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_draw_color(0, 0, 0)

    # ช่องเซ็นชื่อ
    signer_labels = ["Performed by", "Approved by", "Witnessed by"]
    pdf.set_line_width(LINE_W_INNER)

    # ใช้ความกว้างของแต่ละคอลัมน์จริงแทน col_w
    col_widths = [item_w, result_w, remark_w]
    row_h_header = 12
    row_h_sig = 16
    row_h_name = 7
    row_h_date = 7
    total_sig_h = row_h_header + row_h_sig + row_h_name + row_h_date

    _ensure_space(total_sig_h + 5)

    # -------------------------------
    # ขึ้นหน้าใหม่สำหรับรูป (เรียก header ทุกครั้งหลัง add_page)
    # -------------------------------
    # pdf.add_page()
    # # _draw_page_frame(pdf, inset_mm=6)   # 👈 ปรับเป็น 5–8 ได้ตามต้องการ (ขอบกระดาษ)

    # # วาด header เหมือนหน้าก่อนหน้า
    # x0 = 10
    # y = _draw_header(pdf, base_font, issue_id)  # วาดหัวกระดาษ

    # # ชื่อเอกสาร
    # pdf.set_xy(x0, y)
    # pdf.set_font(base_font, "B", 16)
    # pdf.cell(page_w, 10, "Manufacturer", border=1, ln=1, align="C")
    # y += 10

    # # แสดงข้อมูลงานใต้หัวเรื่อง
    # # y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, model, sn, pm_date)
    
    # # photo
    # pdf.set_xy(x0, y)
    # pdf.set_font(base_font, "B", 14)
    # pdf.set_fill_color(255, 230, 100)
    # pdf.cell(page_w, 10, "Photos", border=1, ln=1, align="C", fill=True)
    # y += 10

    # # ========== ตารางรูปแบบ 2 คอลัมน์: r# (ซ้าย) / g# (ขวา) ==========
    # # ตั้งค่าความกว้างคอลัมน์
    # x_table = x0 + EDGE_ALIGN_FIX
    # q_w = 85.0                       # กว้างคอลัมน์ "ข้อ/คำถาม"
    # g_w = (page_w - 2 * EDGE_ALIGN_FIX) - q_w  # กว้างคอลัมน์รูป

    # # ฟังก์ชันตรวจพื้นที่ (ใช้ตัวเดียวกับตารางก่อนหน้า)
    # def _ensure_space_photo(height_needed: float):
    #     nonlocal y
    #     if y + height_needed > (pdf.h - pdf.b_margin):
    #         pdf.add_page()
    #         y = _draw_header(pdf, base_font, issue_id)
    #         # หัวเรื่องย่อย Photos ซ้ำเมื่อขึ้นหน้าใหม่เพื่อไม่ให้สับสน
    #         pdf.set_xy(x0, y)
    #         pdf.set_font(base_font, "B", 14)
    #         pdf.set_fill_color(255, 230, 100)
    #         pdf.cell(page_w, 10, "Photos (ต่อ)", border=1, ln=1, align="C", fill=True)
    #         y += 10
    #         y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)

    # # วาดหัวตาราง Photos
    # y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)
    # pdf.set_font(base_font, "", FONT_MAIN)

    # วาดทีละข้อ โดย map r# -> g# จาก doc["photos"]
    # for it in checks:
    #     idx = int(it.get("idx") or 0)
    #     question_text = ROW_TITLES.get(f"r{idx}", it.get("text", f"{idx}. -"))

    #     # ดึงรูป: photos.g{idx}[].url
    #     img_items = _get_photo_items_for_idx(doc, idx)

    #     # ประเมินพื้นที่ก่อนขึ้นหน้าใหม่
    #     _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)
    #     est_row_h = max(ROW_MIN_H, text_h, PHOTO_IMG_MAX_H + 2 * PADDING_Y)
    #     _ensure_space_photo(est_row_h)

    #     # วาดแถว
    #     row_h_used = _draw_photos_row(pdf, base_font, x_table, y, q_w, g_w, question_text, img_items)
    #     y += row_h_used
    # เพิ่มหน้ารูปภาพ (PICTURE page)
    _draw_picture_page(pdf, base_font, issue_id, doc)

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_fill_color(255, 230, 100)
    
    return _output_pdf_bytes(pdf)


# Public API expected by pdf_routes: generate_pdf(data) -> bytes
def generate_pdf(data: dict) -> bytes:
    """
    Adapter for existing pdf_routes which expects each template to expose
    generate_pdf(data) returning PDF bytes.
    `data` is the Mongo document / dict for that PM report.
    """
    return make_pm_report_html_pdf_bytes(data)
