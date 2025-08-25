// components/Cards/CardBarChart.js
import React, { useEffect, useRef } from "react";

export default function CardBarChart() {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      // import ฝั่ง client และ auto-register ส่วนประกอบทั้งหมด
      const { default: Chart } = await import("chart.js/auto");
      if (!isMounted || !canvasRef.current) return;

      const data = {
        labels: ["January", "February", "March", "April", "May", "June", "July"],
        datasets: [
          {
            label: String(new Date().getFullYear()),
            data: [30, 78, 56, 34, 100, 45, 13],
            backgroundColor: "#ed64a6",
            borderColor: "#ed64a6",
            borderWidth: 1,
            barThickness: 8,
          },
          {
            label: String(new Date().getFullYear() - 1),
            data: [27, 68, 86, 74, 10, 4, 87],
            backgroundColor: "#4c51bf",
            borderColor: "#4c51bf",
            borderWidth: 1,
            barThickness: 8,
          },
        ],
      };

      const options = {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          title: { display: false, text: "Orders Chart" },
          legend: {
            position: "bottom",
            labels: { color: "rgba(0,0,0,.7)" },
          },
          tooltip: {
            // การตั้งค่า tooltip v3 อยู่ใต้ plugins.tooltip
            mode: "index",
            intersect: false,
          },
        },
        interaction: { mode: "nearest", intersect: true },
        scales: {
          x: {
            display: false,
            title: { display: true, text: "Month" },
            grid: {
              borderDash: [2],
              color: "rgba(33, 37, 41, 0.3)",
            },
          },
          y: {
            display: true,
            title: { display: false, text: "Value" },
            grid: {
              drawBorder: false,
              borderDash: [2],
              color: "rgba(33, 37, 41, 0.2)",
            },
            ticks: { color: "rgba(0,0,0,.7)" },
          },
        },
      };

      const ctx = canvasRef.current.getContext("2d");
      if (chartRef.current) chartRef.current.destroy(); // กันกราฟซ้อนใน Strict Mode
      chartRef.current = new Chart(ctx, { type: "bar", data, options });
    })();

    return () => {
      isMounted = false;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <div className="relative flex flex-col min-w-0 break-words bg-white w-full mb-6 shadow-lg rounded">
        <div className="rounded-t mb-0 px-4 py-3 bg-transparent">
          <div className="flex flex-wrap items-center">
            <div className="relative w-full max-w-full flex-grow flex-1">
              <h6 className="uppercase text-blueGray-400 mb-1 text-xs font-semibold">
                Performance
              </h6>
              <h2 className="text-blueGray-700 text-xl font-semibold">
                Total orders
              </h2>
            </div>
          </div>
        </div>
        <div className="p-4 flex-auto">
          <div className="relative h-350-px">
            <canvas ref={canvasRef} id="bar-chart" />
          </div>
        </div>
      </div>
    </>
  );
}
