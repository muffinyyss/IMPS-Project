"""
SSE ต้องปิดเองเมื่อ access token หมดอายุ (deps.session_expired)

get_current_user ตรวจ token แค่ตอนเปิด stream — เดิมหน้า CBM/MDB/Setting ที่เปิดค้างไว้
ยังได้ข้อมูลสดต่อไปหลังตี 3 ทั้งที่ session หมดแล้ว ไฟล์นี้ล็อกพฤติกรรมใหม่ไว้:
- UserClaims เก็บ exp จาก JWT
- loop ของ SSE เห็นว่าหมดอายุแล้วหยุดส่ง → เบราว์เซอร์ต่อใหม่ → 401

ต้องมี MongoDB และ JWT_SECRET_KEY เหมือนเทสต์ตัวอื่น (config.py ต่อ MongoDB ตั้งแต่ตอน import)
แต่ไม่ได้เขียน/อ่านข้อมูลใด ๆ — endpoint ในไฟล์นี้เป็นตัวจำลองที่เขียนแบบเดียวกับ SSE จริง

    MONGO_URI=mongodb://localhost:27017/ python test_sse_session.py
"""
import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import Depends, FastAPI, Request  # noqa: E402
from fastapi.responses import StreamingResponse  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402

from config import ACCESS_COOKIE_NAME, ALGORITHM, SECRET_KEY  # noqa: E402
from deps import UserClaims, get_current_user, session_expired  # noqa: E402


def token(exp_in_seconds: float) -> str:
    return jwt.encode(
        {"sub": "qa@local.test", "user_id": "u1", "role": "admin", "exp": int(time.time() + exp_in_seconds)},
        SECRET_KEY, algorithm=ALGORITHM,
    )


# endpoint จำลองที่เขียนแบบเดียวกับ /CBM, /setting, /MDB/{id} ฯลฯ
app = FastAPI()


@app.get("/stream")
async def stream(request: Request, current: UserClaims = Depends(get_current_user)):
    async def gen():
        while True:
            if await request.is_disconnected() or session_expired(current):
                break
            yield "data: tick\n\n"
            await asyncio.sleep(0.2)
    return StreamingResponse(gen(), media_type="text/event-stream")


client = TestClient(app)


def test_claims_carry_token_exp():
    t = token(3600)
    exp = jwt.get_unverified_claims(t)["exp"]

    class R:
        cookies = {ACCESS_COOKIE_NAME: t}
        headers = {}
    assert get_current_user(R()).exp == exp


def test_session_expired():
    assert session_expired(UserClaims(sub="x", exp=int(time.time()) - 1)) is True
    assert session_expired(UserClaims(sub="x", exp=int(time.time()) + 60)) is False
    assert session_expired(UserClaims(sub="x")) is False   # token ไม่มี exp (เช่นสร้างใน script) → ไม่ตัด


def test_stream_closes_when_token_expires():
    started = time.time()
    with client.stream("GET", "/stream", cookies={ACCESS_COOKIE_NAME: token(2)}) as r:
        assert r.status_code == 200
        ticks = sum(1 for line in r.iter_lines() if line == "data: tick")
    elapsed = time.time() - started
    assert ticks >= 2          # ส่งข้อมูลตามปกติระหว่างที่ token ยังใช้ได้
    assert elapsed < 6         # แล้วปิดเองหลังหมดอายุ (เดิมจะค้างไปเรื่อย ๆ)


def test_reconnect_after_expiry_is_401():
    r = client.get("/stream", cookies={ACCESS_COOKIE_NAME: token(-1)})
    assert r.status_code == 401
    assert r.json()["detail"] == "token_expired"


if __name__ == "__main__":
    _tests = [(n, f) for n, f in list(globals().items()) if n.startswith("test_") and callable(f)]
    for _name, _fn in _tests:
        _fn()
        print("[PASS]", _name)
    print(f"{len(_tests)} passed")
