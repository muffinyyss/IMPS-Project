# backend/pdf/templates/pdf_cm.py
import os
import re
import math

from fpdf import FPDF, HTMLMixin
from pathlib import Path
from datetime import datetime, date
from typing import Optional, Tuple, List, Dict, Any, Union
from io import BytesIO

try:
    from PIL import Image, ExifTags
except Exception:
    Image = None
    ExifTags = None

try:
    import requests
except Exception:
    requests = None

PDF_DEBUG = os.getenv("PDF_DEBUG") == "1"

# -------------------- Fonts TH --------------------
FONT_CANDIDATES: Dict[str, List[str]] = {
    "":  ["THSarabunNew.ttf", "TH Sarabun New.ttf", "THSarabun.ttf", "TH SarabunPSK.ttf"],
    "B": ["THSarabunNew-Bold.ttf", "THSarabunNew Bold.ttf", "TH Sarabun New Bold.ttf", "THSarabun Bold.ttf"],
    "I": ["THSarabunNew-Italic.ttf", "THSarabunNew Italic.ttf", "TH Sarabun New Italic.ttf", "THSarabun Italic.ttf"],
    "BI":["THSarabunNew-BoldItalic.ttf", "THSarabunNew BoldItalic.ttf", "TH Sarabun New BoldItalic.ttf", "THSarabun BoldItalic.ttf"],
}


# -------------------- Layout constants --------------------
LINE_W_OUTER = 0.45
LINE_W_INNER = 0.22
PADDING_X = 2.0
PADDING_Y = 0.5
FONT_MAIN = 11.0
FONT_SMALL = 10.0
FONT_TITLE = 13.0
LINE_H = 5.0
ROW_MIN_H = 7
TITLE_H = 6.0
SIG_H = 28
SECTION_BAR_H = 5.5
EDGE_ALIGN_FIX = (LINE_W_OUTER - LINE_W_INNER) / 2.0

# Title bar color (yellow) – ให้สีเดียวกับไฟล์ตัวอย่างอื่น
TITLE_BG = (255, 230, 100)


# -------------------- Utilities --------------------
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


def _fmt_date_thai_full(val) -> str:
    """แปลงวันที่เป็นรูปแบบ DD/MM/YYYY (ปีพุทธศักราช)"""
    if isinstance(val, (datetime, date)):
        d = datetime(val.year, val.month, val.day)
    else:
        d = _parse_date_flex(str(val)) if val is not None else None
    if not d:
        return str(val) if val else "-"
    year_be = d.year + 543
    return d.strftime(f"%d/%m/{year_be}")


# -------------------- Font loader --------------------
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


# -------------------- Text layout helpers --------------------
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
    align: str = "L",
    lh: float = LINE_H,
    valign: str = "middle",
    draw_border: bool = True,
):
    """วาดข้อความใน box โดยตัดคำอัตโนมัติและรองรับ multi-line"""
    if draw_border:
        pdf.rect(x, y, w, h)
    inner_x = x + PADDING_X
    inner_w = w - 2 * PADDING_X
    text = "" if text is None else str(text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    def _wrap_paragraph(paragraph: str) -> List[str]:
        leading_spaces = ""
        stripped = paragraph.lstrip(" ")
        if len(paragraph) > len(stripped):
            leading_spaces = paragraph[:len(paragraph) - len(stripped)]

        # hanging indent สำหรับ pattern "xxx: yyy"
        hanging_indent = ""
        if re.match(r"^(.*?):\s+", stripped):
            hanging_indent = leading_spaces

        words = stripped.split(" ")
        lines, cur = [], ""
        first_line = True

        for wd in words:
            candidate = wd if not cur else (cur + " " + wd)
            current_indent = leading_spaces if first_line else hanging_indent
            if pdf.get_string_width(current_indent + candidate) <= inner_w:
                cur = candidate
            else:
                if cur:
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
                            k <= len(buf)
                            and pdf.get_string_width(current_indent + buf[:k]) <= inner_w
                        ):
                            k += 1
                        lines.append(current_indent + buf[: k - 1])
                        first_line = False
                        buf = buf[k - 1:]
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
    else:
        start_y = y + max((h - content_h) / 2.0, PADDING_Y)

    cur_y = start_y
    for ln in lines:
        if cur_y > y + h - lh:
            break
        pdf.set_xy(inner_x, cur_y)
        pdf.cell(inner_w, lh, ln, border=0, ln=1, align=align)
        cur_y += lh
    pdf.set_xy(x + w, y)


# -------------------- Logo / Image helpers --------------------
def _resolve_logo_path() -> Optional[Path]:
    names = [
        "logo_egat.png", "logo_egatev.png", "logo_egat_ev.png",
        "egat_logo.png", "logo-ct.png", "logo_ct.png",
        "logo_egat.jpg", "logo_egat.jpeg",
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


def _load_image_source_from_urlpath(
    url_path: str,
) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
    if not url_path:
        return None, None

    if not url_path.startswith("https"):
        backend_root = Path(__file__).resolve().parents[2]
        uploads_root = backend_root / "uploads"

        if uploads_root.exists():
            clean_path = url_path.lstrip("/")
            if clean_path.startswith("uploads/"):
                clean_path = clean_path[8:]

            local_path = uploads_root / clean_path
            if local_path.exists() and local_path.is_file():
                return local_path.as_posix(), _guess_img_type_from_ext(local_path.as_posix())

    base_url = os.getenv("PHOTOS_BASE_URL") or os.getenv("APP_BASE_URL") or ""
    if base_url and requests is not None:
        full_url = base_url.rstrip("/") + "/" + url_path.lstrip("/")
        try:
            resp = requests.get(full_url, timeout=10)
            resp.raise_for_status()
            bio = BytesIO(resp.content)
            return bio, _guess_img_type_from_ext(full_url)
        except Exception:
            pass

    return None, None


def load_image_autorotate(path_or_bytes) -> Optional[BytesIO]:
    """โหลดรูปและแก้ EXIF orientation"""
    if Image is None:
        return None
    try:
        if isinstance(path_or_bytes, (str, Path)):
            img = Image.open(path_or_bytes)
        elif isinstance(path_or_bytes, BytesIO):
            path_or_bytes.seek(0)
            img = Image.open(path_or_bytes)
        else:
            img = Image.open(BytesIO(path_or_bytes))

        try:
            exif = img._getexif()
            if exif is not None and ExifTags is not None:
                orientation_key = None
                for tag, value in ExifTags.TAGS.items():
                    if value == "Orientation":
                        orientation_key = tag
                        break
                if orientation_key is not None:
                    orientation = exif.get(orientation_key)
                    if orientation == 3:
                        img = img.rotate(180, expand=True)
                    elif orientation == 6:
                        img = img.rotate(270, expand=True)
                    elif orientation == 8:
                        img = img.rotate(90, expand=True)
        except Exception:
            pass

        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85)
        buf.seek(0)
        return buf
    except Exception as e:
        _log(f"[IMG] autorotate error: {e}")
        return None


_IMAGE_CACHE: Dict[str, Tuple[BytesIO, str]] = {}


def _load_image_with_cache(url_path: str) -> Tuple[Optional[BytesIO], Optional[str]]:
    if not url_path:
        return None, None

    if url_path in _IMAGE_CACHE:
        cached_buf, cached_type = _IMAGE_CACHE[url_path]
        new_buf = BytesIO(cached_buf.getvalue())
        new_buf.seek(0)
        return new_buf, cached_type

    src, img_type = _load_image_source_from_urlpath(url_path)
    if src is None:
        return None, None

    img_buf = load_image_autorotate(src)
    if img_buf is None:
        return None, None

    _IMAGE_CACHE[url_path] = (img_buf, "JPEG")
    new_buf = BytesIO(img_buf.getvalue())
    new_buf.seek(0)
    return new_buf, "JPEG"


# -------------------- PDF output helper --------------------
def _output_pdf_bytes(pdf: FPDF) -> bytes:
    data = pdf.output(dest="S")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    return data.encode("latin1")


# -------------------- PDF base class --------------------
class HTML2PDF(FPDF, HTMLMixin):
    pass


# -------------------- Header --------------------
def _draw_header(
    pdf: FPDF,
    base_font: str,
    issue_id: str = "-",
    doc_name: str = "-",
    label_page: str = "หน้า",
    label_issue_id: str = "เลขที่เอกสาร",
    label_doc_name: str = "ชื่อเอกสาร",
    addr_line1: str = "การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)",
    addr_line2: str = "เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย จังหวัดนนทบุรี 11130",
    addr_line3: str = "ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416",
) -> float:
    """วาด Header เอกสาร: โลโก้ / ที่อยู่ / เลขที่เอกสาร / ชื่อเอกสาร"""
    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left
    y_top = 10

    col_left, col_mid = 35, 120
    col_right = page_w - col_left - col_mid

    h_all = 22
    h_right_half = h_all / 2

    pdf.set_line_width(LINE_W_INNER)

    # Page number
    page_text = f"{label_page} {pdf.page_no()}"
    pdf.set_font(base_font, "", FONT_MAIN - 1)
    page_text_w = pdf.get_string_width(page_text) + 4
    page_x = pdf.w - right - page_text_w
    pdf.set_xy(page_x, 5)
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

    # กล่องขวาบน - Issue ID
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_right_half)
    pdf.set_xy(xr, y_top + 1)
    pdf.set_font(base_font, "B", FONT_MAIN - 2)
    pdf.multi_cell(col_right, 4.5, f"{label_issue_id}\n{issue_id}", align="C")

    # กล่องขวาล่าง - Doc Name
    pdf.rect(xr, y_top + h_right_half, col_right, h_right_half)
    pdf.set_xy(xr, y_top + h_right_half + 1)
    pdf.set_font(base_font, "B", FONT_MAIN - 2)
    pdf.multi_cell(col_right, 4.5, f"{label_doc_name}\n{doc_name}", align="C")

    return y_top + h_all


# -------------------- Title bar (ชื่อเอกสาร) --------------------
def _draw_title_bar(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    title_th: str = "ใบแจ้งซ่อมบำรุง",
    title_en: str = "CORRECTIVE MAINTENANCE REPORT",
) -> float:
    """วาด title bar สีเหลืองด้านบน – 2 บรรทัด TH/EN"""
    bar_h = TITLE_H * 2
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_fill_color(*TITLE_BG)
    pdf.rect(x, y, w, bar_h, style="FD")

    pdf.set_font(base_font, "B", FONT_TITLE)
    pdf.set_xy(x, y + 0.5)
    pdf.cell(w, TITLE_H, title_th, border=0, align="C")

    pdf.set_font(base_font, "B", FONT_MAIN - 1)
    pdf.set_xy(x, y + TITLE_H - 0.5)
    pdf.cell(w, TITLE_H, title_en, border=0, align="C")

    return y + bar_h


# -------------------- Info block (key-value table) --------------------
def _draw_info_block(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    data: List[Tuple[str, str]],
    cols: int = 2,
    label_w: float = 38,
    row_h: float = 6.5,
    draw_outer: bool = True,
) -> float:
    """วาด block ข้อมูลแบบ label | value มีกรอบและเส้นแบ่ง
    cols=1 → ข้อมูลเต็มความกว้างต่อแถว
    cols=2 → แบ่งเป็น 2 คอลัมน์ข้างกัน
    draw_outer → วาดกรอบรอบนอก (ปิดได้เมื่ออยู่ภายใน group box)
    """
    total_rows = math.ceil(len(data) / cols)
    box_h = total_rows * row_h
    col_w = w / cols

    pdf.set_line_width(LINE_W_INNER)
    if draw_outer:
        pdf.rect(x, y, w, box_h)

    # เส้นแนวตั้งกลาง (ถ้ามีหลายคอลัมน์)
    for c in range(1, cols):
        pdf.line(x + c * col_w, y, x + c * col_w, y + box_h)

    # เส้นแบ่งแถว
    for r in range(1, total_rows):
        pdf.line(x, y + r * row_h, x + w, y + r * row_h)

    # เส้นแบ่ง label|value แต่ละ cell
    for r in range(total_rows):
        for c in range(cols):
            pdf.line(
                x + c * col_w + label_w, y + r * row_h,
                x + c * col_w + label_w, y + (r + 1) * row_h,
            )

    # เติมข้อความ
    for i, (label, value) in enumerate(data):
        r = i // cols
        c = i % cols
        cx = x + c * col_w
        cy = y + r * row_h

        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.set_xy(cx + PADDING_X, cy + (row_h - LINE_H) / 2.0)
        pdf.cell(label_w - 2 * PADDING_X, LINE_H, str(label or ""), border=0, align="L")

        pdf.set_font(base_font, "", FONT_MAIN)
        val_str = "-" if value in (None, "", "-") else str(value)
        pdf.set_xy(cx + label_w + PADDING_X, cy + (row_h - LINE_H) / 2.0)
        pdf.cell(col_w - label_w - 2 * PADDING_X, LINE_H, val_str, border=0, align="L")

    return y + box_h


# -------------------- Text block (label + content, auto height) --------------------
def _draw_text_block(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    label: str,
    text: str,
    min_h: float = 10.0,
    draw_outer: bool = True,
) -> float:
    """วาดกล่องพร้อม label ด้านบนและเนื้อหาด้านล่าง ปรับความสูงตามเนื้อหาอัตโนมัติ
    draw_outer → วาดกรอบรอบนอกของ content box (ปิดได้เมื่ออยู่ภายใน group box)
    """
    label_h = 6.0
    text_str = "-" if text in (None, "", "-") else str(text)

    # คำนวณความสูงเนื้อหา
    _, raw_h = _split_lines(pdf, w - 2 * PADDING_X, text_str, LINE_H)
    content_h = max(min_h, raw_h + 2 * PADDING_Y)

    pdf.set_line_width(LINE_W_INNER)

    # แถบ label
    pdf.set_fill_color(245, 245, 245)
    pdf.rect(x, y, w, label_h, style="FD")
    pdf.set_xy(x + PADDING_X, y + 0.4)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(w - 2 * PADDING_X, label_h - 0.8, label, border=0, align="L")

    # กล่องเนื้อหา
    pdf.set_font(base_font, "", FONT_MAIN)
    _cell_text_in_box(
        pdf, x, y + label_h, w, content_h,
        text_str, align="L", lh=LINE_H, valign="top",
        draw_border=draw_outer,
    )

    return y + label_h + content_h


# -------------------- Section group (รวมทุกส่วนในหมวดไว้ในกรอบเดียว) --------------------
def _measure_part_height(
    pdf: FPDF,
    w: float,
    part: Dict[str, Any],
) -> float:
    """คำนวณความสูงของ part หนึ่งชิ้นโดยไม่ต้องวาดจริง"""
    kind = part.get("kind")
    if kind == "info":
        data = part.get("data") or []
        cols = int(part.get("cols", 2))
        row_h = float(part.get("row_h", 6.5))
        total_rows = math.ceil(len(data) / cols) if data else 0
        return total_rows * row_h
    if kind == "text":
        label_h = 6.0
        min_h = float(part.get("min_h", 10.0))
        text_str = str(part.get("text") or "-")
        _, raw_h = _split_lines(pdf, w - 2 * PADDING_X, text_str, LINE_H)
        content_h = max(min_h, raw_h + 2 * PADDING_Y)
        return label_h + content_h
    if kind == "photo":
        photos = part.get("photos") or []
        if not photos:
            return 0
        cols = int(part.get("cols", 3))
        img_h = float(part.get("img_h", 40.0))
        gap = float(part.get("gap", 2.0))
        label_h = 6.0 if part.get("title") else 0
        rows = math.ceil(len(photos) / cols)
        return label_h + rows * img_h + (rows + 1) * gap
    return 0


def _draw_section_group(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    number: str,
    title: str,
    parts: List[Dict[str, Any]],
) -> float:
    """วาดหมวดหนึ่ง ๆ โดยรวม section bar + parts ทุกส่วนในกรอบใหญ่เดียว

    parts: list ของ dict รองรับ kind:
        - "info":  {"data": [(k,v),...], "cols": 1|2, "row_h": 6.5}
        - "text":  {"label": str, "text": str, "min_h": 10}
        - "photo": {"photos": [...], "title": str, "cols": 3, "img_h": 40, "gap": 2}
    """
    # คำนวณความสูงรวมของทุก parts
    parts_h = 0.0
    for p in parts:
        parts_h += _measure_part_height(pdf, w, p)

    total_h = SECTION_BAR_H + parts_h

    pdf.set_line_width(LINE_W_INNER)

    # กรอบใหญ่ครอบทั้งหมด
    pdf.rect(x, y, w, total_h)

    # Section bar (หัวข้อหมวด)
    pdf.set_fill_color(235, 235, 235)
    pdf.rect(x, y, w, SECTION_BAR_H, style="FD")
    display_text = f"  {number}. {title}" if number else f"  {title}"
    pdf.set_xy(x, y + 0.3)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(w, SECTION_BAR_H, display_text, border=0, align="L")

    cy = y + SECTION_BAR_H

    for p in parts:
        kind = p.get("kind")
        if kind == "info":
            cy = _draw_info_block(
                pdf, base_font, x, cy, w,
                p.get("data") or [],
                cols=int(p.get("cols", 2)),
                row_h=float(p.get("row_h", 6.5)),
                draw_outer=False,
            )
        elif kind == "text":
            cy = _draw_text_block(
                pdf, base_font, x, cy, w,
                str(p.get("label") or ""),
                p.get("text"),
                min_h=float(p.get("min_h", 10.0)),
                draw_outer=False,
            )
        elif kind == "photo":
            photos = p.get("photos") or []
            if not photos:
                continue
            cy = _draw_photo_grid(
                pdf, base_font, x, cy, w,
                photos,
                title=str(p.get("title") or ""),
                cols=int(p.get("cols", 3)),
                img_h=float(p.get("img_h", 40.0)),
                gap=float(p.get("gap", 2.0)),
                draw_outer=False,
            )

    return y + total_h


# -------------------- Photo grid --------------------
def _draw_photo_grid(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    photos: List[dict],
    title: str = "",
    cols: int = 3,
    img_h: float = 40.0,
    gap: float = 2.0,
    draw_outer: bool = True,
) -> float:
    """วาด grid รูปภาพในกรอบที่มี label (optional)
    draw_outer → วาดกรอบรอบ grid (ปิดได้เมื่ออยู่ภายใน group box)
    """
    if not photos:
        return y

    label_h = 6.0 if title else 0

    img_w = (w - (cols + 1) * gap) / cols
    rows = math.ceil(len(photos) / cols)
    grid_h = rows * img_h + (rows + 1) * gap

    total_h = label_h + grid_h

    pdf.set_line_width(LINE_W_INNER)

    # Label bar
    if title:
        pdf.set_fill_color(245, 245, 245)
        pdf.rect(x, y, w, label_h, style="FD")
        pdf.set_xy(x + PADDING_X, y + 0.4)
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.cell(w - 2 * PADDING_X, label_h - 0.8, title, border=0, align="L")

    # กรอบ grid
    if draw_outer:
        pdf.rect(x, y + label_h, w, grid_h)

    # วาดรูป
    for i, photo in enumerate(photos):
        r = i // cols
        c = i % cols
        cx = x + gap + c * (img_w + gap)
        cy = y + label_h + gap + r * (img_h + gap)

        url = (photo or {}).get("url", "")
        img_buf, _ = _load_image_with_cache(url)

        if img_buf is not None:
            try:
                pdf.image(img_buf, x=cx, y=cy, w=img_w, h=img_h, type="JPEG")
            except Exception as e:
                _log(f"[IMG] place error: {e}")
                _draw_placeholder(pdf, base_font, cx, cy, img_w, img_h)
        else:
            _draw_placeholder(pdf, base_font, cx, cy, img_w, img_h)

    return y + total_h


def _draw_placeholder(pdf: FPDF, base_font: str, x: float, y: float, w: float, h: float):
    pdf.set_draw_color(180, 180, 180)
    pdf.rect(x, y, w, h)
    pdf.set_draw_color(0, 0, 0)
    pdf.set_font(base_font, "", FONT_SMALL)
    pdf.set_text_color(150, 150, 150)
    pdf.set_xy(x, y + (h - LINE_H) / 2.0)
    pdf.cell(w, LINE_H, "-", border=0, align="C")
    pdf.set_text_color(0, 0, 0)


# -------------------- Signature block --------------------
def _draw_signature_block(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    date_text: str = "",
    labels: Optional[List[str]] = None,
) -> float:
    """วาดช่องลายเซ็นท้ายเอกสาร 3 ช่อง"""
    if labels is None:
        labels = ["ผู้แจ้ง", "ผู้ซ่อม", "ผู้ตรวจสอบ"]
    col_w = w / len(labels)

    row_h_header = 5.0
    row_h_sig = 14.0
    row_h_name = 5.0
    row_h_date = 5.0
    total_h = row_h_header + row_h_sig + row_h_name + row_h_date

    pdf.set_line_width(LINE_W_INNER)

    # Header สีเหลือง
    pdf.set_fill_color(*TITLE_BG)
    pdf.set_font(base_font, "B", FONT_MAIN)
    for i, label in enumerate(labels):
        cx = x + i * col_w
        pdf.rect(cx, y, col_w, row_h_header, style="FD")
        pdf.set_xy(cx, y + 0.3)
        pdf.cell(col_w, row_h_header - 0.6, label, border=0, align="C")

    # กล่องลายเซ็น (ว่าง)
    cy = y + row_h_header
    for i in range(len(labels)):
        cx = x + i * col_w
        pdf.rect(cx, cy, col_w, row_h_sig)

    # แถวชื่อ
    cy += row_h_sig
    pdf.set_font(base_font, "", FONT_MAIN)
    for i in range(len(labels)):
        cx = x + i * col_w
        pdf.rect(cx, cy, col_w, row_h_name)
        pdf.set_xy(cx, cy)
        pdf.cell(col_w, row_h_name, "(                                                     )", border=0, align="C")

    # แถววันที่
    cy += row_h_name
    for i in range(len(labels)):
        cx = x + i * col_w
        pdf.rect(cx, cy, col_w, row_h_date)
        pdf.set_xy(cx, cy)
        pdf.cell(col_w, row_h_date, f"วันที่ :  {date_text}" if date_text else "วันที่ :", border=0, align="C")

    return y + total_h


# -------------------- Corrective action block --------------------
def _draw_action_block(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    idx: int,
    action: dict,
) -> float:
    """วาดรายละเอียดการดำเนินการแก้ไข 1 ชุด (ข้อความ + รูปก่อน/หลัง)"""
    # หัวข้อย่อย
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_xy(x, y)
    pdf.cell(w, LINE_H + 1, f"การดำเนินการแก้ไขที่ {idx}", border=0, align="L")
    y += LINE_H + 1.5

    action_text = action.get("text", "") or "-"
    y = _draw_text_block(pdf, base_font, x, y, w, "รายละเอียดการดำเนินการ", action_text, min_h=10)
    y += 2

    before_imgs = action.get("beforeImages") or []
    after_imgs = action.get("afterImages") or []

    if before_imgs or after_imgs:
        col_w = (w - 4) / 2
        start_y = y
        max_y = y

        if before_imgs:
            max_y = max(max_y, _draw_photo_grid(
                pdf, base_font, x, start_y, col_w, before_imgs,
                title="รูปภาพก่อนแก้ไข", cols=2, img_h=38,
            ))

        if after_imgs:
            max_y = max(max_y, _draw_photo_grid(
                pdf, base_font, x + col_w + 4, start_y, col_w, after_imgs,
                title="รูปภาพหลังแก้ไข", cols=2, img_h=38,
            ))

        y = max_y

    return y + 3


# -------------------- Report PDF class --------------------
class ReportPDF(HTML2PDF):
    def __init__(self, *args, issue_id="-", doc_name="-", **kwargs):
        super().__init__(*args, **kwargs)
        self.issue_id = issue_id
        self._doc_name = doc_name
        self._base_font_name = "Arial"
        self._label_page = "หน้า"
        self._label_issue_id = "เลขที่เอกสาร"
        self._label_doc_name = "ชื่อเอกสาร"
        self._addr_line1 = "การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)"
        self._addr_line2 = "เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย จังหวัดนนทบุรี 11130"
        self._addr_line3 = "ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416"

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
            addr_line3=self._addr_line3,
        )


# -------------------- Main builder --------------------
def make_cm_report_pdf_bytes(doc: dict) -> bytes:
    """สร้าง PDF ใบแจ้งซ่อมบำรุง"""
    issue_id = str(doc.get("issue_id", "-"))
    doc_name = str(doc.get("doc_name", "-"))

    pdf = ReportPDF(unit="mm", format="A4", issue_id=issue_id, doc_name=doc_name)
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

    # ===== หน้าแรก =====
    pdf.add_page()
    y = pdf.get_y() + 2

    # Title bar
    y = _draw_title_bar(pdf, base_font, x0, y, page_w)
    y += 2

    # ===== ส่วนที่ 1: ข้อมูลการแจ้ง =====
    y = _draw_section_group(
        pdf, base_font, x0, y, page_w, "1", "ข้อมูลการแจ้ง",
        parts=[
            {
                "kind": "info",
                "data": [
                    ("วันที่แจ้ง", _fmt_date_thai_full(doc.get("found_date"))),
                    ("ผู้แจ้ง", doc.get("reported_by", "-") or "-"),
                    ("สถานที่", doc.get("location", "-") or "-"),
                    ("สถานะ", doc.get("status", "-") or "-"),
                ],
                "cols": 2,
            },
        ],
    )
    y += 3

    # ===== ส่วนที่ 2: รายละเอียดปัญหา =====
    section2_parts: List[Dict[str, Any]] = [
        {
            "kind": "info",
            "data": [
                ("อุปกรณ์ที่เสียหาย", doc.get("faulty_equipment", "-") or "-"),
                ("ความรุนแรง", doc.get("severity", "-") or "-"),
            ],
            "cols": 2,
        },
        {
            "kind": "text",
            "label": "ปัญหาที่พบ",
            "text": doc.get("problem_details", "-"),
            "min_h": 12,
        },
    ]

    remarks_open = (doc.get("remarks_open") or "").strip()
    if remarks_open and remarks_open != "-":
        section2_parts.append({
            "kind": "text", "label": "หมายเหตุ", "text": remarks_open, "min_h": 10,
        })

    photos_obj = doc.get("photos", {}) or doc.get("photos_problem", {}) or {}
    cm_photos = photos_obj.get("cm_photos", []) if isinstance(photos_obj, dict) else []
    if cm_photos:
        section2_parts.append({
            "kind": "photo",
            "photos": cm_photos[:9],
            "title": "รูปภาพประกอบปัญหา",
            "cols": 3,
            "img_h": 45,
        })

    y = _draw_section_group(
        pdf, base_font, x0, y, page_w, "2", "รายละเอียดปัญหา",
        parts=section2_parts,
    )
    y += 3

    # ===== หน้าใหม่สำหรับส่วนแก้ไข =====
    pdf.add_page()
    y = pdf.get_y() + 2

    # ===== ส่วนที่ 3: ประเภทและสาเหตุของปัญหา =====
    section3_parts: List[Dict[str, Any]] = [
        {
            "kind": "info",
            "data": [("ประเภทปัญหา", doc.get("problem_type", "-") or "-")],
            "cols": 1,
        },
    ]
    cause = (doc.get("cause") or "").strip()
    if cause and cause != "-":
        section3_parts.append({
            "kind": "text", "label": "สาเหตุของปัญหา", "text": cause, "min_h": 10,
        })

    y = _draw_section_group(
        pdf, base_font, x0, y, page_w, "3", "ประเภทและสาเหตุของปัญหา",
        parts=section3_parts,
    )
    y += 3

    # ===== ส่วนที่ 4: การดำเนินการแก้ไข =====
    # แปลง repaired_equipment list → string
    repaired_eq = doc.get("repaired_equipment", [])
    if isinstance(repaired_eq, list):
        repaired_eq_text = ", ".join(str(e) for e in repaired_eq if e) or "-"
    else:
        repaired_eq_text = str(repaired_eq) or "-"

    section4_parts: List[Dict[str, Any]] = [
        {
            "kind": "info",
            "data": [
                ("วันที่เริ่มแก้ไข", _fmt_date_thai_full(doc.get("start_repair_date"))),
                ("วันที่แก้ไขเสร็จ", _fmt_date_thai_full(doc.get("resolved_date"))),
                ("อุปกรณ์ที่แก้ไข", repaired_eq_text),
                ("ผู้ตรวจสอบ", doc.get("inspector", "-") or "-"),
                ("ผลการซ่อม", doc.get("repair_result", "-") or "-"),
                ("", ""),
            ],
            "cols": 2,
        },
    ]

    inprogress_remarks = (doc.get("inprogress_remarks") or "").strip()
    if inprogress_remarks and inprogress_remarks != "-":
        section4_parts.append({
            "kind": "text",
            "label": "หมายเหตุระหว่างดำเนินการ",
            "text": inprogress_remarks,
            "min_h": 10,
        })

    y = _draw_section_group(
        pdf, base_font, x0, y, page_w, "4", "การดำเนินการแก้ไข",
        parts=section4_parts,
    )
    y += 3

    # รายละเอียด corrective actions วาดแยกจากกรอบใหญ่ เพราะมีรูปก่อน/หลังที่ยืดหยุ่น
    corrective_actions = doc.get("corrective_actions") or []
    if corrective_actions:
        for idx, action in enumerate(corrective_actions, 1):
            needed_h = 60
            if y + needed_h > pdf.h - pdf.b_margin:
                pdf.add_page()
                y = pdf.get_y() + 2
            y = _draw_action_block(pdf, base_font, x0, y, page_w, idx, action)

    # ===== ส่วนที่ 5: การป้องกันและผลการซ่อม =====
    section5_parts: List[Dict[str, Any]] = []

    preventive_actions = doc.get("preventive_action") or []
    if preventive_actions:
        preventive_text = "\n".join(
            f"{i}. {a}"
            for i, a in enumerate(preventive_actions, 1)
            if a
        )
        if preventive_text:
            section5_parts.append({
                "kind": "text",
                "label": "วิธีป้องกันไม่ให้เกิดซ้ำ",
                "text": preventive_text,
                "min_h": 12,
            })

    repair_remark = (doc.get("repair_result_remark") or "").strip()
    if repair_remark and repair_remark != "-":
        section5_parts.append({
            "kind": "text",
            "label": "หมายเหตุผลการซ่อม",
            "text": repair_remark,
            "min_h": 10,
        })

    if section5_parts:
        # ตรวจพื้นที่ก่อนวาด
        needed_s5 = SECTION_BAR_H + sum(
            _measure_part_height(pdf, page_w, p) for p in section5_parts
        )
        if y + needed_s5 + 5 > pdf.h - pdf.b_margin:
            pdf.add_page()
            y = pdf.get_y() + 2

        y = _draw_section_group(
            pdf, base_font, x0, y, page_w, "5", "การป้องกันและผลการซ่อม",
            parts=section5_parts,
        )
        y += 3

    # ===== ลายเซ็นท้ายเอกสาร =====
    sig_total_h = 29 + 8  # header + sig rows + margin
    if y + sig_total_h > pdf.h - pdf.b_margin:
        pdf.add_page()
        y = pdf.get_y() + 2

    y += 3
    pdf.set_font(base_font, "B", FONT_MAIN + 1)
    pdf.set_xy(x0, y)
    pdf.cell(page_w, LINE_H + 1, "ลายเซ็นผู้เกี่ยวข้อง", border=0, align="C")
    y += LINE_H + 2

    resolved_date_th = _fmt_date_thai_full(doc.get("resolved_date"))
    _draw_signature_block(
        pdf, base_font, x0, y, page_w,
        date_text=resolved_date_th if resolved_date_th != "-" else "",
        labels=["ผู้แจ้ง", "ผู้ซ่อม", "ผู้ตรวจสอบ"],
    )

    return _output_pdf_bytes(pdf)


def generate_pdf(data: dict, lang: str = "th") -> bytes:
    """Public API สำหรับ pdf_routes"""
    return make_cm_report_pdf_bytes(data)
