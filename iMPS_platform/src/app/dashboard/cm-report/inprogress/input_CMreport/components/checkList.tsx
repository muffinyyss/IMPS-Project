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
    editor: { th: "ผู้แก้ไข", en: "Editor" },
    inspector: { th: "ผู้ตรวจสอบ", en: "Inspector" },
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
    beforePhoto: { th: "รูปก่อนแก้ไข", en: "Before" },
    afterPhoto: { th: "รูปหลังแก้ไข", en: "After" },
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
type Status = "" | "Open" | "In Progress" | "Closed";
type ServerPhoto = { filename: string; size: number; url: string; remark?: string; uploadedAt?: string; location?: string; };
type PhotoItem = { id: string; file: File | null; preview: string; isServer?: boolean; serverUrl?: string; createdAt?: string; uploadedAtRaw?: string; location?: string; };
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
    issue_id: string; doc_name: string; found_date: string; location: string;
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

const REPAIR_OPTIONS = [
    { value: "WO - wait for manpower", th: "WO - wait for manpower", en: "WO - wait for manpower" },
    { value: "WO - wait for spare part", th: "WO - wait for spare part", en: "WO - wait for spare part" },
    { value: "WO - wait for site access", th: "WO - wait for site access", en: "WO - wait for site access" },
    { value: "WO - wait for approve", th: "WO - wait for approve", en: "WO - wait for approve" },
] as const;

// ค่าผลหลังซ่อมที่ถือว่าเป็นสถานะ "รอ" (WO waiting) — ยังคงอยู่ In Progress
const WO_WAITING_RESULTS = ["WO - wait for manpower", "WO - wait for spare part", "WO - wait for site access", "WO - wait for approve"];

const PROBLEM_TYPE_OPTIONS = [
    { value: "Hardware", th: "Hardware (ฮาร์ดแวร์)", en: "Hardware" },
    { value: "Software", th: "Software (ซอฟต์แวร์)", en: "Software" },
    { value: "Network", th: "Network (เครือข่าย)", en: "Network" },
    { value: "Other", th: "อื่นๆ", en: "Other" },
] as const;

// ตัวเลือกท้าย dropdown ปัญหา — แสดงเสมอทุก failure code
const NO_PROBLEM_OPTION = { value: "NOPROBLM", th: "ไม่พบปัญหา", en: "No Problem Found" } as const;

// ตัวเลือก "ปัญหา" (Problem Description) ตาม FAILURECODE ของใบงาน (faulty_equipment)
// failure code ที่ยังไม่มีลิสต์กำหนด จะ fallback ไปใช้ PROBLEM_TYPE_OPTIONS เดิม
const PROBLEM_OPTIONS_BY_FAILURECODE: Record<string, { value: string; label: string }[]> = {
    DCCHARFC: [
        { value: "POWERDRP", label: "Power Drop" },
        { value: "UN2STCHG", label: "Unable to Start Charging" },
        { value: "SCRFREEZ", label: "The Screen Freezes" },
        { value: "NOINTSIG", label: "No Internet Signal" },
        { value: "DATATRAN", label: "Data Transmission" },
        { value: "HMISCREE", label: "HMI Touch Screen" },
        { value: "CONBOARD", label: "Control Board" },
        { value: "BILLINGU", label: "Wrong Billing Unit" },
        { value: "NOCONSTD", label: "Not Conform to Standard" },
    ],
    ACCHARFC: [
        { value: "POWERDRP", label: "Power Drop" },
        { value: "UN2STCHG", label: "Unable to Start Charging" },
        { value: "SCRFREEZ", label: "The Screen Freezes" },
        { value: "NOINTSIG", label: "No Internet Signal" },
        { value: "DATATRAN", label: "Data Transmission" },
        { value: "HMISCREE", label: "HMI Touch Screen" },
        { value: "CONBOARD", label: "Control Board" },
        { value: "BILLINGU", label: "Wrong Billing Unit" },
    ],
    STATFC: [
        { value: "HVPROBLM", label: "HV Side" },
        { value: "EVDBPROB", label: "EVDB" },
        { value: "POWERMET", label: "Power Meter" },
        { value: "FUSEPROB", label: "Fuse" },
        { value: "PHPROTPB", label: "Phase Protection" },
        { value: "RELAYPRO", label: "Relay" },
        { value: "FANPROBL", label: "Fan" },
        { value: "ROUTERPB", label: "Router" },
        { value: "UPSSBPOB", label: "UPS Supply" },
        { value: "NVRPROBL", label: "NVR" },
        { value: "CCTVPROB", label: "CCTV" },
        { value: "QRCDPROB", label: "QR Code" },
        { value: "LIGTPROB", label: "Station Lighting" },
        { value: "PARKPROB", label: "Parking Space" },
        { value: "STRUPROB", label: "Structure" },
        { value: "FIREEXPB", label: "Fire Extinguisher" },
    ],
};

// ตัวเลือก "สาเหตุ" ตามปัญหา (problem_type) ที่เลือก
// ปัญหาที่ยังไม่มีลิสต์กำหนด จะ fallback เป็นช่องกรอกข้อความเหมือนเดิม
const CAUSE_OPTIONS_BY_PROBLEM: Record<string, { value: string; label: string }[]> = {
    POWERDRP: [
        { value: "OVERHEAT", label: "Overheat" },
        { value: "POWMODUL", label: "Power Module Failed" },
        { value: "PMCMFAIL", label: "Power Module Communication Fail" },
        { value: "POWSUPPL", label: "Power Supply AC-DC 24Vdc Failed (Fan)" },
        { value: "CBPOWTRP", label: "CB Power Module Trip" },
        { value: "RCDPROTS", label: "RCD Leakage Protection System (Charger)" },
    ],
    UN2STCHG: [
        { value: "DCCTR1FC", label: "DC Contactor No.1 Fail" },
        { value: "DCCTR2FC", label: "DC Contactor No.2 Fail" },
        { value: "DCCTR3FC", label: "DC Contactor No.3 Fail" },
        { value: "DCCTR4FC", label: "DC Contactor No.4 Fail" },
        { value: "DCCTR5FC", label: "DC Contactor No.5 Fail" },
        { value: "DCCTR6FC", label: "DC Contactor No.6 Fail" },
        { value: "ACCTR1FC", label: "AC Contactor No.1 Fail" },
        { value: "ACCTR2FC", label: "AC Contactor No.2 Fail" },
        { value: "ACCTR3FC", label: "AC Contactor No.3 Fail" },
        { value: "IMD1FC", label: "Insulation Monitoring Divce Fail No.1" },
        { value: "IMD2FC", label: "Insulation Monitoring Divce Fail No.2" },
        { value: "CTL1FC", label: "Controller Fail No.1" },
        { value: "CTL2FC", label: "Controller Fail No.2" },
        { value: "EMERBUTP", label: "Emergency Button Pressed" },
        { value: "CPCBMISS", label: "CP Cable is Missing" },
    ],
    SCRFREEZ: [
        { value: "OVERHEAT", label: "Overheat" },
    ],
    NOINTSIG: [
        { value: "SIMCARDP", label: "SIM Card Problem" },
        { value: "CHSTARTC", label: "Charger Does Not Send StartTransaction" },
        { value: "CHSTOPTC", label: "Charger Does Not Send StopTransaction" },
        { value: "DISCONFR", label: "Disconnect Frequently" },
    ],
    DATATRAN: [
        { value: "CONBOANC", label: "Control Board Cable is Not Connected" },
    ],
    HMISCREE: [
        { value: "HMISCROF", label: "Touch Screen Off" },
    ],
    CONBOARD: [
        { value: "CONBOAFA", label: "Control Board Failed" },
    ],
    BILLINGU: [
        { value: "CONBOAFA", label: "Control Board Failed" },
        { value: "METERFAI", label: "Power Meter Failed" },
    ],
    NOCONSTD: [
        { value: "PECUTFAI", label: "PE Cut Test Failed" },
        { value: "CPSHTFAI", label: "CP Short Test Failed" },
    ],
};

// override สาเหตุแบบเจาะจงตาม FAILURECODE + ปัญหา (ใช้ก่อน CAUSE_OPTIONS_BY_PROBLEM)
// เช่น ACCHARFC กับ DCCHARFC มีปัญหาชื่อเดียวกัน แต่สาเหตุต่างกัน
const CAUSE_OPTIONS_BY_FC_PROBLEM: Record<string, Record<string, { value: string; label: string }[]>> = {
    ACCHARFC: {
        POWERDRP: [
            { value: "POWBOAFA", label: "Power Board Failed" },
        ],
        UN2STCHG: [
            { value: "EMERBUTP", label: "Emergency Button Pressed" },
            { value: "CPCBMISS", label: "CP Cable is Missing" },
        ],
        SCRFREEZ: [
            { value: "OVERHEAT", label: "Overheat" },
        ],
        NOINTSIG: [
            { value: "SIMCARDP", label: "SIM Card Problem" },
            { value: "CHSTARTC", label: "Charger Does Not Send StartTransaction" },
            { value: "CHSTOPTC", label: "Charger Does Not Send StopTransaction" },
            { value: "DISCONFR", label: "Disconnect Frequently" },
        ],
        DATATRAN: [
            { value: "CONBOANC", label: "Control Board Cable is not Connected" },
        ],
        CONBOARD: [
            { value: "CONBOAFA", label: "Control Board Failed" },
        ],
        BILLINGU: [
            { value: "CONBOAFA", label: "Control Board Failed" },
        ],
    },
    STATFC: {
        HVPROBLM: [
            { value: "HVFUSEDR", label: "HV Fuse Drop" },
            { value: "GROUNDIN", label: "Grounding" },
            { value: "MCBTRIPF", label: "MCB Trip" },
            { value: "FUSELAMP", label: "Fuse or Pilot Lamp" },
        ],
        EVDBPROB: [
            { value: "CUBUSBAR", label: "Copper Busbar Burnt" },
            { value: "WATERENT", label: "There is Water Entering." },
            { value: "MCCBTRIP", label: "MCCB Trip" },
            { value: "MCBTRIPF", label: "MCB Trip" },
            { value: "RCDTRIPF", label: "RCD Trip" },
        ],
        POWERMET: [
            { value: "METERFAI", label: "Power Meter Failed" },
        ],
        FUSEPROB: [
            { value: "FUSESURG", label: "Fuse Surge Protection" },
            { value: "FUSEPHAS", label: "Fuse Phase Protection" },
            { value: "FUSELAMP", label: "Fuse or Pilot Lamp" },
        ],
        PHPROTPB: [
            { value: "PHASEALT", label: "Phase Alternation" },
            { value: "OVERVOLT", label: "Over Voltage" },
            { value: "UNDEVOLT", label: "Under Voltage" },
            { value: "INCVMISS", label: "Incoming Voltage is Missing" },
        ],
        RELAYPRO: [
            { value: "RELAYFAI", label: "Relay Failed" },
        ],
        FANPROBL: [
            { value: "EXHTFANF", label: "Exhaust Fan Failed" },
        ],
        ROUTERPB: [
            { value: "ROUTFAIL", label: "Router Failed" },
        ],
        UPSSBPOB: [
            { value: "UPSFAILU", label: "UPS Failed" },
        ],
        NVRPROBL: [
            { value: "NVRFAILE", label: "NVR Failed" },
        ],
        CCTVPROB: [
            { value: "CCTVFAIL", label: "CCTV Failed" },
        ],
        QRCDPROB: [
            { value: "QRCDFAIL", label: "QR Code Failed" },
        ],
        LIGTPROB: [
            { value: "LIGTFAIL", label: "Lighting Failed" },
        ],
        PARKPROB: [
            { value: "PRKPAINT", label: "Peeling Paint" },
        ],
        STRUPROB: [
            { value: "STRUDAMA", label: "Structure Damaged" },
        ],
        FIREEXPB: [
            { value: "GUAGUNOV", label: "Gauge Undered/Overed" },
        ],
    },
};

// ตัวเลือก "การแก้ไข" ตาม FAILURECODE + ปัญหา + สาเหตุ (คีย์ = "fc:problem:cause")
// combo ที่ยังไม่มีลิสต์ จะ fallback ไปใช้รายการอุปกรณ์ภายใน (devices) เหมือนเดิม
const CORRECTION_OPTIONS_BY_FC_PROBLEM_CAUSE: Record<string, { value: string; label: string }[]> = {
    "DCCHARFC:POWERDRP:OVERHEAT": [
        { value: "REPLACE", label: "Replace (Filter)" },
    ],
    "DCCHARFC:POWERDRP:POWMODUL": [
        { value: "REPLACE", label: "Replace (Power Module)" },
    ],
    "DCCHARFC:POWERDRP:PMCMFAIL": [
        { value: "REPLACE", label: "Replace (Power Module)" },
        { value: "RECHECK", label: "Recheck (Power Module)" },
        { value: "REPAIR", label: "Repair (Power Module)" },
    ],
    "DCCHARFC:POWERDRP:POWSUPPL": [
        { value: "REPLACE", label: "Replace (Power Supply)" },
    ],
    "DCCHARFC:POWERDRP:CBPOWTRP": [
        { value: "REPLACE", label: "Replace (CB)" },
        { value: "RESET", label: "Reset (CB)" },
    ],
    "DCCHARFC:POWERDRP:RCDPROTS": [
        { value: "REPLACE", label: "Replace (RCD)" },
        { value: "RESET", label: "Reset (RCD)" },
    ],
    "DCCHARFC:UN2STCHG:DCCTR1FC": [
        { value: "REPLACE", label: "Replace (DC Contactor No.1)" },
        { value: "RECHECK", label: "Recheck (DC Contactor No.1)" },
        { value: "REPAIR", label: "Repair (DC Contactor No.1)" },
    ],
    "DCCHARFC:UN2STCHG:DCCTR2FC": [
        { value: "REPLACE", label: "Replace (DC Contactor No.2)" },
        { value: "RECHECK", label: "Recheck (DC Contactor No.2)" },
        { value: "REPAIR", label: "Repair (DC Contactor No.2)" },
    ],
    "DCCHARFC:UN2STCHG:DCCTR3FC": [
        { value: "REPLACE", label: "Replace (DC Contactor No.3)" },
        { value: "RECHECK", label: "Recheck (DC Contactor No.3)" },
        { value: "REPAIR", label: "Repair (DC Contactor No.3)" },
    ],
    "DCCHARFC:UN2STCHG:DCCTR4FC": [
        { value: "REPLACE", label: "Replace (DC Contactor No.4)" },
        { value: "RECHECK", label: "Recheck (DC Contactor No.4)" },
        { value: "REPAIR", label: "Repair (DC Contactor No.4)" },
    ],
    "DCCHARFC:UN2STCHG:DCCTR5FC": [
        { value: "REPLACE", label: "Replace (DC Contactor No.5)" },
        { value: "RECHECK", label: "Recheck (DC Contactor No.5)" },
        { value: "REPAIR", label: "Repair (DC Contactor No.5)" },
    ],
    "DCCHARFC:UN2STCHG:DCCTR6FC": [
        { value: "REPLACE", label: "Replace (DC Contactor No.6)" },
        { value: "RECHECK", label: "Recheck (DC Contactor No.6)" },
        { value: "REPAIR", label: "Repair (DC Contactor No.6)" },
    ],
    "DCCHARFC:UN2STCHG:ACCTR1FC": [
        { value: "REPLACE", label: "Replace (AC Contactor No.1)" },
        { value: "RECHECK", label: "Recheck (AC Contactor No.1)" },
        { value: "REPAIR", label: "Repair (AC Contactor No.1)" },
    ],
    "DCCHARFC:UN2STCHG:ACCTR2FC": [
        { value: "REPLACE", label: "Replace (AC Contactor No.2)" },
        { value: "RECHECK", label: "Recheck (AC Contactor No.2)" },
        { value: "REPAIR", label: "Repair (AC Contactor No.2)" },
    ],
    "DCCHARFC:UN2STCHG:ACCTR3FC": [
        { value: "REPLACE", label: "Replace (AC Contactor No.3)" },
        { value: "RECHECK", label: "Recheck (AC Contactor No.3)" },
        { value: "REPAIR", label: "Repair (AC Contactor No.3)" },
    ],
    "DCCHARFC:UN2STCHG:IMD1FC": [
        { value: "REPLACE", label: "Replace (Insulation Monitoring Divce Fail No.1)" },
        { value: "RECHECK", label: "Recheck (Insulation Monitoring Divce Fail No.1)" },
        { value: "REPAIR", label: "Repair (Insulation Monitoring Divce Fail No.1)" },
    ],
    "DCCHARFC:UN2STCHG:IMD2FC": [
        { value: "REPLACE", label: "Replace (Insulation Monitoring Divce Fail No.2)" },
        { value: "RECHECK", label: "Recheck (Insulation Monitoring Divce Fail No.2)" },
        { value: "REPAIR", label: "Repair (Insulation Monitoring Divce Fail No.2)" },
    ],
    "DCCHARFC:UN2STCHG:CTL1FC": [
        { value: "REPLACE", label: "Replace (Controller No.1)" },
        { value: "RECHECK", label: "Recheck (Controller No.1)" },
        { value: "REPAIR", label: "Repair (Controller No.1)" },
    ],
    "DCCHARFC:UN2STCHG:CTL2FC": [
        { value: "REPLACE", label: "Replace (Controller No.2)" },
        { value: "RECHECK", label: "Recheck (Controller No.2)" },
        { value: "REPAIR", label: "Repair (Controller No.2)" },
    ],
    "DCCHARFC:UN2STCHG:EMERBUTP": [
        { value: "RESET", label: "Reset (Emergency)" },
    ],
    "DCCHARFC:UN2STCHG:CPCBMISS": [
        { value: "REPLACE", label: "Replace (Charging Cable)" },
    ],
    "DCCHARFC:SCRFREEZ:OVERHEAT": [
        { value: "REPLACE", label: "Replace (Filter)" },
    ],
    "DCCHARFC:NOINTSIG:SIMCARDP": [
        { value: "REPLACE", label: "Replace (SIM)" },
    ],
    "DCCHARFC:NOINTSIG:CHSTARTC": [
        { value: "REPLACE", label: "Replace (SIM)" },
    ],
    "DCCHARFC:NOINTSIG:CHSTOPTC": [
        { value: "REPLACE", label: "Replace (SIM)" },
    ],
    "DCCHARFC:NOINTSIG:DISCONFR": [
        { value: "REPLACE", label: "Replace (SIM)" },
        { value: "REPLACE", label: "Replace (Router)" },
    ],
    "DCCHARFC:DATATRAN:CONBOANC": [
        { value: "RECHECK", label: "Recheck (Cable)" },
    ],
    "DCCHARFC:HMISCREE:HMISCROF": [
        { value: "REPLACE", label: "Replace (HMI Touch Screen Board)" },
        { value: "RECHECK", label: "Recheck (HMI Touch Screen Board)" },
        { value: "REPAIR", label: "Repair (HMI Touch Screen Board)" },
        { value: "REBOOT", label: "Reboot (HMI Touch Screen Board)" },
    ],
    "DCCHARFC:CONBOARD:CONBOAFA": [
        { value: "REPLACE", label: "Replace (Control Board)" },
        { value: "UPDATEFW", label: "Update Firmware" },
    ],
    "DCCHARFC:BILLINGU:CONBOAFA": [
        { value: "RESTORE", label: "Restore Charger" },
        { value: "REPLACE", label: "Replace (Control Board)" },
        { value: "REPLACE", label: "Replace (Power Meter)" },
        { value: "RESTORE", label: "Restore (Power Meter)" },
    ],
    "DCCHARFC:NOCONSTD:PECUTFAI": [
        { value: "NOTIFYMF", label: "Notify the Manufacturer" },
    ],
    "DCCHARFC:NOCONSTD:CPSHTFAI": [
        { value: "NOTIFYMF", label: "Notify the Manufacturer" },
    ],
    // ── AC Charger Failure ──
    "ACCHARFC:POWERDRP:POWBOAFA": [
        { value: "REPLACE", label: "Replace (Power Board)" },
    ],
    "ACCHARFC:UN2STCHG:EMERBUTP": [
        { value: "RESET", label: "Reset (Emergency)" },
    ],
    "ACCHARFC:UN2STCHG:CPCBMISS": [
        { value: "REPLACE", label: "Replace (Charging Cable)" },
    ],
    "ACCHARFC:SCRFREEZ:OVERHEAT": [
        { value: "REBOOT", label: "Reboot (Charger)" },
    ],
    "ACCHARFC:NOINTSIG:SIMCARDP": [
        { value: "REPLACE", label: "Replace (SIM)" },
    ],
    "ACCHARFC:NOINTSIG:CHSTARTC": [
        { value: "REPLACE", label: "Replace (SIM)" },
    ],
    "ACCHARFC:NOINTSIG:CHSTOPTC": [
        { value: "REPLACE", label: "Replace (SIM)" },
    ],
    "ACCHARFC:NOINTSIG:DISCONFR": [
        { value: "REPLACE", label: "Replace (SIM)" },
        { value: "REPLACE", label: "Replace (Router)" },
    ],
    "ACCHARFC:DATATRAN:CONBOANC": [
        { value: "RECHECK", label: "Recheck (Cable)" },
    ],
    "ACCHARFC:HMISCREE:HMISCROF": [
        { value: "REPLACE", label: "Replace (HMI Touch Screen Board)" },
    ],
    "ACCHARFC:CONBOARD:CONBOAFA": [
        { value: "REPLACE", label: "Replace (Control Board)" },
        { value: "UPDATEFW", label: "Update Firmware" },
    ],
    "ACCHARFC:BILLINGU:CONBOAFA": [
        { value: "RESTORE", label: "Restore Charger" },
        { value: "REPLACE", label: "Replace (Control Board)" },
    ],
    // ── Station Failure ──
    "STATFC:HVPROBLM:HVFUSEDR": [
        { value: "REPLACE", label: "Replace (HV Fuse)" },
    ],
    "STATFC:HVPROBLM:GROUNDIN": [
        { value: "FIX", label: "Fix (Grounding)" },
    ],
    "STATFC:HVPROBLM:MCBTRIPF": [
        { value: "RESET", label: "Reset (MCB)" },
        { value: "REPLACE", label: "Replace (MCB)" },
    ],
    "STATFC:HVPROBLM:FUSELAMP": [
        { value: "REPLACE", label: "Replace (Fuse or Lamp)" },
    ],
    "STATFC:EVDBPROB:CUBUSBAR": [
        { value: "REPLACE", label: "Replace (Busbar)" },
    ],
    "STATFC:EVDBPROB:WATERENT": [
        { value: "FIX", label: "Fix (Sealing)" },
    ],
    "STATFC:EVDBPROB:MCCBTRIP": [
        { value: "RESET", label: "Reset (MCCB)" },
        { value: "REPLACE", label: "Replace (MCCB)" },
    ],
    "STATFC:EVDBPROB:MCBTRIPF": [
        { value: "RESET", label: "Reset (MCB)" },
        { value: "REPLACE", label: "Replace (MCB)" },
    ],
    "STATFC:EVDBPROB:RCDTRIPF": [
        { value: "RESET", label: "Reset (RCD)" },
        { value: "REPLACE", label: "Replace (RCD)" },
    ],
    "STATFC:POWERMET:METERFAI": [
        { value: "REPLACE", label: "Replace (Power Meter)" },
        { value: "REPLACE", label: "Replace (CT)" },
    ],
    "STATFC:FUSEPROB:FUSESURG": [
        { value: "REPLACE", label: "Replace (Fuse)" },
    ],
    "STATFC:FUSEPROB:FUSEPHAS": [
        { value: "REPLACE", label: "Replace (Fuse)" },
    ],
    "STATFC:FUSEPROB:FUSELAMP": [
        { value: "REPLACE", label: "Replace (Fuse or Lamp)" },
    ],
    "STATFC:PHPROTPB:PHASEALT": [
        { value: "FIX", label: "Fix (Phase Sequence)" },
    ],
    "STATFC:PHPROTPB:OVERVOLT": [
        { value: "RECHECK", label: "Recheck (Voltage)" },
        { value: "ADJUST", label: "Adjust (Protection Setting)" },
    ],
    "STATFC:PHPROTPB:UNDEVOLT": [
        { value: "RECHECK", label: "Recheck (Voltage)" },
        { value: "ADJUST", label: "Adjust (Protection Setting)" },
    ],
    "STATFC:PHPROTPB:INCVMISS": [
        { value: "RECHECK", label: "Recheck (Voltage)" },
    ],
    "STATFC:RELAYPRO:RELAYFAI": [
        { value: "REPLACE", label: "Replace (Relay)" },
    ],
    "STATFC:FANPROBL:EXHTFANF": [
        { value: "REPLACE", label: "Replace (Fan)" },
    ],
    "STATFC:ROUTERPB:ROUTFAIL": [
        { value: "REPLACE", label: "Replace (Router)" },
        { value: "REBOOT", label: "Reboot (Router)" },
    ],
    "STATFC:UPSSBPOB:UPSFAILU": [
        { value: "REPLACE", label: "Replace (UPS)" },
    ],
    "STATFC:NVRPROBL:NVRFAILE": [
        { value: "REPLACE", label: "Replace (NVR)" },
    ],
    "STATFC:CCTVPROB:CCTVFAIL": [
        { value: "REPLACE", label: "Replace (CCTV)" },
    ],
    "STATFC:QRCDPROB:QRCDFAIL": [
        { value: "REPLACE", label: "Replace (QR Code)" },
    ],
    "STATFC:LIGTPROB:LIGTFAIL": [
        { value: "REPLACE", label: "Replace (Lighting)" },
    ],
    "STATFC:PARKPROB:PRKPAINT": [
        { value: "FIX", label: "Fix (Floor)" },
    ],
    "STATFC:STRUPROB:STRUDAMA": [
        { value: "FIX", label: "Fix (Structure)" },
    ],
    "STATFC:FIREEXPB:GUAGUNOV": [
        { value: "REPLACE", label: "Replace (Fire Extinguisher)" },
    ],
};

const LOGO_SRC = "/img/logo_egat.png";
const LIST_ROUTE = "/dashboard/cm-report";
const MAX_PHOTOS = 5;
const FIXED_EQUIPMENT = ["MDB", "CCB", "CB-BOX", "Station"] as const;

// ==================== อุปกรณ์ภายในของแต่ละ Non-Charger (Placeholder - แก้ทีหลัง) ====================
const NON_CHARGER_DEVICES: Record<string, string[]> = {
    mdb: ["MCCB", "ACB", "Surge Arrester", "Power Meter", "Busbar", "CT", "PT"],
    ccb: ["MCCB", "Contactor", "Relay", "Terminal Block", "Fuse", "Wiring"],
    "cb-box": ["MCB", "RCBO", "Surge Protection", "Terminal Block", "Busbar"],
    station: ["Network Switch", "Router", "UPS", "CCTV", "Access Control", "Fire Alarm", "Lighting"],
};

const INITIAL_JOB: Job = {
    issue_id: "", doc_name: "", found_date: "", location: "", problem_details: "",
    problem_type: [], severity: "", initial_cause: "", status: "", remarks: "", faulty_equipment: "",
    corrective_actions: [{ text: "", beforeImages: [], afterImages: [] }],
    resolved_date: "",
    start_repair_date: "",
    repair_result: "",
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

    return (
        <div className="tw-space-y-4">
            {!disabled && <div className="tw-text-sm tw-text-blue-gray-600">Max {max} photos</div>}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="tw-hidden" onChange={e => { if (e.target.files) { onAdd(e.target.files); e.target.value = ""; } }} />
            {photos_problem.length > 0 ? (
                <div className="tw-grid tw-grid-cols-3 sm:tw-grid-cols-4 md:tw-grid-cols-5 tw-gap-3">
                    {photos_problem.map(photo => (
                        <div key={photo.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-200 tw-bg-blue-gray-50 tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                            <img src={photo.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                            {(photo.createdAt || photo.location) && (
                                <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                    {photo.createdAt && <span className="tw-block tw-font-mono">{photo.createdAt}</span>}
                                    {photo.location && <span className="tw-block tw-opacity-80 tw-truncate">📍 {photo.location}</span>}
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

function ProblemGroupBlock({ faultyEquipment, value, onChange, onRemove, onAddGroup, onAddCauseGroup, onAddCorrectionGroup, mainProblem, mainCause, takenCauses, takenCorrections, lang, index }: {
    faultyEquipment: string; value: PGroup; onChange: (g: PGroup) => void; onRemove: () => void; onAddGroup: () => void; onAddCauseGroup: () => void; onAddCorrectionGroup: () => void; mainProblem: string[]; mainCause: string[]; takenCauses: string[]; takenCorrections: string[]; lang: Lang; index: number;
}) {
    const isCauseOnly = value.kind === "cause";            // บล็อกสาเหตุ: ไม่มีช่องปัญหา ใช้ปัญหาหลักคำนวณ
    const isCorrectionOnly = value.kind === "correction";  // บล็อกการแก้ไข: มีแค่การแก้ไข→การดำเนินการ ใช้ปัญหา+สาเหตุหลัก
    const effProblems = (isCauseOnly || isCorrectionOnly) ? mainProblem : value.problem_type;
    const effCauses = isCorrectionOnly ? mainCause : value.cause;

    const failureProblemOptions = PROBLEM_OPTIONS_BY_FAILURECODE[faultyEquipment] ?? null;
    const problemSelectOptions = [
        ...(failureProblemOptions ?? []),
        { value: NO_PROBLEM_OPTION.value, label: lang === "en" ? NO_PROBLEM_OPTION.en : NO_PROBLEM_OPTION.th },
    ];
    const resolveProblemLabel = (v: string) => problemSelectOptions.find(o => o.value === v)?.label ?? v;

    const causeOptions = (() => {
        const seen = new Set<string>(); const all: { value: string; label: string }[] = [];
        for (const p of effProblems) {
            const opts = CAUSE_OPTIONS_BY_FC_PROBLEM[faultyEquipment]?.[p] ?? CAUSE_OPTIONS_BY_PROBLEM[p];
            if (opts) for (const o of opts) if (!seen.has(o.value)) { seen.add(o.value); all.push(o); }
        }
        return all.length ? all : null;
    })();
    const resolveCauseLabel = (v: string) => causeOptions?.find(o => o.value === v)?.label ?? v;
    // ตัด "สาเหตุ" ที่ถูกเลือกไว้ในช่องอื่นออก (กันเลือกซ้ำ) — เก็บค่าของตัวเองไว้
    const causeOptionsAvail = causeOptions
        ? causeOptions.filter(o => !takenCauses.includes(o.value) || value.cause.includes(o.value))
        : null;

    // ถ้าสาเหตุที่เหลือให้เลือกมีแค่อันเดียว → เลือกให้อัตโนมัติ
    useEffect(() => {
        if (causeOptionsAvail && causeOptionsAvail.length === 1) {
            const only = causeOptionsAvail[0].value;
            if (value.cause.length !== 1 || value.cause[0] !== only) {
                onChange({ ...value, cause: [only] });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [takenCauses.join(","), effProblems.join(","), faultyEquipment]);

    const correctionOptions = (() => {
        const seen = new Set<string>(); const all: { value: string; label: string }[] = [];
        for (const p of effProblems) for (const c of effCauses) {
            const opts = CORRECTION_OPTIONS_BY_FC_PROBLEM_CAUSE[`${faultyEquipment}:${p}:${c}`];
            if (opts) for (const o of opts) if (!seen.has(o.value)) { seen.add(o.value); all.push(o); }
        }
        return all.length ? all : null;
    })();
    const resolveCorrectionLabel = (v: string) => correctionOptions?.find(o => o.value === v)?.label ?? formatDeviceName(v);
    // ตัด "การแก้ไข" ที่ถูกเลือกไว้ในช่องอื่นออก (กันเลือกซ้ำ) — เก็บค่าของตัวเองไว้
    const correctionOptionsAvail = correctionOptions
        ? correctionOptions.filter(o => !takenCorrections.includes(o.value) || value.repaired_equipment.includes(o.value))
        : null;

    // auto-sync การดำเนินการแก้ไข ตามการแก้ไขที่เลือก
    useEffect(() => {
        const codes = value.repaired_equipment.filter(Boolean);
        const codeSet = new Set(codes);
        let next = value.corrective_actions.filter(a => !a.code || codeSet.has(a.code));
        const have = new Set(next.map(a => a.code).filter(Boolean));
        for (const c of codes) if (!have.has(c)) { next = [...next, { code: c, text: "", beforeImages: [], afterImages: [] }]; have.add(c); }
        if (next.some(a => a.code)) next = next.filter(a => a.code || a.text.trim() || a.beforeImages.length || a.afterImages.length);
        if (next.length === 0) next = [{ text: "", beforeImages: [], afterImages: [] }];
        const same = next.length === value.corrective_actions.length && next.every((a, i) => a === value.corrective_actions[i]);
        if (!same) onChange({ ...value, corrective_actions: next });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value.repaired_equipment]);

    const setText = (i: number, text: string) => onChange({ ...value, corrective_actions: value.corrective_actions.map((a, j) => j === i ? { ...a, text } : a) });
    const addImgs = (i: number, kind: "beforeImages" | "afterImages", files: FileList | null) => {
        if (!files) return;
        const pfx = kind === "beforeImages" ? "before" : "after";
        const imgs: PhotoItem[] = Array.from(files).slice(0, MAX_PHOTOS).map((f, k) => ({ id: `${pfx}-${Date.now()}-${i}-${k}-${f.name}`, file: f, preview: URL.createObjectURL(f) }));
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
                <button type="button" onClick={onRemove} className="tw-w-8 tw-h-8 tw-rounded-lg tw-text-red-400 hover:tw-text-white hover:tw-bg-red-500 tw-flex tw-items-center tw-justify-center tw-transition-all" title={th ? "ลบชุดนี้" : "Remove set"}>
                    <XMarkIcon className="tw-w-5 tw-h-5" />
                </button>
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
                                onChange={(opt: any) => onChange({ ...value, problem_type: opt ? [opt.value] : [] })}
                                formatCreateLabel={(v: string) => `+ "${v}"`}
                                menuPlacement="auto" menuPortalTarget={typeof document !== "undefined" ? document.body : undefined} classNamePrefix="react-select" styles={makeSelectStyles(SELECT_ACCENT.blue)} />
                        </div>
                        <button type="button" onClick={onAddGroup} title={th ? "เพิ่มชุดปัญหาใหม่" : "Add new problem set"} className="tw-flex-shrink-0 tw-w-12 tw-h-12 tw-rounded-xl tw-border tw-border-blue-300 tw-bg-blue-50 tw-text-blue-600 tw-flex tw-items-center tw-justify-center hover:tw-bg-blue-100 tw-transition-all tw-text-xl tw-font-bold tw-leading-none">+</button>
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
                                isDisabled={!causeOptionsAvail}
                                value={value.cause[0] ? { value: value.cause[0], label: resolveCauseLabel(value.cause[0]) } : null}
                                onChange={(opt: any) => onChange(opt ? { ...value, cause: [opt.value] } : { ...value, cause: [], repaired_equipment: [] })}
                                formatCreateLabel={(v: string) => `+ "${v}"`}
                                menuPlacement="auto" menuPortalTarget={typeof document !== "undefined" ? document.body : undefined} classNamePrefix="react-select" styles={makeSelectStyles(SELECT_ACCENT.blue)} />
                        </div>
                        {(causeOptionsAvail?.length ?? 0) > 1 && (
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
                                isDisabled={!correctionOptionsAvail}
                                value={value.repaired_equipment[0] ? { value: value.repaired_equipment[0], label: resolveCorrectionLabel(value.repaired_equipment[0]) } : null}
                                onChange={(opt: any) => onChange({ ...value, repaired_equipment: opt ? [opt.value] : [] })}
                                formatCreateLabel={(v: string) => `+ "${v}"`}
                                menuPlacement="auto" menuPortalTarget={typeof document !== "undefined" ? document.body : undefined} classNamePrefix="react-select" styles={makeSelectStyles(SELECT_ACCENT.amber)} />
                        </div>
                        {(correctionOptionsAvail?.length ?? 0) > 1 && (
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
                                        {value.corrective_actions.length > 1 && (
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
                                                    <label className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-lg tw-bg-white tw-border tw-border-red-300 tw-text-red-600 tw-font-medium tw-text-xs tw-cursor-pointer hover:tw-bg-red-50 tw-shadow-sm tw-transition-all">
                                                        <input type="file" accept="image/*" multiple className="tw-hidden" onChange={(e) => addImgs(i, "beforeImages", e.target.files)} />
                                                        <PhotoIcon className="tw-w-4 tw-h-4" /><span>{t("attachPhoto", lang)}</span>
                                                    </label>
                                                </div>
                                                {action.beforeImages.length > 0 ? (
                                                    <div className="tw-grid tw-grid-cols-3 tw-gap-2">
                                                        {action.beforeImages.map((img) => (
                                                            <div key={img.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-red-200 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                                                                <img src={img.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                                                                {(img.createdAt || img.location) && (
                                                                    <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                                                        {img.createdAt && <span className="tw-block tw-font-mono">{img.createdAt}</span>}
                                                                        {img.location && <span className="tw-block tw-opacity-80 tw-truncate">📍 {img.location}</span>}
                                                                    </span>
                                                                )}
                                                                <button type="button" onClick={() => removeImg(i, "beforeImages", img.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-lg tw-transition-all"><XMarkIcon className="tw-w-3.5 tw-h-3.5" /></button>
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
                                                    <label className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-lg tw-bg-white tw-border tw-border-green-300 tw-text-green-600 tw-font-medium tw-text-xs tw-cursor-pointer hover:tw-bg-green-50 tw-shadow-sm tw-transition-all">
                                                        <input type="file" accept="image/*" multiple className="tw-hidden" onChange={(e) => addImgs(i, "afterImages", e.target.files)} />
                                                        <PhotoIcon className="tw-w-4 tw-h-4" /><span>{t("attachPhoto", lang)}</span>
                                                    </label>
                                                </div>
                                                {action.afterImages.length > 0 ? (
                                                    <div className="tw-grid tw-grid-cols-3 tw-gap-2">
                                                        {action.afterImages.map((img) => (
                                                            <div key={img.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-green-200 tw-bg-white tw-shadow-sm hover:tw-shadow-md tw-transition-shadow">
                                                                <img src={img.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                                                                {(img.createdAt || img.location) && (
                                                                    <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                                                        {img.createdAt && <span className="tw-block tw-font-mono">{img.createdAt}</span>}
                                                                        {img.location && <span className="tw-block tw-opacity-80 tw-truncate">📍 {img.location}</span>}
                                                                    </span>
                                                                )}
                                                                <button type="button" onClick={() => removeImg(i, "afterImages", img.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-lg tw-transition-all"><XMarkIcon className="tw-w-3.5 tw-h-3.5" /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="tw-text-center tw-py-6 tw-text-green-600 tw-text-sm tw-font-medium">{th ? "ยังไม่มีรูปหลังแก้ไข" : "No after image yet"}</div>
                                                )}
                                            </div>
                                        </div>
                                        <textarea value={action.text} onChange={(e) => setText(i, e.target.value)} rows={3} placeholder={th ? "กรอกรายละเอียดการดำเนินการ..." : "Enter action details..."} className="tw-w-full tw-px-3 tw-py-2 tw-border tw-border-gray-300 tw-rounded-lg tw-text-sm tw-bg-white focus:tw-outline-none focus:tw-border-amber-400 tw-transition-colors tw-resize-y" />
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
    const [saving, setSaving] = useState(false);
    const [photos_problem, setPhotosProblem] = useState<PhotoItem[]>([]);
    const [chargers, setChargers] = useState<ChargerInfo[]>([]);
    const [loadingChargers, setLoadingChargers] = useState(false);
    const [devices, setDevices] = useState<string[]>([]);
    const [loadingDevices, setLoadingDevices] = useState(false);

    const editId = searchParams.get("edit_id") ?? "";
    const isEdit = !!editId;

    // เปิดใบงานที่ปิดแล้ว (Closed) = โหมดดูอย่างเดียว (อ่านไม่แก้, ปิดฟีเจอร์ร่าง)
    const viewOnly = job.status === "Closed";

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
        if (!editId || !stationId || viewOnly) return; // โหมดดูอย่างเดียว: ไม่ถามกู้ร่าง
        (async () => {
            const draft = await loadDraft();
            if (draft) {
                setPendingDraft(draft);
                setShowDraftPrompt(true);
            }
        })();
    }, [editId, stationId, loadDraft, viewOnly]);

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
                repair_result_remark: pendingDraft.repair_result_remark || "",
                problem_type: pendingDraft.problem_type?.length ? pendingDraft.problem_type : prev.problem_type,
                problem_type_other: pendingDraft.problem_type_other || prev.problem_type_other,
                cause: pendingDraft.cause?.length ? pendingDraft.cause : prev.cause,
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
            job.repair_result_remark ||
            job.problem_type.length > 0 ||
            job.cause.length > 0;
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
                repair_result_remark: job.repair_result_remark,
                problem_type: job.problem_type,
                problem_type_other: job.problem_type_other,
                cause: job.cause,
            };
            await saveDraftNow(draftData);
        } catch (e) {
            console.error("Failed to save draft with images:", e);
        }
    }, [job.corrective_actions, job.repaired_equipment, job.repair_result, job.preventive_action, job.inprogress_remarks, job.repair_result_remark, job.problem_type, job.problem_type_other, job.cause, editId, stationId, saveDraftNow]);

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
        return job.repair_result === "แก้ไขสำเร็จ" || job.repair_result === "แก้ไขไม่สำเร็จ";
    }, [job.repair_result]);

    const isMonitoringResult = useMemo(() => {
        return WO_WAITING_RESULTS.includes(job.repair_result);
    }, [job.repair_result]);

    // ต้องกรอกหมายเหตุเฉพาะ spare part / site access — manpower / approve ไม่ต้อง
    const needsRepairRemark = useMemo(() => {
        return job.repair_result === "WO - wait for spare part" || job.repair_result === "WO - wait for site access";
    }, [job.repair_result]);

    // เลือกปัญหา = "ไม่พบปัญหา" → ปิดงานได้เลย ไม่ต้องกรอกรายละเอียดการซ่อม
    const isNoProblem = job.problem_type.includes(NO_PROBLEM_OPTION.value);

    const validations = useMemo<ValidationItem[]>(() => [
        { key: "problemType", label: t("validProblemType", lang), isValid: job.problem_type.some(Boolean), message: t("notSelected", lang), isRequired: true, scrollId: "cm-problem-type" },
        { key: "problemTypeOther", label: lang === "th" ? "ระบุปัญหา (อื่นๆ)" : "Specify Problem (Other)", isValid: !!job.problem_type_other.trim(), message: t("notFilled", lang), isRequired: job.problem_type.includes("Other"), scrollId: "cm-problem-type" },
        { key: "cause", label: t("validCause", lang), isValid: job.cause.some(c => c.trim() !== ""), message: t("notFilled", lang), isRequired: !isNoProblem, scrollId: "cm-cause" },
        { key: "correctiveAction", label: t("validCorrectiveAction", lang), isValid: job.corrective_actions.some((a: CorrectiveItem) => a.text.trim() !== ""), message: t("notFilled", lang), isRequired: !isNoProblem, scrollId: "cm-corrective" },
        { key: "beforePhoto", label: t("validBeforePhoto", lang), isValid: job.corrective_actions.every((a: CorrectiveItem) => a.beforeImages.length > 0), message: t("notFilled", lang), isRequired: !isNoProblem, scrollId: "cm-corrective" },
        { key: "afterPhoto", label: t("validAfterPhoto", lang), isValid: job.corrective_actions.every((a: CorrectiveItem) => a.afterImages.length > 0), message: t("notFilled", lang), isRequired: isClosedResult && !isNoProblem, scrollId: "cm-corrective" },
        { key: "repairResult", label: t("validRepairResult", lang), isValid: !!job.repair_result, message: t("notSelected", lang), isRequired: !isNoProblem, scrollId: "cm-repair-result" },
        // { key: "preventiveAction", label: t("preventiveAction", lang), isValid: job.preventive_action.some((p: string) => p.trim() !== ""), message: t("notFilled", lang), isRequired: isClosedResult && !isNoProblem, scrollId: "cm-preventive" },
        { key: "inprogressRemarks", label: lang === "th" ? "หมายเหตุผลหลังซ่อม" : "Repair Result Remark", isValid: !!job.repair_result_remark.trim(), message: t("notFilled", lang), isRequired: needsRepairRemark, scrollId: "cm-repair-result" },
        { key: "noProblemPhoto", label: lang === "th" ? "รูปภาพ" : "Photo", isValid: (job.corrective_actions[0]?.afterImages.length ?? 0) > 0, message: t("notFilled", lang), isRequired: isNoProblem, scrollId: "cm-noproblem-photo" },
        { key: "noProblemRemarks", label: t("remarks", lang), isValid: !!job.inprogress_remarks.trim(), message: t("notFilled", lang), isRequired: isNoProblem, scrollId: "cm-remarks" },
    ], [job, lang, isClosedResult, isMonitoringResult, needsRepairRemark, isNoProblem]);
    const canSave = useMemo(() => validations.filter(v => v.isRequired).every(v => v.isValid), [validations]);

    // ปิดงานเมื่อ "แก้ไขสำเร็จ" หรือ "ไม่พบปัญหา" → Closed | ติดตามผล/รออะไหล่ (และอื่นๆ) → In Progress
    const isClosing = isClosedResult || isNoProblem;
    const targetStatus = isClosing ? "Closed" : "In Progress";
    const targetTab = isClosing ? "closed" : "in-progress";

    // ==================== HELPERS ====================
    const localTodayFormatted = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };
    const localTodayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
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
        const now = getNowTimestamp();
        const nowISO = new Date().toISOString();
        const cachedLoc = gpsCache.current.fetched ? gpsCache.current.location : undefined;
        const newImages: PhotoItem[] = Array.from(files).slice(0, MAX_PHOTOS).map((file, i) => ({
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
        const now = getNowTimestamp();
        const nowISO = new Date().toISOString();
        const cachedLoc = gpsCache.current.fetched ? gpsCache.current.location : undefined;
        const newImages: PhotoItem[] = Array.from(files).slice(0, MAX_PHOTOS).map((file, i) => ({
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
                const isChargerFailure = faultyEq.startsWith("charger_") || faultyEq === "DCCHARFC" || faultyEq === "ACCHARFC";
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
                        // failure code ระดับสถานี (DCCHARFC/ACCHARFC) → ใช้ charger ตัวแรกที่ตรงประเภท
                        const wantType = faultyEq === "DCCHARFC" ? "DC" : "AC";
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
                    // Non-charger → ใช้ข้อมูล static ที่ frontend (STATFC = station)
                    const key = faultyEq === "STATFC" ? "station" : faultyEq.toLowerCase();
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
    }, [job.faulty_equipment, chargers, stationId]);

    // Clear repaired_equipment เมื่อเปลี่ยนอุปกรณ์ที่พัง
    // const prevFaultyRef = useRef(job.faulty_equipment);
    // useEffect(() => {
    //     if (prevFaultyRef.current !== job.faulty_equipment) {
    //         setJob(prev => ({ ...prev, repaired_equipment: [] }));
    //         prevFaultyRef.current = job.faulty_equipment;
    //     }
    // }, [job.faulty_equipment]);
    const prevFaultyRef = useRef<string | null>(null); // เปลี่ยนจาก job.faulty_equipment

    useEffect(() => {
        // ครั้งแรก (โหลดจาก server) → แค่ set ref, ไม่ล้าง
        if (prevFaultyRef.current === null) {
            prevFaultyRef.current = job.faulty_equipment;
            return;
        }
        if (prevFaultyRef.current !== job.faulty_equipment) {
            setJob(prev => ({ ...prev, repaired_equipment: [] }));
            prevFaultyRef.current = job.faulty_equipment;
        }
    }, [job.faulty_equipment]);

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
                    start_repair_date: data.start_repair_date || "",

                    // ✅ ดึงจาก flat fields โดยตรง
                    problem_type: Array.isArray(data.problem_type) ? data.problem_type : (data.problem_type ? [data.problem_type] : []),
                    problem_type_other: data.problem_type_other ?? "",
                    cause: Array.isArray(data.cause) ? data.cause : (data.cause ? [data.cause] : []),
                    repair_result: data.repair_result ?? "",
                    inprogress_remarks: data.inprogress_remarks ?? "",
                    repair_result_remark: data.repair_result_remark ?? "",
                    resolved_date: data.resolved_date ? isoToDisplay(data.resolved_date) : "",
                    signature: data.signature ?? "",
                    start_repair_time: data.start_repair_time ?? "",
                    resolved_time: data.resolved_time ?? "",

                    repaired_equipment: Array.isArray(data.repaired_equipment)
                        ? data.repaired_equipment
                        : [],

                    preventive_action: Array.isArray(data.preventive_action) && data.preventive_action.length > 0
                        ? data.preventive_action
                        : [""],

                    corrective_actions: (() => {
                        // สร้าง lookup map จาก photos_repair
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

                        // ✅ ถ้ามี corrective_actions ใน DB → ใช้ตามปกติ
                        if (Array.isArray(data.corrective_actions) && data.corrective_actions.length > 0) {
                            return data.corrective_actions.map((a: any) => ({
                                text: a.text || "",
                                beforeImages: (a.beforeImages || []).map((img: any, idx: number) => {
                                    const repair = repairPhotoMap[img.url] || {};
                                    return {
                                        id: `server-before-${idx}-${img.name || img.url}`,
                                        file: null,
                                        preview: img.url?.startsWith("http") ? img.url : `${API_BASE}${img.url}`,
                                        isServer: true,
                                        serverUrl: img.url,
                                        createdAt: formatPhotoDate(img.uploadedAt || repair.uploadedAt),
                                        uploadedAtRaw: img.uploadedAt || repair.uploadedAt || undefined,
                                        location: img.location || repair.location || undefined,
                                    };
                                }),
                                afterImages: (a.afterImages || []).map((img: any, idx: number) => {
                                    const repair = repairPhotoMap[img.url] || {};
                                    return {
                                        id: `server-after-${idx}-${img.name || img.url}`,
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

                        // ✅ Fallback: reconstruct จาก photos_repair
                        if (Object.keys(repairByGroup).length > 0) {
                            // หา action indexes จาก group names: before_0, after_0, before_1, after_1, ...
                            const actionIndexes = new Set<number>();
                            for (const group of Object.keys(repairByGroup)) {
                                const match = group.match(/^(before|after)_(\d+)$/);
                                if (match) actionIndexes.add(parseInt(match[2]));
                            }

                            // const maxIndex = actionIndexes.size > 0 ? Math.max(...actionIndexes) : 0;
                            const maxIndex = actionIndexes.size > 0 ? Math.max(...Array.from(actionIndexes)) : 0;
                            const actions: CorrectiveItem[] = [];

                            for (let i = 0; i <= maxIndex; i++) {
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
                                    createdAt: formatPhotoDate(p.uploadedAt),
                                    uploadedAtRaw: p.uploadedAt || undefined,
                                    location: (p as any).location || undefined,
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
            // รวมชุดกรอกเพิ่มเข้ากับ set แรก (ปัญหา/สาเหตุ/การแก้ไข/การดำเนินการ)
            const allCorrectiveActions = [...job.corrective_actions, ...extraGroups.flatMap(g => g.corrective_actions)];
            const mergedProblemType = Array.from(new Set([...job.problem_type, ...extraGroups.flatMap(g => g.problem_type)].filter(Boolean)));
            const mergedCause = Array.from(new Set([...job.cause, ...extraGroups.flatMap(g => g.cause)].filter(Boolean)));
            const mergedRepairedEquipment = Array.from(new Set([...job.repaired_equipment, ...extraGroups.flatMap(g => g.repaired_equipment)].filter(Boolean)));

            // ==================== STEP 1: Upload รูปภาพก่อน ====================
            const uploadedCorrectiveActions = await Promise.all(
                allCorrectiveActions.map(async (action, actionIndex) => {
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
                            if (uploadRes.ok) {
                                const uploadData = await uploadRes.json();
                                if (uploadData.files?.[0]) {
                                    uploadedBeforeImages.push({
                                        name: uploadData.files[0].filename,
                                        url: uploadData.files[0].url,
                                        location: img.location || uploadData.files[0].location,
                                        uploadedAt: uploadData.files[0].uploadedAt || img.uploadedAtRaw || new Date().toISOString(),
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
                                if (img.location) formData.append("location", img.location);
                                formData.append("created_at", new Date().toISOString());

                                const uploadRes = await fetch(
                                    `${API_BASE}/cmreport/${encodeURIComponent(editId)}/photos`,
                                    { method: "POST", credentials: "include", body: formData }
                                );
                                if (uploadRes.ok) {
                                    const uploadData = await uploadRes.json();
                                    if (uploadData.files?.[0]) {
                                        uploadedBeforeImages.push({
                                            name: uploadData.files[0].filename,
                                            url: uploadData.files[0].url,
                                            location: img.location || uploadData.files[0].location,
                                            uploadedAt: uploadData.files[0].uploadedAt || img.uploadedAtRaw || new Date().toISOString(),
                                        });
                                    }
                                }
                            } catch (e) {
                                console.error("Failed to upload before image from draft:", e);
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
                            if (uploadRes.ok) {
                                const uploadData = await uploadRes.json();
                                if (uploadData.files?.[0]) {
                                    uploadedAfterImages.push({
                                        name: uploadData.files[0].filename,
                                        url: uploadData.files[0].url,
                                        location: img.location || uploadData.files[0].location,
                                        uploadedAt: uploadData.files[0].uploadedAt || img.uploadedAtRaw || new Date().toISOString(),
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
                                if (img.location) formData.append("location", img.location);
                                formData.append("created_at", new Date().toISOString());

                                const uploadRes = await fetch(
                                    `${API_BASE}/cmreport/${encodeURIComponent(editId)}/photos`,
                                    { method: "POST", credentials: "include", body: formData }
                                );
                                if (uploadRes.ok) {
                                    const uploadData = await uploadRes.json();
                                    if (uploadData.files?.[0]) {
                                        uploadedAfterImages.push({
                                            name: uploadData.files[0].filename,
                                            url: uploadData.files[0].url,
                                            location: img.location || uploadData.files[0].location,
                                            uploadedAt: uploadData.files[0].uploadedAt || img.uploadedAtRaw || new Date().toISOString(),
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

            // ==================== STEP 2: Save data ====================
            // ส่ง flat fields ตรงๆ (ไม่ wrap ใน job)
            const res = await fetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    station_id: stationId,
                    status: targetStatus,
                    inspector,
                    job: {
                        problem_type: mergedProblemType,
                        problem_type_other: job.problem_type_other,
                        cause: mergedCause,
                        corrective_actions: uploadedCorrectiveActions,
                        repaired_equipment: mergedRepairedEquipment,
                        repair_result: job.repair_result,
                        preventive_action: job.preventive_action,
                        inprogress_remarks: job.inprogress_remarks,
                        repair_result_remark: job.repair_result_remark,
                        start_repair_date: job.start_repair_date || localTodayISO(),
                        resolved_date: isClosedResult ? (job.resolved_date ? displayToISO(job.resolved_date) : localTodayISO()) : "",
                        signature: (isClosedResult || isNoProblem) ? job.signature : "",
                        start_repair_time: job.start_repair_time,
                        resolved_time: isClosedResult ? job.resolved_time : "",
                    }
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

    // ชุดตัวเลือก "ปัญหา" ตาม FAILURECODE ของใบงาน (ถ้าไม่มีลิสต์กำหนด → ใช้ชุดเดิม) + "ไม่พบปัญหา"
    const failureProblemOptions = PROBLEM_OPTIONS_BY_FAILURECODE[job.faulty_equipment] ?? null;
    const problemSelectOptions = [
        ...(failureProblemOptions ?? []),
        { value: NO_PROBLEM_OPTION.value, label: lang === "en" ? NO_PROBLEM_OPTION.en : NO_PROBLEM_OPTION.th },
    ];
    const resolveProblemLabel = (val: string) =>
        problemSelectOptions.find(o => o.value === val)?.label ?? val;

    // ชุดตัวเลือก "สาเหตุ" — รวมจากทุกปัญหาที่เลือก (dedupe ตาม value)
    const causeOptions = (() => {
        const seen = new Set<string>();
        const all: { value: string; label: string }[] = [];
        for (const p of job.problem_type) {
            const opts = CAUSE_OPTIONS_BY_FC_PROBLEM[job.faulty_equipment]?.[p] ?? CAUSE_OPTIONS_BY_PROBLEM[p];
            if (opts) for (const o of opts) if (!seen.has(o.value)) { seen.add(o.value); all.push(o); }
        }
        return all.length ? all : null;
    })();

    // สาเหตุที่ถูกเลือกในบล็อกเพิ่มเติม — ตัดออกจากช่องสาเหตุหลัก (กันเลือกซ้ำ)
    const causesInGroups = extraGroups.flatMap(g => g.cause).filter(Boolean);
    const mainCauseOptions = causeOptions
        ? causeOptions.filter(o => !causesInGroups.includes(o.value) || job.cause.includes(o.value))
        : null;

    // ล้างสาเหตุที่ค้างมาจากปัญหาอื่น — เก็บเฉพาะค่าที่อยู่ในลิสต์ปัจจุบัน
    useEffect(() => {
        if (causeOptions && job.cause.length) {
            const valid = new Set(causeOptions.map(o => o.value));
            const filtered = job.cause.filter(c => !c || valid.has(c)); // เก็บแถวเปล่าไว้
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
    const correctionOptions = (() => {
        const seen = new Set<string>();
        const all: { value: string; label: string }[] = [];
        for (const p of job.problem_type) {
            for (const c of job.cause) {
                const opts = CORRECTION_OPTIONS_BY_FC_PROBLEM_CAUSE[`${job.faulty_equipment}:${p}:${c}`];
                if (opts) for (const o of opts) if (!seen.has(o.value)) { seen.add(o.value); all.push(o); }
            }
        }
        return all.length ? all : null;
    })();
    const resolveCorrectionLabel = (val: string) =>
        correctionOptions?.find(o => o.value === val)?.label ?? formatDeviceName(val);

    // การแก้ไขที่ถูกเลือกในบล็อกเพิ่มเติม — ตัดออกจากช่องการแก้ไขหลัก (กันเลือกซ้ำ)
    const correctionsInGroups = extraGroups.flatMap(g => g.repaired_equipment).filter(Boolean);
    const mainCorrectionOptions = correctionOptions
        ? correctionOptions.filter(o => !correctionsInGroups.includes(o.value) || job.repaired_equipment.includes(o.value))
        : null;

    // ล้างการแก้ไขที่ค้างมาจาก combo อื่น — เก็บเฉพาะค่าที่อยู่ในลิสต์ปัจจุบัน
    useEffect(() => {
        if (correctionOptions && job.repaired_equipment.length) {
            const valid = new Set(correctionOptions.map(o => o.value));
            const filtered = job.repaired_equipment.filter(v => !v || valid.has(v)); // เก็บแถวเปล่าไว้
            if (filtered.length !== job.repaired_equipment.length) {
                setJob(prev => ({ ...prev, repaired_equipment: filtered }));
            }
        }
    }, [job.faulty_equipment, job.problem_type, job.cause]); // eslint-disable-line react-hooks/exhaustive-deps

    // auto: sync "การดำเนินการแก้ไข" ให้ตรงกับ "การแก้ไข" ที่เลือก (1 รายการต่อ 1 การแก้ไข)
    // เพิ่มเมื่อเลือกการแก้ไข / ลบแถว code เดิมออกเมื่อเอาการแก้ไขออก | ช่องรายละเอียดปล่อยว่างให้ user กรอกเอง
    // แถวที่ไม่มี code (โหลดมา/เพิ่มเอง) จะถูกเก็บไว้ | ใบงานที่โหลดมา (edit) ข้ามรอบแรก
    const correctiveSyncInit = useRef(false);
    useEffect(() => {
        if (editId && !correctiveSyncInit.current) { correctiveSyncInit.current = true; return; }
        const codes = job.repaired_equipment.filter(Boolean);
        const codeSet = new Set(codes);
        setJob(prev => {
            // เก็บ: แถวไม่มี code (โหลด/เพิ่มเอง) หรือแถว code ที่ยังถูกเลือกอยู่
            let next = prev.corrective_actions.filter(a => !a.code || codeSet.has(a.code));
            // เพิ่ม: code ที่ยังไม่มีแถว
            const have = new Set(next.map(a => a.code).filter(Boolean));
            for (const c of codes) if (!have.has(c)) { next = [...next, { code: c, text: "", beforeImages: [], afterImages: [] }]; have.add(c); }
            // ถ้ามีแถว code แล้ว → ตัดแถวเปล่าไม่มี code ที่ว่างสนิททิ้ง
            if (next.some(a => a.code)) next = next.filter(a => a.code || a.text.trim() || a.beforeImages.length || a.afterImages.length);
            // กันแถวว่างหมด — อย่างน้อยเหลือ 1 แถว
            if (next.length === 0) next = [{ text: "", beforeImages: [], afterImages: [] }];
            // ถ้าไม่เปลี่ยน → คืนค่าเดิม (กัน re-render ไม่จำเป็น)
            const same = next.length === prev.corrective_actions.length && next.every((a, i) => a === prev.corrective_actions[i]);
            return same ? prev : { ...prev, corrective_actions: next };
        });
    }, [job.repaired_equipment]); // eslint-disable-line react-hooks/exhaustive-deps

    // ต้องเลือก "การแก้ไข" ก่อน ถึงจะเลือกผลหลังซ่อม = แก้ไขสำเร็จได้
    const hasCorrection = job.repaired_equipment.length > 0 && !!job.repaired_equipment[0];
    useEffect(() => {
        if (job.repair_result === "แก้ไขสำเร็จ" && !hasCorrection) {
            setJob(prev => ({ ...prev, repair_result: "" }));
        }
    }, [hasCorrection, job.repair_result]);

    // ==================== RENDER ====================
    return (
        <section className="tw-pb-24">
            {/* Draft Prompt Dialog */}
            {!viewOnly && showDraftPrompt && pendingDraft && (
                <div className="tw-fixed tw-inset-0 tw-bg-black/50 tw-flex tw-items-center tw-justify-center tw-z-50">
                    <div className="tw-bg-white tw-rounded-2xl tw-shadow-2xl tw-p-6 tw-mx-4 tw-max-w-md tw-w-full">
                        <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4">
                            <div className="tw-w-12 tw-h-12 tw-rounded-full tw-bg-amber-100 tw-flex tw-items-center tw-justify-center">
                                <ExclamationTriangleIcon className="tw-w-6 tw-h-6 tw-text-amber-600" />
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
                                className="tw-flex-1 tw-px-4 tw-py-2.5 tw-rounded-xl tw-bg-amber-500 tw-text-white tw-font-medium hover:tw-bg-amber-600 tw-transition-colors"
                            >
                                {lang === "th" ? "โหลด" : "Load"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

                    {/* fieldset disabled = โหมดดูอย่างเดียวเมื่อใบงานปิดแล้ว */}
                    <fieldset disabled={viewOnly} className="tw-border-0 tw-p-0 tw-m-0 tw-min-w-0">
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
                    <div className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
                        <div className="tw-flex tw-items-center tw-gap-3 tw-bg-red-600 hover:tw-bg-red-700 tw-px-4 tw-py-3 tw-text-white tw-cursor-pointer tw-transition-colors">
                            <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-white tw-text-red-600 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-sm">1</div>
                            <span className="tw-font-semibold tw-text-base">{t("problemDetails", lang)}</span>
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
                                        <optgroup label="Failure Code">
                                            <option value="DCCHARFC">DC Charger Failure</option>
                                            <option value="ACCHARFC">AC Charger Failure</option>
                                            <option value="STATFC">Station Failure</option>
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

                    {/* Section 2: Problem Found + Corrective (Editable) — รวมปัญหากับการแก้ไขในการ์ดเดียว */}
                    <div className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
                        <div className="tw-flex tw-items-center tw-gap-3 tw-bg-blue-600 hover:tw-bg-blue-700 tw-px-4 tw-py-3 tw-text-white tw-cursor-pointer tw-transition-colors">
                            <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-white tw-text-blue-600 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-sm">2</div>
                            <span className="tw-font-semibold tw-text-base">{lang === "th" ? "ปัญหาและการแก้ไข" : "Problem & Correction"}</span>
                        </div>

                        <div className="tw-p-6 tw-space-y-5">
                            {/* วันที่เริ่มแก้ไข — readonly (ย้ายมาไว้บนสุด เหนือปัญหา; เมื่อสำเร็จจะย้ายไปกรอกใต้ผลหลังซ่อม) */}
                            {!isClosedResult && (
                                <div className="tw-space-y-2 md:tw-w-96">
                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>
                                        {t("resolvedDate", lang)}
                                    </label>
                                    <Input
                                        type="text"
                                        value={job.start_repair_date ? isoToDisplay(job.start_repair_date) : localTodayFormatted()}
                                        readOnly
                                        crossOrigin=""
                                        className="!tw-w-full !tw-h-12 !tw-bg-gray-100 !tw-text-gray-700 !tw-opacity-100 !tw-border-gray-200 !tw-rounded-xl"
                                        style={{ backgroundColor: "#f3f4f6", color: "#374151" }}
                                        containerProps={{ className: "!tw-min-w-0 !tw-h-12" }}
                                    />
                                </div>
                            )}

                            {/* Problem Type */}
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
                                                // เปลี่ยน/ลบปัญหา → ล้างค่าช่องอื่นด้วย (สาเหตุ/การแก้ไข/ชุดที่เพิ่ม)
                                                setJob(prev => ({ ...prev, problem_type: opt ? [opt.value] : [], cause: [], repaired_equipment: [] }));
                                                setExtraGroups([]);
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

                            {/* Cause — ซ่อนเมื่อเลือก "ไม่พบปัญหา" */}
                            {!isNoProblem && (
                                <div id="cm-cause" className="tw-space-y-2">
                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500"></span>
                                        {t("cause", lang)} <span className="tw-text-red-500">*</span>
                                    </label>
                                    <div className="tw-flex tw-items-start tw-gap-2">
                                        <div className="tw-flex-1 tw-min-w-0 md:tw-flex-none md:tw-w-96">
                                            <CreatableSelect isClearable
                                                placeholder={lang === "th" ? "เลือกสาเหตุ..." : "Select cause..."}
                                                options={mainCauseOptions ?? []}
                                                isDisabled={viewOnly || !mainCauseOptions}
                                                value={job.cause[0] ? { value: job.cause[0], label: resolveCauseLabel(job.cause[0]) } : null}
                                                onChange={(opt: any) => setJob(prev => opt ? { ...prev, cause: [opt.value] } : { ...prev, cause: [], repaired_equipment: [] })}
                                                formatCreateLabel={(v: string) => `+ "${v}"`}
                                                menuPlacement="auto" menuPortalTarget={typeof document !== "undefined" ? document.body : undefined} classNamePrefix="react-select" styles={makeSelectStyles(SELECT_ACCENT.blue)} />
                                        </div>
                                        {!viewOnly && (mainCauseOptions?.length ?? 0) > 1 && (
                                            <button type="button" onClick={addCauseGroup} title={lang === "th" ? "เพิ่มสาเหตุ" : "Add cause"} className="tw-flex-shrink-0 tw-w-12 tw-h-12 tw-rounded-xl tw-border tw-border-blue-300 tw-bg-blue-50 tw-text-blue-600 tw-flex tw-items-center tw-justify-center hover:tw-bg-blue-100 hover:tw-border-blue-400 tw-transition-all tw-text-xl tw-font-bold tw-leading-none">+</button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* การแก้ไข — รวมในการ์ดเดียวกับปัญหา (ซ่อนเมื่อเลือก "ไม่พบปัญหา") */}
                        {!isNoProblem && (
                        <div className="tw-px-6 tw-pb-6 tw-space-y-6">
                            {/* Repaired Equipment (การแก้ไข) */}
                            <div className="tw-grid tw-grid-cols-1 tw-gap-5">
                                <div className="tw-space-y-2">
                                    <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-gray-700">
                                        <span className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-amber-500"></span>
                                        {t("repairedEquipment", lang)}
                                    </label>
                                    <div className="tw-flex tw-items-start tw-gap-2">
                                        <div className="tw-flex-1 tw-min-w-0 md:tw-flex-none md:tw-w-96">
                                            <CreatableSelect isClearable
                                                placeholder={lang === "th" ? "เลือกการแก้ไข..." : "Select correction..."}
                                                options={mainCorrectionOptions ?? []}
                                                isDisabled={viewOnly || !mainCorrectionOptions}
                                                value={job.repaired_equipment[0] ? { value: job.repaired_equipment[0], label: resolveCorrectionLabel(job.repaired_equipment[0]) } : null}
                                                onChange={(opt: any) => setJob({ ...job, repaired_equipment: opt ? [opt.value] : [] })}
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
                                                                            {(img.createdAt || img.location) && (
                                                                                <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                                                                    {img.createdAt && <span className="tw-block tw-font-mono">{img.createdAt}</span>}
                                                                                    {img.location && <span className="tw-block tw-opacity-80 tw-truncate">📍 {img.location}</span>}
                                                                                </span>
                                                                            )}
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
                                                                    {t("afterPhoto", lang)} {isClosedResult && <span className="tw-text-red-500">*</span>}
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
                                                                            {(img.createdAt || img.location) && (
                                                                                <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                                                                    {img.createdAt && <span className="tw-block tw-font-mono">{img.createdAt}</span>}
                                                                                    {img.location && <span className="tw-block tw-opacity-80 tw-truncate">📍 {img.location}</span>}
                                                                                </span>
                                                                            )}
                                                                            <button type="button" onClick={() => removeCorrectiveAfterImage(i, img.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-lg tw-transition-all">
                                                                                <XMarkIcon className="tw-w-3.5 tw-h-3.5" />
                                                                            </button>
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
                                />
                            ))}
                        </div>
                        )}
                    </div>

                    {/* ผลหลังซ่อม + วันที่/ลายเซ็น — ย้ายมาไว้เหนือหมายเหตุ */}
                    {!isNoProblem && (
                    <div className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
                        <div className="tw-p-6 tw-space-y-6">
                            {/* Repair Result */}
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
                                        <option value="">{lang === "th" ? "-- เลือกผลหลังซ่อม --" : "-- Select repair result --"}</option>
                                        {REPAIR_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {lang === "en" ? opt.en : opt.th}
                                            </option>
                                        ))}
                                    </select>
                                    {/* Inline remarks - แสดงเมื่อเลือกสถานะ WO waiting (ยกเว้น wait for manpower) */}
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

                            {/* วันที่/เวลา — วันที่แก้ไขเสร็จแสดงเฉพาะเมื่อ "แก้ไขสำเร็จ" */}
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
                                                value={job.resolved_time}
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
                                    <label className="tw-inline-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-lg tw-bg-white tw-border tw-border-amber-300 tw-text-amber-600 tw-font-medium tw-text-xs tw-cursor-pointer hover:tw-bg-amber-50 tw-shadow-sm tw-transition-all">
                                        <input type="file" accept="image/*" multiple className="tw-hidden" onChange={(e) => addCorrectiveAfterImages(0, e.target.files)} />
                                        <PhotoIcon className="tw-w-4 tw-h-4" />
                                        <span>{t("attachPhoto", lang)}</span>
                                    </label>
                                </div>
                                {(job.corrective_actions[0]?.afterImages.length ?? 0) > 0 ? (
                                    <div className="tw-grid tw-grid-cols-3 tw-gap-2">
                                        {job.corrective_actions[0].afterImages.map((img) => (
                                            <div key={img.id} className="tw-relative tw-aspect-square tw-rounded-lg tw-overflow-hidden tw-border tw-border-amber-200 tw-bg-white tw-shadow-sm">
                                                <img src={img.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />
                                                {(img.createdAt || img.location) && (
                                                    <span className="tw-absolute tw-bottom-1 tw-right-1 tw-text-[8px] tw-leading-tight tw-bg-black/60 tw-text-white tw-px-1.5 tw-py-1 tw-rounded tw-pointer-events-none tw-text-right tw-max-w-[90%] tw-truncate">
                                                        {img.createdAt && <span className="tw-block tw-font-mono">{img.createdAt}</span>}
                                                        {img.location && <span className="tw-block tw-opacity-80 tw-truncate">📍 {img.location}</span>}
                                                    </span>
                                                )}
                                                <button type="button" onClick={() => removeCorrectiveAfterImage(0, img.id)} className="tw-absolute tw-top-1 tw-right-1 tw-w-6 tw-h-6 tw-bg-red-500 tw-text-white tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-shadow-lg tw-transition-all">
                                                    <XMarkIcon className="tw-w-3.5 tw-h-3.5" />
                                                </button>
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

                    {/* Remarks (Editable) */}
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

                    {/* Validation Card — ซ่อนในโหมดดูอย่างเดียว */}
                    {!viewOnly && <div className="tw-mb-6"><CMValidationCard validations={validations} lang={lang} /></div>}
                    </fieldset>

                    {/* Actions */}
                    <div className="tw-flex tw-items-center tw-justify-end tw-pt-6 tw-border-t tw-border-gray-200">
                        {viewOnly ? (
                            <Button
                                type="button"
                                onClick={() => router.back()}
                                className="tw-bg-blue-gray-700 hover:tw-bg-blue-gray-800 tw-text-white tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-shadow-xl tw-transition-all"
                            >
                                {lang === "th" ? "กลับ" : "Back"}
                            </Button>
                        ) : (
                            <Button
                                onClick={onFinalSave}
                                disabled={saving || !canSave}
                                className={`tw-text-white tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-shadow-xl disabled:tw-opacity-50 disabled:tw-cursor-not-allowed disabled:tw-shadow-none tw-transition-all tw-transform hover:tw-scale-[1.02] ${isClosing
                                    ? "tw-bg-gray-700 hover:tw-bg-red-800 hover:tw-shadow-red-500/30"
                                    : "tw-bg-amber-500 hover:tw-bg-amber-600 hover:tw-shadow-amber-500/30"
                                    }`}
                            >
                                {saving ? t("saving", lang) : (isClosing ? t("closed", lang) : t("save", lang))}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </section>
    );
}