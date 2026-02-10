# # backend/pdf/templates/pdf_cmreport.py
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
#     """วาดรูปภาพเป็นกริด"""
#     if not images:
#         return 0.0
    
#     inner_x = x + PADDING_X
#     inner_w = w - 2 * PADDING_X
#     slot_w = (inner_w - (ACT_MAX_COLS - 1) * ACT_IMG_GAP) / ACT_MAX_COLS

#     row_y = y + PADDING_Y
#     col = 0
    
#     # ✅ แก้ตรงนี้ - รองรับทั้ง ObjectId และ dict
#     doc_id = doc.get("_id", "")
#     if hasattr(doc_id, '__str__'):  # เป็น ObjectId
#         doc_id = str(doc_id)
#     elif isinstance(doc_id, dict):  # เป็น dict {"$oid": "..."}
#         doc_id = doc_id.get("$oid", "")
    
#     station_id = doc.get("station_id", "")
    
#     for img in images:
#         if col == ACT_MAX_COLS:
#             col = 0
#             row_y += ACT_IMG_H + ACT_IMG_GAP
        
#         cx = inner_x + col * (slot_w + ACT_IMG_GAP)
        
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

# def _draw_header(
#     pdf: FPDF,
#     base_font: str,
#     issue_id: str = "-",
#     doc_name: str = "-",
#     label_page: str = "Page",
#     label_issue_id: str = "Issue ID",
#     label_doc_name: str = "Doc Name",
#     addr_line1: str = "Electricity Generating Authority of Thailand (EGAT)",  # เพิ่ม
#     addr_line2: str = "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand",  # เพิ่ม
#     addr_line3: str = "Call Center Tel. 02-114-3350",  # เพิ่ม
# ) -> float:
#     left = pdf.l_margin
#     right = pdf.r_margin
#     page_w = pdf.w - left - right
#     x0 = left
#     y_top = 10

#     col_left, col_mid = 35, 120
#     col_right = page_w - col_left - col_mid

#     h_all = 22
#     h_right_half = h_all / 2  # แบ่งกล่องขวาเป็น 2 ส่วนเท่าๆ กัน

#     pdf.set_line_width(LINE_W_INNER)

#     # ========== Page number ที่มุมขวาบน ==========
#     page_text = f"{label_page} {pdf.page_no()}"
#     pdf.set_font(base_font, "", FONT_MAIN - 1)
#     page_text_w = pdf.get_string_width(page_text) + 4
#     page_x = pdf.w - right - page_text_w
#     page_y = 5  # ย้ายขึ้นไปด้านบนสุด
#     pdf.set_xy(page_x, page_y)
#     pdf.cell(page_text_w, 4, page_text, align="R")

#     # โลโก้
#     pdf.rect(x0, y_top, col_left, h_all)
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
#     pdf.rect(box_x, y_top, col_mid, h_all)

#     addr_lines = [addr_line1, addr_line2, addr_line3]  # ใช้ parameters

#     pdf.set_font(base_font, "B", FONT_MAIN)
#     line_h = 4.5

#     start_y = y_top + (h_all - line_h * len(addr_lines)) / 2

#     for i, line in enumerate(addr_lines):
#         pdf.set_xy(box_x + 3, start_y + i * line_h)
#         pdf.cell(col_mid - 6, line_h, line, align="C")

#     # กล่องขวา - Issue ID (ครึ่งบน)
#     xr = x0 + col_left + col_mid
#     pdf.rect(xr, y_top, col_right, h_right_half)

#     # กล่องขวา - Doc Name (ครึ่งล่าง)
#     pdf.rect(xr, y_top + h_right_half, col_right, h_right_half)

#     # Issue ID (2 บรรทัด)
#     pdf.set_xy(xr, y_top + 1)
#     pdf.set_font(base_font, "B", FONT_MAIN - 2)
#     pdf.multi_cell(col_right, 4.5, f"{label_issue_id}\n{issue_id}", align="C")

#     # Doc Name (2 บรรทัด)
#     pdf.set_xy(xr, y_top + h_right_half + 1)
#     pdf.set_font(base_font, "B", FONT_MAIN - 2)
#     pdf.multi_cell(col_right, 4.5, f"{label_doc_name}\n{doc_name}", align="C")

#     return y_top + h_all

# def _draw_cm_info_block(pdf: FPDF, base_font: str, x: float, y: float, w: float, doc: dict, job: dict) -> float:
#     """วาดส่วนข้อมูล CM"""
    
#     pdf.set_line_width(LINE_W_INNER)
    
#     # คำนวณความสูง
#     top_row_h = 8.5
#     col_w = w / 3.0
#     half_w = w / 2.0
#     label_w = 30
    
#     # ข้อมูล
#     station_name = str(job.get("location", "-"))
#     found_date = _fmt_date_thai(job.get("found_date", "-"))
#     cm_date = _fmt_date_thai(doc.get("cm_date", "-"))
#     device = str(job.get("faulty_equipment", "-"))
#     reporter = str(doc.get("inspector", "-"))
#     severity = str(job.get("severity", "-"))
#     problem_type = str(job.get("problem_type", "-"))
#     problem_details = str(job.get("problem_details", "-"))
#     initial_cause = str(job.get("initial_cause", "-"))
#     status = str(job.get("status", "-"))
    
#     # แถวกลาง
#     inner_w_full = w - 2 * PADDING_X
#     val_w_left = half_w - 2 * PADDING_X - label_w
#     val_w_right = half_w - 2 * PADDING_X - label_w
#     _, dev_h = _split_lines(pdf, val_w_left, device, LINE_H)
#     _, rep_h = _split_lines(pdf, val_w_right, reporter, LINE_H)
#     middle_row_h = max(ROW_MIN_H, 2 * PADDING_Y + max(dev_h, rep_h))
    
#     # คำนวณความสูงแถวล่าง
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     lab_sev = "ความรุนแรง : "
#     lab_type = "ประเภทปัญหา : "
#     lab_det = "รายละเอียด : "
#     lab_cause = "สาเหตุ : "
#     lab_status = "สถานะ : "
    
#     lab_sev_w = pdf.get_string_width(lab_sev)
#     lab_type_w = pdf.get_string_width(lab_type)
#     lab_det_w = pdf.get_string_width(lab_det)
#     lab_cause_w = pdf.get_string_width(lab_cause)
#     lab_status_w = pdf.get_string_width(lab_status)
    
#     pdf.set_font(base_font, "", FONT_MAIN)
#     _, sev_h = _split_lines(pdf, inner_w_full - lab_sev_w, severity, LINE_H)
#     _, type_h = _split_lines(pdf, inner_w_full - lab_type_w, problem_type, LINE_H)
#     _, det_h = _split_lines(pdf, inner_w_full - lab_det_w, problem_details, LINE_H)
#     _, cause_h = _split_lines(pdf, inner_w_full - lab_cause_w, initial_cause, LINE_H)
#     _, status_h = _split_lines(pdf, inner_w_full - lab_status_w, status, LINE_H)
    
#     # Corrective Actions
#     corrective_actions = job.get("corrective_actions", [])
#     actions_total_h = 0.0
#     fix_text_w = inner_w_full - 20
    
#     for idx, act in enumerate(corrective_actions, 1):
#         text = str(act.get("text", "-"))
#         _, t_h = _split_lines(pdf, fix_text_w, f"{idx}) {text}", LINE_H)
#         t_h = max(LINE_H, t_h)
        
#         imgs = act.get("images", [])
#         rows = math.ceil(len(imgs) / ACT_MAX_COLS) if imgs else 0
#         img_block_h = 0.0
#         if rows > 0:
#             img_block_h = 2 * PADDING_Y + rows * ACT_IMG_H + (rows - 1) * ACT_IMG_GAP
        
#         actions_total_h += t_h + img_block_h
    
#     # Preventive Actions
#     preventive_list = job.get("preventive_action", [])
#     if isinstance(preventive_list, str):
#         preventive_list = [preventive_list]
    
#     preventive_total_h = 0.0
#     for idx, text in enumerate(preventive_list, 1):
#         text = str(text).strip() or "-"
#         _, t_h = _split_lines(pdf, fix_text_w, f"{idx}) {text}", LINE_H)
#         preventive_total_h += max(LINE_H, t_h)
    
#     if not preventive_list:
#         preventive_total_h = LINE_H
    
#     # Repair Results
#     repair_result = str(job.get("repair_result", "-"))
#     _, repair_h = _split_lines(pdf, inner_w_full - 35, repair_result, LINE_H)
    
#     repaired_eq = job.get("repaired_equipment", [])
#     repaired_text = ", ".join(repaired_eq) if repaired_eq else "-"
#     _, repaired_h = _split_lines(pdf, inner_w_full - 35, repaired_text, LINE_H)
    
#     resolved_date = _fmt_date_thai(job.get("resolved_date", "-"))
    
#     remarks = str(job.get("remarks", "-"))
#     _, remarks_h = _split_lines(pdf, inner_w_full - 25, remarks, LINE_H)
    
#     bottom_row_h = max(
#         ROW_MIN_H,
#         2 * PADDING_Y
#         + LINE_H  # หัวข้อ "รายละเอียดปัญหา"
#         + max(LINE_H, sev_h)
#         + max(LINE_H, type_h)
#         + max(LINE_H, det_h)
#         + max(LINE_H, cause_h)
#         + max(LINE_H, status_h)
#         + LINE_H  # หัวข้อ "การแก้ไข"
#         + actions_total_h
#         + LINE_H  # หัวข้อ "มาตรการป้องกัน"
#         + preventive_total_h
#         + LINE_H  # หัวข้อ "ผลการซ่อม"
#         + max(LINE_H, repair_h)
#         + max(LINE_H, repaired_h)
#         + LINE_H  # Resolved Date
#         + LINE_H  # หัวข้อ "หมายเหตุ"
#         + max(LINE_H, remarks_h)
#     )
    
#     # ยืดกรอบให้เต็มหน้า
#     page_bottom_y = pdf.h - pdf.b_margin
#     available_h = max(0.0, page_bottom_y - y)
#     box_h = max(top_row_h + middle_row_h + bottom_row_h, available_h)
    
#     # วาดกรอบ
#     pdf.rect(x, y, w, box_h)
#     pdf.line(x, y + top_row_h, x + w, y + top_row_h)
#     pdf.line(x, y + top_row_h + middle_row_h, x + w, y + top_row_h + middle_row_h)
    
#     # แถวบน
#     def _kv(x0, y0, col_width, label, value, row_h):
#         pdf.set_xy(x0 + 2, y0 + 1.5)
#         pdf.set_font(base_font, "B", FONT_MAIN)
#         pdf.cell(label_w, row_h - 3, label, border=0, align="L")
#         pdf.set_font(base_font, "", FONT_MAIN)
#         pdf.set_xy(x0 + 2 + label_w, y0 + 1.5)
#         pdf.cell(col_width - label_w - 4, row_h - 3, str(value or "-"), border=0, align="L")
    
#     pdf.line(x + col_w, y, x + col_w, y + top_row_h)
#     pdf.line(x + 2*col_w, y, x + 2*col_w, y + top_row_h)
#     _kv(x, y, col_w, "สถานที่", station_name, top_row_h)
#     _kv(x + col_w, y, col_w, "วันที่เกิดเหตุ", found_date, top_row_h)
#     _kv(x + 2*col_w, y, col_w, "วันที่ตรวจสอบ", cm_date, top_row_h)
    
#     # แถวกลาง
#     ly = y + top_row_h
#     pdf.line(x + half_w, ly, x + half_w, ly + middle_row_h)
    
#     lx = x
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.set_xy(lx + PADDING_X, ly + PADDING_Y)
#     pdf.cell(label_w, LINE_H, "อุปกรณ์", border=0, align="L")
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(lx + PADDING_X + label_w, ly + PADDING_Y)
#     pdf.multi_cell(val_w_left, LINE_H, device, border=0, align="L")
    
#     rx = x + half_w
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.set_xy(rx + PADDING_X, ly + PADDING_Y)
#     pdf.cell(label_w, LINE_H, "ผู้ตรวจสอบ", border=0, align="L")
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(rx + PADDING_X + label_w, ly + PADDING_Y)
#     pdf.multi_cell(val_w_right, LINE_H, reporter, border=0, align="L")
    
#     # แถวล่าง
#     by = y + top_row_h + middle_row_h
#     inner_x = x + PADDING_X
#     cur_y = by + PADDING_Y
    
#     # รายละเอียดปัญหา
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.set_xy(inner_x, cur_y)
#     pdf.cell(inner_w_full, LINE_H, "รายละเอียดปัญหา", border=0, align="L")
#     cur_y += LINE_H
    
#     # ความรุนแรง
#     pdf.set_xy(inner_x, cur_y)
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.cell(lab_sev_w, LINE_H, lab_sev, border=0, align="L")
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(inner_x + lab_sev_w, cur_y)
#     pdf.multi_cell(inner_w_full - lab_sev_w, LINE_H, severity, border=0, align="L")
#     cur_y += max(LINE_H, sev_h)
    
#     # ประเภทปัญหา
#     pdf.set_xy(inner_x, cur_y)
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.cell(lab_type_w, LINE_H, lab_type, border=0, align="L")
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(inner_x + lab_type_w, cur_y)
#     pdf.multi_cell(inner_w_full - lab_type_w, LINE_H, problem_type, border=0, align="L")
#     cur_y += max(LINE_H, type_h)
    
#     # รายละเอียด
#     pdf.set_xy(inner_x, cur_y)
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.cell(lab_det_w, LINE_H, lab_det, border=0, align="L")
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(inner_x + lab_det_w, cur_y)
#     pdf.multi_cell(inner_w_full - lab_det_w, LINE_H, problem_details, border=0, align="L")
#     cur_y += max(LINE_H, det_h)
    
#     # สาเหตุ
#     pdf.set_xy(inner_x, cur_y)
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.cell(lab_cause_w, LINE_H, lab_cause, border=0, align="L")
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(inner_x + lab_cause_w, cur_y)
#     pdf.multi_cell(inner_w_full - lab_cause_w, LINE_H, initial_cause, border=0, align="L")
#     cur_y += max(LINE_H, cause_h)
    
#     # สถานะ
#     pdf.set_xy(inner_x, cur_y)
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.cell(lab_status_w, LINE_H, lab_status, border=0, align="L")
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(inner_x + lab_status_w, cur_y)
#     pdf.multi_cell(inner_w_full - lab_status_w, LINE_H, status, border=0, align="L")
#     cur_y += max(LINE_H, status_h)
    
#     # การแก้ไข
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.set_xy(inner_x, cur_y)
#     pdf.cell(inner_w_full, LINE_H, "การแก้ไข", border=0, align="L")
#     cur_y += LINE_H
    
#     value_x = inner_x + 20
#     for i, act in enumerate(corrective_actions, 1):
#         pdf.set_xy(inner_x, cur_y)
#         pdf.set_font(base_font, "B", FONT_MAIN)
#         pdf.cell(20, LINE_H, "ข้อ : ", border=0, align="L")
        
#         text = str(act.get("text", "-"))
#         pdf.set_xy(value_x, cur_y)
#         pdf.set_font(base_font, "", FONT_MAIN)
#         pdf.multi_cell(fix_text_w, LINE_H, f"{i}) {text}", border=0, align="L")
        
#         _, t_h = _split_lines(pdf, fix_text_w, f"{i}) {text}", LINE_H)
#         cur_y += max(LINE_H, t_h)
        
#         imgs = act.get("images", [])
#         if imgs:
#             used_h = _draw_images_grid(pdf, value_x, cur_y, fix_text_w, imgs, doc)
#             cur_y += used_h
    
#     # มาตรการป้องกัน
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.set_xy(inner_x, cur_y)
#     pdf.cell(inner_w_full, LINE_H, "มาตรการป้องกัน", border=0, align="L")
#     cur_y += LINE_H
    
#     for i, text in enumerate(preventive_list, 1):
#         pdf.set_xy(inner_x, cur_y)
#         pdf.set_font(base_font, "B", FONT_MAIN)
#         pdf.cell(20, LINE_H, "ข้อ : ", border=0, align="L")
        
#         text = str(text).strip() or "-"
#         pdf.set_xy(value_x, cur_y)
#         pdf.set_font(base_font, "", FONT_MAIN)
#         pdf.multi_cell(fix_text_w, LINE_H, f"{i}) {text}", border=0, align="L")
        
#         _, t_h = _split_lines(pdf, fix_text_w, f"{i}) {text}", LINE_H)
#         cur_y += max(LINE_H, t_h)
    
#     # ผลการซ่อม
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.set_xy(inner_x, cur_y)
#     pdf.cell(inner_w_full, LINE_H, "ผลการซ่อม", border=0, align="L")
#     cur_y += LINE_H
    
#     # ผลการซ่อม
#     pdf.set_xy(inner_x, cur_y)
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.cell(35, LINE_H, "ผลการซ่อม : ", border=0, align="L")
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(inner_x + 35, cur_y)
#     pdf.multi_cell(inner_w_full - 35, LINE_H, repair_result, border=0, align="L")
#     cur_y += max(LINE_H, repair_h)
    
#     # อุปกรณ์ที่ซ่อม
#     pdf.set_xy(inner_x, cur_y)
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.cell(35, LINE_H, "อุปกรณ์ที่ซ่อม : ", border=0, align="L")
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(inner_x + 35, cur_y)
#     pdf.multi_cell(inner_w_full - 35, LINE_H, repaired_text, border=0, align="L")
#     cur_y += max(LINE_H, repaired_h)
    
#     # วันที่แก้ไขเสร็จ
#     pdf.set_xy(inner_x, cur_y)
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.cell(35, LINE_H, "วันที่แก้ไขเสร็จ : ", border=0, align="L")
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(inner_x + 35, cur_y)
#     pdf.cell(inner_w_full - 35, LINE_H, resolved_date, border=0, align="L")
#     cur_y += LINE_H
    
#     # หมายเหตุ
#     pdf.set_font(base_font, "B", FONT_MAIN)
#     pdf.set_xy(inner_x, cur_y)
#     pdf.cell(25, LINE_H, "หมายเหตุ : ", border=0, align="L")
#     pdf.set_font(base_font, "", FONT_MAIN)
#     pdf.set_xy(inner_x + 25, cur_y)
#     pdf.multi_cell(inner_w_full - 25, LINE_H, remarks, border=0, align="L")
    
#     return y + box_h

# def _draw_photos_section(pdf: FPDF, base_font: str, x: float, y: float, w: float, photos: dict) -> float:
#     """วาดส่วนรูปภาพ"""
#     cm_photos = photos.get("cm_photos", [])
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
#     """สร้าง CM Report PDF"""
#     pdf = HTML2PDF(unit="mm", format="A4")
#     pdf.set_margins(left=10, top=10, right=10)
#     pdf.set_auto_page_break(auto=True, margin=12)
    
#     # โหลดฟอนต์
#     base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
#     pdf.set_font(base_font, size=FONT_MAIN)
#     pdf.set_line_width(LINE_W_INNER)
    
#     issue_id = str(doc.get("issue_id", "-"))
#     job = doc.get("job", {}) or {}
    
#     left = pdf.l_margin
#     right = pdf.r_margin
#     page_w = pdf.w - left - right
#     x0 = left
    
#     # เริ่มหน้าแรก
#     pdf.add_page()
#     y = _draw_header(pdf, base_font, issue_id)
    
#     # ชื่อเอกสาร
#     pdf.set_xy(x0, y)
#     pdf.set_font(base_font, "B", 16)
#     pdf.cell(page_w, 10, "Corrective Maintenance Report", border=1, ln=1, align="C")
#     y += 10
    
#     # ข้อมูล CM
#     y = _draw_cm_info_block(pdf, base_font, x0, y, page_w, doc, job)
    
#     # รูปภาพ (ถ้ามี)
#     photos = doc.get("photos", {})
#     if photos.get("cm_photos"):
#         pdf.add_page()
#         y = _draw_header(pdf, base_font, issue_id)
#         y = _draw_photos_section(pdf, base_font, x0, y, page_w, photos)
    
#     return _output_pdf_bytes(pdf)

# def generate_pdf(data: dict, lang: str = "th") -> bytes:
#     """
#     Public API สำหรับ pdf_routes
#     รับ parameter lang เพื่อความ compatible กับ route
#     """
#     return make_cm_report_pdf_bytes(data)



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
LINE_W_OUTER = 0.45
LINE_W_INNER = 0.22
PADDING_X = 2.0
PADDING_Y = 1.2
FONT_MAIN = 13.0
FONT_SMALL = 13.0
LINE_H = 6.8
ROW_MIN_H = 9

ACT_MAX_COLS = 3
ACT_IMG_H = 30
ACT_IMG_GAP = 3

PHOTO_MAX_PER_ROW = 2
PHOTO_IMG_H = 60
PHOTO_GAP = 5

class HTML2PDF(FPDF, HTMLMixin):
    pass

def _split_lines(pdf: FPDF, width: float, text: str, line_h: float):
    """แยกบรรทัดข้อความ"""
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
    """วาดข้อความในกรอบ"""
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
    else:
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

    # หา backend/uploads
    backend_root = Path(__file__).resolve().parents[2]
    uploads_root = backend_root / "uploads"
    
    if uploads_root.exists():
        clean_path = url_path.lstrip("/")
        if clean_path.startswith("uploads/"):
            clean_path = clean_path[8:]
        
        local_path = uploads_root / clean_path
        if local_path.exists() and local_path.is_file():
            return local_path.as_posix(), _guess_img_type_from_ext(local_path.as_posix())

    # ลองดาวน์โหลด
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

def _draw_images_grid(pdf: FPDF, x: float, y: float, w: float, images: list, doc: dict) -> float:
    """วาดรูปภาพเป็นกริด - รองรับทั้ง beforeImages และ afterImages"""
    if not images:
        return 0.0
    
    inner_x = x + PADDING_X
    inner_w = w - 2 * PADDING_X
    slot_w = (inner_w - (ACT_MAX_COLS - 1) * ACT_IMG_GAP) / ACT_MAX_COLS

    row_y = y + PADDING_Y
    col = 0
    
    # แปลง ObjectId เป็น string
    doc_id = doc.get("_id", "")
    if hasattr(doc_id, '__str__'):
        doc_id = str(doc_id)
    elif isinstance(doc_id, dict):
        doc_id = doc_id.get("$oid", "")
    
    station_id = doc.get("station_id", "")
    
    for img in images:
        if col == ACT_MAX_COLS:
            col = 0
            row_y += ACT_IMG_H + ACT_IMG_GAP
        
        cx = inner_x + col * (slot_w + ACT_IMG_GAP)
        
        # รองรับทั้ง url, path, และ name
        url = img.get("url") or img.get("path") or ""
        if not url and img.get("name"):
            filename = img.get("name")
            url = f"/uploads/cm/{station_id}/{doc_id}/corrective_actions/{filename}"
        
        src, img_type = _load_image_source_from_urlpath(url)
        
        try:
            if src is not None:
                pdf.image(src, x=cx, y=row_y, w=slot_w, h=ACT_IMG_H, type=(img_type or None))
            else:
                pdf.rect(cx, row_y, slot_w, ACT_IMG_H)
        except Exception:
            pdf.rect(cx, row_y, slot_w, ACT_IMG_H)
        
        col += 1

    rows = math.ceil(len(images) / ACT_MAX_COLS)
    return 2 * PADDING_Y + rows * ACT_IMG_H + (rows - 1) * ACT_IMG_GAP

def _output_pdf_bytes(pdf: FPDF) -> bytes:
    """Output PDF เป็น bytes"""
    data = pdf.output(dest="S")
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    return data.encode("latin1")

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
    page_y = 5
    pdf.set_xy(page_x, page_y)
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

    # กล่องขวา
    xr = x0 + col_left + col_mid
    pdf.rect(xr, y_top, col_right, h_right_half)
    pdf.rect(xr, y_top + h_right_half, col_right, h_right_half)

    # Issue ID
    pdf.set_xy(xr, y_top + 1)
    pdf.set_font(base_font, "B", FONT_MAIN - 2)
    pdf.multi_cell(col_right, 4.5, f"{label_issue_id}\n{issue_id}", align="C")

    # Doc Name
    pdf.set_xy(xr, y_top + h_right_half + 1)
    pdf.set_font(base_font, "B", FONT_MAIN - 2)
    pdf.multi_cell(col_right, 4.5, f"{label_doc_name}\n{doc_name}", align="C")

    return y_top + h_all

def _draw_cm_info_block(pdf: FPDF, base_font: str, x: float, y: float, w: float, doc: dict) -> float:
    """
    วาดส่วนข้อมูล CM - แก้ไขให้รองรับโครงสร้างข้อมูลจาก MongoDB
    ไม่มี nested job object, ข้อมูลอยู่ที่ระดับเดียวกันกับ root
    """
    
    pdf.set_line_width(LINE_W_INNER)
    
    # คำนวณความสูง
    top_row_h = 8.5
    col_w = w / 3.0
    half_w = w / 2.0
    label_w = 30
    
    # ✅ ดึงข้อมูลจาก doc โดยตรง (ไม่มี nested job)
    station_name = str(doc.get("location", "-"))
    found_date = _fmt_date_thai(doc.get("found_date", "-"))
    cm_date = _fmt_date_thai(doc.get("cm_date", "-"))
    device = str(doc.get("faulty_equipment", "-"))
    reporter = str(doc.get("inspector", "-"))
    severity = str(doc.get("severity", "-"))
    problem_type = str(doc.get("problem_type", "-"))
    problem_details = str(doc.get("problem_details", "-"))
    
    # รองรับทั้ง initial_cause และ cause
    initial_cause = str(doc.get("initial_cause") or doc.get("cause", "-"))
    status = str(doc.get("status", "-"))
    
    # แถวกลาง
    inner_w_full = w - 2 * PADDING_X
    val_w_left = half_w - 2 * PADDING_X - label_w
    val_w_right = half_w - 2 * PADDING_X - label_w
    _, dev_h = _split_lines(pdf, val_w_left, device, LINE_H)
    _, rep_h = _split_lines(pdf, val_w_right, reporter, LINE_H)
    middle_row_h = max(ROW_MIN_H, 2 * PADDING_Y + max(dev_h, rep_h))
    
    # คำนวณความสูงแถวล่าง
    pdf.set_font(base_font, "B", FONT_MAIN)
    lab_sev = "ความรุนแรง : "
    lab_type = "ประเภทปัญหา : "
    lab_det = "รายละเอียด : "
    lab_cause = "สาเหตุ : "
    lab_status = "สถานะ : "
    
    lab_sev_w = pdf.get_string_width(lab_sev)
    lab_type_w = pdf.get_string_width(lab_type)
    lab_det_w = pdf.get_string_width(lab_det)
    lab_cause_w = pdf.get_string_width(lab_cause)
    lab_status_w = pdf.get_string_width(lab_status)
    
    pdf.set_font(base_font, "", FONT_MAIN)
    _, sev_h = _split_lines(pdf, inner_w_full - lab_sev_w, severity, LINE_H)
    _, type_h = _split_lines(pdf, inner_w_full - lab_type_w, problem_type, LINE_H)
    _, det_h = _split_lines(pdf, inner_w_full - lab_det_w, problem_details, LINE_H)
    _, cause_h = _split_lines(pdf, inner_w_full - lab_cause_w, initial_cause, LINE_H)
    _, status_h = _split_lines(pdf, inner_w_full - lab_status_w, status, LINE_H)
    
    # ✅ Corrective Actions - รองรับ beforeImages และ afterImages
    corrective_actions = doc.get("corrective_actions", [])
    actions_total_h = 0.0
    fix_text_w = inner_w_full - 20
    
    for idx, act in enumerate(corrective_actions, 1):
        text = str(act.get("text", "-"))
        _, t_h = _split_lines(pdf, fix_text_w, f"{idx}) {text}", LINE_H)
        t_h = max(LINE_H, t_h)
        
        # รวม beforeImages และ afterImages
        all_images = []
        all_images.extend(act.get("beforeImages", []))
        all_images.extend(act.get("afterImages", []))
        
        rows = math.ceil(len(all_images) / ACT_MAX_COLS) if all_images else 0
        img_block_h = 0.0
        if rows > 0:
            img_block_h = 2 * PADDING_Y + rows * ACT_IMG_H + (rows - 1) * ACT_IMG_GAP
        
        actions_total_h += t_h + img_block_h
    
    # ✅ Preventive Actions
    preventive_list = doc.get("preventive_action", [])
    if isinstance(preventive_list, str):
        preventive_list = [preventive_list]
    
    preventive_total_h = 0.0
    for idx, text in enumerate(preventive_list, 1):
        text = str(text).strip() or "-"
        _, t_h = _split_lines(pdf, fix_text_w, f"{idx}) {text}", LINE_H)
        preventive_total_h += max(LINE_H, t_h)
    
    if not preventive_list:
        preventive_total_h = LINE_H
    
    # ✅ Repair Results
    repair_result = str(doc.get("repair_result", "-"))
    _, repair_h = _split_lines(pdf, inner_w_full - 35, repair_result, LINE_H)
    
    repaired_eq = doc.get("repaired_equipment", [])
    repaired_text = ", ".join(repaired_eq) if repaired_eq else "-"
    _, repaired_h = _split_lines(pdf, inner_w_full - 35, repaired_text, LINE_H)
    
    resolved_date = _fmt_date_thai(doc.get("resolved_date", "-"))
    
    remarks = str(doc.get("remarks", "-"))
    _, remarks_h = _split_lines(pdf, inner_w_full - 25, remarks, LINE_H)
    
    bottom_row_h = max(
        ROW_MIN_H,
        2 * PADDING_Y
        + LINE_H
        + max(LINE_H, sev_h)
        + max(LINE_H, type_h)
        + max(LINE_H, det_h)
        + max(LINE_H, cause_h)
        + max(LINE_H, status_h)
        + LINE_H
        + actions_total_h
        + LINE_H
        + preventive_total_h
        + LINE_H
        + max(LINE_H, repair_h)
        + max(LINE_H, repaired_h)
        + LINE_H
        + LINE_H
        + max(LINE_H, remarks_h)
    )
    
    # ยืดกรอบให้เต็มหน้า
    page_bottom_y = pdf.h - pdf.b_margin
    available_h = max(0.0, page_bottom_y - y)
    box_h = max(top_row_h + middle_row_h + bottom_row_h, available_h)
    
    # วาดกรอบ
    pdf.rect(x, y, w, box_h)
    pdf.line(x, y + top_row_h, x + w, y + top_row_h)
    pdf.line(x, y + top_row_h + middle_row_h, x + w, y + top_row_h + middle_row_h)
    
    # แถวบน
    def _kv(x0, y0, col_width, label, value, row_h):
        pdf.set_xy(x0 + 2, y0 + 1.5)
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.cell(label_w, row_h - 3, label, border=0, align="L")
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.set_xy(x0 + 2 + label_w, y0 + 1.5)
        pdf.cell(col_width - label_w - 4, row_h - 3, str(value or "-"), border=0, align="L")
    
    pdf.line(x + col_w, y, x + col_w, y + top_row_h)
    pdf.line(x + 2*col_w, y, x + 2*col_w, y + top_row_h)
    _kv(x, y, col_w, "สถานที่", station_name, top_row_h)
    _kv(x + col_w, y, col_w, "วันที่เกิดเหตุ", found_date, top_row_h)
    _kv(x + 2*col_w, y, col_w, "วันที่ตรวจสอบ", cm_date, top_row_h)
    
    # แถวกลาง
    ly = y + top_row_h
    pdf.line(x + half_w, ly, x + half_w, ly + middle_row_h)
    
    lx = x
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(lx + PADDING_X, ly + PADDING_Y)
    pdf.cell(label_w, LINE_H, "อุปกรณ์", border=0, align="L")
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(lx + PADDING_X + label_w, ly + PADDING_Y)
    pdf.multi_cell(val_w_left, LINE_H, device, border=0, align="L")
    
    rx = x + half_w
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(rx + PADDING_X, ly + PADDING_Y)
    pdf.cell(label_w, LINE_H, "ผู้ตรวจสอบ", border=0, align="L")
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(rx + PADDING_X + label_w, ly + PADDING_Y)
    pdf.multi_cell(val_w_right, LINE_H, reporter, border=0, align="L")
    
    # แถวล่าง
    by = y + top_row_h + middle_row_h
    inner_x = x + PADDING_X
    cur_y = by + PADDING_Y
    
    # รายละเอียดปัญหา
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(inner_x, cur_y)
    pdf.cell(inner_w_full, LINE_H, "รายละเอียดปัญหา", border=0, align="L")
    cur_y += LINE_H
    
    # ความรุนแรง
    pdf.set_xy(inner_x, cur_y)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(lab_sev_w, LINE_H, lab_sev, border=0, align="L")
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(inner_x + lab_sev_w, cur_y)
    pdf.multi_cell(inner_w_full - lab_sev_w, LINE_H, severity, border=0, align="L")
    cur_y += max(LINE_H, sev_h)
    
    # ประเภทปัญหา
    pdf.set_xy(inner_x, cur_y)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(lab_type_w, LINE_H, lab_type, border=0, align="L")
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(inner_x + lab_type_w, cur_y)
    pdf.multi_cell(inner_w_full - lab_type_w, LINE_H, problem_type, border=0, align="L")
    cur_y += max(LINE_H, type_h)
    
    # รายละเอียด
    pdf.set_xy(inner_x, cur_y)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(lab_det_w, LINE_H, lab_det, border=0, align="L")
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(inner_x + lab_det_w, cur_y)
    pdf.multi_cell(inner_w_full - lab_det_w, LINE_H, problem_details, border=0, align="L")
    cur_y += max(LINE_H, det_h)
    
    # สาเหตุ
    pdf.set_xy(inner_x, cur_y)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(lab_cause_w, LINE_H, lab_cause, border=0, align="L")
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(inner_x + lab_cause_w, cur_y)
    pdf.multi_cell(inner_w_full - lab_cause_w, LINE_H, initial_cause, border=0, align="L")
    cur_y += max(LINE_H, cause_h)
    
    # สถานะ
    pdf.set_xy(inner_x, cur_y)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(lab_status_w, LINE_H, lab_status, border=0, align="L")
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(inner_x + lab_status_w, cur_y)
    pdf.multi_cell(inner_w_full - lab_status_w, LINE_H, status, border=0, align="L")
    cur_y += max(LINE_H, status_h)
    
    # การแก้ไข
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(inner_x, cur_y)
    pdf.cell(inner_w_full, LINE_H, "การแก้ไข", border=0, align="L")
    cur_y += LINE_H
    
    value_x = inner_x + 20
    for i, act in enumerate(corrective_actions, 1):
        pdf.set_xy(inner_x, cur_y)
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.cell(20, LINE_H, "ข้อ : ", border=0, align="L")
        
        text = str(act.get("text", "-"))
        pdf.set_xy(value_x, cur_y)
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.multi_cell(fix_text_w, LINE_H, f"{i}) {text}", border=0, align="L")
        
        _, t_h = _split_lines(pdf, fix_text_w, f"{i}) {text}", LINE_H)
        cur_y += max(LINE_H, t_h)
        
        # รวม beforeImages และ afterImages
        all_images = []
        all_images.extend(act.get("beforeImages", []))
        all_images.extend(act.get("afterImages", []))
        
        if all_images:
            used_h = _draw_images_grid(pdf, value_x, cur_y, fix_text_w, all_images, doc)
            cur_y += used_h
    
    # มาตรการป้องกัน
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(inner_x, cur_y)
    pdf.cell(inner_w_full, LINE_H, "มาตรการป้องกัน", border=0, align="L")
    cur_y += LINE_H
    
    for i, text in enumerate(preventive_list, 1):
        pdf.set_xy(inner_x, cur_y)
        pdf.set_font(base_font, "B", FONT_MAIN)
        pdf.cell(20, LINE_H, "ข้อ : ", border=0, align="L")
        
        text = str(text).strip() or "-"
        pdf.set_xy(value_x, cur_y)
        pdf.set_font(base_font, "", FONT_MAIN)
        pdf.multi_cell(fix_text_w, LINE_H, f"{i}) {text}", border=0, align="L")
        
        _, t_h = _split_lines(pdf, fix_text_w, f"{i}) {text}", LINE_H)
        cur_y += max(LINE_H, t_h)
    
    # ผลการซ่อม
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(inner_x, cur_y)
    pdf.cell(inner_w_full, LINE_H, "ผลการซ่อม", border=0, align="L")
    cur_y += LINE_H
    
    # ผลการซ่อม
    pdf.set_xy(inner_x, cur_y)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(35, LINE_H, "ผลการซ่อม : ", border=0, align="L")
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(inner_x + 35, cur_y)
    pdf.multi_cell(inner_w_full - 35, LINE_H, repair_result, border=0, align="L")
    cur_y += max(LINE_H, repair_h)
    
    # อุปกรณ์ที่ซ่อม
    pdf.set_xy(inner_x, cur_y)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(35, LINE_H, "อุปกรณ์ที่ซ่อม : ", border=0, align="L")
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(inner_x + 35, cur_y)
    pdf.multi_cell(inner_w_full - 35, LINE_H, repaired_text, border=0, align="L")
    cur_y += max(LINE_H, repaired_h)
    
    # วันที่แก้ไขเสร็จ
    pdf.set_xy(inner_x, cur_y)
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.cell(35, LINE_H, "วันที่แก้ไขเสร็จ : ", border=0, align="L")
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(inner_x + 35, cur_y)
    pdf.cell(inner_w_full - 35, LINE_H, resolved_date, border=0, align="L")
    cur_y += LINE_H
    
    # หมายเหตุ
    pdf.set_font(base_font, "B", FONT_MAIN)
    pdf.set_xy(inner_x, cur_y)
    pdf.cell(25, LINE_H, "หมายเหตุ : ", border=0, align="L")
    pdf.set_font(base_font, "", FONT_MAIN)
    pdf.set_xy(inner_x + 25, cur_y)
    pdf.multi_cell(inner_w_full - 25, LINE_H, remarks, border=0, align="L")
    
    return y + box_h

def _draw_photos_section(pdf: FPDF, base_font: str, x: float, y: float, w: float, doc: dict) -> float:
    """
    วาดส่วนรูปภาพ - แก้ไขให้รองรับ photos_problem.cm_photos จาก MongoDB
    """
    # ✅ รองรับทั้ง photos.cm_photos และ photos_problem.cm_photos
    photos_obj = doc.get("photos", {}) or doc.get("photos_problem", {})
    cm_photos = photos_obj.get("cm_photos", [])
    
    if not cm_photos:
        return y
    
    # Header
    pdf.set_font(base_font, "B", 16)
    pdf.set_xy(x, y)
    pdf.cell(w, 10, "รูปภาพประกอบ", border=1, ln=1, align="C")
    y += 10
    
    img_w = (w - PHOTO_GAP - 4) / PHOTO_MAX_PER_ROW
    
    for i, photo in enumerate(cm_photos):
        if i % PHOTO_MAX_PER_ROW == 0:
            img_x = x + 2
            if i > 0:
                y += PHOTO_IMG_H + 10
        else:
            img_x = x + 2 + (i % PHOTO_MAX_PER_ROW) * (img_w + PHOTO_GAP)
        
        url = photo.get("url", "")
        src, img_type = _load_image_source_from_urlpath(url)
        
        if src:
            try:
                pdf.image(src, x=img_x, y=y, w=img_w, h=PHOTO_IMG_H, type=(img_type or None))
                # Label
                pdf.set_font(base_font, "", FONT_SMALL)
                pdf.set_xy(img_x, y + PHOTO_IMG_H + 1)
                pdf.cell(img_w, 4, photo.get("filename", ""), border=0, align="C")
            except:
                pdf.rect(img_x, y, img_w, PHOTO_IMG_H)
        else:
            pdf.rect(img_x, y, img_w, PHOTO_IMG_H)
    
    if len(cm_photos) % PHOTO_MAX_PER_ROW == 0:
        y += PHOTO_IMG_H + 14
    else:
        y += PHOTO_IMG_H + 14
    
    return y

def make_cm_report_pdf_bytes(doc: dict) -> bytes:
    """
    สร้าง CM Report PDF - แก้ไขให้รองรับโครงสร้างข้อมูลจาก MongoDB
    """
    pdf = HTML2PDF(unit="mm", format="A4")
    pdf.set_margins(left=10, top=10, right=10)
    pdf.set_auto_page_break(auto=True, margin=12)
    
    # โหลดฟอนต์
    base_font = "THSarabun" if add_all_thsarabun_fonts(pdf) else "Arial"
    pdf.set_font(base_font, size=FONT_MAIN)
    pdf.set_line_width(LINE_W_INNER)
    
    issue_id = str(doc.get("issue_id", "-"))
    doc_name = str(doc.get("doc_name", "-"))
    
    left = pdf.l_margin
    right = pdf.r_margin
    page_w = pdf.w - left - right
    x0 = left
    
    # เริ่มหน้าแรก
    pdf.add_page()
    y = _draw_header(pdf, base_font, issue_id, doc_name)
    
    # ชื่อเอกสาร
    pdf.set_xy(x0, y)
    pdf.set_font(base_font, "B", 16)
    pdf.cell(page_w, 10, "Corrective Maintenance Report", border=1, ln=1, align="C")
    y += 10
    
    # ✅ ส่ง doc เดียว (ไม่มี job แยก)
    y = _draw_cm_info_block(pdf, base_font, x0, y, page_w, doc)
    
    # ✅ รูปภาพ - รองรับ photos_problem
    photos_obj = doc.get("photos", {}) or doc.get("photos_problem", {})
    if photos_obj.get("cm_photos"):
        pdf.add_page()
        y = _draw_header(pdf, base_font, issue_id, doc_name)
        y = _draw_photos_section(pdf, base_font, x0, y, page_w, doc)
    
    return _output_pdf_bytes(pdf)

def generate_pdf(data: dict, lang: str = "th") -> bytes:
    """
    Public API สำหรับ pdf_routes
    รับ parameter lang เพื่อความ compatible กับ route
    """
    return make_cm_report_pdf_bytes(data)