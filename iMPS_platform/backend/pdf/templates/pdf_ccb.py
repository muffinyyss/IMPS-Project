# backend/pdf/templates/pdf_ccb.py
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

# Indentation constants
MAIN_INDENT = " "       # 2 spaces สำหรับหัวข้อหลัก
SUB_INDENT = "    "      # 4 spaces สำหรับข้อย่อย (เดิมเป็น 8 spaces)


# -------------------- รายการหัวข้อ CCB --------------------
# Thai version
ROW_TITLES_TH = {
    "r1": "ตรวจสอบสภาพทั่วไป",
    "r2": "ตรวจสอบสภาพดักซีล, ซิลิโคนกันซึม",
    "r3": "ตรวจสอบระบบระบายอากาศ",
    "r4": "ตรวจสอบระบบแสงสว่าง",
    "r5": "ตรวจสอบเครื่องสำรองไฟฟ้า (UPS)",
    "r6": "ตรวจสอบระบบกล้องวงจรปิด (CCTV)",
    "r7": "ตรวจสอบเร้าเตอร์ (Router)",
    "r8": "ตรวจสอบ (Consumer Unit)",
    "r9": "ตรวจสอบแรงดันไฟฟ้า (Consumer Unit) - เมนเบรกเกอร์ (Main Breaker)",
    "r10": "ตรวจสอบแรงดันไฟฟ้า (Consumer Unit) - เบรกเกอร์วงจรย่อย",
    "r11": "ทำความสะอาด",
}

# English version
ROW_TITLES_EN = {
    "r1": "General condition inspection",
    "r2": "Seal and silicone waterproofing inspection",
    "r3": "Ventilation system inspection",
    "r4": "Lighting system inspection",
    "r5": "UPS backup system inspection",
    "r6": "CCTV system inspection",
    "r7": "Router inspection",
    "r8": "Consumer Unit inspection",
    "r9": "Voltage measurement - Main Breaker",
    "r10": "Voltage measurement - Sub-circuit Breakers",
    "r11": "Cleaning",
}

# Default to Thai
ROW_TITLES = ROW_TITLES_TH

# ชื่อข้อย่อย
# Thai version
SUB_ROW_TITLES_TH = {
    "r3_1": "ตรวจสอบการทำงานอุปกรณ์ตั้งอุณหภูมิ",
    "r3_2": "ตรวจสอบการทำงานพัดลมระบายอากาศ",
    
    "r4_1": "ตรวจสอบระบบควบคุมไฟส่องสว่างในสถานี",
    "r4_2": "ตรวจสอบระบบควบคุมไฟป้าย LOGO",
    
    "r5_1": "เครื่องสามารถทำงานได้ตามปกติ",
    "r5_2": "เครื่องสามารถสำรองไฟได้ (>5นาที)",
    
    "r6_1": "ตรวจสอบสภาพทั่วไปของกล้องวงจรปิด",
    "r6_2": "ตรวจสอบสภาพทั่วไปเครื่องบันทึก (NVR)",
    "r6_3": "ตรวจสอบสถานะการใช้งาน",
    "r6_4": "ตรวจสอบมุมกล้อง",
    
    "r7_1": "ตรวจสอบสภาพทั่วไป",
    "r7_2": "ตรวจสอบสถานะการทำงาน",
    
    "r8_1": "ตรวจสอบสภาพทั่วไป",
    "r8_2": "ตรวจสอบจุดขันแน่น",
}

# English version
SUB_ROW_TITLES_EN = {
    "r3_1": "Thermostat operation check",
    "r3_2": "Ventilation fan operation check",
    
    "r4_1": "Station lighting operation check",
    "r4_2": "Light sign / Logo operation check",
    
    "r5_1": "Device operates normally",
    "r5_2": "Device can backup power (>5 min)",
    
    "r6_1": "General condition of CCTV cameras",
    "r6_2": "General condition of NVR",
    "r6_3": "Usage status check",
    "r6_4": "Camera angle check",
    
    "r7_1": "General condition check",
    "r7_2": "Operation status check",
    
    "r8_1": "General condition check",
    "r8_2": "Tightening points check",
}

# Default to Thai
SUB_ROW_TITLES = SUB_ROW_TITLES_TH


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

def _r_idx(k: str) -> int:
    m = re.match(r"r(\d+)$", k.lower())
    return int(m.group(1)) if m else 999


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
        # เก็บ leading spaces ไว้
        leading_spaces = ""
        stripped = paragraph.lstrip(" ")
        if len(paragraph) > len(stripped):
            leading_spaces = paragraph[:len(paragraph) - len(stripped)]

        # ตรวจสอบว่ามี hanging indent pattern หรือไม่ (เช่น "หมายเหตุ: " หรือ "Remark: ")
        # ถ้ามี ให้ใช้ hanging indent สำหรับบรรทัดถัดไป
        hanging_indent = ""
        match_label = re.match(r"^(.*?):\s+", stripped)
        if match_label:
            # ให้บรรทัดถัดไปเริ่มที่ตำแหน่งเดียวกับ leading spaces เท่านั้น
            hanging_indent = leading_spaces

        words = stripped.split(" ")
        lines, cur = [], ""
        first_line = True

        for wd in words:
            candidate = wd if not cur else (cur + " " + wd)
            # บรรทัดแรกใช้ leading_spaces, บรรทัดถัดไปใช้ hanging_indent
            current_indent = leading_spaces if first_line else hanging_indent
            if pdf.get_string_width(current_indent + candidate) <= inner_w:
                cur = candidate
            else:
                if cur:
                    # เพิ่ม indent ตามบรรทัด
                    lines.append(current_indent + cur)
                    first_line = False
                current_indent = leading_spaces if first_line else hanging_indent
                if pdf.get_string_width(current_indent + wd) <= inner_w:
                    cur = wd
                else:
                    buf = wd
                    while buf:
                        k = 1
                        current_indent = leading_spaces if first_line else hanging_indent
                        while (
                            k <= len(buf) and pdf.get_string_width(current_indent + buf[:k]) <= inner_w
                        ):
                            k += 1
                        lines.append(current_indent + buf[: k - 1])
                        first_line = False
                        buf = buf[k - 1 :]
                    cur = ""
        if cur:
            current_indent = leading_spaces if first_line else hanging_indent
            lines.append(current_indent + cur)
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
        # print("[DEBUG] 📂 ลองหาใน backend/uploads...")
        
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
                # print(f"[DEBUG] ✅ เจอรูปแล้ว! {local_path}")
                return local_path.as_posix(), _guess_img_type_from_ext(local_path.as_posix())
            else:
                print(f"[DEBUG] ❌ ไม่เจอรูปที่ {local_path}")

    # print(f"[DEBUG] ❌ ไม่เจอรูปจากทุกวิธี!")
    # print(f"{'='*80}\n")
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
        _log(f"[IMG] auto-rotate error: {e}")
        return None, None
    

# -------------------- Photo data helpers --------------------
def _get_photo_items_for_idx(doc: dict, idx: int) -> List[dict]:
    # รวมรูปของข้อหลักและข้อย่อยทั้งหมด เช่น g4, g4_1, r4_1, r4_2
    photos = doc.get("photos") or {}
    # print(f"[DEBUG] _get_photo_items_for_idx(idx={idx})")
    # print(f"[DEBUG] photos keys: {list(photos.keys())}")
    items_in = []

    prefix_g = f"g{idx}"
    prefix_r = f"r{idx}_"
    # print(f"[DEBUG] Looking for keys: {prefix_g}, {prefix_g}_*, {prefix_r}*")

    for k, items in photos.items():
        # รองรับทั้ง g{idx} และ g{idx}_* และ r{idx}_* (เช่น r4_1, r6_2)
        if k == prefix_g or k.startswith(prefix_g + "_") or k.startswith(prefix_r):
            if isinstance(items, list):
                # print(f"[DEBUG] Found key '{k}' with {len(items)} items")
                items_in.extend(items)

    out: List[dict] = []

    def _normalize(s: str) -> str:
        return (s or "").replace("\\", "/").strip()

    backend_root = Path(__file__).resolve().parents[2]
    uploads_root = backend_root / "uploads"

    for p in items_in:
        if not isinstance(p, dict):
            continue
        raw = _normalize(p.get("url", ""))
        if not raw:
            continue

        p_abs = Path(raw)
        if p_abs.is_absolute():
            if p_abs.is_dir():
                files = []
                for ext in _IMAGE_EXTS:
                    files += sorted(p_abs.glob(f"*{ext}"))
                for f in files[: PHOTO_MAX_PER_ROW - len(out)]:
                    if f.is_file():
                        out.append({"url": f.as_posix()})
            elif p_abs.is_file():
                out.append({"url": p_abs.as_posix()})
            if len(out) >= PHOTO_MAX_PER_ROW:
                break
            continue

        # relative under uploads
        clean = raw.lstrip("/")
        if clean.startswith("uploads/"):
            clean = clean[8:]
        local = uploads_root / clean
        if local.exists():
            if local.is_dir():
                files = []
                for ext in _IMAGE_EXTS:
                    files += sorted(local.glob(f"*{ext}"))
                for f in files[: PHOTO_MAX_PER_ROW - len(out)]:
                    if f.is_file():
                        out.append({"url": f.as_posix()})
            elif local.is_file():
                out.append({"url": local.as_posix()})
        else:
            # ปล่อยให้ loader ไปลอง http/base_url เอง
            out.append({"url": raw})

        if len(out) >= PHOTO_MAX_PER_ROW:
            break

    # print(f"[DEBUG] _get_photo_items_for_idx(idx={idx}) returning {len(out)} items")
    # print(f"[DEBUG] Items: {[item.get('url', 'NO_URL')[:80] for item in out]}")
    return out[:PHOTO_MAX_PER_ROW]

def _get_photo_items_for_idx_pre(doc: dict, idx: int) -> List[dict]:
    # รวมรูปของข้อหลักและข้อย่อยทั้งหมด เช่น g4, g4_1, r4_1, r4_2
    photos_pre = doc.get("photos_pre") or {}
    items_in = []

    prefix_g = f"g{idx}"
    prefix_r = f"r{idx}_"

    for k, items in photos_pre.items():
        # รองรับทั้ง g{idx} และ g{idx}_* และ r{idx}_* (เช่น r4_1, r6_2)
        if k == prefix_g or k.startswith(prefix_g + "_") or k.startswith(prefix_r):
            if isinstance(items, list):
                items_in.extend(items)

    out: List[dict] = []

    def _normalize(s: str) -> str:
        return (s or "").replace("\\", "/").strip()

    backend_root = Path(__file__).resolve().parents[2]
    uploads_root = backend_root / "uploads"

    for p in items_in:
        if not isinstance(p, dict):
            continue
        raw = _normalize(p.get("url", ""))
        if not raw:
            continue

        p_abs = Path(raw)
        if p_abs.is_absolute():
            if p_abs.is_dir():
                files = []
                for ext in _IMAGE_EXTS:
                    files += sorted(p_abs.glob(f"*{ext}"))
                for f in files[: PHOTO_MAX_PER_ROW - len(out)]:
                    if f.is_file():
                        out.append({"url": f.as_posix()})
            elif p_abs.is_file():
                out.append({"url": p_abs.as_posix()})
            if len(out) >= PHOTO_MAX_PER_ROW:
                break
            continue

        # relative under uploads
        clean = raw.lstrip("/")
        if clean.startswith("uploads/"):
            clean = clean[8:]
        local = uploads_root / clean
        if local.exists():
            if local.is_dir():
                files = []
                for ext in _IMAGE_EXTS:
                    files += sorted(local.glob(f"*{ext}"))
                for f in files[: PHOTO_MAX_PER_ROW - len(out)]:
                    if f.is_file():
                        out.append({"url": f.as_posix()})
            elif local.is_file():
                out.append({"url": local.as_posix()})
        else:
            # ปล่อยให้ loader ไปลอง http/base_url เอง
            out.append({"url": raw})

        if len(out) >= PHOTO_MAX_PER_ROW:
            break

    return out[:PHOTO_MAX_PER_ROW]


# -------------------- Measurement / Data formatting --------------------
def _format_voltage_measurement(measures: dict, key: str, sub_index: Optional[int] = None) -> str:
    ms = (measures or {}).get(key) or {}
    if not ms:
        return ""

    # ถ้ามี sub_index ให้ดึงข้อมูลจาก index นั้น
    if sub_index is not None and str(sub_index) in ms:
        ms = ms[str(sub_index)]
    
    if not ms:
        return ""

    # normalize key ภายใน
    norm_ms = {}
    for k, v in ms.items():
        nk = str(k).strip().replace("–", "-").replace("-", "-").replace(" ", "")
        norm_ms[nk.upper()] = v

    # ลำดับมาตรฐาน 10 คู่
    order_full = [
        "L1-N", "L2-N", "L3-N",
        "L1-G", "L2-G", "L3-G",
        "L1-L2", "L2-L3", "L3-L1",
        "N-G",
    ]

    # ลำดับย่อ (3 คู่)
    order_short = ["L1-N", "L1-G", "N-G"]

    order = order_short if len(norm_ms) <= 3 else order_full

    def fmt(k: str) -> str:
        d = norm_ms.get(k.upper()) or {}
        val = str(d.get("value") or "").strip()
        unit = str(d.get("unit") or "").strip()
        if not val or val.lower() == "none":
            val = "-"
        return f"{k} = {val}{unit}"

    lines = [fmt(k) for k in order]

    # ถ้ายังไม่มีค่า N-G ให้เพิ่ม
    if not any("N-G" in k for k in norm_ms.keys()):
        lines.append("N-G = -")
    return "\n".join(lines)


# -------------------- Result / Row processing --------------------
def _rows_to_checks(rows: dict, measures: Optional[dict] = None, row_titles: dict = None, sub_row_titles: dict = None) -> List[dict]:
    if not isinstance(rows, dict):
        return []

    if row_titles is None:
        row_titles = ROW_TITLES
    if sub_row_titles is None:
        sub_row_titles = SUB_ROW_TITLES

    rows = rows or {}
    measures = measures or {}
    items: List[dict] = []

    for main_key, main_title in row_titles.items():
        m = re.match(r"^r(\d+)$", main_key)
        if not m:
            continue
        idx = int(m.group(1))

        subs: List[Tuple[int, str, str]] = []

        # ข้อ 10 เป็น dynamic - ดึงจาก rows ที่มีอยู่จริง
        if idx == 10:
            for key in rows.keys():
                m_sub = re.match(r"^r10_sub(\d+)$", key)
                if m_sub:
                    sub_idx = int(m_sub.group(1))
                    stitle = f"เบรกเกอร์วงจรย่อยที่ {sub_idx}" if sub_row_titles == SUB_ROW_TITLES_TH else f"Sub-circuit Breaker {sub_idx}"
                    subs.append((sub_idx, key, stitle))
            
            subs.sort(key=lambda x: x[0])
            subs = subs[:6]
        else:
            for k, stitle in sub_row_titles.items():
                m_ = re.match(rf"^r{idx}_(\d+)$", k)
                if m_:
                    subs.append((int(m_.group(1)), k, stitle))
            subs.sort(key=lambda x: x[0])

        # ---------- ข้อความในคอลัมน์ Item ----------
        lines: List[str] = [f"{MAIN_INDENT}{idx}) {main_title}"]

        # ข้อ 9: แสดง voltage data แบบย่อใน Item (แนวนอน)
        if idx == 9:
            measure_key = f"m{idx}"
            voltage_text = _format_voltage_measurement(measures, measure_key)
            if voltage_text:
                voltage_lines = voltage_text.strip().split('\n')
                voltage_horizontal = ', '.join(voltage_lines[:3])
                lines.append(f"{SUB_INDENT}{voltage_horizontal}")

        for sub_index, sub_key, stitle in subs:
            lines.append(f"{SUB_INDENT}{idx}.{sub_index}) {stitle}")

            # ข้อ 10 ให้เพิ่ม voltage data ต่อท้ายแต่ละข้อย่อย
            if idx == 10:
                voltage_key = f"m10_{sub_index}"
                voltage_data = measures.get(voltage_key)
                if voltage_data:
                    v_parts = []
                    for k in ["L-N", "L-G", "N-G"]:
                        d = voltage_data.get(k) or {}
                        val = str(d.get("value") or "").strip()
                        unit = str(d.get("unit") or "").strip()
                        if not val or val.lower() == "none":
                            val = "-"
                        v_parts.append(f"{k} = {val}{unit}")
                    lines.append(f"{SUB_INDENT}{', '.join(v_parts)}")

        text = "\n".join(lines)

        # ---------- ผลลัพธ์ในคอลัมน์ Result ----------
        result_lines: List[str] = []
        remark_lines: List[str] = []
        
        if subs:
            for order_num, sub_key, stitle in subs:
                data_ = rows.get(sub_key) or {}
                raw_res = _extract_row_result(data_)
                rmk = (data_.get("remark") or "").strip()

                result_lines.append(_norm_result(raw_res))
                remark_lines.append(rmk)

            result_offset = 1
            result_step = 1

            if idx == 10:
                result_step = 2
        else:
            actual_key = main_key
            if idx == 9:
                actual_key = "r9_main"
            elif idx == 10:
                continue
            
            data_main = rows.get(actual_key) or {}
            raw_res = _extract_row_result(data_main)
            result_lines.append(_norm_result(raw_res))
            remark_lines.append((data_main.get("remark") or "").strip())
            result_offset = 0
            result_step = 1

        # ---------- Remark (แก้ไขให้ remark ตรงกับแถว) ----------
        remark_parts: List[str] = []

        # ข้อ 4-8: แสดง voltage measurements
        if main_key.lower() in ["r4", "r5", "r6", "r7", "r8"]:
            measure_key = f"m{idx}"
            voltage_text = _format_voltage_measurement(measures, measure_key)
            if voltage_text:
                remark_parts.append(voltage_text)

        # main remark (แถวแรก - ตรงกับหัวข้อหลัก)
        if idx == 9:
            data_main = rows.get("r9_main") or {}
            main_rmk = (data_main.get("remark") or "").strip()
            if main_rmk and main_rmk != "-":
                remark_parts.append(main_rmk)
        elif idx != 10:
            data_main = rows.get(main_key) or {}
            main_rmk = (data_main.get("remark") or "").strip()
            if main_rmk and main_rmk != "-":
                remark_parts.append(main_rmk)

        # sub remark - ⭐ สร้าง remark ที่ตรงกับแต่ละแถวของข้อย่อย
        if subs:
            # สร้าง list ของ remark สำหรับแต่ละบรรทัด
            # บรรทัดแรก = หัวข้อหลัก (ใช้ main_rmk ที่เพิ่มไปแล้ว)
            # บรรทัดถัดไป = ข้อย่อยแต่ละข้อ
            
            sub_remarks = []
            
            for i, (order_num, sub_key, stitle) in enumerate(subs):
                rmk = remark_lines[i] if i < len(remark_lines) else ""
                
                # แสดง remark ของข้อย่อยนี้ในบรรทัดเดียวกับข้อย่อย
                if rmk and rmk != "-":
                    sub_remarks.append(f"{idx}.{order_num}) {rmk}")
                else:
                    sub_remarks.append("")  # บรรทัดว่างถ้าไม่มี remark
                
                # ถ้าเป็นข้อ 10 ที่มี voltage data ให้เพิ่มบรรทัดว่าง
                if idx == 10:
                    sub_remarks.append("")
            
            if sub_remarks:
                # เพิ่มบรรทัดว่างหนึ่งบรรทัด (สำหรับหัวข้อหลัก) ถ้ายังไม่มี main remark
                if not (idx == 9 or (idx != 10 and main_rmk and main_rmk != "-")):
                    remark_parts.append("")
                
                remark_parts.extend(sub_remarks)

        remark = "\n".join(remark_parts)

        items.append(
            {
                "idx": idx,
                "text": text,
                "results": result_lines,
                "remark": remark,
                "result_offset": result_offset,
                "result_step": result_step,
            }
        )

    return items
# def _rows_to_checks(rows: dict, measures: Optional[dict] = None, row_titles: dict = None, sub_row_titles: dict = None) -> List[dict]:
#     if not isinstance(rows, dict):
#         return []

#     # ใช้ค่า default ถ้าไม่ได้ส่งมา
#     if row_titles is None:
#         row_titles = ROW_TITLES
#     if sub_row_titles is None:
#         sub_row_titles = SUB_ROW_TITLES

#     rows = rows or {}
#     measures = measures or {}
#     items: List[dict] = []

#     for main_key, main_title in row_titles.items():
#         m = re.match(r"^r(\d+)$", main_key)
#         if not m:
#             continue
#         idx = int(m.group(1))

#         # รวม sub ของข้อ idx
#         subs: List[Tuple[int, str, str]] = []

#         # ข้อ 10 เป็น dynamic - ดึงจาก rows ที่มีอยู่จริง
#         if idx == 10:
#             for key in rows.keys():
#                 m_ = re.match(rf"^r{idx}_(\d+)$", key)
#                 if m_:
#                     sub_idx = int(m_.group(1))
#                     stitle = f"เบรกเกอร์วงจรย่อยที่ {sub_idx}" if sub_row_titles == SUB_ROW_TITLES_TH else f"Sub-circuit Breaker {sub_idx}"
#                     subs.append((sub_idx, key, stitle))
#             subs.sort(key=lambda x: x[0])
#             # จำกัด max 6 ข้อย่อย
#             subs = subs[:6]
#         else:
#             # ข้ออื่นๆ ดึงจาก sub_row_titles ตามปกติ
#             for k, stitle in sub_row_titles.items():
#                 m_ = re.match(rf"^r{idx}_(\d+)$", k)
#                 if m_:
#                     subs.append((int(m_.group(1)), k, stitle))
#             subs.sort(key=lambda x: x[0])

#         # ---------- ข้อความในคอลัมน์ Item ----------
#         # lines: List[str] = [f"{MAIN_INDENT}{idx}) {main_title}"]

#         # for sub_index, sub_key, stitle in subs:
#         #     lines.append(f"{SUB_INDENT}{idx}.{sub_index}) {stitle}")

#         #     # ข้อ 10 ให้เพิ่ม voltage data ต่อท้ายแต่ละข้อย่อย
#         #     if idx == 10:
#         #         measure_key = f"m{idx}"
#         #         voltage_text = _format_voltage_measurement(measures, measure_key, sub_index - 1)
#         #         if voltage_text:
#         #             lines.append(f"{SUB_INDENT}{voltage_text}")
#         # ---------- ข้อความในคอลัมน์ Item ----------
#         lines: List[str] = [f"{MAIN_INDENT}{idx}) {main_title}"]

#         # ข้อ 9: แสดง voltage data แบบย่อใน Item (แนวนอน)
#         if idx == 9:
#             measure_key = f"m{idx}"
#             voltage_text = _format_voltage_measurement(measures, measure_key)
#             if voltage_text:
#                 # แปลงจากแนวตั้งเป็นแนวนอน
#                 voltage_lines = voltage_text.strip().split('\n')
#                 voltage_horizontal = ', '.join(voltage_lines[:3])  # แสดงแค่ 3 คู่แรก (L1-N, L1-G, N-G)
#                 lines.append(f"{SUB_INDENT}{voltage_horizontal}")

#         for sub_index, sub_key, stitle in subs:
#             lines.append(f"{SUB_INDENT}{idx}.{sub_index}) {stitle}")

#             # ข้อ 10 ให้เพิ่ม voltage data ต่อท้ายแต่ละข้อย่อย
#             if idx == 10:
#                 measure_key = f"m{idx}"
#                 voltage_text = _format_voltage_measurement(measures, measure_key, sub_index - 1)
#                 if voltage_text:
#                     lines.append(f"{SUB_INDENT}{voltage_text}")


#         text = "\n".join(lines)


#         # ---------- ผลลัพธ์ในคอลัมน์ Result ----------
#         result_lines: List[str] = []
#         remark_lines: List[str] = []
        
#         if subs:
#             # ใช้ผลของหัวข้อย่อยทีละบรรทัด
#             for order_num, sub_key, stitle in subs:
#                 # ใช้ alt_key เป็นหลักเสมอ
#                 alt_key = f"r{idx}_{order_num}"
#                 data_ = rows.get(alt_key) or rows.get(sub_key) or {}

#                 raw_res = _extract_row_result(data_)
#                 rmk = (data_.get("remark") or "").strip()

#                 result_lines.append(_norm_result(raw_res))
#                 remark_lines.append(rmk)

#             # เริ่มต้นค่า default
#             result_offset = 1      # ข้ามบรรทัดหัวข้อหลัก
#             result_step = 1        # ปกติ 1 row ของ Result ต่อ 1 บรรทัดข้อความ

#             # ข้อ 10 มี voltage data หลายบรรทัด
#             if idx == 10:
#                 # นับจำนวนบรรทัด voltage data (ปกติจะมี 3 หรือ 10 บรรทัด)
#                 measure_key = f"m{idx}"
#                 test_voltage = _format_voltage_measurement(measures, measure_key, 0)
#                 if test_voltage:
#                     voltage_lines = test_voltage.count('\n') + 1
#                     result_step = 1 + voltage_lines  # 1 สำหรับชื่อข้อย่อย + จำนวนบรรทัด voltage
#         else:
#             # ไม่มี sub → ใช้ pf ของหัวข้อหลัก rN ตามเดิม
#             data_main = rows.get(main_key) or {}
#             raw_res = _extract_row_result(data_main)
#             result_lines.append(_norm_result(raw_res))
#             remark_lines.append((data_main.get("remark") or "").strip())
#             result_offset = 0
#             result_step = 1


#         # ---------- Remark (รวม voltage + remark แยกบรรทัด) ----------
#         remark_parts: List[str] = []

#         # ข้อ 4–9 : พ่วงข้อมูลวัดแรงดันไฟฟ้าแบบเดิม (m4..m9)
#         if main_key.lower() in ["r4", "r5", "r6", "r7", "r8"]:
#             measure_key = f"m{idx}"
#             voltage_text = _format_voltage_measurement(measures, measure_key)
#             if voltage_text:
#                 remark_parts.append(voltage_text)

#         # ---------- main remark ----------
#         data_main = rows.get(main_key) or {}
#         main_rmk = (data_main.get("remark") or "").strip()
#         if main_rmk and main_rmk != "-":
#             remark_parts.append(main_rmk)

#         # ---------- sub remark ----------
#         if subs and result_offset == 1:
#             formatted_remarks = [""]  # บรรทัดแรกว่าง (ตรงกับหัวข้อหลัก)

#             for i, (order_num, sub_key, stitle) in enumerate(subs):
#                 rmk = remark_lines[i] if i < len(remark_lines) else ""

#                 # แสดงเลขข้อย่อยเฉพาะเมื่อมี remark
#                 if rmk and rmk != "-":
#                     formatted_remarks.append(f"{idx}.{order_num}) {rmk}")

#                 # ถ้าเป็นข้อ 10 ที่มี voltage data ให้เพิ่มบรรทัดว่างตามจำนวนบรรทัด voltage
#                 if idx == 10:
#                     measure_key = f"m{idx}"
#                     voltage_text = _format_voltage_measurement(measures, measure_key, order_num - 1)
#                     if voltage_text:
#                         voltage_line_count = voltage_text.count('\n') + 1
#                         for _ in range(voltage_line_count):
#                             formatted_remarks.append("")

#             remark_text = "\n".join(formatted_remarks)
#             if remark_text.strip():
#                 remark_parts.append(remark_text)

#         # รวม remark
#         remark = "\n".join(p for p in remark_parts if p.strip())


#         items.append(
#             {
#                 "idx": idx,
#                 "text": text,
#                 "results": result_lines,
#                 "remark": remark,
#                 "result_offset": result_offset,
#                 "result_step": result_step,
#                 "remark": remark,
                
#             }
#         )

#     return items


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
    header_item: str = "Item",
    header_result: str = "Result",
    header_remark: str = "Remark",
):
    header_h = 5.5
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(item_w, header_h, header_item, border=1, align="C")
    pdf.cell(result_w, header_h, header_result, border=1, align="C")
    pdf.cell(remark_w, header_h, header_remark, border=1, ln=1, align="C")
    y += header_h

    return y

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
    """
    วาดช่องลายเซ็น

    Args:
        y_bottom: ถ้ากำหนด ให้วาดโดยติดด้านล่านของค่านี้ (จัดตำแหน่งให้เต็มหน้า)
    """
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
        pdf.cell(w, row_h_date, f"{label_date}  {pm_date_th}", align="C")
        x_pos += w
    y += row_h_date

    return y


# -------------------------------------
# 🔸 ค่าคงที่เกี่ยวกับตารางรูปภาพ
# -------------------------------------
PHOTO_MAX_PER_ROW = 20
PHOTO_PER_LINE    = 4    
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
    header_question: str = "Item / Question",
    header_photos: str = "Reference Photos",
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
    offset_lines: int = 0,   # บรรทัดที่ต้องข้ามก่อนเริ่มวาด
    line_step: int = 1,      # จำนวนบรรทัดข้อความต่อ 1 row ของ Result
):
   
    pdf.rect(x, y, w, h)

    # ให้ result เป็น list เสมอ
    if isinstance(result, (list, tuple)):
        results = list(result)
    else:
        results = [result]

    # normalize ผลแต่ละบรรทัด
    results = [_norm_result(r) for r in results]
    n_lines = max(1, len(results))

    col_w = w / 3.0
    labels = ["pass", "fail", "na"]
    label_text = {"pass": "Pass", "fail": "Fail", "na": "N/A"}

    pdf.set_font(base_font, "", FONT_SMALL)

    # วาดเส้นแบ่งคอลัมน์แนวตั้งเต็ม cell
    for i in range(1, 3):
        sx = x + i * col_w
        pdf.line(sx, y, sx, y + h)

    # base_y = จุดเริ่มต้นของบรรทัดแรก (ชิดบน + ข้ามหัวข้อหลัก offset_lines บรรทัด)
    base_y = y + PADDING_Y + offset_lines * LINE_H

    for row_idx, res in enumerate(results):
        line_y = base_y + row_idx * line_step * LINE_H

        # ถ้าลงล่างเกิน cell แล้วให้หยุด
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

def _extract_row_result(row: dict) -> str:
    if not isinstance(row, dict):
        return ""

    # 1) กรณีเก็บเป็น string field เดียว
    for key in ("pf", "result", "Result", "status", "Status", "value", "check", "checked"):
        if key in row and row[key] not in (None, ""):
            return row[key]

    # 2) กรณีเก็บเป็น flag แยกกัน เช่น pass/fail/na เป็น boolean
    def _is_true(v):
        if isinstance(v, bool):
            return v
        if isinstance(v, (int, float)):
            return v != 0
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes", "y", "on")
        return False

    # ถ้าใช้ field แบบ boolean แยกช่อง
    if _is_true(row.get("pass")) or _is_true(row.get("is_pass")) or _is_true(row.get("isPass")):
        return "pass"
    if _is_true(row.get("fail")) or _is_true(row.get("is_fail")) or _is_true(row.get("isFail")):
        return "fail"
    if _is_true(row.get("na")) or _is_true(row.get("is_na")) or _is_true(row.get("isNa")):
        return "na"

    return ""

# def _get_uploads_root() -> Path:
#     """เลือก root ของ uploads: ENV(PHOTOS_UPLOADS_DIR) > <backend>/uploads"""
#     override = os.getenv("PHOTOS_UPLOADS_DIR")
#     if override:
#         p = Path(override)
#         if p.exists():
#             return p
#     backend_root = Path(__file__).resolve().parents[2]  # .../backend
#     return backend_root / "uploads"


# def _split_upload_url_parts(url_path: str):
    
#     clean = url_path.lstrip("/").replace("\\", "/")
#     parts = clean.split("/")
#     if len(parts) >= 5 and parts[0] == "uploads":
#         type_part = parts[1]
#         station = parts[2]
#         doc_id = parts[3]
#         group = parts[4]
#         filename = parts[5] if len(parts) >= 6 else ""
#         return type_part, station, doc_id, group, filename
#     return None

# IMAGE_EXTS = [
#     ".jpg", ".jpeg", ".png", ".jfif",
#     ".webp", ".bmp", ".gif", ".tiff", ".tif"
# ]

# def _pick_image_from_path(p: Path) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
#     # 1) ถ้าเป็นไฟล์อยู่แล้ว
#     if p.is_file():
#         return p.as_posix(), _guess_img_type_from_ext(p.as_posix())

#     # 2) ถ้าไม่มีนามสกุล ลองเติม
#     if not p.suffix and p.parent.exists():
#         for ext in _IMAGE_EXTS:
#             cand = p.with_suffix(ext)
#             if cand.exists() and cand.is_file():
#                 return cand.as_posix(), _guess_img_type_from_ext(cand.as_posix())

#     # 3) ถ้าเป็นโฟลเดอร์: เลือกไฟล์รูปแรก
#     if p.is_dir():
#         for ext in _IMAGE_EXTS:
#             files = sorted(p.glob(f"*{ext}"))
#             for f in files:
#                 if f.is_file():
#                     return f.as_posix(), _guess_img_type_from_ext(f.as_posix())

#     return None, None


# -------------------- data helpers --------------------
def _build_photo_rows_grouped(row_titles: dict, measures_data: Optional[dict] = None, rows_data: Optional[dict] = None, lang: str = "th") -> List[dict]:
    """สร้าง photo rows พร้อมแสดง voltage measurements

    measures_data: ข้อมูลการวัด (measures_pre สำหรับ Pre-PM หรือ measures สำหรับ Post-PM)
    rows_data: ข้อมูล rows สำหรับดึงข้อย่อย dynamic
    lang: ภาษา (th หรือ en)
    """
    grouped: List[dict] = []
    measures_data = measures_data or {}
    rows_data = rows_data or {}
    active_measures = measures_data

    # เดินตามลำดับการประกาศใน ROW_TITLES เพื่อคงลำดับหัวข้อ
    main_keys: List[Tuple[int, str, str]] = []  # (idx, key, title)
    for k, title in row_titles.items():
        m = re.fullmatch(r"r(\d+)", k)
        if m:
            main_keys.append((int(m.group(1)), k, title))

    for idx, main_key, main_title in main_keys:
        lines = [f"  {idx}) {main_title}"]  # 2 spaces สำหรับหัวข้อหลัก

        # รวม sub ทั้งหมดของหัวข้อนี้
        subs: List[Tuple[int, str]] = []

        # ข้อ 10 เป็น dynamic - ดึงจาก rows ที่มีอยู่จริง
        if idx == 10:
            for key in rows_data.keys():
                m = re.fullmatch(rf"r{idx}_(\d+)", key)
                if m:
                    sub_idx = int(m.group(1))
                    stitle = f"เบรกเกอร์วงจรย่อยที่ {sub_idx}" if lang == "th" else f"Sub-circuit Breaker {sub_idx}"
                    subs.append((sub_idx, stitle))
            subs.sort(key=lambda x: x[0])
            # จำกัด max 6 ข้อย่อย
            subs = subs[:6]
        else:
            # ข้ออื่นๆ ดึงจาก row_titles ตามปกติ
            for k, stitle in row_titles.items():
                m = re.fullmatch(rf"r{idx}_(\d+)", k)
                if m:
                    subs.append((int(m.group(1)), stitle))
            subs.sort(key=lambda x: x[0])

        for sub_order, stitle in subs:
            clean_stitle = re.sub(r"^\s*\.\s*", "", str(stitle))
            lines.append(f"        {idx}.{sub_order}) {clean_stitle}")  # 8 spaces สำหรับข้อย่อย

        grouped.append({"idx": idx, "text": "\n".join(lines), "measures": active_measures})

    return grouped


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
                except Exception as e:
                    _log(f"[IMG] place error: {e}")
                    pdf.set_xy(cx, cy + (PHOTO_IMG_MAX_H - LINE_H) / 2.0)
                    pdf.cell(slot_w, LINE_H, "-", border=0, align="C")
            else:
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
    pm_date: str,
    label_station: str = "Station",
    label_pm_date: str = "PM Date",
) -> float:
    row_h = 6.5
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

    _item(x, y, label_station, station_name)
    _item(x + col_w, y, label_pm_date, pm_date)

    return y + box_h


# -------------------- PDF output helper --------------------
def _output_pdf_bytes(pdf: FPDF) -> bytes:
    data = pdf.output(dest="S")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    return data.encode("latin1")


# -------------------- PDF base class --------------------
class HTML2PDF(FPDF, HTMLMixin):
    pass


class ReportPDF(HTML2PDF):
    def __init__(self, *args, issue_id="-", **kwargs):
        super().__init__(*args, **kwargs)
        self.issue_id = issue_id
        self._section = "checklist"  # "checklist" = วาด signature, "photos" = ไม่วาด
        self._pm_date_th = ""
        self._base_font_name = "Arial"
        # Language labels (defaults)
        self._label_page = "Page"
        self._addr_line1 = "Electricity Generating Authority of Thailand (EGAT)"
        self._addr_line2 = "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand"
        self._addr_line3 = "Call Center Tel. 02-114-3350"
        self._label_performed = "Performed by"
        self._label_approved = "Approved by"
        self._label_witnessed = "Witnessed by"
        self._label_date = "Date :"

    def header(self):
        # ทุกหน้าเรียกอัตโนมัติ
        _draw_header(self, self._base_font_name, issue_id=self.issue_id,
                    label_page=self._label_page, addr_line1=self._addr_line1,
                    addr_line2=self._addr_line2, addr_line3=self._addr_line3)
        # self.ln(10)

    def footer(self):
        # ⭐ Photos section ไม่ต้องมีลายเซ็น
        # _section == "photos" จะถูกตั้งค่าหลังจาก add_page() ไปหน้า Photos แรก
        # ดังนั้นหน้า Photos ทุกหน้าจะไม่มี signature
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
            label_performed=self._label_performed,
            label_approved=self._label_approved,
            label_witnessed=self._label_witnessed,
            label_date=self._label_date,
        )

def make_pm_report_html_pdf_bytes(doc: dict, lang: str = "th") -> bytes:
    # data
    job = doc.get("job", {}) or {}
    station_name = job.get("station_name", "-")
    pm_date = _fmt_date_thai_like_sample(doc.get("pm_date", job.get("date", "-")))
    pm_date_th = _fmt_date_thai_full(doc.get("pm_date", job.get("date", "-")))
    issue_id = str(doc.get("issue_id", "-"))

    # ========== เลือก row titles ตามภาษา ==========
    if lang == "en":
        row_titles = ROW_TITLES_EN
        sub_row_titles = SUB_ROW_TITLES_EN
    else:
        row_titles = ROW_TITLES_TH
        sub_row_titles = SUB_ROW_TITLES_TH

    checks = _rows_to_checks(doc.get("rows") or {}, doc.get("measures") or {}, row_titles, sub_row_titles)

    # ========== เลือกข้อความตามภาษา ==========
    if lang == "en":
        # English titles
        doc_title_post = "Preventive Maintenance Checklist - Circuit Breaker (POST)"
        doc_title_post_cont = "Preventive Maintenance Checklist - Circuit Breaker (POST Continued)"
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
        label_performed = "Performed by"
        label_approved = "Approved by"
        label_witnessed = "Witnessed by"
        label_date = "Date :"

        # Job info labels
        label_station = "Station"
        label_pm_date = "PM Date"

        label_page = "Page"
        addr_line1 = "Electricity Generating Authority of Thailand (EGAT)"
        addr_line2 = "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand"
        addr_line3 = "Call Center Tel. 02-114-3350"

    else:  # "th"
        # Thai titles
        doc_title_post = "รายการตรวจสอบการบำรุงรักษาเชิงป้องกัน - Circuit Breaker (หลัง PM)"
        doc_title_post_cont = "รายการตรวจสอบการบำรุงรักษาเชิงป้องกัน - Circuit Breaker (หลัง PM ต่อ)"
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
        label_performed = "ผู้ปฏิบัติงาน"
        label_approved = "ผู้อนุมัติ"
        label_witnessed = "ผู้เห็นชอบ"
        label_date = "วันที่ :"

        # Job info labels
        label_station = "สถานี"
        label_pm_date = "วันที่ PM"

        label_page = "หน้า"
        addr_line1 = "การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)"
        addr_line2 = "เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย จังหวัดนนทบุรี 11130"
        addr_line3 = "ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416"
    
    # print(f"[DEBUG] 🔍 issue_id (raw): {repr(pm_date)}")
    # print(f"[DEBUG] 🔍 issue_id (display): {pm_date}")
    
    pdf = ReportPDF(unit="mm", format="A4", issue_id=issue_id)
    pdf._pm_date_th = pm_date_th
    pdf._section = "checklist"

    # Set language labels for header and footer
    pdf._label_page = label_page
    pdf._addr_line1 = addr_line1
    pdf._addr_line2 = addr_line2
    pdf._addr_line3 = addr_line3
    pdf._label_performed = label_performed
    pdf._label_approved = label_approved
    pdf._label_witnessed = label_witnessed
    pdf._label_date = label_date

    pdf.set_margins(left=10, top=10, right=10)
    pdf.set_auto_page_break(auto=True, margin=12)

    base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
    setattr(pdf, "_base_font_name", base_font)
    pdf.set_font(base_font, size=FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)

    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left

    # หน้าแรก
    pdf.add_page()
    # header() จะถูกเรียกอัตโนมัติโดย add_page()
    y = pdf.get_y()

    # ========== ตรวจสอบว่ามีข้อมูล PRE หรือไม่ ==========
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

        # Pre-PM photos: สร้างข้อความแบบกำหนดเองสำหรับ Photos PRE
        # ดึงข้อมูล rows สำหรับ remark
        rows_data = doc.get("rows_pre") or {}
        remark_label = "Remark" if lang == "en" else "หมายเหตุ"

        # จัดกลุ่มหัวข้อหลักและข้อย่อย
        main_items = []
        for key, title in row_titles.items():
            m = re.match(r"^r(\d+)$", key)
            if m:
                idx = int(m.group(1))
                main_items.append((idx, title))
        main_items.sort(key=lambda x: x[0])

        for idx, main_title in main_items:
            # ข้าม ข้อ 11 (ทำความสะอาด) ไม่แสดงใน photos pre
            if idx == 11:
                continue
            # สร้างรายการข้อย่อย
            sub_items = []

            # ข้อ 10 เป็น dynamic - ดึงจาก rows ที่มีอยู่จริง
            if idx == 10:
                for key in rows_data.keys():
                    m = re.match(rf"^r10_sub(\d+)$", key)
                    if m:
                        sub_idx = int(m.group(1))
                        stitle = f"เบรกเกอร์วงจรย่อยที่ {sub_idx}" if lang == "th" else f"Sub-circuit Breaker {sub_idx}"
                        sub_items.append((sub_idx, key, stitle))
                sub_items.sort(key=lambda x: x[0])
                # จำกัด max 6 ข้อย่อย
                sub_items = sub_items[:6]
            else:
                # ข้ออื่นๆ ดึงจาก sub_row_titles ตามปกติ
                for sub_key, sub_title in sub_row_titles.items():
                    m = re.match(rf"^r{idx}_(\d+)$", sub_key)
                    if m:
                        sub_idx = int(m.group(1))
                        sub_items.append((sub_idx, sub_key, sub_title))
                sub_items.sort(key=lambda x: x[0])

            # สร้างข้อความ
            lines = []
            lines.append(f"{idx}) {main_title} (Pre-PM)")  # หัวข้อหลัก ไม่มี indent

            # ดึง remark ของหัวข้อหลัก
            if idx == 9:
                actual_key = "r9_main"
            else:
                actual_key = f"r{idx}"
            
            main_data = rows_data.get(actual_key) or {}
            main_remark = (main_data.get("remark") or "").strip()
            if main_remark and main_remark != "-":
                lines.append(f"{remark_label}: {main_remark}")  # remark หัวข้อหลัก ไม่มี indent

            # เพิ่มข้อย่อยพร้อม remark
            for sub_idx, sub_key, sub_title in sub_items:
                lines.append(f"   {idx}.{sub_idx}) {sub_title}")  # 3 spaces สำหรับข้อย่อย

                # ดึง remark ของข้อย่อยนี้
                sub_data = rows_data.get(sub_key) or {}
                sub_remark = (sub_data.get("remark") or "").strip()
                if sub_remark and sub_remark != "-":
                    lines.append(f"   {remark_label}: {sub_remark}")  # 3 spaces สำหรับ remark

            question_text_pre = "\n".join(lines)
            
            
            img_items = _get_photo_items_for_idx_pre(doc, idx)

            # คำนวณความสูงจริงของแถวรูป
            _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text_pre, LINE_H)
            total_images = len(img_items)
            num_rows = math.ceil(total_images / PHOTO_PER_LINE) if total_images > 0 else 0
            images_total_h = (num_rows * PHOTO_IMG_MAX_H + (num_rows - 1) * PHOTO_GAP + 2 * PHOTO_PAD_Y) if num_rows > 0 else 0
            actual_row_h = max(text_h + 2 * PADDING_Y, images_total_h)

            _ensure_space_photo_pre(actual_row_h)

            row_h_used = _draw_photos_row(
                pdf, base_font, x_table, y, q_w, g_w, question_text_pre, img_items
            )
            y += row_h_used

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
    pdf.set_font(base_font, "B", 12)
    pdf.set_fill_color(255, 230, 100)
    pdf.cell(page_w, TITLE_H, doc_title_post, border=1, ln=1, align="C", fill=True)

    y += TITLE_H

    y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, pm_date, label_station, label_pm_date)

    # ========== ตารางรายการ ==========
    x_table = x0 + EDGE_ALIGN_FIX
    table_total_w = page_w - 2 * EDGE_ALIGN_FIX

    item_w = ITEM_W
    result_w = RESULT_W
    remark_w = page_w - item_w - result_w

    # เก็บตำแหน่งตารางไว้สำหรับวาดเส้นเชื่อมต่อ
    table_x = x_table
    table_width = item_w + result_w + remark_w

    def _ensure_space(height_needed: float):
        nonlocal y
        page_bottom = pdf.h - pdf.b_margin - SIG_H

        if y + height_needed > page_bottom:
            # **วาดเส้นกรอบเชื่อมต่อ** จากตำแหน่งปัจจุบันลงไปถึงลายเซ็น
            pdf.line(table_x, y, table_x, page_bottom)  # เส้นซ้าย
            table_right = table_x + table_width
            pdf.line(table_right, y, table_right, page_bottom)  # เส้นขวา

            pdf.add_page()
            # header() จะถูกเรียกอัตโนมัติโดย add_page()
            y = pdf.get_y()

            # เพิ่มหัวเอกสาร continued
            pdf.set_xy(x0, y)
            pdf.set_font(base_font, "B", 13)
            pdf.set_fill_color(255, 230, 100)
            pdf.cell(
                page_w,
                TITLE_H,
                doc_title_post_cont,
                border=1,
                ln=1,
                align="C",
                fill=True,
            )
            y += TITLE_H

            # เพิ่มหัวตาราง
            y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w, header_item, header_result, header_remark)
            pdf.set_font(base_font, "", FONT_MAIN)

    y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w, header_item, header_result, header_remark)
    pdf.set_font(base_font, "", FONT_MAIN)

    # บันทึกจุดเริ่มต้นของตาราง rows (สำหรับวาดเส้นรอบนอก)
    y_table_start = y
    y_last_row_end = y  # บันทึกจุดสิ้นสุดของ row สุดท้ายบนหน้าแรก
    
    # ก่อนเริ่มลูป ให้คำนวณข้อมูลทั้งหมด เพื่อรู้ว่า row ไหนเป็นสุดท้าย
    checks_list = list(checks)
    
    # for idx, it in enumerate(checks_list):
    #     text = str(it.get("text", ""))
    #     result_lines = it.get("results") or []
    #     if not result_lines:
    #         result_lines = [it.get("result", "na")]

    #     remark = str(it.get("remark", "") or "")
    #     result_offset = int(it.get("result_offset", 0))
    #     result_step = int(it.get("result_step", 1))

    #     item_lines, item_h = _split_lines(
    #         pdf, item_w - 2 * PADDING_X, text, LINE_H
    #     )

    #     _, remark_h_raw = _split_lines(
    #         pdf, remark_w - 2 * PADDING_X, remark, LINE_H
    #     )

    #     # ฐานความสูง remark (ถูกต้อง)
    #     remark_h = max(remark_h_raw + 2 * PADDING_Y, ROW_MIN_H)

    #     match_row = re.match(r"^(\d+)\.", text.strip())
    #     row_num = int(match_row.group(1)) if match_row else 0

    #     # กำหนดขั้นต่ำเฉพาะบางข้อ
    #     if row_num in [3, 4, 5, 7, 8]:
    #         remark_h = max(remark_h, LINE_H * 6.5)
    #     elif row_num == 6:
    #         remark_h = max(remark_h, LINE_H * 7.5)
    #     # elif row_num == 9:
    #     #     # # ถ้าเป็นหน้าแรก ไม่ต้องกำหนดความสูงขั้นต่ำเพราะจะขยายให้เต็มพื้นที่
    #     #     # if pdf.page != 1:
    #     #     remark_h = max(remark_h, LINE_H * 13.5)
    #     # elif row_num == 9:
    #     #     # ข้อ 9 มี voltage data 10 บรรทัด - นับจำนวนบรรทัดจริง
    #     #     remark_lines_count = remark.count('\n') + 1 if remark.strip() else 0
            
    #     #     if remark_lines_count > 3:  # มี voltage data
    #     #         # คำนวณจากความสูงจริง + buffer 10%
    #     #         min_h_for_voltage = (remark_lines_count * LINE_H + 2 * PADDING_Y) * 1.1
    #     #         remark_h = max(remark_h, min_h_for_voltage)
    #     #     else:  # ไม่มี voltage data
    #     #         remark_h = max(remark_h, LINE_H * 13.5)
    for idx, it in enumerate(checks_list):
        text = str(it.get("text", ""))
        result_lines = it.get("results") or []
        if not result_lines:
            result_lines = [it.get("result", "na")]

        remark = str(it.get("remark", "") or "")
        result_offset = int(it.get("result_offset", 0))
        result_step = int(it.get("result_step", 1))

        item_lines, item_h = _split_lines(
            pdf, item_w - 2 * PADDING_X, text, LINE_H
        )

        _, remark_h_raw = _split_lines(
            pdf, remark_w - 2 * PADDING_X, remark, LINE_H
        )

        # ฐานความสูง remark (ถูกต้อง)
        remark_h = max(remark_h_raw + 2 * PADDING_Y, ROW_MIN_H)

        match_row = re.match(r"^(\d+)\.", text.strip())
        row_num = int(match_row.group(1)) if match_row else 0

        # นับจำนวนบรรทัดจริงใน text (รวมหัวข้อหลัก + ข้อย่อย)
        text_line_count = text.count('\n') + 1
        
        # คำนวณความสูงขั้นต่ำตามจำนวนบรรทัด
        min_item_h = text_line_count * LINE_H + 2 * PADDING_Y
    
        
        if row_num in [3, 4, 5, 7, 8]:
            # 3 บรรทัด (หัวข้อ + 2 ข้อย่อย)
            min_item_h = max(min_item_h, 3 * LINE_H + 2 * PADDING_Y)
            remark_h = max(remark_h, 3 * LINE_H + 2 * PADDING_Y)
        elif row_num == 6:
            # 5 บรรทัด (หัวข้อ + 4 ข้อย่อย)
            min_item_h = max(min_item_h, 5 * LINE_H + 2 * PADDING_Y)
            remark_h = max(remark_h, 5 * LINE_H + 2 * PADDING_Y)
        
        # ใช้ความสูงที่คำนวณได้
        item_h = max(item_h, min_item_h)

        result_block_h = max(ROW_MIN_H, len(result_lines) * LINE_H)

        row_h_eff = max(
            ROW_MIN_H,
            item_h,
            remark_h,
            result_block_h
        )

        # เช็คว่า row นี้เป็นสุดท้ายของหน้าหรือไม่
        is_last_row = (idx == len(checks_list) - 1)
        
        # บันทึก y ของ row นี้ ก่อน _ensure_space (เพราะ _ensure_space อาจขึ้นหน้าใหม่)
        if pdf.page == 1:
            y_last_row_end = y + row_h_eff
        
        _ensure_space(row_h_eff)

        # ถ้า row นี้เป็นสุดท้าย และอยู่บนหน้าแรก ให้ขยายความสูงให้ชิดลายเซ็น
        if is_last_row and pdf.page == 1:
            # คำนวณพื้นที่ที่เหลือจนถึงลายเซ็น
            page_bottom = pdf.h - pdf.b_margin - SIG_H
            available_h = page_bottom - y
            
            # ใช้พื้นที่ที่เหลือทั้งหมด (เพื่อให้ชิดกับลายเซ็น)
            if available_h > row_h_eff:
                row_h_eff = available_h
        # ถ้าเป็น row ที่อื่น (ไม่ใช่สุดท้าย) แต่เป็นสุดท้ายของหน้าแรก ก็ต้องขยายด้วย
        elif pdf.page == 1:
            # คำนวณว่า rows ที่เหลือต้องใช้ space เท่าไหร่
            page_bottom = pdf.h - pdf.b_margin - SIG_H
            remaining_rows = checks_list[idx + 1:]
            
            # ประมาณ minimum height สำหรับ rows ที่เหลือ (อย่างน้อย ROW_MIN_H ต่อ row)
            estimated_remaining_h = len(remaining_rows) * ROW_MIN_H
            
            available_h = page_bottom - y
            
            # ถ้า space ไม่พอสำหรับ rows ที่เหลือ ให้ขยาย row นี้ให้เต็มพื้นที่
            # (rows ที่เหลือจะขึ้นหน้าใหม่)
            if available_h < row_h_eff + estimated_remaining_h:
                # ขยายให้เต็มพื้นที่ที่เหลือ จนถึงลายเซ็น
                row_h_eff = available_h

        x = x_table
        _cell_text_in_box(pdf, x, y, item_w, row_h_eff, text,
                        align="L", lh=LINE_H, valign="top")
        x += item_w

        _draw_result_cell(pdf, base_font, x, y, result_w, row_h_eff,
                        result_lines, offset_lines=result_offset, line_step=result_step)
        x += result_w

        _cell_text_in_box(
            pdf, x, y, remark_w, row_h_eff, remark,
            align="L", lh=LINE_H, valign="top"
        )

        y += row_h_eff

    # ========== Comment & Summary ==========
    comment_x = x_table
    comment_item_w = item_w
    comment_result_w = result_w
    comment_remark_w = remark_w

    # 1. ดึงข้อความ comment ก่อน
    comment_text = str(doc.get("summary", "") or "-")

    # 2. คำนวณความสูงจริงของ comment text
    _, comment_h_calculated = _split_lines(pdf, comment_result_w + comment_remark_w - 2 * PADDING_X, comment_text, LINE_H)

    # 3. ใช้ความสูงที่มากกว่า (7mm ขั้นต่ำ หรือความสูงที่คำนวณได้ + padding)
    h_comment = max(7, comment_h_calculated + 2 * PADDING_Y)

    # 4. h_checklist ยังคงเดิม
    h_checklist = 7

    # 5. คำนวณ total_h ใหม่ (ตามความสูงของ comment)
    total_h = h_comment + h_checklist

    # เพิ่มความสูง Signature เข้าด้วย
    sig_h = 5 + 14 + 5 + 5  # header + box + name + date
    total_h_with_sig = total_h + sig_h

    # เช็คพื้นที่สำหรับ Comment + Inspection + Signature ทั้งหมด
    page_bottom = pdf.h - pdf.b_margin

    # ตรวจสอบว่าจะขึ้นหน้าใหม่หรือไม่ก่อนวาด Comment
    # (ถ้าอยู่บนหน้าแรก และ row สุดท้ายขยายแล้ว ไม่ต้องมี Comment)
    is_new_page_for_comment = False
    if pdf.page == 1:
        # บนหน้าแรก: ไม่มี Comment (row สุดท้ายขยายแล้ว)
        is_new_page_for_comment = True

        # **วาดเส้นกรอบเชื่อมต่อ** ก่อนขึ้นหน้าใหม่ (จากข้อสุดท้ายไปถึงลายเซ็น)
        page_bottom_with_sig = pdf.h - pdf.b_margin - SIG_H
        pdf.line(x_table, y, x_table, page_bottom_with_sig)  # เส้นซ้าย
        pdf.line(x_table + item_w + result_w + remark_w, y,
                 x_table + item_w + result_w + remark_w, page_bottom_with_sig)  # เส้นขวา

        pdf.add_page()
        # header() จะถูกเรียกอัตโนมัติโดย add_page()
        y = pdf.get_y()

        pdf.set_xy(x0, y)
        pdf.set_font(base_font, "B", 13)
        pdf.set_fill_color(255, 230, 100)
        pdf.cell(
            page_w,
            TITLE_H,
            doc_title_post_cont,
            border=1,
            ln=1,
            align="C",
            fill=True,
        )
        y += TITLE_H

        # เพิ่มเส้นซ้าย-ขวาของตารางต่อลงเมื่อขึ้นหน้าใหม่
        page_bottom = pdf.h - pdf.b_margin
        pdf.line(comment_x, y, comment_x, page_bottom)  # เส้นซ้าย
        pdf.line(comment_x + comment_item_w + comment_result_w + comment_remark_w, y,
                 comment_x + comment_item_w + comment_result_w + comment_remark_w, page_bottom)  # เส้นขวา
    elif y + total_h_with_sig > page_bottom:
        # บนหน้า continued: ตรวจสอบพื้นที่ Comment + Inspection + Signature
        is_new_page_for_comment = True

        # **วาดเส้นกรอบเชื่อมต่อ** ก่อนขึ้นหน้าใหม่
        pdf.line(comment_x, y, comment_x, page_bottom)  # เส้นซ้าย
        pdf.line(comment_x + comment_item_w + comment_result_w + comment_remark_w, y,
                 comment_x + comment_item_w + comment_result_w + comment_remark_w, page_bottom)  # เส้นขวา

        pdf.add_page()
        # header() จะถูกเรียกอัตโนมัติโดย add_page()
        y = pdf.get_y()

        pdf.set_xy(x0, y)
        pdf.set_font(base_font, "B", 13)
        pdf.set_fill_color(255, 230, 100)
        pdf.cell(
            page_w,
            TITLE_H,
            doc_title_post_cont,
            border=1,
            ln=1,
            align="C",
            fill=True
        )
        y += TITLE_H

        # เพิ่มเส้นซ้าย-ขวาของตารางต่อลงเมื่อขึ้นหน้าใหม่
        page_bottom = pdf.h - pdf.b_margin
        pdf.line(comment_x, y, comment_x, page_bottom)  # เส้นซ้าย
        pdf.line(comment_x + comment_item_w + comment_result_w + comment_remark_w, y, 
                 comment_x + comment_item_w + comment_result_w + comment_remark_w, page_bottom)  # เส้นขวา

    # วาดกรอบนอกทั้งหมด (ความสูงขยายแล้ว)
    pdf.rect(comment_x, y, comment_item_w + comment_result_w + comment_remark_w, total_h)

    # ========== แถว Comment (ขยายตามความสูง) ==========
    pdf.set_font(base_font, "B", 11)
    pdf.set_xy(comment_x, y)
    pdf.cell(comment_item_w, h_comment, "Comment :", border=0, align="L")

    # วาดเส้นคั่นระหว่าง "Comment :" และข้อความ (สูงเต็ม h_comment)
    pdf.line(comment_x + comment_item_w, y, comment_x + comment_item_w, y + h_comment)

    # ใช้ _cell_text_in_box สำหรับ comment text (ขยายตามความสูง)
    pdf.set_font(base_font, "", 11)
    _cell_text_in_box(pdf, comment_x + comment_item_w, y, comment_result_w + comment_remark_w, h_comment, 
                    comment_text, align="L", lh=LINE_H, valign="top")

    y += h_comment

    # เส้นคั่นระหว่าง Comment และ Inspection Results
    pdf.line(comment_x, y, comment_x + comment_item_w + comment_result_w + comment_remark_w, y)

    # เส้นคั่นระหว่าง Comment และ Inspection Results
    pdf.line(comment_x, y, comment_x + comment_item_w + comment_result_w + comment_remark_w, y)

    # ========== แถว Inspection Results (ความสูงคงที่) ==========
    summary_check_raw = str(doc.get("summaryCheck", "")).strip()
    # Normalize ให้เป็น PASS, FAIL, N/A
    if summary_check_raw.upper() in ("PASS", "P", "TRUE", "OK", "1"):
        summary_check = "PASS"
    elif summary_check_raw.upper() in ("FAIL", "F", "FALSE", "0", "X"):
        summary_check = "FAIL"
    elif summary_check_raw.upper() in ("NA", "N/A", "N / A", "-"):
        summary_check = "N/A"
    else:
        summary_check = "-"

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
    
    # คำนวณตำแหน่งลายเซ็นให้ติดด้านล่างสุด (หลังลบ b_margin)
    page_bottom = pdf.h - pdf.b_margin
    
    # ถ้าเป็นหน้าแรก: วาดเส้นซ้าย-ขวา จากจุดสิ้นสุดของ row สุดท้าย ลงไปถึงลายเซ็น
    if pdf.page == 1:
        # วาดเส้นซ้าย-ขวาของตารางจากจุดสิ้นสุดของ row สุดท้าย ลงไปถึงลายเซ็น
        pdf.line(x_table, y_last_row_end, x_table, page_bottom)  # เส้นซ้าย
        pdf.line(x_table + item_w + result_w + remark_w, y_last_row_end, 
                 x_table + item_w + result_w + remark_w, page_bottom)  # เส้นขวา
    else:
        # บนหน้า continued: เหมือนเดิม (ไม่มีการวาดเส้นซ้าย-ขวาพิเศษ)
        # ถ้าไม่ขึ้นหน้าใหม่ ต้องวาดเส้นบน (ต่อจาก rows)
        if not is_new_page_for_comment:
            pdf.line(comment_x, y, comment_x + comment_item_w + comment_result_w + comment_remark_w, y)
        
        # วาดเส้นซ้าย-ขวาของตารางต่อลงถึงลายเซ็น (ไม่มีช่องว่าง)
        pdf.line(comment_x, y, comment_x, page_bottom)  # เส้นซ้าย
        pdf.line(comment_x + comment_item_w + comment_result_w + comment_remark_w, y,
                 comment_x + comment_item_w + comment_result_w + comment_remark_w, page_bottom)  # เส้นขวา

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

    x_table = x0 + EDGE_ALIGN_FIX
    q_w = PHOTO_Q_W
    g_w = (page_w - 2 * EDGE_ALIGN_FIX) - q_w

    def _ensure_space_photo_post(height_needed: float):
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

    # Post-PM photos: แสดงทุกข้อที่มีรูปใน photos field
    # รวม row_titles และ sub_row_titles เข้าด้วยกัน
    combined_titles = {**row_titles, **sub_row_titles}

    # ดึงรายการข้อทั้งหมดที่มีรูป
    photos_dict = doc.get("photos") or {}
    photo_indices = set()
    for key in photos_dict.keys():
        # แยก index จาก key เช่น g2 -> 2, g4_1 -> 4, g8_2 -> 8
        match = re.match(r"g(\d+)", key)
        if match:
            photo_indices.add(int(match.group(1)))

    # print(f"[DEBUG] Photos POST: Found photos for indices: {sorted(photo_indices)}")

    # สร้าง photo rows สำหรับทุกข้อที่มีรูป
    photo_rows = _build_photo_rows_grouped(combined_titles, doc.get("measures") or {}, doc.get("rows") or {}, lang)

    # เพิ่มข้อที่มีรูปแต่ไม่มีใน photo_rows
    existing_indices = {int(it.get("idx") or 0) for it in photo_rows}
    # print(f"[DEBUG] Existing indices from photo_rows: {sorted(existing_indices)}")

    for idx in sorted(photo_indices):
        if idx not in existing_indices and idx != 11:  # ข้อ 11 คือทำความสะอาด ไม่แสดงใน POST
            # print(f"[DEBUG] Adding missing index {idx} to photo_rows")
            # สร้าง row ใหม่สำหรับข้อที่มีรูปแต่ไม่มีใน checklist
            main_key = f"r{idx}"
            main_title = combined_titles.get(main_key, f"ข้อ {idx}" if lang == "th" else f"Item {idx}")

            lines = [f"  {idx}) {main_title}"]

            # หา sub items ที่มีรูป
            sub_keys = []
            for key in photos_dict.keys():
                match = re.match(rf"g{idx}_(\d+)", key)
                if match:
                    sub_idx = int(match.group(1))
                    sub_keys.append(sub_idx)

            # print(f"[DEBUG] Index {idx} has sub_keys: {sorted(sub_keys)}")

            # เพิ่ม sub items
            for sub_idx in sorted(sub_keys):
                sub_key = f"r{idx}_{sub_idx}"
                sub_title = combined_titles.get(sub_key, f"ข้อย่อย {idx}.{sub_idx}" if lang == "th" else f"Subitem {idx}.{sub_idx}")
                lines.append(f"        {idx}.{sub_idx}) {sub_title}")

            photo_rows.append({
                "idx": idx,
                "text": "\n".join(lines),
                "measures": doc.get("measures") or {}
            })

    # เรียงลำดับตาม idx
    photo_rows.sort(key=lambda x: int(x.get("idx") or 0))
    # print(f"[DEBUG] Final photo_rows indices: {[int(it.get('idx') or 0) for it in photo_rows]}")

    for it in photo_rows:
        idx = int(it.get("idx") or 0)

        # ข้าม ข้อ 11 (ทำความสะอาด) ไม่แสดงใน photos post
        # if idx == 11:
        #     continue

        question_text = it.get("text", "")  # ใช้ text ที่มี subitems แล้ว
        img_items = _get_photo_items_for_idx(doc, idx)

        # print(f"[DEBUG] Processing idx={idx}, found {len(img_items)} images")

        # คำนวณความสูงจริงของแถวรูป
        _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)
        total_images = len(img_items)
        num_rows = math.ceil(total_images / PHOTO_PER_LINE) if total_images > 0 else 0
        images_total_h = (num_rows * PHOTO_IMG_MAX_H + (num_rows - 1) * PHOTO_GAP + 2 * PHOTO_PAD_Y) if num_rows > 0 else 0
        actual_row_h = max(text_h + 2 * PADDING_Y, images_total_h)

        _ensure_space_photo_post(actual_row_h)

        row_h_used = _draw_photos_row(pdf, base_font, x_table, y, q_w, g_w,
                                     question_text, img_items)
        y += row_h_used

    return _output_pdf_bytes(pdf)


# -------------------- Public API --------------------
def generate_pdf(data: dict, lang: str = "th") -> bytes:
    return make_pm_report_html_pdf_bytes(data, lang=lang)