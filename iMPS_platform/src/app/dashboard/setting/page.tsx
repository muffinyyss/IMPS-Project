"use client";
import React from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import ChargeBoxId from "./components/ChargeBoxId";
import ControlPanel from "./components/ControlPanel";
import InfoPanel from "./components/InfoPanel";
import EvPanel from "./components/EvPanel";
import PowerModule from "./components/PowerModule";
import Head1 from "./components/Head1";
import Head2 from "./components/Head2";
import EnergyPowerCard from "./components/EnergyPowerCard";


export default function SettingPage() {
  return (
    <div className="tw-space-y-6 tw-mt-8">
      <ChargeBoxId />
      
      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-6">
        <div className="tw-space-y-6">
          <Head1 />
          <EvPanel head={1} />
          <PowerModule  head={1} />
          <InfoPanel head={1} />
          {/* <ControlPanel /> */}
         <EnergyPowerCard head={1} />
        </div>
        <div className="tw-space-y-6">
          <Head2 />
         <EvPanel head={2} />
         <PowerModule  head={2} />
         <InfoPanel head={2} />
         <EnergyPowerCard head={2} />
        </div>
        
      </div>
      
    </div>
  );
}
