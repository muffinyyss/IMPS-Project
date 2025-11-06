# backend/pdf/templates/pdf_charger.py
from fpdf import FPDF, HTMLMixin
from pathlib import Path
from datetime import datetime, date
import re
from typing import Optional, Tuple, List, Dict, Any, Union

# -------------------- ฟอนต์ไทย --------------------
FONT_CANDIDATES: Dict[str, List[str]] = {
    "":  ["THSarabunNew.ttf", "TH Sarabun New.ttf", "THSarabun.ttf", "TH SarabunPSK.ttf"],
    "B": ["THSarabunNew-Bold.ttf", "THSarabunNew Bold.ttf", "TH Sarabun New Bold.ttf", "THSarabun Bold.ttf"],
    "I": ["THSarabunNew-Italic.ttf", "THSarabunNew Italic.ttf", "TH Sarabun New Italic.ttf", "THSarabun Italic.ttf"],
    "BI":["THSarabunNew-BoldItalic.ttf", "THSarabunNew BoldItalic.ttf", "TH Sarabun New BoldItalic.ttf", "THSarabun BoldItalic.ttf"],
}

def add_all_thsarabun_fonts(pdf: FPDF, family_name: str = "THSarabun") -> bool:
    """
    โหลดฟอนต์ TH Sarabun โดยค้นทั้ง:
      - <this file>/fonts            (เช่น backend/pdf/templates/fonts)
      - <this file>/../fonts         (เช่น backend/pdf/fonts)
      - โฟลเดอร์ฟอนต์ของระบบ (Windows/macOS/Linux)
    คืนค่า True ถ้าโหลด regular ("") ได้สำเร็จ
    """
    import os

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
            # fpdf2 ต้อง uni=True เพื่อรองรับ Unicode/ภาษาไทย
            pdf.add_font(family_name, style, str(p), uni=True)
            if style == "":
                loaded_regular = True
        except Exception:
            # กันเคส "add ซ้ำ" หรือ error ยิบย่อย—ข้ามไปโหลด style อื่นต่อ
            pass

    return loaded_regular



# -------------------- ชื่อหัวข้อแถวจากโค้ด --------------------
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
    "r10": "วัดแรงดันวงจรควบคุมการอัดประจุ",
    "r11": "ตรวจสอบแผ่นกรองระบายอากาศ",
    "r12": "ตรวจสอบจุดต่อทางไฟฟ้า",
    "r13": "ตรวจสอบคอนแทคเตอร์",
    "r14": "ตรวจสอบอุปกรณ์ป้องกันไฟกระชาก",
    "r15": "ตรวจสอบแรงดันไฟฟ้าที่พิน CP",
    "r16": "ตรวจสอบลำดับเฟส",
    "r17": "วัดแรงดันไฟฟ้าด้านเข้า",
    "r18": "ทดสอบการอัดประจุ",
    "r19": "ทำความสะอาด",
}

# -------------------- Helpers / Layout constants --------------------
LINE_W_OUTER = 0.45
LINE_W_INNER = 0.22
PADDING_X = 2.0
PADDING_Y = 1.2
FONT_MAIN = 14.0
FONT_SMALL = 13.0
LINE_H = 6.8
ROW_MIN_H = 9
CHECKBOX_SIZE = 4.0

class HTML2PDF(FPDF, HTMLMixin):
    pass

def _draw_check(pdf: FPDF, x: float, y: float, size: float, checked: bool):
    pdf.rect(x, y, size, size)
    if checked:
        lw_old = pdf.line_width
        pdf.set_line_width(0.6)
        pdf.line(x + 0.7, y + size * 0.55, x + size * 0.40, y + size - 0.7)
        pdf.line(x + size * 0.40, y + size - 0.7, x + size - 0.7, y + 0.7)
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

    # ปรับตำแหน่งให้ชิดบนสุดจริง ๆ ถ้า valign == "top"
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


def _format_m17(measures: dict) -> str:
    ms = (measures or {}).get("m17") or {}
    order = [
        "L1-L2", "L2-L3", "L3-L1",
        "L1-N", "L2-N", "L3-N",
        "L1-G", "L2-G", "L3-G",
        "N-G"
    ]
    def fmt(k: str) -> str:
        d = ms.get(k) or {}
        val = (d.get("value") or "").strip()
        unit = (d.get("unit") or "").strip()
        return f"{k} = {val}{unit}" if val else f"{k} = -"
    lines = [fmt(k) for k in order]
    return "\n".join(lines)

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
    # ตำแหน่งไฟล์ตามรูปของคุณ: .../iMPS_platform/public/img
    # โครงสร้างไฟล์นี้อยู่ที่ .../iMPS_platform/backend/pdf/templates/pdf_charger.py
    # ต้องไต่ขึ้น 3 ชั้นไปที่ iMPS_platform แล้วค่อยลง public/img
    names = [
        "logo_egat.png", "logo_egatev.png", "logo_egat_ev.png",
        "egat_logo.png", "logo-ct.png", "logo_ct.png",
        "logo_egat.jpg", "logo_egat.jpeg",
    ]
    roots = [
        Path(__file__).parent / "assets",                     # backend/pdf/templates/assets
        Path(__file__).parent.parent / "assets",              # backend/pdf/assets
        Path(__file__).resolve().parents[3] / "public" / "img",        # ✅ iMPS_platform/public/img
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

def _draw_job_info_block(pdf: FPDF, base_font: str, x: float, y: float, w: float,
                         station_name: str, model: str, sn: str, pm_date: str) -> float:
    row_h = 8.5
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


def _r_idx(k: str) -> int:
    m = re.match(r"r(\d+)$", k.lower())
    return int(m.group(1)) if m else 10_000

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
        if key.lower() == "r17":
            mtxt = _format_m17(measures or {})
            if mtxt:
                remark = mtxt
        if key.lower() == "r15":
            cp_value = (measures.get("cp", {}) or {}).get("value", "-")
            cp_unit = (measures.get("cp", {}) or {}).get("unit", "")
            remark = f"CP = {cp_value}{cp_unit}"
        items.append({
            "text": f"{idx}. {title}",
            "result": _norm_result(data.get("pf", "")),
            "remark": remark,
        })
    return items

def _draw_items_table_header(pdf: FPDF, base_font: str, x: float, y: float, item_w: float, result_w: float, remark_w: float):
    header_h = 9.0
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(item_w, header_h, "Item", border=1, align="C")
    pdf.cell(result_w, header_h, "Result", border=1, align="C")
    pdf.cell(remark_w, header_h, "Remark", border=1, ln=1, align="C")
    y += header_h
    pdf.set_fill_color(255, 255, 0)
    pdf.set_xy(x, y)
    pdf.cell(item_w + result_w + remark_w, 8, "เครื่องอัดประจุไฟฟ้า เครื่องที่ 1", border=1, ln=1, align="L", fill=True)
    return y + 8

def _draw_result_cell(pdf: FPDF, base_font: str, x: float, y: float, w: float, h: float, result: str):
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
        start_y = y + (h - CHECKBOX_SIZE) / 2.0
        _draw_check(pdf, start_x, start_y, CHECKBOX_SIZE, chk)
        pdf.set_xy(start_x + CHECKBOX_SIZE + 1.6, y + (h - LINE_H) / 2.0)
        pdf.cell(text_w, LINE_H, lab, border=0, ln=0, align="L")
    pdf.set_xy(x + w, y)

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

def _output_pdf_bytes(pdf: FPDF) -> bytes:
    """
    รองรับ fpdf2 หลายเวอร์ชัน: บางเวอร์ชันคืน bytearray, บางเวอร์ชันคืน str (latin1)
    """
    data = pdf.output(dest="S")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    # fpdf2 เก่าอาจคืน str
    return data.encode("latin1")

def make_pm_report_html_pdf_bytes(doc: dict) -> bytes:
    pdf = HTML2PDF(unit="mm", format="A4")
    pdf.set_margins(left=10, top=10, right=10)
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()

    # ---- โหลดฟอนต์ไทยให้แน่นอนก่อน set_font ----
    base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
    pdf.set_font(base_font, size=FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)

    job = doc.get("job", {}) or {}
    station_name = job.get("station_name", "-")
    model = job.get("model", "-")
    sn = job.get("sn", "-")
    pm_date = _fmt_date_thai_like_sample(doc.get("pm_date", job.get("date", "-")))

    checks = _rows_to_checks(doc.get("rows") or {}, doc.get("measures") or {})

    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left
    y = 10
    EDGE_ALIGN_FIX = (LINE_W_OUTER - LINE_W_INNER) / 2.0

    col_left, col_mid = 40, 120
    col_right = page_w - col_left - col_mid
    h_all = 30
    h_right_top = 12
    pdf.set_line_width(LINE_W_INNER)

    # โลโก้
    pdf.rect(x0, y, col_left, h_all)
    logo_path = _resolve_logo_path()
    if logo_path:
        IMG_W = 35
        img_x = x0 + (col_left - IMG_W) / 2
        img_y = y + (h_all - 16) / 2
        pdf.image(logo_path.as_posix(), x=img_x, y=img_y, w=IMG_W)

    # กล่องที่อยู่/ส่วนกลาง
    box_x = x0 + col_left
    box_y = y
    box_w = col_mid
    box_h = h_all
    pad_x = 3
    line_h = 6.2
    addr_lines = [
        "Electricity Generating Authority of Thailand (EGAT)",
        "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand",
        "Call Center Tel. 02-114-3350",
    ]
    pdf.rect(box_x, box_y, box_w, box_h)
    total_h = line_h * len(addr_lines)
    start_y = box_y + (box_h - total_h) / 2
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(box_x + pad_x, start_y)
    pdf.cell(box_w - 2 * pad_x, line_h, addr_lines[0], ln=1, align="C")
    pdf.set_font(base_font, "", FONT_MAIN)
    for i in range(1, len(addr_lines)):
        pdf.set_xy(box_x + pad_x, start_y + i * line_h)
        pdf.cell(box_w - 2 * pad_x, line_h, addr_lines[i], ln=1, align="C")

    # กล่องขวา (Page / Issue)
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y, col_right, h_right_top)
    pdf.rect(xr, y + h_right_top, col_right, h_all - h_right_top)
    pdf.set_xy(xr, y + 4)
    pdf.cell(col_right, 6, f"Page {pdf.page_no()}", align="C")
    pdf.set_xy(xr, y + h_right_top + (h_all - h_right_top) / 2 - 3.2)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(col_right, 6, "Issue ID", align="C")

    # ชื่อเอกสาร
    y += h_all
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 16)
    pdf.cell(page_w, 10, "Preventive Maintenance Checklist - เครื่องอัดประจุไฟฟ้า", border=1, ln=1, align="C")
    y += 10
    
    # แสดงข้อมูลงานใต้หัวเรื่อง
    y = _draw_job_info_block(pdf, base_font, x0, y, page_w, station_name, model, sn, pm_date)

    # ตารางรายการ
    x_table = x0 + EDGE_ALIGN_FIX
    table_total_w = page_w - 2 * EDGE_ALIGN_FIX
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "", FONT_MAIN)

    item_w = 65
    result_w = 64
    remark_w = page_w - item_w - result_w

    def _ensure_space(height_needed: float):
        nonlocal y
        if y + height_needed > (pdf.h - pdf.b_margin):
            pdf.add_page()
            y = 10
            # (fix) ต้องใช้ x_table ไม่ใช่ x0 เพื่อชดเชย EDGE_ALIGN_FIX ให้เสมอ
            y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w)
            pdf.set_font(base_font, "", FONT_MAIN)

    y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w)
    pdf.set_font(base_font, "", FONT_MAIN)

    for it in checks:
        text = str(it.get("text", ""))
        result = it.get("result", "na")
        remark = str(it.get("remark", "") or "")

        _, item_h = _split_lines(pdf, item_w - 2 * PADDING_X, text, LINE_H)
        _, remark_h = _split_lines(pdf, remark_w - 2 * PADDING_X, remark, LINE_H)
        row_h_eff = max(ROW_MIN_H, item_h, remark_h)

        _ensure_space(row_h_eff)

        x = x_table
        _cell_text_in_box(pdf, x, y, item_w, row_h_eff, text, align="L", lh=LINE_H)
        x += item_w
        _draw_result_cell(pdf, base_font, x, y, result_w, row_h_eff, result)
        x += result_w
        _cell_text_in_box(pdf, x, y, remark_w, row_h_eff, remark, align="L", lh=LINE_H, valign="top")

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
    h_summary = 10
    h_checklist = 12
    total_h = h_comment + h_summary + h_checklist
    pdf.rect(comment_x, comment_y, item_w + result_w + remark_w, total_h)

    pdf.set_xy(comment_x, comment_y)
    pdf.set_font(base_font, "B", 13)
    pdf.cell(comment_item_w, h_comment, "Comment :", border=1, align="L")
    pdf.set_font(base_font, "", 13)
    comment_text = str(doc.get("summary", "") or "-")
    pdf.multi_cell(comment_result_w + comment_remark_w, h_comment, comment_text, border=1, align="L")
    comment_y += h_comment

    summary_check = str(doc.get("summaryCheck", "")).strip().upper() or "-"

    pdf.set_xy(comment_x, comment_y)
    pdf.set_font(base_font, "B", 13)
    pdf.cell(comment_item_w, h_checklist, "ผลการตรวจสอบ :", border=1, align="L")
    pdf.set_font(base_font, "", 13)
    x_check_start = comment_x + comment_item_w + 10
    y_check = comment_y + (h_checklist - CHECKBOX_SIZE) / 2.0
    gap = 35
    options = [("Pass", summary_check == "PASS"), ("Fail", summary_check == "FAIL"), ("N/A", summary_check == "N/A")]
    for i, (label, checked) in enumerate(options):
        x_box = x_check_start + i * gap
        _draw_check(pdf, x_box, y_check, CHECKBOX_SIZE + 0.5, checked)
        pdf.set_xy(x_box + CHECKBOX_SIZE + 3, y_check - 1)
        pdf.cell(20, LINE_H + 1, label, ln=0, align="L")

    pdf.rect(comment_x, comment_y, item_w + result_w + remark_w, h_checklist)
    y = comment_y + h_checklist
    
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
    pdf.set_fill_color(255, 255, 0)

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


    return _output_pdf_bytes(pdf)

# Public API expected by pdf_routes: generate_pdf(data) -> bytes
def generate_pdf(data: dict) -> bytes:
    """
    Adapter for existing pdf_routes which expects each template to expose
    generate_pdf(data) returning PDF bytes.
    `data` is the Mongo document / dict for that PM report.
    """
    return make_pm_report_html_pdf_bytes(data)
