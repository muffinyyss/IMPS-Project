"use client";

import React, { useEffect, useState, useCallback } from "react";

import DCTables from "@/app/dashboard/test-report/dc/list/components/dc-table";
import ACTables from "@/app/dashboard/test-report/ac/list/components/ac-table";

type ChargerType = "DC" | "AC";

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
    </div>
  );
}