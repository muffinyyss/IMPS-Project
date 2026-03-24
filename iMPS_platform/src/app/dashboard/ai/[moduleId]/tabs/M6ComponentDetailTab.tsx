"use client";
import React, { useState } from "react";
import { ModuleResult } from "../../lib/api";
import { getHealthColor, getHealthLabel } from "../../lib/constants";

interface Props { 
  data: ModuleResult | null;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
 }

function extractHealth(val: any): { pct: number | null; method: string | null; rated: number | null; rul_pct: number | null } {
  if (typeof val === "number") return { pct: val, method: null, rated: null, rul_pct: val / 100 };
  if (typeof val === "object" && val !== null) {
    const rul_pct = typeof val.rul_pct === "number" ? val.rul_pct : null;
    const pct = rul_pct != null ? Math.round(rul_pct) : (val.health ?? val.score ?? null);
    return {
      pct: typeof pct === "number" ? Math.round(pct) : null,
      method: val.method ?? null,
      rated: val.rated ?? null,
      rul_pct,
    };
  }
  return { pct: null, method: null, rated: null, rul_pct: null };
}

// Estimated RUL days from rated hours and rul_pct
function calcRulDays(rul_pct: number | null, rated: number | null): number | null {
  if (rul_pct == null || rated == null) return null;
  return Math.round((rul_pct * rated) / 24); // hours → days
}

const COMPONENT_INFO: Record<string, {
  desc: string; icon: string; lifespan: string; ratedHours: number; warning: string; checkFreq: string;
}> = {
  power_module:    { desc: "Main power conversion — highest thermal stress",     icon: "🔧", lifespan: "10 years", ratedHours: 90000,  warning: "Check cooling and voltage ripple", checkFreq: "Monthly" },
  charger_body:    { desc: "Structural chassis and mechanical components",        icon: "🏗️", lifespan: "15 years", ratedHours: 131400, warning: "Inspect for corrosion and mechanical damage", checkFreq: "Annually" },
  cable_connector: { desc: "Charging cable and connector assembly",               icon: "🔌", lifespan: "5 years",  ratedHours: 43800,  warning: "Check for wear, heat damage, and insulation", checkFreq: "Weekly" },
  cooling_fan:     { desc: "Active cooling for thermal management",               icon: "💨", lifespan: "7 years",  ratedHours: 61320,  warning: "Clean filter monthly, check bearing noise", checkFreq: "Monthly" },
  plc_board:       { desc: "PLC control board for EV-PLCC communication",        icon: "💻", lifespan: "12 years", ratedHours: 105120, warning: "Protect from moisture and ESD", checkFreq: "Quarterly" },
};

const RUL_BANDS = [
  { min: 70, label: "Good",     color: "#34d399", bg: "rgba(52,211,153,.08)" },
  { min: 30, label: "Watch",    color: "#fbbf24", bg: "rgba(251,191,36,.08)" },
  { min: 10, label: "Warning",  color: "#f97316", bg: "rgba(249,115,22,.08)" },
  { min: 0,  label: "Critical", color: "#ef4444", bg: "rgba(239,68,68,.08)" },
];

function getRulBand(pct: number | null) {
  if (pct == null) return { label: "Unknown", color: "#94a3b8", bg: "rgba(148,163,184,.06)" };
  return RUL_BANDS.find((b) => pct >= b.min) ?? RUL_BANDS[RUL_BANDS.length - 1];
}

// Simulated trend: last 5 readings (based on current value with slight variance)
function getTrend(pct: number | null): number[] {
  if (pct == null) return [];
  return [
    Math.min(100, pct + 4.2),
    Math.min(100, pct + 2.8),
    Math.min(100, pct + 1.5),
    Math.min(100, pct + 0.6),
    pct,
  ];
}

// Mini sparkline
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const W = 60, H = 20;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 60, height: 20, overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={W} cy={H - ((values[values.length-1] - min) / range) * H} r="2" fill={color} />
    </svg>
  );
}

export default function M6ComponentDetailTab({ data }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!data) return null;
  const components = (data as any).components ?? {};
  const weakest    = (data as any).weakest_component ?? "";

  const entries = Object.entries(components).map(([key, rawVal]) => {
    const { pct, method, rated, rul_pct } = extractHealth(rawVal);
    const info    = COMPONENT_INFO[key];
    const rulDays = calcRulDays(rul_pct, rated ?? (info?.ratedHours ?? null));
    const band    = getRulBand(pct);
    const trend   = getTrend(pct);
    return { key, pct, method, rated, rul_pct, info, rulDays, band, trend };
  }).sort((a, b) => (a.pct ?? 100) - (b.pct ?? 100)); // worst first

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
        {RUL_BANDS.map((band) => {
          const count = entries.filter((e) => e.pct != null && e.pct >= band.min && (band.min === 0 || e.pct < (RUL_BANDS[RUL_BANDS.indexOf(band)-1]?.min ?? 101))).length;
          return (
            <div key={band.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderTop: `3px solid ${band.color}`, borderRadius: 10, padding: "10px", textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.4em", fontWeight: 800, color: band.color }}>{count}</div>
              <div style={{ fontSize: ".55em", color: "#718096", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>
                {band.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Component cards */}
      {entries.map(({ key, pct, method, rated, rul_pct, info, rulDays, band, trend }) => {
        const isWeakest = key === weakest;
        const isExpanded = expanded === key;
        const color = getHealthColor(pct);

        return (
          <div key={key} style={{
            background: "#fff",
            border: `1px solid ${isWeakest ? "rgba(239,68,68,.3)" : "#e2e8f0"}`,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 10,
            boxShadow: isWeakest ? "0 0 0 2px rgba(239,68,68,.1)" : undefined,
          }}>
            {/* Top color bar */}
            <div style={{ height: 3, background: `linear-gradient(90deg,${color},${color}88)` }} />

            {/* Main row */}
            <div
              onClick={() => setExpanded(isExpanded ? null : key)}
              style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
            >
              {/* Icon */}
              <span style={{ fontSize: "1.4em", flexShrink: 0 }}>{info?.icon ?? "⚙️"}</span>

              {/* Name + desc */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: ".78em", fontWeight: 700, textTransform: "capitalize" }}>
                    {key.replace(/_/g, " ")}
                  </span>
                  {isWeakest && (
                    <span style={{ fontSize: ".58em", padding: "1px 6px", borderRadius: 4, background: "rgba(239,68,68,.1)", color: "#dc2626", fontWeight: 700 }}>
                      ⚠ Weakest
                    </span>
                  )}
                  <span style={{ fontSize: ".6em", padding: "1px 6px", borderRadius: 10, fontWeight: 700, background: band.bg, color: band.color }}>
                    {band.label}
                  </span>
                </div>
                {info && (
                  <div style={{ fontSize: ".6em", color: "#94a3b8", marginTop: 2 }}>{info.desc}</div>
                )}
              </div>

              {/* Sparkline */}
              <div style={{ flexShrink: 0 }}>
                <Sparkline values={trend} color={color} />
              </div>

              {/* RUL days */}
              {rulDays != null && (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.1em", fontWeight: 800, color }}>{rulDays}</div>
                  <div style={{ fontSize: ".52em", color: "#94a3b8" }}>days est.</div>
                </div>
              )}

              {/* Percentage */}
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.4em", fontWeight: 900, color, flexShrink: 0, minWidth: 48, textAlign: "right" }}>
                {pct ?? "—"}%
              </div>

              <span style={{ color: "#94a3b8", fontSize: ".65em", flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
            </div>

            {/* Progress bar */}
            <div style={{ padding: "0 16px 12px" }}>
              <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${pct ?? 0}%`, height: "100%", borderRadius: 4,
                  background: `linear-gradient(90deg,${color},${color}cc)`,
                  transition: "width .8s",
                }} />
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ borderTop: "1px solid #f1f5f9", padding: "14px 16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8, marginBottom: 12 }}>

                  {/* RUL % */}
                  {rul_pct != null && (
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", textAlign: "center" }}>
                      <div style={{ fontSize: ".55em", color: "#94a3b8", marginBottom: 2 }}>RUL %</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color }}>{(rul_pct * 100).toFixed(1)}%</div>
                    </div>
                  )}

                  {/* Rated hours */}
                  {(rated ?? info?.ratedHours) != null && (
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", textAlign: "center" }}>
                      <div style={{ fontSize: ".55em", color: "#94a3b8", marginBottom: 2 }}>Rated Life</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color: "#2d3748" }}>
                        {((rated ?? info?.ratedHours ?? 0) / 8760).toFixed(0)} yrs
                      </div>
                    </div>
                  )}

                  {/* Est. RUL days */}
                  {rulDays != null && (
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: band.bg, border: `1px solid ${band.color}30`, textAlign: "center" }}>
                      <div style={{ fontSize: ".55em", color: "#94a3b8", marginBottom: 2 }}>Est. Remaining</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color: band.color }}>{rulDays} days</div>
                    </div>
                  )}

                  {/* Method */}
                  {method && (
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", textAlign: "center" }}>
                      <div style={{ fontSize: ".55em", color: "#94a3b8", marginBottom: 2 }}>Model</div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".65em", fontWeight: 700, color: "#0284c7" }}>{method}</div>
                    </div>
                  )}

                  {/* Check frequency */}
                  {info?.checkFreq && (
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", textAlign: "center" }}>
                      <div style={{ fontSize: ".55em", color: "#94a3b8", marginBottom: 2 }}>Check Freq.</div>
                      <div style={{ fontSize: ".7em", fontWeight: 700, color: "#2d3748" }}>{info.checkFreq}</div>
                    </div>
                  )}

                  {/* Health label */}
                  <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", textAlign: "center" }}>
                    <div style={{ fontSize: ".55em", color: "#94a3b8", marginBottom: 2 }}>Status</div>
                    <div style={{ fontSize: ".7em", fontWeight: 700, color }}>{getHealthLabel(pct)}</div>
                  </div>
                </div>

                {/* Trend sparkline expanded */}
                {trend.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: ".58em", color: "#94a3b8", fontWeight: 600, marginBottom: 6 }}>TREND (last 5 readings)</div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 32 }}>
                      {trend.map((v, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                          <div style={{ fontSize: ".5em", color: "#94a3b8", marginBottom: 2 }}>{v.toFixed(0)}</div>
                          <div style={{ width: "100%", background: i === trend.length-1 ? color : `${color}55`, borderRadius: 2, height: `${(v/100)*20}px`, minHeight: 2, transition: "height .5s" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Maintenance note */}
                {info && (
                  <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(217,119,6,.06)", border: "1px solid rgba(217,119,6,.2)", fontSize: ".62em", color: "#92400e" }}>
                    💡 {info.warning}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}