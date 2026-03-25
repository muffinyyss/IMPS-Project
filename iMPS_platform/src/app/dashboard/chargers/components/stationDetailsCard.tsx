"use client";

import { useEffect, useState } from "react";

type Lang = "th" | "en";

export type StationDetailCardProps = {
  station_name?: string | null;
  model?: string | null;
  SN?: string | null;
  WO?: string | null;
  brand?: string | null;
  power?: string | null;
  status?: boolean | null;
};

const translations = {
  th: {
    stationInfo: "ข้อมูลสถานี",
    stationName: "ชื่อสถานี",
    brand: "ยี่ห้อ",
    serialNumber: "หมายเลขเครื่อง",
    workOrder: "ใบสั่งงาน",
    model: "รุ่น",
    power: "กำลังไฟ",
    status: "สถานะ",
    online: "ออนไลน์",
    offline: "ออฟไลน์",
  },
  en: {
    stationInfo: "Station Information",
    stationName: "Station Name",
    brand: "Brand",
    serialNumber: "Serial Number",
    workOrder: "Work Order",
    model: "Model",
    power: "Power",
    status: "Status",
    online: "Online",
    offline: "Offline",
  },
};

const InfoRow = ({
  label,
  value,
  badge,
}: {
  label: string;
  value?: React.ReactNode;
  badge?: { text: string; className: string };
}) => (
  <div className="tw-flex tw-justify-between tw-items-center tw-gap-4 tw-mb-3">
    <dt className="tw-text-sm tw-text-blue-gray-500 tw-font-medium tw-shrink-0">
      {label}
    </dt>
    <dd className="tw-text-blue-gray-900 tw-font-medium tw-text-right tw-min-w-0 tw-flex-1">
      {badge ? (
        <span className={`tw-inline-flex tw-items-center tw-px-2.5 tw-py-1 tw-rounded tw-text-sm tw-font-medium ${badge.className}`}>
          {badge.text}
        </span>
      ) : (
        <span>{value ?? "-"}</span>
      )}
    </dd>
  </div>
);

export default function StationDetailCard({
  station_name,
  model,
  SN,
  WO,
  brand,
  power,
  status,
}: StationDetailCardProps) {
  const [lang, setLang] = useState<Lang>("th");

  useEffect(() => {
    const saved = localStorage.getItem("app_language") as Lang | null;
    if (saved === "th" || saved === "en") setLang(saved);
    const h = (e: CustomEvent<{ lang: Lang }>) => setLang(e.detail.lang);
    window.addEventListener("language:change", h as EventListener);
    return () => window.removeEventListener("language:change", h as EventListener);
  }, []);

  const t = translations[lang];

  const statusColor =
    status === true
      ? "tw-bg-green-100 tw-text-green-700"
      : "tw-bg-red-100 tw-text-red-700";
  const statusText = status === true ? t.online : t.offline;

  return (
    <div className="tw-pb-4">
      <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700 tw-mb-4">
        {t.stationInfo}
      </h3>
      <InfoRow label={t.stationName} value={station_name} />
      <InfoRow label={t.brand} value={brand} />
      <InfoRow label={t.serialNumber} value={SN} />
      <InfoRow label={t.workOrder} value={WO} />
      <InfoRow label={t.model} value={model} />
      <InfoRow label={t.power} value={power} />
      <InfoRow label={t.status} badge={{ text: statusText, className: statusColor }} />
    </div>
  );
}