"use client";
import React from "react";

type Props = {
    value: number;          // 0–100
    label?: string;
    size?: number;          // px
    stroke?: number;        // px
    colorClass?: string;    // ถ้ากำหนด จะ override สีอัตโนมัติ
};

function pickColor(v: number) {
    if (v < 25) return "tw-text-red-500";
    if (v < 50) return "tw-text-amber-500";
    if (v < 75) return "tw-text-sky-500";
    return "tw-text-emerald-600";
}

export default function CircleProgress({
    value,
    label,
    size = 190,
    stroke = 16,
    colorClass,
}: Props) {
    const v = Math.max(0, Math.min(100, value));
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c - (v / 100) * c;
    // const color = colorClass ?? pickColor(v);
    const color = colorClass ?? "tw-text-green-600";

    return (
        <div className="tw-flex tw-flex-col tw-items-center tw-select-none">
            {label && <div className="tw-text-sm tw-text-blue-gray-600 tw-mb-2">{label}</div>}

            <div className="tw-relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-tw-rotate-90">
                    {/* Track (เทาอ่อน) */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        stroke="currentColor"
                        className="tw-fill-none tw-text-blue-gray-200"
                        strokeWidth={stroke}
                    />
                    {/* Progress (ใช้ currentColor -> คุมด้วย tw-text-* จึงเห็นสีแน่) */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        stroke="currentColor"
                        className={`tw-fill-none ${color} tw-transition-[stroke-dashoffset] tw-duration-700 tw-ease-out`}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={c}
                        strokeDashoffset={off}
                    />
                </svg>

                {/* ค่า % ตรงกลาง */}
                <div className="tw-absolute tw-inset-0 tw-grid tw-place-items-center">
                    <span className="tw-text-xl tw-font-semibold tw-text-blue-gray-900">{v}%</span>
                </div>
            </div>
        </div>
    );
}
