"""
ตรวจว่าทำไมผู้ใช้ได้ 403 "Forbidden station" ตอนบันทึก PM
ใช้ฟังก์ชันตรวจสิทธิ์ตัวจริงของ backend (station_match_query / user_can_access_station)

รัน (จากโฟลเดอร์ iMPS_platform/backend):
    python scripts/check_pm_access.py <username> <station_id> [SN]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import (  # noqa: E402
    users_collection, station_collection, charger_collection,
    canonical_role, SUPER_ADMIN_ROLE, ALL_STATIONS_ROLES,
)
from deps import UserClaims  # noqa: E402
from brand_scope import brand_scope_of, charger_in_scope, brand_of  # noqa: E402
from routers.stations import station_match_query  # noqa: E402
from uploads_access import user_can_access_station, _station_id_for_sn  # noqa: E402


def ok(flag):
    return "ผ่าน" if flag else "ไม่ผ่าน  <<<"


if len(sys.argv) < 3:
    sys.exit(__doc__)

username, station_id = sys.argv[1], sys.argv[2].strip()
sn = sys.argv[3].strip() if len(sys.argv) > 3 else None

# ---------- 1) ผู้ใช้ ----------
u = users_collection.find_one({"$or": [{"username": username}, {"email": username}]})
if not u:
    sys.exit(f"ไม่พบผู้ใช้ {username!r}")

raw_role = canonical_role(u.get("role")) or "user"
is_sa = raw_role == SUPER_ADMIN_ROLE
current = UserClaims(
    sub=username, user_id=str(u["_id"]), username=u.get("username"),
    role="admin" if is_sa else raw_role, effective_role=raw_role,
    is_super_admin=is_sa, company=u.get("company"),
)
scope = brand_scope_of(current)
print("== ผู้ใช้ ==")
print(f"  _id      : {u['_id']}")
print(f"  role     : {raw_role}  (เห็นทุกสถานีตาม role: {current.role in ALL_STATIONS_ROLES})")
print(f"  company  : {u.get('company')!r}")
print(f"  brand scope: {scope or 'ไม่จำกัดยี่ห้อ'}")

q = station_match_query(current)
if q == {}:
    print("\n=> ผู้ใช้นี้เห็นทุกสถานี — ด่านกลางไม่ตรวจเลย ถ้ายังได้ 403 ให้ดู JWT เก่า (ข้อ 4)")

# ---------- 2) สถานี ----------
st = station_collection.find_one({"station_id": station_id}, {"station_id": 1, "user_id": 1, "station_name": 1})
print("\n== สถานี ==")
print(f"  station_id {station_id!r} มีใน stations: {ok(bool(st))}")
if st:
    print(f"  station_name : {st.get('station_name')}")
    print(f"  user_id (เจ้าของ): {st.get('user_id')!r}  ตรงกับผู้ใช้: {str(st.get('user_id')) == str(u['_id'])}")
chargers = list(charger_collection.find({"station_id": station_id}, {"_id": 0, "SN": 1, "brand": 1}))
print(f"  ตู้ในสถานี ({len(chargers)}):")
for c in chargers:
    print(f"    SN={c.get('SN')!r:<24} brand={c.get('brand')!r:<14} ในขอบเขตยี่ห้อ: {charger_in_scope(c, scope)}")
print(f"  -> user_can_access_station: {ok(user_can_access_station(current, station_id))}")

# ---------- 3) SN ----------
if sn:
    print("\n== SN ==")
    sid = _station_id_for_sn(sn)
    print(f"  SN {sn!r} พบใน charger และมี station_id: {ok(bool(sid))}  (station_id={sid!r})")
    if sid and sid != station_id:
        print(f"  !! SN นี้อยู่สถานี {sid!r} ไม่ใช่ {station_id!r}")
    if sid:
        print(f"  -> เข้าถึงสถานีของ SN: {ok(user_can_access_station(current, sid))}")
        doc = charger_collection.find_one({"SN": sn}, {"brand": 1})
        print(f"  -> ยี่ห้อ {brand_of(doc)!r} อยู่ในขอบเขต: {ok(charger_in_scope(doc, scope))}")

# ---------- 4) หมายเหตุ ----------
print("\nหมายเหตุ: role/company ที่ใช้ตรวจจริงมาจาก JWT ตอน login — ถ้าเพิ่งแก้ role/company")
print("ของผู้ใช้ ต้องให้ผู้ใช้ logout แล้ว login ใหม่ ผลจริงจึงจะตรงกับสคริปต์นี้")
