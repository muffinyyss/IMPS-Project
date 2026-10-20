"""
401 จากการเปิดลิงก์ตรง (PDF / zip รูปในแท็บใหม่) ต้องพาไปหน้า "เซสชันหมดอายุ" ของ frontend
ส่วน fetch / SSE ยังต้องได้ JSON 401 เหมือนเดิม — ตัวดักฝั่งหน้าเว็บอาศัย status นั้น

ไม่ต้องมี MongoDB (ไม่ import config)

    python test_login_redirect.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import Depends, FastAPI, HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from auth_redirect import install_login_redirect  # noqa: E402

FRONT = "https://imps.example.test/"

app = FastAPI()
install_login_redirect(app, FRONT)


def need_session():
    raise HTTPException(status_code=401, detail="token_expired")


@app.get("/pdf/cm/{rid}/export", dependencies=[Depends(need_session)])
def pdf(rid: str):
    return {"ok": True}


@app.get("/no-cookie")
def no_cookie():
    raise HTTPException(status_code=401, detail="Not authenticated")


@app.get("/weird")
def weird():
    raise HTTPException(status_code=401, detail="<script>x</script>")


@app.get("/forbidden")
def forbidden():
    raise HTTPException(status_code=403, detail="Forbidden")


@app.post("/save")
def save():
    raise HTTPException(status_code=401, detail="token_expired")


client = TestClient(app, follow_redirects=False)
NAV = {"sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "accept": "text/html,application/xhtml+xml,*/*"}


def test_link_in_new_tab_redirects_to_session_expired_page():
    r = client.get("/pdf/cm/abc/export?station_id=st1&dl=0", headers=NAV)
    assert r.status_code == 303
    assert r.headers["location"] == "https://imps.example.test/auth/session-expired?reason=token_expired"


def test_never_logged_in_gets_not_authenticated_reason():
    r = client.get("/no-cookie", headers=NAV)
    assert r.headers["location"].endswith("/auth/session-expired?reason=Not%20authenticated")


def test_unexpected_detail_is_not_echoed_into_url():
    r = client.get("/weird", headers=NAV)
    assert r.headers["location"].endswith("?reason=token_expired")


def test_fetch_still_gets_json_401():
    r = client.get("/pdf/cm/abc/export", headers={"sec-fetch-mode": "cors", "accept": "*/*"})
    assert r.status_code == 401
    assert r.json() == {"detail": "token_expired"}


def test_sse_still_gets_json_401():
    r = client.get("/pdf/cm/abc/export", headers={"sec-fetch-mode": "cors", "accept": "text/event-stream"})
    assert r.status_code == 401


def test_old_browser_without_sec_fetch_uses_accept_header():
    assert client.get("/pdf/cm/abc/export", headers={"accept": "text/html"}).status_code == 303
    assert client.get("/pdf/cm/abc/export", headers={"accept": "*/*"}).status_code == 401


def test_other_statuses_and_methods_unchanged():
    r = client.get("/forbidden", headers=NAV)
    assert r.status_code == 403 and r.json() == {"detail": "Forbidden"}
    assert client.get("/missing", headers=NAV).status_code == 404
    assert client.post("/save", headers=NAV).status_code == 401


if __name__ == "__main__":
    _tests = [(n, f) for n, f in list(globals().items()) if n.startswith("test_") and callable(f)]
    for _name, _fn in _tests:
        _fn()
        print("[PASS]", _name)
    print(f"{len(_tests)} passed")
