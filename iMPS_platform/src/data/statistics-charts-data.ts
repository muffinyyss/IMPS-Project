import { chartsConfig } from "@/configs";
import type {MDBType} from "@/app/dashboard/mdb/components/mdb-info";
/* ============ 1) Voltage (V) ============ */
const websiteViewsChart = {
  type: "line",
  height: 220,
  series: [
    {
      name: "L1",
      data: [
        { x: "2025-09-09T09:26:00", y: 232.11 },
        { x: "2025-09-09T09:56:00", y: 231.8 },
        { x: "2025-09-09T10:26:00", y: 232.5 },
        { x: "2025-09-09T11:25:00", y: 232.11 },
      ],
    },
    {
      name: "L2",
      data: [
        { x: "2025-09-09T09:26:00", y: 231.91 },
        { x: "2025-09-09T09:56:00", y: 232.1 },
        { x: "2025-09-09T10:26:00", y: 233.0 },
        { x: "2025-09-09T11:25:00", y: 231.91 },
      ],
    },
    {
      name: "L3",
      data: [
        { x: "2025-09-09T09:26:00", y: 233.44 },
        { x: "2025-09-09T09:56:00", y: 233.0 },
        { x: "2025-09-09T10:26:00", y: 234.0 },
        { x: "2025-09-09T11:25:00", y: 233.44 },
      ],
    },
  ],
  options: {
    ...chartsConfig,
    chart: { type: "line", group: "power", zoom: { enabled: true }, toolbar: { show: true } },
    colors: ["#0288d1", "#43A047", "#FB8C00"],
    stroke: { lineCap: "round", width: 2, curve: "smooth" },
    markers: { size: 0 },
    xaxis: { type: "datetime", labels: { format: "HH:mm" } },
    yaxis: { labels: { formatter: (v: number) => `${v} V` } },
    legend: { show: true, position: "top", horizontalAlign: "left" },
    tooltip: { x: { format: "HH:mm" }, y: { formatter: (v: number) => `${v} V` } },
  },
};

/* helper: แปลงเดือนให้เป็น datetime ต้นเดือน */
const M = (m: number) => `2025-${String(m).padStart(2, "0")}-01`;

/* ============ 2) Current (A) — datetime + group เดียวกัน ============ */
const dailySalesChart = {
  type: "line",
  height: 220,
  series: [
    {
      name: "I1",
      data: [50, 40, 300, 320, 500, 350, 200, 230, 500].map((y, i) => ({
        x: M(4 + i), // Apr..Dec
        y,
      })),
    },
    {
      name: "I2",
      data: [45, 35, 280, 300, 470, 330, 210, 220, 480].map((y, i) => ({
        x: M(4 + i),
        y,
      })),
    },
    {
      name: "I3",
      data: [48, 38, 290, 310, 490, 340, 205, 225, 490].map((y, i) => ({
        x: M(4 + i),
        y,
      })),
    },
  ],
  options: {
    ...chartsConfig,
    chart: { type: "line", group: "power", zoom: { enabled: true }, toolbar: { show: true } },
    colors: ["#0288d1", "#43A047", "#FB8C00"],
    stroke: { lineCap: "round", width: 3, curve: "smooth" },
    markers: { size: 5 },
    xaxis: { type: "datetime", labels: { format: "MMM" } },
    yaxis: { labels: { formatter: (v: number) => `${Math.round(v)}` } },
    legend: { show: true, position: "top", horizontalAlign: "left" },
    tooltip: { shared: true, intersect: false, x: { format: "MMM" }, y: { formatter: (v: number) => `${v} A` } },
  },
};

/* ============ 3) Energy (W) — datetime + group เดียวกัน ============ */
const completedTaskChart = {
  type: "line",
  height: 220,
  series: [
    { name: "W1", data: [50, 40, 300, 320, 500, 350, 200, 230, 500].map((y, i) => ({ x: M(4 + i), y })) },
    { name: "W2", data: [40, 32, 260, 280, 450, 300, 190, 210, 470].map((y, i) => ({ x: M(4 + i), y })) },
    { name: "W3", data: [46, 36, 290, 295, 480, 325, 195, 220, 485].map((y, i) => ({ x: M(4 + i), y })) },
  ],
  options: {
    ...chartsConfig,
    chart: { type: "line", group: "power", zoom: { enabled: true }, toolbar: { show: true } },
    colors: ["#388e3c", "#0288d1", "#FB8C00"],
    stroke: { lineCap: "round", width: 3, curve: "smooth" },
    markers: { size: 5 },
    xaxis: { type: "datetime", labels: { format: "MMM" } },
    yaxis: { labels: { formatter: (v: number) => `${Math.round(v)} W` } },
    legend: { show: true, position: "top", horizontalAlign: "left" },
    tooltip: { shared: true, intersect: false, x: { format: "MMM" }, y: { formatter: (v: number) => `${v} W` } },
  },
};

// alias เดิม
const completedTasksChart = { ...completedTaskChart };

export const statisticsChartsData = (MDB:MDBType) =>  [
  {
    color: "white",
    title: "Voltage Line to Neutral (V)",
    description: "Last Campaign Performance",
    // footer: "campaign sent 2 days ago",
    chart: websiteViewsChart,
    metrics: [
      { label: "L1", value: `${MDB.PL1N} V` },
      { label: "L2", value: `${MDB.PL2N} V` },
      { label: "L3", value: `${MDB.PL3N} V` },
    ],
  },
  {
    color: "white",
    title: "Current (A)",
    description: "15% increase in today sales",
    // footer: "updated 4 min ago",
    chart: dailySalesChart,
    metrics: [
      { label: "I1", value: `${MDB.I1} A` },
      { label: "I2", value: `${MDB.I2} A` },
      { label: "I3", value: `${MDB.I3} A` },
    ],
  },
  {
    color: "white",
    title: "Energy (W)",
    description: "Last Campaign Performance",
    // footer: "just updated",
    chart: completedTasksChart,
    metrics: [
      { label: "W1", value: `${MDB.EL1} W` },
      { label: "W2", value: `${MDB.EL2} W` },
      { label: "W3", value: `${MDB.EL3} W` },
    ],
  },
];

export const data_MDB = (MDB: MDBType) => statisticsChartsData(MDB);

export default { statisticsChartsData ,data_MDB };
