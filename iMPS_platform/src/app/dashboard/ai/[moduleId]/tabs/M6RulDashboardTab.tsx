"use client";
import React from "react";
import { ModuleResult } from "../../lib/api";
import { HealthGaugeSvg } from "../../components/ui";
import { getHealthColor, getHealthLabel } from "../../lib/constants";
import { AutoPredictPanel } from "./DetectionLayout";

interface Props {
  data: ModuleResult | null;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

function extractRul(val: any): { pct: number | null; method: string | null; rated: number | null } {
  if (typeof val === "number") return { pct: val, method: null, rated: null };
  if (typeof val === "object" && val !== null)
    return { pct: typeof val.rul_pct === "number" ? Math.round(val.rul_pct) : null, method: val.method ?? null, rated: val.rated ?? null };
  return { pct: null, method: null, rated: null };
}

const COMP_INFO: Record<string, { icon: string; desc: string; lifespan: string; note: string }> = {
  power_module: { icon: "🔧", desc: "Main power conversion unit, highest thermal stress", lifespan: "10 years", note: "Check cooling and voltage ripple" },
  charger_body: { icon: "🏗️", desc: "Structural chassis and mechanical components", lifespan: "15 years", note: "Inspect for corrosion and mechanical damage" },
  cable_connector: { icon: "🔌", desc: "Charging cable and connector assembly", lifespan: "5 years", note: "Check wear, heat damage, and insulation" },
  cooling_fan: { icon: "💨", desc: "Active cooling system for thermal management", lifespan: "7 years", note: "Clean filter monthly, check bearing noise" },
  plc_board: { icon: "💻", desc: "PLC control board for EV-PLCC communication", lifespan: "12 years", note: "Protect from moisture and ESD" },
};

function CompCard({ name, pct, method, rated, isWeakest }: {
  name: string; pct: number | null; method: string | null; rated: number | null; isWeakest: boolean;
}) {
  const info = COMP_INFO[name];
  const color = pct != null ? (pct >= 70 ? "#34d399" : pct >= 30 ? "#fbbf24" : pct >= 10 ? "#f97316" : "#ef4444") : "#94a3b8";
  const label = getHealthLabel(pct);
  const maintP = pct == null ? "UNKNOWN" : pct < 10 ? "CRITICAL" : pct < 30 ? "HIGH" : pct < 70 ? "MEDIUM" : "LOW";
  const mc: Record<string, string> = { CRITICAL: "#dc2626", HIGH: "#f97316", MEDIUM: "#d97706", LOW: "#22c55e", UNKNOWN: "#94a3b8" };
  return (
    <div style={{ background: "#fff", border: `1px solid ${isWeakest ? "rgba(239,68,68,.35)" : "#d0dae8"}`, borderRadius: 12, overflow: "hidden", boxShadow: isWeakest ? "0 0 0 2px rgba(239,68,68,.1)" : undefined }}>
      <div style={{ height: 4, background: `linear-gradient(90deg,${color},${color}88)` }} />
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.3em" }}>{info?.icon ?? "⚙️"}</span>
            <div>
              <div style={{ fontSize: ".78em", fontWeight: 700, textTransform: "capitalize" }}>{name.replace(/_/g, " ")}</div>
              {info && <div style={{ fontSize: ".58em", color: "#94a3b8" }}>{info.desc}</div>}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.4em", fontWeight: 900, color, lineHeight: 1 }}>{pct ?? "—"}%</div>
            <div style={{ fontSize: ".55em", color, fontWeight: 700 }}>{label}</div>
          </div>
        </div>
        <div style={{ height: 8, background: "#d0dae8", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ width: `${pct ?? 0}%`, height: "100%", borderRadius: 4, background: `linear-gradient(90deg,${color},${color}cc)`, transition: "width .8s ease" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          {info && (
            <div style={{ padding: "6px 8px", borderRadius: 6, fontSize: ".6em", background: "#f8fafc", border: "1px solid #d0dae8" }}>
              <div style={{ color: "#94a3b8", marginBottom: 1 }}>Rated Lifespan</div>
              <div style={{ fontWeight: 700, color: "#2d3748" }}>{info.lifespan}</div>
            </div>
          )}
          <div style={{ padding: "6px 8px", borderRadius: 6, fontSize: ".6em", background: `${mc[maintP]}08`, border: `1px solid ${mc[maintP]}25` }}>
            <div style={{ color: "#94a3b8", marginBottom: 1 }}>Maintenance</div>
            <div style={{ fontWeight: 800, color: mc[maintP] }}>{maintP}</div>
          </div>
        </div>
        {(method || rated != null) && (
          <div style={{ fontSize: ".58em", color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace" }}>
            {method && <span>Model: {method}</span>}{method && rated && <span style={{ margin: "0 6px", opacity: .4 }}>|</span>}{rated != null && <span>Rated: {rated}h</span>}
          </div>
        )}
        {isWeakest && (
          <div style={{ marginTop: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", fontSize: ".6em", fontWeight: 700, color: "#dc2626" }}>⚠ Weakest component — schedule maintenance</div>
        )}
        {info && (
          <div style={{ marginTop: 6, fontSize: ".58em", color: "#94a3b8" }}>💡 {info.note}</div>
        )}
      </div>
    </div>
  );
}

export default function M6RulDashboardTab({ data, countdown, isPaused, onTogglePause }: Props) {
  if (!data || data.error) return (
    <div style={{ padding: 40, textAlign: "center", color: "#718096", fontSize: ".8em" }}>ไม่มีข้อมูล RUL</div>
  );
  const d = data as any;
  const comps = d.components ?? {};
  const weakest = d.weakest_component ?? "";
  const sysHealth = d.system_health ?? d.avg_health ?? null;
  const latency = d._processing_ms != null ? `${d._processing_ms}ms` : "—";

  return (
    <div>
      <AutoPredictPanel
        badge="done"
        countdown={countdown}
        enabled={!isPaused}
        onToggle={onTogglePause}
        predictedAt={data._result_ts ? new Date(data._result_ts).toLocaleTimeString("th-TH") : undefined}
        latency={latency}
        result={sysHealth != null ? `${sysHealth}%` : "—"}
      />

      {/* System health + legend */}
      <div style={{ background: "#fff", border: "1px solid #d0dae8", borderRadius: 12, padding: 16, marginBottom: 14, borderTop: "3px solid #dc2626" }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 20, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <HealthGaugeSvg health={sysHealth} size={110} />
            <div style={{ fontSize: ".62em", fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "1px" }}>System Health</div>
          </div>
          <div>
            {/* Legend */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {[["#34d399", ">70% Good"], ["#fbbf24", "30–70% Watch"], ["#f97316", "10–30% Warning"], ["#ef4444", "<10% Critical"]].map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: ".6em", fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: "inline-block" }} />{l}
                </div>
              ))}
            </div>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              {[
                { label: "System Health", val: sysHealth, h: sysHealth },
                { label: "Avg Health", val: d.avg_health, h: d.avg_health },
              ].map((item) => (
                <div key={item.label} style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #d0dae8", textAlign: "center" }}>
                  <div style={{ fontSize: ".58em", color: "#94a3b8" }}>{item.label}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.3em", fontWeight: 800, color: getHealthColor(item.h ?? null) }}>{item.val ?? "—"}%</div>
                </div>
              ))}
            </div>
            {weakest && (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.2em" }}>⚠</span>
                <div>
                  <div style={{ fontSize: ".65em", color: "#94a3b8" }}>Weakest Component</div>
                  <div style={{ fontSize: ".8em", fontWeight: 800, color: "#dc2626", textTransform: "capitalize" }}>{weakest.replace(/_/g, " ")}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Component cards */}
      {/* ── Category Grid (12 groups) ── */}
      <div style={{ background: "#fff", border: "1px solid #d0dae8", borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: ".62em", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2.5px", color: "#718096", marginBottom: 12 }}>
          📊 Component Health by Category (12 Groups)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 8 }}>
          {[
            { cat: "⚡ DC Contactors", count: 6, method: "Cycle", keys: ["dc_contactor"] },
            { cat: "🔌 AC Contactors", count: 2, method: "Cycle", keys: ["ac_contactor"] },
            { cat: "🔋 Power Modules", count: 5, method: "Arrhenius", keys: ["power_module"] },
            { cat: "🌀 DC Fans", count: 8, method: "Arrhenius", keys: ["cooling_fan", "dc_fan"] },
            { cat: "📡 Router", count: 1, method: "Arrhenius", keys: ["router"] },
            { cat: "🖥️ Raspberry Pi5", count: 1, method: "Arrhenius", keys: ["raspberry_pi", "pi5"] },
            { cat: "🔌 PLCs", count: 2, method: "Arrhenius", keys: ["plc_board", "plc"] },
            { cat: "📊 Energy Meters", count: 2, method: "Arrhenius", keys: ["energy_meter"] },
            { cat: "📦 Edgebox", count: 1, method: "Arrhenius", keys: ["edgebox"] },
            { cat: "⚡ Power Supply", count: 1, method: "Arrhenius", keys: ["power_supply"] },
            { cat: "🛡️ Insulation Monitors", count: 2, method: "Arrhenius", keys: ["insulation_monitor"] },
            { cat: "⚡ Switching PSU", count: 1, method: "Arrhenius", keys: ["switching_psu"] },
          ].map((item) => {
            // หาค่า health จาก components ที่ตรงกับ keys
            const matchedVals = Object.entries(comps)
              .filter(([k]) => item.keys.some((ik) => k.toLowerCase().includes(ik)))
              .map(([, v]) => extractRul(v).pct)
              .filter((v): v is number => v != null);
            const avgPct = matchedVals.length > 0
              ? Math.round(matchedVals.reduce((a, b) => a + b, 0) / matchedVals.length)
              : null;
            const color = avgPct == null ? "#94a3b8" : avgPct >= 70 ? "#34d399" : avgPct >= 30 ? "#fbbf24" : avgPct >= 10 ? "#f97316" : "#ef4444";
            const methodBg = item.method === "Cycle" ? "rgba(56,189,248,.12)" : "rgba(251,146,60,.12)";
            const methodColor = item.method === "Cycle" ? "#38bdf8" : "#fb923c";

            return (
              <div key={item.cat} style={{ padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #d0dae8", borderTop: `3px solid ${color}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: ".68em", fontWeight: 700, color: "#2d3748" }}>{item.cat}</div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1em", fontWeight: 900, color }}>{avgPct ?? "—"}%</span>
                </div>
                <div style={{ height: 5, background: "#d0dae8", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${avgPct ?? 0}%`, height: "100%", background: color, borderRadius: 3, transition: "width .8s" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: ".55em", fontFamily: "'JetBrains Mono',monospace", padding: "1px 6px", borderRadius: 4, background: methodBg, color: methodColor, fontWeight: 600 }}>
                    {item.method}
                  </span>
                  <span style={{ fontSize: ".55em", color: "#94a3b8" }}>×{item.count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Maintenance Priority (Top 5) ── */}
      <div style={{ background: "#fff", border: "1px solid #d0dae8", borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: ".62em", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2.5px", color: "#718096", marginBottom: 12 }}>
          🔧 Maintenance Priority — Top 5 Components to Watch
        </div>
        {(() => {
          const sorted = Object.entries(comps)
            .map(([k, v]) => ({ key: k, ...extractRul(v) }))
            .filter((c) => c.pct != null)
            .sort((a, b) => (a.pct ?? 100) - (b.pct ?? 100))
            .slice(0, 5);

          if (!sorted.length) return (
            <div style={{ textAlign: "center", color: "#94a3b8", fontSize: ".65em", padding: "20px", fontStyle: "italic" }}>
              Waiting for prediction data…
            </div>
          );

          return sorted.map((comp, i) => {
            const color = comp.pct != null ? (comp.pct >= 70 ? "#34d399" : comp.pct >= 30 ? "#fbbf24" : comp.pct >= 10 ? "#f97316" : "#ef4444") : "#94a3b8";
            const pri = i === 0 ? "URGENT" : i === 1 ? "HIGH" : i === 2 ? "MEDIUM" : "LOW";
            const priBg = pri === "URGENT" ? "rgba(239,68,68,.1)" : pri === "HIGH" ? "rgba(249,115,22,.1)" : pri === "MEDIUM" ? "rgba(234,179,8,.1)" : "rgba(34,197,94,.08)";
            const priC = pri === "URGENT" ? "#dc2626" : pri === "HIGH" ? "#f97316" : pri === "MEDIUM" ? "#d97706" : "#16a34a";

            return (
              <div key={comp.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, marginBottom: 6, background: "#f8fafc", border: "1px solid #d0dae8" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".7em", fontWeight: 800, color: "#94a3b8", width: 16, flexShrink: 0 }}>
                  #{i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: ".72em", fontWeight: 700, textTransform: "capitalize", marginBottom: 3 }}>
                    {comp.key.replace(/_/g, " ")}
                  </div>
                  <div style={{ height: 4, background: "#d0dae8", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${comp.pct ?? 0}%`, height: "100%", background: color, borderRadius: 2, transition: "width .8s" }} />
                  </div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".82em", fontWeight: 800, color, flexShrink: 0, minWidth: 36, textAlign: "right" }}>
                  {comp.pct}%
                </div>
                <span style={{ fontSize: ".6em", fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: priBg, color: priC, flexShrink: 0 }}>
                  {pri}
                </span>
              </div>
            );
          });
        })()}
      </div>
      <div style={{ fontSize: ".62em", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2.5px", color: "#718096", marginBottom: 10 }}>🔧 Component RUL Health</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
        {Object.entries(comps).map(([key, val]) => {
          const { pct, method, rated } = extractRul(val);
          return <CompCard key={key} name={key} pct={pct} method={method} rated={rated} isWeakest={key === weakest} />;
        })}
      </div>
    </div>
  );
}