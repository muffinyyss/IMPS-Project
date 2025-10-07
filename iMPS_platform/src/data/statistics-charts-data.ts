import { chartsConfig } from "@/configs";
import type { MDBType } from "@/app/dashboard/mdb/components/mdb-info";


export type HistoryRow = {
  timestamp: string; // ISO
  VL1N?:  number; VL2N?:  number; VL3N?:  number;
  I1?:  number; I2?:  number; I3?:  number;
  PL1N?:  number; PL2N?:  number; PL3N?:  number;
};

type Point = { x: number; y: number | null };
type NumericKey =
  | "VL1N" | "VL2N" | "VL3N"
  | "I1" | "I2" | "I3"
  | "PL1N" | "PL2N" | "PL3N";
type RowWithTs = HistoryRow & { ts: string };

// ✅ FIXED: ปรับค่าที่ผิดปกติ
const toNumOrNull = (v: unknown): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  
  // ✅ แก้ค่าที่สูงผิดปกติ (ถ้าข้อมูลจาก sensor มีหน่วยผิด)
  // ถ้า I > 10000 คูณด้วย 0.001 (แปลง mA -> A)
  // ถ้า P > 1000000 คูณด้วย 0.001 (แปลง mW -> W)
  return v;
};


// ✅ เพิ่มจุดขั้นต่ำเพื่อให้กราฟแสดงได้
const ensureMinPoints = (series: any[], padSec = 60) =>
  series.map((s) => {
    const arr: Point[] = Array.isArray(s.data) ? [...s.data] : [];
    if (arr.length >= 2) return { ...s, data: arr };
    if (arr.length === 1) {
      const p0 = arr[0];
      const pPrev: Point = { x: p0.x - padSec * 1000, y: p0.y };
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
      datetimeUTC: false, // แสดงเวลาท้องถิ่น
      format: "dd/MM HH:mm",
    },
    tickAmount: 8,
  },
  tooltip: {
    x: {
      formatter: (val: number | null) => {
        if (!val) return "";
        const date = new Date(val);
        return date.toLocaleString("th-TH", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        });
      },
    },
  },
  stroke: { lineCap: "round", width: 2, curve: "smooth" },
  markers: { size: 0 },
  legend: { show: true, position: "top", horizontalAlign: "left" },
  noData: { text: "No history data" },
};

// ✅ CRITICAL FIX: ใช้ UTC แทน +07:00
export function buildChartsFromHistory(
  MDB: MDBType,
  history: HistoryRow[],
  startDate: string,
  endDate: string
) {
  console.log("📊 Building charts from history:", {
    historyLength: history.length,
    startDate,
    endDate,
    firstItem: history[0],
  });

  // ✅ ใช้ UTC เหมือนข้อมูลจาก backend
  const fromTs = Date.parse(`${startDate}T00:00:00Z`);
  const toTs = Date.parse(`${endDate}T23:59:59.999Z`);

  console.log("📅 Date range:", {
    fromTs,
    toTs,
    fromDate: new Date(fromTs).toISOString(),
    toDate: new Date(toTs).toISOString(),
  });

  // ✅ FIXED: normalize timestamp ให้เป็น UTC
  const normalizeTs = (s: string): string => {
    let x = s.trim();

    // "YYYY-MM-DD HH:mm:ss(.ffffff)" -> "YYYY-MM-DDTHH:mm:ss"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(x)) {
      x = x.replace(" ", "T");
    }

    // "YYYY-MM-DD" -> "YYYY-MM-DDT00:00:00Z"
    if (/^\d{4}-\d{2}-\d{2}$/.test(x)) {
      return `${x}T00:00:00Z`;
    }

    // ตัด microseconds ให้เหลือ 3 หลัก
    x = x.replace(/\.(\d{3})\d+/, ".$1");

    // ✅ ถ้ายังไม่มี timezone ให้เติม Z (UTC)
    if (!/(Z|[+\-]\d{2}:\d{2})$/.test(x)) {
      x += "Z";
    }

    return x;
  };

  // ✅ แปลงและกรอง history
  const mappedHistory = history
    .filter(item => item.timestamp)
    .map(item => {
      const ts = normalizeTs(item.timestamp);
      return { ...item, ts };
    });

  console.log("🔄 Mapped history sample:", mappedHistory.slice(0, 3));

  const filteredHistory = mappedHistory.filter(item => {
    const t = Date.parse(item.ts);
    const inRange = Number.isFinite(t) && t >= fromTs && t <= toTs;
    return inRange;
  });

  console.log("✅ Filtered history:", {
    total: filteredHistory.length,
    first: filteredHistory[0]?.ts,
    last: filteredHistory[filteredHistory.length - 1]?.ts,
  });

  // ✅ สร้างจุดข้อมูล (x = epoch ms, y = value)
  const toXY = (rows: RowWithTs[], key: NumericKey): Point[] => {
    const points = [...rows]
      .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
      .map(r => {
        const x = Date.parse(r.ts);
        const rawValue = r[key];
        let y = toNumOrNull(rawValue);

        // ✅ CRITICAL: แก้ค่าผิดปกติ
        if (y !== null) {
          // กระแส: ถ้า > 10000 A แปลงเป็น A (หาร 1000)
          if (key.startsWith("I") && y > 10000) {
            y = y / 1000;
          }
          // กำลังไฟ: ถ้า > 1000000 W แปลงเป็น W (หาร 1000)
          if (key.startsWith("PL") && y > 1000000) {
            y = y / 1000;
          }
        }

        return { x, y };
      });

    console.log(`📈 ${key}:`, {
      points: points.length,
      sample: points.slice(0, 2),
      range: points.length > 0 
        ? [Math.min(...points.map(p => p.y ?? 0)), Math.max(...points.map(p => p.y ?? 0))]
        : []
    });

    return points;
  };

  // ✅ สร้าง series
  const voltageSeries = ensureMinPoints([
    { name: "L1-N", data: toXY(filteredHistory, "VL1N") },
    { name: "L2-N", data: toXY(filteredHistory, "VL2N") },
    { name: "L3-N", data: toXY(filteredHistory, "VL3N") },
  ]);

  const currentSeries = ensureMinPoints([
    { name: "Phase 1", data: toXY(filteredHistory, "I1") },
    { name: "Phase 2", data: toXY(filteredHistory, "I2") },
    { name: "Phase 3", data: toXY(filteredHistory, "I3") },
  ]);

  const powerSeries = ensureMinPoints([
    { name: "Power L1", data: toXY(filteredHistory, "PL1N") },
    { name: "Power L2", data: toXY(filteredHistory, "PL2N") },
    { name: "Power L3", data: toXY(filteredHistory, "PL3N") },
  ]);

  // ✅ สร้างกราฟ
  const voltageChart = {
    type: "line",
    height: 220,
    series: voltageSeries,
    options: {
      ...baseOptions,
      xaxis: {
        ...baseOptions.xaxis,
        min: fromTs,
        max: toTs,
      },
      yaxis: {
        title: { text: "Voltage (V)" },
        labels: { formatter: (v: number) => `${Math.round(v)} V` }
      },
      tooltip: {
        ...baseOptions.tooltip,
        y: { formatter: (v: number) => `${v.toFixed(2)} V` }
      },
    },
  };

  const currentChart = {
    type: "line",
    height: 220,
    series: currentSeries,
    options: {
      ...baseOptions,
      xaxis: {
        ...baseOptions.xaxis,
        min: fromTs,
        max: toTs,
      },
      yaxis: {
        title: { text: "Current (A)" },
        labels: { formatter: (v: number) => `${Math.round(v)} A` }
      },
      tooltip: {
        ...baseOptions.tooltip,
        shared: true,
        intersect: false,
        y: { formatter: (v: number) => `${v.toFixed(2)} A` }
      },
    },
  };

  const powerChart = {
    type: "line",
    height: 220,
    series: powerSeries,
    options: {
      ...baseOptions,
      xaxis: {
        ...baseOptions.xaxis,
        min: fromTs,
        max: toTs,
      },
      yaxis: {
        title: { text: "Power (W)" },
        labels: { formatter: (v: number) => `${Math.round(v)} W` }
      },
      tooltip: {
        ...baseOptions.tooltip,
        shared: true,
        intersect: false,
        y: { formatter: (v: number) => `${v.toFixed(2)} W` }
      },
    },
  };

  console.log("✅ Charts built successfully");

  return [
    {
      color: "white",
      title: "Voltage Line to Neutral (V)",
      description: "Real-time voltage monitoring",
      chart: voltageChart,
      metrics: [
        { label: "L1-N", value: `${MDB.VL1N} V` },
        { label: "L2-N", value: `${MDB.VL2N} V` },
        { label: "L3-N", value: `${MDB.VL3N} V` }
      ]
    },
    {
      color: "white",
      title: "Current per Phase (A)",
      description: "Real-time current monitoring",
      chart: currentChart,
      metrics: [
        { label: "Phase 1", value: `${MDB.I1.toFixed(2)} A` },
        { label: "Phase 2", value: `${MDB.I2.toFixed(2)} A` },
        { label: "Phase 3", value: `${MDB.I3.toFixed(2)} A` }
      ]
    },
    {
      color: "white",
      title: "Active Power per Phase (W)",
      description: "Real-time power monitoring",
      chart: powerChart,
      metrics: [
        { label: "Power L1", value: `${Math.round(MDB.PL1N)} W` },
        { label: "Power L2", value: `${Math.round(MDB.PL2N)} W` },
        { label: "Power L3", value: `${Math.round(MDB.PL3N)} W` }
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

export const data_MDB = (
  MDB: MDBType,
  history: HistoryRow[] = [],
  startDate: string,
  endDate: string
) => {
  return statisticsChartsData(MDB, history, startDate, endDate);
};

export default { statisticsChartsData, data_MDB, buildChartsFromHistory };