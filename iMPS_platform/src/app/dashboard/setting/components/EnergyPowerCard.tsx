"use client";
import React, { useMemo } from "react";
import { Typography } from "@material-tailwind/react";
import Card from "./chargerSetting-card";

/* ---------- Props Definition ---------- */
export type EnergyPowerProps = {
    title?: string;
    data: any; 
    unit?: string;
    decimals?: number;
    head: 1 | 2; 
};

/* ---------- Helper Functions ---------- */

function toNumber(v: any): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
}


const formatComma = (val: any) => {
    const num = toNumber(val);
    if (num === null) return "0";
    return num.toLocaleString("en-US");
};

/* ---------- EnergyRow (Sub-Component) ---------- */
const EnergyRow: React.FC<{
    label: string;
    value: any;
    unit: string;
}> = ({ label, value, unit }) => {
    return (
        <div className="tw-flex tw-items-center tw-justify-between tw-rounded-2xl tw-border tw-border-blue-gray-50 tw-bg-white tw-p-5 tw-shadow-sm">
            <span className="tw-text-sm tw-font-medium tw-text-blue-gray-700">{label}</span>
            <div className="tw-flex tw-items-baseline tw-gap-1">
                <span className="tw-text-sm tw-font-bold tw-text-blue-gray-900">
                    {formatComma(value)}
                </span>
                <span className="tw-text-xs tw-font-normal tw-text-blue-gray-400">{unit}</span>
            </div>
        </div>
    );
};
/* ---------- Main Component ---------- */
const EnergyPowerCard: React.FC<EnergyPowerProps> = ({
    title = "Energy Power",
    data, //  รับมาใช้
    unit = "kWh",
    decimals = 0,
    head,
}) => {
    //  ดึง timestamp จาก data มาจัดรูปแบบ
    const updatedAt = data?.timestamp 
        ? new Date(data.timestamp).toLocaleString("th-TH") 
        : null;

    //  ปรับให้ดึงค่าจาก data ก้อนใหญ่ตามฝั่ง (head)
    const rows = useMemo(() => {
        const config1 = [
                { label: "Energy Power No.1", value: data?.energy_power_kWh1 },
            ];
        const config2 = [
                { label: "Energy Power No.2", value: data?.energy_power_kWh2 },
            ];
        return head === 1 ? config1 : config2;
    }, [data, head]); // ใส่ data และ head ใน dependency

    return (
        <Card
            title={
                <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
                    <span>{title} Head {head}</span>
                    {updatedAt && (
                        <span className="tw-text-[10px] !tw-text-blue-gray-400 tw-font-normal">
                            อัปเดตล่าสุด {updatedAt}
                        </span>
                    )}
                </div>
            }
        >
            <div className="tw-space-y-4">
                {/* แสดง Loading */}
                {!data && (
                    <div className="tw-text-center tw-py-2 tw-text-sm tw-text-blue-gray-400">
                        กำลังโหลดข้อมูล...
                    </div>
                )}
                
                {/* แสดงข้อมูล */}
                {data && rows.map((r, i) => (
                    <EnergyRow
                        key={i}
                        label={r.label}
                        value={r.value}
                        unit={unit}
                    />
                ))}
            </div>
        </Card>
    );
};

export default EnergyPowerCard;