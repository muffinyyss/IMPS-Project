"use client";

import React from "react";
import { Typography, Tooltip } from "@/components/MaterialTailwind";
import { PowerIcon } from "@heroicons/react/24/solid";

export type MDBType = {
    tempc: number;
    humidity: number;
    fanOn: boolean;
    rssiDb: number;
    I1: number;
    I2: number;
    I3: number;
    totalCurrentA: number;
    powerKW: number | string;
    totalEnergyKWh: number | string;
    frequencyHz: number;
    pfL1: number;
    pfL2: number;
    pfL3: number;
    PL1N: number | string;
    PL2N: number | string;
    PL3N: number | string;
    PL123N: number | string;
    EL1: number | string;
    EL2: number | string;
    EL3: number | string;
    EL123: number | string;
    VL1N: number;
    VL2N: number;
    VL3N: number;
    VL1L2: number;
    VL2L3: number;
    VL1L3: number;
    thdvL1: number;
    thdvL2: number;
    thdvL3: number;
    thdiL1: number;
    thdiL2: number;
    thdiL3: number;
    className?: string;
    main_breaker: boolean;
    breaker_charger: boolean;
    VL1N_loss?: number;
    VL2N_loss?: number;
    VL3N_loss?: number;
    VL123_loss?: number;
    PL1N_peak?: number | string;
    PL2N_peak?: number | string;
    PL3N_peak?: number | string;
    PL123N_peak?: number | string;
};

const formatComma = (val: number | string | undefined) => {
    if (val === null || val === undefined || val === "") return "0";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) return "0";
    return num.toLocaleString("en-US");
};

const WaveSawIcon = ({ className = "" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg"
        className={`icon icon-tabler icon-tabler-wave-saw-tool ${className}`}
        width="22" height="22" viewBox="0 0 24 24"
        stroke="currentColor" fill="none" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M0 0h24v24H0z" fill="none" stroke="none" />
        <path d="M3 12h5l4 8v-16l4 8h5" />
    </svg>
);

const WaveformIcon = ({ className = "" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg"
        className={`icon icon-tabler icon-tabler-waveform ${className}`}
        width="22" height="22" viewBox="0 0 24 24"
        strokeWidth="2" stroke="currentColor" fill="none"
        strokeLinecap="round" strokeLinejoin="round">
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M3 12h18m-6 0l-3 5l-3 -10l-3 5" />
    </svg>
);

export default function MDBInfo(props: MDBType) {
    const {
        I1, I2, I3, totalCurrentA, powerKW, totalEnergyKWh, frequencyHz,
        pfL1, pfL2, pfL3,
        PL1N, PL2N, PL3N, PL123N,
        EL1, EL2, EL3, EL123,
        VL1N, VL2N, VL3N,
        VL1L2, VL2L3, VL1L3,
        thdiL1, thdiL2, thdiL3,
        className = "",
        main_breaker, breaker_charger,
        VL1N_loss, VL2N_loss, VL3N_loss, VL123_loss,
        PL1N_peak, PL2N_peak, PL3N_peak, PL123N_peak,
    } = props;

    const items = [
        { icon: <WaveSawIcon className="tw-text-amber-400" />, label: "Total Current", value: formatComma(totalCurrentA), unit: "A", accent: "#f59e0b" },
        { icon: <i className="fa-solid fa-bolt tw-text-blue-400 tw-text-sm"></i>, label: "Power Energy", value: formatComma(powerKW), unit: "kW", accent: "#3b82f6" },
        { icon: <i className="fas fa-gas-pump tw-text-emerald-400 tw-text-sm"></i>, label: "Total Energy", value: formatComma(totalEnergyKWh), unit: "kWh", accent: "#10b981" },
        { icon: <WaveformIcon className="tw-text-purple-400" />, label: "Frequency", value: formatComma(frequencyHz), unit: "Hz", accent: "#8b5cf6" },
    ];

    return (
        <div className={`tw-w-full tw-space-y-6 ${className}`}>

            {/* ══════ Power Block (All-in-One) ══════ */}
            <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 lg:tw-grid-cols-6 tw-gap-2.5 sm:tw-gap-3">

                {/* Main Breaker */}
                <div className="tw-relative tw-overflow-hidden tw-rounded-xl tw-px-4 tw-py-4 tw-border tw-border-gray-200 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-all tw-duration-200">
                    <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2.5">
                        <div className="tw-h-7 tw-w-7 tw-rounded-lg tw-flex tw-items-center tw-justify-center tw-bg-gray-100">
                            <PowerIcon className="tw-h-4 tw-w-4 tw-text-gray-500" />
                        </div>
                        <p className="tw-text-[10px] tw-text-gray-400 tw-font-semibold tw-uppercase tw-tracking-wider">
                            Main Breaker
                        </p>
                    </div>
                    <div className="tw-flex tw-items-center tw-gap-2">
                        {/* <span className={`tw-h-2.5 tw-w-2.5 tw-rounded-full ${main_breaker ? "tw-bg-green-500 tw-shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "tw-bg-red-500 tw-shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`} />
                        <span className={`tw-text-xl tw-font-black tw-tracking-tight ${main_breaker ? "tw-text-green-600" : "tw-text-red-500"}`}> */}
                        <span className={`tw-h-2.5 tw-w-2.5 tw-rounded-full ${main_breaker ? "tw-bg-green-500 tw-shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "tw-bg-green-500 tw-shadow-[0_0_8px_rgba(34,197,94,0.5)]"}`} />
                        <span className={`tw-text-xl tw-font-black tw-tracking-tight ${main_breaker ? "tw-text-green-600" : "tw-text-green-600"}`}>
                            {main_breaker ? "ON" : "ON"}
                        </span>
                    </div>
                </div>

                {/* Break Charger */}
                <div className="tw-relative tw-overflow-hidden tw-rounded-xl tw-px-4 tw-py-4 tw-border tw-border-gray-200 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-all tw-duration-200">
                    <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2.5">
                        <div className="tw-h-7 tw-w-7 tw-rounded-lg tw-flex tw-items-center tw-justify-center tw-bg-gray-100">
                            <PowerIcon className="tw-h-4 tw-w-4 tw-text-gray-500" />
                        </div>
                        <p className="tw-text-[10px] tw-text-gray-400 tw-font-semibold tw-uppercase tw-tracking-wider">
                            Break Charger
                        </p>
                    </div>
                    <div className="tw-flex tw-items-center tw-gap-2">
                        {/* <span className={`tw-h-2.5 tw-w-2.5 tw-rounded-full ${breaker_charger ? "tw-bg-green-500 tw-shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "tw-bg-red-500 tw-shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`} /> */}
                        <span className={`tw-h-2.5 tw-w-2.5 tw-rounded-full ${breaker_charger ? "tw-bg-green-500 tw-shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "tw-bg-green-500 tw-shadow-[0_0_8px_rgba(34,197,94,0.5)]"}`} />
                        {/* <span className={`tw-text-xl tw-font-black tw-tracking-tight ${breaker_charger ? "tw-text-green-600" : "tw-text-red-500"}`}> */}
                        <span className={`tw-text-xl tw-font-black tw-tracking-tight ${breaker_charger ? "tw-text-green-600" : "tw-text-green-600"}`}>
                            {breaker_charger ? "ON" : "ON"}
                        </span>
                    </div>
                </div>
                

                {items.map((item, i) => (
                    <div key={i} className="tw-relative tw-overflow-hidden tw-rounded-xl tw-px-4 tw-py-4 tw-border tw-border-gray-200 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-all tw-duration-200 hover:tw--translate-y-0.5">
                        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2.5">
                            <div className="tw-h-7 tw-w-7 tw-rounded-lg tw-flex tw-items-center tw-justify-center"
                                style={{ background: `${item.accent}15` }}>
                                {item.icon}
                            </div>
                            <p className="tw-text-[10px] tw-text-gray-400 tw-font-semibold tw-uppercase tw-tracking-wider tw-truncate">
                                {item.label}
                            </p>
                        </div>
                        <div className="tw-flex tw-items-baseline tw-gap-1">
                            <span className="tw-text-xl sm:tw-text-2xl tw-font-black tw-text-gray-800 tw-tracking-tight">
                                {item.value}
                            </span>
                            <span className="tw-text-[11px] tw-font-bold tw-tracking-wide" style={{ color: item.accent }}>
                                {item.unit}
                            </span>
                        </div>
                    </div>
                ))}

                

                
            </div>

            {/* ══════ Quality Section ══════ */}
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4">
                <DataCard title="Voltage">
                    <Row label="L1" value={formatComma(VL1N)} unit="V" />
                    <Row label="L2" value={formatComma(VL2N)} unit="V" />
                    <Row label="L3" value={formatComma(VL3N)} unit="V" />
                </DataCard>

                <DataCard title="Current">
                    <Row label="I1" value={formatComma(I1)} unit="A" />
                    <Row label="I2" value={formatComma(I2)} unit="A" />
                    <Row label="I3" value={formatComma(I3)} unit="A" />
                </DataCard>

                <DataCard title="Voltage Phase">
                    <Row label="L1 L2" value={formatComma(VL1L2)} unit="V" />
                    <Row label="L2 L3" value={formatComma(VL2L3)} unit="V" />
                    <Row label="L1 L3" value={formatComma(VL1L3)} unit="V" />
                </DataCard>

                <DataCard title="Power Active">
                    <Row label="P1" value={formatComma(PL1N)} unit="kW" />
                    <Row label="P2" value={formatComma(PL2N)} unit="kW" />
                    <Row label="P3" value={formatComma(PL3N)} unit="kW" />
                </DataCard>

                <DataCard title="THDI">
                    <Row label="L1" value={formatComma(thdiL1/100)} unit="%" />
                    <Row label="L2" value={formatComma(thdiL2/100)} unit="%" />
                    <Row label="L3" value={formatComma(thdiL3/100)} unit="%" />
                </DataCard>

                <DataCard title="Power Factor">
                    <Row label="pf–L1" value={formatComma(Number(pfL1))} />
                    <Row label="pf–L2" value={formatComma(Number(pfL2))} />
                    <Row label="pf–L3" value={formatComma(Number(pfL3))} />
                </DataCard>

                <DataCard title="Energy Total">
                    <Row label="EL1" value={formatComma(EL1)} unit="kWh" />
                    <Row label="EL2" value={formatComma(EL2)} unit="kWh" />
                    <Row label="EL3" value={formatComma(EL3)} unit="kWh" />
                    <Row label="Total" value={formatComma(EL123)} unit="kWh" />
                </DataCard>

                <DataCard title="Counter Voltage loss">
                    <Row label="L1 Loss" value={formatComma(VL1N_loss)} />
                    <Row label="L2 Loss" value={formatComma(VL2N_loss)} />
                    <Row label="L3 Loss" value={formatComma(VL3N_loss)} />
                    <Row label="Total Loss" value={formatComma(VL123_loss)} />
                </DataCard>

                <DataCard title="Power Active peak">
                    <Row label="P1" value={formatComma(PL1N_peak)} unit="kW" />
                    <Row label="P2" value={formatComma(PL2N_peak)} unit="kW" />
                    <Row label="P3" value={formatComma(PL3N_peak)} unit="kW" />
                    <Row label="Total Peak" value={formatComma(PL123N_peak)} unit="kW" />
                </DataCard>
            </div>
        </div>
    );
}

function DataCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4 tw-shadow-md">
            <Typography variant="small" color="blue-gray" className="tw-mb-2 tw-font-medium">
                {title}
            </Typography>
            <div className="tw-space-y-1">
                {children}
            </div>
        </div>
    );
}

function Row({ label, value, unit }: { label: string; value: React.ReactNode; highlight?: boolean; unit?: string }) {
    return (
        <div className="tw-flex tw-justify-between">
            <Typography variant="small" color="blue-gray" className="tw-opacity-70">
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