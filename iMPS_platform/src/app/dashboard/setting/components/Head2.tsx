
"use client";

// import React, { useState } from "react";
// import { PlayIcon, StopIcon, ArrowPathIcon } from "@heroicons/react/24/solid"; // ⬅️ ลบ CheckIcon ออก
import React, { useEffect, useMemo, useState } from "react";
import { PlayIcon, StopIcon, ArrowPathIcon, CheckIcon } from "@heroicons/react/24/solid";
import { useSearchParams } from "next/navigation";

import Card from "./chargerSetting-card";
import CircleProgress from "./CircleProgress";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

function LimitRow({
    label, unit, value, onChange, min = 0, max = 200, disabled = false,
}: {
    label: string; unit: string; value: number;
    onChange: (v: number) => void; min?: number; max?: number;
    disabled?: boolean;
}) {
    // กันหารศูนย์เวลา max==min
    const span = Math.max(1, max - min);
    const percent = Math.max(0, Math.min(100, ((value - min) * 100) / span));

    const fillColor = "#ca3333ff";
    const trackColor = "#E5EDF2";

    // ถ้า disabled ให้ log เมื่อผู้ใช้พยายามจะลาก
    const onBlockAttempt = () => {
        if (disabled) {
            console.log(`[LimitRow] "${label}" blocked: slider is disabled.`);
        }
    };

    return (
        <div className="tw-space-y-2">
            <div className="tw-flex tw-items-end tw-justify-between">
                <span className="tw-text-sm tw-text-blue-gray-700">{label}</span>
                <span className={`tw-text-sm tw-font-semibold tw-text-blue-gray-900 ${disabled ? "tw-opacity-60" : ""}`}>
                    {value} {unit}
                </span>
            </div>

            <input
                type="range"
                min={min}
                max={max}
                step={1}
                value={value}
                disabled={disabled}
                onChange={(e) => {
                    // ถ้าไม่ disabled ค่อยยอมให้เปลี่ยน และ log
                    if (!disabled) {
                        const v = Number(e.target.value);
                        console.log(`[LimitRow] "${label}" changed →`, v, unit);
                        onChange(v);
                    }
                }}
                onMouseDown={onBlockAttempt}
                onTouchStart={onBlockAttempt}
                style={{
                    background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${percent}%, ${trackColor} ${percent}%, ${trackColor} 100%)`,
                    cursor: disabled ? "not-allowed" : "pointer",
                }}
                className={[
                    "tw-w-full tw-appearance-none tw-h-2 tw-rounded-full",
                    "tw-bg-transparent",
                    disabled ? "tw-opacity-60" : "",
                    "tw-[&::-webkit-slider-thumb]:appearance-none",
                    "tw-[&::-webkit-slider-thumb]:h-4 tw-[&::-webkit-slider-thumb]:w-4",
                    "tw-[&::-webkit-slider-thumb]:rounded-full tw-[&::-webkit-slider-thumb]:bg-white",
                    "tw-[&::-webkit-slider-thumb]:shadow tw-[&::-webkit-slider-thumb]:ring-1 tw-[&::-webkit-slider-thumb]:ring-black/10",
                    "tw-[&::-moz-range-thumb]:h-4 tw-[&::-moz-range-thumb]:w-4",
                    "tw-[&::-moz-range-thumb]:rounded-full tw-[&::-moz-range-thumb]:bg-white",
                    "tw-[&::-moz-range-thumb]:border tw-[&::-moz-range-thumb]:border-blue-gray-200",
                ].join(" ")}
            />
        </div>
    );
}

/* ---------- ข้อความบอกสถานะ (รองรับ 7 state) ---------- */
type ChargeState =
    | "available"
    | "preparing"
    | "cableCheck"
    | "preCharge"
    | "charging"
    | "finishing"
    | "faulted";

type PLCSetting = {
    station_id: string;
    dynamic_max_current2: number; // A
    dynamic_max_power2: number;   // kW
    cp_status2: "start" | "stop";          // 1 = start, 0 = stop
};


const STATE_META: Record<ChargeState, { label: string; className: string }> = {
    available: { label: "Avaliable", className: "tw-text-blue-gray-600" },
    preparing: { label: "Preparing", className: "tw-text-blue-600" },
    cableCheck: { label: "Cable Check", className: "tw-text-amber-600" },
    preCharge: { label: "Precharge", className: "tw-text-amber-600" },
    charging: { label: "Charging..", className: "tw-text-green-600" },
    finishing: { label: "Finishing…", className: "tw-text-amber-600" },
    faulted: { label: "Faulted", className: "tw-text-red-600" },
};

function StateText({ status }: { status: ChargeState }) {
    const meta = STATE_META[status];
    return (
        <p className={`tw-text-sm tw-font-semibold tw-text-center ${meta.className}`} aria-live="polite">
            {meta.label}
        </p>
    );
}

/* ---------- ปุ่ม Start/Stop (มีโหมด Try Again) ---------- */
/* ---------- ปุ่ม Start/Stop ---------- */
function PrimaryCTA({
    status, busy, onStart, onStop,
}: {
    status: ChargeState;
    busy?: boolean;
    onStart: () => void;
    onStop: () => void;
}) {
    const isCharging = status === "charging";
    const isPreparing = status === "preparing";
    const isFinishing = status === "finishing";
    const isFaulted = status === "faulted";
    const isAvailable = status === "available";

    const isDisabled =
        !!busy || isFinishing || isAvailable || !(isCharging || isPreparing || isFaulted);

    const label = isCharging ? "Stop Charging" : isFaulted ? "Try Again" : "Start Charging";
    // const label = isFinishing
    //     ? "Done"
    //     : isCharging
    //         ? "Stop Charging"
    //         : isFaulted
    //             ? "Try Again"
    //             : "Start Charging";

    const Icon = busy
        ? ArrowPathIcon
        : isCharging
            ? StopIcon
            : PlayIcon;

    const color = isCharging || isFaulted
        ? "tw-bg-red-500 hover:tw-bg-red-600 focus-visible:tw-ring-red-300"
        : isFinishing
            ? "tw-bg-green-500"
            : "tw-bg-green-500 hover:tw-bg-green-600 focus-visible:tw-ring-green-300";

    const base =
        "tw-inline-flex tw-items-center tw-justify-center tw-gap-2 tw-rounded-lg tw-h-12 tw-px-5 tw-text-sm tw-font-semibold tw-text-white tw-shadow-sm focus-visible:tw-ring-2 tw-transition tw-w-full";

    return (
        <button
            type="button"
            disabled={isDisabled}
            onClick={isCharging ? onStop : onStart}
            className={`${base} ${color} ${isDisabled ? "tw-opacity-60 tw-cursor-not-allowed" : ""}`}
            title={label}
            aria-label={label}
        >
            <Icon className={`tw-w-5 tw-h-5 ${busy ? "tw-animate-spin" : ""}`} />
            <span>{label}</span>
        </button>
    );
}

/* ---------- Utils / Mapping ---------- */
const toNum = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};

// จาก CP_status1 (1–7) → ChargeState (เดา mapping ทั่วไป; ปรับตามโปรโตคอลจริงได้)
const statusFromCP = (cp: any): ChargeState => {
    const c = String(cp ?? "");
    switch (c) {
        case "1": return "available";  // idle / available
        case "2": return "preparing";  // preparing
        case "3": return "cableCheck"; // cable check
        case "4": return "preCharge";  // precharge
        case "7": return "charging";   // charging
        case "6": return "finishing";  // finishing
        case "5": return "faulted";    // fault
        default: return "available";
    }
};

/* ---------- การ์ดหัวชาร์จ ---------- */
function HeadRow({
    title, status, busy, soc, onStart, onStop,
}: {
    title: string;
    status: ChargeState;
    busy?: boolean;
    soc?: number | null;
    onStart: () => void;
    onStop: () => void;
}) {
    const charging = status === "charging";
    const socVal = soc ?? 0;

    return (
        <div className={`tw-overflow-hidden tw-rounded-xl tw-border tw-bg-white tw-shadow-sm ${charging ? "tw-border-green-200" : "tw-border-blue-gray-100"}`}>
            <div className="tw-p-4 md:tw-p-5 tw-space-y-4">
                <div className="tw-font-semibold tw-text-blue-gray-900">{title}</div>

                <CircleProgress label="SoC :" value={socVal} />

                <StateText status={status} />

                <div className="tw-pt-1">
                    <PrimaryCTA
                        status={status}
                        busy={!!busy}
                        onStart={onStart}
                        onStop={onStop}
                    />
                    {/* <PrimaryCTA status={status} busy={!!busy} onStart={onStart} onStop={onStop} /> */}
                    <p className="tw-mt-2 tw-text-center tw-text-xs tw-text-blue-gray-500">
                        {charging ? "Vehicle is charging" : "Vehicle is idle"}
                    </p>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------ Main: Head1 ------------------------------- */
type SettingDoc = {
    _id: string;
    timestamp?: string;
    CP_status2?: string | number;
    SOC2?: string | number | null;
    dynamic_max_current2?: string | number; // A
    dynamic_max_power2?: string | number;   // W (backend), จอแสดง kW
    present_current2?: string | number;
    present_power2?: string | number;
    // ฟิลด์อื่น ๆ ที่อาจใช้อีกก็เพิ่มได้
    [key: string]: any;
};

export default function Head1() {
    const searchParams = useSearchParams();
    const [stationId, setStationId] = useState<string | null>(null);

    const [data, setData] = useState<SettingDoc | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [saving, setSaving] = useState(false);
    // ค่า UI (เริ่มจาก default; จะ sync จาก data เมื่อมีสตรีม)
    const [maxCurrentH2, setMaxCurrentH2] = useState(0); // A
    const [maxPowerH2, setMaxPowerH2] = useState(0);    // kW (UI)
    const [h2Status, setH2Status] = useState<ChargeState>("available");
    const [busyH2, setBusyH2] = useState(false);

    const [cpCmd2, setCpCmd2] = useState<"start" | "stop" | null>(null);

    const cpStatus2FromCmd = (cmd: "start" | "stop" | null): "start" | "stop" | null => {
        if (cmd === "start") return "start";
        if (cmd === "stop") return "stop";
        return null;
    };

    // baseline สำหรับเช็คว่ามีการเปลี่ยนแปลงหรือไม่
    const [lastSaved, setLastSaved] = useState({ maxCurrentH2: 66, maxPowerH2: 136 });
    const isDirty =
        maxCurrentH2 !== lastSaved.maxCurrentH2 || maxPowerH2 !== lastSaved.maxPowerH2;

    // ไม่ใช่การ "บันทึก" — แค่ยืนยัน/ใช้ค่าปัจจุบัน
    // function applySettings() {
    //     console.log("apply settings:", { maxCurrentH2, maxPowerH2 });
    //     // ถ้าต้องการให้ปุ่ม “ตกลง” กลับไปเป็น disable หลังยืนยัน:
    //     setLastSaved({ maxCurrentH2, maxPowerH2 });
    // }
    async function applySettings() {
        if (!stationId) { console.warn("[Head1] no station_id"); return; }
        setSaving(true);
        setErr(null);
        try {
            // 1) ส่ง MAX
            const bodyMAX = {
                station_id: stationId,
                dynamic_max_current2: maxCurrentH2, // A
                dynamic_max_power2: maxPowerH2,     // kW (ต้องตรงกับ backend)
            };

            const resMAX = await fetch(`${API_BASE}/setting/PLC/MAXH2`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(bodyMAX),
            });

            if (!resMAX.ok) {
                const t = await resMAX.text().catch(() => "");
                throw new Error(`MAX failed: ${resMAX.status} ${t}`);
            }

            // อัปเดต baseline เฉพาะ MAX
            setLastSaved({ maxCurrentH2, maxPowerH2 });

            // 2) (ออปชัน) ส่ง CP ถ้ามีคำสั่งค้างอยู่เท่านั้น
            if (cpCmd2) {
                const bodyCP = { station_id: stationId, cp_status2: cpCmd2 }; // "start" | "stop"
                const resCP = await fetch(`${API_BASE}/setting/PLC/CPH2`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(bodyCP),
                });
                if (!resCP.ok) {
                    const t = await resCP.text().catch(() => "");
                    throw new Error(`CP failed: ${resCP.status} ${t}`);
                }
                // ส่งสำเร็จแล้วเคลียร์คำสั่ง
                setCpCmd2(null);
            }

            console.log("[Head2] submit success");
        } catch (e: any) {
            console.error(e);
            setErr(e?.message || "บันทึกการตั้งค่าไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    }
    // ด้านบนใน component Head1 (หลัง state/data พร้อมแล้ว)
    const maxForPowerSlider = useMemo(() => {
        const n = toNum(data?.dynamic_max_current1); // ← เอาจาก dynamic_max_current1
        return n !== null ? Math.max(0, Math.round(n)) : 600; // fallback 600
    }, [data?.dynamic_max_current1]);

    // เพิ่มตัวช่วยอ่าน present_current1
    const presentCurrent2 = useMemo(() => {
        return toNum(data?.present_current2); // เช่น 56.0 จาก payload
    }, [data?.present_current2]);

    // คำนวณ max ของสไลเดอร์กระแสจาก present_current2 (fallback 500)
    const maxCurrentSlider = useMemo(() => {
        const n = presentCurrent2;
        return n !== null ? Math.max(1, Math.round(n)) : 500;
    }, [presentCurrent2]);

    // (อ๊อปชัน) บังคับค่าปัจจุบันของสไลเดอร์ไม่ให้เกิน max เมื่อ max เปลี่ยน
    useEffect(() => {
        setMaxCurrentH2((v) => Math.min(v, maxCurrentSlider));
    }, [maxCurrentSlider]);

    // ==== ใต้ presentCurrent1 / maxCurrentSlider ====
    const presentPowerW2 = useMemo(() => {
        // ลองใช้ค่าจากสตรีมก่อน (หน่วย W)
        const p = toNum(data?.present_power2);
        if (p !== null) return p;

        // ถ้าไม่มี present_power1 ให้คำนวณจาก V × I (DC)
        const v = toNum((data as any)?.measured_voltage2);
        const i = toNum(data?.present_current2);
        if (v !== null && i !== null) return v * i;

        return null;
    }, [data?.present_power2, (data as any)?.measured_voltage2, data?.present_current2]);

    // max ของสไลเดอร์ Power (หน่วย kW บน UI)
    const maxPowerSlider = useMemo(() => {
        if (presentPowerW2 === null) return 500; // fallback เดิม 500 kW
        return Math.max(1, Math.round(presentPowerW2 / 1000)); // W → kW
    }, [presentPowerW2]);

    // บังคับค่า power ปัจจุบันไม่ให้เกิน max เมื่อ max เปลี่ยน
    useEffect(() => {
        setMaxPowerH2((v) => Math.min(v, maxPowerSlider));
    }, [maxPowerSlider]);

    // station_id จาก URL → localStorage
    useEffect(() => {
        const sidFromUrl = searchParams.get("station_id");
        if (sidFromUrl) {
            setStationId(sidFromUrl);
            localStorage.setItem("selected_station_id", sidFromUrl);
            return;
        }
        const sidLocal = localStorage.getItem("selected_station_id");
        setStationId(sidLocal);
    }, [searchParams]);

    // useEffect(() => {
    //     if (!stationId) {
    //         console.log("[Head1] no station_id → SSE will not start, sliders locked.");
    //     } else {
    //         console.log("[Head1] station_id =", stationId);
    //     }
    // }, [stationId]);

    // เปิด SSE ไปที่ /setting
    useEffect(() => {
        if (!stationId) return;
        setLoading(true);
        setErr(null);

        const es = new EventSource(
            `${API_BASE}/setting?station_id=${encodeURIComponent(stationId)}`,
            { withCredentials: true }
        );

        const onInit = (e: MessageEvent) => {
            try {
                const obj = JSON.parse(e.data);
                setData(obj);
                setLoading(false);
            } catch {
                setErr("ผิดรูปแบบข้อมูล init");
                setLoading(false);
            }
        };

        es.addEventListener("init", onInit);

        es.onmessage = (e) => {
            try {
                const obj = JSON.parse(e.data);
                setData(obj);
            } catch {
                // เงียบไว้ก็ได้
            }
        };

        es.onerror = () => {
            setErr("SSE หลุดการเชื่อมต่อ (กำลังพยายามเชื่อมใหม่อัตโนมัติ)");
            setLoading(false);
        };

        return () => {
            es.removeEventListener("init", onInit);
            es.close();
        };
    }, [stationId]);

   

    // เมื่อ data อัปเดต → sync เข้าสู่ state UI
    useEffect(() => {
        if (!data) return;

        // map CP_status1 → UI state
        setH2Status(statusFromCP(data.CP_status2));

        // dynamic_max_current1 (A)
        const curA = toNum(data.dynamic_max_current2);
        if (curA !== null) {
            setMaxCurrentH2(Math.round(curA));
        }

        // dynamic_max_power1 (backend ส่ง W) → UI แสดง kW
        const powW = toNum(data.dynamic_max_power2);
        if (powW !== null) {
            const kw = powW / 1000;
            setMaxPowerH2(Math.round(kw));
        }
    }, [data]);

    // SoC (ถ้ามาเป็น string ก็แปลงเป็น number; ถ้า null → 0)
    const soc2: number | null = useMemo(() => {
        const n = toNum(data?.SOC2);
        if (n === null) return 0;
        // จำกัดช่วง 0–100 เผื่อค่าสะดุ้ง
        return Math.max(0, Math.min(100, n));
    }, [data]);

    async function sendCpCommand(action: "start" | "stop") {
        if (!stationId) throw new Error("no station_id");
        const body = { station_id: stationId, cp_status2: action };
        const res = await fetch(`${API_BASE}/setting/PLC/CPH2`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const t = await res.text().catch(() => "");
            throw new Error(`CP ${action} failed: ${res.status} ${t}`);
        }
        return res.json();
    }

    const startH2 = async () => {
        try {
            setBusyH2(true);
            setCpCmd2("start");
            // ถ้าต้องการให้กด Start ได้เฉพาะตอน 'preparing' คง logic เดิมไว้
            // หรือถ้าจะให้ start ได้ตอน 'available' ด้วย เปลี่ยนเป็น:
            // if (!(h2Status === "preparing" || h2Status === "available")) return;

            if (h2Status !== "preparing") return;
            await sendCpCommand("start");
            // สถานะจริงปล่อยให้สตรีมอัปเดต
        } catch (e) {
            console.error(e);
            setH2Status("faulted");
        } finally {
            setBusyH2(false);
        }
    };

    const stopH2 = async () => {
        try {
            setBusyH2(true);
            setCpCmd2("stop");
            await sendCpCommand("stop");
        } catch (e) {
            console.error(e);
            setH2Status("faulted");
        } finally {
            setBusyH2(false);
        }
    };

    const hasStation = !!stationId;
    const hasData = !!data;
    const dynMaxCurrent2 = toNum(data?.dynamic_max_current2); // อาจเป็น null

    // สไลเดอร์ Current: “เลื่อนไม่ได้” ถ้ายังไม่มี station หรือไม่มี data
    const disableCurrent = !(hasStation && hasData);

    // สไลเดอร์ Power: “เลื่อนไม่ได้” ถ้ายังไม่มี station หรือไม่มี data หรือไม่มี dynMaxCurrent1 จริง
    const disablePower = !(hasStation && hasData && dynMaxCurrent2 !== null);

    // log สถานะล็อกฝั่ง UI
    useEffect(() => {
        console.log(`[Head1] slider lock states → Current: ${disableCurrent}, Power: ${disablePower} (dynMaxCurrent1=${dynMaxCurrent2})`);
    }, [disableCurrent, disablePower, dynMaxCurrent2]);

    const lastUpdated = data?.timestamp ? new Date(data.timestamp).toLocaleString("th-TH") : null;
    return (
        <Card
            // title="Head1"
            title={
                <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <span>Head2</span>
                    {lastUpdated && (
                        <span className="tw-text-xs !tw-text-blue-gray-500">
                            อัปเดตล่าสุด: {lastUpdated}
                        </span>
                    )}
                </div>
            }
        >


            {(loading || err) && (
                <div className="tw-px-3 tw-py-2">
                    {loading && <div className="tw-text-sm tw-text-blue-gray-600">กำลังโหลด...</div>}
                    {err && <div className="tw-text-sm tw-text-red-600">{err}</div>}
                </div>
            )}

            {/* {data?.timestamp && (
                <div className="tw-px-3 tw-py-2 tw-text-xs tw-text-blue-gray-500">
                    อัปเดตล่าสุด: {new Date(data.timestamp).toLocaleString("th-TH")}
                </div>
            )} */}

            <div className="tw-space-y-8">

                {/* -------- โซนสไลเดอร์ + ปุ่ม “ตกลง” ขวาล่าง -------- */}
                <div className="tw-space-y-6">
                    {/* แสดงค่าจริงจากสตรีม (อ่านอย่างเดียว ณ ตอนนี้) */}
                    <LimitRow
                        label="Dynamic Max Current H2"
                        unit="A"
                        value={maxCurrentH2}
                        onChange={setMaxCurrentH2}
                        min={0}
                        max={maxCurrentSlider}
                        disabled={disableCurrent}
                    />
                    <LimitRow
                        label="Dynamic Max Power H2"
                        unit="kW"
                        value={maxPowerH2}
                        onChange={setMaxPowerH2}
                        min={0}
                        max={maxPowerSlider}
                        disabled={disablePower}
                    />

                    {/* ปุ่ม “ตกลง” — ชิดขวาล่าง, สีดำ, ไม่มีไอคอน */}
                    <div className="tw-flex tw-justify-end">
                        <button
                            type="button"
                            onClick={applySettings}
                            disabled={!isDirty}
                            className={[
                                "tw-inline-flex tw-items-center tw-justify-center",
                                "tw-rounded-lg tw-h-11 tw-px-5 tw-text-sm tw-font-semibold",
                                "tw-text-white tw-bg-black hover:tw-bg-black/90 focus-visible:tw-ring-2 focus-visible:tw-ring-black/30",
                                "tw-shadow-sm tw-transition",
                                !isDirty ? "tw-opacity-60 tw-cursor-not-allowed" : "",
                            ].join(" ")}
                            aria-label="submit"
                            title="submit"
                        >
                            {/* submit */}
                            {saving ? "send..." : "submit"}
                        </button>
                    </div>

                    {/* /> */}
                </div>

                {/* -------- การ์ดสถานะหัวชาร์จ -------- */}
                <HeadRow
                    title="Charger Head 2"
                    status={h2Status}
                    busy={busyH2}
                    soc={soc2 ?? 0}
                    onStart={startH2}
                    onStop={stopH2}
                />
            </div>
        </Card>
    );
}
