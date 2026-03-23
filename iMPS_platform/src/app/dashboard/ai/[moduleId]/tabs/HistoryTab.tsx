"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { aiApi, ChartReadyResponse, RawDataResponse } from "../../lib/api";
import { getHealthColor } from "../../lib/constants";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

type Range = "daily" | "weekly" | "monthly";

// ── Field group config ────────────────────────────────────────────────────
interface FieldGroup {
  key: string;
  label: string;
  fields: string[];
  colors: string[];
  names?: string[];
  unit?: string;
  scale?: number;
  dualAxis?: boolean;
}

// ── Per-module field groups ───────────────────────────────────────────────
const FIELD_GROUPS: Record<number, FieldGroup[]> = {
  1: [
    { key: "temperature",  label: "🌡 Temperature",    fields: ["MDB_ambient_temp", "pi5_temp"],                          colors: ["#ef4444", "#f97316"],           names: ["MDB Ambient (°C)", "Pi5 CPU (°C)"] },
    { key: "environment",  label: "🌫 Environment",    fields: ["MDB_humidity", "MDB_pressure"],                           colors: ["#3b82f6", "#8b5cf6"],           names: ["Humidity (%)", "Pressure (hPa)"], dualAxis: true },
    { key: "filter",       label: "🌀 Filter Age",     fields: ["dust_filter_charging"],                                   colors: ["#d97706"],                      names: ["Days Since Change"] },
    { key: "meters",       label: "⚡ Energy Meters",  fields: ["meter1", "meter2"],                                       colors: ["#22c55e", "#06b6d4"],           names: ["Meter 1", "Meter 2"] },
    { key: "all_sensors",  label: "📊 All Key Sensors",fields: ["MDB_ambient_temp", "pi5_temp", "MDB_humidity"],           colors: ["#ef4444", "#f97316", "#3b82f6"],names: ["MDB Temp", "Pi5 Temp", "Humidity"] },
  ],
  2: [
    { key: "pm_temp",      label: "🌡 PM Temperatures",  fields: ["power_module_temp1","power_module_temp2","power_module_temp3","power_module_temp4","power_module_temp5"], colors: ["#f87171","#fb923c","#fbbf24","#a78bfa","#38bdf8"], names: ["PM1","PM2","PM3","PM4","PM5"], unit: "°C" },
    { key: "fan_rpm",      label: "🔄 Fan RPM",           fields: ["fan_RPM1","fan_RPM2","fan_RPM3","fan_RPM4","fan_RPM5","fan_RPM6","fan_RPM7","fan_RPM8"],              colors: ["#f87171","#fb923c","#fbbf24","#34d399","#38bdf8","#a78bfa","#ec4899","#64748b"], names: ["Fan 1","Fan 2","Fan 3","Fan 4","Fan 5","Fan 6","Fan 7","Fan 8"] },
    { key: "env_temp",     label: "🌡 Environment Temp",  fields: ["ambient_temp","edgebox_temp","pi5_temp"],                                                              colors: ["#34d399","#38bdf8","#fbbf24"],  names: ["Ambient","Edgebox","Pi5"], unit: "°C" },
    { key: "power",        label: "⚡ Charging Power",    fields: ["P(t)1","P(t)2"],                                                                                       colors: ["#f87171","#38bdf8"],            names: ["Power Con.1","Power Con.2"] },
    { key: "maintenance",  label: "🔧 Maintenance",       fields: ["time_since_last_DFC","meter1","meter2"],                                                               colors: ["#fbbf24","#34d399","#a78bfa"],  names: ["Time Since DFC","Meter 1","Meter 2"] },
  ],
  3: [
    { key: "ac_voltage",   label: "⚡ AC Voltage 3-Phase", fields: ["VL1N_MDB","VL2N_MDB","VL3N_MDB"],                                                                  colors: ["#0284c7","#7c3aed","#059669"],  unit: "V" },
    { key: "ac_current",   label: "⚡ AC Current 3-Phase", fields: ["I1_MDB","I2_MDB","I3_MDB"],                                                                         colors: ["#dc2626","#d97706","#0891b2"],  unit: "A" },
    { key: "temperature",  label: "🌡 Temperature",        fields: ["edgebox_temp","pi5_temp","charger_temp"],                                                            colors: ["#d97706","#dc2626","#0284c7"],  unit: "°C" },
    { key: "signal",       label: "📶 Wi-Fi Signal",       fields: ["RSSI"],                                                                                              colors: ["#7c3aed"],                      unit: "dBm" },
    { key: "energy",       label: "🔋 Energy Meter",       fields: ["meter1","meter2"],                                                                                   colors: ["#0284c7","#059669"],            unit: "kWh", scale: 0.001 },
  ],
  4: [
    { key: "voltage",      label: "⚡ Voltage",           fields: ["target_voltage1","present_voltage1","target_voltage2","present_voltage2"],                           colors: ["#0284c7","#38bdf8","#7c3aed","#a78bfa"], unit: "V" },
    { key: "current",      label: "⚡ Current",           fields: ["target_current1","present_current1","target_current2","present_current2"],                           colors: ["#dc2626","#f87171","#d97706","#fbbf24"],  unit: "A" },
    { key: "temperature",  label: "🌡 Temperature",       fields: ["charger_temp","charger_gun_temp_plus1","charger_gun_temp_plus2","edgebox_temp"],                     colors: ["#db2777","#f472b6","#e879f9","#d97706"],  unit: "°C" },
    { key: "power_module", label: "🔌 Power Module Temp", fields: ["power_module_temp1","power_module_temp2","power_module_temp3","power_module_temp4","power_module_temp5"], colors: ["#dc2626","#d97706","#059669","#0284c7","#7c3aed"], unit: "°C" },
    { key: "soc",          label: "🔋 SOC",               fields: ["SOC"],                                                                                               colors: ["#059669"],                              unit: "%" },
    { key: "energy",       label: "⚡ Energy",            fields: ["meter1","meter2"],                                                                                   colors: ["#0284c7","#059669"],                    unit: "kWh", scale: 0.001 },
  ],
  5: [
    { key: "devices",      label: "📡 All Devices",       fields: ["router_status","PLC_network_status1","PLC_network_status2","edgebox_network_status","pi5_network_status","energy_meter_network_status1"], colors: ["#0284c7","#7c3aed","#a78bfa","#059669","#fbbf24","#06b6d4"], names: ["Router","PLC1","PLC2","Edgebox","Pi5","Meter1"] },
    { key: "plc",          label: "🔌 PLC Network",       fields: ["PLC_network_status1","PLC_network_status2"],                                                         colors: ["#7c3aed","#a78bfa"] },
    { key: "severity",     label: "📊 Severity Score",    fields: ["severity","anomaly_score"],                                                                          colors: ["#dc2626","#d97706"],            names: ["Severity","Anomaly Score"] },
  ],
  6: [], // ใช้ health/history
  7: [], // in-memory
};

// ── Helpers ───────────────────────────────────────────────────────────────
const ACTIVE_VALS = new Set(["active","connected","online","1",1]);
const isActive = (v: any) => ACTIVE_VALS.has(String(v).toLowerCase());

function fmtTime(ts: string, range: Range) {
  const d = new Date(ts);
  if (range === "daily")   return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  if (range === "weekly")  return d.toLocaleDateString("th-TH",  { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

// ── Range + Group selector ────────────────────────────────────────────────
function RangeBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`tw-px-3 tw-py-1.5 tw-text-xs tw-rounded-lg tw-font-medium tw-transition-colors
        ${active ? "tw-text-white tw-bg-blue-500" : "tw-bg-gray-100 tw-text-gray-600 hover:tw-bg-gray-200"}`}
    >{label}</button>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tw-bg-white tw-border tw-border-gray-200 tw-rounded-xl tw-shadow-lg tw-p-3 tw-text-xs tw-min-w-[160px]">
      <div className="tw-font-semibold tw-text-gray-700 tw-mb-2">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="tw-flex tw-items-center tw-gap-2 tw-py-0.5">
          <span className="tw-w-2 tw-h-2 tw-rounded-full tw-flex-shrink-0" style={{ background: p.color }} />
          <span className="tw-text-gray-500 tw-truncate">{p.name}:</span>
          <span className="tw-font-medium tw-ml-auto">{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stats card ────────────────────────────────────────────────────────────
function FieldStats({ values, name, color, unit }: {
  values: (number | null)[]; name: string; color: string; unit?: string;
}) {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const last = nums[nums.length - 1];
  return (
    <div className="tw-bg-gray-50 tw-rounded-xl tw-p-3 tw-border tw-border-gray-100">
      <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
        <div className="tw-w-2 tw-h-2 tw-rounded-full" style={{ background: color }} />
        <span className="tw-text-xs tw-font-medium tw-text-gray-600 tw-truncate">{name}</span>
      </div>
      <div className="tw-grid tw-grid-cols-4 tw-gap-1">
        {[["Last", last], ["Min", min], ["Max", max], ["Avg", avg]].map(([l, v]) => (
          <div key={String(l)} className="tw-text-center">
            <div className="tw-text-xs tw-text-gray-400">{l}</div>
            <div className="tw-text-xs tw-font-semibold tw-text-gray-700">
              {typeof v === "number" ? v.toFixed(1) : "—"}{unit ? <span className="tw-text-gray-400 tw-font-normal"> {unit}</span> : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── M5 Gantt canvas chart (device online/offline timeline) ────────────────
function M5GanttChart({
  data, fields, names,
}: {
  data: Record<string, any>[];
  fields: string[];
  names?: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ROW_H = 36, LABEL_W = 130, BAR_H = 20, PADDING_TOP = 8;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.offsetWidth || 800;
    const H = (fields.length * ROW_H) + PADDING_TOP + 20;
    canvas.width = W;
    canvas.height = H;

    ctx.clearRect(0, 0, W, H);
    const chartW = W - LABEL_W - 10;
    const n = data.length;

    fields.forEach((field, rowIdx) => {
      const y = PADDING_TOP + rowIdx * ROW_H;
      const label = names?.[rowIdx] ?? field.replace(/_/g, " ").replace("status", "").trim();

      // Row label
      ctx.fillStyle = "#64748b";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(label, LABEL_W - 6, y + ROW_H / 2 + 4);

      // Draw bars
      const barW = Math.max(1, chartW / n);
      data.forEach((d, i) => {
        const active = isActive(d[field]);
        ctx.fillStyle = active ? "#22c55e" : "#ef4444";
        ctx.fillRect(
          LABEL_W + i * barW,
          y + (ROW_H - BAR_H) / 2,
          barW - 0.5,
          BAR_H
        );
      });

      // Row separator
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(LABEL_W, y + ROW_H);
      ctx.lineTo(W, y + ROW_H);
      ctx.stroke();
    });

    // X axis time labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    const labelCount = Math.min(8, n);
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.floor((i / (labelCount - 1)) * (n - 1));
      const x = LABEL_W + (idx / n) * chartW;
      const ts = data[idx]?.timestamp ?? "";
      if (ts) {
        const d = new Date(ts);
        const txt = `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
        ctx.fillText(txt, x, H - 4);
      }
    }
  }, [data, fields, names]);

  return (
    <div className="tw-w-full tw-overflow-x-auto">
      <canvas ref={canvasRef} className="tw-w-full" style={{ height: fields.length * ROW_H + 28 }} />
    </div>
  );
}

// ── M7 In-memory Gantt ────────────────────────────────────────────────────
const ICP_STATE_COLORS: Record<number, string> = {
  0: "#6b7280", 1: "#94a3b8", 2: "#60a5fa", 3: "#34d399", 4: "#22c55e",
  5: "#6366f1", 6: "#dc2626", 7: "#64748b", 13: "#ef4444",
};
const USL_STATE_COLORS: Record<number, string> = {
  0: "#059669", 1: "#3b82f6", 2: "#10b981", 3: "#34d399",
  4: "#6366f1", 5: "#8b5cf6", 6: "#a78bfa", 7: "#c4b5fd",
  8: "#ddd6fe", 9: "#f0abfc", 10: "#f9a8d4", 11: "#fca5a5",
  12: "#fcd34d", 13: "#fbbf24", 14: "#fb923c", 15: "#f97316", 16: "#64748b",
};

interface M7Entry { ts: Date; val: number; name: string; }

function M7GanttBar({ history, colorMap, title }: {
  history: M7Entry[]; colorMap: Record<number, string>; title: string;
}) {
  if (!history.length) return (
    <div className="tw-text-center tw-text-gray-400 tw-text-xs tw-py-4">
      รอ polling data... (จะแสดงเมื่อมีข้อมูล)
    </div>
  );
  return (
    <div>
      <div className="tw-text-xs tw-text-gray-500 tw-mb-2">{title}</div>
      <div className="tw-flex tw-gap-0.5 tw-h-8 tw-w-full tw-rounded-lg tw-overflow-hidden">
        {history.map((e, i) => (
          <div key={i} className="tw-flex-1 tw-h-full tw-group tw-relative"
            style={{ background: colorMap[e.val] ?? "#e2e8f0", minWidth: 4 }}
            title={`${e.name} — ${e.ts.toLocaleTimeString("th-TH")}`}
          />
        ))}
      </div>
      <div className="tw-flex tw-items-center tw-justify-between tw-mt-1 tw-text-xs tw-text-gray-400">
        <span>{history[0]?.ts.toLocaleTimeString("th-TH")}</span>
        <span>{history[history.length - 1]?.ts.toLocaleTimeString("th-TH")}</span>
      </div>
    </div>
  );
}

// ── Main HistoryTab ───────────────────────────────────────────────────────
interface Props {
  modNum: number;
  modKey: string;
  modColor: string;
  modLabel: string;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

const CBM_ZONES = [
  { y: 80, color: "#059669" },
  { y: 60, color: "#d97706" },
  { y: 40, color: "#ea580c" },
];

export default function HistoryTab({ modNum, modKey, modColor, modLabel }: Props) {
  const groups = FIELD_GROUPS[modNum] ?? [];
  const [range, setRange]     = useState<Range>("daily");
  const [groupKey, setGroupKey] = useState(groups[0]?.key ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Data states
  const [chartReady, setChartReady] = useState<ChartReadyResponse | null>(null); // M1,M2
  const [rawData, setRawData]       = useState<Record<string, any>[]>([]);       // M3,M4,M5
  const [healthData, setHealthData] = useState<any[]>([]);                       // M6
  const [m7IcpHistory, setM7IcpHistory] = useState<M7Entry[]>([]);               // M7
  const [m7UslHistory, setM7UslHistory] = useState<M7Entry[]>([]);

  const activeGroup = groups.find((g) => g.key === groupKey) ?? groups[0];

  // ── Fetch logic ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fields = activeGroup?.fields.join(",") ?? "";

      if (modNum === 1) {
        const res = await aiApi.m1Historical(range, fields);
        setChartReady(res);
      } else if (modNum === 2) {
        const res = await aiApi.m2Historical(range, fields);
        setChartReady(res);
      } else if (modNum === 3) {
        const res = await aiApi.m3Historical(range, fields);
        setRawData(Array.isArray(res.data) ? res.data : []);
      } else if (modNum === 4) {
        const res = await aiApi.m4Historical(range, fields);
        setRawData(Array.isArray(res.data) ? res.data : []);
      } else if (modNum === 5) {
        const res = await aiApi.m5Historical(range, fields);
        setRawData(Array.isArray(res.data) ? res.data : []);
      } else if (modNum === 6) {
        const res = await aiApi.healthHistory(range);
        const list = (res as any)?.data ?? [];
        setHealthData(list);
      } else if (modNum === 7) {
        // Poll latest and push to in-memory
        const latest = await aiApi.moduleLatest(7);
        const d = latest as any;
        const now = new Date();
        setM7IcpHistory((prev) => {
          const next = [...prev, { ts: now, val: d.icp_state ?? 0, name: `State ${d.icp_state}` }];
          return next.slice(-50);
        });
        setM7UslHistory((prev) => {
          const next = [...prev, { ts: now, val: d.uslink_state ?? 0, name: `State ${d.uslink_state}` }];
          return next.slice(-50);
        });
      }
    } catch (e) {
      setError("ไม่สามารถโหลด Historical Data ได้");
    } finally {
      setLoading(false);
    }
  }, [modNum, range, activeGroup?.key]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Chart data transformers ───────────────────────────────────────────

  // M1, M2 — string labels
  const chartReadyDatasets = useMemo(() => {
    if (!chartReady || !activeGroup) return { labels: [], datasets: [] };
    const labels = chartReady.timestamps.map((ts) => fmtTime(ts, range));
    const datasets = activeGroup.fields.map((f, i) => ({
      name: activeGroup.names?.[i] ?? f.replace(/_/g, " "),
      data: labels.map((time, j) => ({ time, value: chartReady.values[f]?.[j] ?? null })),
      color: activeGroup.colors[i % activeGroup.colors.length],
    }));
    return { labels, datasets };
  }, [chartReady, activeGroup, range]);

  // M3, M4 — time-based raw data
  const rawDatasets = useMemo(() => {
    if (!rawData.length || !activeGroup) return [];
    const sc = activeGroup.scale ?? 1;
    return activeGroup.fields.map((f, i) => {
      const parsed = rawData.map((d) => {
        const v = parseFloat(d[f]);
        return { time: fmtTime(d.timestamp ?? d.timestamp_utc ?? "", range), value: isNaN(v) ? null : v * sc };
      });
      return {
        name: activeGroup.names?.[i] ?? f.replace(/_/g, " "),
        data: parsed,
        color: activeGroup.colors[i % activeGroup.colors.length],
      };
    });
  }, [rawData, activeGroup, range]);

  // M6 — health score
  const healthDatasets = useMemo(() => {
    if (!healthData.length) return [];
    return [{
      time: healthData.map((d) => fmtTime(d.timestamp, range)),
      value: healthData.map((d) => d.score ?? null),
      modValue: healthData.map((d) => d.modules?.[modKey] ?? null),
    }];
  }, [healthData, modKey, range]);

  // recharts data: flatten to [{time, [field]: value}]
  const rechartsData = useMemo(() => {
    if (modNum === 1 || modNum === 2) {
      if (!chartReadyDatasets.labels.length) return [];
      return chartReadyDatasets.labels.map((time, i) => {
        const row: Record<string, any> = { time };
        chartReadyDatasets.datasets.forEach((ds) => {
          row[ds.name] = ds.data[i]?.value ?? null;
        });
        return row;
      });
    }
    if (modNum === 3 || modNum === 4) {
      if (!rawDatasets.length) return [];
      return rawDatasets[0]?.data.map((_, i) => {
        const row: Record<string, any> = { time: rawDatasets[0].data[i].time };
        rawDatasets.forEach((ds) => { row[ds.name] = ds.data[i]?.value ?? null; });
        return row;
      }) ?? [];
    }
    if (modNum === 6 && healthDatasets.length) {
      const h = healthDatasets[0];
      return h.time.map((time, i) => ({
        time,
        "System Health": h.value[i],
        [`M${modNum.toString().padStart(0, "")} Health`]: h.modValue[i],
      }));
    }
    return [];
  }, [modNum, chartReadyDatasets, rawDatasets, healthDatasets]);

  const activeDatasets = modNum === 1 || modNum === 2
    ? chartReadyDatasets.datasets
    : modNum === 5 ? [] // Gantt
    : rawDatasets;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="tw-flex tw-flex-col tw-gap-5">
      {/* Controls */}
      <div className="tw-flex tw-items-start tw-justify-between tw-flex-wrap tw-gap-3">
        <div>
          <div className="tw-text-sm tw-font-semibold tw-text-gray-700">📈 Historical Graph — {modLabel}</div>
          <div className="tw-text-xs tw-text-gray-400 tw-mt-0.5">
            {modNum <= 5 ? `API: /api/${modNum === 4 ? "" : `m${modNum}/`}historical` : modNum === 6 ? "API: /api/health/history" : "In-memory polling"}
          </div>
        </div>
        <div className="tw-flex tw-flex-wrap tw-gap-2 tw-items-center">
          <div className="tw-flex tw-gap-1">
            <RangeBtn label="24h"  active={range === "daily"}   onClick={() => setRange("daily")} />
            <RangeBtn label="7d"   active={range === "weekly"}  onClick={() => setRange("weekly")} />
            <RangeBtn label="30d"  active={range === "monthly"} onClick={() => setRange("monthly")} />
          </div>
          {groups.length > 0 && (
            <select
              value={groupKey}
              onChange={(e) => setGroupKey(e.target.value)}
              className="tw-px-3 tw-py-1.5 tw-text-xs tw-border tw-border-gray-200 tw-rounded-lg
                         tw-outline-none tw-bg-white tw-cursor-pointer"
            >
              {groups.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          )}
          <button onClick={loadData}
            className="tw-px-3 tw-py-1.5 tw-text-xs tw-border tw-border-gray-200 tw-rounded-lg hover:tw-bg-gray-50">
            ↻
          </button>
        </div>
      </div>

      {error && (
        <div className="tw-p-3 tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-xl tw-text-red-700 tw-text-sm">
          ⚠ {error}
        </div>
      )}

      {/* ── M7: In-memory Gantt ─────────────────────────────────────── */}
      {modNum === 7 && (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-p-5">
          <div className="tw-text-xs tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-wide tw-mb-4">
            State Timeline (in-memory, max 50 entries)
          </div>
          <div className="tw-flex tw-flex-col tw-gap-5">
            <M7GanttBar history={m7IcpHistory} colorMap={ICP_STATE_COLORS} title="ICP State Timeline" />
            <M7GanttBar history={m7UslHistory} colorMap={USL_STATE_COLORS} title="USLink State Timeline" />
          </div>
          <div className="tw-mt-3 tw-text-xs tw-text-amber-600 tw-bg-amber-50 tw-px-3 tw-py-2 tw-rounded-lg">
            ⚠ Timeline จะหายเมื่อ refresh หน้า — ข้อมูลสะสมจาก polling ทุก 120 วินาที
          </div>
        </div>
      )}

      {/* ── M5: Gantt or Line chart ─────────────────────────────────── */}
      {modNum === 5 && (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-p-5">
          <div className="tw-text-xs tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-wide tw-mb-3">
            {activeGroup?.label}
          </div>
          {loading ? (
            <div className="tw-flex tw-items-center tw-justify-center tw-h-40 tw-gap-3">
              <div className="tw-w-5 tw-h-5 tw-rounded-full tw-border-2 tw-border-gray-200 tw-border-t-blue-500 tw-animate-spin" />
            </div>
          ) : !rawData.length ? (
            <div className="tw-text-center tw-text-gray-400 tw-py-8 tw-text-sm">ไม่มีข้อมูล</div>
          ) : activeGroup?.key === "severity" ? (
            // Severity → Line chart
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rawData.map((d) => ({
                time: fmtTime(d.timestamp, range),
                severity: parseFloat(d.severity) || null,
                anomaly_score: parseFloat(d.anomaly_score) || null,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="severity"     name="Severity"      stroke="#dc2626" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="anomaly_score" name="Anomaly Score" stroke="#d97706" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            // Device status → Gantt canvas
            <>
              <div className="tw-flex tw-items-center tw-gap-3 tw-mb-3 tw-text-xs">
                <div className="tw-flex tw-items-center tw-gap-1"><div className="tw-w-3 tw-h-3 tw-rounded tw-bg-green-500" /><span className="tw-text-gray-600">Active/Connected</span></div>
                <div className="tw-flex tw-items-center tw-gap-1"><div className="tw-w-3 tw-h-3 tw-rounded tw-bg-red-500" /><span className="tw-text-gray-600">Inactive/Offline</span></div>
              </div>
              <M5GanttChart data={rawData} fields={activeGroup?.fields ?? []} names={activeGroup?.names} />
            </>
          )}
        </div>
      )}

      {/* ── M1, M2, M3, M4, M6: Line/Area chart ─────────────────────── */}
      {modNum !== 5 && modNum !== 7 && (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-p-5">
          <div className="tw-text-xs tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-wide tw-mb-4">
            {activeGroup?.label ?? modLabel} {activeGroup?.unit ? `(${activeGroup.unit})` : ""}
          </div>
          {loading ? (
            <div className="tw-flex tw-items-center tw-justify-center tw-h-52 tw-gap-3">
              <div className="tw-w-5 tw-h-5 tw-rounded-full tw-border-2 tw-border-gray-200 tw-border-t-blue-500 tw-animate-spin" />
            </div>
          ) : !rechartsData.length ? (
            <div className="tw-text-center tw-text-gray-400 tw-py-12 tw-text-sm">ไม่มีข้อมูล</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={rechartsData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    {activeDatasets.map((ds, i) => (
                      <linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={ds.color} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={ds.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false}
                    interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {/* CBM thresholds for M6 */}
                  {modNum === 6 && CBM_ZONES.map((z) => (
                    <ReferenceLine key={z.y} y={z.y} stroke={z.color} strokeDasharray="4 3" strokeWidth={1.5} />
                  ))}
                  {activeDatasets.map((ds, i) => (
                    <Area key={ds.name} type="monotone" dataKey={ds.name}
                      stroke={ds.color} strokeWidth={2}
                      fill={`url(#grad-${i})`}
                      dot={false} activeDot={{ r: 3 }} connectNulls />
                  ))}
                  {/* M6 adds module health line */}
                  {modNum === 6 && (
                    <Line type="monotone" dataKey={`M${modNum} Health`}
                      stroke={modColor} strokeWidth={2} strokeDasharray="4 2"
                      dot={false} connectNulls />
                  )}
                </AreaChart>
              </ResponsiveContainer>

              {/* dualAxis note */}
              {activeGroup?.dualAxis && (
                <div className="tw-text-xs tw-text-gray-400 tw-mt-2">
                  * กราฟนี้มี 2 Y-axis — ค่าซ้ายและขวาต่างหน่วยกัน
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Stats cards (M1, M2, M3, M4) ────────────────────────────── */}
      {[1,2,3,4].includes(modNum) && rechartsData.length > 0 && activeDatasets.length > 0 && (
        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-3">
          {activeDatasets.map((ds) => {
            const vals = rechartsData.map((d) => d[ds.name] as number | null);
            return (
              <FieldStats key={ds.name} values={vals} name={ds.name}
                color={ds.color} unit={activeGroup?.unit} />
            );
          })}
        </div>
      )}
    </div>
  );
}