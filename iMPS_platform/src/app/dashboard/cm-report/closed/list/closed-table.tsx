"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import CMForm from "@/app/dashboard/cm-report/closed/input_CMreport/components/checkList";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type CellContext,
  type SortingState,
} from "@tanstack/react-table";
import {
  Button, Card, CardBody, CardHeader, Typography, CardFooter, Input,
} from "@material-tailwind/react";
import { ArrowUpTrayIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon } from "@heroicons/react/24/solid";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import { apiFetch } from "@/utils/api";
import LoadingOverlay from "@/app/dashboard/components/Loadingoverlay";

// ==================== TRANSLATIONS ====================
const T = {
  // Page Header
  pageTitle: { th: "Corrective Maintenance Report", en: "Corrective Maintenance Report" },
  pageSubtitle: { th: "ค้นหาและดาวน์โหลดเอกสาร CM Report", en: "Search and download CM Report documents" },

  // Buttons
  upload: { th: "อัพโหลด", en: "Upload" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  uploadBtn: { th: "อัพโหลด", en: "Upload" },

  // Table Headers
  colNo: { th: "ลำดับ", en: "No." },
  colDocName: { th: "ชื่อเอกสาร", en: "Document Name" },
  colIssueId: { th: "รหัสเอกสาร", en: "Issue ID" },
  colCmDate: { th: "วันที่แจ้ง", en: "Found Date" },
  colReportedBy: { th: "ผู้แจ้งปัญหา", en: "Reported By" },
  colInspector: { th: "ผู้ตรวจสอบ", en: "Inspector" },
  colLocation: { th: "ตำแหน่งที่พบ", en: "Faulty Equipment" },
  colProblemDetails: { th: "ปัญหาที่พบ", en: "Problem Details" },
  colStatus: { th: "สถานะ", en: "Status" },

  // Pagination
  entriesPerPage: { th: "รายการต่อหน้า", en: "entries per page" },
  page: { th: "หน้า", en: "Page" },
  of: { th: "จาก", en: "of" },

  // Search
  search: { th: "ค้นหา", en: "Search" },

  // Loading / Empty States
  loading: { th: "กำลังโหลด...", en: "Loading..." },
  noData: { th: "ไม่มีข้อมูล", en: "No data" },
  selectStationFirst: { th: "กรุณาเลือกสถานีจากแถบด้านบนก่อน", en: "Please select a station from the top bar first" },
  noFile: { th: "ไม่มีไฟล์", en: "No file" },

  // Dialog
  dialogTitle: { th: "เลือกวันที่รายงาน", en: "Select Report Date" },
  dateLabel: { th: "วันที่", en: "Date" },
  statusLabel: { th: "สถานะ", en: "Status" },
  filesSelected: { th: "ไฟล์ที่เลือก:", en: "Selected files:" },
  filesUnit: { th: "ไฟล์", en: "file(s)" },
  alertSelectStation: { th: "กรุณาเลือกสถานีก่อน", en: "Please select a station first" },
  docNameLabel: { th: "ชื่อเอกสาร", en: "Document Name" },
  issueIdLabel: { th: "รหัสเอกสาร", en: "Issue ID" },
  inspectorLabel: { th: "ผู้ตรวจสอบ", en: "Inspector" },
  pmDateLabel: { th: "วันที่ CM", en: "CM Date" },

  // Alerts
  // alertSelectStation: { th: "กรุณาเลือกสถานีก่อน", en: "Please select a station first" },
  alertPdfOnly: { th: "รองรับเฉพาะไฟล์ PDF เท่านั้น", en: "Only PDF files are supported" },
  alertInvalidDate: { th: "รูปแบบวันที่ไม่ถูกต้อง", en: "Invalid date format" },
  alertUploadFailed: { th: "อัพโหลดไม่สำเร็จ:", en: "Upload failed:" },
  alertUploadSuccess: { th: "อัพโหลดสำเร็จ", en: "Upload successful" },
  alertUploadError: { th: "เกิดข้อผิดพลาดระหว่างอัพโหลด", en: "An error occurred during upload" },

  // Tooltips
  uploadPdf: { th: "อัพโหลด PDF", en: "Upload PDF" },

  // Action Column
  colAction: { th: "จัดการ", en: "Action" },
  edit: { th: "แก้ไข", en: "Edit" },
  noIdToEdit: { th: "ไม่มี id สำหรับแก้ไข", en: "No id to edit" },
  downloadPdf: { th: "ดาวน์โหลด PDF", en: "Download PDF" },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

type TData = {
  id?: string;
  doc_name?: string;
  issue_id?: string;
  cm_date: string;
  position: string;
  office: string;
  reported_by?: string;
  inspector?: string;
  location?: string;
  problem_details?: string;
  status: string;
};

type Props = {
  token?: string;
  apiBase?: string;
};

type Me = {
  id: string;
  username: string;
  email: string;
  role: string;
  company: string;
  tel: string;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const PM_TYPE_CODE = "CM";

export default function CMReportPage({ token, apiBase = BASE }: Props) {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [data, setData] = useState<TData[]>([]);
  const [filtering, setFiltering] = useState("");
  const [faultyEquipment, setFaultyEquipment] = useState("");
  const [problemDetails, setProblemDetails] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [issueId, setIssueId] = useState<string>("");
  const [docName, setDocName] = useState<string>("");
  const [me, setMe] = useState<Me | null>(null);
  const [inspector, setInspector] = useState<string>("");
  const [toast, setToast] = useState<{ show: boolean; type: "success" | "error" | "warning" | "info"; message: string }>({ show: false, type: "info", message: "" });
  const [chargers, setChargers] = useState<{ chargerNo?: number; charger_id?: string; charger_name?: string; SN?: string; sn?: string; }[]>([]);
  const [loadingChargers, setLoadingChargers] = useState(false);

  const FIXED_EQUIPMENT = ["MDB", "CCB", "CB-BOX", "Station"] as const;

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

  const searchParams = useSearchParams();
  const [stationId, setStationId] = useState<string | null>(null);

  function makePrefix(stationId: string, dateISO: string) {
    const d = new Date(dateISO || new Date().toISOString().slice(0, 10));
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `CM-${stationId}-${yy}${mm}-`;
  }

  function nextIssueIdFor(stationId: string, dateISO: string, latestFromDb?: string) {
    const prefix = makePrefix(stationId, dateISO);
    const s = String(latestFromDb || "").trim();
    if (!s || !s.startsWith(prefix)) return `${prefix}01`;
    const m = s.match(/(\d+)$/);
    const pad = m ? m[1].length : 2;
    const n = (m ? parseInt(m[1], 10) : 0) + 1;
    return `${prefix}${n.toString().padStart(pad, "0")}`;
  }

  function nextDocNameFor(stationId: string, dateISO: string, latestFromDb?: string) {
    const d = new Date(dateISO || new Date().toISOString().slice(0, 10));
    const year = d.getFullYear();
    const prefix = `${stationId}_`;
    const suffix = `/${year}`;
    const s = String(latestFromDb || "").trim();
    if (!s || !s.startsWith(prefix) || !s.endsWith(suffix)) return `${prefix}1${suffix}`;
    const inside = s.slice(prefix.length, s.length - suffix.length);
    const cur = parseInt(inside, 10);
    return `${prefix}${isNaN(cur) ? 1 : cur + 1}${suffix}`;
  }

  async function fetchLatestIssueIdAcrossLists(stationId: string, dateISO: string, apiBase: string) {
    const build = (path: string) => {
      const u = new URL(`${apiBase}${path}`);
      u.searchParams.set("station_id", stationId);
      u.searchParams.set("page", "1");
      u.searchParams.set("pageSize", "50");
      u.searchParams.set("_ts", String(Date.now()));
      return u.toString();
    };
    const [a, b] = await Promise.allSettled([
      apiFetch(build("/cmreport/list")),
      apiFetch(build("/cmurl/list")),
    ]);
    let ids: string[] = [];
    for (const r of [a, b]) {
      if (r.status === "fulfilled" && r.value.ok) {
        const j = await r.value.json();
        ids = ids.concat(
          (Array.isArray(j?.items) ? j.items : [])
            .map((it: any) => String(it?.issue_id || ""))
            .filter(Boolean)
        );
      }
    }
    const prefix = makePrefix(stationId, dateISO); // ← ใช้ stationId
    const same = ids.filter(x => x.startsWith(prefix));
    if (!same.length) return null;
    const toTail = (s: string) => { const m = s.match(/(\d+)$/); return m ? parseInt(m[1], 10) : -1; };
    return same.reduce((acc, cur) => toTail(cur) > toTail(acc) ? cur : acc, same[0]);
  }

  async function fetchLatestDocName(stationId: string, dateISO: string, apiBase: string) {
    const build = (path: string) => {
      const u = new URL(`${apiBase}${path}`);
      u.searchParams.set("station_id", stationId);
      u.searchParams.set("page", "1");
      u.searchParams.set("pageSize", "50");
      u.searchParams.set("_ts", String(Date.now()));
      return u.toString();
    };
    const [a, b] = await Promise.allSettled([
      apiFetch(build("/cmreport/list")),
      apiFetch(build("/cmurl/list")),
    ]);
    let docNames: string[] = [];
    for (const r of [a, b]) {
      if (r.status === "fulfilled" && r.value.ok) {
        const j = await r.value.json();
        docNames = docNames.concat((Array.isArray(j?.items) ? j.items : []).map((it: any) => String(it?.doc_name || "")).filter(Boolean));
      }
    }
    const d = new Date(dateISO || new Date().toISOString().slice(0, 10));
    const year = d.getFullYear();
    const prefix = `${stationId}_`;
    const suffix = `/${year}`;
    const same = docNames.filter(x => x.startsWith(prefix) && x.endsWith(suffix));
    if (!same.length) return null;
    const toNum = (s: string) => { const inside = s.slice(prefix.length, s.length - suffix.length); const n = parseInt(inside, 10); return isNaN(n) ? -1 : n; };
    return same.reduce((acc, cur) => toNum(cur) > toNum(acc) ? cur : acc, same[0]);
  }

  useEffect(() => {
    const sidFromUrl = searchParams.get("station_id");
    if (sidFromUrl) {
      setStationId(sidFromUrl);
      localStorage.setItem("selected_station_id", sidFromUrl);
      return;
    }
    const sidLocal = localStorage.getItem("selected_station_id");
    setStationId(sidLocal);
  }, [searchParams]);



  const statusFromTab = (searchParams.get("status") ?? searchParams.get("tab") ?? "closed").toLowerCase();
  const statusLabel = statusFromTab
    .split(/[-_ ]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");

  const router = useRouter();
  const pathname = usePathname();
  const editId = searchParams.get("edit_id") ?? "";
  const mode: "list" | "form" =
    (searchParams.get("view") === "form" || !!editId) ? "form" : "list";

  const useHttpOnlyCookie = true;
  function makeHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (!useHttpOnlyCookie) {
      const t = token || (typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "");
      if (t) h.Authorization = `Bearer ${t}`;
    }
    return h;
  }
  const fetchOpts: RequestInit = {
    headers: makeHeaders(),
    ...(useHttpOnlyCookie ? { credentials: "include" as const } : {}),
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
    try { return new URL(s).toString(); } catch { }
    if (s.startsWith("/")) return `${apiBase}${s}`;
    if (/^[a-f0-9]{24}$/i.test(s)) return `${apiBase}/files/${s}`;
    return `${apiBase}/${s}`;
  }

  function getStatusText(it: any) {
    return String(it?.status ?? it?.job?.status ?? "").trim();
  }

  function appendParam(u: string, key: string, val: string) {
    const url = new URL(u, apiBase);
    if (!url.searchParams.has(key)) url.searchParams.set(key, val);
    return url.toString();
  }

  function buildHtmlLinks(baseUrl?: string) {
    const u = (baseUrl || "").trim();
    if (!u) return { previewHref: "", downloadHref: "", isPdfEndpoint: false };

    const isPdfEndpoint = /\/pdf\/(cm)\/[A-Fa-f0-9]{24}\/export(?:\b|$)/.test(u);

    if (isPdfEndpoint) {
      const finalUrl = u;
      const withStation = appendParam(finalUrl, "station_id", stationId || "");
      return {
        previewHref: appendParam(withStation, "dl", "0"),
        downloadHref: appendParam(withStation, "dl", "1"),
        isPdfEndpoint: true,
      };
    }

    const withStation = appendParam(u, "station_id", stationId || "");
    return { previewHref: withStation, downloadHref: withStation, isPdfEndpoint: false };
  }

  const fetchRows = async () => {
    if (!stationId) { setData([]); return; }
    setLoading(true);

    try {
      const makeURL = (path: string) => {
        const u = new URL(`${apiBase}${path}`);
        u.searchParams.set("station_id", stationId);
        u.searchParams.set("page", "1");
        u.searchParams.set("pageSize", "50");
        u.searchParams.set("status", statusFromTab);
        return u.toString();
      };

      const [cmRes, urlRes] = await Promise.allSettled([
        fetch(makeURL("/cmreport/list"), fetchOpts),
        fetch(makeURL("/cmurl/list"), fetchOpts),
      ]);

      let cmItems: any[] = [];
      let urlItems: any[] = [];

      if (cmRes.status === "fulfilled" && cmRes.value.ok) {
        const j = await cmRes.value.json();
        if (Array.isArray(j?.items)) cmItems = j.items;
      }
      if (urlRes.status === "fulfilled" && urlRes.value.ok) {
        const j = await urlRes.value.json();
        if (Array.isArray(j?.items)) urlItems = j.items;
      }

      const matchesTab = (it: any) => {
        const s = String(it?.status ?? it?.job?.status ?? "").trim().toLowerCase();
        return s === statusFromTab || (!s && statusFromTab === "closed");
      };
      cmItems = cmItems.filter(matchesTab);
      urlItems = urlItems.filter(matchesTab);

      const cmRows: TData[] = cmItems.map((it: any) => {
        const isoDay = toISODateOnly(it.cm_date ?? it.createdAt ?? "");
        const rawUploaded =
          it.file_url
          ?? (Array.isArray(it.urls) ? (it.urls[0]?.url ?? it.urls[0]) : it.url)
          ?? it.file
          ?? it.path;

        const uploadedUrl = resolveFileHref(rawUploaded, apiBase);

        function extractId(x: any): string {
          if (!x) return "";
          const raw = (x._id !== undefined ? x._id : x.id) ?? "";
          if (raw && typeof raw === "object") {
            return raw.$oid || raw.oid || raw.$id || "";
          }
          const s = String(raw || "");
          return /^[a-fA-F0-9]{24}$/.test(s) ? s : "";
        }

        const id = extractId(it);
        const generatedUrl = id ? `${apiBase}/pdf/cm/${encodeURIComponent(id)}/export?station_id=${encodeURIComponent(stationId || "")}` : "";
        const fileUrl = uploadedUrl || generatedUrl;

        return {
          id,
          doc_name: it.doc_name || "",
          issue_id: it.issue_id || "",
          cm_date: isoDay,
          position: isoDay,
          office: fileUrl,
          reported_by: it.reported_by || it.technician || "",
          inspector: it.inspector || "",
          location: it.faulty_equipment || "",
          problem_details: it.problem_details || "",
          status: getStatusText(it) || "-",
        };
      });

      const urlRows: TData[] = urlItems.map((it: any) => {
        const isoDay = toISODateOnly(it.cm_date ?? it.reportDate ?? it.createdAt ?? "");
        const raw =
          it.file_url
          ?? (Array.isArray(it.urls) ? (it.urls[0]?.url ?? it.urls[0]) : it.url)
          ?? it.file
          ?? it.path;

        return {
          id: it.id || it._id || "",
          doc_name: it.doc_name || "",
          issue_id: it.issue_id || "",
          cm_date: isoDay,
          position: isoDay,
          office: resolveFileHref(raw, apiBase),
          reported_by: it.reported_by || it.technician || "",
          inspector: it.inspector || "",
          location: it.faulty_equipment || "",
          problem_details: it.problem_details || "",
          status: getStatusText(it) || "-",
        };
      });

      const allRows = [...cmRows, ...urlRows].sort((a, b) => {
        const da = (a.position ?? "") as string;
        const db = (b.position ?? "") as string;
        return da < db ? 1 : da > db ? -1 : 0;
      });

      if (!allRows.length) { setData([]); return; }

      setData(allRows);
    } catch (err) {
      console.error("fetch both lists error:", err);
      setData([]);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  // ==================== FIX: เพิ่ม mode และ statusFromTab เป็น dependency ====================
  useEffect(() => {
    // ไม่ fetch ถ้าอยู่ใน form mode
    if (mode !== "list") return;

    let alive = true;
    (async () => { await fetchRows(); })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, stationId, mode, statusFromTab]);

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
      id: "doc_name",
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
      accessorFn: (row) => row.issue_id || "—",
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
      accessorFn: (row) => row.cm_date,
      id: "cm_date",
      header: () => t("colCmDate", lang),
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
      accessorFn: (row) => row.reported_by || "-",
      id: "reported_by",
      header: () => t("colReportedBy", lang),
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
      accessorFn: (row) => row.location || "-",
      id: "location",
      header: () => t("colLocation", lang),
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
      accessorFn: (row) => row.problem_details || "-",
      id: "problem_details",
      header: () => t("colProblemDetails", lang),
      cell: (info: CellContext<TData, unknown>) => (
        <span
          className="tw-block tw-truncate tw-max-w-[200px]"
          title={info.getValue() as string}
        >
          {info.getValue() as React.ReactNode}
        </span>
      ),
      size: 200,
      minSize: 120,
      maxSize: 300,
      meta: { headerAlign: "center", cellAlign: "left" },
    },
    {
      accessorFn: (row) => row.status ?? "-",
      id: "status",
      header: () => t("colStatus", lang),
      cell: (info: CellContext<TData, unknown>) => {
        const s = String(info.getValue() ?? "-");
        const sl = s.toLowerCase();
        const color =
          sl === "open" ? "tw-bg-green-100 tw-text-green-800" :
            sl === "closed" || sl === "close" ? "tw-bg-red-100 tw-text-red-800" :
              sl === "in progress" || sl === "ongoing" ? "tw-bg-amber-100 tw-text-amber-800" :
                "tw-bg-blue-gray-100 tw-text-blue-gray-800";
        return (
          <span className={`tw-inline-block tw-whitespace-nowrap tw-px-2 sm:tw-px-2.5 tw-py-0.5 sm:tw-py-1 tw-rounded-full tw-text-[10px] sm:tw-text-xs tw-font-medium ${color}`}>
            {s}
          </span>
        );
      },
      size: 100,
      minSize: 80,
      maxSize: 140,
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
      accessorFn: (row) => row.office,
      id: "pdf",
      header: () => t("colAction", lang),
      enableSorting: false,
      cell: (info: CellContext<TData, unknown>) => {
        const url = info.getValue() as string | undefined;
        const hasUrl = typeof url === "string" && url.length > 0;

        const { previewHref } = buildHtmlLinks(url);

        return (
          <div className="tw-flex tw-items-center tw-justify-center">
            {/* Download PDF */}
            <a
              href={previewHref || undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { if (!hasUrl) { e.preventDefault(); e.stopPropagation(); } }}
              className={`tw-inline-flex tw-items-center tw-justify-center tw-rounded-lg tw-p-1 sm:tw-p-1.5 tw-transition-colors
                ${hasUrl ? "tw-text-red-600 hover:tw-text-red-800 hover:tw-bg-red-50" : "tw-text-blue-gray-300 tw-cursor-not-allowed"}`}
              aria-disabled={!hasUrl}
              title={hasUrl ? t("downloadPdf", lang) : t("noFile", lang)}
            >
              <DocumentArrowDownIcon className="tw-h-4 tw-w-4 sm:tw-h-5 sm:tw-w-5" />
              <span className="tw-sr-only">{t("downloadPdf", lang)}</span>
            </a>
          </div>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 180,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
  ], [lang, stationId]);

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: filtering, sorting },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFiltering,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
  });

  // Upload
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [urlText, setUrlText] = useState("");

  async function uploadUrls() {
    if (!stationId) { alert("กรุณาเลือกสถานีก่อน"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) { alert("วันที่ไม่ถูกต้อง"); return; }

    const urls = urlText.split("\n").map(s => s.trim()).filter(Boolean);
    if (!urls.length) { alert("กรุณากรอก URL"); return; }

    const fd = new FormData();
    fd.append("station_id", stationId);
    fd.append("rows", JSON.stringify({ reportDate, urls }));

    const res = await fetch(`${apiBase}/cmurl/upload`, {
      method: "POST",
      body: fd,
      credentials: "include",
    });

    if (!res.ok) { alert("อัปโหลดไม่สำเร็จ: " + await res.text()); return; }
    alert("อัปโหลดสำเร็จ");
    setDateOpen(false);
    setUrlText("");
    await fetchRows();
  }

  useEffect(() => {
    if (!dateOpen || !stationId) return;
    let alive = true;
    setLoadingChargers(true);
    (async () => {
      try {
        const res = await fetch(`${apiBase}/chargers/${encodeURIComponent(stationId)}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (alive) setChargers(data.chargers || []);
        }
      } catch {
        if (alive) setChargers([]);
      } finally {
        if (alive) setLoadingChargers(false);
      }
    })();
    return () => { alive = false; };
  }, [dateOpen, stationId]);

  // Fetch /me
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch(`${apiBase}/me`, { credentials: "include" });
        if (res.ok && alive) {
          const user: Me = await res.json();
          setMe(user);
          setInspector(prev => prev || user.username || "");
        }
      } catch (err) { console.error("fetch /me error:", err); }
    })();
    return () => { alive = false; };
  }, [apiBase]);

  // Auto-generate Issue ID และ Doc Name เมื่อเปิด dialog
  useEffect(() => {
    if (!dateOpen || !stationId || !reportDate) return;
    let canceled = false;
    (async () => {
      try {
        const [latestIssue, latestDoc] = await Promise.all([
          fetchLatestIssueIdAcrossLists(stationId, reportDate, apiBase),
          fetchLatestDocName(stationId, reportDate, apiBase),
        ]);
        if (!canceled) {
          setIssueId(nextIssueIdFor(stationId, reportDate, latestIssue || "")); // ← stationId แทน PM_TYPE_CODE
          setDocName(nextDocNameFor(stationId, reportDate, latestDoc || undefined));
        }
      } catch {
        if (!canceled) {
          setIssueId(nextIssueIdFor(stationId, reportDate, ""));
          setDocName(nextDocNameFor(stationId, reportDate));
        }
      }
    })();
    return () => { canceled = true; };
  }, [dateOpen, stationId, reportDate]);

  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.currentTarget.value = "";
    if (!files.length) return;

    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) { alert(t("alertPdfOnly", lang)); return; }

    const validPdfs: File[] = [];
    for (const f of pdfs) {
      const header = await f.slice(0, 5).text();
      if (header.startsWith("%PDF-")) validPdfs.push(f);
    }
    if (!validPdfs.length) { alert("ไฟล์ที่เลือกไม่ใช่ PDF จริง"); return; }

    setPendingFiles(validPdfs);
    setDateOpen(true);
  };

  async function uploadPdfs() {
    try {
      if (!stationId) { showToast("warning", t("alertSelectStation", lang)); return; }
      if (!pendingFiles.length) { setDateOpen(false); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) { showToast("error", t("alertInvalidDate", lang)); return; }

      const fd = new FormData();
      fd.append("station_id", stationId);
      fd.append("reportDate", reportDate);
      fd.append("status", statusFromTab);
      fd.append("issue_id", issueId);
      fd.append("doc_name", docName || "");
      fd.append("inspector", inspector || "");
      pendingFiles.forEach((f) => fd.append("files", f));

      const res = await fetch(`${apiBase}/cmurl/upload-files`, {
        method: "POST", body: fd, credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        showToast("error", `${t("alertUploadFailed", lang)} ${txt}`);
        return;
      }
      showToast("success", t("alertUploadSuccess", lang));
      setPendingFiles([]);
      setDateOpen(false);
      await fetchRows();
    } catch (err) {
      console.error(err);
      showToast("error", t("alertUploadError", lang));
    }
  }

  function goEdit(row: TData) {
    if (!row?.id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "form");
    params.set("edit_id", row.id);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Handle row click
  const handleRowClick = (row: TData) => {
    if (row?.id) {
      goEdit(row);
    }
  };

  if (mode === "form") {
    return (
      <div className="tw-mt-4 sm:tw-mt-6 lg:tw-mt-8">
        <CMForm />
      </div>
    );
  }

  return (
    <>
      <LoadingOverlay show={pageLoading} text="กำลังโหลดข้อมูล..." />
      {toast.show && (
        <div className="tw-fixed tw-top-4 tw-left-1/2 tw--translate-x-1/2 tw-z-[9999] tw-max-w-md tw-w-[calc(100%-2rem)]">
          <div className={`tw-flex tw-items-start tw-gap-3 tw-px-4 tw-py-3 tw-rounded-xl tw-shadow-2xl tw-border ${toast.type === "success" ? "tw-bg-green-50 tw-border-green-200" :
            toast.type === "error" ? "tw-bg-red-50 tw-border-red-200" :
              toast.type === "warning" ? "tw-bg-amber-50 tw-border-amber-200" :
                "tw-bg-blue-50 tw-border-blue-200"}`}>
            <div className={`tw-flex-shrink-0 tw-w-8 tw-h-8 tw-rounded-full tw-flex tw-items-center tw-justify-center ${toast.type === "success" ? "tw-bg-green-500" : toast.type === "error" ? "tw-bg-red-500" :
              toast.type === "warning" ? "tw-bg-amber-500" : "tw-bg-blue-500"}`}>
              {toast.type === "success" && <svg className="tw-w-4 tw-h-4 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
              {toast.type === "error" && <svg className="tw-w-4 tw-h-4 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>}
              {toast.type === "warning" && <svg className="tw-w-4 tw-h-4 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" /></svg>}
              {toast.type === "info" && <svg className="tw-w-4 tw-h-4 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01" /></svg>}
            </div>
            <p className={`tw-text-sm tw-font-medium tw-flex-1 tw-pt-1 ${toast.type === "success" ? "tw-text-green-800" : toast.type === "error" ? "tw-text-red-800" :
              toast.type === "warning" ? "tw-text-amber-800" : "tw-text-blue-800"}`}>
              {toast.message}
            </p>
            <button onClick={() => setToast(prev => ({ ...prev, show: false }))}
              className="tw-flex-shrink-0 tw-p-1 tw-rounded-full tw-text-gray-400 hover:tw-text-gray-600 hover:tw-bg-gray-100 tw-transition-colors">
              <svg className="tw-w-4 tw-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
      {/* Main Card */}
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-4 sm:tw-mt-6 lg:tw-mt-8 tw-mx-2 sm:tw-mx-4 lg:tw-mx-0 tw-rounded-xl lg:tw-rounded-2xl tw-overflow-hidden">

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
                disabled={!stationId}
                onClick={() => pdfInputRef.current?.click()}
                className="tw-h-7 sm:tw-h-8 lg:tw-h-9 tw-rounded-lg tw-px-2.5 sm:tw-px-3 lg:tw-px-4 tw-flex tw-items-center tw-justify-center tw-gap-1 sm:tw-gap-1.5 tw-border-blue-gray-200 tw-font-medium hover:tw-bg-blue-gray-50 tw-transition-colors"
                title={t("uploadPdf", lang)}
              >
                <ArrowUpTrayIcon className="tw-h-3.5 tw-w-3.5 sm:tw-h-4 sm:tw-w-4 tw-flex-shrink-0" />
                <span className="tw-text-[11px] sm:tw-text-xs lg:tw-text-sm">{t("upload", lang)}</span>
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
        <CardFooter className="tw-p-0">
          <div className="tw-relative tw-w-full tw-overflow-x-auto tw-overflow-y-hidden tw-scroll-smooth tw--webkit-overflow-scrolling-touch">
            <table className="tw-w-full tw-text-left tw-min-w-[600px]">
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
                          //   ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}
                          //   ${canSort ? "tw-cursor-pointer hover:tw-bg-gray-100 tw-transition-colors tw-select-none" : ""}`}
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
                    <td colSpan={columns.length} className="tw-text-center tw-py-10 sm:tw-py-12 lg:tw-py-16">
                      <div className="tw-flex tw-flex-col tw-items-center tw-gap-2 sm:tw-gap-3">
                        <div className="tw-w-6 tw-h-6 sm:tw-w-8 sm:tw-h-8 lg:tw-w-10 lg:tw-h-10 tw-border-2 sm:tw-border-3 tw-border-blue-500 tw-border-t-transparent tw-rounded-full tw-animate-spin"></div>
                        <span className="tw-text-blue-gray-400 tw-text-xs sm:tw-text-sm">{t("loading", lang)}</span>
                      </div>
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row, index) => (
                    <tr
                      key={row.id}
                      onClick={() => handleRowClick(row.original)}
                      // className={`tw-transition-colors hover:tw-bg-blue-50/50 tw-cursor-pointer ${index % 2 === 0 ? 'tw-bg-white' : 'tw-bg-gray-50/30'}`}
                      className={`tw-transition-colors hover:tw-bg-blue-50/40 hover:tw-shadow-[inset_3px_0_0_0_#2196F3] tw-cursor-pointer ${index % 2 === 0 ? 'tw-bg-white' : 'tw-bg-blue-gray-50/30'}`}
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="tw-text-center tw-py-10 sm:tw-py-12 lg:tw-py-16">
                      <div className="tw-flex tw-flex-col tw-items-center tw-gap-2 sm:tw-gap-3">
                        <div className="tw-w-10 tw-h-10 sm:tw-w-12 sm:tw-h-12 lg:tw-w-16 lg:tw-h-16 tw-rounded-full tw-bg-blue-gray-50 tw-flex tw-items-center tw-justify-center">
                          <DocumentArrowDownIcon className="tw-w-5 tw-h-5 sm:tw-w-6 sm:tw-h-6 lg:tw-w-8 lg:tw-h-8 tw-text-blue-gray-300" />
                        </div>
                        <span className="tw-text-blue-gray-400 tw-text-xs sm:tw-text-sm tw-font-medium">
                          {!stationId ? t("selectStationFirst", lang) : t("noData", lang)}
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
        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-center tw-justify-between tw-gap-2 sm:tw-gap-3 tw-p-2.5 sm:tw-p-3 lg:tw-p-4 tw-border-t tw-border-blue-gray-100">
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
              value={docName || "-"}
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
              value={issueId || "-"}
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
              value={inspector || "-"}
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
          {/* Faulty Equipment - Dropdown */}
          <div>
            <label className="tw-block tw-text-xs tw-font-medium tw-text-blue-gray-600 tw-mb-1.5">
              {lang === "th" ? "ตำแหน่งที่พบ / อุปกรณ์ที่เสีย" : "Faulty Equipment"}
            </label>
            <select
              value={faultyEquipment}
              onChange={(e) => setFaultyEquipment(e.target.value)}
              className="tw-w-full tw-h-10 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-px-3 tw-text-sm tw-text-blue-gray-700 tw-bg-white focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 focus:tw-border-transparent tw-transition-colors"
            >
              <option value="">
                {lang === "th" ? "เลือกตำแหน่ง..." : "Select location..."}
              </option>
              {chargers.length > 0 && (
                <optgroup label={lang === "th" ? "Chargers" : "Chargers"}>
                  {chargers.map((c, i) => {
                    const id = c.chargerNo ?? c.charger_id ?? i + 1;
                    const sn = c.SN ?? c.sn ?? "";
                    const label = c.charger_name || `Charger ${c.chargerNo ?? i + 1}`;
                    return (
                      <option key={id} value={`charger_${id}`}>
                        {sn ? `${label} (${sn})` : label}
                      </option>
                    );
                  })}
                </optgroup>
              )}
              <optgroup label={lang === "th" ? "อุปกรณ์อื่นๆ" : "Other Equipment"}>
                {FIXED_EQUIPMENT.map(eq => (
                  <option key={eq} value={eq.toLowerCase()}>{eq}</option>
                ))}
              </optgroup>
            </select>
            {loadingChargers && (
              <p className="tw-text-xs tw-text-blue-gray-400 tw-mt-1">
                {lang === "th" ? "กำลังโหลด..." : "Loading..."}
              </p>
            )}
            {!loadingChargers && chargers.length === 0 && stationId && (
              <p className="tw-text-xs tw-text-orange-600 tw-mt-1">
                {lang === "th" ? "ไม่พบ Charger" : "No chargers found"}
              </p>
            )}
          </div>
          {/* Problem Details */}
          <div>
            <Input
              label={lang === "th" ? "ปัญหาที่พบ" : "Problem Details"}
              value={problemDetails}
              onChange={(e) => setProblemDetails(e.target.value)}
              crossOrigin=""
              containerProps={{ className: "!tw-min-w-0" }}
              className="!tw-text-sm"
              labelProps={{ className: "!tw-text-sm" }}
              placeholder={lang === "th" ? "อธิบายปัญหาที่พบ..." : "Describe the problem found..."}
            />
          </div>
          <div className="tw-bg-blue-50 tw-rounded-lg tw-p-3 sm:tw-p-4">
            <div className="tw-flex tw-items-center tw-justify-between">
              <Typography variant="small" className="tw-text-blue-gray-600 tw-text-xs sm:tw-text-sm">
                {t("filesSelected", lang)}
              </Typography>
              <span className="tw-bg-blue-100 tw-text-blue-700 tw-px-2.5 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-semibold">
                {pendingFiles.length} {t("filesUnit", lang)}
              </span>
            </div>
            {pendingFiles.length > 0 && (
              <ul className="tw-mt-2 tw-space-y-1 tw-max-h-24 tw-overflow-y-auto">
                {pendingFiles.map((f, i) => (
                  <li key={i} className="tw-flex tw-items-center tw-gap-1.5 tw-text-xs tw-text-blue-gray-600">
                    <svg className="tw-w-3.5 tw-h-3.5 tw-text-red-500 tw-flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <span className="tw-truncate">{f.name}</span>
                    <span className="tw-flex-shrink-0 tw-text-blue-gray-400">({(f.size / 1024).toFixed(0)} KB)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogBody>
        <DialogFooter className="tw-gap-2 sm:tw-gap-3 tw-px-4 sm:tw-px-6 tw-pb-5 sm:tw-pb-6 tw-pt-2">
          <Button
            variant="text"
            size="sm"
            onClick={() => {
              setPendingFiles([]);
              setFaultyEquipment("");
              setProblemDetails("");
              setChargers([]);
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
    </>
  );
}