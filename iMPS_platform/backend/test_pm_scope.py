"""
ทดสอบการแบ่งงานในใบ PM สถานีระหว่างทีมต้นทาง (EGAT) กับผู้ทำ PM ที่ planner เลือกรายตู้
(vendor เช่น EDS / outsource) — routers/pm_scope.py (ฟังก์ชันล้วน ไม่ต้องมี MongoDB)

    python test_pm_scope.py

ออก exit code 0 ถ้าผ่านหมด
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from routers import pm_scope  # noqa: E402

# สถานี 4 ตู้: SN1-2 EDS ทำ, SN4 outsource ของ EGAT ทำ, SN3 EGAT ทำเอง
WO = {
    "planner_company": "EGAT",
    "selected_equipment": [
        {"type": "station"}, {"type": "mdb"},
        {"type": "charger", "sn": "SN1", "by": "EDS"},
        {"type": "charger", "sn": "SN2", "by": "EDS"},
        {"type": "charger", "sn": "SN3"},
        {"type": "charger", "sn": "SN4", "by": "OS Co"},
    ],
    "vendor_plans": [
        {"vendor": "EDS", "status": "planned", "assignees": ["eds_tech", "SubCo"]},
    ],
}

CASES = [
    # role, username, company, section, sn, expected
    ("technician", "egat_tech", "EGAT", "station", "", True),
    ("technician", "egat_tech", "EGAT", "charger", "SN1", False),   # ตู้ของ EDS
    ("technician", "egat_tech", "EGAT", "charger", "SN3", True),    # ตู้ที่ไม่มี vendor
    ("technician", "eds_tech", "EDS", "charger", "SN1", True),
    ("technician", "eds_tech", "EDS", "charger", "SN3", False),
    ("technician", "eds_tech", "EDS", "mdb", "", False),
    ("technician", "sub1", "SubCo", "charger", "sn2", True),         # outsource ที่ EDS มอบหมาย
    ("planner", "egat_pl", "EGAT", "charger", "SN1", True),         # planner ต้นทางดูแลทั้งใบ
    ("planner", "eds_pl", "EDS", "station", "", False),
    ("technician", "os1", "OS Co", "charger", "SN4", True),         # outsource ทำตู้ที่ได้รับ
    ("technician", "os1", "OS Co", "charger", "SN3", False),
    ("technician", "os1", "OS Co", "station", "", False),
    ("technician", "egat_tech", "EGAT", "charger", "SN4", False),   # ตู้ของ outsource
    ("technician", "os2", "Other OS", "station", "", True),         # outsource ที่ไม่ได้รับตู้ = ทีมต้นทาง
    ("admin", "a", "", "charger", "SN1", True),
    ("owner", "o", "", "station", "", True),
]


def main() -> int:
    failed = 0
    for role, user, company, section, sn, expected in CASES:
        got = pm_scope.can_edit_section(WO, role, user, company, section, sn)
        if got != expected:
            failed += 1
            print(f"FAIL {role}/{user}@{company} {section}{'/' + sn if sn else ''}: got {got}, want {expected}")

    # ใบส่งต่อแบบเดิม (ไม่ได้ผูกตู้) / ใบที่ไม่มีใบส่งต่อ = ไม่จำกัด
    legacy = {"planner_company": "EGAT", "vendor_plans": [{"vendor": "EDS"}],
              "selected_equipment": [{"type": "charger", "sn": "SN1"}]}
    for wo in (legacy, {}, None):
        if not pm_scope.can_edit_section(wo, "technician", "eds_tech", "EDS", "station", ""):
            failed += 1
            print(f"FAIL no-scope job should be unrestricted: {wo}")

    if (pm_scope.section_owner(WO, "charger", "sn1") != "EDS"
            or pm_scope.section_owner(WO, "charger", "SN4") != "OS Co"
            or pm_scope.section_owner(WO, "station") != "EGAT"):
        failed += 1
        print("FAIL section_owner")

    print("ผ่านทั้งหมด" if not failed else f"ไม่ผ่าน {failed} ข้อ")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
