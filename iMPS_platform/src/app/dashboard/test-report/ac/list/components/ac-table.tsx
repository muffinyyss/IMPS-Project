

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import CMForm from "@/app/dashboard/test-report/ac/input_ac/checkList"; // ✅ import ตรง

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

// type TData = (typeof AppDataTable)[number];
type TData = {
  name: string;     // วันที่ (แสดงผล)
  position: string; // YYYY-MM-DD ใช้ sort/filter
  office: string;   // ลิงก์ไฟล์
};

type Props = {
  token?: string;        // ใช้ได้ ถ้าจะส่ง Bearer แทนคุกกี้
  apiBase?: string;
}

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function CMReportPage({ token, apiBase = BASE }: Props) {
  const [loading, setLoading] = useState(false);
  // const [mode, setMode] = useState<"list" | "form">("list");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [data, setData] = useState<TData[]>([]);
  const [filtering, setFiltering] = useState("");

  // อ่าน station_id จาก URL (Navbar เป็นคนอัปเดตให้)
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

  const router = useRouter();
  const pathname = usePathname();
  const mode = (searchParams.get("view") === "form" ? "form" : "list") as "list" | "form";

  const setView = (view: "list" | "form", { replace = false } = {}) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "form") params.set("view", "form");
    else params.delete("view");
    router[replace ? "replace" : "push"](`${pathname}?${params.toString()}`, { scroll: false });
  };

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
  };

  function thDate(iso?: string) {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("th-TH-u-ca-buddhist", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
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

  function appendParam(u: string, key: string, val: string) {
    const url = new URL(u, apiBase);
    if (!url.searchParams.has(key)) url.searchParams.set(key, val);
    return url.toString();
  }

  function buildHtmlLinks(baseUrl?: string) {
    const u = (baseUrl || "").trim();
    if (!u) return { previewHref: "", downloadHref: "", isPdfEndpoint: false };

    // ตรวจจับ endpoint ใหม่ เช่น /pdf/charger/<id>/export
    const isPdfEndpoint = /\/pdf\/(ac)\/[A-Fa-f0-9]{24}\/export(?:\b|$)/.test(u);

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

  const fetchRows = async () => {
    if (!stationId) { setData([]); return; }
    setLoading(true);
    try {
      const makeURL = (path: string) => {
        const u = new URL(`${apiBase}${path}`);
        u.searchParams.set("station_id", stationId);
        u.searchParams.set("page", "1");
        u.searchParams.set("pageSize", "50");
        return u.toString();
      };

      const [cmRes, urlRes] = await Promise.allSettled([
        fetch(makeURL("/actestreport/list"), fetchOpts),
        fetch(makeURL("/acurl/list"), fetchOpts),
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

      const isAC = (it: any) => {
        const hasStatus = it?.status != null || it?.job?.status != null;
        if (!hasStatus) return true;
        const s = String(it?.status ?? it?.job?.status ?? "").trim().toLowerCase();
        return s === "AC";
      };

      cmItems = cmItems.filter(isAC);
      urlItems = urlItems.filter(isAC);


      const cmRows: TData[] = cmItems.map((it: any) => {
        const isoDay = toISODateOnly(it.cm_date ?? it.createdAt ?? "");

        // ลิงก์ไฟล์ที่อัปโหลด (ถ้ามี)
        const rawUploaded =
          it.file_url
          ?? (Array.isArray(it.urls) ? (it.urls[0]?.url ?? it.urls[0]) : it.url)
          ?? it.file
          ?? it.path;

        const uploadedUrl = resolveFileHref(rawUploaded, apiBase);

        // ⬇️ วางไว้ใกล้ๆ ฟังก์ชันอื่น
        function extractId(it: any): string {
          if (!it) return "";
          // ให้โฟกัส _id ก่อน เพราะเป็นของจริงจาก Mongo
          const raw = (it._id !== undefined ? it._id : it.id) ?? "";
          if (raw && typeof raw === "object") {
            // รองรับรูปแบบที่ซีเรียลไลซ์จาก Mongo: { "$oid": "..." } หรือ { "oid": "..." }
            return raw.$oid || raw.oid || raw.$id || "";
          }
          const s = String(raw || "");
          return /^[a-fA-F0-9]{24}$/.test(s) ? s : "";
        }


        // ⬇️ ใช้ helper ใหม่
        const id = extractId(it);
        // const generatedUrl = id ? `${apiBase}/pdf/${encodeURIComponent(id)}/download` : "";
        const generatedUrl = id ? `${apiBase}/pdf/ac/${encodeURIComponent(id)}/export` : "";

        const fileUrl = uploadedUrl || generatedUrl;

        return {
          name: thDate(isoDay),
          position: isoDay,
          office: fileUrl,
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
          name: thDate(isoDay),
          position: isoDay,
          office: resolveFileHref(raw, apiBase),
        };
      });



      // รวมทั้งหมด แล้ว sort ตามวันที่ (ใหม่ → เก่า) แต่ยัง “ไม่ตัดซ้ำ”
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
      accessorFn: (row) => row.office,
      id: "pdf",
      header: () => "pdf",
      enableSorting: false,
      cell: (info: CellContext<TData, unknown>) => {
        const baseUrl = info.getValue() as string | undefined; // เช่น http://localhost:8000/pdf/<id>/file
        const url = info.getValue() as string | undefined;
        const hasUrl = typeof url === "string" && url.length > 0;
        const viewUrl = hasUrl ? `${baseUrl}` : undefined;           // inline (พรีวิว)
        const { previewHref /*, downloadHref*/ } = buildHtmlLinks(url);
        return (
          // <a
          //   // href={hasUrl ? url : undefined}
          //   href={viewUrl}
          //   target="_blank"
          //   rel="noopener noreferrer"
          //   download
          //   onClick={(e) => { if (!hasUrl) e.preventDefault(); }}
          //   className={`tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1
          //         ${hasUrl ? "tw-text-red-600 hover:tw-text-red-800" : "tw-text-blue-gray-300 tw-cursor-not-allowed"}`}
          //   aria-disabled={!hasUrl}
          //   title={hasUrl ? "Download PDF" : "No file"}
          // >
          //   <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
          //   <span className="tw-sr-only">Download PDF</span>
          // </a>
          <a
            // href={hasUrl ? url : undefined}
            href={previewHref}
            aria-label="Preview"
            // download
            target="_blank"
            rel="noopener noreferrer"
            // onClick={handleNoUrl}
            //   className={`tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1
            // ${hasUrl ? "tw-text-red-600 hover:tw-text-red-800" : "tw-text-blue-gray-300 tw-cursor-not-allowed"}`}
            //   aria-disabled={!hasUrl}
            className="tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1 tw-text-red-600 hover:tw-text-red-800"
            title={hasUrl ? "Download PDF" : "No file"}
          >
            <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
            <span className="tw-sr-only">Download PDF</span>
          </a>
        );
      },

      size: 80,
      minSize: 64,
      maxSize: 120,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
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

  // Upload (เดโม่ ไม่เชื่อม backend)
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
    // backend คาด `rows` เป็น list ของ JSON string ทีละแถว
    fd.append("rows", JSON.stringify({ reportDate, urls }));

    const res = await fetch(`${apiBase}/cmurl/upload`, {
      method: "POST",
      body: fd,
      credentials: "include",            // ⬅️ สำคัญ! ส่งคุกกี้ด้วย
    });

    if (!res.ok) { alert("อัปโหลดไม่สำเร็จ: " + await res.text()); return; }
    alert("อัปโหลดสำเร็จ");
    setDateOpen(false);
    setUrlText("");


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
    setDateOpen(true);         // 👉 เปิด modal ให้เลือกวันที่รายงาน
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
      // ตรวจรูปแบบวันที่คร่าวๆ (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
        alert("รูปแบบวันที่ไม่ถูกต้อง (ควรเป็น YYYY-MM-DD)");
        return;
      }

      const fd = new FormData();
      fd.append("station_id", stationId);
      fd.append("reportDate", reportDate);
      pendingFiles.forEach((f) => fd.append("files", f));

      const res = await fetch(`${apiBase}/acurl/upload-files`, {
        method: "POST",
        body: fd,
        // ถ้าใช้ cookie httpOnly: เปิดบรรทัดนี้แทน header Authorization
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        alert("อัปโหลดไม่สำเร็จ: " + txt);
        return;
      }

      const j = await res.json();
      console.log("uploaded:", j);
      alert("อัปโหลดสำเร็จ");

      // เคลียร์สถานะ + ปิด dialog
      setPendingFiles([]);
      setDateOpen(false);

      await fetchRows();

      // TODO: trigger reload ตาราง ถ้าคุณมีฟังก์ชัน fetchRows แยกไว้ ก็เรียกตรงนี้
      // await fetchRows();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดระหว่างอัปโหลด");
    }
  }

  const onPdfPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const pdfs = files.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length !== files.length) alert("รองรับเฉพาะไฟล์ PDF เท่านั้น");
    console.log("Picked PDFs (demo):", pdfs.map(f => ({ name: f.name, size: f.size })));
    e.currentTarget.value = "";
  };

  const goAdd = () => setView("form");
  const goList = () => setView("list");

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
        <CMForm />
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
              Test Report (AC Charger)
            </Typography>
            <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-normal tw-mt-1 tw-text-sm md:tw-text-[15px]">
              ค้นหาและดาวน์โหลดเอกสารรายงานการบำรุงรักษา (Test Report)
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
                // onChange={onPdfPick} 
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



              {/* +ADD → แสดงฟอร์มทันที (ไม่ route) */}
              {/* <Button size="lg" onClick={goAdd}
                className="tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-4 tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-from-black hover:tw-to-black tw-text-white"
                title="ไปหน้าแบบฟอร์ม CM">
                <span className="tw-w-full tw-text-center">+ADD</span>
              </Button> */}

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
                <span className="tw-w-full tw-text-center">+add</span>
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
                          className={`tw-p-3 md:tw-p-4 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium tw-whitespace-nowrap ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"
                            }`}>
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
                            className={`!tw-border-y !tw-border-x-0 tw-align-middle ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"
                              }`}>
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

      {/* ⬇️ วาง Dialog นอกร่าง Card แต่ยังอยู่ใน component */}
      <Dialog open={dateOpen} handler={setDateOpen} size="sm">
        <DialogHeader className="tw-text-base sm:tw-text-lg">
          เลือกวันที่รายงาน (AC Test Report)
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
