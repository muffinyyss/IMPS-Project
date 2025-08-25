// components/Cards/CardLineChart.js
import React, { useEffect, useRef } from "react";

export default function CardLineChart() {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      // ใช้ chart.js/auto เพื่อ auto-register ส่วนประกอบทั้งหมด
      const { default: Chart } = await import("chart.js/auto");
      if (!isMounted || !canvasRef.current) return;

      const data = {
        labels: ["January", "February", "March", "April", "May", "June", "July"],
        datasets: [
          {
            label: String(new Date().getFullYear()),
            data: [65, 78, 66, 44, 56, 67, 75],
            borderColor: "#4c51bf",
            backgroundColor: "rgba(76,81,191,0.2)",
            fill: false,
            tension: 0.4,
          },
          {
            label: String(new Date().getFullYear() - 1),
            data: [40, 68, 86, 74, 56, 60, 87],
            borderColor: "#ffffff",
            backgroundColor: "rgba(255,255,255,0.2)",
            fill: false,
            tension: 0.4,
          },
        ],
      };

      const options = {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          title: {
            display: false,
            text: "Sales Charts",
            color: "#fff",
          },
          legend: {
            position: "bottom",
            labels: {
              color: "rgba(255,255,255,.9)",
            },
          },
          tooltip: {
            mode: "index",
            intersect: false,
          },
        },
        interaction: { mode: "nearest", intersect: true },
        scales: {
          x: {
            ticks: { color: "rgba(255,255,255,.7)" },
            grid: {
              display: false,
              borderDash: [2],
              color: "rgba(33, 37, 41, 0.3)",
            },
          },
          y: {
            ticks: { color: "rgba(255,255,255,.7)" },
            grid: {
              drawBorder: false,
              borderDash: [3],
              color: "rgba(255, 255, 255, 0.15)",
            },
          },
        },
      };

      const ctx = canvasRef.current.getContext("2d");
      // กันกราฟซ้อนใน dev/strict mode
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart(ctx, { type: "line", data, options });
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
      <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded bg-blueGray-700">
        <div className="rounded-t mb-0 px-4 py-3 bg-transparent">
          <div className="flex flex-wrap items-center">
            <div className="relative w-full max-w-full flex-grow flex-1">
              <h6 className="uppercase text-blueGray-100 mb-1 text-xs font-semibold">
                Overview
              </h6>
              <h2 className="text-white text-xl font-semibold">Sales value</h2>
            </div>
          </div>
        </div>
        <div className="p-4 flex-auto">
          <div className="relative h-350-px">
            <canvas ref={canvasRef} id="line-chart" />
          </div>
        </div>
      </div>
    </>
  );
}
