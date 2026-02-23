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
    
try:
    from PIL import Image as PILImage
except Exception:
    PILImage = None

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
    pdf.set_line_width(LINE_BOLD)
    pdf.rect(5, 5, pdf.w - 10, pdf.h - 10)  

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
    """วาด Header เอกสารทางการ - เต็มกรอบ"""
    x0 = 5
    page_w = pdf.w - 10
    y_top = 5

    col_left, col_mid = 35, 120
    col_right = page_w - col_left - col_mid

    h_all = 20
    h_right_half = h_all / 2

    pdf.set_line_width(LINE_NORMAL)

    # Page number ที่มุมขวาบน
    page_text = f"{label_page} {pdf.page_no()}"
    pdf.set_font(base_font, "", FONT_SMALL)
    page_text_w = pdf.get_string_width(page_text) + 4
    page_x = pdf.w - 5 - page_text_w
    pdf.set_xy(page_x, 1)
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
    pdf.set_font(base_font, "B", FONT_LABEL)
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

    # Issue ID
    pdf.set_font(base_font, "B", FONT_SMALL)
    pdf.set_xy(xr + 1, y_top + 2)
    pdf.cell(col_right - 2, 3.5, label_issue_id, align="C")
    pdf.set_font(base_font, "", FONT_LABEL)
    pdf.set_xy(xr + 1, y_top + 5.5)
    pdf.cell(col_right - 2, 3.5, issue_id, align="C")

    # Doc Name
    pdf.set_font(base_font, "B", FONT_SMALL)
    pdf.set_xy(xr + 1, y_top + h_right_half + 2)
    pdf.cell(col_right - 2, 3.5, label_doc_name, align="C")
    pdf.set_font(base_font, "", FONT_LABEL)
    pdf.set_xy(xr + 1, y_top + h_right_half + 5.5)
    pdf.cell(col_right - 2, 3.5, doc_name, align="C")

    return y_top + h_all

def _draw_doc_title(pdf: FPDF, base_font: str, x: float, y: float, w: float) -> float:
    """วาดชื่อเอกสาร"""
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(w, 6, "ใบแจ้งซ่อมบำรุง", align="C")
    
    pdf.set_font(base_font, "", 10)
    pdf.set_xy(x, y + 5)
    pdf.cell(w, 5, "CORRECTIVE MAINTENANCE REPORT", align="C")
    
    return y + 9

def _draw_section_title(pdf: FPDF, base_font: str, x: float, y: float, w: float, 
                        title: str, number: str = "") -> float:
    """วาดหัวข้อหมวด"""
    pdf.set_font(base_font, "B", FONT_SECTION - 2)
    pdf.set_xy(x, y)
    display_text = f"{number}. {title}" if number else title
    pdf.cell(w, 6, display_text, align="L")
    
    pdf.set_line_width(LINE_THIN)
    pdf.set_draw_color(*GRAY_LIGHT)
    pdf.line(x, y + 6, x + w, y + 6)
    pdf.set_draw_color(0, 0, 0)
    
    return y + 6

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
                    label: str, text: str, min_h: float = 8) -> float:
    """วาดพื้นที่ข้อความ - ขยายตามเนื้อหาจริง"""
    pdf.set_line_width(LINE_THIN)
    pdf.rect(x, y, w, 7)
    
    pdf.set_font(base_font, "B", FONT_LABEL)
    pdf.set_xy(x + 2, y + 1)
    pdf.cell(w - 4, 5, label, align="L")
    
    y += 7
    
    pdf.set_font(base_font, "", FONT_MAIN)
    text_str = str(text or "-")
    
    # คำนวณจำนวนบรรทัดจริงจาก multi_cell width
    line_w = w - 8
    lines = 1
    for paragraph in text_str.split("\n"):
        if not paragraph:
            lines += 1
            continue
        str_w = pdf.get_string_width(paragraph)
        lines += max(1, math.ceil(str_w / line_w))
    
    actual_h = lines * 4.5 + 3  # +6 for padding top/bottom
    text_h = max(min_h, actual_h)
    
    pdf.rect(x, y, w, text_h)
    
    pdf.set_xy(x + 2, y + 2)
    pdf.multi_cell(w - 4, 4.5, text_str, align="L")
    
    return y + text_h + 1

def _draw_photo_section(pdf: FPDF, base_font: str, x: float, y: float, w: float, 
                        photos: list, title: str = "", cols: int = 3) -> float:
    """วาดส่วนรูปภาพ"""
    if not photos:
        return y
    
    if title:
        pdf.set_font(base_font, "B", FONT_LABEL)
        pdf.set_xy(x, y)
        pdf.cell(w, 6, title, align="L")
        y += 7                                     
    
    gap = 3                                            
    img_w = (w - (cols - 1) * gap) / cols            
    img_h = img_w * 0.75
    
    pdf.set_line_width(LINE_THIN)
    
    caption_h = 2                                   
    
    for i, photo in enumerate(photos):
        row = i // cols
        col = i % cols
        
        img_x = x + col * (img_w + gap)
        img_y = y + row * (img_h + caption_h + gap)
        
        pdf.set_draw_color(*GRAY_MEDIUM)
        pdf.rect(img_x, img_y, img_w, img_h)
        
        url = photo.get("url", "")
        src, img_type = _load_image_source_from_urlpath(url)
        
        if src:
            try:
                draw_w, draw_h = img_w, img_h
                
                # อ่านขนาดจริงของรูป
                if PILImage:
                    if isinstance(src, BytesIO):
                        src.seek(0)
                    pil_img = PILImage.open(src)
                    
                    # แก้ EXIF orientation
                    exif = pil_img.getexif() if hasattr(pil_img, 'getexif') else {}
                    orientation = exif.get(274, 1)
                    if orientation == 3:
                        pil_img = pil_img.rotate(180, expand=True)
                    elif orientation == 6:
                        pil_img = pil_img.rotate(270, expand=True)
                    elif orientation == 8:
                        pil_img = pil_img.rotate(90, expand=True)
                    
                    orig_w, orig_h = pil_img.size
                    ratio = orig_w / orig_h
                    box_ratio = img_w / img_h
                    
                    if ratio >= box_ratio:
                        draw_w = img_w
                        draw_h = img_w / ratio
                    else:
                        draw_h = img_h
                        draw_w = img_h * ratio
                    
                    # save เป็น BytesIO ใหม่เสมอ (แก้ orientation + reset pointer)
                    bio = BytesIO()
                    pil_img.save(bio, format="PNG")
                    bio.seek(0)
                    src = bio
                    img_type = "PNG"
                
                # จัดกึ่งกลางในกรอบ
                cx = img_x + (img_w - draw_w) / 2
                cy = img_y + (img_h - draw_h) / 2
                
                pdf.image(src, x=cx, y=cy, w=draw_w, h=draw_h, type=(img_type or None))
            except Exception:
                pdf.set_font(base_font, "", FONT_SMALL)
                pdf.set_text_color(*GRAY_MEDIUM)
                pdf.set_xy(img_x, img_y + img_h/2 - 2)
                pdf.cell(img_w, 4, "ไม่สามารถโหลดรูปได้", align="C")
                pdf.set_text_color(0, 0, 0)
    
    rows = math.ceil(len(photos) / cols)
    pdf.set_draw_color(0, 0, 0)
    
    return y + rows * (img_h + caption_h + gap) + 2 

def _draw_action_detail(pdf: FPDF, base_font: str, x: float, y: float, w: float, 
                        idx: int, action: dict) -> float:
    """วาดรายละเอียดการแก้ไข"""
    pdf.set_font(base_font, "B", FONT_MAIN - 1)
    pdf.set_xy(x, y)
    pdf.cell(w, 6, f"การดำเนินการแก้ไขที่ {idx}", align="L")
    y += 8
    
    action_text = action.get("text", "-")
    y = _draw_text_area(pdf, base_font, x, y, w, "รายละเอียดการดำเนินการ:", action_text, 8)
    
    before_imgs = action.get("beforeImages", [])
    after_imgs = action.get("afterImages", [])
    
    if before_imgs or after_imgs:
        col_w = (w - 6) / 2
        start_y = y
        max_y = y
        
        if before_imgs:
            before_y = _draw_photo_section(pdf, base_font, x, y, col_w, before_imgs, "รูปภาพก่อนแก้ไข", cols=2)
            max_y = max(max_y, before_y)
        
        if after_imgs:
            after_y = _draw_photo_section(pdf, base_font, x + col_w + 6, start_y, col_w, after_imgs, "รูปภาพหลังแก้ไข", cols=2)
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
    pdf.set_font(base_font, "", FONT_MAIN - 1)
    
    line_h = 5  # ความสูงของแต่ละบรรทัด
    
    # วนลูปข้อมูลและแสดง
    for label, value in data:
        if label:  # ข้ามแถวที่ว่าง
            # สร้างข้อความในรูปแบบ: label : value
            text = f"{label} : {value or '-'}"
            pdf.set_xy(x, y)
            pdf.cell(w, line_h, text, align="L")
            y += line_h
    
    return y + 1

def make_cm_report_pdf_bytes(doc: dict) -> bytes:
    """สร้างเอกสารแจ้งซ่อมแบบทางการ"""
    
    pdf = HTML2PDF(unit="mm", format="A4")
    pdf.set_margins(left=5, top=5, right=5)
    pdf.set_auto_page_break(auto=False)
    
    base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
    pdf.set_font(base_font, size=FONT_MAIN)
    
    # ===== หน้าที่ 1 =====
    pdf.add_page()
    _draw_page_border(pdf)
    
    x = 8
    w = pdf.w - 16
    
    y = _draw_header(pdf, base_font,
        issue_id=doc.get("issue_id", "-"),
        doc_name=doc.get("doc_name", "-"),
    )
    y += 1
    
    y = _draw_doc_title(pdf, base_font, x, y, w)
    y += 1
    
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
    y += 1
    
    problem_data = [
        ("อุปกรณ์ที่เสียหาย", doc.get("faulty_equipment", "-")),
        ("ความรุนแรง", doc.get("severity", "-")),
        ("", "")
    ]
    # y = _draw_info_table(pdf, base_font, x, y, w, problem_data, cols=2)
    y = _draw_info_list(pdf, base_font, x, y, w, problem_data)
    y += 1
    
    y = _draw_text_area(pdf, base_font, x, y, w, "ปัญหาที่พบ:", doc.get("problem_details", "-"), 8)
    
    remarks_open = doc.get("remarks_open", "")
    if remarks_open and remarks_open != "-":
        y += 1
        y = _draw_text_area(pdf, base_font, x, y, w, "หมายเหตุ:", remarks_open, 8)
        y -= 5
    
    photos_obj = doc.get("photos", {}) or doc.get("photos_problem", {})
    cm_photos = photos_obj.get("cm_photos", [])
    
    if cm_photos:
        if y > pdf.h - 85:
            pdf.add_page()
            _draw_page_border(pdf)
            y = _draw_header(pdf, base_font,
                issue_id=doc.get("issue_id", "-"),
                doc_name=doc.get("doc_name", "-"),
            )
            y += 1
        
        y += 5
        y = _draw_photo_section(pdf, base_font, x, y, w, cm_photos[:9], "รูปภาพประกอบปัญหา", cols=3)
    
    # ===== หน้าใหม่สำหรับการแก้ไข =====
    pdf.add_page()
    _draw_page_border(pdf)
    y = _draw_header(pdf, base_font,
        issue_id=doc.get("issue_id", "-"),
        doc_name=doc.get("doc_name", "-"),
    )
    y += 3
    
    # ===== ส่วนที่ 3: ปัญหาที่พบ =====
    y = _draw_section_title(pdf, base_font, x, y, w, "ปัญหาที่พบ", "3")
    y += 2
    
    problem_data = [
        ("ประเภทปัญหา", doc.get("problem_type", "-")),
        # ("สาเหตุของปัญหา", doc.get("cause", "-"))
    ]
    # y = _draw_info_table(pdf, base_font, x, y, w, repair_data, cols=2)
    y = _draw_info_list(pdf, base_font, x, y, w, problem_data)
    y += 1

    cause = doc.get("cause", "")
    if cause and cause != "-":
        y = _draw_text_area(pdf, base_font, x, y, w, "สาเหตุของปัญหา:", cause, 8)
    
    # ===== ส่วนที่ 4: การดำเนินการแก้ไข =====
    y = _draw_section_title(pdf, base_font, x, y, w, "การแก้ไข", "4")
    y += 2
    
    # แปลง repaired_equipment จาก list เป็น string
    repaired_eq = doc.get("repaired_equipment", [])
    if isinstance(repaired_eq, list):
        repaired_eq_text = ", ".join(str(e) for e in repaired_eq if e) or "-"
    else:
        repaired_eq_text = str(repaired_eq) or "-"
    
    repair_data = [
        ("วันที่เริ่มแก้ไข", _fmt_date_thai(doc.get("start_repair_date"))),
        ("วันที่แก้ไขเสร็จ", _fmt_date_thai(doc.get("resolved_date"))),
        ("อุปกรณ์ที่แก้ไข", repaired_eq_text),
        ("ผู้ตรวจสอบ", doc.get("inspector", "-")),
        ("ผลการซ่อม", doc.get("repair_result", "-"))
    ]
    # y = _draw_info_table(pdf, base_font, x, y, w, repair_data, cols=2)
    y = _draw_info_list(pdf, base_font, x, y, w, repair_data)
    y += 2

    corrective_actions = doc.get("corrective_actions", [])
    if corrective_actions:
        for idx, action in enumerate(corrective_actions, 1):
            if y > pdf.h - 70:
                pdf.add_page()
                _draw_page_border(pdf)
                y = _draw_header(pdf, base_font,
                    issue_id=doc.get("issue_id", "-"),
                    doc_name=doc.get("doc_name", "-"),
                )
                y += 1
            
            y = _draw_action_detail(pdf, base_font, x, y, w, idx, action)
    
    inprogress_remarks = doc.get("inprogress_remarks", "")
    if inprogress_remarks and inprogress_remarks != "-":
        if y > pdf.h - 30:
            pdf.add_page()
            _draw_page_border(pdf)
            y = _draw_header(pdf, base_font,
                issue_id=doc.get("issue_id", "-"),
                doc_name=doc.get("doc_name", "-"),
            )
            y += 3
        
        y = _draw_text_area(pdf, base_font, x, y, w, "หมายเหตุระหว่างดำเนินการ:", inprogress_remarks, 8)
    
    # ===== ส่วนที่ 4: การป้องกัน =====
    if y > pdf.h - 50:
        pdf.add_page()
        _draw_page_border(pdf)
        y = _draw_header(pdf, base_font,
            issue_id=doc.get("issue_id", "-"),
            doc_name=doc.get("doc_name", "-"),
        )
        y += 3
    
    y = _draw_section_title(pdf, base_font, x, y, w, "การป้องกันและผลการซ่อม", "4")
    y += 2
    
    preventive_actions = doc.get("preventive_action", [])
    if preventive_actions:
        preventive_text = "\n".join(f"{i}. {action}" for i, action in enumerate(preventive_actions, 1) if action)
        y = _draw_text_area(pdf, base_font, x, y, w, "วิธีป้องกันไม่ให้เกิดซ้ำ:", preventive_text, 8)
    
    repair_remark = doc.get("repair_result_remark", "")
    if repair_remark and repair_remark != "-":
        y = _draw_text_area(pdf, base_font, x, y, w, "หมายเหตุผลการซ่อม:", repair_remark, 8)
    
    # # ===== ส่วนลายเซ็น =====
    # if y > pdf.h - 55:
    #     pdf.add_page()
    #     _draw_page_border(pdf)
    #     y = _draw_header(pdf, base_font,
    #         issue_id=doc.get("issue_id", "-"),
    #         doc_name=doc.get("doc_name", "-"),
    #     )
    #     y += 3
    
    # y += 5
    
    # pdf.set_font(base_font, "B", FONT_SECTION)
    # pdf.set_xy(x, y)
    # pdf.cell(w, 7, "ลายเซ็นผู้เกี่ยวข้อง", align="C")
    # y += 10
    
    # sig_w = (w - 10) / 3
    
    # _draw_signature_box(pdf, base_font, x, y, sig_w, "ผู้แจ้ง", doc.get("reported_by", ""))
    # _draw_signature_box(pdf, base_font, x + sig_w + 5, y, sig_w, "ผู้ซ่อม", "")
    # _draw_signature_box(pdf, base_font, x + 2*sig_w + 10, y, sig_w, "ผู้ตรวจสอบ", 
    #                    doc.get("inspector", ""))
    
    # y += 40
    
    # # ===== หมายเหตุท้ายเอกสาร =====
    # pdf.set_font(base_font, "", FONT_SMALL)
    # pdf.set_text_color(*GRAY_MEDIUM)
    # pdf.set_xy(x, y)
    # pdf.multi_cell(w, 4.5, 
    #                "หมายเหตุ: เอกสารฉบับนี้ออกโดยระบบบริหารจัดการงานซ่อมบำรุง\n"
    #                "สอบถามข้อมูลเพิ่มเติม โทร. 02-114-3350",
    #                align="C")
    # pdf.set_text_color(0, 0, 0)
    
    return _output_pdf_bytes(pdf)

def generate_pdf(data: dict, lang: str = "th") -> bytes:
    """Public API สำหรับ pdf_routes"""
    return make_cm_report_pdf_bytes(data)