"use client";

import React from "react";
import { Typography } from "@material-tailwind/react";

/* ---------- props ---------- */
export type EnergyPowerCardProps = {
    title?: string;
    updatedAt?: string;
    /** ค่า Energy Power No.1 (เช่นจาก data.dikW) */
    energy1: number | string | null | undefined;
    /** ค่า Energy Power No.2 (เช่นจาก data.diKW) */
    energy2: number | string | null | undefined;
    /** ปรับหน่วยได้ (ดีฟอลต์ kWh) */
    unit?: string;
    /** ปรับจำนวนทศนิยมได้ (int แนะนำ 0) */
    decimals?: number;
};

/* ---------- utils ---------- */
function toNumber(v: number | string | null | undefined): number | null {
    if (v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
}

function formatNumber(n: number | null, decimals = 0): string {
    if (n === null) return "—";
    return n.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/* ---------- row ---------- */
const EnergyRow: React.FC<{
    label: string;
    value: number | string | null | undefined;
    unit: string;
    decimals: number;
}> = ({ label, value, unit, decimals }) => {
    const num = toNumber(value);
    return (
        <div className="tw-flex tw-items-center tw-justify-between tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-4">
            <div className="tw-text-[14px] tw-font-medium tw-text-blue-gray-900">{label}</div>
            <div className="tw-flex tw-items-baseline tw-gap-2">
                <div className="tw-text-[22px] tw-font-semibold tw-text-blue-gray-900">
                    {formatNumber(num, decimals)}
                </div>
                <div className="tw-text-[12px] tw-text-blue-gray-500">{unit}</div>
            </div>
        </div>
    );
};

/* ---------- card ---------- */
const EnergyPowerCard: React.FC<EnergyPowerCardProps> = ({
    title = "Energy Power",
    updatedAt,
    energy1,
    energy2,
    unit = "kWh",
    decimals = 0, // ค่าเป็น int ตามสเปค
}) => {
    return (
        <section className="tw-h-full tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-5 tw-space-y-4">
            <div className="tw-flex tw-items-baseline tw-justify-between">
                <Typography variant="h6" color="blue-gray" className="tw-leading-tight">
                    {title}
                </Typography>
                {updatedAt && (
                    <div className="tw-text-[11px] tw-text-blue-gray-400">Updated {updatedAt}</div>
                )}
            </div>

            <div className="tw-flex tw-flex-col tw-gap-3">
                <EnergyRow
                    label="Energy Power No.1"
                    value={energy1}
                    unit={unit}
                    decimals={decimals}
                />
                <EnergyRow
                    label="Energy Power No.2"
                    value={energy2}
                    unit={unit}
                    decimals={decimals}
                />
            </div>
        </section>
    );
};

export default EnergyPowerCard;
