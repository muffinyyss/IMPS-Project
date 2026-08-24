"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TabId = "Owner" | "Vendor";
type TabSlug = "owner" | "vendor";

const TABS: { id: TabId; label: string; slug: TabSlug }[] = [
  { id: "Owner", label: "Owner", slug: "owner" },
  { id: "Vendor", label: "Vendor", slug: "vendor" },
];

function slugToTab(slug: string | null): TabId {
  switch (slug) {
    case "vendor": return "Vendor";
    case "owner":
    default: return "Owner";
  }
}

function tabToSlug(tab: TabId): TabSlug {
  return TABS.find(t => t.id === tab)!.slug;
}

export default function CompanyPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [active, setActive] = useState<TabId>(() => slugToTab(searchParams.get("tab")));

  // 🔄 Sync active tab กับ URL params
  useEffect(() => {
    const newActive = slugToTab(searchParams.get("tab"));
    if (newActive !== active) {
      setActive(newActive);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!searchParams.get("tab")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabToSlug(active));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [pathname, router, searchParams, active]);

  const go = (next: TabId) => {
    setActive(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabToSlug(next));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="tw-w-full tw-mt-8">
      {/* Custom Tabs — สไตล์เดียวกับหน้า CM report */}
      <div className="tw-w-full tw-flex tw-justify-start tw-overflow-x-auto tw-scrollbar-hide">
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
                  tw-min-w-[130px] md:tw-min-w-[150px]
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
        {active === "Owner" && (
          <div className="tw-space-y-5 tw-animate-[fadeIn_0.3s_ease-out]">
            {/* TODO: ใส่ตาราง/เนื้อหาบริษัทฝั่ง Owner ตรงนี้ */}
            <div className="tw-rounded-xl tw-border tw-border-gray-200 tw-bg-white tw-p-10 tw-text-center tw-text-gray-500">
              Owner — coming soon
            </div>
          </div>
        )}
        {active === "Vendor" && (
          <div className="tw-space-y-5 tw-animate-[fadeIn_0.3s_ease-out]">
            {/* TODO: ใส่ตาราง/เนื้อหาบริษัทฝั่ง Vendor ตรงนี้ */}
            <div className="tw-rounded-xl tw-border tw-border-gray-200 tw-bg-white tw-p-10 tw-text-center tw-text-gray-500">
              Vendor — coming soon
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
