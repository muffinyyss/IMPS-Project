"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
    ExclamationTriangleIcon,
    ExclamationCircleIcon,
    CheckCircleIcon,
    MagnifyingGlassIcon,
    ChevronDownIcon,
    PhotoIcon,
    ClockIcon,
} from "@heroicons/react/24/solid";

/* =========================
   1) Types & Helpers
   ========================= */
type Status = "ok" | "warn" | "error";
type MetricType = "times" | "hour";

type Device = {
    id: string;
    name: string;
    value?: string;
    status: Status;
    imageUrl?: string;
    metricType?: MetricType;
};

const tone = {
    error: {
        bgSoft: "tw-bg-red-50",
        text: "tw-text-red-700",
        bar: "tw-bg-red-600",
        chip: "tw-bg-red-100 tw-text-red-800",
        head: "tw-from-red-50 tw-to-transparent tw-border-red-200",
    },
    warn: {
        bgSoft: "tw-bg-amber-50",
        text: "tw-text-amber-700",
        bar: "tw-bg-amber-500",
        chip: "tw-bg-amber-100 tw-text-amber-800",
        head: "tw-from-amber-50 tw-to-transparent tw-border-amber-200",
    },
    ok: {
        bgSoft: "tw-bg-green-50",
        text: "tw-text-green-700",
        bar: "tw-bg-green-600",
        chip: "tw-bg-green-100 tw-text-green-800",
        head: "tw-from-green-50 tw-to-transparent tw-border-green-200",
    },
} as const;

const HourglassIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
        <path d="M6 2a1 1 0 1 0 0 2h.5c1.1 0 2.1.6 2.6 1.6l.2.4c.2.3.4.6.6.8L12 9l2.1-2.2c.2-.2.4-.5.6-.8l.2-.4C15.4 4.6 16.4 4 17.5 4H18a1 1 0 1 0 0-2H6Zm12 20a1 1 0 1 0 0-2h-.5c-1.1 0-2.1-.6-2.6-1.6l-.2-.4c-.2-.3-.4-.6-.6-.8L12 15l-2.1 2.2c-.2.2-.4.5-.6.8l-.2.4c-.5 1-1.5 1.6-2.6 1.6H6a1 1 0 1 0 0 2h12Z" />
        <path d="M8 5h8c-.2.5-.5 1-.9 1.5L12 9.8 8.9 6.5C8.5 6 8.2 5.5 8 5Zm8 14H8c.2-.5.5-1 .9-1.5L12 14.2l3.1 3.3c.4.5.7 1 .9 1.5Z" />
    </svg>
);

const IconByStatus = ({ s }: { s: Status }) =>
    s === "ok" ? (
        <CheckCircleIcon className="tw-h-4 tw-w-4" />
    ) : s === "warn" ? (
        <ExclamationTriangleIcon className="tw-h-4 tw-w-4" />
    ) : (
        <ExclamationCircleIcon className="tw-h-4 tw-w-4" />
    );

function parseTimes(s?: string) {
    if (!s) return undefined;
    const mH = /(\d+)\s*h/gi.exec(s || "");
    const mM = /(\d+)\s*m/gi.exec(s || "");
    const h = mH ? Number(mH[1]) : 0;
    const m = mM ? Number(mM[1]) : 0;
    return `${h} h ${m} m`;
}

function pickStatus(
    value: number | string | undefined,
    warnAt?: number,
    errorAt?: number
): Status {
    if (value == null) return "warn";
    const n =
        typeof value === "number"
            ? value
            : Number(String(value).replace(/[^\d.-]/g, ""));
    if (isNaN(n)) return "ok";
    if (errorAt != null && n >= errorAt) return "error";
    if (warnAt != null && n >= warnAt) return "warn";
    return "ok";
}

/* =========================
   2) UI Atoms
   ========================= */
function Pill({
    color,
    label,
    value,
}: {
    color: string;
    label: string;
    value: number;
}) {
    return (
        <div className="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-px-4 tw-py-2">
            <span className={`tw-inline-block tw-h-2.5 tw-w-2.5 tw-rounded-full ${color}`} />
            <span className="tw-text-[15px] tw-text-gray-700">{label}</span>
            <span className="tw-text-[15px] tw-font-bold">{value}</span>
        </div>
    );
}

function StatusBadge({ status }: { status: Status }) {
    const t = tone[status];
    return (
        <span
            className={`tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-medium ${t.chip}`}
        >
            <IconByStatus s={status} />
            {status === "ok" ? "ปกติ" : status === "warn" ? "ต้องตรวจสอบ" : "มีปัญหา"}
        </span>
    );
}

// function MetricBadge({
//     value,
//     type,
//     status,
// }: {
//     value?: string;
//     type?: MetricType;
//     status: Status;
// }) {
//     const cls =
//         status === "error"
//             ? "tw-bg-red-100 tw-text-red-800"
//             : status === "warn"
//                 ? "tw-bg-amber-100 tw-text-amber-800"
//                 : "tw-bg-green-100 tw-text-green-800";

//     let display = value ?? "-";

//     if (type === "times") {
//         const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
//         display = isNaN(n) ? value ?? "-" : n.toLocaleString();
//     } else if (type === "hour") {
//         const s = String(value ?? "");
//         const mH = /(\d+)\s*h/i.exec(s);
//         const mM = /(\d+)\s*m/i.exec(s);
//         const h = mH ? Number(mH[1]) : undefined;
//         const m = mM ? Number(mM[1]) : undefined;
//         if (h != null || m != null) {
//             const hh = h != null ? h.toLocaleString() : "0";
//             const mm = m != null ? m : 0;
//             display = `${hh} h ${mm} m`;
//         }
//     }

//     return (
//         <span className={`tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-px-3 tw-py-[6px] tw-text-[12.5px] tw-font-semibold ${cls}`}>
//             {type === "hour" ? <HourglassIcon className="tw-h-4 tw-w-4" /> : <ClockIcon className="tw-h-4 tw-w-4" />}
//             {display}
//         </span>
//     );
// }

function MetricBadge({
    value,
    type,
    status,
}: {
    value?: string;
    type?: MetricType;
    status: Status;
}) {
    const cls =
        status === "error"
            ? "tw-bg-red-100 tw-text-red-800"
            : status === "warn"
                ? "tw-bg-amber-100 tw-text-amber-800"
                : "tw-bg-green-100 tw-text-green-800";

    let display = value ?? "-";

    if (type === "times") {
        const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
        display = isNaN(n) ? value ?? "-" : n.toLocaleString();
    } else if (type === "hour") {
        const s = String(value ?? "");
        const mH = /(\d+)\s*h/i.exec(s);
        const mM = /(\d+)\s*m/i.exec(s);
        const h = mH ? Number(mH[1]) : undefined;
        const m = mM ? Number(mM[1]) : undefined;
        if (h != null || m != null) {
            const hh = h != null ? h.toLocaleString() : "0";
            const mm = m != null ? m : 0;
            display = `${hh} h ${mm} m`;
        }
    }

    return (
        <span
            className={`tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full
                  tw-px-3.5 tw-py-[7px]
                  tw-font-bold tw-tabular-nums tw-whitespace-nowrap
                  tw-text-[14px] md:tw-text-[15px] ${cls}`}
        >
            {type === "hour" ? (
                <HourglassIcon className="tw-h-5 tw-w-5" />
            ) : (
                <ClockIcon className="tw-h-5 tw-w-5" />
            )}
            {display}
        </span>
    );
}


/* =========================
   DeviceCard
   ========================= */
function DeviceCard({ d }: { d: Device }) {
    const t = tone[d.status];
    const valueStr = String(d.value ?? "-").trim();

    return (
        <div className="tw-group tw-relative tw-rounded-2xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-overflow-hidden">
            {/* แถบสีซ้าย */}
            <div className={`tw-absolute tw-left-0 tw-top-0 tw-h-full tw-w-1.5 ${t.bar}`} />

            {/* รูป | เนื้อหา */}
            {/* iPad: ลดขนาดคอลัมน์รูปเพื่อเพิ่มพื้นที่ข้อความ */}
            <div className="tw-grid tw-gap-4 tw-p-4 tw-pl-5
                      tw-grid-cols-[84px_1fr] md:tw-grid-cols-[76px_1fr] lg:tw-grid-cols-[72px_1fr] xl:tw-grid-cols-[88px_1fr]">
                {/* รูป */}
                <div className="tw-relative tw-rounded-xl tw-border tw-border-gray-200 tw-bg-gray-50 tw-overflow-hidden tw-grid tw-place-items-center
                        tw-h-20 tw-w-20 md:tw-h-16 md:tw-w-16 lg:tw-h-16 lg:tw-w-16 xl:tw-h-20 xl:tw-w-20">
                    {d.imageUrl ? (
                        <Image src={d.imageUrl} alt={d.name} fill sizes="96px" className="tw-object-contain tw-p-2" />
                    ) : (
                        <PhotoIcon className="tw-h-8 tw-w-8 tw-text-gray-300" />
                    )}
                </div>

                {/* ขวา: ชื่อ (บน) + ค่า (ล่าง) + สถานะใต้ค่า */}
                <div className="tw-min-w-0">
                    {/* ชื่อ: 2 บรรทัด, iPad ฟอนต์ลดลงเล็กน้อยเพื่อไม่ตัด */}
                    <p
                        className="tw-font-semibold tw-text-right tw-leading-snug tw-whitespace-normal tw-break-words
                       tw-text-[15.5px] md:tw-text-[15px] lg:tw-text-[15px] xl:tw-text-[15.5px]
                       tw-line-clamp-2"
                        title={d.name}
                    >
                        {d.name}
                    </p>

                    {/* ค่า + สถานะ (ขวา) */}
                    <div className="tw-mt-2 tw-grid tw-grid-cols-[1fr_auto] tw-items-end tw-gap-3">
                        <div /> {/* เว้นซ้ายให้บาลานซ์ */}
                        <div className="tw-text-right tw-flex tw-flex-col tw-items-end tw-gap-1">
                            {/* ค่าตัวเลข: 
                                - มือถือ/เดสก์ท็อป: บรรทัดเดียวและ truncate
                                - iPad (md, lg): อนุญาตพับ 2 บรรทัดเพื่อไม่ให้หาย */}
                            <div
                                className={`tw-font-extrabold ${t.text} tw-leading-tight
                                    tw-text-[20px] md:tw-text-[19px] lg:tw-text-[20px] xl:tw-text-[22px]
                                    tw-tabular-nums
                                    tw-max-w-[180px] md:tw-max-w-[280px] lg:tw-max-w-[300px] xl:tw-max-w-[220px]
                                    tw-whitespace-nowrap tw-truncate
                                    md:tw-whitespace-normal md:tw-truncate-0 md:tw-break-words md:tw-line-clamp-2 tw-mb-2`}
                                title={valueStr}
                            >
                                {valueStr}
                            </div>

                            <StatusBadge status={d.status} />
                        </div>
                    </div>
                </div>
            </div>

            {/* hover overlay */}
            <div className={`tw-absolute tw-inset-0 tw-opacity-0 group-hover:tw-opacity-10 ${t.bgSoft} tw-transition-opacity`} />
        </div>
    );
}


/* =========================
   SideList
   ========================= */
function SideList({
    title,
    items,
    filter,
    search,
}: {
    title: string;
    items: Device[];
    filter: "all" | Status;         // ★ เพิ่ม
    search: string;                 // ★ เพิ่ม
}) {
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((d) => {
            const matchText = d.name.toLowerCase().includes(q);
            const matchStatus = filter === "all" ? true : d.status === filter;
            return matchText && matchStatus;
        });
    }, [items, filter, search]);

    return (
        <aside className="tw-rounded-3xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-p-4 sm:tw-p-5">
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                <p className="tw-text-sm tw-font-semibold tw-text-gray-800">{title}</p>
                <div className="tw-hidden sm:tw-flex tw-items-center tw-gap-3 tw-text-[11px] tw-text-gray-500">
                    <span className="tw-inline-flex tw-items-center tw-gap-1.5">
                        <ClockIcon className="tw-h-3.5 tw-w-3.5 tw-text-gray-400" /> Times
                    </span>
                    <span className="tw-inline-flex tw-items-center tw-gap-1.5">
                        <HourglassIcon className="tw-h-3.5 tw-w-3.5 tw-text-gray-400" /> Hour
                    </span>
                </div>
            </div>

            <ul className="tw-space-y-2.5 md:tw-space-y-3">
                {filtered.map((d) => (
                    <li
                        key={d.id}
                        className="
                            tw-grid tw-grid-cols-[56px_1fr] md:tw-grid-cols-[64px_1fr]
                            tw-items-center tw-gap-3 md:tw-gap-4
                            tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white
                            tw-px-3 tw-py-3 md:tw-px-3.5 md:tw-py-3.5
                            hover:tw-shadow-sm tw-transition-shadow
                        "
                    >
                        {/* รูป */}
                        <div className="tw-h-14 tw-w-14 md:tw-h-16 md:tw-w-16 tw-rounded-xl tw-bg-gray-50 tw-border tw-border-gray-200 tw-grid tw-place-items-center tw-overflow-hidden">
                            {d.imageUrl ? (
                                <Image
                                    src={d.imageUrl}
                                    alt={d.name}
                                    width={64}
                                    height={64}
                                    className="tw-object-contain tw-max-h-15 tw-max-w-15 tw-p-1.5"
                                />
                            ) : (
                                <PhotoIcon className="tw-h-7 tw-w-7 md:tw-h-8 md:tw-w-8 tw-text-gray-300" />
                            )}
                        </div>

                        {/* เนื้อหา: ชื่อ (บน) + ค่า (ล่าง) — ชิดขวา */}
                        <div className="tw-min-w-0 tw-flex tw-flex-col tw-items-end">
                            <p
                                className="
                                    tw-w-full tw-text-right
                                    tw-text-[14.5px] md:tw-text-[15px] tw-font-medium tw-text-gray-800
                                    tw-leading-snug tw-whitespace-normal tw-break-words
                                    md:tw-line-clamp-1 xl:tw-truncate
                                "
                                title={d.name}
                            >
                                {d.name}
                            </p>

                            <div className="tw-mt-1">
                                <MetricBadge value={d.value} type={d.metricType} status={d.status} />
                            </div>
                        </div>
                    </li>
                ))}

                {filtered.length === 0 && (
                    <li className="tw-text-center tw-text-sm tw-text-gray-500 tw-py-4">
                        ไม่พบอุปกรณ์ตามตัวกรอง
                    </li>
                )}
            </ul>

        </aside>
    );
}

/* กลุ่มพับได้ + ค้นหา */
function Group({
    status,
    title,
    devices,
    defaultOpen,
    search,
}: {
    status: Status;
    title: string;
    devices: Device[];
    defaultOpen?: boolean;
    search: string;
}) {
    const [open, setOpen] = useState(!!defaultOpen);
    const t = tone[status];
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return devices.filter((d) => d.name.toLowerCase().includes(q));
    }, [devices, search]);

    return (
        <section className="tw-rounded-3xl tw-overflow-hidden tw-ring-1 tw-ring-black/5 tw-bg-white">
            <button
                onClick={() => setOpen((v) => !v)}
                className={`tw-w-full tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-5 tw-py-3 tw-border-b tw-bg-gradient-to-r ${t.head}`}
                aria-expanded={open}
            >
                <div className="tw-flex tw-items-center tw-gap-2">
                    <IconByStatus s={status} />
                    <span className="tw-font-semibold">{title}</span>
                    <span className="tw-text-xs tw-text-gray-500">({devices.length})</span>
                </div>
                <ChevronDownIcon className={`tw-h-4 tw-w-4 tw-transition-transform ${open ? "tw-rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="tw-p-4">
                    {/* iPad (lg:1024–1279) ให้คง 2 คอลัมน์ เพื่อความกว้างของการ์ด */}
                    <div
                        className="tw-grid tw-gap-4
                            sm:tw-grid-cols-1
                            md:tw-grid-cols-1
                            lg:tw-grid-cols-2
                            xl:tw-grid-cols-3
                            2xl:tw-grid-cols-3"
                    >


                        {filtered.map((d) => (
                            <DeviceCard key={d.id} d={d} />
                        ))}
                        {filtered.length === 0 && (
                            <div className="tw-col-span-full tw-text-center tw-text-sm tw-text-gray-500 tw-py-6">
                                ไม่พบรายการในกลุ่มนี้
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

/* =========================
   3) Page (SSE + Mapping)
   ========================= */
export default function DCChargerDashboard() {
    const [live, setLive] = useState<any | null>(null);
    const esRef = useRef<EventSource | null>(null);

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
    const STATION_ID = "Klongluang3";

    useEffect(() => {
        const url = `${API_BASE}/utilization/stream?station_id=${encodeURIComponent(STATION_ID)}`;
        const es = new EventSource(url, { withCredentials: true });
        esRef.current = es;

        es.addEventListener("init", (ev) => {
            try {
                const data = JSON.parse((ev as MessageEvent).data);
                setLive(data);
            } catch { }
        });

        es.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data);
                setLive(data);
            } catch { }
        };

        es.onerror = () => { };
        return () => {
            es.close();
            esRef.current = null;
        };
    }, []);

    // ===== Mapping payload -> UI lists =====
    const { LEFT_LIST, RIGHT_LIST, CENTER_LIST, DEVICES } = useMemo(() => {
        const p = live || {};
        const left: Device[] = [
            { id: "dc-contact-l", name: "DC Power Contactor1", value: String(p.DC_power_contractor1 ?? ""), status: pickStatus(p.DC_power_contractor1, 250000, 300000), metricType: "times" },
            { id: "dc-contact-2", name: "DC Power Contactor2", value: String(p.DC_power_contractor2 ?? ""), status: pickStatus(p.DC_power_contractor2, 250000, 300000), metricType: "times" },
            { id: "dc-contact-5", name: "DC Power Contactor5", value: String(p.DC_power_contractor5 ?? ""), status: pickStatus(p.DC_power_contractor5, 250000, 300000), metricType: "times" },
            { id: "dc-contact-6", name: "DC Power Contactor6", value: String(p.DC_power_contractor6 ?? ""), status: pickStatus(p.DC_power_contractor6, 250000, 300000), metricType: "times" },
            { id: "fuse1-l", name: "FUSE1", value: parseTimes(p.FUSE1), status: "ok", metricType: "hour" },
            // { id: "fuse1-l", name: "FUSE1", value: "25647118 h 2 m", status: "ok", metricType: "hour" },
            { id: "rccb1-l", name: "RCCB1", value: parseTimes(p.RCCB1), status: "ok", metricType: "hour" },
            { id: "ac-contact-l", name: "AC Power Contactor1", value: String(p.AC_power_contractor1 ?? ""), status: pickStatus(p.AC_power_contractor1, 9500000, 10000000), metricType: "times" },
            { id: "motor1-l", name: "Motor Starter1", value: String(p.motor_starter1 ?? ""), status: pickStatus(p.motor_starter1, 9000, 10000), metricType: "times" },
            { id: "motor2-2", name: "Motor Starter2", value: String(p.motor_starter2 ?? ""), status: pickStatus(p.motor_starter2, 9000, 10000), metricType: "times" },
            { id: "emeter1", name: "Energy Meter1", value: parseTimes(p.energyMeter1), status: "ok", metricType: "hour" },
            { id: "charge-ctl1", name: "Charging Controller1", value: parseTimes(p.chargingController1), status: "ok", metricType: "hour" },
            { id: "iso1", name: "Insulation Monitoring1", value: parseTimes(p.insulationMonitoring1), status: "ok", metricType: "hour" },
        ];

        const right: Device[] = [
            { id: "dc-contact-3", name: "DC Power Contactor3", value: String(p.DC_power_contractor3 ?? ""), status: pickStatus(p.DC_power_contractor3, 250000, 300000), metricType: "times" },
            { id: "dc-contact-4", name: "DC Power Contactor4", value: String(p.DC_power_contractor4 ?? ""), status: pickStatus(p.DC_power_contractor4, 250000, 300000), metricType: "times" },
            { id: "fuse2-2", name: "FUSE2", value: parseTimes(p.FUSE2), status: "ok", metricType: "hour" },
            { id: "rccb2-2", name: "RCCB2", value: parseTimes(p.RCCB2), status: "ok", metricType: "hour" },
            { id: "ac-contact-2", name: "AC Power Contactor2", value: String(p.AC_power_contractor2 ?? ""), status: pickStatus(p.AC_power_contractor2, 9500000, 10000000), metricType: "times" },
            { id: "motor3-3", name: "Motor Starter3", value: String(p.motor_starter3 ?? ""), status: pickStatus(p.motor_starter3, 9000, 10000), metricType: "times" },
            { id: "motor4-4", name: "Motor Starter4", value: String(p.motor_starter4 ?? ""), status: pickStatus(p.motor_starter4, 9000, 10000), metricType: "times" },
            { id: "motor5-5", name: "Motor Starter5", value: String(p.motor_starter5 ?? ""), status: pickStatus(p.motor_starter5, 9000, 10000), metricType: "times" },
            { id: "emeter2", name: "Energy Meter2", value: parseTimes(p.energyMeter2), status: "ok", metricType: "hour" },
            { id: "charge-ctl2", name: "Charging Controller2", value: parseTimes(p.chargingController2), status: "ok", metricType: "hour" },
            { id: "iso2", name: "Insulation Monitoring2", value: parseTimes(p.insulationMonitoring2), status: "ok", metricType: "hour" },
        ];

        const center: Device[] = [
            { id: "router-l", name: "Router", value: parseTimes(p.Router), status: "ok", metricType: "hour" },
            { id: "fuse-ctl-l", name: "FUSE Control", value: parseTimes(p.FUSEControl), status: "ok", metricType: "hour" },
            { id: "cb-fan-l", name: "Circuit Breaker fan", value: parseTimes(p.circuitBreakerFan), status: "ok", metricType: "hour" },
            { id: "rcbo-l", name: "RCBO", value: parseTimes(p.RCBO), status: "ok", metricType: "hour" },
            { id: "ocpp-r", name: "OCPP Device", value: parseTimes(p.OCPPDevice), status: "ok", metricType: "hour" },
            { id: "fan-ctl-r", name: "FAN Controller", value: parseTimes(p.fanController), status: "ok", metricType: "hour" },
            { id: "psu-r", name: "Power supplies", value: parseTimes(p.powerSupplies), status: "ok", metricType: "hour" },
            { id: "dc-conv-r", name: "DC Converter", value: parseTimes(p.DCConverter), status: "ok", metricType: "hour" },
            { id: "sp-r", name: "Surge Protection", value: parseTimes(p.surtgeProtection), status: "ok", metricType: "hour" },
            { id: "disc-r", name: "Disconnect Switch", value: parseTimes(p.disconnectSwitch), status: "ok", metricType: "hour" },
            { id: "noise-r", name: "Noise Filter", value: parseTimes(p.noiseFilter), status: "ok", metricType: "hour" },
        ];

        // ★ เปลี่ยนใหม่: รวม center เข้า DEVICES ด้วย เพื่อให้สรุป/กรุ๊ปตรงกัน
        const all: Device[] = [...left, ...right, ...center];

        return { LEFT_LIST: left, RIGHT_LIST: right, CENTER_LIST: center, DEVICES: all };
    }, [live]);

    // ===== UI State (ค้นหา/กรอง) =====
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<"all" | Status>("all");

    const errorList = DEVICES.filter((d) => d.status === "error");
    const warnList = DEVICES.filter((d) => d.status === "warn");
    const okList = DEVICES.filter((d) => d.status === "ok");

    const overall: Status = errorList.length ? "error" : warnList.length ? "warn" : "ok";
    const systemChip =
        overall === "error"
            ? "tw-bg-red-100 tw-text-red-800 tw-border tw-border-red-300"
            : overall === "warn"
                ? "tw-bg-amber-100 tw-text-amber-800 tw-border tw-border-amber-300"
                : "tw-bg-green-100 tw-text-green-800 tw-border tw-border-green-300";

    const FilterBtn = ({
        id,
        label,
        dot,
    }: {
        id: "all" | Status;
        label: string;
        dot?: string;
    }) => (
        <button
            onClick={() => setFilter(id)}
            className={`tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-px-3 tw-py-1.5 tw-text-sm tw-border ${filter === id ? "tw-border-indigo-300 tw-bg-indigo-50 tw-text-indigo-700" : "tw-border-gray-200 tw-bg-white tw-text-gray-700"
                }`}
            aria-pressed={filter === id}
        >
            {dot && <span className={`tw-h-2.5 tw-w-2.5 tw-rounded-full ${dot}`} />}
            {label}
        </button>
    );

    const showError = filter === "all" || filter === "error";
    const showWarn = filter === "all" || filter === "warn";
    const showOk = filter === "all" || filter === "ok";

    /* =========================
       4) Render
       ========================= */
    return (
        // <div className="tw-mx-auto tw-max-w-[1400px] tw-w-full tw-pt-6 md:tw-pt-8">
        <div className="tw-w-full tw-max-w-none tw-mx-auto tw-pt-6 md:tw-pt-8 tw-px-4 md:tw-px-1">

            {/* แผงสรุป/ค้นหา */}
            <div className="tw-rounded-3xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-p-4 md:tw-p-5">
                <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3">
                    <div className="tw-flex tw-flex-wrap tw-gap-2">
                        <Pill color="tw-bg-red-600" label="มีปัญหา" value={errorList.length} />
                        <Pill color="tw-bg-amber-500" label="ต้องตรวจ" value={warnList.length} />
                        <Pill color="tw-bg-green-600" label="ปกติ" value={okList.length} />
                    </div>
                    <span className={`tw-hidden sm:tw-inline-flex tw-rounded-full tw-px-3.5 tw-py-1.5 tw-text-[12px] tw-font-medium ${systemChip}`}>
                        สถานะระบบ: {overall === "error" ? "มีปัญหา" : overall === "warn" ? "ต้องตรวจสอบ" : "ปกติ"}
                    </span>
                </div>

                <div className="tw-mt-4">
                    <label className="tw-text-sm tw-text-gray-700">ค้นหาอุปกรณ์</label>
                    <div className="tw-relative tw-mt-1">
                        <MagnifyingGlassIcon className="tw-absolute tw-left-3 tw-top-2.5 tw-h-5 tw-w-5 tw-text-gray-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="พิมพ์ชื่ออุปกรณ์…"
                            className="tw-w-full tw-pl-11 tw-pr-3.5 tw-py-3 tw-text-base tw-rounded-2xl tw-border tw-border-gray-200  
                                       focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-indigo-200"
                        />
                    </div>
                    <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
                        <FilterBtn id="all" label="ทั้งหมด" />
                        <FilterBtn id="error" label="มีปัญหา" dot="tw-bg-red-600" />
                        <FilterBtn id="warn" label="ต้องตรวจ" dot="tw-bg-amber-500" />
                        <FilterBtn id="ok" label="ปกติ" dot="tw-bg-green-600" />
                    </div>
                </div>
            </div>
            <div
                className="tw-mt-6 tw-grid tw-gap-6 xl:tw-gap-8
             tw-grid-cols-1
             sm:tw-grid-cols-1
             md:tw-grid-cols-1
             lg:tw-grid-cols-2
             xl:tw-grid-cols-3
             2xl:tw-grid-cols-3"
            >
                <SideList title="อุปกรณ์ (ซ้าย)" items={LEFT_LIST} filter={filter} search={query} />
                <SideList title="อุปกรณ์ (ส่วนกลาง)" items={CENTER_LIST} filter={filter} search={query} />
                <SideList title="อุปกรณ์ (ขวา)" items={RIGHT_LIST} filter={filter} search={query} />
            </div>

            {/* รายการแบบจัดกลุ่ม (ตามสถานะ) */}
            <div className="tw-mt-8 tw-space-y-6">
                {showError && (
                    <Group
                        status="error"
                        title="อุปกรณ์ที่มีปัญหา"
                        devices={DEVICES.filter((d) => d.status === "error")}
                        defaultOpen
                        search={query}
                    />
                )}
                {showWarn && DEVICES.some((d) => d.status === "warn") && (
                    <Group
                        status="warn"
                        title="อุปกรณ์ที่ต้องตรวจสอบ"
                        devices={DEVICES.filter((d) => d.status === "warn")}
                        defaultOpen
                        search={query}
                    />
                )}
                {showOk && (
                    <Group
                        status="ok"
                        title="อุปกรณ์สถานะปกติ"
                        devices={DEVICES.filter((d) => d.status === "ok")}
                        defaultOpen={false}
                        search={query}
                    />
                )}
            </div>

            <div className="tw-h-10" />
        </div>
    );
}