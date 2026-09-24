"""
กันการถอยหลังเป็น N+1 ที่ระดับฐานข้อมูล: เพิ่มสถานีเปล่า 50 แห่ง จำนวนคำสั่ง Mongo
ของ endpoint หลักต้องไม่เพิ่มตาม

ข้อมูลจริงเก็บ 1 collection ต่อ SN / ต่อสถานี ถ้า endpoint วนยิงทุกคีย์โดยไม่ถามก่อนว่า
collection ไหนมีจริง คำสั่งจะโตตามจำนวนสถานี (เคยวัดได้ 4,226 คำสั่งต่อ 1 request ของ
/pm-reports/counts ทั้งที่มีจริงแค่ 238) — สถานีเปล่าไม่มี collection เลย จึงต้องไม่มีต้นทุน
การวัดแบบ "ส่วนต่าง" ไม่ขึ้นกับขนาดข้อมูลในเครื่อง ใช้ได้ทั้ง DB dev และ DB เปล่าใน CI

เป็น integration test — ต้องมี MongoDB รันอยู่ ไม่ได้ mock

    MONGO_URI=mongodb://localhost:27017/ python test_request_budget.py
"""
import os
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from pymongo import monitoring  # noqa: E402


class _Counter(monitoring.CommandListener):
    # คำสั่งดูแลการเชื่อมต่อ ไม่ใช่งานของ endpoint
    IGNORED = {"hello", "ismaster", "isMaster", "ping", "endSessions", "saslStart", "saslContinue",
               "buildInfo", "getLastError", "killCursors"}

    def __init__(self):
        self._lock = threading.Lock()
        self.n = 0

    def started(self, event):
        if event.command_name not in self.IGNORED:
            with self._lock:
                self.n += 1

    def succeeded(self, event):
        pass

    def failed(self, event):
        pass


COUNTER = _Counter()
monitoring.register(COUNTER)   # ต้องก่อน import config — client ถูกสร้างตอน import

from contextlib import asynccontextmanager  # noqa: E402

import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402
from config import SECRET_KEY, ALGORITHM, ACCESS_COOKIE_NAME, station_collection, charger_collection  # noqa: E402


@asynccontextmanager
async def _no_lifespan(_app):
    yield


main.app.router.lifespan_context = _no_lifespan
client = TestClient(main.app)
ADMIN = {ACCESS_COOKIE_NAME: jwt.encode({"sub": "admin@qa", "role": "admin"}, SECRET_KEY, algorithm=ALGORITHM)}

PREFIX = "STN_QA_BUDGET_"
EXTRA = 50
# คำสั่งที่ยอมให้เพิ่มได้เมื่อสถานีเพิ่ม 50 แห่ง: getMore ของ cursor ที่ยาวขึ้น
ALLOWED_DELTA = 3

ENDPOINTS = [
    "/all-stations/?view=list",
    "/charger-onoff/bulk",
    "/station-availability/bulk",
    "/pm-reports/counts",
    "/pm-reports/months",
    "/pm-reports/all-stations",
    "/cmreport/list-all",
    "/test-reports/all-stations",
]

_results: list[bool] = []


def check(label: str, ok: bool, detail: str) -> None:
    _results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}: {detail}")


def commands(path: str) -> int:
    before = COUNTER.n
    r = client.get(path, cookies=ADMIN)
    if r.status_code != 200:
        raise AssertionError(f"{path} → HTTP {r.status_code}: {r.text[:200]}")
    return COUNTER.n - before


def seed() -> None:
    unseed()
    station_collection.insert_many([
        {"station_id": f"{PREFIX}{i:03d}", "station_name": f"QA budget {i}"} for i in range(EXTRA)
    ])
    charger_collection.insert_many([
        {"SN": f"SN-QA-BUDGET-{i:03d}", "station_id": f"{PREFIX}{i:03d}", "chargeBoxID": f"QA{i:03d}"}
        for i in range(EXTRA)
    ])


def unseed() -> None:
    station_collection.delete_many({"station_id": {"$regex": f"^{PREFIX}"}})
    charger_collection.delete_many({"SN": {"$regex": "^SN-QA-BUDGET-"}})


def main_test() -> int:
    client.__enter__()
    try:
        for path in ENDPOINTS:          # อุ่นเครื่อง: cache ยี่ห้อ / ชื่อ collection
            commands(path)
        base = {path: commands(path) for path in ENDPOINTS}
        seed()
        grown = {path: commands(path) for path in ENDPOINTS}
    finally:
        unseed()
        client.__exit__(None, None, None)

    print(f"--- +{EXTRA} สถานีเปล่า (และตู้เปล่า {EXTRA} ตู้) ---")
    for path in ENDPOINTS:
        delta = grown[path] - base[path]
        check(path, delta <= ALLOWED_DELTA, f"{base[path]} → {grown[path]} คำสั่ง (+{delta}, ยอมได้ ≤ {ALLOWED_DELTA})")

    passed = sum(_results)
    print(f"\n{passed}/{len(_results)} passed")
    return 0 if all(_results) else 1


if __name__ == "__main__":
    sys.exit(main_test())
