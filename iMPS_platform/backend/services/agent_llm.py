"""
Agentic AI — LLM client (on-prem, OpenAI-compatible)
====================================================

client บาง ๆ สำหรับคุยกับ LLM ภายในองค์กร (Ollama / vLLM / LM Studio ฯลฯ) ผ่าน
OpenAI-compatible endpoint `/chat/completions` พร้อม tool calling — ข้อมูลไม่ออก
นอกเครือข่าย EGAT

ทำไมไม่ใช้ openai SDK: หลีกเลี่ยง dependency ใหม่ที่หนัก และ httpx ถูกใช้อยู่แล้วใน
services/maximo.py จึงใช้ httpx.AsyncClient ให้ non-blocking กับ event loop ของ FastAPI

ตั้งค่าได้ทาง env (ดู .env.example):
  AGENT_ENABLED, AGENT_LLM_BASE_URL, AGENT_LLM_MODEL, AGENT_LLM_API_KEY,
  AGENT_LLM_TIMEOUT, AGENT_MAX_STEPS, AGENT_TEMPERATURE
"""
from __future__ import annotations

import os
import json
import logging
from typing import Any, Awaitable, Callable

import httpx

log = logging.getLogger("ai_agent")

# ─── Config (env-driven) ─────────────────────────────────────────
AGENT_ENABLED = os.getenv("AGENT_ENABLED", "true").lower() == "true"
# ค่า default ชี้ Ollama เครื่อง local — endpoint ต้องลงท้าย /v1 (OpenAI-compatible)
LLM_BASE_URL = os.getenv("AGENT_LLM_BASE_URL", "http://localhost:11434/v1").rstrip("/")
LLM_MODEL = os.getenv("AGENT_LLM_MODEL", "qwen2.5:7b-instruct")
LLM_API_KEY = os.getenv("AGENT_LLM_API_KEY", "ollama")   # local server ส่วนใหญ่ไม่ตรวจ แต่ต้องมี header
LLM_TIMEOUT = float(os.getenv("AGENT_LLM_TIMEOUT", "60"))
MAX_STEPS = int(os.getenv("AGENT_MAX_STEPS", "6"))
TEMPERATURE = float(os.getenv("AGENT_TEMPERATURE", "0.2"))

# ประเภทของ dispatcher: (tool_name, args_dict) -> ผลลัพธ์ (จะถูก json.dumps ก่อนส่งกลับให้โมเดล)
ToolDispatch = Callable[[str, dict], Awaitable[Any]]


class LLMUnavailable(RuntimeError):
    """ยิง LLM ไม่ได้ (เชื่อมต่อไม่ได้/timeout/ตอบผิดรูป) — ให้ caller fallback ได้"""


async def _chat_completion(
    client: httpx.AsyncClient,
    messages: list[dict],
    tools: list[dict] | None,
    tool_choice: Any = "auto",
) -> dict:
    """ยิง /chat/completions หนึ่งครั้ง คืน message object ของ choice แรก"""
    payload: dict[str, Any] = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": TEMPERATURE,
        "stream": False,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = tool_choice

    try:
        resp = await client.post(
            f"{LLM_BASE_URL}/chat/completions",
            json=payload,
            headers={"Authorization": f"Bearer {LLM_API_KEY}"},
        )
    except httpx.HTTPError as e:
        raise LLMUnavailable(f"connect error: {e}") from e

    if resp.status_code >= 400:
        raise LLMUnavailable(f"HTTP {resp.status_code}: {resp.text[:300]}")

    try:
        data = resp.json()
        return data["choices"][0]["message"]
    except (KeyError, IndexError, ValueError) as e:
        raise LLMUnavailable(f"bad response shape: {e}") from e


def _extract_json(text: str) -> dict | None:
    """ดึง JSON object ก้อนแรกจากข้อความ (เผื่อโมเดลตอบ JSON ปนข้อความ)"""
    if not text:
        return None
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


async def run_agent(
    *,
    system_prompt: str,
    user_prompt: str,
    tools: list[dict],
    dispatch: ToolDispatch,
    final_tool: str,
    max_steps: int = MAX_STEPS,
) -> dict:
    """
    รัน agent loop จนกว่าโมเดลจะเรียก `final_tool` (เช่น submit_diagnosis) หรือครบ max_steps

    - tools: รายการ tool schema แบบ OpenAI (รวม final_tool ด้วย)
    - dispatch: async function ที่รัน read-only tool แล้วคืนผล (ไม่รวม final_tool —
      final_tool ใช้แค่ให้โมเดลส่ง structured output เท่านั้น)
    - คืน dict: { "result": <args ของ final_tool>, "trace": [...], "steps": n }

    ถ้าโมเดลไม่ยอมเรียก final_tool เลย จะบังคับอีกหนึ่งรอบด้วย tool_choice=final_tool
    ถ้ายังไม่ได้ → พยายาม parse JSON จาก content ; ล้มเหลวสุดทาง → LLMUnavailable
    """
    if not AGENT_ENABLED:
        raise LLMUnavailable("AGENT_ENABLED=false")

    messages: list[dict] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    trace: list[dict] = []

    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        for step in range(max_steps):
            # รอบสุดท้าย บังคับให้ปิดงานด้วย final_tool เพื่อให้ได้ผลลัพธ์เสมอ
            force_final = step == max_steps - 1
            tool_choice = (
                {"type": "function", "function": {"name": final_tool}}
                if force_final else "auto"
            )
            msg = await _chat_completion(client, messages, tools, tool_choice)
            tool_calls = msg.get("tool_calls") or []

            # ── ไม่มี tool call: โมเดลตอบข้อความเปล่า ──
            if not tool_calls:
                parsed = _extract_json(msg.get("content") or "")
                if parsed is not None:
                    trace.append({"step": step, "type": "final_json_from_content"})
                    return {"result": parsed, "trace": trace, "steps": step + 1}
                # กระตุ้นให้เรียก final_tool แล้ววนต่อ
                messages.append({"role": "assistant", "content": msg.get("content") or ""})
                messages.append({
                    "role": "user",
                    "content": f"โปรดสรุปผลด้วยการเรียกเครื่องมือ {final_tool} เท่านั้น",
                })
                continue

            # ต้อง echo assistant message (พร้อม tool_calls) กลับเข้า history ก่อนใส่ผล tool
            messages.append({
                "role": "assistant",
                "content": msg.get("content") or "",
                "tool_calls": tool_calls,
            })

            finished: dict | None = None
            for tc in tool_calls:
                fn = (tc.get("function") or {})
                name = fn.get("name", "")
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}

                if name == final_tool:
                    finished = args
                    trace.append({"step": step, "type": "final", "tool": name})
                    # ยังต้องตอบ tool message กลับ ไม่งั้น history ไม่สมบูรณ์ (แต่เราจะ return เลย)
                    messages.append({
                        "role": "tool", "tool_call_id": tc.get("id", ""),
                        "content": "ok",
                    })
                    continue

                # ── read-only tool ──
                try:
                    output = await dispatch(name, args)
                except Exception as e:  # tool พังต้องไม่ทำให้ทั้ง loop ตาย
                    output = {"error": f"tool {name} failed: {e}"}
                trace.append({"step": step, "type": "tool", "tool": name, "args": args})
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", ""),
                    "content": json.dumps(output, ensure_ascii=False, default=str)[:8000],
                })

            if finished is not None:
                return {"result": finished, "trace": trace, "steps": step + 1}

    raise LLMUnavailable("agent did not produce a diagnosis within step budget")


async def ping() -> dict:
    """เช็คว่าเชื่อมต่อ LLM ได้ไหม — ใช้ที่ GET /ai/agent/status"""
    if not AGENT_ENABLED:
        return {"ok": False, "enabled": False, "detail": "AGENT_ENABLED=false"}
    try:
        async with httpx.AsyncClient(timeout=min(LLM_TIMEOUT, 15)) as client:
            msg = await _chat_completion(
                client,
                [{"role": "user", "content": "reply with the single word: ok"}],
                tools=None,
            )
        return {"ok": True, "enabled": True, "model": LLM_MODEL,
                "base_url": LLM_BASE_URL, "reply": (msg.get("content") or "")[:80]}
    except LLMUnavailable as e:
        return {"ok": False, "enabled": True, "model": LLM_MODEL,
                "base_url": LLM_BASE_URL, "detail": str(e)}
