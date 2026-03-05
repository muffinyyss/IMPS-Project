"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";

// @material-tailwind/react
import {
    Card, CardBody, Typography,
} from "@/components/MaterialTailwind";

// components
import DateRangePicker from "./components/date-range";
import StatisticChart from "./components/statistics-chart";
import StatisticsCards from "./components/statistics-cards";
// import VoltageChart from "./components/area-chart";
import MDBInfo from "./components/mdb-info";
// import { floated } from "@material-tailwind/react/types/components/card";
// import { it } from "node:test";
// import { on } from "events";
import { statisticsChartsData } from "@/data/statistics-charts-data";
import { data_MDB } from "@/data/statistics-charts-data";

import { buildChartsFromHistory } from "@/data/statistics-charts-data";

import { useSearchParams } from "next/navigation";
import { timeStamp } from "console";

// เพิ่มใต้ import อื่นๆ
import { Button } from "@/components/MaterialTailwind";
import { PlusIcon } from "@heroicons/react/24/solid";
import AddEquipmentDialog from "./components/add-equipment-dialog";

type HistoryRow = {
    timestamp: string; // ISO time
    VL1N?: number; VL2N?: number; VL3N?: number;
    I1?: number; I2?: number; I3?: number;
    PL1N?: number; PL2N?: number; PL3N?: number;
    [k: string]: any;
};

// helper: format YYYY-MM-DD
function fmt(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// ✅ helper แปลง ISO timestamp -> เวลาไทย
// ✅ แก้ฟังก์ชันนี้ - บังคับแปลงเป็นเวลาไทยเสมอ
function formatThaiDateTime(iso?: string | null) {
    if (!iso) return "-";

    let d: Date;

    // ถ้าเป็นรูปแบบ "YYYY-MM-DD HH:mm:ss.ffffff" (ไม่มี Z หรือ timezone)
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(iso)) {
        // บังคับให้เป็น UTC โดยเติม Z ท้าย
        const utcString = iso.replace(' ', 'T') + 'Z';
        d = new Date(utcString);
    } else {
        // กรณีอื่นๆ
        d = new Date(iso);
    }

    // ถ้า parse ไม่ได้
    if (isNaN(d.getTime())) return String(iso);

    // แสดงผลเป็นเวลาไทย (บวก 7 ชม.อัตโนมัติ)
    return d.toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}

type Me = {
    username: string;
    role?: string;
    company?: string;
    station_id?: string
};

type MdbDoc = {
    _id: string;
    // ฟิลด์อื่น ๆ ตามที่ backend ส่งมา:
    station_id?: string;
    [key: string]: any;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// ✅ CHANGED: helpers กัน NaN และจัดรูปเลข
const int0 = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const num0 = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const digit1 = (v: any): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;

    // ปัดเป็นทศนิยม 2 ตำแหน่ง
    return Math.round((n + Number.EPSILON) * 10) / 10;
};

const digit2 = (v: any): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;

    // ปัดเป็นทศนิยม 2 ตำแหน่ง
    return Math.round((n + Number.EPSILON) * 100) / 100;
};

const digit3 = (v: any): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;

    // ปัดเป็นทศนิยม 3 ตำแหน่ง
    return Math.round((n + Number.EPSILON) * 1000) / 1000;
};

const intDiv = (v: any, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && d ? (n / d).toFixed(2) : "0.00";
};

async function login(email: string, password: string) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",        // ★ สำคัญ: เอาคุกกี้เข้า/ออก
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error("Login failed");
    const data = await res.json();

    // เก็บ token ไว้ใช้กับ fetch อื่น (non-SSE) ได้ตามต้องการ
    localStorage.setItem("accessToken", data.access_token);

    localStorage.setItem("user", JSON.stringify(data.user));
}

export default function MDBPage() {
    const searchParams = useSearchParams();
    const [stationId, setStationId] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryRow[]>([]); // ✅ เก็บข้อมูลลำดับเวลาเพื่อกราฟ
    const [userLogin, setUserLogin] = useState<Me | null>(null);
    const [mdb, setMdb] = useState<MdbDoc | null>(null);
    const [mdb2, setMdb2] = useState<MdbDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [loading2, setLoading2] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [err2, setErr2] = useState<string | null>(null);
    const [peakPower, setPeakPower] = useState<{ PL1N_peak?: number, PL2N_peak?: number, PL3N_peak?: number } | null>(null);

    const [openAddEquip, setOpenAddEquip] = useState(false);
    const hasPermission = userLogin?.role === "admin" || userLogin?.role === "owner";
    const hasMdbData = !!mdb && !loading;
    const canAddEquipment = hasPermission && !hasMdbData;

    // default: ล่าสุด 30 วัน
    const today = useMemo(() => new Date(), []);
    const twentyFourHoursAgo = useMemo(() => {
        const d = new Date();
        d.setHours(d.getHours() - 24);
        return d;  // Date object
    }, []);
    // const [startDate, setStartDate] = useState<string>(fmt(thirtyDaysAgo));
    // const [endDate, setEndDate] = useState<string>(fmt(today));

    // // draft (ไว้แก้ใน UI ยังไม่ยิงโหลดจนกด Apply)
    // const [draftStart, setDraftStart] = useState<string>(fmt(thirtyDaysAgo));
    // const [draftEnd, setDraftEnd] = useState<string>(fmt(today));

    const [startDate, setStartDate] = useState<string>(() => fmt(twentyFourHoursAgo));
    const [endDate, setEndDate] = useState<string>(fmt(today));
    const [draftStart, setDraftStart] = useState<string>(fmt(twentyFourHoursAgo));
    const [draftEnd, setDraftEnd] = useState<string>(fmt(today));

    // guard: รักษาลอจิก start <= end
    const handleStartChange = (v: string) => {
        setStartDate(v);
        if (endDate && v && new Date(v) > new Date(endDate)) setEndDate(v);
    };
    const handleEndChange = (v: string) => {
        const chosen = new Date(v);
        const cap = new Date(MAX_END);

        let next = v;
        if (v && chosen > cap) next = MAX_END; // clamp ไปที่พรุ่งนี้

        if (startDate && next && new Date(next) < new Date(startDate)) {
            setStartDate(next);
        }
        setEndDate(next);
    };


    const end_date = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate());
        return d;
    }, []);
    const MAX_END = fmt(end_date);
    const getTodayDate = () => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    };

    useEffect(() => {
        // 1) จาก URL
        const sidFromUrl = searchParams.get("station_id");
        if (sidFromUrl) {
            setStationId(sidFromUrl);
            localStorage.setItem("selected_station_id", sidFromUrl);
            return;
        }
        // 2) fallback localStorage (ตอนรีเฟรชหน้า)
        const sidLocal = localStorage.getItem("selected_station_id");
        setStationId(sidLocal);
    }, [searchParams]);


    // ✅ CHANGED: โหลด user จาก localStorage
    useEffect(() => {
        const load = () => {
            try {
                const token = localStorage.getItem("access_token");
                const rawUser = localStorage.getItem("user");
                setUserLogin(token && rawUser ? JSON.parse(rawUser) : null);
            } catch {
                setUserLogin(null);
            }
        };
        load();
        window.addEventListener("storage", load);
        return () => window.removeEventListener("storage", load);
    }, []);



    const parseDatetime = (iso: string) => {
        const fixed = iso.replace(/\.(\d{3})\d*/, ".$1");
        return new Date(fixed.endsWith("Z") ? fixed : fixed + "Z");
    };

    function makePusher(startISO: string, endISO: string) {
        const from = new Date(startISO).getTime();
        const to = new Date(endISO).getTime();
        return (doc: any) => {
            let ts = typeof doc.timestamp === "string" ? doc.timestamp : new Date().toISOString();
            if (!ts.endsWith("Z")) ts += "Z";
            const t = parseDatetime(ts).getTime();
            if (t < from || t > to) return;

            setHistory(prev => {
                const next: HistoryRow = {
                    timestamp: ts,
                    VL1N: Number(doc.VL1N ?? doc.V_L1N ?? 0),
                    VL2N: Number(doc.VL2N ?? doc.V_L2N ?? 0),
                    VL3N: Number(doc.VL3N ?? doc.V_L3N ?? 0),
                    I1: Number(doc.I1 ?? doc.I_L1 ?? 0),
                    I2: Number(doc.I2 ?? doc.I_L2 ?? 0),
                    I3: Number(doc.I3 ?? doc.I_L3 ?? 0),
                    PL1N: Number(doc.PL1N ?? doc.P_Active_L1 ?? 0),
                    PL2N: Number(doc.PL2N ?? doc.P_Active_L2 ?? 0),
                    PL3N: Number(doc.PL3N ?? doc.P_Active_L3 ?? 0),
                };

                const merged = [...prev, next];
                const pruned = merged
                    .filter(r => {
                        const tt = new Date(r.timestamp).getTime();
                        return tt >= from && tt <= to;
                    })
                    .slice(-5000)
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                return pruned;
            });
        };
    }

    // SSE ปัจจุบัน (ล่าสุด)
    useEffect(() => {
        if (!stationId) return;
        setHistory([]);         // ยังไม่ได้เลือก ไม่ต้องยิง
        setLoading(true);
        setErr(null);

        const es = new EventSource(
            `${API_BASE}/MDB/${encodeURIComponent(stationId)}`,
            { withCredentials: true }
        );

        es.onopen = () => setErr(null);
        const onInit = (e: MessageEvent) => { setMdb(JSON.parse(e.data)); setLoading(false); setErr(null); };
        es.addEventListener("init", onInit);
        es.onmessage = (e) => { setMdb(JSON.parse(e.data)); setErr(null); }; // ✅ ล้างทุกครั้งที่มีข้อมูล
        es.onerror = () => { setErr("SSE disconnected (auto-retry)"); setLoading(false); };

        return () => {
            es.removeEventListener("init", onInit);
            es.close();
        };
    }, [stationId]);

    const normalizeTs = (s: any) => {
        if (typeof s === "number") {
            const ms = s < 1_000_000_000_000 ? s * 1000 : s;
            return new Date(ms).toISOString();
        }
        let x = String(s ?? "").trim();
        if (!x) return null;
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(x)) x = x.replace(" ", "T");
        x = x.replace(/\.(\d{3})\d+/, ".$1");
        if (!/(Z|[+\-]\d{2}:\d{2})$/.test(x)) x += "Z";
        const d = new Date(x);
        return isNaN(d.getTime()) ? null : d.toISOString();
    };

    const mapRow = (d: any): HistoryRow | null => {
        const ts = normalizeTs(d.timestamp ?? d.Datetime);
        if (!ts) return null;
        const num = (v: any) => (v == null ? undefined : Number(v));
        return {
            timestamp: ts,
            // รองรับทั้ง format เดิม (VL1N) และ format ใหม่ (V_L1N)
            VL1N: num(d.VL1N ?? d.V_L1N),
            VL2N: num(d.VL2N ?? d.V_L2N),
            VL3N: num(d.VL3N ?? d.V_L3N),
            I1: num(d.I1 ?? d.I_L1),
            I2: num(d.I2 ?? d.I_L2),
            I3: num(d.I3 ?? d.I_L3),
            PL1N: num(d.PL1N ?? d.P_Active_L1),
            PL2N: num(d.PL2N ?? d.P_Active_L2),
            PL3N: num(d.PL3N ?? d.P_Active_L3),
        };
    };

    const inRange = (iso: string, startISO: string, endISO: string) => {
        const t = new Date(iso).getTime();
        return t >= new Date(startISO).getTime() && t <= new Date(endISO).getTime();
    };

    const pruneSort = (rows: HistoryRow[], startISO: string, endISO: string) =>
        rows
            .filter(r => inRange(r.timestamp, startISO, endISO))
            .slice(-5000)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const decimate = (rows: HistoryRow[], ms = 5 * 60 * 1000) => {
        const seen = new Set<number>();
        const out: HistoryRow[] = [];
        for (const r of rows) {
            const t = new Date(r.timestamp).getTime();
            const bucket = Math.floor(t / ms);
            if (!seen.has(bucket)) {
                seen.add(bucket);
                out.push(r);
            }
        }
        return out;
    };

    useEffect(() => {
        if (!stationId) return;

        setLoading2(true);
        setErr2(null);
        setHistory([]); // เคลียร์ก่อนโหลดช่วงใหม่

        // const startISO = `${startDate}T00:00:00Z`;
        // const endISO = `${endDate}T23:59:59.999Z`;

        // ใช้วันที่แบบ UTC boundary (สอดคล้องกับฝั่ง chart)
        const startISO = `${startDate}T00:00:00+07:00`;
        let endISO = `${endDate}T23:59:59.999+07:00`;
        const isTodayTH = (d: string) => {
            const nowTH = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
            const ddTH = new Date(`${d}T00:00:00+07:00`);
            return nowTH.getFullYear() === ddTH.getFullYear() &&
                nowTH.getMonth() === ddTH.getMonth() &&
                nowTH.getDate() === ddTH.getDate();
        };
        if (isTodayTH(endDate)) endISO = new Date().toISOString();

        // const url = `${API_BASE}/MDB/history?station_id=${encodeURIComponent(stationId)}&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
        const url = `${API_BASE}/MDB/history?station_id=${encodeURIComponent(stationId)}&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&every=5m`;
        // console.log("[SSE history] url =", url);

        const es = new EventSource(url, { withCredentials: true });

        const handleMessage = (e: MessageEvent) => {
            try {
                const payload = JSON.parse(e.data);
                setMdb2(payload);
                setLoading2(false);

                // กรณีส่งมาเป็นอาเรย์ก้อนเดียว
                if (Array.isArray(payload)) {
                    const rows = payload.map(mapRow).filter(Boolean) as HistoryRow[];
                    setHistory(prev => decimate(pruneSort([...prev, ...rows], startISO, endISO)));
                    return;
                }

                // กรณีห่อใน { data: [...] }
                if (Array.isArray(payload?.data)) {
                    const rows = payload.data.map(mapRow).filter(Boolean) as HistoryRow[];
                    setHistory(prev => decimate(pruneSort([...prev, ...rows], startISO, endISO)));
                    return;
                }

                // กรณีส่งมา “ทีละแถว”
                const one = mapRow(payload);
                if (one) {
                    setHistory(prev => decimate(pruneSort([...prev, one], startISO, endISO)));
                }
            } catch (err) {
                // เผื่อข้อความ keepalive ที่ไม่ใช่ JSON
            }
        };

        es.addEventListener("init", handleMessage);
        es.onmessage = handleMessage;
        es.onerror = () => {
            setErr2("SSE disconnected (auto-retry)");
            setLoading2(false);
        };

        return () => {
            es.removeEventListener("init", handleMessage);
            es.close();
        };
    }, [stationId, startDate, endDate]);

    // ✅ NEW: Fetch peak power values (หาจากข้อมูล database ทั้งหมด)
    useEffect(() => {
        if (!stationId) return;

        const fetchPeakPower = async () => {
            try {
                const url = `${API_BASE}/MDB/${encodeURIComponent(stationId)}/peak-power`;
                const response = await fetch(url, { credentials: 'include' });

                if (response.ok) {
                    const data = await response.json();
                    setPeakPower(data);
                }
            } catch (error) {
                console.error("Error fetching peak power:", error);
            }
        };

        fetchPeakPower();
    }, [stationId]);

    const station = mdb;

    // ✅ CHANGED: คำนวณค่าด้วย helper กัน NaN และ preserve ค่า pf/frequency เป็นทศนิยม
    const MDB = {
        tempc: int0(station?.tempc ?? station?.Ambient_Temp ?? station?.MCU_Temp),
        humidity: int0(station?.humidity ?? station?.Ambient_RH),
        fanOn: true,
        rssiDb: int0(station?.RSSI),

        main_breaker: station?.breaker_main ?? station?.Breaker_Main,
        breaker_charger: station?.breaker_charger ?? station?.Breaker_Charger,

        I1: digit2(station?.I1 ?? station?.I_L1),
        I2: digit2(station?.I2 ?? station?.I_L2),
        I3: digit2(station?.I3 ?? station?.I_L3),
        // ✅ แก้: ใช้ I_Total ถ้ามี
        totalCurrentA: digit2(
            station?.I_Total ??
            (Number(station?.I1 ?? station?.I_L1 ?? 0) +
                Number(station?.I2 ?? station?.I_L2 ?? 0) +
                Number(station?.I3 ?? station?.I_L3 ?? 0))
        ),

        powerKW: intDiv(
            station?.PL123N ?? station?.P_Active_Total ??
            (Number(station?.PL1N ?? station?.P_Active_L1 ?? 0) +
                Number(station?.PL2N ?? station?.P_Active_L2 ?? 0) +
                Number(station?.PL3N ?? station?.P_Active_L3 ?? 0)),
            1000
        ),

        totalEnergyKWh: intDiv(station?.EL123 ?? station?.E_Active_Total, 1000),
        frequencyHz: num0(station?.frequency ?? station?.Freq),

        pfL1: digit3(station?.pfL1 ?? station?.PF_L1),
        pfL2: digit3(station?.pfL2 ?? station?.PF_L2),
        pfL3: digit3(station?.pfL3 ?? station?.PF_L3),

        PL1N: intDiv(station?.PL1N ?? station?.P_Active_L1, 1000),
        PL2N: intDiv(station?.PL2N ?? station?.P_Active_L2, 1000),
        PL3N: intDiv(station?.PL3N ?? station?.P_Active_L3, 1000),
        PL123N: intDiv(
            station?.PL123N ?? station?.P_Active_Total ??
            (Number(station?.PL1N ?? station?.P_Active_L1 ?? 0) +
                Number(station?.PL2N ?? station?.P_Active_L2 ?? 0) +
                Number(station?.PL3N ?? station?.P_Active_L3 ?? 0)),
            1000
        ),

        EL1: intDiv(station?.EL1 ?? station?.E_Active_L1, 1000),
        EL2: intDiv(station?.EL2 ?? station?.E_Active_L2, 1000),
        EL3: intDiv(station?.EL3 ?? station?.E_Active_L3, 1000),
        EL123: intDiv(station?.EL123 ?? station?.E_Active_Total, 1000),

        // ✅ แก้: Voltage phase-to-neutral
        VL1N: digit1(station?.VL1N ?? station?.V_L1N),
        VL2N: digit1(station?.VL2N ?? station?.V_L2N),
        VL3N: digit1(station?.VL3N ?? station?.V_L3N),

        // ✅ แก้: Voltage line-to-line (V_L3L1 → VL1L3)
        VL1L2: digit1(station?.VL1L2 ?? station?.V_L1L2),
        VL2L3: digit1(station?.VL2L3 ?? station?.V_L2L3),
        VL1L3: digit1(station?.VL1L3 ?? station?.V_L3L1),

        // ✅ แก้: THD Voltage (THD_U_L1N)
        thdvL1: num0(station?.THDU_L1N ?? station?.THD_U_L1N),
        thdvL2: num0(station?.THDU_L2N ?? station?.THD_U_L2N),
        thdvL3: num0(station?.THDU_L3N ?? station?.THD_U_L3N),

        // ✅ แก้: THD Current (THD_I_L1)
        thdiL1: digit3(station?.THDI_L1 ?? station?.THD_I_L1),
        thdiL2: digit3(station?.THDI_L2 ?? station?.THD_I_L2),
        thdiL3: digit3(station?.THDI_L3 ?? station?.THD_I_L3),

        timeStamp: (station?.timestamp),

        mainBreakerStatus: Boolean(station?.mainBreakerStatus) || station?.Breaker_Main === "On",
        breakChargerStatus: Boolean(station?.breakChargerStatus) || station?.Breaker_Charger === "On",

        // peak power เหมือนเดิม...
        PL1N_peak: peakPower?.PL1N_peak != null ? intDiv(peakPower.PL1N_peak, 1000) : undefined,
        PL2N_peak: peakPower?.PL2N_peak != null ? intDiv(peakPower.PL2N_peak, 1000) : undefined,
        PL3N_peak: peakPower?.PL3N_peak != null ? intDiv(peakPower.PL3N_peak, 1000) : undefined,
        PL123N_peak: (peakPower?.PL1N_peak != null && peakPower?.PL2N_peak != null && peakPower?.PL3N_peak != null)
            ? intDiv((peakPower.PL1N_peak + peakPower.PL2N_peak + peakPower.PL3N_peak), 1000)
            : undefined,
    };

    const applyRange = () => {
        setHistory([]);
        setStartDate(draftStart);
        setEndDate(draftEnd);
    };
    // const MDB_type = statisticsChartsData(MDB)
    // const charts = data_MDB(MDB)
    // const charts = useMemo(() => buildChartsFromHistory(MDB, history), [MDB, history]);
    console.log("547", history)

    const charts = useMemo(() => buildChartsFromHistory(MDB, history, startDate, endDate), [MDB, history, startDate, endDate]);

    return (
        <div className="tw-mt-8 tw-mb-4">

            {/* ══════ Page Header ══════ */}
            <div className="tw-relative tw-overflow-hidden tw-rounded-2xl tw-mb-4 tw-px-5 sm:tw-px-8 tw-py-5 sm:tw-py-6"
                style={{ background: 'linear-gradient(135deg, #1a1a1a, #2d2d2d, #1a1a1a)' }}>
                <div className="tw-absolute tw-inset-0 tw-opacity-[0.04]"
                    style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }} />
                <div className="tw-absolute tw-top-0 tw-right-0 tw-w-64 tw-h-64 tw-rounded-full tw-opacity-[0.07]"
                    style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)', transform: 'translate(30%, -50%)' }} />

                <div className="tw-relative tw-z-10 tw-flex tw-items-center tw-justify-between tw-gap-4">
                    <div className="tw-flex tw-items-center tw-gap-3 sm:tw-gap-4">
                        <div className="tw-h-11 tw-w-11 sm:tw-h-12 sm:tw-w-12 tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                            <span className="tw-text-xl sm:tw-text-2xl">⚡</span>
                        </div>
                        <div>
                            <h2 className="tw-text-white tw-font-bold tw-text-base sm:tw-text-lg tw-tracking-tight">
                                MDB Monitoring
                            </h2>
                            {hasMdbData ? (
                                <p className="tw-text-white/40 tw-text-[11px] sm:tw-text-xs tw-mt-0.5 tw-font-medium">
                                    Timestamp: {formatThaiDateTime(MDB?.timeStamp as string)}
                                </p>
                            ) : (
                                <p className="tw-text-white/30 tw-text-[11px] sm:tw-text-xs tw-mt-0.5">
                                    {typeof window !== "undefined" ? localStorage.getItem("selected_station_name") || stationId || "" : ""}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-3">
                        {hasMdbData && (
                            <div className="tw-hidden sm:tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-1.5 tw-rounded-full"
                                style={{ background: 'rgba(16,185,129,0.15)' }}>
                                <span className="tw-relative tw-flex tw-h-2 tw-w-2">
                                    <span className="tw-animate-ping tw-absolute tw-inline-flex tw-h-full tw-w-full tw-rounded-full tw-opacity-75"
                                        style={{ background: '#34d399' }} />
                                    <span className="tw-relative tw-inline-flex tw-rounded-full tw-h-2 tw-w-2"
                                        style={{ background: '#34d399' }} />
                                </span>
                                <span className="tw-text-[11px] tw-font-semibold" style={{ color: '#34d399' }}>LIVE</span>
                            </div>
                        )}
                        {err && hasMdbData && (
                            <div className="tw-hidden sm:tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-full"
                                style={{ background: 'rgba(239,68,68,0.15)' }}>
                                <span className="tw-h-2 tw-w-2 tw-rounded-full" style={{ background: '#f87171' }} />
                                <span className="tw-text-[11px] tw-font-semibold" style={{ color: '#f87171' }}>Reconnecting</span>
                            </div>
                        )}
                        {canAddEquipment && (
                            <button onClick={() => setOpenAddEquip(true)}
                                className="tw-flex tw-items-center tw-gap-1.5 sm:tw-gap-2 tw-px-3 sm:tw-px-4 tw-py-2 sm:tw-py-2.5 tw-rounded-xl tw-text-xs sm:tw-text-sm tw-font-semibold tw-shadow-lg tw-transition-all tw-duration-200 hover:tw-scale-[1.03]"
                                style={{ background: 'linear-gradient(135deg, #ffffff, #f1f5f9)', color: '#1e293b' }}>
                                <PlusIcon className="tw-h-4 tw-w-4" />
                                <span className="tw-hidden sm:tw-inline">เพิ่มอุปกรณ์ MDB</span>
                                <span className="tw-inline sm:tw-hidden">+ เพิ่ม</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ══════ Content ══════ */}
            {hasMdbData ? (
                <>
                    <StatisticsCards {...MDB} />

                    {/* MDB Info — ใส่ border สีเทาอ่อนให้เข้ากับธีม */}
                    <Card className="tw-mb-6 tw-border tw-border-gray-200 tw-shadow-sm tw-rounded-2xl">
                        <CardBody className="tw-p-4 md:tw-p-6">
                            <MDBInfo {...MDB} />
                        </CardBody>
                    </Card>

                    <DateRangePicker
                        startDate={draftStart}
                        endDate={draftEnd}
                        onStartChange={setDraftStart}
                        onEndChange={setDraftEnd}
                        onApply={applyRange}
                        maxEndDate={getTodayDate()}
                    />

                    <StatisticChart
                        startDate={startDate}
                        endDate={endDate}
                        charts={charts}
                    />
                </>
            ) : !loading && (
                <div className="tw-relative tw-overflow-hidden tw-rounded-2xl tw-border tw-border-gray-200 tw-shadow-sm"
                    style={{ background: 'linear-gradient(180deg, #ffffff, #f8fafc)' }}>
                    <div className="tw-absolute tw-top-0 tw-left-1/2 tw-w-[500px] tw-h-[500px] tw-rounded-full tw-opacity-[0.03]"
                        style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)', transform: 'translate(-50%, -60%)' }} />
                    <div className="tw-relative tw-z-10 tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-20 sm:tw-py-28 tw-px-6">
                        <div className="tw-relative tw-mb-6">
                            <div className="tw-h-20 tw-w-20 sm:tw-h-24 sm:tw-w-24 tw-rounded-3xl tw-flex tw-items-center tw-justify-center tw-shadow-xl"
                                style={{ background: 'linear-gradient(135deg, #1e293b, #334155)' }}>
                                <span className="tw-text-4xl sm:tw-text-5xl">⚡</span>
                            </div>
                            <div className="tw-absolute tw-inset-0 tw-rounded-3xl tw-animate-ping tw-opacity-[0.08]"
                                style={{ background: '#3b82f6' }} />
                        </div>
                        <h3 className="tw-text-gray-800 tw-font-bold tw-text-lg sm:tw-text-xl tw-tracking-tight tw-mb-2 tw-text-center">
                            ยังไม่มีข้อมูลอุปกรณ์ MDB
                        </h3>
                        <p className="tw-text-gray-400 tw-text-sm tw-mb-8 tw-max-w-md tw-text-center tw-leading-relaxed">
                            สถานีนี้ยังไม่มีการติดตั้งอุปกรณ์ MDB<br className="tw-hidden sm:tw-inline" />
                            กดปุ่มด้านล่างเพื่อเพิ่มข้อมูลการติดตั้ง
                        </p>
                        {hasPermission && (
                            <button onClick={() => setOpenAddEquip(true)}
                                className="tw-group tw-flex tw-items-center tw-gap-2.5 tw-px-6 tw-py-3 tw-rounded-xl tw-text-sm tw-font-semibold tw-text-white tw-shadow-lg tw-transition-all tw-duration-300 hover:tw-shadow-xl hover:tw-scale-[1.03]"
                                style={{ background: 'linear-gradient(135deg, #1e293b, #334155)' }}>
                                <PlusIcon className="tw-h-5 tw-w-5 tw-transition-transform tw-duration-300 group-hover:tw-rotate-90" />
                                เพิ่มอุปกรณ์ MDB
                            </button>
                        )}
                        {!hasPermission && (
                            <div className="tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2.5 tw-rounded-xl"
                                style={{ background: 'rgba(59,130,246,0.08)' }}>
                                <span className="tw-text-sm">🔒</span>
                                <span className="tw-text-xs tw-text-blue-600 tw-font-medium">ติดต่อ Admin หรือ Owner เพื่อเพิ่มข้อมูล</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <AddEquipmentDialog
                open={openAddEquip}
                onClose={() => setOpenAddEquip(false)}
                stationId={stationId}
                stationName={typeof window !== "undefined" ? localStorage.getItem("selected_station_name") || undefined : undefined}
            />
        </div>
    );
}
