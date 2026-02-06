// CM
"use client";

import React, { useEffect, useState } from "react";

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

  // ใช้ state แทน useMemo เพื่อให้ sync กับ URL ได้ทันที
  const [active, setActive] = useState<TabId>(() => slugToTab(searchParams.get("tab")));

  // 🔄 Sync active tab กับ URL params
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    const newActive = slugToTab(tabFromUrl);
    if (newActive !== active) {
      setActive(newActive);
    }
  }, [searchParams]);

  // 🔒 อยู่โหมดฟอร์มเมื่อ ?view=form
  const isFormView = searchParams.get("view") === "form";

  const editId = searchParams.get("edit_id") ?? "";
  const mode: "list" | "form" =
    searchParams.get("view") === "form" || !!editId ? "form" : "list";

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

  const go = (next: TabId) => {
    setActive(next); // อัพเดท state ทันที
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabToSlug(next));
    params.delete("stage"); // กันของเก่าค้าง
    params.delete("view");  // ออกจาก form mode
    params.delete("edit_id");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs id="data-tabs" value={active} key={active} className="tw-w-full">
      <div className="tw-w-full tw-flex tw-justify-start tw-overflow-x-auto tw-scrollbar-hide">
        <TabsHeader
          className={`tw-bg-gray-100 tw-rounded-xl tw-p-1 tw-border tw-border-gray-200 tw-overflow-visible tw-w-fit tw-gap-1 tw-m-0
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