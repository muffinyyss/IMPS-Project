"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { aiApi, DashboardAllResponse, ModuleResult } from "./lib/api";
import { MODULES, getHealthColor } from "./lib/constants";
import { useAutoRefresh } from "./hooks/useAutoRefresh";
import { useStation } from "./hooks/useStation";
import { HealthGaugeSvg, StatusBadge, RefreshBar } from "./components/ui";
import "./ai-theme.css";

// ── Module Card ───────────────────────────────────────────────────────────
function ModuleCard({ mod, data, loading, onClick }: {
    mod: typeof MODULES[0]; data: ModuleResult | null;
    loading: boolean; onClick: () => void;
}) {
    const health = (data as any)?.health ?? null;
    const hasErr = !data || !!(data as any).error;
    const hColor = getHealthColor(health);
    const topGrad =
        hasErr || health == null ? "linear-gradient(90deg,#6b7280,#94a3b8)"
            : health >= 75 ? "linear-gradient(90deg,#22c55e,#34d399)"
                : health >= 50 ? "linear-gradient(90deg,#eab308,#fbbf24)"
                    : "linear-gradient(90deg,#ef4444,#f87171)";

    return (
        <div onClick={onClick}
            style={{ borderRadius: 16, background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden", cursor: "pointer", transition: "all .3s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 28px rgba(0,0,0,.1)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
        >
            <div style={{ height: 4, background: topGrad }} />
            <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1em", background: "linear-gradient(135deg,#111827,#1f2937)",
                            boxShadow: "0 2px 4px rgba(0,0,0,.2)", color: "#fff",
                        }}>{mod.icon}</div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: ".8em" }}>{mod.label}</div>
                            <div style={{ fontSize: ".58em", color: "#6b7280", marginTop: 1 }}>{mod.labelTh}</div>
                        </div>
                    </div>
                    <StatusBadge health={health} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f9fafb", border: "1px solid #f3f4f6" }}>
                        <div style={{ fontSize: ".5em", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 2 }}>Status</div>
                        <div style={{ fontSize: "1em", fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: hColor }}>
                            {hasErr ? "NO DATA" : health == null ? "—" : health >= 75 ? "NORMAL" : health >= 50 ? "WARN" : "CRIT"}
                        </div>
                    </div>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f9fafb", border: "1px solid #f3f4f6" }}>
                        <div style={{ fontSize: ".5em", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 2 }}>Models</div>
                        <div style={{ fontSize: "1em", fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>
                            {mod.aiModels.length > 0 ? `${mod.aiModels.length} loaded` : "Rule-based"}
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
                    {loading ? (
                        <div style={{ height: 52, display: "flex", alignItems: "center" }}>
                            <div style={{ width: 24, height: 24, border: "2px solid #e2e8f0", borderTopColor: "#111827", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                        </div>
                    ) : <HealthGaugeSvg health={health} size={80} />}
                </div>
                {data && !(data as any).error && (
                    <div style={{ marginTop: 4, fontSize: ".58em", color: "#6b7280", textAlign: "center" }}>
                        Weight: {(mod.weight * 100).toFixed(0)}% of System Health
                    </div>
                )}
            </div>
            <div style={{
                padding: "6px 16px", background: "rgba(208,218,232,.15)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: ".52em", color: "#6b7280", borderTop: "1px solid #e5e7eb",
            }}>
                <span>Click to open module</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    {(data as any)?._result_ts
                        ? new Date((data as any)._result_ts).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                </span>
            </div>
        </div>
    );
}

export default function AiDashboardPage() {
    const router = useRouter();
    const [data, setData] = useState<DashboardAllResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState("");
    const { tick, countdown, refresh } = useAutoRefresh(120);
    const { activeSn, activeName } = useStation();


    const loadData = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await aiApi.dashboardAll();
            setData(res);
            setLastUpdate(new Date().toLocaleTimeString("th-TH"));
        } catch { setError("ไม่สามารถเชื่อมต่อ AI Server"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [tick, loadData]);

    const systemHealth = React.useMemo(() => {
        // ใช้ system_health จาก API (backend คำนวณด้วย formula ที่ถูกต้อง)
        if ((data as any)?.system_health != null) return (data as any).system_health;
        // Fallback: คำนวณเองถ้า API ยังไม่ return field นี้
        if (!data?.modules) return null;
        let total = 0, w = 0;
        MODULES.forEach((mod) => {
            const h = (data.modules[mod.key] as any)?.health;
            if (h != null && !(data.modules[mod.key] as any).error) {
                total += h * mod.weight; w += mod.weight;
            }
        });
        return w > 0 ? Math.round(total / w) : null;
    }, [data]);

    const counts = React.useMemo(() => {
        let ok = 0, warn = 0, crit = 0;
        MODULES.forEach((mod) => {
            const h = (data?.modules?.[mod.key] as any)?.health;
            if (h == null) return;
            if (h >= 75) ok++; else if (h >= 50) warn++; else crit++;
        });
        return { ok, warn, crit };
    }, [data]);

    return (
        <div className="ai-root tw-min-h-screen">
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes ping { 75%,100% { transform: scale(2); opacity: 0; } }
            `}</style>

            {/* ── Station bar — display only ── */}
            <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-4 sm:tw-px-6 tw-py-2.5 tw-flex tw-items-center tw-justify-between tw-gap-3 tw-flex-wrap">
                <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-4 tw-flex-wrap">
                    {activeSn && (
                        <div className="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-1.5 tw-rounded-lg tw-bg-gray-50 tw-border tw-border-gray-200 tw-text-sm">
                            <span>⚡</span>
                            <div className="tw-text-left">
                                <div className="tw-font-bold tw-text-gray-900 tw-text-xs sm:tw-text-sm">{activeSn}</div>
                                {activeName && <div className="tw-text-[10px] tw-text-gray-400 tw-hidden sm:tw-block">{activeName}</div>}
                            </div>
                        </div>
                    )}
                    {systemHealth != null && (
                        <div className="tw-flex tw-items-center tw-gap-1.5">
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: getHealthColor(systemHealth), flexShrink: 0 }} />
                            <span className="tw-text-xs sm:tw-text-sm tw-font-bold" style={{ color: getHealthColor(systemHealth) }}>{systemHealth}%</span>
                            <span className="tw-text-xs tw-text-gray-400 tw-hidden sm:tw-inline">System Health</span>
                        </div>
                    )}
                </div>
                <div className="tw-flex tw-items-center tw-gap-1.5 sm:tw-gap-2">
                    {[
                        { label: `✓ ${counts.ok}`, full: "Normal", bg: "#f0fdf4", color: "#059669", ring: "rgba(5,150,105,.2)" },
                        { label: `⚠ ${counts.warn}`, full: "Warning", bg: "#fefce8", color: "#d97706", ring: "rgba(234,179,8,.2)" },
                        { label: `✕ ${counts.crit}`, full: "Critical", bg: "#fef2f2", color: "#dc2626", ring: "rgba(220,38,38,.2)" },
                    ].map((c) => (
                        <span key={c.label}
                            className="tw-inline-flex tw-items-center tw-gap-1 tw-px-2 sm:tw-px-3 tw-py-1 tw-rounded-md tw-text-xs tw-font-bold"
                            style={{ background: c.bg, color: c.color, boxShadow: `0 0 0 1px ${c.ring}` }}>
                            <span>{c.label}</span>
                            <span className="tw-hidden sm:tw-inline">{c.full}</span>
                        </span>
                    ))}
                </div>
            </div>

            <div className="tw-p-3 sm:tw-p-4 lg:tw-p-6">
                {error && <div className="tw-mb-4 tw-p-3 sm:tw-p-4 tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-xl tw-text-red-700 tw-text-sm">⚠ {error}</div>}

                {/* KPI Row */}
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 lg:tw-grid-cols-5 tw-gap-2 sm:tw-gap-2.5 tw-mb-4 sm:tw-mb-5">
                    {[
                        { label: "System Health", value: systemHealth != null ? `${systemHealth}%` : "—", iconStyle: { background: "rgba(255,255,255,.10)", boxShadow: "0 0 0 1px rgba(255,255,255,.15)" }, icon: <span className="tw-text-base">⚙️</span>, valueStyle: { color: "#fff" } },
                        { label: "Total Modules", value: 7, iconStyle: { background: "rgba(255,255,255,.10)", boxShadow: "0 0 0 1px rgba(255,255,255,.15)" }, icon: <span className="tw-text-base">🤖</span>, valueStyle: { color: "#fff" } },
                        { label: "Normal", value: counts.ok, iconStyle: { background: "rgba(16,185,129,.15)", boxShadow: "0 0 0 1px rgba(52,211,153,.25)" }, icon: (<span className="tw-relative tw-flex tw-h-2.5 tw-w-2.5"><span className="tw-animate-ping tw-absolute tw-inline-flex tw-h-full tw-w-full tw-rounded-full tw-opacity-75" style={{ background: "#34d399" }} /><span className="tw-relative tw-inline-flex tw-rounded-full tw-h-2.5 tw-w-2.5" style={{ background: "#34d399" }} /></span>), valueStyle: { color: "#34d399" } },
                        { label: "Warning", value: counts.warn, iconStyle: { background: "rgba(234,179,8,.15)", boxShadow: "0 0 0 1px rgba(251,191,36,.25)" }, icon: <span className="tw-text-base">⚠️</span>, valueStyle: { color: "#fbbf24" } },
                        { label: "Critical", value: counts.crit, iconStyle: { background: "rgba(239,68,68,.15)", boxShadow: "0 0 0 1px rgba(248,113,113,.25)" }, icon: <span className="tw-h-2.5 tw-w-2.5 tw-rounded-full tw-inline-block" style={{ background: "#f87171" }} />, valueStyle: { color: "#f87171" } },
                    ].map((card) => (
                        <div key={card.label}
                            className="tw-group tw-relative tw-overflow-hidden tw-rounded-xl sm:tw-rounded-2xl tw-bg-gradient-to-br tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-3 sm:tw-px-5 tw-py-3 sm:tw-py-4 tw-ring-1 tw-ring-white/10 tw-shadow-lg hover:tw-shadow-xl tw-transition-all tw-duration-300 hover:tw--translate-y-0.5">
                            <div className="tw-absolute tw-inset-0 tw-opacity-[0.03] tw-pointer-events-none"
                                style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
                            <div className="tw-relative tw-z-10">
                                <div className="tw-flex tw-items-center tw-gap-1.5 sm:tw-gap-2 tw-mb-2">
                                    <div className="tw-h-7 tw-w-7 sm:tw-h-8 sm:tw-w-8 tw-rounded-lg sm:tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-ring-1 tw-flex-shrink-0" style={card.iconStyle}>{card.icon}</div>
                                    <span className="tw-text-[9px] sm:tw-text-[11px] tw-font-semibold tw-text-white/40 tw-uppercase tw-tracking-wider tw-leading-tight">{card.label}</span>
                                </div>
                                <div className="tw-text-2xl sm:tw-text-3xl tw-font-black tw-tabular-nums tw-tracking-tight tw-leading-none" style={card.valueStyle}>{card.value}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <RefreshBar countdown={countdown} lastUpdate={lastUpdate} onRefresh={refresh} loading={loading} />

                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 xl:tw-grid-cols-3 tw-gap-3 sm:tw-gap-4">
                    {MODULES.map((mod) => (
                        <ModuleCard key={mod.key} mod={mod}
                            data={(data?.modules?.[mod.key] as ModuleResult) ?? null}
                            loading={loading}
                            onClick={() => router.push(`/dashboard/ai/${mod.num}`)}
                        />
                    ))}
                </div>

                {data?.elapsed_ms != null && (
                    <div className="tw-mt-3 tw-text-right tw-text-xs tw-text-gray-400 tw-font-mono">
                        Batch load: {data.elapsed_ms.toFixed(1)}ms
                    </div>
                )}
            </div>
        </div>
    );
}