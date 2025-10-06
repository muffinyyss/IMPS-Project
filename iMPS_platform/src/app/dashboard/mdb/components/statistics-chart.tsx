
"use client";

import dynamic from "next/dynamic";
import React, { useState } from "react";
import { Maximize2, X } from "lucide-react";
import { statisticsChartsData, data_MDB } from "@/data";
import type { MDBType } from "@/app/dashboard/mdb/components/mdb-info";
import Charts from "@/app/pages/charts/page";


const StatisticsChartCard = dynamic(
  () => import("../../../../widgets/charts/statistics-chart"),
  { ssr: false }
);
type Metric = { label: string; value: string | number };
type ChartCard = {
  color: string;
  title: string;
  description?: string;
  chart: any; // ถ้ามี type ของ ApexCharts ใส่แทน any ได้
  metrics: Metric[];
};

type Props = {
  startDate?: string;
  endDate?: string;
  charts: ChartCard[];
};

// ---------- helpers ----------
const toDate = (v: any) => {
  if (v == null) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// function filterApexChartByDate(chart: any, start?: string, end?: string) {
//   if (!chart) return chart;

//   const options = chart.options ?? {};
//   const xaxis = options.xaxis ?? {};
//   const categories: any[] | undefined = xaxis.categories;
//   const series: any[] | undefined = chart.series;

//   if (!Array.isArray(categories) || !Array.isArray(series)) return chart;

//   const from = start ? toDate(start) : null;
//   const toRaw = end ? toDate(end) : null;
//   if (!from && !toRaw) return chart;

//   const to = toRaw
//     ? (() => {
//       const inc = new Date(toRaw);
//       inc.setDate(inc.getDate() + 1);
//       return inc;
//     })()
//     : null;

//   const catDates = categories.map(toDate);
//   const valid = catDates.filter(Boolean).length;
//   if (valid === 0) return chart;

//   const keepIdx: number[] = [];
//   catDates.forEach((d, i) => {
//     if (!d) return;
//     if (from && d < from) return;
//     if (to && d >= to) return;
//     keepIdx.push(i);
//   });

//   if (keepIdx.length === 0) return chart;

//   const newCategories = keepIdx.map((i) => categories[i]);
//   const newSeries = series.map((s) => ({
//     ...s,
//     data: keepIdx.map((i) => s.data?.[i]),
//   }));

//   return {
//     ...chart,
//     series: newSeries,
//     options: {
//       ...options,
//       xaxis: {
//         ...xaxis,
//         categories: newCategories,
//       },
//     },
//   };
// }

const toDateSafe = (v: any) => {
  if (v == null) return null;

  // number (epoch ms) หรือ string เป็นตัวเลข
  if (typeof v === "number" || (/^\d+$/.test(String(v)))) {
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    const d = new Date(n);
    return isNaN(d.getTime()) ? null : d;
  }

  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

  let s = String(v).trim();

  // 👇 รองรับ "YYYY-MM-DD HH:mm:ss(.ffffff)"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    s = s.replace(" ", "T");
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    s = `${s}T00:00:00Z`;
  } else {
    s = s.replace(/\.(\d{3})\d+(Z|[+\-]\d{2}:\d{2})?$/, (_, ms, tz) => `.${ms}${tz ?? "Z"}`);
    if (!/(Z|[+\-]\d{2}:\d{2})$/.test(s)) s += "Z";
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

function filterApexChartByDate(chart: any, start?: string, end?: string) {
  if (!chart) return chart;

  // ✅ ใช้ toDateSafe ที่เพิ่งแก้
  const startD = start ? toDateSafe(`${start}T00:00:00Z`) : null;
  const endD = end ? toDateSafe(`${end}T00:00:00Z`) : null;
  if (!startD && !endD) return chart;

  const endInc = endD ? new Date(endD.getTime() + 24 * 60 * 60 * 1000) : null;

  const options = chart.options ?? {};
  const xaxis = options.xaxis ?? {};
  const series: any[] | undefined = chart.series;

  if (!Array.isArray(series)) return chart;

  // ---- Mode A: categories + series[i].data เป็น array ตำแหน่งตรงกัน ----
  const categories: any[] | undefined = xaxis.categories;
  const looksLikeXY = (arr: any[]) =>
    arr.some((pt) => (pt && typeof pt === "object" && !Array.isArray(pt)) || Array.isArray(pt));

  const isCategoriesMode =
    Array.isArray(categories) &&
    categories.length > 0 &&
    series.every((s) => Array.isArray(s?.data) && !looksLikeXY(s.data));

  if (isCategoriesMode) {
    // ✅ normalize categories ก่อน
    const catDates = categories.map(toDateSafe);
    const keepIdx: number[] = [];
    catDates.forEach((d, i) => {
      if (!d) return;
      if (startD && d < startD) return;
      if (endInc && d >= endInc) return;
      keepIdx.push(i);
    });

    if (keepIdx.length === 0) {
      return {
        ...chart,
        options: {
          ...options,
          xaxis: { ...xaxis, type: "datetime" },
          noData: { text: "No data in selected range" },
        },
      };
    }

    const newCategories = keepIdx.map((i) => categories[i]);
    const newSeries = series.map((s) => ({
      ...s,
      data: keepIdx.map((i) => s.data?.[i]).filter((v: any) => v != null),
    }));

    const hasAnyPoint = newSeries.some((s) => Array.isArray(s.data) && s.data.length > 0);
    if (!hasAnyPoint) {
      return {
        ...chart,
        options: {
          ...options,
          xaxis: { ...xaxis, type: "datetime" },
          noData: { text: "No data in selected range" },
        },
      };
    }

    return {
      ...chart,
      series: newSeries,
      options: {
        ...options,
        xaxis: { ...xaxis, type: "datetime", categories: newCategories },
        noData: { text: "No data in selected range" },
      },
    };
  }

  // ---- Mode B: series[i].data เป็น [{x,y}] หรือ [[x,y]] ----
  const newSeriesB = series.map((s) => {
    const arr = Array.isArray(s.data) ? s.data : [];
    const filtered = arr.filter((pt: any) => {
      const xVal = (pt && typeof pt === "object" && !Array.isArray(pt)) ? pt.x
        : (Array.isArray(pt) ? pt[0] : null);
      const d = toDateSafe(xVal);
      if (!d) return false;
      if (startD && d < startD) return false;
      if (endInc && d >= endInc) return false;
      return true;
    });
    return { ...s, data: filtered };
  });

  const hasAnyPointB = newSeriesB.some((s) => Array.isArray(s.data) && s.data.length > 0);
  if (!hasAnyPointB) {
    return {
      ...chart,
      options: {
        ...options,
        xaxis: { ...xaxis, type: "datetime" },
        noData: { text: "No data in selected range" },
      },
    };
  }

  return {
    ...chart,
    series: newSeriesB,
    options: {
      ...options,
      xaxis: { ...xaxis, type: "datetime" },
      noData: { text: "No data in selected range" },
    },
  };
}

export default function StatisticChart({ startDate, endDate, charts }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedChart, setSelectedChart] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const toggleFullscreen = (chart: any, item: any) => {
    setSelectedChart(chart);
    setSelectedItem(item);
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    setSelectedChart(null);
    setSelectedItem(null);
  };


  return (
    <div className="tw-grid tw-grid-cols-1 tw-gap-6 md:tw-grid-cols-1 xl:tw-grid-cols-1">
      {charts.map((item) => {
        const filteredChart = filterApexChartByDate(
          item.chart,
          startDate,
          endDate
        );
        console.log(
          "sample x:", filteredChart?.series?.[0]?.data?.[0],
          "parsed:", toDateSafe(filteredChart?.series?.[0]?.data?.[0]?.x ?? filteredChart?.options?.xaxis?.categories?.[0])
        );

        const hasPoints =
          Array.isArray(filteredChart?.series) &&
          filteredChart.series.some(
            (s: any) => Array.isArray(s?.data) && s.data.length > 0
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
                    className="tw-text-sm tw-text-blue-gray-700 tw-tabular-nums tw-break-words tw-leading-snug"
                    title={m.value}
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
          <div key={item.title} className="tw-relative">

            <StatisticsChartCard
              {...item}
              description={descriptionNode}
              chart={{
                ...filteredChart,
                options: {
                  ...(filteredChart?.options ?? {}),
                  xaxis: {
                    ...((filteredChart?.options ?? {}).xaxis ?? {}),
                    type: "datetime",
                    // 👇 ลบทิ้งถ้ามี เพื่อบังคับ XY mode
                    ...(filteredChart?.series?.length &&
                      Array.isArray(filteredChart.series[0]?.data) &&
                      filteredChart.series[0].data.some((pt: any) => typeof pt === "object" || Array.isArray(pt))
                      ? { categories: undefined }
                      : {}
                    ),
                  },
                  noData: { text: hasPoints ? "Loading..." : "No data in selected range" },
                },
              }}
              color="white"
              footer={null}
            />

            {/* ปุ่มขยายตรงมุมล่างขวา */}
            <button
              onClick={() => toggleFullscreen(filteredChart, item)}
              className="tw-absolute tw-bottom-2 tw-right-2 tw-bg-white tw-p-2 tw-rounded-full tw-shadow hover:tw-bg-gray-100"
            >
              <Maximize2 className="tw-w-4 tw-h-4" />
            </button>

          </div>
        );
      })}

      {/* Modal แสดงกราฟแบบขยาย */}
      {isFullscreen && (
        <div className="tw-fixed tw-inset-0 tw-bg-black/50 tw-flex tw-items-center tw-justify-center tw-z-50">
          <div className="tw-bg-white tw-rounded-lg tw-w-11/12 tw-h-[85vh] tw-relative tw-flex tw-flex-col tw-p-6">

            {/* ปุ่มปิด */}
            <button
              onClick={closeFullscreen}
              className="tw-absolute tw-top-4 tw-right-4 tw-z-50 tw-rounded-full tw-p-2 hover:tw-bg-gray-300"
            >
              <X className="tw-w-5 tw-h-5 tw-m" />
            </button>

            {/* กราฟขยาย */}
            <div className="tw-flex-1 tw-overflow-auto tw-mt-6">
              {selectedChart && selectedItem && (
                <StatisticsChartCard
                  {...selectedItem}
                  chart={{
                    ...selectedChart,
                    height: 600,
                    options: {
                      ...(selectedChart?.options ?? {}),
                      xaxis: {
                        ...((selectedChart?.options ?? {}).xaxis ?? {}),
                        type: "datetime",
                        ...(selectedChart?.series?.length &&
                          Array.isArray(selectedChart.series[0]?.data) &&
                          selectedChart.series[0].data.some((pt: any) => typeof pt === "object" || Array.isArray(pt))
                          ? { categories: undefined }   // ← ใส่บรรทัดนี้เหมือนตัวหลัก
                          : {}
                        ),             // ✅ เหมือนกัน: บังคับ datetime
                      },
                      noData: {
                        text:
                          Array.isArray(selectedChart?.series) &&
                            selectedChart.series.some(
                              (s: any) => Array.isArray(s?.data) && s.data.length > 0
                            )
                            ? "Loading..."
                            : "No data in selected range",
                      },
                    },
                  }}
                  color={"white"}
                  footer={null}
                  description={
                    Array.isArray((selectedItem as any).metrics) ? (
                      <dl className="tw-mt-4 tw-grid tw-grid-cols-3 tw-gap-y-2 md:tw-gap-x-6">
                        {(selectedItem as any).metrics.map(
                          (m: { label: string; value: string }) => (
                            <div key={m.label} className="tw-min-w-0">
                              <dt className="tw-text-sm tw-font-medium tw-text-blue-gray-600">
                                {m.label}
                              </dt>
                              <dd
                                className="tw-text-sm tw-text-blue-gray-700 tw-tabular-nums tw-break-words tw-leading-snug"
                                title={m.value}
                              >
                                {m.value}
                              </dd>
                            </div>
                          )
                        )}
                      </dl>
                    ) : (
                      selectedItem.description
                    )
                  }
                />
              )}
            </div>
          </div>
        </div>
      )}



    </div>
  );
}
