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
    missingInput: { th: "ยังขาด:", en: "Missing:" },
    missingRemark: { th: "ยังไม่ได้กรอกหมายเหตุข้อ:", en: "Missing remarks for:" },
    missingPF: { th: "ยังไม่ได้เลือกข้อ:", en: "Not selected:" },
    missingSummaryText: { th: "ยังไม่ได้กรอก Comment", en: "Comment not filled" },
    missingSummaryStatus: { th: "ยังไม่ได้เลือกสถานะสรุปผล (Pass/Fail/N/A)", en: "Summary status not selected (Pass/Fail/N/A)" },
    itemLabel: { th: "ข้อ", en: "Item" },

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
    addEmergencyStop: { th: "เพิ่มปุ่มหยุดฉุกเฉิน", en: "Add Emergency Stop" },
    addWarningSign: { th: "เพิ่มป้ายเตือน", en: "Add Warning Sign" },
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
    { no: 17, key: "r17", label: { th: "17) ทดสอบการอัดประจุ", en: "17) Charging test" }, kind: "group", hasPhoto: true, items: [{ label: { th: "17.1) ทดสอบการอัดประจุสายที่ 1", en: "17.1) Charging test cable 1" }, key: "r17_1" }], tooltip: { th: "ตรวจสอบการทำงานร่วมกับ EV Simulator หรือรถจริง", en: "Test with EV Simulator or actual vehicle" } },
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
    chargingTest: (idx: number, lang: Lang) => lang === "th" ? `17.${idx}) ทดสอบการอัดประจุสายที่ ${idx}` : `17.${idx}) Charging test cable ${idx}`,
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
    label, value, onChange, remark, onRemarkChange, labels, aboveRemark, beforeRemark, belowRemark, inlineLeft, onlyNA = false, onClear, lang,
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
                    <Textarea label={t("remark", lang)} value={remark || ""} onChange={(e) => onRemarkChange(e.target.value)}
                        containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full" />
                    {belowRemark}
                </div>
            ) : (
                <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">{buttonsRow}</div>
            )}
        </div>
    );
}

function SectionCard({ title, subtitle, children, tooltip }: {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
    tooltip?: string;
}) {
    return (
        <>
            {title && (
                <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                    <Typography variant="h6">{title}</Typography>
                    {tooltip && (
                        <Tooltip content={tooltip} placement="bottom">
                            <svg className="tw-w-4 tw-h-4 tw-text-blue-gray-400 tw-cursor-help" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        </Tooltip>
                    )}
                </div>
            )}
            <Card className="tw-mt-1 tw-shadow-sm tw-border tw-border-blue-gray-100">
                {subtitle && (
                    <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                        <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">{subtitle}</Typography>
                    </CardHeader>
                )}
                <CardBody className="tw-space-y-4">{children}</CardBody>
            </Card>
        </>
    );
}

function Section({ title, ok, children, lang }: {
    title: React.ReactNode;
    ok: boolean;
    children?: React.ReactNode;
    lang: Lang;
}) {
    return (
        <div className={`tw-rounded-lg tw-border tw-p-3 ${ok ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
            <Typography className="tw-font-medium">{title}</Typography>
            {ok ? <Typography variant="small" className="!tw-text-green-700">{t("allComplete", lang)}</Typography> : children}
        </div>
    );
}

function InputWithUnit<U extends string>({
    label, value, unit, units, onValueChange, onUnitChange, readOnly, disabled, labelOnTop, required = true, isNA = false, onNAChange, lang,
}: {
    label: string; value: string; unit: U; units: readonly U[];
    onValueChange: (v: string) => void; onUnitChange: (u: U) => void;
    readOnly?: boolean; disabled?: boolean; labelOnTop?: boolean; required?: boolean; isNA?: boolean; onNAChange?: (isNA: boolean) => void; lang: Lang;
}) {
    return (
        <div className="tw-space-y-1">
            {labelOnTop && <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700">{label}</Typography>}
            {isNA ? (
                <div className="tw-flex tw-items-center tw-gap-2 tw-h-10 tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-amber-50">
                    <Typography variant="small" className="tw-text-amber-700 tw-font-medium">{t("naNoValue", lang)}</Typography>
                    {onNAChange && !readOnly && <Button size="sm" variant="text" onClick={() => onNAChange(false)} className="tw-ml-auto tw-text-xs">{t("removeNA", lang)}</Button>}
                </div>
            ) : (
                <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-items-end sm:tw-items-center">
                    <Input type="text" inputMode="decimal" label={labelOnTop ? undefined : label} value={value}
                        onChange={(e) => onValueChange(e.target.value)} crossOrigin=""
                        containerProps={{ className: "tw-col-span-1 !tw-min-w-0" }}
                        className={`!tw-w-full ${disabled ? "!tw-bg-blue-gray-50" : ""}`}
                        readOnly={readOnly} disabled={disabled} required={required} />
                    <select required={required} value={unit} onChange={(e) => onUnitChange(e.target.value as U)}
                        className={`tw-col-span-1 tw-h-10 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500/30 focus:tw-border-blue-500 ${disabled ? "tw-bg-blue-gray-50 tw-text-blue-gray-400 tw-cursor-not-allowed" : ""}`}
                        disabled={disabled}>
                        {units.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>
            )}
            {onNAChange && !readOnly && !isNA && (
                <Button size="sm" variant="outlined" onClick={() => onNAChange(true)} className="tw-w-full tw-border-amber-500 tw-text-amber-700">{t("naNoValue", lang)}</Button>
            )}
        </div>
    );
}

function PhotoMultiInput({
    photos, setPhotos, max = 10, draftKey, qNo, lang,
}: {
    label?: string; photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
    max?: number; draftKey: string; qNo: number; lang: Lang;
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
        <div className="tw-space-y-3">
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

// Component for displaying skipped N/A items in Post mode
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
    showDustFilterCheckbox = false,
    dustFilterChanged,
    setDustFilterChanged,
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
            <div className="tw-space-y-4">
                {/* Render items in original order, check if skipped or active per item */}
                {items.map((item, idx) => {
                    const isSkipped = rowsPre?.[item.key]?.pf === "NA";
                    const preRemark = rowsPre?.[item.key]?.remark;
                    
                    // Show skipped N/A item as yellow card
                    if (isSkipped) {
                        return (
                            <SkippedNAItem
                                key={item.key}
                                label={item.label}
                                remark={preRemark}
                                lang={lang}
                            />
                        );
                    }
                    
                    // Show active item with PassFailRow
                    const checkboxElement = showDustFilterCheckbox && dustFilterChanged !== undefined && setDustFilterChanged ? (
                        <label className="tw-flex tw-items-center tw-gap-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-700 tw-py-2">
                            <input type="checkbox" className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500"
                                checked={dustFilterChanged[item.key] || false}
                                onChange={(e) => setDustFilterChanged(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                            <span className="tw-leading-tight">{t("replaceAirFilter", lang)}</span>
                        </label>
                    ) : null;

                    // Pre-PM remark display element
                    const preRemarkElement = preRemark ? (
                        <div className="tw-mb-3 tw-p-3 tw-bg-amber-50 tw-rounded-lg tw-border tw-border-amber-300">
                            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                                <svg className="tw-w-4 tw-h-4 tw-text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <Typography variant="small" className="tw-font-semibold tw-text-amber-700">{t("preRemarkLabel", lang)}</Typography>
                            </div>
                            <Typography variant="small" className="tw-text-amber-900 tw-ml-6">{preRemark}</Typography>
                        </div>
                    ) : null;

                    return (
                        <div key={item.key} className="tw-p-4 tw-rounded-lg tw-border tw-bg-gray-50 tw-border-blue-gray-100">
                            <PassFailRow
                                label={item.label}
                                value={rows[item.key]?.pf ?? ""}
                                onChange={(v) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { remark: "" }), pf: v } }))}
                                remark={rows[item.key]?.remark ?? ""}
                                onRemarkChange={(v) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { pf: "" }), remark: v } }))}
                                lang={lang}
                                aboveRemark={
                                    <>
                                        <div className="tw-pb-4 tw-border-b tw-border-blue-gray-50">
                                            <PhotoMultiInput
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
                                            <div className="tw-mb-3">
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
        );
    }

    // PRE MODE - original layout
    return (
        <div className="tw-space-y-4">
            {editable && addItem && addButtonLabel && (
                <div className="tw-flex tw-items-center tw-justify-end tw-py-3 tw-border-b tw-border-blue-gray-100">
                    {items.length < 66 && (
                        <Button size="sm" color="blue" variant="outlined" onClick={addItem} className="tw-flex tw-items-center tw-gap-1">
                            <span className="tw-text-lg tw-leading-none">+</span>
                            <span className="tw-text-xs">{addButtonLabel}</span>
                        </Button>
                    )}
                </div>
            )}
            <div className="tw-space-y-4">
                {items.map((item, idx) => {
                    const isNA = rows[item.key]?.pf === "NA";
                    return (
                        <div key={item.key} className={`tw-p-4 tw-rounded-lg tw-border ${isNA ? "tw-bg-amber-50 tw-border-amber-200" : "tw-bg-gray-50 tw-border-blue-gray-100"}`}>
                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                <Typography className="tw-font-semibold tw-text-sm tw-text-blue-gray-800">{item.label}</Typography>
                                <div className="tw-flex tw-items-center tw-gap-2">
                                    <Button size="sm" color={isNA ? "amber" : "blue-gray"} variant={isNA ? "filled" : "outlined"}
                                        onClick={() => setRows(prev => ({ ...prev, [item.key]: { ...prev[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs">
                                        {isNA ? t("cancelNA", lang) : t("na", lang)}
                                    </Button>
                                    {editable && items.length > 1 && removeItem && (
                                        <button type="button" onClick={() => removeItem(idx)}
                                            className="tw-h-6 tw-w-6 tw-flex tw-items-center tw-justify-center tw-rounded tw-bg-red-50 tw-text-red-600 hover:tw-bg-red-100 hover:tw-text-red-700 tw-transition-all tw-duration-200 tw-border tw-border-red-200 hover:tw-border-red-300"
                                            aria-label="Remove item">
                                            <svg className="tw-w-3.5 tw-h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                            {showDustFilterCheckbox && dustFilterChanged !== undefined && setDustFilterChanged && (
                                <div className="tw-flex tw-items-center tw-gap-2 tw-p-3 tw-mb-3 tw-bg-blue-50 tw-rounded-lg tw-border tw-border-blue-200">
                                    <input type="checkbox" id={`dustFilter_${item.key}`} className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500"
                                        checked={dustFilterChanged[item.key] || false}
                                        onChange={(e) => setDustFilterChanged(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                                    <label htmlFor={`dustFilter_${item.key}`} className="tw-text-sm tw-text-blue-gray-700 tw-font-medium">{t("replaceAirFilter", lang)}</label>
                                </div>
                            )}
                            <div className="tw-mb-3">
                                <PhotoMultiInput photos={photos[`${qNo}_${idx}`] || []}
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
                                <div className={`tw-mb-3 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>
                                    {renderAdditionalFields(item, idx, isNA)}
                                </div>
                            )}
                            <Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""}
                                onChange={(e) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { pf: "" }), remark: e.target.value } }))}
                                rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
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

    // Pre-PM remark display element
    const preRemarkElement = isPostMode && preRemark ? (
        <div className="tw-mb-3 tw-p-3 tw-bg-amber-50 tw-rounded-lg tw-border tw-border-amber-300">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                <svg className="tw-w-4 tw-h-4 tw-text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <Typography variant="small" className="tw-font-semibold tw-text-amber-700">{t("preRemarkLabel", lang)}</Typography>
            </div>
            <Typography variant="small" className="tw-text-amber-900 tw-ml-6">{preRemark}</Typography>
        </div>
    ) : null;

    // POST MODE - use PassFailRow like MDBPMForm.tsx
    if (isPostMode) {
        return (
            <div className="tw-p-4 tw-rounded-lg tw-border tw-bg-gray-50 tw-border-blue-gray-100">
                <PassFailRow
                    label={t("testResult", lang)}
                    value={rows[qKey]?.pf ?? ""}
                    onChange={(v) => setRows(prev => ({ ...prev, [qKey]: { ...(prev[qKey] ?? { remark: "" }), pf: v } }))}
                    remark={rows[qKey]?.remark ?? ""}
                    onRemarkChange={(v) => setRows(prev => ({ ...prev, [qKey]: { ...(prev[qKey] ?? { pf: "" }), remark: v } }))}
                    lang={lang}
                    aboveRemark={
                        <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-4 tw-border-blue-gray-50">
                            <PhotoMultiInput photos={photos[qNo] || []} setPhotos={makePhotoSetter(qNo)} max={10} draftKey={draftKey} qNo={qNo} lang={lang} />
                        </div>
                    }
                    beforeRemark={
                        <>
                            {middleContent && <div className="tw-mb-3">{middleContent}</div>}
                            {preRemarkElement}
                        </>
                    }
                />
            </div>
        );
    }

    // PRE MODE - original layout
    return (
        <div className={`tw-p-4 tw-rounded-lg tw-border ${isNA ? "tw-bg-amber-50 tw-border-amber-200" : "tw-bg-gray-50 tw-border-blue-gray-100"}`}>
            {label && <div className="tw-flex tw-items-center tw-justify-between tw-mb-3"><Typography className="tw-font-semibold tw-text-sm tw-text-blue-gray-800">{label}</Typography></div>}
            <div className="tw-flex tw-justify-end tw-mb-3">
                <Button size="sm" color={isNA ? "amber" : "blue-gray"} variant={isNA ? "filled" : "outlined"}
                    onClick={() => setRows(prev => ({ ...prev, [qKey]: { ...prev[qKey], pf: isNA ? "" : "NA" } }))}>
                    {isNA ? t("cancelNA", lang) : t("na", lang)}
                </Button>
            </div>
            <div className="tw-mb-3">
                <PhotoMultiInput photos={photos[qNo] || []} setPhotos={makePhotoSetter(qNo)} max={10} draftKey={draftKey} qNo={qNo} lang={lang} />
            </div>
            {middleContent && <div className={`tw-mb-3 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>{middleContent}</div>}
            <Textarea label={t("remark", lang)} value={rows[qKey]?.remark ?? ""}
                onChange={(e) => setRows(prev => ({ ...prev, [qKey]: { ...(prev[qKey] ?? { pf: "" }), remark: e.target.value } }))}
                rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
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
    
    // Separate draft keys for Pre and Post mode
    // Pre mode: ใช้ stationId เท่านั้น (เหมือน CCBPMReport)
    // Post mode: ใช้ stationId + editId
    const key = useMemo(() => draftKey(sn), [sn]);  // Pre mode - ไม่ใช้ draftId
    const postKey = useMemo(() => `${draftKey(sn)}:${editId}:post`, [sn, editId]);
    const currentDraftKey = isPostMode ? postKey : key;
    
    // Remove draft_id from URL if present (especially in Post mode)
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
    const [postApiLoaded, setPostApiLoaded] = useState(false);  // Track when API data is loaded

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

    // Dynamic items with lang support
    const [q5Items, setQ5Items] = useState<{ key: string; label: string }[]>([{ key: "r5_1", label: getDynamicLabel.emergencyStop(1, lang) }]);
    const [q7Items, setQ7Items] = useState<{ key: string; label: string }[]>([{ key: "r7_1", label: getDynamicLabel.warningSign(1, lang) }]);

    // Update labels when lang changes
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

    // Effects for loading data
    useEffect(() => {
        if (!isPostMode || !editId || !sn) return;
        setPostApiLoaded(false);  // Reset flag when deps change
        (async () => {
            try {
                const data = await fetchReport(editId, sn);
                if (data.job) setJob(prev => ({ 
                    ...prev, 
                    ...data.job, 
                    issue_id: data.issue_id ?? prev.issue_id,
                    chargingCables: data.job.chargingCables || prev.chargingCables || 1,
                }));
                if (data.pm_date) setJob(prev => ({ ...prev, date: data.pm_date }));
                if (data?.measures_pre?.cp) {
                    const cpData: Record<string, { value: string; unit: UnitVoltage }> = {};
                    Object.entries(data.measures_pre.cp).forEach(([k, v]: [string, any]) => {
                        cpData[k] = { value: v?.value ?? "", unit: (v?.unit as UnitVoltage) ?? "V" };
                    });
                    setCpPre(cpData);
                }
                if (data?.measures_pre?.m16) {
                    setM16Pre((prev) => {
                        const next = { ...prev };
                        VOLTAGE1_FIELDS.forEach((k) => {
                            const row = data.measures_pre.m16[k] ?? {};
                            next[k] = { value: row.value ?? "", unit: (row.unit as UnitVoltage) ?? "V" };
                        });
                        return next;
                    });
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
                if (data.rows) {
                    setRows((prev) => {
                        const next = { ...prev };
                        Object.entries(data.rows).forEach(([k, v]) => { next[k] = v as { pf: PF; remark: string }; });
                        return next;
                    });
                } else if (data.rows_pre) {
                    setRows((prev) => {
                        const next = { ...prev };
                        Object.entries(data.rows_pre).forEach(([k, v]) => {
                            const preRow = v as { pf: PF; remark: string };
                            next[k] = { pf: preRow.pf, remark: "" };
                        });
                        return next;
                    });
                }
                setPostApiLoaded(true);  // Set flag when API data is loaded
            } catch (err) { 
                console.error("load report failed:", err); 
                setPostApiLoaded(true);  // Still set flag even on error so draft can load
            }
        })();
    }, [isPostMode, editId, sn]);

    // Load draft for Post mode (AFTER API data loaded)
    useEffect(() => {
        if (!isPostMode || !sn || !editId || !postApiLoaded) return;
        const postDraft = loadDraftLocal<{
            rows: typeof rows; cp: typeof cp; m16: typeof m16.state; summary: string; summaryCheck?: PF;
            dustFilterChanged?: Record<string, boolean>; photoRefs?: Record<string, (PhotoRef | { isNA: true })[]>;
        }>(postKey);
        if (!postDraft) return;
        // Override with draft data
        if (postDraft.rows) setRows(prev => ({ ...prev, ...postDraft.rows }));
        if (postDraft.cp) setCp(postDraft.cp);
        if (postDraft.m16) m16.setState(postDraft.m16);
        if (postDraft.summary) setSummary(postDraft.summary);
        if (postDraft.summaryCheck) setSummaryCheck(postDraft.summaryCheck);
        if (postDraft.dustFilterChanged) setDustFilterChanged(postDraft.dustFilterChanged);
        // Load photos from draft
        (async () => {
            if (!postDraft.photoRefs) return;
            const next: Record<string, PhotoItem[]> = {};
            for (const [photoKey, refs] of Object.entries(postDraft.photoRefs)) {
                const items: PhotoItem[] = [];
                for (const ref of refs || []) {
                    if ('isNA' in ref && ref.isNA) { items.push({ id: `${photoKey}-NA-restored`, isNA: true, preview: undefined }); continue; }
                    if (!('id' in ref) || !ref.id) continue;
                    const file = await getPhoto(postKey, ref.id);
                    if (!file) continue;
                    items.push({ id: ref.id, file, preview: URL.createObjectURL(file), remark: (ref as any).remark ?? "", ref: ref as PhotoRef });
                }
                if (items.length > 0) next[photoKey] = items;
            }
            if (Object.keys(next).length > 0) setPhotos(prev => ({ ...prev, ...next }));
        })();
    }, [isPostMode, sn, editId, postKey, postApiLoaded]);

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

    // Load draft for Pre mode only
    useEffect(() => {
        if (!sn || isPostMode) return;
        const draft = loadDraftLocal<{
            rows: typeof rows; cp: typeof cp; m16: typeof m16.state; summary: string; inspector?: string;
            dustFilterChanged?: boolean | Record<string, boolean>; photoRefs?: Record<string, (PhotoRef | { isNA: true })[]>;
        }>(key);
        if (!draft) return;
        setRows(draft.rows);
        setCp(draft.cp);
        if (draft.m16 && typeof draft.m16 === "object") m16.setState(draft.m16);
        else m16.setState(initMeasureState(VOLTAGE1_FIELDS, "V"));
        setSummary(draft.summary);
        setInspector(draft.inspector ?? "");
        if (typeof draft.dustFilterChanged === "boolean") {
            const converted: Record<string, boolean> = {};
            getFixedItemsQ11(lang).forEach(item => { converted[item.key] = draft.dustFilterChanged as boolean; });
            setDustFilterChanged(converted);
        } else {
            setDustFilterChanged(draft.dustFilterChanged ?? {});
        }
        (async () => {
            if (!draft.photoRefs) return;
            const next: Record<string, PhotoItem[]> = {};
            QUESTIONS.filter((q) => q.hasPhoto).forEach((q) => { next[q.no] = []; });
            for (const [photoKey, refs] of Object.entries(draft.photoRefs)) {
                const items: PhotoItem[] = [];
                for (const ref of refs || []) {
                    if ('isNA' in ref && ref.isNA) { items.push({ id: `${photoKey}-NA-restored`, isNA: true, preview: undefined }); continue; }
                    if (!('id' in ref) || !ref.id) continue;
                    const file = await getPhoto(key, ref.id);
                    if (!file) continue;
                    items.push({ id: ref.id, file, preview: URL.createObjectURL(file), remark: (ref as any).remark ?? "", ref: ref as PhotoRef });
                }
                next[photoKey] = items;
            }
            setPhotos(next);
        })();
    }, [sn, key, isPostMode]);

    useEffect(() => {
        const onInfo = (e: Event) => {
            const detail = (e as CustomEvent).detail as { info?: StationPublic; station?: StationPublic; sn?: string };
            const st = detail.info ?? detail.station;
            if (!st) return;
            setJob((prev) => ({ ...prev, sn: st.SN ?? prev.sn, chargerNo: st.chargerNo ?? prev.chargerNo, model: st.model ?? prev.model, brand: st.brand ?? prev.brand }));
            if (detail.sn) setSn(detail.sn);
        };
        window.addEventListener("station:info", onInfo as EventListener);
        return () => window.removeEventListener("station:info", onInfo as EventListener);
    }, []);

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

    const missingInputs = useMemo(() => {
        const r: Record<number, string[]> = {};
        const missingCPs = (fixedItemsMap[10] || []).filter((item) => {
            if (rowsPre[item.key]?.pf === "NA") return false;
            if (rows[item.key]?.pf === "NA") return false;
            return !cpIsNA && !cp[item.key]?.value?.trim();
        }).map((item) => `CP (${item.label})`);
        r[10] = missingCPs;
        if (rowsPre["r16"]?.pf === "NA" || rows["r16"]?.pf === "NA") { r[16] = []; }
        else { r[16] = VOLTAGE1_FIELDS.filter((k) => !m16.state[k]?.value?.toString().trim()); }
        return r;
    }, [cpIsNA, cp, fixedItemsMap, m16.state, rows, rowsPre]);

    const allRequiredInputsFilled = useMemo(() => Object.values(missingInputs).every((arr) => arr.length === 0), [missingInputs]);
    const missingInputsTextLines = useMemo(() => {
        const lines: string[] = [];
        (Object.entries(missingInputs) as [string, string[]][]).forEach(([no, arr]) => {
            if (arr.length > 0) lines.push(`${t("itemLabel", lang)} ${no}: ${arr.map((k) => LABELS[k] ?? k).join(", ")}`);
        });
        return lines;
    }, [missingInputs, lang]);

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
            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
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
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.keys.map((k) => (
                        <div key={`pre-${no}-${k}`} className="tw-pointer-events-none tw-opacity-60">
                            <InputWithUnit<UnitVoltage> label={LABELS[k] ?? k} value={m16Pre[k]?.value || ""} unit={(m16Pre[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage} onValueChange={() => { }} onUnitChange={() => { }} readOnly required={false} lang={lang} />
                        </div>
                    ))}
                </div>
                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700 tw-mt-2">{t("afterPM", lang)}</Typography>
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
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

        if (mode === "pre") {
            return (
                <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} subtitle={subtitle} tooltip={qTooltip}>
                    <div className="tw-space-y-4">
                        {q.hasPhoto && q.kind === "simple" && <PhotoRemarkSection qKey={q.key} qNo={q.no} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {q.no === 16 && <PhotoRemarkSection qKey={q.key} qNo={q.no} middleContent={renderMeasureGrid(q.no)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {q.no === 5 && <DynamicItemsSection qNo={5} items={q5Items} addItem={addQ5Item} removeItem={removeQ5Item} addButtonLabel={t("addEmergencyStop", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {q.no === 7 && <DynamicItemsSection qNo={7} items={q7Items} addItem={addQ7Item} removeItem={removeQ7Item} addButtonLabel={t("addWarningSign", lang)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {[3, 4, 6, 17].includes(q.no) && fixedItems && <DynamicItemsSection qNo={q.no} items={fixedItems} editable={false} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                        {q.no === 10 && fixedItems && (
                            <DynamicItemsSection qNo={10} items={fixedItems} editable={false} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang}
                                renderAdditionalFields={(item, idx, isNA) => (
                                    <div className="tw-max-w-xs">
                                        <InputWithUnit<UnitVoltage> label="CP" value={cp[item.key]?.value ?? ""} unit={cp[item.key]?.unit ?? "V"} units={["V"] as const}
                                            onValueChange={(v) => setCp((s) => ({ ...s, [item.key]: { ...(s[item.key] ?? { unit: "V" }), value: v } }))}
                                            onUnitChange={(u) => setCp((s) => ({ ...s, [item.key]: { ...(s[item.key] ?? { value: "" }), unit: u } }))} disabled={isNA} lang={lang} />
                                    </div>
                                )} />
                        )}
                        {q.no === 11 && fixedItems && <DynamicItemsSection qNo={11} items={fixedItems} editable={false} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />}
                    </div>
                </SectionCard>
            );
        }

        // ========== POST MODE ==========
        // Show skipped card if Pre-PM was N/A for simple/measure questions
        if ((q.kind === "simple" || q.kind === "measure") && rowsPre[q.key]?.pf === "NA") {
            return (
                <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} subtitle={subtitle} tooltip={qTooltip}>
                    <SkippedNAItem
                        label={q.label[lang]}
                        remark={rowsPre[q.key]?.remark}
                        lang={lang}
                    />
                </SectionCard>
            );
        }

        return (
            <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} subtitle={subtitle} tooltip={qTooltip}>
                <div className="tw-space-y-4">
                    {q.hasPhoto && q.kind === "simple" && <PhotoRemarkSection qKey={q.key} qNo={q.no} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                    {q.no === 16 && <PhotoRemarkSection qKey={q.key} qNo={q.no} middleContent={renderMeasureGridWithPre(q.no)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                    {q.no === 5 && <DynamicItemsSection qNo={5} items={q5Items} editable={false} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                    {q.no === 7 && <DynamicItemsSection qNo={7} items={q7Items} editable={false} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                    {[3, 4, 6, 17].includes(q.no) && fixedItems && <DynamicItemsSection qNo={q.no} items={fixedItems} editable={false} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} />}
                    {q.no === 10 && fixedItems && (
                        <DynamicItemsSection qNo={10} items={fixedItems} editable={false} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true}
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
                    {q.no === 11 && fixedItems && <DynamicItemsSection qNo={11} items={fixedItems} editable={false} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} rowsPre={rowsPre} draftKey={currentDraftKey} lang={lang} isPostMode={true} showDustFilterCheckbox dustFilterChanged={dustFilterChanged} setDustFilterChanged={setDustFilterChanged} />}
                </div>
            </SectionCard>
        );
    };

    // Photo refs for draft
    const photoRefs = useMemo(() => {
        const out: Record<string, (PhotoRef | { isNA: true })[]> = {};
        Object.entries(photos).forEach(([key, list]) => {
            out[key] = (list || []).map(p => p.isNA ? { isNA: true } : p.ref).filter(Boolean) as (PhotoRef | { isNA: true })[];
        });
        return out;
    }, [photos]);

    // Save draft for Pre mode
    useDebouncedEffect(() => {
        if (!sn || isPostMode) return;
        saveDraftLocal(key, { rows, cp, m16: m16.state, summary, dustFilterChanged, photoRefs });
    }, [key, sn, rows, cp, m16.state, summary, dustFilterChanged, photoRefs, isPostMode]);

    // Save draft for Post mode
    useDebouncedEffect(() => {
        if (!sn || !isPostMode || !editId) return;
        saveDraftLocal(postKey, { 
            rows, cp, m16: m16.state, summary, summaryCheck, dustFilterChanged, photoRefs 
        });
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
                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            <div className="sm:tw-col-span-2 lg:tw-col-span-3"><Input label={t("chargerNo", lang)} value={job.chargerNo} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                        </div>
                    </div>

                    <CardBody className="tw-space-y-2">
                        {QUESTIONS.filter((q) => !(displayTab === "pre" && q.no === 18)).map((q) => renderQuestionBlock(q, displayTab))}
                    </CardBody>

                    <CardBody className="tw-space-y-3 !tw-pt-4 !tw-pb-0">
                        <Typography variant="h6" className="tw-mb-1">{t("comment", lang)}</Typography>
                        <Textarea label={t("comment", lang)} value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} required={isPostMode} autoComplete="off" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                        {displayTab === "post" && (
                            <div className="tw-pt-4 tw-border-t tw-border-blue-gray-100">
                                <PassFailRow label={t("summaryResult", lang)} value={summaryCheck} onChange={(v) => setSummaryCheck(v)} labels={{ PASS: t("summaryPass", lang), FAIL: t("summaryFail", lang), NA: t("summaryNA", lang) }} lang={lang} />
                            </div>
                        )}
                    </CardBody>

                    <CardFooter className="tw-flex tw-flex-col tw-gap-3 tw-mt-4">
                        <div className="tw-p-3 tw-flex tw-flex-col tw-gap-2">
                            <Section title={t("validationPhotoTitle", lang)} ok={allPhotosAttached} lang={lang}>
                                <Typography variant="small" className="!tw-text-amber-700">{t("missingPhoto", lang)} {missingPhotoItems.join(", ")}</Typography>
                            </Section>
                            <Section title={t("validationInputTitle", lang)} ok={allRequiredInputsFilled} lang={lang}>
                                <div className="tw-space-y-1">
                                    <Typography variant="small" className="!tw-text-amber-700">{t("missingInput", lang)}</Typography>
                                    <ul className="tw-list-disc tw-ml-5 tw-text-sm tw-text-blue-gray-700">
                                        {missingInputsTextLines.map((line, i) => <li key={i}>{line}</li>)}
                                    </ul>
                                </div>
                            </Section>
                            {displayTab === "pre" && (
                                <Section title={t("validationRemarkTitle", lang)} ok={allRemarksFilledPre} lang={lang}>
                                    {missingRemarksPre.length > 0 && <Typography variant="small" className="!tw-text-amber-700">{t("missingRemark", lang)} {missingRemarksPre.join(", ")}</Typography>}
                                </Section>
                            )}
                            {isPostMode && (
                                <>
                                    <Section title={t("validationPFTitle", lang)} ok={allPFAnsweredPost} lang={lang}>
                                        <Typography variant="small" className="!tw-text-amber-700">{t("missingPF", lang)} {missingPFItemsPost.join(", ")}</Typography>
                                    </Section>
                                    <Section title={t("validationRemarkTitlePost", lang)} ok={allRemarksFilledPost} lang={lang}>
                                        {missingRemarksPost.length > 0 && <Typography variant="small" className="!tw-text-amber-700">{t("missingRemark", lang)} {missingRemarksPost.join(", ")}</Typography>}
                                    </Section>
                                    <Section title={t("validationSummaryTitle", lang)} ok={isSummaryFilled && isSummaryCheckFilled} lang={lang}>
                                        <div className="tw-space-y-1">
                                            {!isSummaryFilled && <Typography variant="small" className="!tw-text-amber-700">{t("missingSummaryText", lang)}</Typography>}
                                            {!isSummaryCheckFilled && <Typography variant="small" className="!tw-text-amber-700">{t("missingSummaryStatus", lang)}</Typography>}
                                        </div>
                                    </Section>
                                </>
                            )}
                        </div>
                        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-3">
                            {displayTab === "pre" ? (
                                <Button color="blue" type="button" onClick={onPreSave} disabled={!canGoAfter || submitting}
                                    title={!allPhotosAttachedPre ? t("alertPhotoNotComplete", lang) : !allRequiredInputsFilled ? t("alertInputNotComplete", lang) : !allRemarksFilledPre ? `${t("alertFillRemark", lang)} ${missingRemarksPre.join(", ")}` : undefined}>
                                    {submitting ? t("saving", lang) : t("save", lang)}
                                </Button>
                            ) : (
                                <Button color="blue" type="button" onClick={onFinalSave} disabled={!canFinalSave || submitting} title={!canFinalSave ? t("alertCompleteAll", lang) : undefined}>
                                    {submitting ? t("saving", lang) : t("save", lang)}
                                </Button>
                            )}
                        </div>
                    </CardFooter>
                </div>
            </form>
        </section>
    );
}