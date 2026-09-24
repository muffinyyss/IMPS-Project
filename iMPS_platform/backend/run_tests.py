"""
รัน integration test ของ backend ทั้งชุด — ออก exit code ≠ 0 ถ้ามีไฟล์ใดตก

    MONGO_URI=mongodb://localhost:27017/ python run_tests.py

ต้องมี MongoDB และ JWT_SECRET_KEY (>= 32 ตัวอักษร) ใน environment หรือ .env
ทุกไฟล์สร้างข้อมูลทดสอบของตัวเอง (ชื่อขึ้นต้น QA / qa_) และลบทิ้งเมื่อจบ

ไม่รวม test_maximo_api.py โดยตั้งใจ: สคริปต์นั้นยิงไปที่ Maximo จริงและสร้าง Service Request
"""
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))

SUITES = [
    "test_session_cookies.py",           # คุกกี้ HttpOnly: login / refresh / logout
    "test_route_guard.py",               # ด่านสิทธิ์กลาง + ตัวกรองสถานีของ /pm-reports/*
    "test_request_budget.py",            # N+1 ที่ระดับ MongoDB ของ endpoint หลัก
    "test_uploads_access.py",            # สิทธิ์ไฟล์ /uploads
    "test_brand_scope.py",               # การจำกัดตามยี่ห้อตู้
    "test_test_reports_all_stations.py", # Test Dashboard / Test List
]


def main() -> int:
    failed = []
    for suite in SUITES:
        started = time.monotonic()
        proc = subprocess.run(
            [sys.executable, "-u", suite], cwd=HERE, capture_output=True, text=True, timeout=300,
        )
        summary = next((l for l in reversed(proc.stdout.splitlines()) if "passed" in l), "no summary")
        status = "OK  " if proc.returncode == 0 else "FAIL"
        print(f"[{status}] {suite:<38} {summary.strip():<16} {time.monotonic() - started:5.1f}s")
        if proc.returncode != 0:
            failed.append(suite)
            fails = [l for l in proc.stdout.splitlines() if "[FAIL]" in l]
            print("\n".join(f"        {l.strip()}" for l in fails) or proc.stderr[-2000:])
    print(f"\n{len(SUITES) - len(failed)}/{len(SUITES)} suites passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
