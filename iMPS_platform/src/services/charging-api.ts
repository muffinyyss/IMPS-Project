/**
 * charging-api.ts
 * วางที่: services/charging-api.ts
 *
 * รองรับ 2 หัวชาร์จ — ใช้ connectorId (1=หัว1, 2=หัว2)
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

async function fetchJson<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string>) },
    credentials: "include",
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`${resp.status} ${text}`);
  }
  return resp.json();
}

// ===== Types =====

export interface SessionData {
  _id: string; state: string; connectorId: number;
  soc: number; powerKw: number; energyCharged: number;
  chargingTime: number; totalPrice: number;
}

export interface StartChargingResponse {
  success: boolean; message: string;
  data: { session: { _id: string; state: string; connectorId: number; idTag: string; }; };
}

export interface StopChargingResponse {
  success: boolean; message: string;
}

export interface ActiveSessionsResponse {
  success: boolean;
  data: { "1": SessionData | null; "2": SessionData | null; };
}

export interface ActiveSessionResponse {
  success: boolean;
  data: SessionData | null;
}

// ===== API =====

/** Step 1: สั่งเริ่มชาร์จ */
export function startCharging(stationId: string, chargerId: string, connectorId: number) {
  return fetchJson<StartChargingResponse>("/api/charging/start", {
    method: "POST",
    body: JSON.stringify({ stationId, chargerId, connectorId }),
  });
}

/** Step 5: สั่งหยุดชาร์จ */
export function stopCharging(sessionId: string) {
  return fetchJson<StopChargingResponse>(`/api/charging/${sessionId}/stop`, { method: "POST" });
}

/** ดึง Active sessions ทั้ง 2 หัว (reload restore) */
export function getAllActiveSessions() {
  return fetchJson<ActiveSessionsResponse>("/api/charging/active");
}

/** ดึง Active session เฉพาะหัว (1 หรือ 2) */
export function getActiveSession(connectorId: number) {
  return fetchJson<ActiveSessionResponse>(`/api/charging/active/${connectorId}`);
}