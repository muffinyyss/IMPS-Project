"use client";

import React, { useEffect, useMemo } from "react";

import OpenTables from "@/app/dashboard/cm-report/open/list/open-table";
import InProgressTables from "@/app/dashboard/cm-report/inprogress/list/inprogress-table";
import ClosedTables from "@/app/dashboard/cm-report/closed/list/closed-table";
import { Tabs, TabsHeader, TabsBody, Tab, TabPanel } from "@material-tailwind/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TabId = "Open" | "In Progress" | "Closed";

const TABS: { id: TabId; label: string; slug: "open" | "in-progress" | "closed" }[] = [
  { id: "Open",        label: "Open",        slug: "open" },
  { id: "In Progress", label: "In Progress", slug: "in-progress" },
  { id: "Closed",      label: "Closed",      slug: "closed" },
];

function slugToTab(slug: string | null): TabId {
  switch (slug) {
    case "in-progress": return "In Progress";
    case "closed":      return "Closed";
    case "open":
    default:            return "Open";
  }
}

function tabToSlug(tab: TabId): "open" | "in-progress" | "closed" {
  return TABS.find(t => t.id === tab)!.slug;
}

export default function DataTablesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active: TabId = useMemo(() => slugToTab(searchParams.get("tab")), [searchParams]);

  // 🔒 อยู่โหมดฟอร์มเมื่อ ?view=form
  const isFormView = useMemo(() => searchParams.get("view") === "form", [searchParams]);

  // ให้ URL มี ?tab=... เสมอ
  useEffect(() => {
    if (!searchParams.get("tab")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabToSlug(active)); // จะเป็น "open" ตอนแรก
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [active, pathname, router, searchParams]);

  // เปลี่ยนแท็บ = อัปเดต query param (คง param อื่น ๆ) — แต่ถ้าเป็นฟอร์ม ให้บล็อก
  const go = (next: TabId) => {
    if (isFormView) return; // 🔒 กันการเปลี่ยนแท็บตอนกรอกฟอร์ม
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabToSlug(next));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs id="data-tabs" value={active} className="tw-w-full">
      <div className="tw-w-full tw-flex tw-justify-start">
        <TabsHeader
          // 🔒 ปิดการคลิกทั้งหัวแท็บ + ซีดสี เมื่ออยู่ในโหมดฟอร์ม
          className={`tw-bg-gray-100 tw-rounded-xl tw-p-1 tw-border tw-border-gray-200 tw-overflow-hidden tw-w-fit tw-gap-1 tw-m-0
            ${isFormView ? "tw-pointer-events-none tw-opacity-60" : ""}
          `}
          indicatorProps={{ className: "tw-h-full tw-rounded-lg tw-bg-white tw-shadow tw-ring-1 tw-ring-gray-200" }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.id}
              value={t.id}
              onClick={() => !isFormView && go(t.id)}  // 🔒 กันคลิกที่แท็บรายตัว
              aria-disabled={isFormView}
              title={isFormView ? "กำลังกรอกแบบฟอร์ม — กรุณาบันทึก/ยกเลิกก่อน" : ""}
              className={`
                tw-rounded-lg tw-px-5 tw-py-2
                tw-text-sm md:tw-text-base tw-font-medium
                tw-flex tw-flex-nowrap tw-items-center tw-justify-center tw-gap-2
                tw-whitespace-nowrap tw-leading-none
                tw-text-gray-700 data-[hover=true]:tw-text-gray-900 aria-selected:tw-text-gray-900
                tw-min-w-[140px] md:tw-min-w-[160px]
                ${isFormView ? "tw-cursor-not-allowed" : ""}
              `}
              tabIndex={isFormView ? -1 : 0}         // 🔒 กันโฟกัสด้วยคีย์บอร์ด
            >
              <span>{t.label}</span>
            </Tab>
          ))}
        </TabsHeader>
      </div>

      <TabsBody
        animate={{ initial: { y: 6, opacity: 0 }, mount: { y: 0, opacity: 1 }, unmount: { y: 6, opacity: 0 } }}
        className="tw-pt-3"
      >
        <TabPanel value="Open" className="tw-p-0">
          <div className="tw-space-y-5"><OpenTables /></div>
        </TabPanel>

        <TabPanel value="In Progress" className="tw-p-0">
          <div className="tw-space-y-5"><InProgressTables /></div>
        </TabPanel>

        <TabPanel value="Closed" className="tw-p-0">
          <div className="tw-space-y-5"><ClosedTables /></div>
        </TabPanel>
      </TabsBody>
    </Tabs>
  );
}
