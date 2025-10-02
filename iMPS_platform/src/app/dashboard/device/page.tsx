import React from "react";
import dynamic from "next/dynamic";

// @material-tailwind/react
import {
  Card,
  CardHeader,
  CardBody,
  Typography,
} from "@/components/MaterialTailwind";

// @heroicons/react
import { GlobeAltIcon } from "@heroicons/react/24/outline";

// components
import StatisticsCards from "./components/statistics-cards";


export default function AnalyticsPage() {
  return (
    <div className="tw-mt-8 tw-mb-4">

      {/* Statistics Cards */}
      <StatisticsCards />

    </div>
  );
}
