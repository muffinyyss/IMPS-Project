from bson.objectid import ObjectId
from fastapi import Request, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError
from config import SECRET_KEY, ALGORITHM, ACCESS_COOKIE_NAME, users_collection

class UserClaims(BaseModel):
    sub: str
    user_id: Optional[str] = None
    username: Optional[str] = None
    role: str = "user"
    company: Optional[str] = None
    station_ids: List[str] = []

def get_current_user(request: Request) -> UserClaims:
    token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="invalid_token")
        station_ids = payload.get("station_ids") or []
        if not isinstance(station_ids, list):
            station_ids = [station_ids]
        return UserClaims(
            sub=sub,
            user_id=payload.get("user_id"),
            username=payload.get("username"),
            role=payload.get("role", "user"),
            company=payload.get("company"),
            station_ids=station_ids,
        )
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="token_expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="invalid_token")


def get_user_station_ids(current: UserClaims) -> List[str]:
    """
    สถานีที่ user เห็นได้ — อ่านสดจาก DB ไม่ใช้ค่าใน JWT

    JWT อบ station_ids ไว้ตอน login และมีอายุ 24 ชม. แต่การ assign งาน CM เพิ่มสถานีให้ช่างได้
    ระหว่างที่ token ยังไม่หมดอายุ ถ้าอ่านจาก JWT ช่างจะไม่เห็นสถานีที่เพิ่งถูกมอบหมายจนกว่าจะ login ใหม่
    """
    if not current.user_id:
        return list(current.station_ids)
    try:
        user = users_collection.find_one({"_id": ObjectId(current.user_id)}, {"station_id": 1})
    except Exception:
        return list(current.station_ids)   # user_id เพี้ยน — ถอยไปใช้ค่าใน token
    if not user:
        return list(current.station_ids)
    ids = user.get("station_id") or []
    if not isinstance(ids, list):
        ids = [ids]
    return [str(x) for x in ids]
