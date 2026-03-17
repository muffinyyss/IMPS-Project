"use client";

import React from "react";

type Props = {
    value: number;           // 0–100
    label?: string;
    size?: number;           // px
    stroke?: number;         // px
    colorClass?: string;     // ใช้ถ้าต้องการควบคุมด้วยคลาส (จะใช้ currentColor)
    valueClassName?: string; // สี/สไตล์ของตัวเลข %
    labelClassName?: string; // สี/สไตล์ของ label
    className?: string;      // wrapper เพิ่มเติม
};

export default function CircleProgress({
    value,
    label,
    size = 190,
    stroke = 16,
    colorClass,
    valueClassName,
    labelClassName,
    className,
}: Props) {
    const v = Math.max(0, Math.min(100, value));
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c - (v / 100) * c;

    const useCurrentColor = !!colorClass;

    // เลือกสีตามเปอร์เซ็นต์ (เฉพาะกรณีไม่ override ด้วย colorClass)
    let strokeColor = "#24cf63ff"; // เขียว (green-600)
    if (!useCurrentColor) {
        if (v >= 69) strokeColor = "#16a34a";          // green-600
        else if (v >= 30 && v <= 50) strokeColor = "#f7a923ff"; // amber-500
        else if (v < 30) strokeColor = "#f54a4aff";      // red-500
        else strokeColor = "#16a34a";                  // ค่าคั่นกลางให้เป็นเขียว
    }

    return (
        <div className={`tw-flex tw-flex-col tw-items-center tw-select-none ${className ?? ""}`}>
            {label && (
                <div className={`tw-text-sm tw-mb-2 ${labelClassName ?? "tw-text-blue-gray-600"}`}>
                    {label}
                </div>
            )}

            <div className="tw-relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-tw-rotate-90">
                    {/* Track */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        stroke="currentColor"
                        className="tw-fill-none tw-text-blue-gray-200"
                        strokeWidth={stroke}
                    />
                    {/* Progress */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        stroke={useCurrentColor ? "currentColor" : strokeColor}
                        className={`tw-fill-none tw-transition-[stroke-dashoffset] tw-duration-700 tw-ease-out ${useCurrentColor ? colorClass : ""
                            }`}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={c}
                        strokeDashoffset={off}
                    />
                </svg>

                {/* ค่า % ตรงกลาง */}
                <div className="tw-absolute tw-inset-0 tw-grid tw-place-items-center">
                    <span className={`tw-text-xl tw-font-semibold ${valueClassName ?? "tw-text-blue-gray-900"}`}>
                        {v}%
                    </span>
                </div>
            </div>
        </div>
    );
}
