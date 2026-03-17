"use client";

import dynamic from "next/dynamic";
import React, { useState } from "react";
import { Maximize2, X } from "lucide-react";

const StatisticsChartCard = dynamic(
  () => import("../../../../widgets/charts/statistics-chart"),
  { ssr: false }
);

type Metric = { label: string; value: string | number };
type ChartCard = {
  color: string;
  title: string;
  description?: string;
  chart: any;
  metrics: Metric[];
};

type Props = {
  startDate?: string;
  endDate?: string;
  charts: ChartCard[];
};

// ✅ FIXED: ใช้ UTC แทน +07:00
const toDateSafe = (v: any): Date | null => {
  if (v == null) return null;

  // Handle epoch milliseconds
  // if (typeof v === "number" || /^\d+$/.test(String(v))) {
  //   const n = typeof v === "number" ? v : parseInt(String(v), 10);
  //   const d = new Date(n);
  //   return isNaN(d.getTime()) ? null : d;
  // }
  if (typeof v === "number" || /^\d+$/.test(String(v))) {
    let n = typeof v === "number" ? v : parseInt(String(v), 10);
    if (n < 1_000_000_000_000) n *= 1000; // แปลงวินาที -> มิลลิวินาที
    const d = new Date(n);
    return isNaN(d.getTime()) ? null : d;
  }

  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;

  let s = String(v).trim();

  // "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    s = s.replace(" ", "T");
  }

  // ✅ CRITICAL: ใช้ UTC (Z) แทน +07:00
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    s = `${s}T00:00:00Z`;
  } else {
    // Normalize microseconds to 3 digits
    s = s.replace(/\.(\d{3})\d+(Z|[+\-]\d{2}:\d{2})?$/, (_, ms, tz) => `.${ms}${tz ?? "Z"}`);
    // Add Z if no timezone
    if (!/(Z|[+\-]\d{2}:\d{2})$/.test(s)) s += "Z";
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const isToday = (d: string) => {
  const now = new Date();
  const dd = new Date(`${d}T00:00:00+07:00`);
  return now.getFullYear() === dd.getFullYear() &&
    now.getMonth() === dd.getMonth() &&
    now.getDate() === dd.getDate();
};

// ✅ FIXED: ลดความซับซ้อนและใช้ UTC
function filterApexChartByDate(chart: any, start?: string, end?: string) {
  if (!chart) return chart;

  // ✅ ใช้ UTC เหมือน backend
  // const startD = start ? toDateSafe(`${start}T00:00:00Z`) : null;
  // const endD = end ? toDateSafe(`${end}T23:59:59.999Z`) : null;
  const startD = start ? toDateSafe(`${start}T00:00:00+07:00`) : null;
  let endD = end ? toDateSafe(`${end}T23:59:59.999+07:00`) : null;

  // 👇 ถ้า end เป็น “วันนี้” ให้ใช้เวลาปัจจุบันแทน
  if (end && isToday(end)) endD = new Date();

  if (!startD && !endD) return chart;

  // console.log("78",chart)
  const options = chart.options ?? {};
  // console.log("80",options)
  // const xaxis = options.xaxis ?? {};
  const xaxis = {
    ...(options.xaxis ?? {}),
    categories: Array.isArray(options.xaxis?.categories) ? options.xaxis!.categories : [],
  };
  const series: any[] = Array.isArray(chart.series) ? chart.series : [];
  // console.log("83",series)
  // console.log("84",chart.series)
  if (series.length === 0) {
    return {
      ...chart,
      options: {
        ...options,
        xaxis: { ...xaxis, type: "datetime" },
        noData: { text: "No data available" },
      },
    };
  }

  // ตรวจสอบว่าเป็น XY mode หรือ categories mode
  const firstSeries = series[0];
  // console.log("97",firstSeries)
  const firstData = Array.isArray(firstSeries?.data) ? firstSeries.data : [];
  // console.log("98",firstData)
  const isXYMode =
    firstData.length > 0 &&
    firstData.some((pt: any) =>
      (pt && typeof pt === "object" && "x" in pt) ||
      Array.isArray(pt)
    );
  // console.log("104",isXYMode)
  // ---- XY Mode: [{x, y}] or [[x, y]] ----
  if (isXYMode) {
    const newSeries = series.map((s) => {
      const data = Array.isArray(s.data) ? s.data : [];
      const filtered = data.filter((pt: any) => {
        const xVal = (pt && typeof pt === "object") ? pt.x : (Array.isArray(pt) ? pt[0] : null);
        const d = toDateSafe(xVal);
        if (!d) return false;
        if (startD && d < startD) return false;
        if (endD && d > endD) return false;
        return true;
      });
      return { ...s, data: filtered };
    });

    const hasData = newSeries.some((s) => s.data.length > 0);
    // === STEP 3: SHIFT +7h (เฉพาะถ้าขั้นที่ 2 แล้วยังไม่ +7) ===
    const toTHms = (x: any) => {
      const d = toDateSafe(x);
      return d ? d.getTime() + 7 * 60 * 60 * 1000 : x;
    };
    return {
      ...chart,
      series: newSeries,
      options: {
        ...options,
        xaxis: {
          ...xaxis,
          type: "datetime",
          labels: {
            ...(xaxis.labels ?? {}),
            datetimeUTC: false,
            formatter: (val: number) =>
              new Date(val).toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok",
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
              }),
          },
          categories: [],
        },
        noData: { text: hasData ? "Loading..." : "No data in selected range" },
        tooltip: {
          x: {
            formatter: (val: number) =>
              new Date(val).toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok",
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
              }),
          },
        },
      },
    };
  }

  // ---- Categories Mode ----
  const categories: any[] = Array.isArray(xaxis.categories) ? xaxis.categories : [];
  // console.log("137",categories)
  if (categories.length === 0) {
    return {
      ...chart,
      options: {
        ...options,
        xaxis: { ...xaxis, type: "datetime" },
        noData: { text: "No data available" },
      },
    };
  }

  const catDates = categories.map(toDateSafe);
  const keepIdx: number[] = [];

  catDates.forEach((d, i) => {
    if (!d) return;
    if (startD && d < startD) return;
    if (endD && d > endD) return;
    keepIdx.push(i);
  });

  if (keepIdx.length === 0) {
    return {
      ...chart,
      series: series.map(s => ({ ...s, data: [] })),
      options: {
        ...options,
        xaxis: { ...xaxis, type: "datetime", categories: [] },
        noData: { text: "No data in selected range" },
      },
    };
  }

  const newCategories = keepIdx.map((i) => categories[i]);
  const newSeries = series.map((s) => ({
    ...s,
    data: keepIdx.map((i) => s.data?.[i]).filter((v: any) => v != null),
  }));

  return {
    ...chart,
    series: newSeries,
    options: {
      ...options,
      xaxis: {
        ...xaxis,
        type: "datetime",
        categories: newCategories,
        labels: {
          ...(xaxis.labels ?? {}),
          datetimeUTC: false,
          formatter: (val: number) =>
            new Date(val).toLocaleString("th-TH", {
              timeZone: "Asia/Bangkok",
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
            }),
        }
      },
      noData: { text: "Loading..." },
      tooltip: {
        x: {
          formatter: (val: number) =>
            new Date(val).toLocaleString("th-TH", {
              timeZone: "Asia/Bangkok",
              year: "numeric",
              month: "short",
              day: "2-digit",
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
            }),
        }
      }
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
        const filteredChart = filterApexChartByDate(item.chart, startDate, endDate);
        // console.log("214",item.chart)


        // ✅ Debug logging (ใน development เท่านั้น)
        if (process.env.NODE_ENV === 'development') {
          const firstPoint = filteredChart?.series?.[0]?.data?.[0];
          const xValue = firstPoint?.x ?? filteredChart?.options?.xaxis?.categories?.[0];
          // console.log(`[${item.title}]`, {
          //   seriesCount: filteredChart?.series?.length,
          //   firstPoint,
          //   parsedDate: xValue ? toDateSafe(xValue)?.toISOString() : null,
          // });
        }

        const hasPoints =
          Array.isArray(filteredChart?.series) &&
          filteredChart.series.some(
            (s: any) => Array.isArray(s?.data) && s.data.length > 0
          );

        const descriptionNode = Array.isArray(item.metrics) ? (
          <dl className="tw-mt-1 tw-grid tw-grid-cols-3 tw-gap-y-2 md:tw-grid-cols-3 md:tw-gap-x-6">
            {item.metrics.map((m: { label: string; value: string | number }) => (
              <div key={m.label} className="tw-min-w-0">
                <dt className="tw-text-sm tw-font-medium tw-text-blue-gray-600">
                  {m.label}
                </dt>
                <dd
                  className="tw-text-sm tw-text-blue-gray-700 tw-tabular-nums tw-break-words tw-leading-snug"
                  title={String(m.value)}
                >
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          item.description
        );

        console.log("[UI] chart safe check", {
          seriesIsArray: Array.isArray(filteredChart?.series),
          data0IsArray: Array.isArray(filteredChart?.series?.[0]?.data),
          catsIsArray: Array.isArray(filteredChart?.options?.xaxis?.categories),
        });

        return (
          <div key={item.title} className="tw-relative">
            <StatisticsChartCard
              {...item}
              description={descriptionNode}
              chart={filteredChart}
              color="white"
              footer={null}
            />

            <button
              onClick={() => toggleFullscreen(filteredChart, item)}
              className="tw-absolute tw-bottom-2 tw-right-2 tw-bg-white tw-p-2 tw-rounded-full tw-shadow hover:tw-bg-gray-100 tw-transition-colors"
              aria-label={`Expand ${item.title}`}
            >
              <Maximize2 className="tw-w-4 tw-h-4" />
            </button>
          </div>


        );


      })}



      {/* Fullscreen Modal */}
      {isFullscreen && selectedChart && selectedItem && (
        <div
          className="tw-fixed tw-inset-0 tw-bg-black/50 tw-flex tw-items-center tw-justify-center tw-z-50"
          onClick={closeFullscreen}
        >
          <div
            className="tw-bg-white tw-rounded-lg tw-w-11/12 tw-h-[85vh] tw-relative tw-flex tw-flex-col tw-p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeFullscreen}
              className="tw-absolute tw-top-4 tw-right-4 tw-z-50 tw-rounded-full tw-p-2 hover:tw-bg-gray-200 tw-transition-colors"
              aria-label="Close fullscreen"
            >
              <X className="tw-w-5 tw-h-5" />
            </button>

            <div className="tw-flex-1 tw-overflow-auto tw-mt-6">
              <StatisticsChartCard
                {...selectedItem}
                chart={{
                  ...selectedChart,
                  height: 600,
                }}
                color="white"
                footer={null}
                description={
                  Array.isArray(selectedItem.metrics) ? (
                    <dl className="tw-mt-4 tw-grid tw-grid-cols-3 tw-gap-y-2 md:tw-gap-x-6">
                      {selectedItem.metrics.map(
                        (m: { label: string; value: string | number }) => (
                          <div key={m.label} className="tw-min-w-0">
                            <dt className="tw-text-sm tw-font-medium tw-text-blue-gray-600">
                              {m.label}
                            </dt>
                            <dd
                              className="tw-text-sm tw-text-blue-gray-700 tw-tabular-nums tw-break-words tw-leading-snug"
                              title={String(m.value)}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}