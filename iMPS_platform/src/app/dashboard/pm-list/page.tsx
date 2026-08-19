"use client";

/**
 * PM List — ตารางใบงาน PM รวมทุกสถานี (มาแทนหน้า "PM report (All)" เดิม)
 *
 * ใช้แพทเทิร์นเดียวกับ /dashboard/cm-list ทั้งหมด:
 *   header + ตัวกรอง ปี/เดือน/สัปดาห์ → toolbar สถานี/ชนิด/สถานะ/แถวต่อหน้า
 *   → ช่องค้นหา → ตารางคอลัมน์เรียงได้ทุกคอลัมน์ → คลิกแถวเปิดเอกสาร → PDF
 *
 * ข้อมูล 2 ชุดรวมกันเป็นตารางเดียว (เหมือน CM ที่ใบงานทุกด่านอยู่ตารางเดียว):
 *   GET /pm-reports/all-stations — เอกสาร PM ที่ช่างกรอกแล้ว
 *   GET /maximo/pm/open          — ใบงาน Maximo ที่ยังไม่ได้ assign = สถานะ Open
 * ใบงานที่มีเอกสารแล้วจะไม่โชว์ซ้ำ (dedup ด้วย wonum)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@material-tailwind/react";
import { DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "@/utils/api";
import useLanguage from "@/utils/useLanguage";
import { PM_ORIGIN_LIST } from "@/app/dashboard/pm-report/lib/origin";
import { PM_PLANNING_ROLES } from "@/app/dashboard/pm-report/components/planning";
import { PM_APPROVE_ROLES } from "@/app/dashboard/pm-report/components/flow";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;
const LIMIT_PER_SOURCE = 200;
const WO_LIMIT = 1000;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type PMRow = {
  id: string;
  document_name: string;
  issue_id: string;
  wonum?: string;
  pm_type: string;          // CHARGER | MDB | CCB | CB-BOX | STATION
  pm_date: string;
  status: string;
  technician: string;
  sn: string;
  chargeBoxID: string;
  station_id: string;
  station_name?: string;
  side: string;
  created_at: string;
  file_url: string;
  /** แถวใบงาน Maximo ที่ยังไม่มีเอกสาร PM — ด่าน Open ของ flow */
  kind?: "report" | "wo";
  planning_status?: string;
  assignees?: string[];
  /** false = เลข wonum นี้ไม่มีอยู่จริงใน Maximo · null = เช็คไม่ได้ */
  exists_in_maximo?: boolean | null;
};

/** ด่านของงาน — ชื่อเดียวกับที่ใช้ในหน้า PM report */
type PmStage = "open" | "in_progress" | "wait_approve" | "closed";

/** ใบเก่าไม่มี status / เป็น "submitted" = ปิดไปแล้วก่อนมี flow อนุมัติ */
function stageOf(row: PMRow): PmStage {
  // ใบงาน Maximo: assign แล้ว = In Progress เหมือนในตารางของแต่ละ tab
  if (row.kind === "wo") {
    return String(row.planning_status ?? "pending").trim().toLowerCase() === "planned"
      ? "in_progress"
      : "open";
  }
  const s = String(row.status ?? "").trim().toLowerCase();
  if (s === "wait for approve") return "wait_approve";
  if (s === "draft") return "in_progress";
  return "closed";
}

const STAGE_STYLE: Record<PmStage, { bg: string; text: string }> = {
  open: { bg: "#fee2e2", text: "#dc2626" },
  in_progress: { bg: "#fff7ed", text: "#ea580c" },
  wait_approve: { bg: "#f3e8ff", text: "#7e22ce" },
  closed: { bg: "#dcfce7", text: "#15803d" },
};

const PM_TYPES = ["CHARGER", "MDB", "CCB", "CB-BOX", "STATION"] as const;

// ชนิดเอกสาร → tab ของหน้า /dashboard/pm-report
const TYPE_TO_TAB: Record<string, string> = {
  CHARGER: "charger",
  MDB: "mdb",
  CCB: "ccb",
  "CB-BOX": "cb-box",
  STATION: "station",
};

type SortKey = "station" | "wo" | "document" | "technician" | "date" | "status";
type SortDir = "asc" | "desc";

const STAGE_RANK: Record<PmStage, number> = { open: 0, in_progress: 1, wait_approve: 2, closed: 3 };

/** pm_type ของใบงาน Maximo (CG/MB/CC/CB/ST) → ป้ายชนิดที่ตารางใช้ */
const WO_PM_TYPE_LABEL: Record<string, string> = {
  CG: "CHARGER", MB: "MDB", CC: "CCB", CB: "CB-BOX", ST: "STATION",
};

function yearOf(dateStr: string): number | null {
  const y = Number(String(dateStr || "").slice(0, 4));
  return Number.isFinite(y) && y > 1900 ? y : null;
}
function monthOf(dateStr: string): number | null {
  const m = Number(String(dateStr || "").slice(5, 7));
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : null;
}
function weekOf(dateStr: string): number | null {
  const d = Number(String(dateStr || "").slice(8, 10));
  return Number.isFinite(d) && d >= 1 ? Math.floor((d - 1) / 7) + 1 : null;
}
function weeksInMonth(year: number, month: number): number {
  return Math.ceil(new Date(year, month + 1, 0).getDate() / 7);
}

export default function PMListPage() {
  const [rows, setRows] = useState<PMRow[]>([]);
  const [me, setMe] = useState<{ username: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [yearSel, setYearSel] = useState<number | "all">("all");
  const [monthSel, setMonthSel] = useState<number | "all">("all");
  const [weekSel, setWeekSel] = useState<number | "all">("all");
  const [stationFilter, setStationFilter] = useState("All");
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
        if (alive) setMe({ username: u?.username ?? "", role: String(u?.role ?? "").trim().toLowerCase() });
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
        const [repRes, woRes] = await Promise.allSettled([
          apiFetch(`/pm-reports/all-stations?limit_per_source=${LIMIT_PER_SOURCE}`),
          apiFetch(`/maximo/pm/open?only_open=true&limit=${WO_LIMIT}`),
        ]);

        if (repRes.status === "rejected") throw repRes.reason;
        const json = await repRes.value.json();
        if (!repRes.value.ok) throw new Error(json?.detail || `HTTP ${repRes.value.status}`);
        const reports: PMRow[] = (Array.isArray(json?.reports) ? json.reports : [])
          .map((r: PMRow) => ({ ...r, kind: "report" as const }));

        // ใบงาน Maximo — ถ้าโหลดไม่ได้ก็ยังโชว์เอกสารได้ ไม่ต้องล้มทั้งหน้า
        let woRows: PMRow[] = [];
        if (woRes.status === "fulfilled" && woRes.value.ok) {
          const wj = await woRes.value.json().catch(() => ({}));
          const items: any[] = Array.isArray(wj?.items) ? wj.items : [];
          // ใบที่มีเอกสารแล้วไม่ต้องโชว์ซ้ำ — งาน 1 ใบ = 1 แถวที่ไล่สถานะไปเรื่อย ๆ
          const withReport = new Set(
            reports.map((r) => String(r.wonum || "").trim()).filter(Boolean)
          );
          // เอกสาร PM ไม่ได้เก็บ assignees ไว้เอง — ยืมจากใบงานต้นทางผ่าน wonum
          // เพื่อให้กรองงานของช่างได้ทั้งแถว WO และแถวเอกสาร
          const assigneesByWonum = new Map<string, string[]>();
          for (const w of items) {
            const wn = String(w?.wonum || "").trim();
            if (wn) assigneesByWonum.set(wn, (Array.isArray(w?.assignees) ? w.assignees : []).filter(Boolean));
          }
          for (const r of reports) {
            const wn = String(r.wonum || "").trim();
            if (wn && assigneesByWonum.has(wn)) r.assignees = assigneesByWonum.get(wn);
          }
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
              status: "Open",
              planning_status: String(w?.planning_status || "pending"),
              // ผู้ตรวจสอบ = คนที่กรอกเอกสารจริง ใบงานที่ยังไม่มีเอกสารจึงเว้นว่าง
              // (ช่างที่ถูกมอบหมายยังอยู่ใน assignees ใช้กรองงานของช่างได้เหมือนเดิม)
              technician: "",
              assignees: Array.isArray(w?.assignees) ? w.assignees.filter(Boolean) : [],
              sn: String(w?.sn || ""),
              chargeBoxID: "",
              station_id: String(w?.station_id || ""),
              station_name: String(w?.station_id || w?.location || ""),
              side: "",
              created_at: String(w?.receivedAt || ""),
              file_url: "",
              exists_in_maximo: w?.exists_in_maximo ?? null,
            }));
        }

        setRows([...woRows, ...reports]);
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
      pageTitle: "PM List",
      subtitle: (n: number) => `ข้อมูลจาก iMPS · ${n} รายการทั้งหมด`,
      yearLabel: "ปี", monthLabel: "เดือน", weekLabel: "สัปดาห์",
      allYears: "ทุกปี", allMonths: "ทุกเดือน", allWeeks: "ทุกสัปดาห์",
      weekOption: (n: number) => `สัปดาห์ที่ ${n}`,
      monthsLong: ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"],
      stationFilterLabel: "กรองตามสถานี",
      typeFilterLabel: "ชนิดอุปกรณ์",
      allTypes: "ทุกชนิด",
      statusFilterLabel: "กรองตามสถานะ",
      rowsPerPage: "แถวต่อหน้า",
      tableCount: (n: number, q?: string) => `${n} รายการ${q ? ` · "${q}"` : ""}`,
      searchPlaceholder: "ค้นหา station, WO, ชื่อเอกสาร, ช่าง, SN…",
      clearFilters: "ล้างตัวกรอง",
      pagination: (from: number, to: number, total: number) => `แสดง ${from}–${to} จาก ${total} รายการ`,
      loading: "กำลังโหลด",
      errorPrefix: "โหลดข้อมูลไม่สำเร็จ",
      noResults: (q?: string) => (q ? `ไม่พบรายการที่ตรงกับ "${q}"` : "ไม่มีรายการ"),
      openReportTitle: "เปิดเอกสาร PM",
      openPlanTitle: "เปิดหน้าวางแผน",
      notInMaximo: "เลขใบงานนี้ไม่มีอยู่จริงใน Maximo — วางแผนแล้วส่งสถานะกลับไม่ได้",
      noWonum: "เอกสารนี้ไม่ได้ผูกกับใบงาน Maximo",
      sortAsc: "เรียงจากน้อยไปมาก", sortDesc: "เรียงจากมากไปน้อย",
      headers: {
        station: "สถานี", wo: "WO (Maximo)", document: "ชื่อเอกสาร",
        technician: "ผู้ตรวจสอบ", date: "วันที่ PM", status: "สถานะ",
      },
      stage: { open: "Open", in_progress: "In Progress", wait_approve: "Wait for approve", closed: "Closed" },
    },
    en: {
      pageTitle: "PM List",
      subtitle: (n: number) => `From iMPS · ${n} records`,
      yearLabel: "Year", monthLabel: "Month", weekLabel: "Week",
      allYears: "All years", allMonths: "All months", allWeeks: "All weeks",
      weekOption: (n: number) => `Week ${n}`,
      monthsLong: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      stationFilterLabel: "Station",
      typeFilterLabel: "Equipment type",
      allTypes: "All types",
      statusFilterLabel: "Status",
      rowsPerPage: "Rows per page",
      tableCount: (n: number, q?: string) => `${n} record(s)${q ? ` · "${q}"` : ""}`,
      searchPlaceholder: "Search station, WO, document, technician, SN…",
      clearFilters: "Clear filters",
      pagination: (from: number, to: number, total: number) => `Showing ${from}–${to} of ${total}`,
      loading: "Loading",
      errorPrefix: "Failed to load",
      noResults: (q?: string) => (q ? `No records match "${q}"` : "No records"),
      openReportTitle: "Open PM report",
      openPlanTitle: "Open planning page",
      notInMaximo: "This work order does not exist in Maximo — status updates will fail",
      noWonum: "This document is not linked to a Maximo work order",
      sortAsc: "Sort ascending", sortDesc: "Sort descending",
      headers: {
        station: "Station", wo: "WO (Maximo)", document: "Document",
        technician: "Inspector", date: "PM date", status: "Status",
      },
      stage: { open: "Open", in_progress: "In Progress", wait_approve: "Wait for approve", closed: "Closed" },
    },
  }[lang]), [lang]);

  const stageLabel = t.stage as Record<PmStage, string>;

  const openReport = useCallback((r: PMRow) => {
    if (!r.id) return;
    const tab = TYPE_TO_TAB[r.pm_type] ?? "charger";

    // หน้า PM report อ่านตู้/สถานีที่เลือกจาก localStorage — ตั้งให้ตรงกับแถวที่กด
    localStorage.removeItem("selected_sn");
    localStorage.removeItem("selected_charger_no");
    if (r.station_id) localStorage.setItem("selected_station_id", r.station_id);
    if (r.station_name || r.station_id) {
      localStorage.setItem("selected_station_name", r.station_name || r.station_id);
    }
    if (tab === "charger" && r.sn && r.sn !== "-") {
      localStorage.setItem("selected_sn", r.sn);
      window.dispatchEvent(new CustomEvent("charger:selected"));
    } else {
      window.dispatchEvent(new CustomEvent("station:selected"));
    }

    // แถวใบงาน Maximo ยังไม่มีเอกสาร → planner ไปหน้าวางแผน
    // ส่วนคนที่วางแผนไม่ได้ (ช่าง) ไปหน้าข้อมูลใบงานที่มีปุ่ม "เริ่ม PM"
    // from= ให้ปุ่มย้อนกลับในฟอร์มรู้ว่าต้องพากลับมาหน้านี้ ไม่ใช่ตาราง tab
    const canPlan = PM_PLANNING_ROLES.includes(me?.role ?? "");
    // สิทธิ์อนุมัติแคบกว่าสิทธิ์วางแผน (owner วางแผนได้ แต่อนุมัติไม่ได้)
    // ใช้ชุดเดียวกับที่ backend เช็ค ไม่งั้นโชว์ปุ่มแล้วกดไปโดน 403
    const canApprove = PM_APPROVE_ROLES.includes(me?.role ?? "");
    const params = r.kind === "wo"
      ? new URLSearchParams({
          tab, view: "form", wonum: r.wonum || r.id, from: PM_ORIGIN_LIST,
          ...(canPlan ? { planning: "1" } : { wo_info: "1" }),
        })
      // ใบที่รออนุมัติ → เปิดหน้าตรวจหน้าเดียวกันทุก role
      //   ผู้อนุมัติ  → approve=1 มีปุ่มอนุมัติ/ตีกลับ
      //   ช่างเจ้าของงาน → review=1 เห็นข้อมูลชุดเดียวกันแต่แก้ไม่ได้
      : new URLSearchParams({
          tab, view: "form", edit_id: r.id, from: PM_ORIGIN_LIST,
          ...(stageOf(r) === "wait_approve"
            ? { [canApprove ? "approve" : "review"]: "1", action: "post", pmtab: "post" }
            : {}),
        });
    if (tab === "charger" && r.sn && r.sn !== "-") params.set("sn", r.sn);
    else if (r.station_id) params.set("station_id", r.station_id);
    router.push(`/dashboard/pm-report?${params.toString()}`);
  }, [router, me]);

  const clearAll = () => {
    setTypeFilter(null);
    setStageFilter(null);
    setStationFilter("All");
    setSearch("");
    setPage(0);
  };
  const activeFilterCount =
    (typeFilter ? 1 : 0) + (stageFilter ? 1 : 0) + (stationFilter !== "All" ? 1 : 0);

  // ช่างเห็นเฉพาะงานที่ planner มอบหมายให้ตัวเอง — role อื่นเห็นทุกใบ
  const scopedRows = useMemo(() => {
    if (!me || me.role !== "technician") return rows;
    const uname = me.username.trim().toLowerCase();
    if (!uname) return [];
    const isMine = (v?: string) => String(v ?? "").trim().toLowerCase() === uname;
    return rows.filter((r) =>
      (r.assignees ?? []).some(isMine) || isMine(r.technician)
    );
  }, [rows, me]);

  const stations = useMemo(() => {
    const names = Array.from(new Set(scopedRows.map((r) => r.station_name || r.station_id))).filter(Boolean);
    return ["All", ...names.sort()];
  }, [scopedRows]);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const r of scopedRows) {
      const y = yearOf(r.pm_date);
      if (y) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [scopedRows]);

  const weekCount = useMemo(
    () => (yearSel !== "all" && monthSel !== "all" ? weeksInMonth(yearSel, monthSel) : 0),
    [yearSel, monthSel]
  );

  const periodRows = useMemo(() => {
    return scopedRows.filter((r) => {
      if (stationFilter !== "All" && (r.station_name || r.station_id) !== stationFilter) return false;
      if (yearSel !== "all" && yearOf(r.pm_date) !== yearSel) return false;
      if (monthSel !== "all" && monthOf(r.pm_date) !== monthSel) return false;
      if (weekSel !== "all" && weekOf(r.pm_date) !== weekSel) return false;
      return true;
    });
  }, [scopedRows, stationFilter, yearSel, monthSel, weekSel]);

  const applySearch = useCallback((list: PMRow[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.station_name, r.station_id, r.wonum, r.issue_id, r.document_name, r.technician, r.sn, r.chargeBoxID, r.pm_type]
        .some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [search]);

  const searchFiltered = useMemo(() => {
    let list = periodRows;
    if (typeFilter) list = list.filter((r) => r.pm_type === typeFilter);
    if (stageFilter) list = list.filter((r) => stageOf(r) === stageFilter);
    return applySearch(list);
  }, [periodRows, typeFilter, stageFilter, applySearch]);

  // ตัวนับบนปุ่มสถานะ — ไม่ขึ้นกับตัวกรองสถานะที่เลือกอยู่ (เหมือน CM List)
  const stageCounts = useMemo(() => {
    let base = periodRows;
    if (typeFilter) base = base.filter((r) => r.pm_type === typeFilter);
    base = applySearch(base);
    const counts: Record<PmStage, number> = { open: 0, in_progress: 0, wait_approve: 0, closed: 0 };
    for (const r of base) counts[stageOf(r)]++;
    return counts;
  }, [periodRows, typeFilter, applySearch]);

  const sortValue = useCallback((r: PMRow, key: SortKey): string | number => {
    switch (key) {
      case "station": return (r.station_name || r.station_id || "").toLowerCase();
      case "wo": return (r.wonum || "").toLowerCase();
      case "document": return (r.document_name || "").toLowerCase();
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
      // วันที่เริ่มจากล่าสุด ข้อความเริ่ม A→Z
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: "station", label: t.headers.station },
    { key: "wo", label: t.headers.wo },
    { key: "document", label: t.headers.document },
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
          <span>{t.errorPrefix}: <strong>{error}</strong></span>
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

        <div className="tw-flex tw-items-center tw-gap-1.5">
          <label htmlFor="type-filter" className="tw-text-xs tw-font-medium tw-text-gray-500">{t.typeFilterLabel}</label>
          <select
            id="type-filter" value={typeFilter ?? "all"}
            onChange={(e) => { setTypeFilter(e.target.value === "all" ? null : e.target.value); setPage(0); }}
            className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-white tw-px-3 tw-py-1.5 tw-text-sm tw-text-gray-700 tw-shadow-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-400"
          >
            <option value="all">{t.allTypes}</option>
            {PM_TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
          </select>
        </div>

        <div className="tw-flex tw-items-center tw-gap-1.5" role="group" aria-label={t.statusFilterLabel}>
          {(["open", "in_progress", "wait_approve", "closed"] as const).map((key) => {
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
                {stageLabel[key]} ({stageCounts[key]})
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
          <table className="tw-w-full tw-min-w-[1000px] tw-table-auto tw-text-left tw-text-sm">
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
                const stage = stageOf(r);
                const style = STAGE_STYLE[stage];
                const pdfHref = r.file_url
                  ? (r.file_url.startsWith("http") ? r.file_url : `${API_BASE}${r.file_url}`)
                  : "";
                return (
                  <tr
                    key={`${r.id}-${r.pm_type}-${i}`}
                    onClick={() => openReport(r)}
                    title={`${r.kind === "wo" ? t.openPlanTitle : t.openReportTitle} · ${r.station_name || r.station_id}`}
                    className="tw-cursor-pointer tw-border-t tw-border-gray-100 hover:tw-bg-blue-50/30"
                  >
                    <td className="tw-px-4 tw-py-3 tw-text-gray-400">{page * pageSize + i + 1}</td>
                    <td className="tw-px-4 tw-py-3 tw-font-medium tw-text-gray-800">{r.station_name || r.station_id}</td>
                    {/* คอลัมน์นี้คือเลขใบงานฝั่ง Maximo เท่านั้น
                        เดิมถ้าไม่มีจะถอยไปโชว์ issue_id ของ iMPS ซึ่งคนละเลขกัน
                        อ่านแล้วนึกว่าเป็น WO ทั้งที่ใบนั้นไม่ได้ผูกกับ Maximo เลย */}
                    <td className="tw-px-4 tw-py-3 tw-text-gray-600">
                      <span className="tw-inline-flex tw-items-center tw-gap-1.5">
                        {r.wonum ? (
                          <span className="tw-font-mono">{r.wonum}</span>
                        ) : (
                          <span className="tw-text-gray-300" title={t.noWonum}>—</span>
                        )}
                        {/* เลขที่ Maximo ไม่รู้จัก — วางแผนไปก็ส่งสถานะกลับไม่ได้ */}
                        {r.exists_in_maximo === false && (
                          <span
                            title={t.notInMaximo}
                            className="tw-rounded tw-bg-red-100 tw-px-1.5 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-text-red-700"
                          >
                            !
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="tw-px-4 tw-py-3 tw-text-gray-600">
                      <span className="tw-block tw-max-w-[240px] tw-truncate" title={r.document_name || ""}>
                        {r.document_name || "-"}
                      </span>
                    </td>
                    <td className="tw-px-4 tw-py-3 tw-text-gray-600">{r.technician || "-"}</td>
                    <td className="tw-px-4 tw-py-3 tw-whitespace-nowrap tw-text-gray-500">
                      {r.pm_date && r.pm_date !== "-"
                        ? new Date(r.pm_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : "-"}
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
              <span className="tw-px-2 tw-text-xs tw-text-gray-500">{page + 1} / {totalPages}</span>
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
