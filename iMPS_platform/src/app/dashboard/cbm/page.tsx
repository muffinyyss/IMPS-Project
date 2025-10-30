"use client";
import dynamic from "next/dynamic";

import ChargerEnv from "@/app/dashboard/cbm/components/chargerEnv";
import MDBEnv from "@/app/dashboard/cbm/components/mdbEnv";
import DeviceTempsCard from "@/app/dashboard/cbm/components/deviceTemp";
import PowerModulesCard from "@/app/dashboard/cbm/components/powermodule";
import FansCard from "@/app/dashboard/cbm/components/fan";
import PLCCard from "@/app/dashboard/cbm/components/plc";
import ChargingGunsCard from "@/app/dashboard/cbm/components/chargingGuns";
import InsuContactorStatusCard from "@/app/dashboard/cbm/components/InsuContactorStatusCard";
import EnergyPowerCard from "@/app/dashboard/cbm/components/EnergyPowerCard";
import DCContactorsTimesCard from "@/app/dashboard/cbm/components/DCContactorsCard";
import ACMagneticContactorsCard from "@/app/dashboard/cbm/components/ACMagneticContactorsCard";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const SalesByAge = dynamic(() => import("@/app/dashboard/cbm/components/sales-by-age"), { ssr: false });
const RevenueChart = dynamic(() => import("@/app/dashboard/cbm/components/revenue-chart"), { ssr: false });

type CBMDoc = {
  _id: string;
  edgebox_temp?: number
  pi5_temp?: number
  router_temp?: number
  timestamp?: string;
  [key: string]: any;
};
export default function SalesPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<CBMDoc | null>(null);
  const [stationId, setStationId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      `${API_BASE}/CBM?station_id=${encodeURIComponent(stationId)}`,
      { withCredentials: true } // สำคัญสำหรับ cookie-auth
    );

    const onInit = (e: MessageEvent) => {
      try {
        setData(JSON.parse(e.data));
        setLoading(false);
        setErr(null);
      } catch {
        setErr("ผิดรูปแบบข้อมูล init");
        setLoading(false);
      }
    };

    // es.addEventListener("init", onInit);
    es.addEventListener("init", (e: MessageEvent) => {
      // console.log("INIT raw:", e.data);
      try {
        const obj = JSON.parse(e.data);
        // console.log("INIT parsed:", obj);
        setData(obj);
        setLoading(false);
      } catch { }
    });

    es.onopen = () => setErr(null);

    // es.onmessage = (e) => {
    //     try {
    //         setData(JSON.parse(e.data));
    //         setErr(null);
    //     } catch {
    //         setErr("ผิดรูปแบบข้อมูล message");
    //     }
    // };

    es.onmessage = (e) => {
      // console.log("MSG raw:", e.data);
      try {
        const obj = JSON.parse(e.data);
        // console.log("MSG parsed:", obj);
        setData(obj);
      } catch { }
    };

    es.onerror = () => {
      setErr("SSE หลุดการเชื่อมต่อ (กำลังพยายามเชื่อมใหม่อัตโนมัติ)");
      setLoading(false);
      // ไม่ปิด es เพื่อให้ browser retry ตาม retry: 3000 ที่ server ส่งมา
    };

    return () => {
      es.removeEventListener("init", onInit);
      es.close();
    };
  }, [stationId]);

  const lastUpdated = data?.timestamp ? new Date(data.timestamp).toLocaleString("th-TH") : null;

  const toDec = (v: unknown, fallback = 0, digits = 1): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    const p = Math.pow(10, digits);
    return Math.round(n * p) / p;
  };

  return (
    <div className="tw-mt-8 tw-mb-4">
      {lastUpdated && (
        <span className="tw-text-xs !tw-text-blue-gray-500">
          อัปเดตล่าสุด: {lastUpdated}
        </span>
      )}

      {/* กริด 12 คอลัมน์ */}
      <div className="tw-mt-2 tw-grid tw-grid-cols-1 lg:tw-grid-cols-12 tw-gap-4">

        {/* แถวบน (3 + 3 + 6 = 12) */}
        <div className="lg:tw-col-span-3 tw-col-span-12">
          <ChargerEnv />
        </div>

        <div className="lg:tw-col-span-3 tw-col-span-12">
          <MDBEnv />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <DeviceTempsCard
            updatedAt="10:32"
            devices={[
              { id: "edge", name: "EdgeBox", temp: toDec(data?.edgebox_temp ?? 0), target: 60 },
              { id: "pi", name: "Raspberry Pi", temp: toDec(data?.pi5_temp ?? 0), target: 60 },
              { id: "router", name: "Router", temp: toDec(data?.router_temp ?? 0), target: 70 },
            ]}
          />
        </div>

        {/* แถวกลาง: Thermal pair = PLC + Guns */}
        <div className="lg:tw-col-span-6 tw-col-span-12">
          <PLCCard
            updatedAt="10:32"
            items={[
              { id: "plc1", name: "PLC 1 Temperature", temp: 42, target: 60 },
              { id: "plc2", name: "PLC 2 Temperature", temp: 55, target: 60 },
            ]}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <ChargingGunsCard
            updatedAt="10:32"
            items={[
              { id: "gun1", name: "Charging Gun 1 Temperature", temp: 43, target: 60 },
              { id: "gun2", name: "Charging Gun 2 Temperature", temp: 58, target: 60 },
            ]}
          />
        </div>

        {/* แถวถัดไป: สถานะไฟฟ้า + Power Modules แบ่ง 6/6 */}
        <div className="lg:tw-col-span-6 tw-col-span-12">
          <InsuContactorStatusCard
            title="Insulation Status"
            updatedAt="10:32"
            items={[
              {
                id: "insu1",
                name: "Insulation monitoring No.1 (Active/Inactive)",
                value: "Active", // หรือ true / "Closed" ก็ได้
              },
              {
                id: "insu2",
                name: "Insulation monitoring No.2 (Active/Inactive)",
                value: "Inactive", // หรือ false / "Open"
              },
            ]}
          />
        </div>

        {/* การ์ด AC Magnetic Contactor ใหม่ */}
        <div className="lg:tw-col-span-6 tw-col-span-12">
          <ACMagneticContactorsCard
            updatedAt="10:32"
            items={[
              { id: "ac1", name: "AC Magnetic Contactor Head 1 Status", value: "Closed" },  // หรือ true
              { id: "ac2", name: "AC Magnetic Contactor Head 2 Status", value: "Open" },     // หรือ false
            ]}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <DCContactorsTimesCard
            title="DC Contactor"
            updatedAt="10:32"
            unit="Times"      // หรือ "ครั้ง"
            decimals={0}
            items={[
              { id: "dc1", name: "DC Contactor No.1", times: data?.dcContNo1Times, mode: data?.dcContNo1Mode }, // mode: "NC"|"NO"
              { id: "dc2", name: "DC Contactor No.2", times: data?.dcContNo2Times, mode: data?.dcContNo2Mode },
              { id: "dc3", name: "DC Contactor No.3", times: data?.dcContNo3Times, mode: data?.dcContNo3Mode },
              { id: "dc4", name: "DC Contactor No.4", times: data?.dcContNo4Times, mode: data?.dcContNo4Mode },
              { id: "dc5", name: "DC Contactor No.5", times: data?.dcContNo5Times, mode: data?.dcContNo5Mode },
              { id: "dc6", name: "DC Contactor No.6", times: data?.dcContNo6Times, mode: data?.dcContNo6Mode },
            ]}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <EnergyPowerCard
            title="Energy Power (kWh)"
            updatedAt="10:32"
            /* mapping ตามที่กำหนด: dikW -> No.1, diKW -> No.2 */
            energy1={data?.dikW}
            energy2={data?.diKW}
            unit="kWh"
            decimals={0} // เป็น int ถ้าจะโชว์ทศนิยมเปลี่ยนเป็น 1/2 ได้
          />
        </div>

        <div className="lg:tw-col-span-12 tw-col-span-12">
          <PowerModulesCard
            updatedAt="10:32"
            items={[
              { id: "pm1", name: "Power module 1 Temperature", temp: 38, target: 60 },
              { id: "pm2", name: "Power module 2 Temperature", temp: 47, target: 60 },
              { id: "pm3", name: "Power module 3 Temperature", temp: 41, target: 60 },
              { id: "pm4", name: "Power module 4 Temperature", temp: 52, target: 60 },
              { id: "pm5", name: "Power module 5 Temperature", temp: 44, target: 60 },
            ]}
          />
        </div>

        {/* แถวล่าง: พัดลมเต็มแถว ให้ภาพรวมการระบายความร้อน */}
        <div className="lg:tw-col-span-12 tw-col-span-12">
          <FansCard
            updatedAt="10:32"
            fans={[
              { id: "fan1", name: "FAN1", rpm: 1800, active: true, maxRpm: 5000 },
              { id: "fan2", name: "FAN2", rpm: 0, active: false, maxRpm: 5000 },
              { id: "fan3", name: "FAN3", rpm: 2700, active: true, maxRpm: 5000 },
              { id: "fan4", name: "FAN4", rpm: 4200, active: true, maxRpm: 5000 },
              { id: "fan5", name: "FAN5", rpm: 5100, active: true, maxRpm: 6000 },
              { id: "fan6", name: "FAN6", rpm: 800, active: true },
              { id: "fan7", name: "FAN7", rpm: null, active: false },
              { id: "fan8", name: "FAN8", rpm: 3600, active: true },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
