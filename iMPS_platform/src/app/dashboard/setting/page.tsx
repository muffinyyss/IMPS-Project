"use client";
import React, { useState, useEffect } from "react";
import ChargeBoxId from "./components/ChargeBoxId";
import Head1 from "./components/Head1";
import Head2 from "./components/Head2";
import EnergyPowerCard from "./components/EnergyPowerCard";
import EvPanel from "./components/EvPanel";
import PowerModule from "./components/PowerModule";
import InfoPanel from "./components/InfoPanel";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function SettingPage() {
  const [data, setData] = useState(null);
  const searchParams = useSearchParams();
  const SN = searchParams.get("SN") || localStorage.getItem("selected_sn");

  useEffect(() => {
    if (!SN) return;

    const es = new EventSource(
      `${API_BASE}/setting?SN=${SN}`,
      { withCredentials: true }
    );

    const onData = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        console.log("Data received:", parsed);
        setData(parsed);
      } catch (err) {
        console.error("JSON Parse Error:", err);
      }
    };

    es.onmessage = onData;
    es.addEventListener("init", onData);

    es.onerror = (e) => {
      console.error("EventSource failed:", e);
    };

    return () => es.close();
  }, [SN]);

  return (
    <div className="tw-space-y-6 tw-mt-8">
      {/* Charge Box ID */}
      <ChargeBoxId />

      {/* Main Grid - Two Columns */}
      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-6">
        {/* Connector 1 */}
        <div className="tw-space-y-6">
          {/* Section Header */}
          <div className="tw-flex tw-items-center tw-gap-3">
            <div className="tw-h-px tw-flex-1 tw-bg-blue-gray-100" />
            <span className="tw-px-4 tw-py-1.5 tw-text-xs tw-font-semibold tw-tracking-wide tw-text-blue-600 tw-bg-blue-50 tw-rounded-full tw-border tw-border-blue-100">
              CONNECTOR 1
            </span>
            <div className="tw-h-px tw-flex-1 tw-bg-blue-gray-100" />
          </div>

          <Head1 />
          <EnergyPowerCard head={1} data={data} />
          <EvPanel head={1} data={data} />
          <PowerModule head={1} data={data} />
          <InfoPanel head={1} data={data} />
        </div>

        {/* Connector 2 */}
        <div className="tw-space-y-6">
          {/* Section Header */}
          <div className="tw-flex tw-items-center tw-gap-3">
            <div className="tw-h-px tw-flex-1 tw-bg-blue-gray-100" />
            <span className="tw-px-4 tw-py-1.5 tw-text-xs tw-font-semibold tw-tracking-wide tw-text-green-600 tw-bg-green-50 tw-rounded-full tw-border tw-border-green-100">
              CONNECTOR 2
            </span>
            <div className="tw-h-px tw-flex-1 tw-bg-blue-gray-100" />
          </div>

          <Head2 />
          <EnergyPowerCard head={2} data={data} />
          <EvPanel head={2} data={data} />
          <PowerModule head={2} data={data} />
          <InfoPanel head={2} data={data} />
        </div>
      </div>
    </div>
  );
}