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
import DCContactorsTimesCard from "@/app/dashboard/cbm/components/DCContactorsCard";
import ACMagneticContactorsCard from "@/app/dashboard/cbm/components/ACMagneticContactorsCard";
import LoadingOverlay from "@/app/dashboard/components/Loadingoverlay";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/** shape ของ hardware config ที่ดึงจาก charger document */
type HardwareConfig = {
  powerModuleCount?: number;
  dcContractorCount?: number;
  dcFanCount?: number;
  fanType?: string;
  energyMeterType?: string;
};

type CBMDoc = {
  _id: string;

  // top-level fallbacks (legacy)
  powerModuleCount?: number;
  dcContractorCount?: number;

  // nested hardware (preferred)
  hardware?: HardwareConfig;

  DC_charger_temp?: number;
  charger_relative_humidity?: number;
  MDB_temp?: number;
  MDB_relative_humidity?: number;
  edgebox_temp?: number;
  pi5_temp?: number;
  router_temp?: number;
  PLC_temp1?: number;
  PLC_temp2?: number;
  charger_gun_temp_plus1?: number;
  charger_gan_temp_minus1?: number;
  charger_gun_temp_plus2?: number;
  charger_gan_temp_minus2?: number;
  insulation_monitoring_status1?: number;
  insulation_monitoring_status2?: number;
  AC_magnetic_contactor_status1?: number;
  AC_magnetic_contactor_status2?: number;

  DC_power_contractor1?: number;
  DC_power_contractor2?: number;
  DC_power_contractor3?: number;
  DC_power_contractor4?: number;
  DC_power_contractor5?: number;
  DC_power_contractor6?: number;

  power_module_temp1?: number;
  power_module_temp2?: number;
  power_module_temp3?: number;
  power_module_temp4?: number;
  power_module_temp5?: number;
  power_module_temp6?: number;

  fan_RPM1?: number;
  fan_RPM2?: number;
  fan_RPM3?: number;
  fan_RPM4?: number;
  fan_RPM5?: number;
  fan_RPM6?: number;
  fan_RPM7?: number;
  fan_RPM8?: number;

  fan_status1?: number;
  fan_status2?: number;
  fan_status3?: number;
  fan_status4?: number;
  fan_status5?: number;
  fan_status6?: number;
  fan_status7?: number;
  fan_status8?: number;

  timestamp?: string;
  [key: string]: any;
};

export default function SalesPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<CBMDoc | null>(null);
  const [SN, setSN] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // hardware config ที่ดึงตรงจาก charger document (แยกจาก SSE)
  const [hwConfig, setHwConfig] = useState<HardwareConfig | null>(null);

  // ── 1. อ่าน SN จาก URL หรือ localStorage ──────────────────────────────
  useEffect(() => {
    const snFromUrl = searchParams.get("SN");
    if (snFromUrl) {
      setSN(snFromUrl);
      localStorage.setItem("selected_sn", snFromUrl);
      return;
    }
    const snLocal = localStorage.getItem("selected_sn");
    setSN(snLocal);
  }, [searchParams]);

  // ── 2. ดึง hardware config จาก charger document ────────────────────────
  //    endpoint นี้ควร return { hardware: { powerModuleCount, dcContractorCount, dcFanCount, ... } }
  //    ปรับ path ให้ตรงกับ backend จริงของคุณ
  useEffect(() => {
    if (!SN || SN === "-") return;  // ✅ เพิ่ม SN === "-"

    fetch(`${API_BASE}/chargers?SN=${encodeURIComponent(SN)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((doc) => {
        // รองรับทั้ง array และ object
        const charger = Array.isArray(doc) ? doc[0] : doc;
        if (charger?.hardware) {
          setHwConfig(charger.hardware as HardwareConfig);
        }
      })
      .catch((e) => {
        console.warn("ไม่สามารถดึง hardware config:", e);
      });
  }, [SN]);

  // ── 3. SSE สำหรับข้อมูล real-time ────────────────────────────────────
  useEffect(() => {
    if (!SN || SN === "-") {  // ✅ เพิ่ม SN === "-"
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);

    const es = new EventSource(
      `${API_BASE}/CBM?SN=${encodeURIComponent(SN)}`,
      { withCredentials: true }
    );

    const onInit = (e: MessageEvent) => {
      try {
        const obj = JSON.parse(e.data);
        setData(obj);
        setLoading(false);
        setErr(null);
      } catch {
        setErr("ผิดรูปแบบข้อมูล init");
        setLoading(false);
      }
    };

    es.addEventListener("init", onInit);

    es.onopen = () => setErr(null);

    es.onmessage = (e) => {
      try {
        const obj = JSON.parse(e.data);
        setData(obj);
      } catch { }
    };

    es.onerror = () => {
      setErr("SSE หลุดการเชื่อมต่อ (กำลังพยายามเชื่อมใหม่อัตโนมัติ)");
      setLoading(false);
    };

    return () => {
      es.removeEventListener("init", onInit);
      es.close();
    };
  }, [SN]);

  // ── 4. รวม hardware config: SSE > charger API > top-level fallback ────
  //    priority: data.hardware (จาก SSE) → hwConfig (จาก charger API) → top-level fields
  const resolvedHardware = useMemo<HardwareConfig>(() => {
    return {
      powerModuleCount:
        data?.hardware?.powerModuleCount ??
        hwConfig?.powerModuleCount ??
        data?.powerModuleCount ??
        0,
      dcContractorCount:
        data?.hardware?.dcContractorCount ??
        hwConfig?.dcContractorCount ??
        data?.dcContractorCount ??
        0,
      dcFanCount:
        data?.hardware?.dcFanCount ??
        hwConfig?.dcFanCount ??
        0,
      fanType:                              // ← เพิ่มตรงนี้
        data?.hardware?.fanType ??
        hwConfig?.fanType ??
        "FIXED",
    };
  }, [data, hwConfig]);

  const lastUpdated = data?.timestamp
    ? new Date(data.timestamp).toLocaleString("th-TH")
    : undefined;

  const toDec = (v: unknown, fallback = 0, digits = 1): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    const p = Math.pow(10, digits);
    return Math.round(n * p) / p;
  };

  // ── 5. สร้าง items จาก resolvedHardware ──────────────────────────────
  const powerModuleItems = useMemo(() => {
    const count = Number(resolvedHardware.powerModuleCount ?? 0);
    if (count <= 0) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: `pm${i + 1}`,
      name: `Power module ${i + 1} Temperature`,
      temp: toDec(data?.[`power_module_temp${i + 1}`]),
      target: 60,
    }));
  }, [data, resolvedHardware]);

  const dcContactorItems = useMemo(() => {
    const count = Number(resolvedHardware.dcContractorCount ?? 0);
    if (count <= 0) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: `dc${i + 1}`,
      name: `DC Contactor No.${i + 1}`,
      times: data?.[`DC_power_contractor${i + 1}`],
      mode: data?.[`dcContNo${i + 1}Mode`],
    }));
  }, [data, resolvedHardware]);

  const fanItems = useMemo(() => {
    const maxRpm = resolvedHardware.fanType === "EBM" ? 6800 : 3500;  // ← ตรงนี้

    return Array.from({ length: 8 }, (_, i) => ({
      id: `fan${i + 1}`,
      name: `FAN${i + 1}`,
      rpm: toDec(data?.[`fan_RPM${i + 1}`]),
      active: !!data?.[`fan_status${i + 1}`],
      maxRpm,                              // ← ใช้ค่าที่คำนวณแล้ว
    }));
  }, [data, resolvedHardware]);

  // debug
  console.log("resolvedHardware =", resolvedHardware);
  console.log("powerModuleItems =", powerModuleItems);
  console.log("dcContactorItems =", dcContactorItems);
  console.log("fanItems =", fanItems);

  return (
    <div className="tw-mt-8 tw-mb-4">
      {err && (
        <div className="tw-mt-2 tw-text-sm tw-text-red-500">{err}</div>
      )}

      <LoadingOverlay show={loading} text="กำลังโหลดข้อมูล..." />

      {lastUpdated && (
        <span className="tw-text-xs !tw-text-blue-gray-500">
          อัปเดตล่าสุด: {lastUpdated}
        </span>
      )}

      <div className="tw-mt-2 tw-grid tw-grid-cols-1 lg:tw-grid-cols-12 tw-gap-4">

        {/* แถวบน */}
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
              { id: "gun1_plus", name: "Charging Gun 1 Temperature +", temp: toDec(data?.charger_gun_temp_plus1), target: 60 },
              { id: "gun1_minus", name: "Charging Gun 1 Temperature -", temp: toDec(data?.charger_gan_temp_minus1), target: 60 },
            ]}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <ChargingGunsCard
            updatedAt={lastUpdated}
            items={[
              { id: "gun2_plus", name: "Charging Gun 2 Temperature +", temp: toDec(data?.charger_gun_temp_plus2), target: 60 },
              { id: "gun2_minus", name: "Charging Gun 2 Temperature -", temp: toDec(data?.charger_gan_temp_minus2), target: 60 },
            ]}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <InsuContactorStatusCard
            title="Insulation Status"
            updatedAt={lastUpdated}
            items={[
              { id: "insu1", name: "Insulation monitoring No.1 (Active/Inactive)", value: toDec(data?.insulation_monitoring_status1) },
              { id: "insu2", name: "Insulation monitoring No.2 (Active/Inactive)", value: toDec(data?.insulation_monitoring_status2) },
            ]}
          />
        </div>

        <div className="lg:tw-col-span-6 tw-col-span-12">
          <ACMagneticContactorsCard
            updatedAt={lastUpdated}
            items={[
              { id: "ac1", name: "AC Magnetic Contactor Head 1 Status", value: toDec(data?.AC_magnetic_contactor_status1) },
              { id: "ac2", name: "AC Magnetic Contactor Head 2 Status", value: toDec(data?.AC_magnetic_contactor_status2) },
            ]}
          />
        </div>

        {/* ─── หัว 1 ─── */}
        <div className="lg:tw-col-span-6 tw-col-span-12 tw-flex tw-flex-col tw-gap-4">
          {/* Power Module หัว 1: floor(count/2) ตัวแรก */}
          <PowerModulesCard
            updatedAt={lastUpdated}
            items={powerModuleItems.slice(0, Math.floor(powerModuleItems.length / 2))}
          />
          {/* DC Contactor หัว 1: ตัวที่ 1-3 */}
          <DCContactorsTimesCard
            title="DC Contactor Head 1"
            updatedAt={lastUpdated}
            unit="Times"
            decimals={0}
            items={dcContactorItems.slice(0, 3)}
          />

        </div>

        {/* ─── หัว 2 ─── */}
        <div className="lg:tw-col-span-6 tw-col-span-12 tw-flex tw-flex-col tw-gap-4">
          {/* Power Module หัว 2: ที่เหลือทั้งหมด */}
          <PowerModulesCard
            updatedAt={lastUpdated}
            items={powerModuleItems.slice(Math.floor(powerModuleItems.length / 2))}
          />
          {/* DC Contactor หัว 2: ตัวที่ 4-6 */}
          <DCContactorsTimesCard
            title="DC Contactor Head 2"
            updatedAt={lastUpdated}
            unit="Times"
            decimals={0}
            items={dcContactorItems.slice(3)}
          />

        </div>

        <div className="lg:tw-col-span-12 tw-col-span-12">
          <PLCCard
            updatedAt={lastUpdated}
            items={[
              { id: "plc1", name: "PLC Temperature 1", temp: Math.trunc(data?.PLC_temp1 ?? 0), target: 60 },
              { id: "plc2", name: "PLC Temperature 2", temp: Math.trunc(data?.PLC_temp2 ?? 0), target: 60 },
            ]}
          />
        </div>

        <div className="lg:tw-col-span-12 tw-col-span-12">
          <FansCard
            updatedAt={lastUpdated}
            fans={fanItems}
          />
        </div>
      </div>
    </div>
  );
}