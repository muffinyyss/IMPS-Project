# backend/pdf/templates/pdf_station.py
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
    import requests  # optional
except Exception:
    requests = None

# -------------------- ตั้งค่าทั่วไป --------------------
PDF_DEBUG = True  # เปิด debug mode ชั่วคราว
# PDF_DEBUG = os.getenv("PDF_DEBUG") == "1"

# -------------------- ฟอนต์ไทย --------------------
FONT_CANDIDATES: Dict[str, List[str]] = {
    "":  ["THSarabunNew.ttf", "TH Sarabun New.ttf", "THSarabun.ttf", "TH SarabunPSK.ttf"],
    "B": ["THSarabunNew-Bold.ttf", "THSarabunNew Bold.ttf", "TH Sarabun New Bold.ttf", "THSarabun Bold.ttf"],
    "I": ["THSarabunNew-Italic.ttf", "THSarabunNew Italic.ttf", "TH Sarabun New Italic.ttf", "THSarabun Italic.ttf"],
    "BI":["THSarabunNew-BoldItalic.ttf", "THSarabunNew BoldItalic.ttf", "TH Sarabun New BoldItalic.ttf", "THSarabun BoldItalic.ttf"],
}

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
ITEM_W = 65
RESULT_W = 64
TITLE_H = 7

# -------------------- รายการหัวข้อ Station --------------------
# Thai version
ROW_TITLES_TH = {
    "r1": "ตรวจสอบโครงสร้างสถานี",
    "r2": "ตรวจสอบสีโครงสร้างสถานี",
    "r3": "ตรวจสอบพื้นผิวสถานี",
    "r4": "ตรวจสอบสีพื้นผิวสถานี",
    "r5": "ตรวจสอบตัวกั้นห้ามล้อ",
    "r6": "ตรวจสอบเสากันชนเครื่องอัดประจุไฟฟ้า",
    "r7": "โคมไฟส่องสว่าง",
    "r8": "ป้ายชื่อสถานี",
    "r9": "ป้ายวิธีใช้งาน",
    "r10": "ตรวจสอบถังดับเพลิง",
    "r11": "ทำความสะอาด"
}

# English version
ROW_TITLES_EN = {
    "r1": "Check station structure",
    "r2": "Check station structure paint",
    "r3": "Check station surface",
    "r4": "Check station surface paint",
    "r5": "Check wheel stopper",
    "r6": "Check charger bumper pole",
    "r7": "Lighting",
    "r8": "Station sign",
    "r9": "Usage instruction sign",
    "r10": "Check fire extinguisher",
    "r11": "Cleaning"
}

# Default to Thai
ROW_TITLES = ROW_TITLES_TH

# ชื่อข้อย่อย (ข้อที่มี 2 ข้อย่อยคงที่)
# Thai version
SUB_ROW_TITLES_TH = {
    "r7_1": "ตรวจสอบสภาพโคมไฟส่องสว่าง",
    "r7_2": "ตรวจสอบการทำงาน",
    
    "r8_1": "ตรวจสอบสภาพป้ายชื่อสถานี",
    "r8_2": "ตรวจสอบการทำงาน",
    
    "r9_1": "ตรวจสอบสภาพป้ายวิธีใช้งาน",
    "r9_2": "ตรวจสอบการทำงาน",
    
    "r10_1": "ตรวจสอบสภาพทั่วไป",
    "r10_2": "ตรวจสอบเกจวัดแรงดัน",
    "r10_3": "ตรวจสอบของเหลวภายใน",
}

# English version
SUB_ROW_TITLES_EN = {
    "r7_1": "Check lighting fixture condition",
    "r7_2": "Check operation",
    
    "r8_1": "Check station sign condition",
    "r8_2": "Check operation",
    
    "r9_1": "Check instruction sign condition",
    "r9_2": "Check operation",
    
    "r10_1": "Check general condition",
    "r10_2": "Check pressure gauge",
    "r10_3": "Check internal liquid",
}

# Default to Thai
SUB_ROW_TITLES = SUB_ROW_TITLES_TH


# -------------------- Utilities / Core helpers --------------------
def _log(msg: str):
    if PDF_DEBUG:
        print(msg)
        
def _is_http_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")

def _guess_img_type_from_ext(path_or_url: str) -> str:
    ext = os.path.splitext(str(path_or_url).lower())[1]
    if ext == ".png":
        return "PNG"
    if ext in (".jpg", ".jpeg", ".jfif"):
        return "JPEG"
    return ""

def _norm_result(val: str) -> str:
    s = (str(val) if val is not None else "").strip().lower()
    if s in ("pass", "p", "true", "ok", "1", "✔", "✓"):
        return "pass"
    if s in ("fail", "f", "false", "0", "x", "✗", "✕"):
        return "fail"
    return "na" 

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

    # 🔥 เพิ่ม debug ที่นี่
    # print(f"\n{'='*80}")
    # print(f"[DEBUG] 🔍 กำลังหารูป: {url_path}")
    # print(f"{'='*80}")

    # case: data URL
    # if url_path.startswith("data:image/"):
    #     # print("[DEBUG] ✅ เป็น data URL")
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
    if not url_path.startswith("https"):  # ข้าม http URL
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

    # ส่งออก
    buf = BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf

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
        # _log(f"[IMG] cache hit: {url_path}")
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
        # _log(f"[IMG] cached: {url_path}")
        
        # สร้าง BytesIO ใหม่เพื่อ return (เพราะ cache ใช้ต้นฉบับ)
        new_buf = BytesIO(img_buf.getvalue())
        return new_buf, img_type
        
    except Exception as e:
        # _log(f"[IMG] auto-rotate error: {e}")
        return None, None


# -------------------- Photo data helpers --------------------
def _get_photo_items_for_idx(doc: dict, idx: int) -> List[dict]:

    out: List[dict] = []

    # ---------- 1) ใช้ข้อมูลจาก doc.photos ถ้ามี ----------
    photos = (doc.get("photos") or {}).get(f"r{idx}") or []
    for p in photos:
        if isinstance(p, dict) and p.get("url"):
            out.append({"url": p["url"]})
    if out:
        return out[:PHOTO_MAX_PER_ROW]

    # ---------- 2) หาในโฟลเดอร์จริง ----------
    station_id = _get_station_id(doc)
    doc_id = _extract_doc_id(doc)

    if not station_id or not doc_id:
        return []

    backend_root = Path(__file__).resolve().parents[2]   # backend/
    folder = backend_root / "uploads" / "stationpm" / station_id / doc_id / f"r{idx}"

    # _log(f"[PHOTO] try folder: {folder}")
    if not folder.exists():
        # _log(f"[PHOTO] folder not exists: {folder}")
        return []

    for f in sorted(folder.iterdir()):
        if f.is_file() and f.suffix.lower() in IMAGE_EXTS:
            out.append({"url": f.as_posix()})
            if len(out) >= PHOTO_MAX_PER_ROW:
                break

    # _log(f"[PHOTO] found {len(out)} files for r{idx}")
    return out

def _get_photo_items_for_idx_pre(doc: dict, idx: int) -> List[dict]:

    out: List[dict] = []

    # ---------- 1) ใช้ข้อมูลจาก doc.photos_pre ถ้ามี ----------
    photos = (doc.get("photos_pre") or {}).get(f"r{idx}") or []
    for p in photos:
        if isinstance(p, dict) and p.get("url"):
            out.append({"url": p["url"]})
    if out:
        return out[:PHOTO_MAX_PER_ROW]

    # ---------- 2) หาในโฟลเดอร์จริง ----------
    station_id = _get_station_id(doc)
    doc_id = _extract_doc_id(doc)

    if not station_id or not doc_id:
        return []

    backend_root = Path(__file__).resolve().parents[2]   # backend/
    folder = backend_root / "uploads" / "stationpm" / station_id / doc_id / f"r{idx}"

    # _log(f"[PHOTO] try folder: {folder}")
    if not folder.exists():
        # _log(f"[PHOTO] folder not exists: {folder}")
        return []

    for f in sorted(folder.iterdir()):
        if f.is_file() and f.suffix.lower() in IMAGE_EXTS:
            out.append({"url": f.as_posix()})
            if len(out) >= PHOTO_MAX_PER_ROW:
                break

    # _log(f"[PHOTO] found {len(out)} files for r{idx}")
    return out


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

    rows = rows or {}
    measures = measures or {}
    items: List[dict] = []

    SUB_INDENT = "\u00A0" * 4

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
        group = grouped[main_idx]
        main_key = group["main"]
        subs = sorted(group["subs"], key=lambda x: x[0])  # เรียงตาม sub_idx

        # ดึงข้อมูลข้อหลัก
        main_data = rows.get(main_key, {}) if main_key else {}
        # เลือก fallback text ตามภาษา
        fallback_item = "Item" if lang == "en" else "รายการที่"
        main_title = row_titles.get(f"r{main_idx}", f"{fallback_item} {main_idx}")

        # ---------- ข้อความในคอลัมน์ Item ----------
        lines: List[str] = [f"{main_idx}) {main_title}"]

        # ใช้ sub_row_titles สำหรับข้อย่อย - กรองเฉพาะที่มีใน sub_row_titles
        sub_titles = []
        for sub_idx, sub_key in subs:
            # กรองเฉพาะข้อย่อยที่มีใน sub_row_titles
            if sub_key in sub_row_titles:
                stitle = sub_row_titles[sub_key]
                sub_titles.append((sub_idx, sub_key, stitle))

        # สร้างข้อย่อยในรูปแบบ "idx.sub_idx) title" พร้อม indent
        for sub_idx, sub_key, stitle in sub_titles:
            lines.append(f"    {main_idx}.{sub_idx}) {stitle}") 

        text = "\n".join(lines)

        # ---------- ✅ แก้: สร้าง result list (ให้ checkbox ไปที่หัวข้อย่อย) ----------
        result_lines: List[str] = []
        remark_lines: List[str] = []

        if sub_titles:
            # ข้อที่มี subitems (7, 8, 9)
            for sub_idx, sub_key, stitle in sub_titles:
                data_sub = rows.get(sub_key) or {}
                raw_res = data_sub.get("pf", "na")
                rmk = (data_sub.get("remark") or "").strip()

                result_lines.append(_norm_result(raw_res))
                remark_lines.append(rmk)

            # offset: ข้ามบรรทัดหัวข้อหลัก
            result_offset = 1
            result_step = 1
        else:
            # ข้อปกติ (1-6, 10)
            data_main = rows.get(main_key) or {}
            raw_res = data_main.get("pf", "na")
            result_lines.append(_norm_result(raw_res))
            remark_lines.append((data_main.get("remark") or "").strip())
            result_offset = 0
            result_step = 1

        # ---------- Remark ----------
        data_main = rows.get(main_key) or {}
        main_rmk = (data_main.get("remark") or "").strip()

        if sub_titles and result_offset == 1:
            formatted_remarks = [""]  # บรรทัดแรกว่าง (ตรงกับหัวข้อหลัก)
            
            for i, (sub_idx, sub_key, stitle) in enumerate(sub_titles):
                rmk = remark_lines[i] if i < len(remark_lines) else ""
                
                if rmk and rmk != "-":
                    formatted_remarks.append(f"{main_idx}.{sub_idx}) {rmk}")
                else:
                    formatted_remarks.append("")
            
            remark = "\n".join(formatted_remarks)
        else:
            remark = "" if main_rmk == "-" else (main_rmk if main_rmk else "")

        # ---------- สร้าง item ----------
        items.append({
            "idx": main_idx,
            "text": text,
            "results": result_lines,
            "result_offset": result_offset,
            "result_step": result_step,
            "remark": remark,
            "has_subs": bool(sub_titles),  # เพิ่ม flag has_subs
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
    addr_line1: str = "Electricity Generating Authority of Thailand (EGAT)",
    addr_line2: str = "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand",
    addr_line3: str = "Call Center Tel. 02-114-3350",
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

    addr_lines = [addr_line1, addr_line2, addr_line3]

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
    group_title: str = "Station",
    header_item: str = "Item",
    header_result: str = "Result",
    header_remark: str = "Remark",
):
    header_h = 6.0
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "B", FONT_MAIN)

    # แถวหัวตาราง
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
PHOTO_MAX_PER_ROW = 20
PHOTO_PER_LINE    = 4    
PHOTO_IMG_MAX_H   = 40
PHOTO_GAP         = 0.7
PHOTO_PAD_X       = 1
PHOTO_PAD_Y       = 1
PHOTO_ROW_MIN_H = PHOTO_IMG_MAX_H + 4
PHOTO_FONT_SMALL  = 10
PHOTO_LINE_H      = 5

def _draw_photos_table_header(pdf: FPDF, base_font: str, x: float, y: float, q_w: float, g_w: float, header_question: str = "Item / Question", header_photos: str = "Reference Photos") -> float:
    header_h = 6.0
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

def _get_uploads_root() -> Path:
    """เลือก root ของ uploads: ENV(PHOTOS_UPLOADS_DIR) > <backend>/uploads"""
    override = os.getenv("PHOTOS_UPLOADS_DIR")
    if override:
        p = Path(override)
        if p.exists():
            return p
    backend_root = Path(__file__).resolve().parents[2]  # .../backend
    return backend_root / "uploads"

def _split_upload_url_parts(url_path: str):
    
    clean = url_path.lstrip("/").replace("\\", "/")
    parts = clean.split("/")
    if len(parts) >= 5 and parts[0] == "uploads":
        type_part = parts[1]
        station = parts[2]
        doc_id = parts[3]
        group = parts[4]
        filename = parts[5] if len(parts) >= 6 else ""
        return type_part, station, doc_id, group, filename
    return None

IMAGE_EXTS = [
    ".jpg", ".jpeg", ".png", ".jfif",
    ".webp", ".bmp", ".gif", ".tiff", ".tif"
]

def _pick_image_from_path(p: Path) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
    # 1) เป็นไฟล์ และเป็นรูป
    if p.is_file() and p.suffix.lower() in IMAGE_EXTS:
        return p.as_posix(), _guess_img_type_from_ext(p.as_posix())

    # 2) ไม่มีนามสกุล → ลองเติม
    if not p.suffix and p.parent.exists():
        for ext in IMAGE_EXTS:
            cand = p.with_suffix(ext)
            if cand.exists() and cand.is_file():
                return cand.as_posix(), _guess_img_type_from_ext(cand.as_posix())

    # 3) เป็นโฟลเดอร์ → หาไฟล์รูปแรก
    if p.is_dir():
        for f in sorted(p.iterdir()):
            if f.is_file() and f.suffix.lower() in IMAGE_EXTS:
                return f.as_posix(), _guess_img_type_from_ext(f.as_posix())

    return None, None

# -------------------- data helpers --------------------
def _build_photo_rows_grouped(row_titles: dict) -> List[dict]:
    grouped: List[dict] = []

    # เดินตามลำดับการประกาศใน ROW_TITLES เพื่อคงลำดับหัวข้อ
    main_keys: List[Tuple[int, str, str]] = []  # (idx, key, title)
    for k, title in row_titles.items():
        m = re.fullmatch(r"r(\d+)", k)
        if m:
            main_keys.append((int(m.group(1)), k, title))

    for idx, main_key, main_title in main_keys:
        lines = [f"{idx}) {main_title}"]

        # รวม sub ทั้งหมดของหัวข้อนี้ ตามลำดับชื่อคีย์ (r{idx}_sub1, r{idx}_sub2, ...)
        subs: List[Tuple[int, str]] = []
        for k, stitle in row_titles.items():
            m = re.fullmatch(rf"r{idx}_sub(\d+)", k)
            if m:
                subs.append((int(m.group(1)), stitle))
        subs.sort(key=lambda x: x[0])

        for _, stitle in subs:
            clean_stitle = re.sub(r"^\s*\.\s*", "", str(stitle))
            lines.append(f" {clean_stitle}")

        grouped.append({"idx": idx, "text": "\n".join(lines)})

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
                    # _log(f"[IMG] place error: {e}")
                    pdf.set_xy(cx, cy + (PHOTO_IMG_MAX_H - LINE_H) / 2.0)
                    pdf.cell(slot_w, LINE_H, "-", border=0, align="C")
            else:
                pdf.set_xy(cx, cy + (PHOTO_IMG_MAX_H - LINE_H) / 2.0)
                pdf.cell(slot_w, LINE_H, "-", border=0, align="C")

    pdf.set_xy(x + q_w + g_w, y)
    return row_h


# -------------------- Drawing – job / summary blocks --------------------
def _draw_job_info_block(pdf: FPDF, base_font: str, x: float, y: float, w: float,
                         station_name: str, pm_date: str, label_station: str = "Station", label_pm_date: str = "PM Date") -> float:
    row_h = 6.5
    col_w = w / 2.0
    label_w = 30
    box_h = row_h
    pdf.set_line_width(LINE_W_INNER)
    pdf.rect(x, y, w, box_h)
    pdf.line(x + col_w, y, x + col_w, y + box_h)
    # pdf.line(x, y + row_h, x + w, y + row_h)       # แถว

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
        # ตัวแปรสำหรับ signature labels
        self._label_performed = "Performed by"
        self._label_approved = "Approved by"
        self._label_witnessed = "Witnessed by"
        self._label_date = "Date :"

    def header(self):
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
            label_performed=self._label_performed,
            label_approved=self._label_approved,
            label_witnessed=self._label_witnessed,
            label_date=self._label_date,
        )

def _extract_doc_id(doc: dict) -> str:
    _id = doc.get("_id")
    if isinstance(_id, str):
        return _id
    if isinstance(_id, dict):
        return _id.get("$oid") or _id.get("_id") or ""
    return str(_id) if _id else ""


def _get_station_id(doc: dict) -> str:
    job = doc.get("job") or {}
    return (
        job.get("station_id")
        or doc.get("station_id")
        or job.get("stationId")
        or ""
    )


def make_pm_report_html_pdf_bytes(doc: dict, lang: str = "th") -> bytes:
    job = doc.get("job", {}) or {}
    station_name = job.get("station_name", "-")
    pm_date = _fmt_date_thai_like_sample(doc.get("pm_date", job.get("date", "-")))
    pm_date_th = _fmt_date_thai_full(doc.get("pm_date", job.get("date", "-")))
    issue_id = str(doc.get("issue_id", "-"))

    # สร้าง doc_name จาก station_name และปี (เช่น Station A_2/2026)
    doc_name = str(doc.get("doc_name", ""))
    if not doc_name:
        # สร้างจาก station_name และปีจาก pm_date
        try:
            raw_date = doc.get("pm_date", job.get("date", ""))
            if raw_date:
                if isinstance(raw_date, str):
                    dt = _parse_date_flex(raw_date)
                    if dt:
                        doc_name = f"{station_name}_{dt.month}/{dt.year}"
                elif hasattr(raw_date, 'year'):
                    doc_name = f"{station_name}_{raw_date.month}/{raw_date.year}"
        except:
            pass
        if not doc_name:
            doc_name = station_name

    pdf = ReportPDF(unit="mm", format="A4", issue_id=issue_id, doc_name=doc_name)
    pdf._pm_date_th = pm_date_th
    pdf._section = "checklist"

    pdf.set_margins(left=10, top=10, right=10)
    pdf.set_auto_page_break(auto=True, margin=12)

    # ---- โหลดฟอนต์ไทยให้แน่นอนก่อน set_font ----
    base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
    setattr(pdf, "_base_font_name", base_font)
    pdf.set_font(base_font, size=FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)

    # ========== เลือกข้อความตามภาษา ==========
    if lang == "en":
        # English titles
        doc_title_post = "Preventive Maintenance Checklist - Station (POST)"
        doc_title_post_cont = "Preventive Maintenance Checklist - Station (POST Continued)"
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
        doc_title_post = "รายการตรวจสอบการบำรุงรักษาเชิงป้องกัน - สถานี (หลัง PM)"
        doc_title_post_cont = "รายการตรวจสอบการบำรุงรักษาเชิงป้องกัน - สถานี (หลัง PM ต่อ)"
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

    # กำหนดค่า labels และ address ตามภาษา
    pdf._label_page = label_page
    pdf._label_issue_id = label_issue_id
    pdf._label_doc_name = label_doc_name
    pdf._addr_line1 = addr_line1
    pdf._addr_line2 = addr_line2
    pdf._addr_line3 = addr_line3
    pdf._label_performed = label_performed
    pdf._label_approved = label_approved
    pdf._label_witnessed = label_witnessed
    pdf._label_date = label_date

    # ========== เลือก row titles ตามภาษา ==========
    if lang == "en":
        row_titles = ROW_TITLES_EN
        sub_row_titles = SUB_ROW_TITLES_EN
    else:
        row_titles = ROW_TITLES_TH
        sub_row_titles = SUB_ROW_TITLES_TH

    checks = _rows_to_checks(doc.get("rows") or {}, doc.get("measures") or {}, row_titles, sub_row_titles, lang)
    checks_pre = _rows_to_checks(doc.get("rows_pre") or {}, doc.get("measures_pre") or {}, row_titles, sub_row_titles, lang)

    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left
    EDGE_ALIGN_FIX = (LINE_W_OUTER - LINE_W_INNER) / 2.0

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
        pdf._section = "photos" 

        # ========== วาดหัว Photos PRE ==========
        pdf.set_xy(x0, y)
        pdf.set_font(base_font, "B", 13)
        pdf.set_fill_color(255, 230, 100)
        pdf.cell(page_w, TITLE_H, doc_title_photo_pre, border=1, ln=1, align="C", fill=True)
        y += TITLE_H

        # ========== วาด Job Info Block ==========
        y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, pm_date, label_station, label_pm_date)

        x_table = x0 + EDGE_ALIGN_FIX
        q_w = 85.0
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
                photo_continue_h = 6
                pdf.cell(page_w, photo_continue_h, doc_title_photo_cont, border=1, ln=1, align="C", fill=True)
                y += photo_continue_h
                y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w, header_question, header_photos)
                pdf.set_font(base_font, "", FONT_MAIN)

        y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w, header_question, header_photos)
        pdf.set_font(base_font, "", FONT_MAIN)

        for it in checks_pre:
            idx = int(it.get("idx") or 0)

            if idx > 10:
                continue

            # ========== สร้าง question text พร้อมข้อย่อยและ remark ==========
            has_subs = it.get("has_subs", False)
            item_text = it.get("text", "")
            item_remark = it.get("remark", "")

            # ตรวจสอบว่ามีข้อย่อยหรือไม่ (จากการมี newline หรือ flag has_subs)
            has_subs = has_subs or ("\n" in item_text)

            if has_subs:
                # แยกบรรทัดของ text และ remark
                text_lines = item_text.split("\n")
                remark_lines = item_remark.split("\n") if item_remark else []

                # สร้าง dict สำหรับ lookup remark ของแต่ละข้อย่อย
                remark_dict = {}
                for r_line in remark_lines:
                    r_line = r_line.strip()
                    if not r_line:
                        continue
                    # parse "7.1) xxx" หรือ "7.1) -"
                    match = re.match(r"^(\d+\.\d+)\)\s*(.*)$", r_line)
                    if match:
                        sub_key = match.group(1)  # เช่น "7.1"
                        sub_remark = match.group(2).strip()
                        remark_dict[sub_key] = sub_remark
                        # if PDF_DEBUG:
                        #     _log(f"[PRE] Parsed remark: {sub_key} -> {sub_remark[:50] if sub_remark else 'empty'}")

                # สร้าง question text ใหม่พร้อม remark
                result_lines = []
                for i, line in enumerate(text_lines):
                    line = line.strip()
                    if not line:
                        continue

                    if i == 0:
                        # หัวข้อหลัก - เพิ่ม (Pre-PM)
                        result_lines.append(f"{line} {label_pre_pm}")
                    else:
                        # ข้อย่อย - เพิ่มข้อย่อยก่อน
                        result_lines.append(f"   {line}")
                        # หา remark ของข้อย่อยนี้
                        sub_match = re.match(r"(\d+\.\d+)\)", line)
                        if sub_match:
                            sub_key = sub_match.group(1)
                            if sub_key in remark_dict and remark_dict[sub_key] and remark_dict[sub_key] != "-":
                                result_lines.append(f"   {label_remark}: {remark_dict[sub_key]}")

                question_text_pre = "\n".join(result_lines)
            else:
                # ไม่มีข้อย่อย - แสดงปกติ
                question_text_pre = f"{item_text} {label_pre_pm}"

                # เพิ่ม remark ถ้ามี
                if item_remark and item_remark.strip() and item_remark.strip() != "-":
                    question_text_pre += f"\n{label_remark}: {item_remark.strip()}"

            # ดึงรูป Pre-PM (ถ้าไม่มีจะได้ list ว่าง)
            img_items_pre = _get_photo_items_for_idx_pre(doc, idx)

            # คำนวณความสูงจริงของแถว
            _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text_pre, LINE_H)
            total_images = len(img_items_pre)
            num_rows = math.ceil(total_images / PHOTO_PER_LINE) if total_images > 0 else 0
            img_h = PHOTO_IMG_MAX_H
            images_total_h = (num_rows * img_h + (num_rows - 1) * PHOTO_GAP + 2 * PADDING_Y) if num_rows > 0 else 0
            actual_row_h = max(PHOTO_ROW_MIN_H, text_h + 2 * PADDING_Y, images_total_h)

            # เช็คว่าจะล้นหน้าไหม
            _ensure_space_photo_pre(actual_row_h)

            row_h_used = _draw_photos_row(pdf, base_font, x_table, y, q_w, g_w,
                                        question_text_pre, img_items_pre)
            y += row_h_used

    # ================================================================================
    # 📋 ส่วนที่ 2: CHECKLIST
    # ================================================================================
    if has_pre_photos:
        # ถ้ามี Photos PRE → ต้อง add_page() เพื่อขึ้นหน้าใหม่
        pdf.add_page()
        pdf._section = "checklist"
        # header() จะถูกเรียกอัตโนมัติโดย add_page()
        y = pdf.get_y()
    else:
        # ถ้าไม่มี Photos PRE → ใช้หน้าแรกที่สร้างไว้แล้ว (y ยังคงเดิม)
        pdf._section = "checklist"

    # ชื่อเอกสาร
    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 13)
    pdf.set_fill_color(255, 230, 100)
    pdf.cell(page_w, TITLE_H, doc_title_post, border=1, ln=1, align="C", fill=True)

    y += TITLE_H

    # ข้อมูลงาน
    y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, pm_date, label_station, label_pm_date)

    # ตารางรายการตรวจสอบ
    x_table = x0 + EDGE_ALIGN_FIX
    table_total_w = page_w - 2 * EDGE_ALIGN_FIX
    item_w = 65
    result_w = 64
    remark_w = page_w - item_w - result_w
    pdf.set_font(base_font, "", FONT_MAIN)

    # เก็บค่าตำแหน่งและขนาดตารางสำหรับวาดเส้นเชื่อมต่อ
    pdf._table_x = x_table
    pdf._table_width = item_w + result_w + remark_w
    pdf._table_start_y = None


    def _ensure_space(height_needed: float, draw_table_header: bool = True, draw_header_columns: bool = True):
        nonlocal y
        # จองพื้นที่สำหรับ signature ที่จะถูกวาดโดย footer()
        page_bottom = pdf.h - pdf.b_margin - SIG_H

        if y + height_needed > page_bottom:
            # **วาดเส้นกรอบเชื่อมต่อ** ก่อน add_page()
            if draw_table_header and pdf._table_x and pdf._table_width:
                pdf.line(pdf._table_x, y, pdf._table_x, page_bottom)
                table_right = pdf._table_x + pdf._table_width
                pdf.line(table_right, y, table_right, page_bottom)

            pdf.add_page()
            # header() จะถูกเรียกอัตโนมัติโดย add_page()
            y = pdf.get_y()

            # วาดหัวตารางถ้าเป็นข้อ checklist
            if draw_table_header:
                # วาด title "POST Continued" สีเหลือง (แสดงเสมอ)
                pdf.set_xy(x0, y)
                pdf.set_font(base_font, "B", 13)
                pdf.set_fill_color(255, 230, 100)
                pdf.cell(page_w, TITLE_H, doc_title_post_cont, border=1, ln=1, align="C", fill=True)
                y += TITLE_H

                # วาดหัว column ตาราง (ถ้า draw_header_columns=True)
                if draw_header_columns:
                    y = _draw_items_table_header(
                        pdf,
                        base_font,
                        x_table,
                        y,
                        item_w,
                        result_w,
                        remark_w,
                        group_title=doc.get("groupTitle", "Station"),
                        header_item=header_item,
                        header_result=header_result,
                        header_remark=header_remark,
                    )

                    pdf._table_start_y = y

            pdf.set_font(base_font, "", FONT_MAIN)

    # หัวตาราง
    y = _draw_items_table_header(
        pdf,
        base_font,
        x_table,
        y,
        item_w,
        result_w,
        remark_w,
        group_title=doc.get("groupTitle", "Station"),
        header_item=header_item,
        header_result=header_result,
        header_remark=header_remark,
    )
    pdf.set_font(base_font, "", FONT_MAIN)

    
    for it in checks:
        text = str(it.get("text", ""))

        # list ของผลต่อบรรทัดในคอลัมน์ Result
        result_lines = it.get("results") or []
        if not result_lines:
            result_lines = [it.get("result", "na")]

        remark = str(it.get("remark", "") or "")
        result_offset = int(it.get("result_offset", 0))  # <-- ดึง offset
        result_step = int(it.get("result_step", 1)) 

        # คำนวนความสูงแต่ละส่วน
        _, item_h = _split_lines(pdf, item_w - 2 * PADDING_X, text, LINE_H)
        _, remark_h_raw = _split_lines(pdf, remark_w - 2 * PADDING_X, remark, LINE_H)
        remark_h = max(remark_h_raw + 2 * PADDING_Y, ROW_MIN_H)

        # ใช้ regex เพื่อหาหมายเลขข้อที่แท้จริง (ตัวเลขที่ขึ้นต้นบรรทัด)
        match_row = re.match(r"^(\d+)\)", text.strip())
        row_num = int(match_row.group(1)) if match_row else 0

        # ตรวจสอบว่ามีข้อย่อยหรือไม่
        has_subs = it.get("has_subs", False)

        # ความสูงสำหรับข้อที่มีข้อย่อย
        if has_subs:
            # ต้องมีพื้นที่พอสำหรับ checkbox แต่ละข้อย่อย
            sub_count = len(result_lines)
            min_result_h = (sub_count + 1) * LINE_H + 2 * PADDING_Y
            remark_h = max(remark_h, min_result_h)

        # ความสูงจริงของ row
        row_h_eff = max(
            ROW_MIN_H,
            item_h + 2 * PADDING_Y,
            remark_h
        )

        _ensure_space(row_h_eff)

        x = x_table
        #  ให้ Item ชิดบน ไม่จัดกลาง เพื่อให้บรรทัดเท่ากัน
        _cell_text_in_box(pdf, x, y, item_w, row_h_eff, text,
                        align="L", lh=LINE_H, valign="top")
        x += item_w

        #  ส่ง offset เข้าไปให้ช่อง Result
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

    # 3. ใช้ความสูงที่มากกว่า (7mm ขั้นต่ำ หรือความสูงที่คำนวณได้)
    h_comment = max(7, comment_h_calculated + 2 * PADDING_Y)

    # 4. h_checklist ยังคงเดิม
    h_checklist = 7

    # 5. คำนวณ total_h ใหม่ (ตามความสูงของ comment)
    total_h = h_comment + h_checklist

    # ตรวจสอบพื้นที่ก่อนวาดส่วน Comment (แสดง row continued สีเหลือง แต่ไม่แสดงหัวตาราง)
    _ensure_space(total_h + 5, draw_table_header=True, draw_header_columns=False)

    # วาดกรอบนอกทั้งหมด (ความสูงขยายแล้ว)
    pdf.rect(comment_x, y, comment_item_w + comment_result_w + comment_remark_w, total_h)

    # ========== แถว Comment (ขยายตามความสูง) ==========
    pdf.set_font(base_font, "B", 11)
    pdf.set_xy(comment_x, y)
    pdf.cell(comment_item_w, h_comment, label_comment, border=0, align="L")

    # วาดเส้นคั่นระหว่าง "Comment :" และข้อความ (สูงเต็ม h_comment)
    pdf.line(comment_x + comment_item_w, y, comment_x + comment_item_w, y + h_comment)

    # ใช้ _cell_text_in_box สำหรับ comment text (ขยายตามความสูง)
    pdf.set_font(base_font, "", 11)
    _cell_text_in_box(pdf, comment_x + comment_item_w, y, comment_result_w + comment_remark_w, h_comment, 
                    comment_text, align="L", lh=LINE_H, valign="top")

    y += h_comment

    # เส้นคั่นระหว่าง Comment และ Inspection Results
    pdf.line(comment_x, y, comment_x + comment_item_w + comment_result_w + comment_remark_w, y)

    # ========== แถว Inspection Results (ความสูงคงที่) ==========
    summary_check = str(doc.get("summaryCheck", "")).strip().upper() or "-"

    pdf.set_xy(comment_x, y)
    pdf.set_font(base_font, "B", 11)
    pdf.cell(comment_item_w, h_checklist, label_inspection, border=0, align="L")

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

    y_last_row_end = y + h_checklist

    # วาดเส้นกรอบนอกซ้ายขวา
    page_bottom = pdf.h - pdf.b_margin - SIG_H
    pdf.line(comment_x, y_last_row_end, comment_x, page_bottom)
    pdf.line(comment_x + comment_item_w + comment_result_w + comment_remark_w, y_last_row_end,
             comment_x + comment_item_w + comment_result_w + comment_remark_w, page_bottom)

    # ================================================================================
    # 📸 ส่วนที่ 3: PHOTOS POST
    # ================================================================================
    pdf.add_page()  
    pdf._section = "photos" 

    # header() จะถูกเรียกอัตโนมัติโดย add_page()
    y = pdf.get_y()

    x_table = x0 + EDGE_ALIGN_FIX
    q_w = 85.0
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
            photo_continue_h = 6
            pdf.cell(page_w, photo_continue_h, doc_title_photo_cont, border=1, ln=1, align="C", fill=True)
            y += photo_continue_h
            y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w, header_question, header_photos)
            pdf.set_font(base_font, "", FONT_MAIN)

    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 13)
    pdf.set_fill_color(255, 230, 100)
    title_text = doc_title_photo_post if has_pre_photos else (doc_title_photo_post if lang == "th" else "Photos")
    pdf.cell(page_w, TITLE_H, title_text, border=1, ln=1, align="C", fill=True)
    y += TITLE_H

    y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w, header_question, header_photos)
    pdf.set_font(base_font, "", FONT_MAIN)

    for it in checks:
        idx = int(it.get("idx") or 0)

        # ========== สร้าง question text พร้อมข้อย่อย (ไม่แสดง remark) ==========
        has_subs = it.get("has_subs", False)
        item_text = it.get("text", "")

        if has_subs:
            # แยกบรรทัดของ text
            text_lines = item_text.split("\n")

            # สร้าง question text ใหม่ (ไม่มี remark)
            result_lines = []
            for i, line in enumerate(text_lines):
                line = line.strip()
                if not line:
                    continue

                if i == 0:
                    # หัวข้อหลัก
                    result_lines.append(line)
                else:
                    # ข้อย่อย
                    result_lines.append(f"   {line}")

            question_text = "\n".join(result_lines)
        else:
            # ไม่มีข้อย่อย - แสดงปกติ (ไม่มี remark)
            question_text = item_text

        img_items = _get_photo_items_for_idx(doc, idx)

        # คำนวณความสูงจริงของแถว
        _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)
        total_images = len(img_items)
        num_rows = math.ceil(total_images / PHOTO_PER_LINE) if total_images > 0 else 0
        img_h = PHOTO_IMG_MAX_H
        images_total_h = (num_rows * img_h + (num_rows - 1) * PHOTO_GAP + 2 * PADDING_Y) if num_rows > 0 else 0
        actual_row_h = max(PHOTO_ROW_MIN_H, text_h + 2 * PADDING_Y, images_total_h + 4)

        # เช็คว่าจะล้นหน้าไหม ถ้าใช่ ให้ขึ้นหน้าใหม่ก่อนวาด
        _ensure_space_photo_post(actual_row_h)

        row_h_used = _draw_photos_row(pdf, base_font, x_table, y, q_w, g_w, 
                                     question_text, img_items)
        y += row_h_used

    return _output_pdf_bytes(pdf)


# -------------------- Public API --------------------
def generate_pdf(data: dict, lang: str = "th") -> bytes:
    return make_pm_report_html_pdf_bytes(data, lang=lang)

