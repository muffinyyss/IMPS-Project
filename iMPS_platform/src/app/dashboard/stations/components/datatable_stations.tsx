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
} from "@material-tailwind/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";

import AddStation, {
  NewUserPayload as NewStationPayload,
} from "@/app/dashboard/stations/components/addstations";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type stationRow = {
  id?: string;
  station_name?: string;
  SN?: string;
  WO?: string;
  model?: string;
  status?: boolean;
  brand?: string;
};

export function SearchDataTables() {
  const [data, setData] = useState<stationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [sorting, setSorting] = useState<any>([]);
  const [filtering, setFiltering] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);

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
          station_name: s.station_name ?? "-",
          SN: s.SN ?? "-",
          WO: s.WO ?? "-",
          status: !!s.status,
          model: s.model ?? "-",
          brand: s.brand ?? "-",
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

  const columns: any[] = [
    {
      id: "no",
      header: () => "No.",
      enableSorting: false,
      cell: (info: any) => {
        const pageRows = info.table.getRowModel().rows as Row<stationRow>[];
        const indexInPage = pageRows.findIndex((r) => r.id === info.row.id);
        const { pageIndex, pageSize } = info.table.getState().pagination;
        return pageIndex * pageSize + indexInPage + 1;
      },
      meta: { headerAlign: "center", cellAlign: "center" },
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
        <span className="tw-inline-flex tw-items-center tw-gap-2 tw-pr-2">
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

  // --- handlers ---
  const handleEdit = (row: stationRow) => console.log("Edit station:", row);
  const handleDelete = (row: stationRow) => {
    if (confirm(`ต้องการลบสถานี "${row.station_name}" ใช่หรือไม่?`)) {
      console.log("Delete station:", row);
    }
  };

  const handleCreateStation = async (payload: NewStationPayload) => {
    try {
      setSaving(true);
      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("accessToken") ||
        "";
      const res = await fetch(`${API_BASE}/all-stations/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      setOpenAdd(false);
    } catch (e) {
      console.error(e);
      alert("สร้างสถานีไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
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
            <div className="tw-overflow-x-auto">
              <table className="tw-table-auto tw-text-left tw-w-full tw-min-w-[800px]">
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
                          <td key={cell.id} className="!tw-border-y !tw-border-x-0">
                            <Typography
                              variant="small"
                              className="!tw-font-normal !tw-text-blue-gray-500 tw-py-4 tw-px-4"
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
    </>
  );
}

export default SearchDataTables;
