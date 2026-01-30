import os
import re
import base64
import json

from fpdf import FPDF, HTMLMixin
from pathlib import Path
from datetime import datetime, date
from typing import Optional, Tuple, List, Dict, Any, Union
from PIL import Image, ImageOps
from io import BytesIO

    
# ★★★ เพิ่ม import สำหรับรวม PDF ★★★
try:
    from PyPDF2 import PdfMerger, PdfReader, PdfWriter
    HAS_PYPDF2 = True
except ImportError:
    HAS_PYPDF2 = False
    PdfMerger = None 
    PdfReader = None 
    PdfWriter = None 
    print("[Warning] PyPDF2 not installed. PDF merging disabled.")

try:
    import requests   # optional ถ้าไม่มี base_url ก็ไม่จำเป็น
except Exception:
    requests = None

# -------------------- ฟอนต์ไทย --------------------
FONT_CANDIDATES: Dict[str, List[str]] = {
    "":  ["THSarabunNew.ttf", "TH Sarabun New.ttf", "THSarabun.ttf", "TH SarabunPSK.ttf"],
    "B": ["THSarabunNew-Bold.ttf", "THSarabunNew Bold.ttf", "TH Sarabun New Bold.ttf", "THSarabun Bold.ttf"],
    "I": ["THSarabunNew-Italic.ttf", "THSarabunNew Italic.ttf", "TH Sarabun New Italic.ttf", "THSarabun Italic.ttf"],
    "BI":["THSarabunNew-BoldItalic.ttf", "THSarabunNew BoldItalic.ttf", "TH Sarabun New BoldItalic.ttf", "THSarabun BoldItalic.ttf"],
}

# เพิ่มฟอนต์สำหรับสัญลักษณ์พิเศษ (Ω, °C, ฯลฯ)
UNICODE_FONT_CANDIDATES: List[str] = [
    "DejaVuSans.ttf",
    "DejaVuSansCondensed.ttf", 
    "LiberationSans-Regular.ttf",
    "FreeSans.ttf",
    "Arial.ttf",
    "ArialUnicode.ttf",
]

# Font Configuration
FONT_CONFIG = {
    "en": {
        "main": 12.0,
        "small": 12.0,
        "header": 20.0,
        "line_h": 4.8,
        "line_h_header": 4.0,
        "row_min_h": 6.5,
    },
    "th": {
        "main": 11.0,      
        "small": 11.0,    
        "header": 16.0,   
        "line_h": 4.8,  
        "line_h_header": 4.0, 
        "row_min_h": 6.5,  
    }
}

TRANSLATIONS = {
    "th": {
        "page": "หน้า",
        "ev_charger_safety_test": "การทดสอบความปลอดภัยเครื่องชาร์จ EV",
        "issue_id": "รหัสเอกสาร",
        "manufacturer": "ผู้ผลิต",
        "model": "รุ่น",
        "power": "กำลังไฟ",
        "serial_number": "หมายเลขเครื่อง",
        "location": "สถานที่",
        "firmware_version": "เวอร์ชันเฟิร์มแวร์",
        "inspection_date": "วันที่ตรวจสอบ",
        "equipment_identification_details": "รายละเอียดอุปกรณ์ทดสอบ",
        "testing_topics_safety": "หัวข้อทดสอบความปลอดภัย (ด้านแหล่งจ่ายไฟ/อินพุต)",
        "phase_sequence": "ลำดับเฟส",
        "testing_checklist": "รายการตรวจสอบ",
        "test_results": "ผลการทดสอบ (บันทึกผ่าน/ไม่ผ่าน) หรือค่าตัวเลข",
        "1st_test": "ทดสอบครั้งที่ 1",
        "2nd_test": "ทดสอบครั้งที่ 2",
        "3rd_test": "ทดสอบครั้งที่ 3",
        "remark": "หมายเหตุ",
        "electrical_safety": "ความปลอดภัยทางไฟฟ้า",
        "pe_continuity": "PE.Continuity",
        "protective": "ตัวนำป้องกัน",
        "conductors_of": "ของ",
        "charger": "เครื่องชาร์จ",
        "left_cover": "ฝาครอบซ้าย",
        "right_cover": "ฝาครอบขวา",
        "front_cover": "ฝาครอบหน้า",
        "back_cover": "ฝาครอบหลัง",
        "pin_pe_h1": "Pin PE H.1",
        "pin_pe_h2": "Pin PE H.2",
        "rcd_type_a": "RCD ประเภท A",
        "rcd_type_f": "RCD ประเภท F",
        "rcd_type_b": "RCD ประเภท B",
        "isolation_transformer": "หม้อแปลงแยก",
        "power_standby": "พลังงานขณะสแตนด์บาย",
        "charging_process_testing": "การทดสอบกระบวนการชาร์จ",
        "charger_safety": "ความปลอดภัยเครื่องชาร์จ",
        "h1": "H.1",
        "h2": "H.2",
        "ccs2": "CCS2",
        "none_normal_operate": "ไม่มี (ทำงานปกติ)",
        "cp_short_120_ohm": "CP ลัดวงจร -120 โอห์ม",
        "pe_pp_cut": "PE-PP ตัด",
        "remote_stop": "หยุดจากระยะไกล",
        "emergency": "ฉุกเฉิน",
        "ldc_plus": "LDC +",
        "ldc_minus": "LDC -",
        "photos": "รูปภาพ",
        "nameplate": "ป้ายชื่อ",
        "testing_equipment": "เครื่องมือทดสอบ",
        "testing_equipment_nameplate": "Nameplate ของเครื่องมือทดสอบ",
        "gun1": "หัวชาร์จที่ 1",
        "gun2": "หัวชาร์จที่ 2",
        "responsibility": "หน้าที่รับผิดชอบ",
        "performed_by": "ดำเนินการโดย",
        "approved_by": "อนุมัติโดย",
        "witnessed_by": "เป็นพยานโดย",
        "name": "ชื่อ",
        "signature": "ลายเซ็น",
        "date": "วันที่",
        "company": "บริษัท",
        "question": "ข้อ / คำถาม",
        "photo_attachment": "รูปภาพประกอบ",
        "attachments": "ไฟล์แนบ",
        "attached_test_files": "ไฟล์ทดสอบที่แนบมา",
        "round": "รอบที่",
        "no": "ลำดับ",
        "test_item": "รายการทดสอบ",
        "gun": "หัวชาร์จ",
        "filename": "ชื่อไฟล์",
        "total": "รวม",
        "files": "ไฟล์",
        "pdfs_merged_click": "PDF(s) ที่รวมแล้ว - คลิกเลขหน้าเพื่อไปยังหน้านั้น",
        "non_pdf": "ไฟล์ที่ไม่ใช่ PDF",
        "pdfs_merged_click": "PDF(s) ที่รวมแล้ว - คลิกเลขหน้าเพื่อไปยังหน้านั้น",
        "non_pdf": "ไฟล์ที่ไม่ใช่ PDF",
        "item": "รายการที่",
        "electrical_item": "รายการทดสอบไฟฟ้าที่",
        "na": "ไม่มี",
    },
    "en": {
        "page": "Page",
        "ev_charger_safety_test": "EV Charger Safety Test",
        "issue_id": "Issue ID",
        "manufacturer": "Manufacturer",
        "model": "Model",
        "power": "Power",
        "serial_number": "Serial Number",
        "location": "Location",
        "firmware_version": "Firmware Version",
        "inspection_date": "Inspection Date",
        "equipment_identification_details": "Equipment Identification Details",
        "testing_topics_safety": "Testing Topics for Safety (Specifically Power Supply/Input Side)",
        "phase_sequence": "Phase Sequence",
        "testing_checklist": "Testing Checklist",
        "test_results": "Test Results (Record as Pass/Fail) or Numeric Results",
        "1st_test": "1st TEST",
        "2nd_test": "2nd TEST",
        "3rd_test": "3rd TEST",
        "remark": "Remark",
        "electrical_safety": "Electrical Safety",
        "pe_continuity": "PE.Continuity",
        "protective": "protective",
        "conductors_of": "Conductors of",
        "charger": "Charger",
        "left_cover": "Left Cover",
        "right_cover": "Right Cover",
        "front_cover": "Front Cover",
        "back_cover": "Back Cover",
        "pin_pe_h1": "Pin PE H.1",
        "pin_pe_h2": "Pin PE H.2",
        "rcd_type_a": "RCD type A",
        "rcd_type_f": "RCD type F",
        "rcd_type_b": "RCD type B",
        "isolation_transformer": "Isolation Transformer",
        "power_standby": "Power standby",
        "charging_process_testing": "Charging Process Testing",
        "charger_safety": "Charger Safety",
        "h1": "H.1",
        "h2": "H.2",
        "ccs2": "CCS2",
        "none_normal_operate": "None (Normal operate)",
        "cp_short_120_ohm": "CP short -120 Ohm",
        "pe_pp_cut": "PE-PP-Cut",
        "remote_stop": "Remote Stop",
        "emergency": "Emergency",
        "ldc_plus": "LDC +",
        "ldc_minus": "LDC -",
        "photos": "Photos",
        "nameplate": "Nameplate",
        "testing_equipment": "Testing Equipment",
        "testing_equipment_nameplate": "Testing Equipment Nameplate",
        "gun1": "GUN 1",
        "gun2": "GUN 2",
        "responsibility": "Responsibility",
        "performed_by": "Performed by",
        "approved_by": "Approved by",
        "witnessed_by": "Witnessed by",
        "name": "Name",
        "signature": "Signature",
        "date": "Date",
        "company": "Company",
        "question": "Question / Item",
        "photo_attachment": "Photo Attachment",
        "attachments": "Attachments",
        "attached_test_files": "Attached Test Files",
        "round": "Round",
        "no": "No.",
        "test_item": "Test Item",
        "gun": "Gun",
        "filename": "Filename",
        "total": "Total",
        "files": "file(s)",
        "pdfs_merged_click": "PDF(s) merged - Click page number to jump",
        "non_pdf": "non-PDF",
        "pdfs_merged_click": "PDF(s) merged - Click page number to jump",
        "non_pdf": "non-PDF",
        "item": "Item",
        "electrical_item": "Electrical Item",
        "na": "N/A",
    }
}

# Mapping ชื่อรายการทดสอบ (สำหรับ bookmark - ใช้ภาษาอังกฤษ)
TEST_ITEMS_CHARGER = [
    "None (Normal operate)",
    "CP short -120 Ohm",
    "PE-PP-Cut",
    "Remote Stop",
    "Emergency",
    "LDC +",
    "LDC -",
]

# mapping จาก index ไป translation key
TEST_ITEMS_KEYS = [
    "none_normal_operate",
    "cp_short_120_ohm",
    "pe_pp_cut",
    "remote_stop",
    "emergency",
    "ldc_plus",
    "ldc_minus",
]

def get_text(lang: str, key: str) -> str:
    """ดึงข้อความตามภาษาที่เลือก"""
    lang = lang.lower() if lang else "en"
    if lang not in ["th", "en"]:
        lang = "en"
    return TRANSLATIONS[lang].get(key, TRANSLATIONS["en"].get(key, key))


def add_all_thsarabun_fonts(pdf: FPDF, family_name: str = "THSarabun") -> bool:
    here = Path(__file__).parent
    search_dirs = [
        here / "fonts",               # backend/pdf/templates/fonts
        here.parent / "fonts",        # backend/pdf/fonts ตรงกับที่คุณเก็บไว้
        Path("C:/Windows/Fonts"),     # Windows
        Path("/Library/Fonts"),       # macOS system
        Path(os.path.expanduser("~/Library/Fonts")),  # macOS user
        Path("/usr/share/fonts"),     # Linux
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

    unicode_font_loaded = False
    unicode_path = _find_first_existing(UNICODE_FONT_CANDIDATES)
    if unicode_path:
        try:
            pdf.add_font("Unicode", "", str(unicode_path), uni=True)
            unicode_font_loaded = True
        except Exception:
            pass
    
    if not unicode_font_loaded:
        try:
            pdf.add_font("Unicode", "", "", uni=False)  # Arial default
        except:
            pass

    return loaded_regular


# -------------------- Helpers / Layout constants --------------------
LINE_W_OUTER = 0.22
LINE_W_INNER = 0.22
PADDING_X = 1.0
PADDING_Y = 0.5

FONT_MAIN = FONT_CONFIG["en"]["main"]    
FONT_SMALL = FONT_CONFIG["en"]["small"]  
LINE_H = FONT_CONFIG["en"]["line_h"]   
LINE_H_HEADER = FONT_CONFIG["en"]["line_h_header"] 
ROW_MIN_H = FONT_CONFIG["en"]["row_min_h"]          
CHECKBOX_SIZE = 4.0

class HTML2PDF(FPDF, HTMLMixin):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.signature_data = None
        self.base_font_name = "THSarabun"
        self.show_signature_footer = False
        self.lang = "en"

    def header(self):
        self.set_font(self.base_font_name, "", FONT_MAIN)
        page_text = f"{get_text(self.lang, 'page')} {self.page_no()}"
        self.set_xy(self.w - 25, 3)
        self.cell(20, 5, page_text, 0, 0, "R")

    def footer(self):
        # วาดส่วนลายเซ็นที่ footer
        if self.show_signature_footer and self.signature_data:
            _draw_signature_footer(self, self.base_font_name, self.signature_data, self.lang)

def draw_text_with_omega(pdf: FPDF, x: float, y: float, w: float, h: float,
                         value: str, base_font: str, align: str = "C"):
    """วาดข้อความที่มี Ω โดยใช้ Symbol font (ขนาดเล็กลง)"""
    if not value or "Ω" not in str(value):
        pdf.set_xy(x, y)
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.cell(w, h, str(value), border=0, align=align)
        return
    
    text = str(value)
    parts = text.split("Ω")
    
    pdf.set_font(base_font, "", FONT_MAIN)
    text_before = parts[0]
    w_before = pdf.get_string_width(text_before)
    
    omega_size = FONT_MAIN * 0.75  
    pdf.set_font("Symbol", "", omega_size)
    w_omega = pdf.get_string_width("W")
    
    total_w = w_before + w_omega
    
    if align == "C":
        start_x = x + (w - total_w) / 2
    elif align == "R":
        start_x = x + w - total_w
    else:
        start_x = x
    
    # วาดข้อความก่อน Ω
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(start_x, y)
    pdf.cell(w_before, h, text_before, border=0)
  
    pdf.set_font("Symbol", "", omega_size)
    offset_y = (FONT_MAIN - omega_size) * 0.15  
    pdf.set_xy(start_x + w_before, y + offset_y)
    pdf.cell(w_omega, h, "W", border=0)
    
    pdf.set_font(base_font, "", FONT_MAIN)

def _draw_check(pdf: FPDF, x: float, y: float, size: float, checked: bool):
    pdf.rect(x, y, size, size)
    if checked:
        lw_old = pdf.line_width
        pdf.set_line_width(0.6)
        
        p1_x, p1_y = x + pad, y + (size * 0.55)
        p2_x, p2_y = x + (size * 0.40), y + size - pad
        p3_x, p3_y = x + size - pad, y + pad
        
        pdf.line(p1_x, p1_y, p2_x, p2_y)
        pdf.line(p2_x, p2_y, p3_x, p3_y)
        
        pdf.set_line_width(lw_old)
        
    elif style == "cross":
        lw_old = pdf.line_width
        pdf.set_line_width(0.6) 
        
        pdf.line(x + pad, y + pad, x + size - pad, y + size - pad)
        pdf.line(x + pad, y + size - pad, x + size - pad, y + pad)
        
        pdf.set_line_width(lw_old)

def _norm_result(val: str) -> str:
    s = (str(val) if val is not None else "").strip().lower()
    if s in ("pass", "p", "true", "ok", "1", "✔", "✓"):
        return "pass"
    if s in ("fail", "f", "false", "0", "x", "✗", "✕"):
        return "fail"
    return "na"

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

def _cell_text_in_box(pdf: FPDF, x: float, y: float, w: float, h: float, text: str,
                      align="L", lh=LINE_H, valign="middle"):
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
                        while k <= len(buf) and pdf.get_string_width(buf[:k]) <= inner_w:
                            k += 1
                        lines.append(buf[:k-1])
                        buf = buf[k-1:]
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

def _output_pdf_bytes(pdf: FPDF) -> bytes:
    data = pdf.output(dest="S")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    return data.encode("latin1")


def _draw_header(pdf: FPDF, base_font: str, issue_id: str = "-", lang: str = "en", inset_mm: float = 6.0) -> float:
    page_w = pdf.w - 2*inset_mm
    x0 = inset_mm
    y_top = inset_mm + 2

    col_left, col_mid = 40, 120
    col_right = page_w - col_left - col_mid

    h_all = 10
    h_right_top = 10

    pdf.set_line_width(LINE_W_INNER)
    
    # โลโก้
    pdf.rect(x0, y_top, col_left, h_all)
    logo_path = _resolve_logo_path()
    if logo_path:
        IMG_W = 28
        
        try:
            from PIL import Image
            with Image.open(logo_path) as img:
                orig_w, orig_h = img.size
                aspect_ratio = orig_h / orig_w
                IMG_H = IMG_W * aspect_ratio
            
            img_x = x0 + (col_left - IMG_W) / 2
            img_y = y_top + (h_all - IMG_H) / 2
            
            pdf.image(logo_path.as_posix(), x=img_x, y=img_y, w=IMG_W)
        except Exception:
            pass

    # กล่องกลาง
    box_x = x0 + col_left
    pdf.rect(box_x, y_top, col_mid, h_all)

    pdf.set_font(base_font, "B", 20)
    start_y = y_top + (h_all - LINE_H_HEADER) / 2

    pdf.set_xy(box_x + 3, start_y)
    pdf.cell(col_mid - 6, LINE_H_HEADER, get_text(lang, "ev_charger_safety_test"), align="C")

    # กล่องขวา (Issue ID)
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_all)

    pdf.set_xy(xr, y_top + 1)
    pdf.set_font(base_font, "B", FONT_MAIN - 1)
    pdf.multi_cell(col_right, LINE_H_HEADER, f"{get_text(lang, 'issue_id')}\n{issue_id}", align="C")

    return y_top + h_all

def _kv_underline(pdf: FPDF, base_font: str, x: float, y: float, w: float,
                  label: str, value: str = "", row_h: float = 8.0,
                  label_w: float = 28.0, colon_w: float = 3.0):
    min_gap = 4.5
    eff_label_w = min(label_w, max(w - colon_w - min_gap, 12.0))

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(eff_label_w, row_h, label, border=0, align="L")
    pdf.cell(colon_w, row_h, ":", border=0, align="C")

    lx1 = x + eff_label_w + colon_w + 1.5
    lx2 = x + w - 2.0
    ly  = y + row_h - 1.0

    lw_old = pdf.line_width
    pdf.set_line_width(0.22)

    if lx2 > lx1 + 1.0:
        pdf.line(lx1, ly, lx2, ly)

    pdf.set_line_width(lw_old)

    if value and str(value).strip() != "-":
        text_x = x + eff_label_w + colon_w + 2.0
        text_w = max(2.0, w - (eff_label_w + colon_w + 4.0))
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.set_xy(text_x, y + 0.2)
        pdf.cell(text_w, row_h - 1.2, str(value), border=0, align="L")

def _draw_ev_header_form(pdf: FPDF, base_font: str, x: float, y: float, w: float,
                         manufacturer: str = "", model: str = "", power: str = "",
                         serial_no: str = "", location: str = "",
                         firmware: str = "", inspection_date: str = "",
                         lang: str = "en",
                         power_w_mm: float = 32.0,
                         gap_mm: float = 3.0) -> float:

    row_h = 5.5
    left_w = w / 2.0
    right_w = w - left_w

    lx, rx = x, x + left_w
    y0 = y + 0.2

    # row 1
    _kv_underline(pdf, base_font, lx, y0, left_w, get_text(lang, "manufacturer"), manufacturer, row_h)
    _kv_underline(pdf, base_font, rx, y0, right_w, get_text(lang, "location"), location, row_h)
    y0 += row_h

    # row 2
    model_w = max(left_w - power_w_mm - gap_mm, 40.0)
    _kv_underline(pdf, base_font, lx, y0, model_w, get_text(lang, "model"),  model,  row_h)
    _kv_underline(pdf, base_font, lx + model_w + gap_mm, y0, power_w_mm,
              get_text(lang, "power"), power, row_h, label_w=10.0, colon_w=2.0)
    _kv_underline(pdf, base_font, rx, y0, right_w, get_text(lang, "firmware_version"), firmware, row_h)
    y0 += row_h

    # row 3
    _kv_underline(pdf, base_font, lx, y0, left_w,  get_text(lang, "serial_number"),  serial_no, row_h)
    _kv_underline(pdf, base_font, rx, y0, right_w, get_text(lang, "inspection_date"), inspection_date, row_h)
    y0 += row_h

    return y0 + 0.5

def _kv_inline(pdf: FPDF, base_font: str, x: float, y: float, w: float,
               label: str, value: str = "", row_h: float = 8.0,
               label_w: float = 25.0, colon_w: float = 3.0):
    _kv_underline(pdf, base_font, x, y, w, label, value, row_h, label_w, colon_w)

def _draw_equipment_ident_details(pdf: FPDF, base_font: str, x: float, y: float, w: float,
                                  items: List[Dict[str, str]] | None = None,
                                  lang: str = "en",
                                  num_rows: int = 2) -> float:
    
    pdf.set_font(base_font, "BU", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(w, 2, get_text(lang, "equipment_identification_details"), border=0, ln=1, align="L")
    y = pdf.get_y() + 1.5

    row_h = 5.5
    num_w = 5.0
    col1_w = (w - num_w) * 0.34
    col2_w = (w - num_w) * 0.28
    col3_w = (w - num_w) * 0.36

    items = items or []
    total = len(items) if items else num_rows

    for i in range(total):
        m = items[i].get("manufacturer", "") if i < len(items) else ""
        mo = items[i].get("model", "")        if i < len(items) else ""
        sn = items[i].get("serial_no", "")    if i < len(items) else ""

        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.set_xy(x, y)
        pdf.cell(num_w, row_h, str(i + 1), border=0, align="L")

        cx = x + num_w
        _kv_inline(pdf, base_font, cx, y, col1_w, get_text(lang, "manufacturer"), m, row_h)
        cx += col1_w + 2
        _kv_inline(pdf, base_font, cx, y, col2_w, get_text(lang, "model"), mo, row_h, 15)
        cx += col2_w + 2
        _kv_inline(pdf, base_font, cx, y, col3_w, get_text(lang, "serial_number"), sn, row_h)

        y += row_h

    return y


def draw_testing_topics_safety_section(pdf, x, y, base_font, font_size,
                                     table_width=None, safety=None, doc=None, lang="en"):
    
    safety = safety or {} 

    def _get_val_res(entry: dict | None):
        if not isinstance(entry, dict):
            return "", ""
        val = str(entry.get("h1") or "").strip()
        res = str(entry.get("result") or "").strip()
        return val, res

    def draw_result_pair(pdf_obj, w_total, h, val_str, res_str):
        w_half = w_total / 2.0
        
        current_x = pdf_obj.get_x()
        current_y = pdf_obj.get_y()
        
        if val_str.strip() and val_str.strip() != "-":
            display_value = val_str.strip() + " Ω"
        else:
            display_value = val_str
        
        draw_text_with_omega(pdf_obj, current_x, current_y, w_half, h, 
                            display_value, base_font, align="C")
        
        res_lower = res_str.lower()
        symbol = ""
        is_symbol = False
        
        if res_lower == "pass":
            symbol = "3"
            is_symbol = True
        elif res_lower == "fail":
            symbol = "7"
            is_symbol = True
        
        if is_symbol:
            current_font = pdf_obj.font_family
            current_style = pdf_obj.font_style
            current_size = pdf_obj.font_size_pt
            
            symbol_size = current_size * 0.75
            
            pdf_obj.set_font("ZapfDingbats", "", symbol_size)
            pdf_obj.set_xy(current_x + w_half, current_y)
            pdf_obj.cell(w_half, h, symbol, border=0, align="C")
            
            pdf_obj.set_font(current_font, current_style, current_size)
        else:
            pdf_obj.set_xy(current_x + w_half, current_y)
            pdf_obj.cell(w_half, h, symbol, border=0, align="C")

    if table_width is None:
        table_width = pdf.w - pdf.l_margin - pdf.r_margin

    col_cat     = 15
    col_pe      = 30
    col_item    = 25
    col_test    = 28
    col_remark  = table_width - (col_cat + col_pe + col_item + 3 * col_test)
    h_header1, h_header2, h_row = 6, 6, 6

    # Header บนสุด
    pdf.set_xy(x, y)
    pdf.set_font(base_font, "BU", font_size)
    pdf.cell(table_width, 6, get_text(lang, "testing_topics_safety"), border=0, ln=1, align="L")

    y = pdf.get_y() + 1

    # ส่วน Phase Sequence
    doc = doc or {}
    phase_val = str(doc.get("phaseSequence") or "").strip()

    pdf.set_font(base_font, "B", font_size)
    pdf.set_xy(x, y)
    pdf.cell(28, 6, get_text(lang, "phase_sequence") + " :", border=0, align="L")

    text_x = x + 28
    pdf.set_xy(text_x, y + 0.2)
    pdf.set_font(base_font, "", font_size)
    pdf.cell(50, 6, "  " + phase_val, border=0, align="L")

    lw_temp = pdf.line_width
    pdf.set_line_width(0.22)
    line_x1 = text_x + 1.5
    line_x2 = text_x + 30
    line_y = y + 6 - 1.0
    pdf.line(line_x1, line_y, line_x2, line_y)
    pdf.set_line_width(lw_temp)

    y += 8

    table_y0 = y
    lw_old = pdf.line_width
    pdf.set_line_width(lw_old)

    # Header ตาราง
    pdf.set_font(base_font, "B", font_size)
    pdf.set_xy(x + col_cat, y)
    pdf.cell(col_pe + col_item, h_header1+h_header2, get_text(lang, "testing_checklist"), 1, 0, "C")
    pdf.cell(col_test * 3, h_header1, get_text(lang, "test_results"), 1, 0, "C")
    pdf.cell(col_remark, h_header1 + h_header2, get_text(lang, "remark"), 1, 0, "C")
    y += h_header1

    pdf.set_xy(x + col_cat, y)
    pdf.cell(col_pe + col_item, h_header2, "", 0, 0, "C")
    pdf.cell(col_test, h_header2, get_text(lang, "1st_test"), 1, 0, "C")
    pdf.cell(col_test, h_header2, get_text(lang, "2nd_test"), 1, 0, "C")
    pdf.cell(col_test, h_header2, get_text(lang, "3rd_test"), 1, 0, "C")
    y += h_header2
    y_body_start = y

    pdf.set_font(base_font, "", font_size)

    # PE.Continuity Section
    items_map = {
        "left_cover": "leftCover",
        "right_cover": "rightCover",
        "front_cover": "frontCover",
        "back_cover": "backCover",
        "pin_pe_h1": "pinPEH1",
        "pin_pe_h2": "pinPEH2"
    }

    items = list(items_map.keys())
    pe_rows = len(items)
    pe_h = pe_rows * h_row
    pdf.rect(x + col_cat, y, col_pe, pe_h)

    # PE Header Text
    pe_text_lines = [
        get_text(lang, "pe_continuity"),
        get_text(lang, "protective"),
        get_text(lang, "conductors_of"),
        get_text(lang, "charger")
    ]
    text_y = y + (pe_h - (len(pe_text_lines) * 4.0)) / 2.0
    pdf.set_font(base_font, "", font_size - 1)
    for i, ln in enumerate(pe_text_lines):
        pdf.set_xy(x + col_cat, text_y + i * 4.0)
        pdf.cell(col_pe, 4.0, ln, 0, 0, "C")
    pdf.set_font(base_font, "", font_size)

    pe_data = safety.get("peContinuity", {})

    for item_key in items:
        row_y = y
        db_key = items_map[item_key]

        v1, r1 = _get_val_res(pe_data.get("r1", {}).get(db_key))
        v2, r2 = _get_val_res(pe_data.get("r2", {}).get(db_key))
        v3, r3 = _get_val_res(pe_data.get("r3", {}).get(db_key))

        if v1.strip():
            v1 = v1 + " Ω"
        if v2.strip():
            v2 = v2 + " Ω"
        if v3.strip():
            v3 = v3 + " Ω"

        remark_txt = safety.get("remarks", {}).get(db_key, "")
        
        if remark_txt == "-":
            remark_txt = ""

        pdf.set_xy(x, row_y)
        pdf.cell(col_cat, h_row, "", 0, 0, "C")
        pdf.set_xy(x + col_cat + col_pe, row_y)
        pdf.cell(col_item, h_row, get_text(lang, item_key), 1, 0, "L")

        current_x = pdf.get_x()
        
        # Test 1
        pdf.rect(current_x, row_y, col_test, h_row)
        pdf.line(current_x + col_test/2, row_y, current_x + col_test/2, row_y + h_row)
        draw_result_pair(pdf, col_test, h_row, v1, r1)
        current_x += col_test
        
        # Test 2
        pdf.rect(current_x, row_y, col_test, h_row)
        pdf.line(current_x + col_test/2, row_y, current_x + col_test/2, row_y + h_row)
        draw_result_pair(pdf, col_test, h_row, v2, r2)
        current_x += col_test
        
        # Test 3
        pdf.rect(current_x, row_y, col_test, h_row)
        pdf.line(current_x + col_test/2, row_y, current_x + col_test/2, row_y + h_row)
        draw_result_pair(pdf, col_test, h_row, v3, r3)
        current_x += col_test

        pdf.set_xy(current_x, row_y)
        pdf.cell(col_remark, h_row, remark_txt, 1, 0, "L")
        y += h_row 
    
    # RCD Section
    rcd_rows = [
        ("rcd_type_a", "typeA", "mA"),
        ("rcd_type_f", "typeF", "mA"),
        ("rcd_type_b", "typeB", "mA"),
        ("isolation_transformer", "isolation", ""),    
    ]
    rcd_data = safety.get("rcd", {})
    rcd_remark_data = safety.get("remarks", {})

    rcd_r1 = rcd_data.get("r1", {})
    rcd_r2 = rcd_data.get("r2", {})
    rcd_r3 = rcd_data.get("r3", {})

    isolation_data = safety.get("isolationTransformer", {})

    for label_key, key, default_unit in rcd_rows:
        row_y = y 
        pdf.set_xy(x, y)
        pdf.cell(col_cat, h_row, "", 0, 0, "C")
        
        if key == "isolation":
            pdf.cell(col_pe, h_row, get_text(lang, label_key), 1, 0, "L")
            
            is_pass = isolation_data.get("pass", None)
            
            if is_pass == True:
                symbol = "3"
                pdf.set_font("ZapfDingbats", "", FONT_MAIN * 0.75)
                pdf.cell(col_item, h_row, symbol, 1, 0, "C")
                pdf.set_font(base_font, "", font_size)
            elif is_pass == False:
                symbol = "7"
                pdf.set_font("ZapfDingbats", "", FONT_MAIN * 0.75)
                pdf.cell(col_item, h_row, symbol, 1, 0, "C")
                pdf.set_font(base_font, "", font_size)
            else:
                pdf.cell(col_item, h_row, "", 1, 0, "C")
            
        else:
            item_data = rcd_data.get(key, {})
            val_str = str(item_data.get("value") or "-")
            unit_str = str(item_data.get("unit") or default_unit)

            pdf.cell(col_pe, h_row, get_text(lang, label_key), 1, 0, "L")

            w1, w2 = col_item * 0.60, col_item * 0.40
            pdf.cell(w1, h_row, val_str, 1, 0, "C")
            pdf.cell(w2, h_row, unit_str, 1, 0, "C")
            
            r1_item = rcd_r1.get(key, {})
            r2_item = rcd_r2.get(key, {})
            r3_item = rcd_r3.get(key, {})

        current_x = pdf.get_x()
        
        if key == "isolation":
            for _ in range(3):
                pdf.rect(current_x, row_y, col_test, h_row)
                pdf.line(current_x + col_test/2, row_y, current_x + col_test/2, row_y + h_row)
                pdf.set_xy(current_x + col_test, row_y)
                current_x += col_test
        else:
            test_items = [r1_item, r2_item, r3_item]
            
            for test_item in test_items:
                pdf.rect(current_x, row_y, col_test, h_row)
                pdf.line(current_x + col_test/2, row_y, current_x + col_test/2, row_y + h_row)
                
                trip_time = str(test_item.get("tripTime") or "").strip()
                if trip_time and trip_time != "-":
                    trip_unit = str(test_item.get("tripTimeUnit") or "")
                    display_text = f"{trip_time} {trip_unit}".strip()
                    pdf.set_xy(current_x, row_y)
                    pdf.cell(col_test/2, h_row, display_text, border=0, align="C")
                
                result = str(test_item.get("result") or "").lower()
                if result == "pass":
                    symbol = "3"
                    pdf.set_font("ZapfDingbats", "", FONT_MAIN * 0.75)
                    pdf.set_xy(current_x + col_test/2, row_y)
                    pdf.cell(col_test/2, h_row, symbol, border=0, align="C")
                    pdf.set_font(base_font, "", font_size)
                elif result == "fail":
                    symbol = "7"
                    pdf.set_font("ZapfDingbats", "", FONT_MAIN * 0.75)
                    pdf.set_xy(current_x + col_test/2, row_y)
                    pdf.cell(col_test/2, h_row, symbol, border=0, align="C")
                    pdf.set_font(base_font, "", font_size)
                
                pdf.set_xy(current_x + col_test, row_y)
                current_x += col_test

        pdf.set_xy(current_x, row_y)
        
        rem_key = "rcd" + key[0].upper() + key[1:] if key != "isolation" else "isolationTransformer"
        remark_txt = rcd_remark_data.get(rem_key, "")
        
        if remark_txt == "-":
            remark_txt = ""
            
        pdf.set_xy(current_x, row_y)
        pdf.cell(col_remark, h_row, remark_txt, 1, 0, "L")
        
        y += h_row

    # Power Standby Section
    ps_data = safety.get("powerStandby", {})
    l1 = ps_data.get("L1", " ")
    l2 = ps_data.get("L2", " ")
    l3 = ps_data.get("L3", " ")
    ps_remark = safety.get("remarks", {}).get("powerStandby", "")
    
    if ps_remark == "-":
            ps_remark = ""

    pdf.set_xy(x, y)
    pdf.cell(col_cat, h_row, "", 0, 0, "C")
    pdf.cell(col_pe + col_item, h_row, get_text(lang, "power_standby"), 1, 0, "L")

    pdf.set_font(base_font, "", font_size - 1)
    pdf.cell(col_test, h_row, f"L1 = {l1} A", 1, 0, "C")
    pdf.cell(col_test, h_row, f"L2 = {l2} A", 1, 0, "C")
    pdf.cell(col_test, h_row, f"L3 = {l3} A", 1, 0, "C")
    pdf.set_font(base_font, "", font_size)

    pdf.cell(col_remark, h_row, ps_remark, 1, 0, "L")
    y += h_row
    
    y_body_end = y

    # Vertical Header
    total_height = y_body_end - table_y0  
    pdf.rect(x, table_y0, col_cat, total_height)  

    # ปรับขนาด font ตามภาษา
    vertical_header_size = 16 if lang == "th" else 20
    pdf.set_font(base_font, "B", vertical_header_size)
    
    text = get_text(lang, "electrical_safety")
    text_w = pdf.get_string_width(text)
    text_x = x + col_cat / 2.0
    text_y = table_y0 + (total_height + text_w) / 2.0
    try:
        with pdf.rotation(90, text_x, text_y):
            pdf.set_xy(text_x, text_y)
            pdf.cell(0, 0, text, 0, 0, "L")
    except:
        pass 

    pdf.set_font(base_font, "", font_size)
    return y


def draw_charging_procresss_testing(pdf, x, y, base_font, font_size,
                                    table_width=None, safety=None, doc=None, lang="en"):

    safety = safety or {}
    doc = doc or {}
    
    pe_data_root = safety.get("peContinuity", {})
    remarks_data = safety.get("remarks", {})
    root_remarks = doc.get("remarks", {})

    def _draw_result_symbol(pdf, x, y, w_total, h, h1_str, h2_str):
        col_h1 = w_total / 2
        col_h2 = w_total / 2

        pdf.rect(x, y, col_h1, h)
        pdf.rect(x + col_h1, y, col_h2, h)
        
        if h1_str:
            h1_lower = str(h1_str).strip().lower()
            
            if h1_lower == "pass":
                symbol = "3"
                pdf.set_font("ZapfDingbats", "", FONT_MAIN * 0.75)
                pdf.set_xy(x, y)
                pdf.cell(col_h1, h, symbol, border=0, align="C")
                pdf.set_font(base_font, "", font_size)
            elif h1_lower == "fail":
                symbol = "7"
                pdf.set_font("ZapfDingbats", "", FONT_MAIN * 0.75)
                pdf.set_xy(x, y)
                pdf.cell(col_h1, h, symbol, border=0, align="C")
                pdf.set_font(base_font, "", font_size)
        
        if h2_str:
            h2_lower = str(h2_str).strip().lower()
            
            if h2_lower == "pass":
                symbol = "3"
                pdf.set_font("ZapfDingbats", "", FONT_MAIN * 0.75)
                pdf.set_xy(x + col_h1, y)
                pdf.cell(col_h2, h, symbol, border=0, align="C")
                pdf.set_font(base_font, "", font_size)
            elif h2_lower == "fail":
                symbol = "7"
                pdf.set_font("ZapfDingbats", "", FONT_MAIN * 0.75)
                pdf.set_xy(x + col_h1, y)
                pdf.cell(col_h2, h, symbol, border=0, align="C")
                pdf.set_font(base_font, "", font_size)

    if table_width is None:
        table_width = pdf.w - pdf.l_margin - pdf.r_margin

    col_cat    = 15
    col_checklist = 55
    col_test_group = 28
    col_h1         = col_test_group / 2
    col_result     = col_test_group / 2
    col_remark = table_width - (col_cat + col_checklist + (3 * col_test_group))

    h_header = 5
    h_row    = 5 

    # Header Table
    pdf.set_xy(x, y)
    pdf.set_font(base_font, "BU", font_size)
    pdf.cell(table_width, 6, get_text(lang, "charging_process_testing"), 0, 1, "L")

    y = pdf.get_y() + 1.5
    table_y0 = y 
    lw_old = pdf.line_width
    pdf.set_line_width(lw_old)

    pdf.set_font(base_font, "B", font_size)

    # Row 1
    pdf.set_xy(x + col_cat, y)
    pdf.cell(col_checklist, h_header * 2, get_text(lang, "testing_checklist"), 1, 0, "C")
    pdf.cell(col_test_group * 3, h_header, get_text(lang, "test_results"), 1, 0, "C")
    pdf.cell(col_remark, h_header * 3, get_text(lang, "remark"), 1, 0, "C")
    y += h_header

    # Row 2
    start_x_test = x + col_cat + col_checklist
    pdf.set_xy(start_x_test, y)
    pdf.cell(col_test_group, h_header, get_text(lang, "1st_test"), 1, 0, "C")
    pdf.cell(col_test_group, h_header, get_text(lang, "2nd_test"), 1, 0, "C")
    pdf.cell(col_test_group, h_header, get_text(lang, "3rd_test"), 1, 0, "C")
    y += h_header

    # Row 3
    pdf.set_xy(x + col_cat, y)
    pdf.cell(col_checklist, h_header, get_text(lang, "ccs2"), 1, 0, "C")
    for _ in range(3):
        pdf.cell(col_h1, h_header, get_text(lang, "h1"), 1, 0, "C")
        pdf.cell(col_result, h_header, get_text(lang, "h2"), 1, 0, "C")
    y += h_header
    
    y_body_start = y 
    pdf.set_font(base_font, "", font_size)

    # Body Data
    items = [
        ("none_normal_operate", "none", "noneNormalOperate"),
        ("cp_short_120_ohm", "CPshort", "cPShort120Ohm"),
        ("pe_pp_cut", "PE_PP_cut", "pEPPCut"),
        ("remote_stop", "remoteStop", "remoteStop"),
        ("emergency", "emergency", "emergency"),
        ("ldc_plus", "LDCp", "lDCPlus"),
        ("ldc_minus", "LDCm", "lDCMinus"),
    ]

    r1_data_root = pe_data_root.get("r1", {})
    r2_data_root = pe_data_root.get("r2", {})
    r3_data_root = pe_data_root.get("r3", {})

    for label_key, key_db, remark_key in items:
        
        item_r1 = r1_data_root.get(key_db, {})
        item_r2 = r2_data_root.get(key_db, {})
        item_r3 = r3_data_root.get(key_db, {})

        h1_1 = str(item_r1.get("h1", ""))
        h2_1 = str(item_r1.get("h2", ""))
        
        h1_2 = str(item_r2.get("h1", ""))
        h2_2 = str(item_r2.get("h2", ""))
        
        h1_3 = str(item_r3.get("h1", ""))
        h2_3 = str(item_r3.get("h2", ""))
        
        rem = remarks_data.get(remark_key, "")
        if rem == "-":
            rem = ""

        pdf.set_xy(x + col_cat, y)

        pdf.cell(col_checklist, h_row, get_text(lang, label_key), 1, 0, "L")

        # Test 1
        current_x = pdf.get_x()
        _draw_result_symbol(pdf, current_x, y, col_test_group, h_row, h1_1, h2_1)
        pdf.set_xy(current_x + col_test_group, y)

        # Test 2
        current_x = pdf.get_x()
        _draw_result_symbol(pdf, current_x, y, col_test_group, h_row, h1_2, h2_2)
        pdf.set_xy(current_x + col_test_group, y)

        # Test 3
        current_x = pdf.get_x()
        _draw_result_symbol(pdf, current_x, y, col_test_group, h_row, h1_3, h2_3)
        pdf.set_xy(current_x + col_test_group, y)

        # Remark
        current_x = x + col_cat + col_checklist + (col_test_group*3)
        pdf.set_xy(current_x, y)
        pdf.cell(col_remark, h_row, rem, 1, 0, "L")
        
        y += h_row

    y_body_end = y

    # Vertical Header
    total_height = y_body_end - table_y0 
    
    pdf.rect(x, table_y0, col_cat, total_height)
    
    # ปรับขนาด font ตามภาษา
    vertical_header_size = 16 if lang == "th" else 20
    pdf.set_font(base_font, "B", vertical_header_size)
    
    text = get_text(lang, "charger_safety")
    text_width = pdf.get_string_width(text)
    
    center_x = x + (col_cat / 2.0) + 2.5
    center_y = table_y0 + (total_height + text_width) / 2.0
    
    try:
        with pdf.rotation(90, center_x, center_y):
            pdf.text(center_x, center_y, text)
    except:
        pass 

    pdf.set_font(base_font, "", font_size)
    return y

def draw_remark_and_symbol_section(pdf: FPDF, base_font: str, x: float, y: float, w: float, 
                                   doc: dict = None, lang: str = "en") -> float:

    doc = doc or {}
    remark_text = doc.get("remarks", {}).get("testRemark", "")

    y -= 2

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(20, 6, get_text(lang, "remark") + " : ", border=0, align="L")

    line_x1 = x + 20
    line_x2 = x + w
    line_gap = 5
    start_line_y = y + 4.5
    pdf.set_line_width(0.22)
    
    num_lines = 4
    
    if remark_text:
        pdf.set_font(base_font, "", FONT_MAIN)
        max_width = w - 25
        
        try:
            lines = pdf.multi_cell(max_width, line_gap, remark_text, border=0, split_only=True)
            num_lines = max(len(lines), 4)
        except TypeError:
            avg_chars_per_line = int(max_width / pdf.get_string_width("A"))
            estimated_lines = max(len(remark_text) // avg_chars_per_line + 1, 4)
            num_lines = min(estimated_lines, 10)
    
    for i in range(num_lines):
        current_line_y = start_line_y + (i * line_gap)
        pdf.line(line_x1, current_line_y, line_x2, current_line_y)
    
    if remark_text:
        pdf.set_font(base_font, "", FONT_MAIN)
        text_y = start_line_y - line_gap + 0.5 
        pdf.set_xy(line_x1, text_y)
        pdf.multi_cell(w - 25, line_gap, remark_text, border=0, align="L")
    
    remark_h = num_lines * line_gap + 5
    y += remark_h + 3

    return y

def draw_IMGremark_and_symbol_section(pdf: FPDF, base_font: str, x: float, y: float, w: float, 
                                      doc: dict = None, lang: str = "en") -> float:

    doc = doc or {}
    remark_text = doc.get("remarks", {}).get("imgRemark", "")

    y -= 2

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(20, 6, get_text(lang, "remark") + " : ", border=0, align="L")

    line_x1 = x + 20
    line_x2 = x + w
    line_gap = 5
    start_line_y = y + 4.5
    pdf.set_line_width(0.22)
    
    num_lines = 4
    
    if remark_text:
        pdf.set_font(base_font, "", FONT_MAIN)
        max_width = w - 25
        
        try:
            lines = pdf.multi_cell(max_width, line_gap, remark_text, border=0, split_only=True)
            num_lines = max(len(lines), 4)
        except TypeError:
            avg_chars_per_line = int(max_width / pdf.get_string_width("A"))
            estimated_lines = max(len(remark_text) // avg_chars_per_line + 1, 4)
            num_lines = min(estimated_lines, 10)
    
    for i in range(num_lines):
        current_line_y = start_line_y + (i * line_gap)
        pdf.line(line_x1, current_line_y, line_x2, current_line_y)
    
    if remark_text:
        pdf.set_font(base_font, "", FONT_MAIN)
        text_y = start_line_y - line_gap + 0.5 
        pdf.set_xy(line_x1, text_y)
        pdf.multi_cell(w - 25, line_gap, remark_text, border=0, align="L")
    
    remark_h = num_lines * line_gap + 5
    y += remark_h + 3

    return y

def _draw_signature_footer(pdf: FPDF, base_font: str, db_data: dict, lang: str = "en") -> None:
    """วาดส่วนลายเซ็นที่ footer ของทุกหน้า (ช่องว่างเปล่า)"""

    row_h = 6
    x = 6
    w = 198
    col_label_w = 38
    col_data_w = (w - col_label_w) / 3

    total_sig_h = row_h * 5

    y = pdf.h - 5 - total_sig_h

    start_y = y
    pdf.rect(x, start_y, w, total_sig_h)

    pdf.set_xy(x, y)
    pdf.set_font(base_font, "B", FONT_MAIN)

    headers = [
        (get_text(lang, "responsibility"), col_label_w),
        (get_text(lang, "performed_by"), col_data_w),
        (get_text(lang, "approved_by"), col_data_w),
        (get_text(lang, "witnessed_by"), col_data_w)
    ]

    for text, width in headers:
        pdf.cell(width, row_h, text, border=0, align="C")

    y += row_h
    pdf.line(x, y, x + w, y)

    current_x = x + col_label_w
    pdf.line(current_x, start_y, current_x, start_y + total_sig_h)
    
    current_x += col_data_w
    pdf.line(current_x, start_y, current_x, start_y + total_sig_h)
    
    current_x += col_data_w
    pdf.line(current_x, start_y, current_x, start_y + total_sig_h)

    rows_config = [
        get_text(lang, "name"),
        get_text(lang, "signature"),
        get_text(lang, "date"),
        get_text(lang, "company")
    ]

    pdf.set_font(base_font, "", FONT_MAIN)

    for label in rows_config:
        pdf.set_xy(x, y)

        pdf.cell(col_label_w, row_h, label, border=0, align="L")

        pdf.cell(col_data_w, row_h, "", border=0, align="C")
        pdf.cell(col_data_w, row_h, "", border=0, align="C")
        pdf.cell(col_data_w, row_h, "", border=0, align="C")

        y += row_h
        if label != rows_config[-1]:
            pdf.line(x, y, x + w, y)


# -------------------- Photo helpers --------------------
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

def _load_image_source_from_urlpath(
    url_path: str,
) -> Tuple[Union[str, BytesIO, None], Optional[str]]:
    if not url_path:
        return None, None

    # Normalize
    raw = str(url_path).strip()
    p_abs = Path(raw)
    if p_abs.is_absolute() and p_abs.exists() and p_abs.is_file():
        return p_abs.as_posix(), _guess_img_type_from_ext(p_abs.as_posix())

    clean_path = raw.lstrip("/")

    if clean_path.startswith("uploads/"):
        rel_after_uploads = clean_path[len("uploads/") :]
    else:
        rel_after_uploads = clean_path

    current_file = Path(__file__).resolve()
    backend_root = None
    for p in current_file.parents:
        if p.name.lower() == "backend" and p.exists():
            backend_root = p
            break
    if backend_root is None:
        for i in range(1, 4):
            cand = current_file.parents[i] if i < len(current_file.parents) else None
            if cand and (cand / "backend").exists():
                backend_root = cand / "backend"
                break

    tried_paths = []
    if backend_root is not None:
        uploads_root = backend_root / "uploads"
        if uploads_root.exists():
            candidate = uploads_root / rel_after_uploads
            tried_paths.append(candidate)
            if candidate.exists() and candidate.is_file():
                return candidate.as_posix(), _guess_img_type_from_ext(candidate.as_posix())

    print("[DEBUG] ❌ ไม่พบรูปภาพจากทุกวิธี — paths tried:")
    for p in tried_paths:
        print("  -", p)
    return None, None

def _get_photo_items_for_idx(doc: dict, idx: int) -> List[dict]:
    photos = ((doc.get("photos") or {}).get(f"g{idx}") or [])
    out = []
    for p in photos:
        if isinstance(p, dict) and p.get("url"):
            out.append(p)
    return out[:PHOTO_MAX_PER_ROW]

PHOTO_MAX_PER_ROW = 3
PHOTO_IMG_MAX_H = 60
PHOTO_GAP = 2
PHOTO_PAD_X = 2
PHOTO_PAD_Y = 2
PHOTO_ROW_MIN_H = 11

def _draw_photos_table_header(
    pdf: FPDF, base_font: str, x: float, y: float, q_w: float, g_w: float, lang: str = "en"
) -> float:
    header_h = 9.0
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_xy(x, y)
    pdf.cell(q_w, header_h, get_text(lang, "question"), border=1, align="C")
    pdf.cell(g_w, header_h, get_text(lang, "photo_attachment"), border=1, ln=1, align="C")
    return y + header_h

def load_image_autorotate(path_or_bytes: Union[str, Path, BytesIO]) -> BytesIO:
    """โหลดรูปภาพ และหมุนให้ตั้งตรงอัตโนมัติโดยอ้างอิงจากข้อมูล EXIF"""
    try:
        if isinstance(path_or_bytes, (str, Path)):
            img = Image.open(path_or_bytes)
        elif isinstance(path_or_bytes, BytesIO):
            path_or_bytes.seek(0)
            img = Image.open(path_or_bytes)
        else:
             raise ValueError("Unsupported image source type")

        img = ImageOps.exif_transpose(img)

        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')

        buf = BytesIO()
        img.save(buf, format="JPEG", quality=90)
        buf.seek(0)
        return buf

    except Exception as e:
        print(f"[Error] Could not process image autorotate: {e}")
        if isinstance(path_or_bytes, BytesIO):
            path_or_bytes.seek(0)
            return path_or_bytes
        return BytesIO()

def _draw_header_picture(pdf: FPDF, base_font: str, issue_id: str = "-", lang: str = "en", inset_mm: float = 6.0) -> float:
    page_w = pdf.w - 2*inset_mm
    x0 = inset_mm
    y_top = inset_mm + 2

    col_left, col_mid = 40, 120
    col_right = page_w - col_left - col_mid

    h_all = 10
    h_right_top = 10

    pdf.set_line_width(LINE_W_INNER)
    
    # โลโก้
    pdf.rect(x0, y_top, col_left, h_all)
    logo_path = _resolve_logo_path()
    if logo_path:
        IMG_W = 28
        
        try:
            from PIL import Image
            with Image.open(logo_path) as img:
                orig_w, orig_h = img.size
                aspect_ratio = orig_h / orig_w
                IMG_H = IMG_W * aspect_ratio
            
            img_x = x0 + (col_left - IMG_W) / 2
            img_y = y_top + (h_all - IMG_H) / 2
            
            pdf.image(logo_path.as_posix(), x=img_x, y=img_y, w=IMG_W)
        except Exception:
            pass

    # กล่องกลาง
    box_x = x0 + col_left
    pdf.rect(box_x, y_top, col_mid, h_all)

    pdf.set_font(base_font, "B", 20)
    start_y = y_top + (h_all - LINE_H_HEADER) / 2

    pdf.set_xy(box_x + 3, start_y)
    pdf.cell(col_mid - 6, LINE_H_HEADER, get_text(lang, "photos"), align="C")

    # กล่องขวา
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_all)

    pdf.set_xy(xr, y_top + 1)
    pdf.set_font(base_font, "B", FONT_MAIN - 1)
    pdf.multi_cell(col_right, LINE_H_HEADER, f"{get_text(lang, 'issue_id')}\n{issue_id}", align="C")

    return y_top + h_all

def _draw_picture_page(pdf: FPDF, base_font: str, issue_id: str, doc: dict, lang: str = "en"):

    pdf.add_page()
    
    header_bottom = _draw_header_picture(pdf, base_font, issue_id, lang)
    FRAME_INSET = 6
    FRAME_BOTTOM = 5
    pdf.set_line_width(LINE_W_OUTER)
    pdf.rect(FRAME_INSET, header_bottom, 198, pdf.h - header_bottom - FRAME_BOTTOM)
    pdf.set_line_width(LINE_W_INNER)
    
    y = header_bottom + 0.5
    
    header_bottom_y = _draw_header_picture(pdf, base_font, issue_id, lang)
    y = header_bottom_y + 0.5
    
    x0 = 10
    page_w = pdf.w - 20
    
    head_data = doc.get("head", {})
    manufacturer = str(head_data.get("manufacturer", "-"))
    model        = str(head_data.get("model", "-"))
    power        = str(head_data.get("power", "-"))
    serial_no    = str(head_data.get("serial_number", "-"))
    location     = str(head_data.get("location", "-"))
    firmware     = str(head_data.get("firmware_version", "-"))
    inspection_date = str(doc.get("inspection_date", "-"))

    y = _draw_ev_header_form(
        pdf, base_font, x0, y, page_w,
        manufacturer=manufacturer,
        model=model,
        power=power,
        serial_no=serial_no,
        location=location,
        firmware=firmware,
        inspection_date=inspection_date,
        lang=lang
    )
    
    y += 1 
    
    photos = doc.get("photos", {}) or {}

    photo_categories = [
        ("nameplate", "nameplate"),
        ("charger", "charger"),
        ("testingEquipment", "testing_equipment"),
        ("testingEquipmentNameplate", "testing_equipment_nameplate"),
        ("gun1", "gun1"),
        ("gun2", "gun2"),
    ]

    col_w = (page_w - 10) / 2  
    img_h = 55  
    label_h = 6  
    total_h = img_h + label_h
    gap_between_rows = 3  

    footer_height_needed = 80 
    total_needed = (total_h * 3) + (gap_between_rows * 2) 
    available_space = pdf.h - y - 20 - footer_height_needed 

    if total_needed > available_space:
        scale_factor = available_space / total_needed
        if scale_factor < 0.6: scale_factor = 0.6 
        img_h = int(img_h * scale_factor)
        total_h = img_h + label_h
        gap_between_rows = 2

    def draw_image_in_box(url_path, x_box, y_box, box_w, box_h):
        if not url_path: return
        
        try:
            raw_src, _ = _load_image_source_from_urlpath(url_path)
            if not raw_src: return

            final_src = load_image_autorotate(raw_src)

            from PIL import Image
            with Image.open(final_src) as pil_img:
                orig_w, orig_h = pil_img.size
            
            final_src.seek(0)

            padding = 2
            max_draw_w = box_w - (2 * padding)
            max_draw_h = box_h - (2 * padding)

            ratio_w = max_draw_w / orig_w
            ratio_h = max_draw_h / orig_h
            scale = min(ratio_w, ratio_h)

            new_w = orig_w * scale
            new_h = orig_h * scale

            center_x = x_box + (box_w / 2)
            center_y = y_box + (box_h / 2)
            draw_x = center_x - (new_w / 2)
            draw_y = center_y - (new_h / 2)

            pdf.image(final_src, x=draw_x, y=draw_y, w=new_w, h=new_h, type="JPEG")

        except Exception as e:
            print(f"[DEBUG] Error drawing image: {e}")

    for i in range(0, len(photo_categories), 2):
        cat_key_left, label_key_left = photo_categories[i]
        photo_list_left = photos.get(cat_key_left, [])

        x_left = x0
        
        pdf.rect(x_left, y, col_w, img_h)

        if photo_list_left and len(photo_list_left) > 0:
            draw_image_in_box(photo_list_left[0].get("url", ""), x_left, y, col_w, img_h)

        pdf.rect(x_left, y + img_h, col_w, label_h)
        pdf.set_xy(x_left, y + img_h + 0.5)
        pdf.set_font(base_font, "B", FONT_MAIN if 'FONT_MAIN' in globals() else 10)
        pdf.cell(col_w, label_h - 1, get_text(lang, label_key_left), border=0, align="C")

        if i + 1 < len(photo_categories):
            cat_key_right, label_key_right = photo_categories[i + 1]
            photo_list_right = photos.get(cat_key_right, [])

            x_right = x0 + col_w + 10
            
            pdf.rect(x_right, y, col_w, img_h)

            if photo_list_right and len(photo_list_right) > 0:
                draw_image_in_box(photo_list_right[0].get("url", ""), x_right, y, col_w, img_h)

            pdf.rect(x_right, y + img_h, col_w, label_h)
            pdf.set_xy(x_right, y + img_h + 0.5)
            pdf.set_font(base_font, "B", FONT_MAIN if 'FONT_MAIN' in globals() else 10)
            pdf.cell(col_w, label_h - 1, get_text(lang, label_key_right), border=0, align="C")

        y += total_h + gap_between_rows

    remark_h = 45 
    sig_h = 40
    total_footer_h = remark_h + sig_h
    
    if y + total_footer_h > 290: 
        pdf.add_page()
        pdf.rect(6, 22, 198, 270)
        y = 30 

    y += 3
    y = draw_IMGremark_and_symbol_section(pdf, base_font, x0, y, page_w, doc=doc, lang=lang)

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

    img_h = 45  
    inner_padding = 1.0 

    _, text_h = _split_lines(pdf, q_w - 2 * PADDING_X, question_text, LINE_H)
    row_h = max(ROW_MIN_H, text_h, img_h + 2 * PADDING_Y)

    _cell_text_in_box(
        pdf, x, y, q_w, row_h, question_text, align="L", lh=LINE_H, valign="top"
    )

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
                    from PIL import Image
                    with Image.open(src) as pil_img:
                        orig_w, orig_h = pil_img.size
                    
                    draw_box_w = slot_w - (2 * inner_padding)
                    draw_box_h = img_h - (2 * inner_padding)

                    ratio_w = draw_box_w / orig_w
                    ratio_h = draw_box_h / orig_h
                    scale = min(ratio_w, ratio_h)
                    
                    new_w = orig_w * scale
                    new_h = orig_h * scale
                    
                    offset_x = (slot_w - new_w) / 2
                    offset_y = (img_h - new_h) / 2
                    
                    pdf.image(
                        src, 
                        x=cx + offset_x, 
                        y=cy + offset_y, 
                        w=new_w, 
                        h=new_h, 
                        type=(img_type or None)
                    )
                    
                except Exception:
                    pdf.set_xy(cx, cy + (img_h - LINE_H) / 2.0)
                    pdf.cell(slot_w, LINE_H, "-", border=0, align="C")
            else:
                pdf.set_xy(cx, cy + (img_h - LINE_H) / 2.0)
                pdf.cell(slot_w, LINE_H, "-", border=0, align="C")
        
        cx += slot_w + PHOTO_GAP

    pdf.set_xy(x + q_w + g_w, y)
    return row_h


# ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
# ★★★ NEW: ฟังก์ชันสำหรับแสดงรายการไฟล์แนบและรวม PDF ★★★
# ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

# Mapping ชื่อรายการทดสอบ
TEST_ITEMS_CHARGER = [
    "None (Normal operate)",
    "CP short -120 Ohm",
    "PE-PP-Cut",
    "Remote Stop",
    "Emergency",
    "LDC +",
    "LDC -",
]

def _get_test_files_list(doc: dict) -> List[Dict[str, Any]]:
    """
    ดึงรายการไฟล์แนบทั้งหมดจาก test_files
    Returns: List of dict with keys: test_type, item_index, round_index, handgun, filename, url, ext
    """
    test_files = doc.get("test_files", {}) or {}
    files_list = []
    
    try:
        for test_type in ["electrical", "charger"]:
            type_data = test_files.get(test_type, {})
            if not type_data or not isinstance(type_data, dict):
                continue
                
            for item_index_str, rounds_data in type_data.items():
                # ข้ามถ้า key ไม่ใช่ตัวเลข
                try:
                    item_index = int(item_index_str)
                except (ValueError, TypeError):
                    continue
                
                if not rounds_data or not isinstance(rounds_data, dict):
                    continue
                
                for round_index_str, handguns_data in rounds_data.items():
                    # ข้ามถ้า key ไม่ใช่ตัวเลข
                    try:
                        round_index = int(round_index_str)
                    except (ValueError, TypeError):
                        continue
                    
                    if not handguns_data or not isinstance(handguns_data, dict):
                        continue
                    
                    for handgun in ["h1", "h2"]:
                        file_data = handguns_data.get(handgun)
                        if not file_data or not isinstance(file_data, dict):
                            continue
                        
                        # ตรวจสอบว่ามี url หรือ filename
                        if not file_data.get("url") and not file_data.get("filename"):
                            continue
                        
                        files_list.append({
                            "test_type": test_type,
                            "item_index": item_index,
                            "round_index": round_index,
                            "handgun": handgun.upper(),
                            "filename": file_data.get("filename", ""),
                            "original_name": file_data.get("originalName", file_data.get("filename", "")),
                            "url": file_data.get("url", ""),
                            "ext": str(file_data.get("ext", "")).lower(),
                        })
    except Exception as e:
        print(f"[PDF] Error parsing test_files: {e}")
        return []
    
    return files_list


def _draw_attachments_list_page(pdf: FPDF, base_font: str, issue_id: str, doc: dict, lang: str = "en") -> List[Tuple[str, str, int, float, float, float, float]]:
    """
    วาดหน้ารายการไฟล์แนบ (แยกตามรอบ)
    Returns: List of tuples (pdf_path, bookmark_name, page_num, x, y, w, h) สำหรับ PDF ที่ต้องรวม
    """
    files_list = _get_test_files_list(doc)
    
    if not files_list:
        return []
    
    # ★★★ Step 1: เก็บข้อมูลไฟล์ PDF และนับหน้า ★★★
    pdf_file_data = []  # [{path, bookmark, num_pages, file_info}, ...]
    
    # จัดกลุ่มและเรียงลำดับไฟล์
    files_by_round: Dict[int, List[Dict]] = {}
    for file_info in files_list:
        round_idx = file_info["round_index"]
        if round_idx not in files_by_round:
            files_by_round[round_idx] = []
        files_by_round[round_idx].append(file_info)
    
    sorted_rounds = sorted(files_by_round.keys())
    for round_idx in sorted_rounds:
        files_by_round[round_idx].sort(key=lambda x: (x["item_index"], 0 if x["handgun"] == "H1" else 1))
    
    # นับหน้าของแต่ละ PDF
    for round_idx in sorted_rounds:
        for file_info in files_by_round[round_idx]:
            if file_info["ext"] == "pdf":
                pdf_path = _resolve_test_file_path(file_info["url"])
                if pdf_path and HAS_PYPDF2 and Path(pdf_path).exists():
                    try:
                        with open(pdf_path, 'rb') as f:
                            reader = PdfReader(f)
                            num_pages = len(reader.pages)
                        
                        item_idx = file_info["item_index"]
                        if file_info["test_type"] == "charger" and 0 <= item_idx < len(TEST_ITEMS_CHARGER):
                            item_name = TEST_ITEMS_CHARGER[item_idx]
                        else:
                            item_name = f"Item {item_idx + 1}"
                        
                        bookmark_name = f"R{round_idx+1}_{item_name}_{file_info['handgun']}"
                        
                        pdf_file_data.append({
                            "path": pdf_path,
                            "bookmark": bookmark_name,
                            "num_pages": num_pages,
                            "file_info": file_info,
                        })
                    except Exception as e:
                        print(f"[PDF] Error reading {pdf_path}: {e}")
    
    # ★★★ Step 2: คำนวณเลขหน้าล่วงหน้า ★★★
    current_main_pages = pdf.page  # จำนวนหน้าปัจจุบันของ PDF หลัก
    
    # ประมาณจำนวนหน้าของ attachments list (1-2 หน้า)
    estimated_list_pages = 1
    if len(files_list) > 20:
        estimated_list_pages = 2
    if len(files_list) > 40:
        estimated_list_pages = 3
    
    # คำนวณเลขหน้าเริ่มต้นของแต่ละ PDF
    first_attachment_page = current_main_pages + estimated_list_pages
    page_numbers = []  # เลขหน้าเริ่มต้นของแต่ละ PDF
    current_page = first_attachment_page
    
    for pdf_info in pdf_file_data:
        page_numbers.append(current_page)
        current_page += pdf_info["num_pages"]
    
    # ★★★ Step 3: วาดหน้า Attachments List ★★★
    pdf.add_page()
    
    header_bottom = _draw_header_attachments(pdf, base_font, issue_id, lang)
    
    FRAME_INSET = 6
    FRAME_BOTTOM = 5
    pdf.set_line_width(LINE_W_OUTER)
    pdf.rect(FRAME_INSET, header_bottom, 198, pdf.h - header_bottom - FRAME_BOTTOM)
    pdf.set_line_width(LINE_W_INNER)
    
    y = header_bottom + 3
    x0 = 10
    page_w = pdf.w - 20
    
    pdf.set_font(base_font, "BU", FONT_MAIN)
    pdf.set_xy(x0, y)
    pdf.cell(page_w, 6, get_text(lang, "attached_test_files"), border=0, align="L")
    y += 8
    
    col_no = 10
    col_test = 55
    col_gun = 15
    col_filename = page_w - col_no - col_test - col_gun - 15
    col_page = 15
    row_h = 6
    
    pdf_files_to_merge: List[Tuple[str, str, int, float, float, float, float]] = []
    file_counter = 0
    pdf_idx = 0
    
    for round_idx in sorted_rounds:
        round_files = files_by_round[round_idx]
        
        if y + row_h * 4 > pdf.h - 45:
            pdf.add_page()
            y = 20
        
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.set_fill_color(220, 220, 220)
        pdf.set_xy(x0, y)
        pdf.cell(page_w, row_h + 1, f"{get_text(lang, 'round')} {round_idx + 1}", 1, 0, "L", fill=True)
        y += row_h
        
        pdf.set_font(base_font, "B", FONT_SMALL)
        pdf.set_fill_color(245, 245, 245)
        pdf.set_xy(x0, y)
        pdf.cell(col_no, row_h, get_text(lang, "no"), 1, 0, "C", fill=True)
        pdf.cell(col_test, row_h, get_text(lang, "test_item"), 1, 0, "C", fill=True)
        pdf.cell(col_gun, row_h, get_text(lang, "gun"), 1, 0, "C", fill=True)
        pdf.cell(col_filename, row_h, get_text(lang, "filename"), 1, 0, "C", fill=True)
        pdf.cell(col_page, row_h, get_text(lang, "page"), 1, 0, "C", fill=True)
        y += row_h
        
        pdf.set_font(base_font, "", FONT_SMALL)
        
        for file_info in round_files:
            file_counter += 1
            
            if y + row_h > pdf.h - 45:
                pdf.add_page()
                y = 20
                pdf.set_font(base_font, "B", FONT_SMALL)
                pdf.set_fill_color(245, 245, 245)
                pdf.set_xy(x0, y)
                pdf.cell(col_no, row_h, get_text(lang, "no"), 1, 0, "C", fill=True)
                pdf.cell(col_test, row_h, get_text(lang, "test_item"), 1, 0, "C", fill=True)
                pdf.cell(col_gun, row_h, get_text(lang, "gun"), 1, 0, "C", fill=True)
                pdf.cell(col_filename, row_h, get_text(lang, "filename"), 1, 0, "C", fill=True)
                pdf.cell(col_page, row_h, get_text(lang, "page"), 1, 0, "C", fill=True)
                y += row_h
                pdf.set_font(base_font, "", FONT_SMALL)
            
            if file_info["test_type"] == "charger":
                item_idx = file_info["item_index"]
                if 0 <= item_idx < len(TEST_ITEMS_KEYS):
                    item_name = get_text(lang, TEST_ITEMS_KEYS[item_idx])
                else:
                    item_name = f"{get_text(lang, 'item')} {item_idx + 1}"
            else:
                item_name = f"{get_text(lang, 'electrical_item')} {file_info['item_index'] + 1}"
            
            pdf.set_xy(x0, y)
            pdf.cell(col_no, row_h, str(file_counter), 1, 0, "C")
            pdf.cell(col_test, row_h, item_name[:30], 1, 0, "L")
            pdf.cell(col_gun, row_h, file_info["handgun"], 1, 0, "C")
            
            filename_display = file_info["original_name"] or file_info["filename"]
            
            if file_info["ext"] == "pdf":
                pdf_path = _resolve_test_file_path(file_info["url"])
                if pdf_path and HAS_PYPDF2 and pdf_idx < len(pdf_file_data):
                    pdf_info = pdf_file_data[pdf_idx]
                    target_page = page_numbers[pdf_idx]
                    pdf_idx += 1
                    
                    pdf.cell(col_filename, row_h, filename_display[:35], 1, 0, "L")
                    
                    link_x = pdf.get_x()
                    link_y = y
                    current_page_idx = pdf.page - 1
                    
                    pdf_files_to_merge.append((
                        pdf_info["path"], 
                        pdf_info["bookmark"], 
                        current_page_idx,
                        link_x, link_y, col_page, row_h
                    ))
                    
                    # ★★★ แสดงเลขหน้า (สีน้ำเงิน + underline) ★★★
                    pdf.set_text_color(0, 0, 255)
                    pdf.set_font(base_font, "U", FONT_SMALL)
                    pdf.cell(col_page, row_h, f"#{target_page}", 1, 0, "C")
                    pdf.set_text_color(0, 0, 0)
                    pdf.set_font(base_font, "", FONT_SMALL)
                else:
                    pdf.cell(col_filename, row_h, filename_display[:35], 1, 0, "L")
                    pdf.cell(col_page, row_h, get_text(lang, "na"), 1, 0, "C")
            else:
                ext_display = f"[{file_info['ext'].upper()}]" if file_info['ext'] else ""
                pdf.cell(col_filename, row_h, f"{filename_display[:30]} {ext_display}", 1, 0, "L")
                pdf.cell(col_page, row_h, "-", 1, 0, "C")
            
            y += row_h
        
        y += 3
    
    y += 2
    pdf.set_font(base_font, "I", FONT_SMALL)
    pdf.set_xy(x0, y)
    
    pdf_count = len(pdf_files_to_merge)
    other_count = len(files_list) - pdf_count
    
    summary_text = f"{get_text(lang, 'total')}: {len(files_list)} {get_text(lang, 'files')}"
    if pdf_count > 0:
        summary_text += f" | {pdf_count} {get_text(lang, 'pdfs_merged_click')}"
    if other_count > 0:
        summary_text += f" | {other_count} {get_text(lang, 'non_pdf')}"
    
    pdf.cell(page_w, 5, summary_text, border=0, align="L")
    
    return pdf_files_to_merge

def _draw_header_attachments(pdf: FPDF, base_font: str, issue_id: str = "-", lang: str = "en", inset_mm: float = 6.0) -> float:
    """วาด Header สำหรับหน้า Attachments"""
    page_w = pdf.w - 2*inset_mm
    x0 = inset_mm
    y_top = inset_mm + 2

    col_left, col_mid = 40, 120
    col_right = page_w - col_left - col_mid

    h_all = 10

    pdf.set_line_width(LINE_W_INNER)
    
    # ----- โลโก้ ----- #
    pdf.rect(x0, y_top, col_left, h_all)
    logo_path = _resolve_logo_path()
    if logo_path:
        IMG_W = 28
        try:
            from PIL import Image
            with Image.open(logo_path) as img:
                orig_w, orig_h = img.size
                aspect_ratio = orig_h / orig_w
                IMG_H = IMG_W * aspect_ratio
            
            img_x = x0 + (col_left - IMG_W) / 2
            img_y = y_top + (h_all - IMG_H) / 2
            pdf.image(logo_path.as_posix(), x=img_x, y=img_y, w=IMG_W)
        except Exception:
            pass

    # ----- กล่องกลาง ----- #
    box_x = x0 + col_left
    pdf.rect(box_x, y_top, col_mid, h_all)

    pdf.set_font(base_font, "B", 20)
    start_y = y_top + (h_all - LINE_H_HEADER) / 2

    pdf.set_xy(box_x + 3, start_y)
    pdf.cell(col_mid - 6, LINE_H_HEADER, get_text(lang, "attachments"), align="C")  # ✅ แก้ตรงนี้

    # ----- กล่องขวา (Issue ID) ----- #
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_all)

    pdf.set_xy(xr, y_top + 1)
    pdf.set_font(base_font, "B", FONT_MAIN - 1)
    pdf.multi_cell(col_right, LINE_H_HEADER, f"{get_text(lang, 'issue_id')}\n{issue_id}", align="C")  # ✅ แก้ตรงนี้

    return y_top + h_all


def _resolve_test_file_path(url_path: str) -> Optional[str]:
    """
    แปลง URL path เป็น absolute file path
    """
    if not url_path:
        return None
    
    raw = str(url_path).strip()
    
    # Strip leading slash
    clean_path = raw.lstrip("/")
    
    if clean_path.startswith("uploads/"):
        rel_after_uploads = clean_path[len("uploads/"):]
    else:
        rel_after_uploads = clean_path
    
    # หา backend/uploads
    current_file = Path(__file__).resolve()
    backend_root = None
    
    for p in current_file.parents:
        if p.name.lower() == "backend" and p.exists():
            backend_root = p
            break
    
    if backend_root is None:
        for i in range(1, 4):
            cand = current_file.parents[i] if i < len(current_file.parents) else None
            if cand and (cand / "backend").exists():
                backend_root = cand / "backend"
                break
    
    if backend_root:
        uploads_root = backend_root / "uploads"
        if uploads_root.exists():
            candidate = uploads_root / rel_after_uploads
            if candidate.exists() and candidate.is_file():
                return str(candidate)
    
    return None


def _merge_pdfs(main_pdf_bytes: bytes, pdf_files_info: List[Tuple[str, str, int, float, float, float, float]]) -> bytes:
    """
    รวม PDF หลักกับ PDF ที่แนบมา พร้อมเพิ่ม bookmarks และ clickable links
    pdf_files_info: List of (pdf_path, bookmark_name, link_page, x, y, w, h)
    """
    if not HAS_PYPDF2:
        print("[PDF Merge] ⚠️ PyPDF2 not installed. Returning main PDF only.")
        return main_pdf_bytes
    
    if not pdf_files_info:
        return main_pdf_bytes
    
    try:
        from PyPDF2.generic import (
            ArrayObject, DictionaryObject, FloatObject,
            NameObject, NumberObject
        )
        
        # ตรวจสอบว่ามีไฟล์ PDF จริงๆ กี่ไฟล์
        valid_pdf_files = []
        for item in pdf_files_info:
            pdf_path = item[0]
            if pdf_path and Path(pdf_path).exists():
                valid_pdf_files.append(item)
        
        if not valid_pdf_files:
            print("[PDF Merge] ⚠️ No valid PDF files found. Returning main PDF only.")
            return main_pdf_bytes
        
        # นับหน้า PDF หลัก
        main_buffer = BytesIO(main_pdf_bytes)
        main_reader = PdfReader(main_buffer)
        main_page_count = len(main_reader.pages)
        
        # รวม PDF ด้วย PdfWriter
        writer = PdfWriter()
        
        # เพิ่มหน้าจาก PDF หลัก
        main_buffer.seek(0)
        main_reader = PdfReader(main_buffer)
        for page in main_reader.pages:
            writer.add_page(page)
        
        # คำนวณเลขหน้าปลายทางและเพิ่ม PDF ที่แนบ
        current_page = main_page_count  # หน้าถัดไปหลัง PDF หลัก (0-indexed)
        link_info_list = [] 
        
        for item in valid_pdf_files:
            pdf_path, bookmark_name, link_page, x, y, w, h = item
            try:
                with open(pdf_path, 'rb') as f:
                    attached_reader = PdfReader(f)
                    num_pages = len(attached_reader.pages)
                    
                    # เก็บข้อมูล link - ใช้ current_page ที่คำนวณจริง
                    target_page = current_page
                    link_info_list.append((link_page, target_page, x, y, w, h))
                    
                    # เพิ่มหน้าจาก PDF ที่แนบ
                    for page in attached_reader.pages:
                        writer.add_page(page)
                    
                    # เพิ่ม bookmark
                    try:
                        writer.add_outline_item(
                            f"{bookmark_name} (p.{current_page + 1})",
                            target_page
                        )
                    except:
                        pass
                    
                    current_page += num_pages
                    
            except Exception as e:
                print(f"[PDF Merge] ⚠️ Error adding {pdf_path}: {e}")
                continue
        
        # เพิ่ม bookmark สำหรับ Report หลัก
        try:
            writer.add_outline_item("📋 Test Report", 0)
        except:
            pass
        
        # ★★★ เพิ่ม clickable links ★★★
        PT_PER_MM = 72 / 25.4
        PAGE_HEIGHT_MM = 297
        
        for link_page, target_page, x, y, w, h in link_info_list:
            try:
                page_obj = writer.pages[link_page]
                
                x1_pt = x * PT_PER_MM
                x2_pt = (x + w) * PT_PER_MM
                y_top_pt = (PAGE_HEIGHT_MM - y) * PT_PER_MM
                y_bottom_pt = (PAGE_HEIGHT_MM - y - h) * PT_PER_MM
                
                link_annot = DictionaryObject()
                link_annot[NameObject("/Type")] = NameObject("/Annot")
                link_annot[NameObject("/Subtype")] = NameObject("/Link")
                link_annot[NameObject("/Rect")] = ArrayObject([
                    FloatObject(x1_pt),
                    FloatObject(y_bottom_pt),
                    FloatObject(x2_pt),
                    FloatObject(y_top_pt),
                ])
                link_annot[NameObject("/Border")] = ArrayObject([
                    NumberObject(0), NumberObject(0), NumberObject(0)
                ])
                link_annot[NameObject("/Dest")] = ArrayObject([
                    writer.pages[target_page].indirect_reference,
                    NameObject("/Fit")
                ])
                
                if "/Annots" not in page_obj:
                    page_obj[NameObject("/Annots")] = ArrayObject()
                
                page_obj[NameObject("/Annots")].append(link_annot)
                
                # print(f"[PDF Link] ✅ Link: page {link_page + 1} → page {target_page + 1}")
                
            except Exception as e:
                print(f"[PDF Link] ⚠️ Error: {e}")
                continue
        
        # Output
        output_buffer = BytesIO()
        writer.write(output_buffer)
        
        output_buffer.seek(0)
        return output_buffer.read()
        
    except Exception as e:
        print(f"[PDF Merge] ❌ Merge failed: {e}")
        import traceback
        traceback.print_exc()
        return main_pdf_bytes


# ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
def make_pm_report_html_pdf_bytes(doc: dict, lang: str = "en") -> bytes:
    # ตั้งค่า font size ตามภาษา
    global FONT_MAIN, FONT_SMALL, LINE_H, LINE_H_HEADER, ROW_MIN_H, FONT_HEADER
    
    font_config = FONT_CONFIG.get(lang, FONT_CONFIG["en"])
    FONT_MAIN = font_config["main"]
    FONT_SMALL = font_config["small"]
    FONT_HEADER = font_config["header"]
    LINE_H = font_config["line_h"]
    LINE_H_HEADER = font_config["line_h_header"]
    ROW_MIN_H = font_config["row_min_h"]
    
    pdf = HTML2PDF(unit="mm", format="A4")
    pdf.set_margins(left=10, top=15, right=10)  
    pdf.set_auto_page_break(auto=True, margin=40)

    # ตั้งค่าภาษา
    pdf.lang = lang

    # โหลดฟอนต์ไทยให้แน่นอนก่อน set_font
    base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
    pdf.set_font(base_font, size=FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)

    # ตั้งค่าข้อมูลสำหรับ header
    pdf.base_font_name = base_font

    issue_id = str(doc.get("issue_id", "-"))

    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right - 1
    x0 = left + 0.5
    EDGE_ALIGN_FIX = (LINE_W_OUTER - LINE_W_INNER) / 2.0

    col_left, col_mid = 40, 120
    col_right = page_w - col_left - col_mid

    pdf.set_line_width(LINE_W_INNER)

    # เริ่มหน้าแรก
    pdf.add_page()
    y = _draw_header(pdf, base_font, issue_id, lang)
    
    # วาดกรอบนอก
    FRAME_INSET = 6
    FRAME_TOP = y
    FRAME_BOTTOM = 5
    pdf.set_line_width(LINE_W_OUTER)
    pdf.rect(FRAME_INSET, FRAME_TOP, 198, pdf.h - FRAME_TOP - FRAME_BOTTOM)
    pdf.set_line_width(LINE_W_INNER)

    # ฟอร์มรายละเอียด
    head = doc.get("head", {}) or {}
    manufacturer = head.get("manufacturer")
    model        = head.get("model", "")
    power        = head.get("power", "")
    serial_no    = head.get("serial_number", "")
    location     = head.get("location", "")
    firmware     = head.get("firmware_version", "")
    inspection   = str(doc.get("inspection_date") or "")

    y = _draw_ev_header_form(pdf, base_font, x0, y, page_w,
                         manufacturer, model, power, serial_no,
                         location, firmware, inspection,
                         lang=lang,
                         power_w_mm=30.0) 

    # Equipment identification
    eq = doc.get("equipment") or {}
    mans = eq.get("manufacturers") or []
    mods = eq.get("models") or []
    sns  = eq.get("serialNumbers") or []

    rows = max(len(mans), len(mods), len(sns))

    equip_items = []
    for i in range(rows):
        equip_items.append({
            "manufacturer": mans[i] if i < len(mans) else "",
            "model":        mods[i] if i < len(mods) else "",
            "serial_no":    sns[i]  if i < len(sns)  else "",
        })
        
    electrical_safety = doc.get("electrical_safety", {})
    charger_safety = doc.get("charger_safety", {})
    remark_text = doc.get("remarks", {}).get("testRemark", "")

    y = _draw_equipment_ident_details(pdf, base_font, x0, y, page_w, equip_items, lang=lang, num_rows=5)
    y = draw_testing_topics_safety_section(
        pdf,
        x=x0,
        y=y,
        base_font=base_font,
        font_size=FONT_MAIN,
        table_width=page_w,
        safety=electrical_safety,
        doc=doc,
        lang=lang
    )

    y += 2
    y = draw_charging_procresss_testing(
        pdf,
        x=x0,
        y=y,
        base_font=base_font,
        font_size=FONT_MAIN,
        table_width=page_w,
        safety=charger_safety,
        doc=doc,
        lang=lang
    )
    
    y += 3
    y = draw_remark_and_symbol_section(pdf, base_font, x0, y, page_w, doc=doc, lang=lang)

    # สร้างหน้ารูปภาพ
    _draw_picture_page(pdf, base_font, issue_id, doc, lang=lang)

    # ★★★ วาดหน้ารายการไฟล์แนบ และเก็บ list ของ PDF ที่ต้องรวม ★★★
    pdf_files_to_merge = _draw_attachments_list_page(pdf, base_font, issue_id, doc, lang)

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_fill_color(255, 230, 100)
    
    # ★★★ Output PDF หลัก ★★★
    main_pdf_bytes = _output_pdf_bytes(pdf)
    
    # ★★★ รวม PDF ที่แนบมา (ถ้ามี) ★★★
    if pdf_files_to_merge:
        return _merge_pdfs(main_pdf_bytes, pdf_files_to_merge)
    
    return main_pdf_bytes

def generate_pdf(data: dict, lang: str = None) -> bytes:
    # ตรวจสอบภาษาจาก parameter หรือจาก data
    if lang is None:
        lang = data.get("lang", "en")
    
    # ตรวจสอบว่าเป็นภาษาที่รองรับ
    if lang not in ["th", "en"]:
        lang = "en"
    
    return make_pm_report_html_pdf_bytes(data, lang=lang)