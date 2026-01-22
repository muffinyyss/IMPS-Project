"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import DCForm from "@/app/dashboard/test-report/dc/input_dc/checkList";

import {
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type CellContext,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import {
  Button, Card, CardBody, CardHeader, Typography, CardFooter, Input,
} from "@material-tailwind/react";
import { ArrowUpTrayIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon, ArrowLeftIcon } from "@heroicons/react/24/solid";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";

// ===== Types =====
type TData = {
  id: string;
  documentName: string;
  issueId: string;
  dcDate: string;
  dcDateISO: string;
  inspector: string;
  fileUrl: string;
};

type Props = {
  token?: string;
  apiBase?: string;
}

type Lang = "th" | "en";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ===== Translations =====
const translations = {
  th: {
    title: "Test Report (DC Charger)",
    subtitle: "ค้นหาและดาวน์โหลดเอกสารรายงานการทดสอบ (Test Report)",
    upload: "อัปโหลด",
    add: "+เพิ่ม",
    entriesPerPage: "รายการต่อหน้า",
    search: "ค้นหา",
    page: "หน้า",
    of: "จาก",
    loading: "กำลังโหลด…",
    noData: "ไม่มีข้อมูล",
    selectStation: "กรุณาเลือกสถานีจากแถบบนก่อน",
    backToList: "กลับไปหน้า List",
    // Table columns
    colNo: "ลำดับ",
    colDocName: "ชื่อเอกสาร",
    colIssueId: "รหัสเอกสาร",
    colDcDate: "วันที่ DC",
    colInspector: "ผู้ตรวจสอบ",
    colPdf: "PDF",
    // Dialog
    dialogTitle: "เลือกวันที่รายงาน (Test Report)",
    dialogDateLabel: "วันที่ (รูปแบบ YYYY-MM-DD)",
    dialogFilesSelected: "ไฟล์ที่เลือก",
    dialogFiles: "ไฟล์",
    dialogCancel: "ยกเลิก",
    dialogUpload: "อัปโหลด",
    // Alerts
    alertPdfOnly: "รองรับเฉพาะไฟล์ PDF เท่านั้น",
    alertSelectStation: "กรุณาเลือกสถานีก่อน",
    alertInvalidDate: "รูปแบบวันที่ไม่ถูกต้อง (ควรเป็น YYYY-MM-DD)",
    alertUploadFailed: "อัปโหลดไม่สำเร็จ",
    alertUploadSuccess: "อัปโหลดสำเร็จ",
    alertUploadError: "เกิดข้อผิดพลาดระหว่างอัปโหลด",
    // PDF
    viewPdf: "ดู/ดาวน์โหลด PDF",
    noFile: "ไม่มีไฟล์",
  },
  en: {
    title: "Test Report (DC Charger)",
    subtitle: "Search and download test report documents",
    upload: "Upload",
    add: "+Add",
    entriesPerPage: "entries per page",
    search: "Search",
    page: "Page",
    of: "of",
    loading: "Loading…",
    noData: "No data",
    selectStation: "Please select a station first",
    backToList: "Back to List",
    // Table columns
    colNo: "No.",
    colDocName: "Document Name",
    colIssueId: "ISSUE ID",
    colDcDate: "DC Date",
    colInspector: "Inspector",
    colPdf: "PDF",
    // Dialog
    dialogTitle: "Select Report Date (Test Report)",
    dialogDateLabel: "Date (YYYY-MM-DD format)",
    dialogFilesSelected: "Files selected",
    dialogFiles: "file(s)",
    dialogCancel: "Cancel",
    dialogUpload: "Upload",
    // Alerts
    alertPdfOnly: "Only PDF files are supported",
    alertSelectStation: "Please select a station first",
    alertInvalidDate: "Invalid date format (should be YYYY-MM-DD)",
    alertUploadFailed: "Upload failed",
    alertUploadSuccess: "Upload successful",
    alertUploadError: "An error occurred during upload",
    // PDF
    viewPdf: "View/Download PDF",
    noFile: "No file",
  },
};

// ===== Helper Functions =====
const extractId = (it: any): string => {
  if (!it) return "";
  const raw = (it._id !== undefined ? it._id : it.id) ?? "";
  if (raw && typeof raw === "object") {
    return raw.$oid || raw.oid || raw.$id || "";
  }
  const s = String(raw || "");
  return /^[a-fA-F0-9]{24}$/.test(s) ? s : "";
};

const buildDocumentName = (it: any, isoDay: string): string => {
  const issueId = it.issue_id ?? it.head?.issue_id ?? "";
  if (issueId) return `DC Test Report - ${issueId}`;
  if (isoDay) return `DC Test Report - ${isoDay}`;
  return "DC Test Report";
};

const getInspector = (it: any): string => {
  const performed = it.signature?.responsibility?.performed?.name;
  if (performed) return performed;
  const inspector = it.head?.inspector ?? it.inspector ?? it.performed_by ?? "";
  if (inspector) return inspector;
  return "-";
};

const thDate = (iso?: string): string => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("th-TH-u-ca-buddhist", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const toISODateOnly = (s?: string): string => {
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
};

const resolveFileHref = (v: any, apiBase: string): string => {
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
};

// ===== Main Component =====
export default function DCReportPage({ token, apiBase = BASE }: Props) {
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [data, setData] = useState<TData[]>([]);
  const [filtering, setFiltering] = useState("");

  const searchParams = useSearchParams();
  const [sn, setSn] = useState<string | null>(null);

  // ===== Language State (sync with Navbar) =====
  const [lang, setLang] = useState<Lang>("th");

  useEffect(() => {
    // Load initial language from localStorage
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") {
      setLang(savedLang);
    }

    // Listen for language change event from Navbar
    const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => {
      setLang(e.detail.lang);
    };

    window.addEventListener("language:change", handleLangChange as EventListener);

    return () => {
      window.removeEventListener("language:change", handleLangChange as EventListener);
    };
  }, []);

  // Get translations for current language
  const t = translations[lang];

  // ===== Load SN from URL or localStorage =====
  const loadSn = useCallback(() => {
    const snFromUrl = searchParams.get("sn");
    if (snFromUrl) {
      setSn(snFromUrl);
      return;
    }
    const snLocal = localStorage.getItem("selected_sn");
    setSn(snLocal);
  }, [searchParams]);

  useEffect(() => {
    loadSn();
  }, [loadSn]);

  // Listen for charger selection changes
  useEffect(() => {
    const handleChargerEvent = () => {
      requestAnimationFrame(loadSn);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "selected_sn") {
        requestAnimationFrame(loadSn);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("charger:selected", handleChargerEvent);
    window.addEventListener("charger:deselected", handleChargerEvent);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("charger:selected", handleChargerEvent);
      window.removeEventListener("charger:deselected", handleChargerEvent);
    };
  }, [loadSn]);

  const router = useRouter();
  const pathname = usePathname();
  const mode = (searchParams.get("view") === "form" ? "form" : "list") as "list" | "form";

  const setView = (view: "list" | "form", { replace = false } = {}) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "form") params.set("view", "form");
    else params.delete("view");
    
    if (sn && !params.has("sn")) {
      params.set("sn", sn);
    }
    
    router[replace ? "replace" : "push"](`${pathname}?${params.toString()}`, { scroll: false });
  };

  // ===== Fetch data =====
  const fetchRows = useCallback(async () => {
    if (!sn) { setData([]); return; }
    setLoading(true);
    
    try {
      const makeURL = (path: string) => {
        const u = new URL(`${apiBase}${path}`);
        u.searchParams.set("sn", sn);
        u.searchParams.set("page", "1");
        u.searchParams.set("pageSize", "50");
        return u.toString();
      };

      const fetchOpts: RequestInit = {
        headers: { "Content-Type": "application/json" },
        credentials: "include" as const,
      };

      const [dcRes, urlRes] = await Promise.allSettled([
        fetch(makeURL("/dctestreport/list"), fetchOpts),
        fetch(makeURL("/dcurl/list"), fetchOpts),
      ]);

      let dcItems: any[] = [];
      let urlItems: any[] = [];

      if (dcRes.status === "fulfilled" && dcRes.value.ok) {
        const j = await dcRes.value.json();
        if (Array.isArray(j?.items)) dcItems = j.items;
      }
      if (urlRes.status === "fulfilled" && urlRes.value.ok) {
        const j = await urlRes.value.json();
        if (Array.isArray(j?.items)) urlItems = j.items;
      }

      const dcRows: TData[] = dcItems.map((it: any) => {
        const isoDay = toISODateOnly(it.inspection_date ?? it.createdAt ?? "");

        const rawUploaded =
          it.file_url
          ?? (Array.isArray(it.urls) ? (it.urls[0]?.url ?? it.urls[0]) : it.url)
          ?? it.file
          ?? it.path;

        const uploadedUrl = resolveFileHref(rawUploaded, apiBase);
        const id = extractId(it);
        const generatedUrl = id ? `${apiBase}/pdf/dc/${encodeURIComponent(id)}/export` : "";
        const fileUrl = uploadedUrl || generatedUrl;

        return {
          id: id,
          documentName:  it.document_name,
          issueId: it.issue_id ?? it.head?.issue_id ?? "-",
          dcDate: thDate(isoDay),
          dcDateISO: isoDay,
          inspector: getInspector(it),
          fileUrl: fileUrl,
        };
      });

      const urlRows: TData[] = urlItems.map((it: any) => {
        const isoDay = toISODateOnly(it.dc_date ?? it.reportDate ?? it.createdAt ?? "");
        const raw =
          it.file_url
          ?? (Array.isArray(it.urls) ? (it.urls[0]?.url ?? it.urls[0]) : it.url)
          ?? it.file
          ?? it.path;

        return {
          id: extractId(it),
          documentName: it.document_name,
          issueId: it.issue_id ?? "-",
          dcDate: thDate(isoDay),
          dcDateISO: isoDay,
          inspector: getInspector(it),
          fileUrl: resolveFileHref(raw, apiBase),
        };
      });

      const allRows = [...dcRows, ...urlRows].sort((a, b) => {
        const da = a.dcDateISO ?? "";
        const db = b.dcDateISO ?? "";
        return da < db ? 1 : da > db ? -1 : 0;
      });

      setData(allRows);
    } catch (err) {
      console.error("fetch both lists error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [sn, apiBase]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    if (mode === "list") {
      fetchRows();
    }
  }, [mode]);

  const appendParam = (u: string, key: string, val: string): string => {
    const url = new URL(u, apiBase);
    if (!url.searchParams.has(key)) url.searchParams.set(key, val);
    return url.toString();
  };

  const buildHtmlLinks = useCallback((baseUrl?: string) => {
    const u = (baseUrl || "").trim();
    if (!u) return { previewHref: "", downloadHref: "", isPdfEndpoint: false };

    const isPdfEndpoint = /\/pdf\/(dc)\/[A-Fa-f0-9]{24}\/export(?:\b|$)/.test(u);

    if (isPdfEndpoint) {
      const withStation = appendParam(u, "sn", sn || "");
      return {
        previewHref: appendParam(withStation, "dl", "0"),
        downloadHref: appendParam(withStation, "dl", "1"),
        isPdfEndpoint: true,
      };
    }

    return { previewHref: u, downloadHref: u, isPdfEndpoint: false };
  }, [sn, apiBase]);

  // Columns with translations
  const columns: ColumnDef<TData, unknown>[] = useMemo(() => [
    {
      id: "no",
      header: () => t.colNo,
      enableSorting: false,
      size: 60,
      cell: (info) => {
        const pageRows = info.table.getRowModel().rows as Row<TData>[];
        const indexInPage = pageRows.findIndex((r) => r.id === info.row.id);
        const { pageIndex, pageSize } = info.table.getState().pagination;
        return pageIndex * pageSize + indexInPage + 1;
      },
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.documentName,
      id: "documentName",
      header: () => t.colDocName,
      cell: (info: CellContext<TData, unknown>) => (
        <span className="tw-text-blue-gray-800">
          {info.getValue() as string}
        </span>
      ),
      size: 220,
      minSize: 150,
      maxSize: 300,
      meta: { headerAlign: "left", cellAlign: "left" },
    },
    {
      accessorFn: (row) => row.issueId,
      id: "issueId",
      header: () => t.colIssueId,
      cell: (info: CellContext<TData, unknown>) => (
        <span className="tw-font-medium tw-text-blue-gray-800">
          {info.getValue() as string}
        </span>
      ),
      size: 140,
      minSize: 100,
      maxSize: 180,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.dcDateISO,
      id: "dcDate",
      header: () => t.colDcDate,
      cell: (info: CellContext<TData, unknown>) => {
        const row = info.row.original;
        return row.dcDate;
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.inspector,
      id: "inspector",
      header: () => t.colInspector,
      cell: (info: CellContext<TData, unknown>) => (
        <span className="tw-text-blue-gray-700">
          {info.getValue() as string}
        </span>
      ),
      size: 150,
      minSize: 100,
      maxSize: 200,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.fileUrl,
      id: "pdf",
      header: () => t.colPdf,
      enableSorting: false,
      cell: (info: CellContext<TData, unknown>) => {
        const url = info.getValue() as string | undefined;
        const hasUrl = typeof url === "string" && url.length > 0;
        const { previewHref } = buildHtmlLinks(url);

        return (
          <a
            href={previewHref || "#"}
            aria-label="Preview"
            target="_blank"
            rel="noopener noreferrer"
            className={`tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1 ${
              hasUrl 
                ? "tw-text-red-600 hover:tw-text-red-800 hover:tw-bg-red-50" 
                : "tw-text-blue-gray-300 tw-cursor-not-allowed"
            }`}
            onClick={(e) => { if (!hasUrl) e.preventDefault(); }}
            title={hasUrl ? t.viewPdf : t.noFile}
          >
            <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
            <span className="tw-sr-only">Download PDF</span>
          </a>
        );
      },
      size: 70,
      minSize: 60,
      maxSize: 90,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
  ], [t, buildHtmlLinks]);

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

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.currentTarget.value = "";
    if (!files.length) return;

    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) {
      alert(t.alertPdfOnly);
      return;
    }
    setPendingFiles(pdfs);
    setDateOpen(true);
  };

  const uploadPdfs = async () => {
    try {
      if (!sn) {
        alert(t.alertSelectStation);
        return;
      }
      if (!pendingFiles.length) {
        setDateOpen(false);
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
        alert(t.alertInvalidDate);
        return;
      }

      const fd = new FormData();
      fd.append("sn", sn);
      fd.append("reportDate", reportDate);
      pendingFiles.forEach((f) => fd.append("files", f));

      const res = await fetch(`${apiBase}/dcurl/upload-files`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        alert(`${t.alertUploadFailed}: ${txt}`);
        return;
      }

      alert(t.alertUploadSuccess);
      setPendingFiles([]);
      setDateOpen(false);
      await fetchRows();
    } catch (err) {
      console.error(err);
      alert(t.alertUploadError);
    }
  };

  const goAdd = () => setView("form");
  // const goList = () => setView("list");
  const goList = async () => {
  setView("list");
  await fetchRows(); // Fetch ข้อมูลใหม่ทันที
};

  if (mode === "form") {
    return (
      <div className="tw-mt-6">
        <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4">
          <Button
            variant="outlined"
            size="sm"
            onClick={goList}
            className="tw-py-2 tw-px-2"
            title={t.backToList}
          >
            <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
          </Button>
        </div>
        <DCForm />
      </div>
    );
  }

  return (
    <>
      <Card className="tw-border tw-border--gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
        <CardHeader floated={false} shadow={false}
          className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-gap-3 tw-!px-3 md:tw-!px-4 tw-!py-3 md:tw-!py-4 tw-mb-6">
          <div className="tw-ml-3">
            <Typography color="blue-gray" variant="h5" className="tw-text-base sm:tw-text-lg md:tw-text-xl">
              {t.title}
            </Typography>
            <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-normal tw-mt-1 tw-text-sm md:tw-text-[15px]">
              {t.subtitle}
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
                disabled={!sn}
                onClick={() => pdfInputRef.current?.click()}
                className="group tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-3 sm:tw-px-4 tw-flex tw-items-center tw-gap-2 tw-border tw-border-blue-gray-100 tw-bg-white tw-text-blue-gray-900"
                title={t.upload}>
                <ArrowUpTrayIcon className="tw-h-5 tw-w-5" />
                <span className="tw-text-sm">{t.upload}</span>
              </Button>

              <Button
                size="lg"
                onClick={goAdd}
                disabled={!sn}
                className={`
                  !tw-flex !tw-justify-center !tw-items-center tw-text-center tw-leading-none
                  tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-4
                  ${!sn
                    ? "tw-bg-gray-300 tw-text-white tw-cursor-not-allowed"
                    : "tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-from-black hover:tw-to-black tw-text-white"}
                  tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)]
                  focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none
                `}
                title={sn ? "" : t.selectStation}
              >
                <span className="tw-w-full tw-text-center">{t.add}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* FILTER BAR */}
        <CardBody className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-3 md:tw-px-4">
          <div className="tw-flex tw-items-center tw-gap-3 tw-flex-none">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="tw-border tw-p-2 tw-border-blue-gray-100 tw-rounded-lg tw-w-[72px]"
              aria-label={t.entriesPerPage}
            >
              {[5, 10, 15, 20, 25].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-normal tw-hidden sm:tw-inline">
              {t.entriesPerPage}
            </Typography>
          </div>

          <div className="tw-ml-auto tw-min-w-0 tw-flex-1 md:tw-flex-none md:tw-w-64">
            <Input variant="outlined" value={filtering} onChange={(e) => setFiltering(e.target.value)}
              label={t.search} crossOrigin={undefined} containerProps={{ className: "tw-min-w-0" }} className="tw-w-full" />
          </div>
        </CardBody>

        {/* TABLE */}
        <CardFooter className="tw-p-0">
          <div className="tw-relative tw-w-full tw-overflow-x-auto tw-overflow-y-hidden tw-scroll-smooth">
            <table className="tw-w-full tw-text-left tw-min-w-[800px] md:tw-min-w-0 md:tw-table-fixed">
              <colgroup>
                {table.getFlatHeaders().map((header) => (
                  <col key={header.id} style={{ width: header.getSize() }} />
                ))}
              </colgroup>
              <thead className="tw-bg-gray-50 tw-sticky tw-top-0">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const align = (header.column.columnDef as any).meta?.headerAlign ?? "left";
                      return (
                        <th key={header.id} style={{ width: header.getSize() }}
                          onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          className={`tw-p-3 md:tw-p-4 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium tw-whitespace-nowrap ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"
                            } ${canSort ? "tw-cursor-pointer hover:tw-bg-gray-100" : ""}`}>
                          {canSort ? (
                            <Typography color="blue-gray"
                              className={`tw-flex tw-items-center tw-gap-1 md:tw-gap-2 tw-text-[10px] sm:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40 ${align === "center" ? "tw-justify-center" : align === "right" ? "tw-justify-end" : "tw-justify-start"
                                }`}>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <ChevronUpDownIcon strokeWidth={2} className="tw-h-4 tw-w-4" />
                            </Typography>
                          ) : (
                            <Typography color="blue-gray"
                              className={`tw-text-[10px] sm:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40 ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"
                                }`}>
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
                      {t.loading}
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="odd:tw-bg-white even:tw-bg-gray-50 hover:tw-bg-blue-gray-50/50 tw-transition-colors">
                      {row.getVisibleCells().map((cell) => {
                        const align = (cell.column.columnDef as any).meta?.cellAlign ?? "left";
                        return (
                          <td key={cell.id} style={{ width: cell.column.getSize() }}
                            className={`!tw-border-y !tw-border-x-0 tw-align-middle ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"
                              }`}>
                            <Typography variant="small"
                              className="!tw-font-normal !tw-text-blue-gray-600 tw-py-3 md:tw-py-4 tw-px-3 md:tw-px-4">
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
                      {!sn ? t.selectStation : t.noData}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardFooter>

        {/* PAGINATION */}
        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-justify-between tw-gap-3 tw-px-3 md:tw-px-4 tw-py-4">
          <span className="tw-text-sm">
            <Typography className="!tw-font-bold tw-inline">{t.page}</Typography>{" "}
            <strong>{table.getState().pagination.pageIndex + 1} {t.of} {table.getPageCount()}</strong>
          </span>
          <div className="tw-flex tw-items-center tw-gap-2">
            <Button variant="outlined" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="disabled:tw-opacity-30 tw-py-2 tw-px-2">
              <ChevronLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
              <span className="tw-sr-only">Previous</span>
            </Button>
            <Button variant="outlined" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="disabled:tw-opacity-30 tw-py-2 tw-px-2">
              <ChevronRightIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
              <span className="tw-sr-only">Next</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Dialog */}
      <Dialog open={dateOpen} handler={setDateOpen} size="sm">
        <DialogHeader className="tw-text-base sm:tw-text-lg">
          {t.dialogTitle}
        </DialogHeader>
        <DialogBody className="tw-space-y-4">
          <div className="tw-space-y-2">
            <Typography variant="small" className="!tw-text-blue-gray-600">
              {t.dialogDateLabel}
            </Typography>
            <Input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              crossOrigin=""
            />
          </div>

          <div className="tw-text-sm tw-text-blue-gray-500">
            {t.dialogFilesSelected}: <strong>{pendingFiles.length}</strong> {t.dialogFiles}
          </div>
        </DialogBody>
        <DialogFooter className="tw-gap-2">
          <Button
            variant="text"
            color="blue-gray"
            onClick={() => { setPendingFiles([]); setDateOpen(false); }}
            className="tw-rounded-xl"
          >
            {t.dialogCancel}
          </Button>
          <Button
            color="gray"
            className="tw-rounded-xl tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-from-black hover:tw-to-black"
            onClick={uploadPdfs}
          >
            {t.dialogUpload}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}