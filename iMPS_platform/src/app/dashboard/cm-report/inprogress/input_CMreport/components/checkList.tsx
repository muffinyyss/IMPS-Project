"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Button, Input, Textarea } from "@material-tailwind/react";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeftIcon, PhotoIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import CreatableSelect from "react-select/creatable";
import { useDraft, type DraftData, type DraftImage, type DraftCorrectiveAction } from "../lib/draft";

// ==================== DEVICE NAME FORMATTER ====================
function formatDeviceName(name: string): string {
    if (!name) return "";
    return name
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/([a-zA-Z])(\d)/g, "$1 $2")
        .split(" ")
        .map(word => {
            if (word === word.toUpperCase() && word.length > 1) return word;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");
}

// ==================== TRANSLATIONS ====================
const T = {
    pageTitle: { th: "รายงานบันทึกปัญหา (CM)", en: "Corrective Maintenance Report (CM)" },
    headerEdit: { th: "In Progress", en: "In Progress" },
    companyName: { th: "การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)", en: "Electricity Generating Authority of Thailand (EGAT)" },
    companyAddressLine1: { th: "เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย", en: "53 Moo 2, Charan Sanitwong Rd., Bang Kruai, Bang Kruai" },
    companyAddressLine2: { th: "จังหวัดนนทบุรี 11130 ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416", en: "Nonthaburi 11130, EGAT Call Center: 1416" },
    docName: { th: "ชื่อเอกสาร", en: "Document Name" },
    issueId: { th: "Issue ID", en: "Issue ID" },
    foundDate: { th: "วันที่แจ้ง", en: "Found Date" },
    location: { th: "สถานที่", en: "Location" },
    reportedBy: { th: "ผู้แจ้งปัญหา", en: "Reported by" },
    inspector: { th: "ผู้ตรวจสอบ", en: "Inspector" },
    faultyEquipment: { th: "อุปกรณ์ที่พัง", en: "Faulty Equipment" },
    repairedEquipment: { th: "อุปกรณ์ที่แก้ไข", en: "Repaired Equipment" },
    selectEquipmentPlaceholder: { th: "เลือกอุปกรณ์...", en: "Select equipment..." },
    chargersGroup: { th: "Chargers", en: "Chargers" },
    devicesGroup: { th: "อุปกรณ์ในตู้", en: "Cabinet Devices" },
    otherEquipmentGroup: { th: "อุปกรณ์อื่นๆ", en: "Other Equipment" },
    loadingChargers: { th: "กำลังโหลด...", en: "Loading..." },
    loadingDevices: { th: "กำลังโหลดอุปกรณ์...", en: "Loading devices..." },
    noChargersFound: { th: "ไม่พบ Charger", en: "No chargers found" },
    problemDetails: { th: "รายละเอียดปัญหา", en: "Problem Details" },
    severity: { th: "ความรุนแรง", en: "Severity" },
    problemType: { th: "ประเภทปัญหา", en: "Problem Type" },
    details: { th: "รายละเอียด", en: "Details" },
    jobStatus: { th: "สถานะงาน", en: "Job Status" },
    remarks: { th: "หมายเหตุ", en: "Remarks" },
    photos: { th: "รูปภาพ", en: "Photos" },
    noPhotos: { th: "ยังไม่มีรูปแนบ", en: "No photos attached" },

    // Section 2 - Corrective Actions
    correctiveSection: { th: "การแก้ไข", en: "Corrective Actions" },
    correctiveActions: { th: "การดำเนินการแก้ไข", en: "Corrective Actions" },
    addAction: { th: "เพิ่มการดำเนินการ", en: "Add Action" },
    actionNo: { th: "ข้อที่", en: "Action" },
    deleteAction: { th: "ลบ", en: "Delete" },
    attachPhoto: { th: "แนบรูป", en: "Attach Photo" },
    beforePhoto: { th: "รูปก่อนแก้ไข", en: "Before" },
    afterPhoto: { th: "รูปหลังแก้ไข", en: "After" },
    repairResult: { th: "ผลหลังซ่อม", en: "Repair Result" },
    preventiveAction: { th: "วิธีป้องกันไม่ให้เกิดซ้ำ", en: "Preventive Action" },
    addPreventive: { th: "เพิ่ม", en: "Add" },
    resolvedDate: { th: "วันที่แก้ไข", en: "Resolved Date" },

    // Section 3 - Problem Summary
    problemSummarySection: { th: "ปัญหาที่พบ", en: "Problem Found" },
    cause: { th: "สาเหตุ", en: "Cause" },

    // Buttons
    saving: { th: "กำลังบันทึก...", en: "Saving..." },
    closed: { th: "Closed", en: "Closed" },
    save: { th: "บันทึก", en: "Save" },
    backToList: { th: "กลับ", en: "Back" },

    // Alerts
    alertNoStationId: { th: "ไม่พบ station_id", en: "Station ID not found" },
    alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },

    // Validation
    formStatus: { th: "สถานะการกรอกข้อมูล", en: "Form Status" },
    allComplete: { th: "กรอกข้อมูลครบถ้วน พร้อมบันทึก ✓", en: "All fields completed. Ready to save ✓" },
    remaining: { th: "ยังขาดอีก", en: "Missing" },
    items: { th: "รายการ", en: "items" },
    validCorrectiveAction: { th: "การดำเนินการแก้ไข", en: "Corrective Action" },
    validBeforePhoto: { th: "รูปก่อนแก้ไข", en: "Before Photo" },
    validAfterPhoto: { th: "รูปหลังแก้ไข", en: "After Photo" },
    validRepairResult: { th: "ผลหลังซ่อม", en: "Repair Result" },
    validProblemType: { th: "ประเภทปัญหา", en: "Problem Type" },
    validCause: { th: "สาเหตุ", en: "Cause" },
    notFilled: { th: "ยังไม่ได้กรอก", en: "Not filled" },
    notSelected: { th: "ยังไม่ได้เลือก", en: "Not selected" },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

// ==================== IMAGE UTILITIES FOR DRAFT ====================
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function base64ToBlobUrl(base64: string): string {
    try {
        const parts = base64.split(",");
        if (parts.length < 2) return base64;

        const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
        const bstr = atob(parts[1]);
        const n = bstr.length;
        const u8arr = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
            u8arr[i] = bstr.charCodeAt(i);
        }
        const blob = new Blob([u8arr], { type: mime });
        return URL.createObjectURL(blob);
    } catch (e) {
        console.error("Failed to convert base64 to blob:", e);
        return base64;
    }
}

// ==================== TYPES ====================
type Severity = "" | "Low" | "Medium" | "High" | "Critical";
type Status = "" | "Open" | "In Progress" | "Closed";
type ServerPhoto = { filename: string; size: number; url: string; remark?: string; uploadedAt?: string; };
type PhotoItem = { id: string; file: File | null; preview: string; isServer?: boolean; serverUrl?: string; };
type CorrectiveItem = { text: string; beforeImages: PhotoItem[]; afterImages: PhotoItem[]; };

type Job = {
    issue_id: string; doc_name: string; found_date: string; location: string;
    problem_details: string; problem_type: string; severity: Severity;
    initial_cause: string; status: Status; remarks: string; faulty_equipment: string;
    corrective_actions: CorrectiveItem[];
    resolved_date: string;
    repair_result: string;
    preventive_action: string[];
    repaired_equipment: string[];
    inprogress_remarks: string;
    cause: string; // NEW: สาเหตุ
};

type ChargerInfo = { chargerNo?: number; charger_id?: string; charger_name?: string; SN?: string; sn?: string; };
type ValidationItem = { key: string; label: string; isValid: boolean; message: string; isRequired: boolean; scrollId?: string; };

const REPAIR_OPTIONS = [
    { value: "แก้ไขสำเร็จ", th: "แก้ไขสำเร็จ", en: "Fixed Successfully" },
    { value: "แก้ไขไม่สำเร็จ", th: "แก้ไขไม่สำเร็จ", en: "Fix Unsuccessful" },
    { value: "อยู่ระหว่างการติดตามผล", th: "อยู่ระหว่างการติดตามผล", en: "Monitoring" },
    { value: "อยู่ระหว่างการรออะไหล่", th: "อยู่ระหว่างการรออะไหล่", en: "Waiting for Parts" },
] as const;

const LOGO_SRC = "/img/logo_egat.png";
const LIST_ROUTE = "/dashboard/cm-report";
const MAX_PHOTOS = 5;
const FIXED_EQUIPMENT = ["MDB", "CCB", "CB-BOX", "Station"] as const;

const INITIAL_JOB: Job = {
    issue_id: "", doc_name: "", found_date: "", location: "", problem_details: "",
    problem_type: "", severity: "", initial_cause: "", status: "", remarks: "", faulty_equipment: "",
    corrective_actions: [{ text: "", beforeImages: [], afterImages: [] }],
    resolved_date: "",
    repair_result: "",
    preventive_action: [""],
    repaired_equipment: [],
    inprogress_remarks: "",
    cause: "", // NEW
};

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
                </div>
            )}
        </div>
    );
}

// ==================== PHOTO UPLOAD ====================
function PhotoUpload({ photos_problem, onAdd, onRemove, max, disabled, lang }: { photos_problem: PhotoItem[]; onAdd: (files: FileList) => void; onRemove: (id: string) => void; max: number; disabled: boolean; lang: Lang; }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canAddMore = photos_problem.length < max && !disabled;

    return (
        <div className="tw-space-y-4">
            {!disabled && <div className="tw-text-sm tw-text-blue-gray-600">Max {max} photos</div>}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="tw-hidden" onChange={e => { if (e.target.files) { onAdd(e.target.files); e.target.value = ""; } }} />
            {photos_problem.length > 0 ? (
                <div className="tw-grid tw-grid-cols-3 sm:tw-grid-cols-4 md:tw-grid-cols-5 tw-gap-3">
                    {photos_problem.map(photo => (
                        <div key={photo.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-200 tw-bg-blue-gray-50 tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                            <img src={photo.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
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
                    {canAddMore && (
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="tw-aspect-square tw-rounded-lg tw-border-2 tw-border-dashed tw-border-blue-600 tw-flex tw-flex-col tw-items-center tw-justify-center tw-text-blue-600 hover:tw-bg-blue-50 tw-bg-white tw-transition-all">
                            <PhotoIcon className="tw-w-6 tw-h-6" />
                            <span className="tw-text-xs tw-mt-1 tw-font-bold">ATTACH</span>
                        </button>
                    )}
                </div>
            ) : disabled ? (
                <div className="tw-border tw-border-blue-gray-200 tw-rounded-lg tw-p-6 tw-text-center tw-bg-gray-50">
                    <p className="tw-text-sm tw-text-blue-gray-400">{t("noPhotos", lang)}</p>
                </div>
            ) : (
                <div onClick={() => fileInputRef.current?.click()} className="tw-border tw-border-dashed tw-border-blue-600 tw-rounded-lg tw-p-6 tw-text-center tw-bg-white tw-transition-all tw-flex tw-flex-col tw-items-center tw-justify-center tw-cursor-pointer hover:tw-bg-blue-50">
                    <button type="button" className="tw-inline-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2 tw-rounded-lg tw-border-2 tw-border-blue-600 tw-text-blue-600 tw-font-bold tw-text-sm hover:tw-bg-blue-50 tw-transition-colors mb-2">
                        <PhotoIcon className="tw-w-4 tw-h-4" /> {t("attachPhoto", lang)}
                    </button>
                    <p className="tw-text-xs tw-text-blue-gray-600">{t("noPhotos", lang)}</p>
                </div>
            )}
        </div>
    );
}

// ==================== SEVERITY COLOR ====================
function getSeverityColor(severity: string) {
    switch (severity?.toLowerCase()) {
        case "critical": return { dot: "tw-bg-red-500", text: "tw-text-red-700" };
        case "high": return { dot: "tw-bg-orange-500", text: "tw-text-orange-700" };
        case "medium": return { dot: "tw-bg-yellow-500", text: "tw-text-yellow-700" };
        case "low": return { dot: "tw-bg-green-500", text: "tw-text-green-700" };
        default: return { dot: "tw-bg-gray-400", text: "tw-text-gray-600" };
    }
}

// ==================== MAIN COMPONENT ====================
export default function CMInProgressForm() {
    const { lang } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const [stationId, setStationId] = useState<string | null>(null);
    const [job, setJob] = useState<Job>({ ...INITIAL_JOB });
    const [reportedBy, setReportedBy] = useState("");
    const [inspector, setInspector] = useState("");
    const [saving, setSaving] = useState(false);
    const [photos_problem, setPhotosProblem] = useState<PhotoItem[]>([]);
    const [chargers, setChargers] = useState<ChargerInfo[]>([]);
    const [loadingChargers, setLoadingChargers] = useState(false);
    const [devices, setDevices] = useState<string[]>([]);
    const [loadingDevices, setLoadingDevices] = useState(false);

    const editId = searchParams.get("edit_id") ?? "";
    const isEdit = !!editId;

    const currentTab = searchParams.get("tab") ?? "in-progress";

    // ==================== NAVIGATION HELPERS ====================
    const buildListUrl = (targetTab?: string) => {
        const p = new URLSearchParams();
        if (stationId) p.set("station_id", stationId);
        p.set("tab", targetTab ?? currentTab);
        return `${LIST_ROUTE}?${p.toString()}`;
    };

    const goBackToList = () => {
        router.push(buildListUrl(currentTab));
    };

    // ==================== DRAFT MANAGEMENT ====================
    const { status: draftStatus, hasDraft, saveNow: saveDraftNow, load: loadDraft, deleteDraft } = useDraft(
        editId || null,
        stationId,
        { debounceDelay: 2000 }
    );
    const [showDraftPrompt, setShowDraftPrompt] = useState(false);
    const [pendingDraft, setPendingDraft] = useState<DraftData | null>(null);

    useEffect(() => {
        if (!editId || !stationId) return;
        (async () => {
            const draft = await loadDraft();
            if (draft) {
                setPendingDraft(draft);
                setShowDraftPrompt(true);
            }
        })();
    }, [editId, stationId, loadDraft]);

    const applyDraft = () => {
        if (pendingDraft) {
            setJob(prev => ({
                ...prev,
                corrective_actions: pendingDraft.corrective_actions?.length > 0
                    ? pendingDraft.corrective_actions.map((a: any) => ({
                        text: a.text,
                        beforeImages: (a.beforeImages || []).map((img: DraftImage) => ({
                            id: img.id,
                            file: null as unknown as File,
                            preview: base64ToBlobUrl(img.base64),
                            isServer: false,
                        })),
                        afterImages: (a.afterImages || []).map((img: DraftImage) => ({
                            id: img.id,
                            file: null as unknown as File,
                            preview: base64ToBlobUrl(img.base64),
                            isServer: false,
                        }))
                    }))
                    : prev.corrective_actions,
                repaired_equipment: pendingDraft.repaired_equipment || [],
                repair_result: pendingDraft.repair_result || "",
                preventive_action: pendingDraft.preventive_action?.length > 0
                    ? pendingDraft.preventive_action
                    : [""],
                inprogress_remarks: pendingDraft.inprogress_remarks || "",
                problem_type: (pendingDraft as any).problem_type || prev.problem_type,
                cause: (pendingDraft as any).cause || prev.cause,
            }));
        }
        setShowDraftPrompt(false);
        setPendingDraft(null);
    };

    const dismissDraft = () => {
        setShowDraftPrompt(false);
        setPendingDraft(null);
    };

    // Helper function to convert images to draft format
    const convertImagesToDraft = async (images: PhotoItem[]): Promise<DraftImage[]> => {
        return Promise.all(
            images.map(async (img: PhotoItem) => {
                let base64 = "";
                if (img.file) {
                    base64 = await fileToBase64(img.file);
                } else if (img.preview && img.preview.startsWith("data:")) {
                    base64 = img.preview;
                } else if (img.preview && img.preview.startsWith("blob:")) {
                    try {
                        const response = await fetch(img.preview);
                        const blob = await response.blob();
                        base64 = await fileToBase64(blob as File);
                    } catch {
                        base64 = "";
                    }
                }
                return {
                    id: img.id,
                    name: img.file?.name || `image_${img.id}`,
                    base64,
                };
            })
        );
    };

    const saveDraftWithImages = useCallback(async () => {
        if (!editId || !stationId) return;

        const hasData = job.corrective_actions.some((a: CorrectiveItem) => a.text.trim() !== "" || a.beforeImages.length > 0 || a.afterImages.length > 0) ||
            job.repaired_equipment.length > 0 ||
            job.repair_result ||
            job.preventive_action.some((p: string) => p.trim() !== "") ||
            job.inprogress_remarks ||
            job.problem_type ||
            job.cause;
        if (!hasData) return;

        try {
            const correctiveActionsWithImages = await Promise.all(
                job.corrective_actions.map(async (a: CorrectiveItem) => {
                    const beforeImages = await convertImagesToDraft(a.beforeImages);
                    const afterImages = await convertImagesToDraft(a.afterImages);
                    return {
                        text: a.text,
                        beforeImages: beforeImages.filter(img => img.base64),
                        afterImages: afterImages.filter(img => img.base64),
                    };
                })
            );

            const draftData: DraftData = {
                corrective_actions: correctiveActionsWithImages as any,
                repaired_equipment: job.repaired_equipment,
                repair_result: job.repair_result,
                preventive_action: job.preventive_action,
                inprogress_remarks: job.inprogress_remarks,
                problem_type: job.problem_type,
                cause: job.cause,
            } as any;
            await saveDraftNow(draftData);
        } catch (e) {
            console.error("Failed to save draft with images:", e);
        }
    }, [job.corrective_actions, job.repaired_equipment, job.repair_result, job.preventive_action, job.inprogress_remarks, job.problem_type, job.cause, editId, stationId, saveDraftNow]);

    const draftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
        if (!editId || !stationId) return;

        if (draftTimeoutRef.current) {
            clearTimeout(draftTimeoutRef.current);
        }

        draftTimeoutRef.current = setTimeout(() => {
            saveDraftWithImages();
        }, 2000);

        return () => {
            if (draftTimeoutRef.current) {
                clearTimeout(draftTimeoutRef.current);
            }
        };
    }, [saveDraftWithImages, editId, stationId]);

    // ==================== VALIDATION ====================
    const validations = useMemo<ValidationItem[]>(() => [
        { key: "problemType", label: t("validProblemType", lang), isValid: !!job.problem_type.trim(), message: t("notFilled", lang), isRequired: true, scrollId: "cm-problem-type" },
        { key: "cause", label: t("validCause", lang), isValid: !!job.cause.trim(), message: t("notFilled", lang), isRequired: true, scrollId: "cm-cause" },
        { key: "correctiveAction", label: t("validCorrectiveAction", lang), isValid: job.corrective_actions.some((a: CorrectiveItem) => a.text.trim() !== ""), message: t("notFilled", lang), isRequired: true, scrollId: "cm-corrective" },
        { key: "beforePhoto", label: t("validBeforePhoto", lang), isValid: job.corrective_actions.every((a: CorrectiveItem) => a.beforeImages.length > 0), message: t("notFilled", lang), isRequired: true, scrollId: "cm-corrective" },
        { key: "afterPhoto", label: t("validAfterPhoto", lang), isValid: job.corrective_actions.every((a: CorrectiveItem) => a.afterImages.length > 0), message: t("notFilled", lang), isRequired: true, scrollId: "cm-corrective" },
        { key: "repairResult", label: t("validRepairResult", lang), isValid: !!job.repair_result, message: t("notSelected", lang), isRequired: true, scrollId: "cm-repair-result" },
    ], [job, lang]);
    const canSave = useMemo(() => validations.filter(v => v.isRequired).every(v => v.isValid), [validations]);

    const isClosedResult = useMemo(() => {
        return job.repair_result === "แก้ไขสำเร็จ" || job.repair_result === "แก้ไขไม่สำเร็จ";
    }, [job.repair_result]);

    const targetStatus = isClosedResult ? "Closed" : "In Progress";
    const targetTab = isClosedResult ? "closed" : "in-progress";

    // ==================== HELPERS ====================
    const localTodayFormatted = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };
    const localTodayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const displayToISO = (s: string) => { if (!s) return localTodayISO(); const p = s.split("/"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : localTodayISO(); };
    const isoToDisplay = (s: string) => { if (!s) return localTodayFormatted(); const p = s.slice(0, 10).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : localTodayFormatted(); };

    // ==================== CORRECTIVE ACTIONS HANDLERS ====================
    const addCorrectiveAction = () => {
        setJob(prev => ({
            ...prev,
            corrective_actions: [...prev.corrective_actions, { text: "", beforeImages: [], afterImages: [] }]
        }));
    };

    const removeCorrectiveAction = (index: number) => {
        if (job.corrective_actions.length <= 1) return;
        setJob(prev => ({
            ...prev,
            corrective_actions: prev.corrective_actions.filter((_, i) => i !== index)
        }));
    };

    const updateCorrectiveText = (index: number, text: string) => {
        setJob(prev => ({
            ...prev,
            corrective_actions: prev.corrective_actions.map((item, i) =>
                i === index ? { ...item, text } : item
            )
        }));
    };

    const addCorrectiveBeforeImages = (index: number, files: FileList | null) => {
        if (!files) return;
        const newImages: PhotoItem[] = Array.from(files).slice(0, MAX_PHOTOS).map((file, i) => ({
            id: `before-${Date.now()}-${index}-${i}-${file.name}`,
            file,
            preview: URL.createObjectURL(file),
        }));
        setJob(prev => ({
            ...prev,
            corrective_actions: prev.corrective_actions.map((item, i) =>
                i === index ? { ...item, beforeImages: [...item.beforeImages, ...newImages].slice(0, MAX_PHOTOS) } : item
            )
        }));
    };

    const addCorrectiveAfterImages = (index: number, files: FileList | null) => {
        if (!files) return;
        const newImages: PhotoItem[] = Array.from(files).slice(0, MAX_PHOTOS).map((file, i) => ({
            id: `after-${Date.now()}-${index}-${i}-${file.name}`,
            file,
            preview: URL.createObjectURL(file),
        }));
        setJob(prev => ({
            ...prev,
            corrective_actions: prev.corrective_actions.map((item, i) =>
                i === index ? { ...item, afterImages: [...item.afterImages, ...newImages].slice(0, MAX_PHOTOS) } : item
            )
        }));
    };

    const removeCorrectiveBeforeImage = (actionIndex: number, imageId: string) => {
        setJob(prev => ({
            ...prev,
            corrective_actions: prev.corrective_actions.map((item, i) =>
                i === actionIndex ? { ...item, beforeImages: item.beforeImages.filter(img => img.id !== imageId) } : item
            )
        }));
    };

    const removeCorrectiveAfterImage = (actionIndex: number, imageId: string) => {
        setJob(prev => ({
            ...prev,
            corrective_actions: prev.corrective_actions.map((item, i) =>
                i === actionIndex ? { ...item, afterImages: item.afterImages.filter(img => img.id !== imageId) } : item
            )
        }));
    };

    // ==================== PREVENTIVE ACTION HANDLERS ====================
    const addPreventiveAction = () => {
        setJob(prev => ({
            ...prev,
            preventive_action: [...prev.preventive_action, ""]
        }));
    };

    const removePreventiveAction = (index: number) => {
        if (job.preventive_action.length <= 1) return;
        setJob(prev => ({
            ...prev,
            preventive_action: prev.preventive_action.filter((_, i) => i !== index)
        }));
    };

    const updatePreventiveAction = (index: number, value: string) => {
        setJob(prev => ({
            ...prev,
            preventive_action: prev.preventive_action.map((item, i) => i === index ? value : item)
        }));
    };

    // ==================== API EFFECTS ====================
    useEffect(() => { const sid = searchParams.get("station_id") || localStorage.getItem("selected_station_id"); if (sid) { setStationId(sid); localStorage.setItem("selected_station_id", sid); } }, [searchParams]);

    useEffect(() => {
        if (!stationId) return;
        let alive = true;
        setLoadingChargers(true);
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/chargers/${encodeURIComponent(stationId)}`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    if (alive) setChargers(data.chargers || []);
                }
            } catch {
                setChargers([]);
            } finally {
                if (alive) setLoadingChargers(false);
            }
        })();
        return () => { alive = false; };
    }, [stationId]);

    useEffect(() => {
        if (chargers.length === 0) return;
        const sn = chargers[0]?.SN || chargers[0]?.sn;
        if (!sn) return;

        let alive = true;
        setLoadingDevices(true);
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/station/${encodeURIComponent(sn)}/device-keys`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    if (alive) setDevices(data.keys || []);
                }
            } catch {
                setDevices([]);
            } finally {
                if (alive) setLoadingDevices(false);
            }
        })();
        return () => { alive = false; };
    }, [chargers]);

    useEffect(() => {
    if (!editId || !stationId) return;
    (async () => {
        try {
            const res = await fetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}?station_id=${encodeURIComponent(stationId)}`, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();
            const rawDate = data.cm_date ?? data.found_date ?? "";
            
            setJob(prev => ({
                ...prev,
                doc_name: data.doc_name ?? "",
                issue_id: data.issue_id ?? "",
                found_date: rawDate ? isoToDisplay(rawDate) : localTodayFormatted(),
                location: data.location ?? prev.location,
                problem_details: data.problem_details ?? "",
                severity: (data.severity ?? "") as Severity,
                status: (data.status ?? "In Progress") as Status,
                remarks: data.remarks_open ?? "",
                faulty_equipment: data.faulty_equipment ?? "",
                
                // ✅ ดึงจาก flat fields โดยตรง
                problem_type: data.problem_type ?? "",
                cause: data.cause ?? "",
                repair_result: data.repair_result ?? "",
                inprogress_remarks: data.inprogress_remarks ?? "",
                resolved_date: data.resolved_date ? isoToDisplay(data.resolved_date) : "",
                
                repaired_equipment: Array.isArray(data.repaired_equipment)
                    ? data.repaired_equipment
                    : [],
                    
                preventive_action: Array.isArray(data.preventive_action) && data.preventive_action.length > 0
                    ? data.preventive_action
                    : [""],
                    
                corrective_actions: Array.isArray(data.corrective_actions) && data.corrective_actions.length > 0
                    ? data.corrective_actions.map((a: any) => ({
                        text: a.text || "",
                        beforeImages: (a.beforeImages || []).map((img: any, idx: number) => ({
                            id: `server-before-${idx}-${img.name || img.url}`,
                            file: null,
                            preview: img.url?.startsWith("http") ? img.url : `${API_BASE}${img.url}`,
                            isServer: true,
                            serverUrl: img.url,
                        })),
                        afterImages: (a.afterImages || []).map((img: any, idx: number) => ({
                            id: `server-after-${idx}-${img.name || img.url}`,
                            file: null,
                            preview: img.url?.startsWith("http") ? img.url : `${API_BASE}${img.url}`,
                            isServer: true,
                            serverUrl: img.url,
                        })),
                    }))
                    : [{ text: "", beforeImages: [], afterImages: [] }],
            }));
            
            setReportedBy(data.reported_by ?? "");
            
            // ✅ ดึง inspector จาก data ถ้ามี (ไม่ override จาก /me)
            if (data.inspector) {
                setInspector(data.inspector);
            }

            // Photos สำหรับ Section 1
            if (data.photos_problem) {
                const serverPhotos: PhotoItem[] = [];
                for (const [group, photoList] of Object.entries(data.photos_problem)) {
                    if (Array.isArray(photoList)) {
                        (photoList as ServerPhoto[]).forEach((p, i) => {
                            const fullUrl = p.url.startsWith("http") ? p.url : `${API_BASE}${p.url}`;
                            serverPhotos.push({
                                id: `server-${group}-${i}-${p.filename}`,
                                file: null,
                                preview: fullUrl,
                                isServer: true,
                                serverUrl: p.url,
                            });
                        });
                    }
                }
                if (serverPhotos.length > 0) {
                    setPhotosProblem(serverPhotos);
                }
            }
        } catch (e) {
            console.error("Failed to load cmreport:", e);
        }
    })();
}, [editId, stationId]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/me`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    // ✅ เฉพาะถ้ายังไม่มี inspector
                    if (alive) {
                        setInspector(prev => prev || data.username || "");
                    }
                }
            } catch { }
        })();
        return () => { alive = false; };
    }, []);
    // ==================== HANDLERS ====================
    const onFinalSave = async () => {
        if (!stationId) { alert(t("alertNoStationId", lang)); return; }
        if (!canSave) return;
        setSaving(true);

        try {
            // ==================== STEP 1: Upload รูปภาพก่อน ====================
            const uploadedCorrectiveActions = await Promise.all(
                job.corrective_actions.map(async (action, actionIndex) => {
                    // Upload before images
                    const uploadedBeforeImages: { name: string; url: string }[] = [];
                    for (const img of action.beforeImages) {
                        if (img.isServer && img.serverUrl) {
                            // รูปที่ upload แล้ว - ใช้ URL เดิม
                            uploadedBeforeImages.push({
                                name: img.file?.name || `image_${img.id}`,
                                url: img.serverUrl
                            });
                        } else if (img.file) {
                            // รูปใหม่ - upload
                            const formData = new FormData();
                            formData.append("station_id", stationId);
                            formData.append("group", `before_${actionIndex}`);
                            formData.append("phase", "repair");
                            formData.append("files", img.file);

                            const uploadRes = await fetch(
                                `${API_BASE}/cmreport/${encodeURIComponent(editId)}/photos`,
                                { method: "POST", credentials: "include", body: formData }
                            );
                            if (uploadRes.ok) {
                                const uploadData = await uploadRes.json();
                                if (uploadData.files?.[0]) {
                                    uploadedBeforeImages.push({
                                        name: uploadData.files[0].filename,
                                        url: uploadData.files[0].url
                                    });
                                }
                            }
                        } else if (img.preview) {
                            // รูปจาก draft (blob URL) - ต้อง convert และ upload
                            try {
                                const response = await fetch(img.preview);
                                const blob = await response.blob();
                                const file = new File([blob], `before_${actionIndex}_${img.id}.jpg`, { type: blob.type || 'image/jpeg' });

                                const formData = new FormData();
                                formData.append("station_id", stationId);
                                formData.append("group", `before_${actionIndex}`);
                            formData.append("phase", "repair");
                                formData.append("files", file);

                                const uploadRes = await fetch(
                                    `${API_BASE}/cmreport/${encodeURIComponent(editId)}/photos`,
                                    { method: "POST", credentials: "include", body: formData }
                                );
                                if (uploadRes.ok) {
                                    const uploadData = await uploadRes.json();
                                    if (uploadData.files?.[0]) {
                                        uploadedBeforeImages.push({
                                            name: uploadData.files[0].filename,
                                            url: uploadData.files[0].url
                                        });
                                    }
                                }
                            } catch (e) {
                                console.error("Failed to upload before image from draft:", e);
                            }
                        }
                    }

                    // Upload after images (same logic)
                    const uploadedAfterImages: { name: string; url: string }[] = [];
                    for (const img of action.afterImages) {
                        if (img.isServer && img.serverUrl) {
                            uploadedAfterImages.push({
                                name: img.file?.name || `image_${img.id}`,
                                url: img.serverUrl
                            });
                        } else if (img.file) {
                            const formData = new FormData();
                            formData.append("station_id", stationId);
                            formData.append("group", `after_${actionIndex}`);
                            formData.append("phase", "repair");
                            formData.append("files", img.file);

                            const uploadRes = await fetch(
                                `${API_BASE}/cmreport/${encodeURIComponent(editId)}/photos`,
                                { method: "POST", credentials: "include", body: formData }
                            );
                            if (uploadRes.ok) {
                                const uploadData = await uploadRes.json();
                                if (uploadData.files?.[0]) {
                                    uploadedAfterImages.push({
                                        name: uploadData.files[0].filename,
                                        url: uploadData.files[0].url
                                    });
                                }
                            }
                        } else if (img.preview) {
                            try {
                                const response = await fetch(img.preview);
                                const blob = await response.blob();
                                const file = new File([blob], `after_${actionIndex}_${img.id}.jpg`, { type: blob.type || 'image/jpeg' });

                                const formData = new FormData();
                                formData.append("station_id", stationId);
                                formData.append("group", `after_${actionIndex}`);
                            formData.append("phase", "repair");
                                formData.append("files", file);

                                const uploadRes = await fetch(
                                    `${API_BASE}/cmreport/${encodeURIComponent(editId)}/photos`,
                                    { method: "POST", credentials: "include", body: formData }
                                );
                                if (uploadRes.ok) {
                                    const uploadData = await uploadRes.json();
                                    if (uploadData.files?.[0]) {
                                        uploadedAfterImages.push({
                                            name: uploadData.files[0].filename,
                                            url: uploadData.files[0].url
                                        });
                                    }
                                }
                            } catch (e) {
                                console.error("Failed to upload after image from draft:", e);
                            }
                        }
                    }

                    return {
                        text: action.text,
                        beforeImages: uploadedBeforeImages,
                        afterImages: uploadedAfterImages
                    };
                })
            );

            // ==================== STEP 2: Save job data ====================
            const jobPayload = {
                ...job,
                found_date: displayToISO(job.found_date),
                resolved_date: isClosedResult ? (job.resolved_date ? displayToISO(job.resolved_date) : localTodayISO()) : "",
                status: targetStatus,
                corrective_actions: uploadedCorrectiveActions,  // ✅ ใช้ข้อมูลที่ upload แล้ว
            };

            const res = await fetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    station_id: stationId,
                    status: targetStatus,
                    job: jobPayload,
                    inspector
                })
            });
            if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

            await deleteDraft();

            const p = new URLSearchParams();
            if (stationId) p.set("station_id", stationId);
            p.set("tab", targetTab);
            router.push(`${LIST_ROUTE}?${p.toString()}`);
        } catch (e: any) {
            alert(`${t("alertSaveFailed", lang)} ${e.message || e}`);
        }
        finally { setSaving(false); }
    };

    const severityColor = getSeverityColor(job.severity);

    // ==================== RENDER ====================
    return (
        <section className="tw-pb-24">
            {/* Draft Prompt Dialog */}
            {showDraftPrompt && pendingDraft && (
                <div className="tw-fixed tw-inset-0 tw-bg-black/50 tw-flex tw-items-center tw-justify-center tw-z-50">
                    <div className="tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-p-6 tw-mx-4 tw-max-w-md tw-w-full">
                        <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4">
                            <div className="tw-w-12 tw-h-12 tw-rounded-full tw-bg-gray-100 tw-flex tw-items-center tw-justify-center">
                                <ExclamationTriangleIcon className="tw-w-6 tw-h-6 tw-text-gray-600" />
                            </div>
                            <div>
                                <h3 className="tw-font-bold tw-text-gray-900 tw-text-lg">
                                    {lang === "th" ? "พบข้อมูลที่บันทึกไว้" : "Draft Found"}
                                </h3>
                                <p className="tw-text-sm tw-text-gray-500">
                                    {lang === "th" ? "ต้องการโหลดข้อมูลที่บันทึกไว้ก่อนหน้าหรือไม่?" : "Do you want to load the previously saved data?"}
                                </p>
                            </div>
                        </div>
                        {pendingDraft.savedAt && (
                            <p className="tw-text-xs tw-text-gray-400 tw-mb-4">
                                {lang === "th" ? "บันทึกเมื่อ: " : "Saved at: "}
                                {new Date(pendingDraft.savedAt).toLocaleString(lang === "th" ? "th-TH" : "en-US")}
                            </p>
                        )}
                        <div className="tw-flex tw-gap-3">
                            <button
                                onClick={dismissDraft}
                                className="tw-flex-1 tw-px-4 tw-py-2.5 tw-rounded-xl tw-border tw-border-gray-200 tw-text-gray-700 tw-font-medium hover:tw-bg-gray-50 tw-transition-colors"
                            >
                                {lang === "th" ? "ไม่ใช้" : "Discard"}
                            </button>
                            <button
                                onClick={applyDraft}
                                className="tw-flex-1 tw-px-4 tw-py-2.5 tw-rounded-xl tw-bg-gray-700 tw-text-white tw-font-medium hover:tw-bg-gray-800 tw-transition-colors"
                            >
                                {lang === "th" ? "โหลด" : "Load"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Draft Status Indicator */}
            {draftStatus && (
                <div className={`tw-fixed tw-bottom-4 tw-right-4 tw-px-4 tw-py-2.5 tw-rounded-xl tw-shadow-lg tw-text-sm tw-font-medium tw-z-40 tw-flex tw-items-center tw-gap-2 tw-transition-all ${draftStatus === "saving" ? "tw-bg-gray-50 tw-text-gray-700 tw-border tw-border-gray-200" :
                    draftStatus === "saved" || draftStatus === "saved-local" ? "tw-bg-green-50 tw-text-green-700 tw-border tw-border-green-200" :
                        "tw-bg-red-50 tw-text-red-700 tw-border tw-border-red-200"
                    }`}>
                    {draftStatus === "saving" && (
                        <>
                            <svg className="tw-animate-spin tw-w-4 tw-h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>{lang === "th" ? "กำลังบันทึกแบบร่าง..." : "Saving draft..."}</span>
                        </>
                    )}
                    {draftStatus === "saved" && (
                        <>
                            <CheckCircleIcon className="tw-w-4 tw-h-4" />
                            <span>{lang === "th" ? "บันทึกแบบร่างแล้ว" : "Draft saved"}</span>
                        </>
                    )}
                    {draftStatus === "saved-local" && (
                        <>
                            <CheckCircleIcon className="tw-w-4 tw-h-4" />
                            <span>{lang === "th" ? "บันทึกในเครื่อง" : "Saved locally"}</span>
                        </>
                    )}
                    {draftStatus === "error" && (
                        <>
                            <ExclamationTriangleIcon className="tw-w-4 tw-h-4" />
                            <span>{lang === "th" ? "บันทึกไม่สำเร็จ" : "Save failed"}</span>
                        </>
                    )}
                </div>
            )}

            {/* Back Button */}
            <div className="tw-mx-auto tw-max-w-6xl tw-mb-6 tw-flex tw-items-center tw-justify-between">
                <Button variant="outlined" size="sm" onClick={goBackToList} title={t("backToList", lang)} className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300">
                    <ArrowLeftIcon className="tw-w-4 tw-h-4" />
                </Button>
            </div>

            <form noValidate onSubmit={e => e.preventDefault()} onKeyDown={e => e.key === "Enter" && e.target instanceof HTMLInputElement && e.preventDefault()}>
                <div className="tw-mx-auto tw-max-w-6xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-md tw-shadow-blue-gray-500/5 tw-p-6 md:tw-p-8">

                    {/* Header */}
                    <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start tw-justify-between tw-gap-6 tw-mb-6">
                        <div className="tw-flex tw-items-start tw-gap-4">
                            <div className="tw-relative tw-shrink-0 tw-h-16 tw-w-[90px] md:tw-h-20 md:tw-w-[110px]">
                                <Image src={LOGO_SRC} alt="Logo" fill priority className="tw-object-contain" sizes="110px" />
                            </div>
                            <div>
                                <div className="tw-font-bold tw-text-blue-gray-900 tw-text-base md:tw-text-lg">
                                    {t("pageTitle", lang)} – {t("headerEdit", lang)}
                                </div>
                                <div className="tw-text-sm tw-text-blue-gray-600 tw-mt-2">{t("companyName", lang)}</div>
                                <div className="tw-text-xs tw-text-blue-gray-500 tw-mt-1">{t("companyAddressLine1", lang)}</div>
                                <div className="tw-text-xs tw-text-blue-gray-500">{t("companyAddressLine2", lang)}</div>
                            </div>
                        </div>
                        <div className="tw-text-left md:tw-text-right tw-text-sm tw-text-blue-gray-700 tw-border-l tw-border-blue-gray-100 tw-pl-4 md:tw-pl-6 md:tw-border-l-0 tw-pt-3 md:tw-pt-0 md:tw-shrink-0">
                            <div className="tw-font-semibold tw-text-blue-gray-800">{t("docName", lang)}</div>
                            <div className="tw-break-all tw-text-blue-gray-600 tw-mt-1">{job.doc_name || "-"}</div>
                        </div>
                    </div>

                    <hr className="tw-my-6 tw-border-blue-gray-100" />

                    {/* Meta Info - Readonly */}
                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-3 lg:tw-grid-cols-5 tw-gap-4 tw-mb-6">
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("issueId", lang)}</label>
                            <Input value={job.issue_id || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("foundDate", lang)}</label>
                            <Input value={job.found_date || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("location", lang)}</label>
                            <Input value={job.location || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("reportedBy", lang)}</label>
                            <Input value={reportedBy || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("inspector", lang)}</label>
                            <Input value={inspector || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                    </div>

                    {/* Section 1: Problem Details (Readonly) */}
                    <div className="tw-mb-6 tw-rounded-xl tw-overflow-hidden tw-border tw-border-red-200 tw-bg-white tw-shadow-lg">
                        <div className="tw-flex tw-items-center tw-gap-3 tw-bg-gradient-to-r tw-from-red-500 tw-to-red-600 tw-px-6 tw-py-4 tw-text-white">
                            <div className="tw-w-10 tw-h-10 tw-rounded-full tw-bg-white tw-text-red-600 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-lg tw-shadow-lg">1</div>
                            <span className="tw-font-bold tw-text-xl">{t("problemDetails", lang)}</span>
                            <span className="tw-ml-auto tw-text-xs tw-bg-white/20 tw-px-2.5 tw-py-1 tw-rounded-full tw-font-medium">Read Only</span>
                        </div>

                        <div className="tw-p-4 tw-space-y-4">
                            {/* Faulty Equipment & Severity */}
                            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                                <div>
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("faultyEquipment", lang)}</label>
                                    <select
                                        value={job.faulty_equipment}
                                        disabled
                                        className="tw-w-full tw-h-10 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-px-4 tw-text-sm tw-font-medium tw-bg-gray-100 tw-text-blue-gray-700 tw-cursor-not-allowed tw-opacity-100"
                                        style={{ backgroundColor: '#f3f4f6', color: '#455a64' }}
                                    >
                                        <option value="">{t("selectEquipmentPlaceholder", lang)}</option>
                                        {chargers.length > 0 && (
                                            <optgroup label={t("chargersGroup", lang)}>
                                                {chargers.map((c, i) => {
                                                    const id = c.chargerNo ?? c.charger_id ?? i + 1;
                                                    const sn = c.SN ?? c.sn ?? "";
                                                    const label = c.charger_name || `Charger ${c.chargerNo ?? i + 1}`;
                                                    return <option key={id} value={`charger_${id}`}>{sn ? `${label} (${sn})` : label}</option>;
                                                })}
                                            </optgroup>
                                        )}
                                        <optgroup label={t("otherEquipmentGroup", lang)}>
                                            {FIXED_EQUIPMENT.map(eq => <option key={eq} value={eq.toLowerCase()}>{eq}</option>)}
                                        </optgroup>
                                    </select>
                                    {loadingChargers && <p className="tw-text-xs tw-text-blue-gray-400 tw-mt-2">{t("loadingChargers", lang)}</p>}
                                </div>
                                <div>
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("severity", lang)}</label>
                                    <div className="tw-flex tw-items-center tw-gap-2 tw-h-10 tw-px-3 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-bg-gray-100">
                                        <span className={`tw-w-2.5 tw-h-2.5 tw-rounded-full ${severityColor.dot}`}></span>
                                        <span className={`tw-text-sm tw-font-medium ${severityColor.text}`}>{job.severity || "-"}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Problem Details */}
                            <div>
                                <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("details", lang)}</label>
                                <Textarea value={job.problem_details || ""} readOnly rows={2} className="!tw-w-full !tw-border-blue-gray-200 !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                            </div>

                            {/* Remarks */}
                            <div>
                                <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("remarks", lang)}</label>
                                <Textarea value={job.remarks || ""} readOnly rows={2} className="!tw-w-full !tw-border-blue-gray-200 !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                            </div>

                            {/* Job Status */}
                            <div>
                                <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">{t("jobStatus", lang)}</label>
                                <div className={`tw-inline-flex tw-items-center tw-px-4 tw-py-2.5 tw-rounded-full tw-text-white tw-font-semibold tw-text-sm tw-shadow-md ${isClosedResult ? "tw-bg-gray-600" : "tw-bg-amber-500"
                                    }`}>
                                    <span>{isClosedResult ? "Closed" : "In Progress"}</span>
                                </div>
                            </div>

                            {/* Photos (view only) */}
                            <div>
                                <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("photos", lang)}</label>
                                <PhotoUpload photos_problem={photos_problem} onAdd={() => { }} onRemove={() => { }} max={MAX_PHOTOS} disabled={true} lang={lang} />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Problem Found (Editable) */}
                    <div className="tw-mb-6 tw-rounded-xl tw-overflow-hidden tw-border tw-border-blue-200 tw-bg-white tw-shadow-lg">
                        <div className="tw-flex tw-items-center tw-gap-3 tw-bg-gradient-to-r tw-from-blue-500 tw-to-blue-600 tw-px-6 tw-py-4 tw-text-white">
                            <div className="tw-w-10 tw-h-10 tw-rounded-full tw-bg-white tw-text-blue-600 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-lg tw-shadow-lg">2</div>
                            <span className="tw-font-bold tw-text-xl">{t("problemSummarySection", lang)}</span>
                        </div>

                        <div className="tw-p-6 tw-space-y-5">
                            {/* Problem Type */}
                            <div id="cm-problem-type" className="tw-space-y-2">
                                <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                    <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500"></span>
                                    {t("problemType", lang)} <span className="tw-text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={job.problem_type}
                                    onChange={(e) => setJob(prev => ({ ...prev, problem_type: e.target.value }))}
                                    placeholder={lang === "th" ? "กรอกประเภทปัญหา..." : "Enter problem type..."}
                                    className="tw-w-full md:tw-w-96 tw-h-10 tw-px-3 tw-border tw-border-gray-300 tw-rounded-lg tw-text-sm tw-bg-white focus:tw-outline-none focus:tw-border-blue-400 tw-transition-colors"
                                />
                            </div>

                            {/* Cause */}
                            <div id="cm-cause" className="tw-space-y-2">
                                <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                    <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500"></span>
                                    {t("cause", lang)} <span className="tw-text-red-500">*</span>
                                </label>
                                <textarea
                                    value={job.cause}
                                    onChange={e => setJob({ ...job, cause: e.target.value })}
                                    rows={3}
                                    placeholder={lang === "th" ? "กรอกสาเหตุของปัญหา..." : "Enter the cause of the problem..."}
                                    className="tw-w-full tw-px-3 tw-py-2 tw-border tw-border-gray-300 tw-rounded-lg tw-text-sm tw-bg-white focus:tw-outline-none focus:tw-border-blue-400 tw-transition-colors tw-resize-y"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Corrective Actions (Editable) */}
                    <div className="tw-mb-6 tw-rounded-xl tw-overflow-hidden tw-border tw-border-amber-200 tw-bg-white tw-shadow-lg">
                        <div className="tw-flex tw-items-center tw-gap-3 tw-bg-gradient-to-r tw-from-amber-500 tw-to-amber-600 tw-px-6 tw-py-4 tw-text-white">
                            <div className="tw-w-10 tw-h-10 tw-rounded-full tw-bg-white tw-text-amber-600 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-lg tw-shadow-lg">3</div>
                            <span className="tw-font-bold tw-text-xl">{t("correctiveSection", lang)}</span>
                        </div>

                        <div className="tw-p-6 tw-space-y-6">
                            {/* Row 1: Resolved Date & Repaired Equipment */}
                            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-5">
                                <div className="tw-space-y-2">
                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>
                                        {t("resolvedDate", lang)}
                                    </label>
                                    <Input
                                        type="text"
                                        value={localTodayFormatted()}
                                        readOnly
                                        crossOrigin=""
                                        className="!tw-w-full !tw-bg-gray-100 !tw-text-gray-700 !tw-opacity-100 !tw-border-gray-200 !tw-rounded-lg"
                                        style={{ backgroundColor: "#f3f4f6", color: "#374151" }}
                                        containerProps={{ className: "!tw-min-w-0" }}
                                    />
                                </div>

                                <div className="tw-space-y-2">
                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>
                                        {t("repairedEquipment", lang)}
                                    </label>
                                    <CreatableSelect
                                        isMulti
                                        isClearable
                                        isSearchable
                                        isLoading={loadingDevices}
                                        placeholder={t("selectEquipmentPlaceholder", lang)}
                                        noOptionsMessage={() => lang === "th" ? "ไม่พบข้อมูล" : "No options"}
                                        formatCreateLabel={(inputValue) => lang === "th" ? `เพิ่ม "${inputValue}"` : `Add "${inputValue}"`}
                                        value={job.repaired_equipment.map(val => ({ value: val, label: formatDeviceName(val) }))}
                                        onChange={(options) => setJob({ ...job, repaired_equipment: options ? options.map(opt => opt.value) : [] })}
                                        options={devices.map(key => ({ value: key, label: formatDeviceName(key) }))}
                                        styles={{
                                            control: (base, state) => ({
                                                ...base,
                                                minHeight: "42px",
                                                borderColor: state.isFocused ? "#f59e0b" : "#e5e7eb",
                                                backgroundColor: "#ffffff",
                                                borderRadius: "8px",
                                                boxShadow: state.isFocused ? "0 0 0 3px rgba(245, 158, 11, 0.15)" : "none",
                                                "&:hover": { borderColor: "#f59e0b" },
                                            }),
                                            option: (base, state) => ({
                                                ...base,
                                                backgroundColor: state.isSelected ? "#f59e0b" : state.isFocused ? "#fef3c7" : "white",
                                                color: state.isSelected ? "white" : "#374151",
                                                "&:active": { backgroundColor: "#fbbf24" },
                                            }),
                                            multiValue: (base) => ({
                                                ...base,
                                                backgroundColor: "#fef3c7",
                                                borderRadius: "6px",
                                            }),
                                            multiValueLabel: (base) => ({
                                                ...base,
                                                color: "#92400e",
                                                fontWeight: 500,
                                            }),
                                            multiValueRemove: (base) => ({
                                                ...base,
                                                color: "#92400e",
                                                "&:hover": { backgroundColor: "#fbbf24", color: "#78350f" },
                                            }),
                                            placeholder: (base) => ({ ...base, color: "#9ca3af" }),
                                        }}
                                        classNamePrefix="react-select"
                                    />
                                    {loadingDevices && <p className="tw-text-xs tw-text-amber-600 tw-mt-1">{t("loadingDevices", lang)}</p>}
                                </div>
                            </div>

                            {/* Corrective Actions */}
                            <div id="cm-corrective" className="tw-space-y-4">
                                <div className="tw-flex tw-items-center tw-justify-between">
                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>
                                        {t("correctiveActions", lang)} <span className="tw-text-red-500">*</span>
                                    </label>
                                    <button type="button" onClick={addCorrectiveAction} className="tw-text-sm tw-font-semibold tw-rounded-lg tw-bg-amber-500 tw-text-white tw-px-4 tw-py-2 hover:tw-bg-amber-600 tw-shadow-md hover:tw-shadow-lg tw-transition-all tw-flex tw-items-center tw-gap-1.5">
                                        <span className="tw-text-lg tw-leading-none">+</span> {t("addAction", lang)}
                                    </button>
                                </div>

                                <div className="tw-space-y-4">
                                    {job.corrective_actions.map((action, i) => (
                                        <div key={i}>
                                            {i > 0 && <hr className="tw-border-gray-200 tw-my-5" />}

                                            <div className="tw-flex tw-gap-4">
                                                <div className="tw-flex-shrink-0 tw-w-10 tw-h-10 tw-rounded-full tw-bg-gradient-to-br tw-from-amber-400 tw-to-amber-600 tw-text-white tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-base tw-shadow-md">
                                                    {i + 1}
                                                </div>

                                                <div className="tw-flex-1 tw-space-y-4">
                                                    {/* Delete button */}
                                                    {job.corrective_actions.length > 1 && (
                                                        <div className="tw-flex tw-justify-end">
                                                            <button type="button" onClick={() => removeCorrectiveAction(i)} className="tw-w-10 tw-h-10 tw-rounded-lg tw-text-red-400 hover:tw-text-white hover:tw-bg-red-500 tw-flex tw-items-center tw-justify-center tw-transition-all">
                                                                <XMarkIcon className="tw-w-5 tw-h-5" />
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Before/After Images Grid */}
                                                    <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                                                        {/* Before Images */}
                                                        <div className="tw-border tw-border-red-200 tw-rounded-xl tw-p-4 tw-bg-red-50/30">
                                                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                                                <span className="tw-text-sm tw-font-semibold tw-text-red-700 tw-flex tw-items-center tw-gap-2">
                                                                    <span className="tw-w-2 tw-h-2 tw-rounded-full tw-bg-red-500"></span>
                                                                    {t("beforePhoto", lang)} <span className="tw-text-red-500">*</span>
                                                                </span>
                                                                <label className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-lg tw-bg-white tw-border tw-border-red-300 tw-text-red-600 tw-font-medium tw-text-xs tw-cursor-pointer hover:tw-bg-red-50 tw-shadow-sm tw-transition-all">
                                                                    <input type="file" accept="image/*" multiple className="tw-hidden" onChange={(e) => addCorrectiveBeforeImages(i, e.target.files)} />
                                                                    <PhotoIcon className="tw-w-4 tw-h-4" />
                                                                    <span>{t("attachPhoto", lang)}</span>
                                                                </label>
                                                            </div>
                                                            {action.beforeImages.length > 0 ? (
                                                                <div className="tw-grid tw-grid-cols-3 tw-gap-2">
                                                                    {action.beforeImages.map((img) => (
                                                                        <div key={img.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-red-200 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                                                                            <img src={img.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                                                                            <button type="button" onClick={() => removeCorrectiveBeforeImage(i, img.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-lg tw-transition-all">
                                                                                <XMarkIcon className="tw-w-3.5 tw-h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="tw-text-center tw-py-6 tw-text-red-500 tw-text-sm tw-font-medium">
                                                                    {lang === "th" ? "⚠️ กรุณาแนบรูปก่อนแก้ไข" : "⚠️ Please attach before image"}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* After Images */}
                                                        <div className="tw-border tw-border-green-200 tw-rounded-xl tw-p-4 tw-bg-green-50/30">
                                                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                                                <span className="tw-text-sm tw-font-semibold tw-text-green-700 tw-flex tw-items-center tw-gap-2">
                                                                    <span className="tw-w-2 tw-h-2 tw-rounded-full tw-bg-green-500"></span>
                                                                    {t("afterPhoto", lang)} <span className="tw-text-red-500">*</span>
                                                                </span>
                                                                <label className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-lg tw-bg-white tw-border tw-border-green-300 tw-text-green-600 tw-font-medium tw-text-xs tw-cursor-pointer hover:tw-bg-green-50 tw-shadow-sm tw-transition-all">
                                                                    <input type="file" accept="image/*" multiple className="tw-hidden" onChange={(e) => addCorrectiveAfterImages(i, e.target.files)} />
                                                                    <PhotoIcon className="tw-w-4 tw-h-4" />
                                                                    <span>{t("attachPhoto", lang)}</span>
                                                                </label>
                                                            </div>
                                                            {action.afterImages.length > 0 ? (
                                                                <div className="tw-grid tw-grid-cols-3 tw-gap-2">
                                                                    {action.afterImages.map((img) => (
                                                                        <div key={img.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-green-200 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                                                                            <img src={img.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                                                                            <button type="button" onClick={() => removeCorrectiveAfterImage(i, img.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-lg tw-transition-all">
                                                                                <XMarkIcon className="tw-w-3.5 tw-h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="tw-text-center tw-py-6 tw-text-green-600 tw-text-sm tw-font-medium">
                                                                    {lang === "th" ? "⚠️ กรุณาแนบรูปหลังแก้ไข" : "⚠️ Please attach after image"}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Text Area */}
                                                    <textarea
                                                        value={action.text}
                                                        onChange={(e) => updateCorrectiveText(i, e.target.value)}
                                                        rows={3}
                                                        placeholder={lang === "th" ? "กรอกรายละเอียดการดำเนินการ..." : "Enter action details..."}
                                                        className="tw-w-full tw-px-3 tw-py-2 tw-border tw-border-gray-300 tw-rounded-lg tw-text-sm tw-bg-white focus:tw-outline-none focus:tw-border-amber-400 tw-transition-colors tw-resize-y"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Preventive Action */}
                            <div className="tw-space-y-3">
                                <div className="tw-flex tw-items-center tw-justify-between">
                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>
                                        {t("preventiveAction", lang)}
                                    </label>
                                    <button type="button" onClick={addPreventiveAction} className="tw-text-sm tw-font-semibold tw-rounded-lg tw-bg-amber-500 tw-text-white tw-px-4 tw-py-2 hover:tw-bg-amber-600 tw-shadow-md hover:tw-shadow-lg tw-transition-all tw-flex tw-items-center tw-gap-1.5">
                                        <span className="tw-text-lg tw-leading-none">+</span> {t("addPreventive", lang)}
                                    </button>
                                </div>
                                <div className="tw-space-y-3">
                                    {job.preventive_action.map((val, i) => (
                                        <div key={i} className="tw-flex tw-items-center tw-gap-3">
                                            <div className="tw-flex-shrink-0 tw-w-8 tw-h-8 tw-rounded-full tw-bg-amber-100 tw-text-amber-600 tw-flex tw-items-center tw-justify-center tw-font-semibold tw-text-sm">
                                                {i + 1}
                                            </div>
                                            <input
                                                type="text"
                                                placeholder={lang === "th" ? "กรอกวิธีป้องกัน..." : "Enter preventive action..."}
                                                value={val}
                                                onChange={(e) => updatePreventiveAction(i, e.target.value)}
                                                className="tw-flex-1 tw-h-10 tw-px-3 tw-border tw-border-gray-300 tw-rounded-lg tw-text-sm tw-bg-white focus:tw-outline-none focus:tw-border-amber-400 tw-transition-colors"
                                            />
                                            {job.preventive_action.length > 1 && (
                                                <button type="button" onClick={() => removePreventiveAction(i)} className="tw-w-10 tw-h-10 tw-rounded-lg tw-text-red-500 hover:tw-text-white hover:tw-bg-red-500 tw-flex tw-items-center tw-justify-center tw-transition-all">
                                                    <XMarkIcon className="tw-w-5 tw-h-5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Repair Result */}
                            <div id="cm-repair-result" className="tw-space-y-3">
                                <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                    <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>
                                    {t("repairResult", lang)} <span className="tw-text-red-500">*</span>
                                </label>
                                <select
                                    value={job.repair_result}
                                    onChange={(e) => setJob(prev => ({ ...prev, repair_result: e.target.value }))}
                                    className="tw-w-full md:tw-w-96 tw-h-12 tw-border tw-border-gray-200 tw-rounded-xl tw-px-4 tw-text-sm tw-font-medium tw-bg-white tw-text-gray-700 hover:tw-border-amber-400 focus:tw-outline-none focus:tw-ring-3 focus:tw-ring-amber-500/20 focus:tw-border-amber-500 tw-transition-all tw-cursor-pointer"
                                >
                                    <option value="">{lang === "th" ? "-- เลือกผลหลังซ่อม --" : "-- Select repair result --"}</option>
                                    {REPAIR_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {lang === "en" ? opt.en : opt.th}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Remarks (Editable) */}
                    <div className="tw-mb-6">
                        <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700 tw-mb-3">
                            <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-gray-400"></span>
                            {t("remarks", lang)}
                        </label>
                        <textarea
                            value={job.inprogress_remarks}
                            onChange={e => setJob({ ...job, inprogress_remarks: e.target.value })}
                            rows={3}
                            placeholder={lang === "th" ? "กรอกหมายเหตุเพิ่มเติม..." : "Enter additional remarks..."}
                            className="tw-w-full tw-px-3 tw-py-2 tw-border tw-border-gray-300 tw-rounded-lg tw-text-sm tw-bg-white focus:tw-outline-none focus:tw-border-gray-400 tw-transition-colors tw-resize-y"
                        />
                    </div>

                    {/* Validation Card */}
                    <div className="tw-mb-6"><CMValidationCard validations={validations} lang={lang} /></div>

                    {/* Actions */}
                    <div className="tw-flex tw-items-center tw-justify-end tw-pt-6 tw-border-t tw-border-gray-200">
                        <Button
                            onClick={onFinalSave}
                            disabled={saving || !canSave}
                            className={`tw-text-white tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-shadow-xl disabled:tw-opacity-50 disabled:tw-cursor-not-allowed disabled:tw-shadow-none tw-transition-all tw-transform hover:tw-scale-[1.02] ${isClosedResult
                                ? "tw-bg-gray-700 hover:tw-bg-red-800 hover:tw-shadow-red-500/30"
                                : "tw-bg-amber-500 hover:tw-bg-amber-600 hover:tw-shadow-amber-500/30"
                                }`}
                        >
                            {saving ? t("saving", lang) : (isClosedResult ? t("closed", lang) : t("save", lang))}
                        </Button>
                    </div>
                </div>
            </form>
        </section>
    );
}