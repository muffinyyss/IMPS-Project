# backend/pdf/templates/pdf_mdb.py
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
DOCUMENT_TITLE_MAIN = "Preventive Maintenance Checklist - MDB"
DOCUMENT_TITLE_PHOTO = "Preventive Maintenance Checklist"
DOCUMENT_TITLE_PHOTO_CONT = "Photos - MDB (ต่อ)"
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

# -------------------- รายการหัวข้อ MDB --------------------
ROW_TITLES = {
    "r1": "ตรวจสอบสภาพทั่วไป",
    "r2": "ตรวจสอบดักซีล, ซิลิโคนกันซึม",
    "r3": "ตรวจสอบ Power Meter",
    "r4": "ตรวจสอบแรงดันไฟฟ้า Breaker Main",
    "r5": "ตรวจสอบแรงดันไฟฟ้า Breaker Charger ตัวที่1",
    "r6": "ตรวจสอบแรงดันไฟฟ้า Breaker Charger ตัวที่2",
    "r7": "ตรวจสอบแรงดันไฟฟ้า Breaker Charger ตัวที่3",
    "r8": "ตรวจสอบแรงดันไฟฟ้า Breaker CCB",
    "r9": "ทดสอบปุ่ม Trip Test",
    "r10": "ตรวจสอบจุดต่อทางไฟฟ้า",
    "r11": "ทำความสะอาดตู้ MDB",
}

# -------------------- PDF base class --------------------
class HTML2PDF(FPDF, HTMLMixin):
    pass

class ReportPDF(HTML2PDF):
    def __init__(self, *args, issue_id="-", **kwargs):
        super().__init__(*args, **kwargs)
        self.issue_id = issue_id

    def header(self):
        # เรียกฟังก์ชันวาดหัวเอกสารของคุณ
        try:
            _draw_header(self, self._base_font_name, issue_id=self.issue_id)
        except Exception:
            # fallback ถ้าวาดไม่ได้ป้องกัน error
            pass

        # เว้นระยะจากหัวเอกสารลงมา
        self.ln(35)

    def footer(self):
        self.set_y(-12)
        try:
            self.set_font(self._base_font_name, "", 11)
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
        return str(val) if val else "-"
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


def _load_image_source_from_urlpath(
    url_path: str,
) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
    if not url_path:
        return None, None

    _log(f"[IMG] lookup: {url_path}")

    # case: data URL
    if url_path.startswith("data:image/"):
        try:
            head, b64 = url_path.split(",", 1)
            mime = head.split(";")[0].split(":", 1)[1]
            bio = BytesIO(base64.b64decode(b64))
            img_type = (
                "PNG"
                if "png" in mime
                else ("JPEG" if "jpeg" in mime or "jpg" in mime else "")
            )
            return bio, img_type
        except Exception as e:
            _log(f"[IMG] data-url parse error: {e}")

    # case: absolute http(s)
    if _is_http_url(url_path) and requests is not None:
        try:
            resp = requests.get(url_path, headers=_env_photo_headers(), timeout=10)
            resp.raise_for_status()
            _log(f"[IMG] downloaded {len(resp.content)} bytes from absolute URL")
            return BytesIO(resp.content), _guess_img_type_from_ext(url_path)
        except Exception as e:
            _log(f"[IMG] absolute URL failed: {e}")

    # case: absolute filesystem path
    p_abs = Path(url_path)
    if p_abs.is_absolute() and p_abs.exists():
        return p_abs.as_posix(), _guess_img_type_from_ext(url_path)

    # 1) backend/uploads
    backend_root = Path(__file__).resolve().parents[2]
    uploads_root = backend_root / "uploads"
    if uploads_root.exists():
        clean_path = url_path.lstrip("/")
        if clean_path.startswith("uploads/"):
            clean_path = clean_path[8:]
        local_path = uploads_root / clean_path
        _log(f"[IMG] try uploads: {local_path}")
        if local_path.exists() and local_path.is_file():
            return local_path.as_posix(), _guess_img_type_from_ext(
                local_path.as_posix()
            )

    # 2) public
    public_root = _find_public_root()
    if public_root:
        local_path = public_root / url_path.lstrip("/")
        _log(f"[IMG] try public: {local_path}")
        if local_path.exists() and local_path.is_file():
            return local_path.as_posix(), _guess_img_type_from_ext(
                local_path.as_posix()
            )

    # 3) base_url download
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
        "L1-N", "L2-N", "L3-N",
        "L1-G", "L2-G", "L3-G",
        "L1-L2", "L2-L3", "L3-L1",
        "N-G"
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

    # ✅ ถ้ายังไม่มีค่า N-G ในข้อมูล ให้เพิ่มบรรทัด N-G = -
    if not any("N-G" in k for k in norm_ms.keys()):
        lines.append("N-G = -")

    return "\n".join(lines)


def _draw_result_cell_with_subitems(
    pdf: FPDF, 
    base_font: str, 
    x: float, 
    y: float, 
    w: float, 
    h: float, 
    subitems: List[Dict[str, Any]]
):
    # ---- บังคับให้มี 5 row และแถวแรกเป็นว่าง ----
    subitems = [{"result": None}] + subitems
    subitems = subitems[:5]

    # วาดกรอบนอกช่อง Result ทั้งก้อน
    pdf.rect(x, y, w, h)

    subitem_h = h / len(subitems)
    col_w = w / 3.0   # ใช้จัดตำแหน่ง checkbox
    pdf.set_font(base_font, "", FONT_SMALL)

    for idx, subitem in enumerate(subitems):
        sub_y = y + idx * subitem_h

        # แถวแรก (ช่องว่าง) ไม่มี checkbox
        if idx == 0:
            continue

        # แถว 2–5 วาด checkbox Pass / Fail / N/A
        result = subitem.get("result", "na")
        labels = [
            ("Pass", result == "pass"),
            ("Fail", result == "fail"),
            ("N/A",  result == "na"),
        ]

        for i, (lab, chk) in enumerate(labels):
            sx = x + i * col_w

            text_w = pdf.get_string_width(lab)
            content_w = CHECKBOX_SIZE + 1.6 + text_w
            start_x = sx + (col_w - content_w) / 2.0
            start_y = sub_y + (subitem_h - CHECKBOX_SIZE) / 2.0

            _draw_check(pdf, start_x, start_y, CHECKBOX_SIZE, chk)
            pdf.set_xy(start_x + CHECKBOX_SIZE + 1.6, start_y - 1)
            pdf.cell(text_w, LINE_H, lab, border=0, ln=0, align="L")

    pdf.set_xy(x + w, y)


def _rows_to_checks(rows: dict, measures: Optional[dict] = None) -> List[dict]:
    if not isinstance(rows, dict):
        return []
    items: List[dict] = []
    measures = measures or {}

    for key in sorted(rows.keys(), key=_r_idx):
        idx = _r_idx(key)
        data = rows.get(key) or {}

        title = ROW_TITLES.get(key, f"รายการที่ {idx}")
        remark = (data.get("remark") or "").strip()

        item_text = f"{idx}. {title}"

        # 🔸 ข้อ 4-8: เพิ่มค่าแรงดันไฟฟ้า
        if key.lower() in ["r4", "r5", "r6", "r7", "r8"]:
            measure_key = f"m{idx}"
            voltage_text = _format_voltage_measurement(measures, measure_key)
            if voltage_text:
                item_text = f"{item_text}\n{voltage_text}"
        
        # 🔸 ข้อ 9: มีข้อย่อย
        if key.lower() == "r9":
            subitems_data = data.get("subitems") or {}
            subitems = []
            for sub_key in ["RCD", "Breaker CCB", "Breaker Charger", "Breaker Main"]:
                sub_result = subitems_data.get(sub_key, {}).get("pf", "na")
                subitems.append({
                    "label": sub_key,
                    "result": _norm_result(sub_result)
                })
            
            # ข้อ 9: ข้อความหลัก + รายการข้อย่อย
            subitem_lines = [f"       {s['label']}" for s in subitems]
            item_text = f"{item_text}\n" + "\n".join(subitem_lines)
            
            items.append({
                "idx": idx,
                "text": item_text,
                # result หลักของข้อ 9 ไม่ได้ใช้แล้ว แต่เก็บไว้เฉย ๆ
                "result": _norm_result(data.get("pf", "")),
                "remark": remark,
                "has_subitems": True,
                "subitems": subitems,
            })

        else:
            items.append({
                "idx": idx,
                "text": item_text,
                "result": _norm_result(data.get("pf", "")),
                "remark": remark,
                "has_subitems": False
            })

    return items


def _get_photo_items_for_idx(doc: dict, idx: int) -> List[dict]:
    photos = (doc.get("photos") or {}).get(f"g{idx}") or []
    out = []
    for p in photos:
        if isinstance(p, dict) and p.get("url"):
            out.append(p)
    return out[:PHOTO_MAX_PER_ROW]


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
    remark_w: float
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

    return y


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
        
        # ✅ ถ้า is_top_align=True ให้ชิดบน, ไม่งั้นให้อยู่ตรงกลาง
        if is_top_align:
            start_y = y + PADDING_Y
        else:
            start_y = y + (h - CHECKBOX_SIZE) / 2.0
        
        _draw_check(pdf, start_x, start_y, CHECKBOX_SIZE, chk)
        pdf.set_xy(start_x + CHECKBOX_SIZE + 1.6, start_y - 1)
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
    pdf.set_font(base_font, "", FONT_MAIN)
    _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)
    img_h = PHOTO_IMG_MAX_H
    row_h = max(ROW_MIN_H, text_h, img_h + 2 * PADDING_Y)

    # ซ้าย: ข้อ/คำถาม
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
                except Exception as e:
                    _log(f"[IMG] place error: {e}")
                    pdf.set_xy(cx, cy + (img_h - LINE_H) / 2.0)
                    pdf.cell(slot_w, LINE_H, "-", border=0, align="C")
            else:
                pdf.set_xy(cx, cy + (img_h - LINE_H) / 2.0)
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
    pdf.rect(x, y, w, box_h)
    pdf.line(x + col_w, y, x + col_w, y + box_h)
    # pdf.line(x, y + row_h, x + w, y + row_h)

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



# -------------------- สร้างเอกสาร --------------------
def _output_pdf_bytes(pdf: FPDF) -> bytes:
    data = pdf.output(dest="S")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    return data.encode("latin1")


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
    model = job.get("model", "-")
    sn = job.get("sn", "-")
    pm_date = _fmt_date_thai_like_sample(doc.get("pm_date", job.get("date", "-")))
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

    # หน้าแรก
    pdf.add_page()
    y = _draw_header(pdf, base_font, issue_id)

    # ชื่อเอกสาร
    pdf.set_xy(x0, y)
    pdf.set_fill_color(255, 230, 100)
    pdf.set_font(base_font, "B", 16)
    pdf.cell(page_w, 10, DOCUMENT_TITLE_MAIN, border=1, ln=1, align="C", fill=True)
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
        has_subitems = it.get("has_subitems", False)
        subitems = it.get("subitems", [])

        _, item_h = _split_lines(pdf, item_w - 2 * PADDING_X, text, LINE_H)
        _, remark_h = _split_lines(pdf, remark_w - 2 * PADDING_X, remark, LINE_H)
        
        is_row_4 = "4." in text
        is_row_5 = "5." in text
        is_row_6 = "6." in text
        is_row_7 = "7." in text
        is_row_8 = "8." in text
        is_row_9 = "9." in text
        
        if is_row_4 or is_row_5 or is_row_6 or is_row_7:
            remark_h = max(remark_h, LINE_H * 12)

        elif is_row_8:
            remark_h = max(remark_h, LINE_H * 6)

        elif is_row_9:
            remark_h = max(remark_h, LINE_H * 6)

        
        row_h_eff = max(ROW_MIN_H, item_h, remark_h)

        _ensure_space(row_h_eff)

        x = x_table
        _cell_text_in_box(pdf, x, y, item_w, row_h_eff, text, align="L", lh=LINE_H)
        x += item_w
        
        # ถ้ามีข้อย่อย ใช้ฟังก์ชันพิเศษ
        if has_subitems and subitems:
            _draw_result_cell_with_subitems(pdf, base_font, x, y, result_w, row_h_eff, subitems)
        else:
            _draw_result_cell(pdf, base_font, x, y, result_w, row_h_eff, result)
        
        x += result_w
        _cell_text_in_box(
            pdf, x, y, remark_w, row_h_eff, remark, align="L", lh=LINE_H, valign="top"
        )

        y += row_h_eff

    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_draw_color(0, 0, 0)

    # ส่วน Comment & Summary
    comment_x = x_table
    comment_y = y
    comment_item_w = item_w
    comment_result_w = result_w
    comment_remark_w = remark_w

    h_comment = 16
    h_checklist = 12
    total_h = h_comment + h_checklist
    
    # ตรวจสอบพื้นที่ก่อนวาดส่วน Comment
    _ensure_space(total_h + 5)
    
    # วาดกรอบนอกทั้งหมด
    pdf.rect(comment_x, y, item_w + result_w + remark_w, total_h)
    
    # แถว Comment (ใช้ _cell_text_in_box แทน multi_cell)
    pdf.set_font(base_font, "B", 13)
    pdf.set_xy(comment_x, y)
    pdf.cell(comment_item_w, h_comment, "Comment :", border=0, align="L")
    
    # วาดเส้นคั่นระหว่าง "Comment :" และข้อความ
    pdf.line(comment_x + comment_item_w, y, comment_x + comment_item_w, y + h_comment)
    
    # ใช้ _cell_text_in_box สำหรับ comment text
    pdf.set_font(base_font, "", 13)
    comment_text = str(doc.get("summary", "") or "-")
    comment_text_x = comment_x + comment_item_w
    _cell_text_in_box(pdf, comment_text_x, y, comment_result_w + comment_remark_w, h_comment, comment_text, align="L", lh=LINE_H, valign="top")
    
    y += h_comment
    
    # เส้นคั่นระหว่าง Comment และ ผลการตรวจสอบ
    pdf.line(comment_x, y, comment_x + item_w + result_w + remark_w, y)

    # แถวผลการตรวจสอบ
    summary_check = str(doc.get("summaryCheck", "")).strip().upper() or "-"
    
    pdf.set_xy(comment_x, y)
    pdf.set_font(base_font, "B", 13)
    pdf.cell(comment_item_w, h_checklist, "ผลการตรวจสอบ :", border=0, align="L")
    
    # วาดเส้นคั่น
    pdf.line(comment_x + comment_item_w, y, comment_x + comment_item_w, y + h_checklist)
    
    # วาด checkbox
    pdf.set_font(base_font, "", 13)
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
    pdf.cell(page_w, 10, "Preventive Maintenance Checklist - MDB", border=1, ln=1, align="C")
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

    # วาดหัวตาราง Photos
    y = _draw_photos_table_header(pdf, base_font, x_table, y, q_w, g_w)
    pdf.set_font(base_font, "", FONT_MAIN)

    # วาดทีละข้อ โดย map r# -> g# จาก doc["photos"]
    for it in checks:
        idx = int(it.get("idx") or 0)
        question_text = ROW_TITLES.get(f"r{idx}", it.get("text", f"{idx}. -"))

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


# -------------------- Public API --------------------
def generate_pdf(data: dict) -> bytes:
    return make_pm_report_html_pdf_bytes(data)
