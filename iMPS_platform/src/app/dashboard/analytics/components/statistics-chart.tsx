"use client";
import dynamic from "next/dynamic";

// @material-tailwind/react
import { Typography } from "@material-tailwind/react";

import { statisticsChartsData } from "@/data";

// @heroicons/react
import { ClockIcon } from "@heroicons/react/24/outline";

const StatisticsChart = dynamic(
  () => import("../../../../widgets/charts/statistics-chart"),
  {
    ssr: false,
  }
);

// Reste du template Creative Tim. statisticsChartsData etait un tableau de
// configurations de graphes ; il a ete reecrit en fonction (MDB, history, dates)
// pour la page MDB, mais ce composant continuait de faire .map dessus — la page
// /dashboard/analytics levait donc un TypeError des qu'elle etait rendue. Elle
// n'est referencee ni dans src/routes.jsx ni dans le sidenav : a supprimer avec
// le reste du template (recommandation 4 du rapport). En attendant, on ne plante
// plus le rendu — ni au build, ni dans le navigateur.
const chartsData = Array.isArray(statisticsChartsData) ? statisticsChartsData : [];

type Props = {};

export default function StatisticChart({}: Props) {
  return (
    <div className="tw-grid tw-grid-cols-1 tw-gap-6 md:tw-grid-cols-2 xl:tw-grid-cols-3">
      {chartsData.map((props: any) => (
        <StatisticsChart
          key={props.title}
          {...props}
          color={props.color as any}
          footer={
            <Typography
              variant="small"
              className="tw-flex tw-items-center !tw-font-normal tw-text-blue-gray-600"
            >
              <ClockIcon
                strokeWidth={2}
                className="tw-h-4 tw-w-4 tw-text-blue-gray-400"
              />
              &nbsp;{props.footer}
            </Typography>
          }
        />
      ))}
    </div>
  );
}
