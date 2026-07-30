"""
ทดสอบสิทธิ์การเข้าถึงไฟล์ /uploads และ endpoint อัปโหลด

เดิม /uploads ถูก mount ด้วย StaticFiles ทำให้รูป PM/CM ทุกไฟล์โหลดได้โดยไม่ต้อง
ล็อกอิน และ endpoint อัปโหลดก็ไม่เคยตรวจว่าผู้ใช้มีสิทธิ์ในสถานีนั้นจริงหรือไม่

เป็น integration test — ต้องมี MongoDB รันอยู่ ไม่ได้ mock

    JWT_SECRET_KEY=<อย่างน้อย 32 ตัวอักษร> python test_uploads_access.py

ออก exit code 0 ถ้าผ่านหมด ใช้ใน CI ได้เลย
"""
import os
import pathlib
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402
from config import (  # noqa: E402
    SECRET_KEY, ALGORITHM, ACCESS_COOKIE_NAME,
    station_collection, charger_collection,
)
from routers.pm_helpers import UPLOADS_ROOT  # noqa: E402

client = TestClient(main.app)

STATION = "STN_TEST_UPLOADS_ACCESS"
OTHER = "STN_TEST_SOMEWHERE_ELSE"
SN = "SN-TEST-UPLOADS-ACCESS"

_results: list[bool] = []


def check(label: str, got, want) -> None:
    ok = got == want
    _results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}: got {got!r}, want {want!r}")


def token(role: str, station_ids: list[str], user_id: str = "") -> str:
    return jwt.encode(
        {"sub": "tester", "user_id": user_id, "role": role, "station_ids": station_ids},
        SECRET_KEY, algorithm=ALGORITHM,
    )


def cookies(*args, **kwargs) -> dict:
    return {ACCESS_COOKIE_NAME: token(*args, **kwargs)}


def setup() -> tuple[str, str]:
    station_collection.delete_many({"station_id": {"$in": [STATION, OTHER]}})
    charger_collection.delete_many({"SN": SN})
    station_collection.insert_one({"station_id": STATION, "user_id": "owner-1"})
    charger_collection.insert_one({"SN": SN, "station_id": STATION})

    d1 = pathlib.Path(UPLOADS_ROOT) / "stationpm" / STATION / "r1" / "pre" / "g1"
    d1.mkdir(parents=True, exist_ok=True)
    (d1 / "a.jpg").write_bytes(b"AAA")

    d2 = pathlib.Path(UPLOADS_ROOT) / "pm" / SN / "r1" / "pre" / "g1"
    d2.mkdir(parents=True, exist_ok=True)
    (d2 / "b.jpg").write_bytes(b"BBB")

    return f"stationpm/{STATION}/r1/pre/g1/a.jpg", f"pm/{SN}/r1/pre/g1/b.jpg"


def teardown() -> None:
    station_collection.delete_many({"station_id": {"$in": [STATION, OTHER]}})
    charger_collection.delete_many({"SN": SN})


def main_test() -> int:
    rel_station, rel_sn = setup()
    try:
        print("--- /uploads: ปฏิเสธ ---")
        check("ไม่ล็อกอิน", client.get(f"/uploads/{rel_station}").status_code, 401)
        check("ล็อกอินแต่คนละสถานี (station path)",
              client.get(f"/uploads/{rel_station}", cookies=cookies("technician", [OTHER])).status_code, 403)
        # เคยพลาดตรงนี้: merge dict ทำให้ station_id ทับ filter สิทธิ์จนผ่านทุกครั้ง
        check("ล็อกอินแต่คนละสถานี (SN path)",
              client.get(f"/uploads/{rel_sn}", cookies=cookies("technician", [OTHER])).status_code, 403)
        check("owner คนอื่น",
              client.get(f"/uploads/{rel_station}", cookies=cookies("owner", [], "owner-2")).status_code, 403)

        admin = cookies("admin", [])
        check("path traversal ไม่หลุด",
              client.get("/uploads/../config.py", cookies=admin).status_code != 200, True)
        check("pdf_cache ไม่เปิดผ่าน /uploads",
              client.get("/uploads/pdf_cache/x/y.pdf", cookies=admin).status_code != 200, True)

        print("--- /uploads: อนุญาต ---")
        tech = cookies("technician", [STATION])
        check("admin เข้าได้", client.get(f"/uploads/{rel_station}", cookies=admin).status_code, 200)
        check("technician สถานีตัวเอง (station path)",
              client.get(f"/uploads/{rel_station}", cookies=tech).status_code, 200)
        check("technician สถานีตัวเอง (SN path)",
              client.get(f"/uploads/{rel_sn}", cookies=tech).status_code, 200)
        check("owner เจ้าของสถานี",
              client.get(f"/uploads/{rel_station}", cookies=cookies("owner", [], "owner-1")).status_code, 200)
        check("เนื้อไฟล์ถูกต้อง",
              client.get(f"/uploads/{rel_sn}", cookies=tech).content, b"BBB")

        print("--- endpoint อัปโหลด: ต้องกันข้ามสถานี ---")
        files = {"files": ("x.jpg", b"\xff\xd8\xff\xe0test", "image/jpeg")}
        r = client.post(
            "/pmreport/000000000000000000000000/pre/photos",
            data={"sn": SN, "group": "g1", "side": "pre"},
            files=files, cookies=cookies("technician", [OTHER]),
        )
        check("upload ตู้ชาร์จข้ามสถานี", r.status_code, 403)

        r = client.post(
            "/stationpmreport/000000000000000000000000/pre/photos",
            data={"station_id": STATION, "group": "g1", "side": "pre"},
            files=files, cookies=cookies("technician", [OTHER]),
        )
        check("upload station report ข้ามสถานี", r.status_code, 403)
    finally:
        teardown()

    passed = sum(_results)
    print(f"\n{passed}/{len(_results)} passed")
    return 0 if all(_results) else 1


if __name__ == "__main__":
    sys.exit(main_test())
