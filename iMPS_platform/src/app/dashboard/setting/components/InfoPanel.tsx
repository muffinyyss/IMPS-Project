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

export default function InfoPanel() {
    return (
        <Card title="Info">
            <div className="tw-divide-y tw-divide-blue-gray-50">
                {rows.map(([label, value]) => {
                    const ok = value.toLowerCase() === "operative";
                    return (
                        <div key={label} className="tw-flex tw-items-center tw-justify-between tw-py-3">
                            <span className="tw-text-sm tw-text-blue-gray-700">{label}</span>
                            <span
                                className={`tw-text-xs tw-font-medium tw-rounded-full tw-px-2.5 tw-py-1
                ${ok ? "tw-bg-emerald-50 tw-text-emerald-700 tw-border tw-border-emerald-100" :
                                        "tw-bg-red-50 tw-text-red-700 tw-border tw-border-red-100"}`}
                            >
                                {value}
                            </span>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
