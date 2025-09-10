"use client";

import React from "react";

type Row = { label: string; value?: string | number };

const rows: Row[] = [
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

export default function PowerModule() {
    return (
        <div className="rounded-2xl bg-neutral-900 text-white shadow-inner h-full">
            <div className="border-b border-neutral-800 px-5 py-3 text-center font-semibold">
                Power Module
            </div>
            <div className="p-5 space-y-3">
                {rows.map((r, i) => (
                    <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-neutral-300">{r.label}</span>
                        <span className="font-semibold">{r.value ?? "-"}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
