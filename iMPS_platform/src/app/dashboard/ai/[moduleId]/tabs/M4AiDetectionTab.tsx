"use client";
import React, { useState } from "react";
import { ModuleResult } from "../../lib/api";

interface Props {
  data: ModuleResult | null;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

// ── 32 Input field definitions ────────────────────────────────────────────
const INPUT_FIELDS = [
  // Voltage
  { key: "target_voltage1",   label: "Target Voltage H1",  unit: "V",   group: "voltage",  warn: 500 },
  { key: "present_voltage1",  label: "Present Voltage H1", unit: "V",   group: "voltage",  warn: 500 },
  { key: "target_voltage2",   label: "Target Voltage H2",  unit: "V",   group: "voltage",  warn: 500 },
  { key: "present_voltage2",  label: "Present Voltage H2", unit: "V",   group: "voltage",  warn: 500 },
  // Current
  { key: "target_current1",   label: "Target Current H1",  unit: "A",   group: "current",  warn: 300 },
  { key: "present_current1",  label: "Present Current H1", unit: "A",   group: "current",  warn: 300 },
  { key: "target_current2",   label: "Target Current H2",  unit: "A",   group: "current",  warn: 300 },
  { key: "present_current2",  label: "Present Current H2", unit: "A",   group: "current",  warn: 300 },
  // Thermal
  { key: "charger_temp",            label: "Charger Temp",       unit: "°C",  group: "thermal", warn: 70 },
  { key: "power_module_temp1",      label: "PM Temp 1",          unit: "°C",  group: "thermal", warn: 55 },
  { key: "power_module_temp2",      label: "PM Temp 2",          unit: "°C",  group: "thermal", warn: 55 },
  { key: "power_module_temp3",      label: "PM Temp 3",          unit: "°C",  group: "thermal", warn: 55 },
  { key: "power_module_temp4",      label: "PM Temp 4",          unit: "°C",  group: "thermal", warn: 55 },
  { key: "power_module_temp5",      label: "PM Temp 5",          unit: "°C",  group: "thermal", warn: 55 },
  { key: "charger_gun_temp_plus1",  label: "Gun Temp+ H1",       unit: "°C",  group: "thermal", warn: 80 },
  { key: "charger_gun_temp_minus1", label: "Gun Temp− H1",       unit: "°C",  group: "thermal", warn: 80 },
  { key: "charger_gun_temp_plus2",  label: "Gun Temp+ H2",       unit: "°C",  group: "thermal", warn: 80 },
  { key: "charger_gun_temp_minus2", label: "Gun Temp− H2",       unit: "°C",  group: "thermal", warn: 80 },
  { key: "edgebox_temp",            label: "EdgeBox Temp",       unit: "°C",  group: "thermal", warn: 70 },
  { key: "humidity",                label: "Humidity",           unit: "%",   group: "env",     warn: 80 },
  // SOC / Energy
  { key: "SOC",                     label: "SOC",                unit: "%",   group: "energy",  warn: null },
  { key: "daily_kwh",               label: "Daily kWh",          unit: "kWh", group: "energy",  warn: null },
  { key: "energy_rate",             label: "Energy Rate",        unit: "kW",  group: "energy",  warn: null },
  // Module Status
  { key: "power_module_status1",    label: "PM Status 1",        unit: "",    group: "module",  warn: null },
  { key: "power_module_status2",    label: "PM Status 2",        unit: "",    group: "module",  warn: null },
  { key: "power_module_status3",    label: "PM Status 3",        unit: "",    group: "module",  warn: null },
  { key: "power_module_status4",    label: "PM Status 4",        unit: "",    group: "module",  warn: null },
  { key: "power_module_status5",    label: "PM Status 5",        unit: "",    group: "module",  warn: null },
  // PLC / Communication
  { key: "PLC1_status",             label: "PLC 1 Status",       unit: "",    group: "comm",    warn: null },
  { key: "PLC2_status",             label: "PLC 2 Status",       unit: "",    group: "comm",    warn: null },
  { key: "is_charging_c1",          label: "Is Charging H1",     unit: "",    group: "session", warn: null },
  { key: "is_charging_c2",          label: "Is Charging H2",     unit: "",    group: "session", warn: null },
];

// ── C01–C22 condition definitions ─────────────────────────────────────────
const CONDITIONS = [
  { id:"C01", type:"Hybrid", name:"Voltage Anomaly H1",       std:"ISO 15118-2", eq:"Power Module",      eqC:"#dc2626" },
  { id:"C02", type:"Hybrid", name:"Current Anomaly H1",       std:"ISO 15118-2", eq:"Power Module",      eqC:"#dc2626" },
  { id:"C03", type:"Hybrid", name:"Voltage Anomaly H2",       std:"ISO 15118-2", eq:"Power Module",      eqC:"#dc2626" },
  { id:"C04", type:"Hybrid", name:"Current Anomaly H2",       std:"ISO 15118-2", eq:"Power Module",      eqC:"#dc2626" },
  { id:"C05", type:"Hybrid", name:"Power Anomaly H1",         std:"ISO 15118-2", eq:"Power Module",      eqC:"#dc2626" },
  { id:"C06", type:"Hybrid", name:"Power Anomaly H2",         std:"ISO 15118-2", eq:"Power Module",      eqC:"#dc2626" },
  { id:"C07", type:"Hybrid", name:"PM Thermal 1",             std:"IEC 61851-23",eq:"Power Module",      eqC:"#dc2626" },
  { id:"C08", type:"Hybrid", name:"PM Thermal 2",             std:"IEC 61851-23",eq:"Power Module",      eqC:"#dc2626" },
  { id:"C09", type:"Hybrid", name:"PM Thermal 3",             std:"IEC 61851-23",eq:"Power Module",      eqC:"#dc2626" },
  { id:"C10", type:"Hybrid", name:"PM Thermal 4",             std:"IEC 61851-23",eq:"Power Module",      eqC:"#dc2626" },
  { id:"C11", type:"Hybrid", name:"PM Thermal 5",             std:"IEC 61851-23",eq:"Power Module",      eqC:"#dc2626" },
  { id:"C12", type:"AI",     name:"Charger Temp Anomaly",     std:"IEC 61851-23",eq:"Power Module",      eqC:"#dc2626" },
  { id:"C13", type:"Rule",   name:"Module Status H1",         std:"IEC 61851-1", eq:"Power Module",      eqC:"#dc2626" },
  { id:"C14", type:"Rule",   name:"Module Status H2",         std:"IEC 61851-1", eq:"Power Module",      eqC:"#dc2626" },
  { id:"C15", type:"Rule",   name:"PLC Anomaly H1",           std:"DIN 70121",   eq:"Power Module",      eqC:"#dc2626" },
  { id:"C16", type:"Rule",   name:"PLC Anomaly H2",           std:"DIN 70121",   eq:"Power Module",      eqC:"#dc2626" },
  { id:"C17", type:"Rule",   name:"Cable Safety H1",          std:"IEC 62196-3", eq:"Charging Connector",eqC:"#0d9488" },
  { id:"C18", type:"Rule",   name:"Cable Safety H2",          std:"IEC 62196-3", eq:"Charging Connector",eqC:"#0d9488" },
  { id:"C19", type:"AI",     name:"EdgeBox Temp Anomaly",     std:"Phoenix Contact",eq:"OCPP EdgeBox",   eqC:"#0891b2" },
  { id:"C20", type:"AI",     name:"Daily Energy H1",          std:"—",           eq:"Energy",            eqC:"#78716c" },
  { id:"C21", type:"AI",     name:"Daily Energy H2",          std:"—",           eq:"Energy",            eqC:"#78716c" },
  { id:"C22", type:"Rule",   name:"Energy Meter Status",      std:"—",           eq:"Energy Meter",      eqC:"#059669" },
];

const GROUP_COLORS: Record<string, string> = {
  voltage: "#0284c7", current: "#7c3aed", thermal: "#dc2626",
  env: "#0891b2", energy: "#059669", module: "#d97706",
  comm: "#6366f1", session: "#ec4899",
};

const GROUP_LABELS: Record<string, string> = {
  voltage: "⚡ Voltage", current: "🔋 Current", thermal: "🌡️ Thermal",
  env: "💧 Environment", energy: "📊 Energy", module: "⚙️ Power Module",
  comm: "📡 Communication", session: "🔌 Session",
};

// ── Get condition status from data ────────────────────────────────────────
function getCondStatus(cid: string, d: any, data: any): "OK" | "WARN" | "CRIT" | "IDLE" {
  if (!d && !data) return "IDLE";
  const flags: number[] = (data as any)?.anomaly_flags_detail ?? [];

  // check anomaly_flags array if available
  const idx = parseInt(cid.replace("C","")) - 1;
  if (Array.isArray(flags) && flags.length > idx) {
    return flags[idx] === 1 ? "CRIT" : "OK";
  }

  // fallback: rule-based check
  if (cid === "C07" && d.power_module_temp1 > 55) return "CRIT";
  if (cid === "C08" && d.power_module_temp2 > 55) return "CRIT";
  if (cid === "C09" && d.power_module_temp3 > 55) return "CRIT";
  if (cid === "C10" && d.power_module_temp4 > 55) return "CRIT";
  if (cid === "C11" && d.power_module_temp5 > 55) return "CRIT";
  if (cid === "C15" && d.PLC1_status === "Inactive") return "CRIT";
  if (cid === "C16" && d.PLC2_status === "Inactive") return "CRIT";
  if (cid === "C17" && (d.charger_gun_temp_plus1 ?? 0) > 80) return "CRIT";
  if (cid === "C18" && (d.charger_gun_temp_plus2 ?? 0) > 80) return "CRIT";

  return "OK";
}

// ── Input field card ──────────────────────────────────────────────────────
function FieldCard({ field, value }: {
  field: typeof INPUT_FIELDS[0];
  value: any;
}) {
  const isStatus = field.unit === "";
  const isActive = isStatus && ["Active","active","1",1].includes(value);
  const isInactive = isStatus && value != null && !isActive;
  const numVal = typeof value === "number" ? value : parseFloat(value);
  const isWarn = !isStatus && field.warn != null && !isNaN(numVal) && numVal >= field.warn;

  const color = isStatus
    ? (isActive ? "#22c55e" : isInactive ? "#dc2626" : "#94a3b8")
    : isWarn ? "#dc2626" : "#2d3748";

  const bg = isStatus
    ? (isActive ? "rgba(34,197,94,.04)" : isInactive ? "rgba(239,68,68,.04)" : "#f8fafc")
    : isWarn ? "rgba(239,68,68,.04)" : "#f8fafc";

  const borderColor = GROUP_COLORS[field.group] ?? "#d0dae8";

  return (
    <div style={{
      padding: "8px 10px", borderRadius: 8,
      background: bg,
      border: "1px solid #e2e8f0",
      borderLeft: `3px solid ${borderColor}`,
    }}>
      <div style={{ fontSize: ".55em", color: "#718096", fontWeight: 600, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {field.label}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color, fontSize: ".82em" }}>
        {value ?? "—"}{value != null && field.unit ? ` ${field.unit}` : ""}
      </div>
    </div>
  );
}

// ── Condition badge ───────────────────────────────────────────────────────
function CondBadge({ cond, status }: { cond: typeof CONDITIONS[0]; status: "OK" | "WARN" | "CRIT" | "IDLE" }) {
  const typeBg   = cond.type==="Hybrid"?"rgba(2,132,199,.1)":cond.type==="AI"?"rgba(124,58,237,.1)":"rgba(100,116,139,.08)";
  const typeColor= cond.type==="Hybrid"?"#0284c7":cond.type==="AI"?"#7c3aed":"#64748b";
  const stBg     = status==="CRIT"?"rgba(239,68,68,.1)":status==="WARN"?"rgba(217,119,6,.1)":"rgba(34,197,94,.08)";
  const stColor  = status==="CRIT"?"#dc2626":status==="WARN"?"#d97706":"#16a34a";
  const borderL  = status==="CRIT"?"#dc2626":status==="WARN"?"#d97706":status==="OK"?"#22c55e":"#94a3b8";

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:6, padding:"5px 8px",
      borderRadius:6, border:"1px solid #f1f5f9",
      borderLeft:`3px solid ${borderL}`,
      background: status==="CRIT"?"rgba(239,68,68,.02)":"#fff",
    }}>
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:".6em", fontWeight:700, padding:"1px 5px", borderRadius:3, background:typeBg, color:typeColor, flexShrink:0 }}>
        {cond.id}
      </span>
      <span style={{ flex:1, fontSize:".65em", fontWeight:600, color:"#2d3748", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
        {cond.name}
      </span>
      <span style={{ fontSize:".58em", color:cond.eqC, flexShrink:0 }}>{cond.eq}</span>
      <span style={{ fontSize:".58em", fontWeight:700, padding:"1px 6px", borderRadius:8, background:stBg, color:stColor, flexShrink:0, fontFamily:"'JetBrains Mono',monospace" }}>
        {status}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function M4AiDetectionTab({ data, countdown, isPaused, onTogglePause }: Props) {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const d = (data as any)?.data ?? {};
  const anomalyFlags = (data as any)?.anomaly_flags ?? 0;
  const groups = Array.from(new Set(INPUT_FIELDS.map((f) => f.group)));

  const filteredFields = activeGroup
    ? INPUT_FIELDS.filter((f) => f.group === activeGroup)
    : INPUT_FIELDS;

  const condStatuses = CONDITIONS.map((c) => getCondStatus(c.id, d, data));
  const critCount = condStatuses.filter((s) => s === "CRIT").length;
  const warnCount = condStatuses.filter((s) => s === "WARN").length;

  if (!data) return (
    <div style={{ padding:40, textAlign:"center", color:"#94a3b8", fontSize:".8em" }}>กำลังโหลด...</div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Header */}
      <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:".62em", fontWeight:700, color:"#718096", textTransform:"uppercase", letterSpacing:"2px", marginBottom:4 }}>
            AI-Module Detection — Manual Input Inspection
          </div>
          <div style={{ fontSize:".72em", color:"#2d3748" }}>
            32 telemetry fields · 22 AI conditions · Ensemble(AE + 1D-CNN + BiLSTM + Transformer + DNN)
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background: data.error ? "#dc2626" : "#22c55e", boxShadow: !data.error ? "0 0 6px #22c55e" : undefined }} />
            <span style={{ fontSize:".65em", color:"#718096" }}>{data.error ? "Error" : "Live data"}</span>
          </div>
          {[
            { l:`${critCount} CRIT`, bg:"rgba(239,68,68,.1)", c:"#dc2626" },
            { l:`${warnCount} WARN`, bg:"rgba(217,119,6,.1)", c:"#d97706" },
            { l:`${anomalyFlags} Flags`, bg:"rgba(100,116,139,.08)", c:"#64748b" },
          ].map((item) => (
            <span key={item.l} style={{ fontSize:".6em", fontWeight:700, padding:"2px 8px", borderRadius:10, background:item.bg, color:item.c }}>
              {item.l}
            </span>
          ))}
        </div>
      </div>

      {/* ── 32 Input Fields ── */}
      <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", padding:"16px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
          <div style={{ fontSize:".62em", fontWeight:700, color:"#718096", textTransform:"uppercase", letterSpacing:"2px" }}>
            📥 Telemetry Input Fields (32)
          </div>
          {/* Group filter pills */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
            <button
              onClick={() => setActiveGroup(null)}
              style={{ fontSize:".58em", padding:"2px 8px", borderRadius:10, border:"none", cursor:"pointer", fontWeight:700,
                background: !activeGroup ? "#2d3748" : "#f1f5f9",
                color: !activeGroup ? "#fff" : "#64748b",
              }}
            >All</button>
            {groups.map((g) => (
              <button key={g}
                onClick={() => setActiveGroup(activeGroup === g ? null : g)}
                style={{ fontSize:".58em", padding:"2px 8px", borderRadius:10, border:"none", cursor:"pointer", fontWeight:700,
                  background: activeGroup === g ? GROUP_COLORS[g] : "#f1f5f9",
                  color: activeGroup === g ? "#fff" : "#64748b",
                }}
              >
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:6 }}>
          {filteredFields.map((field) => (
            <FieldCard key={field.key} field={field} value={d[field.key] ?? (data as any)[field.key]} />
          ))}
        </div>
      </div>

      {/* ── C01–C22 Condition Grid ── */}
      <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", padding:"16px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
          <div style={{ fontSize:".62em", fontWeight:700, color:"#718096", textTransform:"uppercase", letterSpacing:"2px" }}>
            🧠 AI Detection Conditions (C01–C22)
          </div>
          <div style={{ display:"flex", gap:8, fontSize:".6em" }}>
            {[
              { t:"Hybrid", bg:"rgba(2,132,199,.1)", c:"#0284c7" },
              { t:"AI",     bg:"rgba(124,58,237,.1)", c:"#7c3aed" },
              { t:"Rule",   bg:"rgba(100,116,139,.08)", c:"#64748b" },
            ].map((item) => (
              <span key={item.t} style={{ padding:"1px 7px", borderRadius:8, background:item.bg, color:item.c, fontWeight:700 }}>
                {item.t}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
          {CONDITIONS.map((cond, i) => (
            <CondBadge key={cond.id} cond={cond} status={condStatuses[i]} />
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
        {[
          { l:"Anomaly Flags",  v:`${anomalyFlags}/22`,  c: anomalyFlags>0?"#dc2626":"#22c55e" },
          { l:"Critical Cond.", v:`${critCount}`,         c: critCount>0?"#dc2626":"#22c55e" },
          { l:"Warning Cond.",  v:`${warnCount}`,         c: warnCount>0?"#d97706":"#22c55e" },
        ].map((item) => (
          <div key={item.l} style={{ background:"#fff", borderRadius:10, border:"1px solid #e2e8f0", padding:"12px 14px", textAlign:"center" }}>
            <div style={{ fontSize:".55em", color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"1px", marginBottom:4 }}>{item.l}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"1.4em", fontWeight:900, color:item.c }}>{item.v}</div>
          </div>
        ))}
      </div>

    </div>
  );
}