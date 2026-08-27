"""Company CRUD — รายชื่อบริษัทแยกประเภท owner / vendor (เมนู Company, เฉพาะ admin/super_admin)"""
import re
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from config import companies_coll_async
from deps import UserClaims, get_current_user

router = APIRouter(prefix="/companies", tags=["companies"])

COMPANY_TYPES = {"owner", "vendor"}


def _require_admin(current: UserClaims):
    # super_admin ถูก normalize เป็น admin ที่ deps.get_current_user แล้ว — เช็ค admin ที่เดียวครอบทั้งคู่
    if (current.role or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="admin only")


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=1)
    type: Literal["owner", "vendor"]
    tel: str = ""
    email: str = ""
    address: str = ""


def _serialize(doc: dict) -> dict:
    created_at = doc.get("created_at")
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "type": doc.get("type", ""),
        "tel": doc.get("tel", ""),
        "email": doc.get("email", ""),
        "address": doc.get("address", ""),
        "created_by": doc.get("created_by", ""),
        "created_at": created_at.isoformat() if isinstance(created_at, datetime) else created_at,
    }


@router.get("/")
async def list_companies(
    type: Optional[str] = Query(None, description="owner | vendor"),
    current: UserClaims = Depends(get_current_user),
):
    _require_admin(current)
    query: dict = {}
    if type:
        if type not in COMPANY_TYPES:
            raise HTTPException(status_code=400, detail="type must be owner or vendor")
        query["type"] = type
    docs = await companies_coll_async.find(query).sort("name", 1).to_list(length=None)
    return {"companies": [_serialize(d) for d in docs]}


@router.post("/")
async def create_company(payload: CompanyCreate, current: UserClaims = Depends(get_current_user)):
    _require_admin(current)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    # กันชื่อซ้ำภายในประเภทเดียวกัน (ไม่สนตัวพิมพ์เล็ก-ใหญ่)
    dup = await companies_coll_async.find_one({
        "type": payload.type,
        "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"},
    })
    if dup:
        raise HTTPException(status_code=409, detail="company already exists")

    doc = {
        "name": name,
        "type": payload.type,
        "tel": payload.tel.strip(),
        "email": payload.email.strip(),
        "address": payload.address.strip(),
        "created_by": current.username or "",
        "created_at": datetime.now(timezone.utc),
    }
    result = await companies_coll_async.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)
