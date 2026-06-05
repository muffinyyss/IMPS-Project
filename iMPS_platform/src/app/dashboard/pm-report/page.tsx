// PM
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

  // const active: TabId = useMemo(() => slugToTab(searchParams.get("tab")), [searchParams]);
  const [active, setActive] = useState<TabId>(() => slugToTab(searchParams.get("tab")));

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    const newActive = slugToTab(tabFromUrl);
    if (newActive !== active) {
      setActive(newActive);
    }
  }, [searchParams]);
  // const active: TabId = useMemo(
  //   () => slugToTab(searchParams.get("stage")),
  //   [searchParams]
  // );
  const editId = searchParams.get("edit_id") ?? "";
  const mode: "list" | "form" =
    searchParams.get("view") === "form" || !!editId ? "form" : "list";

  // useEffect(() => {
  //   if (!searchParams.get("tab")) {
  //     const params = new URLSearchParams(searchParams.toString());
  //     params.set("tab", tabToSlug(active)); // จะเป็น "open" ตอนแรก
  //     router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  //   }
  // }, [active, pathname, router, searchParams]);
  const goToForm = (id?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "form");
    if (id) params.set("edit_id", id);
    // เก็บ tab ปัจจุบัน
    if (!params.get("tab")) {
      params.set("tab", tabToSlug(active));
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!searchParams.get("tab")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabToSlug(active));
      params.delete("stage");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [pathname, router, searchParams, active]);

  // const go = (next: TabId) => {
  //   // if (isFormView) return; // 🔒 กันการเปลี่ยนแท็บตอนกรอกฟอร์ม
  //   const params = new URLSearchParams(searchParams.toString());
  //   params.set("tab", tabToSlug(next));
  //   router.push(`${pathname}?${params.toString()}`, { scroll: false });
  // };
  // const go = (next: TabId) => {
  //   const params = new URLSearchParams(searchParams.toString());
  //   params.set("tab", tabToSlug(next));
  //   params.delete("stage"); // กันของเก่าค้าง
  //   router.push(`${pathname}?${params.toString()}`, { scroll: false });
  // };

  const go = (next: TabId) => {
    setActive(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabToSlug(next));
    params.delete("stage");
    params.delete("view");
    params.delete("edit_id");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };


  // return (
  //   // <Tabs id="data-tabs" value={active} onChange={handleChange} className="tw-w-full">
  //   <Tabs id="data-tabs" value={active} className="tw-w-full">
  //     <div className="tw-w-full tw-flex tw-justify-start tw-overflow-x-auto tw-scrollbar-hide">
  //       <TabsHeader
  //         // className="tw-bg-gray-100 tw-rounded-xl tw-p-1 tw-border tw-border-gray-200 tw-overflow-hidden tw-w-fit tw-gap-1 tw-m-0"
  //         className={`tw-bg-gray-100 tw-rounded-xl tw-p-1 tw-border tw-border-gray-200 tw-overflow-visible tw-w-fit tw-gap-1 tw-m-0
  //           ${isFormView ? "tw-pointer-events-none tw-opacity-60" : ""}
  //         `}
  //         indicatorProps={{ className: "tw-h-full tw-rounded-lg tw-bg-white tw-shadow tw-ring-1 tw-ring-gray-200" }}
  //       >
  //         {TABS.map((t) => (
  //           <Tab
  //             key={t.id}
  //             value={t.id}
  //             onClick={() => go(t.id)}
  //             className="
  //               tw-rounded-lg tw-px-5 tw-py-2
  //               tw-text-sm md:tw-text-base tw-font-medium
  //               tw-flex tw-flex-nowrap tw-items-center tw-justify-center tw-gap-2
  //               tw-whitespace-nowrap tw-leading-none
  //               tw-text-gray-700 data-[hover=true]:tw-text-gray-900 aria-selected:tw-text-gray-900
  //               tw-min-w-[140px] md:tw-min-w-[160px]
  //             "
  //           >
  //             {/* {t.icon} */}
  //             <span>{t.label}</span>
  //           </Tab>
  //         ))}
  //       </TabsHeader>
  //     </div>

  //     <TabsBody
  //       animate={{ initial: { y: 6, opacity: 0 }, mount: { y: 0, opacity: 1 }, unmount: { y: 6, opacity: 0 } }}
  //       className="tw-pt-3"
  //     >
  //       <TabPanel value="charger" className="tw-p-0">
  //         <div className="tw-space-y-5">
  //           {/* <FirmwareCards /> */}
  //           {mode === "list" && <FirmwareCards />}
  //           <ChargerTables />
  //         </div>
  //       </TabPanel>

  //       <TabPanel value="mdb" className="tw-p-0">
  //         <div className="tw-space-y-5">
  //           <MDBTables />
  //         </div>

  //       </TabPanel>

  //       <TabPanel value="ccb" className="tw-p-0">
  //         <div className="tw-space-y-5">
  //           <CCBTables />
  //         </div>
  //       </TabPanel>

  //       <TabPanel value="cb-box" className="tw-p-0">
  //         <div className="tw-space-y-5">
  //           <CBBoxTables />
  //         </div>
  //       </TabPanel>

  //       <TabPanel value="station" className="tw-p-0">
  //         <div className="tw-space-y-5">
  //           <StationTables />
  //         </div>
  //       </TabPanel>
  //     </TabsBody>
  //   </Tabs>
  // );

  return (
    <div className="tw-w-full">
      {/* Custom Tabs */}
      <div className={`tw-w-full tw-flex tw-justify-start tw-overflow-x-auto tw-scrollbar-hide ${isFormView ? "tw-pointer-events-none tw-opacity-60" : ""}`}>
        <div className="tw-inline-flex tw-items-center tw-gap-1 tw-p-1 tw-bg-gray-100 tw-rounded-xl tw-border tw-border-gray-200">
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => go(tab.id)}
                className={`
                  tw-relative tw-flex tw-items-center tw-justify-center tw-gap-2
                  tw-rounded-lg tw-px-5 tw-py-2.5
                  tw-text-sm md:tw-text-base tw-font-semibold
                  tw-whitespace-nowrap tw-leading-none
                  tw-min-w-[120px] md:tw-min-w-[140px]
                  tw-transition-all tw-duration-300 tw-ease-out
                  focus:tw-outline-none
                  ${isActive
                    ? "tw-bg-gray-900 tw-text-white tw-shadow-lg tw-shadow-gray-900/25 tw-scale-[1.02]"
                    : "tw-bg-transparent tw-text-gray-500 hover:tw-text-gray-800 hover:tw-bg-white/60"
                  }
                `}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="tw-pt-4">
        {active === "charger" && (
          <div className="tw-space-y-5">
            {mode === "list" && <FirmwareCards />}
            <ChargerTables />
          </div>
        )}
        {active === "mdb" && (
          <div className="tw-space-y-5"><MDBTables /></div>
        )}
        {active === "ccb" && (
          <div className="tw-space-y-5"><CCBTables /></div>
        )}
        {active === "cb-box" && (
          <div className="tw-space-y-5"><CBBoxTables /></div>
        )}
        {active === "station" && (
          <div className="tw-space-y-5"><StationTables /></div>
        )}
      </div>
    </div>
  );
}




