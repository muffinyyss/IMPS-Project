"""
services/cm_maximo.py
=====================
ผูกใบงาน CM ของ iMPS เข้ากับ interface ชุด EGAT_IESB_Payload_Structure_v1

ชั้นนี้ทำ 3 อย่าง
  1. master data  — cache ตาราง failure code (IN04) และรายชื่อช่าง (IN08) ลง MongoDB
                    ให้ฟอร์ม CM ดึงไปทำ dropdown ได้โดยไม่ต้องยิง Maximo ทุกครั้ง
  2. lifecycle    — hook ที่ routers/cmreport.py เรียกตามจังหวะของใบงาน
                    วางแผน → IN01, เปลี่ยนสถานะ → IN02, ปิดงาน → IN05 + IN09,
                    มีไฟล์แนบ → IN03
  3. bookkeeping  — บันทึกผลทุกครั้งไว้ที่ field maximo_sync ของใบงาน
                    ยิงไม่ผ่านก็ไม่ทำให้การบันทึกใบงานล้ม และยิงซ้ำได้ทีหลัง

หลักการ: ฟังก์ชัน push_* ทุกตัว "ไม่ raise" — Maximo ล่มต้องไม่ทำให้ช่างบันทึกงานไม่ได้
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import client, charger_collection, station_collection, users_collection
from services import maximo
from services.maximo import MaximoError

log = logging.getLogger("cm_maximo")

# ══════════════════════════════════════════════════════════════════
# Mapping ระหว่างรหัสของ iMPS กับของ Maximo
# ══════════════════════════════════════════════════════════════════
# ⚠️ รหัส failure class ที่ฟอร์ม CM ใช้ (DCCHARFC/ACCHARFC/STATFC) ไม่ตรงกับที่มีจริง
#    ใน Maximo (DCCHARGER/ACCHARGER/STATION) — ตรวจจาก ZAPIFAILURELIST บน DEV
#    ส่ง failurecode ผิดไป Maximo จะปฏิเสธทั้ง IN01 และ IN05 จึงต้อง map ตรงนี้
_DEFAULT_FAILURE_CLASS_MAP = {
    "DCCHARFC": "DCCHARGER",
    "ACCHARFC": "ACCHARGER",
    "STATFC": "STATION",
}

# สถานะใบงาน CM ฝั่ง iMPS → สถานะ WO ฝั่ง Maximo
#   Wait for approve (ด่าน cs)   → WAPPR  รออนุมัติ
#   Wait for schedule            → APPR   อนุมัติแล้ว รอจัดตาราง
#   In Progress                  → INPRG  กำลังดำเนินการ
#   Wait for approve (ด่านปิดงาน) → COMP   ซ่อมเสร็จ รออนุมัติปิด
#   Closed / Complete            → COMP   ปิดงาน (CLOSE ใน Maximo ปิดตายแก้ไม่ได้อีก
#                                          จึงหยุดที่ COMP ให้ EGAT เป็นคนกด CLOSE เอง)
#   Cancelled                    → CAN
_DEFAULT_STATUS_MAP = {
    "wait for approve": "WAPPR",
    "wait for schedule": "APPR",
    "in progress": "INPRG",
    "pending": "INPRG",
    "complete": "COMP",
    "closed": "COMP",
    "cancelled": "CAN",
}

# ผลซ่อมที่แปลว่า "ยังทำต่อไม่ได้" → สถานะรอฝั่ง Maximo
_WAIT_RESULT_STATUS = {
    "wo - wait for material": "WMATL",
    "wo - wait for spare part": "WMATL",
    "wo - wait for site condition": "WSCH",
}


def _json_env(name: str, default: dict) -> dict:
    """อ่าน mapping จาก env (JSON) — ตั้งค่าผิดรูปก็ยังเดินต่อด้วย default"""
    raw = os.getenv(name, "").strip()
    if not raw:
        return dict(default)
    try:
        loaded = json.loads(raw)
        if isinstance(loaded, dict):
            return {str(k).upper(): str(v) for k, v in loaded.items()}
    except json.JSONDecodeError:
        log.warning(f"{name} is not valid JSON — ใช้ค่า default แทน")
    return dict(default)


FAILURE_CLASS_MAP = _json_env("MAXIMO_FAILURE_CLASS_MAP", _DEFAULT_FAILURE_CLASS_MAP)

# ZAPIFAILURELIST คืน failure class ทั้งระบบ 19 ตัว ซึ่งส่วนใหญ่เป็นของงานอื่น/ของเทสต์
# (METER, MIC, ACRASH, LORATEST …) — ฟอร์ม CM ต้องเห็นเฉพาะของงาน EV
CM_FAILURE_CLASSES = [
    c.strip().upper()
    for c in os.getenv("MAXIMO_CM_FAILURE_CLASSES", "DCCHARGER,ACCHARGER,STATION").split(",")
    if c.strip()
]

# บทบาทของแต่ละ class — ฟอร์มหน้า open ใช้ตัดสินว่าสถานีนี้ควรเห็นตัวเลือกไหน
# (สถานีมีแต่ตู้ DC ก็ไม่ต้องโชว์ AC Charger Failure)
CM_CLASS_ROLES = {
    "dc": os.getenv("MAXIMO_CM_CLASS_DC", "DCCHARGER").strip().upper(),
    "ac": os.getenv("MAXIMO_CM_CLASS_AC", "ACCHARGER").strip().upper(),
    "station": os.getenv("MAXIMO_CM_CLASS_STATION", "STATION").strip().upper(),
}
STATUS_MAP = {k.lower(): v for k, v in
              _json_env("MAXIMO_CM_STATUS_MAP", _DEFAULT_STATUS_MAP).items()}

# ลิงก์ที่แนบเข้า Maximo ต้องเป็น URL ที่เปิดจากภายนอกได้ — ไฟล์ใน iMPS เก็บเป็น path
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", os.getenv("FRONTEND_BASE_URL", "")).rstrip("/")

# ภาษาของ PDF ที่แนบเข้า Maximo
MAXIMO_PDF_LANG = PDF_LANG = os.getenv("MAXIMO_PDF_LANG", "th").strip() or "th"

# เปิด/ปิดการยิงเข้า Maximo ของฝั่ง CM แยกจาก MAXIMO_ENABLED รวม
CM_MAXIMO_ENABLED = os.getenv("CM_MAXIMO_ENABLED", "true").lower() == "true"


def maximo_failure_class(faulty_equipment: Any) -> str:
    """FAILURECODE ที่ฟอร์ม CM เก็บ → failure class ของ Maximo"""
    code = str(faulty_equipment or "").strip().upper()
    if not code:
        return ""
    return FAILURE_CLASS_MAP.get(code, code)


def maximo_wo_status(imps_status: Any, repair_result: Any = None) -> str:
    """
    สถานะใบงาน CM → สถานะ WO ของ Maximo

    ผลซ่อมที่เป็นสถานะรอ (รออะไหล่/รอหน้างาน) มีความหมายชัดกว่า status จึงใช้ก่อน
    """
    wait = _WAIT_RESULT_STATUS.get(str(repair_result or "").strip().lower())
    if wait:
        return wait
    return STATUS_MAP.get(str(imps_status or "").strip().lower(), "")


# ══════════════════════════════════════════════════════════════════
# Collections
# ══════════════════════════════════════════════════════════════════
def _failure_coll():
    """iMPS.maximo_failure_codes — cache ของ IN04 (motor async)"""
    return client["iMPS"]["maximo_failure_codes"]


def _labor_coll():
    """iMPS.maximo_labor — cache ของ IN08 (motor async)"""
    return client["iMPS"]["maximo_labor"]


# ══════════════════════════════════════════════════════════════════
# Seed — ชั้นสุดท้ายกันฟอร์มว่าง
# ══════════════════════════════════════════════════════════════════
# ปกติ dropdown อ่านจาก cache ใน MongoDB ซึ่งอยู่ข้ามการ restart อยู่แล้ว
# เคสเดียวที่ cache ว่างคือเครื่องที่ยังไม่เคย sync สำเร็จเลยสักครั้ง (เพิ่ง deploy /
# เพิ่งล้าง DB) แล้ว Maximo ดันล่มพอดี — ไฟล์ seed ที่ติดมากับ repo คือทางออกของเคสนี้
#
# seed สร้างจาก Maximo ด้วยสคริปต์ ไม่ใช่ตารางที่คนมานั่งดูแลเอง:
#     python backend/scripts/dump_maximo_seed.py
SEED_DIR = Path(__file__).resolve().parents[1] / "data"
FAILURE_SEED_FILE = SEED_DIR / "maximo_failure_codes.seed.json"
LABOR_SEED_FILE = SEED_DIR / "maximo_labor.seed.json"


def _read_seed(path: Path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        log.warning(f"  ⚠️ อ่าน seed {path.name} ไม่ได้: {e}")
        return None


async def restore_from_seed() -> dict:
    """
    เติม cache จากไฟล์ seed — ใช้เฉพาะตอน cache ว่างและ Maximo เรียกไม่ได้

    ไม่เขียนทับของที่มีอยู่แล้วเด็ดขาด (ของใน DB สดกว่า seed เสมอ)
    """
    out = {"failure_codes": 0, "labor": 0}

    if not await _failure_coll().count_documents({}, limit=1):
        seed = _read_seed(FAILURE_SEED_FILE)
        if seed and seed.get("matrix"):
            await _failure_coll().replace_one(
                {"_id": "failure_codes"},
                {**seed, "_id": "failure_codes", "from_seed": True,
                 "syncedAt": datetime.now(timezone.utc)},
                upsert=True,
            )
            out["failure_codes"] = len(seed.get("matrix") or [])

    if not await _labor_coll().count_documents({}, limit=1):
        seed = _read_seed(LABOR_SEED_FILE)
        if isinstance(seed, list) and seed:
            now = datetime.now(timezone.utc)
            for p in seed:
                if not p.get("personid"):
                    continue
                await _labor_coll().update_one(
                    {"_id": p["personid"]},
                    {"$set": {**p, "from_seed": True, "syncedAt": now}},
                    upsert=True,
                )
            out["labor"] = len(seed)

    if out["failure_codes"] or out["labor"]:
        log.info(f"  🌱 เติม master data จาก seed: {out}")
    return out


# ══════════════════════════════════════════════════════════════════
# IN04 — ตาราง failure code (failure class → problem → cause → remedy)
# ══════════════════════════════════════════════════════════════════
def _node_code(node: dict) -> tuple[str, str]:
    """node ของ ZAPIFAILURELIST เก็บรหัสไว้ใน child collection failurecode[0]"""
    fc = node.get("failurecode")
    if isinstance(fc, list) and fc:
        return (fc[0].get("failurecode") or "").strip(), (fc[0].get("description") or "").strip()
    if isinstance(fc, str):
        return fc.strip(), (node.get("flcdescription") or "").strip()
    return "", ""


def build_failure_tree(nodes: list[dict]) -> dict:
    """
    ประกอบ node แบน ๆ จาก Maximo เป็นโครง 4 ชั้นที่ฟอร์ม CM ใช้ทำ dropdown ต่อกัน

    Returns:
        {
          "classes": [{"code": "DCCHARGER", "description": "DC Charger Failure",
                       "problems": [{"code": "…", "description": "…",
                                     "causes": [{"code": "…", "description": "…",
                                                 "remedies": [{"code","description"}]}]}]}],
          "matrix": [[failure, problem, cause, remedy], …]   ← แบนไว้ให้ค้นง่าย
        }
    """
    by_id: dict[Any, dict] = {}
    children: dict[Any, list[dict]] = {}
    for n in nodes:
        by_id[n.get("failurelist")] = n
        children.setdefault(n.get("parent"), []).append(n)

    def pack(node: dict, key: str) -> dict:
        code, desc = _node_code(node)
        return {"code": code, "description": desc, key: []}

    classes: list[dict] = []
    matrix: list[list[str]] = []

    for root in children.get(None, []):
        cls = pack(root, "problems")
        if not cls["code"]:
            continue
        for p_node in children.get(root.get("failurelist"), []):
            prob = pack(p_node, "causes")
            if not prob["code"]:
                continue
            for c_node in children.get(p_node.get("failurelist"), []):
                cause = pack(c_node, "remedies")
                if not cause["code"]:
                    continue
                for r_node in children.get(c_node.get("failurelist"), []):
                    r_code, r_desc = _node_code(r_node)
                    if not r_code:
                        continue
                    cause["remedies"].append({"code": r_code, "description": r_desc})
                    matrix.append([cls["code"], prob["code"], cause["code"], r_code])
                if not cause["remedies"]:
                    matrix.append([cls["code"], prob["code"], cause["code"], ""])
                prob["causes"].append(cause)
            if not prob["causes"]:
                matrix.append([cls["code"], prob["code"], "", ""])
            cls["problems"].append(prob)
        classes.append(cls)

    return {"classes": classes, "matrix": matrix}


async def sync_failure_codes(force: bool = False) -> dict:
    """
    ดึง IN04 มาเก็บลง iMPS.maximo_failure_codes (เอกสารเดียว ทับของเดิม)

    ⚠️ ป้องกันการทับ cache ที่ดีอยู่แล้วด้วยข้อมูลพัง — Maximo ตอบ 200 พร้อม member
    ว่าง/ไม่ครบได้ (ช่วง maintenance, สิทธิ์ถูกแก้) ถ้าเขียนทับตรง ๆ dropdown จะว่าง
    ทั้งระบบทันที ทั้งที่ของเดิมยังใช้ได้ — เจอแบบนั้นให้คงของเดิมไว้แล้ว log เตือน
    force=True ข้ามการป้องกัน (ใช้ตอนตารางฝั่ง Maximo ถูกตัดจริง ๆ)
    """
    nodes = await maximo.query_failure_list()
    tree = build_failure_tree(nodes)
    cached = await _failure_coll().find_one({"_id": "failure_codes"})

    if not force:
        cached_rows = len((cached or {}).get("matrix") or [])
        new_rows = len(tree["matrix"])
        if new_rows == 0:
            log.warning("  ⚠️ Maximo คืน failure code ว่าง — คง cache เดิมไว้ ไม่เขียนทับ")
            return cached or {"classes": [], "matrix": []}
        # หดเกินครึ่ง = ผิดปกติ ตารางนี้แทบไม่เปลี่ยน
        if cached_rows and new_rows < cached_rows / 2:
            log.warning(
                f"  ⚠️ failure code หดจาก {cached_rows} เหลือ {new_rows} แถว — "
                f"คง cache เดิมไว้ (สั่ง force ถ้าตัดออกจริง)"
            )
            return cached

    doc = {
        "_id": "failure_codes",
        **tree,
        "node_count": len(nodes),
        "syncedAt": datetime.now(timezone.utc),
    }
    await _failure_coll().replace_one({"_id": "failure_codes"}, doc, upsert=True)
    log.info(
        f"  🧩 failure codes synced: {len(tree['classes'])} classes / "
        f"{len(tree['matrix'])} rows"
    )
    return doc


async def get_failure_codes(refresh: bool = False) -> dict:
    """
    อ่านตาราง failure code สำหรับฟอร์ม CM

    refresh=True หรือยังไม่เคย sync → ยิง Maximo ใหม่
    ยิงไม่ผ่านแต่มี cache เดิม → คืน cache (ฟอร์มยังกรอกงานต่อได้)
    """
    cached = None if refresh else await _failure_coll().find_one({"_id": "failure_codes"})
    if cached:
        return cached
    try:
        return await sync_failure_codes()
    except MaximoError as e:
        log.warning(f"  ⚠️ failure code sync failed: {e}")
        fallback = await _failure_coll().find_one({"_id": "failure_codes"})
        if fallback:
            return {**fallback, "stale": True, "error": str(e)}
        return {"classes": [], "matrix": [], "error": str(e)}


# ══════════════════════════════════════════════════════════════════
# IN08 — รายชื่อช่าง (labor list) + การจับคู่กับ user ของ iMPS
# ══════════════════════════════════════════════════════════════════
def _normalize_person(raw: dict) -> dict:
    return {
        "personid": (raw.get("personid") or "").strip(),
        "displayname": (raw.get("displayname") or "").strip(),
        "email": (raw.get("primaryemail") or "").strip(),
        "status": (raw.get("status") or "").strip(),
    }


async def sync_labor() -> list[dict]:
    """ดึง IN08 มาเก็บลง iMPS.maximo_labor (upsert ตาม personid)"""
    members = await maximo.query_labor()
    coll = _labor_coll()
    now = datetime.now(timezone.utc)
    people = [p for p in map(_normalize_person, members) if p["personid"]]
    for p in people:
        await coll.update_one(
            {"_id": p["personid"]},
            {"$set": {**p, "syncedAt": now}},
            upsert=True,
        )
    log.info(f"  👷 labor list synced: {len(people)} persons")
    return people


async def _cached_labor() -> list[dict]:
    docs = await _labor_coll().find(
        {}, {"_id": 0, "syncedAt": 0}
    ).sort("personid", 1).to_list(length=1000)
    return docs


async def get_labor(refresh: bool = False) -> list[dict]:
    """รายชื่อช่างสำหรับ dropdown มอบหมายงาน — cache first เหมือน failure code"""
    if not refresh:
        cached = await _cached_labor()
        if cached:
            return cached
    try:
        return await sync_labor()
    except MaximoError as e:
        log.warning(f"  ⚠️ labor sync failed: {e}")
        return await _cached_labor()


def _user_maximo_fields(username: str) -> dict:
    try:
        return users_collection.find_one(
            {"username": (username or "").strip()},
            {"maximo_personid": 1, "maximo_laborcode": 1, "employee_id": 1},
        ) or {}
    except Exception:
        return {}


def resolve_person_id(username: str) -> str:
    """
    iMPS username → Maximo personid (ใช้กับ reportedby / supervisor)

    ไล่ตามลำดับ: field maximo_personid ที่ผูกไว้ในโปรไฟล์ → employee_id → username เอง
    (ผู้ใช้ EGAT ส่วนใหญ่ใช้รหัสพนักงานเป็น username อยู่แล้ว)
    """
    name = (username or "").strip()
    if not name:
        return ""
    user = _user_maximo_fields(name)
    return str(user.get("maximo_personid") or user.get("employee_id") or name).strip()


def resolve_labor_code(username: str) -> str:
    """
    iMPS username → Maximo laborcode (ใช้กับ IN09 ลงเวลาทำงาน)

    ⚠️ PERSON กับ LABOR เป็นคนละ object ใน Maximo — personid ที่ IN08 คืนมา
    ส่วนใหญ่ "ไม่มี" เรคคอร์ด LABOR (บน DEV มีแค่ 5 จาก 29 คน) ส่งไปตรง ๆ จะโดน
    BMXAA2627E invalidlaborcode จึงต้องผูก users.maximo_laborcode ไว้ให้ชัด
    ไม่ได้ผูกไว้ = คืนค่าว่าง ให้ผู้เรียกข้ามคนนั้นแล้วรายงานว่ายัง map ไม่ครบ
    """
    name = (username or "").strip()
    if not name:
        return ""
    user = _user_maximo_fields(name)
    code = user.get("maximo_laborcode")
    if code:
        return str(code).strip()
    # ไม่ได้ผูกไว้ — เดาจากรหัสพนักงานได้ แต่ต้องมีอยู่ในตาราง labor ที่ sync มาจริง
    guess = str(user.get("maximo_personid") or user.get("employee_id") or name).strip()
    return guess if LABOR_CODES_KNOWN and guess in LABOR_CODES_KNOWN else ""


# laborcode ที่ยืนยันแล้วว่ามีจริง (เติมจาก sync_labor / ตั้งเองผ่าน env)
LABOR_CODES_KNOWN: set[str] = {
    c.strip() for c in os.getenv("MAXIMO_LABOR_CODES", "").split(",") if c.strip()
}

# laborcode กลางของผู้รับเหมา — ไม่ได้ผูกกับคนใดคนหนึ่ง ต้องให้ช่างพิมพ์ชื่อจริงมาเอง
# แล้วแนบไปใน memo ของ labtrans ไม่งั้น Maximo จะไม่รู้ว่าใครมาทำงาน
CONTRACTOR_LABOR_CODE = os.getenv("MAXIMO_CONTRACTOR_LABOR_CODE", "EVCONTRACTOR").strip().upper()


# laborcode ที่ใช้ได้จริง + ชื่อคน — ให้ฟอร์มเอาไปทำ dropdown ให้ช่างเลือกเอง
# (ทางเดิมคือผูก users.maximo_laborcode ล่วงหน้า ซึ่งยังไม่ได้ทำครบ)
_labor_code_cache: dict[str, Any] = {"items": None}


async def get_labor_codes(refresh: bool = False) -> list[dict]:
    """
    [{laborcode, name, needs_name}] ของคนที่ลงเวลาเข้า Maximo ได้จริง

    ที่มา 2 ทาง รวมกัน:
      1. MXLABOR (เรคคอร์ด LABOR จริง) ∩ ZAPIPERSON ของ cost center EV
         — เอาเฉพาะคนในหน่วยงาน EV ที่มีสิทธิ์ลงเวลา ไม่เอาทั้งองค์กร
      2. env MAXIMO_LABOR_CODES — รหัสกลางอย่าง EVCONTRACTOR ที่ไม่มีใน PERSON

    ดึงจาก Maximo ไม่สำเร็จก็ยังคืนรายการจาก env ให้เลือกได้ ไม่ปล่อย dropdown ว่าง
    """
    if _labor_code_cache["items"] is not None and not refresh:
        return _labor_code_cache["items"]

    names: dict[str, str] = {}
    codes: list[str] = []

    if CM_MAXIMO_ENABLED:
        try:
            labor, people = await asyncio.gather(
                maximo.query_labor_records(),
                get_labor(refresh=refresh),
                return_exceptions=True,
            )
            if isinstance(labor, Exception):
                raise labor

            # personid ของคนใน cost center EV + ชื่อไว้โชว์
            ev_people: dict[str, str] = {}
            if not isinstance(people, Exception):
                for p in people:
                    pid = str(p.get("personid") or "").strip()
                    if pid:
                        ev_people[pid] = str(p.get("displayname") or "").strip()

            for row in labor:
                lc = str(row.get("laborcode") or "").strip()
                pid = str(row.get("personid") or "").strip()
                if not lc:
                    continue
                # ไม่มีรายชื่อ EV ให้เทียบ (IN08 ล้ม) = เอาทั้งหมดไว้ก่อน ดีกว่าไม่มีให้เลือก
                if ev_people and pid not in ev_people and lc not in ev_people:
                    continue
                codes.append(lc)
                names[lc] = ev_people.get(pid) or ev_people.get(lc) or lc
        except Exception as e:
            log.warning(f"  ⚠️ ดึง labor จาก Maximo ไม่สำเร็จ ใช้ค่าจาก env แทน: {e}")

    # รหัสกลางที่ตั้งไว้ใน env — เติมตัวที่ยังไม่มี
    for c in sorted(LABOR_CODES_KNOWN):
        if c not in codes:
            codes.append(c)
            names.setdefault(c, c)

    items = [{
        "laborcode": c,
        "name": names.get(c) or c,
        # รหัสกลางของผู้รับเหมา — ฟอร์มต้องขึ้นช่องให้กรอกชื่อจริงเพิ่ม
        "needs_name": c.upper() == CONTRACTOR_LABOR_CODE,
    } for c in sorted(set(codes), key=lambda x: (x.upper() == CONTRACTOR_LABOR_CODE, x))]
    _labor_code_cache["items"] = items
    return items


# ══════════════════════════════════════════════════════════════════
# Location — ใบงาน CM ผูกกับ Maximo location ตัวไหน
# ══════════════════════════════════════════════════════════════════
def resolve_location(station_id: str, faulty_equipment: str = "") -> str:
    """
    หา maximo_location ของใบงาน — ระดับตู้ก่อน ถ้าไม่มีค่อยใช้ระดับสถานี
    (กติกาเดียวกับ auto_cm_watcher และ /cmreport/submit เดิม)
    """
    station_id = (station_id or "").strip()
    if not station_id:
        return ""

    equip = (faulty_equipment or "").strip()
    if equip.startswith("charger_"):
        no = equip.replace("charger_", "")
        query: dict[str, Any] = {"station_id": station_id, "$or": [
            {"charger_no": no}, {"charger_id": no},
        ]}
        if no.isdigit():
            query["$or"].append({"chargerNo": int(no)})
        try:
            charger = charger_collection.find_one(query) or {}
            loc = (charger.get("maximo_location") or "").strip()
            if loc:
                return loc
        except Exception as e:
            log.debug(f"charger location lookup failed: {e}")

    st = station_collection.find_one(
        {"station_id": station_id}, {"maximo_location": 1}
    ) or {}
    return (st.get("maximo_location") or "").strip()


def public_url(path: str) -> str:
    """path ของไฟล์ใน iMPS → URL เต็มที่ Maximo เปิดได้"""
    p = (path or "").strip()
    if not p or p.startswith(("http://", "https://")):
        return p
    if not PUBLIC_BASE_URL:
        return ""
    return f"{PUBLIC_BASE_URL}/{p.lstrip('/')}"


def report_url(report: dict, report_id: Any) -> str:
    """
    ลิงก์ PDF ใบงาน CM — ใช้แนบเข้า Maximo (IN03)

    แนบตัวเอกสาร PDF ไม่ใช่หน้าเว็บ คนที่เปิดจาก Maximo จะได้ไฟล์เลย
    ไม่ต้อง login เข้า iMPS ก่อน
    """
    station_id = report.get("station_id") or ""
    if not station_id or not PUBLIC_BASE_URL:
        return ""
    qs = f"station_id={station_id}&lang={PDF_LANG}&dl=true"
    issue_id = str(report.get("issue_id") or "").strip()
    # ลิงก์ตรงไปที่ไฟล์ (.pdf) — /export เป็นแค่ตัว 307 redirect มาที่นี่อีกที
    # client ที่ไม่ตาม redirect จะได้ไฟล์เลย และชื่อไฟล์อ่านออกตอนเซฟ
    if issue_id:
        return f"{PUBLIC_BASE_URL}/pdf/cm/{report_id}/{issue_id}.pdf?{qs}"
    return f"{PUBLIC_BASE_URL}/pdf/cm/{report_id}/export?{qs}"


# ══════════════════════════════════════════════════════════════════
# Bookkeeping — จดผลการยิงแต่ละ interface ไว้ที่ใบงาน
# ══════════════════════════════════════════════════════════════════
async def _record(coll, report_id, interface: str, ok: bool, **detail) -> None:
    """เขียนผลลง maximo_sync.<interface> — ล้มเหลวตรงนี้ไม่ควรกระทบใบงาน"""
    entry = {
        "ok": ok,
        "at": datetime.now(timezone.utc),
        **{k: v for k, v in detail.items() if v is not None},
    }
    try:
        await coll.update_one({"_id": report_id}, {"$set": {f"maximo_sync.{interface}": entry}})
    except Exception as e:
        log.warning(f"  ⚠️ record maximo_sync.{interface} failed: {e}")


def _trace(trace: dict) -> dict:
    """ยัด request/response ที่คุยกับ Maximo ลง maximo_sync — ดูได้จากหน้า sync"""
    if not trace:
        return {}
    return {"maximo_request": trace.get("request"),
            "maximo_response": trace.get("response"),
            "http": trace.get("http")}


def _no_ok(detail: dict) -> dict:
    """
    ตัด key `ok` ออกก่อนกระจายเข้า _record()

    _fail()/_skip() คืน dict ที่มี `ok` อยู่แล้ว พอเอาไป `**result` ต่อท้าย
    _record(..., ok, **result) จะชน "got multiple values for argument 'ok'"
    (พังตั้งแต่ตอนเรียก ดักใน _record ไม่ทัน)
    """
    return {k: v for k, v in detail.items() if k != "ok"}


def _skip(reason: str) -> dict:
    return {"ok": False, "skipped": True, "reason": reason}


def _ok(**detail) -> dict:
    return {"ok": True, **detail}


def _fail(e: Exception) -> dict:
    detail = {"ok": False, "error": str(e)}
    if isinstance(e, MaximoError) and e.body:
        detail["body"] = e.body
    return detail


def _err_detail(e: Exception) -> str:
    """ข้อความ error + body ดิบจาก Maximo — body คือที่มีรหัส BMXAA บอกสาเหตุจริง"""
    msg = str(e)
    body = getattr(e, "body", "") or ""
    return f"{msg} | {body[:400]}" if body else msg


def _as_list(value: Any) -> list[str]:
    """ฟิลด์ปัญหา/สาเหตุ/การแก้ไข เก็บได้ทั้ง list และ string (ใบงานเก่า)"""
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v or "").strip()]
    s = str(value or "").strip()
    return [s] if s else []


def _combine(date_str: Any, time_str: Any) -> str:
    """"2026-08-06" + "09:30" → "2026-08-06T09:30" (ขาดเวลาก็คืนแค่วันที่)"""
    d = str(date_str or "").strip()[:10]
    if not d:
        return ""
    t = str(time_str or "").strip()[:5]
    return f"{d}T{t}" if t else d


# ══════════════════════════════════════════════════════════════════
# IN01 — เปิด Work Order ตอน planner วางแผน
# ══════════════════════════════════════════════════════════════════
async def ensure_work_order(coll, report_id, report: dict) -> dict:
    """
    สร้าง Maximo WO ให้ใบงานนี้ถ้ายังไม่มี (idempotent — เรียกซ้ำได้)

    เรียกตอน planner วางแผนเสร็จ ไม่ว่าจะลงเอยเป็น wait for scheduled /
    wait for material / wait for site condition ก็ตาม — ทั้งสามแบบคือ "รับงานแล้ว"
    """
    if not CM_MAXIMO_ENABLED:
        return _skip("CM_MAXIMO_ENABLED=false")
    if report.get("maximo_wonum"):
        return _ok(wonum=report["maximo_wonum"], existing=True)

    station_id = report.get("station_id") or ""
    location = resolve_location(station_id, report.get("faulty_equipment") or "")
    if not location:
        result = _skip("สถานี/ตู้นี้ยังไม่ได้ผูก maximo_location")
        await _record(coll, report_id, "IN01", False, **_no_ok(result))
        return result

    st = station_collection.find_one(
        {"station_id": station_id}, {"station_name": 1}
    ) or {}
    station_name = st.get("station_name") or station_id
    issue_id = report.get("issue_id") or ""
    description = f"[iMPS CM {issue_id}] {station_name} — {report.get('problem_details') or ''}"

    assignees = _as_list(report.get("assignees"))
    trace: dict = {}
    try:
        data = await maximo.create_workorder(
            description=description,
            location=location,
            severity=report.get("severity") or "Medium",
            sched_start=report.get("sched_start"),
            sched_finish=report.get("sched_finish"),
            reported_by=resolve_person_id(report.get("reported_by") or ""),
            supervisor=resolve_person_id(report.get("inspector") or "") or None,
            failure_code=maximo_failure_class(report.get("faulty_equipment")),
            imps_wonum=issue_id,
            trace=trace,
        )
    except MaximoError as e:
        log.warning(f"  ⚠️ IN01 create WO failed ({issue_id}): {_err_detail(e)}")
        result = _fail(e)
        await _record(coll, report_id, "IN01", False, **_no_ok(result), **_trace(trace))
        return result

    wonum = str(data.get("wonum") or "").strip()
    await coll.update_one(
        {"_id": report_id},
        {"$set": {"maximo_wonum": wonum, "maximo_location": location}},
    )
    await _record(coll, report_id, "IN01", True, wonum=wonum, location=location,
                  assignees=assignees or None, **_trace(trace))
    return _ok(wonum=wonum, location=location)


# ══════════════════════════════════════════════════════════════════
# IN02 — ส่งสถานะที่เปลี่ยนไปให้ Maximo
# ══════════════════════════════════════════════════════════════════
async def push_status(coll, report_id, report: dict, *, memo: str = "") -> dict:
    """ส่งสถานะปัจจุบันของใบงานไป Maximo — ไม่มี WO หรือ map สถานะไม่ได้ก็ข้าม"""
    if not CM_MAXIMO_ENABLED:
        return _skip("CM_MAXIMO_ENABLED=false")

    wonum = (report.get("maximo_wonum") or "").strip()
    if not wonum:
        return _skip("ใบงานนี้ยังไม่มี Maximo WO")

    status = maximo_wo_status(report.get("status"), report.get("repair_result"))
    if not status:
        return _skip(f"ไม่มี mapping ของสถานะ {report.get('status')!r}")
    # ยิงซ้ำสถานะเดิมไม่มีประโยชน์ และ Maximo จะ error ว่าเปลี่ยนสถานะเป็นค่าเดิมไม่ได้
    if (report.get("maximo_sync") or {}).get("IN02", {}).get("status") == status:
        return _ok(status=status, unchanged=True)

    trace: dict = {}
    try:
        await maximo.update_wo_status(wonum, status, memo=memo, trace=trace)
    except MaximoError as e:
        log.warning(f"  ⚠️ IN02 status push failed (WO {wonum} → {status}): {e}")
        result = _fail(e)
        await _record(coll, report_id, "IN02", False, wonum=wonum, status=status,
                      **_no_ok(result), **_trace(trace))
        return result

    await _record(coll, report_id, "IN02", True, wonum=wonum, status=status, **_trace(trace))
    return _ok(wonum=wonum, status=status)


# ══════════════════════════════════════════════════════════════════
# IN03 — แนบลิงก์เอกสาร/รูปเข้ากับ WO
# ══════════════════════════════════════════════════════════════════
async def push_attachment(
    coll, report_id, report: dict, url: str, *, name: str = "", description: str = ""
) -> dict:
    """แนบลิงก์ 1 รายการเข้ากับ WO ของใบงาน (ใช้กับ PDF ใบงานและรูปหน้างาน)"""
    if not CM_MAXIMO_ENABLED:
        return _skip("CM_MAXIMO_ENABLED=false")

    wonum = (report.get("maximo_wonum") or "").strip()
    if not wonum:
        return _skip("ใบงานนี้ยังไม่มี Maximo WO")

    link = public_url(url)
    if not link:
        return _skip("ตั้งค่า PUBLIC_BASE_URL ก่อน ถึงจะสร้างลิงก์ที่ Maximo เปิดได้")

    trace: dict = {}
    try:
        await maximo.attach_wo_link(
            wonum, link,
            name=name or f"{report.get('issue_id') or 'CM'}.pdf",
            description=description or f"iMPS CM {report.get('doc_name') or ''}",
            trace=trace,
        )
    except MaximoError as e:
        log.warning(f"  ⚠️ IN03 attach failed (WO {wonum}): {_err_detail(e)}")
        result = _fail(e)
        await _record(coll, report_id, "IN03", False, wonum=wonum, url=link,
                      **_no_ok(result), **_trace(trace))
        return result

    await _record(coll, report_id, "IN03", True, wonum=wonum, url=link, **_trace(trace))
    return _ok(wonum=wonum, url=link)


# ══════════════════════════════════════════════════════════════════
# IN05 — ส่งผลวิเคราะห์ปัญหา/สาเหตุ/การแก้ไข
# ══════════════════════════════════════════════════════════════════
def failure_rows(report: dict) -> list[dict]:
    """
    ประกอบชุด (problem, cause, remedy) ที่จะส่งเข้า Maximo จากใบงาน

    ฟอร์มเก็บสามฟิลด์นี้เป็น list แยกกัน (1 ใบมีได้หลายปัญหา/หลายสาเหตุ)
    จับคู่ตามตำแหน่งก่อน ตำแหน่งที่เกินมาให้ใช้ตัวสุดท้ายของอีกฝั่งแทน
    """
    problems = _as_list(report.get("problem_type"))
    causes = _as_list(report.get("cause"))
    remedies = _as_list(report.get("repaired_equipment"))

    depth = max(len(problems), len(causes), len(remedies))
    if depth == 0:
        return []

    def at(lst: list[str], i: int) -> str | None:
        if not lst:
            return None
        return lst[i] if i < len(lst) else lst[-1]

    rows = []
    seen = set()
    for i in range(depth):
        row = {
            "problem_code": at(problems, i),
            "cause_code": at(causes, i),
            "remedy_code": at(remedies, i),
        }
        key = tuple(row.values())
        if key in seen:
            continue
        seen.add(key)
        rows.append(row)
    return rows


async def push_failure_report(coll, report_id, report: dict) -> dict:
    """ส่ง IN05 ทุกชุดของใบงาน — ส่งได้บางชุดก็ถือว่าไม่สำเร็จทั้งหมด รอ retry"""
    if not CM_MAXIMO_ENABLED:
        return _skip("CM_MAXIMO_ENABLED=false")

    wonum = (report.get("maximo_wonum") or "").strip()
    if not wonum:
        return _skip("ใบงานนี้ยังไม่มี Maximo WO")

    failure_code = maximo_failure_class(report.get("faulty_equipment"))
    if not failure_code:
        return _skip("ใบงานไม่ได้ระบุอุปกรณ์ที่เสีย (failure code)")

    rows = failure_rows(report)
    if not rows:
        return _skip("ยังไม่มีข้อมูลปัญหา/สาเหตุ/การแก้ไข")

    fail_date = _combine(report.get("found_date"), report.get("found_time"))
    sent, errors = 0, []
    trace: dict = {}
    for row in rows:
        try:
            await maximo.report_wo_failure(
                wonum,
                failure_code=failure_code,
                remarks=report.get("inprogress_remarks") or report.get("problem_details"),
                fail_date=fail_date or None,
                trace=trace,
                **row,
            )
            sent += 1
        except MaximoError as e:
            log.warning(f"  ⚠️ IN05 failure report failed (WO {wonum}): {_err_detail(e)}")
            errors.append(_err_detail(e))

    ok = sent == len(rows)
    await _record(coll, report_id, "IN05", ok, wonum=wonum, sent=sent,
                  total=len(rows), errors=errors or None,
                  failure_code=failure_code, **_trace(trace))
    return _ok(wonum=wonum, sent=sent) if ok else {
        "ok": False, "wonum": wonum, "sent": sent, "total": len(rows), "errors": errors
    }


# ══════════════════════════════════════════════════════════════════
# IN09 — ลงเวลาทำงานจริงของช่าง
# ══════════════════════════════════════════════════════════════════
async def push_labor_time(coll, report_id, report: dict) -> dict:
    """
    ลงเวลาช่างทุกคนที่ถูกมอบหมาย โดยใช้ช่วงเวลาซ่อมจริงของใบงาน
    (start_repair_date/time → resolved_date/time)
    """
    if not CM_MAXIMO_ENABLED:
        return _skip("CM_MAXIMO_ENABLED=false")

    wonum = (report.get("maximo_wonum") or "").strip()
    if not wonum:
        return _skip("ใบงานนี้ยังไม่มี Maximo WO")

    start = _combine(report.get("start_repair_date"), report.get("start_repair_time"))
    finish = _combine(report.get("resolved_date"), report.get("resolved_time"))
    if not start:
        return _skip("ยังไม่มีวันเวลาเริ่มซ่อม")

    # ช่างเลือก laborcode เองในฟอร์ม = ใช้ตรง ๆ ไม่ต้องพึ่ง users.maximo_laborcode
    picked = _as_list(report.get("maximo_labor"))
    if picked:
        valid = [c for c in picked if not LABOR_CODES_KNOWN or c in LABOR_CODES_KNOWN]
        unknown = [c for c in picked if c not in valid]
        sent, errors = 0, []
        location = report.get("maximo_location") or resolve_location(
            report.get("station_id") or "", report.get("faulty_equipment") or ""
        )
        contractor = str(report.get("maximo_contractor") or "").strip()
        trace: dict = {}
        for labor in valid:
            memo = f"iMPS CM {report.get('issue_id') or ''}"
            # EVCONTRACTOR เป็นรหัสกลาง — ต่อชื่อผู้รับเหมาจริงเข้าไปใน memo
            if labor.upper() == CONTRACTOR_LABOR_CODE and contractor:
                memo = f"{memo} — {contractor}"
            try:
                await maximo.create_labtrans(
                    wonum, labor, start=start, finish=finish or None,
                    location=location or None,
                    memo=memo, trace=trace,
                )
                sent += 1
            except MaximoError as e:
                log.warning(f"  ⚠️ IN09 labtrans failed (WO {wonum} / {labor}): {_err_detail(e)}")
                errors.append(f"{labor}: {_err_detail(e)}")
        ok = sent > 0 and not errors and not unknown
        await _record(coll, report_id, "IN09", ok, wonum=wonum, sent=sent,
                      total=len(picked), errors=errors or None, unmapped=unknown or None,
                      source="form", **_trace(trace))
        if ok:
            return _ok(wonum=wonum, sent=sent)
        return {"ok": False, "wonum": wonum, "sent": sent, "total": len(picked),
                "errors": errors, "unmapped": unknown}

    assignees = _as_list(report.get("assignees")) or _as_list(report.get("inspector"))
    if not assignees:
        return _skip("ใบงานยังไม่มีช่างที่รับผิดชอบ")

    location = report.get("maximo_location") or resolve_location(
        report.get("station_id") or "", report.get("faulty_equipment") or ""
    )

    sent, errors, unmapped = 0, [], []
    for username in assignees:
        labor = resolve_labor_code(username)
        if not labor:
            # ยังไม่ได้ผูก users.maximo_laborcode — ยิงไปก็โดน BMXAA2627E เปล่า ๆ
            unmapped.append(username)
            continue
        try:
            await maximo.create_labtrans(
                wonum, labor,
                start=start, finish=finish or None,
                location=location or None,
                memo=f"iMPS CM {report.get('issue_id') or ''}",
            )
            sent += 1
        except MaximoError as e:
            log.warning(f"  ⚠️ IN09 labtrans failed (WO {wonum} / {labor}): {_err_detail(e)}")
            errors.append(f"{username}: {_err_detail(e)}")

    ok = sent > 0 and not errors and not unmapped
    await _record(coll, report_id, "IN09", ok, wonum=wonum, sent=sent,
                  total=len(assignees), errors=errors or None, unmapped=unmapped or None)
    return _ok(wonum=wonum, sent=sent) if ok else {
        "ok": False, "wonum": wonum, "sent": sent, "total": len(assignees),
        "errors": errors, "unmapped": unmapped,
    }


# ══════════════════════════════════════════════════════════════════
# Orchestrator — routers/cmreport.py เรียกตัวนี้ตัวเดียวหลังบันทึกใบงาน
# ══════════════════════════════════════════════════════════════════
# ผลซ่อมที่แปลว่า planner วางแผนเสร็จแล้ว (ทั้งสามแบบ = รับงานเข้าระบบแล้ว)
PLANNED_RESULTS = {
    "wo - wait for scheduled",
    "wo - wait for material",
    "wo - wait for spare part",
    "wo - wait for site condition",
}

# สถานะที่ถือว่างานจบ → ส่งผลวิเคราะห์ + เวลาช่างเข้า Maximo
CLOSING_STATUSES = {"complete", "closed"}

# หน่วงระหว่าง interface ตอนปิดงาน — EGAT ระบุว่าส่งพร้อมกันไม่ได้ ต้องรอให้
# Maximo commit เส้นก่อนหน้าให้เสร็จก่อน ไม่งั้นเส้นถัดไปอาจเห็นข้อมูลไม่ครบ
MAXIMO_STEP_DELAY = float(os.getenv("MAXIMO_STEP_DELAY", "2"))


async def _settle() -> None:
    """รอ Maximo commit เส้นที่เพิ่งยิงไป ก่อนยิงเส้นถัดไป"""
    if MAXIMO_STEP_DELAY > 0:
        await asyncio.sleep(MAXIMO_STEP_DELAY)


def is_planning_save(report: dict) -> bool:
    """
    ใบงานผ่านขั้นวางแผนของ planner แล้วหรือยัง

    วางแผนเสร็จ = เปิด WO ได้เลย ไม่ต้องรอว่ามอบหมายช่างแล้วหรือยัง
    (ตามที่ตกลงกับ EGAT — ช่างเติมทีหลังได้ ผ่าน IN09 ตอนปิดงาน)
    """
    if str(report.get("repair_result") or "").strip().lower() in PLANNED_RESULTS:
        return True
    # กำหนดวันเริ่มตามแผนแล้ว = วางแผนเสร็จ แม้ยังไม่ได้เลือกช่าง
    return bool(report.get("sched_start"))


def _blocking_failures(results: dict) -> list[str]:
    """
    เส้นที่ "ยิงแล้วไม่ผ่าน" ก่อนถึงขั้นปิดสถานะ

    แยกจาก skipped: skipped = ไม่มีอะไรให้ส่ง (เช่นยังไม่ตั้ง PUBLIC_BASE_URL,
    ใบงานไม่มีช่าง) ปล่อยผ่านได้ ส่วน failed = Maximo ปฏิเสธ ต้องแก้แล้วยิงซ้ำ
    ก่อน ไม่งั้นพอ WO ขึ้น COMP แล้วจะเติมย้อนหลังไม่ได้อีกเลย
    """
    return [
        name for name, r in results.items()
        if isinstance(r, dict) and not r.get("ok") and not r.get("skipped")
    ]


async def sync_report(coll, report_id, report: dict, *, memo: str = "") -> dict:
    """
    ยิงทุก interface ที่ถึงจังหวะของใบงานนี้ — เรียกได้ซ้ำ ๆ อย่างปลอดภัย

    ลำดับตาม sequencing ที่ตกลงกับ EGAT (Maximo x iMPS — CM):
      1. IN01 create wo      — planner วางแผนเสร็จ
      2. IN02 wo status      — เปลี่ยนสถานะระหว่างทาง (In Progress ฯลฯ)
      3. IN03 attachment     ┐
      4. IN05 failure report ├ ตอนปิดใบงาน ยิงทีละเส้นเรียงกัน (ห้ามส่งพร้อมกัน)
      5. IN09 actual labor   ┘
      6. IN02 wo status      — COMPLETE ต้องเป็นเส้นสุดท้ายเสมอ

    ข้อ 6 สำคัญ: พอ WO ขึ้น COMP แล้ว Maximo ไม่ให้เพิ่ม failure report / labor
    เข้าไปอีก ยิงสถานะปิดก่อนขั้น 3–5 จะทำให้ 3 เส้นนั้นตกทั้งหมด
    """
    out: dict[str, Any] = {}
    if not CM_MAXIMO_ENABLED:
        return {"skipped": "CM_MAXIMO_ENABLED=false"}

    # ── 1. IN01 — เปิด WO ตอน planner วางแผนเสร็จ ──
    if is_planning_save(report):
        out["IN01"] = await ensure_work_order(coll, report_id, report)
        wonum = out["IN01"].get("wonum")
        if wonum:
            report = {**report, "maximo_wonum": wonum}

    is_closing = str(report.get("status") or "").strip().lower() in CLOSING_STATUSES

    if not is_closing:
        # ── 2. IN02 — สถานะระหว่างทาง ──
        out["IN02"] = await push_status(coll, report_id, report, memo=memo)
        return out

    # ── 3. IN03 — แนบ PDF ใบงาน (ครั้งเดียวพอ) ──
    # ยิงได้ก็ต่อเมื่อปิดงานแล้วเท่านั้น เพราะ PDF ถึงจะมีเนื้อหาครบ
    # (บล็อกนี้อยู่ใต้ is_closing อยู่แล้ว)
    if not (report.get("maximo_sync") or {}).get("IN03", {}).get("ok"):
        out["IN03"] = await push_attachment(
            coll, report_id, report, report_url(report, report_id),
            name=f"{report.get('issue_id') or 'CM'}.pdf",
            description=f"iMPS CM report {report.get('doc_name') or ''}".strip(),
        )

    # ── 4. IN05 — ผลวิเคราะห์ปัญหา/สาเหตุ/การแก้ไข ──
    await _settle()
    out["IN05"] = await push_failure_report(coll, report_id, report)

    # ── 5. IN09 — เวลาทำงานจริงของช่าง ──
    # ยิงครั้งเดียวพอ — labtrans เป็น POST create ยิงซ้ำ = ได้เรคคอร์ดใหม่ทุกครั้ง
    # ชั่วโมงทำงานจะถูกนับซ้ำ (ต่างจาก IN03/IN05 ที่เป็น AddChange/MERGE)
    if (report.get("maximo_sync") or {}).get("IN09", {}).get("ok"):
        out["IN09"] = {"ok": True, "skipped": True, "reason": "ลงเวลาไปแล้ว ไม่ยิงซ้ำ"}
    else:
        await _settle()
        out["IN09"] = await push_labor_time(coll, report_id, report)

    # ── 6. IN02 — ปิดสถานะเป็นเส้นสุดท้าย ──
    # ต้องยิง 3–5 ให้ครบก่อน มีเส้นไหนไม่ผ่านห้ามปิด WO เด็ดขาด
    # (COMP แล้ว Maximo ไม่ให้เติม attachment / failure / labor ย้อนหลัง)
    failed = _blocking_failures(out)
    if failed:
        log.warning(
            f"  ⏸️  ไม่ปิด WO {report.get('maximo_wonum')} — {', '.join(failed)} ยังไม่ผ่าน "
            f"(แก้แล้วยิงซ้ำที่ POST /cm-maximo/{report_id}/sync)"
        )
        out["IN02"] = _skip(f"รอ {', '.join(failed)} ผ่านก่อนถึงจะปิด WO ได้")
        return out

    await _settle()
    out["IN02"] = await push_status(coll, report_id, report, memo=memo)

    return out


async def safe_sync_report(coll, report_id, report: dict, *, memo: str = "") -> dict:
    """sync_report แบบกลืนทุก exception — ใช้จาก request handler ของ CM"""
    try:
        return await sync_report(coll, report_id, report, memo=memo)
    except Exception as e:  # ไม่ให้ Maximo ทำให้บันทึกใบงานล้ม
        log.warning(f"  ⚠️ CM Maximo sync error ({report.get('issue_id')}): {e}")
        return {"error": str(e)}
