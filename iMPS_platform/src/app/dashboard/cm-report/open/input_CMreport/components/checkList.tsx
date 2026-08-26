"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Button, Input, Textarea, Tooltip } from "@material-tailwind/react";
import Image from "next/image";
import Select from "react-select";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeftIcon, PhotoIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import { draftKey as getDraftKey, saveDraftLocal, loadDraftLocal, clearDraftLocal, type CMDraftData } from "../lib/draft";
import { putPhoto, getPhotosByDraftKey, delPhoto, delPhotosByDraftKey, createPreviewUrl, photoRefToFile, type PhotoRef } from "../lib/draftPhotos";
import { apiFetch } from "@/utils/api";
import { useMaximoFailureTree, failureClassOptions, failureClassRole } from "@/app/dashboard/cm-report/lib/maximo";
import { failureCodeLabel } from "@/app/dashboard/cm-report/lib/failureCode";
import { useReportLock } from "@/app/dashboard/cm-report/lib/lock";
import LoadingOverlay from "@/app/dashboard/components/Loadingoverlay";
import { cmBackRoute } from "@/app/dashboard/cm-report/lib/origin";
import { brandScopeOf, canOpenCmAtStation } from "@/utils/brandScope";
import ChargerIdentity, { type ChargerIdentityData } from "@/app/dashboard/cm-report/components/ChargerIdentity";
import LockBanner from "@/app/dashboard/cm-report/components/LockBanner";
import { ZoomableImg, AttachmentFileRow, isImageAttachment, isVideoAttachment, isAllowedCmAttachment, CM_ACCEPT_ATTACH } from "@/app/dashboard/cm-report/components/photo-viewer";

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
    srNo: { th: "เลขที่ SR", en: "SR No." },
    woNo: { th: "เลขที่ WO", en: "WO No." },
    cmDate: { th: "วันที่แจ้ง", en: "Found Date" },
    location: { th: "สถานที่", en: "Location" },
    reporteed_by: { th: "ผู้แจ้งปัญหา", en: "Reported by" },
    faultyEquipment: { th: "ตำแหน่งจุดที่มีความผิดปกติ", en: "FAILURECODE DESCRIPTION" },
    selectEquipmentPlaceholder: { th: "เลือกตำแหน่ง...", en: "Select location..." },
    loadingChargers: { th: "กำลังโหลด...", en: "Loading..." },
    noChargersFound: { th: "ไม่พบ Charger", en: "No chargers found" },
    damageSymptoms: { th: "อาการชำรุด", en: "Damage Symptoms" },
    damageSymptomsPlaceholder: { th: "เลือกอาการชำรุด (เลือกได้หลายข้อ)...", en: "Select damage symptoms (multiple)..." },
    damageSymptomOther: { th: "ระบุอาการชำรุด (อื่น ๆ)", en: "Specify damage symptom (Other)" },
    damageSymptomOtherPlaceholder: { th: "ระบุอาการที่พบ", en: "Describe the symptom" },
    problemDetails: { th: "รายละเอียดปัญหา", en: "Problem Details" },
    severity: { th: "ความเร่งด่วน", en: "Urgency" },
    severityTooltip: {
        th: "Urgent - สถานีเกิดเหตุฉุกเฉิน สภาพการณ์ผิดมาตรฐาน\nHigh - สถานีไม่สามารถให้บริการได้\nMedium - สถานีให้บริการได้บางส่วน\nLow - ไม่กระทบกับการให้บริการ",
        en: "Urgent - Emergency situation at the station; conditions are out of standard\nHigh - The station cannot provide service\nMedium - The station can provide partial service\nLow - No impact on service",
    },
    severityPlaceholder: { th: "เลือก...", en: "Select..." },
    problemFound: { th: "ปัญหาที่พบ", en: "Problem Found" },
    jobStatus: { th: "สถานะงาน", en: "Job Status" },
    remarks_open: { th: "หมายเหตุ", en: "Remarks" },
    save: { th: "บันทึก", en: "Save" },
    saving: { th: "กำลังบันทึก...", en: "Saving..." },
    assign: { th: "มอบหมาย", en: "Assign" },
    cancelJob: { th: "ยกเลิกงาน", en: "Cancel Job" },
    approve: { th: "อนุมัติ", en: "Approve" },
    approveTitle: { th: "อนุมัติใบงาน", en: "Approve work order" },
    approveConfirmText: { th: "ยืนยันอนุมัติใบงานนี้? จะเดินหน้าเป็น Wait for schedule", en: "Approve this work order? It will move to \"Wait for schedule\"." },
    confirmApprove: { th: "ยืนยันอนุมัติ", en: "Confirm approve" },
    assignTitle: { th: "มอบหมายงาน", en: "Assign work order" },
    assignConfirmText: { th: "ยืนยันมอบหมายงานให้ช่าง? ใบงานจะเข้าสถานะ In Progress", en: "Assign to technician? It will move to In Progress." },
    assignConfirmTextNoSched: { th: "ยืนยันบันทึกใบงาน? จะเข้าสถานะ In Progress (สถานะรอ: วัสดุ/สภาพหน้างาน)", en: "Save this work order? It will move to In Progress (waiting on material/site)." },
    confirmAssign: { th: "ยืนยันมอบหมาย", en: "Confirm assign" },
    saveTitle: { th: "บันทึกใบงาน", en: "Save work order" },
    saveConfirmText: { th: "ยืนยันบันทึกการเปลี่ยนแปลง?", en: "Save changes to this work order?" },
    confirmSaveBtn: { th: "ยืนยันบันทึก", en: "Confirm save" },
    reject: { th: "ตีกลับ", en: "Reject" },
    rejectTitle: { th: "ตีกลับใบงานกลับไปที่ CS", en: "Reject back to CS" },
    rejectReason: { th: "เหตุผลที่ตีกลับ", en: "Reject reason" },
    rejectReasonPlaceholder: { th: "ระบุเหตุผลให้ CS ทราบว่าต้องแก้อะไร", en: "Tell CS what needs fixing" },
    confirmReject: { th: "ยืนยันตีกลับ", en: "Confirm reject" },
    cancelTitle: { th: "ยกเลิกใบงาน", en: "Cancel work order" },
    cancelReason: { th: "เหตุผลที่ยกเลิก", en: "Cancel reason" },
    cancelReasonPlaceholder: { th: "ระบุเหตุผลที่ยกเลิกใบงานนี้", en: "Reason for cancelling this work order" },
    confirmCancel: { th: "ยืนยันยกเลิก", en: "Confirm cancel" },
    rejectedBannerTitle: { th: "ใบงานถูกตีกลับจากผู้วางแผน — กรุณาแก้ไขแล้วบันทึก", en: "Returned by planner — please revise and save" },
    rejectedBy: { th: "โดย", en: "by" },
    planningSection: { th: "การวางแผนงาน", en: "Planning" },
    plannedAt: { th: "วันที่/เวลาที่วางแผน", en: "Planned at" },
    planRound: { th: "วางแผนครั้งที่", en: "Planning round" },
    repairInfoSection: { th: "ข้อมูลที่ช่างบันทึกไว้", en: "Technician's records" },
    riProblem: { th: "ปัญหา", en: "Problem" },
    riCause: { th: "สาเหตุ", en: "Cause" },
    riAction: { th: "การแก้ไข", en: "Corrective action" },
    riEquipment: { th: "อุปกรณ์ที่ซ่อม", en: "Repaired equipment" },
    riRemarks: { th: "หมายเหตุของช่าง", en: "Technician remarks" },
    riBefore: { th: "รูปก่อนแก้ไข", en: "Before" },
    riAfter: { th: "รูปหลังแก้ไข", en: "After" },
    schedStart: { th: "วันที่เริ่มตามแผน", en: "Scheduled Start" },
    schedFinish: { th: "วันที่เสร็จตามแผน", en: "Scheduled Finish" },
    technician: { th: "ช่างผู้รับผิดชอบ", en: "Technician" },
    allTechnicians: { th: "ทั้งหมด", en: "All" },
    noTechnicians: { th: "ไม่พบช่าง", en: "No technicians found" },
    failureCodesLoading: {
        th: "กำลังโหลดรายการจาก Maximo…",
        en: "Loading failure codes from Maximo…",
    },
    waitState: { th: "สถานะรอ", en: "Waiting On" },
    waitRemark: { th: "หมายเหตุ", en: "Remark" },
    waitRemarkPlaceholder: { th: "ระบุรายละเอียด เช่น วัสดุที่รอ / สภาพหน้างาน", en: "e.g. material awaited / site condition" },
    schedRangeError: { th: "วันที่เสร็จต้องอยู่หลังวันที่เริ่ม", en: "Finish must be after start" },
    backToList: { th: "กลับ", en: "Back" },
    alertNoStationId: { th: "ไม่พบ station_id", en: "Station ID not found" },
    alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },
    photos: { th: "รูปภาพ / ไฟล์แนบ", en: "Photos / Files" },
    photosTooltip: {
        th: "รูปที่ควรแนบ\n1. หน้าสถานะ OCPP\n2. รูปหน้าจอเครื่องชาร์จ\n3. รูป Power Meter ค่าแรงดันไฟฟ้า (ที่ MDB)\n4. รูป MDB (ให้เห็นเบรกเกอร์ หลอดไฟสถานะ)",
        en: "Photos to attach\n1. OCPP status screen\n2. Charger display screen\n3. Power Meter voltage reading (at MDB)\n4. MDB (showing breakers and status lights)",
    },
    attachPhoto: { th: "แนบรูป / ไฟล์", en: "Attach Photo / File" },
    noPhotos: { th: "ยังไม่มีไฟล์แนบ", en: "No files attached" },
    photoHint: { th: "รองรับไฟล์ JPG, PNG, PDF, CSV", en: "Supports JPG, PNG, PDF, CSV" },
    formStatus: { th: "สถานะการกรอกข้อมูล", en: "Form Status" },
    allComplete: { th: "กรอกข้อมูลครบถ้วน พร้อมบันทึก ✓", en: "All fields completed. Ready to save ✓" },
    remaining: { th: "ยังขาดอีก", en: "Missing" },
    items: { th: "รายการ", en: "items" },
    validEquipment: { th: "ตำแหน่งจุดที่มีความผิดปกติ", en: "FAILURECODE DESCRIPTION" },
    validDamageSymptoms: { th: "อาการชำรุด", en: "Damage Symptoms" },
    validSeverity: { th: "ความเร่งด่วน", en: "Urgency" },
    validProblemFound: { th: "ปัญหาที่พบ", en: "Problem Found" },
    validPhotos: { th: "รูปภาพ / ไฟล์แนบ", en: "Photos / Files" },
    notFilled: { th: "ยังไม่ได้กรอก", en: "Not filled" },
    notSelected: { th: "ยังไม่ได้เลือก", en: "Not selected" },
    notAttached: { th: "ยังไม่ได้แนบ", en: "Not attached" },
    draftSaved: { th: "บันทึกร่างแล้ว", en: "Draft saved" },
    clearDraft: { th: "ล้างร่าง", en: "Clear draft" },
    // ═══ Maximo ═══
    maximoSrCreated: { th: "สร้าง Maximo SR สำเร็จ", en: "Maximo SR Created" },
    maximoSrFailed: { th: "ไม่สามารถสร้าง Maximo SR (บันทึก CM สำเร็จแล้ว)", en: "Maximo SR not created (CM saved)" },
    maximoWoCreated: { th: "เปิดใบสั่งงานใน Maximo แล้ว เลขที่", en: "Maximo work order created:" },
    maximoWoFailed: {
        th: "บันทึกแผนสำเร็จ แต่เปิดใบสั่งงานใน Maximo ไม่สำเร็จ — สั่งยิงซ้ำได้จากหน้ารายละเอียดใบงาน",
        en: "Plan saved, but the Maximo work order was not created — you can re-sync from the work order page.",
    },
    savedSuccess: { th: "บันทึกสำเร็จ", en: "Saved successfully" },
    redirecting: { th: "กำลังกลับหน้ารายการ...", en: "Redirecting to list..." },
    optional: { th: "(ไม่บังคับ)", en: "(optional)" },
    maxPhotos: { th: "สูงสุด", en: "Max" },
    photosUnit: { th: "ไฟล์", en: "files" },
    photoSavedBadge: { th: "บันทึกแล้ว", en: "Saved" },
    cancelledBannerTitle: { th: "ใบงานถูกยกเลิก", en: "Work order cancelled" },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

// ==================== TYPES ====================
// อาการชำรุดที่ผู้แจ้งเลือกได้ (เลือกได้หลายข้อ) — value เป็นรหัสคงที่ ไม่ใช่ข้อความไทย
// เพื่อให้แก้คำเรียก/เพิ่มภาษาได้ภายหลังโดยข้อมูลเก่าใน DB ไม่เพี้ยน
const DAMAGE_SYMPTOM_OTHER = "other";
const DAMAGE_SYMPTOM_OPTIONS: { value: string; th: string; en: string }[] = [
    { value: "charger", th: "เครื่องชาร์จมีปัญหา", en: "Charger problem" },
    { value: "electrical", th: "ระบบไฟฟ้ามีปัญหา", en: "Electrical system problem" },
    { value: "lighting", th: "ไฟสถานี / ไฟป้ายดับ", en: "Station / sign lighting out" },
    { value: "structure", th: "โครงสร้าง / สีพื้น ชำรุด", en: "Structure / floor paint damaged" },
    { value: DAMAGE_SYMPTOM_OTHER, th: "อื่น ๆ (โปรดระบุ)", en: "Other (please specify)" },
];

// ให้ react-select สูง/มุมโค้งใกล้เคียง <select> อื่นในฟอร์ม และ menu ต้องลอยเหนือ overlay
const damageSelectStyles = {
    control: (base: any, state: any) => ({
        ...base,
        minHeight: 40,
        borderRadius: 8,
        borderColor: state.isFocused ? "#3b82f6" : "#cfd8dc",
        boxShadow: state.isFocused ? "0 0 0 2px rgba(59,130,246,.35)" : "none",
        backgroundColor: state.isDisabled ? "#f3f4f6" : "#fff",
        ":hover": { borderColor: state.isFocused ? "#3b82f6" : "#b0bec5" },
    }),
    valueContainer: (base: any) => ({ ...base, padding: "2px 10px" }),
    placeholder: (base: any) => ({ ...base, fontSize: 14, color: "#90a4ae" }),
    multiValue: (base: any) => ({ ...base, backgroundColor: "#e3f2fd", borderRadius: 6 }),
    multiValueLabel: (base: any) => ({ ...base, fontSize: 13, color: "#1565c0" }),
    option: (base: any) => ({ ...base, fontSize: 14 }),
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
};

type Severity = "" | "Low" | "Medium" | "High" | "Urgent";
type Status = "" | "Open" | "In Progress" | "Wait for approve" | "Wait for schedule" | "Cancelled";

// ช่างที่เลือกได้ในขั้นวางแผน (มาจาก GET /users/by-role?role=technician)
type TechnicianOption = { id: string; username: string; email: string; company?: string };

// สถานะรอที่ planner เลือกได้ตอนวางแผน — ต้องตรงตัวกับ WO_SUBTABS ใน inprogress-table ที่ filter ด้วย string นี้
// ("WO - wait for approve" ไม่อยู่ที่นี่ เพราะเกิดหลังซ่อมเสร็จ ไม่ใช่ตอนวางแผน)
const WAIT_STATES = [
    "WO - wait for scheduled",
    "WO - wait for material",
    "WO - wait for site condition",
] as const;
const DEFAULT_WAIT_STATE = WAIT_STATES[0];

// ข้อมูลที่ช่างกรอกไว้แล้ว (อ่านอย่างเดียว) — แสดงเฉพาะเมื่อมีข้อมูลจริง
type RepairInfo = {
    problem_type: string[];
    problem_type_other: string;
    cause: string[];
    repaired_equipment: string[];
    inprogress_remarks: string;
    corrective_actions: { text: string; beforeImages: { url?: string }[]; afterImages: { url?: string }[] }[];
};

// แผน 1 รอบ — ใบที่ติดรออะไหล่/รอหน้างานแล้วถูกวางแผนใหม่ จะเก็บรอบเดิมไว้ใน plan_history
type PlanRound = {
    planned_date?: string;
    planned_time?: string;
    wait_state?: string;
    wait_remark?: string;
    sched_start?: string;
    sched_finish?: string;
    assignees?: string[];
};

// รองรับข้อมูลเก่า: map ค่าที่เปลี่ยนชื่อแล้ว → ค่าใหม่ (manpower→scheduled, spare part→material, site access→site condition)
const LEGACY_WAIT_STATE_MAP: Record<string, (typeof WAIT_STATES)[number]> = {
    "WO - wait for manpower": "WO - wait for scheduled",
    "WO - wait for spare part": "WO - wait for material",
    "WO - wait for site access": "WO - wait for site condition",
};
const normalizeWaitState = (v: string): (typeof WAIT_STATES)[number] => {
    if ((WAIT_STATES as readonly string[]).includes(v)) return v as (typeof WAIT_STATES)[number];
    return LEGACY_WAIT_STATE_MAP[v] ?? DEFAULT_WAIT_STATE;
};

type ServerPhoto = { filename: string; size: number; url: string; remark?: string; uploadedAt?: string; location?: string; };
// แนบได้ทั้งรูปและไฟล์ (PDF) — mime/name ใช้แยกว่าจะโชว์เป็นรูปหรือการ์ดไฟล์
type PhotoItem = { id: string; file: File; preview: string; ref?: PhotoRef; isServer?: boolean; serverUrl?: string; serverGroup?: string; createdAt?: string; location?: string; mime?: string; name?: string; };
type ChargerInfo = { chargerNo?: number; charger_no?: number | string; charger_id?: string; id?: string; chargeBoxID?: string; charger_name?: string; SN?: string; sn?: string; chargerType?: string; brand?: string; };
type StationPublic = { station_id: string; station_name: string; };
type ValidationItem = { key: string; label: string; isValid: boolean; message: string; isRequired: boolean; scrollId?: string; };

const SEVERITY_OPTIONS: Severity[] = ["", "Low", "Medium", "High", "Urgent"];
const LOGO_SRC = "/img/logo_egat.png";
const LIST_ROUTE = "/dashboard/cm-report";
const MAX_PHOTOS = 10;

// ใช้ตัวแปลง value → label ชุดเดียวกับฟอร์มอื่น จะได้ไม่ต้องดูแลลิสต์ซ้ำหลายที่
import { problemLabelOf, causeLabelOf } from "@/app/dashboard/cm-report/lib/maximo";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function responseErrorMessage(res: Response, fallback: string): Promise<string> {
    const raw = await res.text().catch(() => "");
    try {
        const payload = raw ? JSON.parse(raw) : null;
        const detail = payload?.detail;
        if (typeof detail === "string" && detail.trim()) return detail.trim();
        if (detail !== undefined && detail !== null) return JSON.stringify(detail);
    } catch {
        // The proxy may return HTML/plain text instead of the API JSON error.
    }
    const plain = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return plain ? `${fallback} (HTTP ${res.status}): ${plain.slice(0, 300)}` : `${fallback} (HTTP ${res.status})`;
}

// ==================== VALIDATION CARD ====================
// การ์ดแสดงแผนรอบก่อนหน้า — อ่านอย่างเดียว ใช้ในหน้าวางแผนเมื่อใบถูกวางแผนใหม่หลายรอบ
// ข้อมูลที่ช่างบันทึกไว้ — อ่านอย่างเดียว ใช้ตอน planner กลับมาวางแผนรอบใหม่
// ซ่อนทั้งการ์ดถ้าช่างยังไม่ได้กรอกอะไรเลย และซ่อนเป็นรายหัวข้อถ้าหัวข้อนั้นว่าง
function RepairInfoCard({ info, lang }: { info: RepairInfo; lang: Lang }) {
    const problems = [...info.problem_type.map(problemLabelOf), info.problem_type_other].map(x => (x || "").trim()).filter(Boolean);
    const causes = info.cause.map(x => causeLabelOf((x || "").trim())).filter(Boolean);
    const equipment = info.repaired_equipment.map(x => (x || "").trim()).filter(Boolean);
    const actions = info.corrective_actions.filter(
        a => (a.text || "").trim() || (a.beforeImages?.length ?? 0) > 0 || (a.afterImages?.length ?? 0) > 0
    );
    const remarks = (info.inprogress_remarks || "").trim();

    if (!problems.length && !causes.length && !equipment.length && !actions.length && !remarks) return null;

    const src = (u?: string) => (!u ? "" : u.startsWith("http") ? u : `${API_BASE}${u}`);
    const block = (label: string, body: React.ReactNode) => (
        <div className="tw-mb-3 last:tw-mb-0">
            <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{label}</p>
            {body}
        </div>
    );
    const thumbs = (label: string, imgs: { url?: string }[]) =>
        imgs.length ? (
            <div className="tw-mt-2">
                <p className="tw-text-[11px] tw-text-blue-gray-400 tw-mb-1">{label}</p>
                <div className="tw-flex tw-flex-wrap tw-gap-2">
                    {imgs.map((im, k) => (
                        <a key={k} href={src(im.url)} target="_blank" rel="noreferrer"
                            className="tw-block tw-w-20 tw-h-20 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-blue-gray-50">
                            <ZoomableImg src={src(im.url)} alt={label} className="tw-w-full tw-h-full tw-object-cover" />
                        </a>
                    ))}
                </div>
            </div>
        ) : null;

    return (
        <div className="tw-mb-6 tw-p-5 tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-blue-gray-50/40">
            <h3 className="tw-text-base tw-font-bold tw-text-blue-gray-800 tw-mb-4">{t("repairInfoSection", lang)}</h3>
            {problems.length ? block(t("riProblem", lang),
                <p className="tw-text-sm tw-text-blue-gray-800 tw-break-words">{problems.join(", ")}</p>) : null}
            {causes.length ? block(t("riCause", lang),
                <p className="tw-text-sm tw-text-blue-gray-800 tw-break-words">{causes.join(", ")}</p>) : null}
            {equipment.length ? block(t("riEquipment", lang),
                <p className="tw-text-sm tw-text-blue-gray-800 tw-break-words">{equipment.join(", ")}</p>) : null}
            {actions.length ? block(t("riAction", lang),
                <div className="tw-space-y-3">
                    {actions.map((a, i) => (
                        <div key={i} className="tw-rounded-lg tw-bg-white tw-border tw-border-blue-gray-100 tw-p-3">
                            {(a.text || "").trim() && <p className="tw-text-sm tw-text-blue-gray-800 tw-break-words">{a.text}</p>}
                            {thumbs(t("riBefore", lang), a.beforeImages ?? [])}
                            {thumbs(t("riAfter", lang), a.afterImages ?? [])}
                        </div>
                    ))}
                </div>) : null}
            {remarks ? block(t("riRemarks", lang),
                <p className="tw-text-sm tw-text-blue-gray-800 tw-break-words">{remarks}</p>) : null}
        </div>
    );
}

function PlanRoundCard({ round, index, lang }: { round: PlanRound; index: number; lang: Lang }) {
    const row = (label: string, value?: string) => (
        <div>
            <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{label}</p>
            <p className="tw-text-sm tw-text-blue-gray-800 tw-break-words">{value?.trim() ? value : "-"}</p>
        </div>
    );
    const when = [round.planned_date, round.planned_time].filter(Boolean).join(" ");
    return (
        <div className="tw-mb-4 tw-p-4 tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white">
            <h4 className="tw-text-sm tw-font-bold tw-text-blue-gray-700 tw-mb-3">
                {t("planRound", lang)} {index + 1}
            </h4>
            {/* วันที่ / สถานะรอ / หมายเหตุ อยู่บรรทัดเดียวกัน */}
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-3">
                {row(t("plannedAt", lang), when)}
                {row(t("waitState", lang), round.wait_state)}
                {row(t("waitRemark", lang), round.wait_remark)}
            </div>
            {/* วันเริ่ม/เสร็จ แสดงเฉพาะรอบที่เคยกำหนดตารางไว้ (wait for scheduled) */}
            {(round.sched_start?.trim() || round.sched_finish?.trim()) && (
                <div className="tw-mt-3 tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-3">
                    {row(t("schedStart", lang), round.sched_start?.replace("T", " "))}
                    {row(t("schedFinish", lang), round.sched_finish?.replace("T", " "))}
                </div>
            )}
        </div>
    );
}

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
                            <p className="tw-text-xs tw-text-blue-gray-600 tw-mb-2 tw-font-semibold">💡 {t("remaining", lang)} {t("optional", lang)}</p>
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
                                    {t("issueId", lang)}: <span className="tw-font-mono tw-font-semibold">{issueId}</span>
                                </p>
                            )}
                            {docName && (
                                <p className="tw-text-sm tw-text-green-700">
                                    {t("docName", lang)}: <span className="tw-font-semibold">{docName}</span>
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

    // รูปโชว์เป็นกริดพรีวิวใหญ่ ส่วนไฟล์ (PDF) พรีวิวไม่ได้ → แยกไปเป็นรายการแถวเล็ก ๆ ด้านล่าง
    const images = photos_open.filter(p => isImageAttachment(p.preview, p.mime));
    const files = photos_open.filter(p => !isImageAttachment(p.preview, p.mime));

    return (
        <div id={id} className="tw-space-y-3">
            <input ref={fileInputRef} type="file" accept={CM_ACCEPT_ATTACH} multiple className="tw-hidden" onChange={e => { if (e.target.files) { onAdd(e.target.files); e.target.value = ""; } }} />

            {/* Attach button - always on left */}
            {canAddMore && (
                <div className="tw-flex tw-items-center tw-gap-3">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="tw-inline-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2 tw-rounded-lg tw-border-2 tw-border-blue-600 tw-text-blue-600 tw-font-bold tw-text-sm hover:tw-bg-blue-50 tw-transition-colors">
                        <PhotoIcon className="tw-w-4 tw-h-4" /> {t("attachPhoto", lang)}
                    </button>
                    <span className="tw-text-sm tw-text-blue-gray-500">{t("maxPhotos", lang)} {max} {t("photosUnit", lang)}</span>
                </div>
            )}

            {/* Photo grid */}
            {images.length > 0 && (
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                    {images.map(photo => (
                        <div key={photo.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-200 tw-bg-blue-gray-50 tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                            <ZoomableImg src={photo.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
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
                                <span className="tw-absolute tw-bottom-1 tw-left-1 tw-text-[10px] tw-bg-blue-500 tw-text-white tw-px-1.5 tw-py-0.5 tw-rounded">{t("photoSavedBadge", lang)}</span>
                            )}
                            {/* ลบได้ทั้งรูปที่เพิ่งแนบและรูปที่บันทึกไว้แล้ว — ใบที่ถูกตีกลับต้องเปลี่ยนรูปเดิมได้ */}
                            {!disabled && (
                                <button type="button" onClick={() => onRemove(photo.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-md tw-transition-all">
                                    <XMarkIcon className="tw-w-3.5 tw-h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ไฟล์แนบ (PDF) — รายการแถว ไม่ทำพรีวิวใหญ่เหมือนรูป */}
            {files.length > 0 && (
                <div className="tw-flex tw-flex-wrap tw-gap-2">
                    {files.map(f => (
                        isVideoAttachment(f.preview, f.mime, f.name) ? (
                            <div key={f.id} className="tw-w-64 tw-max-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-p-2">
                                <video
                                    controls
                                    playsInline
                                    preload="metadata"
                                    src={f.preview}
                                    className="tw-w-full tw-rounded-md tw-bg-black"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="tw-mt-1 tw-flex tw-items-center tw-gap-2">
                                    <a
                                        href={f.preview}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="tw-min-w-0 tw-flex-1 tw-truncate tw-text-xs tw-text-blue-gray-700 hover:tw-text-blue-600 hover:tw-underline"
                                        title={f.name || f.file?.name || "Video"}
                                    >
                                        {f.name || f.file?.name || "Video"}
                                    </a>
                                    {!disabled && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onRemove(f.id); }}
                                            className="tw-shrink-0 tw-w-5 tw-h-5 tw-rounded-full tw-text-blue-gray-400 hover:tw-text-white hover:tw-bg-red-500 tw-flex tw-items-center tw-justify-center"
                                            aria-label="Remove video"
                                        >
                                            <XMarkIcon className="tw-w-3 tw-h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <AttachmentFileRow
                                key={f.id}
                                src={f.preview}
                                name={f.name}
                                onRemove={disabled ? undefined : () => onRemove(f.id)}
                            />
                        )
                    ))}
                </div>
            )}

            {photos_open.length === 0 && (
                <p className={`tw-text-sm ${disabled ? "tw-text-blue-gray-400" : "tw-text-blue-gray-500"}`}>{t("noPhotos", lang)}</p>
            )}
        </div>
    );
}


// ==================== MAIN COMPONENT ====================
export default function CMOpenForm() {
    const { lang } = useLanguage();
    // ตัวเลือกอาการชำรุดตามภาษาที่เปิดอยู่ — value คงที่เสมอ เปลี่ยนแค่ข้อความที่แสดง
    const damageSymptomOptions = useMemo(
        () => DAMAGE_SYMPTOM_OPTIONS.map(o => ({ value: o.value, label: o[lang] })),
        [lang],
    );
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const [stationId, setStationId] = useState<string | null>(null);

    // Individual form fields (no longer using job object)
    const [issueId, setIssueId] = useState("");
    const [docName, setDocName] = useState("");
    const [foundDate, setFoundDate] = useState("");
    const [foundTime, setFoundTime] = useState(""); // เวลาแจ้ง (HH:MM)
    const [location, setLocation] = useState("");
    const [problemDetails, setProblemDetails] = useState("");
    const [damageSymptoms, setDamageSymptoms] = useState<string[]>([]);
    const [damageSymptomOther, setDamageSymptomOther] = useState("");
    const [severity, setSeverity] = useState<Severity>("");
    const [status, setStatus] = useState<Status>("");
    // แยกด่านของ "Wait for approve": "cs_approval" (รอ head cs) vs "close_approval" (รอปิดงาน)
    const [stage, setStage] = useState("");
    // modal ยืนยัน/ใส่ comment: reject & cancel = กรอกเหตุผล; approve/assign/save = ยืนยันเฉย ๆ
    type CommentMode = "approve" | "reject" | "cancel" | "assign" | "save";
    const [commentModal, setCommentModal] = useState<{ open: boolean; mode: CommentMode }>({ open: false, mode: "reject" });
    const [commentText, setCommentText] = useState("");
    const openCommentModal = (mode: CommentMode) => { setCommentText(""); setCommentModal({ open: true, mode }); };
    const closeCommentModal = () => setCommentModal((m) => ({ ...m, open: false }));
    // เหตุผลที่ถูกตีกลับ (planner ตีกลับมาให้ CS แก้) — โชว์ให้ CS เห็นว่าต้องแก้อะไร
    const [rejectedInfo, setRejectedInfo] = useState<{ remark: string; by: string }>({ remark: "", by: "" });
    // เหตุผลที่ยกเลิก — โชว์ในหน้ารายละเอียดใบงาน Cancelled
    const [cancelledInfo, setCancelledInfo] = useState<{ remark: string; by: string }>({ remark: "", by: "" });
    const [remarks_open, setRemarksOpen] = useState("");
    // ตำแหน่งจุดที่มีความผิดปกติ (failure class) ย้ายไปให้ช่างเลือกในหน้า In Progress แล้ว
    // คงตัวแปรไว้เพราะ draft ของใบเก่าและ logic ระบุตู้ยังอ่านค่านี้ — ใบที่เปิดใหม่จะส่งค่าว่างไป
    // แล้ว backend เลื่อนการเช็คสิทธิ์ยี่ห้อไปตอนที่ช่างเลือก (ดู _assert_can_open_cm)
    const [faultyEquipment, setFaultyEquipment] = useState("");
    const [selectedChargerNo, setSelectedChargerNo] = useState("");
    const [selectedChargerSn, setSelectedChargerSn] = useState("");
    const [chargerTypeHint, setChargerTypeHint] = useState("");

    // ═══ ขั้นวางแผน (เห็นเฉพาะ role ที่วางแผนได้) ═══
    // ประวัติแผนรอบก่อน ๆ (อ่านอย่างเดียว) — flat fields ด้านล่างคือรอบที่กำลังกรอก
    const [repairInfo, setRepairInfo] = useState<RepairInfo | null>(null);
    const [planHistory, setPlanHistory] = useState<PlanRound[]>([]);
    // วันที่/เวลาที่วางแผน — ประทับตอนเปิดฟอร์มเข้ามาวางแผน (แสดงอย่างเดียว)
    const [plannedDate, setPlannedDate] = useState("");
    const [plannedTime, setPlannedTime] = useState("");
    const [schedStart, setSchedStart] = useState("");
    const [schedFinish, setSchedFinish] = useState("");
    const [assignees, setAssignees] = useState<string[]>([]);   // username ของช่างที่ติ๊กเลือกไว้
    const [waitState, setWaitState] = useState<string>(DEFAULT_WAIT_STATE);
    const [waitRemark, setWaitRemark] = useState<string>(""); // หมายเหตุ สำหรับ material/site condition
    const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
    // planner เปิดเคสเอง แล้วติ๊ก "ปิดใบงาน" — ข้ามการวางแผน แล้วเด้งไปฟอร์ม In Progress หลังบันทึก
    const [selfCloseNew, setSelfCloseNew] = useState(false);

    const [summary, setSummary] = useState("");
    const [reported_by, setReportedBy] = useState("");
    const [reporterSignature, setReporterSignature] = useState("");
    const [currentUsername, setCurrentUsername] = useState("");
    const [userRole, setUserRole] = useState("");
    const [currentCompany, setCurrentCompany] = useState("");
    const [saving, setSaving] = useState(false);
    const [chargers, setChargers] = useState<ChargerInfo[]>([]);
    // ตัวตนของตู้ตามที่ backend resolve มาให้ตอนเปิดใบเดิม (ใบใหม่ยังไม่มี → derive จาก chargers)
    const [loadedCharger, setLoadedCharger] = useState<ChargerIdentityData | null>(null);
    // ตาราง failure code จาก Maximo (IN04) — เป็นเจ้าของว่ามีอุปกรณ์/ปัญหาอะไรเลือกได้บ้าง
    const maximoTree = useMaximoFailureTree();
    const [loadingChargers, setLoadingChargers] = useState(false);
    const [photos_open, setPhotosOpen] = useState<PhotoItem[]>([]);
    const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
    const [draftLoaded, setDraftLoaded] = useState(false);
    const [uploadState, setUploadState] = useState({ show: false, total: 0, completed: 0 });

    const [overlayText, setOverlayText] = useState("");

    // ═══ Maximo state ═══
    const [maximoTicketId, setMaximoTicketId] = useState<string | null>(null);
    // เลขใบสั่งงานจริงฝั่ง Maximo (IN01) — ได้ตอนวางแผนเสร็จ ต่างจาก srWoNo ที่เป็นเลขของ iMPS เอง
    const [maximoWonum, setMaximoWonum] = useState<string>("");
    const [showSuccessBanner, setShowSuccessBanner] = useState(false);

    const editId = searchParams.get("edit_id") ?? "";
    // เปิดจากตาราง In Progress ของใบที่ติดรออะไหล่/รอหน้างาน = มาวางแผนรอบใหม่
    // แผนรอบเดิมจะถูกดันลง planHistory แล้วให้กรอกรอบใหม่ในช่องเดิม
    const isRePlan = searchParams.get("planning") === "1";
    const isEdit = !!editId;
    // คนเปิดใบงาน (reported_by) แก้ไขใบงานที่ยัง Open ได้ — คนอื่นเห็นแบบอ่านอย่างเดียว
    const isOwner = isEdit && !!currentUsername.trim() && currentUsername.trim() === reported_by.trim();
    // planner (อนุมัติ SR/วางแผน) ไม่มีสิทธิแก้ field ใบงานที่ตัวเองไม่ได้แจ้ง
    // (planner แก้ได้เฉพาะส่วนการวางแผน ซึ่งอยู่นอก fieldsLocked) — กันเคส impersonate ที่ isOwner เพี้ยนด้วย
    const isPlanner = userRole.trim().toLowerCase() === "planner";
    const isCs = userRole.trim().toLowerCase() === "cs";
    // ช่างเปิดใบงานเองได้ และไม่ต้องผ่านด่านอนุมัติ/วางแผน — เข้าไปกรอกผลต่อได้ทันที
    const isTechnician = userRole.trim().toLowerCase() === "technician";
    const isCancelled = status.trim().toLowerCase() === "cancelled";

    // ── ด่านของใบงาน (ใช้คุมสิทธิ์แก้ไข/วางแผน + ปุ่มตีกลับ) ──
    const roleLower = userRole.trim().toLowerCase();
    const statusLower = isCancelled ? "cancelled" : String(status).trim().toLowerCase();
    const stageLower = String(stage).trim().toLowerCase();
    // ด่าน cs: เปิดใหม่รอ head cs อนุมัติ (Open เก่า/auto หรือ Wait for approve + cs_approval)
    const isCsStage = statusLower === "open" || (statusLower === "wait for approve" && stageLower === "cs_approval");
    // ด่านวางแผน: head cs อนุมัติแล้ว รอ planner วางแผน
    const isPlanningStage = statusLower === "wait for schedule";
    const selectPlannerHandling = async (mode: "schedule" | "self_close") => {
        if (mode === "schedule") return;
        // ขึ้น overlay ตั้งแต่ติ๊ก แล้วปล่อยค้างไว้จนสลับฟอร์มเสร็จ — กันหน้ากระพริบตอน remount
        setOverlayText(lang === "th" ? "กำลังเปิดฟอร์ม..." : "Opening form...");
        // ฟอร์ม In Progress เปิดให้ planner กรอกผลเองได้เฉพาะใบที่อยู่สถานะ Wait for schedule
        // ใบที่ยังค้างด่าน cs ต้องดันสถานะให้ก่อน ไม่งั้นจะเปิดไปเจอโหมดดูอย่างเดียว
        if (isEdit && editId && !isPlanningStage) {
            try {
                const res = await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ station_id: stationId, status: "Wait for schedule", job: { stage: "" } }),
                });
                if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);
            } catch (e: any) {
                setOverlayText("");
                alert(e?.message || "Error");
                return;
            }
        }
        // ไม่เคลียร์ overlay ตรงนี้ — ปล่อยให้คลุมจังหวะสลับไปฟอร์ม In Progress กันหน้ากระพริบ
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", "form");
        params.set("self_close", "1");
        params.delete("planning");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };
    // ใบที่รอ head cs อนุมัติจริง ๆ (ยังไม่ถูกตีกลับ) — ใช้คุมปุ่มอนุมัติ/ตีกลับของ head cs
    const isCsPending = statusLower === "wait for approve" && stageLower === "cs_approval";
    // ใบที่ถูกตีกลับแล้ว (มี reject_remark) = รอ cs ผู้เปิดแก้ไขก่อน ยังไม่ใช่คิวของ planner
    const isReturnedToCs = isCsStage && !!rejectedInfo.remark;

    // ติ๊ก "ปิดใบงาน" ได้เสมอสำหรับ planner — ทุกด่าน/ทุกสถานะ ยกเว้นใบที่ถูกยกเลิก
    const showPlannerHandlingChoice = isPlanner && !isCancelled;


    // คนเปิดใบงานแก้ข้อมูลได้ระหว่างใบยังอยู่ด่าน cs — รวม cs ที่ถูก planner ตีกลับมาให้แก้
    // (planner แก้ได้เฉพาะส่วนวางแผน ซึ่งอยู่นอก fieldsLocked)
    const canEditFields = isOwner && !isPlanner && (!isCs || isCsStage);

    // ขั้นวางแผน: planner วางแผนตาม flow, admin/owner คุมภาพรวม — cs เปิดใบงานอย่างเดียว วางแผนไม่ได้
    // เห็นทั้งตอนเปิดใบใหม่และตอนเปิดใบเดิม (เปิดงาน + วางแผน รวดเดียวได้)
    // ใบที่ตีกลับให้ cs แก้ = ยังวางแผน/Assign ไม่ได้ จนกว่า cs จะแก้แล้วบันทึกกลับเข้าคิว
    // ติ๊กปิดใบงานบนใบใหม่ = ไม่ต้องวางแผนคนเข้า จึงซ่อนส่วนวางแผนทั้งบล็อก
    const canPlanByRole = !isCancelled && !isReturnedToCs && !(selfCloseNew && !isEdit) && ["admin", "owner", "planner"].includes(roleLower);

    // ล็อกกันกรอกชนกัน — ล็อกตัวเดียวกับฟอร์ม In Progress (ใบเดียวกัน = คิวเดียวกัน)
    // จองสิทธิ์เฉพาะคนที่กรอก/วางแผนได้จริงบนใบที่มีอยู่แล้ว ใบเปิดใหม่ยังไม่มี id ให้ล็อก
    const { lockedBy } = useReportLock(
        editId, stationId ?? "", isEdit && !isCancelled && (canEditFields || canPlanByRole),
    );
    const fieldsLocked = isEdit && (!canEditFields || isCancelled || !!lockedBy);
    // คนที่ถูกล็อกยังเห็นส่วนวางแผนได้ตามปกติ (ช่องกรอกถูกปิดด้วย fieldset ในบล็อกนั้น)
    // — ซ่อนทั้งบล็อกจะกลายเป็น "ดูก็ไม่ได้" ซึ่งไม่ใช่สิ่งที่ต้องการ
    const canPlan = canPlanByRole;
    // แสดง Waiting On ครบทุกตัวเลือกเสมอ แม้สถานะนั้นจะเคยถูกเลือกในรอบก่อนแล้ว
    const waitStateOptions = WAIT_STATES;

    // assignees = username ที่ติ๊กไว้ — กรอง "" กันค่าเก่าจาก draft/ใบเดิมที่เคยเก็บแถวว่างไว้
    const pickedAssignees = useMemo(() => assignees.filter(Boolean), [assignees]);
    // มีการกรอกแผนไว้บ้างหรือยัง — ใช้ตัดสินว่าต้องบันทึกแผนต่อจากการเปิดใบไหม
    const hasPlanInput = !!schedStart || !!schedFinish || pickedAssignees.length > 0;

    const technicianNames = useMemo(() => technicians.map(x => x.username).filter(Boolean), [technicians]);
    const allTechniciansPicked = technicianNames.length > 0 && technicianNames.every(u => pickedAssignees.includes(u));
    const toggleAssignee = (username: string) =>
        setAssignees(prev => prev.includes(username) ? prev.filter(u => u !== username) : [...prev.filter(Boolean), username]);
    // ติ๊ก All = เลือกช่างทุกคนในลิสต์, ติ๊กออก = ล้างทั้งหมด
    const toggleAllAssignees = () => setAssignees(allTechniciansPicked ? [] : technicianNames);
    // finish ต้องอยู่หลัง start เสมอ
    const schedRangeInvalid = !!schedStart && !!schedFinish && schedFinish <= schedStart;
    // "wait for scheduled" = ต้องกำหนดวันเริ่ม/เสร็จ + ช่าง | material/site condition = รอของ/รอหน้างาน ยังกำหนดไม่ได้ → กรอกแค่สถานะรอ กดบันทึกได้เลย
    const needsSchedule = waitState === "WO - wait for scheduled";
    // ต้องติ๊กช่างอย่างน้อย 1 คน — เฉพาะเมื่อ needsSchedule
    // สถานะรอที่ไม่ใช่ scheduled ต้องบอกเหตุผล — ฟอร์มผลการซ่อมบังคับหมายเหตุของสองสถานะนี้อยู่แล้ว
    // ถ้าด่านวางแผนปล่อยว่างได้ ใบจะไปค้างอยู่ In Progress โดยไม่มีใครรู้ว่ารออะไร
    const canSubmitPlan = needsSchedule
        ? (!!schedStart && !!schedFinish && pickedAssignees.length > 0 && !schedRangeInvalid)
        : !!waitRemark.trim();
    // บริษัทที่ดูแลเฉพาะบางยี่ห้อ (เช่น EDS = FlexxFast) เปิดใบงานได้เฉพาะสถานีของยี่ห้อนั้น
    // backend เป็นคนบังคับจริง — ตรงนี้บอกล่วงหน้าไม่ให้กรอกจนจบแล้วเพิ่งโดนปฏิเสธ
    const brandScope = useMemo(() => brandScopeOf(userRole, currentCompany), [userRole, currentCompany]);
    // รอโหลดรายการตู้ให้เสร็จก่อนค่อยตัดสิน ไม่งั้นจะขึ้นแบนเนอร์แว้บนึงทุกครั้งที่เปิดหน้า
    const brandBlocked = !!brandScope && !loadingChargers && !canOpenCmAtStation(chargers, brandScope);

    const draftKey = useMemo(() => getDraftKey(stationId), [stationId]);
    const STATUS_OPTIONS: Status[] = ["Open", "In Progress"];

    const canCancelRole = ["admin", "owner", "planner"].includes(roleLower);
    const canRejectRole = ["admin", "planner"].includes(roleLower);
    // ยกเลิกได้เฉพาะ admin/planner ตอนรีวิวหรือวางแผน — cs มีหน้าที่เปิดใบงานเท่านั้น
    // ใบที่ตีกลับให้ cs แก้ = ยังไม่ใช่คิวของ planner จึงยกเลิกไม่ได้จนกว่า cs จะแก้กลับมา
    const showCancelBtn = isEdit && canCancelRole && (isCsStage || isPlanningStage) && !isReturnedToCs;
    const showRejectBtn = isEdit && canRejectRole && isPlanningStage;
    // planner (หรือ admin) ตีกลับ SR ด่าน cs ได้ — ไม่มีปุ่มอนุมัติแล้ว (planner วางแผน/Assign SR ได้เลย)
    // ใบที่ถูกตีกลับแล้ว (มี reject_remark) = รอ cs ผู้เปิดแก้ → กดตีกลับซ้ำไม่ได้จนกว่า cs จะบันทึกกลับ
    const canCsApprove = ["admin", "planner"].includes(roleLower);
    const showCsRejectBtn = isEdit && canCsApprove && isCsPending && !isReturnedToCs;

    // เลขที่งาน — ก่อนอนุมัติเป็น SR (Service Request), หลังอนุมัติ (Wait for schedule ขึ้นไป) เป็น WO (Work Order)
    // อิงเลขลำดับเดียวกับ issue_id (CM-001 → SR001 / WO001)
    const isWoStage = isPlanningStage; // หลังอนุมัติและวางแผนแล้ว = แสดงเลขใบสั่งงาน (WO)
    const issueSequence = useMemo(() => {
        const m = String(issueId || "").match(/(\d+)/);
        if (!m) return "";
        return m[1].padStart(3, "0");
    }, [issueId]);
    const srNo = issueSequence ? `SR${issueSequence}` : "";
    const woNo = issueSequence ? `WO${issueSequence}` : "";
    const srWoNo = isWoStage ? woNo : srNo;

    // ใบใหม่เริ่มที่ "Wait for approve" (รอ head cs อนุมัติ) — ตรงกับที่ backend /submit บันทึก
    useEffect(() => { if (!isEdit && !status) setStatus("Wait for approve"); }, [isEdit, status]);
    const headerLabel = useMemo(() => (isEdit ? t("headerEdit", lang) : t("headerAdd", lang)), [isEdit, lang]);

    // ชนิดของตู้ที่กดการ์ดเข้ามา — ยึดข้อมูลจริงใน DB ก่อน (match ด้วย SN/เลขตู้ แบบเดียวกับ
    // chargerTargets ด้านล่าง) ถ้ารายการตู้ยังไม่มา/หาไม่เจอค่อยใช้ค่าที่หน้า Stations ฝากไว้
    // คืน "" = เข้าแบบระดับสถานี (เช่นมาจาก CM Dashboard) → ไม่จำกัดชนิดตู้
    const pinnedChargerType = useMemo(() => {
        const no = selectedChargerNo.trim().toLowerCase();
        const sn = selectedChargerSn.trim().toLowerCase();
        if (!no && !sn) return "";
        const found = chargers.find(charger => {
            const cno = String(charger.chargerNo ?? charger.charger_no ?? charger.charger_id ?? "").trim().toLowerCase();
            const csn = String(charger.SN || charger.sn || "").trim().toLowerCase();
            return no && sn ? cno === no && csn === sn : cno === no || csn === sn;
        });
        const type = ((found?.chargerType || "").trim().toUpperCase()) || chargerTypeHint;
        return type === "DC" || type === "AC" ? type : "";
    }, [chargers, selectedChargerNo, selectedChargerSn, chargerTypeHint]);

    // FAILURECODE options — รายการมาจาก Maximo (IN04)
    // • เข้ามาจากการ์ดตู้ชาร์จ → เห็นเฉพาะ failure class ของชนิดตู้นั้น (การ์ด AC ไม่ต้องเห็น DC Charger Failure)
    // • เข้าแบบระดับสถานี → กรองตามชนิดตู้ที่สถานีนี้มีจริงเหมือนเดิม
    //   (สถานีที่ยังไม่มีข้อมูลตู้ ถือว่าเป็น DC ไว้ก่อน)
    const hasDC = pinnedChargerType
        ? pinnedChargerType === "DC"
        : (chargers.length === 0 || chargers.some(c => (c.chargerType || "DC").toUpperCase() === "DC"));
    const hasAC = pinnedChargerType
        ? pinnedChargerType === "AC"
        : chargers.some(c => (c.chargerType || "").toUpperCase() === "AC");
    const failureCodeOptions = useMemo(
        () => failureClassOptions(maximoTree, { hasDC, hasAC }) ?? [],
        [maximoTree, hasDC, hasAC],
    );
    // ตารางยังโหลดไม่เสร็จ หรือ backend ยังไม่เคย sync จาก Maximo — บอกให้รู้
    // แทนที่จะปล่อย dropdown ว่างเปล่าโดยไม่มีคำอธิบาย
    const failureCodesUnavailable = failureCodeOptions.length === 0;

    // ใบใหม่: ค่าที่ค้างมาจาก draft อาจเป็น failure class ของตู้คนละชนิดกับการ์ดที่กดเข้ามา
    // ต้องล้างทิ้ง ไม่งั้นเปิดใบ DC บนตู้ AC ได้ผ่านค่าเก่าที่ dropdown ไม่ได้แสดงแล้ว
    // (edit mode ห้ามแตะ — ต้องคงข้อมูลใบเดิมไว้)
    useEffect(() => {
        if (isEdit || !pinnedChargerType || !faultyEquipment) return;
        const role = failureClassRole(maximoTree, faultyEquipment);
        if ((role === "dc" || role === "ac") && role !== pinnedChargerType.toLowerCase()) {
            setFaultyEquipment("");
        }
    }, [isEdit, pinnedChargerType, faultyEquipment, maximoTree]);

    // เลือก failure class ระดับ Charger แล้วต้องเปิดใบแยกตามตู้ที่เป็นชนิดเดียวกัน
    // เช่น DCCHARGER → 1 ใบต่อ DC charger, ACCHARGER → 1 ใบต่อ AC charger
    const chargerTargets = useMemo(() => {
        if (isEdit) return [] as ChargerInfo[];
        const role = failureClassRole(maximoTree, faultyEquipment);
        if (role !== "dc" && role !== "ac") return [] as ChargerInfo[];
        const chargerType = role === "dc" ? "DC" : "AC";
        const typedChargers = chargers.filter(charger =>
            (charger.chargerType || "DC").trim().toUpperCase() === chargerType
        );
        const selectedNo = selectedChargerNo.trim().toLowerCase();
        const selectedSn = selectedChargerSn.trim().toLowerCase();
        if (!selectedNo && !selectedSn) return typedChargers;
        return typedChargers.filter(charger => {
            const no = String(charger.chargerNo ?? charger.charger_no ?? charger.charger_id ?? "").trim().toLowerCase();
            const sn = String(charger.SN || charger.sn || "").trim().toLowerCase();
            return selectedNo && selectedSn
                ? no === selectedNo && sn === selectedSn
                : no === selectedNo || sn === selectedSn;
        });
    }, [chargers, faultyEquipment, isEdit, maximoTree, selectedChargerNo, selectedChargerSn]);

    // ใบใหม่ที่เลือก failure ระดับ charger จะแสดงข้อมูลตู้ที่จะถูกสร้างใบงานให้ทันที
    const chargerIdentityItems = useMemo<ChargerIdentityData[]>(() => {
        if (loadedCharger && (
            loadedCharger.chargeBoxID || loadedCharger.charger_name || loadedCharger.charger_sn ||
            loadedCharger.charger_brand || loadedCharger.charger_no != null
        )) {
            return [loadedCharger];
        }
        if (!chargers.length) return [];

        const toIdentity = (charger: ChargerInfo): ChargerIdentityData => ({
            chargeBoxID: (charger.chargeBoxID || "").trim(),
            charger_name: (charger.charger_name || "").trim(),
            charger_no: charger.chargerNo ?? charger.charger_no ?? null,
            charger_sn: (charger.SN || charger.sn || "").trim(),
            charger_brand: (charger.brand || "").trim(),
        });
        const selectedNo = selectedChargerNo.trim().toLowerCase();
        const selectedSn = selectedChargerSn.trim().toLowerCase();
        const selected = selectedNo || selectedSn
            ? chargers.find(charger => {
                const no = String(charger.chargerNo ?? charger.charger_no ?? charger.charger_id ?? charger.id ?? "").trim().toLowerCase();
                const sn = String(charger.SN || charger.sn || "").trim().toLowerCase();
                return selectedNo && selectedSn ? no === selectedNo && sn === selectedSn : no === selectedNo || sn === selectedSn;
            })
            : undefined;
        const key = faultyEquipment.trim().toLowerCase();
        const matched = chargers.find(charger => {
            const no = charger.chargerNo ?? charger.charger_no;
            return [no, charger.charger_id, charger.id].some(value =>
                value != null && value !== "" && `charger_${String(value).trim().toLowerCase()}` === key
            );
        });
        const failureRole = failureClassRole(maximoTree, faultyEquipment);
        const targets = selected
            ? [selected]
            : chargerTargets.length > 0
                ? chargerTargets
                : matched
                    ? [matched]
                    : [];
        if (failureRole === "dc" || failureRole === "ac") {
            return targets.map(toIdentity);
        }
        if (matched) return [toIdentity(matched)];
        const brands = Array.from(new Set(chargers.map(c => (c.brand || "").trim()).filter(Boolean)));
        return brands.length === 1 ? [{ charger_brand: brands[0] }] : [];
    }, [chargers, chargerTargets, faultyEquipment, loadedCharger, maximoTree, selectedChargerNo, selectedChargerSn]);

    // ==================== VALIDATION ====================
    const validations = useMemo<ValidationItem[]>(() => [
        { key: "damageSymptoms", label: t("validDamageSymptoms", lang), isValid: damageSymptoms.length > 0, message: t("notSelected", lang), isRequired: true, scrollId: "cm-damage-symptoms" },
        { key: "damageSymptomOther", label: t("damageSymptomOther", lang), isValid: !!damageSymptomOther.trim(), message: t("notFilled", lang), isRequired: damageSymptoms.includes(DAMAGE_SYMPTOM_OTHER), scrollId: "cm-damage-symptoms" },
        { key: "severity", label: t("validSeverity", lang), isValid: !!severity, message: t("notSelected", lang), isRequired: true, scrollId: "cm-severity" },
        { key: "problemFound", label: t("validProblemFound", lang), isValid: !!problemDetails.trim(), message: t("notFilled", lang), isRequired: true, scrollId: "cm-problem-found" },
        { key: "photos", label: t("validPhotos", lang), isValid: photos_open.length > 0, message: t("notAttached", lang), isRequired: true, scrollId: "cm-photos" },
    ], [damageSymptoms, damageSymptomOther, severity, problemDetails, photos_open, lang]);
    // มีคนถือสิทธิ์กรอกอยู่ = กดบันทึกไม่ได้ (backend ตอบ 409 อยู่แล้ว ปิดปุ่มไว้ก่อนจะได้ไม่เสียเที่ยว)
    const canSave = useMemo(
        () => !lockedBy && validations.filter(v => v.isRequired).every(v => v.isValid),
        [validations, lockedBy],
    );

    // ==================== HELPERS ====================
    const localTodayFormatted = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };
    const localTodayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const localNowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
    const displayToISO = (s: string) => { if (!s) return localTodayISO(); const p = s.split("/"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : localTodayISO(); };

    // ใบเปิดใหม่ไม่มีขั้นโหลดจาก server จึงประทับตอนเข้าหน้าเลย
    // เก็บใน state ก่อน แล้วค่อยบันทึกลง DB พร้อมแผน — แค่เปิดดูไม่ควรเขียนข้อมูล
    useEffect(() => {
        if (isEdit || plannedDate) return;
        setPlannedDate(localTodayISO());
        setPlannedTime(localNowHHMM());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEdit, plannedDate]);
    const isoToDisplay = (s: string) => { if (!s) return localTodayFormatted(); const p = s.slice(0, 10).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : localTodayFormatted(); };

    // หา current tab จาก URL
    const currentTab = searchParams.get("tab") ?? "open";

    // ปลายทางหลังจบ action ทุกแบบ (บันทึก/Assign/ตีกลับ/ยกเลิก/ย้อนกลับ)
    // — เข้ามาจากหน้าไหนก็กลับหน้านั้น: จาก CM Dashboard → dashboard, จากตาราง list → แท็บที่เกี่ยวข้อง
    const buildListUrl = (targetTab?: string) => {
        const backRoute = cmBackRoute(searchParams);
        if (backRoute) return backRoute;
        const p = new URLSearchParams();
        if (stationId) p.set("station_id", stationId);
        p.set("tab", targetTab ?? currentTab);
        // ไม่ใส่ view และ edit_id เพื่อกลับไปหน้า list
        return `${LIST_ROUTE}?${p.toString()}`;
    };

    const goBackToList = () => router.push(buildListUrl(currentTab));

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
    useEffect(() => { if (!fieldsLocked) getGpsCached(); }, [fieldsLocked, getGpsCached]);

    const handleAddPhotos = useCallback(async (files: FileList) => {
        const remain = MAX_PHOTOS - photos_open.length;
        const selectedFiles = Array.from(files);
        const allowedFiles = selectedFiles.filter(file => isAllowedCmAttachment(file.name));
        if (allowedFiles.length !== selectedFiles.length) {
            alert(lang === "th"
                ? "รองรับเฉพาะไฟล์เอกสาร รูปภาพ และวิดีโอตามนามสกุลที่กำหนด"
                : "Only the specified document, image, and video extensions are allowed");
        }
        if (remain <= 0 || allowedFiles.length > remain) {
            alert(lang === "th"
                ? `แนบได้สูงสุด ${MAX_PHOTOS} ไฟล์ (เพิ่มได้อีก ${Math.max(0, remain)} ไฟล์)`
                : `Maximum ${MAX_PHOTOS} files (${Math.max(0, remain)} remaining)`);
        }
        if (remain <= 0 || allowedFiles.length === 0) return;
        const filesToAdd = allowedFiles.slice(0, remain);

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
                return { id: photoId, file, preview: URL.createObjectURL(file), ref, createdAt: now, location: cachedLoc, mime: file.type, name: file.name };
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
    }, [photos_open.length, draftKey, isEdit, getGpsCached, lang]);

    const handleRemovePhoto = useCallback(async (id: string) => {
        const target = photos_open.find(p => p.id === id);
        // รูปที่บันทึกไว้แล้วต้องลบที่ server ด้วย ไม่งั้นกลับมาเปิดใบใหม่ก็ยังเห็นรูปเดิม
        if (target?.isServer) {
            if (!editId || !stationId || !target.serverUrl) return;
            const q = new URLSearchParams({
                station_id: stationId,
                group: target.serverGroup || "cm_photos",
                url: target.serverUrl,
                phase: "problem",
            });
            try {
                const res = await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}/photos?${q.toString()}`, {
                    method: "DELETE",
                    credentials: "include",
                });
                if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any).detail || `HTTP ${res.status}`);
            } catch (e: any) {
                alert(`${t("alertSaveFailed", lang)} ${e.message || e}`);
                return;
            }
        } else {
            await delPhoto(id);
        }
        setPhotosOpen(prev => { const p = prev.find(x => x.id === id); if (p && !p.isServer && p.preview) URL.revokeObjectURL(p.preview); return prev.filter(x => x.id !== id); });
    }, [photos_open, editId, stationId, lang]);

    useEffect(() => { return () => { photos_open.forEach(p => { if (p.preview) URL.revokeObjectURL(p.preview); }); }; }, []);

    // ==================== DRAFT: AUTO-SAVE ====================
    useEffect(() => {
        if (isEdit || !stationId || !draftLoaded) return;
        const timer = setTimeout(() => {
            setDraftStatus("saving");
            saveDraftLocal(draftKey, {
                issueId, docName, foundDate, foundTime, location, problemDetails,
                severity, status, remarks_open, faultyEquipment,
                damageSymptoms, damageSymptomOther,
                reported_by,
            });
            setTimeout(() => setDraftStatus("saved"), 300);
            setTimeout(() => setDraftStatus("idle"), 2000);
        }, 1500);
        return () => clearTimeout(timer);
    }, [issueId, docName, foundDate, foundTime, location, problemDetails, severity, status, remarks_open, faultyEquipment, damageSymptoms, damageSymptomOther, reported_by, draftKey, isEdit, stationId, draftLoaded]);

    // ==================== DRAFT: LOAD ====================
    useEffect(() => {
        if (isEdit || !stationId) return;
        const draft = loadDraftLocal<any>(draftKey);
        if (draft) {
            if (draft.issueId) setIssueId(draft.issueId);
            if (draft.docName) setDocName(draft.docName);
            if (draft.foundDate) setFoundDate(draft.foundDate);
            if (draft.foundTime) setFoundTime(draft.foundTime);
            if (draft.location) setLocation(draft.location);
            if (draft.problemDetails) setProblemDetails(draft.problemDetails);
            if (draft.severity) setSeverity(draft.severity as Severity);
            if (draft.status) setStatus(draft.status as Status);
            if (draft.remarks_open) setRemarksOpen(draft.remarks_open);
            if (draft.faultyEquipment) setFaultyEquipment(draft.faultyEquipment);
            if (Array.isArray(draft.damageSymptoms)) setDamageSymptoms(draft.damageSymptoms);
            if (draft.damageSymptomOther) setDamageSymptomOther(draft.damageSymptomOther);
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
    useEffect(() => {
        const sid = searchParams.get("station_id") || localStorage.getItem("selected_station_id");
        const selectedNo = searchParams.get("charger_no") || localStorage.getItem("selected_charger_no") || "";
        const selectedSn = searchParams.get("sn") || localStorage.getItem("selected_sn") || "";
        if (sid) { setStationId(sid); localStorage.setItem("selected_station_id", sid); }
        setSelectedChargerNo(selectedNo);
        setSelectedChargerSn(selectedSn);
        // ชนิดตู้ที่หน้า Stations ฝากไว้ตอนกดการ์ด — ใช้เป็นตัวสำรองระหว่างที่รายการตู้ยังโหลดไม่เสร็จ
        setChargerTypeHint((localStorage.getItem("selected_chargerType") || "").trim().toUpperCase());
    }, [searchParams]);

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
        let alive = true;
        (async () => { try { const res = await apiFetch(`${API_BASE}/me`, { credentials: "include" }); if (res.ok) { const data = await res.json(); if (alive) { setCurrentUsername(data.username || ""); setUserRole(data.role || ""); setCurrentCompany(data.company || ""); if (!isEdit && !reported_by) setReportedBy(data.username || ""); } } } catch { } })();
        return () => { alive = false; };
    }, [isEdit]);

    // รายชื่อช่างสำหรับ dropdown ขั้นวางแผน — endpoint นี้ 403 ถ้า role วางแผนไม่ได้ จึงยิงเฉพาะตอน canPlan
    useEffect(() => {
        if (!canPlan) return;
        let alive = true;
        (async () => {
            try {
                const res = await apiFetch(`${API_BASE}/users/by-role?role=technician`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    if (alive) {
                        const users: TechnicianOption[] = Array.isArray(data.users) ? data.users : [];
                        const plannerCompany = currentCompany.trim().toLowerCase();
                        setTechnicians(
                            userRole.trim().toLowerCase() === "planner"
                                ? users.filter((user) => plannerCompany && (user.company || "").trim().toLowerCase() === plannerCompany)
                                : users,
                        );
                    }
                }
            } catch { if (alive) setTechnicians([]); }
        })();
        return () => { alive = false; };
    }, [canPlan, currentCompany, userRole]);

    useEffect(() => {
        if (isEdit || !stationId) return; let alive = true;
        setFoundTime(prev => prev || localNowHHMM()); // เวลาแจ้ง = ตอนเปิดฟอร์ม (ถ้าไม่มีค่าจาก draft)
        (async () => { try { const res = await apiFetch(`${API_BASE}/cmreport/preview-docname?station_id=${encodeURIComponent(stationId)}&found_date=${localTodayISO()}`, { credentials: "include" }); if (res.ok) { const data = await res.json(); if (alive) { setFoundDate(localTodayFormatted()); setIssueId(data.issue_id || ""); setDocName(data.doc_name || ""); } } else if (alive) setFoundDate(localTodayFormatted()); } catch { if (alive) setFoundDate(localTodayFormatted()); } })();
        return () => { alive = false; };
    }, [stationId, isEdit]);

    useEffect(() => {
        if (!editId || !stationId) return;
        console.log("[Edit] Loading report:", editId, "station:", stationId);
        (async () => {
            try {
                const res = await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}?station_id=${encodeURIComponent(stationId)}`, {
                    credentials: "include",
                    cache: "no-store",
                });
                if (!res.ok) {
                    console.log("[Edit] Response not OK:", res.status);
                    return;
                }
                const data = await res.json();
                console.log("[Edit] Data received:", data);

                // "Wait for approve" มี 2 ด่าน — ฟอร์มนี้ใช้ได้เฉพาะด่าน cs (cs_approval)
                // ด่านปิดงาน (close_approval = ช่างกรอกผล "แก้ไขสำเร็จ" แล้วรออนุมัติ) ต้องไปฟอร์มผลการซ่อม
                // ในแท็บ In Progress ไม่งั้นจะเห็นส่วน "วางแผนให้ planner" ผิดด่าน
                const loadedStatus = String(data.status ?? "").trim().toLowerCase();
                const loadedStage = String(data.stage ?? "").trim().toLowerCase();
                if (!isRePlan && loadedStatus === "wait for approve" && loadedStage !== "cs_approval") {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("tab", "in-progress");
                    params.delete("planning");
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                    return;
                }

                // Planner ต้องเห็นข้อมูลซ่อมชุดเดียวกับ Technician โดยเฉพาะใบ WO wait for approve
                // ซึ่ง repair_history อาจมีข้อมูลชุดที่ 2 ครบกว่า flat fields
                const approvalRound = loadedStatus === "wait for approve"
                    ? ([...(Array.isArray(data.repair_history) ? data.repair_history : [])].reverse().find((round: any) =>
                        String(round?.repair_result ?? "").trim() === String(data.repair_result ?? "").trim()
                    ) ?? (Array.isArray(data.repair_history) ? data.repair_history[data.repair_history.length - 1] : undefined))
                    : undefined;
                const asStringList = (value: unknown): string[] => Array.isArray(value)
                    ? value.map(item => String(item ?? "").trim()).filter(Boolean)
                    : String(value ?? "").trim() ? [String(value).trim()] : [];
                const mergeStringList = (preferred: unknown, fallback: unknown): string[] => Array.from(new Set([
                    ...asStringList(preferred),
                    ...asStringList(fallback),
                ]));
                const flatCorrectiveActions = Array.isArray(data.corrective_actions) ? data.corrective_actions : [];
                const historyCorrectiveActions = Array.isArray(approvalRound?.corrective_actions)
                    ? approvalRound.corrective_actions
                    : [];
                const mergedCorrectiveActions = historyCorrectiveActions.length > 0
                    ? Array.from({ length: Math.max(historyCorrectiveActions.length, flatCorrectiveActions.length) }, (_, index) => {
                        const historyAction = historyCorrectiveActions[index] ?? {};
                        const flatAction = flatCorrectiveActions[index] ?? {};
                        return {
                            ...flatAction,
                            ...historyAction,
                            text: String(historyAction.text ?? "").trim()
                                ? historyAction.text
                                : (flatAction.text ?? ""),
                            beforeImages: historyAction.beforeImages?.length
                                ? historyAction.beforeImages
                                : (flatAction.beforeImages ?? []),
                            afterImages: historyAction.afterImages?.length
                                ? historyAction.afterImages
                                : (flatAction.afterImages ?? []),
                        };
                    })
                    : flatCorrectiveActions;

                const rawDate = data.found_date ?? "";

                setDocName(data.doc_name ?? "");
                setIssueId(data.issue_id ?? "");
                setFoundDate(rawDate ? isoToDisplay(rawDate) : localTodayFormatted());
                setFoundTime(data.found_time ?? "");
                setLocation(data.location ?? "");
                setDamageSymptoms(Array.isArray(data.damage_symptoms) ? data.damage_symptoms : []);
                setDamageSymptomOther(data.damage_symptom_other ?? "");
                setProblemDetails(data.problem_details ?? "");
                setSeverity((data.severity ?? "") as Severity);
                setStatus((data.status ?? "Open") as Status);
                setStage(data.stage ?? "");
                setRejectedInfo({ remark: data.reject_remark ?? "", by: data.rejected_by ?? "" });
                setCancelledInfo({ remark: data.cancel_remark ?? "", by: data.cancelled_by ?? "" });
                setRemarksOpen(data.remarks_open ?? "");
                setFaultyEquipment(data.faulty_equipment ?? "");
                setLoadedCharger({
                    chargeBoxID: data.chargeBoxID ?? "",
                    charger_name: data.charger_name ?? "",
                    charger_no: data.charger_no ?? null,
                    charger_sn: data.charger_sn ?? "",
                    charger_model: data.charger_model ?? "",
                    charger_brand: data.charger_brand ?? "",
                    auto_generated: !!data.auto_generated,
                });
                setSummary(data.summary ?? "");
                setReportedBy(data.reported_by ?? "");
                setReporterSignature(data.reporter_signature ?? "");
                // ค่าที่เคยวางแผนไว้ (ถ้ามี) — datetime-local รับได้แค่ "YYYY-MM-DDTHH:MM"
                setRepairInfo({
                    problem_type: mergeStringList(approvalRound?.problem_type, data.problem_type),
                    problem_type_other: approvalRound?.problem_type_other || data.problem_type_other || "",
                    cause: mergeStringList(approvalRound?.cause, data.cause),
                    repaired_equipment: mergeStringList(approvalRound?.repaired_equipment, data.repaired_equipment),
                    inprogress_remarks: approvalRound?.inprogress_remarks || data.inprogress_remarks || "",
                    corrective_actions: mergedCorrectiveActions,
                });
                const prevHistory: PlanRound[] = Array.isArray(data.plan_history) ? data.plan_history : [];
                const loadedWait = normalizeWaitState(data.repair_result ?? "");
                if (isRePlan) {
                    // วางแผนรอบใหม่ — เก็บแผนรอบเดิมไว้ดูเป็นประวัติ แล้วเริ่มกรอกรอบใหม่จากว่าง
                    setPlanHistory([...prevHistory, {
                        planned_date: data.planned_date ?? "",
                        planned_time: data.planned_time ?? "",
                        wait_state: loadedWait,
                        wait_remark: data.repair_result_remark ?? "",
                        sched_start: data.sched_start ?? "",
                        sched_finish: data.sched_finish ?? "",
                        assignees: Array.isArray(data.assignees) ? data.assignees : [],
                    }]);
                    // เวลาของรอบใหม่ = ตอนที่เปิดฟอร์มเข้ามา
                    setPlannedDate(localTodayISO());
                    setPlannedTime(localNowHHMM());
                    setSchedStart("");
                    setSchedFinish("");
                } else {
                    setPlanHistory(prevHistory);
                    // ยังไม่เคยวางแผน → ประทับเวลา "ตอนที่เปิดฟอร์มเข้ามา" ไม่ใช่ตอนกดบันทึก
                    // มีค่าเดิมแล้วไม่ทับ เพื่อให้เป็นเวลาที่วางแผนรอบนี้จริง ๆ
                    setPlannedDate(data.planned_date || localTodayISO());
                    setPlannedTime(data.planned_time || localNowHHMM());
                    setSchedStart((data.sched_start ?? "").slice(0, 16));
                    setSchedFinish((data.sched_finish ?? "").slice(0, 16));
                }
                // วางแผนรอบใหม่ = เริ่มติ๊กใหม่ทั้งหมด (ช่างของรอบก่อนอยู่ในการ์ดประวัติแล้ว)
                const loadedAssignees = Array.isArray(data.assignees) ? data.assignees.filter(Boolean) : [];
                setAssignees(isRePlan ? [] : loadedAssignees);
                // เก็บเฉพาะสถานะรอที่เลือกตอนวางแผนได้ — ใบที่ซ่อมไปแล้วอาจมี repair_result เป็นค่าอื่น
                // (รองรับค่าเก่าที่เปลี่ยนชื่อแล้วด้วย normalizeWaitState)
                // รอบใหม่: สถานะของรอบก่อนถูกตัดออกจากตัวเลือกแล้ว จึงต้องเลือกค่าใหม่ให้ ไม่งั้น select จะค้างค่าที่ไม่มีในลิสต์
                const loadedUsed = new Set([...prevHistory.map(r => (r.wait_state || "").trim()), ...(isRePlan ? [loadedWait] : [])].filter(Boolean));
                const firstFree = WAIT_STATES.find(w => !loadedUsed.has(w));
                setWaitState(isRePlan ? (firstFree ?? DEFAULT_WAIT_STATE) : loadedWait);
                // รอบใหม่เริ่มจากว่าง — หมายเหตุของรอบก่อนไปอยู่ในการ์ดประวัติแล้ว
                setWaitRemark(isRePlan ? "" : (data.repair_result_remark ?? ""));

                // ═══ แสดง Maximo ticket ถ้ามี (edit mode) ═══
                if (data.maximo_wonum) setMaximoWonum(data.maximo_wonum);
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
                                    serverGroup: group,
                                    createdAt: p.uploadedAt
                                        ? new Date(p.uploadedAt).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })
                                        : undefined,
                                    location: (p as any).location || undefined,
                                    // ไฟล์จาก server ไม่มี mime — isImageAttachment จะเดาจากนามสกุลใน url เอง
                                    name: p.filename,
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
    async function deleteUploadedPhotosForReport(reportId: string, urls: string[]) {
        for (const url of urls) {
            const q = new URLSearchParams({
                station_id: stationId || "",
                group: "cm_photos",
                url,
                phase: "problem",
            });
            try {
                await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(reportId)}/photos?${q.toString()}`, {
                    method: "DELETE",
                    credentials: "include",
                });
            } catch (error) {
                console.error("[CM] Attachment rollback failed:", error);
            }
        }
    }

    async function uploadPhotosForReport(reportId: string): Promise<string[]> {
        if (!stationId) return [];
        const newPhotos = photos_open.filter(p => !p.isServer);
        if (newPhotos.length === 0) return [];

        setUploadState({ show: true, total: newPhotos.length, completed: 0 });
        const uploadedUrls: string[] = [];

        try {
            // ส่งทีละไฟล์เพื่อไม่ให้ไฟล์แนบหลายไฟล์รวมกันจน request ชนเพดานของ Nginx
            for (let index = 0; index < newPhotos.length; index += 1) {
                const photo = newPhotos[index];
                const fd = new FormData();
                fd.append("station_id", stationId);
                fd.append("group", "cm_photos");
                fd.append("phase", "problem");
                fd.append("files", photo.file, photo.file.name);
                if (photo.location) fd.append("location", photo.location);
                fd.append("created_at", new Date().toISOString());

                const res = await apiFetch(
                    `${API_BASE}/cmreport/${encodeURIComponent(reportId)}/photos`,
                    { method: "POST", body: fd, credentials: "include" }
                );
                if (!res.ok) {
                    const reason = await responseErrorMessage(res, "Upload failed");
                    throw new Error(`${photo.file.name}: ${reason}`);
                }
                const uploadData = await res.json().catch(() => ({}));
                const uploadedUrl = uploadData?.files?.[0]?.url;
                if (typeof uploadedUrl === "string" && uploadedUrl) uploadedUrls.push(uploadedUrl);

                setUploadState({ show: true, total: newPhotos.length, completed: index + 1 });
            }
            return uploadedUrls;
        } catch (error) {
            await deleteUploadedPhotosForReport(reportId, uploadedUrls);
            throw error;
        }
    }

    // ผลการยิงเข้า Maximo แนบมากับ response ของ PATCH /status — เปิด WO ไม่ผ่านต้องบอกให้รู้
    // (บันทึกใบงานสำเร็จไปแล้ว ไม่ใช่ error ของการบันทึก จึงเตือนอย่างเดียวไม่ throw)
    const reportMaximoResult = (maximo: any) => {
        const in01 = maximo?.IN01;
        if (!in01) return;
        if (in01.ok && in01.wonum) {
            setMaximoWonum(in01.wonum);
            return;
        }
        if (in01.skipped) {
            console.warn("[Maximo] skip create WO:", in01.reason);
            return;
        }
        console.warn("[Maximo] create WO failed:", in01);
        alert(`${t("maximoWoFailed", lang)}
${in01.error ?? ""}`);
    };

    const onFinalSave = async (nextStatus: string = "In Progress", opts: { selfClose?: boolean } = {}) => {
        const selfClose = !!opts.selfClose;
        if (!stationId) { alert(t("alertNoStationId", lang)); return; }
        if (!canSave && (!isEdit || isOwner)) return;
        setSaving(true);
        setOverlayText(lang === "th" ? "กำลังบันทึก..." : "Saving...");
        const createdReportIds: string[] = [];
        let uploadedEditUrls: string[] = [];
        try {
            if (isEdit && editId) {
                const payload: Record<string, any> = { station_id: stationId, status: nextStatus };
                if (isOwner) {
                    // คนเปิดใบงานแก้ไขข้อมูลได้ — ส่งค่าที่แก้ไปพร้อมกัน
                    // ส่ง stage เดิมไปด้วย กัน backend re-stamp เป็น close_approval ตอน status ยังเป็น Wait for approve
                    // เคลียร์ reject_remark = ยืนยันแก้ไขแล้ว → ใบกลับเข้าคิว head cs อีกครั้ง
                    payload.job = {
                        faulty_equipment: faultyEquipment,
                        damage_symptoms: damageSymptoms,
                        damage_symptom_other: damageSymptoms.includes(DAMAGE_SYMPTOM_OTHER) ? damageSymptomOther.trim() : "",
                        severity,
                        problem_details: problemDetails,
                        remarks_open,
                        location,
                        reporter_signature: reporterSignature,
                        stage,
                        reject_remark: "",
                    };
                }
                // ส่งเข้า In Progress = จบขั้นวางแผน — แนบแผน+ช่างเฉพาะ needsSchedule (material/site condition ไม่ต้องมี)
                if (nextStatus === "In Progress") {
                    payload.job = {
                        ...(payload.job ?? {}),
                        sched_start: needsSchedule ? schedStart : "",
                        sched_finish: needsSchedule ? schedFinish : "",
                        assignees: needsSchedule ? pickedAssignees : [],
                        repair_result: waitState,
                        repair_result_remark: needsSchedule ? "" : waitRemark.trim(),
                        planned_date: plannedDate || localTodayISO(),
                        planned_time: plannedTime || localNowHHMM(),
                        plan_history: planHistory,
                    };
                } else if (canPlan && hasPlanInput) {
                    // บันทึกแผนที่กรอกค้างไว้ (ยังไม่ Assign) — คง stage เดิมกัน backend re-stamp
                    payload.job = {
                        ...(payload.job ?? {}),
                        sched_start: needsSchedule ? schedStart : "",
                        sched_finish: needsSchedule ? schedFinish : "",
                        assignees: needsSchedule ? pickedAssignees : [],
                        stage,
                    };
                }
                // ต้องอัปโหลดไฟล์ให้สำเร็จก่อน จึงค่อยเปลี่ยนสถานะ/บันทึกข้อมูลใบงาน
                if (isOwner) {
                    setOverlayText(lang === "th" ? "กำลังอัปโหลดไฟล์แนบ..." : "Uploading attachments...");
                    uploadedEditUrls = await uploadPhotosForReport(editId);
                }

                const res = await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);
                reportMaximoResult((await res.json().catch(() => ({})))?.maximo);

                if (isOwner) {
                    // Upload was completed before the status update above.
                    setUploadState({ show: false, total: 0, completed: 0 });
                }

                // Assign แล้วกลับไปหน้า list ของแท็บปลายทาง — ไม่เปิดฟอร์มใบนั้นต่อ (งานเป็นของช่างแล้ว)
                setOverlayText(lang === "th" ? "บันทึกสำเร็จ ✓" : "Saved successfully ✓");
                await new Promise(r => setTimeout(r, 1200));
                // Assign แล้วกลับหน้า Open list (ไม่เด้งไป In Progress) — planner จัดการ SR/WO อื่นต่อได้
                // ยกเว้นกรณีมาวางแผนรอบใหม่จากตาราง In Progress — ต้องกลับที่เดิมที่กดเข้ามา
                router.push(buildListUrl(isRePlan ? "in-progress" : "open"));

            } else {
                // ถ้าเลือก failure class ระดับ Charger ระบบจะเปิดใบแยกตามตู้ที่ตรงประเภท
                // ถ้าเป็นตำแหน่งระดับสถานี หรือไม่มีข้อมูลตู้ ให้ทำงานแบบเดิมคือเปิดใบเดียว
                const splitTargets: Array<ChargerInfo | null> = chargerTargets.length > 0 ? chargerTargets : [null];
                for (const charger of splitTargets) {
                    const chargerNo = charger
                        ? (charger.chargerNo ?? charger.charger_no ?? charger.charger_id)
                        : undefined;
                    const chargerSn = charger ? (charger.SN || charger.sn || "").trim() : "";
                    const submitRes = await apiFetch(`${API_BASE}/cmreport/submit`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                            station_id: stationId,
                            found_date: displayToISO(foundDate),
                            found_time: foundTime || localNowHHMM(),
                            faulty_equipment: faultyEquipment,
                            damage_symptoms: damageSymptoms,
                            // ข้อความอิสระมีความหมายเฉพาะตอนเลือก "อื่น ๆ" — ไม่งั้นส่งค่าว่างไป
                            damage_symptom_other: damageSymptoms.includes(DAMAGE_SYMPTOM_OTHER) ? damageSymptomOther.trim() : "",
                            charger_no: chargerNo == null ? null : String(chargerNo),
                            charger_sn: chargerSn,
                            severity,
                            problem_details: problemDetails,
                            remarks_open,
                            location,
                            reported_by,
                            reporter_signature: reporterSignature,
                        })
                    });
                    if (!submitRes.ok) throw new Error((await submitRes.json()).detail || `HTTP ${submitRes.status}`);

                    const { report_id } = await submitRes.json();
                    createdReportIds.push(report_id);

                    // ใบใหม่ต้องแนบไฟล์ให้สำเร็จก่อน จึงค่อย PATCH สถานะ/ข้อมูลแผน
                    setOverlayText(lang === "th" ? "กำลังอัปโหลดไฟล์แนบ..." : "Uploading attachments...");
                    await uploadPhotosForReport(report_id);

                    // /cmreport/submit เปิดใบเป็น "Wait for approve" (cs_approval) และไม่รับฟิลด์แผน — ถ้ากรอกแผนมาด้วยต้อง PATCH ต่อ
                    if (selfClose) {
                        // ข้ามด่านอนุมัติ/วางแผน — ดันใบไปที่ Wait for schedule เพื่อให้ planner กรอกผลและปิดเองได้
                        const selfCloseJob: Record<string, any> = { stage: "" };
                        if (isTechnician) {
                            // ช่างเปิดใบเอง = ไม่มีขั้นวางแผน จึงต้องเติมสิ่งที่ปกติ planner กรอกให้เองตรงนี้
                            //   • assignees = ตัวเอง — ไม่งั้นเปิดฟอร์ม In Progress มาเจอโหมดดูอย่างเดียว
                            //   • repair_result + วันนัด — เงื่อนไขที่ IN01 ใช้ตัดสินว่าจะเปิด WO ฝั่ง Maximo ไหม
                            //     (services/cm_maximo.is_planning_save) ไม่มีค่าพวกนี้ = ไม่มี WO แล้ว
                            //     IN02/IN03/IN05/IN09 จะยิงไม่ได้เลยทั้งใบตอนปิดงาน
                            const startedAt = `${localTodayISO()}T${localNowHHMM()}`;
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            const tomorrowISO = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
                            selfCloseJob.assignees = [currentUsername.trim()].filter(Boolean);
                            selfCloseJob.repair_result = DEFAULT_WAIT_STATE;
                            selfCloseJob.sched_start = startedAt;
                            selfCloseJob.sched_finish = `${tomorrowISO}T${localNowHHMM()}`;
                            selfCloseJob.planned_date = localTodayISO();
                            selfCloseJob.planned_time = localNowHHMM();
                        }
                        const selfCloseRes = await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(report_id)}/status`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ station_id: stationId, status: nextStatus, job: selfCloseJob }),
                        });
                        if (!selfCloseRes.ok) throw new Error((await selfCloseRes.json()).detail || `HTTP ${selfCloseRes.status}`);
                        reportMaximoResult((await selfCloseRes.json().catch(() => ({})))?.maximo);
                    } else if (canPlan && (hasPlanInput || nextStatus === "In Progress")) {
                        const planPayload: Record<string, any> = {
                            station_id: stationId,
                            status: nextStatus,
                            job: {
                                sched_start: needsSchedule ? schedStart : "",
                                sched_finish: needsSchedule ? schedFinish : "",
                                assignees: needsSchedule ? pickedAssignees : [],
                            },
                        };
                        if (nextStatus === "In Progress") {
                            planPayload.job.repair_result = waitState;
                            planPayload.job.repair_result_remark = needsSchedule ? "" : waitRemark.trim();
                            planPayload.job.planned_date = plannedDate || localTodayISO();
                            planPayload.job.planned_time = plannedTime || localNowHHMM();
                            planPayload.job.plan_history = planHistory;
                        } else {
                            // ยังไม่ Assign — ใบยังอยู่ด่าน cs, คง stage ไว้กัน backend re-stamp เป็น close_approval
                            planPayload.job.stage = "cs_approval";
                        }
                        const planRes = await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(report_id)}/status`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify(planPayload),
                        });
                        if (!planRes.ok) throw new Error((await planRes.json()).detail || `HTTP ${planRes.status}`);
                        reportMaximoResult((await planRes.json().catch(() => ({})))?.maximo);
                    }
                }

                setUploadState({ show: false, total: 0, completed: 0 });

                // cleanup draft
                clearDraftLocal(draftKey);
                await delPhotosByDraftKey(draftKey);

                // แสดง "บันทึกสำเร็จ" แล้ว redirect — ใบที่ส่งให้ช่างแล้วไปโผล่แท็บ In Progress
                setOverlayText(lang === "th" ? "บันทึกสำเร็จ ✓" : "Saved successfully ✓");
                await new Promise(r => setTimeout(r, 1500));
                if (selfClose && createdReportIds.length) {
                    // เปิดฟอร์ม In Progress ของใบที่เพิ่งสร้างต่อทันที (ใบแรกถ้าแตกหลายตู้)
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("view", "form");
                    params.set("edit_id", createdReportIds[0]);
                    if (isTechnician) {
                        // ใบของช่างอยู่แท็บ In Progress แล้วจริง ๆ — ไปที่แท็บนั้นเลย กดย้อนกลับจะได้ตรงที่
                        // (self_close เป็นสวิตช์ของ planner ที่ทำให้แท็บ Open เรนเดอร์ฟอร์ม In Progress)
                        params.set("tab", "in-progress");
                        params.delete("self_close");
                    } else {
                        params.set("self_close", "1");
                    }
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                    return;
                }
                // Assign แล้วกลับหน้า Open list (ไม่เด้งไป In Progress) — planner จัดการ SR/WO อื่นต่อได้
                // ยกเว้นกรณีมาวางแผนรอบใหม่จากตาราง In Progress — ต้องกลับที่เดิมที่กดเข้ามา
                router.push(buildListUrl(isRePlan ? "in-progress" : "open"));
            }
        } catch (e: any) {
            if (isEdit && editId && uploadedEditUrls.length) {
                await deleteUploadedPhotosForReport(editId, uploadedEditUrls);
            }
            // ใบใหม่ถูกสร้างก่อนอัปโหลดเพื่อให้มี report_id — ถ้าขั้นตอนไหนล้มเหลวให้ rollback ทันที
            for (const reportId of createdReportIds.reverse()) {
                try {
                    await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(reportId)}/rollback?station_id=${encodeURIComponent(stationId)}`, {
                        method: "DELETE",
                        credentials: "include",
                    });
                } catch (rollbackError) {
                    console.error("[CM] Rollback failed:", rollbackError);
                }
            }
            setUploadState({ show: false, total: 0, completed: 0 });
            alert(`${t("alertSaveFailed", lang)} ${e.message || e}`);
        } finally {
            setSaving(false);
        }
    };

    // ── head cs อนุมัติใบงานด่าน cs (ในฟอร์ม ผ่าน modal) → Wait for schedule ──
    const handleCsApprove = async () => {
        if (!editId || !stationId) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}/cs-approve?station_id=${encodeURIComponent(stationId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ remark: commentText.trim() }),
            });
            if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any).detail || `HTTP ${res.status}`);
            closeCommentModal();
            router.push(buildListUrl("open"));
        } catch (e: any) {
            alert(`${t("alertSaveFailed", lang)} ${e.message || e}`);
        } finally {
            setSaving(false);
        }
    };

    // ── ยกเลิกใบงาน (planner/admin ตอนรีวิวหรือวางแผน) → Cancelled (ไปแท็บ Closed) ──
    const handleCancelJob = async () => {
        if (!editId || !stationId) return;
        const remark = commentText.trim();
        if (!remark) return;
        setSaving(true);
        try {
            const res = await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}/cancel?station_id=${encodeURIComponent(stationId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ remark }),
            });
            if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any).detail || `HTTP ${res.status}`);
            closeCommentModal();
            router.push(buildListUrl("closed"));
        } catch (e: any) {
            alert(`${t("alertSaveFailed", lang)} ${e.message || e}`);
        } finally {
            setSaving(false);
        }
    };

    // ── ตีกลับใบงานพร้อมเหตุผล — เลือก endpoint ตามด่าน:
    //    planner ตอนวางแผน → /planner-reject (กลับไปด่าน cs), head cs ตอนรีวิว → /cs-reject (กลับไปหา cs ผู้เปิด)
    const handleReject = async () => {
        if (!editId || !stationId) return;
        const remark = commentText.trim();
        if (!remark) return;
        const endpoint = isPlanningStage ? "planner-reject" : "cs-reject";
        setSaving(true);
        try {
            const res = await apiFetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}/${endpoint}?station_id=${encodeURIComponent(stationId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ remark }),
            });
            if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any).detail || `HTTP ${res.status}`);
            closeCommentModal();
            router.push(buildListUrl("open"));
        } catch (e: any) {
            alert(`${t("alertSaveFailed", lang)} ${e.message || e}`);
        } finally {
            setSaving(false);
        }
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
        setStatus("Wait for approve");
        setRemarksOpen("");
        setFaultyEquipment("");
        setPhotosOpen([]);
        setSummary("");
        setRepairInfo(null);
        setPlanHistory([]);
        setPlannedDate("");
        setPlannedTime("");
        setSchedStart("");
        setSchedFinish("");
        setAssignees([]);
        setWaitState(DEFAULT_WAIT_STATE);
        setWaitRemark("");
    };

    // ==================== RENDER ====================
    return (
        <section className="tw-pb-24">
            {/* Loading Overlay ระหว่างบันทึก */}
            <LoadingOverlay
                show={saving || uploadState.show}
                text={overlayText}
            />
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

                    {/* ═══ Maximo Badge (แสดงใน edit mode) — SR ตอนเปิดใบ, WO ตอนวางแผนเสร็จ ═══ */}
                    {isEdit && (maximoTicketId || maximoWonum) && (
                        <div className="tw-mb-4 tw-flex tw-flex-wrap tw-items-center tw-gap-x-4 tw-gap-y-2 tw-px-4 tw-py-2.5 tw-rounded-lg tw-bg-blue-50 tw-border tw-border-blue-200">
                            {maximoTicketId && (
                                <span className="tw-flex tw-items-center tw-gap-2">
                                    <span className="tw-text-sm tw-text-blue-700">🎫 Maximo SR:</span>
                                    <span className="tw-font-mono tw-font-bold tw-text-blue-900 tw-bg-blue-100 tw-px-2 tw-py-0.5 tw-rounded">{maximoTicketId}</span>
                                </span>
                            )}
                            {maximoWonum && (
                                <span className="tw-flex tw-items-center tw-gap-2">
                                    <span className="tw-text-sm tw-text-blue-700">🧾 Maximo WO:</span>
                                    <span className="tw-font-mono tw-font-bold tw-text-blue-900 tw-bg-blue-100 tw-px-2 tw-py-0.5 tw-rounded">{maximoWonum}</span>
                                </span>
                            )}
                        </div>
                    )}

                    {/* ═══ มีคนกำลังกรอก/วางแผนใบงานนี้อยู่ → ดูได้อย่างเดียวจนกว่าเขาจะออกจากหน้า ═══ */}
                    <LockBanner lockedBy={lockedBy} lang={lang} />

                    {/* ═══ สถานีนี้ไม่ใช่ยี่ห้อที่บริษัทตัวเองดูแล → เปิดใบงานไม่ได้ ═══ */}
                    {!isEdit && brandBlocked && (
                        <div className="tw-mb-4 tw-flex tw-items-start tw-gap-3 tw-px-4 tw-py-3 tw-rounded-lg tw-bg-amber-50 tw-border tw-border-amber-200">
                            <ExclamationTriangleIcon className="tw-w-5 tw-h-5 tw-text-amber-500 tw-mt-0.5 tw-flex-shrink-0" />
                            <div>
                                <p className="tw-text-sm tw-font-semibold tw-text-amber-800">
                                    {lang === "th" ? "เปิดใบงานที่สถานีนี้ไม่ได้" : "Cannot open a work order at this station"}
                                </p>
                                <p className="tw-text-sm tw-text-amber-700 tw-mt-0.5">
                                    {lang === "th"
                                        ? `${currentCompany || "บริษัทของคุณ"} ดูแลเฉพาะตู้ยี่ห้อ ${brandScope} — สถานีนี้ไม่ใช่ยี่ห้อดังกล่าว`
                                        : `${currentCompany || "Your company"} only maintains ${brandScope} chargers — this station is a different brand`}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ═══ แจ้งเตือนใบงานถูกตีกลับจากผู้วางแผน (planner) — โชว์ให้ CS แก้ ═══ */}
                    {isEdit && isCsStage && rejectedInfo.remark && (
                        <div className="tw-mb-4 tw-flex tw-items-start tw-gap-3 tw-px-4 tw-py-3 tw-rounded-lg tw-bg-red-50 tw-border tw-border-red-200">
                            <ExclamationTriangleIcon className="tw-w-5 tw-h-5 tw-text-red-500 tw-mt-0.5 tw-flex-shrink-0" />
                            <div>
                                <p className="tw-text-sm tw-font-semibold tw-text-red-700">{t("rejectedBannerTitle", lang)}</p>
                                <p className="tw-text-sm tw-text-red-600 tw-mt-0.5">
                                    “{rejectedInfo.remark}”{rejectedInfo.by ? ` — ${t("rejectedBy", lang)} ${rejectedInfo.by}` : ""}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ═══ แจ้งเตือนใบงานถูกยกเลิก — โชว์หมายเหตุเหมือนหน้าตีกลับ ═══ */}
                    {isEdit && isCancelled && cancelledInfo.remark && (
                        <div className="tw-mb-4 tw-flex tw-items-start tw-gap-3 tw-px-4 tw-py-3 tw-rounded-lg tw-bg-amber-50 tw-border tw-border-amber-200">
                            <ExclamationTriangleIcon className="tw-w-5 tw-h-5 tw-text-amber-500 tw-mt-0.5 tw-flex-shrink-0" />
                            <div>
                                <p className="tw-text-sm tw-font-semibold tw-text-amber-700">{lang === "th" ? "ใบงานถูกยกเลิก" : "Work order cancelled"}</p>
                                <p className="tw-text-sm tw-text-amber-600 tw-mt-0.5">
                                    “{cancelledInfo.remark}”{cancelledInfo.by ? ` — ${lang === "th" ? "โดย" : "by"} ${cancelledInfo.by}` : ""}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Meta Info - Readonly Inputs */}
                    <div className={`tw-grid tw-grid-cols-1 ${isCancelled ? "md:tw-grid-cols-5" : "md:tw-grid-cols-4"} tw-gap-4 tw-mb-6`}>
                        {isCancelled ? (
                            <>
                                <div>
                                    <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("srNo", lang)}</label>
                                    <Input value={srNo} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
                                </div>
                                <div>
                                    <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("woNo", lang)}</label>
                                    <Input value={woNo} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{isWoStage ? t("woNo", lang) : t("srNo", lang)}</label>
                                <Input value={srWoNo} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
                            </div>
                        )}
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("cmDate", lang)}</label>
                            <Input value={foundTime ? `${foundDate} ${foundTime}` : (foundDate || "")} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
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
                    {/* ตู้ชาร์จที่ใบงานนี้เกี่ยวข้อง — ชื่อ / เลขตู้ / S/N / บริษัทผู้ถือครอง */}
                    {chargerIdentityItems.map((data, index) => (
                        <ChargerIdentity key={`${data.chargeBoxID || data.charger_no || data.charger_sn || "station"}-${index}`} data={data} lang={lang} />
                    ))}

                    {/* Problem Details Section */}
                    <div className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
                        {/* Section Header */}
                        <div className="tw-flex tw-items-center tw-gap-3 tw-bg-gray-700 hover:tw-bg-gray-800 tw-px-4 tw-py-3 tw-text-white tw-cursor-pointer tw-transition-colors">
                            <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-white tw-text-gray-700 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-sm">1</div>
                            <span className="tw-font-semibold tw-text-base">{t("problemDetails", lang)}</span>
                        </div>

                        {/* Section Content */}
                        <div className="tw-p-4 tw-space-y-4">
                            {/* Damage Symptoms & Severity - Same Row */}
                            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                                {/* Damage Symptoms — เลือกได้หลายข้อ */}
                                <div id="cm-damage-symptoms">
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">
                                        {t("damageSymptoms", lang)} <span className="tw-text-red-500">*</span>
                                    </label>
                                    <Select
                                        isMulti
                                        isDisabled={fieldsLocked}
                                        placeholder={t("damageSymptomsPlaceholder", lang)}
                                        options={damageSymptomOptions}
                                        value={damageSymptomOptions.filter(o => damageSymptoms.includes(o.value))}
                                        onChange={(opts: any) => setDamageSymptoms((opts || []).map((o: any) => o.value))}
                                        menuPlacement="auto"
                                        menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                                        classNamePrefix="react-select"
                                        styles={damageSelectStyles}
                                    />
                                </div>

                                {/* Severity */}
                                <div id="cm-severity">
                                    <div className="tw-flex tw-items-center tw-gap-1.5 tw-mb-2">
                                        <label htmlFor="cm-severity-select" className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800">{t("severity", lang)} <span className="tw-text-red-500">*</span></label>
                                        <Tooltip
                                            content={
                                                <div className="tw-w-72 tw-whitespace-normal tw-text-left tw-text-xs tw-leading-5">
                                                    {t("severityTooltip", lang).split("\n").map((line, index) => (
                                                        <div key={index}>{line}</div>
                                                    ))}
                                                </div>
                                            }
                                            placement="top"
                                        >
                                            <span tabIndex={0} aria-label={t("severityTooltip", lang)} className="tw-inline-flex tw-cursor-help tw-text-blue-gray-500 hover:tw-text-blue-600 focus:tw-text-blue-600">
                                                <InformationCircleIcon className="tw-h-4 tw-w-4" />
                                            </span>
                                        </Tooltip>
                                    </div>
                                    <div className="tw-relative">
                                        {severity && (
                                            <span className={`tw-absolute tw-left-3 tw-top-1/2 tw--translate-y-1/2 tw-w-1.5 tw-h-1.5 tw-rounded-full tw-pointer-events-none ${severity === "Urgent" ? "tw-bg-red-400" :
                                                severity === "High" ? "tw-bg-orange-400" :
                                                    severity === "Medium" ? "tw-bg-yellow-500" :
                                                        "tw-bg-green-400"
                                                }`} />
                                        )}
                                        <select
                                            id="cm-severity-select"
                                            value={severity}
                                            disabled={fieldsLocked}
                                            onChange={e => setSeverity(e.target.value as Severity)}
                                            style={fieldsLocked ? { backgroundColor: '#f3f4f6', color: '#455a64' } : {}}
                                            className={`tw-w-full tw-h-10 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-pr-4 tw-text-sm tw-font-medium tw-transition-all tw-duration-200 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500 focus:tw-border-transparent ${severity ? "tw-pl-6" : "tw-pl-4"} ${fieldsLocked ? "tw-bg-gray-100 tw-text-blue-gray-700 tw-cursor-not-allowed tw-opacity-100" : "tw-bg-white tw-text-blue-gray-700 hover:tw-border-blue-gray-300"}`}
                                        >
                                            <option value="">{t("severityPlaceholder", lang)}</option>
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                            <option value="Urgent">Urgent</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {damageSymptoms.includes(DAMAGE_SYMPTOM_OTHER) && (
                                <div>
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">
                                        {t("damageSymptomOther", lang)} <span className="tw-text-red-500">*</span>
                                    </label>
                                    <Input
                                        value={damageSymptomOther}
                                        disabled={fieldsLocked}
                                        onChange={e => setDamageSymptomOther(e.target.value)}
                                        placeholder={t("damageSymptomOtherPlaceholder", lang)}
                                        crossOrigin=""
                                        className="!tw-w-full"
                                        containerProps={{ className: "!tw-min-w-0" }}
                                    />
                                </div>
                            )}

                            {/* Problem Found (ปัญหาที่พบ) */}
                            <div id="cm-problem-found">
                                <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("problemFound", lang)} <span className="tw-text-red-500">*</span></label>
                                <Textarea value={problemDetails} onChange={e => setProblemDetails(e.target.value)} readOnly={fieldsLocked} rows={2} className={`!tw-w-full !tw-border-blue-gray-200 ${fieldsLocked ? "!tw-bg-gray-100 !tw-text-blue-gray-700" : "!tw-bg-white"}`} containerProps={{ className: "!tw-min-w-0" }} />
                            </div>

                            {/* Job Status */}
                            <div>
                                <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">{t("jobStatus", lang)}</label>
                                <div className={`tw-inline-flex tw-items-center tw-px-4 tw-py-2.5 tw-rounded-full tw-text-white tw-font-semibold tw-text-sm tw-shadow-md tw-transition-all ${
                                    isPlanningStage ? "tw-bg-indigo-600" :
                                        statusLower === "wait for approve" ? "tw-bg-purple-600" :
                                            statusLower === "in progress" ? "tw-bg-amber-600" :
                                                "tw-bg-green-600"
                                }`}>
                                    <span>{status || "Open"}</span>
                                </div>
                            </div>

                            {/* Photos */}
                            <div id="cm-photos">
                                <div className="tw-flex tw-items-center tw-gap-1.5 tw-mb-2">
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800">{t("photos", lang)} <span className="tw-text-red-500">*</span></label>
                                    <Tooltip
                                        content={
                                            <div className="tw-w-72 tw-whitespace-normal tw-text-left tw-text-xs tw-leading-5">
                                                {t("photosTooltip", lang).split("\n").map((line, index) => (
                                                    <div key={index}>{line}</div>
                                                ))}
                                            </div>
                                        }
                                        placement="top"
                                    >
                                        <span tabIndex={0} aria-label={t("photosTooltip", lang)} className="tw-inline-flex tw-cursor-help tw-text-blue-gray-500 hover:tw-text-blue-600 focus:tw-text-blue-600">
                                            <InformationCircleIcon className="tw-h-4 tw-w-4" />
                                        </span>
                                    </Tooltip>
                                </div>
                                <PhotoUpload photos_open={photos_open} onAdd={handleAddPhotos} onRemove={handleRemovePhoto} max={MAX_PHOTOS} disabled={fieldsLocked} lang={lang} />
                            </div>
                        </div>
                    </div>

                    {/* หมายเหตุที่ CS กรอกตอนเปิดใบ — แสดงเหนือการวางแผน (ถ้ามีเนื้อหา); read-only ไม่มีหมายเหตุ = ซ่อน */}
                    {(!fieldsLocked || (remarks_open.trim() && remarks_open.trim() !== "-")) && (
                        <div className="tw-mb-6">
                            <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("remarks_open", lang)}</label>
                            <Textarea value={remarks_open} onChange={e => setRemarksOpen(e.target.value)} readOnly={fieldsLocked} rows={1} className={`!tw-w-full !tw-border-blue-gray-200 ${fieldsLocked ? "!tw-bg-gray-100 !tw-text-blue-gray-700" : "!tw-bg-white"}`} containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                    )}

                    {/* ข้อมูลที่ช่างกรอกไว้ — โชว์เฉพาะเมื่อมีจริง (การ์ดคืน null เองถ้าว่าง) */}
                    {canPlan && repairInfo && <RepairInfoCard info={repairInfo} lang={lang} />}

                    {/* ปิดใบงานเอง: ติ๊กแล้วเปลี่ยนไปกรอกฟอร์ม In Progress โดยไม่ต้องวางแผนคนเข้า */}
                    {showPlannerHandlingChoice && (
                        <div className="tw-mb-6 tw-rounded-xl tw-border tw-border-green-200 tw-bg-green-50/50 tw-p-5">
                            <label className="tw-flex tw-cursor-pointer tw-items-start tw-gap-3">
                                <input
                                    type="checkbox"
                                    checked={!isEdit ? selfCloseNew : false}
                                    onChange={() => (isEdit ? selectPlannerHandling("self_close") : setSelfCloseNew(v => !v))}
                                    className="tw-mt-0.5 tw-h-5 tw-w-5 tw-rounded tw-border-blue-gray-300 tw-text-green-600 focus:tw-ring-green-500"
                                />
                                <span>
                                    <span className="tw-block tw-text-sm tw-font-bold tw-text-blue-gray-900">{lang === "th" ? "ปิดใบงาน" : "Close this work order"}</span>
                                    <span className="tw-mt-1 tw-block tw-text-xs tw-text-blue-gray-600">{lang === "th" ? "ไม่ต้องวางแผนคนเข้า — เปิดฟอร์ม In Progress เพื่อกรอกผลการดำเนินงานและปิดใบงานได้เลย" : "No onsite scheduling needed — open the In Progress form to enter the results and close it directly."}</span>
                                </span>
                            </label>
                        </div>
                    )}

                    {/* คนอื่นถือสิทธิ์กรอกอยู่ = ยังเห็นแผนได้ แต่แก้ไม่ได้ — fieldset ปิดทั้งบล็อกทีเดียว ไม่ต้องไล่ปิดทีละช่อง */}
                    {/* Planning Section — เห็นเฉพาะ role ที่วางแผนได้ (admin/owner/planner) ข้อมูลด้านบนเป็น read-only สำหรับคนกลุ่มนี้อยู่แล้ว */}
                    {canPlan && (
                        <fieldset disabled={!!lockedBy} className="tw-m-0 tw-min-w-0 tw-border-0 tw-p-0">
                        <div className="tw-mb-6 tw-p-5 tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-blue-gray-50/40">
                            <h3 className="tw-text-base tw-font-bold tw-text-blue-gray-800 tw-mb-4">{t("planningSection", lang)}</h3>
                            {/* แผนรอบก่อนหน้า — อ่านอย่างเดียว */}
                            {planHistory.map((r, i) => <PlanRoundCard key={i} round={r} index={i} lang={lang} />)}
                            {/* รอบที่กำลังกรอก — ใส่เลขรอบต่อจากประวัติ */}
                            {planHistory.length > 0 && (
                                <h4 className="tw-text-sm tw-font-bold tw-text-blue-gray-700 tw-mb-3">
                                    {t("planRound", lang)} {planHistory.length + 1}
                                </h4>
                            )}
                            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                                {/* วันที่/เวลาที่วางแผน — ประทับตอน planner เปิดฟอร์มเข้ามาครั้งแรก แก้ไม่ได้ */}
                                <div>
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("plannedAt", lang)}</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={plannedDate ? `${plannedDate}${plannedTime ? ` ${plannedTime}` : ""}` : "-"}
                                        className="tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-gray-100 tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-700 tw-cursor-default focus:tw-outline-none"
                                    />
                                </div>
                                {/* สถานะรอ */}
                                <div>
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("waitState", lang)} <span className="tw-text-red-500">*</span></label>
                                    <select value={waitState} onChange={e => setWaitState(e.target.value)}
                                        className="tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none focus:tw-border-blue-500">
                                        {waitStateOptions.map(w => <option key={w} value={w}>{w}</option>)}
                                    </select>
                                </div>
                                {/* หมายเหตุ — เฉพาะ material/site condition (อยู่ข้างๆ dropdown) */}
                                {!needsSchedule && (
                                    <div>
                                        <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("waitRemark", lang)} <span className="tw-text-red-500">*</span></label>
                                        <input type="text" value={waitRemark} onChange={e => setWaitRemark(e.target.value)} placeholder={t("waitRemarkPlaceholder", lang)}
                                            className="tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none focus:tw-border-blue-500" />
                                    </div>
                                )}
                                {/* วันที่เริ่ม/เสร็จ/ช่าง — เฉพาะเมื่อ wait for scheduled (material/site condition ไม่ต้องกรอก) */}
                                {needsSchedule && (<>
                                <div>
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("schedStart", lang)} <span className="tw-text-red-500">*</span></label>
                                    <input type="datetime-local" value={schedStart} onChange={e => setSchedStart(e.target.value)}
                                        className="tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none focus:tw-border-blue-500" />
                                </div>
                                <div>
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("schedFinish", lang)} <span className="tw-text-red-500">*</span></label>
                                    {/* min = ปิดวันก่อนวันเริ่มใน picker เลย — validation ยังต้องมีเพราะ min กันการพิมพ์มือไม่ได้ และยังปล่อยให้เลือกเท่ากับวันเริ่ม */}
                                    <input type="datetime-local" value={schedFinish} min={schedStart || undefined} onChange={e => setSchedFinish(e.target.value)}
                                        className={`tw-w-full tw-rounded-lg tw-border tw-bg-white tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none ${schedRangeInvalid ? "tw-border-red-400 focus:tw-border-red-500" : "tw-border-blue-gray-200 focus:tw-border-blue-500"}`} />
                                    {schedRangeInvalid && <p className="tw-mt-1.5 tw-text-xs tw-text-red-600">{t("schedRangeError", lang)}</p>}
                                </div>
                                <div>
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("technician", lang)} <span className="tw-text-red-500">*</span></label>
                                    {technicianNames.length > 0 && (
                                        <div className="tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-divide-y tw-divide-blue-gray-50 tw-max-h-56 tw-overflow-y-auto">
                                            {/* All = ติ๊กช่างทุกคนในลิสต์รวดเดียว */}
                                            <label className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-cursor-pointer hover:tw-bg-blue-gray-50/60 tw-transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={allTechniciansPicked}
                                                    onChange={toggleAllAssignees}
                                                    className="tw-h-4 tw-w-4 tw-shrink-0 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500 tw-cursor-pointer"
                                                />
                                                <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">{t("allTechnicians", lang)}</span>
                                                <span className="tw-ml-auto tw-text-xs tw-text-blue-gray-400">{pickedAssignees.length}/{technicianNames.length}</span>
                                            </label>
                                            {technicianNames.map(u => (
                                                <label key={u} className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-cursor-pointer hover:tw-bg-blue-gray-50/60 tw-transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={pickedAssignees.includes(u)}
                                                        onChange={() => toggleAssignee(u)}
                                                        className="tw-h-4 tw-w-4 tw-shrink-0 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500 tw-cursor-pointer"
                                                    />
                                                    <span className="tw-min-w-0 tw-truncate tw-text-sm tw-text-blue-gray-800">{u}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                    {technicians.length === 0 && <p className="tw-mt-1.5 tw-text-xs tw-text-orange-600">{t("noTechnicians", lang)}</p>}
                                </div>
                                </>)}
                            </div>
                        </div>
                        </fieldset>
                    )}

                    {/* Validation Card */}
                    {!fieldsLocked && <div className="tw-mb-6"><CMValidationCard validations={validations} lang={lang} /></div>}

                    {/* Actions */}
                    <div className="tw-flex tw-items-center tw-justify-between tw-pt-6 tw-border-t tw-border-blue-gray-100">
                        <div className="tw-flex-1" />
                        <div className="tw-flex tw-items-center tw-gap-3">
                            <Button variant="outlined" onClick={goBackToList} className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300">
                                {t("backToList", lang)}
                            </Button>
                            {/* ยกเลิกใบงาน — ซ่อนตอนใบถูกตีกลับรอ cs แก้ (ยังไม่ใช่คิวของ planner) */}
                            {showCancelBtn && (
                                <Button variant="outlined" onClick={() => openCommentModal("cancel")} disabled={saving} className="tw-border-amber-300 tw-text-amber-700 hover:tw-border-amber-400 hover:tw-bg-amber-50">
                                    {t("cancelJob", lang)}
                                </Button>
                            )}
                            {/* planner ตีกลับใบขั้นวางแผน → กลับไปหา cs */}
                            {showRejectBtn && (
                                <Button variant="outlined" onClick={() => openCommentModal("reject")} disabled={saving} className="tw-border-red-300 tw-text-red-600 hover:tw-border-red-400 hover:tw-bg-red-50">
                                    {t("reject", lang)}
                                </Button>
                            )}
                            {/* head cs ตีกลับใบงานด่าน cs → คืนให้ cs ผู้เปิดแก้ไข */}
                            {showCsRejectBtn && (
                                <Button variant="outlined" onClick={() => openCommentModal("reject")} disabled={saving} className="tw-border-red-300 tw-text-red-600 hover:tw-border-red-400 hover:tw-bg-red-50">
                                    {t("reject", lang)}
                                </Button>
                            )}
                            {/* คนเปิดใบงานแก้ไขแล้วบันทึก — คงสถานะเดิม (ไม่ downgrade เป็น Open); head cs แก้ไม่ได้ — มี modal ยืนยัน */}
                            {isEdit && canEditFields && !isCancelled && (
                                <Button onClick={() => openCommentModal("save")} disabled={saving || showSuccessBanner || !canSave} className="tw-bg-gray-800 hover:!tw-bg-blue-600 tw-text-white hover:tw-shadow-lg hover:!tw-shadow-blue-500/30 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed disabled:tw-shadow-none">
                                    {saving ? t("saving", lang) : t("save", lang)}
                                </Button>
                            )}
                            {/* ช่างเปิดใบงานเอง — ไม่ผ่านด่านอนุมัติ/วางแผน บันทึกแล้วเข้าหน้ากรอกผลต่อทันที */}
                            {!isEdit && isTechnician && (
                                <Button onClick={() => onFinalSave("In Progress", { selfClose: true })}
                                    disabled={saving || showSuccessBanner || !canSave || brandBlocked}
                                    className="tw-bg-green-600 hover:tw-bg-green-700 tw-text-white hover:tw-shadow-lg hover:tw-shadow-green-500/30 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed disabled:tw-shadow-none">
                                    {saving ? t("saving", lang) : (lang === "th" ? "บันทึกและกรอกผล" : "Save and enter results")}
                                </Button>
                            )}
                            {/* เปิดใบงานใหม่ — server ตั้งสถานะเป็น Wait for approve (cs_approval) */}
                            {/* role ที่วางแผนได้ใช้ปุ่มหลักปุ่มเดียวด้านล่างแทน (บันทึก/Assign) จะได้ไม่มีปุ่มบันทึกซ้ำสองปุ่ม */}
                            {!isEdit && !canPlan && !selfCloseNew && !isTechnician && (
                                <Button onClick={() => onFinalSave("Wait for approve")} disabled={saving || showSuccessBanner || !canSave || brandBlocked} className="tw-bg-gray-800 hover:!tw-bg-blue-600 tw-text-white hover:tw-shadow-lg hover:!tw-shadow-blue-500/30 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed disabled:tw-shadow-none">
                                    {saving ? t("saving", lang) : t("save", lang)}
                                </Button>
                            )}
                            {/* ปุ่มหลักของขั้นวางแผน → In Progress — ต้องกรอกข้อมูลใบงาน + แผนให้ครบก่อนถึงกดได้
                                needsSchedule = "Assign" (มอบช่าง+กำหนดวัน) / material,site condition = "บันทึก" (รอของ/รอหน้างาน) */}
                            {/* planner เปิดเคสเอง + ติ๊กปิดใบงาน — บันทึกแล้วเปิดฟอร์ม In Progress ต่อทันที */}
                            {!isEdit && selfCloseNew && isPlanner && (
                                <Button onClick={() => onFinalSave("Wait for schedule", { selfClose: true })}
                                    disabled={saving || showSuccessBanner || !canSave || brandBlocked}
                                    className="tw-bg-green-600 hover:tw-bg-green-700 tw-text-white hover:tw-shadow-lg hover:tw-shadow-green-500/30 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed disabled:tw-shadow-none">
                                    {saving ? t("saving", lang) : (lang === "th" ? "บันทึกและกรอกผล" : "Save and enter results")}
                                </Button>
                            )}
                            {canPlan && (
                                <Button onClick={() => openCommentModal("assign")} disabled={saving || showSuccessBanner || !!lockedBy || !canSubmitPlan || (!isEdit && (!canSave || brandBlocked))}
                                    className="tw-bg-amber-500 hover:tw-bg-amber-600 tw-text-white hover:tw-shadow-lg hover:tw-shadow-amber-500/30 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed disabled:tw-shadow-none">
                                    {saving ? t("saving", lang) : (needsSchedule ? t("assign", lang) : t("save", lang))}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </form>

            {/* Modal: อนุมัติ/มอบหมาย/บันทึก = ยืนยันเฉย ๆ | ตีกลับ/ยกเลิก = กรอกเหตุผล */}
            {commentModal.open && (() => {
                const mode = commentModal.mode;
                const isComment = mode === "reject" || mode === "cancel"; // ต้องกรอกเหตุผล
                // ค่าตาม mode: [title, bodyText/label, confirmLabel, onConfirm, confirmColor]
                const cfg: Record<typeof mode, { title: string; body: string; confirm: string; onConfirm: () => void; color: string }> = {
                    approve: { title: t("approveTitle", lang), body: t("approveConfirmText", lang), confirm: t("confirmApprove", lang), onConfirm: handleCsApprove, color: "tw-bg-green-600 hover:tw-bg-green-700" },
                    assign: { title: needsSchedule ? t("assignTitle", lang) : t("saveTitle", lang), body: needsSchedule ? t("assignConfirmText", lang) : t("assignConfirmTextNoSched", lang), confirm: needsSchedule ? t("confirmAssign", lang) : t("confirmSaveBtn", lang), onConfirm: () => { closeCommentModal(); onFinalSave("In Progress"); }, color: "tw-bg-amber-600 hover:tw-bg-amber-700" },
                    save: { title: t("saveTitle", lang), body: t("saveConfirmText", lang), confirm: t("confirmSaveBtn", lang), onConfirm: () => { closeCommentModal(); onFinalSave(status || "Wait for approve"); }, color: "tw-bg-gray-800 hover:tw-bg-blue-600" },
                    reject: { title: t("rejectTitle", lang), body: t("rejectReason", lang), confirm: t("confirmReject", lang), onConfirm: handleReject, color: "tw-bg-red-600 hover:tw-bg-red-700" },
                    cancel: { title: t("cancelTitle", lang), body: t("cancelReason", lang), confirm: t("confirmCancel", lang), onConfirm: handleCancelJob, color: "tw-bg-amber-600 hover:tw-bg-amber-700" },
                };
                const c = cfg[mode];
                const placeholder = mode === "cancel" ? t("cancelReasonPlaceholder", lang) : t("rejectReasonPlaceholder", lang);
                return (
                    <div className="tw-fixed tw-inset-0 tw-z-[100] tw-flex tw-items-center tw-justify-center tw-bg-black/40 tw-p-4" onClick={closeCommentModal}>
                        <div className="tw-w-full tw-max-w-md tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-xl" onClick={(e) => e.stopPropagation()}>
                            <h3 className="tw-text-lg tw-font-bold tw-text-blue-gray-800 tw-mb-3">{c.title}</h3>
                            {isComment ? (
                                <>
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-700 tw-mb-2">{c.body} <span className="tw-text-red-500">*</span></label>
                                    <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={3} placeholder={placeholder} className="!tw-w-full !tw-border-blue-gray-200 !tw-bg-white" containerProps={{ className: "!tw-min-w-0" }} />
                                </>
                            ) : (
                                <p className="tw-text-sm tw-text-blue-gray-600">{c.body}</p>
                            )}
                            <div className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-pt-4">
                                <Button variant="outlined" onClick={closeCommentModal} disabled={saving} className="tw-border-blue-gray-200 tw-text-blue-gray-700">
                                    {t("backToList", lang)}
                                </Button>
                                <Button onClick={c.onConfirm} disabled={saving || (isComment && !commentText.trim())} className={`tw-text-white disabled:tw-opacity-50 disabled:tw-cursor-not-allowed ${c.color}`}>
                                    {c.confirm}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </section>
    );
}
