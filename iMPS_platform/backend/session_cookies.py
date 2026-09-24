"""
คุกกี้ session — ที่เดียวที่กำหนดว่า token ถูกเก็บในเบราว์เซอร์อย่างไร

access และ refresh token อยู่ในคุกกี้ HttpOnly เท่านั้น ไม่ส่งกลับใน body:
script ที่ถูกฉีดเข้าหน้าเว็บ (XSS) จึงอ่าน token ไปใช้นอกเบราว์เซอร์ไม่ได้
ส่วน frontend ไม่ต้องแตะ token เลย — แค่ส่ง credentials: "include"

Secure ตั้งตามโปรโตคอลที่เบราว์เซอร์เห็นจริง: prod อยู่หลัง nginx (TLS จบที่ nginx
แล้วส่งต่อเป็น http) จึงดู X-Forwarded-Proto / Origin ก่อน scheme ของ request
dev บน http://localhost ได้คุกกี้ที่ไม่ Secure ตามปกติ บังคับได้ด้วย COOKIE_SECURE=1/0
"""
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request, Response

from config import ACCESS_COOKIE_NAME

REFRESH_COOKIE_NAME = "refresh_token"

# path "/" ไม่ใช่ "/refresh": middleware ของ Next ต้องเห็นว่ามี refresh token
# เพื่อปล่อยหน้า dashboard ผ่านเมื่อ access หมดอายุแล้ว (frontend จะ refresh เอง)
_COOKIE_PATH = "/"
_SAMESITE = "lax"


def cookie_secure(request: Request) -> bool:
    forced = os.getenv("COOKIE_SECURE", "").strip().lower()
    if forced in ("1", "true", "yes"):
        return True
    if forced in ("0", "false", "no"):
        return False
    proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    if proto:
        return proto == "https"
    if request.url.scheme == "https":
        return True
    return (request.headers.get("origin") or "").lower().startswith("https://")


def _set(response: Response, request: Request, name: str, value: str, max_age: int) -> None:
    response.set_cookie(
        key=name,
        value=value,
        max_age=max(int(max_age), 0),
        path=_COOKIE_PATH,
        httponly=True,
        secure=cookie_secure(request),
        samesite=_SAMESITE,
    )


def set_session_cookies(
    response: Response,
    request: Request,
    access_token: str,
    access_max_age: int,
    refresh_token: Optional[str] = None,
    refresh_max_age: Optional[int] = None,
) -> None:
    _set(response, request, ACCESS_COOKIE_NAME, access_token, access_max_age)
    if refresh_token:
        _set(response, request, REFRESH_COOKIE_NAME, refresh_token, refresh_max_age or 0)


def clear_session_cookies(response: Response, request: Request) -> None:
    for name in (ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME):
        response.delete_cookie(
            key=name,
            path=_COOKIE_PATH,
            httponly=True,
            secure=cookie_secure(request),
            samesite=_SAMESITE,
        )


def as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """PyMongo คืน datetime แบบ naive (เป็น UTC) — ต้องติด tzinfo ก่อนเทียบกับ now แบบ aware"""
    if value is None or not isinstance(value, datetime):
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
