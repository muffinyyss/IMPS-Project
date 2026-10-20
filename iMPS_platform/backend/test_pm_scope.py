"""
ทดสอบการแบ่งงานในใบ PM สถานีระหว่างทีมต้นทาง (EGAT) กับผู้ทำ PM ที่ planner เลือกรายอุปกรณ์
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

    # จ้าง EDS ทำทั้งสถานี (ผู้ทำ PM = EDS ทุกชิ้น) — ทีมต้นทางกรอกไม่ได้เลย เหลือ planner ตรวจ/อนุมัติ
    whole = {
        "planner_company": "EGAT",
        "selected_equipment": [
            {"type": "station", "by": "EDS"}, {"type": "mdb", "by": "EDS"},
            {"type": "ccb", "by": "EDS"}, {"type": "cbbox", "by": "EDS"},
            {"type": "charger", "sn": "SN1", "by": "EDS"},
        ],
        "vendor_plans": [{"vendor": "EDS", "status": "planned", "assignees": ["eds_tech"]}],
    }
    # ผสม: EDS ทำ Station + ตู้ SN1, ทีมเราทำ MDB
    mixed = {
        "planner_company": "EGAT",
        "selected_equipment": [
            {"type": "station", "by": "EDS"}, {"type": "mdb"},
            {"type": "charger", "sn": "SN1", "by": "EDS"},
        ],
    }
    # ใบส่งต่อที่เก็บส่วนระดับสถานีไว้ (sections) แต่ไม่มี by ในรายการอุปกรณ์ ก็อ่านได้
    stored = {
        "planner_company": "EGAT",
        "selected_equipment": [{"type": "station"}, {"type": "mdb"}],
        "vendor_plans": [{"vendor": "EDS", "status": "planned", "chargers": [], "sections": ["station"]}],
    }
    more = [
        (whole, "technician", "eds_tech", "EDS", "station", "", True),
        (whole, "technician", "eds_tech", "EDS", "cbbox", "", True),
        (whole, "technician", "eds_tech", "EDS", "charger", "SN1", True),
        (whole, "technician", "egat_tech", "EGAT", "station", "", False),
        (whole, "technician", "egat_tech", "EGAT", "mdb", "", False),
        (whole, "technician", "egat_tech", "EGAT", "charger", "SN1", False),
        (whole, "planner", "egat_pl", "EGAT", "mdb", "", True),
        (mixed, "technician", "eds_tech", "EDS", "station", "", True),
        (mixed, "technician", "eds_tech", "EDS", "mdb", "", False),
        (mixed, "technician", "egat_tech", "EGAT", "station", "", False),
        (mixed, "technician", "egat_tech", "EGAT", "mdb", "", True),
        (stored, "technician", "eds_tech", "EDS", "station", "", True),
        (stored, "technician", "eds_tech", "EDS", "mdb", "", False),
        (stored, "technician", "egat_tech", "EGAT", "station", "", False),
        (stored, "technician", "egat_tech", "EGAT", "mdb", "", True),
    ]
    for wo, role, user, company, section, sn, expected in more:
        got = pm_scope.can_edit_section(wo, role, user, company, section, sn)
        if got != expected:
            failed += 1
            print(f"FAIL [{wo is whole and 'whole' or wo is mixed and 'mixed' or 'stored'}] "
                  f"{role}/{user}@{company} {section}{'/' + sn if sn else ''}: got {got}, want {expected}")

    if pm_scope.section_owner(whole, "mdb") != "EDS" or pm_scope.section_owner(mixed, "mdb") != "EGAT":
        failed += 1
        print("FAIL section_owner (ส่วนระดับสถานี)")

    by_party = pm_scope.items_by_party(whole["selected_equipment"])
    if by_party != {"eds": ("EDS", ["SN1"], ["station", "mdb", "ccb", "cbbox"])}:
        failed += 1
        print(f"FAIL items_by_party: {by_party}")
    # ตู้ที่ไม่มี SN ไม่ทำให้เกิดรายการว่าง (ใบส่งต่อว่าง = ไม่ล็อกส่วนไหนเลย)
    if pm_scope.items_by_party([{"type": "charger", "by": "EDS"}, {"type": "", "by": "EDS"}]) != {}:
        failed += 1
        print("FAIL items_by_party ต้องข้ามอุปกรณ์ที่ระบุไม่ได้")

    print("ผ่านทั้งหมด" if not failed else f"ไม่ผ่าน {failed} ข้อ")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
