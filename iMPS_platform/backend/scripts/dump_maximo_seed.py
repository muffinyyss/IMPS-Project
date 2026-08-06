"""สร้างไฟล์ seed ของ master data จาก Maximo (IN04 failure code + IN08 labor list)

ไฟล์ seed คือชั้นสุดท้ายกัน dropdown ของฟอร์ม CM ว่าง — ใช้เฉพาะตอนเครื่องนั้น
ยังไม่เคย sync สำเร็จเลย (เพิ่ง deploy / เพิ่งล้าง DB) แล้ว Maximo ล่มพอดี
เครื่องที่ทำงานอยู่แล้วจะอ่านจาก cache ใน MongoDB เสมอ ไม่แตะ seed

รันใหม่เมื่อทีม Maximo แก้ตาราง (แล้ว commit ไฟล์ที่ได้):
    python backend/scripts/dump_maximo_seed.py

ไฟล์ที่เขียน:
    backend/data/maximo_failure_codes.seed.json
    backend/data/maximo_labor.seed.json
"""

import asyncio
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND / ".env")

from services import maximo  # noqa: E402
from services.cm_maximo import (  # noqa: E402
    FAILURE_SEED_FILE, LABOR_SEED_FILE, SEED_DIR,
    _normalize_person, build_failure_tree,
)


def _write(path: Path, payload) -> None:
    SEED_DIR.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
        f.write("\n")


async def main() -> int:
    print(f"Maximo: {maximo.MAXIMO_BASE_URL}")

    nodes = await maximo.query_failure_list()
    tree = build_failure_tree(nodes)
    if not tree["matrix"]:
        print("❌ Maximo คืน failure code ว่าง — ไม่เขียน seed ทับของเดิม")
        return 1
    _write(FAILURE_SEED_FILE, {**tree, "node_count": len(nodes)})
    print(f"✅ {FAILURE_SEED_FILE.relative_to(BACKEND.parent)}")
    print(f"   {len(tree['classes'])} classes / {len(tree['matrix'])} rows")

    people = [p for p in map(_normalize_person, await maximo.query_labor()) if p["personid"]]
    if not people:
        print("⚠️  labor list ว่าง — ข้ามไฟล์ labor seed")
        return 0
    _write(LABOR_SEED_FILE, people)
    print(f"✅ {LABOR_SEED_FILE.relative_to(BACKEND.parent)}")
    print(f"   {len(people)} persons")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
