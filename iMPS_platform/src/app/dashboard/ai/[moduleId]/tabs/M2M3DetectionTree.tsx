"use client";
import React, { useRef, useEffect, useCallback } from "react";
import { ModuleResult } from "../../lib/api";
import { AutoPredictPanel, HealthSummaryBar } from "./DetectionLayout";

// ─────────────────────────────────────────────────────────────────────────────
// Shared tree styles (ตรงต้นฉบับ .m2-mn, .m2-gn, .m2-cond, .m2-equip)
// ─────────────────────────────────────────────────────────────────────────────
const S = {
    card: {
        background: "#fff",
        border: "1px solid #d0dae8",
        borderRadius: 12,
        padding: "16px",
        marginBottom: 14,
    } as React.CSSProperties,

    ct: {
        fontSize: ".62em", fontWeight: 700,
        textTransform: "uppercase" as const, letterSpacing: "2.5px",
        color: "#718096", marginBottom: 10,
        display: "flex", alignItems: "center", gap: 7,
    } as React.CSSProperties,

    // Model node (.m2-mn)
    mn: {
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 8px",
        border: "1px solid #d0dae8",
        borderRadius: 6,
        background: "#f8fafc",
        marginBottom: 5,
        fontSize: ".6em",
        fontFamily: "'JetBrains Mono', monospace",
        position: "relative" as const,
    } as React.CSSProperties,

    // ML badge
    ml: {
        fontSize: ".55em", fontWeight: 700, padding: "1px 4px",
        borderRadius: 3, color: "#fff", lineHeight: 1,
        background: "linear-gradient(135deg,#0284c7,#06b6d4)",
        flexShrink: 0,
    } as React.CSSProperties,

    // DL badge
    dl: {
        fontSize: ".55em", fontWeight: 700, padding: "1px 4px",
        borderRadius: 3, color: "#fff", lineHeight: 1,
        background: "linear-gradient(135deg,#7c3aed,#a855f7)",
        flexShrink: 0,
    } as React.CSSProperties,

    mnId: {
        fontWeight: 700, fontSize: "1em", color: "#0284c7", minWidth: 14,
    } as React.CSSProperties,

    mnName: {
        fontWeight: 600, color: "#2d3748", fontSize: ".85em",
        whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis",
    } as React.CSSProperties,

    mnSub: { fontSize: ".72em", color: "#718096" } as React.CSSProperties,

    mnVal: {
        fontSize: ".72em", color: "#718096",
        minWidth: 30, textAlign: "right" as const,
    } as React.CSSProperties,

    // Detection group node (.m2-gn)
    gn: (color: string) => ({
        padding: "10px 14px", borderRadius: 10,
        border: `2px solid ${color}`, color,
        textAlign: "center" as const,
        background: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,.05)",
        whiteSpace: "nowrap" as const,
        marginBottom: 12,
        minWidth: 140,
    } as React.CSSProperties),

    gnT: { fontSize: ".7em", fontWeight: 700, marginBottom: 3 } as React.CSSProperties,
    gnC: { fontSize: ".55em", color: "#718096", fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 } as React.CSSProperties,

    // Condition item (.m2-cond)
    cond: {
        display: "flex", alignItems: "center", gap: 4,
        padding: "4px 7px",
        border: "1px solid #d0dae8", borderRadius: 4,
        marginBottom: 3,
        fontSize: ".55em",
        fontFamily: "'JetBrains Mono', monospace",
        background: "#f8fafc",
    } as React.CSSProperties,

    condId: { fontWeight: 700, color: "#0284c7", minWidth: 22 } as React.CSSProperties,
    condNm: { flex: 1, color: "#2d3748", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" } as React.CSSProperties,

    // Equipment group (.m2-equip)
    equip: {
        padding: "8px 10px", border: "1px solid #d0dae8", borderRadius: 6,
        textAlign: "center" as const, background: "#f0f4f8",
        marginBottom: 10,
    } as React.CSSProperties,

    equipNm: { fontSize: ".62em", fontWeight: 700, color: "#2d3748" } as React.CSSProperties,
    equipCnt: { fontSize: ".5em", color: "#718096", fontFamily: "'JetBrains Mono',monospace" } as React.CSSProperties,

    // Spacer between groups (.gs)
    gs: { height: 28, flexShrink: 0 } as React.CSSProperties,
} as const;

// Badge helpers
function StatusBadge({ st }: { st?: "OK" | "WARN" | "CRIT" | "IDLE" }) {
    const map = {
        OK: { bg: "#065f46", color: "#34d399" },
        WARN: { bg: "#78350f", color: "#fbbf24" },
        CRIT: { bg: "#7f1d1d", color: "#f87171" },
        IDLE: { bg: "#1e293b", color: "#64748b" },
    };
    const c = map[st ?? "OK"];
    return (
        <span style={{
            fontSize: ".6em", fontWeight: 700, padding: "1px 5px",
            borderRadius: 3, lineHeight: 1, background: c.bg, color: c.color,
            flexShrink: 0,
        }}>{st ?? "OK"}</span>
    );
}

function GroupStatus({ st }: { st: string }) {
    const ok = st === "OK" || st === "CLEAN" || st === "NORMAL" || st === "CLEAR";
    const warn = st === "WARN";
    const bg = ok ? "#065f46" : warn ? "#78350f" : "#7f1d1d";
    const color = ok ? "#34d399" : warn ? "#fbbf24" : "#f87171";
    return (
        <span style={{
            fontSize: ".6em", fontWeight: 700, padding: "2px 8px",
            borderRadius: 4, display: "inline-block", background: bg, color,
        }}>{st}</span>
    );
}

function TypeLegend() {
    const items = [
        { label: "Hybrid", bg: "linear-gradient(135deg,#0284c7,#06b6d4)" },
        { label: "AI", bg: "linear-gradient(135deg,#7c3aed,#a855f7)" },
        { label: "Rule", bg: "linear-gradient(135deg,#475569,#64748b)" },
    ];
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: ".55em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "#718096" }}>
            {items.map((i) => (
                <span key={i.label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: i.bg, display: "inline-block" }} />
                    {i.label}
                </span>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// M2 Tree
// ─────────────────────────────────────────────────────────────────────────────
interface M2Props {
    data: ModuleResult | null;
    countdown?: number;
    isPaused?: boolean;
    onTogglePause?: () => void;
}

function M2ModelTree({ data }: M2Props) {
    const scores = (data as any)?.model_scores ?? {};

    const getStatus = (v: number | undefined): "OK" | "WARN" | "CRIT" | "IDLE" => {
        if (v == null) return "IDLE";
        return v >= 0.75 ? "CRIT" : v >= 0.5 ? "WARN" : "OK";
    };

    const models = [
        { id: "A1", type: "ml", name: "XGBoost Regressor", sub: "Clogging Score 0–1", grp: "reg", val: scores.A1 },
        { id: "A2", type: "ml", name: "XGBoost Classifier", sub: "5-Level Clog Class", grp: "cls", val: scores.A2 },
        { id: "C", type: "dl", name: "DNN Classifier", sub: "5-Class SMOTE", grp: "cls", val: scores.C },
        { id: "D", type: "dl", name: "BiLSTM-Attention", sub: "Temporal Degradation", grp: "seq", val: scores.D },
        { id: "B", type: "dl", name: "Autoencoder", sub: "Reconstruction Anomaly", grp: "ad", val: scores.B },
        { id: "E", type: "ml", name: "IF + LOF Ensemble", sub: "Isolation Forest + LOF", grp: "ad", val: scores.E },
    ];

    const groups = [
        { key: "reg", label: "📈 Regression", sub: "Model A1", color: "#0ea5e9" },
        { key: "cls", label: "🎯 Classification", sub: "Models A2, C", color: "#a855f7" },
        { key: "seq", label: "🔄 Temporal", sub: "Model D", color: "#f59e0b" },
        { key: "ad", label: "🔍 Anomaly Det.", sub: "Models B, E", color: "#ef4444" },
    ];

    const grpStatus = (grpKey: string) => {
        const grpModels = models.filter((m) => m.grp === grpKey);
        const worst = Math.max(...grpModels.map((m) => m.val ?? 0));
        return worst >= 0.75 ? "ALARM" : worst >= 0.5 ? "WARN" : "CLEAN";
    };

    // SVG connecting lines between col 1 → col 2 → col 3
    const treeRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const gaugeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const draw = () => {
            const wrap = treeRef.current;
            const svg = svgRef.current;
            if (!wrap || !svg) return;

            const wR = wrap.getBoundingClientRect();
            if (wR.width === 0) return;

            svg.setAttribute("width", String(wR.width));
            svg.setAttribute("height", String(wR.height));

            const lines: string[] = [];

            // หา gauge column = div สุดท้ายใน wrap
            const allCols = wrap.querySelectorAll(":scope > div");
            const colR = allCols[allCols.length - 1];
            const colRRect = colR?.getBoundingClientRect();

            wrap.querySelectorAll("[data-grp-node]").forEach((grpEl) => {
                const grpKey = (grpEl as HTMLElement).dataset.grpNode!;
                const grpR = grpEl.getBoundingClientRect();
                const grpY = grpR.top + grpR.height / 2 - wR.top;
                const grpX1 = grpR.left - wR.left;
                const grpX2 = grpR.right - wR.left;

                // วาดเส้น model → group
                wrap.querySelectorAll(`[data-mn-grp="${grpKey}"]`).forEach((mnEl) => {
                    const mnR = mnEl.getBoundingClientRect();
                    const mnY = mnR.top + mnR.height / 2 - wR.top;
                    const mnX = mnR.right - wR.left;
                    const mx = (mnX + grpX1) / 2;
                    lines.push(`M ${mnX} ${mnY} C ${mx} ${mnY}, ${mx} ${grpY}, ${grpX1} ${grpY}`);
                });

                // วาดเส้น group → gauge
                const gaugeEl = gaugeRef.current;
                if (gaugeEl) {
                    const gaugeRect = gaugeEl.getBoundingClientRect();
                    const rX = gaugeRect.left - wR.left;
                    const rY = gaugeRect.top + gaugeRect.height / 2 - wR.top;
                    const mx = (grpX2 + rX) / 2;
                    lines.push(`M ${grpX2} ${grpY} C ${mx} ${grpY}, ${mx} ${rY}, ${rX} ${rY}`);
                }
            });

            svg.innerHTML = lines
                .map((d) => `<path d="${d}" fill="none" stroke="#d0dae8" stroke-width="1.5" stroke-dasharray="4,3"/>`)
                .join("");
        };

        // รอ layout เสร็จก่อน แล้วค่อย draw
        const timer = setTimeout(draw, 300);

        // draw อีกทีเมื่อ window resize
        window.addEventListener("resize", draw);

        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", draw);
        };
    }, [data]);
    return (
        <div ref={treeRef} style={{
            position: "relative", display: "flex", alignItems: "stretch",
            gap: 0, overflow: "visible", paddingBottom: 20,
        }}>
            <svg ref={svgRef} style={{
                position: "absolute", top: 0, left: 0, pointerEvents: "none",
                zIndex: 1, overflow: "visible",
            }} />

            {/* COL 1 — AI Models */}
            <div style={{ flex: "0 0 260px", zIndex: 2, paddingTop: 6 }}>
                <div style={{ fontSize: ".6em", fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>
                    AI Models (6)
                </div>
                {/* reg group */}
                <div data-mn-grp="reg" style={S.mn}>
                    <span style={S.ml}>ML</span>
                    <span style={S.mnId}>A1</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.mnName}>XGBoost Regressor</div>
                        <div style={S.mnSub}>Clogging Score 0–1</div>
                    </div>
                    <span style={S.mnVal}>{scores.A1?.toFixed(3) ?? "—"}</span>
                    <StatusBadge st={getStatus(scores.A1)} />
                </div>
                <div style={{ ...S.gs, height: 52 }} />

                {/* cls group */}
                {[{ id: "A2", type: "ml", name: "XGBoost Classifier", sub: "5-Level Clog Class", val: scores.A2 },
                { id: "C", type: "dl", name: "DNN Classifier", sub: "5-Class SMOTE", val: scores.C }].map((m) => (
                    <div key={m.id} data-mn-grp="cls" style={S.mn}>
                        <span style={m.type === "ml" ? S.ml : S.dl}>{m.type.toUpperCase()}</span>
                        <span style={S.mnId}>{m.id}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={S.mnName}>{m.name}</div>
                            <div style={S.mnSub}>{m.sub}</div>
                        </div>
                        <span style={S.mnVal}>{m.val?.toFixed(3) ?? "—"}</span>
                        <StatusBadge st={getStatus(m.val)} />
                    </div>
                ))}
                <div style={{ ...S.gs, height: 52 }} />

                {/* seq group */}
                <div data-mn-grp="seq" style={S.mn}>
                    <span style={S.dl}>DL</span>
                    <span style={S.mnId}>D</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.mnName}>BiLSTM-Attention</div>
                        <div style={S.mnSub}>Temporal Degradation</div>
                    </div>
                    <span style={S.mnVal}>{scores.D?.toFixed(3) ?? "—"}</span>
                    <StatusBadge st={getStatus(scores.D)} />
                </div>
                <div style={{ ...S.gs, height: 52 }} />

                {/* ad group */}
                {[{ id: "B", type: "dl", name: "Autoencoder", sub: "Reconstruction Anomaly", val: scores.B },
                { id: "E", type: "ml", name: "IF + LOF Ensemble", sub: "Isolation Forest + LOF", val: scores.E }].map((m) => (
                    <div key={m.id} data-mn-grp="ad" style={S.mn}>
                        <span style={m.type === "ml" ? S.ml : S.dl}>{m.type.toUpperCase()}</span>
                        <span style={S.mnId}>{m.id}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={S.mnName}>{m.name}</div>
                            <div style={S.mnSub}>{m.sub}</div>
                        </div>
                        <span style={S.mnVal}>{m.val?.toFixed(3) ?? "—"}</span>
                        <StatusBadge st={getStatus(m.val)} />
                    </div>
                ))}
            </div>

            {/* COL 2 — Detection Groups */}
            <div style={{ flex: "0 0 160px", position: "relative", margin: "0 40px", zIndex: 2 }}>
                <div style={{ fontSize: ".6em", fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>
                    Detection Groups
                </div>
                {groups.map((g) => (
                    <div key={g.key} data-grp-node={g.key} style={S.gn(g.color)}>
                        <div style={S.gnT}>{g.label}</div>
                        <div style={S.gnC}>{g.sub}</div>
                        <GroupStatus st={grpStatus(g.key)} />
                    </div>
                ))}
            </div>

            {/* COL 3 — System Gauge */}
            <div
                data-col-r
                ref={gaugeRef}
                style={{
                    flex: 1, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    minWidth: 0, zIndex: 2,
                }}
            >
                <M2SystemGauge data={data} />
            </div>
        </div>
    );
}

function M2SystemGauge({ data }: { data: ModuleResult | null }) {
    const health = data?.health ?? null;
    const risk = (data as any)?.ensemble_risk ?? (data as any)?.risk_score ?? null;
    const level = risk == null ? "—" : risk < 0.25 ? "CLEAN" : risk < 0.5 ? "MODERATE" : risk < 0.75 ? "DEGRADED" : "CLOGGED";

    // Semicircle gauge matching original viewBox="0 0 300 190"
    const ARC = 351.86; // π × 112
    const pct = risk != null ? Math.max(0, Math.min(1, risk)) : 0;
    const color = risk == null ? "#6b7280" : risk < 0.25 ? "#22c55e" : risk < 0.5 ? "#eab308" : risk < 0.75 ? "#f97316" : "#ef4444";

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", width: 220 }}>
                <svg viewBox="0 0 300 190" style={{ width: 220, height: "auto" }}>
                    <defs>
                        <filter id="m2glow">
                            <feGaussianBlur stdDeviation="4" result="b" />
                            <feFlood floodColor={color} floodOpacity=".3" />
                            <feComposite in2="b" operator="in" result="c" />
                            <feMerge><feMergeNode in="c" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                    </defs>
                    {/* Track */}
                    <path d="M 38 155 A 112 112 0 0 1 262 155" fill="none" stroke="rgba(0,0,0,.08)" strokeWidth="20" strokeLinecap="round" />
                    {/* Background zones */}
                    <path d="M 38 155 A 112 112 0 0 1 262 155" fill="none" stroke="#22c55e" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${ARC * 0.333} ${ARC}`} strokeDashoffset="0" opacity=".15" />
                    <path d="M 38 155 A 112 112 0 0 1 262 155" fill="none" stroke="#eab308" strokeWidth="14" strokeDasharray={`${ARC * 0.25} ${ARC}`} strokeDashoffset={`${-ARC * 0.333}`} opacity=".15" />
                    <path d="M 38 155 A 112 112 0 0 1 262 155" fill="none" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${ARC * 0.417} ${ARC}`} strokeDashoffset={`${-ARC * 0.583}`} opacity=".15" />
                    {/* Foreground */}
                    <path d="M 38 155 A 112 112 0 0 1 262 155" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
                        strokeDasharray={`${pct * ARC} ${ARC}`} strokeDashoffset="0"
                        filter="url(#m2glow)"
                        style={{ transition: "stroke-dasharray .8s ease, stroke .5s ease" }} />
                </svg>
                <div style={{
                    position: "absolute", bottom: 8, left: 0, right: 0,
                    textAlign: "center",
                }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.8em", fontWeight: 900, color, lineHeight: 1 }}>
                        {health != null ? `${health}%` : "—"}
                    </div>
                    <div style={{ fontSize: ".52em", fontWeight: 700, color: "#718096", marginTop: 2 }}>Health Score</div>
                </div>
            </div>
            <div style={{ fontSize: ".7em", fontWeight: 700 }}>🌡️ Filter Clogging Risk</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".65em", color: "#718096" }}>
                Clogging Level: <b style={{ color }}>{level}</b>
            </div>
        </div>
    );
}

function M2ConditionTree({ data }: { data: ModuleResult | null }) {
    const d = (data as any)?.data ?? {};

    const conds = [
        { id: "C01", nm: "PM Temp 1 Derating", eq: "thermal", val: d.power_module_temp1, thr: 55 },
        { id: "C02", nm: "PM Temp 2 Derating", eq: "thermal", val: d.power_module_temp2, thr: 55 },
        { id: "C03", nm: "PM Temp 3 Derating", eq: "thermal", val: d.power_module_temp3, thr: 55 },
        { id: "C04", nm: "PM Temp 4 Derating", eq: "thermal", val: d.power_module_temp4, thr: 55 },
        { id: "C05", nm: "PM Temp 5 Derating", eq: "thermal", val: d.power_module_temp5, thr: 55 },
        { id: "C06", nm: "Fan Group A (1-4)", eq: "fan", val: null, thr: null },
        { id: "C07", nm: "Fan Group B (5-8)", eq: "fan", val: null, thr: null },
        { id: "C08", nm: "Fan RPM Anomaly", eq: "fan", val: null, thr: null },
        { id: "C09", nm: "Thermal Resistance", eq: "tmgmt", val: null, thr: null },
        { id: "C10", nm: "EdgeBox Temp", eq: "tmgmt", val: d.edgebox_temp, thr: 70 },
        { id: "C11", nm: "Pi5 Temp", eq: "tmgmt", val: d.pi5_temp, thr: 80 },
        { id: "C12", nm: "Ambient + Humidity", eq: "env", val: null, thr: null },
        { id: "C13", nm: "Pressure Drop", eq: "env", val: null, thr: null },
        { id: "C14", nm: "DFC Overdue", eq: "maint", val: null, thr: null },
        { id: "C15", nm: "Energy Throughput", eq: "maint", val: null, thr: null },
    ];

    const equips = [
        { key: "thermal", nm: "🔥 PM Thermal", cnt: "C01–C05 (5)" },
        { key: "fan", nm: "💨 Fan System", cnt: "C06–C08 (3)" },
        { key: "tmgmt", nm: "🌡️ Thermal Mgmt", cnt: "C09–C11 (3)" },
        { key: "env", nm: "🌤️ Environment", cnt: "C12–C13 (2)" },
        { key: "maint", nm: "🔧 Maintenance", cnt: "C14–C15 (2)" },
    ];

    const condStatus = (c: typeof conds[0]) => {
        if (c.thr != null && c.val != null && Number(c.val) >= c.thr) return "WARN";
        return "OK";
    };

    const eqStatus = (eqKey: string) => {
        const anyCrit = conds.filter((c) => c.eq === eqKey).some((c) => condStatus(c) !== "OK");
        return anyCrit ? "WARN" : "OK";
    };

    const treeRef2 = useRef<HTMLDivElement>(null);
    const svgRef2 = useRef<SVGSVGElement>(null);
    const gaugeRef2 = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const draw = () => {
            const wrap = treeRef2.current;
            const svg = svgRef2.current;
            if (!wrap || !svg) return;

            const wR = wrap.getBoundingClientRect();
            if (wR.width === 0) return;

            svg.setAttribute("width", String(wR.width));
            svg.setAttribute("height", String(wR.height));

            const lines: string[] = [];

            // หา gauge column = div สุดท้ายใน wrap
            const allCols = wrap.querySelectorAll(":scope > div");
            const colR = allCols[allCols.length - 1];
            const colRRect = colR?.getBoundingClientRect();

            wrap.querySelectorAll("[data-eq-node]").forEach((eqEl) => {
                const eqKey = (eqEl as HTMLElement).dataset.eqNode!;
                const eqR = eqEl.getBoundingClientRect();
                const eqY = eqR.top + eqR.height / 2 - wR.top;
                const eqX1 = eqR.left - wR.left;
                const eqX2 = eqR.right - wR.left;

                // วาดเส้น condition → equipment
                wrap.querySelectorAll(`[data-cond-eq="${eqKey}"]`).forEach((cEl) => {
                    const cR = cEl.getBoundingClientRect();
                    const cY = cR.top + cR.height / 2 - wR.top;
                    const cX = cR.right - wR.left;
                    const mx = (cX + eqX1) / 2;
                    lines.push(`M ${cX} ${cY} C ${mx} ${cY}, ${mx} ${eqY}, ${eqX1} ${eqY}`);
                });

                // วาดเส้น equipment → gauge
                const gaugeEl = gaugeRef2.current;
                if (gaugeEl) {
                    const gaugeRect = gaugeEl.getBoundingClientRect();
                    const rX = gaugeRect.left - wR.left;
                    const rY = gaugeRect.top + gaugeRect.height / 2 - wR.top;
                    const mx = (eqX2 + rX) / 2;
                    lines.push(`M ${eqX2} ${eqY} C ${mx} ${eqY}, ${mx} ${rY}, ${rX} ${rY}`);
                }
            });

            svg.innerHTML = lines
                .map((d) => `<path d="${d}" fill="none" stroke="#d0dae8" stroke-width="1.5" stroke-dasharray="4,3"/>`)
                .join("");
        };

        const timer = setTimeout(draw, 300);
        window.addEventListener("resize", draw);

        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", draw);
        };
    }, [data]);

    const groups = [
        { key: "thermal", conds: conds.filter((c) => c.eq === "thermal") },
        { key: "fan", conds: conds.filter((c) => c.eq === "fan") },
        { key: "tmgmt", conds: conds.filter((c) => c.eq === "tmgmt") },
        { key: "env", conds: conds.filter((c) => c.eq === "env") },
        { key: "maint", conds: conds.filter((c) => c.eq === "maint") },
    ];

    return (
        <div ref={treeRef2} style={{
            position: "relative", display: "flex",
            alignItems: "stretch", gap: 0, overflow: "visible", paddingBottom: 20,
        }}>
            <svg ref={svgRef2} style={{
                position: "absolute", top: 0, left: 0,
                pointerEvents: "none", zIndex: 1, overflow: "visible",
            }} />

            {/* COL 1 — Conditions */}
            <div style={{ flex: "0 0 280px", zIndex: 2, paddingTop: 6 }}>
                <div style={{ ...S.ct, marginBottom: 6 }}>Conditions (15)</div>
                {groups.map((g) => (
                    <React.Fragment key={g.key}>
                        {g.conds.map((c) => (
                            <div key={c.id} data-cond-eq={c.eq} style={S.cond}>
                                <span style={S.condId}>{c.id}</span>
                                <span style={S.condNm}>{c.nm}</span>
                                <span style={{
                                    fontSize: ".8em", fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                                    color: condStatus(c) === "OK" ? "#34d399" : "#fbbf24",
                                }}>{condStatus(c)}</span>
                            </div>
                        ))}
                        <div style={{ ...S.gs, height: 20 }} />
                    </React.Fragment>
                ))}
            </div>

            {/* COL 2 — Equipment Groups */}
            <div style={{ flex: "0 0 140px", position: "relative", margin: "0 40px", zIndex: 2 }}>
                <div style={{ ...S.ct, marginBottom: 6 }}>Equipment (5)</div>
                {equips.map((eq) => (
                    <div key={eq.key} data-eq-node={eq.key} style={{ ...S.equip, marginBottom: 32 }}>
                        <div style={S.equipNm}>{eq.nm}</div>
                        <div style={S.equipCnt}>{eq.cnt}</div>
                        <span style={{
                            fontSize: ".55em", fontWeight: 700, marginTop: 2, display: "block",
                            color: eqStatus(eq.key) === "OK" ? "#34d399" : "#fbbf24",
                        }}>{eqStatus(eq.key)}</span>
                    </div>
                ))}
            </div>

            {/* COL 3 — Root Cause Gauge */}
            <div
                data-eq-r
                ref={gaugeRef2}
                className="m2-ht-col"
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 0 }}
            >
                <M2SystemGauge data={data} />
            </div>
        </div>
    );
}

export function M2DetectionTab({ data }: M2Props) {
    if (!data) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด...</div>;

    const risk = (data as any).ensemble_risk ?? (data as any).risk_score;
    const modelScores = (data as any).model_scores ?? {};
    const vals = Object.values(modelScores) as number[];
    const normal = vals.filter((v) => v < 0.5).length;
    const warning = vals.filter((v) => v >= 0.5 && v < 0.75).length;
    const alarm = vals.filter((v) => v >= 0.75).length;

    return (
        <div>
            {/* Header */}
            <div style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={S.ct}>
                    <i>🔄</i> Charger Dust Filter — AI Detection
                </div>
                <TypeLegend />
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".62em", fontFamily: "'JetBrains Mono',monospace" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: data.error ? "#ef4444" : "#22c55e" }} />
                    <span style={{ color: "#718096" }}>{data._result_ts ? new Date(data._result_ts).toLocaleTimeString("th-TH") : "—"}</span>
                </div>
            </div>

            <AutoPredictPanel
                badge="done"
                countdown="120s"
                predictedAt={data._result_ts ? new Date(data._result_ts).toLocaleTimeString("th-TH") : undefined}
                result={risk != null ? `${(risk * 100).toFixed(1)}%` : "—"}
            />

            {/* Summary bar */}
            <HealthSummaryBar normal={normal || 6} warning={warning} alarm={alarm} total={6} />

            {/* AI Model Tree */}
            <div style={S.card}>
                <div style={S.ct}><i>🤖</i> AI Model Status Tree</div>
                <M2ModelTree data={data} />
            </div>

            {/* Condition Health Tree */}
            <div style={S.card}>
                <div style={S.ct}><i>🏥</i> Filter Clogging — Condition Health Tree</div>
                <M2ConditionTree data={data} />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// M3 Tree
// ─────────────────────────────────────────────────────────────────────────────
interface M3Props {
    data: ModuleResult | null;
    countdown?: number;
    isPaused?: boolean;
    onTogglePause?: () => void;
}

function M3ModelTree({ data }: M3Props) {
    const scores = (data as any)?.model_scores ?? {};

    const getStatus = (v: number | undefined): "OK" | "WARN" | "CRIT" | "IDLE" => {
        if (v == null) return "IDLE";
        return v >= 0.75 ? "CRIT" : v >= 0.5 ? "WARN" : "OK";
    };

    const models = [
        { id: "A", type: "ml", grp: "cls", name: "XGBoost Root Cause", sub: "Multi-class Classifier", val: scores.A },
        { id: "A2", type: "dl", grp: "cls", name: "DNN Root Cause", sub: "Deep Neural Network", val: scores.A2 },
        { id: "B", type: "ml", grp: "ew", name: "Early Warning", sub: "~2 min Pre-Fault Alert", val: scores.B },
        { id: "C", type: "dl", grp: "ad", name: "Autoencoder", sub: "Reconstruction Anomaly", val: scores.C },
        { id: "D", type: "dl", grp: "ad", name: "BiLSTM-Attention", sub: "Sequence Anomaly", val: scores.D },
        { id: "E", type: "ml", grp: "ad", name: "IF + LOF Ensemble", sub: "Isolation Forest + LOF", val: scores.E },
    ];

    const groups = [
        { key: "cls", label: "🎯 Classification", sub: "Models A, A2", color: "#0ea5e9" },
        { key: "ew", label: "⚠️ Early Warning", sub: "Model B", color: "#d97706" },
        { key: "ad", label: "🔍 Anomaly Detection", sub: "Models C, D, E", color: "#8b5cf6" },
    ];

    const grpStatus = (grpKey: string) => {
        const worst = Math.max(...models.filter((m) => m.grp === grpKey).map((m) => m.val ?? 0));
        return worst >= 0.75 ? "ALARM" : worst >= 0.5 ? "WARN" : "NORMAL";
    };

    const treeRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const gaugeRef3 = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const draw = () => {
            const wrap = treeRef.current;
            const svg = svgRef.current;
            if (!wrap || !svg) return;

            const wR = wrap.getBoundingClientRect();
            if (wR.width === 0) return;

            svg.setAttribute("width", String(wR.width));
            svg.setAttribute("height", String(wR.height));

            const lines: string[] = [];

            // หา gauge column = div สุดท้ายใน wrap
            const allCols = wrap.querySelectorAll(":scope > div");
            const colR = allCols[allCols.length - 1];
            const colRRect = colR?.getBoundingClientRect();

            wrap.querySelectorAll("[data-m3-gn]").forEach((gEl) => {
                const gk = (gEl as HTMLElement).dataset.m3Gn!;
                const gR = gEl.getBoundingClientRect();
                const gY = gR.top + gR.height / 2 - wR.top;
                const gX1 = gR.left - wR.left;
                const gX2 = gR.right - wR.left;

                // วาดเส้น model → group
                wrap.querySelectorAll(`[data-m3-mn="${gk}"]`).forEach((mEl) => {
                    const mR = mEl.getBoundingClientRect();
                    const mY = mR.top + mR.height / 2 - wR.top;
                    const mX = mR.right - wR.left;
                    const mx = (mX + gX1) / 2;
                    lines.push(`M ${mX} ${mY} C ${mx} ${mY}, ${mx} ${gY}, ${gX1} ${gY}`);
                });

                // วาดเส้น group → gauge
                const gaugeEl = gaugeRef3.current;
                if (gaugeEl) {
                    const gaugeRect = gaugeEl.getBoundingClientRect();
                    const rX = gaugeRect.left - wR.left;
                    const rY = gaugeRect.top + gaugeRect.height / 2 - wR.top;
                    const mx = (gX2 + rX) / 2;
                    lines.push(`M ${gX2} ${gY} C ${mx} ${gY}, ${mx} ${rY}, ${rX} ${rY}`);
                }
            });

            svg.innerHTML = lines
                .map((d) => `<path d="${d}" fill="none" stroke="#d0dae8" stroke-width="1.5" stroke-dasharray="4,3"/>`)
                .join("");
        };

        const timer = setTimeout(draw, 300);
        window.addEventListener("resize", draw);

        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", draw);
        };
    }, [data]);

    return (
        <div ref={treeRef} style={{ position: "relative", display: "flex", alignItems: "stretch", overflow: "visible", paddingBottom: 20 }}>
            <svg ref={svgRef} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 1, overflow: "visible" }} />

            {/* COL 1 */}
            <div style={{ flex: "0 0 260px", zIndex: 2, paddingTop: 6 }}>
                <div style={{ ...S.ct, marginBottom: 6 }}>AI Models (6)</div>
                {["cls", "ew", "ad"].map((grpKey) => (
                    <React.Fragment key={grpKey}>
                        {models.filter((m) => m.grp === grpKey).map((m) => (
                            <div key={m.id} data-m3-mn={grpKey} style={S.mn}>
                                <span style={m.type === "ml" ? S.ml : S.dl}>{m.type.toUpperCase()}</span>
                                <span style={S.mnId}>{m.id}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={S.mnName}>{m.name}</div>
                                    <div style={S.mnSub}>{m.sub}</div>
                                </div>
                                <span style={S.mnVal}>{m.val?.toFixed(3) ?? "—"}</span>
                                <StatusBadge st={getStatus(m.val)} />
                            </div>
                        ))}
                        <div style={{ ...S.gs, height: 40 }} />
                    </React.Fragment>
                ))}
            </div>

            {/* COL 2 */}
            <div style={{ flex: "0 0 160px", position: "relative", margin: "0 40px", zIndex: 2 }}>
                <div style={{ ...S.ct, marginBottom: 6 }}>Groups</div>
                {groups.map((g) => (
                    <div key={g.key} data-m3-gn={g.key} style={{ ...S.gn(g.color), marginBottom: 40 }}>
                        <div style={S.gnT}>{g.label}</div>
                        <div style={S.gnC}>{g.sub}</div>
                        <GroupStatus st={grpStatus(g.key)} />
                    </div>
                ))}
            </div>

            {/* COL 3 */}
            <div
                data-m3-r
                ref={gaugeRef3}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 0, zIndex: 2 }}
            >
                <M3StatusGauge data={data} />
            </div>
        </div>
    );
}

function M3StatusGauge({ data }: { data: ModuleResult | null }) {
    const health = data?.health ?? null;
    const onlineCount = (data as any)?.online_count ?? 0;
    const totalDevices = (data as any)?.total_devices ?? 6;
    const rootCause = (data as any)?.root_cause ?? "NORMAL";
    const rcColor: Record<string, string> = {
        NORMAL: "#22c55e", NETWORK_FAILURE: "#dc2626", POWER_OUTAGE: "#dc2626",
        PLC_FAULT: "#d97706", EDGEBOX_CRASH: "#d97706", SCHEDULED_MAINTENANCE: "#0284c7",
    };
    const color = health == null ? "#6b7280" : health >= 80 ? "#22c55e" : health >= 60 ? "#eab308" : "#ef4444";
    const ARC = 351.86;
    const pct = health != null ? Math.max(0, Math.min(100, health)) / 100 : 0;

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", width: 200 }}>
                <svg viewBox="0 0 260 165" style={{ width: 200, height: "auto" }}>
                    <path d="M 20 135 A 110 110 0 0 1 240 135" fill="none" stroke="rgba(0,0,0,.08)" strokeWidth="18" strokeLinecap="round" />
                    <path d="M 20 135 A 110 110 0 0 1 240 135" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
                        strokeDasharray={`${pct * 345.6} 345.6`}
                        style={{ transition: "stroke-dasharray .8s ease, stroke .5s ease", filter: `drop-shadow(0 0 4px ${color}66)` }} />
                </svg>
                <div style={{ position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center" }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.6em", fontWeight: 900, color, lineHeight: 1 }}>
                        {health ?? "—"}%
                    </div>
                    <div style={{ fontSize: ".5em", color: "#718096", fontWeight: 600, marginTop: 1 }}>HEALTH</div>
                </div>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".72em", fontWeight: 800, color: rcColor[rootCause] ?? "#718096" }}>
                {rootCause}
            </div>
            <div style={{ fontSize: ".62em", color: "#718096" }}>
                🟢 {onlineCount}/{totalDevices} online
            </div>
        </div>
    );
}

export function M3DetectionTab({ data }: M3Props) {
    if (!data) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด...</div>;

    const d = (data as any).data ?? {};
    const rootCause = (data as any).root_cause ?? "NORMAL";
    const rcColor: Record<string, string> = {
        NORMAL: "#22c55e", NETWORK_FAILURE: "#dc2626", POWER_OUTAGE: "#dc2626",
        PLC_FAULT: "#d97706", EDGEBOX_CRASH: "#d97706", SCHEDULED_MAINTENANCE: "#0284c7",
    };

    const devices = [
        { key: "edgebox", icon: "💻", name: "EdgeBox", val: d.edgebox_status },
        { key: "router", icon: "📡", name: "Router", val: d.router_status },
        { key: "plc1", icon: "🔌", name: "PLC 1", val: d.PLC1_status },
        { key: "plc2", icon: "🔌", name: "PLC 2", val: d.PLC2_status },
        { key: "mdb", icon: "⚡", name: "MDB", val: d.MDB_status },
        { key: "meter", icon: "📊", name: "Energy Meter", val: d.energy_meter_status },
    ];

    const isActive = (v: string) => ["active", "online", "connected", "1"].includes(String(v).toLowerCase());

    return (
        <div>
            {/* Header */}
            <div style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={S.ct}><i>📡</i> Charger Offline Detection — AI Status Tree</div>
                <TypeLegend />
            </div>

            <AutoPredictPanel
                badge={data.error ? "error" : "done"}
                countdown="120s"
                predictedAt={data._result_ts ? new Date(data._result_ts).toLocaleTimeString("th-TH") : undefined}
                result={rootCause}
            />

            {/* Root cause + device grid */}
            <div style={{ ...S.card, borderTop: `3px solid ${rcColor[rootCause] ?? "#d0dae8"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                    <div>
                        <div style={S.ct}><i>🔍</i> Root Cause</div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.1em", fontWeight: 800, color: rcColor[rootCause] ?? "#718096" }}>
                            {rootCause}
                        </div>
                    </div>
                    {(data as any).early_warning && (
                        <div style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", fontSize: ".65em", fontWeight: 700, color: "#dc2626" }}>
                            ⚠️ Early Warning — ~2 min to fault
                        </div>
                    )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 8 }}>
                    {devices.map((dev) => {
                        const active = dev.val != null && isActive(String(dev.val));
                        return (
                            <div key={dev.key} style={{
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                                padding: "10px 8px", borderRadius: 8,
                                background: active ? "rgba(34,197,94,.05)" : "rgba(239,68,68,.04)",
                                border: `1px solid ${active ? "rgba(34,197,94,.2)" : "rgba(239,68,68,.2)"}`,
                            }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: active ? "#22c55e" : "#ef4444", boxShadow: `0 0 6px ${active ? "#22c55e" : "#ef4444"}88` }} />
                                <div style={{ fontSize: "1.3em" }}>{dev.icon}</div>
                                <div style={{ fontSize: ".6em", fontWeight: 700, textAlign: "center" }}>{dev.name}</div>
                                <div style={{ fontSize: ".55em", fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: active ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", color: active ? "#16a34a" : "#dc2626" }}>
                                    {dev.val ?? "—"}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* AI Model Tree */}
            <div style={S.card}>
                <div style={S.ct}><i>🤖</i> AI Model Status Tree</div>
                <M3ModelTree data={data} />
            </div>

            {/* Condition table */}
            <div style={S.card}>
                <div style={S.ct}><i>📋</i> Condition Reference (C01–C17)</div>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".62em", fontFamily: "'JetBrains Mono',monospace" }}>
                        <thead>
                            <tr style={{ background: "var(--color-background-secondary,#f8fafc)" }}>
                                {["#", "Type", "Condition", "Detection Rule", "Threshold", "Equipment"].map((h) => (
                                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, color: "#718096", borderBottom: "1px solid #d0dae8", whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { id: "C01", tp: "Hybrid", nm: "Voltage Phase A", rule: "VL1N_MDB == 0", thr: "0V = Outage", eq: "AC Power", eqColor: "#d97706" },
                                { id: "C02", tp: "Hybrid", nm: "Voltage Phase B", rule: "VL2N_MDB == 0", thr: "0V = Outage", eq: "AC Power", eqColor: "#d97706" },
                                { id: "C03", tp: "Hybrid", nm: "Voltage Phase C", rule: "VL3N_MDB == 0", thr: "0V = Outage", eq: "AC Power", eqColor: "#d97706" },
                                { id: "C04", tp: "Hybrid", nm: "Current Phase A", rule: "I1_MDB == 0 when V>0", thr: "0A = Off", eq: "AC Power", eqColor: "#d97706" },
                                { id: "C05", tp: "Hybrid", nm: "Current Phase B", rule: "I2_MDB == 0 when V>0", thr: "0A = Off", eq: "AC Power", eqColor: "#d97706" },
                                { id: "C06", tp: "Hybrid", nm: "Current Phase C", rule: "I3_MDB == 0 when V>0", thr: "0A = Off", eq: "AC Power", eqColor: "#d97706" },
                                { id: "C07", tp: "AI", nm: "Edgebox Status", rule: "edgebox == Inactive + AI", thr: "prob>0.5", eq: "Network", eqColor: "#0891b2" },
                                { id: "C08", tp: "AI", nm: "Router Internet", rule: "router_internet + AI", thr: "prob>0.5", eq: "Network", eqColor: "#0891b2" },
                                { id: "C09", tp: "AI", nm: "Router Status", rule: "router == Inactive + AI", thr: "prob>0.5", eq: "Network", eqColor: "#0891b2" },
                                { id: "C10", tp: "AI", nm: "RSSI Signal", rule: "RSSI==0 or >-10 dBm", thr: "<-70 weak", eq: "Network", eqColor: "#0891b2" },
                                { id: "C11", tp: "Rule", nm: "PLC1 Status", rule: "PLC1_status == Inactive", thr: "Inactive", eq: "PLC", eqColor: "#7c3aed" },
                                { id: "C12", tp: "Rule", nm: "PLC2 Status", rule: "PLC2_status == Inactive", thr: "Inactive", eq: "PLC", eqColor: "#7c3aed" },
                                { id: "C13", tp: "Rule", nm: "MDB Status", rule: "MDB_status == Inactive", thr: "Inactive", eq: "MDB", eqColor: "#059669" },
                                { id: "C14", tp: "Rule", nm: "Energy Meter", rule: "energy_meter == Inactive", thr: "Inactive", eq: "MDB", eqColor: "#059669" },
                                { id: "C15", tp: "AI", nm: "Edgebox Temp", rule: "edgebox_temp<30°C", thr: "<30°C", eq: "Thermal", eqColor: "#dc2626" },
                                { id: "C16", tp: "AI", nm: "Pi5 Temp", rule: "pi5_temp>80°C", thr: ">80°C", eq: "Thermal", eqColor: "#dc2626" },
                                { id: "C17", tp: "AI", nm: "Charger Ambient", rule: "charger_temp>55°C", thr: ">55°C", eq: "Thermal", eqColor: "#dc2626" },
                            ].map((row, i) => {
                                const tpBg = row.tp === "Hybrid" ? "rgba(2,132,199,.1)" : row.tp === "AI" ? "rgba(124,58,237,.1)" : "rgba(100,116,139,.08)";
                                const tpColor = row.tp === "Hybrid" ? "#0284c7" : row.tp === "AI" ? "#7c3aed" : "#64748b";
                                return (
                                    <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                                        <td style={{ padding: "5px 8px" }}>
                                            <span style={{ padding: "1px 6px", borderRadius: 4, fontWeight: 700, fontSize: ".9em", background: tpBg, color: tpColor }}>{row.id}</span>
                                        </td>
                                        <td style={{ padding: "5px 8px" }}>
                                            <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: ".85em", fontWeight: 600, background: tpBg, color: tpColor }}>{row.tp}</span>
                                        </td>
                                        <td style={{ padding: "5px 8px", fontWeight: 600 }}>{row.nm}</td>
                                        <td style={{ padding: "5px 8px", color: "#64748b" }}><code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>{row.rule}</code></td>
                                        <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                                            <span style={{ padding: "1px 6px", borderRadius: 4, background: "rgba(100,116,139,.08)", color: "#64748b" }}>{row.thr}</span>
                                        </td>
                                        <td style={{ padding: "5px 8px", color: row.eqColor, fontWeight: 600 }}>{row.eq}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}