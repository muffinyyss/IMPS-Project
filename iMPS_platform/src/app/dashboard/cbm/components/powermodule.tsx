"use client";

import React from "react";
import { Typography } from "@material-tailwind/react";

/* ---------- types ---------- */
type Item = {
  id: string;
  name: string;
  temp: number;
  target?: number;
};

type Props = {
  title?: string;
  updatedAt?: string;
  items: Item[];
};

/* ---------- utils ---------- */
function statusColor(temp: number) {
  if (temp > 65)
    return {
      bar: "tw-bg-red-500",
      chip: "tw-bg-red-50 tw-text-red-700 tw-ring-1 tw-ring-red-100",
      dot: "tw-bg-red-500",
      label: "Hot",
    };
  if (temp >= 45)
    return {
      bar: "tw-bg-amber-500",
      chip: "tw-bg-amber-50 tw-text-amber-700 tw-ring-1 tw-ring-amber-100",
      dot: "tw-bg-amber-500",
      label: "Warm",
    };
  return {
    bar: "tw-bg-green-500",
    chip: "tw-bg-green-50 tw-text-green-700 tw-ring-1 tw-ring-green-100",
    dot: "tw-bg-green-500",
    label: "Normal",
  };
}

function clampPct(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function calcPct(temp: number, target: number) {
  if (!target || target <= 0) return 0;
  return clampPct((temp / target) * 100);
}

/* ---------- tile ---------- */
function TempTile({ name, temp, target = 60 }: { name: string; temp: number; target?: number }) {
  const tone = statusColor(temp);
  const pct = calcPct(temp, target);

  return (
    <div
      className="
        tw-flex tw-flex-col tw-gap-2 tw-rounded-xl tw-border tw-border-blue-gray-50 tw-p-3 tw-bg-white
        tw-shadow-[0_1px_0_0_rgba(16,24,40,0.02)]
      "
      data-testid="power-temp-tile"
    >
      <div className="tw-flex tw-items-start tw-justify-between tw-w-full">
        <span className="tw-text-xs tw-font-semibold tw-text-blue-gray-800 tw-truncate" title={name}>
          {name}
        </span>
      </div>

      <div className="tw-mt-1">
        <div className="tw-text-[26px] tw-leading-none tw-font-semibold tw-text-blue-gray-900">
          {temp}
          <span className="tw-text-sm tw-font-normal tw-text-blue-gray-500"> °C</span>
        </div>
        <div className="tw-text-[11px] tw-text-blue-gray-400 tw-mt-1">
          Target &lt; {target}°C
        </div>
      </div>

      <div className="tw-mt-2">
        <div
          className="tw-h-2.5 tw-w-full tw-rounded-full tw-bg-blue-gray-50 tw-overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={`${name} ${temp}°C`}
          title={`${pct}% of target`}
        >
          <div
            className={`tw-h-full ${tone.bar} tw-rounded-full tw-transition-[width] tw-duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="tw-flex tw-items-center tw-justify-between tw-mt-1.5">
          <div className="tw-flex tw-items-center tw-gap-1.5">
            <span className={`tw-inline-block tw-h-2 tw-w-2 tw-rounded-full ${tone.dot}`} />
            <span className="tw-text-[11px] tw-text-blue-gray-600">{pct}%</span>
          </div>
          <span className={`tw-text-[10px] tw-mt-2 tw-rounded-full tw-px-2 tw-py-[3px] ${tone.chip}`}>
            {tone.label}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------- dynamic grid cols ---------- */
function getGridCols(count: number): string {
  switch (count) {
    case 1: return "tw-grid-cols-1";
    case 2: return "tw-grid-cols-2";
    case 3: return "tw-grid-cols-3";
    case 4: return "tw-grid-cols-2";  // 2x2
    case 5: return "tw-grid-cols-3";  // 3+2
    case 6: return "tw-grid-cols-3";  // 3x2
    default: return "tw-grid-cols-3";
  }
}

/* ---------- Card ---------- */
export default function PowerModulesCard({
  title = "Power Modules Temperature",
  updatedAt,
  items,
}: Props) {
  const gridCols = getGridCols(items.length);

  return (
    <section className="tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4 tw-h-full">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
        <Typography variant="h6" color="blue-gray" className="tw-leading-tight">
          {title}
        </Typography>
        {updatedAt && (
          <span className="tw-text-xs tw-text-blue-gray-500">Updated {updatedAt}</span>
        )}
      </div>

      {/* grid ยืดหยุ่นตามจำนวน items */}
      <div className={`tw-grid tw-gap-3 ${gridCols} [&>div]:tw-h-full`}>
        {items.length === 0 ? (
          <div className="tw-col-span-full tw-text-center tw-text-sm tw-text-blue-gray-400 tw-py-6">
            No power module data
          </div>
        ) : (
          items.map((it) => (
            <TempTile key={it.id} name={it.name} temp={it.temp} target={it.target ?? 60} />
          ))
        )}
      </div>
    </section>
  );
}