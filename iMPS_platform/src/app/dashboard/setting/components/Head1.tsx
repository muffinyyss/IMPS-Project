"use client";

import React, { useState } from "react";
import { PlayIcon, StopIcon, ArrowPathIcon } from "@heroicons/react/24/solid"; // ⬅️ ลบ CheckIcon ออก

import Card from "./chargerSetting-card";
import CircleProgress from "./CircleProgress";

/* ---------- Slider (มีสีเติมด้านซ้าย) ---------- */
function LimitRow({
    label, unit, value, onChange, min = 0, max = 200,
}: {
    label: string; unit: string; value: number;
    onChange: (v: number) => void; min?: number; max?: number;
}) {
    const percent = ((value - min) * 100) / (max - min);
    const fillColor = "#ca3333ff";
    const trackColor = "#E5EDF2";
    return (
        <div className="tw-space-y-2">
            <div className="tw-flex tw-items-end tw-justify-between">
                <span className="tw-text-sm tw-text-blue-gray-700">{label}</span>
                <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-900">
                    {value} {unit}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={1}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                style={{
                    background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${percent}%, ${trackColor} ${percent}%, ${trackColor} 100%)`,
                }}
                className={[
                    "tw-w-full tw-appearance-none tw-h-2 tw-rounded-full",
                    "tw-bg-transparent",
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
    | "avaliable"
    | "preparing"
    | "cableCheck"
    | "preCharge"
    | "charging"
    | "finishing"
    | "faulted";

const STATE_META: Record<
    ChargeState,
    { label: string; className: string }
> = {
    avaliable: { label: "Avaliable", className: "tw-text-blue-gray-600" },
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
        <p
            className={`tw-text-sm tw-font-semibold tw-text-center ${meta.className}`}
            aria-live="polite"
        >
            {meta.label}
        </p>
    );
}

/* ---------- ปุ่ม Start/Stop (มีโหมด Try Again) ---------- */
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
    const isAvailable = status === "avaliable";

    const isDisabled =
        !!busy ||
        isFinishing ||
        isAvailable ||
        !(isCharging || isPreparing || isFaulted);

    const label = isCharging ? "Stop Charging" : isFaulted ? "Try Again" : "Start Charging";

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

/* ---------- การ์ดหัวชาร์จ ---------- */
function HeadRow({
    title, status, busy, onStart, onStop,
}: {
    title: string;
    status: ChargeState;
    busy?: boolean;
    onStart: () => void;
    onStop: () => void;
}) {
    const charging = status === "charging";

    return (
        <div
            className={`tw-overflow-hidden tw-rounded-xl tw-border tw-bg-white tw-shadow-sm ${charging ? "tw-border-green-200" : "tw-border-blue-gray-100"
                }`}
        >
            <div className="tw-p-4 md:tw-p-5 tw-space-y-4">
                <div className="tw-font-semibold tw-text-blue-gray-900">{title}</div>

                <CircleProgress label="SoC :" value={43} />

                <StateText status={status} />

                <div className="tw-pt-1">
                    <PrimaryCTA
                        status={status}
                        busy={!!busy}
                        onStart={onStart}
                        onStop={onStop}
                    />
                    <p className="tw-mt-2 tw-text-center tw-text-xs tw-text-blue-gray-500">
                        {charging ? "Vehicle is charging" : "Vehicle is idle"}
                    </p>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------ Main: Head1 ------------------------------- */
export default function Head1() {
    const [maxCurrentH1, setMaxCurrentH1] = useState(66);
    const [maxPowerH1, setMaxPowerH1] = useState(136);
    const [h1Status, setH1Status] = useState<ChargeState>("avaliable");
    const [busyH1, setBusyH1] = useState(false);

    // baseline สำหรับเช็คว่ามีการเปลี่ยนแปลงหรือไม่
    const [lastSaved, setLastSaved] = useState({ maxCurrentH1: 66, maxPowerH1: 136 });
    const isDirty =
        maxCurrentH1 !== lastSaved.maxCurrentH1 || maxPowerH1 !== lastSaved.maxPowerH1;

    // ไม่ใช่การ "บันทึก" — แค่ยืนยัน/ใช้ค่าปัจจุบัน
    function applySettings() {
        console.log("apply settings:", { maxCurrentH1, maxPowerH1 });
        // ถ้าต้องการให้ปุ่ม “ตกลง” กลับไปเป็น disable หลังยืนยัน:
        setLastSaved({ maxCurrentH1, maxPowerH1 });
    }

    async function chargeCommand(action: "start" | "stop") {
        // await fetch(`/api/charger/1/${action}`, { method: "POST" });
    }

    const startH1 = async () => {
        try {
            setBusyH1(true);
            if (h1Status !== "preparing") return;
            await chargeCommand("start");
            setH1Status("cableCheck");
            setH1Status("preCharge");
            setH1Status("charging");
        } catch (e) {
            setH1Status("faulted");
        } finally {
            setBusyH1(false);
        }
    };

    const stopH1 = async () => {
        try {
            setBusyH1(true);
            setH1Status("finishing");
            await chargeCommand("stop");
            setH1Status("avaliable");
        } catch (e) {
            setH1Status("faulted");
        } finally {
            setBusyH1(false);
        }
    };

    return (
        <Card title="Head1">
            <div className="tw-space-y-8">

                {/* -------- โซนสไลเดอร์ + ปุ่ม “ตกลง” ขวาล่าง -------- */}
                <div className="tw-space-y-6">
                    <LimitRow
                        label="Dynamic Max Current H1"
                        unit="A"
                        value={maxCurrentH1}
                        onChange={setMaxCurrentH1}
                    />
                    <LimitRow
                        label="Dynamic Max Power H1"
                        unit="kW"
                        value={maxPowerH1}
                        onChange={setMaxPowerH1}
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
                            submit
                        </button>
                    </div>
                </div>

                {/* -------- การ์ดสถานะหัวชาร์จ -------- */}
                <HeadRow
                    title="Charger Head 1"
                    status={h1Status}
                    busy={busyH1}
                    onStart={startH1}
                    onStop={stopH1}
                />
            </div>
        </Card>
    );
}
