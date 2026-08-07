"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, Typography } from "@material-tailwind/react";
import { apiFetch } from "@/utils/api";
import useLanguage from "@/utils/useLanguage";
import {
  CMRow, ActiveFilters, DateSel, STATUS_LABELS, WorkStatusFilter, EMPTY_FILTERS,
  normalizeStatus, workStatusOf, workStatusBadge, filterByDate, listYears,
  excludeCancelled, isCancelled,
  weeksInMonth, applyFilters, applySearch, groupCount, groupCountMulti, groupByMonth,
  causeLabelsOf, remedyCodesOf, remedyDescriptionsOf,
} from "@/utils/cm-dashboard";
import { remedyLabel, remedyCodeOfDescription } from "@/utils/cm-failure-codes";
import { CM_ORIGIN_DASHBOARD } from "@/app/dashboard/cm-report/lib/origin";
import {
  CheckCircleIcon, ClockIcon, DocumentTextIcon,
  ExclamationTriangleIcon, ShoppingCartIcon, XCircleIcon,
} from "@heroicons/react/24/outline";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Constants ───────────────────────────────────────────────────────────────

// RAG semantics: completed=green, in_progress=orange (watch), open=red (action needed)
const DONUT_COLORS = ["#22c55e", "#f97316", "#ef4444"];
// Categorical palette for causes / equipment — blue/cool family, no RAG meaning
const EQUIPMENT_COLORS = ["#3b82f6","#06b6d4","#8b5cf6","#0ea5e9","#a855f7","#14b8a6","#64748b","#6366f1","#0284c7","#7c3aed"];
// Remedy = ce qui a été fait (pas un état) → famille chaude, distincte des causes
const REMEDY_COLORS = ["#f59e0b","#ec4899","#f97316","#d946ef","#eab308","#fb7185","#c026d3","#f43f5e","#ca8a04","#e11d48"];
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

// สถานะ (raw) + stage → slug ของแท็บในหน้า CM Report (open / in-progress / closed)
// "Wait for approve" มี 2 ด่าน ต้องแยกด้วย stage ไม่งั้นจะเปิดฟอร์มผิดใบ:
//   • cs_approval   = cs เพิ่งเปิดเคส รอ head cs อนุมัติ        → แท็บ Open (ฟอร์มเปิดงาน/วางแผนให้ engineer)
//   • close_approval = ช่างกรอกผลซ่อม "แก้ไขสำเร็จ" รออนุมัติปิดงาน → แท็บ In Progress (ฟอร์มผลการซ่อม)
// ใบเก่าที่ไม่มี stage ให้ถือเป็นด่านปิดงาน — ตรงกับเงื่อนไขกรองของ open-table/inprogress-table
function statusSlug(status: string, stage?: string): "open" | "in-progress" | "closed" | "cancelled" {
  const raw = (status || "").trim().toLowerCase();
  if (raw === "wait for approve") {
    return (stage || "").trim().toLowerCase() === "cs_approval" ? "open" : "in-progress";
  }
  const s = normalizeStatus(status);
  if (s === "cancelled") return "cancelled";
  return s === "completed" ? "closed" : s === "in_progress" ? "in-progress" : "open";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// การ์ด KPI — วางเป็นกริดข้างโดนัท Success Rate คลิกเพื่อกรองทั้งแดชบอร์ด
function StatCard({ label, value, color, Icon, dim, active, onClick }: {
  label: string; value: number | string; color: string;
  Icon: React.ComponentType<{ className?: string }>; dim: boolean;
  active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={`tw-flex tw-h-full tw-min-w-0 tw-items-center tw-justify-between tw-gap-3 tw-rounded-2xl tw-p-4 tw-text-left tw-text-white tw-shadow-md tw-transition-all ${
        onClick ? "hover:tw-shadow-xl hover:tw-brightness-105 focus:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-blue-400 focus-visible:tw-ring-offset-2" : "tw-cursor-default"
      } ${active ? "tw-ring-2 tw-ring-blue-500 tw-ring-offset-2" : ""}`}
      style={{ background: color, opacity: dim ? 0.45 : 1 }}
    >
      <div className="tw-min-w-0">
        <p className="tw-text-[13px] tw-font-semibold tw-leading-snug tw-opacity-95" title={label}>{label}</p>
        <p className="tw-mt-1.5 tw-text-3xl tw-font-extrabold tw-leading-none">{value}</p>
      </div>
      <span className="tw-flex tw-h-11 tw-w-11 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-xl tw-bg-white/20">
        <Icon className="tw-h-6 tw-w-6" />
      </span>
    </button>
  );
}

// เมื่อไม่มีข้อมูลในช่วงที่เลือก — แสดงข้อความแทนกราฟเปล่า (สูงเท่ากราฟ แถวไม่ขยับ)
function EmptyChart({ message, height = 260 }: { message: string; height?: number }) {
  return (
    <div style={{ height }} className="tw-flex tw-items-center tw-justify-center tw-text-sm tw-text-gray-400">
      {message}
    </div>
  );
}

function FilterChip({ label, onRemove, lang = "th" }: { label: string; onRemove: () => void; lang?: "th" | "en" }) {
  return (
    <span className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-bg-blue-100 tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-text-blue-700">
      {label}
      <button onClick={onRemove} aria-label={lang === "th" ? `ลบตัวกรอง ${label}` : `Remove filter ${label}`} className="tw-text-blue-400 hover:tw-text-blue-700 tw-font-bold tw-text-sm tw-leading-none">
        <span aria-hidden="true">×</span>
      </button>
    </span>
  );
}

// สามดรอปดาวน์เลือกช่วงวิเคราะห์: ปี / เดือน / สัปดาห์ของเดือน
function DateSelect({ id, label, value, onChange, options, disabled }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean;
}) {
  return (
    <div className="tw-flex tw-items-center tw-gap-1.5">
      <label htmlFor={id} className="tw-text-xs tw-font-medium tw-text-gray-500">{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400 disabled:tw-cursor-not-allowed disabled:tw-bg-gray-50 disabled:tw-text-gray-400"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Pagination({ page, total, pageSize, onChange, formatRange, lang = "th" }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
  formatRange?: (from: number, to: number, total: number) => string;
  lang?: "th" | "en";
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
          aria-label={lang === "th" ? "หน้าก่อนหน้า" : "Previous page"}
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
              aria-label={lang === "th" ? `หน้า ${(p as number) + 1}` : `Page ${(p as number) + 1}`}
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
          aria-label={lang === "th" ? "หน้าถัดไป" : "Next page"}
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
  const [yearSel, setYearSel] = useState<DateSel>(new Date().getFullYear());
  const [monthSel, setMonthSel] = useState<DateSel>("all");
  const [weekSel, setWeekSel] = useState<DateSel>("all");
  const [stationFilter, setStationFilter] = useState<string>("All");
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const router = useRouter();

  // คลิกแถวในตาราง → เปิดใบงาน CM ในหน้า CM Report (แท็บตามสถานะ) + โชว์ชื่อสถานีบน navbar แทน badge ตู้ชาร์จ
  const openReport = useCallback((r: CMRow) => {
    if (!r.id) return;
    const stationName = r.station_name || r.station_id;
    if (r.station_id) localStorage.setItem("selected_station_id", r.station_id);
    localStorage.setItem("selected_station_name", stationName);
    localStorage.removeItem("selected_sn");
    localStorage.removeItem("selected_charger_no");
    window.dispatchEvent(new CustomEvent("station:selected"));
    const params = new URLSearchParams({
      tab: statusSlug(r.status, r.stage),
      station_id: r.station_id || "",
      view: "form",
      edit_id: r.id,
      // บอกฟอร์มว่าเข้ามาจากหน้านี้ → ปุ่มย้อนกลับพากลับมาที่ dashboard ไม่ใช่ตาราง CM Report
      from: CM_ORIGIN_DASHBOARD,
    });
    router.push(`/dashboard/cm-report?${params.toString()}`);
  }, [router]);

  // เคลียร์ charger ที่เลือกไว้ → sidenav กลับสู่เมนูปกติ (เหมือนหน้า Stations/PM-all)
  useEffect(() => { localStorage.removeItem("selected_sn"); localStorage.removeItem("selected_charger_no"); window.dispatchEvent(new CustomEvent("charger:deselected")); }, []);

  // ── Language ──────────────────────────────────────────────────────────────
  const { lang } = useLanguage();

  // role CS เห็นหน้านี้ได้ แต่ให้เห็นเฉพาะตารางใบงาน — กราฟ/KPI วิเคราะห์ซ่อนไว้
  const [userRole, setUserRole] = useState("");
  const isCsOnly = userRole.trim().toLowerCase() === "cs";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch(`/me`);
        if (!res.ok) return;
        const user = await res.json();
        if (alive) setUserRole(user?.role ?? "");
      } catch (err) {
        console.error("fetch /me error:", err);
      }
    })();
    return () => { alive = false; };
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
    setFilters((prev) => ({ ...prev, [dim]: prev[dim] === value ? null : value } as ActiveFilters));
    setPage(0);
  }, []);

  const clearFilter = useCallback((dim: keyof ActiveFilters) => {
    setFilters((prev) => ({ ...prev, [dim]: null }));
    setPage(0);
  }, []);

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setPage(0);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const stations = useMemo(() => {
    const names = Array.from(new Set(rows.map((r) => r.station_name || r.station_id))).filter(Boolean);
    return ["All", ...names];
  }, [rows]);

  const years = useMemo(() => listYears(rows), [rows]);
  const weekCount = useMemo(
    () => (yearSel !== "all" && monthSel !== "all" ? weeksInMonth(yearSel, monthSel) : 0),
    [yearSel, monthSel]
  );

  const setYear = (v: string) => { setYearSel(v === "all" ? "all" : Number(v)); setWeekSel("all"); setPage(0); };
  const setMonth = (v: string) => { setMonthSel(v === "all" ? "all" : Number(v)); setWeekSel("all"); setPage(0); };
  const setWeek = (v: string) => { setWeekSel(v === "all" ? "all" : Number(v)); setPage(0); };

  const stationRows = useMemo(
    () => (stationFilter === "All" ? rows : rows.filter((r) => (r.station_name || r.station_id) === stationFilter)),
    [rows, stationFilter]
  );

  const periodRows = useMemo(
    () => filterByDate(stationRows, yearSel, monthSel, weekSel),
    [stationRows, yearSel, monthSel, weekSel]
  );

  // ── ใบที่ถูกยกเลิกไม่ใช่ภาระงานซ่อม — ตัดออกจากทุกกราฟและ KPI (ยังเห็นในตารางด้านล่าง)
  //    ถ้าไม่ตัด ใบยกเลิกจะไปโผล่เป็น "รอจัดซื้อ"/"New SR" แล้วฉุด success rate กับ completion rate ลง
  const activeRows = useMemo(() => excludeCancelled(periodRows), [periodRows]);

  // ── Monthly stacked chart: filtre année + station + chart-filters, mais PAS le mois/semaine
  // (เห็นครบ 12 เดือนเสมอ — คลิกแท่งเพื่อเลือกเดือน)
  const monthRows = useMemo(
    () => applyFilters(excludeCancelled(filterByDate(stationRows, yearSel, "all", "all")), filters),
    [stationRows, yearSel, filters]
  );
  const monthData = useMemo(() => groupByMonth(monthRows), [monthRows]);

  // ── Success Rate: ignores its own status filter so donut shows context
  const srRows = useMemo(() => applyFilters(activeRows, filters, "status"), [activeRows, filters]);
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

  // ── Cause donut (« Count of Cause of Issue ») : compte les CAUSE CODE des fiches CM,
  //    une fiche à deux causes compte dans les deux tranches. Ignore son propre filtre.
  const causeRows = useMemo(() => applyFilters(activeRows, filters, "cause"), [activeRows, filters]);
  const causeData = useMemo(() => groupCountMulti(causeRows, causeLabelsOf), [causeRows]);

  // ── Remedy donut : réparti par REMEDY CODE (Replace / Repair / Reset…). Ignore son propre filtre.
  const remedyRows = useMemo(() => applyFilters(activeRows, filters, "remedy"), [activeRows, filters]);
  const remedyData = useMemo(() => groupCountMulti(remedyRows, remedyCodesOf, 10), [remedyRows]);

  // ── Bar de détail : REMEDY DESCRIPTION. Sans sélection il agrège toutes les catégories ;
  //    un clic sur une tranche du donut le restreint à cette seule catégorie.
  const activeRemedy = filters.remedy;
  const remedyDetail = useMemo(() => {
    const rows = applyFilters(activeRows, filters);
    return groupCountMulti(
      rows,
      activeRemedy
        ? (r) => remedyDescriptionsOf(r, activeRemedy)
        : (r) => Array.from(new Set(remedyCodesOf(r).flatMap((code) => remedyDescriptionsOf(r, code)))),
      10
    );
  }, [activeRows, filters, activeRemedy]);

  // จำนวนใบที่ยกเลิก — ไม่ได้อยู่ใน srStats/kpiStats เพราะถูกตัดออกจากกราฟไปแล้ว
  // นับจาก periodRows เต็ม โดยยกเว้นตัวกรองเดียวกับที่ผู้ใช้ตัวนั้นใช้ (ปุ่มกรองสถานะ vs การ์ด KPI)
  const cancelledCount = useMemo(
    () => applyFilters(periodRows, filters, "status").filter(isCancelled).length,
    [periodRows, filters]
  );
  const kpiCancelled = useMemo(
    () => applyFilters(periodRows, filters, "workStatus").filter(isCancelled).length,
    [periodRows, filters]
  );

  // ── Severity bar: ignores own severity filter
  const sevRows = useMemo(() => applyFilters(activeRows, filters, "severity"), [activeRows, filters]);
  const sevData = useMemo(() => groupCount(sevRows, "severity"), [sevRows]);

  // ── Table: ตารางด้านล่างยังโชว์ใบที่ยกเลิกด้วย (ป้ายสีเทา) — ใช้ periodRows เต็ม ไม่ใช่ activeRows
  const allFiltered = useMemo(() => applyFilters(periodRows, filters), [periodRows, filters]);
  // ── KPI stat cards (7 ใบ + completion rate): all chart-filters applied
  // แถว KPI ไม่กรองด้วย workStatus ของตัวเอง — ตัวเลขครบทุก bucket เสมอ (เหมือน donut กับ status)
  const kpiRows = useMemo(() => applyFilters(activeRows, filters, "workStatus"), [activeRows, filters]);
  const kpiStats = useMemo(() => {
    const counts = {
      total: kpiRows.length,
      newSr: 0, waitManpower: 0, waitSparepart: 0, waitApprove: 0,
      waitSiteAccess: 0, inProgress: 0, completed: 0,
    };
    for (const r of kpiRows) {
      const s = workStatusOf(r);
      if (s === "new") counts.newSr++;
      else if (s === "wait_manpower") counts.waitManpower++;
      else if (s === "wait_sparepart") counts.waitSparepart++;
      else if (s === "wait_approve") counts.waitApprove++;
      else if (s === "wait_site_access") counts.waitSiteAccess++;
      else if (s === "in_progress") counts.inProgress++;
      else if (s === "completed") counts.completed++;
    }
    // Completion rate = WO completed ÷ (Total SR − wait spare part − wait site access) × 100
    const denom = counts.total - counts.waitSparepart - counts.waitSiteAccess;
    const completionRate = denom > 0 ? Math.round((counts.completed / denom) * 100) : 0;
    // « All work order » = toutes les SR devenues des WO (tout sauf le bucket "new")
    const allWo = counts.total - counts.newSr;
    return { ...counts, allWo, completionRate };
  }, [kpiRows]);

  // ── Table: chart-filters + search + sort + paginate
  const searchFiltered = useMemo(() => applySearch(allFiltered, search), [allFiltered, search]);
  const sortedRows = useMemo(
    () => [...searchFiltered].sort((a, b) => (b.cm_date || "").localeCompare(a.cm_date || "")),
    [searchFiltered]
  );
  const tableRows = useMemo(
    () => sortedRows.slice(page * pageSize, (page + 1) * pageSize),
    [sortedRows, page, pageSize]
  );

  // Reset page when filters or search change
  useEffect(() => { setPage(0); }, [allFiltered, search]);

  const commitPageSize = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return;
    setPageSize(Math.min(n, MAX_PAGE_SIZE));
    setPage(0);
  };

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
      kpiTotalSR: "SR ทั้งหมด",
      kpiAllWO: "WO ทั้งหมด",
      kpiNewSR: "SR ใหม่",
      kpiWaitManpower: "WO รอกำหนดการ",
      kpiWaitSparepart: "WO รออะไหล่",
      kpiWaitApprove: "WO รออนุมัติ",
      kpiCompleted: "WO เสร็จสิ้น",
      kpiWaitSiteAccess: "WO รอเข้าพื้นที่",
      kpiCancelled: "WO ยกเลิก",
      kpiCompletionRate: "อัตรางานเสร็จ",
      yearLabel: "ปี",
      monthLabel: "เดือน",
      weekLabel: "สัปดาห์",
      allYears: "ทุกปี",
      allMonths: "ทุกเดือน",
      allWeeks: "ทุกสัปดาห์",
      weekOption: (n: number) => `สัปดาห์ที่ ${n}`,
      monthsShort: ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."],
      monthsLong: ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"],
      s2Title: "Failure Mode Analysis",
      chartClickHint: "คลิกที่กราฟเพื่อกรองข้อมูล",
      eqTitle: "Count of Cause of Issue",
      eqSubtitle: (n: number) => `Grand Total: ${n}`,
      sevTitle: "Severity Distribution",
      s4Title: "การแก้ไข (Remedy Analysis)",
      remedyTitle: "Count of Remedy",
      remedySubtitle: (n: number) => `Grand Total: ${n}`,
      remedyDetailTitle: (label: string) => `รายละเอียดการแก้ไข — ${label}`,
      remedyAllLabel: "ทุกการแก้ไข",
      remedyDetailHint: "คลิกที่ส่วนของกราฟวงกลมเพื่อกรองรายละเอียด",
      remedyEmpty: "ยังไม่มีข้อมูลการแก้ไข",
      noChartData: "ไม่มีข้อมูลในช่วงที่เลือก",
      s3Title: "สถานะรวมรายเดือน (Overall Status by Month)",
      barHint: "คลิกที่แท่งกราฟเพื่อเลือกเดือน",
      rowsPerPage: "แถวต่อหน้า",
      statusFilterLabel: "กรองตามสถานะ",
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
      statusLabel: { completed: "เสร็จสิ้น", in_progress: "รอดำเนินการ", open: "รอจัดซื้อ", cancelled: "ยกเลิก" },
      taskUnit: "งาน",
      clearAllAria: "ลบตัวกรองทั้งหมด",
      clearSearchAria: "ล้างคำค้นหา",
      openReportTitle: "เปิดใบงาน CM",
      quickOpen: "รอจัดซื้อ",
      quickInProgress: "รอดำเนินการ",
      quickComplete: "เสร็จสิ้น",
      quickCancelled: "ยกเลิก",
      tableHeaders: ["#", "สถานี", "รหัสเอกสาร", "อุปกรณ์ที่ผิดปกติ", "ปัญหาที่พบ", "ความรุนแรง", "วันที่", "สถานะ"],
    },
    en: {
      pageTitle: "Corrective Maintenance (CM)",
      subtitle: (n: number) => `Data from iMPS · ${n} total records`,
      afterFilter: (n: number) => `→ ${n} after filters`,
      s1Title: "CM Success Rate",
      stationFilterLabel: "Filter by station",
      clickToFilter: "Click on the chart to filter",
      cancelHint: "(click again to cancel)",
      kpiTotalSR: "Total service requests",
      kpiAllWO: "All work order",
      kpiNewSR: "New service requests",
      kpiWaitManpower: "WO wait for scheduled",
      kpiWaitSparepart: "WO wait for material",
      kpiWaitApprove: "WO wait for approve",
      kpiCompleted: "WO completed",
      kpiWaitSiteAccess: "WO wait for site condition",
      kpiCancelled: "WO cancelled",
      kpiCompletionRate: "Completion rate",
      yearLabel: "Year",
      monthLabel: "Month",
      weekLabel: "Week",
      allYears: "All years",
      allMonths: "All months",
      allWeeks: "All weeks",
      weekOption: (n: number) => `Week ${n}`,
      monthsShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
      monthsLong: ["January","February","March","April","May","June","July","August","September","October","November","December"],
      s2Title: "Failure Mode Analysis",
      chartClickHint: "Click on a chart to filter data",
      eqTitle: "Count of Cause of Issue",
      eqSubtitle: (n: number) => `Grand Total: ${n}`,
      sevTitle: "Severity Distribution",
      s4Title: "Remedy Analysis",
      remedyTitle: "Count of Remedy",
      remedySubtitle: (n: number) => `Grand Total: ${n}`,
      remedyDetailTitle: (label: string) => `Remedy detail — ${label}`,
      remedyAllLabel: "All remedies",
      remedyDetailHint: "Click a slice of the pie to filter the detail",
      remedyEmpty: "No remedy recorded yet",
      noChartData: "No data for the selected period",
      s3Title: "Overall Status by Month",
      barHint: "Click on a bar to select the month",
      rowsPerPage: "Rows per page",
      statusFilterLabel: "Filter by status",
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
      statusLabel: { completed: "Complete", in_progress: "In Progress", open: "Open", cancelled: "Cancelled" },
      taskUnit: "tasks",
      clearAllAria: "Clear all filters",
      clearSearchAria: "Clear search",
      openReportTitle: "Open CM work order",
      quickOpen: "Open",
      quickInProgress: "In Progress",
      quickComplete: "Complete",
      quickCancelled: "Cancelled",
      tableHeaders: ["#", "Station", "Issue ID", "Faulty Equipment", "Problem Found", "Severity", "Date", "Status"],
    },
  }[lang]), [lang]);

  // legend ใต้โดนัท — สี/ลำดับต้องตรงกับ DONUT_COLORS และ series ที่ส่งเข้ากราฟ
  // (ต้องอยู่หลัง t ที่ประกาศไว้ด้านบน ไม่งั้นชน TDZ ตอน render)
  const srLegend = useMemo(() => {
    const pct = (n: number) => (srStats.total === 0 ? 0 : Math.round((n / srStats.total) * 100));
    return [
      { key: "completed", label: t.statusLabel.completed, color: DONUT_COLORS[0], pct: pct(srStats.completed) },
      { key: "in_progress", label: t.statusLabel.in_progress, color: DONUT_COLORS[1], pct: pct(srStats.inProgress) },
      { key: "open", label: t.statusLabel.open, color: DONUT_COLORS[2], pct: pct(srStats.open) },
    ] as const;
  }, [srStats, t]);

  // Maps STATUS_LABELS value (Thai key) → translated display string for filter chips
  const displayStatus = useMemo(() => (s: string | null) => {
    if (!s) return s;
    const key = Object.entries(STATUS_LABELS).find(([, v]) => v === s)?.[0] as keyof typeof t.statusLabel | undefined;
    return key ? t.statusLabel[key] : s;
  }, [t]);

  // การ์ด KPI — ws = bucket ที่คลิกแล้วกรอง, coarse = สถานะ 3 กลุ่มไว้หรี่การ์ดตอนกรองจาก donut
  type KpiCard = {
    label: string; value: number | string; color: string;
    Icon: React.ComponentType<{ className?: string }>;
    ws?: WorkStatusFilter; coarse?: string; clearsWorkStatus?: boolean;
  };
  // 6 ใบตามดีไซน์ — อัตราความสำเร็จอ่านจากกลางโดนัทแทนการ์ด
  const kpiCards: KpiCard[] = [
    { label: t.kpiAllWO, value: kpiStats.allWo, color: "linear-gradient(135deg,#3b82f6,#1d4ed8)", Icon: DocumentTextIcon, ws: "wo_all" },
    { label: t.kpiWaitManpower, value: kpiStats.waitManpower, color: "linear-gradient(135deg,#fb7185,#e11d48)", Icon: ClockIcon, ws: "wait_manpower", coarse: STATUS_LABELS.open },
    { label: t.kpiWaitSparepart, value: kpiStats.waitSparepart, color: "linear-gradient(135deg,#fbbf24,#d97706)", Icon: ShoppingCartIcon, ws: "wait_sparepart", coarse: STATUS_LABELS.open },
    { label: t.kpiWaitSiteAccess, value: kpiStats.waitSiteAccess, color: "linear-gradient(135deg,#c084fc,#9333ea)", Icon: ExclamationTriangleIcon, ws: "wait_site_access", coarse: STATUS_LABELS.open },
    { label: t.kpiCompleted, value: kpiStats.completed, color: "linear-gradient(135deg,#4ade80,#16a34a)", Icon: CheckCircleIcon, ws: "completed", coarse: STATUS_LABELS.completed },
    { label: t.kpiCancelled, value: kpiCancelled, color: "linear-gradient(135deg,#94a3b8,#64748b)", Icon: XCircleIcon, ws: "cancelled", coarse: STATUS_LABELS.cancelled },
  ];

  // ป้ายชื่อ bucket สำหรับ filter chip (คลิกการ์ด KPI)
  const workStatusLabel: Record<WorkStatusFilter, string> = {
    wo_all: t.kpiAllWO,
    new: t.kpiNewSR,
    wait_manpower: t.kpiWaitManpower,
    wait_sparepart: t.kpiWaitSparepart,
    wait_approve: t.kpiWaitApprove,
    wait_site_access: t.kpiWaitSiteAccess,
    in_progress: t.statusLabel.in_progress,
    completed: t.kpiCompleted,
    cancelled: t.kpiCancelled,
  };

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
    // legend ของ Apex ปิดไว้ — ใช้ legend ที่เขียนเองด้านล่างกราฟ (โชว์ % ต่อสถานะ + คลิกกรองได้)
    legend: { show: false },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            total: {
              show: true, label: "SUCCESS RATE", fontSize: "12px", fontWeight: 700, color: "#94a3b8",
              formatter: () => `${successRate}%`,
            },
            value: { fontSize: "34px", fontWeight: 800, color: "#1e293b" },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v: number) => `${v} ${t.taskUnit}` } },
  }), [successRate, toggleFilter, t]);

  const causeOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "donut",
      events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
          const label = causeData.keys[dataPointIndex];
          if (label) toggleFilter("cause", label);
        },
      },
    },
    colors: EQUIPMENT_COLORS,
    labels: causeData.keys,
    legend: { show: true, position: "bottom", fontSize: "11px" },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: "60%",
          labels: {
            show: true,
            total: { show: true, label: "Grand Total", fontSize: "10px", formatter: () => String(causeData.vals.reduce((s, v) => s + v, 0)) },
          },
        },
      },
    },
    tooltip: { y: { formatter: (v: number) => `${v} case${v !== 1 ? "s" : ""}` } },
  }), [causeData, toggleFilter]);

  // ── Remedy donut (REMEDY CODE) — clic = choisir le remède détaillé dans le bar chart
  const remedyOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "donut",
      events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
          const code = remedyData.keys[dataPointIndex];
          if (code) toggleFilter("remedy", code);
        },
      },
    },
    colors: REMEDY_COLORS,
    labels: remedyData.keys.map(remedyLabel),
    legend: { show: true, position: "bottom", fontSize: "11px" },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: "60%",
          labels: {
            show: true,
            total: { show: true, label: "Grand Total", fontSize: "10px", formatter: () => String(remedyData.vals.reduce((s, v) => s + v, 0)) },
          },
        },
      },
    },
    tooltip: { y: { formatter: (v: number) => `${v} case${v !== 1 ? "s" : ""}` } },
  }), [remedyData, toggleFilter]);

  // ── Bar de détail : REMEDY DESCRIPTION (le composant remplacé / réparé / réinitialisé…)
  const remedyDetailOptions = useMemo<ApexCharts.ApexOptions>(() => {
    // des comptes de 1 ou 2 donneraient des graduations décimales (0.2, 0.4…) — on force des entiers
    const maxVal = Math.max(1, ...remedyDetail.vals);
    // même couleur que la tranche correspondante du donut — vue « toutes catégories »
    // comprise, où chaque barre reprend la teinte de son remède
    const colorOf = (code: string) => {
      const i = remedyData.keys.indexOf(code);
      return REMEDY_COLORS[(i >= 0 ? i : 0) % REMEDY_COLORS.length];
    };
    return ({
      chart: { type: "bar", toolbar: { show: false } },
      colors: activeRemedy
        ? [colorOf(activeRemedy)]
        : remedyDetail.keys.map((k) => colorOf(remedyCodeOfDescription(k))),
      plotOptions: { bar: { horizontal: true, borderRadius: 4, distributed: !activeRemedy } },
      xaxis: {
        categories: remedyDetail.keys,
        tickAmount: Math.min(5, maxVal),
        labels: { formatter: (v: string) => String(Math.round(Number(v))), style: { fontSize: "11px" } },
      },
      yaxis: { labels: { maxWidth: 260, style: { fontSize: "11px" } } },
      legend: { show: false },
      dataLabels: { enabled: true },
      grid: { borderColor: "#f1f5f9" },
      tooltip: { y: { formatter: (v: number) => `${v} case${v !== 1 ? "s" : ""}` } },
    });
  }, [remedyDetail, remedyData, activeRemedy]);

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
    xaxis: {
      categories: sevData.keys,
      // graduations entières — sinon 0.2 / 0.4… dès que les comptes tombent bas (filtres actifs)
      tickAmount: Math.min(5, Math.max(1, ...sevData.vals)),
      labels: { formatter: (v: string) => String(Math.round(Number(v))) },
    },
    legend: { show: false },
    dataLabels: { enabled: true },
    grid: { borderColor: "#f1f5f9" },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    tooltip: { y: { formatter: (v: number) => `${v} items` } },
  });
  }, [sevData, toggleFilter]);

  // ── กราฟแท่งซ้อนรายเดือน (ม.ค.–ธ.ค.) — คลิกแท่งเพื่อเลือก/ยกเลิกเดือนนั้น
  const monthlyBarOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "bar", stacked: true, toolbar: { show: false },
      events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
          if (dataPointIndex < 0 || dataPointIndex > 11) return;
          setMonthSel((prev) => (prev === dataPointIndex ? "all" : dataPointIndex));
          setWeekSel("all");
          setPage(0);
        },
      },
    },
    colors: ["#ef4444", "#f97316", "#22c55e"],
    xaxis: { categories: t.monthsShort, labels: { rotate: 0, style: { fontSize: "12px" } } },
    // compte de tickets = entier, jamais 0.5
    yaxis: { labels: { formatter: (v: number) => String(Math.round(v)) } },
    legend: { position: "top" },
    dataLabels: { enabled: false },
    grid: { borderColor: "#f1f5f9" },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    plotOptions: { bar: { borderRadius: 3, columnWidth: "55%" } },
    tooltip: { y: { formatter: (v: number) => `${v} ${t.taskUnit}` } },
  }), [t]);

  const monthlyBarSeries = useMemo(() => [
    { name: t.statusLabel.open, data: monthData.open },
    { name: t.statusLabel.in_progress, data: monthData.inProgress },
    { name: t.statusLabel.completed, data: monthData.completed },
  ], [monthData, t]);

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
        {/* เลือกช่วงวิเคราะห์: ปี → เดือน → สัปดาห์ของเดือน */}
        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
          <DateSelect
            id="year-select" label={t.yearLabel}
            value={String(yearSel)} onChange={setYear}
            options={[{ value: "all", label: t.allYears }, ...years.map((y) => ({ value: String(y), label: String(y) }))]}
          />
          <DateSelect
            id="month-select" label={t.monthLabel}
            value={String(monthSel)} onChange={setMonth}
            options={[{ value: "all", label: t.allMonths }, ...t.monthsLong.map((m, i) => ({ value: String(i), label: m }))]}
          />
          <DateSelect
            id="week-select" label={t.weekLabel}
            value={String(weekSel)} onChange={setWeek}
            disabled={weekCount === 0}
            options={[
              { value: "all", label: t.allWeeks },
              ...Array.from({ length: weekCount }, (_, i) => ({ value: String(i + 1), label: t.weekOption(i + 1) })),
            ]}
          />
        </div>
      </div>

      {/* ── Active filter chips ── */}
      {activeFilterCount > 0 && (
        <div className="tw-mb-4 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
          <span className="tw-text-xs tw-font-medium tw-text-gray-500">{t.filterLabel}</span>
          {filters.status && <FilterChip label={`Status: ${displayStatus(filters.status)}`} lang={lang} onRemove={() => clearFilter("status")} />}
          {filters.workStatus && <FilterChip label={`KPI: ${workStatusLabel[filters.workStatus]}`} lang={lang} onRemove={() => clearFilter("workStatus")} />}
          {filters.cause && <FilterChip label={`Cause: ${filters.cause}`} lang={lang} onRemove={() => clearFilter("cause")} />}
          {filters.remedy && <FilterChip label={`Remedy: ${remedyLabel(filters.remedy)}`} lang={lang} onRemove={() => clearFilter("remedy")} />}
          {filters.equipment && <FilterChip label={`Equipment: ${filters.equipment}`} lang={lang} onRemove={() => clearFilter("equipment")} />}
          {filters.severity && <FilterChip label={`Severity: ${filters.severity}`} lang={lang} onRemove={() => clearFilter("severity")} />}
          {filters.station && <FilterChip label={`Station: ${filters.station}`} lang={lang} onRemove={() => clearFilter("station")} />}
          <button onClick={clearAll} aria-label={t.clearAllAria} className="tw-text-xs tw-font-semibold tw-text-red-500 hover:tw-text-red-700 tw-underline">
            {t.clearAll}
          </button>
        </div>
      )}

      {/* ── Section 1: Success Rate ── (role cs เห็นเฉพาะตารางใบงาน จึงซ่อนส่วนวิเคราะห์) */}
      {!isCsOnly && (
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

        {/* โดนัทอยู่ซ้าย + กริดการ์ด KPI อยู่ขวา — คลิกได้ทั้งสไลซ์ legend และการ์ด */}
        <Card className="tw-relative tw-border tw-border-blue-gray-100 tw-shadow-sm">
          {filters.status && (
            <div className="tw-absolute tw-right-3 tw-top-3 tw-z-10 tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
              🔍 {displayStatus(filters.status)}
            </div>
          )}
          <CardBody className="!tw-p-4 md:!tw-p-6">
            <div className="tw-grid tw-grid-cols-1 tw-items-center tw-gap-6 lg:tw-grid-cols-3">

              {/* โดนัท + legend พร้อมเปอร์เซ็นต์ต่อสถานะ */}
              <div className="tw-min-w-0">
                <p className="tw-mb-1 tw-text-xs tw-text-blue-gray-400">{t.clickToFilter}</p>
                {/* key บังคับ remount ตอนเปอร์เซ็นต์เปลี่ยน — ApexCharts ไม่รีเฟรช formatter ของ total label ผ่าน updateOptions */}
                <Chart key={`sr-${successRate}`} type="donut" options={donutOptions} series={[srStats.completed, srStats.inProgress, srStats.open]} width="100%" height={260} />
                <div className="tw-mt-3 tw-grid tw-grid-cols-3 tw-gap-2">
                  {srLegend.map(({ key, label, color, pct }) => {
                    const isActive = filters.status === STATUS_LABELS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleFilter("status", STATUS_LABELS[key])}
                        aria-pressed={isActive}
                        className={`tw-rounded-lg tw-px-1 tw-py-1.5 tw-text-center tw-transition-colors ${isActive ? "tw-bg-blue-50 tw-ring-1 tw-ring-blue-200" : "hover:tw-bg-gray-50"}`}
                      >
                        <span className="tw-mx-auto tw-mb-1 tw-block tw-h-2.5 tw-w-2.5 tw-rounded-full" style={{ background: color }} />
                        <span className="tw-block tw-text-[11px] tw-leading-tight tw-text-gray-500">{label}</span>
                        <span className="tw-block tw-text-sm tw-font-bold tw-text-gray-700">{pct}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* การ์ด KPI — คลิกเพื่อกรองทั้งแดชบอร์ด */}
              <div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2 lg:tw-col-span-2">
                {kpiCards.map((c) => (
                  <StatCard
                    key={c.label}
                    label={c.label} value={c.value} color={c.color} Icon={c.Icon}
                    active={c.ws !== undefined && filters.workStatus === c.ws}
                    dim={
                      // « All work order » englobe les autres buckets → on ne grise que
                      // lorsqu'un bucket précis est sélectionné, et jamais la carte englobante
                      (filters.workStatus !== null && filters.workStatus !== "wo_all" &&
                        c.ws !== undefined && c.ws !== "wo_all" && filters.workStatus !== c.ws) ||
                      (filters.status !== null && c.coarse !== undefined && filters.status !== c.coarse)
                    }
                    onClick={
                      c.ws !== undefined
                        ? () => toggleFilter("workStatus", c.ws!)
                        : c.clearsWorkStatus ? () => clearFilter("workStatus") : undefined
                    }
                  />
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </section>
      )}

      {/* ── Section 2: Failure Mode ── */}
      {!isCsOnly && (
      <section className="tw-mb-6">
        <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-700">{t.s2Title}</h2>
          <p className="tw-text-xs tw-text-gray-400">{t.chartClickHint}</p>
        </div>
        <div className="tw-grid tw-grid-cols-1 tw-gap-6 lg:tw-grid-cols-2">

          {/* Cause pie — CAUSE CODE des fiches CM */}
          <Card className="tw-relative tw-border tw-border-blue-gray-100 tw-shadow-sm">
            {filters.cause && (
              <div className="tw-absolute tw-right-3 tw-top-3 tw-z-10 tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
                🔍 {filters.cause}
              </div>
            )}
            <CardHeader floated={false} shadow={false} className="tw-m-4 tw-mb-0">
              <Typography variant="h6" color="blue-gray">
                {t.eqTitle}
              </Typography>
              <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-500">
                {t.eqSubtitle(causeData.vals.reduce((s, v) => s + v, 0))}
              </Typography>
            </CardHeader>
            <CardBody className="!tw-px-4 !tw-pt-2 !tw-pb-4">
              {causeData.vals.length === 0 ? (
                <EmptyChart message={t.noChartData} />
              ) : (
                <Chart type="donut" options={causeOptions} series={causeData.vals} width="100%" height={260} />
              )}
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
              {sevData.vals.length === 0 ? (
                <EmptyChart message={t.noChartData} />
              ) : (
                <Chart type="bar" options={sevOptions} series={[{ name: "Count", data: sevData.vals }]} width="100%" height={260} />
              )}
            </CardBody>
          </Card>
        </div>
      </section>
      )}

      {/* ── Section 2b: Remedy Analysis — pie par REMEDY CODE + détail REMEDY DESCRIPTION ── */}
      {!isCsOnly && (
      <section className="tw-mb-6">
        <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-700">{t.s4Title}</h2>
          <p className="tw-text-xs tw-text-gray-400">{t.remedyDetailHint}</p>
        </div>
        <div className="tw-grid tw-grid-cols-1 tw-gap-6 lg:tw-grid-cols-2">

          {/* Remedy pie */}
          <Card className="tw-relative tw-border tw-border-blue-gray-100 tw-shadow-sm">
            {filters.remedy && (
              <div className="tw-absolute tw-right-3 tw-top-3 tw-z-10 tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
                🔍 {remedyLabel(filters.remedy)}
              </div>
            )}
            <CardHeader floated={false} shadow={false} className="tw-m-4 tw-mb-0">
              <Typography variant="h6" color="blue-gray">{t.remedyTitle}</Typography>
              <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-500">
                {t.remedySubtitle(remedyData.vals.reduce((s, v) => s + v, 0))}
              </Typography>
            </CardHeader>
            <CardBody className="!tw-px-4 !tw-pt-2 !tw-pb-4">
              {remedyData.vals.length === 0 ? (
                <EmptyChart message={t.noChartData} />
              ) : (
                <Chart type="donut" options={remedyOptions} series={remedyData.vals} width="100%" height={260} />
              )}
            </CardBody>
          </Card>

          {/* Detail bar — composants concernés par le remède sélectionné */}
          <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm">
            <CardHeader floated={false} shadow={false} className="tw-m-4 tw-mb-0">
              <Typography variant="h6" color="blue-gray">
                {t.remedyDetailTitle(activeRemedy ? remedyLabel(activeRemedy) : t.remedyAllLabel)}
              </Typography>
              <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-500">
                {t.remedySubtitle(remedyDetail.vals.reduce((s, v) => s + v, 0))}
              </Typography>
            </CardHeader>
            <CardBody className="!tw-px-4 !tw-pt-2 !tw-pb-4">
              {remedyDetail.keys.length === 0 ? (
                <EmptyChart message={t.remedyEmpty} />
              ) : (
                // même hauteur que le donut à gauche — la rangée reste alignée quel que soit
                // le nombre de composants
                <Chart
                  type="bar"
                  options={remedyDetailOptions}
                  series={[{ name: "Count", data: remedyDetail.vals }]}
                  width="100%" height={260}
                />
              )}
            </CardBody>
          </Card>
        </div>
      </section>
      )}

      {/* ── Section 3: Overall Status by Month (แท่งซ้อนรายเดือน) ── */}
      {!isCsOnly && (
      <section className="tw-mb-6">
        <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-700">{t.s3Title}</h2>
          {monthSel !== "all" && (
            <div className="tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
              🔍 {t.monthsLong[monthSel as number]}
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
            <Chart type="bar" options={monthlyBarOptions} series={monthlyBarSeries} width="100%" height={280} />
          </CardBody>
        </Card>
      </section>
      )}

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
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
            {activeFilterCount > 0 && (
              <button onClick={clearAll} className="tw-text-xs tw-font-semibold tw-text-red-500 hover:tw-text-red-700 tw-underline">
                {t.clearFilters}
              </button>
            )}
            {/* ปุ่มกรองสถานะด่วน Open / In Progress / Closed / Cancelled — ป้ายเดียวกับ badge ในตาราง */}
            <div className="tw-flex tw-items-center tw-gap-1.5" role="group" aria-label={t.statusFilterLabel}>
              {([
                { key: "open", label: t.quickOpen, color: "#dc2626", bg: "#fee2e2", count: srStats.open },
                { key: "in_progress", label: t.quickInProgress, color: "#ea580c", bg: "#fff7ed", count: srStats.inProgress },
                { key: "completed", label: t.quickComplete, color: "#15803d", bg: "#dcfce7", count: srStats.completed },
                { key: "cancelled", label: t.quickCancelled, color: "#475569", bg: "#f1f5f9", count: cancelledCount },
              ] as const).map(({ key, label, color, bg, count }) => {
                const isActive = filters.status === STATUS_LABELS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleFilter("status", STATUS_LABELS[key])}
                    aria-pressed={isActive}
                    className={`tw-rounded-full tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-transition-all ${isActive ? "tw-shadow-sm" : "hover:tw-brightness-95"}`}
                    style={isActive ? { background: color, color: "#fff" } : { background: bg, color }}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
            {/* ผู้ใช้พิมพ์จำนวนแถวต่อหน้าเองได้ */}
            <div className="tw-flex tw-items-center tw-gap-1.5">
              <label htmlFor="rows-per-page" className="tw-text-xs tw-font-medium tw-text-gray-500">{t.rowsPerPage}</label>
              <input
                id="rows-per-page"
                type="number"
                min={1}
                max={MAX_PAGE_SIZE}
                value={pageSize}
                onChange={(e) => commitPageSize(e.target.value)}
                list="rows-per-page-presets"
                className="tw-w-20 tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-border-blue-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-100"
              />
              <datalist id="rows-per-page-presets">
                {[10, 15, 25, 50, 100].map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
          </div>
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
              aria-label={t.clearSearchAria}
              className="tw-absolute tw-right-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-gray-400 hover:tw-text-gray-600 tw-text-lg tw-leading-none"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>

        <Card className="tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-shadow-sm">
          <div className="tw-overflow-x-auto">
            <table className="tw-w-full tw-min-w-[860px] tw-table-auto tw-text-left tw-text-sm">
              <thead>
                <tr className="tw-bg-gray-50 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-gray-500">
                  {t.tableHeaders.map((h) => (
                    <th key={h} className="tw-px-4 tw-py-3 tw-whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="tw-p-8 tw-text-center tw-text-gray-400">
                      {t.noResults(search || undefined)}
                    </td>
                  </tr>
                ) : tableRows.map((r, i) => {
                  const badge = workStatusBadge(r);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => openReport(r)}
                      title={`${t.openReportTitle} · ${r.station_name || r.station_id}`}
                      className="tw-cursor-pointer tw-border-t tw-border-gray-100 hover:tw-bg-blue-50/30"
                    >
                      <td className="tw-px-4 tw-py-3 tw-text-gray-400">{page * pageSize + i + 1}</td>
                      <td className="tw-px-4 tw-py-3 tw-font-medium tw-text-gray-800">{r.station_name || r.station_id}</td>
                      <td className="tw-px-4 tw-py-3 tw-text-gray-600">{r.issue_id || "-"}</td>
                      <td className="tw-px-4 tw-py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); r.faulty_equipment && toggleFilter("equipment", r.faulty_equipment); }}
                          className={`tw-rounded tw-px-1.5 tw-py-0.5 tw-text-xs tw-transition-colors ${
                            filters.equipment === r.faulty_equipment
                              ? "tw-bg-blue-100 tw-text-blue-700 tw-font-bold"
                              : "tw-text-gray-600 hover:tw-bg-gray-100"
                          }`}
                        >
                          {r.faulty_equipment || "-"}
                        </button>
                      </td>
                      <td className="tw-px-4 tw-py-3 tw-text-gray-600">
                        <span className="tw-block tw-max-w-[260px] tw-truncate tw-text-xs" title={r.problem_details || ""}>
                          {r.problem_details || "-"}
                        </span>
                      </td>
                      <td className="tw-px-4 tw-py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); r.severity && toggleFilter("severity", r.severity); }}
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
                          onClick={(e) => { e.stopPropagation(); toggleFilter("workStatus", badge.ws); }}
                          className="tw-whitespace-nowrap tw-rounded-full tw-px-2.5 tw-py-0.5 tw-text-xs tw-font-medium tw-transition-all hover:tw-opacity-80"
                          style={{ background: badge.bg, color: badge.text, outline: filters.workStatus === badge.ws ? `2px solid ${badge.text}` : "none" }}
                        >
                          {workStatusLabel[badge.ws]}
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
            pageSize={pageSize}
            onChange={setPage}
            lang={lang}
            formatRange={t.pagination}
          />
        </Card>
      </section>
    </main>
  );
}
