"use client";

import React from "react";

type Row = { label: string; value: "Operative" | "fault" | string };

const rows: Row[] = [
    { label: "IMD Status1", value: "Operative" },
    { label: "IMD Status2", value: "Operative" },
    { label: "PM Status1", value: "Operative" },
    { label: "PM Status2", value: "Operative" },
    { label: "Isolation Status1", value: "fault" },
    { label: "Isolation Status2", value: "fault" },
];

export default function InfoPanel() {
    return (
        <div className="rounded-2xl bg-neutral-900 text-white shadow-inner">
            <div className="border-b border-neutral-800 px-5 py-3 text-center font-semibold">
                Info
            </div>

            <div className="p-5 space-y-3">
                {rows.map((r) => (
                    <div key={r.label} className="flex items-center justify-between">
                        <span className="text-sm text-neutral-300">{r.label}</span>
                        <span
                            className={
                                r.value === "fault"
                                    ? "font-semibold text-red-500"
                                    : "font-semibold"
                            }
                        >
                            {r.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
