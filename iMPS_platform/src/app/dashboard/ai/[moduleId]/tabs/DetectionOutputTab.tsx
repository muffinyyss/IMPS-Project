"use client";
import React, { useState } from "react";
import { ModuleResult } from "../../lib/api";
import { getHealthColor, getHealthLabel } from "../../lib/constants";

interface Props { data: ModuleResult | null; modNum: number; modColor: string; 
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

function ScoreBar({ label, value, max = 1, unit = "", color }: {
  label: string; value: number | null; max?: number; unit?: string; color?: string;
}) {
  if (value == null) return null;
  const pct = Math.min(100, (value / max) * 100);
  const c = color ?? (pct > 75 ? "#dc2626" : pct > 50 ? "#d97706" : "#22c55e");
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".65em", marginBottom: 3 }}>
        <span style={{ color: "#718096", fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: c }}>
          {typeof value === "number" ? value.toFixed(3) : value}{unit}
        </span>
      </div>
      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 3, transition: "width .5s" }} />
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: any }) {
  if (value == null) return null;
  const s = String(value).toLowerCase();
  const isOk   = ["normal","ok","active","connected","direct"].includes(s);
  const isCrit = ["critical","crit","anomaly","disconnected","inferred"].includes(s);
  const isWarn = ["warning","warn"].includes(s);
  const bg    = isCrit ? "rgba(239,68,68,.1)"  : isWarn ? "rgba(217,119,6,.1)"  : isOk ? "rgba(34,197,94,.1)"  : "rgba(100,116,139,.08)";
  const color = isCrit ? "#dc2626"             : isWarn ? "#d97706"             : isOk ? "#16a34a"             : "#64748b";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: ".65em", color: "#718096" }}>{label}</span>
      <span style={{ fontSize: ".62em", fontWeight: 700, padding: "1px 8px", borderRadius: 10, background: bg, color, fontFamily: "'JetBrains Mono',monospace" }}>
        {String(value)}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: ".6em", fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Col({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>{children}</div>;
}

// ── Per-module layouts ────────────────────────────────────────────────────
function M1Output({ d }: { d: any }) {
  return (
    <TwoCol>
      <Col>
        <SectionTitle>Ensemble Scores</SectionTitle>
        <ScoreBar label="ensemble_risk" value={d.ensemble_risk}  color="#dc2626" />
        <ScoreBar label="risk_score"    value={d.risk_score}     color="#f97316" />
        <ScoreBar label="confidence"    value={d.confidence}     color="#0284c7" />
        {d.model_results && Object.entries(d.model_results).map(([k, v]: any) => (
          <ScoreBar key={k} label={k} value={typeof v === "object" ? v?.score : v} />
        ))}
      </Col>
      <Col>
        <SectionTitle>Status</SectionTitle>
        <Chip label="method"  value={d.method} />
        <Chip label="source"  value={d.source} />
        <Chip label="status"  value={d.status} />
        {d.telemetry && <>
          <div style={{ marginTop: 8 }}><SectionTitle>Telemetry</SectionTitle></div>
          <Chip label="MDB_ambient_temp"    value={d.telemetry.MDB_ambient_temp != null ? `${d.telemetry.MDB_ambient_temp}°C` : null} />
          <Chip label="pi5_temp"            value={d.telemetry.pi5_temp != null ? `${d.telemetry.pi5_temp}°C` : null} />
          <Chip label="MDB_humidity"        value={d.telemetry.MDB_humidity != null ? `${d.telemetry.MDB_humidity}%` : null} />
          <Chip label="dust_filter_charging" value={d.telemetry.dust_filter_charging != null ? `${d.telemetry.dust_filter_charging} days` : null} />
        </>}
      </Col>
    </TwoCol>
  );
}

function M2Output({ d }: { d: any }) {
  const td = d.data ?? {};
  return (
    <TwoCol>
      <Col>
        <SectionTitle>PM Temperatures</SectionTitle>
        {[1,2,3,4,5].map((i) => (
          <ScoreBar key={i} label={`PM Temp ${i}`} value={td[`power_module_temp${i}`]} max={80} unit="°C"
            color={td[`power_module_temp${i}`] > 55 ? "#dc2626" : "#22c55e"} />
        ))}
        <ScoreBar label="charger_temp" value={td.charger_temp} max={80} unit="°C" />
      </Col>
      <Col>
        <SectionTitle>Electrical + AI</SectionTitle>
        <ScoreBar label="voltage H1"   value={td.present_voltage1} max={500} unit="V" color="#0284c7" />
        <ScoreBar label="current H1"   value={td.present_current1} max={300} unit="A" color="#7c3aed" />
        <ScoreBar label="SOC"          value={td.SOC}              max={100} unit="%" color="#059669" />
        <ScoreBar label="humidity"     value={td.humidity}         max={100} unit="%" color="#3b82f6" />
        <div style={{ marginTop: 8 }}><SectionTitle>Status</SectionTitle></div>
        <Chip label="source" value={d.source} />
        <Chip label="status" value={d.status} />
      </Col>
    </TwoCol>
  );
}

function M3Output({ d }: { d: any }) {
  const td = d.data ?? {};
  const rcColor: Record<string,string> = { NORMAL:"#22c55e", NETWORK_FAILURE:"#dc2626", POWER_OUTAGE:"#dc2626", PLC_FAULT:"#d97706", EDGEBOX_CRASH:"#d97706", SCHEDULED_MAINTENANCE:"#0284c7" };
  return (
    <TwoCol>
      <Col>
        <SectionTitle>Root Cause</SectionTitle>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"1.1em", fontWeight:800, color:rcColor[d.root_cause]??"#718096", marginBottom:12 }}>
          {d.root_cause ?? "—"}
        </div>
        <ScoreBar label="confidence" value={d.confidence}    color="#0284c7" />
        <ScoreBar label="severity"   value={d.severity}      color="#dc2626" />
        <Chip label="online" value={`${d.online_count??0}/${d.total_devices??6}`} />
      </Col>
      <Col>
        <SectionTitle>Device Status</SectionTitle>
        {["edgebox_status","router_status","PLC1_status","PLC2_status","MDB_status","energy_meter_status"].map((k) => (
          <Chip key={k} label={k.replace("_status","")} value={td[k] ?? d[k]} />
        ))}
      </Col>
    </TwoCol>
  );
}

function M4Output({ d }: { d: any }) {
  const td = d.data ?? {};
  return (
    <TwoCol>
      <Col>
        <SectionTitle>Anomaly Detection</SectionTitle>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"1.6em", fontWeight:900, color:d.anomaly_flags>0?"#dc2626":"#22c55e", marginBottom:4 }}>
          {d.anomaly_flags ?? 0} flags
        </div>
        <div style={{ fontSize:".62em", color:"#718096", marginBottom:12 }}>out of 22 conditions</div>
        {d.group_scores && Object.entries(d.group_scores).map(([k,v]:any) => (
          <ScoreBar key={k} label={k.replace("anomaly_","")} value={v} />
        ))}
      </Col>
      <Col>
        <SectionTitle>Power Telemetry</SectionTitle>
        <ScoreBar label="voltage H1"   value={td.present_voltage1}  max={500} unit="V" color="#0284c7" />
        <ScoreBar label="current H1"   value={td.present_current1}  max={300} unit="A" color="#7c3aed" />
        <ScoreBar label="charger_temp" value={td.charger_temp}      max={80}  unit="°C" color={td.charger_temp>55?"#dc2626":"#22c55e"} />
        <ScoreBar label="SOC"          value={td.SOC}               max={100} unit="%" color="#059669" />
        <div style={{ marginTop:8 }}><SectionTitle>Status</SectionTitle></div>
        <Chip label="status"       value={d.status} />
        <Chip label="max_severity" value={d.max_severity} />
      </Col>
    </TwoCol>
  );
}

function M5Output({ d }: { d: any }) {
  const td = d.data ?? {};
  return (
    <TwoCol>
      <Col>
        <SectionTitle>Network Analysis</SectionTitle>
        <ScoreBar label="severity"      value={d.severity ?? td.severity}    color="#dc2626" />
        <ScoreBar label="anomaly_score" value={td.anomaly_score}             color="#d97706" />
        <Chip label="root_cause"   value={d.root_cause} />
        <Chip label="online_count" value={`${d.online_count??0}/6`} />
      </Col>
      <Col>
        <SectionTitle>Device Status</SectionTitle>
        {["router_status","PLC_network_status1","PLC_network_status2","edgebox_network_status","pi5_network_status","energy_meter_network_status1"].map((k) => (
          <Chip key={k} label={k.replace(/_network_status\d?|_status/g,"").replace(/_/g," ")} value={td[k] ?? d[k]} />
        ))}
      </Col>
    </TwoCol>
  );
}

function M6Output({ d }: { d: any }) {
  const comps = d.components ?? {};
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
        {[
          { l:"System Health", v:d.system_health, c:getHealthColor(d.system_health) },
          { l:"Avg Health",    v:d.avg_health,    c:getHealthColor(d.avg_health) },
          { l:"Weakest",       v:d.weakest_component?.replace(/_/g," "), c:"#dc2626" },
        ].map((item) => (
          <div key={item.l} style={{ padding:"10px", background:"#f8fafc", borderRadius:8, border:"1px solid #e2e8f0", textAlign:"center" }}>
            <div style={{ fontSize:".58em", color:"#718096", marginBottom:4 }}>{item.l}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:800, color:item.c }}>{item.v??""}</div>
          </div>
        ))}
      </div>
      <SectionTitle>Component RUL</SectionTitle>
      {Object.entries(comps).map(([k,v]:any) => {
        const pct = typeof v === "number" ? v : (v?.rul_pct != null ? Math.round(v.rul_pct) : null);
        return <ScoreBar key={k} label={k.replace(/_/g," ")} value={pct} max={100} unit="%" color={getHealthColor(pct)} />;
      })}
    </div>
  );
}

function M7Output({ d }: { d: any }) {
  return (
    <TwoCol>
      <Col>
        <SectionTitle>States</SectionTitle>
        <Chip label="icp_state"    value={d.icp_state} />
        <Chip label="icp_name"     value={d.icp_name} />
        <Chip label="uslink_state" value={d.uslink_state} />
        <Chip label="uslink_name"  value={d.uslink_name} />
        <Chip label="plc_status"   value={d.plc_status} />
        <Chip label="plc2_status"  value={d.plc2_status} />
      </Col>
      <Col>
        <SectionTitle>Anomalies</SectionTitle>
        {d.model_results && Object.entries(d.model_results).map(([k,v]:any) => (
          <Chip key={k} label={k} value={v?.anomaly ? "ANOMALY" : "OK"} />
        ))}
        <Chip label="mqtt_connected" value={d.mqtt_connected ? "Connected" : "Disconnected"} />
        <Chip label="icp_inferred"   value={d.icp_inferred ? "Inferred" : "Direct"} />
        <Chip label="usl_inferred"   value={d.usl_inferred  ? "Inferred" : "Direct"} />
      </Col>
    </TwoCol>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function DetectionOutputTab({ data, modNum, modColor }: Props) {
  const [showRaw, setShowRaw] = useState(false);

  if (!data) return (
    <div style={{ padding:40, textAlign:"center", color:"#94a3b8", fontSize:".8em" }}>กำลังโหลด...</div>
  );
  if (data.error) return (
    <div style={{ padding:40, textAlign:"center", color:"#94a3b8", fontSize:".8em" }}>ไม่มีข้อมูล Module {modNum}</div>
  );

  const health = data.health ?? null;
  const grade  = health == null ? "X" : health>=80?"A":health>=60?"B":health>=40?"C":health>=20?"D":"F";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        {[
          { l:"Health Score", v: health!=null?`${health}%`:"—",  c:getHealthColor(health) },
          { l:"Grade",        v: grade,                           c:getHealthColor(health) },
          { l:"Source",       v: (data as any).source??"mongodb", c:"#0284c7" },
          { l:"Processing",   v: (data as any)._processing_ms!=null?`${(data as any)._processing_ms}ms`:"—", c:"#718096" },
        ].map((item) => (
          <div key={item.l} style={{ background:"#fff", borderRadius:10, border:"1px solid #e2e8f0", padding:"12px 14px", textAlign:"center" }}>
            <div style={{ fontSize:".55em", color:"#94a3b8", fontWeight:600, textTransform:"uppercase", letterSpacing:"1px", marginBottom:4 }}>{item.l}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"1.1em", fontWeight:800, color:item.c }}>{item.v}</div>
          </div>
        ))}
      </div>

      {/* Health bar + CBM zones */}
      {health != null && (
        <div style={{ background:"#fff", borderRadius:10, border:"1px solid #e2e8f0", padding:"12px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:".62em", marginBottom:6 }}>
            <span style={{ color:"#718096", fontWeight:600 }}>Health Score</span>
            <span style={{ color:getHealthColor(health), fontWeight:700 }}>{getHealthLabel(health)}</span>
          </div>
          <div style={{ height:8, background:"#f1f5f9", borderRadius:4, overflow:"hidden" }}>
            <div style={{ width:`${health}%`, height:"100%", background:getHealthColor(health), borderRadius:4, transition:"width .8s" }} />
          </div>
          <div style={{ display:"flex", gap:12, marginTop:6, fontSize:".55em", flexWrap:"wrap" }}>
            {[{v:80,c:"#22c55e",l:"Good"},{v:60,c:"#eab308",l:"Monitor"},{v:40,c:"#f97316",l:"Inspect"},{v:0,c:"#ef4444",l:"Repair"}].map((z) => (
              <span key={z.v} style={{ display:"flex", alignItems:"center", gap:3 }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:z.c,display:"inline-block" }} />
                <span style={{ color:"#94a3b8" }}>≥{z.v}% {z.l}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Breakdown / Raw toggle */}
      <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0", padding:"16px 20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontSize:".62em", fontWeight:700, color:"#718096", textTransform:"uppercase", letterSpacing:"2px" }}>
            M{modNum} — Detection Output
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {data._result_ts && (
              <span style={{ fontSize:".58em", color:"#94a3b8", fontFamily:"'JetBrains Mono',monospace" }}>
                {new Date(data._result_ts).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})}
              </span>
            )}
            <button
              onClick={() => setShowRaw(v => !v)}
              style={{ fontSize:".58em", padding:"3px 10px", borderRadius:6, border:"1px solid #e2e8f0", background:showRaw?"#f1f5f9":"#fff", cursor:"pointer", color:"#64748b" }}
            >
              {showRaw ? "📊 Breakdown" : "{ } Raw JSON"}
            </button>
          </div>
        </div>

        {showRaw ? (
          <div style={{ background:"#0f172a", borderRadius:8, padding:16, overflow:"auto", maxHeight:400 }}>
            <pre style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:".62em", color:"#e2e8f0", margin:0, whiteSpace:"pre-wrap" }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        ) : (
          <>
            {modNum === 1 && <M1Output d={data as any} />}
            {modNum === 2 && <M2Output d={data as any} />}
            {modNum === 3 && <M3Output d={data as any} />}
            {modNum === 4 && <M4Output d={data as any} />}
            {modNum === 5 && <M5Output d={data as any} />}
            {modNum === 6 && <M6Output d={data as any} />}
            {modNum === 7 && <M7Output d={data as any} />}
          </>
        )}
      </div>

    </div>
  );
}