from fpdf import FPDF, HTMLMixin
from pathlib import Path
from datetime import datetime, date
import os
import re
from typing import Optional, Tuple, List, Dict, Any, Union
from io import BytesIO
import math

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

def add_all_thsarabun_fonts(pdf: FPDF, family_name: str = "THSarabun") -> bool:
    """โหลดฟอนต์ไทย"""
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

# -------------------- Constants --------------------
FONT_TITLE = 16.0
FONT_SECTION = 13.0
FONT_MAIN = 12.0
FONT_LABEL = 11.0
FONT_SMALL = 10.0

LINE_BOLD = 0.25      # ลดจาก 0.6 เป็น 0.25
LINE_NORMAL = 0.25
LINE_THIN = 0.15

# สีแบบ grayscale
GRAY_DARK = (50, 50, 50)
GRAY_MEDIUM = (120, 120, 120)
GRAY_LIGHT = (180, 180, 180)

class HTML2PDF(FPDF, HTMLMixin):
    pass

def _parse_date_flex(s: str) -> Optional[datetime]:
    """แปลงวันที่"""
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

def _fmt_date_thai(val) -> str:
    """แปลงวันที่เป็นรูปแบบไทย"""
    if isinstance(val, (datetime, date)):
        d = datetime(val.year, val.month, val.day)
    else:
        d = _parse_date_flex(str(val)) if val is not None else None
    if not d:
        return str(val) if val else "-"
    year_be = d.year + 543
    return d.strftime(f"%d/%m/{year_be}")

def _resolve_logo_path() -> Optional[Path]:
    """หาไฟล์โลโก้"""
    names = [
        "logo_egat.png", "logo_egatev.png", "logo_egat_ev.png",
        "egat_logo.png", "logo-ct.png", "logo_ct.png",
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
    """เดาชนิดของไฟล์รูป"""
    ext = os.path.splitext(str(path_or_url).lower())[1]
    if ext in (".png",):
        return "PNG"
    if ext in (".jpg", ".jpeg"):
        return "JPEG"
    return ""

def _load_image_source_from_urlpath(url_path: str) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
    """โหลดรูปภาพจาก path"""
    if not url_path:
        return None, None

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

def _output_pdf_bytes(pdf: FPDF) -> bytes:
    """Output PDF เป็น bytes"""
    data = pdf.output(dest="S")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    return data.encode("latin1")

def _draw_page_border(pdf: FPDF) -> None:
    """วาดกรอบหน้าเอกสาร"""
    pdf.set_line_width(LINE_BOLD)
    pdf.rect(10, 10, pdf.w - 20, pdf.h - 20)

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
    """วาด Header เอกสารทางการ - เต็มกรอบ"""
    x0 = 10              # เริ่มจากกรอบนอก
    page_w = pdf.w - 20  # ความกว้างเต็มจากกรอบนอก (10+10)
    y_top = 10

    col_left, col_mid = 35, 120
    col_right = page_w - col_left - col_mid

    h_all = 20    # ลดจาก 22 เป็น 20
    h_right_half = h_all / 2

    pdf.set_line_width(LINE_NORMAL)

    # Page number ที่มุมขวาบน
    page_text = f"{label_page} {pdf.page_no()}"
    pdf.set_font(base_font, "", FONT_MAIN - 1)
    page_text_w = pdf.get_string_width(page_text) + 4
    page_x = pdf.w - 10 - page_text_w
    page_y = 5
    pdf.set_xy(page_x, page_y)
    pdf.cell(page_text_w, 4, page_text, align="R")

    # โลโก้
    pdf.rect(x0, y_top, col_left, h_all)
    logo_path = _resolve_logo_path()
    if logo_path:
        IMG_W = 20
        img_x = x0 + (col_left - IMG_W) / 2
        img_y = y_top + (h_all - 10) / 2
        try:
            pdf.image(logo_path.as_posix(), x=img_x, y=img_y, w=IMG_W)
        except Exception:
            pass

    # กล่องกลาง (ที่อยู่)
    box_x = x0 + col_left
    pdf.rect(box_x, y_top, col_mid, h_all)

    addr_lines = [addr_line1, addr_line2, addr_line3]
    pdf.set_font(base_font, "B", FONT_MAIN - 1)
    line_h = 3.5
    start_y = y_top + (h_all - line_h * len(addr_lines)) / 2

    for i, line in enumerate(addr_lines):
        pdf.set_xy(box_x + 2, start_y + i * line_h)
        pdf.cell(col_mid - 4, line_h, line, align="C")

    # กล่องขวา - Issue ID (ครึ่งบน)
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_right_half)

    # กล่องขวา - Doc Name (ครึ่งล่าง)
    pdf.rect(xr, y_top + h_right_half, col_right, h_right_half)

    # Issue ID - ปรับให้ text อยู่ในกรอบ
    pdf.set_font(base_font, "B", FONT_LABEL - 2)
    pdf.set_xy(xr + 1, y_top + 2)
    pdf.cell(col_right - 2, 3.5, label_issue_id, align="C")
    pdf.set_font(base_font, "", FONT_MAIN - 1)
    pdf.set_xy(xr + 1, y_top + 5.5)
    pdf.cell(col_right - 2, 3.5, issue_id, align="C")

    # Doc Name - ปรับให้ text อยู่ในกรอบ
    pdf.set_font(base_font, "B", FONT_LABEL - 2)
    pdf.set_xy(xr + 1, y_top + h_right_half + 2)
    pdf.cell(col_right - 2, 3.5, label_doc_name, align="C")
    pdf.set_font(base_font, "", FONT_MAIN - 1)
    pdf.set_xy(xr + 1, y_top + h_right_half + 5.5)
    pdf.cell(col_right - 2, 3.5, doc_name, align="C")

    return y_top + h_all

def _draw_doc_title(pdf: FPDF, base_font: str, x: float, y: float, w: float) -> float:
    """วาดชื่อเอกสาร"""
    pdf.set_font(base_font, "B", FONT_TITLE - 2)
    pdf.set_xy(x, y)
    pdf.cell(w, 6, "ใบแจ้งซ่อมบำรุง", align="C")
    
    pdf.set_font(base_font, "", 10)
    pdf.set_xy(x, y + 6)
    pdf.cell(w, 5, "CORRECTIVE MAINTENANCE REPORT", align="C")
    
    return y + 12

def _draw_section_title(pdf: FPDF, base_font: str, x: float, y: float, w: float, 
                        title: str, number: str = "") -> float:
    """วาดหัวข้อหมวด"""
    pdf.set_font(base_font, "B", FONT_SECTION - 1)
    pdf.set_xy(x, y)
    display_text = f"{number}. {title}" if number else title
    pdf.cell(w, 6, display_text, align="L")
    
    pdf.set_line_width(LINE_THIN)
    pdf.set_draw_color(*GRAY_LIGHT)
    pdf.line(x, y + 6, x + w, y + 6)
    pdf.set_draw_color(0, 0, 0)
    
    return y + 8

def _draw_info_table(pdf: FPDF, base_font: str, x: float, y: float, w: float, 
                     data: list, cols: int = 2) -> float:
    """วาดตารางข้อมูล - ปรับให้เส้นไม่ซ้อนกัน"""
    col_w = w / cols
    row_h = 6
    
    pdf.set_line_width(LINE_THIN)
    pdf.set_draw_color(0, 0, 0)
    
    total_rows = math.ceil(len(data) / cols)
    
    # วาดเส้นกริดแบบสมบูรณ์
    for row in range(total_rows + 1):
        # เส้นแนวนอน
        y_line = y + row * row_h
        pdf.line(x, y_line, x + w, y_line)
    
    for col in range(cols + 1):
        # เส้นแนวตั้ง
        x_line = x + col * col_w
        pdf.line(x_line, y, x_line, y + total_rows * row_h)
    
    # เส้นแบ่ง label/value (แนวตั้ง ตรงกลาง)
    label_w = 45
    for row in range(total_rows):
        for col in range(cols):
            x_line = x + col * col_w + label_w
            y_top_row = y + row * row_h
            y_bot_row = y_top_row + row_h
            pdf.line(x_line, y_top_row, x_line, y_bot_row)
    
    # เติมข้อมูล
    for i, (label, value) in enumerate(data):
        row = i // cols
        col = i % cols
        
        cell_x = x + col * col_w
        cell_y = y + row * row_h
        
        # Label
        label_w = 45
        pdf.set_font(base_font, "B", FONT_LABEL)
        pdf.set_xy(cell_x + 2, cell_y + 0.75)
        pdf.cell(label_w - 4, 5, label, align="L")
        
        # Value
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.set_xy(cell_x + label_w + 2, cell_y + 0.75)
        pdf.cell(col_w - label_w - 4, 5, str(value or "-"), align="L")
    
    return y + total_rows * row_h + 2

def _draw_text_area(pdf: FPDF, base_font: str, x: float, y: float, w: float, 
                    label: str, text: str, min_h: float = 20) -> float:
    """วาดพื้นที่ข้อความ"""
    pdf.set_line_width(LINE_THIN)
    pdf.rect(x, y, w, 7)
    
    pdf.set_font(base_font, "B", FONT_LABEL)
    pdf.set_xy(x + 2, y + 1)
    pdf.cell(w - 4, 5, label, align="L")
    
    y += 7
    
    pdf.set_font(base_font, "", FONT_MAIN)
    text_str = str(text or "-")
    
    chars_per_line = int((w - 8) / pdf.get_string_width("ก"))
    lines = max(1, math.ceil(len(text_str) / chars_per_line))
    text_h = max(min_h, lines * 4.5 + 1)
    
    pdf.rect(x, y, w, text_h)
    
    pdf.set_xy(x + 4, y + 3)
    pdf.multi_cell(w - 8, 4.5, text_str, align="L")
    
    return y + text_h + 2

def _draw_photo_section(pdf: FPDF, base_font: str, x: float, y: float, w: float, 
                        photos: list, title: str = "", cols: int = 3) -> float:
    """วาดส่วนรูปภาพ"""
    if not photos:
        return y
    
    if title:
        pdf.set_font(base_font, "B", FONT_LABEL)
        pdf.set_xy(x, y)
        pdf.cell(w, 6, title, align="L")
        y += 8
    
    gap = 4
    img_w = (w - (cols - 1) * gap) / cols
    img_h = img_w * 0.75
    
    pdf.set_line_width(LINE_THIN)
    
    for i, photo in enumerate(photos):
        row = i // cols
        col = i % cols
        
        img_x = x + col * (img_w + gap)
        img_y = y + row * (img_h + gap + 12)
        
        pdf.set_draw_color(*GRAY_MEDIUM)
        pdf.rect(img_x, img_y, img_w, img_h)
        
        url = photo.get("url", "")
        src, img_type = _load_image_source_from_urlpath(url)
        
        if src:
            try:
                pdf.image(src, x=img_x, y=img_y, w=img_w, h=img_h, type=(img_type or None))
            except:
                pdf.set_font(base_font, "", 9)
                pdf.set_text_color(*GRAY_MEDIUM)
                pdf.set_xy(img_x, img_y + img_h/2 - 2)
                pdf.cell(img_w, 4, "ไม่สามารถโหลดรูปได้", align="C")
                pdf.set_text_color(0, 0, 0)
        
        filename = photo.get("filename", "")
        if filename:
            if len(filename) > 30:
                filename = filename[:27] + "..."
            pdf.set_font(base_font, "", 9)
            pdf.set_xy(img_x, img_y + img_h + 2)
            pdf.cell(img_w, 5, filename, align="C")
            
            location = photo.get("location", "")
            if location:
                pdf.set_font(base_font, "", 8)
                pdf.set_text_color(*GRAY_MEDIUM)
                pdf.set_xy(img_x, img_y + img_h + 7)
                if len(location) > 35:
                    location = location[:32] + "..."
                pdf.cell(img_w, 4, location, align="C")
                pdf.set_text_color(0, 0, 0)
    
    rows = math.ceil(len(photos) / cols)
    pdf.set_draw_color(0, 0, 0)
    
    return y + rows * (img_h + gap + 12) + 3

def _draw_action_detail(pdf: FPDF, base_font: str, x: float, y: float, w: float, 
                        idx: int, action: dict) -> float:
    """วาดรายละเอียดการแก้ไข"""
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(w, 6, f"การดำเนินการที่ {idx}", align="L")
    y += 8
    
    action_text = action.get("text", "-")
    y = _draw_text_area(pdf, base_font, x, y, w, "รายละเอียดการดำเนินการ:", action_text, 15)
    
    before_imgs = action.get("beforeImages", [])
    after_imgs = action.get("afterImages", [])
    
    if before_imgs or after_imgs:
        col_w = (w - 6) / 2
        start_y = y
        max_y = y
        
        if before_imgs:
            before_y = _draw_photo_section(pdf, base_font, x, y, col_w, 
                                          before_imgs[:4], "รูปภาพก่อนแก้ไข", cols=2)
            max_y = max(max_y, before_y)
        
        if after_imgs:
            after_y = _draw_photo_section(pdf, base_font, x + col_w + 6, start_y, col_w, 
                                         after_imgs[:4], "รูปภาพหลังแก้ไข", cols=2)
            max_y = max(max_y, after_y)
        
        y = max_y
    
    return y + 3

def _draw_signature_box(pdf: FPDF, base_font: str, x: float, y: float, w: float, 
                        title: str, name: str = "") -> float:
    """วาดช่องลายเซ็น"""
    box_h = 35
    
    pdf.set_line_width(LINE_THIN)
    pdf.rect(x, y, w, box_h)
    
    pdf.line(x, y + 8, x + w, y + 8)
    pdf.set_font(base_font, "B", FONT_LABEL)
    pdf.set_xy(x, y + 1.5)
    pdf.cell(w, 5, title, align="C")
    
    pdf.set_line_width(0.1)
    pdf.line(x + 10, y + 25, x + w - 10, y + 25)
    
    pdf.set_font(base_font, "", FONT_SMALL)
    pdf.set_xy(x, y + 12)
    pdf.cell(w, 5, "วันที่ ......./......./.........", align="C")
    
    if name and name != "-":
        pdf.set_font(base_font, "", FONT_SMALL)
        pdf.set_xy(x, y + 27)
        pdf.cell(w, 5, f"({name})", align="C")
    else:
        pdf.set_font(base_font, "", FONT_SMALL)
        pdf.set_xy(x, y + 27)
        pdf.cell(w, 5, "(...................................)", align="C")
    
    return y + box_h

def _draw_info_list(pdf: FPDF, base_font: str, x: float, y: float, w: float, 
                    data: list) -> float:
    """วาดข้อมูลในรูปแบบ key-value list
    
    รูปแบบการแสดง:
        ป้ายชื่อ : ค่าข้อมูล
        ป้ายชื่อ : ค่าข้อมูล
    
    Parameters:
        pdf: FPDF object
        base_font: ชื่อฟอนต์
        x: ตำแหน่ง x (ซ้ายสุด)
        y: ตำแหน่ง y (บนสุด)
        w: ความกว้างของพื้นที่
        data: list ของ tuple (label, value)
    
    Returns:
        float: ตำแหน่ง y ถัดไป
    """
    pdf.set_font(base_font, "", FONT_MAIN)
    
    line_h = 5  # ความสูงของแต่ละบรรทัด
    
    # วนลูปข้อมูลและแสดง
    for label, value in data:
        if label:  # ข้ามแถวที่ว่าง
            # สร้างข้อความในรูปแบบ: label : value
            text = f"{label} : {value or '-'}"
            pdf.set_xy(x, y)
            pdf.cell(w, line_h, text, align="L")
            y += line_h
    
    return y + 2

def make_cm_report_pdf_bytes(doc: dict) -> bytes:
    """สร้างเอกสารแจ้งซ่อมแบบทางการ"""
    
    pdf = HTML2PDF(unit="mm", format="A4")
    pdf.set_margins(left=15, top=15, right=15)
    pdf.set_auto_page_break(auto=False)
    
    base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
    pdf.set_font(base_font, size=FONT_MAIN)
    
    # ===== หน้าที่ 1 =====
    pdf.add_page()
    _draw_page_border(pdf)
    
    x = 15
    w = pdf.w - 30
    
    y = _draw_header(
        pdf,
        base_font,
        issue_id=doc.get("issue_id", "-"),
        doc_name=doc.get("doc_name", "-"),
        label_page="หน้า",
        label_issue_id="เลขที่เอกสาร",
        label_doc_name="ชื่อเอกสาร",
        addr_line1="การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)",
        addr_line2="เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย จังหวัดนนทบุรี 11130",
        addr_line3="ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416"
    )
    y += 2
    
    y = _draw_doc_title(pdf, base_font, x, y, w)
    y += 2
    
    # ===== ส่วนที่ 1: ข้อมูลการแจ้ง =====
    y = _draw_section_title(pdf, base_font, x, y, w, "ข้อมูลการแจ้ง", "1")
    y += 1
    
    report_data = [
        ("วันที่แจ้ง", _fmt_date_thai(doc.get("found_date"))),
        ("สถานที่", doc.get("location", "-")),
        ("ผู้แจ้ง", doc.get("reported_by", "-")),
        # ("สถานะ", doc.get("status", "-"))
    ]
    # y = _draw_info_table(pdf, base_font, x, y, w, report_data, cols=2)
    y = _draw_info_list(pdf, base_font, x, y, w, report_data)
    y += 1
    
    # ===== ส่วนที่ 2: รายละเอียดปัญหา =====
    y = _draw_section_title(pdf, base_font, x, y, w, "รายละเอียดปัญหา", "2")
    
    problem_data = [
        ("ประเภทปัญหา", doc.get("problem_type", "-")),
        ("อุปกรณ์ที่เสียหาย", doc.get("faulty_equipment", "-")),
        ("ความรุนแรง", doc.get("severity", "-")),
        ("", "")
    ]
    # y = _draw_info_table(pdf, base_font, x, y, w, problem_data, cols=2)
    y = _draw_info_list(pdf, base_font, x, y, w, problem_data)
    y += 2
    
    y = _draw_text_area(pdf, base_font, x, y, w, "รายละเอียดปัญหา:", doc.get("problem_details", "-"), 25)
    
    remarks_open = doc.get("remarks_open", "")
    if remarks_open and remarks_open != "-":
        y = _draw_text_area(pdf, base_font, x, y, w, "หมายเหตุ:", remarks_open, 15)
        y -= 5
    
    photos_obj = doc.get("photos", {}) or doc.get("photos_problem", {})
    cm_photos = photos_obj.get("cm_photos", [])
    
    if cm_photos:
        if y > pdf.h - 85:
            pdf.add_page()
            _draw_page_border(pdf)
            y = _draw_header(
                pdf, base_font,
                issue_id=doc.get("issue_id", "-"),
                doc_name=doc.get("doc_name", "-"),
                label_page="หน้า",
                label_issue_id="เลขที่เอกสาร",
                label_doc_name="ชื่อเอกสาร",
                addr_line1="การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย",
                addr_line2="53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130",
                addr_line3="Tel. 02-114-3350"
            )
            y += 1
        
        y += 4
        y = _draw_photo_section(pdf, base_font, x, y, w, cm_photos[:9], "รูปภาพประกอบปัญหา", cols=3)
    
    # ===== หน้าใหม่สำหรับการแก้ไข =====
    pdf.add_page()
    _draw_page_border(pdf)
    y = _draw_header(
        pdf, base_font,
        issue_id=doc.get("issue_id", "-"),
        doc_name=doc.get("doc_name", "-"),
        label_page="หน้า",
        label_issue_id="เลขที่แจ้ง",
        label_doc_name="เลขที่เอกสาร",
        addr_line1="การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย",
        addr_line2="53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130",
        addr_line3="Tel. 02-114-3350"
    )
    y += 3
    
    # ===== ส่วนที่ 3: การดำเนินการแก้ไข =====
    y = _draw_section_title(pdf, base_font, x, y, w, "การดำเนินการแก้ไข", "3")
    y += 2
    
    repair_data = [
        ("วันที่เริ่มซ่อม", _fmt_date_thai(doc.get("start_repair_date"))),
        ("วันที่แก้ไขเสร็จ", _fmt_date_thai(doc.get("resolved_date"))),
        ("ผู้ตรวจสอบ", doc.get("inspector", "-")),
        ("ผลการซ่อม", doc.get("repair_result", "-"))
    ]
    # y = _draw_info_table(pdf, base_font, x, y, w, repair_data, cols=2)
    y = _draw_info_list(pdf, base_font, x, y, w, repair_data)
    y += 2
    
    cause = doc.get("cause", "")
    if cause and cause != "-":
        y = _draw_text_area(pdf, base_font, x, y, w, "สาเหตุของปัญหา:", cause, 20)
    
    corrective_actions = doc.get("corrective_actions", [])
    if corrective_actions:
        for idx, action in enumerate(corrective_actions, 1):
            if y > pdf.h - 70:
                pdf.add_page()
                _draw_page_border(pdf)
                y = _draw_header(
                    pdf, base_font,
                    issue_id=doc.get("issue_id", "-"),
                    doc_name=doc.get("doc_name", "-"),
                    label_page="หน้า",
                    label_issue_id="เลขที่แจ้ง",
                    label_doc_name="เลขที่เอกสาร",
                    addr_line1="การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย",
                    addr_line2="53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130",
                    addr_line3="Tel. 02-114-3350"
                )
                y += 1
            
            y = _draw_action_detail(pdf, base_font, x, y, w, idx, action)
    
    inprogress_remarks = doc.get("inprogress_remarks", "")
    if inprogress_remarks and inprogress_remarks != "-":
        if y > pdf.h - 30:
            pdf.add_page()
            _draw_page_border(pdf)
            y = _draw_header(
                pdf, base_font,
                issue_id=doc.get("issue_id", "-"),
                doc_name=doc.get("doc_name", "-"),
                label_page="หน้า",
                label_issue_id="เลขที่แจ้ง",
                label_doc_name="เลขที่เอกสาร",
                addr_line1="การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย",
                addr_line2="53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130",
                addr_line3="Tel. 02-114-3350"
            )
            y += 3
        
        y = _draw_text_area(pdf, base_font, x, y, w, "หมายเหตุระหว่างดำเนินการ:", 
                           inprogress_remarks, 15)
    
    # ===== ส่วนที่ 4: การป้องกัน =====
    if y > pdf.h - 50:
        pdf.add_page()
        _draw_page_border(pdf)
        y = _draw_header(
            pdf, base_font,
            issue_id=doc.get("issue_id", "-"),
            doc_name=doc.get("doc_name", "-"),
            label_page="หน้า",
            label_issue_id="เลขที่แจ้ง",
            label_doc_name="เลขที่เอกสาร",
            addr_line1="การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย",
            addr_line2="53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130",
            addr_line3="Tel. 02-114-3350"
        )
        y += 3
    
    y = _draw_section_title(pdf, base_font, x, y, w, "การป้องกันและผลการซ่อม", "4")
    y += 2
    
    preventive_actions = doc.get("preventive_action", [])
    if preventive_actions:
        preventive_text = "\n".join(f"• {action}" for action in preventive_actions if action)
        y = _draw_text_area(pdf, base_font, x, y, w, "วิธีป้องกันไม่ให้เกิดซ้ำ:", 
                           preventive_text, 20)
    
    repair_remark = doc.get("repair_result_remark", "")
    if repair_remark and repair_remark != "-":
        y = _draw_text_area(pdf, base_font, x, y, w, "หมายเหตุผลการซ่อม:", 
                           repair_remark, 15)
    
    # ===== ส่วนลายเซ็น =====
    if y > pdf.h - 55:
        pdf.add_page()
        _draw_page_border(pdf)
        y = _draw_header(
            pdf, base_font,
            issue_id=doc.get("issue_id", "-"),
            doc_name=doc.get("doc_name", "-"),
            label_page="หน้า",
            label_issue_id="เลขที่แจ้ง",
            label_doc_name="เลขที่เอกสาร",
            addr_line1="การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย",
            addr_line2="53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130",
            addr_line3="Tel. 02-114-3350"
        )
        y += 3
    
    y += 5
    
    pdf.set_font(base_font, "B", FONT_SECTION)
    pdf.set_xy(x, y)
    pdf.cell(w, 7, "ลายเซ็นผู้เกี่ยวข้อง", align="C")
    y += 10
    
    sig_w = (w - 10) / 3
    
    _draw_signature_box(pdf, base_font, x, y, sig_w, "ผู้แจ้ง", doc.get("reported_by", ""))
    _draw_signature_box(pdf, base_font, x + sig_w + 5, y, sig_w, "ผู้ซ่อม", "")
    _draw_signature_box(pdf, base_font, x + 2*sig_w + 10, y, sig_w, "ผู้ตรวจสอบ", 
                       doc.get("inspector", ""))
    
    y += 40
    
    # ===== หมายเหตุท้ายเอกสาร =====
    pdf.set_font(base_font, "", FONT_SMALL)
    pdf.set_text_color(*GRAY_MEDIUM)
    pdf.set_xy(x, y)
    pdf.multi_cell(w, 4.5, 
                   "หมายเหตุ: เอกสารฉบับนี้ออกโดยระบบบริหารจัดการงานซ่อมบำรุง\n"
                   "สอบถามข้อมูลเพิ่มเติม โทร. 02-114-3350",
                   align="C")
    pdf.set_text_color(0, 0, 0)
    
    return _output_pdf_bytes(pdf)

def generate_pdf(data: dict, lang: str = "th") -> bytes:
    """Public API สำหรับ pdf_routes"""
    return make_cm_report_pdf_bytes(data)

# from fpdf import FPDF, HTMLMixin
# from pathlib import Path
# from datetime import datetime, date
# import os
# import re
# from typing import Optional, Tuple, List, Dict, Any, Union
# from io import BytesIO
# import math

# try:
#     import requests
# except Exception:
#     requests = None

# # -------------------- ฟอนต์ไทย --------------------
# FONT_CANDIDATES: Dict[str, List[str]] = {
#     "":  ["THSarabunNew.ttf", "TH Sarabun New.ttf", "THSarabun.ttf", "TH SarabunPSK.ttf"],
#     "B": ["THSarabunNew-Bold.ttf", "THSarabunNew Bold.ttf", "TH Sarabun New Bold.ttf", "THSarabun Bold.ttf"],
#     "I": ["THSarabunNew-Italic.ttf", "THSarabunNew Italic.ttf", "TH Sarabun New Italic.ttf", "THSarabun Italic.ttf"],
#     "BI":["THSarabunNew-BoldItalic.ttf", "THSarabunNew BoldItalic.ttf", "TH Sarabun New BoldItalic.ttf", "THSarabun BoldItalic.ttf"],
# }

# def add_all_thsarabun_fonts(pdf: FPDF, family_name: str = "THSarabun") -> bool:
#     """โหลดฟอนต์ไทย"""
#     here = Path(__file__).parent
#     search_dirs = [
#         here / "fonts",
#         here.parent / "fonts",
#         Path("C:/Windows/Fonts"),
#         Path("/Library/Fonts"),
#         Path(os.path.expanduser("~/Library/Fonts")),
#         Path("/usr/share/fonts"),
#         Path("/usr/local/share/fonts"),
#     ]
#     search_dirs = [d for d in search_dirs if d.exists()]

#     def _find_first_existing(cands: List[str]) -> Optional[Path]:
#         for d in search_dirs:
#             for fn in cands:
#                 p = d / fn
#                 if p.exists() and p.is_file():
#                     return p
#         return None

#     loaded_regular = False
#     for style, candidates in FONT_CANDIDATES.items():
#         p = _find_first_existing(candidates)
#         if not p:
#             continue
#         try:
#             pdf.add_font(family_name, style, str(p), uni=True)
#             if style == "":
#                 loaded_regular = True
#         except Exception:
#             pass
#     return loaded_regular

# # -------------------- Constants --------------------
# LINE_W_OUTER = 0.45
# LINE_W_INNER = 0.22
# PADDING_X = 2.0
# PADDING_Y = 1.2
# FONT_MAIN = 13.0
# FONT_SMALL = 13.0
# LINE_H = 6.8
# ROW_MIN_H = 9
# TITLE_H = 5.5

# ACT_MAX_COLS = 3
# ACT_IMG_H = 30
# ACT_IMG_GAP = 3

# PHOTO_MAX_PER_ROW = 2
# PHOTO_IMG_H = 60
# PHOTO_GAP = 5

# class HTML2PDF(FPDF, HTMLMixin):
#     pass

# def _split_lines(pdf: FPDF, width: float, text: str, line_h: float):
#     """แยกบรรทัดข้อความ"""
#     text = "" if text is None else str(text)
#     try:
#         lines = pdf.multi_cell(width, line_h, text, border=0, split_only=True)
#     except TypeError:
#         avg_char_w = max(pdf.get_string_width("ABCDEFGHIJKLMNOPQRSTUVWXYZ") / 26.0, 1)
#         max_chars = max(int(width / avg_char_w), 1)
#         lines, buf = [], text
#         while buf:
#             lines.append(buf[:max_chars])
#             buf = buf[max_chars:]
#     return lines, max(line_h, len(lines) * line_h)

# def _cell_text_in_box(pdf: FPDF, x: float, y: float, w: float, h: float, text: str,
#                       align="L", lh=LINE_H, valign="middle"):
#     """วาดข้อความในกรอบ"""
#     pdf.rect(x, y, w, h)
#     inner_x = x + PADDING_X
#     inner_w = w - 2 * PADDING_X
#     text = "" if text is None else str(text)
#     text = text.replace("\r\n", "\n").replace("\r", "\n")

#     def _wrap_paragraph(paragraph: str) -> List[str]:
#         words = paragraph.split(" ")
#         lines, cur = [], ""
#         for wd in words:
#             candidate = wd if not cur else (cur + " " + wd)
#             if pdf.get_string_width(candidate) <= inner_w:
#                 cur = candidate
#             else:
#                 if cur:
#                     lines.append(cur)
#                 if pdf.get_string_width(wd) <= inner_w:
#                     cur = wd
#                 else:
#                     buf = wd
#                     while buf:
#                         k = 1
#                         while k <= len(buf) and pdf.get_string_width(buf[:k]) <= inner_w:
#                             k += 1
#                         lines.append(buf[:k-1])
#                         buf = buf[k-1:]
#                     cur = ""
#         if cur:
#             lines.append(cur)
#         return lines

#     paragraphs = text.split("\n")
#     lines: List[str] = []
#     for p in paragraphs:
#         if p == "":
#             lines.append("")
#             continue
#         lines.extend(_wrap_paragraph(p))

#     content_h = max(lh, len(lines) * lh)

#     if valign == "top":
#         start_y = y + PADDING_Y
#     elif valign == "bottom":
#         start_y = y + h - content_h - PADDING_Y
#     else:
#         start_y = y + max((h - content_h) / 2.0, PADDING_Y)

#     cur_y = start_y
#     pdf.set_xy(inner_x, cur_y)
#     for ln in lines:
#         if cur_y > y + h - lh:
#             break
#         pdf.set_xy(inner_x, cur_y)
#         pdf.cell(inner_w, lh, ln, border=0, ln=1, align=align)
#         cur_y += lh
#     pdf.set_xy(x + w, y)

# def _parse_date_flex(s: str) -> Optional[datetime]:
#     """แปลงวันที่"""
#     if not s:
#         return None
#     s = str(s)
#     m = re.match(r"^\s*(\d{4})-(\d{1,2})-(\d{1,2})", s)
#     if m:
#         y, mo, d = map(int, m.groups())
#         try:
#             return datetime(y, mo, d)
#         except ValueError:
#             pass
#     for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y", "%d-%m-%Y"):
#         try:
#             return datetime.strptime(s[:19], fmt)
#         except Exception:
#             pass
#     return None

# def _fmt_date_thai(val) -> str:
#     """แปลงวันที่เป็นรูปแบบไทย"""
#     if isinstance(val, (datetime, date)):
#         d = datetime(val.year, val.month, val.day)
#     else:
#         d = _parse_date_flex(str(val)) if val is not None else None
#     if not d:
#         return str(val) if val else "-"
#     year_be = d.year + 543
#     return d.strftime(f"%d/%m/{year_be}")

# def _resolve_logo_path() -> Optional[Path]:
#     """หาไฟล์โลโก้"""
#     names = [
#         "logo_egat.png", "logo_egatev.png", "logo_egat_ev.png",
#         "egat_logo.png", "logo-ct.png", "logo_ct.png",
#     ]
#     roots = [
#         Path(__file__).parent / "assets",
#         Path(__file__).parent.parent / "assets",
#         Path(__file__).resolve().parents[3] / "public" / "img",
#         Path(__file__).resolve().parents[3] / "public" / "img" / "logo",
#     ]
#     for root in roots:
#         if not root.exists():
#             continue
#         for nm in names:
#             p = root / nm
#             if p.exists() and p.is_file():
#                 return p
#     return None

# def _guess_img_type_from_ext(path_or_url: str) -> str:
#     """เดาชนิดของไฟล์รูป"""
#     ext = os.path.splitext(str(path_or_url).lower())[1]
#     if ext in (".png",):
#         return "PNG"
#     if ext in (".jpg", ".jpeg"):
#         return "JPEG"
#     return ""

# def _load_image_source_from_urlpath(url_path: str) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
#     """โหลดรูปภาพจาก path"""
#     if not url_path:
#         return None, None

#     # หา backend/uploads
#     backend_root = Path(__file__).resolve().parents[2]
#     uploads_root = backend_root / "uploads"
    
#     if uploads_root.exists():
#         clean_path = url_path.lstrip("/")
#         if clean_path.startswith("uploads/"):
#             clean_path = clean_path[8:]
        
#         local_path = uploads_root / clean_path
#         if local_path.exists() and local_path.is_file():
#             return local_path.as_posix(), _guess_img_type_from_ext(local_path.as_posix())

#     # ลองดาวน์โหลด
#     base_url = os.getenv("PHOTOS_BASE_URL") or os.getenv("APP_BASE_URL") or ""
#     if base_url and requests is not None:
#         full_url = base_url.rstrip("/") + "/" + url_path.lstrip("/")
#         try:
#             resp = requests.get(full_url, timeout=10)
#             resp.raise_for_status()
#             bio = BytesIO(resp.content)
#             return bio, _guess_img_type_from_ext(full_url)
#         except Exception:
#             pass

#     return None, None

# def _draw_images_grid(pdf: FPDF, x: float, y: float, w: float, images: list, doc: dict) -> float:
#     """วาดรูปภาพเป็นกริด - รองรับทั้ง beforeImages และ afterImages"""
#     if not images:
#         return 0.0
    
#     inner_x = x + PADDING_X
#     inner_w = w - 2 * PADDING_X
#     slot_w = (inner_w - (ACT_MAX_COLS - 1) * ACT_IMG_GAP) / ACT_MAX_COLS

#     row_y = y + PADDING_Y
#     col = 0
    
#     # แปลง ObjectId เป็น string
#     doc_id = doc.get("_id", "")
#     if hasattr(doc_id, '__str__'):
#         doc_id = str(doc_id)
#     elif isinstance(doc_id, dict):
#         doc_id = doc_id.get("$oid", "")
    
#     station_id = doc.get("station_id", "")
    
#     for img in images:
#         if col == ACT_MAX_COLS:
#             col = 0
#             row_y += ACT_IMG_H + ACT_IMG_GAP
        
#         cx = inner_x + col * (slot_w + ACT_IMG_GAP)
        
#         # รองรับทั้ง url, path, และ name
#         url = img.get("url") or img.get("path") or ""
#         if not url and img.get("name"):
#             filename = img.get("name")
#             url = f"/uploads/cm/{station_id}/{doc_id}/corrective_actions/{filename}"
        
#         src, img_type = _load_image_source_from_urlpath(url)
        
#         try:
#             if src is not None:
#                 pdf.image(src, x=cx, y=row_y, w=slot_w, h=ACT_IMG_H, type=(img_type or None))
#             else:
#                 pdf.rect(cx, row_y, slot_w, ACT_IMG_H)
#         except Exception:
#             pdf.rect(cx, row_y, slot_w, ACT_IMG_H)
        
#         col += 1

#     rows = math.ceil(len(images) / ACT_MAX_COLS)
#     return 2 * PADDING_Y + rows * ACT_IMG_H + (rows - 1) * ACT_IMG_GAP

# def _output_pdf_bytes(pdf: FPDF) -> bytes:
#     """Output PDF เป็น bytes"""
#     data = pdf.output(dest="S")
#     if isinstance(data, (bytes, bytearray)):
#         return bytes(data)
#     return data.encode("latin1")

# # def _draw_header(
# #     pdf: FPDF,
# #     base_font: str,
# #     issue_id: str = "-",
# #     doc_name: str = "-",
# #     label_page: str = "Page",
# #     label_issue_id: str = "Issue ID",
# #     label_doc_name: str = "Doc Name",
# #     addr_line1: str = "Electricity Generating Authority of Thailand (EGAT)",
# #     addr_line2: str = "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand",
# #     addr_line3: str = "Call Center Tel. 02-114-3350",
# # ) -> float:
# #     left = pdf.l_margin
# #     right = pdf.r_margin
# #     page_w = pdf.w - left - right
# #     x0 = left
# #     y_top = 10

# #     col_left, col_mid = 35, 120
# #     col_right = page_w - col_left - col_mid

# #     h_all = 22
# #     h_right_half = h_all / 2

# #     pdf.set_line_width(LINE_W_INNER)

# #     # Page number
# #     page_text = f"{label_page} {pdf.page_no()}"
# #     pdf.set_font(base_font, "", FONT_MAIN - 1)
# #     page_text_w = pdf.get_string_width(page_text) + 4
# #     page_x = pdf.w - right - page_text_w
# #     page_y = 5
# #     pdf.set_xy(page_x, page_y)
# #     pdf.cell(page_text_w, 4, page_text, align="R")

# #     # โลโก้
# #     pdf.rect(x0, y_top, col_left, h_all)
# #     logo_path = _resolve_logo_path()
# #     if logo_path:
# #         IMG_W = 24
# #         img_x = x0 + (col_left - IMG_W) / 2
# #         img_y = y_top + (h_all - 12) / 2
# #         try:
# #             pdf.image(logo_path.as_posix(), x=img_x, y=img_y, w=IMG_W)
# #         except Exception:
# #             pass

# #     # กล่องกลาง (ที่อยู่)
# #     box_x = x0 + col_left
# #     pdf.rect(box_x, y_top, col_mid, h_all)

# #     addr_lines = [addr_line1, addr_line2, addr_line3]

# #     pdf.set_font(base_font, "B", FONT_MAIN)
# #     line_h = 4.5

# #     start_y = y_top + (h_all - line_h * len(addr_lines)) / 2

# #     for i, line in enumerate(addr_lines):
# #         pdf.set_xy(box_x + 3, start_y + i * line_h)
# #         pdf.cell(col_mid - 6, line_h, line, align="C")

# #     # กล่องขวา
# #     xr = x0 + col_left + col_mid
# #     pdf.rect(xr, y_top, col_right, h_right_half)
# #     pdf.rect(xr, y_top + h_right_half, col_right, h_right_half)

# #     # Issue ID
# #     pdf.set_xy(xr, y_top + 1)
# #     pdf.set_font(base_font, "B", FONT_MAIN - 2)
# #     pdf.multi_cell(col_right, 4.5, f"{label_issue_id}\n{issue_id}", align="C")

# #     # Doc Name
# #     pdf.set_xy(xr, y_top + h_right_half + 1)
# #     pdf.set_font(base_font, "B", FONT_MAIN - 2)
# #     pdf.multi_cell(col_right, 4.5, f"{label_doc_name}\n{doc_name}", align="C")

# #     return y_top + h_all

# def _draw_header(
#     pdf: FPDF,
#     base_font: str,
#     issue_id: str = "-",
#     doc_name: str = "-",
#     label_page: str = "Page",
#     label_issue_id: str = "Issue ID",
#     label_doc_name: str = "Doc Name",
#     addr_line1: str = "Electricity Generating Authority of Thailand (EGAT)",
#     addr_line2: str = "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand",
#     addr_line3: str = "Call Center Tel. 02-114-3350",
# ) -> float:
#     # ปรับให้ชิดขอบเส้นนอก (border_margin = 5 ใน _draw_page_border)
#     border_margin = 5
#     x0 = border_margin + 1  # 6 mm จากขอบซ้าย
#     y_top = border_margin + 1  # 6 mm จากขอบบน
#     page_w = pdf.w - 2 * (border_margin + 1)  # ความกว้างเต็มพื้นที่

#     col_left, col_mid = 35, 120
#     col_right = page_w - col_left - col_mid

#     h_all = 22
#     h_right_half = h_all / 2

#     pdf.set_line_width(LINE_W_INNER)

#     # Page number
#     page_text = f"{label_page} {pdf.page_no()}"
#     pdf.set_font(base_font, "", FONT_MAIN - 1)
#     page_text_w = pdf.get_string_width(page_text) + 4
#     page_x = pdf.w - (border_margin + 1) - page_text_w
#     page_y = 5
#     pdf.set_xy(page_x, page_y)
#     pdf.cell(page_text_w, 4, page_text, align="R")

#     # เส้นแบ่งแนวตั้ง (Vertical lines)
#     # เส้นแบ่งระหว่างโลโก้กับที่อยู่
#     pdf.line(x0 + col_left, y_top, x0 + col_left, y_top + h_all)
#     # เส้นแบ่งระหว่างที่อยู่กับ Issue ID/Doc Name
#     pdf.line(x0 + col_left + col_mid, y_top, x0 + col_left + col_mid, y_top + h_all)
    
#     # เส้นแบ่งแนวนอน (Horizontal line) ระหว่าง Issue ID และ Doc Name
#     xr = x0 + col_left + col_mid
#     pdf.line(xr, y_top + h_right_half, xr + col_right, y_top + h_right_half)

#     # โลโก้
#     logo_path = _resolve_logo_path()
#     if logo_path:
#         IMG_W = 24
#         img_x = x0 + (col_left - IMG_W) / 2
#         img_y = y_top + (h_all - 12) / 2
#         try:
#             pdf.image(logo_path.as_posix(), x=img_x, y=img_y, w=IMG_W)
#         except Exception:
#             pass

#     # กล่องกลาง (ที่อยู่)
#     box_x = x0 + col_left

#     addr_lines = [addr_line1, addr_line2, addr_line3]

#     pdf.set_font(base_font, "B", FONT_MAIN)
#     line_h = 4.5

#     start_y = y_top + (h_all - line_h * len(addr_lines)) / 2

#     for i, line in enumerate(addr_lines):
#         pdf.set_xy(box_x + 3, start_y + i * line_h)
#         pdf.cell(col_mid - 6, line_h, line, align="C")

#     # Issue ID
#     pdf.set_xy(xr, y_top + 1)
#     pdf.set_font(base_font, "B", FONT_MAIN - 2)
#     pdf.multi_cell(col_right, 4.5, f"{label_issue_id}\n{issue_id}", align="C")

#     # Doc Name
#     pdf.set_xy(xr, y_top + h_right_half + 1)
#     pdf.set_font(base_font, "B", FONT_MAIN - 2)
#     pdf.multi_cell(col_right, 4.5, f"{label_doc_name}\n{doc_name}", align="C")

#     return y_top + h_all

# # -------------------- Drawing – job / summary blocks --------------------
# # def _draw_job_info_block(
# #     pdf: FPDF, 
# #     base_font: str, 
# #     x: float, 
# #     y: float, 
# #     w: float,
# #     found_date: str,      # วันที่แจ้ง
# #     location: str,        # สถานที่
# #     reported_by: str,     # ผู้แจ้งปัญหา
# #     label_found_date: str = "วันที่แจ้ง",
# #     label_location: str = "สถานที่",
# #     label_reported_by: str = "ผู้แจ้งปัญหา",
# # ) -> float:
# #     row_h = 6.5
# #     label_w = 30
# #     box_h = row_h * 3  # 3 แถว
    
# #     # วาดกรอบนอก
# #     pdf.set_line_width(LINE_W_INNER)
# #     pdf.rect(x, y, w, box_h)
    
# #     # วาดเส้นแบ่งแถว
# #     pdf.line(x, y + row_h, x + w, y + row_h)
# #     pdf.line(x, y + row_h * 2, x + w, y + row_h * 2)

# #     def _item(x0, y0, label, value):
# #         pdf.set_xy(x0 + 2, y0 + 1.5)
# #         pdf.set_font(base_font, "B", FONT_MAIN)
# #         pdf.cell(label_w, row_h - 3, label, border=0, align="L")
# #         pdf.set_font(base_font, "", FONT_MAIN)
# #         pdf.set_xy(x0 + 2 + label_w, y0 + 1.5)
# #         pdf.cell(w - label_w - 4, row_h - 3, str(value or "-"), border=0, align="L")

# #     # แสดงข้อมูล 3 แถว
# #     _item(x, y, label_found_date, found_date)
# #     _item(x, y + row_h, label_location, location)
# #     _item(x, y + row_h * 2, label_reported_by, reported_by)

# #     return y + box_h

# def _draw_job_info_block(
#     pdf: FPDF, 
#     base_font: str, 
#     x: float, 
#     y: float, 
#     w: float,
#     found_date: str,      # วันที่แจ้ง
#     location: str,        # สถานที่
#     reported_by: str,     # ผู้แจ้งปัญหา
#     label_found_date: str = "วันที่แจ้ง",
#     label_location: str = "สถานที่",
#     label_reported_by: str = "ผู้แจ้งปัญหา",
# ) -> float:
#     row_h = 6.5
#     label_w = 30
#     box_h = row_h * 3  # 3 แถว
    
#     # วาดกรอบนอก
#     # pdf.set_line_width(LINE_W_INNER)
#     # pdf.rect(x, y, w, box_h)
    
#     # วาดเส้นแบ่งแถว
#     pdf.line(x, y + row_h, x + w, y + row_h)
#     pdf.line(x, y + row_h * 2, x + w, y + row_h * 2)

#     def _item(x0, y0, label, value):
#         # ✅ ไม่มี padding ซ้ายขวา (ลบ +2 และ -4)
#         pdf.set_xy(x0, y0 + 1.5)
#         pdf.set_font(base_font, "B", FONT_MAIN)
#         pdf.cell(label_w, row_h - 3, label, border=0, align="L")
#         pdf.set_font(base_font, "", FONT_MAIN)
#         pdf.set_xy(x0 + label_w, y0 + 1.5)
#         pdf.cell(w - label_w, row_h - 3, str(value or "-"), border=0, align="L")

#     # แสดงข้อมูล 3 แถว
#     _item(x, y, label_found_date, found_date)
#     _item(x, y + row_h, label_location, location)
#     _item(x, y + row_h * 2, label_reported_by, reported_by)

#     return y + box_h

# # def _draw_job_info_block(
# #     pdf: FPDF, 
# #     base_font: str, 
# #     x: float, 
# #     y: float, 
# #     w: float,
# #     found_date: str,      # วันที่แจ้ง
# #     location: str,        # สถานที่
# #     reported_by: str,     # ผู้แจ้งปัญหา
# #     label_found_date: str = "วันที่แจ้ง",
# #     label_location: str = "สถานที่",
# #     label_reported_by: str = "ผู้แจ้งปัญหา",
# # ) -> float:
# #     """
# #     วาดส่วนข้อมูลพื้นฐานแบบฟอร์ม 3 คอลัมน์
# #     มีเส้นใต้สำหรับกรอกข้อมูล
# #     """
    
# #     pdf.set_line_width(LINE_W_INNER)
    
# #     inner_x = x + 5
# #     inner_w = w - 10
# #     row_h = 9
    
# #     # คำนวณความกว้าง label
# #     pdf.set_font(base_font, "", FONT_MAIN)
# #     date_label_w = pdf.get_string_width(label_found_date + " :") + 2
# #     location_label_w = pdf.get_string_width(label_location + " :") + 2
# #     reporter_label_w = pdf.get_string_width(label_reported_by + " :") + 2
    
# #     # จัด 3 คอลัมน์
# #     col_w = inner_w / 3  # แบ่งเป็น 3 ส่วนเท่าๆ กัน
# #     col_gap = 5  # ระยะห่างระหว่างคอลัมน์
    
# #     # ========== คอลัมน์ 1: วันที่แจ้ง ==========
# #     col1_x = inner_x
# #     pdf.set_font(base_font, "", FONT_MAIN)
# #     pdf.set_xy(col1_x, y)
# #     pdf.cell(date_label_w, row_h, f"{label_found_date} :", border=0, align="L")
    
# #     value1_x = col1_x + date_label_w
# #     value1_w = col_w - date_label_w - col_gap
    
# #     pdf.set_xy(value1_x, y)
# #     pdf.cell(value1_w, row_h, found_date, border=0, align="L")
    
# #     # เส้นใต้
# #     line_y = y + row_h - 2
# #     pdf.line(value1_x, line_y, value1_x + value1_w, line_y)
    
# #     # ========== คอลัมน์ 2: สถานที่ ==========
# #     col2_x = inner_x + col_w
# #     pdf.set_xy(col2_x, y)
# #     pdf.cell(location_label_w, row_h, f"{label_location} :", border=0, align="L")
    
# #     value2_x = col2_x + location_label_w
# #     value2_w = col_w - location_label_w - col_gap
    
# #     pdf.set_xy(value2_x, y)
# #     pdf.cell(value2_w, row_h, location, border=0, align="L")
    
# #     # เส้นใต้
# #     pdf.line(value2_x, line_y, value2_x + value2_w, line_y)
    
# #     # ========== คอลัมน์ 3: ผู้แจ้งปัญหา ==========
# #     col3_x = inner_x + 2 * col_w
# #     pdf.set_xy(col3_x, y)
# #     pdf.cell(reporter_label_w, row_h, f"{label_reported_by} :", border=0, align="L")
    
# #     value3_x = col3_x + reporter_label_w
# #     value3_w = col_w - reporter_label_w
    
# #     pdf.set_xy(value3_x, y)
# #     pdf.cell(value3_w, row_h, reported_by, border=0, align="L")
    
# #     # เส้นใต้
# #     pdf.line(value3_x, line_y, value3_x + value3_w, line_y)
    
# #     return y + row_h + 3

# def _draw_problem_details_block(
#     pdf: FPDF,
#     base_font: str,
#     x: float,
#     y: float,
#     w: float,
#     doc: dict,
#     label_title: str = "รายละเอียดปัญหา",
#     label_equipment: str = "อุปกรณ์ที่เสียหาย :",
#     label_severity: str = "ความรุนแรง :",
#     label_problem: str = "ปัญหาที่พบ :",
#     label_photos: str = "รูปภาพประกอบ",
# ) -> float:
#     """
#     วาดส่วนรายละเอียดปัญหาแบบฟอร์ม
#     มีหัวข้อขีดเส้นใต้ และช่องกรอกข้อมูลมีเส้นใต้
#     """
    
#     pdf.set_line_width(LINE_W_INNER)
    
#     # ดึงข้อมูล
#     equipment = str(doc.get("faulty_equipment", "-"))
#     severity = str(doc.get("severity", "-"))
#     problem = str(doc.get("problem_details", "-"))
    
#     # ดึงรูปภาพ
#     photos_obj = doc.get("photos", {}) or doc.get("photos_problem", {})
#     cm_photos = photos_obj.get("cm_photos", [])
    
#     start_y = y
#     inner_x = x + 5
#     inner_w = w - 10
    
#     # ========== หัวข้อ "รายละเอียดปัญหา" ==========
#     title_h = 8
#     pdf.set_font(base_font, "B", 14)
#     pdf.set_xy(inner_x, y)
#     pdf.cell(inner_w, title_h, label_title, border=0, align="L")
    
#     # เส้นใต้หัวข้อ
#     underline_y = y + title_h - 1
#     pdf.line(inner_x, underline_y, inner_x + inner_w, underline_y)
    
#     y = underline_y + 5
    
#     # ========== ข้อมูลฟอร์ม ==========
#     row_h = 9
    
#     # คำนวณความกว้าง label
#     pdf.set_font(base_font, "", FONT_MAIN)
#     equipment_label_w = pdf.get_string_width(label_equipment) + 2
#     severity_label_w = pdf.get_string_width(label_severity) + 2
#     problem_label_w = pdf.get_string_width(label_problem) + 2
    
#     # 1. อุปกรณ์ที่เสียหาย + ความรุนแรง (บรรทัดเดียวกัน แบ่ง 2 คอลัมน์)
#     col1_w = inner_w / 2  # ครึ่งซ้าย
#     col2_w = inner_w / 2  # ครึ่งขวา
    
#     # อุปกรณ์ที่เสียหาย (ซ้าย)
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(inner_x, y)
#     pdf.cell(equipment_label_w, row_h, label_equipment, border=0, align="L")
    
#     value1_x = inner_x + equipment_label_w
#     value1_w = col1_w - equipment_label_w - 10
    
#     pdf.set_xy(value1_x, y)
#     pdf.cell(value1_w, row_h, equipment, border=0, align="L")
    
#     # เส้นใต้
#     line_y = y + row_h - 2
#     pdf.line(value1_x, line_y, value1_x + value1_w, line_y)
    
#     # ความรุนแรง (ขวา)
#     col2_x = inner_x + col1_w + 10
#     pdf.set_xy(col2_x, y)
#     pdf.cell(severity_label_w, row_h, label_severity, border=0, align="L")
    
#     value2_x = col2_x + severity_label_w
#     value2_w = col2_w - severity_label_w - 10
    
#     pdf.set_xy(value2_x, y)
#     pdf.cell(value2_w, row_h, severity, border=0, align="L")
    
#     # เส้นใต้
#     pdf.line(value2_x, line_y, value2_x + value2_w, line_y)
    
#     y += row_h + 3
    
#     # 2. ปัญหาที่พบ (ใช้เต็มความกว้าง)
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(inner_x, y)
#     pdf.cell(problem_label_w, row_h, label_problem, border=0, align="L")
    
#     problem_value_x = inner_x + problem_label_w
#     problem_value_w = inner_w - problem_label_w
    
#     # คำนวณความสูงของ problem (อาจมีหลายบรรทัด)
#     _, problem_h = _split_lines(pdf, problem_value_w, problem, LINE_H)
#     problem_lines = max(1, int(problem_h / LINE_H))
#     problem_total_h = problem_lines * LINE_H + 4
    
#     pdf.set_xy(problem_value_x, y)
#     pdf.multi_cell(problem_value_w, LINE_H, problem, border=0, align="L")
    
#     # วาดเส้นใต้หลายบรรทัด
#     for i in range(problem_lines):
#         line_y = y + (i + 1) * LINE_H - 1
#         pdf.line(problem_value_x, line_y, problem_value_x + problem_value_w, line_y)
    
#     y += problem_total_h
    
#     # 3. รูปภาพประกอบ
#     if cm_photos:
#         # หัวข้อ
#         pdf.set_font(base_font, "B", FONT_MAIN + 1)
#         pdf.set_xy(inner_x, y)
#         pdf.cell(inner_w, 7, label_photos, border=0, align="L")
        
#         # เส้นใต้หัวข้อ
#         underline_y = y + 7 - 1
#         pdf.line(inner_x, underline_y, inner_x + inner_w, underline_y)
        
#         y = underline_y + 5
        
#         # วาดรูปภาพ
#         photos_per_row = PHOTO_MAX_PER_ROW
#         img_h = 50
#         img_w = (inner_w - (photos_per_row - 1) * PHOTO_GAP) / photos_per_row
        
#         for i, photo in enumerate(cm_photos):
#             row_idx = i // photos_per_row
#             col_idx = i % photos_per_row
            
#             if col_idx == 0 and row_idx > 0:
#                 y += img_h + PHOTO_GAP + 5
            
#             img_x = inner_x + col_idx * (img_w + PHOTO_GAP)
#             img_y = y
            
#             url = photo.get("url", "")
#             src, img_type = _load_image_source_from_urlpath(url)
            
#             # วาดกรอบเบาๆ
#             pdf.set_draw_color(180, 180, 180)
#             pdf.rect(img_x, img_y, img_w, img_h)
#             pdf.set_draw_color(0, 0, 0)
            
#             if src:
#                 try:
#                     pdf.image(src, x=img_x, y=img_y, w=img_w, h=img_h, type=(img_type or None))
#                 except Exception:
#                     pdf.set_font(base_font, "", FONT_SMALL)
#                     pdf.set_xy(img_x, img_y + (img_h - LINE_H) / 2)
#                     pdf.cell(img_w, LINE_H, "No Image", border=0, align="C")
        
#         # คำนวณจำนวนแถวของรูป
#         num_rows = math.ceil(len(cm_photos) / photos_per_row)
#         y += img_h * num_rows + PHOTO_GAP * (num_rows - 1) + 10
#     else:
#         y += 5
    
#     return y

# def _draw_page_border(pdf: FPDF) -> None:
#     """
#     วาดเส้นขอบรอบนอกของหน้า
#     """
#     # ระยะห่างจากขอบกระดาษ (margin)
#     border_margin = 5  # 5mm จากขอบกระดาษ
    
#     # คำนวณตำแหน่งและขนาด
#     x = border_margin
#     y = border_margin
#     w = pdf.w - 2 * border_margin
#     h = pdf.h - 2 * border_margin
    
#     # ตั้งค่าเส้นขอบ
#     pdf.set_line_width(0.2)  # ความหนาของเส้นขอบ
#     pdf.set_draw_color(0, 0, 0)  # สีดำ
    
#     # วาดกรอบรอบหน้า
#     pdf.rect(x, y, w, h)

# def _draw_photos_section(pdf: FPDF, base_font: str, x: float, y: float, w: float, doc: dict) -> float:
#     """
#     วาดส่วนรูปภาพ - แก้ไขให้รองรับ photos_problem.cm_photos จาก MongoDB
#     """
#     # ✅ รองรับทั้ง photos.cm_photos และ photos_problem.cm_photos
#     photos_obj = doc.get("photos", {}) or doc.get("photos_problem", {})
#     cm_photos = photos_obj.get("cm_photos", [])
    
#     if not cm_photos:
#         return y
    
#     # Header
#     pdf.set_font(base_font, "B", 16)
#     pdf.set_xy(x, y)
#     pdf.cell(w, 10, "รูปภาพประกอบ", border=1, ln=1, align="C")
#     y += 10
    
#     img_w = (w - PHOTO_GAP - 4) / PHOTO_MAX_PER_ROW
    
#     for i, photo in enumerate(cm_photos):
#         if i % PHOTO_MAX_PER_ROW == 0:
#             img_x = x + 2
#             if i > 0:
#                 y += PHOTO_IMG_H + 10
#         else:
#             img_x = x + 2 + (i % PHOTO_MAX_PER_ROW) * (img_w + PHOTO_GAP)
        
#         url = photo.get("url", "")
#         src, img_type = _load_image_source_from_urlpath(url)
        
#         if src:
#             try:
#                 pdf.image(src, x=img_x, y=y, w=img_w, h=PHOTO_IMG_H, type=(img_type or None))
#                 # Label
#                 pdf.set_font(base_font, "", FONT_SMALL)
#                 pdf.set_xy(img_x, y + PHOTO_IMG_H + 1)
#                 pdf.cell(img_w, 4, photo.get("filename", ""), border=0, align="C")
#             except:
#                 pdf.rect(img_x, y, img_w, PHOTO_IMG_H)
#         else:
#             pdf.rect(img_x, y, img_w, PHOTO_IMG_H)
    
#     if len(cm_photos) % PHOTO_MAX_PER_ROW == 0:
#         y += PHOTO_IMG_H + 14
#     else:
#         y += PHOTO_IMG_H + 14
    
#     return y

# def make_cm_report_pdf_bytes(doc: dict) -> bytes:
#     """
#     สร้าง CM Report PDF - แก้ไขให้รองรับโครงสร้างข้อมูลจาก MongoDB
#     """

#     doc_title_cm = "Corrective Maintenance "
    
    
#     pdf = HTML2PDF(unit="mm", format="A4")
#     pdf.set_margins(left=10, top=10, right=10)
#     pdf.set_auto_page_break(auto=True, margin=12)
    
#     # โหลดฟอนต์
#     base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
#     pdf.set_font(base_font, size=FONT_MAIN)
#     pdf.set_line_width(LINE_W_INNER)
    
#     issue_id = str(doc.get("issue_id", "-"))
#     doc_name = str(doc.get("doc_name", "-"))
    
#     border_margin = 5
#     x0 = border_margin + 1  # 6 mm จากขอบซ้าย
#     page_w = pdf.w - 2 * (border_margin + 1)  # ความกว้างเต็มพื้นที่
    
#     # left = pdf.l_margin
#     # right = pdf.r_margin
#     # page_w = pdf.w - left - right
#     # x0 = left
    
#     # เริ่มหน้าแรก
#     pdf.add_page()
#     _draw_page_border(pdf)
    
#     y = _draw_header(pdf, base_font, issue_id, doc_name)
    
#     # ชื่อเอกสาร
#     # pdf.set_xy(x0, y)
#     # pdf.set_font(base_font, "B", 16)
#     # pdf.cell(page_w, 10, "Corrective Maintenance Report", border=1, ln=1, align="C")
#     # y += 10
#     pdf.set_xy(x0, y)
#     pdf.set_font(base_font, "B", 13)
#     pdf.set_fill_color(255, 230, 100)
#     pdf.cell(page_w, TITLE_H, doc_title_cm, border=1, ln=1, align="C", fill=True)
#     y += TITLE_H
    
#     y = _draw_job_info_block(
#         pdf=pdf,
#         base_font=base_font,
#         x=x0,
#         y=y,
#         w=page_w,
#         found_date=_fmt_date_thai(doc.get("found_date", "-")),
#         location=str(doc.get("location", "-")),
#         reported_by=str(doc.get("reported_by", "-")),
#         label_found_date="วันที่แจ้ง",
#         label_location="สถานที่",
#         label_reported_by="ผู้แจ้งปัญหา"
#     )
    
#     y = _draw_problem_details_block(
#         pdf=pdf,
#         base_font=base_font,
#         x=x0,
#         y=y,
#         w=page_w,
#         doc=doc,
#         label_title="รายละเอียดปัญหา",
#         label_equipment="อุปกรณ์ที่เสียหาย :",
#         label_severity="ความรุนแรง :",
#         label_problem="ปัญหาที่พบ :",
#         label_photos="รูปภาพประกอบ :"
#     )
    
#     # ✅ ส่ง doc เดียว (ไม่มี job แยก)
#     # y = _draw_cm_info_block(pdf, base_font, x0, y, page_w, doc)
    
#     # ✅ รูปภาพ - รองรับ photos_problem
#     photos_obj = doc.get("photos", {}) or doc.get("photos_problem", {})
#     if photos_obj.get("cm_photos"):
#         pdf.add_page()
#         y = _draw_header(pdf, base_font, issue_id, doc_name)
#         y = _draw_photos_section(pdf, base_font, x0, y, page_w, doc)
    
#     return _output_pdf_bytes(pdf)

# def generate_pdf(data: dict, lang: str = "th") -> bytes:
#     """
#     Public API สำหรับ pdf_routes
#     รับ parameter lang เพื่อความ compatible กับ route
#     """
#     return make_cm_report_pdf_bytes(data)