"use client";

import React, { useEffect, useState } from "react";
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
  Switch,
  Alert,
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter
} from "@material-tailwind/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";

import AddStation, {
  NewStationPayload,
} from "@/app/dashboard/stations/components/addstations";

const API_BASE = "http://localhost:8000";

type stationRow = {
  id?: string;
  station_id?: string;
  station_name?: string;
  SN?: string;
  WO?: string;
  model?: string;
  status?: boolean;
  brand?: string;
  user_id?: string;
  username?: string;
};

export type StationUpdatePayload = {
  station_id?: string;
  station_name?: string;
  username?: string;
  brand?: string;
  model?: string;
  SN?: string; // API ใช้ตัวเล็ก
  WO?: string; // API ใช้ตัวเล็ก
};

export function SearchDataTables() {
  const [data, setData] = useState<stationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [sorting, setSorting] = useState<any>([]);
  const [filtering, setFiltering] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [openEdit, setOpenEdit] = useState(false);
  const [editingRow, setEditingRow] = useState<stationRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token =
          localStorage.getItem("access_token") ||
          localStorage.getItem("accessToken") ||
          "";

        const res = await fetch(`${API_BASE}/all-stations/`, {
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
        const list = Array.isArray(json?.stations) ? (json.stations as any[]) : [];
        const rows: stationRow[] = list.map((s) => ({
          id: s.id || s._id || undefined,
          station_id: s.station_id ?? "-",
          station_name: s.station_name ?? "-",
          SN: s.SN ?? "-",
          WO: s.WO ?? "-",
          status: !!s.status,
          // status: typeof s.status === "boolean" ? s.status : true,
          model: s.model ?? "-",
          brand: s.brand ?? "-",
          user_id: s.user_id ?? ""
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

  const handleCreateStation = async (payload: NewStationPayload) => {
    try {
      setSaving(true);

      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("accessToken") ||
        "";

      const res = await fetch(`${API_BASE}/add_stations/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) throw new Error("staion_idนี้ถูกใช้แล้ว");
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
          station_id: created.station_id,
          station_name: created.station_name,
          brand: created.brand,
          model: created.model,
          SN: created.SN,
          WO: created.WO,
        },
        ...prev,
      ]);

      setOpenAdd(false);
      setNotice({ type: "success", msg: "Create success" });
      setTimeout(() => setNotice(null), 3000);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "สร้างสถานีไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  // --- handlers ---
  // const handleEdit = (row: stationRow) => console.log("Edit station:", row);
  const handleEdit = (row: stationRow) => {
    setEditingRow(row);
    setOpenEdit(true);
  };

  const handleUpdateStation = async (id: string, payload: StationUpdatePayload) => {
    try {
      setSaving(true);

      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("accessToken") || "";

      const res = await fetch(`${API_BASE}/update_stations/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();            // 👈 อ่านเป็น text ก่อน
      if (!res.ok) {
        throw new Error(raw || `Update failed: ${res.status}`);
      }

      let updated: any = {};
      try { updated = raw ? JSON.parse(raw) : {}; } catch { /* ไม่เป็น JSON ก็ข้าม */ }

      // อัปเดตตารางแบบยืดหยุ่นคีย์ SN/WO
      setData(prev =>
        prev.map(r =>
          r.id === id
            ? {
              ...r,
              station_id: updated.station_id ?? r.station_id,
              station_name: updated.station_name ?? r.station_name,
              brand: updated.brand ?? r.brand,
              model: updated.model ?? r.model,
              SN: updated.SN ?? r.SN,
              WO: updated.WO ?? r.WO,
              // status: typeof updated.status === "boolean" ? updated.status : r.status,
            }
            : r
        )
      );

      setOpenEdit(false);
      setNotice({ type: "success", msg: "Update success" });
      setTimeout(() => setNotice(null), 2500);
    } catch (e: any) {
      console.error("PATCH /update_stations error:", e);
      setNotice({ type: "error", msg: e?.message || "อัปเดตไม่สำเร็จ" });
      setTimeout(() => setNotice(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: stationRow) => {
    if (!row.id) return alert("ไม่พบ id ของสถานี");

    if (!confirm(`ต้องการลบผู้ใช้ "${row.station_name}" ใช่หรือไม่?`)) {
      return;
    }

    try {
      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("accessToken") ||
        "";

      // ถ้า backend มี prefix /api ให้เปลี่ยนเป็น `${API_BASE}/api/users/${row.id}`
      const res = await fetch(`${API_BASE}/delete_stations/${row.id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 401) throw new Error("กรุณาเข้าสู่ระบบใหม่");
      if (res.status === 403) throw new Error("สิทธิ์ไม่เพียงพอ");
      if (res.status === 404) throw new Error("ไม่พบสถานีนี้");
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
      setNotice({ type: "error", msg: e.message || "ลบสานีไม่สำเร็จ" });
      setTimeout(() => setNotice(null), 3500);
    }

  };

  // const handleCreateStation = async (payload: NewStationPayload) => {
  //   try {
  //     setSaving(true);
  //     const token =
  //       localStorage.getItem("access_token") ||
  //       localStorage.getItem("accessToken") ||
  //       "";
  //     const res = await fetch(`${API_BASE}/all-stations/`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${token}`,
  //       },
  //       body: JSON.stringify(payload),
  //     });
  //     if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  //     setOpenAdd(false);
  //   } catch (e) {
  //     console.error(e);
  //     alert("สร้างสถานีไม่สำเร็จ");
  //   } finally {
  //     setSaving(false);
  //   }
  // };


  const columns: any[] = [
    {
      accessorFn: (_row: stationRow, index: number) => index + 1,
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
          const pageRows = info.table.getRowModel().rows as Row<stationRow>[];
          const indexInPage = pageRows.findIndex((r) => r.id === info.row.id);
          const { pageIndex, pageSize } = info.table.getState().pagination;
          num = pageIndex * pageSize + indexInPage + 1;
        }

        // ทำให้ข้อความใน cell อยู่กึ่งกลาง
        return <span className="tw-block tw-w-full">{num}</span>;
      },
    },
    {
      accessorFn: (row: stationRow) => row.station_id ?? "-",
      id: "station_id",
      cell: (info: any) => info.getValue(),
      header: () => "station id",
    },
    {
      accessorFn: (row: stationRow) => row.username ?? "-",
      id: "username",
      cell: (info: any) => info.getValue(),
      header: () => "Username",
    },
    {
      accessorFn: (row: stationRow) => row.station_name ?? "-",
      id: "station_name",
      cell: (info: any) => info.getValue(),
      header: () => "station name",
    },
    {
      accessorFn: (row: stationRow) => row.brand ?? "-",
      id: "brand",
      cell: (info: any) => info.getValue(),
      header: () => "brand",
    },
    {
      accessorFn: (row: stationRow) => row.model ?? "-",
      id: "model",
      cell: (info: any) => info.getValue(),
      header: () => "model",
    },
    {
      accessorFn: (row: stationRow) => row.SN ?? "-",
      id: "SN",
      cell: (info: any) => info.getValue(),
      header: () => "serial number",
    },
    {
      accessorFn: (row: stationRow) => row.WO ?? "-",
      id: "WO",
      cell: (info: any) => info.getValue(),
      header: () => "work order",
    },
    {
      id: "status",
      header: () => "status",
      enableSorting: false,
      meta: { headerAlign: "center", cellAlign: "center" },
      cell: ({ row }: { row: Row<stationRow> }) => {
        const id = row.original.id;
        const checked = !!row.original.status;

        const toggle = async () => {
          const newVal = !checked;
          setData((prev) => prev.map((r) => (r.id === id ? { ...r, status: newVal } : r)));
        };

        return (
          <div className="tw-flex tw-justify-center">
            <Switch checked={checked} onChange={toggle} />
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => "actions",
      enableSorting: false,
      size: 80,
      cell: ({ row }: { row: Row<stationRow> }) => (
        <span className="tw-inline-flex tw-items-center tw-justify-center tw-gap-2 tw-w-full">
          <button
            title="Edit station"
            onClick={() => handleEdit(row.original)}
            className="tw-rounded tw-p-1 tw-border tw-border-blue-gray-100 hover:tw-bg-blue-50 tw-transition"
          >
            <PencilSquareIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-700" />
          </button>
          <button
            title="Delete station"
            onClick={() => handleDelete(row.original)}
            className="tw-rounded tw-p-1 tw-border tw-border-blue-gray-100 hover:tw-bg-red-50 tw-transition"
          >
            <TrashIcon className="tw-h-5 tw-w-5 tw-text-red-600" />
          </button>
        </span>
      ),
    },
  ];

  // กำหนดความกว้างพื้นฐานของแต่ละคอลัมน์ (ปรับเลขได้ตามใจ)
  const COL_W: Record<string, string> = {
    no: "tw-w-[56px]",            // เลขลำดับ
    station_id: "tw-w-[140px]",
    username: "tw-w-[120px]",
    station_name: "tw-w-[260px]", // ชื่อสถานีมักยาว => ให้กว้างหน่อย
    brand: "tw-w-[120px]",
    model: "tw-w-[100px]",
    SN: "tw-w-[140px]",
    WO: "tw-w-[140px]",
    status: "tw-w-[96px]",
    actions: "tw-w-[96px]",
  };

  // ⬇️ วางไว้เหนือ const columns
  const COL_W_MD: Record<string, string> = {
    no: "md:tw-w-[56px]",
    station_id: "md:tw-w-[140px]",
    username: "md:tw-w-[120px]",
    station_name: "md:tw-w-[260px]",
    brand: "md:tw-w-[120px]",
    model: "md:tw-w-[100px]",
    SN: "md:tw-w-[140px]",
    WO: "md:tw-w-[140px]",
    status: "md:tw-w-[96px]",
    actions: "md:tw-w-[96px]",
  };



  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: filtering, sorting },
    // @ts-ignore
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
              Station Management
            </Typography>
            <Typography
              variant="small"
              className="!tw-text-blue-gray-500 !tw-font-normal tw-mt-1 tw-text-xs sm:tw-text-sm"
            >
              Manage Stations: Add or Edit stations from the system.
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
                  hover:tw-to-black tw-text-white
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

        {/* ==== ตาราง: responsive + zebra ==== */}
        <CardFooter className="tw-p-0">
          {loading ? (
            <div className="tw-p-4">Loading...</div>
          ) : err ? (
            <div className="tw-p-4 tw-text-red-600">{err}</div>
          ) : (
            // ทำให้ responsive: ครอบด้วย overflow-x-auto และกำหนด min-width ที่ table
            <div className="tw-overflow-x-auto md:tw-overflow-x-hidden">
              <table className="tw-w-full tw-table-auto md:tw-table-fixed tw-min-w-[1000px] md:tw-min-w-0">
                <thead className="tw-bg-gray-50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                          className={`tw-p-4 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium tw-text-center tw-whitespace-nowrap
                          ${COL_W_MD[header.column.id] ?? ""}`}
                        >
                          <Typography
                            color="blue-gray"
                            className={`tw-flex tw-items-center tw-gap-2 tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40
                              ${header.column.getCanSort() ? "tw-justify-between" : "tw-justify-center"}`}
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
                      // สลับสีแถว (zebra)
                      <tr key={row.id} className="odd:tw-bg-white even:tw-bg-gray-50">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className={`!tw-border-y !tw-border-x-0 ${COL_W_MD[cell.column.id] ?? ""} tw-align-top`}>
                            <Typography
                              variant="small"
                              className="!tw-font-normal !tw-text-blue-gray-500 tw-py-3 tw-px-3 tw-block tw-whitespace-nowrap md:tw-whitespace-normal md:tw-break-words"
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </Typography>
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="tw-px-4 tw-py-6 tw-text-center" colSpan={columns.length}>
                        ไม่พบสถานี
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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

      <AddStation
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSubmit={handleCreateStation}
        loading={saving}
      />

      <Dialog open={openEdit} handler={() => setOpenEdit(false)} size="md" className="tw-space-y-5 tw-px-8 tw-py-4">
        <DialogHeader className="tw-flex tw-items-center tw-justify-between">
          <Typography variant="h5" color="blue-gray">Edit Station</Typography>
          <Button variant="text" onClick={() => setOpenEdit(false)}>✕</Button>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editingRow?.id) return;

            // map ชื่อฟิลด์ UI → API (SN/WO → sn/wo)
            const formEl = e.currentTarget as HTMLFormElement;
            const formData = new FormData(formEl);

            const payload: StationUpdatePayload = {
              station_name: String(formData.get("station_name") || "").trim(),
              brand: String(formData.get("brand") || "").trim(),
              model: String(formData.get("model") || "").trim(),
              SN: String(formData.get("SN") || "").trim(),
              WO: String(formData.get("WO") || "").trim(),
              // ถ้าจะให้แก้ station_id ด้วย ให้ใส่: station_id: String(formData.get("station_id")||"").trim(),
            };

            await handleUpdateStation(editingRow.id, payload);
          }}
        >
          <DialogBody className="tw-space-y-6 tw-px-6 tw-py-4">
            <div className="tw-flex tw-flex-col tw-gap-4">
              <Input
                name="station_id"
                label="Station ID (read-only)"
                value={editingRow?.station_id ?? ""}
                crossOrigin={undefined}
                disabled
              />
              <Input
                name="station_name"
                label="Station Name"
                required
                defaultValue={editingRow?.station_name ?? ""}
                crossOrigin={undefined}
              />
              <Input
                name="brand"
                label="Brand"
                required
                defaultValue={editingRow?.brand ?? ""}
                crossOrigin={undefined}
              />
              <Input
                name="model"
                label="Model"
                required
                defaultValue={editingRow?.model ?? ""}
                crossOrigin={undefined}
              />
              <Input
                name="SN"
                label="S/N"
                required
                defaultValue={editingRow?.SN ?? ""}
                crossOrigin={undefined}
              />
              <Input
                name="WO"
                label="WO"
                required
                defaultValue={editingRow?.WO ?? ""}
                crossOrigin={undefined}
              />
            </div>
          </DialogBody>

          <DialogFooter className="tw-gap-2">
            <Button variant="outlined" type="button" onClick={() => setOpenEdit(false)}>Cancel</Button>
            <Button type="submit" className="tw-bg-blue-600" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

export default SearchDataTables;
