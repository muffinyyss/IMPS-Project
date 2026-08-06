"""สร้าง backend/pdf/templates/cm_codes.py จากตาราง Maximo ฝั่ง frontend

ตาราง failure code ต้นทางอยู่ที่ฝั่ง frontend (ใช้โดย CM dashboard + ฟอร์มใบงาน)
PDF ต้องแปลงรหัสเป็นคำอธิบายเหมือนกัน — แทนที่จะ copy ตารางมาไว้สองที่แล้วหลุด sync
สคริปต์นี้อ่านไฟล์ TS แล้ว generate โมดูล Python ออกมา

รันใหม่เมื่อทีม Maximo อัปเดตตาราง:
    python backend/scripts/gen_cm_codes.py
"""
import re
import sys
from pathlib import Path

# console ของ Windows เป็น cp1252 — บังคับ UTF-8 ไม่งั้นบรรทัดสรุปท้ายสคริปต์พังทั้งที่เขียนไฟล์สำเร็จแล้ว
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

BACKEND = Path(__file__).resolve().parents[1]
SRC = BACKEND.parent / "src"
TS_CODES = SRC / "utils" / "cm-failure-codes.ts"
TS_FAILURE = SRC / "app" / "dashboard" / "cm-report" / "lib" / "failureCode.ts"
OUT = BACKEND / "pdf" / "templates" / "cm_codes.py"

STR = r'"((?:[^"\\]|\\.)*)"'


def _unescape(s: str) -> str:
    return s.encode().decode("unicode_escape")


def _block(text: str, decl: str) -> str:
    """ตัดเนื้อใน { ... } หรือ [ ... ] ของ declaration ที่ระบุ

    เริ่มนับจากหลังเครื่องหมาย = เท่านั้น ไม่งั้นจะไปโดน tuple type ใน annotation
    (เช่น `readonly [string, string, ...][]`) แทนตัว literal จริง
    """
    i = text.index(decl)
    eq = text.index("=", i + len(decl))
    open_ch = None
    for j in range(eq + 1, len(text)):
        if text[j] in "[{":
            open_ch = text[j]
            start = j
            break
    close_ch = "]" if open_ch == "[" else "}"
    depth = 0
    for j in range(start, len(text)):
        if text[j] == open_ch:
            depth += 1
        elif text[j] == close_ch:
            depth -= 1
            if depth == 0:
                return text[start + 1: j]
    raise ValueError(f"ปิดวงเล็บของ {decl} ไม่เจอ")


def parse_record(text: str, decl: str) -> dict:
    """อ่าน Record<string, string> — key เขียนได้ทั้งแบบมี quote และ identifier เปล่า"""
    body = _block(text, decl)
    out = {}
    for qk, bk, v in re.findall(rf"(?:{STR}|([A-Za-z_$][\w$]*))\s*:\s*{STR}", body):
        out[_unescape(qk) if qk else bk] = _unescape(v)
    return out


def parse_rows(text: str, decl: str) -> list:
    body = _block(text, decl)
    rows = []
    for tup in re.findall(r"\[([^\]]*)\]", body):
        cells = [_unescape(m) for m in re.findall(STR, tup)]
        if len(cells) == 5:
            rows.append(tuple(cells))
    return rows


def py_repr(obj, indent: int = 0) -> str:
    pad = " " * (indent + 4)
    if isinstance(obj, dict):
        items = "".join(f"{pad}{k!r}: {v!r},\n" for k, v in obj.items())
        return "{\n" + items + " " * indent + "}"
    items = "".join(f"{pad}{t!r},\n" for t in obj)
    return "[\n" + items + " " * indent + "]"


def main() -> int:
    for p in (TS_CODES, TS_FAILURE):
        if not p.exists():
            print(f"ไม่พบไฟล์ต้นทาง: {p}", file=sys.stderr)
            return 1

    codes_ts = TS_CODES.read_text(encoding="utf-8")
    failure_ts = TS_FAILURE.read_text(encoding="utf-8")

    rows = parse_rows(codes_ts, "FAILURE_CODE_ROWS")
    cause = parse_record(codes_ts, "CAUSE_DESCRIPTIONS")
    problem = parse_record(codes_ts, "PROBLEM_DESCRIPTIONS")
    remedy = parse_record(codes_ts, "REMEDY_LABELS")
    failure = parse_record(failure_ts, "FAILURE_CODE_LABELS")

    if not (rows and cause and problem and remedy and failure):
        print("parse ได้ข้อมูลไม่ครบ — ตรวจรูปแบบไฟล์ TS ต้นทาง", file=sys.stderr)
        return 1

    src_note = f"{TS_CODES.relative_to(BACKEND.parent).as_posix()} + {TS_FAILURE.relative_to(BACKEND.parent).as_posix()}"
    header = f'''"""ตาราง Maximo failure code สำหรับแปลงรหัส → คำอธิบายในเอกสาร PDF

ไฟล์นี้ generate อัตโนมัติ อย่าแก้ด้วยมือ
ต้นทาง: {src_note}
สร้างใหม่ด้วย: python backend/scripts/gen_cm_codes.py
"""
from typing import Dict, List, Tuple

'''

    body = (
        f"# [failureCode, problemCode, causeCode, remedyCode, remedyDescription]\n"
        f"FAILURE_CODE_ROWS: List[Tuple[str, str, str, str, str]] = {py_repr(rows)}\n\n"
        f"CAUSE_DESCRIPTIONS: Dict[str, str] = {py_repr(cause)}\n\n"
        f"PROBLEM_DESCRIPTIONS: Dict[str, str] = {py_repr(problem)}\n\n"
        f"REMEDY_LABELS: Dict[str, str] = {py_repr(remedy)}\n\n"
        f"FAILURE_CODE_LABELS: Dict[str, str] = {py_repr(failure)}\n"
    )

    helpers = '''

def _norm(v) -> str:
    return str(v or "").strip().upper()


def _lookup(table: Dict[str, str], code) -> str:
    """แปลงรหัสเป็นคำอธิบาย — รหัสที่ไม่รู้จัก (ข้อมูลเก่าที่พิมพ์เอง) คืนค่าเดิม"""
    v = str(code or "").strip()
    if not v:
        return ""
    return table.get(_norm(v), v)


def failure_code_label(code) -> str:
    return _lookup(FAILURE_CODE_LABELS, code)


def problem_label(code) -> str:
    return _lookup(PROBLEM_DESCRIPTIONS, code)


def cause_label(code) -> str:
    return _lookup(CAUSE_DESCRIPTIONS, code)


def remedy_label(code) -> str:
    return _lookup(REMEDY_LABELS, code)


# index สำหรับหา REMEDY DESCRIPTION ตามบริบทของใบงาน
_DESC_BY_FULL_KEY: Dict[str, str] = {}
_DESCS_BY_CAUSE_REMEDY: Dict[str, List[str]] = {}
_DESCS_BY_REMEDY: Dict[str, List[str]] = {}
for _fc, _pb, _cs, _rm, _desc in FAILURE_CODE_ROWS:
    _DESC_BY_FULL_KEY[f"{_fc}:{_pb}:{_cs}:{_rm}"] = _desc
    for _bucket, _key in ((_DESCS_BY_CAUSE_REMEDY, f"{_cs}:{_rm}"), (_DESCS_BY_REMEDY, _rm)):
        _lst = _bucket.setdefault(_key, [])
        if _desc not in _lst:
            _lst.append(_desc)


def remedy_descriptions(failure_code, problems, causes, remedy) -> List[str]:
    """คำอธิบายการแก้ไขตามบริบทใบงาน (ตรรกะเดียวกับ remedyDescriptions ฝั่ง frontend)

    ไล่จากละเอียดไปหยาบ: (fc, problem, cause, remedy) → (cause, remedy) → ป้ายสั้นของ remedy
    ใบงานเดียวอาจมีหลายสาเหตุ จึงคืนได้หลายคำอธิบาย
    """
    rem = _norm(remedy)
    if not rem:
        return []
    fc = _norm(failure_code)
    out: List[str] = []

    def push(d: str) -> None:
        if d and d not in out:
            out.append(d)

    for c in [_norm(x) for x in (causes or []) if _norm(x)]:
        before = len(out)
        for p in [_norm(x) for x in (problems or []) if _norm(x)]:
            d = _DESC_BY_FULL_KEY.get(f"{fc}:{p}:{c}:{rem}")
            if d:
                push(d)
        # ไม่มีคู่ที่ตรงเป๊ะสำหรับสาเหตุนี้ → ถอยไปใช้ (cause, remedy)
        if len(out) == before:
            for d in _DESCS_BY_CAUSE_REMEDY.get(f"{c}:{rem}", []):
                push(d)

    if not out:
        only = _DESCS_BY_REMEDY.get(rem) or []
        push(only[0] if len(only) == 1 else remedy_label(rem))
    return out
'''

    OUT.write_text(header + body + helpers, encoding="utf-8")
    print(f"เขียน {OUT.relative_to(BACKEND.parent)} แล้ว")
    print(f"  rows={len(rows)} cause={len(cause)} problem={len(problem)} "
          f"remedy={len(remedy)} failure={len(failure)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
