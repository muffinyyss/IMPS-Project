// "use client";

// import React, { useEffect, useRef, useState } from "react";
// import { useRouter, useSearchParams, usePathname } from "next/navigation";
// import dynamic from "next/dynamic";
// import { AppDataTable } from "@/data";
// import {
//   getCoreRowModel,
//   getPaginationRowModel,
//   getFilteredRowModel,
//   getSortedRowModel,
//   useReactTable,
//   flexRender,
//   type ColumnDef,
//   type CellContext,
//   type Row,
//   type SortingState,
// } from "@tanstack/react-table";
// import {
//   Button,
//   Card,
//   CardBody,
//   CardHeader,
//   Typography,
//   CardFooter,
//   Input,
// } from "@material-tailwind/react";
// import {
//   ArrowUpTrayIcon,
//   DocumentArrowDownIcon,
// } from "@heroicons/react/24/outline";
// import {
//   ChevronLeftIcon,
//   ChevronRightIcon,
//   ChevronUpDownIcon,
//   ArrowLeftIcon,
// } from "@heroicons/react/24/solid";

// /* โหลดฟอร์มแบบ dynamic */
// const CMForm = dynamic(
//   () => import("@/app/dashboard/cm-report/components/form_cm"),
//   { ssr: false }
// );

// /* =========================
//  *        TYPES
//  * ========================= */
// type TData = (typeof AppDataTable)[number];
// export type ApiType = "charger" | "mdb" | "ccb" | "cb_box" | "station";

// type Props = {
//   equipmentType: ApiType;
//   token?: string;
//   apiBase?: string;
// };

// const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// /* meta สำหรับหัวข้อเท่านั้น */
// const TYPE_META: Record<ApiType, { title: string; subtitle: string }> = {
//   charger: {
//     title: "Corrective Maintenance Report - เครื่องอัดประจุไฟฟ้า (Charger)",
//     subtitle: "Charger",
//   },
//   mdb: {
//     title: "Corrective Maintenance Report - MDB",
//     subtitle: "MDB",
//   },
//   ccb: {
//     title: "Corrective Maintenance Report - CCB",
//     subtitle: "CCB",
//   },
//   cb_box: {
//     title: "Corrective Maintenance Report - CB-BOX",
//     subtitle: "CB-BOX",
//   },
//   station: {
//     title: "Corrective Maintenance Report - Station",
//     subtitle: "Station",
//   },
// };

// export default function ListCMTables({
//   equipmentType,
//   token,
//   apiBase = BASE,
// }: Props) {
//   const router = useRouter();
//   const pathname = usePathname();
//   const sp = useSearchParams();

//   /* โหมดมาจาก query ?view=add|list (default=list) */
//   const viewParam = sp.get("view");
//   const mode: "list" | "add" = viewParam === "add" ? "add" : "list";

//   const [sorting, setSorting] = useState<SortingState>([]);
//   const [data, setData] = useState<TData[]>([]);
//   const [filtering, setFiltering] = useState("");

//   const stationIdFromUrl = sp.get("station_id") ?? "";
//   const stationNameFromUrl = sp.get("station_name") ?? sp.get("station") ?? "";

//   const meta = TYPE_META[equipmentType];

//   // ค่าช่วยตรวจว่า URL ตอนนี้เป็น add อยู่มั้ย
//   const isAddView = sp.get("view") === "add";
//   const prevTypeRef = useRef<ApiType | null>(null);

//   // A) ถ้า view=add แต่ยังไม่เลือกสถานี → กลับเป็น list
//   useEffect(() => {
//     if (isAddView && !stationIdFromUrl) {
//       const p = new URLSearchParams(sp.toString());
//       p.delete("view");
//       router.replace(`${pathname}?${p.toString()}`, { scroll: false });
//     }
//     // ทำงานเมื่อค่า add/list หรือ station เปลี่ยน
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [isAddView, stationIdFromUrl]);

//   // B) เฉพาะตอน "เปลี่ยนแท็บจริง ๆ" และ URL ยังเป็น add → ล้าง view เพื่อกลับ LIST ของแท็บใหม่
//   useEffect(() => {
//     const prevType = prevTypeRef.current;
//     if (prevType && prevType !== equipmentType && isAddView) {
//       const p = new URLSearchParams(sp.toString());
//       p.delete("view");
//       router.replace(`${pathname}?${p.toString()}`, { scroll: false });
//     }
//     // อัปเดตค่าไว้เปรียบเทียบรอบหน้า
//     prevTypeRef.current = equipmentType;
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [equipmentType, isAddView]);



//   /* ฟังก์ชันสลับโหมดด้วย URL (refresh-safe) */
//   const goAdd = () => {
//     if (!stationIdFromUrl) return;
//     const p = new URLSearchParams(sp.toString());
//     p.set("view", "add");
//     router.push(`${pathname}?${p.toString()}`, { scroll: false });
//   };
//   const goList = () => {
//     const p = new URLSearchParams(sp.toString());
//     p.delete("view");
//     router.replace(`${pathname}?${p.toString()}`, { scroll: false }); // ใช้ replace เพื่อลด history stack
//   };

//   /* ---------- helpers ---------- */
//   const makeHeaders = (jwt?: string): Record<string, string> => {
//     const h: Record<string, string> = { "Content-Type": "application/json" };
//     if (jwt) h.Authorization = `Bearer ${jwt}`;
//     return h;
//   };

//   const thDate = (iso?: string) =>
//     !iso
//       ? "-"
//       : new Date(iso).toLocaleDateString("th-TH-u-ca-buddhist", {
//         day: "2-digit",
//         month: "2-digit",
//         year: "numeric",
//       });

//   /* ---------- load rows (เดโม่/fallback) ---------- */
//   useEffect(() => {
//     let alive = true;
//     const load = async () => {
//       try {
//         if (!stationIdFromUrl) {
//           setData([]);
//           return;
//         }

//         const jwt =
//           token ||
//           (typeof window !== "undefined"
//             ? localStorage.getItem("access_token") ?? ""
//             : "");
//         const headers = makeHeaders(jwt);

//         let res = await fetch(
//           `${apiBase}/cmreport/${equipmentType}/latest/${encodeURIComponent(
//             stationIdFromUrl
//           )}`,
//           { headers }
//         );

//         if (!res.ok) {
//           res = await fetch(
//             `${apiBase}/pmreport/latest/${encodeURIComponent(stationIdFromUrl)}`,
//             { headers }
//           );
//         }

//         if (res.ok) {
//           const j = await res.json();

//           if (Array.isArray(j?.pm_date)) {
//             const rows: TData[] = j.pm_date.map((d: string) => ({
//               name: thDate(d),
//               position: d,
//               office: "",
//             })) as TData[];
//             if (alive) setData(rows);
//           } else if (typeof j?.pm_date === "string") {
//             const d = j.pm_date as string;
//             if (alive)
//               setData(
//                 d ? ([{ name: thDate(d), position: d, office: "" }] as TData[]) : []
//               );
//           } else if (Array.isArray(j)) {
//             const rows: TData[] = j.map((it: any) => {
//               const iso =
//                 typeof it === "string"
//                   ? it
//                   : it?.pm_date ?? it?.date ?? it?.timestamp ?? "";
//               const file = it?.file_url ?? it?.url ?? "";
//               return { name: thDate(iso), position: iso, office: file } as TData;
//             });
//             if (alive) setData(rows);
//           } else {
//             if (alive) setData([...AppDataTable] as TData[]);
//           }
//         } else {
//           if (alive) setData([...AppDataTable] as TData[]);
//         }
//       } catch (e) {
//         console.error("load cm rows error:", e);
//         setData([...AppDataTable] as TData[]);
//       }
//     };
//     load();
//     return () => {
//       alive = false;
//     };
//   }, [apiBase, stationIdFromUrl, token, equipmentType]);

//   /* ---------- columns ---------- */
//   const columns: ColumnDef<TData, unknown>[] = [
//     {
//       id: "no",
//       header: () => "No.",
//       enableSorting: false,
//       size: 25,
//       cell: (info) => {
//         const pageRows = info.table.getRowModel().rows as Row<TData>[];
//         const indexInPage = pageRows.findIndex((r) => r.id === info.row.id);
//         const { pageIndex, pageSize } = info.table.getState().pagination;
//         return pageIndex * pageSize + indexInPage + 1;
//       },
//       meta: { headerAlign: "center", cellAlign: "center" },
//     },
//     {
//       accessorFn: (row) => row.name,
//       id: "date",
//       header: () => "date",
//       cell: (info) => info.getValue() as React.ReactNode,
//       size: 50,
//       meta: { headerAlign: "center", cellAlign: "center" },
//     },
//     {
//       accessorFn: (row) => row.office, // URL
//       id: "pdf",
//       header: () => "pdf",
//       enableSorting: false,
//       size: 80,
//       cell: (info: CellContext<TData, unknown>) => {
//         const url = info.getValue() as string | undefined;
//         const hasUrl = typeof url === "string" && url.length > 0;

//         if (!hasUrl) {
//           return (
//             <span
//               className="tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1 tw-text-blue-gray-300"
//               aria-disabled
//               title="No file"
//             >
//               <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
//             </span>
//           );
//         }

//         return (
//           <a
//             href={url}
//             target="_blank"
//             rel="noopener noreferrer"
//             download
//             className="tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1 tw-text-red-600 hover:tw-text-red-800"
//             title="Download PDF"
//           >
//             <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
//             <span className="tw-sr-only">Download PDF</span>
//           </a>
//         );
//       },
//       meta: { headerAlign: "center", cellAlign: "center" },
//     },
//   ];

//   const table = useReactTable({
//     data,
//     columns,
//     state: { globalFilter: filtering, sorting },
//     onSortingChange: setSorting,
//     onGlobalFilterChange: setFiltering,
//     getSortedRowModel: getSortedRowModel(),
//     getFilteredRowModel: getFilteredRowModel(),
//     getCoreRowModel: getCoreRowModel(),
//     getPaginationRowModel: getPaginationRowModel(),
//     columnResizeMode: "onChange",
//   });

//   /* ---------- upload ---------- */
//   const pdfInputRef = useRef<HTMLInputElement>(null);
//   const onPdfPick = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const files = Array.from(e.target.files ?? []);
//     if (!files.length) return;
//     const pdfs = files.filter(
//       (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
//     );
//     if (pdfs.length !== files.length) alert("รองรับเฉพาะไฟล์ PDF เท่านั้น");
//     console.log(
//       "Picked PDFs:",
//       pdfs.map((f) => ({ name: f.name, size: f.size }))
//     );
//     e.currentTarget.value = "";
//   };

//   return (
//     <>
//       {/* ข้อความช่วยแสดงเฉพาะตอน LIST เท่านั้น */}
//       {!stationIdFromUrl && mode === "list" && (
//         <div
//           className="
//           tw-mt-2 tw-mb-4
//           tw-text-sm tw-text-blue-gray-600
//           tw-flex tw-items-center tw-gap-2
//         "
//         >
//           เลือกสถานีจากแถบด้านบนเพื่อแสดง CM Report
//         </div>
//       )}

//       {/* ---------- โหมด ADD: แสดงฟอร์มเปล่า ๆ ไม่มี Card / ไม่มีหัวข้อ ---------- */}
//       {mode === "add" ? (
//         <div className="tw-mt-6">
//           <CMForm
//             type={equipmentType}
//             label={TYPE_META[equipmentType].subtitle}
//             stationId={stationIdFromUrl}
//             stationName={stationNameFromUrl}
//             onCancel={goList}
//           />
//         </div>
//       ) : (
//         /* ---------- โหมด LIST: ใช้ Card + Header + ตาราง ตามเดิม ---------- */
//         <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
//           <CardHeader
//             floated={false}
//             shadow={false}
//             className="
//             tw-flex tw-flex-col md:tw-flex-row
//             tw-items-start md:tw-items-center tw-gap-3
//             tw-!px-3 md:tw-!px-4
//             tw-!py-3 md:tw-!py-4
//             tw-mb-6
//           "
//           >
//             <div className="tw-ml-3">
//               <Typography
//                 color="blue-gray"
//                 variant="h5"
//                 className="tw-text-base sm:tw-text-lg md:tw-text-xl"
//               >
//                 {meta.title}
//               </Typography>
//               <Typography
//                 variant="small"
//                 className="!tw-text-blue-gray-600 !tw-font-normal tw-mt-1 tw-text-sm md:tw-text-[15px]"
//               >
//                 {meta.subtitle}
//                 {stationNameFromUrl ? ` – ${stationNameFromUrl}` : ""}
//               </Typography>
//             </div>

//             {/* ปุ่มฝั่งขวา */}
//             <div className="tw-w-full md:tw-w-auto md:tw-ml-auto md:tw-flex md:tw-justify-end">
//               <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 sm:tw-gap-3 tw-justify-end tw-w-full md:tw-w-auto md:tw-mt-6">
//                 <input
//                   ref={pdfInputRef}
//                   type="file"
//                   accept="application/pdf,.pdf"
//                   multiple
//                   className="tw-hidden"
//                   onChange={onPdfPick}
//                 />
//                 <Button
//                   variant="text"
//                   size="lg"
//                   onClick={() => stationIdFromUrl && pdfInputRef.current?.click()}
//                   disabled={!stationIdFromUrl}
//                   className={`group tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-3 sm:tw-px-4 tw-flex tw-items-center tw-gap-2 tw-border tw-border-blue-gray-100 ${stationIdFromUrl
//                       ? "tw-bg-white tw-text-blue-gray-900"
//                       : "tw-bg-gray-200 tw-text-white tw-cursor-not-allowed"
//                     }`}
//                   title={stationIdFromUrl ? "อัปโหลด PDF" : "กรุณาเลือกสถานีก่อน"}
//                 >
//                   <ArrowUpTrayIcon className="tw-h-5 tw-w-5" />
//                   <span className="tw-text-sm">Upload</span>
//                 </Button>

//                 <Button
//                   size="lg"
//                   disabled={!stationIdFromUrl}
//                   onClick={goAdd}
//                   className={`tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-4 ${!stationIdFromUrl
//                       ? "tw-bg-gray-300 tw-text-white tw-cursor-not-allowed"
//                       : "tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-from-black hover:tw-to-black tw-text-white"
//                     }`}
//                   title={stationIdFromUrl ? "" : "กรุณาเลือกสถานีก่อน"}
//                 >
//                   <span className="tw-w-full tw-text-center">+ADD</span>
//                 </Button>
//               </div>
//             </div>
//           </CardHeader>

//           {/* FILTER BAR */}
//           <CardBody className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-3 md:tw-px-4">
//             <div className="tw-flex tw-items-center tw-gap-3 tw-flex-none">
//               <select
//                 value={table.getState().pagination.pageSize}
//                 onChange={(e) => table.setPageSize(Number(e.target.value))}
//                 className="tw-border tw-p-2 tw-border-blue-gray-100 tw-rounded-lg tw-w-[72px]"
//                 aria-label="จำนวนแถวต่อหน้า"
//               >
//                 {[5, 10, 15, 20, 25].map((n) => (
//                   <option key={n} value={n}>
//                     {n}
//                   </option>
//                 ))}
//               </select>
//               <Typography
//                 variant="small"
//                 className="!tw-text-blue-gray-500 !tw-font-normal tw-hidden sm:tw-inline"
//               >
//                 entries per page
//               </Typography>
//             </div>

//             <div className="tw-ml-auto tw-min-w-0 tw-flex-1 md:tw-flex-none md:tw-w-64">
//               <Input
//                 variant="outlined"
//                 value={filtering}
//                 onChange={(e) => setFiltering(e.target.value)}
//                 label="Search"
//                 crossOrigin={undefined}
//                 containerProps={{ className: "tw-min-w-0" }}
//                 className="tw-w-full"
//               />
//             </div>
//           </CardBody>

//           {/* TABLE */}
//           <CardFooter className="tw-p-0">
//             <div className="tw-relative tw-w-full tw-overflow-x-auto tw-overflow-y-hidden tw-scroll-smooth">
//               <table className="tw-w-full tw-text-left tw-min-w-[720px] md:tw-min-w-0 md:tw-table-fixed">
//                 <colgroup>
//                   {table.getFlatHeaders().map((header) => (
//                     <col key={header.id} style={{ width: header.getSize() }} />
//                   ))}
//                 </colgroup>

//                 <thead className="tw-bg-gray-50 tw-sticky tw-top-0">
//                   {table.getHeaderGroups().map((hg) => (
//                     <tr key={hg.id}>
//                       {hg.headers.map((header) => {
//                         const canSort = header.column.getCanSort();
//                         const align =
//                           (header.column.columnDef as any).meta?.headerAlign ?? "left";
//                         return (
//                           <th
//                             key={header.id}
//                             style={{ width: header.getSize() }}
//                             onClick={
//                               canSort ? header.column.getToggleSortingHandler() : undefined
//                             }
//                             className={`tw-p-3 md:tw-p-4 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium tw-whitespace-nowrap ${align === "center"
//                                 ? "tw-text-center"
//                                 : align === "right"
//                                   ? "tw-text-right"
//                                   : "tw-text-left"
//                               }`}
//                           >
//                             {canSort ? (
//                               <Typography
//                                 color="blue-gray"
//                                 className={`tw-flex tw-items-center tw-gap-1 md:tw-gap-2 tw-text-[10px] sm:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40 ${align === "center"
//                                     ? "tw-justify-center"
//                                     : align === "right"
//                                       ? "tw-justify-end"
//                                       : "tw-justify-start"
//                                   }`}
//                               >
//                                 {flexRender(
//                                   header.column.columnDef.header,
//                                   header.getContext()
//                                 )}
//                                 <ChevronUpDownIcon strokeWidth={2} className="tw-h-4 tw-w-4" />
//                               </Typography>
//                             ) : (
//                               <Typography
//                                 color="blue-gray"
//                                 className={`tw-text-[10px] sm:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40 ${align === "center"
//                                     ? "tw-text-center"
//                                     : align === "right"
//                                       ? "tw-text-right"
//                                       : "tw-text-left"
//                                   }`}
//                               >
//                                 {flexRender(
//                                   header.column.columnDef.header,
//                                   header.getContext()
//                                 )}
//                               </Typography>
//                             )}
//                           </th>
//                         );
//                       })}
//                     </tr>
//                   ))}
//                 </thead>

//                 <tbody>
//                   {table.getRowModel().rows.length
//                     ? table.getRowModel().rows.map((row) => (
//                       <tr key={row.id} className="odd:tw-bg-white even:tw-bg-gray-50">
//                         {row.getVisibleCells().map((cell) => {
//                           const align =
//                             (cell.column.columnDef as any).meta?.cellAlign ?? "left";
//                           return (
//                             <td
//                               key={cell.id}
//                               style={{ width: cell.column.getSize() }}
//                               className={`!tw-border-y !tw-border-x-0 tw-align-middle ${align === "center"
//                                   ? "tw-text-center"
//                                   : align === "right"
//                                     ? "tw-text-right"
//                                     : "tw-text-left"
//                                 }`}
//                             >
//                               <Typography
//                                 variant="small"
//                                 className="!tw-font-normal !tw-text-blue-gray-600 tw-py-3 md:tw-py-4 tw-px-3 md:tw-px-4 tw-truncate md:tw-whitespace-normal"
//                               >
//                                 {flexRender(cell.column.columnDef.cell, cell.getContext())}
//                               </Typography>
//                             </td>
//                           );
//                         })}
//                       </tr>
//                     ))
//                     : null}
//                 </tbody>
//               </table>
//             </div>
//           </CardFooter>

//           {/* PAGINATION */}
//           <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-justify-between tw-gap-3 tw-px-3 md:tw-px-4 tw-py-4">
//             <span className="tw-text-sm">
//               <Typography className="!tw-font-bold tw-inline">Page</Typography>{" "}
//               <strong>
//                 {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
//               </strong>
//             </span>

//             <div className="tw-flex tw-items-center tw-gap-2">
//               <Button
//                 variant="outlined"
//                 size="sm"
//                 onClick={() => table.previousPage()}
//                 disabled={!table.getCanPreviousPage()}
//                 className="disabled:tw-opacity-30 tw-py-2 tw-px-2"
//               >
//                 <ChevronLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
//                 <span className="tw-sr-only">Previous</span>
//               </Button>
//               <Button
//                 variant="outlined"
//                 size="sm"
//                 onClick={() => table.nextPage()}
//                 disabled={!table.getCanNextPage()}
//                 className="disabled:tw-opacity-30 tw-py-2 tw-px-2"
//               >
//                 <ChevronRightIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
//                 <span className="tw-sr-only">Next</span>
//               </Button>
//             </div>
//           </div>
//         </Card>
//       )}
//     </>
//   );

// }

"use client";

import React, { useRef, useState } from "react";
import CMForm from "@/app/dashboard/cm-report/components/form_cm"; // ✅ import ตรง
import { AppDataTable } from "@/data";
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

type TData = (typeof AppDataTable)[number];

export default function CMReportPage() {
  const [mode, setMode] = useState<"list" | "form">("list");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [data] = useState<TData[]>([...AppDataTable]);
  const [filtering, setFiltering] = useState("");

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
      cell: (info) => info.getValue() as React.ReactNode,
      size: 50,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.office,
      id: "pdf",
      header: () => "pdf",
      enableSorting: false,
      size: 80,
      cell: (info: CellContext<TData, unknown>) => {
        const url = info.getValue() as string | undefined;
        if (!url) {
          return (
            <span className="tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1 tw-text-blue-gray-300" aria-disabled title="No file">
              <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
            </span>
          );
        }
        return (
          <a href={url} target="_blank" rel="noopener noreferrer" download
            className="tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1 tw-text-red-600 hover:tw-text-red-800"
            title="Download PDF">
            <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
            <span className="tw-sr-only">Download PDF</span>
          </a>
        );
      },
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
  const onPdfPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const pdfs = files.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length !== files.length) alert("รองรับเฉพาะไฟล์ PDF เท่านั้น");
    console.log("Picked PDFs (demo):", pdfs.map(f => ({ name: f.name, size: f.size })));
    e.currentTarget.value = "";
  };

  const goAdd = () => setMode("form");
  const goList = () => setMode("list");

  if (mode === "form") {
    return (
      <div className="tw-mt-6">
        {/* <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4">
          <Button variant="outlined" size="sm" onClick={goList} className="tw-py-2 tw-px-2" title="กลับไปหน้า List">
            <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
          </Button>
          <Typography variant="h6" color="blue-gray">Corrective Maintenance Form</Typography>
        </div> */}

        {/* ✅ เรนเดอร์ฟอร์มตรง ๆ */}
        <CMForm />
        {/* ถ้า CMForm ของคุณไม่มี prop onCancel ก็ลบออกได้ */}
      </div>
    );
  }

  return (
    <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
      <CardHeader floated={false} shadow={false}
        className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-gap-3 tw-!px-3 md:tw-!px-4 tw-!py-3 md:tw-!py-4 tw-mb-6">
        <div className="tw-ml-3">
          <Typography color="blue-gray" variant="h5" className="tw-text-base sm:tw-text-lg md:tw-text-xl">
            Corrective Maintenance Report
          </Typography>
          <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-normal tw-mt-1 tw-text-sm md:tw-text-[15px]">
            CM Report (demo)
          </Typography>
        </div>

        <div className="tw-w-full md:tw-w-auto md:tw-ml-auto md:tw-flex md:tw-justify-end">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 sm:tw-gap-3 tw-justify-end tw-w-full md:tw-w-auto md:tw-mt-6">
            <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" multiple className="tw-hidden" onChange={onPdfPick} />
            <Button variant="text" size="lg" onClick={() => pdfInputRef.current?.click()}
              className="group tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-3 sm:tw-px-4 tw-flex tw-items-center tw-gap-2 tw-border tw-border-blue-gray-100 tw-bg-white tw-text-blue-gray-900"
              title="อัปโหลด PDF (demo)">
              <ArrowUpTrayIcon className="tw-h-5 tw-w-5" />
              <span className="tw-text-sm">Upload</span>
            </Button>

            {/* +ADD → แสดงฟอร์มทันที (ไม่ route) */}
            <Button size="lg" onClick={goAdd}
              className="tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-4 tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-from-black hover:tw-to-black tw-text-white"
              title="ไปหน้าแบบฟอร์ม CM">
              <span className="tw-w-full tw-text-center">+ADD</span>
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
              {table.getRowModel().rows.map((row) => (
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
              ))}
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
  );
}
