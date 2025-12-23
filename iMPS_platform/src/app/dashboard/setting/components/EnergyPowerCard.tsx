"use client";

import React, { useMemo } from "react";
import { Typography } from "@material-tailwind/react";

/* ---------- Props Definition ---------- */
export type EnergyPowerProps = {
    title?: string;
    updatedAt?: string;
    energy1?: number | string | null;
    energy2?: number | string | null;
    unit?: string;
    decimals?: number;
    head: 1 | 2; // เพิ่ม head เพื่อระบุฝั่ง
};

/* ---------- Helper Functions ---------- */
function toNumber(v: any): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
}

function formatNumber(n: number | null, decimals = 0): string {
    if (n === null) return "0"; 
    return n.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/* ---------- EnergyRow (Sub-Component) ---------- */
const EnergyRow: React.FC<{
    label: string;
    value: any;
    unit: string;
    decimals: number;
}> = ({ label, value, unit, decimals }) => {
    const num = toNumber(value);
    return (
        <div className="tw-flex tw-items-center tw-justify-between tw-rounded-2xl tw-border tw-border-blue-gray-50 tw-bg-white tw-p-5 tw-shadow-sm">
            <span className="tw-text-sm tw-font-medium tw-text-blue-gray-700">{label}</span>
            <div className="tw-flex tw-items-baseline tw-gap-1">
                <span className="tw-text-3xl tw-font-bold tw-text-blue-gray-900">
                    {formatNumber(num, decimals)}
                </span>
                <span className="tw-text-xs tw-font-normal tw-text-blue-gray-400">{unit}</span>
            </div>
        </div>
    );
};

/* ---------- Main Component ---------- */
const EnergyPowerCard: React.FC<EnergyPowerProps> = ({
    title = "Energy Power",
    updatedAt,
    energy1 = 0,
    energy2 = 0,
    unit = "kWh",
    decimals = 0,
    head,
}) => {
    // ใช้ useMemo เพื่อเตรียม rows ตามฝั่งที่กำหนด (head)
    const rows = useMemo(() => {
        if (head === 1) {
            return [
                { label: "Energy Power No.1", value: energy1 },
            ];
        } else {
            return [
                { label: "Energy Power No.2", value: energy2 },
            ];
        }
    }, [energy1, energy2, head]);

    return (
        <section className="tw-rounded-3xl tw-border tw-border-blue-gray-50 tw-bg-white tw-p-6 tw-space-y-6">
            {/* Header Section */}
            <div className="tw-flex tw-items-center tw-justify-between">
                <Typography variant="h6" color="blue-gray" className="tw-font-bold">
                    {title} 
                </Typography>
                {updatedAt && (
                    <div className="tw-text-[10px] tw-text-blue-gray-400 tw-whitespace-nowrap">
                        Updated {updatedAt}
                    </div>
                )}
            </div>

            {/* Content Section - วนลูปแสดงเฉพาะข้อมูลที่กรองผ่าน useMemo แล้ว */}
            <div className="tw-flex tw-flex-col tw-gap-4">
                {rows.map((r, i) => (
                    <EnergyRow
                        key={i}
                        label={r.label}
                        value={r.value}
                        unit={unit}
                        decimals={decimals}
                    />
                ))}
            </div>
        </section>
    );
};

export default EnergyPowerCard;