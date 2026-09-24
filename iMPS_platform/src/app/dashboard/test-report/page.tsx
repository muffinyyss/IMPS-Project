"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

import { ChevronDoubleUpIcon, ChevronDoubleDownIcon } from "@heroicons/react/24/solid";
import useLanguage, { type Lang } from "@/utils/useLanguage";

// Les tableaux ci-dessous vivent dans des onglets et un seul est rendu a la fois,
// mais un import statique les embarque tous dans le bundle de la page. next/dynamic
// les decoupe : seul l'onglet ouvert est telecharge. Pas de `ssr: false` — le rendu
// serveur est conserve, donc le squelette du tableau reste dans le HTML servi.
const DCTables = dynamic(() => import("@/app/dashboard/test-report/dc/list/components/dc-table"));
const ACTables = dynamic(() => import("@/app/dashboard/test-report/ac/list/components/ac-table"));

type ChargerType = "DC" | "AC";

// ===== Translations =====
const T = {
  selectCharger:  { th: "กรุณาเลือก Charger จากแถบด้านบน", en: "Please select a charger from the top bar" },
  scrollToTop:    { th: "เลื่อนขึ้นสุด",  en: "Scroll to top" },
  scrollToBottom: { th: "เลื่อนลงสุด",   en: "Scroll to bottom" },
} as const;

const t = (k: keyof typeof T, lang: Lang) => T[k][lang];

// เลื่อนขึ้นสุด/ลงสุดของหน้า
const scrollToTop = () =>
  window.scrollTo({ top: 0, behavior: "smooth" });
const scrollToBottom = () =>
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });

export default function DataTablesPage() {
  const { lang } = useLanguage();
  const [chargerType, setChargerType] = useState<ChargerType | null>(null);
  const searchParams = useSearchParams();

  // โหมดกรอกเอกสาร (add) — แสดงปุ่มเลื่อนเฉพาะตอนนี้
  const isFormView = searchParams.get("view") === "form";

  const loadChargerType = useCallback(() => {
    const type = localStorage.getItem("selected_chargerType");
    setChargerType(type === "AC" ? "AC" : type === "DC" ? "DC" : null);
  }, []);

  useEffect(() => {
    loadChargerType();

    const handleChargerChange = () => requestAnimationFrame(loadChargerType);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "selected_chargerType") loadChargerType();
    };

    window.addEventListener("charger:selected", handleChargerChange);
    window.addEventListener("charger:deselected", handleChargerChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("localStorageChange", handleChargerChange);

    return () => {
      window.removeEventListener("charger:selected", handleChargerChange);
      window.removeEventListener("charger:deselected", handleChargerChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("localStorageChange", handleChargerChange);
    };
  }, [loadChargerType]);

  if (!chargerType) {
    return (
      <div className="tw-w-full tw-text-center tw-py-12 tw-text-gray-400">
        {t("selectCharger", lang)}
      </div>
    );
  }

  return (
    <div className="tw-w-full tw-space-y-5">
      {chargerType === "DC" ? <DCTables /> : <ACTables />}

      {/* ปุ่มเลื่อนขึ้นสุด/ลงสุด — แสดงเฉพาะตอนกรอกเอกสาร (ทั้ง PC และมือถือ) */}
      {isFormView && (
      <div className="tw-fixed tw-bottom-5 tw-right-4 tw-z-40 tw-flex tw-flex-col tw-gap-2">
        <button
          type="button"
          onClick={scrollToTop}
          title={t("scrollToTop", lang)}
          aria-label={t("scrollToTop", lang)}
          className="tw-flex tw-items-center tw-justify-center tw-w-11 tw-h-11
                     tw-rounded-full tw-bg-gray-900 tw-text-white
                     tw-shadow-lg tw-shadow-gray-900/30
                     hover:tw-bg-gray-700 active:tw-scale-95
                     tw-transition-all tw-duration-200"
        >
          <ChevronDoubleUpIcon className="tw-h-5 tw-w-5" />
        </button>
        <button
          type="button"
          onClick={scrollToBottom}
          title={t("scrollToBottom", lang)}
          aria-label={t("scrollToBottom", lang)}
          className="tw-flex tw-items-center tw-justify-center tw-w-11 tw-h-11
                     tw-rounded-full tw-bg-gray-900 tw-text-white
                     tw-shadow-lg tw-shadow-gray-900/30
                     hover:tw-bg-gray-700 active:tw-scale-95
                     tw-transition-all tw-duration-200"
        >
          <ChevronDoubleDownIcon className="tw-h-5 tw-w-5" />
        </button>
      </div>
      )}
    </div>
  );
}