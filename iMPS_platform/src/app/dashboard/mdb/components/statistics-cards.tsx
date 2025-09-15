"use client";

import React, { useEffect, useState } from "react";
import { StatisticsCard } from "@/widgets/cards";

type Props = {
  tempc: number | string;
  humidity: number | string;
  fanOn: boolean;
  rssiDb: number | string;
  signalLevel?: 0 | 1 | 2 | 3 | 4;
};

export default function StatisticsCards({
  tempc,
  humidity,
  fanOn,
  rssiDb,
  signalLevel = 3,
}: Props) {
  const [randomRssi, setRandomRssi] = useState<number>(Number(rssiDb));

  useEffect(() => {
    const interval = setInterval(() => {
      // สุ่มการเพิ่มหรือลดค่า rssiDb อย่างค่อยเป็นค่อยไป
      const change = Math.floor(Math.random() * 3) - 1; // -1, 0, หรือ 1 (สุ่มเปลี่ยนแค่เล็กน้อย)
      
      // คำนวณค่าใหม่ที่ไม่เกินช่วง -30 ถึง -70
      const newRssiDb = Math.max(-70, Math.min(-30, randomRssi + change));
      
      setRandomRssi(newRssiDb);
    }, 2000); // ทุก 2 วินาทีจะมีการสุ่มใหม่

    return () => clearInterval(interval); // เมื่อคอมโพเนนต์ถูก unmount จะหยุดการสุ่ม
  }, [randomRssi]);

  const cards = [
    {
      icon: <i className="fas fa-temperature-low tw-w-6 tw-h-6 tw-text-white tw-text-center tw-mt-2" />,
      title: "Temp.",
      value: (
        <span className="tw-flex tw-items-baseline tw-gap-1">
          <span className="tw-text-xl tw-font-semibold">{tempc}</span>
          <span className="tw-text-sm tw-text-blue-gray-500">°C</span>
        </span>
      ),
      footerJSX: null,
    },
    {
      icon: <i className="fas fa-cloud-rain tw-w-6 tw-h-6 tw-text-white tw-text-center tw-mt-2" />,
      title: "Humidity",
      value: (
        <span className="tw-flex tw-items-baseline tw-gap-1 tw-justify-end">
          <span className="tw-text-xl tw-font-semibold">{humidity}</span>
          <span className="tw-text-sm tw-text-blue-gray-500">%</span>
        </span>
      ),
      footerJSX: null,
    },
    {
      icon: <i className="fas fa-fan tw-w-6 tw-h-6 tw-text-white tw-text-center tw-mt-2" />,
      title: "FAN",
      value: (
        <span className={`tw-font-semibold ${fanOn ? "tw-text-green-600" : "tw-text-blue-gray-400"}`}>
          {fanOn ? "ON" : "OFF"}
        </span>
      ),
      footerJSX: null,
    },
    {
      icon: <i className="fas fa-wifi tw-w-6 tw-h-6 tw-text-white tw-text-center tw-mt-2" />,
      title: "Data",
      value: (
        <span className="tw-flex tw-items-baseline tw-gap-1">
          <span className="tw-text-xl tw-font-semibold">{randomRssi}</span>
          <span className="tw-text-sm tw-text-blue-gray-500">db</span>
        </span>
      ),
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
          icon={icon}
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
          className={`tw-w-1 tw-rounded-sm ${i < level ? "tw-bg-green-500" : "tw-bg-blue-gray-100"}`}
          style={{ height: (i + 1) * 6 }}
        />
      ))}
    </div>
  );
}
