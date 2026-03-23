"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import ChargeBoxId from "./components/ChargeBoxId";
import Head1 from "./components/Head1";
import Head2 from "./components/Head2";
import EnergyPowerCard from "./components/EnergyPowerCard";
import EvPanel from "./components/EvPanel";
import PowerModule from "./components/PowerModule";
import InfoPanel from "./components/InfoPanel";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/utils/api"; // ← ปรับ path ตามโปรเจกต์
import BarProgress from "./components/BarProgress";
const POLL_INTERVAL_MS = 30_000;

export default function SettingPage() {
  const [data, setData] = useState<any>(null);
  const searchParams = useSearchParams();
  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SN =
    searchParams.get("SN") ||
    (typeof window !== "undefined" ? localStorage.getItem("selected_sn") : null);

  const fetchData = useCallback(
    async (signal: AbortSignal) => {
      if (!SN) return;
      try {
        const res = await apiFetch(`/setting/latest?SN=${encodeURIComponent(SN)}`, { signal });
        if (!res.ok) return;
        const parsed = await res.json();
        setData(parsed);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Setting fetch error:", err);
      }
    },
    [SN]
  );

  useEffect(() => {
    if (!SN) return;

    abortRef.current?.abort();
    if (pollRef.current) clearInterval(pollRef.current);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    fetchData(ctrl.signal);

    pollRef.current = setInterval(() => {
      const c = new AbortController();
      abortRef.current = c;
      fetchData(c.signal);
    }, POLL_INTERVAL_MS);

    return () => {
      abortRef.current?.abort();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [SN, fetchData]);

  /* ── connector label badge ── */
  const ConnectorLabel = ({
    no,
    color,
  }: {
    no: number;
    color: "blue" | "green";
  }) => {
    const palette =
      color === "blue"
        ? "tw-text-blue-600 tw-bg-blue-50 tw-border-blue-100"
        : "tw-text-green-600 tw-bg-green-50 tw-border-green-100";
    return (
      <div className="tw-flex tw-items-center tw-gap-3">
        <div className="tw-h-px tw-flex-1 tw-bg-blue-gray-100" />
        <span
          className={`tw-px-4 tw-py-1.5 tw-text-xs tw-font-semibold tw-tracking-wide tw-rounded-full tw-border ${palette}`}
        >
          CONNECTOR {no}
        </span>
        <div className="tw-h-px tw-flex-1 tw-bg-blue-gray-100" />
      </div>
    );
  };

  /* ── two-column row wrapper ── */
  const Row = ({ children }: { children: React.ReactNode }) => (
    <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-6 tw-items-stretch [&>*]:tw-h-full">
      {children}
    </div>
  );

  return (
    <div className="tw-space-y-6 tw-mt-8">
      {/* Charge Box ID */}
      <ChargeBoxId />

      {/* Connector labels */}
      <Row>
        <ConnectorLabel no={1} color="blue" />
        <ConnectorLabel no={2} color="blue" />
      </Row>

      {/* Head */}
      <Row>
        <Head1 />
        <Head2 />
      </Row>

      {/* Energy / Power */}
      <Row>
        <EnergyPowerCard head={1} data={data} />
        <EnergyPowerCard head={2} data={data} />
      </Row>

      {/* EV Panel */}
      <Row>
        <EvPanel head={1} data={data} />
        <EvPanel head={2} data={data} />
      </Row>

      {/* Power Module */}
      <Row>
        <PowerModule head={1} data={data} />
        <PowerModule head={2} data={data} />
      </Row>

      {/* Info Panel */}
      <Row>
        <InfoPanel head={1} data={data} />
        <InfoPanel head={2} data={data} />
      </Row>
    </div>
  );
}