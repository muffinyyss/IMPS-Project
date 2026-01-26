"use client";
import React, { useMemo, useRef, useState, useEffect } from "react";
import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardFooter,
    Input,
    Typography,
    Textarea,
    Tooltip,
} from "@material-tailwind/react";
import Image from "next/image";
import { draftKey, saveDraftLocal, loadDraftLocal, clearDraftLocal } from "../lib/draft";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Tabs, TabsHeader, Tab } from "@material-tailwind/react";
import { putPhoto, getPhoto, delPhoto, type PhotoRef } from "../lib/draftPhotos";
import { useLanguage, type Lang } from "@/utils/useLanguage";

type TabId = "pre" | "post";

const TABS: { id: TabId; label: string; slug: "pre" | "post" }[] = [
    { id: "pre", label: "Pre\u2011PM", slug: "pre" },
    { id: "post", label: "Post\u2011PM", slug: "post" },
];

function slugToTab(slug: string | null): TabId {
    return slug === "post" ? "post" : "pre";
}

function tabToSlug(tab: TabId): "pre" | "post" {
    return TABS.find(t => t.id === tab)!.slug;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const LOGO_SRC = "/img/logo_egat.png";

// ==================== TRANSLATIONS ====================
const T = {
    // Page Header
    pageTitle: { th: "Preventive Maintenance Checklist - EV Charger", en: "Preventive Maintenance Checklist - EV Charger" },
    companyName: { th: "Electricity Generating Authority of Thailand (EGAT)", en: "Electricity Generating Authority of Thailand (EGAT)" },
    companyAddress: { th: "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand", en: "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand" },
    companyAddressShort: { th: "Bang Kruai, Nonthaburi 11130", en: "Bang Kruai, Nonthaburi 11130" },
    callCenter: { th: "Call Center Tel. 02-114-3350", en: "Call Center Tel. 02-114-3350" },

    // Form Labels
    docName: { th: "ชื่อเอกสาร", en: "Document Name" },
    issueId: { th: "Issue ID", en: "Issue ID" },
    location: { th: "สถานที่", en: "Location" },
    pmDate: { th: "วันที่ PM", en: "PM Date" },
    inspector: { th: "ผู้ตรวจสอบ", en: "Inspector" },
    brand: { th: "ยี่ห้อ", en: "Brand" },
    model: { th: "รุ่น", en: "Model" },
    power: { th: "กำลังไฟ", en: "Power" },
    serialNumber: { th: "Serial Number (SN)", en: "Serial Number (SN)" },
    chargerNo: { th: "Charger No.", en: "Charger No." },

    // Buttons
    save: { th: "บันทึก", en: "Save" },
    saving: { th: "กำลังบันทึก...", en: "Saving..." },
    attachPhoto: { th: "แนบรูป / ถ่ายรูป", en: "Attach / Take Photo" },
    na: { th: "N/A", en: "N/A" },
    cancelNA: { th: "ยกเลิก N/A", en: "Cancel N/A" },
    pass: { th: "PASS", en: "PASS" },
    fail: { th: "FAIL", en: "FAIL" },
    backToList: { th: "กลับไปหน้า List", en: "Back to List" },

    // Photo Section
    maxPhotos: { th: "สูงสุด", en: "Max" },
    photos: { th: "รูป", en: "photos" },
    cameraSupported: { th: "รองรับการถ่ายจากกล้องบนมือถือ", en: "Camera supported on mobile" },
    noPhotos: { th: "ยังไม่มีรูปแนบ", en: "No photos attached" },

    // Count labels for sub-items
    cableCount: { th: "จำนวนสายอัดประจุ:", en: "Charging cables:" },
    connectorCount: { th: "จำนวนหัวจ่ายอัดประจุ:", en: "Connectors:" },
    emergencyStopCount: { th: "จำนวนปุ่มหยุดฉุกเฉิน:", en: "Emergency stops:" },
    qrCodeCount: { th: "จำนวน QR CODE:", en: "QR CODEs:" },
    warningSignCount: { th: "จำนวนป้ายเตือน:", en: "Warning signs:" },
    cpVoltageCount: { th: "จำนวนสาย CP:", en: "CP cables:" },
    airFilterCount: { th: "จำนวนแผ่นกรอง:", en: "Air filters:" },
    chargingTestCount: { th: "จำนวนสายทดสอบ:", en: "Test cables:" },
    unit: { th: "ตัว", en: "units" },
    cable: { th: "เส้น", en: "cables" },
    piece: { th: "ชิ้น", en: "pieces" },

    // Remarks
    remark: { th: "หมายเหตุ *", en: "Remark *" },
    remarkLabel: { th: "หมายเหตุ", en: "Remark" },
    testResult: { th: "ผลการทดสอบ", en: "Test Result" },
    preRemarkLabel: { th: "หมายเหตุ (ก่อน PM)", en: "Remark (Pre-PM)" },
    comment: { th: "Comment", en: "Comment" },

    // Pre/Post Labels
    prePM: { th: "ก่อน PM", en: "Pre-PM" },
    postPM: { th: "หลัง PM", en: "Post-PM" },
    beforePM: { th: "ก่อน PM", en: "Before PM" },
    afterPM: { th: "หลัง PM", en: "After PM" },

    // Summary
    summaryResult: { th: "สรุปผลการตรวจสอบ", en: "Inspection Summary" },
    summaryPass: { th: "Pass", en: "Pass" },
    summaryFail: { th: "Fail", en: "Fail" },
    summaryNA: { th: "N/A", en: "N/A" },

    // Validation Sections
    validationPhotoTitle: { th: "1) ตรวจสอบการแนบรูปภาพ (ทุกข้อ)", en: "1) Photo Attachments (all items)" },
    validationInputTitle: { th: "2) อินพุตข้อ 10 และ 16", en: "2) Input Item 10 and 16" },
    validationRemarkTitle: { th: "3) หมายเหตุ (ทุกข้อ)", en: "3) Remarks (all items)" },
    validationPFTitle: { th: "3) สถานะ PASS / FAIL / N/A", en: "3) PASS / FAIL / N/A Status" },
    validationRemarkTitlePost: { th: "4) หมายเหตุ (ทุกข้อ)", en: "4) Remarks (all items)" },
    validationSummaryTitle: { th: "5) สรุปผลการตรวจสอบ", en: "5) Inspection Summary" },

    // Validation Messages
    allComplete: { th: "ครบเรียบร้อย ✅", en: "Complete ✅" },
    missingPhoto: { th: "ยังไม่ได้แนบรูปข้อ:", en: "Missing photos for:" },
    missingInput: { th: "ยังขาดข้อ:", en: "Missing:" },
    missingRemark: { th: "ยังไม่ได้กรอกหมายเหตุข้อ:", en: "Missing remarks for:" },
    missingPF: { th: "ยังไม่ได้เลือกข้อ:", en: "Not selected:" },
    missingSummaryText: { th: "ยังไม่ได้กรอก Comment", en: "Comment not filled" },
    missingSummaryStatus: { th: "ยังไม่ได้เลือกสถานะสรุปผล (Pass/Fail/N/A)", en: "Summary status not selected (Pass/Fail/N/A)" },
    itemLabel: { th: "ข้อ", en: "Item" },

    // Validation Card (DCMasterValidation style)
    formStatus: { th: "สถานะการกรอกข้อมูล", en: "Form Completion Status" },
    allCompleteReady: { th: "กรอกข้อมูลครบถ้วนแล้ว พร้อมบันทึก ✓", en: "All fields completed. Ready to save ✓" },
    remaining: { th: "ยังขาดอีก {n} รายการ", en: "{n} items remaining" },
    items: { th: "รายการ", en: "items" },

    // Alerts
    alertNoSN: { th: "ไม่พบ SN", en: "SN not found" },
    alertFillRequired: { th: "กรุณากรอกค่าให้ครบ (ข้อ 10 CP และ ข้อ 16)", en: "Please fill in all required fields (Item 10 CP and Item 16)" },
    alertFillRemark: { th: "กรุณากรอกหมายเหตุข้อ:", en: "Please fill in remarks for:" },
    alertFillPreFirst: { th: "กรุณากรอกข้อมูลในส่วน Pre-PM ให้ครบก่อน", en: "Please complete all Pre-PM fields first" },
    alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },
    alertCompleteAll: { th: "กรุณากรอกข้อมูลและแนบรูปให้ครบก่อนบันทึก", en: "Please complete all fields and attach photos before saving" },
    alertPhotoNotComplete: { th: "กรุณาแนบรูปในส่วน Pre-PM ให้ครบก่อน", en: "Please attach all photos in Pre-PM section" },
    alertInputNotComplete: { th: "กรุณากรอกค่าข้อ 10 (CP) และข้อ 16 ให้ครบ", en: "Please fill in Item 10 (CP) and Item 16" },

    // Dynamic Items
    addEmergencyStop: { th: "เพิ่ม", en: "Add" },
    addWarningSign: { th: "เพิ่ม", en: "Add" },
    replaceAirFilter: { th: "เปลี่ยนแผ่นกรองระบายอากาศ", en: "Replace air filter" },
    naNoValue: { th: "N/A (ไม่มีค่า)", en: "N/A (No value)" },
    removeNA: { th: "ลบ N/A", en: "Remove N/A" },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

// ==================== TYPES ====================
type StationPublic = {
    station_id: string;
    station_name: string;
    SN?: string;
    WO?: string;
    brand?: string;
    chargeBoxID?: string;
    model?: string;
    power?: string;
    status?: boolean;
    chargerNo?: string;
    chargingCables?: number;
};

type Me = {
    id: string;
    username: string;
    email: string;
    role: string;
    company: string;
    tel: string;
};

type PhotoItem = {
    id: string;
    file?: File;
    preview?: string;
    remark?: string;
    uploading?: boolean;
    error?: string;
    ref?: PhotoRef;
    isNA?: boolean;
};

type BilingualText = { th: string; en: string };

type Question = {
    no: number;
    key: string;
    label: BilingualText;
    kind: "simple" | "measure" | "group";
    hasPhoto?: boolean;
    tooltip?: BilingualText;
    items?: { key: string; label: BilingualText }[];
};

const UNITS = { voltage: ["V"] as const };
type UnitVoltage = (typeof UNITS.voltage)[number];
type MeasureRow<U extends string> = { value: string; unit: U };
type MeasureState<U extends string> = Record<string, MeasureRow<U>>;
type PF = "PASS" | "FAIL" | "NA" | "";

// ==================== CONSTANTS ====================
const VOLTAGE1_FIELDS = ["L1-L2", "L2-L3", "L3-L1", "L1-N", "L2-N", "L3-N", "L1-G", "L2-G", "L3-G", "N-G"] as const;

const LABELS: Record<string, string> = {
    "L1-L2": "L1-L2", "L2-L3": "L2-L3", "L3-L1": "L3-L1",
    "L1-N": "L1-N", "L2-N": "L2-N", "L3-N": "L3-N",
    "L1-G": "L1-G", "L2-G": "L2-G", "L3-G": "L3-G",
    "N-G": "N-G", CP: "CP",
};

const FIELD_GROUPS: Record<number, { keys: readonly string[]; unitType: "voltage"; note?: string } | undefined> = {
    16: { keys: VOLTAGE1_FIELDS, unitType: "voltage" },
};

// ==================== QUESTIONS (Bilingual) ====================
const QUESTIONS: Question[] = [
    { no: 1, key: "r1", label: { th: "1) ตรวจสอบสภาพทั่วไป", en: "1) General condition inspection" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบความสมบูรณ์ของตู้, การยึดแน่นของน็อตยึดฐาน, รอยแตกร้าวและร่องรอยการกระแทก", en: "Check cabinet integrity, base bolt tightness, cracks and impact marks" } },
    { no: 2, key: "r2", label: { th: "2) ตรวจสอบดักซีล,ซิลิโคนกันซึม", en: "2) Check sealant and silicone" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบความยืดหยุ่นของขอบยางกันน้ำ, รอยต่อของเคเบิลแกลนด์และและสภาพซิลิโคนตามแนวตะเข็บตู้", en: "Check waterproof rubber flexibility, cable gland joints and silicone condition" } },
    { no: 3, key: "r3", label: { th: "3) ตรวจสอบสายอัดประจุ", en: "3) Check charging cables" }, kind: "group", hasPhoto: true, items: [{ label: { th: "3.1) สายที่ 1", en: "3.1) Cable 1" }, key: "r3_1" }], tooltip: { th: "ตรวจสอบความสมบูรณ์ของฉนวนหุ้มสาย, คอสายว่าไม่มีการบิดงอหรือปริแตกและตรวจสอบรอยไหม้", en: "Check cable insulation, bends or cracks, and burn marks" } },
    { no: 4, key: "r4", label: { th: "4) ตรวจสอบหัวจ่ายอัดประจุ", en: "4) Check charging connector" }, kind: "group", hasPhoto: true, items: [{ label: { th: "4.1) หัวจ่ายอัดประจุที่ 1", en: "4.1) Connector 1" }, key: "r4_1" }], tooltip: { th: "ตรวจสอบความสะอาดของขั้วสัมผัส (Pin), ตรวจสอบสปริงล็อกและรอยร้าวบริเวณด้ามจับ", en: "Check pin cleanliness, spring lock and handle cracks" } },
    { no: 5, key: "r5", label: { th: "5) ตรวจสอบปุ่มหยุดฉุกเฉิน", en: "5) Check emergency stop button" }, kind: "group", hasPhoto: true, items: [{ label: { th: "5.1) ปุ่มหยุดฉุกเฉินที่ 1", en: "5.1) Emergency stop 1" }, key: "r5_1" }], tooltip: { th: "ตรวจสอบกลไกการกดและการคลายล็อกและตรวจสอบหน้าสัมผัสทางไฟฟ้าว่าไม่มีคราบสกปรก", en: "Check press/release mechanism and electrical contacts" } },
    { no: 6, key: "r6", label: { th: "6) ตรวจสอบ QR CODE", en: "6) Check QR CODE" }, kind: "group", hasPhoto: true, items: [{ label: { th: "6.1) QR CODE ที่ 1", en: "6.1) QR CODE 1" }, key: "r6_1" }], tooltip: { th: "ตรวจสอบความคมชัดของ QR CODE และการยึดติดของสติ๊กเกอร์", en: "Check QR CODE clarity and sticker adhesion" } },
    { no: 7, key: "r7", label: { th: "7) ป้ายเตือนระวังไฟฟ้าช็อก", en: "7) Electric shock warning sign" }, kind: "group", hasPhoto: true, items: [{ label: { th: "7.1) ป้ายเตือนระวังไฟฟ้าช็อกที่ 1", en: "7.1) Warning sign 1" }, key: "r7_1" }], tooltip: { th: "ตรวจสอบการติดตั้งและความชัดเจนของป้ายเตือนอันตราย", en: "Check installation and clarity of warning signs" } },
    { no: 8, key: "r8", label: { th: "8) ป้ายเตือนต้องการระบายอากาศ", en: "8) Ventilation warning sign" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบระยะ Clearance รอบตู้ตามป้ายระบุ เพื่อไม่ให้มีสิ่งของวางกีดขวางทางลม", en: "Check clearance around cabinet per signage" } },
    { no: 9, key: "r9", label: { th: "9) ป้ายเตือนปุ่มฉุกเฉิน", en: "9) Emergency button warning sign" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบความสว่างหรือการสะท้อนแสงของป้ายบ่งชี้ตำแหน่งปุ่ม Emergency เพื่อให้มองเห็นได้ในสภาวะแสงน้อย", en: "Check sign visibility in low light conditions" } },
    { no: 10, key: "r10", label: { th: "10) ตรวจสอบแรงดันไฟฟ้าที่พิน CP", en: "10) Check CP pin voltage" }, kind: "group", hasPhoto: true, items: [{ label: { th: "10.1) แรงดันไฟฟ้าที่พิน CP สายที่ 1", en: "10.1) CP pin voltage cable 1" }, key: "r10_1" }], tooltip: { th: "วัดค่าแรงดันระหว่าง pin CP และ PE", en: "Measure voltage between CP and PE pins" } },
    {
        no: 11, key: "r11", label: { th: "11) ตรวจสอบแผ่นกรองระบายอากาศ", en: "11) Check air filter" }, kind: "group", hasPhoto: true,
        tooltip: { th: "ตรวจสอบสภาพแผ่นกรองอากาศและทิศทางการไหลของอากาศ", en: "Check air filter condition and airflow direction" },
        items: [
            { label: { th: "11.1) แผ่นกรองระบายอากาศ (ด้านซ้าย)", en: "11.1) Air filter (left)" }, key: "r11_1" },
            { label: { th: "11.2) แผ่นกรองระบายอากาศ (ด้านขวา)", en: "11.2) Air filter (right)" }, key: "r11_2" },
            { label: { th: "11.3) แผ่นกรองระบายอากาศ (ด้านหน้า)", en: "11.3) Air filter (front)" }, key: "r11_3" },
            { label: { th: "11.4) แผ่นกรองระบายอากาศ (ด้านหลัง)", en: "11.4) Air filter (back)" }, key: "r11_4" },
        ]
    },
    { no: 12, key: "r12", label: { th: "12) ตรวจสอบจุดต่อทางไฟฟ้า", en: "12) Check electrical connections" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบการขันแน่นของน็อตบริเวณจุดต่อสายและและตรวจเช็ครอยไหม้ด้วยกล้องถ่ายภาพความร้อน", en: "Check bolt tightness at cable connection points and inspect for burn marks using thermal imaging camera" } },
    { no: 13, key: "r13", label: { th: "13) ตรวจสอบคอนแทคเตอร์", en: "13) Check contactor" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบสภาพหน้าสัมผัส, การทำงานของคอยล์และเสียงผิดปกติขณะทำงาน", en: "Check contact condition, coil operation and abnormal sounds" } },
    { no: 14, key: "r14", label: { th: "14) ตรวจสอบอุปกรณ์ป้องกันไฟกระชาก", en: "14) Check surge protection device" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบหน้าต่างแสดงสถานะและตรวจสอบสายกราวด์ที่ต่อเข้ากับ Surge Protective Devices", en: "Check status window and ground wire to SPD" } },
    { no: 15, key: "r15", label: { th: "15) ตรวจสอบลำดับเฟส", en: "15) Check phase sequence" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบทิศทางการเรียงเฟส", en: "Check phase sequence direction" } },
    { no: 16, key: "r16", label: { th: "16) วัดแรงดันไฟฟ้าด้านเข้า", en: "16) Measure input voltage" }, kind: "measure", hasPhoto: true, tooltip: { th: "วัดค่าแรงดันไฟฟ้าระหว่างเฟส และระหว่างเฟสกับนิวทรัล/กราวด์", en: "Measure phase-to-phase and phase-to-neutral/ground voltage" } },
    { no: 17, key: "r17", label: { th: "17) ทดสอบการอัดประจุ", en: "17) Charging test" }, kind: "group", hasPhoto: true, items: [{ label: { th: "17.1) ทดสอบการอัดประจุ สายที่ 1", en: "17.1) Charging test cable 1" }, key: "r17_1" }], tooltip: { th: "ตรวจสอบการทำงานร่วมกับ EV Simulator หรือรถจริง", en: "Test with EV Simulator or actual vehicle" } },
    { no: 18, key: "r18", label: { th: "18) ทำความสะอาด", en: "18) Cleaning" }, kind: "simple", hasPhoto: true, tooltip: { th: "ทำความสะอาดหน้าจอ, คราบสะสมบนหัวชาร์จและพื้นที่บริเวณฐานเครื่อง", en: "Clean screen, connector buildup and base area" } },
];

// ==================== DYNAMIC LABEL GENERATORS ====================
const getDynamicLabel = {
    chargingCable: (idx: number, lang: Lang) => lang === "th" ? `3.${idx}) สายอัดประจุที่ ${idx}` : `3.${idx}) Charging cable ${idx}`,
    connector: (idx: number, lang: Lang) => lang === "th" ? `4.${idx}) หัวจ่ายอัดประจุที่ ${idx}` : `4.${idx}) Connector ${idx}`,
    emergencyStop: (idx: number, lang: Lang) => lang === "th" ? `5.${idx}) ปุ่มหยุดฉุกเฉินที่ ${idx}` : `5.${idx}) Emergency stop ${idx}`,
    qrCode: (idx: number, lang: Lang) => lang === "th" ? `6.${idx}) QR CODE ที่ ${idx}` : `6.${idx}) QR CODE ${idx}`,
    warningSign: (idx: number, lang: Lang) => lang === "th" ? `7.${idx}) ป้ายเตือนระวังไฟฟ้าช็อกที่ ${idx}` : `7.${idx}) Warning sign ${idx}`,
    cpVoltage: (idx: number, lang: Lang) => lang === "th" ? `10.${idx}) แรงดันไฟฟ้าที่พิน CP สายที่ ${idx}` : `10.${idx}) CP pin voltage cable ${idx}`,
    airFilterLeft: (lang: Lang) => lang === "th" ? "11.1) แผ่นกรองระบายอากาศ (ด้านซ้าย)" : "11.1) Air filter (left)",
    airFilterRight: (lang: Lang) => lang === "th" ? "11.2) แผ่นกรองระบายอากาศ (ด้านขวา)" : "11.2) Air filter (right)",
    airFilterFront: (lang: Lang) => lang === "th" ? "11.3) แผ่นกรองระบายอากาศ (ด้านหน้า)" : "11.3) Air filter (front)",
    airFilterBack: (lang: Lang) => lang === "th" ? "11.4) แผ่นกรองระบายอากาศ (ด้านหลัง)" : "11.4) Air filter (back)",
    chargingTest: (idx: number, lang: Lang) => lang === "th" ? `17.${idx}) ทดสอบการอัดประจุ สายที่ ${idx}` : `17.${idx}) Charging test cable ${idx}`,
};

function getQuestionLabel(q: Question, mode: TabId, lang: Lang): string {
    const baseLabel = q.label[lang];
    if (mode === "pre") return lang === "th" ? `${baseLabel} (ก่อน PM)` : `${baseLabel} (Pre-PM)`;
    return lang === "th" ? `${baseLabel} (หลัง PM)` : `${baseLabel} (Post-PM)`;
}

function createFixedItems(qNo: number, count: number, lang: Lang): { key: string; label: string }[] {
    const generators: Record<number, (idx: number, lang: Lang) => string> = {
        3: getDynamicLabel.chargingCable,
        4: getDynamicLabel.connector,
        6: getDynamicLabel.qrCode,
        10: getDynamicLabel.cpVoltage,
        17: getDynamicLabel.chargingTest,
    };
    const gen = generators[qNo];
    if (!gen) return [];
    return Array.from({ length: count }, (_, i) => ({
        key: `r${qNo}_${i + 1}`,
        label: gen(i + 1, lang)
    }));
}

function getFixedItemsQ11(lang: Lang): { key: string; label: string }[] {
    return [
        { key: "r11_1", label: getDynamicLabel.airFilterLeft(lang) },
        { key: "r11_2", label: getDynamicLabel.airFilterRight(lang) },
        { key: "r11_3", label: getDynamicLabel.airFilterFront(lang) },
        { key: "r11_4", label: getDynamicLabel.airFilterBack(lang) },
    ];
}

// ==================== API FUNCTIONS ====================
async function getChargerInfoBySN(sn: string): Promise<StationPublic> {
    const url = `${API_BASE}/station/info/public?sn=${encodeURIComponent(sn)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) throw new Error("Charger not found");
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const json = await res.json();
    return json.station ?? json;
}

async function fetchPreviewIssueId(sn: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/pmreport/preview-issueid`);
    u.searchParams.set("sn", sn);
    u.searchParams.set("pm_date", pmDate);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
    const r = await fetch(u.toString(), { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && typeof j.issue_id === "string") ? j.issue_id : null;
}

async function fetchPreviewDocName(sn: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/pmreport/preview-docname`);
    u.searchParams.set("sn", sn);
    u.searchParams.set("pm_date", pmDate);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
    const r = await fetch(u.toString(), { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && typeof j.doc_name === "string") ? j.doc_name : null;
}

async function fetchReport(reportId: string, sn: string) {
    const token = localStorage.getItem("access_token") ?? "";
    const url = `${API_BASE}/pmreport/get?sn=${sn}&report_id=${reportId}`;
    const res = await fetch(url, { method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

// ==================== UTIL HOOKS ====================
function initMeasureState<U extends string>(keys: readonly string[], defaultUnit: U): MeasureState<U> {
    return keys.reduce((acc, k) => {
        acc[k] = { value: "", unit: defaultUnit };
        return acc;
    }, {} as MeasureState<U>);
}

function useMeasure<U extends string>(keys: readonly string[], defaultUnit: U) {
    const [state, setState] = useState<MeasureState<U>>(() => initMeasureState(keys, defaultUnit));
    const patch = (key: string, patch: Partial<MeasureRow<U>>) =>
        setState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    const syncUnits = (newUnit: U) =>
        setState((prev) => {
            const next: MeasureState<U> = { ...prev };
            keys.forEach((k) => (next[k] = { ...prev[k], unit: newUnit }));
            return next;
        });
    return { state, setState, patch, syncUnits };
}

function useDebouncedEffect(effect: () => void, deps: any[], delay = 800) {
    useEffect(() => {
        const h = setTimeout(effect, delay);
        return () => clearTimeout(h);
    }, deps);
}

// ==================== UI COMPONENTS ====================
function PassFailRow({
    label, value, onChange, remark, onRemarkChange, labels, aboveRemark, beforeRemark, belowRemark, inlineLeft, onlyNA = false, onClear, lang, remarkId,
}: {
    label: string;
    value: PF;
    onChange: (v: Exclude<PF, "">) => void;
    remark?: string;
    onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
    aboveRemark?: React.ReactNode;
    beforeRemark?: React.ReactNode;
    belowRemark?: React.ReactNode;
    inlineLeft?: React.ReactNode;
    onlyNA?: boolean;
    onClear?: () => void;
    lang: Lang;
    remarkId?: string;
}) {
    const text = { PASS: labels?.PASS ?? t("pass", lang), FAIL: labels?.FAIL ?? t("fail", lang), NA: labels?.NA ?? t("na", lang) };

    const buttonGroup = onlyNA ? (
        <div className="tw-flex tw-gap-2 tw-ml-auto">
            <Button size="sm" color="blue-gray" variant={value === "NA" ? "filled" : "outlined"} className="sm:tw-min-w-[84px]"
                onClick={() => value === "NA" && onClear ? onClear() : onChange("NA")}>
                {text.NA}
            </Button>
        </div>
    ) : (
        <div className="tw-flex tw-gap-2 tw-ml-auto">
            <Button size="sm" color="green" variant={value === "PASS" ? "filled" : "outlined"} className="sm:tw-min-w-[84px]" onClick={() => onChange("PASS")}>{text.PASS}</Button>
            <Button size="sm" color="red" variant={value === "FAIL" ? "filled" : "outlined"} className="sm:tw-min-w-[84px]" onClick={() => onChange("FAIL")}>{text.FAIL}</Button>
            <Button size="sm" color="blue-gray" variant={value === "NA" ? "filled" : "outlined"} className="sm:tw-min-w-[84px]" onClick={() => onChange("NA")}>{text.NA}</Button>
        </div>
    );

    const buttonsRow = (
        <div className="tw-flex tw-items-center tw-gap-3 tw-w-full">
            {inlineLeft && <div className="tw-flex tw-items-center tw-gap-2">{inlineLeft}</div>}
            {buttonGroup}
        </div>
    );

    return (
        <div className="tw-space-y-3 tw-py-3">
            <Typography className="tw-font-medium">{label}</Typography>
            {onRemarkChange ? (
                <div className="tw-w-full tw-min-w-0 tw-space-y-2">
                    {aboveRemark}
                    {buttonsRow}
                    {beforeRemark}
                    <div id={remarkId} className="tw-transition-all tw-duration-300">
                        <Textarea label={t("remark", lang)} value={remark || ""} onChange={(e) => onRemarkChange(e.target.value)}
                            containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full" />
                    </div>
                    {belowRemark}
                </div>
            ) : (
                <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">{buttonsRow}</div>
            )}
        </div>
    );
}

function SectionCard({ title, subtitle, children, tooltip, id }: {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
    tooltip?: string;
    id?: string;
}) {
    const qNumber = title?.match(/^(\d+)\)/)?.[1];
    
    return (
        <div id={id} className="tw-bg-white tw-rounded-xl tw-border tw-border-gray-200 tw-shadow-sm tw-overflow-hidden tw-transition-all tw-duration-300">
            {title && (
                <div className="tw-bg-gray-800 tw-px-3 sm:tw-px-4 tw-py-2.5 sm:tw-py-3">
                    <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-3">
                        {qNumber && (
                            <div className="tw-flex-shrink-0 tw-w-7 tw-h-7 sm:tw-w-8 sm:tw-h-8 tw-rounded-full tw-bg-white tw-text-gray-800 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-xs sm:tw-text-sm">
                                {qNumber}
                            </div>
                        )}
                        <Typography variant="h6" className="tw-text-white tw-text-sm sm:tw-text-base tw-font-semibold tw-flex-1">
                            {qNumber ? title.replace(/^\d+\)\s*/, '') : title}
                        </Typography>
                        {tooltip && (
                            <Tooltip content={tooltip} placement="bottom">
                                <svg className="tw-w-4 tw-h-4 sm:tw-w-5 sm:tw-h-5 tw-text-gray-400 tw-cursor-help tw-flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                            </Tooltip>
                        )}
                    </div>
                    {subtitle && (
                        <Typography variant="small" className="!tw-text-gray-300 tw-text-xs sm:tw-text-sm tw-mt-1 tw-ml-9 sm:tw-ml-11">{subtitle}</Typography>
                    )}
                </div>
            )}
            <div className="tw-p-3 sm:tw-p-4 tw-space-y-3 sm:tw-space-y-4">{children}</div>
        </div>
    );
}

function Section({ title, ok, children, lang }: {
    title: React.ReactNode;
    ok: boolean;
    children?: React.ReactNode;
    lang: Lang;
}) {
    return (
        <div className={`tw-rounded-lg tw-p-2.5 sm:tw-p-3 ${ok ? "tw-bg-gray-100" : "tw-bg-gray-100"}`}>
            <div className="tw-flex tw-items-center tw-gap-2">
                {ok ? (
                    <svg className="tw-w-4 tw-h-4 tw-text-gray-700 tw-flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg className="tw-w-4 tw-h-4 tw-text-gray-500 tw-flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                )}
                <Typography className="tw-font-medium tw-text-xs sm:tw-text-sm tw-text-gray-800">{title}</Typography>
            </div>
            {ok ? (
                <Typography variant="small" className="!tw-text-green-600 tw-text-xs sm:tw-text-sm tw-ml-6">{t("allComplete", lang)}</Typography>
            ) : (
                <div className="tw-ml-6 tw-mt-1">{children}</div>
            )}
        </div>
    );
}

// ===== PMValidationCard - DCMasterValidation Style =====
interface ValidationError {
    section: string;
    sectionIcon: string;
    itemName: string;
    message: string;
    scrollId?: string;
}

function groupErrorsBySection(errors: ValidationError[]): Map<string, ValidationError[]> {
    const grouped = new Map<string, ValidationError[]>();
    errors.forEach((error) => {
        const key = `${error.sectionIcon} ${error.section}`;
        const existing = grouped.get(key) || [];
        existing.push(error);
        grouped.set(key, existing);
    });
    return grouped;
}

interface MissingInputItem {
    qNo: number;
    subNo?: number;
    label: string;
    fieldKey: string;
}

interface PMValidationCardProps {
    lang: Lang;
    displayTab: TabId;
    isPostMode: boolean;
    // Photo validation
    allPhotosAttached: boolean;
    missingPhotoItems: string[];
    // Input validation
    allRequiredInputsFilled: boolean;
    missingInputsDetailed: MissingInputItem[];
    // Remark validation (Pre)
    allRemarksFilledPre: boolean;
    missingRemarksPre: string[];
    // PF validation (Post)
    allPFAnsweredPost: boolean;
    missingPFItemsPost: string[];
    // Remark validation (Post)
    allRemarksFilledPost: boolean;
    missingRemarksPost: string[];
    // Summary validation (Post)
    isSummaryFilled: boolean;
    isSummaryCheckFilled: boolean;
}

function PMValidationCard({
    lang,
    displayTab,
    isPostMode,
    allPhotosAttached,
    missingPhotoItems,
    allRequiredInputsFilled,
    missingInputsDetailed,
    allRemarksFilledPre,
    missingRemarksPre,
    allPFAnsweredPost,
    missingPFItemsPost,
    allRemarksFilledPost,
    missingRemarksPost,
    isSummaryFilled,
    isSummaryCheckFilled,
}: PMValidationCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Helper function to get scrollId based on type and item number
    // item format: "3" for simple questions, "3.1" for sub-items
    const getPhotoScrollId = (item: string): string => {
        const parts = item.split('.');
        if (parts.length === 2) {
            // Sub-item like "3.1" -> pm-photo-3-1
            return `pm-photo-${parts[0]}-${parts[1]}`;
        }
        // Simple item like "1" -> pm-photo-1
        return `pm-photo-${parts[0]}`;
    };

    const getRemarkScrollId = (item: string): string => {
        const parts = item.split('.');
        if (parts.length === 2) {
            // Sub-item like "3.1" -> pm-remark-3-1
            return `pm-remark-${parts[0]}-${parts[1]}`;
        }
        // Simple item like "1" -> pm-remark-1
        return `pm-remark-${parts[0]}`;
    };

    const getInputScrollId = (item: string): string => {
        const parts = item.split('.');
        if (parts.length === 2) {
            return `pm-input-${parts[0]}-${parts[1]}`;
        }
        return `pm-input-${parts[0]}`;
    };

    const getQuestionScrollId = (item: string): string => {
        const mainNo = item.split('.')[0];
        return `pm-question-${mainNo}`;
    };

    // Build validation errors
    const allErrors: ValidationError[] = useMemo(() => {
        const errors: ValidationError[] = [];

        // 1) Photo errors - link to specific photo section
        if (!allPhotosAttached) {
            missingPhotoItems.forEach((item) => {
                errors.push({
                    section: lang === "th" ? "รูปภาพ" : "Photos",
                    sectionIcon: "📷",
                    itemName: `${t("itemLabel", lang)} ${item}`,
                    message: t("missingPhoto", lang).replace(":", ""),
                    scrollId: getPhotoScrollId(item),
                });
            });
        }

        // 2) Input errors (Item 10 CP and Item 16) - link to specific input, one error per field
        if (!allRequiredInputsFilled) {
            missingInputsDetailed.forEach(({ qNo, subNo, label }) => {
                let scrollId: string;
                let itemDisplay: string;
                let message: string;
                
                if (qNo === 10 && subNo) {
                    // Item 10 CP sub-items: 10.1, 10.2, etc.
                    scrollId = `pm-input-10-${subNo}`;
                    itemDisplay = `10.${subNo}`;
                    message = lang === "th" ? `ยังไม่ได้กรอกค่า ${label}` : `${label} value not filled`;
                } else if (qNo === 16) {
                    // Item 16 voltage fields
                    scrollId = `pm-question-16`;
                    itemDisplay = `16`;
                    message = lang === "th" ? `ยังไม่ได้กรอกค่า ${label}` : `${label} value not filled`;
                } else {
                    scrollId = `pm-question-${qNo}`;
                    itemDisplay = subNo ? `${qNo}.${subNo}` : `${qNo}`;
                    message = lang === "th" ? `ยังไม่ได้กรอกค่า ${label}` : `${label} value not filled`;
                }
                
                errors.push({
                    section: lang === "th" ? "ค่าที่ต้องกรอก" : "Required Inputs",
                    sectionIcon: "📝",
                    itemName: `${t("itemLabel", lang)} ${itemDisplay}`,
                    message,
                    scrollId,
                });
            });
        }

        // 3) Remark errors (Pre mode) - link to specific remark textarea
        if (displayTab === "pre" && !allRemarksFilledPre) {
            missingRemarksPre.forEach((item) => {
                errors.push({
                    section: lang === "th" ? "หมายเหตุ" : "Remarks",
                    sectionIcon: "💬",
                    itemName: `${t("itemLabel", lang)} ${item}`,
                    message: lang === "th" ? "ยังไม่ได้กรอกหมายเหตุ" : "Remark not filled",
                    scrollId: getRemarkScrollId(item),
                });
            });
        }

        // Post mode validations
        if (isPostMode) {
            // 4) PF status errors - link to question section (buttons are at top)
            if (!allPFAnsweredPost) {
                missingPFItemsPost.forEach((item) => {
                    errors.push({
                        section: lang === "th" ? "สถานะ PASS/FAIL/N/A" : "PASS/FAIL/N/A Status",
                        sectionIcon: "✅",
                        itemName: `${t("itemLabel", lang)} ${item}`,
                        message: lang === "th" ? "ยังไม่ได้เลือกสถานะ" : "Status not selected",
                        scrollId: getQuestionScrollId(item),
                    });
                });
            }

            // 5) Remark errors (Post mode) - link to specific remark textarea
            if (!allRemarksFilledPost) {
                missingRemarksPost.forEach((item) => {
                    errors.push({
                        section: lang === "th" ? "หมายเหตุ" : "Remarks",
                        sectionIcon: "💬",
                        itemName: `${t("itemLabel", lang)} ${item}`,
                        message: lang === "th" ? "ยังไม่ได้กรอกหมายเหตุ" : "Remark not filled",
                        scrollId: getRemarkScrollId(item),
                    });
                });
            }

            // 6) Summary errors
            if (!isSummaryFilled) {
                errors.push({
                    section: lang === "th" ? "สรุปผลการตรวจสอบ" : "Inspection Summary",
                    sectionIcon: "📋",
                    itemName: "Comment",
                    message: t("missingSummaryText", lang),
                    scrollId: "pm-summary-section",
                });
            }
            if (!isSummaryCheckFilled) {
                errors.push({
                    section: lang === "th" ? "สรุปผลการตรวจสอบ" : "Inspection Summary",
                    sectionIcon: "📋",
                    itemName: lang === "th" ? "สถานะสรุปผล" : "Summary Status",
                    message: t("missingSummaryStatus", lang),
                    scrollId: "pm-summary-section",
                });
            }
        }

        return errors;
    }, [
        lang, displayTab, isPostMode,
        allPhotosAttached, missingPhotoItems,
        allRequiredInputsFilled, missingInputsDetailed,
        allRemarksFilledPre, missingRemarksPre,
        allPFAnsweredPost, missingPFItemsPost,
        allRemarksFilledPost, missingRemarksPost,
        isSummaryFilled, isSummaryCheckFilled
    ]);

    const groupedErrors = useMemo(() => groupErrorsBySection(allErrors), [allErrors]);
    const isComplete = allErrors.length === 0;

    // Scroll to item and highlight
    const scrollToItem = (scrollId?: string) => {
        if (!scrollId) return;
        const element = document.getElementById(scrollId);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.classList.add("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50");
            setTimeout(() => {
                element.classList.remove("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50");
            }, 2000);
        }
    };

    return (
        <div
            className={`tw-rounded-xl tw-border tw-shadow-sm tw-overflow-hidden ${
                isComplete ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"
            }`}
        >
            {/* Header */}
            <div
                className={`tw-px-4 tw-py-3 tw-cursor-pointer tw-flex tw-items-center tw-justify-between ${
                    isComplete ? "tw-bg-green-100" : "tw-bg-amber-100"
                }`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="tw-flex tw-items-center tw-gap-3">
                    {isComplete ? (
                        <div className="tw-w-10 tw-h-10 tw-rounded-full tw-bg-green-500 tw-flex tw-items-center tw-justify-center">
                            <svg className="tw-w-6 tw-h-6 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    ) : (
                        <div className="tw-w-10 tw-h-10 tw-rounded-full tw-bg-amber-500 tw-flex tw-items-center tw-justify-center">
                            <svg className="tw-w-6 tw-h-6 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>
                    )}
                    <div>
                        <Typography className={`tw-font-bold tw-text-base ${isComplete ? "tw-text-green-800" : "tw-text-amber-800"}`}>
                            {t("formStatus", lang)}
                        </Typography>
                        <Typography variant="small" className={isComplete ? "tw-text-green-600" : "tw-text-amber-600"}>
                            {isComplete ? t("allCompleteReady", lang) : t("remaining", lang).replace("{n}", String(allErrors.length))}
                        </Typography>
                    </div>
                </div>

                <div className="tw-flex tw-items-center tw-gap-4">
                    {/* Section badges */}
                    {!isComplete && (
                        <div className="tw-hidden md:tw-flex tw-items-center tw-gap-2">
                            {Array.from(groupedErrors.keys()).map((sectionKey) => (
                                <span
                                    key={sectionKey}
                                    className="tw-text-xs tw-bg-amber-200 tw-text-amber-800 tw-px-2 tw-py-1 tw-rounded-full tw-font-medium"
                                >
                                    {sectionKey.split(" ")[0]} {groupedErrors.get(sectionKey)?.length}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Expand/Collapse */}
                    {!isComplete && (
                        <svg
                            className={`tw-w-6 tw-h-6 tw-text-amber-600 tw-transition-transform ${isExpanded ? "tw-rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                </div>
            </div>

            {/* Error List */}
            {isExpanded && !isComplete && (
                <div className="tw-px-4 tw-py-3 tw-max-h-80 tw-overflow-y-auto">
                    <div className="tw-space-y-4">
                        {Array.from(groupedErrors.entries()).map(([sectionKey, sectionErrors]) => (
                            <div key={sectionKey} className="tw-bg-white tw-rounded-lg tw-p-3 tw-border tw-border-amber-200">
                                <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
                                    <Typography className="tw-font-semibold tw-text-gray-800 tw-text-sm">
                                        {sectionKey}
                                    </Typography>
                                    <span className="tw-text-xs tw-bg-amber-100 tw-text-amber-700 tw-px-2 tw-py-0.5 tw-rounded-full">
                                        {sectionErrors.length} {t("items", lang)}
                                    </span>
                                </div>
                                <ul className="tw-space-y-1 tw-max-h-40 tw-overflow-y-auto">
                                    {sectionErrors.map((error, idx) => (
                                        <li
                                            key={idx}
                                            className="tw-flex tw-items-start tw-gap-2 tw-text-sm tw-text-amber-700 tw-cursor-pointer hover:tw-text-amber-900 hover:tw-bg-amber-50 tw-rounded tw-px-1 tw-py-0.5 tw-transition-colors"
                                            onClick={() => scrollToItem(error.scrollId)}
                                        >
                                            <span className="tw-text-amber-500 tw-mt-0.5">→</span>
                                            <span>
                                                <span className="tw-font-medium">{error.itemName}:</span>{" "}
                                                <span className="tw-underline tw-underline-offset-2">{error.message}</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function InputWithUnit<U extends string>({ 
    label, value, unit, units, onValueChange, onUnitChange, readOnly, disabled, labelOnTop, required = true, isNA = false, onNAChange, lang 
}: {
    label: string; value: string; unit: U; units: readonly U[];
    onValueChange: (v: string) => void; onUnitChange: (u: U) => void;
    readOnly?: boolean; disabled?: boolean; labelOnTop?: boolean; required?: boolean; 
    isNA?: boolean; onNAChange?: (isNA: boolean) => void; lang: Lang;
}) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        // Allow: empty, negative sign, digits, decimal point
        // Pattern: optional minus, digits, optional decimal with digits
        if (newValue === "" || newValue === "-" || /^-?\d*\.?\d*$/.test(newValue)) {
            onValueChange(newValue);
        }
    };

    if (isNA) {
        return (
            <div className="tw-space-y-1">
                <div className="tw-flex tw-items-center tw-gap-2 tw-h-10 tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-amber-50">
                    <Typography variant="small" className="tw-text-amber-700 tw-font-medium">{t("naNoValue", lang)}</Typography>
                    {onNAChange && !readOnly && <Button size="sm" variant="text" onClick={() => onNAChange(false)} className="tw-ml-auto tw-text-xs">{t("removeNA", lang)}</Button>}
                </div>
            </div>
        );
    }

    return (
        <div className="tw-space-y-1">
            <div className="tw-flex tw-items-center tw-gap-2">
                <div className="tw-flex-1 tw-relative">
                    <input 
                        type="text" 
                        inputMode="text"
                        pattern="-?[0-9]*\.?[0-9]*"
                        value={value}
                        onChange={handleChange}
                        readOnly={readOnly} 
                        disabled={disabled} 
                        required={required}
                        placeholder=" "
                        className={`tw-peer tw-w-full tw-h-10 tw-px-3 tw-pt-4 tw-pb-1 tw-text-sm tw-border tw-border-gray-300 tw-rounded-lg tw-outline-none focus:tw-border-blue-500 focus:tw-ring-1 focus:tw-ring-blue-500 ${disabled ? "tw-bg-gray-100 tw-text-gray-500" : "tw-bg-white"}`}
                    />
                    <label className="tw-absolute tw-left-3 tw-top-1 tw-text-[10px] tw-text-gray-500 tw-pointer-events-none">
                        {label}{required && <span className="tw-text-red-500">*</span>}
                    </label>
                </div>
                <div className="tw-flex-shrink-0 tw-w-10 tw-h-10 tw-flex tw-items-center tw-justify-center tw-text-gray-600 tw-font-medium tw-text-sm tw-bg-gray-100 tw-rounded-lg tw-border tw-border-gray-200">
                    {unit}
                </div>
            </div>
            {onNAChange && !readOnly && !isNA && (
                <Button size="sm" variant="outlined" onClick={() => onNAChange(true)} className="tw-w-full tw-border-amber-500 tw-text-amber-700">{t("naNoValue", lang)}</Button>
            )}
        </div>
    );
}

function PhotoMultiInput({
    photos, setPhotos, max = 10, draftKey, qNo, lang, id,
}: {
    label?: string; photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
    max?: number; draftKey: string; qNo: number; lang: Lang; id?: string;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const handlePick = () => fileRef.current?.click();

    const handleFiles = async (list: FileList | null) => {
        if (!list) return;
        const remain = Math.max(0, max - photos.length);
        const files = Array.from(list).slice(0, remain);
        const items: PhotoItem[] = await Promise.all(
            files.map(async (f, i) => {
                const photoId = `${qNo}-${Date.now()}-${i}-${f.name}`;
                const ref = await putPhoto(draftKey, photoId, f);
                return { id: photoId, file: f, preview: URL.createObjectURL(f), remark: "", ref };
            })
        );
        setPhotos((prev) => [...prev, ...items]);
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleRemove = async (id: string) => {
        await delPhoto(draftKey, id);
        setPhotos((prev) => {
            const target = prev.find((p) => p.id === id);
            if (target?.preview) URL.revokeObjectURL(target.preview);
            return prev.filter((p) => p.id !== id);
        });
    };

    return (
        <div id={id} className="tw-space-y-3 tw-transition-all tw-duration-300">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2">
                <Button size="sm" color="blue" variant="outlined" onClick={handlePick} className="tw-shrink-0">{t("attachPhoto", lang)}</Button>
            </div>
            <Typography variant="small" className="!tw-text-blue-gray-500 tw-flex tw-items-center">
                {t("maxPhotos", lang)} {max} {t("photos", lang)} • {t("cameraSupported", lang)}
            </Typography>
            <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="tw-hidden"
                onChange={(e) => { void handleFiles(e.target.files); }} />
            {photos.length > 0 ? (
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                    {photos.map((p) => (
                        <div key={p.id} className="tw-border tw-rounded-lg tw-overflow-hidden tw-bg-white tw-shadow-xs tw-flex tw-flex-col">
                            <div className="tw-relative tw-aspect-[4/3] tw-bg-blue-gray-50">
                                {p.preview && <img src={p.preview} alt="preview" className="tw-w-full tw-h-full tw-object-cover" />}
                                <button onClick={() => { void handleRemove(p.id); }}
                                    className="tw-absolute tw-top-2 tw-right-2 tw-bg-red-500 tw-text-white tw-w-6 tw-h-6 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-shadow-md hover:tw-bg-red-600 tw-transition-colors">×</button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Typography variant="small" className="!tw-text-blue-gray-500">{t("noPhotos", lang)}</Typography>
            )}
        </div>
    );
}

function SkippedNAItem({ label, remark, lang }: { label: string; remark?: string; lang: Lang }) {
    return (
        <div className="tw-p-4 tw-rounded-lg tw-border tw-bg-amber-50 tw-border-amber-200">
            <div className="tw-flex tw-items-center tw-justify-between">
                <Typography className="tw-font-semibold tw-text-sm tw-text-blue-gray-800">{label}</Typography>
                {remark && (
                    <Typography variant="small" className="tw-text-blue-gray-600">
                        {t("remarkLabel", lang)} - {remark}
                    </Typography>
                )}
            </div>
        </div>
    );
}

function DynamicItemsSection({
    qNo, items, addItem, removeItem, addButtonLabel, renderAdditionalFields, editable = true,
    photos, setPhotos, rows, setRows, rowsPre, draftKey, lang, isPostMode = false,
    showDustFilterCheckbox = false, dustFilterChanged, setDustFilterChanged,
    countLabel, count, countUnit,
}: {
    qNo: number;
    items: { key: string; label: string }[];
    addItem?: () => void;
    removeItem?: (idx: number) => void;
    addButtonLabel?: string;
    renderAdditionalFields?: (item: { key: string; label: string }, idx: number, isNA: boolean) => React.ReactNode;
    editable?: boolean;
    photos: Record<number | string, PhotoItem[]>;
    setPhotos: React.Dispatch<React.SetStateAction<Record<number | string, PhotoItem[]>>>;
    rows: Record<string, { pf: PF; remark: string }>;
    setRows: React.Dispatch<React.SetStateAction<Record<string, { pf: PF; remark: string }>>>;
    rowsPre?: Record<string, { pf: PF; remark: string }>;
    draftKey: string;
    lang: Lang;
    isPostMode?: boolean;
    showDustFilterCheckbox?: boolean;
    dustFilterChanged?: Record<string, boolean>;
    setDustFilterChanged?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    countLabel?: string;
    count?: number;
    countUnit?: string;
}) {
    const makePhotoSetter = (photoKey: string): React.Dispatch<React.SetStateAction<PhotoItem[]>> => (action) => {
        setPhotos((prev) => {
            const current = prev[photoKey] || [];
            const next = typeof action === "function" ? action(current) : action;
            return { ...prev, [photoKey]: next };
        });
    };

    // POST MODE - use PassFailRow like MDBPMForm.tsx
    if (isPostMode) {
        return (
            <div className="tw-space-y-0">
                {/* Count summary row for POST mode */}
                {countLabel && count !== undefined && (
                    <div className="tw-flex tw-items-center tw-gap-2 tw-pb-3 tw-border-b tw-border-gray-200">
                        <Typography variant="small" className="tw-text-blue-gray-600">{countLabel}</Typography>
                        <Typography variant="small" className="tw-font-bold tw-text-blue-600">{count} {countUnit || t("unit", lang)}</Typography>
                    </div>
                )}
                <div className="tw-divide-y tw-divide-gray-200">
                    {items.map((item, idx) => {
                        const isSkipped = rowsPre?.[item.key]?.pf === "NA";
                        const preRemark = rowsPre?.[item.key]?.remark;
                        const subNo = idx + 1;
                        const photoId = `pm-photo-${qNo}-${subNo}`;
                        const remarkId = `pm-remark-${qNo}-${subNo}`;
                        
                        if (isSkipped) {
                            return (
                                <div key={item.key} className="tw-py-4 first:tw-pt-2 tw-bg-amber-50/50">
                                    <div className="tw-flex tw-items-center tw-justify-between">
                                        <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{item.label}</Typography>
                                        <span className="tw-text-xs tw-text-amber-600 tw-font-medium">N/A</span>
                                    </div>
                                    {preRemark && (
                                        <Typography variant="small" className="tw-text-gray-600 tw-mt-1">
                                            {t("remarkLabel", lang)}: {preRemark}
                                        </Typography>
                                    )}
                                </div>
                            );
                        }
                        
                        const checkboxElement = showDustFilterCheckbox && dustFilterChanged !== undefined && setDustFilterChanged ? (
                            <label className="tw-flex tw-items-center tw-gap-2 tw-text-xs sm:tw-text-sm tw-text-gray-700 tw-py-2">
                                <input type="checkbox" className="tw-h-4 tw-w-4 tw-rounded tw-border-gray-300 tw-text-gray-700 focus:tw-ring-gray-500"
                                    checked={dustFilterChanged[item.key] || false}
                                    onChange={(e) => setDustFilterChanged(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                                <span className="tw-leading-tight">{t("replaceAirFilter", lang)}</span>
                            </label>
                        ) : null;

                        const preRemarkElement = preRemark ? (
                            <div className="tw-mb-3 tw-p-3 tw-bg-gray-100 tw-rounded-lg">
                                <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                                    <svg className="tw-w-4 tw-h-4 tw-text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <Typography variant="small" className="tw-font-semibold tw-text-gray-600">{t("preRemarkLabel", lang)}</Typography>
                                </div>
                                <Typography variant="small" className="tw-text-gray-700 tw-ml-6">{preRemark}</Typography>
                            </div>
                        ) : null;

                        return (
                            <div key={item.key} className="tw-py-4 first:tw-pt-2">
                                <PassFailRow
                                    label={item.label}
                                    value={rows[item.key]?.pf ?? ""}
                                    onChange={(v) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { remark: "" }), pf: v } }))}
                                    remark={rows[item.key]?.remark ?? ""}
                                    onRemarkChange={(v) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { pf: "" }), remark: v } }))}
                                    lang={lang}
                                    remarkId={remarkId}
                                    aboveRemark={
                                        <>
                                            <div className="tw-pb-4 tw-border-b tw-border-gray-100">
                                                <PhotoMultiInput
                                                    id={photoId}
                                                    photos={photos[`${qNo}_${idx}`] || []}
                                                    setPhotos={makePhotoSetter(`${qNo}_${idx}`)}
                                                    max={10}
                                                    draftKey={draftKey}
                                                    qNo={qNo}
                                                    lang={lang}
                                                />
                                            </div>
                                            {checkboxElement && <div className="sm:tw-hidden tw-mb-3">{checkboxElement}</div>}
                                        </>
                                    }
                                    inlineLeft={checkboxElement && <div className="tw-hidden sm:tw-flex">{checkboxElement}</div>}
                                    beforeRemark={
                                        <>
                                            {renderAdditionalFields && (
                                                <div id={`pm-input-${qNo}-${subNo}`} className="tw-mb-3 tw-transition-all tw-duration-300">
                                                    {renderAdditionalFields(item, idx, rows[item.key]?.pf === "NA")}
                                                </div>
                                            )}
                                            {preRemarkElement}
                                        </>
                                    }
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // PRE MODE - original layout with count summary
    return (
        <div className="tw-space-y-0">
            {/* Count summary row with optional add button */}
            {countLabel && count !== undefined && (
                <div className="tw-flex tw-items-center tw-justify-between tw-pb-3 tw-border-b tw-border-gray-200">
                    <div className="tw-flex tw-items-center tw-gap-2">
                        <Typography variant="small" className="tw-text-blue-gray-600">{countLabel}</Typography>
                        <Typography variant="small" className="tw-font-bold tw-text-blue-600">{count} {countUnit || t("unit", lang)}</Typography>
                    </div>
                    {editable && addItem && addButtonLabel && items.length < 66 && (
                        <Button size="sm" color="gray" variant="outlined" onClick={addItem} className="tw-flex tw-items-center tw-gap-1">
                            <span className="tw-text-lg tw-leading-none">+</span>
                            <span className="tw-text-xs">{addButtonLabel}</span>
                        </Button>
                    )}
                </div>
            )}
            {/* Show add button without count if no countLabel */}
            {!countLabel && editable && addItem && addButtonLabel && (
                <div className="tw-flex tw-items-center tw-justify-end tw-py-3 tw-border-b tw-border-gray-200">
                    {items.length < 66 && (
                        <Button size="sm" color="gray" variant="outlined" onClick={addItem} className="tw-flex tw-items-center tw-gap-1">
                            <span className="tw-text-lg tw-leading-none">+</span>
                            <span className="tw-text-xs">{addButtonLabel}</span>
                        </Button>
                    )}
                </div>
            )}
            <div className="tw-divide-y tw-divide-gray-200">
                {items.map((item, idx) => {
                    const isNA = rows[item.key]?.pf === "NA";
                    const subNo = idx + 1;
                    const photoId = `pm-photo-${qNo}-${subNo}`;
                    const remarkId = `pm-remark-${qNo}-${subNo}`;
                    return (
                        <div key={item.key} className={`tw-py-4 first:tw-pt-2 ${isNA ? "tw-bg-amber-50/50" : ""}`}>
                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{item.label}</Typography>
                                <div className="tw-flex tw-items-center tw-gap-2">
                                    <Button size="sm" color={isNA ? "amber" : "gray"} variant={isNA ? "filled" : "outlined"}
                                        onClick={() => setRows(prev => ({ ...prev, [item.key]: { ...prev[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs">
                                        {isNA ? t("cancelNA", lang) : t("na", lang)}
                                    </Button>
                                    {editable && items.length > 1 && removeItem && (
                                        <button type="button" onClick={() => removeItem(idx)}
                                            className="tw-h-6 tw-w-6 tw-flex tw-items-center tw-justify-center tw-rounded tw-bg-red-50 tw-text-red-600 hover:tw-bg-red-100 hover:tw-text-red-700 tw-transition-all tw-duration-200"
                                            aria-label="Remove item">
                                            <svg className="tw-w-3.5 tw-h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                            {showDustFilterCheckbox && dustFilterChanged !== undefined && setDustFilterChanged && (
                                <div className="tw-flex tw-items-center tw-gap-2 tw-p-3 tw-mb-3 tw-bg-gray-100 tw-rounded-lg">
                                    <input type="checkbox" id={`dustFilter_${item.key}`} className="tw-h-4 tw-w-4 tw-rounded tw-border-gray-300 tw-text-gray-700 focus:tw-ring-gray-500"
                                        checked={dustFilterChanged[item.key] || false}
                                        onChange={(e) => setDustFilterChanged(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                                    <label htmlFor={`dustFilter_${item.key}`} className="tw-text-sm tw-text-gray-700 tw-font-medium">{t("replaceAirFilter", lang)}</label>
                                </div>
                            )}
                            <div className="tw-mb-3">
                                <PhotoMultiInput id={photoId} photos={photos[`${qNo}_${idx}`] || []}
                                    setPhotos={(action) => {
                                        setPhotos((prev) => {
                                            const photoKey = `${qNo}_${idx}`;
                                            const current = prev[photoKey] || [];
                                            const next = typeof action === "function" ? action(current) : action;
                                            return { ...prev, [photoKey]: next };
                                        });
                                    }}
                                    max={10} draftKey={draftKey} qNo={qNo} lang={lang} />
                            </div>
                            {renderAdditionalFields && (
                                <div id={`pm-input-${qNo}-${subNo}`} className={`tw-mb-3 tw-transition-all tw-duration-300 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>
                                    {renderAdditionalFields(item, idx, isNA)}
                                </div>
                            )}
                            <div id={remarkId} className="tw-transition-all tw-duration-300">
                                <Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""}
                                    onChange={(e) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { pf: "" }), remark: e.target.value } }))}
                                    rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PhotoRemarkSection({
    qKey, qNo, label, middleContent, photos, setPhotos, rows, setRows, rowsPre, draftKey, lang, isPostMode = false
}: {
    qKey: string; qNo: number; label?: string; middleContent?: React.ReactNode;
    photos: Record<number | string, PhotoItem[]>;
    setPhotos: React.Dispatch<React.SetStateAction<Record<number | string, PhotoItem[]>>>;
    rows: Record<string, { pf: PF; remark: string }>;
    setRows: React.Dispatch<React.SetStateAction<Record<string, { pf: PF; remark: string }>>>;
    rowsPre?: Record<string, { pf: PF; remark: string }>;
    draftKey: string; lang: Lang; isPostMode?: boolean;
}) {
    const isNA = rows[qKey]?.pf === "NA";
    const preRemark = rowsPre?.[qKey]?.remark;
    const makePhotoSetter = (no: number): React.Dispatch<React.SetStateAction<PhotoItem[]>> => (action) => {
        setPhotos((prev) => {
            const current = prev[no] || [];
            const next = typeof action === "function" ? (action as (x: PhotoItem[]) => PhotoItem[])(current) : action;
            return { ...prev, [no]: next };
        });
    };

    const photoId = `pm-photo-${qNo}`;
    const remarkId = `pm-remark-${qNo}`;

    const preRemarkElement = isPostMode && preRemark ? (
        <div className="tw-mb-3 tw-p-3 tw-bg-gray-100 tw-rounded-lg">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                <svg className="tw-w-4 tw-h-4 tw-text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <Typography variant="small" className="tw-font-semibold tw-text-gray-600">{t("preRemarkLabel", lang)}</Typography>
            </div>
            <Typography variant="small" className="tw-text-gray-700 tw-ml-6">{preRemark}</Typography>
        </div>
    ) : null;

    if (isPostMode) {
        return (
            <div className="tw-py-2">
                <PassFailRow
                    label={t("testResult", lang)}
                    value={rows[qKey]?.pf ?? ""}
                    onChange={(v) => setRows(prev => ({ ...prev, [qKey]: { ...(prev[qKey] ?? { remark: "" }), pf: v } }))}
                    remark={rows[qKey]?.remark ?? ""}
                    onRemarkChange={(v) => setRows(prev => ({ ...prev, [qKey]: { ...(prev[qKey] ?? { pf: "" }), remark: v } }))}
                    lang={lang}
                    aboveRemark={
                        <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-4 tw-border-gray-100">
                            <PhotoMultiInput id={photoId} photos={photos[qNo] || []} setPhotos={makePhotoSetter(qNo)} max={10} draftKey={draftKey} qNo={qNo} lang={lang} />
                        </div>
                    }
                    beforeRemark={
                        <>
                            {middleContent && <div className="tw-mb-3">{middleContent}</div>}
                            {preRemarkElement}
                        </>
                    }
                    remarkId={remarkId}
                />
            </div>
        );
    }

    return (
        <div className={`tw-py-2 ${isNA ? "tw-bg-amber-50/50" : ""}`}>
            {label && <div className="tw-flex tw-items-center tw-justify-between tw-mb-3"><Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{label}</Typography></div>}
            <div className="tw-flex tw-justify-end tw-mb-3">
                <Button size="sm" color={isNA ? "amber" : "gray"} variant={isNA ? "filled" : "outlined"}
                    onClick={() => setRows(prev => ({ ...prev, [qKey]: { ...prev[qKey], pf: isNA ? "" : "NA" } }))}>
                    {isNA ? t("cancelNA", lang) : t("na", lang)}
                </Button>
            </div>
            <div className="tw-mb-3">
                <PhotoMultiInput id={photoId} photos={photos[qNo] || []} setPhotos={makePhotoSetter(qNo)} max={10} draftKey={draftKey} qNo={qNo} lang={lang} />
            </div>
            {middleContent && <div className={`tw-mb-3 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>{middleContent}</div>}
            <div id={remarkId} className="tw-transition-all tw-duration-300">
                <Textarea label={t("remark", lang)} value={rows[qKey]?.remark ?? ""}
                    onChange={(e) => setRows(prev => ({ ...prev, [qKey]: { ...(prev[qKey] ?? { pf: "" }), remark: e.target.value } }))}
                    rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
            </div>
        </div>
    );
}

// ==================== MAIN COMPONENT ====================
export default function ChargerPMForm() {
    const { lang } = useLanguage();
    const [me, setMe] = useState<Me | null>(null);
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [docName, setDocName] = useState<string>("");

    const pathname = usePathname();
    const searchParams = useSearchParams();
    const editId = searchParams.get("edit_id") ?? "";
    const action = searchParams.get("action");
    const isPostMode = action === "post";

    const [photos, setPhotos] = useState<Record<string | number, PhotoItem[]>>({});
    const [cpPre, setCpPre] = useState<Record<string, { value: string; unit: UnitVoltage }>>({});
    const [cp, setCp] = useState<Record<string, { value: string; unit: UnitVoltage }>>({});
    const [cpIsNA, setCpIsNA] = useState<boolean>(false);
    const [summary, setSummary] = useState<string>("");
    const [sn, setSn] = useState<string | null>(null);
    const [draftId, setDraftId] = useState<string | null>(null);
    const [summaryCheck, setSummaryCheck] = useState<PF>("");
    
    const key = useMemo(() => draftKey(sn), [sn]);
    const postKey = useMemo(() => `${draftKey(sn)}:${editId}:post`, [sn, editId]);
    const currentDraftKey = isPostMode ? postKey : key;
    
    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.has("draft_id")) {
            params.delete("draft_id");
            const url = `${window.location.pathname}?${params.toString()}`;
            window.history.replaceState({}, "", url);
        }
    }, []);
    
    const [inspector, setInspector] = useState<string>("");
    const [dustFilterChanged, setDustFilterChanged] = useState<Record<string, boolean>>({});
    const [postApiLoaded, setPostApiLoaded] = useState(false);

    const [job, setJob] = useState({
        issue_id: "", chargerNo: "", sn: "", model: "", power: "", brand: "", station_name: "", date: "", chargingCables: 1,
    });

    const [rowsPre, setRowsPre] = useState<Record<string, { pf: PF; remark: string }>>({});
    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(() => {
        const initial: Record<string, { pf: PF; remark: string }> = {};
        QUESTIONS.forEach((q) => { initial[q.key] = { pf: "", remark: "" }; });
        getFixedItemsQ11("th").forEach((item) => { initial[item.key] = { pf: "", remark: "" }; });
        return initial;
    });

    const [m16Pre, setM16Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE1_FIELDS, "V"));
    const m16 = useMeasure<UnitVoltage>(VOLTAGE1_FIELDS, "V");

    const [q5Items, setQ5Items] = useState<{ key: string; label: string }[]>([{ key: "r5_1", label: getDynamicLabel.emergencyStop(1, lang) }]);
    const [q7Items, setQ7Items] = useState<{ key: string; label: string }[]>([{ key: "r7_1", label: getDynamicLabel.warningSign(1, lang) }]);

    useEffect(() => {
        setQ5Items(prev => prev.map((item, idx) => ({ ...item, label: getDynamicLabel.emergencyStop(idx + 1, lang) })));
        setQ7Items(prev => prev.map((item, idx) => ({ ...item, label: getDynamicLabel.warningSign(idx + 1, lang) })));
    }, [lang]);

    const addQ5Item = () => {
        if (q5Items.length < 66) {
            const newIndex = q5Items.length + 1;
            setQ5Items([...q5Items, { key: `r5_${newIndex}`, label: getDynamicLabel.emergencyStop(newIndex, lang) }]);
            setRows(prev => ({ ...prev, [`r5_${newIndex}`]: { pf: "", remark: "" } }));
        }
    };
    const removeQ5Item = (index: number) => {
        if (q5Items.length > 1) {
            const keyToDelete = q5Items[index].key;
            const newItems = q5Items.filter((_, i) => i !== index).map((_, idx) => ({ key: `r5_${idx + 1}`, label: getDynamicLabel.emergencyStop(idx + 1, lang) }));
            setQ5Items(newItems);
            setRows(prev => { const next = { ...prev }; delete next[keyToDelete]; return next; });
        }
    };
    const initQ5Items = (count: number) => {
        setQ5Items(Array.from({ length: count }, (_, idx) => ({ key: `r5_${idx + 1}`, label: getDynamicLabel.emergencyStop(idx + 1, lang) })));
    };

    const addQ7Item = () => {
        if (q7Items.length < 66) {
            const newIndex = q7Items.length + 1;
            setQ7Items([...q7Items, { key: `r7_${newIndex}`, label: getDynamicLabel.warningSign(newIndex, lang) }]);
            setRows(prev => ({ ...prev, [`r7_${newIndex}`]: { pf: "", remark: "" } }));
        }
    };
    const removeQ7Item = (index: number) => {
        if (q7Items.length > 1) {
            const keyToDelete = q7Items[index].key;
            const newItems = q7Items.filter((_, i) => i !== index).map((_, idx) => ({ key: `r7_${idx + 1}`, label: getDynamicLabel.warningSign(idx + 1, lang) }));
            setQ7Items(newItems);
            setRows(prev => { const next = { ...prev }; delete next[keyToDelete]; return next; });
        }
    };
    const initQ7Items = (count: number) => {
        setQ7Items(Array.from({ length: count }, (_, idx) => ({ key: `r7_${idx + 1}`, label: getDynamicLabel.warningSign(idx + 1, lang) })));
    };

    const fixedItemsMap = useMemo(() => ({
        3: createFixedItems(3, job.chargingCables, lang),
        4: createFixedItems(4, job.chargingCables, lang),
        6: createFixedItems(6, job.chargingCables, lang),
        10: createFixedItems(10, job.chargingCables, lang),
        11: getFixedItemsQ11(lang),
        17: createFixedItems(17, job.chargingCables, lang),
    }), [job.chargingCables, lang]);

    useEffect(() => {
        setRows((prev) => {
            const next = { ...prev };
            let changed = false;
            [3, 4, 6, 10, 17].forEach((qNo) => {
                const items = fixedItemsMap[qNo as keyof typeof fixedItemsMap];
                if (items) {
                    items.forEach((item) => {
                        if (!next[item.key]) { next[item.key] = { pf: "", remark: "" }; changed = true; }
                    });
                }
            });
            getFixedItemsQ11(lang).forEach((item) => {
                if (!next[item.key]) { next[item.key] = { pf: "", remark: "" }; changed = true; }
            });
            return changed ? next : prev;
        });
    }, [fixedItemsMap, lang]);

    // Effects for loading data - abbreviated for file length
    useEffect(() => {
        if (!isPostMode || !editId || !sn) return;
        setPostApiLoaded(false);
        (async () => {
            try {
                const data = await fetchReport(editId, sn);
                if (data.job) setJob(prev => ({ ...prev, ...data.job, issue_id: data.issue_id ?? prev.issue_id, chargingCables: data.job.chargingCables || prev.chargingCables || 1 }));
                if (data.pm_date) setJob(prev => ({ ...prev, date: data.pm_date }));
                if (data?.measures_pre?.cp) {
                    const cpData: Record<string, { value: string; unit: UnitVoltage }> = {};
                    Object.entries(data.measures_pre.cp).forEach(([k, v]: [string, any]) => { cpData[k] = { value: v?.value ?? "", unit: (v?.unit as UnitVoltage) ?? "V" }; });
                    setCpPre(cpData);
                }
                if (data?.measures_pre?.m16) {
                    setM16Pre((prev) => { const next = { ...prev }; VOLTAGE1_FIELDS.forEach((k) => { const row = data.measures_pre.m16[k] ?? {}; next[k] = { value: row.value ?? "", unit: (row.unit as UnitVoltage) ?? "V" }; }); return next; });
                }
                if (data.doc_name) setDocName(data.doc_name);
                if (data.inspector) setInspector(data.inspector);
                if (data.rows_pre) {
                    setRowsPre(data.rows_pre);
                    const q5Count = Object.keys(data.rows_pre).filter(k => /^r5_\d+$/.test(k)).length;
                    const q7Count = Object.keys(data.rows_pre).filter(k => /^r7_\d+$/.test(k)).length;
                    if (q5Count > 0) initQ5Items(q5Count);
                    if (q7Count > 0) initQ7Items(q7Count);
                }
                if (data.rows) { setRows((prev) => { const next = { ...prev }; Object.entries(data.rows).forEach(([k, v]) => { next[k] = v as { pf: PF; remark: string }; }); return next; }); }
                else if (data.rows_pre) { setRows((prev) => { const next = { ...prev }; Object.entries(data.rows_pre).forEach(([k, v]) => { const preRow = v as { pf: PF; remark: string }; next[k] = { pf: preRow.pf, remark: "" }; }); return next; }); }
                setPostApiLoaded(true);
            } catch (err) { console.error("load report failed:", err); setPostApiLoaded(true); }
        })();
    }, [isPostMode, editId, sn]);

    useEffect(() => {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
        if (!token) return;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/me`, { method: "GET", headers: { Authorization: `Bearer ${token}` }, credentials: "include" });
                if (!res.ok) return;
                const data: Me = await res.json();
                setMe(data);
                setInspector((prev) => prev || data.username || "");
            } catch (err) { console.error("fetch /me error:", err); }
        })();
    }, []);

    useEffect(() => {
        if (isPostMode || !sn || !job.date) return;
        let canceled = false;
        (async () => {
            try {
                const preview = await fetchPreviewIssueId(sn, job.date);
                if (!canceled && preview) setJob(prev => ({ ...prev, issue_id: preview }));
            } catch (err) { console.error("preview issue_id error:", err); }
        })();
        return () => { canceled = true; };
    }, [sn, job.date, isPostMode]);

    useEffect(() => {
        if (isPostMode || !sn || !job.date) return;
        let canceled = false;
        (async () => {
            try {
                const preview = await fetchPreviewDocName(sn, job.date);
                if (!canceled && preview) setDocName(preview);
            } catch (err) { console.error("preview docName error:", err); }
        })();
        return () => { canceled = true; };
    }, [sn, job.date, isPostMode]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const snParam = params.get("sn") || localStorage.getItem("selected_sn");
        if (snParam) setSn(snParam);
        if (!snParam || isPostMode) return;
        getChargerInfoBySN(snParam)
            .then((st) => {
                setJob((prev) => ({
                    ...prev, chargerNo: st.chargerNo ?? prev.chargerNo, sn: st.SN ?? prev.sn,
                    model: st.model ?? prev.model, brand: st.brand ?? prev.brand,
                    power: st.power ?? prev.model, station_name: st.station_name ?? prev.station_name,
                    date: prev.date || new Date().toISOString().slice(0, 10),
                    chargingCables: st.chargingCables || prev.chargingCables || 1,
                }));
            })
            .catch((err) => console.error("load charger info failed:", err));
    }, [isPostMode]);

    // Validations
    const validPhotoKeysPre = useMemo(() => {
        const keys: { key: string | number; label: string }[] = [];
        QUESTIONS.filter(q => q.hasPhoto && q.no !== 18).forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") { keys.push({ key: q.no, label: `${q.no}` }); }
            else if (q.no === 5) { q5Items.forEach((item, idx) => keys.push({ key: `${q.no}_${idx}`, label: `${q.no}.${idx + 1}` })); }
            else if (q.no === 7) { q7Items.forEach((item, idx) => keys.push({ key: `${q.no}_${idx}`, label: `${q.no}.${idx + 1}` })); }
            else if ([3, 4, 6, 10, 11, 17].includes(q.no)) {
                const fixedItems = fixedItemsMap[q.no as keyof typeof fixedItemsMap];
                if (fixedItems) { fixedItems.forEach((item, idx) => keys.push({ key: `${q.no}_${idx}`, label: `${q.no}.${idx + 1}` })); }
            }
        });
        return keys;
    }, [q5Items, q7Items, fixedItemsMap]);

    const validPhotoKeysPost = useMemo(() => {
        const keys: { key: string | number; label: string }[] = [];
        QUESTIONS.filter(q => q.hasPhoto).forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") {
                if (rowsPre[q.key]?.pf === "NA") return;
                keys.push({ key: q.no, label: `${q.no}` });
            } else if (q.no === 5) {
                q5Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: `${q.no}_${idx}`, label: `${q.no}.${idx + 1}` }); });
            } else if (q.no === 7) {
                q7Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: `${q.no}_${idx}`, label: `${q.no}.${idx + 1}` }); });
            } else if ([3, 4, 6, 10, 11, 17].includes(q.no)) {
                const fixedItems = fixedItemsMap[q.no as keyof typeof fixedItemsMap];
                if (fixedItems) { fixedItems.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: `${q.no}_${idx}`, label: `${q.no}.${idx + 1}` }); }); }
            }
        });
        return keys;
    }, [q5Items, q7Items, fixedItemsMap, rowsPre]);

    const missingPhotoItemsPre = useMemo(() => validPhotoKeysPre.filter(({ key }) => (photos[key]?.length ?? 0) < 1).map(({ label }) => label).sort((a, b) => { const [aMain, aSub] = a.split('.').map(Number); const [bMain, bSub] = b.split('.').map(Number); if (aMain !== bMain) return aMain - bMain; return (aSub || 0) - (bSub || 0); }), [photos, validPhotoKeysPre]);
    const missingPhotoItemsPost = useMemo(() => validPhotoKeysPost.filter(({ key }) => (photos[key]?.length ?? 0) < 1).map(({ label }) => label).sort((a, b) => { const [aMain, aSub] = a.split('.').map(Number); const [bMain, bSub] = b.split('.').map(Number); if (aMain !== bMain) return aMain - bMain; return (aSub || 0) - (bSub || 0); }), [photos, validPhotoKeysPost]);

    const allPhotosAttachedPre = missingPhotoItemsPre.length === 0;
    const allPhotosAttachedPost = missingPhotoItemsPost.length === 0;
    const missingPhotoItems = isPostMode ? missingPhotoItemsPost : missingPhotoItemsPre;
    const allPhotosAttached = isPostMode ? allPhotosAttachedPost : allPhotosAttachedPre;

    const MEASURE_BY_NO: Record<number, ReturnType<typeof useMeasure<UnitVoltage>> | undefined> = { 16: m16 };

    // missingInputs now stores detailed info for each missing item
    const missingInputsDetailed = useMemo(() => {
        const result: { qNo: number; subNo?: number; label: string; fieldKey: string }[] = [];
        
        // Item 10 - CP values
        (fixedItemsMap[10] || []).forEach((item, idx) => {
            if (rowsPre[item.key]?.pf === "NA") return;
            if (rows[item.key]?.pf === "NA") return;
            if (!cpIsNA && !cp[item.key]?.value?.trim()) {
                result.push({
                    qNo: 10,
                    subNo: idx + 1,
                    label: `CP`,
                    fieldKey: item.key,
                });
            }
        });
        
        // Item 16 - Voltage measurements
        if (rowsPre["r16"]?.pf !== "NA" && rows["r16"]?.pf !== "NA") {
            VOLTAGE1_FIELDS.forEach((k) => {
                if (!m16.state[k]?.value?.toString().trim()) {
                    result.push({
                        qNo: 16,
                        label: LABELS[k] ?? k,
                        fieldKey: k,
                    });
                }
            });
        }
        
        return result;
    }, [cpIsNA, cp, fixedItemsMap, m16.state, rows, rowsPre]);

    const allRequiredInputsFilled = useMemo(() => missingInputsDetailed.length === 0, [missingInputsDetailed]);
    
    // Keep missingInputsTextLines for backward compatibility (used in button title)
    const missingInputsTextLines = useMemo(() => {
        const grouped: Record<number, string[]> = {};
        missingInputsDetailed.forEach(({ qNo, subNo, label }) => {
            if (!grouped[qNo]) grouped[qNo] = [];
            const displayLabel = subNo ? `${label} ${subNo}` : label;
            grouped[qNo].push(displayLabel);
        });
        return Object.entries(grouped).map(([no, arr]) => `${no}: ${arr.join(", ")}`);
    }, [missingInputsDetailed]);

    const validRemarkKeys = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") { keys.push(q.key); }
            if (q.no === 5) { q5Items.forEach((item) => keys.push(item.key)); }
            else if (q.no === 7) { q7Items.forEach((item) => keys.push(item.key)); }
            else if ([3, 4, 6, 10, 11, 17].includes(q.no)) {
                const fixedItems = fixedItemsMap[q.no as keyof typeof fixedItemsMap];
                if (fixedItems) { fixedItems.forEach((item) => keys.push(item.key)); }
            }
        });
        return keys;
    }, [q5Items, q7Items, fixedItemsMap]);

    const missingRemarks = useMemo(() => {
        const missing: string[] = [];
        validRemarkKeys.forEach((key) => {
            const val = rows[key];
            if (!val?.remark?.trim()) {
                const match = key.match(/^r(\d+)(?:_(\d+))?$/);
                if (match) { const qNo = parseInt(match[1], 10); const subNo = match[2]; missing.push(subNo ? `${qNo}.${subNo}` : `${qNo}`); }
            }
        });
        return missing.sort((a, b) => { const [aMain, aSub] = a.split('.').map(Number); const [bMain, bSub] = b.split('.').map(Number); if (aMain !== bMain) return aMain - bMain; return (aSub || 0) - (bSub || 0); });
    }, [rows, validRemarkKeys]);

    const missingRemarksPre = useMemo(() => missingRemarks.filter(item => { const mainNo = parseInt(item.split('.')[0], 10); return mainNo !== 18; }), [missingRemarks]);
    const allRemarksFilledPre = missingRemarksPre.length === 0;

    const validRemarkKeysPost = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") { if (rowsPre[q.key]?.pf === "NA") return; keys.push(q.key); }
            if (q.no === 5) { q5Items.forEach((item) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push(item.key); }); }
            else if (q.no === 7) { q7Items.forEach((item) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push(item.key); }); }
            else if ([3, 4, 6, 10, 11, 17].includes(q.no)) {
                const fixedItems = fixedItemsMap[q.no as keyof typeof fixedItemsMap];
                if (fixedItems) { fixedItems.forEach((item) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push(item.key); }); }
            }
        });
        return keys;
    }, [q5Items, q7Items, fixedItemsMap, rowsPre]);

    const missingRemarksPost = useMemo(() => {
        const missing: string[] = [];
        validRemarkKeysPost.forEach((key) => {
            const val = rows[key];
            if (!val?.remark?.trim()) {
                const match = key.match(/^r(\d+)(?:_(\d+))?$/);
                if (match) { const qNo = parseInt(match[1], 10); const subNo = match[2]; missing.push(subNo ? `${qNo}.${subNo}` : qNo.toString()); }
            }
        });
        return missing.sort((a, b) => { const [aMain, aSub] = a.split('.').map(Number); const [bMain, bSub] = b.split('.').map(Number); if (aMain !== bMain) return aMain - bMain; return (aSub || 0) - (bSub || 0); });
    }, [rows, validRemarkKeysPost]);
    const allRemarksFilledPost = missingRemarksPost.length === 0;

    const PF_KEYS_POST = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") { if (rowsPre[q.key]?.pf !== "NA") { keys.push(q.key); } return; }
            if (q.no === 5) { q5Items.forEach((item) => { if (rowsPre[item.key]?.pf !== "NA") { keys.push(item.key); } }); }
            else if (q.no === 7) { q7Items.forEach((item) => { if (rowsPre[item.key]?.pf !== "NA") { keys.push(item.key); } }); }
            else if ([3, 4, 6, 10, 11, 17].includes(q.no)) {
                const fixedItems = fixedItemsMap[q.no as keyof typeof fixedItemsMap];
                if (fixedItems) { fixedItems.forEach((item) => { if (rowsPre[item.key]?.pf !== "NA") { keys.push(item.key); } }); }
            }
        });
        return keys;
    }, [q5Items, q7Items, fixedItemsMap, rowsPre]);

    const allPFAnsweredPost = useMemo(() => PF_KEYS_POST.every((k) => rows[k]?.pf !== ""), [rows, PF_KEYS_POST]);
    const missingPFItemsPost = useMemo(() => PF_KEYS_POST.filter((k) => !rows[k]?.pf).map((k) => { const match = k.match(/^r(\d+)(?:_(\d+))?$/); if (match) { const qNo = match[1]; const subNo = match[2]; return subNo ? `${qNo}.${subNo}` : qNo; } return k; }).sort((a, b) => { const [aMain, aSub] = a.split('.').map(Number); const [bMain, bSub] = b.split('.').map(Number); if (aMain !== bMain) return aMain - bMain; return (aSub || 0) - (bSub || 0); }), [rows, PF_KEYS_POST]);

    const active: TabId = useMemo(() => slugToTab(searchParams.get("pmtab")), [searchParams]);
    const canGoAfter: boolean = isPostMode ? true : (allPhotosAttachedPre && allRequiredInputsFilled && allRemarksFilledPre);
    const displayTab: TabId = isPostMode ? "post" : (active === "post" && !canGoAfter ? "pre" : active);

    const isSummaryFilled = summary.trim().length > 0;
    const isSummaryCheckFilled = summaryCheck !== "";
    const canFinalSave = allPhotosAttachedPost && allPFAnsweredPost && allRequiredInputsFilled && allRemarksFilledPost && isSummaryFilled && isSummaryCheckFilled;

    const handleUnitChange = (no: number, key: string, u: UnitVoltage) => {
        const m = MEASURE_BY_NO[no];
        if (!m) return;
        const firstKey = (FIELD_GROUPS[no]?.keys ?? [key])[0] as string;
        if (key !== firstKey) m.patch(firstKey, { unit: u });
        m.syncUnits(u);
    };

    const renderMeasureGrid = (no: number) => {
        const cfg = FIELD_GROUPS[no];
        const m = MEASURE_BY_NO[no];
        if (!cfg || !m) return null;
        return (
            <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-5 tw-gap-3">
                {cfg.keys.map((k) => (
                    <InputWithUnit<UnitVoltage> key={`${no}-${k}`} label={(LABELS[k] ?? k) as string} value={m.state[k]?.value || ""} unit={(m.state[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                        onValueChange={(v) => m.patch(k, { value: v })} onUnitChange={(u) => handleUnitChange(no, k, u)} lang={lang} />
                ))}
            </div>
        );
    };

    const renderMeasureGridWithPre = (no: number) => {
        const cfg = FIELD_GROUPS[no];
        const m = MEASURE_BY_NO[no];
        if (!cfg || !m) return null;
        return (
            <div className="tw-space-y-3">
                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700">{t("beforePM", lang)}</Typography>
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.keys.map((k) => (
                        <div key={`pre-${no}-${k}`} className="tw-pointer-events-none tw-opacity-60">
                            <InputWithUnit<UnitVoltage> label={LABELS[k] ?? k} value={m16Pre[k]?.value || ""} unit={(m16Pre[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage} onValueChange={() => { }} onUnitChange={() => { }} readOnly required={false} lang={lang} />
                        </div>
                    ))}
                </div>
                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700 tw-mt-2">{t("afterPM", lang)}</Typography>
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.keys.map((k) => (
                        <InputWithUnit<UnitVoltage> key={`post-${no}-${k}`} label={LABELS[k] ?? k} value={m.state[k]?.value || ""} unit={(m.state[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                            onValueChange={(v) => m.patch(k, { value: v })} onUnitChange={(u) => handleUnitChange(no, k, u)} lang={lang} />
                    ))}
                </div>
            </div>
        );
    };

    const renderQuestionBlock = (q: Question, mode: TabId) => {
        const subtitle = FIELD_GROUPS[q.no]?.note;
        const fixedItems = fixedItemsMap[q.no as keyof typeof fixedItemsMap];
        const qTooltip = q.tooltip?.[lang];
        const sectionId = `pm-question-${q.no}`;

        if (mode === "pre") {
            return (
                <SectionCard key={q.key} id={sectionId} title={getQuestionLabel(q, mode, lang)} subtitle={subtitle} tooltip={qTooltip}>
                    <div className="tw-space-y-4">
                        {q.hasPhoto && q.kind === "simple" && <PhotoRemarkSection qKey={q.key} qNo={q.no} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {q.no === 16 && <PhotoRemarkSection qKey={q.key} qNo={q.no} middleContent={renderMeasureGrid(q.no)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {q.no === 3 && fixedItems && <DynamicItemsSection qNo={3} items={fixedItems} editable={false} countLabel={t("cableCount", lang)} count={job.chargingCables} countUnit={t("cable", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {q.no === 4 && fixedItems && <DynamicItemsSection qNo={4} items={fixedItems} editable={false} countLabel={t("connectorCount", lang)} count={job.chargingCables} countUnit={t("unit", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {q.no === 5 && <DynamicItemsSection qNo={5} items={q5Items} addItem={addQ5Item} removeItem={removeQ5Item} addButtonLabel={t("addEmergencyStop", lang)} countLabel={t("emergencyStopCount", lang)} count={q5Items.length} countUnit={t("unit", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {q.no === 6 && fixedItems && <DynamicItemsSection qNo={6} items={fixedItems} editable={false} countLabel={t("qrCodeCount", lang)} count={job.chargingCables} countUnit={t("unit", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {q.no === 7 && <DynamicItemsSection qNo={7} items={q7Items} addItem={addQ7Item} removeItem={removeQ7Item} addButtonLabel={t("addWarningSign", lang)} countLabel={t("warningSignCount", lang)} count={q7Items.length} countUnit={t("unit", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {q.no === 10 && fixedItems && (
                            <DynamicItemsSection qNo={10} items={fixedItems} editable={false} countLabel={t("cpVoltageCount", lang)} count={job.chargingCables} countUnit={t("cable", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang}
                                renderAdditionalFields={(item, idx, isNA) => (
                                    <div className="tw-max-w-xs">
                                        <InputWithUnit<UnitVoltage> label="CP" value={cp[item.key]?.value ?? ""} unit={cp[item.key]?.unit ?? "V"} units={["V"] as const}
                                            onValueChange={(v) => setCp((s) => ({ ...s, [item.key]: { ...(s[item.key] ?? { unit: "V" }), value: v } }))}
                                            onUnitChange={(u) => setCp((s) => ({ ...s, [item.key]: { ...(s[item.key] ?? { value: "" }), unit: u } }))} disabled={isNA} lang={lang} />
                                    </div>
                                )} />
                        )}
                        {q.no === 11 && fixedItems && <DynamicItemsSection qNo={11} items={fixedItems} editable={false} countLabel={t("airFilterCount", lang)} count={4} countUnit={t("piece", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {q.no === 17 && fixedItems && <DynamicItemsSection qNo={17} items={fixedItems} editable={false} countLabel={t("chargingTestCount", lang)} count={job.chargingCables} countUnit={t("cable", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                    </div>
                </SectionCard>
            );
        }

        // ========== POST MODE ==========
        if ((q.kind === "simple" || q.kind === "measure") && rowsPre[q.key]?.pf === "NA") {
            return (
                <SectionCard key={q.key} id={sectionId} title={getQuestionLabel(q, mode, lang)} subtitle={subtitle} tooltip={qTooltip}>
                    <SkippedNAItem label={q.label[lang]} remark={rowsPre[q.key]?.remark} lang={lang} />
                </SectionCard>
            );
        }

        return (
            <SectionCard key={q.key} id={sectionId} title={getQuestionLabel(q, mode, lang)} subtitle={subtitle} tooltip={qTooltip}>
                <div className="tw-space-y-4">
                    {q.hasPhoto && q.kind === "simple" && <PhotoRemarkSection qKey={q.key} qNo={q.no} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                    {q.no === 16 && <PhotoRemarkSection qKey={q.key} qNo={q.no} middleContent={renderMeasureGridWithPre(q.no)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                    {q.no === 3 && fixedItems && <DynamicItemsSection qNo={3} items={fixedItems} editable={false} countLabel={t("cableCount", lang)} count={job.chargingCables} countUnit={t("cable", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                    {q.no === 4 && fixedItems && <DynamicItemsSection qNo={4} items={fixedItems} editable={false} countLabel={t("connectorCount", lang)} count={job.chargingCables} countUnit={t("unit", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                    {q.no === 5 && <DynamicItemsSection qNo={5} items={q5Items} editable={false} countLabel={t("emergencyStopCount", lang)} count={q5Items.length} countUnit={t("unit", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                    {q.no === 6 && fixedItems && <DynamicItemsSection qNo={6} items={fixedItems} editable={false} countLabel={t("qrCodeCount", lang)} count={job.chargingCables} countUnit={t("unit", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                    {q.no === 7 && <DynamicItemsSection qNo={7} items={q7Items} editable={false} countLabel={t("warningSignCount", lang)} count={q7Items.length} countUnit={t("unit", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                    {q.no === 10 && fixedItems && (
                        <DynamicItemsSection qNo={10} items={fixedItems} editable={false} countLabel={t("cpVoltageCount", lang)} count={job.chargingCables} countUnit={t("cable", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true}
                            renderAdditionalFields={(item, idx, isNA) => (
                                <div className="tw-flex tw-flex-col tw-gap-3">
                                    <div className="tw-max-w-xs">
                                        <InputWithUnit<UnitVoltage> label={lang === "th" ? "CP (ก่อน PM)" : "CP (Pre PM)"} value={cpPre[item.key]?.value ?? ""} unit={cpPre[item.key]?.unit ?? "V"} units={["V"] as const}
                                            onValueChange={() => {}} onUnitChange={() => {}} disabled={true} required={false} labelOnTop lang={lang} />
                                    </div>
                                    <div className="tw-max-w-xs">
                                        <InputWithUnit<UnitVoltage> label={lang === "th" ? "CP (หลัง PM)" : "CP (Post PM)"} value={cp[item.key]?.value ?? ""} unit={cp[item.key]?.unit ?? "V"} units={["V"] as const}
                                            onValueChange={(v) => setCp((s) => ({ ...s, [item.key]: { ...(s[item.key] ?? { unit: "V" }), value: v } }))}
                                            onUnitChange={(u) => setCp((s) => ({ ...s, [item.key]: { ...(s[item.key] ?? { value: "" }), unit: u } }))} disabled={isNA} required lang={lang} />
                                    </div>
                                </div>
                            )} />
                    )}
                    {q.no === 11 && fixedItems && <DynamicItemsSection qNo={11} items={fixedItems} editable={false} countLabel={t("airFilterCount", lang)} count={4} countUnit={t("piece", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} showDustFilterCheckbox dustFilterChanged={dustFilterChanged} setDustFilterChanged={setDustFilterChanged} />}
                    {q.no === 17 && fixedItems && <DynamicItemsSection qNo={17} items={fixedItems} editable={false} countLabel={t("chargingTestCount", lang)} count={job.chargingCables} countUnit={t("cable", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                </div>
            </SectionCard>
        );
    };

    const photoRefs = useMemo(() => {
        const out: Record<string, (PhotoRef | { isNA: true })[]> = {};
        Object.entries(photos).forEach(([key, list]) => {
            out[key] = (list || []).map(p => p.isNA ? { isNA: true } : p.ref).filter(Boolean) as (PhotoRef | { isNA: true })[];
        });
        return out;
    }, [photos]);

    useDebouncedEffect(() => {
        if (!sn || isPostMode) return;
        saveDraftLocal(key, { rows, cp, m16: m16.state, summary, dustFilterChanged, photoRefs });
    }, [key, sn, rows, cp, m16.state, summary, dustFilterChanged, photoRefs, isPostMode]);

    useDebouncedEffect(() => {
        if (!sn || !isPostMode || !editId) return;
        saveDraftLocal(postKey, { rows, cp, m16: m16.state, summary, summaryCheck, dustFilterChanged, photoRefs });
    }, [postKey, sn, rows, cp, m16.state, summary, summaryCheck, dustFilterChanged, photoRefs, isPostMode, editId]);

    async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
        if (!file.type.startsWith("image/") || file.size < 500 * 1024) return file;
        return new Promise((resolve) => {
            const img = document.createElement("img");
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                let { width, height } = img;
                if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
                const canvas = document.createElement("canvas");
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => { if (blob && blob.size < file.size) resolve(new File([blob], file.name, { type: "image/jpeg" })); else resolve(file); }, "image/jpeg", quality);
            };
            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }

    async function uploadGroupPhotos(reportId: string, sn: string, group: string, files: File[], side: TabId) {
        if (files.length === 0) return;
        const compressedFiles = await Promise.all(files.map(f => compressImage(f)));
        const form = new FormData();
        form.append("sn", sn);
        form.append("group", group);
        form.append("side", side);
        compressedFiles.forEach((f) => form.append("files", f));
        const token = localStorage.getItem("access_token");
        const url = side === "pre" ? `${API_BASE}/pmreport/${reportId}/pre/photos` : `${API_BASE}/pmreport/${reportId}/post/photos`;
        const res = await fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form, credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
    }

    const onPreSave = async () => {
        if (!sn) { alert(t("alertNoSN", lang)); return; }
        if (!allRequiredInputsFilled) { alert(t("alertFillRequired", lang)); return; }
        if (!allRemarksFilledPre) { alert(`${t("alertFillRemark", lang)} ${missingRemarksPre.join(", ")}`); return; }
        if (submitting) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("access_token");
            const pm_date = job.date?.trim() || "";
            const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
            const payload = { sn: sn, issue_id: issueIdFromJob, job: jobWithoutIssueId, inspector, measures_pre: { m16: m16.state, cp }, rows_pre: rows, pm_date, doc_name: docName, side: "pre" as TabId };
            const submitRes = await fetch(`${API_BASE}/pmreport/pre/submit`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: "include", body: JSON.stringify(payload) });
            if (!submitRes.ok) throw new Error(await submitRes.text());
            const { report_id, doc_name } = await submitRes.json() as { report_id: string; doc_name?: string };
            if (doc_name) setDocName(doc_name);
            const uploadPromises: Promise<void>[] = [];
            Object.entries(photos).forEach(([no, list]) => { const files = (list || []).map(p => p.file).filter(Boolean) as File[]; if (files.length > 0) { uploadPromises.push(uploadGroupPhotos(report_id, sn, `g${no}`, files, "pre")); } });
            if (uploadPromises.length > 0) { await Promise.all(uploadPromises); }
            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(key, p.id)));
            clearDraftLocal(key);
            router.replace(`/dashboard/pm-report?sn=${encodeURIComponent(sn)}`);
        } catch (err: any) { alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`); } finally { setSubmitting(false); }
    };

    const onFinalSave = async () => {
        if (!sn) { alert(t("alertNoSN", lang)); return; }
        if (submitting) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("access_token");
            const payload = { sn: sn, rows, measures: { m16: m16.state, cp }, summary, ...(summaryCheck ? { summaryCheck } : {}), dust_filter: dustFilterChanged, side: "post" as TabId, report_id: editId };
            const submitRes = await fetch(`${API_BASE}/pmreport/submit`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: "include", body: JSON.stringify(payload) });
            if (!submitRes.ok) throw new Error(await submitRes.text());
            const { report_id } = await submitRes.json() as { report_id: string };
            const uploadPromises: Promise<void>[] = [];
            Object.entries(photos).forEach(([no, list]) => { const files = (list || []).map(p => p.file).filter(Boolean) as File[]; if (files.length > 0) { uploadPromises.push(uploadGroupPhotos(report_id, sn, `g${no}`, files, "post")); } });
            if (uploadPromises.length > 0) { await Promise.all(uploadPromises); }
            await fetch(`${API_BASE}/pmreport/${report_id}/finalize`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: "include", body: new URLSearchParams({ sn: sn }) });
            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(postKey, p.id)));
            clearDraftLocal(postKey);
            router.replace(`/dashboard/pm-report?sn=${encodeURIComponent(sn)}`);
        } catch (err: any) { alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`); } finally { setSubmitting(false); }
    };

    useEffect(() => {
        const tabParam = searchParams.get("pmtab");
        let desired: "pre" | "post";
        if (isPostMode) desired = "post";
        else if (!tabParam) desired = "pre";
        else if (tabParam === "after" && !canGoAfter) desired = "pre";
        else desired = tabParam === "post" ? "post" : "pre";
        if (tabParam !== desired) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("pmtab", desired);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [searchParams, canGoAfter, pathname, router, isPostMode]);

    const go = (next: TabId) => {
        if (isPostMode && next === "pre") return;
        if (next === "post" && !canGoAfter) { alert(t("alertFillPreFirst", lang)); return; }
        const params = new URLSearchParams(searchParams.toString());
        params.set("pmtab", tabToSlug(next));
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <section className="tw-pb-24">
            <div className="tw-mx-auto tw-max-w-6xl tw-flex tw-items-center tw-justify-between tw-mb-4">
                <Button variant="outlined" size="sm" onClick={() => router.back()} title={t("backToList", lang)}>
                    <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
                </Button>
                <Tabs value={displayTab}>
                    <TabsHeader className="tw-bg-blue-gray-50 tw-rounded-lg">
                        {TABS.map((tb) => {
                            const isPreDisabled = isPostMode && tb.id === "pre";
                            const isLockedAfter = tb.id === "post" && !canGoAfter;
                            if (isPreDisabled) return <div key={tb.id} className="tw-px-4 tw-py-2 tw-font-medium tw-opacity-50 tw-cursor-not-allowed tw-select-none">{tb.label}</div>;
                            if (isLockedAfter) return <div key={tb.id} className="tw-px-4 tw-py-2 tw-font-medium tw-opacity-50 tw-cursor-not-allowed tw-select-none" onClick={() => alert(t("alertFillPreFirst", lang))}>{tb.label}</div>;
                            return <Tab key={tb.id} value={tb.id} onClick={() => go(tb.id)} className="tw-px-4 tw-py-2 tw-font-medium">{tb.label}</Tab>;
                        })}
                    </TabsHeader>
                </Tabs>
            </div>

            <form action="#" noValidate onSubmit={(e) => { e.preventDefault(); return false; }} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
                <div className="tw-mx-auto tw-max-w-6xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-sm tw-p-6 md:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0">
                    <div className="tw-flex tw-flex-col tw-gap-4 md:tw-flex-row md:tw-items-start md:tw-justify-between md:tw-gap-6">
                        <div className="tw-flex tw-items-start tw-gap-3 md:tw-gap-4">
                            <div className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md tw-shrink-0 tw-h-14 tw-w-[64px] sm:tw-h-16 sm:tw-w-[76px] md:tw-h-20 md:tw-w-[108px] lg:tw-h-24 lg:tw-w-[152px]">
                                <Image src={LOGO_SRC} alt="Company logo" fill priority className="tw-object-contain tw-p-0" sizes="(min-width:1024px) 152px, (min-width:768px) 108px, (min-width:640px) 76px, 64px" />
                            </div>
                            <div className="tw-min-w-0">
                                <div className="tw-font-semibold tw-text-blue-gray-900 tw-text-sm sm:tw-text-base">{t("pageTitle", lang)}</div>
                                <div className="tw-text-xs sm:tw-text-sm tw-text-blue-gray-600">
                                    {t("companyName", lang)}<br />
                                    <span className="tw-hidden sm:tw-inline">{t("companyAddress", lang)}<br /></span>
                                    <span className="sm:tw-hidden">{t("companyAddressShort", lang)}<br /></span>
                                    {t("callCenter", lang)}
                                </div>
                            </div>
                        </div>
                        <div className="tw-text-left md:tw-text-right tw-text-sm tw-text-blue-gray-700 tw-border-t tw-border-blue-gray-100 tw-pt-3 md:tw-border-t-0 md:tw-pt-0 md:tw-shrink-0">
                            <div className="tw-font-semibold">{t("docName", lang)}</div>
                            <div className="tw-break-all">{docName || "-"}</div>
                        </div>
                    </div>

                    <div className="tw-mt-8 tw-space-y-8">
                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-8 tw-gap-4">
                            <div className="lg:tw-col-span-2"><Input label={t("issueId", lang)} value={job.issue_id || "-"} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-bg-blue-gray-50" /></div>
                            <div className="sm:tw-col-span-2 lg:tw-col-span-2"><Input label={t("location", lang)} value={job.station_name} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-2"><Input label={t("pmDate", lang)} type="text" value={job.date} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-2"><Input label={t("inspector", lang)} value={inspector} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-2"><Input label={t("brand", lang)} value={job.brand} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-2"><Input label={t("model", lang)} value={job.model} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-2"><Input label={t("power", lang)} value={job.power} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-2"><Input label={t("serialNumber", lang)} value={job.sn} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                        </div>
                        <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            <div className="sm:tw-col-span-2 lg:tw-col-span-3"><Input label={t("chargerNo", lang)} value={job.chargerNo} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                        </div>
                    </div>

                    <div className="tw-mt-6 sm:tw-mt-8 tw-space-y-4 sm:tw-space-y-6">
                        {QUESTIONS.filter((q) => !(displayTab === "pre" && q.no === 18)).map((q) => renderQuestionBlock(q, displayTab))}
                    </div>

                    <div id="pm-summary-section" className="tw-mt-6 sm:tw-mt-8 tw-space-y-3 tw-transition-all tw-duration-300">
                        <Typography variant="h6" className="tw-mb-1 tw-text-sm sm:tw-text-base">{t("comment", lang)}</Typography>
                        <Textarea label={t("comment", lang)} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} required={isPostMode} autoComplete="off" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-text-sm resize-none" />
                        {displayTab === "post" && (
                            <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-200">
                                <PassFailRow label={t("summaryResult", lang)} value={summaryCheck} onChange={(v) => setSummaryCheck(v)} labels={{ PASS: t("summaryPass", lang), FAIL: t("summaryFail", lang), NA: t("summaryNA", lang) }} lang={lang} />
                            </div>
                        )}
                    </div>

                    <div className="tw-mt-6 sm:tw-mt-8 tw-flex tw-flex-col tw-gap-3">
                        <PMValidationCard
                            lang={lang}
                            displayTab={displayTab}
                            isPostMode={isPostMode}
                            allPhotosAttached={allPhotosAttached}
                            missingPhotoItems={missingPhotoItems}
                            allRequiredInputsFilled={allRequiredInputsFilled}
                            missingInputsDetailed={missingInputsDetailed}
                            allRemarksFilledPre={allRemarksFilledPre}
                            missingRemarksPre={missingRemarksPre}
                            allPFAnsweredPost={allPFAnsweredPost}
                            missingPFItemsPost={missingPFItemsPost}
                            allRemarksFilledPost={allRemarksFilledPost}
                            missingRemarksPost={missingRemarksPost}
                            isSummaryFilled={isSummaryFilled}
                            isSummaryCheckFilled={isSummaryCheckFilled}
                        />
                        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-2 sm:tw-gap-3">
                            {displayTab === "pre" ? (
                                <Button type="button" onClick={onPreSave} disabled={!canGoAfter || submitting}
                                    className="tw-text-sm tw-py-2.5 tw-bg-gray-800 hover:tw-bg-gray-900"
                                    title={!allPhotosAttachedPre ? t("alertPhotoNotComplete", lang) : !allRequiredInputsFilled ? t("alertInputNotComplete", lang) : !allRemarksFilledPre ? `${t("alertFillRemark", lang)} ${missingRemarksPre.join(", ")}` : undefined}>
                                    {submitting ? t("saving", lang) : t("save", lang)}
                                </Button>
                            ) : (
                                <Button type="button" onClick={onFinalSave} disabled={!canFinalSave || submitting} 
                                    className="tw-text-sm tw-py-2.5 tw-bg-gray-800 hover:tw-bg-gray-900"
                                    title={!canFinalSave ? t("alertCompleteAll", lang) : undefined}>
                                    {submitting ? t("saving", lang) : t("save", lang)}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </form>
        </section>
    );
}