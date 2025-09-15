// "use client";

// import dynamic from "next/dynamic";
// import React, { useState } from "react";
// import { data_MDB } from "@/data";

// const StatisticsChartCard = dynamic(
//   () => import("../../../../widgets/charts/statistics-chart"),
//   { ssr: false }
// );

// type Props = {
//   startDate?: string;
//   endDate?: string;
// };

// // ---------- helpers ----------
// const toDate = (v: any) => {
//   if (v == null) return null;
//   const d = new Date(v);
//   return isNaN(d.getTime()) ? null : d;
// };

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

// export default function StatisticChart({ startDate, endDate }: Props) {
//   const [isFullscreen, setIsFullscreen] = useState(false);  // สถานะการแสดงกราฟในโหมดเต็มหน้าจอ
//   const [selectedChart, setSelectedChart] = useState<any>(null);  // เก็บข้อมูลกราฟที่เลือก
//   const toggleFullscreen = (chart: any) => {
//     setSelectedChart(chart);  // เก็บกราฟที่เลือก
//     setIsFullscreen(true);  // เปิดโหมดเต็มหน้าจอ
//   };

//   const closeFullscreen = () => {
//     setIsFullscreen(false);  // ปิดโหมดเต็มหน้าจอ
//     setSelectedChart(null);  // ล้างข้อมูลกราฟ
//   };

//   return (
//     <div className="tw-grid tw-grid-cols-1 tw-gap-6 md:tw-grid-cols-1 xl:tw-grid-cols-1">
//       {data_MDB.map((item) => {
//         const filteredChart = filterApexChartByDate(
//           item.chart,
//           startDate,
//           endDate
//         );

//         const descriptionNode = Array.isArray((item as any).metrics) ? (
//           <dl className="tw-mt-1 tw-grid tw-grid-cols-3 tw-gap-y-2 md:tw-grid-cols-3 md:tw-gap-x-6">
//             {(item as any).metrics.map(
//               (m: { label: string; value: string }) => (
//                 <div key={m.label} className="tw-min-w-0">
//                   <dt className="tw-text-sm tw-font-medium tw-text-blue-gray-600">
//                     {m.label}
//                   </dt>
//                   <dd
//                     className="tw-text-sm tw-text-blue-gray-700 tw-tabular-nums tw-break-words tw-leading-snug"
//                     title={m.value} // เผื่อ hover ดูค่าเต็ม
//                   >
//                     {m.value}
//                   </dd>
//                 </div>
//               )
//             )}
//           </dl>
//         ) : (
//           item.description
//         );


//         // ตรวจสอบค่าของ color หากไม่มีให้ใช้ค่าสีเริ่มต้น
//         const cardColor = item.color ? item.color : "#4A90E2"; // กำหนดสีเริ่มต้นที่ต้องการ

//         return (
//           <div
//             key={item.title}
//             className="tw-relative"
//           >
//             <StatisticsChartCard
//               {...item}
//               description={descriptionNode}
//               chart={filteredChart}
//               color={"white"} 
//               footer={null}
//             />
//           </div>
//         );
//       })}
//     </div>
//   );
// }


"use client";

import dynamic from "next/dynamic";
import React, { useState } from "react";
import { Maximize2, X } from "lucide-react";
import { statisticsChartsData, data_MDB } from "@/data";
import type {MDBType} from "@/app/dashboard/mdb/components/mdb-info";
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
              chart={filteredChart}
              color={"white"}
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
                    height: "330%", // บังคับให้ ApexChart ยืดเต็ม
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
