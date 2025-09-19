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
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";

//components
import AddUser, { NewUserPayload } from "@/app/dashboard/users/components/adduser";

// ใช้ type ของข้อมูลแถวจาก AppDataTable โดยตรง
type TData = (typeof AppDataTable)[number];

export function SearchDataTables() {
  const [sorting, setSorting] = useState([]);
  const [data] = useState(() => [...AppDataTable]);
  const [filtering, setFiltering] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- handlers สำหรับปุ่ม action ---
  const handleEdit = (row: TData) => {
    // TODO: เปิด modal แก้ไข / นำทางไปหน้าแก้ไข
    console.log("Edit user:", row);
  };
  const handleDelete = (row: TData) => {
    // TODO: เรียก API ลบ / แสดงกล่องยืนยัน
    if (confirm(`ต้องการลบผู้ใช้ "${row.name}" ใช่หรือไม่?`)) {
      console.log("Delete user:", row);
    }
  };

  const handleCreateUser = async (payload: NewUserPayload) => {
    try {
      setSaving(true);
      // TODO: เปลี่ยน endpoint ให้ตรง API จริงของคุณ
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // ปิด modal แล้ว refetch/refresh ตารางตามที่คุณใช้ data source จริง
      setOpenAdd(false);
      // ตัวอย่าง: window.location.reload(); หรือ setData([...data, newUser])
    } catch (e) {
      console.error(e);
      alert("สร้างผู้ใช้ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
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
      accessorFn: (row: any) => row.name,
      id: "username",
      cell: (info: any) => info.getValue(),
      header: () => "username",
    },
    {
      accessorFn: (row: any) => row.position,
      id: "email",
      cell: (info: any) => info.getValue(),
      header: () => "email",
    },
    {
      accessorFn: (row: any) => row.office,
      id: "tel",
      cell: (info: any) => info.getValue(),
      header: () => "tel",
    },
    {
      accessorFn: (row: any) => row.age,
      id: "role",
      cell: (info: any) => info.getValue(),
      header: () => "role",
    },
    {
      id: "actions",
      header: () => "actions",
      enableSorting: false,
      size: 80,
      cell: ({ row }: { row: Row<TData> }) => (
        <span className="tw-inline-flex tw-items-center tw-gap-2 tw-pr-2">
          <button
            title="Edit user"
            onClick={() => handleEdit(row.original)}
            className="tw-rounded tw-p-1 tw-border tw-border-blue-gray-100 hover:tw-bg-blue-50 tw-transition"
          >
            <PencilSquareIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-700" />
          </button>
          <button
            title="Delete user"
            onClick={() => handleDelete(row.original)}
            className="tw-rounded tw-p-1 tw-border tw-border-blue-gray-100 hover:tw-bg-red-50 tw-transition"
          >
            <TrashIcon className="tw-h-5 tw-w-5 tw-text-red-600" />
          </button>
        </span>
      ),
    }

  ];

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter: filtering,
      sorting: sorting,
    },
    // @ts-ignore
    onSortingChange: setSorting,
    onGlobalFilterChange: setFiltering,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <>
      {/** Search DataTable */}
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
        <CardHeader floated={false} shadow={false} className="tw-p-2 tw-flex tw-items-center tw-justify-between tw-gap-3">
          <div>
            <Typography color="blue-gray" variant="h5">
              Users & Roles Management
            </Typography>
            <Typography
              variant="small"
              className="!tw-text-blue-gray-500 !tw-font-normal tw-mb-4 tw-mt-1"
            >
              Manage Users: Add, Edit, or Remove users from the system.
            </Typography>
          </div>



          <Button
            onClick={() => setOpenAdd(true)}
            size="lg"
            className="
              tw-h-11 tw-rounded-xl tw-px-4 
              tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900
              hover:tw-to-black
              tw-text-white
              tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)]
              focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none">
            +add
          </Button>
        </CardHeader>
        <CardBody className="tw-flex tw-items-center tw-px-4 tw-justify-between">
          <div className="tw-flex tw-gap-4 tw-w-full tw-items-center">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
              }}
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
        <CardFooter className="tw-p-0 tw-overflow-scroll">
          <table className="tw-table-auto tw-text-left tw-w-full tw-min-w-max">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="tw-p-4 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium"
                    >
                      <Typography
                        color="blue-gray"
                        className="tw-flex tw-items-center tw-justify-between tw-gap-2 tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40"
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
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length
                ? table.getRowModel().rows.map((row, index) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="!tw-border-y !tw-border-x-0"
                      >
                        <Typography
                          variant="small"
                          className="!tw-font-normal !tw-text-blue-gray-500 tw-py-4 tw-px-4"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </Typography>
                      </td>
                    ))}
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
              onClick={() => {
                table.previousPage();
              }}
              disabled={!table.getCanPreviousPage()}
              className="disabled:tw-opacity-30 tw-py-2 tw-px-2"
            >
              <ChevronLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
            </Button>
            <Button
              variant="outlined"
              size="sm"
              onClick={() => {
                table.nextPage();
              }}
              disabled={!table.getCanNextPage()}
              className="disabled:tw-opacity-30 tw-py-2 tw-px-2"
            >
              <ChevronRightIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
            </Button>
          </div>
        </div>
      </Card>

      <AddUser
      open={openAdd}
      onClose={() => setOpenAdd(false)}
      onSubmit={handleCreateUser}
      loading={saving}
    />
    </>
  );
}

export default SearchDataTables;
