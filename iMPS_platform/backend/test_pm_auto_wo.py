"""
ทดสอบการคำนวณรอบ PM อัตโนมัติ (services/pm_auto_wo.py) — ไม่ต้องใช้ MongoDB

    python test_pm_auto_wo.py
"""
import os
import sys
from datetime import date

os.environ.setdefault("PM_AUTO_WO_INTERVAL_MONTHS", "6")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.pm_auto_wo import due_in_month, parse_commissioning, parse_month, plan_month  # noqa: E402

passed = failed = 0


def check(name, got, want):
    global passed, failed
    if got == want:
        passed += 1
        print(f"[ OK ] {name}")
    else:
        failed += 1
        print(f"[FAIL] {name}: got {got!r}, want {want!r}")


# ── parse_commissioning ──
check("ISO date", parse_commissioning("2024-03-15"), date(2024, 3, 15))
check("ISO datetime UTC = วันไทย", parse_commissioning("2024-03-14T17:30:00.000Z"), date(2024, 3, 15))
check("dd/mm/yyyy", parse_commissioning("15/03/2024"), date(2024, 3, 15))
check("พ.ศ.", parse_commissioning("2567-03-15"), date(2024, 3, 15))
check("ว่าง", parse_commissioning(""), None)
check("ขีด", parse_commissioning("-"), None)
check("มั่ว", parse_commissioning("soon"), None)

# ── due_in_month: ฟิก +6/+12/... จากเดือน commissioning ──
c = date(2024, 3, 15)
check("เดือน commissioning เองไม่นับ", due_in_month(c, 2024, 3), None)
check("+6 เดือน = รอบ 1", due_in_month(c, 2024, 9), (1, date(2024, 9, 15)))
check("+12 เดือน = รอบ 2", due_in_month(c, 2025, 3), (2, date(2025, 3, 15)))
check("+7 เดือน ไม่ใช่รอบ", due_in_month(c, 2024, 10), None)
check("ก่อน commissioning", due_in_month(c, 2023, 9), None)
check("31 ส.ค. → 28 ก.พ.", due_in_month(date(2025, 8, 31), 2026, 2), (1, date(2026, 2, 28)))
check("interval 3", due_in_month(c, 2024, 6, interval=3), (1, date(2024, 6, 15)))

# ── parse_month ──
check("parse_month", parse_month("2026-10"), (2026, 10))
check("parse_month ว่าง = เดือนนี้", parse_month(None, today=date(2026, 10, 22)), (2026, 10))
try:
    parse_month("2026-13")
    check("parse_month เดือนผิด", "no error", "ValueError")
except ValueError:
    check("parse_month เดือนผิด", "ValueError", "ValueError")

# ── plan_month: รวมรายสถานี ──
chargers = [
    # สถานี A: ตู้ 1 commissioning เม.ย. 2025, ตู้ 2 commissioning ก.ค. 2025
    {"station_id": "A", "SN": "A1", "chargerNo": 1, "commissioningDate": "2025-04-10"},
    {"station_id": "A", "SN": "A2", "chargerNo": 2, "commissioningDate": "2025-07-20"},
    # สถานี B: 2 ตู้ commissioning เดือนเดียวกัน (วันต่างกัน)
    {"station_id": "B", "SN": "B1", "chargerNo": 1, "commissioningDate": "2026-04-25"},
    {"station_id": "B", "SN": "B2", "chargerNo": 2, "commissioningDate": "2026-04-05"},
    # ข้าม: ไม่มีวัน / ปิดใช้งาน / ไม่มี SN
    {"station_id": "C", "SN": "C1", "commissioningDate": ""},
    {"station_id": "C", "SN": "C2", "commissioningDate": "2026-04-01", "is_active": False},
    {"station_id": "C", "SN": "", "commissioningDate": "2026-04-01"},
]
oct26 = plan_month(chargers, 2026, 10)
by = {s["station_id"]: s for s in oct26["stations"]}
check("ต.ค. 2026: A (ตู้ 1 รอบ 3) + B (ทั้ง 2 ตู้)", sorted(by), ["A", "B"])
check("A: เฉพาะตู้ 1", [c["sn"] for c in by["A"]["chargers"]], ["A1"])
check("A: ตู้ 1 = commissioning เร็วสุด → มี Station/MDB/CCB/CB_BOX", by["A"]["include_fixed"], True)
check("A: รอบที่ 3", by["A"]["chargers"][0]["cycle"], 3)
check("B: ใบเดียว 2 ตู้", [c["sn"] for c in by["B"]["chargers"]], ["B1", "B2"])
check("B: pm_date = วันครบรอบที่เร็วสุด", by["B"]["pm_date"], "2026-10-05")
check("B: equipment ตั้งต้น", [e.get("sn") or e["type"] for e in by["B"]["equipment"]],
      ["B1", "B2", "station", "mdb", "ccb", "cbbox"])
check("ไม่มีวัน commissioning นับไว้", [m["sn"] for m in oct26["missing"]], ["C1"])
check("ปิดใช้งานนับไว้", oct26["inactive"], 1)

jan27 = plan_month(chargers, 2027, 1)
a_jan = {s["station_id"]: s for s in jan27["stations"]}.get("A")
check("ม.ค. 2027: A เฉพาะตู้ 2", [c["sn"] for c in a_jan["chargers"]] if a_jan else None, ["A2"])
check("ม.ค. 2027: ตู้ 2 ไม่ใช่รอบของอุปกรณ์สถานี", a_jan["include_fixed"] if a_jan else None, False)
check("ม.ค. 2027: equipment มีแค่ตู้", [e["type"] for e in a_jan["equipment"]] if a_jan else None, ["charger"])
check("label จาก labels map", plan_month(chargers, 2026, 10, labels={("A", "A1"): "Charger 9"})
      ["stations"][0]["chargers"][0]["label"], "Charger 9")
check("เดือนที่ไม่มีใครครบรอบ", plan_month(chargers, 2026, 11)["stations"], [])

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
