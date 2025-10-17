"use client";

import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image"

// @material-tailwind/react
import {
  Card,
  CardHeader,
  CardBody,
  Typography,
  Carousel,
} from "@/components/MaterialTailwind";

// components
import StationInfo from "./components/station-info";
import StatisticChart from "./components/statistics-chart";
import AICard from "./components/AICard";
import PMCard from "./components/PMCard";
import CBMCard from "./components/condition-Based";
import Lightbox from "./components/Lightbox";
import { useSearchParams, useRouter } from "next/navigation";


export default function ChargersPage() {
  const searchParams = useSearchParams();
  const stationId = searchParams.get("station_id");
  const [stationDetail, setStationDetail] = useState({
    station_name: "-",
    model: "-",
    status: null as boolean | null,
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [current, setCurrent] = useState<number>(0);

  const images = [
    { src: "/img/products/GIGAEV.webp", alt: "image 1" },
    { src: "/img/products/equipment.jpg", alt: "image 2" },
    { src: "/img/products/MDB.jpg", alt: "image 3" },
    { src: "/img/products/GIGAEV.webp", alt: "image 4" },
  ];

  const openAt = (idx: number) => {
    setCurrent(idx);
    setLightboxOpen(true);
  };
  const close = () => setLightboxOpen(false);

  const prev = useCallback(() => {
    setCurrent((i) => (i - 1 + images.length) % images.length);
  }, []);

  const next = useCallback(() => {
    setCurrent((i) => (i + 1) % images.length);
  }, []);

  useEffect(() => {
    if (lightboxOpen) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  React.useEffect(() => {
    if (!lightboxOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, close, prev, next]);

  useEffect(() => {
    if (!stationId) return;

    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      "";
    if (!token) return;

    const ctrl = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/station/info?station_id=${encodeURIComponent(stationId)}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        const info = data.station ?? data;

        setStationDetail((prev) => ({
          ...prev,
          station_name: info?.station_name ?? "-",
          model: info?.model ?? "-",
        }));
      } catch { }
    })();

    return () => ctrl.abort();
  }, [stationId]);

  useEffect(() => {
    if (!stationId) return;

    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      "";
    if (!token) return;

    const ctrl = new AbortController();

    const fetchStatus = async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/station-onoff/${encodeURIComponent(stationId)}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        setStationDetail((prev) => ({
          ...prev,
          status: typeof data?.status === "boolean" ? data.status : null,
        }));
      } catch { }
    };

    fetchStatus();
    const id = setInterval(fetchStatus, 5000);

    return () => {
      clearInterval(id);
      ctrl.abort();
    };
  }, [stationId]);

  return (
    <div className="tw-mt-8 tw-mb-4  tw-mx-auto tw-px-4 sm:tw-px-6">
      <div className="tw-mt-8 tw-mb-4">
        <div className="tw-mt-6 tw-grid tw-grid-cols-1 lg:tw-grid-cols-3 lg:tw-gap-6 tw-gap-y-6 tw-items-stretch">
          {/* LEFT: Carousel */}
          <div className="lg:tw-col-span-2 tw-min-h-0">
            <Carousel
              className="
                  tw-w-full !tw-max-w-none
                  tw-rounded-2xl tw-overflow-hidden tw-shadow-2xl
                  tw-h-[44vh]
                  sm:tw-h-[52vh]
                  md:tw-h-[70vh] md:tw-max-h-[80vh]
                  lg:tw-h-[64vh] lg:tw-max-h-[74vh]
                  xl:tw-h-[68vh]"
            >
              {(images?.length ? images : []).map((img, i) => (
                <img
                  key={(img?.src ?? 'img') + i}
                  src={img?.src}
                  alt={img?.alt ?? `image-${i + 1}`}
                  loading="lazy"
                  onClick={() => openAt(i)}
                  className="tw-h-full tw-w-full tw-object-cover tw-object-center tw-cursor-zoom-in"
                />
              ))}
              {!images?.length && (
                <div className="tw-flex tw-items-center tw-justify-center tw-w-full tw-h-full tw-bg-blue-gray-50">
                  <Typography variant="small" color="blue-gray">
                    No images to display
                  </Typography>
                </div>
              )}
            </Carousel>

            <Lightbox
              open={lightboxOpen}
              index={current}
              images={images}
              onClose={() => setLightboxOpen(false)}
              onIndexChange={setCurrent}
            />
          </div>

          {/* RIGHT: Station Information */}
          <div className="tw-min-h-0">
            <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-h-full">
              <CardHeader floated={false} shadow={false} className="tw-px-6 tw-py-4 tw-relative">
                <Typography variant="h6" color="blue-gray">
                  Station Information
                </Typography>
              </CardHeader>
              <CardBody className="tw-flex tw-flex-col tw-flex-1 !tw-p-0">
                <StationInfo
                  station_name={stationDetail?.station_name ?? "-"}
                  model={stationDetail?.model}
                  status={stationDetail?.status}
                />
              </CardBody>
            </Card>
          </div>
        </div>

        {/* แถวล่าง: ตัด sm:2 คอลัมน์ -> ให้เป็น 1 คอลัมน์จนถึง lg ค่อย 3 คอลัมน์ */}
        <div className="tw-mt-6 tw-grid tw-grid-cols-1 lg:tw-grid-cols-3 tw-gap-6">
          <StatisticChart />
          <AICard />
          <PMCard />
        </div>
      </div>

      {/* ระยะห่าง CBMCard */}
      <div className="tw-mt-6">
        <CBMCard />
      </div>
    </div>
  );

}