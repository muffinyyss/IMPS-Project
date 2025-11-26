# backend/pdf/templates/pdf_cbbox.py
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
    "r1": "การไฟฟ้าฝ่ายจำหน่าย",
    "r2": "ตรวจสอบอุปกรณ์ตัดวงจรไฟฟ้า",
    "r3": "ตรวจสอบสภาพทั่วไป",
    "r4": "ตรวจสอบสภาพดักซีล,ซิลิโคนกันซึม",
    "r5": "อุปกรณ์ตัดวงจรไฟฟ้า (Safety Switch / Circuit Breaker)",
    "r6": "ทดสอบปุ่ม Trip Test (Circuit Breaker)",
    "r7": "ตรวจสอบจุดต่อทางไฟฟ้าและขันแน่น",
    "r8": "ทำความสะอาดตู้ MDB"
}

# ✅ อนุญาตเฉพาะข้อที่ประกาศไว้ใน ROW_TITLES เท่านั้น
ALLOWED_IDXS = sorted(i for i in (int(k[1:]) for k in ROW_TITLES.keys()) if i > 0)
ALLOWED_SET = set(ALLOWED_IDXS)

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


def _format_m5(measures: dict) -> str:
    """
    ฟอร์แมตข้อมูลแรงดันไฟฟ้าสำหรับข้อ 5
    อ่านจาก measures["m5"] (หรือ key ที่เหมาะสม)
    """
    # ✅ เปลี่ยน key ให้ตรงกับโครงสร้างข้อมูลจริง
    ms = (measures or {}).get("m5") or {}  # ถ้าเก็บใน m5
    # หรือ ms = (measures or {}).get("r5") or {}  # ถ้าเก็บใน r5
    
    if not ms:
        return ""

    # normalize key ภายใน
    norm_ms = {}
    for k, v in ms.items():
        nk = str(k).strip().replace("–", "-").replace("−", "-").replace(" ", "")
        norm_ms[nk.upper()] = v

    order = [
        "L1-N", "L2-N", "L3-N",
        "L1-G", "L2-G", "L3-G",
        "L1-L2", "L2-L3", "L3-L1",
        "N-G"
    ]

    def fmt(k: str) -> str:
        d = norm_ms.get(k.upper()) or {}
        val = str(d.get("value") or "").strip()
        unit = str(d.get("unit") or "").strip()
        if not val or val.lower() == "none":
            val = "-"
        return f"{k} = {val}{unit}"

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

def _draw_job_info_block(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    station_name: str,
    pm_date: str,
) -> float:
    row_h = 8.5
    col_w = w / 2.0
    label_w = 30

    box_h = row_h

    pdf.set_line_width(LINE_W_INNER)
    pdf.rect(x, y, w, box_h)                 # กรอบนอก
    pdf.line(x + col_w, y, x + col_w, y + box_h)  # เส้นแบ่งซ้าย/ขวา

    def _item(x0, y0, label, value):
        pdf.set_xy(x0 + 2, y0 + 1.5)
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.cell(label_w, row_h - 3, label, border=0, align="L")
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.set_xy(x0 + 2 + label_w, y0 + 1.5)
        pdf.cell(col_w - label_w - 4, row_h - 3, str(value or "-"), border=0, align="L")

    _item(x, y, "Station", station_name)
    _item(x + col_w, y, "PM Date", pm_date)

    return y + box_h


def _r_idx(k: str) -> int:
    m = re.match(r"r(\d+)$", k.lower())
    return int(m.group(1)) if m else 0


def _rows_to_checks(rows: dict, measures: Optional[dict] = None) -> List[dict]:

    items: List[dict] = []
    measures = measures or {}

    def _build_item(idx: int, data: dict | None) -> dict:
        key = f"r{idx}"
        title = ROW_TITLES.get(key, f"รายการที่ {idx}")
        remark = (data or {}).get("remark", "").strip()

        # กรณีพิเศษ: ข้อ 5 ให้แสดงข้อมูลแรงดันในคอลัมน์ Item
        if idx == 5:
            voltage_text = _format_m5(measures)
            if voltage_text:
                # รวมหัวข้อกับข้อมูลแรงดัน
                title = f"{idx}. {title}\n{voltage_text}"
            else:
                title = f"{idx}. {title}"
        else:
            title = f"{idx}. {title}"


        result = _norm_result((data or {}).get("pf", ""))
        return {"idx": idx, "text": title, "result": result, "remark": remark}

    # มี rows → ใช้เฉพาะข้อที่อนุญาต
    if isinstance(rows, dict) and rows:
        for key in sorted(rows.keys(), key=_r_idx):
            idx = _r_idx(key)
            if idx <= 0 or idx not in ALLOWED_SET:
                continue
            items.append(_build_item(idx, rows.get(key) or {}))

        # เติมข้อจาก ROW_TITLES ที่ยังไม่มี (เป็น N/A)
        existing = {it["idx"] for it in items}
        for idx in ALLOWED_IDXS:
            if idx not in existing:
                items.append(_build_item(idx, None))

        items.sort(key=lambda x: x["idx"])
        return items

    # ไม่มี rows → แสดงทุกข้อที่อนุญาตเป็น N/A
    for idx in ALLOWED_IDXS:
        items.append(_build_item(idx, None))
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
    # pdf.set_fill_color(255, 230, 100)
    # pdf.set_xy(x, y)
    # pdf.cell(item_w + result_w + remark_w, 8, "เครื่องอัดประจุไฟฟ้า เครื่องที่ 1", border=1, ln=1, align="L", fill=True)
    return y

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

def _draw_header(pdf: FPDF, base_font: str, issue_id: str = "-") -> float:
    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left
    y_top = 10

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

    # กล่องที่อยู่กลาง
    box_x = x0 + col_left
    pdf.rect(box_x, y_top, col_mid, h_all)
    addr_lines = [
        "Electricity Generating Authority of Thailand (EGAT)",
        "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand",
        "Call Center Tel. 02-114-3350",
    ]
    pdf.set_font(base_font, "B", FONT_MAIN)
    line_h = 6.2
    start_y = y_top + (h_all - line_h * len(addr_lines)) / 2
    for i, line in enumerate(addr_lines):
        pdf.set_xy(box_x + 3, start_y + i * line_h)
        pdf.cell(col_mid - 6, line_h, line, align="C")

    # กล่องขวา (Page / Issue)
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_right_top)
    pdf.rect(xr, y_top + h_right_top, col_right, h_all - h_right_top)

    # แสดง Page
    pdf.set_xy(xr, y_top + 4)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.cell(col_right, 6, f"Page {pdf.page_no()}", align="C")

    # แสดง Issue ID (2 บรรทัด)
    pdf.set_xy(xr, y_top + h_right_top + (h_all - h_right_top) / 2 - 5)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.multi_cell(col_right, 6, f"Issue ID\n{issue_id}", align="C")

    return y_top + h_all # ค่า y เริ่มต้นถัดจาก header

# -------------------- Photo helpers (ปรับใหม่) --------------------
def _guess_img_type_from_ext(path_or_url: str) -> str:
    ext = os.path.splitext(str(path_or_url).lower())[1]
    if ext in (".png",): return "PNG"
    if ext in (".jpg", ".jpeg"): return "JPEG"
    return ""  # ให้ fpdf2 เดาเองได้ในบางเวอร์ชัน แต่เราจะพยายามระบุเสมอ

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


def _load_image_source_from_urlpath(url_path: str) -> Tuple[Union[str, BytesIO, None], Optional[str]]:

    if not url_path:
        return None, None

    print(f"[DEBUG] 🔍 กำลังหารูป: {url_path}")

    # 1) หา backend/uploads โดยตรง (เพราะ public_root อาจไม่มี uploads)
    backend_root = Path(__file__).resolve().parents[2]  # จาก templates/ ขึ้น 2 ชั้น = backend/
    uploads_root = backend_root / "uploads"
    
    print(f"[DEBUG] backend_root = {backend_root}")
    print(f"[DEBUG] uploads_root = {uploads_root}")

    if uploads_root.exists():
        # url_path เช่น "/uploads/pm/Klongluang3/..." หรือ "uploads/pm/..."
        # ต้องตัด "uploads/" ออกเพราะเราชี้ไปที่ uploads_root แล้ว
        clean_path = url_path.lstrip("/")
        if clean_path.startswith("uploads/"):
            clean_path = clean_path[8:]  # ตัด "uploads/" ออก
        
        local_path = uploads_root / clean_path
        print(f"[DEBUG] 📂 ตรวจสอบไฟล์: {local_path}")
        
        if local_path.exists() and local_path.is_file():
            print(f"[DEBUG] ✅ เจอไฟล์แล้ว!")
            return local_path.as_posix(), _guess_img_type_from_ext(local_path.as_posix())
        else:
            print(f"[DEBUG] ❌ ไม่เจอไฟล์ที่: {local_path}")
    else:
        print(f"[DEBUG] ⚠️ ไม่มีโฟลเดอร์ uploads: {uploads_root}")

    # 2) ลอง public_root (กรณีรูปอยู่ใน public/)
    public_root = _find_public_root()
    if public_root:
        local_path = public_root / url_path.lstrip("/")
        print(f"[DEBUG] 📂 ลองหาใน public: {local_path}")
        
        if local_path.exists() and local_path.is_file():
            print(f"[DEBUG] ✅ เจอไฟล์ใน public!")
            return local_path.as_posix(), _guess_img_type_from_ext(local_path.as_posix())

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
PHOTO_IMG_MAX_H = 48
PHOTO_GAP = 3
PHOTO_PAD_X = 2
PHOTO_PAD_Y = 4
PHOTO_ROW_MIN_H = 15
PHOTO_FONT_SMALL = 10
PHOTO_LINE_H = 6

def _draw_photos_table_header(pdf: FPDF, base_font: str, x: float, y: float, q_w: float, g_w: float) -> float:
    header_h = 9.0
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_xy(x, y)
    pdf.cell(q_w, header_h, "ข้อ / คำถาม", border=1, align="C")
    pdf.cell(g_w, header_h, "รูปภาพประกอบ", border=1, ln=1, align="C")
    return y + header_h

def _draw_photos_row(pdf: FPDF, base_font: str, x: float, y: float, q_w: float, g_w: float,
                     question_text: str, image_items: List[dict]) -> float:
    
    # ความสูงฝั่งข้อความ
    _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)

    # ความสูงฝั่งรูป
    img_h = PHOTO_IMG_MAX_H
    row_h = max(ROW_MIN_H, text_h, img_h + 2 * PADDING_Y)

    # ซ้าย: คำถาม
    _cell_text_in_box(pdf, x, y, q_w, row_h, question_text, align="L", lh=LINE_H, valign="top")

    # ขวา: รูป
    gx = x + q_w
    pdf.rect(gx, y, g_w, row_h)

    slot_w = (g_w - 2 * PADDING_X - (PHOTO_MAX_PER_ROW - 1) * PHOTO_GAP) / PHOTO_MAX_PER_ROW
    cx = gx + PADDING_X
    cy = y + (row_h - img_h) / 2.0

    # เตรียมรายการรูป (สูงสุด PHOTO_MAX_PER_ROW)
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
                    pdf.image(src, x=cx, y=cy, w=slot_w, h=img_h, type=(img_type or None))
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

    job = doc.get("job", {}) or {}
    station_name = job.get("station_name", "-")
    pm_date = _fmt_date_thai_like_sample(doc.get("pm_date", job.get("date", "-")))
    issue_id = str(doc.get("issue_id", "-"))
    issue_id = str(doc.get("issue_id", "-"))

    checks = _rows_to_checks(doc.get("rows") or {}, doc.get("measures") or {})

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
    y = _draw_header(pdf, base_font, issue_id)

    # ชื่อเอกสาร
    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 16)
    pdf.cell(page_w, 10, "Preventive Maintenance Checklist - CB BOX", border=1, ln=1, align="C")
    y += 10

    # แสดงข้อมูลงานใต้หัวเรื่อง
    y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, pm_date)

    # ตารางรายการ
    x_table = x0 + EDGE_ALIGN_FIX
    table_total_w = page_w - 2 * EDGE_ALIGN_FIX
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "", FONT_MAIN)

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
            y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w)
            pdf.set_font(base_font, "", FONT_MAIN)

    # วาดหัวตารางแรก
    y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w)
    pdf.set_font(base_font, "", FONT_MAIN)

    for it in checks:
        text = str(it.get("text", ""))
        result = it.get("result", "na")
        remark = str(it.get("remark", "") or "")

        _, item_h = _split_lines(pdf, item_w - 2 * PADDING_X, text, LINE_H)
        _, remark_h = _split_lines(pdf, remark_w - 2 * PADDING_X, remark, LINE_H)
        
        # ใช้ regex เพื่อหาหมายเลขข้อที่แท้จริง
        match_row = re.match(r"^(\d+)\.", text.strip())
        row_num = int(match_row.group(1)) if match_row else 0
        
        # กำหนดความสูงขั้นต่ำสำหรับข้อ 5
        if row_num == 5:
            # กำหนดความสูงที่ต้องการ (ปรับตัวเลขได้ตามต้องการ)
            min_row_5_height = LINE_H * 13  
            row_h_eff = max(ROW_MIN_H, item_h, remark_h, min_row_5_height)
        else:
            row_h_eff = max(ROW_MIN_H, item_h, remark_h)

        _ensure_space(row_h_eff)

        x = x_table
        _cell_text_in_box(pdf, x, y, item_w, row_h_eff, text, align="L", lh=LINE_H)
        x += item_w
        _draw_result_cell(pdf, base_font, x, y, result_w, row_h_eff, result)
        x += result_w
        _cell_text_in_box(pdf, x, y, remark_w, row_h_eff, remark, align="L", lh=LINE_H, valign="top")

        y += row_h_eff

    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_draw_color(0, 0, 0)

    # ส่วน Comment & Summary
    comment_x = x_table
    comment_y = y
    comment_item_w = item_w
    comment_result_w = result_w
    comment_remark_w = remark_w

    h_comment = 12
    h_summary = 10
    h_checklist = 12
    total_h = h_comment + h_summary + h_checklist
    pdf.rect(comment_x, comment_y, item_w + result_w + remark_w, total_h)

    pdf.set_xy(comment_x, comment_y)
    pdf.set_font(base_font, "B", 13)
    pdf.cell(comment_item_w, h_comment, "Comment :", border=1, align="L")
    pdf.set_font(base_font, "", 13)
    comment_text = str(doc.get("summary", "") or "-")
    pdf.multi_cell(comment_result_w + comment_remark_w, h_comment, comment_text, border=1, align="L")
    comment_y += h_comment

    summary_check = str(doc.get("summaryCheck", "")).strip().upper() or "-"

    pdf.set_xy(comment_x, comment_y)
    pdf.set_font(base_font, "B", 13)
    pdf.cell(comment_item_w, h_checklist, "ผลการตรวจสอบ :", border=1, align="L")
    pdf.set_font(base_font, "", 13)
    x_check_start = comment_x + comment_item_w + 10
    y_check = comment_y + (h_checklist - CHECKBOX_SIZE) / 2.0
    gap = 35
    options = [("Pass", summary_check == "PASS"), ("Fail", summary_check == "FAIL"), ("N/A", summary_check == "N/A")]
    for i, (label, checked) in enumerate(options):
        x_box = x_check_start + i * gap
        _draw_check(pdf, x_box, y_check, CHECKBOX_SIZE + 0.5, checked)
        pdf.set_xy(x_box + CHECKBOX_SIZE + 3, y_check - 1)
        pdf.cell(20, LINE_H + 1, label, ln=0, align="L")

    pdf.rect(comment_x, comment_y, item_w + result_w + remark_w, h_checklist)
    y = comment_y + h_checklist

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

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_fill_color(255, 230, 100)

    # แถวหัวข้อ (Performed by, Approved by, Witnessed by)
    x_pos = x_table
    for i, label in enumerate(signer_labels):
        pdf.set_xy(x_pos, y)
        pdf.cell(col_widths[i], row_h_header, label, border=1, align="C", fill=True)
        x_pos += col_widths[i]
    y += row_h_header

    # แถวลายเซ็น
    x_pos = x_table
    for i in range(3):
        pdf.rect(x_pos, y, col_widths[i], row_h_sig)
        x_pos += col_widths[i]
    y += row_h_sig

    # แถวชื่อ
    pdf.set_font(base_font, "", FONT_MAIN)
    x_pos = x_table
    for i in range(3):
        pdf.rect(x_pos, y, col_widths[i], row_h_name)
        name_text = f"( {' ' * 40} )"
        pdf.set_xy(x_pos, y)
        pdf.cell(col_widths[i], row_h_name, name_text, border=0, align="C")
        x_pos += col_widths[i]
    y += row_h_name

    # แถววันที่
    x_pos = x_table
    for i in range(3):
        pdf.rect(x_pos, y, col_widths[i], row_h_date)
        date_text = "Date : " + " " * 9
        margin_left = 5
        pdf.set_xy(x_pos + margin_left, y)
        pdf.cell(col_widths[i] - margin_left, row_h_date, date_text, border=0, align="L")
        x_pos += col_widths[i]
    y += row_h_date

    # -------------------------------
    # ขึ้นหน้าใหม่สำหรับรูป (เรียก header ทุกครั้งหลัง add_page)
    # -------------------------------
    pdf.add_page()

    # วาด header เหมือนหน้าก่อนหน้า
    x0 = 10
    y = _draw_header(pdf, base_font, issue_id)  # วาดหัวกระดาษ

    # ชื่อเอกสาร
    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 16)
    pdf.cell(page_w, 10, "Preventive Maintenance Checklist - CB BOX", border=1, ln=1, align="C")
    y += 10

    # แสดงข้อมูลงานใต้หัวเรื่อง
    y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, pm_date)
    
    # photo
    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 14)
    pdf.set_fill_color(255, 230, 100)
    pdf.cell(page_w, 10, "Photos", border=1, ln=1, align="C", fill=True)
    y += 10

    # ========== ตารางรูปแบบ 2 คอลัมน์: r# (ซ้าย) / g# (ขวา) ==========
    # ตั้งค่าความกว้างคอลัมน์
    x_table = x0 + EDGE_ALIGN_FIX
    q_w = 85.0                       # กว้างคอลัมน์ "ข้อ/คำถาม"
    g_w = (page_w - 2 * EDGE_ALIGN_FIX) - q_w  # กว้างคอลัมน์รูป

    # ฟังก์ชันตรวจพื้นที่ (ใช้ตัวเดียวกับตารางก่อนหน้า)
    def _ensure_space_photo(height_needed: float):
        nonlocal y
        if y + height_needed > (pdf.h - pdf.b_margin):
            pdf.add_page()
            y = _draw_header(pdf, base_font, issue_id)
            # หัวเรื่องย่อย Photos ซ้ำเมื่อขึ้นหน้าใหม่เพื่อไม่ให้สับสน
            pdf.set_xy(x0, y)
            pdf.set_font(base_font, "B", 14)
            pdf.set_fill_color(255, 230, 100)
            pdf.cell(page_w, 10, "Photos (ต่อ)", border=1, ln=1, align="C", fill=True)
            y += 10
            y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)
            pdf.set_font(base_font, "", 11)

    # วาดหัวตาราง Photos
    y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)

    # วาดทีละข้อ โดย map r# -> g# จาก doc["photos"]
    for it in checks:
        idx = int(it.get("idx") or 0)
        question_text = ROW_TITLES.get(f"r{idx}", it.get("text", f"{idx}. -"))
        pdf.set_font(base_font, "", 11)

        # ดึงรูป: photos.g{idx}[].url
        img_items = _get_photo_items_for_idx(doc, idx)

        # ประเมินพื้นที่ก่อนขึ้นหน้าใหม่
        _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)
        est_row_h = max(ROW_MIN_H, text_h, PHOTO_IMG_MAX_H + 2 * PADDING_Y)
        _ensure_space_photo(est_row_h)

        # วาดแถว
        row_h_used = _draw_photos_row(pdf, base_font, x_table, y, q_w, g_w, question_text, img_items)
        y += row_h_used

    
    return _output_pdf_bytes(pdf)


# Public API expected by pdf_routes: generate_pdf(data) -> bytes
def generate_pdf(data: dict) -> bytes:
 
    return make_pm_report_html_pdf_bytes(data)

