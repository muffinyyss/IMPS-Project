"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WrenchScrewdriverIcon, CpuChipIcon, CalendarDaysIcon } from "@heroicons/react/24/solid";
import { data_pmReport as fallback, loadPmReport, type PMReportData } from "@/data";

const shorten = (s: string, max = 22) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

function StatCardClassic({
  item,
}: {
  item: { title: string; value: string; icon: React.ElementType; footer: { color: string; value: string; label: string } };
}) {
  const Icon = item.icon;
  return (
    <div className="tw-rounded-xl tw-bg-white tw-border tw-border-blue-gray-100 tw-shadow-sm tw-overflow-hidden tw-h-full tw-transition-shadow hover:tw-shadow-md">
      {/* Main Content */}
      <div className="tw-flex tw-items-start tw-gap-2 sm:tw-gap-3 lg:tw-gap-4 tw-p-2.5 sm:tw-p-3 lg:tw-p-4">
        {/* Icon Container */}
        <div className="tw-flex tw-items-center tw-justify-center tw-w-8 tw-h-8 sm:tw-w-9 sm:tw-h-9 lg:tw-w-11 lg:tw-h-11 tw-rounded-lg tw-bg-gradient-to-br tw-from-blue-gray-800 tw-to-blue-gray-900 tw-shadow-sm tw-flex-shrink-0">
          <Icon className="tw-w-4 tw-h-4 sm:tw-w-4.5 sm:tw-h-4.5 lg:tw-w-5 lg:tw-h-5 tw-text-white" />
        </div>
        
        {/* Text Content */}
        <div className="tw-flex-1 tw-min-w-0">
          <div className="tw-text-right">
            <p className="tw-text-[9px] sm:tw-text-[10px] lg:tw-text-xs tw-font-medium tw-text-blue-gray-500 tw-leading-tight">
              {item.title}
            </p>
            <p 
              className="tw-text-xs sm:tw-text-sm lg:tw-text-base tw-font-bold tw-text-blue-gray-900 tw-mt-0.5 sm:tw-mt-1 lg:tw-mt-1.5 tw-truncate tw-leading-tight" 
              title={item.value}
            >
              {item.value}
            </p>
          </div>
        </div>
      </div>
      
      {/* Divider */}
      <div className="tw-border-t tw-border-blue-gray-50" />
      
      {/* Footer */}
      <div className="tw-px-2.5 sm:tw-px-3 lg:tw-px-4 tw-py-1.5 sm:tw-py-2 lg:tw-py-3 tw-bg-gray-50/50">
        <p className="tw-text-blue-gray-600 tw-text-[9px] sm:tw-text-[10px] lg:tw-text-xs">
          {item.footer.value && (
            <>
              <span className={`tw-font-semibold ${item.footer.color}`}>{item.footer.value}</span>
              &nbsp;
            </>
          )}
          {item.footer.label || <span className="tw-text-blue-gray-400">—</span>}
        </p>
      </div>
    </div>
  );
}


export default function StatisticsCards() {
  const searchParams = useSearchParams();
  const [sn, setSn] = useState<string | null>(null);
  const [pm, setPm] = useState<PMReportData>(fallback);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // Priority: URL param > localStorage
    const snFromUrl = searchParams.get("sn");
    if (snFromUrl) {
      setSn(snFromUrl);
      localStorage.setItem("selected_sn", snFromUrl);
      return;
    }
    const snLocal = localStorage.getItem("selected_sn");
    setSn(snLocal);
  }, [searchParams]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!sn) { setPm(fallback); setErr(null); return; }
      try {
        setLoading(true);
        setErr(null);
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? undefined : undefined;
        const data = await loadPmReport(sn, token);
        if (alive) setPm(data);
      } catch (e: any) {
        if (alive) { setPm(fallback); setErr(e?.message ?? "Failed to load data"); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [sn]);

  const cards = [
    {
      title: "PLC Firmware",
      value: shorten(pm.firmware.plc),
      icon: pm.icons?.firmware ?? WrenchScrewdriverIcon,
      footer: { color: "tw-text-green-600", value: "", label: "" },
    },
    {
      title: "Raspberry Pi Firmware",
      value: shorten(pm.firmware.rpi),
      icon: CpuChipIcon,
      footer: { color: "tw-text-green-600", value: "", label: "" },
    },
    {
      title: "Router Firmware",
      value: shorten(pm.firmware.router),
      icon: pm.icons?.firmware ?? WrenchScrewdriverIcon,
      footer: { color: "tw-text-green-600", value: "", label: "" },
    },
    {
      title: "PM Schedule",
      value: `Next: ${pm.pm.next}`,
      icon: pm.icons?.date ?? CalendarDaysIcon,
      footer: { color: "tw-text-blue-700", value: "", label: "" },
    },
  ];

  return (
    <div className="tw-px-2 sm:tw-px-0">
      {/* Message when no charger selected */}
      {!sn && (
        <div className="tw-flex tw-items-center tw-gap-2 tw-mt-2 tw-p-2 sm:tw-p-2.5 lg:tw-p-3 tw-bg-blue-50 tw-rounded-lg tw-border tw-border-blue-100">
          <div className="tw-w-1.5 tw-h-1.5 sm:tw-w-2 sm:tw-h-2 tw-rounded-full tw-bg-blue-400 tw-animate-pulse tw-flex-shrink-0" />
          <p className="tw-text-[10px] sm:tw-text-xs lg:tw-text-sm tw-text-blue-gray-600 tw-font-medium">
            Select a charger from the top bar to display PM Report
          </p>
        </div>
      )}
      
      {/* Error Message */}
      {err && (
        <div className="tw-flex tw-items-center tw-gap-2 tw-mt-2 tw-p-2 sm:tw-p-2.5 lg:tw-p-3 tw-bg-red-50 tw-rounded-lg tw-border tw-border-red-100">
          <div className="tw-w-1.5 tw-h-1.5 sm:tw-w-2 sm:tw-h-2 tw-rounded-full tw-bg-red-500 tw-flex-shrink-0" />
          <p className="tw-text-[10px] sm:tw-text-xs lg:tw-text-sm tw-text-red-600 tw-font-medium">
            {err}
          </p>
        </div>
      )}

      {/* Cards Grid */}
      <div 
        className={`
          tw-mt-2.5 sm:tw-mt-3 lg:tw-mt-4 
          tw-mb-2.5 sm:tw-mb-3 lg:tw-mb-4 
          tw-grid tw-gap-2 sm:tw-gap-3 lg:tw-gap-4 xl:tw-gap-5
          tw-min-w-0 
          tw-grid-cols-2 xl:tw-grid-cols-4
          ${loading ? "tw-opacity-50 tw-pointer-events-none" : ""}
          tw-transition-opacity tw-duration-200
        `}
      >
        {cards.map((c) => (
          <div key={c.title} className="tw-min-w-0 tw-h-full">
            <StatCardClassic item={c} />
          </div>
        ))}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="tw-flex tw-justify-center tw-items-center tw-py-2">
          <div className="tw-flex tw-items-center tw-gap-1.5 sm:tw-gap-2 tw-text-blue-gray-500">
            <div className="tw-w-3.5 tw-h-3.5 sm:tw-w-4 sm:tw-h-4 lg:tw-w-5 lg:tw-h-5 tw-border-2 tw-border-blue-500 tw-border-t-transparent tw-rounded-full tw-animate-spin" />
            <span className="tw-text-[10px] sm:tw-text-xs tw-font-medium">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}