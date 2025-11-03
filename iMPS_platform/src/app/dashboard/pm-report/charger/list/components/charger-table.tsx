
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon } from "@heroicons/react/24/solid";
import { ArrowUpTrayIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import { AppDataTable } from "@/data";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";

type TData = (typeof AppDataTable)[number];

type Props = {
  token?: string;        // ใช้ได้ ถ้าจะส่ง Bearer แทนคุกกี้
  apiBase?: string;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function SearchDataTables({ token, apiBase = BASE }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [data, setData] = useState<TData[]>([]);
  const [filtering, setFiltering] = useState("");
  const [loading, setLoading] = useState(false);

  const sp = useSearchParams();
  // อ่าน station_id จาก URL (Navbar เป็นคนอัปเดตให้)
  const stationIdFromUrl = sp.get("station_id") ?? "";

  const addHref = useMemo(() => {
    if (!stationIdFromUrl) return "/dashboard/pm-report/charger/input_PMreport";
    const p = new URLSearchParams({ station_id: stationIdFromUrl });
    return `/dashboard/pm-report/charger/input_PMreport?${p.toString()}`;
  }, [stationIdFromUrl]);

  // ---------------- helpers ----------------
  // เลือกโหมด auth: คุกกี้ httpOnly (credentials: "include") หรือ Bearer token
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
    cache: "no-store",                    // ⬅️ ปิด cache ฝั่งเบราว์เซอร์
  };

  function thDate(iso?: string) {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("th-TH-u-ca-buddhist", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  /** 'YYYY-MM-DD' จากค่าประเภทต่างๆ */
  function toISODateOnly(s?: string) {
    if (!s) return "";
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already date-only
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
  function normalizeAnyDate(v: any): string {
    if (!v) return "";
    if (typeof v === "object" && v.$date) return toISODateOnly(String(v.$date)); // Mongo Extended JSON
    if (v instanceof Date) return toISODateOnly(v.toISOString());
    if (typeof v === "number") return toISODateOnly(new Date(v).toISOString());
    if (typeof v === "string") return toISODateOnly(v);
    return "";
  }
  /** เลือกวันที่จากหลายฟิลด์ที่เป็นไปได้ */
  function pickDateFromItem(it: any): string {
    const cands = [
      it?.pm_date,
      it?.reportDate,
      it?.job?.date,
      it?.submittedAt,
      it?.timestamp,
      it?.createdAt,
      it?.updatedAt,
    ];
    for (const v of cands) {
      const d = normalizeAnyDate(v);
      if (d) return d;
    }
    return "";
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
  function appendParam(u: string, key: string, val: string) {
    const url = new URL(u, apiBase);
    if (!url.searchParams.has(key)) url.searchParams.set(key, val);
    return url.toString();
  }

  function buildPdfLinks(baseUrl?: string) {
    const u = (baseUrl || "").trim();
    if (!u) return { previewHref: "", downloadHref: "", isPdfEndpoint: false };
    const isPdfEndpoint = /\/pdf\/[A-Fa-f0-9]{24}\/file(?:\b|$)/.test(u);
    if (isPdfEndpoint) {
      const withStation = appendParam(u, "station_id", stationIdFromUrl || "");
      return {
        previewHref: appendParam(withStation, "dl", "0"),
        downloadHref: appendParam(withStation, "dl", "1"),
        isPdfEndpoint: true,
      };
    }
    return { previewHref: u, downloadHref: u, isPdfEndpoint: false };
  }

  /** แตกลิงก์เป็น preview / download ให้เหมาะกับชนิด endpoint */
  // function buildPdfLinks(baseUrl?: string) {
  //   const u = (baseUrl || "").trim();
  //   if (!u) return { previewHref: "", downloadHref: "", isPdfEndpoint: false };
  //   const isPdfEndpoint = /\/pdf\/[A-Fa-f0-9]{24}\/file(?:\b|$)/.test(u);
  //   if (isPdfEndpoint) {
  //     return {
  //       previewHref: `${u}?dl=0`,   // inline preview
  //       downloadHref: `${u}?dl=1`,  // attachment download
  //       isPdfEndpoint: true,
  //     };
  //   }
  //   return { previewHref: u, downloadHref: u, isPdfEndpoint: false };
  // }

  // ---------------- fetch ----------------
  const fetchRows = async () => {
    if (!stationIdFromUrl) { setData([]); return; }
    setLoading(true);
    try {
      const makeURL = (path: string) => {
        const u = new URL(`${apiBase}${path}`);
        u.searchParams.set("station_id", stationIdFromUrl);
        u.searchParams.set("page", "1");
        u.searchParams.set("pageSize", "50");
        u.searchParams.set("_ts", String(Date.now()));  // ⬅️ กัน cache
        return u.toString();
      };

      const [pmRes, urlRes] = await Promise.allSettled([
        fetch(makeURL("/pmreport/list"), fetchOpts),
        fetch(makeURL("/pmurl/list"), fetchOpts),
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
        const generatedUrl = id ? `${apiBase}/pdf/${encodeURIComponent(id)}/file` : "";
        const fileUrl = uploadedUrl || generatedUrl;

        return { name: thDate(isoDay), position: isoDay, office: fileUrl } as TData;
      });

      const urlRows: TData[] = urlItems.map((it: any) => {
        const isoDay = pickDateFromItem(it);
        const raw =
          it.file_url ??
          (Array.isArray(it.urls) ? (it.urls[0]?.url ?? it.urls[0]) : it.url) ??
          it.file ?? it.path;

        return { name: thDate(isoDay), position: isoDay, office: resolveFileHref(raw, apiBase) } as TData;
      });

      const allRows = [...pmRows, ...urlRows].sort((a, b) => {
        const da = (a.position ?? "") as string;
        const db = (b.position ?? "") as string;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da < db ? 1 : da > db ? -1 : 0; // ใหม่ → เก่า
      });

      if (!allRows.length) {
        const res2 = await fetch(`${apiBase}/pmreport/latest/${encodeURIComponent(stationIdFromUrl)}?_ts=${Date.now()}`, fetchOpts);
        if (res2.ok) {
          const j = await res2.json();
          const iso = j?.pm_date ?? "";
          const rows: TData[] = iso ? ([{ name: thDate(iso), position: iso, office: "" }] as TData[]) : [];
          setData(rows);
          return;
        }
        setData([...AppDataTable] as TData[]);
        return;
      }

      setData(allRows);
    } catch (err) {
      console.error("fetch both lists error:", err);
      setData([...AppDataTable] as TData[]);
    } finally {
      setLoading(false);
    }
  };


  // รีเฟรชเมื่อ apiBase, stationId หรือ query string (เช่น ?refresh=1) เปลี่ยน
  useEffect(() => {
    (async () => { await fetchRows(); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, stationIdFromUrl, sp.toString()]);

  // ---------------- table ----------------
  const columns: ColumnDef<TData, unknown>[] = [
    {
      id: "no",
      header: () => "No.",
      enableSorting: false,
      size: 25,
      minSize: 10,
      maxSize: 25,
      cell: (info: CellContext<TData, unknown>) => {
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
      size: 80,
      minSize: 60,
      maxSize: 120,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.office,
      id: "pdf",
      header: () => "pdf",
      enableSorting: false,
      cell: (info: CellContext<TData, unknown>) => {
        const url = info.getValue() as string | undefined;
        const hasUrl = typeof url === "string" && url.length > 0;

        if (!hasUrl) {
          return <span className="tw-text-blue-gray-300" title="No file">—</span>;
        }

        const { previewHref, downloadHref, isPdfEndpoint } = buildPdfLinks(url);

        return (
          <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
            <a
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1 tw-text-blue-600 hover:tw-text-blue-800"
              title="Preview PDF"
              onClick={(e) => { if (!previewHref) e.preventDefault(); }}
            >
              <span className="tw-text-sm">Preview</span>
            </a>
            <a
              href={downloadHref}
              target="_blank"
              rel="noopener noreferrer"
              {...(!isPdfEndpoint ? { download: "" } : {})}
              className="tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1 tw-text-red-600 hover:tw-text-red-800"
              title="Download PDF"
              onClick={(e) => { if (!downloadHref) e.preventDefault(); }}
            >
              <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
              <span className="tw-sr-only">Download PDF</span>
            </a>
          </div>
        );
      },
      size: 110,
      minSize: 96,
      maxSize: 140,
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

  // ---------------- upload dialog ----------------
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [urlText, setUrlText] = useState("");

  async function uploadUrls() {
    if (!stationIdFromUrl) { alert("กรุณาเลือกสถานีก่อน"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) { alert("วันที่ไม่ถูกต้อง"); return; }

    const urls = urlText.split("\n").map(s => s.trim()).filter(Boolean);
    if (!urls.length) { alert("กรุณากรอก URL"); return; }

    const fd = new FormData();
    fd.append("station_id", stationIdFromUrl);
    fd.append("rows", JSON.stringify({ reportDate, urls }));

    const res = await fetch(`${apiBase}/pmurl/upload?_ts=${Date.now()}`, {
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
    if (!pdfs.length) {
      alert("รองรับเฉพาะไฟล์ PDF เท่านั้น");
      return;
    }
    setPendingFiles(pdfs);
    setDateOpen(true);
  };

  async function uploadPdfs() {
    try {
      if (!stationIdFromUrl) { alert("กรุณาเลือกสถานีก่อน"); return; }
      if (!pendingFiles.length) { setDateOpen(false); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) { alert("รูปแบบวันที่ไม่ถูกต้อง (ควรเป็น YYYY-MM-DD)"); return; }

      const fd = new FormData();
      fd.append("station_id", stationIdFromUrl);
      fd.append("reportDate", reportDate);
      pendingFiles.forEach((f) => fd.append("files", f));

      const res = await fetch(`${apiBase}/pmurl/upload-files?_ts=${Date.now()}`, {
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

  // ---------------- render ----------------
  return (
    <>
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
        <CardHeader
          floated={false}
          shadow={false}
          className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-gap-3 tw-!px-3 md:tw-!px-4 tw-!py-3 md:tw-!py-4 tw-mб-6"
        >
          <div className="tw-ml-3">
            <Typography color="blue-gray" variant="h5" className="tw-text-base sm:tw-text-lg md:tw-text-xl">
              Preventive Maintenance Checklist - เครื่องอัดประจุไฟฟ้า
            </Typography>
            <Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-normal tw-mt-1 tw-text-xs sm:tw-text-sm">
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
                onClick={() => pdfInputRef.current?.click()}
                className="group tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-3 sm:tw-px-4 tw-flex tw-items-center tw-gap-2 tw-bg-white tw-text-blue-gray-900 tw-border tw-border-blue-gray-100 tw-shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:tw-bg-black hover:tw-text-black hover:tw-border-black hover:tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)] tw-transition-colors tw-duration-200 focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none"
              >
                <ArrowUpTrayIcon className="tw-h-5 tw-w-5 tw-transition-transform tw-duration-200 group-hover:-tw-translate-y-0.5" />
                <span className="tw-text-sm">Upload</span>
              </Button>

              <Link
                href={addHref}
                className="tw-inline-block"
                aria-disabled={!stationIdFromUrl}
                onClick={(e) => { if (!stationIdFromUrl) e.preventDefault(); }}
              >
                <Button
                  size="lg"
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
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>

        {/* แถบ filter */}
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
              entries per page
            </Typography>
          </div>
          <div className="tw-ml-auto tw-min-w-0 tw-flex-1 md:tw-flex-none md:tw-w-64">
            <Input
              variant="outlined"
              value={filtering}
              onChange={(e) => setFiltering(e.target.value)}
              label="Search"
              crossOrigin={undefined}
              containerProps={{ className: "tw-min-w-0" }}
              className="tw-w-full"
            />
          </div>
        </CardBody>

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
                        <th
                          key={header.id}
                          style={{ width: header.getSize() }}
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
                      {!stationIdFromUrl ? "กรุณาเลือกสถานีจากแถบบนก่อน" : "ไม่มีข้อมูล"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardFooter>

        <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-justify-between tw-gap-3 tw-px-3 md:tw-px-4 tw-py-4">
          <span className="tw-text-sm">
            <Typography className="!tw-font-bold tw-inline">Page</Typography>{" "}
            <strong>{table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</strong>
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
              <span className="tw-sr-only">Previous</span>
            </Button>
            <Button
              variant="outlined"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="disabled:tw-opacity-30 tw-py-2 tw-px-2"
            >
              <ChevronRightIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
              <span className="tw-sr-only">Next</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Dialog อัปโหลด */}
      <Dialog open={dateOpen} handler={setDateOpen} size="sm">
        <DialogHeader className="tw-text-base sm:tw-text-lg">
          เลือกวันที่รายงาน (PM Report)
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

