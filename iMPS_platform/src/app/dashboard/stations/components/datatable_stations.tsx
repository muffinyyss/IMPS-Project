"use client";
import ConfirmDialog from "./ConfirmDialog";
import LoadingOverlay from "../../components/Loadingoverlay";
import React, { useEffect, useState, useMemo, useRef, Fragment } from "react";
import {
  getCoreRowModel, getPaginationRowModel, getFilteredRowModel, getSortedRowModel, getExpandedRowModel,
  useReactTable, flexRender, type Row, type ExpandedState,
} from "@tanstack/react-table";
import {
  Button, Card, CardBody, CardHeader, Typography, CardFooter, Input, Alert,
  Dialog, DialogHeader, DialogBody, DialogFooter, Select, Option, Chip, Tooltip,
} from "@material-tailwind/react";
import {
  ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon, ChevronDownIcon,
  ChevronRightIcon as ChevronRightIconSolid, PencilSquareIcon, TrashIcon,
  BoltIcon, CpuChipIcon, PhotoIcon,
} from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import AddStation, { type NewStationPayload } from "@/app/dashboard/stations/components/addstations";
import { apiFetch } from "@/utils/api";

// const API_BASE = "http://localhost:8000";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

const imgUrl = (url: string) =>
  url.startsWith("http") ? url : `${API_BASE}${url}`;

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
  maximo_location: string;
  maximo_desc: string;
  ocppUrl: string;
  chargerType: string;
  status?: boolean;
  chargerImages?: string[];
  deviceImages?: string[];
};

type StationRow = {
  id?: string; station_id: string; station_name: string; owner: string;
  user_id: string; username: string; is_active: boolean;
  maximo_location: string; maximo_desc: string;
  stationImage?: string;
  mdbImages?: string[];   // ✅ เพิ่ม mdb images
  chargers: ChargerData[];
};

export type StationUpdatePayload = {
  station_id?: string; station_name?: string; username?: string;
  is_active?: boolean; user_id?: string; maximo_location?: string; maximo_desc?: string;
};

export type ChargerUpdatePayload = {
  chargeBoxID?: string; chargerNo?: number; brand?: string; model?: string;
  SN?: string; WO?: string; power?: string;
  PLCFirmware?: string; PIFirmware?: string; RTFirmware?: string;
  commissioningDate?: string; warrantyYears?: number; numberOfCables?: number;
  is_active?: boolean; maximo_location?: string; maximo_desc?: string; ocppUrl?: string;
  chargerType?: string;
};

type JwtClaims = { sub: string; user_id?: string; username?: string; role?: string; company?: string | null; station_ids?: string[]; exp?: number; };
function decodeJwt(token: string | null): JwtClaims | null { try { if (!token) return null; const payload = token.split(".")[1]; const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/")); return JSON.parse(json); } catch { return null; } }
type UsernamesResp = { username: string[] };
type Owner = { user_id: string; username: string };
type Lang = "th" | "en";
function getTodayDate(): string { return new Date().toISOString().split("T")[0]; }

/* ─────────────────────── Shared Sub-components ─────────────────────── */

const SectionIcon = ({ emoji }: { emoji: string }) => (
  <span className="tw-inline-flex tw-items-center tw-justify-center tw-h-7 tw-w-7 sm:tw-h-8 sm:tw-w-8 tw-rounded-xl tw-bg-gradient-to-br tw-shadow-lg tw-text-xs sm:tw-text-sm">
    {emoji}
  </span>
);

const ImageGallery = ({ previews, onRemove, emptyLabel }: {
  previews: string[];
  onRemove: (i: number) => void;
  emptyLabel: string;
}) => {
  if (!previews.length) {
    return (
      <div className="tw-flex tw-items-center tw-justify-center tw-h-14 sm:tw-h-[68px] tw-rounded-xl tw-border-2 tw-border-dashed tw-border-blue-gray-100">
        <span className="tw-text-[10px] sm:tw-text-[11px] tw-text-blue-gray-300 tw-select-none">{emptyLabel}</span>
      </div>
    );
  }
  return (
    <div className="tw-flex tw-flex-wrap tw-gap-1.5 sm:tw-gap-2">
      {previews.map((url, i) => (
        <div key={i} className="tw-group/img tw-relative tw-h-14 tw-w-14 sm:tw-h-[68px] sm:tw-w-[68px] tw-rounded-xl tw-overflow-hidden tw-ring-1 tw-ring-black/10 tw-shadow-sm hover:tw-shadow-md hover:tw-ring-blue-400/40 tw-transition-all tw-duration-200 hover:tw--translate-y-0.5">
          <img src={url} alt="" className="tw-h-full tw-w-full tw-object-cover" />
          <div className="tw-absolute tw-inset-0 tw-bg-black/0 group-hover/img:tw-bg-black/25 tw-transition-colors" />
          <button type="button" onClick={() => onRemove(i)} className="tw-absolute tw-top-0.5 tw-right-0.5 sm:tw-top-1 sm:tw-right-1 tw-h-5 tw-w-5 tw-rounded-full tw-bg-red-500 tw-text-white tw-flex tw-items-center tw-justify-center sm:tw-opacity-0 group-hover/img:tw-opacity-100 tw-shadow-lg tw-transition-all tw-duration-150 hover:tw-bg-red-600 hover:tw-scale-110 tw-text-[10px] tw-leading-none">✕</button>
          <span className="tw-absolute tw-bottom-0 tw-inset-x-0 tw-text-center tw-text-[8px] tw-font-medium tw-text-white tw-bg-gradient-to-t tw-from-black/40 tw-to-transparent tw-pt-3 tw-pb-0.5 tw-opacity-0 group-hover/img:tw-opacity-100 tw-transition-opacity">{i + 1}</span>
        </div>
      ))}
    </div>
  );
};

const UploadBtn = ({ label, onChange }: { label: string; onChange: React.ChangeEventHandler<HTMLInputElement>; }) => (
  <label className="tw-inline-flex tw-items-center tw-gap-1 sm:tw-gap-1.5 tw-px-2.5 sm:tw-px-3 tw-py-[5px] tw-rounded-lg tw-bg-white tw-border tw-border-blue-gray-200 tw-text-[10px] sm:tw-text-[11px] tw-font-semibold tw-text-blue-gray-600 tw-cursor-pointer hover:tw-border-blue-400 hover:tw-text-blue-600 hover:tw-bg-blue-50/50 tw-transition-all tw-duration-200 tw-shadow-sm hover:tw-shadow tw-select-none">
    <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-3 tw-w-3 sm:tw-h-3.5 sm:tw-w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
    {label}
    <input type="file" accept="image/*" multiple onChange={onChange} className="tw-hidden" />
  </label>
);

const ImageZone = ({ label, previews, onUpload, onRemove, emptyLabel, uploadLabel, existingImages, apiBase, onRemoveExisting }: {
  label: string; previews: string[]; onUpload: React.ChangeEventHandler<HTMLInputElement>;
  onRemove: (i: number) => void; emptyLabel: string; uploadLabel: string;
  existingImages?: string[]; apiBase?: string; onRemoveExisting?: (i: number) => void;
}) => (
  <div className="tw-space-y-1.5 sm:tw-space-y-2 tw-p-2.5 sm:tw-p-3 tw-rounded-xl tw-bg-blue-gray-50/40 tw-ring-1 tw-ring-blue-gray-100/60">
    <div className="tw-flex tw-items-center tw-justify-between tw-min-h-[28px]">
      <span className="tw-text-[10px] sm:tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-wider">{label}</span>
      <UploadBtn label={uploadLabel} onChange={onUpload} />
    </div>
    {existingImages && existingImages.length > 0 && (
      <div className="tw-flex tw-flex-wrap tw-gap-1.5 sm:tw-gap-2">
        {existingImages.map((url, i) => (
          <div key={`existing-${i}`} className="tw-group/img tw-relative tw-h-14 tw-w-14 sm:tw-h-[68px] sm:tw-w-[68px] tw-rounded-xl tw-overflow-hidden tw-ring-1 tw-ring-black/10 tw-shadow-sm hover:tw-shadow-md hover:tw-ring-blue-400/40 tw-transition-all tw-duration-200 hover:tw--translate-y-0.5">
            <a href={`${apiBase}${url}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="tw-block tw-h-full tw-w-full">
              <img src={`${apiBase}${url}`} alt={`${label} ${i + 1}`} className="tw-h-full tw-w-full tw-object-cover" />
            </a>
            <div className="tw-absolute tw-inset-0 tw-bg-black/0 group-hover/img:tw-bg-black/25 tw-transition-colors tw-pointer-events-none" />
            {onRemoveExisting && (
              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemoveExisting(i); }} className="tw-absolute tw-top-0.5 tw-right-0.5 sm:tw-top-1 sm:tw-right-1 tw-h-5 tw-w-5 tw-rounded-full tw-bg-red-500 tw-text-white tw-flex tw-items-center tw-justify-center sm:tw-opacity-0 group-hover/img:tw-opacity-100 tw-shadow-lg tw-transition-all tw-duration-150 hover:tw-bg-red-600 hover:tw-scale-110 tw-text-[10px] tw-leading-none tw-z-10">✕</button>
            )}
            <span className="tw-absolute tw-bottom-0 tw-inset-x-0 tw-text-center tw-text-[7px] tw-font-medium tw-text-white tw-bg-gradient-to-t tw-from-black/50 tw-to-transparent tw-pt-3 tw-pb-0.5 tw-pointer-events-none">Current {i + 1}</span>
          </div>
        ))}
      </div>
    )}
    <ImageGallery previews={previews} onRemove={onRemove} emptyLabel={existingImages && existingImages.length > 0 ? "" : emptyLabel} />
  </div>
);

const Spinner = () => (
  <svg className="tw-animate-spin tw-h-4 tw-w-4" viewBox="0 0 24 24" fill="none">
    <circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const SkeletonPulse = ({ className = "" }: { className?: string }) => (
  <div className={`tw-animate-pulse tw-rounded-lg tw-bg-white/10 ${className}`} />
);

const StatCardSkeleton = () => (
  <div className="tw-relative tw-overflow-hidden tw-rounded-2xl tw-bg-gradient-to-br tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-4 sm:tw-px-5 tw-py-3.5 sm:tw-py-4 tw-ring-1 tw-ring-white/10 tw-shadow-lg">
    <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
      <SkeletonPulse className="tw-h-8 tw-w-8 !tw-rounded-xl" />
      <SkeletonPulse className="tw-h-3 tw-w-16" />
    </div>
    <SkeletonPulse className="tw-h-8 tw-w-12" />
  </div>
);

const TableRowSkeleton = ({ cols }: { cols: number }) => (
  <tr className="tw-animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="tw-px-3 tw-py-4">
        <div className="tw-h-4 tw-rounded-md tw-bg-blue-gray-100/60" style={{ width: i === 0 ? 32 : `${50 + Math.random() * 40}%` }} />
      </td>
    ))}
  </tr>
);

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
  const [sorting, setSorting] = useState<any>([{ id: "station_name", desc: false }]);
  const [filtering, setFiltering] = useState("");
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [openAdd, setOpenAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void; loading: boolean; }>({ open: false, title: "", message: "", onConfirm: () => { }, loading: false });

  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false, loading: false }));
  const [availability, setAvailability] = useState<Map<string, { total: number; available: number }>>(new Map());
  const [chargerAvailability, setChargerAvailability] = useState<Map<string, { total: number; available: number }>>(new Map());

  const [openEditStation, setOpenEditStation] = useState(false);
  const [editingStation, setEditingStation] = useState<StationRow | null>(null);
  const [editStationForm, setEditStationForm] = useState({ station_name: "", is_active: true, maximo_location: "", maximo_desc: "" });

  const isFlexxfast = (brand: string) => brand.trim().toLowerCase() === "flexxfast";
  const [openEditCharger, setOpenEditCharger] = useState(false);
  const [editingCharger, setEditingCharger] = useState<{ stationId: string; charger: ChargerData } | null>(null);
  const [editChargerForm, setEditChargerForm] = useState({
    chargeBoxID: "", chargerNo: 1, brand: "", model: "", SN: "", WO: "", power: "",
    PLCFirmware: "", PIFirmware: "", RTFirmware: "", commissioningDate: "",
    warrantyYears: 1, numberOfCables: 1, is_active: true, maximo_location: "", maximo_desc: "", ocppUrl: "", chargerType: "DC",
  });

  const [openAddCharger, setOpenAddCharger] = useState(false);
  const [addingChargerStationId, setAddingChargerStationId] = useState<string>("");
  const [addChargerForm, setAddChargerForm] = useState({
    chargeBoxID: "", chargerNo: 1, brand: "", model: "", SN: "", WO: "", power: "",
    PLCFirmware: "", PIFirmware: "", RTFirmware: "", commissioningDate: getTodayDate(),
    warrantyYears: 1, numberOfCables: 1, is_active: true, maximo_location: "", maximo_desc: "", ocppUrl: "", chargerType: "DC",
  });

  const [addChargerImages, setAddChargerImages] = useState<File[]>([]);
  const [addDeviceImages, setAddDeviceImages] = useState<File[]>([]);
  const [addChargerPreviews, setAddChargerPreviews] = useState<string[]>([]);
  const [addDevicePreviews, setAddDevicePreviews] = useState<string[]>([]);

  const addChargerImageInputRef = useRef<HTMLInputElement | null>(null);
  const addDeviceImageInputRef = useRef<HTMLInputElement | null>(null);

  // ===== Edit Station Images =====
  const [editStationImages, setEditStationImages] = useState<File[]>([]);
  const [editStationPreviews, setEditStationPreviews] = useState<string[]>([]);
  const [editMdbImages, setEditMdbImages] = useState<File[]>([]);       // ✅ MDB
  const [editMdbPreviews, setEditMdbPreviews] = useState<string[]>([]); // ✅ MDB

  const [deleteCurrentImage, setDeleteCurrentImage] = useState(false);
  const stationImageInputRef = useRef<HTMLInputElement | null>(null);

  const [editChargerImages, setEditChargerImages] = useState<File[]>([]);
  const [editDeviceImages, setEditDeviceImages] = useState<File[]>([]);
  const [editChargerPreviews, setEditChargerPreviews] = useState<string[]>([]);
  const [editDevicePreviews, setEditDevicePreviews] = useState<string[]>([]);

  const [deleteChargerImage, setDeleteChargerImage] = useState(false);
  const [deleteDeviceImage, setDeleteDeviceImage] = useState(false);
  const [deletedExistingChargerIdxs, setDeletedExistingChargerIdxs] = useState<Set<number>>(new Set());
  const [deletedExistingDeviceIdxs, setDeletedExistingDeviceIdxs] = useState<Set<number>>(new Set());
  const chargerImageInputRef = useRef<HTMLInputElement | null>(null);
  const deviceImageInputRef = useRef<HTMLInputElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");

  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") setLang(savedLang);
    const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => { setLang(e.detail.lang); };
    window.addEventListener("language:change", handleLangChange as EventListener);
    return () => { window.removeEventListener("language:change", handleLangChange as EventListener); };
  }, []);

  const t = useMemo(() => {
    const translations = {
      th: {
        stationManagement: "จัดการสถานี", stationManagementDesc: "จัดการสถานีและตู้ชาร์จ คลิกที่แถวเพื่อดูตู้ชาร์จ คลิกที่การ์ดตู้ชาร์จเพื่อดูรายละเอียด",
        addStation: "เพิ่มสถานี", add: "เพิ่ม", entriesPerPage: "รายการต่อหน้า", search: "ค้นหา", images: "รูปภาพ",
        stationName: "ชื่อสถานี", chargers: "ตู้ชาร์จ", owner: "เจ้าของ", technician: "ช่างเทคนิค",
        active: "เปิดใช้งาน", inactive: "ปิดใช้งาน", actions: "จัดการ", online: "ออนไลน์", offline: "ออฟไลน์",
        maximoLocation: "Maximo Location", maximoDescription: "Maximo Description", ocppUrl: "OCPP URL", ocppSection: "🔌 OCPP",
        chargerBoxId: "รหัสตู้ชาร์จ (Charge Box ID)", chargerType: "ประเภทตู้ชาร์จ",
        brand: "ยี่ห้อ", model: "รุ่น", serialNumber: "S/N", workOrder: "W/O", power: "กำลังไฟ",
        cables: "สายชาร์จ", warranty: "รับประกัน", year: "ปี", firmware: "เฟิร์มแวร์",
        addCharger: "+ เพิ่มตู้ชาร์จ", noChargersYet: "ยังไม่มีตู้ชาร์จ", addFirstCharger: "+ เพิ่มตู้ชาร์จแรก",
        editStation: "แก้ไขสถานี", editCharger: "แก้ไขตู้ชาร์จ", addChargerTitle: "เพิ่มตู้ชาร์จ",
        station: "สถานี", cancel: "ยกเลิก", save: "บันทึก", saving: "กำลังบันทึก...",
        create: "สร้างตู้ชาร์จ", creating: "กำลังสร้าง...",
        chargerNo: "ตู้ที่", auto: "อัตโนมัติ", plcFirmware: "เฟิร์มแวร์ PLC", piFirmware: "เฟิร์มแวร์ Raspberry Pi",
        routerFirmware: "เฟิร์มแวร์ Router", commissioningDate: "วันที่เริ่มใช้งาน",
        warrantyYears: "ระยะรับประกัน (ปี)", numberOfCables: "จำนวนสายชาร์จ", status: "สถานะ",
        stationImage: "รูปสถานี", chargerImage: "รูปตู้ชาร์จ", deviceImage: "รูปอุปกรณ์", mdbImage: "MDB",
        currentImage: "รูปปัจจุบัน", newImage: "รูปใหม่", uploadImage: "อัปโหลดรูป", replaceImage: "เปลี่ยนรูปใหม่",
        willBeDeleted: "จะถูกลบ", undo: "เลิกทำ", noImageUploaded: "ยังไม่มีรูป", clickToRemove: "คลิก × เพื่อลบ",
        page: "หน้า", of: "จาก", loading: "กำลังโหลด...", noStationsFound: "ไม่พบสถานี",
        editStationTooltip: "แก้ไขสถานี", deleteStationTooltip: "ลบสถานี",
        updateSuccess: "อัปเดตสำเร็จ", createSuccess: "สร้างสำเร็จ", deleteSuccess: "ลบสำเร็จ",
        chargerDeleted: "ลบตู้ชาร์จแล้ว", chargerCreated: "สร้างตู้ชาร์จสำเร็จ",
        chargerUpdated: "อัปเดตตู้ชาร์จสำเร็จ", stationUpdated: "อัปเดตสถานีสำเร็จ",
        available: "พร้อมใช้งาน", availableOf: "หัว",
        stationInfo: "ข้อมูลสถานี", chargerInfo: "ข้อมูลตู้ชาร์จ",
        upload: "เลือกรูป", noImages: "ยังไม่มีรูป",
        stationImages: "รูปภาพสถานี", chargerImages: "รูปภาพ",
        duplicateChargeBoxID: "Charge Box ID ซ้ำกัน กรุณาตรวจสอบ",
      },
      en: {
        stationManagement: "Station Management", stationManagementDesc: "Manage Stations and Chargers. Click on a row to view chargers, click on a charger card to view details.",
        addStation: "ADD STATION", add: "ADD", entriesPerPage: "entries per page", search: "Search", images: "Images",
        stationName: "Station Name", chargers: "Chargers", owner: "Owner", technician: "Technician",
        active: "Active", inactive: "Inactive", actions: "Actions", online: "online", offline: "offline",
        maximoLocation: "Maximo Location", maximoDescription: "Maximo Description", ocppUrl: "OCPP URL", ocppSection: "🔌 OCPP",
        chargerBoxId: "Charge Box ID", chargerType: "Charger Type",
        brand: "Brand", model: "Model", serialNumber: "S/N", workOrder: "W/O", power: "Power",
        cables: "Cables", warranty: "Warranty", year: "y", firmware: "Firmware",
        addCharger: "+ Add Charger", noChargersYet: "No chargers yet", addFirstCharger: "+ Add First Charger",
        editStation: "Edit Station", editCharger: "Edit Charger", addChargerTitle: "Add Charger",
        station: "Station", cancel: "Cancel", save: "Save Changes", saving: "Saving...",
        create: "Create Charger", creating: "Creating...",
        chargerNo: "Charger No.", auto: "Auto", plcFirmware: "PLC Firmware", piFirmware: "Raspberry Pi Firmware",
        routerFirmware: "Router Firmware", commissioningDate: "Commissioning Date",
        warrantyYears: "Warranty (Years)", numberOfCables: "Number of Cables", status: "Status",
        stationImage: "Station Image", chargerImage: "Charger Image", deviceImage: "Device Image", mdbImage: "MDB",
        currentImage: "Current image", newImage: "New", uploadImage: "Upload Image", replaceImage: "Replace with new image",
        willBeDeleted: "Will be deleted", undo: "Undo", noImageUploaded: "No image uploaded", clickToRemove: "click × to remove",
        page: "Page", of: "of", loading: "Loading...", noStationsFound: "No stations found",
        editStationTooltip: "Edit Station", deleteStationTooltip: "Delete Station",
        updateSuccess: "Updated successfully", createSuccess: "Created successfully", deleteSuccess: "Deleted successfully",
        chargerDeleted: "Charger deleted", chargerCreated: "Charger created successfully",
        chargerUpdated: "Charger updated successfully", stationUpdated: "Station updated successfully",
        available: "Available", availableOf: "heads",
        stationInfo: "Station Information", chargerInfo: "Charger Information",
        upload: "Browse", noImages: "No images yet",
        stationImages: "Station Images", chargerImages: "Images",
        duplicateChargeBoxID: "Duplicate Charge Box ID found, please check",
      },
    };
    return translations[lang];
  }, [lang]);

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return "-";
    try {
      const date = new Date(dateStr);
      if (lang === "th") {
        const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
      }
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch { return dateStr; }
  };

  // ===== Image handlers =====
  const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

  const pickChargerImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => { if (!f.type.startsWith("image/")) { alert("Please select image files only"); return false; } if (f.size > MAX_IMAGE_BYTES) { alert(`${f.name} is too large (max 3MB)`); return false; } return true; });
    if (!valid.length) return;
    setEditChargerImages(prev => [...prev, ...valid]);
    setEditChargerPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const pickDeviceImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => { if (!f.type.startsWith("image/")) { alert("Please select image files only"); return false; } if (f.size > MAX_IMAGE_BYTES) { alert(`${f.name} is too large (max 3MB)`); return false; } return true; });
    if (!valid.length) return;
    setEditDeviceImages(prev => [...prev, ...valid]);
    setEditDevicePreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeEditChargerImage = (idx: number) => { URL.revokeObjectURL(editChargerPreviews[idx]); setEditChargerImages(prev => prev.filter((_, i) => i !== idx)); setEditChargerPreviews(prev => prev.filter((_, i) => i !== idx)); };
  const removeEditDeviceImage = (idx: number) => { URL.revokeObjectURL(editDevicePreviews[idx]); setEditDeviceImages(prev => prev.filter((_, i) => i !== idx)); setEditDevicePreviews(prev => prev.filter((_, i) => i !== idx)); };
  const resetEditChargerImages = () => { editChargerPreviews.forEach(u => URL.revokeObjectURL(u)); editDevicePreviews.forEach(u => URL.revokeObjectURL(u)); setEditChargerImages([]); setEditDeviceImages([]); setEditChargerPreviews([]); setEditDevicePreviews([]); setDeleteChargerImage(false); setDeleteDeviceImage(false); setDeletedExistingChargerIdxs(new Set()); setDeletedExistingDeviceIdxs(new Set()); };

  const pickStationImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => { if (!f.type.startsWith("image/")) { alert("Please select image files only"); return false; } if (f.size > MAX_IMAGE_BYTES) { alert(`${f.name} is too large (max 3MB)`); return false; } return true; });
    if (!valid.length) return;
    setEditStationImages(prev => [...prev, ...valid]);
    setEditStationPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  // ✅ MDB image handler
  const pickMdbImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => { if (!f.type.startsWith("image/")) { alert("Please select image files only"); return false; } if (f.size > MAX_IMAGE_BYTES) { alert(`${f.name} is too large (max 3MB)`); return false; } return true; });
    if (!valid.length) return;
    setEditMdbImages(prev => [...prev, ...valid]);
    setEditMdbPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeEditStationImage = (idx: number) => { URL.revokeObjectURL(editStationPreviews[idx]); setEditStationImages(prev => prev.filter((_, i) => i !== idx)); setEditStationPreviews(prev => prev.filter((_, i) => i !== idx)); };
  const removeEditMdbImage = (idx: number) => { URL.revokeObjectURL(editMdbPreviews[idx]); setEditMdbImages(prev => prev.filter((_, i) => i !== idx)); setEditMdbPreviews(prev => prev.filter((_, i) => i !== idx)); }; // ✅

  // ✅ resetEditImages ล้าง MDB ด้วย
  const resetEditImages = () => {
    editStationPreviews.forEach(u => URL.revokeObjectURL(u));
    editMdbPreviews.forEach(u => URL.revokeObjectURL(u));
    setEditStationImages([]); setEditStationPreviews([]);
    setEditMdbImages([]); setEditMdbPreviews([]);
    setDeleteCurrentImage(false);
  };

  const pickAddChargerImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => { if (!f.type.startsWith("image/")) { alert("Please select image files only"); return false; } if (f.size > MAX_IMAGE_BYTES) { alert(`${f.name} is too large (max 3MB)`); return false; } return true; });
    if (!valid.length) return;
    setAddChargerImages(prev => [...prev, ...valid]);
    setAddChargerPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const pickAddDeviceImage: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => { if (!f.type.startsWith("image/")) { alert("Please select image files only"); return false; } if (f.size > MAX_IMAGE_BYTES) { alert(`${f.name} is too large (max 3MB)`); return false; } return true; });
    if (!valid.length) return;
    setAddDeviceImages(prev => [...prev, ...valid]);
    setAddDevicePreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeAddChargerImage = (idx: number) => { URL.revokeObjectURL(addChargerPreviews[idx]); setAddChargerImages(prev => prev.filter((_, i) => i !== idx)); setAddChargerPreviews(prev => prev.filter((_, i) => i !== idx)); };
  const removeAddDeviceImage = (idx: number) => { URL.revokeObjectURL(addDevicePreviews[idx]); setAddDeviceImages(prev => prev.filter((_, i) => i !== idx)); setAddDevicePreviews(prev => prev.filter((_, i) => i !== idx)); };
  const resetAddChargerImages = () => { addChargerPreviews.forEach(u => URL.revokeObjectURL(u)); addDevicePreviews.forEach(u => URL.revokeObjectURL(u)); setAddChargerImages([]); setAddDeviceImages([]); setAddChargerPreviews([]); setAddDevicePreviews([]); };

  useEffect(() => { localStorage.removeItem("selected_sn"); localStorage.removeItem("selected_charger_no"); window.dispatchEvent(new CustomEvent("charger:deselected")); }, []);

  useEffect(() => {
    if (data.length === 0) return;
    let stopped = false;
    const poll = async () => { if (stopped) return; try { await fetchAvailability(data); } catch (e: any) { if (e?.status === 401 || e?.message?.includes("401")) { stopped = true; return; } console.error("[availability poll] error:", e); } };
    const interval = setInterval(poll, 10000);
    return () => { stopped = true; clearInterval(interval); };
  }, [data]);

  useEffect(() => {
    if (openEditStation && editingStation) {
      setEditStationForm({ station_name: editingStation.station_name ?? "", is_active: !!editingStation.is_active, maximo_location: editingStation.maximo_location ?? "", maximo_desc: editingStation.maximo_desc ?? "" });
      setSelectedOwnerId(editingStation.user_id ?? "");
      resetEditImages();
    }
  }, [openEditStation, editingStation]);

  useEffect(() => {
    if (openEditCharger && editingCharger) {
      const c = editingCharger.charger;
      setEditChargerForm({ chargeBoxID: c.chargeBoxID ?? "", chargerNo: c.chargerNo ?? 1, brand: c.brand ?? "", model: c.model ?? "", SN: c.SN ?? "", WO: c.WO ?? "", power: c.power ?? "", PLCFirmware: c.PLCFirmware ?? "", PIFirmware: c.PIFirmware ?? "", RTFirmware: c.RTFirmware ?? "", commissioningDate: c.commissioningDate ?? "", warrantyYears: c.warrantyYears ?? 1, numberOfCables: c.numberOfCables ?? 1, is_active: c.is_active ?? true, maximo_location: c.maximo_location ?? "", maximo_desc: c.maximo_desc ?? "", ocppUrl: c.ocppUrl ?? "", chargerType: c.chargerType ?? "DC" });
      resetEditChargerImages();
    }
  }, [openEditCharger, editingCharger]);

  useEffect(() => { (async () => { if (me?.role !== "admin") return; const res = await apiFetch(`/owners`); const json = await res.json(); setOwners(Array.isArray(json.owners) ? json.owners : []); })(); }, [me?.role]);
  useEffect(() => { (async () => { if (me?.role !== "admin") return; const res = await apiFetch(`/username`); if (!res.ok) return; const json: UsernamesResp = await res.json(); setUsernames(Array.isArray(json.username) ? json.username : []); })(); }, [me?.role]);
  useEffect(() => { (async () => { try { const res = await apiFetch(`/all-users/`); if (!res.ok) return; const json = await res.json(); const users = Array.isArray(json?.users) ? json.users : []; const technicianMap = new Map<string, string[]>(); users.forEach((user: any) => { if (user.role === "technician" && user.station_id && Array.isArray(user.station_id)) { user.station_id.forEach((stationId: string) => { if (!technicianMap.has(stationId)) technicianMap.set(stationId, []); technicianMap.get(stationId)!.push(user.username); }); } }); setTechnicians(technicianMap); } catch (e) { console.error("Failed to fetch technicians:", e); } })(); }, []);

  const fetchChargerStatuses = async (stations: StationRow[]) => {
    try {
      return await Promise.all(stations.map(async (station) => {
        if (station.chargers.length === 0) return station;
        const updatedChargers = await Promise.all(station.chargers.map(async (charger) => {
          try { const sn = charger.SN; if (!sn || sn === "-") return charger; const res = await apiFetch(`/charger-onoff/${sn}`); if (res.ok) { const d = await res.json(); return { ...charger, status: !!d.status }; } } catch (e) { console.error(`Failed to fetch status for charger SN ${charger.SN}:`, e); }
          return charger;
        }));
        return { ...station, chargers: updatedChargers };
      }));
    } catch (e) { console.error("Failed to fetch charger statuses:", e); return stations; }
  };

  const fetchAvailability = async (stations: StationRow[]) => {
    const avMap = new Map<string, { total: number; available: number }>();
    const cMap = new Map<string, { total: number; available: number }>();
    await Promise.all(stations.map(async (station) => {
      try {
        const res = await apiFetch(`/station-availability/${station.station_id}`);
        if (!res.ok) return;
        const data = await res.json();
        avMap.set(station.station_id, { total: data.total, available: data.available });
        if (Array.isArray(data.chargers)) { data.chargers.forEach((c: any) => { cMap.set(c.sn, { total: c.total, available: c.available }); }); }
      } catch (e) { console.error(`Failed availability for ${station.station_id}:`, e); }
    }));
    setAvailability(avMap);
    setChargerAvailability(cMap);
  };

  const mapCharger = (c: any, index: number): ChargerData => {
    const imgs = c.images || {};
    
    const norm = (v: any): string[] => Array.isArray(v) ? v : (typeof v === "string" && v ? [v] : []);
    console.log("API_BASE:", process.env.NEXT_PUBLIC_API_BASE);

    return {
      id: c.id, charger_id: c.charger_id, station_id: c.station_id,
      chargeBoxID: c.chargeBoxID ?? "-", chargerNo: c.chargerNo ?? (index + 1),
      brand: c.brand ?? "-", model: c.model ?? "-", SN: c.SN ?? "-", WO: c.WO ?? "-",
      power: c.power ?? "-", PLCFirmware: c.PLCFirmware ?? "-", PIFirmware: c.PIFirmware ?? "-",
      RTFirmware: c.RTFirmware ?? "-", commissioningDate: c.commissioningDate ?? "-",
      warrantyYears: c.warrantyYears ?? 1, numberOfCables: c.numberOfCables ?? 1,
      is_active: c.is_active ?? true, maximo_location: c.maximo_location ?? "", maximo_desc: c.maximo_desc ?? "",
      ocppUrl: c.ocppUrl ?? "", chargerType: c.chargerType ?? "", status: c.status,
      chargerImages: norm(imgs.charger), deviceImages: norm(imgs.device),
    };
  };

  // ✅ mapStation เพิ่ม mdbImages
  const mapStation = (s: any): StationRow => {
    const norm = (v: any): string[] => Array.isArray(v) ? v : (typeof v === "string" && v ? [v] : []);
    const imgs = s.images ?? {};
    return {
      id: s.id, station_id: s.station_id ?? "-", station_name: s.station_name ?? "-",
      owner: s.owner ?? "", user_id: s.user_id ?? "", username: s.username ?? "",
      is_active: !!s.is_active, maximo_location: s.maximo_location ?? "", maximo_desc: s.maximo_desc ?? "",
      stationImage: s.stationImage ?? (norm(imgs.station)[0] ?? ""),
      mdbImages: norm(imgs.mdb),
      chargers: Array.isArray(s.chargers) ? s.chargers.map(mapCharger) : [],
    };
  };

  const refetchStations = async () => { try { const res = await apiFetch(`/all-stations/`); if (!res.ok) return; const json = await res.json(); const list = Array.isArray(json?.stations) ? json.stations : []; const rows = list.map(mapStation); const rowsWithStatus = await fetchChargerStatuses(rows); setData(rowsWithStatus); fetchAvailability(rowsWithStatus); } catch (e) { console.error("Failed to refetch stations:", e); } };

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("access_token") || localStorage.getItem("accessToken") || "";
        const claims = decodeJwt(token);
        if (claims) setMe({ user_id: claims.user_id ?? "-", username: claims.username ?? "-", role: claims.role ?? "user" });
        const res = await apiFetch(`/all-stations/`);
        if (!res.ok) { setErr(`Fetch failed: ${res.status}`); setData([]); return; }
        const json = await res.json();
        const list = Array.isArray(json?.stations) ? json.stations : [];
        const rows = list.map(mapStation);
        setData(rows);
        const rowsWithStatus = await fetchChargerStatuses(rows);
        setData(rowsWithStatus);
        fetchAvailability(rowsWithStatus);
      } catch (e) { console.error(e); setErr("Network/Server error"); setData([]); } finally { setLoading(false); }
    })();
  }, []);

  const isAdmin = me?.role === "admin";
  const filteredDataByStatus = useMemo(() => {
    if (statusFilter === "all") return data;
    return data.filter((station) => {
      const onlineCount = station.chargers.filter((c) => c.status).length;
      const offlineCount = station.chargers.filter((c) => !c.status).length;
      if (statusFilter === "online") return onlineCount > 0;
      if (statusFilter === "offline") return offlineCount > 0;
      return true;
    });
  }, [data, statusFilter]);

  const handleEditStation = (station: StationRow, e: React.MouseEvent) => { e.stopPropagation(); if (!isAdmin && station.user_id !== me?.user_id) { alert("You don't have permission to edit this station"); return; } setEditingStation(station); setOpenEditStation(true); };
  const handleEditCharger = (stationId: string, charger: ChargerData, e: React.MouseEvent) => { e.stopPropagation(); setEditingCharger({ stationId, charger }); setOpenEditCharger(true); };

  const handleChargerCardClick = (charger: ChargerData, stationId: string) => {
    const sn = charger.SN && charger.SN !== "-" ? charger.SN : "";
    const station = data.find(s => s.station_id === stationId);
    const stationName = station?.station_name || stationId;
    localStorage.removeItem("selected_sn"); localStorage.removeItem("selected_station_id"); localStorage.removeItem("selected_station_name"); localStorage.removeItem("selected_charger_no"); localStorage.removeItem("selected_chargerType");
    if (sn) localStorage.setItem("selected_sn", sn); if (stationId) localStorage.setItem("selected_station_id", stationId);
    localStorage.setItem("selected_station_name", stationName);
    if (charger.chargerType) localStorage.setItem("selected_chargerType", charger.chargerType);
    if (charger.chargerNo) localStorage.setItem("selected_charger_no", String(charger.chargerNo));
    const params = new URLSearchParams(); if (sn) params.set("sn", sn); if (stationId) params.set("station_id", stationId);
    const qs = params.toString();
    if (me?.role === "technician") { router.push(`/dashboard/pm-report${qs ? `?${qs}` : ""}`); } else { router.push(`/dashboard/chargers${qs ? `?${qs}` : ""}`); }
  };

  // ✅ handleUpdateStation เพิ่มการ upload MDB
  const handleUpdateStation = async () => {
    if (!editingStation?.id) return;
    try {
      setSaving(true);
      const payload: StationUpdatePayload = { station_name: editStationForm.station_name.trim(), is_active: editStationForm.is_active, maximo_location: editStationForm.maximo_location.trim(), maximo_desc: editStationForm.maximo_desc.trim(), ...(isAdmin && selectedOwnerId ? { user_id: selectedOwnerId } : {}) };
      const res = await apiFetch(`/update_stations/${editingStation.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const errBody = await res.json().catch(() => ({})); throw new Error(errBody?.detail || `Update failed: ${res.status}`); }
      const updated = await res.json();

      // ลบรูป station เดิม
      if (deleteCurrentImage && editingStation.stationImage) {
        await apiFetch(`/stations/${editingStation.station_id}/delete-image`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "station", url: editingStation.stationImage }) });
      }

      // อัปโหลดรูปใหม่ (station + mdb รวมกันใน 1 request)
      if (editStationImages.length || editMdbImages.length) {
        const fd = new FormData();
        editStationImages.forEach(f => fd.append("station", f));
        editMdbImages.forEach(f => fd.append("mdb", f));  // ✅ MDB
        await apiFetch(`/stations/${editingStation.station_id}/upload-image`, { method: "POST", body: fd });
      }

      setData(prev => prev.map(s => s.id === editingStation.id ? {
        ...s,
        station_name: updated.station_name ?? editStationForm.station_name,
        is_active: updated.is_active ?? editStationForm.is_active,
        maximo_location: updated.maximo_location ?? editStationForm.maximo_location,
        maximo_desc: updated.maximo_desc ?? editStationForm.maximo_desc,
        user_id: updated.user_id ?? s.user_id,
        username: updated.username ?? s.username,
        stationImage: editStationImages.length ? s.stationImage : (deleteCurrentImage ? "" : s.stationImage),
      } : s));

      // refetch เพื่ออัปเดต mdbImages
      await refetchStations();

      setOpenEditStation(false);
      setNotice({ type: "success", msg: t.stationUpdated });
      setTimeout(() => setNotice(null), 2500);
    } catch (e: any) { console.error(e); setNotice({ type: "error", msg: e?.message || "Update failed" }); setTimeout(() => setNotice(null), 3500); } finally { setSaving(false); }
  };

  const handleUpdateCharger = async () => {
    if (!editingCharger?.charger.id) return;
    try {
      setSaving(true);
      const currentExpanded = table.getState().expanded;
      const payload: ChargerUpdatePayload = { chargeBoxID: editChargerForm.chargeBoxID.trim(), chargerNo: editChargerForm.chargerNo, brand: editChargerForm.brand.trim(), model: editChargerForm.model.trim(), SN: editChargerForm.SN.trim(), WO: editChargerForm.WO.trim(), power: editChargerForm.power.trim(), PLCFirmware: editChargerForm.PLCFirmware.trim(), PIFirmware: editChargerForm.PIFirmware.trim(), RTFirmware: editChargerForm.RTFirmware.trim(), commissioningDate: editChargerForm.commissioningDate, warrantyYears: editChargerForm.warrantyYears, numberOfCables: editChargerForm.numberOfCables, is_active: editChargerForm.is_active, maximo_location: editChargerForm.maximo_location.trim(), maximo_desc: editChargerForm.maximo_desc.trim(), ocppUrl: editChargerForm.ocppUrl.trim(), chargerType: editChargerForm.chargerType };
      const res = await apiFetch(`/update_charger/${editingCharger.charger.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const errBody = await res.json().catch(() => ({})); throw new Error(errBody?.detail || `Update failed: ${res.status}`); }
      const chargerImgsToDelete = (editingCharger.charger.chargerImages || []).filter((_, i) => deletedExistingChargerIdxs.has(i));
      const deviceImgsToDelete = (editingCharger.charger.deviceImages || []).filter((_, i) => deletedExistingDeviceIdxs.has(i));
      if (chargerImgsToDelete.length || deviceImgsToDelete.length) { await apiFetch(`/chargers/${editingCharger.charger.id}/delete-images`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ charger: chargerImgsToDelete, device: deviceImgsToDelete }) }); }
      if (editChargerImages.length || editDeviceImages.length) { const fd = new FormData(); editChargerImages.forEach(f => fd.append("charger", f)); editDeviceImages.forEach(f => fd.append("device", f)); await apiFetch(`/chargers/${editingCharger.charger.id}/upload-images`, { method: "POST", body: fd }); }
      await refetchStations();
      setExpanded(currentExpanded);
      setOpenEditCharger(false); setNotice({ type: "success", msg: t.chargerUpdated }); setTimeout(() => setNotice(null), 2500);
    } catch (e: any) { console.error(e); setNotice({ type: "error", msg: e?.message || "Update failed" }); setTimeout(() => setNotice(null), 3500); } finally { setSaving(false); }
  };

  const handleDeleteStation = (station: StationRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!station.id) return;
    setConfirmDialog({
      open: true,
      title: lang === "th" ? "ลบสถานี?" : "Delete Station?",
      message: lang === "th" ? `คุณต้องการลบสถานี "${station.station_name}" และตู้ชาร์จทั้งหมดใช่หรือไม่?` : `Are you sure you want to delete "${station.station_name}" and all its chargers?`,
      loading: false,
      onConfirm: async () => {
        try {
          setConfirmDialog(prev => ({ ...prev, loading: true }));
          const res = await apiFetch(`/delete_stations/${station.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
          setData(prev => prev.filter(s => s.id !== station.id));
          closeConfirm(); setNotice({ type: "success", msg: t.deleteSuccess }); setTimeout(() => setNotice(null), 2500);
        } catch (e: any) { console.error(e); closeConfirm(); setNotice({ type: "error", msg: e.message || "Failed to delete station" }); setTimeout(() => setNotice(null), 3500); }
      },
    });
  };

  const handleDeleteCharger = (stationId: string, charger: ChargerData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!charger.id) return;
    setConfirmDialog({
      open: true,
      title: lang === "th" ? "ลบตู้ชาร์จ?" : "Delete Charger?",
      message: lang === "th" ? `คุณต้องการลบตู้ชาร์จ "${charger.chargeBoxID}" ใช่หรือไม่?` : `Are you sure you want to delete charger "${charger.chargeBoxID}"?`,
      loading: false,
      onConfirm: async () => {
        try {
          setConfirmDialog(prev => ({ ...prev, loading: true }));
          const res = await apiFetch(`/delete_charger/${charger.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
          setData(prev => prev.map(st => { if (st.station_id !== stationId) return st; return { ...st, chargers: st.chargers.filter(c => c.id !== charger.id) }; }));
          closeConfirm(); setNotice({ type: "success", msg: t.chargerDeleted }); setTimeout(() => setNotice(null), 2500);
        } catch (e: any) { console.error(e); closeConfirm(); setNotice({ type: "error", msg: e.message || "Failed to delete charger" }); setTimeout(() => setNotice(null), 3500); }
      },
    });
  };

  const handleOpenAddCharger = (stationId: string) => {
    const station = data.find(s => s.station_id === stationId);
    const nextChargerNo = station ? station.chargers.length + 1 : 1;
    setAddingChargerStationId(stationId);
    setAddChargerForm({ chargeBoxID: "", chargerNo: nextChargerNo, brand: "", model: "", SN: "", WO: "", power: "", PLCFirmware: "", PIFirmware: "", RTFirmware: "", commissioningDate: getTodayDate(), warrantyYears: 1, numberOfCables: 1, is_active: true, maximo_location: "", maximo_desc: "", ocppUrl: "", chargerType: "DC" });
    resetAddChargerImages(); setOpenAddCharger(true);
  };

  const handleCreateCharger = async () => {
    if (!addingChargerStationId) return;
    try {
      setSaving(true);
      const payload = { chargeBoxID: addChargerForm.chargeBoxID.trim(), chargerNo: addChargerForm.chargerNo, brand: addChargerForm.brand.trim(), model: addChargerForm.model.trim(), SN: addChargerForm.SN.trim(), WO: addChargerForm.WO.trim(), power: addChargerForm.power.trim(), PLCFirmware: addChargerForm.PLCFirmware.trim(), PIFirmware: addChargerForm.PIFirmware.trim(), RTFirmware: addChargerForm.RTFirmware.trim(), commissioningDate: addChargerForm.commissioningDate, warrantyYears: addChargerForm.warrantyYears, numberOfCables: addChargerForm.numberOfCables, is_active: addChargerForm.is_active, maximo_location: addChargerForm.maximo_location.trim(), maximo_desc: addChargerForm.maximo_desc.trim(), ocppUrl: addChargerForm.ocppUrl.trim(), chargerType: addChargerForm.chargerType };
      const res = await apiFetch(`/add_charger/${addingChargerStationId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const errBody = await res.json().catch(() => ({})); throw new Error(errBody?.detail || `Create failed: ${res.status}`); }
      const created = await res.json();
      if (created.id && (addChargerImages.length || addDeviceImages.length)) { const fd = new FormData(); addChargerImages.forEach(f => fd.append("charger", f)); addDeviceImages.forEach(f => fd.append("device", f)); await apiFetch(`/chargers/${created.id}/upload-images`, { method: "POST", body: fd }); }
      const currentExpanded = table.getState().expanded;
      await refetchStations();
      setExpanded(currentExpanded);
      resetAddChargerImages(); setOpenAddCharger(false); setNotice({ type: "success", msg: t.chargerCreated }); setTimeout(() => setNotice(null), 2500);
    } catch (e: any) { console.error(e); setNotice({ type: "error", msg: e?.message || "Failed to create charger" }); setTimeout(() => setNotice(null), 3500); } finally { setSaving(false); }
  };

  const handleCreateStation = async (payload: NewStationPayload) => {
    try {
      setSaving(true);
      const res = await apiFetch(`/add_stations/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const errBody = await res.json().catch(() => ({})); throw new Error(errBody?.detail || `Create failed: ${res.status}`); }
      const created = await res.json();
      const newStation: StationRow = { id: created.id || created.station?.id, station_id: created.station?.station_id ?? payload.station?.station_id, station_name: created.station?.station_name ?? payload.station?.station_name ?? "", owner: created.station?.owner ?? "", user_id: created.station?.user_id ?? me?.user_id ?? "", username: created.station?.username ?? me?.username ?? "", is_active: created.station?.is_active ?? true, maximo_location: created.station?.maximo_location ?? (payload.station as any)?.maximo_location ?? "", maximo_desc: created.station?.maximo_desc ?? (payload.station as any)?.maximo_desc ?? "", stationImage: "", mdbImages: [], chargers: Array.isArray(created.chargers) ? created.chargers.map(mapCharger) : [] };
      setData(prev => [newStation, ...prev]); setOpenAdd(false); setNotice({ type: "success", msg: t.createSuccess }); setTimeout(() => setNotice(null), 3000);
      return created;
    } catch (e: any) { console.error(e); alert(e?.message || "Failed to create station"); throw e; } finally { setSaving(false); }
  };

  useEffect(() => { const lock = openAdd || openEditStation || openEditCharger || openAddCharger; if (lock) { const scrollY = window.scrollY; document.body.style.position = "fixed"; document.body.style.top = `-${scrollY}px`; document.body.style.left = "0"; document.body.style.right = "0"; document.body.style.width = "100%"; document.body.style.overflow = "hidden"; } else { const top = document.body.style.top; document.body.style.position = ""; document.body.style.top = ""; document.body.style.left = ""; document.body.style.right = ""; document.body.style.width = ""; document.body.style.overflow = ""; if (top) { const y = parseInt(top || "0") * -1; window.scrollTo(0, y); } } }, [openAdd, openEditStation, openEditCharger, openAddCharger]);

  const handleSubmitImages = async (stationId: string, stationImages: { station: File[]; mdb: File[] }, chargerImages: Array<{ chargerNo: number; chargerImages: File[]; deviceImages: File[] }>, createdChargers: Array<{ id: string; chargerNo: number }>) => {
    try {
      if (stationImages.station.length || stationImages.mdb.length) {
        const fd = new FormData();
        stationImages.station.forEach(f => fd.append("station", f));
        stationImages.mdb.forEach(f => fd.append("mdb", f));
        await apiFetch(`/stations/${stationId}/upload-image`, { method: "POST", body: fd });
      }
      for (const ci of chargerImages) { const cc = createdChargers.find(c => c.chargerNo === ci.chargerNo); if (!cc?.id) continue; if (ci.chargerImages.length || ci.deviceImages.length) { const fd = new FormData(); ci.chargerImages.forEach(f => fd.append("charger", f)); ci.deviceImages.forEach(f => fd.append("device", f)); await apiFetch(`/chargers/${cc.id}/upload-images`, { method: "POST", body: fd }); } }
      await refetchStations();
    } catch (e) { console.error("[Images] Upload failed:", e); }
  };

  // ===== Columns =====
  const columns = useMemo(() => {
    const baseColumns = [
      { id: "expander", header: () => null, size: 50, cell: ({ row }: { row: Row<StationRow> }) => { const hasChargers = row.original.chargers.length > 0; const canEdit = isAdmin || row.original.user_id === me?.user_id; if (!(hasChargers || canEdit)) return null; return (<span className="tw-p-1.5 tw-rounded-lg">{row.getIsExpanded() ? <ChevronDownIcon className="tw-h-5 tw-w-5 tw-text-blue-600" /> : <ChevronRightIconSolid className="tw-h-5 tw-w-5 tw-text-blue-gray-500" />}</span>); } },
      { id: "station_name", header: () => t.stationName, accessorFn: (row: StationRow) => row.station_name, cell: (info: any) => (<div className="tw-flex tw-items-center tw-gap-2.5"><div className="tw-h-8 tw-w-8 tw-rounded-lg tw-bg-gradient-to-br tw-from-blue-500 tw-to-indigo-600 tw-flex tw-items-center tw-justify-center tw-shadow-sm tw-flex-shrink-0"><span className="tw-text-white tw-text-xs tw-font-bold">{(info.getValue() as string)?.charAt(0)?.toUpperCase()}</span></div><span className="tw-font-semibold tw-text-blue-gray-800">{info.getValue()}</span></div>) },
      { id: "charger_count", header: () => t.chargers, size: 100, cell: ({ row }: { row: Row<StationRow> }) => { const count = row.original.chargers.length; const onlineCount = row.original.chargers.filter(c => c.status).length; return (<div className="tw-flex tw-items-center tw-gap-2"><span className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-2.5 tw-py-1 tw-rounded-lg tw-bg-gradient-to-r tw-from-amber-400 tw-to-orange-400 tw-shadow-sm"><BoltIcon className="tw-h-3.5 tw-w-3.5 tw-text-white" /><span className="tw-text-xs tw-font-bold tw-text-white">{count}</span></span>{count > 0 && (<span className="tw-text-[10px] tw-text-blue-gray-400"><span className="tw-text-green-600 tw-font-semibold">{onlineCount}</span><span className="tw-mx-0.5">/</span><span>{count} online</span></span>)}</div>); } },
      { id: "available", header: () => t.available, size: 120, cell: ({ row }: { row: Row<StationRow> }) => { const av = availability.get(row.original.station_id); if (!av || av.total === 0) return <span className="tw-text-blue-gray-300 tw-text-xs">-</span>; return (<div className="tw-flex tw-flex-col tw-items-start tw-gap-0.5"><span className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-2.5 tw-py-1 tw-rounded-full tw-border tw-text-xs tw-font-semibold tw-bg-green-50 tw-border-green-200 tw-text-green-700"><span className="tw-h-2 tw-w-2 tw-rounded-full tw-bg-green-500" />{av.available}/{av.total} {t.availableOf}</span></div>); } },
      { id: "username", header: () => t.owner, accessorFn: (row: StationRow) => row.username ?? "-", cell: (info: any) => (<span className="tw-text-blue-gray-600">{info.getValue()}</span>) },
      { id: "is_active", header: () => t.status, size: 100, cell: ({ row }: { row: Row<StationRow> }) => { const on = !!row.original.is_active; return (<span className={`tw-inline-flex tw-items-center tw-gap-1.5 tw-px-2.5 tw-py-1 tw-rounded-md tw-text-xs tw-font-semibold tw-transition-colors ${on ? "tw-bg-green-50 tw-text-green-700 tw-ring-1 tw-ring-green-200" : "tw-bg-red-50 tw-text-red-600 tw-ring-1 tw-ring-red-200"}`}><span className={`tw-h-1.5 tw-w-1.5 tw-rounded-full ${on ? "tw-bg-green-500 tw-animate-pulse" : "tw-bg-red-400"}`} />{on ? t.active : t.inactive}</span>); } },
    ];
    if (me?.role !== "technician") {
      baseColumns.push({ id: "actions", header: () => t.actions, size: 100, enableSorting: false, cell: ({ row }: { row: Row<StationRow> }) => { const canEdit = isAdmin || row.original.user_id === me?.user_id; return (<span className="tw-inline-flex tw-items-center tw-gap-1.5" onClick={(e) => e.stopPropagation()}>{canEdit && (<Tooltip content={t.editStationTooltip}><button onClick={(e) => handleEditStation(row.original, e)} className="tw-group/btn tw-rounded-lg tw-p-2 tw-bg-blue-50 tw-ring-1 tw-ring-blue-200/60 hover:tw-bg-blue-600 hover:tw-ring-blue-600 tw-transition-all tw-duration-200 tw-shadow-sm hover:tw-shadow-md"><PencilSquareIcon className="tw-h-4 tw-w-4 tw-text-blue-600 group-hover/btn:tw-text-white tw-transition-colors" /></button></Tooltip>)}{isAdmin && (<Tooltip content={t.deleteStationTooltip}><button onClick={(e) => handleDeleteStation(row.original, e)} className="tw-group/btn tw-rounded-lg tw-p-2 tw-bg-red-50 tw-ring-1 tw-ring-red-200/60 hover:tw-bg-red-600 hover:tw-ring-red-600 tw-transition-all tw-duration-200 tw-shadow-sm hover:tw-shadow-md"><TrashIcon className="tw-h-4 tw-w-4 tw-text-red-500 group-hover/btn:tw-text-white tw-transition-colors" /></button></Tooltip>)}</span>); } } as any);
    }
    return baseColumns;
  }, [me, technicians, isAdmin, t, availability]);

  const table = useReactTable({
    data: filteredDataByStatus, columns,
    getRowId: (row) => row.station_id,
    state: { globalFilter: filtering, sorting, expanded },
    onSortingChange: setSorting, onGlobalFilterChange: setFiltering, onExpandedChange: setExpanded,
    getRowCanExpand: (row) => row.original.chargers.length > 0 || isAdmin || row.original.user_id === me?.user_id,
    getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel(), getExpandedRowModel: getExpandedRowModel(),
  });

  const formatPower = (power: string | number | undefined | null) => { if (!power) return "-"; const text = String(power).trim(); return /\bkw\b/i.test(text) ? text : `${text} kW`; };

  const ChargerCard = ({ charger, stationId, canEdit, index }: { charger: ChargerData; stationId: string; canEdit: boolean; index: number }) => {
    const isOnline = !!charger.status;
    const av = chargerAvailability.get(charger.SN);
    return (
      <div onClick={() => handleChargerCardClick(charger, stationId)} className="tw-group tw-relative tw-overflow-hidden tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm hover:tw-shadow-lg tw-transition-all tw-duration-300 tw-cursor-pointer hover:tw-border-blue-300 hover:tw--translate-y-0.5" style={{ animationDelay: `${index * 50}ms` }}>
        <div className={`tw-h-1 tw-w-full ${isOnline ? "tw-bg-gradient-to-r tw-from-green-400 tw-to-emerald-500" : "tw-bg-gradient-to-r tw-from-red-400 tw-to-rose-500"}`} />
        <div className="tw-p-3 sm:tw-p-4">
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-2 tw-mb-3">
            <div className="tw-flex tw-items-center tw-gap-2 tw-min-w-0 tw-flex-1">
              <div className={`tw-p-2 tw-rounded-lg tw-flex-shrink-0 ${isOnline ? "tw-bg-green-50 tw-ring-1 tw-ring-green-200" : "tw-bg-red-50 tw-ring-1 tw-ring-red-200"}`}>
                <BoltIcon className={`tw-h-4 tw-w-4 ${isOnline ? "tw-text-green-600" : "tw-text-red-500"}`} />
              </div>
              <div className="tw-min-w-0 tw-flex-1">
                <h4 className="tw-font-bold tw-text-xs tw-text-blue-gray-800 tw-truncate" title={charger.chargeBoxID}>{charger.chargeBoxID || "-"}</h4>
                <div className="tw-flex tw-items-center tw-gap-1 tw-mt-1 tw-flex-wrap">
                  <span className="tw-px-1.5 tw-py-0.5 tw-rounded-md tw-bg-blue-gray-800 tw-text-[8px] tw-font-bold tw-text-white">#{charger.chargerNo}</span>
                  {charger.chargerType && (<span className="tw-px-1.5 tw-py-0.5 tw-rounded-md tw-bg-purple-100 tw-text-[8px] tw-font-bold tw-text-purple-700">{charger.chargerType}</span>)}
                  <span className={`tw-flex tw-items-center tw-gap-0.5 tw-px-1.5 tw-py-0.5 tw-rounded-md tw-text-[8px] tw-font-bold ${isOnline ? "tw-bg-green-100 tw-text-green-700" : "tw-bg-red-100 tw-text-red-600"}`}>
                    <span className={`tw-h-1.5 tw-w-1.5 tw-rounded-full ${isOnline ? "tw-bg-green-500 tw-animate-pulse" : "tw-bg-red-400"}`} />{isOnline ? t.online : t.offline}
                  </span>
                </div>
              </div>
            </div>
            <div className="tw-flex tw-items-center tw-gap-0.5 tw-opacity-0 group-hover:tw-opacity-100 tw-transition-opacity">
              {canEdit && (<button onClick={(e) => handleEditCharger(stationId, charger, e)} className="tw-p-1.5 tw-rounded-lg tw-text-blue-gray-400 hover:tw-text-blue-600 hover:tw-bg-blue-50 tw-transition-colors"><PencilSquareIcon className="tw-h-3.5 tw-w-3.5" /></button>)}
              {isAdmin && (<button onClick={(e) => handleDeleteCharger(stationId, charger, e)} className="tw-p-1.5 tw-rounded-lg tw-text-blue-gray-400 hover:tw-text-red-500 hover:tw-bg-red-50 tw-transition-colors"><TrashIcon className="tw-h-3.5 tw-w-3.5" /></button>)}
            </div>
          </div>
          <div className="tw-grid tw-grid-cols-2 tw-gap-x-3 tw-gap-y-1 tw-text-[10px] tw-mb-3">
            {[[t.brand, charger.brand], [t.model, charger.model], [t.serialNumber, charger.SN, true], [t.power, formatPower(charger.power)], [t.cables, charger.numberOfCables || "-"], [t.warranty, `${charger.warrantyYears || "-"}${t.year}`]].map(([label, value, mono], i) => (
              <div key={i} className="tw-truncate"><span className="tw-text-blue-gray-400">{label as string}: </span><span className={`tw-text-blue-gray-700 tw-font-medium ${mono ? "tw-font-mono" : ""}`}>{(value as string) || "-"}</span></div>
            ))}
          </div>
          {((charger.chargerImages?.length ?? 0) > 0 || (charger.deviceImages?.length ?? 0) > 0) && (
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3 tw-overflow-x-auto">
              {charger.chargerImages?.map((url, i) => (<a key={`c-${i}`} href={imgUrl(url)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="tw-flex-shrink-0"><div className="tw-relative tw-group/img"><img src={imgUrl(url)} alt={`Charger ${i + 1}`} className="tw-h-14 tw-w-14 tw-object-cover tw-rounded-lg tw-border-2 tw-border-blue-gray-100 group-hover/img:tw-border-blue-400 tw-transition-colors" /><span className="tw-absolute tw-bottom-0 tw-inset-x-0 tw-bg-black/60 tw-text-white tw-text-[7px] tw-text-center tw-py-0.5 tw-rounded-b-md">Charger {charger.chargerImages!.length > 1 ? i + 1 : ""}</span></div></a>))}
              {charger.deviceImages?.map((url, i) => (<a key={`d-${i}`} href={imgUrl(url)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="tw-flex-shrink-0"><div className="tw-relative tw-group/img"><img src={imgUrl(url)} alt={`Device ${i + 1}`} className="tw-h-14 tw-w-14 tw-object-cover tw-rounded-lg tw-border-2 tw-border-blue-gray-100 group-hover/img:tw-border-blue-400 tw-transition-colors" /><span className="tw-absolute tw-bottom-0 tw-inset-x-0 tw-bg-black/60 tw-text-white tw-text-[7px] tw-text-center tw-py-0.5 tw-rounded-b-md">Device {charger.deviceImages!.length > 1 ? i + 1 : ""}</span></div></a>))}
            </div>
          )}
          <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
            <div className="tw-flex-1 tw-px-2 tw-py-1 tw-rounded-lg tw-bg-blue-50/80 tw-border tw-border-blue-100"><span className="tw-text-[10px] tw-text-blue-700 tw-font-medium">📅 {formatDate(charger.commissioningDate)}</span></div>
            {av && av.total > 0 && (<div className="tw-px-2 tw-py-1 tw-rounded-lg tw-border tw-text-[10px] tw-font-bold tw-flex tw-items-center tw-gap-1 tw-bg-green-50 tw-border-green-200 tw-text-green-700"><span className="tw-h-1.5 tw-w-1.5 tw-rounded-full tw-bg-green-500" />🔌 {av.available}/{av.total}</div>)}
          </div>
          <div className="tw-rounded-lg tw-bg-gradient-to-b tw-from-gray-50 tw-to-gray-100/50 tw-p-2 tw-ring-1 tw-ring-gray-200/60">
            <div className="tw-flex tw-items-center tw-gap-1 tw-mb-1.5"><CpuChipIcon className="tw-h-3 tw-w-3 tw-text-blue-gray-400" /><span className="tw-text-[8px] tw-font-bold tw-uppercase tw-text-blue-gray-500 tw-tracking-wider">{t.firmware}</span></div>
            <div className="tw-grid tw-grid-cols-3 tw-gap-1">
              {[["PLC", charger.PLCFirmware], ["Pi", charger.PIFirmware], ["RT", charger.RTFirmware]].map(([label, val]) => (<div key={label} className="tw-text-center tw-rounded-md tw-px-1 tw-py-1 tw-bg-white tw-ring-1 tw-ring-gray-200/60"><div className="tw-text-[7px] tw-text-blue-gray-400 tw-font-medium">{label}</div><div className="tw-text-[9px] tw-font-mono tw-text-blue-gray-700 tw-truncate">{val || "-"}</div></div>))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ChargersExpandedSection = ({ chargers, stationId, canEdit }: { chargers: ChargerData[]; stationId: string; canEdit: boolean }) => {
    const onlineCount = chargers.filter(c => c.status).length;
    const offlineCount = chargers.length - onlineCount;
    return (
      <tr><td colSpan={columns.length} className="tw-p-0"><div className="tw-bg-gray-50/50 tw-border-t tw-border-blue-gray-100">
        <div className="tw-px-3 sm:tw-px-6 tw-py-2 sm:tw-py-3 tw-border-b tw-border-blue-gray-100 tw-bg-white"><div className="tw-flex tw-items-center tw-justify-between tw-flex-wrap tw-gap-2"><div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-3 tw-flex-wrap"><span className="tw-inline-flex tw-items-center tw-gap-1 sm:tw-gap-1.5 tw-px-2 sm:tw-px-2.5 tw-py-0.5 sm:tw-py-1 tw-rounded-full tw-bg-gradient-to-r tw-from-amber-50 tw-to-yellow-50 tw-border tw-border-amber-200"><BoltIcon className="tw-h-3 tw-w-3 sm:tw-h-4 sm:tw-w-4 tw-text-amber-500" /><span className="tw-text-xs sm:tw-text-sm tw-font-semibold tw-text-amber-700">{t.chargers} ({chargers.length})</span></span><span className="tw-text-xs sm:tw-text-sm tw-text-green-600">• {onlineCount} {t.online}</span>{offlineCount > 0 && (<span className="tw-text-xs sm:tw-text-sm tw-text-red-500">• {offlineCount} {t.offline}</span>)}</div>{canEdit && (<Button size="sm" onClick={() => handleOpenAddCharger(stationId)} className="tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black tw-flex tw-items-center tw-gap-1 tw-shadow-sm tw-text-xs sm:tw-text-sm tw-px-2 sm:tw-px-3 tw-py-1.5 sm:tw-py-2"><BoltIcon className="tw-h-3 tw-w-3 sm:tw-h-4 sm:tw-w-4" /><span className="tw-hidden sm:tw-inline">{t.addCharger}</span><span className="tw-inline sm:tw-hidden">+ {t.add}</span></Button>)}</div></div>
        <div className="tw-p-2 sm:tw-p-4">{chargers.length > 0 ? (<div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-2 lg:tw-grid-cols-3 xl:tw-grid-cols-4 tw-gap-2 sm:tw-gap-4 lg:tw-gap-5">{chargers.map((charger, index) => (<ChargerCard key={charger.id || charger.chargeBoxID} charger={charger} stationId={stationId} canEdit={canEdit} index={index} />))}</div>) : (<div className="tw-text-center tw-py-6 sm:tw-py-8 tw-text-blue-gray-400"><BoltIcon className="tw-h-8 tw-w-8 sm:tw-h-12 sm:tw-w-12 tw-mx-auto tw-mb-2 tw-opacity-30" /><p className="tw-text-xs sm:tw-text-sm">{t.noChargersYet}</p>{canEdit && (<Button size="sm" onClick={() => handleOpenAddCharger(stationId)} className="tw-mt-2 sm:tw-mt-3 tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black tw-text-xs">{t.addFirstCharger}</Button>)}</div>)}</div>
      </div></td></tr>
    );
  };

  // ===== Main Return =====
  return (
    <>
      <LoadingOverlay show={loading} text={lang === "th" ? "กำลังโหลดข้อมูล..." : "Loading data..."} />
      <div className="tw-mt-8 tw-mb-4">
        {statusFilter !== "all" && (
          <div className="tw-mb-3 tw-flex tw-items-center tw-gap-2">
            <span className="tw-text-sm tw-text-blue-gray-600">{lang === "th" ? `ตัวกรอง: ${statusFilter === "online" ? "ออนไลน์" : "ออฟไลน์"}` : `Filter: ${statusFilter === "online" ? "Online" : "Offline"}`}</span>
            <button type="button" onClick={() => setStatusFilter("all")} className="tw-text-sm tw-text-blue-600 hover:tw-underline">{lang === "th" ? "ล้างตัวกรอง" : "Clear"}</button>
          </div>
        )}
        <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-4 tw-gap-2.5 sm:tw-gap-3">
          {loading ? (<>{Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}</>) : (
            <>
              <div className="tw-group tw-relative tw-overflow-hidden tw-rounded-2xl tw-bg-gradient-to-br tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-4 sm:tw-px-5 tw-py-3.5 sm:tw-py-4 tw-ring-1 tw-ring-white/10 tw-shadow-lg hover:tw-shadow-xl tw-transition-all tw-duration-300 hover:tw--translate-y-0.5">
                <div className="tw-absolute tw-inset-0 tw-opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                <div className="tw-relative tw-z-10"><div className="tw-flex tw-items-center tw-gap-2 tw-mb-2"><div className="tw-h-8 tw-w-8 tw-rounded-xl tw-bg-blue-500/20 tw-flex tw-items-center tw-justify-center tw-ring-1 tw-ring-blue-400/20"><span className="tw-text-base">📍</span></div><span className="tw-text-[10px] sm:tw-text-[11px] tw-font-semibold tw-text-white/40 tw-uppercase tw-tracking-wider">{lang === "th" ? "สถานี" : "Stations"}</span></div><div className="tw-text-2xl sm:tw-text-3xl tw-font-black tw-text-white tw-tabular-nums tw-tracking-tight tw-leading-none">{data.length}</div></div>
              </div>
              <div className="tw-group tw-relative tw-overflow-hidden tw-rounded-2xl tw-bg-gradient-to-br tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-4 sm:tw-px-5 tw-py-3.5 sm:tw-py-4 tw-ring-1 tw-ring-white/10 tw-shadow-lg hover:tw-shadow-xl tw-transition-all tw-duration-300 hover:tw--translate-y-0.5">
                <div className="tw-absolute tw-inset-0 tw-opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                <div className="tw-relative tw-z-10"><div className="tw-flex tw-items-center tw-gap-2 tw-mb-2"><div className="tw-h-8 tw-w-8 tw-rounded-xl tw-bg-amber-500/20 tw-flex tw-items-center tw-justify-center tw-ring-1 tw-ring-amber-400/20"><BoltIcon className="tw-h-4 tw-w-4 tw-text-amber-400" /></div><span className="tw-text-[10px] sm:tw-text-[11px] tw-font-semibold tw-text-white/40 tw-uppercase tw-tracking-wider">{lang === "th" ? "ตู้ชาร์จ" : "Chargers"}</span></div><div className="tw-text-2xl sm:tw-text-3xl tw-font-black tw-text-white tw-tabular-nums tw-tracking-tight tw-leading-none">{data.reduce((sum, s) => sum + s.chargers.length, 0)}</div></div>
              </div>
              <div onClick={() => setStatusFilter((prev) => (prev === "online" ? "all" : "online"))} className={`tw-group tw-relative tw-overflow-hidden tw-rounded-2xl tw-bg-gradient-to-br tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-4 sm:tw-px-5 tw-py-3.5 sm:tw-py-4 tw-ring-1 tw-shadow-lg hover:tw-shadow-xl tw-transition-all tw-duration-300 hover:tw--translate-y-0.5 tw-cursor-pointer ${statusFilter === "online" ? "tw-ring-green-400 tw-scale-[1.02]" : "tw-ring-white/10"}`}>
                <div className="tw-absolute tw-inset-0 tw-opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                <div className="tw-relative tw-z-10"><div className="tw-flex tw-items-center tw-gap-2 tw-mb-2"><div className="tw-h-8 tw-w-8 tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-ring-1" style={{ background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.25)' }}><span className="tw-relative tw-flex tw-h-2.5 tw-w-2.5"><span className="tw-animate-ping tw-absolute tw-inline-flex tw-h-full tw-w-full tw-rounded-full tw-opacity-75" style={{ background: '#34d399' }} /><span className="tw-relative tw-inline-flex tw-rounded-full tw-h-2.5 tw-w-2.5" style={{ background: '#34d399' }} /></span></div><span className="tw-text-[10px] sm:tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{lang === "th" ? "ออนไลน์" : "Online"}</span></div><div className="tw-text-2xl sm:tw-text-3xl tw-font-black tw-tabular-nums tw-tracking-tight tw-leading-none" style={{ color: '#34d399' }}>{data.reduce((sum, s) => sum + s.chargers.filter(c => c.status).length, 0)}</div></div>
              </div>
              <div onClick={() => setStatusFilter((prev) => (prev === "offline" ? "all" : "offline"))} className={`tw-group tw-relative tw-overflow-hidden tw-rounded-2xl tw-bg-gradient-to-br tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-4 sm:tw-px-5 tw-py-3.5 sm:tw-py-4 tw-ring-1 tw-shadow-lg hover:tw-shadow-xl tw-transition-all tw-duration-300 hover:tw--translate-y-0.5 tw-cursor-pointer ${statusFilter === "offline" ? "tw-ring-red-400 tw-scale-[1.02]" : "tw-ring-white/10"}`}>
                <div className="tw-absolute tw-inset-0 tw-opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                <div className="tw-relative tw-z-10"><div className="tw-flex tw-items-center tw-gap-2 tw-mb-2"><div className="tw-h-8 tw-w-8 tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-ring-1" style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.25)' }}><span className="tw-h-2.5 tw-w-2.5 tw-rounded-full" style={{ background: '#f87171' }} /></div><span className="tw-text-[10px] sm:tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{lang === "th" ? "ออฟไลน์" : "Offline"}</span></div><div className="tw-text-2xl sm:tw-text-3xl tw-font-black tw-tabular-nums tw-tracking-tight tw-leading-none" style={{ color: '#f87171' }}>{data.reduce((sum, s) => sum + s.chargers.filter(c => !c.status).length, 0)}</div></div>
              </div>
            </>
          )}
        </div>
      </div>

      <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-8">
        {notice && (<div className="tw-px-4 tw-pt-4"><Alert color={notice.type === "success" ? "green" : "red"} onClose={() => setNotice(null)}>{notice.msg}</Alert></div>)}
        <CardHeader floated={false} shadow={false} className="tw-!px-4 sm:tw-!px-6 tw-!py-5 tw-bg-gradient-to-r tw-from-white tw-to-blue-gray-50/30 tw-rounded-t-xl">
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
            <div className="tw-min-w-0 tw-flex-1"><Typography color="blue-gray" variant="h5" className="tw-text-lg sm:tw-text-xl">{t.stationManagement}</Typography><Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-normal tw-mt-1 tw-text-xs sm:tw-text-sm">{t.stationManagementDesc}</Typography></div>
            {(isAdmin || me?.role === "owner") && (<Button onClick={() => setOpenAdd(true)} size="sm" className="tw-flex tw-items-center tw-gap-2 tw-px-4 sm:tw-px-5 tw-py-2.5 tw-rounded-xl tw-bg-gray-900 hover:tw-bg-black tw-text-white tw-font-semibold tw-text-xs sm:tw-text-sm tw-shadow-lg tw-flex-shrink-0 tw-normal-case tw-tracking-wide"><span className="tw-text-base tw-leading-none">+</span><span className="tw-hidden sm:tw-inline">{t.addStation}</span><span className="tw-inline sm:tw-hidden">{t.add}</span></Button>)}
          </div>
        </CardHeader>
        <CardBody className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-4">
          <div className="tw-flex tw-items-center tw-gap-3 tw-flex-none"><select value={table.getState().pagination.pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))} className="tw-border tw-p-2 tw-border-blue-gray-100 tw-rounded-lg tw-w-[72px]">{[5, 10, 15, 20, 25].map((ps) => (<option key={ps} value={ps}>{ps}</option>))}</select><Typography variant="small" className="!tw-text-blue-gray-500 !tw-font-normal tw-hidden sm:tw-inline">{t.entriesPerPage}</Typography></div>
          <div className="tw-ml-auto tw-min-w-0 tw-flex-1 md:tw-flex-none md:tw-w-64"><Input variant="outlined" value={filtering} onChange={(e) => setFiltering(e.target.value)} label={t.search} crossOrigin={undefined} /></div>
        </CardBody>
        <CardFooter className="tw-p-0">
          {loading ? (
            <div className="tw-overflow-x-auto tw-w-full">
              <table className="tw-w-full tw-border-separate tw-border-spacing-0 tw-min-w-[900px]">
                <thead className="tw-bg-gradient-to-r tw-from-gray-900 tw-to-gray-800"><tr>{["", "Station", "Chargers", "Available", "Owner", "Status", ""].map((h, i) => (<th key={i} className="tw-px-3 tw-py-3"><div className="tw-h-3 tw-rounded tw-bg-white/20 tw-animate-pulse" style={{ width: h ? `${h.length * 8}px` : 32 }} /></th>))}</tr></thead>
                <tbody>{Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)}</tbody>
              </table>
            </div>
          ) : err ? (<div className="tw-p-4 tw-text-red-600">{err}</div>) : (
            <div className="tw-overflow-x-auto tw-w-full"><table className="tw-w-full tw-border-separate tw-border-spacing-0 tw-min-w-[900px]">
              <thead className="tw-bg-gradient-to-r tw-from-gray-900 tw-to-gray-800">{table.getHeaderGroups().map((hg) => (<tr key={hg.id}>{hg.headers.map((h) => (<th key={h.id} onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined} className="tw-px-3 tw-py-3 tw-uppercase !tw-text-blue-gray-500 !tw-font-medium tw-text-left tw-whitespace-nowrap"><Typography color="blue-gray" className={`tw-flex tw-items-center tw-gap-2 tw-text-[11px] !tw-font-bold tw-leading-none tw-opacity-80 tw-tracking-wider !tw-text-white ${h.column.getCanSort() ? "tw-cursor-pointer" : ""}`}>{flexRender(h.column.columnDef.header, h.getContext())}{h.column.getCanSort() && <ChevronUpDownIcon strokeWidth={2} className="tw-h-4 tw-w-4 tw-text-white/60" />}</Typography></th>))}</tr>))}</thead>
              <tbody>{table.getRowModel().rows.length ? (table.getRowModel().rows.map((row) => { const hasChargers = row.original.chargers.length > 0; const canEdit = isAdmin || row.original.user_id === me?.user_id; const canExpand = hasChargers || canEdit; return (<Fragment key={row.id}><tr onClick={() => canExpand && row.toggleExpanded()} className={`tw-transition-colors ${canExpand ? "tw-cursor-pointer" : ""} ${row.getIsExpanded() ? "tw-bg-blue-50/60 tw-shadow-sm" : "odd:tw-bg-white even:tw-bg-blue-gray-50/30 hover:tw-bg-blue-50/40 hover:tw-shadow-[inset_3px_0_0_0_#2196F3]"}`}>{row.getVisibleCells().map((cell) => (<td key={cell.id} className="!tw-border-y !tw-border-x-0 tw-px-3 tw-py-3"><Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-600">{flexRender(cell.column.columnDef.cell, cell.getContext())}</Typography></td>))}</tr>{row.getIsExpanded() && (<ChargersExpandedSection chargers={row.original.chargers} stationId={row.original.station_id} canEdit={canEdit} />)}</Fragment>); })) : (<tr><td className="tw-px-4 tw-py-6 tw-text-center" colSpan={columns.length}>{t.noStationsFound}</td></tr>)}</tbody>
            </table></div>
          )}
        </CardFooter>
        <div className="tw-flex tw-items-center tw-justify-between tw-px-6 tw-py-4 tw-border-t tw-border-blue-gray-100">
          <Typography variant="small" className="!tw-text-blue-gray-400">{filteredDataByStatus.length} {t.stationName}</Typography>
          <div className="tw-flex tw-items-center tw-gap-4">
            <span className="tw-text-sm tw-text-blue-gray-600">{t.page} <strong>{table.getState().pagination.pageIndex + 1}</strong> {t.of} <strong>{table.getPageCount()}</strong></span>
            <div className="tw-flex tw-items-center tw-gap-1">
              <Button variant="outlined" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="disabled:tw-opacity-30 tw-py-1.5 tw-px-2 tw-rounded-lg tw-border-blue-gray-200"><ChevronLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-600 tw-stroke-2" /></Button>
              <Button variant="outlined" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="disabled:tw-opacity-30 tw-py-1.5 tw-px-2 tw-rounded-lg tw-border-blue-gray-200"><ChevronRightIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-600 tw-stroke-2" /></Button>
            </div>
          </div>
        </div>
      </Card>

      <AddStation open={openAdd} onClose={() => setOpenAdd(false)} onSubmit={handleCreateStation} onSubmitImages={handleSubmitImages} loading={saving} currentUser={me?.username ?? ""} isAdmin={isAdmin} allOwners={usernames} />

      {/* ========== Edit Station Modal ========== */}
      <Dialog open={openEditStation} handler={() => setOpenEditStation(false)} size="lg" dismiss={{ outsidePress: !saving, escapeKey: !saving }} className="tw-flex tw-flex-col tw-max-h-[95vh] sm:tw-max-h-[90vh] tw-overflow-hidden !tw-rounded-xl sm:!tw-rounded-2xl !tw-m-2 sm:!tw-m-4">
        <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-bg-gradient-to-r tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-4 sm:tw-px-6 tw-py-3.5 sm:tw-py-5 tw-border-0 tw-shadow-xl tw-shrink-0">
          <div className="tw-flex tw-items-center tw-justify-between tw-w-full">
            <Typography variant="h5" className="!tw-text-white !tw-font-bold !tw-tracking-tight !tw-leading-tight !tw-text-base sm:!tw-text-lg">{t.editStation}</Typography>
            <button type="button" onClick={() => setOpenEditStation(false)} className="tw-p-1.5 sm:tw-p-2 tw-rounded-xl tw-bg-white/10 hover:tw-bg-white/20 tw-text-white/60 hover:tw-text-white tw-transition-all tw-duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-5 tw-w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); handleUpdateStation(); }} className="tw-flex tw-flex-col tw-min-h-0">
          <DialogBody className="tw-flex-1 tw-min-h-0 tw-overflow-y-auto tw-space-y-3 sm:tw-space-y-5 tw-px-3 sm:tw-px-6 tw-py-3 sm:tw-py-5 tw-bg-gray-50/60">
            <section className="tw-rounded-xl sm:tw-rounded-2xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/[.06] tw-overflow-hidden">
              <div className="tw-px-3.5 sm:tw-px-5 tw-py-3 sm:tw-py-4 tw-border-b tw-border-gray-100 tw-flex tw-items-center tw-gap-2.5 sm:tw-gap-3">
                <SectionIcon emoji="📍" />
                <Typography variant="h6" className="!tw-text-gray-800 !tw-font-bold !tw-tracking-tight !tw-text-sm sm:!tw-text-base">{t.stationInfo}</Typography>
              </div>
              <div className="tw-p-3.5 sm:tw-p-5 tw-space-y-4 sm:tw-space-y-5">
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-3 sm:tw-gap-4">
                  <Input label={t.stationName} required value={editStationForm.station_name} onChange={(e) => setEditStationForm(s => ({ ...s, station_name: e.target.value }))} crossOrigin={undefined} />
                  {isAdmin ? (owners.length > 0 ? (
                    <Select label={t.owner} value={selectedOwnerId} onChange={(v) => setSelectedOwnerId(v ?? "")}>
                      {owners.map(o => (<Option key={o.user_id} value={o.user_id}>{o.username}</Option>))}
                    </Select>
                  ) : (<Input label={t.owner} value={t.loading} readOnly className="!tw-bg-gray-100" crossOrigin={undefined} />)
                  ) : (<Input label={t.owner} value={editingStation?.username ?? "-"} readOnly disabled crossOrigin={undefined} />)}
                  <Input label={t.maximoLocation} value={editStationForm.maximo_location} onChange={(e) => setEditStationForm(s => ({ ...s, maximo_location: e.target.value }))} crossOrigin={undefined} />
                  <Input label={t.maximoDescription} value={editStationForm.maximo_desc} onChange={(e) => setEditStationForm(s => ({ ...s, maximo_desc: e.target.value }))} crossOrigin={undefined} />
                  <Select label={t.status} value={String(editStationForm.is_active)} onChange={(v) => setEditStationForm(s => ({ ...s, is_active: v === "true" }))}>
                    <Option value="true">{t.active}</Option>
                    <Option value="false">{t.inactive}</Option>
                  </Select>
                </div>

                {/* ✅ Station Images — grid-cols-2 เหมือน AddStation */}
                <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-100">
                  <p className="tw-text-[10px] sm:tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-widest tw-mb-2.5 sm:tw-mb-3">📷 {t.stationImages}</p>
                  <div className="tw-grid tw-grid-cols-1 tw-gap-2.5 sm:tw-grid-cols-2 sm:tw-gap-3">
                    {/* Station Image */}
                    <div className="tw-space-y-2">
                      <ImageZone
                        label={t.stationImage}
                        previews={editStationPreviews}
                        onUpload={pickStationImage}
                        onRemove={removeEditStationImage}
                        emptyLabel={t.noImages}
                        uploadLabel={t.upload}
                        existingImages={editingStation?.stationImage && !deleteCurrentImage ? [editingStation.stationImage] : undefined}
                        apiBase={API_BASE}
                        onRemoveExisting={() => setDeleteCurrentImage(true)}
                      />
                      {deleteCurrentImage && editingStation?.stationImage && (
                        <div className="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-rounded-lg tw-bg-red-50 tw-ring-1 tw-ring-red-200/60">
                          <TrashIcon className="tw-h-4 tw-w-4 tw-text-red-500" />
                          <span className="tw-text-[11px] tw-text-red-600 tw-font-medium">{t.willBeDeleted}</span>
                          <button type="button" onClick={() => setDeleteCurrentImage(false)} className="tw-ml-auto tw-text-[11px] tw-text-blue-600 tw-font-semibold hover:tw-underline">{t.undo}</button>
                        </div>
                      )}
                    </div>
                    {/* ✅ MDB Image Zone */}
                    <ImageZone
                      label={t.mdbImage}
                      previews={editMdbPreviews}
                      onUpload={pickMdbImage}
                      onRemove={removeEditMdbImage}
                      emptyLabel={t.noImages}
                      uploadLabel={t.upload}
                      existingImages={editingStation?.mdbImages && editingStation.mdbImages.length > 0 ? editingStation.mdbImages : undefined}
                      apiBase={API_BASE}
                    />
                  </div>
                </div>
              </div>
            </section>
          </DialogBody>

          <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-3 sm:tw-px-6 tw-py-3 sm:tw-py-4 tw-border-t tw-border-gray-200/80 tw-shrink-0">
            <div className="tw-flex tw-w-full tw-flex-col sm:tw-flex-row tw-justify-end tw-items-center tw-gap-2.5 sm:tw-gap-0">
              <div className="tw-flex tw-gap-2 sm:tw-gap-2.5 tw-w-full sm:tw-w-auto">
                <Button variant="outlined" type="button" onClick={() => setOpenEditStation(false)} className="tw-flex-1 sm:tw-flex-none tw-rounded-xl tw-border-gray-300 tw-text-gray-600 hover:tw-bg-gray-50 tw-normal-case tw-font-semibold tw-text-xs sm:tw-text-sm tw-px-4 sm:tw-px-5 tw-py-2.5 sm:tw-py-2">{t.cancel}</Button>
                <Button type="submit" disabled={saving} className="tw-flex-1 sm:tw-flex-none tw-rounded-xl tw-bg-gray-900 hover:tw-bg-black tw-shadow-lg tw-shadow-gray-900/20 tw-normal-case tw-font-semibold tw-text-xs sm:tw-text-sm tw-tracking-wide tw-px-4 sm:tw-px-6 tw-py-2.5 sm:tw-py-2 disabled:tw-opacity-50 tw-transition-all tw-duration-200 hover:tw-shadow-xl">{saving ? <span className="tw-flex tw-items-center tw-justify-center tw-gap-2"><Spinner />{t.saving}</span> : t.save}</Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </Dialog>

      {/* ========== Edit Charger Modal ========== */}
      <Dialog open={openEditCharger} handler={() => setOpenEditCharger(false)} size="lg" dismiss={{ outsidePress: !saving, escapeKey: !saving }} className="tw-flex tw-flex-col tw-max-h-[95vh] sm:tw-max-h-[90vh] tw-overflow-hidden !tw-rounded-xl sm:!tw-rounded-2xl !tw-m-2 sm:!tw-m-4">
        <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-bg-gradient-to-r tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-4 sm:tw-px-6 tw-py-3.5 sm:tw-py-5 tw-border-0 tw-shadow-xl tw-shrink-0">
          <div className="tw-flex tw-items-center tw-justify-between tw-w-full">
            <Typography variant="h5" className="!tw-text-white !tw-font-bold !tw-tracking-tight !tw-leading-tight !tw-text-base sm:!tw-text-lg">{t.editCharger}</Typography>
            <button type="button" onClick={() => setOpenEditCharger(false)} className="tw-p-1.5 sm:tw-p-2 tw-rounded-xl tw-bg-white/10 hover:tw-bg-white/20 tw-text-white/60 hover:tw-text-white tw-transition-all tw-duration-200"><svg xmlns="http://www.w3.org/2000/svg" className="tw-h-5 tw-w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
          </div>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); handleUpdateCharger(); }} className="tw-flex tw-flex-col tw-min-h-0">
          <DialogBody className="tw-flex-1 tw-min-h-0 tw-overflow-y-auto tw-space-y-3 sm:tw-space-y-5 tw-px-3 sm:tw-px-6 tw-py-3 sm:tw-py-5 tw-bg-gray-50/60">
            <section className="tw-rounded-xl sm:tw-rounded-2xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/[.06] tw-overflow-hidden">
              <div className="tw-flex tw-items-center tw-justify-between tw-px-3.5 sm:tw-px-5 tw-py-2.5 sm:tw-py-3 tw-bg-gradient-to-r tw-from-amber-50 tw-to-orange-50/80 tw-border-b tw-border-amber-100/70">
                <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-2.5 tw-min-w-0">
                  <span className="tw-inline-flex tw-items-center tw-justify-center tw-h-6 tw-w-6 sm:tw-h-7 sm:tw-w-7 tw-rounded-lg tw-bg-gradient-to-br tw-from-amber-400 tw-to-orange-500 tw-shadow tw-text-white tw-text-[10px] sm:tw-text-xs tw-font-bold tw-shrink-0">{editChargerForm.chargerNo}</span>
                  <span className="tw-text-xs sm:tw-text-sm tw-font-bold tw-text-gray-700 tw-truncate">{t.chargerNo} {editChargerForm.chargerNo}</span>
                  {editChargerForm.brand && (<span className="tw-hidden sm:tw-inline tw-px-2 tw-py-0.5 tw-rounded-md tw-bg-white/90 tw-text-[10px] tw-font-semibold tw-text-blue-gray-500 tw-ring-1 tw-ring-black/5 tw-shadow-sm tw-truncate tw-max-w-[120px]">{editChargerForm.brand}{editChargerForm.model ? ` ${editChargerForm.model}` : ""}</span>)}
                </div>
              </div>
              <div className="tw-p-3.5 sm:tw-p-5 tw-space-y-3 sm:tw-space-y-4">
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-2.5 sm:tw-gap-3">
                  <div className="tw-relative"><Input label={`${t.chargerNo} (${t.auto})`} type="number" value={editChargerForm.chargerNo} readOnly className="!tw-bg-gray-50" crossOrigin={undefined} /><span className="tw-absolute tw-right-3 tw-top-1/2 tw--translate-y-1/2 tw-text-[9px] tw-text-blue-gray-300 tw-font-medium">({t.auto})</span></div>
                  <Select label={t.chargerType} value={editChargerForm.chargerType} onChange={(v) => setEditChargerForm(s => ({ ...s, chargerType: v ?? "DC" }))}><Option value="DC">DC</Option><Option value="AC">AC</Option><Option value="DC & AC">DC & AC</Option></Select>
                  <Input label={t.brand} required value={editChargerForm.brand} onChange={(e) => setEditChargerForm(s => ({ ...s, brand: e.target.value }))} crossOrigin={undefined} />
                  <Input label={t.model} required value={editChargerForm.model} onChange={(e) => setEditChargerForm(s => ({ ...s, model: e.target.value }))} crossOrigin={undefined} />
                  <Input label={t.serialNumber} required value={editChargerForm.SN} onChange={(e) => setEditChargerForm(s => ({ ...s, SN: e.target.value }))} crossOrigin={undefined} />
                  <Input label={`${t.power} (kW)`} required value={editChargerForm.power} onChange={(e) => setEditChargerForm(s => ({ ...s, power: e.target.value }))} crossOrigin={undefined} />
                  {isFlexxfast(editChargerForm.brand) && (<>
                    <Input label={t.workOrder} value={editChargerForm.WO} onChange={(e) => setEditChargerForm(s => ({ ...s, WO: e.target.value }))} crossOrigin={undefined} />
                    <Input label={t.plcFirmware} required value={editChargerForm.PLCFirmware} onChange={(e) => setEditChargerForm(s => ({ ...s, PLCFirmware: e.target.value }))} crossOrigin={undefined} />
                    <Input label={t.piFirmware} required value={editChargerForm.PIFirmware} onChange={(e) => setEditChargerForm(s => ({ ...s, PIFirmware: e.target.value }))} crossOrigin={undefined} />
                    <Input label={t.routerFirmware} required value={editChargerForm.RTFirmware} onChange={(e) => setEditChargerForm(s => ({ ...s, RTFirmware: e.target.value }))} crossOrigin={undefined} />
                  </>)}
                  <Input label={t.maximoLocation} value={editChargerForm.maximo_location} onChange={(e) => setEditChargerForm(s => ({ ...s, maximo_location: e.target.value }))} crossOrigin={undefined} />
                  <Input label={t.maximoDescription} value={editChargerForm.maximo_desc} onChange={(e) => setEditChargerForm(s => ({ ...s, maximo_desc: e.target.value }))} crossOrigin={undefined} />
                  <Input label={t.commissioningDate} type="date" value={editChargerForm.commissioningDate} onChange={(e) => setEditChargerForm(s => ({ ...s, commissioningDate: e.target.value }))} crossOrigin={undefined} />
                  <Input label={t.warrantyYears} type="number" min={1} max={10} value={editChargerForm.warrantyYears} onChange={(e) => setEditChargerForm(s => ({ ...s, warrantyYears: parseInt(e.target.value) || 1 }))} crossOrigin={undefined} />
                  <Input label={t.numberOfCables} type="number" min={1} max={10} value={editChargerForm.numberOfCables} onChange={(e) => setEditChargerForm(s => ({ ...s, numberOfCables: parseInt(e.target.value) || 1 }))} crossOrigin={undefined} />
                  <Select label={t.status} value={String(editChargerForm.is_active)} onChange={(v) => setEditChargerForm(s => ({ ...s, is_active: v === "true" }))}><Option value="true">{t.active}</Option><Option value="false">{t.inactive}</Option></Select>
                </div>
                {isFlexxfast(editChargerForm.brand) && (
                  <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-100">
                    <p className="tw-text-[10px] sm:tw-text-[11px] tw-font-bold tw-text-purple-500 tw-uppercase tw-tracking-widest tw-mb-2.5 sm:tw-mb-3">{t.ocppSection}</p>
                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-2.5 sm:tw-gap-3">
                      <Input label={t.chargerBoxId} required value={editChargerForm.chargeBoxID} onChange={(e) => setEditChargerForm(s => ({ ...s, chargeBoxID: e.target.value }))} crossOrigin={undefined} />
                      <Input label={t.ocppUrl} value={editChargerForm.ocppUrl} onChange={(e) => setEditChargerForm(s => ({ ...s, ocppUrl: e.target.value }))} crossOrigin={undefined} />
                    </div>
                  </div>
                )}
                <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-100">
                  <p className="tw-text-[10px] sm:tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-widest tw-mb-2.5 sm:tw-mb-3">📷 {t.chargerImages}</p>
                  <div className="tw-grid tw-grid-cols-1 tw-gap-2.5 sm:tw-grid-cols-2 sm:tw-gap-3">
                    <div className="tw-space-y-2">
                      <ImageZone label={t.chargerImage} previews={editChargerPreviews} onUpload={pickChargerImage} onRemove={removeEditChargerImage} emptyLabel={t.noImages} uploadLabel={t.upload} existingImages={editingCharger?.charger.chargerImages?.filter((_, i) => !deletedExistingChargerIdxs.has(i))} apiBase={API_BASE} onRemoveExisting={(filteredIdx) => { const remaining = (editingCharger?.charger.chargerImages || []).map((url, i) => ({ url, i })).filter(({ i }) => !deletedExistingChargerIdxs.has(i)); if (remaining[filteredIdx]) { setDeletedExistingChargerIdxs(prev => { const next = new Set(Array.from(prev)); next.add(remaining[filteredIdx].i); return next; }); } }} />
                      {deletedExistingChargerIdxs.size > 0 && (<div className="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-rounded-lg tw-bg-red-50 tw-ring-1 tw-ring-red-200/60"><TrashIcon className="tw-h-4 tw-w-4 tw-text-red-500" /><span className="tw-text-[11px] tw-text-red-600 tw-font-medium">{deletedExistingChargerIdxs.size} {t.willBeDeleted}</span><button type="button" onClick={() => setDeletedExistingChargerIdxs(new Set())} className="tw-ml-auto tw-text-[11px] tw-text-blue-600 tw-font-semibold hover:tw-underline">{t.undo}</button></div>)}
                    </div>
                    <div className="tw-space-y-2">
                      <ImageZone label={t.deviceImage} previews={editDevicePreviews} onUpload={pickDeviceImage} onRemove={removeEditDeviceImage} emptyLabel={t.noImages} uploadLabel={t.upload} existingImages={editingCharger?.charger.deviceImages?.filter((_, i) => !deletedExistingDeviceIdxs.has(i))} apiBase={API_BASE} onRemoveExisting={(filteredIdx) => { const remaining = (editingCharger?.charger.deviceImages || []).map((url, i) => ({ url, i })).filter(({ i }) => !deletedExistingDeviceIdxs.has(i)); if (remaining[filteredIdx]) { setDeletedExistingDeviceIdxs(prev => { const next = new Set(Array.from(prev)); next.add(remaining[filteredIdx].i); return next; }); } }} />
                      {deletedExistingDeviceIdxs.size > 0 && (<div className="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-rounded-lg tw-bg-red-50 tw-ring-1 tw-ring-red-200/60"><TrashIcon className="tw-h-4 tw-w-4 tw-text-red-500" /><span className="tw-text-[11px] tw-text-red-600 tw-font-medium">{deletedExistingDeviceIdxs.size} {t.willBeDeleted}</span><button type="button" onClick={() => setDeletedExistingDeviceIdxs(new Set())} className="tw-ml-auto tw-text-[11px] tw-text-blue-600 tw-font-semibold hover:tw-underline">{t.undo}</button></div>)}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </DialogBody>
          <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-3 sm:tw-px-6 tw-py-3 sm:tw-py-4 tw-border-t tw-border-gray-200/80 tw-shrink-0">
            <div className="tw-flex tw-w-full tw-flex-col sm:tw-flex-row tw-justify-end tw-items-center tw-gap-2.5 sm:tw-gap-0">
              <div className="tw-flex tw-gap-2 sm:tw-gap-2.5 tw-w-full sm:tw-w-auto">
                <Button variant="outlined" type="button" onClick={() => setOpenEditCharger(false)} className="tw-flex-1 sm:tw-flex-none tw-rounded-xl tw-border-gray-300 tw-text-gray-600 hover:tw-bg-gray-50 tw-normal-case tw-font-semibold tw-text-xs sm:tw-text-sm tw-px-4 sm:tw-px-5 tw-py-2.5 sm:tw-py-2">{t.cancel}</Button>
                <Button type="submit" disabled={saving} className="tw-flex-1 sm:tw-flex-none tw-rounded-xl tw-bg-gray-900 hover:tw-bg-black tw-shadow-lg tw-shadow-gray-900/20 tw-normal-case tw-font-semibold tw-text-xs sm:tw-text-sm tw-tracking-wide tw-px-4 sm:tw-px-6 tw-py-2.5 sm:tw-py-2 disabled:tw-opacity-50 tw-transition-all tw-duration-200 hover:tw-shadow-xl">{saving ? <span className="tw-flex tw-items-center tw-justify-center tw-gap-2"><Spinner />{t.saving}</span> : t.save}</Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </Dialog>

      {/* ========== Add Charger Modal ========== */}
      <Dialog open={openAddCharger} handler={() => { resetAddChargerImages(); setOpenAddCharger(false); }} size="lg" dismiss={{ outsidePress: !saving, escapeKey: !saving }} className="tw-flex tw-flex-col tw-max-h-[95vh] sm:tw-max-h-[90vh] tw-overflow-hidden !tw-rounded-xl sm:!tw-rounded-2xl !tw-m-2 sm:!tw-m-4">
        <DialogHeader className="tw-sticky tw-top-0 tw-z-10 tw-bg-gradient-to-r tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-4 sm:tw-px-6 tw-py-3.5 sm:tw-py-5 tw-border-0 tw-shadow-xl tw-shrink-0">
          <div className="tw-flex tw-items-center tw-justify-between tw-w-full">
            <div><Typography variant="h5" className="!tw-text-white !tw-font-bold !tw-tracking-tight !tw-leading-tight !tw-text-base sm:!tw-text-lg">{t.addChargerTitle}</Typography><Typography variant="small" className="!tw-text-white/50 !tw-text-xs">{t.station}: {addingChargerStationId}</Typography></div>
            <button type="button" onClick={() => { resetAddChargerImages(); setOpenAddCharger(false); }} className="tw-p-1.5 sm:tw-p-2 tw-rounded-xl tw-bg-white/10 hover:tw-bg-white/20 tw-text-white/60 hover:tw-text-white tw-transition-all tw-duration-200"><svg xmlns="http://www.w3.org/2000/svg" className="tw-h-5 tw-w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
          </div>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); handleCreateCharger(); }} className="tw-flex tw-flex-col tw-min-h-0">
          <DialogBody className="tw-flex-1 tw-min-h-0 tw-overflow-y-auto tw-space-y-3 sm:tw-space-y-5 tw-px-3 sm:tw-px-6 tw-py-3 sm:tw-py-5 tw-bg-gray-50/60">
            <section className="tw-rounded-xl sm:tw-rounded-2xl tw-bg-white tw-shadow-sm tw-ring-1 tw-ring-black/[.06] tw-overflow-hidden">
              <div className="tw-flex tw-items-center tw-justify-between tw-px-3.5 sm:tw-px-5 tw-py-2.5 sm:tw-py-3 tw-bg-gradient-to-r tw-from-amber-50 tw-to-orange-50/80 tw-border-b tw-border-amber-100/70">
                <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-2.5 tw-min-w-0">
                  <span className="tw-inline-flex tw-items-center tw-justify-center tw-h-6 tw-w-6 sm:tw-h-7 sm:tw-w-7 tw-rounded-lg tw-bg-gradient-to-br tw-from-amber-400 tw-to-orange-500 tw-shadow tw-text-white tw-text-[10px] sm:tw-text-xs tw-font-bold tw-shrink-0">{addChargerForm.chargerNo}</span>
                  <span className="tw-text-xs sm:tw-text-sm tw-font-bold tw-text-gray-700 tw-truncate">{t.chargerNo} {addChargerForm.chargerNo}</span>
                </div>
              </div>
              <div className="tw-p-3.5 sm:tw-p-5 tw-space-y-3 sm:tw-space-y-4">
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-2.5 sm:tw-gap-3">
                  <div className="tw-relative"><Input label={`${t.chargerNo} (${t.auto})`} type="number" value={addChargerForm.chargerNo} readOnly className="!tw-bg-gray-50 !tw-cursor-not-allowed" crossOrigin={undefined} /><span className="tw-absolute tw-right-3 tw-top-1/2 tw--translate-y-1/2 tw-text-[9px] tw-text-blue-gray-300 tw-font-medium">({t.auto})</span></div>
                  <Select label={t.chargerType} value={addChargerForm.chargerType} onChange={(v) => setAddChargerForm(s => ({ ...s, chargerType: v ?? "DC" }))}><Option value="DC">DC</Option><Option value="AC">AC</Option></Select>
                  <Input label={t.brand} required value={addChargerForm.brand} onChange={(e) => setAddChargerForm(s => ({ ...s, brand: e.target.value }))} crossOrigin={undefined} />
                  <Input label={t.model} required value={addChargerForm.model} onChange={(e) => setAddChargerForm(s => ({ ...s, model: e.target.value }))} crossOrigin={undefined} />
                  <Input label={t.serialNumber} required value={addChargerForm.SN} onChange={(e) => setAddChargerForm(s => ({ ...s, SN: e.target.value }))} crossOrigin={undefined} />
                  <Input label={`${t.power} (kW)`} required value={addChargerForm.power} onChange={(e) => setAddChargerForm(s => ({ ...s, power: e.target.value }))} crossOrigin={undefined} />
                  {isFlexxfast(addChargerForm.brand) && (<>
                    <Input label={t.workOrder} value={addChargerForm.WO} onChange={(e) => setAddChargerForm(s => ({ ...s, WO: e.target.value }))} crossOrigin={undefined} />
                    <Input label={t.plcFirmware} required value={addChargerForm.PLCFirmware} onChange={(e) => setAddChargerForm(s => ({ ...s, PLCFirmware: e.target.value }))} crossOrigin={undefined} />
                    <Input label={t.piFirmware} required value={addChargerForm.PIFirmware} onChange={(e) => setAddChargerForm(s => ({ ...s, PIFirmware: e.target.value }))} crossOrigin={undefined} />
                    <Input label={t.routerFirmware} required value={addChargerForm.RTFirmware} onChange={(e) => setAddChargerForm(s => ({ ...s, RTFirmware: e.target.value }))} crossOrigin={undefined} />
                    <Input label={t.chargerBoxId} required value={addChargerForm.chargeBoxID} onChange={(e) => setAddChargerForm(s => ({ ...s, chargeBoxID: e.target.value }))} crossOrigin={undefined} />
                    <Input label={t.ocppUrl} value={addChargerForm.ocppUrl} onChange={(e) => setAddChargerForm(s => ({ ...s, ocppUrl: e.target.value }))} crossOrigin={undefined} />
                  </>)}
                  <Input label={t.maximoLocation} value={addChargerForm.maximo_location} onChange={(e) => setAddChargerForm(s => ({ ...s, maximo_location: e.target.value }))} crossOrigin={undefined} />
                  <Input label={t.maximoDescription} value={addChargerForm.maximo_desc} onChange={(e) => setAddChargerForm(s => ({ ...s, maximo_desc: e.target.value }))} crossOrigin={undefined} />
                  <Input label={t.commissioningDate} type="date" required value={addChargerForm.commissioningDate} onChange={(e) => setAddChargerForm(s => ({ ...s, commissioningDate: e.target.value }))} crossOrigin={undefined} />
                  <Input label={t.warrantyYears} type="number" min={1} max={10} required value={addChargerForm.warrantyYears} onChange={(e) => setAddChargerForm(s => ({ ...s, warrantyYears: parseInt(e.target.value) || 1 }))} crossOrigin={undefined} />
                  <Input label={t.numberOfCables} type="number" min={1} max={10} required value={addChargerForm.numberOfCables} onChange={(e) => setAddChargerForm(s => ({ ...s, numberOfCables: parseInt(e.target.value) || 1 }))} crossOrigin={undefined} />
                  <Select label={t.status} value={String(addChargerForm.is_active)} onChange={(v) => setAddChargerForm(s => ({ ...s, is_active: v === "true" }))}><Option value="true">{t.active}</Option><Option value="false">{t.inactive}</Option></Select>
                </div>
                {isFlexxfast(addChargerForm.brand) && (
                  <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-100">
                    <p className="tw-text-[10px] sm:tw-text-[11px] tw-font-bold tw-text-purple-500 tw-uppercase tw-tracking-widest tw-mb-2.5 sm:tw-mb-3">{t.ocppSection}</p>
                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-2.5 sm:tw-gap-3">
                      <Input label={t.chargerBoxId} required value={addChargerForm.chargeBoxID} onChange={(e) => setAddChargerForm(s => ({ ...s, chargeBoxID: e.target.value }))} crossOrigin={undefined} />
                      <Input label={t.ocppUrl} value={addChargerForm.ocppUrl} onChange={(e) => setAddChargerForm(s => ({ ...s, ocppUrl: e.target.value }))} crossOrigin={undefined} />
                    </div>
                  </div>
                )}
                <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-100">
                  <p className="tw-text-[10px] sm:tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-widest tw-mb-2.5 sm:tw-mb-3">📷 {t.chargerImages}</p>
                  <div className="tw-grid tw-grid-cols-1 tw-gap-2.5 sm:tw-grid-cols-2 sm:tw-gap-3">
                    <ImageZone label={t.chargerImage} previews={addChargerPreviews} onUpload={pickAddChargerImage} onRemove={removeAddChargerImage} emptyLabel={t.noImages} uploadLabel={t.upload} />
                    <ImageZone label={t.deviceImage} previews={addDevicePreviews} onUpload={pickAddDeviceImage} onRemove={removeAddDeviceImage} emptyLabel={t.noImages} uploadLabel={t.upload} />
                  </div>
                </div>
              </div>
            </section>
          </DialogBody>
          <DialogFooter className="tw-sticky tw-bottom-0 tw-z-10 tw-bg-white tw-px-3 sm:tw-px-6 tw-py-3 sm:tw-py-4 tw-border-t tw-border-gray-200/80 tw-shrink-0">
            <div className="tw-flex tw-w-full tw-flex-col sm:tw-flex-row tw-justify-end tw-items-center tw-gap-2.5 sm:tw-gap-0">
              <div className="tw-flex tw-gap-2 sm:tw-gap-2.5 tw-w-full sm:tw-w-auto">
                <Button variant="outlined" type="button" onClick={() => { resetAddChargerImages(); setOpenAddCharger(false); }} className="tw-flex-1 sm:tw-flex-none tw-rounded-xl tw-border-gray-300 tw-text-gray-600 hover:tw-bg-gray-50 tw-normal-case tw-font-semibold tw-text-xs sm:tw-text-sm tw-px-4 sm:tw-px-5 tw-py-2.5 sm:tw-py-2">{t.cancel}</Button>
                <Button type="submit" disabled={saving} className="tw-flex-1 sm:tw-flex-none tw-rounded-xl tw-bg-gray-900 hover:tw-bg-black tw-shadow-lg tw-shadow-gray-900/20 tw-normal-case tw-font-semibold tw-text-xs sm:tw-text-sm tw-tracking-wide tw-px-4 sm:tw-px-6 tw-py-2.5 sm:tw-py-2 disabled:tw-opacity-50 tw-transition-all tw-duration-200 hover:tw-shadow-xl">{saving ? <span className="tw-flex tw-items-center tw-justify-center tw-gap-2"><Spinner />{t.creating}</span> : t.create}</Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDialog.open} onClose={closeConfirm} onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title} message={confirmDialog.message}
        confirmLabel={lang === "th" ? "ลบ" : "Delete"} cancelLabel={lang === "th" ? "ยกเลิก" : "Cancel"}
        variant="danger" loading={confirmDialog.loading}
      />
    </>
  );
}

export default SearchDataTables;