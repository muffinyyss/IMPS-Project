// Agentic AI client — คุยกับ backend FastAPI (:8000) ผ่าน apiFetch (แนบ token + auth ให้เอง)
//
// ต่างจาก lib/api.ts ที่ยิงตรงไป AI server (:8001) แบบไม่มี auth — ตัวนี้ผ่าน backend
// หลักที่ตรวจสิทธิ์สถานีและรัน LLM agent วินิจฉัยให้ (ดู backend/routers/ai_agent.py)
import { apiFetch } from "@/utils/api";

export type Severity = "normal" | "watch" | "warning" | "critical";

export interface RecommendedAction {
  action: string;
  priority: "low" | "medium" | "high";
  rationale?: string;
}

export interface Diagnosis {
  root_cause: string;
  severity: Severity;
  confidence: number;
  summary: string;
  evidence: string[];
  recommended_actions: RecommendedAction[];
  suggested_failure_code?: string;
  open_cm_recommended: boolean;
}

export interface DiagnoseResult {
  module: string;
  sn: string;
  station_id: string;
  method: "llm_agent" | "heuristic_fallback";
  model?: string | null;
  diagnosis: Diagnosis | null;
  investigation?: { steps: number; tools_used: string[] };
  health_at_diagnosis?: number | null;
  generated_at: string;
  cached: boolean;
}

export interface AgentStatus {
  ok: boolean;
  enabled: boolean;
  model?: string;
  base_url?: string;
  reply?: string;
  detail?: string;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      detail = b?.detail || detail;
    } catch { /* ignore */ }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json() as Promise<T>;
}

export const agentApi = {
  /** เช็คว่า agent เปิดใช้และต่อ LLM ได้ไหม */
  async status(): Promise<AgentStatus> {
    return asJson<AgentStatus>(await apiFetch("/ai/agent/status"));
  },

  /** รันวินิจฉัยหนึ่งโมดูล (ใช้ cache ถ้าไม่ force) */
  async diagnose(
    sn: string,
    moduleNum: number,
    opts: { force?: boolean; lang?: "th" | "en"; stationId?: string } = {},
  ): Promise<DiagnoseResult> {
    const res = await apiFetch("/ai/agent/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sn,
        module: String(moduleNum),
        station_id: opts.stationId,
        lang: opts.lang ?? "th",
        force: opts.force ?? false,
      }),
    });
    return asJson<DiagnoseResult>(res);
  },

  /** อ่านผลวินิจฉัยที่ cache ไว้ (ไม่รัน agent ใหม่) — null ถ้ายังไม่เคยรัน */
  async getCached(sn: string, moduleNum: number): Promise<DiagnoseResult | null> {
    const res = await apiFetch(
      `/ai/agent/diagnosis?sn=${encodeURIComponent(sn)}&module=${moduleNum}`,
    );
    const data = await asJson<DiagnoseResult>(res);
    return data?.diagnosis ? data : null;
  },
};
