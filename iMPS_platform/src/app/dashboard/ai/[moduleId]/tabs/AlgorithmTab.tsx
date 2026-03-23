"use client";
import React, { useState } from "react";

interface Props {
    modNum: number;
    modLabel: string;
    modColor: string;
    countdown?: number;
    isPaused?: boolean;
    onTogglePause?: () => void;
}

// ── Model card ────────────────────────────────────────────────────────────
function ModelCard({ id, name, type, weight, output, desc, icon, color }: {
    id: string; name: string; type: "ML" | "DL" | "UL" | "Rule" | "Ensemble" | "AI";
    weight?: string; output: string; desc: string; icon?: string; color: string;
}) {
    const typeCls: Record<string, string> = {
        ML: "tw-bg-blue-100 tw-text-blue-700",
        DL: "tw-bg-purple-100 tw-text-purple-700",
        UL: "tw-bg-amber-100 tw-text-amber-700",
        Rule: "tw-bg-gray-100 tw-text-gray-600",
        Ensemble: "tw-bg-green-100 tw-text-green-700",
        AI: "tw-bg-pink-100 tw-text-pink-700",   // ← เพิ่ม
    };
    return (
        <div className="tw-bg-gray-50 tw-border tw-border-gray-100 tw-rounded-xl tw-p-4 tw-mb-2 hover:tw-border-gray-200 tw-transition-colors">
            <div className="tw-flex tw-items-start tw-gap-3">
                <div className="tw-flex-shrink-0">
                    <span className="tw-font-mono tw-text-xs tw-font-bold tw-px-2 tw-py-0.5 tw-rounded tw-text-white tw-inline-block"
                        style={{ background: color }}>{id}</span>
                </div>
                <div className="tw-flex-1 tw-min-w-0">
                    <div className="tw-flex tw-items-center tw-gap-2 tw-flex-wrap tw-mb-1">
                        <div className="tw-flex tw-items-center tw-gap-1.5">
                            {icon && <span className="tw-text-base">{icon}</span>}
                            <span className="tw-text-sm tw-font-bold tw-text-gray-800">{name}</span>
                        </div>
                        <span className={`tw-text-xs tw-px-2 tw-py-0.5 tw-rounded tw-font-bold ${typeCls[type]}`}>{type}</span>
                        {weight && (
                            <span className="tw-text-xs tw-px-2 tw-py-0.5 tw-rounded tw-font-bold"
                                style={{ background: color + "15", color }}>
                                {weight}
                            </span>
                        )}
                    </div>
                    <p className="tw-text-xs tw-text-gray-500 tw-leading-relaxed tw-mb-2">{desc}</p>
                    <div className="tw-font-mono tw-text-xs tw-bg-gray-900 tw-text-green-400 tw-px-3 tw-py-1.5 tw-rounded-lg">
                        <span className="tw-text-blue-400 tw-font-bold">OUTPUT</span> {output}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Info block ────────────────────────────────────────────────────────────
function InfoBlock({ title, children, color }: { title: string; children: React.ReactNode; color: string }) {
    return (
        <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-p-5 tw-mb-4">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
                <div className="tw-w-1 tw-h-5 tw-rounded-full" style={{ background: color }} />
                <div className="tw-text-sm tw-font-bold tw-text-gray-700">{title}</div>
            </div>
            {children}
        </div>
    );
}

// ── Formula block ─────────────────────────────────────────────────────────
function FormulaBlock({ code }: { code: string }) {
    return (
        <div className="tw-font-mono tw-text-xs tw-bg-gray-900 tw-text-gray-100 tw-rounded-xl tw-p-4 tw-overflow-x-auto tw-whitespace-pre">
            {code}
        </div>
    );
}

// ── Threshold table ───────────────────────────────────────────────────────
function ThresholdRow({ condition, label, status }: {
    condition: string; label: string; status: "ok" | "warn" | "crit";
}) {
    const cls = {
        ok: "tw-bg-green-100 tw-text-green-700",
        warn: "tw-bg-amber-100 tw-text-amber-700",
        crit: "tw-bg-red-100   tw-text-red-700",
    }[status];
    return (
        <div className="tw-flex tw-items-center tw-gap-3 tw-py-2 tw-border-b tw-border-gray-50 last:tw-border-0">
            <div className="tw-font-mono tw-text-xs tw-text-gray-600 tw-flex-1">{condition}</div>
            <span className={`tw-text-xs tw-px-2.5 tw-py-0.5 tw-rounded-full tw-font-bold tw-whitespace-nowrap ${cls}`}>
                {label}
            </span>
        </div>
    );
}

// ── Condition list ────────────────────────────────────────────────────────
function ConditionCard({ id, desc, type }: {
    id: string; desc: string; type: "AI+Rule" | "AI Only" | "Rule Only";
}) {
    const cls = {
        "AI+Rule": "tw-bg-purple-50 tw-border-purple-200 tw-text-purple-700",
        "AI Only": "tw-bg-blue-50   tw-border-blue-200   tw-text-blue-700",
        "Rule Only": "tw-bg-gray-50   tw-border-gray-200   tw-text-gray-600",
    }[type];
    return (
        <div className={`tw-flex tw-items-start tw-gap-2 tw-p-2.5 tw-rounded-lg tw-border ${cls}`}>
            <span className="tw-font-mono tw-text-xs tw-font-bold tw-flex-shrink-0">{id}</span>
            <span className="tw-text-xs">{desc}</span>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════
// MODULE-SPECIFIC CONTENT
// ══════════════════════════════════════════════════════════════════════════

function M1Algorithm({ color }: { color: string }) {
    return (
        <>
            <InfoBlock title="11 AI Models — Ensemble Voting" color={color}>
                <ModelCard id="RE" name="Rule Engine" type="Rule" icon="📏" color={color} weight="Fallback" desc="Rule-based weighted fallback เมื่อ AI models ไม่พร้อม คำนวณจาก filter_age(35%), MDB_temp(15%), temp_diff(15%), humidity(12%), pi5(10%), pressure(8%), status(5%)" output="float 0→100 (health score)" />
                <ModelCard id="A1" name="XGBoost Classifier" type="ML" icon="🌳" color={color} desc="Gradient-boosted decision trees จัดหมวด clogging level พร้อม SHAP explanation สำหรับ feature importance" output="int class 0-4 + float[5] probability + SHAP values" />
                <ModelCard id="A2" name="XGBoost Regressor" type="ML" icon="📈" color={color} desc="Regression version ทำนาย continuous clogging score แบบ 0-1" output="float 0→1 (clogging probability)" />
                <ModelCard id="B" name="Autoencoder" type="DL" icon="🔄" color={color} desc="Autoencoder 256→16→256 เรียนรู้ normal pattern แล้ว flag reconstruction error สูง = anomaly" output="float MSE reconstruction error (threshold: P95/P99/P99.9)" />
                <ModelCard id="C" name="Multi-Task DNN" type="DL" icon="🧠" color={color} desc="DNN หลาย output tasks: clogging score + 7 group scores (temperature, humidity, pressure, filter, power, status, composite)" output="float sigmoid + float[7] group scores" />
                <ModelCard id="D" name="BiLSTM-Attention" type="DL" icon="⏳" color={color} desc="Bidirectional LSTM + Attention mechanism จับ temporal pattern และ long-range dependencies ใน time series" output="float sigmoid + float[15] attention weights" />
                <ModelCard id="E" name="1D-CNN" type="DL" icon="🔬" color={color} desc="1D Convolutional Neural Network จับ local temporal pattern และ short-term anomaly spikes" output="float sigmoid" />
                <ModelCard id="F" name="Gradient Boosting" type="ML" icon="🚀" color={color} desc="Scikit-learn GradientBoostingRegressor เป็น complementary model กับ XGBoost" output="float regression score 0→1" />
                <ModelCard id="G1" name="Isolation Forest" type="UL" icon="🌲" color={color} desc="Unsupervised anomaly detection โดยการ isolate outliers ใน feature space ไม่ต้องการ labeled data" output="int 1/-1 (normal/anomaly) + float normalized score 0→1" />
                <ModelCard id="G2" name="LOF" type="UL" icon="🎯" color={color} desc="Local Outlier Factor วัด local density ของ data point เทียบกับ neighbors — anomaly = density ต่ำผิดปกติ" output="int 1/-1 + float normalized score 0→1" />
                <ModelCard id="EN" name="Ensemble" type="Ensemble" icon="⚡" color={color} desc="Weighted average ของทุก model บนสูตร ensemble_risk = weighted_sum ของ individual scores" output="float 0→1 (ensemble_risk = final decision)" />
            </InfoBlock>

            <InfoBlock title="Input Features" color={color}>
                <div className="tw-text-xs tw-text-gray-600 tw-leading-relaxed tw-mb-2">
                    <span className="tw-font-bold">Raw (8):</span> MDB_ambient_temp, pi5_temp, MDB_humidity, MDB_pressure, MDB_status, dust_filter_charging (days), meter1, meter2
                </div>
                <div className="tw-text-xs tw-text-gray-600 tw-leading-relaxed">
                    <span className="tw-font-bold">Engineered:</span> temp_diff, pressure_change_rate, humidity_trend, filter_age_factor, composite_score
                </div>
            </InfoBlock>

            <InfoBlock title="Health Score Formula" color={color}>
                <FormulaBlock code={`health = round((1 - ensemble_risk) × 100)

// ensemble_risk = weighted average ของทุก model
// range: 0.0 (clean) → 1.0 (clogged)

// Fallback (AI unavailable):
// health = filter_age(35%) + temp(15%) + temp_diff(15%)
//        + humidity(12%) + pi5(10%) + pressure(8%) + status(5%)`} />
            </InfoBlock>

            <InfoBlock title="Thresholds & Status" color={color}>
                <ThresholdRow condition="ensemble_risk < 0.25" label="✓ NORMAL — Clean" status="ok" />
                <ThresholdRow condition="ensemble_risk < 0.50" label="✓ OK — Moderate" status="ok" />
                <ThresholdRow condition="ensemble_risk < 0.75" label="⚠ WARN — Degraded" status="warn" />
                <ThresholdRow condition="ensemble_risk ≥ 0.75" label="✕ CRIT — Clogged" status="crit" />
            </InfoBlock>

            <div className="tw-bg-emerald-50 tw-border tw-border-emerald-200 tw-rounded-xl tw-p-3 tw-text-xs tw-text-emerald-700">
                ⚖️ <strong>System Health Weight: 12%</strong> — M1 มีผลต่อ System Health Score รวม 12%
            </div>
        </>
    );
}

function M2Algorithm({ color }: { color: string }) {
    return (
        <>
            <InfoBlock title="7 AI Models — Weighted Ensemble" color={color}>
                <ModelCard id="A1" name="XGBoost Regressor" type="ML" icon="📈" color={color} weight="15%" desc="Gradient-boosted trees ทำนาย clogging probability แบบ continuous" output="float 0→1" />
                <ModelCard id="A2" name="XGBoost Classifier" type="ML" icon="🌳" color={color} weight="15%" desc="Classification version จัดหมวด 5 ระดับ: Clean/Light/Moderate/Heavy/Severe พร้อม SHAP" output="int 0-4 class + float[5] proba + SHAP" />
                <ModelCard id="B" name="Autoencoder" type="DL" icon="🔄" color={color} weight="10%" desc="256→16→256 เรียนรู้ thermal signature ปกติ — reconstruction error สูง = filter อุดตัน" output="float MSE (threshold: P95 / P99 / P99.9)" />
                <ModelCard id="C" name="Multi-Task DNN" type="DL" icon="🧠" color={color} weight="20%" desc="DNN 5-class + 7 group scores: temp_group, fan_group, env_group, cable_group, power_group, maint_group, composite" output="float sigmoid + float[7] group scores" />
                <ModelCard id="D" name="BiLSTM-Attention" type="DL" icon="⏳" color={color} weight="20%" desc="Temporal modeling ของ temperature trends พร้อม attention weights บอกว่า timestep ไหนสำคัญ" output="float sigmoid + float[7] groups + float[15] attention" />
                <ModelCard id="E1" name="Isolation Forest" type="UL" icon="🌲" color={color} weight="10%" desc="Unsupervised anomaly detection สำหรับ multi-sensor thermal profile" output="int 1/-1 + float 0→1" />
                <ModelCard id="E2" name="LOF" type="UL" icon="🎯" color={color} weight="10%" desc="Local Outlier Factor วัด density ของ thermal signature เทียบกับ neighborhood" output="int 1/-1 + float 0→1" />
            </InfoBlock>

            <InfoBlock title="Per-Condition Monitoring C01–C15" color={color}>
                <div className="tw-grid tw-grid-cols-1 tw-gap-2">
                    {[
                        { id: "C01-C05", desc: "Power Module Temp 1-5 — >55°C triggers AI derating check (IEC 61851-23 §101.2)", type: "AI+Rule" },
                        { id: "C06", desc: "Charger Ambient Temp — Overall enclosure thermal management", type: "AI+Rule" },
                        { id: "C07-C08", desc: "Fan RPM 1-8 — Low RPM indicates clogged filter impeding airflow", type: "Rule Only" },
                        { id: "C09-C10", desc: "Gun Temp Cable+ / Cable- — >50°C triggers CCS thermal derating", type: "Rule Only" },
                        { id: "C11", desc: "Humidity >80% — Condensation risk on power electronics", type: "Rule Only" },
                        { id: "C12", desc: "Edgebox/Pi5 Temp >70°C — CPU throttle reduces charging performance", type: "Rule Only" },
                        { id: "C13", desc: "Voltage Deviation — target vs present >5% deviation", type: "AI+Rule" },
                        { id: "C14", desc: "DFC Overdue — >720 hours since last dust filter change", type: "Rule Only" },
                        { id: "C15", desc: "Energy Throughput — Pattern-based anomaly detection", type: "AI Only" },
                    ].map((c) => <ConditionCard key={c.id} id={c.id} desc={c.desc} type={c.type as any} />)}
                </div>
            </InfoBlock>

            <InfoBlock title="Health Score Formula" color={color}>
                <FormulaBlock code={`// Linear scale based on max power module temperature:
maxTemp = max(power_module_temp1 ... power_module_temp5)
health  = round(max(0, min(100, 100 - (maxTemp - 35) × 2.5)))

// 35°C → 100% (Excellent)
// 55°C →  50% (Fair)
// 75°C →   0% (Critical)
// hot = maxTemp > 55°C → triggers AI derating`} />
            </InfoBlock>

            <div className="tw-bg-cyan-50 tw-border tw-border-cyan-200 tw-rounded-xl tw-p-3 tw-text-xs tw-text-cyan-700">
                ⚖️ <strong>System Health Weight: 12%</strong> — Ensemble weights: A1=15%, A2=15%, B=10%, C=20%, D=20%, E1=10%, E2=10%
            </div>
        </>
    );
}

function M3Algorithm({ color }: { color: string }) {
    const rootCauses = [
        { id: "0", name: "NETWORK_FAILURE", desc: "เครือข่ายล่ม — router/ISP issue" },
        { id: "1", name: "POWER_OUTAGE", desc: "ไฟดับ — voltage phase = 0" },
        { id: "2", name: "PLC_FAULT", desc: "PLC ขัดข้อง — communication failure" },
        { id: "3", name: "EDGEBOX_CRASH", desc: "Edge device ค้าง — process/memory issue" },
        { id: "4", name: "SCHEDULED_MAINTENANCE", desc: "บำรุงรักษาตามแผน — planned downtime" },
        { id: "5", name: "NORMAL", desc: "ปกติ — no anomaly detected" },
    ];
    return (
        <>
            <InfoBlock title="8 AI Models — Root Cause + Early Warning" color={color}>
                <ModelCard id="A1" name="XGBoost Root Cause" type="ML" icon="🌳" color={color} desc="จำแนก Root Cause 6 ประเภทจาก device status pattern พร้อม SHAP explanation" output="int class 0-5 + float[6] probability + SHAP values" />
                <ModelCard id="A2" name="DNN Root Cause" type="DL" icon="🧠" color={color} desc="Deep Neural Network จำแนก Root Cause — higher recall สำหรับ EDGEBOX_CRASH และ PLC_FAULT" output="int class 0-5 + float confidence" />
                <ModelCard id="B" name="Early Warning" type="DL" icon="⚠️" color={color} desc="ตรวจจับ pre-failure pattern ~2 นาทีก่อนเกิด offline event จาก LSTM sequence model" output="bool alert + int eta_seconds + string failing_device" />
                <ModelCard id="C" name="Autoencoder" type="DL" icon="🔄" color={color} desc="เรียนรู้ normal status pattern ของทุก device — MSE spike = อุปกรณ์กำลังจะ offline" output="float MSE per-device + string anomaly_level (low/med/high)" />
                <ModelCard id="D" name="BiLSTM-Attention" type="DL" icon="⏳" color={color} desc="Temporal modeling ของ device status sequence — attention weights บอก device ที่ผิดปกติ" output="float score + float[] attention + string pattern_type" />
                <ModelCard id="E" name="IF + LOF Ensemble" type="UL" icon="🔬" color={color} desc="50/50 weighted ensemble ของ Isolation Forest และ LOF สำหรับ unsupervised anomaly detection" output="int 1/-1 + float normalized 0→1" />
            </InfoBlock>

            <InfoBlock title="6 Root Cause Classes" color={color}>
                <div className="tw-flex tw-flex-col tw-gap-2">
                    {rootCauses.map((rc) => (
                        <div key={rc.id} className="tw-flex tw-items-start tw-gap-3 tw-p-2.5 tw-bg-gray-50 tw-rounded-lg tw-border tw-border-gray-100">
                            <span className="tw-w-5 tw-h-5 tw-rounded tw-flex tw-items-center tw-justify-center tw-text-xs tw-font-bold tw-text-white tw-flex-shrink-0" style={{ background: color }}>{rc.id}</span>
                            <div>
                                <div className="tw-font-mono tw-text-xs tw-font-bold tw-text-gray-700">{rc.name}</div>
                                <div className="tw-text-xs tw-text-gray-500">{rc.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </InfoBlock>

            <InfoBlock title="Hybrid Conditions C01–C06" color={color}>
                <div className="tw-grid tw-grid-cols-1 tw-gap-2">
                    {[
                        { id: "C01", desc: "Voltage Phase A — VL1N_MDB == 0 → Power Outage", type: "AI+Rule" },
                        { id: "C02", desc: "Voltage Phase B — VL2N_MDB == 0", type: "AI+Rule" },
                        { id: "C03", desc: "Voltage Phase C — VL3N_MDB == 0", type: "AI+Rule" },
                        { id: "C04", desc: "Current Draw — I1_MDB == 0 ขณะ Voltage > 0 → Network/PLC issue", type: "AI+Rule" },
                        { id: "C05", desc: "Frequency — 50Hz ±2% deviation → Power quality issue", type: "Rule Only" },
                        { id: "C06", desc: "Power Factor — PF < 0.85 → Equipment degradation", type: "Rule Only" },
                    ].map((c) => <ConditionCard key={c.id} id={c.id} desc={c.desc} type={c.type as any} />)}
                </div>
            </InfoBlock>

            <InfoBlock title="Health Score Formula" color={color}>
                <FormulaBlock code={`// Direct calculation — AI models used for root cause ONLY
health = round(online_count / total_devices × 100)

// 6 devices: edgebox, router, PLC1, PLC2, MDB, energy_meter
// Example: 5/6 online = 83% → Grade B
// Example: 4/6 online = 67% → Grade C (Warning)
// Example: 2/6 online = 33% → Grade F (Critical)`} />
                <div className="tw-mt-3 tw-p-3 tw-bg-amber-50 tw-rounded-lg tw-text-xs tw-text-amber-700 tw-border tw-border-amber-200">
                    ⚠ AI models (A1–E) ใช้สำหรับ Root Cause Analysis และ Early Warning เท่านั้น ไม่ได้ใช้คำนวณ health score
                </div>
            </InfoBlock>

            <div className="tw-bg-purple-50 tw-border tw-border-purple-200 tw-rounded-xl tw-p-3 tw-text-xs tw-text-purple-700">
                ⚖️ <strong>System Health Weight: 16%</strong> — Highest weight นอกจาก M4 เนื่องจาก offline ทำให้ charger ใช้งานไม่ได้เลย
            </div>
        </>
    );
}

function M4Algorithm({ color }: { color: string }) {
    const conditions = [
        { id: "C01", desc: "Voltage Anomaly H1 — ISO 15118 ±5% target vs present", type: "AI+Rule" },
        { id: "C02", desc: "Current Anomaly H1 — ΔI target deviation", type: "AI+Rule" },
        { id: "C03", desc: "Voltage Anomaly H2", type: "AI+Rule" },
        { id: "C04", desc: "Current Anomaly H2", type: "AI+Rule" },
        { id: "C05", desc: "Power Anomaly H1 — V×I inconsistency detection", type: "AI+Rule" },
        { id: "C06", desc: "Power Anomaly H2", type: "AI+Rule" },
        { id: "C07", desc: "PM Temp 1 — IEC 61851-23 §101.2 derating at 55°C", type: "AI+Rule" },
        { id: "C08", desc: "PM Temp 2 — 3.2A/°C + 1kW/°C derating formula", type: "AI+Rule" },
        { id: "C09", desc: "PM Temp 3", type: "AI+Rule" },
        { id: "C10", desc: "PM Temp 4", type: "AI+Rule" },
        { id: "C11", desc: "PM Temp 5", type: "AI+Rule" },
        { id: "C12", desc: "Charger Temp — Overall enclosure temperature limit", type: "AI+Rule" },
        { id: "C13", desc: "Module Status H1 — Active/Inactive binary check", type: "Rule Only" },
        { id: "C14", desc: "Module Status H2", type: "Rule Only" },
        { id: "C15", desc: "PLC Anomaly H1 — ISO 15118-3 HomePlug GreenPHY", type: "Rule Only" },
        { id: "C16", desc: "PLC Anomaly H2", type: "Rule Only" },
        { id: "C17", desc: "Cable Safety H1 — IEC 62196-3 CCS Type 2 ≤90°C", type: "Rule Only" },
        { id: "C18", desc: "Cable Safety H2 — Phoenix Contact derating table", type: "Rule Only" },
        { id: "C19", desc: "EdgeBox Temp — Pi5 CPU throttle >70°C", type: "AI Only" },
        { id: "C20", desc: "Daily Energy H1 — Pattern-based anomaly detection", type: "AI Only" },
        { id: "C21", desc: "Daily Energy H2", type: "AI Only" },
        { id: "C22", desc: "Energy Meter Status — Active/Inactive binary", type: "Rule Only" },
    ];

    return (
        <>
            <InfoBlock title="PerConditionEngine — Autoencoder + DNN" color={color}>
                <ModelCard id="AE" name="Autoencoder" type="DL" icon="🔄" color={color} desc="เรียนรู้ normal charging pattern ของแต่ละ condition group — reconstruction error สูง = anomaly" output="float anomaly score per group 0→1" />
                <ModelCard id="DNN" name="DNN Per-Condition" type="DL" icon="🧠" color={color} desc="Deep Neural Network แยก model สำหรับแต่ละ condition group (voltage, current, thermal, cable, energy)" output="float sigmoid per condition 0→1" />
                <ModelCard id="RULE" name="Rule-Based Engine" type="Rule" icon="📏" color={color} desc="9 real-time rules (R1–R6) สำหรับ immediate detection ไม่รอ AI inference — ทำงานทุก polling cycle" output="bool per rule + string severity (WARN/CRIT)" />
            </InfoBlock>

            <InfoBlock title="22 Conditions — Asset Health Tree" color={color}>
                <div className="tw-flex tw-gap-2 tw-mb-3 tw-flex-wrap">
                    <span className="tw-px-2 tw-py-1 tw-text-xs tw-rounded tw-bg-purple-50 tw-text-purple-700 tw-border tw-border-purple-200 tw-font-medium">AI+Rule (Hybrid)</span>
                    <span className="tw-px-2 tw-py-1 tw-text-xs tw-rounded tw-bg-blue-50 tw-text-blue-700 tw-border tw-border-blue-200 tw-font-medium">AI Only</span>
                    <span className="tw-px-2 tw-py-1 tw-text-xs tw-rounded tw-bg-gray-50 tw-text-gray-600 tw-border tw-border-gray-200 tw-font-medium">Rule Only</span>
                </div>
                <div className="tw-grid tw-grid-cols-1 tw-gap-1.5">
                    {conditions.map((c) => <ConditionCard key={c.id} id={c.id} desc={c.desc} type={c.type as any} />)}
                </div>
            </InfoBlock>

            <InfoBlock title="9 Real-Time Rules (R1–R6)" color={color}>
                <div className="tw-flex tw-flex-col tw-gap-2">
                    {[
                        { id: "R1×2", desc: "Charging State Check — ICP=C2 + USL=CurrentDemand validation ทั้ง 2 connectors" },
                        { id: "R2", desc: "Power Module Derating — >55°C → -3.2A/°C และ -1kW/°C ต่อ degree ที่เกิน" },
                        { id: "R3", desc: "Single Charging Module Check — 1 connector ต้องใช้ 5 power modules" },
                        { id: "R4", desc: "Dual Charging Split — 2 connectors → H1=2 modules, H2=3 modules" },
                        { id: "R5×2", desc: "Under-Delivery Check — actual < 95% of target โดยไม่มี CSMS limit" },
                        { id: "R6×2", desc: "CCS Cable Temp Derating — Phoenix Contact boost mode derating table" },
                    ].map((r) => (
                        <div key={r.id} className="tw-flex tw-gap-3 tw-p-2.5 tw-bg-amber-50 tw-border tw-border-amber-200 tw-rounded-lg">
                            <span className="tw-font-mono tw-text-xs tw-font-bold tw-text-amber-700 tw-flex-shrink-0">{r.id}</span>
                            <span className="tw-text-xs tw-text-amber-800">{r.desc}</span>
                        </div>
                    ))}
                </div>
                <div className="tw-mt-2 tw-text-xs tw-text-gray-500">⚠ Rules R1–R6 ไม่นับรวมใน health score — ใช้สำหรับ real-time alert เท่านั้น</div>
            </InfoBlock>

            <InfoBlock title="Health Score Formula" color={color}>
                <FormulaBlock code={`anomaly_flags = 0  // นับจาก conditions ที่ trigger

// Rule-based flag:
if present_voltage > 0 and present_current == 0: flags += 1
for each PM_temp > 55°C: flags += 1

// AI-based flag:
for each condition where ai_score > 0.5: flags += 1

health = max(0, min(100, 100 - anomaly_flags × 15))`} />
            </InfoBlock>

            <InfoBlock title="CCS Cable Derating Table (Phoenix Contact)" color={color}>
                <div className="tw-overflow-x-auto">
                    <table className="tw-w-full tw-text-xs tw-border-collapse">
                        <thead>
                            <tr className="tw-bg-gray-100">
                                <th className="tw-p-2 tw-text-left tw-font-bold tw-text-gray-600">Temp</th>
                                <th className="tw-p-2 tw-text-center tw-font-bold tw-text-gray-600">Continuous</th>
                                <th className="tw-p-2 tw-text-center tw-font-bold tw-text-gray-600">30 min</th>
                                <th className="tw-p-2 tw-text-center tw-font-bold tw-text-gray-600">10 min</th>
                                <th className="tw-p-2 tw-text-center tw-font-bold tw-text-gray-600">3-5 min</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["25°C", "200A", "250A", "300A", "375A→3min"],
                                ["35°C", "200A", "250A→15min", "300A→5min", "—"],
                                ["45°C", "150A", "200A→10min", "250A→3min", "—"],
                                ["50°C", "125A", "150A→5min", "—", "—"],
                            ].map(([temp, ...vals], i) => (
                                <tr key={i} className="tw-border-b tw-border-gray-100">
                                    <td className="tw-p-2 tw-font-bold tw-text-red-600">{temp}</td>
                                    {vals.map((v, j) => <td key={j} className="tw-p-2 tw-text-center tw-font-mono tw-text-gray-700">{v}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </InfoBlock>

            <div className="tw-bg-amber-50 tw-border tw-border-amber-200 tw-rounded-xl tw-p-3 tw-text-xs tw-text-amber-700">
                ⚖️ <strong>System Health Weight: 20%</strong> — น้ำหนักสูงสุดใน system เพราะ power anomaly กระทบทุก EV ที่ชาร์จอยู่โดยตรง
            </div>
        </>
    );
}

function M5Algorithm({ color }: { color: string }) {
    return (
        <>
            <InfoBlock title="Network Analysis — 6 Device Groups" color={color}>
                <div className="tw-flex tw-flex-col tw-gap-2 tw-mb-4">
                    {[
                        { grp: "Router", aliases: ["router_status", "router_net"] },
                        { grp: "PLC 1", aliases: ["PLC_network_status1", "PLC1_status", "plc_state1"] },
                        { grp: "PLC 2", aliases: ["PLC_network_status2", "PLC2_status", "plc_state2"] },
                        { grp: "Edgebox", aliases: ["edgebox_network_status", "edgebox_status"] },
                        { grp: "Pi5", aliases: ["pi5_network_status", "pi5_status"] },
                        { grp: "Energy Meter", aliases: ["energy_meter_network_status1", "energy_meter_status"] },
                    ].map((d) => (
                        <div key={d.grp} className="tw-flex tw-items-start tw-gap-3 tw-p-2.5 tw-bg-gray-50 tw-rounded-lg tw-border tw-border-gray-100">
                            <span className="tw-text-xs tw-font-bold tw-text-gray-700 tw-w-24 tw-flex-shrink-0">{d.grp}</span>
                            <div className="tw-flex tw-flex-wrap tw-gap-1">
                                {d.aliases.map((a) => (
                                    <span key={a} className="tw-font-mono tw-text-xs tw-px-1.5 tw-py-0.5 tw-bg-blue-50 tw-text-blue-600 tw-rounded tw-border tw-border-blue-200">{a}</span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="tw-text-xs tw-text-gray-500">Multi-alias lookup — API ตรวจสอบทุก field name เพราะ naming convention ต่างกันตาม firmware version</div>
            </InfoBlock>

            <InfoBlock title="Output Structure" color={color}>
                <FormulaBlock code={`{
  "root_cause": "NORMAL",    // or NETWORK_ISSUE, ROUTER_DOWN, etc.
  "severity":   0.12,        // float 0→1 (anomaly severity)
  "online_count": 6,         // devices currently online
  "total_devices": 6         // total devices monitored
}`} />
            </InfoBlock>

            <InfoBlock title="Health Score Formula" color={color}>
                <FormulaBlock code={`// Based on severity score from network analysis:
severity = overall network anomaly score (0→1)
health   = round(max(0, min(100, (1 - severity) × 100)))

// severity = 0.0  → health = 100% (all online, normal)
// severity = 0.5  → health =  50% (significant issues)
// severity = 1.0  → health =   0% (complete network failure)`} />
            </InfoBlock>

            <InfoBlock title="Historical Timeline — Gantt Style" color={color}>
                <div className="tw-flex tw-items-center tw-gap-3 tw-p-3 tw-bg-gray-50 tw-rounded-lg tw-border tw-border-gray-100">
                    <div className="tw-flex tw-items-center tw-gap-2">
                        <div className="tw-w-10 tw-h-4 tw-bg-green-500 tw-rounded" />
                        <span className="tw-text-xs tw-text-gray-600">Active / Connected / Online</span>
                    </div>
                    <div className="tw-flex tw-items-center tw-gap-2">
                        <div className="tw-w-10 tw-h-4 tw-bg-red-500 tw-rounded" />
                        <span className="tw-text-xs tw-text-gray-600">Inactive / Offline</span>
                    </div>
                </div>
                <div className="tw-mt-2 tw-text-xs tw-text-gray-500">
                    Severity group → Chart.js line chart | Device groups → Canvas 2D Gantt timeline
                </div>
            </InfoBlock>

            <div className="tw-bg-blue-50 tw-border tw-border-blue-200 tw-rounded-xl tw-p-3 tw-text-xs tw-text-blue-700">
                ⚖️ <strong>System Health Weight: 12%</strong> — Network issues ส่งผลทางอ้อม (data loss, remote control failure)
            </div>
        </>
    );
}

function M6Algorithm({ color }: { color: string }) {
    return (
        <>
            <InfoBlock title="Temperature-Penalty RUL Model" color={color}>
                <ModelCard id="RUL" name="Temperature-Penalty RUL" type="ML" icon="⏳" color={color}
                    desc="ประมาณ Remaining Useful Life ของแต่ละ component โดยใช้ Arrhenius equation-based temperature penalty — อุณหภูมิสูง = degradation rate เร็วขึ้น exponentially"
                    output="float rul_pct (0→1) + string method + float rated" />
            </InfoBlock>

            <InfoBlock title="Components Monitored (5)" color={color}>
                <div className="tw-flex tw-flex-col tw-gap-2">
                    {[
                        { name: "power_module", rated: "10 years", desc: "Main power conversion — most critical, highest thermal stress" },
                        { name: "charger_body", rated: "15 years", desc: "Structural chassis — slower degradation, corrosion risk" },
                        { name: "cable_connector", rated: "5 years", desc: "Highest replacement frequency — thermal cycling and mechanical wear" },
                        { name: "cooling_fan", rated: "7 years", desc: "Bearing wear + filter clogging reduces airflow efficiency" },
                        { name: "plc_board", rated: "12 years", desc: "Electronic board — moisture and ESD are primary failure modes" },
                    ].map((c) => (
                        <div key={c.name} className="tw-p-3 tw-bg-gray-50 tw-rounded-xl tw-border tw-border-gray-100">
                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-1">
                                <span className="tw-font-mono tw-text-xs tw-font-bold tw-text-gray-700">{c.name}</span>
                                <span className="tw-text-xs tw-px-2 tw-py-0.5 tw-bg-red-50 tw-text-red-600 tw-rounded tw-border tw-border-red-200 tw-font-medium">Rated: {c.rated}</span>
                            </div>
                            <span className="tw-text-xs tw-text-gray-500">{c.desc}</span>
                        </div>
                    ))}
                </div>
            </InfoBlock>

            <InfoBlock title="RUL Calculation Formula" color={color}>
                <FormulaBlock code={`// Per component:
rul_factor = base_rul × temperature_penalty(temp_history)
rul_pct    = rul_factor / rated_lifetime  // 0→1

// Temperature Penalty (Arrhenius):
// penalty = exp(Ea/k × (1/T_rated - 1/T_actual))
// Higher temp → faster degradation → lower rul_pct

// System Health:
health = round(rul_factor × 100)  // backend-computed
// system_health = weighted_min of all components
// weakest_component = argmin(rul_pct)`} />
            </InfoBlock>

            <InfoBlock title="Response Structure" color={color}>
                <FormulaBlock code={`{
  "system_health": 65,
  "avg_health": 68,
  "components": {
    "power_module":    { "rul_pct": 0.58, "method": "temp_penalty", "rated": 87600 },
    "charger_body":    { "rul_pct": 0.72, "method": "temp_penalty", "rated": 131400 },
    "cable_connector": { "rul_pct": 0.61, "method": "temp_penalty", "rated": 43800 },
    "cooling_fan":     { "rul_pct": 0.75, "method": "temp_penalty", "rated": 61320 },
    "plc_board":       { "rul_pct": 0.80, "method": "temp_penalty", "rated": 105120 }
  },
  "weakest_component": "power_module"
}`} />
            </InfoBlock>

            <div className="tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-xl tw-p-3 tw-text-xs tw-text-red-700">
                ⚖️ <strong>System Health Weight: 18%</strong> — ส่งผลโดยตรงต่อ maintenance planning และ asset lifecycle management
            </div>
        </>
    );
}

function M7Algorithm({ color }: { color: string }) {
    const icpStates = [
        { id: 0, name: "Inactive", color: "#6b7280", desc: "ระบบไม่ทำงาน" },
        { id: 1, name: "A1", color: "#94a3b8", desc: "Connector ยังไม่เสียบ (PWM off)" },
        { id: 2, name: "B1", color: "#60a5fa", desc: "Connector เสียบแล้ว (PWM off)" },
        { id: 3, name: "C1", color: "#34d399", desc: "รถพร้อมชาร์จ (PWM off)" },
        { id: 4, name: "D1", color: "#6ee7b7", desc: "รถพร้อม + ต้องการระบายอากาศ" },
        { id: 5, name: "A2", color: "#c084fc", desc: "Connector ยังไม่เสียบ (PWM on)" },
        { id: 6, name: "B2", color: "#38bdf8", desc: "Connector เสียบแล้ว (PWM on)" },
        { id: 7, name: "C2 (Charging)", color: "#22c55e", desc: "กำลังชาร์จอยู่" },
        { id: 8, name: "D2", color: "#4ade80", desc: "ชาร์จ + ระบายอากาศ" },
        { id: 9, name: "E (CP=0V Fault)", color: "#ef4444", desc: "CP voltage = 0V → Fault" },
        { id: 10, name: "Error", color: "#dc2626", desc: "State machine error" },
    ];

    return (
        <>
            <InfoBlock title="EV-PLCC State Machine Analysis" color={color}>
                <ModelCard id="SM" name="State Machine Analyzer" type="Rule" icon="🔍" color={color} desc="ตรวจสอบ ICP state transitions ตาม IEC 61851-1 CP signaling protocol — invalid transitions = anomaly flag" output="bool anomaly + string transition_error + float health_impact" />
                <ModelCard id="PLCC" name="EVPLCC Analyzer" type="AI" icon="🔌" color={color} desc="วิเคราะห์ EV Power Line Communication quality, contractor status, และ ISO 15118 USLink protocol sequence" output="bool communication_ok + string protocol_state + float anomaly_score" />
            </InfoBlock>

            <InfoBlock title="ICP States (11) — IEC 61851-1 CP Signaling" color={color}>
                <div className="tw-grid tw-grid-cols-1 tw-gap-1.5">
                    {icpStates.map((s) => (
                        <div key={s.id} className="tw-flex tw-items-center tw-gap-3 tw-p-2 tw-rounded-lg tw-border tw-border-gray-100">
                            <div className="tw-w-7 tw-h-7 tw-rounded-lg tw-flex tw-items-center tw-justify-center tw-text-white tw-text-xs tw-font-bold tw-flex-shrink-0" style={{ background: s.color }}>{s.id}</div>
                            <div>
                                <span className="tw-font-mono tw-text-xs tw-font-bold tw-text-gray-700">{s.name}</span>
                                <span className="tw-text-xs tw-text-gray-500 tw-ml-2">— {s.desc}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </InfoBlock>

            <InfoBlock title="USLink States (23) — ISO 15118-2 Sequence" color={color}>
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-1.5">
                    {[
                        [0, "Ready"], [1, "Init"], [2, "SLAC ok"], [3, "SECC ok"],
                        [4, "SupportedAppProtocol"], [5, "SessionSetup"], [6, "ServiceDiscovery"],
                        [7, "ServicePaymentSelection"], [8, "ContractAuthentication"],
                        [9, "ChargeParameterDiscovery"], [10, "CableCheck"], [11, "PreCharge"],
                        [12, "PowerDelivery"], [13, "CurrentDemand"], [14, "WeldingDetection"],
                        [15, "SessionStop"], [16, "ProtocolFinished"],
                    ].map(([id, name]) => (
                        <div key={id} className="tw-flex tw-items-center tw-gap-2 tw-p-1.5 tw-rounded tw-bg-gray-50 tw-border tw-border-gray-100">
                            <span className="tw-w-5 tw-h-5 tw-rounded tw-flex tw-items-center tw-justify-center tw-text-white tw-text-xs tw-font-bold tw-flex-shrink-0" style={{ background: color }}>{id}</span>
                            <span className="tw-text-xs tw-text-gray-700">{String(name)}</span>
                        </div>
                    ))}
                </div>
            </InfoBlock>

            <InfoBlock title="Health Score Formula" color={color}>
                <FormulaBlock code={`// Count anomalies from state machine analysis:
anCount = 0
for each model_result in d.model_results:
  if model_result.anomaly == true: anCount += 1

health = round(max(0, min(100, 100 - anCount × 10)))
// Each anomaly detected reduces health by 10%
// 0 anomalies → 100% | 5 anomalies → 50% | 10 anomalies → 0%`} />
            </InfoBlock>

            <InfoBlock title="Timeline — In-Memory Buffer" color={color}>
                <div className="tw-p-3 tw-bg-amber-50 tw-rounded-xl tw-border tw-border-amber-200 tw-text-xs tw-text-amber-700">
                    <div className="tw-font-bold tw-mb-1">⚠ Important: Timeline ไม่ persistent</div>
                    <div>• Buffer สูงสุด 50 entries ต่อ timeline (ICP + USLink = 100 total)</div>
                    <div>• สะสมจาก polling /api/m7/latest ทุก 120 วินาที</div>
                    <div>• ข้อมูลหายทั้งหมดเมื่อ refresh หน้า</div>
                    <div>• แสดงเป็น Canvas 2D Gantt bar chart (ไม่ใช่ Chart.js)</div>
                </div>
            </InfoBlock>

            <div className="tw-bg-pink-50 tw-border tw-border-pink-200 tw-rounded-xl tw-p-3 tw-text-xs tw-text-pink-700">
                ⚖️ <strong>System Health Weight: 10%</strong> — น้ำหนักต่ำสุด เพราะ EV-PLCC issues ส่งผลเฉพาะ high-level communication ไม่กระทบ physical charging
            </div>
        </>
    );
}

// ── Main component ────────────────────────────────────────────────────────
export default function AlgorithmTab({ modNum, modLabel, modColor }: Props) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="tw-flex tw-flex-col tw-gap-0">
            {/* Header */}
            <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-p-5 tw-mb-4">
                <div className="tw-flex tw-items-center tw-gap-3 tw-mb-2">
                    <div className="tw-w-10 tw-h-10 tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-text-white tw-font-bold"
                        style={{ background: modColor }}>M{modNum}</div>
                    <div>
                        <div className="tw-font-bold tw-text-gray-800">{modLabel}</div>
                        <div className="tw-text-xs tw-text-gray-400">Algorithm Description — Version 2.1</div>
                    </div>
                </div>
                <div className="tw-flex tw-gap-2 tw-flex-wrap">
                    {["AI Models", "Health Formula", "Thresholds", "Conditions"].map((tag) => (
                        <span key={tag} className="tw-text-xs tw-px-2 tw-py-0.5 tw-bg-gray-100 tw-text-gray-600 tw-rounded tw-font-medium">{tag}</span>
                    ))}
                </div>
            </div>

            {/* Module-specific content */}
            {modNum === 1 && <M1Algorithm color={modColor} />}
            {modNum === 2 && <M2Algorithm color={modColor} />}
            {modNum === 3 && <M3Algorithm color={modColor} />}
            {modNum === 4 && <M4Algorithm color={modColor} />}
            {modNum === 5 && <M5Algorithm color={modColor} />}
            {modNum === 6 && <M6Algorithm color={modColor} />}
            {modNum === 7 && <M7Algorithm color={modColor} />}

            {!([1, 2, 3, 4, 5, 6, 7].includes(modNum)) && (
                <div className="tw-text-center tw-text-gray-400 tw-py-12 tw-text-sm">
                    ไม่มีข้อมูล Algorithm สำหรับ Module {modNum}
                </div>
            )}
        </div>
    );
}