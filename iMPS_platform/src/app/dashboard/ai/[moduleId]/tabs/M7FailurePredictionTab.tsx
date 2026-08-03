"use client";
import React, { useState } from "react";
import { ModuleResult } from "../../lib/api";
import useLanguage, { type Lang } from "@/utils/useLanguage";

interface Props {
  data: ModuleResult | null;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
 }

const T = {
  overallFailureRisk: { th: "ความเสี่ยงความล้มเหลวโดยรวม", en: "Overall Failure Risk" },
  highRisk: { th: "ความเสี่ยงสูง", en: "HIGH RISK" },
  moderate: { th: "ปานกลาง", en: "MODERATE" },
  lowRisk: { th: "ความเสี่ยงต่ำ", en: "LOW RISK" },
  activeRiskCount: { th: "ความเสี่ยงที่เกิดขึ้น", en: "active risk" },
  activeRiskCountPlural: { th: "ความเสี่ยงที่เกิดขึ้น", en: "active risks" },
  conditionsMonitored: { th: "เงื่อนไขที่เฝ้าระวัง", en: "conditions monitored" },
  riskLevel: { th: "ระดับความเสี่ยง", en: "Risk Level" },
  safe: { th: "0% ปลอดภัย", en: "0% Safe" },
  moderateScale: { th: "50% ปานกลาง", en: "50% Moderate" },
  critical: { th: "100% วิกฤต", en: "100% Critical" },
  activeRisks: { th: "ความเสี่ยงที่เกิดขึ้น", en: "Active Risks" },
  riskBreakdown: { th: "รายละเอียดความเสี่ยง (คลิกเพื่อขยาย)", en: "Risk Breakdown (click to expand)" },
  riskActiveNow: {
    th: "⚠ ความเสี่ยงนี้กำลังเกิดขึ้น — ต้องตรวจสอบทันที",
    en: "⚠ Risk currently active — immediate attention required",
  },
  aiModelBreakdown: { th: "รายละเอียดความผิดปกติจากโมเดล AI", en: "AI Model Anomaly Breakdown" },
  aiModelStatus: { th: "สถานะโมเดล AI", en: "AI Model Status" },
  noModelResults: {
    th: "ไม่มีข้อมูล model_results จาก API — risks ด้านบนคำนวณจาก state machine analysis โดยตรง",
    en: "No model_results from the API — the risks above are computed directly from state machine analysis",
  },
  lblIcpState: { th: "สถานะ ICP", en: "ICP State" },
  lblUslinkState: { th: "สถานะ USLink", en: "USLink State" },
} as const;

const tr = (k: keyof typeof T, lang: Lang) => T[k][lang];

// ── Risk calculation from real data ──────────────────────────────────────
function calcRisks(d: any, lang: Lang) {
  const t = d.telemetry ?? {};
  const th = lang === "th";

  return [
    {
      key: "icp_fault",
      label: th ? "ICP State ขัดข้อง" : "ICP State Fault",
      icon: "⚡",
      risk: d.icp_state === 9 ? 90 : d.icp_state === 10 ? 95 : d.icp_state === 6 ? 50 : 5,
      active: d.icp_state === 9 || d.icp_state === 10,
      value: `ICP: ${d.icp_state ?? "—"} (${d.icp_name ?? "—"})`,
      action: th
        ? "ตรวจสอบ CP signal voltage และ PLC contractor"
        : "Check CP signal voltage and PLC contractor",
    },
    {
      key: "uslink_fault",
      label: th ? "USLink Protocol ขัดข้อง" : "USLink Protocol Fault",
      icon: "📡",
      risk: d.uslink_state === 14 ? 80 : d.uslink_state === 4 ? 85 : d.uslink_state === 15 ? 20 : 5,
      active: d.uslink_state === 4 || d.uslink_state === 14,
      value: `USL: ${d.uslink_state ?? "—"} (${d.uslink_name ?? "—"})`,
      action: th
        ? "ตรวจสอบ EV-SECC communication และ ISO 15118 session"
        : "Check EV-SECC communication and ISO 15118 session",
    },
    {
      key: "plc1_fault",
      label: th ? "PLC 1 สื่อสารล้มเหลว" : "PLC 1 Communication Failure",
      icon: "🔌",
      risk: d.plc_status !== "Active" ? 65 : 2,
      active: d.plc_status !== "Active" && d.plc_status != null,
      value: `PLC1: ${d.plc_status ?? "—"}`,
      action: th
        ? "รีสตาร์ท PLC 1 และตรวจสอบ HomePlug GreenPHY signal"
        : "Restart PLC 1 and check the HomePlug GreenPHY signal",
    },
    {
      key: "plc2_fault",
      label: th ? "PLC 2 สื่อสารล้มเหลว" : "PLC 2 Communication Failure",
      icon: "🔌",
      risk: d.plc2_status !== "Active" ? 55 : 2,
      active: d.plc2_status !== "Active" && d.plc2_status != null,
      value: `PLC2: ${d.plc2_status ?? "—"}`,
      action: th
        ? "ตรวจสอบ PLC 2 connection และ firmware"
        : "Check PLC 2 connection and firmware",
    },
    {
      key: "mqtt_disc",
      label: th ? "MQTT Broker หลุดการเชื่อมต่อ" : "MQTT Broker Disconnected",
      icon: "🌐",
      risk: !d.mqtt_connected ? 40 : 2,
      active: !d.mqtt_connected && d.mqtt_connected != null,
      value: d.mqtt_connected ? "Connected" : "Disconnected",
      action: th
        ? "ตรวจสอบ network connection และ MQTT broker status"
        : "Check the network connection and MQTT broker status",
    },
    {
      key: "icp_inferred",
      label: th ? "ICP State มาจากการอนุมาน (ไม่ได้อ่านตรง)" : "ICP State Inferred (Not Direct)",
      icon: "🔍",
      risk: d.icp_inferred ? 30 : 3,
      active: !!d.icp_inferred,
      value: d.icp_inferred ? "Inferred from M4 telemetry" : "Direct read",
      action: th
        ? "ตรวจสอบการอ่านค่าจาก PLC โดยตรง — ICP state ควรมาจาก direct read"
        : "Check the direct PLC reading — ICP state should come from a direct read",
    },
    {
      key: "usl_inferred",
      label: th ? "USLink State มาจากการอนุมาน" : "USLink State Inferred",
      icon: "🔍",
      risk: d.usl_inferred ? 25 : 3,
      active: !!d.usl_inferred,
      value: d.usl_inferred ? "Inferred" : "Direct read",
      action: th
        ? "ตรวจสอบ USLink communication channel"
        : "Check the USLink communication channel",
    },
    {
      key: "welding",
      label: th ? "ตรวจจับหน้าสัมผัสเชื่อมติด" : "Contact Welding Detection",
      icon: "🔥",
      risk: d.icp_state === 9 ? 85 : (t.DC_contractor1 === 1 && d.icp_state === 0) ? 70 : 3,
      active: d.icp_state === 9 || (t.DC_contractor1 === 1 && d.icp_state === 0),
      value: `DC Cont: ${t.DC_contractor1 ?? "—"} | ICP: ${d.icp_state ?? "—"}`,
      action: th
        ? "WeldingDetection phase required — ตรวจสอบ DC contactors ทันที"
        : "WeldingDetection phase required — check DC contactors immediately",
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
  const { lang } = useLanguage();
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);

  if (!data) return null;
  const d = data as any;

  const risks = calcRisks(d, lang);
  const overallRisk  = Math.max(...risks.map((r) => r.risk));
  const activeRisks  = risks.filter((r) => r.active);
  const overallColor = overallRisk >= 70 ? "#dc2626" : overallRisk >= 30 ? "#d97706" : "#059669";
  const overallLabel = overallRisk >= 70 ? tr("highRisk", lang) : overallRisk >= 30 ? tr("moderate", lang) : tr("lowRisk", lang);

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
          <div style={{ fontSize: ".78em", fontWeight: 700, color: "#2d3748" }}>{tr("overallFailureRisk", lang)}</div>
          <div style={{ fontSize: ".72em", fontWeight: 800, color: overallColor, marginTop: 2 }}>{overallLabel}</div>
          <div style={{ fontSize: ".6em", color: "#94a3b8", marginTop: 2 }}>
            {activeRisks.length} {activeRisks.length !== 1 ? tr("activeRiskCountPlural", lang) : tr("activeRiskCount", lang)} · {risks.length} {tr("conditionsMonitored", lang)}
          </div>
        </div>
        {/* Risk bar */}
        <div style={{ flex: "0 0 200px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".58em", color: "#94a3b8", marginBottom: 4 }}>
            <span>{tr("riskLevel", lang)}</span>
            <span style={{ color: overallColor, fontWeight: 700 }}>{overallRisk}%</span>
          </div>
          <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${overallRisk}%`, height: "100%", borderRadius: 4,
              background: overallColor, transition: "width .8s",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".52em", color: "#94a3b8", marginTop: 3 }}>
            <span>{tr("safe", lang)}</span><span>{tr("moderateScale", lang)}</span><span>{tr("critical", lang)}</span>
          </div>
        </div>
      </div>

      {/* Active alerts */}
      {activeRisks.length > 0 && (
        <div style={{ background: "rgba(239,68,68,.04)", borderRadius: 12, border: "1px solid rgba(239,68,68,.2)", padding: "14px 16px" }}>
          <div style={{ fontSize: ".62em", fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 10 }}>
            🚨 {tr("activeRisks", lang)} ({activeRisks.length})
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
          {tr("riskBreakdown", lang)}
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
                      {tr("riskActiveNow", lang)}
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
            🤖 {tr("aiModelBreakdown", lang)}
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
            🤖 {tr("aiModelStatus", lang)}
          </div>
          <div style={{ fontSize: ".68em", color: "#94a3b8", lineHeight: 1.7 }}>
            {tr("noModelResults", lang)}
          </div>
          {/* State-based risk factors */}
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { l:tr("lblIcpState", lang),    v:d.icp_state,    sub:d.icp_name },
              { l:tr("lblUslinkState", lang), v:d.uslink_state, sub:d.uslink_name },
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