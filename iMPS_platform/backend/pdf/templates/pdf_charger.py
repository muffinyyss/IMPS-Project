# backend/pdf/templates/pdf_charger.py
import os
import re
import math
import base64

from fpdf import FPDF, HTMLMixin
from pathlib import Path
from datetime import datetime, date
from typing import Optional, Tuple, List, Dict, Any, Union
from io import BytesIO
from PIL import Image, ExifTags
from functools import lru_cache

try:
    import requests
except Exception:
    requests = None


# -------------------- ฟอนต์ไทย --------------------
FONT_CANDIDATES: Dict[str, List[str]] = {
    "":  ["THSarabunNew.ttf", "TH Sarabun New.ttf", "THSarabun.ttf", "TH SarabunPSK.ttf"],
    "B": ["THSarabunNew-Bold.ttf", "THSarabunNew Bold.ttf", "TH Sarabun New Bold.ttf", "THSarabun Bold.ttf"],
    "I": ["THSarabunNew-Italic.ttf", "THSarabunNew Italic.ttf", "TH Sarabun New Italic.ttf", "THSarabun Italic.ttf"],
    "BI":["THSarabunNew-BoldItalic.ttf", "THSarabunNew BoldItalic.ttf", "TH Sarabun New BoldItalic.ttf", "THSarabun BoldItalic.ttf"],
}

# -------------------- ตั้งค่าทั่วไป --------------------
DOCUMENT_TITLE_MAIN = "Preventive Maintenance Checklist - Charger"
DOCUMENT_TITLE_PHOTO_CONT = "Photos (Continued)"
DOCUMENT_TITLE_PHOTO_PRE_PM = "Photos (Pre-PM)"
DOCUMENT_TITLE_PHOTO_POST_PM = "Photos (POST-PM)"

PDF_DEBUG = os.getenv("PDF_DEBUG") == "1"


def add_all_thsarabun_fonts(pdf: FPDF, family_name: str = "THSarabun") -> bool:

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
    "r10": "ตรวจสอบแรงดันไฟฟ้าที่พิน CP",
    "r11": "ตรวจสอบแผ่นกรองระบายอากาศ",
    "r12": "ตรวจสอบจุดต่อทางไฟฟ้า",
    "r13": "ตรวจสอบคอนแทคเตอร์",
    "r14": "ตรวจสอบอุปกรณ์ป้องกันไฟกระชาก",
    "r15": "ตรวจสอบลำดับเฟส",
    "r16": "วัดแรงดันไฟฟ้าด้านเข้า",
    "r17": "ทดสอบการอัดประจุ",
    "r18": "ทำความสะอาด",
}

# -------------------- Helpers / Layout constants --------------------
LINE_W_OUTER = 0.45
LINE_W_INNER = 0.22
PADDING_X = 2.0
PADDING_Y = 0.5
FONT_MAIN = 11.0
FONT_SMALL = 11.0
LINE_H = 5.0
ROW_MIN_H = 7
CHECKBOX_SIZE = 3.5

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


def _format_m16(measures: dict) -> str:
    if not measures:
        return "-"

    # ถ้ามี m16 ใช้มันก่อน, ถ้าไม่มีก็ใช้ root dict
    ms = measures.get("m16", measures)

    order = [
        "L1-L2", "L2-L3", "L3-L1",
        "L1-N", "L2-N", "L3-N",
        "L1-G", "L2-G", "L3-G",
        "N-G"
    ]

    def fmt(k: str) -> str:
        d = ms.get(k, {})
        val = str(d.get("value", "")).strip()
        unit = str(d.get("unit", "")).strip()
        return f"{k} = {val}{unit}" if val else f"{k} = -"

    lines = []
    group = []

    for i, k in enumerate(order, start=1):
        group.append(fmt(k))

        # ครบ 3 ค่า → ขึ้นบรรทัดใหม่ (เว้น N-G ไว้ต่างหากตามต้องการ)
        if len(group) == 3:
            lines.append(", ".join(group))
            group = []

    # ค่าที่เหลือ เช่น N-G
    if group:
        lines.append(", ".join(group))

    return "\n".join(lines)

def _format_measures_pre_m16(measures_m16: dict) -> str:
    if not measures_m16:
        return "-"

    order = [
        "L1-L2", "L2-L3", "L3-L1",
        "L1-N", "L2-N", "L3-N",
        "L1-G", "L2-G", "L3-G",
        "N-G"
    ]

    def fmt(k: str) -> str:
        d = measures_m16.get(k, {})
        val = str(d.get("value", "")).strip()
        unit = str(d.get("unit", "")).strip()
        return f"{k} = {val}{unit}" if val else f"{k} = -"

    lines = []
    group = []

    for k in order:
        group.append(fmt(k))

        # ครบ 3 ค่า → ขึ้นบรรทัดใหม่
        if len(group) == 3:
            lines.append(", ".join(group))
            group = []

    # ค่าที่เหลือ (เช่น N-G)
    if group:
        lines.append(", ".join(group))

    return "\n".join(lines)

def _format_measures_pre_cp(cp: dict) -> str:
    if not cp:
        return "-"

    val = str(cp.get("value", "")).strip()
    unit = str(cp.get("unit", "")).strip()

    return f"CP = {val}{unit}" if val else "CP = -"


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
        "logo_egat.png", "logo_egatev.png", "logo_egat_ev.png",
        "egat_logo.png", "logo-ct.png", "logo_ct.png",
        "logo_egat.jpg", "logo_egat.jpeg",
    ]
    roots = [
        Path(__file__).parent / "assets",                     # backend/pdf/templates/assets
        Path(__file__).parent.parent / "assets",              # backend/pdf/assets
        Path(__file__).resolve().parents[3] / "public" / "img",        # iMPS_platform/public/img
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
    row_h = 6.5
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

        # remark ที่ผู้ใช้กรอกจริง
        remark_user = (data.get("remark") or "").strip()

        # --------------------------
        # 🔶 r10: เพิ่มค่ามาตรวัดเข้า Item แต่ remark ใช้ค่าผู้ใช้
        # --------------------------
        if key.lower() == "r10":
            cp_value = (measures.get("cp", {}) or {}).get("value", "-")
            cp_unit = (measures.get("cp", {}) or {}).get("unit", "")
            cp_text = f"CP = {cp_value}{cp_unit}".strip()

            # ต่อค่าคำนวณเข้า Item
            title = f"{title}\n{cp_text}"
            # remark_user ไม่ถูกแก้

        # --------------------------
        # 🔶 r16: เพิ่มค่ามาตรวัดเข้า Item แต่ remark ใช้ผู้ใช้
        # --------------------------
        if key.lower() == "r16":
            mtxt = _format_m16(measures or {})
            if mtxt:
                title = f"{title}\n{mtxt}"
                # remark_user ไม่ถูกแก้

        # --------------------------
        # สร้าง item
        # --------------------------
        items.append({
            "idx": idx,
            "text": f"{idx}. {title}",
            "result": _norm_result(data.get("pf", "")),
            "remark": remark_user,   # ใส่ remark ของผู้ใช้เสมอ
        })

    return items



def _draw_items_table_header(pdf: FPDF, base_font: str, x: float, y: float,
                             item_w: float, result_w: float, remark_w: float, charger_no: str):

    header_h = 6.0
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(item_w, header_h, "Item", border=1, align="C")
    pdf.cell(result_w, header_h, "Result", border=1, align="C")
    pdf.cell(remark_w, header_h, "Remark", border=1, ln=1, align="C")

    y += header_h
    pdf.set_fill_color(255, 230, 100)
    pdf.set_xy(x, y)

    TITLE_H = 6 
    title_text = f"Charger No. {charger_no}"

    pdf.cell(item_w + result_w + remark_w, TITLE_H, title_text,
             border=1, ln=1, align="L", fill=True)

    return y + TITLE_H


def _draw_result_cell(pdf: FPDF, base_font: str, x: float, y: float, w: float, h: float, result: str, is_top_align: bool = False):
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
        
        # ถ้า is_top_align=True ให้ชิดบน, ไม่งั้นให้อยู่ตรงกลาง
        if is_top_align:
            start_y = y + PADDING_Y
        else:
            start_y = y + (h - CHECKBOX_SIZE) / 2.0
        
        _draw_check(pdf, start_x, start_y, CHECKBOX_SIZE, chk)
        pdf.set_xy(start_x + CHECKBOX_SIZE + 1.6, start_y - 1)
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
    data = pdf.output(dest="S")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    # fpdf2 เก่าอาจคืน str
    return data.encode("latin1")

def _draw_header(pdf: FPDF, base_font: str, issue_id: str = "-") -> float:
    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left
    y_top = 10

    col_left, col_mid = 40, 120
    col_right = page_w - col_left - col_mid

    # --- ความสูงใหม่ที่เตี้ยลง ---
    h_all = 22          # เดิม 30
    h_right_top = 8     # เดิม 12

    pdf.set_line_width(LINE_W_INNER)

    # โลโก้
    pdf.rect(x0, y_top, col_left, h_all)
    logo_path = _resolve_logo_path()
    if logo_path:
        IMG_W = 28  # ลดขนาดรูปให้พอดีกับความสูงใหม่
        img_x = x0 + (col_left - IMG_W) / 2
        img_y = y_top + (h_all - 12) / 2
        try:
            pdf.image(logo_path.as_posix(), x=img_x, y=img_y, w=IMG_W)
        except Exception:
            pass

    # กล่องกลาง (ที่อยู่)
    box_x = x0 + col_left
    pdf.rect(box_x, y_top, col_mid, h_all)

    addr_lines = [
        "Electricity Generating Authority of Thailand (EGAT)",
        "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand",
        "Call Center Tel. 02-114-3350",
    ]

    pdf.set_font(base_font, "B", FONT_MAIN)
    line_h = 5.2   # ลดจาก 6.2 เพื่อให้พอดีกับความสูงใหม่

    # จัดให้อยู่กึ่งกลางแนวตั้งในกล่อง
    start_y = y_top + (h_all - line_h * len(addr_lines)) / 2

    for i, line in enumerate(addr_lines):
        pdf.set_xy(box_x + 3, start_y + i * line_h)
        pdf.cell(col_mid - 6, line_h, line, align="C")

    # กล่องขวา
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_right_top)
    pdf.rect(xr, y_top + h_right_top, col_right, h_all - h_right_top)

    # Page number
    pdf.set_xy(xr, y_top + (h_right_top - 6) / 2)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.cell(col_right, 6, f"Page {pdf.page_no()}", align="C")

    # Issue ID (2 บรรทัด)
    bottom_box_h = h_all - h_right_top
    pdf.set_xy(xr, y_top + h_right_top + (bottom_box_h - 12) / 2)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.multi_cell(col_right, 6, f"Issue ID\n{issue_id}", align="C")

    return y_top + h_all

# -------------------- Photo helpers (ปรับใหม่) --------------------
def _guess_img_type_from_ext(path_or_url: str) -> str:
    ext = os.path.splitext(str(path_or_url).lower())[1]
    if ext in (".png",): return "PNG"
    if ext in (".jpg", ".jpeg"): return "JPEG"
    return ""

def _find_public_root() -> Optional[Path]:
    """หาตำแหน่งโฟลเดอร์ public แบบ robust: PUBLIC_DIR env > ไต่โฟลเดอร์หา 'public'"""
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

def _log(msg: str):
    if PDF_DEBUG:
        print(msg)
        
def _is_http_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")


def _load_image_source_from_urlpath(
    url_path: str,
) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
    if not url_path:
        return None, None

    # 🔥 เพิ่ม debug ที่นี่
    print(f"\n{'='*80}")
    print(f"[DEBUG] 🔍 กำลังหารูป: {url_path}")
    print(f"{'='*80}")

    # case: data URL
    # if url_path.startswith("data:image/"):
    #     print("[DEBUG] ✅ เป็น data URL")
    #     try:
    #         head, b64 = url_path.split(",", 1)
    #         mime = head.split(";")[0].split(":", 1)[1]
    #         bio = BytesIO(base64.b64decode(b64))
    #         img_type = (
    #             "PNG"
    #             if "png" in mime
    #             else ("JPEG" if "jpeg" in mime or "jpg" in mime else "")
    #         )
    #         print(f"[DEBUG] ✅ แปลง data URL สำเร็จ (type: {img_type})")
    #         return bio, img_type
    #     except Exception as e:
    #         print(f"[DEBUG] ❌ แปลง data URL ล้มเหลว: {e}")
    #         return None, None

    # ปรับลำดับ: เช็ค local file ก่อน (เร็วที่สุด) แทนที่จะ download
    
    # 1) backend/uploads (เช็คก่อน - เร็วที่สุด)
    if not url_path.startswith("http"):  # ข้าม http URL
        print("[DEBUG] 📂 ลองหาใน backend/uploads...")
        
        backend_root = Path(__file__).resolve().parents[2]
        uploads_root = backend_root / "uploads"
        
        # print(f"[DEBUG]   📍 backend_root = {backend_root}")
        # print(f"[DEBUG]   📍 uploads_root = {uploads_root}")
        # print(f"[DEBUG]   📍 uploads_root.exists() = {uploads_root.exists()}")
        
        if uploads_root.exists():
            clean_path = url_path.lstrip("/")
            # print(f"[DEBUG]   🧹 clean_path (หลัง lstrip) = {clean_path}")
            
            if clean_path.startswith("uploads/"):
                clean_path = clean_path[8:]
                # print(f"[DEBUG]   🧹 clean_path (หลังตัด 'uploads/') = {clean_path}")
            
            local_path = uploads_root / clean_path
            # print(f"[DEBUG]   📍 local_path (เต็ม) = {local_path}")
            # print(f"[DEBUG]   📍 local_path.exists() = {local_path.exists()}")
            # print(f"[DEBUG]   📍 local_path.is_file() = {local_path.is_file() if local_path.exists() else 'N/A'}")
            
            if local_path.exists() and local_path.is_file():
                print(f"[DEBUG] ✅ เจอรูปแล้ว! {local_path}")
                return local_path.as_posix(), _guess_img_type_from_ext(local_path.as_posix())
            else:
                print(f"[DEBUG] ❌ ไม่เจอรูปที่ {local_path}")

        # 2) public folder
        # print("[DEBUG] 📂 ลองหาใน public folder...")
        # public_root = _find_public_root()
        # if public_root:
        #     print(f"[DEBUG]   📍 public_root = {public_root}")
        #     local_path = public_root / url_path.lstrip("/")
        #     print(f"[DEBUG]   📍 local_path = {local_path}")
        #     print(f"[DEBUG]   📍 exists = {local_path.exists()}")
            
        #     if local_path.exists() and local_path.is_file():
        #         print(f"[DEBUG] ✅ เจอรูปใน public! {local_path}")
        #         return local_path.as_posix(), _guess_img_type_from_ext(local_path.as_posix())
        #     else:
        #         print(f"[DEBUG] ❌ ไม่เจอรูปใน public")
        # else:
        #     print("[DEBUG] ❌ ไม่เจอ public_root")

        # 3) absolute filesystem path
        # print("[DEBUG] 📂 ลองเช็ค absolute path...")
        # p_abs = Path(url_path)
        # print(f"[DEBUG]   📍 absolute path = {p_abs}")
        # print(f"[DEBUG]   📍 is_absolute = {p_abs.is_absolute()}")
        # print(f"[DEBUG]   📍 exists = {p_abs.exists()}")
        
        # if p_abs.is_absolute() and p_abs.exists():
        #     print(f"[DEBUG] ✅ เจอรูป absolute path! {p_abs}")
        #     return p_abs.as_posix(), _guess_img_type_from_ext(url_path)
        # else:
        #     print("[DEBUG] ❌ ไม่ใช่ absolute path หรือไม่มีไฟล์")

    # 4) HTTP download (ช้าที่สุด - ทำทีหลัง)
    # if requests is not None:
        # ลอง base_url ก่อน (มักใช้บ่อยกว่า)
        # base_url = os.getenv("PHOTOS_BASE_URL") or os.getenv("APP_BASE_URL") or ""
        
        # if base_url and not url_path.startswith("http"):
        #     full_url = base_url.rstrip("/") + "/" + url_path.lstrip("/")
        #     print(f"[DEBUG] 🌐 ลอง download จาก base_url: {full_url}")
        #     try:
        #         resp = requests.get(
        #             full_url, 
        #             headers=_env_photo_headers(), 
        #             timeout=5,
        #             stream=True
        #         )
        #         resp.raise_for_status()
        #         print(f"[DEBUG] ✅ Download สำเร็จ! ({len(resp.content)} bytes)")
        #         return BytesIO(resp.content), _guess_img_type_from_ext(full_url)
        #     except Exception as e:
        #         print(f"[DEBUG] ❌ Download ล้มเหลว: {e}")
        
        # absolute http(s) URL
        # if _is_http_url(url_path):
        #     print(f"[DEBUG] 🌐 ลอง download จาก URL: {url_path}")
        #     try:
        #         resp = requests.get(
        #             url_path, 
        #             headers=_env_photo_headers(), 
        #             timeout=5,
        #             stream=True
        #         )
        #         resp.raise_for_status()
        #         print(f"[DEBUG] ✅ Download สำเร็จ! ({len(resp.content)} bytes)")
        #         return BytesIO(resp.content), _guess_img_type_from_ext(url_path)
        #     except Exception as e:
        #         print(f"[DEBUG] ❌ Download ล้มเหลว: {e}")

    print(f"[DEBUG] ❌ ไม่เจอรูปจากทุกวิธี!")
    print(f"{'='*80}\n")
    return None, None


# Image cache dictionary
_IMAGE_CACHE = {}

def _load_image_with_cache(url_path: str) -> Tuple[Union[BytesIO, None], Optional[str]]:
    
    # ตรวจสอบ cache ก่อน
    if url_path in _IMAGE_CACHE:
        _log(f"[IMG] cache hit: {url_path}")
        cached_buf, cached_type = _IMAGE_CACHE[url_path]
        # สร้าง BytesIO ใหม่เพื่อ reset position
        new_buf = BytesIO(cached_buf.getvalue())
        return new_buf, cached_type
    
    # โหลดรูปปกติ
    src, img_type = _load_image_source_from_urlpath(url_path)
    
    if src is None:
        return None, None
    
    # แปลงเป็น BytesIO และ auto-rotate ทุกกรณี
    try:
        img_buf = load_image_autorotate(src)
        _IMAGE_CACHE[url_path] = (img_buf, img_type)
        _log(f"[IMG] cached: {url_path}")
        
        # สร้าง BytesIO ใหม่เพื่อ return (เพราะ cache ใช้ต้นฉบับ)
        new_buf = BytesIO(img_buf.getvalue())
        return new_buf, img_type
        
    except Exception as e:
        _log(f"[IMG] auto-rotate error: {e}")
        return None, None


def _get_photo_items_for_idx(doc: dict, idx: int) -> List[dict]:
   
    photos = ((doc.get("photos") or {}).get(f"g{idx}") or [])
    out = []
    for p in photos:
        if isinstance(p, dict) and p.get("url"):
            out.append(p)
    return out[:PHOTO_MAX_PER_ROW]

def _get_photo_items_for_idx_pre(doc: dict, idx: int) -> List[dict]:
    """ดึงรูปจาก photos_pre (ก่อน PM)"""
    photos_pre = ((doc.get("photos_pre") or {}).get(f"g{idx}") or [])
    out = []
    for p in photos_pre:
        if isinstance(p, dict) and p.get("url"):
            out.append(p)
    return out[:PHOTO_MAX_PER_ROW]

def load_image_autorotate(path_or_bytes):

    # โหลดภาพ
    if isinstance(path_or_bytes, (str, Path)):
        img = Image.open(path_or_bytes)
    else:
        img = Image.open(BytesIO(path_or_bytes))

    # --- 1) แก้ EXIF Orientation ---
    try:
        exif = img._getexif()
        if exif is not None:
            for tag, value in ExifTags.TAGS.items():
                if value == 'Orientation':
                    orientation_key = tag
                    break

            orientation = exif.get(orientation_key)

            if orientation == 3:
                img = img.rotate(180, expand=True)
            elif orientation == 6:
                img = img.rotate(270, expand=True)
            elif orientation == 8:
                img = img.rotate(90, expand=True)
    except Exception:
        pass  # รูปไม่มี EXIF

    # --- 2) Auto rotate เพิ่มเติมสำหรับรูปแนวนอนจริง ๆ ---
    w, h = img.size
    if w > h:
        img = img.rotate(90, expand=True)

    # ส่งออก
    buf = BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf

# -------------------------------------
# 🔸 ค่าคงที่เกี่ยวกับตารางรูปภาพ
# -------------------------------------
PHOTO_MAX_PER_ROW = 10
PHOTO_PER_LINE    = 4    # จำนวนรูปต่อบรรทัด
PHOTO_IMG_MAX_H   = 40
PHOTO_GAP         = 0.7
PHOTO_PAD_X       = 1
PHOTO_PAD_Y       = 1
PHOTO_ROW_MIN_H = PHOTO_IMG_MAX_H + 4
PHOTO_FONT_SMALL  = 10
PHOTO_LINE_H      = 5

def _draw_photos_table_header(pdf: FPDF, base_font: str, x: float, y: float, q_w: float, g_w: float) -> float:
    header_h = 6.0
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_xy(x, y)
    pdf.cell(q_w, header_h, "Item / Question", border=1, align="C")
    pdf.cell(g_w, header_h, "Reference Photos", border=1, ln=1, align="C")
    return y + header_h


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
    วาดแถวรูปภาพโดยคำนวณความสูงจริงที่ใช้
    """
    _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)
    
    images = (image_items or [])[:PHOTO_MAX_PER_ROW]
    total_images = len(images)
    
    # คำนวณจำนวนแถวของรูป
    if total_images == 0:
        num_rows = 0
    else:
        num_rows = math.ceil(total_images / PHOTO_PER_LINE)
    
    # คำนวณความสูงจริงของส่วนรูปภาพ (ไม่รวม padding เกิน)
    if num_rows > 0:
        # ความสูงรูป + ช่องว่างระหว่างแถว + padding บน-ล่าง
        images_content_h = num_rows * PHOTO_IMG_MAX_H + (num_rows - 1) * PHOTO_GAP
        images_total_h = images_content_h + 2 * PHOTO_PAD_Y
    else:
        images_total_h = 0
    
    # ความสูงของ row = max ระหว่าง text กับ รูป (ไม่บวกค่าพิเศษ)
    row_h = max(text_h + 2 * PADDING_Y, images_total_h)
    
    # ซ้าย: ข้อ/คำถาม
    _cell_text_in_box(
        pdf, x, y, q_w, row_h, question_text, align="L", lh=LINE_H, valign="top"
    )

    # ขวา: กรอบรูป
    gx = x + q_w
    pdf.rect(gx, y, g_w, row_h)

    if total_images == 0:
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.set_xy(gx, y + (row_h - LINE_H) / 2.0)
        pdf.cell(g_w, LINE_H, "-", border=0, align="C")
        pdf.set_xy(x + q_w + g_w, y)
        return row_h

    # คำนวณความกว้างของแต่ละช่องรูป
    slot_w = (g_w - 2 * PHOTO_PAD_X - (PHOTO_PER_LINE - 1) * PHOTO_GAP) / PHOTO_PER_LINE
    
    pdf.set_font(base_font, "", FONT_MAIN)

    # วาดรูปทีละแถว (เริ่มจาก PHOTO_PAD_Y จากด้านบน)
    for row_idx in range(num_rows):
        cy = y + PHOTO_PAD_Y + row_idx * (PHOTO_IMG_MAX_H + PHOTO_GAP)
        
        # จำนวนรูปในแถวนี้
        start_img = row_idx * PHOTO_PER_LINE
        end_img = min(start_img + PHOTO_PER_LINE, total_images)
        imgs_in_row = end_img - start_img
        
        for col_idx in range(imgs_in_row):
            img_idx = start_img + col_idx
            cx = gx + PHOTO_PAD_X + col_idx * (slot_w + PHOTO_GAP)
            
            url_path = (images[img_idx] or {}).get("url", "")
            img_buf, img_type = _load_image_with_cache(url_path)

            if img_buf is not None:
                try:
                    pdf.image(img_buf, x=cx, y=cy, w=slot_w, h=PHOTO_IMG_MAX_H)
                except Exception as e:
                    _log(f"[IMG] place error: {e}")
                    pdf.set_xy(cx, cy + (PHOTO_IMG_MAX_H - LINE_H) / 2.0)
                    pdf.cell(slot_w, LINE_H, "-", border=0, align="C")
            else:
                pdf.set_xy(cx, cy + (PHOTO_IMG_MAX_H - LINE_H) / 2.0)
                pdf.cell(slot_w, LINE_H, "-", border=0, align="C")

    pdf.set_xy(x + q_w + g_w, y)
    return row_h


def make_pm_report_html_pdf_bytes(doc: dict) -> bytes:
    pdf = HTML2PDF(unit="mm", format="A4")
    pdf.set_margins(left=10, top=10, right=10)
    pdf.set_auto_page_break(auto=True, margin=12)

    base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
    pdf.set_font(base_font, size=FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)

    job = doc.get("job", {}) or {}
    station_name = job.get("station_name", "-")
    model = job.get("model", "-")
    sn = job.get("sn", "-")
    pm_date = _fmt_date_thai_like_sample(doc.get("pm_date", job.get("date", "-")))
    issue_id = str(doc.get("issue_id", "-"))
    charger_no = doc.get("job", {}).get("chargerNo", "-")

    checks = _rows_to_checks(doc.get("rows") or {}, doc.get("measures") or {})


    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left
    EDGE_ALIGN_FIX = (LINE_W_OUTER - LINE_W_INNER) / 2.0

    # ========== เริ่มหน้าแรก ==========
    pdf.add_page()
    y = _draw_header(pdf, base_font, issue_id)

    TITLE_H = 7
    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 13)
    pdf.cell(page_w, TITLE_H, DOCUMENT_TITLE_MAIN, border=1, ln=1, align="C")
    y += TITLE_H

    y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, model, sn, pm_date)

    # ========== ตารางรายการ ==========
    x_table = x0 + EDGE_ALIGN_FIX
    table_total_w = page_w - 2 * EDGE_ALIGN_FIX
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "", FONT_MAIN)

    item_w = 65
    result_w = 64
    remark_w = page_w - item_w - result_w

    def _ensure_space(height_needed: float):
        nonlocal y
        if y + height_needed > (pdf.h - pdf.b_margin):
            pdf.add_page()
            y = _draw_header(pdf, base_font, issue_id)
            y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w, charger_no)
            pdf.set_font(base_font, "", FONT_MAIN)

    y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w, charger_no)
    pdf.set_font(base_font, "", FONT_MAIN)
    
    # ========== วนลูปวาดแต่ละ item ==========
    for it in checks:
        text = str(it.get("text", ""))
        result = it.get("result", "na")
        remark = str(it.get("remark", "") or "")

        _, item_h = _split_lines(pdf, item_w - 2 * PADDING_X, text, LINE_H)
        _, remark_h = _split_lines(pdf, remark_w - 2 * PADDING_X, remark, LINE_H)
        
        is_row_10 = "10." in text
        is_row_16 = "16." in text
        
        if is_row_16:
            remark_h = max(remark_h, LINE_H * 6)
        if is_row_10:
            remark_h = max(remark_h, LINE_H * 3)
        
        row_h_eff = max(ROW_MIN_H, item_h, remark_h)
        _ensure_space(row_h_eff)

        x = x_table
        _cell_text_in_box(pdf, x, y, item_w, row_h_eff, text, align="L", lh=LINE_H, 
                         valign="middle")
        x += item_w
        _draw_result_cell(pdf, base_font, x, y, result_w, row_h_eff, result)
        x += result_w
        _cell_text_in_box(pdf, x, y, remark_w, row_h_eff, remark, align="L", lh=LINE_H, valign="top")

        y += row_h_eff

    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_draw_color(0, 0, 0)

    # ========== Comment & Summary ==========
    comment_x = x_table
    comment_item_w = item_w
    comment_result_w = result_w
    comment_remark_w = remark_w

    # 1. ดึงข้อความ comment ก่อน
    comment_text = str(doc.get("summary", "") or "-")

    # 2. คำนวณความสูงจริงของ comment text
    _, comment_h_calculated = _split_lines(pdf, comment_result_w + comment_remark_w - 2 * PADDING_X, comment_text, LINE_H)

    #    (LINE_H * 0.5) เพื่อให้มี space เหลือด้านบน-ล่าง
    h_comment = max(LINE_H * 2, comment_h_calculated + LINE_H * 0.5)

    # 4. h_checklist ยังคงเดิม
    h_checklist = 7

    # 5. คำนวณ total_h ใหม่ (ตามความสูงของ comment)
    total_h = h_comment + h_checklist

    # ตรวจสอบพื้นที่ก่อนวาดส่วน Comment
    _ensure_space(total_h + 5)

    # วาดกรอบนอกทั้งหมด (ความสูงขยายแล้ว)
    pdf.rect(comment_x, y, comment_item_w + comment_result_w + comment_remark_w, total_h)

    # ========== แถว Comment (ขยายตามความสูง) ==========
    pdf.set_font(base_font, "B", 11)
    pdf.set_xy(comment_x, y)
    pdf.cell(comment_item_w, h_comment, "Comment :", border=0, align="L")

    # วาดเส้นคั่นระหว่าง "Comment :" และข้อความ (สูงเต็ม h_comment)
    pdf.line(comment_x + comment_item_w, y, comment_x + comment_item_w, y + h_comment)

    pdf.set_font(base_font, "", 11)
    _cell_text_in_box(pdf, comment_x + comment_item_w, y, comment_result_w + comment_remark_w, h_comment, 
                    comment_text, align="L", lh=LINE_H, valign="middle")

    y += h_comment

    # เส้นคั่นระหว่าง Comment และ Inspection Results
    pdf.line(comment_x, y, comment_x + comment_item_w + comment_result_w + comment_remark_w, y)

    # ========== แถว Inspection Results (ความสูงคงที่) ==========
    summary_check = str(doc.get("summaryCheck", "")).strip().upper() or "-"

    pdf.set_xy(comment_x, y)
    pdf.set_font(base_font, "B", 11)
    pdf.cell(comment_item_w, h_checklist, "Inspection Results :", border=0, align="L")

    # วาดเส้นคั่น
    pdf.line(comment_x + comment_item_w, y, comment_x + comment_item_w, y + h_checklist)

    # วาด checkbox
    pdf.set_font(base_font, "", 11)
    x_check_start = comment_x + comment_item_w + 10
    y_check = y + (h_checklist - CHECKBOX_SIZE) / 2.0
    gap = 35
    options = [("Pass", summary_check == "PASS"), ("Fail", summary_check == "FAIL"), ("N/A", summary_check == "N/A")]
    for i, (label, checked) in enumerate(options):
        x_box = x_check_start + i * gap
        _draw_check(pdf, x_box, y_check, CHECKBOX_SIZE + 0.5, checked)
        pdf.set_xy(x_box + CHECKBOX_SIZE + 3, y_check - 1)
        pdf.cell(20, LINE_H + 1, label, ln=0, align="L")

    y += h_checklist

    # ========== ช่องเซ็นชื่อ ==========
    signer_labels = ["Performed by", "Approved by", "Witnessed by"]
    pdf.set_line_width(LINE_W_INNER)

    col_widths = [item_w, result_w, remark_w]
    row_h_header = 7
    row_h_sig = 15
    row_h_name = 5
    row_h_date = 5
    total_sig_h = row_h_header + row_h_sig + row_h_name + row_h_date

    _ensure_space(total_sig_h + 5)

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_fill_color(255, 230, 100)

    x_pos = x_table
    for i, label in enumerate(signer_labels):
        pdf.set_xy(x_pos, y)
        pdf.cell(col_widths[i], row_h_header, label, border=1, align="C", fill=True)
        x_pos += col_widths[i]
    y += row_h_header

    x_pos = x_table
    for i in range(3):
        pdf.rect(x_pos, y, col_widths[i], row_h_sig)
        x_pos += col_widths[i]
    y += row_h_sig

    pdf.set_font(base_font, "", FONT_MAIN)
    x_pos = x_table
    for i in range(3):
        pdf.rect(x_pos, y, col_widths[i], row_h_name)
        name_text = f"( {' ' * 40} )"
        pdf.set_xy(x_pos, y)
        pdf.cell(col_widths[i], row_h_name, name_text, border=0, align="C")
        x_pos += col_widths[i]
    y += row_h_name

    x_pos = x_table
    for i in range(3):
        pdf.rect(x_pos, y, col_widths[i], row_h_date)
        date_text = "Date : " + " " * 9
        margin_left = 5
        pdf.set_xy(x_pos + margin_left, y)
        pdf.cell(col_widths[i] - margin_left, row_h_date, date_text, border=0, align="L")
        x_pos += col_widths[i]
    y += row_h_date


    pdf.add_page()
    y = _draw_header(pdf, base_font, issue_id)
    
    x_table = x0 + EDGE_ALIGN_FIX
    q_w = 85.0
    g_w = (page_w - 2 * EDGE_ALIGN_FIX) - q_w
    
    def _ensure_space_photo(height_needed: float):
        nonlocal y
        if y + height_needed > (pdf.h - pdf.b_margin):
            pdf.add_page()
            y = _draw_header(pdf, base_font, issue_id)
            pdf.set_xy(x0, y)
            pdf.set_font(base_font, "B", 13)
            pdf.set_fill_color(255, 230, 100)
            photo_continue_h = 6
            pdf.cell(page_w, photo_continue_h, DOCUMENT_TITLE_PHOTO_CONT, border=1, ln=1, align="C", fill=True)
            y += photo_continue_h
            y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)
            pdf.set_font(base_font, "", FONT_MAIN)

    has_pre_photos = bool(doc.get("photos_pre"))

    # ===== ส่วนที่ 1: Pre-PM Photos (ถ้ามี) =====
    if has_pre_photos:
        pdf.set_xy(x0, y)
        pdf.set_font(base_font, "B", 13)
        pdf.set_fill_color(255, 230, 100)
        TITLE_H = 7
        pdf.cell(page_w, TITLE_H, DOCUMENT_TITLE_PHOTO_PRE_PM, border=1, ln=1, align="C", fill=True)
        y += TITLE_H

        y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)
        pdf.set_font(base_font, "", FONT_MAIN)
        
        for it in checks:
            idx = int(it.get("idx") or 0)

            question_text = f"{idx}. {ROW_TITLES.get(f'r{idx}', it.get('text', f'รายการที่ {idx}'))}"
            question_text_pre = f"{question_text} (Pre-PM)"

            # RESET ทุก iteration
            measures_text = ""

            measures_pre = doc.get("measures_pre", {})

            # -------- ข้อ 16 --------
            if idx == 16:
                m16 = measures_pre.get("m16")
                if m16:
                    measures_text = _format_measures_pre_m16(m16)

            # -------- ข้อ 10 (CP) --------
            elif idx == 10:
                cp = measures_pre.get("cp")
                if cp:
                    measures_text = _format_measures_pre_cp(cp)

            # append เฉพาะกรณีที่มีค่า
            if measures_text:
                question_text_pre += "\n" + measures_text

            # print(question_text_pre)

            img_items = _get_photo_items_for_idx_pre(doc, idx)
            if not img_items:
                continue

            #  คำนวณความสูงจริงของแถว
            _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text_pre, LINE_H)
            total_images = len(img_items)
            num_rows = math.ceil(total_images / PHOTO_PER_LINE) if total_images > 0 else 0
            img_h = PHOTO_IMG_MAX_H
            images_total_h = (num_rows * img_h + (num_rows - 1) * PHOTO_GAP + 2 * PADDING_Y) if num_rows > 0 else 0
            actual_row_h = max(PHOTO_ROW_MIN_H, text_h + 2 * PADDING_Y, images_total_h + 4)
            
            #  เช็คว่าจะล้นหน้าไหม ถ้าใช่ ให้ขึ้นหน้าใหม่ก่อนวาด
            _ensure_space_photo(actual_row_h)

            row_h_used = _draw_photos_row(pdf, base_font, x_table, y, q_w, g_w, 
                                         question_text_pre, img_items)
            y += row_h_used

        # ขึ้นหน้าใหม่สำหรับ Photos (หลัง PM)
        pdf.add_page()
        y = _draw_header(pdf, base_font, issue_id)

    # ===== ส่วนที่ 2: Post-PM Photos =====
    # วาดหัว "Photos" หรือ "Photos (หลัง PM)" ขึ้นอยู่กับว่ามี pre หรือไม่
    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 13)
    pdf.set_fill_color(255, 230, 100)
    TITLE_H = 7
    title_text = DOCUMENT_TITLE_PHOTO_POST_PM if has_pre_photos else "Photos"
    pdf.cell(page_w, TITLE_H, title_text, border=1, ln=1, align="C", fill=True)
    y += TITLE_H

    y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)
    pdf.set_font(base_font, "", FONT_MAIN)

    for it in checks:
        idx = int(it.get("idx") or 0)
        question_text = f"{idx}. {ROW_TITLES.get(f'r{idx}', it.get('text', f'รายการที่ {idx}'))}"

        img_items = _get_photo_items_for_idx(doc, idx)

        # คำนวณความสูงจริงของแถว
        _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)
        total_images = len(img_items)
        num_rows = math.ceil(total_images / PHOTO_PER_LINE) if total_images > 0 else 0
        img_h = PHOTO_IMG_MAX_H
        images_total_h = (num_rows * img_h + (num_rows - 1) * PHOTO_GAP + 2 * PADDING_Y) if num_rows > 0 else 0
        actual_row_h = max(PHOTO_ROW_MIN_H, text_h + 2 * PADDING_Y, images_total_h + 4)
        
        # เช็คว่าจะล้นหน้าไหม ถ้าใช่ ให้ขึ้นหน้าใหม่ก่อนวาด
        _ensure_space_photo(actual_row_h)

        row_h_used = _draw_photos_row(pdf, base_font, x_table, y, q_w, g_w, 
                                     question_text, img_items)
        y += row_h_used

    return _output_pdf_bytes(pdf)


def _precache_all_images(doc: dict):
    """โหลดรูปทั้งหมดล่วงหน้าแบบ parallel"""
    from concurrent.futures import ThreadPoolExecutor
    
    all_urls = set()  # ใช้ set เพื่อไม่ซ้ำ
    
    # รวบรวม URL จาก photos
    photos = doc.get("photos", {})
    if photos:
        for key, items in photos.items():
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict) and item.get("url"):
                        all_urls.add(item["url"])
    
    # รวบรวม URL จาก photos_pre
    photos_pre = doc.get("photos_pre", {})
    if photos_pre:
        for key, items in photos_pre.items():
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict) and item.get("url"):
                        all_urls.add(item["url"])
    
    if not all_urls:
        return
    
    _log(f"[PRECACHE] Starting to cache {len(all_urls)} images...")
    
    # โหลดแบบ parallel (5 threads พร้อมกัน)
    with ThreadPoolExecutor(max_workers=5) as executor:
        list(executor.map(_load_image_with_cache, all_urls))
    
    _log(f"[PRECACHE] Completed caching {len(all_urls)} images")


# Public API expected by pdf_routes: generate_pdf(data) -> bytes
def generate_pdf(data: dict) -> bytes:
    return make_pm_report_html_pdf_bytes(data)