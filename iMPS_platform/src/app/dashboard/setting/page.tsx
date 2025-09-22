"use client";
import React from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import ChargeBoxId from "./components/ChargeBoxId";
import ControlPanel from "./components/ControlPanel";
import InfoPanel from "./components/InfoPanel";
import EvPanel from "./components/EvPanel";
import PowerModule from "./components/PowerModule";

export default function SettingPage() {
  return (
    <div className="tw-space-y-6 tw-mt-8">
      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-3 tw-gap-6">
        <div className="tw-space-y-6">
          <ChargeBoxId />
          <ControlPanel />
          <InfoPanel />
        </div>
        <div className="tw-space-y-6">
          <EvPanel />
        </div>
        <div className="tw-space-y-6">
          <PowerModule />
        </div>
      </div>
    </div>
  );
}
