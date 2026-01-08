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
  type Row,
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
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon } from "@heroicons/react/24/solid";
import { ArrowUpTrayIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";
import CCBPMForm from "@/app/dashboard/pm-report/ccb/input_PMreport/components/checkList";
import { apiFetch } from "@/utils/api";
import { useLanguage, type Lang } from "@/utils/useLanguage";

// ==================== TRANSLATIONS ====================
const T = {
  // Page header
  pageTitle: { th: "Preventive Maintenance Checklist - CCB", en: "Preventive Maintenance Checklist - CCB" },
  pageSubtitle: { th: "ค้นหาและดาวน์โหลดเอกสารรายงานการบำรุงรักษา (PM report)", en: "Search and download maintenance reports (PM Report)" },
  
  // Buttons
  upload: { th: "อัปโหลด", en: "Upload" },
  add: { th: "+เพิ่ม", en: "+Add" },
  postPm: { th: "post-pm", en: "post-pm" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  uploadBtn: { th: "อัปโหลด", en: "Upload" },
  
  // Table headers
  colNo: { th: "ลำดับ", en: "No." },
  colDocName: { th: "ชื่อเอกสาร", en: "Document Name" },
  colIssueId: { th: "รหัสเอกสาร", en: "Issue ID" },
  colPmDate: { th: "วันที่ PM", en: "PM Date" },
  colInspector: { th: "ผู้ตรวจสอบ", en: "Inspector" },
  colPdf: { th: "PDF", en: "PDF" },
  
  // Pagination
  entriesPerPage: { th: "รายการต่อหน้า", en: "entries per page" },
  page: { th: "หน้า", en: "Page" },
  of: { th: "จาก", en: "of" },
  
  // Search
  search: { th: "ค้นหา", en: "Search" },
  
  // Loading/Empty states
  loading: { th: "กำลังโหลด…", en: "Loading…" },
  noData: { th: "ไม่มีข้อมูล", en: "No data" },
  selectStationFirst: { th: "กรุณาเลือกสถานีจากแถบบนก่อน", en: "Please select a station first" },
  noFile: { th: "ไม่มีไฟล์", en: "No file" },
  
  // Dialog
  dialogTitle: { th: "เลือกวันที่รายงาน (PM Report)", en: "Select Report Date (PM Report)" },
  docNameLabel: { th: "Document Name / ชื่อเอกสาร", en: "Document Name" },
  issueIdLabel: { th: "Issue id / รหัสเอกสาร", en: "Issue ID" },
  inspectorLabel: { th: "Inspector / ผู้ตรวจสอบ", en: "Inspector" },
  pmDateLabel: { th: "PM Date / วันที่ตรวจสอบ", en: "PM Date" },
  filesSelected: { th: "ไฟล์ที่เลือก:", en: "Files selected:" },
  filesUnit: { th: "ไฟล์", en: "file(s)" },
  
  // Alerts
  alertSelectStation: { th: "กรุณาเลือกสถานีก่อน", en: "Please select a station first" },
  alertPdfOnly: { th: "รองรับเฉพาะไฟล์ PDF เท่านั้น", en: "Only PDF files are supported" },
  alertInvalidDate: { th: "รูปแบบวันที่ไม่ถูกต้อง (ควรเป็น YYYY-MM-DD)", en: "Invalid date format (should be YYYY-MM-DD)" },
  alertUploadFailed: { th: "อัปโหลดไม่สำเร็จ:", en: "Upload failed:" },
  alertUploadSuccess: { th: "อัปโหลดสำเร็จ", en: "Upload successful" },
  alertUploadError: { th: "เกิดข้อผิดพลาดระหว่างอัปโหลด", en: "Error during upload" },
  
  // Tooltips
  backToList: { th: "กลับไปหน้า List", en: "Back to list" },
  preview: { th: "พรีวิว", en: "Preview" },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

type TData = {
  id?: string;
  issue_id?: string;
  doc_name?: string;
  pm_date?: string;      // ISO date for sorting/formatting
  position: string;      // ISO YYYY-MM-DD for sort
  office: string;        // URL file
  inspector?: string;
  side?: string;
};

type Props = {
  token?: string;
  apiBase?: string;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const REPORT_PREFIX = "ccbpmreport";
const URL_PREFIX = "ccbpmurl";

const PM_TYPE_CODE = "CC";

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

async function fetchLatestIssueIdAcrossLists(stationId: string, dateISO: string, apiBase: string, fetchOpts: RequestInit) {
  const build = (path: string) => {
    const u = new URL(`${apiBase}${path}`);
    u.searchParams.set("station_id", stationId);
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
  const u = new URL(`${BASE}/ccbpmreport/preview-docname`);
  u.searchParams.set("station_id", stationId);
  u.searchParams.set("pm_date", pmDate);

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";

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

async function fetchLatestDocName(stationId: string, dateISO: string): Promise<string | null> {
  const u = new URL(`${BASE}/ccbpmreport/latest-docname`);
  u.searchParams.set("station_id", stationId);
  u.searchParams.set("pm_date", dateISO);
  u.searchParams.set("_ts", String(Date.now()));

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";

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
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

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

  useEffect(() => {
    const useHttpOnlyCookie = true;

    (async () => {
      try {
        const headers: Record<string, string> = {};
        if (!useHttpOnlyCookie) {
          const t = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
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
  const mode: "list" | "form" = (searchParams.get("view") === "form" || !!editId) ? "form" : "list";
  
  const setView = (view: "list" | "form", { replace = false } = {}) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "form") {
      params.set("view", "form");
      params.set("pmtab", "pre");
    } else {
      params.delete("view");
      params.delete("edit_id");
      params.delete("pmtab");
    }
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

  const FetchOpts: RequestInit = {
    headers: makeHeaders(),
    ...(useHttpOnlyCookie ? { credentials: "include" as const } : {}),
    cache: "no-store",
  };

  // ✅ Format date at render time with language support
  function formatDate(iso?: string, currentLang: Lang = lang) {
    if (!iso) return "-";

    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Date(iso + "T00:00:00Z")
      : new Date(iso);

    if (isNaN(d.getTime())) return "-";

    return d.toLocaleDateString(currentLang === "en" ? "en-GB" : "th-TH-u-ca-gregory", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    });
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
      const u = new URL(s);
      return u.toString();
    } catch { /* not absolute */ }

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
    if (!stationId) {
      setData([]);
      return;
    }
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

      let pmItems: any[] = [];
      let urlItems: any[] = [];

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
        const generatedUrl = id ? `${apiBase}/pdf/ccb/${encodeURIComponent(id)}/export` : "";

        const fileUrl = uploadedUrl || generatedUrl;
        const doc_name = (it.doc_name ? String(it.doc_name) : "");
        const issueId = (it.issue_id ? String(it.issue_id) : "") || extractDocIdFromAnything(fileUrl) || "";
        const inspector = (it.inspector ?? it.job?.inspector ?? "") as string;
        const side = (it.side ?? it.job?.side ?? "") as string;
        
        return {
          id,
          issue_id: issueId,
          doc_name: doc_name,
          pm_date: isoDay,  // ✅ Store ISO date, format at render time
          position: isoDay,
          office: fileUrl,
          inspector,
          side
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
        const doc_name = (it.doc_name ? String(it.doc_name) : "");
        const inspector = (it.inspector ?? it.job?.inspector ?? "") as string;
        const side = (it.side ?? it.job?.side ?? "") as string;
        
        return {
          issue_id: issueId,
          doc_name: doc_name,
          pm_date: isoDay,  // ✅ Store ISO date, format at render time
          position: isoDay,
          office: href,
          inspector,
          side
        } as TData;
      });

      const allRows = [...pmRows, ...urlRows].sort((a, b) => {
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
    }
  };

  // ✅ Remove lang from dependency - no re-fetch needed on language change
  useEffect(() => {
    let alive = true;
    (async () => { await fetchRows(); })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, stationId]);

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

      const photosBase =
        (process.env.NEXT_PUBLIC_PHOTOS_BASE_URL as string) ||
        (typeof window !== "undefined" ? window.location.origin : "");
      if (photosBase) finalUrl = appendParam(finalUrl, "photos_base_url", photosBase);

      finalUrl = appendParam(finalUrl, "dl", "0");
      return { previewHref: finalUrl, isPdfEndpoint: true };
    }
    return { previewHref: u, isPdfEndpoint: false };
  }

  useEffect(() => {
    const ac = new AbortController();
    fetchRows(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, stationId, searchParams.toString()]);

  // ✅ Columns with i18n - format date at render time
  const columns: ColumnDef<TData, unknown>[] = useMemo(() => [
    {
      id: "no",
      header: () => t("colNo", lang),
      enableSorting: false,
      size: 25,
      minSize: 10,
      maxSize: 25,
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
      cell: (info: CellContext<TData, unknown>) => info.getValue() as React.ReactNode,
      size: 120,
      minSize: 80,
      maxSize: 160,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.issue_id || "—",
      id: "issue_id",
      header: () => t("colIssueId", lang),
      cell: (info: CellContext<TData, unknown>) => info.getValue() as React.ReactNode,
      size: 120,
      minSize: 80,
      maxSize: 160,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.pm_date,
      id: "date",
      header: () => t("colPmDate", lang),
      cell: (info: CellContext<TData, unknown>) => {
        const isoDate = info.getValue() as string;
        return formatDate(isoDate, lang);  // ✅ Format at render time
      },
      size: 80,
      minSize: 60,
      maxSize: 120,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.inspector || "-",
      id: "inspector",
      header: () => t("colInspector", lang),
      cell: (info: CellContext<TData, unknown>) => info.getValue() as React.ReactNode,
      size: 100,
      minSize: 80,
      maxSize: 140,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.office,
      id: "pdf",
      header: () => t("colPdf", lang),
      enableSorting: false,
      cell: (info: CellContext<TData, unknown>) => {
        const url = info.getValue() as string | undefined;
        const hasUrl = typeof url === "string" && url.length > 0;

        if (!hasUrl) {
          return <span className="tw-text-blue-gray-300" title={t("noFile", lang)}>—</span>;
        }

        const { previewHref } = buildHtmlLinks(url);
        const rowSide = info.row.original.side;

        if (rowSide === "pre") {
          return (
            <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
              <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2">
                <Button
                  size="sm"
                  color="blue"
                  variant="outlined"
                  className="tw-shrink-0"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
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
            </div>
          );
        } else {
          return (
            <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
              <a
                aria-label={t("preview", lang)}
                href={previewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1 tw-text-red-600 hover:tw-text-red-800"
                title={t("preview", lang)}
              >
                <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
              </a>
            </div>
          );
        }
      },
      size: 150,
      minSize: 120,
      maxSize: 180,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
  ], [lang, searchParams, pathname, router, stationId]);

  function sameUser(a?: string, b?: string) {
    return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
  }

  const visibleData = useMemo(() => {
    const username = me?.username;
    return data.filter((row) => {
      if (row.side !== "pre") return true;
      if (!username) return false;
      return sameUser(row.inspector, username);
    });
  }, [data, me?.username]);

  const table = useReactTable({
    data: visibleData,
    columns,
    state: { globalFilter: filtering, sorting },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFiltering,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
  });

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.currentTarget.value = "";
    if (!files.length) return;

    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) {
      alert(t("alertPdfOnly", lang));
      return;
    }
    setPendingFiles(pdfs);
    setDateOpen(true);
  };

  async function uploadPdfs() {
    try {
      if (!stationId) {
        alert(t("alertSelectStation", lang));
        return;
      }
      if (!pendingFiles.length) {
        setDateOpen(false);
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
        alert(t("alertInvalidDate", lang));
        return;
      }

      const fd = new FormData();
      fd.append("station_id", stationId);
      fd.append("reportDate", reportDate);
      fd.append("issue_id", issueId);
      fd.append("doc_name", docName || "");
      fd.append("inspector", inspector || "");
      pendingFiles.forEach((f) => fd.append("files", f));

      const res = await fetch(`${apiBase}/${URL_PREFIX}/upload-files`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        alert(`${t("alertUploadFailed", lang)} ${txt}`);
        return;
      }

      const j = await res.json();
      console.log("uploaded:", j);
      alert(t("alertUploadSuccess", lang));

      setPendingFiles([]);
      setDateOpen(false);

      await fetchRows();
    } catch (err) {
      console.error(err);
      alert(t("alertUploadError", lang));
    }
  }

  useEffect(() => {
    if (!dateOpen || !stationId || !reportDate) return;

    let canceled = false;

    (async () => {
      try {
        const preview = await fetchPreviewDocName(stationId, reportDate);
        if (!canceled && preview) {
          setDocName(preview);
          return;
        }

        const latest = await fetchLatestDocName(stationId, reportDate);
        if (!canceled) {
          const next = nextDocNameFor(stationId, reportDate, latest || undefined);
          setDocName(next);
        }
      } catch (e) {
        console.error("auto doc_name error:", e);
        if (!canceled) {
          const fallback = nextDocNameFor(stationId, reportDate);
          setDocName(fallback);
        }
      }
    })();

    return () => { canceled = true; };
  }, [dateOpen, stationId, reportDate]);

  useEffect(() => {
    if (!dateOpen || !stationId || !reportDate) return;

    let canceled = false;
    (async () => {
      try {
        const latest = await fetchLatestIssueIdAcrossLists(stationId, reportDate, apiBase, FetchOpts);
        const next = nextIssueIdFor(PM_TYPE_CODE, reportDate, latest || "");
        if (!canceled) setIssueId(next);
      } catch {
        if (!canceled) setIssueId(nextIssueIdFor(PM_TYPE_CODE, reportDate, ""));
      }
    })();

    return () => { canceled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateOpen, stationId, reportDate]);

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
    return (
      <div className="tw-mt-6">
        <CCBPMForm />
      </div>
    );
  }

  return (
    <>
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
        <CardHeader
          floated={false}
          shadow={false}
          className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-gap-3 tw-!px-3 md:tw-!px-4 tw-!py-3 md:tw-!py-4 tw-mb-6"
        >
          <div className="tw-ml-3">
            <Typography color="blue-gray" variant="h5" className="tw-text-base sm:tw-text-lg md:tw-text-xl">
              {t("pageTitle", lang)}
            </Typography>
            <Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-normal tw-mt-1 tw-text-xs sm:tw-text-sm">
              {t("pageSubtitle", lang)}
            </Typography>
          </div>

          <div className="tw-w-full md:tw-w-auto md:tw-ml-auto md:tw-flex md:tw-justify-end">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 sm:tw-gap-3 tw-justify-end tw-w-full md:tw-w-auto md:tw-mt-6">
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="tw-hidden"
                onChange={handlePdfChange}
              />
              <Button
                variant="text"
                size="lg"
                onClick={() => pdfInputRef.current?.click()}
                className="group tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-3 sm:tw-px-4 tw-flex tw-items-center tw-gap-2 tw-bg-white tw-text-blue-gray-900 tw-border tw-border-blue-gray-100 tw-shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:tw-bg-black hover:tw-text-black hover:tw-border-black hover:tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)] tw-transition-colors tw-duration-200 focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none"
              >
                <ArrowUpTrayIcon className="tw-h-5 tw-w-5 tw-transition-transform tw-duration-200 group-hover:-tw-translate-y-0.5" />
                <span className="tw-text-sm">{t("upload", lang)}</span>
              </Button>

              <Button
                size="lg"
                onClick={goAdd}
                disabled={!stationId}
                className={`
                  !tw-flex !tw-justify-center !tw-items-center tw-text-center tw-leading-none
                  tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-4
                  ${!stationId
                    ? "tw-bg-gray-300 tw-text-white tw-cursor-not-allowed"
                    : "tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-from-black hover:tw-to-black tw-text-white"}
                  tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)]
                  focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none
                `}
                title={stationId ? "" : t("selectStationFirst", lang)}
              >
                <span className="tw-w-full tw-text-center">{t("add", lang)}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardBody className="tw-flex tw-items-center tw-gap-3 tw-px-3 md:tw-px-4">
          <div className="tw-flex tw-items-center tw-gap-3">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="tw-border tw-p-2 tw-border-blue-gray-100 tw-rounded-lg tw-w-[72px]"
            >
              {[5, 10, 15, 20, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-normal">
              {t("entriesPerPage", lang)}
            </Typography>
          </div>
          <div className="tw-ml-auto tw-min-w-0 tw-flex-1 md:tw-flex-none md:tw-w-64">
            <Input
              variant="outlined"
              value={filtering}
              onChange={(e) => setFiltering(e.target.value)}
              label={t("search", lang)}
              crossOrigin={undefined}
              containerProps={{ className: "tw-min-w-0" }}
              className="tw-w-full"
            />
          </div>
        </CardBody>

        <CardFooter className="tw-p-0">
          <div className="tw-relative tw-w-full tw-overflow-x-auto tw-overflow-y-hidden tw-scroll-smooth">
            <table className="tw-w-full tw-text-left tw-min-w-[720px] md:tw-min-w-0 md:tw-table-fixed">
              <thead className="tw-bg-gray-50 tw-sticky tw-top-0">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const align = (header.column.columnDef as any).meta?.headerAlign ?? "left";
                      return (
                        <th
                          key={header.id}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          className={`tw-p-3 md:tw-p-4 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium tw-whitespace-nowrap
                          ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}`}
                        >
                          {canSort ? (
                            <Typography
                              color="blue-gray"
                              className={`tw-flex tw-items-center tw-gap-1 md:tw-gap-2 tw-text-[10px] sm:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40
                              ${align === "center" ? "tw-justify-center" : align === "right" ? "tw-justify-end" : "tw-justify-start"}`}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <ChevronUpDownIcon strokeWidth={2} className="tw-h-4 tw-w-4" />
                            </Typography>
                          ) : (
                            <Typography
                              color="blue-gray"
                              className={`tw-text-[10px] sm:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40
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

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={columns.length} className="tw-text-center tw-py-8 tw-text-blue-gray-400">
                      {t("loading", lang)}
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="odd:tw-bg-white even:tw-bg-gray-50">
                      {row.getVisibleCells().map((cell) => {
                        const align = (cell.column.columnDef as any).meta?.cellAlign ?? "left";
                        return (
                          <td
                            key={cell.id}
                            style={{ width: cell.column.getSize() }}
                            className={`!tw-border-y !tw-border-x-0 tw-align-middle
                            ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}`}
                          >
                            <Typography
                              variant="small"
                              className="!tw-font-normal !tw-text-blue-gray-600 tw-py-3 md:tw-py-4 tw-px-3 md:tw-px-4 tw-truncate md:tw-whitespace-normal"
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
                    <td colSpan={columns.length} className="tw-text-center tw-py-8 tw-text-blue-gray-400">
                      {!stationId ? t("selectStationFirst", lang) : t("noData", lang)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardFooter>

        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-justify-between tw-gap-3 tw-px-3 md:tw-px-4 tw-py-4">
          <span className="tw-text-sm">
            <Typography className="!tw-font-bold tw-inline">{t("page", lang)}</Typography>{" "}
            <strong>{table.getState().pagination.pageIndex + 1} {t("of", lang)} {table.getPageCount()}</strong>
          </span>
          <div className="tw-flex tw-items-center tw-gap-2">
            <Button
              variant="outlined"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="disabled:tw-opacity-30 tw-py-2 tw-px-2"
            >
              <ChevronLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
            </Button>
            <Button
              variant="outlined"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="disabled:tw-opacity-30 tw-py-2 tw-px-2"
            >
              <ChevronRightIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={dateOpen} handler={setDateOpen} size="sm">
        <DialogHeader className="tw-text-base sm:tw-text-lg">
          {t("dialogTitle", lang)}
        </DialogHeader>
        <DialogBody className="tw-space-y-4">
          <div className="tw-space-y-2">
            <Input
              label={t("docNameLabel", lang)}
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              crossOrigin=""
              containerProps={{ className: "!tw-min-w-0" }}
              className="!tw-w-full !tw-bg-blue-gray-50"
              readOnly
            />
          </div>

          <div className="tw-space-y-2">
            <Input
              label={t("issueIdLabel", lang)}
              value={issueId}
              onChange={(e) => setIssueId(e.target.value)}
              crossOrigin=""
              containerProps={{ className: "!tw-min-w-0" }}
              className="!tw-w-full !tw-bg-blue-gray-50"
              readOnly
            />
          </div>
          <div className="tw-space-y-2">
            <Input
              label={t("inspectorLabel", lang)}
              value={inspector}
              onChange={(e) => setInspector(e.target.value)}
              crossOrigin=""
              containerProps={{ className: "!tw-min-w-0" }}
              className="!tw-w-full !tw-bg-blue-gray-50"
              readOnly
            />
          </div>
          <Input
            type="date"
            value={reportDate}
            max={todayStr}
            onChange={(e) => setReportDate(e.target.value)}
            label={t("pmDateLabel", lang)}
            crossOrigin=""
          />

          <div className="tw-text-sm tw-text-blue-gray-500">
            {t("filesSelected", lang)} <strong>{pendingFiles.length}</strong> {t("filesUnit", lang)}
          </div>
        </DialogBody>
        <DialogFooter className="tw-gap-2">
          <Button
            variant="text"
            color="blue-gray"
            onClick={() => { setPendingFiles([]); setDateOpen(false); }}
            className="tw-rounded-xl"
          >
            {t("cancel", lang)}
          </Button>
          <Button
            color="gray"
            className="tw-rounded-xl tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-from-black hover:tw-to-black"
            onClick={uploadPdfs}
          >
            {t("uploadBtn", lang)}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}