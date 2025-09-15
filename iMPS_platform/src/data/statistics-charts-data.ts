import { chartsConfig } from "@/configs";
import type {MDBType} from "@/app/dashboard/mdb/components/mdb-info";

export type HistoryRow = {
  ts: string; // ISO timestamp (มาจาก Datetime ของ SSE)
  VL1N?: number; VL2N?: number; VL3N?: number;
  I1?: number; I2?: number; I3?: number;
  PL1N?: number; PL2N?: number; PL3N?: number;
  EL1?: number; EL2?: number; EL3?: number;
  [k: string]: any;
};
type Point = { x: string; y: number | null };
const toNumOrNull = (v: any) =>
  (typeof v === "number" && Number.isFinite(v)) ? v : null;
// const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0); 
// const toXY = (rows: HistoryRow[], key: keyof HistoryRow) =>
//   rows.filter(r => r.ts).map(r => ({ x: r.ts, y: num(r[key]) }));
// เรียงเวลา + map เป็นจุด
const toXY = (rows: HistoryRow[], key: keyof HistoryRow): Point[] =>
  [...rows]
    .filter(r => r.ts)
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map(r => ({ x: r.ts, y: toNumOrNull(r[key]) }));

// const ensureMinPoints = (series: any[], padSec = 60) =>
//   series.map((s) => {
//     const arr = Array.isArray(s.data) ? [...s.data] : [];
//     if (arr.length >= 2) return { ...s, data: arr };
//     if (arr.length === 1) {
//       const p0 = arr[0];
//       const t0 = new Date(p0.x).getTime();
//       const pPrev = { x: new Date(t0 - padSec * 1000).toISOString(), y: p0.y };
//       return { ...s, data: [pPrev, p0] };
//     }
//     return { ...s, data: arr }; // ว่างก็ปล่อยว่าง
//   });
const ensureMinPoints = (series: any[], padSec = 60) =>
  series.map((s) => {
    const arr: Point[] = Array.isArray(s.data) ? [...s.data] : [];
    if (arr.length >= 2) return { ...s, data: arr };
    if (arr.length === 1) {
      const p0 = arr[0];
      const t0 = new Date(p0.x).getTime();
      const pPrev: Point = { x: new Date(t0 - padSec * 1000).toISOString(), y: p0.y };
      return { ...s, data: [pPrev, p0] };
    }
    return { ...s, data: arr };
  });

// const baseOptions = {
//   ...chartsConfig,
//   chart: { type: "line", group: "power", zoom: { enabled: true }, toolbar: { show: true } },
//   stroke: { lineCap: "round" as const, width: 3, curve: "smooth" as const },
//   markers: { size: 3 },
//   xaxis: { type: "datetime" as const, labels: { format: "HH:mm" } },
//   legend: { show: true, position: "top" as const, horizontalAlign: "left" as const },
// };

// const baseOptions = {
//   ...chartsConfig,
//   chart: { type: "line", group: "power", zoom: { enabled: true }, toolbar: { show: true } },
//   xaxis: {
//     type: "datetime",
//     labels: {
//       datetimeUTC: false,          // ✅ สำคัญ: ให้ใช้เวลาท้องถิ่น
//       format: "HH:mm",
//     },
//   },
//   tooltip: {
//     x: {
//       // ✅ บังคับแสดงแบบเวลาท้องถิ่น (ไทย)
//       formatter: (val: number) =>
//         new Date(val).toLocaleString("th-TH", {
//           timeZone: "Asia/Bangkok",
//           hour12: false,
//           year: "numeric", month: "2-digit", day: "2-digit",
//           hour: "2-digit", minute: "2-digit"
//         }),
//     },
//   },
//   stroke: { lineCap: "round", width: 3, curve: "smooth" },
//   markers: { size: 3 },
//   legend: { show: true, position: "top", horizontalAlign: "left" },
// };

// const baseOptions = {
//   ...chartsConfig,
//   chart: { type: "line", group: "power", zoom: { enabled: true }, toolbar: { show: true } },
//   xaxis: {
//     type: "datetime",
//     labels: {
//       datetimeUTC: false,            // ใช้เวลาเครื่อง (Asia/Bangkok)
//       format: "HH:mm",
//     },
//   },
//   tooltip: {
//     x: {
//       // ให้แสดงเป็นเวลาไทยเสมอ
//       formatter: (val: number) =>
//         new Date(val).toLocaleString("th-TH", {
//           timeZone: "Asia/Bangkok",
//           hour12: false,
//           year: "numeric", month: "2-digit", day: "2-digit",
//           hour: "2-digit", minute: "2-digit",
//         }),
//     },
//   },
//   stroke: { lineCap: "round", width: 3, curve: "smooth" },
//   markers: { size: 0 },
//   legend: { show: true, position: "top", horizontalAlign: "left" },
//   noData: { text: "No history data" }, // ✅ เพิ่ม
// };

// const baseOptions = {
//   ...chartsConfig,
//   chart: { type: "line", group: "power", zoom: { enabled: true }, toolbar: { show: true } },
//   xaxis: {
//     type: "datetime",
//     labels: {
//       datetimeUTC: false, // ใช้เวลาเครื่อง (Asia/Bangkok)
//       format: "HH:mm",    // รูปแบบแสดงเวลาเป็น "ชั่วโมง:นาที"
//     },
//     tickAmount: 6, // ตั้งค่าให้มี 6 ticks ในช่วง 24 ชั่วโมง (4 ชั่วโมงระหว่าง ticks)
//     min: new Date().setHours(0, 0, 0, 0),  // กำหนดให้เริ่มจากเที่ยงคืน
//     max: new Date().setHours(23, 59, 59, 999), // กำหนดให้สิ้นสุดที่เวลา 23:59
//   },
//   tooltip: {
//     x: {
//       formatter: (val: number) =>
//         new Date(val).toLocaleString("th-TH", {
//           timeZone: "Asia/Bangkok",
//           hour12: false,
//           year: "numeric", month: "2-digit", day: "2-digit",
//           hour: "2-digit", minute: "2-digit",
//         }),
//     },
//   },
//   stroke: { lineCap: "round", width: 3, curve: "smooth" },
//   markers: { size: 0 },
//   legend: { show: true, position: "top", horizontalAlign: "left" },
//   noData: { text: "No history data" },
// };
const baseOptions = { 
  ...chartsConfig,
  chart: { type: "line", group: "power", zoom: { enabled: true }, toolbar: { show: true } },
  xaxis: {
    type: "datetime",
    labels: {
      datetimeUTC: false, // ใช้เวลาเครื่อง (Asia/Bangkok)
      format: "HH:mm",    // รูปแบบแสดงเวลาเป็น "ชั่วโมง:นาที"
    },
    tickAmount: 6, // ตั้งค่าให้มี 6 ticks ในช่วง 24 ชั่วโมง (4 ชั่วโมงระหว่าง ticks)
    min: new Date().setHours(0, 0, 0, 0),  // กำหนดให้เริ่มจากเที่ยงคืน
    max: new Date().setHours(23, 59, 59, 999), // กำหนดให้สิ้นสุดที่เวลา 23:59
  },
  tooltip: {
    x: {
      formatter: (val: number) => {
        // ตรวจสอบว่า val เป็น number หรือไม่ และทำการแปลงเป็น Date หากจำเป็น
        if (typeof val === "number") {
          // ทำการลบเวลา 7 ชั่วโมงจาก val เพื่อย้อนกลับเวลา
          const date = new Date(val - 7 * 60 * 60 * 1000); // ลบ 7 ชั่วโมง (7 * 60 * 60 * 1000 ms)

          return date.toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok", // แสดงเวลาในประเทศไทย
            hour12: false,
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
          });
        }
        return ""; // ถ้า val ไม่ใช่ number ก็จะคืนค่าเป็นสตริงว่าง
      },
    },
  },
  stroke: { lineCap: "round", width: 3, curve: "smooth" },
  markers: { size: 0 },
  legend: { show: true, position: "top", horizontalAlign: "left" },
  noData: { text: "No history data" },
};


// export function buildChartsFromHistory(MDB: MDBType, history: HistoryRow[]) {
//   const voltageSeries = ensureMinPoints([
//     { name: "L1", data: toXY(history, "VL1N") },
//     { name: "L2", data: toXY(history, "VL2N") },
//     { name: "L3", data: toXY(history, "VL3N") },
//   ]);
//   const currentSeries = ensureMinPoints([
//     { name: "I1", data: toXY(history, "I1") },
//     { name: "I2", data: toXY(history, "I2") },
//     { name: "I3", data: toXY(history, "I3") },
//   ]);
//   const powerSeries = ensureMinPoints([
//     { name: "W1", data: toXY(history, "PL1N") },
//     { name: "W2", data: toXY(history, "PL2N") },
//     { name: "W3", data: toXY(history, "PL3N") },
//   ]);

//   const voltageChart = {
//     type: "line",
//     height: 220,
//     series: voltageSeries,
//     options: {
//       ...baseOptions,
//       yaxis: { labels: { formatter: (v: number) => `${v} V` } },
//       tooltip: { x: { format: "yyyy-MM-dd HH:mm" }, y: { formatter: (v: number) => `${v} V` } },
//     },
//   };

//   const currentChart = {
//     type: "line",
//     height: 220,
//     series: currentSeries,
//     options: {
//       ...baseOptions,
//       yaxis: { labels: { formatter: (v: number) => `${Math.round(v)} A` } },
//       tooltip: { shared: true, intersect: false, x: { format: "yyyy-MM-dd HH:mm" }, y: { formatter: (v: number) => `${v} A` } },
//     },
//   };

//   const powerChart = {
//     type: "line",
//     height: 220,
//     series: powerSeries,
//     options: {
//       ...baseOptions,
//       yaxis: { labels: { formatter: (v: number) => `${Math.round(v)} W` } },
//       tooltip: { shared: true, intersect: false, x: { format: "yyyy-MM-dd HH:mm" }, y: { formatter: (v: number) => `${v} W` } },
//     },
//   };

//   return [
//     { color: "white", title: "Voltage Line to Neutral (V)", description: "Real-time from SSE", chart: voltageChart,
//       metrics: [{ label: "L1", value: `${MDB.VL1N} V` }, { label: "L2", value: `${MDB.VL2N} V` }, { label: "L3", value: `${MDB.VL3N} V` }] },
//     { color: "white", title: "Current (A)", description: "Real-time from SSE", chart: currentChart,
//       metrics: [{ label: "I1", value: `${MDB.I1} A` }, { label: "I2", value: `${MDB.I2} A` }, { label: "I3", value: `${MDB.I3} A` }] },
//     { color: "white", title: "Power (W)", description: "Real-time from SSE", chart: powerChart,
//       metrics: [{ label: "W1", value: `${MDB.PL1N} W` }, { label: "W2", value: `${MDB.PL2N} W` }, { label: "W3", value: `${MDB.PL3N} W` }] },
//   ];
// }

// export const statisticsChartsData = (MDB: MDBType, history: HistoryRow[] = []) =>
//   buildChartsFromHistory(MDB, history);
// export const data_MDB = (MDB: MDBType, history: HistoryRow[] = []) =>
//   statisticsChartsData(MDB, history);
// export default { statisticsChartsData, data_MDB, buildChartsFromHistory };


export function buildChartsFromHistory(MDB: MDBType, history: HistoryRow[]) {
  const voltageSeries = ensureMinPoints([
    { name: "L1", data: toXY(history, "VL1N") },
    { name: "L2", data: toXY(history, "VL2N") },
    { name: "L3", data: toXY(history, "VL3N") },
  ]);
  const currentSeries = ensureMinPoints([
    { name: "I1", data: toXY(history, "I1") },
    { name: "I2", data: toXY(history, "I2") },
    { name: "I3", data: toXY(history, "I3") },
  ]);
  const powerSeries = ensureMinPoints([
    { name: "W1", data: toXY(history, "PL1N") },
    { name: "W2", data: toXY(history, "PL2N") },
    { name: "W3", data: toXY(history, "PL3N") },
  ]);

  const voltageChart = {
    type: "line",
    height: 220,
    series: voltageSeries,
    options: {
      ...baseOptions,
      yaxis: { labels: { formatter: (v: number) => `${v} V` } },
      // ❗ ไม่ใส่ tooltip.x.format ที่นี่ เพื่อไม่ทับ formatter ใน baseOptions
      tooltip: { y: { formatter: (v: number) => `${v} V` } },
    },
  };

  const currentChart = {
    type: "line",
    height: 220,
    series: currentSeries,
    options: {
      ...baseOptions,
      yaxis: { labels: { formatter: (v: number) => `${Math.round(v)} A` } },
      tooltip: { shared: true, intersect: false, y: { formatter: (v: number) => `${v} A` } },
    },
  };

  const powerChart = {
    type: "line",
    height: 220,
    series: powerSeries,
    options: {
      ...baseOptions,
      yaxis: { labels: { formatter: (v: number) => `${Math.round(v)} W` } },
      tooltip: { shared: true, intersect: false, y: { formatter: (v: number) => `${v} W` } },
    },
  };

  return [
    { color: "white", title: "Voltage Line to Neutral (V)", description: "History/SSE",
      chart: voltageChart,
      metrics: [{ label: "L1", value: `${MDB.VL1N} V` }, { label: "L2", value: `${MDB.VL2N} V` }, { label: "L3", value: `${MDB.VL3N} V` }] },
    { color: "white", title: "Current (A)", description: "History/SSE",
      chart: currentChart,
      metrics: [{ label: "I1", value: `${MDB.I1} A` }, { label: "I2", value: `${MDB.I2} A` }, { label: "I3", value: `${MDB.I3} A` }] },
    { color: "white", title: "Power (W)", description: "History/SSE",
      chart: powerChart,
      metrics: [{ label: "W1", value: `${MDB.PL1N} W` }, { label: "W2", value: `${MDB.PL2N} W` }, { label: "W3", value: `${MDB.PL3N} W` }] },
  ];
}

export const statisticsChartsData = (MDB: MDBType, history: HistoryRow[] = []) =>
  buildChartsFromHistory(MDB, history);
export const data_MDB = (MDB: MDBType, history: HistoryRow[] = []) =>
  statisticsChartsData(MDB, history);
export default { statisticsChartsData, data_MDB, buildChartsFromHistory };

/* ============ 1) Voltage (V) ============ */

// const websiteViewsChart = {
//   type: "line",
//   height: 220,
//   series: [
//     {
//       name: "L1",
//       data: [
//         { x: "2025-09-09T09:26:00", y: 232.11 },
//         { x: "2025-09-09T09:56:00", y: 231.8 },
//         { x: "2025-09-09T10:26:00", y: 232.5 },
//         { x: "2025-09-09T11:25:00", y: 232.11 },
//       ],
//     },
//     {
//       name: "L2",
//       data: [
//         { x: "2025-09-09T09:26:00", y: 231.91 },
//         { x: "2025-09-09T09:56:00", y: 232.1 },
//         { x: "2025-09-09T10:26:00", y: 233.0 },
//         { x: "2025-09-09T11:25:00", y: 231.91 },
//       ],
//     },
//     {
//       name: "L3",
//       data: [
//         { x: "2025-09-09T09:26:00", y: 233.44 },
//         { x: "2025-09-09T09:56:00", y: 233.0 },
//         { x: "2025-09-09T10:26:00", y: 234.0 },
//         { x: "2025-09-09T11:25:00", y: 233.44 },
//       ],
//     },
//   ],
//   options: {
//     ...chartsConfig,
//     chart: { type: "line", group: "power", zoom: { enabled: true }, toolbar: { show: true } },
//     colors: ["#0288d1", "#43A047", "#FB8C00"],
//     stroke: { lineCap: "round", width: 2, curve: "smooth" },
//     markers: { size: 0 },
//     xaxis: { type: "datetime", labels: { format: "HH:mm" } },
//     yaxis: { labels: { formatter: (v: number) => `${v} V` } },
//     legend: { show: true, position: "top", horizontalAlign: "left" },
//     tooltip: { x: { format: "HH:mm" }, y: { formatter: (v: number) => `${v} V` } },
//   },
// };

// /* helper: แปลงเดือนให้เป็น datetime ต้นเดือน */
// const M = (m: number) => `2025-${String(m).padStart(2, "0")}-01`;

// /* ============ 2) Current (A) — datetime + group เดียวกัน ============ */
// const dailySalesChart = {
//   type: "line",
//   height: 220,
//   series: [
//     {
//       name: "I1",
//       data: [50, 40, 300, 320, 500, 350, 200, 230, 500].map((y, i) => ({
//         x: M(4 + i), // Apr..Dec
//         y,
//       })),
//     },
//     {
//       name: "I2",
//       data: [45, 35, 280, 300, 470, 330, 210, 220, 480].map((y, i) => ({
//         x: M(4 + i),
//         y,
//       })),
//     },
//     {
//       name: "I3",
//       data: [48, 38, 290, 310, 490, 340, 205, 225, 490].map((y, i) => ({
//         x: M(4 + i),
//         y,
//       })),
//     },
//   ],
//   options: {
//     ...chartsConfig,
//     chart: { type: "line", group: "power", zoom: { enabled: true }, toolbar: { show: true } },
//     colors: ["#0288d1", "#43A047", "#FB8C00"],
//     stroke: { lineCap: "round", width: 3, curve: "smooth" },
//     markers: { size: 5 },
//     xaxis: { type: "datetime", labels: { format: "MMM" } },
//     yaxis: { labels: { formatter: (v: number) => `${Math.round(v)}` } },
//     legend: { show: true, position: "top", horizontalAlign: "left" },
//     tooltip: { shared: true, intersect: false, x: { format: "MMM" }, y: { formatter: (v: number) => `${v} A` } },
//   },
// };

// /* ============ 3) Energy (W) — datetime + group เดียวกัน ============ */
// const completedTaskChart = {
//   type: "line",
//   height: 220,
//   series: [
//     { name: "W1", data: [50, 40, 300, 320, 500, 350, 200, 230, 500].map((y, i) => ({ x: M(4 + i), y })) },
//     { name: "W2", data: [40, 32, 260, 280, 450, 300, 190, 210, 470].map((y, i) => ({ x: M(4 + i), y })) },
//     { name: "W3", data: [46, 36, 290, 295, 480, 325, 195, 220, 485].map((y, i) => ({ x: M(4 + i), y })) },
//   ],
//   options: {
//     ...chartsConfig,
//     chart: { type: "line", group: "power", zoom: { enabled: true }, toolbar: { show: true } },
//     colors: ["#388e3c", "#0288d1", "#FB8C00"],
//     stroke: { lineCap: "round", width: 3, curve: "smooth" },
//     markers: { size: 5 },
//     xaxis: { type: "datetime", labels: { format: "MMM" } },
//     yaxis: { labels: { formatter: (v: number) => `${Math.round(v)} W` } },
//     legend: { show: true, position: "top", horizontalAlign: "left" },
//     tooltip: { shared: true, intersect: false, x: { format: "MMM" }, y: { formatter: (v: number) => `${v} W` } },
//   },
// };

// // alias เดิม
// const completedTasksChart = { ...completedTaskChart };

// export const statisticsChartsData = (MDB:MDBType) =>  [
//   {
//     color: "white",
//     title: "Voltage Line to Neutral (V)",
//     description: "Last Campaign Performance",
//     // footer: "campaign sent 2 days ago",
//     chart: websiteViewsChart,
//     metrics: [
//       { label: "L1", value: `${MDB.VL1N} V` },
//       { label: "L2", value: `${MDB.VL2N} V` },
//       { label: "L3", value: `${MDB.VL3N} V` },
//     ],
//   },
//   {
//     color: "white",
//     title: "Current (A)",
//     description: "15% increase in today sales",
//     // footer: "updated 4 min ago",
//     chart: dailySalesChart,
//     metrics: [
//       { label: "I1", value: `${MDB.I1} A` },
//       { label: "I2", value: `${MDB.I2} A` },
//       { label: "I3", value: `${MDB.I3} A` },
//     ],
//   },
//   {
//     color: "white",
//     title: "Energy (W)",
//     description: "Last Campaign Performance",
//     // footer: "just updated",
//     chart: completedTasksChart,
//     metrics: [
//       { label: "W1", value: `${MDB.EL1} W` },
//       { label: "W2", value: `${MDB.EL2} W` },
//       { label: "W3", value: `${MDB.EL3} W` },
//     ],
//   },
// ];

// export const data_MDB = (MDB: MDBType) => statisticsChartsData(MDB);

// export default { statisticsChartsData ,data_MDB };
