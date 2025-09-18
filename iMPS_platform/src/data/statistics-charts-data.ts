import { chartsConfig } from "@/configs";
import type { MDBType } from "@/app/dashboard/mdb/components/mdb-info";


export type HistoryRow = {
  Datetime: string; // ISO timestamp (มาจาก Datetime ของ SSE)
  VL1N?: number; VL2N?: number; VL3N?: number;
  I1?: number; I2?: number; I3?: number;
  PL1N?: number; PL2N?: number; PL3N?: number;
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


const baseOptions = {
  ...chartsConfig,
  chart: {
    type: "line",
    group: "power",
    zoom: { enabled: true },
    toolbar: { show: true }
  },
  xaxis: {
    type: "datetime",
    labels: {
      datetimeUTC: false, // ใช้เวลาเครื่อง (ไทย)
      format: "HH:mm",
    },
    tickAmount: 6,
    // min / max จะถูก override ใน buildChartsFromHistory
  },
  tooltip: {
    x: {
      formatter: (val: number | null) => {
        if (!val) return "";
        const date = new Date(val);
        return date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", year: "numeric",  // แสดงปี
        month: "2-digit",  
        day: "2-digit",   
        hour: "2-digit",   
        minute: "2-digit", 
        second: "2-digit",  hour12: false });
      },
    },
  },
  stroke: { lineCap: "round", width: 3, curve: "smooth" },
  markers: { size: 0 },
  legend: { show: true, position: "top", horizontalAlign: "left" },
  noData: { text: "No history data" },
};

export function buildChartsFromHistory(
  MDB: MDBType,
  history: HistoryRow[],
  startDate: string,
  endDate: string
) {
  
  console.log(history)
  const fromDate = new Date(startDate);
  fromDate.setHours(0, 0, 0, 0); // 00:00 ไทย = 17:00 UTC ของวันก่อน
  const toDate = new Date(endDate);
  toDate.setHours(23 + 7, 59, 59); // 23:59:59.999 ไทย

  const mappedHistory = history
    .filter(item => item.Datetime) // filter ที่ไม่มี Datetime
    .map(item => ({ ...item, ts: item.Datetime }));

  const filteredHistory = mappedHistory.filter(item => {
    if (!item.ts) return false;
    const itemTime = new Date(item.ts);
    return !isNaN(itemTime.getTime()) && itemTime >= fromDate && itemTime <= toDate;
  });

  // 3️⃣ สร้าง series สำหรับกราฟ
  const voltageSeries = ensureMinPoints([
    { name: "L1", data: toXY(filteredHistory, "VL1N") },
    { name: "L2", data: toXY(filteredHistory, "VL2N") },
    { name: "L3", data: toXY(filteredHistory, "VL3N") },
  ]);
  const currentSeries = ensureMinPoints([
    { name: "I1", data: toXY(filteredHistory, "I1") },
    { name: "I2", data: toXY(filteredHistory, "I2") },
    { name: "I3", data: toXY(filteredHistory, "I3") },
  ]);
  const powerSeries = ensureMinPoints([
    { name: "W1", data: toXY(filteredHistory, "PL1N") },
    { name: "W2", data: toXY(filteredHistory, "PL2N") },
    { name: "W3", data: toXY(filteredHistory, "PL3N") },
  ]);

  // 4️⃣ สร้างกราฟ
  const voltageChart = {
    type: "line",
    height: 220,
    series: voltageSeries,
    options: {
      ...baseOptions,
      xaxis: { ...baseOptions.xaxis, min: fromDate, max: toDate }, // กำหนดช่วงวัน
      yaxis: { labels: { formatter: (v: number) => `${v} V` } },
      tooltip: { y: { formatter: (v: number) => `${v} V` } },
    },
  };

  const currentChart = {
    type: "line",
    height: 220,
    series: currentSeries,
    options: {
      ...baseOptions,
      xaxis: { ...baseOptions.xaxis, min: fromDate, max: toDate },
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
      xaxis: { ...baseOptions.xaxis, min: fromDate, max: toDate },
      yaxis: { labels: { formatter: (v: number) => `${Math.round(v)} W` } },
      tooltip: { shared: true, intersect: false, y: { formatter: (v: number) => `${v} W` } },
    },
  };

  return [
    {
      color: "white", title: "Voltage Line to Neutral (V)", description: "History/SSE",
      chart: voltageChart,
      metrics: [
        { label: "L1", value: `${MDB.VL1N} V` },
        { label: "L2", value: `${MDB.VL2N} V` },
        { label: "L3", value: `${MDB.VL3N} V` }
      ]
    },
    {
      color: "white", title: "Current (A)", description: "History/SSE",
      chart: currentChart,
      metrics: [
        { label: "I1", value: `${MDB.I1} A` },
        { label: "I2", value: `${MDB.I2} A` },
        { label: "I3", value: `${MDB.I3} A` }
      ]
    },
    {
      color: "white", title: "Power (W)", description: "History/SSE",
      chart: powerChart,
      metrics: [
        { label: "W1", value: `${MDB.PL1N} W` },
        { label: "W2", value: `${MDB.PL2N} W` },
        { label: "W3", value: `${MDB.PL3N} W` }
      ]
    },
  ];
}



export const statisticsChartsData = (
  MDB: MDBType,
  history: HistoryRow[] = [],
  startDate: string,
  endDate: string
) => {
  return buildChartsFromHistory(MDB, history, startDate, endDate);
};

// แก้ไขฟังก์ชัน data_MDB เพื่อส่ง startDate และ endDate
export const data_MDB = (
  MDB: MDBType,
  history: HistoryRow[] = [],
  startDate: string,
  endDate: string
) => {
  return statisticsChartsData(MDB, history, startDate, endDate);
};
export default { statisticsChartsData, data_MDB, buildChartsFromHistory };

