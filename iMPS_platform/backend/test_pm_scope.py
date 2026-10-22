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
    # ผู้รับผิดชอบที่ planner ต้นทางติ๊ก (outsource ที่ไม่ได้รับตู้เฉพาะ) + ผู้ทำ PM ของอุปกรณ์
    "assignees": ["egat_tech", "Other OS", "EDS", "OS Co"],
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
    ("technician", "os2", "Other OS", "station", "", True),         # outsource ที่ติ๊กแต่ไม่ได้รับตู้ = ทีมต้นทาง
    ("technician", "x1", "Stranger OS", "station", "", False),      # outsource ที่ไม่ได้ติ๊กเลย = คนนอกใบงาน
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

    # ใบที่ planner EGAT ให้ EGAT ทำเองทั้งหมด — EDS (planner/ช่าง) เป็นคนนอกใบงาน เริ่ม/กรอกไม่ได้ (2026-10-22)
    egat_only = {
        "planner_company": "EGAT",
        "selected_equipment": [{"type": "station"}, {"type": "charger", "sn": "SN1"}],
        "assignees": ["egat_tech"],
    }
    own = [
        ("planner", "eds_pl", "EDS", "station", "", False),
        ("planner", "eds_pl", "EDS", "charger", "SN1", False),
        ("technician", "eds_tech", "EDS", "charger", "SN1", False),
        ("technician", "egat_tech", "EGAT", "charger", "SN1", True),
        ("technician", "egat_tech2", "EGAT", "station", "", True),     # ทีม EGAT ที่ไม่ได้ติ๊ก ยังเป็นทีมต้นทาง
        ("technician", "egat_tech", "", "station", "", True),          # ไม่มี company แต่ถูกติ๊กชื่อ
        ("planner", "egat_pl", "EGAT", "station", "", True),
        ("admin", "a", "", "station", "", True),
    ]
    for role, user, company, section, sn, expected in own:
        got = pm_scope.can_edit_section(egat_only, role, user, company, section, sn)
        if got != expected:
            failed += 1
            print(f"FAIL [egat-only] {role}/{user}@{company} {section}: got {got}, want {expected}")
    if pm_scope.is_participant(egat_only, "planner", "eds_pl", "EDS"):
        failed += 1
        print("FAIL is_participant: planner EDS ต้องไม่มีงานในใบที่ EGAT ทำเองทั้งหมด")
    if not pm_scope.is_participant(WO, "planner", "eds_pl", "EDS"):
        failed += 1
        print("FAIL is_participant: planner EDS ที่ได้รับตู้ต้องมีงานในใบ")
    # ใบงานรุ่นก่อนไม่มี planner_company — บอกไม่ได้ว่าใครเป็นทีมต้นทาง จึงไม่จำกัด
    if not pm_scope.is_participant({"selected_equipment": []}, "planner", "eds_pl", "EDS"):
        failed += 1
        print("FAIL is_participant: ใบรุ่นก่อนต้องไม่จำกัด")

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

    # ใครเห็นใบงานไหน — แต่ละบริษัทเห็นเฉพาะใบงานที่ตัวเองได้รับมอบหมาย (2026-10-22)
    V = pm_scope.WoViewer
    egat = V(False, "egat_pl", "EGAT", False)                 # บริษัทต้นทาง
    other_owner = V(False, "x_pl", "OtherOwner", False)
    eds = V(False, "eds_pl", "EDS", True)                     # vendor
    os_co = V(False, "os1", "OS Co", True)                    # outsource ของ EGAT
    sub = V(False, "sub1", "SubCo", True)                     # outsource ที่ EDS มอบหมาย
    stranger = V(False, "x1", "Stranger OS", True)
    nobody = V(False, "", "", False)
    admin = V(True)
    fresh = {"wonum": "WO1", "planning_status": "pending"}                       # Maximo เพิ่งเปิดมา
    egat_only = {"wonum": "WO2", "planning_status": "planned", "planner_company": "EGAT",
                 "selected_equipment": [{"type": "station"}, {"type": "charger", "sn": "SN1"}],
                 "assignees": ["egat_tech"]}
    eds_own = {"wonum": "PM1", "planning_status": "pending", "planner_company": "EDS"}  # EDS เปิดเอง
    legacy = {"wonum": "WO9", "planning_status": "planned", "assignees": ["eds_tech"]}  # ไม่มี planner_company
    WO_P = {**WO, "wonum": "WO5", "planning_status": "planned"}
    pending_tick = {"wonum": "WO6", "planning_status": "pending", "planner_company": "EGAT",
                    "assignees": ["OS Co"]}                   # ยังวางแผนไม่เสร็จ
    vis_cases = [
        (fresh, egat, True), (fresh, eds, False), (fresh, os_co, False), (fresh, nobody, True),
        (fresh, admin, True),
        (egat_only, egat, True), (egat_only, eds, False), (egat_only, os_co, False),
        (egat_only, other_owner, False), (egat_only, admin, True),
        (egat_only, V(False, "egat_tech", "", False), True),  # ติ๊กชื่อไว้แม้ company ว่าง
        (eds_own, eds, True), (eds_own, egat, False), (eds_own, V(False, "e", " eds ", True), True),
        (WO_P, egat, True), (WO_P, eds, True), (WO_P, os_co, True), (WO_P, sub, True),
        (WO_P, V(False, "os2", "Other OS", True), True), (WO_P, stranger, False),
        (WO_P, V(False, "eds_tech", "", False), True),
        (pending_tick, os_co, False), (pending_tick, egat, True),
        (legacy, egat, True), (legacy, eds, False), (legacy, V(False, "eds_tech", "EDS", True), True),
        (None, eds, True),
    ]
    for wo, viewer, expected in vis_cases:
        got = pm_scope.wo_visible(wo, viewer)
        if got != expected:
            failed += 1
            print(f"FAIL wo_visible({(wo or {}).get('wonum')}, {viewer.username}@{viewer.company}): "
                  f"got {got}, want {expected}")
    if pm_scope.visible_wo_clause(admin) is not None:
        failed += 1
        print("FAIL visible_wo_clause(admin) ต้องเป็น None")

    # query (Mongo) ต้องได้ผลเดียวกับ wo_visible — ต้องมี mongomock (pip install mongomock) ไม่มีก็ข้าม
    try:
        import mongomock
    except ImportError:
        mongomock = None
        print("ข้ามการเทียบ visible_wo_clause กับ Mongo (ไม่มี mongomock)")
    if mongomock:
        coll = mongomock.MongoClient().db.wo
        docs = [d for d in {id(w): w for w, _v, _e in vis_cases if w}.values()]
        coll.insert_many([dict(d) for d in docs])
        for viewer in (egat, other_owner, eds, os_co, sub, stranger, nobody,
                       V(False, "egat_tech", "", False), V(False, "eds_tech", "EDS", True)):
            clause = pm_scope.visible_wo_clause(viewer) or {}
            got = sorted(d["wonum"] for d in coll.find(clause))
            want = sorted(d["wonum"] for d in docs if pm_scope.wo_visible(d, viewer))
            if got != want:
                failed += 1
                print(f"FAIL visible_wo_clause({viewer.username}@{viewer.company}): got {got}, want {want}")

    print("ผ่านทั้งหมด" if not failed else f"ไม่ผ่าน {failed} ข้อ")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
