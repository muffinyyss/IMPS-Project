"use client";

import React from "react";
import { Typography } from "@material-tailwind/react";

/* ---------- types ---------- */
export type DCContactorItem = {
    id: string;
    name: string;                    // เช่น "DC Contactor No.1 (Times)"
    times: number | string | null;   // จำนวนครั้ง (int)
    mode?: "NC" | "NO" | string;     // ถ้ามี: "NC" หรือ "NO"
};

export type DCContactorsTimesCardProps = {
    title?: string;
    updatedAt?: string;
    unit?: string;        // ดีฟอลต์: "Times"
    decimals?: number;    // ดีฟอลต์: 0
    /** ค่าที่จะแทนเมื่อ times เป็น null; ดีฟอลต์ = 0 (ถ้าอยากได้ "—" ให้ส่ง null แทน) */
    nullFallback?: number | null;
    items: DCContactorItem[]; // ส่งเข้ามา 6 รายการ
    className?: string;   // ใช้ต่อคลาสจากภายนอก (เช่น tw-h-full)
};

/* ---------- utils ---------- */
function toNumber(v: number | string | null): number | null {
    if (v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
}

function formatNumber(
    n: number | null,
    decimals = 0,
    nullFallback: number | null = 0
): string {
    // ถ้าเป็น null ให้ใช้ค่า fallback (ดีฟอลต์ 0); ถ้า fallback = null จะคืนค่า "—"
    const value = n === null ? nullFallback : n;
    if (value === null) return "—";
    return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/* ---------- small chip ---------- */
function ModeChip({ mode }: { mode?: string }) {
    if (!mode) return null;
    const isNC = String(mode).toUpperCase() === "NC";
    const tone = isNC
        ? "tw-bg-blue-gray-50 tw-text-blue-gray-700 tw-ring-blue-gray-100"
        : "tw-bg-cyan-50 tw-text-cyan-700 tw-ring-cyan-100";
    return (
        <span className={`tw-text-[10px] tw-rounded-full tw-px-2 tw-py-[3px] tw-ring-1 ${tone}`}>
            {mode.toUpperCase()}
        </span>
    );
}

/* ---------- row ---------- */
const Row: React.FC<{
    label: string;
    times: number | string | null;
    unit: string;
    decimals: number;
    nullFallback: number | null;
    mode?: string;
}> = ({ label, times, unit, decimals, nullFallback, mode }) => {
    const num = toNumber(times);
    return (
        <div className="tw-flex tw-items-center tw-justify-between tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
            <div className="tw-flex tw-items-center tw-gap-2">
                <ModeChip mode={mode} />
                <div className="tw-text-[14px] tw-font-medium tw-text-blue-gray-900">{label}</div>
            </div>
            <div className="tw-flex tw-items-baseline tw-gap-2">
                <div className="tw-text-[22px] tw-font-semibold tw-text-blue-gray-900">
                    {formatNumber(num, decimals, nullFallback)}
                </div>
                <div className="tw-text-[12px] tw-text-blue-gray-500">{unit}</div>
            </div>
        </div>
    );
};

/* ---------- card ---------- */
const DCContactorsTimesCard: React.FC<DCContactorsTimesCardProps> = ({
    title = "DC Contactor",
    updatedAt,
    unit = "Times",
    decimals = 0,
    nullFallback = 0,  // <<< เปลี่ยนตรงนี้: ดีฟอลต์ให้แทน null ด้วย 0
    items,
    className,
}) => {
    return null;
    return (
        <section
            className={`tw-h-full tw-flex tw-flex-col tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-5 ${className ?? ""}`}
        >
            <div className="tw-flex tw-items-baseline tw-justify-between tw-mb-4">
                <Typography variant="h6" color="blue-gray" className="tw-leading-tight">
                    {title}
                </Typography>
                {updatedAt && <div className="tw-text-[11px] tw-text-blue-gray-400">Updated {updatedAt}</div>}
            </div>

            {/* กริด 2 คอลัมน์; ให้กินพื้นที่ที่เหลือทั้งหมดของการ์ด */}
            <div className="tw-grid tw-gap-3 tw-grid-cols-1 md:tw-grid-cols-2 tw-flex-1">
                {items.map((it) => (
                    <Row
                        key={it.id}
                        label={it.name}
                        times={it.times}
                        unit={unit}
                        decimals={decimals}
                        nullFallback={nullFallback}
                        mode={it.mode}
                    />
                ))}
            </div>
        </section>
    );
};

export default DCContactorsTimesCard;
