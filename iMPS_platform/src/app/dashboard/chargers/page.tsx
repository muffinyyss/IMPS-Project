"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card, CardHeader, CardBody, Typography, Carousel,
} from "@/components/MaterialTailwind";

import StationInfo from "./components/station-info";
import HealthIndex from "./components/health-index";
import AICard from "./components/AICard";
import PMCard from "./components/PMCard";
import CBMCard from "./components/condition-Based";
import Lightbox from "./components/Lightbox";
import LoadingOverlay from "@/app/dashboard/components/Loadingoverlay";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/utils/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type GalleryImage = { src: string; alt?: string };

export default function ChargersPage() {
  const searchParams = useSearchParams();
  const [stationId, setStationId] = useState<string | null>(null);
  const [sn, setSn] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [stationDetail, setStationDetail] = useState({
    station_id: "-",
    station_name: "-",
    model: "-",
    SN: "-",
    WO: "-",
    power: "-",
    brand: "-",
    status: null as boolean | null,
    commissioningDate: null as string | null,
    warrantyYears: null as string | null,
    PLCFirmware: "-",
    PIFirmware: "-",
    RTFirmware: "-",
    chargeBoxID: "-",
    chargerNo: null as number | null,
    numberOfCables: null as any,
  });

  const [images, setImages] = useState<GalleryImage[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [current, setCurrent] = useState<number>(0);

  const openAt = useCallback((idx: number) => {
    setCurrent(idx);
    setLightboxOpen(true);
  }, []);
  const close = useCallback(() => setLightboxOpen(false), []);

  const prev = useCallback(() => {
    if (!images.length) return;
    setCurrent(i => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const next = useCallback(() => {
    if (!images.length) return;
    setCurrent(i => (i + 1) % images.length);
  }, [images.length]);

  const carouselKey = useMemo(
    () => (images.length ? images.map(x => x.src).join("|") : "empty"),
    [images]
  );

  // ===== Lock body scroll เมื่อ lightbox เปิด =====
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

  // ===== Keyboard navigation สำหรับ lightbox =====
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, close, prev, next]);

  // ===== Main fetch: อ่าน URL params โดยตรง ไม่ผ่าน state =====
  useEffect(() => {
    const ctrl = new AbortController();

    // อ่านจาก URL params ก่อน ถ้าไม่มีค่อย fallback ไป localStorage
    const sidFromUrl = searchParams.get("station_id") || localStorage.getItem("selected_station_id");
    const snFromUrl  = searchParams.get("sn")         || localStorage.getItem("selected_sn");

    // sync กลับ localStorage
    if (sidFromUrl) localStorage.setItem("selected_station_id", sidFromUrl);
    if (snFromUrl)  localStorage.setItem("selected_sn", snFromUrl);

    // set state เพื่อให้ component อื่น (PMCard, status poll) ใช้ได้
    setStationId(sidFromUrl);
    setSn(snFromUrl);

    if (!sidFromUrl && !snFromUrl) {
      setPageLoading(false);
      return;
    }

    (async () => {
      setPageLoading(true);
      try {
        // 1. ดึงข้อมูล Charger — ใช้ snFromUrl/sidFromUrl โดยตรง
        const params = new URLSearchParams();
        if (snFromUrl)  params.append("sn", snFromUrl);
        if (sidFromUrl) params.append("station_id", sidFromUrl);

        const res = await apiFetch(
          `/charger/info?${params.toString()}`,
          { signal: ctrl.signal }
        );

        if (!res.ok) {
          console.warn("charger/info failed", res.status);
          return;
        }

        const data = await res.json();
        const chargerInfo = data.station ?? data;

        // helper แปลง string | string[] → string[]
        const toArr = (v: any): string[] =>
          Array.isArray(v) ? v : (typeof v === "string" && v ? [v] : []);

        // 2. รูป Charger + Device
        const chargerImages: GalleryImage[] = [];
        const chargerImgs = chargerInfo?.images ?? {};

        toArr(chargerImgs.charger).forEach((url, i) =>
          chargerImages.push({
            src: url.startsWith("http") ? url : `${API_BASE}${url}`,
            alt: `Charger Image${toArr(chargerImgs.charger).length > 1 ? ` ${i + 1}` : ""}`,
          })
        );
        toArr(chargerImgs.device).forEach((url, i) =>
          chargerImages.push({
            src: url.startsWith("http") ? url : `${API_BASE}${url}`,
            alt: `Device Image${toArr(chargerImgs.device).length > 1 ? ` ${i + 1}` : ""}`,
          })
        );

        // 3. ดึง station_name + รูป Station — ใช้ sidFromUrl โดยตรง
        const stationImages: GalleryImage[] = [];
        let stationName = "-";
        const currentStationId = chargerInfo?.station_id || sidFromUrl;

        if (currentStationId) {
          try {
            const stationRes = await apiFetch(
              `/selected/station/${encodeURIComponent(currentStationId)}`,
              { signal: ctrl.signal }
            );

            if (stationRes.ok) {
              const stationData = await stationRes.json();
              stationName = stationData?.station_name ?? "-";

              const stationImgs = stationData?.images ?? {};
              Object.entries(stationImgs).forEach(([key, val]) => {
                toArr(val).forEach((url, i) => {
                  if (url) stationImages.push({
                    src: url.startsWith("http") ? url : `${API_BASE}${url}`,
                    alt: `Station - ${key}${toArr(val).length > 1 ? ` ${i + 1}` : ""}`,
                  });
                });
              });
            }
          } catch (e) {
            console.warn("station info error", e);
          }
        }

        // 4. รวมรูป: Station ก่อน → Charger/Device ตามหลัง
        const allImages: GalleryImage[] = [
          ...stationImages,
          ...chargerImages,
        ];

        console.log("[Images] Total:", allImages.length, allImages);
        setImages(allImages);

        // 5. Set station detail
        setStationDetail(prev => ({
          ...prev,
          station_id:        chargerInfo?.station_id     ?? "-",
          station_name:      stationName,
          model:             chargerInfo?.model           ?? "-",
          commissioningDate: chargerInfo?.commissioningDate ?? null,
          warrantyYears:     chargerInfo?.warrantyYears != null
                               ? String(chargerInfo.warrantyYears)
                               : null,
          SN:          chargerInfo?.SN            ?? "-",
          WO:          chargerInfo?.WO            ?? "-",
          power:       chargerInfo?.power         ?? "-",
          brand:       chargerInfo?.brand         ?? "-",
          PLCFirmware: chargerInfo?.PLCFirmware   ?? "-",
          PIFirmware:  chargerInfo?.PIFirmware    ?? "-",
          RTFirmware:  chargerInfo?.RTFirmware    ?? "-",
          chargeBoxID: chargerInfo?.chargeBoxID   ?? "-",
          chargerNo:   chargerInfo?.chargerNo     ?? null,
          numberOfCables: chargerInfo?.numberOfCables ?? null,
        }));

      } catch (e) {
        if ((e as any)?.name !== "AbortError") {
          console.error("fetch error", e);
        }
      } finally {
        setPageLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [searchParams]); // depends แค่ searchParams — ไม่มี race condition

  // ===== Poll online/offline status ทุก 5 วินาที =====
  useEffect(() => {
    if (!sn) return;

    const ctrl = new AbortController();
    const fetchStatus = async () => {
      try {
        const res = await apiFetch(
          `/charger-onoff/${encodeURIComponent(sn)}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        setStationDetail(prev => ({
          ...prev,
          status: typeof data?.status === "boolean" ? data.status : null,
        }));
      } catch { }
    };

    fetchStatus();
    const id = setInterval(fetchStatus, 5000);
    return () => { clearInterval(id); ctrl.abort(); };
  }, [sn]);

  // ===== Render =====
  return (
    <div className="tw-mt-8 tw-mb-4 tw-mx-auto tw-px-4 sm:tw-px-6">
      <LoadingOverlay show={pageLoading} text="กำลังโหลดข้อมูล..." />

      <div className="tw-mt-8 tw-mb-4">
        <div className="tw-mt-6 tw-grid tw-grid-cols-1 lg:tw-grid-cols-3 lg:tw-gap-6 tw-gap-y-6">

          {/* LEFT: Carousel */}
          <div className="lg:tw-col-span-2">
            <Carousel
              key={carouselKey}
              className="tw-w-full tw-rounded-2xl tw-overflow-hidden tw-shadow-2xl
                         tw-h-[400px] sm:tw-h-[450px] md:tw-h-[500px] lg:tw-h-[550px] xl:tw-h-[600px]"
            >
              {images.length > 0 ? images.map((img, i) => (
                <div key={(img?.src ?? "img") + i} className="tw-relative tw-h-full tw-w-full">
                  <img
                    src={img.src}
                    alt={img.alt ?? `image-${i + 1}`}
                    loading="lazy"
                    onClick={() => openAt(i)}
                    className="tw-h-full tw-w-full tw-object-cover tw-object-center tw-cursor-zoom-in"
                  />
                  <div className="tw-absolute tw-bottom-4 tw-left-4 tw-bg-black/60 tw-text-white tw-px-3 tw-py-1 tw-rounded-full tw-text-sm">
                    {img.alt || `Image ${i + 1}`}
                  </div>
                </div>
              )) : (
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
              onClose={close}
              onIndexChange={setCurrent}
            />
          </div>

          {/* RIGHT: Station Information */}
          <div>
            <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm
                             tw-h-[400px] sm:tw-h-[450px] md:tw-h-[500px] lg:tw-h-[550px] xl:tw-h-[600px]
                             tw-flex tw-flex-col">
              <CardBody className="tw-flex-1 tw-overflow-y-auto !tw-p-0">
                <StationInfo
                  station_name={stationDetail.station_name}
                  model={stationDetail.model}
                  SN={stationDetail.SN}
                  WO={stationDetail.WO}
                  brand={stationDetail.brand}
                  power={stationDetail.power}
                  status={stationDetail.status}
                  commissioningDate={stationDetail.commissioningDate}
                  warrantyYears={stationDetail.warrantyYears}
                  PLCFirmware={stationDetail.PLCFirmware}
                  PIFirmware={stationDetail.PIFirmware}
                  RTFirmware={stationDetail.RTFirmware}
                  chargerSN={sn}
                  apiBaseUrl={API_BASE}
                />
              </CardBody>
            </Card>
          </div>
        </div>

        {/* แถวล่าง */}
        <div className="tw-mt-6 tw-grid tw-grid-cols-1 lg:tw-grid-cols-3 tw-gap-6">
          <HealthIndex />
          <AICard />
          <PMCard sn={sn ?? ""} />
        </div>
      </div>

      <div className="tw-mt-6">
        <CBMCard />
      </div>
    </div>
  );
}