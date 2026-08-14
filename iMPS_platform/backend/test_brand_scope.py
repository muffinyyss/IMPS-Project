"""
ทดสอบขอบเขตการเห็นข้อมูลตามยี่ห้อตู้ (brand scope)

EDS ดูแลเฉพาะตู้ FlexxFast → cs/planner/technician ของ EDS ต้องเห็นเฉพาะตู้ยี่ห้อนี้
สถานีที่ปนยี่ห้อยังเห็นได้ แต่รายการตู้ต้องเหลือเฉพาะ FlexxFast

เป็น integration test — ต้องมี MongoDB รันอยู่ ไม่ได้ mock

    JWT_SECRET_KEY=<อย่างน้อย 32 ตัวอักษร> python test_brand_scope.py

ออก exit code 0 ถ้าผ่านหมด ใช้ใน CI ได้เลย
"""
import os
import pathlib
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

import main  # noqa: E402
import brand_scope  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402
from config import (  # noqa: E402
    SECRET_KEY, ALGORITHM, ACCESS_COOKIE_NAME,
    station_collection, charger_collection,
)
from routers.pm_helpers import UPLOADS_ROOT  # noqa: E402

client = TestClient(main.app)

# สถานีปนยี่ห้อ — EDS ต้องเห็นสถานี แต่เห็นแค่ตู้ FlexxFast
MIXED = "STN_TEST_BRAND_MIXED"
# สถานีที่ไม่มีตู้ FlexxFast เลย — EDS ต้องไม่เห็นทั้งสถานี
OTHER = "STN_TEST_BRAND_OTHER"

SN_FF = "SN-TEST-BRAND-FF"
SN_SINIO = "SN-TEST-BRAND-SINIO"
SN_OTHER = "SN-TEST-BRAND-OTHER"
ALL_SNS = [SN_FF, SN_SINIO, SN_OTHER]

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


def upload_dir(sn: str) -> pathlib.Path:
    return pathlib.Path(UPLOADS_ROOT) / "pm" / sn


def setup() -> None:
    teardown()
    # ต้องมีไฟล์จริง — serve_upload resolve path ก่อนตรวจสิทธิ์ ไฟล์ไม่มีจะได้ 404 บังหน้า 403
    for sn in (SN_FF, SN_SINIO):
        d = upload_dir(sn) / "r1" / "pre" / "g1"
        d.mkdir(parents=True, exist_ok=True)
        (d / "x.jpg").write_bytes(b"IMG")

    station_collection.insert_many([
        {"station_id": MIXED, "station_name": "Mixed brand station"},
        {"station_id": OTHER, "station_name": "Non-FlexxFast station"},
    ])
    charger_collection.insert_many([
        # ยี่ห้อใน DB จริงเก็บเป็นตัวพิมพ์ใหญ่ — ต้องแมตช์แบบไม่สนตัวพิมพ์
        {"SN": SN_FF, "station_id": MIXED, "chargerNo": 1, "brand": "FLEXXFAST"},
        {"SN": SN_SINIO, "station_id": MIXED, "chargerNo": 2, "brand": "SINIO"},
        {"SN": SN_OTHER, "station_id": OTHER, "chargerNo": 1, "brand": "STAR CHARGE"},
    ])
    # scoped_station_ids cache ไว้ 60 วิ — ข้อมูลเพิ่งใส่ ต้องล้างก่อนไม่งั้นเทสต์เห็นของเก่า
    brand_scope._station_ids_cache.clear()


def teardown() -> None:
    station_collection.delete_many({"station_id": {"$in": [MIXED, OTHER]}})
    charger_collection.delete_many({"SN": {"$in": ALL_SNS}})
    for sn in ALL_SNS:
        shutil.rmtree(upload_dir(sn), ignore_errors=True)
    brand_scope._station_ids_cache.clear()


def sns_of(payload: dict) -> list[str]:
    return sorted(c.get("SN", "") for c in payload.get("chargers", []))


def main_test() -> int:
    setup()
    eds = cookies("cs", "EDS")
    eds_eng = cookies("planner", "EDS")
    egat = cookies("cs", "EGAT")
    admin = cookies("admin", "EDS")

    print("--- /chargers/{station_id}: สถานีปนยี่ห้อ ---")
    r = client.get(f"/chargers/{MIXED}", cookies=eds)
    check("EDS cs เห็นเฉพาะตู้ FlexxFast", sns_of(r.json()), [SN_FF])
    r = client.get(f"/chargers/{MIXED}", cookies=eds_eng)
    check("EDS planner เห็นเฉพาะตู้ FlexxFast", sns_of(r.json()), [SN_FF])
    r = client.get(f"/chargers/{MIXED}", cookies=egat)
    check("EGAT cs เห็นทุกตู้", sns_of(r.json()), sorted([SN_FF, SN_SINIO]))
    r = client.get(f"/chargers/{MIXED}", cookies=admin)
    check("admin เห็นทุกตู้", sns_of(r.json()), sorted([SN_FF, SN_SINIO]))

    print("--- /chargers/{station_id}: ต้องล็อกอินก่อน ---")
    check("ไม่ล็อกอิน", client.get(f"/chargers/{MIXED}").status_code, 401)

    print("--- /charger/info: ยิงตรงด้วย SN ของตู้ยี่ห้ออื่น ---")
    check("EDS ยิง SN ตู้ FlexxFast",
          client.get(f"/charger/info?sn={SN_FF}", cookies=eds).status_code, 200)
    check("EDS ยิง SN ตู้ SINIO ในสถานีเดียวกัน",
          client.get(f"/charger/info?sn={SN_SINIO}", cookies=eds).status_code, 403)
    check("EGAT ยิง SN ตู้ SINIO",
          client.get(f"/charger/info?sn={SN_SINIO}", cookies=egat).status_code, 200)
    # ค้นด้วย station_id ต้องคัดตั้งแต่ query ไม่ใช่สุ่มได้ตู้ยี่ห้ออื่นแล้ว 403
    r = client.get(f"/charger/info?station_id={MIXED}", cookies=eds)
    check("EDS ค้นด้วย station_id ได้ตู้ที่ตัวเองดูแล", r.status_code, 200)

    print("--- /my-stations/detail: dropdown เลือกสถานี ---")
    seen = {s["station_id"] for s in client.get("/my-stations/detail", cookies=eds).json()["stations"]}
    check("EDS เห็นสถานีที่มีตู้ FlexxFast", MIXED in seen, True)
    check("EDS ไม่เห็นสถานีที่ไม่มีตู้ FlexxFast", OTHER in seen, False)
    seen = {s["station_id"] for s in client.get("/my-stations/detail", cookies=egat).json()["stations"]}
    check("EGAT เห็นทั้งสองสถานี", {MIXED, OTHER} <= seen, True)

    print("--- /all-stations/: หน้า EV Station ---")
    body = client.get("/all-stations/", cookies=eds).json()["stations"]
    by_id = {s["station_id"]: s for s in body}
    check("EDS ไม่เห็นสถานีที่ไม่มีตู้ FlexxFast", OTHER in by_id, False)
    check("EDS เห็นสถานีปนยี่ห้อ", MIXED in by_id, True)
    check("EDS เห็นตู้ในสถานีปนยี่ห้อแค่ตัวเดียว",
          sorted(c["SN"] for c in by_id[MIXED]["chargers"]), [SN_FF])
    body = client.get("/all-stations/", cookies=egat).json()["stations"]
    by_id = {s["station_id"]: s for s in body}
    check("EGAT เห็นตู้ครบทั้งสองตัว",
          sorted(c["SN"] for c in by_id[MIXED]["chargers"]), sorted([SN_FF, SN_SINIO]))

    print("--- /uploads: ไฟล์ของตู้ยี่ห้ออื่นในสถานีที่เข้าถึงได้ ---")
    check("EDS โหลดไฟล์ของตู้ FlexxFast ได้",
          client.get(f"/uploads/pm/{SN_FF}/r1/pre/g1/x.jpg", cookies=eds).status_code, 200)
    check("EDS โหลดไฟล์ของตู้ SINIO ไม่ได้",
          client.get(f"/uploads/pm/{SN_SINIO}/r1/pre/g1/x.jpg", cookies=eds).status_code, 403)
    check("EGAT โหลดไฟล์ของตู้ SINIO ได้",
          client.get(f"/uploads/pm/{SN_SINIO}/r1/pre/g1/x.jpg", cookies=egat).status_code, 200)

    passed = sum(_results)
    print(f"\n{passed}/{len(_results)} passed")
    return 0 if passed == len(_results) else 1


if __name__ == "__main__":
    try:
        code = main_test()
    finally:
        teardown()
    sys.exit(code)
