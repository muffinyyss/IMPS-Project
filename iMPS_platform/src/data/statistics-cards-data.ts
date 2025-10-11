import {
  BanknotesIcon,
  HomeModernIcon,
  ChartBarIcon,
  UserPlusIcon,
  MapPinIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/solid";
import { WrenchScrewdriverIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import { CpuChipIcon } from "@heroicons/react/24/solid";
import type { ElementType } from "react";
// import type { ComponentType, SVGProps } from "react";


export const statisticsCardsData = [
  {
    color: "gray",
    icon: BanknotesIcon,
    title: "Bookings",
    value: "281",
    footer: {
      color: "tw-text-green-500",
      value: "+55%",
      label: "than last week",
    },
  },
  {
    color: "gray",
    icon: ChartBarIcon,
    title: "Today's Users",
    value: "2,300",
    footer: {
      color: "tw-text-green-500",
      value: "+2%",
      label: "than last month",
    },
  },
  {
    color: "gray",
    icon: HomeModernIcon,
    title: "Revenue",
    value: "34k",
    footer: {
      color: "tw-text-green-500",
      value: "+1%",
      label: "than yesterday",
    },
  },
  {
    color: "gray",
    icon: UserPlusIcon,
    title: "Followers",
    value: "+91",
    footer: {
      label: " Just updated",
    },
  },
];

export type PMReportData = {
  firmware: {
    plc: string;
    rpi: string;
    router: string;
  };
  pm: {
    latest: string;
    next: string;
  };
  icons?: {
    firmware?: ElementType;
    date?: ElementType;    
  };
};

export const data_pmReport: PMReportData = {
  firmware: {
    plc: "-",
    rpi: "-",
    router: "-",
  },
  pm: {
    latest: "-",
    next: "-",
  },
  icons: {
    firmware: WrenchScrewdriverIcon,
    date: CalendarDaysIcon,
  },
};

function thDate(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("th-TH-u-ca-buddhist", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString();
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";


// --- ฟังก์ชันเรียก backend แล้ว map ให้เป็น PMReportData ---
export async function loadPmReport(stationId: string, token?: string): Promise<PMReportData> {
  const res = await fetch(`${BASE_URL}/pmreport/latest/${encodeURIComponent(stationId)}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}), // ← ถ้าใช้ cookie ให้ลบบรรทัดนี้
    },
    // ถ้าใช้ cookie httpOnly แทน header:
    // credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());

  const api = (await res.json()) as {
    pi_firmware?: string; plc_firmware?: string; rt_firmware?: string;
    timestamp?: string; timestamp_utc?: string; timestamp_th?: string;
  };

  const latestISO = api.timestamp_th ?? api.timestamp_utc ?? api.timestamp ?? "";
  const nextISO = latestISO ? addDaysISO(latestISO, 30) : undefined;

  return {
    firmware: {
      plc: api.plc_firmware ?? "-",
      rpi: api.pi_firmware ?? "-",
      router: api.rt_firmware ?? "-",
    },
    pm: { latest: thDate(latestISO), next: thDate(nextISO) },
    icons: { firmware: WrenchScrewdriverIcon, date: CalendarDaysIcon },
  };
}

export const data_testReport = [
  {
    color: "gray",
    icon: BanknotesIcon,
    title: "Bookings",
    value: "281",
    footer: {
      color: "tw-text-green-500",
      value: "+55%",
      label: "than last week",
    },
  },
  {
    color: "gray",
    icon: ChartBarIcon,
    title: "Today's Users",
    value: "2,300",
    footer: {
      color: "tw-text-green-500",
      value: "+2%",
      label: "than last month",
    },
  },
  {
    color: "gray",
    icon: HomeModernIcon,
    title: "Revenue",
    value: "34k",
    footer: {
      color: "tw-text-green-500",
      value: "+1%",
      label: "than yesterday",
    },
  },
  {
    color: "gray",
    icon: UserPlusIcon,
    title: "Followers",
    value: "+90",
    footer: {
      label: " Just updated",
    },
  },
];

export type ChargerInfoData = {
  testStandard: string;
  chargingMethod: string;
  chargerType: string;
  brand: string;
  model: string;
  location: string;
  icons?: {
    information?: ElementType;
    location?: ElementType;
  };
};

export const data_chargerInfo: ChargerInfoData = {
  testStandard: "DIN 70121",
  chargingMethod: "CCS2/2",
  chargerType: "DC Charger 150kW",
  brand: "Flexx Fast",
  model: "FD150A",
  location: "PT BanNaDoem",
  icons: {
    information: InformationCircleIcon,
    location: MapPinIcon,
  },
};


export default { statisticsCardsData, data_pmReport, data_testReport };
