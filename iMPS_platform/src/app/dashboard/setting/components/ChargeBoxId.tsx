"use client";
import React, { useEffect, useState } from "react";
import Card from "./chargerSetting-card";
import { useSearchParams } from "next/navigation";

type ChargerInfoResponse = {
  station?: {
    SN?: string;
    station_id?: string;
    station_name?: string;
    chargeBoxID?: string;
    // ฟิลด์อื่น ๆ ที่อาจมี
    [key: string]: any;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function ChargeBoxId() {
  const searchParams = useSearchParams();
  const [SN, setSN] = useState<string | null>(null);

  const [chargeBoxId, setChargeBoxId] = useState<string>("");
  const [stationName, setStationName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1) ดึง SN จาก URL → ถ้าไม่มีค่อย fallback localStorage
  useEffect(() => {
    const snFromUrl = searchParams.get("SN");
    if (snFromUrl) {
      setSN(snFromUrl);
      if (typeof window !== "undefined") {
        localStorage.setItem("selected_station_id", snFromUrl);
      }
      return;
    }
    const snLocal =
      typeof window !== "undefined" ? localStorage.getItem("selected_station_id") : null;
    setSN(snLocal);
  }, [searchParams]);

  // 2) ดึงข้อมูล charger เมื่อ SN เปลี่ยน
  useEffect(() => {
    if (!SN) return;

    const abort = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
        const res = await fetch(
          `${API_BASE}/charger/info?sn=${encodeURIComponent(SN)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: token ? "omit" : "include",
            signal: abort.signal,
          }
        );

        if (res.status === 401) {
          if (typeof window !== "undefined") localStorage.removeItem("access_token");
          throw new Error("Unauthorized");
        }
        if (res.status === 403) {
          throw new Error("Forbidden");
        }
        if (res.status === 404) {
          throw new Error("Charger not found");
        }
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const j = await res.json();
            msg = j.detail || j.message || msg;
          } catch {}
          throw new Error(msg);
        }

        const data: ChargerInfoResponse = await res.json();
        setChargeBoxId(data?.station?.chargeBoxID ?? "");
        setStationName(data?.station?.station_name ?? "");
      } catch (e: any) {
        if (e?.name !== "AbortError") setError(e?.message || "fetch failed");
      } finally {
        setLoading(false);
      }
    })();

    return () => abort.abort();
  }, [SN]);

  return (
    <Card title="Charge Box ID :">
      <div className="tw-text-lg sm:tw-text-xl tw-font-semibold tw-text-blue-gray-900">
        {!SN
          ? "ยังไม่ได้เลือกสถานี"
          : loading
          ? "กำลังโหลด..."
          : error
          ? <span className="tw-text-red-600">{error}</span>
          : (chargeBoxId || "—")}
      </div>
      {/* {stationName && !loading && !error && (
        <div className="tw-text-sm tw-text-blue-gray-500 tw-mt-1">
          {stationName}
        </div>
      )} */}
    </Card>
  );
}