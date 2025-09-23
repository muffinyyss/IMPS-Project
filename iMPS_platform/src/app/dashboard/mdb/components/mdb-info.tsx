"use client";

import React from "react";
import { Typography, Chip, Tooltip, Card, CardBody } from "@/components/MaterialTailwind";
import {
    BoltIcon,
    PowerIcon,
    BoltSlashIcon,
    SignalIcon,
    SunIcon,
} from "@heroicons/react/24/solid";
import { CpuChipIcon } from "@heroicons/react/24/outline";

/** ===== Props ===== */
export type MDBType = {
    tempc: number | string;
    humidity: number | string;
    fanOn: boolean;
    rssiDb: number | string;
    // signalLevel?: 0 | 1 | 2 | 3 | 4;
    I1: number | string;
    I2: number | string;
    I3: number | string;
    totalCurrentA: number | string;
    powerKW: number | string;
    totalEnergyKWh: number | string;
    frequencyHz: number | string;
    pfL1: number | string;
    pfL2: number | string;
    pfL3: number | string;
    PL1N: number | string;
    PL2N: number | string;
    PL3N: number | string;
    PL123N: number | string;
    EL1: number | string;
    EL2: number | string;
    EL3: number | string;
    EL123: number | string;
    VL1N: number | string;
    VL2N: number | string;
    VL3N: number | string;
    VL1L2: number | string;
    VL2L3: number | string;
    VL1L3: number | string;
    thdvL1: number | string;
    thdvL2: number | string;
    thdvL3: number | string;
    thdiL1: number | string;
    thdiL2: number | string;
    thdiL3: number | string;
    className?: string;
    mainBreakerStatus: boolean;
    breakChargerStatus: boolean;
};

/** ===== Component ===== */
export default function MDBInfo({
    tempc,
    humidity,
    fanOn,
    rssiDb = "-",
    // signalLevel = 3,
    I1,
    I2,
    I3,
    totalCurrentA,
    powerKW,
    totalEnergyKWh,
    frequencyHz,
    pfL1,
    pfL2,
    pfL3,
    PL1N,
    PL2N,
    PL3N,
    PL123N,
    EL1,
    EL2,
    EL3,
    EL123,
    VL1N,
    VL2N,
    VL3N,
    VL1L2,
    VL2L3,
    VL1L3,
    thdvL1,
    thdvL2,
    thdvL3,
    thdiL1,
    thdiL2,
    thdiL3,
    className = "",
    mainBreakerStatus,
    breakChargerStatus
}: MDBType) {
    return (
        <div className={`tw-w-full tw-space-y-6 ${className}`}>
            {/* ===== Top quick stats ===== */}
            {/* Power Block Section */}
            {/* <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 md:tw-gap-6"> */}
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-[minmax(0,1fr)_250px] md:tw-gap-6">
                <div className="tw-space-y-3 tw-w-full">
                    <MetricRow
                        icon={
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="icon icon-tabler icon-tabler-wave-saw-tool tw-text-yellow-600"
                                width="25"
                                height="25"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                fill="none"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                id="IconChangeColor"
                            >
                                <path d="M0 0h24v24H0z" fill="none" stroke="none"></path>
                                <path d="M3 12h5l4 8v-16l4 8h5"></path>
                            </svg>
                        }
                        label="Total Current"
                        value={totalCurrentA}
                        unit="A"
                    />
                    <MetricRow
                        icon={<i className="fa-solid fa-bolt tw-text-yellow-600 tw-h-5 tw-w-5"></i>}
                        label="Power Energy" value={powerKW}
                        unit="kW" />
                    <MetricRow
                        icon={<i className="fas fa-gas-pump tw-text-yellow-600 tw-h-5 tw-w-5"></i>}
                        label="Total Energy"
                        value={totalEnergyKWh}
                        unit="kWh" />
                    <MetricRow
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-waveform tw-text-yellow-600" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M3 12h18m-6 0l-3 5l-3 -10l-3 5" />
                            </svg>
                        }
                        label="Frequency"
                        value={frequencyHz}
                        unit="Hz" />
                </div>

                {/* Status Cards */}
                <div className="tw-grid tw-grid-cols-1 md:tw-max-w-[250px] tw-gap-10 ">
                    <div className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-p-5 tw-shadow-sm tw-space-y-5">

                        {/* Mainbreaker */}
                        <div className="tw-flex tw-items-center tw-gap-3 tw-mt-3">
                            <div className="tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-xl tw-bg-gray-100">
                                {/* <BoltIcon className="tw-h-6 tw-w-6 tw-text-gray-700" /> */}
                                <PowerIcon className="tw-h-6 tw-w-6 tw-text-gray-700" />
                            </div>
                            <div className="tw-flex tw-flex-col">
                                <Typography variant="small" color="blue-gray" className="tw-font-medium">
                                    Main Breaker
                                </Typography>
                                <Typography
                                    variant="small"
                                    className={`tw-font-semibold ${mainBreakerStatus ? "!tw-text-green-500" : "!tw-text-red-500"}`}>
                                    Status: {mainBreakerStatus ? "ON" : "OFF"}
                                </Typography>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="tw-border-t tw-border-blue-gray-100 tw-my-4" />

                        {/* Break Charger */}
                        <div className="tw-flex tw-items-center tw-gap-3 tw-mt-6">
                            <div className="tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-xl tw-bg-gray-100">
                                <PowerIcon className="tw-h-6 tw-w-6 tw-text-gray-700" />
                            </div>
                            <div className="tw-flex tw-flex-col">
                                <Typography variant="small" color="blue-gray" className="tw-font-medium">
                                    Break Charger
                                </Typography>
                                <Typography
                                    variant="small"
                                    className={`tw-font-semibold ${breakChargerStatus ? "!tw-text-green-500" : "!tw-text-red-500"}`}>
                                    Status: {breakChargerStatus ? "ON" : "OFF"}
                                </Typography>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Status Cards */}

            </div>

            {/* Quality Section */}
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4">
                {/* PF */}
                <div className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
                    <Typography variant="small" color="blue-gray" className="tw-mb-2 tw-font-medium">
                        Power Factor
                    </Typography>
                    <div className="tw-space-y-1">
                        <Row label="pf–L1" value={Number(pfL1)} />
                        <Row label="pf–L2" value={Number(pfL2)} />
                        <Row label="pf–L3" value={Number(pfL3)} />
                    </div>
                </div>

                {/* PLN */}
                <div className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
                    <Typography variant="small" color="blue-gray" className="tw-mb-2 tw-font-medium">
                        PLN (W)
                    </Typography>
                    <div className="tw-space-y-1">
                        <Row label="PL1N" value={PL1N} />
                        <Row label="PL2N" value={PL2N} />
                        <Row label="PL3N" value={PL3N} />
                        <Row label="PL123N" value={PL123N} />
                    </div>
                </div>

                {/* EL */}
                <div className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
                    <Typography variant="small" color="blue-gray" className="tw-mb-2 tw-font-medium">
                        EL (kWh)
                    </Typography>
                    <div className="tw-space-y-1">
                        <Row label="EL1" value={EL1} />
                        <Row label="EL2" value={EL2} />
                        <Row label="EL3" value={EL3} />
                        <Row label="EL123" value={EL123} />

                    </div>
                </div>

                {/* VL */}
                <div className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
                    <Typography variant="small" color="blue-gray" className="tw-mb-2 tw-font-medium">
                        Line-to-Line Voltage (V)
                    </Typography>
                    <div className="tw-space-y-1">
                        <Row label="VL1L2" value={VL1L2} />
                        <Row label="VL2L3" value={VL2L3} />
                        <Row label="VL1L3" value={VL1L3} />
                    </div>
                </div>

                {/* THDV */}
                <div className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
                    <Typography variant="small" color="blue-gray" className="tw-mb-2 tw-font-medium">
                        THDV (%)
                    </Typography>
                    <div className="tw-space-y-1">
                        <Row label="L1" value={thdvL1} />
                        <Row label="L2" value={thdvL2} />
                        <Row label="L3" value={thdvL3} />
                    </div>
                </div>

                {/* THDI */}
                <div className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
                    <Typography variant="small" color="blue-gray" className="tw-mb-2 tw-font-medium">
                        THDI (%)
                    </Typography>
                    <div className="tw-space-y-1">
                        <Row label="L1" value={thdiL1} />
                        <Row label="L2" value={thdiL2} />
                        <Row label="L3" value={thdiL3} />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ================= sub components ================= */

function QuickStat({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="tw-flex tw-items-center tw-gap-3 tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-px-3 tw-py-2">
            <div className="tw-shrink-0">{icon}</div>
            <Typography variant="small" color="blue-gray" className="tw-opacity-70">
                {label}
            </Typography>
            <div className="tw-ml-auto">{value}</div>
        </div>
    );
}

function Divider() {
    return <div className="tw-h-px tw-bg-blue-gray-50" />;
}

function MetricRow({
    icon,
    label,
    value,
    unit,
}: {
    icon?: React.ReactNode;
    label: string;
    value: React.ReactNode;
    unit?: string;
}) {
    return (
        <div className="tw-flex tw-items-center tw-gap-3 tw-rounded-md tw-border tw-border-blue-gray-50 tw-bg-white tw-px-3 tw-py-2">
            {icon ? <div>{icon}</div> : null}
            <Typography variant="small" color="blue-gray" className="tw-opacity-80">
                {label}
            </Typography>
            <div className="tw-ml-auto tw-flex tw-items-baseline tw-gap-1">
                <Typography color="blue-gray" className="tw-font-semibold">
                    {value}
                </Typography>
                {unit ? (
                    <Typography variant="small" color="blue-gray" className="tw-opacity-70">
                        {unit}
                    </Typography>
                ) : null}
            </div>
        </div>
    );
}

function MiniRow({
    left,
    mid,
    rightLabel,
    right,
    boldRight = false,
}: {
    left: string | React.ReactNode;
    mid: string | number | React.ReactNode;
    rightLabel: string;
    right: string | number | React.ReactNode;
    boldRight?: boolean;
}) {
    return (
        <>
            <Typography variant="small" color="blue-gray" className="tw-opacity-70">
                {left}
            </Typography>
            <Typography color="blue-gray" className="tw-font-semibold">
                {mid}
            </Typography>
            <div className="tw-flex tw-justify-between">
                <Typography variant="small" color="blue-gray" className="tw-opacity-70">
                    {rightLabel}
                </Typography>
                <Typography color="blue-gray" className={boldRight ? "tw-font-bold" : "tw-font-semibold"}>
                    {right}
                </Typography>
            </div>
        </>
    );
}

/** ✅ Row สำหรับ PF/THDU/THDI (ประกาศในไฟล์นี้เลย) */
function Row({
    label,
    value,
    highlight = false,
}: {
    label: string;
    value: React.ReactNode;
    highlight?: boolean;
}) {
    return (
        <div className="tw-flex tw-justify-between">
            <Typography variant="small" color="blue-gray" className="tw-opacity-70">
                {label}
            </Typography>
            <Typography color="blue-gray" className={highlight ? "tw-font-bold tw-text-red-500" : "tw-font-semibold"}>
                {value}
            </Typography>
        </div>
    );
}

function SignalBars({ level = 0 }: { level: 0 | 1 | 2 | 3 | 4 }) {
    const bars = [1, 2, 3, 4];
    return (
        <Tooltip content={`Signal: ${level}/4`} placement="top">
            <div className="tw-flex tw-items-end tw-gap-0.5">
                {bars.map((_, i) => (
                    <div key={i} className={`tw-w-1 tw-rounded-sm ${i < level ? "tw-bg-green-500" : "tw-bg-blue-gray-100"}`} style={{ height: (i + 1) * 6 }} />
                ))}
            </div>
        </Tooltip>
    );
}

function FanDot({ on }: { on: boolean }) {
    return (
        <span className={`tw-inline-block tw-h-2.5 tw-w-2.5 tw-rounded-full ${on ? "tw-bg-green-500 tw-shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "tw-bg-blue-gray-200"}`} title={on ? "Fan ON" : "Fan OFF"} />
    );
}
