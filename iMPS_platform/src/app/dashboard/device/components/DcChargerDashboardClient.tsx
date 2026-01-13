"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    ExclamationTriangleIcon,
    ExclamationCircleIcon,
    CheckCircleIcon,
    MagnifyingGlassIcon,
    ChevronDownIcon,
    InboxIcon,
} from "@heroicons/react/24/solid";

/* =========================
   1) Types & Helpers
   ========================= */
type Status = "ok" | "warn" | "error";
type MetricType = "times" | "hour";
type Lang = "th" | "en";

type Device = {
    id: string;
    name: string;
    value?: string;
    status: Status;
    imageUrl?: string;
    metricType?: MetricType;
};

// ===== Lifetime Config (กำหนดที่ Frontend) =====
const LIFETIME_CONFIG: Record<string, number> = {
    // Contactors (times)
    "DC Power Contactor": 300000,
    "AC Power Contactor": 50000,
    // Motor Starters (times)
    "Motor Starter": 30000,
    // Fuses (hours)
    "FUSE": 100000,
    // RCCB (hours)
    "RCCB": 87600, // 10 years
    "RCBO": 87600,
    // Energy Meter (hours)
    "Energy Meter": 131400, // 15 years
    // Controllers (hours)
    "Charging Controller": 87600,
    "Insulation Monitoring": 87600,
    // Router & Network (hours)
    "Router": 87600,
    "OCPP Device": 87600,
    // Other components (hours)
    "Circuit Breaker": 100000,
    "FAN Controller": 50000,
    "Power supplies": 87600,
    "DC Converter": 100000,
    "Surge Protection": 87600,
    "Disconnect Switch": 100000,
    "Noise Filter": 100000,
    // Default
    "default": 50000,
};

// หา lifetime จาก config
function getLifetime(deviceName: string): number {
    for (const [key, value] of Object.entries(LIFETIME_CONFIG)) {
        if (deviceName.includes(key)) return value;
    }
    return LIFETIME_CONFIG.default;
}

// คำนวณ % ที่ใช้ไป (ไม่จำกัดสูงสุดเพราะสามารถเกิน 100% ได้)
function calcUsagePercent(current: number, lifetime: number): number {
    if (lifetime <= 0) return 0;
    return (current / lifetime) * 100;
}

// กำหนดสีตาม % ที่ใช้ (เทียบกับ lifetime)
// เขียว: ไม่เกิน lifetime หรือเกินไม่เกิน 20% (≤ 120%)
// เหลือง: เกิน lifetime 20-50% (> 120% ถึง 150%)
// แดง: เกิน lifetime มากกว่า 50% (> 150%)
function getStatusColor(usagePercent: number): "green" | "yellow" | "red" {
    if (usagePercent > 150) return "red";
    if (usagePercent > 120) return "yellow";
    return "green";
}

const colorClasses = {
    green: {
        bg: "tw-bg-green-500",
        bgLight: "tw-bg-green-100",
        text: "tw-text-green-700",
        border: "tw-border-green-300",
        ring: "tw-ring-green-500",
    },
    yellow: {
        bg: "tw-bg-amber-500",
        bgLight: "tw-bg-amber-100",
        text: "tw-text-amber-700",
        border: "tw-border-amber-300",
        ring: "tw-ring-amber-500",
    },
    red: {
        bg: "tw-bg-red-500",
        bgLight: "tw-bg-red-100",
        text: "tw-text-red-700",
        border: "tw-border-red-300",
        ring: "tw-ring-red-500",
    },
};

// แปลง value เป็นตัวเลข
function parseValueToNumber(value?: string, metricType?: MetricType): number {
    if (!value) return 0;
    if (metricType === "hour") {
        const mH = /(\d+)\s*h/gi.exec(value);
        return mH ? Number(mH[1]) : 0;
    }
    return Number(String(value).replace(/[^\d.-]/g, "")) || 0;
}

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
   2) Style 3: Circular Progress (เป๊ะๆ จากตัวอย่าง)
   ========================= */
function Style3Circular({ 
    name, 
    value, 
    unit,
    t 
}: { 
    name: string;
    value: number;
    unit: string;
    t: any;
}) {
    const lifetime = getLifetime(name);
    const usagePercent = calcUsagePercent(value, lifetime);
    const color = getStatusColor(usagePercent);
    const cls = colorClasses[color];

    // SVG circular progress
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    // Visual progress caps at 100% (full circle)
    const visualPercent = Math.min(usagePercent, 100);
    const strokeDashoffset = circumference - (visualPercent / 100) * circumference;

    return (
        <div className="tw-p-4 tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-shadow-sm">
            <div className="tw-flex tw-items-center tw-gap-4">
                {/* Circular Progress */}
                <div className="tw-relative tw-flex-shrink-0">
                    <svg className="tw-w-20 tw-h-20 tw-transform -tw-rotate-90">
                        {/* Background circle */}
                        <circle
                            cx="40"
                            cy="40"
                            r={radius}
                            stroke="#e5e7eb"
                            strokeWidth="6"
                            fill="none"
                        />
                        {/* Progress circle */}
                        <circle
                            cx="40"
                            cy="40"
                            r={radius}
                            stroke={color === "green" ? "#22c55e" : color === "yellow" ? "#f59e0b" : "#ef4444"}
                            strokeWidth="6"
                            fill="none"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            className="tw-transition-all tw-duration-500"
                        />
                    </svg>
                    <div className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center">
                        <span className={`tw-text-sm tw-font-bold ${cls.text}`}>
                            {usagePercent.toFixed(0)}%
                        </span>
                    </div>
                </div>
                
                {/* Info */}
                <div className="tw-flex-1 tw-min-w-0">
                    <p className="tw-font-semibold tw-text-gray-800 tw-truncate">{name}</p>
                    <p className="tw-text-lg tw-font-bold tw-text-gray-900">
                        {value.toLocaleString()} <span className="tw-text-sm tw-font-normal tw-text-gray-400">/ {lifetime.toLocaleString()}</span> <span className="tw-text-sm tw-font-normal tw-text-gray-500">{unit}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

/* =========================
   Loading Skeleton
   ========================= */
function LoadingSkeleton() {
    return (
        <div className="tw-p-4 tw-bg-white tw-rounded-2xl tw-border tw-border-gray-200 tw-shadow-sm tw-animate-pulse">
            <div className="tw-flex tw-items-center tw-gap-4">
                <div className="tw-w-20 tw-h-20 tw-bg-gray-200 tw-rounded-full tw-flex-shrink-0" />
                <div className="tw-flex-1 tw-space-y-2">
                    <div className="tw-h-4 tw-bg-gray-200 tw-rounded tw-w-3/4" />
                    <div className="tw-h-6 tw-bg-gray-200 tw-rounded tw-w-1/2" />
                </div>
            </div>
        </div>
    );
}

function SideListSkeleton({ title }: { title: string }) {
    return (
        <aside className="tw-rounded-3xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-p-4 sm:tw-p-5">
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                <p className="tw-text-sm tw-font-semibold tw-text-gray-800">{title}</p>
            </div>
            <div className="tw-space-y-2.5 md:tw-space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <LoadingSkeleton key={i} />
                ))}
            </div>
        </aside>
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
    t,
}: {
    title: string;
    items: Device[];
    filter: "all" | Status;
    search: string;
    t: any;
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
            </div>

            <div className="tw-space-y-2.5 md:tw-space-y-3">
                {filtered.map((d) => {
                    const numericValue = parseValueToNumber(d.value, d.metricType);
                    const unit = d.metricType === "hour" ? "h" : t.times;

                    return (
                        <Style3Circular 
                            key={d.id}
                            name={d.name}
                            value={numericValue}
                            unit={unit}
                            t={t}
                        />
                    );
                })}

                {filtered.length === 0 && (
                    <div className="tw-text-center tw-text-sm tw-text-gray-500 tw-py-4">
                        {t.noDevicesFound}
                    </div>
                )}
            </div>
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
    t,
}: {
    status: Status;
    title: string;
    devices: Device[];
    defaultOpen?: boolean;
    search: string;
    t: any;
}) {
    const [open, setOpen] = useState(!!defaultOpen);
    
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return devices.filter((d) => d.name.toLowerCase().includes(q));
    }, [devices, search]);

    const headColor = status === "error" 
        ? "tw-from-red-50 tw-to-transparent tw-border-red-200" 
        : status === "warn" 
            ? "tw-from-amber-50 tw-to-transparent tw-border-amber-200"
            : "tw-from-green-50 tw-to-transparent tw-border-green-200";

    const IconByStatus = status === "ok" 
        ? CheckCircleIcon 
        : status === "warn" 
            ? ExclamationTriangleIcon 
            : ExclamationCircleIcon;

    return (
        <section className="tw-rounded-3xl tw-overflow-hidden tw-ring-1 tw-ring-black/5 tw-bg-white">
            <button
                onClick={() => setOpen((v) => !v)}
                className={`tw-w-full tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-5 tw-py-3 tw-border-b tw-bg-gradient-to-r ${headColor}`}
                aria-expanded={open}
            >
                <div className="tw-flex tw-items-center tw-gap-2">
                    <IconByStatus className="tw-h-4 tw-w-4" />
                    <span className="tw-font-semibold">{title}</span>
                    <span className="tw-text-xs tw-text-gray-500">({devices.length})</span>
                </div>
                <ChevronDownIcon className={`tw-h-4 tw-w-4 tw-transition-transform ${open ? "tw-rotate-180" : ""}`} />
            </button>

            {open && (
                <div className="tw-p-4">
                    <div
                        className="tw-grid tw-gap-4
                            sm:tw-grid-cols-1
                            md:tw-grid-cols-1
                            lg:tw-grid-cols-2
                            xl:tw-grid-cols-3
                            2xl:tw-grid-cols-3"
                    >
                        {filtered.map((d) => {
                            const numericValue = parseValueToNumber(d.value, d.metricType);
                            const unit = d.metricType === "hour" ? "h" : t.times;

                            return (
                                <Style3Circular 
                                    key={d.id}
                                    name={d.name}
                                    value={numericValue}
                                    unit={unit}
                                    t={t}
                                />
                            );
                        })}
                        {filtered.length === 0 && (
                            <div className="tw-col-span-full tw-text-center tw-text-sm tw-text-gray-500 tw-py-6">
                                {t.noItemsInGroup}
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
    const searchParams = useSearchParams();
    const [live, setLive] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(false);
    const esRef = useRef<EventSource | null>(null);
    const [stationId, setStationId] = useState<string>("");

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

    // ===== Get station_id from URL or localStorage =====
    useEffect(() => {
        const sid = searchParams.get("station_id") 
            || localStorage.getItem("selected_station_id")
            || "";
        setStationId(sid);
    }, [searchParams]);

    // ===== Language State =====
    const [lang, setLang] = useState<Lang>("en");

    useEffect(() => {
        const savedLang = localStorage.getItem("app_language") as Lang | null;
        if (savedLang === "th" || savedLang === "en") {
            setLang(savedLang);
        }

        const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => {
            setLang(e.detail.lang);
        };

        window.addEventListener("language:change", handleLangChange as EventListener);
        return () => {
            window.removeEventListener("language:change", handleLangChange as EventListener);
        };
    }, []);

    // ===== Translations =====
    const t = useMemo(() => {
        const translations = {
            th: {
                // Status
                statusOk: "ปกติ",
                statusWarn: "ต้องตรวจสอบ",
                statusError: "มีปัญหา",
                
                // Filter buttons
                all: "ทั้งหมด",
                issues: "มีปัญหา",
                monitor: "ต้องตรวจสอบ",
                normal: "ปกติ",
                unit: "ตัว",
                
                // Search
                searchDevices: "ค้นหาอุปกรณ์",
                searchPlaceholder: "พิมพ์ชื่ออุปกรณ์...",
                
                // Lists
                deviceLeft: "อุปกรณ์ (ซ้าย)",
                deviceCenter: "อุปกรณ์ (กลาง)",
                deviceRight: "อุปกรณ์ (ขวา)",
                
                // Metric types
                times: "ครั้ง",
                day: "วัน",
                
                // Lifetime
                lifetime: "อายุการใช้งาน",
                used: "ใช้ไป",
                
                // Messages
                noDevicesFound: "ไม่พบอุปกรณ์ตามตัวกรอง",
                noItemsInGroup: "ไม่พบรายการในกลุ่มนี้",
                noStationSelected: "กรุณาเลือกตู้ชาร์จก่อน",
                noData: "ไม่มีข้อมูล",
                loading: "กำลังโหลดข้อมูล...",
                connecting: "กำลังเชื่อมต่อ...",
                connectionFailed: "เชื่อมต่อไม่สำเร็จ กำลังลองใหม่...",
            },
            en: {
                // Status
                statusOk: "Normal",
                statusWarn: "Monitor",
                statusError: "Issue",
                
                // Filter buttons
                all: "All",
                issues: "Issues",
                monitor: "Monitor",
                normal: "Normal",
                unit: "unit",
                
                // Search
                searchDevices: "Search Devices",
                searchPlaceholder: "Type device name...",
                
                // Lists
                deviceLeft: "Device (Left)",
                deviceCenter: "Device (Center)",
                deviceRight: "Device (Right)",
                
                // Metric types
                times: "Times",
                day: "Day",
                
                // Lifetime
                lifetime: "Lifetime",
                used: "used",
                
                // Messages
                noDevicesFound: "No devices found",
                noItemsInGroup: "No items found in this group",
                noStationSelected: "Please select a charger first",
                noData: "No data",
                loading: "Loading data...",
                connecting: "Connecting...",
                connectionFailed: "Connection failed. Retrying...",
            },
        };
        return translations[lang];
    }, [lang]);

    // ===== SSE Connection =====
    useEffect(() => {
        // Don't connect if no stationId
        if (!stationId) {
            setLive(null);
            setLoading(false);
            return;
        }

        // Reset states when stationId changes
        setLoading(true);
        setConnectionError(false);
        setLive(null);

        const url = `${API_BASE}/utilization/stream?station_id=${encodeURIComponent(stationId)}`;
        const es = new EventSource(url, { withCredentials: true });
        esRef.current = es;

        es.addEventListener("init", (ev) => {
            try {
                const data = JSON.parse((ev as MessageEvent).data);
                setLive(data);
                setLoading(false);
                setConnectionError(false);
            } catch { }
        });

        es.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data);
                setLive(data);
                setLoading(false);
                setConnectionError(false);
            } catch { }
        };

        es.onopen = () => {
            setConnectionError(false);
        };

        es.onerror = () => {
            setConnectionError(true);
            // SSE will auto-reconnect, so we don't set loading to false here
        };

        // Timeout to handle case where SSE connects but no data comes
        const timeout = setTimeout(() => {
            if (!live) {
                setLoading(false);
            }
        }, 10000); // 10 seconds timeout

        return () => {
            clearTimeout(timeout);
            es.close();
            esRef.current = null;
        };
    }, [stationId, API_BASE]);

    // ===== Mapping payload -> UI lists =====
    const { LEFT_LIST, RIGHT_LIST, CENTER_LIST, DEVICES } = useMemo(() => {
        const p = live || {};
        const left: Device[] = [
            { id: "dc-contact-l", name: "DC Power Contactor1", value: String(p.DC_power_contractor1 ?? ""), status: pickStatus(p.DC_power_contractor1, p.DC_power_contractor1+(20/100),  p.DC_power_contractor1+(50/100)), metricType: "times" },
            { id: "dc-contact-2", name: "DC Power Contactor2", value: String(p.DC_power_contractor2 ?? ""), status: pickStatus(p.DC_power_contractor2, p.DC_power_contractor2+(20/100),  p.DC_power_contractor2+(50/100)), metricType: "times" },
            { id: "dc-contact-5", name: "DC Power Contactor5", value: String(p.DC_power_contractor5 ?? ""), status: pickStatus(p.DC_power_contractor5, p.DC_power_contractor5+(20/100),  p.DC_power_contractor5+(50/100)), metricType: "times" },
            { id: "dc-contact-6", name: "DC Power Contactor6", value: String(p.DC_power_contractor6 ?? ""), status: pickStatus(p.DC_power_contractor6, p.DC_power_contractor6+(20/100),  p.DC_power_contractor6+(50/100)), metricType: "times" },
            { id: "fuse1-l", name: "FUSE1", value: parseTimes(p.FUSE1), status: "ok", metricType: "hour" },
            { id: "rccb1-l", name: "RCCB1", value: parseTimes(p.RCCB1), status: "ok", metricType: "hour" },
            { id: "ac-contact-l", name: "AC Power Contactor1", value: String(p.AC_power_contractor1 ?? ""), status: pickStatus(p.AC_power_contractor1, p.AC_power_contractor1+(20/100),  p.AC_power_contractor1+(50/100)), metricType: "times" },
            { id: "motor1-l", name: "Motor Starter1", value: String(p.motor_starter1 ?? ""), status: pickStatus(p.motor_starter1, p.motor_starter1+(20/100), p.motor_starter1+(50/100)), metricType: "times" },
            { id: "motor2-2", name: "Motor Starter2", value: String(p.motor_starter2 ?? ""), status: pickStatus(p.motor_starter2, p.motor_starter2+(20/100), p.motor_starter2+(50/100)), metricType: "times" },
            { id: "emeter1", name: "Energy Meter1", value: parseTimes(p.energyMeter1), status: "ok", metricType: "hour" },
            { id: "charge-ctl1", name: "Charging Controller1", value: parseTimes(p.chargingController1), status: "ok", metricType: "hour" },
            { id: "iso1", name: "Insulation Monitoring1", value: parseTimes(p.insulationMonitoring1), status: "ok", metricType: "hour" },
        ];

        const right: Device[] = [
            { id: "dc-contact-3", name: "DC Power Contactor3", value: String(p.DC_power_contractor3 ?? ""), status: pickStatus(p.DC_power_contractor3, p.DC_power_contractor3+(20/100), p.DC_power_contractor3+(50/100)), metricType: "times" },
            { id: "dc-contact-4", name: "DC Power Contactor4", value: String(p.DC_power_contractor4 ?? ""), status: pickStatus(p.DC_power_contractor4, p.DC_power_contractor4+(20/100), p.DC_power_contractor4+(50/100)), metricType: "times" },
            { id: "fuse2-2", name: "FUSE2", value: parseTimes(p.FUSE2), status: "ok", metricType: "hour" },
            { id: "rccb2-2", name: "RCCB2", value: parseTimes(p.RCCB2), status: "ok", metricType: "hour" },
            { id: "ac-contact-2", name: "AC Power Contactor2", value: String(p.AC_power_contractor2 ?? ""), status: pickStatus(p.AC_power_contractor2, p.AC_power_contractor2+(20/100), p.AC_power_contractor2+(50/100)), metricType: "times" },
            { id: "motor3-3", name: "Motor Starter3", value: String(p.motor_starter3 ?? ""), status: pickStatus(p.motor_starter3, p.motor_starter3+(20/100), p.motor_starter3+(50/100)), metricType: "times" },
            { id: "motor4-4", name: "Motor Starter4", value: String(p.motor_starter4 ?? ""), status: pickStatus(p.motor_starter4, p.motor_starter4+(20/100), p.motor_starter4+(50/100)), metricType: "times" },
            { id: "motor5-5", name: "Motor Starter5", value: String(p.motor_starter5 ?? ""), status: pickStatus(p.motor_starter5, p.motor_starter5+(20/100), p.motor_starter5+(50/100)), metricType: "times" },
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

        const all: Device[] = [...left, ...right, ...center];

        return { LEFT_LIST: left, RIGHT_LIST: right, CENTER_LIST: center, DEVICES: all };
    }, [live]);

    // ===== UI State (ค้นหา/กรอง) =====
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<"all" | Status>("all");

    const errorList = DEVICES.filter((d) => d.status === "error");
    const warnList = DEVICES.filter((d) => d.status === "warn");
    const okList = DEVICES.filter((d) => d.status === "ok");

    const FilterBtn = ({
        id,
        label,
        dot,
        value,
    }: {
        id: "all" | Status;
        label: string;
        dot?: string;
        value?: number;
    }) => (
        <button
            onClick={() => setFilter(id)}
            className={`tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-px-3 tw-py-1.5 tw-text-sm tw-border ${filter === id ? "tw-border-indigo-300 tw-bg-indigo-50 tw-text-indigo-700" : "tw-border-gray-200 tw-bg-white tw-text-gray-700"
                }`}
            aria-pressed={filter === id}
        >
            {dot && <span className={`tw-h-2.5 tw-w-2.5 tw-rounded-full ${dot}`} />}
            <span className="tw-flex tw-items-center tw-gap-1">
                <span>{label}</span>
                {value !== undefined && (
                    <span className="tw-font-bold">{value}</span>
                )}
                {t.unit}
            </span>
        </button>
    );

    const showError = filter === "all" || filter === "error";
    const showWarn = filter === "all" || filter === "warn";
    const showOk = filter === "all" || filter === "ok";

    /* =========================
       4) Render
       ========================= */
    
    // Show message if no stationId selected
    if (!stationId) {
        return (
            <div className="tw-w-full tw-max-w-none tw-mx-auto tw-pt-6 md:tw-pt-8 tw-px-4 md:tw-px-1">
                <div className="tw-rounded-3xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-p-8 tw-text-center">
                    <div className="tw-flex tw-justify-center tw-mb-4">
                        <div className="tw-p-4 tw-rounded-full tw-bg-amber-100">
                            <ExclamationTriangleIcon className="tw-h-12 tw-w-12 tw-text-amber-500" />
                        </div>
                    </div>
                    <p className="tw-text-lg tw-text-gray-600">{t.noStationSelected}</p>
                </div>
            </div>
        );
    }

    // Show loading state
    if (loading) {
        return (
            <div className="tw-w-full tw-max-w-none tw-mx-auto tw-pt-6 md:tw-pt-8 tw-px-4 md:tw-px-1">
                {/* Header skeleton */}
                <div className="tw-rounded-3xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-p-4 md:tw-p-5">
                    <div className="tw-flex tw-items-center tw-justify-center tw-gap-3 tw-py-2">
                        <div className="tw-animate-spin tw-h-5 tw-w-5 tw-border-2 tw-border-gray-300 tw-border-t-gray-600 tw-rounded-full" />
                        <span className="tw-text-gray-600">
                            {connectionError ? t.connectionFailed : t.connecting}
                        </span>
                    </div>
                    <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="tw-h-9 tw-w-24 tw-bg-gray-100 tw-rounded-full tw-animate-pulse" />
                        ))}
                    </div>
                    <div className="tw-mt-4">
                        <div className="tw-h-4 tw-w-24 tw-bg-gray-200 tw-rounded tw-animate-pulse tw-mb-2" />
                        <div className="tw-h-12 tw-bg-gray-100 tw-rounded-2xl tw-animate-pulse" />
                    </div>
                </div>

                {/* Content skeleton */}
                <div
                    className="tw-mt-6 tw-grid tw-gap-6 xl:tw-gap-8
                        tw-grid-cols-1
                        sm:tw-grid-cols-1
                        md:tw-grid-cols-1
                        lg:tw-grid-cols-2
                        xl:tw-grid-cols-3
                        2xl:tw-grid-cols-3"
                >
                    <SideListSkeleton title={t.deviceLeft} />
                    <SideListSkeleton title={t.deviceCenter} />
                    <SideListSkeleton title={t.deviceRight} />
                </div>
            </div>
        );
    }

    // Show message if no data (after loading completed)
    if (!live || Object.keys(live).length === 0) {
        return (
            <div className="tw-w-full tw-max-w-none tw-mx-auto tw-pt-6 md:tw-pt-8 tw-px-4 md:tw-px-1">
                <div className="tw-rounded-3xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-p-8 tw-text-center">
                    <div className="tw-flex tw-justify-center tw-mb-4">
                        <div className="tw-p-4 tw-rounded-full tw-bg-gray-100">
                            <InboxIcon className="tw-h-12 tw-w-12 tw-text-gray-400" />
                        </div>
                    </div>
                    <p className="tw-text-lg tw-text-gray-600">{t.noData}</p>
                    <p className="tw-text-sm tw-text-gray-400 tw-mt-2">Station ID: {stationId}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="tw-w-full tw-max-w-none tw-mx-auto tw-pt-6 md:tw-pt-8 tw-px-4 md:tw-px-1">

            {/* แผงสรุป/ค้นหา */}
            <div className="tw-rounded-3xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/5 tw-p-4 md:tw-p-5">
                <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
                    <FilterBtn id="all" label={t.all} value={errorList.length + warnList.length + okList.length} />
                    <FilterBtn id="error" label={t.issues} dot="tw-bg-red-600" value={errorList.length} />
                    <FilterBtn id="warn" label={t.monitor} dot="tw-bg-amber-500" value={warnList.length} />
                    <FilterBtn id="ok" label={t.normal} dot="tw-bg-green-600" value={okList.length} />
                </div>
                
                {/* Lifetime Legend */}
                {/* <div className="tw-mt-4 tw-flex tw-flex-wrap tw-items-center tw-gap-4 tw-py-2 tw-px-3 tw-bg-gray-50 tw-rounded-xl tw-text-xs">
                    <span className="tw-text-gray-500 tw-font-medium">{t.lifetime}:</span>
                    <div className="tw-flex tw-items-center tw-gap-1.5">
                        <span className="tw-w-3 tw-h-3 tw-rounded-full tw-bg-green-500" />
                        <span className="tw-text-gray-600">≤ 120%</span>
                    </div>
                    <div className="tw-flex tw-items-center tw-gap-1.5">
                        <span className="tw-w-3 tw-h-3 tw-rounded-full tw-bg-amber-500" />
                        <span className="tw-text-gray-600">&gt; 120%</span>
                    </div>
                    <div className="tw-flex tw-items-center tw-gap-1.5">
                        <span className="tw-w-3 tw-h-3 tw-rounded-full tw-bg-red-500" />
                        <span className="tw-text-gray-600">&gt; 150%</span>
                    </div>
                </div> */}

                <div className="tw-mt-4">
                    <label className="tw-text-sm tw-text-gray-700">{t.searchDevices}</label>
                    <div className="tw-relative tw-mt-1">
                        <MagnifyingGlassIcon className="tw-absolute tw-left-3 tw-top-2.5 tw-h-5 tw-w-5 tw-text-gray-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t.searchPlaceholder}
                            className="tw-w-full tw-pl-11 tw-pr-3.5 tw-py-3 tw-text-base tw-rounded-2xl tw-border tw-border-gray-200  
                                       focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-indigo-200"
                        />
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
                <SideList title={t.deviceLeft} items={LEFT_LIST} filter={filter} search={query} t={t} />
                <SideList title={t.deviceCenter} items={CENTER_LIST} filter={filter} search={query} t={t} />
                <SideList title={t.deviceRight} items={RIGHT_LIST} filter={filter} search={query} t={t} />
            </div>

            {/* รายการแบบจัดกลุ่ม (ตามสถานะ) */}
            {/* <div className="tw-mt-8 tw-space-y-6">
                {showError && (
                    <Group
                        status="error"
                        title={t.issues}
                        devices={DEVICES.filter((d) => d.status === "error")}
                        defaultOpen
                        search={query}
                        t={t}
                    />
                )}
                {showWarn && DEVICES.some((d) => d.status === "warn") && (
                    <Group
                        status="warn"
                        title={t.monitor}
                        devices={DEVICES.filter((d) => d.status === "warn")}
                        defaultOpen
                        search={query}
                        t={t}
                    />
                )}
                {showOk && (
                    <Group
                        status="ok"
                        title={t.normal}
                        devices={DEVICES.filter((d) => d.status === "ok")}
                        defaultOpen={false}
                        search={query}
                        t={t}
                    />
                )}
            </div> */}

            <div className="tw-h-10" />
        </div>
    );
}