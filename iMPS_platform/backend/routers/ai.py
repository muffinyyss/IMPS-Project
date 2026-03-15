"""AI Module routes: output modules 1-7, progress, detail, toggle"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import Response, JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from datetime import datetime, timezone
from bson.objectid import ObjectId
import re

from config import (
    outputModule1, outputModule2, outputModule3, outputModule4,
    outputModule5, outputModule6, outputModule7,
    INPUT_DBS, OUTPUT_DBS, MODULES, station_collection,get_eds_health_collection, 
)
from deps import UserClaims, get_current_user

router = APIRouter()

# ─── EDS System Health ───────────────────────────────────────
from config import get_eds_health_collection

@router.get("/eds-system-health/latest")
async def get_latest_health(
    sn: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    coll = get_eds_health_collection(sn)
    doc = await coll.find_one({}, sort=[("timestamp", -1)])
    if not doc:
        raise HTTPException(status_code=404, detail="No health data found")

    return {
        "sn": sn,
        "score": doc.get("score", 0),
        "timestamp": doc.get("timestamp"),
        "modules": doc.get("modules", {}),
    }


# -------------------------------------------------------------- AI
def get_outputModule6_collection_for(station_id: str):
    # กันชื่อคอลเลกชันแปลก ๆ / injection: อนุญาต a-z A-Z 0-9 _ -
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    return outputModule6.get_collection(str(station_id))

@router.get("/outputModule6")
async def get_latest(
    request: Request,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    coll = get_outputModule6_collection_for(station_id)
    doc = await coll.find_one({}, sort=[("_id", -1)])
    if not doc:
        raise HTTPException(status_code=404, detail="No data")

    # ✅ ต้องใส่เครื่องหมายอัญประกาศรอบ ETag ตามสเปก
    etag = f"\"{str(doc['_id'])}\""

    inm = request.headers.get("if-none-match")
    # ✅ ใช้ Response เปล่า ไม่ต้องมี body/JSONResponse
    if inm and etag in inm:
        return Response(status_code=304)

    # ถ้าจะส่ง body ต้องแปลง _id ก่อน
    doc["_id"] = str(doc["_id"])
    payload = jsonable_encoder(doc)

    resp = JSONResponse(content=payload)
    resp.headers["ETag"] = etag
    # ถ้า endpoint มี auth แนะนำให้ใช้ private
    resp.headers["Cache-Control"] = "private, max-age=86400, stale-while-revalidate=604800"
    return resp

@router.get("/outputModule6/progress")
async def get_module6_progress(
    request: Request,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """ดึงค่า progress/health index จาก MongoDB สำหรับ module 6"""
    coll = get_outputModule6_collection_for(station_id)
    doc = await coll.find_one({}, sort=[("_id", -1)])
    
    if not doc:
        return JSONResponse(content={"progress": 0})
    
    # สมมติว่าค่า health index/progress อยู่ในฟิลด์ 'health_index' หรือ 'rul_percentage'
    # ปรับตามโครงสร้างข้อมูลจริงของคุณ
    progress = doc.get("health_index", 0)  # หรือ doc.get("rul_percentage", 0)
    
    etag = f"\"{str(doc['_id'])}\""
    inm = request.headers.get("if-none-match")
    
    if inm and etag in inm:
        return Response(status_code=304)
    
    resp = JSONResponse(content={"progress": progress})
    resp.headers["ETag"] = etag
    resp.headers["Cache-Control"] = "private, max-age=60, stale-while-revalidate=300"
    return resp

@router.get("/modules/detail")
async def get_module_detail(
    request: Request,
    module_id: str = Query(..., description="เช่น module1..module7"),
    station_id: str = Query(..., description="ชื่อสถานี เช่น Klongluang3"),
    current: UserClaims = Depends(get_current_user),
):
    if module_id not in MODULES:
        raise HTTPException(status_code=400, detail="Unknown module_id")

    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")

    input_doc = None
    output_doc = None

    # --- OUTPUT ---
    try:
        out_db = OUTPUT_DBS.get(module_id)
        if out_db is not None:
            out_coll = out_db.get_collection(str(station_id))
            output_doc = await out_coll.find_one({}, sort=[("_id", -1)])
    except Exception as e:
        print("get_module_detail output error:", e)

    # --- INPUT ---
    try:
        in_db = INPUT_DBS.get(module_id)
        if in_db is not None:
            in_coll = in_db.get_collection(str(station_id))
            input_doc = await in_coll.find_one({}, sort=[("_id", -1)])
    except Exception as e:
        print("get_module_detail input error:", e)

    # 🔧 แปลง ObjectId → str ด้วย custom_encoder
    input_enc = jsonable_encoder(
        input_doc,
        custom_encoder={ObjectId: str},
    ) if input_doc else None

    output_enc = jsonable_encoder(
        output_doc,
        custom_encoder={ObjectId: str},
    ) if output_doc else None

    payload = {
        "module_id": module_id,
        "station_id": station_id,
        "input": input_enc,
        "output": output_enc,
    }

    resp = JSONResponse(content=payload)
    resp.headers["Cache-Control"] = "no-store"
    return resp


# สำหรับ modules อื่นๆ ทำแบบเดียวกัน
@router.get("/modules/progress")
async def get_all_modules_progress(
    request: Request,
    station_id: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """ดึงค่า progress ของทุก modules พร้อมกัน"""
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", str(station_id)):
        raise HTTPException(status_code=400, detail="Bad station_id")
    
    result = {}
    
    # Module 1 - MDB Filters
    try:
        coll1 = outputModule1.get_collection(str(station_id))
        doc1 = await coll1.find_one({}, sort=[("_id", -1)])
        result["module1"] = doc1.get("health").get("health_index", 0) if doc1 else 0
    except:
        result["module1"] = 0
    try:
        coll2 = outputModule2.get_collection(str(station_id))
        doc2 = await coll2.find_one({}, sort=[("_id", -1)])
        result["module2"] = doc2.get("health_index_percent", 0) if doc2 else 0
    except:
        result["module2"] = 0
    
    # Module 3 - Online/Offline
    try:
        coll3 = outputModule3.get_collection(str(station_id))
        doc3 = await coll3.find_one({}, sort=[("_id", -1)])
        result["module3"] = doc3.get("health_index", 0) if doc3 else 0
    except:
        result["module3"] = 0
    
    # Module 4 - Power Supply
    try:
        coll4 = outputModule4.get_collection(str(station_id))
        doc4 = await coll4.find_one({}, sort=[("_id", -1)])
        result["module4"] = doc4.get("health_index", 0) if doc4 else 0
    except:
        result["module4"] = 0
    
    # Module 5 - Network
    try:
        coll5 = outputModule5.get_collection(str(station_id))
        doc5 = await coll5.find_one({}, sort=[("_id", -1)])
        result["module5"] = doc5.get("health").get("health_index",0) if doc5 else 0
    except:
        result["module5"] = 0
    
    # Module 6 - RUL
    try:
        coll6 = outputModule6.get_collection(str(station_id))
        doc6 = await coll6.find_one({}, sort=[("_id", -1)])
        result["module6"] = doc6.get("overall_health").get("average_health_index",0) if doc6 else 0
    except:
        result["module6"] = 0
    
    # Module 7 - Root Cause Analysis
    try:
        coll7 = outputModule7.get_collection(str(station_id))
        doc7 = await coll7.find_one({}, sort=[("_id", -1)])
        result["module7"] = doc7.get("health_index",0) if doc7 else 0
    except:
        result["module7"] = 0
    
    # คำนวณ overall health index (ค่าเฉลี่ยของทุก modules)
    module_values = list(result.values())
    overall_health = round(sum(module_values) / len(module_values), 2) if module_values else 0
    result["overall"] = overall_health
    
    resp = JSONResponse(content=result)
    resp.headers["Cache-Control"] = "private, max-age=60"
    return resp


def get_station_collection():
    return station_collection

class ModuleToggleIn(BaseModel):
    enabled: bool

@router.patch("/station/{station_id}/{module_id}", status_code=204)
async def patch_module_toggle(
    station_id: str,
    module_id: str,
    body: ModuleToggleIn,
    current: UserClaims = Depends(get_current_user),
):
    # ตรวจสอบว่า station_id ถูกต้อง
    if not re.fullmatch(r"[A-Za-z0-9_\-]+", station_id):
        raise HTTPException(status_code=400, detail="Bad station_id")

    # ตรวจสอบว่า module_id เป็นโมดูลที่ถูกต้อง
    if module_id not in MODULES:
        raise HTTPException(status_code=400, detail="Invalid module_id")

    coll = get_station_collection()
    now = datetime.now(timezone.utc)

    # สร้างชื่อของฟิลด์ตาม module_id ที่ได้รับมา
    module_field = f"{module_id}_isActive"

    # อัปเดตสถานะโมดูล
    res = coll.update_one(
        {"station_id": station_id},
        {"$set": {
            module_field: body.enabled,
            "updatedAt": now,
        }},
        upsert=False,   # ถ้าอยากสร้างเอกสารใหม่เมื่อไม่เจอ ให้ True
    )

    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Station not found")
