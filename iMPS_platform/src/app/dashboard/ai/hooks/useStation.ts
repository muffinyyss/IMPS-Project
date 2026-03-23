// src/app/dashboard/ai/hooks/useStation.ts
"use client";
import { useState, useEffect, useCallback } from "react";
import { aiApi, Station } from "../lib/api";

export function useStation() {
  const [activeSn, setActiveSn] = useState<string>("");
  const [activeName, setActiveName] = useState<string>("");
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);

  // โหลด sn จาก localStorage ที่ IMPS เก็บไว้
  useEffect(() => {
    const sn = localStorage.getItem("selected_sn") || "";
    if (sn) setActiveSn(sn);
    loadStations();
  }, []);

  const loadStations = useCallback(async () => {
    try {
        const data = await aiApi.stations();
        // API อาจ return { stations: [...] } หรือ array ตรงๆ
        const list = Array.isArray(data) ? data : (data as any)?.stations ?? [];
        setStations(list);
    } catch (e) {
        console.error("loadStations:", e);
        setStations([]); // fallback เป็น array ว่าง
    }
    }, []);

  const switchStation = useCallback(async (sn: string) => {
    setLoading(true);
    try {
      await aiApi.switchStation(sn);
      setActiveSn(sn);
      const found = stations.find((s) => s.sn === sn);
      if (found) setActiveName(found.name);
      // sync กลับไปที่ IMPS localStorage ด้วย
      localStorage.setItem("selected_sn", sn);
    } catch (e) {
      console.error("switchStation:", e);
    } finally {
      setLoading(false);
    }
  }, [stations]);

  return { activeSn, activeName, stations, loading, switchStation, loadStations };
}