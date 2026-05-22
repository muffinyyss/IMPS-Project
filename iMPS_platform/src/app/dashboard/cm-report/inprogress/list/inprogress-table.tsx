"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import CMInProgressForm from "@/app/dashboard/cm-report/inprogress/input_CMreport/components/checkList";
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

// ==================== TRANSLATIONS ====================
const T = {
  // Page Header
  pageTitle: { th: "Corrective Maintenance Report", en: "Corrective Maintenance Report" },
  pageSubtitle: { th: "ค้นหาและดาวน์โหลดเอกสาร CM Report", en: "Search and download CM Report documents" },

  // Table Headers
  colNo: { th: "ลำดับ", en: "No." },
  colDocName: { th: "ชื่อเอกสาร", en: "Document Name" },
  colIssueId: { th: "รหัสเอกสาร", en: "Issue ID" },
  colFoundDate: { th: "วันที่แจ้ง", en: "Found Date" },
  colReportedBy: { th: "ผู้แจ้งปัญหา", en: "Reported By" },
  colLocation: { th: "ตำแหน่งที่พบ", en: "Faulty Equipment" },
  colProblemDetails: { th: "ปัญหาที่พบ", en: "Problem Details" },
  colStatus: { th: "สถานะ", en: "Status" },
  colRepairResult: { th: "ผลการซ่อม", en: "Repair Result" },
  colInspector: { th: "ผู้ตรวจสอบ", en: "Inspector" },

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

  // Alerts
  alertSelectStation: { th: "กรุณาเลือกสถานีก่อน", en: "Please select a station first" },
  alertPdfOnly: { th: "รองรับเฉพาะไฟล์ PDF เท่านั้น", en: "Only PDF files are supported" },
  alertInvalidDate: { th: "รูปแบบวันที่ไม่ถูกต้อง", en: "Invalid date format" },
  alertUploadFailed: { th: "อัพโหลดไม่สำเร็จ:", en: "Upload failed:" },
  alertUploadSuccess: { th: "อัพโหลดสำเร็จ", en: "Upload successful" },
  alertUploadError: { th: "เกิดข้อผิดพลาดระหว่างอัพโหลด", en: "An error occurred during upload" },
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
  repair_result?: string;
  location?: string;
  problem_details?: string;
  status: string;
  inspector?: string;
};

type Props = {
  token?: string;
  apiBase?: string;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function CMInProgressReportPage({ token, apiBase = BASE }: Props) {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [data, setData] = useState<TData[]>([]);
  const [filtering, setFiltering] = useState("");

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const searchParams = useSearchParams();
  const [stationId, setStationId] = useState<string | null>(null);

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

  // Always filter by "in progress" for this table
  const statusFromTab = "in progress";
  const statusLabel = "In Progress";

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

      // Filter by "in progress" status
      const filterByStatus = (it: any) => {
        const s = String(it?.status ?? it?.job?.status ?? "").trim().toLowerCase();
        return s === "in progress";
      };

      cmItems = cmItems.filter(filterByStatus);
      urlItems = urlItems.filter(filterByStatus);

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
        const generatedUrl = id ? `${apiBase}/pdf/${encodeURIComponent(id)}/file` : "";
        const fileUrl = uploadedUrl || generatedUrl;

        return {
          id,
          doc_name: it.doc_name || "",
          issue_id: it.issue_id || "",
          cm_date: isoDay,
          position: isoDay,
          office: fileUrl,
          reported_by: it.reported_by || "",
          inspector: it.inspector || "",
          repair_result: it.repair_result || "",
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
          reported_by: it.reported_by || "",
          inspector: it.inspector || "",
          repair_result: it.repair_result || "",
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
    }
  };

  // ✅ Auto-refresh: refetch เมื่อกลับจาก form → list
  useEffect(() => {
    if (mode !== "list") return;
    let alive = true;
    (async () => { await fetchRows(); })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, stationId, mode]);

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
      id: "found_date",
      header: () => t("colFoundDate", lang),
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
      accessorFn: (row) => row.repair_result || "-",
      id: "repair_result",
      header: () => t("colRepairResult", lang),
      cell: (info: CellContext<TData, unknown>) => (
        <span className="tw-block tw-truncate" title={info.getValue() as string}>
          {info.getValue() as React.ReactNode}
        </span>
      ),
      size: 150,
      minSize: 100,
      maxSize: 220,
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
            sl === "closed" || sl === "close" ? "tw-bg-gray-200 tw-text-gray-800" :
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
  ], [lang]);

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

  // Handle row click
  const handleRowClick = (row: TData) => {
    if (row?.id) {
      goEdit(row);
    }
  };

  if (mode === "form") {
    return (
      <div className="tw-mt-4 sm:tw-mt-6 lg:tw-mt-8">
        <CMInProgressForm />
      </div>
    );
  }

  return (
    <>
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
    </>
  );
}