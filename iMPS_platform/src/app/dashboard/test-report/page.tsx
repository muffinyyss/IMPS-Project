
"use client";

import React, { useState } from "react";

// components
import ChargerTables from "@/app/dashboard/pm-report/charger/list/components/charger-table";
import FirmwareCards from "@/app/dashboard/pm-report/charger/list/components/firmware-cards";
import DCTables from "@/app/dashboard/test-report/dc/list/components/dc-table";
import ACTables from "@/app/dashboard/test-report/ac/list/components/ac-table";





import { Tabs, TabsHeader, TabsBody, Tab, TabPanel } from "@material-tailwind/react";
import { BoltIcon, ServerIcon, CpuChipIcon, CubeIcon, MapPinIcon } from "@heroicons/react/24/solid";

type TabId = "DC" | "AC" ;

const TABS: { id: TabId; label: string }[] = [
  { id: "DC", label: "DC Charegr" },
  { id: "AC", label: "AC Charegr" },
];

export default function DataTablesPage() {
  const [active, setActive] = useState<TabId>("DC");
  const handleChange = (v: string) => setActive(v as TabId);

  return (
    <Tabs id="data-tabs" value={active} onChange={handleChange} className="tw-w-full">
      <div className="tw-w-full tw-flex tw-justify-start">
        <TabsHeader
          className="tw-bg-gray-100 tw-rounded-xl tw-p-1 tw-border tw-border-gray-200 tw-overflow-hidden tw-w-fit tw-gap-1 tw-m-0"
          indicatorProps={{ className: "tw-h-full tw-rounded-lg tw-bg-white tw-shadow tw-ring-1 tw-ring-gray-200" }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.id}
              value={t.id}
              className="
                tw-rounded-lg tw-px-5 tw-py-2
                tw-text-sm md:tw-text-base tw-font-medium
                tw-flex tw-flex-nowrap tw-items-center tw-justify-center tw-gap-2
                tw-whitespace-nowrap tw-leading-none
                tw-text-gray-700 data-[hover=true]:tw-text-gray-900 aria-selected:tw-text-gray-900
                tw-min-w-[140px] md:tw-min-w-[160px]
              "
            >
              {/* {t.icon} */}
              <span>{t.label}</span>
            </Tab>
          ))}
        </TabsHeader>
      </div>

      <TabsBody
        animate={{ initial: { y: 6, opacity: 0 }, mount: { y: 0, opacity: 1 }, unmount: { y: 6, opacity: 0 } }}
        className="tw-pt-3"
      >
        <TabPanel value="DC" className="tw-p-0">
          <div className="tw-space-y-5">
            <DCTables />
          </div>
        </TabPanel>

        <TabPanel value="AC" className="tw-p-0">
          <div className="tw-space-y-5">
            <ACTables />
          </div>

        </TabPanel>
      </TabsBody>
    </Tabs>
  );
}




