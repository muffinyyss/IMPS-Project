"use client";

/**
 * Test List — ตารางงาน Test รวมทุกสถานี (คู่กับ Test Dashboard)
 *
 * งาน Test = คำขอจากภายนอกที่ EGAT รับไปดำเนินการ
 * (เช่น บริษัทอื่นขอให้ EGAT ไปทดสอบ/ซ่อมตู้ชาร์จ EV)
 *
 * Copie de /dashboard/pm-list sans Maximo : ni colonne WO, ni ordres de travail Maximo.
 * Source unique : GET /test-reports/all-stations (Test Report DC + AC).
 * Clic sur une ligne → page Test Report du chargeur ; bouton CSV → lignes filtrées et triées.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@material-tailwind/react";
import { DocumentArrowDownIcon, PlusIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "@/utils/api";
import useLanguage from "@/utils/useLanguage";
import {
  COMPANY_FILTER_OPTIONS, DateSel, PmStage,
  filterByDate, listYears, matchesCompanyFilter, rowDate, stageOf, weeksInMonth,
} from "@/utils/pm-dashboard";
import {
  TEST_LIMIT_PER_SOURCE, TEST_TYPES, TestApiReport, TestRow, testPdfHref, toTestRow,
} from "@/utils/test-dashboard";
import { csvDate, csvFilename, downloadCsv, toCsv } from "@/utils/csv";
import CsvExportButton from "@/components/CsvExportButton";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const STAGE_STYLE: Record<PmStage, { bg: string; text: string }> = {
  open: { bg: "#fee2e2", text: "#dc2626" },
  in_progress: { bg: "#fff7ed", text: "#ea580c" },
  wait_approve: { bg: "#f3e8ff", text: "#7e22ce" },
  closed: { bg: "#dcfce7", text: "#15803d" },
  cancelled: { bg: "#f1f5f9", text: "#475569" },
};

const STAGE_RANK: Record<PmStage, number> = { open: 0, in_progress: 1, wait_approve: 2, closed: 3, cancelled: 4 };

/** Pastilles toujours visibles ; « Cancelled » n'apparaît que s'il y a des tests annulés */
const MAIN_STAGES = ["open", "in_progress", "wait_approve", "closed"] as const;

type SortKey = "station" | "technician" | "date" | "status";
type SortDir = "asc" | "desc";

export default function TestListPage() {
  const [rows, setRows] = useState<TestRow[]>([]);
  const [me, setMe] = useState<{ username: string; role: string } | null>(null);
  const [userCompany, setUserCompany] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [yearSel, setYearSel] = useState<DateSel>("all");
  const [monthSel, setMonthSel] = useState<DateSel>("all");
  const [weekSel, setWeekSel] = useState<DateSel>("all");
  const [stationFilter, setStationFilter] = useState("All");
  // null = ทุกบริษัท (ค่าเริ่มต้นเหมือน Test Dashboard)
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<PmStage | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const router = useRouter();
  const { lang } = useLanguage();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch("/me");
        if (!res.ok) return;
        const u = await res.json();
        if (alive) {
          setMe({ username: u?.username ?? "", role: String(u?.role ?? "").trim().toLowerCase() });
          setUserCompany(String(u?.company ?? ""));
          setIsSuperAdmin(!!u?.is_super_admin);
        }
      } catch (err) {
        console.error("fetch /me error:", err);
      }
    })();
    return () => { alive = false; };
  }, []);

  // เข้ามาหน้ารวมทุกสถานี = ไม่ได้เจาะจงตู้ไหน — ล้างตัวที่เลือกค้างไว้
  useEffect(() => {
    localStorage.removeItem("selected_sn");
    localStorage.removeItem("selected_charger_no");
    window.dispatchEvent(new CustomEvent("charger:deselected"));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/test-reports/all-stations?limit_per_source=${TEST_LIMIT_PER_SOURCE}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`);
        const reports: TestApiReport[] = Array.isArray(json?.reports) ? json.reports : [];
        setRows(reports.map(toTestRow));
      } catch (e) {
        setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const t = useMemo(() => ({
    th: {
      pageTitle: "Test List",
      subtitle: (n: number) => `คำขอจากภายนอกที่ EGAT รับดำเนินการ · ข้อมูลจาก iMPS · ${n} รายการทั้งหมด`,
      yearLabel: "ปี", monthLabel: "เดือน", weekLabel: "สัปดาห์",
      allYears: "ทุกปี", allMonths: "ทุกเดือน", allWeeks: "ทุกสัปดาห์",
      weekOption: (n: number) => `สัปดาห์ที่ ${n}`,
      monthsLong: ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"],
      stationFilterLabel: "กรองตามสถานี",
      companyFilterLabel: "บริษัท",
      allCompanies: "ทุกบริษัท",
      typeFilterLabel: "ชนิดอุปกรณ์",
      allTypes: "ทุกชนิด",
      statusFilterLabel: "กรองตามสถานะ",
      rowsPerPage: "แถวต่อหน้า",
      tableCount: (n: number, q?: string) => `${n} รายการ${q ? ` · "${q}"` : ""}`,
      searchPlaceholder: "ค้นหา station, ชื่อเอกสาร, ช่าง, SN…",
      clearFilters: "ล้างตัวกรอง",
      addWorkOrder: "เพิ่มใบงาน",
      pagination: (from: number, to: number, total: number) => `แสดง ${from}–${to} จาก ${total} รายการ`,
      loading: "กำลังโหลด",
      errorPrefix: "โหลดข้อมูลไม่สำเร็จ",
      noResults: (q?: string) => (q ? `ไม่พบรายการที่ตรงกับ "${q}"` : "ไม่มีรายการ"),
      openReportTitle: "เปิดหน้า Test Report ของตู้นี้",
      sortAsc: "เรียงจากน้อยไปมาก", sortDesc: "เรียงจากมากไปน้อย",
      headers: { station: "สถานี", technician: "ผู้ตรวจสอบ", date: "วันที่ Test", status: "สถานะ" },
      csv: { document: "ชื่อเอกสาร", issueId: "รหัสเอกสาร", source: "ที่มา", sourceReport: "กรอกในระบบ", sourceUpload: "อัปโหลด PDF" },
      stage: { open: "Open", in_progress: "In Progress", wait_approve: "Wait for approve", closed: "Closed", cancelled: "Cancelled" },
    },
    en: {
      pageTitle: "Test List",
      subtitle: (n: number) => `External requests handled by EGAT · From iMPS · ${n} records`,
      yearLabel: "Year", monthLabel: "Month", weekLabel: "Week",
      allYears: "All years", allMonths: "All months", allWeeks: "All weeks",
      weekOption: (n: number) => `Week ${n}`,
      monthsLong: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      stationFilterLabel: "Station",
      companyFilterLabel: "Company",
      allCompanies: "All companies",
      typeFilterLabel: "Equipment type",
      allTypes: "All types",
      statusFilterLabel: "Status",
      rowsPerPage: "Rows per page",
      tableCount: (n: number, q?: string) => `${n} record(s)${q ? ` · "${q}"` : ""}`,
      searchPlaceholder: "Search station, document, technician, SN…",
      clearFilters: "Clear filters",
      addWorkOrder: "Add work order",
      pagination: (from: number, to: number, total: number) => `Showing ${from}–${to} of ${total}`,
      loading: "Loading",
      errorPrefix: "Failed to load",
      noResults: (q?: string) => (q ? `No records match "${q}"` : "No records"),
      openReportTitle: "Open this charger's Test Report page",
      sortAsc: "Sort ascending", sortDesc: "Sort descending",
      headers: { station: "Station", technician: "Inspector", date: "Test date", status: "Status" },
      csv: { document: "Document", issueId: "Issue ID", source: "Source", sourceReport: "Filled in iMPS", sourceUpload: "Uploaded PDF" },
      stage: { open: "Open", in_progress: "In Progress", wait_approve: "Wait for approve", closed: "Closed", cancelled: "Cancelled" },
    },
  }[lang]), [lang]);

  const stageLabel = t.stage as Record<PmStage, string>;

  // Pas de formulaire « modifier » côté Test Report : on ouvre la page du chargeur,
  // qui liste ses tests. La page lit le chargeur (et DC/AC) dans localStorage.
  const openTestReport = useCallback((r: TestRow) => {
    if (!r.sn) return;
    if (r.station_id) localStorage.setItem("selected_station_id", r.station_id);
    localStorage.setItem("selected_station_name", r.station_name || r.station_id || "");
    localStorage.setItem("selected_sn", r.sn);
    localStorage.setItem("selected_chargerType", r.pm_type === "AC" ? "AC" : "DC");
    localStorage.removeItem("selected_charger_no");
    window.dispatchEvent(new CustomEvent("charger:selected"));
    router.push(`/dashboard/test-report?sn=${encodeURIComponent(r.sn)}`);
  }, [router]);

  const clearAll = () => {
    setTypeFilter(null);
    setStageFilter(null);
    setStationFilter("All");
    setCompanyFilter(null);
    setSearch("");
    setPage(0);
  };
  const activeFilterCount =
    (typeFilter ? 1 : 0) + (stageFilter ? 1 : 0) + (stationFilter !== "All" ? 1 : 0) + (companyFilter ? 1 : 0);

  // ช่างเห็นเฉพาะงาน Test ที่ตัวเองเป็นผู้ตรวจสอบ — role อื่นเห็นทุกใบ (กติกาเดียวกับ PM List)
  const scopedRows = useMemo(() => {
    if (!me || me.role !== "technician") return rows;
    const uname = me.username.trim().toLowerCase();
    if (!uname) return [];
    return rows.filter((r) => String(r.technician ?? "").trim().toLowerCase() === uname);
  }, [rows, me]);

  const isEgatCompany = userCompany.trim().toLowerCase() === "egat";
  const canSeeAllCompanies = isSuperAdmin || isEgatCompany;

  const companyRows = useMemo(
    () => (canSeeAllCompanies ? scopedRows.filter((r) => matchesCompanyFilter(r, companyFilter)) : scopedRows),
    [scopedRows, companyFilter, canSeeAllCompanies]
  );

  const stations = useMemo(() => {
    const names = Array.from(new Set(companyRows.map((r) => r.station_name || r.station_id))).filter(Boolean) as string[];
    return ["All", ...names.sort((a, b) => a.localeCompare(b))];
  }, [companyRows]);

  const years = useMemo(() => listYears(companyRows), [companyRows]);

  const weekCount = useMemo(
    () => (yearSel !== "all" && monthSel !== "all" ? weeksInMonth(yearSel, monthSel) : 0),
    [yearSel, monthSel]
  );

  const periodRows = useMemo(() => {
    const byStation = stationFilter === "All"
      ? companyRows
      : companyRows.filter((r) => (r.station_name || r.station_id) === stationFilter);
    return filterByDate(byStation, yearSel, monthSel, weekSel) as TestRow[];
  }, [companyRows, stationFilter, yearSel, monthSel, weekSel]);

  const applySearch = useCallback((list: TestRow[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.station_name, r.station_id, r.issue_id, r.document_name, r.technician, r.sn, r.pm_type]
        .some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [search]);

  const searchFiltered = useMemo(() => {
    let list = periodRows;
    if (typeFilter) list = list.filter((r) => r.pm_type === typeFilter);
    if (stageFilter) list = list.filter((r) => stageOf(r) === stageFilter);
    return applySearch(list);
  }, [periodRows, typeFilter, stageFilter, applySearch]);

  // ตัวนับบนปุ่มสถานะ — ไม่ขึ้นกับตัวกรองสถานะที่เลือกอยู่ (เหมือน PM List)
  const stageCounts = useMemo(() => {
    let base = periodRows;
    if (typeFilter) base = base.filter((r) => r.pm_type === typeFilter);
    base = applySearch(base);
    const counts: Record<PmStage, number> = { open: 0, in_progress: 0, wait_approve: 0, closed: 0, cancelled: 0 };
    for (const r of base) counts[stageOf(r)]++;
    return counts;
  }, [periodRows, typeFilter, applySearch]);

  const stageButtons: PmStage[] = stageCounts.cancelled > 0 || stageFilter === "cancelled"
    ? [...MAIN_STAGES, "cancelled"]
    : [...MAIN_STAGES];

  const sortValue = useCallback((r: TestRow, key: SortKey): string | number => {
    switch (key) {
      case "station": return (r.station_name || r.station_id || "").toLowerCase();
      case "technician": return (r.technician || "").toLowerCase();
      case "date": return r.pm_date || "";
      case "status": return STAGE_RANK[stageOf(r)];
      default: return "";
    }
  }, []);

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...searchFiltered].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      // ค่าว่างอยู่ล่างสุดเสมอไม่ว่าจะเรียงทางไหน
      const emptyA = va === "" || va === "-";
      const emptyB = vb === "" || vb === "-";
      if (emptyA !== emptyB) return emptyA ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [searchFiltered, sortKey, sortDir, sortValue]);

  const tableRows = useMemo(
    () => sortedRows.slice(page * pageSize, (page + 1) * pageSize),
    [sortedRows, page, pageSize]
  );

  useEffect(() => { setPage(0); }, [searchFiltered.length, sortKey, sortDir]);

  const commitPageSize = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return;
    setPageSize(Math.min(n, MAX_PAGE_SIZE));
    setPage(0);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  // Toutes les lignes filtrées + triées (pas seulement la page affichée)
  const exportCsv = () => {
    const csv = toCsv(sortedRows, [
      { header: "#", value: (_r, i) => i + 1 },
      { header: t.headers.station, value: (r) => r.station_name || r.station_id },
      { header: t.typeFilterLabel, value: (r) => r.pm_type },
      { header: t.csv.document, value: (r) => (r.document_name === "-" ? "" : r.document_name) },
      { header: t.csv.issueId, value: (r) => (r.issue_id === "-" ? "" : r.issue_id) },
      { header: "SN", value: (r) => r.sn },
      { header: t.companyFilterLabel, value: (r) => r.company },
      { header: "Brand", value: (r) => r.charger_brand },
      { header: t.headers.technician, value: (r) => r.technician },
      { header: t.headers.date, value: (r) => csvDate(r.pm_date) },
      { header: t.headers.status, value: (r) => stageLabel[stageOf(r)] },
      { header: t.csv.source, value: (r) => (r.source === "upload" ? t.csv.sourceUpload : t.csv.sourceReport) },
      { header: "PDF", value: (r) => testPdfHref(r.file_url, API_BASE, lang) },
    ]);
    downloadCsv(csvFilename("test-list"), csv);
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: "station", label: t.headers.station },
    { key: "technician", label: t.headers.technician },
    { key: "date", label: t.headers.date },
    { key: "status", label: t.headers.status },
  ];

  const totalPages = Math.ceil(sortedRows.length / pageSize);
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, sortedRows.length);

  if (loading) {
    return (
      <div role="status" aria-label={t.loading} className="tw-flex tw-min-h-64 tw-items-center tw-justify-center">
        <div aria-hidden="true" className="tw-h-10 tw-w-10 tw-animate-spin tw-rounded-full tw-border-4 tw-border-blue-500 tw-border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="tw-min-h-screen tw-bg-gray-50/60 tw-p-6">
      {error && (
        <div className="tw-mb-4 tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-red-200 tw-bg-red-50 tw-px-4 tw-py-3 tw-text-sm tw-text-red-700">
          <span className="tw-text-base">⚠️</span>
          <span>{`${t.errorPrefix}: `}<strong>{error}</strong></span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="tw-mb-4 tw-flex tw-flex-col tw-gap-3 sm:tw-flex-row sm:tw-items-start sm:tw-justify-between">
        <div>
          <h1 className="tw-text-2xl tw-font-bold tw-text-gray-800">{t.pageTitle}</h1>
          <p className="tw-mt-0.5 tw-text-sm tw-text-gray-500">
            {t.subtitle(scopedRows.length)}
            <span className="tw-ml-2 tw-font-semibold tw-text-blue-600">
              {t.tableCount(searchFiltered.length, search || undefined)}
            </span>
          </p>
        </div>
        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
          <div className="tw-flex tw-items-center tw-gap-1.5">
            <label htmlFor="year-select" className="tw-text-xs tw-font-medium tw-text-gray-500">{t.yearLabel}</label>
            <select
              id="year-select" value={String(yearSel)}
              onChange={(e) => { setYearSel(e.target.value === "all" ? "all" : Number(e.target.value)); setWeekSel("all"); setPage(0); }}
              className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
            >
              <option value="all">{t.allYears}</option>
              {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </div>
          <div className="tw-flex tw-items-center tw-gap-1.5">
            <label htmlFor="month-select" className="tw-text-xs tw-font-medium tw-text-gray-500">{t.monthLabel}</label>
            <select
              id="month-select" value={String(monthSel)}
              onChange={(e) => { setMonthSel(e.target.value === "all" ? "all" : Number(e.target.value)); setWeekSel("all"); setPage(0); }}
              className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
            >
              <option value="all">{t.allMonths}</option>
              {t.monthsLong.map((m, i) => <option key={m} value={String(i)}>{m}</option>)}
            </select>
          </div>
          <div className="tw-flex tw-items-center tw-gap-1.5">
            <label htmlFor="week-select" className="tw-text-xs tw-font-medium tw-text-gray-500">{t.weekLabel}</label>
            <select
              id="week-select" value={String(weekSel)} disabled={weekCount === 0}
              onChange={(e) => { setWeekSel(e.target.value === "all" ? "all" : Number(e.target.value)); setPage(0); }}
              className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400 disabled:tw-cursor-not-allowed disabled:tw-bg-gray-50 disabled:tw-text-gray-400"
            >
              <option value="all">{t.allWeeks}</option>
              {Array.from({ length: weekCount }, (_, i) => <option key={i} value={String(i + 1)}>{t.weekOption(i + 1)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="tw-mb-3 tw-flex tw-flex-wrap tw-items-center tw-gap-3">
        <div className="tw-flex tw-items-center tw-gap-1.5">
          <label htmlFor="station-filter" className="tw-text-xs tw-font-medium tw-text-gray-500">{t.stationFilterLabel}</label>
          <select
            id="station-filter" value={stationFilter}
            onChange={(e) => { setStationFilter(e.target.value); setPage(0); }}
            className="tw-max-w-[220px] tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
          >
            {stations.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        {canSeeAllCompanies && (
          <div className="tw-flex tw-items-center tw-gap-1.5">
            <label htmlFor="company-filter" className="tw-text-xs tw-font-medium tw-text-gray-500">{t.companyFilterLabel}</label>
            <select
              id="company-filter" value={companyFilter ?? "all"}
              onChange={(e) => { setCompanyFilter(e.target.value === "all" ? null : e.target.value); setStationFilter("All"); setPage(0); }}
              className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
            >
              <option value="all">{t.allCompanies}</option>
              {COMPANY_FILTER_OPTIONS.map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
        )}

        <div className="tw-flex tw-items-center tw-gap-1.5">
          <label htmlFor="type-filter" className="tw-text-xs tw-font-medium tw-text-gray-500">{t.typeFilterLabel}</label>
          <select
            id="type-filter" value={typeFilter ?? "all"}
            onChange={(e) => { setTypeFilter(e.target.value === "all" ? null : e.target.value); setPage(0); }}
            className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
          >
            <option value="all">{t.allTypes}</option>
            {TEST_TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
          </select>
        </div>

        <div className="tw-flex tw-items-center tw-gap-1.5" role="group" aria-label={t.statusFilterLabel}>
          {stageButtons.map((key) => {
            const isActive = stageFilter === key;
            const { bg, text } = STAGE_STYLE[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setStageFilter(isActive ? null : key); setPage(0); }}
                aria-pressed={isActive}
                className={`tw-rounded-full tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-transition-all ${isActive ? "tw-shadow-sm" : "hover:tw-brightness-95"}`}
                style={isActive ? { background: text, color: "#fff" } : { background: bg, color: text }}
              >
                {`${stageLabel[key]} (${stageCounts[key]})`}
              </button>
            );
          })}
        </div>

        <div className="tw-flex tw-items-center tw-gap-1.5">
          <label htmlFor="rows-per-page" className="tw-text-xs tw-font-medium tw-text-gray-500">{t.rowsPerPage}</label>
          <input
            id="rows-per-page" type="number" min={1} max={MAX_PAGE_SIZE} value={pageSize}
            onChange={(e) => commitPageSize(e.target.value)}
            list="rows-per-page-presets"
            className="tw-w-20 tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-border-blue-400 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-100"
          />
          <datalist id="rows-per-page-presets">
            {[10, 15, 25, 50, 100].map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>

        {activeFilterCount > 0 && (
          <button onClick={clearAll} className="tw-text-xs tw-font-semibold tw-text-red-500 hover:tw-text-red-700 tw-underline">
            {t.clearFilters}
          </button>
        )}

        <CsvExportButton onClick={exportCsv} count={sortedRows.length} lang={lang} />

        <div className="tw-ml-auto tw-flex tw-items-center tw-gap-2">
          
          <button
            type="button"
            onClick={() => router.push("/dashboard/test-report")}
            className="tw-inline-flex tw-h-9 tw-items-center tw-justify-center tw-gap-1.5 tw-rounded-lg tw-bg-gray-900 tw-px-3.5 tw-text-sm tw-font-semibold tw-text-white tw-shadow-sm tw-transition-colors hover:tw-bg-black focus:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-gray-500"
          >
            <PlusIcon aria-hidden="true" className="tw-h-4 tw-w-4" />
            <span>{t.addWorkOrder}</span>
          </button>
        </div>
      </div>

      {/* ── Search ── */}
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
            aria-label="clear search"
            className="tw-absolute tw-right-3 tw-top-1/2 -tw-translate-y-1/2 tw-text-gray-400 hover:tw-text-gray-600 tw-text-lg tw-leading-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      <Card className="tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-shadow-sm">
        <div className="tw-overflow-x-auto">
          <table className="tw-w-full tw-min-w-[760px] tw-table-auto tw-text-left tw-text-sm">
            <thead>
              <tr className="tw-bg-gray-50 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-gray-500">
                <th className="tw-px-4 tw-py-3 tw-whitespace-nowrap">#</th>
                {columns.map((c) => {
                  const active = sortKey === c.key;
                  return (
                    <th
                      key={c.key}
                      className="tw-px-4 tw-py-3 tw-whitespace-nowrap"
                      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        title={active && sortDir === "asc" ? t.sortDesc : t.sortAsc}
                        className={`tw-inline-flex tw-items-center tw-gap-1 tw-uppercase tw-transition-colors ${active ? "tw-text-blue-600" : "hover:tw-text-gray-700"}`}
                      >
                        {c.label}
                        <span aria-hidden="true" className={`tw-text-[10px] tw-leading-none ${active ? "tw-opacity-100" : "tw-opacity-30"}`}>
                          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
                <th className="tw-px-4 tw-py-3 tw-whitespace-nowrap tw-text-center">PDF</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="tw-p-8 tw-text-center tw-text-gray-400">
                    {t.noResults(search || undefined)}
                  </td>
                </tr>
              ) : tableRows.map((r, i) => {
                const stage = stageOf(r);
                const style = STAGE_STYLE[stage];
                const pdfHref = testPdfHref(r.file_url, API_BASE, lang);
                const date = rowDate(r);
                return (
                  <tr
                    key={`${r.id}-${r.pm_type}-${r.source}-${i}`}
                    onClick={() => openTestReport(r)}
                    title={`${t.openReportTitle} · ${r.station_name || r.station_id}`}
                    className="tw-cursor-pointer tw-border-t tw-border-gray-100 hover:tw-bg-blue-50/30"
                  >
                    <td className="tw-px-4 tw-py-3 tw-text-gray-400">{page * pageSize + i + 1}</td>
                    <td className="tw-px-4 tw-py-3 tw-font-medium tw-text-gray-800">{r.station_name || r.station_id}</td>
                    <td className="tw-px-4 tw-py-3 tw-text-gray-600">{r.technician || "-"}</td>
                    <td className="tw-px-4 tw-py-3 tw-whitespace-nowrap tw-text-gray-500">
                      {date ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                    </td>
                    <td className="tw-px-4 tw-py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setStageFilter(stageFilter === stage ? null : stage); setPage(0); }}
                        className="tw-whitespace-nowrap tw-rounded-full tw-px-2.5 tw-py-0.5 tw-text-xs tw-font-medium tw-transition-all hover:tw-opacity-80"
                        style={{ background: style.bg, color: style.text, outline: stageFilter === stage ? `2px solid ${style.text}` : "none" }}
                      >
                        {stageLabel[stage]}
                      </button>
                    </td>
                    <td className="tw-px-4 tw-py-3 tw-text-center">
                      {pdfHref ? (
                        <a
                          href={pdfHref}
                          target="_blank" rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-lg tw-p-1.5 tw-text-red-600 hover:tw-bg-red-50 hover:tw-text-red-800"
                          title="PDF" aria-label="PDF"
                        >
                          <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
                        </a>
                      ) : (
                        <span className="tw-text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="tw-flex tw-flex-col tw-items-center tw-gap-3 tw-border-t tw-border-gray-100 tw-px-4 tw-py-4 sm:tw-flex-row sm:tw-justify-between">
            <p className="tw-text-xs tw-text-gray-500">{t.pagination(from, to, sortedRows.length)}</p>
            <div className="tw-flex tw-items-center tw-gap-1">
              <button
                onClick={() => setPage(page - 1)} disabled={page === 0}
                className="tw-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-border tw-border-gray-200 tw-text-sm tw-text-gray-600 hover:tw-bg-gray-50 disabled:tw-cursor-not-allowed disabled:tw-opacity-40"
              >‹</button>
              <span className="tw-px-2 tw-text-xs tw-text-gray-500">{`${page + 1} / ${totalPages}`}</span>
              <button
                onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}
                className="tw-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-border tw-border-gray-200 tw-text-sm tw-text-gray-600 hover:tw-bg-gray-50 disabled:tw-cursor-not-allowed disabled:tw-opacity-40"
              >›</button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
