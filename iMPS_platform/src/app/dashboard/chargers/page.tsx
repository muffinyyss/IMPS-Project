"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// @material-tailwind/react
import {
  Card,
  CardHeader,
  CardBody,
  Typography,
} from "@/components/MaterialTailwind";

// components
import StationInfo from "./components/station-info";
import StatisticChart from "./components/statistics-chart";
import AICard from "./components/AICard";
import PMCard from "./components/PMCard";
import CBMCard from "./components/condition-Based";

import { useSearchParams } from "next/navigation";
const StationImage = dynamic(() => import("./components/station-image"), {
  ssr: false,
});

export default function ChargersPage() {
  const searchParams = useSearchParams();
  const stationId = searchParams.get("station_id");
  const [stationDetail, setStationDetail] = useState({
    station_name: "",
    model: "",
    status: null
  });
  useEffect(() => {
    if (stationId) {
      // ดึง API เพื่อโหลดข้อมูลสถานีนั้น
      const token = localStorage.getItem("accessToken");
        if (!token) throw new Error("No access token found");
      fetch(`http://localhost:8000/selected/station/${stationId}`, {
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,  // ✅ ส่ง token ไป
        }
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("Station details in ChargersPage:", data);
          // เซ็ต state ถ้าจะเอามาแสดง
          setStationDetail({
            station_name: data.station_name,
            model: data.model,
            status: data.status
          });
        });
    }
  }, [stationId]);


  return (
    <div className="tw-mt-8 tw-mb-4">
      {/* Sale by Country */}
      <div className="tw-mt-8 tw-mb-4">
        <div className="tw-mt-6 tw-grid tw-grid-cols-1 tw-gap-y-6 md:tw-grid-cols-2 lg:tw-grid-cols-3 lg:tw-gap-6 tw-items-stretch">
          <div className="tw-col-span-2 tw-h-full">
            <StationImage />
          </div>
          <div className="tw-col-span-1 tw-h-full">
            <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-h-full">
              <CardHeader floated={false} shadow={false} className="tw-px-6 tw-py-4 tw-relative">
                <Typography variant="h6" color="blue-gray">
                  Station Information
                </Typography>
              </CardHeader>
              <CardBody className="tw-flex tw-flex-col tw-flex-1 !tw-p-0">
                <StationInfo
                  // stationName="GIGA EV – LatPhraoWangHin"
                  // model="DC Fast 180 kW"
                  // status="Online"
                  station_name={stationDetail?.station_name ?? "-"}
                  model={stationDetail?.model}
                  status={stationDetail?.status}
                />
              </CardBody>
            </Card>
          </div>
        </div>
        <div className="tw-mt-5 tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-6">
          <StatisticChart />
          <AICard />
          <PMCard />
        </div>
      </div>
      <CBMCard />

      {/* <Card className="tw-mb-6 tw-border tw-border-blue-gray-100 tw-shadow-sm">
        <div className="tw-flex tw-items-center">
          <CardHeader
            floated={false}
            variant="gradient"
            color="gray"
            className="tw-grid tw-h-16 tw-w-16 tw-place-items-center"
          >
            <GlobeAltIcon className="tw-h-7 tw-w-7 tw-text-white" />
          </CardHeader>
          <Typography variant="h6" color="blue-gray" className="tw-mt-3">
            Charger pageeeeeeeeeeeeeeeeeeeeeeeeeee
          </Typography>
        </div>
        <CardBody className="tw-grid tw-grid-cols-1 tw-items-center tw-justify-between tw-p-4 lg:tw-grid-cols-2">
          <div className="tw-col-span-1 tw-overflow-scroll">
            <Table />
          </div>
          <WorldMap />
        </CardBody>
      </Card> */}
    </div>
  );
}