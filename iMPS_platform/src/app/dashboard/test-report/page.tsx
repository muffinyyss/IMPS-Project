"use client";

import React, { useEffect, useState, useCallback } from "react";

import DCTables from "@/app/dashboard/test-report/dc/list/components/dc-table";
import ACTables from "@/app/dashboard/test-report/ac/list/components/ac-table";
import { ChevronDoubleUpIcon, ChevronDoubleDownIcon } from "@heroicons/react/24/solid";

type ChargerType = "DC" | "AC";

// เลื่อนขึ้นสุด/ลงสุดของหน้า
const scrollToTop = () =>
  window.scrollTo({ top: 0, behavior: "smooth" });
const scrollToBottom = () =>
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });

export default function DataTablesPage() {
  const [chargerType, setChargerType] = useState<ChargerType | null>(null);

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
        กรุณาเลือก Charger จากแถบด้านบน
      </div>
    );
  }

  return (
    <div className="tw-w-full tw-space-y-5">
      {chargerType === "DC" ? <DCTables /> : <ACTables />}

      {/* ปุ่มเลื่อนขึ้นสุด/ลงสุด — แสดงเฉพาะมือถือ */}
      <div className="sm:tw-hidden tw-fixed tw-bottom-5 tw-right-4 tw-z-40 tw-flex tw-flex-col tw-gap-2">
        <button
          type="button"
          onClick={scrollToTop}
          title="เลื่อนขึ้นสุด"
          aria-label="Scroll to top"
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
          title="เลื่อนลงสุด"
          aria-label="Scroll to bottom"
          className="tw-flex tw-items-center tw-justify-center tw-w-11 tw-h-11
                     tw-rounded-full tw-bg-gray-900 tw-text-white
                     tw-shadow-lg tw-shadow-gray-900/30
                     hover:tw-bg-gray-700 active:tw-scale-95
                     tw-transition-all tw-duration-200"
        >
          <ChevronDoubleDownIcon className="tw-h-5 tw-w-5" />
        </button>
      </div>
    </div>
  );
}