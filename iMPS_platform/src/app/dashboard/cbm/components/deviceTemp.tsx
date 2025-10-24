"use client";

import React, { useMemo } from "react";
import { Typography } from "@material-tailwind/react";
import CircleProgress from "@/app/dashboard/cbm/components/CircleProgress";

type Device = {
  id: string;
  name: "EdgeBox" | "Raspberry Pi" | "Router" | string;
  temp: number;     // °C
  target?: number;  // เกณฑ์ < อุณหภูมิ
};

type Props = {
  title?: string;
  updatedAt?: string;
  devices: Device[];
};

/* ---------- utils ---------- */
function statusColor(temp: number) {
  if (temp > 65)
    return { ring: "tw-text-red-500", badge: "tw-bg-red-50 tw-text-red-700 tw-ring-1 tw-ring-red-100", label: "Hot" };
  if (temp >= 45)
    return { ring: "tw-text-amber-500", badge: "tw-bg-amber-50 tw-text-amber-700 tw-ring-1 tw-ring-amber-100", label: "Warm" };
  return { ring: "tw-text-green-500", badge: "tw-bg-green-50 tw-text-green-700 tw-ring-1 tw-ring-green-100", label: "Normal" };
}

const Icon = ({ name }: { name: string }) => {
  const n = name.toLowerCase();
  if (n.includes("edge")) return <i className="fa-solid fa-square-terminal" />;
  if (n.includes("pi")) return <i className="fa-brands fa-raspberry-pi" />;
  if (n.includes("router")) return <i className="fa-solid fa-wifi" />;
  return <i className="fa-solid fa-microchip" />;
};

/* ---------- mini card ---------- */
function DeviceTile({ name, temp, target = 60 }: { name: string; temp: number; target?: number }) {
  const tone = statusColor(temp);

  return (
    <div className="tw-flex tw-flex-col tw-items-stretch tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-px-4 tw-pt-3 tw-pb-4">
      {/* header */}
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
        <div className="tw-flex tw-items-center tw-gap-2">
          <span className="tw-grid tw-place-items-center tw-w-8 tw-h-8 tw-rounded-md tw-border tw-border-blue-gray-200 tw-text-blue-gray-600">
            <Icon name={name} />
          </span>
          <span className="tw-font-medium tw-text-blue-gray-800">{name}</span>
        </div>
        <span className={`tw-text-[11px] tw-rounded-full tw-px-2 tw-py-[2px] ${tone.badge}`}>{tone.label}</span>
      </div>

      {/* ring */}
      <div className="tw-flex tw-justify-center tw-my-2">
        <CircleProgress
          value={`${temp}°`}
          progress={Math.max(0, Math.min(100, temp))}
          size={92}
          stroke={10}
          colorClass={tone.ring}
          valueClassName="tw-text-xl tw-font-semibold tw-text-blue-gray-900"
        />
      </div>

      {/* footer */}
      <div className="tw-mt-2 tw-flex tw-flex-col tw-items-center">
        <div className="tw-text-2xl tw-font-semibold tw-text-blue-gray-900">{temp}°C</div>
        <div className="tw-text-xs tw-text-blue-gray-500">Target &lt; {target}°C</div>
      </div>
    </div>
  );
}

/* ---------- main (no outer Card) ---------- */
export default function DeviceTempsStrip({
  title = "Edge/PI/Router Temperatures",
  updatedAt,
  devices,
}: Props) {
  const list = useMemo(() => devices.slice(0, 3), [devices]);

  return (
    <section className="tw-w-full">
      {/* header บาง ๆ แทน CardHeader */}
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
        <Typography variant="h6" color="blue-gray" className="tw-leading-tight">
          {title}
        </Typography>
        {updatedAt && <span className="tw-text-xs tw-text-blue-gray-500">Updated {updatedAt}</span>}
      </div>

      {/* grid mini-cards */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4">
        {list.map((d) => (
          <DeviceTile
            key={d.id}
            name={d.name}
            temp={d.temp}
            target={d.target ?? (d.name.toLowerCase().includes("router") ? 70 : 60)}
          />
        ))}
      </div>
    </section>
  );
}
