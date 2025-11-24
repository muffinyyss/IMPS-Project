# backend/pdf/templates/pdf_ccb.py
from fpdf import FPDF, HTMLMixin
from pathlib import Path
from datetime import datetime, date
import os
import re
from typing import Optional, Tuple, List, Dict, Any, Union
from io import BytesIO
import base64

try:
    import requests  # optional
except Exception:
    requests = None

# -------------------- ตั้งค่าทั่วไป --------------------
DOCUMENT_TITLE_MAIN = "Preventive Maintenance Checklist - Communication Control Box (CCB)"
DOCUMENT_TITLE_PHOTO = "Preventive Maintenance Checklist - Communication Control Box (CCB)"
DOCUMENT_TITLE_PHOTO_CONT = "Photos - CCB (ต่อ)"

ORG_ADDRESS_LINES = [
    "Electricity Generating Authority of Thailand (EGAT)",
    "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand",
    "Call Center Tel. 02-114-3350",
]

PDF_DEBUG = os.getenv("PDF_DEBUG") == "1"

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

LINE_W_OUTER = 0.45
LINE_W_INNER = 0.22
PADDING_X = 2.0
PADDING_Y = 0.5
FONT_MAIN = 11.0
FONT_SMALL = 11.0
LINE_H = 5.0
ROW_MIN_H = 7
CHECKBOX_SIZE = 3.5

PHOTO_MAX_PER_ROW = 3
PHOTO_IMG_MAX_H = 48
PHOTO_GAP = 3
PHOTO_PAD_X = 2
PHOTO_PAD_Y = 4
PHOTO_ROW_MIN_H = 15
PHOTO_FONT_SMALL = 10
PHOTO_LINE_H = 6

# -------------------- รายการหัวข้อ CCB --------------------
ROW_TITLES = {
    "r1": "ตรวจสอบสภาพทั่วไป",
    "r2": "ตรวจสอบสภาพดักซีล, ซิลิโคนกันซึม",
    "r3": "ตรวจสอบระบบระบายอากาศ",
    "r3_sub1": "ตรวจสอบการทำงานอุปกรณ์ตั้งภูมิ",
    "r3_sub2": "ตรวจสอบการทำงานพัดลมระบายอากาศ",

    "r4": "ตรวจสอบระบบแสงสว่าง",
    "r4_sub1": "ตรวจสอบการทำงานของไฟส่องสว่างในสถานี",
    "r4_sub2": "ตรวจสอบการทำงานของป้ายไฟ / Logo",

    "r5": "ตรวจสอบระบบสำรองไฟฟ้า (UPS)",
    "r5_sub1": "เครื่องสามารถทำงานได้ตามปกติ",
    "r5_sub2": "เครื่องสามารถสำรองไฟได้ (>5นาที)",

    "r6": "ตรวจสอบระบบกล้องวงจรปิด (CCTV)",
    "r6_sub1": "ตรวจสอบสภาพทั่วไปของกล้องวงจรปิด",
    "r6_sub2": "ตรวจสอบสภาพทั่วไปเครื่องบันทึก (NVR)",
    "r6_sub3": "ตรวจสอบสถานะการใช้งาน",
    "r6_sub4": "ตรวจสอบมุมกล้อง",

    "r7": "ตรวจสอบเราเตอร์ (Router)",
    "r7_sub1": "ตรวจสอบสภาพทั่วไป",
    "r7_sub2": "ตรวจสอบสถานะการทำงาน",

    "r8": "ตรวจสอบตู้คอนซูเมอร์ยูนิต (Consumer Unit)",
    "r8_sub1": "ตรวจสอบสภาพทั่วไป",
    "r8_sub2": "ตรวจสอบจุดขันแน่น",

    "r9": "ตรวจสอบแรงดันไฟฟ้า (Consumer Unit)",
    "r9_sub1": "เมนเบรกเกอร์ (Main Breaker)",
    "r9_sub2": "เบรกเกอร์วงจรย่อยที่ 1",
    "r9_sub3": "เบรกเกอร์วงจรย่อยที่ 2",
    "r9_sub4": "เบรกเกอร์วงจรย่อยที่ 3",
    "r9_sub5": "เบรกเกอร์วงจรย่อยที่ 4",
    "r9_sub6": "เบรกเกอร์วงจรย่อยที่ 5",
}

# -------------------- PDF base class --------------------
class HTML2PDF(FPDF, HTMLMixin):
    pass


class ReportPDF(HTML2PDF):
    def footer(self):
        self.set_y(-12)
        try:
            self.set_font(self._base_font_name, "", 11)  # type: ignore[attr-defined]
        except Exception:
            self.set_font("Arial", "", 11)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", 0, 0, "R")


# -------------------- Utilities --------------------
def _log(msg: str):
    if PDF_DEBUG:
        print(msg)


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


# ---- text helpers ----
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


# -------------------- รูป/โลโก้ --------------------
def _resolve_logo_path() -> Optional[Path]:
    # 1) LOGO_PATH (absolute)
    p_env = os.getenv("LOGO_PATH")
    if p_env:
        p = Path(p_env)
        if p.exists():
            return p
    # 2) โฟลเดอร์ assets ใกล้ไฟล์
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


def _is_http_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")


_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".jfif"]


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
    """
    แยก /uploads/<type>/<station>/<docId>/<gN>/<filename>
    คืน (type, station, docId, group, filename) หรือ None
    """
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


def _pick_image_from_path(p: Path) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
    """
    รับ Path ที่อาจเป็นไฟล์/โฟลเดอร์/ไฟล์ไร้นามสกุล แล้วคืน (path_str_or_bytesIO, img_type)
    - ถ้าเป็นไฟล์: ใช้เลย
    - ถ้าไม่มีนามสกุล: ลองเติม _IMAGE_EXTS
    - ถ้าเป็นโฟลเดอร์: หารูปไฟล์แรกตามชื่อเรียง a→z
    """
    # 1) ถ้าเป็นไฟล์อยู่แล้ว
    if p.is_file():
        return p.as_posix(), _guess_img_type_from_ext(p.as_posix())

    # 2) ถ้าไม่มีนามสกุล ลองเติม
    if not p.suffix and p.parent.exists():
        for ext in _IMAGE_EXTS:
            cand = p.with_suffix(ext)
            if cand.exists() and cand.is_file():
                return cand.as_posix(), _guess_img_type_from_ext(cand.as_posix())

    # 3) ถ้าเป็นโฟลเดอร์: เลือกไฟล์รูปแรก
    if p.is_dir():
        for ext in _IMAGE_EXTS:
            files = sorted(p.glob(f"*{ext}"))
            for f in files:
                if f.is_file():
                    return f.as_posix(), _guess_img_type_from_ext(f.as_posix())

    return None, None


def _load_image_source_from_urlpath(
    url_path: str,
) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
    if not url_path:
        return None, None

    # ปรับ \ -> / ให้ทำงานข้าม OS
    url_path = url_path.replace("\\", "/")
    _log(f"[IMG] lookup: {url_path}")

    # 1) data URL
    if url_path.startswith("data:image/"):
        try:
            head, b64 = url_path.split(",", 1)
            mime = head.split(";")[0].split(":", 1)[1]
            bio = BytesIO(base64.b64decode(b64))
            img_type = (
                "PNG"
                if "png" in mime
                else ("JPEG" if ("jpeg" in mime or "jpg" in mime) else "")
            )
            return bio, img_type
        except Exception as e:
            _log(f"[IMG] data-url parse error: {e}")

    # 2) http(s)
    if _is_http_url(url_path) and requests is not None:
        try:
            resp = requests.get(url_path, headers=_env_photo_headers(), timeout=10)
            resp.raise_for_status()
            _log(f"[IMG] downloaded {len(resp.content)} bytes from absolute URL")
            return BytesIO(resp.content), _guess_img_type_from_ext(url_path)
        except Exception as e:
            _log(f"[IMG] absolute URL failed: {e}")

    def _try_pick_from(p: Path) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
        # รองรับทั้ง 'ไฟล์' และ 'โฟลเดอร์' (หยิบไฟล์รูปแรก)
        src, img_type = _pick_image_from_path(p)
        if src:
            _log(f"[IMG] using {src}")
            return src, img_type
        return None, None

    # 3) absolute filesystem path (D:/.../g1 หรือ D:/.../file.jpg)
    p_abs = Path(url_path)
    if p_abs.is_absolute() and p_abs.exists():
        src, img_type = _try_pick_from(p_abs)
        if src:
            return src, img_type

    # เตรียม uploads_root (รองรับ ENV override)
    uploads_root = _get_uploads_root()

    # 4) แมปเป็น <uploads_root>/<relative> ถ้าเริ่มด้วย /uploads/...
    clean_path = url_path.lstrip("/")
    if clean_path.startswith("uploads/"):
        local_path = uploads_root / clean_path[8:]  # ตัด 'uploads/' ทิ้ง
        _log(f"[IMG] try uploads (direct): {local_path}")
        src, img_type = _try_pick_from(local_path)
        if src:
            return src, img_type

    # 5) Fallback อัจฉริยะ: ถ้าเป็นรูปแบบ /uploads/<type>/<station>/<docId>/<gN>/<filename>
    parts = _split_upload_url_parts(url_path)
    if parts:
        type_part, station, doc_id, group, filename = parts
        # เผื่อกรณี group ไม่มีตัว g นำหน้า
        if not group.lower().startswith("g"):
            group = f"g{group}"

        base = uploads_root / type_part / station

        # 5.1 พยายามตาม doc_id ตรงก่อน (โฟลเดอร์ group หรือไฟล์)
        cand_group_dir = base / doc_id / group
        if cand_group_dir.exists():
            if filename:
                f1 = cand_group_dir / filename
                _log(f"[IMG] try exact file: {f1}")
                if f1.exists() and f1.is_file():
                    return f1.as_posix(), _guess_img_type_from_ext(f1.as_posix())
            # ถ้าไม่ระบุไฟล์/ไม่พบไฟล์ → หยิบรูปแรกในโฟลเดอร์ group
            src, img_type = _try_pick_from(cand_group_dir)
            if src:
                return src, img_type

        # 5.2 doc_id ไม่ตรง/ไม่มี — ค้นในทุก doc_id ใต้สถานีเดียวกัน
        if filename:
            # หาตามชื่อไฟล์ใน group เดียวกันก่อน
            pattern = base.glob(f"*/{group}/{filename}")
            for p in pattern:
                if p.is_file():
                    _log(f"[IMG] fallback found same filename: {p}")
                    return p.as_posix(), _guess_img_type_from_ext(p.as_posix())

        # 5.3 ยังไม่เจอไฟล์เดียวกัน → หยิบรูปอะไรก็ได้ใน group เดียวกัน (ตัวแรก)
        for ext in _IMAGE_EXTS:
            for p in base.glob(f"*/{group}/*{ext}"):
                if p.is_file():
                    _log(f"[IMG] fallback pick first in group: {p}")
                    return p.as_posix(), _guess_img_type_from_ext(p.as_posix())

    # 6) base_url download (กรณี path เป็น relative ของเว็บ)
    base_url = os.getenv("PHOTOS_BASE_URL") or os.getenv("APP_BASE_URL") or ""
    if base_url and requests is not None:
        full_url = base_url.rstrip("/") + "/" + url_path.lstrip("/")
        _log(f"[IMG] try base_url: {full_url}")
        try:
            resp = requests.get(full_url, headers=_env_photo_headers(), timeout=10)
            resp.raise_for_status()
            return BytesIO(resp.content), _guess_img_type_from_ext(full_url)
        except Exception as e:
            _log(f"[IMG] base_url failed: {e}")

    _log("[IMG] not found via all methods")
    return None, None


# -------------------- data helpers --------------------
def _r_idx(k: str) -> int:
    m = re.match(r"r(\d+)$", k.lower())
    return int(m.group(1)) if m else ""


def _format_voltage_measurement(measures: dict, key: str) -> str:
    """
    แปลงข้อมูลแรงดันไฟฟ้าให้เป็นรูปแบบหลายบรรทัด
    key เช่น "m4", "m5", "m6", "m7", "m8"
    รองรับทั้ง 10 คู่ (m4-m7) และ 3 คู่ (m8)
    """
    ms = (measures or {}).get(key) or {}
    if not ms:
        return ""

    # normalize key ภายใน เช่น เปลี่ยน L1-N → L1-N
    norm_ms = {}
    for k, v in ms.items():
        nk = str(k).strip().replace("–", "-").replace("-", "-").replace(" ", "")
        norm_ms[nk.upper()] = v

    # ลำดับมาตรฐาน 10 คู่
    order_full = [
        "L1-N",
        "L2-N",
        "L3-N",
        "L1-G",
        "L2-G",
        "L3-G",
        "L1-L2",
        "L2-L3",
        "L3-L1",
        "N-G",
    ]

    # ลำดับย่อ (บางกรณี เช่น m8)
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

    # ถ้ายังไม่มีค่า N-G ในข้อมูล ให้เพิ่มบรรทัด N-G = -
    if not any("N-G" in k for k in norm_ms.keys()):
        lines.append("N-G = -")

    return "\n".join(lines)


# def _rows_to_checks(rows: dict, measures: Optional[dict] = None) -> List[dict]:
#     """
#     แปลงข้อมูล rows → รายการแถวสำหรับตาราง
#     - รวม rN กับ rN_sub* เป็น 1 แถว
#     - text: หลายบรรทัด (บรรทัดแรกเป็นหัวข้อหลัก, บรรทัดต่อ ๆ ไปเป็นหัวข้อย่อยเยื้องเข้าไป)
#     - results: list ของผลในคอลัมน์ Result (1 บรรทัดต่อ 1 หัวข้อย่อย; ถ้าไม่มี sub ใช้ 1 บรรทัดจาก rN)
#     """
#     if not isinstance(rows, dict):
#         return []

#     rows = rows or {}
#     measures = measures or {}
#     items: List[dict] = []

#     SUB_INDENT = "\u00A0" * 4  # ใช้ NBSP เพื่อเยื้องหัวข้อย่อย

#     # วนเฉพาะ key หลัก r1, r2, r3 ... ตามลำดับใน ROW_TITLES
#     for main_key, main_title in ROW_TITLES.items():
#         m = re.match(r"^r(\d+)$", main_key)
#         if not m:
#             continue  # ข้าม rN_sub* ที่นี่ จะไปดึงทีหลัง
#         idx = int(m.group(1))

#         # รวม sub ของข้อ idx (เรียงตามหมายเลข sub)
#         subs: List[Tuple[int, str, str]] = []  # (order, key, title)
#         for k, stitle in ROW_TITLES.items():
#             m_sub = re.match(rf"^r{idx}_sub(\d+)$", k)
#             if m_sub:
#                 subs.append((int(m_sub.group(1)), k, stitle))
#         subs.sort(key=lambda x: x[0])

#         # ---------- ข้อความในคอลัมน์ Item ----------
#         lines: List[str] = [f"{idx}. {main_title}"]
#         for _, _, stitle in subs:
#             lines.append(f"{SUB_INDENT}{stitle}")
#         text = "\n".join(lines)

#         # ---------- ผลลัพธ์ในคอลัมน์ Result ----------
#         result_lines: List[str] = []
#         if subs:
#             # ใช้ pf ของหัวข้อย่อยเท่านั้น (เหมือนในฟอร์มตัวอย่าง)
#             for _, sub_key, _ in subs:
#                 data_sub = rows.get(sub_key) or {}
#                 result_lines.append(_norm_result(data_sub.get("pf", "")))
#         else:
#             # ไม่มี sub → ใช้ pf ของหัวข้อหลัก rN
#             data_main = rows.get(main_key) or {}
#             result_lines.append(_norm_result(data_main.get("pf", "")))

#         # ---------- Remark (รวม main + sub + มิเตอร์แรงดัน) ----------
#         remark_parts: List[str] = []

#         # ข้อ 4–9 : พ่วงข้อมูลวัดแรงดันไฟฟ้า
#         if main_key.lower() in ["r4", "r5", "r6", "r7", "r8", "r9"]:
#             measure_key = f"m{idx}"
#             voltage_text = _format_voltage_measurement(measures, measure_key)
#             if voltage_text:
#                 remark_parts.append(voltage_text)

#         # รวม remark ของ main + ทุก sub
#         related_keys = [main_key] + [sk for _, sk, _ in subs]
#         for k2 in related_keys:
#             d2 = rows.get(k2) or {}
#             rmk = (d2.get("remark") or "").strip()
#             if rmk:
#                 remark_parts.append(rmk)

#         remark = "\n\n".join(remark_parts) if remark_parts else ""

#         items.append(
#             {
#                 "idx": idx,
#                 "text": text,
#                 "results": result_lines,  # <-- หลายบรรทัด
#                 "remark": remark,
#             }
#         )

#     return items


def _rows_to_checks(rows: dict, measures: Optional[dict] = None) -> List[dict]:
    """
    แปลงข้อมูล rows → รายการแถวสำหรับตาราง
    - รวม rN กับ rN_sub* เป็น 1 แถว
    - text: หลายบรรทัด (บรรทัดแรกเป็นหัวข้อหลัก, บรรทัดต่อ ๆ ไปเป็นหัวข้อย่อยเยื้องเข้าไป)
    - results: list ของผลในคอลัมน์ Result (1 บรรทัดต่อ 1 หัวข้อย่อย; ถ้าไม่มี sub ใช้ 1 บรรทัดจาก rN)
    """
    if not isinstance(rows, dict):
        return []

    rows = rows or {}
    measures = measures or {}
    items: List[dict] = []

    SUB_INDENT = "\u00A0" * 4  # ใช้ NBSP เพื่อเยื้องหัวข้อย่อย

    # วนเฉพาะ key หลัก r1, r2, r3 ... ตามลำดับใน ROW_TITLES
    for main_key, main_title in ROW_TITLES.items():
        m = re.match(r"^r(\d+)$", main_key)
        if not m:
            continue  # ข้าม rN_sub* ที่นี่ จะไปดึงทีหลัง
        idx = int(m.group(1))

        # รวม sub ของข้อ idx (เรียงตามหมายเลข sub)
        subs: List[Tuple[int, str, str]] = []  # (order, key, title)
        for k, stitle in ROW_TITLES.items():
            m_sub = re.match(rf"^r{idx}_sub(\d+)$", k)
            if m_sub:
                subs.append((int(m_sub.group(1)), k, stitle))
        subs.sort(key=lambda x: x[0])

        # ---------- ข้อความในคอลัมน์ Item ----------
        lines: List[str] = [f"{idx}. {main_title}"]
        for _, _, stitle in subs:
            lines.append(f"{SUB_INDENT}{stitle}")
        text = "\n".join(lines)

        # ---------- ผลลัพธ์ในคอลัมน์ Result ----------
        result_lines: List[str] = []
        if subs:
            # ใช้ pf ของหัวข้อย่อยเท่านั้น (เหมือนในฟอร์มตัวอย่าง)
            for _, sub_key, _ in subs:
                data_sub = rows.get(sub_key) or {}
                result_lines.append(_norm_result(data_sub.get("pf", "")))
            result_offset = 1  # ข้ามบรรทัดหัวข้อหลัก 1 บรรทัด
        else:
            # ไม่มี sub → ใช้ pf ของหัวข้อหลัก rN
            data_main = rows.get(main_key) or {}
            result_lines.append(_norm_result(data_main.get("pf", "")))
            result_offset = 0

        # ---------- Remark (รวม main + sub + มิเตอร์แรงดัน) ----------
        remark_parts: List[str] = []

        # ข้อ 4–9 : พ่วงข้อมูลวัดแรงดันไฟฟ้า
        if main_key.lower() in ["r4", "r5", "r6", "r7", "r8", "r9"]:
            measure_key = f"m{idx}"
            voltage_text = _format_voltage_measurement(measures, measure_key)
            if voltage_text:
                remark_parts.append(voltage_text)

        # รวม remark ของ main + ทุก sub
        related_keys = [main_key] + [sk for _, sk, _ in subs]
        for k2 in related_keys:
            d2 = rows.get(k2) or {}
            rmk = (d2.get("remark") or "").strip()
            if rmk:
                remark_parts.append(rmk)

        remark = "\n\n".join(remark_parts) if remark_parts else ""

        items.append(
            {
                "idx": idx,
                "text": text,
                "results": result_lines,      # หลายบรรทัด
                "remark": remark,
                "result_offset": result_offset,  # <-- บอกว่าให้เริ่มวาดหลังหัวข้อหลักกี่บรรทัด
            }
        )

    return items




def _get_photo_items_for_idx(doc: dict, idx: int) -> List[dict]:
    """
    อ่านรูปจาก doc["photos"]["g{idx}"]
    - ถ้า 'url' เป็นโฟลเดอร์: แตกเป็นไฟล์รูปย่อย (มากสุด PHOTO_MAX_PER_ROW)
    - ถ้า 'url' เป็นไฟล์: ใช้ตามนั้น
    - รองรับทั้ง absolute และ relative (under backend/uploads)
    """
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


def _build_photo_rows_grouped(row_titles: dict) -> List[dict]:
    grouped: List[dict] = []

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

        for _, stitle in subs:
            # ลบจุด . ที่นำหน้าข้อความออก (เช่น ". xxx" → "xxx")
            clean_stitle = re.sub(r"^\s*\.\s*", "", str(stitle))
            lines.append(f" {clean_stitle}")

        grouped.append({"idx": idx, "text": "\n".join(lines)})

    return grouped



# -------------------- วาดชิ้นส่วนเอกสาร --------------------
def _draw_check(pdf: FPDF, x: float, y: float, size: float, checked: bool):
    pdf.rect(x, y, size, size)
    if checked:
        lw_old = pdf.line_width
        pdf.set_line_width(0.6)
        pdf.line(x + 0.7, y + size * 0.55, x + size * 0.40, y + size - 0.7)
        pdf.line(x + size * 0.40, y + size - 0.7, x + size - 0.7, y + 0.7)
        pdf.set_line_width(lw_old)


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
        except Exception as e:
            _log(f"[LOGO] place error: {e}")

    # กล่องกลาง: ที่อยู่
    box_x = x0 + col_left
    pdf.rect(box_x, y_top, col_mid, h_all)
    pdf.set_font(base_font, "B", FONT_MAIN)
    line_h = 6.2
    start_y = y_top + (h_all - line_h * len(ORG_ADDRESS_LINES)) / 2
    for i, line in enumerate(ORG_ADDRESS_LINES):
        pdf.set_xy(box_x + 3, start_y + i * line_h)
        pdf.cell(col_mid - 6, line_h, line, align="C")

    # กล่องขวา (Page / Issue)
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_right_top)
    pdf.rect(xr, y_top + h_right_top, col_right, h_all - h_right_top)

    # Page (บนขวา)
    pdf.set_xy(xr, y_top + 4)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.cell(col_right, 6, f"Page {pdf.page_no()}", align="C")

    # Issue ID
    pdf.set_xy(xr, y_top + h_right_top + (h_all - h_right_top) / 2 - 5)
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
    group_title: str = "Communication Control Box (CCB)",
):
    header_h = 9.0
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "B", FONT_MAIN)

    # แถวหัวตาราง
    pdf.set_xy(x, y)
    pdf.cell(item_w, header_h, "Item", border=1, align="C")
    pdf.cell(result_w, header_h, "Result", border=1, align="C")
    pdf.cell(remark_w, header_h, "Remark", border=1, ln=1, align="C")
    y += header_h

    # แถบชื่อกลุ่ม
    pdf.set_fill_color(255, 230, 100)
    pdf.set_xy(x, y)
    pdf.set_font(base_font, "B", FONT_MAIN)
    # pdf.cell(
    #     item_w + result_w + remark_w,
    #     8,
    #     group_title,
    #     border=1,
    #     ln=1,
    #     align="C",
    #     fill=True,
    # )
    return y


# def _draw_result_cell(
#     pdf: FPDF, base_font: str, x: float, y: float, w: float, h: float, result: str
# ):
#     pdf.rect(x, y, w, h)
#     col_w = w / 3.0
#     labels = [
#         ("Pass", result == "pass"),
#         ("Fail", result == "fail"),
#         ("N/A", result == "na"),
#     ]
#     pdf.set_font(base_font, "", FONT_SMALL)
#     for i, (lab, chk) in enumerate(labels):
#         sx = x + i * col_w
#         if i > 0:
#             pdf.line(sx, y, sx, y + h)
#         text_w = pdf.get_string_width(lab)
#         content_w = CHECKBOX_SIZE + 1.6 + text_w
#         start_x = sx + (col_w - content_w) / 2.0
#         start_y = y + (h - CHECKBOX_SIZE) / 2.0
#         _draw_check(pdf, start_x, start_y, CHECKBOX_SIZE, chk)
#         pdf.set_xy(start_x + CHECKBOX_SIZE + 1.6, y + (h - LINE_H) / 2.0)
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
    offset_lines: int = 0,   # จำนวนบรรทัดที่ต้องข้าม (เช่น 1 บรรทัดหัวข้อหลัก)
):
    """
    วาดช่อง Result แบบ 3 คอลัมน์ (Pass / Fail / N/A)
    - รองรับหลายบรรทัด (เช่น มี 2 หัวข้อย่อย → วาด 2 แถวของกลุ่ม Pass/Fail/N/A)
    - จัดตำแหน่งบรรทัดให้ตรงกับบรรทัดข้อความ (ใช้ offset_lines เพื่อข้ามหัวข้อหลัก)
    """
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
        line_y = base_y + row_idx * LINE_H

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
    _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)
    img_h = PHOTO_IMG_MAX_H
    row_h = max(ROW_MIN_H, text_h, img_h + 2 * PADDING_Y)

    # ข้อ/คำถาม
    _cell_text_in_box(
        pdf, x, y, q_w, row_h, question_text, align="L", lh=LINE_H, valign="top"
    )

    # รูป
    gx = x + q_w
    pdf.rect(gx, y, g_w, row_h)
    slot_w = (
        g_w - 2 * PADDING_X - (PHOTO_MAX_PER_ROW - 1) * PHOTO_GAP
    ) / PHOTO_MAX_PER_ROW
    cx = gx + PADDING_X
    cy = y + (row_h - img_h) / 2.0

    for i in range(PHOTO_MAX_PER_ROW):
        if i > 0:
            pdf.line(cx - PHOTO_GAP / 2, y, cx - PHOTO_GAP / 2, y + row_h)
        if i < len(image_items):
            url_path = image_items[i].get("url", "")
            src, img_type = _load_image_source_from_urlpath(url_path)
            if src:
                try:
                    pdf.image(
                        src, x=cx, y=cy, w=slot_w, h=img_h, type=img_type or None
                    )
                except Exception as e:
                    _log(f"[IMG] place error: {e}")
                    pdf.set_xy(cx, cy + (img_h - LINE_H) / 2)
                    pdf.cell(slot_w, LINE_H, "-", border=0, align="C")
            else:
                _log(f"[IMG] not found: {url_path}")
                pdf.set_xy(cx, cy + (img_h - LINE_H) / 2)
                pdf.cell(slot_w, LINE_H, "-", border=0, align="C")
        cx += slot_w + PHOTO_GAP

    pdf.set_xy(x + q_w + g_w, y)
    return row_h


# -------------------- ส่วนบล็อคข้อมูลงาน/สรุป/ลายเซ็น --------------------
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

    # ใส่ Station และ PM Date อยู่แถวเดียวกัน คนละคอลัมน์
    _item(x, y, "Station", station_name)
    _item(x + col_w, y, "PM Date", pm_date)

    return y + box_h



# -------------------- สร้างเอกสาร --------------------
def _output_pdf_bytes(pdf: FPDF) -> bytes:
    data = pdf.output(dest="S")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    return data.encode("latin1")


def _build_photo_questions(row_titles: dict) -> List[dict]:
    """
    สร้างรายการคำถามสำหรับหน้า Photos โดย
    - แสดงเฉพาะหัวข้อหลัก r{n}
    - รวมหัวข้อย่อย r{n}_sub* ต่อท้ายในช่องเดียวกัน (คนละบรรทัด)
    """
    out: List[dict] = []
    # ใช้ลำดับตามการประกาศใน ROW_TITLES
    for key, title in row_titles.items():
        m = re.match(r"^r(\d+)$", key)
        if not m:
            continue
        idx = int(m.group(1))
        lines = [f"{idx}. {title}"]
        # รวมทุก sub ของหัวข้อนี้ (ถ้ามี) ตามลำดับที่ประกาศไว้
        for sk, st in row_titles.items():
            if sk.startswith(f"r{idx}_sub"):
                lines.append(f" {st}")
        out.append({"idx": idx, "text": "\n".join(lines)})
    return out


def make_mdb_pm_pdf_bytes(doc: dict) -> bytes:
    pdf = ReportPDF(unit="mm", format="A4")
    pdf.alias_nb_pages()  # ให้รองรับ {nb} ใน footer

    # margins / font
    pdf.set_margins(left=10, top=10, right=10)
    pdf.set_auto_page_break(auto=True, margin=12)

    base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
    setattr(pdf, "_base_font_name", base_font)  # เก็บไว้ใช้ใน footer
    pdf.set_font(base_font, size=FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)

    job = doc.get("job", {}) or {}
    station_name = job.get("station_name", "-")
    # model = job.get("model", "-")
    # sn = job.get("sn", "-")
    pm_date = _fmt_date_thai_like_sample(doc.get("pm_date", job.get("date", "-")))
    issue_id = str(doc.get("issue_id", "-"))

    checks = _rows_to_checks(doc.get("rows") or {}, doc.get("measures") or {})

    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left
    EDGE_ALIGN_FIX = (LINE_W_OUTER - LINE_W_INNER) / 2.0

    # หน้าแรก
    pdf.add_page()
    y = _draw_header(pdf, base_font, issue_id)

    # ชื่อเอกสาร (ให้เหมือน pdf_mdb: มี fill สีเหลือง)
    pdf.set_xy(x0, y)
    pdf.set_fill_color(255, 230, 100)
    pdf.set_font(base_font, "B", 16)
    pdf.cell(page_w, 10, DOCUMENT_TITLE_MAIN, border=1, ln=1, align="C", fill=True)
    y += 10

    # ข้อมูลงาน
    y = _draw_job_info_block(
        pdf, base_font, x0, y, page_w, station_name, pm_date
    )

    # ตารางรายการตรวจสอบ
    x_table = x0 + EDGE_ALIGN_FIX
    table_total_w = page_w - 2 * EDGE_ALIGN_FIX
    item_w = 65
    result_w = 64
    remark_w = page_w - item_w - result_w

    def _ensure_space(height_needed: float):
        nonlocal y
        if y + height_needed > (pdf.h - pdf.b_margin):
            pdf.add_page()
            y = _draw_header(pdf, base_font, issue_id)
            y = _draw_items_table_header(
                pdf,
                base_font,
                x_table,
                y,
                item_w,
                result_w,
                remark_w,
                group_title=doc.get("groupTitle", "Communication Control Box (CCB)"),
            )
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
        group_title=doc.get("groupTitle", "Communication Control Box (CCB)"),
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

        # คำนวนความสูงแต่ละส่วน
        item_lines, item_h = _split_lines(pdf, item_w - 2 * PADDING_X, text, LINE_H)
        _, remark_h = _split_lines(pdf, remark_w - 2 * PADDING_X, remark, LINE_H)

        # (ตรรกะเดิมคงไว้)
        is_row_3 = "3." in text
        is_row_4 = "4." in text
        is_row_5 = "5." in text
        is_row_6 = "6." in text
        is_row_7 = "7." in text
        is_row_8 = "8." in text
        is_row_9 = "9." in text

        if is_row_3 or is_row_4 or is_row_5 or is_row_7 or is_row_8:
            remark_h = max(remark_h, LINE_H * 4)
        elif is_row_6:
            remark_h = max(remark_h, LINE_H * 6)

        result_block_h = max(ROW_MIN_H, len(result_lines) * LINE_H)
        row_h_eff = max(ROW_MIN_H, item_h, remark_h, result_block_h)

        _ensure_space(row_h_eff)

        x = x_table
        # ✅ ให้ Item ชิดบน ไม่จัดกลาง เพื่อให้บรรทัดเท่ากัน
        _cell_text_in_box(pdf, x, y, item_w, row_h_eff, text,
                          align="L", lh=LINE_H, valign="top")
        x += item_w

        # ✅ ส่ง offset เข้าไปให้ช่อง Result
        _draw_result_cell(pdf, base_font, x, y, result_w, row_h_eff,
                          result_lines, offset_lines=result_offset)
        x += result_w

        _cell_text_in_box(
            pdf, x, y, remark_w, row_h_eff, remark,
            align="L", lh=LINE_H, valign="top"
        )

        y += row_h_eff




    # Comment & Summary + เซ็นชื่อ (ให้เหมือน pdf_mdb)
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_draw_color(0, 0, 0)

    comment_x = x_table
    comment_item_w = item_w
    comment_result_w = result_w
    comment_remark_w = remark_w

    h_comment = 16
    h_checklist = 12
    total_h = h_comment + h_checklist

    # ✅ ตรวจสอบพื้นที่ก่อนวาด block นี้
    _ensure_space(total_h + 5)

    # กรอบนอก
    pdf.rect(comment_x, y, item_w + result_w + remark_w, total_h)

    # แถว Comment
    pdf.set_font(base_font, "B", 13)
    pdf.set_xy(comment_x, y)
    pdf.cell(comment_item_w, h_comment, "Comment :", border=0, align="L")

    # เส้นคั่นระหว่าง label กับช่องข้อความ
    pdf.line(comment_x + comment_item_w, y, comment_x + comment_item_w, y + h_comment)

    # ช่องข้อความ comment (ใช้ _cell_text_in_box เหมือน pdf_mdb)
    pdf.set_font(base_font, "", 13)
    comment_text = str(doc.get("summary", "") or "-")
    comment_text_x = comment_x + comment_item_w
    _cell_text_in_box(
        pdf,
        comment_text_x,
        y,
        comment_result_w + comment_remark_w,
        h_comment,
        comment_text,
        align="L",
        lh=LINE_H,
        valign="top",
    )

    y += h_comment

    # เส้นคั่นระหว่าง Comment กับ ผลการตรวจสอบ
    pdf.line(comment_x, y, comment_x + item_w + result_w + remark_w, y)

    # แถวผลการตรวจสอบ
    summary_check = str(doc.get("summaryCheck", "")).strip().upper() or "-"

    pdf.set_xy(comment_x, y)
    pdf.set_font(base_font, "B", 13)
    pdf.cell(comment_item_w, h_checklist, "ผลการตรวจสอบ :", border=0, align="L")

    # เส้นคั่นแนวตั้ง
    pdf.line(comment_x + comment_item_w, y, comment_x + comment_item_w, y + h_checklist)

    # วาด checkbox
    pdf.set_font(base_font, "", 13)
    x_check_start = comment_x + comment_item_w + 10
    y_check = y + (h_checklist - CHECKBOX_SIZE) / 2.0
    gap = 35
    options = [
        ("Pass", summary_check == "PASS"),
        ("Fail", summary_check == "FAIL"),
        ("N/A", summary_check == "N/A"),
    ]
    for i, (label, checked) in enumerate(options):
        x_box = x_check_start + i * gap
        _draw_check(pdf, x_box, y_check, CHECKBOX_SIZE + 0.5, checked)
        pdf.set_xy(x_box + CHECKBOX_SIZE + 3, y_check - 1)
        pdf.cell(20, LINE_H + 1, label, ln=0, align="L")

    y += h_checklist

    # พื้นที่ลายเซ็น
    signer_labels = ["Performed by", "Approved by", "Witnessed by"]
    col_widths = [item_w, result_w, remark_w]
    row_h_header = 12
    row_h_sig = 16
    row_h_name = 7
    row_h_date = 7
    total_sig_h = row_h_header + row_h_sig + row_h_name + row_h_date

    def _ensure_space_sign(height_needed: float):
        nonlocal y
        if y + height_needed > (pdf.h - pdf.b_margin):
            pdf.add_page()
            y = _draw_header(pdf, base_font, issue_id)

    _ensure_space_sign(total_sig_h + 5)

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
        pdf.cell(
            col_widths[i] - margin_left, row_h_date, date_text, border=0, align="L"
        )
        x_pos += col_widths[i]
    y += row_h_date

    # ------------------------------- หน้าใหม่: รูป -------------------------------
    pdf.add_page()
    y = _draw_header(pdf, base_font, issue_id)

    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 16)
    pdf.cell(page_w, 10, DOCUMENT_TITLE_PHOTO, border=1, ln=1, align="C")
    y += 10

    y = _draw_job_info_block(
        pdf, base_font, x0, y, page_w, station_name, pm_date
    )

    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 14)
    pdf.set_fill_color(255, 230, 100)
    pdf.cell(page_w, 10, "Photos", border=1, ln=1, align="C", fill=True)
    y += 10

    x_table = x0 + EDGE_ALIGN_FIX
    q_w = 85.0
    g_w = (page_w - 2 * EDGE_ALIGN_FIX) - q_w

    def _ensure_space_photo(height_needed: float):
        nonlocal y
        if y + height_needed > (pdf.h - pdf.b_margin):
            pdf.add_page()
            y = _draw_header(pdf, base_font, issue_id)
            pdf.set_xy(x0, y)
            pdf.set_font(base_font, "B", 14)
            pdf.set_fill_color(255, 230, 100)
            pdf.cell(
                page_w,
                10,
                DOCUMENT_TITLE_PHOTO_CONT,
                border=1,
                ln=1,
                align="C",
                fill=True,
            )
            y += 10
            y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)

    y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)
    pdf.set_font(base_font, "", FONT_MAIN)

    # ✅ ใช้รายการที่รวม sub ภายใต้หัวข้อหลักแล้ว
    photo_rows = _build_photo_rows_grouped(ROW_TITLES)

    for pr in photo_rows:
        idx = pr["idx"]  # ใช้รูปจาก photos.g{idx}
        question_text = pr["text"]  # มีบรรทัดย่อยรวมอยู่ในข้อความแล้ว
        img_items = _get_photo_items_for_idx(doc, idx)

        _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)
        est_row_h = max(ROW_MIN_H, text_h, PHOTO_IMG_MAX_H + 2 * PADDING_Y)
        _ensure_space_photo(est_row_h)

        row_h_used = _draw_photos_row(
            pdf, base_font, x_table, y, q_w, g_w, question_text, img_items
        )
        y += row_h_used

    return _output_pdf_bytes(pdf)


# -------------------- Public API --------------------
def generate_pdf(data: dict) -> bytes:
    return make_mdb_pm_pdf_bytes(data)
