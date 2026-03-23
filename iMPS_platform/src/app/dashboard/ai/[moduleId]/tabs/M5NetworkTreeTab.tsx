"use client";
import React, { useRef, useEffect } from "react";
import { ModuleResult } from "../../lib/api";
import { AutoPredictPanel, HealthSummaryBar } from "./DetectionLayout";

interface Props {
  data: ModuleResult | null;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

// ── Shared styles (same pattern as M2/M3) ────────────────────────────────
const S = {
  card: {
    background: "#fff", border: "1px solid #d0dae8",
    borderRadius: 12, padding: "16px", marginBottom: 14,
  } as React.CSSProperties,
  ct: {
    fontSize: ".62em", fontWeight: 700,
    textTransform: "uppercase" as const, letterSpacing: "2.5px",
    color: "#718096", marginBottom: 10,
    display: "flex", alignItems: "center", gap: 7,
  } as React.CSSProperties,
  mn: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "6px 8px", border: "1px solid #d0dae8", borderRadius: 6,
    background: "#f8fafc", marginBottom: 5, fontSize: ".6em",
    fontFamily: "'JetBrains Mono', monospace", position: "relative" as const,
  } as React.CSSProperties,
  ml: {
    fontSize: ".55em", fontWeight: 700, padding: "1px 4px",
    borderRadius: 3, color: "#fff", lineHeight: 1, flexShrink: 0,
    background: "linear-gradient(135deg,#0284c7,#06b6d4)",
  } as React.CSSProperties,
  dl: {
    fontSize: ".55em", fontWeight: 700, padding: "1px 4px",
    borderRadius: 3, color: "#fff", lineHeight: 1, flexShrink: 0,
    background: "linear-gradient(135deg,#7c3aed,#a855f7)",
  } as React.CSSProperties,
  mnId:  { fontWeight: 700, fontSize: "1em", color: "#2563eb", minWidth: 14 } as React.CSSProperties,
  mnName:{ fontWeight: 600, color: "#2d3748", fontSize: ".85em", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" } as React.CSSProperties,
  mnSub: { fontSize: ".72em", color: "#718096" } as React.CSSProperties,
  mnVal: { fontSize: ".72em", color: "#718096", minWidth: 30, textAlign: "right" as const } as React.CSSProperties,
  gn: (color: string) => ({
    padding: "10px 14px", borderRadius: 10, border: `2px solid ${color}`, color,
    textAlign: "center" as const, background: "#fff",
    boxShadow: "0 2px 8px rgba(0,0,0,.05)", whiteSpace: "nowrap" as const,
    marginBottom: 12, minWidth: 140,
  } as React.CSSProperties),
  gnT: { fontSize: ".7em", fontWeight: 700, marginBottom: 3 } as React.CSSProperties,
  gnC: { fontSize: ".55em", color: "#718096", fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 } as React.CSSProperties,
  gs: { height: 28, flexShrink: 0 } as React.CSSProperties,
} as const;

function StatusBadge({ st }: { st?: "OK" | "WARN" | "CRIT" | "IDLE" }) {
  const map = {
    OK:   { bg: "#065f46", color: "#34d399" },
    WARN: { bg: "#78350f", color: "#fbbf24" },
    CRIT: { bg: "#7f1d1d", color: "#f87171" },
    IDLE: { bg: "#1e293b", color: "#64748b" },
  };
  const c = map[st ?? "IDLE"];
  return (
    <span style={{ fontSize: ".6em", fontWeight: 700, padding: "1px 5px", borderRadius: 3, lineHeight: 1, background: c.bg, color: c.color, flexShrink: 0 }}>
      {st ?? "IDLE"}
    </span>
  );
}

function GroupStatus({ st }: { st: string }) {
  const ok = ["OK","NORMAL","CLEAR","ONLINE"].includes(st);
  const warn = ["WARN","WARNING","PARTIAL"].includes(st);
  return (
    <span style={{ fontSize: ".6em", fontWeight: 700, padding: "2px 8px", borderRadius: 4, display: "inline-block",
      background: ok ? "#065f46" : warn ? "#78350f" : "#7f1d1d",
      color: ok ? "#34d399" : warn ? "#fbbf24" : "#f87171",
    }}>{st}</span>
  );
}

// ── M5 Model Tree (3-column SVG) ──────────────────────────────────────────
function M5ModelTree({ data }: { data: ModuleResult | null }) {
  const scores = (data as any)?.model_scores ?? {};
  const getStatus = (v: number | undefined): "OK" | "WARN" | "CRIT" | "IDLE" => {
    if (v == null) return "IDLE";
    return v >= 0.75 ? "CRIT" : v >= 0.5 ? "WARN" : "OK";
  };

  const models = [
    { id: "A",  type: "ml", grp: "cls", name: "XGBoost Classifier",  sub: "Network Fault Multi-class", val: scores.A },
    { id: "A2", type: "dl", grp: "cls", name: "DNN Classifier",       sub: "Deep Neural Network",       val: scores.A2 },
    { id: "B",  type: "ml", grp: "ew",  name: "Early Warning",        sub: "~2 min Pre-Fault Alert",    val: scores.B },
    { id: "C",  type: "dl", grp: "ad",  name: "Autoencoder",          sub: "Reconstruction Anomaly",    val: scores.C },
    { id: "D",  type: "dl", grp: "ad",  name: "BiLSTM-Attention",     sub: "Sequence Anomaly",          val: scores.D },
    { id: "E",  type: "ml", grp: "ad",  name: "IF + LOF Ensemble",    sub: "Isolation Forest + LOF",    val: scores.E },
  ];

  const groups = [
    { key: "cls", label: "🎯 Classification",   sub: "Models A, A2", color: "#0ea5e9" },
    { key: "ew",  label: "⚠️ Early Warning",    sub: "Model B",      color: "#d97706" },
    { key: "ad",  label: "🔍 Anomaly Detection", sub: "Models C, D, E", color: "#8b5cf6" },
  ];

  const grpStatus = (grpKey: string) => {
    const worst = Math.max(...models.filter((m) => m.grp === grpKey).map((m) => m.val ?? 0));
    return worst >= 0.75 ? "ALARM" : worst >= 0.5 ? "WARN" : "NORMAL";
  };

  const treeRef  = useRef<HTMLDivElement>(null);
  const svgRef   = useRef<SVGSVGElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const draw = () => {
      const wrap = treeRef.current;
      const svg  = svgRef.current;
      if (!wrap || !svg) return;
      const wR = wrap.getBoundingClientRect();
      if (wR.width === 0) return;
      svg.setAttribute("width",  String(wR.width));
      svg.setAttribute("height", String(wR.height));
      const lines: string[] = [];
      wrap.querySelectorAll("[data-m5-gn]").forEach((gEl) => {
        const gk  = (gEl as HTMLElement).dataset.m5Gn!;
        const gR  = gEl.getBoundingClientRect();
        const gY  = gR.top  + gR.height / 2 - wR.top;
        const gX1 = gR.left  - wR.left;
        const gX2 = gR.right - wR.left;
        wrap.querySelectorAll(`[data-m5-mn="${gk}"]`).forEach((mEl) => {
          const mR = mEl.getBoundingClientRect();
          const mY = mR.top + mR.height / 2 - wR.top;
          const mX = mR.right - wR.left;
          const mx = (mX + gX1) / 2;
          lines.push(`M ${mX} ${mY} C ${mx} ${mY}, ${mx} ${gY}, ${gX1} ${gY}`);
        });
        const gaugeEl = gaugeRef.current;
        if (gaugeEl) {
          const gRect = gaugeEl.getBoundingClientRect();
          const rX = gRect.left - wR.left;
          const rY = gRect.top + gRect.height / 2 - wR.top;
          const mx = (gX2 + rX) / 2;
          lines.push(`M ${gX2} ${gY} C ${mx} ${gY}, ${mx} ${rY}, ${rX} ${rY}`);
        }
      });
      svg.innerHTML = lines.map((d) =>
        `<path d="${d}" fill="none" stroke="#d0dae8" stroke-width="1.5" stroke-dasharray="4,3"/>`
      ).join("");
    };
    const t = setTimeout(draw, 300);
    window.addEventListener("resize", draw);
    return () => { clearTimeout(t); window.removeEventListener("resize", draw); };
  }, [data]);

  return (
    <div ref={treeRef} style={{ position: "relative", display: "flex", alignItems: "stretch", overflow: "visible", paddingBottom: 20 }}>
      <svg ref={svgRef} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 1, overflow: "visible" }} />

      {/* COL 1 — AI Models */}
      <div style={{ flex: "0 0 260px", zIndex: 2, paddingTop: 6 }}>
        <div style={{ ...S.ct, marginBottom: 6 }}>AI Models (6)</div>
        {["cls","ew","ad"].map((grpKey) => (
          <React.Fragment key={grpKey}>
            {models.filter((m) => m.grp === grpKey).map((m) => (
              <div key={m.id} data-m5-mn={grpKey} style={S.mn}>
                <span style={m.type === "ml" ? S.ml : S.dl}>{m.type.toUpperCase()}</span>
                <span style={S.mnId}>{m.id}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.mnName}>{m.name}</div>
                  <div style={S.mnSub}>{m.sub}</div>
                </div>
                <span style={S.mnVal}>{m.val?.toFixed(3) ?? "—"}</span>
                <StatusBadge st={getStatus(m.val)} />
              </div>
            ))}
            <div style={{ ...S.gs, height: 40 }} />
          </React.Fragment>
        ))}
      </div>

      {/* COL 2 — Detection Groups */}
      <div style={{ flex: "0 0 160px", position: "relative", margin: "0 40px", zIndex: 2 }}>
        <div style={{ ...S.ct, marginBottom: 6 }}>Groups</div>
        {groups.map((g) => (
          <div key={g.key} data-m5-gn={g.key} style={{ ...S.gn(g.color), marginBottom: 40 }}>
            <div style={S.gnT}>{g.label}</div>
            <div style={S.gnC}>{g.sub}</div>
            <GroupStatus st={grpStatus(g.key)} />
          </div>
        ))}
      </div>

      {/* COL 3 — Network Status Gauge */}
      <div ref={gaugeRef} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 0, zIndex: 2 }}>
        <M5StatusGauge data={data} />
      </div>
    </div>
  );
}

function M5StatusGauge({ data }: { data: ModuleResult | null }) {
  const health      = data?.health ?? null;
  const onlineCount = (data as any)?.online_count ?? 0;
  const severity    = (data as any)?.severity ?? 0;
  const rootCause   = (data as any)?.root_cause ?? "NORMAL";
  const color = health == null ? "#6b7280" : health >= 80 ? "#22c55e" : health >= 60 ? "#eab308" : "#ef4444";
  const pct   = health != null ? Math.max(0, Math.min(100, health)) / 100 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 200 }}>
        <svg viewBox="0 0 260 165" style={{ width: 200, height: "auto" }}>
          <path d="M 20 135 A 110 110 0 0 1 240 135" fill="none" stroke="rgba(0,0,0,.08)" strokeWidth="18" strokeLinecap="round"/>
          <path d="M 20 135 A 110 110 0 0 1 240 135" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={`${pct * 345.6} 345.6`}
            style={{ transition: "stroke-dasharray .8s ease, stroke .5s ease", filter: `drop-shadow(0 0 4px ${color}66)` }}/>
        </svg>
        <div style={{ position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "1.6em", fontWeight: 900, color, lineHeight: 1 }}>
            {health ?? "—"}%
          </div>
          <div style={{ fontSize: ".5em", color: "#718096", fontWeight: 600, marginTop: 1 }}>HEALTH</div>
        </div>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: ".72em", fontWeight: 800, color: rootCause === "NORMAL" ? "#22c55e" : "#dc2626" }}>
        {rootCause}
      </div>
      <div style={{ fontSize: ".62em", color: "#718096" }}>
        🟢 {onlineCount}/6 online · Severity: {(severity * 100).toFixed(0)}%
      </div>
    </div>
  );
}

// ── Network Topology (SVG node layout) ───────────────────────────────────
function NetworkTopology({ data }: { data: ModuleResult | null }) {
  const d = (data as any)?.data ?? {};

  const devices = [
    { key: "router",  icon: "📡", name: "Router",        val: d.router_status,                color: "#0284c7" },
    { key: "plc1",    icon: "🔌", name: "PLC 1",         val: d.PLC_network_status1 ?? d.PLC1_status, color: "#7c3aed" },
    { key: "plc2",    icon: "🔌", name: "PLC 2",         val: d.PLC_network_status2 ?? d.PLC2_status, color: "#7c3aed" },
    { key: "edgebox", icon: "💻", name: "EdgeBox",       val: d.edgebox_network_status ?? d.edgebox_status, color: "#0891b2" },
    { key: "pi5",     icon: "🖥️", name: "Pi5",           val: d.pi5_network_status ?? d.pi5_status,    color: "#059669" },
    { key: "meter1",  icon: "📊", name: "Energy Meter 1",val: d.energy_meter_network_status1 ?? d.energy_meter_status, color: "#d97706" },
  ];

  const isActive = (v: any) => v != null && ["active","online","connected","1",1].includes(String(v).toLowerCase());

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
      {devices.map((dev) => {
        const active = isActive(dev.val);
        return (
          <div key={dev.key} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            padding: "14px 10px", borderRadius: 10,
            background: active ? "rgba(34,197,94,.05)" : "rgba(239,68,68,.04)",
            border: `2px solid ${active ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)"}`,
            position: "relative",
          }}>
            {/* LED indicator */}
            <div style={{
              position: "absolute", top: 8, right: 8,
              width: 8, height: 8, borderRadius: "50%",
              background: active ? "#22c55e" : "#ef4444",
              boxShadow: `0 0 6px ${active ? "#22c55e" : "#ef4444"}88`,
            }} />
            <div style={{ fontSize: "1.6em" }}>{dev.icon}</div>
            <div style={{ fontSize: ".65em", fontWeight: 700, color: "#2d3748", textAlign: "center" }}>{dev.name}</div>
            <div style={{
              fontSize: ".58em", fontWeight: 700, padding: "2px 8px", borderRadius: 10,
              background: active ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)",
              color: active ? "#16a34a" : "#dc2626",
              fontFamily: "'JetBrains Mono',monospace",
            }}>
              {dev.val ?? "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Severity bar (.m5-sev pattern) ───────────────────────────────────────
function SeverityBar({ severity, onlineCount }: { severity: number; onlineCount: number }) {
  const color = severity > 0.7 ? "#dc2626" : severity > 0.4 ? "#d97706" : "#22c55e";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".62em", marginBottom: 4 }}>
        <span style={{ color: "#718096", fontWeight: 600 }}>Network Severity</span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color }}>
          {(severity * 100).toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${severity * 100}%`, height: "100%", background: color, borderRadius: 4, transition: "width .6s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: ".6em" }}>
        <span style={{ color: "#22c55e", fontWeight: 700 }}>🟢 Online: {onlineCount}/6</span>
        <span style={{ color: "#ef4444", fontWeight: 700 }}>🔴 Offline: {6 - onlineCount}</span>
      </div>
    </div>
  );
}

// ── Condition table (C01–C12) ─────────────────────────────────────────────
const M5_CONDITIONS = [
  { id:"C01", tp:"Rule",   nm:"Router Status",            rule:"router_status == Inactive",        thr:"Inactive",  eq:"Router",       eqC:"#0284c7" },
  { id:"C02", tp:"Hybrid", nm:"PLC1 Network Status",      rule:"PLC_network_status1 + AI",          thr:"Inactive",  eq:"PLC",          eqC:"#7c3aed" },
  { id:"C03", tp:"Hybrid", nm:"PLC2 Network Status",      rule:"PLC_network_status2 + AI",          thr:"Inactive",  eq:"PLC",          eqC:"#7c3aed" },
  { id:"C04", tp:"AI",     nm:"EdgeBox Network",          rule:"edgebox_network + Autoencoder",     thr:"score>0.5", eq:"EdgeBox",      eqC:"#0891b2" },
  { id:"C05", tp:"AI",     nm:"Pi5 Network",              rule:"pi5_network + AI ensemble",         thr:"score>0.5", eq:"Pi5",          eqC:"#059669" },
  { id:"C06", tp:"Rule",   nm:"Energy Meter 1 Network",   rule:"energy_meter_network_status1",      thr:"Inactive",  eq:"Energy Meter", eqC:"#d97706" },
  { id:"C07", tp:"Rule",   nm:"Energy Meter 2 Network",   rule:"energy_meter_network_status2",      thr:"Inactive",  eq:"Energy Meter", eqC:"#d97706" },
  { id:"C08", tp:"AI",     nm:"Router Internet Status",   rule:"router_internet + RSSI + AI",       thr:"score>0.5", eq:"Router",       eqC:"#0284c7" },
  { id:"C09", tp:"AI",     nm:"RSSI Signal Strength",     rule:"RSSI < -70 dBm or == 0",            thr:"-70 dBm",   eq:"Router",       eqC:"#0284c7" },
  { id:"C10", tp:"Rule",   nm:"MQTT Broker Connection",   rule:"mqtt_connected == False",           thr:"Disconnected",eq:"Broker",     eqC:"#6366f1" },
  { id:"C11", tp:"AI",     nm:"Anomaly Score Threshold",  rule:"Ensemble score > 0.5",              thr:"score>0.5", eq:"System",       eqC:"#64748b" },
  { id:"C12", tp:"AI",     nm:"Composite Severity",       rule:"severity_index > 0.4",              thr:">0.4",      eq:"System",       eqC:"#64748b" },
];

function ConditionTable({ data }: { data: ModuleResult | null }) {
  const d = (data as any)?.data ?? {};
  const isOffline = (v: any) => v != null && ["inactive","offline","disconnected","0"].includes(String(v).toLowerCase());

  const getStatus = (cid: string): "OK" | "WARN" | "CRIT" => {
    if (cid === "C01" && isOffline(d.router_status)) return "CRIT";
    if (cid === "C02" && isOffline(d.PLC_network_status1 ?? d.PLC1_status)) return "CRIT";
    if (cid === "C03" && isOffline(d.PLC_network_status2 ?? d.PLC2_status)) return "CRIT";
    if (cid === "C06" && isOffline(d.energy_meter_network_status1)) return "CRIT";
    if (cid === "C07" && isOffline(d.energy_meter_network_status2)) return "CRIT";
    if (cid === "C10" && (data as any)?.mqtt_connected === false) return "CRIT";
    return "OK";
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".62em", fontFamily: "'JetBrains Mono',monospace" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["#","Type","Condition","Detection Rule","Threshold","Equipment"].map((h) => (
              <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, color: "#718096", borderBottom: "1px solid #d0dae8", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {M5_CONDITIONS.map((row, i) => {
            const st = getStatus(row.id);
            const tpBg    = row.tp==="Hybrid"?"rgba(2,132,199,.1)":row.tp==="AI"?"rgba(124,58,237,.1)":"rgba(100,116,139,.08)";
            const tpColor = row.tp==="Hybrid"?"#0284c7":row.tp==="AI"?"#7c3aed":"#64748b";
            const stBg    = st==="CRIT"?"rgba(239,68,68,.1)":"rgba(34,197,94,.08)";
            const stColor = st==="CRIT"?"#dc2626":"#16a34a";
            return (
              <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", background: st==="CRIT"?"rgba(239,68,68,.02)":i%2===0?"#fff":"#f8fafc" }}>
                <td style={{ padding: "5px 8px" }}>
                  <span style={{ padding:"1px 6px", borderRadius:4, fontWeight:700, fontSize:".9em", background:tpBg, color:tpColor }}>{row.id}</span>
                </td>
                <td style={{ padding: "5px 8px" }}>
                  <span style={{ padding:"1px 5px", borderRadius:3, fontSize:".85em", fontWeight:600, background:tpBg, color:tpColor }}>{row.tp}</span>
                </td>
                <td style={{ padding:"5px 8px", fontWeight:600, color:"#2d3748" }}>{row.nm}</td>
                <td style={{ padding:"5px 8px", color:"#64748b" }}>
                  <code style={{ background:"#f1f5f9", padding:"1px 4px", borderRadius:3 }}>{row.rule}</code>
                </td>
                <td style={{ padding:"5px 8px", whiteSpace:"nowrap" }}>
                  <span style={{ padding:"1px 6px", borderRadius:4, background:"rgba(100,116,139,.08)", color:"#64748b" }}>{row.thr}</span>
                </td>
                <td style={{ padding:"5px 8px", display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ color:row.eqC, fontWeight:600 }}>{row.eq}</span>
                  <span style={{ fontSize:".9em", fontWeight:700, padding:"1px 6px", borderRadius:8, background:stBg, color:stColor }}>{st}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────
export default function M5NetworkTreeTab({ data, countdown, isPaused, onTogglePause }: Props) {
  if (!data) return (
    <div style={{ padding:40, textAlign:"center", color:"#94a3b8", fontSize:".8em" }}>กำลังโหลด...</div>
  );

  const d           = (data as any).data ?? {};
  const rootCause   = (data as any).root_cause ?? "NORMAL";
  const severity    = (data as any).severity ?? (d.severity ?? 0);
  const onlineCount = (data as any).online_count ?? 0;
  const scores      = (data as any).model_scores ?? {};
  const vals        = Object.values(scores) as number[];
  const normal      = vals.filter((v) => v < 0.5).length;
  const warning     = vals.filter((v) => v >= 0.5 && v < 0.75).length;
  const alarm       = vals.filter((v) => v >= 0.75).length;

  const rcColor: Record<string,string> = {
    NORMAL:"#22c55e", NETWORK_FAILURE:"#dc2626", ROUTER_DOWN:"#dc2626",
    PLC_OFFLINE:"#d97706", PARTIAL_OUTAGE:"#d97706", INTERNET_DOWN:"#0284c7",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ ...S.card, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div style={S.ct}><i>🌐</i> Network Problem Detection — AI Status Tree</div>
        <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:".55em", fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:"#718096" }}>
          {[{l:"Hybrid",bg:"linear-gradient(135deg,#0284c7,#06b6d4)"},{l:"AI",bg:"linear-gradient(135deg,#7c3aed,#a855f7)"},{l:"Rule",bg:"linear-gradient(135deg,#475569,#64748b)"}].map((i)=>(
            <span key={i.l} style={{ display:"flex", alignItems:"center", gap:3 }}>
              <span style={{ width:8, height:8, borderRadius:2, background:i.bg, display:"inline-block" }}/>
              {i.l}
            </span>
          ))}
        </div>
      </div>

      <AutoPredictPanel
        badge={data.error ? "error" : "done"}
        countdown={countdown}
        enabled={!isPaused}
        onToggle={onTogglePause}
        predictedAt={data._result_ts ? new Date(data._result_ts).toLocaleTimeString("th-TH") : undefined}
        result={rootCause}
      />

      <HealthSummaryBar normal={normal || 6} warning={warning} alarm={alarm} total={6} />

      {/* Root cause + severity */}
      <div style={{ ...S.card, borderTop:`3px solid ${rcColor[rootCause]??"#d0dae8"}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap", marginBottom:14 }}>
          <div style={{ flex:1 }}>
            <div style={S.ct}><i>🔍</i> Root Cause</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"1.2em", fontWeight:800, color:rcColor[rootCause]??"#718096" }}>
              {rootCause}
            </div>
          </div>
          <div style={{ flex:2, minWidth:200 }}>
            <SeverityBar severity={severity} onlineCount={onlineCount} />
          </div>
        </div>

        {/* Network topology */}
        <div style={S.ct}><i>🗺️</i> Network Topology</div>
        <NetworkTopology data={data} />
      </div>

      {/* AI Model Tree */}
      <div style={S.card}>
        <div style={S.ct}><i>🤖</i> AI Model Status Tree</div>
        <M5ModelTree data={data} />
      </div>

      {/* Condition table */}
      <div style={S.card}>
        <div style={S.ct}><i>📋</i> Monitoring Conditions (C01–C12)</div>
        <ConditionTable data={data} />
      </div>
    </div>
  );
}