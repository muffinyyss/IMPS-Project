"use client";
import React from "react";
import Card from "./chargerSetting-card";

const items = [
    "Measured Voltage (V)",
    "Measured Voltage (V)",
    "Max Voltage (V)",
    "Max Voltage (V)",
    "Measured Current (A)",
    "Measured Current (A)",
    "Max Current (A)",
    "Max Current (A)",
    "Power (W)",
    "Power (W)",
    "Max Power (W)",
    "Max Power (W)",
];

export default function PowerModule() {
    return (
        <Card title="Power Module" className="tw-h-full">
            <div className="tw-divide-y tw-divide-blue-gray-50">
                {items.map((label, i) => (
                    <div key={`${label}-${i}`} className="tw-flex tw-items-center tw-justify-between tw-py-2">
                        <span className="tw-text-sm tw-text-blue-gray-600">{label}</span>
                        <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-900">0.00</span>
                    </div>
                ))}
            </div>
        </Card>
    );
}
