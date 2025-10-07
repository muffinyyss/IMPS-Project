"use client";
import React from "react";

// @material-tailwind/react
import { Card, CardBody, CardHeader, Switch, Typography } from "@material-tailwind/react";

// components
import CircleProgress from "./CircleProgress";

type AiItem = {
  id: string;
  title: string;
  iconClass: string;        // <-- ใช้ class ของ <i>
  defaultEnabled?: boolean;
  progress?: number;        // 0-100
};

const AI_ITEMS: AiItem[] = [
  {
    id: "mdb_filters",
    title: "MDB Dust Filters Prediction",
    iconClass: "fa-solid fa-filter",
    defaultEnabled: false,
    progress: 20,
  },
  {
    id: "charger_filters",
    title: "Charger Dust Filters Prediction",
    iconClass: "fa-solid fa-charging-station", // หรือ fa-microchip
    defaultEnabled: false,
    progress: 43,
  },
  {
    id: "on_off",
    title: "Online / Offline Prediction",
    iconClass: "fa-solid fa-wifi",
    defaultEnabled: false,
    progress: 58,
  },
  {
    id: "abnormal_powersupply",
    title: "AB Normal Power Supply Prediction",
    iconClass: "fa-solid fa-bolt",
    defaultEnabled: false,
    progress: 36,
  },
  {
    id: "network",
    title: "Network Prediction",
    iconClass: "fa-solid fa-signal",
    defaultEnabled: false,
    progress: 64,
  },
  {
    id: "rul",
    title: "The Remainning Useful Life (RUL) Prediction",
    iconClass: "fa-regular fa-clock",
    defaultEnabled: false,
    progress: 43,
  },
];

/* -------- Reusable card for each AI topic -------- */
function AiItemCard({ item }: { item: AiItem }) {
  const [enabled, setEnabled] = React.useState(!!item.defaultEnabled);

  return (
    <Card
      variant="gradient"
      className={`tw-flex tw-h-full tw-flex-col tw-justify-between tw-border tw-shadow-sm
        ${enabled ? "!tw-bg-gray-800 !tw-text-white" : "!tw-bg-white"}`}
    >
      <CardHeader floated={false} shadow={false} color="transparent" className="tw-overflow-visible tw-rounded-none">
        <div className="tw-flex tw-items-center tw-justify-between">
          <div className="tw-flex tw-items-center tw-gap-3">
            {/* ใช้ <i> ของ Font Awesome */}
            <i
              className={`fa-fw ${item.iconClass} tw-text-xl ${enabled ? "tw-text-white" : "tw-text-gray-800"
                }`}
              aria-hidden="true"
            />
            <div>
              <Typography
                variant="h6"
                className={`tw-leading-none tw-transition-colors ${enabled ? "tw-text-white" : "tw-text-gray-900"
                  }`}
              >
                {item.title}
              </Typography>
              <Typography
                className={`!tw-text-xs !tw-font-normal tw-transition-colors ${enabled ? "tw-text-white/80" : "!tw-text-blue-gray-500"
                  }`}
              >
                {enabled ? "Enabled" : "Disabled"}
              </Typography>
            </div>
          </div>

          <div className="tw-flex tw-items-center tw-gap-2">
            <Typography
              className={`!tw-text-sm tw-hidden sm:tw-block ${enabled ? "tw-text-white/90" : "!tw-text-blue-gray-500"
                }`}
            >
              {enabled ? "On" : "Off"}
            </Typography>
            <Switch
              checked={enabled}
              onChange={() => setEnabled((c) => !c)}
              color={enabled ? "blue-gray" : "blue"}
              crossOrigin={undefined}
              aria-label={`Enable ${item.title}`}
            />
          </div>
        </div>
      </CardHeader>

      <CardBody className="tw-p-4">
        <div className={enabled ? "" : "tw-opacity-50"}>
          <div className="tw-mx-auto tw-max-w-[220px] tw-w-full">
            <CircleProgress
              label="Health Index"
              value={item.progress ?? 0}
              colorClass={enabled ? undefined : "tw-text-blue-gray-400"}
              valueClassName={enabled ? "tw-text-white" : "tw-text-blue-gray-900"}
              labelClassName={enabled ? "tw-text-white/80" : "tw-text-blue-gray-600"}
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/* -------- Section renders 6 cards -------- */
export default function AiSection() {
  return (
    <section className="tw-space-y-4">
      <div className="tw-w-full tw-grid tw-gap-6 tw-grid-cols-1 md:!tw-grid-cols-3">
        {AI_ITEMS.map((item) => (
          <div key={item.id} className="tw-h-full">
            <AiItemCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}
