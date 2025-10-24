"use client";

import React, { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Tooltip, Typography } from "@material-tailwind/react";
import CircleProgress from "@/app/dashboard/cbm/components/CircleProgress";

type Props = {
  enabledDefault?: boolean;
  temp?: number;      // 0–100 °C
  humidity?: number;  // 0–100 %RH
  title?: string;
};

export default function ChargerEnvCard({
  enabledDefault = true,
  temp = 35,
  humidity = 42,
  title = "Charger Environment",
}: Props) {
  const [enabled, setEnabled] = useState(enabledDefault);

  const t = Math.max(0, Math.min(100, temp));
  const h = Math.max(0, Math.min(100, humidity));

  // สีวงแหวนอุณหภูมิ
  const tempRing = useMemo(() => {
    if (!enabled) return "tw-text-blue-gray-300";
    if (t >= 70) return "tw-text-red-500";
    if (t >= 45) return "tw-text-amber-500";
    return "tw-text-green-500";
  }, [t, enabled]);

  return (
    <Card className="tw-rounded-xl tw-border tw-border-blue-gray-100 tw-shadow-sm tw-transition-shadow" >
      {/* Header กระชับ */}
      <CardHeader
        floated={false}
        shadow={false}
        className="tw-flex tw-items-center tw-justify-between !tw-px-2 !tw-pt-1 !tw-pb-2"
      >
        <Typography variant="h6" color="blue-gray" className="tw-leading-tight">
          {title}
        </Typography>

        <div className="tw-flex tw-items-center tw-gap-2">
          {/* ไอคอนค่าแบบย่อ */}
          <Tooltip content={`${t}°C`} placement="left">
            <span
              className={`tw-grid tw-place-items-center tw-w-8 tw-h-8 tw-rounded-md tw-border tw-bg-white
                ${enabled ? "tw-border-red-200 tw-text-red-500" : "tw-border-blue-gray-200 tw-text-blue-gray-500"}
                tw-shadow-sm tw-cursor-pointer`}
              onClick={() => setEnabled(v => !v)}
              role="button"
              tabIndex={0}
            >
              <i className="fa-solid fa-temperature-three-quarters" />
            </span>
          </Tooltip>
          <Tooltip content={`${h}% RH`} placement="left">
            <span
              className={`tw-grid tw-place-items-center tw-w-8 tw-h-8 tw-rounded-md tw-border tw-bg-white
                ${enabled ? "tw-border-sky-300 tw-text-sky-600" : "tw-border-blue-gray-200 tw-text-blue-gray-500"}
                tw-shadow-sm`}
            >
              <i className="fa-solid fa-cloud-rain" />
            </span>
          </Tooltip>
        </div>
      </CardHeader>

      {/* Body: 2 บล็อก + เส้นคั่น */}
      <CardBody className="!tw-pt-1 !tw-pb-4 !tw-px-7">
        {/* BLOCK 1: Temperature */}
        <div className="tw-flex tw-items-center tw-gap-4">
          <CircleProgress
            value={`${t}°`}
            progress={t}
            size={110}
            stroke={12}
            colorClass={tempRing}
            valueClassName="tw-text-2xl tw-font-semibold tw-text-blue-gray-900"
          />
          <div className="tw-flex tw-flex-col tw-gap-1">
            <div className="tw-flex tw-items-center tw-gap-2">
              <i className="fa-solid fa-temperature-three-quarters tw-text-red-500" />
              <span className="tw-text-sm tw-text-blue-gray-600">Temperature</span>
            </div>
            <div className="tw-text-lg tw-font-semibold tw-text-blue-gray-900">{t}°C</div>
            <div className="tw-text-xs tw-text-blue-gray-500">Target &lt; 45°C</div>
          </div>
        </div>

        {/* Divider */}
        <hr className="tw-my-4 tw-border-blue-gray-100" />

        {/* BLOCK 2: Humidity */}
        <div className="tw-flex tw-flex-col tw-gap-2">
          <div className="tw-flex tw-items-center tw-justify-between">
            <div className="tw-flex tw-items-center tw-gap-2">
              <i className="fa-solid fa-cloud-rain tw-text-sky-600" />
              <span className="tw-text-sm tw-text-blue-gray-600">Relative Humidity</span>
            </div>
            <span className="tw-text-lg tw-font-semibold tw-text-blue-gray-900">{h}% RH</span>
          </div>

          {/* TRACK */}
          <div className="tw-relative tw-h-4 tw-w-full tw-rounded-full tw-bg-blue-gray-100 tw-overflow-hidden">
            {/* BAR — ขยายให้ซ้อนใต้ปุ่มครึ่งหนึ่งของขนาดปุ่ม */}
            <div
              className={`tw-h-full tw-rounded-full ${enabled ? "tw-bg-blue-500" : "tw-bg-blue-500 tw-opacity-50"} tw-transition-[width] tw-duration-700 tw-ease-out`}
              style={{
                width: `calc(${h}% + 12px)`,  // << ครึ่งหนึ่งของขนาดปุ่ม (ด้านล่างใช้ w-6 = 24px ⇒ ครึ่ง = 12px)
                maxWidth: "100%",
              }}
            />

            {/* HANDLE — วงกลมของหยดน้ำ */}
            <div
              className="tw-absolute tw-top-1/2 -tw-translate-y-1/2 -tw-translate-x-1/2
               tw-grid tw-place-items-center tw-w-6 tw-h-6 tw-rounded-full tw-bg-white tw-shadow-md tw-pointer-events-none"
              style={{ left: `${h}%` }}
              aria-hidden
            >
              <i className="fa-solid fa-droplet tw-text-blue-600 tw-text-[12px]" />  {/* ขยายไอคอนนิดหน่อย */}
            </div>
          </div>

          <div className="tw-text-xs tw-text-blue-gray-500">
            Recommended 40–60% RH • Current {h}% RH
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
