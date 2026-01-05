"use client";
import React, { useEffect, useMemo, useState } from "react";
import Card from "./chargerSetting-card";
import { useSearchParams } from "next/navigation";

type SettingDoc = {
    insulation_monitoring1?: string;
    insulation_monitoring2?: string;
    insulation_kohm1?: string;
    insulation_kohm2?: string;
    insulation_fault1?: boolean;  // ใช้ boolean แทน string
    insulation_fault2?: boolean;  // ใช้ boolean แทน string
};

export default function InfoPanel({ head, data }: { head: 1 | 2; data: any }) {

    // ฟังก์ชันแปลงค่าจาก true/false เป็นข้อความที่เหมาะสม
    const formatFaultStatus = (status?: boolean): string => {
        return status === true ? "Fault" : status === false ? "No Fault" : "N/A";
    };

        const rows = useMemo(() => {

            const config1 = [
            // รายการข้อมูลสำหรับ Head 1
                    { label: "IMD Status Head 1", value: (data?.insulation_monitoring1 == "1") ? "active" : "inactive" },
                    { label: "Insulation Head 1", value: data?.insulation_kohm1 ?? "N/A", unit: "kohm" },
                    { label: "Isolation Status Head 1", value: formatFaultStatus(data?.insulation_fault1) },
                ];
            const config2 = [
            // รายการข้อมูลสำหรับ Head 2
                    { label: "IMD Status Head 2", value: (data?.insulation_monitoring2 == "1") ? "active" : "inactive" },
                    { label: "Insulation Head 2", value: data?.insulation_kohm2 ?? "N/A", unit: "kohm" },
                    { label: "Isolation Status Head 2", value: formatFaultStatus(data?.insulation_fault2) },
                ];
            return head === 1 ? config1 : config2;
            }, [data , head]);
    return (
        <Card title={`Info Head ${head}`}>
            {/* แสดงสถานะการโหลดหรือข้อผิดพลาด */}
            {!data && (
                <div className="tw-px-3 tw-py-2">
                    <div className="tw-text-sm tw-text-blue-gray-600">กำลังโหลดข้อมูล...</div>
                </div>
            )}

            <div className="tw-rounded-lg tw-overflow-hidden">
                {data && rows.map((r, i) => (
                    <Row key={i} label={r.label} value={r.value} unit={r.unit} zebra={i % 2 === 1} />
                ))}
            </div>
        </Card>
    );
};

// แสดงแถวข้อมูล
function Row({
    label,
    value,
    unit,
    zebra = false,
}: {
    label: string;
    value: string;
    unit?: string;
    zebra?: boolean;
}) {
    return (
        <div
            className={`tw-grid tw-grid-cols-2 tw-gap-2 tw-py-2 tw-px-3
        ${zebra ? "tw-bg-blue-gray-50/60" : "tw-bg-white"}
      `}
        >
            <span className="tw-text-sm tw-text-blue-gray-700">{label}</span>
            <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-900 tw-text-right tw-tabular-nums">
                {value}{unit && (<span className="tw-ml-2 tw-text-sm tw-font-normal tw-text-blue-gray-400">{unit}</span>)}
            </span>
        </div>
    );
}


