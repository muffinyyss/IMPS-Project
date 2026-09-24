"""
ทดสอบวงจร session ผ่านคุกกี้ HttpOnly: login → /me → refresh → logout

เดิม access/refresh token ถูกส่งกลับใน body แล้ว frontend เก็บลง localStorage
script ใดก็ตามที่ถูกฉีดเข้าหน้าเว็บจึงอ่าน token ไปใช้นอกเบราว์เซอร์ได้ ตอนนี้ token
อยู่ในคุกกี้ HttpOnly เท่านั้น — ไม่มีใน body ของ /login, /refresh, /users/switch-role

เป็น integration test — ต้องมี MongoDB รันอยู่ ไม่ได้ mock

    MONGO_URI=mongodb://localhost:27017/ python test_session_cookies.py

ออก exit code 0 ถ้าผ่านหมด
"""
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

import bcrypt  # noqa: E402
import main  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from config import ACCESS_COOKIE_NAME, users_collection  # noqa: E402
from session_cookies import REFRESH_COOKIE_NAME  # noqa: E402

EMAIL = "qa_session_cookies@test.local"
PASSWORD = "qa-session-password-1"

_results: list[bool] = []


def check(label: str, got, want) -> None:
    ok = got == want
    _results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}: got {got!r}, want {want!r}")


def set_cookie_headers(resp) -> list[str]:
    return [v for k, v in resp.headers.multi_items() if k.lower() == "set-cookie"]


def cookie_header(resp, name: str) -> str:
    return next((h for h in set_cookie_headers(resp) if h.startswith(f"{name}=")), "")


def attrs(header: str) -> set[str]:
    return {p.strip().split("=")[0].lower() for p in header.split(";")[1:]}


def cleared(resp, name: str) -> bool:
    h = cookie_header(resp, name).lower()
    return bool(h) and ("max-age=0" in h or "expires=thu, 01 jan 1970" in h)


def setup() -> None:
    users_collection.delete_many({"email": EMAIL})
    users_collection.insert_one({
        "email": EMAIL,
        "username": "qa_session",
        "password": bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode(),
        "role": "technician",
        "company": "QA",
        "station_id": [],
    })


def teardown() -> None:
    users_collection.delete_many({"email": EMAIL})


def login(client: TestClient, **headers):
    return client.post("/login/", json={"email": EMAIL, "password": PASSWORD}, headers=headers)


def main_test() -> int:
    setup()
    try:
        print("--- /login ---")
        client = TestClient(main.app)
        r = login(client)
        check("login 200", r.status_code, 200)
        body = r.json()
        check("body ไม่มี access_token", "access_token" in body, False)
        check("body ไม่มี refresh_token", "refresh_token" in body, False)
        check("body ยังมีโปรไฟล์ user", (body.get("user") or {}).get("email"), EMAIL)
        acc, ref = cookie_header(r, ACCESS_COOKIE_NAME), cookie_header(r, REFRESH_COOKIE_NAME)
        check("ตั้งคุกกี้ access", bool(acc), True)
        check("ตั้งคุกกี้ refresh", bool(ref), True)
        check("access เป็น HttpOnly", "httponly" in attrs(acc), True)
        check("refresh เป็น HttpOnly", "httponly" in attrs(ref), True)
        check("access เป็น SameSite", "samesite" in attrs(acc), True)
        check("http ธรรมดา → ไม่ติด Secure (dev ใช้ได้)", "secure" in attrs(acc), False)

        r_https = login(TestClient(main.app), origin="https://imps.egat.co.th")
        check("ผ่าน https (Origin) → Secure",
              "secure" in attrs(cookie_header(r_https, ACCESS_COOKIE_NAME)), True)
        r_proxy = login(TestClient(main.app), **{"x-forwarded-proto": "https"})
        check("หลัง proxy (X-Forwarded-Proto) → Secure",
              "secure" in attrs(cookie_header(r_proxy, REFRESH_COOKIE_NAME)), True)

        # login ล่าสุดแทนที่ session เดิม — ต้อง login ใหม่ด้วย client หลัก
        r = login(client)
        check("/me ด้วยคุกกี้อย่างเดียว", client.get("/me").status_code, 200)

        print("--- /refresh ---")
        r = client.post("/refresh")
        check("refresh ด้วยคุกกี้อย่างเดียว 200", r.status_code, 200)
        check("refresh ไม่คืน token ใน body", "access_token" in (r.json() or {}), False)
        check("refresh ออกคุกกี้ access ใหม่", bool(cookie_header(r, ACCESS_COOKIE_NAME)), True)

        # session ที่ถูกเก็บใน Mongo อ่านกลับมาเป็น datetime แบบ naive — เดิม
        # เทียบกับ now (aware) แล้วโยน TypeError → 500 ทุกครั้งที่ token หมดอายุ
        u = users_collection.find_one({"email": EMAIL}, {"refreshTokens": 1})
        legacy_token = u["refreshTokens"][0]["token"]
        fresh = TestClient(main.app)
        r = fresh.post("/refresh", json={"refresh_token": legacy_token})
        check("refresh token เดิมจาก localStorage (ส่งใน body) ยังใช้ได้", r.status_code, 200)
        check("…และถูกย้ายเข้าคุกกี้", bool(cookie_header(r, REFRESH_COOKIE_NAME)), True)

        r = TestClient(main.app).post("/refresh")
        check("ไม่มี session เลย → 401", r.status_code, 401)

        r = TestClient(main.app, cookies={REFRESH_COOKIE_NAME: "not-a-jwt"}).post("/refresh")
        check("refresh token เสีย → 401", r.status_code, 401)
        check("…และล้างคุกกี้ refresh ทิ้ง", cleared(r, REFRESH_COOKIE_NAME), True)

        users_collection.update_one(
            {"email": EMAIL},
            {"$set": {"refreshTokens.0.expiresAt": datetime.now(timezone.utc) - timedelta(minutes=1)}},
        )
        r = client.post("/refresh")
        check("session หมดอายุใน DB → 401 ไม่ใช่ 500", r.status_code, 401)

        print("--- /logout ---")
        login(client)
        ref_before = client.cookies.get(REFRESH_COOKIE_NAME)
        r = client.post("/logout")
        check("logout 200", r.status_code, 200)
        check("ล้างคุกกี้ access", cleared(r, ACCESS_COOKIE_NAME), True)
        check("ล้างคุกกี้ refresh", cleared(r, REFRESH_COOKIE_NAME), True)
        u = users_collection.find_one({"email": EMAIL}, {"refreshTokens": 1})
        check("session ถูกเพิกถอนใน DB",
              any(t.get("token") == ref_before for t in (u.get("refreshTokens") or [])), False)
        r = TestClient(main.app, cookies={REFRESH_COOKIE_NAME: ref_before}).post("/refresh")
        check("refresh token ที่ logout แล้วใช้ต่อไม่ได้", r.status_code, 401)
        check("logout ซ้ำ (ไม่มีคุกกี้) ไม่พัง", TestClient(main.app).post("/logout").status_code, 200)

        print("--- /users/switch-role ---")
        login(client)
        r = client.post("/users/switch-role", json={"role": "admin"})
        check("ไม่ใช่ super admin → 403", r.status_code, 403)
    finally:
        teardown()

    passed = sum(_results)
    print(f"\n{passed}/{len(_results)} passed")
    return 0 if all(_results) else 1


if __name__ == "__main__":
    sys.exit(main_test())
