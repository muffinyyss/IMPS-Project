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

# -------------------- ตั้งค่าทั่วไป --------------------
DOCUMENT_TITLE_POST = "Preventive Maintenance Checklist - Charger (POST)"
DOCUMENT_TITLE_PRE = "Preventive Maintenance Checklist - Charger (PRE)"
DOCUMENT_TITLE_POST_CONT = "Preventive Maintenance Checklist - Charger (POST Continued)"
DOCUMENT_TITLE_PRE_CONT = "Preventive Maintenance Checklist - Charger (PRE Continued)"
DOCUMENT_TITLE_PHOTO_CONT = "Photos (Continued)"
DOCUMENT_TITLE_PHOTO_PRE = "Photos (PRE)"
DOCUMENT_TITLE_PHOTO_POST = "Photos (POST)"

PDF_DEBUG = os.getenv("PDF_DEBUG") == "1"


# -------------------- ฟอนต์ไทย --------------------
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


# -------------------- รายการหัวข้อ Charger --------------------
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
    "r18": "ทำความสะอาด"
}


# -------------------- Utilities / Core helpers --------------------
def _log(msg: str):
    if PDF_DEBUG:
        print(msg)
        
def _is_http_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")

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
    return int(m.group(1)) if m else 10_000

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
    """ดึงรูปจาก photos (หลัง PM) - charger ใช้ key g{idx}"""
    photos = ((doc.get("photos") or {}).get(f"g{idx}") or [])
    out = []
    for p in photos:
        if isinstance(p, dict) and p.get("url"):
            out.append(p)
    return out[:PHOTO_MAX_PER_ROW]

def _get_photo_items_for_idx_pre(doc: dict, idx: int) -> List[dict]:
    """ดึงรูปจาก photos_pre (ก่อน PM) - charger ใช้ key g{idx}"""
    photos_pre = ((doc.get("photos_pre") or {}).get(f"g{idx}") or [])
    out = []
    for p in photos_pre:
        if isinstance(p, dict) and p.get("url"):
            out.append(p)
    return out[:PHOTO_MAX_PER_ROW]


# -------------------- Measurement / Data formatting --------------------
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


# -------------------- Result / Row processing --------------------
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

def _draw_items_table_header(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    item_w: float,
    result_w: float,
    remark_w: float,
    charger_no: str
):
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "B", FONT_MAIN)

    # ==============================
    # 1) แถว Charger No. (อยู่บนสุด)
    # ==============================
    pdf.set_fill_color(255, 230, 100)
    pdf.set_xy(x, y)
    title_text = f"Charger No. {charger_no}"
    pdf.cell(
        item_w + result_w + remark_w,
        CHARGER_ROW_H,
        title_text,
        border=1,
        ln=1,
        align="L",
        fill=True
    )

    y += CHARGER_ROW_H

    # ==============================
    # 2) แถว Header: Item | Result | Remark
    # ==============================
    header_h = 5.5
    pdf.set_fill_color(255, 255, 255)  # reset สีพื้น
    pdf.set_xy(x, y)
    pdf.cell(item_w, header_h, "Item", border=1, align="C")
    pdf.cell(result_w, header_h, "Result", border=1, align="C")
    pdf.cell(remark_w, header_h, "Remark", border=1, ln=1, align="C")

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
    header_h = 5.5
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_xy(x, y)
    pdf.cell(q_w, header_h, "Item / Question", border=1, align="C")
    pdf.cell(g_w, header_h, "Reference Photos", border=1, ln=1, align="C")
    return y + header_h


# -------------------- Drawing – result cells --------------------
# def _draw_result_cell(pdf: FPDF, base_font: str, x: float, y: float, w: float, h: float, result: str, is_top_align: bool = False):
#     pdf.rect(x, y, w, h)
#     col_w = w / 3.0
#     labels = [("Pass", result == "pass"), ("Fail", result == "fail"), ("N/A", result == "na")]
#     pdf.set_font(base_font, "", FONT_SMALL)
#     for i, (lab, chk) in enumerate(labels):
#         sx = x + i * col_w
#         if i > 0:
#             pdf.line(sx, y, sx, y + h)
#         text_w = pdf.get_string_width(lab)
#         content_w = CHECKBOX_SIZE + 1.6 + text_w
#         start_x = sx + (col_w - content_w) / 2.0
        
#         # ถ้า is_top_align=True ให้ชิดบน, ไม่งั้นให้อยู่ตรงกลาง
#         if is_top_align:
#             start_y = y + PADDING_Y
#         else:
#             start_y = y + (h - CHECKBOX_SIZE) / 2.0
        
#         _draw_check(pdf, start_x, start_y, CHECKBOX_SIZE, chk)
#         pdf.set_xy(start_x + CHECKBOX_SIZE + 1.6, start_y - 1)
#         pdf.cell(text_w, LINE_H, lab, border=0, ln=0, align="L")
#     pdf.set_xy(x + w, y)
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


def make_pm_report_html_pdf_bytes(doc: dict) -> bytes:
    #data
    job = doc.get("job", {}) or {}
    station_name = job.get("station_name", "-")
    model = job.get("model", "-")
    sn = job.get("sn", "-")
    pm_date = _fmt_date_thai_like_sample(doc.get("pm_date", job.get("date", "-")))
    pm_date_th = _fmt_date_thai_full(doc.get("pm_date", job.get("date", "-")))
    issue_id = str(doc.get("issue_id", "-"))
    charger_no = doc.get("job", {}).get("chargerNo", "-")
    checks = _rows_to_checks(doc.get("rows") or {}, doc.get("measures") or {})
    
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
    pdf.set_font(base_font, "B", 13)
    pdf.set_fill_color(255, 230, 100)
    pdf.cell(page_w, TITLE_H, DOCUMENT_TITLE_POST, border=1, ln=1, align="C", fill=True)
    
    y += TITLE_H

    y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, model, sn, pm_date)

    # ========== ตารางรายการ ==========
    x_table = x0 + EDGE_ALIGN_FIX
    table_total_w = page_w - 2 * EDGE_ALIGN_FIX
    # pdf.set_line_width(LINE_W_INNER)
    # pdf.set_font(base_font, "", FONT_MAIN)

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
            # y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w, charger_no)
            # pdf.set_font(base_font, "", FONT_MAIN)

    y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w, charger_no)
    pdf.set_font(base_font, "", FONT_MAIN)
    
    # บันทึกจุดเริ่มต้นของตาราง rows (สำหรับวาดเส้นรอบนอก)
    y_table_start = y
    y_last_row_end = y  # บันทึกจุดสิ้นสุดของ row สุดท้ายบนหน้าแรก
    
    # ก่อนเริ่มลูป ให้คำนวณข้อมูลทั้งหมด เพื่อรู้ว่า row ไหนเป็นสุดท้าย
    checks_list = list(checks)

    # ========== วนลูปวาดแต่ละ item ==========
    for idx, it in enumerate(checks_list):
        text = str(it.get("text", ""))
        result = it.get("result", "na")
        remark = str(it.get("remark", "") or "")

        # --- คำนวณความสูง Item ---
        _, item_h = _split_lines(
            pdf, item_w - 2 * PADDING_X, text, LINE_H
        )

        # --- คำนวณความสูง Remark ---
        _, remark_h_raw = _split_lines(
            pdf, remark_w - 2 * PADDING_X, remark, LINE_H
        )

        remark_h = max(remark_h_raw + 2 * PADDING_Y, ROW_MIN_H)

        # --- หาเลขข้อจาก text (ปลอดภัยกว่าใช้ "10." in text) ---
        match_row = re.match(r"^(\d+)\.", text.strip())
        row_num = int(match_row.group(1)) if match_row else 0

        # --- กำหนดขั้นต่ำเฉพาะข้อ ---
        if row_num == 16:
            remark_h = max(remark_h, LINE_H * 6)
        elif row_num == 10:
            remark_h = max(remark_h, LINE_H * 3)

        # --- ความสูงจริงของ row ---
        row_h_eff = max(
            ROW_MIN_H,
            item_h,
            remark_h
        )

        _ensure_space(row_h_eff)

        # ---------- วาดตาราง ----------
        x = x_table

        _cell_text_in_box(
            pdf, x, y, item_w, row_h_eff, text,
            align="L", lh=LINE_H, valign="middle"
        )
        x += item_w

        _draw_result_cell(
            pdf, base_font, x, y, result_w, row_h_eff, result
        )
        x += result_w

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

    y_last_row_end = y + h_checklist
    
    # วาดเส้นกรอบนอกซ้ายขวา เชื่อมจาก Inspection Results ถึง ก่อน Signature Block
    page_bottom = pdf.h - pdf.b_margin - SIG_H
    pdf.line(comment_x, y_last_row_end, comment_x, page_bottom)  # Left border
    pdf.line(comment_x + comment_item_w + comment_result_w + comment_remark_w, y_last_row_end, 
             comment_x + comment_item_w + comment_result_w + comment_remark_w, page_bottom)  # Right border

    pdf.add_page()
    y = _draw_header(pdf, base_font, issue_id)
    
    # ตั้งค่า section = photos หลังจากหน้า checklist เสร็จสิ้น
    pdf._section = "photos"
    
    x_table = x0 + EDGE_ALIGN_FIX
    q_w = PHOTO_Q_W
    g_w = (page_w - 2 * EDGE_ALIGN_FIX) - q_w
    
    def _ensure_space_photo(height_needed: float):
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

    has_pre_photos = bool(doc.get("photos_pre"))

    # ===== ส่วนที่ 1: Pre-PM Photos (ถ้ามี) =====
    if has_pre_photos:
        pdf.set_xy(x0, y)
        pdf.set_font(base_font, "B", 13)
        pdf.set_fill_color(255, 230, 100)
        pdf.cell(page_w, TITLE_H, DOCUMENT_TITLE_PHOTO_PRE, border=1, ln=1, align="C", fill=True)
        y += TITLE_H

        y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)
        pdf.set_font(base_font, "", FONT_MAIN)
        
        for it in checks:
            idx = int(it.get("idx") or 0)
            
            if idx == 18:
                continue

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
    title_text = DOCUMENT_TITLE_PHOTO_POST if has_pre_photos else "Photos"
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


# -------------------- Photo helpers (ปรับใหม่) --------------------
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