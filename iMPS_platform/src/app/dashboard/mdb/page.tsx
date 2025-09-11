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
import { floated } from "@material-tailwind/react/types/components/card";
import { it } from "node:test";
import { on } from "events";

// map
const WorldMap = dynamic(() => import("./components/world-map"), { ssr: false });

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
    station_id?: number;
    [key: string]: any;
};
export default function MDBPage() {
    const [userLogin, setUserLogin] = useState<Me | null>(null);
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

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch("http://localhost:8000/MDB/");
                const data = await res.json();
                // data = { MDB: [...] }
                setMdb(data.MDB); // ✅ เก็บ array ของ users ลง state
            } catch (err) {
                console.error("Fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    // โหลดสถานะจาก localStorage + sync เมื่อมีการเปลี่ยนแปลงจากแท็บอื่น
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

    if (loading) return <p>Loading...</p>;

    const station = userLogin ? mdb.find(it => it.station_id === userLogin.station_id) : null;
    console.log(userLogin);
    console.log(mdb);
    // const MDB = {
    //     tempC: station?.frequency ?? 0,
    //     humidity: station?.VL1N ?? 0,
    //     fanOn: on,
    //     rssiDb:  station?.VL2N ?? 0,
    //     signalLevel: 4
    // };

    const MDB = {
        tempC: station?.temp ?? 0,
        humidity: station?.humi ?? 0,
        fanOn: true,
        rssiDb: 0,
        // signalLevel: 4 ,
        totalCurrentA: station?.I_toal ?? 0,
        powerKW: 0,
        totalEnergyKWh: 0,
        frequencyHz: station?.frequency ?? 0,
        pfL1: station?.PL1N ?? 0,
        pfL2: station?.PL2N ?? 0,
        pfL3: station?.PL3N ?? 0,
        EL1: station?.EL1 ?? 0,
        EL2: station?.EL2 ?? 0,
        EL3: station?.EL3 ?? 0,
        thduL1: station?.THDU_L1N ?? 0,
        thduL2: station?.THDU_L2N ?? 0,
        thduL3: station?.THDU_L3N ?? 0,
        thdiL1: station?.THDI_L1 ?? 0,
        thdiL2: station?.THDI_L2 ?? 0,
        thdiL3: station?.THDI_L3 ?? 0,
        mainBreakerStatus: station?.mainBreakerStatus ?? false,  // Add main breaker status
        breakChargerStatus: station?.breakChargerStatus ?? false,  // Add break charger status
    };
    return (

        <div className="tw-mt-8 tw-mb-4">
            {/* {userLogin ? userLogin.station_id : 0}
           

            <ul>
                {(mdb ?? []).map((doc) => (
                    <li key={doc._id}>mdb station_id {doc.station_id ?? "-"}</li>

                ))}
            </ul> */}
            {/* {mdb.length === 0 ? (<p>ไม่มีข้อมูล</p>) : (<p>mdb มีข้อมูล</p>)}
            {userLogin ?  (userLogin.station_id) : (null)}
            {userLogin
                ? (
                    mdb.find(it => it.station_id === userLogin.station_id)
                        ?.station_id ?? <p>ไม่มี</p>
                )
                : <p>ไม่มี--</p>
            } */}
            {/* Statistics Cards */}
            {/* <StatisticsCards
                tempC={55}
                humidity={87}
                fanOn={true}
                rssiDb={-54}
                signalLevel={3}
            /> */}
            {/* {station ? (
            <StatisticsCards
                tempC={station.frequency}
                humidity={87}
                fanOn={true}
                rssiDb={-54}
                signalLevel={3}
            />
            ) : ( <p>--</p> )} */}

            <StatisticsCards {...MDB} />

            {/* Panel ข้อมูล MDB เต็มกว้าง */}
            <Card className="tw-mb-6 tw-border tw-border-blue-gray-100 tw-shadow-sm">
                <CardBody className="tw-p-4 md:tw-p-6">
                    <MDBInfo
                        {...MDB}
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
