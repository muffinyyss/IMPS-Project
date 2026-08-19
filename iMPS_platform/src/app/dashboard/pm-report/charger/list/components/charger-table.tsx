"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type CellContext,
  type SortingState,
} from "@tanstack/react-table";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  Typography,
} from "@material-tailwind/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/solid";
import { ArrowUpTrayIcon, DocumentArrowDownIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";
import ChargerPMForm from "@/app/dashboard/pm-report/charger/input_PMreport/components/checkList";
import { apiFetch } from "@/utils/api";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import LoadingOverlay from "@/app/dashboard/components/Loadingoverlay";
import PmPlanForm from "@/app/dashboard/pm-report/components/PmPlanForm";
import PmWorkOrderInfo from "@/app/dashboard/pm-report/components/PmWorkOrderInfo";
import { pmBackRoute } from "@/app/dashboard/pm-report/lib/origin";

// ใบที่เปิดดูหน้าตรวจได้: รออนุมัติ (ยังตัดสินใจได้) และปิดแล้ว (ดูย้อนหลัง)
const REVIEWABLE: ReturnType<typeof toPmFlow>[] = ["wait_approve", "closed"];

import {
  derivePlanningStatus,
  equipLabel,
  PM_PLANNING_ROLES,
  type MaximoWorkOrder,
} from "@/app/dashboard/pm-report/components/planning";

// ==================== TRANSLATIONS ====================
const T = {
  // Page Header
  pageTitle: { th: "Preventive Maintenance Checklist - Charger", en: "Preventive Maintenance Checklist - Charger" },
  pageSubtitle: { th: "ค้นหาและดาวน์โหลดเอกสาร PM Report", en: "Search and download PM Report documents" },

  // Buttons
  upload: { th: "อัพโหลด", en: "Upload" },
  add: { th: "+ เพิ่ม", en: "+ Add" },
  postPm: { th: "Post-PM", en: "Post-PM" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  uploadBtn: { th: "อัพโหลด", en: "Upload" },

  // Table Headers
  colNo: { th: "ลำดับ", en: "No." },
  colDocName: { th: "ชื่อเอกสาร", en: "Document Name" },
  colIssueId: { th: "WO", en: "WO" },
  colPmDate: { th: "วันที่ PM", en: "PM Date" },
  colInspector: { th: "ผู้ตรวจสอบ", en: "Inspector" },
  colStatus: { th: "สถานะ", en: "Status" },
  colPdf: { th: "PDF", en: "PDF" },

  // Workflow statuses — ชื่อเดียวกับด่านของงาน
  //   Maximo เปิดใบ → Open
  //   planner assign → In Progress
  //   technician กรอกเสร็จ → Wait for approve
  //   planner approve → Closed
  stDraft: { th: "In Progress", en: "In Progress" },
  stWaitApprove: { th: "Wait for approve", en: "Wait for approve" },
  stClosed: { th: "Closed", en: "Closed" },
  // ตีกลับ = กลับไปอยู่ด่าน In Progress ของช่าง (เหตุผลที่ตีกลับดูได้จาก tooltip)
  stRejected: { th: "In Progress", en: "In Progress" },

  // Approve / Reject
  approve: { th: "อนุมัติ", en: "Approve" },
  reject: { th: "ตีกลับ", en: "Reject" },
  approveTitle: { th: "อนุมัติปิดใบงาน PM", en: "Approve and close PM work order" },
  approveConfirm: { th: "ยืนยันอนุมัติปิดใบงานนี้หรือไม่?", en: "Close this work order?" },
  rejectTitle: { th: "ตีกลับใบงานให้ช่างแก้", en: "Send back to technician" },
  rejectRemarkLabel: { th: "เหตุผลที่ตีกลับ", en: "Reason" },
  rejectRemarkRequired: { th: "กรุณาระบุเหตุผลที่ตีกลับ", en: "A reason is required" },
  approvedBy: { th: "อนุมัติโดย", en: "Approved by" },
  rejectedBy: { th: "ตีกลับโดย", en: "Sent back by" },
  approveSuccess: { th: "อนุมัติปิดใบงานแล้ว", en: "Work order closed" },
  rejectSuccess: { th: "ตีกลับใบงานให้ช่างแล้ว", en: "Sent back to technician" },
  approveFailed: { th: "อนุมัติไม่สำเร็จ:", en: "Approve failed:" },
  rejectFailed: { th: "ตีกลับไม่สำเร็จ:", en: "Reject failed:" },
  confirmBtn: { th: "ยืนยัน", en: "Confirm" },
  fixAndResubmit: { th: "แก้ไข", en: "Fix" },

  // Maximo work orders (แถวใบงานที่ยังไม่มีเอกสาร PM)
  stWoPending: { th: "Open", en: "Open" },
  stWoPlanned: { th: "In Progress", en: "In Progress" },
  planBtn: { th: "วางแผน", en: "Plan" },
  editPlanBtn: { th: "แก้แผน", en: "Edit plan" },
  viewPlanBtn: { th: "ดูแผน", en: "View plan" },
  planSaved: { th: "บันทึกแผนแล้ว", en: "Plan saved" },
  woFromMaximo: { th: "ใบงานจาก Maximo", en: "Work order from Maximo" },
  fillPmBtn: { th: "กรอก PM", en: "Fill PM" },

  // Workflow sub-tabs
  tabOpen: { th: "Open", en: "Open" },
  tabInProgress: { th: "In Progress", en: "In Progress" },
  tabClosed: { th: "Closed", en: "Closed" },

  // Pagination
  entriesPerPage: { th: "รายการต่อหน้า", en: "entries per page" },
  page: { th: "หน้า", en: "Page" },
  of: { th: "จาก", en: "of" },

  // Search
  search: { th: "ค้นหา", en: "Search" },

  // Loading / Empty States
  loading: { th: "กำลังโหลด...", en: "Loading..." },
  noData: { th: "ไม่มีข้อมูล", en: "No data" },
  selectChargerFirst: { th: "กรุณาเลือก Charger จากแถบด้านบนก่อน", en: "Please select a charger from the top bar first" },
  noFile: { th: "ไม่มีไฟล์", en: "No file" },

  // Dialog
  dialogTitle: { th: "อัปโหลดไฟล์ PM", en: "Upload PM File" },
  docNameLabel: { th: "ชื่อเอกสาร", en: "Document Name" },
  issueIdLabel: { th: "Issue ID", en: "Issue ID" },
  inspectorLabel: { th: "ผู้ตรวจสอบ", en: "Inspector" },
  pmDateLabel: { th: "วันที่ PM", en: "PM Date" },
  filesSelected: { th: "ไฟล์ที่เลือก:", en: "Selected files:" },
  filesUnit: { th: "ไฟล์", en: "file(s)" },

  // Alerts
  alertSelectCharger: { th: "กรุณาเลือก Charger ก่อน", en: "Please select a charger first" },
  alertPdfOnly: { th: "รองรับเฉพาะไฟล์ PDF เท่านั้น", en: "Only PDF files are supported" },
  alertInvalidDate: { th: "รูปแบบวันที่ไม่ถูกต้อง", en: "Invalid date format" },
  alertUploadFailed: { th: "อัพโหลดไม่สำเร็จ:", en: "Upload failed:" },
  alertUploadSuccess: { th: "อัพโหลดสำเร็จ", en: "Upload successful" },
  alertUploadError: { th: "เกิดข้อผิดพลาดระหว่างอัพโหลด", en: "An error occurred during upload" },

  // Tooltips
  uploadPdf: { th: "อัพโหลด PDF", en: "Upload PDF" },
  preview: { th: "ดูตัวอย่าง", en: "Preview" },
  downloadPhotos: { th: "ดาวน์โหลดรูปภาพ", en: "Download Photos" },

  // Overlay
  loadingData: { th: "กำลังโหลดข้อมูล...", en: "Loading data..." },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

type TData = {
  id?: string;
  doc_name?: string;
  issue_id?: string;
  pm_date: string;
  position: string;
  office: string;
  inspector?: string;
  side?: string;
  has_photos?: boolean;
  status?: string;
  reject_remark?: string;
  rejected_by?: string;
  approved_by?: string;
  /** แถวใบงาน Maximo ที่ยังไม่มีเอกสาร PM — ด่าน "planner วางแผน" ของ flow */
  kind?: "report" | "wo";
  wonum?: string;
  planning_status?: string;
  assignees?: string[];
  sched_start?: string;
  selected_equipment_label?: string;
  /** ช่างที่ planner มอบหมาย — คนละอย่างกับ inspector ที่เป็นคนกรอกจริง */
  assignees_label?: string;
};

/** สถานะใน flow PM — ให้ตรงกับที่ backend เขียนลง PMReport (pmreport_charger.py) */
type PmFlow = "draft" | "wait_approve" | "closed" | "rejected" | "wo_pending" | "wo_planned";

/** ใบเก่าไม่มี status / เป็น "submitted" = ปิดไปแล้วก่อนมี flow อนุมัติ */
function toPmFlow(row: TData): PmFlow {
  if (row.kind === "wo") {
    return derivePlanningStatus(0, row.planning_status ?? "pending") === "planned"
      ? "wo_planned"
      : "wo_pending";
  }
  const s = String(row.status ?? "").trim().toLowerCase();
  if (s === "wait for approve") return "wait_approve";
  if (s === "draft") return row.reject_remark ? "rejected" : "draft";
  return "closed";
}

const PM_APPROVE_ROLES = ["admin", "planner"];

/** แท็บตามด่านของงาน — จัดกลุ่มสถานะแบบเดียวกับหน้า CM */
type FlowTab = "open" | "in-progress" | "closed";

const FLOW_TABS: { id: FlowTab; key: "tabOpen" | "tabInProgress" | "tabClosed" }[] = [
  { id: "open", key: "tabOpen" },
  { id: "in-progress", key: "tabInProgress" },
  { id: "closed", key: "tabClosed" },
];

//  open        = ใบงาน Maximo ที่ planner ยังไม่วางแผน
//  in-progress = วางแผนแล้ว / ช่างกำลังกรอก / โดนตีกลับ / รออนุมัติ
//  closed      = planner อนุมัติปิดแล้ว (รวมใบเก่าที่ปิดก่อนมี flow อนุมัติ)
const FLOW_TAB_OF: Record<PmFlow, FlowTab> = {
  wo_pending: "open",
  wo_planned: "in-progress",
  draft: "in-progress",
  rejected: "in-progress",
  wait_approve: "in-progress",
  closed: "closed",
};

type Props = {
  token?: string;
  apiBase?: string;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const REPORT_PREFIX = "pmreport";
const URL_PREFIX = "pmurl";

const PM_TYPE_CODE = "CG";

function makePrefix(typeCode: string, dateISO: string) {
  const d = new Date(dateISO || new Date().toISOString().slice(0, 10));
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `PM-${typeCode}-${yy}${mm}-`;
}

function nextIssueIdFor(typeCode: string, dateISO: string, latestFromDb?: string) {
  const prefix = makePrefix(typeCode, dateISO);
  const s = String(latestFromDb || "").trim();
  if (!s || !s.startsWith(prefix)) return `${prefix}01`;
  const m = s.match(/(\d+)$/);
  const pad = m ? m[1].length : 2;
  const n = (m ? parseInt(m[1], 10) : 0) + 1;
  return `${prefix}${n.toString().padStart(pad, "0")}`;
}

// Find latest issue_id from both lists (reports + URLs) then generate next
async function fetchLatestIssueIdAcrossLists(sn: string, dateISO: string, apiBase: string, fetchOpts: RequestInit) {
  const build = (path: string) => {
    const u = new URL(`${apiBase}${path}`);
    u.searchParams.set("sn", sn);
    u.searchParams.set("page", "1");
    u.searchParams.set("pageSize", "50");
    u.searchParams.set("_ts", String(Date.now()));
    return u.toString();
  };

  const [a, b] = await Promise.allSettled([
    apiFetch(build(`/${REPORT_PREFIX}/list`), fetchOpts),
    apiFetch(build(`/${URL_PREFIX}/list`), fetchOpts),
  ]);

  let ids: string[] = [];
  for (const r of [a, b]) {
    if (r.status === "fulfilled" && r.value.ok) {
      const j = await r.value.json();
      const items: any[] = Array.isArray(j?.items) ? j.items : [];
      ids = ids.concat(items.map((it) => String(it?.issue_id || "")).filter(Boolean));
    }
  }

  const prefix = makePrefix(PM_TYPE_CODE, dateISO);
  const same = ids.filter((x) => x.startsWith(prefix));
  if (!same.length) return null;

  const toTail = (s: string) => {
    const m = s.match(/(\d+)$/);
    return m ? parseInt(m[1], 10) : -1;
  };
  return same.reduce((acc, cur) => (toTail(cur) > toTail(acc) ? cur : acc), same[0]);
}

/* ---------- Helper for doc_name ---------- */
function makeDocNameParts(sn: string, dateISO: string) {
  const d = new Date(dateISO || new Date().toISOString().slice(0, 10));
  const year = d.getFullYear();
  const prefix = `${sn}_`;
  const suffix = `/${year}`;
  return { year, prefix, suffix };
}

function nextDocNameFor(sn: string, dateISO: string, latestFromDb?: string) {
  const { prefix, suffix } = makeDocNameParts(sn, dateISO);
  const s = String(latestFromDb || "").trim();

  if (!s || !s.startsWith(prefix) || !s.endsWith(suffix)) {
    return `${prefix}1${suffix}`;
  }

  const inside = s.slice(prefix.length, s.length - suffix.length);
  const cur = parseInt(inside, 10);
  const nextIndex = isNaN(cur) ? 1 : cur + 1;

  return `${prefix}${nextIndex}${suffix}`;
}

async function fetchPreviewDocName(
  sn: string,
  pmDate: string
): Promise<string | null> {
  const u = new URL(`${BASE}/pmreport/preview-docname`);
  u.searchParams.set("sn", sn);
  u.searchParams.set("pm_date", pmDate);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ?? ""
      : "";

  const r = await apiFetch(u.toString(), {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!r.ok) {
    console.error("fetchPreviewDocName failed:", r.status);
    return null;
  }

  const j = await r.json();
  return (j && typeof j.doc_name === "string") ? j.doc_name : null;
}

async function fetchLatestDocName(
  sn: string,
  dateISO: string
): Promise<string | null> {
  const u = new URL(`${BASE}/pmreport/latest-docname`);
  u.searchParams.set("sn", sn);
  u.searchParams.set("pm_date", dateISO);
  u.searchParams.set("_ts", String(Date.now()));

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ?? ""
      : "";

  const r = await apiFetch(u.toString(), {
    credentials: "include",
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!r.ok) {
    console.error("fetchLatestDocName failed:", r.status);
    return null;
  }

  const j = await r.json();
  return (j && typeof j.doc_name === "string") ? j.doc_name : null;
}

type Me = {
  id: string;
  username: string;
  email: string;
  role: string;
  company: string;
  tel: string;
};

export default function SearchDataTables({ token, apiBase = BASE }: Props) {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [data, setData] = useState<TData[]>([]);
  const [filtering, setFiltering] = useState("");
  const [issueId, setIssueId] = useState<string>("");
  const searchParams = useSearchParams();
  const [sn, setSn] = useState<string | null>(null);
  const [docName, setDocName] = useState<string>("");
  const [me, setMe] = useState<Me | null>(null);
  const [inspector, setInspector] = useState<string>("");
  const [toast, setToast] = useState<{ show: boolean; type: "success" | "error" | "warning" | "info"; message: string }>({ show: false, type: "info", message: "" });

  const showToast = (type: "success" | "error" | "warning" | "info", message: string, duration = 4000) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), duration);
  };

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  useEffect(() => {
    const snFromUrl = searchParams.get("sn");
    if (snFromUrl) {
      setSn(snFromUrl);
      localStorage.setItem("selected_sn", snFromUrl);
      return;
    }
    const snLocal = localStorage.getItem("selected_sn");
    setSn(snLocal);
  }, [searchParams]);

  useEffect(() => {
    const useHttpOnlyCookie = true;
    (async () => {
      try {
        const headers: Record<string, string> = {};
        if (!useHttpOnlyCookie) {
          const t = typeof window !== "undefined"
            ? localStorage.getItem("access_token") ?? ""
            : "";
          if (t) headers.Authorization = `Bearer ${t}`;
        }

        const res = await apiFetch(`${apiBase}/me`, {
          method: "GET",
          headers,
          credentials: "include",
        });

        if (!res.ok) {
          console.warn("/me failed:", res.status);
          return;
        }

        const data: Me = await res.json();
        setMe(data);

        setInspector((prev) => prev || data.username || "");
      } catch (err) {
        console.error("fetch /me error:", err);
      }
    })();
  }, [apiBase]);

  const router = useRouter();
  const pathname = usePathname();
  const editId = searchParams.get("edit_id") ?? "";
  const mode: "list" | "form" =
    (searchParams.get("view") === "form" || !!editId) ? "form" : "list";
  const setView = (view: "list" | "form", { replace = false } = {}) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "form") {
      params.set("view", "form");
      params.delete("tab");
      params.set("pmtab", "pre");
    } else {
      params.delete("view");
      params.delete("edit_id");
      params.delete("pmtab");
    }
    router[replace ? "replace" : "push"](`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Helpers
  const useHttpOnlyCookie = true;
  function makeHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (!useHttpOnlyCookie) {
      const t = token || (typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "");
      if (t) h.Authorization = `Bearer ${t}`;
    }
    return h;
  }
  const FetchOpts: RequestInit = {
    headers: makeHeaders(),
    ...(useHttpOnlyCookie ? { credentials: "include" as const } : {}),
    cache: "no-store",
  };

  // Date formatting with language support
  function formatDate(iso?: string, currentLang: Lang = lang) {
    if (!iso) return "-";

    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Date(iso + "T00:00:00Z")
      : new Date(iso);

    if (isNaN(d.getTime())) return "-";

    return d.toLocaleDateString(
      currentLang === "en" ? "en-GB" : "th-TH-u-ca-gregory",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      }
    );
  }

  function toISODateOnly(s?: string) {
    if (!s) return "";
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(s);
      if (isNaN(d.getTime())) return "";
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return "";
    }
  }

  function resolveFileHref(v: any, apiBase: string) {
    if (!v) return "";
    if (typeof v === "object") {
      const c = v.url ?? v.href ?? v.link ?? "";
      return resolveFileHref(c, apiBase);
    }
    const s = String(v).trim();
    if (!s) return "";
    try {
      return new URL(s).toString();
    } catch { }
    if (s.startsWith("/")) return `${apiBase}${s}`;
    if (/^[a-f0-9]{24}$/i.test(s)) return `${apiBase}/files/${s}`;
    return `${apiBase}/${s}`;
  }

  function normalizeAnyDate(v: any): string {
    if (!v) return "";
    if (typeof v === "object" && v.$date) return toISODateOnly(String(v.$date));
    if (v instanceof Date) return toISODateOnly(v.toISOString());
    if (typeof v === "number") return toISODateOnly(new Date(v).toISOString());
    if (typeof v === "string") return toISODateOnly(v);
    return "";
  }

  function pickDateFromItem(it: any): string {
    const cands = [
      it?.pm_date,
      it?.reportDate,
      it?.job?.date,
      it?.submittedAt,
      it?.timestamp,
      it?.createdAt,
      it?.updatedAt,
      it?.date,
    ];
    for (const v of cands) {
      const d = normalizeAnyDate(v);
      if (d) return d;
    }
    return "";
  }

  const fetchRows = async (signal?: AbortSignal) => {
    if (!sn) {
      setData([]);
      return;
    }
    setLoading(true);
    try {
      const makeURL = (path: string) => {
        const u = new URL(`${apiBase}${path}`);
        u.searchParams.set("sn", sn);
        u.searchParams.set("page", "1");
        u.searchParams.set("pageSize", "50");
        u.searchParams.set("_ts", String(Date.now()));
        return u.toString();
      };
      // ใบงาน Maximo = ด่านแรกของ flow (planner ยังไม่วางแผน) — โชว์รวมในตารางเดียวกัน
      // เหมือนหน้า CM ที่ใบงานทุกด่านอยู่ในตารางเดียว ไม่แยกการ์ดใต้ตาราง
      const woURL = `${apiBase}/maximo/pm/open?source=charger&identifier=${encodeURIComponent(sn)}&only_open=true`;

      const [pmRes, urlRes, woRes] = await Promise.allSettled([
        apiFetch(makeURL("/pmreport/list"), FetchOpts),
        apiFetch(makeURL("/pmurl/list"), FetchOpts),
        apiFetch(woURL, FetchOpts),
      ]);

      let pmItems: any[] = [];
      let urlItems: any[] = [];
      let woItems: MaximoWorkOrder[] = [];

      if (woRes.status === "fulfilled" && woRes.value.ok) {
        const j = await woRes.value.json();
        if (Array.isArray(j?.items)) woItems = j.items;
      }

      if (pmRes.status === "fulfilled" && pmRes.value.ok) {
        const j = await pmRes.value.json();
        if (Array.isArray(j?.items)) pmItems = j.items;
      }
      if (urlRes.status === "fulfilled" && urlRes.value.ok) {
        const j = await urlRes.value.json();
        if (Array.isArray(j?.items)) urlItems = j.items;
      }

      const pmRows: TData[] = pmItems.map((it: any) => {
        const isoDay = pickDateFromItem(it);
        const rawUploaded =
          it.file_url ??
          (Array.isArray(it.urls) ? (it.urls[0]?.url ?? it.urls[0]) : it.url) ??
          it.file ?? it.path;

        const uploadedUrl = resolveFileHref(rawUploaded, apiBase);

        function extractId(x: any): string {
          if (!x) return "";
          const raw = (x._id !== undefined ? x._id : x.id) ?? "";
          if (raw && typeof raw === "object") return raw.$oid || raw.oid || raw.$id || "";
          const s = String(raw || "");
          return /^[a-fA-F0-9]{24}$/.test(s) ? s : "";
        }
        const id = extractId(it);
        const generatedUrl = id ? `${apiBase}/pdf/charger/${encodeURIComponent(id)}/export` : "";

        const fileUrl = uploadedUrl || generatedUrl;
        const issueId = (it.issue_id ? String(it.issue_id) : "") || extractDocIdFromAnything(fileUrl) || "";

        const doc_name = (it.doc_name ? String(it.doc_name) : "")
        const inspector = (it.inspector ?? it.job?.inspector ?? "") as string;
        const side = (it.side ?? it.job?.side ?? "") as string;
        return {
          id,
          issue_id: issueId,
          doc_name: doc_name,
          pm_date: isoDay,
          position: isoDay,
          office: fileUrl,
          inspector,
          side,
          has_photos: Boolean(it.has_photos),
          wonum: (it.wonum ?? "") as string,
          status: (it.status ?? "") as string,
          reject_remark: (it.reject_remark ?? "") as string,
          rejected_by: (it.rejected_by ?? "") as string,
          approved_by: (it.approved_by ?? "") as string,
        } as TData;
      });

      const urlRows: TData[] = urlItems.map((it: any) => {
        const isoDay = pickDateFromItem(it);
        const raw =
          it.file_url ??
          (Array.isArray(it.urls) ? (it.urls[0]?.url ?? it.urls[0]) : it.url) ??
          it.file ?? it.path;
        const href = resolveFileHref(raw, apiBase);
        const issueId = (it.issue_id ? String(it.issue_id) : "") || extractDocIdFromAnything(href) || "";
        const doc_name = (it.doc_name ? String(it.doc_name) : "")
        const inspector = (it.inspector ?? it.job?.inspector ?? "") as string;
        const side = (it.side ?? it.job?.side ?? "") as string;
        return {
          issue_id: issueId,
          doc_name: doc_name,
          pm_date: isoDay,
          position: isoDay,
          office: href,
          inspector,
          side,
          has_photos: Boolean(it.has_photos),
        } as TData;
      });

      const woRows: TData[] = woItems.map((w) => {
        const selected = w.selected_equipment ?? [];
        return {
          kind: "wo",
          wonum: w.wonum ?? "",
          issue_id: w.wonum ?? "",
          doc_name: w.description || t("woFromMaximo", lang),
          pm_date: w.pm_date ?? "",
          position: w.pm_date ?? "",
          office: "",
          // Inspector = คนที่กรอกเอกสารจริง — ใบงานที่ยังไม่มีเอกสารเว้นว่างไว้
          inspector: "",
          assignees_label: (w.assignees ?? []).filter(Boolean).join(", "),
          planning_status: w.planning_status ?? "pending",
          assignees: (w.assignees ?? []).filter(Boolean) as string[],
          sched_start: w.sched_start ?? "",
          selected_equipment_label: selected.map((e) => equipLabel(e)).join(", "),
        } as TData;
      });

      const wonumsWithReport = new Set(
        pmRows.map((r) => r.wonum).filter(Boolean) as string[]
      );
      const openWoRows = woRows.filter((r) => !r.wonum || !wonumsWithReport.has(r.wonum));

      const allRows = [...openWoRows, ...pmRows, ...urlRows].sort((a, b) => {
        const da = (a.position ?? "") as string;
        const db = (b.position ?? "") as string;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da < db ? 1 : da > db ? -1 : 0;
      });

      if (!allRows.length) { setData([]); return; }
      setData(allRows);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("fetch both lists error:", err);
      setData([]);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  function appendParam(u: string, key: string, val: string) {
    const url = new URL(u, apiBase);
    if (!url.searchParams.has(key)) url.searchParams.set(key, val);
    return url.toString();
  }

  function buildHtmlLinks(baseUrl?: string) {
    const u = (baseUrl || "").trim();
    if (!u) return { previewHref: "", downloadHref: "", isPdfEndpoint: false };

    const isPdfEndpoint = /\/pdf\/(charger|mdb|ccb|cbbox|station)\/[A-Fa-f0-9]{24}\/export(?:\b|$)/.test(u);

    if (isPdfEndpoint) {
      let finalUrl = u;
      finalUrl = appendParam(finalUrl, "sn", sn || "");
      finalUrl = appendParam(finalUrl, "lang", lang);
      return {
        previewHref: appendParam(finalUrl, "dl", "0"),
        downloadHref: appendParam(finalUrl, "dl", "1"),
        isPdfEndpoint: true,
      };
    }

    return { previewHref: u, downloadHref: u, isPdfEndpoint: false };
  }

  function extractDocIdFromAnything(x: any): string {
    if (!x) return "";
    const raw = (x._id !== undefined ? x._id : x.id) ?? "";
    let id = "";
    if (raw && typeof raw === "object") id = raw.$oid || raw.oid || raw.$id || "";
    else id = String(raw || "");
    if (/^[a-fA-F0-9]{24}$/.test(id)) return id;

    const s = typeof x === "string" ? x : JSON.stringify(x);
    const m = s.match(/[A-Fa-f0-9]{24}/);
    return m ? m[0] : "";
  }

  useEffect(() => {
    const ac = new AbortController();
    fetchRows(ac.signal);
    return () => ac.abort();
  }, [apiBase, sn, lang, searchParams.toString()]);

  // ==================== APPROVE / REJECT (planner, admin) ====================
  const canApprove = PM_APPROVE_ROLES.includes(String(me?.role ?? "").trim().toLowerCase());
  const canPlan = PM_PLANNING_ROLES.includes(String(me?.role ?? "").trim().toLowerCase());

  const [flowTab, setFlowTab] = useState<FlowTab>("open");

  // ด่านวางแผน — เข้าจากแถวในตารางเหมือน CM (?view=form&planning=1&wonum=…)
  const planningWonum = searchParams.get("planning") === "1"
    ? (searchParams.get("wonum") ?? "")
    : "";

  // หน้าข้อมูลใบงานก่อนเริ่มกรอก (?wo_info=1)
  const woInfoWonum = searchParams.get("wo_info") === "1" ? (searchParams.get("wonum") ?? "") : "";

  // กด "เริ่ม PM" → เปิดฟอร์ม Pre-PM (started=1 กันไม่ให้ถามซ้ำในฟอร์ม)
  const startPmFromInfo = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("wo_info");
    params.set("started", "1");
    params.set("pmtab", "pre");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const leaveWoInfo = () => {
    // มาจากหน้า PM List → กลับไปหน้านั้น ไม่ใช่ตาราง tab ที่ผู้ใช้ไม่เคยเปิด
    const back = pmBackRoute(searchParams);
    if (back) {
      router.push(back);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    ["view", "wo_info", "wonum", "started", "pmtab"].forEach((k) => params.delete(k));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const goPlan = (row: TData) => {
    if (!row.wonum) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "form");
    params.set("planning", "1");
    params.set("wonum", row.wonum);
    params.delete("edit_id");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // ช่างเริ่มกรอกเอกสาร PM จากใบงานที่วางแผนแล้ว
  const goFillPm = (row: TData) => {
    const params = new URLSearchParams(searchParams.toString());
    // เปิดหน้าข้อมูลใบงาน (อ่านอย่างเดียว) ก่อน ช่างกด "เริ่ม PM" ถึงจะเข้าฟอร์ม
    params.set("view", "form");
    params.set("wo_info", "1");
    params.delete("planning");
    params.delete("edit_id");
    if (row.wonum) params.set("wonum", row.wonum);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // เปิดเอกสารที่ช่างส่งมาเพื่อตรวจก่อนอนุมัติ
  const goReview = (row: TData) => {
    if (!row.id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "form"); params.set("edit_id", row.id);
    // ฟอร์มดู action=post เป็นตัวตัดสินโหมด ไม่ใช่ pmtab — ขาดตัวนี้จะเปิดเป็น Pre-PM
    // แล้วไม่เห็นสิ่งที่ช่างกรอกฝั่ง Post เลย
    // โหมดอนุมัติ (มีปุ่ม Reject/Approve) เฉพาะผู้มีสิทธิ์ + ใบที่ยังรออนุมัติอยู่
    // ใบที่ปิดไปแล้วไม่มีอะไรให้ตัดสินใจ เปิดดูอย่างเดียวเหมือนกันทุก role
    const canDecide = canApprove && toPmFlow(row) === "wait_approve";
    params.set(canDecide ? "approve" : "review", "1");
    params.set("action", "post"); params.set("pmtab", "post");
    params.delete("planning"); params.delete("wo_info"); params.delete("wonum");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const leavePlanning = () => {
    // มาจากหน้า PM List → กลับไปหน้านั้น ไม่ใช่ตาราง tab ที่ผู้ใช้ไม่เคยเปิด
    const back = pmBackRoute(searchParams);
    if (back) {
      router.push(back);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    params.delete("planning");
    params.delete("wonum");
    params.delete("edit_id");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [approveRow, setApproveRow] = useState<TData | null>(null);
  const [rejectRow, setRejectRow] = useState<TData | null>(null);
  const [rejectRemark, setRejectRemark] = useState("");
  const [acting, setActing] = useState(false);

  const onApprove = async () => {
    if (!approveRow?.id || !sn || acting) return;
    setActing(true);
    try {
      const res = await apiFetch(
        `${apiBase}/pmreport/${encodeURIComponent(approveRow.id)}/approve?sn=${encodeURIComponent(sn)}`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || `HTTP ${res.status}`);
      }
      setApproveRow(null);
      showToast("success", t("approveSuccess", lang));
      await fetchRows();
    } catch (e: any) {
      showToast("error", `${t("approveFailed", lang)} ${e?.message ?? e}`);
    } finally {
      setActing(false);
    }
  };

  const onReject = async () => {
    if (!rejectRow?.id || !sn || acting) return;
    const remark = rejectRemark.trim();
    if (!remark) {
      showToast("warning", t("rejectRemarkRequired", lang));
      return;
    }
    setActing(true);
    try {
      const res = await apiFetch(
        `${apiBase}/pmreport/${encodeURIComponent(rejectRow.id)}/reject?sn=${encodeURIComponent(sn)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ remark }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || `HTTP ${res.status}`);
      }
      setRejectRow(null);
      setRejectRemark("");
      showToast("success", t("rejectSuccess", lang));
      await fetchRows();
    } catch (e: any) {
      showToast("error", `${t("rejectFailed", lang)} ${e?.message ?? e}`);
    } finally {
      setActing(false);
    }
  };

  // Table columns with language support
  const columns: ColumnDef<TData, unknown>[] = useMemo(() => [
    {
      id: "no",
      header: () => t("colNo", lang),
      enableSorting: false,
      size: 60,
      minSize: 50,
      maxSize: 80,
      cell: (info: CellContext<TData, unknown>) => {
        const { pageIndex, pageSize } = info.table.getState().pagination;
        return pageIndex * pageSize + info.row.index + 1;
      },
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.doc_name || "—",
      id: "name",
      header: () => t("colDocName", lang),
      cell: (info: CellContext<TData, unknown>) => (
        <span className="tw-block tw-truncate" title={info.getValue() as string}>
          {info.getValue() as React.ReactNode}
        </span>
      ),
      size: 150,
      minSize: 100,
      maxSize: 200,
      meta: { headerAlign: "center", cellAlign: "left" },
    },
    {
      // เลขใบงาน Maximo — ใบเก่าที่ยังไม่ได้ผูก wonum ให้ถอยไปใช้ issue_id เดิมแทน
      accessorFn: (row) => row.wonum || row.issue_id || "—",
      id: "issue_id",
      header: () => t("colIssueId", lang),
      cell: (info: CellContext<TData, unknown>) => (
        <span className="tw-block tw-truncate" title={info.getValue() as string}>
          {info.getValue() as React.ReactNode}
        </span>
      ),
      size: 140,
      minSize: 100,
      maxSize: 180,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.pm_date,
      id: "date",
      header: () => t("colPmDate", lang),
      cell: (info: CellContext<TData, unknown>) => (
        <span className="tw-whitespace-nowrap">
          {formatDate(info.getValue() as string, lang)}
        </span>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.inspector || "-",
      id: "inspector",
      header: () => t("colInspector", lang),
      cell: (info: CellContext<TData, unknown>) => (
        <span className="tw-block tw-truncate" title={info.getValue() as string}>
          {info.getValue() as React.ReactNode}
        </span>
      ),
      size: 120,
      minSize: 80,
      maxSize: 160,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => toPmFlow(row),
      id: "status",
      header: () => t("colStatus", lang),
      cell: (info: CellContext<TData, unknown>) => {
        const row = info.row.original;
        const flow = info.getValue() as PmFlow;
        const style: Record<PmFlow, string> = {
          wo_pending: "tw-bg-amber-100 tw-text-amber-800",
          wo_planned: "tw-bg-emerald-100 tw-text-emerald-800",
          draft: "tw-bg-gray-100 tw-text-gray-700",
          wait_approve: "tw-bg-purple-100 tw-text-purple-800",
          rejected: "tw-bg-amber-100 tw-text-amber-800",
          closed: "tw-bg-green-100 tw-text-green-800",
        };
        const label: Record<PmFlow, string> = {
          wo_pending: t("stWoPending", lang),
          wo_planned: t("stWoPlanned", lang),
          draft: t("stDraft", lang),
          wait_approve: t("stWaitApprove", lang),
          rejected: t("stRejected", lang),
          closed: t("stClosed", lang),
        };
        // ผู้ที่ตัดสินใจล่าสุดสำคัญกว่าตัวสถานะเปล่า ๆ — ใส่ไว้ใน tooltip
        const hint =
          row.kind === "wo"
            ? [row.selected_equipment_label, row.assignees_label].filter(Boolean).join(" — ") || label[flow]
            : flow === "closed" && row.approved_by
              ? `${t("approvedBy", lang)}: ${row.approved_by}`
              : flow === "rejected" && row.reject_remark
                ? `${t("rejectedBy", lang)}: ${row.rejected_by || "-"} — ${row.reject_remark}`
                : label[flow];

        return (
          <span
            title={hint}
            className={`tw-inline-block tw-rounded-full tw-px-2.5 tw-py-1 tw-text-[10px] sm:tw-text-xs tw-font-semibold tw-whitespace-nowrap ${style[flow]}`}
          >
            {label[flow]}
          </span>
        );
      },
      size: 130,
      minSize: 100,
      maxSize: 170,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.office,
      id: "pdf",
      header: () => t("colPdf", lang),
      enableSorting: false,
      cell: (info: CellContext<TData, unknown>) => {
        const row = info.row.original;

        // แถวใบงาน Maximo ยังไม่มีเอกสาร PM — เข้าหน้าวางแผนด้วยการคลิกที่แถว
        // ไม่ต้องมีปุ่ม เหลือไว้เฉพาะ "กรอก PM" ที่เป็นคนละงานกัน
        if (row.kind === "wo") {
          const planned = toPmFlow(row) === "wo_planned";
          if (!planned) {
            return <span className="tw-text-blue-gray-300">—</span>;
          }
          return (
            <div className="tw-flex tw-items-center tw-justify-center">
              {/* วางแผนแล้ว = ช่างเริ่มกรอกได้ — ผูก wonum ไปกับฟอร์มเพื่อโยงกลับหาใบงานได้ */}
              <Button
                size="sm"
                color="blue"
                variant="outlined"
                className="tw-shrink-0 tw-text-[10px] sm:tw-text-xs tw-px-2 sm:tw-px-3 tw-py-1 tw-min-h-0 tw-h-auto tw-font-medium tw-rounded-md"
                // กันไม่ให้ทะลุไปโดน onClick ของแถวที่พาไปหน้าวางแผน
                onClick={(e) => { e.stopPropagation(); goFillPm(row); }}
              >
                {t("fillPmBtn", lang)}
              </Button>
            </div>
          );
        }

        const url = info.getValue() as string | undefined;
        const hasUrl = typeof url === "string" && url.length > 0;

        if (!hasUrl) {
          return <span className="tw-text-blue-gray-300" title={t("noFile", lang)}>—</span>;
        }

        const { previewHref } = buildHtmlLinks(url);

        const rowSide = info.row.original.side;

        if (rowSide == "pre") {
          return (
            <div className="tw-flex tw-items-center tw-justify-center">
              <Button
                size="sm"
                color="blue"
                variant="outlined"
                className="tw-shrink-0 tw-text-[10px] sm:tw-text-xs lg:tw-text-sm tw-px-2 sm:tw-px-3 lg:tw-px-4 tw-py-1 sm:tw-py-1.5 tw-min-h-0 tw-h-auto tw-font-medium tw-rounded-md"
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("tab");
                  params.set("view", "form");
                  params.set("action", "post");
                  params.set("edit_id", info.row.original.id || "");
                  params.set("pmtab", "post");

                  router.push(`${pathname}?${params.toString()}`, { scroll: false });
                }}
              >
                {t("postPm", lang)}
              </Button>
            </div>
          );
        } else {
          const flow = toPmFlow(info.row.original);

          return (
            <div className="tw-flex tw-items-center tw-justify-center tw-gap-1">
              {/* โดนตีกลับ → ช่างต้องเปิดฟอร์มเดิมกลับเข้าไปแก้แล้วส่งใหม่ */}
              {flow === "rejected" && (
                <Button
                  size="sm"
                  color="amber"
                  variant="outlined"
                  className="tw-shrink-0 tw-text-[10px] sm:tw-text-xs tw-px-2 sm:tw-px-3 tw-py-1 tw-min-h-0 tw-h-auto tw-font-medium tw-rounded-md"
                  title={info.row.original.reject_remark || ""}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete("tab");
                    params.set("view", "form");
                    params.set("action", "post");
                    params.set("edit_id", info.row.original.id || "");
                    params.set("pmtab", "post");
                    router.push(`${pathname}?${params.toString()}`, { scroll: false });
                  }}
                >
                  {t("fixAndResubmit", lang)}
                </Button>
              )}
              {/* ด่านอนุมัติปิดงาน — เห็นเฉพาะ planner/admin และเฉพาะใบที่ช่างส่งมาแล้ว */}
              {canApprove && flow === "wait_approve" && (
                <>
                  <Button
                    size="sm"
                    color="green"
                    variant="outlined"
                    className="tw-shrink-0 tw-text-[10px] sm:tw-text-xs tw-px-2 sm:tw-px-3 tw-py-1 tw-min-h-0 tw-h-auto tw-font-medium tw-rounded-md"
                    onClick={() => goReview(info.row.original)}
                  >
                    {t("approve", lang)}
                  </Button>
                  <Button
                    size="sm"
                    color="amber"
                    variant="outlined"
                    className="tw-shrink-0 tw-text-[10px] sm:tw-text-xs tw-px-2 sm:tw-px-3 tw-py-1 tw-min-h-0 tw-h-auto tw-font-medium tw-rounded-md"
                    onClick={() => { setRejectRemark(""); setRejectRow(info.row.original); }}
                  >
                    {t("reject", lang)}
                  </Button>
                </>
              )}
              {/* Download PDF */}
              <a
                aria-label={t("preview", lang)}
                href={previewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-md tw-p-1.5 sm:tw-p-2 tw-text-red-600 hover:tw-text-red-800 hover:tw-bg-red-50 tw-transition-colors"
                title={t("preview", lang)}
              >
                <DocumentArrowDownIcon className="tw-h-5 tw-w-5 sm:tw-h-6 sm:tw-w-6" />
              </a>
              {info.row.original.has_photos && (
                <a
                  aria-label={t("downloadPhotos", lang)}
                  href={`${BASE}/pmreport/${info.row.original.id}/photos/zip?sn=${encodeURIComponent(sn || "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-md tw-p-1.5 sm:tw-p-2 tw-text-green-600 hover:tw-text-green-800 hover:tw-bg-green-50 tw-transition-colors"
                  title={t("downloadPhotos", lang)}
                >
                  <PhotoIcon className="tw-h-5 tw-w-5 sm:tw-h-6 sm:tw-w-6" />
                </a>
              )}
            </div >

          );
        }
      },
      size: 160,
      minSize: 100,
      maxSize: 240,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
  ], [lang, searchParams, pathname, router, sn, canApprove, canPlan]);

  // แท็บ Open มีแต่ใบงานจาก Maximo ที่ยังไม่ได้มอบหมาย — ยังไม่มีผู้ตรวจสอบให้แสดง
  const visibleColumns = useMemo(
    () => (flowTab === "open" ? columns.filter((c) => c.id !== "inspector") : columns),
    [columns, flowTab]
  );

  function sameUser(a?: string, b?: string) {
    return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
  }

  const visibleData = useMemo(() => {
    const username = me?.username;
    return data.filter((row) => {
      if (FLOW_TAB_OF[toPmFlow(row)] !== flowTab) return false;
      if (row.side !== "pre") return true;
      if (!username) return false;
      return sameUser(row.inspector, username);
    });
  }, [data, me?.username, flowTab]);

  const table = useReactTable({
    data: visibleData,
    columns: visibleColumns,
    state: { globalFilter: filtering, sorting },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFiltering,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
  });

  // สลับแท็บแล้วกลับไปหน้าแรกของตาราง — ไม่งั้นค้างอยู่หน้า 3 ของแท็บเดิมแล้วเห็นว่างเปล่า
  useEffect(() => {
    table.setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowTab]);

  // Upload dialog
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.currentTarget.value = "";
    if (!files.length) return;

    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) {
      showToast("error", t("alertPdfOnly", lang));
      return;
    }

    const validPdfs: File[] = [];
    for (const f of pdfs) {
      const header = await f.slice(0, 5).text();
      if (header.startsWith("%PDF-")) {
        validPdfs.push(f);
      }
    }
    if (validPdfs.length === 0) {
      showToast("error", lang === "th"
        ? "ไฟล์ที่เลือกไม่ใช่ PDF จริง กรุณาเลือกไฟล์ PDF ที่ถูกต้อง"
        : "Selected files are not valid PDFs");
      return;
    }
    if (validPdfs.length < pdfs.length) {
      showToast("warning", lang === "th"
        ? `มี ${pdfs.length - validPdfs.length} ไฟล์ไม่ใช่ PDF จริง — อัปโหลดเฉพาะ ${validPdfs.length} ไฟล์ที่ถูกต้อง`
        : `${pdfs.length - validPdfs.length} invalid file(s) skipped — uploading ${validPdfs.length} valid file(s)`);
    }

    setPendingFiles(validPdfs);
    setDateOpen(true);
  };

  async function uploadPdfs() {
    try {
      if (!sn) { showToast("warning", t("alertSelectCharger", lang)); return; }
      if (!pendingFiles.length) { setDateOpen(false); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
        showToast("error", t("alertInvalidDate", lang)); return;
      }

      const fd = new FormData();
      fd.append("sn", sn);
      fd.append("reportDate", reportDate);
      fd.append("issue_id", issueId);
      fd.append("doc_name", docName || "");
      fd.append("inspector", inspector || "");
      pendingFiles.forEach((f) => fd.append("files", f));

      const res = await apiFetch(`${apiBase}/pmurl/upload-files?_ts=${Date.now()}`, {
        method: "POST", body: fd, credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        showToast("error", `${t("alertUploadFailed", lang)} ${txt}`);
        return;
      }

      await res.json();
      showToast("success", t("alertUploadSuccess", lang));
      setPendingFiles([]);
      setDateOpen(false);
      await fetchRows();
    } catch (err) {
      console.error(err);
      showToast("error", t("alertUploadError", lang));
    }
  }

  useEffect(() => {
    if (!dateOpen || !sn || !reportDate) return;

    let canceled = false;

    (async () => {
      try {
        const preview = await fetchPreviewDocName(sn, reportDate);
        if (!canceled && preview) {
          setDocName(preview);
          return;
        }

        const latest = await fetchLatestDocName(sn, reportDate);
        if (!canceled) {
          const next = nextDocNameFor(sn, reportDate, latest || undefined);
          setDocName(next);
        }
      } catch (e) {
        console.error("auto doc_name error:", e);
        if (!canceled) {
          const fallback = nextDocNameFor(sn, reportDate);
          setDocName(fallback);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [dateOpen, sn, reportDate]);

  useEffect(() => {
    if (!dateOpen || !sn || !reportDate) return;

    let canceled = false;
    (async () => {
      try {
        const latest = await fetchLatestIssueIdAcrossLists(sn, reportDate, apiBase, FetchOpts);
        const next = nextIssueIdFor(PM_TYPE_CODE, reportDate, latest || "");
        if (!canceled) setIssueId(next);
      } catch {
        if (!canceled) setIssueId(nextIssueIdFor(PM_TYPE_CODE, reportDate, ""));
      }
    })();

    return () => { canceled = true; };
  }, [dateOpen, sn, reportDate]);

  const goAdd = () => setView("form");
  const goList = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    params.delete("edit_id");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };
  function goEdit(row: TData) {
    if (!row?.id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "form");
    params.set("edit_id", row.id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (mode === "form") {
    // ช่างกดเข้าใบงานที่ถูก assign → เห็นข้อมูลก่อน ยังไม่เปิดฟอร์ม
    if (woInfoWonum) {
      return (
        <PmWorkOrderInfo
          source="charger" identifier={sn} wonum={woInfoWonum}
          onStart={startPmFromInfo} onCancel={leaveWoInfo}
        />
      );
    }
    // planning=1 → ฟอร์มวางแผนของ planner, ไม่ใช่ฟอร์มกรอก PM ของช่าง
    if (planningWonum) {
      return (
        <PmPlanForm
          source="charger"
          identifier={sn}
          wonum={planningWonum}
          onSaved={() => {
            showToast("success", t("planSaved", lang));
            leavePlanning();
          }}
          onCancel={leavePlanning}
        />
      );
    }
    return (
      <div className="tw-mt-4 sm:tw-mt-6 lg:tw-mt-8">
        <ChargerPMForm />
      </div>
    );
  }

  return (
    <>
      <LoadingOverlay show={pageLoading} text={t("loadingData", lang)} />
      {/* Toast Notification */}
      {toast.show && (
        <div className="tw-fixed tw-top-4 tw-left-1/2 tw--translate-x-1/2 tw-z-[9999] tw-animate-[slideDown_0.3s_ease-out] tw-max-w-md tw-w-[calc(100%-2rem)]">
          <div className={`tw-flex tw-items-start tw-gap-3 tw-px-4 tw-py-3 tw-rounded-xl tw-shadow-2xl tw-border ${toast.type === "success" ? "tw-bg-green-50 tw-border-green-200" :
            toast.type === "error" ? "tw-bg-red-50 tw-border-red-200" :
              toast.type === "warning" ? "tw-bg-amber-50 tw-border-amber-200" :
                "tw-bg-blue-50 tw-border-blue-200"
            }`}>
            <div className={`tw-flex-shrink-0 tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center ${toast.type === "success" ? "tw-bg-green-500" :
              toast.type === "error" ? "tw-bg-red-500" :
                toast.type === "warning" ? "tw-bg-amber-500" :
                  "tw-bg-blue-500"
              }`}>
              {toast.type === "success" && <svg className="tw-w-4 tw-h-4 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
              {toast.type === "error" && <svg className="tw-w-4 tw-h-4 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>}
              {toast.type === "warning" && <svg className="tw-w-4 tw-h-4 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" /></svg>}
              {toast.type === "info" && <svg className="tw-w-4 tw-h-4 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01" /></svg>}
            </div>
            <p className={`tw-text-sm tw-font-medium tw-flex-1 tw-pt-1 ${toast.type === "success" ? "tw-text-green-800" :
              toast.type === "error" ? "tw-text-red-800" :
                toast.type === "warning" ? "tw-text-amber-800" :
                  "tw-text-blue-800"
              }`}>{toast.message}</p>
            <button onClick={() => setToast(prev => ({ ...prev, show: false }))}
              className="tw-flex-shrink-0 tw-p-1 tw-rounded-full tw-text-gray-400 hover:tw-text-gray-600 hover:tw-bg-gray-100 tw-transition-colors">
              <svg className="tw-w-4 tw-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
      {/* Main Card */}
      <Card className="tw-border tw-border-gray-200 tw-shadow-sm tw-mt-4 sm:tw-mt-6 lg:tw-mt-8 tw-mx-2 sm:tw-mx-4 lg:tw-mx-0 tw-rounded-2xl tw-overflow-hidden">

        {/* Card Header */}
        {/* <CardHeader floated={false} shadow={false} className="tw-p-3 sm:tw-p-4 lg:tw-p-6 tw-rounded-none tw-m-0"> */}
        <CardHeader floated={false} shadow={false} className="tw-p-3 sm:tw-p-4 lg:tw-p-6 tw-rounded-none tw-m-0 tw-bg-gradient-to-r tw-from-white tw-to-blue-gray-50/30">
          <div className="tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-center sm:tw-justify-between tw-gap-3 sm:tw-gap-4">
            {/* Title Section */}
            <div className="tw-min-w-0 tw-flex-1">
              <Typography
                variant="h5"
                color="blue-gray"
                className="tw-text-sm sm:tw-text-base lg:tw-text-lg tw-leading-tight tw-font-semibold"
              >
                {t("pageTitle", lang)}
              </Typography>
              <Typography
                variant="small"
                className="tw-text-[11px] sm:tw-text-xs lg:tw-text-sm tw-leading-relaxed tw-font-normal tw-text-blue-gray-400 tw-mt-0.5"
              >
                {t("pageSubtitle", lang)}
              </Typography>

              {/* แท็บตามด่านของงาน */}
              <div className="tw-mt-2.5 tw-flex tw-flex-wrap tw-items-center tw-gap-1.5">
                {FLOW_TABS.map((tab) => {
                  const active = flowTab === tab.id;
                  const count = data.filter((r) => FLOW_TAB_OF[toPmFlow(r)] === tab.id).length;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFlowTab(tab.id)}
                      className={`tw-rounded-lg tw-px-3 tw-py-1.5 tw-text-[11px] sm:tw-text-xs tw-font-medium tw-whitespace-nowrap tw-transition-all tw-border ${active
                        ? "tw-bg-gray-900 tw-text-white tw-border-gray-900 tw-shadow-sm"
                        : "tw-bg-white tw-text-blue-gray-600 tw-border-blue-gray-200 hover:tw-bg-blue-gray-50 hover:tw-text-blue-gray-800"
                        }`}
                    >
                      {t(tab.key, lang)}
                      <span className={`tw-ml-1.5 ${active ? "tw-text-white/70" : "tw-text-blue-gray-400"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Buttons Section */}
            <div className="tw-flex tw-items-center tw-gap-2 tw-flex-shrink-0">
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="tw-hidden"
                onChange={handlePdfChange}
              />
              <Button
                variant="outlined"
                size="sm"
                disabled={!sn}
                onClick={() => pdfInputRef.current?.click()}
                className="tw-h-7 sm:tw-h-8 lg:tw-h-9 tw-rounded-lg tw-px-2.5 sm:tw-px-3 lg:tw-px-4 tw-flex tw-items-center tw-justify-center tw-gap-1 sm:tw-gap-1.5 tw-border-blue-gray-200 tw-font-medium hover:tw-bg-blue-gray-50 tw-transition-colors"
                title={t("uploadPdf", lang)}
              >
                <ArrowUpTrayIcon className="tw-h-3.5 tw-w-3.5 sm:tw-h-4 sm:tw-w-4 tw-flex-shrink-0" />
                <span className="tw-text-[11px] sm:tw-text-xs lg:tw-text-sm">{t("upload", lang)}</span>
              </Button>
              <Button
                size="sm"
                onClick={goAdd}
                disabled={!sn}
                className={`
                  tw-h-7 sm:tw-h-8 lg:tw-h-9 tw-rounded-xl tw-px-3 sm:tw-px-4 lg:tw-px-5
                  tw-flex tw-items-center tw-justify-center tw-font-semibold tw-tracking-wide
                  ${!sn
                    ? "tw-bg-gray-300 tw-text-white tw-cursor-not-allowed"
                    : "tw-bg-gray-900 hover:tw-bg-black tw-text-white"}
                  tw-shadow-lg tw-transition-all
                `}
                title={sn ? "" : t("selectChargerFirst", lang)}
              >
                <span className="tw-text-[11px] sm:tw-text-xs lg:tw-text-sm">{t("add", lang)}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Card Body - Search & Entries per page */}
        <CardBody className="tw-px-3 sm:tw-px-4 lg:tw-px-6 tw-py-2.5 sm:tw-py-3 lg:tw-py-4 tw-border-t tw-border-blue-gray-50">
          <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-stretch sm:tw-items-center tw-gap-2.5 sm:tw-gap-3 lg:tw-gap-4">

            {/* Entries per page */}
            <div className="tw-flex tw-items-center tw-gap-1.5 sm:tw-gap-2 tw-flex-shrink-0">
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="tw-border tw-border-blue-gray-200 tw-py-1.5 sm:tw-py-2 tw-px-2 sm:tw-px-3 tw-rounded-lg tw-text-xs sm:tw-text-sm tw-w-14 sm:tw-w-16 lg:tw-w-20 tw-bg-white focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 focus:tw-border-transparent tw-cursor-pointer"
              >
                {[5, 10, 15, 20, 25, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <Typography
                variant="small"
                className="tw-text-blue-gray-500 tw-text-[11px] sm:tw-text-xs lg:tw-text-sm tw-whitespace-nowrap"
              >
                {t("entriesPerPage", lang)}
              </Typography>
            </div>

            {/* Spacer */}
            <div className="tw-flex-1 tw-hidden sm:tw-block" />

            {/* Search */}
            <div className="tw-w-full sm:tw-w-48 lg:tw-w-64">
              <Input
                value={filtering}
                onChange={(e) => setFiltering(e.target.value)}
                label={t("search", lang)}
                crossOrigin={undefined}
              />
            </div>
          </div>
        </CardBody>

        {/* Table Content */}
        <CardFooter className="tw-px-3 sm:tw-px-4 lg:tw-px-6 tw-py-3 sm:tw-py-4">
          <div className="tw-overflow-x-auto tw-w-full tw-rounded-xl tw-border tw-border-blue-gray-100 tw-shadow-sm">
            <table className="tw-w-full tw-text-left tw-min-w-[700px]">
              {/* Table Header */}
              {/* <thead className="tw-bg-gray-50/80 tw-sticky tw-top-0 tw-backdrop-blur-sm"> */}
              <thead className="tw-bg-gradient-to-r tw-from-gray-900 tw-to-gray-800 tw-sticky tw-top-0">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const align = (header.column.columnDef as any).meta?.headerAlign ?? "left";
                      return (
                        <th
                          key={header.id}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          // className={`tw-py-2.5 sm:tw-py-3 lg:tw-py-4 tw-px-2 sm:tw-px-3 lg:tw-px-4 tw-uppercase !tw-text-blue-gray-500 !tw-font-semibold tw-whitespace-nowrap tw-border-b tw-border-blue-gray-100
                          className={`tw-py-2.5 sm:tw-py-3 lg:tw-py-4 tw-px-2 sm:tw-px-3 lg:tw-px-4 tw-uppercase !tw-font-semibold tw-whitespace-nowrap tw-border-b tw-border-gray-700
                            ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}
                            ${canSort ? "tw-cursor-pointer hover:tw-bg-gray-700 tw-transition-colors tw-select-none" : ""}`}
                        >
                          {canSort ? (
                            <Typography
                              color="blue-gray"
                              // className={`tw-flex tw-items-center tw-gap-0.5 sm:tw-gap-1 tw-text-[9px] sm:tw-text-[10px] lg:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-60
                              className={`tw-flex tw-items-center tw-gap-0.5 sm:tw-gap-1 tw-text-[9px] sm:tw-text-[10px] lg:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-80 tw-tracking-wider !tw-text-white  
                              ${align === "center" ? "tw-justify-center" : align === "right" ? "tw-justify-end" : "tw-justify-start"}`}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {/* <ChevronUpDownIcon strokeWidth={2} className="tw-h-3 tw-w-3 sm:tw-h-3.5 sm:tw-w-3.5 lg:tw-h-4 lg:tw-w-4 tw-flex-shrink-0" /> */}
                              <ChevronUpDownIcon strokeWidth={2} className="tw-h-3 tw-w-3 sm:tw-h-3.5 sm:tw-w-3.5 lg:tw-h-4 lg:tw-w-4 tw-flex-shrink-0 tw-text-white/60" />
                            </Typography>
                          ) : (
                            <Typography
                              color="blue-gray"
                              // className={`tw-text-[9px] sm:tw-text-[10px] lg:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-60
                              className={`tw-text-[9px] sm:tw-text-[10px] lg:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-80 tw-tracking-wider !tw-text-white
                                ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}`}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </Typography>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>

              {/* Table Body */}
              <tbody className="tw-divide-y tw-divide-blue-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="tw-text-center tw-py-10 sm:tw-py-12 lg:tw-py-16">
                      <div className="tw-flex tw-flex-col tw-items-center tw-gap-2 sm:tw-gap-3">
                        <div className="tw-w-6 tw-h-6 sm:tw-w-8 sm:tw-h-8 lg:tw-w-10 lg:tw-h-10 tw-border-2 sm:tw-border-3 tw-border-blue-500 tw-border-t-transparent tw-rounded-full tw-animate-spin"></div>
                        <span className="tw-text-blue-gray-400 tw-text-xs sm:tw-text-sm">{t("loading", lang)}</span>
                      </div>
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row, index) => {
                    const isWo = row.original.kind === "wo";
                    const planned = isWo && toPmFlow(row.original) === "wo_planned";
                    return (
                    <tr
                      key={row.id}
                      // planner/admin → หน้าวางแผน · ช่าง → หน้าข้อมูลใบงานที่มีปุ่มเริ่ม PM
                      // ช่างกดใบที่ยังไม่ได้วางแผนไม่ได้ ยังไม่รู้ว่าต้อง PM อะไร
                      onClick={
                        // ใบที่ส่งมารออนุมัติ — เปิดหน้าตรวจได้ทุก role
                        // (ผู้อนุมัติได้ปุ่มอนุมัติ/ตีกลับ · ช่างเจ้าของงานดูอย่างเดียว)
                        !isWo && REVIEWABLE.includes(toPmFlow(row.original))
                          ? () => goReview(row.original)
                          : !isWo ? undefined
                            : canPlan ? () => goPlan(row.original)
                              : planned ? () => goFillPm(row.original)
                                : undefined
                      }
                      title={
                        isWo
                          ? (canPlan
                            ? (planned ? t("editPlanBtn", lang) : t("planBtn", lang))
                            : t("fillPmBtn", lang))
                          : undefined
                      }
                      className={`tw-transition-colors hover:tw-bg-blue-50/40 hover:tw-shadow-[inset_3px_0_0_0_#2196F3] ${index % 2 === 0 ? 'tw-bg-white' : 'tw-bg-blue-gray-50/30'} ${(isWo && (canPlan || planned)) || (!isWo && REVIEWABLE.includes(toPmFlow(row.original))) ? "tw-cursor-pointer" : ""}`}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const align = (cell.column.columnDef as any).meta?.cellAlign ?? "left";
                        return (
                          <td
                            key={cell.id}
                            className={`tw-align-middle tw-border-0 tw-py-2.5 sm:tw-py-3 lg:tw-py-4 tw-px-2 sm:tw-px-3 lg:tw-px-4
                              ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}`}
                          >
                            <Typography
                              variant="small"
                              className="!tw-font-normal !tw-text-blue-gray-700 tw-text-[11px] sm:tw-text-xs lg:tw-text-sm"
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </Typography>
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={visibleColumns.length} className="tw-text-center tw-py-10 sm:tw-py-12 lg:tw-py-16">
                      <div className="tw-flex tw-flex-col tw-items-center tw-gap-2 sm:tw-gap-3">
                        <div className="tw-w-10 tw-h-10 sm:tw-w-12 sm:tw-h-12 lg:tw-w-16 lg:tw-h-16 tw-rounded-full tw-bg-blue-gray-50 tw-flex tw-items-center tw-justify-center">
                          <DocumentArrowDownIcon className="tw-w-5 tw-h-5 sm:tw-w-6 sm:tw-h-6 lg:tw-w-8 lg:tw-h-8 tw-text-blue-gray-300" />
                        </div>
                        <span className="tw-text-blue-gray-400 tw-text-xs sm:tw-text-sm tw-font-medium">
                          {!sn ? t("selectChargerFirst", lang) : t("noData", lang)}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardFooter>

        {/* Pagination */}
        {/* <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-center tw-justify-between tw-gap-2 sm:tw-gap-3 tw-p-2.5 sm:tw-p-3 lg:tw-p-4 tw-border-t tw-border-blue-gray-50 tw-bg-gray-50/30"> */}
        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-center tw-justify-between tw-gap-2 sm:tw-gap-3 tw-px-3 sm:tw-px-4 lg:tw-px-6 tw-py-3 sm:tw-py-4 tw-border-t tw-border-blue-gray-100">
          <Typography variant="small" className="tw-text-[11px] sm:tw-text-xs lg:tw-text-sm tw-text-blue-gray-600 tw-order-2 sm:tw-order-1">
            {t("page", lang)} <strong className="tw-text-blue-gray-800">{table.getState().pagination.pageIndex + 1}</strong> {t("of", lang)} <strong className="tw-text-blue-gray-800">{table.getPageCount() || 1}</strong>
          </Typography>
          <div className="tw-flex tw-gap-1.5 sm:tw-gap-2 tw-order-1 sm:tw-order-2">
            <Button
              size="sm"
              variant="outlined"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="tw-p-1.5 sm:tw-p-2 tw-min-w-0 tw-rounded-lg disabled:tw-opacity-40 disabled:tw-cursor-not-allowed tw-border-blue-gray-200 hover:tw-bg-blue-gray-50 tw-transition-colors"
            >
              <ChevronLeftIcon className="tw-h-3.5 tw-w-3.5 sm:tw-h-4 sm:tw-w-4 lg:tw-h-5 lg:tw-w-5" />
            </Button>
            <Button
              size="sm"
              variant="outlined"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="tw-p-1.5 sm:tw-p-2 tw-min-w-0 tw-rounded-lg disabled:tw-opacity-40 disabled:tw-cursor-not-allowed tw-border-blue-gray-200 hover:tw-bg-blue-gray-50 tw-transition-colors"
            >
              <ChevronRightIcon className="tw-h-3.5 tw-w-3.5 sm:tw-h-4 sm:tw-w-4 lg:tw-h-5 lg:tw-w-5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Upload Dialog */}
      <Dialog
        open={dateOpen}
        handler={setDateOpen}
        size="sm"
        className="tw-mx-4 tw-max-w-[calc(100vw-2rem)] sm:tw-max-w-md tw-rounded-xl sm:tw-rounded-2xl"
      >
        <DialogHeader className="tw-text-base sm:tw-text-lg lg:tw-text-xl tw-font-semibold tw-px-4 sm:tw-px-6 tw-pt-5 sm:tw-pt-6 tw-pb-2">
          {t("dialogTitle", lang)}
        </DialogHeader>
        <DialogBody className="tw-space-y-4 tw-px-4 sm:tw-px-6 tw-py-4">
          <div>
            <Input
              label={t("docNameLabel", lang)}
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              crossOrigin=""
              containerProps={{ className: "!tw-min-w-0" }}
              className="!tw-w-full !tw-bg-blue-gray-50 !tw-text-sm"
              labelProps={{ className: "!tw-text-sm" }}
              readOnly
            />
          </div>
          <div>
            <Input
              label={t("issueIdLabel", lang)}
              value={issueId}
              onChange={(e) => setIssueId(e.target.value)}
              crossOrigin=""
              containerProps={{ className: "!tw-min-w-0" }}
              className="!tw-w-full !tw-bg-blue-gray-50 !tw-text-sm"
              labelProps={{ className: "!tw-text-sm" }}
              readOnly
            />
          </div>
          <div>
            <Input
              label={t("inspectorLabel", lang)}
              value={inspector}
              onChange={(e) => setInspector(e.target.value)}
              crossOrigin=""
              containerProps={{ className: "!tw-min-w-0" }}
              className="!tw-w-full !tw-bg-blue-gray-50 !tw-text-sm"
              labelProps={{ className: "!tw-text-sm" }}
              readOnly
            />
          </div>
          <div>
            <Input
              type="date"
              value={reportDate}
              max={todayStr}
              onChange={(e) => setReportDate(e.target.value)}
              label={t("pmDateLabel", lang)}
              crossOrigin=""
              containerProps={{ className: "!tw-min-w-0" }}
              className="!tw-text-sm"
              labelProps={{ className: "!tw-text-sm" }}
            />
          </div>
          <div className="tw-bg-blue-50 tw-rounded-lg tw-p-3 sm:tw-p-4">
            <Typography variant="small" className="tw-text-blue-gray-600 tw-text-xs sm:tw-text-sm">
              {t("filesSelected", lang)} <strong className="tw-text-blue-600">{pendingFiles.length}</strong> {t("filesUnit", lang)}
            </Typography>
          </div>
        </DialogBody>
        <DialogFooter className="tw-gap-2 sm:tw-gap-3 tw-px-4 sm:tw-px-6 tw-pb-5 sm:tw-pb-6 tw-pt-2">
          <Button
            variant="text"
            size="sm"
            onClick={() => {
              setPendingFiles([]);
              setDateOpen(false);
            }}
            className="tw-text-xs sm:tw-text-sm tw-px-4 sm:tw-px-5 tw-py-2 sm:tw-py-2.5 tw-font-medium tw-text-blue-gray-600 hover:tw-bg-blue-gray-50 tw-transition-colors tw-rounded-lg"
          >
            {t("cancel", lang)}
          </Button>
          <Button
            onClick={uploadPdfs}
            size="sm"
            className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black tw-text-xs sm:tw-text-sm tw-px-5 sm:tw-px-6 tw-py-2 sm:tw-py-2.5 tw-font-medium tw-rounded-lg tw-shadow-md tw-transition-all"
          >
            {t("uploadBtn", lang)}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ยืนยันอนุมัติปิดใบงาน PM */}
      <Dialog open={!!approveRow} handler={() => setApproveRow(null)} size="xs">
        <DialogHeader className="tw-text-base sm:tw-text-lg tw-font-semibold">
          {t("approveTitle", lang)}
        </DialogHeader>
        <DialogBody className="tw-space-y-2 tw-text-sm">
          <p className="tw-text-blue-gray-700">{t("approveConfirm", lang)}</p>
          <p className="tw-font-medium tw-text-blue-gray-900">
            {approveRow?.doc_name || approveRow?.issue_id || "-"}
          </p>
        </DialogBody>
        <DialogFooter className="tw-gap-2">
          <Button variant="text" size="sm" onClick={() => setApproveRow(null)} disabled={acting}>
            {t("cancel", lang)}
          </Button>
          <Button color="green" size="sm" onClick={onApprove} disabled={acting}>
            {t("confirmBtn", lang)}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ตีกลับใบงานให้ช่างแก้ — ต้องมีเหตุผลเสมอ */}
      <Dialog open={!!rejectRow} handler={() => setRejectRow(null)} size="xs">
        <DialogHeader className="tw-text-base sm:tw-text-lg tw-font-semibold">
          {t("rejectTitle", lang)}
        </DialogHeader>
        <DialogBody className="tw-space-y-3 tw-text-sm">
          <p className="tw-font-medium tw-text-blue-gray-900">
            {rejectRow?.doc_name || rejectRow?.issue_id || "-"}
          </p>
          <Input
            crossOrigin=""
            label={t("rejectRemarkLabel", lang)}
            value={rejectRemark}
            onChange={(e) => setRejectRemark(e.target.value)}
          />
        </DialogBody>
        <DialogFooter className="tw-gap-2">
          <Button variant="text" size="sm" onClick={() => setRejectRow(null)} disabled={acting}>
            {t("cancel", lang)}
          </Button>
          <Button
            color="amber"
            size="sm"
            onClick={onReject}
            disabled={acting || !rejectRemark.trim()}
          >
            {t("confirmBtn", lang)}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}