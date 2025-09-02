"use client";

import dynamic from "next/dynamic";
import React from "react";
import { Typography } from "@material-tailwind/react";
import { ClockIcon } from "@heroicons/react/24/outline";
import { data_MDB } from "@/data";

const StatisticsChartCard = dynamic(
  () => import("../../../../widgets/charts/statistics-chart"),
  { ssr: false }
);

type Props = {
  startDate?: string;
  endDate?: string;
};

// ---------- helpers ----------
const toDate = (v: any) => {
  if (v == null) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

function filterApexChartByDate(chart: any, start?: string, end?: string) {
  if (!chart) return chart;

  const options = chart.options ?? {};
  const xaxis = options.xaxis ?? {};
  const categories: any[] | undefined = xaxis.categories;
  const series: any[] | undefined = chart.series;

  if (!Array.isArray(categories) || !Array.isArray(series)) return chart;

  const from = start ? toDate(start) : null;
  const toRaw = end ? toDate(end) : null;
  if (!from && !toRaw) return chart;

  const to = toRaw
    ? (() => {
      const inc = new Date(toRaw);
      inc.setDate(inc.getDate() + 1);
      return inc;
    })()
    : null;

  const catDates = categories.map(toDate);
  const valid = catDates.filter(Boolean).length;
  if (valid === 0) return chart;

  const keepIdx: number[] = [];
  catDates.forEach((d, i) => {
    if (!d) return;
    if (from && d < from) return;
    if (to && d >= to) return;
    keepIdx.push(i);
  });

  if (keepIdx.length === 0) return chart;

  const newCategories = keepIdx.map((i) => categories[i]);
  const newSeries = series.map((s) => ({
    ...s,
    data: keepIdx.map((i) => s.data?.[i]),
  }));

  return {
    ...chart,
    series: newSeries,
    options: {
      ...options,
      xaxis: {
        ...xaxis,
        categories: newCategories,
      },
    },
  };
}

export default function StatisticChart({ startDate, endDate }: Props) {
  return (
    <div className="tw-grid tw-grid-cols-1 tw-gap-6 md:tw-grid-cols-2 xl:tw-grid-cols-3">
      {data_MDB.map((item) => {
        const filteredChart = filterApexChartByDate(
          item.chart,
          startDate,
          endDate
        );

        const descriptionNode = Array.isArray((item as any).metrics) ? (
          <dl className="tw-mt-1 tw-grid tw-grid-cols-1 tw-gap-y-2 md:tw-grid-cols-3 md:tw-gap-x-6">
            {(item as any).metrics.map(
              (m: { label: string; value: string }) => (
                <div key={m.label} className="tw-min-w-0">
                  <dt className="tw-text-sm tw-font-medium tw-text-blue-gray-600">
                    {m.label}
                  </dt>
                  <dd
                    className="
                      tw-text-sm tw-text-blue-gray-700
                      tw-tabular-nums tw-break-words tw-leading-snug
                    "
                    title={m.value} // เผื่อ hover ดูค่าเต็ม
                  >
                    {m.value}
                  </dd>
                </div>
              )
            )}
          </dl>
        ) : (
          item.description
        );


        return (
          <StatisticsChartCard
            key={item.title}
            {...item}
            description={descriptionNode}   // <-- ส่ง JSX ที่มี 3 ค่า
            chart={filteredChart}
            color={item.color as any}
            footer={
              <Typography
                variant="small"
                className="tw-flex tw-items-center !tw-font-normal tw-text-blue-gray-600"
              >
                <ClockIcon
                  strokeWidth={2}
                  className="tw-h-4 tw-w-4 tw-text-blue-gray-400"
                />
                &nbsp;{item.footer}
              </Typography>
            }
          />
        );
      })}
    </div>
  );
}
