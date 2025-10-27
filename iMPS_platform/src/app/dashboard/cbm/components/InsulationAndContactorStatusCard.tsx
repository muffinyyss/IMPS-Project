"use client";

import React from "react";
import { Typography } from "@material-tailwind/react";

/* ---------- types ---------- */
export type StatusItem = {
  id: string;
  name: string;
  value: string | boolean | number | null;
  keyName?: string;
};

export type InsuContactorStatusCardProps = {
  title?: string;
  updatedAt?: string;
  items: StatusItem[];
  imageSrc?: string;
  imageAlt?: string;
  showRaw?: boolean; // เปิด/ปิดบรรทัด Raw (ดีฟอลต์: true)
};

/* ---------- header image slot (with placeholder) ---------- */
const HeaderImageSlot: React.FC<{ src?: string; alt?: string }> = ({ src, alt }) => {
  if (src) {
    return (
      <img
        src={src}
        alt={alt || "device image"}
        className="tw-h-10 tw-w-10 tw-rounded-lg tw-object-cover tw-border tw-border-blue-gray-100"
      />
    );
  }
  return (
    <div
      className="tw-h-10 tw-w-10 tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-blue-gray-50 tw-text-blue-gray-400 tw-flex tw-items-center tw-justify-center"
      aria-label="No image"
      title="No image"
    >
      <svg viewBox="0 0 24 24" className="tw-h-5 tw-w-5" fill="none" stroke="currentColor">
        <path d="M4 8h3l2-2h6l2 2h3v10H4V8Z" strokeWidth="1.5" />
        <circle cx="12" cy="13" r="3.5" strokeWidth="1.5" />
      </svg>
    </div>
  );
};

/* ---------- helpers ---------- */
function toBool(v: StatusItem["value"]) {
  if (typeof v === "boolean") return v;
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  const ACTIVE = ["active","on","true","1","closed","energized","enable","enabled","run","running","fault"];
  const INACTIVE = ["inactive","off","false","0","open","deenergized","normal","disable","disabled","stop","stopped"];
  if (ACTIVE.includes(s)) return true;
  if (INACTIVE.includes(s)) return false;
  return null;
}

function toneFor(value: StatusItem["value"]) {
  const b = toBool(value);
  if (b === true)
    return {
      capsule: "tw-bg-green-100 tw-text-green-800",
      chip: "tw-bg-green-50 tw-text-green-700 tw-ring-1 tw-ring-green-100",
      label: "Active",
      icon: (
        <svg viewBox="0 0 24 24" className="tw-h-4 tw-w-4 tw-text-green-700" fill="none" stroke="currentColor">
          <path d="M20 6L9 17l-5-5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    };
  if (b === false)
    return {
      capsule: "tw-bg-blue-gray-100 tw-text-blue-gray-800",
      chip: "tw-bg-blue-gray-50 tw-text-blue-gray-700 tw-ring-1 tw-ring-blue-gray-100",
      label: "Inactive",
      icon: (
        <svg viewBox="0 0 24 24" className="tw-h-4 tw-w-4 tw-text-blue-gray-700" fill="none" stroke="currentColor">
          <path d="M6 6l12 12M18 6L6 18" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    };
  return {
    capsule: "tw-bg-amber-100 tw-text-amber-800",
    chip: "tw-bg-amber-50 tw-text-amber-700 tw-ring-1 tw-ring-amber-100",
    label: "Unknown",
    icon: (
      <svg viewBox="0 0 24 24" className="tw-h-4 tw-w-4 tw-text-amber-700" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
        <path d="M12 8v4" strokeWidth="1.5" />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </svg>
    ),
  };
}

/* ---------- cleaner, airy tile ---------- */
const StatusTile: React.FC<StatusItem & { showRaw?: boolean }> = ({ name, value, keyName, showRaw = true }) => {
  const tone = toneFor(value);
  const rawText = value == null ? "—" : String(value);

  return (
    <div
      className="
        tw-flex tw-flex-col tw-gap-3 tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4
      "
    >
      {/* header: ชื่อ 2 บรรทัดได้ */}
      <div className="tw-text-[12px] tw-font-semibold tw-text-blue-gray-900 tw-leading-snug tw-line-clamp-2" title={name}>
        {name}
      </div>

      {/* status capsule ใหญ่ กลางการ์ด */}
      <div className="tw-flex tw-items-center tw-justify-center">
        <span className={`tw-inline-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-rounded-full tw-text-[13px] ${tone.capsule}`}>
          {tone.icon}
          {tone.label}
        </span>
      </div>

      {/* meta: key + raw (เรียงซ้าย/ขวา) */}
      <div className="tw-flex tw-items-center tw-justify-between">
        <span className={`tw-text-[10px] tw-rounded-full tw-px-2 tw-py-[3px] ${tone.chip}`}>{keyName || "Signal"}</span>
        {showRaw && (
          <span className="tw-text-[11px] tw-text-blue-gray-500">
            Raw:&nbsp;<span className="tw-text-blue-gray-800 tw-font-medium">{rawText}</span>
          </span>
        )}
      </div>
    </div>
  );
};

/* ---------- card ---------- */
const InsuContactorStatusCard: React.FC<InsuContactorStatusCardProps> = ({
  title = "Insulation & Contactor Status",
  updatedAt,
  items,
  imageSrc,
  imageAlt = "Status device",
  showRaw = true,
}) => {
  return (
    <section className="tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-5">
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
        <Typography variant="h6" color="blue-gray" className="tw-leading-tight">
          {title}
        </Typography>
        <HeaderImageSlot src={imageSrc} alt={imageAlt} />
      </div>
      {updatedAt && <div className="tw-text-[11px] tw-text-blue-gray-400 tw-mb-3">Updated {updatedAt}</div>}

      {/* ปรับคอลัมน์ให้โล่ง: 1 (มือถือ) → 2 (จอใหญ่) */}
      <div className="tw-grid tw-gap-4 tw-grid-cols-1 md:tw-grid-cols-2 [&>div]:tw-h-full">
        {items.length === 0 ? (
          <div className="tw-col-span-full tw-text-center tw-text-sm tw-text-blue-gray-400 tw-py-6">No status data</div>
        ) : (
          items.map((it) => <StatusTile key={it.id} {...it} showRaw={showRaw} />)
        )}
      </div>
    </section>
  );
};

export default InsuContactorStatusCard;
