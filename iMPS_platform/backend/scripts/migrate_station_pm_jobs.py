"""
ย้ายเอกสาร PM เดิม (Station / MDB / CCB / CB_BOX) เข้าใบ "ใบเดียว 4 ส่วน"
===========================================================================

เดิม 4 ชนิดนี้เป็นคนละเอกสาร คนละเลขที่ ตอนนี้รวมเป็นใบแม่ใบเดียว
(stationPMJob.<station_id>) ที่ถือเลขที่เอกสาร + สถานะรวม ส่วนเนื้อ checklist
ยังอยู่ที่คอลเลกชันเดิมของแต่ละชนิด แค่ผูกกลับมาที่แม่ด้วย field job_id

จับกลุ่มเอกสารเก่าเป็นใบเดียวกันด้วย:
  1) wonum เดียวกัน            — งานรอบเดียวกันที่ Maximo เปิดมาใบเดียว (แม่นสุด)
  2) ไม่มี wonum → pm_date เดียวกัน ของสถานีนั้น

เลขที่เอกสารของใบแม่: ใช้ของส่วน Station ถ้ามี ไม่มีก็ไล่ลำดับ MDB → CCB → CB_BOX
(ไม่ออกเลขใหม่ เพื่อให้เลขที่ที่เคยส่งให้ EGAT/Maximo ไปแล้วยังตรงกัน)

วิธีใช้:
    python scripts/migrate_station_pm_jobs.py --dry-run      # ดูก่อนว่าจะรวมยังไง
    python scripts/migrate_station_pm_jobs.py                # ย้ายจริง
    python scripts/migrate_station_pm_jobs.py --station X    # เฉพาะสถานีเดียว

รันซ้ำได้ — เอกสารที่ผูกกับใบแม่แล้วจะถูกข้าม
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import (  # noqa: E402
    client,
    station_collection,
    CBBOXPMReportDB,
    CCBPMReportDB,
    MDBPMReportDB,
    stationPMJobDB,
    stationPMReportDB,
)

# ลำดับนี้ใช้ทั้งตอนเลือกเลขที่เอกสารของใบแม่ และตอนเรียงส่วนใน PDF
SECTION_DBS = [
    ("station", stationPMReportDB),
    ("mdb", MDBPMReportDB),
    ("ccb", CCBPMReportDB),
    ("cbbox", CBBOXPMReportDB),
]


def group_key(doc: dict) -> str:
    """เอกสารใบไหนควรอยู่ใบแม่เดียวกัน — ใบงาน Maximo มาก่อน ไม่มีค่อยใช้วันที่"""
    wonum = str(doc.get("wonum") or "").strip()
    if wonum:
        return f"wo:{wonum}"
    return f"date:{str(doc.get('pm_date') or '').strip()}"


async def station_ids() -> list[str]:
    """สถานีที่มีเอกสาร PM ชนิดไหนก็ได้อยู่ (ชื่อ collection = station_id)"""
    found: set[str] = set()
    for _, db in SECTION_DBS:
        for name in await db.list_collection_names():
            found.add(name)
    return sorted(found)


async def migrate_station(station_id: str, dry_run: bool) -> dict:
    jobs_coll = stationPMJobDB.get_collection(station_id)
    groups: dict[str, list[tuple[str, dict]]] = defaultdict(list)

    for section, db in SECTION_DBS:
        coll = db.get_collection(station_id)
        try:
            docs = await coll.find(
                {"job_id": {"$in": [None, ""]}},
                {"_id": 1, "issue_id": 1, "doc_name": 1, "pm_date": 1, "wonum": 1,
                 "inspector": 1, "status": 1},
            ).to_list(length=100000)
        except Exception as e:
            print(f"    ⚠️  อ่าน {section} ของ {station_id} ไม่ได้: {e}")
            continue
        for d in docs:
            groups[group_key(d)].append((section, d))

    station = station_collection.find_one(
        {"station_id": station_id}, {"_id": 0, "station_name": 1}
    ) or {}

    created = linked = 0
    for key, members in sorted(groups.items()):
        by_section = {}
        for section, doc in members:
            # ชนิดเดียวกันซ้ำในกลุ่ม = เอาใบล่าสุด (ใบก่อนหน้าเป็นของรอบที่กรอกซ้ำ)
            prev = by_section.get(section)
            if not prev or str(doc["_id"]) > str(prev["_id"]):
                by_section[section] = doc

        # เลขที่เอกสารของใบแม่ — ไล่ตามลำดับความสำคัญของส่วน
        lead = next((by_section[s] for s, _ in SECTION_DBS if s in by_section), None)
        if lead is None:
            continue

        pm_date = str(lead.get("pm_date") or "").strip()
        wonum = str(lead.get("wonum") or "").strip()

        existing = await jobs_coll.find_one(
            {"wonum": wonum} if wonum else {"pm_date": pm_date, "wonum": {"$in": ["", None]}}
        )

        job_doc = {
            "station_id": station_id,
            "station_name": station.get("station_name") or station_id,
            "issue_id": lead.get("issue_id") or "",
            "doc_name": lead.get("doc_name") or "",
            "pm_date": pm_date,
            "wonum": wonum,
            "inspector": lead.get("inspector") or "",
            "origin": "migrated",
            "createdAt": datetime.now(timezone.utc),
        }

        sections_txt = "+".join(s for s, _ in SECTION_DBS if s in by_section)
        if dry_run:
            print(f"    [{key}] {job_doc['issue_id'] or '-'} · {pm_date or '-'} · {sections_txt}"
                  f"{' (มีใบแม่แล้ว)' if existing else ''}")
            created += 0 if existing else 1
            linked += len(by_section)
            continue

        if existing:
            job_id = str(existing["_id"])
        else:
            res = await jobs_coll.insert_one(job_doc)
            job_id = str(res.inserted_id)
            created += 1

        for section, db in SECTION_DBS:
            doc = by_section.get(section)
            if not doc:
                continue
            await db.get_collection(station_id).update_one(
                {"_id": doc["_id"]}, {"$set": {"job_id": job_id}}
            )
            linked += 1

    return {"station_id": station_id, "jobs": created, "sections": linked, "groups": len(groups)}


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="แสดงผลว่าจะรวมยังไงโดยไม่เขียนอะไร")
    ap.add_argument("--station", help="ทำเฉพาะ station_id นี้")
    args = ap.parse_args()

    targets = [args.station] if args.station else await station_ids()
    print(f"สถานีที่จะประมวลผล: {len(targets)}")

    total = {"jobs": 0, "sections": 0}
    for sid in targets:
        print(f"  • {sid}")
        res = await migrate_station(sid, args.dry_run)
        total["jobs"] += res["jobs"]
        total["sections"] += res["sections"]
        print(f"    → ใบแม่ {res['jobs']} ใบ · ผูกส่วน {res['sections']} ส่วน (กลุ่มทั้งหมด {res['groups']})")

    verb = "จะสร้าง" if args.dry_run else "สร้างแล้ว"
    print(f"\nรวม: {verb}ใบแม่ {total['jobs']} ใบ · ผูกเอกสารเดิม {total['sections']} ใบ")
    if args.dry_run:
        print("(dry run — ยังไม่ได้เขียนอะไรลง DB)")


if __name__ == "__main__":
    asyncio.run(main())
