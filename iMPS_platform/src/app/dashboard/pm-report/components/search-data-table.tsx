"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { AppDataTable } from "@/data";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { DocumentArrowDownIcon } from "@heroicons/react/24/outline";
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
  Button,
  Card,
  CardBody,
  CardHeader,
  Typography,
  CardFooter,
  Input,
} from "@material-tailwind/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/solid";

// ใช้ type ของข้อมูลแถวจาก AppDataTable โดยตรง
type TData = (typeof AppDataTable)[number];

export function SearchDataTables() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [data, setData] = useState<TData[]>([]);
  const [filtering, setFiltering] = useState("");
  // const pdfInputRef = useRef<HTMLInputElement>(null);


  // เพิ่ม: ดึงข้อมูลจาก FastAPI แล้ว map → ฟิลด์ที่ตารางใช้อยู่ (name/position/office)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("http://localhost:8000/"); // แก้ URL ให้ตรงของคุณ
        if (!res.ok) {
          // ใช้ข้อมูลเดิมเป็น fallback ถ้า API ล้มเหลว
          setData([...AppDataTable] as TData[]);
          return;
        }
        const json = (await res.json()) as { username?: string[] };

        const rows: TData[] = (json.username ?? []).map((u) =>
        ({
          // คอลัมน์ "date" อ่านจาก row.name
          name: u,
          // คอลัมน์ "pm report" อ่านจาก row.position
          position: u,
          // คอลัมน์ "pdf" อ่านจาก row.office (URL ไฟล์) — ตอนนี้ยังไม่มีเลยเว้นว่าง
          office: "",
        } as TData)
        );

        setData(rows);
      } catch (e) {
        console.error(e);
        // fallback: ใช้ข้อมูลเดิมจาก AppDataTable
        setData([...AppDataTable] as TData[]);
      }
    };

    load();
  }, []);

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
        const indexInPage = pageRows.findIndex(
          (r: (typeof pageRows)[number]) => r.id === info.row.id
        );
        const { pageIndex, pageSize } = info.table.getState().pagination;
        return pageIndex * pageSize + indexInPage + 1;
      },
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.name,
      id: "date",
      header: () => "date",
      cell: (info: CellContext<TData, unknown>) =>
        info.getValue() as React.ReactNode,
      size: 50,
      minSize: 50,
      maxSize: 65,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.position,
      id: "pm_report",
      header: () => "pm report",
      cell: (info: CellContext<TData, unknown>) =>
        info.getValue() as React.ReactNode,
      minSize: 160,
    },
    {
      accessorFn: (row) => row.office, // URL ไฟล์
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
            onClick={(e) => {
              if (!hasUrl) e.preventDefault();
            }}
            className={`tw-inline-flex tw-items-center tw-justify-center tw-rounded tw-px-2 tw-py-1
            ${hasUrl
                ? "tw-text-red-600 hover:tw-text-red-800"
                : "tw-text-blue-gray-300 tw-cursor-not-allowed"
              }`}
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
    state: {
      globalFilter: filtering,
      sorting: sorting,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFiltering,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
  });

  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    // คัดกรองให้เหลือเฉพาะ PDF
    const pdfs = files.filter(
      f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length !== files.length) {
      alert("รองรับเฉพาะไฟล์ PDF เท่านั้น (ไฟล์อื่นจะถูกข้าม)");
    }

    // TODO: นำไฟล์ไปอัปโหลดจริง (เช่น ส่งไป API ด้วย FormData)
    console.log("Picked PDFs:", pdfs.map(f => ({ name: f.name, size: f.size })));

    // เคลียร์ค่าเดิมเพื่อให้เลือกไฟล์เดิมซ้ำได้ในครั้งถัดไป
    e.currentTarget.value = "";
  };


  return (
    <>
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
        <CardHeader
          floated={false}
          shadow={false}
          className="tw-p-2 tw-flex tw-items-center tw-justify-between tw-gap-3"
        >
          <div>
            <Typography color="blue-gray" variant="h5">
              PM Report Documents
            </Typography>
            <Typography
              variant="small"
              className="!tw-text-blue-gray-500 !tw-font-normal tw-mb-4 tw-mt-1"
            >
              ค้นหาและดาวน์โหลดเอกสารรายงานการบำรุงรักษา (PM Report)
            </Typography>
          </div>

          {/* กลุ่มปุ่มด้านขวา */}
          <div className="tw-flex tw-items-center tw-gap-3">
            {/* input เลือกไฟล์ PDF แบบซ่อน */}
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple          // 👉 ลบออกถ้าอยากให้เลือกได้ทีละไฟล์
              className="tw-hidden"
              onChange={handlePdfChange}
            />

            {/* ปุ่ม Upload */}
            <Button
              variant="text"
              size="lg"
              onClick={() => pdfInputRef.current?.click()}
              className="
                group
                tw-h-11 tw-rounded-xl tw-px-4 tw-flex tw-items-center tw-gap-2
                tw-bg-white tw-text-blue-gray-900
                tw-border tw-border-blue-gray-100
                tw-shadow-[0_1px_0_rgba(0,0,0,0.04)]
                hover:tw-bg-black hover:tw-text-black hover:tw-border-black
                hover:tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)]
                tw-transition-colors tw-duration-200
                focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none
              "
            >
              <ArrowUpTrayIcon className="tw-h-5 tw-w-5 tw-transition-transform tw-duration-200 group-hover:-tw-translate-y-0.5" />
              <span>Upload</span>
            </Button>
            {/* </Link> */}

            <Link href="input_PMreport">
              <Button
                size="lg"
                className="
                    tw-h-11 tw-rounded-xl tw-px-4
                    tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900
                    hover:tw-from-black hover:tw-to-black
                    tw-text-white
                    tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)]
                    focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none
                  "
              >
                +ADD
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardBody className="tw-flex tw-items-center tw-px-4 tw-justify-between">
          <div className="tw-flex tw-gap-4 tw-w-full tw-items-center">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="tw-border tw-p-2 tw-border-blue-gray-100 tw-rounded-lg tw-max-w-[70px] tw-w-full"
            >
              {[5, 10, 15, 20, 25].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
            <Typography
              variant="small"
              className="!tw-text-blue-gray-500 !tw-font-normal"
            >
              entries per page
            </Typography>
          </div>
          <div className="tw-w-52">
            <Input
              variant="outlined"
              value={filtering}
              onChange={(e) => setFiltering(e.target.value)}
              label="Search"
              crossOrigin={undefined}
            />
          </div>
        </CardBody>

        <CardFooter className="tw-p-0">
          <table className="tw-table-fixed tw-w-full tw-text-left">
            <colgroup>
              {table.getFlatHeaders().map((header) => (
                <col key={header.id} style={{ width: header.getSize() }} />
              ))}
            </colgroup>

            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const align =
                      (header.column.columnDef as any).meta?.headerAlign ??
                      "left";

                    return (
                      <th
                        key={header.id}
                        style={{ width: header.getSize() }}
                        onClick={
                          canSort
                            ? header.column.getToggleSortingHandler()
                            : undefined
                        }
                        className={`tw-p-4 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium ${align === "center"
                          ? "tw-text-center"
                          : align === "right"
                            ? "tw-text-right"
                            : "tw-text-left"
                          }`}
                      >
                        {canSort ? (
                          <Typography
                            color="blue-gray"
                            className={`tw-flex tw-items-center tw-gap-2 tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40
                                ${align === "center"
                                ? "tw-justify-center"
                                : align === "right"
                                  ? "tw-justify-end"
                                  : "tw-justify-start"
                              }`}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            <ChevronUpDownIcon
                              strokeWidth={2}
                              className="tw-h-4 tw-w-4"
                            />
                          </Typography>
                        ) : (
                          <Typography
                            color="blue-gray"
                            className={`tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40 ${align === "center"
                              ? "tw-text-center"
                              : align === "right"
                                ? "tw-text-right"
                                : "tw-text-left"
                              }`}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </Typography>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody>
              {table.getRowModel().rows.length
                ? table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      const align =
                        (cell.column.columnDef as any).meta?.cellAlign ??
                        "left";
                      return (
                        <td
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                          className={`!tw-border-y !tw-border-x-0 ${align === "center"
                            ? "tw-text-center"
                            : align === "right"
                              ? "tw-text-right"
                              : "tw-text-left"
                            }`}
                        >
                          <Typography
                            variant="small"
                            className={`!tw-font-normal !tw-text-blue-gray-500 tw-py-4 tw-px-4 ${align === "center"
                              ? "tw-text-center"
                              : align === "right"
                                ? "tw-text-right"
                                : "tw-text-left"
                              }`}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </Typography>
                        </td>
                      );
                    })}
                  </tr>
                ))
                : null}
            </tbody>
          </table>
        </CardFooter>

        <div className="tw-flex tw-items-center tw-justify-end tw-gap-6 tw-px-10 tw-py-6">
          <span className="tw-flex tw-items-center tw-gap-1">
            <Typography className="!tw-font-bold">Page</Typography>
            <strong>
              {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </strong>
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
    </>
  );
}

export default SearchDataTables;
