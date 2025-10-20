"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
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
  PLCFirmware?: string;
  PIFirmware?: string;
  RTFirmware?: string;
  chargeBoxID?: string;
  // status?: string;
  is_active?: boolean;
  brand?: string;
  user_id?: string;
  username?: string;
  images?: Record<string, string>;
};

export type StationUpdatePayload = {
  station_id?: string;
  station_name?: string;
  username?: string;
  brand?: string;
  model?: string;
  SN?: string; // API ใช้ตัวเล็ก
  WO?: string; // API ใช้ตัวเล็ก
  PLCFirmware?: string;
  PIFirmware?: string;
  RTFirmware?: string;
  chargeBoxID?: string;
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

type ImageKind = "station" | "mdb" | "charger" | "device";

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

  const [editForm, setEditForm] = useState({
    station_name: "",
    brand: "",
    model: "",
    SN: "",
    WO: "",
    PLCFirmware: "",
    PIFirmware: "",
    RTFirmware: "",
    chargeBoxID: "",
    is_active: true,
  });

  // sync เมื่อเปิด modal edit
  useEffect(() => {
    if (openEdit && editingRow) {
      setEditForm({
        station_name: editingRow.station_name ?? "",
        brand: editingRow.brand ?? "",
        model: editingRow.model ?? "",
        SN: editingRow.SN ?? "",
        WO: editingRow.WO ?? "",
        PLCFirmware: editingRow.PLCFirmware ?? "",
        PIFirmware: editingRow.PIFirmware ?? "",
        RTFirmware: editingRow.RTFirmware ?? "",
        chargeBoxID: editingRow.chargeBoxID ?? "",
        is_active: !!editingRow.is_active,
      });
    }
  }, [openEdit, editingRow]);
  // รูป 4 ช่อง + พรีวิว + ref สำหรับ clear
  const [editImages, setEditImages] = useState<Record<ImageKind, File | null>>({
    station: null, mdb: null, charger: null, device: null,
  });
  const [editPreviews, setEditPreviews] = useState<Record<ImageKind, string>>({
    station: "", mdb: "", charger: "", device: "",
  });
  const fileInputRefs = useRef<Record<ImageKind, HTMLInputElement | null>>({
    station: null, mdb: null, charger: null, device: null,
  });

  const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
  const pickEditFile = (kind: ImageKind): React.ChangeEventHandler<HTMLInputElement> => (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { alert("กรุณาเลือกรูปภาพเท่านั้น"); return; }
    if (f.size > MAX_IMAGE_BYTES) { alert("ไฟล์รูปใหญ่เกินไป (จำกัด 3MB)"); return; }
    if (editPreviews[kind]) URL.revokeObjectURL(editPreviews[kind]);
    setEditImages((s) => ({ ...s, [kind]: f }));
    setEditPreviews((s) => ({ ...s, [kind]: URL.createObjectURL(f) }));
  };
  function clearEditFile(kind: ImageKind) {
    if (editPreviews[kind]) URL.revokeObjectURL(editPreviews[kind]);
    setEditImages((s) => ({ ...s, [kind]: null }));
    setEditPreviews((s) => ({ ...s, [kind]: "" }));
    const el = fileInputRefs.current[kind];
    if (el) el.value = "";
  }

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
      const res = await apiFetch(`${API_BASE}/username`, {
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
          PLCFirmware: s.PLCFirmware ?? "-",
          PIFirmware: s.PIFirmware ?? "-",
          RTFirmware: s.RTFirmware ?? "-",
          chargeBoxID: s.chargeBoxID ?? "-",
          // status: s.status ?? "-",
          // status: !!s.status,
          is_active: !!s.is_active,
          // status: typeof s.status === "boolean" ? s.status : true,
          status: typeof s.status === "boolean" ? s.status : undefined,
          model: s.model ?? "-",
          brand: s.brand ?? "-",
          user_id: s.user_id ?? "",
          username: s.username ?? "",
          images: s.images ?? {},
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
    PLCFirmware: string;
    PIFirmware: string;
    RTFirmware: string;
    chargeBoxID: string;
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
        PLCFirmware: payload.PLCFirmware.trim(),
        PIFirmware: payload.PIFirmware.trim(),
        RTFirmware: payload.RTFirmware.trim(),
        chargeBoxID: payload.chargeBoxID.trim(),
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
          PLCFirmware: created.PLCFirmware,
          PIFirmware: created.PIFirmware,
          RTFirmware: created.RTFirmware,
          chargeBoxID: created.chargeBoxID,
          user_id: created.user_id,
          username: createdUsername,
          is_active: created.is_active,
          images: created.images ?? {},
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
  // ล็อกสกอร์ลของหน้าเมื่อเปิดโมดัล แล้วคืนค่าตำแหน่งเมื่อปิด
  useEffect(() => {
    const lock = openAdd || openEdit;
    if (lock) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";      // กัน layout shift
      document.body.style.overflow = "hidden"; // กันสกอร์ลฉากหลัง
    } else {
      // ปลดล็อก
      const top = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      // กลับไปตำแหน่งเดิมของหน้า
      if (top) {
        const y = parseInt(top || "0") * -1;
        window.scrollTo(0, y);
      }
    }
  }, [openAdd, openEdit]);



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
              PLCFirmware: updated.PLCFirmware ?? r.PLCFirmware,
              PIFirmware: updated.PIFirmware ?? r.PIFirmware,
              RTFirmware: updated.RTFirmware ?? r.RTFirmware,
              chargeBoxID: updated.chargeBoxID ?? r.chargeBoxID,
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

  // function ImagesCell({ images }: { images?: Record<string, string> }) {
  //   const entries = Object.entries(images ?? {});
  //   if (!entries.length) return <span className="tw-text-blue-gray-300">-</span>;
  //   return (
  //     <div className="tw-flex tw-gap-1.5 tw-flex-wrap tw-items-center">
  //       {entries.map(([k, url]) => (
  //         <a key={k} href={`${API_BASE}${url}`} target="_blank" rel="noreferrer"
  //           title={k}
  //           className="tw-border tw-border-blue-gray-100 tw-rounded tw-overflow-hidden tw-w-10 tw-h-10 tw-bg-white hover:tw-shadow-sm">
  //           <img src={`${API_BASE}${url}`} alt={k} className="tw-w-full tw-h-full tw-object-cover" loading="lazy" />
  //         </a>
  //       ))}
  //     </div>
  //   );
  // }

  function ImagesCell({ images }: { images?: Record<string, string> }) {
    const entries = Object.entries(images ?? {});
    if (!entries.length) return <span className="tw-text-blue-gray-300">-</span>;
    return (
      <div className="tw-max-w-[240px] tw-overflow-x-auto tw-overflow-y-hidden tw-py-0.5">
        <div className="tw-flex tw-gap-1.5 tw-items-center tw-min-w-max">
          {entries.map(([k, url]) => (
            <a
              key={k}
              href={`${API_BASE}${url}`}
              target="_blank"
              rel="noreferrer"
              title={k}
              className="tw-border tw-border-blue-gray-100 tw-rounded tw-overflow-hidden tw-w-10 tw-h-10 tw-bg-white hover:tw-shadow-sm"
            >
              <img
                src={`${API_BASE}${url}`}
                alt={k}
                className="tw-w-full tw-h-full tw-object-cover"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      </div>
    );
  }

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
      id: "images",
      header: () => "images",
      enableSorting: false,
      cell: ({ row }: { row: Row<stationRow> }) => (
        <ImagesCell images={(row.original as any).images} />
      ),
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
      accessorFn: (row: stationRow) => row.PLCFirmware ?? "-",
      id: "PLCFirmware",
      cell: (info: any) => info.getValue(),
      header: () => "PLC Firmware",
    },
    {
      accessorFn: (row: stationRow) => row.PIFirmware ?? "-",
      id: "PIFirmware",
      cell: (info: any) => info.getValue(),
      header: () => "Pi Firmware",
    },
    {
      accessorFn: (row: stationRow) => row.RTFirmware ?? "-",
      id: "RTFirmware",
      cell: (info: any) => info.getValue(),
      header: () => "Router Firmware",
    },
    {
      accessorFn: (row: stationRow) => row.chargeBoxID ?? "-",
      id: "chargeBoxID",
      cell: (info: any) => info.getValue(),
      header: () => "Charge Box ID",
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
    images: "tw-w-[250px]",
    station_id: "tw-w-[140px]",
    username: "tw-w-[120px]",
    station_name: "tw-w-[260px]", // ชื่อสถานีมักยาว => ให้กว้างหน่อย
    brand: "tw-w-[120px]",
    model: "tw-w-[100px]",
    SN: "tw-w-[140px]",
    WO: "tw-w-[140px]",
    PLCFirmware: "tw-w-[140px]",
    PIFirmware: "tw-w-[140px]",
    RTFirmware: "tw-w-[140px]",
    chargeBoxID: "tw-w-[140px]",
    status: "tw-w-[60px] tw-whitespace-nowrap",       // จุดสีเล็กพอ
    is_active: "tw-w-[120px] tw-whitespace-nowrap",   // ป้าย active/inactive
    actions: "tw-w-[96px] tw-whitespace-nowrap",
  };

  const COL_W_MD: Record<string, string> = {
    no: "md:tw-w-[56px]",
    images: "md:tw-w-[250px]",
    station_id: "md:tw-w-[140px]",
    username: "md:tw-w-[120px]",
    station_name: "md:tw-w-[260px]",
    brand: "md:tw-w-[120px]",
    model: "md:tw-w-[100px]",
    SN: "md:tw-w-[140px]",
    WO: "md:tw-w-[140px]",
    PLCFirmware: "md:tw-w-[140px]",
    PIFirmware: "md:tw-w-[140px]",
    RTFirmware: "md:tw-w-[140px]",
    chargeBoxID: "md:tw-w-[140px]",
    status: "md:tw-w-[60px] md:tw-whitespace-nowrap",
    is_active: "md:tw-w-[120px] md:tw-whitespace-nowrap",
    actions: "md:tw-w-[96px] md:tw-whitespace-nowrap",
  };

  const COL_W_LG: Record<string, string> = {
    no: "lg:tw-w-[56px]",
    images: "lg:tw-w-[250px]",
    station_id: "lg:tw-w-[140px]",
    username: "lg:tw-w-[120px]",
    station_name: "lg:tw-w-[260px]",
    brand: "lg:tw-w-[120px]",
    model: "lg:tw-w-[100px]",
    SN: "lg:tw-w-[140px]",
    WO: "lg:tw-w-[140px]",
    PLCFirmware: "lg:tw-w-[140px]",
    PIFirmware: "lg:tw-w-[140px]",
    RTFirmware: "lg:tw-w-[140px]",
    chargeBoxID: "lg:tw-w-[140px]",
    status: "lg:tw-w-[60px] lg:tw-whitespace-nowrap",
    is_active: "lg:tw-w-[120px] lg:tw-whitespace-nowrap",
    actions: "lg:tw-w-[96px] tw-whitespace-nowrap",
  };

  async function onSubmitImages(
    stationId: string,
    files: { station?: File | null; mdb?: File | null; charger?: File | null; device?: File | null }
  ) {
    const fd = new FormData();
    if (files.station) fd.append("station", files.station);
    if (files.mdb) fd.append("mdb", files.mdb);
    if (files.charger) fd.append("charger", files.charger);
    if (files.device) fd.append("device", files.device);

    if (Array.from(fd.keys()).length === 0) return; // ไม่มีไฟล์ ไม่ต้องยิง

    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") || "";

    await apiFetch(`${API_BASE}/stations/${encodeURIComponent(stationId)}/upload-images`, {
      method: "POST",
      // headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,                 // อย่าตั้ง Content-Type เอง ปล่อยให้ browser ใส่ boundary
      credentials: "include", // ถ้า auth ด้วย cookie ให้ใช้บรรทัดนี้แทน header
    });

    // ดึง station เดียวมาอัปเดต images ในตาราง (ใช้ endpoint ที่มี images เช่น /selected/station/{station_id})
    const r = await apiFetch(`${API_BASE}/selected/station/${encodeURIComponent(stationId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (r.ok) {
      const station = await r.json();
      setData(prev => prev.map(x => x.station_id === stationId ? { ...x, images: station.images ?? {} } : x));
    }
  }



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
            <div className="tw-overflow-x-auto tw-w-full">
              {/* มือถือ: บังคับ min-w เพื่อให้ลากได้ | md+: เอา min-w ออก */}
              <table className="tw-w-full tw-table-fixed tw-border-separate tw-border-spacing-0 tw-min-w-[980px] md:tw-min-w-0">
                <thead className="tw-bg-gray-50">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th
                          key={h.id}
                          onClick={h.column.getToggleSortingHandler()}
                          className={`tw-px-3 tw-py-3 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium tw-text-center
                              tw-whitespace-nowrap ${COL_W_LG[h.column.id] ?? ""}`}
                        >
                          <Typography
                            color="blue-gray"
                            className={`tw-flex tw-items-center tw-gap-2 tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40
                                ${h.column.getCanSort() ? "tw-justify-between" : "tw-justify-center"}`}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
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
                            className={`!tw-border-y !tw-border-x-0 ${COL_W_LG[cell.column.id] ?? ""} tw-align-top tw-px-3 tw-py-3 tw-overflow-hidden`}
                          >
                            <Typography
                              variant="small"
                              className="
                        !tw-font-normal !tw-text-blue-gray-500 tw-block
                        tw-whitespace-nowrap md:tw-whitespace-normal md:tw-break-words"
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
        onSubmitImages={onSubmitImages}
        loading={saving}
        currentUser={me?.username ?? ""}
        isAdmin={isAdmin}
        allOwners={usernames}
      />

      <Dialog
        open={openEdit}
        handler={() => setOpenEdit(false)}
        size="md"
        dismiss={{ outsidePress: !saving, escapeKey: !saving }}
        className="tw-flex tw-flex-col tw-max-h-[90vh] tw-overflow-hidden tw-px-0 tw-py-0"
      >
        <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-bg-white tw-px-6 tw-py-4 tw-border-b">
          <div className="tw-flex tw-items-center tw-justify-between">
            <Typography variant="h5" color="blue-gray">Edit Station</Typography>
            <Button variant="text" onClick={() => setOpenEdit(false)}>✕</Button>
          </div>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editingRow?.id) return;

            const payload: StationUpdatePayload = {
              station_name: editForm.station_name.trim(),
              brand: editForm.brand.trim(),
              model: editForm.model.trim(),
              SN: editForm.SN.trim(),
              WO: editForm.WO.trim(),
              PLCFirmware: editForm.PLCFirmware.trim(),
              PIFirmware: editForm.PIFirmware.trim(),
              RTFirmware: editForm.RTFirmware.trim(),
              chargeBoxID: editForm.chargeBoxID.trim(),
              is_active: !!editForm.is_active,
              ...(isAdmin ? { user_id: selectedOwnerId || undefined } : {}),
            };

            await handleUpdateStation(editingRow.id, payload);

            // ถ้ามีเลือกไฟล์รูป ใส่เข้า endpoint upload แล้วรีเฟรช images แถวนี้
            if (editingRow.station_id && (editImages.station || editImages.mdb || editImages.charger || editImages.device)) {
              await onSubmitImages(editingRow.station_id, {
                station: editImages.station,
                mdb: editImages.mdb,
                charger: editImages.charger,
                device: editImages.device,
              });
              // เคลียร์ไฟล์หลังอัปโหลด
              (["station", "mdb", "charger", "device"] as ImageKind[]).forEach(clearEditFile);
            }

            setOpenEdit(false);
          }}
          className="tw-flex tw-flex-col tw-min-h-0"
        >
          <DialogBody className="tw-flex-1 tw-min-h-0 tw-overflow-y-auto tw-space-y-6 tw-px-6 tw-py-4">
            <div className="tw-flex tw-flex-col tw-gap-4">
              <Input
                name="station_id"
                label="Station ID"
                value={editingRow?.station_id ?? ""}
                readOnly
                className="!tw-bg-gray-100 !tw-text-blue-gray-500 tw-cursor-not-allowed"
                labelProps={{ className: "!tw-text-blue-gray-400" }}
              />

              <Input label="Station Name" required value={editForm.station_name}
                onChange={(e) => setEditForm(s => ({ ...s, station_name: e.target.value }))} crossOrigin={undefined} />
              <Input label="Brand" required value={editForm.brand}
                onChange={(e) => setEditForm(s => ({ ...s, brand: e.target.value }))} crossOrigin={undefined} />
              <Input label="Model" required value={editForm.model}
                onChange={(e) => setEditForm(s => ({ ...s, model: e.target.value }))} crossOrigin={undefined} />
              <Input label="Serial Number (S/N)" required value={editForm.SN}
                onChange={(e) => setEditForm(s => ({ ...s, SN: e.target.value }))} crossOrigin={undefined} />
              <Input label="Work Order (WO)" required value={editForm.WO}
                onChange={(e) => setEditForm(s => ({ ...s, WO: e.target.value }))} crossOrigin={undefined} />
              <Input label="PLC Firmware" required value={editForm.PLCFirmware}
                onChange={(e) => setEditForm(s => ({ ...s, PLCFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label="Raspberry pi Firmware" required value={editForm.PIFirmware}
                onChange={(e) => setEditForm(s => ({ ...s, PIFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label="Router Firmware" required value={editForm.RTFirmware}
                onChange={(e) => setEditForm(s => ({ ...s, RTFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label="Charger Box ID" required value={editForm.chargeBoxID}
                onChange={(e) => setEditForm(s => ({ ...s, chargeBoxID: e.target.value }))} crossOrigin={undefined} />

              {/* Owner */}
              {isAdmin ? (
                <Select
                  label="Owner"
                  value={selectedOwnerId}
                  onChange={(v) => setSelectedOwnerId(v ?? "")}
                  labelProps={{
                    className: "after:content-['*'] after:tw-ml-0.5 after:tw-text-red-500"
                  }}
                >
                  {owners.map(o => (
                    <Option key={o.user_id} value={o.user_id}>{o.username}</Option>
                  ))}
                </Select>
              ) : (
                <Input
                  label="Owner"
                  value={editingRow?.username ?? "-"}
                  readOnly
                  className="!tw-bg-gray-100 !tw-text-blue-gray-500 tw-cursor-not-allowed"
                  labelProps={{ className: "!tw-text-blue-gray-400" }}
                  crossOrigin={undefined}
                />
              )}

              {/* is_active */}
              <Select
                label="Is_active"
                value={String(editForm.is_active)}
                onChange={(v) => setEditForm(s => ({ ...s, is_active: v === "true" }))}
              >
                <Option value="true">Active</Option>
                <Option value="false">Inactive</Option>
              </Select>

              {/* ภาพเดิม (preview) */}
              <div className="tw-space-y-2">
                <Typography variant="small" className="!tw-text-blue-gray-600">Current Images</Typography>
                <div className="tw-flex tw-gap-2 tw-flex-wrap">
                  {Object.entries(editingRow?.images ?? {}).length ? (
                    Object.entries(editingRow!.images!).map(([k, url]) => (
                      <div key={k} className="tw-flex tw-flex-col tw-items-center tw-gap-1">
                        <a
                          href={`${API_BASE}${url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="tw-border tw-border-blue-gray-100 tw-rounded tw-overflow-hidden tw-w-20 tw-h-20"
                          title={k}
                        >
                          <img src={`${API_BASE}${url}`} alt={k} className="tw-w-full tw-h-full tw-object-cover" />
                        </a>
                        <span className="tw-text-xs tw-text-blue-gray-500">{k}</span>
                      </div>
                    ))
                  ) : (
                    <span className="tw-text-blue-gray-300">ไม่มีรูป</span>
                  )}
                </div>
              </div>

              {/* อัปโหลดรูปใหม่ 4 ช่อง + พรีวิว */}
              <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-4">
                {(["station", "mdb", "charger", "device"] as ImageKind[]).map(kind => (
                  <div key={kind} className="tw-space-y-2">
                    <Typography variant="small" className="!tw-text-blue-gray-600">
                      {kind.toUpperCase()} Image
                    </Typography>
                    <div className="tw-flex tw-items-center tw-gap-3">
                      <input
                        ref={(el) => (fileInputRefs.current[kind] = el)}
                        type="file"
                        accept="image/*"
                        onChange={pickEditFile(kind)}
                        className="tw-block tw-w-full tw-text-sm file:tw-mr-3 file:tw-px-3 file:tw-py-2 file:tw-rounded-lg file:tw-border file:tw-border-blue-gray-100 file:tw-bg-white file:hover:tw-bg-gray-50"
                      />
                      {editImages[kind] && (
                        <Button variant="text" onClick={() => clearEditFile(kind)} className="tw-text-red-600">
                          ล้างรูป
                        </Button>
                      )}
                    </div>
                    {editPreviews[kind] && (
                      <img
                        src={editPreviews[kind]}
                        alt={kind}
                        className="tw-h-28 tw-w-28 tw-object-cover tw-rounded-lg tw-border tw-border-blue-gray-100"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-6 tw-py-3 tw-border-t">
            <div className="tw-flex tw-w-full tw-justify-end tw-gap-2">
              <Button variant="outlined" type="button" onClick={() => setOpenEdit(false)}>Cancel</Button>
              <Button type="submit" className="tw-bg-blue-600" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

export default SearchDataTables;
