"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Button, Input, Textarea } from "@material-tailwind/react";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeftIcon, PhotoIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import { draftKey as getDraftKey, saveDraftLocal, loadDraftLocal, clearDraftLocal, type CMDraftData } from "../lib/draft";
import { putPhoto, getPhotosByDraftKey, delPhoto, delPhotosByDraftKey, createPreviewUrl, photoRefToFile, type PhotoRef } from "../lib/draftPhotos";
import { apiFetch } from "@/utils/api";
// ==================== TRANSLATIONS ====================
const T = {
    pageTitle: { th: "รายงานบันทึกปัญหา (CM)", en: "Corrective Maintenance Report (CM)" },
    headerEdit: { th: "Edit", en: "Edit" },
    headerAdd: { th: "Add", en: "Add" },
    companyName: { th: "การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)", en: "Electricity Generating Authority of Thailand (EGAT)" },
    companyAddressLine1: { th: "เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย", en: "53 Moo 2, Charan Sanitwong Rd., Bang Kruai, Bang Kruai" },
    companyAddressLine2: { th: "จังหวัดนนทบุรี 11130 ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416", en: "Nonthaburi 11130, EGAT Call Center: 1416" },
    docName: { th: "ชื่อเอกสาร", en: "Document Name" },
    issueId: { th: "Issue ID", en: "Issue ID" },
    cmDate: { th: "วันที่แจ้ง", en: "Found Date" },
    location: { th: "สถานที่", en: "Location" },
    reporteed_by: { th: "ผู้แจ้งปัญหา", en: "Reported by" },
    faultyEquipment: { th: "ตำแหน่งจุดที่มีปัญหา", en: "Problem Location" },
    selectEquipmentPlaceholder: { th: "เลือกตำแหน่ง...", en: "Select location..." },
    chargersGroup: { th: "Chargers", en: "Chargers" },
    otherEquipmentGroup: { th: "อุปกรณ์อื่นๆ", en: "Other Equipment" },
    loadingChargers: { th: "กำลังโหลด...", en: "Loading..." },
    noChargersFound: { th: "ไม่พบ Charger", en: "No chargers found" },
    problemDetails: { th: "รายละเอียดปัญหา", en: "Problem Details" },
    severity: { th: "ความรุนแรง", en: "Severity" },
    severityPlaceholder: { th: "เลือก...", en: "Select..." },
    problemFound: { th: "ปัญหาที่พบ", en: "Problem Found" },
    jobStatus: { th: "สถานะงาน", en: "Job Status" },
    remarks_open: { th: "หมายเหตุ", en: "Remarks" },
    save: { th: "บันทึก", en: "Save" },
    saving: { th: "กำลังบันทึก...", en: "Saving..." },
    inProgress: { th: "In Progress", en: "In Progress" },
    backToList: { th: "กลับ", en: "Back" },
    alertNoStationId: { th: "ไม่พบ station_id", en: "Station ID not found" },
    alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },
    photos: { th: "รูปภาพ", en: "Photos" },
    attachPhoto: { th: "แนบรูป", en: "Attach Photo" },
    noPhotos: { th: "ยังไม่มีรูปแนบ", en: "No photos attached" },
    photoHint: { th: "รองรับไฟล์ JPG, PNG", en: "Supports JPG, PNG" },
    formStatus: { th: "สถานะการกรอกข้อมูล", en: "Form Status" },
    allComplete: { th: "กรอกข้อมูลครบถ้วน พร้อมบันทึก ✓", en: "All fields completed. Ready to save ✓" },
    remaining: { th: "ยังขาดอีก", en: "Missing" },
    items: { th: "รายการ", en: "items" },
    validEquipment: { th: "ตำแหน่งจุดที่มีปัญหา", en: "Problem Location" },
    validSeverity: { th: "ความรุนแรง", en: "Severity" },
    validProblemFound: { th: "ปัญหาที่พบ", en: "Problem Found" },
    validPhotos: { th: "รูปภาพ", en: "Photos" },
    notFilled: { th: "ยังไม่ได้กรอก", en: "Not filled" },
    notSelected: { th: "ยังไม่ได้เลือก", en: "Not selected" },
    notAttached: { th: "ยังไม่ได้แนบ", en: "Not attached" },
    draftSaved: { th: "บันทึกร่างแล้ว", en: "Draft saved" },
    clearDraft: { th: "ล้างร่าง", en: "Clear draft" },
    // ═══ Maximo ═══
    maximoSrCreated: { th: "สร้าง Maximo SR สำเร็จ", en: "Maximo SR Created" },
    maximoSrFailed: { th: "ไม่สามารถสร้าง Maximo SR (บันทึก CM สำเร็จแล้ว)", en: "Maximo SR not created (CM saved)" },
    savedSuccess: { th: "บันทึกสำเร็จ", en: "Saved successfully" },
    redirecting: { th: "กำลังกลับหน้ารายการ...", en: "Redirecting to list..." },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

// ==================== TYPES ====================
type Severity = "" | "Low" | "Medium" | "High" | "Critical";
type Status = "" | "Open" | "In Progress";
type ServerPhoto = { filename: string; size: number; url: string; remark?: string; uploadedAt?: string; location?: string; };
type PhotoItem = { id: string; file: File; preview: string; ref?: PhotoRef; isServer?: boolean; serverUrl?: string; createdAt?: string; location?: string; };
type ChargerInfo = { chargerNo?: number; charger_id?: string; charger_name?: string; SN?: string; sn?: string; };
type StationPublic = { station_id: string; station_name: string; };
type ValidationItem = { key: string; label: string; isValid: boolean; message: string; isRequired: boolean; scrollId?: string; };

const SEVERITY_OPTIONS: Severity[] = ["", "Low", "Medium", "High", "Critical"];
const FIXED_EQUIPMENT = ["MDB", "CCB", "CB-BOX", "Station"] as const;
const LOGO_SRC = "/img/logo_egat.png";
const LIST_ROUTE = "/dashboard/cm-report";
const MAX_PHOTOS = 5;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ==================== VALIDATION CARD ====================
function CMValidationCard({ validations, lang }: { validations: ValidationItem[]; lang: Lang; }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const requiredValidations = validations.filter(v => v.isRequired);
    const allRequiredValid = requiredValidations.every(v => v.isValid);
    const missingCount = requiredValidations.filter(v => !v.isValid).length;

    const scrollToElement = (scrollId?: string) => {
        if (!scrollId) return;
        const el = document.getElementById(scrollId);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50");
            setTimeout(() => el.classList.remove("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50"), 2000);
        }
    };

    return (
        <div className={`tw-rounded-xl tw-border tw-shadow-sm tw-overflow-hidden ${allRequiredValid ? "tw-border-green-200 tw-bg-green-50 tw-shadow-green-500/10" : "tw-border-orange-200 tw-bg-orange-50 tw-shadow-orange-500/10"}`}>
            <div className={`tw-px-5 tw-py-4 tw-cursor-pointer tw-flex tw-items-center tw-justify-between ${allRequiredValid ? "tw-bg-green-100 hover:tw-bg-green-150" : "tw-bg-orange-100 hover:tw-bg-orange-150"} tw-transition-colors`} onClick={() => setIsExpanded(!isExpanded)}>
                <div className="tw-flex tw-items-center tw-gap-3">
                    <div className={`tw-w-10 tw-h-10 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-shadow-md ${allRequiredValid ? "tw-bg-green-500" : "tw-bg-orange-500"}`}>
                        {allRequiredValid ? <CheckCircleIcon className="tw-w-6 tw-h-6 tw-text-white" /> : <ExclamationTriangleIcon className="tw-w-6 tw-h-6 tw-text-white" />}
                    </div>
                    <div>
                        <p className={`tw-font-bold tw-text-base ${allRequiredValid ? "tw-text-green-800" : "tw-text-orange-800"}`}>{t("formStatus", lang)}</p>
                        <p className={`tw-text-sm ${allRequiredValid ? "tw-text-green-600" : "tw-text-orange-600"}`}>
                            {allRequiredValid ? t("allComplete", lang) : `${t("remaining", lang)} ${missingCount} ${t("items", lang)}`}
                        </p>
                    </div>
                </div>
                {!allRequiredValid && (
                    <svg className={`tw-w-6 tw-h-6 ${allRequiredValid ? "tw-text-green-600" : "tw-text-orange-600"} tw-transition-transform ${isExpanded ? "tw-rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                )}
            </div>
            {isExpanded && !allRequiredValid && (
                <div className="tw-px-5 tw-py-4 tw-space-y-3">
                    <div className="tw-bg-white tw-rounded-lg tw-p-4 tw-border tw-border-orange-200">
                        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                            <p className="tw-font-semibold tw-text-blue-gray-800 tw-text-sm">📋 {t("remaining", lang)} {t("items", lang)}</p>
                            <span className="tw-text-xs tw-bg-orange-100 tw-text-orange-700 tw-px-2.5 tw-py-0.5 tw-rounded-full tw-font-semibold">{missingCount}</span>
                        </div>
                        <ul className="tw-space-y-1.5">
                            {validations.filter(v => v.isRequired && !v.isValid).map(v => (
                                <li key={v.key} onClick={() => scrollToElement(v.scrollId)} className="tw-flex tw-items-start tw-gap-2 tw-text-sm tw-text-orange-700 tw-cursor-pointer hover:tw-text-orange-900 hover:tw-bg-orange-50 tw-rounded tw-px-2 tw-py-1 tw-transition-colors">
                                    <span className="tw-text-orange-500 tw-mt-0.5 tw-font-bold">→</span>
                                    <span><span className="tw-font-semibold">{v.label}:</span> <span className="tw-underline tw-underline-offset-2">{v.message}</span></span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    {validations.filter(v => !v.isRequired && !v.isValid).length > 0 && (
                        <div className="tw-bg-white/60 tw-rounded-lg tw-p-4 tw-border tw-border-blue-gray-200">
                            <p className="tw-text-xs tw-text-blue-gray-600 tw-mb-2 tw-font-semibold">💡 {t("remaining", lang)} (ไม่บังคับ)</p>
                            <ul className="tw-space-y-1">
                                {validations.filter(v => !v.isRequired && !v.isValid).map(v => (
                                    <li key={v.key} onClick={() => scrollToElement(v.scrollId)} className="tw-flex tw-items-center tw-gap-2 tw-text-xs tw-text-gray-500 tw-cursor-pointer hover:tw-underline">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-gray-400" />
                                        <span>{v.label}: {v.message}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ==================== SUCCESS BANNER ====================
function SuccessBanner({
    lang,
    docName,
    issueId,
    maximoTicketId,
}: {
    lang: Lang;
    docName: string;
    issueId: string;
    maximoTicketId: string | null;
}) {
    return (
        <div className="tw-mx-auto tw-max-w-6xl tw-mb-6 tw-animate-in tw-fade-in tw-duration-300">
            <div className="tw-rounded-xl tw-border tw-border-green-300 tw-bg-green-50 tw-shadow-lg tw-shadow-green-500/10 tw-p-5">
                <div className="tw-flex tw-items-start tw-gap-4">
                    <div className="tw-w-12 tw-h-12 tw-rounded-full tw-bg-green-500 tw-flex tw-items-center tw-justify-center tw-shadow-md tw-shrink-0">
                        <CheckCircleIcon className="tw-w-7 tw-h-7 tw-text-white" />
                    </div>
                    <div className="tw-flex-1">
                        <p className="tw-font-bold tw-text-green-800 tw-text-lg">
                            {t("savedSuccess", lang)}
                        </p>
                        <div className="tw-mt-2 tw-space-y-1">
                            {issueId && (
                                <p className="tw-text-sm tw-text-green-700">
                                    Issue ID: <span className="tw-font-mono tw-font-semibold">{issueId}</span>
                                </p>
                            )}
                            {docName && (
                                <p className="tw-text-sm tw-text-green-700">
                                    Doc: <span className="tw-font-semibold">{docName}</span>
                                </p>
                            )}
                            {maximoTicketId ? (
                                <p className="tw-text-sm tw-text-green-700 tw-flex tw-items-center tw-gap-1.5">
                                    🎫 Maximo SR: <span className="tw-font-mono tw-font-bold tw-text-green-900 tw-bg-green-200 tw-px-2 tw-py-0.5 tw-rounded">{maximoTicketId}</span>
                                </p>
                            ) : (
                                <p className="tw-text-xs tw-text-amber-600 tw-mt-1">
                                    {t("maximoSrFailed", lang)}
                                </p>
                            )}
                        </div>
                        <p className="tw-text-xs tw-text-green-500 tw-mt-3">
                            {t("redirecting", lang)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== PHOTO UPLOAD ====================
function PhotoUpload({ photos_open, onAdd, onRemove, max, disabled, lang, id }: { photos_open: PhotoItem[]; onAdd: (files: FileList) => void; onRemove: (id: string) => void; max: number; disabled: boolean; lang: Lang; id?: string; }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canAddMore = photos_open.length < max && !disabled;

    return (
        <div id={id} className="tw-space-y-3">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="tw-hidden" onChange={e => { if (e.target.files) { onAdd(e.target.files); e.target.value = ""; } }} />

            {/* Attach button - always on left */}
            {canAddMore && (
                <div className="tw-flex tw-items-center tw-gap-3">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="tw-inline-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2 tw-rounded-lg tw-border-2 tw-border-blue-600 tw-text-blue-600 tw-font-bold tw-text-sm hover:tw-bg-blue-50 tw-transition-colors">
                        <PhotoIcon className="tw-w-4 tw-h-4" /> {t("attachPhoto", lang)}
                    </button>
                    <span className="tw-text-sm tw-text-blue-gray-500">Max {max} photos</span>
                </div>
            )}

            {/* Photo grid */}
            {photos_open.length > 0 ? (
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                    {photos_open.map(photo => (
                        <div key={photo.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-200 tw-bg-blue-gray-50 tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                            <img src={photo.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                            {/* Timestamp & Location overlay */}
                            {(photo.createdAt || photo.location) && (
                                <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                    {photo.createdAt && <span className="tw-block tw-font-mono">{photo.createdAt}</span>}
                                    {photo.location && (
                                        <span className="tw-block tw-opacity-80 tw-truncate">📍 {photo.location}</span>
                                    )}
                                </span>
                            )}
                            {photo.isServer && (
                                <span className="tw-absolute tw-bottom-1 tw-left-1 tw-text-[10px] tw-bg-blue-500 tw-text-white tw-px-1.5 tw-py-0.5 tw-rounded">Saved</span>
                            )}
                            {!disabled && !photo.isServer && (
                                <button type="button" onClick={() => onRemove(photo.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-md tw-transition-all">
                                    <XMarkIcon className="tw-w-3.5 tw-h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : disabled ? (
                <p className="tw-text-sm tw-text-blue-gray-400">{t("noPhotos", lang)}</p>
            ) : (
                <p className="tw-text-sm tw-text-blue-gray-500">{t("noPhotos", lang)}</p>
            )}
        </div>
    );
}

// ==================== MAIN COMPONENT ====================
export default function CMOpenForm() {
    const { lang } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const [stationId, setStationId] = useState<string | null>(null);

    // Individual form fields (no longer using job object)
    const [issueId, setIssueId] = useState("");
    const [docName, setDocName] = useState("");
    const [foundDate, setFoundDate] = useState("");
    const [location, setLocation] = useState("");
    const [problemDetails, setProblemDetails] = useState("");
    const [severity, setSeverity] = useState<Severity>("");
    const [status, setStatus] = useState<Status>("");
    const [remarks_open, setRemarksOpen] = useState("");
    const [faultyEquipment, setFaultyEquipment] = useState("");

    const [summary, setSummary] = useState("");
    const [reported_by, setReportedBy] = useState("");
    const [saving, setSaving] = useState(false);
    const [chargers, setChargers] = useState<ChargerInfo[]>([]);
    const [loadingChargers, setLoadingChargers] = useState(false);
    const [photos_open, setPhotosOpen] = useState<PhotoItem[]>([]);
    const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [draftLoaded, setDraftLoaded] = useState(false);

    // ═══ Maximo state ═══
    const [maximoTicketId, setMaximoTicketId] = useState<string | null>(null);
    const [showSuccessBanner, setShowSuccessBanner] = useState(false);

    const editId = searchParams.get("edit_id") ?? "";
    const isEdit = !!editId;
    const draftKey = useMemo(() => getDraftKey(stationId), [stationId]);
    const STATUS_OPTIONS: Status[] = ["Open", "In Progress"];

    useEffect(() => { if (!isEdit && !status) setStatus("Open"); }, [isEdit, status]);
    const headerLabel = useMemo(() => (isEdit ? t("headerEdit", lang) : t("headerAdd", lang)), [isEdit, lang]);

    // ==================== VALIDATION ====================
    const validations = useMemo<ValidationItem[]>(() => [
        { key: "equipment", label: t("validEquipment", lang), isValid: !!faultyEquipment, message: t("notSelected", lang), isRequired: true, scrollId: "cm-equipment" },
        { key: "severity", label: t("validSeverity", lang), isValid: !!severity, message: t("notSelected", lang), isRequired: true, scrollId: "cm-severity" },
        { key: "problemFound", label: t("validProblemFound", lang), isValid: !!problemDetails.trim(), message: t("notFilled", lang), isRequired: true, scrollId: "cm-problem-found" },
        { key: "photos", label: t("validPhotos", lang), isValid: photos_open.length > 0, message: t("notAttached", lang), isRequired: true, scrollId: "cm-photos" },
    ], [faultyEquipment, severity, problemDetails, photos_open, lang]);
    const canSave = useMemo(() => validations.filter(v => v.isRequired).every(v => v.isValid), [validations]);

    // ==================== HELPERS ====================
    const localTodayFormatted = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };
    const localTodayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const displayToISO = (s: string) => { if (!s) return localTodayISO(); const p = s.split("/"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : localTodayISO(); };
    const isoToDisplay = (s: string) => { if (!s) return localTodayFormatted(); const p = s.slice(0, 10).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : localTodayFormatted(); };

    // หา current tab จาก URL
    const currentTab = searchParams.get("tab") ?? "open";

    const buildListUrl = (targetTab?: string) => {
        const p = new URLSearchParams();
        if (stationId) p.set("station_id", stationId);
        p.set("tab", targetTab ?? currentTab);
        // ไม่ใส่ view และ edit_id เพื่อกลับไปหน้า list
        return `${LIST_ROUTE}?${p.toString()}`;
    };

    // ฟังก์ชันสำหรับกลับไปหน้า list
    const goBackToList = () => {
        router.push(buildListUrl(currentTab));
    };

    // ==================== PHOTO HANDLERS ====================
    // Pre-fetch GPS + reverse geocode ตอนเปิดหน้า เก็บ cache ไว้ใช้ตอนแนบรูปทันที
    const gpsCache = useRef<{ location?: string; fetched: boolean; promise?: Promise<string | undefined> }>({ fetched: false });

    const fetchGpsLocation = useCallback(async (): Promise<string | undefined> => {
        try {
            if (!navigator.geolocation) { console.warn("[GPS] Geolocation not supported"); return undefined; }
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
            });
            const { latitude, longitude } = pos.coords;
            console.log("[GPS] Got coords:", latitude, longitude);
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=th&zoom=16`);
                if (!res.ok) return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                const data = await res.json();
                const addr = data.address || {};
                const parts = [addr.road, addr.suburb || addr.neighbourhood, addr.city_district || addr.town || addr.city, addr.state || addr.province].filter(Boolean);
                const result = parts.length > 0 ? parts.join(", ") : (data.display_name?.split(",").slice(0, 3).join(",") || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
                console.log("[GPS] Resolved location:", result);
                return result;
            } catch (e) {
                console.warn("[GPS] Reverse geocode failed, using coords:", e);
                return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            }
        } catch (e) {
            console.warn("[GPS] Failed to get position:", e);
            return undefined;
        }
    }, []);

    const getGpsCached = useCallback((): Promise<string | undefined> => {
        if (gpsCache.current.fetched) return Promise.resolve(gpsCache.current.location);
        if (!gpsCache.current.promise) {
            gpsCache.current.promise = fetchGpsLocation().then(loc => {
                gpsCache.current = { location: loc, fetched: true };
                return loc;
            });
        }
        return gpsCache.current.promise;
    }, [fetchGpsLocation]);

    // Pre-fetch GPS ตอนเปิดหน้า
    useEffect(() => { if (!isEdit) getGpsCached(); }, [isEdit, getGpsCached]);

    const handleAddPhotos = useCallback(async (files: FileList) => {
        const remain = MAX_PHOTOS - photos_open.length;
        const filesToAdd = Array.from(files).slice(0, remain);

        const now = new Date().toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
        const cachedLoc = gpsCache.current.fetched ? gpsCache.current.location : undefined;

        // แสดงรูปทันที พร้อม location ถ้า cache พร้อมแล้ว
        const newPhotoIds: string[] = [];
        const newPhotos: PhotoItem[] = await Promise.all(
            filesToAdd.map(async (file, i) => {
                const photoId = `${Date.now()}-${i}-${file.name}`;
                newPhotoIds.push(photoId);
                let ref;
                if (!isEdit && draftKey) {
                    ref = await putPhoto(draftKey, photoId, file);
                }
                return { id: photoId, file, preview: URL.createObjectURL(file), ref, createdAt: now, location: cachedLoc };
            })
        );
        setPhotosOpen(prev => [...prev, ...newPhotos]);

        // ถ้า cache ยังไม่พร้อม รอแล้ว fill ทีหลัง
        if (!cachedLoc) {
            getGpsCached().then(loc => {
                if (!loc) return;
                setPhotosOpen(prev => prev.map(p => newPhotoIds.includes(p.id) ? { ...p, location: loc } : p));
            });
        }
    }, [photos_open.length, draftKey, isEdit, getGpsCached]);

    const handleRemovePhoto = useCallback(async (id: string) => {
        await delPhoto(id);
        setPhotosOpen(prev => { const target = prev.find(p => p.id === id); if (target?.preview) URL.revokeObjectURL(target.preview); return prev.filter(p => p.id !== id); });
    }, []);

    useEffect(() => { return () => { photos_open.forEach(p => { if (p.preview) URL.revokeObjectURL(p.preview); }); }; }, []);

    // ==================== DRAFT: AUTO-SAVE ====================
    useEffect(() => {
        if (isEdit || !stationId || !draftLoaded) return;
        const timer = setTimeout(() => {
            setDraftStatus("saving");
            saveDraftLocal(draftKey, {
                issueId, docName, foundDate, location, problemDetails,
                severity, status, remarks_open, faultyEquipment,
                reported_by,
            });
            setTimeout(() => setDraftStatus("saved"), 300);
            setTimeout(() => setDraftStatus("idle"), 2000);
        }, 1500);
        return () => clearTimeout(timer);
    }, [issueId, docName, foundDate, location, problemDetails, severity, status, remarks_open, faultyEquipment, reported_by, draftKey, isEdit, stationId, draftLoaded]);

    // ==================== DRAFT: LOAD ====================
    useEffect(() => {
        if (isEdit || !stationId) return;
        const draft = loadDraftLocal<any>(draftKey);
        if (draft) {
            if (draft.issueId) setIssueId(draft.issueId);
            if (draft.docName) setDocName(draft.docName);
            if (draft.foundDate) setFoundDate(draft.foundDate);
            if (draft.location) setLocation(draft.location);
            if (draft.problemDetails) setProblemDetails(draft.problemDetails);
            if (draft.severity) setSeverity(draft.severity as Severity);
            if (draft.status) setStatus(draft.status as Status);
            if (draft.remarks_open) setRemarksOpen(draft.remarks_open);
            if (draft.faultyEquipment) setFaultyEquipment(draft.faultyEquipment);
            if (draft.reported_by) setReportedBy(draft.reported_by);
            if (draft.summary) setSummary(draft.summary);
        }
        (async () => {
            try {
                const savedPhotos = await getPhotosByDraftKey(draftKey);
                if (savedPhotos.length > 0) {
                    const loadedPhotos: PhotoItem[] = savedPhotos.map((ref: PhotoRef) => ({ id: ref.id, file: photoRefToFile(ref), preview: createPreviewUrl(ref), ref, createdAt: new Date().toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) }));
                    setPhotosOpen(loadedPhotos);
                }
            } catch (err) { console.warn("[Draft] Failed to load photos:", err); }
        })();
        setDraftLoaded(true);
    }, [stationId, isEdit, draftKey]);

    // ==================== API EFFECTS ====================
    useEffect(() => { const sid = searchParams.get("station_id") || localStorage.getItem("selected_station_id"); if (sid) { setStationId(sid); localStorage.setItem("selected_station_id", sid); } }, [searchParams]);

    useEffect(() => {
        if (!stationId || isEdit) return; // skip ถ้าเป็น edit mode
        let alive = true;
        (async () => { try { const res = await apiFetch(`${API_BASE}/station/info/public?station_id=${encodeURIComponent(stationId)}`, { cache: "no-store" }); if (res.ok) { const data: { station: StationPublic } = await res.json(); if (alive && !location) setLocation(data.station.station_name || ""); } } catch { } })();
        return () => { alive = false; };
    }, [stationId, isEdit]);

    useEffect(() => {
        if (!stationId) return; let alive = true; setLoadingChargers(true);
        (async () => { try { const res = await apiFetch(`${API_BASE}/chargers/${encodeURIComponent(stationId)}`, { credentials: "include" }); if (res.ok) { const data = await res.json(); if (alive) setChargers(data.chargers || []); } } catch { setChargers([]); } finally { if (alive) setLoadingChargers(false); } })();
        return () => { alive = false; };
    }, [stationId]);

    useEffect(() => {
        if (isEdit) return; // skip ถ้าเป็น edit mode
        let alive = true;
        (async () => { try { const res = await apiFetch(`${API_BASE}/me`, { credentials: "include" }); if (res.ok) { const data = await res.json(); if (alive && !reported_by) setReportedBy(data.username || ""); } } catch { } })();
        return () => { alive = false; };
    }, [isEdit]);

    useEffect(() => {
        if (isEdit || !stationId) return; let alive = true;
        (async () => { try { const res = await apiFetch(`${API_BASE}/cmreport/preview-docname?station_id=${encodeURIComponent(stationId)}&found_date=${localTodayISO()}`, { credentials: "include" }); if (res.ok) { const data = await res.json(); if (alive) { setFoundDate(localTodayFormatted()); setIssueId(data.issue_id || ""); setDocName(data.doc_name || ""); } } else if (alive) setFoundDate(localTodayFormatted()); } catch { if (alive) setFoundDate(localTodayFormatted()); } })();
        return () => { alive = false; };
    }, [stationId, isEdit]);

    useEffect(() => {
        if (!editId || !stationId) return;
        console.log("[Edit] Loading report:", editId, "station:", stationId);
        (async () => {
            try {
                const res = await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}?station_id=${encodeURIComponent(stationId)}`, { credentials: "include" });
                if (!res.ok) {
                    console.log("[Edit] Response not OK:", res.status);
                    return;
                }
                const data = await res.json();
                console.log("[Edit] Data received:", data);
                const rawDate = data.found_date ?? "";

                setDocName(data.doc_name ?? "");
                setIssueId(data.issue_id ?? "");
                setFoundDate(rawDate ? isoToDisplay(rawDate) : localTodayFormatted());
                setLocation(data.location ?? "");
                setProblemDetails(data.problem_details ?? "");
                setSeverity((data.severity ?? "") as Severity);
                setStatus((data.status ?? "Open") as Status);
                setRemarksOpen(data.remarks_open ?? "");
                setFaultyEquipment(data.faulty_equipment ?? "");
                setSummary(data.summary ?? "");
                setReportedBy(data.reported_by ?? "");

                // ═══ แสดง Maximo ticket ถ้ามี (edit mode) ═══
                if (data.maximo_ticket_id) {
                    setMaximoTicketId(data.maximo_ticket_id);
                }

                if (data.photos_problem) {
                    const serverPhotos: PhotoItem[] = [];
                    for (const [group, photoList] of Object.entries(data.photos_problem)) {
                        if (Array.isArray(photoList)) {
                            (photoList as ServerPhoto[]).forEach((p, i) => {
                                const fullUrl = p.url.startsWith("http") ? p.url : `${API_BASE}${p.url}`;
                                serverPhotos.push({
                                    id: `server-${group}-${i}-${p.filename}`,
                                    file: new File([], p.filename),
                                    preview: fullUrl,
                                    isServer: true,
                                    serverUrl: p.url,
                                    createdAt: p.uploadedAt
                                        ? new Date(p.uploadedAt).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })
                                        : undefined,
                                    location: (p as any).location || undefined,
                                });
                            });
                        }
                    }
                    if (serverPhotos.length > 0) {
                        setPhotosOpen(serverPhotos);
                    }
                }
            } catch (err) {
                console.error("[Edit] Error loading:", err);
            }
        })();
    }, [editId, stationId]);

    // ==================== HANDLERS ====================
    async function uploadPhotosForReport(reportId: string) {
        if (!stationId) return;
        const newPhotos = photos_open.filter(p => !p.isServer);
        if (newPhotos.length === 0) return;

        const fd = new FormData();
        fd.append("station_id", stationId);
        fd.append("group", "cm_photos");
        fd.append("phase", "problem");
        newPhotos.forEach(p => fd.append("files", p.file, p.file.name));
        // ส่ง location ของรูปแรกที่มี (รูปทั้งหมดถ่ายจากที่เดียวกัน)
        const photoLocation = newPhotos.find(p => p.location)?.location || "";
        if (photoLocation) fd.append("location", photoLocation);
        fd.append("created_at", new Date().toISOString());
        const res = await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(reportId)}/photos`, { method: "POST", body: fd, credentials: "include" });
        if (!res.ok) throw new Error(`Upload failed`);
    }

    const onFinalSave = async () => {
        if (!stationId) { alert(t("alertNoStationId", lang)); return; }
        if (!canSave && !isEdit) return;
        setSaving(true);
        try {
            if (isEdit && editId) {
                // Edit mode - ส่งแค่ status เท่านั้น
                const res = await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        station_id: stationId,
                        status: "In Progress"
                    })
                });
                if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);
            } else {
                // ═══ Create mode — submit + Maximo SR ═══
                const res = await apiFetch(`${API_BASE}/cmreport/submit`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        station_id: stationId,
                        found_date: displayToISO(foundDate),
                        faulty_equipment: faultyEquipment,
                        severity,
                        problem_details: problemDetails,
                        remarks_open,
                        location,
                        reported_by: reported_by,
                    })
                });
                if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

                const {
                    report_id,
                    doc_name: newDocName,
                    issue_id: newIssueId,
                    maximo_ticket_id,                // ← รับ Maximo ticket จาก response
                } = await res.json();

                setDocName(newDocName);
                setIssueId(newIssueId);
                setMaximoTicketId(maximo_ticket_id || null);

                await uploadPhotosForReport(report_id);
                clearDraftLocal(draftKey);
                await delPhotosByDraftKey(draftKey);

                // ═══ แสดง Success Banner ก่อน redirect ═══
                setShowSuccessBanner(true);
                setSaving(false);
                // รอ 3 วินาทีให้ user เห็น Maximo ticket ID แล้วค่อย redirect
                setTimeout(() => {
                    router.push(buildListUrl("open"));
                }, 3000);
                return; // ← หยุดไม่ให้ไปถึง finally redirect
            }

            // กด In Progress → ไปหน้า form In Progress
            if (isEdit) {
                const p = new URLSearchParams();
                if (stationId) p.set("station_id", stationId);
                p.set("tab", "in-progress");
                p.set("view", "form");
                p.set("edit_id", editId);
                router.push(`${LIST_ROUTE}?${p.toString()}`);
            }
        } catch (e: any) { alert(`${t("alertSaveFailed", lang)} ${e.message || e}`); }
        finally { setSaving(false); }
    };

    const handleClearDraft = async () => {
        clearDraftLocal(draftKey);
        await delPhotosByDraftKey(draftKey);
        photos_open.forEach(p => { if (p.preview) URL.revokeObjectURL(p.preview); });

        setIssueId("");
        setDocName("");
        setFoundDate(localTodayFormatted());
        setLocation("");
        setProblemDetails("");
        setSeverity("");
        setStatus("Open");
        setRemarksOpen("");
        setFaultyEquipment("");
        setPhotosOpen([]);
        setSummary("");
    };

    // ==================== RENDER ====================
    return (
        <section className="tw-pb-24">
            {/* ═══ Success Banner (แสดงหลัง submit สำเร็จ) ═══ */}
            {showSuccessBanner && (
                <SuccessBanner
                    lang={lang}
                    docName={docName}
                    issueId={issueId}
                    maximoTicketId={maximoTicketId}
                />
            )}

            <div className="tw-mx-auto tw-max-w-6xl tw-mb-6 tw-flex tw-items-center tw-justify-between">
                <Button variant="outlined" size="sm" onClick={goBackToList} title={t("backToList", lang)} className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300">
                    <ArrowLeftIcon className="tw-w-4 tw-h-4" />
                </Button>
            </div>

            <form noValidate onSubmit={e => e.preventDefault()} onKeyDown={e => e.key === "Enter" && e.target instanceof HTMLInputElement && e.preventDefault()}>
                <div className="tw-mx-auto tw-max-w-6xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-md tw-shadow-blue-gray-500/5 tw-p-6 md:tw-p-8">

                    {/* Header */}
                    <div className="tw-flex tw-items-start tw-justify-between tw-gap-6 tw-mb-6">
                        <div className="tw-flex tw-items-start tw-gap-4">
                            <div className="tw-relative tw-shrink-0 tw-h-16 tw-w-[90px] md:tw-h-20 md:tw-w-[110px]">
                                <Image src={LOGO_SRC} alt="Logo" fill priority className="tw-object-contain" sizes="110px" />
                            </div>
                            <div>
                                <div className="tw-font-bold tw-text-blue-gray-900 tw-text-base md:tw-text-lg">
                                    {t("pageTitle", lang)} – CM Report ({headerLabel})
                                </div>
                                <div className="tw-text-sm tw-text-blue-gray-600 tw-mt-2">{t("companyName", lang)}</div>
                                <div className="tw-text-xs tw-text-blue-gray-500 tw-mt-1">{t("companyAddressLine1", lang)}</div>
                                <div className="tw-text-xs tw-text-blue-gray-500">{t("companyAddressLine2", lang)}</div>
                            </div>
                        </div>
                        <div className="tw-text-left md:tw-text-right tw-text-sm tw-text-blue-gray-700 tw-border-l tw-border-blue-gray-100 tw-pl-4 md:tw-pl-6 md:tw-border-l-0 tw-pt-3 md:tw-pt-0 md:tw-shrink-0">
                            <div className="tw-font-semibold tw-text-blue-gray-800">{t("docName", lang)}</div>
                            <div className="tw-break-all tw-text-blue-gray-600 tw-mt-1">{docName || "-"}</div>
                        </div>
                    </div>

                    <hr className="tw-my-6 tw-border-blue-gray-100" />

                    {/* ═══ Maximo Ticket Badge (แสดงใน edit mode ถ้ามี ticket) ═══ */}
                    {isEdit && maximoTicketId && (
                        <div className="tw-mb-4 tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2.5 tw-rounded-lg tw-bg-blue-50 tw-border tw-border-blue-200">
                            <span className="tw-text-sm tw-text-blue-700">🎫 Maximo SR:</span>
                            <span className="tw-font-mono tw-font-bold tw-text-blue-900 tw-bg-blue-100 tw-px-2 tw-py-0.5 tw-rounded">{maximoTicketId}</span>
                        </div>
                    )}

                    {/* Meta Info - Readonly Inputs */}
                    <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-4 tw-gap-4 tw-mb-6">
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("issueId", lang)}</label>
                            <Input value={issueId || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("cmDate", lang)}</label>
                            <Input value={foundDate || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("location", lang)}</label>
                            <Input value={location || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("reporteed_by", lang)}</label>
                            <Input value={reported_by || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                    </div>

                    {/* Problem Details Section */}
                    <div className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
                        {/* Section Header */}
                        <div className="tw-flex tw-items-center tw-gap-3 tw-bg-gray-700 hover:tw-bg-gray-800 tw-px-4 tw-py-3 tw-text-white tw-cursor-pointer tw-transition-colors">
                            <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-white tw-text-gray-700 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-sm">1</div>
                            <span className="tw-font-semibold tw-text-base">{t("problemDetails", lang)}</span>
                        </div>

                        {/* Section Content */}
                        <div className="tw-p-4 tw-space-y-4">
                            {/* Problem Location & Severity - Same Row */}
                            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                                {/* Problem Location (ตำแหน่งจุดที่มีปัญหา) */}
                                <div id="cm-equipment">
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("faultyEquipment", lang)} <span className="tw-text-red-500">*</span></label>
                                    <select value={faultyEquipment} disabled={isEdit} onChange={e => setFaultyEquipment(e.target.value)}
                                        style={isEdit ? { backgroundColor: '#f3f4f6', color: '#455a64' } : {}}
                                        className={`tw-w-full tw-h-10 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-px-4 tw-text-sm tw-font-medium tw-transition-colors focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 focus:tw-border-transparent ${isEdit ? "tw-bg-gray-100 tw-text-blue-gray-700 tw-cursor-not-allowed tw-opacity-100" : "tw-bg-white tw-text-blue-gray-700 hover:tw-border-blue-gray-300"}`}>
                                        <option value="">{t("selectEquipmentPlaceholder", lang)}</option>
                                        {chargers.length > 0 && (
                                            <optgroup label={t("chargersGroup", lang)}>
                                                {chargers.map((c, i) => { const id = c.chargerNo ?? c.charger_id ?? i + 1; const sn = c.SN ?? c.sn ?? ""; const label = c.charger_name || `Charger ${c.chargerNo ?? i + 1}`; return <option key={id} value={`charger_${id}`}>{sn ? `${label} (${sn})` : label}</option>; })}
                                            </optgroup>
                                        )}
                                        <optgroup label={t("otherEquipmentGroup", lang)}>{FIXED_EQUIPMENT.map(eq => <option key={eq} value={eq.toLowerCase()}>{eq}</option>)}</optgroup>
                                    </select>
                                    {loadingChargers && <p className="tw-text-xs tw-text-blue-gray-400 tw-mt-2">{t("loadingChargers", lang)}</p>}
                                    {!loadingChargers && chargers.length === 0 && <p className="tw-text-xs tw-text-orange-600 tw-mt-2">{t("noChargersFound", lang)}</p>}
                                </div>

                                {/* Severity */}
                                <div id="cm-severity">
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("severity", lang)} <span className="tw-text-red-500">*</span></label>
                                    <div className="tw-relative">
                                        {severity && (
                                            <span className={`tw-absolute tw-left-3 tw-top-1/2 tw--translate-y-1/2 tw-w-1.5 tw-h-1.5 tw-rounded-full tw-pointer-events-none ${severity === "Critical" ? "tw-bg-red-400" :
                                                severity === "High" ? "tw-bg-orange-400" :
                                                    severity === "Medium" ? "tw-bg-yellow-500" :
                                                        "tw-bg-green-400"
                                                }`} />
                                        )}
                                        <select
                                            value={severity}
                                            disabled={isEdit}
                                            onChange={e => setSeverity(e.target.value as Severity)}
                                            style={isEdit ? { backgroundColor: '#f3f4f6', color: '#455a64' } : {}}
                                            className={`tw-w-full tw-h-10 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-pr-4 tw-text-sm tw-font-medium tw-transition-all tw-duration-200 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 focus:tw-border-transparent ${severity ? "tw-pl-6" : "tw-pl-4"} ${isEdit ? "tw-bg-gray-100 tw-text-blue-gray-700 tw-cursor-not-allowed tw-opacity-100" : "tw-bg-white tw-text-blue-gray-700 hover:tw-border-blue-gray-300"}`}
                                        >
                                            <option value="">{t("severityPlaceholder", lang)}</option>
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                            <option value="Critical">Critical</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Problem Found (ปัญหาที่พบ) */}
                            <div id="cm-problem-found">
                                <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("problemFound", lang)} <span className="tw-text-red-500">*</span></label>
                                <Textarea value={problemDetails} onChange={e => setProblemDetails(e.target.value)} readOnly={isEdit} rows={2} className={`!tw-w-full !tw-border-blue-gray-200 ${isEdit ? "!tw-bg-gray-100 !tw-text-blue-gray-700" : "!tw-bg-white"}`} containerProps={{ className: "!tw-min-w-0" }} />
                            </div>

                            {/* Job Status */}
                            <div>
                                <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">{t("jobStatus", lang)}</label>
                                <div className="tw-inline-flex tw-items-center tw-px-4 tw-py-2.5 tw-rounded-full tw-bg-green-600 tw-text-white tw-font-semibold tw-text-sm tw-shadow-md tw-transition-all">
                                    <span>Open</span>
                                </div>
                            </div>

                            {/* Photos */}
                            <div id="cm-photos">
                                <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("photos", lang)} <span className="tw-text-red-500">*</span></label>
                                <PhotoUpload photos_open={photos_open} onAdd={handleAddPhotos} onRemove={handleRemovePhoto} max={MAX_PHOTOS} disabled={isEdit} lang={lang} />
                            </div>
                        </div>
                    </div>

                    {/* RemarksOpen Section - ซ่อนเมื่อ edit และไม่มีหมายเหตุ */}
                    {(!isEdit || (remarks_open.trim() && remarks_open.trim() !== "-")) && (
                        <div className="tw-mb-6">
                            <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("remarks_open", lang)}</label>
                            <Textarea value={remarks_open} onChange={e => setRemarksOpen(e.target.value)} readOnly={isEdit} rows={1} className={`!tw-w-full !tw-border-blue-gray-200 ${isEdit ? "!tw-bg-gray-100 !tw-text-blue-gray-700" : "!tw-bg-white"}`} containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                    )}

                    {/* Validation Card */}
                    {!isEdit && <div className="tw-mb-6"><CMValidationCard validations={validations} lang={lang} /></div>}

                    {/* Actions */}
                    <div className="tw-flex tw-items-center tw-justify-between tw-pt-6 tw-border-t tw-border-blue-gray-100">
                        <div className="tw-flex-1" />
                        <div className="tw-flex tw-items-center tw-gap-3">
                            <Button variant="outlined" onClick={goBackToList} className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300">
                                Cancel
                            </Button>
                            <Button onClick={onFinalSave} disabled={saving || showSuccessBanner || (!isEdit && !canSave)} className={`tw-text-white hover:tw-shadow-lg disabled:tw-opacity-50 disabled:tw-cursor-not-allowed disabled:tw-shadow-none ${isEdit ? "tw-bg-amber-500 hover:tw-bg-amber-600 hover:tw-shadow-amber-500/30" : "tw-bg-gray-800 hover:tw-bg-gray-900 hover:tw-shadow-gray-500/30"}`}>
                                {saving ? t("saving", lang) : isEdit ? t("inProgress", lang) : t("save", lang)}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        </section>
    );
}