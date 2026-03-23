"use client";
import React, { useState } from "react";

export default function M4StandardsTab() {
  const [activeStd, setActiveStd] = useState<string | null>(null);

  const standards = [
    {
      code: "ISO 15118-2:2014",
      badge: "ISO",
      badgeColor: "#0284c7",
      title: "V2G Communication Interface",
      scope: "Vehicle-to-Grid communication — EV side (EVCC) to charger side (SECC)",
      details: "Defines CurrentDemandReq/Res tolerance ±5%. Session timeout triggers emergency stop. All M4 AI conditions reference this standard for voltage/current deviation thresholds.",
      conditions: ["C01", "C02", "C03", "C04"],
      severity: "HIGH",
    },
    {
      code: "IEC 61851-23:2014",
      badge: "IEC",
      badgeColor: "#7c3aed",
      title: "DC EV Charging Station",
      scope: "DC fast charging station requirements including thermal limits and voltage regulation",
      details: "§101.2 defines power module thermal derating at 55°C: −3.2A/°C and −1kW/°C. Voltage regulation tolerance ±2%. Primary reference for M4 thermal conditions.",
      conditions: ["C07", "C08", "C09", "C10", "C11", "C12"],
      severity: "CRITICAL",
    },
    {
      code: "IEC 62196-3",
      badge: "IEC",
      badgeColor: "#059669",
      title: "CCS Type 2 Connector",
      scope: "Plugs, socket-outlets, vehicle connectors — DC charging",
      details: "CCS Type 2 connector cable temperature limit ≤90°C. Phoenix Contact boost mode derating table applies: 25°C→200A continuous, 45°C→150A continuous.",
      conditions: ["C17", "C18"],
      severity: "CRITICAL",
    },
    {
      code: "IEC 61851-1",
      badge: "IEC",
      badgeColor: "#d97706",
      title: "General EV Charging Requirements",
      scope: "General requirements for EV conductive charging systems",
      details: "Defines charging modes 1–4, safety requirements, and general operational parameters. Referenced for module status monitoring conditions.",
      conditions: ["C13", "C14"],
      severity: "MEDIUM",
    },
    {
      code: "DIN 70121",
      badge: "DIN",
      badgeColor: "#dc2626",
      title: "DC Charging Communication",
      scope: "Predecessor to ISO 15118 — HomePlug GreenPHY PLC communication",
      details: "HomePlug GreenPHY PLC link must be maintained during charging. PLC loss during CurrentDemand phase requires safe shutdown sequence.",
      conditions: ["C15", "C16"],
      severity: "CRITICAL",
    },
  ];

  // CCS derating table (Phoenix Contact)
  const derating = [
    { temp: "25°C", c1: "200A", c2: "250A→30min", c3: "300A→10min", c4: "375A→3min" },
    { temp: "35°C", c1: "200A", c2: "250A→15min", c3: "300A→5min", c4: "—" },
    { temp: "45°C", c1: "150A", c2: "200A→10min", c3: "250A→3min", c4: "—" },
    { temp: "50°C", c1: "125A", c2: "150A→5min", c3: "—", c4: "—" },
  ];

  // Condition mapping
  const conditionMap = [
    { id: "C01", type: "Hybrid", std: "ISO 15118-2", rule: "Voltage Anomaly H1", eq: "Power Module", eqColor: "#dc2626", threshold: ">0.5%" },
    { id: "C02", type: "Hybrid", std: "ISO 15118-2", rule: "Current Anomaly H1", eq: "Power Module", eqColor: "#dc2626", threshold: ">0.5%" },
    { id: "C03", type: "Hybrid", std: "ISO 15118-2", rule: "Voltage Anomaly H2", eq: "Power Module", eqColor: "#dc2626", threshold: ">0.5%" },
    { id: "C04", type: "Hybrid", std: "ISO 15118-2", rule: "Current Anomaly H2", eq: "Power Module", eqColor: "#dc2626", threshold: ">0.5%" },
    { id: "C05", type: "Hybrid", std: "ISO 15118-2", rule: "Power Anomaly H1", eq: "Power Module", eqColor: "#dc2626", threshold: "V×I check" },
    { id: "C06", type: "Hybrid", std: "ISO 15118-2", rule: "Power Anomaly H2", eq: "Power Module", eqColor: "#dc2626", threshold: "V×I check" },
    { id: "C07", type: "Hybrid", std: "IEC 61851-23", rule: "PM Temp 1", eq: "Power Module", eqColor: "#dc2626", threshold: ">55°C" },
    { id: "C08", type: "Hybrid", std: "IEC 61851-23", rule: "PM Temp 2", eq: "Power Module", eqColor: "#dc2626", threshold: ">55°C" },
    { id: "C09", type: "Hybrid", std: "IEC 61851-23", rule: "PM Temp 3", eq: "Power Module", eqColor: "#dc2626", threshold: ">55°C" },
    { id: "C10", type: "Hybrid", std: "IEC 61851-23", rule: "PM Temp 4", eq: "Power Module", eqColor: "#dc2626", threshold: ">55°C" },
    { id: "C11", type: "Hybrid", std: "IEC 61851-23", rule: "PM Temp 5", eq: "Power Module", eqColor: "#dc2626", threshold: ">55°C" },
    { id: "C12", type: "AI", std: "IEC 61851-23", rule: "Charger Temp", eq: "Power Module", eqColor: "#dc2626", threshold: "Score>0.5" },
    { id: "C13", type: "Rule", std: "IEC 61851-1", rule: "Module Status H1", eq: "Power Module", eqColor: "#dc2626", threshold: "Inactive" },
    { id: "C14", type: "Rule", std: "IEC 61851-1", rule: "Module Status H2", eq: "Power Module", eqColor: "#dc2626", threshold: "Inactive" },
    { id: "C15", type: "Rule", std: "DIN 70121", rule: "PLC Anomaly H1", eq: "Power Module", eqColor: "#dc2626", threshold: "Inactive" },
    { id: "C16", type: "Rule", std: "DIN 70121", rule: "PLC Anomaly H2", eq: "Power Module", eqColor: "#dc2626", threshold: "Inactive" },
    { id: "C17", type: "Rule", std: "IEC 62196-3", rule: "Cable Safety H1", eq: "Charging Connector", eqColor: "#0d9488", threshold: ">90°C" },
    { id: "C18", type: "Rule", std: "IEC 62196-3", rule: "Cable Safety H2", eq: "Charging Connector", eqColor: "#0d9488", threshold: ">90°C" },
    { id: "C19", type: "AI", std: "Phoenix Contact", rule: "EdgeBox Temp", eq: "OCPP EdgeBox", eqColor: "#0891b2", threshold: "Score>0.5" },
    { id: "C20", type: "AI", std: "—", rule: "Daily Energy H1", eq: "Unknown", eqColor: "#78716c", threshold: "Score>0.5" },
    { id: "C21", type: "AI", std: "—", rule: "Daily Energy H2", eq: "Unknown", eqColor: "#78716c", threshold: "Score>0.5" },
    { id: "C22", type: "Rule", std: "—", rule: "Energy Meter Status", eq: "Energy Meter", eqColor: "#059669", threshold: "Inactive" },
  ];

  const typeBg = (t: string) => t === "Hybrid" ? "rgba(2,132,199,.1)" : t === "AI" ? "rgba(124,58,237,.1)" : "rgba(100,116,139,.08)";
  const typeColor = (t: string) => t === "Hybrid" ? "#0284c7" : t === "AI" ? "#7c3aed" : "#64748b";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Intro */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
        <div style={{ fontSize: ".72em", fontWeight: 800, marginBottom: 8 }}>📚 Standards Reference — M4 Abnormal Power Delivery</div>
        <div style={{ fontSize: ".65em", color: "#718096", lineHeight: 1.7 }}>
          M4 ตรวจจับ 22 conditions โดย map กับมาตรฐานสากล 5 ฉบับ
          ทุก condition มีระบุ Standard, Threshold และ Equipment group
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {[
            { c: "rgba(2,132,199,.1)", t: "#0284c7", l: "ISO 15118-2" },
            { c: "rgba(124,58,237,.1)", t: "#7c3aed", l: "IEC 61851-23" },
            { c: "rgba(5,150,105,.1)", t: "#059669", l: "IEC 62196-3" },
            { c: "rgba(217,119,6,.1)", t: "#d97706", l: "IEC 61851-1" },
            { c: "rgba(220,38,38,.1)", t: "#dc2626", l: "DIN 70121" },
          ].map((item) => (
            <span key={item.l} style={{ fontSize: ".6em", fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: item.c, color: item.t }}>
              {item.l}
            </span>
          ))}
        </div>
      </div>

      {/* Standard cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
        {standards.map((s) => (
          <div
            key={s.code}
            onClick={() => setActiveStd(activeStd === s.code ? null : s.code)}
            style={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              borderLeft: `4px solid ${s.badgeColor}`,
              padding: "14px 16px",
              cursor: "pointer",
              background: activeStd === s.code ? `${s.badgeColor}06` : "#fff",
              transition: "all .2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: ".6em", fontWeight: 800, padding: "2px 7px", borderRadius: 4, background: `${s.badgeColor}15`, color: s.badgeColor, flexShrink: 0 }}>
                {s.badge}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: ".72em", fontWeight: 700, color: "#2d3748" }}>{s.code}</div>
                <div style={{ fontSize: ".6em", color: s.badgeColor, fontWeight: 600 }}>{s.title}</div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {s.conditions.map((c) => (
                  <span key={c} style={{ fontSize: ".52em", padding: "1px 5px", borderRadius: 3, background: `${s.badgeColor}12`, color: s.badgeColor, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ fontSize: ".6em", color: "#718096", lineHeight: 1.6 }}>{s.scope}</div>
            {activeStd === s.code && (
              <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 6, background: `${s.badgeColor}08`, border: `1px solid ${s.badgeColor}25`, fontSize: ".6em", color: "#2d3748", lineHeight: 1.7 }}>
                {s.details}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CCS Derating Table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
        <div style={{ fontSize: ".62em", fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 12 }}>
          🔥 CCS Cable Derating Table (Phoenix Contact) — Conditions C17, C18
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".62em", fontFamily: "'JetBrains Mono',monospace" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Temp", "Continuous", "30 min", "10 min", "3–5 min"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#718096", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {derating.map((row, i) => (
                <tr key={row.temp} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "7px 12px", fontWeight: 800, color: "#dc2626" }}>{row.temp}</td>
                  <td style={{ padding: "7px 12px", color: "#22c55e", fontWeight: 700 }}>{row.c1}</td>
                  <td style={{ padding: "7px 12px", color: row.c2 === "—" ? "#94a3b8" : "#d97706" }}>{row.c2}</td>
                  <td style={{ padding: "7px 12px", color: row.c3 === "—" ? "#94a3b8" : "#f97316" }}>{row.c3}</td>
                  <td style={{ padding: "7px 12px", color: row.c4 === "—" ? "#94a3b8" : "#dc2626" }}>{row.c4}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 8, fontSize: ".58em", color: "#94a3b8" }}>
          Boost mode: duration limits apply when operating above continuous rating. Exceeding limits triggers automatic derating.
        </div>
      </div>

      {/* Condition mapping table */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 20px" }}>
        <div style={{ fontSize: ".62em", fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 12 }}>
          📋 All 22 Conditions — Standard Mapping
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".6em" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["#", "Type", "Condition", "Threshold", "Standard", "Equipment"].map((h) => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: "#718096", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {conditionMap.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "5px 10px" }}>
                    <span style={{ padding: "1px 6px", borderRadius: 4, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", background: typeBg(c.type), color: typeColor(c.type) }}>
                      {c.id}
                    </span>
                  </td>
                  <td style={{ padding: "5px 10px" }}>
                    <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: ".9em", fontWeight: 600, background: typeBg(c.type), color: typeColor(c.type) }}>
                      {c.type}
                    </span>
                  </td>
                  <td style={{ padding: "5px 10px", fontWeight: 600, color: "#2d3748" }}>{c.rule}</td>
                  <td style={{ padding: "5px 10px" }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", padding: "1px 6px", borderRadius: 4, background: "rgba(100,116,139,.08)", color: "#64748b" }}>
                      {c.threshold}
                    </span>
                  </td>
                  <td style={{ padding: "5px 10px", color: "#0284c7", fontFamily: "'JetBrains Mono',monospace", fontSize: ".9em" }}>{c.std}</td>
                  <td style={{ padding: "5px 10px", color: c.eqColor, fontWeight: 600 }}>{c.eq}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}