"use client";
import { useState, useEffect, useCallback } from "react";
import { aiApi, Station } from "../lib/api";
import { onSelectionChange } from "@/utils/selection-events";

export function useStation() {
    const [activeSn, setActiveSn]   = useState<string>("");
    const [activeName, setActiveName] = useState<string>("");
    const [stations, setStations]   = useState<Station[]>([]);
    const [loading, setLoading]     = useState(false);

    const loadStations = useCallback(async () => {
        try {
            const data = await aiApi.stations();
            const list = Array.isArray(data) ? data : (data as any)?.stations ?? [];
            setStations(list);
            return list as Station[];
        } catch (e) {
            console.error("loadStations:", e);
            setStations([]);
            return [];
        }
    }, []);

    const switchStation = useCallback(async (sn: string, stationList?: Station[]) => {
        if (!sn) return;
        setLoading(true);
        try {
            await aiApi.switchStation(sn);
            setActiveSn(sn);
            const list = stationList ?? stations;
            const found = list.find((s) => s.sn === sn);
            if (found) setActiveName(found.name);
            localStorage.setItem("selected_sn", sn);
        } catch (e) {
            console.error("switchStation:", e);
        } finally {
            setLoading(false);
        }
    }, [stations]);

    // ── Mount: อ่านสถานีจาก iMPS localStorage ──
    useEffect(() => {
        (async () => {
            const list = await loadStations();
            const sn = localStorage.getItem("selected_sn") || "";
            if (sn) await switchStation(sn, list);
        })();
    }, []);

    // ── Sync: ฟัง event จาก iMPS เมื่อเปลี่ยนสถานี/charger ──
    useEffect(() => {
        const handleChange = async () => {
            const sn = localStorage.getItem("selected_sn") || "";
            if (sn && sn !== activeSn) {
                await switchStation(sn);
            }
        };

        // เดิมมี polling fallback ทุก 3 s เพราะ event ไม่ครอบคลุมทุกกรณี
        // selection-events รวม pushState + localStorage ไว้แล้ว จึงไม่ต้อง poll
        return onSelectionChange(handleChange);
    }, [activeSn, switchStation]);

    return { activeSn, activeName, stations, loading, switchStation, loadStations };
}