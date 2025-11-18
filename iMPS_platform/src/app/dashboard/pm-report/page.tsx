"use client";

import React, { useState, useMemo, useEffect } from "react";

// components
import ChargerTables from "@/app/dashboard/pm-report/charger/list/components/charger-table";
import FirmwareCards from "@/app/dashboard/pm-report/charger/list/components/firmware-cards";
import MDBTables from "@/app/dashboard/pm-report/mdb/list/components/mdb-table";
import CCBTables from "@/app/dashboard/pm-report/ccb/list/components/ccb-table";
import StationTables from "@/app/dashboard/pm-report/station/list/components/station-table";
import CBBoxTables from "@/app/dashboard/pm-report/cb-box/list/components/cb-box-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";


import { Tabs, TabsHeader, TabsBody, Tab, TabPanel } from "@material-tailwind/react";

type TabId = "charger" | "mdb" | "ccb" | "cb-box" | "station";


const TABS: { id: TabId; label: string; slug: "charger" | "mdb" | "ccb" | "cb-box" | "station" }[] = [
  { id: "charger", label: "Charger", slug: "charger" },
  { id: "mdb", label: "MDB", slug: "mdb" },
  { id: "ccb", label: "CCB", slug: "ccb" },
  { id: "cb-box", label: "CB_BOX", slug: "cb-box" },
  { id: "station", label: "Station", slug: "station" },
];

function slugToTab(slug: string | null): TabId {
  switch (slug) {
    case "mdb": return "mdb";
    case "ccb": return "ccb";
    case "cb-box": return "cb-box";
    case "station": return "station";
    case "charger":
    default: return "charger";
  }
}

function tabToSlug(tab: TabId): "charger" | "mdb" | "ccb" | "cb-box" | "station" {
  return TABS.find(t => t.id === tab)!.slug;
}

export default function DataTablesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 🔒 อยู่โหมดฟอร์มเมื่อ ?view=form
  const isFormView = useMemo(() => searchParams.get("view") === "form", [searchParams]);

  const active: TabId = useMemo(() => slugToTab(searchParams.get("tab")), [searchParams]);

  const editId = searchParams.get("edit_id") ?? "";
  const mode: "list" | "form" =
    searchParams.get("view") === "form" || !!editId ? "form" : "list";

  useEffect(() => {
    if (!searchParams.get("tab")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabToSlug(active)); // จะเป็น "open" ตอนแรก
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [active, pathname, router, searchParams]);

  // const go = (next: TabId) => {
  //   // if (isFormView) return; // 🔒 กันการเปลี่ยนแท็บตอนกรอกฟอร์ม
  //   const params = new URLSearchParams(searchParams.toString());
  //   params.set("tab", tabToSlug(next));
  //   router.push(`${pathname}?${params.toString()}`, { scroll: false });
  // };
  const go = (next: TabId) => {
    // ถ้าอยากกันเปลี่ยนแท็บตอนอยู่หน้า form ก็ใช้ mode ร่วมได้
    // if (mode === "form") return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabToSlug(next));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };


  return (
    // <Tabs id="data-tabs" value={active} onChange={handleChange} className="tw-w-full">
    <Tabs id="data-tabs" value={active} className="tw-w-full">
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
              onClick={() => go(t.id)}
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
        <TabPanel value="charger" className="tw-p-0">
          <div className="tw-space-y-5">
            {/* <FirmwareCards /> */}
            {mode === "list" && <FirmwareCards />}
            <ChargerTables />
          </div>
        </TabPanel>

        <TabPanel value="mdb" className="tw-p-0">
          <div className="tw-space-y-5">
            <MDBTables />
          </div>

        </TabPanel>

        <TabPanel value="ccb" className="tw-p-0">
          <div className="tw-space-y-5">
            <CCBTables />
          </div>
        </TabPanel>

        <TabPanel value="cb-box" className="tw-p-0">
          <div className="tw-space-y-5">
            <CBBoxTables />
          </div>
        </TabPanel>

        <TabPanel value="station" className="tw-p-0">
          <div className="tw-space-y-5">
            <StationTables />
          </div>
        </TabPanel>
      </TabsBody>
    </Tabs>
  );
}




