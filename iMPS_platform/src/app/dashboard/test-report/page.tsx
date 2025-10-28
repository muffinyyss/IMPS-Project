
"use client";

import React, { useEffect, useMemo, useState } from "react";

// components
import ChargerTables from "@/app/dashboard/pm-report/charger/list/components/charger-table";
import FirmwareCards from "@/app/dashboard/pm-report/charger/list/components/firmware-cards";
import DCTables from "@/app/dashboard/test-report/dc/list/components/dc-table";
import ACTables from "@/app/dashboard/test-report/ac/list/components/ac-table";

import { Tabs, TabsHeader, TabsBody, Tab, TabPanel } from "@material-tailwind/react";
import { BoltIcon, ServerIcon, CpuChipIcon, CubeIcon, MapPinIcon } from "@heroicons/react/24/solid";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TabId = "DC" | "AC";

const TABS: { id: TabId; label: string; slug: "DC" | "AC" }[] = [
  { id: "DC", label: "DC Charegr", slug: "DC" },
  { id: "AC", label: "AC Charegr", slug: "AC" },
];

function slugToTab(slug: string | null): TabId {
  switch (slug) {
    case "AC": return "AC";
    case "DC":
    default: return "DC";
  }
}

function tabToSlug(tab: TabId): "DC" | "AC" {
  return TABS.find(t => t.id === tab)!.slug;
}


export default function DataTablesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // const [active, setActive] = useState<TabId>("DC");
  const active: TabId = useMemo(() => slugToTab(searchParams.get("tab")), [searchParams]);
  const isFormView = useMemo(() => searchParams.get("view") === "form", [searchParams]);

  // const handleChange = (v: string) => setActive(v as TabId);

  useEffect(() => {
    if (!searchParams.get("tab")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabToSlug(active)); // จะเป็น "open" ตอนแรก
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [active, pathname, router, searchParams]);

  const go = (next: TabId) => {
    if (isFormView) return; // 🔒 กันการเปลี่ยนแท็บตอนกรอกฟอร์ม
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabToSlug(next));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs id="data-tabs" value={active}  className="tw-w-full">
      <div className="tw-w-full tw-flex tw-justify-start">
        <TabsHeader
          // className="tw-bg-gray-100 tw-rounded-xl tw-p-1 tw-border tw-border-gray-200 tw-overflow-hidden tw-w-fit tw-gap-1 tw-m-0"
          className={`tw-bg-gray-100 tw-rounded-xl tw-p-1 tw-border tw-border-gray-200 tw-overflow-hidden tw-w-fit tw-gap-1 tw-m-0
            ${isFormView ? "tw-pointer-events-none tw-opacity-60" : ""}
          `}
          indicatorProps={{ className: "tw-h-full tw-rounded-lg tw-bg-white tw-shadow tw-ring-1 tw-ring-gray-200" }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.id}
              value={t.id}
              onClick={() => !isFormView && go(t.id)}
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




