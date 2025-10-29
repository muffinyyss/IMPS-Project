// "use client";
import dynamic from "next/dynamic";

import ChargerEnv from "@/app/dashboard/cbm/components/chargerEnv";
import MDBEnv from "@/app/dashboard/cbm/components/mdbEnv";
import DeviceTempsCard from "@/app/dashboard/cbm/components/deviceTemp";
import PowerModulesCard from "@/app/dashboard/cbm/components/powermodule";
import FansCard from "@/app/dashboard/cbm/components/fan";
import PLCCard from "@/app/dashboard/cbm/components/plc";
import ChargingGunsCard from "@/app/dashboard/cbm/components/chargingGuns";
import InsulationAndContactorStatusCard from "@/app/dashboard/cbm/components/InsulationAndContactorStatusCard"; // 👈 เพิ่ม import

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const SalesByAge = dynamic(() => import("@/app/dashboard/cbm/components/sales-by-age"), { ssr: false });
const RevenueChart = dynamic(() => import("@/app/dashboard/cbm/components/revenue-chart"), { ssr: false });

type CBMDoc = {
  _id: string;
  timestamp?: string;
  // CP_status1?: string | number;
  // SOC1?: string | number | null;
  // dynamic_max_current1?: string | number; // A
  // dynamic_max_power1?: string | number;   // W (backend), จอแสดง kW
  // present_current1?: string | number;
  // present_power1?: string | number;
  // ฟิลด์อื่น ๆ ที่อาจใช้อีกก็เพิ่มได้
  [key: string]: any;
};
export default function SalesPage() {
  // const [data, setData] = useState<CBMDoc | null>(null);

  // const lastUpdated = data?.timestamp ? new Date(data.timestamp).toLocaleString("th-TH") : null;

  return (
    <div className="tw-mt-8 tw-mb-4">
      {/* {lastUpdated && (
        <span className="tw-text-xs !tw-text-blue-gray-500">
          อัปเดตล่าสุด: {lastUpdated}
        </span>
      )} */}

      {/* กริด 12 คอลัมน์ */}
      <div className="tw-mt-2 tw-grid tw-grid-cols-1 lg:tw-grid-cols-12 tw-gap-4">

        {/* แถวบน (3 + 3 + 6 = 12) */}
        <div className="lg:tw-col-span-3 tw-col-span-12">
          <ChargerEnv />
        </div>

        <div className="lg:tw-col-span-3 tw-col-span-12">
          <MDBEnv />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <DeviceTempsCard
            updatedAt="10:32"
            devices={[
              { id: "edge", name: "EdgeBox", temp: 38, target: 60 },
              { id: "pi", name: "Raspberry Pi", temp: 47, target: 60 },
              { id: "router", name: "Router", temp: 71, target: 70 },
            ]}
          />
        </div>

        {/* แถวกลาง: Thermal pair = PLC + Guns */}
        <div className="lg:tw-col-span-6 tw-col-span-12">
          <PLCCard
            updatedAt="10:32"
            items={[
              { id: "plc1", name: "PLC 1 Temperature", temp: 42, target: 60 },
              { id: "plc2", name: "PLC 2 Temperature", temp: 55, target: 60 },
            ]}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <ChargingGunsCard
            updatedAt="10:32"
            items={[
              { id: "gun1", name: "Charging Gun 1 Temperature", temp: 43, target: 60 },
              { id: "gun2", name: "Charging Gun 2 Temperature", temp: 58, target: 60 },
            ]}
          />
        </div>

        {/* แถวถัดไป: สถานะไฟฟ้า + Power Modules แบ่ง 6/6 */}
        <div className="lg:tw-col-span-6 tw-col-span-12">
          <InsulationAndContactorStatusCard
            updatedAt="10:32"
            items={[
              { id: "i1", name: "Insulation monitoring No.1 (Active/Inactive)", value: "Active", keyName: "InsuFault1" },
              { id: "i2", name: "Insulation monitoring No.2 (Active/Inactive)", value: "Inactive", keyName: "InsuFault2" },
              { id: "c1", name: "AC Magnetic Contactor Head 1 Status", value: "Closed", keyName: "ACMag" },
              { id: "c2", name: "AC Magnetic Contactor Head 2 Status", value: "Open", keyName: "ACMag" },
            ]}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <PowerModulesCard
            updatedAt="10:32"
            items={[
              { id: "pm1", name: "Power module 1 Temperature", temp: 38, target: 60 },
              { id: "pm2", name: "Power module 2 Temperature", temp: 47, target: 60 },
              { id: "pm3", name: "Power module 3 Temperature", temp: 41, target: 60 },
              { id: "pm4", name: "Power module 4 Temperature", temp: 52, target: 60 },
              { id: "pm5", name: "Power module 5 Temperature", temp: 44, target: 60 },
            ]}
          />
        </div>

        {/* แถวล่าง: พัดลมเต็มแถว ให้ภาพรวมการระบายความร้อน */}
        <div className="lg:tw-col-span-12 tw-col-span-12">
          <FansCard
            updatedAt="10:32"
            fans={[
              { id: "fan1", name: "FAN1", rpm: 1800, active: true, maxRpm: 5000 },
              { id: "fan2", name: "FAN2", rpm: 0, active: false, maxRpm: 5000 },
              { id: "fan3", name: "FAN3", rpm: 2700, active: true, maxRpm: 5000 },
              { id: "fan4", name: "FAN4", rpm: 4200, active: true, maxRpm: 5000 },
              { id: "fan5", name: "FAN5", rpm: 5100, active: true, maxRpm: 6000 },
              { id: "fan6", name: "FAN6", rpm: 800, active: true },
              { id: "fan7", name: "FAN7", rpm: null, active: false },
              { id: "fan8", name: "FAN8", rpm: 3600, active: true },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
