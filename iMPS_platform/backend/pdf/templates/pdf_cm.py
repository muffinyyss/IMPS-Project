# backend/pdf/templates/pdf_cm.py
import os
import re
import math
import base64

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

from .cm_codes import (
    cause_label,
    failure_code_label,
    problem_label,
    remedy_descriptions,
)

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

# รูปประกอบปัญหาที่พิมพ์ได้สูงสุด — 3 คอลัมน์ 4 แถว พอดีหน้าเปล่า 1 หน้า
# (ฟอร์มแนบได้ 5 ใบสำหรับ Open / 10 ใบสำหรับ In Progress จึงไม่ตัดของจริงทิ้ง)
PROBLEM_PHOTO_LIMIT = 12

INFO_ROW_H = 6.5
INFO_LABEL_W = 38.0
TABLE_LINE_H = 4.0
SECTION_BAR_BG = (235, 235, 235)
SECTION_BAR_FG = (0, 0, 0)
GRID_COLOR = (0, 0, 0)
LABEL_COLOR = (0, 0, 0)
TABLE_ZEBRA: Optional[Tuple[int, int, int]] = None

# Title bar color (yellow) – ให้สีเดียวกับไฟล์ตัวอย่างอื่น
TITLE_BG = (255, 230, 100)

# -------------------- Styles --------------------
# "form"     = ฟอร์มราชการ ตัวหนังสือเล็ก เส้นกรอบครบทุกช่อง ใส่ข้อมูลได้เยอะต่อหน้า
# "readable" = เน้นอ่านง่าย ตัวใหญ่ขึ้น เส้นบางลง หัวข้อเข้ม แถวสลับสีในตาราง
_STYLES: Dict[str, Dict[str, Any]] = {
    "form": {
        "PADDING_X": 2.0, "PADDING_Y": 0.5,
        "FONT_MAIN": 11.0, "FONT_SMALL": 10.0, "FONT_TITLE": 13.0,
        "LINE_H": 5.0, "SECTION_BAR_H": 5.5,
        "INFO_ROW_H": 6.5, "INFO_LABEL_W": 38.0, "TABLE_LINE_H": 4.0,
        "LINE_W_INNER": 0.22,
        "SECTION_BAR_BG": (235, 235, 235), "SECTION_BAR_FG": (0, 0, 0),
        "GRID_COLOR": (0, 0, 0), "LABEL_COLOR": (0, 0, 0),
        "TABLE_ZEBRA": None,
    },
    "readable": {
        "PADDING_X": 3.5, "PADDING_Y": 1.0,
        "FONT_MAIN": 13.5, "FONT_SMALL": 12.0, "FONT_TITLE": 15.0,
        "LINE_H": 6.2, "SECTION_BAR_H": 8.0,
        "INFO_ROW_H": 9.0, "INFO_LABEL_W": 46.0, "TABLE_LINE_H": 5.2,
        "LINE_W_INNER": 0.15,
        # แถบหัวข้อเข้มตัวอักษรขาว — เป็นจุดพักสายตาให้กวาดหาหมวดได้เร็ว
        "SECTION_BAR_BG": (55, 65, 81), "SECTION_BAR_FG": (255, 255, 255),
        "GRID_COLOR": (170, 170, 170), "LABEL_COLOR": (90, 90, 90),
        "TABLE_ZEBRA": (246, 247, 249),
    },
}
DEFAULT_STYLE = "form"


def _apply_style(name: str) -> str:
    """ตั้งค่าคงที่ของ layout ตามสไตล์ที่เลือก

    ใช้ตัวแปรระดับโมดูลเพราะฟังก์ชันวาดทุกตัวอ้างถึงค่าเหล่านี้โดยตรง
    ปลอดภัยแม้รันใน event loop เพราะการสร้าง PDF เป็น CPU ล้วน ไม่มี await
    คั่นกลาง จึงไม่มีทางที่สองคำขอจะสลับกันเขียนค่าระหว่างวาด
    """
    style = _STYLES.get(name) or _STYLES[DEFAULT_STYLE]
    globals().update(style)
    return name if name in _STYLES else DEFAULT_STYLE


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


def _fmt_date_full(val) -> str:
    """วันที่รูปแบบ DD/MM/YYYY — ภาษาไทยใช้ปี พ.ศ. ภาษาอังกฤษใช้ ค.ศ."""
    if isinstance(val, (datetime, date)):
        d = datetime(val.year, val.month, val.day)
    else:
        d = _parse_date_flex(str(val)) if val is not None else None
    if not d:
        return str(val) if val else "-"
    year = d.year + 543 if _LANG == "th" else d.year
    return d.strftime(f"%d/%m/{year}")


# ผลหลังซ่อม: ค่าที่เก็บใน DB ≠ ข้อความที่ผู้ใช้เห็นบนหน้าเว็บ
# ต้อง map ให้ตรงกับ REPAIR_OPTIONS / LEGACY_REPAIR_MAP ใน checkList.tsx
REPAIR_RESULT_LABELS: Dict[str, str] = {
    "WO - wait for approve": "แก้ไขสำเร็จ",
    # ค่าเก่าก่อนเปลี่ยนชื่อ — ใบงานเดิมยังถืออยู่
    "WO - wait for manpower": "WO - wait for scheduled",
    "WO - wait for spare part": "WO - wait for material",
    "WO - wait for site access": "WO - wait for site condition",
}


def _fmt_repair_result(val) -> str:
    """แปลงค่า repair_result ที่เก็บใน DB เป็นข้อความที่แสดงในเอกสาร"""
    s = str(val or "").strip()
    if not s:
        return "-"
    return REPAIR_RESULT_LABELS.get(s, s)


def _fmt_round_datetime(date_val, time_val) -> str:
    """วันที่ + เวลาของรอบการเข้าแก้ไข (เว้นว่างถ้าไม่มีข้อมูล)"""
    d = _fmt_date_full(date_val)
    d = "" if d in ("-", "") else d
    t = str(time_val or "").strip()
    return " ".join(p for p in (d, t) if p)


def _as_code_list(val) -> List[str]:
    """ฟิลด์รหัสเก็บได้ทั้ง list (เลือกหลายอัน) และ string เดี่ยว"""
    if isinstance(val, list):
        return [str(v).strip() for v in val if str(v or "").strip()]
    s = str(val or "").strip()
    return [s] if s else []


def _join_labels(codes: List[str], to_label) -> str:
    """แปลงรหัสทั้งชุดเป็นคำอธิบาย แล้วต่อเป็นบรรทัดเดียว"""
    seen: List[str] = []
    for c in codes:
        label = to_label(c)
        if label and label not in seen:
            seen.append(label)
    return ", ".join(seen)


# -------------------- i18n --------------------
# ภาษาเอกสารมาจาก query param ?lang= ที่หน้าเว็บส่งมาตามภาษาที่ผู้ใช้เลือก
SUPPORTED_LANGS = ("th", "en")
DEFAULT_LANG = "th"
_LANG = DEFAULT_LANG

T: Dict[str, Tuple[str, str]] = {
    # --- หัวกระดาษ ---
    "page": ("หน้า", "Page"),
    "doc_no": ("เลขที่เอกสาร", "Document No."),
    "doc_name": ("ชื่อเอกสาร", "Document Name"),
    "org1": ("การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)",
             "Electricity Generating Authority of Thailand (EGAT)"),
    "org2": ("เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย",
             "53 Moo 2, Charan Sanitwong Rd., Bang Kruai Sub-district, Bang Kruai District"),
    "org3": ("จังหวัดนนทบุรี 11130 ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416",
             "Nonthaburi 11130, EGAT Call Center 1416"),
    # --- ชื่อหมวด ---
    "sec1": ("ข้อมูลการแจ้ง", "Report Information"),
    "sec2": ("รายละเอียดปัญหา", "Problem Details"),
    "sec3": ("รายละเอียดปัญหาและสาเหตุ", "Problem and Cause Details"),
    "sec3_repair": ("รายละเอียดปัญหาและการแก้ไข", "Problem and Correction Details"),
    "sec4": ("รายละเอียดการแก้ไข", "Corrective Action Details"),
    "sec4_inprogress": ("รายละเอียดการแก้ไข", "Corrective Action Details"),
    "sec5": ("ผลหลังซ่อม", "Repair Result"),
    "people": ("ผู้เกี่ยวข้อง", "Personnel Involved"),
    # --- ป้ายกำกับช่องข้อมูล ---
    "found_date": ("วันที่แจ้ง", "Reported Date"),
    "found_date_closed": ("พบปัญหา", "Found Date"),
    "reported_by": ("ผู้แจ้งปัญหา", "Reported by"),
    "sr_no": ("เลขที่ SR", "SR No."),
    "wo_no": ("เลขที่ WO", "WO No."),
    "location": ("สถานที่", "Location"),
    "wo_status": ("สถานะงาน", "Job Status"),
    "faulty_equipment": ("ตำแหน่งอุปกรณ์ที่พบความผิดปกติ", "Faulty Equipment / Location"),
    "faulty_equipment_repair": ("อุปกรณ์ที่ชำรุด", "Faulty Equipment"),
    "charger_no": ("หมายเลขตู้ชาร์จ", "Charger No."),
    "charger_sn": ("S/N ตู้ชาร์จ", "Charger S/N"),
    "severity": ("ความเร่งด่วน", "Urgency"),
    "problem_details": ("รายละเอียดปัญหา", "Problem Details"),
    "problem_found": ("รายละเอียดปัญหาที่พบ", "Problem Found"),
    "details": ("รายละเอียด", "Details"),
    "remarks": ("หมายเหตุ", "Remarks"),
    "problem_photos": ("รูปภาพประกอบปัญหา", "Problem Photos"),
    "attachments": ("รูปภาพ / ไฟล์แนบ", "Photos / Attachments"),
    "attached_files": ("ไฟล์แนบ (คลิกเพื่อเปิดไฟล์)", "Attached Files (click to open)"),
    "problem": ("รายละเอียดปัญหา", "Problem Description"),
    "cause": ("สาเหตุของปัญหา", "Cause"),
    "start_repair": ("วันที่/เวลา เริ่มแก้ไข", "Repair Start Date/Time"),
    "finish_repair": ("วันที่/เวลา แก้ไขเสร็จ", "Repair Finish Date/Time"),
    "start_repair_inprogress": ("วันที่เริ่มแก้ไข", "Start Repair Date"),
    "finish_repair_inprogress": ("วันที่แก้ไขเสร็จ", "Completed Date"),
    "correction": ("รายละเอียดการแก้ไข", "Correction Details"),
    "inspector": ("ผู้ตรวจสอบ", "Inspector"),
    "repair_result": ("ผลการซ่อม", "Repair Result"),
    "inprogress_remarks": ("หมายเหตุระหว่างดำเนินการ", "In-progress Remarks"),
    "preventive": ("วิธีป้องกันไม่ให้เกิดซ้ำ", "Preventive Action"),
    "result_remarks": ("หมายเหตุผลหลังซ่อม", "Repair Result Remarks"),
    "action_details": ("รายละเอียดการดำเนินการแก้ไข", "Corrective Action Details"),
    "photos_before": ("ภาพถ่ายก่อนการแก้ไข", "Photographs Before Repair"),
    "photos_after": ("ภาพถ่ายหลังการแก้ไข", "Photographs After Repair"),
    "repairer": ("ผู้ดำเนินการแก้ไข", "Repair Technician"),
    "repair_info": ("ข้อมูลการซ่อม", "Repair Information"),
    "signature": ("ลายเซ็นผู้ซ่อม", "Technician Signature"),
    "cancel_reason": ("เหตุผลที่ยกเลิก", "Cancel Reason"),
    "planning": ("การวางแผนงาน", "Planning"),
    "planned_at": ("วันที่/เวลาที่วางแผน", "Planned At"),
    "plan_round": ("วางแผนครั้งที่", "Planning Round"),
    "sched_start": ("วันที่เริ่มตามแผน", "Scheduled Start"),
    "sched_finish": ("วันที่เสร็จตามแผน", "Scheduled Finish"),
    "technician": ("ช่างผู้รับผิดชอบ", "Technician"),
    "waiting_on": ("สถานะรอ", "Waiting On"),
    "waiting_remark": ("หมายเหตุสถานะรอ", "Waiting Remark"),
    # --- ตารางประวัติการเข้าแก้ไข ---
    "history": ("ประวัติการเข้าแก้ไข", "Repair History"),
    "round_no": ("ครั้งที่", "No."),
    "round_start": ("วันที่เข้าแก้ไข", "Started"),
    "round_finish": ("วันที่แก้ไขเสร็จ", "Finished"),
    "round_result": ("ผลหลังซ่อม", "Result"),
    "round_problem": ("ปัญหา / สาเหตุ", "Problem / Cause"),
    "round_action": ("การแก้ไข / หมายเหตุ", "Action / Remarks"),
    "round_before": ("รูปก่อนแก้ไข", "Before"),
    "round_after": ("รูปหลังแก้ไข", "After"),
    # --- ข้อความประกอบ ---
    "action_no": ("ข้อที่ {n}", "Action {n}"),
    "round_label": ("ครั้งที่ {n}", "Round {n}"),
    "date_prefix": ("วันที่ {d}", "Date {d}"),
    "other": ("อื่นๆ: {v}", "Other: {v}"),
    "time_suffix": (" น.", ""),
}


def _apply_lang(name: str) -> str:
    """ตั้งภาษาเอกสาร — ใช้ตัวแปรระดับโมดูลด้วยเหตุผลเดียวกับ _apply_style
    (สร้าง PDF เป็น CPU ล้วน ไม่มี await คั่น จึงไม่มีการสลับกันเขียนค่า)
    """
    global _LANG
    _LANG = name if name in SUPPORTED_LANGS else DEFAULT_LANG
    return _LANG


def _t(key: str, **fmt) -> str:
    """ข้อความตามภาษาเอกสารที่กำลังสร้าง"""
    pair = T.get(key)
    if not pair:
        return key
    text = pair[1] if _LANG == "en" else pair[0]
    return text.format(**fmt) if fmt else text


# ตัวเลือกแบบช่องติ๊ก — (ค่าที่เก็บใน DB, ข้อความ th, ข้อความ en)
# ค่าใน DB ไม่แปล ใช้เป็นตัวเทียบว่าติ๊กช่องไหน
_SEVERITY_CHOICES = [
    ("Low", "ต่ำ", "Low"),
    ("Medium", "ปานกลาง", "Medium"),
    ("High", "สูง", "High"),
    ("Urgent", "เร่งด่วน", "Urgent"),
]
_STATUS_CHOICES = [
    ("Open", "เปิดงาน", "Open"),
    ("In Progress", "ระหว่างดำเนินการ", "In Progress"),
    ("Wait for approve", "รออนุมัติ", "Wait for Approve"),
    ("Closed", "ปิดงาน", "Closed"),
    ("Cancelled", "ยกเลิก", "Cancelled"),
]
# checkbox ผลการซ่อมคงชุดเดิมของ PDF ไม่เพิ่มตัวเลือกตามฟอร์ม
_REPAIR_RESULT_CHOICES = [
    ("แก้ไขสำเร็จ", "แก้ไขสำเร็จ", "Repair completed"),
    ("แก้ไขไม่สำเร็จ", "แก้ไขไม่สำเร็จ", "Repair not completed"),
    ("ไม่พบปัญหา", "ไม่พบปัญหา", "No Problem Found"),
]


def _repair_result_choices(bucket: str) -> List[Tuple[str, str, str]]:
    return _REPAIR_RESULT_CHOICES


def _display_value(value: Any, fallback: str = "-") -> str:
    """แปลงค่าที่อาจเป็น list/ค่าเก่าให้เป็นข้อความเดียวก่อนวาด PDF"""
    if isinstance(value, list):
        values = [str(v).strip() for v in value if str(v or "").strip()]
        return ", ".join(values) if values else fallback
    text = str(value or "").strip()
    return text or fallback


def _derived_cm_number(issue_id: Any, prefix: str) -> str:
    match = re.search(r"(\d+)", str(issue_id or ""))
    return f"{prefix}{int(match.group(1)):03d}" if match else "-"


def _cm_status_bucket(doc: Dict[str, Any]) -> str:
    """จัด status ของ backend ให้ตรงกับฟอร์ม CM ที่ผู้ใช้เปิดกรอก"""
    nested_job = doc.get("job") if isinstance(doc.get("job"), dict) else {}
    status = str(doc.get("status") or nested_job.get("status") or "").strip().lower()
    stage = str(doc.get("stage") or nested_job.get("stage") or "").strip().lower()
    if status in {"closed", "complete", "cancelled", "canceled"}:
        return "closed"
    if status == "wait for approve" and stage == "cs_approval":
        return "open"
    if status in {"in progress", "wait for approve"}:
        return "in_progress"
    if status in {"open", "wait for schedule", "pending"}:
        return "open"
    repair_fields = ("repair_result", "corrective_actions", "cause", "repaired_equipment", "start_repair_date")
    return "in_progress" if any(doc.get(k) for k in repair_fields) else "open"


def _choices(rows: List[Tuple[str, str, str]]) -> List[Tuple[str, str]]:
    """คืน (ค่าใน DB, ข้อความตามภาษาปัจจุบัน)"""
    return [(value, en if _LANG == "en" else th) for value, th, en in rows]


def _localize_repair_result(text: str) -> str:
    """แปลผลการซ่อมที่เป็นค่ามาตรฐาน — ค่าอื่น (ข้อความอิสระ/รหัส WO) คงไว้ตามเดิม"""
    for _, th, en in _REPAIR_RESULT_CHOICES:
        if text == th:
            return en if _LANG == "en" else th
    return text


_THAI_DIGITS = str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙")


def _num(n) -> str:
    """ลำดับหัวข้อ — ภาษาไทยใช้เลขไทย ภาษาอังกฤษใช้เลขอารบิก
    (ตัวเลขข้อมูลอย่างวันที่/เวลาใช้เลขอารบิกทั้งสองภาษาเพื่อให้อ่านง่าย)
    """
    s = str(n)
    return s.translate(_THAI_DIGITS) if _LANG == "th" else s


ROUND_TABLE_KEYS = [
    "round_no", "round_start", "round_finish",
    "round_result", "round_problem", "round_action",
]
# สัดส่วนความกว้างคอลัมน์ (สเกลตามความกว้างจริงตอนวาด)
# คอลัมน์แรกกว้างพอให้ "ครั้งที่" อยู่บรรทัดเดียวแม้สไตล์ตัวใหญ่ ไม่งั้นหัวตารางสูงเก้งก้าง
ROUND_TABLE_WIDTHS = [16.0, 27.0, 27.0, 33.0, 45.0, 42.0]


def _round_table_row(
    rnd: Dict[str, Any],
    failure_code,
    index: int,
    failure_codes: Optional[Dict[str, Any]] = None,
    failure_class_code: Any = None,
) -> List[str]:
    """แปลงรอบการเข้าแก้ไข 1 รอบเป็น 1 แถวของตารางประวัติ

    ข้อมูลชุดเดียวกับการ์ด "แก้ไขครั้งที่ N" บนหน้าเว็บ (RepairRoundCard)
    """
    problem_codes = _as_code_list(rnd.get("problem_type"))
    cause_codes = _as_code_list(rnd.get("cause"))

    problems = _join_labels(
        problem_codes,
        lambda code: problem_label(code, failure_codes, failure_class_code),
    )
    other = str(rnd.get("problem_type_other") or "").strip()
    if other:
        problems = ", ".join(p for p in (problems, other) if p)
    causes = _join_labels(
        cause_codes,
        lambda code: cause_label(code, failure_codes, failure_class_code),
    )
    problem_cell = " / ".join(p for p in (problems, causes) if p)

    round_actions = rnd.get("corrective_actions") or []
    round_action_codes = [a.get("code") for a in round_actions if isinstance(a, dict)]
    remedy_labels: List[str] = []
    for code in _merge_pdf_codes_by_index(rnd.get("repaired_equipment"), round_action_codes):
        # รอบย่อยไม่ได้เก็บ failure code ของตัวเอง — ใช้ของใบงานเป็นบริบท
        for desc in remedy_descriptions(
            failure_code,
            problem_codes,
            cause_codes,
            code,
            failure_codes,
            failure_class_code,
        ):
            remedy_labels.append(desc)
    actions = [
        str(a.get("text") or "").strip()
        for a in (rnd.get("corrective_actions") or [])
        if str(a.get("text") or "").strip()
    ]
    remark = str(rnd.get("repair_result_remark") or "").strip()
    action_cell = " / ".join(p for p in (", ".join(remedy_labels), " ".join(actions), remark) if p)

    result = rnd.get("repair_result")
    # ข้อมูลเก่าเก็บเวลาปิดรอบไว้ที่ saved_* — ใช้เป็นตัวสำรองของ finish_*
    return [
        _num(index),
        _fmt_round_datetime(rnd.get("start_repair_date"), rnd.get("start_repair_time")),
        _fmt_round_datetime(
            rnd.get("finish_date") or rnd.get("saved_date"),
            rnd.get("finish_time") or rnd.get("saved_time"),
        ),
        _localize_repair_result(_fmt_repair_result(result)) if str(result or "").strip() else "",
        problem_cell,
        action_cell,
    ]


def _round_photos(rnd: Dict[str, Any], key: str) -> List[dict]:
    """รวมรูปก่อน/หลังแก้ไขของทุก corrective action ในรอบนั้น"""
    out: List[dict] = []
    for a in rnd.get("corrective_actions") or []:
        for im in a.get(key) or []:
            if isinstance(im, dict) and im.get("url"):
                out.append(im)
    return out


def _action_has_data(action: Any) -> bool:
    if not isinstance(action, dict):
        return False
    return bool(
        str(action.get("code") or "").strip()
        or str(action.get("text") or "").strip()
        or action.get("beforeImages")
        or action.get("afterImages")
    )


def _merge_pdf_actions_by_index(*sources: Any) -> List[Dict[str, Any]]:
    """รวม action ตามลำดับชุด ไม่ใช้ code เป็นตัวแยกชุด"""
    lists = [source for source in sources if isinstance(source, list)]
    max_len = max((len(items) for items in lists), default=0)
    merged: List[Dict[str, Any]] = []

    for index in range(max_len):
        item: Dict[str, Any] = {
            "text": "",
            "beforeImages": [],
            "afterImages": [],
        }
        for actions in lists:
            if index >= len(actions) or not isinstance(actions[index], dict):
                continue
            source = actions[index]
            if source.get("code") and not item.get("code"):
                item["code"] = source.get("code")
            if str(source.get("text") or "").strip() and not str(item.get("text") or "").strip():
                item["text"] = source.get("text")
            for key in ("beforeImages", "afterImages"):
                images = source.get(key)
                if isinstance(images, list) and images and not item[key]:
                    item[key] = images

        if _action_has_data(item):
            merged.append(item)

    return merged


def _pdf_corrective_actions(doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    """คืน corrective action ทุกชุดที่มีข้อมูลสำหรับส่วนรายละเอียดของ PDF"""
    nested_job = doc.get("job") if isinstance(doc.get("job"), dict) else {}
    current_actions = doc.get("corrective_actions") or nested_job.get("corrective_actions")
    history = doc.get("repair_history") or nested_job.get("repair_history") or []
    history_action_sets = [
        round_data.get("corrective_actions")
        for round_data in history
        if isinstance(round_data, dict) and isinstance(round_data.get("corrective_actions"), list)
    ]
    history_actions = max(
        history_action_sets,
        key=lambda actions: sum(1 for action in actions if _action_has_data(action)),
        default=[],
    )
    return _merge_pdf_actions_by_index(current_actions, history_actions)


def _merge_pdf_codes_by_index(*sources: Any) -> List[str]:
    lists = [_as_code_list(source) for source in sources]
    max_len = max((len(items) for items in lists), default=0)
    return [
        next((items[index] for items in lists if index < len(items) and items[index]), "")
        for index in range(max_len)
    ]


def _pdf_repaired_equipment(doc: Dict[str, Any]) -> List[str]:
    """คืน correction ตามจำนวนชุดข้อมูล โดยไม่ตัด code ที่ซ้ำกัน"""
    nested_job = doc.get("job") if isinstance(doc.get("job"), dict) else {}
    current_codes = doc.get("repaired_equipment") or nested_job.get("repaired_equipment")
    history = doc.get("repair_history") or nested_job.get("repair_history") or []
    history_rounds = [
        round_data
        for round_data in history
        if isinstance(round_data, dict)
    ]
    history_round = max(
        history_rounds,
        key=lambda round_data: len(round_data.get("corrective_actions") or []),
        default={},
    )
    actions = _pdf_corrective_actions(doc)
    action_codes = [action.get("code") for action in actions if isinstance(action, dict)]
    return _merge_pdf_codes_by_index(
        current_codes,
        history_round.get("repaired_equipment"),
        action_codes,
    )


def _pdf_codes_for_action_context(doc: Dict[str, Any], key: str) -> List[str]:
    """Return problem/cause codes aligned to the action order when available."""
    nested_job = doc.get("job") if isinstance(doc.get("job"), dict) else {}
    current = doc.get(key) or nested_job.get(key)
    history = doc.get("repair_history") or nested_job.get("repair_history") or []
    history_rounds = [round_data for round_data in history if isinstance(round_data, dict)]
    history_round = max(
        history_rounds,
        key=lambda round_data: len(round_data.get("corrective_actions") or []),
        default={},
    )
    return _merge_pdf_codes_by_index(current, history_round.get(key))


def _repair_history_parts(
    doc: Dict[str, Any],
    failure_codes: Optional[Dict[str, Any]] = None,
    failure_class_code: Any = None,
) -> List[Dict[str, Any]]:
    """แปลง repair_history เป็น parts ของหมวดการดำเนินการแก้ไข

    รอบทั้งหมดรวมเป็นตารางเดียว (อ่านเทียบกันง่ายกว่าแยกเป็นบล็อก)
    รูปก่อน/หลังของแต่ละรอบวาดต่อท้ายตาราง รอบที่ไม่มีข้อมูลเลยจะถูกข้าม
    """
    parts: List[Dict[str, Any]] = []
    history = doc.get("repair_history") or []
    if not isinstance(history, list):
        return parts

    failure_code = doc.get("faulty_equipment")
    rows: List[List[str]] = []
    photo_parts: List[Dict[str, Any]] = []

    for i, rnd in enumerate(history, 1):
        if not isinstance(rnd, dict):
            continue
        row = _round_table_row(
            rnd,
            failure_code,
            i,
            failure_codes,
            failure_class_code,
        )
        before = _round_photos(rnd, "beforeImages")
        after = _round_photos(rnd, "afterImages")
        # ครั้งที่ (คอลัมน์แรก) มีค่าเสมอ จึงไม่นับเป็นข้อมูล
        if not any(c for c in row[1:]) and not before and not after:
            continue

        rows.append(row)
        for photos, title in ((before, _t("round_before")), (after, _t("round_after"))):
            if photos:
                photo_parts.append({
                    "kind": "photo",
                    "photos": photos[:6],
                    "title": f"{title} ({_t('round_label', n=_num(i))})",
                    "cols": 3,
                    "img_h": 38,
                    "draw_outer": True,
                })

    if not rows:
        return parts

    parts.append({
        "kind": "table",
        "label": _t("history"),
        "headers": [_t(k) for k in ROUND_TABLE_KEYS],
        "widths": ROUND_TABLE_WIDTHS,
        "rows": rows,
    })
    parts.extend(photo_parts)
    return parts


def _fmt_date_time(date_val, time_val) -> str:
    """วันที่ + เวลา HH:MM (ภาษาไทยต่อท้ายด้วย "น.")"""
    d = _fmt_date_full(date_val)
    t = str(time_val).strip() if time_val else ""
    if t and d and d != "-":
        return f"{d} {t}{_t('time_suffix')}"
    return d


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
                        # กินอย่างน้อย 1 ตัวอักษรเสมอ — ถ้า metric ของฟอนต์เพี้ยน
                        # (เช่น สระ/วรรณยุกต์ไทยกว้างเกินช่อง) k จะค้างที่ 1 แล้ววนไม่รู้จบ
                        take = max(k - 1, 1)
                        lines.append(current_indent + buf[:take])
                        first_line = False
                        buf = buf[take:]
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

    # ลายเซ็นจากฟอร์ม Closed ถูกเก็บเป็น data URL ไม่ใช่ path ของไฟล์
    if str(url_path).startswith("data:image/"):
        try:
            header, encoded = str(url_path).split(",", 1)
            if ";base64" not in header:
                return None, None
            return BytesIO(base64.b64decode(encoded)), "PNG" if "png" in header.lower() else "JPEG"
        except Exception:
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

        # ลดขนาดรูปก่อนฝังลง PDF — แสดงจริงไม่ใหญ่ ฝังรูป >1400px จึงเปลือง file size
        img.thumbnail((1400, 1400))

        buf = BytesIO()
        img.save(buf, format="JPEG", quality=82, optimize=True)
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


# -------------------- Attachments (รูป / ไฟล์แนบ) --------------------
# ฟอร์ม CM แนบได้ทั้งรูปและไฟล์ (pdf/csv) เก็บปนกันใน group เดียว
# เอกสารจึงต้องแยกเอง: รูปวาดเป็น grid ส่วนไฟล์อื่นวาดเป็นรูปไม่ได้ ทำเป็นลิงก์ให้กดเปิดแทน
_IMAGE_EXT_RE = re.compile(r"\.(jpe?g|png|webp|gif|heic|heif)(\?|#|$)", re.I)


def _attachment_url(item: Any) -> str:
    if isinstance(item, dict):
        return str(item.get("url") or item.get("path") or "").strip()
    return str(item or "").strip()


def _attachment_name(item: Any) -> str:
    if isinstance(item, dict):
        name = str(item.get("filename") or item.get("name") or "").strip()
        if name:
            return name
    url = _attachment_url(item)
    return url.split("/")[-1].split("?")[0] or "file"


def _is_image_attachment(item: Any) -> bool:
    """ไฟล์แนบนี้เป็นรูปไหม — ดู mime ก่อน ไม่มีค่อยดูนามสกุล (ตรรกะเดียวกับ isImageAttachment ฝั่งเว็บ)"""
    if isinstance(item, dict):
        mime = str(item.get("mime") or item.get("type") or "").strip().lower()
        if mime:
            return mime.startswith("image/")
    url = _attachment_url(item)
    if url.startswith("data:image/"):
        return True
    return bool(_IMAGE_EXT_RE.search(url) or _IMAGE_EXT_RE.search(_attachment_name(item)))


def _split_attachments(items: Any) -> Tuple[List[dict], List[dict]]:
    """แยกไฟล์แนบเป็น (รูป, ไฟล์อื่น) — รายการที่ไม่มี url ถูกข้าม"""
    images: List[dict] = []
    files: List[dict] = []
    for item in items if isinstance(items, list) else []:
        url = _attachment_url(item)
        if not url:
            continue
        entry = dict(item) if isinstance(item, dict) else {"url": url}
        (images if _is_image_attachment(item) else files).append(entry)
    return images, files


def _absolute_file_url(url_path: str) -> str:
    """URL เต็มของไฟล์แนบ — ลิงก์ใน PDF ต้องเป็น absolute ไม่งั้นกดแล้วเปิดไม่ได้
    APP_BASE_URL ถูกตั้งจาก request ตอน gen PDF (ดู pdf_routes1) จึงเป็น origin ที่ผู้ใช้เปิดได้จริง
    """
    s = str(url_path or "").strip()
    if not s or s.startswith("data:"):
        return ""
    if s.startswith("http://") or s.startswith("https://"):
        return s
    base = (os.getenv("APP_BASE_URL") or os.getenv("PHOTOS_BASE_URL") or "").rstrip("/")
    return f"{base}/{s.lstrip('/')}" if base else ""


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
    title_th: str = "รายงานบันทึกปัญหา (CM)",
    title_en: str = "CORRECTIVE MAINTENANCE REPORT (CM)",
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
def _compute_info_row_heights(
    pdf: FPDF,
    base_font: str,
    w: float,
    data: List[Tuple[str, str]],
    cols: int = 2,
    label_w: Optional[float] = None,
    row_h: Optional[float] = None,
) -> List[float]:
    """คำนวณความสูงจริงของแต่ละแถวใน info block — wrap value ถ้ายาวเกินช่อง"""
    label_w = INFO_LABEL_W if label_w is None else label_w
    row_h = INFO_ROW_H if row_h is None else row_h
    total_rows = math.ceil(len(data) / cols) if data else 0
    col_w = w / cols
    line_h_value = TABLE_LINE_H
    value_w = col_w - label_w - 2 * PADDING_X

    row_heights: List[float] = []
    for r in range(total_rows):
        max_value_h = line_h_value
        max_label_h = LINE_H
        for c in range(cols):
            i = r * cols + c
            if i >= len(data):
                continue
            label, value = data[i]

            pdf.set_font(base_font, "B", FONT_MAIN)
            label_lines, _ = _split_lines(
                pdf, label_w - 2 * PADDING_X, str(label or ""), LINE_H,
            )
            max_label_h = max(max_label_h, len(label_lines) * LINE_H)

            pdf.set_font(base_font, "", FONT_MAIN)
            val_str = "-" if value in (None, "", "-") else str(value)
            wrapped, _ = _split_lines(pdf, value_w, val_str, line_h_value)
            max_value_h = max(max_value_h, len(wrapped) * line_h_value)
        row_heights.append(max(row_h, max_label_h + 2.5, max_value_h + 2.5))
    return row_heights


def _draw_info_block(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    data: List[Tuple[str, str]],
    cols: int = 2,
    label_w: Optional[float] = None,
    row_h: Optional[float] = None,
    draw_outer: bool = True,
) -> float:
    """วาด block ข้อมูลแบบ label | value มีกรอบและเส้นแบ่ง
    cols=1 → ข้อมูลเต็มความกว้างต่อแถว
    cols=2 → แบ่งเป็น 2 คอลัมน์ข้างกัน
    draw_outer → วาดกรอบรอบนอก (ปิดได้เมื่ออยู่ภายใน group box)
    แถวที่ value ยาวจะ wrap หลายบรรทัดและขยายความสูงเฉพาะแถวนั้น
    """
    label_w = INFO_LABEL_W if label_w is None else label_w
    row_h = INFO_ROW_H if row_h is None else row_h
    total_rows = math.ceil(len(data) / cols) if data else 0
    col_w = w / cols
    line_h_value = TABLE_LINE_H
    value_w = col_w - label_w - 2 * PADDING_X

    row_heights = _compute_info_row_heights(pdf, base_font, w, data, cols, label_w, row_h)
    row_y_offsets = [0.0]
    for rh in row_heights:
        row_y_offsets.append(row_y_offsets[-1] + rh)
    box_h = row_y_offsets[-1]

    pdf.set_line_width(LINE_W_INNER)
    pdf.set_draw_color(*GRID_COLOR)
    if draw_outer:
        pdf.rect(x, y, w, box_h)

    # เส้นแนวตั้งกลาง (ถ้ามีหลายคอลัมน์)
    for c in range(1, cols):
        pdf.line(x + c * col_w, y, x + c * col_w, y + box_h)

    # เส้นแบ่งแถว
    for r in range(1, total_rows):
        rrh = y + row_y_offsets[r]
        pdf.line(x, rrh, x + w, rrh)

    # เส้นแบ่ง label|value แต่ละ cell
    for r in range(total_rows):
        top = y + row_y_offsets[r]
        bot = y + row_y_offsets[r + 1]
        for c in range(cols):
            pdf.line(x + c * col_w + label_w, top, x + c * col_w + label_w, bot)

    # เติมข้อความ
    for i, (label, value) in enumerate(data):
        r = i // cols
        c = i % cols
        rh = row_heights[r]
        cx = x + c * col_w
        cy = y + row_y_offsets[r]

        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.set_text_color(*LABEL_COLOR)
        label_str = str(label or "")
        label_lines, _ = _split_lines(
            pdf, label_w - 2 * PADDING_X, label_str, LINE_H,
        )
        label_h = len(label_lines) * LINE_H
        start_y = cy + max(PADDING_Y, (rh - label_h) / 2.0)
        pdf.set_xy(cx + PADDING_X, start_y)
        if len(label_lines) > 1:
            pdf.multi_cell(
                label_w - 2 * PADDING_X,
                LINE_H,
                label_str,
                border=0,
                align="L",
            )
        else:
            pdf.cell(label_w - 2 * PADDING_X, LINE_H, label_str, border=0, align="L")
        pdf.set_text_color(0, 0, 0)

        pdf.set_font(base_font, "", FONT_MAIN)
        val_str = "-" if value in (None, "", "-") else str(value)
        wrapped, _ = _split_lines(pdf, value_w, val_str, line_h_value)
        if len(wrapped) > 1:
            # wrap หลายบรรทัด — ใช้ multi_cell และจัดให้อยู่ตรงกลางแนวตั้ง
            text_h = len(wrapped) * line_h_value
            start_y = cy + max(PADDING_Y, (rh - text_h) / 2.0)
            pdf.set_xy(cx + label_w + PADDING_X, start_y)
            pdf.multi_cell(value_w, line_h_value, val_str, border=0, align="L")
        else:
            pdf.set_xy(cx + label_w + PADDING_X, cy + (rh - LINE_H) / 2.0)
            pdf.cell(value_w, LINE_H, val_str, border=0, align="L")

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
    label_h = LINE_H + 1.0
    text_str = "-" if text in (None, "", "-") else str(text)

    # คำนวณความสูงเนื้อหา
    _, raw_h = _split_lines(pdf, w - 2 * PADDING_X, text_str, LINE_H)
    content_h = max(min_h, raw_h + 2 * PADDING_Y)

    pdf.set_line_width(LINE_W_INNER)
    pdf.set_draw_color(*GRID_COLOR)

    # แถบ label
    pdf.set_fill_color(245, 245, 245)
    pdf.rect(x, y, w, label_h, style="FD")
    pdf.set_xy(x + PADDING_X, y + (label_h - LINE_H) / 2.0)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(w - 2 * PADDING_X, LINE_H, label, border=0, align="L")

    # กล่องเนื้อหา
    pdf.set_font(base_font, "", FONT_MAIN)
    _cell_text_in_box(
        pdf, x, y + label_h, w, content_h,
        text_str, align="L", lh=LINE_H, valign="top",
        draw_border=draw_outer,
    )

    return y + label_h + content_h


def _draw_section_bar(
    pdf: FPDF, base_font: str, x: float, y: float, w: float,
    number: str = "", title: str = "",
) -> float:
    """แถบหัวข้อหมวด — สีและตัวอักษรเปลี่ยนตามสไตล์ที่เลือก"""
    pdf.set_line_width(LINE_W_INNER)
    pdf.set_draw_color(*GRID_COLOR)
    pdf.set_fill_color(*SECTION_BAR_BG)
    pdf.rect(x, y, w, SECTION_BAR_H, style="FD")

    text = f"  {number}. {title}" if number else f"  {title}"
    pdf.set_xy(x + PADDING_X, y + (SECTION_BAR_H - LINE_H) / 2.0)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_text_color(*SECTION_BAR_FG)
    pdf.cell(w - 2 * PADDING_X, LINE_H, text, border=0, align="L")
    pdf.set_text_color(0, 0, 0)
    return y + SECTION_BAR_H


def _new_page_if_needed(pdf: FPDF, y: float, needed_h: float, pad: float = 4.0) -> float:
    """ขึ้นหน้าใหม่ถ้าที่เหลือไม่พอ — กันหมวดถูกตัดครึ่งคาหน้า"""
    if y + needed_h + pad > pdf.h - pdf.b_margin:
        pdf.add_page()
        return pdf.get_y() + 2
    return y


# -------------------- Choice row (ช่องติ๊กแบบฟอร์มกระดาษ) --------------------
def _checkbox_size() -> float:
    """ขนาดช่องติ๊กเทียบกับความสูงบรรทัด — สไตล์ตัวใหญ่ต้องได้ช่องใหญ่ตาม"""
    return LINE_H * 0.62


def _draw_checkbox(pdf: FPDF, x: float, y: float, checked: bool) -> None:
    """ช่องติ๊กสี่เหลี่ยม — วาดเองด้วยเส้น ไม่พึ่งอักขระ ☐/☑ ที่ฟอนต์ไทยอาจไม่มี"""
    s = _checkbox_size()
    # ช่องติ๊กใช้เส้นดำเสมอ ไม่ตามสีเส้นตารางที่อาจจางจนมองไม่เห็น
    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(LINE_W_INNER)
    pdf.rect(x, y, s, s)
    if checked:
        pdf.set_line_width(0.45)
        pdf.line(x + 0.6, y + 0.6, x + s - 0.6, y + s - 0.6)
        pdf.line(x + s - 0.6, y + 0.6, x + 0.6, y + s - 0.6)
        pdf.set_line_width(LINE_W_INNER)
    pdf.set_draw_color(*GRID_COLOR)


def _draw_choice_row(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    label: str,
    options: List[Tuple[str, str]],
    selected,
    label_w: Optional[float] = None,
    row_h: Optional[float] = None,
    draw_outer: bool = True,
) -> float:
    """แถว label | ตัวเลือกแบบติ๊ก

    options: [(value, ข้อความที่แสดง), ...]
    selected: ค่าที่เลือก (เทียบแบบไม่สนตัวพิมพ์)
    ค่าที่ไม่อยู่ในตัวเลือก (ข้อมูลเก่า) จะพิมพ์ต่อท้ายเป็น "อื่นๆ: ..." เพื่อไม่ให้ข้อมูลหาย
    """
    label_w = INFO_LABEL_W if label_w is None else label_w
    row_h = INFO_ROW_H if row_h is None else row_h
    sel = str(selected or "").strip().lower()
    known = {str(v).strip().lower() for v, _ in options}
    extra = str(selected or "").strip() if sel and sel not in known else ""

    pdf.set_line_width(LINE_W_INNER)
    pdf.set_draw_color(*GRID_COLOR)
    if draw_outer:
        pdf.rect(x, y, w, row_h)
    pdf.line(x + label_w, y, x + label_w, y + row_h)

    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_text_color(*LABEL_COLOR)
    pdf.set_xy(x + PADDING_X, y + (row_h - LINE_H) / 2.0)
    pdf.cell(label_w - 2 * PADDING_X, LINE_H, str(label or ""), border=0, align="L")
    pdf.set_text_color(0, 0, 0)

    pdf.set_font(base_font, "", FONT_MAIN)
    cx = x + label_w + PADDING_X
    cb = _checkbox_size()
    box_y = y + (row_h - cb) / 2.0
    text_y = y + (row_h - LINE_H) / 2.0
    for value, text in options:
        _draw_checkbox(pdf, cx, box_y, str(value).strip().lower() == sel)
        cx += cb + 1.2
        tw = pdf.get_string_width(text) + 4.0
        pdf.set_xy(cx, text_y)
        pdf.cell(tw, LINE_H, text, border=0, align="L")
        cx += tw
    if extra:
        _draw_checkbox(pdf, cx, box_y, True)
        cx += cb + 1.2
        pdf.set_xy(cx, text_y)
        pdf.cell(x + w - cx - PADDING_X, LINE_H, _t("other", v=extra), border=0, align="L")

    return y + row_h


# -------------------- Table (ตารางหัวคอลัมน์ + หลายแถว) --------------------
def _table_geometry(
    pdf: FPDF,
    base_font: str,
    w: float,
    headers: List[str],
    widths: List[float],
    rows: List[List[str]],
) -> Tuple[List[float], float, List[float]]:
    """คืน (ความกว้างจริงต่อคอลัมน์, ความสูงหัวตาราง, ความสูงต่อแถว)"""
    scale = w / sum(widths)
    col_ws = [cw * scale for cw in widths]

    pdf.set_font(base_font, "B", FONT_SMALL)
    head_lines = 1
    for text, cw in zip(headers, col_ws):
        wrapped, _ = _split_lines(pdf, cw - 2 * PADDING_X, str(text or ""), TABLE_LINE_H)
        head_lines = max(head_lines, len(wrapped))
    head_h = head_lines * TABLE_LINE_H + 2.0

    pdf.set_font(base_font, "", FONT_SMALL)
    row_hs: List[float] = []
    for row in rows:
        lines = 1
        for i, cell in enumerate(row):
            cw = col_ws[i] if i < len(col_ws) else col_ws[-1]
            wrapped, _ = _split_lines(pdf, cw - 2 * PADDING_X, str(cell or ""), TABLE_LINE_H)
            lines = max(lines, len(wrapped))
        row_hs.append(lines * TABLE_LINE_H + 2.0)
    return col_ws, head_h, row_hs


def _draw_table(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    label: str,
    headers: List[str],
    widths: List[float],
    rows: List[List[str]],
    draw_outer: bool = True,
) -> float:
    """ตารางพร้อมแถบหัวข้อด้านบน — ความสูงแต่ละแถวยืดตามเนื้อหาที่ตัดบรรทัด"""
    label_h = LINE_H + 1.0 if label else 0.0
    col_ws, head_h, row_hs = _table_geometry(pdf, base_font, w, headers, widths, rows)
    total_h = label_h + head_h + sum(row_hs)

    pdf.set_line_width(LINE_W_INNER)
    pdf.set_draw_color(*GRID_COLOR)

    if label:
        pdf.set_fill_color(245, 245, 245)
        pdf.rect(x, y, w, label_h, style="FD")
        pdf.set_xy(x + PADDING_X, y + (label_h - LINE_H) / 2.0)
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.cell(w - 2 * PADDING_X, LINE_H, label, border=0, align="L")

    top = y + label_h
    body_h = head_h + sum(row_hs)
    if draw_outer:
        pdf.rect(x, top, w, body_h)

    # แถวสลับสี — วาดก่อนเส้นและข้อความ ไม่งั้นพื้นจะทับ
    if TABLE_ZEBRA:
        cy = top + head_h
        for i, rh in enumerate(row_hs):
            if i % 2 == 1:
                pdf.set_fill_color(*TABLE_ZEBRA)
                pdf.rect(x, cy, w, rh, style="F")
            cy += rh

    # หัวตาราง
    pdf.set_fill_color(238, 238, 238)
    pdf.rect(x, top, w, head_h, style="FD")
    pdf.set_font(base_font, "B", FONT_SMALL)
    cx = x
    for text, cw in zip(headers, col_ws):
        _cell_text_in_box(
            pdf, cx, top, cw, head_h, str(text or ""),
            align="C", lh=TABLE_LINE_H, valign="middle", draw_border=False,
        )
        cx += cw

    # เส้นแนวตั้งตลอดความสูงตาราง — สไตล์อ่านง่ายใช้แถวสลับสีแทน จะได้ไม่รกตา
    if not TABLE_ZEBRA:
        cx = x
        for cw in col_ws[:-1]:
            cx += cw
            pdf.line(cx, top, cx, top + body_h)

    # เนื้อตาราง
    pdf.set_font(base_font, "", FONT_SMALL)
    cy = top + head_h
    for row, rh in zip(rows, row_hs):
        pdf.line(x, cy, x + w, cy)
        cx = x
        for i, cw in enumerate(col_ws):
            cell = str(row[i]) if i < len(row) else ""
            _cell_text_in_box(
                pdf, cx, cy, cw, rh, cell,
                align="C" if i == 0 else "L", lh=TABLE_LINE_H,
                valign="middle", draw_border=False,
            )
            cx += cw
        cy += rh

    return y + total_h


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
        row_h = float(part.get("row_h", INFO_ROW_H))
        # ใช้ความสูงแบบ dynamic — แถวที่ value ยาวจะถูก wrap และสูงขึ้น
        base_font = getattr(pdf, "_base_font_name", "Arial")
        row_heights = _compute_info_row_heights(pdf, base_font, w, data, cols, 38, row_h)
        return sum(row_heights)
    if kind == "text":
        label_h = LINE_H + 1.0
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
        label_h = LINE_H + 1.0 if part.get("title") else 0
        rows = math.ceil(len(photos) / cols)
        return label_h + rows * img_h + (rows + 1) * gap
    if kind == "links":
        return _links_block_height(part.get("items") or [], str(part.get("label") or ""))
    if kind == "choice":
        return float(part.get("row_h", INFO_ROW_H))
    if kind == "table":
        rows = part.get("rows") or []
        if not rows:
            return 0
        base_font = getattr(pdf, "_base_font_name", "Arial")
        label_h = LINE_H + 1.0 if part.get("label") else 0.0
        _, head_h, row_hs = _table_geometry(
            pdf, base_font, w,
            part.get("headers") or [], part.get("widths") or [], rows,
        )
        return label_h + head_h + sum(row_hs)
    return 0


def _draw_section_group(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
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
    pdf.set_draw_color(*GRID_COLOR)

    # กรอบใหญ่ครอบทั้งหมด
    pdf.rect(x, y, w, total_h)

    # Section bar (หัวข้อหมวด)
    _draw_section_bar(pdf, base_font, x, y, w, title=title)

    cy = y + SECTION_BAR_H

    for p in parts:
        kind = p.get("kind")
        # เส้นคั่นระหว่าง part — แต่ละ part วาดเส้นแบ่งเฉพาะแถวของตัวเอง
        # ถ้าไม่คั่นตรงนี้ แถวสุดท้ายของ part ก่อนหน้าจะดูเชื่อมกับแถวแรกของ part ถัดไป
        if cy > y + SECTION_BAR_H:
            if kind == "photo" and not (p.get("photos") or []):
                continue
            if kind == "links" and not (p.get("items") or []):
                continue
            if kind == "table" and not (p.get("rows") or []):
                continue
            pdf.set_draw_color(*GRID_COLOR)
            pdf.line(x, cy, x + w, cy)

        if kind == "info":
            cy = _draw_info_block(
                pdf, base_font, x, cy, w,
                p.get("data") or [],
                cols=int(p.get("cols", 2)),
                row_h=float(p.get("row_h", INFO_ROW_H)),
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
                draw_outer=bool(p.get("draw_outer", False)),
            )
        elif kind == "links":
            items = p.get("items") or []
            if not items:
                continue
            cy = _draw_links_block(
                pdf, base_font, x, cy, w,
                str(p.get("label") or ""),
                items,
                draw_outer=False,
            )
        elif kind == "choice":
            cy = _draw_choice_row(
                pdf, base_font, x, cy, w,
                str(p.get("label") or ""),
                p.get("options") or [],
                p.get("selected"),
                row_h=float(p.get("row_h", INFO_ROW_H)),
                draw_outer=False,
            )
        elif kind == "table":
            rows = p.get("rows") or []
            if not rows:
                continue
            cy = _draw_table(
                pdf, base_font, x, cy, w,
                str(p.get("label") or ""),
                p.get("headers") or [], p.get("widths") or [], rows,
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
    draw_outer: bool = False,
) -> float:
    """วาด grid รูปภาพในกรอบที่มี label (optional)
    draw_outer → วาดกรอบรอบ grid (ปิดได้เมื่ออยู่ภายใน group box)
    """
    if not photos:
        return y

    label_h = LINE_H + 1.0 if title else 0

    img_w = (w - (cols + 1) * gap) / cols
    rows = math.ceil(len(photos) / cols)
    grid_h = rows * img_h + (rows + 1) * gap

    total_h = label_h + grid_h

    pdf.set_line_width(LINE_W_INNER)

    # Label bar
    if title:
        pdf.set_fill_color(245, 245, 245)
        pdf.rect(x, y, w, label_h, style="FD")
        pdf.set_xy(x + PADDING_X, y + (label_h - LINE_H) / 2.0)
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.cell(w - 2 * PADDING_X, LINE_H, title, border=0, align="L")

    # กรอบ grid
    if draw_outer:
        # กรอบเดียวครอบทั้งช่องแสดงรูป รวมแถบหัวข้อก่อน/หลังแก้ไข
        pdf.rect(x, y, w, total_h)

    # วาดรูป — แถวที่ไม่เต็มคอลัมน์จะจัดกึ่งกลาง ไม่ให้รูปกองซ้ายแล้วเหลือที่ว่างข้างขวา
    for i, photo in enumerate(photos):
        r = i // cols
        c = i % cols
        in_row = min(cols, len(photos) - r * cols)
        row_w = in_row * img_w + (in_row - 1) * gap
        cx = x + (w - row_w) / 2.0 + c * (img_w + gap)
        cy = y + label_h + gap + r * (img_h + gap)

        url = (photo or {}).get("url", "")
        img_buf, _ = _load_image_with_cache(url)

        if img_buf is not None:
            try:
                # คงสัดส่วนรูปแล้วจัดกึ่งกลางช่อง — ยัดเต็มช่องทำให้รูปยืดผิดส่วน
                draw_w, draw_h = img_w, img_h
                if Image is not None:
                    try:
                        img_buf.seek(0)
                        iw, ih = Image.open(img_buf).size
                        if iw and ih:
                            scale = min(img_w / iw, img_h / ih)
                            draw_w, draw_h = iw * scale, ih * scale
                    except Exception:
                        pass
                    finally:
                        img_buf.seek(0)
                pdf.image(
                    img_buf,
                    x=cx + (img_w - draw_w) / 2.0,
                    y=cy + (img_h - draw_h) / 2.0,
                    w=draw_w, h=draw_h, type="JPEG",
                )
            except Exception as e:
                _log(f"[IMG] place error: {e}")
                _draw_placeholder(pdf, base_font, cx, cy, img_w, img_h)
        else:
            _draw_placeholder(pdf, base_font, cx, cy, img_w, img_h)

    return y + total_h


# -------------------- Attachment links (ไฟล์แนบที่วาดเป็นรูปไม่ได้) --------------------
LINK_COLOR = (0, 0, 238)


def _links_block_height(items: List[dict], label: str = "") -> float:
    if not items:
        return 0.0
    label_h = LINE_H + 1.0 if label else 0.0
    return label_h + len(items) * LINE_H + 2 * PADDING_Y


def _draw_links_block(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    label: str,
    items: List[dict],
    draw_outer: bool = True,
) -> float:
    """รายชื่อไฟล์แนบ — กดที่ชื่อไฟล์แล้วเปิดไฟล์จริง (pdf/csv วาดลงเอกสารไม่ได้)"""
    if not items:
        return y

    label_h = LINE_H + 1.0 if label else 0.0
    content_h = len(items) * LINE_H + 2 * PADDING_Y

    pdf.set_line_width(LINE_W_INNER)
    pdf.set_draw_color(*GRID_COLOR)

    if label:
        pdf.set_fill_color(245, 245, 245)
        pdf.rect(x, y, w, label_h, style="FD")
        pdf.set_xy(x + PADDING_X, y + (label_h - LINE_H) / 2.0)
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.cell(w - 2 * PADDING_X, LINE_H, label, border=0, align="L")

    if draw_outer:
        pdf.rect(x, y + label_h, w, content_h)

    cy = y + label_h + PADDING_Y
    for i, item in enumerate(items, 1):
        text = f"{i}. {_attachment_name(item)}"
        link = _absolute_file_url(_attachment_url(item))
        pdf.set_xy(x + PADDING_X, cy)
        if link:
            # น้ำเงินขีดเส้นใต้ให้เห็นว่ากดได้ — ไฟล์ที่หา base url ไม่ได้แสดงเป็นข้อความเฉย ๆ
            pdf.set_font(base_font, "U", FONT_MAIN)
            pdf.set_text_color(*LINK_COLOR)
            pdf.cell(w - 2 * PADDING_X, LINE_H, text, border=0, align="L", link=link)
            pdf.set_text_color(0, 0, 0)
        else:
            pdf.set_font(base_font, "", FONT_MAIN)
            pdf.cell(w - 2 * PADDING_X, LINE_H, text, border=0, align="L")
        cy += LINE_H

    pdf.set_font(base_font, "", FONT_MAIN)
    return y + label_h + content_h


def _draw_placeholder(pdf: FPDF, base_font: str, x: float, y: float, w: float, h: float):
    pdf.set_font(base_font, "", FONT_SMALL)
    pdf.set_text_color(150, 150, 150)
    pdf.set_xy(x, y + (h - LINE_H) / 2.0)
    pdf.cell(w, LINE_H, "-", border=0, align="C")
    pdf.set_text_color(0, 0, 0)


# -------------------- People block (ผู้เกี่ยวข้อง) --------------------
def _draw_people_block(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    people: List[Tuple[str, str, str]],
) -> float:
    """ตารางผู้เกี่ยวข้องท้ายเอกสาร — (บทบาท, ชื่อ, วันที่)

    ใบงานปิดในระบบอยู่แล้ว จึงไม่มีช่องเซ็นชื่อ ใช้ชื่อผู้ทำรายการจริงแทน
    """
    if not people:
        return y

    col_w = w / len(people)
    row_h_header = LINE_H + 1.0
    row_h_name = LINE_H + 1.6
    row_h_date = LINE_H + 1.0
    total_h = row_h_header + row_h_name + row_h_date

    pdf.set_line_width(LINE_W_INNER)
    pdf.set_draw_color(*GRID_COLOR)

    # หัวคอลัมน์ — เทาชุดเดียวกับหัวตารางอื่น (เหลืองสงวนไว้ให้ชื่อเอกสารอย่างเดียว)
    pdf.set_fill_color(238, 238, 238)
    pdf.set_font(base_font, "B", FONT_MAIN)
    for i, (role, _, _) in enumerate(people):
        cx = x + i * col_w
        pdf.rect(cx, y, col_w, row_h_header, style="FD")
        pdf.set_xy(cx, y + (row_h_header - LINE_H) / 2.0)
        pdf.cell(col_w, LINE_H, role, border=0, align="C")

    # แถวชื่อ — ตัวหนา เพราะเป็นข้อมูลหลักของบล็อกนี้
    cy = y + row_h_header
    pdf.set_font(base_font, "B", FONT_MAIN)
    for i, (_, name, _) in enumerate(people):
        cx = x + i * col_w
        pdf.rect(cx, cy, col_w, row_h_name)
        _cell_text_in_box(
            pdf, cx, cy, col_w, row_h_name, (name or "").strip() or "-",
            align="C", lh=LINE_H, valign="middle", draw_border=False,
        )

    # แถววันที่
    cy += row_h_name
    pdf.set_font(base_font, "", FONT_SMALL)
    pdf.set_text_color(*LABEL_COLOR)
    for i, (_, _, date_text) in enumerate(people):
        cx = x + i * col_w
        pdf.rect(cx, cy, col_w, row_h_date)
        d = (date_text or "").strip()
        pdf.set_xy(cx, cy + (row_h_date - LINE_H) / 2.0)
        pdf.cell(col_w, LINE_H, _t("date_prefix", d=d) if d else "-", border=0, align="C")
    pdf.set_text_color(0, 0, 0)

    return y + total_h


# -------------------- Corrective action block --------------------
def _draw_action_details_group(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    fields: List[Tuple[str, str, float]],
) -> float:
    """Draw the action fields as one box, with context fields in one row."""
    label_h = LINE_H + 1.0
    context_fields = fields[:-1]
    detail_fields = fields[-1:]

    pdf.set_font(base_font, "", FONT_MAIN)
    context_cols = []
    context_h = 0.0
    if context_fields:
        col_w = w / len(context_fields)
        for label, text, min_h in context_fields:
            text_str = "-" if text in (None, "", "-") else str(text)
            _, raw_h = _split_lines(pdf, col_w - 2 * PADDING_X, text_str, LINE_H)
            content_h = max(min_h, raw_h + 2 * PADDING_Y)
            context_cols.append((label, text_str, content_h))
        context_h = label_h + max(content_h for _, _, content_h in context_cols)

    detail_rows = []
    total_h = 0.0
    for label, text, min_h in detail_fields:
        text_str = "-" if text in (None, "", "-") else str(text)
        _, raw_h = _split_lines(pdf, w - 2 * PADDING_X, text_str, LINE_H)
        content_h = max(min_h, raw_h + 2 * PADDING_Y)
        row_h = label_h + content_h
        detail_rows.append((label, text_str, content_h, row_h))
        total_h += row_h
    total_h += context_h

    pdf.set_line_width(LINE_W_INNER)
    pdf.set_draw_color(*GRID_COLOR)

    cy = y
    if context_cols:
        col_w = w / len(context_cols)
        context_content_h = context_h - label_h
        for i, (label, text_str, _) in enumerate(context_cols):
            cx = x + i * col_w
            pdf.set_fill_color(245, 245, 245)
            pdf.rect(cx, cy, col_w, label_h, style="F")
            pdf.set_xy(cx + PADDING_X, cy + (label_h - LINE_H) / 2.0)
            pdf.set_font(base_font, "B", FONT_MAIN)
            pdf.cell(col_w - 2 * PADDING_X, LINE_H, label, border=0, align="L")
            pdf.line(cx, cy + label_h, cx + col_w, cy + label_h)
            _cell_text_in_box(
                pdf,
                cx,
                cy + label_h,
                col_w,
                context_content_h,
                text_str,
                align="L",
                lh=LINE_H,
                valign="top",
                draw_border=False,
            )
            if i:
                pdf.line(cx, cy, cx, cy + context_h)
        cy += context_h

    for label, text_str, content_h, row_h in detail_rows:
        pdf.set_fill_color(245, 245, 245)
        pdf.rect(x, cy, w, label_h, style="F")
        pdf.set_xy(x + PADDING_X, cy + (label_h - LINE_H) / 2.0)
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.cell(w - 2 * PADDING_X, LINE_H, label, border=0, align="L")
        pdf.line(x, cy + label_h, x + w, cy + label_h)
        _cell_text_in_box(
            pdf,
            x,
            cy + label_h,
            w,
            content_h,
            text_str,
            align="L",
            lh=LINE_H,
            valign="top",
            draw_border=False,
        )
        cy += row_h

    pdf.rect(x, y, w, total_h)
    return y + total_h


def _measure_action_details_group_height(
    pdf: FPDF,
    base_font: str,
    w: float,
    fields: List[Tuple[str, str, float]],
) -> float:
    """Measure the combined action-details box before deciding page placement."""
    label_h = LINE_H + 1.0
    pdf.set_font(base_font, "", FONT_MAIN)
    context_fields = fields[:-1]
    detail_fields = fields[-1:]
    total_h = 0.0

    if context_fields:
        col_w = w / len(context_fields)
        context_content_h = 0.0
        for _, text, min_h in context_fields:
            text_str = "-" if text in (None, "", "-") else str(text)
            _, raw_h = _split_lines(pdf, col_w - 2 * PADDING_X, text_str, LINE_H)
            context_content_h = max(context_content_h, max(min_h, raw_h + 2 * PADDING_Y))
        total_h += label_h + context_content_h

    for _, text, min_h in detail_fields:
        text_str = "-" if text in (None, "", "-") else str(text)
        _, raw_h = _split_lines(pdf, w - 2 * PADDING_X, text_str, LINE_H)
        total_h += label_h + max(min_h, raw_h + 2 * PADDING_Y)
    return total_h


def _measure_action_block_height(
    pdf: FPDF,
    base_font: str,
    w: float,
    fields: List[Tuple[str, str, float]],
    action: dict,
    include_photos: bool = True,
) -> float:
    """Measure an action details block, optionally including both photo grids."""
    height = SECTION_BAR_H + _measure_action_details_group_height(pdf, base_font, w, fields) + 2
    if not include_photos:
        return height + 3

    height += _measure_action_photos_height(action)
    return height + 3


def _measure_action_photos_height(action: dict) -> float:
    """Measure the two-column before/after photo area for one action."""
    photo_heights = []
    for photos in (action.get("beforeImages") or [], action.get("afterImages") or []):
        if not photos:
            continue
        rows = math.ceil(len(photos) / 2)
        photo_heights.append((LINE_H + 1.0) + rows * 38 + (rows + 1) * 2)
    if photo_heights:
        return max(photo_heights)
    return 0.0


def _draw_action_block(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    idx: int,
    action: dict,
    correction_text: str = "",
    include_photos: bool = True,
) -> float:
    """วาดรายละเอียดการดำเนินการแก้ไข 1 ชุด (ข้อความ + รูปก่อน/หลัง)"""
    # แถบหัวข้อย่อยมีพื้นและกรอบ ให้เป็นส่วนหนึ่งของฟอร์ม ไม่ใช่ข้อความลอย
    # Action numbering is always Arabic numerals, including Thai-language PDFs.
    y = _draw_section_bar(pdf, base_font, x, y, w, "", _t("action_no", n=str(idx)))

    action_text = action.get("text", "") or "-"
    fields: List[Tuple[str, str, float]] = []
    if (correction_text or "").strip():
        fields.append((_t("correction"), correction_text, 8))
    fields.append((_t("action_details"), action_text, 10))

    y = _draw_action_details_group(pdf, base_font, x, y, w, fields)
    y += 2

    if include_photos:
        y = _draw_action_photos(pdf, base_font, x, y, w, action)

    return y + 3


def _draw_action_photos(
    pdf: FPDF,
    base_font: str,
    x: float,
    y: float,
    w: float,
    action: dict,
) -> float:
    """Draw the before/after photo area for one action without repeating its text header."""
    before_imgs = action.get("beforeImages") or []
    after_imgs = action.get("afterImages") or []
    if not before_imgs and not after_imgs:
        return y

    col_w = (w - 4) / 2
    start_y = y
    max_y = y

    if before_imgs:
        max_y = max(max_y, _draw_photo_grid(
            pdf, base_font, x, start_y, col_w, before_imgs,
            title=_t("photos_before"), cols=2, img_h=38, draw_outer=True,
        ))

    if after_imgs:
        max_y = max(max_y, _draw_photo_grid(
            pdf, base_font, x + col_w + 4, start_y, col_w, after_imgs,
            title=_t("photos_after"), cols=2, img_h=38, draw_outer=True,
        ))

    return max_y


# -------------------- Report PDF class --------------------
class ReportPDF(HTML2PDF):
    def __init__(self, *args, issue_id="-", doc_name="-", **kwargs):
        super().__init__(*args, **kwargs)
        self.issue_id = issue_id
        self._doc_name = doc_name
        self._base_font_name = "Arial"
        # อ่านค่าตอน __init__ — ภาษาถูกตั้งไว้แล้วก่อนสร้าง PDF
        self._label_page = _t("page")
        self._label_issue_id = _t("doc_no")
        self._label_doc_name = _t("doc_name")
        self._addr_line1 = _t("org1")
        self._addr_line2 = _t("org2")
        self._addr_line3 = _t("org3")

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
def make_cm_report_pdf_bytes(
    doc: dict, style: str = DEFAULT_STYLE, lang: str = DEFAULT_LANG,
) -> bytes:
    """สร้าง PDF ใบแจ้งซ่อมบำรุง

    style: "form" = ฟอร์มราชการ / "readable" = เน้นอ่านง่าย (ดู _STYLES)
    lang:  "th" / "en" — ตามภาษาที่ผู้ใช้เลือกบนหน้าเว็บ
    """
    _apply_style(style)
    _apply_lang(lang)
    nested_job = doc.get("job") if isinstance(doc.get("job"), dict) else {}
    if nested_job:
        # รองรับรายงานรุ่นเก่าที่เก็บข้อมูลไว้ใต้ job โดยให้ค่า flat รุ่นใหม่มี precedence
        doc = dict(doc)
        for key, value in nested_job.items():
            if key not in doc or doc.get(key) in (None, ""):
                doc[key] = value
    failure_codes = doc.get("_maximo_failure_codes")
    failure_class_code = doc.get("_maximo_failure_class") or doc.get("faulty_equipment")
    corrective_actions = _pdf_corrective_actions(doc)
    status_bucket = _cm_status_bucket(doc)
    is_repair_form = status_bucket == "in_progress"
    issue_id = str(doc.get("issue_id", "-"))
    doc_name = str(doc.get("doc_name", "-"))
    reported_by = _display_value(doc.get("reported_by"))
    sr_no = _display_value(doc.get("maximo_ticket_id") or doc.get("sr_no"))
    wo_no = _display_value(doc.get("maximo_wonum") or doc.get("wo") or doc.get("wo_no"))
    raw_status = str(doc.get("status") or "").strip().lower()
    raw_stage = str(doc.get("stage") or "").strip().lower()
    wo_stage = bool(wo_no != "-") or raw_status in {"wait for schedule", "in progress", "closed", "complete"}
    if raw_status == "wait for approve" and raw_stage != "cs_approval":
        wo_stage = True
    if raw_status in {"cancelled", "canceled"} and raw_stage not in {"", "cs_approval"}:
        wo_stage = True
    # เลข SR เป็นเลขต้นเรื่อง จึงต้องแสดงทุก status แม้ใบงานจะเปลี่ยนเป็น WO แล้ว
    # ถ้า Maximo ยังไม่ส่ง ticketid ให้ใช้เลขลำดับเดียวกับ issue_id เหมือนในฟอร์ม CM
    if sr_no == "-":
        sr_no = _derived_cm_number(issue_id, "SR")
    if wo_no == "-" and wo_stage:
        wo_no = _derived_cm_number(issue_id, "WO")

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
    section1_parts: List[Dict[str, Any]] = [
        {
            "kind": "info",
            "data": [
                (_t("found_date_closed" if status_bucket == "closed" else "found_date"), _fmt_date_time(doc.get("found_date"), doc.get("found_time"))),
                (_t("reported_by"), reported_by),
            ],
            "cols": 2,
        },
        {
            "kind": "info",
            "data": [
                (_t("sr_no"), sr_no),
                (_t("wo_no"), wo_no),
            ],
            "cols": 2,
        },
        {
            "kind": "info",
            "data": [
                (_t("location"), _display_value(doc.get("location"))),
            ],
            "cols": 1,
        },
        {
            "kind": "choice",
            "label": _t("wo_status"),
            "options": _choices(_STATUS_CHOICES),
            "selected": doc.get("status"),
        },
    ]

    # ฟอร์ม Open มีข้อมูลการวางแผน/ช่างรับผิดชอบ ซึ่งไม่ควรหายจาก PDF
    plan_values = [
        (_t("planned_at"), _fmt_date_time(doc.get("planned_date"), doc.get("planned_time"))),
        (_t("plan_round"), _display_value(len(doc.get("plan_history") or []) + 1)),
        (_t("sched_start"), _display_value(doc.get("sched_start"))),
        (_t("sched_finish"), _display_value(doc.get("sched_finish"))),
        (_t("technician"), _display_value(doc.get("assignees"))),
        (_t("waiting_on"), _localize_repair_result(_fmt_repair_result(doc.get("repair_result"))) if doc.get("repair_result") else "-"),
        (_t("waiting_remark"), _display_value(doc.get("repair_result_remark"))),
    ]
    if status_bucket == "open" and any(str(v).strip() not in {"", "-"} for _, v in plan_values):
        section1_parts.append({"kind": "info", "data": plan_values, "cols": 2})

    y = _draw_section_group(
        pdf, base_font, x0, y, page_w, _t("sec1"),
        parts=section1_parts,
    )
    y += 3

    # ===== ส่วนที่ 2: รายละเอียดปัญหา =====
    section2_parts: List[Dict[str, Any]] = [
        {
            "kind": "info",
            "data": [(
                _t("faulty_equipment_repair" if is_repair_form else "faulty_equipment"),
                _display_value(
                    failure_code_label(
                        doc.get("faulty_equipment"),
                        failure_codes,
                        failure_class_code,
                    )
                    or doc.get("faulty_equipment_label")
                    or doc.get("faulty_equipment")
                ),
            )],
            "cols": 1,
        },
    ]

    # ใบที่ปัญหาอยู่ที่ตู้ชาร์จ ต้องระบุว่าตู้ไหน — ฟอร์มกรอก charger_no/charger_sn ไว้เฉพาะ
    # failure class ระดับตู้ (DC/AC Charger) ใบระดับสถานีจึงไม่มีค่าและไม่ต้องขึ้นแถวนี้
    # เช็คจากค่าที่มีจริงแทนรหัส class เพราะใบเก่าใช้รหัสคนละชุด (DCCHARFC/ACCHARFC)
    charger_no = _display_value(doc.get("charger_no"), "")
    charger_sn = _display_value(doc.get("charger_sn"), "")
    if charger_no or charger_sn:
        section2_parts.append({
            "kind": "info",
            "data": [
                (_t("charger_no"), charger_no or "-"),
                (_t("charger_sn"), charger_sn or "-"),
            ],
            "cols": 2,
        })

    section2_parts += [
        {
            "kind": "choice",
            "label": _t("severity"),
            "options": _choices(_SEVERITY_CHOICES),
            "selected": doc.get("severity"),
        },
        {
            "kind": "text",
            "label": _t("details" if status_bucket == "closed" else "problem_found"),
            "text": _display_value(doc.get("problem_details")),
            "min_h": 12,
        },
    ]

    remarks_open = _display_value(doc.get("remarks_open"), "")
    if not remarks_open:
        remarks_open = _display_value(doc.get("remarks"), "")
    if remarks_open:
        section2_parts.append({
            "kind": "text", "label": _t("remarks"), "text": remarks_open, "min_h": 10,
        })

    if status_bucket == "closed" and str(doc.get("status") or "").strip().lower() in {"cancelled", "canceled"}:
        cancel_remark = _display_value(doc.get("cancel_remark"), "")
        if cancel_remark:
            section2_parts.append({
                "kind": "text", "label": _t("cancel_reason"), "text": cancel_remark, "min_h": 10,
            })

    y = _draw_section_group(
        pdf, base_font, x0, y, page_w, _t("sec2"),
        parts=section2_parts,
    )
    y += 3

    # ===== รูปภาพ / ไฟล์แนบของใบแจ้ง =====
    # แยกออกมาเป็นบล็อกของตัวเองแทนที่จะต่อท้ายหมวดรายละเอียดปัญหา เพราะกรอบหมวดขึ้นหน้าใหม่ไม่ได้
    # รูปที่เกินขอบหน้าจึงถูกตัดหาย — บล็อกนี้ย้ายไปทั้งก้อน รูปทุกใบจึงอยู่ที่เดียวกันเสมอ
    photos_obj = doc.get("photos", {}) or doc.get("photos_problem", {}) or {}
    cm_attachments = photos_obj.get("cm_photos", []) if isinstance(photos_obj, dict) else []
    cm_images, _ = _split_attachments(cm_attachments)

    attachment_parts: List[Dict[str, Any]] = []
    if cm_images:
        attachment_parts.append({
            "kind": "photo",
            "photos": cm_images[:PROBLEM_PHOTO_LIMIT],
            "cols": 3,
            "img_h": 45,
        })
    if attachment_parts:
        y = _new_page_if_needed(
            pdf, y,
            SECTION_BAR_H + sum(_measure_part_height(pdf, page_w, p) for p in attachment_parts),
        )
        y = _draw_section_group(
            pdf, base_font, x0, y, page_w,
            _t("problem_photos"),
            parts=attachment_parts,
        )
        y += 3

    # เตรียมรหัสปัญหา/สาเหตุไว้ใช้แปลคำอธิบายของ corrective action
    problem_codes = _as_code_list(doc.get("problem_type"))
    cause_codes = _as_code_list(doc.get("cause"))
    # ===== ส่วนที่ 4: การดำเนินการแก้ไข =====
    # repaired_equipment เก็บ remedy code — คำอธิบายขึ้นกับบริบท (failure code + ปัญหา + สาเหตุ)
    # เช่น REPLACE ของ POWBOAFA = "Replace (Power Board)" คนละเรื่องกับ REPLACE ของ OVERHEAT
    failure_code = doc.get("faulty_equipment")
    section4_parts: List[Dict[str, Any]] = []
    # Open ใช้ repair_result เป็น marker ของสถานะรอแผน (เช่น WO - wait for scheduled)
    # จึงไม่นับ marker นี้เป็นข้อมูลการซ่อมจนกว่าจะเข้า In Progress/Closed
    has_repair_data = any([
        doc.get("start_repair_date"), doc.get("resolved_date"), doc.get("repaired_equipment"),
        doc.get("corrective_actions"), doc.get("repair_history"), doc.get("inspector"),
        doc.get("inprogress_remarks"), doc.get("signature"),
        status_bucket != "open" and doc.get("repair_result"),
    ])
    if is_repair_form or has_repair_data:
        section4_parts.append({
            "kind": "info",
            "data": [
                (_t("start_repair_inprogress" if is_repair_form else "start_repair"), _fmt_date_time(doc.get("start_repair_date"), doc.get("start_repair_time"))),
                (_t("finish_repair_inprogress" if is_repair_form else "finish_repair"), _fmt_date_time(doc.get("resolved_date"), doc.get("resolved_time"))),
            ],
            "cols": 2,
        })
        section4_parts.append({
            "kind": "info",
            "data": [
                (_t("repairer"), _display_value(doc.get("inspector"))),
            ],
            "cols": 1,
        })
        section4_parts.append({
            "kind": "choice",
            "label": _t("repair_result"),
            "options": _choices(_repair_result_choices(status_bucket)),
            "selected": _fmt_repair_result(doc.get("repair_result")) or "",
        })

        # รอบการเข้าแก้ไขก่อนหน้า (รอของ/รอหน้างาน) — ตารางด้านบนเก็บแค่รอบที่ปิดงาน
        section4_parts.extend(
            _repair_history_parts(doc, failure_codes, failure_class_code)
        )

        inprogress_remarks = _display_value(doc.get("inprogress_remarks"), "")
        if inprogress_remarks:
            section4_parts.append({
                "kind": "text",
                "label": _t("remarks" if is_repair_form else "inprogress_remarks"),
                "text": inprogress_remarks,
                "min_h": 10,
            })

        if doc.get("signature"):
            section4_parts.append({
                "kind": "photo",
                "photos": [{"url": doc.get("signature")}],
                "title": _t("signature"),
                "cols": 1,
                "img_h": 25,
            })

        y = _new_page_if_needed(
            pdf, y,
            SECTION_BAR_H + sum(_measure_part_height(pdf, page_w, p) for p in section4_parts),
        )
        y = _draw_section_group(
            pdf, base_font, x0, y, page_w,
            _t("sec4_inprogress" if is_repair_form else "sec4"),
            parts=section4_parts,
        )
        y += 3

    # รายละเอียด corrective actions วาดแยกจากกรอบใหญ่ เพราะมีรูปก่อน/หลังที่ยืดหยุ่น
    if corrective_actions:
        action_codes = _pdf_repaired_equipment(doc)
        action_problem_codes = _pdf_codes_for_action_context(doc, "problem_type")
        action_cause_codes = _pdf_codes_for_action_context(doc, "cause")

        for idx, action in enumerate(corrective_actions, 1):
            action_problem = action_problem_codes[idx - 1] if idx - 1 < len(action_problem_codes) else ""
            action_cause = action_cause_codes[idx - 1] if idx - 1 < len(action_cause_codes) else ""
            context_problems = [action_problem] if action_problem else problem_codes
            context_causes = [action_cause] if action_cause else cause_codes
            correction_code = action_codes[idx - 1] if idx - 1 < len(action_codes) else str(action.get("code") or "")
            correction_labels = remedy_descriptions(
                failure_code,
                context_problems,
                context_causes,
                correction_code,
                failure_codes,
                failure_class_code,
            ) if correction_code else []
            correction_text = "\n".join(correction_labels) or correction_code
            action_fields: List[Tuple[str, str, float]] = []
            if (correction_text or "").strip():
                action_fields.append((_t("correction"), correction_text, 8))
            action_fields.append((_t("action_details"), action.get("text", "") or "-", 10))
            y = _new_page_if_needed(
                pdf,
                y,
                _measure_action_block_height(
                    pdf, base_font, page_w, action_fields, action,
                    include_photos=False,
                ),
            )
            y = _draw_action_block(
                pdf,
                base_font,
                x0,
                y,
                page_w,
                idx,
                action,
                correction_text=correction_text,
                include_photos=False,
            )

    # ===== ส่วนที่ 3: ประเภทและสาเหตุของปัญหา =====
    # แสดงหลังรายละเอียด corrective action ตามลำดับของแบบฟอร์ม PDF
    problem_type_text = _join_labels(
        problem_codes,
        lambda code: problem_label(code, failure_codes, failure_class_code),
    ) or "-"
    section3_parts: List[Dict[str, Any]] = [
        {
            "kind": "info",
            "data": [(_t("problem"), problem_type_text)],
            "cols": 1,
        },
    ]
    cause = _join_labels(
        cause_codes,
        lambda code: cause_label(code, failure_codes, failure_class_code),
    )
    if cause and cause != "-":
        section3_parts.append({
            "kind": "info",
            "data": [(_t("cause"), cause)],
            "cols": 1,
        })

    # ฟอร์ม Open ยังไม่มีช่องปัญหา/สาเหตุจากช่าง จึงไม่พิมพ์หมวดนี้จนกว่าจะมีข้อมูลจริง
    if is_repair_form or problem_type_text != "-" or cause:
        y = _new_page_if_needed(
            pdf, y,
            SECTION_BAR_H + sum(_measure_part_height(pdf, page_w, p) for p in section3_parts),
        )
        y = _draw_section_group(
            pdf, base_font, x0, y, page_w,
            _t("sec3_repair" if is_repair_form else "sec3"),
            parts=section3_parts,
        )
        y += 3

    # วางรูปก่อน/หลังแก้ไขหลัง Problem and Cause Details
    if corrective_actions:
        for action in corrective_actions:
            photo_height = _measure_action_photos_height(action)
            if not photo_height:
                continue
            y = _new_page_if_needed(pdf, y, photo_height + 3)
            y = _draw_action_photos(pdf, base_font, x0, y, page_w, action)
            y += 3

    # ===== ส่วนที่ 5: การป้องกันและผลการซ่อม =====
    section5_parts: List[Dict[str, Any]] = []

    preventive_actions = doc.get("preventive_action") or []
    if not isinstance(preventive_actions, list):
        preventive_actions = [preventive_actions]
    if preventive_actions:
        preventive_text = "\n".join(
            f"{i}. {a}"
            for i, a in enumerate(preventive_actions, 1)
            if a
        )
        if preventive_text:
            section5_parts.append({
                "kind": "text",
                "label": _t("preventive"),
                "text": preventive_text,
                "min_h": 12,
            })

    # Open ใช้ field นี้เป็นหมายเหตุสถานะรอ ซึ่งแสดงไว้ในข้อมูลการวางแผนแล้ว
    repair_remark = _display_value(doc.get("repair_result_remark"), "") if status_bucket != "open" else ""
    if repair_remark and repair_remark != "-":
        section5_parts.append({
            "kind": "text",
            "label": _t("result_remarks"),
            "text": repair_remark,
            "min_h": 10,
        })

    if section5_parts:
        y = _new_page_if_needed(
            pdf, y,
            SECTION_BAR_H + sum(_measure_part_height(pdf, page_w, p) for p in section5_parts),
        )
        y = _draw_section_group(
            pdf, base_font, x0, y, page_w, _t("sec5"),
            parts=section5_parts,
        )
        y += 3

    # ===== ผู้เกี่ยวข้อง (ไม่มีเลขหมวด — ไม่ใช่ช่องเซ็นแล้ว แค่แสดงชื่อคนที่ทำรายการ) =====
    def _date_or_blank(*vals) -> str:
        for v in vals:
            if v:
                d = _fmt_date_full(v)
                if d != "-":
                    return d
        return ""

    people: List[Tuple[str, str, str]] = [
        (
            _t("reported_by"),
            reported_by if reported_by != "-" else "",
            _date_or_blank(doc.get("found_date"), doc.get("cm_date")),
        ),
    ]
    # ฟอร์ม Open ยังไม่มีข้อมูลผู้ซ่อม/ผู้ตรวจสอบ จึงไม่สร้างช่องว่างหลอกผู้ใช้
    if is_repair_form or status_bucket == "closed" or doc.get("inspector") or doc.get("approved_by"):
        people.append((
            _t("repairer"),
            _display_value(doc.get("inspector"), ""),
            _date_or_blank(doc.get("resolved_date"), doc.get("start_repair_date"), doc.get("found_date")),
        ))
        people.append((
            _t("inspector"),
            _display_value(doc.get("approved_by"), ""),
            _date_or_blank(doc.get("approved_at"), doc.get("approved_date")),
        ))

    people_h = (LINE_H + 1.0) * 2 + (LINE_H + 1.6)
    y = _new_page_if_needed(pdf, y, SECTION_BAR_H + people_h)
    y = _draw_section_bar(pdf, base_font, x0, y, page_w, "", _t("people"))
    _draw_people_block(pdf, base_font, x0, y, page_w, people)

    return _output_pdf_bytes(pdf)


def generate_pdf(data: dict, lang: str = DEFAULT_LANG, style: str = DEFAULT_STYLE) -> bytes:
    """Public API สำหรับ pdf_routes"""
    return make_cm_report_pdf_bytes(data, style=style, lang=lang)
