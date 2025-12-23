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

const InfoPanel = ({ head }: { head: 1 | 2 }) => {
    const searchParams = useSearchParams();
    const [stationId, setStationId] = useState<string | null>(null);
    const [data, setData] = useState<SettingDoc | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // ดึง station_id จาก URL หรือ localStorage
    useEffect(() => {
        const sidFromUrl = searchParams.get("station_id");
        if (sidFromUrl) {
            setStationId(sidFromUrl);
            localStorage.setItem("selected_station_id", sidFromUrl);
            return;
        }
        const sidLocal = localStorage.getItem("selected_station_id");
        setStationId(sidLocal);
    }, [searchParams]);

    useEffect(() => {
        if (!stationId) return;

        setLoading(true);
        setErr(null);

        const es = new EventSource(
            `${process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000"}/setting?station_id=${encodeURIComponent(stationId)}`,
            { withCredentials: true } // สำหรับ cookie-auth
        );

        es.onopen = () => setErr(null);
        es.onmessage = (e) => {
            try {
                const obj = JSON.parse(e.data);
                setData(obj);
                setLoading(false);
            } catch {
                setErr("ผิดรูปแบบข้อมูล");
                setLoading(false);
            }
        };

        es.onerror = () => {
            setErr("SSE หลุดการเชื่อมต่อ (กำลังพยายามเชื่อมใหม่อัตโนมัติ)");
            setLoading(false);
        };

        return () => es.close();
    }, [stationId]);

    // ฟังก์ชันแปลงค่าจาก true/false เป็นข้อความที่เหมาะสม
    const formatFaultStatus = (status?: boolean): string => {
        return status === true ? "Fault" : status === false ? "No Fault" : "N/A";
    };

        const rows = useMemo(() => {
            // ตรวจสอบความปลอดภัย: ถ้า data เป็น null ให้ส่งอาร์เรย์ว่างกลับไปก่อ

            if (head === 1) {
                // แสดงเฉพาะข้อมูลของ Head 1
                return [
                    { label: "IMD Status Head 1", value: data?.insulation_monitoring1 ?? "N/A" },
                    { label: "Insulation (kohm) Head 1", value: data?.insulation_kohm1 ?? "N/A" },
                    { label: "Isolation Status Head 1", value: formatFaultStatus(data?.insulation_fault1) },
                ];
            } else {
                // แสดงเฉพาะข้อมูลของ Head 2
                return [
                    { label: "IMD Status Head 2", value: data?.insulation_monitoring2 ?? "N/A" },
                    { label: "Insulation (kohm) Head 2", value: data?.insulation_kohm2 ?? "N/A" },
                    { label: "Isolation Status Head 2", value: formatFaultStatus(data?.insulation_fault2) },
                ];
            }
        }, [data, head]);
    return (
        <Card title={`Info (Head ${head})`}>
            {/* แสดงสถานะการโหลดหรือข้อผิดพลาด */}
            {(loading || err) && (
                <div className="tw-px-3 tw-py-2">
                    {loading && <div className="tw-text-sm tw-text-blue-gray-600">กำลังโหลด...</div>}
                    {err && <div className="tw-text-sm tw-text-red-600">{err}</div>}
                </div>
            )}

            <div className="tw-rounded-lg tw-overflow-hidden">
                {rows.map((r, i) => (
                    <Row key={i} label={r.label} value={r.value} zebra={i % 2 === 1} />
                ))}
            </div>
        </Card>
    );
};

// แสดงแถวข้อมูล
function Row({
    label,
    value,
    zebra = false,
}: {
    label: string;
    value: string;
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
                {value}
            </span>
        </div>
    );
}

export default InfoPanel;
