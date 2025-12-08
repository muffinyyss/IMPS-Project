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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/solid";
import { ArrowUpTrayIcon, DocumentArrowDownIcon, EyeIcon } from "@heroicons/react/24/outline";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";
import ChargerPMForm from "@/app/dashboard/pm-report/charger/input_PMreport/components/checkList";
import { apiFetch } from "@/utils/api";
type TData = {
  id?: string;
  doc_name?: string;
  issue_id?: string; // ทำเป็น optional และเติมค่าจาก id หรือ regex ใน url
  pm_date: string; // วันที่แบบไทย แสดงผลในตาราง 
  position: string; // ISO YYYY-MM-DD ใช้สำหรับ sort
  office: string; // URL ไฟล์
  inspector?: string;
  side?: string;
};

type Props = {
  token?: string;
  apiBase?: string;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const REPORT_PREFIX = "pmreport";
const URL_PREFIX = "pmurl";

const PM_TYPE_CODE = "CG"; // ใช้รหัสเดียวกับ MDB

function makePrefix(typeCode: string, dateISO: string) {
  const d = new Date(dateISO || new Date().toISOString().slice(0, 10));
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `PM-${typeCode}-${yy}${mm}-`; // เช่น PM-MB-2511-
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

// หา issue_id ล่าสุดจากทั้ง 2 ลิสต์ (รายงานจริง + URL) แล้วออกเลขถัดไป
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

/* ---------- NEW: helper สำหรับ doc_name ---------- */
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

  // ยังไม่มีของปีนี้เลย → เริ่มที่ 1
  if (!s || !s.startsWith(prefix) || !s.endsWith(suffix)) {
    return `${prefix}1${suffix}`;
  }

  // ดึงเลขตรงกลาง เช่น "ST001_5/2025" → "5"
  const inside = s.slice(prefix.length, s.length - suffix.length);
  const cur = parseInt(inside, 10);
  const nextIndex = isNaN(cur) ? 1 : cur + 1;

  return `${prefix}${nextIndex}${suffix}`;
}

async function fetchPreviewDocName(
  stationId: string,
  pmDate: string
): Promise<string | null> {
  const u = new URL(`${BASE}/pmreport/preview-docname`);
  u.searchParams.set("station_id", stationId);
  u.searchParams.set("pm_date", pmDate);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ?? ""
      : "";

  const r = await apiFetch(u.toString(), {
    // const r = await fetch(u.toString(), {
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
  stationId: string,
  dateISO: string
): Promise<string | null> {
  const u = new URL(`${BASE}/pmreport/latest-docname`);
  u.searchParams.set("station_id", stationId);
  u.searchParams.set("pm_date", dateISO);
  u.searchParams.set("_ts", String(Date.now()));

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ?? ""
      : "";

  // const r = await fetch(u.toString(), {
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
    return `${y}-${m}-${day}`;   // YYYY-MM-DD ตามวันที่เครื่องผู้ใช้
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
    // ถ้าใช้ httpOnly cookie เป็นหลัก ก็ไม่ต้องพึ่ง localStorage มาก
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
          // const res = await fetch(`${apiBase}/me`, {
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

        // ให้ inspector default เป็น username ถ้ายังว่างอยู่
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
    } else {
      params.delete("view");
      params.delete("edit_id");
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

  function thDate(iso?: string) {
    if (!iso) return "-";

    // บังคับให้ตีความเป็นเวลา UTC
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Date(iso + "T00:00:00Z")
      : new Date(iso);

    if (isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("th-TH-u-ca-gregory", {
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
      it?.date, // เผื่อบาง API ใช้ key นี้
    ];
    for (const v of cands) {
      const d = normalizeAnyDate(v);
      if (d) return d;
    }
    return "";
  }

  // Fetch data (with abort support)
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

      // const fetchOpts: RequestInit = { ...baseFetchOpts, signal };

      const [pmRes, urlRes] = await Promise.allSettled([
        // fetch(makeURL("/pmreport/list"), FetchOpts),
        // fetch(makeURL("/pmurl/list"), FetchOpts),
        apiFetch(makeURL("/pmreport/list"), FetchOpts),
        apiFetch(makeURL("/pmurl/list"), FetchOpts),
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
        const generatedUrl = id ? `${apiBase}/pdf/charger/${encodeURIComponent(id)}/export` : "";

        const fileUrl = uploadedUrl || generatedUrl;
        // const issueId = id || extractDocIdFromAnything(fileUrl) || "";
        const issueId = (it.issue_id ? String(it.issue_id) : "") || extractDocIdFromAnything(fileUrl) || "";

        const doc_name = (it.doc_name ? String(it.doc_name) : "")
        const inspector =
          (it.inspector ?? it.job?.inspector ?? "") as string;
        // const side = (it.side ? String(it.side) : "")
        const side =
          (it.side ?? it.job?.side ?? "") as string;
        return {
          id,
          issue_id: issueId,
          doc_name: doc_name,
          pm_date: thDate(isoDay),
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
        // const issueId = extractDocIdFromAnything(it) || extractDocIdFromAnything(href) || "";
        const issueId = (it.issue_id ? String(it.issue_id) : "") || extractDocIdFromAnything(href) || "";
        const doc_name = (it.doc_name ? String(it.doc_name) : "")
        const inspector = (it.inspector ?? it.job?.inspector ?? "") as string; // 👈 จะว่างก็ได้
        // const side = (it.side ? String(it.side) : "")
        const side = (it.side ?? it.job?.side ?? "") as string;
        // setSide(side)
        return {
          issue_id: issueId,
          doc_name: doc_name,
          pm_date: thDate(isoDay),
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
        return da < db ? 1 : da > db ? -1 : 0; // desc
      });

      if (!allRows.length) { setData([]); return; }
      setData(allRows);
    } catch (err: any) {
      if (err?.name === "AbortError") return; // ignore abort
      console.error("fetch both lists error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    let alive = true;
    (async () => { await fetchRows(); })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, stationId]);

  function appendParam(u: string, key: string, val: string) {
    const url = new URL(u, apiBase);
    if (!url.searchParams.has(key)) url.searchParams.set(key, val);
    return url.toString();
  }

  function buildHtmlLinks(baseUrl?: string) {
    const u = (baseUrl || "").trim();
    if (!u) return { previewHref: "", downloadHref: "", isPdfEndpoint: false };

    // ตรวจจับ endpoint ใหม่ เช่น /pdf/charger/<id>/export
    const isPdfEndpoint = /\/pdf\/(charger|mdb|ccb|cbbox|station)\/[A-Fa-f0-9]{24}\/export(?:\b|$)/.test(u);

    if (isPdfEndpoint) {
      const finalUrl = u;
      const withStation = appendParam(finalUrl, "station_id", stationId || "");
      return {
        previewHref: appendParam(withStation, "dl", "0"),
        downloadHref: appendParam(withStation, "dl", "1"),
        isPdfEndpoint: true,
      };
    }

    // fallback เดิม
    return { previewHref: u, downloadHref: u, isPdfEndpoint: false };
  }

  function extractDocIdFromAnything(x: any): string {
    if (!x) return "";
    // ลองอ่านจาก field id/_id ก่อน
    const raw = (x._id !== undefined ? x._id : x.id) ?? "";
    let id = "";
    if (raw && typeof raw === "object") id = raw.$oid || raw.oid || raw.$id || "";
    else id = String(raw || "");
    if (/^[a-fA-F0-9]{24}$/.test(id)) return id;

    // สุดท้ายลองดึงจากสตริง URL
    const s = typeof x === "string" ? x : JSON.stringify(x);
    const m = s.match(/[A-Fa-f0-9]{24}/);
    return m ? m[0] : "";
  }

  useEffect(() => {
    const ac = new AbortController();
    fetchRows(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, stationId, searchParams.toString()]);

  // Table columns
  const columns: ColumnDef<TData, unknown>[] = [
    {
      id: "no",
      header: () => "No.",
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
      header: () => "document name",
      cell: (info: CellContext<TData, unknown>) => info.getValue() as React.ReactNode,
      size: 120,
      minSize: 80,
      maxSize: 160,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.issue_id || "—",
      id: "issue_id",
      header: () => "issue id",
      cell: (info: CellContext<TData, unknown>) => info.getValue() as React.ReactNode,
      size: 120,
      minSize: 80,
      maxSize: 160,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.pm_date,
      id: "date",
      header: () => "pm date",
      cell: (info: CellContext<TData, unknown>) => info.getValue() as React.ReactNode,
      size: 100,
      minSize: 80,
      maxSize: 140,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.inspector || "-",
      id: "inspector",
      header: () => "inspector",
      cell: (info: CellContext<TData, unknown>) => info.getValue() as React.ReactNode,
      size: 100,
      minSize: 80,
      maxSize: 140,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.office,
      id: "pdf",
      header: () => "PDF",
      enableSorting: false,
      cell: (info: CellContext<TData, unknown>) => {
        const url = info.getValue() as string | undefined;
        const hasUrl = typeof url === "string" && url.length > 0;

        if (!hasUrl) {
          return <span className="tw-text-blue-gray-300" title="No file">—</span>;
        }

        const { previewHref /*, downloadHref*/ } = buildHtmlLinks(url);

        const rowSide = info.row.original.side;

        // console.log("side = ", (side))
        if (rowSide == "pre") {
          return (
            <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
              <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2">
                <Button
                  size="sm"
                  color="blue"
                  variant="outlined"
                  className="tw-shrink-0"
                  onClick={() => {
                    // เอา query param เดิมมาต่อ ไม่ให้หาย
                    const params = new URLSearchParams(searchParams.toString());
                    // บังคับให้เปลี่ยนเป็นหน้า form (ChargerPMForm)
                    params.set("view", "form");
                    // ส่งคำว่า "post" ไปด้วยใน query string
                    params.set("action", "post");
                    params.set("edit_id", info.row.original.id || "");

                    router.push(`${pathname}?${params.toString()}`, { scroll: false });
                  }}
                >
                  post-pm
                </Button>
              </div>
            </div>
          );
        } else {
          return (
            <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
              <a
                aria-label="Preview"
                href={previewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1 tw-text-red-600 hover:tw-text-red-800"
                title="Preview"
              >
                <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
              </a>
            </div>
          )

        }


      },
      size: 150,
      minSize: 120,
      maxSize: 180,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
  ];

  const table = useReactTable({
    data,
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

  // Upload dialog
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  // const [urlText, setUrlText] = useState("");

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.currentTarget.value = "";
    if (!files.length) return;

    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) {
      alert("รองรับเฉพาะไฟล์ PDF เท่านั้น");
      return;
    }
    setPendingFiles(pdfs);
    setDateOpen(true);
  };

  async function uploadPdfs() {
    try {
      if (!stationId) {
        alert("กรุณาเลือกสถานีก่อน");
        return;
      }
      if (!pendingFiles.length) {
        setDateOpen(false);
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
        alert("รูปแบบวันที่ไม่ถูกต้อง");
        return;
      }

      const fd = new FormData();
      fd.append("station_id", stationId);
      fd.append("reportDate", reportDate);
      fd.append("issue_id", issueId);
      fd.append("doc_name", docName || "");
      fd.append("inspector", inspector || "");
      pendingFiles.forEach((f) => fd.append("files", f));

      const res = await apiFetch(`${apiBase}/pmurl/upload-files?_ts=${Date.now()}`, {
        // const res = await fetch(`${apiBase}/pmurl/upload-files?_ts=${Date.now()}`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        alert("อัปโหลดไม่สำเร็จ: " + txt);
        return;
      }

      await res.json();
      alert("อัปโหลดสำเร็จ");
      setPendingFiles([]);
      setDateOpen(false);
      await fetchRows();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดระหว่างอัปโหลด");
    }
  }

  useEffect(() => {
    if (!dateOpen || !stationId || !reportDate) return;

    let canceled = false;

    (async () => {
      try {
        // 1) ลองขอชื่อจาก preview endpoint ก่อน
        const preview = await fetchPreviewDocName(stationId, reportDate);
        if (!canceled && preview) {
          setDocName(preview);
          return;
        }

        // 2) ถ้าไม่มี preview → ดึง latest แล้วคำนวณชื่อถัดไป
        const latest = await fetchLatestDocName(stationId, reportDate);
        if (!canceled) {
          const next = nextDocNameFor(stationId, reportDate, latest || undefined);
          setDocName(next);
        }
      } catch (e) {
        console.error("auto doc_name error:", e);
        if (!canceled) {
          // 3) กรณี error → fallback เป็นชื่อแรกของปีนั้น ๆ
          const fallback = nextDocNameFor(stationId, reportDate);
          setDocName(fallback);
        }
      }
    })();

    return () => {
      canceled = true;
    };
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
    params.delete("edit_id"); // 👈 ลบด้วย
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };
  function goEdit(row: TData) {
    if (!row?.id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "form");
    params.set("edit_id", row.id);       // 👈 ให้ฟอร์มใช้โหลดข้อมูล
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (mode === "form") {
    return (
      <div className="tw-mt-6">
        {/* <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4">
          <Button
            variant="outlined"
            size="sm"
            onClick={goList}
            // className="tw-py-2 tw-px-2"
            title="กลับไปหน้า List"
          >
            <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
          </Button>
        </div> */}
        <ChargerPMForm />
      </div>
    );
  }

  return (
    <>
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8">
        <CardHeader floated={false} shadow={false} className="tw-p-4">
          <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-gap-4">
            <div className="tw-flex-1">
              <Typography variant="h5" color="blue-gray">
                Preventive Maintenance Checklist
              </Typography>
              <Typography variant="small" className="tw-text-blue-gray-500 tw-mt-1">
                ค้นหาและดาวน์โหลดเอกสารรายงานการบำรุงรักษา (PM Report)
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
                  disabled={!stationId}
                  onClick={() => pdfInputRef.current?.click()}
                  className="group tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-3 sm:tw-px-4 tw-flex tw-items-center tw-gap-2 tw-border tw-border-blue-gray-100 tw-bg-white tw-text-blue-gray-900"
                  title="อัปโหลด PDF (demo)">

                  <ArrowUpTrayIcon className="tw-h-5 tw-w-5" />
                  <span className="tw-text-sm">Upload</span>
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
                  title={stationId ? "" : "กรุณาเลือกสถานีจากแถบบนก่อน"}
                >
                  <span className="tw-w-full tw-text-center">+Add</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardBody className="tw-flex tw-items-center tw-gap-3">
          <div className="tw-flex tw-items-center tw-gap-2">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="tw-border tw-p-2 tw-rounded"
            >
              {[5, 10, 15, 20, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <Typography variant="small" className="tw-text-blue-gray-500">
              entries per page
            </Typography>
          </div>
          <div className="tw-ml-auto tw-w-64">
            <Input value={filtering} onChange={(e) => setFiltering(e.target.value)} label="Search" crossOrigin={undefined} />
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
                      กำลังโหลด…
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
                      {!stationId ? "กรุณาเลือกสถานีจากแถบบนก่อน" : "ไม่มีข้อมูล"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardFooter>


        <div className="tw-flex tw-items-center tw-justify-between tw-p-4">
          <Typography variant="small">
            Page <strong>{table.getState().pagination.pageIndex + 1}</strong> of <strong>{table.getPageCount()}</strong>
          </Typography>
          <div className="tw-flex tw-gap-2">
            <Button size="sm" variant="outlined" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              <ChevronLeftIcon className="tw-h-4 tw-w-4" />
            </Button>
            <Button size="sm" variant="outlined" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              <ChevronRightIcon className="tw-h-4 tw-w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={dateOpen} handler={setDateOpen} size="sm">
        <DialogHeader>เลือกวันที่รายงาน</DialogHeader>
        <DialogBody className="tw-space-y-4">
          <div className="tw-space-y-2">
            <Input
              label="Document Name / ชื่อเอกสาร"
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
              label="Issue id / รหัสเอกสาร"
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
              label="Inspector / ผู้ตรวจสอบ"
              value={inspector}
              onChange={(e) => setInspector(e.target.value)}
              crossOrigin=""
              containerProps={{ className: "!tw-min-w-0" }}
              className="!tw-w-full !tw-bg-blue-gray-50"
              readOnly
            />
          </div>
          {/* <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} label="วันที่" crossOrigin="" /> */}
          <Input
            type="date"
            value={reportDate}
            max={todayStr}  // ⬅️ จำกัดไม่ให้เลือกเกินวันนี้
            onChange={(e) => setReportDate(e.target.value)}
            label="PM Date / วันที่ตรวจสอบ"
            crossOrigin=""
          />
          <Typography variant="small" className="tw-text-blue-gray-500">
            ไฟล์ที่เลือก: <strong>{pendingFiles.length}</strong> ไฟล์
          </Typography>
        </DialogBody>
        <DialogFooter className="tw-gap-2">
          <Button
            variant="text"
            onClick={() => {
              setPendingFiles([]);
              setDateOpen(false);
            }}
          >
            ยกเลิก
          </Button>
          <Button onClick={uploadPdfs} className="tw-bg-black">
            อัปโหลด
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
