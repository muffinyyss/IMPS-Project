"use client";

import dynamic from "next/dynamic";
import React, { useState } from "react";
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
  const [isFullscreen, setIsFullscreen] = useState(false);  // สถานะการแสดงกราฟในโหมดเต็มหน้าจอ
  const [selectedChart, setSelectedChart] = useState<any>(null);  // เก็บข้อมูลกราฟที่เลือก
  const toggleFullscreen = (chart: any) => {
    setSelectedChart(chart);  // เก็บกราฟที่เลือก
    setIsFullscreen(!isFullscreen);  // สลับสถานะเต็มหน้าจอ
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);  // ปิดโหมดเต็มหน้าจอ
    setSelectedChart(null);  // ล้างข้อมูลกราฟ
  };

  return (
    <div className="tw-grid tw-grid-cols-1 tw-gap-6 md:tw-grid-cols-1 xl:tw-grid-cols-1">
      {data_MDB.map((item) => {
        const filteredChart = filterApexChartByDate(
          item.chart,
          startDate,
          endDate
        );

        const descriptionNode = Array.isArray((item as any).metrics) ? (
          <dl className="tw-mt-1 tw-grid tw-grid-cols-3 tw-gap-y-2 md:tw-grid-cols-3 md:tw-gap-x-6">
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
          // <StatisticsChartCard
          //   key={item.title}
          //   {...item}
          //   description={descriptionNode}   // <-- ส่ง JSX ที่มี 3 ค่า
          //   chart={filteredChart}
          //   color={item.color as any}
          //   footer={null}
          // />
          <div
            key={item.title}
            onClick={toggleFullscreen}  // เพิ่มการคลิกเพื่อสลับโหมดเต็มหน้าจอ
            className="tw-cursor-pointer"
          >
            <StatisticsChartCard
              {...item}
              description={descriptionNode}
              chart={filteredChart}
              color={item.color as any}
              footer={null}
            />
          </div>
        );


      })}
    </div>
  );
  {
    isFullscreen && selectedChart && (
      <div className="tw-fixed tw-top-0 tw-left-0 tw-w-full tw-h-full tw-bg-white tw-z-50 tw-flex tw-items-center tw-justify-center">
        <div className="tw-relative tw-w-full tw-h-full tw-p-4">
          <button
            onClick={closeFullscreen}
            className="tw-absolute tw-top-4 tw-right-4 tw-bg-gray-700 tw-text-white tw-p-2 tw-rounded-full"
          >
            ปิด
          </button>
          {/* <StatisticsChartCard
            chart={selectedChart}  // ใช้กราฟที่เลือก
            color="#4A90E2"  // เปลี่ยนสีตามที่ต้องการ
            footer={null}
          /> */}
        </div>
      </div>
    );
  }

}
