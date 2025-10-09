"use client";
import React from "react";
import Card from "./chargerSetting-card";

const rows = [
    ["IMD Status1", "Operative"],
    ["IMD Status2", "Operative"],
    ["PM Status1", "Operative"],
    ["PM Status2", "Operative"],
    ["Isolation Status1", "fault"],
    ["Isolation Status2", "fault"],
] as const;

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

export default function InfoPanel() {
    const rows = [
        { label: "IMD Status Head 1", value: "Operative" },
        { label: "IMD Status Head 2", value: "Operative" },
        { label: "PM Status Head 1", value: "Operative" },
        { label: "PM Status Head 2", value: "Operative" },
        { label: "Isolation Status Head 1", value: "fault" },
        { label: "Isolation Status Head 2", value: "fault" },
    ];

    return (
        <Card title="Info">
            <div className="tw-rounded-lg tw-overflow-hidden">
                {rows.map((r, i) => (
                    <Row key={i} label={r.label} value={r.value} zebra={i % 2 === 1} />
                ))}
            </div>
        </Card>
    );
}
