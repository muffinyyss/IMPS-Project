"""
Agentic AI — diagnosis router  (/ai/agent/*)
============================================

Endpoint ให้ dashboard เรียก agent วิเคราะห์แต่ละโมดูล (M1–M7) แบบ on-demand
- auth + ตรวจสิทธิ์สถานีด้วยกติกาเดียวกับทั้งระบบ (station_match_query)
- agent เป็น "read-only" สืบค้น telemetry/CM/failure code แล้วสรุป root cause + คำแนะนำ
  การเปิดใบงาน CM ยังเป็นหน้าที่ของคน (endpoint นี้ไม่แก้ไขข้อมูลใด ๆ)
- LLM เป็นโมเดล on-prem ผ่าน OpenAI-compatible API (ดู services/agent_llm.py)
- LLM ล่ม → degrade เป็น heuristic จาก threshold ในทะเบียนความรู้ (ไม่พังทั้งหน้า)

cache: eds_ai_agent.{SN} — 1 doc ต่อโมดูล, ใช้ซ้ำภายใน AGENT_CACHE_MINUTES เว้นแต่ force
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from config import client, station_collection, charger_collection, th_tz
from deps import get_current_user, UserClaims
from routers.stations import station_match_query

from services import agent_llm
from services.agent_llm import LLMUnavailable
from services.agent_registry import (
    normalize_module_key, get_knowledge, VALID_MODULES,
)
from services.agent_tools import AgentContext, all_tools, make_dispatch, get_current_module_result

log = logging.getLogger("ai_agent")
router = APIRouter(tags=["ai-agent"])

_cache_db = client["eds_ai_agent"]
CACHE_MINUTES = int(os.getenv("AGENT_CACHE_MINUTES", "30"))


# ══════════════════════════════════════════════════════════════════
# helpers
# ══════════════════════════════════════════════════════════════════
def _resolve_station(sn: str, station_id_hint: str = "") -> tuple[str, str]:
    """SN → (station_id, station_name) จาก iMPS.charger ; ไม่พบ → 404"""
    charger = charger_collection.find_one({"SN": sn}) if sn else None
    station_id = (station_id_hint or (charger or {}).get("station_id") or "").strip()
    if not station_id:
        raise HTTPException(status_code=404, detail=f"ไม่พบสถานีของ charger SN={sn!r}")
    station_name = ((charger or {}).get("station_name")
                    or (charger or {}).get("stationName") or station_id)
    return station_id, station_name


def _assert_access(current: UserClaims, station_id: str) -> None:
    """ตรวจสิทธิ์เข้าถึงสถานีด้วยกติกาเดียวกับ station_match_query (เหมือน uploads_access)"""
    match = station_match_query(current)
    if match is None:
        raise HTTPException(status_code=403, detail="no station access")
    if station_collection.find_one({**match, "station_id": station_id}) is None:
        raise HTTPException(status_code=403, detail="no access to this station")


def _inner(result_doc: dict | None) -> dict:
    """ดึงส่วน result จริงจาก eds_ai_results doc ({module, timestamp, result:{...}})"""
    if not result_doc:
        return {}
    return result_doc.get("result") or {}


def _build_prompts(ctx: AgentContext, current_result: dict, lang: str) -> tuple[str, str]:
    kn = get_knowledge(ctx.module)
    lang_name = "ภาษาไทย" if lang != "en" else "English"

    system = f"""คุณคือผู้ช่วยวิศวกรบำรุงรักษาสถานีอัดประจุยานยนต์ไฟฟ้า (EV DC charger) ของระบบ iMPS การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (EGAT)

หน้าที่ของคุณ: วินิจฉัยโมดูล {kn['num']} ({kn['name_en']} / {kn['name_th']}) ของ charger เครื่องหนึ่ง โดย "สืบค้นด้วยเครื่องมือก่อนสรุป"

กติกาสำคัญ:
- ใช้เฉพาะข้อมูลจริงจากเครื่องมือ (get_current_module_result, get_telemetry_history, get_system_health, list_recent_cm_reports, search_failure_codes) ห้ามแต่งค่า/แต่งสาเหตุที่ไม่มีหลักฐาน
- ถ้าข้อมูลไม่พอ ให้บอกตรง ๆ และลด confidence
- คุณอ่านได้อย่างเดียว ห้ามสั่งการ/แก้ไขใด ๆ การเปิดใบงาน CM เป็นการตัดสินใจของมนุษย์ — คุณแค่ "แนะนำ"
- เมื่อสืบค้นครบและมั่นใจแล้ว ให้เรียก submit_diagnosis เพื่อส่งผลสรุป (เรียกครั้งเดียว)
- เขียนผลลัพธ์ทั้งหมดเป็น{lang_name}

ความรู้เชิงเทคนิคของโมดูลนี้ (ใช้อ้างอิงเกณฑ์):
- สิ่งที่ตรวจ: {kn['measures']}
- สูตรค่าสุขภาพ: {kn['health_formula']}
- เกณฑ์/threshold: {kn['thresholds']}
- field ข้อมูลหลัก: {', '.join(kn['input_fields'])}
- สาเหตุที่พบบ่อย: {'; '.join(kn['typical_root_causes'])}
- มาตรฐานอ้างอิง: {', '.join(kn['standards']) or 'ไม่มี'}"""

    inner = _inner(current_result)
    health = inner.get("health")
    status = inner.get("status") or inner.get("root_cause")
    user = f"""วิเคราะห์โมดูล {kn['num']} ของ charger SN={ctx.sn} (สถานี {ctx.station_id})

สรุปผลล่าสุดที่มีในระบบ:
- ค่าสุขภาพ (health): {health}
- สถานะ/สาเหตุเบื้องต้น: {status}

โปรดสืบค้นด้วยเครื่องมือเพื่อยืนยันแนวโน้มและบริบท (ประวัติ telemetry, system health, ใบงาน CM เก่า, failure code ที่เกี่ยวข้อง) แล้วสรุปด้วย submit_diagnosis"""
    return system, user


def _severity_from_health(health) -> str:
    if health is None:
        return "watch"
    try:
        h = float(health)
    except (TypeError, ValueError):
        return "watch"
    if h >= 75:
        return "normal"
    if h >= 50:
        return "watch"
    if h >= 25:
        return "warning"
    return "critical"


def _heuristic(ctx: AgentContext, current_result: dict) -> dict:
    """fallback เมื่อ LLM ใช้ไม่ได้ — อิง threshold ในทะเบียนความรู้ล้วน (ไม่ใช้ LLM)"""
    kn = get_knowledge(ctx.module)
    inner = _inner(current_result)
    health = inner.get("health")
    sev = _severity_from_health(health)
    root = inner.get("root_cause") or (kn["typical_root_causes"][0] if kn["typical_root_causes"] else "ไม่ทราบสาเหตุ")
    actions = [
        {"action": a, "priority": "high" if sev in ("warning", "critical") else "medium", "rationale": ""}
        for a in kn["recommended_actions"]
    ]
    return {
        "root_cause": root,
        "severity": sev,
        "confidence": 0.4 if health is not None else 0.2,
        "summary": (f"[โหมดสำรอง — ไม่มี LLM] ค่าสุขภาพโมดูล {kn['num']} = {health}. "
                    f"ประเมินจากเกณฑ์มาตรฐานของโมดูล ({kn['name_th']}) โดยไม่มีการสืบค้นเชิงลึก"),
        "evidence": [f"health = {health}"] if health is not None else ["ไม่มีผลโมดูลล่าสุด"],
        "recommended_actions": actions,
        "suggested_failure_code": "",
        "open_cm_recommended": sev in ("warning", "critical"),
    }


async def _diagnose_one(ctx: AgentContext, lang: str, force: bool) -> dict:
    """วินิจฉัยหนึ่งโมดูล — ใช้ cache ถ้ายังสด เว้นแต่ force"""
    cache_col = _cache_db[ctx.sn]

    if not force:
        cached = await cache_col.find_one({"module": ctx.module})
        if cached and cached.get("generated_at"):
            gen = cached["generated_at"]
            if isinstance(gen, datetime):
                if gen.tzinfo is None:
                    gen = gen.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) - gen < timedelta(minutes=CACHE_MINUTES):
                    cached.pop("_id", None)
                    cached["cached"] = True
                    return cached

    current_result = await get_current_module_result(ctx)
    system, user = _build_prompts(ctx, current_result, lang)

    method = "llm_agent"
    steps = 0
    tools_used: list[str] = []
    try:
        run = await agent_llm.run_agent(
            system_prompt=system,
            user_prompt=user,
            tools=all_tools(),
            dispatch=make_dispatch(ctx),
            final_tool="submit_diagnosis",
        )
        diagnosis = run["result"]
        steps = run.get("steps", 0)
        tools_used = [t["tool"] for t in run.get("trace", []) if t.get("type") == "tool"]
    except LLMUnavailable as e:
        log.warning("LLM unavailable for %s/%s: %s", ctx.sn, ctx.module, e)
        method = "heuristic_fallback"
        diagnosis = _heuristic(ctx, current_result)

    doc = {
        "module": ctx.module,
        "sn": ctx.sn,
        "station_id": ctx.station_id,
        "method": method,
        "model": agent_llm.LLM_MODEL if method == "llm_agent" else None,
        "diagnosis": diagnosis,
        "investigation": {"steps": steps, "tools_used": tools_used},
        "health_at_diagnosis": _inner(current_result).get("health"),
        "generated_at": datetime.now(timezone.utc),
    }
    await cache_col.update_one({"module": ctx.module}, {"$set": doc}, upsert=True)

    out = dict(doc)
    out["generated_at"] = doc["generated_at"].isoformat()
    out["cached"] = False
    return out


# ══════════════════════════════════════════════════════════════════
# request models
# ══════════════════════════════════════════════════════════════════
class DiagnoseBody(BaseModel):
    sn: str
    module: str
    station_id: str | None = None
    lang: str = "th"
    force: bool = False


class DiagnoseAllBody(BaseModel):
    sn: str
    station_id: str | None = None
    lang: str = "th"
    force: bool = False


# ══════════════════════════════════════════════════════════════════
# endpoints
# ══════════════════════════════════════════════════════════════════
@router.get("/ai/agent/status")
async def agent_status(current: UserClaims = Depends(get_current_user)):
    """เช็คว่า agent เปิดใช้และเชื่อมต่อ LLM ได้ไหม (ใช้โชว์สถานะบน UI)"""
    return await agent_llm.ping()


@router.post("/ai/agent/diagnose")
async def diagnose(body: DiagnoseBody, current: UserClaims = Depends(get_current_user)):
    try:
        module = normalize_module_key(body.module)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    station_id, station_name = _resolve_station(body.sn, body.station_id or "")
    _assert_access(current, station_id)

    ctx = AgentContext(sn=body.sn, station_id=station_id, module=module, station_name=station_name)
    return await _diagnose_one(ctx, body.lang, body.force)


@router.post("/ai/agent/diagnose-all")
async def diagnose_all(body: DiagnoseAllBody, current: UserClaims = Depends(get_current_user)):
    """วินิจฉัยครบ 7 โมดูล — รันทีละตัวเพื่อไม่ถล่ม LLM เครื่อง local (อาจใช้เวลาสักครู่)"""
    station_id, station_name = _resolve_station(body.sn, body.station_id or "")
    _assert_access(current, station_id)

    diagnoses: dict[str, dict] = {}
    for module in VALID_MODULES:
        ctx = AgentContext(sn=body.sn, station_id=station_id, module=module, station_name=station_name)
        try:
            diagnoses[module] = await _diagnose_one(ctx, body.lang, body.force)
        except Exception as e:  # โมดูลเดียวพังต้องไม่ทำให้ทั้งชุดพัง
            log.error("diagnose-all %s/%s failed: %s", body.sn, module, e)
            diagnoses[module] = {"module": module, "error": str(e)}
    return {"sn": body.sn, "station_id": station_id, "diagnoses": diagnoses}


@router.get("/ai/agent/diagnosis")
async def get_cached_diagnosis(
    sn: str = Query(...),
    module: str = Query(...),
    current: UserClaims = Depends(get_current_user),
):
    """อ่านผลวินิจฉัยล่าสุดที่ cache ไว้ (ไม่รัน agent ใหม่)"""
    try:
        module = normalize_module_key(module)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    station_id, _ = _resolve_station(sn)
    _assert_access(current, station_id)

    doc = await _cache_db[sn].find_one({"module": module})
    if not doc:
        return {"sn": sn, "module": module, "diagnosis": None}
    doc.pop("_id", None)
    if isinstance(doc.get("generated_at"), datetime):
        doc["generated_at"] = doc["generated_at"].isoformat()
    return doc
