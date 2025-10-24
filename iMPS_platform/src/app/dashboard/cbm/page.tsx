"use client";
import dynamic from "next/dynamic";

// @material-tailwind/react
import {
  Typography,
  Card,
  CardHeader,
  CardBody,
} from "@/components/MaterialTailwind";

// @components
import ProductTable from "@/app/dashboard/cbm/components/product-table";
import CountryTable from "@/app/dashboard/cbm/components/country-table";

const SalesByAge = dynamic(() => import("@/app/dashboard/cbm/components/sales-by-age"), {
  ssr: false,
});
const RevenueChart = dynamic(() => import("@/app/dashboard/cbm/components/revenue-chart"), {
  ssr: false,
});

import ChargerEnv from "@/app/dashboard/cbm/components/chargerEnv";
import MDBEnv from "@/app/dashboard/cbm/components/mdbEnv";
import DeviceTempsCard from "@/app/dashboard/cbm/components/deviceTemp";


export default function SalesPage() {
  return (
    <div className="tw-mt-8 tw-mb-4">
      {/* <SalesCard /> */}
      <div className="tw-mt-2 tw-grid tw-grid-cols-1 tw-gap-y-4 md:tw-grid-cols-2 lg:tw-grid-cols-3 lg:tw-gap-x-6">
        <ChargerEnv />
        <MDBEnv />
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
  );
}
