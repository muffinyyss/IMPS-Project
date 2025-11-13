# backend/pdf/templates/pdf_dctest.py
from fpdf import FPDF, HTMLMixin
from pathlib import Path
from datetime import datetime, date
import os
import re
from typing import Optional, Tuple, List, Dict, Any, Union
import base64
from io import BytesIO

try:
    import requests  # optional ถ้าไม่มี base_url ก็ไม่จำเป็น
except Exception:
    requests = None


# -------------------- ฟอนต์ไทย --------------------
FONT_CANDIDATES: Dict[str, List[str]] = {
    "": [
        "THSarabunNew.ttf",
        "TH Sarabun New.ttf",
        "THSarabun.ttf",
        "TH SarabunPSK.ttf",
    ],
    "B": [
        "THSarabunNew-Bold.ttf",
        "THSarabunNew Bold.ttf",
        "TH Sarabun New Bold.ttf",
        "THSarabun Bold.ttf",
    ],
    "I": [
        "THSarabunNew-Italic.ttf",
        "THSarabunNew Italic.ttf",
        "TH Sarabun New Italic.ttf",
        "THSarabun Italic.ttf",
    ],
    "BI": [
        "THSarabunNew-BoldItalic.ttf",
        "THSarabunNew BoldItalic.ttf",
        "TH Sarabun New BoldItalic.ttf",
        "THSarabun BoldItalic.ttf",
    ],
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
        here / "fonts",  # backend/pdf/templates/fonts
        here.parent / "fonts",  # backend/pdf/fonts ตรงกับที่คุณเก็บไว้
        Path("C:/Windows/Fonts"),  # Windows
        Path("/Library/Fonts"),  # macOS system
        Path(os.path.expanduser("~/Library/Fonts")),  # macOS user
        Path("/usr/share/fonts"),  # Linux
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
            pdf.add_font(family_name, style, str(p), uni=True)
            if style == "":
                loaded_regular = True
        except Exception:
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


def _cell_text_in_box(
    pdf: FPDF,
    x: float,
    y: float,
    w: float,
    h: float,
    text: str,
    align="L",
    lh=LINE_H,
    valign="middle",
):
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
                        while (
                            k <= len(buf) and pdf.get_string_width(buf[:k]) <= inner_w
                        ):
                            k += 1
                        lines.append(buf[: k - 1])
                        buf = buf[k - 1 :]
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
    names = [
        "logo_egat.png",
        "logo_egatev.png",
        "logo_egat_ev.png",
        "egat_logo.png",
        "logo-ct.png",
        "logo_ct.png",
        "logo_egat.jpg",
        "logo_egat.jpeg",
    ]
    roots = [
        Path(__file__).parent / "assets",
        Path(__file__).parent.parent / "assets",
        Path(__file__).resolve().parents[3] / "public" / "img",
        Path(__file__).resolve().parents[3] / "public" / "img" / "logo",
    ]
    for root in roots:
        if not root.exists():
            continue
        for nm in names:
            p = root / nm
            if p.exists() and p.is_file():
                return p
    return None


def _output_pdf_bytes(pdf: FPDF) -> bytes:
    data = pdf.output(dest="S")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    return data.encode("latin1")


def _draw_header(
    pdf: FPDF, base_font: str, issue_id: str = "-", inset_mm: float = 6.0
) -> float:
    page_w = pdf.w - 2 * inset_mm
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

    row_h = 8.2
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
    pdf.cell(w, 5, "Equipment Identification Details", border=0, ln=1, align="L")
    y = pdf.get_y() + 2.0 

    row_h = 8.0
    num_w = 6.0
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

def draw_testing_topics_safety_section(pdf, x, y, base_font, font_size):
    """
    วาดทั้งหัวข้อ
      'Testing Topics for Safety (Specifically Power Supply/Input Side)'
    และตารางตามรูป ในฟังก์ชันเดียว

    เริ่มวาดที่ตำแหน่ง (x, y)
    คืนค่า y ตำแหน่งถัดไปหลังจากตาราง
    """

    # ----------------- คำนวณความกว้างตาราง -----------------
    table_width = pdf.w - pdf.l_margin - pdf.r_margin

    col_cat     = 22  # Electrical Safety
    col_section = 42  # กลุ่ม / หัวข้อ
    col_item    = 52  # รายการย่อย
    col_test    = 26  # 1st / 2nd / 3rd TEST
    col_remark  = table_width - (col_cat + col_section + col_item + 3 * col_test)

    h_header1 = 8
    h_header2 = 7
    h_row     = 7

    # ----------------- 1) หัวข้อใหญ่ -----------------
    pdf.set_xy(x, y)
    pdf.set_font(base_font, "BU", font_size)  # หนา + ขีดเส้นใต้
    pdf.cell(
        table_width, 6,
        "Testing Topics for Safety (Specifically Power Supply/Input Side)",
        border=0,
        ln=1,
        align="L",
    )

    # เว้นระยะหน่อยก่อนเริ่มตาราง
    y = pdf.get_y() + 3
    pdf.set_font(base_font, "B", font_size)

    # ----------------- 2) Header แถวที่ 1 -----------------
    pdf.set_xy(x, y)

    pdf.cell(col_cat, h_header1, "", 1, 0, "C")  # ช่องว่าง Electrical Safety
    pdf.cell(col_section + col_item, h_header1, "Testing Checklist", 1, 0, "C")
    pdf.cell(
        col_test * 3,
        h_header1,
        "Test Results (Record as Pass/Fail) or Numeric Results",
        1,
        0,
        "C",
    )
    pdf.cell(col_remark, h_header1, "Remark", 1, 1, "C")

    # ----------------- 3) Header แถวที่ 2 -----------------
    pdf.set_x(x)

    pdf.cell(col_cat, h_header2, "", 1, 0, "C")
    pdf.cell(col_section, h_header2, "", 1, 0, "C")
    pdf.cell(col_item,    h_header2, "", 1, 0, "C")

    pdf.cell(col_test, h_header2, "1st TEST", 1, 0, "C")
    pdf.cell(col_test, h_header2, "2nd TEST", 1, 0, "C")
    pdf.cell(col_test, h_header2, "3rd TEST", 1, 0, "C")

    pdf.cell(col_remark, h_header2, "", 1, 1, "C")

    y_body_start = pdf.get_y()

    # ----------------- 4) เนื้อหาตาราง -----------------
    pdf.set_font(base_font, "", font_size)

    rows = [
        ("PE continuity of charger", "Left Cover"),
        ("", "Right Cover"),
        ("", "Front Cover"),
        ("", "Back Cover"),
        ("", "Charger Stand"),
        ("", "Charger Case"),
        ("RCD type A", ""),
        ("RCD type F", ""),
        ("RCD type B", ""),
        ("Power standby", ""),
    ]

    for section, item in rows:
        pdf.set_x(x)

        pdf.cell(col_cat, h_row, "", 1, 0, "C")   # Electrical Safety (เว้นไว้ก่อน)
        pdf.cell(col_section, h_row, section, 1, 0, "L")
        pdf.cell(col_item,    h_row, item,    1, 0, "L")

        pdf.cell(col_test, h_row, "", 1, 0, "C")  # 1st TEST
        pdf.cell(col_test, h_row, "", 1, 0, "C")  # 2nd TEST
        pdf.cell(col_test, h_row, "", 1, 0, "C")  # 3rd TEST

        pdf.cell(col_remark, h_row, "", 1, 1, "L")

    y_body_end = pdf.get_y()

    # ----------------- 5) เขียนคำว่า "Electrical Safety" -----------------
    text = "Electrical\nSafety"
    line_h = 4
    num_lines = text.count("\n") + 1
    total_text_h = line_h * num_lines

    text_y = y_body_start + ((y_body_end - y_body_start) - total_text_h) / 2.0

    pdf.set_font(base_font, "B", font_size)
    pdf.set_xy(x, text_y)
    pdf.multi_cell(col_cat, line_h, text, border=0, align="C")

    pdf.set_font(base_font, "", font_size)

    return pdf.get_y()


# -------------------- Photo helpers --------------------
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
    """
    รับ '/uploads/dctest/Klongluang3/68efc.../charger/image.png' → คืน (src, img_type)
    1) ลองแมปเป็นไฟล์จริง: backend/uploads/dctest/... หรือ backend/uploads/pm/...
    2) ถ้าไม่เจอและมี PHOTOS_BASE_URL → ดาวน์โหลด
    3) ถ้ายังไม่ได้ → (None, None)
    """
    if not url_path:
        return None, None

    print(f"[DEBUG] 🔍 กำลังหารูป: {url_path}")

    # 1) หา backend/uploads โดยตรง
    backend_root = Path(__file__).resolve().parents[2]
    uploads_root = backend_root / "uploads"

    print(f"[DEBUG] backend_root = {backend_root}")
    print(f"[DEBUG] uploads_root = {uploads_root}")

    if uploads_root.exists():
        clean_path = url_path.lstrip("/")
        if clean_path.startswith("uploads/"):
            clean_path = clean_path[8:]

        local_path = uploads_root / clean_path
        print(f"[DEBUG] 📂 ตรวจสอบไฟล์: {local_path}")

        if local_path.exists() and local_path.is_file():
            print(f"[DEBUG] ✅ เจอไฟล์แล้ว!")
            return local_path.as_posix(), _guess_img_type_from_ext(
                local_path.as_posix()
            )
        else:
            print(f"[DEBUG] ❌ ไม่เจอไฟล์ที่: {local_path}")
    else:
        print(f"[DEBUG] ⚠️ ไม่มีโฟลเดอร์ uploads: {uploads_root}")

    # 2) ลอง public_root
    public_root = _find_public_root()
    if public_root:
        local_path = public_root / url_path.lstrip("/")
        print(f"[DEBUG] 📂 ลองหาใน public: {local_path}")

        if local_path.exists() and local_path.is_file():
            print(f"[DEBUG] ✅ เจอไฟล์ใน public!")
            return local_path.as_posix(), _guess_img_type_from_ext(
                local_path.as_posix()
            )

    # 3) ดาวน์โหลดผ่าน HTTP
    base_url = os.getenv("PHOTOS_BASE_URL") or os.getenv("APP_BASE_URL") or ""
    print(f"[DEBUG] PHOTOS_BASE_URL = {base_url}")

    if base_url and requests is not None:
        full_url = base_url.rstrip("/") + "/" + url_path.lstrip("/")
        print(f"[DEBUG] 🌐 พยายามดาวน์โหลดจาก: {full_url}")

        try:
            resp = requests.get(full_url, headers=_env_photo_headers(), timeout=10)
            resp.raise_for_status()
            print(f"[DEBUG] ✅ ดาวน์โหลดสำเร็จ: {len(resp.content)} bytes")
            bio = BytesIO(resp.content)
            return bio, _guess_img_type_from_ext(full_url)
        except Exception as e:
            print(f"[DEBUG] ❌ ดาวน์โหลดล้มเหลว: {e}")

    print("[DEBUG] ❌ ไม่พบรูปภาพจากทุกวิธี")
    return None, None


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

    # กล่องกลาง - แสดง "PICTURE"
    box_x = x0 + col_left
    pdf.rect(box_x, y_top, col_mid, h_all)
    pdf.set_font(base_font, "B", 28)
    pdf.set_xy(box_x, y_top + (h_all - 8) / 2)
    pdf.cell(col_mid, 8, "PICTURE", align="C")

    # กล่องขวา - แสดง Page 2 / 2
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_right_top)
    pdf.rect(xr, y_top + h_right_top, col_right, h_all - h_right_top)

    pdf.set_xy(xr, y_top + 4)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.cell(col_right, 6, "Page", align="C")

    pdf.set_xy(xr, y_top + h_right_top + (h_all - h_right_top) / 2 - 3)
    pdf.set_font(base_font, "B", 16)
    pdf.cell(col_right, 8, "2  /  2", align="C")

    y = y_top + h_all

    # ข้อมูล head
    head = doc.get("head", {}) or {}
    manufacturer = head.get("manufacturer111", "0")
    model = head.get("model", "0")
    power = head.get("power", "-")
    serial_no = head.get("serial_number", "0")
    location = head.get("location", "0")
    firmware = head.get("firmware_version", "0")
    inspection = _fmt_date_thai_like_sample(doc.get("inspection_date", "0-Jan-00"))

    # วาดข้อมูลด้านบน (3 แถว) ตามรูปแบบในภาพ
    row_h = 7.0
    left_w = page_w / 2.0
    right_w = page_w - left_w

    pdf.set_font(base_font, "B", FONT_MAIN)

    # แถวที่ 1: Manufacturer | Location
    pdf.set_xy(x0, y)
    pdf.cell(30, row_h, "Manufacturer", border=0)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.cell(3, row_h, ":", border=0)
    pdf.cell(left_w - 33, row_h, manufacturer, border=0)

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(30, row_h, "Location", border=0)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.cell(3, row_h, ":", border=0)
    pdf.cell(right_w - 33, row_h, location, border=0, ln=1)
    y += row_h

    # แถวที่ 2: Model + Power | Firmware Version
    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(30, row_h, "Model", border=0)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.cell(3, row_h, ":", border=0)
    pdf.cell(left_w / 2 - 33, row_h, model, border=0)

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(20, row_h, "Power :", border=0)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.cell(left_w / 2 - 20, row_h, power, border=0)

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(35, row_h, "Firmware Version", border=0)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.cell(3, row_h, ":", border=0)
    pdf.cell(right_w - 38, row_h, firmware, border=0, ln=1)
    y += row_h

    # แถวที่ 3: Serial Number | Inspection Date
    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(30, row_h, "Serial Number", border=0)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.cell(3, row_h, ":", border=0)
    pdf.cell(left_w - 33, row_h, serial_no, border=0)

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(35, row_h, "Inspection Date", border=0)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.cell(3, row_h, ":", border=0)
    pdf.cell(right_w - 38, row_h, inspection, border=0, ln=1)
    y += row_h + 3

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


def _kv_underline(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    label: str,
    value: str = "",
    row_h: float = 8.0,
    label_w: float = 28.0,
    colon_w: float = 3.0,
):
    """Label : ________"""
    min_gap = 6.0
    eff_label_w = min(label_w, max(w - colon_w - min_gap, 12.0))

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(eff_label_w, row_h, label, border=0, align="L")
    pdf.cell(colon_w, row_h, ":", border=0, align="C")

    lx1 = x + eff_label_w + colon_w + 1.5
    lx2 = x + w - 2.0
    ly = y + row_h - 2.2

    lw_old = pdf.line_width
    pdf.set_line_width(0.35)

    if lx2 > lx1 + 1.0:
        pdf.line(lx1, ly, lx2, ly)

    pdf.set_line_width(lw_old)

    if value and str(value).strip() != "-":
        text_x = x + eff_label_w + colon_w + 2.0
        text_w = max(2.0, w - (eff_label_w + colon_w + 4.0))
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.set_xy(text_x, y + 0.7)
        pdf.cell(text_w, row_h - 1.4, str(value), border=0, align="L")


def _draw_ev_header_form(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    manufacturer: str = "",
    model: str = "",
    power: str = "",
    serial_no: str = "",
    location: str = "",
    firmware: str = "",
    inspection_date: str = "",
    power_w_mm: float = 32.0,
    gap_mm: float = 4.0,
) -> float:

    row_h = 8.2
    left_w = w / 2.0
    right_w = w - left_w

    lx, rx = x, x + left_w
    y0 = y

    # แถวที่ 1
    _kv_underline(pdf, base_font, lx, y0, left_w, "Manufacturer", manufacturer, row_h)
    _kv_underline(pdf, base_font, rx, y0, right_w, "Location", location, row_h)
    y0 += row_h

    # แถวที่ 2
    model_w = max(left_w - power_w_mm - gap_mm, 40.0)
    _kv_underline(pdf, base_font, lx, y0, model_w, "Model", model, row_h)
    _kv_underline(
        pdf,
        base_font,
        lx + model_w + gap_mm,
        y0,
        power_w_mm,
        "Power",
        power,
        row_h,
        label_w=10.0,
        colon_w=2.0,
    )
    _kv_underline(pdf, base_font, rx, y0, right_w, "Firmware Version", firmware, row_h)
    y0 += row_h

    # แถวที่ 3
    _kv_underline(pdf, base_font, lx, y0, left_w, "Serial Number", serial_no, row_h)
    _kv_underline(
        pdf, base_font, rx, y0, right_w, "Inspection Date", inspection_date, row_h
    )
    y0 += row_h

    return y0 + 2


def make_pm_report_html_pdf_bytes(doc: dict) -> bytes:
    pdf = HTML2PDF(unit="mm", format="A4")
    pdf.set_margins(left=10, top=10, right=10)
    pdf.set_auto_page_break(auto=True, margin=12)

    base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
    pdf.set_font(base_font, size=FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)

    issue_id = str(doc.get("issue_id", "-"))

    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left

    pdf.add_page()
    y = _draw_header(pdf, base_font, issue_id)

    head = doc.get("head", {}) or {}
    manufacturer = head.get("manufacturer")
    model = head.get("model", "")
    power = head.get("power", "")
    serial_no = head.get("serial_number", "")
    location = head.get("location", "")
    firmware = head.get("firmware_version", "")
    inspection = str(doc.get("inspection_date") or "")

    y = _draw_ev_header_form(
        pdf,
        base_font,
        x0,
        y,
        page_w,
        manufacturer,
        model,
        power,
        serial_no,
        location,
        firmware,
        inspection,
        power_w_mm=30.0,
    )

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

    y += 5

    y = draw_testing_topics_safety_section(
        pdf,
        x=pdf.l_margin,
        y=y,
        base_font=base_font,
        font_size=FONT_MAIN,
    )

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
