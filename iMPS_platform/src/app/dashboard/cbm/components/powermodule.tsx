"use client";

import React from "react";
import { Typography } from "@material-tailwind/react";
import CircleProgress from "@/app/dashboard/cbm/components/CircleProgress";

/* ---------- types ---------- */
type Item = {
  id: string;
  name: string;   // e.g. "Power module 1 Temperature"
  temp: number;   // °C
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
      ring: "tw-text-red-500",
      badge: "tw-bg-red-50 tw-text-red-700 tw-ring-1 tw-ring-red-100",
      label: "Hot",
    };
  if (temp >= 45)
    return {
      ring: "tw-text-amber-500",
      badge: "tw-bg-amber-50 tw-text-amber-700 tw-ring-1 tw-ring-amber-100",
      label: "Warm",
    };
  return {
    ring: "tw-text-green-500",
    badge: "tw-bg-green-50 tw-text-green-700 tw-ring-1 tw-ring-green-100",
    label: "Normal",
  };
}

/* ---------- tiny tile inside the big card ---------- */
function TempTile({ name, temp, target = 60 }: { name: string; temp: number; target?: number }) {
  const tone = statusColor(temp);

  return (
    <div className="tw-flex tw-flex-col tw-gap-2 tw-rounded-lg tw-border tw-border-blue-gray-50 tw-p-3 tw-bg-white">
      {/* ชื่อ */}
      <div className="tw-flex tw-items-start tw-justify-between tw-w-full">
        <span className="tw-text-xs tw-font-medium tw-text-blue-gray-800 tw-truncate" title={name}>
          {name}
        </span>
      </div>

      {/* ซ้าย = ตัวเลข/เป้าหมาย/ป้ายสถานะ | ขวา = วงแหวน (ซ่อนตัวเลขในวง) */}
      <div className="tw-flex tw-items-center tw-justify-between tw-gap-4">
        {/* left */}
        <div className="tw-flex tw-flex-col tw-items-start">
          <div className="tw-text-2xl tw-font-semibold tw-text-blue-gray-900 tw-leading-none">
            {temp}°C
          </div>
          <div className="tw-mt-1 tw-text-[11px] tw-text-blue-gray-500">
            Target &lt; {target}°C
          </div>
          <span className={`tw-mt-2 tw-inline-block tw-text-[10px] tw-rounded-full tw-px-2 tw-py-[2px] ${tone.badge}`}>
            {tone.label}
          </span>
        </div>

        {/* right (hide value text inside the ring) */}
        <div className="tw-shrink-0">
          <CircleProgress
            value=""                        // ไม่ส่งตัวเลขเข้าไป
            progress={Math.max(0, Math.min(100, temp))}
            size={72}
            stroke={8}
            colorClass={tone.ring}
            valueClassName="tw-hidden"      // กันเผื่อ component ใส่ค่า default
          />
        </div>
      </div>
    </div>
  );
}



/* ---------- ONE big card that contains all temps ---------- */
export default function PowerModulesCard({
  title = "Power Modules Temperature",
  updatedAt,
  items,
}: Props) {
  return (
    <section className="tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
        <Typography variant="h6" color="blue-gray" className="tw-leading-tight">
          {title}
        </Typography>
        {updatedAt && <span className="tw-text-xs tw-text-blue-gray-500">Updated {updatedAt}</span>}
      </div>

      {/* ⬇️ ปรับกริดให้ไม่แผ่ยาวแถวเดียว */}
      <div className="tw-grid tw-gap-3 tw-grid-cols-2 md:tw-grid-cols-3 xl:tw-grid-cols-3">
        {items.map((it) => (
          <TempTile key={it.id} name={it.name} temp={it.temp} target={it.target ?? 60} />
        ))}
      </div>
    </section>
  );
}
