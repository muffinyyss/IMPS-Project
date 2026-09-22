"""Company CRUD — รายชื่อบริษัทแยกประเภท owner / vendor / outsource (เมนู Company, เฉพาะ admin/super_admin)

โครงของ type=vendor ต่างจากอีกสองประเภท: 1 document = owner 1 ราย ที่ถือรายการ vendor ไว้ข้างใน
(owner 1 ราย → หลาย vendor → vendor แต่ละรายดูแลได้หลายยี่ห้อ) ส่วน owner/outsource เก็บแบน ๆ
คือชื่อ + ข้อมูลติดต่อ ฟิลด์ `name` จึงเป็นชื่อ owner เมื่อ type=vendor — ทำให้กันซ้ำด้วยกติกาเดิม
(ชื่อซ้ำภายใน type เดียวกัน) ได้เลย คือ owner 1 รายมีได้ 1 record
"""
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from config import companies_coll_async, users_coll_async
from deps import UserClaims, get_current_user

router = APIRouter(prefix="/companies", tags=["companies"])

COMPANY_TYPES = {"owner", "vendor", "outsource"}
# role ที่มอบหมายงาน PM ได้ — ต้องตรงกับ PM_PLANNING_ROLES ใน routers/pm_maximo.py
PM_ASSIGNER_ROLES = {"admin", "owner", "planner"}


def _require_admin(current: UserClaims):
    # super_admin ถูก normalize เป็น admin ที่ deps.get_current_user แล้ว — เช็ค admin ที่เดียวครอบทั้งคู่
    if (current.role or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="admin only")


class VendorEntry(BaseModel):
    """vendor 1 รายใต้ owner — ดูแลได้หลายยี่ห้อ จึงเก็บ brands เป็น list"""
    name: str = ""
    brands: List[str] = Field(default_factory=list)


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=1)  # type=vendor → ชื่อ owner | type=outsource → ชื่อ outsource
    type: Literal["owner", "vendor", "outsource"]
    company: str = ""  # ใช้เฉพาะ type=outsource — owner หรือ vendor ที่ outsource รายนี้สังกัด
    tel: str = ""
    email: str = ""
    address: str = ""
    vendors: List[VendorEntry] = Field(default_factory=list)  # ใช้เฉพาะ type=vendor


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    tel: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    vendors: Optional[List[VendorEntry]] = None


def _dedupe_brands(brands: List[str]) -> List[str]:
    """ยี่ห้อซ้ำที่พิมพ์ต่างตัวพิมพ์ถือว่าซ้ำ — เก็บตัวแรกที่ผู้ใช้กรอกไว้ตามลำดับเดิม"""
    seen, out = set(), []
    for raw in brands:
        brand = raw.strip()
        if not brand or brand.lower() in seen:
            continue
        seen.add(brand.lower())
        out.append(brand)
    return out


def _clean_vendors(entries: List[VendorEntry]) -> List[Dict[str, Any]]:
    cleaned: List[Dict[str, Any]] = []
    seen_names = set()
    for entry in entries:
        name = entry.name.strip()
        brands = _dedupe_brands(entry.brands)
        # แถวที่ผู้ใช้กด "เพิ่ม vendor" ค้างไว้แล้วไม่ได้กรอกอะไรเลย — ข้ามไปเงียบ ๆ
        if not name and not brands:
            continue
        if not name:
            raise HTTPException(status_code=400, detail="vendor name is required")
        if name.lower() in seen_names:
            raise HTTPException(status_code=409, detail="duplicate vendor name")
        seen_names.add(name.lower())
        cleaned.append({"name": name, "brands": brands})
    return cleaned


def _ci(value: str) -> re.Pattern:
    """match ชื่อแบบไม่สนตัวพิมพ์เล็ก-ใหญ่ — ชื่อ company ใน users/companies พิมพ์ไม่ตรงกันได้"""
    return re.compile(f"^{re.escape(value)}$", re.IGNORECASE)


def _dedupe_names(names) -> List[str]:
    """ตัดชื่อว่าง/ซ้ำ (ไม่สนตัวพิมพ์) ออก — คงลำดับเดิมที่ query เรียงมาแล้ว"""
    seen, out = set(), []
    for raw in names:
        name = str(raw or "").strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        out.append(name)
    return out


async def _assert_name_free(
    company_type: str,
    name: str,
    exclude_id: Optional[ObjectId] = None,
    company: Optional[str] = None,
):
    """กันชื่อซ้ำภายในประเภทเดียวกัน (ไม่สนตัวพิมพ์เล็ก-ใหญ่)

    type=outsource กันซ้ำแบบคู่ (company, name) — outsource เจ้าเดียวรับงานให้หลายบริษัทได้
    """
    query: Dict[str, Any] = {
        "type": company_type,
        "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"},
    }
    if company is not None:
        query["company"] = company
    if exclude_id is not None:
        query["_id"] = {"$ne": exclude_id}
    if await companies_coll_async.find_one(query):
        raise HTTPException(status_code=409, detail="company already exists")


def _to_object_id(company_id: str) -> ObjectId:
    try:
        return ObjectId(company_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="company not found")


def _serialize(doc: dict) -> dict:
    created_at = doc.get("created_at")
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "type": doc.get("type", ""),
        "tel": doc.get("tel", ""),
        "email": doc.get("email", ""),
        "address": doc.get("address", ""),
        "company": doc.get("company", ""),
        # record เดิมที่บันทึกไว้ก่อนมีโครง owner → vendors จะไม่มีฟิลด์นี้
        "vendors": doc.get("vendors") or [],
        "created_by": doc.get("created_by", ""),
        "created_at": created_at.isoformat() if isinstance(created_at, datetime) else created_at,
    }


@router.get("/")
async def list_companies(
    type: Optional[str] = Query(None, description="owner | vendor | outsource"),
    current: UserClaims = Depends(get_current_user),
):
    _require_admin(current)
    query: dict = {}
    if type:
        if type not in COMPANY_TYPES:
            raise HTTPException(status_code=400, detail="type must be owner, vendor or outsource")
        query["type"] = type
    docs = await companies_coll_async.find(query).sort("name", 1).to_list(length=None)
    return {"companies": [_serialize(d) for d in docs]}


@router.get("/pm-options")
async def pm_assignee_options(current: UserClaims = Depends(get_current_user)):
    """ตัวเลือก "ผู้รับผิดชอบ" ของฟอร์ม PM (วางแผน/เปิดใบงาน) — แยกเป็น 3 กลุ่ม

    ทุกกลุ่มถูกจำกัดด้วย company ของคนที่ login:
      - technicians: user role=technician ที่อยู่ company เดียวกัน
      - vendors:     vendor ที่อยู่ใต้ company นั้น (doc type=vendor ที่ name = company)
      - outsources:  outsource ที่สังกัด company นั้นโดยตรง หรือสังกัด vendor ข้างต้น
                     (outsource.company เก็บได้ทั้งชื่อ owner และชื่อ vendor)

    คน login ที่ company เป็นชื่อ vendor จะได้ vendors ว่าง แต่ยังเห็น outsource ของตัวเอง
    เพราะ lookup ทั้งสองชั้นใช้ชื่อเดียวกันนี้เทียบตรง ๆ — ยกเว้น super_admin ที่เห็นทุกบริษัท
    """
    if (current.role or "").lower() not in PM_ASSIGNER_ROLES:
        raise HTTPException(status_code=403, detail="forbidden")

    # อ่าน company สดจาก DB — JWT อายุ 24 ชม. อาจเก่ากว่า profile ที่เพิ่งแก้
    company = (current.company or "").strip()
    if current.user_id:
        try:
            me = await users_coll_async.find_one({"_id": ObjectId(current.user_id)}, {"company": 1})
            company = ((me or {}).get("company") or company).strip()
        except (InvalidId, TypeError):
            pass  # user_id ใน token ไม่ใช่ ObjectId — ใช้ค่าจาก claims ต่อ

    # super_admin ไม่ได้สังกัดบริษัทไหนจริง — กรองด้วย company ของตัวเองจะได้ลิสต์ว่าง
    if current.is_super_admin:
        tech_query: Dict[str, Any] = {"role": "technician"}
        owner_docs = await companies_coll_async.find({"type": "vendor"}).to_list(length=None)
        vendors = _dedupe_names(
            v.get("name", "") for doc in owner_docs for v in (doc.get("vendors") or [])
        )
        outsource_query: Dict[str, Any] = {"type": "outsource"}
    else:
        # ไม่มี company = ไม่รู้ว่าอยู่ใต้ใคร จึงไม่ควรเห็นชื่อของบริษัทอื่น
        if not company:
            return {"company": "", "technicians": [], "vendors": [], "outsources": []}

        tech_query = {"role": "technician", "company": _ci(company)}

        owner_doc = await companies_coll_async.find_one({"type": "vendor", "name": _ci(company)})
        vendors = _dedupe_names(v.get("name", "") for v in ((owner_doc or {}).get("vendors") or []))

        # outsource สังกัด owner ก็ได้ vendor ก็ได้ — รับทั้งสองชั้น
        parents = [company, *vendors]
        outsource_query = {"type": "outsource", "company": {"$in": [_ci(x) for x in parents]}}

    tech_docs = (
        await users_coll_async.find(tech_query, {"username": 1})
        .sort("username", 1)
        .to_list(length=None)
    )
    technicians = _dedupe_names(d.get("username", "") for d in tech_docs)

    outsource_docs = (
        await companies_coll_async.find(outsource_query, {"name": 1})
        .sort("name", 1)
        .to_list(length=None)
    )
    outsources = _dedupe_names(d.get("name", "") for d in outsource_docs)

    return {
        "company": company,
        "technicians": technicians,
        "vendors": vendors,
        "outsources": outsources,
    }


@router.post("/")
async def create_company(payload: CompanyCreate, current: UserClaims = Depends(get_current_user)):
    _require_admin(current)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    company = payload.company.strip()
    if payload.type == "outsource" and not company:
        raise HTTPException(status_code=400, detail="company is required")

    await _assert_name_free(
        payload.type, name, company=company if payload.type == "outsource" else None
    )

    doc = {
        "name": name,
        "type": payload.type,
        "tel": payload.tel.strip(),
        "email": payload.email.strip(),
        "address": payload.address.strip(),
        "created_by": current.username or "",
        "created_at": datetime.now(timezone.utc),
    }
    if payload.type == "vendor":
        vendors = _clean_vendors(payload.vendors)
        if not vendors:
            raise HTTPException(status_code=400, detail="at least one vendor is required")
        doc["vendors"] = vendors
        # แท็บ Vendor กรอกแค่ owner / vendor / brand — ไม่มีข้อมูลติดต่อ
        doc["tel"] = doc["email"] = doc["address"] = ""
    elif payload.type == "outsource":
        # แท็บ Outsource กรอกแค่ company (owner/vendor ที่สังกัด) + ชื่อ outsource
        doc["company"] = company
        doc["tel"] = doc["email"] = doc["address"] = ""

    result = await companies_coll_async.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.put("/{company_id}")
async def update_company(
    company_id: str,
    payload: CompanyUpdate,
    current: UserClaims = Depends(get_current_user),
):
    """แก้ไขได้ — owner 1 รายมี record เดียว การเพิ่ม vendor รายถัดไปจึงต้องมาทางนี้"""
    _require_admin(current)
    oid = _to_object_id(company_id)
    doc = await companies_coll_async.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="company not found")

    company_type = doc.get("type", "")
    is_outsource = company_type == "outsource"
    updates: Dict[str, Any] = {}

    # outsource กันซ้ำแบบคู่ (company, name) — ต้องรู้ company ปลายทางก่อนถึงจะเช็คชื่อได้
    next_company = doc.get("company", "")
    if is_outsource and payload.company is not None:
        next_company = payload.company.strip()
        if not next_company:
            raise HTTPException(status_code=400, detail="company is required")
        updates["company"] = next_company

    next_name = payload.name.strip() if payload.name is not None else doc.get("name", "")
    if payload.name is not None and not next_name:
        raise HTTPException(status_code=400, detail="name is required")
    # ย้าย company อย่างเดียวก็ชนของเดิมได้ จึงเช็คเมื่อฝั่งใดฝั่งหนึ่งเปลี่ยน
    if payload.name is not None or "company" in updates:
        await _assert_name_free(
            company_type, next_name, exclude_id=oid,
            company=next_company if is_outsource else None,
        )
    if payload.name is not None:
        updates["name"] = next_name

    if company_type == "vendor":
        if payload.vendors is not None:
            vendors = _clean_vendors(payload.vendors)
            if not vendors:
                raise HTTPException(status_code=400, detail="at least one vendor is required")
            updates["vendors"] = vendors
    elif not is_outsource:
        for field in ("tel", "email", "address"):
            value = getattr(payload, field)
            if value is not None:
                updates[field] = value.strip()

    if not updates:
        return _serialize(doc)

    previous_name = doc.get("name", "")
    await companies_coll_async.update_one({"_id": oid}, {"$set": updates})

    # record ฝั่ง vendor/outsource อ้าง owner ด้วยชื่อ (ไม่ใช่ _id) — เปลี่ยนชื่อ owner แล้ว
    # ไม่ตามไปแก้ จะกลายเป็น record ลอยที่ไม่ผูกกับ owner ไหนเลย
    if company_type == "owner" and updates.get("name", previous_name) != previous_name:
        await companies_coll_async.update_many(
            {"type": "vendor", "name": previous_name},
            {"$set": {"name": updates["name"]}},
        )
        await companies_coll_async.update_many(
            {"type": "outsource", "company": previous_name},
            {"$set": {"company": updates["name"]}},
        )

    doc.update(updates)
    return _serialize(doc)
