import React from "react";

// @material-tailwind/react
import { Card, CardHeader, CardBody, Typography } from "@/components/MaterialTailwind";

// @heroicons/react
import { GlobeAltIcon } from "@heroicons/react/24/outline";

// components
import SearchDataTables from "./components/search-data-table";
import ChargerInfo from "./components/chargerInfo";

export default function DataTablesPage() {
  return (
    <div className="tw-mt-8 tw-mb-4">
      {/* Charger Info Card */}
      <Card className="tw-mb-6 tw-border tw-border-blue-gray-100 tw-shadow-sm">
        {/* Header */}
        <div className="tw-flex tw-items-center tw-justify-between tw-px-4 tw-pt-4">
          {/* left: icon + title */}
          <div className="tw-flex tw-items-center">
            <CardHeader
              floated={false}
              variant="gradient"
              color="gray"
              className="tw-grid tw-h-16 tw-w-16 tw-place-items-center tw-mr-3"
            >
              <GlobeAltIcon className="tw-h-7 tw-w-7 tw-text-white" />
            </CardHeader>
            <Typography variant="h6" color="blue-gray" className="tw-mt-3">
              Charger Info
            </Typography>
          </div>

          {/* right: ข้อมูลอุปกรณ์ชาร์จ */}
          <Typography variant="small" className="tw-text-blue-gray-400 tw-mr-2">
            ข้อมูลอุปกรณ์ชาร์จ
          </Typography>
        </div>

        {/* Body */}
        <CardBody className="tw-grid tw-grid-cols-1 tw-items-center tw-justify-between tw-p-4 lg:tw-grid-cols-2">
          <div className="tw-col-span-1">
            <ChargerInfo />
          </div>
        </CardBody>
      </Card>

      <SearchDataTables />
    </div>
  );
}
