# utils/issue_id.py
from pymongo import ReturnDocument
from motor.motor_asyncio import AsyncIOMotorDatabase

async def next_issue_id_monthly_sync(db: AsyncIOMotorDatabase, pm_type: str, pm_date: str) -> str:
    yyyymm = pm_date[:7].replace("-", "")
    key = f"{pm_type}:{yyyymm}"
    doc = await db.pm_counters_monthly.find_one_and_update(
        {"_id": key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,  # ใช้คอนสแตนต์จาก pymongo ได้
    )
    seq = doc.get("seq", 1)
    return f"PM-{pm_type}-{yyyymm}-{seq:04d}"
