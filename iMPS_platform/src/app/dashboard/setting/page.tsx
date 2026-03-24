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
      <ChargeBoxId />

      {/* Timestamp */}
      {data?.timestamp && (
        <div className="tw-sticky tw-top-0 tw-z-10 -tw-mx-4 tw-px-4 tw-py-2 tw-bg-white/80 tw-backdrop-blur-sm tw-border-b tw-border-blue-gray-100 lg:tw-static lg:tw-mx-0 lg:tw-px-0 lg:tw-py-0 lg:tw-bg-transparent lg:tw-backdrop-blur-none lg:tw-border-0">
          <div className="tw-flex tw-items-center tw-gap-2 tw-justify-end">
            <span className="tw-inline-flex tw-items-center tw-gap-2 tw-px-3 tw-py-1.5 tw-rounded-full tw-bg-blue-gray-50 tw-border tw-border-blue-gray-100 tw-shadow-sm">
              <span className="tw-relative tw-flex tw-h-2 tw-w-2">
                <span className="tw-animate-ping tw-absolute tw-inline-flex tw-h-full tw-w-full tw-rounded-full tw-bg-green-400 tw-opacity-75" />
                <span className="tw-relative tw-inline-flex tw-h-2 tw-w-2 tw-rounded-full tw-bg-green-500" />
              </span>
              <svg className="tw-w-3.5 tw-h-3.5 tw-text-blue-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="tw-text-[11px] tw-font-medium tw-text-blue-gray-500">อัปเดตล่าสุด</span>
              <span className="tw-text-[11px] tw-font-bold tw-text-blue-gray-700 tw-tabular-nums">
                {new Date(data.timestamp).toLocaleString("th-TH", { timeZone: "UTC" })}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* ════ MOBILE layout (< lg) ════ */}
      <div className="tw-space-y-4 lg:tw-hidden">
        {/* Connector 1 */}
        <ConnectorLabel no={1} color="blue" />
        <Head1 />
        <EnergyPowerCard head={1} data={data} />
        <EvPanel head={1} data={data} />
        <PowerModule head={1} data={data} />
        <InfoPanel head={1} data={data} />

        {/* Connector 2 */}
        <ConnectorLabel no={2} color="green" />
        <Head2 />
        <EnergyPowerCard head={2} data={data} />
        <EvPanel head={2} data={data} />
        <PowerModule head={2} data={data} />
        <InfoPanel head={2} data={data} />
      </div>

      {/* ════ DESKTOP layout (>= lg) — เหมือนเดิมทุกอย่าง ════ */}
      <div className="tw-hidden lg:tw-block tw-space-y-6">
        <Row>
          <ConnectorLabel no={1} color="blue" />
          <ConnectorLabel no={2} color="blue" />
        </Row>
        <Row>
          <Head1 />
          <Head2 />
        </Row>
        <Row>
          <EnergyPowerCard head={1} data={data} />
          <EnergyPowerCard head={2} data={data} />
        </Row>
        <Row>
          <EvPanel head={1} data={data} />
          <EvPanel head={2} data={data} />
        </Row>
        <Row>
          <PowerModule head={1} data={data} />
          <PowerModule head={2} data={data} />
        </Row>
        <Row>
          <InfoPanel head={1} data={data} />
          <InfoPanel head={2} data={data} />
        </Row>
      </div>

    </div>
  );
}