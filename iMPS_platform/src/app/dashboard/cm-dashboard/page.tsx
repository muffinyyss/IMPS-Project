"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardBody, Typography } from "@material-tailwind/react";
import { apiFetch } from "@/utils/api";
import {
  CMRow, Period, ActiveFilters, STATUS_LABELS,
  normalizeStatus, statusBadge, filterByPeriod, applyFilters, applySearch, groupCount,
} from "@/utils/cm-dashboard";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Constants ───────────────────────────────────────────────────────────────

// RAG semantics: completed=green, in_progress=orange (watch), open=red (action needed)
const DONUT_COLORS = ["#22c55e", "#f97316", "#ef4444"];
// Categorical palette for equipment — blue/cool family, no RAG meaning
const EQUIPMENT_COLORS = ["#3b82f6","#06b6d4","#8b5cf6","#0ea5e9","#a855f7","#14b8a6","#64748b","#6366f1","#0284c7","#7c3aed"];
const PAGE_SIZE = 15;

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
      <button onClick={onRemove} aria-label={`ลบตัวกรอง ${label}`} className="tw-text-blue-400 hover:tw-text-blue-700 tw-font-bold tw-text-sm tw-leading-none">
        <span aria-hidden="true">×</span>
      </button>
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

function Pagination({ page, total, pageSize, onChange, formatRange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
  formatRange?: (from: number, to: number, total: number) => string;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  // Build page numbers with ellipsis
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) pages.push(i);
  } else {
    pages.push(0);
    if (page > 2) pages.push("…");
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
    if (page < totalPages - 3) pages.push("…");
    pages.push(totalPages - 1);
  }

  return (
    <div className="tw-flex tw-flex-col tw-items-center tw-gap-3 tw-border-t tw-border-gray-100 tw-px-4 tw-py-4 sm:tw-flex-row sm:tw-justify-between">
      <p className="tw-text-xs tw-text-gray-500">
        {formatRange ? formatRange(from, to, total) : `${from}–${to} / ${total}`}
      </p>
      <div className="tw-flex tw-items-center tw-gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 0}
          aria-label="หน้าก่อนหน้า"
          className="tw-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-border tw-border-gray-200 tw-text-sm tw-text-gray-600 tw-transition-colors hover:tw-bg-gray-50 disabled:tw-cursor-not-allowed disabled:tw-opacity-40"
        >
          ‹
        </button>
        {pages.map((p, idx) =>
          p === "…" ? (
            <span key={`el${idx}`} aria-hidden="true" className="tw-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-text-xs tw-text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              aria-label={`หน้า ${(p as number) + 1}`}
              aria-current={p === page ? "page" : undefined}
              className={`tw-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-text-xs tw-font-medium tw-transition-colors ${
                p === page
                  ? "tw-bg-blue-600 tw-text-white tw-shadow-sm"
                  : "tw-border tw-border-gray-200 tw-text-gray-600 hover:tw-bg-gray-50"
              }`}
            >
              {(p as number) + 1}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages - 1}
          aria-label="หน้าถัดไป"
          className="tw-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-border tw-border-gray-200 tw-text-sm tw-text-gray-600 tw-transition-colors hover:tw-bg-gray-50 disabled:tw-cursor-not-allowed disabled:tw-opacity-40"
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const FETCH_LIMIT = 10000;

export default function CMDashboardPage() {
  const [rows, setRows] = useState<CMRow[]>([]);
  const [totalInDB, setTotalInDB] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("yearly");
  const [stationFilter, setStationFilter] = useState<string>("All");
  const [filters, setFilters] = useState<ActiveFilters>({ status: null, equipment: null, severity: null, station: null });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // ── Language ──────────────────────────────────────────────────────────────
  type Lang = "th" | "en";
  const [lang, setLang] = useState<Lang>("th");
  useEffect(() => {
    const saved = localStorage.getItem("app_language") as Lang | null;
    if (saved === "th" || saved === "en") setLang(saved);
    const handler = (e: CustomEvent<{ lang: Lang }>) => setLang(e.detail.lang);
    window.addEventListener("language:change", handler as EventListener);
    return () => window.removeEventListener("language:change", handler as EventListener);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/cmreport/list-all?limit=${FETCH_LIMIT}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`);
        setRows(Array.isArray(json?.items) ? json.items : []);
        setTotalInDB(json?.total ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleFilter = useCallback((dim: keyof ActiveFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [dim]: prev[dim] === value ? null : value }));
    setPage(0);
  }, []);

  const clearFilter = useCallback((dim: keyof ActiveFilters) => {
    setFilters((prev) => ({ ...prev, [dim]: null }));
    setPage(0);
  }, []);

  const clearAll = () => {
    setFilters({ status: null, equipment: null, severity: null, station: null });
    setSearch("");
    setPage(0);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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

  // ── KPI stat cards: all chart-filters applied
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

  // ── Table: chart-filters + search + sort + paginate
  const searchFiltered = useMemo(() => applySearch(allFiltered, search), [allFiltered, search]);
  const sortedRows = useMemo(
    () => [...searchFiltered].sort((a, b) => (b.cm_date || "").localeCompare(a.cm_date || "")),
    [searchFiltered]
  );
  const tableRows = useMemo(
    () => sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedRows, page]
  );

  // Reset page when filters or search change
  useEffect(() => { setPage(0); }, [allFiltered, search]);

  // ── Translations ─────────────────────────────────────────────────────────
  const t = useMemo(() => ({
    th: {
      pageTitle: "Corrective Maintenance (CM)",
      subtitle: (n: number) => `ข้อมูลจาก iMPS · ${n} รายการทั้งหมด`,
      afterFilter: (n: number) => `→ ${n} รายการหลังกรอง`,
      s1Title: "สัดส่วนความสำเร็จงาน CM",
      stationFilterLabel: "กรองตามสถานี",
      clickToFilter: "คลิกที่ส่วนของกราฟเพื่อกรอง",
      cancelHint: "(คลิกอีกครั้งเพื่อยกเลิก)",
      kpiTotal: "งาน CM ทั้งหมด",
      kpiInProgress: "รอดำเนินการ",
      kpiOpen: "รอจัดซื้อจ้าง",
      kpiCompleted: "งานเสร็จสิ้นแล้ว",
      s2Title: "Failure Mode Analysis",
      chartClickHint: "คลิกที่กราฟเพื่อกรองข้อมูล",
      eqTitle: "Count of Cause of Issue",
      eqSubtitle: (n: number) => `Grand Total: ${n}`,
      sevTitle: "Severity Distribution",
      s3Title: "Overall Status by Station",
      barHint: "คลิกที่แท่งกราฟเพื่อกรองตามสถานี",
      tableTitle: "CM Reports",
      tableCount: (n: number, q?: string) => `${n} รายการ${q ? ` · "${q}"` : ""}`,
      searchPlaceholder: "ค้นหา station, issue ID, equipment, severity, inspector…",
      filterLabel: "Filters:",
      clearAll: "Clear all",
      clearFilters: "Clear filters",
      pagination: (from: number, to: number, total: number) => `แสดง ${from}–${to} จาก ${total} รายการ`,
      loading: "กำลังโหลด",
      errorPrefix: "โหลดข้อมูลไม่สำเร็จ",
      noResults: (q?: string) => q ? `ไม่พบรายการที่ตรงกับ "${q}"` : "ไม่พบรายงาน",
      volumeWarning: (total: number, limit: number) => `ฐานข้อมูลมี ${total.toLocaleString()} รายการ — แสดงผล ${limit.toLocaleString()} รายการล่าสุด กราฟอาจไม่ครบทั้งหมด`,
      statusLabel: { completed: "เสร็จสิ้น", in_progress: "รอดำเนินการ", open: "รอจัดซื้อ" },
      taskUnit: "งาน",
    },
    en: {
      pageTitle: "Corrective Maintenance (CM)",
      subtitle: (n: number) => `Data from iMPS · ${n} total records`,
      afterFilter: (n: number) => `→ ${n} after filters`,
      s1Title: "CM Success Rate",
      stationFilterLabel: "Filter by station",
      clickToFilter: "Click on the chart to filter",
      cancelHint: "(click again to cancel)",
      kpiTotal: "Total CM Tasks",
      kpiInProgress: "In Progress",
      kpiOpen: "Pending Purchase",
      kpiCompleted: "Completed",
      s2Title: "Failure Mode Analysis",
      chartClickHint: "Click on a chart to filter data",
      eqTitle: "Count of Cause of Issue",
      eqSubtitle: (n: number) => `Grand Total: ${n}`,
      sevTitle: "Severity Distribution",
      s3Title: "Overall Status by Station",
      barHint: "Click on a bar to filter by station",
      tableTitle: "CM Reports",
      tableCount: (n: number, q?: string) => `${n} records${q ? ` · "${q}"` : ""}`,
      searchPlaceholder: "Search by station, issue ID, equipment, severity, inspector…",
      filterLabel: "Filters:",
      clearAll: "Clear all",
      clearFilters: "Clear filters",
      pagination: (from: number, to: number, total: number) => `Showing ${from}–${to} of ${total} records`,
      loading: "Loading",
      errorPrefix: "Failed to load data",
      noResults: (q?: string) => q ? `No records matching "${q}"` : "No reports found",
      volumeWarning: (total: number, limit: number) => `Database has ${total.toLocaleString()} records — showing latest ${limit.toLocaleString()}. Charts may be incomplete.`,
      statusLabel: { completed: "Closed", in_progress: "In Progress", open: "Open" },
      taskUnit: "tasks",
    },
  }[lang]), [lang]);

  // Maps STATUS_LABELS value (Thai key) → translated display string for filter chips
  const displayStatus = useMemo(() => (s: string | null) => {
    if (!s) return s;
    const key = Object.entries(STATUS_LABELS).find(([, v]) => v === s)?.[0] as keyof typeof t.statusLabel | undefined;
    return key ? t.statusLabel[key] : s;
  }, [t]);

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
    labels: [t.statusLabel.completed, t.statusLabel.in_progress, t.statusLabel.open],
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
    tooltip: { y: { formatter: (v: number) => `${v} ${t.taskUnit}` } },
  }), [successRate, toggleFilter, t]);

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

  const sevOptions = useMemo<ApexCharts.ApexOptions>(() => {
    const sevColors = sevData.keys.map((k) => {
      const lk = k.toLowerCase();
      if (lk.includes("high") || lk.includes("critical")) return "#ef4444";
      if (lk.includes("medium") || lk.includes("moderate")) return "#f97316";
      if (lk.includes("low")) return "#22c55e";
      return "#64748b";
    });
    return ({
    chart: {
      type: "bar", toolbar: { show: false },
      events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
          const label = sevData.keys[dataPointIndex];
          if (label) toggleFilter("severity", label);
        },
      },
    },
    colors: sevColors.length ? sevColors : EQUIPMENT_COLORS,
    plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: true } },
    xaxis: { categories: sevData.keys.length ? sevData.keys : ["No data"] },
    legend: { show: false },
    dataLabels: { enabled: true },
    grid: { borderColor: "#f1f5f9" },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    tooltip: { y: { formatter: (v: number) => `${v} items` } },
  });
  }, [sevData, toggleFilter]);

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
    colors: ["#ef4444", "#f97316", "#22c55e"],
    xaxis: { categories: stationNames.length ? stationNames : ["No data"], labels: { rotate: -20, style: { fontSize: "11px" } } },
    legend: { position: "top" },
    dataLabels: { enabled: false },
    grid: { borderColor: "#f1f5f9" },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    plotOptions: { bar: { borderRadius: 3 } },
  }), [stationNames, toggleFilter]);

  const stationBarSeries = useMemo(() => [
    { name: t.statusLabel.open, data: stationNames.map((n) => stationData[n].open) },
    { name: t.statusLabel.in_progress, data: stationNames.map((n) => stationData[n].inProgress) },
    { name: t.statusLabel.completed, data: stationNames.map((n) => stationData[n].closed) },
  ], [stationNames, stationData, t]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div role="status" aria-label={t.loading} className="tw-flex tw-min-h-64 tw-items-center tw-justify-center">
        <div aria-hidden="true" className="tw-h-10 tw-w-10 tw-animate-spin tw-rounded-full tw-border-4 tw-border-blue-500 tw-border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="tw-min-h-screen tw-bg-gray-50/60 tw-p-6">

      {/* ── Volume warning (> FETCH_LIMIT records) ── */}
      {totalInDB > FETCH_LIMIT && (
        <div className="tw-mb-4 tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-4 tw-py-3 tw-text-sm tw-text-amber-700">
          <span className="tw-text-base">⚡</span>
          <span>
            {t.volumeWarning(totalInDB, FETCH_LIMIT)}
          </span>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="tw-mb-4 tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-red-200 tw-bg-red-50 tw-px-4 tw-py-3 tw-text-sm tw-text-red-700">
          <span className="tw-text-base">⚠️</span>
          <span>{t.errorPrefix}: <strong>{error}</strong></span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="tw-mb-4 tw-flex tw-flex-col tw-gap-3 sm:tw-flex-row sm:tw-items-center sm:tw-justify-between">
        <div>
          <h1 className="tw-text-2xl tw-font-bold tw-text-gray-800">{t.pageTitle}</h1>
          <p className="tw-mt-0.5 tw-text-sm tw-text-gray-500">
            {t.subtitle(rows.length)}
            {activeFilterCount > 0 && (
              <span className="tw-ml-2 tw-font-semibold tw-text-blue-600">
                {t.afterFilter(allFiltered.length)}
              </span>
            )}
          </p>
        </div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      {/* ── Active filter chips ── */}
      {activeFilterCount > 0 && (
        <div className="tw-mb-4 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
          <span className="tw-text-xs tw-font-medium tw-text-gray-500">{t.filterLabel}</span>
          {filters.status && <FilterChip label={`Status: ${displayStatus(filters.status)}`} onRemove={() => clearFilter("status")} />}
          {filters.equipment && <FilterChip label={`Equipment: ${filters.equipment}`} onRemove={() => clearFilter("equipment")} />}
          {filters.severity && <FilterChip label={`Severity: ${filters.severity}`} onRemove={() => clearFilter("severity")} />}
          {filters.station && <FilterChip label={`Station: ${filters.station}`} onRemove={() => clearFilter("station")} />}
          <button onClick={clearAll} aria-label="ลบตัวกรองทั้งหมด" className="tw-text-xs tw-font-semibold tw-text-red-500 hover:tw-text-red-700 tw-underline">
            {t.clearAll}
          </button>
        </div>
      )}

      {/* ── Section 1: Success Rate ── */}
      <section className="tw-mb-6">
        <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-700">
            {t.s1Title}
            {filters.status && <span className="tw-ml-2 tw-text-xs tw-font-normal tw-text-blue-500">{t.cancelHint}</span>}
          </h2>
          <label className="tw-sr-only" htmlFor="station-filter">{t.stationFilterLabel}</label>
          <select
            id="station-filter"
            value={stationFilter}
            onChange={(e) => { setStationFilter(e.target.value); setPage(0); }}
            className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
          >
            {stations.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="tw-grid tw-grid-cols-1 tw-gap-6 lg:tw-grid-cols-2">
          {/* Donut */}
          <Card className="tw-relative tw-border tw-border-blue-gray-100 tw-shadow-sm">
            {filters.status && (
              <div className="tw-absolute tw-right-3 tw-top-3 tw-z-10 tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
                🔍 {filters.status}
              </div>
            )}
            <CardHeader floated={false} shadow={false} className="tw-m-4 tw-mb-0">
              <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-500">
                {t.clickToFilter}
              </Typography>
            </CardHeader>
            <CardBody className="!tw-px-4 !tw-pt-2 !tw-pb-4">
              <Chart type="donut" options={donutOptions} series={[srStats.completed, srStats.inProgress, srStats.open]} width="100%" height={280} />
            </CardBody>
          </Card>

          {/* KPI cards */}
          <div className="tw-grid tw-grid-cols-2 tw-gap-4">
            {[
              { label: t.kpiTotal, value: kpiStats.total, color: "linear-gradient(135deg,#3b82f6,#1d4ed8)", icon: "📋", dim: false },
              { label: t.kpiInProgress, value: kpiStats.inProgress, color: "linear-gradient(135deg,#f97316,#ea580c)", icon: "⏰", dim: filters.status !== null && filters.status !== STATUS_LABELS.in_progress },
              { label: t.kpiOpen, value: kpiStats.open, color: "linear-gradient(135deg,#ef4444,#dc2626)", icon: "⏳", dim: filters.status !== null && filters.status !== STATUS_LABELS.open },
              { label: t.kpiCompleted, value: kpiStats.completed, color: "linear-gradient(135deg,#22c55e,#15803d)", icon: "✅", dim: filters.status !== null && filters.status !== STATUS_LABELS.completed },
            ].map((c) => <StatCard key={c.label} {...c} />)}
          </div>
        </div>
      </section>

      {/* ── Section 2: Failure Mode ── */}
      <section className="tw-mb-6">
        <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-700">{t.s2Title}</h2>
          <p className="tw-text-xs tw-text-gray-400">{t.chartClickHint}</p>
        </div>
        <div className="tw-grid tw-grid-cols-1 tw-gap-6 lg:tw-grid-cols-2">

          {/* Equipment pie */}
          <Card className="tw-relative tw-border tw-border-blue-gray-100 tw-shadow-sm">
            {filters.equipment && (
              <div className="tw-absolute tw-right-3 tw-top-3 tw-z-10 tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
                🔍 {filters.equipment}
              </div>
            )}
            <CardHeader floated={false} shadow={false} className="tw-m-4 tw-mb-0">
              <Typography variant="h6" color="blue-gray">
                {t.eqTitle}
              </Typography>
              <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-500">
                {t.eqSubtitle(eqData.vals.reduce((s, v) => s + v, 0))}
              </Typography>
            </CardHeader>
            <CardBody className="!tw-px-4 !tw-pt-2 !tw-pb-4">
              <Chart
                type="donut"
                options={equipOptions}
                series={eqData.vals.length ? eqData.vals : [0]}
                width="100%" height={260}
              />
            </CardBody>
          </Card>

          {/* Severity bar */}
          <Card className="tw-relative tw-border tw-border-blue-gray-100 tw-shadow-sm">
            {filters.severity && (
              <div className="tw-absolute tw-right-3 tw-top-3 tw-z-10 tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
                🔍 {filters.severity}
              </div>
            )}
            <CardHeader floated={false} shadow={false} className="tw-m-4 tw-mb-0">
              <Typography variant="h6" color="blue-gray">
                {t.sevTitle}
              </Typography>
            </CardHeader>
            <CardBody className="!tw-px-4 !tw-pt-2 !tw-pb-4">
              <Chart
                type="bar"
                options={sevOptions}
                series={[{ name: "Count", data: sevData.vals.length ? sevData.vals : [0] }]}
                width="100%" height={260}
              />
            </CardBody>
          </Card>
        </div>
      </section>

      {/* ── Section 3: Overall Status by Station ── */}
      <section className="tw-mb-6">
        <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-700">{t.s3Title}</h2>
          {filters.station && (
            <div className="tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
              🔍 {filters.station}
            </div>
          )}
        </div>
        <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm">
          <CardHeader floated={false} shadow={false} className="tw-m-4 tw-mb-0">
            <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-400">
              {t.barHint}
            </Typography>
          </CardHeader>
          <CardBody className="!tw-px-4 !tw-pt-2 !tw-pb-4">
            <Chart type="bar" options={stationBarOptions} series={stationBarSeries} width="100%" height={280} />
          </CardBody>
        </Card>
      </section>

      {/* ── Section 4: Table ── */}
      <section>
        {/* Table header */}
        <div className="tw-mb-3 tw-flex tw-flex-col tw-gap-3 sm:tw-flex-row sm:tw-items-center sm:tw-justify-between">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-700">
            {t.tableTitle}
            <span className="tw-ml-2 tw-text-sm tw-font-normal tw-text-gray-400">
              ({t.tableCount(searchFiltered.length, search || undefined)})
            </span>
          </h2>
          {activeFilterCount > 0 && (
            <button onClick={clearAll} className="tw-self-start tw-text-xs tw-font-semibold tw-text-red-500 hover:tw-text-red-700 tw-underline sm:tw-self-auto">
              {t.clearFilters}
            </button>
          )}
        </div>

        {/* Search bar */}
        <div className="tw-mb-3 tw-relative">
          <span className="tw-absolute tw-left-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-gray-400 tw-text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="tw-w-full tw-rounded-xl tw-border tw-border-gray-200 tw-bg-white tw-py-2.5 tw-pl-9 tw-pr-4 tw-text-sm tw-text-gray-700 tw-shadow-sm tw-transition-all focus:tw-border-blue-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-100"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setPage(0); }}
              aria-label="ล้างคำค้นหา"
              className="tw-absolute tw-right-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-gray-400 hover:tw-text-gray-600 tw-text-lg tw-leading-none"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>

        <Card className="tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-shadow-sm">
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
                  <tr>
                    <td colSpan={7} className="tw-p-8 tw-text-center tw-text-gray-400">
                      {t.noResults(search || undefined)}
                    </td>
                  </tr>
                ) : tableRows.map((r, i) => {
                  const badge = statusBadge(r.status);
                  return (
                    <tr key={r.id} className="tw-border-t tw-border-gray-100 hover:tw-bg-blue-50/30">
                      <td className="tw-px-4 tw-py-3 tw-text-gray-400">{page * PAGE_SIZE + i + 1}</td>
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
          <Pagination
            page={page}
            total={searchFiltered.length}
            pageSize={PAGE_SIZE}
            onChange={setPage}
            formatRange={t.pagination}
          />
        </Card>
      </section>
    </main>
  );
}
