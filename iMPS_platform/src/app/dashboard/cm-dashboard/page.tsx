"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/utils/api";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Types ───────────────────────────────────────────────────────────────────

type CMRow = {
  id: string;
  station_id: string;
  station_name: string;
  status: string;
  faulty_equipment: string;
  cause: string;
  severity: string;
  cm_date: string | null;
  reported_by: string;
  inspector: string;
  issue_id: string;
  doc_name: string;
};

type Period = "yearly" | "monthly" | "weekly";

type ActiveFilters = {
  status: string | null;      // label from success rate donut
  equipment: string | null;   // label from equipment pie
  severity: string | null;    // label from severity bar
  station: string | null;     // from station bar
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS = { completed: "เสร็จสิ้น", in_progress: "รอดำเนินการ", open: "รอจัดซื้อ" } as const;
const DONUT_COLORS = ["#22c55e", "#f43f5e", "#f97316"];
const EQUIPMENT_COLORS = ["#3b82f6","#f43f5e","#f97316","#a855f7","#06b6d4","#eab308","#10b981","#64748b","#ec4899","#14b8a6"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeStatus(s: string): keyof typeof STATUS_LABELS {
  const v = (s || "").trim().toLowerCase().replace(/[-_\s]+/g, " ");
  if (v === "closed" || v === "close") return "completed";
  if (v === "in progress" || v === "inprogress") return "in_progress";
  return "open";
}

function filterByPeriod(rows: CMRow[], period: Period): CMRow[] {
  const now = new Date();
  return rows.filter((r) => {
    if (!r.cm_date) return true;
    const d = new Date(r.cm_date);
    if (isNaN(d.getTime())) return true;
    if (period === "weekly") return (now.getTime() - d.getTime()) / 86400000 <= 7;
    if (period === "monthly") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    return d.getFullYear() === now.getFullYear();
  });
}

function applyFilters(rows: CMRow[], filters: ActiveFilters, exclude?: keyof ActiveFilters): CMRow[] {
  return rows.filter((r) => {
    if (filters.status && exclude !== "status") {
      if (STATUS_LABELS[normalizeStatus(r.status)] !== filters.status) return false;
    }
    if (filters.equipment && exclude !== "equipment") {
      if ((r.faulty_equipment || "Unknown") !== filters.equipment) return false;
    }
    if (filters.severity && exclude !== "severity") {
      if ((r.severity || "Unknown") !== filters.severity) return false;
    }
    if (filters.station && exclude !== "station") {
      if ((r.station_name || r.station_id || "Unknown") !== filters.station) return false;
    }
    return true;
  });
}

function groupCount(rows: CMRow[], key: keyof CMRow): { keys: string[]; vals: number[] } {
  const map: Record<string, number> = {};
  for (const r of rows) {
    const v = (r[key] as string) || "Unknown";
    map[v] = (map[v] || 0) + 1;
  }
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 9);
  return { keys: sorted.map((e) => e[0]), vals: sorted.map((e) => e[1]) };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon, dim }: {
  label: string; value: number; color: string; icon: string; dim: boolean;
}) {
  return (
    <div
      className="tw-flex tw-items-center tw-justify-between tw-rounded-2xl tw-p-5 tw-text-white tw-shadow-md tw-transition-all"
      style={{ background: color, opacity: dim ? 0.45 : 1 }}
    >
      <div>
        <p className="tw-text-sm tw-font-medium tw-opacity-90">{label}</p>
        <p className="tw-mt-1 tw-text-3xl tw-font-bold">{value}</p>
      </div>
      <div className="tw-flex tw-h-12 tw-w-12 tw-items-center tw-justify-center tw-rounded-full tw-bg-white/20 tw-text-xl">
        {icon}
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-bg-blue-100 tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-text-blue-700">
      {label}
      <button onClick={onRemove} className="tw-text-blue-400 hover:tw-text-blue-700 tw-font-bold tw-text-sm tw-leading-none">×</button>
    </span>
  );
}

function PeriodTabs({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="tw-flex tw-gap-1 tw-rounded-xl tw-bg-gray-100 tw-p-1">
      {(["yearly", "monthly", "weekly"] as Period[]).map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`tw-rounded-lg tw-px-4 tw-py-1.5 tw-text-sm tw-font-medium tw-transition-all tw-capitalize ${
            value === t ? "tw-bg-white tw-text-blue-700 tw-shadow-sm" : "tw-text-gray-500 hover:tw-text-gray-700"
          }`}>
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CMDashboardPage() {
  const [rows, setRows] = useState<CMRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("yearly");
  const [stationFilter, setStationFilter] = useState<string>("All");
  const [filters, setFilters] = useState<ActiveFilters>({ status: null, equipment: null, severity: null, station: null });

  // refs to reset chart selection programmatically
  const donutRef = useRef<any>(null);
  const equipRef = useRef<any>(null);
  const sevRef  = useRef<any>(null);
  const stationBarRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch("/cmreport/list-all");
        const json = await res.json();
        setRows(Array.isArray(json?.items) ? json.items : []);
      } catch { setRows([]); }
      finally { setLoading(false); }
    })();
  }, []);

  const toggleFilter = useCallback((dim: keyof ActiveFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [dim]: prev[dim] === value ? null : value }));
  }, []);

  const clearFilter = useCallback((dim: keyof ActiveFilters) => {
    setFilters((prev) => ({ ...prev, [dim]: null }));
  }, []);

  const clearAll = () => {
    setFilters({ status: null, equipment: null, severity: null, station: null });
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Base: period + station dropdown
  const stations = useMemo(() => {
    const names = Array.from(new Set(rows.map((r) => r.station_name || r.station_id))).filter(Boolean);
    return ["All", ...names];
  }, [rows]);

  const periodRows = useMemo(() => {
    const pr = filterByPeriod(rows, period);
    return stationFilter === "All" ? pr : pr.filter((r) => (r.station_name || r.station_id) === stationFilter);
  }, [rows, period, stationFilter]);

  // ── Success Rate: ignores its own status filter so donut shows context
  const srRows = useMemo(() => applyFilters(periodRows, filters, "status"), [periodRows, filters]);
  const srStats = useMemo(() => {
    let completed = 0, inProgress = 0, open = 0;
    for (const r of srRows) {
      const s = normalizeStatus(r.status);
      if (s === "completed") completed++;
      else if (s === "in_progress") inProgress++;
      else open++;
    }
    return { total: srRows.length, completed, inProgress, open };
  }, [srRows]);
  const successRate = srStats.total === 0 ? 0 : Math.round((srStats.completed / srStats.total) * 100);

  // ── Equipment pie: ignores own equipment filter
  const eqRows = useMemo(() => applyFilters(periodRows, filters, "equipment"), [periodRows, filters]);
  const eqData = useMemo(() => groupCount(eqRows, "faulty_equipment"), [eqRows]);

  // ── Severity bar: ignores own severity filter
  const sevRows = useMemo(() => applyFilters(periodRows, filters, "severity"), [periodRows, filters]);
  const sevData = useMemo(() => groupCount(sevRows, "severity"), [sevRows]);

  // ── Station bar: ignores own station filter
  const stRows = useMemo(() => applyFilters(periodRows, filters, "station"), [periodRows, filters]);
  const stationData = useMemo(() => {
    const map: Record<string, { open: number; inProgress: number; closed: number }> = {};
    for (const r of stRows) {
      const name = r.station_name || r.station_id || "Unknown";
      if (!map[name]) map[name] = { open: 0, inProgress: 0, closed: 0 };
      const s = normalizeStatus(r.status);
      if (s === "completed") map[name].closed++;
      else if (s === "in_progress") map[name].inProgress++;
      else map[name].open++;
    }
    return map;
  }, [stRows]);
  const stationNames = Object.keys(stationData);

  // ── Table: all filters applied
  const tableRows = useMemo(() => {
    const all = applyFilters(periodRows, filters);
    return [...all].sort((a, b) => (b.cm_date || "").localeCompare(a.cm_date || "")).slice(0, 15);
  }, [periodRows, filters]);

  // ── KPI stat cards: apply all filters
  const allFiltered = useMemo(() => applyFilters(periodRows, filters), [periodRows, filters]);
  const kpiStats = useMemo(() => {
    let completed = 0, inProgress = 0, open = 0;
    for (const r of allFiltered) {
      const s = normalizeStatus(r.status);
      if (s === "completed") completed++;
      else if (s === "in_progress") inProgress++;
      else open++;
    }
    return { total: allFiltered.length, completed, inProgress, open };
  }, [allFiltered]);

  // ─── Chart options ────────────────────────────────────────────────────────

  const donutOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "donut",
      events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
          const labels = [STATUS_LABELS.completed, STATUS_LABELS.in_progress, STATUS_LABELS.open];
          toggleFilter("status", labels[dataPointIndex]);
        },
      },
    },
    colors: DONUT_COLORS,
    labels: [STATUS_LABELS.completed, STATUS_LABELS.in_progress, STATUS_LABELS.open],
    legend: { show: true, position: "bottom", fontSize: "13px" },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
          labels: {
            show: true,
            total: {
              show: true, label: "SUCCESS RATE", fontSize: "11px", color: "#6b7280",
              formatter: () => `${successRate}%`,
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v: number) => `${v} งาน` } },
  }), [successRate, toggleFilter]);

  const equipOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "donut",
      events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
          const label = eqData.keys[dataPointIndex];
          if (label) toggleFilter("equipment", label);
        },
      },
    },
    colors: EQUIPMENT_COLORS,
    labels: eqData.keys.length ? eqData.keys : ["No data"],
    legend: { show: true, position: "bottom", fontSize: "11px" },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: "60%",
          labels: {
            show: true,
            total: { show: true, label: "Grand Total", fontSize: "10px", formatter: () => String(eqData.vals.reduce((s, v) => s + v, 0)) },
          },
        },
      },
    },
    tooltip: { y: { formatter: (v: number) => `${v} case${v !== 1 ? "s" : ""}` } },
  }), [eqData, toggleFilter]);

  const sevOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "bar", toolbar: { show: false },
      events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
          const label = sevData.keys[dataPointIndex];
          if (label) toggleFilter("severity", label);
        },
      },
    },
    colors: EQUIPMENT_COLORS,
    plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true } },
    xaxis: { categories: sevData.keys.length ? sevData.keys : ["No data"] },
    legend: { show: false },
    dataLabels: { enabled: true },
    grid: { borderColor: "#f1f5f9" },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    tooltip: { y: { formatter: (v: number) => `${v} items` } },
  }), [sevData, toggleFilter]);

  const stationBarOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "bar", stacked: true, toolbar: { show: false },
      events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
          const label = stationNames[dataPointIndex];
          if (label) toggleFilter("station", label);
        },
      },
    },
    colors: ["#f97316", "#f43f5e", "#22c55e"],
    xaxis: { categories: stationNames.length ? stationNames : ["No data"], labels: { rotate: -20, style: { fontSize: "11px" } } },
    legend: { position: "top" },
    dataLabels: { enabled: false },
    grid: { borderColor: "#f1f5f9" },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    plotOptions: { bar: { borderRadius: 3 } },
  }), [stationNames, toggleFilter]);

  const stationBarSeries = useMemo(() => [
    { name: "Open", data: stationNames.map((n) => stationData[n].open) },
    { name: "In Progress", data: stationNames.map((n) => stationData[n].inProgress) },
    { name: "Closed", data: stationNames.map((n) => stationData[n].closed) },
  ], [stationNames, stationData]);

  // ─── Status badge ─────────────────────────────────────────────────────────

  const statusBadge = (status: string) => {
    const s = normalizeStatus(status);
    if (s === "completed") return { bg: "#dcfce7", text: "#15803d", label: "Closed" };
    if (s === "in_progress") return { bg: "#fce7f3", text: "#be185d", label: "In Progress" };
    return { bg: "#ffedd5", text: "#c2410c", label: "Open" };
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="tw-flex tw-min-h-64 tw-items-center tw-justify-center">
        <div className="tw-h-10 tw-w-10 tw-animate-spin tw-rounded-full tw-border-4 tw-border-blue-500 tw-border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="tw-min-h-screen tw-bg-gray-50/60 tw-p-6">

      {/* ── Header ── */}
      <div className="tw-mb-4 tw-flex tw-flex-col tw-gap-3 sm:tw-flex-row sm:tw-items-center sm:tw-justify-between">
        <div>
          <h1 className="tw-text-2xl tw-font-bold tw-text-gray-800">Corrective Maintenance (CM)</h1>
          <p className="tw-mt-0.5 tw-text-sm tw-text-gray-500">
            ข้อมูลจาก iMPS · {rows.length} รายการทั้งหมด
            {activeFilterCount > 0 && (
              <span className="tw-ml-2 tw-font-semibold tw-text-blue-600">
                → {allFiltered.length} รายการหลังกรอง
              </span>
            )}
          </p>
        </div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      {/* ── Active filter chips ── */}
      {activeFilterCount > 0 && (
        <div className="tw-mb-4 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
          <span className="tw-text-xs tw-font-medium tw-text-gray-500">Filters:</span>
          {filters.status && <FilterChip label={`Status: ${filters.status}`} onRemove={() => clearFilter("status")} />}
          {filters.equipment && <FilterChip label={`Equipment: ${filters.equipment}`} onRemove={() => clearFilter("equipment")} />}
          {filters.severity && <FilterChip label={`Severity: ${filters.severity}`} onRemove={() => clearFilter("severity")} />}
          {filters.station && <FilterChip label={`Station: ${filters.station}`} onRemove={() => clearFilter("station")} />}
          <button onClick={clearAll} className="tw-text-xs tw-font-semibold tw-text-red-500 hover:tw-text-red-700 tw-underline">
            Clear all
          </button>
        </div>
      )}

      {/* ── Section 1: Success Rate ── */}
      <section className="tw-mb-6">
        <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-700">
            สัดส่วนความสำเร็จงาน CM
            {filters.status && <span className="tw-ml-2 tw-text-xs tw-font-normal tw-text-blue-500">(คลิกอีกครั้งเพื่อยกเลิก)</span>}
          </h2>
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
          >
            {stations.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="tw-grid tw-grid-cols-1 tw-gap-6 lg:tw-grid-cols-2">
          {/* Donut */}
          <div className="tw-relative tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-sm">
            {filters.status && (
              <div className="tw-absolute tw-right-3 tw-top-3 tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
                🔍 {filters.status}
              </div>
            )}
            <p className="tw-mb-1 tw-text-xs tw-text-gray-400">คลิกที่ส่วนของกราฟเพื่อกรอง</p>
            <Chart type="donut" options={donutOptions} series={[srStats.completed, srStats.inProgress, srStats.open]} width="100%" height={280} />
          </div>

          {/* KPI cards */}
          <div className="tw-grid tw-grid-cols-2 tw-gap-4">
            {[
              { label: "งาน CM ทั้งหมด", value: kpiStats.total, color: "linear-gradient(135deg,#3b82f6,#1d4ed8)", icon: "📋", dim: false },
              { label: "รอดำเนินการ", value: kpiStats.inProgress, color: "linear-gradient(135deg,#f43f5e,#be123c)", icon: "⏰", dim: filters.status !== null && filters.status !== STATUS_LABELS.in_progress },
              { label: "รอจัดซื้อจ้าง", value: kpiStats.open, color: "linear-gradient(135deg,#f97316,#c2410c)", icon: "⏳", dim: filters.status !== null && filters.status !== STATUS_LABELS.open },
              { label: "งานเสร็จสิ้นแล้ว", value: kpiStats.completed, color: "linear-gradient(135deg,#22c55e,#15803d)", icon: "✅", dim: filters.status !== null && filters.status !== STATUS_LABELS.completed },
            ].map((c) => <StatCard key={c.label} {...c} />)}
          </div>
        </div>
      </section>

      {/* ── Section 2: Failure Mode ── */}
      <section className="tw-mb-6">
        <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-700">Failure Mode Analysis</h2>
          <p className="tw-text-xs tw-text-gray-400">คลิกที่กราฟเพื่อกรองข้อมูล</p>
        </div>
        <div className="tw-grid tw-grid-cols-1 tw-gap-6 lg:tw-grid-cols-2">

          {/* Equipment pie */}
          <div className="tw-relative tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-sm">
            {filters.equipment && (
              <div className="tw-absolute tw-right-3 tw-top-3 tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
                🔍 {filters.equipment}
              </div>
            )}
            <p className="tw-mb-3 tw-text-sm tw-font-semibold tw-text-gray-600">
              Count of Cause of Issue (Grand Total: {eqData.vals.reduce((s, v) => s + v, 0)})
            </p>
            <Chart
              type="donut"
              options={equipOptions}
              series={eqData.vals.length ? eqData.vals : [0]}
              width="100%" height={260}
            />
          </div>

          {/* Severity bar */}
          <div className="tw-relative tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-sm">
            {filters.severity && (
              <div className="tw-absolute tw-right-3 tw-top-3 tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
                🔍 {filters.severity}
              </div>
            )}
            <p className="tw-mb-3 tw-text-sm tw-font-semibold tw-text-gray-600">Severity Distribution</p>
            <Chart
              type="bar"
              options={sevOptions}
              series={[{ name: "Count", data: sevData.vals.length ? sevData.vals : [0] }]}
              width="100%" height={260}
            />
          </div>
        </div>
      </section>

      {/* ── Section 3: Overall Status by Station ── */}
      <section className="tw-mb-6">
        <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-700">Overall Status by Station</h2>
          {filters.station && (
            <div className="tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
              🔍 {filters.station}
            </div>
          )}
        </div>
        <div className="tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-sm">
          <p className="tw-mb-2 tw-text-xs tw-text-gray-400">คลิกที่แท่งกราฟเพื่อกรองตามสถานี</p>
          <Chart type="bar" options={stationBarOptions} series={stationBarSeries} width="100%" height={280} />
        </div>
      </section>

      {/* ── Section 4: Table ── */}
      <section>
        <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-700">
            CM Reports
            <span className="tw-ml-2 tw-text-sm tw-font-normal tw-text-gray-400">({allFiltered.length} รายการ)</span>
          </h2>
          {activeFilterCount > 0 && (
            <button onClick={clearAll} className="tw-text-xs tw-font-semibold tw-text-red-500 hover:tw-text-red-700 tw-underline">
              Clear filters
            </button>
          )}
        </div>
        <div className="tw-overflow-hidden tw-rounded-2xl tw-bg-white tw-shadow-sm">
          <div className="tw-overflow-x-auto">
            <table className="tw-w-full tw-min-w-[700px] tw-table-auto tw-text-left tw-text-sm">
              <thead>
                <tr className="tw-bg-gray-50 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-gray-500">
                  {["#","Station","Issue ID","Faulty Equipment","Severity","Date","Status"].map((h) => (
                    <th key={h} className="tw-px-4 tw-py-3 tw-whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr><td colSpan={7} className="tw-p-8 tw-text-center tw-text-gray-400">ไม่พบรายงาน</td></tr>
                ) : tableRows.map((r, i) => {
                  const badge = statusBadge(r.status);
                  return (
                    <tr key={r.id} className="tw-border-t tw-border-gray-100 hover:tw-bg-blue-50/30">
                      <td className="tw-px-4 tw-py-3 tw-text-gray-400">{i + 1}</td>
                      <td className="tw-px-4 tw-py-3 tw-font-medium tw-text-gray-800">{r.station_name || r.station_id}</td>
                      <td className="tw-px-4 tw-py-3 tw-text-gray-600">{r.issue_id || "-"}</td>
                      <td className="tw-px-4 tw-py-3">
                        <button
                          onClick={() => r.faulty_equipment && toggleFilter("equipment", r.faulty_equipment)}
                          className={`tw-rounded tw-px-1.5 tw-py-0.5 tw-text-xs tw-transition-colors ${
                            filters.equipment === r.faulty_equipment
                              ? "tw-bg-blue-100 tw-text-blue-700 tw-font-bold"
                              : "tw-text-gray-600 hover:tw-bg-gray-100"
                          }`}
                        >
                          {r.faulty_equipment || "-"}
                        </button>
                      </td>
                      <td className="tw-px-4 tw-py-3">
                        <button
                          onClick={() => r.severity && toggleFilter("severity", r.severity)}
                          className={`tw-rounded tw-px-1.5 tw-py-0.5 tw-text-xs tw-transition-colors ${
                            filters.severity === r.severity
                              ? "tw-bg-blue-100 tw-text-blue-700 tw-font-bold"
                              : "tw-text-gray-600 hover:tw-bg-gray-100"
                          }`}
                        >
                          {r.severity || "-"}
                        </button>
                      </td>
                      <td className="tw-px-4 tw-py-3 tw-text-gray-500">
                        {r.cm_date ? new Date(r.cm_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                      </td>
                      <td className="tw-px-4 tw-py-3">
                        <button
                          onClick={() => toggleFilter("status", badge.label === "Closed" ? STATUS_LABELS.completed : badge.label === "In Progress" ? STATUS_LABELS.in_progress : STATUS_LABELS.open)}
                          className="tw-rounded-full tw-px-2.5 tw-py-0.5 tw-text-xs tw-font-medium tw-transition-all hover:tw-opacity-80"
                          style={{ background: badge.bg, color: badge.text, outline: filters.status ? `2px solid ${badge.text}` : "none" }}
                        >
                          {badge.label}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
