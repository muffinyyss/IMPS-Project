"use client";

import React, { useEffect, useState, useMemo } from "react";
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

import AddStation, {
  NewStationForm,
} from "@/app/dashboard/stations/components/addstations";

import { apiFetch } from "@/utils/api";

const API_BASE = "http://localhost:8000";

type stationRow = {
  id?: string;
  station_id?: string;
  station_name?: string;
  SN?: string;
  WO?: string;
  model?: string;
  status?: boolean;
  // status?: string;
  is_active?: boolean;
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
  status?: boolean;
  is_active?: boolean;
  // status?: string;
  user_id?: string;
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

//owner
type UsernamesResp = { username: string[] };

type Owner = { user_id: string; username: string };
type OwnersResp = { owners: Owner[] };

export function SearchDataTables() {
  const [me, setMe] = useState<{ user_id: string; username: string; role: string; } | null>(null);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");

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
  const [owner, setOwner] = useState(editingRow?.username ?? "");
  const [statusStr, setStatusStr] = useState("false");
  const [activeStr, setActiveStr] = useState("false");

  useEffect(() => {
    (async () => {
      if (me?.role !== "admin") return;
      const token = localStorage.getItem("access_token") || localStorage.getItem("accessToken") || "";
      const res = await apiFetch(`${API_BASE}/owners`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // if (!res.ok) return;
      // const json: OwnersResp = await res.json();
      // setOwners(Array.isArray(json.owners) ? json.owners : []);
      const json = await res.json();
      setOwners(Array.isArray(json.owners) ? json.owners : []);
    })();
  }, [me?.role]);

  useEffect(() => {
    (async () => {
      if (me?.role !== "admin") return;
      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("accessToken") || "";
      const res = await fetch(`${API_BASE}/username`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json: UsernamesResp = await res.json();
      setUsernames(Array.isArray(json.username) ? json.username : []);
    })();
  }, [me?.role]);

  async function fetchStatuses(ids: string[], token: string): Promise<Record<string, boolean>> {
    if (!ids.length) return {};
    const res = await apiFetch(`${API_BASE}/station-onoff/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ station_ids: ids }),
    });
    if (!res.ok) {
      console.warn("fetchStatuses failed:", res.status);
      return {};
    }
    const json = await res.json(); // { status: { [station_id]: boolean } }
    return json?.status ?? {};
  }

  useEffect(() => {
    (async () => {
      try {
        const token =
          localStorage.getItem("access_token") ||
          localStorage.getItem("accessToken") ||
          "";

        // ⬇️ ถอด JWT เอา role/บริษัท ฯลฯ
        const claims = decodeJwt(token);
        if (claims) {
          setMe({ user_id: claims.user_id ?? "-", username: claims.username ?? "-", role: claims.role ?? "user" });
        }

        const res = await apiFetch(`${API_BASE}/all-stations/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // if (res.status === 401) {
        //   setErr("Unauthorized (401) – กรุณาเข้าสู่ระบบอีกครั้ง");
        //   setData([]);
        //   return;
        // }
        if (!res.ok) {
          setErr(`Fetch failed: ${res.status}`);
          setData([]);
          return;
        }

        const json = await res.json();
        const list = Array.isArray(json?.stations) ? (json.stations as any[]) : [];
        const baseRows: stationRow[] = list.map((s) => ({
          id: s.id || s._id || undefined,
          station_id: s.station_id ?? "-",
          station_name: s.station_name ?? "-",
          SN: s.SN ?? "-",
          WO: s.WO ?? "-",
          // status: s.status ?? "-",
          // status: !!s.status,
          is_active: !!s.is_active,
          // status: typeof s.status === "boolean" ? s.status : true,
          status: typeof s.status === "boolean" ? s.status : undefined,
          model: s.model ?? "-",
          brand: s.brand ?? "-",
          user_id: s.user_id ?? "",
          username: s.username ?? ""
        }));
        const ids = baseRows.map(r => r.station_id!).filter(Boolean);
        const statusMap = await fetchStatuses(ids, token);

        // merge
        const rows: stationRow[] = baseRows.map(r => ({
          ...r,
          status: !!statusMap[r.station_id ?? ""],   // ใช้ status จาก DB stationOnOff
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


  type NewStationPayload = {
    station_id: string;
    station_name: string;
    brand: string;
    model: string;
    SN: string;
    WO: string;
    user_id: string;
    is_active: boolean;
  };

  // ทำให้ชื่อคอลเลกชันปลอดภัย: แทนที่ช่องว่างเป็น "_", ตัดอักขระแปลก ๆ
  const sanitizeStationId = (s: string) =>
    s.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "_");

  const isValidStationId = (s: string) => /^[A-Za-z0-9_]+$/.test(s);

  const ownerMap = useMemo(
    () => new Map(owners.map(o => [String(o.user_id), o.username])),
    [owners]
  );
  const handleCreateStation = async (payload: NewStationForm) => {
    try {
      setSaving(true);

      // sanitize ฝั่ง client ให้ตรงกับกติกา backend
      const sanitizedId = sanitizeStationId(payload.station_id);
      if (!sanitizedId || !isValidStationId(sanitizedId)) {
        throw new Error("station_id ต้องเป็นตัวอักษร/ตัวเลข/ขีดล่างเท่านั้น");
      }
      const user_id = owners.find(o => o.username === payload.owner)?.user_id
        ?? me?.user_id
        ?? "";

      const body: NewStationPayload = {
        ...payload,
        station_id: sanitizedId,
        station_name: payload.station_name.trim(),
        brand: payload.brand.trim(),
        model: payload.model.trim(),
        SN: payload.SN.trim(),
        WO: payload.WO.trim(),
        user_id: user_id,
        is_active: !!payload.is_active,
      };

      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("accessToken") ||
        "";

      const res = await apiFetch(`${API_BASE}/add_stations/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      // จัดการสถานะยอดฮิตก่อน
      if (res.status === 409) throw new Error("station_id นี้ถูกใช้แล้ว");
      if (res.status === 401) throw new Error("กรุณาเข้าสู่ระบบใหม่");
      if (res.status === 403) throw new Error("สิทธิ์ไม่เพียงพอ");

      // รองรับ 422 (Pydantic validation error) และเคสอื่น ๆ
      if (!res.ok) {
        let detail = "";
        try {
          const err = await res.json();
          // FastAPI อาจส่ง {detail: "..."} หรือ {detail: [{loc:..., msg:...}, ...]}
          if (typeof err?.detail === "string") detail = err.detail;
          else if (Array.isArray(err?.detail))
            detail = err.detail.map((d: any) => d?.msg || "").join("\n");
        } catch {
          // ถ้า parse json ไม่ได้ ให้ fallback เป็น text
          detail = await res.text();
        }
        throw new Error(detail || `Create failed: ${res.status}`);
      }

      const created = await res.json(); // { id, station_id, station_name, brand, model, SN, WO }
      const createdUserId = String(created.user_id ?? user_id);
      const createdUsername =
        created.username                                 // ถ้า backend คืนมาก็ใช้เลย
        ?? ownerMap.get(createdUserId)                   // map จาก owners ที่โหลดไว้
        ?? payload.owner                                 // ชื่อที่ผู้ใช้เลือกในฟอร์ม (กรณี admin)
        ?? me?.username                                  // กรณีผู้ใช้ทั่วไป สถานีเป็นของตัวเอง
        ?? "-";
      // ✅ อัปเดตตารางทันที (prepend)
      setData((prev) => [
        {
          id: created.id,
          station_id: created.station_id,
          station_name: created.station_name,
          brand: created.brand,
          model: created.model,
          SN: created.SN,
          WO: created.WO,
          user_id: created.user_id,
          username: createdUsername,
          is_active: created.is_active
        },
        ...prev,
      ]);

      setOpenAdd(false);
      setNotice({ type: "success", msg: "Create success" });
      setTimeout(() => setNotice(null), 3000);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "สร้างสถานีไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };



  const handleEdit = (row: stationRow) => {
    if (!isAdmin && row.user_id !== me?.user_id) {
      alert("ไม่มีสิทธิ์แก้ไขสถานีนี้");
      return;
    }
    setEditingRow(row);
    setStatusStr((row.status ?? false) ? "true" : "false");
    setActiveStr((row.is_active ?? false) ? "true" : "false");
    setSelectedOwnerId(row.user_id ?? "");
    setOpenEdit(true);
  };

  const handleUpdateStation = async (id: string, payload: StationUpdatePayload) => {
    try {
      setSaving(true);

      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("accessToken") || "";

      const res = await apiFetch(`${API_BASE}/update_stations/${id}`, {
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
      try { updated = raw ? JSON.parse(raw) : {}; } catch { }

      const fallbackUserId = isAdmin ? payload.user_id : undefined;
      const newUserId =
        updated.user_id ?? fallbackUserId ?? editingRow?.user_id ?? "";

      const newUsername =
        // ถ้า backend ส่งมาก็ใช้เลย
        (typeof updated.username === "string" ? updated.username : undefined) ??
        // ถ้าไม่ส่งมา ให้ map จาก owners ตาม user_id ที่เลือก
        owners.find(o => o.user_id === newUserId)?.username ??
        // ไม่งั้นคงค่าเดิม
        editingRow?.username ?? "";

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
              // status:
              //   typeof updated.status === "boolean"
              //     ? updated.status
              //     : typeof payload.status === "boolean"
              //       ? payload.status
              //       : r.status,
              is_active:
                typeof updated.is_active === "boolean"
                  ? updated.is_active
                  : typeof payload.is_active === "boolean"
                    ? payload.is_active
                    : r.is_active,
              // ✅ อัปเดต owner ให้ตรงทั้งคู่
              user_id: newUserId,
              username: newUsername,
            }
            : r
        )
      );
      setEditingRow(prev => prev ? { ...prev, user_id: newUserId, username: newUsername } : prev);
      setSelectedOwnerId(newUserId || "");

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
  console.log("ME", me)
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
      const res = await apiFetch(`${API_BASE}/delete_stations/${row.id}`, {
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

  const isAdmin = me?.role === "admin";

  const roClass = !isAdmin
    ? "!tw-bg-gray-100 !tw-text-blue-gray-500 tw-cursor-not-allowed focus:tw-ring-0 focus:tw-border-blue-gray-200"
    : "";

  const roLabel = !isAdmin ? { className: "!tw-text-blue-gray-400" } : {};


  const columns: any[] = useMemo(() => [
    {
      id: "status",
      header: () => "status",
      accessorFn: (row: stationRow) => !!row.status,
      cell: ({ row }: { row: Row<stationRow> }) => {
        const on = !!row.original.status;
        return (
          <span className={`
        tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-px-2.5 tw-py-0.5
        tw-text-xs tw-font-semibold
      `}>
            <span className={`tw-inline-block tw-h-3 tw-w-3 tw-rounded-full
          ${on ? "tw-bg-green-600" : "tw-bg-red-600"}`} />
          </span>
        );
      },
    },

    {
      accessorFn: (row: stationRow) => row.station_id ?? "-",
      id: "station_id",
      cell: (info: any) => info.getValue(),
      header: () => "station id",
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
      accessorFn: (row: stationRow) => row.username ?? "-",
      id: "username",
      cell: (info: any) => info.getValue(),
      header: () => "owner",
    },

    {
      id: "is_active",
      header: () => "is_active",
      accessorFn: (row: stationRow) => !!row.is_active,
      cell: ({ row }: { row: Row<stationRow> }) => {
        const on = !!row.original.is_active;
        return (
          <span className={`
        tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-px-2.5 tw-py-0.5
        tw-text-xs tw-font-semibold
        ${on ? "tw-bg-green-100 tw-text-green-700" : "tw-bg-red-100 tw-text-red-700"}
      `}>
            <span className={`tw-inline-block tw-h-1.5 tw-w-1.5 tw-rounded-full
          ${on ? "tw-bg-green-600" : "tw-bg-red-600"}`} />
            {on ? "active" : "inactive"}
          </span>
        );
      },
    },

    {
      id: "actions",
      header: () => "actions",
      enableSorting: false,
      size: 80,
      cell: ({ row }: { row: Row<stationRow> }) => {
        const canEdit = isAdmin || row.original.user_id === me?.user_id;
        return (
          <span className="tw-inline-flex tw-items-center tw-justify-center tw-gap-2 tw-w-full">
            {canEdit && (
              <button
                title="Edit station"
                onClick={() => handleEdit(row.original)}
                className="tw-rounded tw-p-1 tw-border tw-border-blue-gray-100 hover:tw-bg-blue-50 tw-transition"
              >
                <PencilSquareIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-700" />
              </button>
            )}

            {/* ปุ่มลบเฉพาะ admin */}
            {isAdmin && (
              <button
                title="Delete station"
                onClick={() => handleDelete(row.original)}
                className="tw-rounded tw-p-1 tw-border tw-border-blue-gray-100 hover:tw-bg-red-50 tw-transition"
              >
                <TrashIcon className="tw-h-5 tw-w-5 tw-text-red-600" />
              </button>
            )}
          </span>
        );
      },
    },
  ], [me]);

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
    // status: "tw-w-[96px]",
    actions: "tw-w-[96px]",
  };

  const COL_W_MD: Record<string, string> = {
    no: "md:tw-w-[56px]",
    station_id: "md:tw-w-[140px]",
    username: "md:tw-w-[120px]",
    station_name: "md:tw-w-[260px]",
    brand: "md:tw-w-[120px]",
    model: "md:tw-w-[100px]",
    SN: "md:tw-w-[140px]",
    WO: "md:tw-w-[140px]",
    // status: "md:tw-w-[96px]",
    actions: "md:tw-w-[96px]",
  };

  const COL_W_LG: Record<string, string> = {
    no: "lg:tw-w-[56px]",
    station_id: "lg:tw-w-[140px]",
    username: "lg:tw-w-[120px]",
    station_name: "lg:tw-w-[260px]",
    brand: "lg:tw-w-[120px]",
    model: "lg:tw-w-[100px]",
    SN: "lg:tw-w-[140px]",
    WO: "lg:tw-w-[140px]",
    // status: "lg:tw-w-[96px]",
    actions: "lg:tw-w-[96px]",
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

  // const statusText =
  // editingRow?.status === true
  //   ? "online"
  //   : editingRow?.status === false
  //     ? "offline"
  //     : "-";
  return (
    <>
      {/* {me?.role == "admin" && ()} */}

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
            // ⬇️ จอเล็กเลื่อนซ้าย-ขวาได้, จอใหญ่ไม่ซ่อน overflow
            <div className="tw-overflow-x-auto lg:tw-overflow-x-visible">
              {/* ⬇️ จอเล็กบังคับ min-width เพื่อให้เกิด scroll, จอใหญ่เอา min-width ออก */}
              <table className="tw-w-full tw-table-auto tw-min-w-[1100px] lg:tw-min-w-0">
                <thead className="tw-bg-gray-50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                          className={`tw-p-4 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium tw-text-center
                              tw-whitespace-nowrap ${COL_W_LG[header.column.id] ?? ""}`}
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
                      <tr key={row.id} className="odd:tw-bg-white even:tw-bg-gray-50">
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={`!tw-border-y !tw-border-x-0 ${COL_W_LG[cell.column.id] ?? ""} tw-align-top`}
                          >
                            <Typography
                              variant="small"
                              className="
                                !tw-font-normal !tw-text-blue-gray-500 tw-py-3 tw-px-3 tw-block
                                tw-whitespace-nowrap lg:tw-whitespace-normal lg:tw-break-words"
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
        currentUser={me?.username ?? ""}
        isAdmin={isAdmin}
        allOwners={usernames}
      />

      <Dialog open={openEdit} handler={() => setOpenEdit(false)} size="md" className="tw-space-y-5 tw-px-8 tw-py-4">
        <DialogHeader className="tw-flex tw-items-center tw-justify-between">
          <Typography variant="h5" color="blue-gray">Edit Station</Typography>
          <Button variant="text" onClick={() => setOpenEdit(false)}>✕</Button>
        </DialogHeader>

        {/* <form
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
              status: statusStr === "true",
              // ถ้าจะให้แก้ station_id ด้วย ให้ใส่: station_id: String(formData.get("station_id")||"").trim(),
            };

            await handleUpdateStation(editingRow.id, payload);
          }}
        > */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editingRow?.id) return;

            // const basePayload: StationUpdatePayload = {
            //   status: statusStr === "true",
            // };

            const basePayload: StationUpdatePayload = {
              is_active: activeStr === "true",
            };

            const adminFields: StationUpdatePayload = {
              station_name: (e.currentTarget as HTMLFormElement).station_name?.value?.trim(),
              brand: (e.currentTarget as HTMLFormElement).brand?.value?.trim(),
              model: (e.currentTarget as HTMLFormElement).model?.value?.trim(),
              SN: (e.currentTarget as HTMLFormElement).SN?.value?.trim(),
              WO: (e.currentTarget as HTMLFormElement).WO?.value?.trim(),
            };

            // ✅ ส่ง user_id ถ้าเป็น admin และเลือกไว้
            // const payload = isAdmin
            //   ? { ...adminFields, ...basePayload, user_id: selectedOwnerId || undefined }
            //   : basePayload;

            // await handleUpdateStation(editingRow.id!, payload);

            // ✅ ส่ง user_id ถ้าเป็น admin และเลือกไว้
            const payload = isAdmin
              ? { ...adminFields, ...basePayload, user_id: selectedOwnerId || undefined }
              : basePayload;

            await handleUpdateStation(editingRow.id!, payload);
          }}
        >
          <DialogBody className="tw-space-y-6 tw-px-6 tw-py-4">
            <div className="tw-flex tw-flex-col tw-gap-4">

              <Input
                name="station_id"
                label="Station ID"
                value={editingRow?.station_id ?? ""}
                readOnly
                className="!tw-bg-gray-100 !tw-text-blue-gray-500 tw-cursor-not-allowed focus:tw-ring-0 focus:tw-border-blue-gray-200"
                labelProps={{ className: "!tw-text-blue-gray-400" }}
              />

              <Input
                name="station_name"
                label="Station Name"
                required={isAdmin}
                defaultValue={editingRow?.station_name ?? ""}
                readOnly={!isAdmin}
                className={roClass}
                labelProps={roLabel}
              />

              <Input
                name="brand"
                label="Brand"
                required={isAdmin}
                defaultValue={editingRow?.brand ?? ""}
                readOnly={!isAdmin}
                className={roClass}
                labelProps={roLabel}
              />
              <Input
                name="model"
                label="Model"
                required={isAdmin}
                defaultValue={editingRow?.model ?? ""}
                readOnly={!isAdmin}
                className={roClass}
                labelProps={roLabel}
              />
              <Input
                name="SN"
                label="S/N"
                required={isAdmin}
                defaultValue={editingRow?.SN ?? ""}
                readOnly={!isAdmin}
                className={roClass}
                labelProps={roLabel}
              />
              <Input
                name="WO"
                label="WO"
                required={isAdmin}
                defaultValue={editingRow?.WO ?? ""}
                readOnly={!isAdmin}
                className={roClass}
                labelProps={roLabel}
              />
              {isAdmin ? (
                <Select
                  name="ownerSelect"
                  label="Owner (username)"
                  value={selectedOwnerId}                               // ✅ เก็บเป็น user_id
                  onChange={(v) => {
                    const uid = v ?? "";
                    setSelectedOwnerId(uid);
                    const u = owners.find(o => o.user_id === uid);
                    setEditingRow(prev => prev ? { ...prev, username: u?.username ?? "" } : prev); // เพื่อให้แสดงชื่อในฟอร์มได้
                  }}
                  labelProps={{
                    className: "after:content-['*'] after:tw-ml-0.5 after:tw-text-red-500"
                  }}
                >
                  {owners.map(o => (
                    <Option key={o.user_id} value={o.user_id}>
                      {o.username}
                    </Option>
                  ))}
                </Select>
              ) : (
                <Input
                  name="username"
                  label="Owner (username)"
                  value={editingRow?.username ?? "-"}
                  readOnly
                  className="!tw-bg-gray-100 !tw-text-blue-gray-500 tw-cursor-not-allowed focus:tw-ring-0 focus:tw-border-blue-gray-200"
                  labelProps={{ className: "!tw-text-blue-gray-400" }}
                />
              )}

              {/* status: ทุก role แก้ได้ */}

              {/* <Select label="status" value={statusStr} onChange={(v) => setStatusStr(v ?? "true")}>
                <Option value="true">On</Option>
                <Option value="false">Off</Option>
              </Select> */}

              {/* <Input
                name="status"
                label="Status"
                value={
                  editingRow?.status === true
                    ? "online"
                    : editingRow?.status === false
                      ? "offline"
                      : "-"
                }
                readOnly
                className="!tw-bg-gray-100 !tw-text-blue-gray-500 tw-cursor-not-allowed focus:tw-ring-0 focus:tw-border-blue-gray-200"
                labelProps={{ className: "!tw-text-blue-gray-400" }}
              /> */}

              <Select label="Is_active" value={activeStr} onChange={(v) => setActiveStr(v ?? "true")}>
                <Option value="true">active</Option>
                <Option value="false">inactive</Option>
              </Select>
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
