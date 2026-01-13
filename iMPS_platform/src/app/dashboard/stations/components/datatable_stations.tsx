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

import { useRouter } from "next/navigation";

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
  chargerNo: number;
  brand: string;
  model: string;
  SN: string;
  WO: string;
  power: string;
  PLCFirmware: string;
  PIFirmware: string;
  RTFirmware: string;
  commissioningDate: string;
  warrantyYears: number;
  numberOfCables: number;
  is_active: boolean;
  status?: boolean;
  chargerImage?: string;
  deviceImage?: string;
};

type StationRow = {
  id?: string;
  station_id: string;
  station_name: string;
  owner: string;
  user_id: string;
  username: string;
  is_active: boolean;
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
type Lang = "th" | "en";

function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export function SearchDataTables() {
  const router = useRouter();
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

  // Add Charger Images
  const [addChargerImage, setAddChargerImage] = useState<File | null>(null);
  const [addDeviceImage, setAddDeviceImage] = useState<File | null>(null);
  const [addChargerPreview, setAddChargerPreview] = useState<string>("");
  const [addDevicePreview, setAddDevicePreview] = useState<string>("");
  const addChargerImageInputRef = useRef<HTMLInputElement | null>(null);
  const addDeviceImageInputRef = useRef<HTMLInputElement | null>(null);

  // Images for edit station
  const [editStationImage, setEditStationImage] = useState<File | null>(null);
  const [editStationPreview, setEditStationPreview] = useState<string>("");
  const [deleteCurrentImage, setDeleteCurrentImage] = useState(false);
  const stationImageInputRef = useRef<HTMLInputElement | null>(null);
  const [editChargerImage, setEditChargerImage] = useState<File | null>(null);
  const [editDeviceImage, setEditDeviceImage] = useState<File | null>(null);
  const [editChargerPreview, setEditChargerPreview] = useState<string>("");
  const [editDevicePreview, setEditDevicePreview] = useState<string>("");
  const [deleteChargerImage, setDeleteChargerImage] = useState(false);
  const [deleteDeviceImage, setDeleteDeviceImage] = useState(false);
  const chargerImageInputRef = useRef<HTMLInputElement | null>(null);
  const deviceImageInputRef = useRef<HTMLInputElement | null>(null);

  // ===== Language State =====
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") {
      setLang(savedLang);
    }

    const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => {
      setLang(e.detail.lang);
    };

    window.addEventListener("language:change", handleLangChange as EventListener);
    return () => {
      window.removeEventListener("language:change", handleLangChange as EventListener);
    };
  }, []);

  // ===== Translations =====
  const t = useMemo(() => {
    const translations = {
      th: {
        // Header
        stationManagement: "จัดการสถานี",
        stationManagementDesc: "จัดการสถานีและตู้ชาร์จ คลิกที่แถวเพื่อดูตู้ชาร์จ คลิกที่การ์ดตู้ชาร์จเพื่อดูรายละเอียด",
        addStation: "เพิ่มสถานี",
        add: "เพิ่ม",

        // Table
        entriesPerPage: "รายการต่อหน้า",
        search: "ค้นหา",
        images: "รูปภาพ",
        stationName: "ชื่อสถานี",
        chargers: "ตู้ชาร์จ",
        owner: "เจ้าของ",
        technician: "ช่างเทคนิค",
        active: "เปิดใช้งาน",
        inactive: "ปิดใช้งาน",
        actions: "จัดการ",
        online: "ออนไลน์",
        offline: "ออฟไลน์",

        // Charger Card
        brand: "ยี่ห้อ",
        model: "รุ่น",
        serialNumber: "S/N",
        workOrder: "W/O",
        power: "กำลังไฟ",
        cables: "สายชาร์จ",
        warranty: "รับประกัน",
        year: "ปี",
        firmware: "เฟิร์มแวร์",

        // Expanded Section
        addCharger: "+ เพิ่มตู้ชาร์จ",
        noChargersYet: "ยังไม่มีตู้ชาร์จ",
        addFirstCharger: "+ เพิ่มตู้ชาร์จแรก",

        // Dialogs
        editStation: "แก้ไขสถานี",
        editCharger: "แก้ไขตู้ชาร์จ",
        addChargerTitle: "เพิ่มตู้ชาร์จ",
        station: "สถานี",
        cancel: "ยกเลิก",
        save: "บันทึก",
        saving: "กำลังบันทึก...",
        create: "สร้างตู้ชาร์จ",
        creating: "กำลังสร้าง...",

        // Form Labels
        chargerBoxId: "รหัสตู้ชาร์จ",
        chargerNo: "ตู้ที่",
        auto: "อัตโนมัติ",
        plcFirmware: "เฟิร์มแวร์ PLC",
        piFirmware: "เฟิร์มแวร์ Raspberry Pi",
        routerFirmware: "เฟิร์มแวร์ Router",
        commissioningDate: "วันที่เริ่มใช้งาน",
        warrantyYears: "ระยะรับประกัน (ปี)",
        numberOfCables: "จำนวนสายชาร์จ",
        status: "สถานะ",

        // Images
        stationImage: "รูปสถานี",
        chargerImage: "รูปตู้ชาร์จ",
        deviceImage: "รูปอุปกรณ์",
        currentImage: "รูปปัจจุบัน",
        newImage: "รูปใหม่",
        uploadImage: "อัปโหลดรูป",
        replaceImage: "เปลี่ยนรูปใหม่",
        willBeDeleted: "จะถูกลบ",
        undo: "เลิกทำ",
        noImageUploaded: "ยังไม่มีรูป",
        clickToRemove: "คลิก × เพื่อลบ",

        // Pagination & Status
        page: "หน้า",
        of: "จาก",
        loading: "กำลังโหลด...",
        noStationsFound: "ไม่พบสถานี",

        // Tooltips
        editStationTooltip: "แก้ไขสถานี",
        deleteStationTooltip: "ลบสถานี",

        // Messages
        updateSuccess: "อัปเดตสำเร็จ",
        createSuccess: "สร้างสำเร็จ",
        deleteSuccess: "ลบสำเร็จ",
        chargerDeleted: "ลบตู้ชาร์จแล้ว",
        chargerCreated: "สร้างตู้ชาร์จสำเร็จ",
        chargerUpdated: "อัปเดตตู้ชาร์จสำเร็จ",
        stationUpdated: "อัปเดตสถานีสำเร็จ",
      },
      en: {
        // Header
        stationManagement: "Station Management",
        stationManagementDesc: "Manage Stations and Chargers. Click on a row to view chargers, click on a charger card to view details.",
        addStation: "ADD STATION",
        add: "ADD",

        // Table
        entriesPerPage: "entries per page",
        search: "Search",
        images: "Images",
        stationName: "Station Name",
        chargers: "Chargers",
        owner: "Owner",
        technician: "Technician",
        active: "Active",
        inactive: "Inactive",
        actions: "Actions",
        online: "online",
        offline: "offline",

        // Charger Card
        brand: "Brand",
        model: "Model",
        serialNumber: "S/N",
        workOrder: "W/O",
        power: "Power",
        cables: "Cables",
        warranty: "Warranty",
        year: "y",
        firmware: "Firmware",

        // Expanded Section
        addCharger: "+ Add Charger",
        noChargersYet: "No chargers yet",
        addFirstCharger: "+ Add First Charger",

        // Dialogs
        editStation: "Edit Station",
        editCharger: "Edit Charger",
        addChargerTitle: "Add Charger",
        station: "Station",
        cancel: "Cancel",
        save: "Save Changes",
        saving: "Saving...",
        create: "Create Charger",
        creating: "Creating...",

        // Form Labels
        chargerBoxId: "Charger Box ID",
        chargerNo: "Charger No.",
        auto: "Auto",
        plcFirmware: "PLC Firmware",
        piFirmware: "Raspberry Pi Firmware",
        routerFirmware: "Router Firmware",
        commissioningDate: "Commissioning Date",
        warrantyYears: "Warranty (Years)",
        numberOfCables: "Number of Cables",
        status: "Status",

        // Images
        stationImage: "Station Image",
        chargerImage: "Charger Image",
        deviceImage: "Device Image",
        currentImage: "Current image",
        newImage: "New",
        uploadImage: "Upload Image",
        replaceImage: "Replace with new image",
        willBeDeleted: "Will be deleted",
        undo: "Undo",
        noImageUploaded: "No image uploaded",
        clickToRemove: "click × to remove",

        // Pagination & Status
        page: "Page",
        of: "of",
        loading: "Loading...",
        noStationsFound: "No stations found",

        // Tooltips
        editStationTooltip: "Edit Station",
        deleteStationTooltip: "Delete Station",

        // Messages
        updateSuccess: "Updated successfully",
        createSuccess: "Created successfully",
        deleteSuccess: "Deleted successfully",
        chargerDeleted: "Charger deleted",
        chargerCreated: "Charger created successfully",
        chargerUpdated: "Charger updated successfully",
        stationUpdated: "Station updated successfully",
      },
    };
    return translations[lang];
  }, [lang]);

  // Date formatter based on language
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return "-";
    try {
      const date = new Date(dateStr);
      if (lang === "th") {
        const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        const day = date.getDate();
        const month = thaiMonths[date.getMonth()];
        const year = date.getFullYear() + 543;
        return `${day} ${month} ${year}`;
      }
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  // ===== Edit Charger Image Handlers =====
  const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

  const pickChargerImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { alert("Please select an image file only"); return; }
    if (f.size > MAX_IMAGE_BYTES) { alert("File is too large (max 3MB)"); return; }
    if (editChargerPreview) URL.revokeObjectURL(editChargerPreview);
    setEditChargerImage(f);
    setEditChargerPreview(URL.createObjectURL(f));
  };

  const pickDeviceImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { alert("Please select an image file only"); return; }
    if (f.size > MAX_IMAGE_BYTES) { alert("File is too large (max 3MB)"); return; }
    if (editDevicePreview) URL.revokeObjectURL(editDevicePreview);
    setEditDeviceImage(f);
    setEditDevicePreview(URL.createObjectURL(f));
  };

  const clearChargerImage = () => {
    if (editChargerPreview) URL.revokeObjectURL(editChargerPreview);
    setEditChargerImage(null);
    setEditChargerPreview("");
    if (chargerImageInputRef.current) chargerImageInputRef.current.value = "";
  };

  const clearDeviceImage = () => {
    if (editDevicePreview) URL.revokeObjectURL(editDevicePreview);
    setEditDeviceImage(null);
    setEditDevicePreview("");
    if (deviceImageInputRef.current) deviceImageInputRef.current.value = "";
  };

  const resetEditChargerImages = () => {
    if (editChargerPreview) URL.revokeObjectURL(editChargerPreview);
    if (editDevicePreview) URL.revokeObjectURL(editDevicePreview);
    setEditChargerImage(null);
    setEditDeviceImage(null);
    setEditChargerPreview("");
    setEditDevicePreview("");
    setDeleteChargerImage(false);
    setDeleteDeviceImage(false);
  };

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

  const resetEditImages = () => {
    if (editStationPreview) URL.revokeObjectURL(editStationPreview);
    setEditStationImage(null);
    setEditStationPreview("");
    setDeleteCurrentImage(false);
  };

  // ===== Add Charger Image Handlers =====
  const pickAddChargerImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { alert("Please select an image file only"); return; }
    if (f.size > MAX_IMAGE_BYTES) { alert("File is too large (max 3MB)"); return; }
    if (addChargerPreview) URL.revokeObjectURL(addChargerPreview);
    setAddChargerImage(f);
    setAddChargerPreview(URL.createObjectURL(f));
  };

  const pickAddDeviceImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { alert("Please select an image file only"); return; }
    if (f.size > MAX_IMAGE_BYTES) { alert("File is too large (max 3MB)"); return; }
    if (addDevicePreview) URL.revokeObjectURL(addDevicePreview);
    setAddDeviceImage(f);
    setAddDevicePreview(URL.createObjectURL(f));
  };

  const clearAddChargerImage = () => {
    if (addChargerPreview) URL.revokeObjectURL(addChargerPreview);
    setAddChargerImage(null);
    setAddChargerPreview("");
    if (addChargerImageInputRef.current) addChargerImageInputRef.current.value = "";
  };

  const clearAddDeviceImage = () => {
    if (addDevicePreview) URL.revokeObjectURL(addDevicePreview);
    setAddDeviceImage(null);
    setAddDevicePreview("");
    if (addDeviceImageInputRef.current) addDeviceImageInputRef.current.value = "";
  };

  const resetAddChargerImages = () => {
    if (addChargerPreview) URL.revokeObjectURL(addChargerPreview);
    if (addDevicePreview) URL.revokeObjectURL(addDevicePreview);
    setAddChargerImage(null);
    setAddDeviceImage(null);
    setAddChargerPreview("");
    setAddDevicePreview("");
  };

  // Clear selected_sn when visiting Stations page
  useEffect(() => {
    localStorage.removeItem("selected_sn");
    localStorage.removeItem("selected_charger_no");
    window.dispatchEvent(new CustomEvent("charger:deselected"));
  }, []);

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
      resetEditChargerImages();
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

  // Fetch charger status
  const fetchChargerStatuses = async (stations: StationRow[]) => {
    try {
      const updatedStations = await Promise.all(
        stations.map(async (station) => {
          if (station.chargers.length === 0) return station;

          const updatedChargers = await Promise.all(
            station.chargers.map(async (charger) => {
              try {
                const sn = charger.SN;
                if (!sn || sn === "-") return charger;

                const res = await apiFetch(`/charger-onoff/${sn}`);
                if (res.ok) {
                  const data = await res.json();
                  return { ...charger, status: !!data.status };
                }
              } catch (e) {
                console.error(`Failed to fetch status for charger SN ${charger.SN}:`, e);
              }
              return charger;
            })
          );

          return { ...station, chargers: updatedChargers };
        })
      );

      return updatedStations;
    } catch (e) {
      console.error("Failed to fetch charger statuses:", e);
      return stations;
    }
  };

  const refetchStations = async () => {
    try {
      const res = await apiFetch(`/all-stations/`);
      if (!res.ok) return;

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
        stationImage: s.stationImage ?? s.images?.station ?? "",
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
          chargerImage: c.chargerImage ?? c.images?.charger ?? "",
          deviceImage: c.deviceImage ?? c.images?.device ?? "",
        })) : [],
      }));

      const rowsWithStatus = await fetchChargerStatuses(rows);
      setData(rowsWithStatus);
    } catch (e) {
      console.error("Failed to refetch stations:", e);
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
            chargerImage: c.chargerImage ?? c.images?.charger ?? "",
            deviceImage: c.deviceImage ?? c.images?.device ?? "",
          })) : [],
        }));

        setData(rows);

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
    e.stopPropagation();
    if (!isAdmin && station.user_id !== me?.user_id) {
      alert("You don't have permission to edit this station");
      return;
    }
    setEditingStation(station);
    setOpenEditStation(true);
  };

  const handleEditCharger = (stationId: string, charger: ChargerData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCharger({ stationId, charger });
    setOpenEditCharger(true);
  };

  const handleChargerCardClick = (charger: ChargerData, stationId: string) => {
    const sn = charger.SN && charger.SN !== "-" ? charger.SN : "";
    const station = data.find(s => s.station_id === stationId);
    const stationName = station?.station_name || stationId;

    localStorage.removeItem("selected_sn");
    localStorage.removeItem("selected_station_id");
    localStorage.removeItem("selected_station_name");
    localStorage.removeItem("selected_charger_no");

    if (sn) localStorage.setItem("selected_sn", sn);
    if (stationId) localStorage.setItem("selected_station_id", stationId);
    localStorage.setItem("selected_station_name", stationName);
    if (charger.chargerNo) localStorage.setItem("selected_charger_no", String(charger.chargerNo));

    const params = new URLSearchParams();
    if (sn) params.set("sn", sn);
    if (stationId) params.set("station_id", stationId);

    const queryString = params.toString();
    router.push(`/dashboard/chargers${queryString ? `?${queryString}` : ""}`);
  };

  const handleUpdateStation = async () => {
    if (!editingStation?.id) return;
    try {
      setSaving(true);

      const payload: StationUpdatePayload = {
        station_name: editStationForm.station_name.trim(),
        is_active: editStationForm.is_active,
        ...(isAdmin && selectedOwnerId ? { user_id: selectedOwnerId } : {}),
      };

      const res = await apiFetch(`/update_stations/${editingStation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Update failed: ${res.status}`);

      const updated = await res.json();

      if (deleteCurrentImage && editingStation.stationImage) {
        await apiFetch(`/stations/${editingStation.station_id}/delete-image`, {
          method: "DELETE",
        });
      }

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
            station_name: updated.station_name ?? editStationForm.station_name,
            is_active: updated.is_active ?? editStationForm.is_active,
            user_id: updated.user_id ?? s.user_id,
            username: updated.username ?? s.username,
            stationImage: editStationImage
              ? s.stationImage
              : (deleteCurrentImage ? "" : s.stationImage),
          }
          : s
      ));

      setOpenEditStation(false);
      setNotice({ type: "success", msg: t.stationUpdated });
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

      const hasNewImages = editChargerImage || editDeviceImage;
      if (hasNewImages) {
        const formData = new FormData();
        if (editChargerImage) formData.append("charger", editChargerImage);
        if (editDeviceImage) formData.append("device", editDeviceImage);

        await apiFetch(`/chargers/${editingCharger.charger.id}/upload-images`, {
          method: "POST",
          body: formData,
        });
      }

      await refetchStations();

      setOpenEditCharger(false);
      setNotice({ type: "success", msg: t.chargerUpdated });
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
    e.stopPropagation();
    if (!station.id) return alert("Station ID not found");
    if (!confirm(`Are you sure you want to delete station "${station.station_name}" and all its chargers?`)) return;

    try {
      const res = await apiFetch(`/delete_stations/${station.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);

      setData(prev => prev.filter(s => s.id !== station.id));
      setNotice({ type: "success", msg: t.deleteSuccess });
      setTimeout(() => setNotice(null), 2500);
    } catch (e: any) {
      console.error(e);
      setNotice({ type: "error", msg: e.message || "Failed to delete station" });
      setTimeout(() => setNotice(null), 3500);
    }
  };

  const handleDeleteCharger = async (stationId: string, charger: ChargerData, e: React.MouseEvent) => {
    e.stopPropagation();
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

      setNotice({ type: "success", msg: t.chargerDeleted });
      setTimeout(() => setNotice(null), 2500);
    } catch (e: any) {
      console.error(e);
      setNotice({ type: "error", msg: e.message || "Failed to delete charger" });
      setTimeout(() => setNotice(null), 3500);
    }
  };

  const handleOpenAddCharger = (stationId: string) => {
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
    resetAddChargerImages();
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

      // Upload images if any
      if (created.id && (addChargerImage || addDeviceImage)) {
        const formData = new FormData();
        if (addChargerImage) formData.append("charger", addChargerImage);
        if (addDeviceImage) formData.append("device", addDeviceImage);

        await apiFetch(`/chargers/${created.id}/upload-images`, {
          method: "POST",
          body: formData,
        });
      }

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
        chargerImage: addChargerImage ? "pending" : "",
        deviceImage: addDeviceImage ? "pending" : "",
      };

      setData(prev => prev.map(station => {
        if (station.station_id !== addingChargerStationId) return station;
        return {
          ...station,
          chargers: [...station.chargers, newCharger],
        };
      }));

      // Refetch to get updated image paths
      if (addChargerImage || addDeviceImage) {
        await refetchStations();
      }

      resetAddChargerImages();
      setOpenAddCharger(false);
      setNotice({ type: "success", msg: t.chargerCreated });
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
        stationImage: "",
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
          status: false,
        })) : [],
      };

      setData(prev => [newStation, ...prev]);
      setOpenAdd(false);
      setNotice({ type: "success", msg: t.createSuccess });
      setTimeout(() => setNotice(null), 3000);

      return created;
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to create station");
      throw e;
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

  // ===== Columns =====
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
    // {
    //   id: "images",
    //   header: () => t.images,
    //   size: 80,
    //   cell: ({ row }: { row: Row<StationRow> }) => {
    //     const stationImage = row.original.stationImage;

    //     if (!stationImage) {
    //       return (
    //         <span className="tw-text-blue-gray-300 tw-text-xs tw-flex tw-items-center tw-gap-1">
    //           <PhotoIcon className="tw-h-4 tw-w-4" />
    //           <span>-</span>
    //         </span>
    //       );
    //     }

    //     return (
    //       <div className="tw-flex tw-items-center" onClick={(e) => e.stopPropagation()}>
    //         <a href={`${API_BASE}${stationImage}`} target="_blank" rel="noreferrer" className="tw-group">
    //           <div className="tw-w-10 tw-h-10 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 group-hover:tw-border-blue-400 tw-transition-colors">
    //             <img src={`${API_BASE}${stationImage}`} alt="Station" className="tw-w-full tw-h-full tw-object-cover" />
    //           </div>
    //         </a>
    //       </div>
    //     );
    //   },
    // },
    {
      id: "station_name",
      header: () => t.stationName,
      accessorFn: (row: StationRow) => row.station_name,
      cell: (info: any) => (
        <span className="tw-font-medium tw-text-blue-gray-900">{info.getValue()}</span>
      ),
    },
    {
      id: "charger_count",
      header: () => t.chargers,
      size: 100,
      cell: ({ row }: { row: Row<StationRow> }) => {
        const count = row.original.chargers.length;
        const onlineCount = row.original.chargers.filter(c => c.status).length;
        return (
          <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-start sm:tw-items-center tw-gap-0.5 sm:tw-gap-2">
            <span className="tw-inline-flex tw-items-center tw-gap-1 sm:tw-gap-1.5 tw-px-2 sm:tw-px-2.5 tw-py-0.5 sm:tw-py-1 tw-rounded-full tw-bg-gradient-to-r tw-from-amber-50 tw-to-yellow-50 tw-border tw-border-amber-200">
              <BoltIcon className="tw-h-3 tw-w-3 sm:tw-h-4 sm:tw-w-4 tw-text-amber-500" />
              <span className="tw-text-xs sm:tw-text-sm tw-font-semibold tw-text-amber-700">{count}</span>
            </span>
            {count > 0 && (
              <span className="tw-text-[10px] sm:tw-text-xs tw-text-blue-gray-400 tw-whitespace-nowrap">
                ({onlineCount} {t.online})
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "username",
      header: () => t.owner,
      accessorFn: (row: StationRow) => row.username ?? "-",
      cell: (info: any) => (
        <span className="tw-text-blue-gray-600">{info.getValue()}</span>
      ),
    },
    {
      id: "technician",
      header: () => t.technician,
      accessorFn: (row: StationRow) => {
        const techs = technicians.get(row.station_id);
        return techs ? techs.join(", ") : "-";
      },
      cell: ({ row }: { row: Row<StationRow> }) => {
        const techs = technicians.get(row.original.station_id);

        if (!techs || techs.length === 0) {
          return <span className="tw-text-blue-gray-400">-</span>;
        }

        if (techs.length === 1) {
          return <span className="tw-text-blue-gray-600 tw-text-sm">{techs[0]}</span>;
        }

        return (
          <div className="tw-flex tw-flex-col tw-gap-0.5">
            {techs.map((tech, idx) => (
              <span key={idx} className="tw-text-blue-gray-600 tw-text-xs sm:tw-text-sm tw-leading-tight">
                - {tech}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      id: "is_active",
      header: () => t.active,
      size: 100,
      cell: ({ row }: { row: Row<StationRow> }) => {
        const on = !!row.original.is_active;
        return (
          <Chip
            size="sm"
            variant="ghost"
            value={on ? t.active : t.inactive}
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
      header: () => t.actions,
      size: 100,
      enableSorting: false,
      cell: ({ row }: { row: Row<StationRow> }) => {
        const canEdit = isAdmin || row.original.user_id === me?.user_id;
        return (
          <span className="tw-inline-flex tw-items-center tw-gap-1" onClick={(e) => e.stopPropagation()}>
            {canEdit && (
              <Tooltip content={t.editStationTooltip}>
                <button
                  onClick={(e) => handleEditStation(row.original, e)}
                  className="tw-rounded-lg tw-p-2 tw-border tw-border-blue-gray-100 hover:tw-bg-blue-50 hover:tw-border-blue-200 tw-transition-all tw-duration-200"
                >
                  <PencilSquareIcon className="tw-h-4 tw-w-4 tw-text-blue-600" />
                </button>
              </Tooltip>
            )}
            {isAdmin && (
              <Tooltip content={t.deleteStationTooltip}>
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
  ], [me, technicians, isAdmin, t]);

  const handleSubmitImages = async (
    stationId: string,
    stationImages: { station: File | null; mdb: File | null },
    chargerImages: Array<{ chargerNo: number; chargerImage: File | null; deviceImage: File | null }>,
    createdChargers: Array<{ id: string; chargerNo: number }>
  ) => {
    try {
      if (stationImages.station) {
        const formData = new FormData();
        formData.append("station", stationImages.station);
        await apiFetch(`/stations/${stationId}/upload-image`, {
          method: "POST",
          body: formData,
        });
      }

      for (const chargerImg of chargerImages) {
        const createdCharger = createdChargers.find(c => c.chargerNo === chargerImg.chargerNo);
        if (!createdCharger?.id) continue;

        if (chargerImg.chargerImage || chargerImg.deviceImage) {
          const formData = new FormData();
          if (chargerImg.chargerImage) formData.append("charger", chargerImg.chargerImage);
          if (chargerImg.deviceImage) formData.append("device", chargerImg.deviceImage);

          await apiFetch(`/chargers/${createdCharger.id}/upload-images`, {
            method: "POST",
            body: formData,
          });
        }
      }

      await refetchStations();
    } catch (e) {
      console.error("[Images] Upload failed:", e);
    }
  };

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

  // ===== Charger Card Component =====
  const ChargerCard = ({ charger, stationId, canEdit, index }: { charger: ChargerData; stationId: string; canEdit: boolean; index: number }) => {
    const isOnline = !!charger.status;

    return (
      <div
        onClick={() => handleChargerCardClick(charger, stationId)}
        className="tw-relative tw-overflow-hidden tw-rounded-md sm:tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-all tw-duration-200 tw-cursor-pointer hover:tw-border-blue-300"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="tw-p-1.5 sm:tw-p-3 lg:tw-p-4">
          {/* Header */}
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-0.5 sm:tw-gap-2 tw-mb-1 sm:tw-mb-2">
            <div className="tw-flex tw-items-center tw-gap-1 sm:tw-gap-2 tw-min-w-0 tw-flex-1">
              <div className={`tw-p-0.5 sm:tw-p-1.5 tw-rounded sm:tw-rounded-lg tw-flex-shrink-0 ${isOnline ? "tw-bg-green-50" : "tw-bg-red-50"}`}>
                <BoltIcon className={`tw-h-2.5 tw-w-2.5 sm:tw-h-4 sm:tw-w-4 ${isOnline ? "tw-text-green-600" : "tw-text-red-500"}`} />
              </div>
              <div className="tw-min-w-0 tw-flex-1">
                <div className="tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-center tw-gap-0 sm:tw-gap-1">
                  <h4 className="tw-font-semibold tw-text-[8px] sm:tw-text-xs tw-text-blue-gray-800 tw-truncate" title={charger.chargeBoxID}>
                    {charger.chargeBoxID}
                  </h4>
                  <div className="tw-flex tw-items-center tw-gap-0.5">
                    <span className="tw-px-0.5 tw-py-0 tw-rounded tw-bg-blue-gray-100 tw-text-[6px] sm:tw-text-[8px] tw-font-bold tw-text-blue-gray-600">
                      #{charger.chargerNo}
                    </span>
                    <span className={`tw-px-0.5 tw-py-0 tw-rounded tw-text-[6px] sm:tw-text-[8px] tw-font-bold ${charger.is_active ? "tw-bg-green-100 tw-text-green-700" : "tw-bg-red-100 tw-text-red-700"}`}>
                      {charger.is_active ? t.active : t.inactive}
                    </span>
                  </div>
                </div>
                <div className="tw-flex tw-items-center tw-gap-0.5">
                  <span className={`tw-inline-block tw-h-1 tw-w-1 sm:tw-h-1.5 sm:tw-w-1.5 tw-rounded-full ${isOnline ? "tw-bg-green-500" : "tw-bg-red-500"}`} />
                  <span className={`tw-text-[6px] sm:tw-text-[10px] tw-font-medium ${isOnline ? "tw-text-green-600" : "tw-text-red-500"}`}>
                    {isOnline ? t.online : t.offline}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="tw-flex tw-items-center tw-flex-shrink-0">
              {canEdit && (
                <button onClick={(e) => handleEditCharger(stationId, charger, e)} className="tw-p-0.5 sm:tw-p-1 tw-rounded tw-text-blue-gray-400 hover:tw-text-blue-600 hover:tw-bg-blue-50">
                  <PencilSquareIcon className="tw-h-3 tw-w-3 sm:tw-h-3.5 sm:tw-w-3.5" />
                </button>
              )}
              {isAdmin && (
                <button onClick={(e) => handleDeleteCharger(stationId, charger, e)} className="tw-p-0.5 sm:tw-p-1 tw-rounded tw-text-blue-gray-400 hover:tw-text-red-500 hover:tw-bg-red-50">
                  <TrashIcon className="tw-h-3 tw-w-3 sm:tw-h-3.5 sm:tw-w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Info Grid */}
          <div className="tw-grid tw-grid-cols-2 tw-gap-x-1 sm:tw-gap-x-2 tw-gap-y-0 tw-text-[6px] sm:tw-text-[10px] tw-mb-1 sm:tw-mb-2">
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">{t.brand}:</span> <span className="tw-text-blue-gray-700 tw-font-medium">{charger.brand || "-"}</span></div>
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">{t.model}:</span> <span className="tw-text-blue-gray-700 tw-font-medium">{charger.model || "-"}</span></div>
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">{t.serialNumber}:</span> <span className="tw-text-blue-gray-700 tw-font-mono">{charger.SN || "-"}</span></div>
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">{t.workOrder}:</span> <span className="tw-text-blue-gray-700 tw-font-mono">{charger.WO || "-"}</span></div>
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">{t.power}:</span> <span className="tw-text-blue-gray-700 tw-font-medium">{charger.power || "-"}kW</span></div>
            <div className="tw-truncate"><span className="tw-text-blue-gray-400">{t.cables}:</span> <span className="tw-text-blue-gray-700 tw-font-medium">{charger.numberOfCables || "-"}</span></div>
            <div className="tw-col-span-2 tw-truncate"><span className="tw-text-blue-gray-400">{t.warranty}:</span> <span className="tw-text-blue-gray-700 tw-font-medium">{charger.warrantyYears || "-"}{t.year}</span></div>
          </div>

          {/* Commissioning Date */}
          <div className="tw-text-[6px] sm:tw-text-[10px] tw-mb-1 sm:tw-mb-2 tw-px-1 tw-py-0.5 tw-rounded tw-bg-blue-50 tw-border tw-border-blue-100">
            <span className="tw-text-blue-gray-500">📅</span>{" "}
            <span className="tw-text-blue-700 tw-font-medium">{formatDate(charger.commissioningDate)}</span>
          </div>

          {/* Firmware */}
          <div className="tw-rounded tw-bg-gray-50 tw-p-1 sm:tw-p-1.5">
            <div className="tw-flex tw-items-center tw-gap-0.5 tw-mb-0.5">
              <CpuChipIcon className="tw-h-2 tw-w-2 sm:tw-h-2.5 sm:tw-w-2.5 tw-text-blue-gray-400" />
              <span className="tw-text-[5px] sm:tw-text-[8px] tw-font-semibold tw-uppercase tw-text-blue-gray-500">{t.firmware}</span>
            </div>
            <div className="tw-grid tw-grid-cols-3 tw-gap-0.5">
              <div className="tw-text-center tw-rounded tw-px-0.5 tw-py-0.5 tw-bg-white tw-border tw-border-blue-gray-100">
                <div className="tw-text-[5px] sm:tw-text-[7px] tw-text-blue-gray-400">PLC</div>
                <div className="tw-text-[6px] sm:tw-text-[9px] tw-font-mono tw-text-blue-gray-700 tw-truncate">{charger.PLCFirmware || "-"}</div>
              </div>
              <div className="tw-text-center tw-rounded tw-px-0.5 tw-py-0.5 tw-bg-white tw-border tw-border-blue-gray-100">
                <div className="tw-text-[5px] sm:tw-text-[7px] tw-text-blue-gray-400">Pi</div>
                <div className="tw-text-[6px] sm:tw-text-[9px] tw-font-mono tw-text-blue-gray-700 tw-truncate">{charger.PIFirmware || "-"}</div>
              </div>
              <div className="tw-text-center tw-rounded tw-px-0.5 tw-py-0.5 tw-bg-white tw-border tw-border-blue-gray-100">
                <div className="tw-text-[5px] sm:tw-text-[7px] tw-text-blue-gray-400">RT</div>
                <div className="tw-text-[6px] sm:tw-text-[9px] tw-font-mono tw-text-blue-gray-700 tw-truncate">{charger.RTFirmware || "-"}</div>
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
            <div className="tw-px-3 sm:tw-px-6 tw-py-2 sm:tw-py-3 tw-border-b tw-border-blue-gray-100 tw-bg-white">
              <div className="tw-flex tw-items-center tw-justify-between tw-flex-wrap tw-gap-2">
                <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-3 tw-flex-wrap">
                  <span className="tw-inline-flex tw-items-center tw-gap-1 sm:tw-gap-1.5 tw-px-2 sm:tw-px-2.5 tw-py-0.5 sm:tw-py-1 tw-rounded-full tw-bg-gradient-to-r tw-from-amber-50 tw-to-yellow-50 tw-border tw-border-amber-200">
                    <BoltIcon className="tw-h-3 tw-w-3 sm:tw-h-4 sm:tw-w-4 tw-text-amber-500" />
                    <span className="tw-text-xs sm:tw-text-sm tw-font-semibold tw-text-amber-700">{t.chargers} ({chargers.length})</span>
                  </span>
                  <span className="tw-text-xs sm:tw-text-sm tw-text-green-600">
                    • {onlineCount} {t.online}
                  </span>
                  {offlineCount > 0 && (
                    <span className="tw-text-xs sm:tw-text-sm tw-text-red-500">
                      • {offlineCount} {t.offline}
                    </span>
                  )}
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    onClick={() => handleOpenAddCharger(stationId)}
                    className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black tw-flex tw-items-center tw-gap-1 tw-shadow-sm tw-text-xs sm:tw-text-sm tw-px-2 sm:tw-px-3 tw-py-1.5 sm:tw-py-2"
                  >
                    <BoltIcon className="tw-h-3 tw-w-3 sm:tw-h-4 sm:tw-w-4" />
                    <span className="tw-hidden sm:tw-inline">{t.addCharger}</span>
                    <span className="tw-inline sm:tw-hidden">+ {t.add}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Charger Cards Grid */}
            <div className="tw-p-2 sm:tw-p-4">
              {chargers.length > 0 ? (
                <div className="tw-grid tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-1.5 sm:tw-gap-3 lg:tw-gap-4">
                  {chargers.map((charger, index) => (
                    <ChargerCard key={charger.id || charger.chargeBoxID} charger={charger} stationId={stationId} canEdit={canEdit} index={index} />
                  ))}
                </div>
              ) : (
                <div className="tw-text-center tw-py-6 sm:tw-py-8 tw-text-blue-gray-400">
                  <BoltIcon className="tw-h-8 tw-w-8 sm:tw-h-12 sm:tw-w-12 tw-mx-auto tw-mb-2 tw-opacity-30" />
                  <p className="tw-text-xs sm:tw-text-sm">{t.noChargersYet}</p>
                  {canEdit && (
                    <Button size="sm" onClick={() => handleOpenAddCharger(stationId)} className="tw-mt-2 sm:tw-mt-3 tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black tw-text-xs">
                      {t.addFirstCharger}
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

        <CardHeader floated={false} shadow={false} className="tw-!px-4 sm:tw-!px-6 tw-!py-4">
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
            <div className="tw-min-w-0 tw-flex-1">
              <Typography color="blue-gray" variant="h5" className="tw-text-lg sm:tw-text-xl">
                {t.stationManagement}
              </Typography>
              <Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-normal tw-mt-1 tw-text-xs sm:tw-text-sm">
                {t.stationManagementDesc}
              </Typography>
            </div>
            <Button
              onClick={() => setOpenAdd(true)}
              size="sm"
              className="tw-flex tw-items-center tw-gap-1.5 tw-px-3 sm:tw-px-4 tw-py-2 sm:tw-py-2.5 tw-rounded-xl tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black tw-text-white tw-font-semibold tw-text-xs sm:tw-text-sm tw-shadow-md tw-flex-shrink-0 tw-normal-case"
            >
              <span className="tw-text-base tw-leading-none">+</span>
              <span className="tw-hidden sm:tw-inline">{t.addStation}</span>
              <span className="tw-inline sm:tw-hidden">{t.add}</span>
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
              {t.entriesPerPage}
            </Typography>
          </div>
          <div className="tw-ml-auto tw-min-w-0 tw-flex-1 md:tw-flex-none md:tw-w-64">
            <Input variant="outlined" value={filtering} onChange={(e) => setFiltering(e.target.value)} label={t.search} crossOrigin={undefined} />
          </div>
        </CardBody>

        <CardFooter className="tw-p-0">
          {loading ? (
            <div className="tw-p-4">{t.loading}</div>
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
                          <tr
                            onClick={() => canExpand && row.toggleExpanded()}
                            className={`tw-transition-colors ${canExpand ? "tw-cursor-pointer" : ""} ${row.getIsExpanded() ? "tw-bg-blue-50/70" : "odd:tw-bg-white even:tw-bg-gray-50 hover:tw-bg-blue-gray-50"}`}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <td key={cell.id} className="!tw-border-y !tw-border-x-0 tw-px-3 tw-py-3">
                                <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-600">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </Typography>
                              </td>
                            ))}
                          </tr>

                          {row.getIsExpanded() && (
                            <ChargersExpandedSection chargers={row.original.chargers} stationId={row.original.station_id} canEdit={canEdit} />
                          )}
                        </Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="tw-px-4 tw-py-6 tw-text-center" colSpan={columns.length}>
                        {t.noStationsFound}
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
            <Typography className="!tw-font-bold">{t.page}</Typography>
            <strong>{table.getState().pagination.pageIndex + 1} {t.of} {table.getPageCount()}</strong>
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
        onSubmitImages={handleSubmitImages}
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
            <Typography variant="h5" color="blue-gray">{t.editStation}</Typography>
            <Button variant="text" onClick={() => setOpenEditStation(false)}>✕</Button>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleUpdateStation(); }} className="tw-flex tw-flex-col tw-min-h-0">
          <DialogBody className="tw-flex-1 tw-overflow-y-auto tw-space-y-4 tw-px-6 tw-py-4">
            <Input
              label={t.stationName}
              required
              value={editStationForm.station_name}
              onChange={(e) => setEditStationForm(s => ({ ...s, station_name: e.target.value }))}
              crossOrigin={undefined}
            />

            {isAdmin ? (
              owners.length > 0 ? (
                <Select label={t.owner} value={selectedOwnerId} onChange={(v) => setSelectedOwnerId(v ?? "")}>
                  {owners.map(o => (
                    <Option key={o.user_id} value={o.user_id}>{o.username}</Option>
                  ))}
                </Select>
              ) : (
                <Input label={t.owner} value={t.loading} readOnly className="!tw-bg-gray-100" crossOrigin={undefined} />
              )
            ) : (
              <Input label={t.owner} value={editingStation?.username ?? "-"} readOnly className="!tw-bg-gray-100" crossOrigin={undefined} />
            )}

            <Select label={t.status} value={String(editStationForm.is_active)} onChange={(v) => setEditStationForm(s => ({ ...s, is_active: v === "true" }))}>
              <Option value="true">{t.active}</Option>
              <Option value="false">{t.inactive}</Option>
            </Select>

            {/* Station Image */}
            <div className="tw-space-y-2">
              <div className="tw-flex tw-items-center tw-gap-2">
                <PhotoIcon className="tw-h-4 tw-w-4 tw-text-blue-gray-500" />
                <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-semibold">{t.stationImage}</Typography>
              </div>

              {editingStation?.stationImage && !deleteCurrentImage ? (
                <div className="tw-flex tw-flex-col tw-items-start tw-gap-2">
                  <div className="tw-relative tw-inline-block">
                    <a href={`${API_BASE}${editingStation.stationImage}`} target="_blank" rel="noreferrer" className="tw-block tw-border-2 tw-border-blue-gray-100 hover:tw-border-blue-400 tw-rounded-lg tw-overflow-hidden tw-w-24 tw-h-24 tw-transition-colors">
                      <img src={`${API_BASE}${editingStation.stationImage}`} alt="Station" className="tw-w-full tw-h-full tw-object-cover" />
                    </a>
                    <button type="button" onClick={() => setDeleteCurrentImage(true)} className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-6 tw-h-6 tw-text-sm tw-shadow-md hover:tw-bg-red-600 tw-transition-colors tw-flex tw-items-center tw-justify-center">×</button>
                  </div>
                  <span className="tw-text-xs tw-text-blue-gray-400">{t.currentImage} ({t.clickToRemove})</span>
                </div>
              ) : deleteCurrentImage && editingStation?.stationImage ? (
                <div className="tw-flex tw-items-center tw-gap-2 tw-p-3 tw-rounded-lg tw-bg-red-50 tw-border tw-border-red-200">
                  <TrashIcon className="tw-h-4 tw-w-4 tw-text-red-500" />
                  <span className="tw-text-sm tw-text-red-600">{t.willBeDeleted}</span>
                  <button type="button" onClick={() => setDeleteCurrentImage(false)} className="tw-ml-auto tw-text-xs tw-text-blue-600 hover:tw-underline">{t.undo}</button>
                </div>
              ) : (
                <span className="tw-text-blue-gray-300 tw-text-sm">{t.noImageUploaded}</span>
              )}

              <div className="tw-mt-3">
                <Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-medium tw-mb-2">
                  {editingStation?.stationImage && !deleteCurrentImage ? t.replaceImage : t.uploadImage}
                </Typography>
                <input ref={stationImageInputRef} type="file" accept="image/*" onChange={pickStationImage} className="tw-block tw-w-full tw-text-sm file:tw-mr-3 file:tw-px-4 file:tw-py-2 file:tw-rounded-lg file:tw-border-0 file:tw-bg-blue-50 file:tw-text-blue-600 file:tw-font-medium file:tw-cursor-pointer hover:file:tw-bg-blue-100" />
                {editStationPreview && (
                  <div className="tw-relative tw-inline-block tw-mt-3">
                    <img src={editStationPreview} alt="Preview" className="tw-h-24 tw-w-24 tw-object-cover tw-rounded-lg tw-border-2 tw-border-green-200" />
                    <button type="button" onClick={clearStationImage} className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-6 tw-h-6 tw-text-sm tw-shadow-md hover:tw-bg-red-600 tw-transition-colors">×</button>
                    <span className="tw-block tw-text-xs tw-text-green-600 tw-mt-1">{t.newImage}</span>
                  </div>
                )}
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-6 tw-py-3 tw-border-t">
            <div className="tw-flex tw-w-full tw-justify-end tw-gap-2">
              <Button variant="outlined" type="button" onClick={() => setOpenEditStation(false)}>{t.cancel}</Button>
              <Button type="submit" className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black" disabled={saving}>
                {saving ? t.saving : t.save}
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
              <Typography variant="h5" color="blue-gray">{t.editCharger}</Typography>
            </div>
            <Button variant="text" onClick={() => setOpenEditCharger(false)}>✕</Button>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleUpdateCharger(); }} className="tw-flex tw-flex-col tw-min-h-0">
          <DialogBody className="tw-flex-1 tw-overflow-y-auto tw-space-y-4 tw-px-6 tw-py-4">
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
              <Input label={t.chargerBoxId} required value={editChargerForm.chargeBoxID} onChange={(e) => setEditChargerForm(s => ({ ...s, chargeBoxID: e.target.value }))} crossOrigin={undefined} />
              <Input label={`${t.chargerNo} (${t.auto})`} type="number" value={editChargerForm.chargerNo} readOnly className="!tw-bg-gray-100" crossOrigin={undefined} />
              <Input label={t.brand} required value={editChargerForm.brand} onChange={(e) => setEditChargerForm(s => ({ ...s, brand: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.model} required value={editChargerForm.model} onChange={(e) => setEditChargerForm(s => ({ ...s, model: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.serialNumber} required value={editChargerForm.SN} onChange={(e) => setEditChargerForm(s => ({ ...s, SN: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.workOrder} required value={editChargerForm.WO} onChange={(e) => setEditChargerForm(s => ({ ...s, WO: e.target.value }))} crossOrigin={undefined} />
              <Input label={`${t.power} (kW)`} required value={editChargerForm.power} onChange={(e) => setEditChargerForm(s => ({ ...s, power: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.plcFirmware} required value={editChargerForm.PLCFirmware} onChange={(e) => setEditChargerForm(s => ({ ...s, PLCFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.piFirmware} required value={editChargerForm.PIFirmware} onChange={(e) => setEditChargerForm(s => ({ ...s, PIFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.routerFirmware} required value={editChargerForm.RTFirmware} onChange={(e) => setEditChargerForm(s => ({ ...s, RTFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.commissioningDate} type="date" value={editChargerForm.commissioningDate} onChange={(e) => setEditChargerForm(s => ({ ...s, commissioningDate: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.warrantyYears} type="number" min={1} max={10} value={editChargerForm.warrantyYears} onChange={(e) => setEditChargerForm(s => ({ ...s, warrantyYears: parseInt(e.target.value) || 1 }))} crossOrigin={undefined} />
              <Input label={t.numberOfCables} type="number" min={1} max={10} value={editChargerForm.numberOfCables} onChange={(e) => setEditChargerForm(s => ({ ...s, numberOfCables: parseInt(e.target.value) || 1 }))} crossOrigin={undefined} />
              <Select label={t.status} value={String(editChargerForm.is_active)} onChange={(v) => setEditChargerForm(s => ({ ...s, is_active: v === "true" }))}>
                <Option value="true">{t.active}</Option>
                <Option value="false">{t.inactive}</Option>
              </Select>
            </div>

            {/* Charger Images Section */}
            <div className="tw-border-t tw-border-blue-gray-100 tw-pt-4 tw-mt-4">
              <div className="tw-flex tw-items-center tw-gap-2 tw-mb-4">
                <PhotoIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-500" />
                <Typography variant="h6" color="blue-gray">{t.chargerImage}</Typography>
              </div>

              <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
                {/* Charger Image */}
                <div className="tw-space-y-3">
                  <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-semibold">{t.chargerImage}</Typography>

                  {editingCharger?.charger.chargerImage && !deleteChargerImage ? (
                    <div className="tw-flex tw-flex-col tw-items-start tw-gap-2">
                      <div className="tw-relative tw-inline-block">
                        <a href={`${API_BASE}${editingCharger.charger.chargerImage}`} target="_blank" rel="noreferrer" className="tw-block tw-border-2 tw-border-blue-gray-100 hover:tw-border-blue-400 tw-rounded-lg tw-overflow-hidden tw-w-24 tw-h-24 tw-transition-colors">
                          <img src={`${API_BASE}${editingCharger.charger.chargerImage}`} alt="Charger" className="tw-w-full tw-h-full tw-object-cover" />
                        </a>
                        <button type="button" onClick={() => setDeleteChargerImage(true)} className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-6 tw-h-6 tw-text-sm tw-shadow-md hover:tw-bg-red-600 tw-transition-colors tw-flex tw-items-center tw-justify-center">×</button>
                      </div>
                      <span className="tw-text-xs tw-text-blue-gray-400">{t.currentImage}</span>
                    </div>
                  ) : deleteChargerImage && editingCharger?.charger.chargerImage ? (
                    <div className="tw-flex tw-items-center tw-gap-2 tw-p-2 tw-rounded-lg tw-bg-red-50 tw-border tw-border-red-200">
                      <TrashIcon className="tw-h-4 tw-w-4 tw-text-red-500" />
                      <span className="tw-text-xs tw-text-red-600">{t.willBeDeleted}</span>
                      <button type="button" onClick={() => setDeleteChargerImage(false)} className="tw-ml-auto tw-text-xs tw-text-blue-600 hover:tw-underline">{t.undo}</button>
                    </div>
                  ) : null}

                  <div>
                    <input ref={chargerImageInputRef} type="file" accept="image/*" onChange={pickChargerImage} className="tw-block tw-w-full tw-text-xs file:tw-mr-2 file:tw-px-3 file:tw-py-1.5 file:tw-rounded-lg file:tw-border-0 file:tw-bg-blue-50 file:tw-text-blue-600 file:tw-font-medium file:tw-cursor-pointer hover:file:tw-bg-blue-100" />
                    {editChargerPreview && (
                      <div className="tw-relative tw-inline-block tw-mt-2">
                        <img src={editChargerPreview} alt="Preview" className="tw-h-20 tw-w-20 tw-object-cover tw-rounded-lg tw-border-2 tw-border-green-200" />
                        <button type="button" onClick={clearChargerImage} className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-5 tw-h-5 tw-text-xs tw-shadow-md hover:tw-bg-red-600">×</button>
                        <span className="tw-block tw-text-xs tw-text-green-600 tw-mt-1">{t.newImage}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Device Image */}
                <div className="tw-space-y-3">
                  <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-semibold">{t.deviceImage}</Typography>

                  {editingCharger?.charger.deviceImage && !deleteDeviceImage ? (
                    <div className="tw-flex tw-flex-col tw-items-start tw-gap-2">
                      <div className="tw-relative tw-inline-block">
                        <a href={`${API_BASE}${editingCharger.charger.deviceImage}`} target="_blank" rel="noreferrer" className="tw-block tw-border-2 tw-border-blue-gray-100 hover:tw-border-blue-400 tw-rounded-lg tw-overflow-hidden tw-w-24 tw-h-24 tw-transition-colors">
                          <img src={`${API_BASE}${editingCharger.charger.deviceImage}`} alt="Device" className="tw-w-full tw-h-full tw-object-cover" />
                        </a>
                        <button type="button" onClick={() => setDeleteDeviceImage(true)} className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-6 tw-h-6 tw-text-sm tw-shadow-md hover:tw-bg-red-600 tw-transition-colors tw-flex tw-items-center tw-justify-center">×</button>
                      </div>
                      <span className="tw-text-xs tw-text-blue-gray-400">{t.currentImage}</span>
                    </div>
                  ) : deleteDeviceImage && editingCharger?.charger.deviceImage ? (
                    <div className="tw-flex tw-items-center tw-gap-2 tw-p-2 tw-rounded-lg tw-bg-red-50 tw-border tw-border-red-200">
                      <TrashIcon className="tw-h-4 tw-w-4 tw-text-red-500" />
                      <span className="tw-text-xs tw-text-red-600">{t.willBeDeleted}</span>
                      <button type="button" onClick={() => setDeleteDeviceImage(false)} className="tw-ml-auto tw-text-xs tw-text-blue-600 hover:tw-underline">{t.undo}</button>
                    </div>
                  ) : null}

                  <div>
                    <input ref={deviceImageInputRef} type="file" accept="image/*" onChange={pickDeviceImage} className="tw-block tw-w-full tw-text-xs file:tw-mr-2 file:tw-px-3 file:tw-py-1.5 file:tw-rounded-lg file:tw-border-0 file:tw-bg-blue-50 file:tw-text-blue-600 file:tw-font-medium file:tw-cursor-pointer hover:file:tw-bg-blue-100" />
                    {editDevicePreview && (
                      <div className="tw-relative tw-inline-block tw-mt-2">
                        <img src={editDevicePreview} alt="Preview" className="tw-h-20 tw-w-20 tw-object-cover tw-rounded-lg tw-border-2 tw-border-green-200" />
                        <button type="button" onClick={clearDeviceImage} className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-5 tw-h-5 tw-text-xs tw-shadow-md hover:tw-bg-red-600">×</button>
                        <span className="tw-block tw-text-xs tw-text-green-600 tw-mt-1">{t.newImage}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-6 tw-py-3 tw-border-t">
            <div className="tw-flex tw-w-full tw-justify-end tw-gap-2">
              <Button variant="outlined" type="button" onClick={() => setOpenEditCharger(false)}>{t.cancel}</Button>
              <Button type="submit" className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black" disabled={saving}>
                {saving ? t.saving : t.save}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Add Charger Modal */}
      <Dialog
        open={openAddCharger}
        handler={() => { resetAddChargerImages(); setOpenAddCharger(false); }}
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
                <Typography variant="h5" color="blue-gray">{t.addChargerTitle}</Typography>
                <Typography variant="small" className="!tw-text-blue-gray-500">
                  {t.station}: {addingChargerStationId}
                </Typography>
              </div>
            </div>
            <Button variant="text" onClick={() => { resetAddChargerImages(); setOpenAddCharger(false); }}>✕</Button>
          </div>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleCreateCharger(); }} className="tw-flex tw-flex-col tw-min-h-0">
          <DialogBody className="tw-flex-1 tw-overflow-y-auto tw-space-y-4 tw-px-6 tw-py-4">
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
              <Input label={t.chargerBoxId} required value={addChargerForm.chargeBoxID} onChange={(e) => setAddChargerForm(s => ({ ...s, chargeBoxID: e.target.value }))} crossOrigin={undefined} />
              <div className="tw-relative">
                <Input label={`${t.chargerNo} (${t.auto})`} type="number" value={addChargerForm.chargerNo} readOnly className="!tw-bg-gray-100 !tw-cursor-not-allowed" crossOrigin={undefined} />
              </div>
              <Input label={t.brand} required value={addChargerForm.brand} onChange={(e) => setAddChargerForm(s => ({ ...s, brand: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.model} required value={addChargerForm.model} onChange={(e) => setAddChargerForm(s => ({ ...s, model: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.serialNumber} required value={addChargerForm.SN} onChange={(e) => setAddChargerForm(s => ({ ...s, SN: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.workOrder} required value={addChargerForm.WO} onChange={(e) => setAddChargerForm(s => ({ ...s, WO: e.target.value }))} crossOrigin={undefined} />
              <Input label={`${t.power} (kW)`} required value={addChargerForm.power} onChange={(e) => setAddChargerForm(s => ({ ...s, power: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.plcFirmware} required value={addChargerForm.PLCFirmware} onChange={(e) => setAddChargerForm(s => ({ ...s, PLCFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.piFirmware} required value={addChargerForm.PIFirmware} onChange={(e) => setAddChargerForm(s => ({ ...s, PIFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.routerFirmware} required value={addChargerForm.RTFirmware} onChange={(e) => setAddChargerForm(s => ({ ...s, RTFirmware: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.commissioningDate} type="date" required value={addChargerForm.commissioningDate} onChange={(e) => setAddChargerForm(s => ({ ...s, commissioningDate: e.target.value }))} crossOrigin={undefined} />
              <Input label={t.warrantyYears} type="number" min={1} max={10} required value={addChargerForm.warrantyYears} onChange={(e) => setAddChargerForm(s => ({ ...s, warrantyYears: parseInt(e.target.value) || 1 }))} crossOrigin={undefined} />
              <Input label={t.numberOfCables} type="number" min={1} max={10} required value={addChargerForm.numberOfCables} onChange={(e) => setAddChargerForm(s => ({ ...s, numberOfCables: parseInt(e.target.value) || 1 }))} crossOrigin={undefined} />
              <Select label={t.status} value={String(addChargerForm.is_active)} onChange={(v) => setAddChargerForm(s => ({ ...s, is_active: v === "true" }))}>
                <Option value="true">{t.active}</Option>
                <Option value="false">{t.inactive}</Option>
              </Select>
            </div>

            {/* Charger Images Section */}
            <div className="tw-border-t tw-border-blue-gray-100 tw-pt-4 tw-mt-4">
              <div className="tw-flex tw-items-center tw-gap-2 tw-mb-4">
                <PhotoIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-500" />
                <Typography variant="h6" color="blue-gray">{t.chargerImage}</Typography>
              </div>

              <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
                {/* Charger Image */}
                <div className="tw-space-y-3">
                  <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-semibold">{t.chargerImage}</Typography>
                  <div>
                    <input ref={addChargerImageInputRef} type="file" accept="image/*" onChange={pickAddChargerImage} className="tw-block tw-w-full tw-text-xs file:tw-mr-2 file:tw-px-3 file:tw-py-1.5 file:tw-rounded-lg file:tw-border-0 file:tw-bg-blue-50 file:tw-text-blue-600 file:tw-font-medium file:tw-cursor-pointer hover:file:tw-bg-blue-100" />
                    {addChargerPreview && (
                      <div className="tw-relative tw-inline-block tw-mt-2">
                        <img src={addChargerPreview} alt="Preview" className="tw-h-20 tw-w-20 tw-object-cover tw-rounded-lg tw-border-2 tw-border-green-200" />
                        <button type="button" onClick={clearAddChargerImage} className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-5 tw-h-5 tw-text-xs tw-shadow-md hover:tw-bg-red-600">×</button>
                        <span className="tw-block tw-text-xs tw-text-green-600 tw-mt-1">{t.newImage}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Device Image */}
                <div className="tw-space-y-3">
                  <Typography variant="small" className="!tw-text-blue-gray-600 !tw-font-semibold">{t.deviceImage}</Typography>
                  <div>
                    <input ref={addDeviceImageInputRef} type="file" accept="image/*" onChange={pickAddDeviceImage} className="tw-block tw-w-full tw-text-xs file:tw-mr-2 file:tw-px-3 file:tw-py-1.5 file:tw-rounded-lg file:tw-border-0 file:tw-bg-blue-50 file:tw-text-blue-600 file:tw-font-medium file:tw-cursor-pointer hover:file:tw-bg-blue-100" />
                    {addDevicePreview && (
                      <div className="tw-relative tw-inline-block tw-mt-2">
                        <img src={addDevicePreview} alt="Preview" className="tw-h-20 tw-w-20 tw-object-cover tw-rounded-lg tw-border-2 tw-border-green-200" />
                        <button type="button" onClick={clearAddDeviceImage} className="tw-absolute tw--top-2 tw--right-2 tw-bg-red-500 tw-text-white tw-rounded-full tw-w-5 tw-h-5 tw-text-xs tw-shadow-md hover:tw-bg-red-600">×</button>
                        <span className="tw-block tw-text-xs tw-text-green-600 tw-mt-1">{t.newImage}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-6 tw-py-3 tw-border-t">
            <div className="tw-flex tw-w-full tw-justify-end tw-gap-2">
              <Button variant="outlined" type="button" onClick={() => { resetAddChargerImages(); setOpenAddCharger(false); }}>{t.cancel}</Button>
              <Button type="submit" className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black" disabled={saving}>
                {saving ? t.creating : t.create}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

export default SearchDataTables;