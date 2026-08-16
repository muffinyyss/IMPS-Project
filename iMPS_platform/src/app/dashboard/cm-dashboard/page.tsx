"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, Typography } from "@material-tailwind/react";
import { apiFetch } from "@/utils/api";
import useLanguage from "@/utils/useLanguage";
import {
  CMRow, ActiveFilters, DateSel, STATUS_LABELS, WorkStatusFilter, EMPTY_FILTERS, CmOrigin,
  normalizeStatus, workStatusOf, filterByDate, listYears, listBrands, companyOf, brandOf, UNKNOWN_BRAND, UNKNOWN_COMPANY, FLEXXFAST_BRAND, COMPANY_FILTER_OPTIONS,
  excludeCancelled, isCancelled,
  weeksInMonth, applyFilters, groupCount, groupCountMulti, groupCountMultiByBrand, groupByMonth,
  causeLabelsOf, remedyCodesOf, remedyDescriptionsOf,
} from "@/utils/cm-dashboard";
import { remedyLabel, remedyCodeOfDescription } from "@/utils/cm-failure-codes";
import { CM_LIST_ROUTE } from "@/app/dashboard/cm-report/lib/origin";
import {
  CheckCircleIcon, ClockIcon, DocumentTextIcon, InboxStackIcon,
  TableCellsIcon, ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon, ShoppingCartIcon, XCircleIcon,
} from "@heroicons/react/24/outline";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── Constants ───────────────────────────────────────────────────────────────

// Categorical palette for causes / equipment — blue/cool family, no RAG meaning
const EQUIPMENT_COLORS = ["#3b82f6","#06b6d4","#8b5cf6","#0ea5e9","#a855f7","#14b8a6","#64748b","#6366f1","#0284c7","#7c3aed"];
// Remedy = ce qui a été fait (pas un état) → famille chaude, distincte des causes
const REMEDY_COLORS = ["#f59e0b","#ec4899","#f97316","#d946ef","#eab308","#fb7185","#c026d3","#f43f5e","#ca8a04","#e11d48"];
// Palette des marques (= entreprises détentrices) — famille distincte des causes
// et des remèdes pour qu'un même écran ne fasse jamais lire deux sens à une teinte
const BRAND_COLORS = ["#2563eb","#16a34a","#9333ea","#0891b2","#ca8a04","#db2777","#4f46e5","#65a30d","#0f766e","#94a3b8"];

/** Les camemberts Cause / Remedy se lisent soit en total, soit ventilés par entreprise */
type ChartView = "total" | "brand";

// ─── Sub-components ──────────────────────────────────────────────────────────

// Bascule « Total / Par entreprise » posée dans l'en-tête des deux blocs concernés
function ViewToggle({ value, onChange, totalLabel, brandLabel }: {
  value: ChartView; onChange: (v: ChartView) => void;
  totalLabel: string; brandLabel: string;
}) {
  return (
    <div className="tw-inline-flex tw-shrink-0 tw-rounded-lg tw-bg-gray-100 tw-p-0.5" role="group">
      {([["total", totalLabel], ["brand", brandLabel]] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={`tw-rounded-md tw-px-2.5 tw-py-1 tw-text-[11px] tw-font-semibold tw-transition-all ${
            value === key ? "tw-bg-white tw-text-gray-800 tw-shadow-sm" : "tw-text-gray-500 hover:tw-text-gray-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

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
      className={`tw-flex tw-h-full tw-min-w-0 tw-items-center tw-justify-between tw-gap-3 tw-rounded-2xl tw-px-4 tw-py-3 tw-text-left tw-text-white tw-shadow-md tw-transition-all ${
        onClick ? "hover:tw-shadow-xl hover:tw-brightness-105 focus:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-blue-400 focus-visible:tw-ring-offset-2" : "tw-cursor-default"
      } ${active ? "tw-ring-2 tw-ring-blue-500 tw-ring-offset-2" : ""}`}
      style={{ background: color, opacity: dim ? 0.45 : 1 }}
    >
      <div className="tw-min-w-0">
        <p className="tw-truncate tw-text-[12px] tw-font-semibold tw-leading-snug tw-opacity-95" title={label}>{label}</p>
        <p className="tw-mt-1 tw-text-2xl tw-font-extrabold tw-leading-none">{value}</p>
      </div>
      <span className="tw-flex tw-h-9 tw-w-9 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-xl tw-bg-white/20">
        <Icon className="tw-h-5 tw-w-5" />
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
  // « Total » (camembert) vs « Par entreprise » (barre empilée) — indépendant pour
  // chaque bloc, on compare rarement les deux répartitions en même temps
  const [causeView, setCauseView] = useState<ChartView>("total");
  const [remedyView, setRemedyView] = useState<ChartView>("total");

  const router = useRouter();
  const [userRole, setUserRole] = useState("");
  const [userCompany, setUserCompany] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  // tant que le rôle n'est pas connu on ne peut pas savoir si l'utilisateur a droit
  // à l'analytique — on garde le spinner plutôt que de la faire clignoter
  const [roleLoaded, setRoleLoaded] = useState(false);

  // เคลียร์ charger ที่เลือกไว้ → sidenav กลับสู่เมนูปกติ (เหมือนหน้า Stations/PM-all)
  useEffect(() => { localStorage.removeItem("selected_sn"); localStorage.removeItem("selected_charger_no"); window.dispatchEvent(new CustomEvent("charger:deselected")); }, []);

  // ── Language ──────────────────────────────────────────────────────────────
  const { lang } = useLanguage();

  // CS และ Technician เห็นเฉพาะรายการใบงาน — ตารางย้ายไปหน้า CM List แล้ว
  // จึงพาไปหน้านั้นแทนที่จะโชว์แดชบอร์ดเปล่า ๆ ที่ role นี้ไม่มีสิทธิ์ดู
  const isListOnlyRole = ["cs", "technician"].includes(userRole.trim().toLowerCase());
  useEffect(() => {
    if (isListOnlyRole) router.replace(CM_LIST_ROUTE);
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
  }, []);

  const clearFilter = useCallback((dim: keyof ActiveFilters) => {
    setFilters((prev) => ({ ...prev, [dim]: null }));
  }, []);

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const isEgatCompany = userCompany.trim().toLowerCase() === "egat";
  const canSeeAllCompanies = isSuperAdmin || isEgatCompany;

  const stations = useMemo(() => {
    const names = Array.from(new Set(rows.map((r) => r.station_name || r.station_id))).filter(Boolean);
    return ["All", ...names];
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

  // ── ใบที่ถูกยกเลิกไม่ใช่ภาระงานซ่อม — ตัดออกจากทุกกราฟและ KPI
  //    ถ้าไม่ตัด ใบยกเลิกจะไปโผล่เป็น "รอจัดซื้อ"/"New SR" แล้วฉุด success rate กับ completion rate ลง
  const activeRows = useMemo(() => excludeCancelled(periodRows), [periodRows]);

  // ── Marques (= entreprises détentrices) et origine des fiches ────────────────
  // Chaque compteur ignore SON PROPRE filtre : les autres boutons restent cliquables
  // et affichent un nombre non nul même quand une marque est déjà sélectionnée.
  const companies = COMPANY_FILTER_OPTIONS;
  const brandRows = useMemo(
    () => (filters.company ? rows.filter((r) => companyOf(r).toLowerCase() === filters.company!.toLowerCase()) : rows),
    [rows, filters.company]
  );
  const brands = useMemo(() => {
    const listed = listBrands(brandRows);
    if (filters.company?.trim().toLowerCase() !== "eds") return listed;
    if (!isSuperAdmin) return [FLEXXFAST_BRAND];
    return [FLEXXFAST_BRAND, ...listed.filter((brand) => brand.toLowerCase() !== FLEXXFAST_BRAND.toLowerCase())];
  }, [brandRows, filters.company, isSuperAdmin]);
  const brandCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of applyFilters(periodRows, filters, "brand")) {
      const b = brandOf(r);
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    return counts;
  }, [periodRows, filters]);

  // ที่มาของใบ: ระบบเปิดเอง (auto_cm_watcher) vs ผู้ใช้กรอกเอง
  const originCounts = useMemo(() => {
    const base = applyFilters(periodRows, filters, "origin");
    let auto = 0;
    for (const r of base) if (r.auto_generated) auto++;
    return { auto, user: base.length - auto };
  }, [periodRows, filters]);

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
  // même découpage, ventilé par marque — alimente la vue « par entreprise » du même bloc
  const causeByBrand = useMemo(() => groupCountMultiByBrand(causeRows, causeLabelsOf), [causeRows]);

  // ── Remedy donut : réparti par REMEDY CODE (Replace / Repair / Reset…). Ignore son propre filtre.
  const remedyRows = useMemo(() => applyFilters(activeRows, filters, "remedy"), [activeRows, filters]);
  const remedyData = useMemo(() => groupCountMulti(remedyRows, remedyCodesOf, 10), [remedyRows]);
  const remedyByBrand = useMemo(() => groupCountMultiByBrand(remedyRows, remedyCodesOf, 10), [remedyRows]);

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

  // ── จำนวนใบหลังกรอง (โชว์ใต้หัวเรื่อง) — รวมใบที่ยกเลิกด้วย จึงใช้ periodRows เต็ม
  const allFiltered = useMemo(() => applyFilters(periodRows, filters), [periodRows, filters]);
  // ── KPI stat cards (7 ใบ + completion rate): all chart-filters applied
  // แถว KPI ไม่กรองด้วย workStatus ของตัวเอง — ตัวเลขครบทุก bucket เสมอ (เหมือน donut กับ status)
  const kpiRows = useMemo(() => applyFilters(activeRows, filters, "workStatus"), [activeRows, filters]);
  const kpiStats = useMemo(() => {
    const counts = {
      total: kpiRows.length,
      newSr: 0, waitCsApprove: 0, waitManpower: 0, waitSparepart: 0, waitApprove: 0,
      waitSiteAccess: 0, inProgress: 0, completed: 0,
    };
    for (const r of kpiRows) {
      const s = workStatusOf(r);
      if (s === "new") counts.newSr++;
      else if (s === "wait_cs_approve") counts.waitCsApprove++;
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
    const allWo = counts.total - counts.newSr - counts.waitCsApprove;
    return { ...counts, allWo, completionRate };
  }, [kpiRows]);

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
      kpiCsWaitApprove: "SR รออนุมัติ",
      kpiCompleted: "WO เสร็จสิ้น",
      kpiWaitSiteAccess: "WO รอเข้าพื้นที่",
      kpiCancelled: "WO ยกเลิก",
      kpiCompletionRate: "อัตรางานเสร็จ",
      kpiOther: "สถานะอื่น ๆ",
      yearLabel: "ปี",
      monthLabel: "เดือน",
      weekLabel: "สัปดาห์",
      allYears: "ทุกปี",
      allMonths: "ทุกเดือน",
      allWeeks: "ทุกสัปดาห์",
      weekOption: (n: number) => `สัปดาห์ที่ ${n}`,
      monthsShort: ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."],
      monthsLong: ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"],
      companyFilterLabel: "บริษัท",
      allCompanies: "ทุกบริษัท",
      unknownCompany: "ไม่ระบุบริษัท",
      brandFilterLabel: "Brand",
      allBrands: "ทุก Brand",
      originFilterLabel: "ที่มาของใบงาน",
      originAuto: "ระบบเปิดอัตโนมัติ",
      originUser: "ผู้ใช้เปิดเอง",
      allOrigins: "ทุกที่มา",
      unknownBrand: "ไม่ระบุ Brand",
      viewTotal: "รวม",
      viewByBrand: "แยกตาม Brand",
      brandSplitEmpty: "ยังไม่มีข้อมูล Brand",
      tableMovedHint: "ตารางใบงานย้ายไปหน้าใหม่ — กรอง In Progress เป็นค่าเริ่มต้น และเรียงได้ทุกคอลัมน์",
      openTablePage: "เปิดตารางใบงาน",
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
      tableTitle: "CM List",
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
      tableHeaders: ["#", "สถานี", "รหัสเอกสาร", "หมายเลขตู้", "S/N ตู้", "ผู้แจ้งปัญหา", "อุปกรณ์ที่ผิดปกติ", "ปัญหาที่พบ", "ความรุนแรง", "วันที่", "สถานะ"],
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
      kpiAllWO: "Total work order",
      kpiNewSR: "New service requests",
      kpiWaitManpower: "WO wait for scheduled",
      kpiWaitSparepart: "WO wait for material",
      kpiWaitApprove: "WO wait for approve",
      kpiCsWaitApprove: "SR wait for approve",
      kpiCompleted: "WO completed",
      kpiWaitSiteAccess: "WO wait for site condition",
      kpiCancelled: "WO cancelled",
      kpiCompletionRate: "Completion rate",
      kpiOther: "Other statuses",
      yearLabel: "Year",
      monthLabel: "Month",
      weekLabel: "Week",
      allYears: "All years",
      allMonths: "All months",
      allWeeks: "All weeks",
      weekOption: (n: number) => `Week ${n}`,
      monthsShort: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
      monthsLong: ["January","February","March","April","May","June","July","August","September","October","November","December"],
      companyFilterLabel: "Company",
      allCompanies: "All companies",
      unknownCompany: "Unknown company",
      brandFilterLabel: "Brand",
      allBrands: "All brands",
      originFilterLabel: "Created by",
      originAuto: "Auto-generated",
      originUser: "Created by user",
      allOrigins: "All sources",
      unknownBrand: "Unknown brand",
      viewTotal: "Total",
      viewByBrand: "By brand",
      brandSplitEmpty: "No brand data yet",
      tableMovedHint: "The work-order table moved to its own page — defaults to In Progress and every column is sortable",
      openTablePage: "Open the table",
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
      tableTitle: "CM List",
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
      tableHeaders: ["#", "Station", "Issue ID", "Charger No.", "Charger S/N", "Reported By", "Faulty Equipment", "Problem Found", "Severity", "Date", "Status"],
    },
  }[lang]), [lang]);

  // Maps STATUS_LABELS value (Thai key) → translated display string for filter chips
  const displayStatus = useMemo(() => (s: string | null) => {
    if (!s) return s;
    const key = Object.entries(STATUS_LABELS).find(([, v]) => v === s)?.[0] as keyof typeof t.statusLabel | undefined;
    return key ? t.statusLabel[key] : s;
  }, [t]);

  // การ์ด KPI — ws = bucket ที่คลิกแล้วกรอง, coarse = สถานะ 3 กลุ่มไว้หรี่การ์ดตอนกรองจาก donut
  // dot = สีทึบของ bucket นั้น ใช้ทั้งในโดนัทและ legend ให้ตรงกับสีการ์ด
  type KpiCard = {
    label: string; value: number; color: string; dot: string;
    Icon: React.ComponentType<{ className?: string }>;
    ws?: WorkStatusFilter; coarse?: string; clearsWorkStatus?: boolean;
    /** carte de synthèse (somme d'autres cartes) — jamais une part du donut */
    aggregate?: boolean;
  };
  // Deux cartes de synthèse d'abord (Total SR = tout le périmètre, All WO = les SR
  // devenues des work orders), puis UNE carte par bucket réel du workflow.
  // Le donut reprend exactement ces buckets — une part par carte, même couleur —
  // et les buckets couvrent 100 % de Total SR, donc les parts se somment au total.
  // Les 6 cartes historiques du dashboard (cycle de vie du work order) + les 2 cartes
  // SR demandées en amont du flux. Rien d'autre : c'est le jeu de cartes de référence.
  const kpiCards: KpiCard[] = [
    { label: t.kpiTotalSR, value: kpiStats.total, color: "linear-gradient(135deg,#64748b,#334155)", dot: "#64748b", Icon: InboxStackIcon, clearsWorkStatus: true, aggregate: true },
    { label: t.kpiCsWaitApprove, value: kpiStats.waitCsApprove, color: "linear-gradient(135deg,#f472b6,#be185d)", dot: "#ec4899", Icon: ClipboardDocumentCheckIcon, ws: "wait_cs_approve", coarse: STATUS_LABELS.open },
    { label: t.kpiAllWO, value: kpiStats.allWo, color: "linear-gradient(135deg,#3b82f6,#1d4ed8)", dot: "#3b82f6", Icon: DocumentTextIcon, ws: "wo_all", aggregate: true },
    { label: t.kpiWaitManpower, value: kpiStats.waitManpower, color: "linear-gradient(135deg,#fb7185,#e11d48)", dot: "#fb7185", Icon: ClockIcon, ws: "wait_manpower", coarse: STATUS_LABELS.open },
    { label: t.kpiWaitSparepart, value: kpiStats.waitSparepart, color: "linear-gradient(135deg,#fbbf24,#d97706)", dot: "#f59e0b", Icon: ShoppingCartIcon, ws: "wait_sparepart", coarse: STATUS_LABELS.open },
    { label: t.kpiWaitSiteAccess, value: kpiStats.waitSiteAccess, color: "linear-gradient(135deg,#c084fc,#9333ea)", dot: "#a855f7", Icon: ExclamationTriangleIcon, ws: "wait_site_access", coarse: STATUS_LABELS.open },
    { label: t.kpiCompleted, value: kpiStats.completed, color: "linear-gradient(135deg,#4ade80,#16a34a)", dot: "#22c55e", Icon: CheckCircleIcon, ws: "completed", coarse: STATUS_LABELS.completed },
    { label: t.kpiCancelled, value: kpiCancelled, color: "linear-gradient(135deg,#94a3b8,#64748b)", dot: "#94a3b8", Icon: XCircleIcon, ws: "cancelled", coarse: STATUS_LABELS.cancelled },
  ];

  // Parts du donut = une par carte de bucket (les 2 cartes de synthèse recompteraient
  // les mêmes fiches, elles n'ont pas de part). Ces buckets ne couvrent pas tout le
  // périmètre — les fiches restantes (SR neuves, WO en cours, WO en attente
  // d'approbation) forment une part « autres », sinon le total du donut mentirait
  // sur Total SR.
  const bucketSlices = useMemo(() => {
    const slices = kpiCards.filter((c) => !c.aggregate && c.ws !== undefined);
    const covered = slices.reduce((sum, c) => sum + c.value, 0);
    const rest = kpiStats.total + kpiCancelled - covered;
    return rest > 0
      ? [...slices, { label: t.kpiOther, value: rest, color: "", dot: "#cbd5e1", Icon: InboxStackIcon } as KpiCard]
      : slices;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiStats, kpiCancelled, t]);

  const donutTotal = useMemo(() => bucketSlices.reduce((sum, c) => sum + c.value, 0), [bucketSlices]);

  // ป้ายชื่อ bucket สำหรับ filter chip (คลิกการ์ด KPI)
  const workStatusLabel: Record<WorkStatusFilter, string> = {
    wo_all: t.kpiAllWO,
    new: t.kpiNewSR,
    wait_manpower: t.kpiWaitManpower,
    wait_sparepart: t.kpiWaitSparepart,
    wait_cs_approve: t.kpiCsWaitApprove,
    wait_approve: t.kpiWaitApprove,
    wait_site_access: t.kpiWaitSiteAccess,
    in_progress: t.statusLabel.in_progress,
    completed: t.kpiCompleted,
    cancelled: t.kpiCancelled,
  };

  // ─── Chart options ────────────────────────────────────────────────────────

  // Donut = une part par carte de bucket (même ordre, même couleur) — cliquer une
  // part pose exactement le même filtre que cliquer la carte correspondante
  const donutOptions = useMemo<ApexCharts.ApexOptions>(() => ({
    chart: {
      type: "donut",
      events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
          const ws = bucketSlices[dataPointIndex]?.ws;
          if (ws) toggleFilter("workStatus", ws);
        },
      },
    },
    colors: bucketSlices.map((c) => c.dot),
    labels: bucketSlices.map((c) => c.label),
    // legend ของ Apex ปิดไว้ — ใช้ legend ที่เขียนเองด้านล่างกราฟ (โชว์ % ต่อ bucket + คลิกกรองได้)
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
  }), [successRate, toggleFilter, t, bucketSlices]);

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

  // ── Vue « par entreprise » des deux camemberts ────────────────────────────
  // Un camembert ne peut pas porter deux dimensions à la fois : pour lire la
  // répartition par marque on bascule sur une barre empilée horizontale — mêmes
  // catégories, mêmes totaux, une couleur par entreprise détentrice.
  const brandColorOf = useCallback(
    (brand: string) => {
      const i = brands.indexOf(brand);
      return BRAND_COLORS[(i >= 0 ? i : brands.length) % BRAND_COLORS.length];
    },
    [brands]
  );

  const brandSplitOptions = useCallback(
    (
      categories: string[],
      seriesBrands: string[],
      onSelect: (categoryIndex: number) => void
    ): ApexCharts.ApexOptions => ({
      chart: {
        type: "bar", stacked: true, toolbar: { show: false },
        events: {
          dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => onSelect(dataPointIndex),
        },
      },
      colors: seriesBrands.map(brandColorOf),
      plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: "70%" } },
      xaxis: {
        categories,
        // comptes de tickets = entiers, jamais 0.5
        labels: { formatter: (v: string) => String(Math.round(Number(v))), style: { fontSize: "11px" } },
      },
      yaxis: { labels: { maxWidth: 220, style: { fontSize: "11px" } } },
      legend: { show: true, position: "bottom", fontSize: "11px" },
      dataLabels: { enabled: false },
      grid: { borderColor: "#f1f5f9" },
      states: { active: { filter: { type: "darken", value: 0.7 } } },
      tooltip: { y: { formatter: (v: number) => `${v} case${v !== 1 ? "s" : ""}` } },
    }),
    [brandColorOf]
  );

  const causeBrandOptions = useMemo(
    () => brandSplitOptions(causeByBrand.keys, causeByBrand.brands, (i) => {
      const label = causeByBrand.keys[i];
      if (label) toggleFilter("cause", label);
    }),
    [brandSplitOptions, causeByBrand, toggleFilter]
  );

  const remedyBrandOptions = useMemo(
    () => brandSplitOptions(remedyByBrand.keys.map(remedyLabel), remedyByBrand.brands, (i) => {
      const code = remedyByBrand.keys[i];
      if (code) toggleFilter("remedy", code);
    }),
    [brandSplitOptions, remedyByBrand, toggleFilter]
  );

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

  // roleLoaded : cs/technician sont redirigés vers CM List — sans cette garde
  // ils verraient l'analytique clignoter le temps que /me réponde
  if (loading || !roleLoaded || isListOnlyRole) {
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

      {/* ── Filtres compagnie (marque du chargeur) + origine de la fiche ──
           Placés avant les KPI : ils redéfinissent le périmètre de TOUT le dashboard,
           contrairement aux clics dans les graphes qui affinent une dimension. */}
      {!isListOnlyRole && (
        <div className="tw-mb-4 tw-flex tw-flex-col tw-gap-3 tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-px-4 tw-py-3 tw-shadow-sm lg:tw-flex-row lg:tw-items-center lg:tw-justify-between">
          <div className="tw-flex tw-min-w-0 tw-flex-wrap tw-items-center tw-gap-2">
            {canSeeAllCompanies && (
              <div className="tw-flex tw-items-center tw-gap-1.5">
                <label htmlFor="company-filter" className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-gray-400">
                  {t.companyFilterLabel}
                </label>
                <select
                  id="company-filter"
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
                    <option key={company} value={company}>{company === UNKNOWN_COMPANY ? t.unknownCompany : company}</option>
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
                  {label} ({brandCounts.get(b) ?? 0})
                </button>
              );
            })}
          </div>

          <div className="tw-flex tw-shrink-0 tw-flex-wrap tw-items-center tw-gap-2">
            <span className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-gray-400">
              {t.originFilterLabel}
            </span>
            {([
              { key: null, label: t.allOrigins, count: originCounts.auto + originCounts.user },
              { key: "auto" as CmOrigin, label: t.originAuto, count: originCounts.auto },
              { key: "user" as CmOrigin, label: t.originUser, count: originCounts.user },
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
                  {label}{key === null ? "" : ` (${count})`}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
          {canSeeAllCompanies && filters.company && <FilterChip label={`${t.companyFilterLabel}: ${filters.company === UNKNOWN_COMPANY ? t.unknownCompany : filters.company}`} lang={lang} onRemove={() => clearFilter("company")} />}
          {filters.brand && <FilterChip label={`${t.brandFilterLabel}: ${filters.brand === UNKNOWN_BRAND ? t.unknownBrand : filters.brand}`} lang={lang} onRemove={() => clearFilter("brand")} />}
          {filters.origin && <FilterChip label={`${t.originFilterLabel}: ${filters.origin === "auto" ? t.originAuto : t.originUser}`} lang={lang} onRemove={() => clearFilter("origin")} />}
          <button onClick={clearAll} aria-label={t.clearAllAria} className="tw-text-xs tw-font-semibold tw-text-red-500 hover:tw-text-red-700 tw-underline">
            {t.clearAll}
          </button>
        </div>
      )}

      {/* ── Section 1: Success Rate ── (CS/Technician เห็นเฉพาะตารางใบงาน) */}
      {!isListOnlyRole && (
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
            onChange={(e) => setStationFilter(e.target.value)}
            className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
          >
            {stations.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Donut et cartes KPI = deux blocs distincts, dans la même grille 2 colonnes
            que « Failure Mode Analysis » plus bas — les cartes de tout le dashboard
            gardent ainsi la même largeur d'une section à l'autre */}
        <div className="tw-grid tw-grid-cols-1 tw-gap-6 lg:tw-grid-cols-2">

          <Card className="tw-relative tw-border tw-border-blue-gray-100 tw-shadow-sm">
            {filters.workStatus && (
              <div className="tw-absolute tw-right-3 tw-top-3 tw-z-10 tw-rounded-full tw-bg-blue-50 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-blue-600 tw-ring-1 tw-ring-blue-200">
                🔍 {workStatusLabel[filters.workStatus]}
              </div>
            )}
            <CardBody className="!tw-p-4 md:!tw-p-6">
              {/* โดนัท + legend — หนึ่งช่องต่อหนึ่งการ์ด KPI (bucket เดียวกัน สีเดียวกัน) */}
              <div className="tw-min-w-0">
                <p className="tw-mb-1 tw-text-xs tw-text-blue-gray-400">{t.clickToFilter}</p>
                {/* key บังคับ remount ตอนเปอร์เซ็นต์เปลี่ยน — ApexCharts ไม่รีเฟรช formatter ของ total label ผ่าน updateOptions */}
                <Chart
                  key={`sr-${successRate}-${bucketSlices.length}`}
                  type="donut"
                  options={donutOptions}
                  series={bucketSlices.map((c) => c.value)}
                  width="100%"
                  height={260}
                />
                {/* Légende compacte sur 2 colonnes (pastille · libellé · %) — en
                    lignes basses plutôt qu'en blocs centrés, la carte reste courte
                    et se cale sur la hauteur de la grille de cartes à droite */}
                <div className="tw-mt-3 tw-grid tw-grid-cols-1 tw-gap-x-3 tw-gap-y-0.5 sm:tw-grid-cols-2">
                  {bucketSlices.map(({ ws, label, dot, value }) => {
                    const isActive = ws !== undefined && filters.workStatus === ws;
                    // dénominateur = somme des parts affichées, pas Total SR (qui
                    // exclut les fiches annulées) — sinon les % ne font pas 100
                    const pct = donutTotal === 0 ? 0 : Math.round((value / donutTotal) * 100);
                    return (
                      <button
                        key={label}
                        type="button"
                        // la part « autres » regroupe plusieurs états : rien à filtrer
                        onClick={ws === undefined ? undefined : () => toggleFilter("workStatus", ws)}
                        disabled={ws === undefined}
                        aria-pressed={ws === undefined ? undefined : isActive}
                        title={`${label} — ${value}`}
                        className={`tw-flex tw-items-center tw-gap-1.5 tw-rounded-md tw-px-1.5 tw-py-1 tw-text-left tw-transition-colors ${isActive ? "tw-bg-blue-50 tw-ring-1 tw-ring-blue-200" : ws === undefined ? "tw-cursor-default" : "hover:tw-bg-gray-50"}`}
                      >
                        <span className="tw-h-2 tw-w-2 tw-shrink-0 tw-rounded-full" style={{ background: dot }} />
                        <span className="tw-min-w-0 tw-flex-1 tw-truncate tw-text-[11px] tw-leading-tight tw-text-gray-500">{label}</span>
                        <span className="tw-shrink-0 tw-text-[11px] tw-font-bold tw-text-gray-700">{pct}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* การ์ด KPI — คลิกเพื่อกรองทั้งแดชบอร์ด
              auto-rows-fr + h-full : les 4 rangées se partagent la hauteur du donut,
              les deux colonnes de la section se terminent donc au même niveau */}
          <div className="tw-grid tw-h-full tw-auto-rows-fr tw-grid-cols-1 tw-gap-3 sm:tw-grid-cols-2">
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
      </section>
      )}

      {/* ── Section 2: Failure Mode ── */}
      {!isListOnlyRole && (
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
            <CardHeader floated={false} shadow={false} className="tw-m-4 tw-mb-0 tw-flex tw-items-start tw-justify-between tw-gap-3">
              <div className="tw-min-w-0">
                <Typography variant="h6" color="blue-gray">
                  {t.eqTitle}
                </Typography>
                <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-500">
                  {t.eqSubtitle(causeData.vals.reduce((s, v) => s + v, 0))}
                </Typography>
              </div>
              <ViewToggle value={causeView} onChange={setCauseView} totalLabel={t.viewTotal} brandLabel={t.viewByBrand} />
            </CardHeader>
            <CardBody className="!tw-px-4 !tw-pt-2 !tw-pb-4">
              {causeData.vals.length === 0 ? (
                <EmptyChart message={t.noChartData} />
              ) : causeView === "brand" ? (
                causeByBrand.series.length === 0 ? (
                  <EmptyChart message={t.brandSplitEmpty} />
                ) : (
                  <Chart type="bar" options={causeBrandOptions} series={causeByBrand.series} width="100%" height={260} />
                )
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
      {!isListOnlyRole && (
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
            <CardHeader floated={false} shadow={false} className="tw-m-4 tw-mb-0 tw-flex tw-items-start tw-justify-between tw-gap-3">
              <div className="tw-min-w-0">
                <Typography variant="h6" color="blue-gray">{t.remedyTitle}</Typography>
                <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-500">
                  {t.remedySubtitle(remedyData.vals.reduce((s, v) => s + v, 0))}
                </Typography>
              </div>
              <ViewToggle value={remedyView} onChange={setRemedyView} totalLabel={t.viewTotal} brandLabel={t.viewByBrand} />
            </CardHeader>
            <CardBody className="!tw-px-4 !tw-pt-2 !tw-pb-4">
              {remedyData.vals.length === 0 ? (
                <EmptyChart message={t.noChartData} />
              ) : remedyView === "brand" ? (
                remedyByBrand.series.length === 0 ? (
                  <EmptyChart message={t.brandSplitEmpty} />
                ) : (
                  <Chart type="bar" options={remedyBrandOptions} series={remedyByBrand.series} width="100%" height={260} />
                )
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
      {!isListOnlyRole && (
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

      {/* ── Section 4: lien vers la page CM List ──
           Le tableau vit maintenant sur sa propre page (filtre In Progress par
           défaut + tri sur toutes les colonnes) — ici on ne garde que l'entrée. */}
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
              onClick={() => router.push(CM_LIST_ROUTE)}
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
