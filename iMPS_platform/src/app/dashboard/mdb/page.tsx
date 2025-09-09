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
import BookingCards from "./components/booking-cards";
import Table from "./components/table";
import StatisticsCards from "./components/statistics-cards";
import VoltageChart from "./components/area-chart";
import MDBInfo from "./components/mdb-info";

// map
const WorldMap = dynamic(() => import("./components/world-map"), { ssr: false });

// helper: format YYYY-MM-DD
function fmt(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

type MdbDoc = {
    _id: string;
    // ฟิลด์อื่น ๆ ตามที่ backend ส่งมา:
    station_id?: number;
    [key: string]: any;
};
export default function MDBPage() {
    const [mdb, setMdb] = useState<MdbDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // default: ล่าสุด 30 วัน
    const today = useMemo(() => new Date(), []);
    const thirtyDaysAgo = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d;
    }, []);

    const [startDate, setStartDate] = useState<string>(fmt(thirtyDaysAgo));
    const [endDate, setEndDate] = useState<string>(fmt(today));

    // guard: รักษาลอจิก start <= end
    const handleStartChange = (v: string) => {
        setStartDate(v);
        if (endDate && v && new Date(v) > new Date(endDate)) setEndDate(v);
    };
    const handleEndChange = (v: string) => {
        if (startDate && v && new Date(v) < new Date(startDate)) setStartDate(v);
        setEndDate(v);
    };

    // useEffect(() => {
    //     fetch("http://localhost:8000/MDB/")
    //     .then((res) => res.json())
    //     .then((data) => setMDB(data.station_id));
    //   },[]);

    useEffect(() => {
    const token = localStorage.getItem("accessToken");
    // if (!token) {
    //   setErr("กรุณาเข้าสู่ระบบก่อน");
    //   setLoading(false);
    //   return;
    // }

    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
        const res = await fetch(`${base}/MDB/`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rows = Array.isArray(data?.MDB) ? data.MDB : [];
        setMdb(rows);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message ?? "Fetch failed");
        setMdb([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
    if (loading) return <p>Loading...</p>;


    return (
        <div className="tw-mt-8 tw-mb-4">
            {mdb.length === 0 ? (<p>ไม่มีข้อมูล</p>) : (<p>มีข้อมูล</p>)}
            {/* <ul>
                {(MDB ?? []).map((doc) => (
                    <li key={doc._id}>{doc.station_id ?? "-"}</li>
                ))}
            </ul> */}
            {/* Statistics Cards */}
            <StatisticsCards
                tempC={55}
                humidity={87}
                fanOn={true}
                rssiDb={-54}
                signalLevel={4}
            />


            {/* Panel ข้อมูล MDB เต็มกว้าง */}
            <Card className="tw-mb-6 tw-border tw-border-blue-gray-100 tw-shadow-sm">
                <CardBody className="tw-p-4 md:tw-p-6">
                    <MDBInfo
                        tempC={55}
                        humidity={87}
                        fanOn={true}
                        rssiDb={-54}
                        signalLevel={4}
                        totalCurrentA={2.11}
                        powerKW={0.283}
                        totalEnergyKWh={"305049.248"}
                        frequencyHz={"50.04"}
                        pfL1={0.49}
                        pfL2={0.98}
                        pfL3={0}
                        thduL1={2.3}
                        thduL2={2.14}
                        thduL3={2.17}
                        thdiL1={55.28}
                        thdiL2={112.62}
                        thdiL3={100}
                    />
                </CardBody>
            </Card>

            {/* ===== Date range ก่อนกราฟทั้งสาม ===== */}
            <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartChange={handleStartChange}
                onEndChange={handleEndChange}
            />

            {/* ===== Statistics Charts (รับช่วงวันที่ไปใช้ได้) ===== */}
            {/* ถ้าคอมโพเนนต์กราฟของคุณรองรับ ให้ส่ง props ไปเลย */}
            <StatisticChart startDate={startDate} endDate={endDate} />

            {/* Booking Cards */}
            {/* <BookingCards /> */}
        </div>
    );
}
