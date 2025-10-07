"use client";

import React from "react";
import Card from "./chargerSetting-card";
import CircleProgress from "./CircleProgress";

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

export default function EvPanel() {
    const rows = [
        { label: "CP State1", value: "A" },
        { label: "CP State2", value: "A" },
        { label: "Target Voltage (V)", value: "0.00" },
        { label: "Target Voltage (V)", value: "0.00" },
        { label: "Target Current (A)", value: "0.00" },
        { label: "Target Current (A)", value: "0.00" },
    ];

    return (
        <Card title="EV">
            <div className="tw-rounded-lg tw-overflow-hidden">
                {rows.map((r, i) => (
                    <Row key={i} label={r.label} value={r.value} zebra={i % 2 === 1} />
                ))}
            </div>

            {/* SoC */}
            {/* <div className="tw-flex tw-flex-col tw-items-center tw-gap-6 tw-pt-6">
                <CircleProgress label="SoC1 :" value={43} />
                <CircleProgress label="SoC2 :" value={78} />
            </div> */}
        </Card>
    );
}
