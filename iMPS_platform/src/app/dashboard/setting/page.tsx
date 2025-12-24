"use client";
import React, { useState, useEffect } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import ChargeBoxId from "./components/ChargeBoxId";
import ControlPanel from "./components/ControlPanel";
import InfoPanel from "./components/InfoPanel";
import EvPanel from "./components/EvPanel";
import PowerModule from "./components/PowerModule";
import Head1 from "./components/Head1";
import Head2 from "./components/Head2";
import EnergyPowerCard from "./components/EnergyPowerCard"
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
export default function SettingPage() {
  const [data, setData] = useState(null); // ถังเก็บข้อมูลรวม
  const searchParams = useSearchParams();
  const stationId = searchParams.get("station_id") || localStorage.getItem("selected_station_id");
      
    // SettingPage.tsx
    useEffect(() => {
        if (!stationId) return;

                // ✅ เพิ่ม { withCredentials: true } เพื่อแก้ปัญหา 401 Unauthorized
                const es = new EventSource(
                    `${API_BASE}/setting?station_id=${stationId}`, 
                    { withCredentials: true }
                );

                const onData = (e: MessageEvent) => {
                    try {
                        const parsed = JSON.parse(e.data);
                        console.log("เช็คข้อมูลที่ส่งมา:", parsed);
                        setData(parsed);
                    } catch (err) {
                        console.error("JSON Parse Error:", err);
                    }
                };

                es.onmessage = onData;
                es.addEventListener("init", onData);

                es.onerror = (e) => {
                    console.error("EventSource failed:", e);
                };

                return () => es.close();
            }, [stationId]);
      return (
        <div className="tw-space-y-6 tw-mt-8">
          <ChargeBoxId />
          
          <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-6">
            <div className="tw-space-y-6">
                <Head1 />
                <EnergyPowerCard head={1} data={data} /> 
                <EvPanel head={1} data={data} />
                <PowerModule  head={1} data={data}/>
                <InfoPanel head={1} data={data}/> 
                {/* <ControlPanel /> */}
              
            </div>
            <div className="tw-space-y-6">
                <Head2 /> 
                <EnergyPowerCard head={2} data={data}/> 
                <EvPanel head={2} data={data} />
                <PowerModule  head={2} data={data}/>
                <InfoPanel head={2} data={data}/>
            
            </div>
            
          </div>
          
        </div>
      );
    }