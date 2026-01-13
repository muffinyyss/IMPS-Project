"use client";
import { useEffect, useState } from "react";

type Lang = "th" | "en";

export type StationInfoProps = {
  station_name?: string;
  model?: string;
  SN?: string | null;
  WO?: string | null;
  brand?: string | null;
  power?: string | null;
  status?: boolean | null;
  commissioningDate?: string | null;
  warrantyYears?: string | null;
  PLCFirmware?: string | null;
  PIFirmware?: string | null;
  RTFirmware?: string | null;
};

// ===== Translations =====
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
    servicePeriod: "ระยะเวลาการใช้งาน",
    commissioningDate: "วันที่เริ่มใช้งาน",
    daysInService: "ระยะเวลาใช้งาน",
    warrantyInfo: "ข้อมูลการรับประกัน",
    warrantyPeriod: "ระยะเวลารับประกัน",
    expirationDate: "วันหมดประกัน",
    daysRemaining: "เหลืออีก",
    firmware: "เฟิร์มแวร์",
    expired: "หมดประกันแล้ว",
    years: "ปี",
    year: "ปี",
    months: "เดือน",
    month: "เดือน",
    days: "วัน",
    day: "วัน",
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
    servicePeriod: "Service Period",
    commissioningDate: "Commissioning Date",
    daysInService: "Days in Service",
    warrantyInfo: "Warranty Information",
    warrantyPeriod: "Warranty Period",
    expirationDate: "Expiration Date",
    daysRemaining: "Days Remaining",
    firmware: "Firmware",
    expired: "Expired",
    years: "years",
    year: "year",
    months: "months",
    month: "month",
    days: "days",
    day: "day",
  },
};

export default function StationInfo({
  station_name,
  SN,
  WO,
  brand,
  model,
  power,
  status,
  commissioningDate,
  warrantyYears,
  PLCFirmware,
  PIFirmware,
  RTFirmware,
}: StationInfoProps) {
  // ===== Language State =====
  const [lang, setLang] = useState<Lang>("th");

  useEffect(() => {
    // Load initial language from localStorage
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") {
      setLang(savedLang);
    }

    // Listen for language change events
    const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => {
      setLang(e.detail.lang);
    };

    window.addEventListener("language:change", handleLangChange as EventListener);
    return () => {
      window.removeEventListener("language:change", handleLangChange as EventListener);
    };
  }, []);

  const t = translations[lang];

  const statusColor =
    status === true
      ? "tw-bg-green-100 tw-text-green-700"
      : "tw-bg-red-100 tw-text-red-700";

  const statusText = status === true ? t.online : t.offline;

  // ===== Helper Functions =====
  const formatDuration = (years: number, months: number, days: number): string => {
    if (years > 0) {
      return `${years} ${years > 1 ? t.years : t.year} ${months} ${months !== 1 ? t.months : t.month}`;
    }
    if (months > 0) {
      return `${months} ${months !== 1 ? t.months : t.month} ${days} ${days !== 1 ? t.days : t.day}`;
    }
    return `${days} ${days !== 1 ? t.days : t.day}`;
  };

  const calculateDaysInUse = (commitDateStr: string | null | undefined): string => {
    if (!commitDateStr) return "-";
    try {
      const commitDate = new Date(commitDateStr);
      const today = new Date();
      const diffTime = today.getTime() - commitDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return "-";

      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      const days = Math.floor((diffDays % 365) % 30);

      return formatDuration(years, months, days);
    } catch {
      return "-";
    }
  };

  const daysInUse = calculateDaysInUse(commissioningDate);

  const calculateRemainingWarrantyDays = (
    commitDateStr: string | null | undefined,
    warrantyYearsNum: number | null | undefined
  ): string => {
    if (!commitDateStr || !warrantyYearsNum) return "-";
    try {
      const commitDate = new Date(commitDateStr);
      const warrantyEndDate = new Date(
        commitDate.getFullYear() + warrantyYearsNum,
        commitDate.getMonth(),
        commitDate.getDate()
      );
      const today = new Date();
      const diffTime = warrantyEndDate.getTime() - today.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) return t.expired;

      const years = Math.floor(diffDays / 365);
      const months = Math.floor((diffDays % 365) / 30);
      const days = Math.floor((diffDays % 365) % 30);

      return formatDuration(years, months, days);
    } catch {
      return "-";
    }
  };

  const remainingWarrantyDays = calculateRemainingWarrantyDays(
    commissioningDate,
    warrantyYears ? parseInt(warrantyYears) : null
  );

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      
      if (lang === "th") {
        // Thai format: DD MMM YYYY (Buddhist Era)
        const day = date.getDate().toString().padStart(2, "0");
        const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        const month = thaiMonths[date.getMonth()];
        const year = date.getFullYear() + 543; // Buddhist Era
        return `${day} ${month} ${year}`;
      } else {
        // English format: DD MMM YYYY
        const day = date.getDate().toString().padStart(2, "0");
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
      }
    } catch {
      return "-";
    }
  };

  const calculateWarrantyExpirationDate = (
    commitDateStr: string | null | undefined,
    warrantyYearsNum: number | null | undefined
  ): string => {
    if (!commitDateStr || !warrantyYearsNum) return "-";
    try {
      const commitDate = new Date(commitDateStr);
      const warrantyEndDate = new Date(
        commitDate.getFullYear() + warrantyYearsNum,
        commitDate.getMonth(),
        commitDate.getDate()
      );
      return formatDate(warrantyEndDate.toISOString());
    } catch {
      return "-";
    }
  };

  const warrantyExpirationDate = calculateWarrantyExpirationDate(
    commissioningDate,
    warrantyYears ? parseInt(warrantyYears) : null
  );

  const getWarrantyColor = (warrantyDaysStr: string): string => {
    if (warrantyDaysStr === t.expired || warrantyDaysStr === "Expired" || warrantyDaysStr === "หมดประกันแล้ว") {
      return "tw-bg-red-50 tw-text-red-700";
    }

    const parts = warrantyDaysStr.split(" ");
    let totalDays = 0;

    for (let i = 0; i < parts.length; i++) {
      if (parts[i + 1]?.includes("year") || parts[i + 1]?.includes("ปี")) {
        totalDays += parseInt(parts[i]) * 365;
      } else if (parts[i + 1]?.includes("day") || parts[i + 1]?.includes("วัน")) {
        totalDays += parseInt(parts[i]);
      }
    }

    if (totalDays > 365) {
      return "tw-bg-green-50 tw-text-green-700";
    } else if (totalDays > 90) {
      return "tw-bg-blue-50 tw-text-blue-700";
    } else if (totalDays > 30) {
      return "tw-bg-amber-50 tw-text-amber-700";
    } else {
      return "tw-bg-red-50 tw-text-red-700";
    }
  };

  const InfoRow = ({
    label,
    value,
    badge,
    truncate = false,
  }: {
    label: string;
    value?: React.ReactNode;
    badge?: { text: string; className: string };
    truncate?: boolean;
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
          <span
            className={truncate ? 'tw-truncate tw-block tw-max-w-[180px] tw-ml-auto' : ''}
            title={truncate && typeof value === 'string' ? value : undefined}
          >
            {value ?? "-"}
          </span>
        )}
      </dd>
    </div>
  );

  return (
    <div className="tw-h-full tw-flex tw-flex-col">
      <div className="tw-flex-1 tw-overflow-auto tw-p-6">
        <dl className="tw-space-y-6">
          {/* Station Information Section */}
          <div className="tw-border-b tw-border-blue-gray-200 tw-pb-4">
            <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700 tw-mb-4">
              {t.stationInfo}
            </h3>
            <InfoRow label={t.stationName} value={station_name} />
            <InfoRow label={t.brand} value={brand} />
            <InfoRow label={t.serialNumber} value={SN} />
            <InfoRow label={t.workOrder} value={WO} />
            <InfoRow label={t.model} value={model} />
            <InfoRow label={t.power} value={power} />
            <InfoRow
              label={t.status}
              badge={{ text: statusText, className: statusColor }}
            />
          </div>

          {/* Service Period Section */}
          <div className="tw-border-b tw-border-blue-gray-200 tw-pb-4">
            <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700 tw-mb-4">
              {t.servicePeriod}
            </h3>
            <InfoRow label={t.commissioningDate} value={formatDate(commissioningDate)} />
            <InfoRow
              label={t.daysInService}
              badge={{ text: daysInUse, className: "tw-bg-blue-50 tw-text-blue-700" }}
            />
          </div>

          {/* Warranty Section */}
          <div className="tw-border-b tw-border-blue-gray-200 tw-pb-4">
            <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700 tw-mb-4">
              {t.warrantyInfo}
            </h3>
            <InfoRow
              label={t.warrantyPeriod}
              value={warrantyYears ? `${warrantyYears} ${t.years}` : "-"}
            />
            <InfoRow label={t.expirationDate} value={warrantyExpirationDate} />
            <InfoRow
              label={t.daysRemaining}
              badge={{ text: remainingWarrantyDays, className: getWarrantyColor(remainingWarrantyDays) }}
            />
          </div>

          {/* Firmware */}
          <div className="tw-pb-4">
            <h3 className="tw-text-sm tw-font-semibold tw-text-blue-gray-700 tw-mb-4">
              {t.firmware}
            </h3>
            <InfoRow label="PLC" value={PLCFirmware} truncate={true} />
            <InfoRow label="PI" value={PIFirmware} truncate={true} />
            <InfoRow label="Router" value={RTFirmware} truncate={true} />
          </div>
        </dl>
      </div>
    </div>
  );
}