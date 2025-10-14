"use client";

import React, { useState } from "react";
import ChargerTables from "./components/charger-table";
import FirmwareCards from "./components/firmware-cards";

import { Tabs, TabsHeader, TabsBody, Tab, TabPanel } from "@material-tailwind/react";
import { BoltIcon, ServerIcon, CpuChipIcon, CubeIcon, MapPinIcon } from "@heroicons/react/24/solid";

type TabId = "charger" | "mdb" | "ccb" | "cb-box" | "station";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "charger", label: "Charger", icon: <BoltIcon className="tw-h-5 tw-w-5" /> },
  { id: "mdb", label: "MDB", icon: <ServerIcon className="tw-h-5 tw-w-5" /> },
  { id: "ccb", label: "CCB", icon: <CpuChipIcon className="tw-h-5 tw-w-5" /> },
  // ใช้ non-breaking hyphen (U+2011) กันตัดบรรทัด
  { id: "cb-box", label: "CB\u2011BOX", icon: <CubeIcon className="tw-h-5 tw-w-5" /> },
  { id: "station", label: "Station", icon: <MapPinIcon className="tw-h-5 tw-w-5" /> },
];

export default function DataTablesPage() {
  const [active, setActive] = useState<TabId>("charger");
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
              {t.icon}
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
            <FirmwareCards />
            <ChargerTables />
          </div>
        </TabPanel>

        <TabPanel value="mdb" className="tw-p-0">
          <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-5">เนื้อหา MDB …</div>
        </TabPanel>

        <TabPanel value="ccb" className="tw-p-0">
          <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-5">เนื้อหา CCB …</div>
        </TabPanel>

        <TabPanel value="cb-box" className="tw-p-0">
          <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-5">เนื้อหา CB-BOX …</div>
        </TabPanel>

        <TabPanel value="station" className="tw-p-0">
          <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-5">เนื้อหา Station …</div>
        </TabPanel>
      </TabsBody>
    </Tabs>
  );
}






// "use client";

// import React, { useState } from "react";
// import ChargerTables from "./components/charger-table";
// import FirmwareCards from "./components/firmware-cards";

// import {
//   Tabs,
//   TabsHeader,
//   TabsBody,
//   Tab,
//   TabPanel,
// } from "@material-tailwind/react";

// import {
//   BoltIcon,
//   ServerIcon,
//   CpuChipIcon,
//   CubeIcon,
//   MapPinIcon,
// } from "@heroicons/react/24/solid";

// type TabId = "charger" | "mdb" | "ccb" | "cb-box" | "station";

// const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
//   { id: "charger", label: "Charger", icon: <BoltIcon className="tw-h-5 tw-w-5" /> },
//   { id: "mdb", label: "MDB", icon: <ServerIcon className="tw-h-5 tw-w-5" /> },
//   { id: "ccb", label: "CCB", icon: <CpuChipIcon className="tw-h-5 tw-w-5" /> },
//   { id: "cb-box", label: "CB-BOX", icon: <CubeIcon className="tw-h-5 tw-w-5" /> },
//   { id: "station", label: "Station", icon: <MapPinIcon className="tw-h-5 tw-w-5" /> },
// ];

// export default function DataTablesPage() {
//   const [active, setActive] = useState<TabId>("charger");
//   const handleChange = (v: string) => setActive(v as TabId);

//   return (
//     // คุมความกว้าง + ลดช่องว่างแนวตั้งรวม
//     <div className="tw-w-full tw-max-w-[1080px] tw-mx-auto tw-space-y-5 md:tw-space-y-6">
//       <Tabs id="data-tabs" value={active} onChange={handleChange} className="tw-w-full">
//         {/* Header: pill โค้งมน แต่ compact */}
//         <div className="tw-w-full tw-flex tw-justify-center">
//           <TabsHeader
//             className="
//               tw-bg-gray-100 tw-rounded-xl tw-p-1 tw-border tw-border-gray-200
//               tw-overflow-hidden tw-w-fit tw-gap-1 tw-m-0
//             "
//             indicatorProps={{
//               className:
//                 "tw-h-full tw-rounded-lg tw-bg-white tw-shadow tw-ring-1 tw-ring-gray-200",
//             }}
//           >
//             {TABS.map((t) => (
//               <Tab
//                 key={t.id}
//                 value={t.id}
//                 className="
//                   tw-rounded-lg tw-px-4 tw-py-2 tw-text-sm md:tw-text-base
//                   tw-font-medium tw-flex tw-items-center tw-gap-2
//                   tw-text-gray-700 data-[hover=true]:tw-text-gray-900
//                   aria-selected:tw-text-gray-900
//                 "
//               >
//                 {t.icon}
//                 {t.label}
//               </Tab>
//             ))}
//           </TabsHeader>
//         </div>

//         {/* เนื้อหา: ใช้คอนเทนเนอร์ space-y-5 เพื่อไม่เว้นกว้างเกิน */}
//         <TabsBody
//           animate={{
//             initial: { y: 6, opacity: 0 },
//             mount: { y: 0, opacity: 1 },
//             unmount: { y: 6, opacity: 0 },
//           }}
//           className="tw-pt-3"
//         >
//           {/* CHARGER */}
//           <TabPanel value="charger" className="tw-p-0">
//             <div className="tw-space-y-5">
//               <FirmwareCards />
//               <ChargerTables />
//             </div>
//           </TabPanel>

//           {/* MDB */}
//           <TabPanel value="mdb" className="tw-p-0">
//             <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-5">
//               เนื้อหา MDB …
//             </div>
//           </TabPanel>

//           {/* CCB */}
//           <TabPanel value="ccb" className="tw-p-0">
//             <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-5">
//               เนื้อหา CCB …
//             </div>
//           </TabPanel>

//           {/* CB-BOX */}
//           <TabPanel value="cb-box" className="tw-p-0">
//             <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-5">
//               เนื้อหา CB-BOX …
//             </div>
//           </TabPanel>

//           {/* STATION */}
//           <TabPanel value="station" className="tw-p-0">
//             <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-5">
//               เนื้อหา Station …
//             </div>
//           </TabPanel>
//         </TabsBody>
//       </Tabs>
//     </div>
//   );
// }


// import React from "react";
// import ChargerTables from "./components/charger-table";
// import FirmwareCards from "./components/firmware-cards";

// import {
//   Tabs,
//   TabsHeader,
//   TabsBody,
//   Tab,
//   TabPanel,
// } from "@material-tailwind/react";

// import {
//   BoltIcon,
//   ServerIcon,
//   CpuChipIcon,
//   CubeIcon,
//   MapPinIcon,
// } from "@heroicons/react/24/solid";

// export default function DataTablesPage() {
//   return (
//     <>
//       <FirmwareCards />
//       <ChargerTables /> {/* ถ้า dropdown ย้ายไป Navbar แล้ว จะคง/ลบก็ได้ */}
//     </>
//   );
// }




// "use client";

// import React, { useState } from "react";
// import ChargerTables from "./components/charger-table";
// import FirmwareCards from "./components/firmware-cards";

// // แนะนำให้นำเข้าโดยตรงจาก material-tailwind เพื่อให้ได้ type ครบ
// import {
//   Tabs,
//   TabsHeader,
//   TabsBody,
//   Tab,
//   TabPanel,
// } from "@material-tailwind/react"; // <- ถ้าจำเป็นใช้ wrapper คง path เดิมได้

// type TabId = "charger" | "mdb" | "ccb" | "cb-box" | "station";

// const TABS: { id: TabId; label: string }[] = [
//   { id: "charger", label: "Charger" },
//   { id: "mdb", label: "MDB" },
//   { id: "ccb", label: "CCB" },
//   { id: "cb-box", label: "CB-BOX" },
//   { id: "station", label: "Station" },
// ];

// export default function DataTablesPage() {
//   const [active, setActive] = useState<TabId>("charger");

//   // ให้ TS ถูกต้อง และอ่านง่าย
//   const handleChange = (v: string) => setActive(v as TabId);

//   return (
//     <Tabs
//       id="data-tabs"
//       value={active}
//       onChange={handleChange}
//       className="tw-w-full"
//     >
//       {/* แถบหัวแท็บ */}
//       <TabsHeader
//         className="tw-bg-transparent tw-p-0 tw-border-b tw-border-gray-200"
//         indicatorProps={{
//           className:
//             // เส้นใต้แท็บที่เลือก ให้บางและสีชัด
//             "tw-bg-indigo-600 tw-h-0.5 tw-rounded-none tw-shadow-none -tw-bottom-[1px]",
//         }}
//       >
//         {TABS.map((t) => (
//           <Tab
//             key={t.id}
//             value={t.id}
//             className="
//               tw-relative tw-px-4 tw-py-2 tw-text-sm md:tw-text-base tw-font-medium
//               tw-text-gray-600 data-[hover=true]:tw-text-gray-900
//               aria-selected:tw-text-indigo-600
//             "
//           >
//             {t.label}
//           </Tab>
//         ))}
//       </TabsHeader>

//       {/* เนื้อหาแต่ละแท็บ */}
//       <TabsBody
//         animate={{
//           initial: { y: 8, opacity: 0 },
//           mount: { y: 0, opacity: 1 },
//           unmount: { y: 8, opacity: 0 },
//         }}
//         className="tw-pt-4"
//       >
//         {/* CHARGER — ภาพรวม + ตาราง */}
//         <TabPanel value="charger" className="tw-p-0">
//           <FirmwareCards />
//           <ChargerTables />
//         </TabPanel>

//         {/* MDB — ตาราง/เนื้อหา */}
//         <TabPanel value="mdb" className="tw-p-0">
//           {/* <MDBTables /> */}
//           <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-6">
//             เนื้อหา MDB …
//           </div>
//         </TabPanel>

//         {/* CCB — ตาราง/เนื้อหา */}
//         <TabPanel value="ccb" className="tw-p-0">
//           {/* <CCBTables /> */}
//           <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-6">
//             เนื้อหา CCB …
//           </div>
//         </TabPanel>

//         {/* CB-BOX — ตาราง/เนื้อหา */}
//         <TabPanel value="cb-box" className="tw-p-0">
//           {/* <CBBoxTables /> */}
//           <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-6">
//             เนื้อหา CB-BOX …
//           </div>
//         </TabPanel>

//         {/* STATION — ตาราง/เนื้อหา */}
//         <TabPanel value="station" className="tw-p-0">
//           {/* <StationTables /> */}
//           <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-6">
//             เนื้อหา Station …
//           </div>
//         </TabPanel>
//       </TabsBody>
//     </Tabs>
//   );
// }


