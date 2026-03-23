"use client";
import React from "react";

// ── Auto-predict panel (.m3-ap pattern) ──────────────────────────────────
export function AutoPredictPanel({
  badge = "IDLE",
  countdown = "OFF",
  enabled = true,
  queriedAt,
  predictedAt,
  latency,
  result,
  onToggle,
}: {
  badge?: "IDLE" | "running" | "done" | "error";
  countdown?: string | number;
  enabled?: boolean;
  queriedAt?: string;
  predictedAt?: string;
  latency?: string;
  result?: string;
  onToggle?: () => void;
}) {
  const badgeStyle: React.CSSProperties = {
    padding: "2px 10px",
    borderRadius: 6,
    fontSize: ".62em",
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    background:
      badge === "running" ? "rgba(2,132,199,.08)"
        : badge === "done" ? "rgba(5,150,105,.08)"
          : badge === "error" ? "rgba(220,38,38,.06)"
            : "rgba(100,116,139,.08)",
    color:
      badge === "running" ? "#0284c7"
        : badge === "done" ? "#059669"
          : badge === "error" ? "#dc2626"
            : "#94a3b8",
  };

  const sep: React.CSSProperties = {
    width: 1,
    alignSelf: "stretch",
    background: "#d0dae8",
    flexShrink: 0,
  };

  const lbl: React.CSSProperties = {
    fontSize: ".6em",
    color: "#718096",
    fontWeight: 600,
  };

  const val: React.CSSProperties = {
    fontSize: ".82em",
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
  };

  const tsRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: ".62em",
    color: "#718096",
    lineHeight: 1.8,
  };

  const tsVal: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 600,
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "10px 16px",
      borderRadius: 10,
      flexWrap: "wrap",
      background: "#fff",
      border: "1px solid #d0dae8",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          onClick={onToggle}
          style={{
            width: 36, height: 20, borderRadius: 10,
            background: enabled ? "rgba(5,150,105,.15)" : "rgba(100,116,139,.1)",
            border: `1px solid ${enabled ? "rgba(5,150,105,.3)" : "rgba(100,116,139,.2)"}`,
            position: "relative",
            cursor: onToggle ? "pointer" : "default",
            transition: "all .3s",
            flexShrink: 0,
          }}
        >
          <div style={{
            position: "absolute",
            top: 2,
            left: enabled ? undefined : 2,
            right: enabled ? 2 : undefined,
            width: 16, height: 16, borderRadius: "50%",
            background: enabled ? "#059669" : "#94a3b8",
            transition: "all .3s",
          }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={lbl}>Auto Predict</span>
          <span style={badgeStyle}>{badge.toUpperCase()}</span>
        </div>
      </div>

      <div style={sep} />

      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={lbl}>Next</span>
        <span style={{
          ...val,
          color: !enabled ? "#94a3b8"
            : typeof countdown === "number" && countdown <= 10 ? "#dc2626"
              : typeof countdown === "number" && countdown <= 30 ? "#d97706"
                : "#2d3748",
          fontFamily: "'JetBrains Mono',monospace",
        }}>
          {enabled ? (typeof countdown === "number" ? `${countdown}s` : countdown) : "OFF"}
        </span>
      </div>

      <div style={sep} />

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={tsRow}>
          <span>📥</span>
          <span>Queried:</span>
          <span style={tsVal}>{queriedAt ?? "—"}</span>
        </div>
        <div style={tsRow}>
          <span>🧠</span>
          <span>Predicted:</span>
          <span style={tsVal}>{predictedAt ?? "—"}</span>
        </div>
      </div>

      <div style={sep} />

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={tsRow}>
          <span>⏱️</span>
          <span>Latency:</span>
          <span style={tsVal}>{latency ?? "—"}</span>
        </div>
        <div style={tsRow}>
          <span>📊</span>
          <span>Result:</span>
          <span style={tsVal}>{result ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}

// ── Health summary bar (.hg-wrap pattern) ────────────────────────────────
export function HealthSummaryBar({
  normal,
  warning,
  alarm,
  total,
}: {
  normal: number;
  warning: number;
  alarm: number;
  total: number;
}) {
  const normalPct = total > 0 ? (normal / total) * 100 : 100;
  const warningPct = total > 0 ? (warning / total) * 100 : 0;
  const alarmPct = total > 0 ? (alarm / total) * 100 : 0;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Bar */}
      <div style={{
        height: 10,
        borderRadius: 6,
        overflow: "hidden",
        display: "flex",
        background: "rgba(0,0,0,.04)",
        boxShadow: "inset 0 1px 2px rgba(0,0,0,.06)",
      }}>
        <div style={{ width: `${normalPct}%`, height: "100%", background: "linear-gradient(90deg,#16a34a,#22c55e)", transition: "width .6s" }} />
        <div style={{ width: `${warningPct}%`, height: "100%", background: "linear-gradient(90deg,#d97706,#f59e0b)", transition: "width .6s" }} />
        <div style={{ width: `${alarmPct}%`, height: "100%", background: "linear-gradient(90deg,#ef4444,#f87171)", transition: "width .6s" }} />
      </div>
      {/* Labels */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        marginTop: 6,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: ".55em",
        fontWeight: 600,
        flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#718096" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 4px rgba(0,0,0,.1)" }} />
          Normal <strong style={{ color: "#16a34a" }}>{normal}</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#718096" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706", display: "inline-block", boxShadow: "0 0 4px rgba(0,0,0,.1)" }} />
          Warning <strong style={{ color: "#d97706" }}>{warning}</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#718096" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block", boxShadow: "0 0 4px rgba(0,0,0,.1)" }} />
          Alarm <strong style={{ color: "#ef4444" }}>{alarm}</strong>
        </div>
        <div style={{ marginLeft: "auto", fontWeight: 800, color: "#2d3748", fontSize: "1.05em", letterSpacing: ".5px" }}>
          {normal} / {total} models OK
        </div>
      </div>
    </div>
  );
}

// ── Model node (.m2-mn pattern) ──────────────────────────────────────────
export function ModelNode({
  id,
  type,
  name,
  sub,
  value,
  status,
}: {
  id: string;
  type: "ML" | "DL" | "UL" | "Rule";
  name: string;
  sub: string;
  value?: string;
  status?: "OK" | "WARN" | "CRIT" | "IDLE";
}) {
  const typeBg =
    type === "ML" ? "linear-gradient(135deg,#0284c7,#06b6d4)"
      : type === "DL" ? "linear-gradient(135deg,#7c3aed,#a855f7)"
        : type === "UL" ? "linear-gradient(135deg,#d97706,#f59e0b)"
          : "linear-gradient(135deg,#475569,#64748b)";

  const badgeStyle: React.CSSProperties = {
    padding: "1px 5px",
    borderRadius: 3,
    lineHeight: 1,
    fontSize: ".6em",
    fontWeight: 700,
    flexShrink: 0,
    background:
      status === "WARN" ? "#78350f"
        : status === "CRIT" ? "#7f1d1d"
          : status === "IDLE" ? "#1e293b"
            : "#065f46",
    color:
      status === "WARN" ? "#fbbf24"
        : status === "CRIT" ? "#f87171"
          : status === "IDLE" ? "#64748b"
            : "#34d399",
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 8px",
      border: "1px solid #d0dae8",
      borderRadius: 6,
      background: "#f8fafc",
      marginBottom: 5,
      fontSize: ".6em",
      fontFamily: "'JetBrains Mono', monospace",
      position: "relative",
    }}>
      <span style={{
        fontSize: ".55em", fontWeight: 700, padding: "1px 4px",
        borderRadius: 3, color: "#fff", lineHeight: 1,
        background: typeBg, flexShrink: 0,
      }}>{type}</span>
      <span style={{ fontWeight: 700, fontSize: "1em", color: "#0284c7", minWidth: 14 }}>{id}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "#2d3748", fontSize: ".85em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: ".72em", color: "#718096" }}>{sub}</div>
      </div>
      {value !== undefined && (
        <span style={{ fontSize: ".72em", color: "#718096", minWidth: 30, textAlign: "right" }}>{value}</span>
      )}
      <span style={badgeStyle}>{status ?? "OK"}</span>
    </div>
  );
}

// ── Condition item (.m2-cond pattern) ───────────────────────────────────
export function ConditionItem({
  id,
  name,
  status,
  type,
}: {
  id: string;
  name: string;
  status?: "OK" | "WARN" | "CRIT";
  type?: "Hybrid" | "AI" | "Rule";
}) {
  const typeBg =
    type === "Hybrid" ? "rgba(2,132,199,.1)"
      : type === "AI" ? "rgba(124,58,237,.1)"
        : "rgba(100,116,139,.08)";

  const typeColor =
    type === "Hybrid" ? "#0284c7"
      : type === "AI" ? "#7c3aed"
        : "#64748b";

  const stColor =
    status === "WARN" ? "#fbbf24"
      : status === "CRIT" ? "#f87171"
        : "#34d399";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "4px 7px",
      border: "1px solid #d0dae8",
      borderRadius: 4,
      marginBottom: 3,
      fontSize: ".55em",
      fontFamily: "'JetBrains Mono', monospace",
      background: "#f8fafc",
    }}>
      <span style={{ fontWeight: 700, color: "#0284c7", minWidth: 22 }}>{id}</span>
      <span style={{ flex: 1, color: "#2d3748", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
      {type && (
        <span style={{
          fontSize: ".8em", padding: "1px 5px", borderRadius: 3,
          fontWeight: 600, background: typeBg, color: typeColor,
          flexShrink: 0,
        }}>{type}</span>
      )}
      <span style={{ fontSize: ".8em", fontWeight: 600, color: stColor, flexShrink: 0, padding: "1px 5px", borderRadius: 3 }}>
        {status ?? "OK"}
      </span>
    </div>
  );
}

// ── Device LED node ───────────────────────────────────────────────────────
export function DeviceLedNode({
  icon,
  name,
  status,
  size = "md",
}: {
  icon: string;
  name: string;
  status?: string;
  size?: "sm" | "md";
}) {
  const active = ["active", "connected", "online", "1"].includes(
    String(status ?? "").toLowerCase()
  );

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      padding: size === "sm" ? "8px 6px" : "12px 10px",
      background: active ? "rgba(34,197,94,.05)" : "rgba(239,68,68,.04)",
      border: `1px solid ${active ? "rgba(34,197,94,.2)" : "rgba(239,68,68,.2)"}`,
      borderRadius: 8,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: active ? "#22c55e" : "#ef4444",
        boxShadow: `0 0 6px ${active ? "#22c55e" : "#ef4444"}88`,
      }} />
      <div style={{ fontSize: size === "sm" ? "1.2em" : "1.6em" }}>{icon}</div>
      <div style={{ fontSize: ".6em", fontWeight: 700, textAlign: "center", color: "#2d3748" }}>{name}</div>
      <div style={{
        fontSize: ".55em", fontWeight: 700,
        padding: "1px 7px", borderRadius: 10,
        background: active ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)",
        color: active ? "#16a34a" : "#dc2626",
      }}>{status ?? "—"}</div>
    </div>
  );
}

// ── Card wrapper (.cd pattern) ──────────────────────────────────────────
export function DetCard({
  children,
  accent,
  padding = 16,
  style,
}: {
  children: React.ReactNode;
  accent?: string;
  padding?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #d0dae8",
      borderRadius: 12,
      padding,
      borderTop: accent ? `3px solid ${accent}` : undefined,
      marginBottom: 14,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Section title (.ct pattern) ──────────────────────────────────────────
export function DetTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: ".62em",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "2.5px",
      color: "#718096",
      marginBottom: 12,
      display: "flex",
      alignItems: "center",
      gap: 7,
    }}>
      {children}
    </div>
  );
}

// ── Score bar (.sec pattern) ─────────────────────────────────────────────
export function ScoreBar({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  const barColor =
    score > 0.7 ? "#dc2626"
      : score > 0.4 ? "#d97706"
        : "#059669";

  return (
    <div style={{
      padding: "8px 10px",
      borderRadius: 8,
      marginBottom: 4,
      background: "#f8fafc",
      borderLeft: `4px solid ${color}55`,
    }}>
      <div style={{
        fontSize: ".6em",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        color,
        marginBottom: 5,
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: "#d0dae8", borderRadius: 3 }}>
          <div style={{
            width: `${Math.min(100, score * 100)}%`,
            height: "100%",
            borderRadius: 3,
            background: barColor,
            transition: "width .6s",
          }} />
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: ".8em",
          fontWeight: 700,
          color: barColor,
          minWidth: 44,
        }}>
          {score.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

