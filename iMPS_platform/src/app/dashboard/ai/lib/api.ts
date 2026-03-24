// src/app/dashboard/ai/lib/api.ts

const AI_API_BASE = process.env.NEXT_PUBLIC_AI_API_URL || "http://203.154.130.132:8001";

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${AI_API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ModuleResult {
  health?: number;
  status?: string;
  error?: string;
  _result_ts?: string;
  [key: string]: unknown;
}

export interface DashboardAllResponse {
  station: string;
  modules: Record<string, ModuleResult>;
  elapsed_ms: number;
}

export interface Station {
  sn: string;
  name: string;
  province?: string;
}

export interface HealthDataPoint {
  timestamp: string;
  system_health: number;
  modules: Record<string, number>;
}

export interface StationRow {
  sn: string;
  name: string;
  province?: string;
  modules: Record<string, number | null>;
  system_health: number | null;
  ok_count: number;
  updated?: string;
}

export interface MonitorOverviewResponse {
  stations: StationRow[];
  total: number;
  full_coverage: number;
  partial: number;
  no_data: number;
}

export interface ChartReadyResponse {
  timestamps: string[];
  values: Record<string, (number | null)[]>;
  count: number;
  fields: string[];
}

export interface RawDataResponse {
  data: Record<string, any>[];
  count: number;
  fields?: string[];
  range?: string;
}

// ── API Client ──────────────────────────────────────────────────────────────
export const aiApi = {
  dashboardAll: () =>
    fetchJSON<DashboardAllResponse>("/api/dashboard/all"),

  moduleLatest: (mod: number) =>
    fetchJSON<ModuleResult>(`/api/m${mod}/latest`),

  stations: () =>
    fetchJSON<Station[]>("/api/stations"),

  activeStation: () =>
    fetchJSON<{ sn: string; name: string }>("/api/active-station"),

  switchStation: (sn: string) =>
    fetchJSON<{ ok: boolean }>(`/api/switch-station/${sn}`, { method: "POST" }),

  healthSnapshot: () =>
    fetchJSON<{ system_health: number; modules: Record<string, number> }>("/api/health/snapshot"),

  healthHistory: (range: "daily" | "weekly" | "monthly" = "daily") => {
    const hours = range === "monthly" ? 720 : range === "weekly" ? 168 : 24;
    return fetchJSON<any>(`/api/health/history?hours=${hours}&range=${range}`);
  },

  monitorOverview: () =>
    fetchJSON<MonitorOverviewResponse>("/api/monitor/overview"),

  dbStatus: () =>
    fetchJSON<{ connected: boolean }>("/api/db/status"),

  // ── Historical endpoints ──────────────────────────────────────────────
  // M1, M2 — returns ChartReadyResponse
  m1Historical: (range = "daily", fields = "MDB_ambient_temp,pi5_temp") =>
    fetchJSON<ChartReadyResponse>(`/api/m1/historical?range=${range}&fields=${encodeURIComponent(fields)}`),

  m2Historical: (range = "daily", fields = "power_module_temp1,power_module_temp2,power_module_temp3,power_module_temp4,power_module_temp5") =>
    fetchJSON<ChartReadyResponse>(`/api/m2/historical?range=${range}&fields=${encodeURIComponent(fields)}`),

  // M3, M5 — returns RawDataResponse
  m3Historical: (range = "daily", fields = "VL1N_MDB,VL2N_MDB,VL3N_MDB") =>
    fetchJSON<RawDataResponse>(`/api/m3/historical?range=${range}&fields=${encodeURIComponent(fields)}`),

  m5Historical: (range = "daily", fields = "router_status,PLC_network_status1,PLC_network_status2,edgebox_network_status,pi5_network_status") =>
    fetchJSON<RawDataResponse>(`/api/m5/historical?range=${range}&fields=${encodeURIComponent(fields)}`),

  // M4 — generic historical
  m4Historical: (range = "daily", fields = "target_voltage1,present_voltage1", start?: string, end?: string) => {
    let url = `/api/historical?range=${range}&fields=${encodeURIComponent(fields)}`;
    if (start) url += `&start=${start}`;
    if (end)   url += `&end=${end}`;
    return fetchJSON<RawDataResponse>(url);
  },

  // M4 — conditions (anomaly per condition C01-C22)
  m4Conditions: () =>
    fetchJSON<any>("/api/m4/conditions"),
};