"use client";
import React from "react";

type Props = {
    value: number;
    label?: string;
    color?: string; // hex หรือ css color เช่น "#22c55e"
};

function pickColor(v: number): string {
    if (v < 30) return "#ef4444"; // 🔴 red   (0–29%)
    if (v < 70) return "#f59e0b"; // 🟡 yellow (30–69%)
    return "#22c55e";             // 🟢 green  (70–100%)
}

export default function BarProgress({ value, label, color }: Props) {
    const v = Math.max(0, Math.min(100, value));
    const fillColor = color ?? pickColor(v);

    return (
        <div className="tw-w-full tw-select-none">
            {label && (
                <div className="tw-flex tw-items-center tw-justify-between tw-mb-1.5">
                    <span className="tw-text-sm tw-text-blue-gray-600">{label}</span>
                    <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-900">{v}%</span>
                </div>
            )}

            {/* Track */}
            <div className="tw-w-full tw-h-4 tw-rounded-full tw-bg-blue-gray-100 tw-overflow-hidden">
                {/* Fill — ใช้ inline style เพื่อให้สีแสดงผลได้ทุกกรณี */}
                <div
                    style={{
                        width: `${v}%`,
                        height: "100%",
                        borderRadius: "9999px",
                        backgroundColor: fillColor,
                        transition: "width 0.7s ease-out",
                    }}
                />
            </div>

            {!label && (
                <div className="tw-text-right tw-mt-1">
                    <span className="tw-text-xs tw-font-semibold tw-text-blue-gray-700">{v}%</span>
                </div>
            )}
        </div>
    );
}