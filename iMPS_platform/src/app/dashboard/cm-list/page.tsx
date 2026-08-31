"use client";

/**
 * CM List — liste des fiches CM (sortie du bas du CM Dashboard)
 *
 * Différences volontaires avec l'ancien tableau intégré au dashboard :
 *   • filtre par défaut « In Progress » — c'est la file de travail, pas un historique
 *   • toutes les colonnes sont triables (asc/desc), en plus de la recherche texte
 *   • colonnes Charger / Company : identifier le chargeur et l'entreprise qui le détient
 * Le reste (recherche, boutons de statut, lignes/page, pagination, clic → fiche,
 * export PDF) est repris tel quel.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@material-tailwind/react";
import { apiFetch } from "@/utils/api";
import useLanguage from "@/utils/useLanguage";
import {
  CMRow, ActiveFilters, DateSel, STATUS_LABELS, WorkStatusFilter, EMPTY_FILTERS, CmOrigin,
  normalizeStatus, workStatusOf, workStatusBadge, filterByDate, listYears, listBrands,
  weeksInMonth, applyFilters, applySearch, brandOf, originOf, matchesCompanyFilter, UNKNOWN_BRAND, UNKNOWN_COMPANY, FLEXXFAST_BRAND, COMPANY_FILTER_OPTIONS,
} from "@/utils/cm-dashboard";
import { CM_ORIGIN_LIST } from "@/app/dashboard/cm-report/lib/origin";
import { failureCodeLabel } from "@/app/dashboard/cm-report/lib/failureCode";
import { failureClassOptions, useMaximoFailureTree } from "@/app/dashboard/cm-report/lib/maximo";
import { DocumentArrowDownIcon } from "@heroicons/react/24/outline";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;
const FETCH_LIMIT = 10000;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// Company เริ่มต้นของหน้านี้ — ผู้ใช้ EGAT/super admin เปิดมาเห็นใบของ EGAT ก่อน
// แล้วค่อยสลับเป็น EDS หรือ "ทุกบริษัท" เองได้จากดรอปดาวน์
const DEFAULT_COMPANY_FILTER = "EGAT";

const PLANNING_ROLES = ["admin", "owner", "planner"];
const WAITING_ON_REPLAN_RESULTS = [
  "WO - wait for material",
  "WO - wait for spare part",
  "WO - wait for site condition",
  "WO - wait for site access",
];

function hasAssignedTechnician(assignees?: string[]) {
  return Array.isArray(assignees) && assignees.some((assignee) => !!assignee?.trim());
}

function isPlanningWait(value?: string, assignees?: string[]) {
  const result = (value || "").trim();
  return WAITING_ON_REPLAN_RESULTS.includes(result) && !hasAssignedTechnician(assignees);
}

// même règle que le CM Dashboard : status brut + stage → onglet de la fiche CM
function statusSlug(status: string, stage?: string, repairResult?: string): "open" | "in-progress" | "closed" | "cancelled" {
  const raw = (status || "").trim().toLowerCase();
  const repair = (repairResult || "").trim().toLowerCase();
  if (raw === "wait for schedule" && ["wo - wait for scheduled", "wo - wait for manpower"].includes(repair)) return "in-progress";
  if (raw === "wait for approve") {
    return (stage || "").trim().toLowerCase() === "cs_approval" ? "open" : "in-progress";
  }
  const s = normalizeStatus(status);
  if (s === "cancelled") return "cancelled";
  return s === "completed" ? "closed" : s === "in_progress" ? "in-progress" : "open";
}

// ─── Colonnes triables ────────────────────────────────────────────────────────
// L'accesseur renvoie la valeur comparée : string pour un tri alphabétique,
// number pour un tri numérique. `null`/"" finit toujours en bas quel que soit le sens.
type SortKey =
  | "station" | "charger" | "brand" | "sr" | "wo" | "reported_by"
  | "equipment" | "problem" | "severity" | "date" | "status";
type SortDir = "asc" | "desc";

const SEVERITY_RANK: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

function workNumberOf(issueId: string | undefined, prefix: "SR" | "WO"): string {
  const match = String(issueId || "").match(/(\d+)/);
  return match ? `${prefix}${match[1].padStart(3, "0")}` : "";
}

// เลข WO มีได้เฉพาะใบที่ผ่านด่าน CS แล้ว — bucket "new"/"wait_cs_approve" ยังเป็นแค่ SR
// ที่รอ head CS อนุมัติ (กติกาเดียวกับ KPI "WO ทั้งหมด" ของ CM Dashboard = ทั้งหมด − new
// − wait_cs_approve และฟอร์ม CM ที่สลับเลขจาก SR เป็น WO ตอน status "Wait for schedule")
function isWorkOrder(r: CMRow): boolean {
  const ws = workStatusOf(r);
  return ws !== "new" && ws !== "wait_cs_approve";
}

export default function CMListPage() {
  const [rows, setRows] = useState<CMRow[]>([]);
  const [totalInDB, setTotalInDB] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearSel, setYearSel] = useState<DateSel>("all");
  const [monthSel, setMonthSel] = useState<DateSel>("all");
  const [weekSel, setWeekSel] = useState<DateSel>("all");
  const [stationFilter, setStationFilter] = useState<string>("All");
  // Filtre par défaut = In Progress : la page sert à suivre le travail en cours
  // origin = user : หน้านี้คือคิวงานของคน ใบที่ระบบเปิดเองจาก fault/alarm ให้กดดูเพิ่มเอง
  // (Company เริ่มต้นตั้งทีหลังใน effect ของ /me เพราะต้องรู้ก่อนว่าผู้ใช้เห็นดรอปดาวน์นั้นไหม)
  const [filters, setFilters] = useState<ActiveFilters>({
    ...EMPTY_FILTERS,
    status: STATUS_LABELS.in_progress,
    origin: "user",
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [userRole, setUserRole] = useState("");
  const [userCompany, setUserCompany] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const router = useRouter();
  const { lang } = useLanguage();
  const maximoFailureTree = useMaximoFailureTree();

  const faultyEquipmentLabels = useMemo(() => {
    const labels = new Map<string, string>();
    const options = failureClassOptions(maximoFailureTree, { hasDC: true, hasAC: true }) ?? [];
    for (const option of options) {
      labels.set(option.value, option.label);
      labels.set(option.value.toUpperCase(), option.label);
    }
    return labels;
  }, [maximoFailureTree]);

  const displayFaultyEquipment = useCallback((row: CMRow) => {
    // เลขตู้มาก่อนเสมอ — faulty_equipment_label ที่ backend ประกอบให้ใช้ charger_name
    // ซึ่งบางสถานีตั้งเป็นรหัส Location ของ Maximo คอลัมน์นี้ต้องบอกว่า "ตู้ไหน"
    const chargerNo = String(row.charger_no ?? "").trim();
    if (chargerNo) {
      const sn = (row.charger_sn || "").trim();
      return sn ? `Charger ${chargerNo} (${sn})` : `Charger ${chargerNo}`;
    }
    // ใบที่ไม่ได้ผูกกับตู้ (CM ระดับสถานี/MDB) — คงป้ายเดิมไว้ ข้อมูลจะได้ไม่หาย
    if (row.faulty_equipment_label) return row.faulty_equipment_label;
    const code = (row.faulty_equipment || "").trim();
    if (!code) return "";
    return faultyEquipmentLabels.get(code) ?? faultyEquipmentLabels.get(code.toUpperCase()) ?? failureCodeLabel(code);
  }, [faultyEquipmentLabels]);

  useEffect(() => {
    localStorage.removeItem("selected_sn");
    localStorage.removeItem("selected_charger_no");
    window.dispatchEvent(new CustomEvent("charger:deselected"));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch(`/me`);
        if (!res.ok) return;
        const user = await res.json();
        if (alive) {
          const company = String(user?.company ?? "");
          const superAdmin = !!user?.is_super_admin;
          setUserRole(user?.role ?? "");
          setUserCompany(company);
          setIsSuperAdmin(superAdmin);
          // ใส่ค่าเริ่มต้นให้เฉพาะคนที่เห็นดรอปดาวน์ Company (super admin / พนักงาน EGAT)
          // คนบริษัทอื่นดรอปดาวน์ถูกซ่อน ถ้าใส่ให้ด้วยจะโดนล็อกอยู่ที่ EGAT แล้วแก้กลับไม่ได้
          if (superAdmin || company.trim().toLowerCase() === "egat") {
            // เช็ค prev.company กันเคสผู้ใช้กดเลือกบริษัทเองก่อน /me ตอบกลับ
            setFilters((prev) => (prev.company ? prev : { ...prev, company: DEFAULT_COMPANY_FILTER }));
          }
        }
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

  const openReport = useCallback((r: CMRow) => {
    if (!r.id) return;
    const stationName = r.station_name || r.station_id;
    if (r.station_id) localStorage.setItem("selected_station_id", r.station_id);
    localStorage.setItem("selected_station_name", stationName);
    localStorage.removeItem("selected_sn");
    localStorage.removeItem("selected_charger_no");
    window.dispatchEvent(new CustomEvent("station:selected"));
    const params = new URLSearchParams({
      tab: statusSlug(r.status, r.stage, r.repair_result),
      station_id: r.station_id || "",
      view: "form",
      edit_id: r.id,
      from: CM_ORIGIN_LIST,
    });
    if (isPlanningWait(r.repair_result, r.assignees) && PLANNING_ROLES.includes(userRole.trim().toLowerCase())) {
      params.set("planning", "1");
    }
    router.push(`/dashboard/cm-report?${params.toString()}`);
  }, [router, userRole]);

  const toggleFilter = useCallback((dim: keyof ActiveFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [dim]: prev[dim] === value ? null : value } as ActiveFilters));
    setPage(0);
  }, []);

  // ปุ่มแถวสถานะเลือกได้ทีละอัน ถึงจะตั้งกันคนละ dimension (4 ปุ่มหลังตั้ง status ส่วน
  // "รอเปิดใบงาน" ตั้ง workStatus) — ต้องล้างอีก dimension ทิ้งด้วย ไม่งั้นกด "รอเปิดใบงาน"
  // ทับตัวกรองเริ่มต้น "รอดำเนินการ" จะกลายเป็นเอาสองเงื่อนไขมา AND กันแล้วได้ตารางว่าง
  const selectStatusButton = useCallback((dim: "status" | "workStatus", value: string) => {
    setFilters((prev) => ({
      ...prev,
      status: null,
      workStatus: null,
      [dim]: prev[dim] === value ? null : value,
    } as ActiveFilters));
    setPage(0);
  }, []);

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setPage(0);
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

  const stationRows = useMemo(
    () => (stationFilter === "All" ? rows : rows.filter((r) => (r.station_name || r.station_id) === stationFilter)),
    [rows, stationFilter]
  );
  const periodRows = useMemo(
    () => filterByDate(stationRows, yearSel, monthSel, weekSel),
    [stationRows, yearSel, monthSel, weekSel]
  );
  const allFiltered = useMemo(() => applyFilters(periodRows, filters), [periodRows, filters]);
  const searchFiltered = useMemo(() => applySearch(allFiltered, search), [allFiltered, search]);

  // ฐานสำหรับนับตัวเลขบนแถวปุ่มสถานะ — ตัดตัวกรองที่ "ปุ่มแถวนี้เป็นคนตั้ง" ออกทั้งคู่
  // (status ของ 4 ปุ่มหลัง + workStatus ของปุ่ม "รอเปิดใบงาน") ปุ่มทั้งแถวคือตัวควบคุมเดียวกัน
  // ตัวเลขจึงต้องไม่ขยับเวลากดสลับปุ่มกันเอง — ถ้ากันแค่ status ปุ่มแรกจะโชว์ 0 ตลอดเวลาที่
  // ตัวกรองเริ่มต้น "รอดำเนินการ" ทำงานอยู่ ทั้งที่มีใบรอเปิดค้างอยู่จริง
  const statusButtonBase = useMemo(
    () => applySearch(applyFilters(periodRows, { ...filters, status: null, workStatus: null }), search),
    [periodRows, filters, search]
  );

  const statusCounts = useMemo(() => {
    const counts = { open: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const r of statusButtonBase) counts[normalizeStatus(r.status, r.stage, r.repair_result)]++;
    return counts;
  }, [statusButtonBase]);

  // สองด่านอนุมัติใช้ status "Wait for approve" ชื่อเดียวกัน แยกกันที่ stage เท่านั้น จึงต้องนับ
  // ผ่าน workStatusOf() ไม่ใช่ status ดิบ — cs_approval = SR รอ head CS เปิดเป็นใบงาน (ยังไม่มีเลข WO)
  // ส่วน close_approval = WO ที่ช่างซ่อมเสร็จแล้วรออนุมัติปิดงาน
  const approvalCounts = useMemo(() => {
    const counts = { wait_cs_approve: 0, wait_approve: 0 };
    for (const r of statusButtonBase) {
      const ws = workStatusOf(r);
      if (ws === "wait_cs_approve") counts.wait_cs_approve++;
      else if (ws === "wait_approve") counts.wait_approve++;
    }
    return counts;
  }, [statusButtonBase]);

  const companies = COMPANY_FILTER_OPTIONS;
  const brandRows = useMemo(
    () => rows.filter((r) => matchesCompanyFilter(r, filters.company)),
    [rows, filters.company]
  );
  const brands = useMemo(() => {
    const listed = listBrands(brandRows);
    if (filters.company?.trim().toLowerCase() !== "eds") return listed;
    if (!isSuperAdmin) return [FLEXXFAST_BRAND];
    return [FLEXXFAST_BRAND, ...listed.filter((brand) => brand.toLowerCase() !== FLEXXFAST_BRAND.toLowerCase())];
  }, [brandRows, filters.company, isSuperAdmin]);
  const originCounts = useMemo(() => {
    const base = applyFilters(periodRows, filters, "origin");
    let auto = 0;
    for (const r of base) if (originOf(r) === "auto") auto++;
    return { auto, user: base.length - auto };
  }, [periodRows, filters]);

  const sortValue = useCallback((r: CMRow, key: SortKey): string | number => {
    switch (key) {
      case "station": return (r.station_name || r.station_id || "").toLowerCase();
      case "charger": {
        const no = r.charger_no;
        // tri par numéro de chargeur quand il existe, sinon par nom
        if (no !== null && no !== undefined && no !== "" && !Number.isNaN(Number(no))) return Number(no);
        return (r.charger_name || "").toLowerCase();
      }
      case "brand": return brandOf(r).toLowerCase();
      case "sr": return workNumberOf(r.issue_id, "SR");
      // ใบที่ยังเป็น SR ไม่มีเลข WO — คืนค่าว่างเพื่อให้ตกไปอยู่ล่างสุดเสมอเวลาจัดเรียง
      case "wo": return isWorkOrder(r) ? workNumberOf(r.issue_id, "WO") : "";
      case "reported_by": return (r.reported_by || "").toLowerCase();
      case "equipment": return (displayFaultyEquipment(r) || "").toLowerCase();
      case "problem": return (r.problem_details || "").toLowerCase();
      case "severity": return SEVERITY_RANK[(r.severity || "").trim().toLowerCase()] ?? 0;
      case "date": return r.cm_date || "";
      case "status": return workStatusOf(r);
      default: return "";
    }
  }, [displayFaultyEquipment]);

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...searchFiltered].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      // les valeurs vides restent en bas quel que soit le sens du tri
      const emptyA = va === "" || va === 0;
      const emptyB = vb === "" || vb === 0;
      if (emptyA !== emptyB) return emptyA ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [searchFiltered, sortKey, sortDir, sortValue]);

  const tableRows = useMemo(
    () => sortedRows.slice(page * pageSize, (page + 1) * pageSize),
    [sortedRows, page, pageSize]
  );

  useEffect(() => { setPage(0); }, [allFiltered, search, sortKey, sortDir]);

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
      // les dates partent du plus récent, le texte de A→Z — c'est ce qu'on attend
      setSortDir(key === "date" || key === "severity" ? "desc" : "asc");
    }
  };

  const t = useMemo(() => ({
    th: {
      pageTitle: "CM List",
      subtitle: (n: number) => `ข้อมูลจาก iMPS · ${n} รายการทั้งหมด`,
      backToDashboard: "← กลับไปหน้า CM Dashboard",
      yearLabel: "ปี", monthLabel: "เดือน", weekLabel: "สัปดาห์",
      allYears: "ทุกปี", allMonths: "ทุกเดือน", allWeeks: "ทุกสัปดาห์",
      weekOption: (n: number) => `สัปดาห์ที่ ${n}`,
      monthsLong: ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"],
      stationFilterLabel: "กรองตามสถานี",
      companyFilterLabel: "บริษัท",
      allCompanies: "ทุกบริษัท",
      unknownCompany: "ไม่ระบุบริษัท",
      brandFilterLabel: "Brand",
      allBrands: "ทุก Brand",
      rowsPerPage: "แถวต่อหน้า",
      statusFilterLabel: "กรองตามสถานะ",
      tableCount: (n: number, q?: string) => `${n} รายการ${q ? ` · "${q}"` : ""}`,
      searchPlaceholder: "ค้นหา station, issue ID, ตู้ชาร์จ, บริษัท, equipment, severity…",
      clearFilters: "ล้างตัวกรอง",
      pagination: (from: number, to: number, total: number) => `แสดง ${from}–${to} จาก ${total} รายการ`,
      loading: "กำลังโหลด",
      errorPrefix: "โหลดข้อมูลไม่สำเร็จ",
      noResults: (q?: string) => q ? `ไม่พบรายการที่ตรงกับ "${q}"` : "ไม่พบรายงาน",
      volumeWarning: (total: number, limit: number) => `ฐานข้อมูลมี ${total.toLocaleString()} รายการ — แสดงผล ${limit.toLocaleString()} รายการล่าสุด`,
      openReportTitle: "เปิดใบงาน CM",
      quickWaitCsApprove: "รอเปิดใบงาน",
      quickWaitApprove: "รออนุมัติ",
      quickInProgress: "รอดำเนินการ", quickComplete: "เสร็จสิ้น", quickCancelled: "ยกเลิก",
      sortAsc: "เรียงน้อย→มาก", sortDesc: "เรียงมาก→น้อย",
      headers: {
        station: "สถานี", charger: "ตู้ชาร์จ", brand: "บริษัท", sr: "เลขที่ SR", wo: "เลขที่ WO",
        reported_by: "ผู้แจ้งปัญหา", equipment: "อุปกรณ์ที่ผิดปกติ", problem: "ปัญหาที่พบ",
        severity: "ความรุนแรง", date: "วันที่", status: "สถานะ",
      },
      workStatus: {
        wo_all: "WO ทั้งหมด", new: "SR ใหม่", wait_manpower: "WO รอกำหนดการ",
        wait_sparepart: "WO รออะไหล่", wait_cs_approve: "SR รออนุมัติ", wait_approve: "WO รออนุมัติ",
        wait_site_access: "WO รอเข้าพื้นที่", in_progress: "รอดำเนินการ", completed: "WO เสร็จสิ้น",
        cancelled: "WO ยกเลิก",
      },
    },
    en: {
      pageTitle: "CM List",
      subtitle: (n: number) => `Data from iMPS · ${n} total records`,
      backToDashboard: "← Back to CM Dashboard",
      yearLabel: "Year", monthLabel: "Month", weekLabel: "Week",
      allYears: "All years", allMonths: "All months", allWeeks: "All weeks",
      weekOption: (n: number) => `Week ${n}`,
      monthsLong: ["January","February","March","April","May","June","July","August","September","October","November","December"],
      stationFilterLabel: "Filter by station",
      companyFilterLabel: "Company",
      allCompanies: "All companies",
      unknownCompany: "Unknown company",
      brandFilterLabel: "Brand",
      allBrands: "All brands",
      rowsPerPage: "Rows per page",
      statusFilterLabel: "Filter by status",
      tableCount: (n: number, q?: string) => `${n} records${q ? ` · "${q}"` : ""}`,
      searchPlaceholder: "Search by station, SR, WO, charger, company, equipment, severity…",
      clearFilters: "Clear filters",
      pagination: (from: number, to: number, total: number) => `Showing ${from}–${to} of ${total} records`,
      loading: "Loading",
      errorPrefix: "Failed to load data",
      noResults: (q?: string) => q ? `No records matching "${q}"` : "No reports found",
      volumeWarning: (total: number, limit: number) => `Database has ${total.toLocaleString()} records — showing latest ${limit.toLocaleString()}.`,
      openReportTitle: "Open CM work order",
      quickWaitCsApprove: "SR wait for approve",
      quickWaitApprove: "WO wait for approve",
      quickInProgress: "In Progress", quickComplete: "Complete", quickCancelled: "Cancelled",
      sortAsc: "Sort ascending", sortDesc: "Sort descending",
      headers: {
        station: "Station", charger: "Charger", brand: "Company", sr: "SR No.", wo: "WO No.",
        reported_by: "Reported By", equipment: "Faulty Equipment", problem: "Problem Found",
        severity: "Severity", date: "Date", status: "Status",
      },
      workStatus: {
        wo_all: "All work order", new: "New service requests", wait_manpower: "WO wait for scheduled",
        wait_sparepart: "WO wait for material", wait_cs_approve: "SR wait for approve", wait_approve: "WO wait for approve",
        wait_site_access: "WO wait for site condition", in_progress: "In Progress", completed: "WO completed",
        cancelled: "WO cancelled",
      },
    },
  }[lang]), [lang]);

  const workStatusLabel = t.workStatus as Record<WorkStatusFilter, string>;
  const originText = lang === "th"
    ? { label: "ที่มาของใบงาน", all: "ทั้งหมด", auto: "ใบงาน Auto", user: "ใบงานที่สร้างเอง" }
    : { label: "Created by", all: "All sources", auto: "Auto-generated", user: "User-created" };

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "station", label: t.headers.station },
    { key: "brand", label: "Brand" },
    { key: "sr", label: t.headers.sr },
    { key: "wo", label: t.headers.wo },
    { key: "reported_by", label: t.headers.reported_by },
    { key: "equipment", label: t.headers.equipment },
    { key: "problem", label: t.headers.problem },
    { key: "severity", label: t.headers.severity },
    { key: "date", label: t.headers.date },
    { key: "status", label: t.headers.status },
  ];

  // ปุ่มกรองแถวสถานะ — สองด่านอนุมัติ ("รอเปิดใบงาน"/"รออนุมัติ") กรองด้วยมิติ workStatus
  // เพราะ status ดิบของทั้งคู่คือ "Wait for approve" เหมือนกัน แยกไม่ได้ด้วย status 4 กลุ่ม
  // ที่เหลือกรองด้วย status ตามเดิม จึงเก็บ dim ไว้กับปุ่มแทนที่จะ hardcode ตอน render
  // สีของสองปุ่มนั้นใช้ชุดเดียวกับป้าย wait_cs_approve / wait_approve ในตาราง ให้สื่อถึงถังเดียวกัน
  const statusButtons: {
    dim: "status" | "workStatus"; value: string; label: string; color: string; bg: string; count: number;
  }[] = [
    { dim: "workStatus", value: "wait_cs_approve", label: t.quickWaitCsApprove, color: "#c2410c", bg: "#ffedd5", count: approvalCounts.wait_cs_approve },
    { dim: "status", value: STATUS_LABELS.in_progress, label: t.quickInProgress, color: "#ea580c", bg: "#fff7ed", count: statusCounts.in_progress },
    { dim: "workStatus", value: "wait_approve", label: t.quickWaitApprove, color: "#4338ca", bg: "#e0e7ff", count: approvalCounts.wait_approve },
    { dim: "status", value: STATUS_LABELS.completed, label: t.quickComplete, color: "#15803d", bg: "#dcfce7", count: statusCounts.completed },
    { dim: "status", value: STATUS_LABELS.cancelled, label: t.quickCancelled, color: "#475569", bg: "#f1f5f9", count: statusCounts.cancelled },
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
      {totalInDB > FETCH_LIMIT && (
        <div className="tw-mb-4 tw-flex tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-4 tw-py-3 tw-text-sm tw-text-amber-700">
          <span className="tw-text-base">⚡</span>
          <span>{t.volumeWarning(totalInDB, FETCH_LIMIT)}</span>
        </div>
      )}

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
            {t.subtitle(rows.length)}
            <span className="tw-ml-2 tw-font-semibold tw-text-blue-600">{t.tableCount(searchFiltered.length, search || undefined)}</span>
          </p>
          <button
            onClick={() => router.push("/dashboard/cm-dashboard")}
            className="tw-mt-1 tw-text-xs tw-font-semibold tw-text-blue-600 hover:tw-text-blue-800 hover:tw-underline"
          >
            {t.backToDashboard}
          </button>
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

      {/* ── Toolbar : station / company / statut / lignes par page ── */}
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
              id="company-filter"
              value={filters.company ?? "all"}
              onChange={(e) => {
                setFilters((p) => ({
                  ...p,
                  company: e.target.value === "all" ? null : e.target.value,
                  brand: null,
                }));
                setPage(0);
              }}
              className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
            >
              <option value="all">{t.allCompanies}</option>
              {companies.map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
        )}
        <div className="tw-flex tw-items-center tw-gap-1.5">
          <label htmlFor="brand-filter" className="tw-text-xs tw-font-medium tw-text-gray-500">{t.brandFilterLabel}</label>
          <select
            id="brand-filter" value={filters.brand ?? "all"}
            onChange={(e) => { setFilters((p) => ({ ...p, brand: e.target.value === "all" ? null : e.target.value })); setPage(0); }}
            className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
          >
            <option value="all">{t.allBrands}</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-1.5" role="group" aria-label={originText.label}>
          <span className="tw-text-xs tw-font-medium tw-text-gray-500">{originText.label}</span>
          {([
            { key: null as CmOrigin | null, label: originText.all, count: originCounts.auto + originCounts.user },
            { key: "auto" as CmOrigin, label: originText.auto, count: originCounts.auto },
            { key: "user" as CmOrigin, label: originText.user, count: originCounts.user },
          ]).map(({ key, label, count }) => {
            const isActive = filters.origin === key;
            return (
              <button
                key={key ?? "all"}
                type="button"
                onClick={() => {
                  if (key === null) {
                    setFilters((p) => ({ ...p, origin: null }));
                    setPage(0);
                  } else {
                    toggleFilter("origin", key);
                  }
                }}
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

        <div className="tw-flex tw-items-center tw-gap-1.5" role="group" aria-label={t.statusFilterLabel}>
          {statusButtons.map(({ dim, value, label, color, bg, count }) => {
            const isActive = filters[dim] === value;
            return (
              <button
                key={`${dim}:${value}`}
                type="button"
                onClick={() => selectStatusButton(dim, value)}
                aria-pressed={isActive}
                className={`tw-rounded-full tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-transition-all ${isActive ? "tw-shadow-sm" : "hover:tw-brightness-95"}`}
                style={isActive ? { background: color, color: "#fff" } : { background: bg, color }}
              >
                {`${label} (${count})`}
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
          <table className="tw-w-full tw-min-w-[1180px] tw-table-auto tw-text-left tw-text-sm">
            <thead>
              <tr className="tw-bg-gray-50 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-gray-500">
                <th className="tw-px-4 tw-py-3 tw-whitespace-nowrap">#</th>
                {columns.map((c) => {
                  const active = sortKey === c.key;
                  return (
                    <th key={c.key} className="tw-px-4 tw-py-3 tw-whitespace-nowrap" aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
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
                <th className="tw-px-4 tw-py-3 tw-whitespace-nowrap">PDF</th>
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
                const badge = workStatusBadge(r);
                const canOpenPdf = normalizeStatus(r.status, r.stage, r.repair_result) === "completed";
                const brand = brandOf(r);
                return (
                  <tr
                    key={r.id}
                    onClick={() => openReport(r)}
                    title={`${t.openReportTitle} · ${r.station_name || r.station_id}`}
                    className="tw-cursor-pointer tw-border-t tw-border-gray-100 hover:tw-bg-blue-50/30"
                  >
                    <td className="tw-px-4 tw-py-3 tw-text-gray-400">{page * pageSize + i + 1}</td>
                    <td className="tw-px-4 tw-py-3 tw-font-medium tw-text-gray-800">{r.station_name || r.station_id}</td>
                    <td className="tw-px-4 tw-py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFilter("brand", brand); }}
                        className={`tw-rounded tw-px-1.5 tw-py-0.5 tw-text-xs tw-transition-colors ${
                          filters.brand === brand ? "tw-bg-blue-100 tw-text-blue-700 tw-font-bold" : "tw-text-gray-600 hover:tw-bg-gray-100"
                        } ${brand === UNKNOWN_BRAND ? "tw-text-gray-400" : ""}`}
                      >
                        {brand}
                      </button>
                    </td>
                    <td className="tw-px-4 tw-py-3 tw-text-gray-600">{workNumberOf(r.issue_id, "SR") || "-"}</td>
                    <td className="tw-px-4 tw-py-3 tw-text-gray-600">{(isWorkOrder(r) && workNumberOf(r.issue_id, "WO")) || "-"}</td>
                    <td className="tw-px-4 tw-py-3 tw-text-gray-600">
                      <span className="tw-inline-flex tw-items-center tw-gap-1.5">
                        {r.reported_by || "-"}
                        {originOf(r) === "auto" && (
                          <span className="tw-rounded tw-bg-indigo-100 tw-px-1 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-text-indigo-700">AUTO</span>
                        )}
                      </span>
                    </td>
                    <td className="tw-px-4 tw-py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); r.faulty_equipment && toggleFilter("equipment", r.faulty_equipment); }}
                        className={`tw-rounded tw-px-1.5 tw-py-0.5 tw-text-xs tw-transition-colors ${
                          filters.equipment === r.faulty_equipment ? "tw-bg-blue-100 tw-text-blue-700 tw-font-bold" : "tw-text-gray-600 hover:tw-bg-gray-100"
                        }`}
                      >
                        {displayFaultyEquipment(r) || "-"}
                      </button>
                    </td>
                    <td className="tw-px-4 tw-py-3 tw-text-gray-600">
                      <span className="tw-block tw-max-w-[240px] tw-truncate tw-text-xs" title={r.problem_details || ""}>
                        {r.problem_details || "-"}
                      </span>
                    </td>
                    <td className="tw-px-4 tw-py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); r.severity && toggleFilter("severity", r.severity); }}
                        className={`tw-rounded tw-px-1.5 tw-py-0.5 tw-text-xs tw-transition-colors ${
                          filters.severity === r.severity ? "tw-bg-blue-100 tw-text-blue-700 tw-font-bold" : "tw-text-gray-600 hover:tw-bg-gray-100"
                        }`}
                      >
                        {r.severity || "-"}
                      </button>
                    </td>
                    <td className="tw-px-4 tw-py-3 tw-text-gray-500 tw-whitespace-nowrap">
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
                    <td className="tw-px-4 tw-py-3 tw-text-center">
                      {r.id && canOpenPdf ? (
                        <a
                          href={`${API_BASE}/pdf/cm/${encodeURIComponent(r.id)}/export?station_id=${encodeURIComponent(r.station_id || "")}&lang=${lang}&dl=0`}
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
