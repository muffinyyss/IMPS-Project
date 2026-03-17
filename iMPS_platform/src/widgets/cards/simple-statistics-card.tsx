// "use client";

// import React from "react";
// import { Card, Typography } from "@material-tailwind/react";

// export type ItemRow = {
//   title: string;
//   value: string | number;
//   unit?: string;
// };

// export function InfoCard({ title, value, unit }: ItemRow) {
//   return (
//     <Card className="tw-border tw-border-gray-200 tw-bg-white tw-shadow-md hover:tw-shadow-lg tw-transition tw-rounded-lg">
//       <div className="tw-flex tw-flex-col tw-p-4">
//         <Typography
//           variant="small"
//           className="tw-mb-1 tw-text-gray-500 tw-font-medium"
//         >
//           {title}
//         </Typography>
//         <Typography
//           variant="h5"
//           color="blue-gray"
//           className="tw-font-bold tw-text-lg"
//         >
//           {value} {unit ? unit : ""}
//         </Typography>
//       </div>
//     </Card>
//   );
// }

// export default InfoCard;


"use client";

import React, { useMemo } from "react";
import { Card, Typography, Button, Slider } from "@material-tailwind/react";
import { chargerSettingData } from "@/data";

// ตัวช่วยหา section / item ตามชื่อ
function useChargerData() {
  const secMap = useMemo(() => {
    const m = new Map<string, { title: string; value: string | number; unit?: string }[]>();
    chargerSettingData.forEach((s: any) => m.set(s.section, s.items));
    return m;
  }, []);

  const get = (section: string, title: string) => {
    const items = secMap.get(section);
    return items?.find((i) => i.title === title);
  };

  // คืนค่าเป็น string พร้อมหน่วย
  const display = (section: string, title: string) => {
    const it = get(section, title);
    if (!it) return "-";
    return `${it.value}${it.unit ? ` ${it.unit}` : ""}`;
  };

  // คืน Numeric (เช่นเอาไปใส่ใน Slider)
  const numeric = (section: string, title: string) => {
    const it = get(section, title);
    if (!it) return 0;
    const n = typeof it.value === "number" ? it.value : parseFloat(String(it.value));
    return Number.isFinite(n) ? n : 0;
  };

  const raw = get;

  return { display, numeric, raw };
}

export default function ChargerSetting() {
  const { display, numeric, raw } = useChargerData();

  const chargeBoxId = display("Charge Box", "Charger Box ID");

  const dynMaxCurrent = raw("Control", "Dynamic Max Current");
  const dynMaxPower = raw("Control", "Dynamic Max Power");
  const chargingStatus = display("Control", "Charging Status");

  const evFields = [
    "CP State1",
    "CP State2",
    "Target Voltage 1",
    "Target Voltage 2",
    "Target Current 1",
    "Target Current 2",
    "SoC1",
    "SoC2",
  ];

  const pmFields = [
    "Measured Voltage 1",
    "Measured Voltage 2",
    "Max Voltage 1",
    "Max Voltage 2",
    "Measured Current 1",
    "Measured Current 2",
    "Max Current 1",
    "Max Current 2",
    "Power 1",
    "Power 2",
    "Max Power 1",
    "Max Power 2",
  ];

  const infoFields = [
    "IMD Status1",
    "IMD Status2",
    "PM Status1",
    "PM Status2",
    "Isolation Status1",
    "Isolation Status2",
  ];

  return (
    <div className="tw-space-y-6">
      {/* Title */}
      <Typography variant="h4" className="tw-font-semibold">
        Charger Setting
      </Typography>

      {/* Charge Box */}
      <Card className="tw-p-4 tw-shadow-md tw-rounded-lg">
        <Typography variant="h6">Charge Box ID :</Typography>
        <Typography variant="h5" className="tw-font-bold">
          {chargeBoxId}
        </Typography>
      </Card>

      {/* Control */}
      <Card className="tw-p-4 tw-shadow-md tw-rounded-lg tw-space-y-4">
        <Typography variant="h6" className="tw-mb-2">
          Control
        </Typography>

        <div>
          <Typography variant="small" className="tw-mb-1">
            Dynamic Max Current :
          </Typography>
          <Slider
            value={numeric("Control", "Dynamic Max Current")}
            min={0}
            max={500}
            onChange={() => { }}
            className="[&>*]:tw-pointer-events-none" // ทำให้เป็น read-only look
          />
          <Typography className="tw-mt-1 tw-text-sm tw-text-gray-600">
            {display("Control", "Dynamic Max Current")}
          </Typography>
        </div>

        <div>
          <Typography variant="small" className="tw-mb-1">
            Dynamic Max Power :
          </Typography>
          <Slider
            value={numeric("Control", "Dynamic Max Power")}
            min={0}
            max={400}
            onChange={() => { }}
            className="[&>*]:tw-pointer-events-none"
          />
          <Typography className="tw-mt-1 tw-text-sm tw-text-gray-600">
            {display("Control", "Dynamic Max Power")}
          </Typography>
        </div>

        <div className="tw-flex tw-gap-4 tw-mt-2">
          <Button color="red" className="tw-flex-1" disabled>
            ⏹ STOP CHARGING
          </Button>
          <Button color="green" className="tw-flex-1" disabled>
            ▶ START CHARGING
          </Button>
        </div>
        <Typography className="tw-text-sm tw-text-gray-700">
          Charging Status:{" "}
          <span
            className={
              chargingStatus === "Idle"
                ? "tw-text-gray-800 tw-font-semibold"
                : "tw-text-green-600 tw-font-semibold"
            }
          >
            {chargingStatus}
          </span>
        </Typography>
      </Card>

      {/* EV */}
      <Card className="tw-p-4 tw-shadow-md tw-rounded-lg">
        <Typography variant="h6" className="tw-mb-4">
          EV
        </Typography>
        <div className="tw-grid md:tw-grid-cols-2 tw-gap-4">
          {evFields.map((label) => (
            <div key={label}>
              <Typography>{label}</Typography>
              <Typography className="tw-font-bold">
                {display("EV", label)}
              </Typography>
            </div>
          ))}
        </div>
      </Card>

      {/* Power Module */}
      <Card className="tw-p-4 tw-shadow-md tw-rounded-lg">
        <Typography variant="h6" className="tw-mb-4">
          Power Module
        </Typography>
        <div className="tw-grid md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-4">
          {pmFields.map((label) => (
            <div key={label}>
              <Typography>{label}</Typography>
              <Typography className="tw-font-bold">
                {display("Power Module", label)}
              </Typography>
            </div>
          ))}
        </div>
      </Card>

      {/* Info */}
      <Card className="tw-p-4 tw-shadow-md tw-rounded-lg">
        <Typography variant="h6" className="tw-mb-4">
          Info
        </Typography>
        <div className="tw-grid md:tw-grid-cols-2 tw-gap-4">
          {infoFields.map((label) => {
            const val = String(display("Info", label));
            const colorClass =
              val.toLowerCase() === "fault"
                ? "tw-text-red-500"
                : val.toLowerCase() === "operative"
                  ? "tw-text-green-600"
                  : "";
            return (
              <div key={label}>
                <Typography>{label}</Typography>
                <Typography className={`tw-font-bold ${colorClass}`}>
                  {val}
                </Typography>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
