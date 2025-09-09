import { chartsConfig } from "@/configs";

/* ============ 1) Line 3 เส้น สำหรับ Voltage L-N (V) ============ */
// const websiteViewsChart = {
//   type: "line",
//   height: 220,
//   series: [
//     { name: "L1", data: [205.1, 206.3, 204.8, 207.2, 205.9, 203.4, 206.7, 208.2, 207.0] },
//     { name: "L2", data: [219.9, 221.0, 220.4, 222.1, 218.7, 219.2, 221.3, 220.5, 222.0] },
//     { name: "L3", data: [242.4, 243.2, 241.8, 244.0, 242.9, 241.1, 243.5, 244.1, 243.8] },
//   ],
//   options: {
//     ...chartsConfig,
//     colors: ["#0288d1", "#43A047", "#FB8C00"], // L1/L2/L3
//     stroke: { lineCap: "round", width: 3, curve: "smooth" }, // <<< เส้นโค้งมน
//     markers: { size: 4 },
//     tooltip: {
//       shared: true,
//       intersect: false,
//       y: { formatter: (v: number) => `${v} V` },
//     },
//     legend: { show: true, position: "top", horizontalAlign: "right" },
//     xaxis: {
//       ...chartsConfig.xaxis,
//       categories: [
//         "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
//       ], // <<< ให้เหมือนกราฟ 2 และ 3
//     },
//     yaxis: {
//       ...chartsConfig.yaxis,
//       labels: { formatter: (v: number) => `${v} V` },
//     },
//   },
// };
const websiteViewsChart = {
  type: "line",
  height: 220,
  series: [
    {
      name: "L1",
      data: [
        { x: "2025-09-09T09:26:00", y: 232.11 },
        { x: "2025-09-09T09:56:00", y: 231.80 },
        { x: "2025-09-09T10:26:00", y: 232.50 },
        { x: "2025-09-09T11:25:00", y: 232.11 },
      ],
    },
    {
      name: "L2",
      data: [
        { x: "2025-09-09T09:26:00", y: 231.91 },
        { x: "2025-09-09T09:56:00", y: 232.10 },
        { x: "2025-09-09T10:26:00", y: 233.00 },
        { x: "2025-09-09T11:25:00", y: 231.91 },
      ],
    },
    {
      name: "L3",
      data: [
        { x: "2025-09-09T09:26:00", y: 233.44 },
        { x: "2025-09-09T09:56:00", y: 233.00 },
        { x: "2025-09-09T10:26:00", y: 234.00 },
        { x: "2025-09-09T11:25:00", y: 233.44 },
      ],
    },
  ],
  options: {
    ...chartsConfig,
    chart: { type: "line", zoom: { enabled: false }, toolbar: { show: false } },
    colors: ["#0288d1", "#43A047", "#FB8C00"],
    stroke: { lineCap: "round", width: 2, curve: "smooth" },
    markers: { size: 0 },
    tooltip: {
      x: { format: "HH:mm" }, // แสดงเวลาใน tooltip
      y: { formatter: (val: number) => `${val} V` },
    },
    xaxis: {
      type: "datetime",   // <<< สำคัญ
      labels: { format: "HH:mm" }, // แกน X แสดงเวลา
    },
    yaxis: {
      labels: { formatter: (val: number) => `${val} V` },
    },
    legend: { show: true, position: "top", horizontalAlign: "right" },
  },
};


/* ============ 2) Line 3 เส้น สำหรับ Current (A) ============ */
const dailySalesChart = {
  type: "line",
  height: 220,
  series: [
    { name: "I1", data: [50, 40, 300, 320, 500, 350, 200, 230, 500] },
    { name: "I2", data: [45, 35, 280, 300, 470, 330, 210, 220, 480] },
    { name: "I3", data: [48, 38, 290, 310, 490, 340, 205, 225, 490] },
  ],
  options: {
    ...chartsConfig,
    // 3 สีสำหรับ 3 series
    colors: ["#0288d1", "#43A047", "#FB8C00"],
    stroke: { lineCap: "round", width: 3, curve: "smooth" },
    markers: { size: 5 },
    tooltip: { shared: true, intersect: false },
    legend: { show: true, position: "top", horizontalAlign: "right" },
    xaxis: {
      ...chartsConfig.xaxis,
      categories: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    },
  },
};

/* ============ 3) Line 3 เส้น สำหรับ Energy (W) ============ */
const completedTaskChart = {
  type: "line",
  height: 220,
  series: [
    { name: "W1", data: [50, 40, 300, 320, 500, 350, 200, 230, 500] },
    { name: "W2", data: [40, 32, 260, 280, 450, 300, 190, 210, 470] },
    { name: "W3", data: [46, 36, 290, 295, 480, 325, 195, 220, 485] },
  ],
  options: {
    ...chartsConfig,
    colors: ["#388e3c", "#0288d1", "#FB8C00"],
    stroke: { lineCap: "round", width: 3, curve: "smooth" },
    markers: { size: 5 },
    tooltip: { shared: true, intersect: false },
    legend: { show: true, position: "top", horizontalAlign: "right" },
    xaxis: {
      ...chartsConfig.xaxis,
      categories: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    },
  },
};

// alias ของคุณที่ใช้เดิม
const completedTasksChart = { ...completedTaskChart };

export const statisticsChartsData = [
  {
    color: "white",
    title: "Voltage Line to Neutral (V)",
    description: "Last Campaign Performance",
    footer: "campaign sent 2 days ago",
    chart: websiteViewsChart,
    metrics: [
      { label: "L1", value: "205.11 V" },
      { label: "L2", value: "219.91 V" },
      { label: "L3", value: "242.44 V" },
    ],
  },
  {
    color: "white",
    title: "Current (A)",
    description: "15% increase in today sales",
    footer: "updated 4 min ago",
    chart: dailySalesChart, // <<<< 3 เส้น
    metrics: [
      { label: "I1", value: "89.52 A" },
      { label: "I2", value: "87.69 A" },
      { label: "I3", value: "88.62 A" },
    ],
  },
  {
    color: "white",
    title: "Energy (W)",
    description: "Last Campaign Performance",
    footer: "just updated",
    chart: completedTasksChart, // <<<< 3 เส้น
    metrics: [
      { label: "W1", value: "20661.73 W" },
      { label: "W2", value: "20189.51 W" },
      { label: "W3", value: "20576.95 W" },
    ],
  },
];

export const data_MDB = [...statisticsChartsData];

export default { statisticsChartsData, data_MDB };
