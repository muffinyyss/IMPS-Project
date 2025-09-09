"use client";

import React from "react";
import { Typography } from "@material-tailwind/react";
import { StatisticsCard } from "@/widgets/cards";
import { Fan } from "@phosphor-icons/react";


// heroicons
import { SunIcon, SignalIcon } from "@heroicons/react/24/solid";
import { CpuChipIcon } from "@heroicons/react/24/outline";

type Props = {
  tempC: number | string;
  humidity: number | string;
  fanOn: boolean;
  rssiDb: number | string;
  signalLevel?: 0 | 1 | 2 | 3 | 4;
};

export default function StatisticsCards({
  tempC,
  humidity,
  fanOn,
  rssiDb,
  signalLevel = 3,
}: Props) {
  const cards = [
    {
      icon: SunIcon,
      title: "Temp.",
      value: (
        <span className="tw-flex tw-items-baseline tw-gap-1">
          <span className="tw-text-xl tw-font-semibold">{tempC}</span>
          <span className="tw-text-sm tw-text-blue-gray-500">°C</span>
        </span>
      ),
      footerJSX: null,
    },
    {
      icon: CpuChipIcon,
      title: "Humidity",
      value: (
        <span className="tw-flex tw-items-baseline tw-gap-1">
          <span className="tw-text-xl tw-font-semibold">{humidity}</span>
          <span className="tw-text-sm tw-text-blue-gray-500">%</span>
        </span>
      ),
      footerJSX: null,
    },
    {
      icon: () => (
        <span className="tw-inline-block tw-h-2.5 tw-w-2.5 tw-rounded-full tw-bg-green-500" />
      ),
      icon: Fan,
      title: "FAN",
      value: (
        <span
          className={`tw-font-semibold ${fanOn ? "tw-text-green-600" : "tw-text-blue-gray-400"
            }`}
        >
          {fanOn ? "ON" : "OFF"}
        </span>
      ),
      footerJSX: null,
    },
    {
      icon: SignalIcon,
      title: "Data",
      value: (
        <span className="tw-flex tw-items-baseline tw-gap-1">
          <span className="tw-text-xl tw-font-semibold">{rssiDb}</span>
          <span className="tw-text-sm tw-text-blue-gray-500">db</span>
        </span>
      ),
      footerJSX: <SignalBars level={signalLevel} />,
    },
  ];

  return (
    <div className="tw-my-6 tw-grid tw-gap-6 md:tw-grid-cols-2 xl:tw-grid-cols-4">
      {cards.map(({ icon, title, value, footerJSX }, idx) => (
        <StatisticsCard
          key={title + idx}
          title={title}
          value={value as any}
          color={"gray" as any}
          icon={React.createElement(icon as any, {
            className: "tw-w-6 tw-h-6 tw-text-white",
          })}
          footer={footerJSX}
        />
      ))}
    </div>
  );
}

/* ------- สัญญาณแท่ง ------- */
function SignalBars({ level = 0 }: { level?: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <div className="tw-flex tw-items-end tw-justify-end tw-gap-0.5">
      {[1, 2, 3, 4].map((b, i) => (
        <div
          key={b}
          className={`tw-w-1 tw-rounded-sm ${i < level ? "tw-bg-green-500" : "tw-bg-blue-gray-100"
            }`}
          style={{ height: (i + 1) * 6 }}
        />
      ))}
    </div>
  );
}
