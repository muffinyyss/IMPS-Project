"use client";
import React from "react";
import { ModuleResult } from "../../lib/api";
import { DetCard, DetTitle, AutoPredictPanel } from "./DetectionLayout";

interface Props {
  data: ModuleResult | null;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

const ICP_STATES: Record<number, { name: string; color: string; desc: string }> = {
  0: { name: "Inactive", color: "#6b7280", desc: "ระบบไม่ทำงาน" },
  1: { name: "A1", color: "#94a3b8", desc: "Connector ยังไม่เสียบ (PWM off)" },
  2: { name: "B1", color: "#60a5fa", desc: "Connector เสียบแล้ว (PWM off)" },
  3: { name: "C1", color: "#34d399", desc: "รถพร้อมชาร์จ (PWM off)" },
  4: { name: "D1", color: "#6ee7b7", desc: "รถพร้อม + ระบายอากาศ" },
  5: { name: "A2", color: "#c084fc", desc: "Connector ยังไม่เสียบ (PWM on)" },
  6: { name: "B2", color: "#38bdf8", desc: "Connector เสียบแล้ว (PWM on)" },
  7: { name: "C2", color: "#22c55e", desc: "กำลังชาร์จอยู่" },
  8: { name: "D2", color: "#4ade80", desc: "ชาร์จ + ระบายอากาศ" },
  9: { name: "E", color: "#ef4444", desc: "CP=0V Fault" },
  10: { name: "Error", color: "#dc2626", desc: "State machine error" },
};

const USL_STATES: Record<number, { name: string; color: string }> = {
  0: { name: "Ready", color: "#059669" },
  1: { name: "Init", color: "#3b82f6" },
  2: { name: "SLAC ok", color: "#10b981" },
  3: { name: "SECC ok", color: "#34d399" },
  4: { name: "SupportedAppProtocol", color: "#6366f1" },
  5: { name: "SessionSetup", color: "#8b5cf6" },
  6: { name: "ServiceDiscovery", color: "#a78bfa" },
  7: { name: "ServicePaymentSelection", color: "#c4b5fd" },
  8: { name: "ContractAuthentication", color: "#e879f9" },
  9: { name: "ChargeParameterDiscovery", color: "#f0abfc" },
  10: { name: "CableCheck", color: "#f9a8d4" },
  11: { name: "PreCharge", color: "#fca5a5" },
  12: { name: "PowerDelivery", color: "#fcd34d" },
  13: { name: "CurrentDemand", color: "#fbbf24" },
  14: { name: "WeldingDetection", color: "#fb923c" },
  15: { name: "SessionStop", color: "#f97316" },
  16: { name: "ProtocolFinished", color: "#64748b" },
};

// ── Sequence step row (.sq-step pattern) ─────────────────────────────────
function SequenceSteps({
  current, states, maxId,
}: {
  current: number | null;
  states: Record<number, { name: string; color: string; desc?: string }>;
  maxId: number;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", overflowX: "auto",
      padding: "8px 0", gap: 0,
    }}>
      {Array.from({ length: maxId + 1 }, (_, i) => {
        const state = states[i];
        if (!state) return null;
        const isPast = current != null && i < current;
        const isCurrent = current != null && i === current;
        const isFuture = current == null || i > current;

        const nodeStyle: React.CSSProperties = {
          width: 32, height: 32, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: ".7em", fontWeight: 800,
          transition: "all .3s", flexShrink: 0,
          border: isCurrent
            ? `2px solid #0ea5e9`
            : isPast
              ? `2px solid ${state.color}`
              : `2px solid var(--color-border-tertiary,#d0dae8)`,
          background: isCurrent
            ? "#0ea5e9"
            : isPast
              ? `${state.color}15`
              : "var(--color-background-secondary,#f8fafc)",
          color: isCurrent
            ? "#fff"
            : isPast
              ? state.color
              : "var(--color-text-secondary,#94a3b8)",
          boxShadow: isCurrent ? `0 0 12px rgba(14,165,233,.4)` : undefined,
          opacity: isFuture && !isCurrent ? .5 : 1,
        };

        const lblStyle: React.CSSProperties = {
          fontSize: ".5em", fontWeight: isCurrent ? 700 : 600,
          color: isCurrent
            ? "#0ea5e9"
            : isPast
              ? state.color
              : "var(--color-text-secondary,#94a3b8)",
          marginTop: 3, whiteSpace: "nowrap", textAlign: "center",
          maxWidth: 52,
        };

        return (
          <React.Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 52 }}>
              <div style={nodeStyle} title={state.desc ?? ""}>
                {i}
              </div>
              <div style={lblStyle}>{state.name}</div>
            </div>
            {/* Wire between nodes */}
            {i < maxId && (
              <div style={{
                height: 2, flex: 1, minWidth: 8,
                background: isPast ? state.color : "var(--color-border-tertiary,#d0dae8)",
                margin: "0 -1px", marginBottom: 18,
                transition: "background .3s",
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Contractor LED ────────────────────────────────────────────────────────
function ContractorLed({ label, val }: { label: string; val: number | null }) {
  const on = val === 1;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 12px", borderRadius: 8,
      background: on ? "rgba(34,197,94,.05)" : "rgba(100,116,139,.04)",
      border: `1px solid ${on ? "rgba(34,197,94,.2)" : "var(--color-border-tertiary,#d0dae8)"}`,
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
        background: on ? "#22c55e" : "#94a3b8",
        boxShadow: on ? "0 0 6px #22c55e" : undefined,
      }} />
      <span style={{ fontSize: ".68em", fontWeight: 600, flex: 1 }}>{label}</span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: ".65em", fontWeight: 700,
        color: on ? "#16a34a" : "#94a3b8",
      }}>{val ?? "—"}</span>
    </div>
  );
}

export default function M7StateMonitorTab({ data, countdown, isPaused, onTogglePause }: Props) {
  if (!data || data.error) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary,#94a3b8)" }}>
      ไม่มีข้อมูล State Monitor
    </div>
  );

  const d = data as any;
  const t = d.telemetry ?? {};
  const icpS = ICP_STATES[d.icp_state];
  const uslS = USL_STATES[d.uslink_state];

  return (

    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <AutoPredictPanel
        badge={data.error ? "error" : "done"}
        countdown={countdown}
        enabled={!isPaused}
        onToggle={onTogglePause}
        predictedAt={data._result_ts ? new Date(data._result_ts).toLocaleTimeString("th-TH") : undefined}
        result={`ICP:${d.icp_state ?? "—"} USL:${d.uslink_state ?? "—"}`}
      />
      {/* Current state summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <DetCard style={{
          padding: 20,
          borderTop: `3px solid ${icpS?.color ?? "#6b7280"}`,
        }}>
          <DetTitle>⚡ ICP State</DetTitle>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "1.4em", fontWeight: 900, color: "#fff", flexShrink: 0,
              background: icpS?.color ?? "#6b7280",
              boxShadow: `0 4px 12px ${icpS?.color ?? "#6b7280"}44`,
            }}>{d.icp_state ?? "—"}</div>
            <div>
              <div style={{ fontSize: ".9em", fontWeight: 800, color: "var(--color-text-primary,#2d3748)" }}>
                {icpS?.name ?? "Unknown"}
              </div>
              {icpS?.desc && (
                <div style={{ fontSize: ".65em", color: "var(--color-text-secondary,#718096)", marginTop: 2 }}>
                  {icpS.desc}
                </div>
              )}
              {d.icp_inferred && (
                <div style={{
                  marginTop: 4, fontSize: ".58em", fontWeight: 700,
                  color: "#d97706", display: "flex", alignItems: "center", gap: 4,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#d97706" }} />
                  Inferred (not direct read)
                </div>
              )}
            </div>
          </div>
        </DetCard>

        <DetCard style={{
          padding: 20,
          borderTop: `3px solid ${uslS?.color ?? "#6b7280"}`,
        }}>
          <DetTitle>🔗 USLink State</DetTitle>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "1.4em", fontWeight: 900, color: "#fff", flexShrink: 0,
              background: uslS?.color ?? "#6b7280",
            }}>{d.uslink_state ?? "—"}</div>
            <div>
              <div style={{ fontSize: ".9em", fontWeight: 800, color: "var(--color-text-primary,#2d3748)" }}>
                {uslS?.name ?? "Unknown"}
              </div>
              {d.usl_inferred && (
                <div style={{ marginTop: 4, fontSize: ".58em", fontWeight: 700, color: "#d97706" }}>
                  Inferred
                </div>
              )}
            </div>
          </div>
        </DetCard>
      </div>

      {/* ICP Sequence */}
      <DetCard accent="#ec4899">
        <DetTitle>⚡ ICP State Sequence (IEC 61851-1)</DetTitle>
        <SequenceSteps current={d.icp_state} states={ICP_STATES} maxId={10} />
        <div style={{ marginTop: 8, fontSize: ".6em", color: "var(--color-text-secondary,#94a3b8)" }}>
          <span style={{ color: "#22c55e", fontWeight: 700 }}>● past</span>
          {"  "}
          <span style={{ color: "#0ea5e9", fontWeight: 700 }}>● current</span>
          {"  "}
          <span style={{ color: "#94a3b8" }}>● future</span>
        </div>
      </DetCard>

      {/* USLink Sequence */}
      <DetCard accent="#ec4899">
        <DetTitle>🔗 USLink State Sequence (ISO 15118-2)</DetTitle>
        <SequenceSteps current={d.uslink_state} states={USL_STATES} maxId={16} />
      </DetCard>

      {/* V2G Communication Sequence */}
      <DetCard accent="#ec4899">
        <DetTitle>🔄 V2G Communication Sequence (ISO 15118 DC Charging)</DetTitle>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, padding: "8px 0" }}>
          {[
            { uslink: 2, label: "SLAC" },
            { uslink: 3, label: "SECC" },
            { uslink: 4, label: "AppProto" },
            { uslink: 5, label: "Session" },
            { uslink: 6, label: "SvcDisc" },
            { uslink: 7, label: "Payment" },
            { uslink: 8, label: "Auth" },
            { uslink: 9, label: "ParamDisc" },
            { uslink: 10, label: "CableChk" },
            { uslink: 11, label: "PreCharge" },
            { uslink: 12, label: "PowerDlv" },
            { uslink: 13, label: "CurDemand" },
            { uslink: 14, label: "Welding" },
            { uslink: 15, label: "Stop" },
          ].map((step, i, arr) => {
            const color = USL_STATES[step.uslink]?.color ?? "#6b7280";
            const isPast = d.uslink_state != null && step.uslink < d.uslink_state;
            const isCurr = d.uslink_state === step.uslink;
            return (
              <React.Fragment key={step.uslink}>
                <div style={{
                  padding: "4px 8px", borderRadius: 6, fontSize: ".6em", fontWeight: isCurr ? 800 : 600,
                  background: isCurr ? color : isPast ? `${color}18` : "#f1f5f9",
                  color: isCurr ? "#fff" : isPast ? color : "#94a3b8",
                  border: isCurr ? `1px solid ${color}` : `1px solid ${isPast ? `${color}30` : "#e2e8f0"}`,
                  boxShadow: isCurr ? `0 0 8px ${color}44` : undefined,
                  opacity: !isPast && !isCurr ? .5 : 1,
                  transition: "all .3s",
                  whiteSpace: "nowrap" as const,
                }}>
                  {step.label}
                </div>
                {i < arr.length - 1 && (
                  <span style={{ color: isPast ? color : "#d0dae8", fontSize: ".6em" }}>▶</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </DetCard>

      {/* Connectivity + Contractors */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <DetCard accent="#ec4899">
          <DetTitle>📡 Connectivity</DetTitle>
          {[
            { label: "PLC 1", val: d.plc_status === "Active" ? 1 : 0, raw: d.plc_status },
            { label: "PLC 2", val: d.plc2_status === "Active" ? 1 : 0, raw: d.plc2_status },
            { label: "MQTT", val: d.mqtt_connected ? 1 : 0, raw: d.mqtt_connected ? "Connected" : "Disconnected" },
          ].map((item) => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: "1px solid var(--color-border-tertiary,#d0dae8)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: item.val === 1 ? "#22c55e" : "#ef4444",
                  boxShadow: item.val === 1 ? "0 0 6px #22c55e" : undefined,
                }} />
                <span style={{ fontSize: ".72em", fontWeight: 600 }}>{item.label}</span>
              </div>
              <span style={{
                fontSize: ".65em", fontWeight: 700,
                color: item.val === 1 ? "#16a34a" : "#dc2626",
                fontFamily: "'JetBrains Mono', monospace",
              }}>{item.raw ?? "—"}</span>
            </div>
          ))}
        </DetCard>

        <DetCard accent="#ec4899">
          <DetTitle>🔌 Contractor Status</DetTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ContractorLed label="AC Magnetic 1" val={t.AC_magnetic_contractor1 ?? null} />
            <ContractorLed label="DC Contractor 1" val={t.DC_contractor1 ?? null} />
            <ContractorLed label="DC Contractor 2" val={t.DC_contractor2 ?? null} />
            <ContractorLed label="DC Contractor 3" val={t.DC_contractor3 ?? null} />
          </div>
        </DetCard>
      </div>

      {/* Power telemetry */}
      <DetCard accent="#ec4899">
        <DetTitle>⚡ Power Telemetry</DetTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8 }}>
          {[
            { label: "Voltage H1", val: t.presentVoltage1 ?? t.present_voltage1, unit: "V" },
            { label: "Voltage H2", val: t.presentVoltage2 ?? t.present_voltage2, unit: "V" },
            { label: "Current H1", val: t.presentCurrent1 ?? t.present_current1, unit: "A" },
            { label: "Current H2", val: t.presentCurrent2 ?? t.present_current2, unit: "A" },
            { label: "PM Temp 1", val: t.tempPowerModule1 ?? t.power_module_temp1, unit: "°C" },
            { label: "PM Temp 2", val: t.tempPowerModule2 ?? t.power_module_temp2, unit: "°C" },
            { label: "SOC", val: t.SOC, unit: "%" },
            { label: "Charger Temp", val: t.chargerTemp ?? t.charger_temp, unit: "°C" },
          ].map((item) => (
            <div key={item.label} style={{
              padding: "10px 12px", borderRadius: 8, textAlign: "center",
              background: "var(--color-background-secondary,#f8fafc)",
              border: "1px solid var(--color-border-tertiary,#d0dae8)",
            }}>
              <div style={{ fontSize: ".58em", color: "var(--color-text-secondary,#718096)", fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.1em", fontWeight: 800 }}>
                {item.val ?? "--"}
              </div>
              <div style={{ fontSize: ".52em", color: "var(--color-text-secondary,#94a3b8)" }}>{item.unit}</div>
            </div>
          ))}
        </div>
      </DetCard>
      {/* Anomaly Detection Results */}
      {d.model_results && Object.keys(d.model_results).length > 0 && (
        <DetCard accent="#ec4899">
          <DetTitle>🧠 Anomaly Detection Results</DetTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
            {Object.entries(d.model_results).map(([key, val]: any) => {
              const isAnomaly = val?.anomaly === true;
              const score = val?.score ?? val?.confidence ?? null;
              return (
                <div key={key} style={{
                  padding: "10px 12px", borderRadius: 8,
                  background: isAnomaly ? "rgba(239,68,68,.04)" : "rgba(34,197,94,.04)",
                  border: `1px solid ${isAnomaly ? "rgba(239,68,68,.2)" : "rgba(34,197,94,.2)"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: isAnomaly ? "#ef4444" : "#22c55e", boxShadow: `0 0 5px ${isAnomaly ? "#ef4444" : "#22c55e"}88`, flexShrink: 0 }} />
                    <span style={{ fontSize: ".65em", fontWeight: 700, color: "#2d3748", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                      {key}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: ".6em", fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: isAnomaly ? "rgba(239,68,68,.1)" : "rgba(34,197,94,.1)", color: isAnomaly ? "#dc2626" : "#16a34a" }}>
                      {isAnomaly ? "ANOMALY" : "NORMAL"}
                    </span>
                    {score != null && (
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".62em", color: "#94a3b8" }}>
                        {score.toFixed(3)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DetCard>
      )}
    </div>
  );
}