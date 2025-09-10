"use client";

import React from "react";

type Row = { label: string; value?: string | number };

const rows: Row[] = [
    { label: "CP State1", value: "A" },
    { label: "CP State2", value: "A" },
    { label: "Target Voltage (V)", value: "0.00" },
    { label: "Target Voltage (V)", value: "0.00" },
    { label: "Target Current (A)", value: "0.00" },
    { label: "Target Current (A)", value: "0.00" },
];

function Circle({ percent = 0 }: { percent?: number }) {
    return (
        <div className="flex flex-col items-center">
            <div className="relative h-28 w-28 rounded-full border-8 border-neutral-600">
                <div className="absolute inset-0 grid place-items-center text-white font-semibold">
                    {percent}%
                </div>
            </div>
        </div>
    );
}

export default function EvPanel() {
    return (
        <div className="rounded-2xl bg-neutral-900 text-white shadow-inner h-full">
            <div className="border-b border-neutral-800 px-5 py-3 text-center font-semibold">
                EV
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                    {rows.map((r) => (
                        <div key={r.label} className="flex items-center justify-between">
                            <span className="text-sm text-neutral-300">{r.label}</span>
                            <span className="font-semibold">{r.value ?? "-"}</span>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-6 items-center">
                    <div className="flex flex-col items-center gap-2">
                        <div className="text-sm text-neutral-300">SoC1 :</div>
                        <Circle percent={0} />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="text-sm text-neutral-300">SoC2 :</div>
                        <Circle percent={0} />
                    </div>
                </div>
            </div>
        </div>
    );
}
