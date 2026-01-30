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
    BoltIcon,
    CpuChipIcon,
    SignalIcon,
    ShieldCheckIcon,
    ChartBarIcon,
    CogIcon,
    ServerIcon,
    Battery100Icon,
    FunnelIcon,
    PowerIcon,
    WifiIcon,
    ArrowsRightLeftIcon,
} from "@heroicons/react/24/solid";

/* =========================
   1) Types & Helpers
   ========================= */
type Status = "ok" | "warn" | "error";
type MetricType = "times" | "day";
type Lang = "th" | "en";

type Device = {
    id: string;
    name: string;
    value?: string;
    status: Status;
    imageUrl?: string;
    metricType?: MetricType;
};

// ===== Lifetime Config (กำหนดที่ Frontend) - หน่วยเป็นวัน =====
const LIFETIME_CONFIG: Record<string, number> = {
    // Contactors (times - ครั้ง)
    "DC Power Contactor": 300000,
    "AC Power Contactor": 50000,
    // Motor Starters (times - ครั้ง)
    "Motor Starter": 30000,
    // Fuses (days - วัน)
    "FUSE": 4166, // ~11.4 years
    // RCCB (days - วัน)
    "RCCB": 3650, // 10 years
    "RCBO": 3650,
    // Energy Meter (days - วัน)
    "Energy Meter": 5475, // 15 years
    // Controllers (days - วัน)
    "Charging Controller": 3650,
    "Insulation Monitoring": 3650,
    // Router & Network (days - วัน)
    "Router": 3650,
    "OCPP Device": 3650,
    // Other components (days - วัน)
    "Circuit Breaker": 4166,
    "FAN Controller": 2083, // ~5.7 years
    "Power supplies": 3650,
    "DC Converter": 4166,
    "Surge Protection": 3650,
    "Disconnect Switch": 4166,
    "Noise Filter": 4166,
    // Default
    "default": 2083,
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

// คำนวณ Status จาก value และ deviceName (ใช้ lifetime)
function getDeviceStatus(deviceName: string, value: number): Status {
    const lifetime = getLifetime(deviceName);
    const usagePercent = calcUsagePercent(value, lifetime);
    const color = getStatusColor(usagePercent);
    if (color === "red") return "error";
    if (color === "yellow") return "warn";
    return "ok";
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

// แปลง value เป็นตัวเลข (วัน)
function parseValueToNumber(value?: string, metricType?: MetricType): number {
    if (!value) return 0;
    if (metricType === "day") {
        // ข้อมูลเก็บเป็นวินาที แปลงเป็นวัน
        const seconds = Number(String(value).replace(/[^\d.-]/g, "")) || 0;
        return Math.floor(seconds / 86400); // 86400 = 60*60*24 วินาทีต่อวัน
    }
    return Number(String(value).replace(/[^\d.-]/g, "")) || 0;
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

// ฟังก์ชันเลือก icon ตามชื่ออุปกรณ์
function getDeviceIcon(deviceName: string) {
    if (deviceName.includes("Contactor")) return BoltIcon;
    if (deviceName.includes("Motor")) return CogIcon;
    if (deviceName.includes("FUSE") || deviceName.includes("Fuse")) return ShieldCheckIcon;
    if (deviceName.includes("RCCB") || deviceName.includes("RCBO")) return ShieldCheckIcon;
    if (deviceName.includes("Energy Meter")) return ChartBarIcon;
    if (deviceName.includes("Charging Controller")) return CpuChipIcon;
    if (deviceName.includes("Insulation")) return SignalIcon;
    if (deviceName.includes("Router")) return WifiIcon;
    if (deviceName.includes("OCPP")) return ServerIcon;
    if (deviceName.includes("FAN") || deviceName.includes("Fan")) return CogIcon;
    if (deviceName.includes("Power supplies")) return Battery100Icon;
    if (deviceName.includes("DC Converter")) return ArrowsRightLeftIcon;
    if (deviceName.includes("Surge")) return ShieldCheckIcon;
    if (deviceName.includes("Disconnect")) return PowerIcon;
    if (deviceName.includes("Noise Filter")) return FunnelIcon;
    if (deviceName.includes("Circuit Breaker")) return ShieldCheckIcon;
    return CpuChipIcon; // default
}

/* =========================
   2) Device Card with Icon
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

    const strokeColor = color === "green" ? "#22c55e" : color === "yellow" ? "#f59e0b" : "#ef4444";
    const bgColor = color === "green" ? "tw-bg-green-50" : color === "yellow" ? "tw-bg-amber-50" : "tw-bg-red-50";
    const borderColor = color === "green" ? "tw-border-green-200" : color === "yellow" ? "tw-border-amber-200" : "tw-border-red-200";
    const iconColor = color === "green" ? "tw-text-green-500" : color === "yellow" ? "tw-text-amber-500" : "tw-text-red-500";
    const textColor = color === "green" ? "tw-text-green-600" : color === "yellow" ? "tw-text-amber-600" : "tw-text-red-600";

    const DeviceIcon = getDeviceIcon(name);

    return (
        <div className="tw-p-4 tw-bg-white tw-rounded-xl tw-border tw-border-gray-100 hover:tw-border-gray-200 tw-transition-colors">
            <div className="tw-flex tw-items-center tw-gap-4">
                {/* Icon */}
                <div className={`tw-relative tw-flex-shrink-0 tw-w-14 tw-h-14 tw-rounded-xl ${bgColor} ${borderColor} tw-border-2 tw-flex tw-items-center tw-justify-center`}>
                    <DeviceIcon className={`tw-w-7 tw-h-7 ${iconColor}`} />
                    {/* Status dot */}
                    <div 
                        className="tw-absolute -tw-top-1 -tw-right-1 tw-w-4 tw-h-4 tw-rounded-full tw-border-2 tw-border-white"
                        style={{ backgroundColor: strokeColor }}
                    />
                </div>
                
                {/* Info */}
                <div className="tw-flex-1 tw-min-w-0">
                    <p className="tw-font-medium tw-text-gray-800 tw-truncate tw-text-sm">{name}</p>
                    <div className="tw-mt-0.5 tw-flex tw-items-baseline tw-gap-1">
                        <span className="tw-text-base tw-font-bold tw-text-gray-900">{value.toLocaleString()}</span>
                        <span className="tw-text-xs tw-text-gray-400">/ {lifetime.toLocaleString()} {unit}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="tw-mt-2 tw-flex tw-items-center tw-gap-2">
                        <div className="tw-flex-1 tw-h-1.5 tw-bg-gray-100 tw-rounded-full tw-overflow-hidden">
                            <div 
                                className="tw-h-full tw-rounded-full tw-transition-all tw-duration-500"
                                style={{ 
                                    width: `${Math.min(usagePercent, 100)}%`,
                                    backgroundColor: strokeColor
                                }}
                            />
                        </div>
                        <span className={`tw-text-xs tw-font-semibold ${textColor}`}>
                            {usagePercent.toFixed(0)}%
                        </span>
                    </div>
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
        <div className="tw-p-4 tw-bg-white tw-rounded-xl tw-border tw-border-gray-100 tw-animate-pulse">
            <div className="tw-flex tw-items-center tw-gap-4">
                <div className="tw-w-14 tw-h-14 tw-bg-gray-100 tw-rounded-xl tw-flex-shrink-0" />
                <div className="tw-flex-1 tw-space-y-2">
                    <div className="tw-h-4 tw-bg-gray-100 tw-rounded tw-w-3/4" />
                    <div className="tw-h-4 tw-bg-gray-100 tw-rounded tw-w-1/2" />
                    <div className="tw-h-1.5 tw-bg-gray-100 tw-rounded-full tw-w-full" />
                </div>
            </div>
        </div>
    );
}

function SideListSkeleton({ title }: { title: string }) {
    return (
        <aside className="tw-rounded-2xl tw-bg-white tw-shadow-sm tw-border tw-border-gray-100 tw-p-5 sm:tw-p-6">
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-5">
                <div className="tw-flex tw-items-center tw-gap-2.5">
                    <div className="tw-w-1 tw-h-5 tw-bg-gray-400 tw-rounded-full" />
                    <p className="tw-text-sm tw-font-bold tw-text-gray-700 tw-uppercase tw-tracking-wide">{title}</p>
                </div>
            </div>
            <div className="tw-space-y-3">
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
        <aside className="tw-rounded-2xl tw-bg-white tw-shadow-sm tw-border tw-border-gray-100 tw-p-5 sm:tw-p-6">
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-5">
                <div className="tw-flex tw-items-center tw-gap-2.5">
                    <div className="tw-w-1 tw-h-5 tw-bg-gray-400 tw-rounded-full" />
                    <p className="tw-text-sm tw-font-bold tw-text-gray-700 tw-uppercase tw-tracking-wide">{title}</p>
                </div>
                <span className="tw-text-xs tw-font-medium tw-text-gray-400">{filtered.length} items</span>
            </div>

            <div className="tw-space-y-3">
                {filtered.map((d) => {
                    const numericValue = parseValueToNumber(d.value, d.metricType);
                    const unit = d.metricType === "day" ? t.day : t.times;

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
                    <div className="tw-text-center tw-text-sm tw-text-gray-400 tw-py-4">
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
                            const unit = d.metricType === "day" ? t.day : t.times;

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
    const [timestamp, setTimestamp] = useState<string>("");
    const esRef = useRef<EventSource | null>(null);
    const [stationId, setStationId] = useState<string>("");

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

    // ===== Get sn from URL or localStorage =====
    useEffect(() => {
        const sid = searchParams.get("sn") 
            || localStorage.getItem("selected_sn")
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
                updated: "อัพเดตล่าสุด",
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
                updated: "Last Updated",
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
        setTimestamp("");

        const ts = new Date().getTime();
        const url = `${API_BASE}/utilization/stream?sn=${encodeURIComponent(stationId)}&timestamp=${ts}`;
        const es = new EventSource(url, { withCredentials: true });
        esRef.current = es;

        es.addEventListener("init", (ev) => {
            try {
                const data = JSON.parse((ev as MessageEvent).data);
                setLive(data);
                if (data.timestamp) {
                    setTimestamp(new Date(data.timestamp).toLocaleString());
                }
                setLoading(false);
                setConnectionError(false);
            } catch { }
        });

        es.onmessage = (ev) => {
            try {
                const data = JSON.parse(ev.data);
                setLive(data);
                if (data.timestamp) {
                    setTimestamp(new Date(data.timestamp).toLocaleString());
                }
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
        
        // Helper function to create device with proper status
        const createDevice = (id: string, name: string, value: string | undefined, metricType: MetricType): Device => {
            const numValue = parseValueToNumber(value, metricType);
            return {
                id,
                name,
                value: value ?? "",
                status: getDeviceStatus(name, numValue),
                metricType
            };
        };

        const left: Device[] = [
            createDevice("dc-contact-l", "DC Power Contactor1", String(p.DC_power_contractor1 ?? ""), "times"),
            createDevice("dc-contact-2", "DC Power Contactor2", String(p.DC_power_contractor2 ?? ""), "times"),
            createDevice("dc-contact-5", "DC Power Contactor5", String(p.DC_power_contractor5 ?? ""), "times"),
            createDevice("dc-contact-6", "DC Power Contactor6", String(p.DC_power_contractor6 ?? ""), "times"),
            createDevice("fuse1-l", "FUSE1", String(p.FUSE1 ?? ""), "day"),
            createDevice("rccb1-l", "RCCB1", String(p.RCCB1 ?? ""), "day"),
            createDevice("ac-contact-l", "AC Power Contactor1", String(p.AC_power_contractor1 ?? ""), "times"),
            createDevice("motor1-l", "Motor Starter1", String(p.motor_starter1 ?? ""), "times"),
            createDevice("motor2-2", "Motor Starter2", String(p.motor_starter2 ?? ""), "times"),
            createDevice("emeter1", "Energy Meter1", String(p.energyMeter1 ?? ""), "day"),
            createDevice("charge-ctl1", "Charging Controller1", String(p.chargingController1 ?? ""), "day"),
            createDevice("iso1", "Insulation Monitoring1", String(p.insulationMonitoring1 ?? ""), "day"),
        ];

        const right: Device[] = [
            createDevice("dc-contact-3", "DC Power Contactor3", String(p.DC_power_contractor3 ?? ""), "times"),
            createDevice("dc-contact-4", "DC Power Contactor4", String(p.DC_power_contractor4 ?? ""), "times"),
            createDevice("fuse2-2", "FUSE2", String(p.FUSE2 ?? ""), "day"),
            createDevice("rccb2-2", "RCCB2", String(p.RCCB2 ?? ""), "day"),
            createDevice("ac-contact-2", "AC Power Contactor2", String(p.AC_power_contractor2 ?? ""), "times"),
            createDevice("motor3-3", "Motor Starter3", String(p.motor_starter3 ?? ""), "times"),
            createDevice("motor4-4", "Motor Starter4", String(p.motor_starter4 ?? ""), "times"),
            createDevice("motor5-5", "Motor Starter5", String(p.motor_starter5 ?? ""), "times"),
            createDevice("emeter2", "Energy Meter2", String(p.energyMeter2 ?? ""), "day"),
            createDevice("charge-ctl2", "Charging Controller2", String(p.chargingController2 ?? ""), "day"),
            createDevice("iso2", "Insulation Monitoring2", String(p.insulationMonitoring2 ?? ""), "day"),
        ];

        const center: Device[] = [
            createDevice("router-l", "Router", String(p.Router ?? ""), "day"),
            createDevice("fuse-ctl-l", "FUSE Control", String(p.FUSEControl ?? ""), "day"),
            createDevice("cb-fan-l", "Circuit Breaker fan", String(p.circuitBreakerFan ?? ""), "day"),
            createDevice("rcbo-l", "RCBO", String(p.RCBO ?? ""), "day"),
            createDevice("ocpp-r", "OCPP Device", String(p.OCPPDevice ?? ""), "day"),
            createDevice("fan-ctl-r", "FAN Controller", String(p.fanController ?? ""), "day"),
            createDevice("psu-r", "Power supplies", String(p.powerSupplies ?? ""), "day"),
            createDevice("dc-conv-r", "DC Converter", String(p.DCConverter ?? ""), "day"),
            createDevice("sp-r", "Surge Protection", String(p.surtgeProtection ?? ""), "day"),
            createDevice("disc-r", "Disconnect Switch", String(p.disconnectSwitch ?? ""), "day"),
            createDevice("noise-r", "Noise Filter", String(p.noiseFilter ?? ""), "day"),
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
            className={`tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-transition-all tw-duration-200 tw-border ${filter === id 
                ? "tw-bg-gray-900 tw-text-white tw-border-gray-900" 
                : "tw-bg-white tw-text-gray-600 tw-border-gray-200 hover:tw-border-gray-300 hover:tw-bg-gray-50"
            }`}
            aria-pressed={filter === id}
        >
            {dot && <span className={`tw-h-2 tw-w-2 tw-rounded-full ${dot}`} />}
            <span>{label}</span>
            {value !== undefined && (
                <span className={`tw-font-semibold tw-text-xs ${filter === id ? "tw-text-gray-400" : "tw-text-gray-400"}`}>{value}</span>
            )}
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
                <div className="tw-rounded-2xl tw-bg-white tw-shadow-sm tw-border tw-border-gray-100 tw-p-8 tw-text-center">
                    <div className="tw-flex tw-justify-center tw-mb-4">
                        <div className="tw-p-4 tw-rounded-full tw-bg-amber-50">
                            <ExclamationTriangleIcon className="tw-h-10 tw-w-10 tw-text-amber-500" />
                        </div>
                    </div>
                    <p className="tw-text-base tw-text-gray-600">{t.noStationSelected}</p>
                </div>
            </div>
        );
    }

    // Show loading state
    if (loading) {
        return (
            <div className="tw-w-full tw-max-w-none tw-mx-auto tw-pt-6 md:tw-pt-8 tw-px-4 md:tw-px-1">
                {/* Header skeleton */}
                <div className="tw-rounded-2xl tw-bg-white tw-shadow-sm tw-border tw-border-gray-100 tw-p-5 md:tw-p-6">
                    <div className="tw-flex tw-items-center tw-gap-3 tw-py-2">
                        <div className="tw-animate-spin tw-h-4 tw-w-4 tw-border-2 tw-border-gray-200 tw-border-t-gray-500 tw-rounded-full" />
                        <span className="tw-text-sm tw-text-gray-500">
                            {connectionError ? t.connectionFailed : t.connecting}
                        </span>
                    </div>
                    <div className="tw-mt-3 tw-flex tw-flex-wrap tw-gap-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="tw-h-8 tw-w-20 tw-bg-gray-100 tw-rounded-full tw-animate-pulse" />
                        ))}
                    </div>
                    <div className="tw-mt-4">
                        <div className="tw-h-3 tw-w-20 tw-bg-gray-100 tw-rounded tw-animate-pulse tw-mb-2" />
                        <div className="tw-h-10 tw-bg-gray-100 tw-rounded-lg tw-animate-pulse" />
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
                <div className="tw-rounded-2xl tw-bg-white tw-shadow-sm tw-border tw-border-gray-100 tw-p-8 tw-text-center">
                    <div className="tw-flex tw-justify-center tw-mb-4">
                        <div className="tw-p-4 tw-rounded-full tw-bg-gray-50">
                            <InboxIcon className="tw-h-10 tw-w-10 tw-text-gray-400" />
                        </div>
                    </div>
                    <p className="tw-text-base tw-text-gray-600">{t.noData}</p>
                    <p className="tw-text-sm tw-text-gray-400 tw-mt-1">Station ID: {stationId}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="tw-w-full tw-max-w-none tw-mx-auto tw-pt-6 md:tw-pt-8 tw-px-4 md:tw-px-1">

            {/* แผงสรุป/ค้นหา */}
            <div className="tw-rounded-2xl tw-bg-white tw-shadow-sm tw-border tw-border-gray-100 tw-p-5 md:tw-p-6">
                {/* Timestamp display */}
                {timestamp && (
                    <div className="tw-mb-5 tw-inline-flex tw-items-center tw-gap-2 tw-px-3 tw-py-1.5 tw-bg-gray-50 tw-rounded-full">
                        <div className="tw-w-2 tw-h-2 tw-bg-green-500 tw-rounded-full tw-animate-pulse" />
                        <span className="tw-text-xs tw-text-gray-500">{t.updated}</span>
                        <span className="tw-text-sm tw-font-medium tw-text-gray-700">{timestamp}</span>
                    </div>
                )}
                
                <div className="tw-flex tw-flex-wrap tw-gap-2">
                    <FilterBtn id="all" label={t.all} value={errorList.length + warnList.length + okList.length} />
                    <FilterBtn id="error" label={t.issues} dot="tw-bg-red-500" value={errorList.length} />
                    <FilterBtn id="warn" label={t.monitor} dot="tw-bg-amber-500" value={warnList.length} />
                    <FilterBtn id="ok" label={t.normal} dot="tw-bg-green-500" value={okList.length} />
                </div>

                <div className="tw-mt-5">
                    <label className="tw-text-xs tw-font-medium tw-text-gray-500 tw-uppercase tw-tracking-wide">{t.searchDevices}</label>
                    <div className="tw-relative tw-mt-2">
                        <MagnifyingGlassIcon className="tw-absolute tw-left-3 tw-top-2.5 tw-h-5 tw-w-5 tw-text-gray-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t.searchPlaceholder}
                            className="tw-w-full tw-pl-10 tw-pr-4 tw-py-2.5 tw-text-sm tw-bg-gray-50 tw-text-gray-700 tw-rounded-lg tw-border tw-border-gray-200  
                                       placeholder:tw-text-gray-400
                                       focus:tw-outline-none focus:tw-border-gray-300 focus:tw-bg-white tw-transition-all"
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