"""
ด่านตรวจสิทธิ์กลางของทุก router — ผูกไว้ตอน include_router ใน main.py

ทำไมต้องมี: audit ทั้ง API พบ endpoint 33 ตัวที่ไม่ตรวจ session เลย (รวมถึงการเขียนค่า
PLC ของตู้ชาร์จ และการแก้กฎอีเมลแจ้งเตือน) และอีก 102 ตัวที่รับ current มาแต่ไม่เคยใช้
— ใครล็อกอินได้ก็อ่านข้อมูลสถานีไหนก็ได้ ขอแค่รู้ station_id หรือ SN
การไล่แก้ทีละ endpoint จะพลาดตัวใหม่ที่เพิ่มเข้ามาเสมอ จึงกลับด้านค่าตั้งต้น:

1. ทุก route ต้องมี session — ยกเว้นที่อยู่ใน PUBLIC_ROUTES ซึ่งต้องประกาศชื่อทีละตัว
2. ผู้ใช้ที่ถูกจำกัดสถานี (owner, พนักงานที่ถูกจำกัดตามยี่ห้อ) ถูกตรวจ station_id / sn /
   charger_id ที่มากับ URL หรือฟอร์ม ด้วยกติกาเดียวกับหน้า EV Station (station_match_query)
   admin และสายปฏิบัติงานที่เห็นทุกสถานีไม่เสีย query เพิ่มเลยแม้แต่ครั้งเดียว

ครอบคลุมค่าใน path, query string และฟอร์ม (multipart / urlencoded — เช่น finalize, อัปโหลด)
ค่าที่มากับ body แบบ JSON ต้องตรวจใน endpoint เอง (ดู assert_scope_sn / assert_station_access)
"""
from typing import Iterator

from bson import ObjectId
from fastapi import HTTPException, Request
from starlette.concurrency import run_in_threadpool

from brand_scope import brand_scope_of, charger_in_scope
from config import charger_collection
from deps import get_current_user
from routers.stations import station_match_query
from uploads_access import (
    _station_id_for_charger_id, assert_sn_access, assert_station_access, user_can_access_station,
)

# (method, path template) ที่เรียกได้โดยไม่มี session — เพิ่มตัวใหม่ต้องมีเหตุผลกำกับ
PUBLIC_ROUTES = frozenset({
    # เข้าสู่ระบบ / กู้รหัสผ่าน — ผู้เรียกยังไม่มี session ตามนิยาม
    ("POST", "/login/"),
    ("POST", "/forgot-password/"),
    ("POST", "/reset-password/"),
    # ต่ออายุ / ออกจากระบบ — ตรวจ refresh token ในคุกกี้เอง
    ("POST", "/refresh"),
    ("POST", "/logout"),
    # webhook จาก Maximo — เครื่องต่อเครื่อง ป้องกันด้วย secret ใน header X-Maximo-Token
    ("POST", "/maximo/cm/work-order"),
    ("POST", "/maximo/pm-workorder"),
    ("POST", "/maximo/pm/open"),
    ("POST", "/maximo/pm/open/"),
    ("POST", "/maximo/pm/ping"),
})

_STATION_PARAMS = ("station_id",)
_SN_PARAMS = ("sn", "SN")
_CHARGER_ID_PARAMS = ("charger_id",)


def is_public(method: str, path: str) -> bool:
    return (method.upper(), path) in PUBLIC_ROUTES


_FORM_TYPES = ("multipart/form-data", "application/x-www-form-urlencoded")


def _values(request: Request, form, names) -> Iterator[str]:
    for name in names:
        for source in (request.path_params, request.query_params, form or {}):
            value = source.get(name)
            if isinstance(value, str) and value:   # ข้าม UploadFile
                yield value


def _assert_charger_id_access(current, charger_id: str) -> None:
    station_id = _station_id_for_charger_id(charger_id)
    if not station_id or not user_can_access_station(current, station_id):
        raise HTTPException(status_code=403, detail="Forbidden station")
    doc = charger_collection.find_one({"_id": ObjectId(charger_id)}, {"brand": 1})
    if not charger_in_scope(doc, brand_scope_of(current)):
        raise HTTPException(status_code=403, detail="Forbidden charger brand")


def assert_scope_sn(current, sn: str) -> None:
    """กติกาเดียวกับ enforce_access สำหรับ SN ที่มากับ body — ใช้ใน endpoint ที่สั่งงานตู้"""
    if station_match_query(current) == {}:
        return
    assert_sn_access(current, sn)


def _check_scope(current, request: Request, form) -> None:
    for station_id in _values(request, form, _STATION_PARAMS):
        assert_station_access(current, station_id)
    for sn in _values(request, form, _SN_PARAMS):
        assert_sn_access(current, sn)
    for charger_id in _values(request, form, _CHARGER_ID_PARAMS):
        _assert_charger_id_access(current, charger_id)


async def enforce_access(request: Request) -> None:
    """dependency ระดับ router — การตรวจที่ใช้ PyMongo (sync) ถูกส่งไป threadpool ไม่บล็อก event loop"""
    route = request.scope.get("route")
    if is_public(request.method, getattr(route, "path", request.url.path)):
        return

    current = get_current_user(request)          # ไม่มี session → 401 (ถอด JWT อย่างเดียว)

    # เห็นทุกสถานี ทุกยี่ห้อ → ไม่มีอะไรต้องตรวจต่อ
    if await run_in_threadpool(station_match_query, current) == {}:
        return

    # FastAPI อ่านฟอร์มของ route ที่มี Form/File ไว้แล้วก่อนเรียก dependency — request.form()
    # คืนค่าที่ cache ไว้ endpoint จึงยังอ่านฟอร์มเดิมได้ตามปกติ
    form = None
    if request.headers.get("content-type", "").startswith(_FORM_TYPES):
        form = await request.form()
    await run_in_threadpool(_check_scope, current, request, form)
