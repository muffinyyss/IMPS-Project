"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ExclamationTriangleIcon, InboxIcon } from "@heroicons/react/24/solid";

/**
 * Shared "empty state" card — มาตรฐานเดียวกับหน้า Device
 * ใช้เมื่อหน้ายังไม่ได้เลือกตู้ชาร์จ (no-station) หรือยังไม่ได้ config pipeline /
 * ไม่มีข้อมูลส่งเข้ามา (no-data)
 */

type Lang = "th" | "en";
type Variant = "no-station" | "no-data";

export default function NoData({
  variant,
  stationId,
}: {
  variant: Variant;
  stationId?: string | null;
}) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") setLang(savedLang);

    const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => setLang(e.detail.lang);
    window.addEventListener("language:change", handleLangChange as EventListener);
    return () => window.removeEventListener("language:change", handleLangChange as EventListener);
  }, []);

  const t = useMemo(() => {
    const translations = {
      th: {
        noStationSelected: "กรุณาเลือกตู้ชาร์จก่อน",
        noData: "ไม่มีข้อมูล",
        stationId: "Station ID",
      },
      en: {
        noStationSelected: "Please select a charger first",
        noData: "No data",
        stationId: "Station ID",
      },
    };
    return translations[lang];
  }, [lang]);

  if (variant === "no-station") {
    return (
      <div className="tw-w-full tw-max-w-none tw-mx-auto tw-pt-6 md:tw-pt-8 tw-px-4 md:tw-px-1">
        <div className="tw-rounded-2xl tw-bg-white tw-shadow-sm tw-border tw-border-gray-100 tw-p-8 tw-text-center">
          <div className="tw-flex tw-justify-center tw-mb-4">
            <div className="tw-p-4 tw-rounded-full tw-bg-amber-50">
              <ExclamationTriangleIcon className="tw-h-10 tw-w-10 tw-text-amber-500" />
            </div>
          </div>
          <p className="tw-text-base tw-text-gray-600">{t.noStationSelected}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tw-w-full tw-max-w-none tw-mx-auto tw-pt-6 md:tw-pt-8 tw-px-4 md:tw-px-1">
      <div className="tw-rounded-2xl tw-bg-white tw-shadow-sm tw-border tw-border-gray-100 tw-p-8 tw-text-center">
        <div className="tw-flex tw-justify-center tw-mb-4">
          <div className="tw-p-4 tw-rounded-full tw-bg-gray-50">
            <InboxIcon className="tw-h-10 tw-w-10 tw-text-gray-400" />
          </div>
        </div>
        <p className="tw-text-base tw-text-gray-600">{t.noData}</p>
        {stationId && (
          <p className="tw-text-sm tw-text-gray-400 tw-mt-1">
            {t.stationId}: {stationId}
          </p>
        )}
      </div>
    </div>
  );
}
