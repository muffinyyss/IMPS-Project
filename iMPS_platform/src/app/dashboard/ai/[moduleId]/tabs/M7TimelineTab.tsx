"use client";
import React, { useRef, useEffect, useState } from "react";
import { ModuleResult } from "../../lib/api";

interface Props { 
  data: ModuleResult | null;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
 }
interface TLEntry { ts: Date; val: number; name: string; }

const M7_TL_MAX = 50;

const ICP_STATES: Record<number,{name:string;color:string}> = {
  0:{name:"Inactive",color:"#6b7280"},  1:{name:"A1",      color:"#94a3b8"},
  2:{name:"B1",      color:"#60a5fa"},  3:{name:"C1",      color:"#34d399"},
  4:{name:"D1",      color:"#a3e635"},  5:{name:"A2",      color:"#c084fc"},
  6:{name:"B2",      color:"#38bdf8"},  7:{name:"C2",      color:"#22c55e"},
  8:{name:"D2",      color:"#4ade80"},  9:{name:"E",       color:"#ef4444"},
  10:{name:"Error",  color:"#dc2626"},
};

const USL_COLORS = [
  "#6b7280","#94a3b8","#3b82f6","#2563eb","#1d4ed8","#7c3aed","#6d28d9","#a855f7",
  "#d946ef","#ec4899","#f43f5e","#f97316","#22c55e","#10b981","#14b8a6","#ef4444",
  "#64748b","#0ea5e9","#06b6d4","#8b5cf6","#d97706","#059669","#0284c7",
];

const USL_STATES: Record<number,string> = {
  0:"Ready",1:"Init",2:"SLAC ok",3:"SECC ok",4:"SupportedAppProtocol",
  5:"SessionSetup",6:"ServiceDiscovery",7:"ServicePaymentSelection",
  8:"ContractAuthentication",9:"ChargeParameterDiscovery",10:"CableCheck",
  11:"PreCharge",12:"PowerDelivery",13:"CurrentDemand",14:"WeldingDetection",
  15:"SessionStop",16:"ProtocolFinished",
};

const SEQ_STEPS = [
  {uslink:2,label:"SLAC Matching"},{uslink:3,label:"SECC Comm"},{uslink:4,label:"AppProtocol"},
  {uslink:5,label:"SessionSetup"},{uslink:6,label:"ServiceDiscovery"},{uslink:7,label:"PaymentSelection"},
  {uslink:8,label:"Authentication"},{uslink:9,label:"ParamDiscovery"},{uslink:10,label:"CableCheck"},
  {uslink:11,label:"PreCharge"},{uslink:12,label:"PowerDelivery"},{uslink:13,label:"CurrentDemand"},
  {uslink:14,label:"WeldingDetect"},{uslink:15,label:"SessionStop"},
];

// ─── Canvas Gantt ─────────────────────────────────────────────────────────
function TimelineCanvas({ history, colorMap, title }: {
  history: TLEntry[]; colorMap: Record<number,string>; title: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const W = cv.offsetWidth || 900, H = cv.height;
    cv.width = W;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0,0,W,H);

    if (!history.length) {
      ctx.fillStyle = "#64748b";
      ctx.font = "13px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for data… (auto-predict will populate)", W/2, H/2);
      return;
    }

    const pad = { l:50, r:20, t:15, b:25 };
    const gW = W-pad.l-pad.r, gH = H-pad.t-pad.b;
    const barH = Math.max(gH*.6,16);
    const barY = pad.t+(gH-barH)/2;
    const n = history.length;

    for (let i=0; i<n; i++) {
      const x = pad.l + i*(gW/n);
      const w = Math.max(gW/n-1,2);
      ctx.fillStyle = colorMap[history[i].val] ?? "#6b7280";
      ctx.fillRect(x,barY,w,barH);
    }

    ctx.fillStyle = "#64748b";
    ctx.font = "9px JetBrains Mono";
    ctx.textAlign = "center";
    const step = Math.max(Math.floor(n/6),1);
    for (let i=0; i<n; i+=step) {
      const x = pad.l+i*(gW/n)+gW/n/2;
      ctx.fillText(history[i].ts.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),x,H-5);
    }
    ctx.save();
    ctx.translate(12,H/2);
    ctx.rotate(-Math.PI/2);
    ctx.textAlign="center";
    ctx.font="10px JetBrains Mono";
    ctx.fillStyle="#94a3b8";
    ctx.fillText("State",0,0);
    ctx.restore();
  }, [history]);

  const stateSet: Record<string,string> = {};
  history.forEach((h) => { if (!(h.val in stateSet)) stateSet[h.val]=h.name; });

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontWeight:700, fontSize:".82em", marginBottom:4 }}>{title}</div>
      <div style={{ fontSize:".68em", color:"#718096", marginBottom:6 }}>Most recent {M7_TL_MAX} transitions</div>
      <div style={{ width:"100%", overflow:"hidden", borderRadius:8, border:"1px solid #334155" }}>
        <canvas ref={ref} height={120} style={{ width:"100%", display:"block" }}/>
      </div>
      {Object.keys(stateSet).length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:6, fontSize:".62em" }}>
          {Object.entries(stateSet).map(([k,name]) => (
            <span key={k} style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:colorMap[Number(k)]??"#6b7280" }}/>
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sequence flow pills ──────────────────────────────────────────────────
function SeqFlow({ current }: { current:number|null }) {
  return (
    <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:4, marginTop:12 }}>
      {SEQ_STEPS.map((s,i) => {
        const past    = current!=null && current>=s.uslink;
        const curr    = current===s.uslink;
        const col     = USL_COLORS[s.uslink]??"#6b7280";
        return (
          <React.Fragment key={s.uslink}>
            <span style={{ padding:"3px 10px", borderRadius:14, fontSize:".62em", fontWeight:700, fontFamily:"'JetBrains Mono',monospace", background:curr?col:past?`${col}20`:"rgba(0,0,0,.04)", color:curr?"#fff":past?col:"#94a3b8", border:`1px solid ${curr?col:past?`${col}40`:"#e2e8f0"}`, boxShadow:curr?`0 0 8px ${col}55`:undefined, transition:"all .3s" }}>{s.label}</span>
            {i<SEQ_STEPS.length-1 && <span style={{ fontSize:".6em", color:past?col:"#94a3b8", transition:"color .3s" }}>▶</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── ISO 15118 sequence diagram ───────────────────────────────────────────
function SeqDiagram({ current }: { current:number|null }) {
  return (
    <div style={{ overflowX:"auto" }}>
      <div style={{ minWidth:700, fontSize:".7em", fontFamily:"'JetBrains Mono',monospace" }}>
        <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 120px", textAlign:"center" }}>
          <div style={{ fontWeight:800, padding:8, background:"#f8fafc", borderRadius:"8px 0 0 0" }}>EVCC (EV)</div>
          <div style={{ fontWeight:800, padding:8, background:"#f8fafc" }}>↔ Messages</div>
          <div style={{ fontWeight:800, padding:8, background:"#f8fafc", borderRadius:"0 8px 0 0" }}>SECC (EVSE)</div>
        </div>
        <div style={{ border:"1px solid #d0dae8", borderTop:"none", borderRadius:"0 0 8px 8px", overflow:"hidden" }}>
          {SEQ_STEPS.map((s) => {
            const past = current!=null && current>=s.uslink;
            const curr = current===s.uslink;
            const col  = USL_COLORS[s.uslink]??"#6b7280";
            return (
              <div key={s.uslink} style={{ display:"grid", gridTemplateColumns:"120px 1fr 120px", padding:"6px 8px", background:curr?`${col}10`:past?`${col}05`:"transparent", borderBottom:"1px solid #f1f5f9", transition:"background .3s" }}>
                <div style={{ textAlign:"center", color:curr?col:past?"#22c55e":"#94a3b8", fontWeight:700 }}>{past?"✓":"—"}</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:curr?col:past?col:"#e2e8f0", flexShrink:0 }}/>
                  <span style={{ color:curr?col:past?"#2d3748":"#94a3b8", fontWeight:curr?800:400 }}>{s.label}</span>
                  <span style={{ fontSize:".8em", padding:"0 6px", borderRadius:4, background:`${col}15`, color:col, fontWeight:600 }}>{s.uslink}</span>
                </div>
                <div style={{ textAlign:"center", color:curr?col:past?"#22c55e":"#94a3b8", fontWeight:700 }}>{past?"✓":"—"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function M7TimelineTab({ data }: Props) {
  const [icpHist, setIcpHist] = useState<TLEntry[]>([]);
  const [uslHist, setUslHist] = useState<TLEntry[]>([]);

  useEffect(() => {
    if (!data) return;
    const d = data as any;
    const now = new Date();
    if (d.icp_state != null) {
      setIcpHist((prev) => [...prev, { ts:now, val:d.icp_state, name:ICP_STATES[d.icp_state]?.name??`State ${d.icp_state}` }].slice(-M7_TL_MAX));
    }
    if (d.uslink_state != null) {
      setUslHist((prev) => [...prev, { ts:now, val:d.uslink_state, name:USL_STATES[d.uslink_state]??`State ${d.uslink_state}` }].slice(-M7_TL_MAX));
    }
  }, [data]);

  const icpCM: Record<number,string> = {};
  Object.entries(ICP_STATES).forEach(([k,s]) => { icpCM[Number(k)]=s.color; });

  const uslCM: Record<number,string> = {};
  USL_COLORS.forEach((c,i) => { uslCM[i]=c; });

  const uslCurrent = (data as any)?.uslink_state ?? null;

  return (
    <div>
      {/* Canvas timelines */}
      <div style={{ background:"#fff", border:"1px solid #d0dae8", borderRadius:12, padding:16, marginBottom:14, borderTop:"3px solid #ec4899" }}>
        <TimelineCanvas history={icpHist} colorMap={icpCM} title="⚡ ICP State Timeline (in-memory)" />
        <TimelineCanvas history={uslHist} colorMap={uslCM} title="🔗 USLink State Timeline (in-memory)" />
      </div>

      {/* Warning */}
      <div style={{ padding:"10px 14px", borderRadius:10, marginBottom:14, background:"rgba(245,158,11,.06)", border:"1px solid rgba(245,158,11,.2)", fontSize:".72em", color:"#92400e" }}>
        ⚠ Timeline เป็น in-memory buffer (max {M7_TL_MAX} entries) — ข้อมูลหายเมื่อ refresh หน้า · สะสมจาก polling ทุก 120 วินาที
      </div>

      {/* Sequence flow */}
      <div style={{ background:"#fff", border:"1px solid #d0dae8", borderRadius:12, padding:16, marginBottom:14 }}>
        <div style={{ fontWeight:700, fontSize:".82em", marginBottom:8 }}>🔄 DC Charging Sequence Flow (ISO 15118)</div>
        <SeqFlow current={uslCurrent} />
      </div>

      {/* Sequence diagram */}
      <div style={{ background:"#fff", border:"1px solid #d0dae8", borderRadius:12, padding:16, marginBottom:14 }}>
        <div style={{ fontWeight:700, fontSize:".82em", marginBottom:12 }}>📋 EVCC ↔ SECC Message Sequence</div>
        <SeqDiagram current={uslCurrent} />
      </div>
    </div>
  );
}