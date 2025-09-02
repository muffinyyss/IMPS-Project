import {
  BanknotesIcon,
  HomeModernIcon,
  ChartBarIcon,
  UserPlusIcon,
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
    plc: "PLC120kW_20240418",
    rpi: "V26012567a1",
    router: "RUT9R00.07.06.11",
  },
  pm: {
    latest: "20/12/2567",
    next: "15/01/2568",
  },
  icons: {
    firmware: WrenchScrewdriverIcon,
    date: CalendarDaysIcon,
  },
};


export default { statisticsCardsData, data_pmReport };
