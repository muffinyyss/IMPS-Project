// "use client";

// import React, { useEffect, useState, useRef, useMemo } from "react";
// import Link from "next/link";
// import { AppDataTable } from "@/data";
// import { ArrowUpTrayIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";
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
// import { ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon } from "@heroicons/react/24/solid";

// import { useRouter, useSearchParams, usePathname } from "next/navigation";

// // ใช้ type ของข้อมูลแถวจาก AppDataTable โดยตรง
// type TData = (typeof AppDataTable)[number];

// type StationOpt = { station_id: string; station_name: string };

// type Props = {
//   onSelectStation?: (stationId: string) => void;
//   token?: string;                         // <<— รับ token จากหน้า page
//   apiBase?: string;                       // <<— override base URL ได้
// };

// const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// export function SearchDataTables({ onSelectStation, token, apiBase = BASE }: Props) {
//   const [sorting, setSorting] = useState<SortingState>([]);
//   const [data, setData] = useState<TData[]>([]);
//   const [filtering, setFiltering] = useState("");
//   const router = useRouter();
//   const pathname = usePathname();
//   const sp = useSearchParams();

//   // ==== โหลดรายชื่อ "สถานีของฉัน" เพื่อใช้ใน dropdown ====
//   const [stations, setStations] = useState<StationOpt[]>([]);
//   const [stationId, setStationId] = useState<string>("");

//   // useEffect(() => {
//   //   const loadStations = async () => {
//   //     try {
//   //       const res = await fetch(`${apiBase}/my-stations/detail`, {
//   //         headers: {
//   //           "Content-Type": "application/json",
//   //           ...(token ? { Authorization: `Bearer ${token}` } : {}),
//   //         },
//   //         // ถ้าใช้ cookie httpOnly แทน header: เปิดบรรทัดนี้ แล้วอย่าส่ง Authorization
//   //         // credentials: "include",
//   //       });
//   //       if (!res.ok) throw new Error(await res.text());
//   //       const json = (await res.json()) as { stations: StationOpt[] };
//   //       setStations(json.stations ?? []);
//   //     } catch (err) {
//   //       console.error("load stations error:", err);
//   //       setStations([]);
//   //     }
//   //   };
//   //   loadStations();
//   // }, [apiBase, token]);



//   // // ==== ตัวอย่างโหลด data table (เดิมคุณยิง /) ====
//   // useEffect(() => {
//   //   const load = async () => {
//   //     try {
//   //       const res = await fetch(`${apiBase}/pmreport/latest/${encodeURIComponent(stationId)}`, {  // ใช้ endpoint ที่มีจริง
//   //         headers: { "Content-Type": "application/json" },
//   //       });
//   //       if (!res.ok) {
//   //         setData([...AppDataTable] as TData[]);
//   //         return;
//   //       }
//   //       const json = (await res.json()) as { pm_date?: string[] };
//   //       const rows: TData[] = (json.pm_date ?? []).map((u) => ({
//   //         name: u,
//   //         position: u,
//   //         office: "",   // url ไฟล์ ถ้ามีค่อยเติม
//   //       }) as TData);
//   //       setData(rows);
//   //     } catch (e) {
//   //       console.error(e);
//   //       setData([...AppDataTable] as TData[]);
//   //     }
//   //   };
//   //   load();
//   // }, [apiBase]);

//   function thDate(iso?: string) {
//     if (!iso) return "-";
//     return new Date(iso).toLocaleDateString("th-TH-u-ca-buddhist", {
//       day: "2-digit",
//       month: "2-digit",
//       year: "numeric",
//     });
//   }

//   const stationIdFromUrl = sp.get("station_id") ?? "";

//   const addHref = useMemo(() => {
//     if (!stationIdFromUrl) return "/dashboard/pm-report/charger/input_PMreport";
//     const p = new URLSearchParams({ station_id: stationIdFromUrl });
//     return `/dashboard/pm-report/charger/input_PMreport?${p.toString()}`;
//   }, [stationIdFromUrl]);

//   function makeHeaders(token?: string): Record<string, string> {
//     const h: Record<string, string> = { "Content-Type": "application/json" };
//     if (token) h.Authorization = `Bearer ${token}`;
//     return h;
//   }

//   useEffect(() => {
//     let alive = true;

//     const fetchRows = async () => {
//       try {
//         if (!stationIdFromUrl) {
//           setData([]);                              // ยังไม่เลือกสถานี -> เคลียร์ตาราง
//           return;
//         }

//         // ถ้าใช้ Bearer token:
//         const t = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
//         const headers = makeHeaders(t);

//         // 1) พยายามเรียก endpoint รายการ pm ก่อน (สมมติชื่อ /pmreport/list/{station_id})
//         // const urlList = `${apiBase}/pmreport/list/${encodeURIComponent(stationIdFromUrl)}`;


//         // let res = await fetch(
//         //   `${apiBase}/pmreport/list/${encodeURIComponent(stationIdFromUrl)}`,
//         //   {
//         //     headers,             // <= ไม่มี union แล้ว เป็น Record<string,string>
//         //     // ถ้าใช้ cookie httpOnly: เอา headers ออก แล้วใช้ credentials แทน
//         //     // credentials: "include",
//         //   }
//         // );

//         // if (res.ok) {
//         //   const json = await res.json();

//         //   // case A: { pm_date: string[] }
//         //   if (Array.isArray(json?.pm_date)) {
//         //     const rows: TData[] = json.pm_date.map((d: string) => ({
//         //       name: thDate(d),      // แสดงเป็นพ.ศ.
//         //       position: d,          // raw date เก็บไว้คอลัมน์อื่นหรือซ่อน
//         //       office: "",           // ถ้ามี url ใส่ตรงนี้
//         //     })) as TData[];
//         //     if (alive) setData(rows);
//         //     return;
//         //   }

//         //   // case B: { items: [{ pm_date|date|timestamp, file_url? }, ...] }
//         //   if (Array.isArray(json?.items)) {
//         //     const rows: TData[] = json.items.map((it: any) => {
//         //       const iso = it.pm_date ?? it.date ?? it.timestamp ?? "";
//         //       const file = it.file_url ?? it.url ?? "";
//         //       return {
//         //         name: thDate(iso),
//         //         position: iso,
//         //         office: file,
//         //       } as TData;
//         //     });
//         //     if (alive) setData(rows);
//         //     return;
//         //   }

//         //   // บางระบบอาจคืน array ตรง ๆ
//         //   if (Array.isArray(json)) {
//         //     const rows: TData[] = json.map((it: any) => {
//         //       const iso = typeof it === "string" ? it : (it?.pm_date ?? it?.date ?? it?.timestamp ?? "");
//         //       const file = it?.file_url ?? it?.url ?? "";
//         //       return {
//         //         name: thDate(iso),
//         //         position: iso,
//         //         office: file,
//         //       } as TData;
//         //     });
//         //     if (alive) setData(rows);
//         //     return;
//         //   }

//         //   // ไม่เข้าเคสไหนเลย -> ลอง fallback latest ต่อด้านล่าง
//         // }

//         // 2) Fallback: ดึงตัวล่าสุดจาก /pmreport/latest/{station_id} แล้วทำเป็น 1 แถว
//         const urlLatest = `${apiBase}/pmreport/latest/${encodeURIComponent(stationIdFromUrl)}`;
//         let res = await fetch(
//           `${apiBase}/pmreport/latest/${encodeURIComponent(stationIdFromUrl)}`,
//           {
//             headers,
//             // credentials: "include",
//           }
//         );

//         if (res.ok) {
//           const j = await res.json();
//           const iso = j?.pm_date ?? "";
//           const rows: TData[] = iso
//             ? ([{ name: thDate(iso), position: iso, office: "" }] as TData[])
//             : [];
//           if (alive) setData(rows);
//           return;
//         }

//         // 3) ถ้ายังไม่ ok -> ใช้ mock เดิม
//         setData([...AppDataTable] as TData[]);
//       } catch (e) {
//         console.error("load pm_date error:", e);
//         setData([...AppDataTable] as TData[]);
//       }
//     };

//     fetchRows();
//     return () => { alive = false; };
//   }, [apiBase, stationIdFromUrl]);

//   // ==== เมื่อเลือกสถานีที่ dropdown → ยิง callback =====
//   const handleChangeStation = (sid: string) => {
//     const params = new URLSearchParams(sp.toString());
//     if (sid) params.set("station_id", sid); else params.delete("station_id");
//     router.replace(`${pathname}?${params.toString()}`, { scroll: false });
//   };

//   const columns: ColumnDef<TData, unknown>[] = [
//     {
//       id: "no",
//       header: () => "No.",
//       enableSorting: false,
//       size: 25,
//       minSize: 10,
//       maxSize: 25,
//       cell: (info: CellContext<TData, unknown>) => {
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
//       cell: (info: CellContext<TData, unknown>) => info.getValue() as React.ReactNode,
//       size: 50,
//       minSize: 50,
//       maxSize: 65,
//       meta: { headerAlign: "center", cellAlign: "center" },
//     },
//     // {
//     //   accessorFn: (row) => row.position,
//     //   id: "pm_report",
//     //   header: () => "pm report",
//     //   cell: (info: CellContext<TData, unknown>) => info.getValue() as React.ReactNode,
//     //   minSize: 160,
//     // },
//     {
//       accessorFn: (row) => row.office, // URL ไฟล์
//       id: "pdf",
//       header: () => "pdf",
//       enableSorting: false,
//       cell: (info: CellContext<TData, unknown>) => {
//         const url = info.getValue() as string | undefined;
//         const hasUrl = typeof url === "string" && url.length > 0;
//         return (
//           <a
//             href={hasUrl ? url : undefined}
//             target="_blank"
//             rel="noopener noreferrer"
//             download
//             onClick={(e) => {
//               if (!hasUrl) e.preventDefault();
//             }}
//             className={`tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1
//               ${hasUrl ? "tw-text-red-600 hover:tw-text-red-800" : "tw-text-blue-gray-300 tw-cursor-not-allowed"}`}
//             aria-disabled={!hasUrl}
//             title={hasUrl ? "Download PDF" : "No file"}
//           >
//             <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
//             <span className="tw-sr-only">Download PDF</span>
//           </a>
//         );
//       },
//       size: 80,
//       minSize: 64,
//       maxSize: 120,
//       meta: { headerAlign: "center", cellAlign: "center" },
//     },
//   ];

//   const table = useReactTable({
//     data,
//     columns,
//     state: {
//       globalFilter: filtering,
//       sorting: sorting,
//     },
//     onSortingChange: setSorting,
//     onGlobalFilterChange: setFiltering,
//     getSortedRowModel: getSortedRowModel(),
//     getFilteredRowModel: getFilteredRowModel(),
//     getCoreRowModel: getCoreRowModel(),
//     getPaginationRowModel: getPaginationRowModel(),
//     columnResizeMode: "onChange",
//   });

//   const pdfInputRef = useRef<HTMLInputElement>(null);

//   const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const files = Array.from(e.target.files ?? []);
//     if (!files.length) return;
//     const pdfs = files.filter(
//       (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
//     );
//     if (pdfs.length !== files.length) {
//       alert("รองรับเฉพาะไฟล์ PDF เท่านั้น (ไฟล์อื่นจะถูกข้าม)");
//     }
//     console.log("Picked PDFs:", pdfs.map((f) => ({ name: f.name, size: f.size })));
//     e.currentTarget.value = "";
//   };

//   return (
//     <>
//       <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
//         {/* HEADER */}
//         <CardHeader
//           floated={false}
//           shadow={false}
//           className="
//             tw-flex tw-flex-col md:tw-flex-row
//             tw-items-start md:tw-items-center tw-gap-3
//             tw-!px-3 md:tw-!px-4      /* padding เหมือนเดิม */
//             tw-!py-3 md:tw-!py-4
//             tw-mb-6
//         ">
//           <div className="tw-ml-3">
//             <Typography color="blue-gray" variant="h5" className="tw-text-base sm:tw-text-lg md:tw-text-xl">
//               {/* PM Report Documents */}
//               Preventive Maintenance Checklist - เครื่องอัดประจุไฟฟ้า
//             </Typography>
//             <Typography
//               variant="small"
//               className="!tw-text-blue-gray-500 !tw-font-normal tw-mt-1 tw-text-xs sm:tw-text-sm"
//             >
//               ค้นหาและดาวน์โหลดเอกสารรายงานการบำรุงรักษา (PM Report)
//             </Typography>
//           </div>

//           {/* wrapper ชั้นนอก: ทำให้กลุ่มปุ่มชิดขวาเสมอกับ Search */}
//           <div className="tw-w-full md:tw-w-auto md:tw-ml-auto md:tw-flex md:tw-justify-end">
//             {/* wrapper ชั้นใน: กดปุ่มให้ต่ำลงมาเฉพาะ md+ */}
//             <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 sm:tw-gap-3 tw-justify-end tw-w-full md:tw-w-auto md:tw-mt-6">
//               <input
//                 ref={pdfInputRef}
//                 type="file"
//                 accept="application/pdf,.pdf"
//                 multiple
//                 className="tw-hidden"
//                 onChange={handlePdfChange}
//               />

//               <Button
//                 variant="text"
//                 size="lg"
//                 onClick={() => pdfInputRef.current?.click()}
//                 className="
//                   group tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-3 sm:tw-px-4 tw-flex tw-items-center tw-gap-2
//                   tw-bg-white tw-text-blue-gray-900 tw-border tw-border-blue-gray-100
//                   tw-shadow-[0_1px_0_rgba(0,0,0,0.04)]
//                   hover:tw-bg-black hover:tw-text-black hover:tw-border-black
//                   hover:tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)]
//                   tw-transition-colors tw-duration-200
//                   focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none
//                 "
//               >
//                 <ArrowUpTrayIcon className="tw-h-5 tw-w-5 tw-transition-transform tw-duration-200 group-hover:-tw-translate-y-0.5" />
//                 <span className="tw-text-sm">Upload</span>
//               </Button>

//               {/* <Link href="input_PMreport" className="tw-inline-block">
//                 <Button
//                   size="lg"
//                   className="
//                     !tw-flex !tw-justify-center !tw-items-center tw-text-center tw-leading-none
//                     tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-4
//                     tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900
//                     hover:tw-from-black hover:tw-to-black
//                     tw-text-white
//                     tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)]
//                     focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none
//                   "
//                 >
//                   <span className="tw-w-full tw-text-center">+add</span>
//                 </Button>
//               </Link> */}

//               <Link
//                 href={addHref}
//                 className="tw-inline-block"
//                 aria-disabled={!stationIdFromUrl}
//                 onClick={(e) => { if (!stationIdFromUrl) e.preventDefault(); }}
//               >
//                 <Button
//                   size="lg"
//                   disabled={!stationIdFromUrl}   // <- ปิดปุ่มถ้ายังไม่มี station_id
//                   className={`
//                     !tw-flex !tw-justify-center !tw-items-center tw-text-center tw-leading-none
//                     tw-h-10 sm:tw-h-11 tw-rounded-xl tw-px-4
//                     ${!stationIdFromUrl
//                       ? "tw-bg-gray-300 tw-text-white tw-cursor-not-allowed"
//                       : "tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-from-black hover:tw-to-black tw-text-white"}
//                     tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)]
//                     focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none
//                   `}
//                   title={stationIdFromUrl ? "" : "กรุณาเลือกสถานีก่อน"}
//                 >
//                   <span className="tw-w-full tw-text-center">+add</span>
//                 </Button>
//               </Link>
//             </div>
//           </div>
//         </CardHeader>

//         {/* FILTER BAR */}
//         <CardBody
//           className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-3 md:tw-px-4">
//           {/* ซ้าย: dropdown + label (ขนาดคงที่) */}
//           <div className="tw-flex tw-items-center tw-gap-3 tw-flex-none">
//             <select
//               value={table.getState().pagination.pageSize}
//               onChange={(e) => table.setPageSize(Number(e.target.value))}
//               className="tw-border tw-p-2 tw-border-blue-gray-100 tw-rounded-lg tw-w-[72px]"
//             >
//               {[5, 10, 15, 20, 25].map((pageSize) => (
//                 <option key={pageSize} value={pageSize}>
//                   {pageSize}
//                 </option>
//               ))}
//             </select>
//             <Typography
//               variant="small"
//               className="!tw-text-blue-gray-500 !tw-font-normal tw-hidden sm:tw-inline"
//             >
//               entries per page
//             </Typography>
//           </div>

//           {/* ขวา: Search (ยืด/หดได้ และชิดขวา) */}
//           <div className="tw-ml-auto tw-min-w-0 tw-flex-1 md:tw-flex-none md:tw-w-64">
//             <Input
//               variant="outlined"
//               value={filtering}
//               onChange={(e) => setFiltering(e.target.value)}
//               label="Search"
//               crossOrigin={undefined}
//               containerProps={{ className: "tw-min-w-0" }} // ให้หดได้ใน flex
//               className="tw-w-full"
//             />
//           </div>
//         </CardBody>


//         {/* TABLE: overflow-x-auto + min-width เพื่อเลื่อนบนมือถือ */}
//         <CardFooter className="tw-p-0">
//           <div className="tw-relative tw-w-full tw-overflow-x-auto tw-overflow-y-hidden tw-scroll-smooth">
//             <table className="tw-w-full tw-text-left tw-min-w-[720px] md:tw-min-w-0 md:tw-table-fixed">
//               <colgroup>
//                 {table.getFlatHeaders().map((header) => (
//                   <col key={header.id} style={{ width: header.getSize() }} />
//                 ))}
//               </colgroup>

//               <thead className="tw-bg-gray-50 tw-sticky tw-top-0">
//                 {table.getHeaderGroups().map((headerGroup) => (
//                   <tr key={headerGroup.id}>
//                     {headerGroup.headers.map((header) => {
//                       const canSort = header.column.getCanSort();
//                       const align = (header.column.columnDef as any).meta?.headerAlign ?? "left";
//                       return (
//                         <th
//                           key={header.id}
//                           style={{ width: header.getSize() }}
//                           onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
//                           className={`tw-p-3 md:tw-p-4 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium tw-whitespace-nowrap
//                             ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}`}
//                         >
//                           {canSort ? (
//                             <Typography
//                               color="blue-gray"
//                               className={`tw-flex tw-items-center tw-gap-1 md:tw-gap-2 tw-text-[10px] sm:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40
//                                 ${align === "center" ? "tw-justify-center" : align === "right" ? "tw-justify-end" : "tw-justify-start"}`}
//                             >
//                               {flexRender(header.column.columnDef.header, header.getContext())}
//                               <ChevronUpDownIcon strokeWidth={2} className="tw-h-4 tw-w-4" />
//                             </Typography>
//                           ) : (
//                             <Typography
//                               color="blue-gray"
//                               className={`tw-text-[10px] sm:tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40
//                                 ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}`}
//                             >
//                               {flexRender(header.column.columnDef.header, header.getContext())}
//                             </Typography>
//                           )}
//                         </th>
//                       );
//                     })}
//                   </tr>
//                 ))}
//               </thead>

//               <tbody>
//                 {table.getRowModel().rows.length
//                   ? table.getRowModel().rows.map((row) => (
//                     <tr key={row.id} className="odd:tw-bg-white even:tw-bg-gray-50">
//                       {row.getVisibleCells().map((cell) => {
//                         const align = (cell.column.columnDef as any).meta?.cellAlign ?? "left";
//                         return (
//                           <td
//                             key={cell.id}
//                             style={{ width: cell.column.getSize() }}
//                             className={`!tw-border-y !tw-border-x-0 tw-align-middle
//                                 ${align === "center" ? "tw-text-center" : align === "right" ? "tw-text-right" : "tw-text-left"}`}
//                           >
//                             <Typography
//                               variant="small"
//                               className={`!tw-font-normal !tw-text-blue-gray-600 tw-py-3 md:tw-py-4 tw-px-3 md:tw-px-4
//                                   tw-truncate md:tw-whitespace-normal`}
//                             >
//                               {flexRender(cell.column.columnDef.cell, cell.getContext())}
//                             </Typography>
//                           </td>
//                         );
//                       })}
//                     </tr>
//                   ))
//                   : null}
//               </tbody>
//             </table>
//           </div>
//         </CardFooter>

//         {/* PAGINATION: ชิดซ้ายบนมือถือ, แยกเป็นสองฝั่งบน md+ */}
//         <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-justify-between tw-gap-3 tw-px-3 md:tw-px-4 tw-py-4">
//           <span className="tw-text-sm">
//             <Typography className="!tw-font-bold tw-inline">Page</Typography>{" "}
//             <strong>
//               {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
//             </strong>
//           </span>

//           <div className="tw-flex tw-items-center tw-gap-2">
//             <Button
//               variant="outlined"
//               size="sm"
//               onClick={() => table.previousPage()}
//               disabled={!table.getCanPreviousPage()}
//               className="disabled:tw-opacity-30 tw-py-2 tw-px-2"
//             >
//               <ChevronLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
//               <span className="tw-sr-only">Previous</span>
//             </Button>
//             <Button
//               variant="outlined"
//               size="sm"
//               onClick={() => table.nextPage()}
//               disabled={!table.getCanNextPage()}
//               className="disabled:tw-opacity-30 tw-py-2 tw-px-2"
//             >
//               <ChevronRightIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
//               <span className="tw-sr-only">Next</span>
//             </Button>
//           </div>
//         </div>
//       </Card>
//     </>

//   );
// }

// export default SearchDataTables;


"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

  const pathname = usePathname();
  const sp = useSearchParams();

  // อ่าน station_id จาก URL (Navbar เป็นคนอัปเดตให้)
  const stationIdFromUrl = sp.get("station_id") ?? "";

  const addHref = useMemo(() => {
    if (!stationIdFromUrl) return "/dashboard/pm-report/charger/input_PMreport";
    const p = new URLSearchParams({ station_id: stationIdFromUrl });
    return `/dashboard/pm-report/charger/input_PMreport?${p.toString()}`;
  }, [stationIdFromUrl]);

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

  const fetchRows = async () => {
  if (!stationIdFromUrl) { setData([]); return; }
  setLoading(true);
  try {
    const makeURL = (path: string) => {
      const u = new URL(`${apiBase}${path}`);
      u.searchParams.set("station_id", stationIdFromUrl);
      u.searchParams.set("page", "1");
      u.searchParams.set("pageSize", "50");
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

    // ✅ ไม่ dedupe — map เป็น rows ทั้งหมดจาก 2 แหล่ง แล้วรวม
    const pmRows: TData[] = pmItems.map((it: any) => {
      const isoDay = toISODateOnly(it.pm_date ?? it.createdAt ?? "");
      const file = it.file_url ?? (Array.isArray(it.urls) ? it.urls[0] : "");
      return {
        name: thDate(isoDay),
        position: isoDay,   // raw date
        office: file || "",
      } as TData;
    });

    const urlRows: TData[] = urlItems.map((it: any) => {
      const isoDay = toISODateOnly(it.pm_date ?? it.reportDate ?? it.createdAt ?? "");
      const file = it.file_url ?? (Array.isArray(it.urls) ? it.urls[0] : "");
      return {
        name: thDate(isoDay),
        position: isoDay,   // raw date
        office: file || "",
      } as TData;
    });

    // รวมทั้งหมด แล้ว sort ตามวันที่ (ใหม่ → เก่า) แต่ยัง “ไม่ตัดซ้ำ”
    const allRows = [...pmRows, ...urlRows].sort((a, b) => {
      const da = (a.position ?? "") as string;
      const db = (b.position ?? "") as string;
      return da < db ? 1 : da > db ? -1 : 0;
    });

    // ถ้าไม่มีอะไรเลย → fallback ล่าสุด 1 แถว
    if (!allRows.length) {
      const res2 = await fetch(`${apiBase}/pmreport/latest/${encodeURIComponent(stationIdFromUrl)}`, fetchOpts);
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

  useEffect(() => {
    let alive = true;
    (async () => { await fetchRows(); })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, stationIdFromUrl]);



  // โหลดรายการ PM ของสถานีจาก station_id ใน URL
  // useEffect(() => {
  //   let alive = true;
  //   (async () => {
  //     try {
  //       if (!stationIdFromUrl) {
  //         setData([]);
  //         return;
  //       }
  //       setLoading(true);

  //       // ✅ ใช้ /pmreport/list?station_id=...
  //       const url = new URL(`${apiBase}/pmreport/list`);
  //       url.searchParams.set("station_id", stationIdFromUrl);
  //       url.searchParams.set("page", "1");
  //       url.searchParams.set("pageSize", "50");

  //       const res = await fetch(url.toString(), fetchOpts);

  //       if (!res.ok) {
  //         // fallback → ใช้ล่าสุด
  //         const res2 = await fetch(`${apiBase}/pmreport/latest/${encodeURIComponent(stationIdFromUrl)}`, fetchOpts);
  //         if (res2.ok) {
  //           const j = await res2.json();
  //           const iso = j?.pm_date ?? "";
  //           const rows: TData[] = iso ? ([{ name: thDate(iso), position: iso, office: "" }] as TData[]) : [];
  //           if (alive) setData(rows);
  //           return;
  //         }
  //         if (alive) setData([...AppDataTable] as TData[]);
  //         return;
  //       }

  //       const json = await res.json();

  //       // โครงสร้างปัจจุบันของ backend: { items: [{ id, pm_date, createdAt, file_url }], ... }
  //       if (Array.isArray(json?.items)) {
  //         const rows: TData[] = json.items.map((it: any) => ({
  //           name: thDate(it.pm_date ?? it.createdAt ?? ""),
  //           position: it.pm_date ?? it.createdAt ?? "",
  //           office: it.file_url ?? "",  // ตอนนี้ backend ยังใส่ "" ไว้ก่อน
  //         })) as TData[];
  //         if (alive) setData(rows);
  //         return;
  //       }

  //       // รองรับ { pm_date: string[] } เผื่ออนาคต
  //       if (Array.isArray(json?.pm_date)) {
  //         const rows: TData[] = json.pm_date.map((d: string) => ({
  //           name: thDate(d),
  //           position: d,
  //           office: "",
  //         })) as TData[];
  //         if (alive) setData(rows);
  //         return;
  //       }

  //       // เผื่อคืน array ตรง ๆ
  //       if (Array.isArray(json)) {
  //         const rows: TData[] = json.map((it: any) => {
  //           const iso = typeof it === "string" ? it : (it?.pm_date ?? it?.date ?? it?.timestamp ?? "");
  //           const file = it?.file_url ?? it?.url ?? "";
  //           return { name: thDate(iso), position: iso, office: file } as TData;
  //         });
  //         if (alive) setData(rows);
  //         return;
  //       }

  //       // ไม่เข้าเคสไหน → mock
  //       if (alive) setData([...AppDataTable] as TData[]);
  //     } catch (e) {
  //       console.error("load pm list error:", e);
  //       setData([...AppDataTable] as TData[]);
  //     } finally {
  //       setLoading(false);
  //     }
  //   })();
  //   return () => { alive = false; };
  // }, [apiBase, stationIdFromUrl]);

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
        return (
          <a
            href={hasUrl ? url : undefined}
            target="_blank"
            rel="noopener noreferrer"
            download
            onClick={(e) => { if (!hasUrl) e.preventDefault(); }}
            className={`tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1
              ${hasUrl ? "tw-text-red-600 hover:tw-text-red-800" : "tw-text-blue-gray-300 tw-cursor-not-allowed"}`}
            aria-disabled={!hasUrl}
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
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
  });

  // Upload: ตอนนี้ backend /pmurl/upload รับ URL ไม่ใช่ไฟล์จริง
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
    // backend คาด `rows` เป็น list ของ JSON string ทีละแถว
    fd.append("rows", JSON.stringify({ reportDate, urls }));

    const res = await fetch(`${apiBase}/pmurl/upload`, {
      method: "POST",
      body: fd,
      credentials: "include",            // ⬅️ สำคัญ! ส่งคุกกี้ด้วย
    });

    if (!res.ok) { alert("อัปโหลดไม่สำเร็จ: " + await res.text()); return; }
    alert("อัปโหลดสำเร็จ");
    setDateOpen(false);
    setUrlText("");


  }
  // const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const files = Array.from(e.target.files ?? []);
  //   e.currentTarget.value = "";
  //   if (!files.length) return;

  //   const onlyPdf = files.every(
  //     (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
  //   );
  //   if (!onlyPdf) {
  //     alert("รองรับเฉพาะไฟล์ PDF เท่านั้น");
  //     return;
  //   }

  //   const stationId = stationIdFromUrl;
  //   if (!stationId) {
  //     alert("กรุณาเลือกสถานีจากแถบบนก่อน");
  //     return;
  //   }



  //   // ขอวันที่รายงาน (หรือทำ date picker จริงจัง)
  //   const input = prompt("กรอกวันที่รายงาน (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
  //   if (!input) return;

  //   try {
  //     const fd = new FormData();
  //     fd.append("station_id", stationId);
  //     fd.append("reportDate", input);
  //     files.forEach((f) => fd.append("files", f)); // FastAPI ใช้ชื่อ 'files'

  //     const res = await fetch(`${apiBase}/pmurl/upload-files`, {
  //       method: "POST",
  //       body: fd,
  //       // ถ้าใช้ cookie httpOnly:
  //       credentials: "include",
  //     });

  //     if (!res.ok) {
  //       const txt = await res.text();
  //       alert("อัปโหลดไม่สำเร็จ: " + txt);
  //       return;
  //     }

  //     const j = await res.json();
  //     console.log("uploaded:", j);

  //     // รีโหลดตารางให้เห็นไฟล์ใหม่
  //     // (ชุดโหลดตารางของคุณดึงจาก /pmreport/list – ถ้าอยากให้คอลัมน์ pdf โชว์ไฟล์นี้
  //     //  คุณสามารถดึงรายการจากคอลเลกชัน URL เพิ่มเติม หรือรวมกับ pmreport.list ตามที่ออกแบบ)
  //     alert("อัปโหลดสำเร็จ");
  //   } catch (err) {
  //     console.error(err);
  //     alert("เกิดข้อผิดพลาดระหว่างอัปโหลด");
  //   }
  // };
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
      if (!stationIdFromUrl) {
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
      fd.append("station_id", stationIdFromUrl);
      fd.append("reportDate", reportDate);
      pendingFiles.forEach((f) => fd.append("files", f));

      const res = await fetch(`${apiBase}/pmurl/upload-files`, {
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

        {/* แถบ filter (ไม่มี dropdown แล้ว) */}
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
      {/* ⬇️ วาง Dialog นอกร่าง Card แต่ยังอยู่ใน component */}
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
