"""
ทดสอบ GET /test-reports/all-stations (Test Dashboard / Test List)

- รวม Test Report DC + AC และ PDF ที่อัปโหลด (DCUrl / ACUrl) ของทุกสถานี
- เติม station_name / company / charger_brand และเรียงวันที่ Test ใหม่ → เก่า
- กรองตามสิทธิ์: EDS (cs) เห็นเฉพาะตู้ FlexxFast — งานของลูกค้าภายนอกต้องไม่รั่วข้ามบริษัท

เป็น integration test — ต้องมี MongoDB รันอยู่ ไม่ได้ mock

    JWT_SECRET_KEY=<อย่างน้อย 32 ตัวอักษร> python test_test_reports_all_stations.py

ออก exit code 0 ถ้าผ่านหมด
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

import brand_scope  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402
from config import (  # noqa: E402
    SECRET_KEY, ALGORITHM, ACCESS_COOKIE_NAME,
    client1, station_collection, charger_collection,
)
from routers.test_all_stations import router as test_all_stations_router  # noqa: E402

# App minimale : l'endpoint lit Motor, lié à la boucle asyncio. Un TestClient hors
# `with` ouvre une boucle par requête → "Event loop is closed" dès la 2e requête.
# `with TestClient(app)` garde une seule boucle ; sans main.app, pas de watchers de fond.
app = FastAPI()
app.include_router(test_all_stations_router)
client: TestClient

STN_A = "STN_TEST_TR_A"   # สถานีปนยี่ห้อ (FlexxFast + Sinio)
STN_B = "STN_TEST_TR_B"   # สถานีไม่มีตู้ FlexxFast
SN_FF = "SN-TEST-TR-FF"
SN_SIN = "SN-TEST-TR-SIN"
SN_B = "SN-TEST-TR-B"
ALL_SNS = [SN_FF, SN_SIN, SN_B]
TEST_DBS = ["DCTestReport", "ACTestReport", "DCUrl", "ACUrl"]

_results: list[bool] = []


def check(label: str, got, want) -> None:
    ok = got == want
    _results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}: got {got!r}, want {want!r}")


def cookies(role: str, company: str) -> dict:
    tok = jwt.encode(
        {"sub": "tester", "user_id": "", "username": "tester",
         "role": role, "company": company, "station_ids": []},
        SECRET_KEY, algorithm=ALGORITHM,
    )
    return {ACCESS_COOKIE_NAME: tok}


def setup() -> dict:
    teardown()
    station_collection.insert_many([
        {"station_id": STN_A, "station_name": "Test station A", "company": "EGAT"},
        {"station_id": STN_B, "station_name": "Test station B", "company": "ACME"},
    ])
    charger_collection.insert_many([
        {"SN": SN_FF, "station_id": STN_A, "chargerNo": 1, "brand": "FLEXXFAST"},
        {"SN": SN_SIN, "station_id": STN_A, "chargerNo": 2, "brand": "SINIO"},
        {"SN": SN_B, "station_id": STN_B, "chargerNo": 1, "brand": "STAR CHARGE"},
    ])
    now = datetime.now(timezone.utc)
    ids = {}
    ids["dc_report"] = client1["DCTestReport"][SN_FF].insert_one({
        "sn": SN_FF, "document_name": "DC-CG1-01/2026", "issue_id": "DC-CG1-2608-01",
        "inspector": "Somchai", "inspection_date": "2026-08-21", "status": "submitted",
        "createdAt": now,
    }).inserted_id
    # ไม่มี status + มีผู้ลงชื่อ performed → ต้องได้ submitted และชื่อ performed ก่อน head.inspector
    ids["ac_report"] = client1["ACTestReport"][SN_SIN].insert_one({
        "sn": SN_SIN, "document_name": "AC-CG2-01/2026", "issue_id": "AC-CG2-2607-01",
        "head": {"inspector": "Anan"}, "inspection_date": "2026-07-10",
        "signature": {"responsibility": {"performed": {"name": "Performer"}}},
        "createdAt": now,
    }).inserted_id
    ids["dc_upload"] = client1["DCUrl"][SN_B].insert_one({
        "station": SN_B, "dc_date": "2026-06-02",
        "urls": [f"/uploads/dcurl/{SN_B}/2026-06-02/b.pdf"],
        "meta": {"files": [{"name": "b.pdf", "size": 3}]}, "createdAt": now,
    }).inserted_id
    # reportDate รุ่นเก่า: 20:00 UTC = 03:00 วันถัดไปตามเวลาไทย
    ids["ac_upload"] = client1["ACUrl"][SN_SIN].insert_one({
        "station": SN_SIN, "reportDate": datetime(2026, 5, 31, 20, 0, tzinfo=timezone.utc),
        "urls": [f"/uploads/acurl/{SN_SIN}/2026-06-01/a.pdf"], "createdAt": now,
    }).inserted_id
    brand_scope._station_ids_cache.clear()
    return {k: str(v) for k, v in ids.items()}


def teardown() -> None:
    station_collection.delete_many({"station_id": {"$in": [STN_A, STN_B]}})
    charger_collection.delete_many({"SN": {"$in": ALL_SNS}})
    for db in TEST_DBS:
        for sn in ALL_SNS:
            client1[db].drop_collection(sn)
    brand_scope._station_ids_cache.clear()


def ours(payload: dict) -> list[dict]:
    """ตัดข้อมูลอื่นใน DB ทิ้ง — นับเฉพาะตู้ของเทสต์นี้"""
    return [r for r in payload.get("reports", []) if r.get("sn") in ALL_SNS]


def main_test() -> int:
    ids = setup()
    admin = cookies("admin", "EGAT")
    eds_cs = cookies("cs", "EDS")

    print("--- ไม่ล็อกอิน ---")
    check("401 เมื่อไม่มี cookie", client.get("/test-reports/all-stations").status_code, 401)

    print("--- admin เห็นครบ 4 แหล่ง ---")
    r = client.get("/test-reports/all-stations", cookies=admin)
    check("status 200", r.status_code, 200)
    rows = ours(r.json())
    check("จำนวนแถว", len(rows), 4)
    check("เรียงวันที่ใหม่ → เก่า", [x["test_date"] for x in rows], ["2026-08-21", "2026-07-10", "2026-06-02", "2026-06-01"])

    by_id = {x["id"]: x for x in rows}
    dc = by_id.get(ids["dc_report"], {})
    check("DC report: ชนิด", dc.get("test_type"), "DC")
    check("DC report: ที่มา", dc.get("source"), "report")
    check("DC report: status", dc.get("status"), "submitted")
    check("DC report: ผู้ตรวจสอบ", dc.get("technician"), "Somchai")
    check("DC report: PDF ที่ generate", dc.get("file_url"), f"/pdf/dc/{ids['dc_report']}/export?sn={SN_FF}")
    check("DC report: station_name", dc.get("station_name"), "Test station A")
    check("DC report: company ของสถานี", dc.get("company"), "EGAT")
    check("DC report: ยี่ห้อตู้", dc.get("charger_brand"), "FLEXXFAST")

    ac = by_id.get(ids["ac_report"], {})
    check("AC report ไม่มี status → submitted", ac.get("status"), "submitted")
    check("AC report: performed มาก่อน head.inspector", ac.get("technician"), "Performer")
    check("AC report: PDF ใช้ template ac", ac.get("file_url"), f"/pdf/ac/{ids['ac_report']}/export?sn={SN_SIN}")

    up = by_id.get(ids["dc_upload"], {})
    check("DC upload: ที่มา", up.get("source"), "upload")
    check("DC upload: ชื่อไฟล์เป็นชื่อเอกสาร", up.get("document_name"), "b.pdf")
    check("DC upload: ลิงก์ไฟล์", up.get("file_url"), f"/uploads/dcurl/{SN_B}/2026-06-02/b.pdf")
    check("DC upload: company", up.get("company"), "ACME")

    old = by_id.get(ids["ac_upload"], {})
    check("reportDate UTC → วันที่ไทย", old.get("test_date"), "2026-06-01")
    check("AC upload: ชื่อเอกสารจาก URL", old.get("document_name"), "a.pdf")

    print("--- ตัวกรอง query ---")
    r = client.get("/test-reports/all-stations?test_type=ac", cookies=admin)
    check("test_type=ac → เฉพาะ AC", sorted({x["test_type"] for x in ours(r.json())}), ["AC"])
    check("test_type=ac → 2 แถว", len(ours(r.json())), 2)
    r = client.get(f"/test-reports/all-stations?station_id={STN_B}", cookies=admin)
    check("station_id → เฉพาะสถานี B", [x["sn"] for x in ours(r.json())], [SN_B])

    print("--- brand scope: EDS cs เห็นเฉพาะตู้ FlexxFast ---")
    r = client.get("/test-reports/all-stations", cookies=eds_cs)
    check("status 200", r.status_code, 200)
    check("เห็นเฉพาะ SN FlexxFast", sorted({x["sn"] for x in ours(r.json())}), [SN_FF])

    teardown()
    passed = sum(_results)
    print(f"\n{passed}/{len(_results)} passed")
    return 0 if all(_results) else 1


if __name__ == "__main__":
    code = 1
    try:
        with TestClient(app) as client:
            code = main_test()
    finally:
        teardown()
    sys.exit(code)
