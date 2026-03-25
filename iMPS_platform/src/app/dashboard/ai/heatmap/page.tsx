"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { aiApi } from "../lib/api";
import { MODULES } from "../lib/constants";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import "../ai-theme.css";
import { useStation } from "../hooks/useStation";

function hmColor(value: number | null): string {
  if (value == null) return "#e5e7eb";
  const h = Math.max(0, Math.min(100, value));
  let r: number, g: number, b: number;
  if (h <= 50) { const t = h / 50; r = Math.round(220 - (220 - 234) * t); g = Math.round(38 + (179 - 38) * t); b = Math.round(38 + (8 - 38) * t); }
  else { const t = (h - 50) / 50; r = Math.round(234 - (234 - 22) * t); g = Math.round(179 + (163 - 179) * t); b = Math.round(8 + (74 - 8) * t); }
  return `rgb(${r},${g},${b})`;
}
function textColor(value: number | null): string { if (value == null) return "#94a3b8"; return value >= 50 ? "#fff" : "#1e293b"; }

interface HeatmapStation { sn: string; name: string; province?: string; system_health: number | null; modules: Record<string, number | null>; }
interface TooltipState { x: number; y: number; station: HeatmapStation; }

function HeatmapTooltip({ tip }: { tip: TooltipState }) {
  return (
    <div className="tw-fixed tw-z-50 tw-pointer-events-none tw-rounded-2xl tw-shadow-2xl tw-min-w-[220px]"
      style={{ top: tip.y + 14, left: tip.x + 14, background: "#111827", border: "1px solid rgba(255,255,255,.1)" }}>
      <div className="tw-px-4 tw-py-3 tw-border-b tw-border-white/10">
        <div className="tw-font-bold tw-text-white tw-text-sm">{tip.station.name}</div>
        <div className="tw-text-xs tw-text-white/40 tw-font-mono tw-mt-0.5">{tip.station.sn}{tip.station.province ? ` · ${tip.station.province}` : ""}</div>
      </div>
      <div className="tw-px-4 tw-py-3">
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
          <span className="tw-text-xs tw-text-white/40 tw-w-12">System</span>
          <div className="tw-flex-1 tw-h-1.5 tw-bg-white/10 tw-rounded-full tw-overflow-hidden"><div className="tw-h-full tw-rounded-full tw-transition-all" style={{ width: `${tip.station.system_health ?? 0}%`, background: hmColor(tip.station.system_health) }} /></div>
          <span className="tw-text-xs tw-font-bold tw-text-white tw-w-8 tw-text-right tw-font-mono">{tip.station.system_health ?? "—"}%</span>
        </div>
        <div className="tw-text-[10px] tw-text-white/30 tw-uppercase tw-tracking-wider tw-mb-2">Module Health</div>
        <div className="tw-grid tw-grid-cols-7 tw-gap-1">
          {MODULES.map((mod) => { const v = tip.station.modules?.[mod.key] ?? null; return (<div key={mod.key} className="tw-flex tw-flex-col tw-items-center tw-gap-1"><div className="tw-w-7 tw-h-7 tw-rounded-lg tw-flex tw-items-center tw-justify-center tw-text-xs tw-font-bold" style={{ background: hmColor(v), color: textColor(v) }}>{v ?? "—"}</div><div className="tw-text-white/30" style={{ fontSize: 9 }}>M{mod.num}</div></div>); })}
        </div>
      </div>
    </div>
  );
}

function KpiSummaryCards({ stats, total }: { stats: { avg: number; min: number; max: number; crit: number; warn: number; ok: number } | null; total: number; }) {
  const cards = [
    { label: "Total Stations", value: total, valueStyle: { color: "#fff" }, iconBg: "rgba(255,255,255,.10)", iconRing: "rgba(255,255,255,.15)", icon: <span className="tw-text-base">📍</span> },
    { label: "Avg Health", value: stats ? `${stats.avg}%` : "—", valueStyle: { color: "#60a5fa" }, iconBg: "rgba(59,130,246,.15)", iconRing: "rgba(96,165,250,.25)", icon: <span className="tw-text-base">📊</span> },
    { label: "Normal ≥75%", value: stats?.ok ?? "—", valueStyle: { color: "#34d399" }, iconBg: "rgba(16,185,129,.15)", iconRing: "rgba(52,211,153,.25)", icon: (<span className="tw-relative tw-flex tw-h-2.5 tw-w-2.5"><span className="tw-animate-ping tw-absolute tw-inline-flex tw-h-full tw-w-full tw-rounded-full tw-opacity-75" style={{ background: "#34d399" }} /><span className="tw-relative tw-inline-flex tw-rounded-full tw-h-2.5 tw-w-2.5" style={{ background: "#34d399" }} /></span>) },
    { label: "Warning <75%", value: stats?.warn ?? "—", valueStyle: { color: "#fbbf24" }, iconBg: "rgba(234,179,8,.15)", iconRing: "rgba(251,191,36,.25)", icon: <span className="tw-text-base">⚠️</span> },
    { label: "Critical <40%", value: stats?.crit ?? "—", valueStyle: { color: "#f87171" }, iconBg: "rgba(239,68,68,.15)", iconRing: "rgba(248,113,113,.25)", icon: <span className="tw-h-2.5 tw-w-2.5 tw-rounded-full tw-inline-block" style={{ background: "#f87171" }} /> },
  ];
  return (
    <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 lg:tw-grid-cols-5 tw-gap-2.5 tw-mb-4 tw-flex-shrink-0">
      {cards.map((card) => (
        <div key={card.label} className="tw-group tw-relative tw-overflow-hidden tw-rounded-2xl tw-bg-gradient-to-br tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-5 tw-py-4 tw-ring-1 tw-ring-white/10 tw-shadow-lg hover:tw-shadow-xl tw-transition-all tw-duration-300 hover:tw--translate-y-0.5">
          <div className="tw-absolute tw-inset-0 tw-opacity-[0.03] tw-pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
          <div className="tw-relative tw-z-10">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2"><div className="tw-h-8 tw-w-8 tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-ring-1 tw-flex-shrink-0" style={{ background: card.iconBg, boxShadow: `0 0 0 1px ${card.iconRing}` }}>{card.icon}</div><span className="tw-text-[11px] tw-font-semibold tw-text-white/40 tw-uppercase tw-tracking-wider">{card.label}</span></div>
            <div className="tw-text-3xl tw-font-black tw-tabular-nums tw-tracking-tight tw-leading-none" style={card.valueStyle}>{card.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HeatmapPage() {
  const [stations, setStations] = useState<HeatmapStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [search, setSearch] = useState("");
  const { activeSn } = useStation();
  const { tick, countdown, refresh } = useAutoRefresh(120);
  const gridRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await aiApi.monitorOverview();
      const raw = Array.isArray((res as any).stations) ? (res as any).stations : Array.isArray(res) ? res : [];
      const mapped: HeatmapStation[] = raw.map((s: any) => {
        const mods: Record<string, number | null> = {};
        MODULES.forEach((mod) => { const v = s.modules?.[mod.key]; mods[mod.key] = typeof v === "number" ? v : (v as any)?.health ?? null; });
        const sh = typeof s.system_health === "number" ? s.system_health : (s.system_health as any)?.health ?? null;
        return { sn: s.sn, name: s.name, province: s.province, system_health: sh, modules: mods };
      });
      setStations(mapped); setLastUpdate(new Date().toLocaleTimeString("th-TH"));
    } catch { setError("ไม่สามารถโหลดข้อมูล Heatmap ได้"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [tick, loadData]);

  const filtered = useMemo(() => search ? stations.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.sn.toLowerCase().includes(search.toLowerCase())) : stations, [stations, search]);

  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const onResize = () => setWindowWidth(window.innerWidth); window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize); }, []);

  const cols = useMemo(() => {
    const n = filtered.length;
    if (windowWidth < 480) return Math.min(n, 2);
    if (windowWidth < 768) return Math.min(n, 3);
    if (windowWidth < 1024) return Math.min(n, 5);
    if (n <= 10) return 5; if (n <= 30) return 6; if (n <= 60) return 8; if (n <= 120) return 10; return 13;
  }, [filtered.length, windowWidth]);

  const stats = useMemo(() => {
    const vals = stations.map((s) => s.system_health).filter((v): v is number => v != null);
    if (!vals.length) return null;
    return { avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), min: Math.min(...vals), max: Math.max(...vals), crit: vals.filter((v) => v < 40).length, warn: vals.filter((v) => v >= 40 && v < 75).length, ok: vals.filter((v) => v >= 75).length };
  }, [stations]);

  const handleMouseEnter = (e: React.MouseEvent, station: HeatmapStation) => setTooltip({ x: e.clientX, y: e.clientY, station });
  const handleMouseMove = (e: React.MouseEvent) => tooltip && setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null);
  const handleMouseLeave = () => setTooltip(null);

  return (
    <div className="ai-root tw-min-h-screen tw-flex tw-flex-col">
      {/* ── Toolbar: search + refresh ── */}
      <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-4 sm:tw-px-6 tw-py-2.5 tw-flex tw-items-center tw-justify-between tw-gap-3 tw-flex-shrink-0">
        <div className="tw-flex tw-items-center tw-gap-3">
          <input className="tw-px-3 tw-py-1.5 tw-text-xs tw-border tw-border-gray-200 tw-rounded-lg tw-outline-none focus:tw-border-gray-900 tw-bg-white tw-w-44 sm:tw-w-56"
            placeholder="🔍 ค้นหาสถานี..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {/* Gradient legend */}
          <div className="tw-hidden sm:tw-flex tw-items-center tw-gap-2">
            <span className="tw-text-xs tw-text-gray-400">0%</span>
            <div className="tw-w-24 tw-h-2 tw-rounded-full" style={{ background: "linear-gradient(90deg, #dc2626, #f59e0b, #eab308, #84cc16, #16a34a)" }} />
            <span className="tw-text-xs tw-text-gray-400">100%</span>
          </div>
        </div>
        <div className="tw-flex tw-items-center tw-gap-2">
          <button onClick={refresh} className="tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-text-xs tw-font-bold tw-bg-gray-900 hover:tw-bg-black tw-text-white tw-rounded-lg tw-transition-colors" style={{ fontFamily: "'JetBrains Mono', monospace" }}>↻ {countdown}s</button>
          {lastUpdate && <span className="tw-text-xs tw-text-gray-400 tw-hidden sm:tw-inline">อัปเดต {lastUpdate}</span>}
        </div>
      </div>

      <div className="tw-flex-1 tw-p-4 sm:tw-p-6 tw-overflow-auto">
        {error && <div className="tw-mb-4 tw-p-4 tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-xl tw-text-red-700 tw-text-sm">⚠ {error}</div>}

        <KpiSummaryCards stats={stats} total={filtered.length} />

        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-overflow-hidden">
          <div className="tw-px-4 sm:tw-px-6 tw-py-4 tw-bg-gradient-to-r tw-from-white tw-to-blue-gray-50/30 tw-border-b tw-border-gray-100">
            <div className="tw-text-sm tw-font-bold tw-text-gray-800 tw-uppercase tw-tracking-wide">Station Health Grid</div>
            <div className="tw-text-xs tw-text-gray-400 tw-mt-0.5">{filtered.length} สถานี · {cols} คอลัมน์</div>
          </div>
          <div className="tw-p-3 sm:tw-p-4">
            {loading ? (
              <div className="tw-flex tw-items-center tw-justify-center tw-h-64 tw-gap-3"><div className="tw-w-6 tw-h-6 tw-rounded-full tw-border-2 tw-border-gray-200 tw-border-t-gray-900 tw-animate-spin" /><span className="tw-text-sm tw-text-gray-400">กำลังโหลด...</span></div>
            ) : filtered.length === 0 ? (
              <div className="tw-flex tw-items-center tw-justify-center tw-h-64 tw-text-gray-400 tw-text-sm">{search ? `ไม่พบสถานีที่ค้นหา "${search}"` : "ไม่มีข้อมูล"}</div>
            ) : (
              <div ref={gridRef} className="tw-grid tw-gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} onMouseMove={handleMouseMove}>
                {filtered.map((station) => {
                  const health = station.system_health; const bg = hmColor(health); const tc = textColor(health);
                  return (
                    <div key={station.sn} className="tw-rounded-xl tw-p-2.5 tw-cursor-pointer tw-transition-all tw-duration-200 hover:tw-scale-105 hover:tw-z-10 hover:tw-shadow-lg tw-relative tw-select-none" style={{ background: bg }}
                      onMouseEnter={(e) => handleMouseEnter(e, station)} onMouseLeave={handleMouseLeave}>
                      <div className="tw-text-xs tw-font-semibold tw-leading-tight tw-truncate" style={{ color: tc }}>{station.name}</div>
                      <div className="tw-text-base tw-font-black tw-mt-0.5 tw-leading-none tw-font-mono" style={{ color: tc }}>{health != null ? `${health}%` : "—"}</div>
                      <div className="tw-flex tw-gap-0.5 tw-mt-1.5 tw-flex-wrap">
                        {MODULES.map((mod) => { const mv = station.modules?.[mod.key] ?? null; return (<div key={mod.key} className="tw-w-1.5 tw-h-1.5 tw-rounded-full" style={{ background: mv != null ? hmColor(mv) : "rgba(255,255,255,.3)", opacity: mv != null ? 1 : .5 }} title={`M${mod.num}: ${mv ?? "N/A"}`} />); })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {tooltip && <HeatmapTooltip tip={tooltip} />}
    </div>
  );
}