"use client";

import React, { useEffect, useRef, useState } from "react";
import CMInprogressForm from "@/app/dashboard/cm-report/inprogress/input_CMreport/components/checkList";
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
import { ArrowUpTrayIcon, DocumentArrowDownIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon, ArrowLeftIcon } from "@heroicons/react/24/solid";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";

type TData = {
  id?: string;
  name: string;     // วันที่ (แสดงผล)
  position: string; // YYYY-MM-DD ใช้ sort/filter
  office: string;   // ลิงก์ไฟล์
  status: string;     // ⬅️ สถานะที่จะแสดง
};

type Props = {
  token?: string;
  apiBase?: string;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function CMReportPage({ token, apiBase = BASE }: Props) {
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [data, setData] = useState<TData[]>([]);
  const [filtering, setFiltering] = useState("");

  const searchParams = useSearchParams();
  // const stationIdFromUrl = sp.get("station_id") ?? "";
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

  const statusFromTab = (searchParams.get("status") ?? "In Progress").toLowerCase();
  const statusLabel = statusFromTab
    .split(/[-_ ]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");

  const router = useRouter();
  const pathname = usePathname();
  const editId = searchParams.get("edit_id") ?? "";
  const mode: "list" | "form" =
    (searchParams.get("view") === "form" || !!editId) ? "form" : "list";
  // const mode = (sp.get("view") === "form" ? "form" : "list") as "list" | "form";

  // const setView = (view: "list" | "form", { replace = false } = {}) => {
  //   const params = new URLSearchParams(sp.toString());
  //   if (view === "form") params.set("view", "form");
  //   else params.delete("view");
  //   router[replace ? "replace" : "push"](`${pathname}?${params.toString()}`, { scroll: false });
  // };

  const setView = (view: "list" | "form", { replace = false } = {}) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "form") {
      params.set("view", "form");
    } else {
      params.delete("view");
      params.delete("edit_id"); // 👈 ต้องลบอันนี้ด้วย
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

  function thDate(iso?: string) {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("th-TH-u-ca-buddhist", {
      day: "2-digit", month: "2-digit", year: "numeric",
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
        // u.searchParams.set("status", "in progress"); // ส่งให้ backend กรอง Open
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

      // อนุญาตอันที่ไม่มี status (เช่นเอกสาร URL ภายนอก) ผ่านได้
      const isInProgress = (it: any) => {
        const s = getStatusText(it).toLowerCase();
        return s === "in progress";
      };

      cmItems = cmItems.filter(isInProgress);
      urlItems = urlItems.filter(isInProgress);

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

        return { id, name: thDate(isoDay), position: isoDay, office: fileUrl, status: getStatusText(it) || "-" };
      });

      const urlRows: TData[] = urlItems.map((it: any) => {
        const isoDay = toISODateOnly(it.cm_date ?? it.reportDate ?? it.createdAt ?? "");
        const raw =
          it.file_url
          ?? (Array.isArray(it.urls) ? (it.urls[0]?.url ?? it.urls[0]) : it.url)
          ?? it.file
          ?? it.path;

        return { id: it.id || it._id || "", name: thDate(isoDay), position: isoDay, office: resolveFileHref(raw, apiBase), status: getStatusText(it) || "-", };
      });

      const allRows = [...cmRows, ...urlRows].sort((a, b) => {
        const da = (a.position ?? "") as string;
        const db = (b.position ?? "") as string;
        return da < db ? 1 : da > db ? -1 : 0;
      });

      // ถ้าไม่มีอะไรเลยก็เคลียร์ (ให้ตารางขึ้น “ไม่มีข้อมูล”)
      if (!allRows.length) { setData([]); return; }

      setData(allRows);
    } catch (err) {
      console.error("fetch both lists error:", err);
      setData([]); // ❗ ไม่มี fallback ตัวอย่าง
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

  const columns: ColumnDef<TData, unknown>[] = [
    {
      id: "no",
      header: () => "No.",
      enableSorting: false,
      size: 25,
      cell: (info) => {
        const pageRows = info.table.getRowModel().rows as Row<TData>[];
        const indexInPage = pageRows.findIndex((r) => r.id === info.row.id);
        const { pageIndex, pageSize } = info.table.getState().pagination;
        return pageIndex * pageSize + indexInPage + 1;
      },
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.name,
      id: "date",
      header: () => "date",
      cell: (info: CellContext<TData, unknown>) => info.getValue() as React.ReactNode,
      size: 50,
      minSize: 60,
      maxSize: 120,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.status,
      id: "status",
      header: () => "status",
      enableSorting: true,
      cell: (info: CellContext<TData, unknown>) => {
        const s = String(info.getValue() ?? "");
        const low = s.toLowerCase();
        const badge =
          low === "in progress" ? "tw-bg-amber-100 tw-text-amber-800" :
            low === "open" ? "tw-bg-green-100 tw-text-green-800" :
              low === "closed" || low === "done"
                ? "tw-bg-blue-gray-100 tw-text-blue-gray-800" :
                "tw-bg-blue-gray-50 tw-text-blue-gray-600";
        return (
          <span className={`tw-inline-block tw-text-xs tw-font-medium tw-px-2 tw-py-1 tw-rounded ${badge}`}>
            {s || "-"}
          </span>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 160,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    // {
    //   accessorFn: (row) => row.office,
    //   id: "pdf",
    //   header: () => "action",
    //   enableSorting: false,
    //   cell: (info: CellContext<TData, unknown>) => {
    //     const baseUrl = info.getValue() as string | undefined;
    //     const url = info.getValue() as string | undefined;
    //     const hasUrl = typeof url === "string" && url.length > 0;
    //     const viewUrl = hasUrl ? `${baseUrl}` : undefined;
    //     return (
    //       <a
    //         href={viewUrl}
    //         target="_blank"
    //         rel="noopener noreferrer"
    //         download
    //         onClick={(e) => { if (!hasUrl) e.preventDefault(); }}
    //         className={`tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1
    //               ${hasUrl ? "tw-text-red-600 hover:tw-text-red-800" : "tw-text-blue-gray-300 tw-cursor-not-allowed"}`}
    //         aria-disabled={!hasUrl}
    //         title={hasUrl ? "Download PDF" : "No file"}
    //       >
    //         <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
    //         <span className="tw-sr-only">Download PDF</span>
    //       </a>
    //     );
    //   },
    //   size: 80,
    //   minSize: 64,
    //   maxSize: 120,
    //   meta: { headerAlign: "center", cellAlign: "center" },
    // },
    {
      accessorFn: (row) => row.office,
      id: "pdf",
      header: () => "action",
      enableSorting: false,
      cell: (info: CellContext<TData, unknown>) => {
        const row = info.row.original as TData;        // 👈 ใช้เอา id ไปแก้ไข
        const url = info.getValue() as string | undefined;
        const hasUrl = typeof url === "string" && url.length > 0;

        const handleNoUrl = (e: React.MouseEvent) => {
          if (!hasUrl) { e.preventDefault(); e.stopPropagation(); }
        };

        const handleEdit = (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (!row?.id) return;
          goEdit(row);
        };

        return (
          <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
            {/* View */}
            {/* <a
              href={hasUrl ? url : undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleNoUrl}
              className={`tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1
            ${hasUrl ? "tw-text-blue-600 hover:tw-text-blue-800" : "tw-text-blue-gray-300 tw-cursor-not-allowed"}`}
              aria-disabled={!hasUrl}
              title={hasUrl ? "View PDF" : "No file"}
            >
              <EyeIcon className="tw-h-5 tw-w-5" />
              <span className="tw-sr-only">View PDF</span>
            </a> */}

            {/* Edit */}
            <button
              type="button"
              onClick={handleEdit}
              disabled={!row?.id}
              className={`tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1
            ${row?.id ? "tw-text-amber-700 hover:tw-text-amber-900" : "tw-text-blue-gray-300 tw-cursor-not-allowed"}`}
              title={row?.id ? "Edit" : "No id to edit"}
            >
              <PencilSquareIcon className="tw-h-5 tw-w-5" />
              <span className="tw-sr-only">Edit</span>
            </button>

            {/* Download */}
            <a
              href={hasUrl ? url : undefined}
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleNoUrl}
              className={`tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1
            ${hasUrl ? "tw-text-red-600 hover:tw-text-red-800" : "tw-text-blue-gray-300 tw-cursor-not-allowed"}`}
              aria-disabled={!hasUrl}
              title={hasUrl ? "Download PDF" : "No file"}
            >
              <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
              <span className="tw-sr-only">Download PDF</span>
            </a>
          </div>
        );
      },
      size: 140,
      minSize: 120,
      maxSize: 200,
      meta: { headerAlign: "center", cellAlign: "center" },
    }
  ];

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

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.currentTarget.value = "";
    if (!files.length) return;
    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!pdfs.length) { alert("รองรับเฉพาะไฟล์ PDF เท่านั้น"); return; }
    setPendingFiles(pdfs);
    setDateOpen(true);
  };

  async function uploadPdfs() {
    try {
      if (!stationId) { alert("กรุณาเลือกสถานีก่อน"); return; }
      if (!pendingFiles.length) { setDateOpen(false); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
        alert("รูปแบบวันที่ไม่ถูกต้อง (ควรเป็น YYYY-MM-DD)");
        return;
      }

      const fd = new FormData();
      fd.append("station_id", stationId);
      fd.append("reportDate", reportDate);
      fd.append("status", statusFromTab);
      pendingFiles.forEach((f) => fd.append("files", f));

      const res = await fetch(`${apiBase}/cmurl/upload-files`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        alert("อัปโหลดไม่สำเร็จ: " + txt);
        return;
      }

      alert("อัปโหลดสำเร็จ");
      setPendingFiles([]);
      setDateOpen(false);
      await fetchRows();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดระหว่างอัปโหลด");
    }
  }

  const goAdd = () => setView("form");
  // const goList = () => setView("list");
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
        <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4">
          <Button
            variant="outlined"
            size="sm"
            onClick={goList}
            className="tw-py-2 tw-px-2"
            title="กลับไปหน้า List"
          >
            <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
          </Button>
        </div>
        <CMInprogressForm />
      </div>
    );
  }

  return (
    <>
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
        <CardHeader floated={false} shadow={false}
          className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-gap-3 tw-!px-3 md:tw-!px-4 tw-!py-3 md:tw-!py-4 tw-mb-6">
          <div className="tw-ml-3">
            <Typography color="blue-gray" variant="h5" className="tw-text-base sm:tw-text-lg md:tw-text-xl">
              Corrective Maintenance Report
            </Typography>
            <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-normal tw-mt-1 tw-text-sm md:tw-text-[15px]">
              ค้นหาและดาวน์โหลดเอกสารรายงานการบำรุงรักษา (CM Report)
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
                title="อัปโหลด PDF"
              >
                <ArrowUpTrayIcon className="tw-h-5 tw-w-5" />
                <span className="tw-text-sm">Upload</span>
              </Button>

              {/* <Button
                size="lg"
                onClick={goAdd}
                disabled={!stationIdFromUrl}
                className={`
                  !tw-flex !tw-justify-center !tw-items-center tw-text-center tw-leading-none
                  tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-4
                  ${!stationIdFromUrl
                    ? "tw-bg-gray-300 tw-text-white tw-cursor-not-allowed"
                    : "tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-from-black hover:tw-to-black tw-text-white"}
                  tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)]
                  focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none
                `}
                title={stationIdFromUrl ? "" : "กรุณาเลือกสถานีจากแถบบนก่อน"}
              >
                <span className="tw-w-full tw-text-center">+add</span>
              </Button> */}
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
              aria-label="จำนวนแถวต่อหน้า"
            >
              {[5, 10, 15, 20, 25].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-normal tw-hidden sm:tw-inline">
              entries per page
            </Typography>
          </div>

          <div className="tw-ml-auto tw-min-w-0 tw-flex-1 md:tw-flex-none md:tw-w-64">
            <Input variant="outlined" value={filtering} onChange={(e) => setFiltering(e.target.value)}
              label="Search" crossOrigin={undefined} containerProps={{ className: "tw-min-w-0" }} className="tw-w-full" />
          </div>
        </CardBody>

        {/* TABLE */}
        <CardFooter className="tw-p-0">
          <div className="tw-relative tw-w-full tw-overflow-x-auto tw-overflow-y-hidden tw-scroll-smooth">
            <table className="tw-w-full tw-text-left tw-min-w-[720px] md:tw-min-w-0 md:tw-table-fixed">
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
                          className={`tw-p-3 md:tw-p-4 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium tw-whitespace-nowrap ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}`}
                        >
                          {canSort ? (
                            <Typography color="blue-gray"
                              className={`tw-flex tw-items-center tw-gap-1 md:tw-gap-2 tw-text-[10px] sm:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40 ${align === "center" ? "tw-justify-center" : align === "right" ? "tw-justify-end" : "tw-justify-start"}`}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <ChevronUpDownIcon strokeWidth={2} className="tw-h-4 tw-w-4" />
                            </Typography>
                          ) : (
                            <Typography color="blue-gray"
                              className={`tw-text-[10px] sm:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40 ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}`}
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
                          <td key={cell.id} style={{ width: cell.column.getSize() }}
                            className={`!tw-border-y !tw-border-x-0 tw-align-middle ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}`}
                          >
                            <Typography variant="small"
                              className="!tw-font-normal !tw-text-blue-gray-600 tw-py-3 md:tw-py-4 tw-px-3 md:tw-px-4 tw-truncate md:tw-whitespace-normal">
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

        {/* PAGINATION */}
        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-justify-between tw-gap-3 tw-px-3 md:tw-px-4 tw-py-4">
          <span className="tw-text-sm">
            <Typography className="!tw-font-bold tw-inline">Page</Typography>{" "}
            <strong>{table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</strong>
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

      {/* Upload dialog */}
      <Dialog open={dateOpen} handler={setDateOpen} size="sm">
        <DialogHeader className="tw-text-base sm:tw-text-lg">
          เลือกวันที่รายงาน (CM Report)
        </DialogHeader>
        <DialogBody className="tw-space-y-4">
          <div className="tw-space-y-2">
            <Typography variant="small" className="!tw-text-blue-gray-600">
              วันที่ (รูปแบบ YYYY-MM-DD)
            </Typography>
            <Input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              crossOrigin=""
            />
          </div>
          <div className="tw-text-sm tw-text-blue-gray-600">
            Status: <span className="tw-font-medium">{statusLabel}</span>
          </div>

          <div className="tw-text-sm tw-text-blue-gray-500">
            ไฟล์ที่เลือก: <strong>{pendingFiles.length}</strong> ไฟล์
          </div>
        </DialogBody>
        <DialogFooter className="tw-gap-2">
          <Button
            variant="text"
            color="blue-gray"
            onClick={() => { setPendingFiles([]); setDateOpen(false); }}
            className="tw-rounded-xl"
          >
            ยกเลิก
          </Button>
          <Button
            color="gray"
            className="tw-rounded-xl tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-from-black hover:tw-to-black"
            onClick={uploadPdfs}
          >
            อัปโหลด
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
