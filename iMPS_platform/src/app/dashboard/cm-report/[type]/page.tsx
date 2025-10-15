"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsHeader, TabsBody, Tab, TabPanel } from "@material-tailwind/react";
import { notFound } from "next/navigation";
import ListCMTables from "@/app/dashboard/cm-report/components/list_cm";

/** TabId = ใช้ใน URL/UI | ApiType = ส่งเข้า list/form/backend */
export type TabId = "charger" | "mdb" | "ccb" | "cb-box" | "station";
export type ApiType = "charger" | "mdb" | "ccb" | "cb_box" | "station";

const TABS: { id: TabId; apiType: ApiType; label: string }[] = [
  { id: "charger", apiType: "charger", label: "Charger" },
  { id: "mdb", apiType: "mdb", label: "MDB" },
  { id: "ccb", apiType: "ccb", label: "CCB" },
  { id: "cb-box", apiType: "cb_box", label: "CB-BOX" },
  { id: "station", apiType: "station", label: "Station" },
];

const ALLOWED: readonly TabId[] = TABS.map(t => t.id) as TabId[];

function getBasePath(pathname: string) {
  const idx = pathname.lastIndexOf("/");
  return idx > 0 ? pathname.slice(0, idx) : pathname;
}

export default function DataTablesPage({ params }: { params: { type?: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // อ่าน type จาก path
  const segment = String(params.type || "").toLowerCase() as TabId;
  if (!(ALLOWED as readonly string[]).includes(segment)) notFound();
  const [active, setActive] = useState<TabId>(segment);

  useEffect(() => {
    if (segment !== active) setActive(segment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment]);

  // สร้าง URL ของแท็บใหม่ + ล้าง view
  const urlFor = (next: TabId) => {
    const base = getBasePath(pathname);
    const p = new URLSearchParams(search.toString());
    p.delete("type");
    p.delete("view"); // << สำคัญ: เปลี่ยนแท็บให้กลับ LIST
    const qs = p.toString();
    return qs ? `${base}/${next}?${qs}` : `${base}/${next}`;
  };

  const handleChange = (nextValue: string) => {
    const next = nextValue as TabId;
    setActive(next);
    router.replace(urlFor(next), { scroll: false });
  };

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
              onClick={() => router.replace(urlFor(id), { scroll: false })} // << กันเหนียว ลบ view เสมอ
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
            <ListCMTables equipmentType={apiType} />
          </TabPanel>
        ))}
      </TabsBody>
    </Tabs>
  );
}
