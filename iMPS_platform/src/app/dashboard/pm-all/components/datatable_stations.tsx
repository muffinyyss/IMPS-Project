"use client";
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
import { apiFetch } from "@/utils/api";
import { DocumentArrowDownIcon } from "@heroicons/react/24/outline";

// const API_BASE = "http://localhost:8000";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";


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

type PMReportData = {
    id: string;
    document_name: string;
    issue_id: string;
    pm_type: string;
    pm_date: string;
    status: string;
    technician?: string;
    charger_id?: string;
    station_id?: string;
    file_url?: string;
    side?: string;        // ← เพิ่ม
    sn?: string;          // ← เพิ่ม (สำหรับ photo download)
    has_photos?: boolean; // ← เพิ่ม
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
                        <a href={url.startsWith("http") ? url : `${apiBase}${url}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="tw-block tw-h-full tw-w-full">
                            <img src={url.startsWith("http") ? url : `${apiBase}${url}`} alt={`${label} ${i + 1}`} className="tw-h-full tw-w-full tw-object-cover" />
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
    const [isOtherOwnerEdit, setIsOtherOwnerEdit] = useState(false);
    const [otherOwnerNameEdit, setOtherOwnerNameEdit] = useState("");
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
    const [deletedExistingMdbIdxs, setDeletedExistingMdbIdxs] = useState<Set<number>>(new Set());
    const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false, loading: false }));
    const [availability, setAvailability] = useState<Map<string, { total: number; available: number }>>(new Map());
    const [chargerAvailability, setChargerAvailability] = useState<Map<string, { total: number; available: number }>>(new Map());

    const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

    const [pmReports, setPmReports] = useState<Map<string, PMReportData[]>>(new Map());
    const [pmLoading, setPmLoading] = useState<Set<string>>(new Set());
    const [pmCounts, setPmCounts] = useState<Map<string, Record<string, number>>>(new Map());
    const [pmByType, setPmByType] = useState<Record<string, number>>({});
    const [pmTotal, setPmTotal] = useState<number>(0);
    const [pmCountsLoading, setPmCountsLoading] = useState(true);
    // type ที่เลือกจากการ์ดด้านบน (default = CHARGER) → กรองคอลัมน์ + รายการที่ขยาย
    const [typeFilter, setTypeFilter] = useState<string>("CHARGER");

    // นับจำนวนเอกสาร PM (ต่อสถานี + แยกตาม type) — endpoint count โดยเฉพาะ
    useEffect(() => {
        let stopped = false;
        (async () => {
            try {
                const res = await apiFetch(`/pm-reports/counts`);
                if (!res.ok) return;
                const json = await res.json();
                const counts = new Map<string, Record<string, number>>();
                Object.entries(json.counts ?? {}).forEach(([sid, obj]) => {
                    counts.set(sid, (obj as Record<string, number>) ?? {});
                });
                if (!stopped) {
                    setPmCounts(counts);
                    setPmByType(json.by_type ?? {});
                    setPmTotal(Number(json.total) || 0);
                }
            } catch (e) {
                console.error("Failed to fetch PM counts:", e);
            } finally {
                if (!stopped) setPmCountsLoading(false);
            }
        })();
        return () => { stopped = true; };
    }, []);

    const fetchPMReports = async (stationId: string) => {
        if (pmReports.has(stationId) || pmLoading.has(stationId)) return;
        setPmLoading(prev => new Set([...prev, stationId]));
        try {
            const res = await apiFetch(
                `/pm-reports/all-stations?station_id=${stationId}&limit_per_source=50`
            );
            if (!res.ok) return;
            const json = await res.json();

            // ✅ กรอง pre ออก
            const filtered = (json.reports ?? []).filter(
                (r: any) => r.side !== "pre"
            );

            setPmReports(prev => new Map(prev).set(stationId, filtered));
        } catch (e) {
            console.error("Failed to fetch PM reports:", e);
        } finally {
            setPmLoading(prev => {
                const next = new Set([...prev]);
                next.delete(stationId);
                return next;
            });
        }
    };
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

    const handleDeleteReport = async (report: PMReportData, stationId: string) => {
        if (!confirm(lang === "th" ? `ลบรายงาน "${report.document_name}" ใช่หรือไม่?` : `Delete report "${report.document_name}"?`)) return;

        setDeletingReportId(report.id);
        try {
            const sourceMap: Record<string, string> = {
                CHARGER: "pmreport",
                MDB: "mdbpmreport",
                CCB: "ccbpmreport",
                "CB-BOX": "cbboxpmreport",
                STATION: "stationpmreport",
            };
            const prefix = sourceMap[report.pm_type] ?? "pmreport";
            const res = await apiFetch(`/${prefix}/${report.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`Delete failed: ${res.status}`);

            // อัปเดต state ลบออกจาก map
            setPmReports(prev => {
                const next = new Map(prev);
                const list = next.get(stationId) ?? [];
                next.set(stationId, list.filter(r => r.id !== report.id));
                return next;
            });
            setNotice({ type: "success", msg: lang === "th" ? "ลบสำเร็จ" : "Deleted successfully" });
            setTimeout(() => setNotice(null), 2500);
        } catch (e: any) {
            setNotice({ type: "error", msg: e.message || "Delete failed" });
            setTimeout(() => setNotice(null), 3500);
        } finally {
            setDeletingReportId(null);
        }
    };

    const t = useMemo(() => {
        const translations = {
            th: {
                stationManagement: "จัดการสถานี", stationManagementDesc: "จัดการสถานีและตู้ชาร์จ คลิกที่แถวเพื่อดูตู้ชาร์จ คลิกที่การ์ดตู้ชาร์จเพื่อดูรายละเอียด",
                add: "เพิ่ม", entriesPerPage: "รายการต่อหน้า", search: "ค้นหา", images: "รูปภาพ",
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
                available: "พร้อมใช้งาน", availableOf: "หัว", pmReportCount: "จำนวน PM",
                stationInfo: "ข้อมูลสถานี", chargerInfo: "ข้อมูลตู้ชาร์จ",
                upload: "เลือกรูป", noImages: "ยังไม่มีรูป",
                stationImages: "รูปภาพสถานี", chargerImages: "รูปภาพ",
                duplicateChargeBoxID: "Charge Box ID ซ้ำกัน กรุณาตรวจสอบ",
            },
            en: {
                stationManagement: "Station Management", stationManagementDesc: "Manage Stations and Chargers. Click on a row to view chargers, click on a charger card to view details.",
                add: "ADD", entriesPerPage: "entries per page", search: "Search", images: "Images",
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
                available: "Available", availableOf: "heads", pmReportCount: "PM Reports",
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
        setDeletedExistingMdbIdxs(new Set());
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
        const interval = setInterval(poll, 60_000);
        return () => { stopped = true; clearInterval(interval); };
    }, [data]);

    useEffect(() => {
        if (openEditStation && editingStation) {
            setEditStationForm({ station_name: editingStation.station_name ?? "", is_active: !!editingStation.is_active, maximo_location: editingStation.maximo_location ?? "", maximo_desc: editingStation.maximo_desc ?? "" });
            const ownerExists = owners.some(o => o.user_id === editingStation.user_id);
            if (ownerExists) {
                setIsOtherOwnerEdit(false);
                setSelectedOwnerId(editingStation.user_id ?? "");
                setOtherOwnerNameEdit("");
            } else if (editingStation.username) {
                // ไม่เจอใน list → เข้า Other mode แล้วใส่ username เดิม
                setIsOtherOwnerEdit(true);
                setSelectedOwnerId("");
                setOtherOwnerNameEdit(editingStation.username);
            } else {
                setIsOtherOwnerEdit(false);
                setSelectedOwnerId("");
                setOtherOwnerNameEdit("");
            }

            resetEditImages();
        }
    }, [openEditStation, editingStation, owners]);

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

    // ===== แก้ fetchChargerStatuses =====
    const fetchChargerStatuses = async (stations: StationRow[]) => {
        const BATCH_SIZE = 5; // charger มีหลาย SN ต่อ station → batch เล็กลง

        const result = [...stations];

        for (let i = 0; i < result.length; i += BATCH_SIZE) {
            const batch = result.slice(i, i + BATCH_SIZE);

            const updated = await Promise.allSettled(
                batch.map(async (station) => {
                    if (station.chargers.length === 0) return station;

                    const updatedChargers = await Promise.allSettled(
                        station.chargers.map(async (charger) => {
                            try {
                                const sn = charger.SN;
                                if (!sn || sn === "-") return charger;
                                const res = await apiFetch(`/charger-onoff/${sn}`);
                                if (res.ok) {
                                    const d = await res.json();
                                    return { ...charger, status: !!d.status };
                                }
                            } catch {
                                // ไม่ throw
                            }
                            return charger;
                        })
                    );

                    return {
                        ...station,
                        chargers: updatedChargers.map((r) =>
                            r.status === "fulfilled" ? r.value : station.chargers[0]
                        ),
                    };
                })
            );

            updated.forEach((r, idx) => {
                if (r.status === "fulfilled") {
                    result[i + idx] = r.value;
                }
            });
        }

        return result;
    };

    // ===== แก้ fetchAvailability =====
    const fetchAvailability = async (stations: StationRow[]) => {
        const avMap = new Map<string, { total: number; available: number }>();
        const cMap = new Map<string, { total: number; available: number }>();

        // ✅ แบ่งเป็น batch ละ 10 แทน Promise.all ทีเดียว
        const BATCH_SIZE = 10;

        for (let i = 0; i < stations.length; i += BATCH_SIZE) {
            const batch = stations.slice(i, i + BATCH_SIZE);

            await Promise.allSettled(
                batch.map(async (station) => {
                    try {
                        const res = await apiFetch(`/station-availability/${station.station_id}`);
                        if (!res.ok) return;
                        const data = await res.json();
                        avMap.set(station.station_id, {
                            total: data.total,
                            available: data.available,
                        });
                        if (Array.isArray(data.chargers)) {
                            data.chargers.forEach((c: any) => {
                                cMap.set(c.sn, { total: c.total, available: c.available });
                            });
                        }
                    } catch (e) {
                        // ไม่ throw ออก เพื่อไม่ให้ batch หยุด
                        console.warn(`[availability] skip ${station.station_id}`);
                    }
                })
            );
        }

        setAvailability(avMap);
        setChargerAvailability(cMap);
    };

    const mapCharger = (c: any, index: number): ChargerData => {
        const imgs = c.images || {};

        const norm = (v: any): string[] => Array.isArray(v) ? v : (typeof v === "string" && v ? [v] : []);

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
            const payload: StationUpdatePayload = {
                station_name: editStationForm.station_name.trim(), is_active: editStationForm.is_active, maximo_location: editStationForm.maximo_location.trim(), maximo_desc: editStationForm.maximo_desc.trim(), ...(isAdmin && isOtherOwnerEdit && otherOwnerNameEdit.trim()
                    ? { username: otherOwnerNameEdit.trim() }
                    : isAdmin && selectedOwnerId
                        ? { user_id: selectedOwnerId }
                        : {})
            };
            const res = await apiFetch(`/update_stations/${editingStation.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!res.ok) { const errBody = await res.json().catch(() => ({})); throw new Error(errBody?.detail || `Update failed: ${res.status}`); }
            const updated = await res.json();

            // ลบรูป station เดิม
            if (deleteCurrentImage && editingStation.stationImage) {
                await apiFetch(`/stations/${editingStation.station_id}/delete-image`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "station", url: editingStation.stationImage }) });
            }
            // ลบรูป MDB เดิมที่ถูก mark
            const mdbImgsToDelete = (editingStation?.mdbImages || [])
                .filter((_, i) => deletedExistingMdbIdxs.has(i));

            for (const url of mdbImgsToDelete) {
                await apiFetch(`/stations/${editingStation.station_id}/delete-image`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ kind: "mdb", url }),
                });
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

    useEffect(() => { const lock = openAdd || openEditStation || openEditCharger || openAddCharger; if (lock) { const scrollY = window.scrollY; document.body.style.position = "fixed"; document.body.style.top = `-${scrollY}px`; document.body.style.left = "0"; document.body.style.right = "0"; document.body.style.width = "100%"; document.body.style.overflow = "hidden"; } else { const top = document.body.style.top; document.body.style.position = ""; document.body.style.top = ""; document.body.style.left = ""; document.body.style.right = ""; document.body.style.width = ""; document.body.style.overflow = ""; if (top) { const y = parseInt(top || "0") * -1; window.scrollTo(0, y); } } }, [openAdd, openEditStation, openEditCharger, openAddCharger]);

    // ===== Columns =====
    const columns = useMemo(() => [
        {
            id: "expander", header: () => null, size: 50,
            cell: ({ row }: { row: Row<StationRow> }) => {
                const canExpand = row.original.chargers.length > 0 || isAdmin || row.original.user_id === me?.user_id;
                if (!canExpand) return null;
                return (
                    <span className="tw-p-1.5 tw-rounded-lg">
                        {row.getIsExpanded()
                            ? <ChevronDownIcon className="tw-h-5 tw-w-5 tw-text-blue-600" />
                            : <ChevronRightIconSolid className="tw-h-5 tw-w-5 tw-text-blue-gray-500" />}
                    </span>
                );
            }
        },
        {
            id: "station_name", header: () => t.stationName,
            accessorFn: (row: StationRow) => row.station_name,
            cell: (info: any) => <span className="tw-font-semibold tw-text-blue-gray-800">{info.getValue()}</span>,
        },
        {
            id: "pm_count", header: () => `${t.pmReportCount} · ${typeFilter}`, size: 140,
            accessorFn: (row: StationRow) => pmCounts.get(row.station_id)?.[typeFilter] ?? 0,
            cell: (info: any) => {
                const n = (info.getValue() as number) ?? 0;
                return (
                    <span className={`tw-inline-flex tw-items-center tw-gap-1.5 tw-px-2.5 tw-py-1 tw-rounded-lg tw-text-xs tw-font-bold ${n > 0 ? "tw-bg-blue-50 tw-text-blue-700" : "tw-bg-blue-gray-50 tw-text-blue-gray-400"}`}>
                        <i className="fa fa-file-alt tw-text-[10px]" />
                        {n}
                    </span>
                );
            },
        },
        {
            id: "username", header: () => t.owner,
            accessorFn: (row: StationRow) => row.username ?? "-",
            cell: (info: any) => <span className="tw-text-blue-gray-600">{info.getValue()}</span>,
        },
    ], [me, isAdmin, t, pmCounts, typeFilter]);

    const table = useReactTable({
        data: filteredDataByStatus, columns,
        getRowId: (row) => row.station_id,
        state: { globalFilter: filtering, sorting, expanded },
        onSortingChange: setSorting, onGlobalFilterChange: setFiltering, onExpandedChange: setExpanded,
        getRowCanExpand: (row) => row.original.chargers.length > 0 || isAdmin || row.original.user_id === me?.user_id,
        getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
        getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel(), getExpandedRowModel: getExpandedRowModel(),
    });


    const PM_TYPE_STYLE: Record<string, string> = {
        CG: "tw-bg-blue-100 tw-text-blue-700",
        MDB: "tw-bg-purple-100 tw-text-purple-700",
        CCB: "tw-bg-orange-100 tw-text-orange-700",
        CBBOX: "tw-bg-teal-100 tw-text-teal-700",
        STATION: "tw-bg-gray-100 tw-text-gray-600",
    };

    const ChargersExpandedSection = ({ stationId, reports, isLoading, canDelete, onDelete }: {
        stationId: string;
        reports: PMReportData[];
        isLoading: boolean;
        canDelete: boolean;
        onDelete: (report: PMReportData) => void;
    }) => (
        <tr>
            <td colSpan={columns.length} className="tw-p-0">
                <div className="tw-bg-gray-50/50 tw-border-t tw-border-blue-gray-100">
                    <div className="tw-px-4 sm:tw-px-6 tw-py-3">
                        {isLoading ? (
                            <div className="tw-flex tw-items-center tw-justify-center tw-py-8 tw-gap-2 tw-text-blue-gray-400">
                                <svg className="tw-animate-spin tw-h-4 tw-w-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <span className="tw-text-sm">{lang === "th" ? "กำลังโหลด..." : "Loading..."}</span>
                            </div>
                        ) : reports.length > 0 ? (
                            <table className="tw-w-full tw-border-separate tw-border-spacing-0 tw-text-sm">
                                <thead>
                                    <tr className="tw-bg-blue-gray-50/80">
                                        <th className="tw-px-3 tw-py-2 tw-text-left tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-wider tw-rounded-l-lg tw-border-b tw-border-blue-gray-100">
                                            {lang === "th" ? "ชื่อเอกสาร" : "Document Name"}
                                        </th>
                                        <th className="tw-px-3 tw-py-2 tw-text-left tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-wider tw-border-b tw-border-blue-gray-100">
                                            Issue ID
                                        </th>
                                        <th className="tw-px-3 tw-py-2 tw-text-left tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-wider tw-border-b tw-border-blue-gray-100">
                                            {lang === "th" ? "ประเภท" : "Type"}
                                        </th>
                                        <th className="tw-px-3 tw-py-2 tw-text-left tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-wider tw-border-b tw-border-blue-gray-100">
                                            PM Date
                                        </th>
                                        <th className="tw-px-3 tw-py-2 tw-text-left tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-wider tw-border-b tw-border-blue-gray-100">
                                            {lang === "th" ? "ช่างเทคนิค" : "Technician"}
                                        </th>
                                        <th className={`tw-px-3 tw-py-2 tw-text-left tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-wider tw-border-b tw-border-blue-gray-100 ${!canDelete ? "tw-rounded-r-lg" : ""}`}>
                                            PDF
                                        </th>
                                        {canDelete && (
                                            <th className="tw-px-3 tw-py-2 tw-text-left tw-text-[11px] tw-font-bold tw-text-blue-gray-500 tw-uppercase tw-tracking-wider tw-rounded-r-lg tw-border-b tw-border-blue-gray-100">
                                                {lang === "th" ? "ลบ" : "Delete"}
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((report) => (
                                        <tr key={report.id} className="hover:tw-bg-blue-50/60 tw-transition-colors tw-cursor-default">
                                            <td className="tw-px-3 tw-py-2.5 tw-border-b tw-border-blue-gray-50">
                                                <span className="tw-font-semibold tw-text-blue-gray-800 tw-text-xs">
                                                    {report.document_name || "-"}
                                                </span>
                                            </td>
                                            <td className="tw-px-3 tw-py-2.5 tw-border-b tw-border-blue-gray-50">
                                                <span className="tw-text-xs tw-font-mono tw-text-blue-gray-600">
                                                    {report.issue_id || "-"}
                                                </span>
                                            </td>
                                            <td className="tw-px-3 tw-py-2.5 tw-border-b tw-border-blue-gray-50">
                                                {report.pm_type ? (
                                                    <span className={`tw-inline-flex tw-items-center tw-px-2 tw-py-0.5 tw-rounded-md tw-text-[11px] tw-font-semibold ${PM_TYPE_STYLE[report.pm_type] ?? "tw-bg-gray-100 tw-text-gray-600"}`}>
                                                        {report.pm_type}
                                                    </span>
                                                ) : <span className="tw-text-blue-gray-300 tw-text-xs">-</span>}
                                            </td>
                                            <td className="tw-px-3 tw-py-2.5 tw-border-b tw-border-blue-gray-50">
                                                <span className="tw-text-xs tw-text-blue-gray-600">
                                                    {formatDate(report.pm_date)}
                                                </span>
                                            </td>
                                            <td className="tw-px-3 tw-py-2.5 tw-border-b tw-border-blue-gray-50">
                                                <span className="tw-text-xs tw-text-blue-gray-600">
                                                    {report.technician || "-"}
                                                </span>
                                            </td>
                                            <td className="tw-px-3 tw-py-2.5 tw-border-b tw-border-blue-gray-50">
                                                {report.file_url ? (
                                                    <a
                                                        href={report.file_url.startsWith("http") ? report.file_url : `${API_BASE}${report.file_url}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-md tw-p-1.5 tw-text-red-600 hover:tw-text-red-800 hover:tw-bg-red-50 tw-transition-colors"
                                                        title="PDF"
                                                    >
                                                        <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
                                                    </a>
                                                ) : (
                                                    <span className="tw-text-blue-gray-300 tw-text-xs">-</span>
                                                )}
                                            </td>
                                            {canDelete && (
                                                <td className="tw-px-3 tw-py-2.5 tw-border-b tw-border-blue-gray-50">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); onDelete(report); }}
                                                        disabled={deletingReportId === report.id}
                                                        className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-md tw-p-1.5 tw-text-red-500 hover:tw-text-red-700 hover:tw-bg-red-50 tw-transition-colors disabled:tw-opacity-40"
                                                        title={lang === "th" ? "ลบ" : "Delete"}
                                                    >
                                                        {deletingReportId === report.id
                                                            ? <svg className="tw-animate-spin tw-h-4 tw-w-4" viewBox="0 0 24 24" fill="none"><circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                                            : <TrashIcon className="tw-h-4 tw-w-4" />
                                                        }
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="tw-text-center tw-py-8 tw-text-blue-gray-400">
                                <p className="tw-text-sm">{lang === "th" ? "ไม่มีข้อมูล PM Report" : "No PM reports found"}</p>
                            </div>
                        )}
                    </div>
                </div>
            </td>
        </tr >
    );

    // ===== Main Return =====
    return (
        <>
            <LoadingOverlay show={loading} text={lang === "th" ? "กำลังโหลดข้อมูล..." : "Loading data..."} />
            <div className="tw-mt-4 tw-mb-4">
                {statusFilter !== "all" && (
                    <div className="tw-mb-3 tw-flex tw-items-center tw-gap-2">
                        <span className="tw-text-sm tw-text-blue-gray-600">{lang === "th" ? `ตัวกรอง: ${statusFilter === "online" ? "ออนไลน์" : "ออฟไลน์"}` : `Filter: ${statusFilter === "online" ? "Online" : "Offline"}`}</span>
                        <button type="button" onClick={() => setStatusFilter("all")} className="tw-text-sm tw-text-blue-600 hover:tw-underline">{lang === "th" ? "ล้างตัวกรอง" : "Clear"}</button>
                    </div>
                )}
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 lg:tw-grid-cols-5 tw-gap-2.5 sm:tw-gap-3">
                    {pmCountsLoading ? (<>{Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}</>) : (
                        <>
                            {([
                                { key: "CHARGER", label: lang === "th" ? "ตู้ชาร์จ" : "Charger", emoji: "⚡", color: "rgba(59,130,246,0.18)", ring: "rgba(96,165,250,0.25)", num: "#60a5fa" },
                                { key: "MDB", label: "MDB", emoji: "🔌", color: "rgba(168,85,247,0.18)", ring: "rgba(192,132,252,0.25)", num: "#c084fc" },
                                { key: "CCB", label: "CCB", emoji: "🧰", color: "rgba(249,115,22,0.18)", ring: "rgba(251,146,60,0.25)", num: "#fb923c" },
                                { key: "CB-BOX", label: "CB-Box", emoji: "📦", color: "rgba(20,184,166,0.18)", ring: "rgba(45,212,191,0.25)", num: "#2dd4bf" },
                                { key: "STATION", label: lang === "th" ? "สถานี" : "Station", emoji: "🏢", color: "rgba(148,163,184,0.18)", ring: "rgba(203,213,225,0.25)", num: "#cbd5e1" },
                            ] as const).map((c) => (
                                <div key={c.key} onClick={() => setTypeFilter(c.key)} role="button" aria-pressed={typeFilter === c.key} className={`tw-group tw-relative tw-overflow-hidden tw-rounded-2xl tw-bg-gradient-to-br tw-from-gray-900 tw-via-gray-800 tw-to-gray-900 tw-px-4 sm:tw-px-5 tw-py-3.5 sm:tw-py-4 tw-ring-1 tw-shadow-lg hover:tw-shadow-xl tw-transition-all tw-duration-300 hover:tw--translate-y-0.5 tw-cursor-pointer ${typeFilter === c.key ? "tw-scale-[1.02]" : "tw-ring-white/10"}`} style={typeFilter === c.key ? { boxShadow: `0 0 0 2px ${c.num}` } : undefined}>
                                    <div className="tw-absolute tw-inset-0 tw-opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                                    <div className="tw-relative tw-z-10">
                                        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
                                            <div className="tw-h-8 tw-w-8 tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-ring-1" style={{ background: c.color, borderColor: c.ring }}>
                                                <span className="tw-text-base">{c.emoji}</span>
                                            </div>
                                            <span className="tw-text-[10px] sm:tw-text-[11px] tw-font-semibold tw-text-white/40 tw-uppercase tw-tracking-wider">{c.label}</span>
                                        </div>
                                        <div className="tw-text-2xl sm:tw-text-3xl tw-font-black tw-tabular-nums tw-tracking-tight tw-leading-none" style={{ color: c.num }}>{pmByType[c.key] ?? 0}</div>
                                        <div className="tw-mt-1 tw-text-[10px] tw-text-white/30">{lang === "th" ? "เอกสาร PM" : "PM docs"}</div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>

            <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-mt-4">
                {notice && (<div className="tw-px-4 tw-pt-4"><Alert color={notice.type === "success" ? "green" : "red"} onClose={() => setNotice(null)}>{notice.msg}</Alert></div>)}

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
                            <tbody>{table.getRowModel().rows.length ? (table.getRowModel().rows.map((row) => {
                                const hasChargers = row.original.chargers.length > 0; const canEdit = isAdmin || row.original.user_id === me?.user_id; const canExpand = hasChargers || canEdit; // ในส่วน row render เพิ่ม onExpand trigger
                                return (
                                    <Fragment key={row.id}>
                                        <tr
                                            onClick={() => {
                                                if (canExpand) {
                                                    row.toggleExpanded();
                                                    if (!row.getIsExpanded()) {
                                                        fetchPMReports(row.original.station_id);
                                                    }
                                                }
                                            }}
                                            className={`tw-transition-colors ${canExpand ? "tw-cursor-pointer" : ""} ${row.getIsExpanded() ? "tw-bg-blue-50/60 tw-shadow-sm" : "odd:tw-bg-white even:tw-bg-blue-gray-50/30 hover:tw-bg-blue-50/40 hover:tw-shadow-[inset_3px_0_0_0_#2196F3]"}`}
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
                                            <ChargersExpandedSection
                                                stationId={row.original.station_id}
                                                reports={(pmReports.get(row.original.station_id) ?? []).filter((r) => r.pm_type === typeFilter)}
                                                isLoading={pmLoading.has(row.original.station_id)}
                                                canDelete={me?.username === "Thatsawan Snongphan"}
                                                onDelete={(report) => handleDeleteReport(report, row.original.station_id)}
                                            />
                                        )}
                                    </Fragment>
                                );
                            })) : (<tr><td className="tw-px-4 tw-py-6 tw-text-center" colSpan={columns.length}>{t.noStationsFound}</td></tr>)}</tbody>
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
                                    {isAdmin ? (
                                        <div className="tw-flex tw-gap-2">
                                            <div className="tw-relative tw-w-full tw-min-w-[200px] tw-h-10">
                                                <select
                                                    value={isOtherOwnerEdit ? "__other__" : selectedOwnerId}
                                                    onChange={(e) => {
                                                        if (e.target.value === "__other__") {
                                                            setIsOtherOwnerEdit(true);
                                                            setSelectedOwnerId("");
                                                            setOtherOwnerNameEdit("");
                                                        } else {
                                                            setIsOtherOwnerEdit(false);
                                                            setSelectedOwnerId(e.target.value);
                                                        }
                                                    }}
                                                    className="tw-peer tw-w-full tw-h-full tw-bg-transparent tw-text-blue-gray-700 tw-font-sans tw-font-normal tw-outline-none tw-border tw-border-blue-gray-200 focus:tw-border-2 focus:tw-border-gray-900 tw-rounded-[7px] tw-px-3 tw-py-2.5 tw-text-sm tw-appearance-none tw-cursor-pointer"
                                                >
                                                    <option value="" disabled hidden />
                                                    {owners.length > 0
                                                        ? owners.map(o => <option key={o.user_id} value={o.user_id}>{o.username}</option>)
                                                        : <option value="" disabled>{t.loading}</option>
                                                    }
                                                    <option value="__other__">{lang === "th" ? "อื่นๆ" : "Other"}</option>
                                                </select>
                                                <div className="tw-pointer-events-none tw-absolute tw-inset-y-0 tw-right-3 tw-flex tw-items-center">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-4 tw-w-4 tw-text-blue-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                                <label className="tw-pointer-events-none tw-absolute tw-left-3 tw--top-1.5 tw-text-[11px] tw-text-blue-gray-400 tw-bg-white tw-px-1 tw-font-normal">
                                                    {t.owner}
                                                </label>
                                            </div>
                                            {isOtherOwnerEdit && (
                                                <div className="tw-w-full">
                                                    <Input
                                                        label={lang === "th" ? "ระบุชื่อเจ้าของ" : "Enter owner name"}
                                                        required
                                                        autoFocus
                                                        value={otherOwnerNameEdit}
                                                        onChange={(e) => setOtherOwnerNameEdit(e.target.value)}
                                                        crossOrigin={undefined}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <Input label={t.owner} value={editingStation?.username ?? "-"} readOnly disabled crossOrigin={undefined} />
                                    )}
                                    <Input label={t.maximoLocation} value={editStationForm.maximo_location} onChange={(e) => setEditStationForm(s => ({ ...s, maximo_location: e.target.value }))} crossOrigin={undefined} />
                                    <Input label={t.maximoDescription} value={editStationForm.maximo_desc} onChange={(e) => setEditStationForm(s => ({ ...s, maximo_desc: e.target.value }))} crossOrigin={undefined} />
                                    <Select label={t.status} value={String(editStationForm.is_active)} onChange={(v) => setEditStationForm(s => ({ ...s, is_active: v === "true" }))}>
                                        <Option value="true">{t.active}</Option>
                                        <Option value="false">{t.inactive}</Option>
                                    </Select>
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
        </>
    );
}

export default SearchDataTables;