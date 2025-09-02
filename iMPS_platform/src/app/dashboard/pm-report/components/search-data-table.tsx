"use client";

import React, { useState } from "react";
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

import { AppDataTable } from "@/data";

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
  const [data] = useState<TData[]>(() => [...AppDataTable]);
  const [filtering, setFiltering] = useState("");

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
        // ให้ type กับ r เพื่อไม่ให้เป็น any
        const indexInPage = pageRows.findIndex(
          (r: (typeof pageRows)[number]) => r.id === info.row.id
        );
        const { pageIndex, pageSize } = info.table.getState().pagination;
        return pageIndex * pageSize + indexInPage + 1;
      },
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      // ถ้าข้อมูลคุณมี key เป็น name จริง ๆ ให้ใช้ accessorKey ก็ได้
      // accessorKey: "name",
      accessorFn: (row) => row.name,
      id: "date",
      header: () => "date",
      cell: (info: CellContext<TData, unknown>) => info.getValue() as React.ReactNode,
      size: 50,
      minSize: 50,
      maxSize: 65,
      meta: { headerAlign: "center", cellAlign: "center" },
    },
    {
      accessorFn: (row) => row.position,
      id: "pm_report",
      header: () => "pm report",
      cell: (info: CellContext<TData, unknown>) => info.getValue() as React.ReactNode,
      minSize: 160,
    },
    {
      accessorFn: (row) => row.office, // ถ้า field นี้คือ URL ของไฟล์
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

  return (
    <>
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
        <CardHeader floated={false} shadow={false} className="tw-p-2">
          <Typography color="blue-gray" variant="h5">
            PM Report Documents
          </Typography>
          <Typography
            variant="small"
            className="!tw-text-blue-gray-500 !tw-font-normal tw-mb-4 tw-mt-1"
          >
            ค้นหาและดาวน์โหลดเอกสารรายงานการบำรุงรักษา (PM Report)
          </Typography>
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
          <Button className="tw-ml-3 tw-flex tw-gap-2" variant="gradient">
            add
          </Button>
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
                      (header.column.columnDef as any).meta?.headerAlign ?? "left";

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
                            <ChevronUpDownIcon strokeWidth={2} className="tw-h-4 tw-w-4" />
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
                        (cell.column.columnDef as any).meta?.cellAlign ?? "left";
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
              {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
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
