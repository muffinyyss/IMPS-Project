"use client";
import React from "react";
import { ModuleResult } from "../../lib/api";
import { getHealthColor } from "../../lib/constants";
import {
  AutoPredictPanel, HealthSummaryBar, ModelNode,
  ConditionItem, DeviceLedNode, DetCard, DetTitle, ScoreBar,
} from "./DetectionLayout";

interface Props {
  data: ModuleResult | null; modNum: number; modColor: string;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

// ── M2 — Charger Filter Detection ────────────────────────────────────────
function M2Content({ data, countdown, isPaused, onTogglePause }: {
  data: ModuleResult;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}) {
  const d = (data as any).data ?? {};

  const models = [
    { id: "A1", type: "ML" as const, name: "XGBoost Regressor", sub: "Clogging Score 0–1", val: (data as any).model_scores?.A1 },
    { id: "A2", type: "ML" as const, name: "XGBoost Classifier", sub: "5-Level Clog Class", val: (data as any).model_scores?.A2 },
    { id: "C", type: "DL" as const, name: "DNN Classifier", sub: "5-Class SMOTE", val: (data as any).model_scores?.C },
    { id: "D", type: "DL" as const, name: "BiLSTM-Attention", sub: "Temporal Degradation", val: (data as any).model_scores?.D },
    { id: "B", type: "DL" as const, name: "Autoencoder", sub: "Reconstruction Anomaly", val: (data as any).model_scores?.B },
    { id: "E", type: "ML" as const, name: "IF + LOF Ensemble", sub: "Isolation Forest + LOF", val: (data as any).model_scores?.E },
  ];

  const conditions = [
    { id: "C01", name: "PM Temp 1 Derating", type: "Hybrid" as const, val: d.power_module_temp1, threshold: 55 },
    { id: "C02", name: "PM Temp 2 Derating", type: "Hybrid" as const, val: d.power_module_temp2, threshold: 55 },
    { id: "C03", name: "PM Temp 3 Derating", type: "Hybrid" as const, val: d.power_module_temp3, threshold: 55 },
    { id: "C04", name: "PM Temp 4 Derating", type: "Hybrid" as const, val: d.power_module_temp4, threshold: 55 },
    { id: "C05", name: "PM Temp 5 Derating", type: "Hybrid" as const, val: d.power_module_temp5, threshold: 55 },
    { id: "C06", name: "Fan Group A (1-4)", type: "Rule" as const, val: null, threshold: null },
    { id: "C07", name: "Fan Group B (5-8)", type: "Rule" as const, val: null, threshold: null },
    { id: "C08", name: "Fan RPM Anomaly", type: "Rule" as const, val: null, threshold: null },
    { id: "C09", name: "Thermal Resistance", type: "Hybrid" as const, val: null, threshold: null },
    { id: "C10", name: "EdgeBox Temp", type: "Rule" as const, val: d.edgebox_temp, threshold: 70 },
    { id: "C11", name: "Humidity Cond. Risk", type: "Rule" as const, val: d.humidity, threshold: 80 },
    { id: "C12", name: "DFC Overdue", type: "Rule" as const, val: null, threshold: null },
    { id: "C13", name: "Voltage Deviation H1", type: "Hybrid" as const, val: null, threshold: null },
    { id: "C14", name: "Voltage Deviation H2", type: "Hybrid" as const, val: null, threshold: null },
    { id: "C15", name: "Energy Throughput", type: "AI" as const, val: null, threshold: null },
  ];

  const health = data.health ?? null;
  const riskScore = (data as any).ensemble_risk ?? (data as any).risk_score;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <AutoPredictPanel
        badge={(data as any).status === "ok" ? "done" : "IDLE"}
        countdown={countdown}
        enabled={!isPaused}
        onToggle={onTogglePause}
        predictedAt={data._result_ts ? new Date(data._result_ts).toLocaleTimeString("th-TH") : undefined}
        result={riskScore != null ? `${(riskScore * 100).toFixed(1)}%` : "—"}
      />

      <HealthSummaryBar
        normal={models.filter((m) => !m.val || m.val < 0.5).length}
        warning={models.filter((m) => m.val && m.val >= 0.5 && m.val < 0.75).length}
        alarm={models.filter((m) => m.val && m.val >= 0.75).length}
        total={models.length}
      />

      {/* AI Models */}
      <DetCard accent="#0891b2">
        <DetTitle>🤖 AI Model Status Tree</DetTitle>
        {models.map((m) => (
          <ModelNode key={m.id} id={m.id} type={m.type} name={m.name} sub={m.sub}
            value={m.val != null ? m.val.toFixed(3) : "—"}
            status={m.val == null ? "IDLE" : m.val >= 0.75 ? "CRIT" : m.val >= 0.5 ? "WARN" : "OK"}
          />
        ))}
      </DetCard>

      {/* Conditions */}
      <DetCard accent="#0891b2">
        <DetTitle>🏥 Condition Health Tree (C01–C15)</DetTitle>
        {conditions.map((c) => {
          const st =
            c.threshold != null && c.val != null && Number(c.val) >= c.threshold
              ? "WARN" : "OK";
          return (
            <ConditionItem key={c.id} id={c.id} name={c.name} type={c.type} status={st} />
          );
        })}
      </DetCard>

      {/* Telemetry */}
      <DetCard accent="#0891b2">
        <DetTitle>📡 Live Telemetry</DetTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => {
            const v = d[`power_module_temp${i}`];
            const color = v > 55 ? "#ef4444" : v > 45 ? "#f97316" : "#059669";
            return (
              <div key={i} style={{
                padding: "10px 12px", borderRadius: 8, textAlign: "center",
                background: "var(--color-background-secondary,#f8fafc)",
                border: `1px solid var(--color-border-tertiary,#d0dae8)`,
                borderLeft: `3px solid ${color}`,
              }}>
                <div style={{ fontSize: ".58em", color: "var(--color-text-secondary,#718096)", fontWeight: 600 }}>PM Temp {i}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.2em", fontWeight: 800, color }}>
                  {v ?? "--"}
                </div>
                <div style={{ fontSize: ".52em", color: "var(--color-text-secondary,#94a3b8)" }}>°C</div>
              </div>
            );
          })}
          <div style={{ padding: "10px 12px", borderRadius: 8, textAlign: "center", background: "var(--color-background-secondary,#f8fafc)", border: "1px solid var(--color-border-tertiary,#d0dae8)" }}>
            <div style={{ fontSize: ".58em", color: "var(--color-text-secondary,#718096)", fontWeight: 600 }}>SOC</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.2em", fontWeight: 800 }}>{d.SOC ?? "--"}</div>
            <div style={{ fontSize: ".52em", color: "var(--color-text-secondary,#94a3b8)" }}>%</div>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: 8, textAlign: "center", background: "var(--color-background-secondary,#f8fafc)", border: "1px solid var(--color-border-tertiary,#d0dae8)" }}>
            <div style={{ fontSize: ".58em", color: "var(--color-text-secondary,#718096)", fontWeight: 600 }}>Humidity</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.2em", fontWeight: 800 }}>{d.humidity ?? "--"}</div>
            <div style={{ fontSize: ".52em", color: "var(--color-text-secondary,#94a3b8)" }}>%</div>
          </div>
        </div>
      </DetCard>
    </div>
  );
}

// ── M3 — Charger Offline Detection ───────────────────────────────────────
function M3Content({ data, countdown, isPaused, onTogglePause }: {
  data: ModuleResult;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}) {
  const d = (data as any).data ?? {};
  const rootCause = (data as any).root_cause ?? d.root_cause ?? "NORMAL";
  const onlineCount = (data as any).online_count ?? d.online_count ?? 0;
  const totalDevices = (data as any).total_devices ?? d.total_devices ?? 6;
  const earlyWarning = (data as any).early_warning ?? false;

  const rootCauseColor: Record<string, string> = {
    NORMAL: "#22c55e", NETWORK_FAILURE: "#dc2626", POWER_OUTAGE: "#dc2626",
    PLC_FAULT: "#d97706", EDGEBOX_CRASH: "#d97706", SCHEDULED_MAINTENANCE: "#0284c7",
  };

  const devices = [
    { key: "edgebox_status", icon: "💻", name: "EdgeBox", val: d.edgebox_status },
    { key: "router_status", icon: "📡", name: "Router", val: d.router_status },
    { key: "PLC1_status", icon: "🔌", name: "PLC 1", val: d.PLC1_status },
    { key: "PLC2_status", icon: "🔌", name: "PLC 2", val: d.PLC2_status },
    { key: "MDB_status", icon: "⚡", name: "MDB", val: d.MDB_status },
    { key: "energy_meter_status", icon: "📊", name: "Energy Meter", val: d.energy_meter_status },
  ];

  const conditions = [
    { id: "C01", name: "Voltage Phase A (VL1N_MDB)", type: "Hybrid" as const, val: d.VL1N_MDB, threshold: 0.1 },
    { id: "C02", name: "Voltage Phase B (VL2N_MDB)", type: "Hybrid" as const, val: d.VL2N_MDB, threshold: 0.1 },
    { id: "C03", name: "Voltage Phase C (VL3N_MDB)", type: "Hybrid" as const, val: d.VL3N_MDB, threshold: 0.1 },
    { id: "C04", name: "Current Phase A (I1_MDB)", type: "Hybrid" as const, val: null, threshold: null },
    { id: "C05", name: "Current Phase B (I2_MDB)", type: "Hybrid" as const, val: null, threshold: null },
    { id: "C06", name: "Current Phase C (I3_MDB)", type: "Hybrid" as const, val: null, threshold: null },
    { id: "C07", name: "Edgebox Status", type: "AI" as const, val: null, threshold: null },
    { id: "C08", name: "Router Internet", type: "AI" as const, val: null, threshold: null },
    { id: "C09", name: "Router Status", type: "AI" as const, val: null, threshold: null },
    { id: "C10", name: "RSSI Signal", type: "AI" as const, val: null, threshold: null },
    { id: "C11", name: "PLC1 Status", type: "Rule" as const, val: d.PLC1_status, threshold: null },
    { id: "C12", name: "PLC2 Status", type: "Rule" as const, val: d.PLC2_status, threshold: null },
    { id: "C13", name: "MDB Status", type: "Rule" as const, val: d.MDB_status, threshold: null },
    { id: "C14", name: "Energy Meter", type: "Rule" as const, val: d.energy_meter_status, threshold: null },
    { id: "C15", name: "Edgebox Temp", type: "AI" as const, val: d.edgebox_temp, threshold: 30 },
  ];

  const isOffline = (v: string | undefined) =>
    v == null || ["inactive", "offline", "0"].includes(String(v).toLowerCase());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <AutoPredictPanel
        badge={data.error ? "error" : "done"}
        countdown="120s"
        predictedAt={data._result_ts ? new Date(data._result_ts).toLocaleTimeString("th-TH") : undefined}
        result={`${onlineCount}/${totalDevices} online`}
      />

      {/* Early warning */}
      {earlyWarning && (
        <div style={{
          padding: "10px 16px", borderRadius: 10, marginBottom: 12,
          background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)",
          display: "flex", alignItems: "center", gap: 8, fontSize: ".75em",
        }}>
          <span style={{ fontSize: "1.3em" }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, color: "#dc2626" }}>Early Warning Detected</div>
            <div style={{ color: "var(--color-text-secondary,#718096)", fontSize: ".9em" }}>
              Potential offline event predicted ~2 minutes ahead
            </div>
          </div>
        </div>
      )}

      {/* Root cause */}
      <DetCard accent="#7c3aed">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <DetTitle>🔍 Root Cause Analysis</DetTitle>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "1.3em", fontWeight: 800,
              color: rootCauseColor[rootCause] ?? "#718096",
            }}>{rootCause}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: ".58em", color: "var(--color-text-secondary,#718096)", marginBottom: 4 }}>
              Online
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "2em", fontWeight: 900,
              color: onlineCount === totalDevices ? "#22c55e" : "#ef4444",
            }}>
              {onlineCount}/{totalDevices}
            </div>
          </div>
        </div>
      </DetCard>

      {/* Device grid */}
      <DetCard accent="#7c3aed">
        <DetTitle>📡 Device Status Grid</DetTitle>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))",
          gap: 8,
        }}>
          {devices.map((dev) => (
            <DeviceLedNode
              key={dev.key} icon={dev.icon} name={dev.name}
              status={dev.val ?? "—"}
            />
          ))}
        </div>
      </DetCard>

      {/* Conditions */}
      <DetCard accent="#7c3aed">
        <DetTitle>📋 Condition Reference (C01–C15)</DetTitle>
        {conditions.map((c) => {
          let st: "OK" | "WARN" | "CRIT" = "OK";
          if (c.id === "C15" && c.val != null && Number(c.val) < 30) st = "WARN";
          else if (["C11", "C12", "C13", "C14"].includes(c.id) && isOffline(c.val as string)) st = "CRIT";
          return <ConditionItem key={c.id} id={c.id} name={c.name} type={c.type} status={st} />;
        })}
      </DetCard>
    </div>
  );
}

// ── M5 — Network Problem ─────────────────────────────────────────────────
function M5Content({ data, countdown, isPaused, onTogglePause }: {
  data: ModuleResult;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}) {
  const d = (data as any).data ?? {};
  const rootCause = (data as any).root_cause ?? d.root_cause ?? "NORMAL";
  const severity = (data as any).severity ?? d.severity ?? 0;
  const onlineCount = (data as any).online_count ?? d.online_count ?? 0;

  const devices = [
    { key: "router", icon: "📡", name: "Router", val: d.router_status },
    { key: "plc1", icon: "🔌", name: "PLC 1", val: d.PLC_network_status1 ?? d.PLC1_status },
    { key: "plc2", icon: "🔌", name: "PLC 2", val: d.PLC_network_status2 ?? d.PLC2_status },
    { key: "edgebox", icon: "💻", name: "EdgeBox", val: d.edgebox_network_status ?? d.edgebox_status },
    { key: "pi5", icon: "🖥️", name: "Pi5", val: d.pi5_network_status ?? d.pi5_status },
    { key: "meter", icon: "📊", name: "Energy Meter", val: d.energy_meter_network_status1 ?? d.energy_meter_status },
  ];

  const conditions = [
    { id: "C01", name: "Router Status", type: "Rule" as const, val: d.router_status },
    { id: "C02", name: "PLC1 Network Status", type: "Hybrid" as const, val: d.PLC_network_status1 },
    { id: "C03", name: "PLC2 Network Status", type: "Hybrid" as const, val: d.PLC_network_status2 },
    { id: "C04", name: "EdgeBox Network", type: "AI" as const, val: d.edgebox_network_status },
    { id: "C05", name: "Pi5 Network", type: "AI" as const, val: d.pi5_network_status },
    { id: "C06", name: "Energy Meter 1 Network", type: "Rule" as const, val: d.energy_meter_network_status1 },
    { id: "C07", name: "Energy Meter 2 Network", type: "Rule" as const, val: d.energy_meter_network_status2 },
    { id: "C08", name: "Router Internet Status", type: "AI" as const, val: null },
    { id: "C09", name: "RSSI Signal Strength", type: "AI" as const, val: null },
    { id: "C10", name: "MQTT Broker Connection", type: "Rule" as const, val: null },
    { id: "C11", name: "Anomaly Score Threshold", type: "AI" as const, val: null },
    { id: "C12", name: "Composite Severity", type: "AI" as const, val: null },
  ];

  const isOffline = (v: string | undefined) =>
    v == null || ["inactive", "offline", "disconnected", "0"].includes(String(v).toLowerCase());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <AutoPredictPanel
        badge={data.error ? "error" : "done"}
        countdown="120s"
        predictedAt={data._result_ts ? new Date(data._result_ts).toLocaleTimeString("th-TH") : undefined}
        result={rootCause}
      />

      {/* Severity + Root Cause */}
      <DetCard accent="#2563eb">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <DetTitle>🔍 Root Cause</DetTitle>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "1.1em", fontWeight: 800,
              color: rootCause === "NORMAL" ? "#22c55e" : "#dc2626",
            }}>{rootCause}</div>
          </div>
          <div>
            <DetTitle>📊 Severity Score</DetTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 8, background: "var(--color-border-tertiary,#d0dae8)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${severity * 100}%`, height: "100%",
                  background: severity > 0.7 ? "#dc2626" : severity > 0.4 ? "#d97706" : "#22c55e",
                  transition: "width .5s", borderRadius: 4,
                }} />
              </div>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: ".82em",
                color: severity > 0.7 ? "#dc2626" : severity > 0.4 ? "#d97706" : "#22c55e",
              }}>{(severity * 100).toFixed(1)}%</span>
            </div>
            <div style={{ marginTop: 8, fontSize: ".62em", color: "var(--color-text-secondary,#718096)" }}>
              <span style={{ color: "#22c55e", fontWeight: 700 }}>🟢 Online: {onlineCount}/6</span>
              {"  "}
              <span style={{ color: "#ef4444", fontWeight: 700 }}>🔴 Offline: {6 - onlineCount}</span>
            </div>
          </div>
        </div>
      </DetCard>

      {/* Network topology */}
      <DetCard accent="#2563eb">
        <DetTitle>🌐 Network Topology</DetTitle>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))",
          gap: 8,
        }}>
          {devices.map((dev) => (
            <DeviceLedNode
              key={dev.key} icon={dev.icon} name={dev.name}
              status={dev.val ?? "—"} size="sm"
            />
          ))}
        </div>
      </DetCard>

      {/* Conditions */}
      <DetCard accent="#2563eb">
        <DetTitle>📋 Monitoring Conditions</DetTitle>
        {conditions.map((c) => {
          const st: "OK" | "WARN" | "CRIT" = isOffline(c.val as string) && c.val != null ? "CRIT" : "OK";
          return <ConditionItem key={c.id} id={c.id} name={c.name} type={c.type} status={st} />;
        })}
      </DetCard>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────
export default function DetectionTab({ data, modNum, modColor, countdown, isPaused, onTogglePause }: Props) {
  if (!data) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary,#94a3b8)", fontSize: ".8em" }}>
      กำลังโหลด...
    </div>
  );

  if (modNum === 2) return <M2Content data={data} countdown={countdown} isPaused={isPaused} onTogglePause={onTogglePause} />;
  if (modNum === 3) return <M3Content data={data} countdown={countdown} isPaused={isPaused} onTogglePause={onTogglePause} />;
  if (modNum === 5) return <M5Content data={data} countdown={countdown} isPaused={isPaused} onTogglePause={onTogglePause} />;

  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary,#94a3b8)" }}>
      No detection view for module {modNum}
    </div>
  );
}