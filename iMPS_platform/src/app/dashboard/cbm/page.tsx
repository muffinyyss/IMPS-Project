"use client";
import dynamic from "next/dynamic";
import { Typography, Card, CardHeader, CardBody } from "@/components/MaterialTailwind";

const SalesByAge = dynamic(() => import("@/app/dashboard/cbm/components/sales-by-age"), { ssr: false });
const RevenueChart = dynamic(() => import("@/app/dashboard/cbm/components/revenue-chart"), { ssr: false });

import ChargerEnv from "@/app/dashboard/cbm/components/chargerEnv";
import MDBEnv from "@/app/dashboard/cbm/components/mdbEnv";
import DeviceTempsCard from "@/app/dashboard/cbm/components/deviceTemp";
import PowerModulesCard from "@/app/dashboard/cbm/components/powermodule";

export default function SalesPage() {
  return (
    <div className="tw-mt-8 tw-mb-4">
      <div className="tw-mt-2 tw-grid tw-grid-cols-1 md:tw-grid-cols-12 tw-gap-y-6 md:tw-gap-x-4">

        {/* ⬇️ กล่องบน: ทำให้ช่องว่างกลางเท่ากันด้วย flex + gap-4 */}
        <div className="md:tw-col-span-12">
          <div className="tw-w-full tw-mr-auto">
            <div className="tw-flex tw-flex-wrap md:tw-flex-nowrap tw-gap-4">
              {/* การ์ดซ้าย */}
              <div className="tw-w-full md:tw-w-[340px]">
                <ChargerEnv />
              </div>

              {/* การ์ดขวา */}
              <div className="tw-w-full md:tw-w-[340px]">
                <MDBEnv />
              </div>

              {/* การ์ดขวา */}
              <div className="md:tw-col-span-6 tw-h-full">
          <DeviceTempsCard
            updatedAt="10:32"
            devices={[
              { id: "edge", name: "EdgeBox", temp: 38, target: 60 },
              { id: "pi", name: "Raspberry Pi", temp: 47, target: 60 },
              { id: "router", name: "Router", temp: 71, target: 70 },
            ]}
          />
        </div>
            </div>
          </div>
        </div>


        {/* แถวล่างคงเดิม */}
        {/* <div className="md:tw-col-span-6 tw-h-full">
          <DeviceTempsCard
            updatedAt="10:32"
            devices={[
              { id: "edge", name: "EdgeBox", temp: 38, target: 60 },
              { id: "pi", name: "Raspberry Pi", temp: 47, target: 60 },
              { id: "router", name: "Router", temp: 71, target: 70 },
            ]}
          />
        </div> */}

        <div className="md:tw-col-span-6 tw-h-full">
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


