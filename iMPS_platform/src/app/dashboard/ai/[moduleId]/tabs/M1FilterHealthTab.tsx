"use client";
import React from "react";
import { ModuleResult } from "../../lib/api";
import { getHealthColor } from "../../lib/constants";
import { AutoPredictPanel, DetCard, DetTitle } from "./DetectionLayout";

interface Props {
  data: ModuleResult | null;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
  
}

// ── 270° Ring Gauge (matches original m1-gauge-wrap, circumference=368, maxArc=245) ─
function RingGauge({ risk }: { risk: number | null }) {
  const CRC     = 368;
  const MAX_ARC = 245;
  const pct    = risk != null ? Math.max(0, Math.min(risk, 1)) : 0;
  const offset = CRC - pct * MAX_ARC;

  const color =
    risk == null    ? "#6b7280"
    : risk < 0.25   ? "#22c55e"
    : risk < 0.50   ? "#eab308"
    : risk < 0.75   ? "#f97316"
    : "#ef4444";

  const label =
    risk == null    ? "Waiting…"
    : risk < 0.25   ? "Clean"
    : risk < 0.50   ? "Moderate"
    : risk < 0.75   ? "Degraded"
    : "Clogged";

  const riskPct = risk != null ? `${(risk * 100).toFixed(1)}%` : "--";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: ".62em", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "#718096" }}>
        Clogging Risk
      </div>
      <div style={{ position: "relative", width: 160, height: 160 }}>
        <svg viewBox="0 0 180 180" style={{ width: 160, height: 160 }}>
          {/* Background circle */}
          <circle
            cx="90" cy="90" r="78"
            fill="none"
            stroke="#d0dae8"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="368"
            strokeDashoffset="122"
          />
          {/* Foreground circle */}
          <circle
            cx="90" cy="90" r="78"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="368"
            strokeDashoffset={String(offset)}
            style={{
              transition: "stroke-dashoffset .8s ease, stroke .5s ease",
              filter: `drop-shadow(0 0 4px ${color}66)`,
              transformOrigin: "center",
              transform: "rotate(-135deg)",
            }}
          />
        </svg>

        {/* Center text overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "1.8em",
            fontWeight: 900,
            lineHeight: 1,
            color,
          }}>
            {riskPct}
          </div>
          <div style={{ fontSize: ".6em", fontWeight: 700, color: "#718096", marginTop: 2 }}>
            Risk Score
          </div>
          <div style={{ fontSize: ".65em", fontWeight: 800, color, marginTop: 2 }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Env card (.m1-env pattern) ────────────────────────────────────────────
function EnvItem({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: string;
  label: string;
  value: string | number | null;
  unit: string;
  color: string;
}) {
  return (
    <div style={{
      background: "#f8fafc",
      border: "1px solid #d0dae8",
      borderRadius: 10,
      padding: "10px 12px",
      borderLeft: `3px solid ${color}`,
      display: "flex",
      flexDirection: "column",
      gap: 2,
    }}>
      <div style={{ fontSize: ".6em", color: "#718096", fontWeight: 600 }}>
        {icon} {label}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "1.2em",
        fontWeight: 800,
        color,
        lineHeight: 1,
      }}>
        {value ?? "--"}
      </div>
      <div style={{ fontSize: ".55em", color: "#94a3b8" }}>{unit}</div>
    </div>
  );
}

// ── Filter age progress bar ────────────────────────────────────────────────
function FilterAgeBar({ days }: { days: number | null }) {
  const MAX_DAYS = 720;
  const pct   = days != null ? Math.min(100, (days / MAX_DAYS) * 100) : 0;
  const color = pct < 50 ? "#22c55e" : pct < 75 ? "#eab308" : "#ef4444";

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: ".58em",
        color: "#718096",
        marginBottom: 4,
      }}>
        <span>Filter Age</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
          {days ?? "--"} days
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#d0dae8", overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 3,
          background: `linear-gradient(90deg, #22c55e, ${color})`,
          transition: "width .8s",
        }} />
      </div>
    </div>
  );
}

// ── Model result chip ─────────────────────────────────────────────────────
function ResultChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: 8,
      textAlign: "center",
      background: "#f8fafc",
      border: "1px solid #d0dae8",
    }}>
      <div style={{ fontSize: ".58em", color: "#718096", fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "1.4em",
        fontWeight: 800,
        color,
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function M1FilterHealthTab({ data }: Props) {
  if (!data) {
    return (
      <div style={{
        padding: 40,
        textAlign: "center",
        color: "#94a3b8",
        fontSize: ".8em",
      }}>
        กำลังโหลด...
      </div>
    );
  }

  const t    = (data as any).telemetry ?? {};
  const risk = (data as any).ensemble_risk ?? (data as any).risk_score ?? null;

  const tdiff =
    t.pi5_temp != null && t.MDB_ambient_temp != null
      ? (Number(t.pi5_temp) - Number(t.MDB_ambient_temp)).toFixed(1)
      : null;

  const latencyDisplay =
    (data as any)._processing_ms != null
      ? `${(data as any)._processing_ms}ms`
      : "—";

  const riskDisplay =
    risk != null ? `${(risk * 100).toFixed(1)}%` : "—";

  const ensembleColor = getHealthColor(
    risk != null ? Math.round((1 - risk) * 100) : null
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* DB status bar */}
      <div style={{
        padding: "8px 14px",
        marginBottom: 12,
        borderRadius: 10,
        background: "#fff",
        border: "1px solid #d0dae8",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: ".68em",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <span style={{ color: "#718096" }}>🗄</span>
        <span style={{ color: data.error ? "#dc2626" : "#059669", fontWeight: 700 }}>
          {data.error ? "Connection error" : "Connected"}
        </span>
        <span style={{ opacity: .3 }}>|</span>
        <span style={{ color: "#718096" }}>
          module1MdbDustPrediction · {(data as any).source ?? "mongodb"}
        </span>
      </div>

      {/* Auto-predict panel */}
      <AutoPredictPanel
        badge={(data as any).status === "ok" ? "done" : "IDLE"}
        countdown="120s"
        predictedAt={
          data._result_ts
            ? new Date(data._result_ts).toLocaleTimeString("th-TH")
            : undefined
        }
        latency={latencyDisplay}
        result={riskDisplay}
      />

      {/* Hero: gauge + env grid */}
      <DetCard accent="#059669">
        <div style={{
          display: "grid",
          gridTemplateColumns: "200px 1fr",
          gap: 20,
          alignItems: "start",
        }}>
          {/* Left: gauge + filter bar */}
          <div>
            <RingGauge risk={risk} />
            <FilterAgeBar days={t.dust_filter_charging ?? null} />
          </div>

          {/* Right: env grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 8,
          }}>
            <EnvItem
              icon="🌡️" label="MDB Ambient Temp"
              value={t.MDB_ambient_temp}  unit="°C"
              color="#ef4444"
            />
            <EnvItem
              icon="🤖" label="Pi5 CPU Temp"
              value={t.pi5_temp}           unit="°C"
              color="#f97316"
            />
            <EnvItem
              icon="💧" label="Humidity"
              value={t.MDB_humidity}       unit="%RH"
              color="#3b82f6"
            />
            <EnvItem
              icon="🔵" label="Pressure"
              value={t.MDB_pressure}       unit="hPa"
              color="#8b5cf6"
            />
            <EnvItem
              icon="🔥" label="Temp Differential"
              value={tdiff}                unit="°C (Pi5 − Ambient)"
              color="#0891b2"
            />
            <EnvItem
              icon="🟢" label="MDB Status"
              value={t.MDB_status}         unit="Online / Offline"
              color="#16a34a"
            />
            <EnvItem
              icon="⚡" label="Meter 1"
              value={t.meter1}             unit="Wh"
              color="#d97706"
            />
            <EnvItem
              icon="⚡" label="Meter 2"
              value={t.meter2}             unit="Wh"
              color="#d97706"
            />
          </div>
        </div>
      </DetCard>

      {/* Ensemble decision */}
      {!data.error && (
        <DetCard accent="#059669">
          <DetTitle>🎯 Ensemble Decision</DetTitle>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            marginBottom: 12,
          }}>
            <ResultChip
              label="Risk Score"
              value={riskDisplay}
              color={ensembleColor}
            />
            <ResultChip
              label="Status"
              value={
                risk == null   ? "—"
                : risk < 0.25  ? "Clean"
                : risk < 0.50  ? "Moderate"
                : risk < 0.75  ? "Degraded"
                : "Clogged"
              }
              color={ensembleColor}
            />
            <ResultChip
              label="Confidence"
              value={
                (data as any).confidence != null
                  ? `${((data as any).confidence * 100).toFixed(1)}%`
                  : "—"
              }
              color="#0284c7"
            />
          </div>

          {/* Individual AI model scores */}
          {(data as any).model_results && (
            <div>
              <div style={{
                fontSize: ".6em",
                fontWeight: 700,
                color: "#718096",
                textTransform: "uppercase",
                letterSpacing: "2px",
                marginBottom: 8,
              }}>
                Model Breakdown
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                gap: 6,
              }}>
                {Object.entries((data as any).model_results as Record<string, any>).map(([k, v]) => {
                  const score = typeof v === "number" ? v : (v as any)?.score ?? null;
                  const c = score != null
                    ? score > 0.75 ? "#ef4444" : score > 0.5 ? "#d97706" : "#22c55e"
                    : "#94a3b8";
                  return (
                    <div key={k} style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      textAlign: "center",
                      background: "#f8fafc",
                      border: "1px solid #d0dae8",
                    }}>
                      <div style={{ fontSize: ".55em", color: "#718096", fontWeight: 700, marginBottom: 2 }}>
                        {k}
                      </div>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: ".9em",
                        fontWeight: 800,
                        color: c,
                      }}>
                        {score != null ? score.toFixed(3) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(data as any).method && (
            <div style={{
              marginTop: 10,
              fontSize: ".62em",
              color: "#94a3b8",
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Method: {(data as any).method}
            </div>
          )}
        </DetCard>
      )}

      {/* Thresholds reference */}
      <DetCard>
        <DetTitle>📊 Risk Thresholds</DetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { range: "ensemble_risk &lt; 0.25", label: "✓ NORMAL — Clean",    bg: "rgba(34,197,94,.08)",  color: "#16a34a", border: "rgba(34,197,94,.2)"  },
            { range: "ensemble_risk &lt; 0.50", label: "✓ OK — Moderate",     bg: "rgba(34,197,94,.06)",  color: "#16a34a", border: "rgba(34,197,94,.15)" },
            { range: "ensemble_risk &lt; 0.75", label: "⚠ WARN — Degraded",   bg: "rgba(217,119,6,.08)",  color: "#d97706", border: "rgba(217,119,6,.2)"  },
            { range: "ensemble_risk ≥ 0.75",    label: "✕ CRIT — Clogged",    bg: "rgba(239,68,68,.08)",  color: "#dc2626", border: "rgba(239,68,68,.2)"  },
          ].map((row) => (
            <div key={row.label} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 10px",
              borderRadius: 6,
              background: row.bg,
              border: `1px solid ${row.border}`,
            }}>
              <code style={{
                fontSize: ".6em",
                fontFamily: "'JetBrains Mono', monospace",
                color: "#64748b",
              }}
                dangerouslySetInnerHTML={{ __html: row.range }}
              />
              <span style={{
                fontSize: ".62em",
                fontWeight: 700,
                color: row.color,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {row.label}
              </span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: ".6em", color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>
          System Health Weight: <strong style={{ color: "#059669" }}>12%</strong>
        </div>
      </DetCard>
    </div>
  );
}