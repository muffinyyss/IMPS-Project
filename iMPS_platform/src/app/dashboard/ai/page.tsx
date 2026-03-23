"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { aiApi, DashboardAllResponse, ModuleResult } from "./lib/api";
import { MODULES, getHealthColor } from "./lib/constants";
import { useAutoRefresh } from "./hooks/useAutoRefresh";
import { useStation } from "./hooks/useStation";
import {
    HealthGaugeSvg, StatusTopBar, StatusBadge,
    KpiCard, RefreshBar,
} from "./components/ui";
import "./ai-theme.css";


// ── Sub-nav ───────────────────────────────────────────────────────────────
function SubNav() {
    const router = useRouter();
    const tabs = [
        { label: "📊 Dashboard", href: "/dashboard/ai" },
        { label: "📡 Station Monitor", href: "/dashboard/ai/monitor" },
        { label: "📈 Health History", href: "/dashboard/ai/history" },
        { label: "🎯 Heatmap", href: "/dashboard/ai/heatmap" },
    ];
    return (
        <div style={{
            background: "var(--color-background-primary,#fff)",
            borderBottom: "1px solid var(--color-border-tertiary,#d0dae8)",
            padding: "0 24px", display: "flex", gap: 4, overflowX: "auto",
        }}>
            {tabs.map((t) => (
                <button key={t.href} onClick={() => router.push(t.href)}
                    style={{
                        padding: "12px 24px", fontSize: ".75em", fontWeight: 600,
                        cursor: "pointer", color: "var(--color-text-secondary,#718096)",
                        letterSpacing: 1, textTransform: "uppercase",
                        borderBottom: t.href === "/dashboard/ai" ? "2px solid #0ea5e9" : "2px solid transparent",
                        background: "transparent", whiteSpace: "nowrap",
                        transition: ".2s",
                    } as any}
                >{t.label}</button>
            ))}
        </div>
    );
}

// ── Module Card (matches original dash-card) ──────────────────────────────
function ModuleCard({
    mod, data, loading, onClick,
}: {
    mod: typeof MODULES[0];
    data: ModuleResult | null;
    loading: boolean;
    onClick: () => void;
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
        <div
            onClick={onClick}
            style={{
                borderRadius: 16, background: "var(--color-background-primary,#fff)",
                border: "1px solid var(--color-border-tertiary,#d0dae8)",
                overflow: "hidden", cursor: "pointer",
                transition: "all .3s", position: "relative",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 28px rgba(0,0,0,.1)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
        >
            {/* 4px top bar */}
            <div style={{ height: 4, background: topGrad }} />

            <div style={{ padding: "18px 20px" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.1em", background: mod.color, color: "#fff", flexShrink: 0,
                        }}>{mod.icon}</div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: ".82em" }}>{mod.label}</div>
                            <div style={{ fontSize: ".6em", color: "var(--color-text-secondary,#718096)", marginTop: 2 }}>{mod.labelTh}</div>
                        </div>
                    </div>
                    <StatusBadge health={health} />
                </div>

                {/* 2-col metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                    <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(208,218,232,.25)" }}>
                        <div style={{ fontSize: ".52em", fontWeight: 600, color: "var(--color-text-secondary,#718096)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 3 }}>Status</div>
                        <div style={{ fontSize: "1.1em", fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: hColor }}>
                            {hasErr ? "NO DATA" : health == null ? "—" : health >= 75 ? "NORMAL" : health >= 50 ? "WARN" : "CRIT"}
                        </div>
                    </div>
                    <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(208,218,232,.25)" }}>
                        <div style={{ fontSize: ".52em", fontWeight: 600, color: "var(--color-text-secondary,#718096)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 3 }}>Models</div>
                        <div style={{ fontSize: "1.1em", fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>
                            {mod.aiModels.length > 0 ? `${mod.aiModels.length} loaded` : "Rule-based"}
                        </div>
                    </div>
                </div>

                {/* SVG Gauge */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                    {loading ? (
                        <div style={{ height: 52, display: "flex", alignItems: "center" }}>
                            <div style={{ width: 24, height: 24, border: "2px solid #e2e8f0", borderTopColor: "#0ea5e9", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                        </div>
                    ) : (
                        <HealthGaugeSvg health={health} size={90} />
                    )}
                </div>

                {/* Extra info */}
                {data && !(data as any).error && (
                    <div style={{ marginTop: 4, fontSize: ".6em", color: "var(--color-text-secondary,#718096)", textAlign: "center" }}>
                        Weight: {(mod.weight * 100).toFixed(0)}% of System Health
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                padding: "8px 20px",
                background: "rgba(208,218,232,.15)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: ".55em", color: "var(--color-text-secondary,#718096)",
                borderTop: "1px solid var(--color-border-tertiary,#d0dae8)",
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

// ── Main Page ─────────────────────────────────────────────────────────────
export default function AiDashboardPage() {
    const router = useRouter();
    const [data, setData] = useState<DashboardAllResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState("");

    const { tick, countdown, refresh } = useAutoRefresh(120);
    const { activeSn, activeName, stations, switchStation } = useStation();
    const [stationOpen, setStationOpen] = useState(false);
    const [stationSearch, setStationSearch] = useState("");

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

    // Weighted system health
    const systemHealth = React.useMemo(() => {
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

    const filteredStations = (Array.isArray(stations) ? stations : [])
        .filter((s) =>
            s.sn.toLowerCase().includes(stationSearch.toLowerCase()) ||
            s.name.toLowerCase().includes(stationSearch.toLowerCase())
        );

    return (
        <div className="ai-root" style={{ minHeight: "100vh", background: "var(--ai-bg)" }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* ── Top Bar ── */}
            <div style={{
                background: "var(--color-background-primary,#fff)",
                borderBottom: "1px solid var(--color-border-tertiary,#d0dae8)",
                padding: "0 24px", height: 56,
                display: "flex", alignItems: "center", gap: 16,
            }}>
                {/* Station selector */}
                <div style={{ position: "relative" }}>
                    <button
                        onClick={() => setStationOpen((v) => !v)}
                        style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "6px 12px", borderRadius: 8,
                            background: "var(--color-background-secondary,#f8fafc)",
                            border: "1px solid var(--color-border-secondary,#b8c8dc)",
                            cursor: "pointer", fontSize: ".8em",
                        }}
                    >
                        <span>⚡</span>
                        <div style={{ textAlign: "left" }}>
                            <div style={{ fontWeight: 700, fontSize: ".9em" }}>{activeSn || "เลือกสถานี"}</div>
                            {activeName && <div style={{ fontSize: ".75em", color: "var(--color-text-secondary,#718096)" }}>{activeName}</div>}
                        </div>
                        <span style={{ fontSize: ".7em", color: "var(--color-text-secondary,#718096)" }}>▼</span>
                    </button>

                    {stationOpen && (
                        <div style={{
                            position: "absolute", top: "calc(100% + 4px)", left: 0,
                            width: 280, background: "var(--color-background-primary,#fff)",
                            border: "1px solid var(--color-border-secondary,#b8c8dc)",
                            borderRadius: 10, boxShadow: "0 8px 30px rgba(0,0,0,.12)",
                            zIndex: 50, overflow: "hidden",
                        }}>
                            <div style={{ padding: 8, borderBottom: "1px solid var(--color-border-tertiary,#d0dae8)" }}>
                                <input
                                    style={{
                                        width: "100%", padding: "6px 12px", borderRadius: 8,
                                        border: "1px solid var(--color-border-secondary,#b8c8dc)",
                                        background: "var(--color-background-secondary,#f8fafc)",
                                        fontSize: ".8em", outline: "none",
                                    }}
                                    placeholder="🔍 Search station..."
                                    value={stationSearch}
                                    onChange={(e) => setStationSearch(e.target.value)}
                                />
                            </div>
                            <div style={{ maxHeight: 200, overflowY: "auto" }}>
                                {filteredStations.map((s) => (
                                    <button key={s.sn}
                                        onClick={() => { switchStation(s.sn); setStationOpen(false); loadData(); }}
                                        style={{
                                            width: "100%", display: "flex", alignItems: "center", gap: 10,
                                            padding: "8px 12px", textAlign: "left", cursor: "pointer",
                                            background: activeSn === s.sn ? "rgba(14,165,233,.08)" : "transparent",
                                            fontSize: ".8em", color: activeSn === s.sn ? "#0ea5e9" : "var(--color-text-primary,#2d3748)",
                                            border: "none",
                                        }}>
                                        <span>⚡</span>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                                            <div style={{ fontSize: ".8em", color: "var(--color-text-secondary,#718096)", fontFamily: "'JetBrains Mono',monospace" }}>{s.sn}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* System health inline */}
                {systemHealth != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: getHealthColor(systemHealth) }} />
                        <span style={{ fontSize: ".8em", fontWeight: 700, color: getHealthColor(systemHealth) }}>
                            System Health: {systemHealth}%
                        </span>
                    </div>
                )}

                {/* Right: counts + refresh */}
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                    {[
                        { label: `✓ ${counts.ok} Normal`, bg: "rgba(34,197,94,.1)", color: "#16a34a" },
                        { label: `⚠ ${counts.warn} Warning`, bg: "rgba(234,179,8,.1)", color: "#a16207" },
                        { label: `✕ ${counts.crit} Critical`, bg: "rgba(239,68,68,.1)", color: "#dc2626" },
                    ].map((c) => (
                        <span key={c.label} style={{ fontSize: ".7em", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: c.bg, color: c.color }}>
                            {c.label}
                        </span>
                    ))}
                </div>
            </div>

            <SubNav />

            {/* ── Content ── */}
            <div style={{ padding: 24 }}>
                {error && (
                    <div style={{ marginBottom: 16, padding: 16, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 12, color: "#dc2626", fontSize: ".8em" }}>
                        ⚠ {error}
                    </div>
                )}

                {/* KPI Row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 20 }}>
                    <KpiCard
                        label="⚙ System Health"
                        value={systemHealth != null ? `${systemHealth}%` : "—"}
                        sub="Weighted average of all modules"
                        accentClass="blue"
                    />
                    <KpiCard label="Total Modules" value={7} sub="Active AI modules" accentClass="blue" />
                    <KpiCard label="Normal" value={counts.ok} sub="Operating normally" accentClass="green" />
                    <KpiCard label="Warning" value={counts.warn} sub="Needs attention" accentClass="yellow" />
                    <KpiCard label="Critical" value={counts.crit} sub="Action required" accentClass="red" />
                </div>

                {/* Refresh bar */}
                <RefreshBar
                    countdown={countdown}
                    lastUpdate={lastUpdate}
                    onRefresh={refresh}
                    loading={loading}
                />

                {/* Module cards 7-grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
                    {MODULES.map((mod) => (
                        <ModuleCard
                            key={mod.key}
                            mod={mod}
                            data={(data?.modules?.[mod.key] as ModuleResult) ?? null}
                            loading={loading}
                            onClick={() => router.push(`/dashboard/ai/${mod.num}`)}
                        />
                    ))}
                </div>

                {data?.elapsed_ms != null && (
                    <div style={{ marginTop: 12, fontSize: ".65em", color: "var(--color-text-secondary,#718096)", textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>
                        Batch load: {data.elapsed_ms.toFixed(1)}ms
                    </div>
                )}
            </div>
        </div>
    );
}