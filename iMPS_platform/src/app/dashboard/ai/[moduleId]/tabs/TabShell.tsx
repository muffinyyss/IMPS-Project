"use client";
import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export interface TabDef {
  key: string;
  label: string;
}

interface Props {
  tabs: TabDef[];
  modNum: number;
  children: (activeTab: string) => React.ReactNode;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

export default function TabShell({ tabs, modNum, children }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || tabs[0]?.key || "";

  const goTab = (key: string) => {
    router.push(`/dashboard/ai/${modNum}?tab=${key}`, { scroll: false });
  };

  return (
    <div className="tw-flex tw-flex-col tw-gap-0">
      {/* Sub-tab bar */}
      <div className="tw-bg-white tw-border-b tw-border-gray-100 tw-px-6 tw-flex tw-gap-1 tw-overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => goTab(t.key)}
            className={`tw-px-4 tw-py-2.5 tw-text-sm tw-border-b-2 tw-font-medium
                        tw-transition-colors tw-whitespace-nowrap
              ${t.key === activeTab
                ? "tw-border-purple-500 tw-text-purple-600"
                : "tw-border-transparent tw-text-gray-500 hover:tw-text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="tw-p-6">
        {children(activeTab)}
      </div>
    </div>
  );
}