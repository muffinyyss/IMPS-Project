"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { aiApi, HealthDataPoint } from "../lib/api";
import { MODULES, getHealthColor } from "../lib/constants";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import "../ai-theme.css";
import { useStation } from "../hooks/useStation";

function AnimatedNumber({ value, decimals = 0 }: { value: number | null; decimals?: number }) {
    const [display, setDisplay] = useState(value ?? 0);
    const frameRef = useRef<number>();
    useEffect(() => {
        if (value == null) return;
        const start = display; const end = value; const duration = 800; const startTime = performance.now();
        const animate = (now: number) => { const progress = Math.min((now - startTime) / duration, 1); const ease = 1 - Math.pow(1 - progress, 3); setDisplay(start + (end - start) * ease); if (progress < 1) frameRef.current = requestAnimationFrame(animate); };
        frameRef.current = requestAnimationFrame(animate);
        return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
    }, [value]);
    return <>{display.toFixed(decimals)}</>;
}

function TrendBadge({ current, previous }: { current: number | null; previous: number | null }) {
    if (current == null || previous == null) return null;
    const diff = current - previous; const pct = previous !== 0 ? (diff / previous * 100).toFixed(1) : "0"; const up = diff >= 0;
    return (<span className="tw-inline-flex tw-items-center tw-gap-1 tw-px-2 sm:tw-px-2.5 tw-py-1 tw-rounded-full tw-text-xs tw-font-bold" style={{ background: up ? "rgba(5,150,105,.1)" : "rgba(220,38,38,.1)", color: up ? "#059669" : "#dc2626" }}>{up ? "↑" : "↓"} {Math.abs(Number(pct))}%</span>);
}

function Sparkline({ data, color, height = 20 }: { data: number[]; color: string; height?: number }) {
    if (data.length < 2) return null;
    const w = 56; const min = Math.min(...data); const max = Math.max(...data); const range = max - min || 1;
    const pts = data.map((v, i) => { const x = (i / (data.length - 1)) * w; const y = height - ((v - min) / range) * height; return `${x},${y}`; }).join(" ");
    return (<svg width={w} height={height} style={{ overflow: "visible", flexShrink: 0 }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}

function KpiSummaryCards({ currentHealth, previousHealth, dataCount, range, activeSn }: { currentHealth: number | null; previousHealth: number | null; dataCount: number; range: string; activeSn: string; }) {
    const rangeLabel = range === "daily" ? "24h" : range === "weekly" ? "7d" : "30d";
    const healthColor = currentHealth == null ? "#fff" : currentHealth >= 75 ? "#34d399" : currentHealth >= 50 ? "#fbbf24" : "#f87171";
    const cards = [
        { label: "System Health", isAnimated: true, value: currentHealth, suffix: "%", decimals: 1, valueStyle: { color: healthColor }, iconBg: "rgba(255,255,255,.10)", iconRing: "rgba(255,255,255,.15)", icon: <span className="tw-text-base">⚙️</span>, extra: <TrendBadge current={currentHealth} previous={previousHealth} /> },
        { label: "Active Station", isAnimated: false, rawValue: activeSn || "—", valueStyle: { color: "#fff", fontSize: ".9em" }, iconBg: "rgba(255,255,255,.10)", iconRing: "rgba(255,255,255,.15)", icon: <span className="tw-text-base">⚡</span> },
        { label: "Data Points", isAnimated: true, value: dataCount, decimals: 0, valueStyle: { color: "#60a5fa" }, iconBg: "rgba(59,130,246,.15)", iconRing: "rgba(96,165,250,.25)", icon: <span className="tw-text-base">📊</span> },
        { label: "Time Range", isAnimated: false, rawValue: rangeLabel, valueStyle: { color: "#fbbf24" }, iconBg: "rgba(234,179,8,.15)", iconRing: "rgba(251,191,36,.25)", icon: <span className="tw-text-base">🕐</span> },
    ];
    return (
        <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-4 tw-gap-2 sm:tw-gap-2.5 tw-mb-4 sm:tw-mb-5">
            {cards.map((card) => (
                <div key={card.label} className="tw-group tw-relative tw-overflow-hidden tw-rounded-xl sm:tw-rounded-2xl tw-bg-gradient-to-br tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-3 sm:tw-px-5 tw-py-3 sm:tw-py-4 tw-ring-1 tw-ring-white/10 tw-shadow-lg hover:tw-shadow-xl tw-transition-all tw-duration-300 hover:tw--translate-y-0.5">
                    <div className="tw-absolute tw-inset-0 tw-opacity-[0.03] tw-pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
                    <div className="tw-relative tw-z-10">
                        <div className="tw-flex tw-items-center tw-gap-1.5 sm:tw-gap-2 tw-mb-2">
                            <div className="tw-h-7 tw-w-7 sm:tw-h-8 sm:tw-w-8 tw-rounded-lg sm:tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-ring-1 tw-flex-shrink-0" style={{ background: card.iconBg, boxShadow: `0 0 0 1px ${card.iconRing}` }}>{card.icon}</div>
                            <span className="tw-text-[9px] sm:tw-text-[11px] tw-font-semibold tw-text-white/40 tw-uppercase tw-tracking-wider tw-leading-tight">{card.label}</span>
                        </div>
                        <div className="tw-text-2xl sm:tw-text-3xl tw-font-black tw-tabular-nums tw-tracking-tight tw-leading-none tw-mb-1" style={card.valueStyle}>
                            {card.isAnimated && card.value != null ? <><AnimatedNumber value={card.value} decimals={card.decimals ?? 0} />{card.suffix ?? ""}</> : (card.rawValue ?? "—")}
                        </div>
                        {(card as any).extra}
                    </div>
                </div>
            ))}
        </div>
    );
}

function ModulePill({ mod, sparkData, current, active, onClick }: { mod: typeof MODULES[0]; sparkData: number[]; current: number | null; active: boolean; onClick: () => void; }) {
    const color = current == null ? "#6b7280" : current >= 75 ? "#22c55e" : current >= 50 ? "#eab308" : "#ef4444";
    return (
        <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 9999, cursor: "pointer", background: active ? "#111827" : "#f3f4f6", border: `1px solid ${active ? "#374151" : "#e5e7eb"}`, transition: "all .2s", flexShrink: 0 }}>
            <span style={{ fontSize: ".8em" }}>{mod.icon}</span>
            <span style={{ fontSize: ".65em", fontWeight: 700, color: active ? "rgba(255,255,255,.6)" : "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em" }}>M{mod.num}</span>
            <span style={{ fontSize: ".75em", fontWeight: 800, color: active ? "#fff" : color, fontFamily: "'JetBrains Mono',monospace" }}>{current != null ? `${current.toFixed(0)}%` : "—"}</span>
            {sparkData.length > 1 && (<span style={{ opacity: active ? .7 : .4 }} className="tw-hidden sm:tw-inline-flex"><Sparkline data={sparkData} color={active ? "#fff" : color} height={18} /></span>)}
        </button>
    );
}

const CBM_ZONES = [{ y: 80, label: "Good ≥80%", color: "#059669" }, { y: 60, label: "Monitor 60%", color: "#d97706" }, { y: 40, label: "Inspect 40%", color: "#ea580c" }];

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "#111827", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "10px 14px", fontSize: ".75em", minWidth: 150, boxShadow: "0 8px 30px rgba(0,0,0,.3)" }}>
            <div style={{ fontWeight: 700, color: "rgba(255,255,255,.6)", marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>{label}</div>
            {payload.map((p: any) => (<div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0, display: "inline-block" }} /><span style={{ color: "rgba(255,255,255,.5)", flex: 1 }}>{p.name}</span><span style={{ fontWeight: 700, color: p.color, fontFamily: "'JetBrains Mono',monospace" }}>{p.value?.toFixed(1)}%</span></div>))}
        </div>
    );
}

function RangeBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (<button onClick={onClick} className="tw-px-3 sm:tw-px-4 tw-py-1.5 tw-text-xs tw-rounded-lg tw-font-bold tw-transition-all tw-duration-200" style={active ? { background: "#111827", color: "#fff", boxShadow: "0 2px 4px rgba(17,24,39,.25)" } : { background: "transparent", color: "#6b7280" }}>{label}</button>);
}

function fmtTime(ts: string, range: string) {
    const d = new Date(ts);
    if (range === "daily") return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    if (range === "weekly") return d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric" });
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

type Range = "daily" | "weekly" | "monthly";

export default function HistoryPage() {
    const [range, setRange] = useState<Range>("daily");
    const [data, setData] = useState<HealthDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState("");
    const [activeMods, setActiveMods] = useState<Set<string>>(new Set(MODULES.map((m) => m.key)));
    const { activeSn } = useStation();
    const { tick, countdown, refresh } = useAutoRefresh(120);

    const loadData = useCallback(async () => {
        setLoading(true); setError(null);
        try { const res = await aiApi.healthHistory(range); const list = (res as any)?.data ?? (Array.isArray(res) ? res : []); setData(list); setLastUpdate(new Date().toLocaleTimeString("th-TH")); }
        catch { setError("ไม่สามารถโหลด Health History ได้"); }
        finally { setLoading(false); }
    }, [range]);

    useEffect(() => { loadData(); }, [tick, loadData]);
    const toggleMod = (key: string) => { setActiveMods((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; }); };

    const systemChartData = useMemo(() => data.map((d) => ({ time: fmtTime(d.timestamp, range), value: typeof (d as any).score === "number" ? (d as any).score : null })).filter((d) => d.value != null), [data, range]);
    const moduleChartData = useMemo(() => data.map((d) => { const pt: Record<string, any> = { time: fmtTime(d.timestamp, range) }; MODULES.forEach((m) => { const v = d.modules?.[m.key]; pt[m.key] = typeof v === "number" ? v : null; }); return pt; }), [data, range]);
    const modSparkData = useMemo(() => Object.fromEntries(MODULES.map((m) => [m.key, data.slice(-20).map((d) => { const v = d.modules?.[m.key]; return typeof v === "number" ? v : null; }).filter((v): v is number => v != null)])), [data]);
    const latestModValues = useMemo(() => { const last = data[data.length - 1]; if (!last) return {} as Record<string, number | null>; return Object.fromEntries(MODULES.map((m) => { const v = last.modules?.[m.key]; return [m.key, typeof v === "number" ? v : null]; })); }, [data]);
    const currentHealth = systemChartData[systemChartData.length - 1]?.value ?? null;
    const previousHealth = systemChartData[Math.max(0, systemChartData.length - 10)]?.value ?? null;

    const LoadingSpinner = () => (<div className="tw-flex tw-items-center tw-justify-center tw-h-48 sm:tw-h-64 tw-gap-3"><div className="tw-w-6 tw-h-6 tw-rounded-full tw-border-2 tw-border-gray-200 tw-border-t-gray-900 tw-animate-spin" /><span className="tw-text-sm tw-text-gray-400">กำลังโหลด...</span></div>);

    return (
        <div className="ai-root tw-min-h-screen">
            {/* ── Toolbar (range + refresh) ── */}
            <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-4 sm:tw-px-6 tw-py-2.5 tw-flex tw-items-center tw-justify-between tw-gap-3 tw-flex-wrap">
                <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-3 tw-flex-wrap">
                    {currentHealth != null && (
                        <>
                            <span className="tw-text-xs sm:tw-text-sm tw-font-semibold" style={{ color: getHealthColor(currentHealth) }}>{currentHealth.toFixed(1)}%</span>
                            <TrendBadge current={currentHealth} previous={previousHealth} />
                            <div className="tw-w-px tw-h-4 tw-bg-gray-200" />
                        </>
                    )}
                    <div className="tw-flex tw-gap-0.5 tw-bg-gray-100 tw-rounded-xl tw-p-1">
                        <RangeBtn label="24h" active={range === "daily"} onClick={() => setRange("daily")} />
                        <RangeBtn label="7d" active={range === "weekly"} onClick={() => setRange("weekly")} />
                        <RangeBtn label="30d" active={range === "monthly"} onClick={() => setRange("monthly")} />
                    </div>
                </div>
                <div className="tw-flex tw-items-center tw-gap-2">
                    <button onClick={refresh} className="tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-text-xs tw-font-bold tw-bg-gray-900 hover:tw-bg-black tw-text-white tw-rounded-lg tw-transition-colors" style={{ fontFamily: "'JetBrains Mono', monospace" }}>↻ {countdown}s</button>
                    {lastUpdate && <span className="tw-text-xs tw-text-gray-400 tw-hidden sm:tw-inline">อัปเดต {lastUpdate}</span>}
                </div>
            </div>

            <div className="tw-p-3 sm:tw-p-4 lg:tw-p-6 tw-flex tw-flex-col tw-gap-4 sm:tw-gap-5">
                {error && <div className="tw-p-3 sm:tw-p-4 tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-xl tw-text-red-700 tw-text-sm">⚠ {error}</div>}

                <KpiSummaryCards currentHealth={currentHealth} previousHealth={previousHealth} dataCount={data.length} range={range} activeSn={activeSn} />

                {/* System Health Chart */}
                <div className="tw-bg-white tw-rounded-xl sm:tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-overflow-hidden">
                    <div className="tw-px-4 sm:tw-px-6 tw-py-4 sm:tw-py-5 tw-bg-gradient-to-r tw-from-white tw-to-blue-gray-50/30 tw-border-b tw-border-gray-100">
                        <div className="tw-flex tw-items-start sm:tw-items-center tw-justify-between tw-flex-wrap tw-gap-2 sm:tw-gap-3">
                            <div>
                                <div className="tw-text-sm tw-font-bold tw-text-gray-800 tw-uppercase tw-tracking-wide">System Health %</div>
                                <div className="tw-text-xs tw-text-gray-400 tw-mt-0.5">Weighted avg — {range === "daily" ? "24 ชม." : range === "weekly" ? "7 วัน" : "30 วัน"}</div>
                            </div>
                            <div className="tw-hidden sm:tw-flex tw-gap-3 sm:tw-gap-4">
                                {CBM_ZONES.map((z) => (<div key={z.y} className="tw-flex tw-items-center tw-gap-1.5"><div className="tw-w-4 sm:tw-w-5 tw-border-t-2 tw-border-dashed" style={{ borderColor: z.color }} /><span className="tw-text-[10px] sm:tw-text-xs tw-text-gray-400">{z.label}</span></div>))}
                            </div>
                        </div>
                    </div>
                    <div className="tw-p-3 sm:tw-p-5">
                        {loading ? <LoadingSpinner /> : systemChartData.length === 0 ? (<div className="tw-flex tw-items-center tw-justify-center tw-h-48 sm:tw-h-64 tw-text-gray-400 tw-text-sm">ไม่มีข้อมูล</div>) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={systemChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                    <defs><linearGradient id="sysGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#111827" stopOpacity={0.2} /><stop offset="95%" stopColor="#111827" stopOpacity={0} /></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    {CBM_ZONES.map((z) => (<ReferenceLine key={z.y} y={z.y} stroke={z.color} strokeDasharray="4 3" strokeWidth={1.5} />))}
                                    <Area type="monotone" dataKey="value" name="System Health" stroke="#111827" strokeWidth={2.5} fill="url(#sysGrad)" dot={false} activeDot={{ r: 4, fill: "#111827", stroke: "#fff", strokeWidth: 2 }} connectNulls />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Per-Module Chart */}
                <div className="tw-bg-white tw-rounded-xl sm:tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-overflow-hidden">
                    <div className="tw-px-4 sm:tw-px-6 tw-py-4 sm:tw-py-5 tw-bg-gradient-to-r tw-from-white tw-to-blue-gray-50/30 tw-border-b tw-border-gray-100">
                        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                            <div>
                                <div className="tw-text-sm tw-font-bold tw-text-gray-800 tw-uppercase tw-tracking-wide">Per-Module Health</div>
                                <div className="tw-text-xs tw-text-gray-400 tw-mt-0.5">{Array.from(activeMods).length} modules selected</div>
                            </div>
                        </div>
                        <div className="tw-flex tw-flex-wrap tw-gap-1.5 sm:tw-gap-2">
                            {MODULES.map((mod) => (<ModulePill key={mod.key} mod={mod} sparkData={modSparkData[mod.key] ?? []} current={latestModValues[mod.key] ?? null} active={activeMods.has(mod.key)} onClick={() => toggleMod(mod.key)} />))}
                        </div>
                    </div>
                    <div className="tw-p-3 sm:tw-p-5">
                        {loading ? <LoadingSpinner /> : moduleChartData.length === 0 ? (<div className="tw-flex tw-items-center tw-justify-center tw-h-48 tw-text-gray-400 tw-text-sm">ไม่มีข้อมูล</div>) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={moduleChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    {MODULES.filter((m) => activeMods.has(m.key)).map((mod) => (<Line key={mod.key} type="monotone" dataKey={mod.key} name={mod.label} stroke={mod.color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} connectNulls />))}
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}