"use client";

import React from "react";
import { Typography, Chip, Tooltip } from "@/components/MaterialTailwind";
import {
    BoltIcon,
    PowerIcon,
    BoltSlashIcon,
    SignalIcon,
    SunIcon,
} from "@heroicons/react/24/solid";
import { CpuChipIcon } from "@heroicons/react/24/outline";
// import { Card, CardHeader, CardContent, CardFooter } from "@/widgets";



/** ===== Props ===== */
type Props = {
    tempC: number | string;
    humidity: number | string;
    fanOn: boolean;
    rssiDb?: number | string;
    // signalLevel?: 0 | 1 | 2 | 3 | 4;
    totalCurrentA: number | string;
    powerKW: number | string;
    totalEnergyKWh: number | string;
    frequencyHz: number | string;
    pfL1: number | string;
    pfL2: number | string;
    pfL3: number | string;
    EL1: number | string;
    EL2: number | string;
    EL3: number | string;
    thduL1: number | string;
    thduL2: number | string;
    thduL3: number | string;
    thdiL1: number | string;
    thdiL2: number | string;
    thdiL3: number | string;
    className?: string;
    mainBreakerStatus: boolean;
    breakChargerStatus: boolean;
};

/** ===== Component ===== */
export default function MDBInfo({
    tempC,
    humidity,
    fanOn,
    rssiDb = "-",
    // signalLevel = 3,
    totalCurrentA,
    powerKW,
    totalEnergyKWh,
    frequencyHz,
    pfL1,
    pfL2,
    pfL3,
    EL1,
    EL2,
    EL3,
    thduL1,
    thduL2,
    thduL3,
    thdiL1,
    thdiL2,
    thdiL3,
    className = "",
    mainBreakerStatus,
    breakChargerStatus
}: Props) {
    return (
        <div className={`tw-w-full tw-space-y-6 ${className}`}>
            {/* ===== Top quick stats ===== */}
            {/* Power Block Section */}
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                <div className="tw-space-y-3 tw-max-w-[550px]">
                    <MetricRow icon={<BoltIcon className="tw-h-5 tw-w-5 tw-text-yellow-600" />} label="Total Current" value={totalCurrentA} unit="A" />
                    <MetricRow icon={<PowerIcon className="tw-h-5 tw-w-5 tw-text-yellow-600" />} label="Power Energy" value={powerKW} unit="kW" />
                    <MetricRow icon={<BoltSlashIcon className="tw-h-5 tw-w-5 tw-text-yellow-600" />} label="Total Energy" value={totalEnergyKWh} unit="kWh" />
                    <MetricRow icon={<BoltSlashIcon className="tw-h-5 tw-w-5 tw-text-yellow-600" />} label="Frequency" value={frequencyHz} unit="Hz" />
                </div>

                {/* Status Cards */}
                <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
                    {/* Mainbreaker */}
                    <div className="tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-5 tw-shadow-sm tw-flex tw-items-center tw-justify-between">
                        {/* Left side: icon + label */}
                        <div className="tw-flex tw-items-center tw-gap-3">
                            <div className="tw-flex tw-h-12 tw-w-12 tw-items-center tw-justify-center tw-rounded-xl tw-bg-gray-100">
                                <BoltIcon className="tw-h-6 tw-w-6 tw-text-gray-700" />
                            </div>
                            <Typography variant="small" color="blue-gray" className="tw-font-medium">
                                Mainbreaker
                            </Typography>
                        </div>
                        {/* Right side: status */}
                        <div className="tw-flex tw-items-center tw-gap-2">
                            <span
                                className={`tw-h-2.5 tw-w-2.5 tw-rounded-full ${mainBreakerStatus ? "tw-bg-green-500" : "tw-bg-red-500"
                                    }`}
                            />
                            <Typography
                                variant="h6"
                                className={`tw-font-bold ${mainBreakerStatus ? "tw-text-green-600" : "tw-text-red-500"
                                    }`}
                            >
                                {mainBreakerStatus ? "ON" : "OFF"}
                            </Typography>
                        </div>
                    </div>

                    {/* Break Charger */}
                    <div className="tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-5 tw-shadow-sm tw-flex tw-items-center tw-justify-between">
                        {/* Left side: icon + label */}
                        <div className="tw-flex tw-items-center tw-gap-3">
                            <div className="tw-flex tw-h-12 tw-w-12 tw-items-center tw-justify-center tw-rounded-xl tw-bg-gray-100">
                                <PowerIcon className="tw-h-6 tw-w-6 tw-text-gray-700" />
                            </div>
                            <Typography variant="small" color="blue-gray" className="tw-font-medium">
                                Break Charger
                            </Typography>
                        </div>
                        {/* Right side: status */}
                        <div className="tw-flex tw-items-center tw-gap-2">
                            <span
                                className={`tw-h-2.5 tw-w-2.5 tw-rounded-full ${breakChargerStatus ? "tw-bg-green-500" : "tw-bg-red-500"
                                    }`}
                            />
                            <Typography
                                variant="h6"
                                className={`tw-font-bold ${breakChargerStatus ? "tw-text-green-600" : "tw-text-red-500"
                                    }`}
                            >
                                {breakChargerStatus ? "ON" : "OFF"}
                            </Typography>
                        </div>
                    </div>
                </div>




            </div>

            {/* Quality Section */}
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-4 tw-gap-4">
                {/* PF */}
                <div className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
                    <Typography variant="small" color="blue-gray" className="tw-mb-2 tw-font-medium">
                        Power Factor
                    </Typography>
                    <div className="tw-space-y-1">
                        <Row label="pf–L1" value={pfL1} />
                        <Row label="pf–L2" value={pfL2} />
                        <Row label="pf–L3" value={pfL3} />
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
                    </div>
                </div>

                {/* THDU */}
                <div className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
                    <Typography variant="small" color="blue-gray" className="tw-mb-2 tw-font-medium">
                        THDU (%)
                    </Typography>
                    <div className="tw-space-y-1">
                        <Row label="L1" value={thduL1} />
                        <Row label="L2" value={thduL2} />
                        <Row label="L3" value={thduL3} />
                    </div>
                </div>

                {/* THDI */}
                <div className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
                    <Typography variant="small" color="blue-gray" className="tw-mb-2 tw-font-medium">
                        THDI (%)
                    </Typography>
                    <div className="tw-space-y-1">
                        <Row label="L1" value={thdiL1} highlight />
                        <Row label="L2" value={thdiL2} highlight />
                        <Row label="L3" value={thdiL3} highlight />
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
