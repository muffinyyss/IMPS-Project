"use client";
import React, { useState } from "react";
import Card from "./chargerSetting-card";
import { BoltIcon, PlayIcon, StopIcon, ArrowPathIcon } from "@heroicons/react/24/solid";

/* ---------- Slider (มีสีเติมด้านซ้าย) ---------- */
function LimitRow({
  label, unit, value, onChange, min = 0, max = 200,
}: {
  label: string; unit: string; value: number;
  onChange: (v: number) => void; min?: number; max?: number;
}) {
  const percent = ((value - min) * 100) / (max - min);

  // สีสามารถปรับได้ตามธีมคุณ
  const fillColor = "#ca3333ff";      // emerald-600 (ส่วนที่เติม)
  const trackColor = "#E5EDF2";     // โทนใกล้ blue-gray-100 (พื้นหลัง)

  return (
    <div className="tw-space-y-2">
      <div className="tw-flex tw-items-end tw-justify-between">
        <span className="tw-text-sm tw-text-blue-gray-700">{label}</span>
        <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-900">
          {value} {unit}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        /* พื้นหลังเป็นกราเดียนต์: ซ้ายเป็นสีเขียว ขวาเป็นสีพื้น */
        style={{
          background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${percent}%, ${trackColor} ${percent}%, ${trackColor} 100%)`,
        }}
        className={[
          "tw-w-full tw-appearance-none tw-h-2 tw-rounded-full",
          "tw-bg-transparent", // ใช้กราเดียนต์แทน bg class
          // แต่งหัวหมุด (WebKit/Chromium)
          "tw-[&::-webkit-slider-thumb]:appearance-none",
          "tw-[&::-webkit-slider-thumb]:h-4 tw-[&::-webkit-slider-thumb]:w-4",
          "tw-[&::-webkit-slider-thumb]:rounded-full tw-[&::-webkit-slider-thumb]:bg-white",
          "tw-[&::-webkit-slider-thumb]:shadow tw-[&::-webkit-slider-thumb]:ring-1 tw-[&::-webkit-slider-thumb]:ring-black/10",
          // แต่งหัวหมุด (Firefox)
          "tw-[&::-moz-range-thumb]:h-4 tw-[&::-moz-range-thumb]:w-4",
          "tw-[&::-moz-range-thumb]:rounded-full tw-[&::-moz-range-thumb]:bg-white",
          "tw-[&::-moz-range-thumb]:border tw-[&::-moz-range-thumb]:border-blue-gray-200",
        ].join(" ")}
      />
    </div>
  );
}


/* ---------- ชิพสถานะ ---------- */
function StatusChip({ charging }: { charging: boolean }) {
  return (
    <span
      className={`tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-px-2 tw-py-0.5 tw-text-[12px] tw-font-medium
        ${charging ? "tw-bg-green-50 tw-text-green-700" : "tw-bg-red-50 tw-text-red-700"}`}
      aria-live="polite"
    >
      <span className={`tw-h-1.5 tw-w-1.5 tw-rounded-full ${charging ? "tw-bg-green-500" : "tw-bg-red-500"}`} />
      {charging ? "Charging" : "Stopped"}
    </span>
  );
}

/* ---------- ปุ่มหลัก Start/Stop ---------- */
function PrimaryCTA({
  charging, busy, onStart, onStop,
}: { charging: boolean; busy?: boolean; onStart: () => void; onStop: () => void; }) {
  const base =
    "tw-inline-flex tw-items-center tw-justify-center tw-gap-2 tw-rounded-lg tw-h-10 tw-px-4 tw-text-sm tw-font-semibold tw-text-white tw-shadow-sm focus-visible:tw-ring-2 tw-transition";
  const color = charging
    ? "tw-bg-red-500 hover:tw-bg-red-600 focus-visible:tw-ring-red-300"
    : "tw-bg-green-500 hover:tw-bg-green-600 focus-visible:tw-ring-green-300";
  return (
    <button
      type="button"
      disabled={busy}
      onClick={charging ? onStop : onStart}
      className={`${base} ${color} ${busy ? "tw-opacity-60 tw-cursor-wait" : ""} tw-w-full md:tw-w-auto`}
      aria-label={charging ? "Stop charging" : "Start charging"}
      title={charging ? "Stop" : "Start"}
    >
      {busy ? (
        <ArrowPathIcon className="tw-w-5 tw-h-5 tw-animate-spin" />
      ) : charging ? (
        <StopIcon className="tw-w-5 tw-h-5" />
      ) : (
        <PlayIcon className="tw-w-5 tw-h-5" />
      )}
      <span>{charging ? "Stop" : "Start"}</span>
    </button>
  );
}

/* ---------- การ์ดหัวชาร์จ: โครงสร้างคอลัมน์ + footer ปุ่ม ---------- */
function HeadRow({
  title, charging, busy, onStart, onStop,
}: { title: string; charging: boolean; busy?: boolean; onStart: () => void; onStop: () => void; }) {
  return (
    <div
      className={`
        tw-h-full tw-overflow-hidden tw-rounded-xl tw-border tw-bg-white tw-shadow-sm
        ${charging ? "tw-border-green-100" : "tw-border-blue-gray-100"}
      `}
    >
      {/* content */}
      <div className="tw-flex tw-flex-col tw-h-full tw-p-4 md:tw-p-5 tw-items-center">
        {/* header */}
        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-space-y-2 tw-w-full">
          <div
            className={`tw-grid tw-place-items-center tw-h-12 tw-w-12 tw-rounded-full tw-ring-1
              ${charging
                ? "tw-bg-green-50 tw-text-green-600 tw-ring-green-100"
                : "tw-bg-blue-gray-50 tw-text-blue-gray-500 tw-ring-blue-gray-100"}
            `}
          >
            <BoltIcon className="tw-w-6 tw-h-6" />
          </div>
          <div className="tw-min-w-0 tw-justify-center">
            <div className="tw-font-semibold tw-text-blue-gray-900 tw-mt-3">{title}</div>
            <div className="tw-mt-3 tw-flex tw-justify-center"><StatusChip charging={charging} /></div>
          </div>
        </div>

        {/* footer: เส้นคั่นยาวเต็มการ์ด + ปุ่มกึ่งกลาง */}
        <div className="tw-mt-4 -tw-mx-4 md:-tw-mx-5">
          <div className="tw-pt-3 tw-flex tw-justify-center">
            <PrimaryCTA charging={charging} busy={!!busy} onStart={onStart} onStop={onStop} />
          </div>
        </div>

      </div>
    </div>
  );
}

/* ------------------------------ Main ------------------------------- */
export default function ControlPanel() {
  const [maxCurrent, setMaxCurrent] = useState(66);
  const [maxPower, setMaxPower] = useState(136);

  const [h1Charging, setH1Charging] = useState(false);
  const [h2Charging, setH2Charging] = useState(false);
  const [busyH1, setBusyH1] = useState(false);
  const [busyH2, setBusyH2] = useState(false);

  // จุดต่อ backend จริง (แก้ endpoint ตามระบบคุณ)
  async function chargeCommand(head: 1 | 2, action: "start" | "stop") {
    // await fetch(`/api/charger/${head}/${action}`, { method: "POST" });
  }

  const startH1 = async () => { try { setBusyH1(true); await chargeCommand(1, "start"); setH1Charging(true); } finally { setBusyH1(false); } };
  const stopH1 = async () => { try { setBusyH1(true); await chargeCommand(1, "stop"); setH1Charging(false); } finally { setBusyH1(false); } };
  const startH2 = async () => { try { setBusyH2(true); await chargeCommand(2, "start"); setH2Charging(true); } finally { setBusyH2(false); } };
  const stopH2 = async () => { try { setBusyH2(true); await chargeCommand(2, "stop"); setH2Charging(false); } finally { setBusyH2(false); } };

  return (
    <Card title="Control">
      <div className="tw-space-y-8">
        <div className="tw-space-y-6">
          <LimitRow label="Dynamic Max Current" unit="A" value={maxCurrent} onChange={setMaxCurrent} />
          <LimitRow label="Dynamic Max Power" unit="kW" value={maxPower} onChange={setMaxPower} />
          {/* <p className="tw-text-xs tw-text-blue-gray-500">
            * ค่าที่กำหนดนี้เป็นเพดานแบบไดนามิก ระบบจะไม่จ่ายเกินค่านี้
          </p> */}
        </div>

        {/* หัว 1/2: grid ที่ยืดสูงเท่ากัน */}
        <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
          <HeadRow title="Charger Head 1" charging={h1Charging} busy={busyH1} onStart={startH1} onStop={stopH1} />
          <HeadRow title="Charger Head 2" charging={h2Charging} busy={busyH2} onStart={startH2} onStop={stopH2} />
        </div>
      </div>
    </Card>
  );
}
