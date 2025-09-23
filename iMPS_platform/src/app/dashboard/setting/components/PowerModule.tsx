"use client";

import React from "react";
import Card from "./chargerSetting-card";

/* แถวข้อมูลแบบสลับสี */
function Row({
    label,
    value,
    zebra = false,
}: {
    label: string;
    value: string;
    zebra?: boolean;
}) {
    return (
        <div
            className={`tw-grid tw-grid-cols-2 tw-gap-2 tw-py-2 tw-px-3
        ${zebra ? "tw-bg-blue-gray-50/60" : "tw-bg-white"}
      `}
        >
            <span className="tw-text-sm tw-text-blue-gray-700">{label}</span>
            <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-900 tw-text-right tw-tabular-nums">
                {value}
            </span>
        </div>
    );
}

export default function PowerModule() {
    const rows = [
        { label: "Measured Voltage (V)", value: "0.00" },
        { label: "Measured Voltage (V)", value: "0.00" },
        { label: "Max Voltage (V)", value: "0.00" },
        { label: "Max Voltage (V)", value: "0.00" },
        { label: "Measured Current (A)", value: "0.00" },
        { label: "Measured Current (A)", value: "0.00" },
        { label: "Max Current (A)", value: "0.00" },
        { label: "Max Current (A)", value: "0.00" },
        { label: "Power (W)", value: "0.00" },
        { label: "Power (W)", value: "0.00" },
        { label: "Max Power (W)", value: "0.00" },
        { label: "Max Power (W)", value: "0.00" },
    ];

    return (
        <Card title="PowerModule" className="tw-h-full">
            <div className="tw-rounded-lg tw-overflow-hidden">
                {rows.map((r, i) => (
                    <Row key={i} label={r.label} value={r.value} zebra={i % 2 === 1} />
                ))}
            </div>
        </Card>
    );
}
