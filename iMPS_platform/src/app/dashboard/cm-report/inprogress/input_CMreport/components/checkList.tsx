"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Button, Input, Textarea } from "@material-tailwind/react";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeftIcon, ArrowUturnLeftIcon, PhotoIcon, XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon, PencilIcon } from "@heroicons/react/24/solid";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import CreatableSelect from "react-select/creatable";
import { useDraft, type DraftData, type DraftImage, type DraftCorrectiveAction } from "../lib/draft";
import { failureCodeLabel } from "@/app/dashboard/cm-report/lib/failureCode";
import {
    useMaximoFailureTree, maximoCodeLabel, isMaximoCode, failureClassRole, type SelectOption,
    maximoProblemOptions, maximoCauseOptions, maximoRemedyOptions,
} from "@/app/dashboard/cm-report/lib/maximo";
import { cmBackRoute } from "@/app/dashboard/cm-report/lib/origin";
import ChargerIdentity, { type ChargerIdentityData } from "@/app/dashboard/cm-report/components/ChargerIdentity";
import { repairResultLabel, normalizeRepairResult, REPAIR_RESULT_VALUES } from "@/app/dashboard/cm-report/lib/repairResult";
import { ZoomableImg, AttachmentFileRow, isImageAttachment } from "@/app/dashboard/cm-report/components/photo-viewer";

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
    srNo: { th: "เลขที่ SR", en: "SR No." },
    woNo: { th: "เลขที่ WO", en: "WO No." },
    foundDate: { th: "วันที่แจ้ง", en: "Found Date" },
    location: { th: "สถานที่", en: "Location" },
    reportedBy: { th: "ผู้แจ้งปัญหา", en: "Reported by" },
    editor: { th: "ผู้แก้ไข", en: "Editor" },
    inspector: { th: "ผู้ตรวจสอบ", en: "Inspector" },
    repairer: { th: "ผู้เข้าแก้ไข", en: "Repairer" },
    inspectorEntered: { th: "ผู้ตรวจสอบ", en: "Inspector" },
    faultyEquipment: { th: "อุปกรณ์ที่พัง", en: "Faulty Equipment" },
    repairedEquipment: { th: "การแก้ไข", en: "Correction" },
    selectEquipmentPlaceholder: { th: "เลือกอุปกรณ์...", en: "Select equipment..." },
    chargersGroup: { th: "Chargers", en: "Chargers" },
    devicesGroup: { th: "อุปกรณ์ในตู้", en: "Cabinet Devices" },
    otherEquipmentGroup: { th: "อุปกรณ์อื่นๆ", en: "Other Equipment" },
    loadingChargers: { th: "กำลังโหลด...", en: "Loading..." },
    loadingDevices: { th: "กำลังโหลดอุปกรณ์...", en: "Loading devices..." },
    noChargersFound: { th: "ไม่พบ Charger", en: "No chargers found" },
    problemDetails: { th: "รายละเอียดปัญหา", en: "Problem Details" },
    severity: { th: "ความเร่งด่วน", en: "Urgency" },
    problemType: { th: "ปัญหา", en: "Problem Description" },
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
    beforePhoto: { th: "รูปก่อนแก้ไข (สูงสุด 10 รูป)", en: "Before (up to 10 photos)" },
    afterPhoto: { th: "รูปหลังแก้ไข (สูงสุด 10 รูป)", en: "After (up to 10 photos)" },
    repairResult: { th: "ผลหลังซ่อม", en: "Repair Result" },
    // preventiveAction: { th: "วิธีป้องกันไม่ให้เกิดซ้ำ", en: "Preventive Action" },
    addPreventive: { th: "เพิ่ม", en: "Add" },
    resolvedDate: { th: "วันที่เริ่มแก้ไข", en: "Start Repair Date" },
    completedDate: { th: "วันที่แก้ไขเสร็จ", en: "Completed Date" },

    // Section 3 - Problem Summary
    problemSummarySection: { th: "ปัญหาที่พบ", en: "Problem Found" },
    cause: { th: "สาเหตุ", en: "Cause" },

    // Buttons
    saving: { th: "กำลังบันทึก...", en: "Saving..." },
    closed: { th: "Closed", en: "Closed" },
    cancelWorkOrder: { th: "ยกเลิกใบงาน", en: "Cancel work order" },
    cancelReason: { th: "เหตุผลที่ยกเลิก", en: "Cancellation reason" },
    confirmCancel: { th: "ยืนยันยกเลิก", en: "Confirm cancel" },
    cancelling: { th: "กำลังยกเลิก...", en: "Cancelling..." },
    save: { th: "บันทึก", en: "Save" },
    repairRound: { th: "แก้ไขครั้งที่", en: "Repair round" },
    rrResult: { th: "ผลหลังซ่อม", en: "Repair result" },
    rrProblem: { th: "ปัญหา", en: "Problem" },
    rrCause: { th: "สาเหตุ", en: "Cause" },
    rrAction: { th: "การแก้ไข", en: "Corrective action" },
    rrEquipment: { th: "อุปกรณ์ที่ซ่อม", en: "Repaired equipment" },
    rrRemarks: { th: "หมายเหตุ", en: "Remarks" },
    rrBefore: { th: "รูปก่อนแก้ไข", en: "Before" },
    rrAfter: { th: "รูปหลังแก้ไข", en: "After" },
    rrStartedAt: { th: "วันที่เข้าแก้ไข", en: "Repair started" },
    rrFinishedAt: { th: "วันที่แก้ไขเสร็จ", en: "Repair finished" },
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
    validProblemType: { th: "ปัญหา", en: "Problem Description" },
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
type Severity = "" | "Low" | "Medium" | "High" | "Urgent";
type Status = "" | "Open" | "In Progress" | "Wait for approve" | "Complete" | "Closed";
type ServerPhoto = { filename: string; size: number; url: string; remark?: string; uploadedAt?: string; location?: string; };
type PhotoItem = { id: string; file: File | null; preview: string; isServer?: boolean; serverUrl?: string; createdAt?: string; uploadedAtRaw?: string; location?: string; name?: string; };
type CorrectiveItem = { text: string; beforeImages: PhotoItem[]; afterImages: PhotoItem[]; code?: string; };

/** แปลง uploadedAt → display string, รองรับทั้ง ISO date และ string ที่ format แล้ว */
function formatPhotoDate(dateStr: string | undefined): string | undefined {
    if (!dateStr) return undefined;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
        return d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
    }
    // ถ้า parse ไม่ได้ = string ที่ format แล้ว → ใช้ตรงๆ
    return dateStr;
}

type Job = {
    issue_id: string; doc_name: string; found_date: string; found_time: string; location: string;
    charger_no?: string; charger_sn?: string;
    problem_details: string; problem_type: string[]; severity: Severity;
    initial_cause: string; status: Status; remarks: string; faulty_equipment: string;
    corrective_actions: CorrectiveItem[];
    start_repair_date: string;
    resolved_date: string;
    repair_result: string;
    preventive_action: string[];
    repaired_equipment: string[];
    inprogress_remarks: string;
    repair_result_remark: string; // หมายเหตุผลหลังซ่อม (ติดตามผล/รออะไหล่)
    cause: string[]; // NEW: สาเหตุ (เลือกได้หลายอัน)
    problem_type_other: string; // ระบุเมื่อเลือก อื่นๆ
    signature: string; // ลายเซ็นผู้ซ่อม (dataURL PNG) — แสดง/บันทึกเมื่อแก้ไขสำเร็จ
    start_repair_time: string; // เวลาเริ่มแก้ไข (HH:MM)
    resolved_time: string; // เวลาแก้ไขสำเร็จ (HH:MM)
};

type ChargerInfo = { chargerNo?: number; charger_id?: string; charger_name?: string; SN?: string; sn?: string; chargerType?: string; };
type ValidationItem = { key: string; label: string; isValid: boolean; message: string; isRequired: boolean; scrollId?: string; };

// ตัวเลือกผลหลังซ่อมของช่าง — ไม่มี "wait for manpower" เพราะพอช่างมากรอกฟอร์มนี้ก็ไม่ได้รอช่างแล้ว
// (manpower เป็นสถานะที่ planner ตั้งตอน assign ไม่ใช่ผลที่ช่างเลือกเอง)
// ผลซ่อม 1 รอบ — ช่างบันทึกเป็นสถานะรอ (material/site) แล้วกลับมาซ่อมใหม่ รอบเดิมย้ายมาเก็บที่นี่
type RepairRound = {
    // วันที่/เวลาที่ช่างเริ่มลงมือแก้ไขรอบนั้น (ไม่ใช่เวลาที่กดบันทึก)
    start_repair_date?: string;
    start_repair_time?: string;
    // วันที่/เวลาที่ปิดรอบนั้น = ตอนกดบันทึกเป็นสถานะรอ
    finish_date?: string;
    finish_time?: string;
    // ชื่อฟิลด์เดิม (เก็บ "เวลาที่กดบันทึก") — ความหมายตรงกับ finish ไม่ใช่ start
    saved_date?: string;
    saved_time?: string;
    repair_result?: string;
    repair_result_remark?: string;
    problem_type?: string[];
    problem_type_other?: string;
    cause?: string[];
    repaired_equipment?: string[];
    inprogress_remarks?: string;
    corrective_actions?: { code?: string; text?: string; beforeImages?: { url?: string }[]; afterImages?: { url?: string }[] }[];
};

// ผลซ่อมที่แปลว่ายังซ่อมไม่จบ ต้องรอของ/รอหน้างาน → บันทึกแล้วปิดรอบ ขึ้นรอบใหม่เมื่อกลับมา
const WAITING_REPAIR_RESULTS = [
    "WO - wait for material", "WO - wait for spare part",
    "WO - wait for site condition", "WO - wait for site access",
];

// ป้ายชื่อทั้งชุดอยู่ใน lib/repairResult — ตาราง In Progress ใช้ตัวเดียวกัน ชื่อจะได้ไม่หลุดกัน
// value ที่บันทึกยังเป็นภาษาอังกฤษเสมอ (Maximo/backend อ้างค่านี้) แปลแค่ตอนแสดง
const REPAIR_OPTIONS = REPAIR_RESULT_VALUES;
const DEFAULT_REPAIR_RESULT = "WO - wait for scheduled";

function asStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(v => String(v ?? "").trim()).filter(Boolean);
    const text = String(value ?? "").trim();
    return text ? [text] : [];
}

// รวมค่าตามตำแหน่งชุด ไม่ใช้ Set เพราะชุดที่ 1/2 สามารถเลือก code เดียวกันได้
function mergeStringArraysByIndex(...values: unknown[]): string[] {
    const arrays = values.map(asStringArray);
    const maxLength = Math.max(0, ...arrays.map(items => items.length));
    return Array.from({ length: maxLength }, (_, index) => {
        for (const items of arrays) {
            if (items[index]) return items[index];
        }
        return "";
    }).filter(Boolean);
}

// ค่าผลหลังซ่อมที่ถือว่าเป็นสถานะ "รอ" (WO waiting) — ยังคงอยู่ In Progress
// คง scheduled ไว้ที่นี่ เพราะใบที่ planner เพิ่ง assign ยังถือค่านี้อยู่ ต้องจำแนกให้ถูก
// รวมค่าเก่า (manpower / spare part / site access) เพื่อจำแนกใบเก่าให้ถูก
const WO_WAITING_RESULTS = [
    "WO - wait for scheduled", "WO - wait for manpower",
    "WO - wait for material", "WO - wait for spare part",
    "WO - wait for site condition", "WO - wait for site access",
    "WO - wait for approve",
];


// ผลหลังซ่อมที่แปลว่า "ซ่อมจบรอบสุดท้ายแล้ว" → ใบเข้าคิวรออนุมัติ/ปิดงาน
// ค่าที่ dropdown ส่งจริงคือ "WO - wait for approve" (label คือ "แก้ไขสำเร็จ")
// ส่วนข้อความไทยเป็นค่าของใบเก่าและใบที่ backend เขียนทับตอนอนุมัติปิดงาน
// ต้องเทียบทั้งสองแบบ ไม่งั้นเงื่อนไข "ซ่อมจบแล้ว" จะไม่เคยเป็นจริงกับข้อมูลใหม่
const COMPLETED_REPAIR_RESULTS = ["WO - wait for approve", "แก้ไขสำเร็จ", "แก้ไขไม่สำเร็จ"];

// ปิดงานด้วย "ไม่พบปัญหา" — ต้องเขียนผลหลังซ่อมเป็นค่านี้ ไม่ปล่อยให้ค้างเป็น marker
// "WO - wait for scheduled" ที่ planner ตั้งไว้ (ไม่งั้นแดชบอร์ดจะนับใบนี้เป็น "รอกำหนดการ")
const NO_PROBLEM_REPAIR_RESULT = "ไม่พบปัญหา";

// ตัวเลือกท้าย dropdown ปัญหา — แสดงเสมอทุก failure code
const PROGRESS_REQUIRED_KEYS = ["problemType", "problemTypeOther", "cause"];

// เลือก "แก้ไขสำเร็จ" = ปิดงาน ต้องมีหลักฐานครบ
const COMPLETED_REQUIRED_KEYS = ["problemType", "cause", "correction", "correctiveAction", "beforePhoto", "afterPhoto", "repairResult"];

// รูปของแต่ละรอบซ่อมต้องไม่ไปกองรวมกลุ่มเดียวกัน — index ของ corrective action
// รีเซ็ตทุกรอบ จึงบวก offset ตามจำนวนรอบที่เก็บเข้าประวัติแล้ว (คงรูปแบบ before_<เลข> ไว้)
const PHOTO_GROUP_ROUND_STRIDE = 100;

// "ไม่พบปัญหา" เป็นตัวเลือกของ iMPS เอง ไม่มีใน Maximo — ช่างต้องปิดใบงานได้
// แม้ตรวจแล้วไม่เจออะไรผิดปกติ
const NO_PROBLEM_OPTION = { value: "NOPROBLM", th: "ไม่พบปัญหา", en: "No Problem Found" } as const;

// ตัวเลือกของ dropdown ปัญหา/สาเหตุ/การแก้ไข มาจาก Maximo (IN04) อย่างเดียว
// backend cache ตารางไว้ใน MongoDB ให้แล้ว ฟอร์มจึงไม่ได้ยิง Maximo เองทุกครั้ง
const toOptions = (codes: { code: string; description: string }[] | null): SelectOption[] | null =>
    codes?.length ? codes.map(c => ({ value: c.code, label: c.description || c.code })) : null;


const LOGO_SRC = "/img/logo_egat.png";
const LIST_ROUTE = "/dashboard/cm-report";
const MAX_PHOTOS = 10;
const FIXED_EQUIPMENT = ["MDB", "CCB", "CB-BOX", "Station"] as const;

// ==================== อุปกรณ์ภายในของแต่ละ Non-Charger (Placeholder - แก้ทีหลัง) ====================
const NON_CHARGER_DEVICES: Record<string, string[]> = {
    mdb: ["MCCB", "ACB", "Surge Arrester", "Power Meter", "Busbar", "CT", "PT"],
    ccb: ["MCCB", "Contactor", "Relay", "Terminal Block", "Fuse", "Wiring"],
    "cb-box": ["MCB", "RCBO", "Surge Protection", "Terminal Block", "Busbar"],
    station: ["Network Switch", "Router", "UPS", "CCTV", "Access Control", "Fire Alarm", "Lighting"],
};

const INITIAL_JOB: Job = {
    issue_id: "", doc_name: "", found_date: "", found_time: "", location: "", problem_details: "",
    charger_no: "", charger_sn: "",
    problem_type: [], severity: "", initial_cause: "", status: "", remarks: "", faulty_equipment: "",
    corrective_actions: [{ text: "", beforeImages: [], afterImages: [] }],
    resolved_date: "",
    start_repair_date: "",
    repair_result: DEFAULT_REPAIR_RESULT,
    preventive_action: [""],
    repaired_equipment: [],
    inprogress_remarks: "",
    repair_result_remark: "",
    cause: [], // NEW
    problem_type_other: "",
    signature: "",
    start_repair_time: "",
    resolved_time: "",
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ==================== react-select: style กลาง (chips) ====================
type SelectAccent = { pill: string; pillText: string; ring: string; border: string };
const SELECT_ACCENT: Record<"blue" | "amber", SelectAccent> = {
    blue: { pill: "#eff6ff", pillText: "#1d4ed8", ring: "rgba(59,130,246,0.18)", border: "#3b82f6" },
    amber: { pill: "#fffbeb", pillText: "#b45309", ring: "rgba(245,158,11,0.18)", border: "#f59e0b" },
};
const makeSelectStyles = (a: SelectAccent): any => ({
    control: (base: any, s: any) => ({
        ...base,
        minHeight: "48px",
        borderRadius: "12px",
        borderWidth: "1px",
        borderColor: s.isDisabled ? "#e5e7eb" : s.isFocused ? a.border : "#e5e7eb",
        backgroundColor: s.isDisabled ? "#f9fafb" : "#ffffff",
        boxShadow: s.isFocused ? `0 0 0 3px ${a.ring}` : "none",
        padding: "2px 4px",
        transition: "border-color .15s ease, box-shadow .15s ease",
        "&:hover": { borderColor: s.isDisabled ? "#e5e7eb" : a.border },
    }),
    valueContainer: (base: any) => ({ ...base, padding: "3px 6px", gap: "5px" }),
    placeholder: (base: any) => ({ ...base, color: "#9ca3af", fontSize: "14px" }),
    input: (base: any) => ({ ...base, fontSize: "14px", margin: 0, padding: 0 }),
    multiValue: (base: any) => ({ ...base, backgroundColor: a.pill, borderRadius: "9999px", border: `1px solid ${a.border}33`, overflow: "hidden", margin: "2px" }),
    multiValueLabel: (base: any) => ({ ...base, color: a.pillText, fontWeight: 600, fontSize: "12.5px", padding: "3px 4px 3px 10px" }),
    multiValueRemove: (base: any) => ({ ...base, color: a.pillText, paddingRight: "6px", borderRadius: "9999px", "&:hover": { backgroundColor: a.pillText, color: "#ffffff" } }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base: any, s: any) => ({ ...base, color: s.isFocused ? a.pillText : "#9ca3af", padding: "6px", "&:hover": { color: a.pillText } }),
    clearIndicator: (base: any) => ({ ...base, color: "#9ca3af", padding: "6px", "&:hover": { color: "#ef4444" } }),
    menu: (base: any) => ({ ...base, borderRadius: "14px", overflow: "hidden", boxShadow: "0 12px 34px rgba(15,23,42,0.14)", border: "1px solid #eef1f6", marginTop: "6px", zIndex: 40 }),
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
    menuList: (base: any) => ({ ...base, padding: "6px" }),
    option: (base: any, s: any) => ({
        ...base,
        borderRadius: "10px",
        fontSize: "14px",
        padding: "9px 12px",
        cursor: "pointer",
        color: s.isSelected ? "#ffffff" : "#374151",
        backgroundColor: s.isSelected ? a.pillText : s.isFocused ? a.pill : "transparent",
        fontWeight: s.isSelected ? 600 : 400,
        "&:active": { backgroundColor: a.pill },
    }),
    noOptionsMessage: (base: any) => ({ ...base, fontSize: "13px", color: "#9ca3af" }),
});


// ==================== ROW SELECT: single-select หลายแถว + ปุ่ม "+" เพิ่มแถว ====================
function RowSelect({ values, options, onChange, resolveLabel, accent, placeholder, disabled, addLabel }: {
    values: string[];
    options: { value: string; label: string }[];
    onChange: (v: string[]) => void;
    resolveLabel: (v: string) => string;
    accent: SelectAccent;
    placeholder: string;
    disabled?: boolean;
    addLabel: string;
}) {
    const rows = values.length ? values : [""];
    const setAt = (i: number, v: string) => onChange(rows.map((x, j) => (j === i ? v : x)));
    const addRow = () => onChange([...rows, ""]);
    const removeRow = (i: number) => { const next = rows.filter((_, j) => j !== i); onChange(next); };
    const lastEmpty = !rows[rows.length - 1];
    return (
        <div className="tw-space-y-2">
            {rows.map((val, i) => {
                const others = new Set(rows.filter((_, j) => j !== i).filter(Boolean));
                const avail = options.filter(o => !others.has(o.value));
                const isLast = i === rows.length - 1;
                return (
                    <div key={i} className="tw-flex tw-items-start tw-gap-2">
                        <div className="tw-flex-1 tw-min-w-0 md:tw-flex-none md:tw-w-96">
                            <CreatableSelect
                                isClearable
                                isDisabled={disabled}
                                placeholder={placeholder}
                                options={avail}
                                value={val ? { value: val, label: resolveLabel(val) } : null}
                                onChange={(opt: any) => setAt(i, opt ? opt.value : "")}
                                formatCreateLabel={(v: string) => `+ "${v}"`}
                                menuPlacement="auto"
                                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                                classNamePrefix="react-select"
                                styles={makeSelectStyles(accent)}
                            />
                        </div>
                        {rows.length > 1 && !disabled && (
                            <button type="button" onClick={() => removeRow(i)} title="ลบ" className="tw-flex-shrink-0 tw-w-12 tw-h-12 tw-rounded-xl tw-border tw-border-gray-200 tw-text-gray-400 hover:tw-text-white hover:tw-bg-red-500 hover:tw-border-red-500 tw-flex tw-items-center tw-justify-center tw-transition-all">
                                <XMarkIcon className="tw-w-5 tw-h-5" />
                            </button>
                        )}
                        {isLast && !disabled && options.length > 1 && (
                            <button type="button" onClick={addRow} disabled={lastEmpty} title={addLabel} className="tw-flex-shrink-0 tw-w-12 tw-h-12 tw-rounded-xl tw-border tw-flex tw-items-center tw-justify-center hover:tw-brightness-95 disabled:tw-opacity-40 disabled:tw-cursor-not-allowed tw-transition-all tw-text-xl tw-font-bold tw-leading-none"
                                style={{ borderColor: accent.border, backgroundColor: accent.pill, color: accent.pillText }}>+</button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ==================== VALIDATION CARD ====================
// แปลงรหัสที่เก็บใน DB (เช่น "POWMODUL") เป็นข้อความที่อ่านรู้เรื่อง
// การ์ดประวัติไม่รู้ว่า failure code ตอนนั้นคืออะไร จึงค้นจากทั้งต้นไม้ของ Maximo
// รหัสที่ไม่รู้จัก (ค่าที่ผู้ใช้พิมพ์เอง / ใบงานเก่า) จะคืนค่าเดิมกลับไป
export const problemLabelOf = (v: string) =>
    v === NO_PROBLEM_OPTION.value ? NO_PROBLEM_OPTION.th : maximoCodeLabel(v);
export const causeLabelOf = (v: string) => maximoCodeLabel(v);

function RepairRoundCard({ round, index, lang }: { round: RepairRound; index: number; lang: Lang }) {
    const src = (u?: string) => (!u ? "" : u.startsWith("http") ? u : `${API_BASE}${u}`);
    const problems = [...(round.problem_type ?? []).map(problemLabelOf), round.problem_type_other ?? ""].map(x => (x || "").trim()).filter(Boolean);
    const causes = (round.cause ?? []).map(x => causeLabelOf((x || "").trim())).filter(Boolean);
    const equipment = (round.repaired_equipment ?? []).map(x => (x || "").trim()).filter(Boolean);
    const actions = (round.corrective_actions ?? []).filter(
        a => (a.text || "").trim() || (a.beforeImages?.length ?? 0) > 0 || (a.afterImages?.length ?? 0) > 0
    );
    const startedAt = [round.start_repair_date, round.start_repair_time].filter(Boolean).join(" ");
    // saved_* ของข้อมูลเก่าคือเวลาที่กดบันทึก = เวลาปิดรอบ จึง fallback มาที่นี่
    const finishedAt = [round.finish_date || round.saved_date, round.finish_time || round.saved_time].filter(Boolean).join(" ");

    const block = (label: string, body: React.ReactNode) => (
        <div className="tw-mb-3 last:tw-mb-0">
            <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{label}</p>
            {body}
        </div>
    );
    const line = (v?: string) => <p className="tw-text-sm tw-text-blue-gray-800 tw-break-words">{v?.trim() ? v : "-"}</p>;
    const thumbs = (label: string, imgs: { url?: string }[]) =>
        imgs.length ? (
            <div className="tw-mt-2">
                <p className="tw-text-[11px] tw-text-blue-gray-400 tw-mb-1">{label}</p>
                <div className="tw-flex tw-flex-wrap tw-gap-2">
                    {imgs.map((im, k) => (
                        <a key={k} href={src(im.url)} target="_blank" rel="noreferrer"
                            className="tw-block tw-w-20 tw-h-20 tw-rounded-lg tw-overflow-hidden tw-border tw-border-gray-200 tw-bg-gray-50">
                            <ZoomableImg src={src(im.url)} alt={label} className="tw-w-full tw-h-full tw-object-cover" />
                        </a>
                    ))}
                </div>
            </div>
        ) : null;

    return (
        <div className="tw-mb-4 tw-p-4 tw-rounded-xl tw-border tw-border-gray-200 tw-bg-white">
            <h4 className="tw-text-sm tw-font-bold tw-text-blue-gray-700 tw-mb-3">{t("repairRound", lang)} {index + 1}</h4>
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-3 tw-mb-3">
                <div>
                    <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{t("rrStartedAt", lang)}</p>
                    {line(startedAt)}
                </div>
                <div>
                    <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{t("rrFinishedAt", lang)}</p>
                    {line(finishedAt)}
                </div>
                <div>
                    <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{t("rrResult", lang)}</p>
                    {line(repairResultLabel(round.repair_result, lang))}
                </div>
                <div>
                    <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{t("rrRemarks", lang)}</p>
                    {line(round.repair_result_remark)}
                </div>
                {/* อุปกรณ์ที่ซ่อม — ไม่มีก็ไม่ต้องแสดงช่องนี้ */}
                {equipment.length > 0 && (
                    <div>
                        <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{t("rrEquipment", lang)}</p>
                        {line(equipment.join(", "))}
                    </div>
                )}
            </div>
            {problems.length ? block(t("rrProblem", lang), line(problems.join(", "))) : null}
            {causes.length ? block(t("rrCause", lang), line(causes.join(", "))) : null}
            {actions.length ? block(t("rrAction", lang),
                <div className="tw-space-y-3">
                    {actions.map((a, i) => (
                        <div key={i} className="tw-rounded-lg tw-bg-gray-50 tw-border tw-border-gray-200 tw-p-3">
                            {(a.text || "").trim() && <p className="tw-text-sm tw-text-blue-gray-800 tw-break-words">{a.text}</p>}
                            {thumbs(t("rrBefore", lang), a.beforeImages ?? [])}
                            {thumbs(t("rrAfter", lang), a.afterImages ?? [])}
                        </div>
                    ))}
                </div>) : null}
            {(round.inprogress_remarks || "").trim() ? block(t("rrRemarks", lang), line(round.inprogress_remarks)) : null}
        </div>
    );
}

function CMValidationCard({ validations, lang }: { validations: ValidationItem[]; lang: Lang; }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const requiredValidations = validations.filter(v => v.isRequired);
    const allRequiredValid = requiredValidations.every(v => v.isValid);
    const missingCount = requiredValidations.filter(v => !v.isValid).length;
    const completedCount = requiredValidations.filter(v => v.isValid).length;

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
        <div className={`tw-rounded-xl tw-border tw-shadow-sm tw-overflow-hidden ${allRequiredValid ? "tw-border-green-200 tw-bg-green-50 tw-shadow-green-500/10" : "tw-border-amber-300 tw-bg-amber-50 tw-shadow-amber-500/10"}`}>
            <div className={`tw-px-5 tw-py-4 tw-cursor-pointer tw-flex tw-items-center tw-justify-between ${allRequiredValid ? "tw-bg-green-100 hover:tw-bg-green-150" : "tw-bg-amber-100 hover:tw-bg-amber-200/60"} tw-transition-colors`} onClick={() => setIsExpanded(!isExpanded)}>
                <div className="tw-flex tw-items-center tw-gap-3">
                    <div className={`tw-w-10 tw-h-10 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-shadow-md ${allRequiredValid ? "tw-bg-green-500" : "tw-bg-amber-500"}`}>
                        {allRequiredValid ? <CheckCircleIcon className="tw-w-6 tw-h-6 tw-text-white" /> : <ExclamationTriangleIcon className="tw-w-6 tw-h-6 tw-text-white" />}
                    </div>
                    <div>
                        <p className={`tw-font-bold tw-text-base ${allRequiredValid ? "tw-text-green-800" : "tw-text-amber-800"}`}>{t("formStatus", lang)}</p>
                        <p className={`tw-text-sm ${allRequiredValid ? "tw-text-green-600" : "tw-text-amber-700"}`}>
                            {allRequiredValid ? t("allComplete", lang) : `${completedCount}/${requiredValidations.length} — ${t("remaining", lang)} ${missingCount} ${t("items", lang)}`}
                        </p>
                    </div>
                </div>
                <svg className={`tw-w-6 tw-h-6 ${allRequiredValid ? "tw-text-green-600" : "tw-text-amber-700"} tw-transition-transform ${isExpanded ? "tw-rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
            {isExpanded && (
                <div className="tw-px-5 tw-py-4 tw-space-y-3">
                    {/* ⚠️ รายการที่ยังไม่ได้กรอก */}
                    {missingCount > 0 && (
                        <div className="tw-bg-white tw-rounded-lg tw-p-4 tw-border tw-border-amber-300">
                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                <p className="tw-font-semibold tw-text-amber-800 tw-text-sm">⚠️ {lang === "th" ? "ยังไม่ได้กรอก" : "Missing"}</p>
                                <span className="tw-text-xs tw-bg-amber-100 tw-text-amber-800 tw-px-2.5 tw-py-0.5 tw-rounded-full tw-font-semibold">{missingCount}</span>
                            </div>
                            <ul className="tw-space-y-1.5">
                                {requiredValidations.filter(v => !v.isValid).map(v => (
                                    <li key={v.key} onClick={() => scrollToElement(v.scrollId)} className="tw-flex tw-items-start tw-gap-2 tw-text-sm tw-text-amber-800 tw-cursor-pointer hover:tw-text-amber-900 hover:tw-bg-amber-50 tw-rounded tw-px-2 tw-py-1 tw-transition-colors">
                                        <span className="tw-text-amber-600 tw-mt-0.5 tw-font-bold">→</span>
                                        <span><span className="tw-font-semibold">{v.label}:</span> <span className="tw-underline tw-underline-offset-2">{v.message}</span></span>
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

// ==================== PHOTO UPLOAD ====================
function PhotoUpload({ photos_problem, onAdd, onRemove, max, disabled, lang }: { photos_problem: PhotoItem[]; onAdd: (files: FileList) => void; onRemove: (id: string) => void; max: number; disabled: boolean; lang: Lang; }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canAddMore = photos_problem.length < max && !disabled;
    // ไฟล์ที่แนบมาจากหน้า Open (PDF) พรีวิวไม่ได้ → แยกไปเป็นรายการแถว ไม่กินช่องกริดรูป
    const images = photos_problem.filter(p => isImageAttachment(p.preview));
    const files = photos_problem.filter(p => !isImageAttachment(p.preview));

    return (
        <div className="tw-space-y-4">
            {!disabled && <div className="tw-text-sm tw-text-blue-gray-600">Max {max} photos</div>}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="tw-hidden" onChange={e => { if (e.target.files) { onAdd(e.target.files); e.target.value = ""; } }} />
            {photos_problem.length > 0 ? (
                <div className="tw-grid tw-grid-cols-3 sm:tw-grid-cols-4 md:tw-grid-cols-5 tw-gap-3">
                    {images.map(photo => (
                        <div key={photo.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-200 tw-bg-blue-gray-50 tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                            <ZoomableImg src={photo.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                            {(photo.createdAt || photo.location) && (
                                <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                    {photo.createdAt && <span className="tw-block tw-font-mono">{photo.createdAt}</span>}
                                    {photo.location && <span className="tw-block tw-opacity-80 tw-truncate">📍 {photo.location}</span>}
                                </span>
                            )}
                            {photo.isServer && (
                                <span className="tw-absolute tw-bottom-1 tw-left-1 tw-text-[10px] tw-bg-blue-500 tw-text-white tw-px-1.5 tw-py-0.5 tw-rounded">{lang === "th" ? "บันทึกแล้ว" : "Saved"}</span>
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
                            <span className="tw-text-xs tw-mt-1 tw-font-bold">{lang === "th" ? "แนบรูป" : "ATTACH"}</span>
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

            {/* ไฟล์แนบ (PDF) จากหน้า Open — รายการแถว ไม่ทำพรีวิวใหญ่เหมือนรูป */}
            {files.length > 0 && (
                <div className="tw-flex tw-flex-wrap tw-gap-2">
                    {files.map(f => (
                        <AttachmentFileRow key={f.id} src={f.preview} name={f.name} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ==================== SEVERITY COLOR ====================
function getSeverityColor(severity: string) {
    switch (severity?.toLowerCase()) {
        case "urgent":
        case "critical": return { dot: "tw-bg-red-500", text: "tw-text-red-700" };
        case "high": return { dot: "tw-bg-orange-500", text: "tw-text-orange-700" };
        case "medium": return { dot: "tw-bg-amber-500", text: "tw-text-amber-700" };
        case "low": return { dot: "tw-bg-green-500", text: "tw-text-green-700" };
        default: return { dot: "tw-bg-gray-400", text: "tw-text-gray-600" };
    }
}

// ==================== PROBLEM GROUP (ชุดกรอกเพิ่ม: ปัญหา→สาเหตุ→การแก้ไข→การดำเนินการ) ====================
type PGroup = { kind: "full" | "cause" | "correction"; problem_type: string[]; cause: string[]; repaired_equipment: string[]; corrective_actions: CorrectiveItem[] };
const newGroup = (kind: "full" | "cause" | "correction"): PGroup => ({ kind, problem_type: [], cause: [], repaired_equipment: [], corrective_actions: [{ text: "", beforeImages: [], afterImages: [] }] });
// เปลี่ยนตัวเลือกด้านบนแล้วต้องถอด code ที่ผูกไว้ออก แต่ "รายละเอียดการแก้ไข" กับรูป
// เป็นสิ่งที่ผู้ใช้พิมพ์/แนบเอง ห้ามล้าง — planner มาแก้ต่อจากช่างแล้วข้อมูลหายทั้งชุด
const detachCorrectiveCodes = (actions: CorrectiveItem[]): CorrectiveItem[] => actions.map(action => ({
    ...action,
    code: undefined,
}));
const retainCorrectiveDataForCodes = (actions: CorrectiveItem[], codes: string[]): CorrectiveItem[] => {
    const keep = new Set(codes.filter(Boolean));
    return actions.map(action => keep.has(action.code || "")
        ? action
        : { ...action, code: undefined });   // ถอดแค่ code — ข้อความที่พิมพ์ไว้ต้องอยู่ต่อ
};
const matchingCorrectionCodes = (
    tree: ReturnType<typeof useMaximoFailureTree>,
    faultyEquipment: string,
    problems: string[],
    causes: string[],
    currentCodes: string[],
): string[] => {
    const options = toOptions(maximoRemedyOptions(tree, faultyEquipment, problems, causes));
    // Maximo กำลังโหลด/ไม่มีรายการ: อย่าเสี่ยงล้างข้อมูลเดิม
    if (!options?.length) return currentCodes.filter(Boolean);
    const available = new Set(options.map(option => option.value));
    return currentCodes.filter(code => available.has(code));
};

function ProblemGroupBlock({ faultyEquipment, value, onChange, onRemove, onAddGroup, onAddCauseGroup, onAddCorrectionGroup, mainProblem, mainCause, takenCauses, takenCorrections, lang, index, disabled = false }: {
    faultyEquipment: string; value: PGroup; onChange: (g: PGroup) => void; onRemove: () => void; onAddGroup: () => void; onAddCauseGroup: () => void; onAddCorrectionGroup: () => void; mainProblem: string[]; mainCause: string[]; takenCauses: string[]; takenCorrections: string[]; lang: Lang; index: number; disabled?: boolean;
}) {
    const isCauseOnly = value.kind === "cause";            // บล็อกสาเหตุ: ไม่มีช่องปัญหา ใช้ปัญหาหลักคำนวณ
    const isCorrectionOnly = value.kind === "correction";  // บล็อกการแก้ไข: มีแค่การแก้ไข→การดำเนินการ ใช้ปัญหา+สาเหตุหลัก
    const effProblems = (isCauseOnly || isCorrectionOnly) ? mainProblem : value.problem_type;
    const effCauses = isCorrectionOnly ? mainCause : value.cause;

    const maximoTree = useMaximoFailureTree();
    const failureProblemOptions = toOptions(maximoProblemOptions(maximoTree, faultyEquipment));
    const problemSelectOptions = [
        ...(failureProblemOptions ?? []),
        { value: NO_PROBLEM_OPTION.value, label: lang === "en" ? NO_PROBLEM_OPTION.en : NO_PROBLEM_OPTION.th },
    ];
    const resolveProblemLabel = (v: string) => problemSelectOptions.find(o => o.value === v)?.label ?? v;

    const causeOptions = toOptions(maximoCauseOptions(maximoTree, faultyEquipment, effProblems));
    const resolveCauseLabel = (v: string) => causeOptions?.find(o => o.value === v)?.label ?? v;
    // ตัด "สาเหตุ" ที่ถูกเลือกไว้ในช่องอื่นออก (กันเลือกซ้ำ) — เก็บค่าของตัวเองไว้
    const causeOptionsAvail = causeOptions
        ? causeOptions.filter(o => !takenCauses.includes(o.value) || value.cause.includes(o.value))
        : null;

    // ถ้าสาเหตุที่เหลือให้เลือกมีแค่อันเดียว → เลือกให้อัตโนมัติ
    useEffect(() => {
        if (disabled) return;
        if (causeOptionsAvail && causeOptionsAvail.length === 1) {
            const only = causeOptionsAvail[0].value;
            if (value.cause.length !== 1 || value.cause[0] !== only) {
                onChange({ ...value, cause: [only] });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [takenCauses.join(","), effProblems.join(","), faultyEquipment]);

    const correctionOptions = toOptions(
        maximoRemedyOptions(maximoTree, faultyEquipment, effProblems, effCauses));
    const resolveCorrectionLabel = (v: string) => correctionOptions?.find(o => o.value === v)?.label ?? formatDeviceName(v);
    // ตัด "การแก้ไข" ที่ถูกเลือกไว้ในช่องอื่นออก (กันเลือกซ้ำ) — เก็บค่าของตัวเองไว้ เกณฑ์เดียวกับสาเหตุ
    const storedCorrectionOptions = value.repaired_equipment
        .filter(Boolean)
        .map(v => ({ value: v, label: resolveCorrectionLabel(v) }));
    const correctionOptionsAvailList = [
        ...(correctionOptions ?? []).filter(o => !takenCorrections.includes(o.value) || value.repaired_equipment.includes(o.value)),
        ...storedCorrectionOptions.filter(stored => !(correctionOptions ?? []).some(option => option.value === stored.value)),
    ];
    const correctionOptionsAvail = correctionOptionsAvailList.length ? correctionOptionsAvailList : null;

    // auto-sync การดำเนินการแก้ไข ตามการแก้ไขที่เลือก
    // เปลี่ยนตัวเลือกแล้วห้ามลบแถวเดิม เพราะแถวนั้นอาจมีรูป/รายละเอียดที่กรอกไว้แล้ว
    useEffect(() => {
        if (disabled) return;
        const codes = value.repaired_equipment.filter(Boolean);
        const codeSet = new Set(codes);
        // ถ้าเอาการแก้ไขเดิมออก ให้คงแถวและรูปไว้ แต่ถอด code ออกเพื่อไม่ให้รูปหาย
        let next = value.corrective_actions.map(a =>
            a.code && !codeSet.has(a.code)
                ? { ...a, code: undefined }
                : a
        );
        if (next.length === 0) next = [{ text: "", beforeImages: [], afterImages: [] }];
        const have = new Set(next.map(a => a.code).filter(Boolean));
        for (const c of codes) {
            if (have.has(c)) continue;
            const reusableIndex = next.findIndex(a => !a.code);
            if (reusableIndex < 0) continue;
            next = next.map((a, i) => i === reusableIndex ? { ...a, code: c } : a);
            have.add(c);
        }
        const same = next.length === value.corrective_actions.length && next.every((a, i) => a === value.corrective_actions[i]);
        if (!same) onChange({ ...value, corrective_actions: next });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value.repaired_equipment]);

    const setText = (i: number, text: string) => onChange({ ...value, corrective_actions: value.corrective_actions.map((a, j) => j === i ? { ...a, text } : a) });
    const addImgs = (i: number, kind: "beforeImages" | "afterImages", files: FileList | null) => {
        if (!files) return;
        const currentCount = value.corrective_actions[i]?.[kind]?.length ?? 0;
        const remain = Math.max(0, MAX_PHOTOS - currentCount);
        if (remain === 0 || files.length > remain) {
            alert(lang === "th"
                ? `แนบรูปได้สูงสุด ${MAX_PHOTOS} รูปต่อรายการ (เพิ่มได้อีก ${remain} รูป)`
                : `Maximum ${MAX_PHOTOS} photos per item (${remain} remaining)`);
        }
        if (remain === 0) return;
        const pfx = kind === "beforeImages" ? "before" : "after";
        const imgs: PhotoItem[] = Array.from(files).slice(0, remain).map((f, k) => ({ id: `${pfx}-${Date.now()}-${i}-${k}-${f.name}`, file: f, preview: URL.createObjectURL(f) }));
        onChange({ ...value, corrective_actions: value.corrective_actions.map((a, j) => j === i ? { ...a, [kind]: [...a[kind], ...imgs].slice(0, MAX_PHOTOS) } : a) });
    };
    const removeImg = (i: number, kind: "beforeImages" | "afterImages", id: string) => {
        onChange({ ...value, corrective_actions: value.corrective_actions.map((a, j) => j === i ? { ...a, [kind]: a[kind].filter(im => im.id !== id) } : a) });
    };

    const th = lang === "th";
    return (
        <div className="tw-pt-5 tw-mt-1 tw-border-t tw-border-dashed tw-border-blue-gray-200 tw-space-y-5">
            <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
                <span className="tw-inline-flex tw-items-center tw-gap-2 tw-font-semibold tw-text-sm tw-text-blue-gray-700"><span className="tw-w-6 tw-h-6 tw-rounded-full tw-bg-blue-100 tw-text-blue-700 tw-flex tw-items-center tw-justify-center tw-text-xs tw-font-bold">{index + 2}</span>{isCauseOnly ? (th ? `สาเหตุเพิ่มเติม (ชุดที่ ${index + 2})` : `Additional cause (Set ${index + 2})`) : isCorrectionOnly ? (th ? `การแก้ไขเพิ่มเติม (ชุดที่ ${index + 2})` : `Additional correction (Set ${index + 2})`) : (th ? `ชุดที่ ${index + 2}` : `Set ${index + 2}`)}</span>
                {!disabled && (
                    <button type="button" onClick={onRemove} className="tw-w-8 tw-h-8 tw-rounded-lg tw-text-red-400 hover:tw-text-white hover:tw-bg-red-500 tw-flex tw-items-center tw-justify-center tw-transition-all" title={th ? "ลบชุดนี้" : "Remove set"}>
                        <XMarkIcon className="tw-w-5 tw-h-5" />
                    </button>
                )}
            </div>
                {/* ปัญหา (เฉพาะบล็อกชุดปัญหาเต็ม) */}
                {!isCauseOnly && !isCorrectionOnly && (
                <div className="tw-space-y-2">
                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700"><span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500"></span>{th ? "ปัญหา" : "Problem"}</label>
                    <div className="tw-flex tw-items-start tw-gap-2 md:tw-w-96">
                        <div className="tw-flex-1 tw-min-w-0">
                            <CreatableSelect isClearable
                                placeholder={th ? "เลือกปัญหา..." : "Select problem..."}
                                options={problemSelectOptions}
                                value={value.problem_type[0] ? { value: value.problem_type[0], label: resolveProblemLabel(value.problem_type[0]) } : null}
                                isDisabled={disabled}
                                onChange={(opt: any) => {
                                    const nextProblems = opt ? [opt.value] : [];
                                    const keptCorrections = matchingCorrectionCodes(
                                        maximoTree,
                                        faultyEquipment,
                                        nextProblems,
                                        [],
                                        value.repaired_equipment,
                                    );
                                    onChange({
                                        ...value,
                                        problem_type: nextProblems,
                                        cause: [],
                                        repaired_equipment: keptCorrections,
                                        corrective_actions: retainCorrectiveDataForCodes(value.corrective_actions, keptCorrections),
                                    });
                                }}
                                formatCreateLabel={(v: string) => `+ "${v}"`}
                                menuPlacement="auto" menuPortalTarget={typeof document !== "undefined" ? document.body : undefined} classNamePrefix="react-select" styles={makeSelectStyles(SELECT_ACCENT.blue)} />
                        </div>
                        {!disabled && <button type="button" onClick={onAddGroup} title={th ? "เพิ่มชุดปัญหาใหม่" : "Add new problem set"} className="tw-flex-shrink-0 tw-w-12 tw-h-12 tw-rounded-xl tw-border tw-border-blue-300 tw-bg-blue-50 tw-text-blue-600 tw-flex tw-items-center tw-justify-center hover:tw-bg-blue-100 tw-transition-all tw-text-xl tw-font-bold tw-leading-none">+</button>}
                    </div>
                </div>
                )}
                {/* สาเหตุ */}
                {!isCorrectionOnly && (
                <div className="tw-space-y-2">
                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700"><span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500"></span>{th ? "สาเหตุ" : "Cause"}</label>
                    <div className="tw-flex tw-items-start tw-gap-2">
                        <div className="tw-flex-1 tw-min-w-0 md:tw-flex-none md:tw-w-96">
                            <CreatableSelect isClearable
                                placeholder={th ? "เลือกสาเหตุ..." : "Select cause..."}
                                options={causeOptionsAvail ?? []}
                                isDisabled={disabled || !causeOptionsAvail}
                                value={value.cause[0] ? { value: value.cause[0], label: resolveCauseLabel(value.cause[0]) } : null}
                                onChange={(opt: any) => {
                                    const nextCauses = opt ? [opt.value] : [];
                                    const keptCorrections = matchingCorrectionCodes(
                                        maximoTree,
                                        faultyEquipment,
                                        effProblems,
                                        nextCauses,
                                        value.repaired_equipment,
                                    );
                                    onChange({
                                        ...value,
                                        cause: nextCauses,
                                        repaired_equipment: keptCorrections,
                                        corrective_actions: retainCorrectiveDataForCodes(value.corrective_actions, keptCorrections),
                                    });
                                }}
                                formatCreateLabel={(v: string) => `+ "${v}"`}
                                menuPlacement="auto" menuPortalTarget={typeof document !== "undefined" ? document.body : undefined} classNamePrefix="react-select" styles={makeSelectStyles(SELECT_ACCENT.blue)} />
                        </div>
                        {!disabled && (causeOptionsAvail?.length ?? 0) > 1 && (
                            <button type="button" onClick={onAddCauseGroup} title={th ? "เพิ่มสาเหตุ" : "Add cause"} className="tw-flex-shrink-0 tw-w-12 tw-h-12 tw-rounded-xl tw-border tw-border-blue-300 tw-bg-blue-50 tw-text-blue-600 tw-flex tw-items-center tw-justify-center hover:tw-bg-blue-100 tw-transition-all tw-text-xl tw-font-bold tw-leading-none">+</button>
                        )}
                    </div>
                </div>
                )}
                {/* การแก้ไข */}
                <div className="tw-space-y-2">
                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700"><span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>{th ? "การแก้ไข" : "Correction"}</label>
                    <div className="tw-flex tw-items-start tw-gap-2">
                        <div className="tw-flex-1 tw-min-w-0 md:tw-flex-none md:tw-w-96">
                            <CreatableSelect isClearable
                                placeholder={th ? "เลือกการแก้ไข..." : "Select correction..."}
                                options={correctionOptionsAvail ?? []}
                                isDisabled={disabled || !correctionOptionsAvail}
                                value={value.repaired_equipment[0] ? { value: value.repaired_equipment[0], label: resolveCorrectionLabel(value.repaired_equipment[0]) } : null}
                                onChange={(opt: any) => {
                                    const nextCorrections = opt ? [opt.value] : [];
                                    const sameCorrection = nextCorrections.length === value.repaired_equipment.length
                                        && nextCorrections.every((code, i) => code === value.repaired_equipment[i]);
                                    onChange({
                                        ...value,
                                        repaired_equipment: nextCorrections,
                                        corrective_actions: sameCorrection
                                            ? value.corrective_actions
                                            : detachCorrectiveCodes(value.corrective_actions),
                                    });
                                }}
                                formatCreateLabel={(v: string) => `+ "${v}"`}
                                menuPlacement="auto" menuPortalTarget={typeof document !== "undefined" ? document.body : undefined} classNamePrefix="react-select" styles={makeSelectStyles(SELECT_ACCENT.amber)} />
                        </div>
                        {!disabled && (correctionOptionsAvail?.length ?? 0) > 1 && (
                            <button type="button" onClick={onAddCorrectionGroup} title={th ? "เพิ่มการแก้ไข" : "Add correction"} className="tw-flex-shrink-0 tw-w-12 tw-h-12 tw-rounded-xl tw-border tw-flex tw-items-center tw-justify-center hover:tw-brightness-95 tw-transition-all tw-text-xl tw-font-bold tw-leading-none" style={{ borderColor: SELECT_ACCENT.amber.border, backgroundColor: SELECT_ACCENT.amber.pill, color: SELECT_ACCENT.amber.pillText }}>+</button>
                        )}
                    </div>
                </div>
                {/* การดำเนินการแก้ไข */}
                {value.corrective_actions.length > 0 && (
                    <div className="tw-space-y-4">
                        <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700"><span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>{th ? "การดำเนินการแก้ไข" : "Corrective Actions"}</label>
                        {value.corrective_actions.map((action, i) => (
                            <div key={i}>
                                {i > 0 && <hr className="tw-border-gray-200 tw-my-5" />}
                                <div className="tw-flex tw-gap-4">
                                    <div className="tw-flex-1 tw-space-y-4">
                                        {!disabled && value.corrective_actions.length > 1 && (
                                            <div className="tw-flex tw-justify-end">
                                                <button type="button" onClick={() => onChange({ ...value, corrective_actions: value.corrective_actions.filter((_, j) => j !== i) })} className="tw-w-10 tw-h-10 tw-rounded-lg tw-text-red-400 hover:tw-text-white hover:tw-bg-red-500 tw-flex tw-items-center tw-justify-center tw-transition-all">
                                                    <XMarkIcon className="tw-w-5 tw-h-5" />
                                                </button>
                                            </div>
                                        )}
                                        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                                            {/* Before Images */}
                                            <div className="tw-border tw-border-red-200 tw-rounded-xl tw-p-4 tw-bg-red-50/30">
                                                <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                                    <span className="tw-text-sm tw-font-semibold tw-text-red-700 tw-flex tw-items-center tw-gap-2"><span className="tw-w-2 tw-h-2 tw-rounded-full tw-bg-red-500"></span>{t("beforePhoto", lang)} <span className="tw-text-red-500">*</span></span>
                                                    {!disabled && (
                                                        <label className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-lg tw-bg-white tw-border tw-border-red-300 tw-text-red-600 tw-font-medium tw-text-xs tw-cursor-pointer hover:tw-bg-red-50 tw-shadow-sm tw-transition-all">
                                                            <input type="file" accept="image/*" multiple className="tw-hidden" onChange={(e) => addImgs(i, "beforeImages", e.target.files)} />
                                                            <PhotoIcon className="tw-w-4 tw-h-4" /><span>{t("attachPhoto", lang)}</span>
                                                        </label>
                                                    )}
                                                </div>
                                                {action.beforeImages.length > 0 ? (
                                                    <div className="tw-grid tw-grid-cols-3 tw-gap-2">
                                                        {action.beforeImages.map((img) => (
                                                            <div key={img.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-red-200 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                                                                <ZoomableImg src={img.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                                                                {(img.createdAt || img.location) && (
                                                                    <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                                                        {img.createdAt && <span className="tw-block tw-font-mono">{img.createdAt}</span>}
                                                                        {img.location && <span className="tw-block tw-opacity-80 tw-truncate">📍 {img.location}</span>}
                                                                    </span>
                                                                )}
                                                                {!disabled && <button type="button" onClick={() => removeImg(i, "beforeImages", img.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-lg tw-transition-all"><XMarkIcon className="tw-w-3.5 tw-h-3.5" /></button>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="tw-text-center tw-py-6 tw-text-red-500 tw-text-sm tw-font-medium">{th ? "⚠️ กรุณาแนบรูปก่อนแก้ไข" : "⚠️ Please attach before image"}</div>
                                                )}
                                            </div>
                                            {/* After Images */}
                                            <div className="tw-border tw-border-green-200 tw-rounded-xl tw-p-4 tw-bg-green-50/30">
                                                <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                                    <span className="tw-text-sm tw-font-semibold tw-text-green-700 tw-flex tw-items-center tw-gap-2"><span className="tw-w-2 tw-h-2 tw-rounded-full tw-bg-green-500"></span>{t("afterPhoto", lang)}</span>
                                                    {!disabled && (
                                                        <label className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-lg tw-bg-white tw-border tw-border-green-300 tw-text-green-600 tw-font-medium tw-text-xs tw-cursor-pointer hover:tw-bg-green-50 tw-shadow-sm tw-transition-all">
                                                            <input type="file" accept="image/*" multiple className="tw-hidden" onChange={(e) => addImgs(i, "afterImages", e.target.files)} />
                                                            <PhotoIcon className="tw-w-4 tw-h-4" /><span>{t("attachPhoto", lang)}</span>
                                                        </label>
                                                    )}
                                                </div>
                                                {action.afterImages.length > 0 ? (
                                                    <div className="tw-grid tw-grid-cols-3 tw-gap-2">
                                                        {action.afterImages.map((img) => (
                                                            <div key={img.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-green-200 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                                                                <ZoomableImg src={img.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                                                                {(img.createdAt || img.location) && (
                                                                    <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                                                        {img.createdAt && <span className="tw-block tw-font-mono">{img.createdAt}</span>}
                                                                        {img.location && <span className="tw-block tw-opacity-80 tw-truncate">📍 {img.location}</span>}
                                                                    </span>
                                                                )}
                                                                {!disabled && <button type="button" onClick={() => removeImg(i, "afterImages", img.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-lg tw-transition-all"><XMarkIcon className="tw-w-3.5 tw-h-3.5" /></button>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="tw-text-center tw-py-6 tw-text-green-600 tw-text-sm tw-font-medium">{th ? "ยังไม่มีรูปหลังแก้ไข" : "No after image yet"}</div>
                                                )}
                                            </div>
                                        </div>
                                        <textarea value={action.text} disabled={disabled} onChange={(e) => setText(i, e.target.value)} rows={3} placeholder={th ? "กรอกรายละเอียดการดำเนินการ..." : "Enter action details..."} className="tw-w-full tw-px-3 tw-py-2 tw-border tw-border-gray-300 tw-rounded-lg tw-text-sm tw-bg-white focus:tw-outline-none focus:tw-border-amber-400 tw-transition-colors tw-resize-y" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
        </div>
    );
}

// ==================== MAIN COMPONENT ====================
export default function CMInProgressForm() {
    const { lang } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const [stationId, setStationId] = useState<string | null>(null);
    const [job, setJob] = useState<Job>({ ...INITIAL_JOB });
    // ตัวตนของตู้ที่ backend resolve มาให้ — ชื่อ / เลขตู้ / S/N / บริษัทผู้ถือครอง
    const [chargerIdentity, setChargerIdentity] = useState<ChargerIdentityData | null>(null);
    const loadedJobRef = useRef<Job | null>(null);
    // refs สำหรับปุ่ม "+" เปิด dropdown เพื่อเลือกเพิ่ม
    const problemSelectRef = useRef<any>(null);
    const causeSelectRef = useRef<any>(null);
    const correctionSelectRef = useRef<any>(null);
    // ชุดกรอกเพิ่ม (ปัญหา→สาเหตุ→การแก้ไข→การดำเนินการ) — รวมเข้ากับ set แรกตอนบันทึก
    const [extraGroups, setExtraGroups] = useState<PGroup[]>([]);
    const addProblemGroup = () => setExtraGroups(g => [...g, newGroup("full")]);
    const addCauseGroup = () => setExtraGroups(g => [...g, newGroup("cause")]);
    const addCorrectionGroup = () => setExtraGroups(g => [...g, newGroup("correction")]);
    const [reportedBy, setReportedBy] = useState("");
    const [inspector, setInspector] = useState("");
    const [recordInspector, setRecordInspector] = useState(""); // inspector ที่บันทึกในใบงานแล้ว = เจ้าของใบงานเฟสซ่อม
    // ประวัติผลซ่อมรอบก่อน ๆ (อ่านอย่างเดียว) — flat fields คือรอบที่กำลังกรอก
    const [repairHistory, setRepairHistory] = useState<RepairRound[]>([]);
    const [assignees, setAssignees] = useState<string[]>([]);   // ช่างที่ planner มอบหมายตอนวางแผน
    // ตาราง failure code จาก Maximo (IN04) — ผสมกับตารางในโค้ดเพื่อทำ dropdown ปัญหา→สาเหตุ→การแก้ไข
    const maximoTree = useMaximoFailureTree();
    const [currentUsername, setCurrentUsername] = useState("");
    const [currentRole, setCurrentRole] = useState("");
    const [approvedBy, setApprovedBy] = useState("");
    const [approvalStage, setApprovalStage] = useState("");
    const [approving, setApproving] = useState(false);
    const [approveOpen, setApproveOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelRemark, setCancelRemark] = useState("");
    const [cancelling, setCancelling] = useState(false);
    const [plannerEditMode, setPlannerEditMode] = useState(false);
    const [editConfirmOpen, setEditConfirmOpen] = useState(false);
    // ตีกลับใบงาน — ต้องกรอกเหตุผลให้ช่างรู้ว่าต้องแก้อะไร
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectRemark, setRejectRemark] = useState("");
    const [rejecting, setRejecting] = useState(false);
    // เหตุผลที่ใบนี้เคยถูกตีกลับ (โหลดจาก server) — แสดงให้ช่างเห็นว่าต้องแก้อะไร
    const [rejectedInfo, setRejectedInfo] = useState<{ remark: string; by: string }>({ remark: "", by: "" });
    const [cancelledInfo, setCancelledInfo] = useState<{ remark: string; by: string }>({ remark: "", by: "" });
    const [saving, setSaving] = useState(false);
    // ผลหลังซ่อมที่มีอยู่ใน DB ก่อนช่างแก้ — ใช้กันไม่ให้ค่าถูกล้างตอนบันทึกโดยไม่ได้เลือกผลใหม่
    const originalRepairResultRef = useRef<string>("");
    const [photos_problem, setPhotosProblem] = useState<PhotoItem[]>([]);
    const [chargers, setChargers] = useState<ChargerInfo[]>([]);
    const [loadingChargers, setLoadingChargers] = useState(false);
    const [devices, setDevices] = useState<string[]>([]);
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [jobLoaded, setJobLoaded] = useState(false);
    const [startRepairStamped, setStartRepairStamped] = useState(false);
    // ช่างกดปุ่ม "เริ่มแก้ไข" แล้วหรือยัง — ก่อนกดจะเห็นเฉพาะข้อมูลที่ CS/Planner กรอกมาแบบอ่านอย่างเดียว
    const [repairStartedManually, setRepairStartedManually] = useState(false);

    const editId = searchParams.get("edit_id") ?? "";
    const isEdit = !!editId;
    const plannerSelfCloseRequested = searchParams.get("self_close") === "1";

    // เปิดใบงานที่ปิดแล้ว (Closed) = โหมดดูอย่างเดียว (อ่านไม่แก้, ปิดฟีเจอร์ร่าง)
    // สิทธิ์กรอกใบงานเฟสซ่อม = ต้องเป็นช่างที่ planner มอบหมายตอนวางแผน (อยู่ใน assignees) หรือ admin
    // ใบเก่าที่ไม่มี assignees → fallback กติกาเดิม (inspector ว่าง = ใครก็เริ่มได้ / คน save แรกเป็นเจ้าของ)
    const isAssignee =
        !!currentUsername.trim() &&
        assignees.some((a) => (a || "").trim().toLowerCase() === currentUsername.trim().toLowerCase());
    const isPlanner = currentRole.trim().toLowerCase() === "planner";
    const isCs = currentRole.trim().toLowerCase() === "cs";
    const isTechnician = currentRole.trim().toLowerCase() === "technician";
    const isJobOwner =
        ["admin", "super_admin"].includes(currentRole.trim().toLowerCase()) ||
        (assignees.length > 0
            ? isAssignee
            : (!recordInspector.trim() || (!!currentUsername.trim() && currentUsername.trim() === recordInspector.trim())));
    // รองรับทั้ง Closed ใหม่และ Complete เดิมที่ยังอยู่ในฐานข้อมูล
    const normalizedJobStatus = job.status.trim().toLowerCase();
    const isClosedStatus = normalizedJobStatus === "closed" || normalizedJobStatus === "complete";
    const isCancelledStatus = normalizedJobStatus === "cancelled";
    const isWaitForSchedule = normalizedJobStatus === "wait for schedule";
    // ใช้ status จริงเป็นตัวกำหนด Read only เท่านั้น
    // การเลือก Repair Result = WO - wait for approve ยังต้องแก้ไข/บันทึกได้ก่อน
    const isWaitForApprove = normalizedJobStatus === "wait for approve";
    // Planner แก้ไขข้อมูลของ Technician ได้เฉพาะใบที่ส่งมารออนุมัติปิดงานแล้ว
    // ส่วน In Progress/Wait for schedule เป็นหน้าที่ของ Technician จึงเปิดดูได้อย่างเดียว
    const isWoCloseApproval =
        isWaitForApprove &&
        approvalStage.trim().toLowerCase() !== "cs_approval";
    const canEditTechnicianData = isPlanner && isWoCloseApproval;
    // เปิดให้ Planner กรอกผลได้เฉพาะเมื่อเลือก "สามารถปิดใบงานได้เลย" จากหน้าวางแผน
    const plannerSelfCloseMode = plannerSelfCloseRequested && isPlanner && isWaitForSchedule;
    const isTechnicianWaitForApprove = isTechnician && isWaitForApprove;
    // ด่านรออนุมัติจาก CS เป็นหน้าตรวจอย่างเดียว
    // ส่วนด่านปิดงานเปิดให้ Planner แก้ข้อมูลของช่างแล้วบันทึก/อนุมัติได้
    const viewOnly =
        isCs ||
        isClosedStatus ||
        isCancelledStatus ||
        isTechnicianWaitForApprove ||
        (isWaitForApprove && !canEditTechnicianData) ||
        (isPlanner && !plannerSelfCloseMode && (!canEditTechnicianData || !plannerEditMode)) ||
        (!isPlanner && !isJobOwner);

    // ช่างเปิดใบงานครั้งแรก = อ่านข้อมูลจาก CS/Planner ก่อน แล้วค่อยกด "เริ่มแก้ไข" ถึงจะเห็นส่วนที่ต้องกรอก
    // ใบที่เคยเริ่มแก้ไขแล้ว (มีเวลาเริ่ม) เข้ามาก็กรอกต่อได้เลย — role อื่นไม่ต้องผ่านด่านนี้
    const repairStarted =
        !isTechnician || viewOnly || repairStartedManually || !!job.start_repair_date || !!job.start_repair_time;

    // อนุมัติปิดใบงาน (Wait for approve → Closed) — เฉพาะ admin/planner และเฉพาะใบที่รออนุมัติอยู่จริง
    const canApprove =
        isWoCloseApproval &&
        ["admin", "planner"].includes(currentRole.trim().toLowerCase());
    const canCancelJob =
        isEdit &&
        !isClosedStatus &&
        normalizedJobStatus !== "cancelled" &&
        ["admin", "owner", "planner", "technician", "super_admin"].includes(currentRole.trim().toLowerCase());
    const reviewerName = isClosedStatus ? approvedBy : currentUsername;

    const cancelAction = canCancelJob ? (
        <Button
            type="button"
            onClick={() => { setCancelRemark(""); setCancelOpen(true); }}
            disabled={saving || approving || rejecting || cancelling}
            className="tw-bg-amber-500 hover:tw-bg-amber-600 tw-text-white tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-shadow-xl hover:tw-shadow-amber-500/30 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed tw-transition-all"
        >
            {t("cancelWorkOrder", lang)}
        </Button>
    ) : null;

    const approvalActions = canApprove ? (
        <>
            <Button
                type="button"
                onClick={() => { setRejectRemark(""); setRejectOpen(true); }}
                disabled={approving || rejecting}
                className="tw-bg-red-600 hover:tw-bg-red-700 tw-text-white tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-shadow-xl hover:tw-shadow-red-500/30 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed tw-transition-all"
            >
                {lang === "th" ? "ตีกลับ" : "Reject"}
            </Button>
            <Button
                type="button"
                onClick={() => setApproveOpen(true)}
                disabled={approving || rejecting}
                className="tw-bg-green-600 hover:tw-bg-green-700 tw-text-white tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-shadow-xl hover:tw-shadow-green-500/30 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed tw-transition-all"
            >
                {approving ? (lang === "th" ? "กำลังอนุมัติ..." : "Approving...") : (lang === "th" ? "อนุมัติ" : "Approve")}
            </Button>
        </>
    ) : null;

    // planner กำลังแก้ข้อมูลของช่างค้างอยู่ — แถวปุ่มจะเหลือแค่ ยกเลิกแก้ไข + ปิดงาน
    const isPlannerEditing = isPlanner && plannerEditMode;

    const requestPlannerEdit = () => {
        if (canEditTechnicianData) setEditConfirmOpen(true);
    };

    // ค่าตอนก่อนเข้าโหมดแก้ไข — กด "ยกเลิกแก้ไข" แล้วต้องได้ข้อมูลของช่างคืนตามเดิม
    const preEditSnapshot = useRef<{ job: Job; extraGroups: PGroup[] } | null>(null);

    const confirmPlannerEdit = () => {
        setEditConfirmOpen(false);
        preEditSnapshot.current = { job, extraGroups };
        setPlannerEditMode(true);
    };

    // ออกจากโหมดแก้ไขโดยไม่บันทึก — คืนค่าที่ snapshot ไว้ กลับไปเป็นหน้าดูอย่างเดียว
    //
    // ต้องทิ้งร่างด้วย: ระหว่างแก้ไข auto-save เขียนร่างไว้ทุก 2 วิ ถ้าไม่ลบ พอกดแก้ไขรอบหน้า
    // effect โหลดร่างจะเอาค่าที่เพิ่งยกเลิกไปกลับมาทับ กลายเป็นยกเลิกไม่จริง
    const cancelPlannerEdit = () => {
        const snap = preEditSnapshot.current;
        if (snap) {
            setJob(snap.job);
            setExtraGroups(snap.extraGroups);
        }
        preEditSnapshot.current = null;
        setPendingDraft(null);
        void deleteDraft().catch(() => { /* ลบร่างไม่ได้ไม่ควรบล็อกการออกจากโหมดแก้ไข */ });
        setPlannerEditMode(false);
    };

    const currentTab = searchParams.get("tab") ?? "in-progress";

    // ==================== NAVIGATION HELPERS ====================
    // ปลายทางหลังจบ action ทุกแบบ (บันทึก/ปิดงาน/อนุมัติ/ตีกลับ/ย้อนกลับ)
    // — เข้ามาจากหน้าไหนก็กลับหน้านั้น: จาก CM Dashboard → dashboard, จากตาราง list → แท็บที่เกี่ยวข้อง
    const buildListUrl = (targetTab?: string) => {
        const backRoute = cmBackRoute(searchParams);
        if (backRoute) return backRoute;
        const p = new URLSearchParams();
        if (stationId) p.set("station_id", stationId);
        p.set("tab", targetTab ?? currentTab);
        return `${LIST_ROUTE}?${p.toString()}`;
    };

    const goBackToList = () => router.push(buildListUrl(currentTab));

    const returnToPlannerSchedule = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("self_close");
        params.set("view", "form");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    // ==================== DRAFT MANAGEMENT ====================
    const { status: draftStatus, hasDraft, saveNow: saveDraftNow, load: loadDraft, deleteDraft } = useDraft(
        editId || null,
        stationId,
        { debounceDelay: 2000 }
    );
    const [pendingDraft, setPendingDraft] = useState<DraftData | null>(null);

    useEffect(() => {
        if (!editId || !stationId || !currentRole.trim() || viewOnly) return; // โหมดดูอย่างเดียว/CS: ไม่ถามกู้ร่าง
        (async () => {
            try {
                const draft = await loadDraft();
                if (draft) setPendingDraft(draft);   // ใส่ให้เลย ไม่ต้องถาม (ดู effect ที่เรียก applyDraft)
            } catch {
                // ignore draft load failure
            }
        })();
    }, [editId, stationId, loadDraft, viewOnly, currentRole]);

    useEffect(() => {
        if (!pendingDraft || !jobLoaded) return;
        if (job.start_repair_date || job.start_repair_time) return;

        setJob(prev => ({
            ...prev,
            start_repair_date: pendingDraft.start_repair_date || prev.start_repair_date,
            start_repair_time: pendingDraft.start_repair_time || prev.start_repair_time,
        }));
        setStartRepairStamped(true);
    }, [pendingDraft, jobLoaded, job.start_repair_date, job.start_repair_time]);

    const applyDraft = () => {
        if (pendingDraft) {
            const draftActionsToCorrective = (actions: any[] = []): CorrectiveItem[] => actions.map((a: any) => ({
                code: a.code,
                text: a.text || "",
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
                })),
            }));
            const mergeDraftActionsWithServer = (draftActions: CorrectiveItem[], serverActions: CorrectiveItem[]): CorrectiveItem[] => {
                const draftHasData = draftActions.some(action =>
                    !!action.code ||
                    action.text.trim() !== "" ||
                    action.beforeImages.length > 0 ||
                    action.afterImages.length > 0
                );
                if (!draftHasData) return serverActions.length > 0 ? serverActions : [{ text: "", beforeImages: [], afterImages: [] }];

                const count = Math.max(draftActions.length, serverActions.length);
                return Array.from({ length: count }, (_, index) => {
                    const draftAction = draftActions[index];
                    const serverAction = serverActions[index];
                    if (!draftAction) return serverAction;
                    if (!serverAction) return draftAction;
                    return {
                        ...serverAction,
                        ...draftAction,
                        code: draftAction.code || serverAction.code,
                        text: draftAction.text.trim() ? draftAction.text : serverAction.text,
                        beforeImages: draftAction.beforeImages.length ? draftAction.beforeImages : serverAction.beforeImages,
                        afterImages: draftAction.afterImages.length ? draftAction.afterImages : serverAction.afterImages,
                    };
                }).filter(Boolean) as CorrectiveItem[];
            };
            setJob(prev => ({
                ...prev,
                corrective_actions: pendingDraft.corrective_actions?.length > 0
                    ? mergeDraftActionsWithServer(draftActionsToCorrective(pendingDraft.corrective_actions), prev.corrective_actions)
                    : prev.corrective_actions,
                repaired_equipment: pendingDraft.repaired_equipment || [],
                // ร่างที่ถูกบันทึกไว้ก่อนช่างเลือกผลจะถือค่า default อยู่ — ถ้าเอามาทับดื้อๆ
                // ผลหลังซ่อมที่บันทึกไว้ใน server จะหาย ใช้ค่าจากร่างเฉพาะตอนที่เป็นตัวเลือกจริง
                repair_result: pendingDraft.repair_result && pendingDraft.repair_result !== DEFAULT_REPAIR_RESULT
                    ? pendingDraft.repair_result
                    : prev.repair_result,
                preventive_action: pendingDraft.preventive_action?.length > 0
                    ? pendingDraft.preventive_action
                    : [""],
                inprogress_remarks: pendingDraft.inprogress_remarks || "",
                repair_result_remark: pendingDraft.repair_result_remark || "",
                problem_type: pendingDraft.problem_type?.length ? pendingDraft.problem_type : prev.problem_type,
                problem_type_other: pendingDraft.problem_type_other || prev.problem_type_other,
                cause: pendingDraft.cause?.length ? pendingDraft.cause : prev.cause,
                start_repair_date: pendingDraft.start_repair_date || prev.start_repair_date,
                start_repair_time: pendingDraft.start_repair_time || prev.start_repair_time,
            }));
            // ร่างเก่าจะไม่มี extra_groups — กรณีนั้นปล่อยค่าที่โหลดจาก server ไว้
            if (Array.isArray(pendingDraft.extra_groups)) {
                setExtraGroups(previousGroups => {
                    const draftGroups = pendingDraft.extra_groups ?? [];
                    // Draft เก่าที่ไม่มีชุดเพิ่ม ห้ามล้างชุดที่โหลดจาก Server
                    if (draftGroups.length === 0 && previousGroups.length > 0) return previousGroups;

                    const groupCount = Math.max(draftGroups.length, previousGroups.length);
                    return Array.from({ length: groupCount }, (_, index) => {
                        const group = draftGroups[index];
                        const serverGroup = previousGroups[index];
                        if (!group) return serverGroup;
                        if (!serverGroup) {
                            return {
                                kind: group.kind === "cause" || group.kind === "correction" ? group.kind : "full",
                                problem_type: Array.isArray(group.problem_type) ? group.problem_type : [],
                                cause: Array.isArray(group.cause) ? group.cause : [],
                                repaired_equipment: Array.isArray(group.repaired_equipment) ? group.repaired_equipment : [],
                                corrective_actions: draftActionsToCorrective(group.corrective_actions),
                            };
                        }

                        const draftActions = draftActionsToCorrective(group.corrective_actions);
                        return {
                            ...serverGroup,
                            kind: group.kind === "cause" || group.kind === "correction" ? group.kind : serverGroup.kind,
                            problem_type: Array.isArray(group.problem_type) && group.problem_type.length ? group.problem_type : serverGroup.problem_type,
                            cause: Array.isArray(group.cause) && group.cause.length ? group.cause : serverGroup.cause,
                            repaired_equipment: Array.isArray(group.repaired_equipment) && group.repaired_equipment.length ? group.repaired_equipment : serverGroup.repaired_equipment,
                            // Draft ที่ไม่ครบจะไม่ทับรูป/รายละเอียดจาก Server
                            corrective_actions: mergeDraftActionsWithServer(draftActions, serverGroup.corrective_actions),
                        };
                    }).filter(Boolean) as PGroup[];
                });
            }
        }
        setPendingDraft(null);
    };

    // ใส่ร่างอัตโนมัติหลังใบงานโหลดเสร็จ — เดิมเด้ง dialog ถามว่าจะโหลดร่างมั้ย
    // ผู้ใช้กดบันทึกไว้เองอยู่แล้ว จึงเอาของที่บันทึกไว้มาให้เลย ไม่ต้องถามซ้ำ
    // ต้องรอ jobLoaded ก่อน ไม่งั้น applyDraft จะ merge กับ prev ที่ยังว่าง แล้วโดนข้อมูลจาก server ทับ
    useEffect(() => {
        if (viewOnly) {
            // Draft เป็นข้อมูลชั่วคราวของช่าง ห้ามนำมาทับข้อมูลล่าสุดจาก server
            // เมื่อเปิดใบที่รออนุมัติหรือใบ Closed แบบอ่านอย่างเดียว
            if (pendingDraft) setPendingDraft(null);
            return;
        }
        if (!pendingDraft || !jobLoaded) return;
        applyDraft();
        // applyDraft เคลียร์ pendingDraft เป็น null ปิดท้าย จึงไม่วนซ้ำ
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingDraft, jobLoaded, viewOnly]);

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

    const saveDraftWithImages = useCallback(async (overrides?: Partial<DraftData>) => {
        if (!editId || !stationId) return;

        const hasData = job.corrective_actions.some((a: CorrectiveItem) => a.text.trim() !== "" || a.beforeImages.length > 0 || a.afterImages.length > 0) ||
            extraGroups.length > 0 ||
            job.repaired_equipment.length > 0 ||
            job.repair_result ||
            job.preventive_action.some((p: string) => p.trim() !== "") ||
            job.inprogress_remarks ||
            job.repair_result_remark ||
            job.problem_type.length > 0 ||
            job.cause.length > 0 ||
            job.start_repair_date ||
            job.start_repair_time;
        if (!hasData) return;

        try {
            const convertCorrectiveActionsToDraft = async (actions: CorrectiveItem[]): Promise<DraftCorrectiveAction[]> => Promise.all(
                actions.map(async (a: CorrectiveItem) => {
                    const beforeImages = await convertImagesToDraft(a.beforeImages);
                    const afterImages = await convertImagesToDraft(a.afterImages);
                    return {
                        code: a.code,
                        text: a.text,
                        beforeImages: beforeImages.filter(img => img.base64),
                        afterImages: afterImages.filter(img => img.base64),
                    };
                })
            );
            const correctiveActionsWithImages = await convertCorrectiveActionsToDraft(job.corrective_actions);
            const extraGroupsWithImages = await Promise.all(extraGroups.map(async group => ({
                kind: group.kind,
                problem_type: group.problem_type,
                cause: group.cause,
                repaired_equipment: group.repaired_equipment,
                corrective_actions: await convertCorrectiveActionsToDraft(group.corrective_actions),
            })));

            const draftData: DraftData = {
                corrective_actions: correctiveActionsWithImages,
                repaired_equipment: job.repaired_equipment,
                repair_result: job.repair_result,
                preventive_action: job.preventive_action,
                inprogress_remarks: job.inprogress_remarks,
                repair_result_remark: job.repair_result_remark,
                problem_type: job.problem_type,
                problem_type_other: job.problem_type_other,
                cause: job.cause,
                extra_groups: extraGroupsWithImages,
                start_repair_date: overrides?.start_repair_date ?? job.start_repair_date,
                start_repair_time: overrides?.start_repair_time ?? job.start_repair_time,
            };
            await saveDraftNow(draftData);
        } catch (e) {
            console.error("Failed to save draft with images:", e);
        }
    }, [job.corrective_actions, extraGroups, job.repaired_equipment, job.repair_result, job.preventive_action, job.inprogress_remarks, job.repair_result_remark, job.problem_type, job.problem_type_other, job.cause, job.start_repair_date, job.start_repair_time, editId, stationId, saveDraftNow]);

    const draftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
        if (!editId || !stationId || viewOnly) return; // โหมดดูอย่างเดียว: ไม่ auto-save ร่าง

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
    }, [saveDraftWithImages, editId, stationId, viewOnly]);

    // ==================== VALIDATION ====================
    const isClosedResult = useMemo(() => {
        return COMPLETED_REPAIR_RESULTS.includes(job.repair_result.trim());
    }, [job.repair_result]);

    // ตั้งวันและเวลาปัจจุบันให้การปิดงาน หากใบงานเดิมยังไม่มีค่า โดยไม่ทับค่าที่บันทึกไว้แล้ว
    useEffect(() => {
        if (!isClosedResult || viewOnly) return;
        const now = new Date();
        const today = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        setJob(prev => ({
            ...prev,
            resolved_date: prev.resolved_date || today,
            resolved_time: prev.resolved_time || currentTime,
        }));
    }, [isClosedResult, viewOnly]);

    // ต้องกรอกหมายเหตุเฉพาะ material / site condition — manpower / approve ไม่ต้อง (รวมค่าเก่า)
    const needsRepairRemark = useMemo(() => {
        return [
            "WO - wait for material", "WO - wait for spare part",
            "WO - wait for site condition", "WO - wait for site access",
        ].includes(job.repair_result);
    }, [job.repair_result]);

    // สถานะรออะไหล่/รอสั่งซื้อ ไม่ต้องบังคับเลือกการแก้ไขหรือกรอก corrective action
    const isWaitingForMaterial = useMemo(() => {
        return ["WO - wait for material", "WO - wait for spare part"].includes(job.repair_result);
    }, [job.repair_result]);

    const isWaitingForSiteCondition = useMemo(() => {
        return ["WO - wait for site condition", "WO - wait for site access"].includes(job.repair_result);
    }, [job.repair_result]);

    // ถ้าเลือก wait for material / spare part ให้ล้าง correction และ corrective_actions ออก
    useEffect(() => {
        if (!isWaitingForMaterial) return;
        if (job.repaired_equipment.length === 0 && job.corrective_actions.length <= 1 && !job.corrective_actions.some(a => a.code)) return;
        setJob(prev => ({
            ...prev,
            repaired_equipment: [],
            corrective_actions: [{ text: "", beforeImages: [], afterImages: [] }],
        }));
    }, [isWaitingForMaterial, job.repaired_equipment.length, job.corrective_actions.length, job.corrective_actions]);

    // ถ้าเลือก wait for site condition / site access ไม่ต้องกรอกอะไรเลยนอกจากหมายเหตุ
    useEffect(() => {
        if (!isWaitingForSiteCondition) return;
        if (
            job.problem_type.length === 0 &&
            job.cause.length === 0 &&
            job.repaired_equipment.length === 0 &&
            job.corrective_actions.length <= 1 &&
            !job.corrective_actions.some(a => a.code) &&
            extraGroups.length === 0
        ) return;
        setExtraGroups([]);
        setJob(prev => ({
            ...prev,
            problem_type: [],
            cause: [],
            repaired_equipment: [],
            corrective_actions: [{ text: "", beforeImages: [], afterImages: [] }],
        }));
    }, [isWaitingForSiteCondition, job.problem_type.length, job.cause.length, job.repaired_equipment.length, job.corrective_actions.length, job.corrective_actions, extraGroups.length]);

    // เลือกปัญหา = "ไม่พบปัญหา" → ปิดงานได้เลย ไม่ต้องกรอกรายละเอียดการซ่อม
    const isNoProblem = job.problem_type.includes(NO_PROBLEM_OPTION.value);

    // ใบที่ยังรอ planner วางแผน ปิดงานไม่ได้อยู่แล้ว จึงต้องการแค่ อาการ + สาเหตุ
    // (ผลหลังซ่อมเป็นของขั้นปิดงาน ไม่ควรบังคับในสถานะนี้)
    const validationGroupState = useMemo(() => {
        const fullGroups = extraGroups.filter(group => group.kind === "full");
        const causeGroups = extraGroups.filter(group => group.kind !== "correction");
        const allActions = [job.corrective_actions, ...extraGroups.map(group => group.corrective_actions)].flat();
        return {
            allProblemTypesFilled: job.problem_type.some(Boolean) && fullGroups.every(group => group.problem_type.some(Boolean)),
            allCausesFilled: job.cause.some(cause => cause.trim() !== "") && causeGroups.every(group => group.cause.some(cause => cause.trim() !== "")),
            allCorrectionsFilled: job.repaired_equipment.some(Boolean) && extraGroups.every(group => group.repaired_equipment.some(Boolean)),
            allActionTextsFilled: allActions.length > 0 && allActions.every(action => action.text.trim() !== ""),
            allBeforePhotosFilled: allActions.length > 0 && allActions.every(action => action.beforeImages.length > 0),
            allAfterPhotosFilled: allActions.length > 0 && allActions.every(action => action.afterImages.length > 0),
        };
    }, [job, extraGroups]);

    const additionalGroupValidations = useMemo<ValidationItem[]>(() => (
        extraGroups.flatMap((group, index) => {
            const groupNumber = index + 2;
            const checks: ValidationItem[] = [];
            if (group.kind !== "correction") {
                checks.push({
                    key: `causeGroup-${index}`,
                    label: `${t("validCause", lang)} #${groupNumber}`,
                    isValid: group.cause.some(cause => cause.trim() !== ""),
                    message: t("notFilled", lang),
                    isRequired: !isNoProblem && !isWaitingForSiteCondition,
                    scrollId: "cm-cause",
                });
            }
            checks.push({
                key: `correctionGroup-${index}`,
                label: `${t("repairedEquipment", lang)} #${groupNumber}`,
                isValid: group.repaired_equipment.some(Boolean),
                message: t("notSelected", lang),
                isRequired: isClosedResult && !isNoProblem,
                scrollId: "cm-correction",
            });
            return checks;
        })
    ), [extraGroups, lang, isNoProblem, isWaitingForSiteCondition, isClosedResult]);

    const validations = useMemo<ValidationItem[]>(() => [
        { key: "problemType", label: t("validProblemType", lang), isValid: validationGroupState.allProblemTypesFilled, message: t("notSelected", lang), isRequired: !isWaitingForSiteCondition, scrollId: "cm-problem-type" },
        { key: "problemTypeOther", label: lang === "th" ? "ระบุปัญหา (อื่นๆ)" : "Specify Problem (Other)", isValid: !!job.problem_type_other.trim(), message: t("notFilled", lang), isRequired: job.problem_type.includes("Other"), scrollId: "cm-problem-type" },
        { key: "cause", label: t("validCause", lang), isValid: validationGroupState.allCausesFilled, message: t("notFilled", lang), isRequired: !isNoProblem && !isWaitingForSiteCondition, scrollId: "cm-cause" },
        // ปิดงานได้ต่อเมื่อระบุ "การแก้ไข" แล้ว — เดิมมี effect คอยรีเซ็ตผลหลังซ่อมแทน
        // แต่มันเทียบกับ label ("แก้ไขสำเร็จ") ไม่ใช่ value จึงไม่เคยทำงาน
        { key: "correction", label: t("repairedEquipment", lang), isValid: validationGroupState.allCorrectionsFilled, message: t("notSelected", lang), isRequired: isClosedResult && !isNoProblem, scrollId: "cm-correction" },
        { key: "correctiveAction", label: t("validCorrectiveAction", lang), isValid: validationGroupState.allActionTextsFilled, message: t("notFilled", lang), isRequired: !isNoProblem && !isWaitingForMaterial && !isWaitingForSiteCondition, scrollId: "cm-corrective" },
        { key: "beforePhoto", label: t("validBeforePhoto", lang), isValid: validationGroupState.allBeforePhotosFilled, message: t("notFilled", lang), isRequired: !isNoProblem && !isWaitingForMaterial && !isWaitingForSiteCondition, scrollId: "cm-corrective" },
        { key: "afterPhoto", label: t("validAfterPhoto", lang), isValid: validationGroupState.allAfterPhotosFilled, message: t("notFilled", lang), isRequired: isClosedResult && !isNoProblem, scrollId: "cm-corrective" },
        { key: "repairResult", label: t("validRepairResult", lang), isValid: !!job.repair_result, message: t("notSelected", lang), isRequired: !isNoProblem, scrollId: "cm-repair-result" },
        // { key: "preventiveAction", label: t("preventiveAction", lang), isValid: job.preventive_action.some((p: string) => p.trim() !== ""), message: t("notFilled", lang), isRequired: isClosedResult && !isNoProblem, scrollId: "cm-preventive" },
        { key: "inprogressRemarks", label: lang === "th" ? "หมายเหตุผลหลังซ่อม" : "Repair Result Remark", isValid: !!job.repair_result_remark.trim(), message: t("notFilled", lang), isRequired: needsRepairRemark, scrollId: "cm-repair-result" },
        { key: "noProblemPhoto", label: lang === "th" ? "รูปภาพ" : "Photo", isValid: (job.corrective_actions[0]?.afterImages.length ?? 0) > 0, message: t("notFilled", lang), isRequired: isNoProblem, scrollId: "cm-noproblem-photo" },
        { key: "noProblemRemarks", label: t("remarks", lang), isValid: !!job.inprogress_remarks.trim(), message: t("notFilled", lang), isRequired: isNoProblem, scrollId: "cm-remarks" },
        ...additionalGroupValidations,
    ], [job, lang, isClosedResult, needsRepairRemark, isNoProblem, validationGroupState, isWaitingForMaterial, isWaitingForSiteCondition, additionalGroupValidations]);

    // "แก้ไขสำเร็จ" ใน dropdown มี value = "WO - wait for approve" (label ต่างจาก value)
    // isClosedResult เทียบข้อความไทยซึ่งเป็นค่าของใบเก่า จึงต้องเช็คค่าใหม่เพิ่มเอง
    const isRepairCompleted = job.repair_result === "WO - wait for approve" || isClosedResult;

    // ยังไม่เลือกผลหลังซ่อม ให้บังคับเลือกผลก่อนบันทึกข้อมูลหลัก
    // (ยกเว้นเคส "ไม่พบปัญหา" ที่ปิดงานได้โดยไม่ต้องเลือกผลหลังซ่อม)
    // "WO - wait for scheduled" คือ marker ที่ planner ตั้งตอน assign ไม่ใช่ผลที่ช่างเลือก
    // จึงนับว่ายังไม่เลือกผล (ปกติฟอร์มล้างเป็นค่าว่างตอนโหลดอยู่แล้ว เช็คซ้ำกันเส้นทางอื่น)
    const hasChosenResult = !!job.repair_result.trim() && job.repair_result !== "WO - wait for scheduled";

    const effectiveValidations = useMemo<ValidationItem[]>(() => {
        if (!hasChosenResult && !isNoProblem) {
            return validations.map(v => v.key === "repairResult"
                ? { ...v, isRequired: true }
                : { ...v, isRequired: false });
        }
        if (isRepairCompleted) {
            return validations.map(v => COMPLETED_REQUIRED_KEYS.includes(v.key) ? { ...v, isRequired: true } : v);
        }
        return validations;
    }, [validations, hasChosenResult, isNoProblem, isRepairCompleted]);
    const canSave = useMemo(() => effectiveValidations.filter(v => v.isRequired).every(v => v.isValid), [effectiveValidations]);
    // ผล "แก้ไขสำเร็จ" ต้องผ่าน validation ครบทุกข้อก่อนเปลี่ยนสถานะเป็น Closed
    const canClose = !(isClosedResult || isNoProblem) || canSave;

    // ใบที่ planner ยังไม่ได้วางแผน/assign — ช่างยังปิดงานไม่ได้ แต่ต้องเก็บสิ่งที่กรอกไว้ได้
    // บันทึกความคืบหน้าใช้เกณฑ์ขั้นต่ำ: ต้องระบุอาการและสาเหตุ
    // (ไม่ใช้ canSave เพราะนั่นบังคับครบทุกช่องสำหรับ "ปิดงาน")
    const canSaveProgress = useMemo(() => {
        // เลือก "รอเข้าพื้นที่" = ฟอร์มล้างช่องอาการ/สาเหตุทิ้งไปแล้ว บังคับต่อไม่ได้
        // (ไม่งั้นปุ่มเดียวของใบสถานะ Wait for schedule จะ disabled ถาวร = ทางตัน)
        if (isWaitingForSiteCondition) return !!job.repair_result_remark.trim();
        const fullGroups = extraGroups.filter(group => group.kind === "full");
        const hasProblem = job.problem_type.some(Boolean) && fullGroups.every(group => group.problem_type.some(Boolean));
        const hasCause = job.cause.some(cause => cause.trim() !== "") &&
            extraGroups.filter(group => group.kind !== "correction").every(group => group.cause.some(cause => cause.trim() !== ""));
        return (hasProblem || !!job.problem_type_other.trim()) && hasCause;
    }, [job.problem_type, job.problem_type_other, job.cause, job.repair_result_remark, isWaitingForSiteCondition, extraGroups]);

    // การ์ดสรุปต้องสะท้อนสิ่งที่ "ปุ่มที่กดได้จริง" ต้องการ ไม่งั้นจะขึ้นแดงว่ายังไม่เลือก
    // ผลหลังซ่อม ทั้งที่สถานะนี้ไม่ต้องเลือก — canSave ยังใช้ validations ชุดเต็มเหมือนเดิม
    const displayValidations = useMemo(
        () => isWaitForSchedule && !plannerSelfCloseMode
            ? validations.map(v => PROGRESS_REQUIRED_KEYS.includes(v.key) ? v : { ...v, isRequired: false })
            : effectiveValidations,
        [validations, effectiveValidations, isWaitForSchedule, plannerSelfCloseMode],
    );

    // ซ่อมเสร็จ ("แก้ไขสำเร็จ/ไม่สำเร็จ" หรือ "ไม่พบปัญหา") หรือเลือก "WO - wait for approve"
    // → เข้าคิวรออนุมัติ (Wait for approve) ให้ planner/admin กดปิดงาน | ติดตามผล/รออะไหล่ → In Progress
    const isClosing = isClosedResult || isNoProblem;
    // planner เป็นผู้อนุมัติปิดงานอยู่แล้ว — ถ้ากรอกผลสุดท้ายเอง (รวมไม่พบปัญหา)
    // ก็ไม่ต้องเข้าคิวรออนุมัติ ปิดเป็น Closed ไปเลย (role อื่นยังต้องรอ planner/admin อนุมัติ)
    const isRepairSuccess = job.repair_result === "WO - wait for approve" || isClosedResult;
    const plannerAutoClose = isPlanner && (isRepairSuccess || isNoProblem);
    const targetStatus = plannerAutoClose
        ? "Closed"
        : (isClosing || job.repair_result === "WO - wait for approve" ? "Wait for approve" : "In Progress");
    const targetTab = targetStatus === "Closed" ? "closed" : "in-progress";
    // ป้าย Job Status ต้องบอก "สถานะตอนนี้" ของใบงาน ไม่ใช่สถานะที่จะกลายเป็นตอนกดบันทึก
    // ด่านปิดงาน targetStatus ของ planner เป็น "Closed" ตั้งแต่เปิดหน้า (กดบันทึกแล้วปิดเลย)
    // ถ้าเอามาโชว์ตรง ๆ จะดูเหมือนใบถูกปิดไปแล้วทั้งที่ยังรออนุมัติอยู่
    const jobStatusLabel = isWoCloseApproval
        ? "WO - wait for approve"
        : (plannerSelfCloseMode ? "Wait for schedule" : targetStatus);
    // ใบที่ซ่อมจบแล้ว (รออนุมัติ หรือปิดเลย) → ต้องมีวันที่แก้ไขเสร็จเสมอ
    // (ครอบคลุมทั้ง แก้ไขสำเร็จ/ไม่สำเร็จ, ไม่พบปัญหา และ WO - wait for approve)
    const hasResolvedDate = targetStatus === "Wait for approve" || targetStatus === "Closed";

    // ==================== HELPERS ====================
    const localTodayFormatted = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };
    const localTodayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const localNowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
    const displayToISO = (s: string) => { if (!s) return localTodayISO(); const p = s.split("/"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : localTodayISO(); };
    const isoToDisplay = (s: string) => { if (!s) return localTodayFormatted(); const p = s.slice(0, 10).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : localTodayFormatted(); };

    // ==================== GPS & TIMESTAMP ====================
    const gpsCache = useRef<{ location?: string; fetched: boolean; promise?: Promise<string | undefined> }>({ fetched: false });

    const fetchGpsLocation = useCallback(async (): Promise<string | undefined> => {
        try {
            if (!navigator.geolocation) { console.warn("[GPS] Geolocation not supported"); return undefined; }
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
            });
            const { latitude, longitude } = pos.coords;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=th&zoom=16`);
                if (!res.ok) return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                const data = await res.json();
                const addr = data.address || {};
                const parts = [addr.road, addr.suburb || addr.neighbourhood, addr.city_district || addr.town || addr.city, addr.state || addr.province].filter(Boolean);
                return parts.length > 0 ? parts.join(", ") : (data.display_name?.split(",").slice(0, 3).join(",") || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            } catch {
                return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            }
        } catch {
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
    useEffect(() => { getGpsCached(); }, [getGpsCached]);

    const getNowTimestamp = () => new Date().toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

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
        const currentCount = job.corrective_actions[index]?.beforeImages.length ?? 0;
        const remain = Math.max(0, MAX_PHOTOS - currentCount);
        if (remain === 0 || files.length > remain) {
            alert(lang === "th"
                ? `แนบรูปได้สูงสุด ${MAX_PHOTOS} รูปต่อรายการ (เพิ่มได้อีก ${remain} รูป)`
                : `Maximum ${MAX_PHOTOS} photos per item (${remain} remaining)`);
        }
        if (remain === 0) return;
        const now = getNowTimestamp();
        const nowISO = new Date().toISOString();
        const cachedLoc = gpsCache.current.fetched ? gpsCache.current.location : undefined;
        const newImages: PhotoItem[] = Array.from(files).slice(0, remain).map((file, i) => ({
            id: `before-${Date.now()}-${index}-${i}-${file.name}`,
            file,
            preview: URL.createObjectURL(file),
            createdAt: now,
            uploadedAtRaw: nowISO,
            location: cachedLoc,
        }));
        setJob(prev => ({
            ...prev,
            corrective_actions: prev.corrective_actions.map((item, i) =>
                i === index ? { ...item, beforeImages: [...item.beforeImages, ...newImages].slice(0, MAX_PHOTOS) } : item
            )
        }));
        // ถ้า cache ยังไม่พร้อม → fill location ทีหลัง
        if (!cachedLoc) {
            const imageIds = newImages.map(img => img.id);
            getGpsCached().then(loc => {
                if (!loc) return;
                setJob(prev => ({
                    ...prev,
                    corrective_actions: prev.corrective_actions.map((item, i) =>
                        i === index ? { ...item, beforeImages: item.beforeImages.map(img => imageIds.includes(img.id) ? { ...img, location: loc } : img) } : item
                    )
                }));
            });
        }
    };

    const addCorrectiveAfterImages = (index: number, files: FileList | null) => {
        if (!files) return;
        const currentCount = job.corrective_actions[index]?.afterImages.length ?? 0;
        const remain = Math.max(0, MAX_PHOTOS - currentCount);
        if (remain === 0 || files.length > remain) {
            alert(lang === "th"
                ? `แนบรูปได้สูงสุด ${MAX_PHOTOS} รูปต่อรายการ (เพิ่มได้อีก ${remain} รูป)`
                : `Maximum ${MAX_PHOTOS} photos per item (${remain} remaining)`);
        }
        if (remain === 0) return;
        const now = getNowTimestamp();
        const nowISO = new Date().toISOString();
        const cachedLoc = gpsCache.current.fetched ? gpsCache.current.location : undefined;
        const newImages: PhotoItem[] = Array.from(files).slice(0, remain).map((file, i) => ({
            id: `after-${Date.now()}-${index}-${i}-${file.name}`,
            file,
            preview: URL.createObjectURL(file),
            createdAt: now,
            uploadedAtRaw: nowISO,
            location: cachedLoc,
        }));
        setJob(prev => ({
            ...prev,
            corrective_actions: prev.corrective_actions.map((item, i) =>
                i === index ? { ...item, afterImages: [...item.afterImages, ...newImages].slice(0, MAX_PHOTOS) } : item
            )
        }));
        // ถ้า cache ยังไม่พร้อม → fill location ทีหลัง
        if (!cachedLoc) {
            const imageIds = newImages.map(img => img.id);
            getGpsCached().then(loc => {
                if (!loc) return;
                setJob(prev => ({
                    ...prev,
                    corrective_actions: prev.corrective_actions.map((item, i) =>
                        i === index ? { ...item, afterImages: item.afterImages.map(img => imageIds.includes(img.id) ? { ...img, location: loc } : img) } : item
                    )
                }));
            });
        }
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
    // const addPreventiveAction = () => {
    //     setJob(prev => ({
    //         ...prev,
    //         preventive_action: [...prev.preventive_action, ""]
    //     }));
    // };

    // const removePreventiveAction = (index: number) => {
    //     if (job.preventive_action.length <= 1) return;
    //     setJob(prev => ({
    //         ...prev,
    //         preventive_action: prev.preventive_action.filter((_, i) => i !== index)
    //     }));
    // };

    // const updatePreventiveAction = (index: number, value: string) => {
    //     setJob(prev => ({
    //         ...prev,
    //         preventive_action: prev.preventive_action.map((item, i) => i === index ? value : item)
    //     }));
    // };

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

    // ==================== FETCH DEVICES BASED ON FAULTY EQUIPMENT ====================
    useEffect(() => {
        const faultyEq = job.faulty_equipment;
        if (!faultyEq || !stationId) {
            setDevices([]);
            return;
        }

        let alive = true;
        setLoadingDevices(true);

        (async () => {
            try {
                // บทบาทของ failure class มาจากตาราง Maximo (roles) ไม่ได้ผูกกับรหัสในโค้ด
                const role = failureClassRole(maximoTree, faultyEq);
                const isChargerFailure = faultyEq.startsWith("charger_") || role === "dc" || role === "ac";
                if (isChargerFailure) {
                    // Charger → ดึง device-keys จาก SN ของ charger
                    let charger: ChargerInfo | undefined;
                    if (faultyEq.startsWith("charger_")) {
                        // รายงานเก่าที่ระบุ charger ตัวนั้นตรงๆ
                        const chargerId = faultyEq.replace("charger_", "");
                        charger = chargers.find(c =>
                            String(c.chargerNo) === chargerId ||
                            String(c.charger_id) === chargerId
                        );
                    } else {
                        // failure code ระดับสถานี → ใช้ charger ตัวแรกที่ตรงประเภท
                        const wantType = role === "dc" ? "DC" : "AC";
                        charger = chargers.find(c => (c.chargerType || "DC").toUpperCase() === wantType) || chargers[0];
                    }
                    const sn = charger?.SN || charger?.sn;
                    if (!sn) { if (alive) setDevices([]); return; }

                    const res = await fetch(`${API_BASE}/station/${encodeURIComponent(sn)}/device-keys`, { credentials: "include" });
                    if (res.ok) {
                        const data = await res.json();
                        if (alive) setDevices(data.keys || []);
                    } else {
                        if (alive) setDevices([]);
                    }
                } else {
                    // Non-charger → ใช้รายการอุปกรณ์ระดับสถานีที่ frontend
                    const key = role === "station" ? "station" : faultyEq.toLowerCase();
                    const deviceList = NON_CHARGER_DEVICES[key] || [];
                    if (alive) setDevices(deviceList);
                }
            } catch {
                if (alive) setDevices([]);
            } finally {
                if (alive) setLoadingDevices(false);
            }
        })();
        return () => { alive = false; };
    }, [job.faulty_equipment, chargers, stationId, maximoTree]);

    // Clear repaired_equipment เมื่อเปลี่ยนอุปกรณ์ที่พัง
    // const prevFaultyRef = useRef(job.faulty_equipment);
    // useEffect(() => {
    //     if (prevFaultyRef.current !== job.faulty_equipment) {
    //         setJob(prev => ({ ...prev, repaired_equipment: [] }));
    //         prevFaultyRef.current = job.faulty_equipment;
    //     }
    // }, [job.faulty_equipment]);
    const prevFaultyRef = useRef<string | null>(null); // เปลี่ยนจาก job.faulty_equipment
    // ลายเซ็นของ "การแก้ไข" ที่ sync กับ corrective_actions ไปแล้ว — ตัวโหลดจะเซ็ตค่านี้ให้ตรงกับข้อมูล server
    // เพื่อให้รอบที่ค่ามาจาก server ไม่ถูกนับเป็น "ผู้ใช้เลือกใหม่"
    const syncedCorrectionsRef = useRef<string | null>(null);
    const correctionsKey = (arr: string[]) => Array.from(new Set(arr.filter(Boolean))).sort().join("|");

    useEffect(() => {
        const prev = prevFaultyRef.current;
        prevFaultyRef.current = job.faulty_equipment;
        // ล้างเฉพาะตอน "ผู้ใช้เปลี่ยนอุปกรณ์" เท่านั้น — สองกรณีนี้ไม่ใช่:
        //   prev === null  → รอบ mount (job ยังเป็น INITIAL_JOB)
        //   prev === ""    → server เพิ่งโหลดเสร็จ ("" -> failure code) ซึ่งเดิมถูกนับเป็นการเปลี่ยน
        //                    ทำให้ repaired_equipment ที่โหลดมาถูกล้างทิ้งทุกครั้งที่เปิดใบ (และหายจาก DB ถ้าบันทึกซ้ำ)
        if (prev === null || prev === "") return;
        if (prev !== job.faulty_equipment) {
            setJob(p => ({ ...p, repaired_equipment: [] }));
        }
    }, [job.faulty_equipment]);

    useEffect(() => {
        if (!editId || !stationId) return;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}?station_id=${encodeURIComponent(stationId)}`, {
                    credentials: "include",
                    cache: "no-store",
                });
                if (!res.ok) return;
                const data = await res.json();
                const rawDate = data.cm_date ?? data.found_date ?? "";

                setChargerIdentity({
                    chargeBoxID: data.chargeBoxID ?? "",
                    charger_name: data.charger_name ?? "",
                    charger_no: data.charger_no ?? null,
                    charger_sn: data.charger_sn ?? "",
                    charger_model: data.charger_model ?? "",
                    charger_brand: data.charger_brand ?? "",
                    auto_generated: !!data.auto_generated,
                });

                originalRepairResultRef.current = normalizeRepairResult(data.repair_result ?? "");
                // ช่างเคยบันทึกเป็นสถานะรอไว้ → รอบนั้นถูกเก็บเข้าประวัติแล้ว ฟอร์มต้องเริ่มรอบใหม่จากว่าง
                const loadedHistory: RepairRound[] = Array.isArray(data.repair_history) ? data.repair_history : [];
                setRepairHistory(loadedHistory);
                const isCloseApproval =
                    (
                        String(data.status ?? "").trim().toLowerCase() === "wait for approve" ||
                        normalizeRepairResult(String(data.repair_result ?? "")).trim().toLowerCase() === "wo - wait for approve"
                    ) &&
                    String(data.stage ?? "").trim().toLowerCase() !== "cs_approval";
                const isClosedDataStatus = ["closed", "complete"].includes(String(data.status ?? "").trim().toLowerCase());
                const useHistorySnapshot = isCloseApproval || isClosedDataStatus;
                const latestRepairRound = useHistorySnapshot
                    ? [...loadedHistory].reverse().find(round =>
                        normalizeRepairResult(String(round.repair_result ?? "")) ===
                        normalizeRepairResult(String(data.repair_result ?? ""))
                    )
                    : undefined;
                // บางใบไม่มี snapshot ของรอบปัจจุบัน แต่มี action ชุดที่ 2 อยู่ใน history
                // ให้เลือก snapshot ที่มี action ครบที่สุดเป็น fallback สำหรับหน้าดูข้อมูล
                const historyActionRound = useHistorySnapshot
                    ? loadedHistory.reduce<RepairRound | undefined>((best, round) => {
                        const bestCount = best?.corrective_actions?.length ?? 0;
                        const roundCount = round?.corrective_actions?.length ?? 0;
                        return roundCount > bestCount ? round : best;
                    }, latestRepairRound)
                    : undefined;
                const waitingRoundArchived = WAITING_REPAIR_RESULTS.includes(normalizeRepairResult(data.repair_result ?? ""));
                // ใช้ snapshot เฉพาะรอบที่ตรงกับสถานะปัจจุบัน และเติมข้อมูลจาก flat fields ของรอบล่าสุด
                const flatCorrectiveActions = Array.isArray(data.corrective_actions) ? data.corrective_actions : [];
                const historyCorrectiveActions = Array.isArray(historyActionRound?.corrective_actions)
                    ? historyActionRound.corrective_actions
                    : [];
                const loadedProblemTypes = mergeStringArraysByIndex(data.problem_type, latestRepairRound?.problem_type);
                const loadedCauses = mergeStringArraysByIndex(data.cause, latestRepairRound?.cause);
                const storedCorrections = asStringArray(data.repaired_equipment);
                const historyCorrections = asStringArray(latestRepairRound?.repaired_equipment);
                const actionCodes = flatCorrectiveActions
                    .map((action: any) => String(action?.code ?? "").trim())
                    .filter(Boolean);
                // ถ้าช่องการแก้ไขหลักไม่มีค่า ให้ดึง code จาก corrective_actions เพื่อไม่ให้ข้อมูลที่ช่างกรอกหาย
                const loadedCorrections = mergeStringArraysByIndex(storedCorrections, historyCorrections, actionCodes);
                const loadedCorrectiveActions = (() => {
                    if (!useHistorySnapshot || historyCorrectiveActions.length === 0) return flatCorrectiveActions;

                    // repair_history เป็น snapshot ของรอบล่าสุดและมักมีข้อมูลชุดที่ 2 ครบกว่า flat fields
                    // merge รายการตามลำดับ เพื่อไม่ทิ้งรายละเอียดหรือรูปที่มีอยู่เพียงฝั่งใดฝั่งหนึ่ง
                    const actionCount = Math.max(historyCorrectiveActions.length, flatCorrectiveActions.length);
                    return Array.from({ length: actionCount }, (_, index) => {
                        const historyAction = historyCorrectiveActions[index] ?? {};
                        const flatAction = flatCorrectiveActions[index] ?? {};
                        return {
                            ...historyAction,
                            ...flatAction,
                            // ข้อมูล flat คือรอบล่าสุดของ technician — ให้มี priority สูงกว่า history
                            code: flatAction.code || historyAction.code,
                            text: String(flatAction.text ?? "").trim()
                                ? flatAction.text
                                : (historyAction.text ?? ""),
                            beforeImages: flatAction.beforeImages?.length
                                ? flatAction.beforeImages
                                : (historyAction.beforeImages ?? []),
                            afterImages: flatAction.afterImages?.length
                                ? flatAction.afterImages
                                : (historyAction.afterImages ?? []),
                        };
                    });
                })();
                const loadedJob: Job = {
                    ...INITIAL_JOB,
                    doc_name: data.doc_name ?? "",
                    issue_id: data.issue_id ?? "",
                    found_date: rawDate ? isoToDisplay(rawDate) : localTodayFormatted(),
                    found_time: data.found_time ?? "",
                    location: data.location ?? "",
                    charger_no: String(data.charger_no ?? data.job?.charger_no ?? ""),
                    charger_sn: String(data.charger_sn ?? data.job?.charger_sn ?? ""),
                    problem_details: data.problem_details ?? "",
                    severity: (data.severity ?? "") as Severity,
                    status: (data.status ?? "In Progress") as Status,
                    remarks: data.remarks_open ?? "",
                    faulty_equipment: data.faulty_equipment ?? "",
                    // รอบใหม่: ประทับวันที่ตอนกดเข้าฟอร์มมากรอกรอบนี้เลย (ไม่รอให้เริ่มพิมพ์)
                    start_repair_date: waitingRoundArchived ? localTodayISO() : (data.start_repair_date || ""),
                    // ปัญหา/สาเหตุ: รอบใหม่ใช้ค่าของรอบก่อนเป็นค่าเริ่มต้น (มักเป็นอาการเดิมที่ยังแก้ไม่จบ)
                    problem_type: loadedProblemTypes,
                    problem_type_other: data.problem_type_other ?? "",
                    cause: loadedCauses,
                    // ล้างให้ว่างเพื่อบังคับให้ช่างเลือกผลใหม่ — แต่ต้องจำค่าเดิมไว้ (originalRepairResultRef)
                    // ไม่งั้นพอกดบันทึกจะส่งค่าว่างไปทับ ทำให้ marker ที่ planner ตั้งไว้หายจาก DB
                    repair_result: waitingRoundArchived ? DEFAULT_REPAIR_RESULT : (normalizeRepairResult(data.repair_result ?? "") || DEFAULT_REPAIR_RESULT),
                    inprogress_remarks: waitingRoundArchived ? "" : (data.inprogress_remarks ?? ""),
                    repair_result_remark: waitingRoundArchived ? "" : (data.repair_result_remark ?? ""),
                    resolved_date: data.resolved_date ? isoToDisplay(data.resolved_date) : "",
                    signature: data.signature ?? "",
                    start_repair_time: waitingRoundArchived ? localNowHHMM() : (data.start_repair_time ?? ""),
                    resolved_time: data.resolved_time ?? "",
                    repaired_equipment: waitingRoundArchived ? [] : loadedCorrections,
                    preventive_action: Array.isArray(data.preventive_action) && data.preventive_action.length > 0 ? data.preventive_action : [""],
                    corrective_actions: (() => {
                        // รอบใหม่หลังจากรอบก่อนถูกเก็บเข้าประวัติ → เริ่มจากแถวว่างแถวเดียว
                        if (waitingRoundArchived) return [{ text: "", beforeImages: [], afterImages: [] }];
                        const repairPhotoMap: Record<string, { uploadedAt?: string; location?: string }> = {};
                        const repairByGroup: Record<string, any[]> = {};

                        if (data.photos_repair) {
                            for (const [group, photoList] of Object.entries(data.photos_repair)) {
                                if (Array.isArray(photoList)) {
                                    repairByGroup[group] = photoList as any[];
                                    (photoList as any[]).forEach((p: any) => {
                                        if (p.url) {
                                            repairPhotoMap[p.url] = {
                                                uploadedAt: p.uploadedAt,
                                                location: p.location,
                                            };
                                        }
                                    });
                                }
                            }
                        }

                        if (loadedCorrectiveActions.length > 0) {
                            return loadedCorrectiveActions.map((a: any, idx: number) => ({
                                code: a.code || loadedCorrections[idx],
                                text: a.text || "",
                                beforeImages: (a.beforeImages?.length
                                    ? a.beforeImages
                                    : (repairByGroup[`before_${idx}`] || repairByGroup[`before_${loadedHistory.length * PHOTO_GROUP_ROUND_STRIDE + idx}`] || [])
                                ).map((img: any, imgIdx: number) => {
                                    const repair = repairPhotoMap[img.url] || {};
                                    return {
                                        id: `server-before-${idx}-${imgIdx}-${img.name || img.url}`,
                                        file: null,
                                        preview: img.url?.startsWith("http") ? img.url : `${API_BASE}${img.url}`,
                                        isServer: true,
                                        serverUrl: img.url,
                                        createdAt: formatPhotoDate(img.uploadedAt || repair.uploadedAt),
                                        uploadedAtRaw: img.uploadedAt || repair.uploadedAt || undefined,
                                        location: img.location || repair.location || undefined,
                                    };
                                }),
                                afterImages: (a.afterImages?.length
                                    ? a.afterImages
                                    : (repairByGroup[`after_${idx}`] || repairByGroup[`after_${loadedHistory.length * PHOTO_GROUP_ROUND_STRIDE + idx}`] || [])
                                ).map((img: any, imgIdx: number) => {
                                    const repair = repairPhotoMap[img.url] || {};
                                    return {
                                        id: `server-after-${idx}-${imgIdx}-${img.name || img.url}`,
                                        file: null,
                                        preview: img.url?.startsWith("http") ? img.url : `${API_BASE}${img.url}`,
                                        isServer: true,
                                        serverUrl: img.url,
                                        createdAt: formatPhotoDate(img.uploadedAt || repair.uploadedAt),
                                        uploadedAtRaw: img.uploadedAt || repair.uploadedAt || undefined,
                                        location: img.location || repair.location || undefined,
                                    };
                                }),
                            }));
                        }

                        if (Object.keys(repairByGroup).length > 0) {
                            const actionIndexes = new Set<number>();
                            for (const group of Object.keys(repairByGroup)) {
                                const match = group.match(/^(before|after)_(\d+)$/);
                                if (match) actionIndexes.add(parseInt(match[2]));
                            }
                            // ไล่เฉพาะเลขกลุ่มที่มีอยู่จริง — เลขกลุ่มมี offset ตามรอบซ่อม
                            // (ถ้าไล่ 0..max จะได้แถวเปล่านับร้อยแถวสำหรับใบที่ซ่อมหลายรอบ)
                            const orderedIndexes = Array.from(actionIndexes).sort((a, b) => a - b);
                            const actions: CorrectiveItem[] = [];
                            for (const i of (orderedIndexes.length ? orderedIndexes : [0])) {
                                const beforePhotos = repairByGroup[`before_${i}`] || [];
                                const afterPhotos = repairByGroup[`after_${i}`] || [];
                                actions.push({
                                    text: "",
                                    beforeImages: beforePhotos.map((p: any, idx: number) => ({
                                        id: `server-before-${i}-${idx}-${p.filename || p.url}`,
                                        file: null,
                                        preview: p.url?.startsWith("http") ? p.url : `${API_BASE}${p.url}`,
                                        isServer: true,
                                        serverUrl: p.url,
                                        createdAt: formatPhotoDate(p.uploadedAt),
                                        uploadedAtRaw: p.uploadedAt || undefined,
                                        location: p.location || undefined,
                                    })),
                                    afterImages: afterPhotos.map((p: any, idx: number) => ({
                                        id: `server-after-${i}-${idx}-${p.filename || p.url}`,
                                        file: null,
                                        preview: p.url?.startsWith("http") ? p.url : `${API_BASE}${p.url}`,
                                        isServer: true,
                                        serverUrl: p.url,
                                        createdAt: formatPhotoDate(p.uploadedAt),
                                        uploadedAtRaw: p.uploadedAt || undefined,
                                        location: p.location || undefined,
                                    })),
                                });
                            }
                            if (actions.length > 0) return actions;
                        }

                        return [{ text: "", beforeImages: [], afterImages: [] }];
                    })(),
                };

                // ข้อมูลหลายชุดถูกบันทึกเป็น array รวมกันตอนกดบันทึก
                // ต้องแยกกลับเป็นชุดหลัก + extraGroups ไม่เช่นนั้นหน้า Planner จะแสดงแค่ค่า index แรก
                // แยก corrective action ตามลำดับชุด และใช้ code เป็นตัวช่วยเท่านั้น
                // เพราะหลายชุดสามารถเลือกการแก้ไข code เดียวกันได้ (เช่น Replace)
                const usedActionIndexes = new Set<number>();
                const takeActionForGroup = (correction: string, expectedIndex: number): CorrectiveItem[] => {
                    let actionIndex = correction
                        ? loadedJob.corrective_actions.findIndex((action, index) => !usedActionIndexes.has(index) && action.code === correction)
                        : -1;
                    if (actionIndex < 0 && loadedJob.corrective_actions[expectedIndex] && !usedActionIndexes.has(expectedIndex)) {
                        actionIndex = expectedIndex;
                    }
                    if (actionIndex < 0) return [];
                    usedActionIndexes.add(actionIndex);
                    return [loadedJob.corrective_actions[actionIndex]];
                };
                const mainActions = takeActionForGroup(loadedCorrections[0] || "", 0);
                const normalizedJob: Job = {
                    ...loadedJob,
                    problem_type: loadedProblemTypes.slice(0, 1),
                    cause: loadedCauses.slice(0, 1),
                    repaired_equipment: waitingRoundArchived ? [] : loadedCorrections.slice(0, 1),
                    corrective_actions: mainActions.length ? mainActions : loadedJob.corrective_actions.slice(0, 1),
                };
                const restoredExtraGroups: PGroup[] = [];
                // จำนวนชุดต้องนับจาก corrective_actions ด้วย เพราะบางใบชุดที่ 2
                // มีรายละเอียด/รูปครบ แต่ไม่มีค่า correction code ให้ใช้เป็นตัวนับ
                const extraCount = Math.max(
                    loadedProblemTypes.length,
                    loadedCauses.length,
                    loadedCorrections.length,
                    loadedCorrectiveActions.length,
                ) - 1;
                for (let i = 1; i <= extraCount; i += 1) {
                    const kind: PGroup["kind"] = loadedProblemTypes[i]
                        ? "full"
                        : loadedCauses[i]
                            ? "cause"
                            : "correction";
                    const group = newGroup(kind);
                    group.problem_type = loadedProblemTypes[i] ? [loadedProblemTypes[i]] : [];
                    group.cause = loadedCauses[i] ? [loadedCauses[i]] : [];
                    group.repaired_equipment = loadedCorrections[i] ? [loadedCorrections[i]] : [];
                    // ข้อมูลเก่าบางใบไม่มี code ใน corrective_actions ทำให้ชุดที่ 2 หาไม่เจอ
                    // จึง fallback ตามลำดับ action ของชุดนั้น และห้ามใช้ action เดิมซ้ำกับชุดหลัก
                    const groupActions = takeActionForGroup(loadedCorrections[i] || "", i);
                    if (groupActions.length) group.corrective_actions = groupActions;
                    restoredExtraGroups.push(group);
                }

                syncedCorrectionsRef.current = correctionsKey(normalizedJob.repaired_equipment);
                setJob(normalizedJob);
                setExtraGroups(restoredExtraGroups);
                loadedJobRef.current = normalizedJob;

                setReportedBy(data.reported_by ?? "");
                setApprovedBy(data.approved_by ?? "");
                setApprovalStage(data.stage ?? "");
                setRejectedInfo({ remark: data.reject_remark ?? "", by: data.rejected_by ?? "" });
                setCancelledInfo({ remark: data.cancel_remark ?? "", by: data.cancelled_by ?? "" });
                setJobLoaded(true);

                // ✅ ดึง inspector จาก data ถ้ามี (ไม่ override จาก /me)
                setRecordInspector(data.inspector ?? "");
                if (data.inspector) {
                    setInspector(data.inspector);
                }
                // ช่างที่ planner มอบหมายตอนวางแผน — ใช้จำกัดว่าใครกรอกใบงานเฟสซ่อมได้
                setAssignees(Array.isArray(data.assignees) ? data.assignees.filter(Boolean) : []);

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
                                    createdAt: formatPhotoDate(p.uploadedAt),
                                    uploadedAtRaw: p.uploadedAt || undefined,
                                    location: (p as any).location || undefined,
                                    name: p.filename,
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

    const hasEditedJob = useMemo(() => {
        if (!loadedJobRef.current) return false;
        try {
            return JSON.stringify(job) !== JSON.stringify(loadedJobRef.current);
        } catch {
            return false;
        }
    }, [job]);

    // ปุ่ม "เริ่มแก้ไข" ของช่าง — ประทับเวลาเริ่มงานแล้วเปิดส่วนที่ต้องกรอก
    const startRepair = () => {
        const stampedDate = job.start_repair_date || localTodayISO();
        const stampedTime = job.start_repair_time || localNowHHMM();
        setJob(prev => ({ ...prev, start_repair_date: stampedDate, start_repair_time: stampedTime }));
        setStartRepairStamped(true);
        setRepairStartedManually(true);
        void saveDraftWithImages({ start_repair_date: stampedDate, start_repair_time: stampedTime });
    };

    useEffect(() => {
        if (!jobLoaded || startRepairStamped || !loadedJobRef.current || viewOnly) return;
        if (job.start_repair_date || job.start_repair_time) {
            setStartRepairStamped(true);
            return;
        }
        if (!hasEditedJob) return;

        const stampedDate = localTodayISO();
        const stampedTime = localNowHHMM();

        setJob(prev => ({
            ...prev,
            start_repair_date: stampedDate,
            start_repair_time: stampedTime,
        }));
        setStartRepairStamped(true);

        saveDraftWithImages({ start_repair_date: stampedDate, start_repair_time: stampedTime });
    }, [jobLoaded, startRepairStamped, job.start_repair_date, job.start_repair_time, localTodayISO, localNowHHMM, saveDraftWithImages, hasEditedJob, viewOnly]);

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
                        setCurrentUsername(data.username || "");
                        setCurrentRole(data.role || "");
                    }
                }
            } catch { }
        })();
        return () => { alive = false; };
    }, []);
    // ==================== HANDLERS ====================
    // อนุมัติปิดใบงาน — ย้ายมาจากตาราง In Progress เพื่อให้ผู้อนุมัติเห็นรายละเอียดใบงานก่อนกด
    const onApprove = async () => {
        if (!canApprove || !editId || !stationId || approving) return;
        setApproveOpen(false);
        setApproving(true);
        try {
            const res = await fetch(
                `${API_BASE}/cmreport/${encodeURIComponent(editId)}/approve?station_id=${encodeURIComponent(stationId)}`,
                { method: "POST", credentials: "include" }
            );
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j?.detail || `HTTP ${res.status}`);
            }
            // ปิดแล้วใบงานย้ายไปแท็บ Closed — กลับไปหน้าที่กดเข้ามา ไม่ค้างอยู่ในฟอร์มที่ข้อมูลเก่า
            router.push(buildListUrl("closed"));
        } catch (e: any) {
            alert((lang === "th" ? "อนุมัติไม่สำเร็จ: " : "Approve failed: ") + (e?.message ?? e));
            setApproving(false);
        }
    };

    const onCancelJob = async () => {
        if (!canCancelJob || !editId || !stationId || cancelling) return;
        setCancelling(true);
        try {
            const res = await fetch(
                `${API_BASE}/cmreport/${encodeURIComponent(editId)}/cancel?station_id=${encodeURIComponent(stationId)}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ remark: cancelRemark.trim() }),
                }
            );
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j?.detail || `HTTP ${res.status}`);
            }
            setCancelOpen(false);
            router.push(buildListUrl("cancelled"));
        } catch (e: any) {
            alert((lang === "th" ? "ยกเลิกไม่สำเร็จ: " : "Cancel failed: ") + (e?.message ?? e));
        } finally {
            setCancelling(false);
        }
    };

    // ตีกลับใบงานของช่างกลับเข้าคิววางแผน (Wait for approve → Wait for schedule) พร้อมเหตุผล
    const onReject = async () => {
        if (!canApprove || !editId || !stationId || rejecting) return;
        const remark = rejectRemark.trim();
        if (!remark) return;
        setRejecting(true);
        try {
            const res = await fetch(
                `${API_BASE}/cmreport/${encodeURIComponent(editId)}/reject?station_id=${encodeURIComponent(stationId)}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ remark }),
                }
            );
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j?.detail || `HTTP ${res.status}`);
            }
            // ใบงานกลับไปให้ช่างแก้ → กลับหน้าที่กดเข้ามา
            router.push(buildListUrl("in-progress"));
        } catch (e: any) {
            alert((lang === "th" ? "ตีกลับไม่สำเร็จ: " : "Reject failed: ") + (e?.message ?? e));
            setRejecting(false);
        }
    };

    // keepStatus = บันทึกความคืบหน้า: เก็บข้อมูลอย่างเดียว ไม่ขยับสถานะ ไม่เด้งออกจากหน้า
    const onFinalSave = async ({ keepStatus = false }: { keepStatus?: boolean } = {}) => {
        if (viewOnly) return;
        // เมื่อเลือกผลซ่อมแล้ว ต้องเปลี่ยนสถานะตามผลที่เลือก
        // ห้ามใช้ปุ่ม Save progress ที่จะส่ง status เดิม (Wait for schedule) กลับไป
        if (keepStatus && (hasChosenResult || isClosing)) keepStatus = false;
        if (!stationId) { alert(t("alertNoStationId", lang)); return; }
        if (!keepStatus && !isNoProblem && !hasChosenResult) {
            alert(lang === "th" ? "กรุณาเลือกผลหลังซ่อมก่อนบันทึก" : "Select a repair result before saving.");
            return;
        }
        if (plannerSelfCloseMode && !keepStatus && !plannerAutoClose) {
            alert(lang === "th" ? "กรุณาเลือกผลสุดท้ายที่สามารถปิดใบงานได้" : "Select a final result that can close the work order.");
            return;
        }
        if (!keepStatus && (isClosedResult || isNoProblem) && !canClose) {
            alert(lang === "th" ? "กรุณากรอกข้อมูลการซ่อมให้ครบก่อนปิดงาน" : "Complete all required repair data before closing.");
            return;
        }
        if (keepStatus ? !canSaveProgress : !canSave) return;
        setSaving(true);

        try {
            // รวมชุดกรอกเพิ่มเข้ากับ set แรก (ปัญหา/สาเหตุ/การแก้ไข/การดำเนินการ)
            const allCorrectiveActions = [...job.corrective_actions, ...extraGroups.flatMap(g => g.corrective_actions)];
            // รักษาค่าซ้ำข้ามชุดไว้ เพราะชุดที่ 1/2 อาจเลือก code เดียวกันได้
            const mergedProblemType = [...job.problem_type, ...extraGroups.flatMap(g => g.problem_type)].filter(Boolean);
            const mergedCause = [...job.cause, ...extraGroups.flatMap(g => g.cause)].filter(Boolean);
            const mergedRepairedEquipment = [...job.repaired_equipment, ...extraGroups.flatMap(g => g.repaired_equipment)].filter(Boolean);

            // "ไม่พบปัญหา" ซ่อน dropdown ผลหลังซ่อมไว้ ค่าจึงค้างเป็น marker ของ planner
            // ต้องเขียนผลจริงลงไป ไม่งั้นใบนี้จะไปโผล่การ์ด "รอกำหนดการ" บนแดชบอร์ด
            // และใบที่ปิดแล้วจะแสดงผลหลังซ่อมเป็น "WO - wait for scheduled" ตลอด
            const savedRepairResult = isNoProblem
                ? NO_PROBLEM_REPAIR_RESULT
                : (job.repair_result || originalRepairResultRef.current);
            // รูปของรอบนี้ต้องไม่ไปรวมกลุ่มกับรอบก่อนที่เก็บเข้าประวัติไปแล้ว
            const photoGroupBase = repairHistory.length * PHOTO_GROUP_ROUND_STRIDE;

            // ==================== STEP 1: Upload รูปภาพก่อน ====================
            const uploadedCorrectiveActions = await Promise.all(
                allCorrectiveActions.map(async (action, i) => {
                    const actionIndex = photoGroupBase + i;
                    // Upload before images
                    const uploadedBeforeImages: { name: string; url: string; location?: string; uploadedAt?: string }[] = [];
                    for (const img of action.beforeImages) {
                        if (img.isServer && img.serverUrl) {
                            // รูปที่ upload แล้ว - ใช้ URL เดิม + เก็บ metadata
                            uploadedBeforeImages.push({
                                name: img.file?.name || `image_${img.id}`,
                                url: img.serverUrl,
                                location: img.location,
                                uploadedAt: img.uploadedAtRaw || img.createdAt,
                            });
                        } else if (img.file) {
                            // รูปใหม่ - upload
                            const formData = new FormData();
                            formData.append("station_id", stationId);
                            formData.append("group", `before_${actionIndex}`);
                            formData.append("phase", "repair");
                            formData.append("files", img.file);
                            if (img.location) formData.append("location", img.location);
                            formData.append("created_at", new Date().toISOString());

                            const uploadRes = await fetch(
                                `${API_BASE}/cmreport/${encodeURIComponent(editId)}/photos`,
                                { method: "POST", credentials: "include", body: formData }
                            );
                            if (!uploadRes.ok) {
                                const detail = await uploadRes.text().catch(() => `HTTP ${uploadRes.status}`);
                                throw new Error(`Before photo upload failed: ${detail}`);
                            }
                            const uploadData = await uploadRes.json().catch(() => ({}));
                            if (!uploadData.files?.[0]) {
                                throw new Error("Before photo upload returned no file");
                            }
                            uploadedBeforeImages.push({
                                name: uploadData.files[0].filename,
                                url: uploadData.files[0].url,
                                location: img.location || uploadData.files[0].location,
                                uploadedAt: uploadData.files[0].uploadedAt || img.uploadedAtRaw || new Date().toISOString(),
                            });
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
                                if (img.location) formData.append("location", img.location);
                                formData.append("created_at", new Date().toISOString());

                                const uploadRes = await fetch(
                                    `${API_BASE}/cmreport/${encodeURIComponent(editId)}/photos`,
                                    { method: "POST", credentials: "include", body: formData }
                                );
                                if (!uploadRes.ok) {
                                    const detail = await uploadRes.text().catch(() => `HTTP ${uploadRes.status}`);
                                    throw new Error(`Before photo upload failed: ${detail}`);
                                }
                                const uploadData = await uploadRes.json().catch(() => ({}));
                                if (!uploadData.files?.[0]) {
                                    throw new Error("Before photo upload returned no file");
                                }
                                uploadedBeforeImages.push({
                                    name: uploadData.files[0].filename,
                                    url: uploadData.files[0].url,
                                    location: img.location || uploadData.files[0].location,
                                    uploadedAt: uploadData.files[0].uploadedAt || img.uploadedAtRaw || new Date().toISOString(),
                                });
                            } catch (e) {
                                console.error("Failed to upload before image from draft:", e);
                                throw e;
                            }
                        }
                    }

                    // Upload after images (same logic)
                    const uploadedAfterImages: { name: string; url: string; location?: string; uploadedAt?: string }[] = [];
                    for (const img of action.afterImages) {
                        if (img.isServer && img.serverUrl) {
                            uploadedAfterImages.push({
                                name: img.file?.name || `image_${img.id}`,
                                url: img.serverUrl,
                                location: img.location,
                                uploadedAt: img.uploadedAtRaw || img.createdAt,
                            });
                        } else if (img.file) {
                            const formData = new FormData();
                            formData.append("station_id", stationId);
                            formData.append("group", `after_${actionIndex}`);
                            formData.append("phase", "repair");
                            formData.append("files", img.file);
                            if (img.location) formData.append("location", img.location);
                            formData.append("created_at", new Date().toISOString());

                            const uploadRes = await fetch(
                                `${API_BASE}/cmreport/${encodeURIComponent(editId)}/photos`,
                                { method: "POST", credentials: "include", body: formData }
                            );
                            if (!uploadRes.ok) {
                                const detail = await uploadRes.text().catch(() => `HTTP ${uploadRes.status}`);
                                throw new Error(`After photo upload failed: ${detail}`);
                            }
                            const uploadData = await uploadRes.json().catch(() => ({}));
                            if (!uploadData.files?.[0]) {
                                throw new Error("After photo upload returned no file");
                            }
                            uploadedAfterImages.push({
                                name: uploadData.files[0].filename,
                                url: uploadData.files[0].url,
                                location: img.location || uploadData.files[0].location,
                                uploadedAt: uploadData.files[0].uploadedAt || img.uploadedAtRaw || new Date().toISOString(),
                            });
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
                                if (img.location) formData.append("location", img.location);
                                formData.append("created_at", new Date().toISOString());

                                const uploadRes = await fetch(
                                    `${API_BASE}/cmreport/${encodeURIComponent(editId)}/photos`,
                                    { method: "POST", credentials: "include", body: formData }
                                );
                                if (!uploadRes.ok) {
                                    const detail = await uploadRes.text().catch(() => `HTTP ${uploadRes.status}`);
                                    throw new Error(`After photo upload failed: ${detail}`);
                                }
                                const uploadData = await uploadRes.json().catch(() => ({}));
                                if (!uploadData.files?.[0]) {
                                    throw new Error("After photo upload returned no file");
                                }
                                uploadedAfterImages.push({
                                    name: uploadData.files[0].filename,
                                    url: uploadData.files[0].url,
                                    location: img.location || uploadData.files[0].location,
                                    uploadedAt: uploadData.files[0].uploadedAt || img.uploadedAtRaw || new Date().toISOString(),
                                });
                            } catch (e) {
                                console.error("Failed to upload after image from draft:", e);
                                throw e;
                            }
                        }
                    }

                    return {
                        code: action.code,
                        text: action.text,
                        beforeImages: uploadedBeforeImages,
                        afterImages: uploadedAfterImages
                    };
                })
            );

            // บันทึกเป็นสถานะรอ = จบรอบนี้ เก็บเข้าประวัติ แล้วรอบหน้าจะเริ่มกรอกใหม่จากว่าง
            // (ผลที่ปิดงานได้ เช่น "แก้ไขสำเร็จ" ไม่ต้องเก็บ เพราะเป็นรอบสุดท้ายที่คงอยู่ใน flat fields)
            const closingRound = WAITING_REPAIR_RESULTS.includes(job.repair_result.trim());
            const nextRepairHistory: RepairRound[] = closingRound
                ? [...repairHistory, {
                    start_repair_date: job.start_repair_date || localTodayISO(),
                    start_repair_time: job.start_repair_time || localNowHHMM(),
                    // ปิดรอบ ณ ตอนกดบันทึก
                    finish_date: localTodayISO(),
                    finish_time: localNowHHMM(),
                    repair_result: savedRepairResult,
                    repair_result_remark: job.repair_result_remark,
                    problem_type: mergedProblemType,
                    problem_type_other: job.problem_type_other,
                    cause: mergedCause,
                    repaired_equipment: mergedRepairedEquipment,
                    inprogress_remarks: job.inprogress_remarks,
                    corrective_actions: uploadedCorrectiveActions,
                }]
                : repairHistory;

            // ==================== STEP 2: Save data ====================
            // ส่ง flat fields ตรงๆ (ไม่ wrap ใน job)
            const res = await fetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    station_id: stationId,
                    status: keepStatus ? job.status : targetStatus,
                    inspector,
                    job: {
                        problem_type: mergedProblemType,
                        problem_type_other: job.problem_type_other,
                        cause: mergedCause,
                        corrective_actions: uploadedCorrectiveActions,
                        repaired_equipment: mergedRepairedEquipment,
                        repair_result: savedRepairResult,
                        repair_history: nextRepairHistory,
                        preventive_action: job.preventive_action,
                        inprogress_remarks: job.inprogress_remarks,
                        repair_result_remark: job.repair_result_remark,
                        ...(targetStatus === "Wait for approve" ? { stage: "close_approval" } : {}),
                        start_repair_date: job.start_repair_date || localTodayISO(),
                        // ช่องกรอกวันที่/เวลาเสร็จเองมีเฉพาะตอน "แก้ไขสำเร็จ/ไม่สำเร็จ" — กรอกมาก็เคารพค่านั้น
                        // กรณีอื่น (รออนุมัติ/ไม่พบปัญหา) ประทับเวลาตอนกดบันทึกเสมอ ไม่ใช้ค่าเก่าที่ค้างจากใบที่เคยถูกตีกลับ
                        resolved_date: (!keepStatus && hasResolvedDate) ? (isClosedResult && job.resolved_date ? displayToISO(job.resolved_date) : localTodayISO()) : "",
                        signature: (isClosedResult || isNoProblem) ? job.signature : "",
                        // ประทับเวลาเริ่มแก้ไขครั้งแรกพร้อมวันที่ — ใบเก่าที่มีวันที่แต่ไม่มีเวลา ไม่เติมย้อนหลัง
                        start_repair_time: job.start_repair_time || (job.start_repair_date ? "" : localNowHHMM()),
                        resolved_time: (!keepStatus && hasResolvedDate) ? (isClosedResult && job.resolved_time ? job.resolved_time : localNowHHMM()) : "",
                    }
                })
            });
            if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

            await deleteDraft();

            if (keepStatus) {
                // อยู่หน้าเดิมให้กรอกต่อได้ — และใบนี้ยังไม่ควรไปโผล่ tab อื่นเพราะสถานะไม่เปลี่ยน
                alert(lang === "th" ? "บันทึกข้อมูลแล้ว" : "Saved");
                return;
            }

            router.push(buildListUrl(targetTab));
        } catch (e: any) {
            alert(`${t("alertSaveFailed", lang)} ${e.message || e}`);
        }
        finally { setSaving(false); }
    };

    const severityColor = getSeverityColor(job.severity);

    // ชุดตัวเลือก "ปัญหา" ตาม FAILURECODE ของใบงาน (ถ้าไม่มีลิสต์กำหนด → ใช้ชุดเดิม) + "ไม่พบปัญหา"
    const failureProblemOptions = toOptions(
        maximoProblemOptions(maximoTree, job.faulty_equipment));
    const problemSelectOptions = [
        ...(failureProblemOptions ?? []),
        { value: NO_PROBLEM_OPTION.value, label: lang === "en" ? NO_PROBLEM_OPTION.en : NO_PROBLEM_OPTION.th },
    ];
    const resolveProblemLabel = (val: string) =>
        problemSelectOptions.find(o => o.value === val)?.label ?? val;

    // ชุดตัวเลือก "สาเหตุ" — รวมจากทุกปัญหาที่เลือก (dedupe ตาม value)
    const causeOptions = toOptions(
        maximoCauseOptions(maximoTree, job.faulty_equipment, job.problem_type));

    // สาเหตุที่ถูกเลือกในบล็อกเพิ่มเติม — ตัดออกจากช่องสาเหตุหลัก (กันเลือกซ้ำ)
    const causesInGroups = extraGroups.flatMap(g => g.cause).filter(Boolean);
    const mainCauseOptions = causeOptions
        ? causeOptions.filter(o => !causesInGroups.includes(o.value) || job.cause.includes(o.value))
        : null;

    // ล้างสาเหตุที่ค้างมาจากปัญหาอื่น — เก็บเฉพาะค่าที่อยู่ในลิสต์ปัจจุบัน
    useEffect(() => {
        if (causeOptions && job.cause.length) {
            const valid = new Set(causeOptions.map(o => o.value));
            // ล้างเฉพาะ "รหัส Maximo ที่ไม่เข้ากับปัญหาปัจจุบัน" — ค่าที่ผู้ใช้พิมพ์เองไม่มีวันอยู่ใน
            // options จึงต้องเก็บไว้ ไม่งั้นจะถูกลบทิ้งทุกครั้งที่เปิดใบแล้วโดนบันทึกทับเป็นค่าว่าง
            const filtered = job.cause.filter(c => !c || valid.has(c) || !isMaximoCode(c)); // เก็บแถวเปล่าไว้
            if (filtered.length !== job.cause.length) {
                setJob(prev => ({ ...prev, cause: filtered }));
            }
        }
    }, [job.problem_type, job.cause]); // eslint-disable-line react-hooks/exhaustive-deps

    // ถ้าปัญหานั้นมีสาเหตุให้เลือกแค่อันเดียว → ใส่ให้อัตโนมัติเลย
    useEffect(() => {
        if (viewOnly) return;
        if (causeOptions && causeOptions.length === 1) {
            const only = causeOptions[0].value;
            if (job.cause.length !== 1 || job.cause[0] !== only) {
                setJob(prev => ({ ...prev, cause: [only] }));
            }
        }
    }, [job.problem_type, job.faulty_equipment]); // eslint-disable-line react-hooks/exhaustive-deps

    // ตัวช่วยหา label ของสาเหตุ
    const resolveCauseLabel = (val: string) =>
        causeOptions?.find(o => o.value === val)?.label ?? val;

    // ชุดตัวเลือก "การแก้ไข" — รวมจากทุก (ปัญหา × สาเหตุ) ที่เลือก (dedupe ตาม value)
    const correctionOptions = toOptions(
        maximoRemedyOptions(maximoTree, job.faulty_equipment, job.problem_type, job.cause));
    const resolveCorrectionLabel = (val: string) =>
        correctionOptions?.find(o => o.value === val)?.label ?? formatDeviceName(val);

    // การแก้ไขที่ถูกเลือกในบล็อกเพิ่มเติม — ตัดออกจากช่องการแก้ไขหลัก (กันเลือกซ้ำ เกณฑ์เดียวกับสาเหตุ)
    // ค่าของช่องตัวเองต้องเหลือไว้ ไม่งั้น select จะหาค่าที่เลือกอยู่ไม่เจอ
    const correctionsInGroups = extraGroups.flatMap(g => g.repaired_equipment).filter(Boolean);
    const storedMainCorrectionOptions = job.repaired_equipment
        .filter(Boolean)
        .map(value => ({ value, label: resolveCorrectionLabel(value) }));
    const mainCorrectionOptionsList = [
        ...(correctionOptions ?? []).filter(o => !correctionsInGroups.includes(o.value) || job.repaired_equipment.includes(o.value)),
        ...storedMainCorrectionOptions.filter(stored => !(correctionOptions ?? []).some(option => option.value === stored.value)),
    ];
    const mainCorrectionOptions = mainCorrectionOptionsList.length ? mainCorrectionOptionsList : null;

    // ค่าที่โหลดจาก server ต้องแสดงต่อให้มีอยู่จริง แม้ Maximo จะยังไม่มี option ตรงกันในขณะนั้น
    // ห้ามล้าง repaired_equipment ที่ technician บันทึกไว้เพียงเพราะ option ยังโหลดไม่ครบ/เปลี่ยนชุด

    // auto: sync code ของ "การดำเนินการแก้ไข" ให้ตรงกับ "การแก้ไข" ที่เลือก
    // ใช้แถวเดิมและคงรูปไว้เมื่อเปลี่ยน/ลบการแก้ไข — ห้ามสร้างชุดรูปเพิ่มอัตโนมัติ
    // แถวที่ไม่มี code (โหลดมา/เพิ่มเอง/ถอด code ออกเพื่อรักษารูป) จะถูกเก็บไว้
    // sync เฉพาะตอน "การแก้ไข" เปลี่ยนค่าจริงเท่านั้น — รอบที่ค่ามาจาก server ตัวโหลดจะเซ็ต ref ไว้ให้ตรงแล้ว
    // (เดิมใช้ธง "ข้ามรอบแรก" ซึ่งถูกเผาตอน mount ที่ค่ายังว่าง แล้วรอบที่ server โหลดเสร็จกลับถูกนับเป็นผู้ใช้เลือก → แถมแถวเปล่าทุกครั้งที่เปิดใบ)
    useEffect(() => {
        const key = correctionsKey(job.repaired_equipment);
        if (syncedCorrectionsRef.current === key) return;
        syncedCorrectionsRef.current = key;
        // เก็บ code ตามลำดับเดิม เพราะแต่ละชุดอาจเลือก code เดียวกันได้
        const codes = job.repaired_equipment.filter(Boolean);
        const codeSet = new Set(codes);
        setJob(prev => {
            // เก็บแถวเดิมทั้งหมดไว้ — ถอดเฉพาะ code ที่ไม่ได้เลือกแล้ว รูปและรายละเอียดจึงไม่หาย
            let next = prev.corrective_actions.map(a =>
                a.code && !codeSet.has(a.code)
                    ? { ...a, code: undefined }
                    : a
            );
            // ห้ามลบแถวที่เลือก code ซ้ำกัน เพราะอาจเป็น Action คนละชุด
            if (next.length === 0) next = [{ text: "", beforeImages: [], afterImages: [] }];
            const have = new Set(next.map(a => a.code).filter(Boolean));
            for (const c of codes) {
                if (have.has(c)) continue;
                const reusableIndex = next.findIndex(a => !a.code);
                if (reusableIndex < 0) continue;
                next = next.map((a, i) => i === reusableIndex ? { ...a, code: c } : a);
                have.add(c);
            }
            // กันแถวว่างหมด — อย่างน้อยเหลือ 1 แถว
            // ถ้าไม่เปลี่ยน → คืนค่าเดิม (กัน re-render ไม่จำเป็น)
            const same = next.length === prev.corrective_actions.length && next.every((a, i) => a === prev.corrective_actions[i]);
            return same ? prev : { ...prev, corrective_actions: next };
        });
    }, [job.repaired_equipment]); // eslint-disable-line react-hooks/exhaustive-deps

    // ต้องเลือก "การแก้ไข" ก่อนถึงจะปิดงานได้ — บังคับผ่าน validation key "correction"
    // (ไม่รีเซ็ต dropdown ให้ เพราะช่างมักเลือกผลหลังซ่อมก่อนแล้วค่อยเลือกการแก้ไข)

    // ==================== RENDER ====================
    return (
        <section className="tw-pb-24">
            {/* Draft Prompt Dialog */}
            {/* Draft Status Indicator */}
            {!viewOnly && draftStatus && (
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



                    {/* ใบงานถูกตีกลับ — ช่างต้องเห็นเหตุผลก่อนแก้ (ซ่อนเมื่อรออนุมัติรอบใหม่แล้ว) */}
                    {isCancelledStatus && (
                        <div className="tw-mb-6 tw-flex tw-gap-3 tw-rounded-xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-p-4">
                            <ExclamationTriangleIcon className="tw-w-5 tw-h-5 tw-text-amber-600 tw-flex-shrink-0 tw-mt-0.5" />
                            <div className="tw-min-w-0">
                                <p className="tw-text-sm tw-font-bold tw-text-amber-800">
                                    {lang === "th" ? "ใบงานถูกยกเลิก" : "Work order was cancelled"}
                                    {cancelledInfo.by && <span className="tw-font-normal tw-text-amber-700"> — {lang === "th" ? "โดย" : "by"} {cancelledInfo.by}</span>}
                                </p>
                                <p className="tw-text-sm tw-text-amber-900 tw-mt-1 tw-whitespace-pre-wrap tw-break-words">
                                    <span className="tw-font-semibold">{lang === "th" ? "เหตุผล:" : "Reason:"}</span>{" "}
                                    {cancelledInfo.remark || (lang === "th" ? "ไม่ได้ระบุเหตุผล" : "No reason provided")}
                                </p>
                            </div>
                        </div>
                    )}

                    {rejectedInfo.remark && job.status !== "Wait for approve" && (
                        <div className="tw-mb-6 tw-flex tw-gap-3 tw-rounded-xl tw-border tw-border-red-200 tw-bg-red-50 tw-p-4">
                            <ArrowUturnLeftIcon className="tw-w-5 tw-h-5 tw-text-red-600 tw-flex-shrink-0 tw-mt-0.5" />
                            <div className="tw-min-w-0">
                                <p className="tw-text-sm tw-font-bold tw-text-red-800">
                                    {lang === "th" ? "ใบงานถูกตีกลับให้แก้ไข" : "Work order was rejected"}
                                    {rejectedInfo.by && <span className="tw-font-normal tw-text-red-600"> — {lang === "th" ? "โดย" : "by"} {rejectedInfo.by}</span>}
                                </p>
                                <p className="tw-text-sm tw-text-red-700 tw-mt-1 tw-whitespace-pre-wrap tw-break-words">{rejectedInfo.remark}</p>
                            </div>
                        </div>
                    )}

                    {/* fieldset disabled = โหมดดูอย่างเดียวเมื่อใบงานปิดแล้ว หรือช่างยังไม่กด "เริ่มแก้ไข" */}
                    <fieldset disabled={viewOnly || !repairStarted} className="tw-border-0 tw-p-0 tw-m-0 tw-min-w-0">
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
                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-4 lg:tw-grid-cols-4 tw-gap-4 tw-mb-6">
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("srNo", lang)}</label>
                            <Input value={(() => { const m = String(job.issue_id || "").match(/(\d+)/); return m ? `SR${m[1].padStart(3, "0")}` : ""; })()} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("woNo", lang)}</label>
                            <Input value={(() => { const m = String(job.issue_id || "").match(/(\d+)/); return m ? `WO${m[1].padStart(3, "0")}` : ""; })()} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("foundDate", lang)}</label>
                            <Input value={job.found_time ? `${job.found_date} ${job.found_time}` : (job.found_date || "")} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("location", lang)}</label>
                            <Input value={job.location || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        <div>
                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("reportedBy", lang)}</label>
                            <Input value={reportedBy || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                        </div>
                        {/* ผู้เข้าแก้ไข (คนซ่อม) — เดิมชื่อผู้ตรวจสอบ */}
                                        <div>
                                            <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("repairer", lang)}</label>
                                            <Input value={inspector || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                                        </div>
                        {/* ผู้ตรวจสอบ — แสดงชื่อผู้อนุมัติเมื่อใบงานปิดแล้ว */}
                        {(canApprove || isClosedStatus) && (
                            <div>
                                <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("inspectorEntered", lang)}</label>
                                <Input value={reviewerName || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                            </div>
                        )}
                    </div>
                    {/* ตู้ชาร์จที่ใบงานนี้เกี่ยวข้อง — ชื่อ / เลขตู้ / S/N / บริษัทผู้ถือครอง */}
                    <ChargerIdentity data={chargerIdentity} lang={lang} />

                    {/* Section 1: Problem Details (Readonly) */}
                    <div className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
                        <div className="tw-flex tw-items-center tw-gap-3 tw-bg-red-600 hover:tw-bg-red-700 tw-px-4 tw-py-3 tw-text-white tw-cursor-pointer tw-transition-colors">
                            <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-white tw-text-red-600 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-sm">1</div>
                            <span className="tw-font-semibold tw-text-base">{t("problemDetails", lang)}</span>
                            <span className="tw-ml-auto tw-text-xs tw-bg-white/20 tw-px-2.5 tw-py-1 tw-rounded-full tw-font-medium">{lang === "th" ? "อ่านอย่างเดียว" : "Read Only"}</span>
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
                                        <optgroup label={lang === "th" ? "รหัสความเสียหาย" : "Failure Code"}>
                                            {maximoTree.classes.map(c => (
                                                <option key={c.code} value={c.code}>{c.description || c.code}</option>
                                            ))}
                                            {/* ใบงานเก่าที่เก็บรหัสชุดเดิม — ต้องมี option ให้ค่าที่เลือกไว้ ไม่งั้น select โชว์ว่าง */}
                                            {job.faulty_equipment
                                                && !maximoTree.classes.some(c => c.code === job.faulty_equipment)
                                                && !job.faulty_equipment.startsWith("charger_") && (
                                                <option value={job.faulty_equipment}>
                                                    {failureCodeLabel(job.faulty_equipment)}
                                                </option>
                                            )}
                                        </optgroup>
                                        {/* กลุ่มเดิม — ให้รายงานเก่าที่บันทึกเป็น charger_x / mdb / ccb ฯลฯ ยังแสดงผลได้ */}
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
                                <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("problemSummarySection", lang)}</label>
                                <Textarea value={job.problem_details || ""} readOnly rows={2} className="!tw-w-full !tw-border-blue-gray-200 !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                            </div>

                            {/* Remarks - ซ่อนถ้าไม่มีหมายเหตุ */}
                            {(job.remarks || "").trim() && (job.remarks || "").trim() !== "-" && (
                                <div>
                                    <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("remarks", lang)}</label>
                                    <Textarea value={job.remarks || ""} readOnly rows={2} className="!tw-w-full !tw-border-blue-gray-200 !tw-bg-gray-100 !tw-text-blue-gray-700 !tw-opacity-100" style={{ backgroundColor: "#f3f4f6", color: "#455a64" }} containerProps={{ className: "!tw-min-w-0" }} />
                                </div>
                            )}

                            {/* Job Status */}
                            <div>
                                <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">{t("jobStatus", lang)}</label>
                                {/* สถานะปัจจุบันของใบงาน — ด่านรออนุมัติปิดงานโชว์ "WO - wait for approve"
                                    ไม่ใช่ Closed (ดู jobStatusLabel) */}
                                <div className={`tw-inline-flex tw-items-center tw-px-4 tw-py-2.5 tw-rounded-full tw-text-white tw-font-semibold tw-text-sm tw-shadow-md ${jobStatusLabel === "Closed" ? "tw-bg-gray-600" : jobStatusLabel === "In Progress" ? "tw-bg-amber-500" : "tw-bg-blue-500"
                                    }`}>
                                    <span>{jobStatusLabel}</span>
                                </div>
                            </div>

                            {/* Photos (view only) */}
                            <div>
                                <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">{t("photos", lang)}</label>
                                <PhotoUpload photos_problem={photos_problem} onAdd={() => { }} onRemove={() => { }} max={MAX_PHOTOS} disabled={true} lang={lang} />
                            </div>
                        </div>
                    </div>

                    {/* ผลซ่อมรอบก่อน ๆ — อ่านอย่างเดียว โชว์เฉพาะเมื่อเคยบันทึกเป็นสถานะรอมาแล้ว */}
                    {repairHistory.length > 0 && (
                        <div className="tw-mb-6">
                            {repairHistory.map((r, i) => <RepairRoundCard key={i} round={r} index={i} lang={lang} />)}
                            <h4 className="tw-text-sm tw-font-bold tw-text-blue-gray-700">
                                {t("repairRound", lang)} {repairHistory.length + 1}
                            </h4>
                        </div>
                    )}

                    {plannerSelfCloseMode && (
                        <div className="tw-mb-6 tw-rounded-xl tw-border tw-border-green-200 tw-bg-green-50/60 tw-p-5">
                            <label className="tw-flex tw-cursor-pointer tw-items-start tw-gap-3">
                                <input
                                    type="checkbox"
                                    checked
                                    onChange={returnToPlannerSchedule}
                                    className="tw-mt-0.5 tw-h-5 tw-w-5 tw-rounded tw-border-blue-gray-300 tw-text-green-600 focus:tw-ring-green-500"
                                />
                                <span>
                                    <span className="tw-block tw-text-sm tw-font-bold tw-text-blue-gray-900">{lang === "th" ? "ปิดใบงาน" : "Close this work order"}</span>
                                    <span className="tw-mt-1 tw-block tw-text-xs tw-text-blue-gray-600">{lang === "th" ? "กรอกรายละเอียดและเลือกผลสุดท้ายเพื่อปิดใบงาน — ติ๊กออกเพื่อกลับไปวางแผนคนเข้า" : "Complete the details and pick a final result to close it — untick to go back to scheduling."}</span>
                                </span>
                            </label>
                        </div>
                    )}

                    {/* ก่อนช่างกด "เริ่มแก้ไข" ให้เห็นเฉพาะข้อมูลจาก CS/Planner ด้านบน */}
                    {repairStarted && (<>

                    {/* Section 2: Problem Found + Corrective (Editable) — รวมปัญหากับการแก้ไขในการ์ดเดียว */}
                    <div className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
                        <div className="tw-flex tw-items-center tw-gap-3 tw-bg-blue-600 hover:tw-bg-blue-700 tw-px-4 tw-py-3 tw-text-white tw-cursor-pointer tw-transition-colors">
                            <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-white tw-text-blue-600 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-sm">2</div>
                            <span className="tw-font-semibold tw-text-base">{lang === "th" ? "ปัญหาและการแก้ไข" : "Problem & Correction"}</span>
                        </div>

                        <div className="tw-p-6 tw-space-y-5">
                            {/* วันที่เริ่มแก้ไข + วันที่แก้ไขเสร็จ — readonly ทั้งคู่ (ช่องกรอกวันที่เสร็จจริงอยู่ใต้ผลหลังซ่อม เมื่อเลือกแก้ไขสำเร็จ/ไม่สำเร็จ) */}
                            {!isClosedResult && (
                                <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-5">
                                    <div className="tw-space-y-2">
                                        <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                            <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>
                                            {t("resolvedDate", lang)}
                                        </label>
                                        <Input
                                            type="text"
                                            value={job.start_repair_date
                                                ? `${isoToDisplay(job.start_repair_date)}${job.start_repair_time ? ` ${job.start_repair_time}` : ""}`
                                                : `${localTodayFormatted()} ${localNowHHMM()}`}
                                            readOnly
                                            crossOrigin=""
                                            className="!tw-w-full !tw-h-12 !tw-bg-gray-100 !tw-text-gray-700 !tw-opacity-100 !tw-border-gray-200 !tw-rounded-xl"
                                            style={{ backgroundColor: "#f3f4f6", color: "#374151" }}
                                            containerProps={{ className: "!tw-min-w-0 !tw-h-12" }}
                                        />
                                    </div>
                                    <div className="tw-space-y-2">
                                        <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                            <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-green-500"></span>
                                            {t("completedDate", lang)}
                                        </label>
                                        <Input
                                            type="text"
                                            // กำลังจะเข้าคิวรออนุมัติ → พรีวิววันเวลาที่จะถูกประทับตอนกดบันทึก
                                            // | ยังซ่อมไม่จบ → แสดงค่าเดิมถ้ามี ไม่มีก็ "-" (ไม่โชว์วันนี้ กันเข้าใจผิดว่าเสร็จแล้ว)
                                            value={hasResolvedDate
                                                ? `${localTodayFormatted()} ${localNowHHMM()}`
                                                : job.resolved_date
                                                    ? `${job.resolved_date}${job.resolved_time ? ` ${job.resolved_time}` : ""}`
                                                    : "-"}
                                            readOnly
                                            crossOrigin=""
                                            className="!tw-w-full !tw-h-12 !tw-bg-gray-100 !tw-text-gray-700 !tw-opacity-100 !tw-border-gray-200 !tw-rounded-xl"
                                            style={{ backgroundColor: "#f3f4f6", color: "#374151" }}
                                            containerProps={{ className: "!tw-min-w-0 !tw-h-12" }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Repair Result */}
                            {!isNoProblem && (
                                <div className="tw-mb-6">
                                    <div className="tw-p-0 tw-space-y-6">
                                        <div id="cm-repair-result" className="tw-space-y-3">
                                            <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                                <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>
                                                {t("repairResult", lang)} <span className="tw-text-red-500">*</span>
                                            </label>
                                            <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start tw-gap-3">
                                                <select
                                                    value={job.repair_result}
                                                    onChange={(e) => setJob(prev => ({ ...prev, repair_result: e.target.value }))}
                                                    className="tw-w-full md:tw-w-96 tw-h-12 tw-border tw-border-gray-200 tw-rounded-xl tw-px-4 tw-text-sm tw-font-medium tw-bg-white tw-text-gray-700 hover:tw-border-amber-400 focus:tw-outline-none focus:tw-ring-3 focus:tw-ring-amber-500/20 focus:tw-border-amber-500 tw-transition-all tw-cursor-pointer tw-flex-shrink-0"
                                                >
                                                    {REPAIR_OPTIONS.map((value) => (
                                                        <option key={value} value={value}>
                                                            {repairResultLabel(value, lang)}
                                                        </option>
                                                    ))}
                                                    {/* ค่าที่ไม่มีในลิสต์ (ใบเก่า / ใบที่ถูกตีกลับหลังปิดงาน) ต้องมี option ของตัวเอง
                                                        ไม่งั้น select จะโชว์ตัวเลือกแรกทั้งที่ค่าจริงเป็นอย่างอื่น */}
                                                    {!!job.repair_result.trim()
                                                        && !REPAIR_OPTIONS.some(v => v === job.repair_result) && (
                                                            <option value={job.repair_result}>{repairResultLabel(job.repair_result, lang)}</option>
                                                        )}
                                                </select>
                                                {needsRepairRemark && (
                                                    <div className="tw-flex-1 tw-w-full">
                                                        <input
                                                            type="text"
                                                            value={job.repair_result_remark}
                                                            onChange={e => setJob(prev => ({ ...prev, repair_result_remark: e.target.value }))}
                                                            placeholder={lang === "th" ? "กรอกหมายเหตุ *" : "Enter remarks *"}
                                                            className="tw-w-full tw-h-12 tw-px-4 tw-border tw-border-gray-200 tw-rounded-xl tw-text-sm tw-font-medium tw-bg-white tw-text-gray-700 hover:tw-border-amber-400 focus:tw-outline-none focus:tw-ring-3 focus:tw-ring-amber-500/20 focus:tw-border-amber-500 tw-transition-all"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {isClosedResult && (
                                            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-5">
                                                <div className="tw-space-y-2">
                                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-green-500"></span>
                                                        {t("completedDate", lang)}
                                                    </label>
                                                    <div className="tw-flex tw-gap-2">
                                                        <input
                                                            type="date"
                                                            value={job.resolved_date ? displayToISO(job.resolved_date) : localTodayISO()}
                                                            onChange={e => setJob({ ...job, resolved_date: e.target.value ? isoToDisplay(e.target.value) : "" })}
                                                            className="tw-flex-1 tw-min-w-0 tw-h-12 tw-border tw-border-gray-200 tw-rounded-xl tw-px-4 tw-text-sm tw-font-medium tw-bg-white tw-text-gray-700 hover:tw-border-green-400 focus:tw-outline-none focus:tw-ring-3 focus:tw-ring-green-500/20 focus:tw-border-green-500 tw-transition-all tw-cursor-pointer"
                                                        />
                                                        <input
                                                            type="time"
                                                            value={job.resolved_time || localNowHHMM()}
                                                            onChange={e => setJob({ ...job, resolved_time: e.target.value })}
                                                            className="tw-w-28 tw-flex-shrink-0 tw-h-12 tw-border tw-border-gray-200 tw-rounded-xl tw-px-3 tw-text-sm tw-font-medium tw-bg-white tw-text-gray-700 hover:tw-border-green-400 focus:tw-outline-none focus:tw-ring-3 focus:tw-ring-green-500/20 focus:tw-border-green-500 tw-transition-all tw-cursor-pointer"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Problem Type */}
                            {!isWaitingForSiteCondition && (
                                <div id="cm-problem-type" className="tw-space-y-2">
                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500"></span>
                                        {t("problemType", lang)} <span className="tw-text-red-500">*</span>
                                    </label>
                                    <div className="tw-flex tw-items-start tw-gap-2">
                                        <div className="tw-flex-1 tw-min-w-0 md:tw-flex-none md:tw-w-96">
                                            <CreatableSelect
                                                isClearable
                                                isDisabled={viewOnly}
                                                placeholder={lang === "th" ? "เลือกปัญหา..." : "Select problem..."}
                                                options={problemSelectOptions}
                                                value={job.problem_type[0] ? { value: job.problem_type[0], label: resolveProblemLabel(job.problem_type[0]) } : null}
                                                onChange={(opt: any) => {
                                                    // เปลี่ยน/ลบปัญหา → ล้างข้อมูลที่เชื่อมกัน แต่คงเฉพาะรูปใน corrective action
                                                    const nextProblems = opt ? [opt.value] : [];
                                                    setJob(prev => ({
                                                        ...prev,
                                                        problem_type: nextProblems,
                                                        cause: [],
                                                        repaired_equipment: matchingCorrectionCodes(maximoTree, prev.faulty_equipment, nextProblems, [], prev.repaired_equipment),
                                                        corrective_actions: retainCorrectiveDataForCodes(
                                                            prev.corrective_actions,
                                                            matchingCorrectionCodes(maximoTree, prev.faulty_equipment, nextProblems, [], prev.repaired_equipment),
                                                        ),
                                                    }));
                                                    setExtraGroups(prev => prev
                                                        .map(group => {
                                                            const keptCorrections = matchingCorrectionCodes(maximoTree, job.faulty_equipment, nextProblems, [], group.repaired_equipment);
                                                            const corrective_actions = retainCorrectiveDataForCodes(group.corrective_actions, keptCorrections);
                                                            const hasContent = corrective_actions.some(action =>
                                                                action.text.trim() || action.beforeImages.length > 0 || action.afterImages.length > 0
                                                            );
                                                            return hasContent
                                                                ? { ...group, problem_type: [], cause: [], repaired_equipment: keptCorrections, corrective_actions }
                                                                : null;
                                                        })
                                                        .filter(Boolean) as PGroup[]
                                                    );
                                                }}
                                                formatCreateLabel={(v: string) => `+ "${v}"`}
                                                menuPlacement="auto"
                                                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                                                classNamePrefix="react-select"
                                                styles={makeSelectStyles(SELECT_ACCENT.blue)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Cause — ซ่อนเมื่อเลือก "ไม่พบปัญหา" */}
                            {!isNoProblem && !isWaitingForSiteCondition && (
                                <div id="cm-cause" className="tw-space-y-2">
                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500"></span>
                                        {t("cause", lang)} <span className="tw-text-red-500">*</span>
                                    </label>
                                    <div className="tw-flex tw-items-start tw-gap-2">
                                        <div className="tw-flex-1 tw-min-w-0 md:tw-flex-none md:tw-w-96">
                                            <CreatableSelect
                                                isClearable
                                                placeholder={lang === "th" ? "เลือกสาเหตุ..." : "Select cause..."}
                                                options={mainCauseOptions ?? []}
                                                isDisabled={viewOnly || !mainCauseOptions}
                                                value={job.cause[0] ? { value: job.cause[0], label: resolveCauseLabel(job.cause[0]) } : null}
                                                onChange={(opt: any) => setJob(prev => {
                                                    const nextCauses = opt ? [opt.value] : [];
                                                    const keptCorrections = matchingCorrectionCodes(maximoTree, prev.faulty_equipment, prev.problem_type, nextCauses, prev.repaired_equipment);
                                                    return {
                                                        ...prev,
                                                        cause: nextCauses,
                                                        repaired_equipment: keptCorrections,
                                                        corrective_actions: retainCorrectiveDataForCodes(prev.corrective_actions, keptCorrections),
                                                    };
                                                })}
                                                formatCreateLabel={(v: string) => `+ "${v}"`}
                                                menuPlacement="auto"
                                                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                                                classNamePrefix="react-select"
                                                styles={makeSelectStyles(SELECT_ACCENT.blue)}
                                            />
                                        </div>
                                        {!viewOnly && (mainCauseOptions?.length ?? 0) > 1 && (
                                            <button type="button" onClick={addCauseGroup} title={lang === "th" ? "เพิ่มสาเหตุ" : "Add cause"} className="tw-flex-shrink-0 tw-w-12 tw-h-12 tw-rounded-xl tw-border tw-border-blue-300 tw-bg-blue-50 tw-text-blue-600 tw-flex tw-items-center tw-justify-center hover:tw-bg-blue-100 hover:tw-border-blue-400 tw-transition-all tw-text-xl tw-font-bold tw-leading-none">+</button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* การแก้ไข — รวมในการ์ดเดียวกับปัญหา (ซ่อนเมื่อเลือก "ไม่พบปัญหา" หรือ wait for material/site condition) */}
                        {!isNoProblem && !isWaitingForMaterial && !isWaitingForSiteCondition && (
                        <div className="tw-px-6 tw-pb-6 tw-space-y-6">
                            {/* Repaired Equipment (การแก้ไข) */}
                            <div className="tw-grid tw-grid-cols-1 tw-gap-5">
                                <div id="cm-correction" className="tw-space-y-2">
                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>
                                        {t("repairedEquipment", lang)} {isClosedResult && <span className="tw-text-red-500">*</span>}
                                    </label>
                                    <div className="tw-flex tw-items-start tw-gap-2">
                                        <div className="tw-flex-1 tw-min-w-0 md:tw-flex-none md:tw-w-96">
                                            <CreatableSelect isClearable
                                                placeholder={lang === "th" ? "เลือกการแก้ไข..." : "Select correction..."}
                                                options={mainCorrectionOptions ?? []}
                                                isDisabled={viewOnly || !mainCorrectionOptions}
                                                value={job.repaired_equipment[0] ? { value: job.repaired_equipment[0], label: resolveCorrectionLabel(job.repaired_equipment[0]) } : null}
                                                onChange={(opt: any) => setJob(prev => {
                                                    const nextCorrections = opt ? [opt.value] : [];
                                                    const sameCorrection = nextCorrections.length === prev.repaired_equipment.length
                                                        && nextCorrections.every((code, i) => code === prev.repaired_equipment[i]);
                                                    return {
                                                        ...prev,
                                                        repaired_equipment: nextCorrections,
                                                        corrective_actions: sameCorrection
                                                            ? prev.corrective_actions
                                                            : detachCorrectiveCodes(prev.corrective_actions),
                                                    };
                                                })}
                                                formatCreateLabel={(v: string) => `+ "${v}"`}
                                                menuPlacement="auto" menuPortalTarget={typeof document !== "undefined" ? document.body : undefined} classNamePrefix="react-select" styles={makeSelectStyles(SELECT_ACCENT.amber)} />
                                        </div>
                                        {!viewOnly && (mainCorrectionOptions?.length ?? 0) > 1 && (
                                            <button type="button" onClick={addCorrectionGroup} title={lang === "th" ? "เพิ่มการแก้ไข" : "Add correction"} className="tw-flex-shrink-0 tw-w-12 tw-h-12 tw-rounded-xl tw-border tw-flex tw-items-center tw-justify-center hover:tw-brightness-95 tw-transition-all tw-text-xl tw-font-bold tw-leading-none" style={{ borderColor: SELECT_ACCENT.amber.border, backgroundColor: SELECT_ACCENT.amber.pill, color: SELECT_ACCENT.amber.pillText }}>+</button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Corrective Actions */}
                            <div id="cm-corrective" className="tw-space-y-4">
                                <div className="tw-flex tw-items-center tw-justify-between">
                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>
                                        {t("correctiveActions", lang)} <span className="tw-text-red-500">*</span>
                                    </label>
                                </div>

                                <div className="tw-space-y-4">
                                    {job.corrective_actions.map((action, i) => (
                                        <div key={i}>
                                            {i > 0 && <hr className="tw-border-gray-200 tw-my-5" />}

                                            <div className="tw-flex tw-gap-4">
                                                <div className="tw-flex-1 tw-space-y-4">
                                                    {/* Delete button */}
                                                    {!viewOnly && job.corrective_actions.length > 1 && (
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
                                                                {/* label ไม่ใช่ form control — fieldset[disabled] block ไม่ได้ และ attribute hidden ก็ถูก tw-inline-flex ทับ จึงต้องไม่ render เลย */}
                                                                {!viewOnly && (
                                                                    <label className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-lg tw-bg-white tw-border tw-border-red-300 tw-text-red-600 tw-font-medium tw-text-xs tw-cursor-pointer hover:tw-bg-red-50 tw-shadow-sm tw-transition-all">
                                                                        <input type="file" accept="image/*" multiple className="tw-hidden" onChange={(e) => addCorrectiveBeforeImages(i, e.target.files)} />
                                                                        <PhotoIcon className="tw-w-4 tw-h-4" />
                                                                        <span>{t("attachPhoto", lang)}</span>
                                                                    </label>
                                                                )}
                                                            </div>
                                                            {action.beforeImages.length > 0 ? (
                                                                <div className="tw-grid tw-grid-cols-3 tw-gap-2">
                                                                    {action.beforeImages.map((img) => (
                                                                        <div key={img.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-red-200 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                                                                            <ZoomableImg src={img.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                                                                            {(img.createdAt || img.location) && (
                                                                                <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                                                                    {img.createdAt && <span className="tw-block tw-font-mono">{img.createdAt}</span>}
                                                                                    {img.location && <span className="tw-block tw-opacity-80 tw-truncate">📍 {img.location}</span>}
                                                                                </span>
                                                                            )}
                                                                            {/* โหมดดูอย่างเดียว (รออนุมัติ/ปิดแล้ว/ไม่ใช่เจ้าของ) → ไม่ต้องมีปุ่มลบรูป */}
                                                                            {!viewOnly && (
                                                                                <button type="button" onClick={() => removeCorrectiveBeforeImage(i, img.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-lg tw-transition-all">
                                                                                    <XMarkIcon className="tw-w-3.5 tw-h-3.5" />
                                                                                </button>
                                                                            )}
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
                                                                    {t("afterPhoto", lang)} {isClosedResult && <span className="tw-text-red-500">*</span>}
                                                                </span>
                                                                {!viewOnly && (
                                                                    <label className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-lg tw-bg-white tw-border tw-border-green-300 tw-text-green-600 tw-font-medium tw-text-xs tw-cursor-pointer hover:tw-bg-green-50 tw-shadow-sm tw-transition-all">
                                                                        <input type="file" accept="image/*" multiple className="tw-hidden" onChange={(e) => addCorrectiveAfterImages(i, e.target.files)} />
                                                                        <PhotoIcon className="tw-w-4 tw-h-4" />
                                                                        <span>{t("attachPhoto", lang)}</span>
                                                                    </label>
                                                                )}
                                                            </div>
                                                            {action.afterImages.length > 0 ? (
                                                                <div className="tw-grid tw-grid-cols-3 tw-gap-2">
                                                                    {action.afterImages.map((img) => (
                                                                        <div key={img.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-green-200 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                                                                            <ZoomableImg src={img.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                                                                            {(img.createdAt || img.location) && (
                                                                                <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                                                                    {img.createdAt && <span className="tw-block tw-font-mono">{img.createdAt}</span>}
                                                                                    {img.location && <span className="tw-block tw-opacity-80 tw-truncate">📍 {img.location}</span>}
                                                                                </span>
                                                                            )}
                                                                            {!viewOnly && (
                                                                                <button type="button" onClick={() => removeCorrectiveAfterImage(i, img.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-lg tw-transition-all">
                                                                                    <XMarkIcon className="tw-w-3.5 tw-h-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="tw-text-center tw-py-6 tw-text-green-600 tw-text-sm tw-font-medium">
                                                                    {isClosedResult
                                                                        ? (lang === "th" ? "⚠️ กรุณาแนบรูปหลังแก้ไข" : "⚠️ Please attach after image")
                                                                        : (lang === "th" ? "ยังไม่มีรูปหลังแก้ไข" : "No after image yet")
                                                                    }
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
                            {/* <div id="cm-preventive" className="tw-space-y-3">
                                <div className="tw-flex tw-items-center tw-justify-between">
                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>
                                        {t("preventiveAction", lang)} {isClosedResult && <span className="tw-text-red-500">*</span>}
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
                            </div> */}

                            {/* ชุดกรอกเพิ่ม (คั่นด้วยเส้น อยู่ในการ์ดเดียวกัน) */}
                            {extraGroups.map((g, i) => (
                                <ProblemGroupBlock
                                    key={i}
                                    faultyEquipment={job.faulty_equipment}
                                    value={g}
                                    onChange={(ng) => setExtraGroups(prev => prev.map((x, j) => (j === i ? ng : x)))}
                                    onRemove={() => setExtraGroups(prev => prev.filter((_, j) => j !== i))}
                                    onAddGroup={addProblemGroup}
                                    onAddCauseGroup={addCauseGroup}
                                    onAddCorrectionGroup={addCorrectionGroup}
                                    mainProblem={job.problem_type}
                                    mainCause={job.cause}
                                    takenCauses={[...job.cause, ...extraGroups.filter((_, j) => j !== i).flatMap(x => x.cause)].filter(Boolean)}
                                    takenCorrections={[...job.repaired_equipment, ...extraGroups.filter((_, j) => j !== i).flatMap(x => x.repaired_equipment)].filter(Boolean)}
                                    lang={lang}
                                    index={i}
                                    disabled={viewOnly}
                                />
                            ))}
                        </div>
                        )}
                    </div>

                    {/* ถ่ายรูป — แสดงเมื่อเลือก "ไม่พบปัญหา" (เก็บใน corrective_actions[0].afterImages → upload เป็น after_0) */}
                    {isNoProblem && (
                        <div id="cm-noproblem-photo" className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
                            <div className="tw-flex tw-items-center tw-gap-3 tw-bg-amber-600 tw-px-4 tw-py-3 tw-text-white">
                                <PhotoIcon className="tw-w-5 tw-h-5" />
                                <span className="tw-font-semibold tw-text-base">{lang === "th" ? "รูปภาพ" : "Photos"}</span>
                            </div>
                            <div className="tw-p-6 tw-space-y-3">
                                <div className="tw-flex tw-items-center tw-justify-between">
                                    <span className="tw-text-sm tw-font-semibold tw-text-gray-700">{lang === "th" ? "แนบรูปถ่าย" : "Attach photo"} <span className="tw-text-red-500">*</span></span>
                                    {!viewOnly && (
                                        <label className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-lg tw-bg-white tw-border tw-border-amber-300 tw-text-amber-600 tw-font-medium tw-text-xs tw-cursor-pointer hover:tw-bg-amber-50 tw-shadow-sm tw-transition-all">
                                            <input type="file" accept="image/*" multiple className="tw-hidden" onChange={(e) => addCorrectiveAfterImages(0, e.target.files)} />
                                            <PhotoIcon className="tw-w-4 tw-h-4" />
                                            <span>{t("attachPhoto", lang)}</span>
                                        </label>
                                    )}
                                </div>
                                {(job.corrective_actions[0]?.afterImages.length ?? 0) > 0 ? (
                                    <div className="tw-grid tw-grid-cols-3 tw-gap-2">
                                        {job.corrective_actions[0].afterImages.map((img) => (
                                            <div key={img.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-amber-200 tw-bg-white tw-shadow-sm">
                                                <ZoomableImg src={img.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                                                {(img.createdAt || img.location) && (
                                                    <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                                        {img.createdAt && <span className="tw-block tw-font-mono">{img.createdAt}</span>}
                                                        {img.location && <span className="tw-block tw-opacity-80 tw-truncate">📍 {img.location}</span>}
                                                    </span>
                                                )}
                                                {!viewOnly && (
                                                    <button type="button" onClick={() => removeCorrectiveAfterImage(0, img.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-lg tw-transition-all">
                                                        <XMarkIcon className="tw-w-3.5 tw-h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="tw-text-center tw-py-6 tw-text-gray-400 tw-text-sm tw-font-medium">
                                        {lang === "th" ? "ยังไม่มีรูป" : "No photo yet"}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Remarks (Editable) — โหมดดูอย่างเดียวและไม่มีหมายเหตุ = ซ่อน (โหมดแก้ไขยังแสดงให้กรอก) */}
                    {(!viewOnly || (job.inprogress_remarks || "").trim()) && (
                    <div id="cm-remarks" className="tw-mb-6">
                        <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700 tw-mb-3">
                            <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-gray-400"></span>
                            {t("remarks", lang)} {isNoProblem && <span className="tw-text-red-500">*</span>}
                        </label>
                        <textarea
                            value={job.inprogress_remarks}
                            onChange={e => setJob({ ...job, inprogress_remarks: e.target.value })}
                            rows={3}
                            placeholder={lang === "th" ? "กรอกหมายเหตุเพิ่มเติม..." : "Enter additional remarks..."}
                            className="tw-w-full tw-px-3 tw-py-2 tw-border tw-border-gray-300 tw-rounded-lg tw-text-sm tw-bg-white focus:tw-outline-none focus:tw-border-gray-400 tw-transition-colors tw-resize-y"
                        />
                    </div>
                    )}

                    {/* Validation Card — ซ่อนในโหมดดูอย่างเดียว */}
                    {!viewOnly && <div className="tw-mb-6"><CMValidationCard validations={displayValidations} lang={lang} /></div>}
                    </>)}
                    </fieldset>

                    {/* Actions */}
                    <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-end tw-gap-3 tw-pt-6 tw-border-t tw-border-gray-200">
                        {viewOnly ? (
                            /* เรียงซ้าย→ขวา: กลับ · ตีกลับ · อนุมัติ */
                            <>
                                <Button
                                    type="button"
                                    onClick={goBackToList}
                                    className="tw-bg-blue-gray-700 hover:tw-bg-blue-gray-800 tw-text-white tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-shadow-xl tw-transition-all"
                                >
                                    {lang === "th" ? "กลับ" : "Back"}
                                </Button>
                                {cancelAction}
                                {canEditTechnicianData && (
                                    <Button
                                        type="button"
                                        onClick={requestPlannerEdit}
                                        disabled={approving || rejecting}
                                        className="tw-bg-amber-500 hover:tw-bg-amber-600 tw-text-white tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-shadow-xl hover:tw-shadow-amber-500/30 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed tw-transition-all"
                                    >
                                        {lang === "th" ? "แก้ไขข้อมูล" : "Edit data"}
                                    </Button>
                                )}
                                {/* อนุมัติ / ตีกลับ — เห็นเฉพาะ admin/planner และเฉพาะใบที่รออนุมัติ */}
                                {approvalActions}
                            </>
                        ) : !repairStarted ? (
                            /* ช่างยังไม่กดเริ่มแก้ไข — มีแค่ปุ่มเริ่มแก้ไข (ข้อมูลด้านบนอ่านอย่างเดียว) */
                            <>
                                {cancelAction}
                                <Button
                                    type="button"
                                    onClick={startRepair}
                                    className="tw-bg-amber-500 hover:tw-bg-amber-600 tw-text-white tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-shadow-xl hover:tw-shadow-amber-500/30 tw-transition-all"
                                >
                                    {lang === "th" ? "เริ่มแก้ไข" : "Start repair"}
                                </Button>
                            </>
                        ) : (
                            <>
                            {cancelAction}
                            {/* planner เข้าโหมดแก้ไขข้อมูลของช่าง — ต้องถอยออกได้โดยไม่บันทึก */}
                            {isPlannerEditing && (
                                <Button
                                    type="button"
                                    variant="outlined"
                                    onClick={cancelPlannerEdit}
                                    disabled={saving}
                                    className="tw-border-blue-gray-300 tw-text-blue-gray-700 tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-border-blue-gray-500 hover:tw-bg-blue-gray-50 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed tw-transition-all"
                                >
                                    {lang === "th" ? "ยกเลิกแก้ไข" : "Cancel edit"}
                                </Button>
                            )}
                            {/* โหมดแก้ไขข้อมูลเหลือแค่ ยกเลิกแก้ไข + ปิดงาน — อนุมัติ/ตีกลับ เป็นของหน้าตรวจ
                                กดตอนแก้ไขค้างอยู่จะทิ้งสิ่งที่แก้ไปโดยไม่ได้บันทึก */}
                            {!isPlannerEditing && approvalActions}
                            {isWaitForSchedule && !plannerSelfCloseMode && !hasChosenResult && !isNoProblem && (
                                <Button
                                    onClick={() => { void onFinalSave({ keepStatus: true }); }}
                                    disabled={saving || !canSaveProgress}
                                    title={!canSaveProgress ? (lang === "th" ? "ต้องระบุอาการและสาเหตุก่อน" : "Fill in problem and cause first") : undefined}
                                    className="tw-text-white tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-shadow-xl disabled:tw-opacity-50 disabled:tw-cursor-not-allowed disabled:tw-shadow-none tw-transition-all tw-transform hover:tw-scale-[1.02] tw-bg-blue-500 hover:tw-bg-blue-600 hover:tw-shadow-blue-500/30 tw-mr-3"
                                >
                                    {saving ? t("saving", lang) : (lang === "th" ? "บันทึกความคืบหน้า" : "Save progress")}
                                </Button>
                            )}
                            {(plannerSelfCloseMode || !isWaitForSchedule || hasChosenResult || isNoProblem) && (
                            <Button
                                onClick={() => { void onFinalSave(); }}
                                disabled={saving || (plannerSelfCloseMode ? (!plannerAutoClose || !canClose) : ((isClosedResult || plannerAutoClose) ? !canClose : !canSave))}
                                title={plannerSelfCloseMode && !plannerAutoClose ? (lang === "th" ? "กรุณาเลือกผลสุดท้ายที่สามารถปิดใบงานได้" : "Select a final result that can close the work order") : undefined}
                                className={`tw-text-white tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-shadow-xl disabled:tw-opacity-50 disabled:tw-cursor-not-allowed disabled:tw-shadow-none tw-transition-all tw-transform hover:tw-scale-[1.02] ${plannerSelfCloseMode || isClosing || plannerAutoClose
                                    ? "tw-bg-green-600 hover:tw-bg-green-700 hover:tw-shadow-green-500/30"
                                    : "tw-bg-amber-500 hover:tw-bg-amber-600 hover:tw-shadow-amber-500/30"
                                    }`}
                            >
                                {saving ? t("saving", lang) : (plannerSelfCloseMode || isClosing || plannerAutoClose ? t("closed", lang) : t("save", lang))}
                            </Button>
                            )}
                            </>
                        )}
                    </div>
                </div>
            </form>

            {/* Modal ยืนยันก่อน Planner แก้ไขข้อมูลที่ Technician ส่งมา */}
            {editConfirmOpen && (
                <div
                    className="tw-fixed tw-inset-0 tw-z-[9999] tw-flex tw-items-center tw-justify-center tw-bg-black/50 tw-p-4"
                    onClick={() => setEditConfirmOpen(false)}
                >
                    <div className="tw-w-full tw-max-w-md tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="tw-flex tw-items-center tw-gap-2 tw-text-lg tw-font-bold tw-text-blue-gray-800 tw-mb-2">
                            <PencilIcon className="tw-w-5 tw-h-5 tw-text-amber-600" />
                            {lang === "th" ? "ยืนยันการแก้ไขข้อมูล" : "Confirm editing data"}
                        </h3>
                        <p className="tw-text-sm tw-text-blue-gray-600">
                            {lang === "th"
                                ? "ข้อมูลนี้ถูกกรอกโดย Technician ต้องการแก้ไขข้อมูลใช่หรือไม่?"
                                : "This data was entered by the technician. Do you want to edit it?"}
                        </p>
                        <div className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-mt-5">
                            <Button
                                type="button"
                                variant="outlined"
                                onClick={() => setEditConfirmOpen(false)}
                                className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300"
                            >
                                {lang === "th" ? "ยกเลิก" : "Cancel"}
                            </Button>
                            <Button
                                type="button"
                                onClick={confirmPlannerEdit}
                                className="tw-bg-amber-500 hover:tw-bg-amber-600 tw-text-white tw-font-semibold"
                            >
                                {lang === "th" ? "ยืนยันแก้ไข" : "Confirm edit"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal ตีกลับ — บังคับกรอกเหตุผลก่อนส่งกลับให้ช่าง */}
            {cancelOpen && (
                <div
                    className="tw-fixed tw-inset-0 tw-z-[9999] tw-flex tw-items-center tw-justify-center tw-bg-black/50 tw-p-4"
                    onClick={() => { if (!cancelling) setCancelOpen(false); }}
                >
                    <div className="tw-w-full tw-max-w-lg tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="tw-text-lg tw-font-bold tw-text-red-700 tw-mb-2">
                            {t("cancelWorkOrder", lang)}
                        </h3>
                        <p className="tw-text-sm tw-text-blue-gray-600 tw-mb-4">
                            {lang === "th" ? "ระบุเหตุผลที่ยกเลิกใบงานนี้ (ถ้ามี)" : "Enter the reason for cancelling this work order (optional)."}
                        </p>
                        <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">
                            {t("cancelReason", lang)}
                        </label>
                        <textarea
                            value={cancelRemark}
                            onChange={e => setCancelRemark(e.target.value)}
                            rows={4}
                            autoFocus
                            className="tw-w-full tw-px-3 tw-py-2 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-text-sm tw-bg-white focus:tw-outline-none focus:tw-border-red-400 tw-transition-colors tw-resize-y"
                        />
                        <div className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-mt-5">
                            <Button
                                type="button"
                                variant="outlined"
                                disabled={cancelling}
                                onClick={() => setCancelOpen(false)}
                                className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300"
                            >
                                {lang === "th" ? "กลับ" : "Back"}
                            </Button>
                            <Button
                                type="button"
                                onClick={onCancelJob}
                                disabled={cancelling}
                                className="tw-bg-amber-500 hover:tw-bg-amber-600 tw-text-white tw-font-semibold disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
                            >
                                {cancelling ? t("cancelling", lang) : t("confirmCancel", lang)}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {rejectOpen && (
                <div className="tw-fixed tw-inset-0 tw-z-[9999] tw-flex tw-items-center tw-justify-center tw-bg-black/50 tw-p-4"
                    onClick={() => { if (!rejecting) setRejectOpen(false); }}>
                    <div className="tw-w-full tw-max-w-lg tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="tw-flex tw-items-center tw-gap-2 tw-text-lg tw-font-bold tw-text-blue-gray-800 tw-mb-1">
                            <ArrowUturnLeftIcon className="tw-w-5 tw-h-5 tw-text-red-600" />
                            {lang === "th" ? "ตีกลับใบงาน" : "Reject work order"}
                        </h3>
                        <p className="tw-text-sm tw-text-blue-gray-500 tw-mb-4">
                            {lang === "th"
                                ? "ใบงานจะกลับไปให้ช่างแก้ไข — ระบุสิ่งที่ต้องแก้ให้ชัดเจน"
                                : "The work order goes back to the technician — state clearly what needs fixing."}
                        </p>
                        <label className="tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2">
                            {lang === "th" ? "หมายเหตุ" : "Remark"} <span className="tw-text-red-500">*</span>
                        </label>
                        <textarea
                            value={rejectRemark}
                            onChange={e => setRejectRemark(e.target.value)}
                            rows={4}
                            autoFocus
                            placeholder={lang === "th" ? "เช่น รูปหลังแก้ไขไม่ชัด กรุณาถ่ายใหม่" : "e.g. After-repair photo is unclear, please retake"}
                            className="tw-w-full tw-px-3 tw-py-2 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-text-sm tw-bg-white focus:tw-outline-none focus:tw-border-red-400 tw-transition-colors tw-resize-y"
                        />
                        <div className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-mt-5">
                            <Button type="button" variant="outlined" disabled={rejecting}
                                onClick={() => setRejectOpen(false)}
                                className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300">
                                {lang === "th" ? "ยกเลิก" : "Cancel"}
                            </Button>
                            <Button type="button" onClick={onReject} disabled={rejecting || !rejectRemark.trim()}
                                className="tw-bg-red-600 hover:tw-bg-red-700 tw-text-white tw-font-semibold disabled:tw-opacity-50 disabled:tw-cursor-not-allowed">
                                {rejecting ? (lang === "th" ? "กำลังตีกลับ..." : "Rejecting...") : (lang === "th" ? "ยืนยันตีกลับ" : "Confirm reject")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal ยืนยันอนุมัติ — ให้รูปแบบเดียวกับ dialog ของหน้าอื่น */}
            {approveOpen && (
                <div
                    className="tw-fixed tw-inset-0 tw-z-[9999] tw-flex tw-items-center tw-justify-center tw-bg-black/50 tw-p-4"
                    onClick={() => { if (!approving) setApproveOpen(false); }}
                >
                    <div className="tw-w-full tw-max-w-md tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="tw-flex tw-items-center tw-gap-2 tw-text-lg tw-font-bold tw-text-blue-gray-800 tw-mb-2">
                            <CheckCircleIcon className="tw-w-5 tw-h-5 tw-text-green-600" />
                            {lang === "th" ? "ยืนยันอนุมัติใบงาน" : "Confirm work order approval"}
                        </h3>
                        <p className="tw-text-sm tw-text-blue-gray-600">
                            {lang === "th"
                                ? `อนุมัติและปิดใบงาน "${job.doc_name || job.issue_id || editId}" ใช่หรือไม่?`
                                : `Approve and close work order "${job.doc_name || job.issue_id || editId}"?`}
                        </p>
                        <div className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-mt-5">
                            <Button
                                type="button"
                                variant="outlined"
                                onClick={() => setApproveOpen(false)}
                                disabled={approving}
                                className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300"
                            >
                                {lang === "th" ? "ยกเลิก" : "Cancel"}
                            </Button>
                            <Button
                                type="button"
                                onClick={onApprove}
                                disabled={approving}
                                className="tw-bg-green-600 hover:tw-bg-green-700 tw-text-white tw-font-semibold disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
                            >
                                {approving ? (lang === "th" ? "กำลังอนุมัติ..." : "Approving...") : (lang === "th" ? "ยืนยันอนุมัติ" : "Confirm approve")}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
