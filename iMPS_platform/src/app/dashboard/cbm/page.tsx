"use client";
import dynamic from "next/dynamic";

import ChargerEnv from "@/app/dashboard/cbm/components/chargerEnv";
import MDBEnv from "@/app/dashboard/cbm/components/mdbEnv";
import DeviceTempsCard from "@/app/dashboard/cbm/components/deviceTemp";
import PowerModulesCard from "@/app/dashboard/cbm/components/powermodule";

const SalesByAge = dynamic(() => import("@/app/dashboard/cbm/components/sales-by-age"), { ssr: false });
const RevenueChart = dynamic(() => import("@/app/dashboard/cbm/components/revenue-chart"), { ssr: false });

export default function SalesPage() {
  return (
    <div className="tw-mt-8 tw-mb-4">
      {/* ใช้กริด 12 คอลัมน์ */}
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

        {/* แถวล่าง – ให้กินเต็มแถว */}
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
      </div>
    </div>
  );
}
