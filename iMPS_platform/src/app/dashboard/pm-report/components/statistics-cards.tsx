"use client";

import React from "react";
import { Typography } from "@material-tailwind/react";
import {
  WrenchScrewdriverIcon,
  CpuChipIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/solid";
import { data_pmReport } from "@/data";

type CardItem = {
  title: string;
  value: string;
  icon: React.ElementType;
  footer: { color: string; value: string; label: string };
};

const shorten = (s: string, max = 22) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

// การ์ดสไตล์เดียวกับภาพตัวอย่าง
function StatCardClassic({ item }: { item: CardItem }) {
  const Icon = item.icon;

  return (
    <div className="tw-rounded-2xl tw-bg-white tw-border tw-border-blue-gray-100 tw-shadow-sm tw-overflow-hidden tw-h-full">
      {/* ส่วนหัว */}
      <div className="tw-flex tw-items-start tw-gap-4 tw-p-5">
        <div className="tw-flex tw-items-center tw-justify-center tw-w-12 tw-h-12 tw-rounded-xl tw-bg-blue-gray-900/90">
          <Icon className="tw-w-6 tw-h-6 tw-text-white" />
        </div>

        <div className="tw-flex-1 tw-min-w-0">
          <div className="tw-text-right">
            <p className="tw-text-sm tw-font-medium tw-text-blue-gray-600 tw-leading-none">
              {item.title}
            </p>
            <p
              className="tw-text-xl tw-font-extrabold tw-text-blue-gray-900 tw-mt-2 tw-truncate"
              title={item.value}
            >
              {item.value}
            </p>
          </div>
        </div>
      </div>

      {/* เส้นคั่น */}
      <div className="tw-border-t tw-border-blue-gray-100" />

      {/* ฟุตเตอร์ */}
      <div className="tw-px-5 tw-py-4">
        <p className="tw-text-blue-gray-700">
          <span className="tw-font-semibold tw-text-green-600">{item.footer.value}</span>
          &nbsp;{item.footer.label}
        </p>
      </div>
    </div>
  );
}


export default function StatisticsCards() {
  const cards: CardItem[] = [
    {
      title: "PLC Firmware",
      value: shorten(data_pmReport.firmware.plc),
      icon: data_pmReport.icons?.firmware ?? WrenchScrewdriverIcon,
      footer: { color: "tw-text-green-600", value: "+OK", label: "เวอร์ชันล่าสุด" },
    },
    {
      title: "Raspberry Pi Firmware",
      value: shorten(data_pmReport.firmware.rpi),
      icon: CpuChipIcon,
      footer: { color: "tw-text-green-600", value: "+OK", label: "เวอร์ชันล่าสุด" },
    },
    {
      title: "Router Firmware",
      value: shorten(data_pmReport.firmware.router),
      icon: data_pmReport.icons?.firmware ?? WrenchScrewdriverIcon,
      footer: { color: "tw-text-green-600", value: "+OK", label: "เวอร์ชันล่าสุด" },
    },
    {
      title: "PM Schedule",
      value: `ถัดไป: ${data_pmReport.pm.next}`,
      icon: data_pmReport.icons?.date ?? CalendarDaysIcon,
      footer: { color: "tw-text-blue-700", value: "Just updated", label: data_pmReport.pm.latest },
    },
  ];

  return (
    <>
      {/* กริด 4 คอลัมน์ตามตัวอย่าง: mobile=1, sm=2, xl=4 */}
      <div className="tw-mt-8 tw-mb-4 tw-grid tw-gap-6 tw-min-w-0 tw-grid-cols-1 sm:tw-grid-cols-2 xl:tw-grid-cols-4">
        {cards.map((c) => (
          <div key={c.title} className="tw-min-w-0 tw-h-full">
            <StatCardClassic item={c} />
          </div>
        ))}
      </div>
    </>
  );
}



