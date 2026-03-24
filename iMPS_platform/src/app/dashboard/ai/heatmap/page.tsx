"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { aiApi } from "../lib/api";
import { MODULES } from "../lib/constants";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import "../ai-theme.css";
import { useStation } from "../hooks/useStation";

// ── Nav Tabs ──────────────────────────────────────────────────────────────
function NavTabs() {
  const router = useRouter();
  const tabs = [
    { label: "📊 Dashboard", href: "/dashboard/ai" },
    { label: "📡 Station Monitor", href: "/dashboard/ai/monitor" },
    { label: "📈 Health History", href: "/dashboard/ai/history" },
    { label: "🎯 Heatmap", href: "/dashboard/ai/heatmap" },
  ];
  return (
    <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-6">
      <nav className="tw-flex tw-gap-1">
        {tabs.map((t) => (
          <button key={t.href} onClick={() => router.push(t.href)}
            className={`tw-px-4 tw-py-2.5 tw-text-sm tw-border-b-2 tw-font-medium tw-transition-colors
              ${t.href === "/dashboard/ai/heatmap"
                ? "tw-border-blue-500 tw-text-blue-600"
                : "tw-border-transparent tw-text-gray-500 hover:tw-text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Health → RGB gradient (red→amber→yellow→lime→green) ──────────────────
function hmColor(value: number | null): string {
  if (value == null) return "var(--color-border-tertiary, #d0dae8)";
  const h = Math.max(0, Math.min(100, value));
  let r: number, g: number, b: number;
  if (h <= 50) {
    const t = h / 50;
    r = Math.round(220 - (220 - 234) * t);  // 220→234
    g = Math.round(38 + (179 - 38) * t);  // 38→179
    b = Math.round(38 + (8 - 38) * t);  // 38→8
  } else {
    const t = (h - 50) / 50;
    r = Math.round(234 - (234 - 22) * t);  // 234→22
    g = Math.round(179 + (163 - 179) * t);  // 179→163
    b = Math.round(8 + (74 - 8) * t);  // 8→74
  }
  return `rgb(${r},${g},${b})`;
}

// text color on colored bg
function textColor(value: number | null): string {
  if (value == null) return "#94a3b8";
  return value >= 50 ? "#fff" : "#1e293b";
}

// ── Types ─────────────────────────────────────────────────────────────────
interface HeatmapStation {
  sn: string;
  name: string;
  province?: string;
  system_health: number | null;
  modules: Record<string, number | null>;
}

// ── Tooltip ───────────────────────────────────────────────────────────────
interface TooltipState {
  x: number; y: number;
  station: HeatmapStation;
}

function HeatmapTooltip({ tip }: { tip: TooltipState }) {
  return (
    <div
      className="tw-fixed tw-z-50 tw-pointer-events-none tw-bg-white tw-border tw-border-gray-200
                 tw-rounded-xl tw-shadow-xl tw-p-3 tw-min-w-[200px]"
      style={{ top: tip.y + 12, left: tip.x + 12 }}
    >
      <div className="tw-font-semibold tw-text-gray-800 tw-text-sm tw-mb-0.5">{tip.station.name}</div>
      <div className="tw-text-xs tw-text-gray-400 tw-mb-2">
        {tip.station.sn}{tip.station.province ? ` · ${tip.station.province}` : ""}
      </div>
      {/* System health bar */}
      <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
        <div className="tw-text-xs tw-text-gray-500">System</div>
        <div className="tw-flex-1 tw-h-2 tw-bg-gray-100 tw-rounded-full tw-overflow-hidden">
          <div className="tw-h-full tw-rounded-full tw-transition-all"
            style={{
              width: `${tip.station.system_health ?? 0}%`,
              background: hmColor(tip.station.system_health),
            }}
          />
        </div>
        <div className="tw-text-xs tw-font-semibold tw-text-gray-700 tw-w-8 tw-text-right">
          {tip.station.system_health ?? "—"}%
        </div>
      </div>
      {/* Module breakdown */}
      <div className="tw-text-xs tw-text-gray-400 tw-mb-1 tw-font-medium">MODULE HEALTH</div>
      <div className="tw-grid tw-grid-cols-7 tw-gap-1">
        {MODULES.map((mod) => {
          const v = tip.station.modules?.[mod.key] ?? null;
          return (
            <div key={mod.key} className="tw-flex tw-flex-col tw-items-center tw-gap-0.5">
              <div
                className="tw-w-7 tw-h-7 tw-rounded-md tw-flex tw-items-center tw-justify-center
                           tw-text-xs tw-font-bold"
                style={{ background: hmColor(v), color: textColor(v) }}
              >
                {v ?? "—"}
              </div>
              <div className="tw-text-gray-400" style={{ fontSize: 9 }}>M{mod.num}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function HeatmapPage() {
  const [stations, setStations] = useState<HeatmapStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [search, setSearch] = useState("");
  const { activeSn, activeName } = useStation();
  const { tick, countdown, refresh } = useAutoRefresh(120);
  const gridRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await aiApi.monitorOverview();
      // normalize station rows → HeatmapStation[]
      const raw = Array.isArray((res as any).stations)
        ? (res as any).stations
        : Array.isArray(res) ? res : [];

      const mapped: HeatmapStation[] = raw.map((s: any) => {
        // modules อาจเป็น { m1: number } หรือ { m1: { health: number } }
        const mods: Record<string, number | null> = {};
        MODULES.forEach((mod) => {
          const v = s.modules?.[mod.key];
          mods[mod.key] = typeof v === "number" ? v : (v as any)?.health ?? null;
        });
        const sh = typeof s.system_health === "number"
          ? s.system_health
          : (s.system_health as any)?.health ?? null;
        return { sn: s.sn, name: s.name, province: s.province, system_health: sh, modules: mods };
      });

      setStations(mapped);
      setLastUpdate(new Date().toLocaleTimeString("th-TH"));
    } catch {
      setError("ไม่สามารถโหลดข้อมูล Heatmap ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [tick, loadData]);

  // filtered
  const filtered = useMemo(() =>
    search
      ? stations.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.sn.toLowerCase().includes(search.toLowerCase()))
      : stations,
    [stations, search]);

  // auto grid columns based on count
  const cols = useMemo(() => {
    const n = filtered.length;
    if (n <= 10) return 5;
    if (n <= 30) return 6;
    if (n <= 60) return 8;
    if (n <= 120) return 10;
    return 13;
  }, [filtered.length]);

  const handleMouseEnter = (e: React.MouseEvent, station: HeatmapStation) => {
    setTooltip({ x: e.clientX, y: e.clientY, station });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (tooltip) setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null);
  };
  const handleMouseLeave = () => setTooltip(null);

  // stats
  const stats = useMemo(() => {
    const vals = stations.map((s) => s.system_health).filter((v): v is number => v != null);
    if (!vals.length) return null;
    return {
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      min: Math.min(...vals),
      max: Math.max(...vals),
      crit: vals.filter((v) => v < 40).length,
      warn: vals.filter((v) => v >= 40 && v < 75).length,
      ok: vals.filter((v) => v >= 75).length,
    };
  }, [stations]);

  return (
    <div className="ai-root tw-min-h-screen tw-flex tw-flex-col" style={{ background: "var(--ai-bg)" }}>

      {/* Top bar */}
      <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-6 tw-py-3
                      tw-flex tw-items-center tw-justify-between tw-gap-4 tw-flex-wrap tw-flex-shrink-0">
        <div className="tw-flex tw-items-center tw-gap-4">
          <span className="tw-font-semibold tw-text-gray-800">🎯 Health Heatmap</span>
          <div className="tw-w-px tw-h-4 tw-bg-gray-200" />
          <div style={{ fontSize: ".78em", display: "flex", alignItems: "center", gap: 6 }}>
            <span>⚡</span>
            <span style={{ fontWeight: 700 }}>{activeSn || "—"}</span>
            {activeName && <span style={{ color: "var(--ai-dim)" }}>{activeName}</span>}
          </div>
          {stats && (
            <div className="tw-flex tw-items-center tw-gap-3 tw-text-xs">
              <span className="tw-text-gray-400">{filtered.length} สถานี</span>
              <span className="tw-px-2 tw-py-0.5 tw-bg-green-100 tw-text-green-700 tw-rounded-full tw-font-medium">
                ✓ {stats.ok}
              </span>
              <span className="tw-px-2 tw-py-0.5 tw-bg-amber-100 tw-text-amber-700 tw-rounded-full tw-font-medium">
                ⚠ {stats.warn}
              </span>
              <span className="tw-px-2 tw-py-0.5 tw-bg-red-100 tw-text-red-700 tw-rounded-full tw-font-medium">
                ✕ {stats.crit}
              </span>
              <span className="tw-text-gray-400">avg {stats.avg}%</span>
            </div>
          )}
        </div>
        <div className="tw-flex tw-items-center tw-gap-3">
          <input
            className="tw-px-3 tw-py-1.5 tw-text-xs tw-border tw-border-gray-200 tw-rounded-lg
                       tw-outline-none focus:tw-border-blue-400 tw-bg-white tw-w-44"
            placeholder="🔍 ค้นหาสถานี..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={refresh}
            className="tw-flex tw-items-center tw-gap-1 tw-px-3 tw-py-1.5 tw-text-xs
                       tw-font-medium tw-border tw-border-gray-200 tw-rounded-lg hover:tw-bg-gray-50">
            ↻ <span className="tw-text-gray-400">{countdown}s</span>
          </button>
          {lastUpdate && <span className="tw-text-xs tw-text-gray-400">อัปเดต {lastUpdate}</span>}
        </div>
      </div>

      <NavTabs />

      {/* Gradient legend */}
      <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-6 tw-py-2
                      tw-flex tw-items-center tw-gap-4 tw-flex-shrink-0">
        <span className="tw-text-xs tw-text-gray-400">Health Score:</span>
        <div className="tw-flex tw-items-center tw-gap-1">
          <div className="tw-w-32 tw-h-3 tw-rounded-full" style={{
            background: "linear-gradient(90deg, #dc2626, #f59e0b, #eab308, #84cc16, #16a34a)"
          }} />
        </div>
        <div className="tw-flex tw-items-center tw-gap-0.5 tw-text-xs tw-text-gray-400">
          <span>0%</span>
          <span className="tw-mx-1">→</span>
          <span>100%</span>
        </div>
        <div className="tw-flex tw-items-center tw-gap-1.5">
          <div className="tw-w-3 tw-h-3 tw-rounded tw-bg-gray-200" />
          <span className="tw-text-xs tw-text-gray-400">N/A</span>
        </div>
        <span className="tw-text-xs tw-text-gray-300 tw-ml-2">Hover เพื่อดูรายละเอียด</span>
      </div>

      {/* Content */}
      <div className="tw-flex-1 tw-p-4 tw-overflow-auto">
        {error && (
          <div className="tw-mb-4 tw-p-4 tw-bg-red-50 tw-border tw-border-red-200
                          tw-rounded-xl tw-text-red-700 tw-text-sm">⚠ {error}</div>
        )}

        {loading ? (
          <div className="tw-flex tw-items-center tw-justify-center tw-h-64 tw-gap-3">
            <div className="tw-w-6 tw-h-6 tw-rounded-full tw-border-2 tw-border-gray-200
                            tw-border-t-blue-500 tw-animate-spin" />
            <span className="tw-text-sm tw-text-gray-400">กำลังโหลด {stations.length > 0 ? `${stations.length} สถานี` : ""}...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="tw-flex tw-items-center tw-justify-center tw-h-64 tw-text-gray-400 tw-text-sm">
            {search ? `ไม่พบสถานีที่ค้นหา "${search}"` : "ไม่มีข้อมูล"}
          </div>
        ) : (
          <div
            ref={gridRef}
            className="tw-grid tw-gap-1.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            onMouseMove={handleMouseMove}
          >
            {filtered.map((station) => {
              const health = station.system_health;
              const bg = hmColor(health);
              const tc = textColor(health);
              return (
                <div
                  key={station.sn}
                  className="tw-rounded-lg tw-p-2 tw-cursor-pointer tw-transition-transform
                             hover:tw-scale-105 hover:tw-z-10 tw-relative tw-select-none"
                  style={{ background: bg }}
                  onMouseEnter={(e) => handleMouseEnter(e, station)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div
                    className="tw-text-xs tw-font-semibold tw-leading-tight tw-truncate"
                    style={{ color: tc }}
                  >
                    {station.name}
                  </div>
                  <div
                    className="tw-text-base tw-font-bold tw-mt-0.5 tw-leading-none"
                    style={{ color: tc }}
                  >
                    {health != null ? `${health}%` : "—"}
                  </div>
                  {/* Mini module dots */}
                  <div className="tw-flex tw-gap-0.5 tw-mt-1 tw-flex-wrap">
                    {MODULES.map((mod) => {
                      const mv = station.modules?.[mod.key] ?? null;
                      return (
                        <div
                          key={mod.key}
                          className="tw-w-1.5 tw-h-1.5 tw-rounded-full"
                          style={{
                            background: mv != null
                              ? hmColor(mv)
                              : "rgba(255,255,255,0.3)",
                            opacity: mv != null ? 1 : 0.5,
                          }}
                          title={`M${mod.num}: ${mv ?? "N/A"}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tooltip portal */}
      {tooltip && <HeatmapTooltip tip={tooltip} />}
    </div>
  );
}