"use client";
import React, { useEffect, useState } from "react";
import { ModuleResult } from "../../lib/api";
import { aiApi } from "../../lib/api";

interface Props { 
  data: ModuleResult | null;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
 }

// ── Rule definitions ──────────────────────────────────────────────────────
const RULES = [
  {
    id: "R1×2", grp: "chg", grpColor: "#0284c7", grpLabel: "Charging State",
    name: "Charging State Check",
    condition: "ICP = C2 (charging) AND USL = CurrentDemand — both connectors",
    desc: "Validates that ICP and USLink are in active charging states simultaneously",
    severity: "WARNING",
    fields: ["icp_state", "uslink_state"],
  },
  {
    id: "R2", grp: "mod", grpColor: "#d97706", grpLabel: "Power Module",
    name: "Power Module Derating",
    condition: "power_module_temp > 55°C → −3.2A/°C and −1kW/°C derating",
    desc: "IEC 61851-23 §101.2 — thermal derating activates above 55°C",
    severity: "WARNING",
    fields: ["power_module_temp1","power_module_temp2","power_module_temp3"],
  },
  {
    id: "R3", grp: "mod", grpColor: "#d97706", grpLabel: "Power Module",
    name: "Single Charging Module Count",
    condition: "1 connector active → requires ≥5 power modules",
    desc: "Ensures sufficient power modules are available for single-connector operation",
    severity: "WARNING",
    fields: ["power_module_status1","power_module_status2"],
  },
  {
    id: "R4", grp: "mod", grpColor: "#d97706", grpLabel: "Power Module",
    name: "Dual Charging Module Split",
    condition: "2 connectors active → H1=2 modules, H2=3 modules",
    desc: "Validates module allocation when dual charging is active",
    severity: "WARNING",
    fields: ["power_module_status3","power_module_status4","power_module_status5"],
  },
  {
    id: "R5×2", grp: "dlv", grpColor: "#7c3aed", grpLabel: "Under-Delivery",
    name: "Under-Delivery (No CSMS Limit)",
    condition: "present < 95% of target voltage/current — without CSMS limiting",
    desc: "Detects when charger delivers less than requested without grid/CSMS reason",
    severity: "CRITICAL",
    fields: ["target_voltage1","present_voltage1","target_current1","present_current1"],
  },
  {
    id: "R6×2", grp: "cbl", grpColor: "#dc2626", grpLabel: "Cable Safety",
    name: "CCS Cable Temp Derating",
    condition: "gun_temp > threshold → boost mode derating (Phoenix Contact table)",
    desc: "IEC 62196-3 — CCS Type 2 connector thermal protection",
    severity: "CRITICAL",
    fields: ["charger_gun_temp_plus1","charger_gun_temp_plus2"],
  },
];

const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
  CRITICAL: { bg: "rgba(239,68,68,.1)",  color: "#dc2626" },
  WARNING:  { bg: "rgba(217,119,6,.1)",  color: "#d97706" },
  OK:       { bg: "rgba(34,197,94,.1)",  color: "#16a34a" },
  IDLE:     { bg: "rgba(100,116,139,.08)", color: "#64748b" },
};

function getRuleStatus(rule: typeof RULES[0], data: any): "OK" | "WARNING" | "CRITICAL" | "IDLE" {
  if (!data) return "IDLE";
  const d = data.data ?? {};
  const m = data;

  if (rule.id === "R1×2") {
    if (m.icp_state === 7 && m.uslink_state === 13) return "OK";
    if (m.icp_state != null) return "WARNING";
    return "IDLE";
  }
  if (rule.id === "R2") {
    const temps = [d.power_module_temp1, d.power_module_temp2, d.power_module_temp3, d.power_module_temp4, d.power_module_temp5];
    const max = Math.max(...temps.filter(Boolean));
    if (max > 65) return "CRITICAL";
    if (max > 55) return "WARNING";
    if (max > 0)  return "OK";
    return "IDLE";
  }
  if (rule.id === "R5×2") {
    const vDev = d.target_voltage1 && d.present_voltage1 ? Math.abs(d.target_voltage1 - d.present_voltage1) / d.target_voltage1 : 0;
    if (vDev > 0.1) return "CRITICAL";
    if (vDev > 0.05) return "WARNING";
    if (d.target_voltage1) return "OK";
    return "IDLE";
  }
  if (rule.id === "R6×2") {
    const maxGun = Math.max(d.charger_gun_temp_plus1 ?? 0, d.charger_gun_temp_plus2 ?? 0);
    if (maxGun > 80) return "CRITICAL";
    if (maxGun > 60) return "WARNING";
    if (maxGun > 0)  return "OK";
    return "IDLE";
  }
  return "IDLE";
}

function getRuleValue(rule: typeof RULES[0], data: any): string {
  if (!data) return "—";
  const d = data.data ?? {};
  if (rule.id === "R1×2")  return `ICP:${data.icp_state??"-"} USL:${data.uslink_state??"-"}`;
  if (rule.id === "R2")    return `PM1:${d.power_module_temp1?.toFixed(1)??"—"}°C`;
  if (rule.id === "R3")    return `Modules: ${[1,2,3,4,5].filter(i => d[`power_module_status${i}`]).length}/5`;
  if (rule.id === "R4")    return `H1:${[1,2].filter(i=>d[`power_module_status${i}`]).length} H2:${[3,4,5].filter(i=>d[`power_module_status${i}`]).length}`;
  if (rule.id === "R5×2")  {
    if (d.target_voltage1 && d.present_voltage1) {
      const pct = (d.present_voltage1 / d.target_voltage1 * 100).toFixed(1);
      return `${pct}% of target`;
    }
    return "—";
  }
  if (rule.id === "R6×2")  return `Gun: ${Math.max(d.charger_gun_temp_plus1??0,d.charger_gun_temp_plus2??0).toFixed(1)}°C`;
  return "—";
}

// ── Group node ────────────────────────────────────────────────────────────
function GroupNode({ label, color, status }: { label: string; color: string; status: string }) {
  const st = SEVERITY_STYLE[status] ?? SEVERITY_STYLE.IDLE;
  return (
    <div style={{
      padding: "10px 14px", borderRadius: 10,
      border: `2px solid ${color}`,
      background: "#fff",
      textAlign: "center",
      minWidth: 130,
      boxShadow: "0 2px 8px rgba(0,0,0,.05)",
    }}>
      <div style={{ fontSize: ".68em", fontWeight: 700, color, marginBottom: 4 }}>{label}</div>
      <span style={{ fontSize: ".6em", fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: st.bg, color: st.color }}>
        {status}
      </span>
    </div>
  );
}

// ── Rule row ──────────────────────────────────────────────────────────────
function RuleRow({ rule, status, value, expanded, onToggle }: {
  rule: typeof RULES[0];
  status: "OK" | "WARNING" | "CRITICAL" | "IDLE";
  value: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const st = SEVERITY_STYLE[status];
  const borderColor =
    status === "CRITICAL" ? "#dc2626"
    : status === "WARNING" ? "#d97706"
    : status === "OK"      ? "#22c55e"
    : "#94a3b8";

  return (
    <div style={{
      border: "1px solid #e2e8f0",
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 6,
      background: status === "CRITICAL" ? "rgba(239,68,68,.02)" : status === "WARNING" ? "rgba(217,119,6,.02)" : "#fff",
      marginBottom: 4,
      transition: "all .2s",
    }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", cursor: "pointer" }}
      >
        <span style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: ".62em", fontWeight: 800,
          padding: "1px 6px", borderRadius: 4, color: "#fff", flexShrink: 0,
          background: rule.grpColor,
        }}>{rule.id}</span>
        <span style={{ flex: 1, fontSize: ".72em", fontWeight: 600, color: "#2d3748" }}>{rule.name}</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".6em", color: "#94a3b8", flexShrink: 0 }}>{value}</span>
        <span style={{ fontSize: ".6em", fontWeight: 700, padding: "1px 8px", borderRadius: 10, background: st.bg, color: st.color, flexShrink: 0 }}>
          {status}
        </span>
        <span style={{ color: "#94a3b8", fontSize: ".6em", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 10px 10px 10px", borderTop: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: ".62em", color: "#718096", lineHeight: 1.7, marginTop: 8 }}>{rule.desc}</div>
          <div style={{ marginTop: 6 }}>
            <code style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".58em", background: "#f8fafc", padding: "4px 8px", borderRadius: 4, color: "#2d3748", display: "block" }}>
              {rule.condition}
            </code>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
            {rule.fields.map((f) => (
              <span key={f} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".58em", padding: "2px 7px", borderRadius: 6, background: "rgba(255,255,255,.6)", border: "1px solid #e2e8f0", color: "#2d3748" }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function M4RuleBasedTab({ data }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = [
    { key: "chg", label: "🔌 Charging State", color: "#0284c7" },
    { key: "mod", label: "⚙️ Power Module",   color: "#d97706" },
    { key: "dlv", label: "📉 Under-Delivery", color: "#7c3aed" },
    { key: "cbl", label: "🔥 Cable Safety",   color: "#dc2626" },
  ];

  const getGroupStatus = (grpKey: string) => {
    const grpRules = RULES.filter((r) => r.grp === grpKey);
    const statuses = grpRules.map((r) => getRuleStatus(r, data));
    if (statuses.includes("CRITICAL")) return "CRITICAL";
    if (statuses.includes("WARNING"))  return "WARNING";
    if (statuses.every((s) => s === "OK")) return "OK";
    return "IDLE";
  };

  // Overall status
  const allStatuses = RULES.map((r) => getRuleStatus(r, data));
  const overall = allStatuses.includes("CRITICAL") ? "CRITICAL" : allStatuses.includes("WARNING") ? "WARNING" : allStatuses.every(s=>s==="OK") ? "OK" : "IDLE";
  const overallSt = SEVERITY_STYLE[overall];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: ".62em", fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 4 }}>
              Rule-Based Real-Time Monitoring
            </div>
            <div style={{ fontSize: ".72em", color: "#2d3748" }}>
              6 rules · 9 real-time checks · <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#0284c7" }}>OCPP/Klongluang3/PLC</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: data ? "#22c55e" : "#94a3b8", boxShadow: data ? "0 0 6px #22c55e" : undefined }} />
            <span style={{ fontSize: ".65em", color: "#718096" }}>{data ? "Live data" : "No data"}</span>
            <span style={{ fontSize: ".65em", fontWeight: 700, padding: "2px 10px", borderRadius: 10, background: overallSt.bg, color: overallSt.color }}>
              {overall}
            </span>
          </div>
        </div>
      </div>

      {/* Tree: Groups → Overall */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px", overflowX: "auto" }}>
        <div style={{ fontSize: ".62em", fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 14 }}>
          Rule Tree Diagram
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: 600 }}>
          {/* Group nodes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: "0 0 auto" }}>
            {groups.map((g) => (
              <GroupNode key={g.key} label={g.label} color={g.color} status={getGroupStatus(g.key)} />
            ))}
          </div>

          {/* Connecting lines SVG */}
          <svg style={{ flex: "0 0 80px", height: groups.length * 60, overflow: "visible" }}>
            {groups.map((g, i) => {
              const y = i * 60 + 30;
              const midY = (groups.length * 60) / 2;
              return (
                <path key={g.key}
                  d={`M 0 ${y} C 40 ${y}, 40 ${midY}, 80 ${midY}`}
                  fill="none" stroke="#d0dae8" strokeWidth="1.5" strokeDasharray="4,3"
                />
              );
            })}
          </svg>

          {/* Overall status */}
          <div style={{ flex: "0 0 auto" }}>
            <div style={{
              padding: "16px 20px", borderRadius: 12,
              border: `2px solid ${overallSt.color}`,
              background: overallSt.bg,
              textAlign: "center",
              minWidth: 120,
            }}>
              <div style={{ fontSize: "1.6em", marginBottom: 4 }}>
                {overall === "OK" ? "✅" : overall === "CRITICAL" ? "🚨" : overall === "WARNING" ? "⚠️" : "⏸"}
              </div>
              <div style={{ fontSize: ".65em", fontWeight: 800, color: overallSt.color, letterSpacing: ".5px" }}>
                {overall}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".58em", color: "#718096", marginTop: 2 }}>
                {allStatuses.filter(s => s !== "OK" && s !== "IDLE").length} alerts
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rule list */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
        <div style={{ fontSize: ".62em", fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 12 }}>
          Live Rule Results
        </div>
        {RULES.map((rule) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            status={getRuleStatus(rule, data)}
            value={getRuleValue(rule, data)}
            expanded={expanded === rule.id}
            onToggle={() => setExpanded(expanded === rule.id ? null : rule.id)}
          />
        ))}
      </div>

      {/* Note */}
      <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(2,132,199,.06)", border: "1px solid rgba(2,132,199,.2)", fontSize: ".62em", color: "#0284c7" }}>
        ⚠ Rules R1–R6 ไม่นับรวมใน Health Score — ใช้สำหรับ real-time alert เท่านั้น ตรวจสอบทุก polling cycle
      </div>
    </div>
  );
}