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

# -------------------- Title --------------------
DOCUMENT_TITLE_POST = "Preventive Maintenance Checklist - Charger (POST)"
DOCUMENT_TITLE_POST_CONT = "Preventive Maintenance Checklist - Charger (POST Continued)"
DOCUMENT_TITLE_PHOTO_CONT = "Preventive Maintenance - Photos (Continued)"
DOCUMENT_TITLE_PHOTO_PRE = "Preventive Maintenance - Photos (PRE)"
DOCUMENT_TITLE_PHOTO_POST = "Preventive Maintenance - Photos (POST)"

PDF_DEBUG = os.getenv("PDF_DEBUG") == "1"


# -------------------- Fonts TH --------------------
FONT_CANDIDATES: Dict[str, List[str]] = {
    "":  ["THSarabunNew.ttf", "TH Sarabun New.ttf", "THSarabun.ttf", "TH SarabunPSK.ttf"],
    "B": ["THSarabunNew-Bold.ttf", "THSarabunNew Bold.ttf", "TH Sarabun New Bold.ttf", "THSarabun Bold.ttf"],
    "I": ["THSarabunNew-Italic.ttf", "THSarabunNew Italic.ttf", "TH Sarabun New Italic.ttf", "THSarabun Italic.ttf"],
    "BI":["THSarabunNew-BoldItalic.ttf", "THSarabunNew BoldItalic.ttf", "TH Sarabun New BoldItalic.ttf", "THSarabun BoldItalic.ttf"],
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
SIG_H = 28
TITLE_H = 5.5
CHARGER_ROW_H = 5
PHOTO_CONTINUE_H = 6
EDGE_ALIGN_FIX = (LINE_W_OUTER - LINE_W_INNER) / 2.0
ITEM_W = 65
RESULT_W = 64
PHOTO_Q_W = 85.0


# -------------------- รายการหัวข้อ MDB --------------------
# Thai version
ROW_TITLES_TH = {
    "r1": "ตรวจสอบสภาพทั่วไป",
    "r2": "ตรวจสอบสภาพดักซีล,ซิลิโคนกันซึม",
    "r3": "ตรวจสอบ Power Meter",
    "r4": "ตรวจสอบแรงดันไฟฟ้า Breaker Main",
    "r5": "ตรวจสอบแรงดันไฟฟ้า Breaker Charger",
    "r6": "ตรวจสอบแรงดันไฟฟ้า Breaker CCB",
    "r7": "ตรวจสอบแรงดันไฟฟ้า RCD",
    "r8": "ทดสอบปุ่ม RCD Trip",
    "r9": "ทดสอบปุ่ม Breaker CCB Trip",
    "r10": "ทดสอบปุ่ม Breaker Charger Trip",
    "r11": "ทดสอบปุ่ม Breaker Main Trip",
    "r12": "ตรวจสอบจุดต่อทางไฟฟ้า",
    "r13": "ทำความสะอาดตู้ MDB"
}

# English version
ROW_TITLES_EN = {
    "r1": "General condition inspection",
    "r2": "Check sealant and silicone",
    "r3": "Check Power Meter",
    "r4": "Check Breaker Main voltage",
    "r5": "Check Breaker Charger voltage",
    "r6": "Check Breaker CCB voltage",
    "r7": "Check RCD voltage",
    "r8": "Test RCD Trip button",
    "r9": "Test Breaker CCB Trip button",
    "r10": "Test Breaker Charger Trip button",
    "r11": "Test Breaker Main Trip button",
    "r12": "Check electrical connections",
    "r13": "Clean MDB cabinet"
}

# Default to Thai
ROW_TITLES = ROW_TITLES_TH

# ชื่อข้อย่อย (ข้อที่มี 2 ข้อย่อยคงที่)
# Thai version
SUB_ROW_TITLES_TH = {
    "r5_1": "Breaker Charger ตัวที่ 1",
    "r7_1": "RCD ตัวที่ 1",
    "r8_1": "RCD ตัวที่ 1",
    "r10_1": "Breaker Charger ตัวที่ 1",
}

# English version
SUB_ROW_TITLES_EN = {
    "r5_1": "Breaker Charger #1",
    "r7_1": "RCD #1",
    "r8_1": "Trip Test RCD #1",
    "r10_1": "Trip Test Breaker Charger #1",
}

# Default to Thai
SUB_ROW_TITLES = SUB_ROW_TITLES_TH

# ข้อที่มีข้อย่อย dynamic (4, 5, 6, 7, 9, 11)
DYNAMIC_SUB_ROWS = {4, 5, 6, 7, 9, 11}

# ข้อที่มีข้อย่อยคงที่
FIXED_SUB_ROWS = {8: 1, 10: 1}


# -------------------- Utilities / Core helpers --------------------
def _log(msg: str):
    if PDF_DEBUG:
        print(msg)

def _guess_img_type_from_ext(path_or_url: str) -> str:
    ext = os.path.splitext(str(path_or_url).lower())[1]
    if ext in (".png",):
        return "PNG"
    if ext in (".jpg", ".jpeg"):
        return "JPEG"
    return ""

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
        return str(val) if val else ""
    year_be_2 = (d.year + 543) % 100
    return d.strftime(f"%d-%b-{year_be_2:02d}")

def _fmt_date_thai_full(val) -> str:
    """แปลงวันที่เป็นรูปแบบ DD/MM/YYYY (ปีพุทธศักราช)
    เช่น: 21/12/2568"""
    if isinstance(val, (datetime, date)):
        d = datetime(val.year, val.month, val.day)
    else:
        d = _parse_date_flex(str(val)) if val is not None else None
    if not d:
        return str(val) if val else ""
    year_be = d.year + 543  # แปลงเป็นปีพุทธศักราช
    return d.strftime(f"%d/%m/{year_be}")

def _norm_result(val: str) -> str:
    s = (str(val) if val is not None else "").strip().lower()
    if s in ("pass", "p", "true", "ok", "1", "✔", "✓"):
        return "pass"
    if s in ("fail", "f", "false", "0", "x", "✗", "✕"):
        return "fail"
    return "na"

def _r_idx(k: str) -> Tuple[int, int]:
    """Return (main_idx, sub_idx) for sorting
    r3 -> (3, 0)
    r3_1 -> (3, 1)
    r3_2 -> (3, 2)
    """
    k = k.lower()
    # ข้อย่อย: r3_1, r3_2, etc.
    m = re.match(r"r(\d+)_(\d+)$", k)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    # ข้อหลัก: r3, r4, etc.
    m = re.match(r"r(\d+)$", k)
    if m:
        return (int(m.group(1)), 0)
    return (10_000, 0)

# -------------------- Font / Text layout helpers --------------------
def add_all_thsarabun_fonts(pdf: FPDF, family_name: str = "THSarabun") -> bool:
    here = Path(__file__).parent
    search_dirs = [
        here / "fonts",
        here.parent / "fonts",
        Path("C:/Windows/Fonts"),
        Path("/Library/Fonts"),
        Path(os.path.expanduser("~/Library/Fonts")),
        Path("/usr/share/fonts"),
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

def _split_lines(pdf: FPDF, width: float, text: str, line_h: float):
    """คำนวณจำนวนบรรทัดและความสูงโดยใช้ logic เดียวกับ _cell_text_in_box"""
    text = "" if text is None else str(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    
    def _wrap_paragraph(paragraph: str) -> List[str]:
        # เก็บ leading spaces ไว้
        leading_spaces = ""
        stripped = paragraph.lstrip(" ")
        if len(paragraph) > len(stripped):
            leading_spaces = paragraph[:len(paragraph) - len(stripped)]
        
        words = stripped.split(" ")
        lines, cur = [], ""
        
        for wd in words:
            candidate = wd if not cur else (cur + " " + wd)
            # ทุกบรรทัดในย่อหน้าเดียวกันจะมี leading_spaces เหมือนกัน
            test_str = leading_spaces + candidate
            if pdf.get_string_width(test_str) <= width:
                cur = candidate
            else:
                if cur:
                    lines.append(leading_spaces + cur)
                if pdf.get_string_width(leading_spaces + wd) <= width:
                    cur = wd
                else:
                    # คำยาวเกินไป ต้องแบ่ง
                    buf = wd
                    while buf:
                        k = 1
                        test_str = leading_spaces + buf[:k] if buf == wd else buf[:k]
                        while k <= len(buf) and pdf.get_string_width(test_str) <= width:
                            k += 1
                            if k <= len(buf):
                                test_str = leading_spaces + buf[:k] if buf == wd else buf[:k]
                        lines.append((leading_spaces if buf == wd else "") + buf[: k - 1])
                        buf = buf[k - 1 :]
                    cur = ""
        if cur:
            lines.append(leading_spaces + cur)
        return lines
    
    paragraphs = text.split("\n")
    all_lines: List[str] = []
    for p in paragraphs:
        if p == "":
            all_lines.append("")
            continue
        all_lines.extend(_wrap_paragraph(p))
    
    return all_lines, max(line_h, len(all_lines) * line_h)

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
        # เก็บ leading spaces ไว้
        leading_spaces = ""
        stripped = paragraph.lstrip(" ")
        if len(paragraph) > len(stripped):
            leading_spaces = paragraph[:len(paragraph) - len(stripped)]
        
        words = stripped.split(" ")
        lines, cur = [], ""
        
        for wd in words:
            candidate = wd if not cur else (cur + " " + wd)
            # ทุกบรรทัดในย่อหน้าเดียวกันจะมี leading_spaces เหมือนกัน
            if pdf.get_string_width(leading_spaces + candidate) <= inner_w:
                cur = candidate
            else:
                if cur:
                    # เพิ่ม leading spaces ทุกบรรทัด
                    lines.append(leading_spaces + cur)
                if pdf.get_string_width(leading_spaces + wd) <= inner_w:
                    cur = wd
                else:
                    # คำยาวเกินไป ต้องแบ่ง
                    buf = wd
                    while buf:
                        k = 1
                        test_str = leading_spaces + buf[:k] if buf == wd else buf[:k]
                        while k <= len(buf) and pdf.get_string_width(test_str) <= inner_w:
                            k += 1
                            if k <= len(buf):
                                test_str = leading_spaces + buf[:k] if buf == wd else buf[:k]
                        lines.append((leading_spaces if buf == wd else "") + buf[: k - 1])
                        buf = buf[k - 1 :]
                    cur = ""
        if cur:
            lines.append(leading_spaces + cur)
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
    for i, ln in enumerate(lines):
        if cur_y > y + h - lh:
            # ถ้าความสูงของ box ไม่พอ ให้ข้ามการแสดงบรรทัดที่เหลือ
            # (แต่ไม่ควรเกิดเพราะเราได้คำนวณความสูงไว้แล้ว)
            if PDF_DEBUG:
                print(f"[WARNING] Text overflow in box at y={y}, h={h}, line={i+1}/{len(lines)}: {ln[:50]}")
            break
        pdf.set_xy(inner_x, cur_y)
        pdf.cell(inner_w, lh, ln, border=0, ln=1, align=align)
        cur_y += lh
    pdf.set_xy(x + w, y)


# -------------------- Logo / Path / Environment helpers --------------------
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

def _load_image_source_from_urlpath(
    url_path: str,
) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
    if not url_path:
        return None, None

    # print(f"\n{'='*80}")
    # print(f"[DEBUG] 🔍 กำลังหารูป: {url_path}")
    # print(f"{'='*80}")

    # ปรับลำดับ: เช็ค local file ก่อน (เร็วที่สุด) แทนที่จะ download
    
    # 1) backend/uploads (เช็คก่อน - เร็วที่สุด)
    if not url_path.startswith("https"):  # ข้าม http URL
        # print("[DEBUG] 📂 ลองหาใน backend/uploads...")
        
        backend_root = Path(__file__).resolve().parents[2]
        uploads_root = backend_root / "uploads"
        
        if uploads_root.exists():
            clean_path = url_path.lstrip("/")
            
            if clean_path.startswith("uploads/"):
                clean_path = clean_path[8:]
            
            local_path = uploads_root / clean_path
            
            if local_path.exists() and local_path.is_file():
                # print(f"[DEBUG] ✅ เจอรูปแล้ว! {local_path}")
                return local_path.as_posix(), _guess_img_type_from_ext(local_path.as_posix())
            else:
                print(f"[DEBUG] ❌ ไม่เจอรูปที่ {local_path}")

    print(f"[DEBUG] ❌ ไม่เจอรูปจากทุกวิธี!")
    print(f"{'='*80}\n")
    return None, None

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

    # --- 3) แปลง RGBA → RGB (JPEG ไม่รองรับ transparency) ---
    if img.mode in ("RGBA", "LA", "P"):
        # สร้างพื้นหลังสีขาว
        rgb_img = Image.new("RGB", img.size, (255, 255, 255))
        # วางรูปต้นฉบับบนพื้นหลังสีขาว (รักษา transparency)
        if img.mode == "P":
            img = img.convert("RGBA")
        rgb_img.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
        img = rgb_img

    # ส่งออก
    buf = BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf


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
        print(f"[ERROR] ❌ auto-rotate error for {url_path}: {e}")
        import traceback
        traceback.print_exc()
        return None, None


# -------------------- Photo data helpers --------------------
def _collect_photos_for_main_idx(photos: dict, idx: int) -> List[dict]:
    """
    รวมรูปของข้อหลัก เช่น idx=7 → g7, g7_1, g7_2, ... และ r7_1, r7_2, ...
    """
    out = []
    prefix_g = f"g{idx}"
    prefix_r = f"r{idx}_"

    for k, items in (photos or {}).items():
        # รองรับทั้ง g{idx} และ r{idx}_* (เช่น r4_1, r6_2)
        if k == prefix_g or k.startswith(prefix_g + "_") or k.startswith(prefix_r):
            if isinstance(items, list):
                for p in items:
                    if isinstance(p, dict) and p.get("url"):
                        out.append(p)

    return out

def _get_photo_items_for_idx(doc: dict, idx: int) -> List[dict]:
    photos = doc.get("photos") or {}
    out = _collect_photos_for_main_idx(photos, idx)
    return out[:PHOTO_MAX_PER_ROW]

def _get_photo_items_for_idx_pre(doc: dict, idx: int) -> List[dict]:
    photos_pre = doc.get("photos_pre") or {}
    out = _collect_photos_for_main_idx(photos_pre, idx)
    return out[:PHOTO_MAX_PER_ROW]


# -------------------- Measurement / Data formatting --------------------
def _format_voltage_measurement_order_full(measures: dict, key: str) -> str:
    """แสดงค่าแรงดันไฟฟ้าสำหรับ Breaker Main (m4, m5, m6, m7, m8)"""
    ms = (measures or {}).get(key) or {}
    if not ms:
        return "-"
    
    # normalize key
    norm_ms = {}
    for k, v in ms.items():
        nk = str(k).strip().replace("–", "-").replace(" ", "")
        norm_ms[nk.upper()] = v
        
    # 10 ค่า
    order_full = [
        "L1-L2", "L2-L3", "L3-L1",
        "L1-N", "L2-N", "L3-N",
        "L1-G", "L2-G", "L3-G",
        "N-G"
    ]
    
    def fmt(k: str) -> str:
        d = norm_ms.get(k.upper()) or {}
        val = str(d.get("value", "")).strip()
        unit = str(d.get("unit", "")).strip()
        return f"{k} = {val}{unit}" if val else f"{k} = -"
    
    # วาง 3 ค่าต่อบรรทัด
    lines = []
    group = []
    for k in order_full:
        group.append(fmt(k))
        if len(group) == 3:
            lines.append(", ".join(group))
            group = []
    if group:
        lines.append(", ".join(group))
    
    # เพิ่มการเยื้อง 8 ช่องว่างให้ทุกบรรทัด เพื่อให้ตรงกับข้อย่อย (4.1))
    # indented_lines = ["        " + line for line in lines]
    return "\n".join(lines)

def _format_voltage_measurement_simple(measures: dict, key: str) -> str:
    """
    แปลงค่า measures เป็น text สำหรับแสดงในช่อง (รูปแบบง่าย 3 ค่า)
    ใช้สำหรับข้อ 6 ที่มีแค่ L1-N, L1-G, N-G
    """
    ms = (measures or {}).get(key) or {}
    if not ms:
        return "-"
    
    # normalize key
    norm_ms = {}
    for k, v in ms.items():
        nk = str(k).strip().replace("–", "-").replace(" ", "")
        norm_ms[nk.upper()] = v
    
    # 4 ค่า
    order_full = [
        "L1-N",
        "L1-G", 
        "N-G"
    ]
    
    def fmt(k: str) -> str:
        d = norm_ms.get(k.upper()) or {}
        val = str(d.get("value", "")).strip()
        unit = str(d.get("unit", "")).strip()
        return f"{k} = {val}{unit}" if val else f"{k} = -"
    
    # วาง 3 ค่าต่อบรรทัด
    lines = []
    group = []
    for k in order_full:
        group.append(fmt(k))
        if len(group) == 3:
            lines.append(", ".join(group))
            group = []
    if group:
        lines.append(", ".join(group))
    return "\n".join(lines)

# -------------------- Result / Row processing --------------------
def _rows_to_checks(rows: dict, measures: Optional[dict] = None, row_titles: dict = None, sub_row_titles: dict = None, lang: str = "th") -> List[dict]:
    """แปลง rows dict เป็น list พร้อมจัดกลุ่มข้อหลักและข้อย่อย"""
    if not isinstance(rows, dict):
        return []

    # ใช้ค่า default ถ้าไม่ได้ส่งมา
    if row_titles is None:
        row_titles = ROW_TITLES
    if sub_row_titles is None:
        sub_row_titles = SUB_ROW_TITLES

    measures = measures or {}
    items: List[dict] = []
    
    # จัดกลุ่ม keys ตามข้อหลัก
    grouped = {}  # {main_idx: {"main": key, "subs": [(sub_idx, key), ...]}}
    
    for key in rows.keys():
        main_idx, sub_idx = _r_idx(key)
        if main_idx == 10_000:
            continue
            
        if main_idx not in grouped:
            grouped[main_idx] = {"main": None, "subs": []}
        
        if sub_idx == 0:
            grouped[main_idx]["main"] = key
        else:
            grouped[main_idx]["subs"].append((sub_idx, key))
    
    # เรียงลำดับข้อหลัก
    for main_idx in sorted(grouped.keys()):

        if f"r{main_idx}" not in row_titles:                                                                                                                                                                                                                                           
            continue

        group = grouped[main_idx]
        main_key = group["main"]
        subs = sorted(group["subs"], key=lambda x: x[0])  # เรียงตาม sub_idx
        
        # 🔥 FIX: กรองเฉพาะข้อย่อยที่มีอยู่ใน FIXED_SUB_ROWS หรือ DYNAMIC_SUB_ROWS
        if main_idx in FIXED_SUB_ROWS:
            # ข้อที่มีจำนวนข้อย่อยคงที่ - เอาเท่าที่กำหนดไว้
            expected_count = FIXED_SUB_ROWS[main_idx]
            subs = subs[:expected_count]
        elif main_idx == 6:
            # ข้อ 6 จำกัด max 4 ข้อย่อย
            subs = subs[:4]
        elif main_idx not in DYNAMIC_SUB_ROWS:
            # ถ้าไม่ใช่ข้อที่มีข้อย่อยทั้ง FIXED และ DYNAMIC ให้เคลียร์ subs
            subs = []

        # ดึงข้อมูลข้อหลัก
        main_data = rows.get(main_key, {}) if main_key else {}
        main_title = row_titles.get(f"r{main_idx}", f"รายการที่ {main_idx}")
        
        # ========== ไม่มีข้อย่อย - แสดงปกติ ==========
        if not subs:
            title = f"{main_idx}) {main_title}"
            remark_user = (main_data.get("remark") or "").strip()
            
            # ถ้า remark เป็น "-" ให้เปลี่ยนเป็นค่าว่าง
            if remark_user == "-":
                remark_user = ""
            
            # เพิ่มค่า measures สำหรับข้อ 10
            if main_idx == 10:
                cp_data = measures.get("cp", {})
                cp_value = cp_data.get("value", "-")
                cp_unit = cp_data.get("unit", "")
                title += f"\nCP = {cp_value}{cp_unit}"
            
            items.append({
                "idx": main_idx,
                "key": main_key,
                "text": title,
                "result": _norm_result(main_data.get("pf", "")),
                "remark": remark_user,
                "has_subs": False,
            })
        
        # ========== มีข้อย่อย - สร้าง combined item ==========
        else:
            lines = [f"{main_idx}) {main_title}"]
            results = []
            remarks = []

            # สร้าง list เก็บข้อมูล voltage สำหรับแต่ละข้อย่อย
            voltage_data = {}
            
            # ดึงข้อมูล voltage ล่วงหน้า
            if main_idx == 4:
                m4_data = measures.get("m4", {})
                for i, (sub_idx, sub_key) in enumerate(subs):
                    sub_key_in_measures = f"r4_{sub_idx}"
                    sub_voltage = m4_data.get(sub_key_in_measures, {})
                    if sub_voltage:
                        voltage_text = _format_voltage_measurement_order_full({sub_key_in_measures: sub_voltage}, sub_key_in_measures)
                        if voltage_text and voltage_text != "-":
                            voltage_data[i] = voltage_text
            
            elif main_idx == 5:
                m5_data = measures.get("m5", {})
                for i, (sub_idx, sub_key) in enumerate(subs):
                    sub_key_in_measures = f"r5_{sub_idx}"
                    sub_voltage = m5_data.get(sub_key_in_measures, {})
                    if sub_voltage:
                        voltage_text = _format_voltage_measurement_order_full({sub_key_in_measures: sub_voltage}, sub_key_in_measures)
                        if voltage_text and voltage_text != "-":
                            voltage_data[i] = voltage_text
            
            elif main_idx == 6:
                m6_data = measures.get("m6", {})
                for i, (sub_idx, sub_key) in enumerate(subs):
                    sub_key_in_measures = f"r6_{sub_idx}"
                    sub_voltage = m6_data.get(sub_key_in_measures, {})
                    if sub_voltage:
                        voltage_text = _format_voltage_measurement_simple({sub_key_in_measures: sub_voltage}, sub_key_in_measures)
                        if voltage_text and voltage_text != "-":
                            voltage_data[i] = voltage_text
            
            elif main_idx == 7:
                m7_data = measures.get("m7", {})
                for i, (sub_idx, sub_key) in enumerate(subs):
                    sub_key_in_measures = f"r7_{sub_idx}"
                    sub_voltage = m7_data.get(sub_key_in_measures, {})
                    if sub_voltage:
                        voltage_text = _format_voltage_measurement_simple({sub_key_in_measures: sub_voltage}, sub_key_in_measures)
                        if voltage_text and voltage_text != "-":
                            voltage_data[i] = voltage_text

            # กรองเฉพาะข้อย่อยที่มีข้อมูลจริงๆ
            filtered_subs = []
            for i, (sub_idx, sub_key) in enumerate(subs):
                # ตรวจสอบว่ามี sub_key ใน rows หรือไม่
                if not sub_key:
                    continue

                sub_data = rows.get(sub_key, {})
                has_voltage = i in voltage_data
                has_pf = bool(sub_data.get("pf"))
                has_remark = bool((sub_data.get("remark") or "").strip())
                has_rows_data = bool(sub_data)  # มี key ใน rows

                # สำหรับข้อ 4, 5, 6, 7 ที่มี voltage data - ต้องมีทั้ง voltage data และ rows data
                if main_idx in {4, 5, 6, 7}:
                    if has_voltage and has_rows_data:
                        filtered_subs.append((i, sub_idx, sub_key))
                # ข้ออื่นๆ - ถ้ามีข้อมูลอย่างใดอย่างหนึ่ง ให้เก็บไว้
                elif has_voltage or has_pf or has_remark:
                    filtered_subs.append((i, sub_idx, sub_key))

            # ถ้าไม่มีข้อย่อยที่มีข้อมูล ให้แสดงเป็นข้อหลักปกติ
            if not filtered_subs:
                title = f"{main_idx}) {main_title}"
                remark_user = (main_data.get("remark") or "").strip()

                items.append({
                    "idx": main_idx,
                    "key": main_key,
                    "text": title,
                    "result": _norm_result(main_data.get("pf", "")),
                    "remark": remark_user,
                    "has_subs": False,
                })
                continue

            # นับจำนวนข้อย่อยที่กรองแล้ว
            sub_count = len(filtered_subs)

            for original_i, sub_idx, sub_key in filtered_subs:

                if sub_key:
                    sub_data = rows.get(sub_key, {})  # ดึงข้อมูล pf/remark จาก rows
                else:
                    sub_data = {}

                # หาชื่อข้อย่อย
                sub_title = sub_row_titles.get(sub_key)

                # สำหรับข้อ 4, 5, 6, 9, 11 ที่เป็น dynamic - ใช้ชื่อตามลำดับ
                if main_idx in DYNAMIC_SUB_ROWS:
                    if main_idx == 4:
                        if lang == "en":
                            sub_title = f"Breaker Main #{sub_idx}"
                        else:
                            sub_title = f"Breaker Main ตัวที่ {sub_idx}"
                    elif main_idx == 5:
                        if lang == "en":
                            sub_title = f"Breaker Charger #{sub_idx}"
                        else:
                            sub_title = f"Breaker Charger ตัวที่ {sub_idx}"
                    elif main_idx == 6:
                        if lang == "en":
                            sub_title = f"Breaker CCB #{sub_idx}"
                        else:
                            sub_title = f"Breaker CCB ตัวที่ {sub_idx}"
                    elif main_idx == 7:
                        if lang == "en":
                            sub_title = f"RCD #{sub_idx}"
                        else:
                            sub_title = f"RCD ตัวที่ {sub_idx}"
                    elif main_idx == 9:
                        if lang == "en":
                            sub_title = f"Trip Test Breaker CCB #{sub_idx}"
                        else:
                            sub_title = f"Breaker CCB ตัวที่ {sub_idx}"
                    elif main_idx == 11:
                        if lang == "en":
                            sub_title = f"Trip Test Breaker Main #{sub_idx}"
                        else:
                            sub_title = f"Breaker Main ตัวที่ {sub_idx}"
                
                # # แสดงเป็น 3.1), 3.2), 4.1), 4.2) etc. - เยื้อง 4 ช่องว่าง
                # lines.append(f"    {main_idx}.{sub_idx}) {sub_title}")

                # # เพิ่มข้อมูล voltage ถ้ามี (ในบรรทัดถัดไป) - เยื้อง 8 ช่องว่างให้ตรงกับข้อความใน sub_title
                # if original_i in voltage_data:
                #     lines.append(f"        {voltage_data[original_i]}")
                # แสดงเป็น 3.1), 3.2), 4.1), 4.2) etc. - เยื้อง 4 ช่องว่าง
                lines.append(f"    {main_idx}.{sub_idx}) {sub_title}")

                # เพิ่มข้อมูล voltage ถ้ามี (ในบรรทัดถัดไป) - เยื้อง 4 ช่องว่างเหมือนกับข้อย่อย
                if original_i in voltage_data:
                    # แยกแต่ละบรรทัดของ voltage data และเพิ่มการเยื้อง 4 ช่องว่าง
                    voltage_lines = voltage_data[original_i].split('\n')
                    for v_line in voltage_lines:
                        lines.append(f"    {v_line}")

                results.append(_norm_result(sub_data.get("pf", "")))
                remarks.append((sub_data.get("remark") or "").strip())
                
            remark_lines = [""]  # บรรทัดแรกว่าง (ตรงกับหัวข้อหลัก)
            for i, (original_i, sub_idx, sub_key) in enumerate(filtered_subs):
                r = remarks[i]
                
                # แสดง remark เฉพาะที่มีค่าและไม่ใช่ "-"
                if r and r.strip() and r.strip() != "-":
                    remark_lines.append(f"{main_idx}.{sub_idx}) {r}")
                else:
                    # ถ้าไม่มี remark ให้เพิ่มบรรทัดว่าง
                    remark_lines.append("")

                # เพิ่มบรรทัดว่างให้ตรงกับจำนวนบรรทัดของ voltage measurements
                # ถ้ามี voltage data ให้นับจำนวนบรรทัด (นับจาก \n + 1)
                if original_i in voltage_data:
                    voltage_text = voltage_data[original_i]
                    # จำนวนบรรทัดจริง = จำนวน \n + 1
                    voltage_line_count = voltage_text.count('\n') + 1
                    # เพิ่มบรรทัดว่างเท่ากับจำนวนบรรทัดของ voltage
                    for _ in range(voltage_line_count):
                        remark_lines.append("")
            
            combined_remark = "\n".join(remark_lines)
            
            items.append({
                "idx": main_idx,
                "key": main_key,
                "text": "\n".join(lines),
                "result": results,
                "remark": combined_remark if combined_remark else "-",
                "has_subs": True,
                "sub_count": sub_count,
            })
    
    return items

def _draw_check(pdf: FPDF, x: float, y: float, size: float, checked: bool):
    pdf.rect(x, y, size, size)
    if checked:
        lw_old = pdf.line_width
        pdf.set_line_width(0.6)
        pdf.line(x + 0.7, y + size * 0.55, x + size * 0.40, y + size - 0.7)
        pdf.line(x + size * 0.40, y + size - 0.7, x + size - 0.7, y + 0.7)
        pdf.set_line_width(lw_old)


# -------------------- Drawing – header / table header --------------------
def _draw_header(
    pdf: FPDF,
    base_font: str,
    issue_id: str = "-",
    doc_name: str = "-",
    label_page: str = "Page",
    label_issue_id: str = "Issue ID",
    label_doc_name: str = "Doc Name",
    addr_line1: str = "Electricity Generating Authority of Thailand (EGAT)",  # เพิ่ม
    addr_line2: str = "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand",  # เพิ่ม
    addr_line3: str = "Call Center Tel. 02-114-3350",  # เพิ่ม
) -> float:
    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left
    y_top = 10

    col_left, col_mid = 35, 120
    col_right = page_w - col_left - col_mid

    h_all = 22
    h_right_half = h_all / 2  # แบ่งกล่องขวาเป็น 2 ส่วนเท่าๆ กัน

    pdf.set_line_width(LINE_W_INNER)

    # ========== Page number ที่มุมขวาบน ==========
    page_text = f"{label_page} {pdf.page_no()}"
    pdf.set_font(base_font, "", FONT_MAIN - 1)
    page_text_w = pdf.get_string_width(page_text) + 4
    page_x = pdf.w - right - page_text_w
    page_y = 5  # ย้ายขึ้นไปด้านบนสุด
    pdf.set_xy(page_x, page_y)
    pdf.cell(page_text_w, 4, page_text, align="R")

    # โลโก้
    pdf.rect(x0, y_top, col_left, h_all)
    logo_path = _resolve_logo_path()
    if logo_path:
        IMG_W = 24
        img_x = x0 + (col_left - IMG_W) / 2
        img_y = y_top + (h_all - 12) / 2
        try:
            pdf.image(logo_path.as_posix(), x=img_x, y=img_y, w=IMG_W)
        except Exception:
            pass

    # กล่องกลาง (ที่อยู่)
    box_x = x0 + col_left
    pdf.rect(box_x, y_top, col_mid, h_all)

    addr_lines = [addr_line1, addr_line2, addr_line3]  # ใช้ parameters

    pdf.set_font(base_font, "B", FONT_MAIN)
    line_h = 4.5

    start_y = y_top + (h_all - line_h * len(addr_lines)) / 2

    for i, line in enumerate(addr_lines):
        pdf.set_xy(box_x + 3, start_y + i * line_h)
        pdf.cell(col_mid - 6, line_h, line, align="C")

    # กล่องขวา - Issue ID (ครึ่งบน)
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_right_half)

    # กล่องขวา - Doc Name (ครึ่งล่าง)
    pdf.rect(xr, y_top + h_right_half, col_right, h_right_half)

    # Issue ID (2 บรรทัด)
    pdf.set_xy(xr, y_top + 1)
    pdf.set_font(base_font, "B", FONT_MAIN - 2)
    pdf.multi_cell(col_right, 4.5, f"{label_issue_id}\n{issue_id}", align="C")

    # Doc Name (2 บรรทัด)
    pdf.set_xy(xr, y_top + h_right_half + 1)
    pdf.set_font(base_font, "B", FONT_MAIN - 2)
    pdf.multi_cell(col_right, 4.5, f"{label_doc_name}\n{doc_name}", align="C")

    return y_top + h_all

def _draw_items_table_header(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    item_w: float,
    result_w: float,
    remark_w: float,
    charger_no: str,
    header_item: str = "Item",     
    header_result: str = "Result",  
    header_remark: str = "Remark",  
):
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "B", FONT_MAIN)

    # ==============================
    # แถว Header: Item | Result | Remark
    # ==============================
    header_h = 5.5
    pdf.set_fill_color(255, 255, 255)  # reset สีพื้น
    pdf.set_xy(x, y)
    pdf.cell(item_w, header_h, header_item, border=1, align="C")
    pdf.cell(result_w, header_h, header_result, border=1, align="C")
    pdf.cell(remark_w, header_h, header_remark, border=1, ln=1, align="C")

    return y + header_h


def _draw_signature_block(
    pdf: FPDF,
    base_font: str,
    x_table: float,
    y: float,
    item_w: float,
    result_w: float,
    remark_w: float,
    pm_date_th: str,
    y_bottom: Optional[float] = None,
    label_performed: str = "Performed by", 
    label_approved: str = "Approved by",    
    label_witnessed: str = "Witnessed by",  
    label_date: str = "Date :",             
) -> float:
    
    signer_labels = [label_performed, label_approved, label_witnessed]
    col_widths = [item_w, result_w, remark_w]

    row_h_header = 5
    row_h_sig = 14
    row_h_name = 5
    row_h_date = 5
    
    total_sig_h = row_h_header + row_h_sig + row_h_name + row_h_date

    pdf.set_line_width(LINE_W_INNER)

    # ถ้ากำหนด y_bottom ให้วาดลายเซ็นที่ด้านล่างสุด
    if y_bottom is not None:
        y = y_bottom - total_sig_h

    # วาดเส้นบน (ต่อจากตาราง)
    pdf.line(x_table, y, x_table + item_w + result_w + remark_w, y)

    # ===== Header (สีเหลือง) =====
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_fill_color(255, 230, 100)

    x_pos = x_table
    for i, label in enumerate(signer_labels):
        pdf.set_xy(x_pos, y)
        pdf.cell(col_widths[i], row_h_header, label, border=1, align="C", fill=True)
        x_pos += col_widths[i]
    y += row_h_header

    # ===== กล่องลายเซ็น =====
    x_pos = x_table
    for w in col_widths:
        pdf.rect(x_pos, y, w, row_h_sig)
        x_pos += w
    y += row_h_sig

    # ===== แถวชื่อ =====
    pdf.set_font(base_font, "", FONT_MAIN)
    x_pos = x_table
    for w in col_widths:
        pdf.rect(x_pos, y, w, row_h_name)
        pdf.set_xy(x_pos, y)
        pdf.cell(w, row_h_name, "(                                                     )", align="C")
        x_pos += w
    y += row_h_name

    # ===== แถววันที่ =====
    x_pos = x_table
    for w in col_widths:
        pdf.rect(x_pos, y, w, row_h_date)
        pdf.set_xy(x_pos, y)
        pdf.cell(w, row_h_date, f"Date :  {pm_date_th}", align="C")
        x_pos += w
    y += row_h_date

    return y


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


def _draw_photos_table_header(
    pdf: FPDF, 
    base_font: str, 
    x: float, 
    y: float, 
    q_w: float, 
    g_w: float,
    header_question: str = "Item / Question",  # เพิ่ม
    header_photos: str = "Reference Photos",   # เพิ่ม
) -> float:
    header_h = 5.5
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_xy(x, y)
    pdf.cell(q_w, header_h, header_question, border=1, align="C")
    pdf.cell(g_w, header_h, header_photos, border=1, ln=1, align="C")
    return y + header_h


# -------------------- Drawing – result cells --------------------
def _draw_result_cell(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    h: float,
    result: Union[str, List[str]],
    offset_lines: int = 0,
    line_step: int = 1,
):
    """วาด result cell รองรับทั้ง single result และ list of results"""
    pdf.rect(x, y, w, h)

    # ให้ result เป็น list เสมอ
    if isinstance(result, (list, tuple)):
        results = list(result)
    else:
        results = [result]

    results = [_norm_result(r) for r in results]
    
    col_w = w / 3.0
    labels = ["pass", "fail", "na"]
    label_text = {"pass": "Pass", "fail": "Fail", "na": "N/A"}

    pdf.set_font(base_font, "", FONT_SMALL)

    # วาดเส้นแบ่งคอลัมน์
    for i in range(1, 3):
        sx = x + i * col_w
        pdf.line(sx, y, sx, y + h)

    base_y = y + PADDING_Y + offset_lines * LINE_H

    for row_idx, res in enumerate(results):
        line_y = base_y + row_idx * line_step * LINE_H

        if line_y + CHECKBOX_SIZE > y + h - PADDING_Y:
            break

        for col_idx, key in enumerate(labels):
            lab = label_text[key]
            sx = x + col_idx * col_w

            text_w = pdf.get_string_width(lab)
            content_w = CHECKBOX_SIZE + 1.6 + text_w
            start_x = sx + (col_w - content_w) / 2.0
            start_y = line_y + (LINE_H - CHECKBOX_SIZE) / 2.0

            checked = (res == key)
            _draw_check(pdf, start_x, start_y, CHECKBOX_SIZE, checked)
            pdf.set_xy(start_x + CHECKBOX_SIZE + 1.6, start_y - 0.3)
            pdf.cell(text_w, LINE_H, lab, border=0, ln=0, align="L")

    pdf.set_xy(x + w, y)

# -------------------- Drawing – rows / photos --------------------
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
                    # print(f"[DEBUG] ✅ ใส่รูปสำเร็จ: {url_path}")
                except Exception as e:
                    print(f"[ERROR] ❌ ใส่รูปล้มเหลว {url_path}: {e}")
                    import traceback
                    traceback.print_exc()
                    pdf.set_xy(cx, cy + (PHOTO_IMG_MAX_H - LINE_H) / 2.0)
                    pdf.cell(slot_w, LINE_H, "-", border=0, align="C")
            else:
                print(f"[ERROR] ❌ img_buf is None for: {url_path}")
                pdf.set_xy(cx, cy + (PHOTO_IMG_MAX_H - LINE_H) / 2.0)
                pdf.cell(slot_w, LINE_H, "-", border=0, align="C")

    pdf.set_xy(x + q_w + g_w, y)
    return row_h


# -------------------- Drawing – job / summary blocks --------------------
def _draw_job_info_block(
    pdf: FPDF, 
    base_font: str, 
    x: float, 
    y: float, 
    w: float,
    station_name: str,
    model: str,
    power: str,
    charger_no: str,
    sn: str,
    pm_date: str,
    label_station: str = "Station",                      
    label_pm_date: str = "PM Date",       
) -> float:
    row_h = 6.5
    col_w = w / 2.0
    label_w = 30
    box_h = row_h
    pdf.set_line_width(LINE_W_INNER)
    pdf.rect(x, y, w, box_h)
    pdf.line(x + col_w, y, x + col_w, y + box_h)

    def _item(x0, y0, label, value):
        pdf.set_xy(x0 + 2, y0 + 1.5)
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.cell(label_w, row_h - 3, label, border=0, align="L")
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.set_xy(x0 + 2 + label_w, y0 + 1.5)
        pdf.cell(col_w - label_w - 4, row_h - 3, str(value or "-"), border=0, align="L")

    _item(x, y, label_station, station_name)
    _item(x + col_w, y, label_pm_date, pm_date)

    return y + box_h


# -------------------- PDF output helper --------------------
def _output_pdf_bytes(pdf: FPDF) -> bytes:
    data = pdf.output(dest="S")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    # fpdf2 เก่าอาจคืน str
    return data.encode("latin1")

# -------------------- PDF base class --------------------
class HTML2PDF(FPDF, HTMLMixin):
    pass

class ReportPDF(HTML2PDF):
    def __init__(self, *args, issue_id="-", doc_name="-", **kwargs):
        super().__init__(*args, **kwargs)
        self.issue_id = issue_id
        self._doc_name = doc_name
        self._section = "checklist"  # "checklist" = วาด signature, "photos" = ไม่วาด
        self._pm_date_th = ""
        self._base_font_name = "Arial"
        # ตัวแปรสำหรับตาราง
        self._table_start_y = None
        self._table_x = None
        self._table_width = None
        # ตัวแปรสำหรับ header labels และ address
        self._label_page = "Page"
        self._label_issue_id = "Issue ID"
        self._label_doc_name = "Doc Name"
        self._addr_line1 = "Electricity Generating Authority of Thailand (EGAT)"
        self._addr_line2 = "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand"
        self._addr_line3 = "Call Center Tel. 02-114-3350"

    def header(self):
        # ทุกหน้าเรียกอัตโนมัติ
        _draw_header(
            self,
            self._base_font_name,
            issue_id=self.issue_id,
            doc_name=self._doc_name,
            label_page=self._label_page,
            label_issue_id=self._label_issue_id,
            label_doc_name=self._label_doc_name,
            addr_line1=self._addr_line1,
            addr_line2=self._addr_line2,
            addr_line3=self._addr_line3
        )
        # self.ln(10)

    def footer(self):
        if self._section == "photos":
            return

        left = self.l_margin
        page_w = self.w - self.l_margin - self.r_margin

        item_w = ITEM_W
        result_w = RESULT_W
        remark_w = page_w - item_w - result_w

        y = self.h - self.b_margin - SIG_H

        _draw_signature_block(
            self,
            self._base_font_name,
            left,
            y,
            item_w,
            result_w,
            remark_w,
            self._pm_date_th,
        )


def make_pm_report_html_pdf_bytes(doc: dict, lang: str = "th") -> bytes:
    #data
    job = doc.get("job", {}) or {}
    station_name = job.get("station_name", "-")
    model = job.get("model", "-")
    power = job.get("power", "-")
    sn = job.get("sn", "-")
    pm_date = _fmt_date_thai_like_sample(doc.get("pm_date", job.get("date", "-")))
    pm_date_th = _fmt_date_thai_full(doc.get("pm_date", job.get("date", "-")))
    issue_id = str(doc.get("issue_id", "-"))
    charger_no = doc.get("job", {}).get("chargerNo", "-")

    # ========== เลือก row titles ตามภาษา ==========
    if lang == "en":
        row_titles = ROW_TITLES_EN
        sub_row_titles = SUB_ROW_TITLES_EN
    else:
        row_titles = ROW_TITLES_TH
        sub_row_titles = SUB_ROW_TITLES_TH

    checks = _rows_to_checks(doc.get("rows") or {}, doc.get("measures") or {}, row_titles, sub_row_titles, lang)
    checks_pre = _rows_to_checks(doc.get("rows_pre") or {}, doc.get("measures_pre") or {}, row_titles, sub_row_titles, lang)

    # ========== เลือกข้อความตามภาษา ==========
    if lang == "en":
        # English titles
        doc_title_post = "Preventive Maintenance Checklist - Charger (POST)"
        doc_title_post_cont = "Preventive Maintenance Checklist - Charger (POST Continued)"
        doc_title_photo_cont = "Preventive Maintenance - Photos (Continued)"
        doc_title_photo_pre = "Preventive Maintenance - Photos (PRE)"
        doc_title_photo_post = "Preventive Maintenance - Photos (POST)"
        
        # Table headers
        header_item = "Item"
        header_result = "Result"
        header_remark = "Remark"
        header_question = "Item / Question"
        header_photos = "Reference Photos"
        
        # Labels
        label_comment = "Comment :"
        label_inspection = "Inspection Results :"
        label_performed = "Performed by"
        label_approved = "Approved by"
        label_witnessed = "Witnessed by"
        label_date = "Date :"
        label_pre_pm = "(Pre-PM)"
        label_remark = "Remark"
        
        # Job info labels
        label_station = "Station"
        label_pm_date = "PM Date"
        
        label_page = "Page"
        label_issue_id = "Issue ID"
        label_doc_name = "Doc Name"
        addr_line1 = "Electricity Generating Authority of Thailand (EGAT)"
        addr_line2 = "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand"
        addr_line3 = "Call Center Tel. 02-114-3350"
        
    else:  # "th"
        # Thai titles
        doc_title_post = "รายการตรวจสอบการบำรุงรักษาเชิงป้องกัน - เครื่องอัดประจุไฟฟ้า (หลัง PM)"
        doc_title_post_cont = "รายการตรวจสอบการบำรุงรักษาเชิงป้องกัน - เครื่องอัดประจุไฟฟ้า (หลัง PM ต่อ)"
        doc_title_photo_cont = "การบำรุงรักษาเชิงป้องกัน - รูปภาพ (ต่อ)"
        doc_title_photo_pre = "การบำรุงรักษาเชิงป้องกัน - รูปภาพ (ก่อน PM)"
        doc_title_photo_post = "การบำรุงรักษาเชิงป้องกัน - รูปภาพ (หลัง PM)"
        
        # Table headers
        header_item = "รายการ"
        header_result = "ผลการตรวจสอบ"
        header_remark = "หมายเหตุ"
        header_question = "รายการ / คำถาม"
        header_photos = "รูปภาพอ้างอิง"
        
        # Labels
        label_comment = "ความเห็นเพิ่มเติม :"
        label_inspection = "สรุปผลการตรวจสอบ :"
        label_performed = "ผู้ปฏิบัติงาน"
        label_approved = "ผู้อนุมัติ"
        label_witnessed = "ผู้เห็นชอบ"
        label_date = "วันที่ :"
        label_pre_pm = "(ก่อน PM)"
        label_remark = "หมายเหตุ"
        
        # Job info labels
        label_station = "สถานี"
        label_pm_date = "วันที่ PM"
        
        label_page = "หน้า"
        label_issue_id = "รหัสเอกสาร"
        label_doc_name = "ชื่อเอกสาร"
        addr_line1 = "การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)"
        addr_line2 = "เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย จังหวัดนนทบุรี 11130"
        addr_line3 = "ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416"
    
    # สร้าง doc_name จาก sn และปี (เช่น F1500624011_2/2026)
    doc_name = str(doc.get("doc_name", ""))
    if not doc_name:
        # สร้างจาก sn และปีจาก pm_date
        try:
            raw_date = doc.get("pm_date", job.get("date", ""))
            if raw_date:
                from datetime import datetime
                if isinstance(raw_date, str):
                    # ลอง parse หลายรูปแบบ
                    for fmt in ["%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"]:
                        try:
                            dt = datetime.strptime(raw_date[:10], fmt)
                            year = dt.year
                            month = dt.month
                            doc_name = f"{sn}_{month}/{year}"
                            break
                        except:
                            continue
                elif hasattr(raw_date, 'year'):
                    doc_name = f"{sn}_{raw_date.month}/{raw_date.year}"
        except:
            pass
        if not doc_name:
            doc_name = sn
    
    pdf = ReportPDF(unit="mm", format="A4", issue_id=issue_id, doc_name=doc_name)
    pdf._pm_date_th = pm_date_th
    pdf._section = "checklist"

    pdf.set_margins(left=10, top=10, right=10)
    pdf.set_auto_page_break(auto=True, margin=12)

    base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
    setattr(pdf, "_base_font_name", base_font)
    pdf.set_font(base_font, size=FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)

    # กำหนดค่า labels และ address ตามภาษา
    pdf._label_page = label_page
    pdf._label_issue_id = label_issue_id
    pdf._label_doc_name = label_doc_name
    pdf._addr_line1 = addr_line1
    pdf._addr_line2 = addr_line2
    pdf._addr_line3 = addr_line3

    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left

    # หน้าแรก
    pdf.add_page()
    # header() จะถูกเรียกอัตโนมัติโดย add_page()
    y = pdf.get_y()

    # ========== ตรวจสอบว่ามีข้อมูล PRE หรือไม่ ==========
    has_pre_data = bool(doc.get("rows_pre"))
    has_pre_photos = bool(doc.get("photos_pre"))

    # ================================================================================
    # 📸 ส่วนที่ 1: PHOTOS PRE (ถ้ามี)
    # ================================================================================
    if has_pre_photos:
        pdf._section = "photos"  # Photos ไม่มี signature
        
        # ========== วาดหัว Photos PRE ==========
        pdf.set_xy(x0, y)
        pdf.set_font(base_font, "B", 13)
        pdf.set_fill_color(255, 230, 100)
        pdf.cell(page_w, TITLE_H, doc_title_photo_pre, border=1, ln=1, align="C", fill=True)
        y += TITLE_H
        
        # ========== วาด Job Info Block ==========
        y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, model, power, charger_no, sn, pm_date, label_station, label_pm_date)
        
        x_table = x0 + EDGE_ALIGN_FIX
        q_w = PHOTO_Q_W
        g_w = (page_w - 2 * EDGE_ALIGN_FIX) - q_w
        
        def _ensure_space_photo_pre(height_needed: float):
            nonlocal y
            if y + height_needed > (pdf.h - pdf.b_margin):
                pdf.add_page()
                # header() จะถูกเรียกอัตโนมัติโดย add_page()
                y = pdf.get_y()
                pdf.set_xy(x0, y)
                pdf.set_font(base_font, "B", 13)
                pdf.set_fill_color(255, 230, 100)
                pdf.cell(page_w, PHOTO_CONTINUE_H, doc_title_photo_cont, border=1, ln=1, align="C", fill=True)
                y += PHOTO_CONTINUE_H
                y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w, header_question, header_photos)
                pdf.set_font(base_font, "", FONT_MAIN)

        y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w, header_question, header_photos)
        pdf.set_font(base_font, "", FONT_MAIN)
        
        for it in checks_pre:
            idx = int(it.get("idx") or 0)
            
            if idx == 13:
                continue

            # ========== สร้าง question text พร้อมข้อย่อยและ remark ==========
            has_subs = it.get("has_subs", False)
            item_text = it.get("text", "")
            item_remark = it.get("remark", "")
            
            if has_subs:
                # แยกบรรทัดของ text และ remark
                text_lines = item_text.split("\n")
                remark_lines = item_remark.split("\n") if item_remark else []
                
                # สร้าง dict สำหรับ lookup remark ของแต่ละข้อย่อย (รองรับ remark หลายบรรทัด)
                remark_dict = {}
                current_sub_key = None
                current_remark_parts = []
                
                for r_line in remark_lines:
                    r_line_stripped = r_line.strip()
                    
                    # ตรวจสอบว่าเป็นการเริ่มข้อย่อยใหม่หรือไม่ (เช่น "8.1) xxx")
                    match = re.match(r"^(\d+\.\d+)\)\s*(.*)$", r_line_stripped)
                    
                    if match:
                        # ถ้ามีข้อย่อยก่อนหน้า ให้บันทึก remark ที่รวมไว้
                        if current_sub_key and current_remark_parts:
                            # รวมบรรทัดโดยบรรทัดที่ 2+ จะมีช่องว่างเยื้องเพิ่ม (ตรงกับความยาวของ "หมายเหตุ: ")
                            first_line = current_remark_parts[0]
                            if len(current_remark_parts) > 1:
                                # คำนวณความยาวของ prefix "หมายเหตุ: " หรือ "Remark: "
                                indent = " " * (len(label_remark) + 2)  # +2 สำหรับ ": "
                                continuation_lines = [indent + line for line in current_remark_parts[1:]]
                                remark_dict[current_sub_key] = first_line + "\n" + "\n".join(continuation_lines)
                            else:
                                remark_dict[current_sub_key] = first_line
                        
                        # เริ่มข้อย่อยใหม่
                        current_sub_key = match.group(1)  # เช่น "8.1"
                        sub_remark = match.group(2).strip()
                        current_remark_parts = [sub_remark] if sub_remark else []
                    else:
                        # บรรทัดต่อเนื่องของ remark เดิม
                        if current_sub_key and r_line_stripped:
                            current_remark_parts.append(r_line_stripped)
                
                # บันทึก remark ของข้อย่อยสุดท้าย
                if current_sub_key and current_remark_parts:
                    # รวมบรรทัดโดยบรรทัดที่ 2+ จะมีช่องว่างเยื้องเพิ่ม
                    first_line = current_remark_parts[0]
                    if len(current_remark_parts) > 1:
                        indent = " " * (len(label_remark) + 2)
                        continuation_lines = [indent + line for line in current_remark_parts[1:]]
                        remark_dict[current_sub_key] = first_line + "\n" + "\n".join(continuation_lines)
                    else:
                        remark_dict[current_sub_key] = first_line
    
                
                # สร้าง question text ใหม่พร้อม remark
                result_lines = []
                current_sub_key = None  # เก็บ sub key ปัจจุบัน
                
                for i, line in enumerate(text_lines):
                    line = line.strip()
                    if not line:
                        continue
                    
                    if i == 0:
                        # หัวข้อหลัก - เพิ่ม (Pre-PM)
                        result_lines.append(f"{line} {label_pre_pm}")
                    else:
                        # ตรวจสอบว่าเป็นข้อย่อยใหม่หรือไม่
                        sub_match = re.match(r"(\d+\.\d+)\)", line)
                        
                        if sub_match:
                            # ถ้ามีข้อย่อยก่อนหน้า ให้แทรก remark ก่อน
                            if current_sub_key and current_sub_key in remark_dict and remark_dict[current_sub_key] and remark_dict[current_sub_key] != "-":
                                result_lines.append(f"    {label_remark}: {remark_dict[current_sub_key]}")
                            
                            # เริ่มข้อย่อยใหม่ - เยื้อง 4 ช่องว่าง
                            current_sub_key = sub_match.group(1)
                            result_lines.append(f"    {line}")
                        else:
                            # ข้อมูลต่อเนื่องของข้อย่อยปัจจุบัน (voltage data) - เยื้อง 4 ช่องว่าง
                            result_lines.append(f"    {line}")
                
                # แทรก remark ของข้อย่อยสุดท้าย
                if current_sub_key and current_sub_key in remark_dict and remark_dict[current_sub_key] and remark_dict[current_sub_key] != "-":
                    result_lines.append(f"    {label_remark}: {remark_dict[current_sub_key]}")
                question_text_pre = "\n".join(result_lines)
            else:
                # ไม่มีข้อย่อย - แสดงปกติ
                default_title = f"Item {idx}" if lang == "en" else f"รายการที่ {idx}"
                main_title = row_titles.get(f"r{idx}", default_title)
                question_text_pre = f"{idx}) {main_title} {label_pre_pm}"

                # เพิ่ม remark ถ้ามี
                remark_label_text = "Remark" if lang == "en" else "หมายเหตุ"
                if item_remark and item_remark.strip() and item_remark.strip() != "-":
                    question_text_pre += f"\n{remark_label_text}: {item_remark.strip()}"

            img_items = _get_photo_items_for_idx_pre(doc, idx)
            # ไม่ข้ามถ้าไม่มีรูป - แสดงทุกข้อ

            # คำนวณความสูงจริงของแถว
            _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text_pre, LINE_H)
            total_images = len(img_items)
            num_rows = math.ceil(total_images / PHOTO_PER_LINE) if total_images > 0 else 0
            img_h = PHOTO_IMG_MAX_H
            images_total_h = (num_rows * img_h + (num_rows - 1) * PHOTO_GAP + 2 * PADDING_Y) if num_rows > 0 else 0
            actual_row_h = max(PHOTO_ROW_MIN_H, text_h + 2 * PADDING_Y, images_total_h + 4)
            
            # เช็คว่าจะล้นหน้าไหม ถ้าใช่ ให้ขึ้นหน้าใหม่ก่อนวาด
            _ensure_space_photo_pre(actual_row_h)

            row_h_used = _draw_photos_row(pdf, base_font, x_table, y, q_w, g_w, 
                                         question_text_pre, img_items)
            y += row_h_used

        # ========== Comment PRE (หลังข้อ 17) ==========
        comment_text_pre = str(doc.get("comment_pre", "") or "-")
        
        # คำนวณความสูงของ comment
        _, comment_h_calculated = _split_lines(pdf, g_w - 2 * PADDING_X, comment_text_pre, LINE_H)
        h_comment = max(LINE_H * 2, comment_h_calculated + LINE_H * 0.5)
        
        # เช็คพื้นที่ก่อนวาด
        _ensure_space_photo_pre(h_comment + 5)
        
        # วาดกรอบ Comment
        comment_x = x_table
        total_w = q_w + g_w
        
        pdf.rect(comment_x, y, total_w, h_comment)
        
        # วาดข้อความ "Comment :"
        pdf.set_font(base_font, "B", 11)
        pdf.set_xy(comment_x, y)
        pdf.cell(q_w, h_comment, label_comment, border=0, align="L")
        
        # วาดเส้นคั่นระหว่าง "Comment :" และข้อความ
        pdf.line(comment_x + q_w, y, comment_x + q_w, y + h_comment)
        
        # วาดข้อความ comment
        pdf.set_font(base_font, "", 11)
        _cell_text_in_box(pdf, comment_x + q_w, y, g_w, h_comment, 
                        comment_text_pre, align="L", lh=LINE_H, valign="middle")
        
        y += h_comment

    # ================================================================================
    # 📋 ส่วนที่ 2: CHECKLIST POST
    # ================================================================================
    if has_pre_photos:
        # ถ้ามี Photos PRE → ต้อง add_page() เพื่อขึ้นหน้าใหม่
        pdf.add_page()
        pdf._section = "checklist"
        # header() จะถูกเรียกอัตโนมัติโดย add_page()
        y = pdf.get_y()
    else:
        # ถ้าไม่มี Photos PRE → ใช้หน้าแรกที่สร้างไว้แล้ว
        pdf._section = "checklist"

    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 13)
    pdf.set_fill_color(255, 230, 100)
    pdf.cell(page_w, TITLE_H, doc_title_post, border=1, ln=1, align="C", fill=True)
    
    y += TITLE_H

    y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, model, power, charger_no, sn, pm_date, label_station, label_pm_date)


    x_table = x0 + EDGE_ALIGN_FIX
    item_w = ITEM_W
    result_w = RESULT_W
    remark_w = page_w - item_w - result_w

    pdf._table_x = x_table
    pdf._table_width = item_w + result_w + remark_w
    pdf._table_start_y = None
    
    def _ensure_space(height_needed: float):
        nonlocal y
        page_bottom = pdf.h - pdf.b_margin - SIG_H

        if y + height_needed > page_bottom:
            # **วาดเส้นกรอบเชื่อมต่อ**
            if pdf._table_x and pdf._table_width:
                pdf.line(pdf._table_x, y, pdf._table_x, page_bottom)
                table_right = pdf._table_x + pdf._table_width
                pdf.line(table_right, y, table_right, page_bottom)
            
            pdf.add_page()
            # header() จะถูกเรียกอัตโนมัติโดย add_page()
            y = pdf.get_y()

            pdf.set_xy(x0, y)
            pdf.set_font(base_font, "B", 13)
            pdf.set_fill_color(255, 230, 100)
            pdf.cell(page_w, TITLE_H, doc_title_post_cont, border=1, ln=1, align="C", fill=True)
            y += TITLE_H

            y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w, charger_no)
            pdf.set_font(base_font, "", FONT_MAIN)
            
            pdf._table_start_y = y

    y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w, charger_no)
    pdf.set_font(base_font, "", FONT_MAIN)
    
    checks_list = list(checks)

    # ========== วนลูปวาดแต่ละ item ==========
    for idx, it in enumerate(checks_list):
        text = str(it.get("text", ""))
        result = it.get("result", "na")
        remark = str(it.get("remark", "") or "")
        has_subs = it.get("has_subs", False)
        sub_count = it.get("sub_count", 0)

        # --- คำนวณความสูง Item ---
        _, item_h = _split_lines(
            pdf, item_w - 2 * PADDING_X, text, LINE_H
        )

        # --- คำนวณความสูง Remark ---
        _, remark_h_raw = _split_lines(
            pdf, remark_w - 2 * PADDING_X, remark, LINE_H
        )
        remark_h = max(remark_h_raw + 2 * PADDING_Y, ROW_MIN_H)

        # --- หาเลขข้อจาก text ---
        match_row = re.match(r"^(\d+)\.", text.strip())
        row_num = int(match_row.group(1)) if match_row else 0

        # --- กำหนดขั้นต่ำเฉพาะข้อ ---
        if row_num == 16:
            remark_h = max(remark_h, LINE_H * 6)
        elif row_num == 10 and not has_subs:
            remark_h = max(remark_h, LINE_H * 3)

        # --- ความสูงสำหรับข้อที่มีข้อย่อย ---
        if has_subs:
            # คำนวณจากจำนวนบรรทัดจริงของ text (รวม voltage data)
            text_line_count = text.count('\n') + 1
            min_result_h = text_line_count * LINE_H + 2 * PADDING_Y
            remark_h = max(remark_h, min_result_h)

        # --- ความสูงจริงของ row ---
        row_h_eff = max(
            ROW_MIN_H,
            item_h + 2 * PADDING_Y,
            remark_h
        )

        _ensure_space(row_h_eff)

        # ---------- วาดตาราง ----------
        x = x_table

        # Item column
        _cell_text_in_box(
            pdf, x, y, item_w, row_h_eff, text,
            align="L", lh=LINE_H, 
            valign="top" if has_subs else "top"
        )
        x += item_w

        # Result column
        if has_subs and isinstance(result, list):
            _draw_result_cell(
                pdf, base_font, x, y, result_w, row_h_eff, 
                result,
                offset_lines=1,
                line_step=1
            )
        else:
            _draw_result_cell(
                pdf, base_font, x, y, result_w, row_h_eff, result
            )
        x += result_w

        # Remark column
        _cell_text_in_box(
            pdf, x, y, remark_w, row_h_eff, remark,
            align="L", lh=LINE_H, valign="top"
        )

        y += row_h_eff


    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_draw_color(0, 0, 0)

    # ========== Comment & Summary ==========
    comment_x = x_table
    comment_item_w = item_w
    comment_result_w = result_w
    comment_remark_w = remark_w

    comment_text = str(doc.get("summary", "") or "-")

    _, comment_h_calculated = _split_lines(pdf, comment_result_w + comment_remark_w - 2 * PADDING_X, comment_text, LINE_H)

    h_comment = max(LINE_H * 2, comment_h_calculated + LINE_H * 0.5)
    h_checklist = 7
    total_h = h_comment + h_checklist

    # สร้าง _ensure_space_comment สำหรับส่วน Comment เท่านั้น (ไม่วาด header)
    def _ensure_space_comment(height_needed: float):
        nonlocal y
        page_bottom = pdf.h - pdf.b_margin - SIG_H

        if y + height_needed > page_bottom:
            # **วาดเส้นกรอบเชื่อมต่อ**
            if pdf._table_x and pdf._table_width:
                pdf.line(pdf._table_x, y, pdf._table_x, page_bottom)
                table_right = pdf._table_x + pdf._table_width
                pdf.line(table_right, y, table_right, page_bottom)
            
            pdf.add_page()
            # header() จะถูกเรียกอัตโนมัติโดย add_page()
            y = pdf.get_y()

            pdf.set_xy(x0, y)
            pdf.set_font(base_font, "B", 13)
            pdf.set_fill_color(255, 230, 100)
            pdf.cell(page_w, TITLE_H, doc_title_post_cont, border=1, ln=1, align="C", fill=True)
            y += TITLE_H

            # ไม่วาด header Item, Result, Remark สำหรับส่วน Comment
            pdf.set_font(base_font, "", FONT_MAIN)

    _ensure_space_comment(total_h + 5)

    pdf.rect(comment_x, y, comment_item_w + comment_result_w + comment_remark_w, total_h)

    # ========== แถว Comment ==========
    pdf.set_font(base_font, "B", 11)
    pdf.set_xy(comment_x, y)
    pdf.cell(comment_item_w, h_comment, "Comment :", border=0, align="L")

    pdf.line(comment_x + comment_item_w, y, comment_x + comment_item_w, y + h_comment)

    pdf.set_font(base_font, "", 11)
    _cell_text_in_box(pdf, comment_x + comment_item_w, y, comment_result_w + comment_remark_w, h_comment, 
                    comment_text, align="L", lh=LINE_H, valign="middle")

    y += h_comment

    pdf.line(comment_x, y, comment_x + comment_item_w + comment_result_w + comment_remark_w, y)

    # ========== แถว Inspection Results ==========
    summary_check = str(doc.get("summaryCheck", "")).strip().upper() or "-"

    pdf.set_xy(comment_x, y)
    pdf.set_font(base_font, "B", 11)
    pdf.cell(comment_item_w, h_checklist, "Inspection Results :", border=0, align="L")

    pdf.line(comment_x + comment_item_w, y, comment_x + comment_item_w, y + h_checklist)

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

    y_last_row_end = y + h_checklist
    
    # วาดเส้นกรอบนอกซ้ายขวา
    page_bottom = pdf.h - pdf.b_margin - SIG_H
    pdf.line(comment_x, y_last_row_end, comment_x, page_bottom)
    pdf.line(comment_x + comment_item_w + comment_result_w + comment_remark_w, y_last_row_end, 
             comment_x + comment_item_w + comment_result_w + comment_remark_w, page_bottom)
    
    # วาดเส้นกรอบนอกซ้ายขวา
    page_bottom = pdf.h - pdf.b_margin - SIG_H
    pdf.line(comment_x, y_last_row_end, comment_x, page_bottom)
    pdf.line(comment_x + comment_item_w + comment_result_w + comment_remark_w, y_last_row_end, 
             comment_x + comment_item_w + comment_result_w + comment_remark_w, page_bottom)

    # ================================================================================
    # 📸 ส่วนที่ 3: PHOTOS POST
    # ================================================================================
    # ⭐ สำคัญ: ต้อง add_page() ก่อนเปลี่ยน _section
    # เพราะ add_page() จะเรียก footer() ของหน้าก่อนหน้า (Checklist POST สุดท้าย)
    pdf.add_page()  # footer() ของหน้า Checklist วาด signature ✅
    pdf._section = "photos"  # เปลี่ยนหลัง add_page() เพื่อให้หน้า Photos POST ไม่มี signature

    # header() จะถูกเรียกอัตโนมัติโดย add_page()
    y = pdf.get_y()

    # ========== วาดหัว Photos POST ==========
    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 13)
    pdf.set_fill_color(255, 230, 100)
    title_text = doc_title_photo_post if has_pre_photos else ("Photos" if lang == "en" else "รูปภาพ")
    pdf.cell(page_w, TITLE_H, title_text, border=1, ln=1, align="C", fill=True)
    y += TITLE_H
    
    # ========== วาด Job Info Block ==========
    y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, model, power, charger_no, sn, pm_date, label_station, label_pm_date)

    x_table = x0 + EDGE_ALIGN_FIX
    q_w = PHOTO_Q_W
    g_w = (page_w - 2 * EDGE_ALIGN_FIX) - q_w
    
    def _ensure_space_photo(height_needed: float):
        nonlocal y
        if y + height_needed > (pdf.h - pdf.b_margin):
            # ⭐ _section เป็น "photos" อยู่แล้ว (ถูกตั้งค่าหลังไปหน้า Photos แรก)
            # ดังนั้น footer() จะ return ไม่วาด signature โดยอัตโนมัติ
            pdf.add_page()

            # header() จะถูกเรียกอัตโนมัติโดย add_page()
            y = pdf.get_y()
            pdf.set_xy(x0, y)
            pdf.set_font(base_font, "B", 13)
            pdf.set_fill_color(255, 230, 100)
            pdf.cell(page_w, PHOTO_CONTINUE_H, doc_title_photo_cont, border=1, ln=1, align="C", fill=True)
            y += PHOTO_CONTINUE_H
            y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w, header_question, header_photos)
            pdf.set_font(base_font, "", FONT_MAIN)

    y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w, header_question, header_photos)
    pdf.set_font(base_font, "", FONT_MAIN)

    for it in checks:
        idx = int(it.get("idx") or 0)
        
        # ========== สร้าง question text พร้อมข้อย่อยและ remark ==========
        has_subs = it.get("has_subs", False)
        item_text = it.get("text", "")
        item_remark = it.get("remark", "")
        
        if has_subs:
            # แยกบรรทัดของ text (ไม่ต้องใช้ remark ใน POST)
            text_lines = item_text.split("\n")
            
            # สร้าง question text โดยไม่มี remark
            result_lines = []
            
            for i, line in enumerate(text_lines):
                line = line.strip()
                if not line:
                    continue
                
                if i == 0:
                    # หัวข้อหลัก
                    result_lines.append(line)
                else:
                    # ข้อย่อยและข้อมูลต่อเนื่อง
                    result_lines.append(f"   {line}")
            
            question_text = "\n".join(result_lines)
        else:
            # ไม่มีข้อย่อย - แสดงปกติ (ไม่มี remark)
            default_title = f"Item {idx}" if lang == "en" else f"รายการที่ {idx}"
            main_title = row_titles.get(f"r{idx}", default_title)
            question_text = f"{idx}) {main_title}"

        img_items = _get_photo_items_for_idx(doc, idx)
        # ไม่ข้ามถ้าไม่มีรูป - แสดงทุกข้อ

        # คำนวณความสูงจริงของแถว
        _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)
        total_images = len(img_items)
        num_rows = math.ceil(total_images / PHOTO_PER_LINE) if total_images > 0 else 0
        img_h = PHOTO_IMG_MAX_H
        images_total_h = (num_rows * img_h + (num_rows - 1) * PHOTO_GAP + 2 * PADDING_Y) if num_rows > 0 else 0
        actual_row_h = max(PHOTO_ROW_MIN_H, text_h + 2 * PADDING_Y, images_total_h + 4)
        
        _ensure_space_photo(actual_row_h)

        row_h_used = _draw_photos_row(pdf, base_font, x_table, y, q_w, g_w, 
                                     question_text, img_items)
        y += row_h_used

    return _output_pdf_bytes(pdf)

# Public API expected by pdf_routes: generate_pdf(data, lang) -> bytes
def generate_pdf(data: dict, lang: str = "th") -> bytes:
    return make_pm_report_html_pdf_bytes(data, lang=lang)