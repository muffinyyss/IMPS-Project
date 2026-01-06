"use client";

import React, { useEffect, useState, useMemo, useRef, Fragment } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  useReactTable,
  flexRender,
  type Row,
  type ExpandedState,
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
  Chip,
  Tooltip,
} from "@material-tailwind/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  ChevronDownIcon,
  ChevronRightIcon as ChevronRightIconSolid,
  PencilSquareIcon,
  TrashIcon,
  BoltIcon,
  CpuChipIcon,
  PhotoIcon,
} from "@heroicons/react/24/solid";

import AddStation, {
  type NewStationPayload,
} from "@/app/dashboard/stations/components/addstations";

import { apiFetch } from "@/utils/api";

const API_BASE = "http://localhost:8000";

// ===== Types =====
type ChargerData = {
  id?: string;
  charger_id?: string;
  station_id?: string;
  chargeBoxID: string;
  chargerNo: number;           // NEW: Charger number (auto-generated)
  brand: string;
  model: string;
  SN: string;
  WO: string;
  power: string;               // NEW: Power (kW)
  PLCFirmware: string;
  PIFirmware: string;
  RTFirmware: string;
  commissioningDate: string;   // NEW: Commissioning date
  warrantyYears: number;       // NEW: Warranty years
  numberOfCables: number;      // NEW: Number of cables
  is_active: boolean;          // NEW: Charger active status
  status?: boolean;
};

type StationRow = {
  id?: string;
  station_id: string;
  station_name: string;
  owner: string;
  user_id: string;
  username: string;
  is_active: boolean;
  status?: boolean;
  stationImage?: string;
  chargers: ChargerData[];
};

export type StationUpdatePayload = {
  station_id?: string;
  station_name?: string;
  username?: string;
  is_active?: boolean;
  user_id?: string;
};

export type ChargerUpdatePayload = {
  chargeBoxID?: string;
  chargerNo?: number;
  brand?: string;
  model?: string;
  SN?: string;
  WO?: string;
  power?: string;
  PLCFirmware?: string;
  PIFirmware?: string;
  RTFirmware?: string;
  commissioningDate?: string;
  warrantyYears?: number;
  numberOfCables?: number;
  is_active?: boolean;
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

type UsernamesResp = { username: string[] };
type Owner = { user_id: string; username: string };

// Helper: Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export function SearchDataTables() {
  const [me, setMe] = useState<{ user_id: string; username: string; role: string } | null>(null);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [technicians, setTechnicians] = useState<Map<string, string[]>>(new Map());

  const [data, setData] = useState<StationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [sorting, setSorting] = useState<any>([]);
  const [filtering, setFiltering] = useState("");
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Edit Station Modal
  const [openEditStation, setOpenEditStation] = useState(false);
  const [editingStation, setEditingStation] = useState<StationRow | null>(null);
  const [editStationForm, setEditStationForm] = useState({
    station_name: "",
    is_active: true,
  });

  // Edit Charger Modal
  const [openEditCharger, setOpenEditCharger] = useState(false);
  const [editingCharger, setEditingCharger] = useState<{ stationId: string; charger: ChargerData } | null>(null);
  const [editChargerForm, setEditChargerForm] = useState({
    chargeBoxID: "",
    chargerNo: 1,
    brand: "",
    model: "",
    SN: "",
    WO: "",
    power: "",
    PLCFirmware: "",
    PIFirmware: "",
    RTFirmware: "",
    commissioningDate: "",
    warrantyYears: 1,
    numberOfCables: 1,
    is_active: true,
  });

  // Add Charger Modal
  const [openAddCharger, setOpenAddCharger] = useState(false);
  const [addingChargerStationId, setAddingChargerStationId] = useState<string>("");
  const [addChargerForm, setAddChargerForm] = useState({
    chargeBoxID: "",
    chargerNo: 1,
    brand: "",
    model: "",
    SN: "",
    WO: "",
    power: "",
    PLCFirmware: "",
    PIFirmware: "",
    RTFirmware: "",
    commissioningDate: getTodayDate(),
    warrantyYears: 1,
    numberOfCables: 1,
    is_active: true,
  });

  // Images for edit station (only station image)
  const [editStationImage, setEditStationImage] = useState<File | null>(null);
  const [editStationPreview, setEditStationPreview] = useState<string>("");
  const stationImageInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

  const pickStationImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { alert("Please select an image file only"); return; }
    if (f.size > MAX_IMAGE_BYTES) { alert("File is too large (max 3MB)"); return; }
    if (editStationPreview) URL.revokeObjectURL(editStationPreview);
    setEditStationImage(f);
    setEditStationPreview(URL.createObjectURL(f));
  };

  function clearStationImage() {
    if (editStationPreview) URL.revokeObjectURL(editStationPreview);
    setEditStationImage(null);
    setEditStationPreview("");
    if (stationImageInputRef.current) stationImageInputRef.current.value = "";
  }

  // Reset edit images when opening edit station modal
  const resetEditImages = () => {
    if (editStationPreview) URL.revokeObjectURL(editStationPreview);
    setEditStationImage(null);
    setEditStationPreview("");
  };

  // Sync edit station form
  useEffect(() => {
    if (openEditStation && editingStation) {
      setEditStationForm({
        station_name: editingStation.station_name ?? "",
        is_active: !!editingStation.is_active,
      });
      setSelectedOwnerId(editingStation.user_id ?? "");
      resetEditImages();
    }
  }, [openEditStation, editingStation]);

  // Sync edit charger form
  useEffect(() => {
    if (openEditCharger && editingCharger) {
      setEditChargerForm({
        chargeBoxID: editingCharger.charger.chargeBoxID ?? "",
        chargerNo: editingCharger.charger.chargerNo ?? 1,
        brand: editingCharger.charger.brand ?? "",
        model: editingCharger.charger.model ?? "",
        SN: editingCharger.charger.SN ?? "",
        WO: editingCharger.charger.WO ?? "",
        power: editingCharger.charger.power ?? "",
        PLCFirmware: editingCharger.charger.PLCFirmware ?? "",
        PIFirmware: editingCharger.charger.PIFirmware ?? "",
        RTFirmware: editingCharger.charger.RTFirmware ?? "",
        commissioningDate: editingCharger.charger.commissioningDate ?? "",
        warrantyYears: editingCharger.charger.warrantyYears ?? 1,
        numberOfCables: editingCharger.charger.numberOfCables ?? 1,
        is_active: editingCharger.charger.is_active ?? true,
      });
    }
  }, [openEditCharger, editingCharger]);

  // Fetch owners
  useEffect(() => {
    (async () => {
      if (me?.role !== "admin") return;
      const res = await apiFetch(`/owners`);
      const json = await res.json();
      setOwners(Array.isArray(json.owners) ? json.owners : []);
    })();
  }, [me?.role]);

  // Fetch usernames
  useEffect(() => {
    (async () => {
      if (me?.role !== "admin") return;
      const res = await apiFetch(`/username`);
      if (!res.ok) return;
      const json: UsernamesResp = await res.json();
      setUsernames(Array.isArray(json.username) ? json.username : []);
    })();
  }, [me?.role]);

  // Fetch technicians
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/all-users/`);
        if (!res.ok) return;
        const json = await res.json();
        const users = Array.isArray(json?.users) ? json.users : [];

        const technicianMap = new Map<string, string[]>();
        users.forEach((user: any) => {
          if (user.role === "technician" && user.station_id && Array.isArray(user.station_id)) {
            user.station_id.forEach((stationId: string) => {
              if (!technicianMap.has(stationId)) {
                technicianMap.set(stationId, []);
              }
              technicianMap.get(stationId)!.push(user.username);
            });
          }
        });
        setTechnicians(technicianMap);
      } catch (e) {
        console.error("Failed to fetch technicians:", e);
      }
    })();
  }, []);

  // Fetch charger status from /charger-onoff/{station_id}
  const fetchChargerStatuses = async (stations: StationRow[]) => {
    try {
      const updatedStations = await Promise.all(
        stations.map(async (station) => {
          if (station.chargers.length === 0) return station;

          // Fetch status for each charger in this station
          const updatedChargers = await Promise.all(
            station.chargers.map(async (charger) => {
              try {
                // Use chargeBoxID to fetch status
                const url = `/charger-onoff/${charger.chargeBoxID}`;
                console.log(`[ChargerStatus] Fetching: ${url}`);
                
                const res = await apiFetch(url);
                console.log(`[ChargerStatus] Response status: ${res.status}`);
                
                if (res.ok) {
                  const data = await res.json();
                  console.log(`[ChargerStatus] ${charger.chargeBoxID}:`, data);
                  return { ...charger, status: !!data.status };
                } else {
                  const errText = await res.text();
                  console.error(`[ChargerStatus] Error for ${charger.chargeBoxID}:`, res.status, errText);
                }
              } catch (e) {
                console.error(`[ChargerStatus] Failed to fetch status for charger ${charger.chargeBoxID}:`, e);
              }
              return charger;
            })
          );

          return { ...station, chargers: updatedChargers };
        })
      );

      return updatedStations;
    } catch (e) {
      console.error("[ChargerStatus] Failed to fetch charger statuses:", e);
      return stations;
    }
  };

  // Fetch stations with chargers
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("access_token") || localStorage.getItem("accessToken") || "";
        const claims = decodeJwt(token);
        if (claims) {
          setMe({ user_id: claims.user_id ?? "-", username: claims.username ?? "-", role: claims.role ?? "user" });
        }

        const res = await apiFetch(`/all-stations/`);
        if (!res.ok) {
          setErr(`Fetch failed: ${res.status}`);
          setData([]);
          return;
        }

        const json = await res.json();
        const list = Array.isArray(json?.stations) ? json.stations : [];

        const rows: StationRow[] = list.map((s: any) => ({
          id: s.id,
          station_id: s.station_id ?? "-",
          station_name: s.station_name ?? "-",
          owner: s.owner ?? "",
          user_id: s.user_id ?? "",
          username: s.username ?? "",
          is_active: !!s.is_active,
          status: s.status,
          stationImage: s.stationImage ?? "",
          chargers: Array.isArray(s.chargers) ? s.chargers.map((c: any, index: number) => ({
            id: c.id,
            charger_id: c.charger_id,
            station_id: c.station_id,
            chargeBoxID: c.chargeBoxID ?? "-",
            chargerNo: c.chargerNo ?? (index + 1),
            brand: c.brand ?? "-",
            model: c.model ?? "-",
            SN: c.SN ?? "-",
            WO: c.WO ?? "-",
            power: c.power ?? "-",
            PLCFirmware: c.PLCFirmware ?? "-",
            PIFirmware: c.PIFirmware ?? "-",
            RTFirmware: c.RTFirmware ?? "-",
            commissioningDate: c.commissioningDate ?? "-",
            warrantyYears: c.warrantyYears ?? 1,
            numberOfCables: c.numberOfCables ?? 1,
            is_active: c.is_active ?? true,
            status: c.status,
          })) : [],
        }));

        setData(rows);

        // Fetch charger statuses
        const rowsWithStatus = await fetchChargerStatuses(rows);
        setData(rowsWithStatus);
      } catch (e) {
        console.error(e);
        setErr("Network/Server error");
        setData([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isAdmin = me?.role === "admin";

  // ===== Handlers =====
  const handleEditStation = (station: StationRow, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    if (!isAdmin && station.user_id !== me?.user_id) {
      alert("You don't have permission to edit this station");
      return;
    }
    setEditingStation(station);
    setOpenEditStation(true);
  };

  const handleEditCharger = (stationId: string, charger: ChargerData) => {
    setEditingCharger({ stationId, charger });
    setOpenEditCharger(true);
  };

  const handleUpdateStation = async () => {
    if (!editingStation?.id) return;
    try {
      setSaving(true);

      const payload: StationUpdatePayload = {
        station_name: editStationForm.station_name.trim(),
        is_active: editStationForm.is_active,
        ...(isAdmin ? { user_id: selectedOwnerId || undefined } : {}),
      };

      const res = await apiFetch(`/update_stations/${editingStation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Update failed: ${res.status}`);

      // Upload station image if any
      if (editStationImage) {
        const formData = new FormData();
        formData.append("station", editStationImage);
        
        await apiFetch(`/stations/${editingStation.station_id}/upload-image`, {
          method: "POST",
          body: formData,
        });
      }

      setData(prev => prev.map(s =>
        s.id === editingStation.id
          ? {
            ...s,
            station_name: editStationForm.station_name,
            is_active: editStationForm.is_active,
            user_id: isAdmin ? selectedOwnerId : s.user_id,
            username: isAdmin ? (owners.find(o => o.user_id === selectedOwnerId)?.username ?? s.username) : s.username,
          }
          : s
      ));

      setOpenEditStation(false);
      setNotice({ type: "success", msg: "Station updated successfully" });
      setTimeout(() => setNotice(null), 2500);
    } catch (e: any) {
      console.error(e);
      setNotice({ type: "error", msg: e?.message || "Update failed" });
      setTimeout(() => setNotice(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCharger = async () => {
    if (!editingCharger?.charger.id) return;
    try {
      setSaving(true);

      const payload: ChargerUpdatePayload = {
        chargeBoxID: editChargerForm.chargeBoxID.trim(),
        chargerNo: editChargerForm.chargerNo,
        brand: editChargerForm.brand.trim(),
        model: editChargerForm.model.trim(),
        SN: editChargerForm.SN.trim(),
        WO: editChargerForm.WO.trim(),
        power: editChargerForm.power.trim(),
        PLCFirmware: editChargerForm.PLCFirmware.trim(),
        PIFirmware: editChargerForm.PIFirmware.trim(),
        RTFirmware: editChargerForm.RTFirmware.trim(),
        commissioningDate: editChargerForm.commissioningDate,
        warrantyYears: editChargerForm.warrantyYears,
        numberOfCables: editChargerForm.numberOfCables,
        is_active: editChargerForm.is_active,
      };

      const res = await apiFetch(`/update_charger/${editingCharger.charger.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Update failed: ${res.status}`);

      setData(prev => prev.map(station => {
        if (station.station_id !== editingCharger.stationId) return station;
        return {
          ...station,
          chargers: station.chargers.map(c =>
            c.id === editingCharger.charger.id
              ? { ...c, ...editChargerForm }
              : c
          ),
        };
      }));

      setOpenEditCharger(false);
      setNotice({ type: "success", msg: "Charger updated successfully" });
      setTimeout(() => setNotice(null), 2500);
    } catch (e: any) {
      console.error(e);
      setNotice({ type: "error", msg: e?.message || "Update failed" });
      setTimeout(() => setNotice(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStation = async (station: StationRow, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    if (!station.id) return alert("Station ID not found");
    if (!confirm(`Are you sure you want to delete station "${station.station_name}" and all its chargers?`)) return;

    try {
      const res = await apiFetch(`/delete_stations/${station.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);

      setData(prev => prev.filter(s => s.id !== station.id));
      setNotice({ type: "success", msg: "Delete success" });
      setTimeout(() => setNotice(null), 2500);
    } catch (e: any) {
      console.error(e);
      setNotice({ type: "error", msg: e.message || "Failed to delete station" });
      setTimeout(() => setNotice(null), 3500);
    }
  };

  const handleDeleteCharger = async (stationId: string, charger: ChargerData) => {
    if (!charger.id) return alert("Charger ID not found");
    if (!confirm(`Are you sure you want to delete charger "${charger.chargeBoxID}"?`)) return;

    try {
      const res = await apiFetch(`/delete_charger/${charger.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);

      setData(prev => prev.map(station => {
        if (station.station_id !== stationId) return station;
        return {
          ...station,
          chargers: station.chargers.filter(c => c.id !== charger.id),
        };
      }));

      setNotice({ type: "success", msg: "Charger deleted" });
      setTimeout(() => setNotice(null), 2500);
    } catch (e: any) {
      console.error(e);
      setNotice({ type: "error", msg: e.message || "Failed to delete charger" });
      setTimeout(() => setNotice(null), 3500);
    }
  };

  const handleOpenAddCharger = (stationId: string) => {
    // Calculate next charger number
    const station = data.find(s => s.station_id === stationId);
    const nextChargerNo = station ? station.chargers.length + 1 : 1;

    setAddingChargerStationId(stationId);
    setAddChargerForm({
      chargeBoxID: "",
      chargerNo: nextChargerNo,
      brand: "",
      model: "",
      SN: "",
      WO: "",
      power: "",
      PLCFirmware: "",
      PIFirmware: "",
      RTFirmware: "",
      commissioningDate: getTodayDate(),
      warrantyYears: 1,
      numberOfCables: 1,
      is_active: true,
    });
    setOpenAddCharger(true);
  };

  const handleCreateCharger = async () => {
    if (!addingChargerStationId) return;
    try {
      setSaving(true);

      const payload = {
        chargeBoxID: addChargerForm.chargeBoxID.trim(),
        chargerNo: addChargerForm.chargerNo,
        brand: addChargerForm.brand.trim(),
        model: addChargerForm.model.trim(),
        SN: addChargerForm.SN.trim(),
        WO: addChargerForm.WO.trim(),
        power: addChargerForm.power.trim(),
        PLCFirmware: addChargerForm.PLCFirmware.trim(),
        PIFirmware: addChargerForm.PIFirmware.trim(),
        RTFirmware: addChargerForm.RTFirmware.trim(),
        commissioningDate: addChargerForm.commissioningDate,
        warrantyYears: addChargerForm.warrantyYears,
        numberOfCables: addChargerForm.numberOfCables,
        is_active: addChargerForm.is_active,
      };

      const res = await apiFetch(`/add_charger/${addingChargerStationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Create failed: ${res.status}`);

      const created = await res.json();

      const newCharger: ChargerData = {
        id: created.id,
        charger_id: created.charger_id,
        station_id: created.station_id || addingChargerStationId,
        chargeBoxID: created.chargeBoxID || addChargerForm.chargeBoxID,
        chargerNo: created.chargerNo || addChargerForm.chargerNo,
        brand: created.brand || addChargerForm.brand,
        model: created.model || addChargerForm.model,
        SN: created.SN || addChargerForm.SN,
        WO: created.WO || addChargerForm.WO,
        power: created.power || addChargerForm.power,
        PLCFirmware: created.PLCFirmware || addChargerForm.PLCFirmware,
        PIFirmware: created.PIFirmware || addChargerForm.PIFirmware,
        RTFirmware: created.RTFirmware || addChargerForm.RTFirmware,
        commissioningDate: created.commissioningDate || addChargerForm.commissioningDate,
        warrantyYears: created.warrantyYears || addChargerForm.warrantyYears,
        numberOfCables: created.numberOfCables || addChargerForm.numberOfCables,
        is_active: created.is_active ?? addChargerForm.is_active,
        status: created.status || false,
      };

      setData(prev => prev.map(station => {
        if (station.station_id !== addingChargerStationId) return station;
        return {
          ...station,
          chargers: [...station.chargers, newCharger],
        };
      }));

      setOpenAddCharger(false);
      setNotice({ type: "success", msg: "Charger created successfully" });
      setTimeout(() => setNotice(null), 2500);
    } catch (e: any) {
      console.error(e);
      setNotice({ type: "error", msg: e?.message || "Failed to create charger" });
      setTimeout(() => setNotice(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStation = async (payload: NewStationPayload) => {
    try {
      setSaving(true);

      const res = await apiFetch(`/add_stations/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) throw new Error("This station_id is already in use");
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);

      const created = await res.json();

      const newStation: StationRow = {
        id: created.id || created.station?.id,
        station_id: created.station?.station_id ?? payload.station?.station_id,
        station_name: created.station?.station_name ?? payload.station?.station_name ?? "",
        owner: created.station?.owner ?? "",
        user_id: created.station?.user_id ?? me?.user_id ?? "",
        username: created.station?.username ?? me?.username ?? "",
        is_active: created.station?.is_active ?? true,
        status: created.station?.status,
        stationImage: created.station?.stationImage ?? "",
        chargers: Array.isArray(created.chargers) ? created.chargers.map((c: any, index: number) => ({
          id: c.id,
          charger_id: c.charger_id,
          station_id: c.station_id,
          chargeBoxID: c.chargeBoxID ?? "-",
          chargerNo: c.chargerNo ?? (index + 1),
          brand: c.brand ?? "-",
          model: c.model ?? "-",
          SN: c.SN ?? "-",
          WO: c.WO ?? "-",
          power: c.power ?? "-",
          PLCFirmware: c.PLCFirmware ?? "-",
          PIFirmware: c.PIFirmware ?? "-",
          RTFirmware: c.RTFirmware ?? "-",
          commissioningDate: c.commissioningDate ?? "-",
          warrantyYears: c.warrantyYears ?? 1,
          numberOfCables: c.numberOfCables ?? 1,
          is_active: c.is_active ?? true,
          status: c.status,
        })) : [],
      };

      setData(prev => [newStation, ...prev]);
      setOpenAdd(false);
      setNotice({ type: "success", msg: "Create success" });
      setTimeout(() => setNotice(null), 3000);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to create station");
    } finally {
      setSaving(false);
    }
  };

  // Lock scroll when modal open
  useEffect(() => {
    const lock = openAdd || openEditStation || openEditCharger || openAddCharger;
    if (lock) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
    } else {
      const top = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      if (top) {
        const y = parseInt(top || "0") * -1;
        window.scrollTo(0, y);
      }
    }
  }, [openAdd, openEditStation, openEditCharger, openAddCharger]);

  // ===== Columns (reordered: expander, status, images, then rest) =====
  const columns = useMemo(() => [
    {
      id: "expander",
      header: () => null,
      size: 50,
      cell: ({ row }: { row: Row<StationRow> }) => {
        const hasChargers = row.original.chargers.length > 0;
        const canEdit = isAdmin || row.original.user_id === me?.user_id;
        const canExpand = hasChargers || canEdit;
        
        if (!canExpand) return null;

        return (
          <span className="tw-p-1.5 tw-rounded-lg">
            {row.getIsExpanded() ? (
              <ChevronDownIcon className="tw-h-5 tw-w-5 tw-text-blue-600" />
            ) : (
              <ChevronRightIconSolid className="tw-h-5 tw-w-5 tw-text-blue-gray-500" />
            )}
          </span>
        );
      },
    },
    {
      id: "status",
      header: () => "Status",
      size: 80,
      cell: ({ row }: { row: Row<StationRow> }) => {
        const on = !!row.original.status;
        return (
          <Tooltip content={on ? "Online" : "Offline"}>
            <span className="tw-inline-flex tw-items-center tw-gap-1.5">
              <span className={`tw-relative tw-inline-block tw-h-3 tw-w-3 tw-rounded-full ${on ? "tw-bg-green-500" : "tw-bg-red-500"}`}>
                {on && <span className="tw-absolute tw-inset-0 tw-rounded-full tw-bg-green-400 tw-animate-ping tw-opacity-75" />}
              </span>
            </span>
          </Tooltip>
        );
      },
    },
    {
      id: "images",
      header: () => "Images",
      size: 80,
      cell: ({ row }: { row: Row<StationRow> }) => {
        const stationImage = row.original.stationImage;
        
        if (!stationImage) {
          return (
            <span className="tw-text-blue-gray-300 tw-text-xs tw-flex tw-items-center tw-gap-1">
              <PhotoIcon className="tw-h-4 tw-w-4" />
              <span>-</span>
            </span>
          );
        }

        return (
          <div className="tw-flex tw-items-center" onClick={(e) => e.stopPropagation()}>
            <a
              href={`${API_BASE}${stationImage}`}
              target="_blank"
              rel="noreferrer"
              className="tw-group"
            >
              <div className="tw-w-10 tw-h-10 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 group-hover:tw-border-blue-400 tw-transition-colors">
                <img
                  src={`${API_BASE}${stationImage}`}
                  alt="Station"
                  className="tw-w-full tw-h-full tw-object-cover"
                />
              </div>
            </a>
          </div>
        );
      },
    },
    {
      id: "station_name",
      header: () => "Station Name",
      accessorFn: (row: StationRow) => row.station_name,
      cell: (info: any) => (
        <span className="tw-font-medium tw-text-blue-gray-900">
          {info.getValue()}
        </span>
      ),
    },
    {
      id: "charger_count",
      header: () => "Chargers",
      size: 100,
      cell: ({ row }: { row: Row<StationRow> }) => {
        const count = row.original.chargers.length;
        const onlineCount = row.original.chargers.filter(c => c.status).length;
        return (
          <div className="tw-flex tw-items-center tw-gap-2">
            <span className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-2.5 tw-py-1 tw-rounded-full tw-bg-gradient-to-r tw-from-amber-50 tw-to-yellow-50 tw-border tw-border-amber-200">
              <BoltIcon className="tw-h-4 tw-w-4 tw-text-amber-500" />
              <span className="tw-text-sm tw-font-semibold tw-text-amber-700">{count}</span>
            </span>
            {count > 0 && (
              <span className="tw-text-xs tw-text-blue-gray-400">
                ({onlineCount} online)
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "username",
      header: () => "Owner",
      accessorFn: (row: StationRow) => row.username ?? "-",
      cell: (info: any) => (
        <span className="tw-text-blue-gray-600">{info.getValue()}</span>
      ),
    },
    {
      id: "technician",
      header: () => "Technician",
      accessorFn: (row: StationRow) => {
        const techs = technicians.get(row.station_id);
        return techs ? techs.join(", ") : "-";
      },
      cell: (info: any) => (
        <span className="tw-text-blue-gray-500 tw-text-sm">{info.getValue()}</span>
      ),
    },
    {
      id: "is_active",
      header: () => "Active",
      size: 100,
      cell: ({ row }: { row: Row<StationRow> }) => {
        const on = !!row.original.is_active;
        return (
          <Chip
            size="sm"
            variant="ghost"
            value={on ? "Active" : "Inactive"}
            color={on ? "green" : "red"}
            className="tw-rounded-full tw-font-medium"
            icon={
              <span className={`tw-mx-auto tw-mt-1 tw-block tw-h-2 tw-w-2 tw-rounded-full tw-content-[''] ${on ? "tw-bg-green-500" : "tw-bg-red-500"}`} />
            }
          />
        );
      },
    },
    {
      id: "actions",
      header: () => "Actions",
      size: 100,
      enableSorting: false,
      cell: ({ row }: { row: Row<StationRow> }) => {
        const canEdit = isAdmin || row.original.user_id === me?.user_id;
        return (
          <span className="tw-inline-flex tw-items-center tw-gap-1" onClick={(e) => e.stopPropagation()}>
            {canEdit && (
              <Tooltip content="Edit Station">
                <button
                  onClick={(e) => handleEditStation(row.original, e)}
                  className="tw-rounded-lg tw-p-2 tw-border tw-border-blue-gray-100 hover:tw-bg-blue-50 hover:tw-border-blue-200 tw-transition-all tw-duration-200"
                >
                  <PencilSquareIcon className="tw-h-4 tw-w-4 tw-text-blue-600" />
                </button>
              </Tooltip>
            )}
            {isAdmin && (
              <Tooltip content="Delete Station">
                <button
                  onClick={(e) => handleDeleteStation(row.original, e)}
                  className="tw-rounded-lg tw-p-2 tw-border tw-border-blue-gray-100 hover:tw-bg-red-50 hover:tw-border-red-200 tw-transition-all tw-duration-200"
                >
                  <TrashIcon className="tw-h-4 tw-w-4 tw-text-red-500" />
                </button>
              </Tooltip>
            )}
          </span>
        );
      },
    },
  ], [me, technicians, isAdmin]);

  // ===== Table Instance =====
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: filtering, sorting, expanded },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFiltering,
    onExpandedChange: setExpanded,
    getRowCanExpand: (row) => row.original.chargers.length > 0 || isAdmin || row.original.user_id === me?.user_id,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  // ===== Charger Card Component (wider layout) =====
  const ChargerCard = ({ charger, stationId, canEdit, index }: { charger: ChargerData; stationId: string; canEdit: boolean; index: number }) => {
    const isOnline = !!charger.status;

    // Format date for display
    const formatDate = (dateStr: string) => {
      if (!dateStr || dateStr === "-") return "-";
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
      } catch {
        return dateStr;
      }
    };

    return (
      <div
        className="tw-relative tw-overflow-hidden tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-all tw-duration-200"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="tw-p-4">
          {/* Header */}
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-2 tw-mb-3">
            <div className="tw-flex tw-items-center tw-gap-2.5 tw-min-w-0 tw-flex-1">
              <div className={`tw-p-2 tw-rounded-lg tw-flex-shrink-0 ${isOnline ? "tw-bg-green-50" : "tw-bg-red-50"}`}>
                <BoltIcon className={`tw-h-5 tw-w-5 ${isOnline ? "tw-text-green-600" : "tw-text-red-500"}`} />
              </div>
              <div className="tw-min-w-0 tw-flex-1">
                <div className="tw-flex tw-items-center tw-gap-2">
                  <h4 className="tw-font-semibold tw-text-sm tw-text-blue-gray-800 tw-truncate" title={charger.chargeBoxID}>
                    {charger.chargeBoxID}
                  </h4>
                  <span className="tw-px-1.5 tw-py-0.5 tw-rounded tw-bg-blue-gray-100 tw-text-[10px] tw-font-bold tw-text-blue-gray-600">
                    #{charger.chargerNo}
                  </span>
                  <span className={`tw-px-1.5 tw-py-0.5 tw-rounded tw-text-[10px] tw-font-bold ${charger.is_active ? "tw-bg-green-100 tw-text-green-700" : "tw-bg-red-100 tw-text-red-700"}`}>
                    {charger.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="tw-flex tw-items-center tw-gap-1.5">
                  <span className={`tw-inline-block tw-h-2 tw-w-2 tw-rounded-full tw-flex-shrink-0 ${isOnline ? "tw-bg-green-500" : "tw-bg-red-500"}`} />
                  <span className={`tw-text-xs tw-font-medium ${isOnline ? "tw-text-green-600" : "tw-text-red-500"}`}>
                    {isOnline ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions - Fixed width */}
            <div className="tw-flex tw-items-center tw-gap-1 tw-flex-shrink-0">
              {canEdit && (
                <button
                  onClick={() => handleEditCharger(stationId, charger)}
                  className="tw-p-1.5 tw-rounded tw-text-blue-gray-400 hover:tw-text-blue-600 hover:tw-bg-blue-50 tw-transition-colors"
                  title="Edit"
                >
                  <PencilSquareIcon className="tw-h-4 tw-w-4" />
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => handleDeleteCharger(stationId, charger)}
                  className="tw-p-1.5 tw-rounded tw-text-blue-gray-400 hover:tw-text-red-500 hover:tw-bg-red-50 tw-transition-colors"
                  title="Delete"
                >
                  <TrashIcon className="tw-h-4 tw-w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Info - 2 columns */}
          <div className="tw-grid tw-grid-cols-2 tw-gap-x-3 tw-gap-y-1 tw-text-xs tw-mb-3">
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">Brand:</span> <span className="tw-text-blue-gray-700 tw-font-medium">{charger.brand}</span></div>
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">Model:</span> <span className="tw-text-blue-gray-700 tw-font-medium">{charger.model}</span></div>
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">S/N:</span> <span className="tw-text-blue-gray-700 tw-font-mono">{charger.SN}</span></div>
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">W/O:</span> <span className="tw-text-blue-gray-700 tw-font-mono">{charger.WO}</span></div>
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">Power:</span> <span className="tw-text-blue-gray-700 tw-font-medium">{charger.power} kW</span></div>
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">Cables:</span> <span className="tw-text-blue-gray-700 tw-font-medium">{charger.numberOfCables}</span></div>
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">Warranty:</span> <span className="tw-text-blue-gray-700 tw-font-medium">{charger.warrantyYears} year(s)</span></div>
          </div>

          {/* Commissioning Date */}
          <div className="tw-text-xs tw-mb-3 tw-px-2 tw-py-1.5 tw-rounded tw-bg-blue-50 tw-border tw-border-blue-100">
            <span className="tw-text-blue-gray-500">Commissioning Date:</span>{" "}
            <span className="tw-text-blue-700 tw-font-medium">{formatDate(charger.commissioningDate)}</span>
          </div>

          {/* Firmware */}
          <div className="tw-rounded-lg tw-bg-gray-50 tw-p-2.5">
            <div className="tw-flex tw-items-center tw-gap-1.5 tw-mb-2">
              <CpuChipIcon className="tw-h-3.5 tw-w-3.5 tw-text-blue-gray-400" />
              <span className="tw-text-[10px] tw-font-semibold tw-uppercase tw-text-blue-gray-500">Firmware</span>
            </div>
            <div className="tw-grid tw-grid-cols-3 tw-gap-2">
              <div className="tw-text-center tw-rounded-md tw-px-2 tw-py-1.5 tw-bg-white tw-border tw-border-blue-gray-100">
                <div className="tw-text-[10px] tw-text-blue-gray-400">PLC</div>
                <div className="tw-text-xs tw-font-mono tw-text-blue-gray-700 tw-truncate">{charger.PLCFirmware}</div>
              </div>
              <div className="tw-text-center tw-rounded-md tw-px-2 tw-py-1.5 tw-bg-white tw-border tw-border-blue-gray-100">
                <div className="tw-text-[10px] tw-text-blue-gray-400">Pi</div>
                <div className="tw-text-xs tw-font-mono tw-text-blue-gray-700 tw-truncate">{charger.PIFirmware}</div>
              </div>
              <div className="tw-text-center tw-rounded-md tw-px-2 tw-py-1.5 tw-bg-white tw-border tw-border-blue-gray-100">
                <div className="tw-text-[10px] tw-text-blue-gray-400">Router</div>
                <div className="tw-text-xs tw-font-mono tw-text-blue-gray-700 tw-truncate">{charger.RTFirmware}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===== Chargers Expanded Section =====
  const ChargersExpandedSection = ({ chargers, stationId, canEdit }: { chargers: ChargerData[]; stationId: string; canEdit: boolean }) => {
    const onlineCount = chargers.filter(c => c.status).length;
    const offlineCount = chargers.length - onlineCount;

    return (
      <tr>
        <td colSpan={columns.length} className="tw-p-0">
          <div className="tw-bg-gray-50/50 tw-border-t tw-border-blue-gray-100">
            {/* Section Header */}
            <div className="tw-px-6 tw-py-3 tw-border-b tw-border-blue-gray-100 tw-bg-white">
              <div className="tw-flex tw-items-center tw-justify-between">
                <div className="tw-flex tw-items-center tw-gap-3">
                  <span className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-2.5 tw-py-1 tw-rounded-full tw-bg-gradient-to-r tw-from-amber-50 tw-to-yellow-50 tw-border tw-border-amber-200">
                    <BoltIcon className="tw-h-4 tw-w-4 tw-text-amber-500" />
                    <span className="tw-text-sm tw-font-semibold tw-text-amber-700">Chargers ({chargers.length})</span>
                  </span>
                  <span className="tw-text-sm tw-text-green-600">
                    • {onlineCount} online
                  </span>
                  {offlineCount > 0 && (
                    <span className="tw-text-sm tw-text-red-500">
                      • {offlineCount} offline
                    </span>
                  )}
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    onClick={() => handleOpenAddCharger(stationId)}
                    className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black tw-flex tw-items-center tw-gap-1 tw-shadow-sm"
                  >
                    <BoltIcon className="tw-h-4 tw-w-4" />
                    + Add Charger
                  </Button>
                )}
              </div>
            </div>

            {/* Charger Cards Grid */}
            <div className="tw-p-4">
              {chargers.length > 0 ? (
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 xl:tw-grid-cols-4 tw-gap-4">
                  {chargers.map((charger, index) => (
                    <ChargerCard
                      key={charger.id || charger.chargeBoxID}
                      charger={charger}
                      stationId={stationId}
                      canEdit={canEdit}
                      index={index}
                    />
                  ))}
                </div>
              ) : (
                <div className="tw-text-center tw-py-8 tw-text-blue-gray-400">
                  <BoltIcon className="tw-h-12 tw-w-12 tw-mx-auto tw-mb-2 tw-opacity-30" />
                  <p>No chargers yet</p>
                  {canEdit && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenAddCharger(stationId)}
                      className="tw-mt-3 tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black"
                    >
                      + Add First Charger
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    );
  };

  // ===== Render =====
  return (
    <>
      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8">
        {notice && (
          <div className="tw-px-4 tw-pt-4">
            <Alert color={notice.type === "success" ? "green" : "red"} onClose={() => setNotice(null)}>
              {notice.msg}
            </Alert>
          </div>
        )}

        <CardHeader floated={false} shadow={false} className="tw-flex tw-flex-col md:tw-flex-row tw-items-start md:tw-items-center tw-gap-3 tw-!px-4 tw-!py-4 tw-mb-6">
          <div className="tw-ml-3">
            <Typography color="blue-gray" variant="h5">Station Management</Typography>
            <Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-normal tw-mt-1">
              Manage Stations and Chargers. Click on a row to view chargers.
            </Typography>
          </div>

          <div className="tw-w-full md:tw-w-auto md:tw-ml-auto md:tw-flex md:tw-justify-end">
            <Button
              onClick={() => setOpenAdd(true)}
              size="lg"
              className="tw-h-11 tw-rounded-xl tw-px-4 tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black tw-text-white tw-shadow-md"
            >
              + Add Station
            </Button>
          </div>
        </CardHeader>

        <CardBody className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-4">
          <div className="tw-flex tw-items-center tw-gap-3 tw-flex-none">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="tw-border tw-p-2 tw-border-blue-gray-100 tw-rounded-lg tw-w-[72px]"
            >
              {[5, 10, 15, 20, 25].map((pageSize) => (
                <option key={pageSize} value={pageSize}>{pageSize}</option>
              ))}
            </select>
            <Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-normal tw-hidden sm:tw-inline">
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
            />
          </div>
        </CardBody>

        <CardFooter className="tw-p-0">
          {loading ? (
            <div className="tw-p-4">Loading...</div>
          ) : err ? (
            <div className="tw-p-4 tw-text-red-600">{err}</div>
          ) : (
            <div className="tw-overflow-x-auto tw-w-full">
              <table className="tw-w-full tw-border-separate tw-border-spacing-0 tw-min-w-[900px]">
                <thead className="tw-bg-gray-50">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th
                          key={h.id}
                          onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                          className="tw-px-3 tw-py-3 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium tw-text-left tw-whitespace-nowrap"
                        >
                          <Typography
                            color="blue-gray"
                            className={`tw-flex tw-items-center tw-gap-2 tw-text-xs !tw-font-bold tw-leading-none tw-opacity-40 ${h.column.getCanSort() ? "tw-cursor-pointer" : ""}`}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {h.column.getCanSort() && <ChevronUpDownIcon strokeWidth={2} className="tw-h-4 tw-w-4" />}
                          </Typography>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>

                <tbody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => {
                      const hasChargers = row.original.chargers.length > 0;
                      const canEdit = isAdmin || row.original.user_id === me?.user_id;
                      const canExpand = hasChargers || canEdit;
                      
                      return (
                        <Fragment key={row.id}>
                          {/* Station Row - Clickable entire row */}
                          <tr
                            onClick={() => canExpand && row.toggleExpanded()}
                            className={`
                              tw-transition-colors
                              ${canExpand ? "tw-cursor-pointer" : ""}
                              ${row.getIsExpanded() 
                                ? "tw-bg-blue-50/70" 
                                : "odd:tw-bg-white even:tw-bg-gray-50 hover:tw-bg-blue-gray-50"
                              }
                            `}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id} className="!tw-border-y !tw-border-x-0 tw-px-3 tw-py-3">
                                <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-600">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </Typography>
                              </td>
                            ))}
                          </tr>

                          {/* Expanded Chargers Section */}
                          {row.getIsExpanded() && (
                            <ChargersExpandedSection
                              chargers={row.original.chargers}
                              stationId={row.original.station_id}
                              canEdit={canEdit}
                            />
                          )}
                        </Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="tw-px-4 tw-py-6 tw-text-center" colSpan={columns.length}>
                        No stations found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardFooter>

        {/* Pagination */}
        <div className="tw-flex tw-items-center tw-justify-end tw-gap-6 tw-px-10 tw-py-6">
          <span className="tw-flex tw-items-center tw-gap-1">
            <Typography className="!tw-font-bold">Page</Typography>
            <strong>{table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</strong>
          </span>
          <div className="tw-flex tw-items-center tw-gap-2">
            <Button variant="outlined" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="disabled:tw-opacity-30 tw-py-2 tw-px-2">
              <ChevronLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
            </Button>
            <Button variant="outlined" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="disabled:tw-opacity-30 tw-py-2 tw-px-2">
              <ChevronRightIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Add Station Modal */}
      <AddStation
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSubmit={handleCreateStation}
        loading={saving}
        currentUser={me?.username ?? ""}
        isAdmin={isAdmin}
        allOwners={usernames}
      />

      {/* Edit Station Modal */}
      <Dialog
        open={openEditStation}
        handler={() => setOpenEditStation(false)}
        size="md"
        dismiss={{ outsidePress: !saving, escapeKey: !saving }}
        className="tw-flex tw-flex-col tw-max-h-[90vh] tw-overflow-hidden"
      >
        <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-bg-white tw-px-6 tw-py-4 tw-border-b">
          <div className="tw-flex tw-items-center tw-justify-between tw-w-full">
            <Typography variant="h5" color="blue-gray">Edit Station</Typography>
            <Button variant="text" onClick={() => setOpenEditStation(false)}>✕</Button>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleUpdateStation(); }} className="tw-flex tw-flex-col tw-min-h-0">
          <DialogBody className="tw-flex-1 tw-overflow-y-auto tw-space-y-4 tw-px-6 tw-py-4">
            <Input
              label="Station Name"
              required
              value={editStationForm.station_name}
              onChange={(e) => setEditStationForm(s => ({ ...s, station_name: e.target.value }))}
              crossOrigin={undefined}
            />

            {isAdmin ? (
              <Select
                label="Owner"
                value={selectedOwnerId}
                onChange={(v) => setSelectedOwnerId(v ?? "")}
              >
                {owners.map(o => (
                  <Option key={o.user_id} value={o.user_id}>{o.username}</Option>
                ))}
              </Select>
            ) : (
              <Input label="Owner" value={editingStation?.username ?? "-"} readOnly className="!tw-bg-gray-100" crossOrigin={undefined} />
            )}

            <Select
              label="Status"
              value={String(editStationForm.is_active)}
              onChange={(v) => setEditStationForm(s => ({ ...s, is_active: v === "true" }))}
            >
              <Option value="true">Active</Option>
              <Option value="false">Inactive</Option>
            </Select>

            {/* Current Station Image */}
            <div className="tw-space-y-2">
              <div className="tw-flex tw-items-center tw-gap-2">
                <PhotoIcon className="tw-h-4 tw-w-4 tw-text-blue-gray-500" />
                <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-semibold">Station Image</Typography>
              </div>
              
              {/* Current image */}
              {editingStation?.stationImage ? (
                <div className="tw-flex tw-flex-col tw-items-start tw-gap-2">
                  <a href={`${API_BASE}${editingStation.stationImage}`} target="_blank" rel="noreferrer" className="tw-border-2 tw-border-blue-gray-100 hover:tw-border-blue-400 tw-rounded-lg tw-overflow-hidden tw-w-24 tw-h-24 tw-transition-colors">
                    <img src={`${API_BASE}${editingStation.stationImage}`} alt="Station" className="tw-w-full tw-h-full tw-object-cover" />
                  </a>
                  <span className="tw-text-xs tw-text-blue-gray-400">Current image</span>
                </div>
              ) : (
                <span className="tw-text-blue-gray-300 tw-text-sm">No image uploaded</span>
              )}

              {/* Upload new image */}
              <div className="tw-mt-3">
                <Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-medium tw-mb-2">Upload New Image</Typography>
                <input
                  ref={stationImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={pickStationImage}
                  className="tw-block tw-w-full tw-text-sm file:tw-mr-3 file:tw-px-4 file:tw-py-2 file:tw-rounded-lg file:tw-border-0 file:tw-bg-blue-50 file:tw-text-blue-600 file:tw-font-medium file:tw-cursor-pointer hover:file:tw-bg-blue-100"
                />
                {editStationPreview && (
                  <div className="tw-relative tw-inline-block tw-mt-3">
                    <img src={editStationPreview} alt="Preview" className="tw-h-24 tw-w-24 tw-object-cover tw-rounded-lg tw-border-2 tw-border-blue-200" />
                    <button type="button" onClick={clearStationImage} className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-6 tw-h-6 tw-text-sm tw-shadow-md hover:tw-bg-red-600 tw-transition-colors">×</button>
                  </div>
                )}
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-6 tw-py-3 tw-border-t">
            <div className="tw-flex tw-w-full tw-justify-end tw-gap-2">
              <Button variant="outlined" type="button" onClick={() => setOpenEditStation(false)}>Cancel</Button>
              <Button type="submit" className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Edit Charger Modal */}
      <Dialog
        open={openEditCharger}
        handler={() => setOpenEditCharger(false)}
        size="md"
        dismiss={{ outsidePress: !saving, escapeKey: !saving }}
        className="tw-flex tw-flex-col tw-max-h-[90vh] tw-overflow-hidden"
      >
        <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-bg-white tw-px-6 tw-py-4 tw-border-b">
          <div className="tw-flex tw-items-center tw-justify-between tw-w-full">
            <div className="tw-flex tw-items-center tw-gap-3">
              <div className="tw-p-2 tw-rounded-lg tw-bg-amber-100">
                <BoltIcon className="tw-h-5 tw-w-5 tw-text-amber-600" />
              </div>
              <Typography variant="h5" color="blue-gray">Edit Charger</Typography>
            </div>
            <Button variant="text" onClick={() => setOpenEditCharger(false)}>✕</Button>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleUpdateCharger(); }} className="tw-flex tw-flex-col tw-min-h-0">
          <DialogBody className="tw-flex-1 tw-overflow-y-auto tw-space-y-4 tw-px-6 tw-py-4">
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
              <Input label="Charger Box ID" required value={editChargerForm.chargeBoxID}
                onChange={(e) => setEditChargerForm(s => ({ ...s, chargeBoxID: e.target.value }))} crossOrigin={undefined} />
              <Input 
                label="Charger No." 
                type="number"
                value={editChargerForm.chargerNo}
                readOnly
                className="!tw-bg-gray-100"
                crossOrigin={undefined} 
              />
              <Input label="Brand" required value={editChargerForm.brand}
                onChange={(e) => setEditChargerForm(s => ({ ...s, brand: e.target.value }))} crossOrigin={undefined} />
              <Input label="Model" required value={editChargerForm.model}
                onChange={(e) => setEditChargerForm(s => ({ ...s, model: e.target.value }))} crossOrigin={undefined} />
              <Input label="Serial Number (S/N)" required value={editChargerForm.SN}
                onChange={(e) => setEditChargerForm(s => ({ ...s, SN: e.target.value }))} crossOrigin={undefined} />
              <Input label="Work Order (WO)" required value={editChargerForm.WO}
                onChange={(e) => setEditChargerForm(s => ({ ...s, WO: e.target.value }))} crossOrigin={undefined} />
              <Input 
                label="Power (kW)" 
                required
                value={editChargerForm.power}
                onChange={(e) => setEditChargerForm(s => ({ ...s, power: e.target.value }))} 
                crossOrigin={undefined} 
              />
              <Input label="PLC Firmware" required value={editChargerForm.PLCFirmware}
                onChange={(e) => setEditChargerForm(s => ({ ...s, PLCFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label="Raspberry Pi Firmware" required value={editChargerForm.PIFirmware}
                onChange={(e) => setEditChargerForm(s => ({ ...s, PIFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label="Router Firmware" required value={editChargerForm.RTFirmware}
                onChange={(e) => setEditChargerForm(s => ({ ...s, RTFirmware: e.target.value }))} crossOrigin={undefined} />
              
              {/* New Fields */}
              <Input 
                label="Commissioning Date" 
                type="date"
                value={editChargerForm.commissioningDate}
                onChange={(e) => setEditChargerForm(s => ({ ...s, commissioningDate: e.target.value }))} 
                crossOrigin={undefined} 
              />
              <Input 
                label="Warranty (Years)" 
                type="number"
                min={1}
                max={10}
                value={editChargerForm.warrantyYears}
                onChange={(e) => setEditChargerForm(s => ({ ...s, warrantyYears: parseInt(e.target.value) || 1 }))} 
                crossOrigin={undefined} 
              />
              <Input 
                label="Number of Cables" 
                type="number"
                min={1}
                max={10}
                value={editChargerForm.numberOfCables}
                onChange={(e) => setEditChargerForm(s => ({ ...s, numberOfCables: parseInt(e.target.value) || 1 }))} 
                crossOrigin={undefined} 
              />
              <Select
                label="Status"
                value={String(editChargerForm.is_active)}
                onChange={(v) => setEditChargerForm(s => ({ ...s, is_active: v === "true" }))}
              >
                <Option value="true">Active</Option>
                <Option value="false">Inactive</Option>
              </Select>
            </div>
          </DialogBody>

          <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-6 tw-py-3 tw-border-t">
            <div className="tw-flex tw-w-full tw-justify-end tw-gap-2">
              <Button variant="outlined" type="button" onClick={() => setOpenEditCharger(false)}>Cancel</Button>
              <Button type="submit" className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Add Charger Modal */}
      <Dialog
        open={openAddCharger}
        handler={() => setOpenAddCharger(false)}
        size="md"
        dismiss={{ outsidePress: !saving, escapeKey: !saving }}
        className="tw-flex tw-flex-col tw-max-h-[90vh] tw-overflow-hidden"
      >
        <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-bg-white tw-px-6 tw-py-4 tw-border-b">
          <div className="tw-flex tw-items-center tw-justify-between tw-w-full">
            <div className="tw-flex tw-items-center tw-gap-3">
              <div className="tw-p-2 tw-rounded-lg tw-bg-amber-50 tw-border tw-border-amber-200">
                <BoltIcon className="tw-h-5 tw-w-5 tw-text-amber-600" />
              </div>
              <div>
                <Typography variant="h5" color="blue-gray">Add Charger</Typography>
                <Typography variant="small" className="!tw-text-blue-gray-500">
                  Station: {addingChargerStationId}
                </Typography>
              </div>
            </div>
            <Button variant="text" onClick={() => setOpenAddCharger(false)}>✕</Button>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleCreateCharger(); }} className="tw-flex tw-flex-col tw-min-h-0">
          <DialogBody className="tw-flex-1 tw-overflow-y-auto tw-space-y-4 tw-px-6 tw-py-4">
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
              <Input label="Charger Box ID" required value={addChargerForm.chargeBoxID}
                onChange={(e) => setAddChargerForm(s => ({ ...s, chargeBoxID: e.target.value }))} crossOrigin={undefined} />
              
              {/* Charger No - Auto-generated, readonly */}
              <div className="tw-relative">
                <Input 
                  label="Charger No. (Auto)" 
                  type="number"
                  value={addChargerForm.chargerNo}
                  readOnly
                  className="!tw-bg-gray-100 !tw-cursor-not-allowed"
                  crossOrigin={undefined} 
                />
                <span className="tw-absolute tw-right-3 tw-top-1/2 tw--translate-y-1/2 tw-text-xs tw-text-blue-gray-400">
                  (Auto)
                </span>
              </div>

              <Input label="Brand" required value={addChargerForm.brand}
                onChange={(e) => setAddChargerForm(s => ({ ...s, brand: e.target.value }))} crossOrigin={undefined} />
              <Input label="Model" required value={addChargerForm.model}
                onChange={(e) => setAddChargerForm(s => ({ ...s, model: e.target.value }))} crossOrigin={undefined} />
              <Input label="Serial Number (S/N)" required value={addChargerForm.SN}
                onChange={(e) => setAddChargerForm(s => ({ ...s, SN: e.target.value }))} crossOrigin={undefined} />
              <Input label="Work Order (WO)" required value={addChargerForm.WO}
                onChange={(e) => setAddChargerForm(s => ({ ...s, WO: e.target.value }))} crossOrigin={undefined} />
              <Input 
                label="Power (kW)" 
                required
                value={addChargerForm.power}
                onChange={(e) => setAddChargerForm(s => ({ ...s, power: e.target.value }))} 
                crossOrigin={undefined} 
              />
              <Input label="PLC Firmware" required value={addChargerForm.PLCFirmware}
                onChange={(e) => setAddChargerForm(s => ({ ...s, PLCFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label="Raspberry Pi Firmware" required value={addChargerForm.PIFirmware}
                onChange={(e) => setAddChargerForm(s => ({ ...s, PIFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label="Router Firmware" required value={addChargerForm.RTFirmware}
                onChange={(e) => setAddChargerForm(s => ({ ...s, RTFirmware: e.target.value }))} crossOrigin={undefined} />
              
              {/* New Fields */}
              <Input 
                label="Commissioning Date" 
                type="date"
                required
                value={addChargerForm.commissioningDate}
                onChange={(e) => setAddChargerForm(s => ({ ...s, commissioningDate: e.target.value }))} 
                crossOrigin={undefined} 
              />
              <Input 
                label="Warranty (Years)" 
                type="number"
                min={1}
                max={10}
                required
                value={addChargerForm.warrantyYears}
                onChange={(e) => setAddChargerForm(s => ({ ...s, warrantyYears: parseInt(e.target.value) || 1 }))} 
                crossOrigin={undefined} 
              />
              <Input 
                label="Number of Cables" 
                type="number"
                min={1}
                max={10}
                required
                value={addChargerForm.numberOfCables}
                onChange={(e) => setAddChargerForm(s => ({ ...s, numberOfCables: parseInt(e.target.value) || 1 }))} 
                crossOrigin={undefined} 
              />
              <Select
                label="Status"
                value={String(addChargerForm.is_active)}
                onChange={(v) => setAddChargerForm(s => ({ ...s, is_active: v === "true" }))}
              >
                <Option value="true">Active</Option>
                <Option value="false">Inactive</Option>
              </Select>
            </div>
          </DialogBody>

          <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-6 tw-py-3 tw-border-t">
            <div className="tw-flex tw-w-full tw-justify-end tw-gap-2">
              <Button variant="outlined" type="button" onClick={() => setOpenAddCharger(false)}>Cancel</Button>
              <Button type="submit" className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black" disabled={saving}>
                {saving ? "Creating..." : "Create Charger"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

export default SearchDataTables;