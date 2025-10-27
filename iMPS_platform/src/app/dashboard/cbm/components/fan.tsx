"use client";

import React from "react";
import { Typography } from "@material-tailwind/react";

/* ---------- types ---------- */
type FanItem = {
  id: string;
  name: string;             // "FAN1"
  rpm: number | null;       // ค่าปัจจุบัน
  active: boolean;          // ON/OFF
  maxRpm?: number;          // ดีฟอลต์ 5000
};
type FansCardProps = {
  title?: string;
  updatedAt?: string;
  fans: FanItem[];
};

/* ---------- helpers ---------- */
function getTone(active: boolean, rpm: number | null, maxRpm = 5000) {
  if (!active || !rpm || rpm <= 0) {
    return {
      pct: 0,
      bar: "tw-bg-blue-gray-300",
      chip: "tw-bg-blue-gray-50 tw-text-blue-gray-700 tw-ring-1 tw-ring-blue-gray-100",
      dot: "tw-bg-blue-gray-300",
      label: "OFF",
    };
  }
  const pct = Math.max(0, Math.min(100, Math.round((rpm / maxRpm) * 100)));
  if (pct > 80)
    return {
      pct,
      bar: "tw-bg-red-500",
      chip: "tw-bg-red-50 tw-text-red-700 tw-ring-1 tw-ring-red-100",
      dot: "tw-bg-red-500",
      label: "High",
    };
  if (pct >= 40)
    return {
      pct,
      bar: "tw-bg-amber-500",
      chip: "tw-bg-amber-50 tw-text-amber-700 tw-ring-1 tw-ring-amber-100",
      dot: "tw-bg-amber-500",
      label: "Medium",
    };
  return {
    pct,
    bar: "tw-bg-green-500",
    chip: "tw-bg-green-50 tw-text-green-700 tw-ring-1 tw-ring-green-100",
    dot: "tw-bg-green-500",
    label: "Low",
  };
}

const FanIcon: React.FC<{ spinning?: boolean }> = ({ spinning }) => (
  <svg
    className={
      spinning
        ? "tw-h-5 tw-w-5 tw-text-blue-gray-400 tw-animate-spin [animation-duration:2.2s]"
        : "tw-h-5 tw-w-5 tw-text-blue-gray-300"
    }
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
  >
    <circle cx="12" cy="12" r="2" strokeWidth="1.5" />
    <path d="M12 3c3 0 5 2 5 4.5S15 11 12 11" strokeWidth="1.5" />
    <path d="M21 12c0 3-2 5-4.5 5S13 15 13 12" strokeWidth="1.5" />
    <path d="M12 21c-3 0-5-2-5-4.5S9 13 12 13" strokeWidth="1.5" />
    <path d="M3 12c0-3 2-5 4.5-5S11 9 11 12" strokeWidth="1.5" />
  </svg>
);

/* ---------- tile (no hover/hold effects) ---------- */
function FanTile({ name, rpm, active, maxRpm = 5000 }: FanItem) {
  const tone = getTone(active, rpm, maxRpm);
  const rpmNum = rpm ?? 0;

  return (
    <div
      className="
        tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4
        tw-flex tw-flex-col tw-justify-between tw-h-full
        tw-shadow-[0_1px_0_0_rgba(16,24,40,0.02)]
      "
    >
      {/* header */}
      <div className="tw-flex tw-items-center tw-justify-between">
        <span className="tw-text-[11px] tw-font-semibold tw-tracking-wide tw-text-blue-gray-700">
          {name}
        </span>
        <FanIcon spinning={active && rpmNum > 0} />
      </div>

      {/* rpm big number */}
      <div className="tw-mt-2">
        <div className="tw-text-[30px] tw-leading-none tw-font-semibold tw-text-blue-gray-900">
          {rpmNum.toLocaleString()}
          <span className="tw-text-sm tw-font-normal tw-text-blue-gray-500"> RPM</span>
        </div>
        <div className="tw-text-[11px] tw-text-blue-gray-400 tw-mt-1">
          Max {maxRpm.toLocaleString()} RPM
        </div>
      </div>

      {/* horizontal speed bar */}
      <div className="tw-mt-3">
        <div className="tw-h-2.5 tw-w-full tw-rounded-full tw-bg-blue-gray-50 tw-overflow-hidden">
          <div
            className={`tw-h-full ${tone.bar} tw-rounded-full tw-transition-[width] tw-duration-500`}
            style={{ width: `${tone.pct}%` }}
          />
        </div>
        <div className="tw-flex tw-items-center tw-justify-between tw-mt-1.5">
          <div className="tw-flex tw-items-center tw-gap-1.5">
            <span className={`tw-inline-block tw-h-2 tw-w-2 tw-rounded-full ${tone.dot}`} />
            <span className="tw-text-[11px] tw-text-blue-gray-600">{tone.pct}%</span>
          </div>
          <span className={`tw-text-[10px] tw-rounded-full tw-px-2 tw-py-[3px] ${tone.chip}`}>
            {tone.label}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- card container ---------- */
export default function FansCard({
  title = "Fans Status & RPM",
  updatedAt,
  fans,
}: FansCardProps) {
  return (
    <section className="tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-5">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-4">
        <Typography variant="h6" color="blue-gray" className="tw-leading-tight">
          {title}
        </Typography>
        {updatedAt && <span className="tw-text-xs tw-text-blue-gray-500">Updated {updatedAt}</span>}
      </div>

      {/* grid: equal tiles / equal height */}
      <div className="tw-grid tw-gap-4 tw-grid-cols-2 md:tw-grid-cols-4 xl:tw-grid-cols-4 [&>div]:tw-h-full">
        {fans.map((f) => (
          <FanTile key={f.id} {...f} />
        ))}
      </div>
    </section>
  );
}
