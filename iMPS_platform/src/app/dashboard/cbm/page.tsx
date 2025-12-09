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
  DC_charger_temp?: number
  charger_relative_humidity?: number
  MDB_temp?: number
  MDB_relative_humidity?: number
  edgebox_temp?: number
  pi5_temp?: number
  router_temp?: number
  PLC_temp1?: number | undefined
  PLC_temp2?: number | undefined
  charger_gun_temp_plus1?: number
  charger_gan_temp_minus1?: number
  charger_gun_temp_plus2: number
  charger_gan_temp_minus2?: number
  insulation_monitoring_status1?: number
  insulation_monitoring_status2?: number
  AC_magnetic_contactor_status1?: number
  AC_magnetic_contactor_status2?: number
  DC_power_contractor1?: number
  DC_power_contractor2?: number
  DC_power_contractor3?: number
  DC_power_contractor4?: number
  DC_power_contractor5?: number
  energy_power_kWh1?: number
  energy_power_kWh2?: number
  power_module_temp1?: number
  power_module_temp2?: number
  power_module_temp3?: number
  power_module_temp4?: number
  power_module_temp5?: number
  fan_RPM1?: number
  fan_RPM2?: number
  fan_RPM3?: number
  fan_RPM4?: number
  fan_RPM5?: number
  fan_RPM6?: number
  fan_RPM7?: number
  fan_RPM8?: number
  fan_status1?: number
  fan_status2?: number
  fan_status3?: number
  fan_status4?: number
  fan_status5?: number
  fan_status6?: number
  fan_status7?: number
  fan_status8?: number
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

  const lastUpdated = data?.timestamp ? new Date(data.timestamp).toLocaleString("th-TH") : undefined;

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
          <ChargerEnv
            temp={Math.trunc(data?.DC_charger_temp ?? 0)}
            humidity={Math.trunc(data?.charger_relative_humidity ?? 0)}
          />
        </div>

        <div className="lg:tw-col-span-3 tw-col-span-12">
          <MDBEnv
            temp={Math.trunc(data?.MDB_temp ?? 0)}
            humidity={Math.trunc(data?.MDB_relative_humidity ?? 0)}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <DeviceTempsCard
            updatedAt={data?.timestamp}
            devices={[
              { id: "edge", name: "EdgeBox", temp: Math.trunc(data?.edgebox_temp ?? 0), target: 60 },
              { id: "pi", name: "Raspberry Pi", temp: Math.trunc(data?.pi5_temp ?? 0), target: 60 },
              { id: "router", name: "Router", temp: Math.trunc(data?.router_temp ?? 0), target: 70 },
            ]}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <ChargingGunsCard
            updatedAt={lastUpdated}
            items={[
              { id: "gun1", name: "Charging Gun 1 Temperature +", temp: toDec(data?.charger_gun_temp_plus1), target: 60 },
              { id: "gun1", name: "Charging Gun 1 Temperature -", temp: toDec(data?.charger_gan_temp_minus1), target: 60 },
            ]}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <ChargingGunsCard
            updatedAt={lastUpdated}
            items={[
              { id: "gun2", name: "Charging Gun 2 Temperature +", temp: toDec(data?.charger_gun_temp_plus2), target: 60 },
              { id: "gun2", name: "Charging Gun 2 Temperature -", temp: toDec(data?.charger_gan_temp_minus2), target: 60 },
            ]}
          />
        </div>

        {/* แถวถัดไป: สถานะไฟฟ้า + Power Modules แบ่ง 6/6 */}
        <div className="lg:tw-col-span-6 tw-col-span-12">
          <InsuContactorStatusCard
            title="Insulation Status"
            updatedAt={lastUpdated}
            items={[
              {
                id: "insu1",
                name: "Insulation monitoring No.1 (Active/Inactive)",
                value: toDec(data?.insulation_monitoring_status1), // หรือ true / "Closed" ก็ได้
              },
              {
                id: "insu2",
                name: "Insulation monitoring No.2 (Active/Inactive)",
                value: toDec(data?.insulation_monitoring_status2), // หรือ false / "Open"
              },
            ]}
          />
        </div>

        {/* การ์ด AC Magnetic Contactor ใหม่ */}
        <div className="lg:tw-col-span-6 tw-col-span-12">
          <ACMagneticContactorsCard
            updatedAt={lastUpdated}
            items={[
              { id: "ac1", name: "AC Magnetic Contactor Head 1 Status", value: toDec(data?.AC_magnetic_contactor_status1) },  // หรือ true
              { id: "ac2", name: "AC Magnetic Contactor Head 2 Status", value: toDec(data?.AC_magnetic_contactor_status2) },     // หรือ false
            ]}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <DCContactorsTimesCard
            title="DC Contactor"
            updatedAt={lastUpdated}
            unit="Times"      // หรือ "ครั้ง"
            decimals={0}
            items={[
              { id: "dc1", name: "DC Contactor No.1", times: data?.DC_power_contractor1, mode: data?.dcContNo1Mode }, // mode: "NC"|"NO"
              { id: "dc2", name: "DC Contactor No.2", times: data?.DC_power_contractor2, mode: data?.dcContNo2Mode },
              { id: "dc3", name: "DC Contactor No.3", times: data?.DC_power_contractor3, mode: data?.dcContNo3Mode },
              { id: "dc4", name: "DC Contactor No.4", times: data?.DC_power_contractor4, mode: data?.dcContNo4Mode },
              { id: "dc5", name: "DC Contactor No.5", times: data?.DC_power_contractor5, mode: data?.dcContNo5Mode },
              { id: "dc6", name: "DC Contactor No.6", times: data?.DC_power_contractor6, mode: data?.dcContNo6Mode },
            ]}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <EnergyPowerCard
            title="Energy Power (kWh)"
            updatedAt={lastUpdated}
            /* mapping ตามที่กำหนด: dikW -> No.1, diKW -> No.2 */
            energy1={data?.energy_power_kWh1}
            energy2={data?.energy_power_kWh2}
            unit="kWh"
            decimals={0} // เป็น int ถ้าจะโชว์ทศนิยมเปลี่ยนเป็น 1/2 ได้
          />
        </div>

        <div className="lg:tw-col-span-12 tw-col-span-12">
          <PowerModulesCard
            updatedAt={lastUpdated}
            items={[
              { id: "pm1", name: "Power module 1 Temperature", temp: toDec(data?.power_module_temp1), target: 60 },
              { id: "pm2", name: "Power module 2 Temperature", temp: toDec(data?.power_module_temp2), target: 60 },
              { id: "pm3", name: "Power module 3 Temperature", temp: toDec(data?.power_module_temp3), target: 60 },
              { id: "pm4", name: "Power module 4 Temperature", temp: toDec(data?.power_module_temp4), target: 60 },
              { id: "pm5", name: "Power module 5 Temperature", temp: toDec(data?.power_module_temp5), target: 60 },
            ]}
          />
        </div>

        {/* แถวล่าง: พัดลมเต็มแถว ให้ภาพรวมการระบายความร้อน */}
        <div className="lg:tw-col-span-12 tw-col-span-12">
          <FansCard
            updatedAt={lastUpdated}
            fans={[
              { id: "fan1", name: "FAN1", rpm: toDec(data?.fan_RPM1), active: !!data?.fan_status1, maxRpm: 3500 },
              { id: "fan2", name: "FAN2", rpm: toDec(data?.fan_RPM2), active: !!data?.fan_status2, maxRpm: 3500 },
              { id: "fan3", name: "FAN3", rpm: toDec(data?.fan_RPM3), active: !!data?.fan_status3, maxRpm: 3500 },
              { id: "fan4", name: "FAN4", rpm: toDec(data?.fan_RPM4), active: !!data?.fan_status4, maxRpm: 3500 },
              { id: "fan5", name: "FAN5", rpm: toDec(data?.fan_RPM5), active: !!data?.fan_status5, maxRpm: 3500 },
              { id: "fan6", name: "FAN6", rpm: toDec(data?.fan_RPM6), active: !!data?.fan_status6, maxRpm: 3500 },
              { id: "fan7", name: "FAN7", rpm: toDec(data?.fan_RPM7), active: !!data?.fan_status7, maxRpm: 3500 },
              { id: "fan8", name: "FAN8", rpm: toDec(data?.fan_RPM8), active: !!data?.fan_status8, maxRpm: 3500 },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
