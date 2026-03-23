"use client";
import React from "react";
import { ModuleResult } from "../../lib/api";
import { DetCard, DetTitle } from "./DetectionLayout";

interface Props {
  data: ModuleResult | null;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

function AnomalyRingGauge({ score, flags }: { score: number; flags: number }) {
  const CRC    = 2 * Math.PI * 72;
  const offset = CRC - CRC * Math.min(score, 1);
  const color  = score > 0.7 ? "#dc2626" : score > 0.4 ? "#d97706" : "#059669";
  const severity =
    flags === 0 ? "NORMAL" : flags <= 2 ? "MEDIUM" : flags <= 5 ? "HIGH" : "CRITICAL";
  const sevColors: Record<string, string> = {
    NORMAL: "#059669", MEDIUM: "#d97706", HIGH: "#f97316", CRITICAL: "#dc2626",
  };
  const sevColor = sevColors[severity];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 180, height: 180 }}>
        <svg viewBox="0 0 180 180" style={{ width: 180, height: 180 }}>
          <circle cx="90" cy="90" r="72" fill="none" stroke="#d0dae8" strokeWidth="14" />
          <circle
            cx="90" cy="90" r="72" fill="none"
            stroke={color} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={String(CRC)}
            strokeDashoffset={String(offset)}
            style={{
              transition: "stroke-dashoffset .8s ease, stroke .5s ease",
              filter: `drop-shadow(0 0 6px ${color}66)`,
              transform: "rotate(-90deg)",
              transformOrigin: "center",
            }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.6em", fontWeight: 900, color, lineHeight: 1 }}>
            {(score * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: ".6em", color: "#718096", fontWeight: 600, marginTop: 2 }}>Anomaly Score</div>
          <div style={{ marginTop: 6, padding: "2px 10px", borderRadius: 20, fontSize: ".62em", fontWeight: 800, background: `${sevColor}15`, color: sevColor, border: `1px solid ${sevColor}30` }}>
            {severity}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".62em", color: "#718096", fontFamily: "'JetBrains Mono',monospace" }}>
        <span>Anomaly Flags:</span>
        <span style={{ fontWeight: 800, color: flags > 0 ? "#dc2626" : "#059669" }}>{flags}</span>
        <span>/ 22 conditions</span>
      </div>
    </div>
  );
}

function GroupBar({ label, score, icon, accentColor }: { label: string; score: number; icon: string; accentColor: string }) {
  const barColor = score > 0.7 ? "#dc2626" : score > 0.4 ? "#d97706" : "#059669";
  return (
    <div style={{ padding: "8px 10px", borderRadius: 8, marginBottom: 4, background: "#f8fafc", borderLeft: `3px solid ${accentColor}55` }}>
      <div style={{ fontSize: ".6em", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "1.5px", color: accentColor, marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
        <span>{icon}</span><span>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: "#d0dae8", borderRadius: 3 }}>
          <div style={{ width: `${Math.min(100, score * 100)}%`, height: "100%", borderRadius: 3, background: barColor, transition: "width .6s" }} />
        </div>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".8em", fontWeight: 700, color: barColor, minWidth: 44 }}>
          {score.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

function TelCard({ label, value, unit, warn, target }: { label: string; value: number | null; unit: string; warn?: number; target?: number | null }) {
  const isWarn = warn != null && value != null && value >= warn;
  const color  = isWarn ? "#dc2626" : "#059669";
  const diff   = target != null && value != null ? Math.abs(target - value).toFixed(1) : null;
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, textAlign: "center", background: isWarn ? "rgba(239,68,68,.04)" : "#f8fafc", border: `1px solid ${isWarn ? "rgba(239,68,68,.2)" : "#d0dae8"}` }}>
      <div style={{ fontSize: ".58em", color: "#718096", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.2em", fontWeight: 800, color }}>{value ?? "--"}</div>
      <div style={{ fontSize: ".52em", color: "#94a3b8" }}>
        {unit}
        {diff != null && (
          <span style={{ marginLeft: 4, color: Number(diff) > 10 ? "#f97316" : "#94a3b8" }}>Δ{diff}</span>
        )}
      </div>
    </div>
  );
}

export default function M4LiveMonitorTab({ data }: Props) {
  if (!data || data.error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: ".8em" }}>
        ไม่มีข้อมูล Live Monitor
      </div>
    );
  }

  const d         = (data as any).data ?? {};
  const flags     = Number((data as any).anomaly_flags ?? 0);
  const score     = Math.max(0, Math.min(1, flags / 22));
  const groups    = (data as any).group_scores ?? {};
  const modelDt   = (data as any).model_details ?? {};
  const showAlert = flags > 0;

  const alertColor = flags > 3 ? "#dc2626" : "#d97706";
  const alertBg    = flags > 3 ? "rgba(239,68,68,.06)" : "rgba(217,119,6,.06)";
  const alertBorder = flags > 3 ? "rgba(239,68,68,.33)" : "rgba(217,119,6,.33)";

  const groupDefs = [
    { key: "anomaly_voltage",  label: "Voltage",       icon: "⚡", color: "#0284c7" },
    { key: "anomaly_current",  label: "Current",       icon: "🔋", color: "#0891b2" },
    { key: "anomaly_power",    label: "Power",         icon: "💡", color: "#7c3aed" },
    { key: "anomaly_soc",      label: "SOC",           icon: "🔌", color: "#059669" },
    { key: "anomaly_thermal",  label: "Thermal",       icon: "🌡️", color: "#dc2626" },
    { key: "anomaly_comm",     label: "Communication", icon: "📡", color: "#d97706" },
    { key: "anomaly_energy",   label: "Energy",        icon: "📊", color: "#0891b2" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Alert banner */}
      {showAlert && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, marginBottom: 14, background: alertBg, border: `1px solid ${alertBorder}`, fontSize: ".78em" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${alertColor}15`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color: alertColor, flexShrink: 0 }}>
            {flags}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: alertColor }}>
              {flags} Anomaly Flag{flags > 1 ? "s" : ""} Detected
            </div>
            <div style={{ color: "#718096", fontSize: ".9em" }}>
              ตรวจสอบค่าผิดปกติในการจ่ายไฟ
            </div>
          </div>
        </div>
      )}

      {/* Ring gauge + group bars */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14, marginBottom: 14 }}>
        <DetCard style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <AnomalyRingGauge score={score} flags={flags} />
        </DetCard>

        <DetCard accent="#d97706">
          <DetTitle>📊 Detection Group Scores</DetTitle>
          {groupDefs.map((g) => (
            <GroupBar
              key={g.key}
              label={g.label}
              icon={g.icon}
              score={groups[g.key] ?? modelDt[g.key] ?? 0}
              accentColor={g.color}
            />
          ))}
        </DetCard>
      </div>

      {/* Power telemetry */}
      <DetCard accent="#d97706">
        <DetTitle>⚡ Live Power Telemetry</DetTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8 }}>
          <TelCard label="Voltage H1"    value={d.present_voltage1}   unit="V"  warn={480} target={d.target_voltage1} />
          <TelCard label="Voltage H2"    value={d.present_voltage2}   unit="V"  warn={480} target={d.target_voltage2} />
          <TelCard label="Current H1"    value={d.present_current1}   unit="A"  warn={250} target={d.target_current1} />
          <TelCard label="Current H2"    value={d.present_current2}   unit="A"  warn={250} target={d.target_current2} />
          <TelCard label="Charger Temp"  value={d.charger_temp}       unit="°C" warn={70} />
          <TelCard label="PM Temp 1"     value={d.power_module_temp1} unit="°C" warn={55} />
          <TelCard label="PM Temp 2"     value={d.power_module_temp2} unit="°C" warn={55} />
          <TelCard label="SOC"           value={d.SOC}                unit="%" />
          <TelCard label="Humidity"      value={d.humidity}           unit="%" warn={80} />
        </div>
      </DetCard>

      {/* Target vs Actual */}
      <DetCard accent="#d97706">
        <DetTitle>📐 Target vs Actual</DetTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Connector H1", tv: d.target_voltage1, av: d.present_voltage1, ti: d.target_current1, ai: d.present_current1 },
            { label: "Connector H2", tv: d.target_voltage2, av: d.present_voltage2, ti: d.target_current2, ai: d.present_current2 },
          ].map((item) => {
            const vDiff = item.tv != null && item.av != null ? Math.abs(item.tv - item.av).toFixed(1) : null;
            const iDiff = item.ti != null && item.ai != null ? Math.abs(item.ti - item.ai).toFixed(1) : null;
            const vOk = vDiff != null && Number(vDiff) < 25;
            const iOk = iDiff != null && Number(iDiff) < 15;
            return (
              <div key={item.label} style={{ padding: "12px 14px", borderRadius: 8, background: "#f8fafc", border: "1px solid #d0dae8" }}>
                <div style={{ fontSize: ".65em", fontWeight: 700, color: "#718096", marginBottom: 8 }}>{item.label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".62em" }}>
                    <span style={{ color: "#718096", minWidth: 40 }}>Voltage</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{item.av ?? "—"} V</span>
                    <span style={{ color: "#94a3b8" }}>/ {item.tv ?? "—"} V</span>
                    {vDiff != null && (
                      <span style={{ marginLeft: "auto", padding: "1px 6px", borderRadius: 10, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", background: vOk ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", color: vOk ? "#16a34a" : "#dc2626" }}>
                        Δ{vDiff}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".62em" }}>
                    <span style={{ color: "#718096", minWidth: 40 }}>Current</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{item.ai ?? "—"} A</span>
                    <span style={{ color: "#94a3b8" }}>/ {item.ti ?? "—"} A</span>
                    {iDiff != null && (
                      <span style={{ marginLeft: "auto", padding: "1px 6px", borderRadius: 10, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", background: iOk ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", color: iOk ? "#16a34a" : "#dc2626" }}>
                        Δ{iDiff}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DetCard>

    </div>
  );
}