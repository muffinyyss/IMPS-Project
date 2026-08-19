"""
สร้าง PDF ใบงาน PM ตอนปิดงาน

เดิม PDF ถูก gen แบบ lazy — ต่อเมื่อมีคนกดเปิดเท่านั้น ซึ่งพอใบงานถูกอนุมัติ
แล้วยิง IN03 แนบลิงก์เข้า Maximo คนที่กดลิงก์จาก Maximo คือคนแรกที่ทำให้ PDF
ถูกสร้าง ต้องนั่งรอ WeasyPrint เรนเดอร์สดตรงนั้น และถ้าเรนเดอร์พังก็เห็นเป็น
error 500 ทั้งที่ใบงานปิดไปเรียบร้อยแล้ว

โมดูลนี้ทำให้ PDF ถูกสร้างตั้งแต่ตอน planner อนุมัติ เก็บลง cache เดียวกับที่
route /pdf ใช้ ลิงก์ใน Maximo จึงเปิดปุ๊บได้ไฟล์ทันที
"""

from __future__ import annotations

import asyncio
import logging
import os
import pathlib
from typing import Any

from bson import ObjectId

log = logging.getLogger(__name__)

# ภาษาของ PDF ที่แนบเข้า Maximo — ต้องตรงกับ PDF_LANG ใน pm_maximo_out
# ไม่งั้นสร้างไว้คนละไฟล์กับที่ลิงก์ชี้ไป
PDF_LANG = os.getenv("MAXIMO_PDF_LANG", "th").strip() or "th"

# ชนิดใบงาน PM → template ใน pdf_routes1
TEMPLATE_OF = {
    "charger": "charger",
    "mdb": "mdb",
    "ccb": "ccb",
    "cbbox": "cbbox",
    "station": "station",
}


def _render(template: str, coll_key: str, report_id: str, lang: str) -> str:
    """
    เรนเดอร์จริง (บล็อก) — ให้ ensure_report_pdf เรียกผ่าน to_thread

    ตั้งใจ import ข้างในฟังก์ชัน: pdf_routes1 import main ส่วน main import routers
    ดึงไว้บนหัวไฟล์เมื่อไหร่ก็วน import ทันที
    """
    from pdf.pdf_routes1 import TEMPLATE_MAP
    from main import client1 as pymongo_client
    from routers.pm_helpers import UPLOADS_ROOT

    info = TEMPLATE_MAP[template]
    doc = pymongo_client[info["db"]][coll_key].find_one({"_id": ObjectId(report_id)})
    if not doc:
        raise ValueError(f"ไม่พบใบงาน {report_id} ใน {info['db']}/{coll_key}")

    cache_path = pathlib.Path(UPLOADS_ROOT) / "pdf_cache" / coll_key / f"{report_id}_{lang}.pdf"
    if cache_path.exists():
        return str(cache_path)

    # รูปในเอกสารอ้างด้วย path สัมพัทธ์ ต้องมี base URL ให้ตัวเรนเดอร์ไปดึงไฟล์
    # ปกติ route /pdf เติมให้จาก request แต่ตรงนี้ไม่มี request จึงอาศัย env
    if not os.environ.get("APP_BASE_URL"):
        base = os.getenv("PUBLIC_BASE_URL", os.getenv("FRONTEND_BASE_URL", "")).rstrip("/")
        if base:
            os.environ["APP_BASE_URL"] = base

    try:
        pdf_bytes = info["func"](doc, lang=lang)
    except TypeError:
        pdf_bytes = info["func"](doc)

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    # เขียนไฟล์ชั่วคราวก่อนแล้วค่อย rename — กันคนกดเปิดระหว่างเขียนแล้วได้ไฟล์ครึ่งใบ
    tmp = cache_path.with_suffix(".pdf.part")
    tmp.write_bytes(pdf_bytes)
    tmp.replace(cache_path)
    return str(cache_path)


async def ensure_report_pdf(kind: str, coll_key: str, report_id: Any, *, lang: str = "") -> dict:
    """
    สร้าง PDF ของใบงานเก็บเข้า cache ถ้ายังไม่มี

    ห้าม raise — ใบงานอนุมัติผ่านไปแล้ว จะให้ทั้ง request พังเพราะเรนเดอร์ PDF
    ไม่ได้นั้นไม่คุ้ม คืนผลไปให้ผู้เรียกเก็บลง log/response แทน

    สร้างภาษาเดียวโดยตั้งใจ — route /pdf จะลบรูปต้นฉบับทิ้งเมื่อมี cache ครบทั้ง
    th และ en ถ้าปั๊มทีเดียวสองภาษาตรงนี้ รูปจะหายตั้งแต่วินาทีที่อนุมัติ
    คนที่เปิดใบงานย้อนหลังจะไม่เหลืออะไรให้ดู
    """
    template = TEMPLATE_OF.get(kind)
    if not template:
        return {"ok": False, "reason": f"ไม่รู้จักชนิดใบงาน '{kind}'"}
    if not coll_key:
        return {"ok": False, "reason": "ไม่มี sn/station_id ของใบงาน"}

    lang = (lang or PDF_LANG).strip() or "th"
    try:
        path = await asyncio.to_thread(_render, template, coll_key, str(report_id), lang)
        return {"ok": True, "lang": lang, "path": path}
    except Exception as e:
        log.exception("สร้าง PDF ใบงาน PM ไม่สำเร็จ (%s/%s/%s)", kind, coll_key, report_id)
        return {"ok": False, "reason": f"{type(e).__name__}: {e}"}
