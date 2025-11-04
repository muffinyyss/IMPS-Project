# backend/pdf/pdf_routes.py
from fastapi import APIRouter, Response, HTTPException, Query
from fastapi.responses import RedirectResponse
from fpdf import FPDF, HTMLMixin
from pathlib import Path
from urllib.parse import quote
from bson import ObjectId
from bson.errors import InvalidId
from main import client1 as pymongo_client
from datetime import datetime, date
import re

router = APIRouter(prefix="/pdf", tags=["pdf"])

# -------------------- ฟอนต์ไทย --------------------
FONT_FILES = {
    "": "THSarabunNew.ttf",
    "B": "THSarabunNew Bold.ttf",
    "I": "THSarabunNew Italic.ttf",
    "BI": "THSarabunNew BoldItalic.ttf",
}


def add_all_thsarabun_fonts(pdf: FPDF):
    fonts_dir = Path(__file__).parent / "fonts"
    for style, filename in FONT_FILES.items():
        font_path = fonts_dir / filename
        if font_path.exists():
            pdf.add_font("THSarabun", style, str(font_path), uni=True)
    if not (fonts_dir / FONT_FILES[""]).exists():
        raise FileNotFoundError("ไม่พบฟอนต์ THSarabunNew.ttf ใน backend/pdf/fonts/")


# -------------------- MongoDB --------------------
PMREPORT_DB_NAME = "PMReport"
db = pymongo_client[PMREPORT_DB_NAME]


def safe_filename(name: str) -> str:
    bad = '\\/:*?"<>|'
    for ch in bad:
        name = name.replace(ch, "_").strip()
    return name or "report"


def _validate_station_id(station_id: str):
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")


def get_pmreport_collection_for(station_id: str):
    _validate_station_id(station_id)
    return db[str(station_id)]


def _extract_station_and_date(doc: dict, fallback_station: str = "unknown"):
    st = str(doc.get("station_id") or fallback_station or "unknown").strip()
    raw_pm = doc.get("pm_date") or (doc.get("job") or {}).get("date") or ""
    raw_pm = str(raw_pm)
    pm_date_only = raw_pm.split("T")[0][:10].replace("-", "")
    return st, pm_date_only


# -------------------- PDF Class --------------------
class HTML2PDF(FPDF, HTMLMixin):
    pass


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


# -------------------- Utilities: วันที่/โลโก้/รูปแบบ --------------------
def _format_m17(measures: dict) -> str:
    """
    แสดงค่าการวัดทั้งหมดใน column Remark ตามลำดับที่ต้องการ
    """
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

    # รวมเป็นข้อความหลายบรรทัด (แสดงใน Remark)
    lines = [fmt(k) for k in order]
    return "\n".join(lines)


def _parse_date_flex(s: str) -> datetime | None:
    if not s:
        return None
    s = str(s)
    m = re.match(r"^\s*(\d{4})-(\d{1,2})-(\d{1,2})", s)  # รองรับ 2025-11-3
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


def _resolve_logo_path() -> Path | None:
    candidates = [
        Path(__file__).parent / "assets" / "logo_egatev.png",
        Path(__file__).parent / "assets" / "logo_egat.png",
        Path(__file__).parent / ".." / ".." / "public" / "img" / "logo_egat.png",
        Path(
            r"D:\eds_cream\github\IMPS-Project\iMPS_platform\public\img\logo_egat.png"
        ),
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            return p
    return None

# -------------------- วาดองค์ประกอบพื้นฐาน --------------------
LINE_W_OUTER = 0.45
LINE_W_INNER = 0.22
PADDING_X = 2.0
PADDING_Y = 1.2
FONT_MAIN = 14.0  # ฟอนต์หลักใหญ่ขึ้น (เช่นข้อความในตาราง)
FONT_SMALL = 14.0  # ขนาดฟอนต์ของป้าย Pass / Fail / N/A
LINE_H = 6.8  # ↑ แนะนำเพิ่มขึ้นนิดหน่อยเพื่อไม่ให้ทับเส้น
ROW_MIN_H = 11  # ↑ เพิ่มความสูงแถวให้บาลานซ์กับฟอนต์ใหม่
CHECKBOX_SIZE = 4.0


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
        # fallback คร่าว ๆ
        avg_char_w = max(pdf.get_string_width("ABCDEFGHIJKLMNOPQRSTUVWXYZ") / 26.0, 1)
        max_chars = max(int(width / avg_char_w), 1)
        lines, buf = [], text
        while buf:
            lines.append(buf[:max_chars])
            buf = buf[max_chars:]
    return lines, max(line_h, len(lines) * line_h)


def _cell_text_in_box(pdf: FPDF, x: float, y: float, w: float, h: float, text: str,
                      align="L", lh=LINE_H, valign="middle"):
    # วาดกรอบ
    pdf.rect(x, y, w, h)

    # พื้นที่ภายใน
    inner_x = x + PADDING_X
    inner_w = w - 2 * PADDING_X
    text = "" if text is None else str(text)
    # ปรับ \r\n/\r -> \n ให้เป็นมาตรฐานเดียว
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # --- ฟังก์ชัน wrap ทีละย่อหน้า (คั่นด้วย \n) ---
    def _wrap_paragraph(paragraph: str) -> list[str]:
        words = paragraph.split(" ")
        lines, cur = [], ""
        for wd in words:
            candidate = wd if not cur else (cur + " " + wd)
            if pdf.get_string_width(candidate) <= inner_w:
                cur = candidate
            else:
                if cur:
                    lines.append(cur)
                # ถ้าคำยาวเกินความกว้างบรรทัดเดียว ให้ตัดแบบตัวอักษร
                if pdf.get_string_width(wd) <= inner_w:
                    cur = wd
                else:
                    buf = wd
                    while buf:
                        k = 1
                        # หา substring ที่ยาวสุดที่ยังพอดีความกว้าง
                        while k <= len(buf) and pdf.get_string_width(buf[:k]) <= inner_w:
                            k += 1
                        lines.append(buf[:k-1])
                        buf = buf[k-1:]
                    cur = ""
        if cur:
            lines.append(cur)
        # บรรทัดว่างสำหรับย่อหน้าถัดไป
        return lines

    # แตกเป็นย่อหน้าตาม \n แล้ว wrap ทีละย่อหน้า
    paragraphs = text.split("\n")
    lines: list[str] = []
    for i, p in enumerate(paragraphs):
        # อนุญาตให้ใส่บรรทัดว่างจริง ๆ ได้
        if p == "":
            lines.append("")
            continue
        lines.extend(_wrap_paragraph(p))

    # คำนวณจุดเริ่มตาม valign
    content_h = max(lh, len(lines) * lh)
    if valign == "top":
        start_y = y + PADDING_Y
    else:
        start_y = y + max((h - content_h) / 2.0, PADDING_Y)

    # พิมพ์ทีละบรรทัดภายในกรอบ (ควบคุมตำแหน่งเองทุกบรรทัด)
    cur_y = start_y
    pdf.set_xy(inner_x, cur_y)
    for ln in lines:
        if cur_y > y + h - lh:
            break  # เกินกรอบก็หยุด
        pdf.set_xy(inner_x, cur_y)
        pdf.cell(inner_w, lh, ln, border=0, ln=1, align=align)
        cur_y += lh

    # จบบรรทัดนี้ให้ cursor ไปอยู่ขอบขวาของ cell เพื่อไม่รบกวนคอลัมน์ถัดไป
    pdf.set_xy(x + w, y)

    

def _rows_to_checks(rows: dict, measures: dict | None = None) -> list[dict]:
    if not isinstance(rows, dict):
        return []
    items = []

    def _r_idx(k: str) -> int:
        m = re.match(r"r(\d+)$", k.lower())
        return int(m.group(1)) if m else 10_000

    for key in sorted(rows.keys(), key=_r_idx):
        idx = _r_idx(key)
        data = rows.get(key) or {}
        title = ROW_TITLES.get(key, f"รายการที่ {idx}")

        # ดึงค่า remark ปกติ
        remark = (data.get("remark") or "").strip()

        # ✅ เงื่อนไขเฉพาะข้อ 17
        if key.lower() == "r17":
            # รวมค่าทั้งหมดจาก measures.m17 เช่น L1-L2 = 2V ...
            mtxt = _format_m17(measures or {})

            # ถ้ามีค่าใน measures ให้แทนที่ remark เดิม
            if mtxt:
                remark = mtxt

        # ✅ เงื่อนไขเฉพาะข้อ 15
        if key.lower() == "r15":
            # สำหรับข้อ 15 ใช้ค่าจาก measures.cp เช่น "cp = 3V"
            cp_value = measures.get("cp", {}).get("value", "-")  # ถ้าไม่มีค่าจะใช้ "-"
            cp_unit = measures.get("cp", {}).get("unit", "")  # ใช้หน่วยที่มีอยู่
            remark = f"CP = {cp_value}{cp_unit}"  # แสดงค่า cp

        # สร้างข้อมูลแต่ละแถวในตาราง
        items.append({
            "text": f"{idx}. {title}",   # ช่อง Item — แสดงชื่อรายการเท่านั้น
            "result": _norm_result(data.get("pf", "")),  # ช่อง Result
            "remark": remark,             # ช่อง Remark — จะมีค่า m17 หรือ cp แสดงในนี้
        })

    return items


# ------- คอมโพเนนต์: หัว Item/Result/Remark + แถบเหลือง -------
def _draw_items_table_header(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    item_w: float,
    result_w: float,
    remark_w: float,
):
    header_h = 9.0
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(x, y)
    pdf.cell(item_w, header_h, "Item", border=1, align="C")
    pdf.cell(result_w, header_h, "Result", border=1, align="C")
    pdf.cell(remark_w, header_h, "Remark", border=1, ln=1, align="C")
    y += header_h
    # แถบเหลือง
    pdf.set_fill_color(255, 255, 0)
    pdf.set_xy(x, y)
    pdf.cell(
        item_w + result_w + remark_w,
        8,
        "เครื่องอัดประจุไฟฟ้า เครื่องที่ 1",
        border=1,
        ln=1,
        align="L",
        fill=True,
    )
    return y + 8


def _draw_result_cell(
    pdf: FPDF, base_font: str, x: float, y: float, w: float, h: float, result: str
):
    """
    วาดช่อง Result แบบ 3 ซับคอลัมน์ (Pass/Fail/N/A) จัดกลาง ไม่ล้นกรอบ
    """
    pdf.rect(x, y, w, h)  # กรอบหลัก
    col_w = w / 3.0
    labels = [
        ("Pass", result == "pass"),
        ("Fail", result == "fail"),
        ("N/A", result == "na"),
    ]
    pdf.set_font(base_font, "", FONT_SMALL)
    for i, (lab, chk) in enumerate(labels):
        sx = x + i * col_w
        # เส้นแบ่งภายใน
        if i > 0:
            pdf.line(sx, y, sx, y + h)
        # กล่องติ๊ก + label จัดกลางในซับคอลัมน์
        text_w = pdf.get_string_width(lab)
        content_w = CHECKBOX_SIZE + 1.6 + text_w
        start_x = sx + (col_w - content_w) / 2.0
        start_y = y + (h - CHECKBOX_SIZE) / 2.0
        _draw_check(pdf, start_x, start_y, CHECKBOX_SIZE, chk)
        pdf.set_xy(start_x + CHECKBOX_SIZE + 1.6, y + (h - LINE_H) / 2.0)
        # ใช้ความกว้าง label จริง ป้องกันล้น
        pdf.cell(text_w, LINE_H, lab, border=0, ln=0, align="L")
    pdf.set_xy(x + w, y)

# ฟังก์ชันสำหรับแสดง checkbox สรุปผลการตรวจสอบ
def _draw_summary_checklist(pdf: FPDF, x: float, y: float, summary_check: str):
    """
    วาด checkbox สำหรับผลการตรวจสอบให้อยู่ในบรรทัดเดียวกัน (PASS / FAIL / N/A)
    """
    pass_checked = summary_check == "PASS"
    fail_checked = summary_check == "FAIL"
    na_checked = summary_check == "N/A"

    pdf.set_font("THSarabun", "", FONT_MAIN)
    start_x = x

    # PASS
    _draw_check(pdf, start_x, y, CHECKBOX_SIZE, pass_checked)
    pdf.set_xy(start_x + CHECKBOX_SIZE + 2, y - 0.5)
    pdf.cell(15, LINE_H, "PASS", align="L")

    # FAIL
    start_x += 25  # ระยะห่างระหว่างช่อง
    _draw_check(pdf, start_x, y, CHECKBOX_SIZE, fail_checked)
    pdf.set_xy(start_x + CHECKBOX_SIZE + 2, y - 0.5)
    pdf.cell(15, LINE_H, "FAIL", align="L")

    # N/A
    start_x += 25
    _draw_check(pdf, start_x, y, CHECKBOX_SIZE, na_checked)
    pdf.set_xy(start_x + CHECKBOX_SIZE + 2, y - 0.5)
    pdf.cell(15, LINE_H, "N/A", align="L")

    return y + LINE_H  # คืนค่าตำแหน่ง y สำหรับบรรทัดถัดไป


# -------------------- สร้าง PDF --------------------
def make_pm_report_html_pdf_bytes(doc: dict) -> bytes:
    pdf = HTML2PDF(unit="mm", format="A4")
    pdf.set_margins(left=10, top=10, right=10)
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()

    # ฟอนต์
    try:
        add_all_thsarabun_fonts(pdf)
        base_font = "THSarabun"
    except Exception:
        base_font = "Arial"
    pdf.set_font(base_font, size=FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)

    # ข้อมูลหัวตาราง
    job = doc.get("job", {}) or {}
    station_name = job.get("station_name", "-")
    model = job.get("model", "-")
    sn = job.get("sn", "-")
    pm_date = _fmt_date_thai_like_sample(doc.get("pm_date", job.get("date", "-")))

    # ใช้ rows จาก DB แต่ชื่อแถวมาจากโค้ด
    checks = _rows_to_checks(doc.get("rows") or {}, doc.get("measures") or {})

    # ขนาดหน้า
    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left
    y = 10

    # คำนวณค่าที่ใช้ในการปรับขอบตารางให้ตรงกับกรอบโลโก้
    EDGE_ALIGN_FIX = (LINE_W_OUTER - LINE_W_INNER) / 2.0   # ~0.115 mm

    # ---------- Header (โลโก้/ที่อยู่/Page/รหัสแบบฟอร์ม) ----------
    col_left, col_mid = 40, 120
    col_right = page_w - col_left - col_mid
    h_all = 30
    h_right_top = 12
    pdf.set_line_width(LINE_W_OUTER)

    # โลโก้
    pdf.rect(x0, y, col_left, h_all)
    logo_path = _resolve_logo_path()
    if logo_path:
        IMG_W = 35  # ความกว้างโลโก้ที่ต้องการ (ปรับได้)
        img_x = x0 + (col_left - IMG_W) / 2  # กึ่งกลางแนวนอน
        img_y = y + (h_all - 16) / 2  # 16 คือความสูงโดยประมาณ ปรับได้เล็กน้อย
        pdf.image(logo_path.as_posix(), x=img_x, y=img_y, w=IMG_W)  # ใส่เฉพาะ w → ไม่ยืดรูป

    # ที่อยู่
    box_x = x0 + col_left
    box_y = y
    box_w = col_mid
    box_h = h_all
    pad_x = 3  # ระยะห่างขอบซ้าย/ขวา
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

    # Page/EV-F-27
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y, col_right, h_right_top)
    pdf.rect(xr, y + h_right_top, col_right, h_all - h_right_top)
    pdf.set_xy(xr, y + 4)
    pdf.cell(col_right, 6, f"Page {pdf.page_no()}", align="C")
    pdf.set_xy(xr, y + h_right_top + (h_all - h_right_top) / 2 - 3.2)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(col_right, 6, "Issue ID", align="C")

    # หัวเรื่อง
    y += h_all
    pdf.set_line_width(LINE_W_OUTER)
    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 16)
    pdf.cell(
        page_w,
        10,
        "Preventive Maintenance Checklist - เครื่องอัดประจุไฟฟ้า",
        border=1,
        ln=1,
        align="C",
    )
    y += 10
    
    # ---- ตารางข้อมูล ---------
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
            y = 10  # เว้นหัวกระดาษด้านบนให้สวย
            y = _draw_items_table_header(pdf, base_font, x0, y, item_w, result_w, remark_w)
            pdf.set_font(base_font, "", FONT_MAIN)

    # ตอนเรียกหัว Item/Result/Remark
    y = _draw_items_table_header(pdf, base_font, x_table, y, item_w, result_w, remark_w)

    pdf.set_font(base_font, "", FONT_MAIN)

    # วาดแต่ละแถว
    for it in checks:
        text = str(it.get("text", ""))
        result = it.get("result", "na")
        remark = str(it.get("remark", "") or "")

        _, item_h = _split_lines(pdf, item_w - 2 * PADDING_X, text, LINE_H)
        _, remark_h = _split_lines(pdf, remark_w - 2 * PADDING_X, remark, LINE_H)
        row_h_eff = max(ROW_MIN_H, item_h, remark_h)

        _ensure_space(row_h_eff)  # กันล้นหน้า

        x = x_table   # เดิมเป็น x0
        _cell_text_in_box(pdf, x, y, item_w, row_h_eff, text, align="L", lh=LINE_H)
        x += item_w
        _draw_result_cell(pdf, base_font, x, y, result_w, row_h_eff, result)
        x += result_w
        _cell_text_in_box(pdf, x, y, remark_w, row_h_eff, remark, align="L", lh=LINE_H, valign="top")

        y += row_h_eff

    # -------------------- Comment & Summary (ต่อเนื่องกับตาราง checklist) ----
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_draw_color(0, 0, 0)

    # ใช้ความกว้างเท่ากับตาราง checklist ด้านบน
    comment_x = x_table
    comment_y = y
    comment_item_w = item_w
    comment_result_w = result_w
    comment_remark_w = remark_w

    # หัวข้อแถบเทา
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font(base_font, "B", 14)
    pdf.cell(item_w + result_w + remark_w, 8, "Comment & Summary", border=1, ln=1, align="C", fill=True)
    comment_y += 8

    # กำหนดความสูงแต่ละส่วน
    h_comment = 16
    h_summary = 10
    h_checklist = 12
    total_h = h_comment + h_summary + h_checklist

    # วาดกรอบใหญ่รวมทั้งหมด
    pdf.rect(comment_x, comment_y, item_w + result_w + remark_w, total_h)

    # --- แถว Comment ---
    pdf.set_xy(comment_x, comment_y)
    pdf.set_font(base_font, "B", 13)
    pdf.cell(comment_item_w, h_comment, "Comment :", border=1, align="L")
    pdf.set_font(base_font, "", 13)
    comment_text = str(doc.get("summary", "") or "-")
    pdf.multi_cell(comment_result_w + comment_remark_w, h_comment, comment_text, border=1, align="L")

    comment_y += h_comment

    # --- แถวสรุปผลการตรวจสอบ ---
    # pdf.set_xy(comment_x, comment_y)
    # pdf.set_font(base_font, "B", 13)
    # pdf.cell(comment_item_w, h_summary, "สรุปผลการตรวจสอบ :", border=1, align="L")

    summary_check = str(doc.get("summaryCheck", "")).strip().upper() or "-"
    # pdf.set_font(base_font, "", 13)
    # pdf.cell(comment_result_w + comment_remark_w, h_summary, f"ผลการตรวจสอบ: {summary_check}", border=1, ln=1, align="L")

    # comment_y += h_summary

    # --- แถว Summary Checkbox ---
    pdf.set_xy(comment_x, comment_y)
    pdf.set_font(base_font, "B", 13)
    pdf.cell(comment_item_w, h_checklist, "ผลการตรวจสอบ :", border=1, align="L")

    pdf.set_font(base_font, "", 13)
    x_check_start = comment_x + comment_item_w + 10
    y_check = comment_y + (h_checklist - CHECKBOX_SIZE) / 2.0
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

    # ปิดกรอบสุดท้าย
    pdf.rect(comment_x, comment_y, item_w + result_w + remark_w, h_checklist)

    y = comment_y + h_checklist + 4

    # -------------------- Signatories (Performed/Approved/Witnessed) - ฟอร์มเปล่า --------------------
    # 📌 กำหนดข้อมูลหัวข้อหลักเท่านั้น
    signer_labels = [
        "Performed by",
        "Approved by",
        "Witnessed by",
    ]

    # การวาดตาราง
    pdf.set_line_width(LINE_W_INNER)
    table_w = item_w + result_w + remark_w # ความกว้างรวม
    col_w = table_w / 3.0
    row_h_header = 8
    row_h_sig = 15
    row_h_name = 6
    row_h_date = 6
    total_sig_h = row_h_header + row_h_sig + row_h_name + row_h_date

    _ensure_space(total_sig_h + 5)

    # 1. แถวหัวข้อ (Perform / Approved / Witnessed) - พื้นหลังเหลือง
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_fill_color(255, 255, 0)
    pdf.set_xy(x_table, y)
    for i, label in enumerate(signer_labels):
        pdf.cell(col_w, row_h_header, label, border=1, ln=0 if i < 2 else 1, align="C", fill=True)
    y += row_h_header

    # 2. แถวช่องลายเซ็น (เว้นว่าง)
    pdf.set_xy(x_table, y)
    for i in range(3):
        pdf.rect(x_table + i * col_w, y, col_w, row_h_sig)
        # เว้นช่องว่างสำหรับลายเซ็น
        pdf.set_xy(x_table + (i + 1) * col_w, y)
    y += row_h_sig

    # 3. แถวชื่อ (Name) - วงเล็บเปล่า และขีดเส้นใต้
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(x_table, y)
    for i in range(3):
        pdf.rect(x_table + i * col_w, y, col_w, row_h_name)
        name_text = f"( \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0 )" # วงเล็บเปล่า
        pdf.set_xy(x_table + i * col_w, y)
        pdf.cell(col_w, row_h_name, name_text, border=0, ln=0 if i < 2 else 1, align="C")
        
        # ขีดเส้นใต้
        # line_y = y + row_h_name - 1.5
        # pdf.line(x_table + i * col_w + 5, line_y, x_table + (i + 1) * col_w - 5, line_y)
        pdf.set_xy(x_table + (i + 1) * col_w, y)
    y += row_h_name

    # 4. แถววันที่ (Date) - เว้นว่าง
    pdf.set_xy(x_table, y)
    for i in range(3):
        pdf.rect(x_table + i * col_w, y, col_w, row_h_date)
        date_text = "Date : \u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0" # เว้นช่องว่าง
        pdf.set_xy(x_table + i * col_w, y)
        pdf.cell(col_w, row_h_date, date_text, border=0, ln=0 if i < 2 else 1, align="C")
        pdf.set_xy(x_table + (i + 1) * col_w, y)
    y += row_h_date


    return bytes(pdf.output(dest="S"))




# -------------------- API --------------------
@router.get("/{id}/export-html")
async def export_pdf_from_html(
    id: str,
    station_id: str = Query(..., description="เช่น Klongluang3"),
    dl: bool = Query(False),
):
    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID ไม่ถูกต้อง")

    coll = get_pmreport_collection_for(station_id)
    doc = coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

    pdf_bytes = make_pm_report_html_pdf_bytes(doc)
    st, pm_date = _extract_station_and_date(doc, station_id)
    filename = safe_filename(f"{pm_date}_{st}.pdf")
    disposition = "attachment" if dl else "inline"
    cd = f"{disposition}; filename={filename}; filename*=UTF-8''{quote(filename)}"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": cd,
            "Cache-Control": "no-store",
        },
    )


@router.get("/{id}/file-html")
async def get_pm_report_redirect(
    id: str,
    station_id: str = Query(...),
    dl: bool = Query(False),
):
    try:
        oid = ObjectId(id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID ไม่ถูกต้อง")

    coll = get_pmreport_collection_for(station_id)
    doc = coll.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="ไม่พบเอกสาร")

    target = f"/pdf/{id}/export-html?station_id={station_id}&dl={int(bool(dl))}"
    return RedirectResponse(url=target, status_code=307)
