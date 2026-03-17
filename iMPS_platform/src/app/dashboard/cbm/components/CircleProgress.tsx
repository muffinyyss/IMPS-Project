"use client";

import React from "react";

type Props = {
  value: string | number;   // ค่าที่จะแสดงตรงกลาง เช่น "35°" หรือ 35
  progress?: number;        // 0–100 เปอร์เซ็นต์ของวงแหวน (ถ้าไม่ส่งและ value เป็น number จะใช้ value)
  label?: string;
  size?: number;            // px
  stroke?: number;          // px
  colorClass?: string;      // ใช้คลาสควบคุมสี (currentColor)
  valueClassName?: string;  // สไตล์ตัวเลขกลางวง
  labelClassName?: string;  // สไตล์ label
  className?: string;       // wrapper เพิ่มเติม
  suffix?: string;          // ต่อท้ายเมื่อ value เป็น number (เช่น "°")
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const cx = (...s: (string | undefined)[]) => s.filter(Boolean).join(" ");

export default function CircleProgress({
  value,
  progress,
  label,
  size = 180,
  stroke = 16,
  colorClass,
  valueClassName,
  labelClassName,
  className,
  suffix,
}: Props) {
  // เปอร์เซ็นต์ของวงแหวน
  const pct =
    typeof progress === "number"
      ? clamp(progress)
      : typeof value === "number"
      ? clamp(value)
      : 0;

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;

  const useCurrentColor = !!colorClass;

  // เลือกสีตามเปอร์เซ็นต์ (กรณีไม่ override ด้วย colorClass)
  let strokeColor = "#24cf63ff"; // เขียว default
  if (!useCurrentColor) {
    if (pct >= 69) strokeColor = "#16a34a";                // green-600
    else if (pct >= 30 && pct <= 50) strokeColor = "#f7a923ff"; // amber-500
    else if (pct < 30) strokeColor = "#f54a4aff";          // red-500
    else strokeColor = "#16a34a";
  }

  // ค่าที่จะแสดงตรงกลาง
  const display =
    typeof value === "number" ? `${value}${suffix ?? "%"}` : value;

  return (
    <div className={cx("tw-flex tw-flex-col tw-items-center tw-select-none", className)}>
      {label && (
        <div className={cx("tw-text-sm tw-mb-2", labelClassName ?? "tw-text-blue-gray-600")}>
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
            className={cx(
              "tw-fill-none tw-transition-[stroke-dashoffset] tw-duration-700 tw-ease-out",
              useCurrentColor ? colorClass : undefined
            )}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={off}
          />
        </svg>

        {/* ข้อความตรงกลาง */}
        <div className="tw-absolute tw-inset-0 tw-grid tw-place-items-center">
          <span className={cx("tw-text-xl tw-font-semibold", valueClassName ?? "tw-text-blue-gray-900")}>
            {display}
          </span>
        </div>
      </div>
    </div>
  );
}
