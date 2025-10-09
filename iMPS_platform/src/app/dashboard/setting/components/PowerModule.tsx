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
        { label: "Measured Voltage Head 1 (V)", value: "0.00" },
        { label: "Measured Voltage Head 2 (V)", value: "0.00" },
        { label: "Max Voltage Head 1 (V)", value: "0.00" },
        { label: "Max Voltage Head 2 (V)", value: "0.00" },
        { label: "Max Current Head 1 (A)", value: "0.00" },
        { label: "Max Current Head 2 (A)", value: "0.00" },
        { label: "Measured Current Head 1 (A)", value: "0.00" },
        { label: "Measured Current Head 2 (A)", value: "0.00" },
        { label: "Power Head 1 (W)", value: "0.00" },
        { label: "Power Head 2 (W)", value: "0.00" },
        { label: "Max Power Head 1 (W)", value: "0.00" },
        { label: "Max Power Head 2 (W)", value: "0.00" },
        { label: "Power H1 limit (kWh)", value: "0.00" },
        { label: "Power H2 limit (kWh)", value: "0.00" },
        { label: "Power H0 limit (kWh)", value: "0.00" },
    ];

    return (
        <Card title="PowerModule">
            <div className="tw-rounded-lg tw-overflow-hidden">
                {rows.map((r, i) => (
                    <Row key={i} label={r.label} value={r.value} zebra={i % 2 === 1} />
                ))}
            </div>
        </Card>
    );
}
