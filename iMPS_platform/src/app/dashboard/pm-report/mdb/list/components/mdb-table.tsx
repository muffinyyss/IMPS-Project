"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon } from "@heroicons/react/24/solid";
import { ArrowUpTrayIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";
import MDBPMForm from "@/app/dashboard/pm-report/mdb/input_PMreport/components/checkList";
import { apiFetch } from "@/utils/api";
import { useLanguage, type Lang } from "@/utils/useLanguage";

// ==================== TRANSLATIONS ====================
const T = {
  pageTitle: { th: "Preventive Maintenance Checklist - MDB", en: "Preventive Maintenance Checklist - MDB" },
  pageSubtitle: { th: "ค้นหาและพรีวิวเอกสารรายงานการบำรุงรักษา (PM Report)", en: "Search and preview maintenance reports (PM Report)" },
  upload: { th: "อัปโหลด", en: "Upload" },
  add: { th: "+เพิ่ม", en: "+Add" },
  postPm: { th: "Post-PM", en: "Post-PM" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  uploadBtn: { th: "อัปโหลด", en: "Upload" },
  colNo: { th: "ลำดับ", en: "No." },
  colDocName: { th: "ชื่อเอกสาร", en: "Document Name" },
  colIssueId: { th: "รหัสเอกสาร", en: "Issue ID" },
  colPmDate: { th: "วันที่ PM", en: "PM Date" },
  colInspector: { th: "ผู้ตรวจสอบ", en: "Inspector" },
  colPdf: { th: "PDF", en: "PDF" },
  entriesPerPage: { th: "รายการต่อหน้า", en: "entries per page" },
  page: { th: "หน้า", en: "Page" },
  of: { th: "จาก", en: "of" },
  search: { th: "ค้นหา", en: "Search" },
  loading: { th: "กำลังโหลด…", en: "Loading…" },
  noData: { th: "ไม่มีข้อมูล", en: "No data" },
  selectStationFirst: { th: "กรุณาเลือกสถานีจากแถบบนก่อน", en: "Please select a station first" },
  noFile: { th: "ไม่มีไฟล์", en: "No file" },
  dialogTitle: { th: "เลือกวันที่รายงาน", en: "Select Report Date" },
  docNameLabel: { th: "Document Name / ชื่อเอกสาร", en: "Document Name" },
  issueIdLabel: { th: "Issue id / รหัสเอกสาร", en: "Issue ID" },
  inspectorLabel: { th: "Inspector / ผู้ตรวจสอบ", en: "Inspector" },
  pmDateLabel: { th: "PM Date / วันที่ตรวจสอบ", en: "PM Date" },
  filesSelected: { th: "ไฟล์ที่เลือก:", en: "Files selected:" },
  filesUnit: { th: "ไฟล์", en: "file(s)" },
  alertSelectStation: { th: "กรุณาเลือกสถานีก่อน", en: "Please select a station first" },
  alertPdfOnly: { th: "รองรับเฉพาะไฟล์ PDF เท่านั้น", en: "Only PDF files are supported" },
  alertInvalidDate: { th: "รูปแบบวันที่ไม่ถูกต้อง", en: "Invalid date format" },
  alertUploadFailed: { th: "อัปโหลดไม่สำเร็จ:", en: "Upload failed:" },
  alertUploadSuccess: { th: "อัปโหลดสำเร็จ", en: "Upload successful" },
  alertUploadError: { th: "เกิดข้อผิดพลาดระหว่างอัปโหลด", en: "Error during upload" },
  uploadPdf: { th: "อัปโหลด PDF", en: "Upload PDF" },
  preview: { th: "พรีวิว", en: "Preview" },
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
};

type Props = { token?: string; apiBase?: string; };

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const REPORT_PREFIX = "mdbpmreport";
const URL_PREFIX = "mdbpmurl";
const PM_TYPE_CODE = "MB";

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

async function fetchLatestIssueIdAcrossLists(stationId: string, dateISO: string, apiBase: string, FetchOpts: RequestInit) {
  const build = (path: string) => {
    const u = new URL(`${apiBase}${path}`);
    u.searchParams.set("station_id", stationId);
    u.searchParams.set("page", "1");
    u.searchParams.set("pageSize", "50");
    u.searchParams.set("_ts", String(Date.now()));
    return u.toString();
  };

  const [a, b] = await Promise.allSettled([
    apiFetch(build(`/${REPORT_PREFIX}/list`), FetchOpts),
    apiFetch(build(`/${URL_PREFIX}/list`), FetchOpts),
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

function makeDocNameParts(stationId: string, dateISO: string) {
  const d = new Date(dateISO || new Date().toISOString().slice(0, 10));
  const year = d.getFullYear();
  const prefix = `${stationId}_`;
  const suffix = `/${year}`;
  return { year, prefix, suffix };
}

function nextDocNameFor(stationId: string, dateISO: string, latestFromDb?: string) {
  const { prefix, suffix } = makeDocNameParts(stationId, dateISO);
  const s = String(latestFromDb || "").trim();
  if (!s || !s.startsWith(prefix) || !s.endsWith(suffix)) {
    return `${prefix}1${suffix}`;
  }
  const inside = s.slice(prefix.length, s.length - suffix.length);
  const cur = parseInt(inside, 10);
  const nextIndex = isNaN(cur) ? 1 : cur + 1;
  return `${prefix}${nextIndex}${suffix}`;
}

async function fetchPreviewDocName(stationId: string, pmDate: string): Promise<string | null> {
  const u = new URL(`${BASE}/mdbpmreport/preview-docname`);
  u.searchParams.set("station_id", stationId);
  u.searchParams.set("pm_date", pmDate);
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
  const r = await apiFetch(u.toString(), { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!r.ok) return null;
  const j = await r.json();
  return (j && typeof j.doc_name === "string") ? j.doc_name : null;
}

async function fetchLatestDocName(stationId: string, dateISO: string): Promise<string | null> {
  const u = new URL(`${BASE}/mdbpmreport/latest-docname`);
  u.searchParams.set("station_id", stationId);
  u.searchParams.set("pm_date", dateISO);
  u.searchParams.set("_ts", String(Date.now()));
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
  const r = await apiFetch(u.toString(), { credentials: "include", cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!r.ok) return null;
  const j = await r.json();
  return (j && typeof j.doc_name === "string") ? j.doc_name : null;
}

type Me = { id: string; username: string; email: string; role: string; company: string; tel: string; };

export default function MDBTable({ token, apiBase = BASE }: Props) {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [data, setData] = useState<TData[]>([]);
  const [filtering, setFiltering] = useState("");
  const [issueId, setIssueId] = useState<string>("");
  const searchParams = useSearchParams();
  const [stationId, setStationId] = useState<string | null>(null);
  const [docName, setDocName] = useState<string>("");
  const [me, setMe] = useState<Me | null>(null);
  const [inspector, setInspector] = useState<string>("");

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    const sidFromUrl = searchParams.get("station_id");
    if (sidFromUrl) { setStationId(sidFromUrl); localStorage.setItem("selected_station_id", sidFromUrl); return; }
    setStationId(localStorage.getItem("selected_station_id"));
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`${apiBase}/me`, { method: "GET", credentials: "include" });
        if (!res.ok) return;
        const data: Me = await res.json();
        setMe(data);
        setInspector((prev) => prev || data.username || "");
      } catch (err) { console.error("fetch /me error:", err); }
    })();
  }, [apiBase]);

  const router = useRouter();
  const pathname = usePathname();
  const editId = searchParams.get("edit_id") ?? "";
  const mode: "list" | "form" = (searchParams.get("view") === "form" || !!editId) ? "form" : "list";

  const setView = (view: "list" | "form", { replace = false } = {}) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "form") { params.set("view", "form"); params.set("pmtab", "pre"); }
    else { params.delete("view"); params.delete("edit_id"); params.delete("pmtab"); }
    router[replace ? "replace" : "push"](`${pathname}?${params.toString()}`, { scroll: false });
  };

  const useHttpOnlyCookie = true;
  function makeHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (!useHttpOnlyCookie) {
      const t = token || (typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "");
      if (t) h.Authorization = `Bearer ${t}`;
    }
    return h;
  }
  const FetchOpts: RequestInit = { headers: makeHeaders(), ...(useHttpOnlyCookie ? { credentials: "include" as const } : {}), cache: "no-store" };

  function thDate(iso?: string, currentLang: Lang = lang) {
    if (!iso) return "-";
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00Z") : new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString(currentLang === "en" ? "en-GB" : "th-TH-u-ca-gregory", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  }

  function toISODateOnly(s?: string) {
    if (!s) return "";
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(s);
      if (isNaN(d.getTime())) return "";
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch { return ""; }
  }

  function resolveFileHref(v: any, apiBase: string) {
    if (!v) return "";
    if (typeof v === "object") return resolveFileHref(v.url ?? v.href ?? v.link ?? "", apiBase);
    const s = String(v).trim();
    if (!s) return "";
    try { return new URL(s).toString(); } catch { }
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
    for (const v of [it?.pm_date, it?.reportDate, it?.job?.date, it?.submittedAt, it?.timestamp, it?.createdAt, it?.updatedAt, it?.date]) {
      const d = normalizeAnyDate(v);
      if (d) return d;
    }
    return "";
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

  const fetchRows = async (signal?: AbortSignal) => {
    if (!stationId) { setData([]); return; }
    setLoading(true);
    try {
      const makeURL = (path: string) => {
        const u = new URL(`${apiBase}${path}`);
        u.searchParams.set("station_id", stationId);
        u.searchParams.set("page", "1");
        u.searchParams.set("pageSize", "50");
        u.searchParams.set("_ts", String(Date.now()));
        return u.toString();
      };
      const [pmRes, urlRes] = await Promise.allSettled([
        apiFetch(makeURL(`/${REPORT_PREFIX}/list`), FetchOpts),
        apiFetch(makeURL(`/${URL_PREFIX}/list`), FetchOpts),
      ]);

      let pmItems: any[] = [], urlItems: any[] = [];
      if (pmRes.status === "fulfilled" && pmRes.value.ok) { const j = await pmRes.value.json(); if (Array.isArray(j?.items)) pmItems = j.items; }
      if (urlRes.status === "fulfilled" && urlRes.value.ok) { const j = await urlRes.value.json(); if (Array.isArray(j?.items)) urlItems = j.items; }

      const pmRows: TData[] = pmItems.map((it: any) => {
        const isoDay = pickDateFromItem(it);
        const rawUploaded = it.file_url ?? (Array.isArray(it.urls) ? (it.urls[0]?.url ?? it.urls[0]) : it.url) ?? it.file ?? it.path;
        const uploadedUrl = resolveFileHref(rawUploaded, apiBase);
        function extractId(x: any): string {
          if (!x) return "";
          const raw = (x._id !== undefined ? x._id : x.id) ?? "";
          if (raw && typeof raw === "object") return raw.$oid || raw.oid || raw.$id || "";
          const s = String(raw || "");
          return /^[a-fA-F0-9]{24}$/.test(s) ? s : "";
        }
        const id = extractId(it);
        const generatedUrl = id ? `${apiBase}/pdf/mdb/${encodeURIComponent(id)}/export` : "";
        const fileUrl = uploadedUrl || generatedUrl;
        return { id, issue_id: (it.issue_id ? String(it.issue_id) : "") || extractDocIdFromAnything(fileUrl) || "", doc_name: it.doc_name ? String(it.doc_name) : "", pm_date: isoDay, position: isoDay, office: fileUrl, inspector: (it.inspector ?? it.job?.inspector ?? "") as string, side: (it.side ?? it.job?.side ?? "") as string } as TData;
      });

      const urlRows: TData[] = urlItems.map((it: any) => {
        const isoDay = pickDateFromItem(it);
        const raw = it.file_url ?? (Array.isArray(it.urls) ? (it.urls[0]?.url ?? it.urls[0]) : it.url) ?? it.file ?? it.path;
        const href = resolveFileHref(raw, apiBase);
        return { issue_id: (it.issue_id ? String(it.issue_id) : "") || extractDocIdFromAnything(href) || "", doc_name: it.doc_name ? String(it.doc_name) : "", pm_date: isoDay, position: isoDay, office: href, inspector: (it.inspector ?? it.job?.inspector ?? "") as string, side: (it.side ?? it.job?.side ?? "") as string } as TData;
      });

      const allRows = [...pmRows, ...urlRows].sort((a, b) => {
        const da = (a.position ?? "") as string, db = (b.position ?? "") as string;
        if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
        return da < db ? 1 : da > db ? -1 : 0;
      });
      setData(allRows);
    } catch (err: any) { if (err?.name !== "AbortError") { console.error("fetch error:", err); setData([]); } }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRows(); }, [apiBase, stationId]);
  useEffect(() => { const ac = new AbortController(); fetchRows(ac.signal); return () => ac.abort(); }, [apiBase, stationId, searchParams.toString()]);

  function appendParam(u: string, key: string, val?: string) {
    if (!val) return u;
    const url = new URL(u, apiBase);
    if (!url.searchParams.has(key)) url.searchParams.set(key, val);
    return url.toString();
  }

  function buildHtmlLinks(baseUrl?: string) {
    const u = (baseUrl || "").trim();
    if (!u) return { previewHref: "", isPdfEndpoint: false };
    const isPdfEndpoint = /\/pdf\/(charger|mdb|ccb|cbbox|station)\/[A-Fa-f0-9]{24}\/export(?:\b|$)/.test(u);
    if (isPdfEndpoint) {
      let finalUrl = u;
      if (stationId) finalUrl = appendParam(finalUrl, "station_id", stationId);
      finalUrl = appendParam(finalUrl, "lang", lang);
      const photosBase = (process.env.NEXT_PUBLIC_PHOTOS_BASE_URL as string) || (typeof window !== "undefined" ? window.location.origin : "");
      if (photosBase) finalUrl = appendParam(finalUrl, "photos_base_url", photosBase);
      finalUrl = appendParam(finalUrl, "dl", "0");
      return { previewHref: finalUrl, isPdfEndpoint: true };
    }
    return { previewHref: u, isPdfEndpoint: false };
  }

  const columns: ColumnDef<TData, unknown>[] = useMemo(() => [
    {
      id: "no", header: () => t("colNo", lang), enableSorting: false, size: 60, minSize: 50, maxSize: 80,
      cell: (info: CellContext<TData, unknown>) => { const { pageIndex, pageSize } = info.table.getState().pagination; return pageIndex * pageSize + info.row.index + 1; },
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.doc_name || "—", id: "name", header: () => t("colDocName", lang),
      cell: (info: CellContext<TData, unknown>) => (<span className="tw-block tw-truncate" title={info.getValue() as string}>{info.getValue() as React.ReactNode}</span>),
      size: 150, minSize: 100, maxSize: 200, meta: { headerAlign: "center", cellAlign: "left" },
    },
    {
      accessorFn: (row) => row.issue_id || "—", id: "issue_id", header: () => t("colIssueId", lang),
      cell: (info) => (<span className="tw-block tw-truncate" title={info.getValue() as string}>{info.getValue() as React.ReactNode}</span>),
      size: 140, minSize: 100, maxSize: 180, meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.pm_date, id: "date", header: () => t("colPmDate", lang),
      cell: (info) => (<span className="tw-whitespace-nowrap">{thDate(info.getValue() as string, lang)}</span>),
      size: 120, minSize: 100, maxSize: 150, meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.inspector || "-", id: "inspector", header: () => t("colInspector", lang),
      cell: (info: CellContext<TData, unknown>) => (<span className="tw-block tw-truncate" title={info.getValue() as string}>{info.getValue() as React.ReactNode}</span>),
      size: 120, minSize: 80, maxSize: 160, meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.office, id: "pdf", header: () => t("colPdf", lang), enableSorting: false,
      cell: (info: CellContext<TData, unknown>) => {
        const url = info.getValue() as string | undefined;
        const hasUrl = typeof url === "string" && url.length > 0;
        if (!hasUrl) return <span className="tw-text-blue-gray-300" title={t("noFile", lang)}>—</span>;
        const { previewHref } = buildHtmlLinks(url);
        const rowSide = info.row.original.side;
        if (rowSide == "pre") {
          return (
            <div className="tw-flex tw-items-center tw-justify-center">
              <Button size="sm" color="blue" variant="outlined"
                className="tw-shrink-0 tw-text-[10px] sm:tw-text-xs lg:tw-text-sm tw-px-2 sm:tw-px-3 lg:tw-px-4 tw-py-1 sm:tw-py-1.5 tw-min-h-0 tw-h-auto tw-font-medium tw-rounded-md"
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("view", "form"); params.set("action", "post"); params.set("edit_id", info.row.original.id || ""); params.set("pmtab", "post");
                  router.push(`${pathname}?${params.toString()}`, { scroll: false });
                }}>{t("postPm", lang)}</Button>
            </div>
          );
        } else {
          return (
            <div className="tw-flex tw-items-center tw-justify-center">
              <a aria-label={t("preview", lang)} href={previewHref} target="_blank" rel="noopener noreferrer"
                className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-md tw-p-1.5 sm:tw-p-2 tw-text-red-600 hover:tw-text-red-800 hover:tw-bg-red-50 tw-transition-colors"
                title={t("preview", lang)}><DocumentArrowDownIcon className="tw-h-5 tw-w-5 sm:tw-h-6 sm:tw-w-6" /></a>
            </div>
          );
        }
      },
      size: 100, minSize: 80, maxSize: 140, meta: { headerAlign: "center", cellAlign: "center" },
    },
  ], [lang, searchParams, pathname, router, stationId]);

  function sameUser(a?: string, b?: string) { return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase(); }

  const visibleData = useMemo(() => {
    const username = me?.username;
    return data.filter((row) => {
      if (row.side !== "pre") return true;
      if (!username) return false;
      return sameUser(row.inspector, username);
    });
  }, [data, me?.username]);

  const table = useReactTable({
    data: visibleData, columns,
    state: { globalFilter: filtering, sorting },
    onSortingChange: setSorting, onGlobalFilterChange: setFiltering,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
  });

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [reportDate, setReportDate] = useState<string>(() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.currentTarget.value = "";
    if (!files.length) return;
    const pdfs = files.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) { alert(t("alertPdfOnly", lang)); return; }
    setPendingFiles(pdfs);
    setDateOpen(true);
  };

  async function uploadPdfs() {
    try {
      if (!stationId) { alert(t("alertSelectStation", lang)); return; }
      if (!pendingFiles.length) { setDateOpen(false); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) { alert(t("alertInvalidDate", lang)); return; }
      const fd = new FormData();
      fd.append("station_id", stationId); fd.append("reportDate", reportDate); fd.append("issue_id", issueId);
      fd.append("doc_name", docName || ""); fd.append("inspector", inspector || "");
      pendingFiles.forEach((f) => fd.append("files", f));
      const res = await fetch(`${apiBase}/${URL_PREFIX}/upload-files?_ts=${Date.now()}`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) { const txt = await res.text(); alert(`${t("alertUploadFailed", lang)} ${txt}`); return; }
      await res.json();
      alert(t("alertUploadSuccess", lang));
      setPendingFiles([]); setDateOpen(false);
      await fetchRows();
    } catch (err) { console.error(err); alert(t("alertUploadError", lang)); }
  }

  useEffect(() => {
    if (!dateOpen || !stationId || !reportDate) return;
    let canceled = false;
    (async () => {
      try {
        const preview = await fetchPreviewDocName(stationId, reportDate);
        if (!canceled && preview) { setDocName(preview); return; }
        const latest = await fetchLatestDocName(stationId, reportDate);
        if (!canceled) { setDocName(nextDocNameFor(stationId, reportDate, latest || undefined)); }
      } catch (e) { if (!canceled) { setDocName(nextDocNameFor(stationId, reportDate)); } }
    })();
    return () => { canceled = true; };
  }, [dateOpen, stationId, reportDate]);

  useEffect(() => {
    if (!dateOpen || !stationId || !reportDate) return;
    let canceled = false;
    (async () => {
      try {
        const latest = await fetchLatestIssueIdAcrossLists(stationId, reportDate, apiBase, FetchOpts);
        if (!canceled) setIssueId(nextIssueIdFor(PM_TYPE_CODE, reportDate, latest || ""));
      } catch { if (!canceled) setIssueId(nextIssueIdFor(PM_TYPE_CODE, reportDate, "")); }
    })();
    return () => { canceled = true; };
  }, [dateOpen, stationId, reportDate]);

  const goAdd = () => setView("form");

  if (mode === "form") {
    return (<div className="tw-mt-4 sm:tw-mt-6 lg:tw-mt-8"><MDBPMForm /></div>);
  }

  return (
    <>
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-4 sm:tw-mt-6 lg:tw-mt-8 tw-mx-2 sm:tw-mx-4 lg:tw-mx-0 tw-rounded-xl lg:tw-rounded-2xl tw-overflow-hidden">
        <CardHeader floated={false} shadow={false} className="tw-p-3 sm:tw-p-4 lg:tw-p-6 tw-rounded-none tw-m-0">
          <div className="tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-center sm:tw-justify-between tw-gap-3 sm:tw-gap-4">
            <div className="tw-min-w-0 tw-flex-1">
              <Typography variant="h5" color="blue-gray" className="tw-text-sm sm:tw-text-base lg:tw-text-lg tw-leading-tight tw-font-semibold">{t("pageTitle", lang)}</Typography>
              <Typography variant="small" className="tw-text-[11px] sm:tw-text-xs lg:tw-text-sm tw-leading-relaxed tw-font-normal tw-text-blue-gray-400 tw-mt-0.5">{t("pageSubtitle", lang)}</Typography>
            </div>
            <div className="tw-flex tw-items-center tw-gap-2 tw-flex-shrink-0">
              <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" multiple className="tw-hidden" onChange={handlePdfChange} />
              <Button variant="outlined" size="sm" disabled={!stationId} onClick={() => pdfInputRef.current?.click()}
                className="tw-h-7 sm:tw-h-8 lg:tw-h-9 tw-rounded-lg tw-px-2.5 sm:tw-px-3 lg:tw-px-4 tw-flex tw-items-center tw-justify-center tw-gap-1 sm:tw-gap-1.5 tw-border-blue-gray-200 tw-font-medium hover:tw-bg-blue-gray-50 tw-transition-colors"
                title={t("uploadPdf", lang)}>
                <ArrowUpTrayIcon className="tw-h-3.5 tw-w-3.5 sm:tw-h-4 sm:tw-w-4 tw-flex-shrink-0" />
                <span className="tw-text-[11px] sm:tw-text-xs lg:tw-text-sm">{t("upload", lang)}</span>
              </Button>
              <Button size="sm" onClick={goAdd} disabled={!stationId}
                className={`tw-h-7 sm:tw-h-8 lg:tw-h-9 tw-rounded-lg tw-px-2.5 sm:tw-px-3 lg:tw-px-4 tw-flex tw-items-center tw-justify-center tw-font-medium ${!stationId ? "tw-bg-gray-300 tw-text-white tw-cursor-not-allowed" : "tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black tw-text-white"} tw-shadow-md tw-transition-all`}
                title={stationId ? "" : t("selectStationFirst", lang)}>
                <span className="tw-text-[11px] sm:tw-text-xs lg:tw-text-sm">{t("add", lang)}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardBody className="tw-px-3 sm:tw-px-4 lg:tw-px-6 tw-py-2.5 sm:tw-py-3 lg:tw-py-4 tw-border-t tw-border-blue-gray-50">
          <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-stretch sm:tw-items-center tw-gap-2.5 sm:tw-gap-3 lg:tw-gap-4">
            <div className="tw-flex tw-items-center tw-gap-1.5 sm:tw-gap-2 tw-flex-shrink-0">
              <select value={table.getState().pagination.pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="tw-border tw-border-blue-gray-200 tw-py-1.5 sm:tw-py-2 tw-px-2 sm:tw-px-3 tw-rounded-lg tw-text-xs sm:tw-text-sm tw-w-14 sm:tw-w-16 lg:tw-w-20 tw-bg-white focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 focus:tw-border-transparent tw-cursor-pointer">
                {[5, 10, 15, 20, 25, 50].map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
              <Typography variant="small" className="tw-text-blue-gray-500 tw-text-[11px] sm:tw-text-xs lg:tw-text-sm tw-whitespace-nowrap">{t("entriesPerPage", lang)}</Typography>
            </div>
            <div className="tw-flex-1 tw-hidden sm:tw-block" />
            <div className="tw-w-full sm:tw-w-48 lg:tw-w-64">
              <Input value={filtering} onChange={(e) => setFiltering(e.target.value)} label={t("search", lang)} crossOrigin={undefined} />
            </div>
          </div>
        </CardBody>

        <CardFooter className="tw-p-0">
          <div className="tw-relative tw-w-full tw-overflow-x-auto tw-overflow-y-hidden tw-scroll-smooth tw--webkit-overflow-scrolling-touch">
            <table className="tw-w-full tw-text-left tw-min-w-[700px]">
              <thead className="tw-bg-gray-50/80 tw-sticky tw-top-0 tw-backdrop-blur-sm">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const align = (header.column.columnDef as any).meta?.headerAlign ?? "left";
                      return (
                        <th key={header.id} onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          className={`tw-py-2.5 sm:tw-py-3 lg:tw-py-4 tw-px-2 sm:tw-px-3 lg:tw-px-4 tw-uppercase !tw-text-blue-gray-500 !tw-font-semibold tw-whitespace-nowrap tw-border-b tw-border-blue-gray-100 ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"} ${canSort ? "tw-cursor-pointer hover:tw-bg-gray-100 tw-transition-colors tw-select-none" : ""}`}>
                          {canSort ? (
                            <Typography color="blue-gray" className={`tw-flex tw-items-center tw-gap-0.5 sm:tw-gap-1 tw-text-[9px] sm:tw-text-[10px] lg:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-60 ${align === "center" ? "tw-justify-center" : align === "right" ? "tw-justify-end" : "tw-justify-start"}`}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <ChevronUpDownIcon strokeWidth={2} className="tw-h-3 tw-w-3 sm:tw-h-3.5 sm:tw-w-3.5 lg:tw-h-4 lg:tw-w-4 tw-flex-shrink-0" />
                            </Typography>
                          ) : (
                            <Typography color="blue-gray" className={`tw-text-[9px] sm:tw-text-[10px] lg:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-60 ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}`}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </Typography>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="tw-divide-y tw-divide-blue-gray-50">
                {loading ? (
                  <tr><td colSpan={columns.length} className="tw-text-center tw-py-10 sm:tw-py-12 lg:tw-py-16">
                    <div className="tw-flex tw-flex-col tw-items-center tw-gap-2 sm:tw-gap-3">
                      <div className="tw-w-6 tw-h-6 sm:tw-w-8 sm:tw-h-8 lg:tw-w-10 lg:tw-h-10 tw-border-2 sm:tw-border-3 tw-border-blue-500 tw-border-t-transparent tw-rounded-full tw-animate-spin"></div>
                      <span className="tw-text-blue-gray-400 tw-text-xs sm:tw-text-sm">{t("loading", lang)}</span>
                    </div>
                  </td></tr>
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row, index) => (
                    <tr key={row.id} className={`tw-transition-colors hover:tw-bg-blue-50/50 ${index % 2 === 0 ? 'tw-bg-white' : 'tw-bg-gray-50/30'}`}>
                      {row.getVisibleCells().map((cell) => {
                        const align = (cell.column.columnDef as any).meta?.cellAlign ?? "left";
                        return (
                          <td key={cell.id} className={`tw-align-middle tw-border-0 tw-py-2.5 sm:tw-py-3 lg:tw-py-4 tw-px-2 sm:tw-px-3 lg:tw-px-4 ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}`}>
                            <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-700 tw-text-[11px] sm:tw-text-xs lg:tw-text-sm">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </Typography>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={columns.length} className="tw-text-center tw-py-10 sm:tw-py-12 lg:tw-py-16">
                    <div className="tw-flex tw-flex-col tw-items-center tw-gap-2 sm:tw-gap-3">
                      <div className="tw-w-10 tw-h-10 sm:tw-w-12 sm:tw-h-12 lg:tw-w-16 lg:tw-h-16 tw-rounded-full tw-bg-blue-gray-50 tw-flex tw-items-center tw-justify-center">
                        <DocumentArrowDownIcon className="tw-w-5 tw-h-5 sm:tw-w-6 sm:tw-h-6 lg:tw-w-8 lg:tw-h-8 tw-text-blue-gray-300" />
                      </div>
                      <span className="tw-text-blue-gray-400 tw-text-xs sm:tw-text-sm tw-font-medium">{!stationId ? t("selectStationFirst", lang) : t("noData", lang)}</span>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardFooter>

        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-center tw-justify-between tw-gap-2 sm:tw-gap-3 tw-p-2.5 sm:tw-p-3 lg:tw-p-4 tw-border-t tw-border-blue-gray-50 tw-bg-gray-50/30">
          <Typography variant="small" className="tw-text-[11px] sm:tw-text-xs lg:tw-text-sm tw-text-blue-gray-600 tw-order-2 sm:tw-order-1">
            {t("page", lang)} <strong className="tw-text-blue-gray-800">{table.getState().pagination.pageIndex + 1}</strong> {t("of", lang)} <strong className="tw-text-blue-gray-800">{table.getPageCount() || 1}</strong>
          </Typography>
          <div className="tw-flex tw-gap-1.5 sm:tw-gap-2 tw-order-1 sm:tw-order-2">
            <Button size="sm" variant="outlined" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
              className="tw-p-1.5 sm:tw-p-2 tw-min-w-0 tw-rounded-lg disabled:tw-opacity-40 disabled:tw-cursor-not-allowed tw-border-blue-gray-200 hover:tw-bg-blue-gray-50 tw-transition-colors">
              <ChevronLeftIcon className="tw-h-3.5 tw-w-3.5 sm:tw-h-4 sm:tw-w-4 lg:tw-h-5 lg:tw-w-5" />
            </Button>
            <Button size="sm" variant="outlined" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
              className="tw-p-1.5 sm:tw-p-2 tw-min-w-0 tw-rounded-lg disabled:tw-opacity-40 disabled:tw-cursor-not-allowed tw-border-blue-gray-200 hover:tw-bg-blue-gray-50 tw-transition-colors">
              <ChevronRightIcon className="tw-h-3.5 tw-w-3.5 sm:tw-h-4 sm:tw-w-4 lg:tw-h-5 lg:tw-w-5" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={dateOpen} handler={setDateOpen} size="sm" className="tw-mx-4 tw-max-w-[calc(100vw-2rem)] sm:tw-max-w-md tw-rounded-xl sm:tw-rounded-2xl">
        <DialogHeader className="tw-text-base sm:tw-text-lg lg:tw-text-xl tw-font-semibold tw-px-4 sm:tw-px-6 tw-pt-5 sm:tw-pt-6 tw-pb-2">{t("dialogTitle", lang)}</DialogHeader>
        <DialogBody className="tw-space-y-4 tw-px-4 sm:tw-px-6 tw-py-4">
          <div><Input label={t("docNameLabel", lang)} value={docName} onChange={(e) => setDocName(e.target.value)} crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-bg-blue-gray-50 !tw-text-sm" labelProps={{ className: "!tw-text-sm" }} readOnly /></div>
          <div><Input label={t("issueIdLabel", lang)} value={issueId} onChange={(e) => setIssueId(e.target.value)} crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-bg-blue-gray-50 !tw-text-sm" labelProps={{ className: "!tw-text-sm" }} readOnly /></div>
          <div><Input label={t("inspectorLabel", lang)} value={inspector} onChange={(e) => setInspector(e.target.value)} crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-bg-blue-gray-50 !tw-text-sm" labelProps={{ className: "!tw-text-sm" }} readOnly /></div>
          <div><Input type="date" value={reportDate} max={todayStr} onChange={(e) => setReportDate(e.target.value)} label={t("pmDateLabel", lang)} crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-text-sm" labelProps={{ className: "!tw-text-sm" }} /></div>
          <div className="tw-bg-blue-50 tw-rounded-lg tw-p-3 sm:tw-p-4">
            <Typography variant="small" className="tw-text-blue-gray-600 tw-text-xs sm:tw-text-sm">{t("filesSelected", lang)} <strong className="tw-text-blue-600">{pendingFiles.length}</strong> {t("filesUnit", lang)}</Typography>
          </div>
        </DialogBody>
        <DialogFooter className="tw-gap-2 sm:tw-gap-3 tw-px-4 sm:tw-px-6 tw-pb-5 sm:tw-pb-6 tw-pt-2">
          <Button variant="text" size="sm" onClick={() => { setPendingFiles([]); setDateOpen(false); }} className="tw-text-xs sm:tw-text-sm tw-px-4 sm:tw-px-5 tw-py-2 sm:tw-py-2.5 tw-font-medium tw-text-blue-gray-600 hover:tw-bg-blue-gray-50 tw-transition-colors tw-rounded-lg">{t("cancel", lang)}</Button>
          <Button onClick={uploadPdfs} size="sm" className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black tw-text-xs sm:tw-text-sm tw-px-5 sm:tw-px-6 tw-py-2 sm:tw-py-2.5 tw-font-medium tw-rounded-lg tw-shadow-md tw-transition-all">{t("uploadBtn", lang)}</Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}