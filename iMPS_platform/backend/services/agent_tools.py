"""
Agentic AI — read-only investigation tools
==========================================

เครื่องมือ "อ่านอย่างเดียว" ที่ agent เรียกเพื่อสืบค้นก่อนสรุป root cause
ทุก tool ผูกกับสถานี/โมดูลของ request ผ่าน AgentContext — agent เปลี่ยนสถานีเองไม่ได้
(กันไม่ให้หลุด scope สิทธิ์ที่ router ตรวจไว้แล้ว) และไม่มี tool ใดแก้ไขข้อมูล

ข้อมูลจริงอยู่ที่:
  - eds_ai_results.{SN}       ← ผลโมดูลล่าสุด (เขียนโดย AI worker) — 1 doc ต่อโมดูล
  - eds_system_health.{SN}    ← time-series system health
  - module{1..7}*.{SN|name}   ← telemetry ดิบ (เขียนโดย pipeline)
  - CMReport.{station_id}     ← ใบงาน CM ย้อนหลัง
  - iMPS.maximo_failure_codes ← ตาราง failure code (cache จาก Maximo)
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from config import client, CMReportDB, INPUT_DBS, th_tz
from services.agent_registry import get_knowledge

# eds_ai_results ไม่ได้ประกาศ handle ไว้ใน config.py (เป็น DB ของ AI worker) — เปิดตรงนี้
_results_db = client["eds_ai_results"]
_health_db = client["eds_system_health"]


@dataclass
class AgentContext:
    """บริบทที่ผูกกับ request หนึ่ง — ทุก tool ทำงานบนสถานี/โมดูลนี้เท่านั้น"""
    sn: str
    station_id: str
    module: str          # "m1".."m7"
    station_name: str = ""


# ══════════════════════════════════════════════════════════════════
# Tool schemas (OpenAI function-calling format)
# ══════════════════════════════════════════════════════════════════
def _investigation_tools() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": "get_current_module_result",
                "description": "อ่านผลล่าสุดของโมดูลนี้จาก eds_ai_results (health, risk, สถานะ, telemetry ที่ใช้ตัดสิน)",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_telemetry_history",
                "description": "อ่าน telemetry ดิบย้อนหลังของโมดูลนี้ N เอกสารล่าสุด เพื่อดูแนวโน้ม (เช่นอุณหภูมิไต่ขึ้นเรื่อย ๆ)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "จำนวนเอกสาร (1–50)", "default": 10},
                        "fields": {
                            "type": "array", "items": {"type": "string"},
                            "description": "ชื่อ field ที่สนใจ (ว่าง = ใช้ field มาตรฐานของโมดูล)",
                        },
                    },
                    "required": [],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_system_health",
                "description": "อ่าน system health รวมของสถานีนี้ + แนวโน้มย้อนหลัง (บริบทว่าปัญห์กระทบภาพรวมแค่ไหน)",
                "parameters": {"type": "object", "properties": {}, "required": []},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_recent_cm_reports",
                "description": "อ่านใบงาน CM ย้อนหลังของสถานีนี้ เพื่อดูว่าปัญหานี้เคยเกิด/เคยซ่อมอย่างไร",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "description": "จำนวนใบงาน (1–10)", "default": 5},
                    },
                    "required": [],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "search_failure_codes",
                "description": "ค้นตาราง Maximo failure code ด้วยคำค้น เพื่อจับคู่ root cause กับรหัสความเสียหายที่ใช้เปิดใบงาน",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "คำค้น เช่น 'filter', 'temperature', 'network'"},
                    },
                    "required": ["query"],
                },
            },
        },
    ]


def submit_diagnosis_tool() -> dict:
    """terminal tool — บังคับให้โมเดลส่ง structured output ตาม schema นี้"""
    return {
        "type": "function",
        "function": {
            "name": "submit_diagnosis",
            "description": "ส่งผลวินิจฉัยขั้นสุดท้าย เรียกเมื่อสืบค้นครบและมั่นใจแล้วเท่านั้น",
            "parameters": {
                "type": "object",
                "properties": {
                    "root_cause": {"type": "string", "description": "สาเหตุหลักที่น่าจะเป็น (สั้น กระชับ)"},
                    "severity": {"type": "string", "enum": ["normal", "watch", "warning", "critical"]},
                    "confidence": {"type": "number", "description": "ความมั่นใจ 0.0–1.0"},
                    "summary": {"type": "string", "description": "สรุป 2–4 ประโยคตามภาษาที่ผู้ใช้ขอ"},
                    "evidence": {
                        "type": "array", "items": {"type": "string"},
                        "description": "หลักฐานที่อ้างค่าจริง เช่น 'power_module_temp3 = 68°C เกินเกณฑ์เตือน 55°C'",
                    },
                    "recommended_actions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "action": {"type": "string"},
                                "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                                "rationale": {"type": "string"},
                            },
                            "required": ["action", "priority"],
                        },
                    },
                    "suggested_failure_code": {
                        "type": "string",
                        "description": "รหัส Maximo failure code ที่ตรงที่สุด (ถ้าหาได้จาก search_failure_codes) มิฉะนั้นเว้นว่าง",
                    },
                    "open_cm_recommended": {"type": "boolean", "description": "ควรเปิดใบงาน CM หรือไม่"},
                },
                "required": ["root_cause", "severity", "confidence", "summary",
                             "evidence", "recommended_actions", "open_cm_recommended"],
            },
        },
    }


def all_tools() -> list[dict]:
    return _investigation_tools() + [submit_diagnosis_tool()]


# ══════════════════════════════════════════════════════════════════
# Tool implementations (async, read-only)
# ══════════════════════════════════════════════════════════════════
def _clean(doc: dict | None) -> dict | None:
    """ตัด _id และแปลง datetime → iso ให้ json.dumps ได้"""
    if not doc:
        return doc
    doc.pop("_id", None)
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc


async def _module_input_candidates(ctx: AgentContext) -> list[str]:
    """ชื่อ collection ที่ input DB ของโมดูลนี้อาจใช้ (M1 ใช้ station_name ก่อน, ที่เหลือใช้ SN)"""
    kn = get_knowledge(ctx.module)
    if kn["collection_key"] == "station_name":
        return [c for c in (ctx.station_name, ctx.station_id, ctx.sn) if c]
    return [c for c in (ctx.sn, ctx.station_name, ctx.station_id) if c]


async def get_current_module_result(ctx: AgentContext) -> dict:
    col = _results_db[ctx.sn]
    doc = await col.find_one({"module": ctx.module})
    if not doc:
        return {"error": "no_result", "detail": f"ไม่มีผลของ {ctx.module} ใน eds_ai_results.{ctx.sn}"}
    return _clean(doc)


async def get_telemetry_history(ctx: AgentContext, limit: int = 10, fields: list[str] | None = None) -> dict:
    kn = get_knowledge(ctx.module)
    limit = max(1, min(int(limit or 10), 50))
    want = fields or kn["input_fields"]
    input_db = INPUT_DBS.get(ctx.module)
    if input_db is None:
        return {"error": "no_input_db", "detail": f"ไม่มี input DB สำหรับ {ctx.module}"}

    projection = {"_id": 0, **{f: 1 for f in want}, "timestamp": 1, "timestamp_utc": 1}
    for col_name in await _module_input_candidates(ctx):
        col = input_db[col_name]
        # เรียงตาม timestamp_utc ถ้ามี ไม่งั้น _id
        try:
            cursor = col.find({}, projection).sort("timestamp_utc", -1).limit(limit)
            rows = [r async for r in cursor]
            if not rows:
                cursor = col.find({}, projection).sort("_id", -1).limit(limit)
                rows = [r async for r in cursor]
        except Exception:
            rows = []
        if rows:
            return {"collection": col_name, "count": len(rows),
                    "fields": want, "rows": [_clean(r) for r in rows]}
    return {"error": "no_data", "detail": f"ไม่พบ telemetry ของ {ctx.module} ในสถานีนี้"}


async def get_system_health(ctx: AgentContext) -> dict:
    latest = _clean(await _results_db[ctx.sn].find_one({"module": "system_health"}))
    try:
        cursor = _health_db[ctx.sn].find({}, {"_id": 0}).sort("timestamp", -1).limit(12)
        history = [_clean(r) async for r in cursor]
    except Exception:
        history = []
    return {"latest": latest, "history": history}


async def list_recent_cm_reports(ctx: AgentContext, limit: int = 5) -> dict:
    limit = max(1, min(int(limit or 5), 10))
    col = CMReportDB[ctx.station_id]
    fields = {
        "_id": 0, "issue_id": 1, "doc_name": 1, "status": 1, "stage": 1,
        "problem": 1, "root_cause": 1, "repair_result": 1, "failure_code": 1,
        "cm_date": 1, "created_at": 1, "auto_trigger": 1,
    }
    try:
        cursor = col.find({}, fields).sort("_id", -1).limit(limit)
        rows = [_clean(r) async for r in cursor]
    except Exception as e:
        return {"error": "read_failed", "detail": str(e)}
    return {"station_id": ctx.station_id, "count": len(rows), "reports": rows}


async def search_failure_codes(ctx: AgentContext, query: str) -> dict:
    q = (query or "").strip().lower()
    doc = await client["iMPS"]["maximo_failure_codes"].find_one({"_id": "failure_codes"})
    if not doc:
        return {"error": "no_cache", "detail": "ยังไม่มี cache failure code"}
    matrix = doc.get("matrix") or []
    if not q:
        hits = matrix[:20]
    else:
        hits = [row for row in matrix if q in json.dumps(row, ensure_ascii=False).lower()][:20]
    return {"query": query, "match_count": len(hits), "codes": hits}


# ── dispatcher ที่ผูกกับ context (ส่งให้ run_agent) ─────────────────
def make_dispatch(ctx: AgentContext):
    async def dispatch(name: str, args: dict):
        if name == "get_current_module_result":
            return await get_current_module_result(ctx)
        if name == "get_telemetry_history":
            return await get_telemetry_history(ctx, args.get("limit", 10), args.get("fields"))
        if name == "get_system_health":
            return await get_system_health(ctx)
        if name == "list_recent_cm_reports":
            return await list_recent_cm_reports(ctx, args.get("limit", 5))
        if name == "search_failure_codes":
            return await search_failure_codes(ctx, args.get("query", ""))
        return {"error": "unknown_tool", "tool": name}
    return dispatch


def now_th_iso() -> str:
    return datetime.now(timezone.utc).astimezone(th_tz).isoformat()
