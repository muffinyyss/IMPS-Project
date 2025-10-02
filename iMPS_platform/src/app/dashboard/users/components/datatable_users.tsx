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
  Alert
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

const API_BASE = "http://localhost:8000";

// ------------ NEW: โครงสร้างข้อมูลผู้ใช้ (แถวในตาราง) ------------
type UserRow = {
  id?: string;
  _id?: string;                  // เผื่อ backend ยังส่ง _id มา
  username?: string;
  email?: string;
  role?: string;
  company?: string;
  station_id?: string[] | string;
  tel?: string;                  // ถ้ายังไม่มีใน DB จะโชว์ "-"
};

// ใช้ type ของข้อมูลแถวจาก AppDataTable โดยตรง
type TData = (typeof AppDataTable)[number];

export function SearchDataTables() {
  // ------------ NEW: data/โหลด/เออเรอร์ ------------
  const [data, setData] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [sorting, setSorting] = useState<any>([]);
  const [filtering, setFiltering] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  // ------------ NEW: ดึงข้อมูลผู้ใช้จาก FastAPI ------------
  useEffect(() => {
    (async () => {
      try {
        const token =
          localStorage.getItem("access_token") ||
          localStorage.getItem("accessToken") ||
          "";
        // const res = await fetch('/api/all-users/', { cache: 'no-store' });

        const res = await fetch(`${API_BASE}/all-users/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          setErr("Unauthorized (401) – กรุณาเข้าสู่ระบบอีกครั้ง");
          setData([]);
          return;
        }
        if (!res.ok) {
          setErr(`Fetch failed: ${res.status}`);
          setData([]);
          return;
        }

        const json = await res.json();
        const list = Array.isArray(json?.users) ? (json.users as any[]) : [];
        // แปลง _id -> id (ถ้ามี), กัน type แปลก ๆ
        const rows: UserRow[] = list.map((u) => ({
          id: u.id || u._id || undefined,
          _id: undefined, // ไม่ใช้ _id ต่อจากนี้แล้ว
          username: u.username ?? "-",
          email: u.email ?? "-",
          role: u.role ?? "-",
          company: u.company ?? "-",
          station_id: u.station_id ?? [],
          tel: u.tel ?? "-", // ถ้าไม่มีใน DB จะแสดง "-"
        }));
        setData(rows);
      } catch (e) {
        console.error(e);
        setErr("Network/Server error");
        setData([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCreateUser = async (payload: NewUserPayload) => {
    try {
      setSaving(true);

      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("accessToken") ||
        "";

      const res = await fetch(`${API_BASE}/add_users/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) throw new Error("อีเมลนี้ถูกใช้แล้ว");
      if (res.status === 401) throw new Error("กรุณาเข้าสู่ระบบใหม่");
      if (res.status === 403) throw new Error("สิทธิ์ไม่เพียงพอ");
      if (!res.ok) {
        const text = await res.text();
        console.error("Create user failed:", res.status, text);
        alert(text || `Create failed: ${res.status}`);
        return;
      }

      const created = await res.json(); // { id, username, email, role, company, station_id, ... }

      // ✅ อัปเดตตารางทันที
      setData((prev) => [
        {
          id: created.id,
          username: created.username,
          email: created.email,
          role: created.role,
          company: created.company ?? "-",
          station_id: created.station_id ?? [],
          tel: created.tel ?? "-",
        },
        ...prev,
      ]);

      setOpenAdd(false);
      setNotice({ type: "success", msg: "Create success" });
      setTimeout(() => setNotice(null), 3000);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "สร้างผู้ใช้ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const handleEdit = (row: UserRow) => {
    console.log("Edit user:", row);
    // TODO: เปิด modal แก้ไข / นำทางไปหน้าแก้ไข
  };

  const handleDelete = async (row: UserRow) => {
    if (!row.id) return alert("ไม่พบ id ของผู้ใช้");

    if (!confirm(`ต้องการลบผู้ใช้ "${row.username}" ใช่หรือไม่?`)) {
      return;
    }

    try {
      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("accessToken") ||
        "";

      // ถ้า backend มี prefix /api ให้เปลี่ยนเป็น `${API_BASE}/api/users/${row.id}`
      const res = await fetch(`${API_BASE}/delete_users/${row.id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 401) throw new Error("กรุณาเข้าสู่ระบบใหม่");
      if (res.status === 403) throw new Error("สิทธิ์ไม่เพียงพอ");
      if (res.status === 404) throw new Error("ไม่พบผู้ใช้นี้");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Delete failed: ${res.status}`);
      }

      // ลบออกจากตาราง
      setData((prev) => prev.filter((u) => u.id !== row.id));

      // แจ้งสำเร็จ
      setNotice({ type: "success", msg: "Delete success" });
      setTimeout(() => setNotice(null), 2500);
    } catch (e: any) {
      console.error(e);
      setNotice({ type: "error", msg: e.message || "ลบผู้ใช้ไม่สำเร็จ" });
      setTimeout(() => setNotice(null), 3500);
    }
  };

  // ------------ columns: ปรับ accessor ให้ตรงกับฟิลด์จริง ------------
  const columns: any[] = [
    {
      accessorFn: (_row: UserRow, index: number) => index + 1,
      id: "no",
      header: () => "No.",
      enableSorting: true,
      sortingFn: "basic",
      sortDescFirst: true,
      cell: (info: any) => {
        const isSortingByNo = info.table.getState().sorting?.[0]?.id === "no";

        let num: number;
        if (isSortingByNo) {
          num = Number(info.getValue());
        } else {
          const pageRows = info.table.getRowModel().rows as Row<UserRow>[];
          const indexInPage = pageRows.findIndex((r) => r.id === info.row.id);
          const { pageIndex, pageSize } = info.table.getState().pagination;
          num = pageIndex * pageSize + indexInPage + 1;
        }

        // ทำให้ข้อความใน cell อยู่กึ่งกลาง
        return <span className="tw-block tw-w-full">{num}</span>;
      },
    },
    {
      accessorFn: (row: UserRow) => row.username ?? "-",
      id: "username",
      header: () => "username",
      cell: (info: any) => info.getValue(),
    },
    {
      accessorFn: (row: UserRow) => row.email ?? "-",
      id: "email",
      header: () => "email",
      cell: (info: any) => info.getValue(),
    },
    {
      accessorFn: (row: UserRow) => row.tel ?? "-",
      id: "tel",
      header: () => "tel",
      cell: (info: any) => info.getValue(),
    },
    {
      accessorFn: (row: UserRow) => row.company ?? "-",
      id: "company",
      header: () => "company",
      cell: (info: any) => info.getValue(),
    },
    {
      accessorFn: (row: UserRow) => row.role ?? "-",
      id: "role",
      header: () => "role",
      cell: (info: any) => info.getValue(),
    },
    {
      accessorFn: (row: UserRow) =>
        Array.isArray(row.station_id)
          ? row.station_id.join(", ")
          : (row.station_id ?? "-"),
      id: "stations",
      header: () => "stations",
      cell: (info: any) => info.getValue(),
    },
    {
      id: "actions",
      header: () => "actions",
      enableSorting: false,
      size: 80,
      cell: ({ row }: { row: Row<UserRow> }) => (
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
    },
  ];



  // 

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter: filtering,
      sorting: sorting,
    },
    onSortingChange: setSorting as any,
    onGlobalFilterChange: setFiltering,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <>
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
        {notice && (
          <div className="tw-px-4 tw-pt-4">
            <Alert
              color={notice.type === "success" ? "green" : "red"}
              onClose={() => setNotice(null)}
            >
              {notice.msg}
            </Alert>
          </div>
        )}
        <CardHeader
          floated={false}
          shadow={false}
          className="tw-flex tw-flex-col md:tw-flex-row
            tw-items-start md:tw-items-center tw-gap-3
            tw-!px-3 md:tw-!px-4      /* padding เหมือนเดิม */
            tw-!py-3 md:tw-!py-4
            tw-mb-6">
          <div className="tw-ml-3">
            <Typography color="blue-gray" variant="h5" className="tw-text-base sm:tw-text-lg md:tw-text-xl">
              Users & Roles Management
            </Typography>
            <Typography
              variant="small"
              className="!tw-text-blue-gray-500 !tw-font-normal tw-mt-1 tw-text-xs sm:tw-text-sm"
            >
              Manage Users: Add, Edit, or Remove users from the system.
            </Typography>
          </div>

          <div className="tw-w-full md:tw-w-auto md:tw-ml-auto md:tw-flex md:tw-justify-end">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 sm:tw-gap-3 tw-justify-end tw-w-full md:tw-w-auto md:tw-mt-6">
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
            </div>
          </div>

        </CardHeader>

        <CardBody
          className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-3 md:tw-px-4">
          {/* ซ้าย: dropdown + label (ขนาดคงที่) */}
          <div className="tw-flex tw-items-center tw-gap-3 tw-flex-none">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="tw-border tw-p-2 tw-border-blue-gray-100 tw-rounded-lg tw-w-[72px]"
            >
              {[5, 10, 15, 20, 25].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
            <Typography
              variant="small"
              className="!tw-text-blue-gray-500 !tw-font-normal tw-hidden sm:tw-inline"
            >
              entries per page
            </Typography>
          </div>

          {/* ขวา: Search (ยืด/หดได้ และชิดขวา) */}
          <div className="tw-ml-auto tw-min-w-0 tw-flex-1 md:tw-flex-none md:tw-w-64">
            <Input
              variant="outlined"
              value={filtering}
              onChange={(e) => setFiltering(e.target.value)}
              label="Search"
              crossOrigin={undefined}
              containerProps={{ className: "tw-min-w-0" }} // ให้หดได้ใน flex
              className="tw-w-full"
            />
          </div>
        </CardBody>
        <CardFooter className="tw-p-0 tw-overflow-scroll">
          {loading ? (
            <div className="tw-p-4">Loading...</div>
          ) : err ? (
            <div className="tw-p-4 tw-text-red-600">{err}</div>
          ) : (
            <table className="tw-table-auto tw-text-left tw-w-full tw-min-w-max">
              <thead className="tw-bg-gray-50">
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
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ChevronUpDownIcon strokeWidth={2} className="tw-h-4 tw-w-4" />
                        </Typography>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length
                  ? table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="odd:tw-bg-white even:tw-bg-gray-50">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="!tw-border-y !tw-border-x-0">
                          <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-500 tw-py-4 tw-px-4">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </Typography>
                        </td>
                      ))}
                    </tr>
                  ))
                  : (
                    <tr>
                      <td className="tw-px-4 tw-py-6 tw-text-center" colSpan={columns.length}>
                        ไม่พบผู้ใช้
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          )}
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
