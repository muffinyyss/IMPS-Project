"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  type Row,
} from "@tanstack/react-table";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Typography,
  CardFooter,
  Input,
  Alert,
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Select,
  Option,
} from "@material-tailwind/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";

// components
import AddUser, { NewUserPayload } from "@/app/dashboard/users/components/adduser";
import { apiFetch } from "@/utils/api";

/* -------------------- Types -------------------- */
type UserRow = {
  id?: string;
  username?: string;
  email?: string;
  role?: string;
  company?: string;
  tel?: string;
  station_id?: string[];
};

export type UserUpdatePayload = {
  username?: string;
  email?: string;
  role?: string;
  company?: string;
  tel?: string;
};

type JwtClaims = {
  sub: string;
  user_id?: string;
  username?: string;
  role?: string;
  company?: string | null;
  station_ids?: string[];
  exp?: number;
};

function decodeJwt(token: string | null): JwtClaims | null {
  try {
    if (!token) return null;
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/* -------------------- Component -------------------- */
export default function SearchDataTables() {
  const router = useRouter();

  /* --- Auth state --- */
  const [authChecked, setAuthChecked] = useState(false);
  const [meRole, setMeRole] = useState<string>("user");
  const isAdmin = meRole === "admin";

  const getToken = () =>
    localStorage.getItem("access_token") ||
    localStorage.getItem("accessToken") ||
    "";

  const isTokenExpired = (token: string) => {
    const claims = decodeJwt(token);
    if (!claims?.exp) return true;
    return claims.exp <= Math.floor(Date.now() / 1000);
  };

  // ตรวจ token + ตั้ง meRole + ปักธง authChecked (และ redirect ถ้าไม่ผ่าน)
  useEffect(() => {
    const token = getToken();
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("accessToken");
      const next = encodeURIComponent(window.location.pathname);
      router.replace(`/auth/signin/basic?next=${next}`);
      return;
    }
    const claims = decodeJwt(token);
    if (claims?.role) setMeRole(claims.role);
    setAuthChecked(true);
  }, [router]);

  /* --- Table/UI states --- */
  const [data, setData] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [sorting, setSorting] = useState<any>([]);
  const [filtering, setFiltering] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [openEdit, setOpenEdit] = useState(false);
  const [editingRow, setEditingRow] = useState<UserRow | null>(null);
  const [roleValue, setRoleValue] = useState<string>("user");

  // ดึงข้อมูลผู้ใช้หลัง auth ผ่านเท่านั้น
  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      try {
        const res = await apiFetch(`/all-users/`);
        if (res.status === 401 || res.status === 403) {
          const next = encodeURIComponent(window.location.pathname);
          router.replace(`/auth/signin/basic?next=${next}`);
          return;
        }
        if (!res.ok) {
          setErr(`Fetch failed: ${res.status}`);
          setData([]);
          return;
        }
        const json = await res.json();
        const list = Array.isArray(json?.users) ? (json.users as any[]) : [];
        const rows: UserRow[] = list.map((u) => ({
          id: u.id || u._id || undefined,
          username: u.username ?? "-",
          email: u.email ?? "-",
          role: u.role ?? "-",
          company: u.company ?? "-",
          station_id: u.station_id ?? [],
          tel: u.tel ?? "-",
        }));
        setData(rows);
      } catch {
        setErr("Network/Server error");
        setData([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [authChecked, router]);

  // ตั้งค่า default role ตอนเปิด dialog แก้ไข
  useEffect(() => {
    if (openEdit && editingRow) setRoleValue(editingRow.role ?? "user");
  }, [openEdit, editingRow]);

  /* -------------------- Handlers -------------------- */
  const handleEdit = (row: UserRow) => {
    setEditingRow(row);
    setOpenEdit(true);
  };

  const handleCreateUser = async (payload: NewUserPayload) => {
    try {
      setSaving(true);
      const res = await apiFetch(`/add_users/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401 || res.status === 403) {
        const next = encodeURIComponent(window.location.pathname);
        router.replace(`/auth/signin/basic?next=${next}`);
        return;
      }
      if (res.status === 409) throw new Error("อีเมลนี้ถูกใช้แล้ว");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Create failed: ${res.status}`);
      }

      const created = await res.json();
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
      setNotice({ type: "error", msg: e.message || "สร้างผู้ใช้ไม่สำเร็จ" });
      setTimeout(() => setNotice(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  async function handleUpdateUser(id: string, payload: Partial<UserRow> & { password?: string }) {
    const body: any = {};
    if (payload.username !== undefined) body.username = payload.username?.trim();
    if (payload.email !== undefined) body.email = payload.email?.trim();
    if (payload.company !== undefined) body.company = (payload.company || "").trim();
    if (payload.role !== undefined) body.role = payload.role;
    if (payload.tel !== undefined) body.tel = payload.tel?.trim();
    if ((payload as any).password) body.password = String((payload as any).password);

    const res = await apiFetch(`/user_update/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 401 || res.status === 403) {
      const next = encodeURIComponent(window.location.pathname);
      router.replace(`/auth/signin/basic?next=${next}`);
      return;
    }

    const raw = await res.text();
    if (!res.ok) throw new Error(raw || `Update failed: ${res.status}`);

    let updated: any = {};
    try { updated = raw ? JSON.parse(raw) : {}; } catch {}

    setData(prev =>
      prev.map(u =>
        u.id === id
          ? {
              ...u,
              username: updated.username ?? u.username,
              email: updated.email ?? u.email,
              company: updated.company ?? u.company,
              role: updated.role ?? u.role,
              tel: updated.tel ?? u.tel,
            }
          : u
      )
    );

    setOpenEdit(false);
    setNotice({ type: "success", msg: "Update success" });
    setTimeout(() => setNotice(null), 2500);
  }

  const handleDelete = async (row: UserRow) => {
    if (!row.id) return alert("ไม่พบ id ของผู้ใช้");
    if (!confirm(`ต้องการลบผู้ใช้ "${row.username}" ใช่หรือไม่?`)) return;

    try {
      const res = await apiFetch(`/delete_users/${row.id}`, { method: "DELETE" });

      if (res.status === 401 || res.status === 403) {
        const next = encodeURIComponent(window.location.pathname);
        router.replace(`/auth/signin/basic?next=${next}`);
        return;
      }
      if (res.status === 404) throw new Error("ไม่พบผู้ใช้นี้");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Delete failed: ${res.status}`);
      }

      setData((prev) => prev.filter((u) => u.id !== row.id));
      setNotice({ type: "success", msg: "Delete success" });
      setTimeout(() => setNotice(null), 2500);
    } catch (e: any) {
      console.error(e);
      setNotice({ type: "error", msg: e.message || "ลบผู้ใช้ไม่สำเร็จ" });
      setTimeout(() => setNotice(null), 3500);
    }
  };

  /* -------------------- Table -------------------- */
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
        return <span className="tw-block tw-w-full">{num}</span>;
      },
    },
    { accessorFn: (r: UserRow) => r.username ?? "-", id: "username", header: () => "username", cell: (i: any) => i.getValue() },
    { accessorFn: (r: UserRow) => r.email ?? "-",    id: "email",    header: () => "email",    cell: (i: any) => i.getValue() },
    { accessorFn: (r: UserRow) => r.tel ?? "-",    id: "tel",    header: () => "tel",    cell: (i: any) => i.getValue() },
    { accessorFn: (r: UserRow) => r.company ?? "-",  id: "company",  header: () => "company",  cell: (i: any) => i.getValue() },
    { accessorFn: (r: UserRow) => r.role ?? "-",     id: "role",     header: () => "role",     cell: (i: any) => i.getValue() },
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

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: filtering, sorting },
    onSortingChange: setSorting as any,
    onGlobalFilterChange: setFiltering,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  /* -------------------- Guard while checking auth -------------------- */
  if (!authChecked) {
    return <div className="tw-p-4">Checking session…</div>;
  }

  /* -------------------- JSX -------------------- */
  return (
    <>
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8 tw-scroll-mt-4">
        {notice && (
          <div className="tw-px-4 tw-pt-4">
            <Alert color={notice.type === "success" ? "green" : "red"} onClose={() => setNotice(null)}>
              {notice.msg}
            </Alert>
          </div>
        )}

        <CardHeader
          floated={false}
          shadow={false}
          className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-gap-3 tw-!px-3 md:tw-!px-4 tw-!py-3 md:tw-!py-4 tw-mb-6"
        >
          <div className="tw-ml-3">
            <Typography color="blue-gray" variant="h5" className="tw-text-base sm:tw-text-lg md:tw-text-xl">
              Users & Roles Management
            </Typography>
            <Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-normal tw-mt-1 tw-text-xs sm:tw-text-sm">
              Manage Users: Add, Edit, or Remove users from the system.
            </Typography>
          </div>

          <div className="tw-w-full md:tw-w-auto md:tw-ml-auto md:tw-flex md:tw-justify-end">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 sm:tw-gap-3 tw-justify-end tw-w-full md:tw-w-auto md:tw-mt-6">
              <Button
                onClick={() => setOpenAdd(true)}
                size="lg"
                className="tw-h-11 tw-rounded-xl tw-px-4 tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black tw-text-white tw-shadow-[0_6px_14px_rgba(0,0,0,0.12),0_3px_6px_rgba(0,0,0,0.08)] focus-visible:tw-ring-2 focus-visible:tw-ring-blue-500/50 focus:tw-outline-none"
              >
                +add
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardBody className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-3 md:tw-px-4">
          {/* ซ้าย: page size */}
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
            <Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-normal tw-hidden sm:tw-inline">
              entries per page
            </Typography>
          </div>

          {/* ขวา: Search */}
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
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
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
                ) : (
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

      {/* Dialog: Add */}
      <AddUser open={openAdd} onClose={() => setOpenAdd(false)} onSubmit={handleCreateUser} loading={saving} />

      {/* Dialog: Edit */}
      <Dialog open={openEdit} handler={() => setOpenEdit(false)} size="md" className="tw-space-y-5 tw-px-8 tw-py-4">
        <DialogHeader className="tw-flex tw-items-center tw-justify-between">
          <Typography variant="h5" color="blue-gray">
            Edit User
          </Typography>
          <Button variant="text" onClick={() => setOpenEdit(false)}>
            ✕
          </Button>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editingRow?.id) return;

            const form = e.currentTarget as HTMLFormElement & {
              username: HTMLInputElement;
              email: HTMLInputElement;
              company: HTMLInputElement;
              tel: HTMLInputElement;
              password?: HTMLInputElement;
            };

            const payload: any = {
              username: form.username?.value?.trim(),
              email: form.email?.value?.trim(),
              company: form.company?.value?.trim(),
              tel: form.tel?.value?.trim(),
            };

            if (isAdmin) payload.role = roleValue;

            const newPw = form.password?.value?.trim();
            if (newPw) payload.password = newPw;

            try {
              await handleUpdateUser(editingRow.id!, payload);
            } catch (err: any) {
              setNotice({ type: "error", msg: err?.message || "อัปเดตไม่สำเร็จ" });
              setTimeout(() => setNotice(null), 3500);
            }
          }}
        >
          <DialogBody className="tw-space-y-6 tw-px-6 tw-py-4">
            <div className="tw-flex tw-flex-col tw-gap-4">
              <Input name="username" label="Username" defaultValue={editingRow?.username ?? ""} required />
              <Input name="email" label="Email" type="email" defaultValue={editingRow?.email ?? ""} required />
              <Input name="company" label="Company" defaultValue={editingRow?.company ?? ""} />
              <Input name="tel" label="tel" defaultValue={editingRow?.tel ?? ""} />
              {/* <Input name="password" label="New Password (optional)" type="password" /> */}

              {isAdmin && (
                <Select label="Role" value={roleValue} onChange={(v) => setRoleValue(v ?? "user")}>
                  <Option value="admin">admin</Option>
                  <Option value="owner">owner</Option>
                  <Option value="Technician">Technician</Option>
                  <Option value="user">user</Option>
                </Select>
              )}
            </div>
          </DialogBody>

          <DialogFooter className="tw-gap-2">
            <Button variant="outlined" type="button" onClick={() => setOpenEdit(false)}>
              Cancel
            </Button>
            <Button type="submit" className="tw-bg-blue-600" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
