"""401 ของ "การเปิดหน้าโดยตรง" → พาไปหน้าแจ้ง session หมดอายุของ frontend แทน JSON ดิบ

ลิงก์ PDF / zip รูป (<a href={API_BASE/...} target="_blank">) เปิดแท็บใหม่ไปที่ backend ตรง ๆ
ไม่ผ่าน fetch ที่หน้าเว็บดัก 401 ไว้ — เปิดหน้ารายการค้างข้ามคืนแล้วกด PDF ตอนเช้า แท็บใหม่จะขึ้น
{"detail":"token_expired"} ให้ผู้ใช้เห็นเฉย ๆ

แยกจากการเรียก API ด้วย header ที่เบราว์เซอร์ตั้งเอง: Sec-Fetch-Mode = navigate เฉพาะตอนเปิดหน้า/แท็บ
fetch และ EventSource ได้ JSON 401 เหมือนเดิม (ตัวดักฝั่งหน้าเว็บอาศัย status นั้นอยู่)
เบราว์เซอร์เก่าที่ไม่ส่ง Sec-Fetch-* ดูจาก Accept: text/html แทน (fetch ส่ง */*, SSE ส่ง text/event-stream)
"""
import re
from urllib.parse import quote

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

SESSION_EXPIRED_PATH = "/auth/session-expired"
# detail ที่ส่งต่อให้หน้าเว็บเลือกข้อความ (token_expired / invalid_token / Not authenticated ...)
_SAFE_REASON = re.compile(r"[A-Za-z_ ]{1,40}")


def is_page_navigation(request: Request) -> bool:
    if request.method != "GET":
        return False
    mode = request.headers.get("sec-fetch-mode")
    if mode is not None:
        return mode == "navigate"
    return "text/html" in (request.headers.get("accept") or "")


def login_redirect_url(frontend_base_url: str, detail: object) -> str:
    reason = detail if isinstance(detail, str) and _SAFE_REASON.fullmatch(detail) else "token_expired"
    return f"{frontend_base_url.rstrip('/')}{SESSION_EXPIRED_PATH}?reason={quote(reason)}"


def install_login_redirect(app: FastAPI, frontend_base_url: str) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def _http_exception(request: Request, exc: StarletteHTTPException):
        if exc.status_code == 401 and is_page_navigation(request):
            return RedirectResponse(login_redirect_url(frontend_base_url, exc.detail), status_code=303)
        return await http_exception_handler(request, exc)   # อย่างอื่นตอบเหมือนค่าตั้งต้นของ FastAPI
