"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { aiApi, HealthDataPoint } from "../lib/api";
import { MODULES, getHealthColor } from "../lib/constants";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import {
    AreaChart, Area,
    LineChart, Line,
    XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import "../ai-theme.css";
import { useStation } from "../hooks/useStation";

// ── Nav Tabs (shared pattern) ─────────────────────────────────────────────
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
                    <button
                        key={t.href}
                        onClick={() => router.push(t.href)}
                        className={`tw-px-4 tw-py-2.5 tw-text-sm tw-border-b-2 tw-font-medium tw-transition-colors
              ${t.href === "/dashboard/ai/history"
                                ? "tw-border-blue-500 tw-text-blue-600"
                                : "tw-border-transparent tw-text-gray-500 hover:tw-text-gray-700"}`}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}

// ── CBM Threshold zones ───────────────────────────────────────────────────
const CBM_ZONES = [
    { y: 80, label: "Good ≥80%", color: "#059669" },
    { y: 60, label: "Monitor 60%", color: "#d97706" },
    { y: 40, label: "Inspect 40%", color: "#ea580c" },
];

// ── Custom Tooltip ────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="tw-bg-white tw-border tw-border-gray-200 tw-rounded-xl tw-shadow-lg tw-p-3 tw-text-xs tw-min-w-[160px]">
            <div className="tw-font-semibold tw-text-gray-700 tw-mb-2">{label}</div>
            {payload.map((p: any) => (
                <div key={p.dataKey} className="tw-flex tw-items-center tw-gap-2 tw-py-0.5">
                    <span className="tw-w-2 tw-h-2 tw-rounded-full tw-flex-shrink-0" style={{ background: p.color }} />
                    <span className="tw-text-gray-500">{p.name}:</span>
                    <span className="tw-font-medium tw-text-gray-800">{p.value?.toFixed(1)}%</span>
                </div>
            ))}
        </div>
    );
}

// ── Range button ──────────────────────────────────────────────────────────
function RangeBtn({
    label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`tw-px-4 tw-py-1.5 tw-text-sm tw-rounded-lg tw-font-medium tw-transition-colors
        ${active
                    ? "tw-bg-blue-500 tw-text-white"
                    : "tw-bg-gray-100 tw-text-gray-600 hover:tw-bg-gray-200"}`}
        >
            {label}
        </button>
    );
}

// ── Module toggle pill ────────────────────────────────────────────────────
function ModulePill({
    mod, active, latest, onClick,
}: {
    mod: typeof MODULES[0];
    active: boolean;
    latest: number | null;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-full tw-text-xs
                  tw-font-medium tw-border tw-transition-all
        ${active
                    ? "tw-text-white tw-border-transparent"
                    : "tw-bg-white tw-text-gray-500 tw-border-gray-200 hover:tw-border-gray-300"}`}
            style={active ? { background: mod.color, borderColor: mod.color } : {}}
        >
            <span>{mod.icon}</span>
            <span>M{mod.num}</span>
            {latest != null && (
                <span className={active ? "tw-opacity-80" : ""} style={active ? {} : { color: mod.color }}>
                    {latest.toFixed(0)}%
                </span>
            )}
        </button>
    );
}

// ── Format timestamp for X axis ───────────────────────────────────────────
function fmtTime(ts: string, range: string) {
    const d = new Date(ts);
    if (range === "daily") return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    if (range === "weekly") return d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric" });
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

// ── Main Page ─────────────────────────────────────────────────────────────
type Range = "daily" | "weekly" | "monthly";

export default function HistoryPage() {
    const [range, setRange] = useState<Range>("daily");
    const [data, setData] = useState<HealthDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState("");
    const [activeMods, setActiveMods] = useState<Set<string>>(
        new Set(MODULES.map((m) => m.key))  // ทุก module เปิดไว้ตั้งต้น
    );
    const { activeSn, activeName } = useStation();
    const { tick, countdown, refresh } = useAutoRefresh(120);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await aiApi.healthHistory(range);
            // ✅ API return { data: [...], count, station, hours }
            const list = (res as any)?.data ?? (Array.isArray(res) ? res : []);
            setData(list);
            setLastUpdate(new Date().toLocaleTimeString("th-TH"));
        } catch {
            setError("ไม่สามารถโหลด Health History ได้");
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => { loadData(); }, [tick, loadData]);

    const toggleMod = (key: string) => {
        setActiveMods((prev) => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    // ── Chart data: format timestamp + extract system_health ──────────────
    const systemChartData = useMemo(() =>
        data.map((d) => ({
            time: fmtTime(d.timestamp, range),
            value: typeof (d as any).score === "number" ? (d as any).score : null,
        })).filter((d) => d.value != null),
        [data, range]);

    // ── Per-module chart data ──────────────────────────────────────────────
    const moduleChartData = useMemo(() =>
        data.map((d) => {
            const point: Record<string, any> = { time: fmtTime(d.timestamp, range) };
            MODULES.forEach((mod) => {
                const v = d.modules?.[mod.key];
                point[mod.key] = typeof v === "number" ? v : null;
            });
            return point;
        }),
        [data, range]);

    // latest value per module (for pill display)
    const latestModValues = useMemo(() => {
        const last = data[data.length - 1];
        if (!last) return {} as Record<string, number | null>;
        return Object.fromEntries(
            MODULES.map((m) => {
                const v = last.modules?.[m.key];
                return [m.key, typeof v === "number" ? v : null];
            })
        );
    }, [data]);

    const currentSystemHealth = systemChartData[systemChartData.length - 1]?.value ?? null;

    return (
        <div className="ai-root tw-min-h-screen" style={{ background: "var(--ai-bg)" }}>

            {/* Top bar */}
            <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-6 tw-py-3
                      tw-flex tw-items-center tw-justify-between tw-gap-4 tw-flex-wrap">
                <div className="tw-flex tw-items-center tw-gap-3">
                    <span className="tw-font-semibold tw-text-gray-800">📈 Health History</span>
                    <div className="tw-w-px tw-h-4 tw-bg-gray-200" />
                    <div style={{ fontSize: ".78em", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>⚡</span>
                        <span style={{ fontWeight: 700 }}>{activeSn || "—"}</span>
                        {activeName && <span style={{ color: "var(--ai-dim)" }}>{activeName}</span>}
                    </div>
                    {currentSystemHealth != null && (
                        <span
                            className="tw-text-sm tw-font-medium"
                            style={{ color: getHealthColor(currentSystemHealth) }}
                        >
                            ปัจจุบัน {currentSystemHealth.toFixed(1)}%
                        </span>
                    )}
                </div>
                <div className="tw-flex tw-items-center tw-gap-3">
                    {/* Range selector */}
                    <div className="tw-flex tw-gap-1.5">
                        <RangeBtn label="24h" active={range === "daily"} onClick={() => setRange("daily")} />
                        <RangeBtn label="7d" active={range === "weekly"} onClick={() => setRange("weekly")} />
                        <RangeBtn label="30d" active={range === "monthly"} onClick={() => setRange("monthly")} />
                    </div>
                    <button
                        onClick={refresh}
                        className="tw-flex tw-items-center tw-gap-1 tw-px-3 tw-py-1.5 tw-text-xs
                       tw-font-medium tw-border tw-border-gray-200 tw-rounded-lg hover:tw-bg-gray-50"
                    >
                        ↻ <span className="tw-text-gray-400">{countdown}s</span>
                    </button>
                    {lastUpdate && (
                        <span className="tw-text-xs tw-text-gray-400">อัปเดต {lastUpdate}</span>
                    )}
                </div>
            </div>

            <NavTabs />

            <div className="tw-p-6 tw-flex tw-flex-col tw-gap-5">
                {error && (
                    <div className="tw-p-4 tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-xl
                          tw-text-red-700 tw-text-sm">
                        ⚠ {error}
                    </div>
                )}

                {/* ── Chart 1: System Health ──────────────────────────────── */}
                <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-p-5">
                    <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
                        <div>
                            <div className="tw-text-sm tw-font-semibold tw-text-gray-700 tw-uppercase tw-tracking-wide">
                                System Health %
                            </div>
                            <div className="tw-text-xs tw-text-gray-400 tw-mt-0.5">
                                Weighted average — {range === "daily" ? "24 ชม." : range === "weekly" ? "7 วัน" : "30 วัน"}
                            </div>
                        </div>
                        {/* CBM Legend */}
                        <div className="tw-flex tw-gap-3">
                            {CBM_ZONES.map((z) => (
                                <div key={z.y} className="tw-flex tw-items-center tw-gap-1">
                                    <div className="tw-w-5 tw-border-t-2 tw-border-dashed" style={{ borderColor: z.color }} />
                                    <span className="tw-text-xs tw-text-gray-400">{z.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="tw-flex tw-items-center tw-justify-center tw-h-64 tw-gap-3">
                            <div className="tw-w-6 tw-h-6 tw-rounded-full tw-border-2 tw-border-gray-200
                              tw-border-t-blue-500 tw-animate-spin" />
                            <span className="tw-text-sm tw-text-gray-400">กำลังโหลด...</span>
                        </div>
                    ) : systemChartData.length === 0 ? (
                        <div className="tw-flex tw-items-center tw-justify-center tw-h-64 tw-text-gray-400 tw-text-sm">
                            ไม่มีข้อมูล
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={systemChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="systemHealthGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                {CBM_ZONES.map((z) => (
                                    <ReferenceLine key={z.y} y={z.y} stroke={z.color}
                                        strokeDasharray="4 3" strokeWidth={1.5} />
                                ))}
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    name="System Health"
                                    stroke="#3b82f6"
                                    strokeWidth={2.5}
                                    fill="url(#systemHealthGradient)"
                                    dot={false}
                                    activeDot={{ r: 4, fill: "#3b82f6" }}
                                    connectNulls
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* ── Chart 2: Per-Module Breakdown ──────────────────────── */}
                <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-p-5">
                    <div className="tw-flex tw-items-start tw-justify-between tw-mb-4 tw-flex-wrap tw-gap-3">
                        <div>
                            <div className="tw-text-sm tw-font-semibold tw-text-gray-700 tw-uppercase tw-tracking-wide">
                                Per-Module Health Breakdown
                            </div>
                            <div className="tw-text-xs tw-text-gray-400 tw-mt-0.5">
                                กดที่ module เพื่อเปิด/ปิดเส้นกราฟ
                            </div>
                        </div>
                        {/* Module toggle pills */}
                        <div className="tw-flex tw-flex-wrap tw-gap-2">
                            {MODULES.map((mod) => (
                                <ModulePill
                                    key={mod.key}
                                    mod={mod}
                                    active={activeMods.has(mod.key)}
                                    latest={latestModValues[mod.key] ?? null}
                                    onClick={() => toggleMod(mod.key)}
                                />
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="tw-flex tw-items-center tw-justify-center tw-h-56 tw-gap-3">
                            <div className="tw-w-6 tw-h-6 tw-rounded-full tw-border-2 tw-border-gray-200
                              tw-border-t-blue-500 tw-animate-spin" />
                        </div>
                    ) : moduleChartData.length === 0 ? (
                        <div className="tw-flex tw-items-center tw-justify-center tw-h-56
                            tw-text-gray-400 tw-text-sm">
                            ไม่มีข้อมูล
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={moduleChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }}
                                    tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                {MODULES.filter((m) => activeMods.has(m.key)).map((mod) => (
                                    <Line
                                        key={mod.key}
                                        type="monotone"
                                        dataKey={mod.key}
                                        name={mod.label}
                                        stroke={mod.color}
                                        strokeWidth={1.8}
                                        dot={false}
                                        activeDot={{ r: 3 }}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}