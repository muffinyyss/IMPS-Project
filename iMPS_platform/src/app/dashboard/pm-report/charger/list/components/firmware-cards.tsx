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
    <div className="tw-rounded-2xl tw-bg-white tw-border tw-border-blue-gray-100 tw-shadow-sm tw-overflow-hidden tw-h-full">
      <div className="tw-flex tw-items-start tw-gap-4 tw-p-5">
        <div className="tw-flex tw-items-center tw-justify-center tw-w-11 tw-h-11 tw-rounded-xl tw-bg-blue-gray-900/90">
          <Icon className="tw-w-6 tw-h-6 tw-text-white" />
        </div>
        <div className="tw-flex-1 tw-min-w-0">
          <div className="tw-text-right">
            <p className="tw-text-sm tw-font-medium tw-text-blue-gray-600 tw-leading-none">{item.title}</p>
            <p className="md:tw-text-base sm:tw-text-lg tw-font-extrabold tw-text-blue-gray-900 tw-mt-2 tw-truncate" title={item.value}>
              {item.value}
            </p>
          </div>
        </div>
      </div>
      <div className="tw-border-t tw-border-blue-gray-100" />
      <div className="tw-px-5 tw-py-4">
        <p className="tw-text-blue-gray-700">
          <span className="tw-font-semibold tw-text-green-600">{item.footer.value}</span>&nbsp;{item.footer.label}
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
    <>
      {!sn && <p className="tw-text-sm tw-text-blue-gray-500 tw-mt-2">Select a charger from the top bar to display PM Report</p>}
      {err && <p className="tw-text-sm tw-text-red-600 tw-mt-2">{err}</p>}

      <div className={`tw-mt-4 tw-mb-4 tw-grid tw-gap-6 tw-min-w-0 tw-grid-cols-1 sm:tw-grid-cols-2 xl:tw-grid-cols-4 ${loading ? "tw-opacity-60" : ""}`}>
        {cards.map((c) => (
          <div key={c.title} className="tw-min-w-0 tw-h-full">
            <StatCardClassic item={c} />
          </div>
        ))}
      </div>
    </>
  );
}