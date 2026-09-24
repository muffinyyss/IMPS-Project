"""
ทดสอบด่านตรวจสิทธิ์กลาง (access_guard.py) และตัวกรองสถานีของ /pm-reports/*

ก่อนมีด่านนี้: 33 endpoint ไม่ตรวจ session เลย (รวมการเขียนค่า PLC ของตู้) และ PM
ส่งเอกสารของทุกสถานีให้ทุกบัญชีที่ล็อกอินได้ ไฟล์นี้ล็อกทั้งสองเรื่องไว้:
- ทุก route ของทุก router ต้องผ่านด่าน — include router ใหม่โดยลืม GUARD จะตกที่นี่
- owner เห็นเฉพาะสถานีตัวเอง ทั้งทาง URL (station_id / sn / charger_id) และทาง body (SN)

เป็น integration test — ต้องมี MongoDB รันอยู่ ไม่ได้ mock

    MONGO_URI=mongodb://localhost:27017/ python test_route_guard.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from contextlib import asynccontextmanager  # noqa: E402

import main  # noqa: E402
from fastapi.routing import APIRoute  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402
from access_guard import PUBLIC_ROUTES, enforce_access  # noqa: E402
from config import (  # noqa: E402
    SECRET_KEY, ALGORITHM, ACCESS_COOKIE_NAME, client1, station_collection, charger_collection,
)



@asynccontextmanager
async def _no_lifespan(_app):
    # ไม่เปิด watcher อีเมล / migration ตอนเทสต์ — แต่ต้องใช้ event loop เดียวตลอด
    # (Motor ผูกกับ loop แรกที่ใช้ TestClient แบบไม่มี with จะเปิด loop ใหม่ทุก request)
    yield


main.app.router.lifespan_context = _no_lifespan
client = TestClient(main.app)

STATION_A, STATION_B = "STN_QA_GUARD_A", "STN_QA_GUARD_B"
SN_A, SN_B = "SN-QA-GUARD-A", "SN-QA-GUARD-B"
OWNER_A, OWNER_B = "qa-owner-a", "qa-owner-b"

# route ที่ตั้งใจไม่ผ่านด่าน — มีการตรวจของตัวเอง
UNGUARDED_BY_DESIGN = {
    # ลิงก์ PDF ถูกแนบเข้าใบงาน Maximo (IN03) และเปิดจากฝั่ง Maximo ที่ไม่มี session iMPS
    "/pdf/{template}/{id}/export",
    "/pdf/{template}/{id}/{filename}",
    # ตรวจ session + สิทธิ์สถานีเองใน main.py (uploads_access.assert_upload_access)
    "/uploads/{rel_path:path}",
}

_results: list[bool] = []


def check(label: str, got, want) -> None:
    ok = got == want
    _results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}: got {got!r}, want {want!r}")


def cookies(role: str, user_id: str = "") -> dict:
    token = jwt.encode({"sub": f"{role}@qa", "user_id": user_id, "role": role}, SECRET_KEY, algorithm=ALGORITHM)
    return {ACCESS_COOKIE_NAME: token}


ADMIN = cookies("admin")
OWNER = cookies("owner", OWNER_A)


def setup() -> dict:
    teardown()
    station_collection.insert_many([
        {"station_id": STATION_A, "station_name": "QA Guard A", "user_id": OWNER_A},
        {"station_id": STATION_B, "station_name": "QA Guard B", "user_id": OWNER_B},
    ])
    res = charger_collection.insert_many([
        {"SN": SN_A, "station_id": STATION_A, "brand": "QA"},
        {"SN": SN_B, "station_id": STATION_B, "brand": "QA"},
    ])
    client1["PMReport"][SN_A].insert_one({"pm_date": "2031-01-15", "side": "post", "doc_name": "qa-a"})
    client1["PMReport"][SN_B].insert_one({"pm_date": "2032-02-15", "side": "post", "doc_name": "qa-b"})
    for sn in (SN_A, SN_B):
        client1["FaultStatus"][sn].insert_one({"message": f"qa fault {sn}", "read": False})
    return {"A": str(res.inserted_ids[0]), "B": str(res.inserted_ids[1])}


def teardown() -> None:
    station_collection.delete_many({"station_id": {"$in": [STATION_A, STATION_B, "STN_QA_GUARD_DEL"]}})
    charger_collection.delete_many({"SN": {"$in": [SN_A, SN_B, "SN-QA-GUARD-DEL"]}})
    for sn in (SN_A, SN_B):
        client1["PMReport"].drop_collection(sn)
        client1["FaultStatus"].drop_collection(sn)


def routes_without_guard() -> list[str]:
    missing = []
    for r in main.app.routes:
        if not isinstance(r, APIRoute) or r.path in UNGUARDED_BY_DESIGN:
            continue
        if not any(d.call is enforce_access for d in r.dependant.dependencies):
            missing.append(f"{sorted(r.methods)} {r.path}")
    return missing


def main_test() -> int:
    ids = setup()
    client.__enter__()
    try:
        print("--- ทุก route ผ่านด่าน ---")
        check("ไม่มี route ที่หลุดด่าน", routes_without_guard(), [])
        existing = {(m, r.path) for r in main.app.routes if isinstance(r, APIRoute) for m in r.methods}
        check("PUBLIC_ROUTES ไม่มีรายการค้าง (ทุกตัวมี route จริง)", sorted(PUBLIC_ROUTES - existing), [])

        print("--- endpoint ที่เคยเปิดโล่ง → ต้องมี session ---")
        for method, path, kwargs in [
            ("get", "/stations/", {}),
            ("get", "/username", {}),
            ("get", "/notifications/email-rules", {}),
            ("get", "/notifications/debug/fault-counters", {}),
            ("get", f"/cmurl/list?station_id={STATION_A}", {}),
            ("get", f"/actestreport/list?sn={SN_A}", {}),
            ("get", f"/station/info/public?sn={SN_A}", {}),
            ("post", "/setting/PLC/MAX", {"json": {"SN": SN_A}}),
        ]:
            r = getattr(client, method)(path, **kwargs)
            check(f"ไม่ล็อกอิน {method.upper()} {path.split('?')[0]}", r.status_code, 401)

        print("--- route สาธารณะยังเข้าได้ ---")
        r = client.post("/login/", json={"email": "nobody@qa.local", "password": "x"})
        check("login ผิดรหัส → 401 จาก login เอง ไม่ใช่จากด่าน",
              (r.status_code, r.json().get("detail")), (401, "Invalid email or password"))
        r = client.post("/maximo/pm/ping")
        check("webhook Maximo ไม่ถูกด่านขวาง", r.json().get("detail") != "Not authenticated", True)

        print("--- owner: เห็นเฉพาะสถานีตัวเอง (ค่าใน URL) ---")
        for label, path in [
            ("station_id ใน query", "/cmurl/list?station_id={st}"),
            ("sn ใน query", "/pmreport/list?sn={sn}"),
            ("station_id ใน path", "/MDB/equipment/{st}"),
            ("charger_id ใน path", "/charger/{cid}/monitor"),
        ]:
            mine = path.format(st=STATION_A, sn=SN_A, cid=ids["A"])
            theirs = path.format(st=STATION_B, sn=SN_B, cid=ids["B"])
            check(f"{label}: สถานีคนอื่น → 403", client.get(theirs, cookies=OWNER).status_code, 403)
            check(f"{label}: สถานีตัวเอง ไม่ถูกด่านขวาง", client.get(mine, cookies=OWNER).status_code != 403, True)
            check(f"{label}: admin ไม่ถูกด่านขวาง", client.get(theirs, cookies=ADMIN).status_code != 403, True)

        print("--- owner: SN ใน body ของคำสั่งตู้ ---")
        # ไม่มีฟิลด์ค่าที่เปลี่ยน → endpoint ตอบกลับก่อน publish MQTT (ไม่ส่งคำสั่งถึงตู้จริง)
        r = client.post("/setting/PLC/MAX", json={"SN": SN_B}, cookies=OWNER)
        check("ตั้งค่า PLC ตู้ของคนอื่น → 403", r.status_code, 403)
        r = client.post("/setting/PLC/MAX", json={"SN": SN_A}, cookies=OWNER)
        check("ตั้งค่า PLC ตู้ตัวเอง → 200", r.status_code, 200)

        print("--- owner: ค่าในฟอร์ม (finalize) ---")
        fake = "000000000000000000000000"
        r = client.post(f"/pmreport/{fake}/finalize", data={"sn": SN_B}, cookies=OWNER)
        check("finalize เอกสารของตู้คนอื่น → 403", r.status_code, 403)
        r = client.post(f"/pmreport/{fake}/finalize", data={"sn": SN_A}, cookies=OWNER)
        check("finalize ตู้ตัวเอง ไม่ถูกด่านขวาง (ไปถึง endpoint)", r.status_code != 403, True)
        r = client.post(f"/stationpmreport/{fake}/finalize", data={"station_id": STATION_B}, cookies=OWNER)
        check("finalize เอกสารของสถานีคนอื่น → 403", r.status_code, 403)
        r = client.post(f"/pmreport/{fake}/finalize", data={"sn": SN_B}, cookies=ADMIN)
        check("admin finalize ไม่ถูกด่านขวาง", r.status_code != 403, True)

        print("--- /pm-reports/* กรองตามสถานีที่เห็นได้ ---")
        def names(c):
            rows = client.get("/pm-reports/all-stations", cookies=c).json().get("reports", [])
            return sorted(r["document_name"] for r in rows if r["document_name"].startswith("qa-"))
        check("owner เห็นเฉพาะเอกสารสถานีตัวเอง", names(OWNER), ["qa-a"])
        check("admin เห็นทั้งสองสถานี", names(ADMIN), ["qa-a", "qa-b"])

        counts = client.get("/pm-reports/counts", cookies=OWNER).json()["counts"]
        check("counts ของ owner ไม่มีสถานีคนอื่น", STATION_B in counts, False)
        check("counts ของ owner นับสถานีตัวเอง", counts.get(STATION_A, {}).get("total"), 1)
        counts = client.get("/pm-reports/counts", cookies=ADMIN).json()["counts"]
        check("counts ของ admin มีทั้งสองสถานี",
              (counts.get(STATION_A, {}).get("total"), counts.get(STATION_B, {}).get("total")), (1, 1))

        months = client.get("/pm-reports/months", cookies=OWNER).json()["months"]
        check("months ของ owner ไม่รั่วเดือนของสถานีคนอื่น", ("2031-01" in months, "2032-02" in months), (True, False))

        print("--- /notifications/* กรองตามตู้ที่เห็นได้ ---")
        def fault_sns(c):
            rows = client.get("/notifications/all", cookies=c).json().get("notifications", [])
            return sorted({n["sn"] for n in rows if n["sn"] in (SN_A, SN_B)})
        check("owner เห็น fault เฉพาะตู้ตัวเอง", fault_sns(OWNER), [SN_A])
        check("admin เห็น fault ทุกตู้", fault_sns(ADMIN), [SN_A, SN_B])
        client.post("/notifications/read-all", cookies=OWNER)
        unread = {sn: client1["FaultStatus"][sn].count_documents({"read": {"$ne": True}}) for sn in (SN_A, SN_B)}
        check("read-all ของ owner ไม่แตะการแจ้งเตือนของตู้คนอื่น", unread, {SN_A: 0, SN_B: 1})

        print("--- ลบสถานี / ตู้: admin เท่านั้น ---")
        victim = station_collection.insert_one({"station_id": "STN_QA_GUARD_DEL", "user_id": OWNER_A}).inserted_id
        victim_charger = charger_collection.insert_one({"SN": "SN-QA-GUARD-DEL", "station_id": "STN_QA_GUARD_DEL"}).inserted_id
        for role, c in [("technician", cookies("technician")), ("owner เจ้าของสถานี", OWNER)]:
            check(f"{role} ลบสถานี → 403", client.delete(f"/delete_stations/{victim}", cookies=c).status_code, 403)
            check(f"{role} ลบตู้ → 403", client.delete(f"/delete_charger/{victim_charger}", cookies=c).status_code, 403)
        check("…สถานียังอยู่", station_collection.count_documents({"_id": victim}), 1)
        check("…ตู้ยังอยู่", charger_collection.count_documents({"_id": victim_charger}), 1)
        check("admin ลบตู้ได้", client.delete(f"/delete_charger/{victim_charger}", cookies=ADMIN).status_code, 204)
        check("admin ลบสถานีได้", client.delete(f"/delete_stations/{victim}", cookies=ADMIN).status_code, 204)
    finally:
        client.__exit__(None, None, None)
        teardown()

    passed = sum(_results)
    print(f"\n{passed}/{len(_results)} passed")
    return 0 if all(_results) else 1


if __name__ == "__main__":
    sys.exit(main_test())
