"use client";
import React, { useState } from "react";
import { ModuleResult } from "../../lib/api";

interface Props { 
  data: ModuleResult | null;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
 }

// ── Risk calculation from real data ──────────────────────────────────────
function calcRisks(d: any) {
  const t = d.telemetry ?? {};

  return [
    {
      key: "icp_fault",
      label: "ICP State Fault",
      icon: "⚡",
      risk: d.icp_state === 9 ? 90 : d.icp_state === 10 ? 95 : d.icp_state === 6 ? 50 : 5,
      active: d.icp_state === 9 || d.icp_state === 10,
      value: `ICP: ${d.icp_state ?? "—"} (${d.icp_name ?? "—"})`,
      action: "ตรวจสอบ CP signal voltage และ PLC contractor",
    },
    {
      key: "uslink_fault",
      label: "USLink Protocol Fault",
      icon: "📡",
      risk: d.uslink_state === 14 ? 80 : d.uslink_state === 4 ? 85 : d.uslink_state === 15 ? 20 : 5,
      active: d.uslink_state === 4 || d.uslink_state === 14,
      value: `USL: ${d.uslink_state ?? "—"} (${d.uslink_name ?? "—"})`,
      action: "ตรวจสอบ EV-SECC communication และ ISO 15118 session",
    },
    {
      key: "plc1_fault",
      label: "PLC 1 Communication Failure",
      icon: "🔌",
      risk: d.plc_status !== "Active" ? 65 : 2,
      active: d.plc_status !== "Active" && d.plc_status != null,
      value: `PLC1: ${d.plc_status ?? "—"}`,
      action: "รีสตาร์ท PLC 1 และตรวจสอบ HomePlug GreenPHY signal",
    },
    {
      key: "plc2_fault",
      label: "PLC 2 Communication Failure",
      icon: "🔌",
      risk: d.plc2_status !== "Active" ? 55 : 2,
      active: d.plc2_status !== "Active" && d.plc2_status != null,
      value: `PLC2: ${d.plc2_status ?? "—"}`,
      action: "ตรวจสอบ PLC 2 connection และ firmware",
    },
    {
      key: "mqtt_disc",
      label: "MQTT Broker Disconnected",
      icon: "🌐",
      risk: !d.mqtt_connected ? 40 : 2,
      active: !d.mqtt_connected && d.mqtt_connected != null,
      value: d.mqtt_connected ? "Connected" : "Disconnected",
      action: "ตรวจสอบ network connection และ MQTT broker status",
    },
    {
      key: "icp_inferred",
      label: "ICP State Inferred (Not Direct)",
      icon: "🔍",
      risk: d.icp_inferred ? 30 : 3,
      active: !!d.icp_inferred,
      value: d.icp_inferred ? "Inferred from M4 telemetry" : "Direct read",
      action: "ตรวจสอบการอ่านค่าจาก PLC โดยตรง — ICP state ควรมาจาก direct read",
    },
    {
      key: "usl_inferred",
      label: "USLink State Inferred",
      icon: "🔍",
      risk: d.usl_inferred ? 25 : 3,
      active: !!d.usl_inferred,
      value: d.usl_inferred ? "Inferred" : "Direct read",
      action: "ตรวจสอบ USLink communication channel",
    },
    {
      key: "welding",
      label: "Contact Welding Detection",
      icon: "🔥",
      risk: d.icp_state === 9 ? 85 : (t.DC_contractor1 === 1 && d.icp_state === 0) ? 70 : 3,
      active: d.icp_state === 9 || (t.DC_contractor1 === 1 && d.icp_state === 0),
      value: `DC Cont: ${t.DC_contractor1 ?? "—"} | ICP: ${d.icp_state ?? "—"}`,
      action: "WeldingDetection phase required — ตรวจสอบ DC contactors ทันที",
    },
  ];
}

// ── Model result row ──────────────────────────────────────────────────────
function ModelRow({ name, result, score }: { name: string; result: boolean | null; score?: number | null }) {
  const color  = result === true ? "#dc2626" : result === false ? "#22c55e" : "#94a3b8";
  const label  = result === true ? "ANOMALY" : result === false ? "NORMAL" : "—";
  const bg     = result === true ? "rgba(239,68,68,.08)" : result === false ? "rgba(34,197,94,.08)" : "rgba(100,116,139,.06)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #f8fafc" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: ".68em", color: "#2d3748", fontWeight: 600 }}>{name}</span>
      {score != null && (
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".6em", color: "#94a3b8" }}>
          {score.toFixed(3)}
        </span>
      )}
      <span style={{ fontSize: ".6em", fontWeight: 700, padding: "1px 8px", borderRadius: 10, background: bg, color }}>{label}</span>
    </div>
  );
}

export default function M7FailurePredictionTab({ data }: Props) {
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);

  if (!data) return null;
  const d = data as any;

  const risks = calcRisks(d);
  const overallRisk  = Math.max(...risks.map((r) => r.risk));
  const activeRisks  = risks.filter((r) => r.active);
  const overallColor = overallRisk >= 70 ? "#dc2626" : overallRisk >= 30 ? "#d97706" : "#059669";
  const overallLabel = overallRisk >= 70 ? "HIGH RISK" : overallRisk >= 30 ? "MODERATE" : "LOW RISK";

  // Model results from API
  const modelResults = d.model_results ?? {};
  const hasModels    = Object.keys(modelResults).length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Overall risk gauge */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: `${overallColor}15`, border: `2px solid ${overallColor}`,
        }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 900, color: overallColor, lineHeight: 1, fontSize: ".9em" }}>
            {overallRisk}%
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: ".78em", fontWeight: 700, color: "#2d3748" }}>Overall Failure Risk</div>
          <div style={{ fontSize: ".72em", fontWeight: 800, color: overallColor, marginTop: 2 }}>{overallLabel}</div>
          <div style={{ fontSize: ".6em", color: "#94a3b8", marginTop: 2 }}>
            {activeRisks.length} active risk{activeRisks.length !== 1 ? "s" : ""} · {risks.length} conditions monitored
          </div>
        </div>
        {/* Risk bar */}
        <div style={{ flex: "0 0 200px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".58em", color: "#94a3b8", marginBottom: 4 }}>
            <span>Risk Level</span>
            <span style={{ color: overallColor, fontWeight: 700 }}>{overallRisk}%</span>
          </div>
          <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${overallRisk}%`, height: "100%", borderRadius: 4,
              background: overallColor, transition: "width .8s",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".52em", color: "#94a3b8", marginTop: 3 }}>
            <span>0% Safe</span><span>50% Moderate</span><span>100% Critical</span>
          </div>
        </div>
      </div>

      {/* Active alerts */}
      {activeRisks.length > 0 && (
        <div style={{ background: "rgba(239,68,68,.04)", borderRadius: 12, border: "1px solid rgba(239,68,68,.2)", padding: "14px 16px" }}>
          <div style={{ fontSize: ".62em", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 10 }}>
            🚨 Active Risks ({activeRisks.length})
          </div>
          {activeRisks.map((r) => (
            <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.8)", border: "1px solid rgba(239,68,68,.15)" }}>
              <span style={{ fontSize: "1em", flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: ".68em", fontWeight: 700, color: "#2d3748" }}>{r.label}</div>
                <div style={{ fontSize: ".6em", color: "#dc2626" }}>→ {r.action}</div>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".6em", fontWeight: 800, color: "#dc2626", flexShrink: 0 }}>
                {r.risk}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Risk breakdown */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
        <div style={{ fontSize: ".62em", fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 12 }}>
          Risk Breakdown (click to expand)
        </div>
        {risks.map((r) => {
          const color  = r.risk >= 70 ? "#dc2626" : r.risk >= 30 ? "#d97706" : "#22c55e";
          const isExp  = expandedRisk === r.key;
          return (
            <div
              key={r.key}
              onClick={() => setExpandedRisk(isExp ? null : r.key)}
              style={{
                marginBottom: 6, borderRadius: 8, overflow: "hidden",
                border: `1px solid ${r.active ? `${color}33` : "#e2e8f0"}`,
                background: r.active ? `${color}04` : "#fff",
                cursor: "pointer",
              }}
            >
              <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: ".85em", flexShrink: 0 }}>{r.icon}</span>
                <span style={{ flex: 1, fontSize: ".68em", fontWeight: 600, color: "#2d3748" }}>{r.label}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".6em", color: "#94a3b8", flexShrink: 0 }}>{r.value}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".65em", fontWeight: 700, color, flexShrink: 0, minWidth: 36, textAlign: "right" }}>
                  {r.risk}%
                </span>
                <span style={{ color: "#94a3b8", fontSize: ".55em" }}>{isExp ? "▲" : "▼"}</span>
              </div>
              {/* Progress bar */}
              <div style={{ padding: "0 12px 8px" }}>
                <div style={{ height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${r.risk}%`, height: "100%", background: color, borderRadius: 2, transition: "width .5s" }} />
                </div>
              </div>
              {/* Expanded detail */}
              {isExp && (
                <div style={{ padding: "8px 12px 12px", borderTop: "1px solid #f8fafc" }}>
                  <div style={{ fontSize: ".62em", color: "#718096", marginBottom: 6, lineHeight: 1.6 }}>{r.action}</div>
                  {r.active && (
                    <div style={{ fontSize: ".6em", padding: "4px 8px", borderRadius: 6, background: `${color}08`, color, border: `1px solid ${color}25` }}>
                      ⚠ Risk currently active — immediate attention required
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Model Breakdown */}
      {hasModels ? (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
          <div style={{ fontSize: ".62em", fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 12 }}>
            🤖 AI Model Anomaly Breakdown
          </div>
          {Object.entries(modelResults).map(([k, v]: any) => (
            <ModelRow
              key={k}
              name={k}
              result={typeof v === "boolean" ? v : v?.anomaly ?? null}
              score={typeof v === "object" ? v?.score ?? v?.confidence : null}
            />
          ))}
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
          <div style={{ fontSize: ".62em", fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 8 }}>
            🤖 AI Model Status
          </div>
          <div style={{ fontSize: ".68em", color: "#94a3b8", lineHeight: 1.7 }}>
            ไม่มีข้อมูล model_results จาก API — risks ด้านบนคำนวณจาก state machine analysis โดยตรง
          </div>
          {/* State-based risk factors */}
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { l:"ICP State",    v:d.icp_state,    sub:d.icp_name },
              { l:"USLink State", v:d.uslink_state, sub:d.uslink_name },
              { l:"PLC 1",        v:d.plc_status },
              { l:"PLC 2",        v:d.plc2_status },
            ].map((item) => (
              <div key={item.l} style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: ".55em", color: "#94a3b8", marginBottom: 2 }}>{item.l}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".72em", fontWeight: 700, color: "#2d3748" }}>
                  {item.v ?? "—"}
                </div>
                {item.sub && (
                  <div style={{ fontSize: ".55em", color: "#718096" }}>{item.sub}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}