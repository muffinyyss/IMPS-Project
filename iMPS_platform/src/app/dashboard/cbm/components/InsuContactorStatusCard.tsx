"use client";

import React from "react";
import { Typography } from "@material-tailwind/react";

/* ---------- types ---------- */
export type StatusItem = {
    id: string;
    name: string;
    value: string | boolean | number | null;
};

export type InsuStatusOnlyCardProps = {
    title?: string;
    updatedAt?: string;
    items: StatusItem[];
};

/* ---------- helpers ---------- */
function toBool(v: StatusItem["value"]) {
    if (typeof v === "boolean") return v;
    if (v == null) return null;
    const s = String(v).trim().toLowerCase();
    const ACTIVE = ["active", "on", "true", "1", "closed", "energized", "enable", "enabled", "run", "running", "fault"];
    const INACTIVE = ["inactive", "off", "false", "0", "open", "deenergized", "normal", "disable", "disabled", "stop", "stopped"];
    if (ACTIVE.includes(s)) return true;
    if (INACTIVE.includes(s)) return false;
    return null;
}

function toneFor(value: StatusItem["value"]) {
    const b = toBool(value);
    if (b === true)
        return {
            bg: "tw-bg-green-100",
            ring: "tw-ring-green-200",
            text: "tw-text-green-800",
            label: "Active",
            dot: "tw-bg-green-500",
        };

    // >>> เปลี่ยน Inactive เป็นสีแดง
    if (b === false)
        return {
            bg: "tw-bg-red-100",
            ring: "tw-ring-red-200",
            text: "tw-text-red-800",
            label: "Inactive",
            dot: "tw-bg-red-500",
        };

    return {
        bg: "tw-bg-amber-100",
        ring: "tw-ring-amber-200",
        text: "tw-text-amber-800",
        label: "Unknown",
        dot: "tw-bg-amber-500",
    };
}

/* ---------- simple row ---------- */
const InsuRow: React.FC<{ label: string; value: StatusItem["value"] }> = ({ label, value }) => {
    const t = toneFor(value);
    return (
        <div className="tw-flex tw-items-center tw-justify-between tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
            <div className="tw-flex tw-items-center tw-gap-3">
                <div className={`tw-h-3.5 tw-w-3.5 tw-rounded-full ${t.dot}`} />
                <div className="tw-text-[14px] tw-font-medium tw-text-blue-gray-900">{label}</div>
            </div>

            <div className={`tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-px-3 tw-py-1.5 tw-text-[13px] ${t.bg} ${t.text} tw-ring-1 ${t.ring}`}>
                {t.label}
            </div>
        </div>
    );
};

/* ---------- card (only 2 lines) ---------- */
const InsuContactorStatusCard: React.FC<InsuStatusOnlyCardProps> = ({
    title = "Insulation Status",
    updatedAt,
    items,
}) => {
    // เลือกเฉพาะ 2 รายการตามชื่อ
    const pick = (name: string) =>
        items.find((it) => it.name.trim().toLowerCase() === name.trim().toLowerCase());

    const target1 = pick("Insulation monitoring No.1 (Active/Inactive)");
    const target2 = pick("Insulation monitoring No.2 (Active/Inactive)");

    return (
        <section className="tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-5 tw-space-y-4">
            <div className="tw-flex tw-items-baseline tw-justify-between">
                <Typography variant="h6" color="blue-gray" className="tw-leading-tight">
                    {title}
                </Typography>
                {updatedAt && <div className="tw-text-[11px] tw-text-blue-gray-400">Updated {updatedAt}</div>}
            </div>

            <div className="tw-flex tw-flex-col tw-gap-3">
                <InsuRow label="Insulation monitoring No.1" value={target1?.value ?? null} />
                <InsuRow label="Insulation monitoring No.2" value={target2?.value ?? null} />
            </div>
        </section>
    );
};

export default InsuContactorStatusCard;
