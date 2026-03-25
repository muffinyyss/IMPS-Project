"use client";
import React from "react";
import { getHealthColor, getHealthGrade } from "../lib/constants";

// ── Design tokens — iMPS patterns ────────────────────────────────────────
const T = {
  bg: "#f8fafc",    // blue-gray-50
  surface: "#ffffff",
  card: "#ffffff",
  bdr: "#e5e7eb",    // gray-200
  bdr2: "#d1d5db",    // gray-300
  tx: "#374151",    // gray-700
  tx2: "#111827",    // gray-900
  dim: "#6b7280",    // gray-500
  mut: "#9ca3af",    // gray-400
  accent: "#eab308",    // iMPS yellow-500
  accentD: "#ca8a04",
  mono: "'JetBrains Mono', monospace",
  R: 12,           // rounded-xl
  R2: 16,           // rounded-2xl
  Rs: 8,            // rounded-lg
  shadow: "0 1px 2px rgba(0,0,0,.05)",
  shadowMd: "0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06)",
  shadowLg: "0 10px 15px rgba(0,0,0,.1), 0 4px 6px rgba(0,0,0,.05)",
};

// ── Health Gauge SVG ──────────────────────────────────────────────────────
export function HealthGaugeSvg({
  health, size = 90,
}: { health: number | null; size?: number }) {
  const ARC_LEN = 106.81;
  const color = getHealthColor(health);
  const offset = health != null
    ? ARC_LEN * (1 - Math.max(0, Math.min(100, health)) / 100)
    : ARC_LEN;
  const label =
    health == null ? "No Data"
      : health >= 90 ? "Excellent"
        : health >= 75 ? "Good"
          : health >= 60 ? "Fair"
            : health >= 40 ? "Poor"
              : "Critical";

  return (
    <div style={{ position: "relative", width: size, height: size * 0.58 }}>
      <svg viewBox="0 0 80 46" style={{ width: size, height: size * 0.58 }}>
        <path d="M 6 42 A 34 34 0 0 1 74 42"
          fill="none" stroke={T.bdr} strokeWidth="6" strokeLinecap="round" />
        <path d="M 6 42 A 34 34 0 0 1 74 42"
          fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={ARC_LEN} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .8s ease, stroke .5s ease", filter: `drop-shadow(0 0 3px ${color}55)` }} />
      </svg>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center", lineHeight: 1 }}>
        <div style={{ fontFamily: T.mono, fontSize: size * 0.095, fontWeight: 900, color }}>
          {health != null ? `${health}%` : "—"}
        </div>
        <div style={{ fontSize: size * 0.047, fontWeight: 700, color: T.dim, letterSpacing: ".5px", marginTop: 1 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ── Status top bar (4px gradient strip) ──────────────────────────────────
export function StatusTopBar({ health }: { health: number | null }) {
  const grad =
    health == null ? `linear-gradient(90deg,${T.mut},${T.dim})`
      : health >= 75 ? "linear-gradient(90deg,#22c55e,#34d399)"
        : health >= 50 ? `linear-gradient(90deg,${T.accent},#fbbf24)`
          : "linear-gradient(90deg,#ef4444,#f87171)";
  return <div style={{ height: 4, background: grad }} />;
}

// ── Status badge — ring-1 pattern (iMPS) ─────────────────────────────────
export function StatusBadge({ health }: { health: number | null }) {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "4px 10px", borderRadius: 6,
    fontSize: ".6em", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: ".04em",
  };

  if (health == null) return (
    <span style={{ ...base, background: "#f3f4f6", color: T.dim, boxShadow: `0 0 0 1px ${T.bdr2}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.mut, display: "inline-block" }} />
      OFFLINE
    </span>
  );

  const [bg, color, ring, dot, text] =
    health >= 75
      ? ["#f0fdf4", "#059669", "rgba(5,150,105,.2)", "#22c55e", "NORMAL"]
      : health >= 50
        ? ["#fefce8", "#d97706", "rgba(234,179,8,.2)", "#eab308", "WARNING"]
        : ["#fef2f2", "#dc2626", "rgba(220,38,38,.2)", "#f87171", "CRITICAL"];

  return (
    <span style={{ ...base, background: bg, color, boxShadow: `0 0 0 1px ${ring}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, display: "inline-block" }} />
      {text}
    </span>
  );
}

// ── Health pill ───────────────────────────────────────────────────────────
export function HealthPill({ value }: { value: number | null | undefined }) {
  if (value == null) return (
    <span style={{ padding: "2px 8px", borderRadius: 9999, fontSize: ".72em", fontWeight: 500, background: "#f3f4f6", color: T.mut }}>—</span>
  );
  const [bg, color, ring] =
    value >= 80 ? ["#f0fdf4", "#059669", "rgba(5,150,105,.2)"]
      : value >= 50 ? ["#fefce8", "#d97706", "rgba(234,179,8,.2)"]
        : ["#fef2f2", "#dc2626", "rgba(220,38,38,.2)"];
  return (
    <span style={{ padding: "2px 9px", borderRadius: 9999, fontSize: ".72em", fontWeight: 700, background: bg, color, boxShadow: `0 0 0 1px ${ring}` }}>
      {value}
    </span>
  );
}

// ── Grade badge ───────────────────────────────────────────────────────────
export function GradeBadge({ health }: { health: number | null }) {
  const grade = getHealthGrade(health);
  const map: Record<string, [string, string, string]> = {
    A: ["#f0fdf4", "#059669", "rgba(5,150,105,.2)"],
    B: ["#f7fee7", "#65a30d", "rgba(132,204,22,.2)"],
    C: ["#fefce8", "#d97706", "rgba(234,179,8,.2)"],
    D: ["#fff7ed", "#c2410c", "rgba(249,115,22,.2)"],
    F: ["#fef2f2", "#dc2626", "rgba(220,38,38,.2)"],
    X: ["#f9fafb", T.mut, T.bdr],
  };
  const [bg, color, ring] = map[grade] ?? map.X;
  return (
    <span style={{
      padding: "3px 9px", borderRadius: T.Rs,
      fontWeight: 800, fontSize: ".75em",
      background: bg, color, boxShadow: `0 0 0 1px ${ring}`,
    }}>{grade}</span>
  );
}

// ── Coverage bar ──────────────────────────────────────────────────────────
export function CoverageBar({ ok, total = 7 }: { ok: number; total?: number }) {
  const pct = Math.round((ok / total) * 100);
  const color = ok === total ? "#22c55e" : ok >= 4 ? T.accent : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: T.bdr, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 3, background: color, width: `${pct}%`, transition: "width .5s" }} />
      </div>
      <span style={{ fontSize: ".7em", fontWeight: 700, color: T.dim, whiteSpace: "nowrap", fontFamily: T.mono }}>{ok}/{total}</span>
    </div>
  );
}

// ── KPI card — exact iMPS stat card pattern (inline styles) ──────────────
export function KpiCard({
  label, value, sub, accentClass, dark = false, icon, onClick, isActive = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accentClass?: "green" | "yellow" | "red" | "blue" | "white";
  dark?: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);

  // iMPS ring colors per accent
  const iconBg: Record<string, string> = {
    green:  "rgba(16,185,129,0.15)",
    yellow: "rgba(234,179,8,0.15)",
    red:    "rgba(239,68,68,0.15)",
    blue:   "rgba(59,130,246,0.20)",
    white:  "rgba(255,255,255,0.10)",
  };
  const iconRing: Record<string, string> = {
    green:  "rgba(52,211,153,0.25)",
    yellow: "rgba(251,191,36,0.25)",
    red:    "rgba(248,113,113,0.25)",
    blue:   "rgba(96,165,250,0.20)",
    white:  "rgba(255,255,255,0.15)",
  };
  const valueColor: Record<string, string> = {
    green:  "#34d399",
    yellow: "#fbbf24",
    red:    "#f87171",
    blue:   "#ffffff",   // iMPS: white for non-semantic counts
    white:  "#ffffff",
  };

  // Active ring color (iMPS clickable filter cards)
  const activeRing: Record<string, string> = {
    green:  "#4ade80",
    red:    "#f87171",
    yellow: "#fbbf24",
    blue:   "#60a5fa",
    white:  "rgba(255,255,255,.4)",
  };

  if (dark) {
    const vColor = accentClass ? valueColor[accentClass] : "#fff";
    const iBg    = accentClass ? iconBg[accentClass]    : "rgba(255,255,255,.1)";
    const iRing  = accentClass ? iconRing[accentClass]  : "rgba(255,255,255,.15)";
    const aRing  = accentClass && isActive ? activeRing[accentClass] : undefined;

    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative", overflow: "hidden",
          borderRadius: 16,
          background: "linear-gradient(to bottom right, #111827, #1f2937, #111827)",
          padding: "14px 20px",
          // iMPS: ring-1 ring-white/10 → shadow emulation
          boxShadow: isActive && aRing
            ? `0 0 0 2px ${aRing}, 0 10px 15px rgba(0,0,0,.1)`
            : `0 0 0 1px rgba(255,255,255,.10), 0 10px 15px rgba(0,0,0,.1), 0 4px 6px rgba(0,0,0,.05)`,
          transform: hovered || isActive ? "translateY(-2px)" : "none",
          transition: "transform .3s, box-shadow .3s",
          cursor: onClick ? "pointer" : "default",
          // iMPS: scale-[1.02] when active
          scale: isActive ? "1.02" : "1",
        }}
      >
        {/* Dot texture — iMPS radial pattern */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Icon + label row — iMPS pattern */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {icon && (
              <div style={{
                width: 32, height: 32, borderRadius: 12, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: iBg,
                boxShadow: `0 0 0 1px ${iRing}`,
              }}>
                {icon}
              </div>
            )}
            <span style={{
              fontSize: ".62em", fontWeight: 600,
              color: "rgba(255,255,255,.4)",
              textTransform: "uppercase", letterSpacing: ".08em",
              whiteSpace: "nowrap",
            }}>
              {label}
            </span>
          </div>

          {/* Value — iMPS text-2xl~3xl font-black tabular-nums */}
          <div style={{
            fontSize: "1.75em", fontWeight: 900,
            fontFamily: T.mono, lineHeight: 1,
            color: vColor,
            letterSpacing: "-.02em",
            fontVariantNumeric: "tabular-nums",
          }}>
            {value}
          </div>

          {sub && (
            <div style={{ fontSize: ".58em", color: "rgba(255,255,255,.3)", marginTop: 4 }}>
              {sub}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Light card (default)
  const accentColorMap: Record<string, string> = {
    green:  "#22c55e",
    yellow: T.accent,
    red:    "#ef4444",
    blue:   "#3b82f6",
    white:  "#e5e7eb",
  };

  return (
    <div style={{
      borderRadius: T.R,
      padding: "16px 20px",
      background: T.surface,
      border: `1px solid ${T.bdr}`,
      boxShadow: T.shadow,
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      {accentClass && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: accentColorMap[accentClass],
        }} />
      )}
      <div style={{ fontSize: ".58em", fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: "2em", fontWeight: 800, fontFamily: T.mono, lineHeight: 1, color: T.tx2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: ".58em", color: T.dim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────
export function SectionHeader({
  children, color,
}: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontSize: ".62em", fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "2.5px",
      color: color ?? T.dim,
      marginBottom: 10,
      display: "flex", alignItems: "center", gap: 7,
    }}>
      {children}
    </div>
  );
}

// ── Dark icon block — from-gray-900 to-gray-800 rounded-lg ───────────────
export function DarkIconBlock({
  children, size = 36,
}: { children: React.ReactNode; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: T.Rs, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg,#111827,#1f2937)",
      boxShadow: T.shadow,
      fontSize: size * 0.45,
    }}>
      {children}
    </div>
  );
}

// ── Env card ──────────────────────────────────────────────────────────────
export function EnvCard({
  label, value, unit, color,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  color?: string;
}) {
  return (
    <div style={{
      background: T.bg,
      border: `1px solid ${T.bdr}`,
      borderRadius: T.Rs,
      padding: "10px 12px",
      textAlign: "center",
      boxShadow: T.shadow,
      transition: "box-shadow .2s, transform .2s",
    }}>
      <div style={{ fontSize: ".6em", color: T.dim, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: T.mono, fontSize: "1.1em", fontWeight: 800, color: color ?? T.tx2 }}>{value ?? "—"}</div>
      {unit && <div style={{ fontSize: ".55em", color: T.mut }}>{unit}</div>}
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────
export function AiCard({
  children, accent, style, hoverable = false,
}: {
  children: React.ReactNode;
  accent?: string;
  style?: React.CSSProperties;
  hoverable?: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      onMouseEnter={() => hoverable && setHovered(true)}
      onMouseLeave={() => hoverable && setHovered(false)}
      style={{
        background: T.surface,
        border: `1px solid ${hovered ? "#93c5fd" : T.bdr}`,
        borderRadius: T.R,
        boxShadow: hovered ? T.shadowLg : T.shadow,
        borderTop: accent ? `3px solid ${accent}` : undefined,
        overflow: "hidden",
        transition: "transform .2s, box-shadow .2s, border-color .2s",
        transform: hoverable && hovered ? "translateY(-2px)" : undefined,
        cursor: hoverable ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Refresh bar ───────────────────────────────────────────────────────────
export function RefreshBar({
  countdown, lastUpdate, onRefresh, loading,
}: {
  countdown: number;
  lastUpdate: string;
  onRefresh: () => void;
  loading?: boolean;
}) {
  return (
    <div style={{
      borderRadius: T.R, padding: "10px 18px",
      background: T.surface, border: `1px solid ${T.bdr}`,
      boxShadow: T.shadow,
      display: "flex", alignItems: "center", gap: 14,
      flexWrap: "wrap", marginBottom: 20, fontSize: ".72em",
    }}>
      {/* iMPS: bg-gray-900 → hover:bg-black */}
      <button onClick={onRefresh} style={{
        padding: "5px 14px", borderRadius: T.Rs, cursor: "pointer",
        background: loading ? T.bg : "#111827",
        border: `1px solid ${loading ? T.bdr2 : "#111827"}`,
        color: loading ? T.dim : "#fff",
        fontWeight: 700, fontFamily: T.mono, fontSize: ".9em",
        transition: "all .2s",
        boxShadow: loading ? "none" : "0 2px 4px rgba(17,24,39,.25)",
      }}>
        {loading ? "⚙ Fetching…" : "↻ Refresh All"}
      </button>

      <div style={{ width: 1, height: 18, background: T.bdr }} />

      <div style={{ color: T.dim }}>
        Last update:{" "}
        <span style={{ fontFamily: T.mono, fontWeight: 600, color: T.tx }}>{lastUpdate || "—"}</span>
      </div>

      <div style={{ width: 1, height: 18, background: T.bdr }} />

      <div style={{ color: T.dim }}>
        Auto-refresh:{" "}
        <span style={{
          fontFamily: T.mono, fontWeight: 700,
          color: countdown <= 10 ? "#dc2626" : countdown <= 30 ? T.accent : T.tx,
        }}>
          {countdown}s
        </span>
      </div>
    </div>
  );
}