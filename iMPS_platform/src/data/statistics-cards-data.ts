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
    next_day: string;
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
    next_day: "-",
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
// ใหม่: ฟังก์ชันบวกเดือน
function addMonthsISO(iso: string, months: number) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function parseAsDateLocal(dateStr?: string | null, tzOffsetMinutes = 7 * 60) {
  if (!dateStr) return null;
  try {
    // รับทั้ง 'YYYY-MM-DD' และ ISO
    if (dateStr.length === 10) {
      // สร้างเป็นเวลา 00:00:00 ในโซนเวลาไทย (UTC+7)
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      // ชดเชยให้กลายเป็น "พื้นฐานไทย" โดยลบ offset ออกเพื่อให้เที่ยงคืนไทย
      dt.setUTCMinutes(dt.getUTCMinutes() - tzOffsetMinutes);
      return dt;
    }
    return new Date(dateStr);
  } catch {
    return null;
  }
}

function daysUntil(dateStr?: string | null) {
  const target = parseAsDateLocal(dateStr);
  if (!target) return null;

  // วันนี้ (โซนเวลาไทย) ที่เวลา 00:00
  const now = new Date();
  const nowTH = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  // ขยับให้เป็นเที่ยงคืนไทยโดยลบ 7 ชั่วโมงออก
  nowTH.setUTCHours(nowTH.getUTCHours() - 7, 0, 0, 0);

  // ปัดเวลาเป้าหมายให้เป็นเที่ยงคืนไทยด้วย (แค่เอาวันเปล่า ๆ มาเทียบ)
  const tgtTH = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  );
  tgtTH.setUTCHours(tgtTH.getUTCHours() - 7, 0, 0, 0);

  const diffMs = tgtTH.getTime() - nowTH.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays; // อาจเป็นลบถ้าเลยกำหนด
}

function renderDaysLeft(nextDate?: string | null) {
  const d = daysUntil(nextDate);
  if (d === null) return "-";
  if (d > 0) return `in ${d} day${d === 1 ? "" : "s"}`;
  if (d === 0) return "today";
  const overdue = Math.abs(d);
  return `overdue by ${overdue} day${overdue === 1 ? "" : "s"}`;
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
  const nextISO = latestISO ? addMonthsISO(latestISO, 6) : undefined;

  return {
    firmware: {
      plc: api.plc_firmware ?? "-",
      rpi: api.pi_firmware ?? "-",
      router: api.rt_firmware ?? "-",
    },
    pm: { latest: thDate(latestISO), next: thDate(nextISO), next_day:  renderDaysLeft(nextISO)},
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
