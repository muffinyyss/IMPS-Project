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
        <span className={`tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-px-3 tw-py-[6px] tw-text-[12.5px] tw-font-semibold ${cls}`}>
            {type === "hour" ? <HourglassIcon className="tw-h-4 tw-w-4" /> : <ClockIcon className="tw-h-4 tw-w-4" />}
            {display}
        </span>
    );
}

/* =========================
   DeviceCard
   ========================= */
// function DeviceCard({ d }: { d: Device }) {
//     const t = tone[d.status];
//     const valueStr = String(d.value ?? "-").trim();

//     return (
//         <div className="tw-group tw-relative tw-rounded-2xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-overflow-hidden">
//             {/* แถบสีซ้าย */}
//             <div className={`tw-absolute tw-left-0 tw-top-0 tw-h-full tw-w-1.5 ${t.bar}`} />

//             {/* รูป | เนื้อหา */}
//             <div className="tw-grid tw-grid-cols-[88px_1fr] tw-gap-4 tw-p-4 tw-pl-5">
//                 {/* รูป */}
//                 <div className="tw-relative tw-h-20 tw-w-20 tw-rounded-xl tw-border tw-border-gray-200 tw-bg-gray-50 tw-overflow-hidden tw-grid tw-place-items-center">
//                     {d.imageUrl ? (
//                         <Image src={d.imageUrl} alt={d.name} fill sizes="96px" className="tw-object-contain tw-p-2" />
//                     ) : (
//                         <PhotoIcon className="tw-h-9 tw-w-9 tw-text-gray-300" />
//                     )}
//                 </div>

//                 {/* ขวา: ชื่อ (บน) + ค่า(ล่าง) + สถานะใต้ค่า */}
//                 <div className="tw-min-w-0">
//                     <p
//                         className="tw-font-semibold tw-text-[15.5px] tw-text-gray-900 tw-leading-snug
//                        tw-whitespace-normal tw-break-words tw-text-right tw-line-clamp-2"
//                         title={d.name}
//                     >
//                         {d.name}
//                     </p>

//                     <div className="tw-mt-2 tw-grid tw-grid-cols-[1fr_auto] tw-items-end tw-gap-3">
//                         <div />
//                         <div className="tw-text-right tw-flex tw-flex-col tw-items-end tw-gap-1">
//                             {/* ขนาดคงที่: เล็กลงทุกค่า */}
//                             <div
//                                 className={`tw-font-extrabold ${t.text} tw-leading-none
//                                     tw-text-[20px] md:tw-text-[22px]
//                                     tw-max-w-[180px] md:tw-max-w-[220px]
//                                     tw-whitespace-nowrap tw-truncate tw-tabular-nums tw-mb-2`}
//                                 title={valueStr}
//                             >
//                                 {valueStr}
//                             </div>
//                             <StatusBadge status={d.status} />
//                         </div>
//                     </div>
//                 </div>
//             </div>

//             <div className={`tw-absolute tw-inset-0 tw-opacity-0 group-hover:tw-opacity-10 ${t.bgSoft} tw-transition-opacity`} />
//         </div>
//     );
// }

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
                                    md:tw-whitespace-normal md:tw-truncate-0 md:tw-break-words md:tw-line-clamp-2`}
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
                        className="tw-grid tw-grid-cols-[56px_1fr_auto] md:tw-grid-cols-[64px_1fr_auto] tw-items-center tw-gap-3 md:tw-gap-4 tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-p-3.5 hover:tw-shadow-sm tw-transition-shadow"
                    >
                        <div className="tw-h-14 tw-w-14 md:tw-h-16 md:tw-w-16 tw-rounded-xl tw-bg-gray-50 tw-border tw-border-gray-200 tw-grid tw-place-items-center tw-overflow-hidden">
                            {d.imageUrl ? (
                                <Image
                                    src={d.imageUrl}
                                    alt={d.name}
                                    width={64}
                                    height={64}
                                    className="tw-object-contain tw-max-h-14 tw-max-w-14 tw-p-1.5"
                                />
                            ) : (
                                <PhotoIcon className="tw-h-6 tw-w-6 md:tw-h-7 md:tw-w-7 tw-text-gray-300" />
                            )}
                        </div>
                        <span className="tw-text-[14.5px] md:tw-text-[15px] tw-font-medium tw-text-gray-800 tw-truncate">
                            {d.name}
                        </span>
                        <div className="tw-justify-self-end">
                            <MetricBadge value={d.value} type={d.metricType} status={d.status} />
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
                    {/* <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2 lg:tw-grid-cols-3 xl:tw-grid-cols-4"> */}
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

    const API_BASE = "http://localhost:8000";
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
            { id: "dc-contact-l", name: "DC Power Contactor1", value: String(p.DC_power_contractor1 ?? ""), status: pickStatus(p.DC_power_contractor1, 30, 40), metricType: "times" },
            { id: "dc-contact-2", name: "DC Power Contactor2", value: String(p.DC_power_contractor2 ?? ""), status: pickStatus(p.DC_power_contractor2, 30, 40), metricType: "times" },
            { id: "dc-contact-5", name: "DC Power Contactor5", value: String(p.DC_power_contractor5 ?? ""), status: pickStatus(p.DC_power_contractor5, 30, 40), metricType: "times" },
            { id: "dc-contact-6", name: "DC Power Contactor6", value: String(p.DC_power_contractor6 ?? ""), status: pickStatus(p.DC_power_contractor6, 30, 40), metricType: "times" },
            { id: "fuse1-l", name: "FUSE1", value: parseTimes(p.FUSE1), status: "ok", metricType: "hour" },
            // { id: "fuse1-l", name: "FUSE1", value: "25647118 h 2 m", status: "ok", metricType: "hour" },
            { id: "rccb1-l", name: "RCCB1", value: parseTimes(p.RCCB1), status: "ok", metricType: "hour" },
            { id: "ac-contact-l", name: "AC Power Contactor1", value: String(p.AC_power_contractor1 ?? ""), status: pickStatus(p.AC_power_contractor1, 30, 40), metricType: "times" },
            { id: "motor1-l", name: "Motor Starter1", value: String(p.moter_starter1 ?? ""), status: pickStatus(p.moter_starter1, 1, 5), metricType: "times" },
            { id: "motor2-2", name: "Motor Starter2", value: String(p.moter_starter2 ?? ""), status: pickStatus(p.moter_starter2, 1, 5), metricType: "times" },
            { id: "emeter1", name: "Energy Meter1", value: parseTimes(p.energyMeter1), status: "ok", metricType: "hour" },
            { id: "charge-ctl1", name: "Charging Controller1", value: parseTimes(p.chargingController1), status: "ok", metricType: "hour" },
            { id: "iso1", name: "Insulation Monitoring1", value: parseTimes(p.insulationMonitoring1), status: "ok", metricType: "hour" },
        ];

        const right: Device[] = [
            { id: "dc-contact-3", name: "DC Power Contactor3", value: String(p.DC_power_contractor3 ?? ""), status: pickStatus(p.DC_power_contractor3, 30, 40), metricType: "times" },
            { id: "dc-contact-4", name: "DC Power Contactor4", value: String(p.DC_power_contractor4 ?? ""), status: pickStatus(p.DC_power_contractor4, 30, 40), metricType: "times" },
            { id: "fuse2-2", name: "FUSE2", value: parseTimes(p.FUSE2), status: "ok", metricType: "hour" },
            { id: "rccb2-2", name: "RCCB2", value: parseTimes(p.RCCB2), status: "ok", metricType: "hour" },
            { id: "ac-contact-2", name: "AC Power Contactor2", value: String(p.AC_power_contractor2 ?? ""), status: pickStatus(p.AC_power_contractor2, 30, 40), metricType: "times" },
            { id: "motor3-3", name: "Motor Starter3", value: String(p.moter_starter3 ?? ""), status: pickStatus(p.moter_starter3, 1, 5), metricType: "times" },
            { id: "motor4-4", name: "Motor Starter4", value: String(p.moter_starter4 ?? ""), status: pickStatus(p.moter_starter4, 1, 5), metricType: "times" },
            { id: "motor5-5", name: "Motor Starter5", value: String(p.moter_starter5 ?? ""), status: pickStatus(p.moter_starter5, 1, 5), metricType: "times" },
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
        <div className="tw-mx-auto tw-max-w-[1400px] tw-w-full tw-pt-6 md:tw-pt-8">
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
                            className="tw-w-full tw-pl-11 tw-pr-3.5 tw-py-3 tw-text-base tw-rounded-2xl tw-border tw-border-gray-200 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-indigo-200"
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

            {/* โซนบน: ซ้าย/ขวา — ★ ส่ง filter + search เข้าไป */}
            {/* <div className="tw-mt-6 tw-grid tw-gap-6 xl:tw-gap-8 tw-grid-cols-1 lg:tw-grid-cols-2">
                <SideList title="อุปกรณ์ (ซ้าย)" items={LEFT_LIST} filter={filter} search={query} />
                <SideList title="อุปกรณ์ (ขวา)" items={RIGHT_LIST} filter={filter} search={query} />
            </div> */}

            {/* ส่วนกลาง — ★ ส่ง filter + search เข้าไป */}
            {/* <div className="tw-mt-6">
                <SideList title="อุปกรณ์ (ส่วนกลาง)" items={CENTER_LIST} filter={filter} search={query} />
            </div> */}
            {/* // ---- ใหม่: ทำเป็นกริด 3 คอลัมน์ แล้วเรียง ซ้าย-กลาง-ขวา ---- */}
            {/* <div className="tw-mt-6 tw-grid tw-gap-6 xl:tw-gap-8 tw-grid-cols-1 md:tw-grid-cols-2 xl:tw-grid-cols-3"> */}
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

            {/* <div className="tw-mt-6 tw-grid tw-gap-6 xl:tw-gap-8
                tw-grid-cols-1 sm:tw-grid-cols-2
                lg:tw-grid-cols-2 xl:tw-grid-cols-2
                2xl:tw-grid-cols-3">

                <SideList
                    title="อุปกรณ์ (ซ้าย)"
                    items={LEFT_LIST}
                    filter={filter}
                    search={query}
                />
                <SideList
                    title="อุปกรณ์ (ส่วนกลาง)"
                    items={CENTER_LIST}
                    filter={filter}
                    search={query}
                />
                <SideList
                    title="อุปกรณ์ (ขวา)"
                    items={RIGHT_LIST}
                    filter={filter}
                    search={query}
                />
            </div> */}

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







// "use client";

// import React, { useMemo, useState } from "react";
// import Image from "next/image";
// import {
//     ExclamationTriangleIcon,
//     ExclamationCircleIcon,
//     CheckCircleIcon,
//     MagnifyingGlassIcon,
//     ChevronDownIcon,
//     FunnelIcon,
//     PhotoIcon,
//     ClockIcon, // 👈 ใช้แทนอิโมจิ Times
// } from "@heroicons/react/24/solid";

// /* Hourglass icon (SVG เบา ๆ) สำหรับ Hour */
// const HourglassIcon = (props: React.SVGProps<SVGSVGElement>) => (
//     <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
//         <path d="M6 2a1 1 0 1 0 0 2h.5c1.1 0 2.1.6 2.6 1.6l.2.4c.2.3.4.6.6.8L12 9l2.1-2.2c.2-.2.4-.5.6-.8l.2-.4C15.4 4.6 16.4 4 17.5 4H18a1 1 0 1 0 0-2H6Zm12 20a1 1 0 1 0 0-2h-.5c-1.1 0-2.1-.6-2.6-1.6l-.2-.4c-.2-.3-.4-.6-.6-.8L12 15l-2.1 2.2c-.2.2-.4.5-.6.8l-.2.4c-.5 1-1.5 1.6-2.6 1.6H6a1 1 0 1 0 0 2h12Z" />
//         <path d="M8 5h8c-.2.5-.5 1-.9 1.5L12 9.8 8.9 6.5C8.5 6 8.2 5.5 8 5Zm8 14H8c.2-.5.5-1 .9-1.5L12 14.2l3.1 3.3c.4.5.7 1 .9 1.5Z" />
//     </svg>
// );

// /* ------------------------------------------------------------------ */
// /* 1) Types & Data                                                     */
// /* ------------------------------------------------------------------ */
// type Status = "ok" | "warn" | "error";
// type MetricType = "times" | "hour";

// type Device = {
//     id: string;
//     name: string;
//     value?: string;
//     status: Status;
//     imageUrl?: string;
//     metricType?: MetricType; // สำหรับป้ายซ้าย/ขวา
// };

// const DEVICES: Device[] = [
//     { id: "charge-ctl", name: "Charging Controller", value: "500", status: "error", imageUrl: "" },
//     { id: "ac-contact", name: "AC Power Contactor", value: "200", status: "warn", imageUrl: "" },
//     { id: "dc-contact", name: "DC Power Contactor", value: "1000", status: "ok", imageUrl: "" },
//     { id: "fuse", name: "Fuse", value: "500", status: "ok", imageUrl: "" },
//     { id: "cb-fan", name: "Circuit Breaker Fan", value: "500", status: "ok", imageUrl: "" },
//     { id: "motor", name: "Motor Starter", value: "500", status: "ok", imageUrl: "" },
//     { id: "rcbo", name: "RCBO", value: "500", status: "ok" },
//     { id: "rccb", name: "RCCB", value: "500", status: "ok" },
//     { id: "dc-conv", name: "DC Converter", value: "500", status: "ok" },
//     { id: "disc", name: "Disconnect Switch", value: "200", status: "ok" },
//     { id: "emeter", name: "Energy Meter", value: "99", status: "ok", imageUrl: "" },
//     { id: "fan-ctl", name: "FAN Controller", value: "200", status: "ok" },
//     { id: "iso", name: "Insulation Monitoring", value: "200", status: "ok" },
//     { id: "noise", name: "Noise Filter", value: "200", status: "ok" },
//     { id: "ocpp", name: "OCPP Device", value: "1000", status: "ok" },
//     { id: "psu", name: "Power Supplies", value: "1000", status: "ok" },
//     { id: "sp", name: "Surge Protection", value: "3000", status: "ok" },
// ];

// /* ป้ายซ้าย/ขวาแบบภาพตัวอย่าง */
// const LEFT_LIST: Device[] = [
//     { id: "dc-contact-l", name: "DC Power Contactor", value: "500", status: "warn", imageUrl: "", metricType: "times" },
//     { id: "fuse-l", name: "FUSE", value: "200", status: "ok", imageUrl: "", metricType: "times" },
//     { id: "router-l", name: "Router", value: "1000", status: "ok", metricType: "hour" },
//     { id: "fuse-ctl-l", name: "FUSE Control", value: "250", status: "ok", metricType: "times" },
//     { id: "cb-fan-l", name: "Circuit Breaker fan", value: "100", status: "ok", metricType: "times" },
//     { id: "rcbo-l", name: "RCBO", value: "100", status: "ok", metricType: "times" },
//     { id: "rccb-l", name: "RCCB", value: "198", status: "ok", metricType: "times" },
//     { id: "ac-contact-l", name: "AC Power Contactor", value: "575", status: "warn", imageUrl: "", metricType: "times" },
//     { id: "motor-l", name: "Motor Starter", value: "122", status: "ok", metricType: "times" },
// ];

// const RIGHT_LIST: Device[] = [
//     { id: "emeter-r", name: "Energy Meter", value: "3000", status: "ok", metricType: "times" },
//     { id: "ocpp-r", name: "OCPP Device", value: "3000", status: "ok", metricType: "times" },
//     { id: "fan-ctl-r", name: "FAN Controller", value: "3000", status: "ok", metricType: "hour" },
//     { id: "charge-ctl-r", name: "Charging Controller", value: "3525", status: "error", metricType: "times" },
//     { id: "psu-r", name: "Power supplies", value: "3600", status: "ok", metricType: "hour" },
//     { id: "iso-r", name: "Insulation Monitoring", value: "2485", status: "ok", metricType: "hour" },
//     { id: "dc-conv-r", name: "DC Converter", value: "2485", status: "ok", metricType: "hour" },
//     { id: "sp-r", name: "Surge Protection", value: "585", status: "ok", metricType: "times" },
//     { id: "disc-r", name: "Disconnect Switch", value: "400", status: "ok", metricType: "times" },
//     { id: "noise-r", name: "Noise Filter", value: "1989", status: "ok", metricType: "hour" },
// ];

// /* ------------------------------------------------------------------ */
// /* 2) Theme tokens                                                     */
// /* ------------------------------------------------------------------ */
// const tone = {
//     error: {
//         bgSoft: "tw-bg-red-50",
//         text: "tw-text-red-700",
//         bar: "tw-bg-red-600",
//         chip: "tw-bg-red-100 tw-text-red-800",
//         head: "tw-from-red-50 tw-to-transparent tw-border-red-200",
//     },
//     warn: {
//         bgSoft: "tw-bg-amber-50",
//         text: "tw-text-amber-700",
//         bar: "tw-bg-amber-500",
//         chip: "tw-bg-amber-100 tw-text-amber-800",
//         head: "tw-from-amber-50 tw-to-transparent tw-border-amber-200",
//     },
//     ok: {
//         bgSoft: "tw-bg-green-50",
//         text: "tw-text-green-700",
//         bar: "tw-bg-green-600",
//         chip: "tw-bg-green-100 tw-text-green-800",
//         head: "tw-from-green-50 tw-to-transparent tw-border-green-200",
//     },
// } as const;

// const IconByStatus = ({ s }: { s: Status }) =>
//     s === "ok" ? (
//         <CheckCircleIcon className="tw-h-4 tw-w-4" />
//     ) : s === "warn" ? (
//         <ExclamationTriangleIcon className="tw-h-4 tw-w-4" />
//     ) : (
//         <ExclamationCircleIcon className="tw-h-4 tw-w-4" />
//     );

// /* ------------------------------------------------------------------ */
// /* 3) Atoms                                                            */
// /* ------------------------------------------------------------------ */
// function Pill({ color, label, value }: { color: string; label: string; value: number }) {
//     return (
//         <div className="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-px-4 tw-py-2">
//             <span className={`tw-inline-block tw-h-2.5 tw-w-2.5 tw-rounded-full ${color}`} />
//             <span className="tw-text-[15px] tw-text-gray-700">{label}</span>
//             <span className="tw-text-[15px] tw-font-bold">{value}</span>
//         </div>
//     );
// }

// function StatusBadge({ status }: { status: Status }) {
//     const t = tone[status];
//     return (
//         <span className={`tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-medium ${t.chip}`}>
//             <IconByStatus s={status} />
//             {status === "ok" ? "ปกติ" : status === "warn" ? "ต้องตรวจสอบ" : "มีปัญหา"}
//         </span>
//     );
// }

// /* >>> ใช้ไอคอนจริงแทน emoji <<< */
// function MetricBadge({ value, type, status }: { value?: string; type?: MetricType; status: Status }) {
//     const cls =
//         status === "error"
//             ? "tw-bg-red-100 tw-text-red-800"
//             : status === "warn"
//                 ? "tw-bg-amber-100 tw-text-amber-800"
//                 : "tw-bg-green-100 tw-text-green-800";

//     const num = Number((value ?? "").replace(/[^0-9.]/g, ""));

//     return (
//         <span className={`tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-px-3.5 tw-py-1 tw-text-[12.5px] tw-font-semibold ${cls}`}>
//             {type === "hour" ? (
//                 <HourglassIcon className="tw-h-4 tw-w-4" />
//             ) : (
//                 <ClockIcon className="tw-h-4 tw-w-4" />
//             )}
//             {isNaN(num) ? value : num.toLocaleString()}
//         </span>
//     );
// }

// /* Card ของรายการด้านล่าง */
// function DeviceCard({ d }: { d: Device }) {
//     const t = tone[d.status];
//     return (
//         <div className="tw-group tw-relative tw-rounded-2xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-overflow-hidden">
//             <div className={`tw-absolute tw-left-0 tw-top-0 tw-h-full tw-w-1.5 ${t.bar}`} />
//             <div className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-p-3 sm:tw-p-4 pl-5">
//                 <div className="tw-relative tw-h-16 tw-w-16 tw-rounded-xl tw-border tw-border-gray-200 tw-bg-gray-50 tw-overflow-hidden tw-grid tw-place-items-center">
//                     {d.imageUrl ? (
//                         <Image src={d.imageUrl} alt={d.name} fill sizes="64px" className="tw-object-contain tw-p-1.5" />
//                     ) : (
//                         <PhotoIcon className="tw-h-7 tw-w-7 tw-text-gray-300" />
//                     )}
//                 </div>
//                 <div className="tw-flex-1 tw-min-w-0">
//                     <p className="tw-truncate tw-font-semibold tw-text-base tw-text-gray-900">{d.name}</p>
//                     <div className="tw-mt-1">
//                         <StatusBadge status={d.status} />
//                     </div>
//                 </div>
//                 <div className="tw-text-right">
//                     <div className={`tw-text-lg tw-font-extrabold ${t.text}`}>{d.value ?? "-"}</div>
//                     <div className="tw-text-[11px] tw-text-gray-500">Status</div>
//                 </div>
//             </div>
//             <div className={`tw-absolute tw-inset-0 tw-opacity-0 group-hover:tw-opacity-10 ${t.bgSoft} tw-transition-opacity`} />
//         </div>
//     );
// }

// /* รายการซ้าย/ขวา */
// function SideList({ title, items }: { title: string; items: Device[] }) {
//     return (
//         <aside className="tw-rounded-3xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-p-4 sm:tw-p-5">
//             <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
//                 <p className="tw-text-sm tw-font-semibold tw-text-gray-800">{title}</p>
//                 {/* Legend ใช้ไอคอนจริง */}
//                 <div className="tw-hidden sm:tw-flex tw-items-center tw-gap-3 tw-text-[11px] tw-text-gray-500">
//                     <span className="tw-inline-flex tw-items-center tw-gap-1.5">
//                         <ClockIcon className="tw-h-3.5 tw-w-3.5 tw-text-gray-400" /> Times
//                     </span>
//                     <span className="tw-inline-flex tw-items-center tw-gap-1.5">
//                         <HourglassIcon className="tw-h-3.5 tw-w-3.5 tw-text-gray-400" /> Hour
//                     </span>
//                 </div>
//             </div>
//             <ul className="tw-space-y-2">
//                 {items.map((d) => (
//                     <li key={d.id} className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-rounded-xl tw-border tw-border-gray-200 tw-bg-white tw-p-3.5">
//                         <div className="tw-flex tw-items-center tw-gap-2">
//                             <div className="tw-h-11 tw-w-11 tw-rounded-lg tw-bg-gray-50 tw-border tw-border-gray-200 tw-grid tw-place-items-center tw-overflow-hidden">
//                                 {d.imageUrl ? (
//                                     <Image src={d.imageUrl} alt={d.name} width={44} height={44} className="tw-object-contain tw-max-h-10 tw-max-w-10" />
//                                 ) : (
//                                     <PhotoIcon className="tw-h-5 tw-w-5 tw-text-gray-300" />
//                                 )}
//                             </div>
//                             <span className="tw-text-base tw-font-medium tw-text-gray-800">{d.name}</span>
//                         </div>
//                         <MetricBadge value={d.value} type={d.metricType} status={d.status} />
//                     </li>
//                 ))}
//             </ul>
//         </aside>
//     );
// }

// /* ------------------------------------------------------------------ */
// /* 4) Group (พับได้ + ค้นหา)                                          */
// /* ------------------------------------------------------------------ */
// function Group({
//     status,
//     title,
//     devices,
//     defaultOpen,
//     search,
// }: {
//     status: Status;
//     title: string;
//     devices: Device[];
//     defaultOpen?: boolean;
//     search: string;
// }) {
//     const [open, setOpen] = useState(!!defaultOpen);
//     const t = tone[status];
//     const filtered = useMemo(() => {
//         const q = search.trim().toLowerCase();
//         return devices.filter((d) => d.name.toLowerCase().includes(q));
//     }, [devices, search]);

//     return (
//         <section className="tw-rounded-3xl tw-overflow-hidden tw-ring-1 tw-ring-black/5 tw-bg-white">
//             <button
//                 onClick={() => setOpen((v) => !v)}
//                 className={`tw-w-full tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-5 tw-py-3 tw-border-b tw-bg-gradient-to-r ${t.head}`}
//                 aria-expanded={open}
//             >
//                 <div className="tw-flex tw-items-center tw-gap-2">
//                     <IconByStatus s={status} />
//                     <span className="tw-font-semibold">{title}</span>
//                     <span className="tw-text-xs tw-text-gray-500">({devices.length})</span>
//                 </div>
//                 <ChevronDownIcon className={`tw-h-4 tw-w-4 tw-transition-transform ${open ? "tw-rotate-180" : ""}`} />
//             </button>

//             {open && (
//                 <div className="tw-p-4">
//                     <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2 lg:tw-grid-cols-3 xl:tw-grid-cols-4">
//                         {filtered.map((d) => (
//                             <DeviceCard key={d.id} d={d} />
//                         ))}
//                         {filtered.length === 0 && (
//                             <div className="tw-col-span-full tw-text-center tw-text-sm tw-text-gray-500 tw-py-6">
//                                 ไม่พบรายการในกลุ่มนี้
//                             </div>
//                         )}
//                     </div>
//                 </div>
//             )}
//         </section>
//     );
// }

// /* ------------------------------------------------------------------ */
// /* 5) Page                                                             */
// /* ------------------------------------------------------------------ */
// export default function DCChargerDashboard() {
//     const [query, setQuery] = useState("");
//     const [filter, setFilter] = useState<"all" | Status>("all");

//     const errorList = DEVICES.filter((d) => d.status === "error");
//     const warnList = DEVICES.filter((d) => d.status === "warn");
//     const okList = DEVICES.filter((d) => d.status === "ok");

//     const overall: Status = errorList.length ? "error" : warnList.length ? "warn" : "ok";
//     const systemChip =
//         overall === "error"
//             ? "tw-bg-red-100 tw-text-red-800 tw-border tw-border-red-300"
//             : overall === "warn"
//                 ? "tw-bg-amber-100 tw-text-amber-800 tw-border tw-border-amber-300"
//                 : "tw-bg-green-100 tw-text-green-800 tw-border tw-border-green-300";

//     const FilterBtn = ({ id, label, dot }: { id: "all" | Status; label: string; dot?: string }) => (
//         <button
//             onClick={() => setFilter(id)}
//             className={`tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-px-3 tw-py-1.5 tw-text-sm tw-border
//       ${filter === id ? "tw-border-indigo-300 tw-bg-indigo-50 tw-text-indigo-700" : "tw-border-gray-200 tw-bg-white tw-text-gray-700"}`}
//             aria-pressed={filter === id}
//         >
//             {dot && <span className={`tw-h-2.5 tw-w-2.5 tw-rounded-full ${dot}`} />}
//             {label}
//         </button>
//     );

//     const showError = filter === "all" || filter === "error";
//     const showWarn = filter === "all" || filter === "warn";
//     const showOk = filter === "all" || filter === "ok";

//     return (
//         <div className="tw-mx-auto tw-max-w-[1600px] tw-w-full tw-pt-8 md:tw-pt-10">

//             {/* โซนบน: ป้ายซ้าย - ตู้กลาง (sticky) - ป้ายขวา */}
//             <div
//                 className="
//                     tw-grid tw-gap-6 xl:tw-gap-8 tw-grid-cols-1
//                     lg:tw-grid-cols-[360px_minmax(0,1fr)_360px]
//                     xl:tw-grid-cols-[380px_minmax(0,1fr)_380px]
//                 "
//             >
//                 <SideList title="อุปกรณ์ (ซ้าย)" items={LEFT_LIST} />

//                 <div className="tw-relative tw-rounded-3xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-p-3 sm:tw-p-5 tw-h-fit tw-sticky tw-top-6">
//                     <div className="tw-relative tw-h-[560px] lg:tw-h-[720px] xl:tw-h-[820px] tw-rounded-2xl tw-bg-gray-50 tw-border tw-border-gray-200 tw-overflow-hidden">
//                         <Image
//                             src="/img/charger-1.png"
//                             alt="EV Charger Cabinet"
//                             fill
//                             className="tw-object-contain tw-bg-white"
//                             sizes="(max-width:1024px) 100vw, 70vw"
//                             priority
//                         />
//                     </div>

//                     {/* <div
//                         className={`tw-absolute tw-top-3 tw-right-3 tw-rounded-full tw-px-3.5 tw-py-1.5 tw-text-[12px] tw-font-medium tw-shadow ${systemChip}`}
//                     >
//                         สถานะระบบ: {overall === "error" ? "มีปัญหา" : overall === "warn" ? "ต้องตรวจสอบ" : "ปกติ"}
//                     </div> */}
//                 </div>

//                 <SideList title="อุปกรณ์ (ขวา)" items={RIGHT_LIST} />
//             </div>


//             {/* แผงควบคุมสรุป/ค้นหา */}
//             <div className="tw-mt-6 tw-rounded-3xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-p-4">
//                 <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
//                     <p className="tw-text-sm tw-text-gray-700">ภาพรวมสถานะ</p>
//                     <FunnelIcon className="tw-h-5 tw-w-5 tw-text-gray-300" />
//                 </div>

//                 <div className="tw-flex tw-flex-wrap tw-gap-2">
//                     <Pill color="tw-bg-red-600" label="มีปัญหา" value={errorList.length} />
//                     <Pill color="tw-bg-amber-500" label="ต้องตรวจ" value={warnList.length} />
//                     <Pill color="tw-bg-green-600" label="ปกติ" value={okList.length} />
//                 </div>

//                 <div className="tw-mt-4">
//                     <label className="tw-text-sm tw-text-gray-700">ค้นหาอุปกรณ์</label>
//                     <div className="tw-relative tw-mt-1">
//                         <MagnifyingGlassIcon className="tw-absolute tw-left-3 tw-top-2.5 tw-h-5 tw-w-5 tw-text-gray-400" />
//                         <input
//                             value={query}
//                             onChange={(e) => setQuery(e.target.value)}
//                             placeholder="พิมพ์ชื่ออุปกรณ์…"
//                             className="tw-w-full tw-pl-11 tw-pr-3.5 tw-py-3 tw-text-base tw-rounded-2xl tw-border tw-border-gray-200 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-indigo-200"
//                         />
//                     </div>
//                     <p className="tw-text-xs tw-text-gray-400 tw-mt-2">เขียว = ปกติ, เหลือง = ต้องตรวจสอบ, แดง = มีปัญหา</p>
//                 </div>

//                 <div className="tw-mt-4 tw-flex tw-flex-wrap tw-gap-2">
//                     <FilterBtn id="all" label="ทั้งหมด" />
//                     <FilterBtn id="error" label="มีปัญหา" dot="tw-bg-red-600" />
//                     <FilterBtn id="warn" label="ต้องตรวจ" dot="tw-bg-amber-500" />
//                     <FilterBtn id="ok" label="ปกติ" dot="tw-bg-green-600" />
//                 </div>
//             </div>

//             {/* รายการแบบจัดกลุ่ม (เจาะลึก) */}
//             <div className="tw-mt-8 tw-space-y-6">
//                 {showError && <Group status="error" title="อุปกรณ์ที่มีปัญหา" devices={errorList} defaultOpen search={query} />}
//                 {showWarn && warnList.length > 0 && (
//                     <Group status="warn" title="อุปกรณ์ที่ต้องตรวจสอบ" devices={warnList} defaultOpen search={query} />
//                 )}
//                 {showOk && <Group status="ok" title="อุปกรณ์สถานะปกติ" devices={okList} defaultOpen={false} search={query} />}
//             </div>

//             <div className="tw-h-10" />
//         </div>
//     );
// }