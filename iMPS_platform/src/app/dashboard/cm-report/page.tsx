// "use client";

// import React, { useState } from "react";

// import ChargerTables from "@/app/dashboard/cm-report/charger/list/components/charger-table";

// import { Tabs, TabsHeader, TabsBody, Tab, TabPanel } from "@material-tailwind/react";
// import { BoltIcon, ServerIcon, CpuChipIcon, CubeIcon, MapPinIcon } from "@heroicons/react/24/solid";

// type TabId = "charger" | "mdb" | "ccb" | "cb-box" | "station";

// const TABS: { id: TabId; label: string }[] = [
//   { id: "charger", label: "Charger" },
//   { id: "mdb", label: "MDB" },
//   { id: "ccb", label: "CCB" },
//   { id: "cb-box", label: "CB\u2011BOX" },
//   { id: "station", label: "Station" },
// ];

// export default function DataTablesPage() {
//   const [active, setActive] = useState<TabId>("charger");
//   const handleChange = (v: string) => setActive(v as TabId);

//   return (
//     <Tabs id="data-tabs" value={active} onChange={handleChange} className="tw-w-full">
//       <div className="tw-w-full tw-flex tw-justify-start">
//         <TabsHeader
//           className="tw-bg-gray-100 tw-rounded-xl tw-p-1 tw-border tw-border-gray-200 tw-overflow-hidden tw-w-fit tw-gap-1 tw-m-0"
//           indicatorProps={{ className: "tw-h-full tw-rounded-lg tw-bg-white tw-shadow tw-ring-1 tw-ring-gray-200" }}
//         >
//           {TABS.map((t) => (
//             <Tab
//               key={t.id}
//               value={t.id}
//               className="
//                 tw-rounded-lg tw-px-5 tw-py-2
//                 tw-text-sm md:tw-text-base tw-font-medium
//                 tw-flex tw-flex-nowrap tw-items-center tw-justify-center tw-gap-2
//                 tw-whitespace-nowrap tw-leading-none
//                 tw-text-gray-700 data-[hover=true]:tw-text-gray-900 aria-selected:tw-text-gray-900
//                 tw-min-w-[140px] md:tw-min-w-[160px]
//               "
//             >
//               {/* {t.icon} */}
//               <span>{t.label}</span>
//             </Tab>
//           ))}
//         </TabsHeader>
//       </div>

//       <TabsBody
//         animate={{ initial: { y: 6, opacity: 0 }, mount: { y: 0, opacity: 1 }, unmount: { y: 6, opacity: 0 } }}
//         className="tw-pt-3"
//       >
//         <TabPanel value="charger" className="tw-p-0">
//           <div className="tw-space-y-5">
//             <ChargerTables />
//           </div>
//         </TabPanel>

//         <TabPanel value="mdb" className="tw-p-0">
//           <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-5">เนื้อหา MDB …</div>
//           {/* <div className="tw-space-y-5">
//             <FirmwareCards />
//             <ChargerTables />
//           </div> */}
//         </TabPanel>

//         <TabPanel value="ccb" className="tw-p-0">
//           <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-5">เนื้อหา CCB …</div>
//         </TabPanel>

//         <TabPanel value="cb-box" className="tw-p-0">
//           <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-5">เนื้อหา CB-BOX …</div>
//         </TabPanel>

//         <TabPanel value="station" className="tw-p-0">
//           <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-5">เนื้อหา Station …</div>
//         </TabPanel>
//       </TabsBody>
//     </Tabs>
//   );
// }




"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsHeader, TabsBody, Tab, TabPanel } from "@material-tailwind/react";

// components
import ListCMTables from "@/app/dashboard/cm-report/components/listCM";

/* ---------------------------------------------
 * ประเภทเอกสาร (id สำหรับ UI / apiType สำหรับ backend)
 * --------------------------------------------- */
export type TabId = "charger" | "mdb" | "ccb" | "cb-box" | "station";
export type ApiType = "charger" | "mdb" | "ccb" | "cb_box" | "station";

const TABS: { id: TabId; apiType: ApiType; label: string }[] = [
  { id: "charger", apiType: "charger", label: "Charger" },
  { id: "mdb", apiType: "mdb", label: "MDB" },
  { id: "ccb", apiType: "ccb", label: "CCB" },
  { id: "cb-box", apiType: "cb_box", label: "CB-BOX" },
  { id: "station", apiType: "station", label: "Station" },
];

/* ---------------------------------------------
 * คอมโพเนนต์ตารางกลาง: ส่ง apiType (ไม่ใช้ any)
 * --------------------------------------------- */
function CMTable({ equipmentType }: { equipmentType: ApiType }) {
  return <ListCMTables equipmentType={equipmentType} />;
}

export default function DataTablesPage() {
  const router = useRouter();
  const search = useSearchParams();

  // อ่านค่า type จาก query สำหรับ deep-link
  const initial = useMemo<TabId>(() => {
    const t = (search.get("type") || "charger") as TabId;
    return (TABS.some((x) => x.id === t) ? t : "charger") as TabId;
  }, [search]);

  const [active, setActive] = useState<TabId>(initial);

  // sync state -> url (ไม่เพิ่ม stack)
  const handleChange = (v: string) => {
    const next = v as TabId;
    setActive(next);
    const params = new URLSearchParams(search.toString());
    params.set("type", next);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // ถ้า query ภายนอกเปลี่ยน ให้ sync กลับ state
  useEffect(() => {
    if (initial !== active) setActive(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <Tabs id="data-tabs" value={active} onChange={handleChange} className="tw-w-full">
      <div className="tw-w-full tw-flex tw-justify-start">
        <TabsHeader
          className="tw-bg-gray-100 tw-rounded-xl tw-p-1 tw-border tw-border-gray-200 tw-overflow-hidden tw-w-fit tw-gap-1 tw-m-0"
          indicatorProps={{ className: "tw-h-full tw-rounded-lg tw-bg-white tw-shadow tw-ring-1 tw-ring-gray-200" }}
        >
          {TABS.map(({ id, label }) => (
            <Tab
              key={id}
              value={id}
              className="
                tw-rounded-lg tw-px-5 tw-py-2
                tw-text-sm md:tw-text-base tw-font-medium
                tw-flex tw-items-center tw-gap-2
                tw-whitespace-nowrap tw-leading-none
                tw-text-gray-700 data-[hover=true]:tw-text-gray-900 aria-selected:tw-text-gray-900
                tw-min-w-[140px] md:tw-min-w-[160px]
              "
            >
              <span>{label}</span>
            </Tab>
          ))}
        </TabsHeader>
      </div>

      <TabsBody
        animate={{ initial: { y: 6, opacity: 0 }, mount: { y: 0, opacity: 1 }, unmount: { y: 6, opacity: 0 } }}
        className="tw-pt-3"
      >
        {TABS.map(({ id, apiType }) => (
          <TabPanel key={id} value={id} className="tw-p-0">
            <div className="tw-space-y-5">
              {/* ตารางรวม ใช้พร็อพบอกประเภทเพื่อไปดึงข้อมูลเฉพาะหมวด */}
              <CMTable equipmentType={apiType} />
            </div>
          </TabPanel>
        ))}
      </TabsBody>
    </Tabs>
  );
}
