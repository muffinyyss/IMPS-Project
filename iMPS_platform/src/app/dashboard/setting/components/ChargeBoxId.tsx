"use client";
import React, { useEffect, useState } from "react";
import Card from "./chargerSetting-card";
import { useSearchParams } from "next/navigation";

type StationInfoResponse = {
  station?: {
    station_id?: string;
    station_name?: string;
    chargeBoxID?: string;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function ChargeBoxId() {
  const searchParams = useSearchParams();
  const [stationId, setStationId] = useState<string | null>(null);

  const [chargeBoxId, setChargeBoxId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1) ดึง station_id จาก URL → ถ้าไม่มีค่อย fallback localStorage
  useEffect(() => {
    const sidFromUrl = searchParams.get("station_id");
    if (sidFromUrl) {
      setStationId(sidFromUrl);
      if (typeof window !== "undefined") {
        localStorage.setItem("selected_station_id", sidFromUrl);
      }
      return;
    }
    const sidLocal =
      typeof window !== "undefined" ? localStorage.getItem("selected_station_id") : null;
    setStationId(sidLocal);
  }, [searchParams]);

  // 2) ดึงข้อมูลสถานีเมื่อ stationId เปลี่ยน
  useEffect(() => {
    if (!stationId) return;

    const abort = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
        const res = await fetch(
          `${API_BASE}/station/info?station_id=${encodeURIComponent(stationId)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: token ? "omit" : "include", // ถ้าไม่มี token ให้พึ่งคุกกี้ httpOnly
            signal: abort.signal,
          }
        );

        if (res.status === 401) {
          if (typeof window !== "undefined") localStorage.removeItem("access_token");
          throw new Error("Unauthorized");
        }
        if (res.status === 403) {
          throw new Error("Forbidden station_id");
        }
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const j = await res.json();
            msg = j.detail || j.message || msg;
          } catch {}
          throw new Error(msg);
        }

        const data: StationInfoResponse = await res.json();
        setChargeBoxId(data?.station?.chargeBoxID ?? "");
      } catch (e: any) {
        if (e?.name !== "AbortError") setError(e?.message || "fetch failed");
      } finally {
        setLoading(false);
      }
    })();

    return () => abort.abort();
  }, [stationId]);

  return (
    <Card title="Charge Box ID :">
      <div className="tw-text-lg sm:tw-text-xl tw-font-semibold tw-text-blue-gray-900">
        {!stationId
          ? "ยังไม่ได้เลือกสถานี"
          : loading
          ? "กำลังโหลด..."
          : error
          ? <span className="tw-text-red-600">{error}</span>
          : (chargeBoxId || "—")}
      </div>
    </Card>
  );
}
