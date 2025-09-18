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


type HistoryRow = {
    Datetime: string; // ISO time
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
const intDiv = (v: any, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && d ? (n / d).toFixed(2) : "0.00";
};

export default function MDBPage() {
    const [history, setHistory] = useState<HistoryRow[]>([]); // ✅ เก็บข้อมูลลำดับเวลาเพื่อกราฟ
    const [userLogin, setUserLogin] = useState<Me | null>(null);
    const [mdb, setMdb] = useState<MdbDoc | null>(null);
    const [mdb2, setMdb2] = useState<MdbDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [loading2, setLoading2] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [err2, setErr2] = useState<string | null>(null);

    // default: ล่าสุด 30 วัน
    const today = useMemo(() => new Date(), []);
    const thirtyDaysAgo = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate());
        return d;
    }, []);

    const [startDate, setStartDate] = useState<string>(fmt(thirtyDaysAgo));
    const [endDate, setEndDate] = useState<string>(fmt(today));

    // draft (ไว้แก้ใน UI ยังไม่ยิงโหลดจนกด Apply)
    const [draftStart, setDraftStart] = useState<string>(fmt(thirtyDaysAgo));
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

   
    // ✅ CHANGED: โหลด user จาก localStorage
    useEffect(() => {
        const load = () => {
            try {
                const token = localStorage.getItem("accessToken");
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


   
    // ✅ CHANGED: ใช้ SSE (EventSource) แทน fetch (เรียลไทม์)
    useEffect(() => {
        setLoading(true);
        setErr(null);

        const sid =
            userLogin?.station_id != null ? String(userLogin.station_id) : "";
        // ถ้า backend คุณใช้ /MDB/stream ให้เปลี่ยนเป็น `${API_BASE}/MDB/stream...`
        const url = `${API_BASE}/MDB${sid ? `?station_id=${encodeURIComponent(sid)}` : ""}`;

        const es = new EventSource(url);

        const onInit = (e: MessageEvent) => {
            const doc: MdbDoc = JSON.parse(e.data);
            setMdb(doc);
            setLoading(false);
        };
        const onMsg = (e: MessageEvent) => {
            const doc: MdbDoc = JSON.parse(e.data);
            setMdb(doc);
        };
        const onErr = (_e: Event) => {
            // EventSource จะรีคอนเนกต์เองอัตโนมัติ
            setErr("SSE disconnected (auto-retry)");
            setLoading(false);
        };

        es.addEventListener("init", onInit);
        es.onmessage = onMsg;
        es.onerror = onErr;

        return () => {
            es.removeEventListener("init", onInit);
            es.close();
        };
    }, [userLogin?.station_id]);

    useEffect(() => {
        setLoading2(true);
        setErr2(null);

        const sid = userLogin?.station_id != null ? String(userLogin.station_id) : "";
        const startISO = new Date(`${startDate}T00:00:00Z`).toISOString();
        const endISO = new Date(`${endDate}T23:59:59.999Z`).toISOString();
        // const url = `${API_BASE}/MDB/history?station_id=${encodeURIComponent(sid)}&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
        const url = `${API_BASE}/MDB/history?station_id=${encodeURIComponent(sid)}&start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;

        const es = new EventSource(url);
        es.onmessage = (e) => {
            const doc = JSON.parse(e.data); 
        };
       
        const parseDatetime = (iso: string) => {
            // ตัด microseconds เหลือ 3 หลัก
            const fixed = iso.replace(/\.(\d{3})\d*/, ".$1");
            // เพิ่ม Z ถ้าไม่มี
            return new Date(fixed.endsWith("Z") ? fixed : fixed + "Z");
        };

        const withinRange = (iso: string) => {
            const d = parseDatetime(iso).getTime();
            const from = new Date(startISO).getTime();
            const to = new Date(endISO).getTime();
            return d >= from && d <= to;
        };

        const pushRealtimeToHistory = (doc: any) => {

            let ts = typeof doc.Datetime === "string" ? doc.Datetime : new Date().toISOString();

            if (!ts.endsWith("Z")) ts += "Z";

            if (!withinRange(ts)) return;

            setHistory(prev => {
                const next: HistoryRow = {
                    Datetime: ts,
                    VL1N: Number(doc.VL1N ?? 0),
                    VL2N: Number(doc.VL2N ?? 0),
                    VL3N: Number(doc.VL3N ?? 0),
                    I1: Number(doc.I1 ?? 0),
                    I2: Number(doc.I2 ?? 0),
                    I3: Number(doc.I3 ?? 0),
                    PL1N: Number(doc.PL1N ?? 0),
                    PL2N: Number(doc.PL2N ?? 0),
                    PL3N: Number(doc.PL3N ?? 0),
                };

                const merged = [...prev, next];

                const pruned = merged.filter(r => {
                    const t = new Date(r.Datetime).getTime();
                    return t >= new Date(startISO).getTime() && t <= new Date(endISO).getTime();
                }).slice(-5000);

                pruned.sort((a, b) => new Date(a.Datetime).getTime() - new Date(b.Datetime).getTime());

                return pruned;
            });
        };

        const onInit = (e: MessageEvent) => {
            const doc = JSON.parse(e.data);
            setMdb2(doc);
            setLoading2(false);
            pushRealtimeToHistory(doc);
        };

        const onMsg = (e: MessageEvent) => {
            const doc = JSON.parse(e.data);
            setMdb2(doc);
            pushRealtimeToHistory(doc);
        };

        const onErr = () => {
            setErr2("SSE disconnected (auto-retry)");
            setLoading2(false);
        };

        es.addEventListener("init", onInit);
        es.onmessage = onMsg;
        es.onerror = onErr;

        return () => {
            es.removeEventListener("init", onInit);
            es.close();
        };
    }, [userLogin?.station_id, startDate, endDate]);
    // console.log(startDate)
    // console.log(history)
    // if (loading) return <p>Loading...</p>;
    // ✅ CHANGED: เทียบ station_id แบบ object เดี่ยว (mdb เป็นก้อนเดียว)
    const station =
        userLogin && mdb &&
            String(mdb.station_id ?? "") === String(userLogin.station_id ?? "")
            ? mdb
            : null;

    // ✅ CHANGED: คำนวณค่าด้วย helper กัน NaN และ preserve ค่า pf/frequency เป็นทศนิยม
    const MDB = {
        tempc: int0(station?.tempc),
        humidity: int0(station?.humidity),
        fanOn: true,
        rssiDb: int0(station?.RSSI),

        I1: num0(station?.I1),
        I2: num0(station?.I2),
        I3: num0(station?.I3),
        totalCurrentA: num0(station?.I1 + station?.I2 + station?.I3),

        powerKW: intDiv(station?.PL123N, 1000),
        totalEnergyKWh: intDiv(station?.EL123, 1000),

        frequencyHz: num0(station?.frequency),
        pfL1: num0(station?.pfL1),
        pfL2: num0(station?.pfL2),
        pfL3: num0(station?.pfL3),

        PL1N: num0(station?.PL1N),
        PL2N: num0(station?.PL2N),
        PL3N: num0(station?.PL3N),
        PL123N: num0(station?.PL123N),

        EL1: intDiv(station?.EL1, 1000),
        EL2: intDiv(station?.EL2, 1000),
        EL3: intDiv(station?.EL3, 1000),
        EL123: intDiv(station?.EL123, 1000),

        VL1N: int0(station?.VL1N),
        VL2N: int0(station?.VL2N),
        VL3N: int0(station?.VL3N),

        VL1L2: int0(station?.VL1L2),
        VL2L3: int0(station?.VL2L3),
        VL1L3: int0(station?.VL1L3),

        thdvL1: num0(station?.THDU_L1N),
        thdvL2: num0(station?.THDU_L2N),
        thdvL3: num0(station?.THDU_L3N),

        thdiL1: num0(station?.THDI_L1),
        thdiL2: num0(station?.THDI_L2),
        thdiL3: num0(station?.THDI_L3),

        // mainBreakerStatus: Boolean(station?.mainBreakerStatus),
        // breakChargerStatus: Boolean(station?.breakChargerStatus),
        mainBreakerStatus: true,
        breakChargerStatus: true,
    };
    const applyRange = () => {
        setStartDate(draftStart);
        setEndDate(draftEnd);
    };
    // const MDB_type = statisticsChartsData(MDB)
    // const charts = data_MDB(MDB)
    // const charts = useMemo(() => buildChartsFromHistory(MDB, history), [MDB, history]);
    const charts = useMemo(() => buildChartsFromHistory(MDB, history, startDate, endDate), [MDB, history, startDate, endDate]);

    return (
        <div className="tw-mt-8 tw-mb-4">
            {/* โหลด/เออเรอร์ (ออปชัน) */}
            {loading && (
                <p className="tw-text-gray-500 tw-mb-2">กำลังเชื่อมต่อข้อมูลเรียลไทม์…</p>
            )}
            {err && <p className="tw-text-red-600 tw-mb-2">{err}</p>}
            

            <StatisticsCards {...MDB} />

            {/* Panel ข้อมูล MDB เต็มกว้าง */}
            <Card className="tw-mb-6 tw-border tw-border-blue-gray-100 tw-shadow-sm">
                <CardBody className="tw-p-4 md:tw-p-6">
                    <MDBInfo
                        {...MDB}
                    />
                </CardBody>
            </Card>

            <DateRangePicker
                startDate={draftStart}  // ใช้ draftStart แทน startDate
                endDate={draftEnd}      // ใช้ draftEnd แทน endDate
                onStartChange={setDraftStart}  // อัพเดต draftStart
                onEndChange={setDraftEnd}      // อัพเดต draftEnd
                onApply={applyRange}    // เมื่อกด Apply จะอัพเดต startDate และ endDate
                maxEndDate={getTodayDate()}  // ตั้งค่า maxEndDate เป็นวันที่ปัจจุบัน
            />

            {/* ส่งค่าช่วงวันที่ไปยัง StatisticChart */}
            <StatisticChart
                startDate={startDate}
                endDate={endDate}
                charts={charts} // สมมติว่า charts เป็นข้อมูลกราฟที่คุณต้องการแสดง
            />
        </div>
    );
}
