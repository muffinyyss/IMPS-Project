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


# -------------------- รายการหัวข้อ CCB --------------------
# Thai version
ROW_TITLES_TH = {
    "r1": "ตรวจสอบสภาพทั่วไป",
    "r2": "ตรวจสอบสภาพดักซีล, ซิลิโคนกันซึม",
    "r3": "ตรวจสอบระบบระบายอากาศ",
    "r4": "ตรวจสอบระบบแสงสว่าง",
    "r5": "ตรวจสอบระบบสำรองไฟฟ้า (UPS)",
    "r6": "ตรวจสอบระบบกล้องวงจรปิด (CCTV)",
    "r7": "ตรวจสอบเราเตอร์ (Router)",
    "r8": "ตรวจสอบตู้คอนซูเมอร์ยูนิต (Consumer Unit)",
    "r9": "ตรวจสอบแรงดันไฟฟ้า (Consumer Unit)",
}

# English version
ROW_TITLES_EN = {
    "r1": "Check General Condition",
    "r2": "Check Seal, Silicone Waterproofing",
    "r3": "Check Ventilation System",
    "r4": "Check Lighting System",
    "r5": "Check UPS (Uninterruptible Power Supply)",
    "r6": "Check CCTV System",
    "r7": "Check Router",
    "r8": "Check Consumer Unit",
    "r9": "Check Voltage (Consumer Unit)",
}

# Default to Thai
ROW_TITLES = ROW_TITLES_TH

# ชื่อข้อย่อย
# Thai version
SUB_ROW_TITLES_TH = {
    "r3_sub1": "ตรวจสอบการทำงานอุปกรณ์ตั้งภูมิ",
    "r3_sub2": "ตรวจสอบการทำงานพัดลมระบายอากาศ",
    "r4_sub1": "ตรวจสอบการทำงานของไฟส่องสว่างในสถานี",
    "r4_sub2": "ตรวจสอบการทำงานของป้ายไฟ / Logo",
    "r5_sub1": "เครื่องสามารถทำงานได้ตามปกติ",
    "r5_sub2": "เครื่องสามารถสำรองไฟได้ (>5นาที)",
    "r6_sub1": "ตรวจสอบสภาพทั่วไปของกล้องวงจรปิด",
    "r6_sub2": "ตรวจสอบสภาพทั่วไปเครื่องบันทึก (NVR)",
    "r6_sub3": "ตรวจสอบสถานะการใช้งาน",
    "r6_sub4": "ตรวจสอบมุมกล้อง",
    "r7_sub1": "ตรวจสอบสภาพทั่วไป",
    "r7_sub2": "ตรวจสอบสถานะการทำงาน",
    "r8_sub1": "ตรวจสอบสภาพทั่วไป",
    "r8_sub2": "ตรวจสอบจุดขันแน่น",
    "r9_sub1": "เมนเบรกเกอร์ (Main Breaker)",
    "r9_sub2": "เบรกเกอร์วงจรย่อยที่ 1",
    "r9_sub3": "เบรกเกอร์วงจรย่อยที่ 2",
    "r9_sub4": "เบรกเกอร์วงจรย่อยที่ 3",
    "r9_sub5": "เบรกเกอร์วงจรย่อยที่ 4",
    "r9_sub6": "เบรกเกอร์วงจรย่อยที่ 5",
}

# English version
SUB_ROW_TITLES_EN = {
    "r3_sub1": "Check Thermostat Operation",
    "r3_sub2": "Check Ventilation Fan Operation",
    "r4_sub1": "Check Station Lighting Operation",
    "r4_sub2": "Check Sign/Logo Lighting Operation",
    "r5_sub1": "Unit Operates Normally",
    "r5_sub2": "Unit Can Provide Backup Power (>5 min)",
    "r6_sub1": "Check General Condition of Cameras",
    "r6_sub2": "Check General Condition of NVR",
    "r6_sub3": "Check Operational Status",
    "r6_sub4": "Check Camera Angles",
    "r7_sub1": "Check General Condition",
    "r7_sub2": "Check Operational Status",
    "r8_sub1": "Check General Condition",
    "r8_sub2": "Check Tightness of Connections",
    "r9_sub1": "Main Breaker",
    "r9_sub2": "Sub-circuit Breaker 1",
    "r9_sub3": "Sub-circuit Breaker 2",
    "r9_sub4": "Sub-circuit Breaker 3",
    "r9_sub5": "Sub-circuit Breaker 4",
    "r9_sub6": "Sub-circuit Breaker 5",
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
    if url_path.startswith("data:image/"):
        print("[DEBUG] ✅ เป็น data URL")
        try:
            head, b64 = url_path.split(",", 1)
            mime = head.split(";")[0].split(":", 1)[1]
            bio = BytesIO(base64.b64decode(b64))
            img_type = (
                "PNG"
                if "png" in mime
                else ("JPEG" if "jpeg" in mime or "jpg" in mime else "")
            )
            print(f"[DEBUG] ✅ แปลง data URL สำเร็จ (type: {img_type})")
            return bio, img_type
        except Exception as e:
            print(f"[DEBUG] ❌ แปลง data URL ล้มเหลว: {e}")
            return None, None

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
                print(f"[DEBUG] ✅ เจอรูปแล้ว! {local_path}")
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
    items_in = (doc.get("photos") or {}).get(f"g{idx}") or []
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

def _get_photo_items_for_idx_pre(doc: dict, idx: int) -> List[dict]:
    items_in = (doc.get("photos_pre") or {}).get(f"g{idx}") or []
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

def _format_r9_short(measures: dict, sub_index: int) -> str:
    root = (measures or {}).get("r9") or {}
    if not isinstance(root, dict):
        return ""

    # sub_index เข้ามาเป็น 0..5
    entry = root.get(str(sub_index)) or root.get(sub_index)
    if not isinstance(entry, dict):
        return ""

    def _get(key: str) -> str:
        d = entry.get(key) or {}
        val = str(d.get("value") or "").strip()
        unit = str(d.get("unit") or "").strip()
        if not val:
            return "-"
        return f"{val}{unit}"

    # mapping L-N -> L1-N, L-G -> L1-G, N-G คงเดิม ตามฟอร์มในเอกสาร
    return (
        f"L1-N = {_get('L-N')},  "
        f"L1-G = {_get('L-G')},  "
        f"N-G = {_get('N-G')}"
    )
    

# -------------------- Result / Row processing --------------------
def _rows_to_checks(rows: dict, measures: Optional[dict] = None, row_titles: dict = None, sub_row_titles: dict = None) -> List[dict]:
    if not isinstance(rows, dict):
        return []

    # ใช้ค่า default ถ้าไม่ได้ส่งมา
    if row_titles is None:
        row_titles = ROW_TITLES
    if sub_row_titles is None:
        sub_row_titles = SUB_ROW_TITLES

    rows = rows or {}
    measures = measures or {}
    items: List[dict] = []

    SUB_INDENT = "\u00A0" * 4

    for main_key, main_title in row_titles.items():
        m = re.match(r"^r(\d+)$", main_key)
        if not m:
            continue
        idx = int(m.group(1))

        # รวม sub ของข้อ idx
        subs: List[Tuple[int, str, str]] = []
        for k, stitle in sub_row_titles.items():
            m_sub = re.match(rf"^r{idx}_sub(\d+)$", k)
            if m_sub:
                subs.append((int(m_sub.group(1)), k, stitle))
        subs.sort(key=lambda x: x[0])
        
        # ---------- ข้อความในคอลัมน์ Item ----------
        lines: List[str] = [f"{idx}. {main_title}"]

        for sub_index, sub_key, stitle in subs:
            if main_key == "r9":
                # ใช้ measures["r9"]["0".."5"] ต่อท้ายหัวข้อย่อยแต่ละบรรทัด
                short_text = _format_r9_short(measures, sub_index - 1)
                if short_text:
                    lines.append(f"{SUB_INDENT}{stitle}\n{SUB_INDENT}{short_text}")
                else:
                    lines.append(f"{SUB_INDENT}{stitle}")
            else:
                # หัวข้ออื่นใช้แบบเดิม
                lines.append(f"{SUB_INDENT}{stitle}")


        text = "\n".join(lines)


        # ---------- ผลลัพธ์ในคอลัมน์ Result ----------
        result_lines: List[str] = []
        remark_lines: List[str] = []
        
        if subs:
            # ใช้ผลของหัวข้อย่อยทีละบรรทัด
            for order_num, sub_key, stitle in subs:
                # ใช้ alt_key เป็นหลักเสมอ
                alt_key = f"r{idx}_{order_num}"
                data_sub = rows.get(alt_key) or rows.get(sub_key) or {}

                raw_res = _extract_row_result(data_sub)
                rmk = (data_sub.get("remark") or "").strip()

                result_lines.append(_norm_result(raw_res))
                remark_lines.append(rmk)

            # เริ่มต้นค่า default
            result_offset = 1      # ข้ามบรรทัดหัวข้อหลัก ("9. ตรวจสอบ...")
            result_step = 1        # ปกติ 1 row ของ Result ต่อ 1 บรรทัดข้อความ

            if idx == 9:
                result_step = 2
        else:
            # ไม่มี sub → ใช้ pf ของหัวข้อหลัก rN ตามเดิม
            data_main = rows.get(main_key) or {}
            raw_res = _extract_row_result(data_main)
            result_lines.append(_norm_result(raw_res))
            remark_lines.append((data_main.get("remark") or "").strip())
            result_offset = 0
            result_step = 1


        # ---------- Remark (รวม voltage + remark แยกบรรทัด) ----------
        remark_parts: List[str] = []

        # ข้อ 4–8 : พ่วงข้อมูลวัดแรงดันไฟฟ้าแบบเดิม (m4..m8)
        if main_key.lower() in ["r4", "r5", "r6", "r7", "r8"]:
            measure_key = f"m{idx}"
            voltage_text = _format_voltage_measurement(measures, measure_key)
            if voltage_text:
                remark_parts.append(voltage_text)

        # ---------- main remark ----------
        data_main = rows.get(main_key) or {}
        main_rmk = (data_main.get("remark") or "").strip()
        if main_rmk:
            remark_parts.append(main_rmk)

        # ---------- sub remark ----------
        if subs and result_offset == 1:
            formatted_remarks = []
            for i, rmk in enumerate(remark_lines):
                formatted_remarks.append(rmk or "")
            remark_text = "\n".join([""] + formatted_remarks)
            if remark_text.strip():
                remark_parts.append(remark_text)

        # รวม remark
        remark = "\n".join(p for p in remark_parts if p.strip())


        items.append(
            {
                "idx": idx,
                "text": text,
                "results": result_lines,
                "remark": remark,
                "result_offset": result_offset,
                "result_step": result_step,
                "remark": remark,
                
            }
        )

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
def _draw_header(pdf: FPDF, base_font: str, issue_id: str = "-") -> float:
    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left
    y_top = 10

    col_left, col_mid = 40, 120
    col_right = page_w - col_left - col_mid

    # --- ความสูง ---
    h_all = 20        
    h_right_top = 7     

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
    line_h = 5.0

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

def _draw_items_table_header(pdf: FPDF, base_font: str, x: float, y: float, item_w: float, result_w: float, remark_w: float):
    header_h = 5.5
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(item_w, header_h, "Item", border=1, align="C")
    pdf.cell(result_w, header_h, "Result", border=1, align="C")
    pdf.cell(remark_w, header_h, "Remark", border=1, ln=1, align="C")
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
) -> float:
    """
    วาดช่องลายเซ็น
    
    Args:
        y_bottom: ถ้ากำหนด ให้วาดโดยติดด้านล่านของค่านี้ (จัดตำแหน่งให้เต็มหน้า)
    """
    signer_labels = ["Performed by", "Approved by", "Witnessed by"]
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
PHOTO_MAX_PER_ROW = 20
PHOTO_PER_LINE    = 4    
PHOTO_IMG_MAX_H   = 40
PHOTO_GAP         = 0.7
PHOTO_PAD_X       = 1
PHOTO_PAD_Y       = 1
PHOTO_ROW_MIN_H = PHOTO_IMG_MAX_H + 4
PHOTO_FONT_SMALL  = 10
PHOTO_LINE_H      = 5

def _draw_photos_table_header(pdf: FPDF, base_font: str, x: float, y: float, q_w: float, g_w: float) -> float:
    header_h = 5.5
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_xy(x, y)
    pdf.cell(q_w, header_h, "Item / Question", border=1, align="C")
    pdf.cell(g_w, header_h, "Reference Photos", border=1, ln=1, align="C")
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
def _build_photo_rows_grouped(row_titles: dict, measures_data: Optional[dict] = None) -> List[dict]:
    """สร้าง photo rows พร้อมแสดง voltage measurements ของข้อ 9
    
    measures_data: ข้อมูลการวัด (measures_pre สำหรับ Pre-PM หรือ measures สำหรับ Post-PM)
    """
    grouped: List[dict] = []
    measures_data = measures_data or {}
    active_measures = measures_data

    # เดินตามลำดับการประกาศใน ROW_TITLES เพื่อคงลำดับหัวข้อ
    main_keys: List[Tuple[int, str, str]] = []  # (idx, key, title)
    for k, title in row_titles.items():
        m = re.fullmatch(r"r(\d+)", k)
        if m:
            main_keys.append((int(m.group(1)), k, title))

    for idx, main_key, main_title in main_keys:
        lines = [f"{idx}. {main_title}"]

        # รวม sub ทั้งหมดของหัวข้อนี้ ตามลำดับชื่อคีย์ (r{idx}_sub1, r{idx}_sub2, ...)
        subs: List[Tuple[int, str]] = []
        for k, stitle in row_titles.items():
            m = re.fullmatch(rf"r{idx}_sub(\d+)", k)
            if m:
                subs.append((int(m.group(1)), stitle))
        subs.sort(key=lambda x: x[0])

        for sub_order, stitle in subs:
            clean_stitle = re.sub(r"^\s*\.\s*", "", str(stitle))
            lines.append(f" {clean_stitle}")
            
            # ถ้าเป็นข้อ 9 ให้เพิ่มค่า measures
            if idx == 9:
                short_text = _format_r9_short(active_measures, sub_order - 1)
                if short_text:
                    lines.append(f" {short_text}")

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

    _item(x, y, "Station", station_name)
    _item(x + col_w, y, "PM Date", pm_date)

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
        self._section = "checklist"
        self._pm_date_th = ""
        self._base_font_name = "Arial"

    def header(self):
        # ทุกหน้าเรียกอัตโนมัติ
        _draw_header(self, self._base_font_name, issue_id=self.issue_id)
        self.ln(10)  # เว้นจากหัวเอกสารลงมา

    def footer(self):
        # Photos ไม่ต้องมีลายเซ็น
        if self._section == "photos":
            return

        left = self.l_margin
        page_w = self.w - self.l_margin - self.r_margin

        item_w = ITEM_W
        result_w = RESULT_W
        remark_w = page_w - item_w - result_w

        # sig_h = SIG_H
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
    
    # print(f"[DEBUG] 🔍 issue_id (raw): {repr(pm_date)}")
    # print(f"[DEBUG] 🔍 issue_id (display): {pm_date}")
    
    pdf = ReportPDF(unit="mm", format="A4", issue_id=issue_id)
    pdf._pm_date_th = pm_date_th
    pdf._section = "checklist"
    
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
    y = _draw_header(pdf, base_font, issue_id)

    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 12)
    pdf.set_fill_color(255, 230, 100)
    pdf.cell(page_w, TITLE_H, DOCUMENT_TITLE_POST, border=1, ln=1, align="C", fill=True)

    y += TITLE_H

    y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, pm_date)

    # ========== ตารางรายการ ==========
    x_table = x0 + EDGE_ALIGN_FIX
    table_total_w = page_w - 2 * EDGE_ALIGN_FIX
    
    item_w = ITEM_W
    result_w = RESULT_W
    remark_w = page_w - item_w - result_w
    
    in_checklist = True
    signature_drawn_on_page = False
    
    def _ensure_space(height_needed: float):
        nonlocal y
        page_bottom = pdf.h - pdf.b_margin - SIG_H

        if y + height_needed > page_bottom:
            pdf.add_page()
            y = _draw_header(pdf, base_font, issue_id)
            
            # เพิ่มหัวเอกสาร continued
            pdf.set_xy(x0, y)
            pdf.set_font(base_font, "B", 13)
            pdf.set_fill_color(255, 230, 100)
            pdf.cell(
                page_w,
                TITLE_H,
                DOCUMENT_TITLE_POST_CONT,
                border=1,
                ln=1,
                align="C",
                fill=True,
            )
            y += TITLE_H
            
            # เพิ่มหัวตาราง
            y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w)
            pdf.set_font(base_font, "", FONT_MAIN)

    y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w)
    pdf.set_font(base_font, "", FONT_MAIN)

    # บันทึกจุดเริ่มต้นของตาราง rows (สำหรับวาดเส้นรอบนอก)
    y_table_start = y
    y_last_row_end = y  # บันทึกจุดสิ้นสุดของ row สุดท้ายบนหน้าแรก
    
    # ก่อนเริ่มลูป ให้คำนวณข้อมูลทั้งหมด เพื่อรู้ว่า row ไหนเป็นสุดท้าย
    checks_list = list(checks)
    
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

        # กำหนดขั้นต่ำเฉพาะบางข้อ
        if row_num in [3, 4, 5, 7, 8]:
            remark_h = max(remark_h, LINE_H * 3.5)
        elif row_num == 6:
            remark_h = max(remark_h, LINE_H * 5.5)
        elif row_num == 9:
            # ถ้าเป็นหน้าแรก ไม่ต้องกำหนดความสูงขั้นต่ำเพราะจะขยายให้เต็มพื้นที่
            if pdf.page != 1:
                remark_h = max(remark_h, LINE_H * 13.5)

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
        pdf.add_page()
        y = _draw_header(pdf, base_font, issue_id)

        pdf.set_xy(x0, y)
        pdf.set_font(base_font, "B", 13)
        pdf.set_fill_color(255, 230, 100)
        pdf.cell(
            page_w,
            TITLE_H,
            DOCUMENT_TITLE_POST_CONT,
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
        pdf.add_page()
        y = _draw_header(pdf, base_font, issue_id)

        pdf.set_xy(x0, y)
        pdf.set_font(base_font, "B", 13)
        pdf.set_fill_color(255, 230, 100)
        pdf.cell(
            page_w,
            TITLE_H,
            DOCUMENT_TITLE_POST_CONT,
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
    
    # === Signature ติดด้านล่างสุด ===
    y = _draw_signature_block(
        pdf,
        base_font,
        x_table,
        y,
        item_w,
        result_w,
        remark_w,
        pm_date_th,
        y_bottom=page_bottom,  # บอกให้วาดลายเซ็นติดด้านล่างสุด
    )

    # ======================= ส่วนที่ 1: Post-PM Photos (ต่อหลัง Checklist) =======================
    pdf._section = "photos"
    
    # เพิ่มหน้าใหม่ก็ต่อเมื่อมีพื้นที่ไม่พอ (ไม่ต้อง add_page ทันที)
    page_bottom = pdf.h - pdf.b_margin
    if y > page_bottom - 50:  # ถ้าพื้นที่เหลือน้อย ให้ขึ้นหน้าใหม่
        pdf.add_page()
        y = _draw_header(pdf, base_font, issue_id)

    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 13)
    pdf.set_fill_color(255, 230, 100)
    
    # ตรวจสอบว่ามี Pre-PM Photos หรือไม่
    has_pre_photos = bool(doc.get("photos_pre"))
    title_text = DOCUMENT_TITLE_PHOTO_POST if has_pre_photos else "Photos"
    pdf.cell(page_w, TITLE_H, title_text, border=1, ln=1, align="C", fill=True)
    y += TITLE_H

    x_table = x0 + EDGE_ALIGN_FIX
    q_w = PHOTO_Q_W
    g_w = (page_w - 2 * EDGE_ALIGN_FIX) - q_w

    def _ensure_space_photo_post(height_needed: float):
        nonlocal y
        if y + height_needed > (pdf.h - pdf.b_margin):
            pdf.add_page()
            y = _draw_header(pdf, base_font, issue_id)
            pdf.set_xy(x0, y)
            pdf.set_font(base_font, "B", 13)
            pdf.set_fill_color(255, 230, 100)
            pdf.cell(page_w, PHOTO_CONTINUE_H, DOCUMENT_TITLE_PHOTO_CONT, border=1, ln=1, align="C", fill=True)
            y += PHOTO_CONTINUE_H
            y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)
            pdf.set_font(base_font, "", FONT_MAIN)

    y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)
    pdf.set_font(base_font, "", FONT_MAIN)

    # Post-PM photos: ใช้ measures สำหรับแสดง voltage measurements
    # รวม row_titles และ sub_row_titles เข้าด้วยกัน
    combined_titles = {**row_titles, **sub_row_titles}
    photo_rows = _build_photo_rows_grouped(combined_titles, doc.get("measures") or {})

    for it in photo_rows:
        idx = int(it.get("idx") or 0)
        question_text = it.get("text", "")  # ใช้ text ที่มี subitems แล้ว
        img_items = _get_photo_items_for_idx(doc, idx)

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

    # ======================= ส่วนที่ 2: Pre-PM Photos (ท้ายสุด) =======================
    if has_pre_photos:
        pdf._section = "photos"
        pdf.add_page()
        y = _draw_header(pdf, base_font, issue_id)

        pdf.set_xy(x0, y)
        pdf.set_font(base_font, "B", 13)
        pdf.set_fill_color(255, 230, 100)
        pdf.cell(page_w, TITLE_H, DOCUMENT_TITLE_PHOTO_PRE, border=1, ln=1, align="C", fill=True)
        y += TITLE_H

        x_table = x0 + EDGE_ALIGN_FIX
        q_w = PHOTO_Q_W
        g_w = (page_w - 2 * EDGE_ALIGN_FIX) - q_w

        def _ensure_space_photo_pre(height_needed: float):
            nonlocal y
            if y + height_needed > (pdf.h - pdf.b_margin):
                pdf.add_page()
                y = _draw_header(pdf, base_font, issue_id)
                pdf.set_xy(x0, y)
                pdf.set_font(base_font, "B", 13)
                pdf.set_fill_color(255, 230, 100)
                pdf.cell(page_w, PHOTO_CONTINUE_H, DOCUMENT_TITLE_PHOTO_CONT, border=1, ln=1, align="C", fill=True)
                y += PHOTO_CONTINUE_H
                y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)
                pdf.set_font(base_font, "", FONT_MAIN)

        y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)
        pdf.set_font(base_font, "", FONT_MAIN)

        # Pre-PM photos: ใช้ measures_pre สำหรับแสดง voltage measurements
        # รวม row_titles และ sub_row_titles เข้าด้วยกัน
        combined_titles = {**row_titles, **sub_row_titles}
        photo_rows = _build_photo_rows_grouped(combined_titles, doc.get("measures_pre") or {})

        for it in photo_rows:
            idx = int(it.get("idx") or 0)
            
            base_text = it.get("text", "")  # ข้อมูลที่มี subitems แล้ว
            # เพิ่ม (Pre-PM) ต่อจากบรรทัดแรกเท่านั้น
            lines = base_text.split("\n")
            if lines:
                lines[0] = f"{lines[0]} (Pre-PM)"
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

    return _output_pdf_bytes(pdf)


# -------------------- Public API --------------------
def generate_pdf(data: dict, lang: str = "th") -> bytes:
    return make_pm_report_html_pdf_bytes(data, lang=lang)
