"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { aiApi, ModuleResult } from "../lib/api";
import { MODULES, ModuleConfig, getHealthColor, getHealthLabel } from "../lib/constants";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

// ── Tab imports ───────────────────────────────────────────────────────────
import M1FilterHealthTab from "./tabs/M1FilterHealthTab";   // ← เพิ่ม
import DetectionTab from "./tabs/DetectionTab";
import HistoryTab from "./tabs/HistoryTab";
import AlgorithmTab from "./tabs/AlgorithmTab";
import DetectionOutputTab from "./tabs/DetectionOutputTab";
import M4LiveMonitorTab from "./tabs/M4LiveMonitorTab";
import M6RulDashboardTab from "./tabs/M6RulDashboardTab";
import M6ComponentDetailTab from "./tabs/M6ComponentDetailTab";
import M7StateMonitorTab from "./tabs/M7StateMonitorTab";
import M7TimelineTab from "./tabs/M7TimelineTab";
import M7FailurePredictionTab from "./tabs/M7FailurePredictionTab";
import M4RuleBasedTab from "./tabs/M4RuleBasedTab";
import M4StandardsTab from "./tabs/M4StandardsTab";

import { M2DetectionTab, M3DetectionTab } from "./tabs/M2M3DetectionTree";

import { useStation } from "../hooks/useStation";
import "../ai-theme.css";
import M4AiDetectionTab from "./tabs/M4AiDetectionTab";
import M5NetworkTreeTab from "./tabs/M5NetworkTreeTab";

// ── Tab config per module ─────────────────────────────────────────────────
interface TabDef { key: string; label: string; }

const MODULE_TABS: Record<number, TabDef[]> = {
  1: [
    { key: "filter-health", label: "🌀 Filter Health" },
    { key: "ai-prediction", label: "🧪 AI Prediction" },
    { key: "history", label: "📈 Historical Graph" },
    { key: "algorithms", label: "📖 Algorithms" },
  ],
  2: [
    { key: "detection", label: "🔄 AI Detection & Health Tree" },
    { key: "history", label: "📈 Historical Graph" },
    { key: "algorithms", label: "📖 Algorithm Description" },
    { key: "output", label: "📊 Detection Output" },
  ],
  3: [
    { key: "detection", label: "📡 AI Detection & Health Tree" },
    { key: "history", label: "📈 Historical Graph" },
    { key: "algorithms", label: "📖 Algorithm Description" },
    { key: "output", label: "📊 Detection Output" },
  ],
  4: [
    { key: "live-monitor", label: "⚡ Live Monitor" },
    { key: "ai-detection", label: "🤖 AI-Module Detection" },
    { key: "rule-based", label: "🛰 Rule Based Algorithm" },
    { key: "standards", label: "📚 Standards Reference" },
    { key: "algorithms", label: "📜 Rule-Based Description" },
    { key: "history", label: "📈 Historical Graph" },
    { key: "output", label: "📊 Detection Output" },
  ],
  5: [
    { key: "detection", label: "🌐 AI Detection & Network Tree" },
    { key: "history", label: "📈 Historical Graph" },
    { key: "algorithms", label: "📖 Algorithm Description" },
    { key: "output", label: "📊 Detection Output" },
  ],
  6: [
    { key: "rul-dashboard", label: "⏳ RUL Dashboard" },
    { key: "component", label: "🔍 Component Detail" },
    { key: "algorithms", label: "📖 Algorithm Description" },
    { key: "output", label: "📊 Prediction Output" },
  ],
  7: [
    { key: "state-monitor", label: "🔍 State Monitor" },
    { key: "timeline", label: "📅 Timeline" },
    { key: "failure", label: "⚠️ Failure Prediction" },
    { key: "algorithms", label: "📖 Algorithm Description" },
  ],
};

// ── Shared UI components ──────────────────────────────────────────────────
function HealthGauge({ value }: { value: number | null }) {
  const ARC = 157;
  const pct = value != null ? Math.max(0, Math.min(100, value)) / 100 : 0;
  const color = getHealthColor(value);
  return (
    <div className="tw-flex tw-flex-col tw-items-center">
      <svg viewBox="0 0 120 70" className="tw-w-32 tw-h-20">
        <path d="M 10 62 A 50 50 0 0 1 110 62" stroke="#e2e8f0" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M 10 62 A 50 50 0 0 1 110 62" stroke={color} strokeWidth="10" fill="none"
          strokeLinecap="round" strokeDasharray={`${ARC} ${ARC}`}
          strokeDashoffset={(1 - pct) * ARC} />
      </svg>
      <div className="tw-text-3xl tw-font-bold tw--mt-4" style={{ color }}>
        {value != null ? `${value}%` : "—"}
      </div>
      <div className="tw-text-sm tw-text-gray-500 tw-mt-1">{getHealthLabel(value)}</div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const cls =
    ["active", "normal", "ok", "good"].includes(s) ? "tw-bg-green-100 tw-text-green-700" :
      ["warn", "warning"].includes(s) ? "tw-bg-amber-100 tw-text-amber-700" :
        ["inactive", "offline", "error", "crit", "critical", "fault"].includes(s) ? "tw-bg-red-100 tw-text-red-700" :
          "tw-bg-gray-100 tw-text-gray-600";
  return <span className={`tw-px-2.5 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-semibold ${cls}`}>{status}</span>;
}

function MetricCard({ label, value, unit, color }: {
  label: string; value?: string | number | null; unit?: string; color?: string;
}) {
  return (
    <div className="tw-bg-gray-50 tw-rounded-xl tw-p-3 tw-border tw-border-gray-100">
      <div className="tw-text-xs tw-text-gray-400 tw-mb-1">{label}</div>
      <div className="tw-text-base tw-font-semibold tw-text-gray-800" style={color ? { color } : {}}>
        {value ?? "—"}
        {unit && value != null ? <span className="tw-text-xs tw-font-normal tw-text-gray-400 tw-ml-1">{unit}</span> : ""}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-p-5">
      <div className="tw-text-xs tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-wide tw-mb-4">{title}</div>
      {children}
    </div>
  );
}

// ── Default detail views (filter-health / detection / ai-detection tabs) ──
function DefaultDetailView({ data, modNum }: { data: ModuleResult; modNum: number }) {
  if (data.error) return (
    <div className="tw-text-center tw-text-gray-400 tw-py-12 tw-text-sm">ไม่มีข้อมูล Module {modNum}</div>
  );
  const d = (data as any).data ?? {};
  const t = (data as any).telemetry ?? {};

  switch (modNum) {
    case 1:
      return (
        <div className="tw-flex tw-flex-col tw-gap-4">
          <Section title="MDB Sensor Telemetry">
            <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-3">
              <MetricCard label="Ambient Temp" value={t.MDB_ambient_temp} unit="°C" />
              <MetricCard label="Humidity" value={t.MDB_humidity} unit="%" />
              <MetricCard label="Pressure" value={t.MDB_pressure} unit="hPa" />
              <MetricCard label="Pi5 Temp" value={t.pi5_temp} unit="°C" />
              <MetricCard label="Dust Filter Days" value={t.dust_filter_charging} unit="days" />
              <MetricCard label="MDB Status" value={t.MDB_status} />
            </div>
          </Section>
          <Section title="AI Model Results">
            <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-3">
              <MetricCard label="Ensemble Risk" value={(data as any).ensemble_risk != null ? `${((data as any).ensemble_risk * 100).toFixed(1)}` : null} unit="%" />
              <MetricCard label="Risk Score" value={(data as any).risk_score != null ? `${((data as any).risk_score * 100).toFixed(1)}` : null} unit="%" />
              <MetricCard label="Confidence" value={(data as any).confidence != null ? `${((data as any).confidence * 100).toFixed(1)}` : null} unit="%" />
              <MetricCard label="Method" value={(data as any).method} />
            </div>
          </Section>
        </div>
      );
    case 2:
      return (
        <Section title="Charger Filter Sensors">
          <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-3">
            {[1, 2, 3, 4, 5].map((i) => <MetricCard key={i} label={`PM Temp ${i}`} value={d[`power_module_temp${i}`]} unit="°C" />)}
            <MetricCard label="Charger Temp" value={d.charger_temp} unit="°C" />
            <MetricCard label="Humidity" value={d.humidity} unit="%" />
            <MetricCard label="Voltage" value={d.present_voltage1} unit="V" />
            <MetricCard label="Current" value={d.present_current1} unit="A" />
            <MetricCard label="SOC" value={d.SOC} unit="%" />
          </div>
        </Section>
      );
    case 3: case 5: {
      const statusKeys = Object.keys(d).filter((k) => k.includes("_status") || k.includes("_network"));
      return (
        <Section title={modNum === 3 ? "Device Status" : "Network Device Status"}>
          <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-3">
            {statusKeys.map((k) => (
              <div key={k} className="tw-bg-gray-50 tw-rounded-xl tw-p-3 tw-border tw-border-gray-100 tw-flex tw-items-center tw-justify-between">
                <span className="tw-text-xs tw-text-gray-600 tw-truncate">{k.replace(/_status|_network/g, "").replace(/_/g, " ")}</span>
                <StatusBadge status={String(d[k])} />
              </div>
            ))}
          </div>
        </Section>
      );
    }
    case 4:
      return (
        <Section title="Power Telemetry">
          <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-3">
            <MetricCard label="Voltage 1" value={d.present_voltage1} unit="V" />
            <MetricCard label="Voltage 2" value={d.present_voltage2} unit="V" />
            <MetricCard label="Current 1" value={d.present_current1} unit="A" />
            <MetricCard label="Current 2" value={d.present_current2} unit="A" />
            <MetricCard label="Anomaly Flags" value={(data as any).anomaly_flags}
              color={(data as any).anomaly_flags > 0 ? "#dc2626" : "#059669"} />
            <MetricCard label="SOC" value={d.SOC} unit="%" />
          </div>
        </Section>
      );
    default: return null;
  }
}

// ── Tab content dispatcher ────────────────────────────────────────────────
function TabContent({ tab, modNum, mod, data, countdown, isPaused, onTogglePause }: {
  tab: string;
  modNum: number;
  mod: ModuleConfig;
  data: ModuleResult | null;
  countdown: number;          // ← เพิ่ม
  isPaused: boolean;          // ← เพิ่ม
  onTogglePause: () => void;  // ← เพิ่ม
}) {
  switch (tab) {
    case "history":
      return <HistoryTab modNum={modNum} modKey={mod.key} modColor={mod.color} modLabel={mod.label} />;
    case "algorithms":
      return <AlgorithmTab modNum={modNum} modLabel={mod.label} modColor={mod.color} />;
    case "output":
      return <DetectionOutputTab data={data} modNum={modNum} modColor={mod.color} />;
    case "ai-prediction":
      return <DetectionOutputTab data={data} modNum={modNum} modColor={mod.color} />;

    // M1, M2, M3, M5 — main detail view
    case "filter-health":
      return <M1FilterHealthTab data={data} countdown={countdown} isPaused={isPaused} onTogglePause={onTogglePause} />;
    case "detection":
      if (modNum === 2) return <M2DetectionTab data={data} countdown={countdown} isPaused={isPaused} onTogglePause={onTogglePause} />;
      if (modNum === 3) return <M3DetectionTab data={data} countdown={countdown} isPaused={isPaused} onTogglePause={onTogglePause} />;
      if (modNum === 5) return <M5NetworkTreeTab data={data} countdown={countdown} isPaused={isPaused} onTogglePause={onTogglePause} />;
      return null;

    // M4
    case "live-monitor": return <M4LiveMonitorTab data={data} />;
    case "ai-detection": return <M4AiDetectionTab data={data} countdown={countdown} isPaused={isPaused} onTogglePause={onTogglePause} />;
    case "rule-based": return <M4RuleBasedTab data={data} />;
    case "standards": return <M4StandardsTab />;

    // M6
    case "rul-dashboard": return <M6RulDashboardTab data={data} />;
    case "component": return <M6ComponentDetailTab data={data} />;

    // M7
    case "state-monitor": return <M7StateMonitorTab data={data} />;
    case "timeline": return <M7TimelineTab data={data} />;
    case "failure": return <M7FailurePredictionTab data={data} />;

    default:
      return data ? <DefaultDetailView data={data} modNum={modNum} /> : null;
  }
}

// ── Nav tabs (top navigation) ─────────────────────────────────────────────
function NavTabs({ activeModNum }: { activeModNum: number }) {
  const router = useRouter();
  const mainTabs = [
    { label: "📊 Dashboard", href: "/dashboard/ai" },
    { label: "📡 Station Monitor", href: "/dashboard/ai/monitor" },
    { label: "📈 Health History", href: "/dashboard/ai/history" },
    { label: "🎯 Heatmap", href: "/dashboard/ai/heatmap" },
  ];
  return (
    <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-6">
      <nav className="tw-flex tw-gap-1 tw-overflow-x-auto">
        {mainTabs.map((t) => (
          <button key={t.href} onClick={() => router.push(t.href)}
            className="tw-px-4 tw-py-2.5 tw-text-sm tw-border-b-2 tw-font-medium tw-transition-colors
                       tw-border-transparent tw-text-gray-500 hover:tw-text-gray-700 tw-whitespace-nowrap">
            {t.label}
          </button>
        ))}
        <div className="tw-w-px tw-bg-gray-100 tw-mx-1 tw-my-2" />
        {MODULES.map((m) => (
          <button key={m.key} onClick={() => router.push(`/dashboard/ai/${m.num}`)}
            className={`tw-px-3 tw-py-2.5 tw-text-sm tw-border-b-2 tw-font-medium tw-transition-colors tw-whitespace-nowrap
              ${m.num === activeModNum
                ? "tw-border-blue-500 tw-text-blue-600"
                : "tw-border-transparent tw-text-gray-500 hover:tw-text-gray-700"}`}>
            {m.icon} M{m.num}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Sub-tab bar ───────────────────────────────────────────────────────────
function SubTabs({ tabs, activeTab, modNum, onTabChange }: {
  tabs: TabDef[]; activeTab: string; modNum: number; onTabChange: (key: string) => void;
}) {
  return (
    <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-6 tw-flex tw-gap-1 tw-overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onTabChange(t.key)}
          className={`tw-px-4 tw-py-2.5 tw-text-sm tw-border-b-2 tw-font-medium tw-transition-colors tw-whitespace-nowrap
            ${t.key === activeTab
              ? "tw-border-purple-500 tw-text-purple-600"
              : "tw-border-transparent tw-text-gray-500 hover:tw-text-gray-700"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Missing tab components (inline simple ones) ───────────────────────────
// These are referenced in imports but defined in separate files.
// If files don't exist yet, they'll be created below.

// ── Main Page ─────────────────────────────────────────────────────────────
export default function ModulePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const modNum = parseInt(String(params?.moduleId ?? "1"), 10);
  const mod = MODULES.find((m) => m.num === modNum);
  const tabs = MODULE_TABS[modNum] ?? [];

  const defaultTab = tabs[0]?.key ?? "";
  const [activeTab, setActiveTab] = useState(searchParams?.get("tab") ?? defaultTab);

  const [data, setData] = useState<ModuleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");

  const { tick, countdown, isPaused, pause, resume, refresh } = useAutoRefresh(120);
  const { activeSn, activeName, stations, switchStation } = useStation();
  const [stationOpen, setStationOpen] = useState(false);
  const [stationSearch, setStationSearch] = useState("");

  const filteredStations = (Array.isArray(stations) ? stations : [])
    .filter((s) =>
      s.sn.toLowerCase().includes(stationSearch.toLowerCase()) ||
      s.name.toLowerCase().includes(stationSearch.toLowerCase())
    );

  // Reset tab when module changes
  useEffect(() => {
    setActiveTab(searchParams?.get("tab") ?? tabs[0]?.key ?? "");
  }, [modNum]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    router.push(`/dashboard/ai/${modNum}?tab=${key}`, { scroll: false });
  };

  const loadData = useCallback(async () => {
    if (!mod) return;
    setLoading(true);
    setError(null);
    try {
      const res = await aiApi.moduleLatest(mod.num);
      setData(res);
      setLastUpdate(new Date().toLocaleTimeString("th-TH"));
    } catch {
      setError(`ไม่สามารถโหลดข้อมูล Module ${mod.num} ได้`);
    } finally {
      setLoading(false);
    }
  }, [mod?.num]);

  useEffect(() => { loadData(); }, [tick, loadData]);

  if (!mod) { router.push("/dashboard/ai"); return null; }

  const health = data?.health ?? null;

  return (
    <div className="ai-root tw-min-h-screen" style={{ background: "var(--ai-bg)" }}>

      {/* Top bar */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid var(--ai-bdr)",
        padding: "0 24px", height: 56,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        {/* ← กลับ */}
        <button
          onClick={() => router.push("/dashboard/ai")}
          style={{ fontSize: ".8em", color: "var(--ai-dim)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
        >
          ← กลับ
        </button>

        <div style={{ width: 1, height: 20, background: "var(--ai-bdr)", flexShrink: 0 }} />

        {/* Module badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `${mod.color}18`, fontSize: "1em",
          }}>
            {mod.icon}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: ".82em", color: "var(--ai-tx)" }}>
              Module {mod.num} — {mod.label}
            </div>
            <div style={{ fontSize: ".6em", color: "var(--ai-dim)" }}>{mod.labelTh}</div>
          </div>
        </div>

        <div style={{ width: 1, height: 20, background: "var(--ai-bdr)", flexShrink: 0 }} />

        {/* Station selector */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setStationOpen((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 10px", borderRadius: 8,
              background: "var(--ai-bg)",
              border: "1px solid var(--ai-bdr2)",
              cursor: "pointer", fontSize: ".78em",
            }}
          >
            <span>⚡</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 700 }}>{activeSn || "เลือกสถานี"}</div>
              {activeName && (
                <div style={{ fontSize: ".75em", color: "var(--ai-dim)" }}>{activeName}</div>
              )}
            </div>
            <span style={{ fontSize: ".65em", color: "var(--ai-dim)" }}>▼</span>
          </button>

          {stationOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0,
              width: 260, background: "#fff",
              border: "1px solid var(--ai-bdr2)",
              borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,.12)",
              zIndex: 50, overflow: "hidden",
            }}>
              <div style={{ padding: 8, borderBottom: "1px solid var(--ai-bdr)" }}>
                <input
                  style={{
                    width: "100%", padding: "6px 10px", borderRadius: 7,
                    border: "1px solid var(--ai-bdr2)",
                    background: "var(--ai-bg)",
                    fontSize: ".78em", outline: "none",
                    boxSizing: "border-box",
                  }}
                  placeholder="🔍 ค้นหาสถานี..."
                  value={stationSearch}
                  onChange={(e) => setStationSearch(e.target.value)}
                />
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {filteredStations.length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", fontSize: ".72em", color: "var(--ai-dim)" }}>
                    ไม่พบสถานี
                  </div>
                ) : (
                  filteredStations.map((s) => (
                    <button
                      key={s.sn}
                      onClick={() => {
                        switchStation(s.sn);
                        setStationOpen(false);
                        setStationSearch("");
                        loadData();
                      }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 12px", textAlign: "left", cursor: "pointer",
                        background: activeSn === s.sn ? "rgba(14,165,233,.08)" : "transparent",
                        border: "none", borderBottom: "1px solid var(--ai-bg)",
                        color: activeSn === s.sn ? "#0ea5e9" : "var(--ai-tx)",
                        fontSize: ".78em",
                      }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: activeSn === s.sn ? "#0ea5e9" : "var(--ai-mut)",
                        flexShrink: 0,
                      }} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: ".8em", color: "var(--ai-dim)", fontFamily: "var(--ai-font-mono)" }}>
                          {s.sn}
                        </div>
                      </div>
                      {activeSn === s.sn && (
                        <span style={{ marginLeft: "auto", fontSize: ".7em", color: "#0ea5e9" }}>✓</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: refresh */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {lastUpdate && (
            <span style={{ fontSize: ".65em", color: "var(--ai-dim)" }}>อัปเดต {lastUpdate}</span>
          )}
          <button
            onClick={refresh}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "5px 12px", borderRadius: 8, fontSize: ".75em", fontWeight: 600,
              border: "1px solid var(--ai-bdr2)", background: "#fff", cursor: "pointer",
              color: "var(--ai-tx)",
            }}
          >
            ↻ <span style={{ color: "var(--ai-dim)", fontFamily: "var(--ai-font-mono)" }}>{countdown}s</span>
          </button>
        </div>
      </div>

      <NavTabs activeModNum={modNum} />

      {/* Module summary header */}
      <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-6 tw-py-4">
        <div className="tw-flex tw-items-center tw-gap-6 tw-flex-wrap">
          <HealthGauge value={health} />
          <div className="tw-flex-1 tw-min-w-0">
            <div className="tw-flex tw-items-center tw-gap-3 tw-mb-2">
              <span className={`tw-px-2.5 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-semibold
                ${health == null ? "tw-bg-gray-100 tw-text-gray-500"
                  : health >= 75 ? "tw-bg-green-100 tw-text-green-700"
                    : health >= 50 ? "tw-bg-amber-100 tw-text-amber-700"
                      : "tw-bg-red-100 tw-text-red-700"}`}>
                {health == null ? "N/A" : health >= 75 ? "NORMAL" : health >= 50 ? "WARNING" : "CRITICAL"}
              </span>
              {data?._result_ts && (
                <span className="tw-text-xs tw-text-gray-400">
                  {new Date(data._result_ts).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                </span>
              )}
            </div>
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
              <div className="tw-text-xs tw-text-gray-400 tw-w-14">Weight</div>
              <div className="tw-w-24 tw-h-1.5 tw-bg-gray-100 tw-rounded-full tw-overflow-hidden">
                <div className="tw-h-full tw-rounded-full"
                  style={{ width: `${mod.weight * 100}%`, background: mod.color }} />
              </div>
              <div className="tw-text-xs tw-font-medium tw-text-gray-600">{(mod.weight * 100).toFixed(0)}%</div>
            </div>
            <div className="tw-flex tw-flex-wrap tw-gap-1.5">
              {mod.aiModels.length > 0
                ? mod.aiModels.map((m) => (
                  <span key={m} className="tw-px-2 tw-py-0.5 tw-bg-gray-100 tw-text-gray-600 tw-rounded-md tw-text-xs">
                    {m}
                  </span>
                ))
                : <span className="tw-text-xs tw-text-gray-400">Rule-based</span>
              }
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="tw-mx-6 tw-mt-4 tw-p-4 tw-bg-red-50 tw-border tw-border-red-200
                        tw-rounded-xl tw-text-red-700 tw-text-sm">⚠ {error}</div>
      )}

      {/* Sub-tab navigation */}
      <SubTabs tabs={tabs} activeTab={activeTab} modNum={modNum} onTabChange={handleTabChange} />

      {/* Tab content */}
      <div className="tw-p-6">
        {loading && activeTab !== "history" && activeTab !== "algorithms" ? (
          <div className="tw-flex tw-items-center tw-justify-center tw-h-40 tw-gap-3">
            <div className="tw-w-6 tw-h-6 tw-rounded-full tw-border-2 tw-border-gray-200
                            tw-border-t-blue-500 tw-animate-spin" />
            <span className="tw-text-sm tw-text-gray-400">กำลังโหลด...</span>
          </div>
        ) : (
          <TabContent
            tab={activeTab} modNum={modNum} mod={mod} data={data}
            countdown={countdown}
            isPaused={isPaused}
            onTogglePause={() => isPaused ? resume() : pause()}
          />
        )}
      </div>
    </div>
  );
}
