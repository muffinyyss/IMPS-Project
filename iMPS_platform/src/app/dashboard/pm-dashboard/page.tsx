"use client";

/**
 * PM Dashboard — pendant préventif du CM Dashboard.
 *
 * Même grammaire de lecture que `/dashboard/cm-dashboard` :
 *   en-tête + sélecteurs ปี/เดือน/สัปดาห์ → barre COMPANY / BRAND / ที่มาของใบงาน
 *   → donut « PM Success Rate » + 4 การ์ด → แท่งซ้อนรายเดือน → ทางเข้าหน้า PM List
 *
 * ข้อมูล 2 ชุดเดียวกับหน้า PM List (dedup ด้วย wonum — 1 งาน = 1 แถว) :
 *   GET /pm-reports/all-stations — เอกสาร PM ที่ช่างกรอกแล้ว
 *   GET /maximo/pm/open          — ใบงานที่ Maximo เปิดเข้ามา
 * ต่างจาก PM List ตรงที่ดึงใบที่ปิด/ยกเลิกมาด้วย (only_open=false) — แดชบอร์ดต้อง
 * นับใบยกเลิก ส่วน PM List โชว์เฉพาะคิวงานที่ยังต้องลงมือทำ
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Typography } from "@material-tailwind/react";
import {
  CheckCircleIcon, ClipboardDocumentListIcon, ClockIcon, NoSymbolIcon, TableCellsIcon,
} from "@heroicons/react/24/outline";
import { apiFetch } from "@/utils/api";
import useLanguage from "@/utils/useLanguage";
import {
  PmRow, PmActiveFilters, PmBucket, PmOrigin, PmStage, DateSel,
  EMPTY_PM_FILTERS, UNKNOWN_BRAND, UNKNOWN_COMPANY, COMPANY_FILTER_OPTIONS, FLEXXFAST_BRAND,
  applyFilters, brandOf, bucketOf, filterByDate, groupByMonth, listBrands, listYears,
  matchesCompanyFilter, originOf, weeksInMonth,
} from "@/utils/pm-dashboard";
import { PM_LIST_ROUTE } from "@/app/dashboard/pm-report/lib/origin";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Constants ───────────────────────────────────────────────────────────────

/** Palette des marques — identique au CM Dashboard : une teinte = une entreprise */
const BRAND_COLORS = ["#2563eb", "#16a34a", "#9333ea", "#0891b2", "#ca8a04", "#db2777", "#4f46e5", "#65a30d", "#0f766e", "#94a3b8"];

/** Plafonds d'API (valeurs max acceptées par les deux endpoints) */
const LIMIT_PER_SOURCE = 200;
const WO_LIMIT = 1000;

/** pm_type ของใบงาน Maximo (CG/MB/CC/CB/ST) → ป้ายชนิดเดียวกับหน้า PM List */
const WO_PM_TYPE_LABEL: Record<string, string> = {
  CG: "CHARGER", MB: "MDB", CC: "CCB", CB: "CB-BOX", ST: "STATION",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * การ์ดสรุป — พื้นขาว ไอคอนวงกลมสีอ่อนทางซ้าย ตัวเลขใหญ่สีเดียวกับส่วนของโดนัท
 * คลิกเพื่อกรองทั้งแดชบอร์ด (การ์ด "งานทั้งหมด" = ล้างตัวกรอง)
 */
function SummaryCard({ label, value, tint, accent, Icon, dim, active, onClick }: {
  label: string; value: number; tint: string; accent: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  dim: boolean; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`tw-flex tw-h-full tw-min-w-0 tw-items-center tw-gap-4 tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-bg-white tw-px-5 tw-py-4 tw-text-left tw-shadow-sm tw-transition-all hover:tw-shadow-md focus:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-blue-400 focus-visible:tw-ring-offset-2 ${
        active ? "tw-ring-2 tw-ring-blue-500 tw-ring-offset-2" : ""
      }`}
      style={{ opacity: dim ? 0.45 : 1 }}
    >
      <span
        aria-hidden="true"
        className="tw-flex tw-h-12 tw-w-12 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-full"
        style={{ background: tint }}
      >
        <Icon className="tw-h-6 tw-w-6" style={{ color: accent }} />
      </span>
      <span className="tw-min-w-0">
        <span className="tw-block tw-truncate tw-text-[13px] tw-font-medium tw-text-gray-500" title={label}>{label}</span>
        <span className="tw-mt-0.5 tw-block tw-text-3xl tw-font-extrabold tw-leading-none" style={{ color: accent }}>
          {value}
        </span>
      </span>
    </button>
  );
}

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PMDashboardPage() {
  const [rows, setRows] = useState<PmRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearSel, setYearSel] = useState<DateSel>(new Date().getFullYear());
  const [monthSel, setMonthSel] = useState<DateSel>("all");
  const [weekSel, setWeekSel] = useState<DateSel>("all");
  const [stationFilter, setStationFilter] = useState<string>("All");
  const [filters, setFilters] = useState<PmActiveFilters>(EMPTY_PM_FILTERS);

  const router = useRouter();
  const [userRole, setUserRole] = useState("");
  const [userCompany, setUserCompany] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  // tant que le rôle n'est pas connu on ne sait pas si l'utilisateur a droit à
  // l'analytique — on garde le spinner plutôt que de la faire clignoter
  const [roleLoaded, setRoleLoaded] = useState(false);

  const { lang } = useLanguage();

  // เข้ามาหน้ารวมทุกสถานี = ไม่ได้เจาะจงตู้ไหน — ล้างตัวที่เลือกค้างไว้
  useEffect(() => {
    localStorage.removeItem("selected_sn");
    localStorage.removeItem("selected_charger_no");
    window.dispatchEvent(new CustomEvent("charger:deselected"));
  }, []);

  // ช่างกับ CS ไม่มีสิทธิ์ดูส่วนวิเคราะห์ — พาไปหน้า PM List ที่เป็นเมนูของ role นี้
  const isListOnlyRole = ["cs", "technician"].includes(userRole.trim().toLowerCase());
  useEffect(() => {
    if (isListOnlyRole) router.replace(PM_LIST_ROUTE);
  }, [isListOnlyRole, router]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch(`/me`);
        if (!res.ok) return;
        const user = await res.json();
        if (alive) {
          setUserRole(user?.role ?? "");
          setUserCompany(user?.company ?? "");
          setIsSuperAdmin(!!user?.is_super_admin);
        }
      } catch (err) {
        console.error("fetch /me error:", err);
      } finally {
        if (alive) setRoleLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [repRes, woRes] = await Promise.allSettled([
          apiFetch(`/pm-reports/all-stations?limit_per_source=${LIMIT_PER_SOURCE}`),
          // only_open=false : ต้องเห็นใบที่ปิดและใบที่ยกเลิกด้วย ไม่งั้นการ์ด "ยกเลิก" เป็น 0 เสมอ
          // verify=false    : แดชบอร์ดไม่ได้ใช้ exists_in_maximo — ตัด round-trip ไป Maximo ทิ้ง
          apiFetch(`/maximo/pm/open?only_open=false&verify=false&limit=${WO_LIMIT}`),
        ]);

        if (repRes.status === "rejected") throw repRes.reason;
        const json = await repRes.value.json();
        if (!repRes.value.ok) throw new Error(json?.detail || `HTTP ${repRes.value.status}`);
        const reports: PmRow[] = (Array.isArray(json?.reports) ? json.reports : [])
          .map((r: PmRow) => ({ ...r, kind: "report" as const }));

        // ใบงาน Maximo — โหลดไม่ได้ก็ยังโชว์เอกสารได้ ไม่ต้องล้มทั้งหน้า
        let woRows: PmRow[] = [];
        let hitLimit = false;
        if (woRes.status === "fulfilled" && woRes.value.ok) {
          const wj = await woRes.value.json().catch(() => ({}));
          const items: any[] = Array.isArray(wj?.items) ? wj.items : [];
          hitLimit = items.length >= WO_LIMIT;
          // ใบที่มีเอกสารแล้วไม่ต้องนับซ้ำ — งาน 1 ใบ = 1 แถวที่ไล่สถานะไปเรื่อย ๆ
          const withReport = new Set(
            reports.map((r) => String(r.wonum || "").trim()).filter(Boolean)
          );
          woRows = items
            .filter((w) => !withReport.has(String(w?.wonum || "").trim()))
            .map((w) => ({
              kind: "wo" as const,
              id: String(w?.wonum || ""),
              wonum: String(w?.wonum || ""),
              issue_id: String(w?.wonum || ""),
              document_name: String(w?.description || ""),
              pm_type: WO_PM_TYPE_LABEL[String(w?.pm_type || "").toUpperCase()] ?? "CHARGER",
              pm_date: String(w?.pm_date || ""),
              status: String(w?.status || ""),
              planning_status: String(w?.planning_status || "pending"),
              technician: "",
              assignees: Array.isArray(w?.assignees) ? w.assignees.filter(Boolean) : [],
              sn: String(w?.sn || ""),
              station_id: String(w?.station_id || ""),
              station_name: String(w?.station_id || w?.location || ""),
              company: String(w?.company || ""),
              charger_brand: String(w?.charger_brand || ""),
              created_at: String(w?.receivedAt || ""),
              file_url: "",
            }));
        }

        setTruncated(hitLimit);
        setRows([...woRows, ...reports]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleFilter = useCallback(<K extends keyof PmActiveFilters>(dim: K, value: NonNullable<PmActiveFilters[K]>) => {
    setFilters((prev) => ({ ...prev, [dim]: prev[dim] === value ? null : value }));
  }, []);

  const clearFilter = useCallback((dim: keyof PmActiveFilters) => {
    setFilters((prev) => ({ ...prev, [dim]: null }));
  }, []);

  const clearAll = () => setFilters(EMPTY_PM_FILTERS);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const isEgatCompany = userCompany.trim().toLowerCase() === "egat";
  const canSeeAllCompanies = isSuperAdmin || isEgatCompany;

  const stations = useMemo(() => {
    const names = Array.from(new Set(rows.map((r) => r.station_name || r.station_id))).filter(Boolean) as string[];
    return ["All", ...names.sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const years = useMemo(() => listYears(rows), [rows]);
  const weekCount = useMemo(
    () => (yearSel !== "all" && monthSel !== "all" ? weeksInMonth(yearSel, monthSel) : 0),
    [yearSel, monthSel]
  );

  const setYear = (v: string) => { setYearSel(v === "all" ? "all" : Number(v)); setWeekSel("all"); };
  const setMonth = (v: string) => { setMonthSel(v === "all" ? "all" : Number(v)); setWeekSel("all"); };
  const setWeek = (v: string) => { setWeekSel(v === "all" ? "all" : Number(v)); };

  const stationRows = useMemo(
    () => (stationFilter === "All" ? rows : rows.filter((r) => (r.station_name || r.station_id) === stationFilter)),
    [rows, stationFilter]
  );

  const periodRows = useMemo(
    () => filterByDate(stationRows, yearSel, monthSel, weekSel),
    [stationRows, yearSel, monthSel, weekSel]
  );

  // ── Marques et origine — chaque compteur ignore SON PROPRE filtre pour que les
  //    autres boutons restent cliquables avec un nombre non nul
  const companies = COMPANY_FILTER_OPTIONS;
  const brandRows = useMemo(
    () => rows.filter((r) => matchesCompanyFilter(r, filters.company)),
    [rows, filters.company]
  );
  const brands = useMemo(() => {
    const listed = listBrands(brandRows);
    if (filters.company?.trim().toLowerCase() !== "eds") return listed;
    if (!isSuperAdmin) return [FLEXXFAST_BRAND];
    return [FLEXXFAST_BRAND, ...listed.filter((b) => b.toLowerCase() !== FLEXXFAST_BRAND.toLowerCase())];
  }, [brandRows, filters.company, isSuperAdmin]);
  const brandCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of applyFilters(periodRows, filters, "brand")) {
      const b = brandOf(r);
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    return counts;
  }, [periodRows, filters]);

  // ที่มาของใบงาน: Maximo เปิดมาให้ vs ผู้ใช้กรอกเอง
  const originCounts = useMemo(() => {
    const base = applyFilters(periodRows, filters, "origin");
    let maximo = 0;
    for (const r of base) if (originOf(r) === "maximo") maximo++;
    return { maximo, user: base.length - maximo };
  }, [periodRows, filters]);

  // ── กราฟแท่งรายเดือน: กรองปี + สถานี + ตัวกรองจากกราฟ แต่ไม่กรองเดือน/สัปดาห์
  //    (เห็นครบ 12 เดือนเสมอ — คลิกแท่งเพื่อเลือกเดือน) และไม่กรองด้วย stage ของตัวเอง
  const monthRows = useMemo(
    () => applyFilters(filterByDate(stationRows, yearSel, "all", "all"), filters, "stage"),
    [stationRows, yearSel, filters]
  );
  const monthData = useMemo(() => groupByMonth(monthRows), [monthRows]);

  // ── โดนัท + การ์ด 4 ใบ อ่านตัวเลขชุดเดียวกัน — ไม่กรองด้วย bucket ของตัวเอง
  const bucketRows = useMemo(() => applyFilters(periodRows, filters, "bucket"), [periodRows, filters]);
  const bucketStats = useMemo(() => {
    let completed = 0, notCompleted = 0, cancelled = 0;
    for (const r of bucketRows) {
      const b = bucketOf(r);
      if (b === "completed") completed++;
      else if (b === "cancelled") cancelled++;
      else notCompleted++;
    }
    return { total: bucketRows.length, completed, notCompleted, cancelled };
  }, [bucketRows]);

  // ── จำนวนใบหลังกรองครบทุกมิติ (โชว์ใต้หัวเรื่อง)
  const allFiltered = useMemo(() => applyFilters(periodRows, filters), [periodRows, filters]);

  // ── Translations ─────────────────────────────────────────────────────────
  const t = useMemo(() => ({
    th: {
      pageTitle: "Preventive Maintenance (PM)",
      subtitle: (n: number) => `ข้อมูลจาก iMPS · ${n} รายการทั้งหมด`,
      afterFilter: (n: number) => `→ ${n} รายการหลังกรอง`,
      s1Title: "สัดส่วนความสำเร็จงาน PM",
      s3Title: "สถานะรวมรายเดือน (Overall Status by Month)",
      stationFilterLabel: "กรองตามสถานี",
      clickToFilter: "คลิกที่ส่วนของกราฟเพื่อกรอง",
      cancelHint: "(คลิกอีกครั้งเพื่อยกเลิก)",
      barHint: "คลิกที่แท่งกราฟเพื่อเลือกเดือน",
      donutCenterLabel: "งานทั้งหมด",
      cardTotal: "งานทั้งหมด",
      cardCompleted: "แล้วเสร็จ",
      cardNotCompleted: "ยังไม่แล้วเสร็จ",
      cardCancelled: "ยกเลิก / เลื่อนแผน",
      yearLabel: "ปี", monthLabel: "เดือน", weekLabel: "สัปดาห์",
      allYears: "ทุกปี", allMonths: "ทุกเดือน", allWeeks: "ทุกสัปดาห์",
      weekOption: (n: number) => `สัปดาห์ที่ ${n}`,
      monthsShort: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
      monthsLong: ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"],
      companyFilterLabel: "บริษัท",
      allCompanies: "ทุกบริษัท",
      unknownCompany: "ไม่ระบุบริษัท",
      brandFilterLabel: "Brand",
      allBrands: "ทุก Brand",
      unknownBrand: "ไม่ระบุ Brand",
      originFilterLabel: "ที่มาของใบงาน",
      originMaximo: "Maximo",
      originUser: "ผู้ใช้เปิดเอง",
      allOrigins: "ทุกที่มา",
      statusFilterLabel: "สถานะ",
      stageLabel: { open: "Open", in_progress: "In Progress", completed: "Complete" },
      noChartData: "ไม่มีข้อมูลในช่วงที่เลือก",
      tableTitle: "PM List",
      tableMovedHint: "ตารางใบงาน PM อยู่หน้าแยก — เรียงได้ทุกคอลัมน์ และเปิดเอกสารได้จากแถว",
      openTablePage: "เปิดตารางใบงาน",
      filterLabel: "Filters:",
      clearAll: "Clear all",
      clearAllAria: "ลบตัวกรองทั้งหมด",
      loading: "กำลังโหลด",
      errorPrefix: "โหลดข้อมูลไม่สำเร็จ",
      taskUnit: "งาน",
      volumeWarning: (limit: number) => `ใบงาน Maximo แสดงผลได้สูงสุด ${limit.toLocaleString()} ใบ — กราฟอาจไม่ครบทั้งหมด`,
    },
    en: {
      pageTitle: "Preventive Maintenance (PM)",
      subtitle: (n: number) => `Data from iMPS · ${n} total records`,
      afterFilter: (n: number) => `→ ${n} after filters`,
      s1Title: "PM Success Rate",
      s3Title: "Overall Status by Month",
      stationFilterLabel: "Filter by station",
      clickToFilter: "Click on the chart to filter",
      cancelHint: "(click again to cancel)",
      barHint: "Click on a bar to select the month",
      donutCenterLabel: "All jobs",
      cardTotal: "All jobs",
      cardCompleted: "Completed",
      cardNotCompleted: "Not completed",
      cardCancelled: "Cancelled / rescheduled",
      yearLabel: "Year", monthLabel: "Month", weekLabel: "Week",
      allYears: "All years", allMonths: "All months", allWeeks: "All weeks",
      weekOption: (n: number) => `Week ${n}`,
      monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      monthsLong: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      companyFilterLabel: "Company",
      allCompanies: "All companies",
      unknownCompany: "Unknown company",
      brandFilterLabel: "Brand",
      allBrands: "All brands",
      unknownBrand: "Unknown brand",
      originFilterLabel: "Created by",
      originMaximo: "Maximo",
      originUser: "Created by user",
      allOrigins: "All sources",
      statusFilterLabel: "Status",
      stageLabel: { open: "Open", in_progress: "In Progress", completed: "Complete" },
      noChartData: "No data for the selected period",
      tableTitle: "PM List",
      tableMovedHint: "The work-order table lives on its own page — every column is sortable and rows open the document",
      openTablePage: "Open the table",
      filterLabel: "Filters:",
      clearAll: "Clear all",
      clearAllAria: "Remove all filters",
      loading: "Loading",
      errorPrefix: "Failed to load",
      taskUnit: "jobs",
      volumeWarning: (limit: number) => `Maximo work orders are capped at ${limit.toLocaleString()} — charts may be incomplete`,
    },
  }[lang]), [lang]);

  // ── Donut + cartes : une part par carte de bucket, même ordre et même couleur ──
  type BucketCard = {
    bucket: PmBucket | null; label: string; value: number;
    tint: string; accent: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  };
  const bucketCards: BucketCard[] = useMemo(() => [
    { bucket: null, label: t.cardTotal, value: bucketStats.total, tint: "#dbeafe", accent: "#2563eb", Icon: ClipboardDocumentListIcon },
    { bucket: "completed", label: t.cardCompleted, value: bucketStats.completed, tint: "#dcfce7", accent: "#16a34a", Icon: CheckCircleIcon },
    { bucket: "not_completed", label: t.cardNotCompleted, value: bucketStats.notCompleted, tint: "#ffedd5", accent: "#ea580c", Icon: ClockIcon },
    { bucket: "cancelled", label: t.cardCancelled, value: bucketStats.cancelled, tint: "#fee2e2", accent: "#dc2626", Icon: NoSymbolIcon },
  ], [t, bucketStats]);

  /** Parts du donut = les 3 buckets réels (la carte « งานทั้งหมด » est leur somme) */
  const donutSlices = useMemo(
    () => bucketCards.filter((c) => c.bucket !== null) as (BucketCard & { bucket: PmBucket })[],
    [bucketCards]
  );
  const donutTotal = bucketStats.total;

  const bucketLabel: Record<PmBucket, string> = {
    completed: t.cardCompleted,
    not_completed: t.cardNotCompleted,
    cancelled: t.cardCancelled,
  };

  // ─── Chart options ────────────────────────────────────────────────────────

  const donutOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "donut",
      events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
          const b = donutSlices[dataPointIndex]?.bucket;
          if (b) toggleFilter("bucket", b);
        },
      },
    },
    colors: donutSlices.map((c) => c.accent),
    labels: donutSlices.map((c) => c.label),
    // legend ของ Apex ปิดไว้ — ใช้ legend ที่เขียนเองใต้กราฟ (โชว์ % ต่อ bucket + คลิกกรองได้)
    legend: { show: false },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true, label: t.donutCenterLabel, fontSize: "12px", fontWeight: 600, color: "#94a3b8",
              formatter: () => String(donutTotal),
            },
            value: { fontSize: "32px", fontWeight: 800, color: "#1e293b" },
          },
        },
      },
    },
    dataLabels: { enabled: true, formatter: (v: number) => `${Math.round(v * 10) / 10}%` },
    tooltip: { y: { formatter: (v: number) => `${v} ${t.taskUnit}` } },
  }), [donutSlices, donutTotal, toggleFilter, t]);

  // ── กราฟแท่งซ้อนรายเดือน — คลิกแท่งเลือก/ยกเลิกเดือน, คลิก legend กรองสถานะ
  const monthlyBarOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "bar", stacked: true, toolbar: { show: false },
      events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
          if (dataPointIndex < 0 || dataPointIndex > 11) return;
          setMonthSel((prev) => (prev === dataPointIndex ? "all" : dataPointIndex));
          setWeekSel("all");
        },
        // même ordre que monthlyBarSeries — la légende filtre le dashboard par étape
        legendClick: (_ctx: any, seriesIndex: number) => {
          const key = (["open", "in_progress", "closed"] as const)[seriesIndex];
          if (key) toggleFilter("stage", key);
        },
      },
    },
    colors: ["#ef4444", "#f97316", "#22c55e"],
    xaxis: { categories: t.monthsShort, labels: { rotate: 0, style: { fontSize: "12px" } } },
    // compte de travaux = entier, jamais 0.5
    yaxis: { labels: { formatter: (v: number) => String(Math.round(v)) } },
    legend: { position: "top", onItemClick: { toggleDataSeries: false } },
    dataLabels: { enabled: false },
    grid: { borderColor: "#f1f5f9" },
    states: { active: { filter: { type: "darken", value: 0.7 } } },
    plotOptions: { bar: { borderRadius: 3, columnWidth: "55%" } },
    tooltip: { y: { formatter: (v: number) => `${v} ${t.taskUnit}` } },
  }), [t, toggleFilter]);

  const monthlyBarSeries = useMemo(() => [
    { name: t.stageLabel.open, data: monthData.open },
    { name: t.stageLabel.in_progress, data: monthData.inProgress },
    { name: t.stageLabel.completed, data: monthData.completed },
  ], [monthData, t]);

  const monthlyHasData = useMemo(
    () => monthData.open.concat(monthData.inProgress, monthData.completed).some((v) => v > 0),
    [monthData]
  );

  /** ป้ายของตัวกรอง stage ที่มาจาก legend ของกราฟรายเดือน */
  const stageChipLabel: Partial<Record<PmStage, string>> = {
    open: t.stageLabel.open,
    in_progress: t.stageLabel.in_progress,
    closed: t.stageLabel.completed,
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading || !roleLoaded || isListOnlyRole) {
    return (
      <div role="status" aria-label={t.loading} className="tw-flex tw-min-h-64 tw-items-center tw-justify-center">
        <div aria-hidden="true" className="tw-h-10 tw-w-10 tw-animate-spin tw-rounded-full tw-border-4 tw-border-blue-500 tw-border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="tw-min-h-screen tw-bg-gray-50/60 tw-p-6">

      {/* ── Volume warning ── */}
      {truncated && (
        <div className="tw-mb-4 tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-4 tw-py-3 tw-text-sm tw-text-amber-700">
          <span className="tw-text-base">⚡</span>
          <span>{t.volumeWarning(WO_LIMIT)}</span>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="tw-mb-4 tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-red-200 tw-bg-red-50 tw-px-4 tw-py-3 tw-text-sm tw-text-red-700">
          <span className="tw-text-base">⚠️</span>
          <span>{`${t.errorPrefix}: `}<strong>{error}</strong></span>
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
            id="pm-year-select" label={t.yearLabel}
            value={String(yearSel)} onChange={setYear}
            options={[{ value: "all", label: t.allYears }, ...years.map((y) => ({ value: String(y), label: String(y) }))]}
          />
          <DateSelect
            id="pm-month-select" label={t.monthLabel}
            value={String(monthSel)} onChange={setMonth}
            options={[{ value: "all", label: t.allMonths }, ...t.monthsLong.map((m, i) => ({ value: String(i), label: m }))]}
          />
          <DateSelect
            id="pm-week-select" label={t.weekLabel}
            value={String(weekSel)} onChange={setWeek}
            disabled={weekCount === 0}
            options={[
              { value: "all", label: t.allWeeks },
              ...Array.from({ length: weekCount }, (_, i) => ({ value: String(i + 1), label: t.weekOption(i + 1) })),
            ]}
          />
        </div>
      </div>

      {/* ── Filtres entreprise / marque / origine ──
           Placés avant les cartes : ils redéfinissent le périmètre de TOUT le
           dashboard, contrairement aux clics dans les graphes qui affinent une dimension. */}
      <div className="tw-mb-4 tw-flex tw-flex-col tw-gap-3 tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-px-4 tw-py-3 tw-shadow-sm lg:tw-flex-row lg:tw-items-center lg:tw-justify-between">
        <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-center tw-gap-2">
          {canSeeAllCompanies && (
            <div className="tw-flex tw-items-center tw-gap-1.5">
              <label htmlFor="pm-company-filter" className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-gray-400">
                {t.companyFilterLabel}
              </label>
              <select
                id="pm-company-filter"
                value={filters.company ?? "all"}
                onChange={(e) => setFilters((prev) => ({
                  ...prev,
                  company: e.target.value === "all" ? null : e.target.value,
                  brand: null,
                }))}
                className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
              >
                <option value="all">{t.allCompanies}</option>
                {companies.map((company) => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
            </div>
          )}
          <span className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-gray-400">
            {t.brandFilterLabel}
          </span>
          <button
            type="button"
            onClick={() => clearFilter("brand")}
            aria-pressed={filters.brand === null}
            className={`tw-rounded-full tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-transition-all ${
              filters.brand === null
                ? "tw-bg-gray-900 tw-text-white tw-shadow-sm"
                : "tw-bg-gray-100 tw-text-gray-600 hover:tw-bg-gray-200"
            }`}
          >
            {t.allBrands}
          </button>
          {brands.map((b, i) => {
            const isActive = filters.brand === b;
            const color = BRAND_COLORS[i % BRAND_COLORS.length];
            const label = b === UNKNOWN_BRAND ? t.unknownBrand : b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => toggleFilter("brand", b)}
                aria-pressed={isActive}
                className={`tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-transition-all ${
                  isActive ? "tw-text-white tw-shadow-sm" : "tw-bg-gray-100 tw-text-gray-600 hover:tw-bg-gray-200"
                }`}
                style={isActive ? { background: color } : undefined}
              >
                <span
                  aria-hidden="true"
                  className="tw-h-2 tw-w-2 tw-rounded-full"
                  style={{ background: isActive ? "#fff" : color }}
                />
                {`${label} (${brandCounts.get(b) ?? 0})`}
              </button>
            );
          })}
        </div>

        <div className="tw-flex tw-shrink-0 tw-flex-wrap tw-items-center tw-gap-2">
          <span className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-gray-400">
            {t.originFilterLabel}
          </span>
          {([
            { key: null, label: t.allOrigins, count: originCounts.maximo + originCounts.user },
            { key: "maximo" as PmOrigin, label: t.originMaximo, count: originCounts.maximo },
            { key: "user" as PmOrigin, label: t.originUser, count: originCounts.user },
          ]).map(({ key, label, count }) => {
            const isActive = filters.origin === key;
            return (
              <button
                key={key ?? "all"}
                type="button"
                onClick={() => (key === null ? clearFilter("origin") : toggleFilter("origin", key))}
                aria-pressed={isActive}
                className={`tw-rounded-full tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-transition-all ${
                  isActive
                    ? "tw-bg-indigo-600 tw-text-white tw-shadow-sm"
                    : "tw-bg-gray-100 tw-text-gray-600 hover:tw-bg-gray-200"
                }`}
              >
                {key === null ? label : `${label} (${count})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active filter chips ── */}
      {activeFilterCount > 0 && (
        <div className="tw-mb-4 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
          <span className="tw-text-xs tw-font-medium tw-text-gray-500">{t.filterLabel}</span>
          {filters.bucket && <FilterChip label={bucketLabel[filters.bucket]} lang={lang} onRemove={() => clearFilter("bucket")} />}
          {filters.stage && <FilterChip label={`${t.statusFilterLabel}: ${stageChipLabel[filters.stage] ?? filters.stage}`} lang={lang} onRemove={() => clearFilter("stage")} />}
          {filters.station && <FilterChip label={`Station: ${filters.station}`} lang={lang} onRemove={() => clearFilter("station")} />}
          {canSeeAllCompanies && filters.company && <FilterChip label={`${t.companyFilterLabel}: ${filters.company === UNKNOWN_COMPANY ? t.unknownCompany : filters.company}`} lang={lang} onRemove={() => clearFilter("company")} />}
          {filters.brand && <FilterChip label={`${t.brandFilterLabel}: ${filters.brand === UNKNOWN_BRAND ? t.unknownBrand : filters.brand}`} lang={lang} onRemove={() => clearFilter("brand")} />}
          {filters.origin && <FilterChip label={`${t.originFilterLabel}: ${filters.origin === "maximo" ? t.originMaximo : t.originUser}`} lang={lang} onRemove={() => clearFilter("origin")} />}
          <button onClick={clearAll} aria-label={t.clearAllAria} className="tw-text-xs tw-font-semibold tw-text-red-500 hover:tw-text-red-700 tw-underline">
            {t.clearAll}
          </button>
        </div>
      )}

      {/* ── Section 1: PM Success Rate ── */}
      <section className="tw-mb-6">
        <div className="tw-mb-3 tw-flex tw-items-center tw-justify-between">
          <h2 className="tw-text-base tw-font-semibold tw-text-gray-700">
            {t.s1Title}
            {filters.bucket && <span className="tw-ml-2 tw-text-xs tw-font-normal tw-text-blue-500">{t.cancelHint}</span>}
          </h2>
          <label className="tw-sr-only" htmlFor="pm-station-filter">{t.stationFilterLabel}</label>
          <select
            id="pm-station-filter"
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
          >
            {stations.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="tw-grid tw-grid-cols-1 tw-gap-6 lg:tw-grid-cols-2">

          <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm">
            <CardBody className="!tw-p-4 md:!tw-p-6">
              <p className="tw-mb-1 tw-truncate tw-text-xs tw-text-blue-gray-400">{t.clickToFilter}</p>
              {donutTotal === 0 ? (
                <EmptyChart message={t.noChartData} />
              ) : (
                <>
                  {/* key บังคับ remount ตอนยอดรวมเปลี่ยน — ApexCharts ไม่รีเฟรช formatter ของ total label ผ่าน updateOptions */}
                  <Chart
                    key={`pm-donut-${donutTotal}`}
                    type="donut"
                    options={donutOptions}
                    series={donutSlices.map((c) => c.value)}
                    width="100%"
                    height={260}
                  />
                  {/* Légende compacte (pastille · libellé · %) — cliquable comme les parts */}
                  <div className="tw-mt-3 tw-grid tw-grid-cols-1 tw-gap-x-3 tw-gap-y-0.5">
                    {donutSlices.map(({ bucket, label, accent, value }) => {
                      const isActive = filters.bucket === bucket;
                      const pct = donutTotal === 0 ? 0 : Math.round((value / donutTotal) * 100);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleFilter("bucket", bucket)}
                          aria-pressed={isActive}
                          title={`${label} — ${value}`}
                          className={`tw-flex tw-items-center tw-gap-1.5 tw-rounded-md tw-px-1.5 tw-py-1 tw-text-left tw-transition-colors ${
                            isActive ? "tw-bg-blue-50 tw-ring-1 tw-ring-blue-200" : "hover:tw-bg-gray-50"
                          }`}
                        >
                          <span className="tw-h-2 tw-w-2 tw-shrink-0 tw-rounded-full" style={{ background: accent }} />
                          <span className="tw-min-w-0 tw-flex-1 tw-truncate tw-text-[11px] tw-leading-tight tw-text-gray-500">{label}</span>
                          <span className="tw-shrink-0 tw-text-[11px] tw-font-bold tw-text-gray-700">{`${pct}%`}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {/* การ์ดสรุป 4 ใบ — auto-rows-fr : ทั้ง 4 แถวแบ่งความสูงเท่ากับโดนัท
              สองคอลัมน์ของ section จึงจบที่ระดับเดียวกัน */}
          <div className="tw-grid tw-h-full tw-auto-rows-fr tw-grid-cols-1 tw-gap-3">
            {bucketCards.map((c) => (
              <SummaryCard
                key={c.label}
                label={c.label} value={c.value} tint={c.tint} accent={c.accent} Icon={c.Icon}
                active={c.bucket !== null && filters.bucket === c.bucket}
                // la carte « งานทั้งหมด » englobe les trois autres — jamais grisée
                dim={c.bucket !== null && filters.bucket !== null && filters.bucket !== c.bucket}
                onClick={c.bucket === null ? () => clearFilter("bucket") : () => toggleFilter("bucket", c.bucket!)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 2: Overall Status by Month ── */}
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
            {monthlyHasData ? (
              <Chart type="bar" options={monthlyBarOptions} series={monthlyBarSeries} width="100%" height={280} />
            ) : (
              <EmptyChart message={t.noChartData} height={280} />
            )}
          </CardBody>
        </Card>
      </section>

      {/* ── Section 3: entrée vers la page PM List ── */}
      <section>
        <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm">
          <CardBody className="tw-flex tw-flex-col tw-gap-3 sm:tw-flex-row sm:tw-items-center sm:tw-justify-between">
            <div>
              <Typography variant="h6" color="blue-gray">{t.tableTitle}</Typography>
              <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-500">
                {t.tableMovedHint}
              </Typography>
            </div>
            <button
              type="button"
              onClick={() => router.push(PM_LIST_ROUTE)}
              className="tw-inline-flex tw-shrink-0 tw-items-center tw-gap-2 tw-rounded-xl tw-bg-gray-900 tw-px-5 tw-py-2.5 tw-text-sm tw-font-semibold tw-text-white tw-shadow-lg tw-transition-colors hover:tw-bg-black"
            >
              {t.openTablePage}
              <TableCellsIcon className="tw-h-5 tw-w-5" />
            </button>
          </CardBody>
        </Card>
      </section>
    </main>
  );
}
