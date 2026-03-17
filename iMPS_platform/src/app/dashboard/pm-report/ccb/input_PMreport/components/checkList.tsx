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

// ==================== TRANSLATIONS ====================
const T = {
    // Page header
    pageTitle: {
        th: "Preventive Maintenance Checklist - Communication Control Box (CCB)",
        en: "Preventive Maintenance Checklist - Communication Control Box (CCB)"
    },
    companyName: {
        th: "Electricity Generating Authority of Thailand (EGAT)",
        en: "Electricity Generating Authority of Thailand (EGAT)"
    },
    companyAddress: {
        th: "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand",
        en: "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand"
    },
    companyAddressShort: {
        th: "Bang Kruai, Nonthaburi 11130",
        en: "Bang Kruai, Nonthaburi 11130"
    },
    callCenter: { th: "Call Center Tel. 02-114-3350", en: "Call Center Tel. 02-114-3350" },
    docName: { th: "ชื่อเอกสาร", en: "Document Name" },

    // Form labels
    issueId: { th: "Issue ID", en: "Issue ID" },
    location: { th: "สถานที่", en: "Location" },
    inspector: { th: "ผู้ตรวจสอบ", en: "Inspector" },
    pmDate: { th: "วันที่ PM", en: "PM Date" },

    // Tabs
    tabPrePm: { th: "Pre-PM", en: "Pre-PM" },
    tabPostPm: { th: "Post-PM", en: "Post-PM" },

    // Buttons
    save: { th: "บันทึก", en: "Save" },
    saving: { th: "กำลังบันทึก...", en: "Saving..." },
    attachPhoto: { th: "แนบรูป / ถ่ายรูป", en: "Attach / Take Photo" },
    pass: { th: "PASS", en: "PASS" },
    fail: { th: "FAIL", en: "FAIL" },
    na: { th: "N/A", en: "N/A" },
    cancelNA: { th: "ยกเลิก N/A", en: "Cancel N/A" },
    backToList: { th: "กลับไปหน้า List", en: "Back to List" },

    // Pass/Fail labels for summary
    summaryPassLabel: { th: "Pass", en: "Pass" },
    summaryFailLabel: { th: "Fail", en: "Fail" },
    summaryNALabel: { th: "N/A", en: "N/A" },

    // Photo input
    maxPhotos: { th: "สูงสุด", en: "Max" },
    photos: { th: "รูป", en: "photos" },
    cameraSupported: { th: "รองรับการถ่ายจากกล้องบนมือถือ", en: "Camera supported on mobile" },
    noPhotos: { th: "ยังไม่มีรูปแนบ", en: "No photos attached" },

    // Remarks
    remark: { th: "หมายเหตุ *", en: "Remark *" },
    remarkLabel: { th: "หมายเหตุ", en: "Remark" },
    testResult: { th: "ผลการทดสอบ", en: "Test Result" },
    preRemarkLabel: { th: "หมายเหตุ (ก่อน PM)", en: "Remark (Pre-PM)" },

    // Section labels
    comment: { th: "Comment", en: "Comment" },
    summaryResult: { th: "สรุปผลการตรวจสอบ", en: "Inspection Summary" },
    prePM: { th: "ก่อน PM", en: "Pre-PM" },
    postPM: { th: "หลัง PM", en: "Post-PM" },
    beforePM: { th: "ก่อน PM", en: "Before PM" },
    afterPM: { th: "หลัง PM", en: "After PM" },
    beforePmRef: { th: "ก่อน PM (อ้างอิง)", en: "Before PM (Reference)" },

    // Validation sections
    validationPhotoTitle: { th: "1) ตรวจสอบการแนบรูปภาพ (ทุกข้อ)", en: "1) Photo Attachments (all items)" },
    validationInputTitle: { th: "2) อินพุตข้อ 9 (ค่าที่วัด)", en: "2) Input Item 9 (measurements)" },
    validationRemarkTitle: { th: "3) หมายเหตุ (ทุกข้อ)", en: "3) Remarks (all items)" },
    validationPFTitle: { th: "3) สถานะ PASS / FAIL / N/A ทุกข้อ", en: "3) PASS / FAIL / N/A for all items" },
    validationRemarkTitlePost: { th: "4) หมายเหตุ (ทุกข้อ)", en: "4) Remarks (all items)" },
    validationSummaryTitle: { th: "5) สรุปผลการตรวจสอบ", en: "5) Inspection Summary" },

    allComplete: { th: "ครบเรียบร้อย ✅", en: "Complete ✅" },
    missingPhoto: { th: "ยังไม่ได้แนบรูปข้อ:", en: "Missing photos for:" },
    missingInput: { th: "ยังขาดข้อ:", en: "Missing:" },
    missingRemark: { th: "ยังไม่ได้กรอกหมายเหตุข้อ:", en: "Missing remarks for:" },
    missingPF: { th: "ยังไม่ได้เลือกข้อ:", en: "Not selected:" },
    missingSummaryText: { th: "ยังไม่ได้กรอก Comment", en: "Comment not filled" },
    missingSummaryStatus: { th: "ยังไม่ได้เลือกสถานะสรุปผล (Pass/Fail/N/A)", en: "Summary status not selected (Pass/Fail/N/A)" },
    // PMValidationCard translations
    itemLabel: { th: "ข้อ", en: "Item" },
    formStatus: { th: "สถานะการกรอกข้อมูล", en: "Form Completion Status" },
    allCompleteReady: { th: "กรอกข้อมูลครบถ้วนแล้ว พร้อมบันทึก ✓", en: "All fields completed. Ready to save ✓" },
    remaining: { th: "ยังขาดอีก {n} รายการ", en: "{n} items remaining" },
    items: { th: "รายการ", en: "items" },

    // Alerts
    alertNoStation: { th: "ยังไม่ทราบ station_id", en: "Station ID not found" },
    alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },
    alertFillPreFirst: { th: "กรุณากรอกข้อมูลในส่วน Pre-PM ให้ครบก่อน", en: "Please complete all Pre-PM fields first" },
    alertFillPhoto: { th: "กรุณาแนบรูปในทุกข้อก่อนบันทึก", en: "Please attach photos for all items" },
    alertPhotoNotComplete: { th: "กรุณาแนบรูปในส่วน Pre-PM ให้ครบก่อน", en: "Please attach all photos in Pre-PM section" },
    alertInputNotComplete: { th: "กรุณากรอกค่าข้อ 9 ให้ครบ", en: "Please fill in Item 9" },
    alertFillRemark: { th: "กรุณากรอกหมายเหตุข้อ:", en: "Please fill in remarks for:" },
    alertCompleteAll: { th: "กรุณากรอกข้อมูลและแนบรูปให้ครบก่อนบันทึก", en: "Please complete all fields and attach photos before saving" },
    noReportId: { th: "ไม่มี report_id - กรุณาบันทึกข้อมูล Pre-PM ก่อน", en: "No report_id - Please save Pre-PM first" },

    // Questions
    q1: { th: "1) ตรวจสอบสภาพทั่วไป", en: "1) General condition inspection" },
    q2: { th: "2) ตรวจสอบสภาพดักซีล, ซิลิโคนกันซึม", en: "2) Seal and silicone waterproofing inspection" },
    q3: { th: "3) ตรวจสอบระบบระบายอากาศ", en: "3) Ventilation system inspection" },
    q3_1: { th: "ตรวจสอบการทำงานอุปกรณ์ตั้งอุณหภูมิ", en: "Temperature controller operation check" },
    q3_2: { th: "ตรวจสอบการทำงานพัดลมระบายอากาศ", en: "Ventilation fan operation check" },
    q4: { th: "4) ตรวจสอบระบบแสงสว่าง", en: "4) Lighting system inspection" },
    q4_1: { th: "ตรวจสอบการทำงานของไฟส่องสว่างในสถานี", en: "Station lighting operation check" },
    q4_2: { th: "ตรวจสอบการทำงานของป้ายไฟ / Logo", en: "Light sign / Logo operation check" },
    q5: { th: "5) ตรวจสอบระบบสำรองไฟฟ้า (UPS)", en: "5) UPS backup system inspection" },
    q5_1: { th: "เครื่องสามารถทำงานได้ตามปกติ", en: "Device operates normally" },
    q5_2: { th: "เครื่องสามารถสำรองไฟได้ (>5 นาที)", en: "Device can backup power (>5 minutes)" },
    q6: { th: "6) ตรวจสอบระบบกล้องวงจรปิด (CCTV)", en: "6) CCTV system inspection" },
    q6_1: { th: "ตรวจสอบสภาพทั่วไปของกล้องวงจรปิด", en: "General condition of CCTV cameras" },
    q6_2: { th: "ตรวจสอบสภาพทั่วไปเครื่องบันทึก (NVR)", en: "General condition of NVR" },
    q6_3: { th: "ตรวจสอบสถานะการใช้งาน", en: "Usage status check" },
    q6_4: { th: "ตรวจสอบมุมกล้อง", en: "Camera angle check" },
    q7: { th: "7) ตรวจสอบเราเตอร์ (Router)", en: "7) Router inspection" },
    q7_1: { th: "ตรวจสอบสภาพทั่วไป", en: "General condition check" },
    q7_2: { th: "ตรวจสอบสถานะการทำงาน", en: "Operation status check" },
    q8: { th: "8) ตรวจสอบตู้คอนซูเมอร์ยูนิต (Consumer Unit)", en: "8) Consumer Unit inspection" },
    q8_1: { th: "ตรวจสอบสภาพทั่วไป", en: "General condition check" },
    q8_2: { th: "ตรวจสอบจุดขันแน่น", en: "Tightening points check" },
    q9: { th: "9) ตรวจสอบแรงดันไฟฟ้า - เมนเบรกเกอร์ (Main Breaker)", en: "9) Voltage measurement - Main Breaker" },
    q10: { th: "10) ตรวจสอบแรงดันไฟฟ้า - เบรกเกอร์วงจรย่อย", en: "10) Voltage measurement - Sub-circuit Breakers" },
    q11: { th: "11) ทำความสะอาด", en: "11) Cleaning" },

    // Tooltips
    q1_tooltip: { th: "ตรวจสอบโครงสร้างภายนอกและภายในตู้ ความสะอาดของชั้นวางอุปกรณ์และการจัดระเบียบสายสัญญาณ", en: "Check external and internal cabinet structure, cleanliness of equipment shelves and cable organization" },
    q2_tooltip: { th: "ตรวจสอบสภาพดักซีลปิดหรืออุดตามรอยต่อและช่องทางเข้าสาย", en: "Check sealant condition at joints and cable entry points" },
    q3_tooltip: { th: "ตรวจสอบการทำงานของพัดลมระบายอากาศและความสะอาดของแผ่นกรองอากาศ", en: "Check ventilation fan operation and air filter cleanliness" },
    q4_tooltip: { th: "ตรวจสอบการทำงานของ Timer ที่ใช้ควบคุมระบบแสงสว่างภายในสถานี", en: "Check Timer operation that controls the station lighting system" },
    q5_tooltip: { th: "ตรวจสอบการทำงานของ UPS ในภาวะฉุกเฉิน (ระบบไฟฟ้าขัดข้อง)", en: "Check UPS operation during emergency (power failure)" },
    q6_tooltip: { th: "ตรวจสอบความคมชัดของกล้อง การบันทึกข้อมูลของเครื่องบันทึก (NVR) และมุมมองภาพต้องครอบคลุมพื้นที่การใช้งานสถานี", en: "Check camera clarity, NVR recording status, and ensure camera angles cover the station service area" },
    q7_tooltip: { th: "ตรวจสอบการทำงานของ Router, สถานะไฟกระพริบเมื่อเชื่อมต่อโครงข่ายและตรวจสอบความร้อนของอุปกรณ์", en: "Check Router operation, blinking status lights when connected to network, and device temperature" },
    q8_tooltip: { th: "ตรวจสอบความสมบูรณ์ของกล่อง Consumer Unit การยึดแน่นของอุปกรณ์และการระบุชื่อวงจรไฟฟ้า (Labeling)", en: "Check Consumer Unit box integrity, equipment tightness, and circuit labeling" },
    q9_tooltip: { th: "วัดค่าแรงดันไฟฟ้าด้าน Input ของตู้ Consumer Unit", en: "Measure input voltage of Consumer Unit cabinet" },
    q10_tooltip: { th: "วัดแรงดันไฟฟ้าขาออกของเบรกเกอร์ทุกลูก (Lighting, CCTV, Network)", en: "Measure output voltage of all breakers (Lighting, CCTV, Network)" },
    q11_tooltip: { th: "ทำความสะอาดโดยการขจัดฝุ่นและสิ่งสกปรกภายในตู้ด้วยเครื่องดูดฝุ่นหรือเป่าลมแห้ง", en: "Clean by removing dust and dirt inside the cabinet using vacuum cleaner or dry air blower" },

    // Breakers
    mainBreaker: { th: "เมนเบรกเกอร์ (Main Breaker)", en: "Main Breaker" },
    subBreaker: { th: "เบรกเกอร์วงจรย่อยตัวที่", en: "Sub-circuit Breaker" },
    subBreaker1: { th: "เบรกเกอร์วงจรย่อยที่ 1", en: "Sub-circuit Breaker 1" },
    subBreaker2: { th: "เบรกเกอร์วงจรย่อยที่ 2", en: "Sub-circuit Breaker 2" },
    subBreaker3: { th: "เบรกเกอร์วงจรย่อยที่ 3", en: "Sub-circuit Breaker 3" },
    subBreaker4: { th: "เบรกเกอร์วงจรย่อยที่ 4", en: "Sub-circuit Breaker 4" },
    subBreaker5: { th: "เบรกเกอร์วงจรย่อยที่ 5", en: "Sub-circuit Breaker 5" },
    subBreaker6: { th: "เบรกเกอร์วงจรย่อยที่ 6", en: "Sub-circuit Breaker 6" },
    addSubBreaker: { th: "เพิ่ม", en: "Add" },
    removeSubBreaker: { th: "ลบ", en: "Remove" },
    maxSubBreakers: { th: "สูงสุด 6 ตัว", en: "Max 6 breakers" },
    subBreakerCount: { th: "จำนวนเบรกเกอร์วงจรย่อย:", en: "Sub-circuit Breakers:" },

    // Units
    unit: { th: "ตัว", en: "units" },

    // Suffixes
    prePmSuffix: { th: "(ก่อน PM)", en: "(Pre-PM)" },
    postPmSuffix: { th: "(หลัง PM)", en: "(Post-PM)" },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

// Helper functions to generate scroll IDs
const ID_PREFIX = "ccb-pm";

// Convert CCB photo key number to formatted string (e.g., 101 → "10-1", 31 → "3-1", 90 → "9")
const formatPhotoKeyNumber = (key: number): string => {
    if (key === 90) return "9";
    if (key >= 101 && key <= 106) return `10-${key - 100}`;
    if (key >= 30 && key < 90) return `${Math.floor(key / 10)}-${key % 10}`;
    return String(key);
};

const getPhotoIdFromKey = (key: string | number): string => {
    if (typeof key === "number") return `${ID_PREFIX}-photo-${formatPhotoKeyNumber(key)}`;
    const match = String(key).match(/^r(\d+)(?:_(\d+))?$/);
    if (match) {
        const [, qNo, subNo] = match;
        return subNo ? `${ID_PREFIX}-photo-${qNo}-${subNo}` : `${ID_PREFIX}-photo-${qNo}`;
    }
    return `${ID_PREFIX}-photo-${key}`;
};

const getRemarkIdFromKey = (key: string | number): string => {
    if (typeof key === "number") return `${ID_PREFIX}-remark-${key}`;
    // Handle r9_main
    if (key === "r9_main") return `${ID_PREFIX}-remark-9`;
    // Handle r10_sub1, r10_sub2, etc.
    const subMatch = String(key).match(/^r10_sub(\d+)$/);
    if (subMatch) return `${ID_PREFIX}-remark-10-${subMatch[1]}`;
    // Handle regular keys like r1, r3_1, r3_2
    const match = String(key).match(/^r(\d+)(?:_(\d+))?$/);
    if (match) {
        const [, qNo, subNo] = match;
        return subNo ? `${ID_PREFIX}-remark-${qNo}-${subNo}` : `${ID_PREFIX}-remark-${qNo}`;
    }
    return `${ID_PREFIX}-remark-${key}`;
};

const getInputIdFromKey = (key: string | number, subIdx?: number): string => {
    if (typeof key === "number") return subIdx ? `${ID_PREFIX}-input-${key}-${subIdx}` : `${ID_PREFIX}-input-${key}`;
    // Handle r9_main
    if (key === "r9_main") return `${ID_PREFIX}-input-9`;
    // Handle r10_sub1, r10_sub2, etc.
    const subMatch = String(key).match(/^r10_sub(\d+)$/);
    if (subMatch) return `${ID_PREFIX}-input-10-${subMatch[1]}`;
    // Handle regular keys like r1, r3_1, r3_2
    const match = String(key).match(/^r(\d+)(?:_(\d+))?$/);
    if (match) {
        const [, qNo, subNo] = match;
        return subNo ? `${ID_PREFIX}-input-${qNo}-${subNo}` : `${ID_PREFIX}-input-${qNo}`;
    }
    return `${ID_PREFIX}-input-${key}`;
};

const getPfIdFromKey = (key: string | number): string => {
    if (typeof key === "number") return `${ID_PREFIX}-pf-${key}`;
    // Handle r9_main
    if (key === "r9_main") return `${ID_PREFIX}-pf-9`;
    // Handle r10_sub1, r10_sub2, etc.
    const subMatch = String(key).match(/^r10_sub(\d+)$/);
    if (subMatch) return `${ID_PREFIX}-pf-10-${subMatch[1]}`;
    // Handle regular keys like r1, r3_1, r3_2
    const match = String(key).match(/^r(\d+)(?:_(\d+))?$/);
    if (match) {
        const [, qNo, subNo] = match;
        return subNo ? `${ID_PREFIX}-pf-${qNo}-${subNo}` : `${ID_PREFIX}-pf-${qNo}`;
    }
    return `${ID_PREFIX}-pf-${key}`;
};

type TabId = "pre" | "post";
const TABS: { id: TabId; label: string; slug: "pre" | "post" }[] = [
    { id: "pre", label: "Pre\u2011PM", slug: "pre" },
    { id: "post", label: "Post\u2011PM", slug: "post" },
];

function slugToTab(slug: string | null): TabId {
    switch (slug) { case "post": return "post"; case "pre": default: return "pre"; }
}
function tabToSlug(tab: TabId): "pre" | "post" { return TABS.find(t => t.id === tab)!.slug; }

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const LOGO_SRC = "/img/logo_egat.png";

type StationPublic = { station_id: string; station_name: string; status?: boolean; };
type Me = { id: string; username: string; email: string; role: string; company: string; tel: string; };

async function getStationInfoPublic(stationId: string): Promise<StationPublic> {
    const url = `${API_BASE}/station/info/public?station_id=${encodeURIComponent(stationId)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) throw new Error("Station not found");
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const json = await res.json();
    return json.station ?? json;
}

const UNITS = { voltage: ["V"] as const };
type UnitVoltage = (typeof UNITS.voltage)[number];

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

type PF = "PASS" | "FAIL" | "NA" | "";

const VOLTAGE_FIELDS_CCB = ["L-N", "L-G", "N-G"] as const;
const LABELS: Record<string, string> = {
    "L-N": "L-N", "L-G": "L-G", "N-G": "N-G"
};

type Question =
    | { no: number; key: string; labelKey: keyof typeof T; kind: "simple"; hasPhoto?: boolean; tooltipKey?: keyof typeof T }
    | { no: number; key: string; labelKey: keyof typeof T; kind: "group"; items: { key: string; labelKey: keyof typeof T }[]; hasPhoto?: boolean; tooltipKey?: keyof typeof T }
    | { no: number; key: string; labelKey: keyof typeof T; kind: "mainBreaker"; hasPhoto?: boolean; tooltipKey?: keyof typeof T }
    | { no: number; key: string; labelKey: keyof typeof T; kind: "subBreakers"; hasPhoto?: boolean; tooltipKey?: keyof typeof T };

const QUESTIONS: Question[] = [
    { no: 1, key: "r1", labelKey: "q1", kind: "simple", hasPhoto: true, tooltipKey: "q1_tooltip" },
    { no: 2, key: "r2", labelKey: "q2", kind: "simple", hasPhoto: true, tooltipKey: "q2_tooltip" },
    {
        no: 3, key: "r3", labelKey: "q3", kind: "group", hasPhoto: true, tooltipKey: "q3_tooltip",
        items: [
            { key: "r3_1", labelKey: "q3_1" },
            { key: "r3_2", labelKey: "q3_2" },
        ],
    },
    {
        no: 4, key: "r4", labelKey: "q4", kind: "group", hasPhoto: true, tooltipKey: "q4_tooltip",
        items: [
            { key: "r4_1", labelKey: "q4_1" },
            { key: "r4_2", labelKey: "q4_2" },
        ],
    },
    {
        no: 5, key: "r5", labelKey: "q5", kind: "group", hasPhoto: true, tooltipKey: "q5_tooltip",
        items: [
            { key: "r5_1", labelKey: "q5_1" },
            { key: "r5_2", labelKey: "q5_2" },
        ],
    },
    {
        no: 6, key: "r6", labelKey: "q6", kind: "group", hasPhoto: true, tooltipKey: "q6_tooltip",
        items: [
            { key: "r6_1", labelKey: "q6_1" },
            { key: "r6_2", labelKey: "q6_2" },
            { key: "r6_3", labelKey: "q6_3" },
            { key: "r6_4", labelKey: "q6_4" },
        ],
    },
    {
        no: 7, key: "r7", labelKey: "q7", kind: "group", hasPhoto: true, tooltipKey: "q7_tooltip",
        items: [
            { key: "r7_1", labelKey: "q7_1" },
            { key: "r7_2", labelKey: "q7_2" },
        ],
    },
    {
        no: 8, key: "r8", labelKey: "q8", kind: "group", hasPhoto: true, tooltipKey: "q8_tooltip",
        items: [
            { key: "r8_1", labelKey: "q8_1" },
            { key: "r8_2", labelKey: "q8_2" },
        ],
    },
    { no: 9, key: "r9", labelKey: "q9", kind: "mainBreaker", hasPhoto: true, tooltipKey: "q9_tooltip" },
    { no: 10, key: "r10", labelKey: "q10", kind: "subBreakers", hasPhoto: true, tooltipKey: "q10_tooltip" },
    { no: 11, key: "r11", labelKey: "q11", kind: "simple", hasPhoto: true, tooltipKey: "q11_tooltip" },
];

function getQuestionLabel(q: Question, mode: TabId, lang: Lang): string {
    const baseLabel = t(q.labelKey, lang);
    if (mode === "pre") return lang === "th" ? `${baseLabel} (ก่อน PM)` : `${baseLabel} (Pre-PM)`;
    return lang === "th" ? `${baseLabel} (หลัง PM)` : `${baseLabel} (Post-PM)`;
}

type MeasureRow<U extends string> = { value: string; unit: U };
type MeasureState<U extends string> = Record<string, MeasureRow<U>>;

function initMeasureState<U extends string>(keys: readonly string[], defaultUnit: U): MeasureState<U> {
    return keys.reduce((acc, k) => { acc[k] = { value: "", unit: defaultUnit }; return acc; }, {} as MeasureState<U>);
}

function useMeasure<U extends string>(keys: readonly string[], defaultUnit: U) {
    const [state, setState] = useState<MeasureState<U>>(() => initMeasureState(keys, defaultUnit));
    const patch = (key: string, patch: Partial<MeasureRow<U>>) => setState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    const syncUnits = (newUnit: U) => setState((prev) => { const next: MeasureState<U> = { ...prev }; keys.forEach((k) => (next[k] = { ...prev[k], unit: newUnit })); return next; });
    return { state, setState, patch, syncUnits };
}

function useDebouncedEffect(effect: () => void, deps: any[], delay = 800) {
    useEffect(() => { const h = setTimeout(effect, delay); return () => clearTimeout(h); }, deps);
}

function SectionCard({ title, subtitle, children, tooltip }: { title?: string; subtitle?: string; children: React.ReactNode; tooltip?: string }) {
    // Extract question number from title (e.g., "1) ตรวจสอบ..." -> "1")
    const qNumber = title?.match(/^(\d+)\)/)?.[1];
    
    return (
        <div className="tw-bg-white tw-rounded-xl tw-border tw-border-gray-200 tw-shadow-sm tw-overflow-hidden">
            {/* Header with number badge - Dark theme */}
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
            {/* Content */}
            <div className="tw-p-3 sm:tw-p-4 tw-space-y-3 sm:tw-space-y-4">{children}</div>
        </div>
    );
}

function Section({ title, ok, children, lang }: { title: React.ReactNode; ok: boolean; children?: React.ReactNode; lang: Lang }) {
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

// ==================== PMValidationCard Component ====================
interface ValidationError {
    section: string;
    sectionIcon: string;
    itemName: string;
    message: string;
    scrollId?: string;
}

function groupErrorsBySection(errors: ValidationError[]): Map<string, ValidationError[]> {
    const map = new Map<string, ValidationError[]>();
    errors.forEach((err) => {
        const key = `${err.sectionIcon} ${err.section}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(err);
    });
    return map;
}

interface MissingInputItem {
    qNo: number;
    subNo?: number;
    label: string;
    fieldKey: string;
}

interface PMValidationCardProps {
    lang: Lang;
    displayTab: "pre" | "post";
    isPostMode: boolean;
    allPhotosAttached: boolean;
    missingPhotoItems: string[];
    allRequiredInputsFilled: boolean;
    missingInputsDetailed: MissingInputItem[];
    allRemarksFilledPre: boolean;
    missingRemarksPre: string[];
    allPFAnsweredPost: boolean;
    missingPFItemsPost: string[];
    allRemarksFilledPost: boolean;
    missingRemarksPost: string[];
    isSummaryFilled: boolean;
    isSummaryCheckFilled: boolean;
}

function PMValidationCard({
    lang, displayTab, isPostMode,
    allPhotosAttached, missingPhotoItems,
    allRequiredInputsFilled, missingInputsDetailed,
    allRemarksFilledPre, missingRemarksPre,
    allPFAnsweredPost, missingPFItemsPost,
    allRemarksFilledPost, missingRemarksPost,
    isSummaryFilled, isSummaryCheckFilled,
}: PMValidationCardProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    const handleHeaderClick = () => {
        setIsExpanded(!isExpanded);
    };

    const getPhotoScrollId = (item: string): string => {
        const parts = item.split('.');
        if (parts.length === 2) return `${ID_PREFIX}-photo-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-photo-${parts[0]}`;
    };

    const getRemarkScrollId = (item: string): string => {
        const parts = item.split('.');
        if (parts.length === 2) return `${ID_PREFIX}-remark-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-remark-${parts[0]}`;
    };

    const getPfButtonsScrollId = (item: string): string => {
        const parts = item.split('.');
        if (parts.length === 2) return `${ID_PREFIX}-pf-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-pf-${parts[0]}`;
    };

    const allErrors: ValidationError[] = useMemo(() => {
        const errors: ValidationError[] = [];

        // 1) Photo errors
        if (!allPhotosAttached) {
            missingPhotoItems.forEach((item) => {
                errors.push({
                    section: lang === "th" ? "รูปภาพ" : "Photos",
                    sectionIcon: "📷",
                    itemName: `${t("itemLabel", lang)} ${item}`,
                    message: lang === "th" ? "ยังไม่ได้แนบรูป" : "Photo not attached",
                    scrollId: getPhotoScrollId(item),
                });
            });
        }

        // 2) Input errors
        if (!allRequiredInputsFilled) {
            missingInputsDetailed.forEach(({ qNo, subNo, label }) => {
                const scrollId = subNo ? `${ID_PREFIX}-input-${qNo}-${subNo}` : `${ID_PREFIX}-input-${qNo}`;
                const itemDisplay = subNo ? `${qNo}.${subNo}` : `${qNo}`;
                const message = lang === "th" ? `ยังไม่ได้กรอกค่า ${label}` : `${label} value not filled`;
                errors.push({
                    section: lang === "th" ? "ค่าที่ต้องกรอก" : "Required Inputs",
                    sectionIcon: "📝",
                    itemName: `${t("itemLabel", lang)} ${itemDisplay}`,
                    message,
                    scrollId,
                });
            });
        }

        // 3) Remark errors (Pre mode)
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

        // 4) Post mode errors
        if (isPostMode) {
            // PF status errors
            if (!allPFAnsweredPost) {
                missingPFItemsPost.forEach((item) => {
                    errors.push({
                        section: lang === "th" ? "สถานะ Pass/Fail" : "Pass/Fail Status",
                        sectionIcon: "✅",
                        itemName: `${t("itemLabel", lang)} ${item}`,
                        message: lang === "th" ? "ยังไม่ได้เลือก Pass/Fail" : "Pass/Fail not selected",
                        scrollId: getPfButtonsScrollId(item),
                    });
                });
            }

            // Remark errors (Post mode)
            if (!allRemarksFilledPost) {
                missingRemarksPost.forEach((item) => {
                    errors.push({
                        section: lang === "th" ? "หมายเหตุ (Post)" : "Remarks (Post)",
                        sectionIcon: "💬",
                        itemName: `${t("itemLabel", lang)} ${item}`,
                        message: lang === "th" ? "ยังไม่ได้กรอกหมายเหตุ" : "Remark not filled",
                        scrollId: getRemarkScrollId(item),
                    });
                });
            }

            // Summary errors
            if (!isSummaryFilled) {
                errors.push({
                    section: lang === "th" ? "สรุปผล" : "Summary",
                    sectionIcon: "📋",
                    itemName: "Comment",
                    message: lang === "th" ? "ยังไม่ได้กรอก Comment" : "Comment not filled",
                    scrollId: `${ID_PREFIX}-summary-section`,
                });
            }
            if (!isSummaryCheckFilled) {
                errors.push({
                    section: lang === "th" ? "สรุปผล" : "Summary",
                    sectionIcon: "📋",
                    itemName: lang === "th" ? "สถานะสรุป" : "Summary Status",
                    message: lang === "th" ? "ยังไม่ได้เลือก Pass/Fail/N/A" : "Status not selected",
                    scrollId: `${ID_PREFIX}-summary-section`,
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

    const scrollToItem = (scrollId?: string) => {
        if (!scrollId) return;
        const element = document.getElementById(scrollId);
        if (element) {
            const rect = element.getBoundingClientRect();
            const elementTop = rect.top + window.scrollY;
            const elementHeight = rect.height;
            const viewportHeight = window.innerHeight;
            let targetScrollY = elementTop - (viewportHeight / 2) + (elementHeight / 2);
            targetScrollY = Math.max(0, targetScrollY);
            const maxScrollY = document.documentElement.scrollHeight - viewportHeight;
            targetScrollY = Math.min(targetScrollY, maxScrollY);
            window.scrollTo({ top: targetScrollY, behavior: "smooth" });
            element.classList.add("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50");
            setTimeout(() => {
                element.classList.remove("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50");
            }, 2000);
        }
    };

    return (
        <div className={`tw-rounded-xl tw-border tw-shadow-sm tw-overflow-hidden ${isComplete ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
            <div className={`tw-px-4 tw-py-3 tw-cursor-pointer tw-flex tw-items-center tw-justify-between ${isComplete ? "tw-bg-green-100" : "tw-bg-amber-100"}`} onClick={handleHeaderClick}>
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
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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
                    {!isComplete && (
                        <div className="tw-hidden md:tw-flex tw-items-center tw-gap-2">
                            {Array.from(groupedErrors.keys()).map((sectionKey) => (
                                <span key={sectionKey} className="tw-text-xs tw-bg-amber-200 tw-text-amber-800 tw-px-2 tw-py-1 tw-rounded-full tw-font-medium">
                                    {sectionKey.split(" ")[0]} {groupedErrors.get(sectionKey)?.length}
                                </span>
                            ))}
                        </div>
                    )}
                    {!isComplete && (
                        <svg className={`tw-w-6 tw-h-6 tw-text-amber-600 tw-transition-transform ${isExpanded ? "tw-rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    )}
                </div>
            </div>
            {isExpanded && !isComplete && (
                <div className="tw-px-4 tw-py-3 tw-max-h-80 tw-overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="tw-space-y-4">
                        {Array.from(groupedErrors.entries()).map(([sectionKey, sectionErrors]) => (
                            <div key={sectionKey} className="tw-bg-white tw-rounded-lg tw-p-3 tw-border tw-border-amber-200">
                                <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
                                    <Typography className="tw-font-semibold tw-text-gray-800 tw-text-sm">{sectionKey}</Typography>
                                    <span className="tw-text-xs tw-bg-amber-100 tw-text-amber-700 tw-px-2 tw-py-0.5 tw-rounded-full">
                                        {sectionErrors.length} {t("items", lang)}
                                    </span>
                                </div>
                                <ul className="tw-space-y-1 tw-max-h-40 tw-overflow-y-auto">
                                    {sectionErrors.map((error, idx) => (
                                        <li key={idx} className="tw-flex tw-items-start tw-gap-2 tw-text-sm tw-text-amber-700 tw-cursor-pointer hover:tw-text-amber-900 hover:tw-bg-amber-50 tw-rounded tw-px-1 tw-py-0.5 tw-transition-colors" onClick={(e) => { e.stopPropagation(); scrollToItem(error.scrollId); }}>
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

function InputWithUnit<U extends string>({ label, value, unit, units, onValueChange, onUnitChange, readOnly, disabled, labelOnTop, required = true }: {
    label: string; value: string; unit: U; units: readonly U[]; onValueChange: (v: string) => void; onUnitChange: (u: U) => void; readOnly?: boolean; disabled?: boolean; labelOnTop?: boolean; required?: boolean;
}) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        // อนุญาตให้กรอก: ว่าง, เครื่องหมายลบ, ตัวเลข, จุดทศนิยม
        if (newValue === "" || /^-?\d*\.?\d*$/.test(newValue)) {
            onValueChange(newValue);
        }
    };

    return (
        <div className="tw-space-y-1">
            <div className="tw-flex tw-items-center tw-gap-2">
                <div className="tw-flex-1 tw-relative">
                    <input 
                        type="text" 
                        inputMode="numeric"
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
        </div>
    );
}

function PassFailRow({ label, value, onChange, remark, onRemarkChange, labels, aboveRemark, beforeRemark, inlineLeft, lang, id, remarkId }: {
    label: string; value: PF; onChange: (v: Exclude<PF, "">) => void; remark?: string; onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>; aboveRemark?: React.ReactNode; beforeRemark?: React.ReactNode; inlineLeft?: React.ReactNode; lang: Lang; id?: string; remarkId?: string;
}) {
    const text = { PASS: labels?.PASS ?? t("pass", lang), FAIL: labels?.FAIL ?? t("fail", lang), NA: labels?.NA ?? t("na", lang) };
    const buttonGroup = (
        <div id={id} className="tw-flex tw-gap-1.5 sm:tw-gap-2 tw-flex-wrap sm:tw-flex-nowrap tw-justify-end sm:tw-justify-start">
            <Button size="sm" color="green" variant={value === "PASS" ? "filled" : "outlined"} className="tw-min-w-[56px] sm:tw-min-w-[72px] lg:tw-min-w-[84px] tw-text-[10px] sm:tw-text-xs lg:tw-text-sm tw-px-2 sm:tw-px-3 tw-py-1.5 sm:tw-py-2" onClick={() => onChange("PASS")}>{text.PASS}</Button>
            <Button size="sm" color="red" variant={value === "FAIL" ? "filled" : "outlined"} className="tw-min-w-[56px] sm:tw-min-w-[72px] lg:tw-min-w-[84px] tw-text-[10px] sm:tw-text-xs lg:tw-text-sm tw-px-2 sm:tw-px-3 tw-py-1.5 sm:tw-py-2" onClick={() => onChange("FAIL")}>{text.FAIL}</Button>
            <Button size="sm" color="blue-gray" variant={value === "NA" ? "filled" : "outlined"} className="tw-min-w-[56px] sm:tw-min-w-[72px] lg:tw-min-w-[84px] tw-text-[10px] sm:tw-text-xs lg:tw-text-sm tw-px-2 sm:tw-px-3 tw-py-1.5 sm:tw-py-2" onClick={() => onChange("NA")}>{text.NA}</Button>
        </div>
    );
    const buttonsRow = (<div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-stretch sm:tw-items-center tw-gap-2 sm:tw-gap-3 tw-w-full">{inlineLeft && <div className="tw-flex tw-items-center tw-gap-2">{inlineLeft}</div>}<div className="tw-ml-auto">{buttonGroup}</div></div>);
    return (
        <div className="tw-space-y-2 sm:tw-space-y-3 tw-py-2 sm:tw-py-3">
            <Typography className="tw-font-medium tw-text-xs sm:tw-text-sm lg:tw-text-base">{label}</Typography>
            {onRemarkChange ? (
                <div className="tw-w-full tw-min-w-0 tw-space-y-2">{aboveRemark}{buttonsRow}{beforeRemark}<div id={remarkId}><Textarea label={t("remark", lang)} value={remark || ""} onChange={(e) => onRemarkChange(e.target.value)} containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full !tw-text-xs sm:!tw-text-sm" /></div></div>
            ) : (<div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">{buttonsRow}</div>)}
        </div>
    );
}

function PhotoMultiInput({ photos, setPhotos, max = 10, draftKey, qNo, lang, id }: { photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>; max?: number; draftKey: string; qNo: number; lang: Lang; id?: string; }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const handlePick = () => fileRef.current?.click();
    const handleFiles = async (list: FileList | null) => {
        if (!list) return;
        const remain = Math.max(0, max - photos.length);
        const files = Array.from(list).slice(0, remain);
        const items: PhotoItem[] = await Promise.all(files.map(async (f, i) => { const photoId = `${qNo}-${Date.now()}-${i}-${f.name}`; const ref = await putPhoto(draftKey, photoId, f); return { id: photoId, file: f, preview: URL.createObjectURL(f), remark: "", ref }; }));
        setPhotos((prev) => [...prev, ...items]);
        if (fileRef.current) fileRef.current.value = "";
    };
    const handleRemove = async (id: string) => { await delPhoto(draftKey, id); setPhotos((prev) => { const target = prev.find((p) => p.id === id); if (target?.preview) URL.revokeObjectURL(target.preview); return prev.filter((p) => p.id !== id); }); };
    return (
        <div id={id} className="tw-space-y-2 sm:tw-space-y-3 tw-transition-all tw-duration-300">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2"><Button size="sm" color="blue" variant="outlined" onClick={handlePick} className="tw-shrink-0 tw-text-[10px] sm:tw-text-xs lg:tw-text-sm tw-px-2 sm:tw-px-3 tw-py-1.5 sm:tw-py-2">{t("attachPhoto", lang)}</Button></div>
            <Typography variant="small" className="!tw-text-blue-gray-500 tw-flex tw-items-center tw-flex-wrap tw-text-[10px] sm:tw-text-xs">{t("maxPhotos", lang)} {max} {t("photos", lang)} • {t("cameraSupported", lang)}</Typography>
            <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="tw-hidden" onChange={(e) => { void handleFiles(e.target.files); }} />
            {photos.length > 0 ? (
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-2 sm:tw-gap-3">
                    {photos.map((p) => (<div key={p.id} className="tw-border tw-rounded-lg tw-overflow-hidden tw-bg-white tw-shadow-xs tw-flex tw-flex-col"><div className="tw-relative tw-aspect-[4/3] tw-bg-blue-gray-50">{p.preview && <img src={p.preview} alt="preview" className="tw-w-full tw-h-full tw-object-cover" />}<button onClick={() => { void handleRemove(p.id); }} className="tw-absolute tw-top-1.5 tw-right-1.5 sm:tw-top-2 sm:tw-right-2 tw-bg-red-500 tw-text-white tw-w-5 tw-h-5 sm:tw-w-6 sm:tw-h-6 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-shadow-md hover:tw-bg-red-600 tw-transition-colors tw-text-xs sm:tw-text-sm">×</button></div></div>))}
                </div>
            ) : (<Typography variant="small" className="!tw-text-blue-gray-500 tw-text-xs sm:tw-text-sm">{t("noPhotos", lang)}</Typography>)}
        </div>
    );
}

function SkippedNAItem({ label, remark, lang }: { label: string; remark?: string; lang: Lang }) {
    return (
        <div className="tw-p-3 sm:tw-p-3 sm:tw-p-4 tw-rounded-lg tw-border tw-bg-amber-50 tw-border-amber-200">
            <div className="tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-center sm:tw-justify-between tw-gap-1 sm:tw-gap-2">
                <Typography className="tw-font-semibold tw-text-xs sm:tw-text-sm tw-text-blue-gray-800">{label}</Typography>
                {remark && (<Typography variant="small" className="tw-text-blue-gray-600 tw-text-[10px] sm:tw-text-xs">{t("remarkLabel", lang)} - {remark}</Typography>)}
            </div>
        </div>
    );
}

async function fetchPreviewIssueId(stationId: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/ccbpmreport/preview-issueid`); u.searchParams.set("station_id", stationId); u.searchParams.set("pm_date", pmDate);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
    const r = await fetch(u.toString(), { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!r.ok) return null; const j = await r.json(); return (j && typeof j.issue_id === "string") ? j.issue_id : null;
}

async function fetchPreviewDocName(stationId: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/ccbpmreport/preview-docname`); u.searchParams.set("station_id", stationId); u.searchParams.set("pm_date", pmDate);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
    const r = await fetch(u.toString(), { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!r.ok) return null; const j = await r.json(); return (j && typeof j.doc_name === "string") ? j.doc_name : null;
}

async function fetchReport(reportId: string, stationId: string) {
    const token = localStorage.getItem("access_token") ?? "";
    const url = `${API_BASE}/ccbpmreport/get?station_id=${stationId}&report_id=${reportId}`;
    const res = await fetch(url, { method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

function getTodayLocalStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// Helper to get all row keys for a question
function getRowKeysForQuestion(q: Question, subBreakerCount?: number): string[] {
    if (q.kind === "simple") return [q.key];
    if (q.kind === "group") return q.items.map(it => it.key);
    if (q.kind === "mainBreaker") return ["r9_main"];
    if (q.kind === "subBreakers") {
        const count = subBreakerCount ?? 1;
        return Array.from({ length: count }, (_, i) => `r10_sub${i + 1}`);
    }
    return [];
}

// Helper to get photo key for a question/sub-item
function getPhotoKeyForQuestion(q: Question, subKey?: string): number {
    if (q.kind === "mainBreaker") return 90; // r9_main -> 90
    if (q.kind === "subBreakers" && subKey) {
        const match = subKey.match(/r10_sub(\d+)/);
        if (match) return 100 + parseInt(match[1], 10); // r10_sub1 -> 101, r10_sub2 -> 102, etc.
    }
    if (q.kind === "group" && subKey) {
        const match = subKey.match(/r(\d+)_(\d+)/);
        if (match) {
            return parseInt(match[1], 10) * 10 + parseInt(match[2], 10); // r3_1 -> 31, r3_2 -> 32
        }
    }
    return q.no;
}

export default function CCBPMReport() {
    const { lang } = useLanguage();
    const [me, setMe] = useState<Me | null>(null);
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [docName, setDocName] = useState<string>("");
    const [reportId, setReportId] = useState<string>("");

    const pathname = usePathname();
    const searchParams = useSearchParams();
    const editId = searchParams.get("edit_id") ?? "";
    const action = searchParams.get("action");
    const isPostMode = action === "post";

    const PM_PREFIX = "ccbpmreport";

    const BREAKERS = useMemo(() => [
        t("mainBreaker", lang),
        t("subBreaker1", lang),
        t("subBreaker2", lang),
        t("subBreaker3", lang),
        t("subBreaker4", lang),
        t("subBreaker5", lang),
    ], [lang]);

    // Initialize photos with numeric keys
    const initialPhotos: Record<number, PhotoItem[]> = useMemo(() => {
        const result: Record<number, PhotoItem[]> = {};
        QUESTIONS.forEach((q) => {
            if (!q.hasPhoto) return;
            if (q.kind === "simple") {
                result[q.no] = [];
            } else if (q.kind === "group") {
                q.items.forEach((item) => {
                    const photoKey = getPhotoKeyForQuestion(q, item.key);
                    result[photoKey] = [];
                });
            } else if (q.kind === "mainBreaker") {
                result[90] = []; // Main breaker photo key
            } else if (q.kind === "subBreakers") {
                // Initialize photo slots for up to 6 sub breakers
                for (let i = 1; i <= 6; i++) {
                    result[100 + i] = [];
                }
            }
        });
        return result;
    }, []);

    const [photos, setPhotos] = useState<Record<number, PhotoItem[]>>(initialPhotos);
    const [summary, setSummary] = useState<string>("");
    const [stationId, setStationId] = useState<string | null>(null);

    const key = useMemo(() => draftKey(stationId), [stationId]);
    const postKey = useMemo(() => `${draftKey(stationId)}:${editId}:post`, [stationId, editId]);
    const currentDraftKey = isPostMode ? postKey : key;

    useEffect(() => { if (typeof window === "undefined") return; const params = new URLSearchParams(window.location.search); if (params.has("draft_id")) { params.delete("draft_id"); const url = `${window.location.pathname}?${params.toString()}`; window.history.replaceState({}, "", url); } }, []);

    const [summaryCheck, setSummaryCheck] = useState<PF>("");
    const [inspector, setInspector] = useState<string>("");
    const [postApiLoaded, setPostApiLoaded] = useState(false);
    const [commentPre, setCommentPre] = useState<string>("");

    const [job, setJob] = useState({ issue_id: "", station_name: "", date: getTodayLocalStr() });
    const [rowsPre, setRowsPre] = useState<Record<string, { pf: PF; remark: string }>>({});
    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(() => {
        const initial: Record<string, { pf: PF; remark: string }> = {};
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") {
                initial[q.key] = { pf: "", remark: "" };
            } else if (q.kind === "group") {
                q.items.forEach((item) => {
                    initial[item.key] = { pf: "", remark: "" };
                });
            } else if (q.kind === "mainBreaker") {
                initial["r9_main"] = { pf: "", remark: "" };
            } else if (q.kind === "subBreakers") {
                // Initialize with 1 sub-breaker by default
                initial["r10_sub1"] = { pf: "", remark: "" };
            }
        });
        return initial;
    });

    // Main Breaker (Q9) - single breaker
    const mMain = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const [mMainPre, setMMainPre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));

    // Sub Breakers (Q10) - dynamic, max 6
    const [subBreakerCount, setSubBreakerCount] = useState<number>(1);
    const mSub1 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const mSub2 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const mSub3 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const mSub4 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const mSub5 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const mSub6 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const M_SUB_LIST = [mSub1, mSub2, mSub3, mSub4, mSub5, mSub6];

    const [mSub1Pre, setMSub1Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
    const [mSub2Pre, setMSub2Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
    const [mSub3Pre, setMSub3Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
    const [mSub4Pre, setMSub4Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
    const [mSub5Pre, setMSub5Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
    const [mSub6Pre, setMSub6Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
    const M_SUB_PRE_SETTERS = [setMSub1Pre, setMSub2Pre, setMSub3Pre, setMSub4Pre, setMSub5Pre, setMSub6Pre];
    const M_SUB_PRE_LIST = [mSub1Pre, mSub2Pre, mSub3Pre, mSub4Pre, mSub5Pre, mSub6Pre];

    // Add sub breaker
    const addSubBreaker = () => {
        if (subBreakerCount >= 6) return;
        const newCount = subBreakerCount + 1;
        setSubBreakerCount(newCount);
        const newKey = `r10_sub${newCount}`;
        setRows(prev => ({ ...prev, [newKey]: { pf: "", remark: "" } }));
    };

    // Remove sub breaker
    const removeSubBreaker = (idx: number) => {
        if (subBreakerCount <= 1) return;
        const keyToRemove = `r10_sub${idx}`;
        // Shift remaining breakers
        setRows(prev => {
            const next = { ...prev };
            delete next[keyToRemove];
            // Renumber remaining sub breakers
            for (let i = idx; i < subBreakerCount; i++) {
                const oldKey = `r10_sub${i + 1}`;
                const newKey = `r10_sub${i}`;
                if (next[oldKey]) {
                    next[newKey] = next[oldKey];
                    delete next[oldKey];
                }
            }
            return next;
        });
        // Shift measure states
        for (let i = idx - 1; i < subBreakerCount - 1; i++) {
            if (i + 1 < M_SUB_LIST.length) {
                M_SUB_LIST[i].setState(M_SUB_LIST[i + 1].state);
            }
        }
        // Clear last one
        if (subBreakerCount - 1 < M_SUB_LIST.length) {
            M_SUB_LIST[subBreakerCount - 1].setState(initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        }
        // Shift photos
        setPhotos(prev => {
            const next = { ...prev };
            for (let i = idx; i < subBreakerCount; i++) {
                const oldKey = 100 + i + 1;
                const newKey = 100 + i;
                if (next[oldKey]) {
                    next[newKey] = next[oldKey];
                    delete next[oldKey];
                }
            }
            return next;
        });
        setSubBreakerCount(subBreakerCount - 1);
    };

    // Helper function to flatten rows
    const flattenRows = (inputRows: Record<string, any>, currentSubBreakerCount: number): Record<string, { pf: PF; remark: string }> => {
        const result: Record<string, { pf: PF; remark: string }> = {};
        const validKeys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") validKeys.push(q.key);
            else if (q.kind === "group") q.items.forEach((item) => validKeys.push(item.key));
            else if (q.kind === "mainBreaker") validKeys.push("r9_main");
            else if (q.kind === "subBreakers") {
                for (let i = 1; i <= currentSubBreakerCount; i++) validKeys.push(`r10_sub${i}`);
            }
        });

        for (const key of validKeys) {
            if (inputRows[key] && typeof inputRows[key] === "object") {
                result[key] = { pf: inputRows[key].pf ?? "", remark: inputRows[key].remark ?? "" };
            }
        }

        for (const [parentKey, parentValue] of Object.entries(inputRows)) {
            if (typeof parentValue === "object" && parentValue !== null) {
                for (const [childKey, childValue] of Object.entries(parentValue)) {
                    if (validKeys.includes(childKey) && typeof childValue === "object" && childValue !== null) {
                        if (!result[childKey] || (!result[childKey].pf && !result[childKey].remark)) {
                            result[childKey] = { pf: (childValue as any).pf ?? "", remark: (childValue as any).remark ?? "" };
                        }
                    }
                }
            }
        }

        for (const key of validKeys) { if (!result[key]) { result[key] = { pf: "", remark: "" }; } }
        return result;
    };

    // Load API data for Post mode
    useEffect(() => {
        if (!isPostMode || !editId || !stationId) return;
        setPostApiLoaded(false);
        (async () => {
            try {
                const data = await fetchReport(editId, stationId);
                if (data.job) setJob(prev => ({ ...prev, ...data.job, issue_id: data.issue_id ?? prev.issue_id }));
                if (data.pm_date) setJob(prev => ({ ...prev, date: data.pm_date }));

                // Load main breaker pre data (m9)
                const measuresPre = data?.measures_pre || {};
                if (measuresPre.m9) {
                    setMMainPre((prev) => {
                        const next = { ...prev };
                        VOLTAGE_FIELDS_CCB.forEach((k) => {
                            const row = measuresPre.m9[k] ?? {};
                            next[k] = { value: row.value != null ? String(row.value) : "", unit: (row.unit as UnitVoltage) ?? "V" };
                        });
                        return next;
                    });
                }

                // Load sub breakers pre data (m10_1, m10_2, ...)
                const subKeys = Object.keys(measuresPre).filter(k => k.startsWith("m10_"));
                const subCount = subKeys.length;
                if (subCount > 0) {
                    setSubBreakerCount(Math.max(1, subCount));
                    M_SUB_PRE_SETTERS.forEach((setter, idx) => {
                        const subData = measuresPre[`m10_${idx + 1}`];
                        if (subData) {
                            setter((prev) => {
                                const next = { ...prev };
                                VOLTAGE_FIELDS_CCB.forEach((k) => {
                                    const row = subData[k] ?? {};
                                    next[k] = { value: row.value != null ? String(row.value) : "", unit: (row.unit as UnitVoltage) ?? "V" };
                                });
                                return next;
                            });
                        }
                    });
                }

                if (data.subBreakerCount) setSubBreakerCount(data.subBreakerCount);
                if (data.doc_name) setDocName(data.doc_name);
                if (data.inspector) setInspector(data.inspector);
                if (data.comment_pre) setCommentPre(data.comment_pre);
                if (data.summary) setSummary(data.summary);
                if (data.rows_pre) { setRowsPre(data.rows_pre); }
                if (data.rows) {
                    setRows((prev) => {
                        const next = { ...prev };
                        Object.entries(data.rows).forEach(([k, v]) => {
                            next[k] = v as { pf: PF; remark: string };
                        });
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
                setPostApiLoaded(true);
            } catch (err) { console.error("load report failed:", err); setPostApiLoaded(true); }
        })();
    }, [isPostMode, editId, stationId]);

    // Load draft for Post mode
    useEffect(() => {
        if (!isPostMode || !stationId || !editId || !postApiLoaded) return;
        const postDraft = loadDraftLocal<{
            rows: typeof rows;
            mMain: typeof mMain.state;
            mSub1: typeof mSub1.state;
            mSub2: typeof mSub2.state;
            mSub3: typeof mSub3.state;
            mSub4: typeof mSub4.state;
            mSub5: typeof mSub5.state;
            mSub6: typeof mSub6.state;
            subBreakerCount: number;
            summary: string;
            summaryCheck?: PF;
            photoRefs?: Record<number, (PhotoRef | { isNA: true })[]>;
        }>(postKey);
        if (!postDraft) return;
        if (postDraft.rows) setRows(prev => ({ ...prev, ...postDraft.rows }));
        if (postDraft.mMain) mMain.setState(postDraft.mMain);
        if (postDraft.mSub1) mSub1.setState(postDraft.mSub1);
        if (postDraft.mSub2) mSub2.setState(postDraft.mSub2);
        if (postDraft.mSub3) mSub3.setState(postDraft.mSub3);
        if (postDraft.mSub4) mSub4.setState(postDraft.mSub4);
        if (postDraft.mSub5) mSub5.setState(postDraft.mSub5);
        if (postDraft.mSub6) mSub6.setState(postDraft.mSub6);
        if (postDraft.subBreakerCount) setSubBreakerCount(postDraft.subBreakerCount);
        if (postDraft.summary) setSummary(postDraft.summary);
        if (postDraft.summaryCheck) setSummaryCheck(postDraft.summaryCheck);
        (async () => {
            if (!postDraft.photoRefs) return;
            const next: Record<number, PhotoItem[]> = { ...initialPhotos };
            for (const [noStr, refs] of Object.entries(postDraft.photoRefs)) {
                const no = Number(noStr); const items: PhotoItem[] = [];
                for (const ref of refs || []) {
                    if ('isNA' in ref && ref.isNA) { items.push({ id: `${no}-NA-restored`, isNA: true, preview: undefined }); continue; }
                    if (!('id' in ref) || !ref.id) continue;
                    const file = await getPhoto(postKey, ref.id); if (!file) continue;
                    items.push({ id: ref.id, file, preview: URL.createObjectURL(file), remark: (ref as any).remark ?? "", ref: ref as PhotoRef });
                }
                if (items.length > 0) next[no] = items;
            }
            if (Object.keys(next).some(k => (next[Number(k)]?.length ?? 0) > 0)) setPhotos(prev => ({ ...prev, ...next }));
        })();
    }, [isPostMode, stationId, editId, postKey, postApiLoaded]);

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

    useEffect(() => { if (isPostMode || !stationId || !job.date) return; let canceled = false; (async () => { try { const preview = await fetchPreviewIssueId(stationId, job.date); if (!canceled && preview) setJob(prev => ({ ...prev, issue_id: preview })); } catch (err) { console.error("preview issue_id error:", err); } })(); return () => { canceled = true; }; }, [stationId, job.date, isPostMode]);
    useEffect(() => { if (isPostMode || !stationId || !job.date) return; let canceled = false; (async () => { try { const preview = await fetchPreviewDocName(stationId, job.date); if (!canceled && preview) setDocName(preview); } catch (err) { console.error("preview docName error:", err); } })(); return () => { canceled = true; }; }, [stationId, job.date, isPostMode]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sid = params.get("station_id") || localStorage.getItem("selected_station_id");
        if (sid) setStationId(sid);
        if (!sid || isPostMode) return;
        getStationInfoPublic(sid).then((st) => {
            setJob((prev) => ({ ...prev, station_name: st.station_name ?? prev.station_name, date: prev.date || getTodayLocalStr() }));
        }).catch((err) => console.error("load public station info failed:", err));
    }, [isPostMode]);

    // Load draft for Pre mode
    useEffect(() => {
        if (!stationId || isPostMode) return;
        const draft = loadDraftLocal<{
            rows: typeof rows;
            mMain: typeof mMain.state;
            mSub1: typeof mSub1.state;
            mSub2: typeof mSub2.state;
            mSub3: typeof mSub3.state;
            mSub4: typeof mSub4.state;
            mSub5: typeof mSub5.state;
            mSub6: typeof mSub6.state;
            subBreakerCount: number;
            summary: string;
            summary_pf?: PF;
            inspector?: string;
            photoRefs?: Record<number, (PhotoRef | { isNA: true })[]>;
        }>(key);
        if (!draft) return;
        setRows(draft.rows);
        mMain.setState(draft.mMain ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        mSub1.setState(draft.mSub1 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        mSub2.setState(draft.mSub2 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        mSub3.setState(draft.mSub3 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        mSub4.setState(draft.mSub4 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        mSub5.setState(draft.mSub5 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        mSub6.setState(draft.mSub6 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        if (draft.subBreakerCount) setSubBreakerCount(draft.subBreakerCount);
        setSummary(draft.summary);
        setSummaryCheck(draft.summary_pf ?? "");
        setInspector(draft.inspector ?? "");
        (async () => {
            if (!draft.photoRefs) return;
            const next: Record<number, PhotoItem[]> = { ...initialPhotos };
            for (const [noStr, refs] of Object.entries(draft.photoRefs)) {
                const no = Number(noStr); const items: PhotoItem[] = [];
                for (const ref of refs || []) {
                    if ('isNA' in ref && ref.isNA) { items.push({ id: `${no}-NA-restored`, isNA: true, preview: undefined }); continue; }
                    if (!('id' in ref) || !ref.id) continue;
                    const file = await getPhoto(key, ref.id); if (!file) continue;
                    items.push({ id: ref.id, file, preview: URL.createObjectURL(file), remark: (ref as any).remark ?? "", ref: ref as PhotoRef });
                }
                next[no] = items;
            }
            setPhotos(next);
        })();
    }, [stationId, key, isPostMode]);

    useEffect(() => { const onInfo = (e: Event) => { const detail = (e as CustomEvent).detail as { info?: StationPublic; station?: StationPublic }; const st = detail.info ?? detail.station; if (!st) return; setJob((prev) => ({ ...prev, station_name: st.station_name ?? prev.station_name })); }; window.addEventListener("station:info", onInfo as EventListener); return () => window.removeEventListener("station:info", onInfo as EventListener); }, []);

    const makePhotoSetter = (photoKey: number): React.Dispatch<React.SetStateAction<PhotoItem[]>> => {
        return (action: React.SetStateAction<PhotoItem[]>) => {
            setPhotos((prev) => {
                const current = prev[photoKey] ?? [];
                const next = typeof action === "function" ? (action as (x: PhotoItem[]) => PhotoItem[])(current) : action;
                return { ...prev, [photoKey]: next };
            });
        };
    };

    // Calculate required photo keys
    const REQUIRED_PHOTO_KEYS_PRE = useMemo(() => {
        const keys: number[] = [];
        QUESTIONS.filter((q) => q.hasPhoto && q.no !== 11).forEach((q) => {
            if (q.kind === "simple") {
                keys.push(q.no);
            } else if (q.kind === "group") {
                q.items.forEach((item) => {
                    keys.push(getPhotoKeyForQuestion(q, item.key));
                });
            } else if (q.kind === "mainBreaker") {
                keys.push(90);
            } else if (q.kind === "subBreakers") {
                for (let i = 1; i <= subBreakerCount; i++) {
                    keys.push(100 + i);
                }
            }
        });
        return keys;
    }, [subBreakerCount]);

    const REQUIRED_PHOTO_KEYS_POST = useMemo(() => {
        const keys: number[] = [];
        QUESTIONS.filter((q) => q.hasPhoto).forEach((q) => {
            if (q.kind === "simple") {
                keys.push(q.no);
            } else if (q.kind === "group") {
                q.items.forEach((item) => {
                    keys.push(getPhotoKeyForQuestion(q, item.key));
                });
            } else if (q.kind === "mainBreaker") {
                keys.push(90);
            } else if (q.kind === "subBreakers") {
                for (let i = 1; i <= subBreakerCount; i++) {
                    keys.push(100 + i);
                }
            }
        });
        return keys;
    }, [subBreakerCount]);

    const missingPhotoItemsPre = useMemo(() => REQUIRED_PHOTO_KEYS_PRE.filter((key) => {
        // Check if related row is NA - map photo key back to row key
        let rowKey: string | null = null;
        if (key === 90) {
            rowKey = "r9_main";
        } else if (key >= 101 && key <= 106) {
            rowKey = `r10_sub${key - 100}`;
        } else if (key >= 30 && key < 90) {
            const qNo = Math.floor(key / 10);
            const subNo = key % 10;
            rowKey = `r${qNo}_${subNo}`;
        } else {
            rowKey = `r${key}`;
        }
        if (rowKey && rows[rowKey]?.pf === "NA") return false;
        return (photos[key]?.length ?? 0) < 1;
    }), [REQUIRED_PHOTO_KEYS_PRE, photos, rows]);

    const missingPhotoItemsPost = useMemo(() => REQUIRED_PHOTO_KEYS_POST.filter((key) => {
        // Map photo key back to row key to check if it was N/A in Pre-PM
        let rowKey: string | null = null;
        if (key === 90) {
            rowKey = "r9_main";
        } else if (key >= 101 && key <= 106) {
            rowKey = `r10_sub${key - 100}`;
        } else if (key >= 30 && key < 90) {
            const qNo = Math.floor(key / 10);
            const subNo = key % 10;
            rowKey = `r${qNo}_${subNo}`;
        } else {
            rowKey = `r${key}`;
        }
        // Skip if this item was N/A in Pre-PM
        if (rowKey && rowsPre[rowKey]?.pf === "NA") return false;
        return (photos[key]?.length ?? 0) < 1;
    }), [REQUIRED_PHOTO_KEYS_POST, photos, rowsPre]);

    const allPhotosAttachedPre = missingPhotoItemsPre.length === 0;
    const allPhotosAttachedPost = missingPhotoItemsPost.length === 0;
    const missingPhotoItems = isPostMode ? missingPhotoItemsPost : missingPhotoItemsPre;
    const allPhotosAttached = isPostMode ? allPhotosAttachedPost : allPhotosAttachedPre;

    // PF validation
    const PF_REQUIRED_KEYS = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") keys.push(q.key);
            else if (q.kind === "group") q.items.forEach((item) => keys.push(item.key));
            else if (q.kind === "mainBreaker") keys.push("r9_main");
            else if (q.kind === "subBreakers") {
                for (let i = 1; i <= subBreakerCount; i++) keys.push(`r10_sub${i}`);
            }
        });
        return keys;
    }, [subBreakerCount]);

    const PF_KEYS_PRE = useMemo(() => QUESTIONS.filter((q) => q.no !== 11).flatMap((q) => getRowKeysForQuestion(q, subBreakerCount)), [subBreakerCount]);
    const PF_KEYS_POST = useMemo(() => QUESTIONS.filter((q) => {
        // Skip if pre was NA
        const rowKeys = getRowKeysForQuestion(q, subBreakerCount);
        return !rowKeys.every(k => rowsPre[k]?.pf === "NA");
    }).flatMap((q) => getRowKeysForQuestion(q, subBreakerCount)), [rowsPre, subBreakerCount]);

    const allPFAnsweredPre = useMemo(() => true, []); // Pre mode doesn't require PF
    const missingPFItemsPre = useMemo(() => [] as string[], []);
    const allPFAnsweredPost = useMemo(() => PF_KEYS_POST.every((k) => rowsPre[k]?.pf === "NA" || rows[k]?.pf !== ""), [rows, PF_KEYS_POST, rowsPre]);
    const missingPFItemsPost = useMemo(() => PF_KEYS_POST.filter((k) => rowsPre[k]?.pf !== "NA" && !rows[k]?.pf).map((k) => {
        // Handle r9_main
        if (k === "r9_main") return "9";
        // Handle r10_sub1, r10_sub2, etc.
        const subMatch = k.match(/^r10_sub(\d+)$/);
        if (subMatch) return `10.${subMatch[1]}`;
        // Handle regular keys like r1, r3_1, r3_2
        const match = k.match(/^r(\d+)_?(\d+)?$/);
        if (match) {
            return match[2] ? `${match[1]}.${match[2]}` : match[1];
        }
        return k;
    }), [rows, PF_KEYS_POST, rowsPre]);

    // Remark validation
    const validRemarkKeysPre = useMemo(() => QUESTIONS.filter((q) => q.no !== 11).flatMap((q) => getRowKeysForQuestion(q, subBreakerCount)), [subBreakerCount]);
    const missingRemarksPre = useMemo(() => {
        const missing: string[] = [];
        validRemarkKeysPre.forEach((key) => {
            const val = rows[key];
            if (val?.pf === "NA") return;
            if (!val?.remark?.trim()) {
                // Handle r9_main
                if (key === "r9_main") {
                    missing.push("9");
                    return;
                }
                // Handle r10_sub1, r10_sub2, etc.
                const subMatch = key.match(/^r10_sub(\d+)$/);
                if (subMatch) {
                    missing.push(`10.${subMatch[1]}`);
                    return;
                }
                // Handle regular keys like r1, r3_1, r3_2
                const match = key.match(/^r(\d+)_?(\d+)?$/);
                if (match) {
                    missing.push(match[2] ? `${match[1]}.${match[2]}` : match[1]);
                }
            }
        });
        return missing;
    }, [rows, validRemarkKeysPre]);
    const allRemarksFilledPre = missingRemarksPre.length === 0;

    const validRemarkKeysPost = useMemo(() => QUESTIONS.filter((q) => {
        const rowKeys = getRowKeysForQuestion(q, subBreakerCount);
        return !rowKeys.every(k => rowsPre[k]?.pf === "NA");
    }).flatMap((q) => getRowKeysForQuestion(q, subBreakerCount)), [rowsPre, subBreakerCount]);

     const missingRemarksPost = useMemo(() => {
        const missing: string[] = [];
        validRemarkKeysPost.forEach((key) => {
            if (rowsPre[key]?.pf === "NA") return;
           const val = rows[key];
            if (!val?.remark?.trim()) {
                // Handle r9_main
                if (key === "r9_main") {
                    missing.push("9");
                    return;
                }
                // Handle r10_sub1, r10_sub2, etc.
                const subMatch = key.match(/^r10_sub(\d+)$/);
                if (subMatch) {
                    missing.push(`10.${subMatch[1]}`);
                    return;
                }
                // Handle regular keys like r1, r3_1, r3_2
                const match = key.match(/^r(\d+)_?(\d+)?$/);
                if (match) {
                    missing.push(match[2] ? `${match[1]}.${match[2]}` : match[1]);
                }
            }
        });
        return missing;
    }, [rows, validRemarkKeysPost, rowsPre]);
    const allRemarksFilledPost = missingRemarksPost.length === 0;

    // Input validation (measures)
    const missingInputs = useMemo(() => {
        const r: string[] = [];
        // Main breaker (Q9)
        if (rows["r9_main"]?.pf !== "NA") {
            VOLTAGE_FIELDS_CCB.forEach((k) => {
                const v = mMain.state[k]?.value ?? "";
                if (!String(v).trim()) r.push(`9 – ${LABELS[k]}`);
            });
        }
        // Sub breakers (Q10)
        for (let i = 0; i < subBreakerCount; i++) {
            const rowKey = `r10_sub${i + 1}`;
            if (rows[rowKey]?.pf === "NA") continue;
            const m = M_SUB_LIST[i];
            VOLTAGE_FIELDS_CCB.forEach((k) => {
                const v = m.state[k]?.value ?? "";
                if (!String(v).trim()) r.push(`10.${i + 1} – ${LABELS[k]}`);
            });
        }
        return r;
    }, [mMain.state, mSub1.state, mSub2.state, mSub3.state, mSub4.state, mSub5.state, mSub6.state, rows, subBreakerCount, lang]);

    // Detailed missing inputs for PMValidationCard
    const missingInputsDetailed = useMemo(() => {
        const r: { qNo: number; subNo?: number; label: string; fieldKey: string }[] = [];
        // Main breaker (Q9)
        if (rows["r9_main"]?.pf !== "NA") {
            VOLTAGE_FIELDS_CCB.forEach((k) => {
                const v = mMain.state[k]?.value ?? "";
                if (!String(v).trim()) r.push({ qNo: 9, label: LABELS[k], fieldKey: k });
            });
        }
        // Sub breakers (Q10)
        for (let i = 0; i < subBreakerCount; i++) {
            const rowKey = `r10_sub${i + 1}`;
            if (rows[rowKey]?.pf === "NA") continue;
            const m = M_SUB_LIST[i];
            VOLTAGE_FIELDS_CCB.forEach((k) => {
                const v = m.state[k]?.value ?? "";
                if (!String(v).trim()) r.push({ qNo: 10, subNo: i + 1, label: LABELS[k], fieldKey: k });
            });
        }
        return r;
    }, [mMain.state, mSub1.state, mSub2.state, mSub3.state, mSub4.state, mSub5.state, mSub6.state, rows, subBreakerCount]);

    const allRequiredInputsFilled = missingInputs.length === 0;
    const isSummaryFilled = summary.trim().length > 0;
    const isSummaryCheckFilled = summaryCheck !== "";

    const canGoAfter: boolean = isPostMode ? true : (allPhotosAttachedPre && allRequiredInputsFilled && allRemarksFilledPre);
    const canFinalSave = allPhotosAttachedPost && allPFAnsweredPost && allRequiredInputsFilled && allRemarksFilledPost && isSummaryFilled && isSummaryCheckFilled;

    const photoRefs = useMemo(() => {
        const out: Record<number, (PhotoRef | { isNA: true })[]> = {};
        Object.entries(photos).forEach(([noStr, list]) => {
            const no = Number(noStr);
            out[no] = (list || []).map(p => p.isNA ? { isNA: true } : p.ref).filter(Boolean) as (PhotoRef | { isNA: true })[];
        });
        return out;
    }, [photos]);

    useDebouncedEffect(() => {
        if (!stationId || isPostMode) return;
        saveDraftLocal(key, {
            rows,
            mMain: mMain.state,
            mSub1: mSub1.state,
            mSub2: mSub2.state,
            mSub3: mSub3.state,
            mSub4: mSub4.state,
            mSub5: mSub5.state,
            mSub6: mSub6.state,
            subBreakerCount,
            summary,
            summary_pf: summaryCheck,
            photoRefs,
            inspector,
        });
    }, [key, stationId, rows, mMain.state, mSub1.state, mSub2.state, mSub3.state, mSub4.state, mSub5.state, mSub6.state, subBreakerCount, summary, summaryCheck, photoRefs, isPostMode, inspector]);

    useDebouncedEffect(() => {
        if (!stationId || !isPostMode || !editId) return;
        saveDraftLocal(postKey, {
            rows,
            mMain: mMain.state,
            mSub1: mSub1.state,
            mSub2: mSub2.state,
            mSub3: mSub3.state,
            mSub4: mSub4.state,
            mSub5: mSub5.state,
            mSub6: mSub6.state,
            subBreakerCount,
            summary,
            summaryCheck,
            photoRefs,
        });
    }, [postKey, stationId, rows, mMain.state, mSub1.state, mSub2.state, mSub3.state, mSub4.state, mSub5.state, mSub6.state, subBreakerCount, summary, summaryCheck, photoRefs, isPostMode, editId]);

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
                canvas.toBlob((blob) => {
                    if (blob && blob.size < file.size) resolve(new File([blob], file.name, { type: "image/jpeg" }));
                    else resolve(file);
                }, "image/jpeg", quality);
            };
            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }

    async function uploadGroupPhotos(reportId: string, stationId: string, group: string, files: File[], side: TabId) {
        if (files.length === 0) return;
        const compressedFiles = await Promise.all(files.map(f => compressImage(f)));
        const form = new FormData();
        form.append("station_id", stationId);
        form.append("group", group);
        form.append("side", side);
        compressedFiles.forEach((f) => form.append("files", f));
        const token = localStorage.getItem("access_token");
        const url = side === "pre" ? `${API_BASE}/${PM_PREFIX}/${reportId}/pre/photos` : `${API_BASE}/${PM_PREFIX}/${reportId}/post/photos`;
        const res = await fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form, credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
    }

    // Helper function to scroll to first error element
    const scrollToFirstError = (elementId: string) => {
        const element = document.getElementById(elementId);
        if (element) {
            const rect = element.getBoundingClientRect();
            const elementTop = rect.top + window.scrollY;
            const viewportHeight = window.innerHeight;
            let targetScrollY = elementTop - (viewportHeight / 2) + (rect.height / 2);
            targetScrollY = Math.max(0, targetScrollY);
            window.scrollTo({ top: targetScrollY, behavior: "smooth" });
            element.classList.add("tw-ring-2", "tw-ring-red-400", "tw-bg-red-50");
            setTimeout(() => {
                element.classList.remove("tw-ring-2", "tw-ring-red-400", "tw-bg-red-50");
            }, 3000);
        }
    };

    const getFirstMissingPhotoScrollId = (): string | null => {
        if (missingPhotoItemsPre.length === 0) return null;
        const first = missingPhotoItemsPre[0];
        const formatted = formatPhotoKeyNumber(first);
        const parts = formatted.split('-');
        if (parts.length === 2) return `${ID_PREFIX}-photo-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-photo-${parts[0]}`;
    };

    const getFirstMissingInputScrollId = (): string | null => {
        if (missingInputsDetailed.length === 0) return null;
        const { qNo, subNo } = missingInputsDetailed[0];
        return subNo ? `${ID_PREFIX}-input-${qNo}-${subNo}` : `${ID_PREFIX}-question-${qNo}`;
    };

    const getFirstMissingRemarkScrollId = (): string | null => {
        if (missingRemarksPre.length === 0) return null;
        const first = missingRemarksPre[0];
        const parts = first.split('.');
        if (parts.length === 2) return `${ID_PREFIX}-remark-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-remark-${parts[0]}`;
    };

    const onPreSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }
        if (!allPhotosAttachedPre) { 
            alert(t("alertFillPhoto", lang)); 
            const scrollId = getFirstMissingPhotoScrollId();
            if (scrollId) scrollToFirstError(scrollId);
            return; 
        }
        if (!allRequiredInputsFilled) { 
            alert(t("alertInputNotComplete", lang)); 
            const scrollId = getFirstMissingInputScrollId();
            if (scrollId) scrollToFirstError(scrollId);
            return; 
        }
        if (!allRemarksFilledPre) { 
            alert(`${t("alertFillRemark", lang)} ${missingRemarksPre.join(", ")}`); 
            const scrollId = getFirstMissingRemarkScrollId();
            if (scrollId) scrollToFirstError(scrollId);
            return; 
        }
        if (submitting) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("access_token");
            const pm_date = job.date?.trim() || "";

            const toNum = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : null; };
            const normalizeMeasure = (state: typeof mMain.state) =>
                Object.fromEntries(Object.entries(state).map(([k, v]) => [k, { value: toNum(v.value), unit: v.unit }]));

            // Build measures with m9, m10_1, m10_2, ... format
            const measuresPre: Record<string, any> = {};
            measuresPre["m9"] = normalizeMeasure(mMain.state);
            for (let i = 0; i < subBreakerCount; i++) {
                measuresPre[`m10_${i + 1}`] = normalizeMeasure(M_SUB_LIST[i].state);
            }

            const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
            const flatRows = flattenRows(rows, subBreakerCount);

            const payload = {
                station_id: stationId,
                issue_id: issueIdFromJob,
                job: jobWithoutIssueId,
                inspector,
                measures_pre: measuresPre,
                rows_pre: flatRows,
                pm_date,
                doc_name: docName,
                side: "pre" as TabId,
                comment_pre: summary,
                subBreakerCount,
            };

            const res = await fetch(`${API_BASE}/${PM_PREFIX}/pre/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const { report_id, doc_name } = await res.json() as { report_id: string; doc_name?: string };
            setReportId(report_id);
            if (doc_name) setDocName(doc_name);

            // Upload photos
            const uploadPromises: Promise<void>[] = [];
            Object.entries(photos).forEach(([noStr, list]) => {
                const files = (list || []).map(p => p.file).filter(Boolean) as File[];
                if (files.length > 0) {
                    // Map photo key back to question group
                    const no = Number(noStr);
                    let groupKey = `g${no}`;
                    if (no === 90) {
                        groupKey = "g9";
                    } else if (no >= 101 && no <= 106) {
                        groupKey = `g10_${no - 100}`;
                    } else if (no >= 30 && no < 90) {
                        const qNo = Math.floor(no / 10);
                        const subNo = no % 10;
                        groupKey = `g${qNo}_${subNo}`;
                    }
                    uploadPromises.push(uploadGroupPhotos(report_id, stationId, groupKey, files, "pre"));
                }
            });
            if (uploadPromises.length > 0) { await Promise.all(uploadPromises); }

            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(key, p.id)));
            clearDraftLocal(key);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&tab=ccb`);
        } catch (err: any) { alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`); } finally { setSubmitting(false); }
    };

    // Helper functions for Post mode scroll IDs
    const getFirstMissingPhotoPostScrollId = (): string | null => {
        if (missingPhotoItemsPost.length === 0) return null;
        const first = missingPhotoItemsPost[0];
        const formatted = formatPhotoKeyNumber(first);
        const parts = formatted.split('-');
        if (parts.length === 2) return `${ID_PREFIX}-photo-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-photo-${parts[0]}`;
    };

    const getFirstMissingPFScrollId = (): string | null => {
        if (missingPFItemsPost.length === 0) return null;
        const first = missingPFItemsPost[0];
        const parts = first.split('.');
        if (parts.length === 2) return `${ID_PREFIX}-pf-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-pf-${parts[0]}`;
    };

    const getFirstMissingRemarkPostScrollId = (): string | null => {
        if (missingRemarksPost.length === 0) return null;
        const first = missingRemarksPost[0];
        const parts = first.split('.');
        if (parts.length === 2) return `${ID_PREFIX}-remark-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-remark-${parts[0]}`;
    };

    const onFinalSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }
        
        // Validation checks with scroll to error
        if (!allPhotosAttachedPost) {
            alert(t("alertFillPhoto", lang));
            const scrollId = getFirstMissingPhotoPostScrollId();
            if (scrollId) scrollToFirstError(scrollId);
            return;
        }
        if (!allPFAnsweredPost) {
            alert(lang === "th" ? "กรุณาเลือก PASS/FAIL/N/A ทุกข้อ" : "Please select PASS/FAIL/N/A for all items");
            const scrollId = getFirstMissingPFScrollId();
            if (scrollId) scrollToFirstError(scrollId);
            return;
        }
        if (!allRequiredInputsFilled) {
            alert(t("alertInputNotComplete", lang));
            const scrollId = getFirstMissingInputScrollId();
            if (scrollId) scrollToFirstError(scrollId);
            return;
        }
        if (!allRemarksFilledPost) {
            alert(`${t("alertFillRemark", lang)} ${missingRemarksPost.join(", ")}`);
            const scrollId = getFirstMissingRemarkPostScrollId();
            if (scrollId) scrollToFirstError(scrollId);
            return;
        }
        if (!isSummaryFilled) {
            alert(t("missingSummaryText", lang));
            scrollToFirstError(`${ID_PREFIX}-summary-section`);
            return;
        }
        if (!isSummaryCheckFilled) {
            alert(t("missingSummaryStatus", lang));
            scrollToFirstError(`${ID_PREFIX}-summary-section`);
            return;
        }
        
        if (submitting) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("access_token");
            const finalReportId = reportId || editId;
            if (!finalReportId) throw new Error(t("noReportId", lang));

            const toNum = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : null; };
            const normalizeMeasure = (state: typeof mMain.state) =>
                Object.fromEntries(Object.entries(state).map(([k, v]) => [k, { value: toNum(v.value), unit: v.unit }]));

            // Build measures with m9, m10_1, m10_2, ... format
            const measures: Record<string, any> = {};
            measures["m9"] = normalizeMeasure(mMain.state);
            for (let i = 0; i < subBreakerCount; i++) {
                measures[`m10_${i + 1}`] = normalizeMeasure(M_SUB_LIST[i].state);
            }

            const flatRows = flattenRows(rows, subBreakerCount);

            const payload = {
                station_id: stationId,
                rows: flatRows,
                measures,
                summary,
                ...(summaryCheck ? { summaryCheck } : {}),
                side: "post" as TabId,
                report_id: finalReportId,
                subBreakerCount,
            };

            const res = await fetch(`${API_BASE}/${PM_PREFIX}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const { report_id } = await res.json() as { report_id: string };

            // Upload photos
            const uploadPromises: Promise<void>[] = [];
            Object.entries(photos).forEach(([noStr, list]) => {
                const files = (list || []).map(p => p.file).filter(Boolean) as File[];
                if (files.length > 0) {
                    const no = Number(noStr);
                    let groupKey = `g${no}`;
                    if (no === 90) {
                        groupKey = "g9";
                    } else if (no >= 101 && no <= 106) {
                        groupKey = `g10_${no - 100}`;
                    } else if (no >= 30 && no < 90) {
                        const qNo = Math.floor(no / 10);
                        const subNo = no % 10;
                        groupKey = `g${qNo}_${subNo}`;
                    }
                    uploadPromises.push(uploadGroupPhotos(finalReportId, stationId, groupKey, files, "post"));
                }
            });
            if (uploadPromises.length > 0) { await Promise.all(uploadPromises); }

            await fetch(`${API_BASE}/${PM_PREFIX}/${finalReportId}/finalize`, {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                credentials: "include",
                body: new URLSearchParams({ station_id: stationId }),
            });

            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(postKey, p.id)));
            clearDraftLocal(postKey);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&tab=ccb`);
        } catch (err: any) { alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`); } finally { setSubmitting(false); }
    };

    const renderPreRemarkElement = (rowKey: string, mode: TabId) => {
        const preRemark = rowsPre[rowKey]?.remark;
        if (mode !== "post" || !preRemark) return null;
        return (
            <div className="tw-mb-3 tw-p-3 tw-bg-amber-50 tw-rounded-lg tw-border tw-border-amber-300">
                <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                    <svg className="tw-w-4 tw-h-4 tw-text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <Typography variant="small" className="tw-font-semibold tw-text-amber-700">{t("preRemarkLabel", lang)}</Typography>
                </div>
                <Typography variant="small" className="tw-text-amber-900 tw-ml-6">{preRemark}</Typography>
            </div>
        );
    };

    const renderQuestionBlock = (q: Question, mode: TabId) => {
        const qTooltip = q.tooltipKey ? t(q.tooltipKey, lang) : undefined;

        if (mode === "pre") {
            // For simple questions
            if (q.kind === "simple") {
                const isNA = rows[q.key]?.pf === "NA";
                return (
                    <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} tooltip={qTooltip}>
                        <div className={`tw-py-2 ${isNA ? "tw-bg-amber-50/50" : ""}`}>
                            <div className="tw-flex tw-justify-end tw-mb-3">
                                <Button
                                    size="sm"
                                    color={isNA ? "amber" : "gray"}
                                    variant={isNA ? "filled" : "outlined"}
                                    onClick={() => setRows(prev => ({ ...prev, [q.key]: { ...prev[q.key], pf: isNA ? "" : "NA" } }))}
                                >
                                    {isNA ? t("cancelNA", lang) : t("na", lang)}
                                </Button>
                            </div>
                            {q.hasPhoto && (
                                <div className="tw-mb-3">
                                    <PhotoMultiInput
                                        photos={photos[q.no] || []}
                                        setPhotos={makePhotoSetter(q.no)}
                                        max={10}
                                        draftKey={currentDraftKey}
                                        qNo={q.no}
                                        lang={lang}
                                        id={getPhotoIdFromKey(q.no)}
                                    />
                                </div>
                            )}
                            <div id={getRemarkIdFromKey(q.key)}>
                                <Textarea
                                    label={t("remark", lang)}
                                    value={rows[q.key]?.remark || ""}
                                    onChange={(e) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: e.target.value } })}
                                    rows={3}
                                    required
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-w-full resize-none"
                                />
                            </div>
                        </div>
                    </SectionCard>
                );
            }

            // For group questions
            if (q.kind === "group") {
                return (
                    <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} tooltip={qTooltip}>
                        <div className="tw-divide-y tw-divide-gray-200">
                            {q.items.map((item, idx) => {
                                const photoKey = getPhotoKeyForQuestion(q, item.key);
                                const isItemNA = rows[item.key]?.pf === "NA";
                                // Generate sub-item label with number (e.g., "3.1) ...")
                                const subLabel = `${q.no}.${idx + 1}) ${t(item.labelKey, lang)}`;
                                return (
                                    <div key={item.key} className={`tw-py-4 first:tw-pt-2 ${isItemNA ? "tw-bg-amber-50/50" : ""}`}>
                                        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                            <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">
                                                {subLabel}
                                            </Typography>
                                            <Button
                                                size="sm"
                                                color={isItemNA ? "amber" : "gray"}
                                                variant={isItemNA ? "filled" : "outlined"}
                                                onClick={() => setRows(prev => ({ ...prev, [item.key]: { ...prev[item.key], pf: isItemNA ? "" : "NA" } }))}
                                                className="tw-text-xs"
                                            >
                                                {isItemNA ? t("cancelNA", lang) : t("na", lang)}
                                            </Button>
                                        </div>
                                        {q.hasPhoto && (
                                            <div className="tw-mb-3">
                                                <PhotoMultiInput
                                                    photos={photos[photoKey] || []}
                                                    setPhotos={makePhotoSetter(photoKey)}
                                                    max={10}
                                                    draftKey={currentDraftKey}
                                                    qNo={photoKey}
                                                    lang={lang}
                                                    id={getPhotoIdFromKey(photoKey)}
                                                />
                                            </div>
                                        )}
                                        <div id={getRemarkIdFromKey(item.key)}>
                                            <Textarea
                                                label={t("remark", lang)}
                                                value={rows[item.key]?.remark || ""}
                                                onChange={(e) => setRows({ ...rows, [item.key]: { ...rows[item.key], remark: e.target.value } })}
                                                rows={3}
                                                required
                                                containerProps={{ className: "!tw-min-w-0" }}
                                                className="!tw-w-full resize-none"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </SectionCard>
                );
            }

            // For mainBreaker questions (Q9 - Main Breaker only)
            if (q.kind === "mainBreaker") {
                const rowKey = "r9_main";
                const isNA = rows[rowKey]?.pf === "NA";
                return (
                    <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} tooltip={qTooltip}>
                        <div className={`tw-py-2 ${isNA ? "tw-bg-amber-50/50" : ""}`}>
                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">
                                    {`9.1) ${t("mainBreaker", lang)}`}
                                </Typography>
                                <Button
                                    size="sm"
                                    color={isNA ? "amber" : "gray"}
                                    variant={isNA ? "filled" : "outlined"}
                                    onClick={() => setRows(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], pf: isNA ? "" : "NA" } }))}
                                    className="tw-text-xs"
                                >
                                    {isNA ? t("cancelNA", lang) : t("na", lang)}
                                </Button>
                            </div>
                            {q.hasPhoto && (
                                <div className="tw-mb-3">
                                    <PhotoMultiInput
                                        photos={photos[90] || []}
                                        setPhotos={makePhotoSetter(90)}
                                        max={3}
                                        draftKey={currentDraftKey}
                                        qNo={90}
                                        lang={lang}
                                        id={getPhotoIdFromKey(90)}
                                    />
                                </div>
                            )}
                            <div id={getInputIdFromKey("r9_main")} className={`tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-4 tw-mb-3 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>
                                {VOLTAGE_FIELDS_CCB.map((k) => (
                                    <InputWithUnit<UnitVoltage>
                                        key={`main-${k}`}
                                        label={LABELS[k]}
                                        value={mMain.state[k]?.value || ""}
                                        unit={(mMain.state[k]?.unit as UnitVoltage) || "V"}
                                        units={["V"] as const}
                                        onValueChange={(v) => mMain.patch(k, { value: v })}
                                        onUnitChange={(u) => mMain.syncUnits(u)}
                                    />
                                ))}
                            </div>
                            <div id={getRemarkIdFromKey("r9_main")}>
                                <Textarea
                                    label={t("remark", lang)}
                                    value={rows[rowKey]?.remark || ""}
                                    onChange={(e) => setRows({ ...rows, [rowKey]: { ...rows[rowKey], remark: e.target.value } })}
                                    rows={3}
                                    required
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-w-full resize-none"
                                />
                            </div>
                        </div>
                    </SectionCard>
                );
            }

            // For subBreakers questions (Q10 - Dynamic Sub Breakers)
            if (q.kind === "subBreakers") {
                return (
                    <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} tooltip={qTooltip}>
                        {/* Header with count summary and add button */}
                        <div className="tw-flex tw-items-center tw-justify-between tw-pb-3 tw-border-b tw-border-gray-200">
                            <div className="tw-flex tw-items-center tw-gap-2">
                                <Typography variant="small" className="tw-text-blue-gray-600">{t("subBreakerCount", lang)}</Typography>
                                <Typography variant="small" className="tw-font-bold tw-text-blue-600">{subBreakerCount} {t("unit", lang)}</Typography>
                            </div>
                            {subBreakerCount < 6 && (
                                <Button
                                    size="sm"
                                    color="gray"
                                    variant="outlined"
                                    onClick={addSubBreaker}
                                    className="tw-flex tw-items-center tw-gap-1"
                                >
                                    <span className="tw-text-lg tw-leading-none">+</span>
                                    <span className="tw-text-xs">{t("addSubBreaker", lang)}</span>
                                </Button>
                            )}
                        </div>

                        <div className="tw-divide-y tw-divide-gray-200">
                            {Array.from({ length: subBreakerCount }, (_, idx) => {
                                const i = idx + 1;
                                const photoKey = 100 + i;
                                const rowKey = `r10_sub${i}`;
                                const isItemNA = rows[rowKey]?.pf === "NA";
                                const m = M_SUB_LIST[idx];
                                return (
                                    <div key={rowKey} className={`tw-py-4 first:tw-pt-2 ${isItemNA ? "tw-bg-amber-50/50" : ""}`}>
                                        {/* Breaker header with label and N/A button */}
                                        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                            <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">
                                                {`10.${i}) ${lang === "th" ? "เบรกเกอร์วงจรย่อยตัวที่" : "Sub-circuit Breaker"} ${i}`}
                                            </Typography>
                                            <div className="tw-flex tw-items-center tw-gap-2">
                                                <Button
                                                    size="sm"
                                                    color={isItemNA ? "amber" : "gray"}
                                                    variant={isItemNA ? "filled" : "outlined"}
                                                    onClick={() => setRows(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], pf: isItemNA ? "" : "NA" } }))}
                                                    className="tw-text-xs"
                                                >
                                                    {isItemNA ? t("cancelNA", lang) : t("na", lang)}
                                                </Button>
                                                {subBreakerCount > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeSubBreaker(i)}
                                                        className="tw-h-6 tw-w-6 tw-flex tw-items-center tw-justify-center tw-rounded tw-bg-red-50 tw-text-red-600 hover:tw-bg-red-100 hover:tw-text-red-700 tw-transition-all tw-duration-200"
                                                        aria-label="Remove item"
                                                    >
                                                        <svg className="tw-w-3.5 tw-h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Photo upload */}
                                        {q.hasPhoto && (
                                            <div className="tw-mb-3">
                                                <PhotoMultiInput
                                                    photos={photos[photoKey] || []}
                                                    setPhotos={makePhotoSetter(photoKey)}
                                                    max={10}
                                                    draftKey={currentDraftKey}
                                                    qNo={photoKey}
                                                    lang={lang}
                                                    id={getPhotoIdFromKey(photoKey)}
                                                />
                                            </div>
                                        )}

                                        {/* Voltage inputs - 3 columns grid */}
                                        <div id={getInputIdFromKey(rowKey)} className={`tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-3 tw-mb-3 ${isItemNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>
                                            {VOLTAGE_FIELDS_CCB.map((k) => (
                                                <InputWithUnit<UnitVoltage>
                                                    key={`sub${i}-${k}`}
                                                    label={LABELS[k]}
                                                    value={m.state[k]?.value || ""}
                                                    unit={(m.state[k]?.unit as UnitVoltage) || "V"}
                                                    units={["V"] as const}
                                                    onValueChange={(v) => m.patch(k, { value: v })}
                                                    onUnitChange={(u) => m.syncUnits(u)}
                                                />
                                            ))}
                                        </div>

                                        {/* Remark */}
                                        <div id={getRemarkIdFromKey(rowKey)}>
                                            <Textarea
                                                label={t("remark", lang)}
                                                value={rows[rowKey]?.remark || ""}
                                                onChange={(e) => setRows({ ...rows, [rowKey]: { ...rows[rowKey], remark: e.target.value } })}
                                                rows={3}
                                                required
                                                containerProps={{ className: "!tw-min-w-0" }}
                                                className="!tw-w-full resize-none"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </SectionCard>
                );
            }

            return null;
        }

        // Post mode
        // Check if all items in this question were NA in pre
        const allItemsNA = getRowKeysForQuestion(q, subBreakerCount).every(k => rowsPre[k]?.pf === "NA");
        if (allItemsNA) {
            return (
                <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} tooltip={qTooltip}>
                    <SkippedNAItem label={t(q.labelKey, lang)} remark={rowsPre[q.key]?.remark} lang={lang} />
                </SectionCard>
            );
        }

        return (
            <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} tooltip={qTooltip}>
                {q.kind === "simple" && (
                    <div className="tw-py-2">
                        <PassFailRow
                            label={t("testResult", lang)}
                            value={rows[q.key]?.pf ?? ""}
                            onChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })}
                            remark={rows[q.key]?.remark || ""}
                            onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })}
                            lang={lang}
                            id={getPfIdFromKey(q.key)}
                            remarkId={getRemarkIdFromKey(q.key)}
                            aboveRemark={
                                q.hasPhoto && (
                                    <div className="tw-pb-4 tw-border-b tw-mb-4 tw-border-gray-100">
                                        <PhotoMultiInput
                                            photos={photos[q.no] || []}
                                            setPhotos={makePhotoSetter(q.no)}
                                            max={10}
                                            draftKey={currentDraftKey}
                                            qNo={q.no}
                                            lang={lang}
                                            id={getPhotoIdFromKey(q.no)}
                                        />
                                    </div>
                                )
                            }
                            beforeRemark={renderPreRemarkElement(q.key, mode)}
                        />
                    </div>
                )}

                {q.kind === "group" && (
                    <div className="tw-divide-y tw-divide-gray-200">
                        {q.items.map((item, idx) => {
                            const subLabel = `${q.no}.${idx + 1}) ${t(item.labelKey, lang)}`;
                            if (rowsPre[item.key]?.pf === "NA") {
                                return (
                                    <div key={item.key} className="tw-py-4 first:tw-pt-2 tw-bg-amber-50/50">
                                        <div className="tw-flex tw-items-center tw-justify-between">
                                            <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{subLabel}</Typography>
                                            <span className="tw-text-xs tw-text-amber-600 tw-font-medium">N/A</span>
                                        </div>
                                        {rowsPre[item.key]?.remark && (
                                            <Typography variant="small" className="tw-text-gray-600 tw-mt-1">
                                                {t("remarkLabel", lang)}: {rowsPre[item.key]?.remark}
                                            </Typography>
                                        )}
                                    </div>
                                );
                            }
                            const photoKey = getPhotoKeyForQuestion(q, item.key);
                            return (
                                <div key={item.key} className="tw-py-4 first:tw-pt-2">
                                    <PassFailRow
                                        label={subLabel}
                                        value={rows[item.key]?.pf ?? ""}
                                        onChange={(v) => setRows({ ...rows, [item.key]: { ...rows[item.key], pf: v } })}
                                        remark={rows[item.key]?.remark || ""}
                                        onRemarkChange={(v) => setRows({ ...rows, [item.key]: { ...rows[item.key], remark: v } })}
                                        lang={lang}
                                        id={getPfIdFromKey(item.key)}
                                        remarkId={getRemarkIdFromKey(item.key)}
                                        aboveRemark={
                                            q.hasPhoto && (
                                                <div className="tw-pb-4 tw-border-b tw-border-gray-100">
                                                    <PhotoMultiInput
                                                        photos={photos[photoKey] || []}
                                                        setPhotos={makePhotoSetter(photoKey)}
                                                        max={10}
                                                        draftKey={currentDraftKey}
                                                        qNo={photoKey}
                                                        lang={lang}
                                                        id={getPhotoIdFromKey(photoKey)}
                                                    />
                                                </div>
                                            )
                                        }
                                        beforeRemark={renderPreRemarkElement(item.key, mode)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}

                {q.kind === "mainBreaker" && (
                    (() => {
                        const rowKey = "r9_main";
                        if (rowsPre[rowKey]?.pf === "NA") {
                            return <SkippedNAItem label={`9.1) ${t("mainBreaker", lang)}`} remark={rowsPre[rowKey]?.remark} lang={lang} />;
                        }
                        return (
                            <div className="tw-py-2">
                                <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800 tw-mb-3">{`9.1) ${t("mainBreaker", lang)}`}</Typography>

                                {q.hasPhoto && (
                                    <div className="tw-mb-3 tw-pb-3 tw-border-b tw-border-gray-100">
                                        <PhotoMultiInput
                                            photos={photos[90] || []}
                                            setPhotos={makePhotoSetter(90)}
                                            max={3}
                                            draftKey={currentDraftKey}
                                            qNo={90}
                                            lang={lang}
                                            id={getPhotoIdFromKey(90)}
                                        />
                                    </div>
                                )}

                                <div className="tw-mb-4">
                                    <PassFailRow
                                        label={t("testResult", lang)}
                                        value={rows[rowKey]?.pf ?? ""}
                                        onChange={(v) => setRows({ ...rows, [rowKey]: { ...rows[rowKey], pf: v } })}
                                        remark={rows[rowKey]?.remark || ""}
                                        onRemarkChange={(v) => setRows({ ...rows, [rowKey]: { ...rows[rowKey], remark: v } })}
                                        lang={lang}
                                        id={getPfIdFromKey(rowKey)}
                                        remarkId={getRemarkIdFromKey(rowKey)}
                                        beforeRemark={renderPreRemarkElement(rowKey, mode)}
                                    />
                                </div>

                                <div className="tw-space-y-3">
                                    <Typography variant="small" className="tw-font-medium tw-text-gray-700">{t("beforePM", lang)}</Typography>
                                    <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-4 tw-opacity-60 tw-pointer-events-none">
                                        {VOLTAGE_FIELDS_CCB.map((k) => (
                                            <InputWithUnit<UnitVoltage>
                                                key={`pre-main-${k}`}
                                                label={LABELS[k]}
                                                value={mMainPre[k]?.value != null ? String(mMainPre[k]?.value) : "-"}
                                                unit={(mMainPre[k]?.unit as UnitVoltage) || "V"}
                                                units={["V"] as const}
                                                onValueChange={() => { }}
                                                onUnitChange={() => { }}
                                                readOnly
                                                required={false}
                                            />
                                        ))}
                                    </div>

                                    <Typography variant="small" className="tw-font-medium tw-text-gray-700 tw-mt-2">{t("afterPM", lang)}</Typography>
                                    <div id={getInputIdFromKey("r9_main")} className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-4">
                                        {VOLTAGE_FIELDS_CCB.map((k) => (
                                            <InputWithUnit<UnitVoltage>
                                                key={`post-main-${k}`}
                                                label={LABELS[k]}
                                                value={mMain.state[k]?.value || ""}
                                                unit={(mMain.state[k]?.unit as UnitVoltage) || "V"}
                                                units={["V"] as const}
                                                onValueChange={(v) => mMain.patch(k, { value: v })}
                                                onUnitChange={(u) => mMain.syncUnits(u)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })()
                )}

                    {q.kind === "subBreakers" && (
                        <div className="tw-space-y-0">
                            {/* Count summary row for POST mode */}
                            <div className="tw-flex tw-items-center tw-gap-2 tw-pb-3 tw-border-b tw-border-gray-200">
                                <Typography variant="small" className="tw-text-blue-gray-600">{t("subBreakerCount", lang)}</Typography>
                                <Typography variant="small" className="tw-font-bold tw-text-blue-600">{subBreakerCount} {t("unit", lang)}</Typography>
                            </div>
                            <div className="tw-divide-y tw-divide-gray-200">
                                {Array.from({ length: subBreakerCount }, (_, idx) => {
                                    const i = idx + 1;
                                    const photoKey = 100 + i;
                                    const rowKey = `r10_sub${i}`;
                                    const mPre = M_SUB_PRE_LIST[idx];
                                    const m = M_SUB_LIST[idx];
                                    const breakerLabel = `10.${i}) ${lang === "th" ? "เบรกเกอร์วงจรย่อยตัวที่" : "Sub-circuit Breaker"} ${i}`;

                                    if (rowsPre[rowKey]?.pf === "NA") {
                                        return (
                                            <div key={rowKey} className="tw-py-4 first:tw-pt-2 tw-bg-amber-50/50">
                                                <div className="tw-flex tw-items-center tw-justify-between">
                                                    <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{breakerLabel}</Typography>
                                                    <span className="tw-text-xs tw-text-amber-600 tw-font-medium">N/A</span>
                                                </div>
                                                {rowsPre[rowKey]?.remark && (
                                                    <Typography variant="small" className="tw-text-gray-600 tw-mt-1">
                                                        {t("remarkLabel", lang)}: {rowsPre[rowKey]?.remark}
                                                    </Typography>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={rowKey} className="tw-py-4 first:tw-pt-2">
                                            <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800 tw-mb-3">{breakerLabel}</Typography>

                                            {q.hasPhoto && (
                                                <div className="tw-mb-3 tw-pb-3 tw-border-b tw-border-gray-100">
                                                    <PhotoMultiInput
                                                        photos={photos[photoKey] || []}
                                                        setPhotos={makePhotoSetter(photoKey)}
                                                        max={10}
                                                        draftKey={currentDraftKey}
                                                        qNo={photoKey}
                                                        lang={lang}
                                                        id={getPhotoIdFromKey(photoKey)}
                                                    />
                                                </div>
                                            )}

                                            <div className="tw-mb-4">
                                                <PassFailRow
                                                    label={t("testResult", lang)}
                                                    value={rows[rowKey]?.pf ?? ""}
                                                    onChange={(v) => setRows({ ...rows, [rowKey]: { ...rows[rowKey], pf: v } })}
                                                    remark={rows[rowKey]?.remark || ""}
                                                    onRemarkChange={(v) => setRows({ ...rows, [rowKey]: { ...rows[rowKey], remark: v } })}
                                                    lang={lang}
                                                    id={getPfIdFromKey(rowKey)}
                                                    remarkId={getRemarkIdFromKey(rowKey)}
                                                    beforeRemark={renderPreRemarkElement(rowKey, mode)}
                                                />
                                            </div>

                                            <div className="tw-space-y-3">
                                                <Typography variant="small" className="tw-font-medium tw-text-gray-700">{t("beforePM", lang)}</Typography>
                                                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-3 tw-opacity-60 tw-pointer-events-none">
                                                    {VOLTAGE_FIELDS_CCB.map((k) => (
                                                        <InputWithUnit<UnitVoltage>
                                                            key={`pre-sub${i}-${k}`}
                                                            label={LABELS[k]}
                                                            value={mPre[k]?.value != null ? String(mPre[k]?.value) : "-"}
                                                            unit={(mPre[k]?.unit as UnitVoltage) || "V"}
                                                            units={["V"] as const}
                                                            onValueChange={() => { }}
                                                            onUnitChange={() => { }}
                                                            readOnly
                                                            required={false}
                                                        />
                                                    ))}
                                                </div>

                                                <Typography variant="small" className="tw-font-medium tw-text-gray-700 tw-mt-2">{t("afterPM", lang)}</Typography>
                                                <div id={getInputIdFromKey(rowKey)} className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-3">
                                                    {VOLTAGE_FIELDS_CCB.map((k) => (
                                                        <InputWithUnit<UnitVoltage>
                                                            key={`post-sub${i}-${k}`}
                                                            label={LABELS[k]}
                                                            value={m.state[k]?.value || ""}
                                                            unit={(m.state[k]?.unit as UnitVoltage) || "V"}
                                                            units={["V"] as const}
                                                            onValueChange={(v) => m.patch(k, { value: v })}
                                                            onUnitChange={(u) => m.syncUnits(u)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
            </SectionCard>
        );
    };

    const active: TabId = useMemo(() => slugToTab(searchParams.get("pmtab")), [searchParams]);

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

    const displayTab: TabId = isPostMode ? "post" : (active === "post" && !canGoAfter ? "pre" : active);
    const allPFAnsweredForUI = displayTab === "pre" ? allPFAnsweredPre : allPFAnsweredPost;
    const missingPFItemsForUI = displayTab === "pre" ? missingPFItemsPre : missingPFItemsPost;

    // Format missing photo items for display
    const formatMissingPhotoItems = (items: number[]): string => {
        return items.map(no => {
            if (no === 90) return "9";
            if (no >= 101 && no <= 106) return `10.${no - 100}`;
            if (no >= 30 && no < 90) return `${Math.floor(no / 10)}.${no % 10}`;
            return String(no);
        }).join(", ");
    };

    // Format missingPhotoItems as string[] for PMValidationCard
    const missingPhotoItemsFormatted = useMemo(() => {
        return missingPhotoItems.map(no => {
            if (no === 90) return "9";
            if (no >= 101 && no <= 106) return `10.${no - 100}`;
            if (no >= 30 && no < 90) return `${Math.floor(no / 10)}.${no % 10}`;
            return String(no);
        });
    }, [missingPhotoItems]);

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
                <div className="tw-mx-auto tw-max-w-6xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl lg:tw-rounded-2xl tw-shadow-sm tw-p-3 sm:tw-p-6 lg:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0">
                    <div className="tw-flex tw-flex-col tw-gap-3 sm:tw-gap-4 lg:tw-flex-row lg:tw-items-start lg:tw-justify-between lg:tw-gap-6">
                        <div className="tw-flex tw-items-start tw-gap-2 sm:tw-gap-3 lg:tw-gap-4">
                            <div className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md tw-shrink-0 tw-h-10 tw-w-[48px] sm:tw-h-14 sm:tw-w-[64px] md:tw-h-16 md:tw-w-[76px] lg:tw-h-20 lg:tw-w-[108px]">
                                <Image src={LOGO_SRC} alt="Company logo" fill priority className="tw-object-contain tw-p-0" sizes="(min-width:1024px) 108px, (min-width:768px) 76px, (min-width:640px) 64px, 48px" />
                            </div>
                            <div className="tw-min-w-0 tw-flex-1">
                                <div className="tw-font-semibold tw-text-blue-gray-900 tw-text-[11px] sm:tw-text-xs md:tw-text-sm lg:tw-text-base tw-leading-tight">{t("pageTitle", lang)}</div>
                                <div className="tw-text-[9px] sm:tw-text-[10px] md:tw-text-xs lg:tw-text-sm tw-text-blue-gray-600 tw-leading-relaxed tw-mt-0.5">
                                    <span className="tw-hidden md:tw-inline">{t("companyName", lang)}<br />{t("companyAddress", lang)}<br /></span>
                                    <span className="md:tw-hidden">{t("companyAddressShort", lang)}<br /></span>
                                    {t("callCenter", lang)}
                                </div>
                            </div>
                        </div>
                        <div className="tw-text-left lg:tw-text-right tw-text-[10px] sm:tw-text-xs lg:tw-text-sm tw-text-blue-gray-700 tw-border-t tw-border-blue-gray-100 tw-pt-2 sm:tw-pt-3 lg:tw-border-t-0 lg:tw-pt-0 lg:tw-shrink-0">
                            <div className="tw-font-semibold">{t("docName", lang)}</div>
                            <div className="tw-break-all">{docName || "-"}</div>
                        </div>
                    </div>

                    <div className="tw-mt-4 sm:tw-mt-6 lg:tw-mt-8 tw-space-y-4 sm:tw-space-y-6 lg:tw-space-y-8">
                        <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-6 tw-gap-2 sm:tw-gap-3 lg:tw-gap-4">
                            <div className="tw-col-span-1 lg:tw-col-span-1">
                                <Input label={t("issueId", lang)} value={job.issue_id || "-"} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-bg-blue-gray-50 !tw-text-xs sm:!tw-text-sm" labelProps={{ className: "!tw-text-xs sm:!tw-text-sm" }} />
                            </div>
                            <div className="tw-col-span-1 lg:tw-col-span-2">
                                <Input label={t("location", lang)} value={job.station_name} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50 !tw-text-xs sm:!tw-text-sm" labelProps={{ className: "!tw-text-xs sm:!tw-text-sm" }} />
                            </div>
                            <div className="tw-col-span-1 lg:tw-col-span-2">
                                <Input label={t("inspector", lang)} value={inspector} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50 !tw-text-xs sm:!tw-text-sm" labelProps={{ className: "!tw-text-xs sm:!tw-text-sm" }} />
                            </div>
                            <div className="tw-col-span-1 lg:tw-col-span-1">
                                <Input label={t("pmDate", lang)} type="text" value={job.date} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50 !tw-text-xs sm:!tw-text-sm" labelProps={{ className: "!tw-text-xs sm:!tw-text-sm" }} />
                            </div>
                        </div>
                    </div>

                    <div className="tw-mt-6 sm:tw-mt-8 tw-space-y-4 sm:tw-space-y-6">
                        {QUESTIONS.filter((q) => !(displayTab === "pre" && q.no === 11)).map((q) => renderQuestionBlock(q, displayTab))}
                    </div>

                    <div id={`${ID_PREFIX}-summary-section`} className="tw-mt-6 sm:tw-mt-8 tw-space-y-3 tw-px-0 sm:tw-px-2 lg:tw-px-4">
                        <Typography variant="h6" className="tw-mb-1 tw-text-sm sm:tw-text-base">{t("comment", lang)}</Typography>
                        {displayTab === "post" && commentPre && (
                            <div className="tw-mb-2 sm:tw-mb-3 tw-p-2.5 sm:tw-p-3 tw-bg-amber-50 tw-rounded-lg tw-border tw-border-amber-300">
                                <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                                    <svg className="tw-w-3.5 tw-h-3.5 sm:tw-w-4 sm:tw-h-4 tw-text-amber-600 tw-flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <Typography variant="small" className="tw-font-semibold tw-text-amber-700 tw-text-[10px] sm:tw-text-xs">
                                        {lang === "th" ? "Comment (ก่อน PM)" : "Comment (Pre-PM)"}
                                    </Typography>
                                </div>
                                <Typography variant="small" className="tw-text-amber-900 tw-ml-5 sm:tw-ml-6 tw-text-xs sm:tw-text-sm">{commentPre}</Typography>
                            </div>
                        )}
                        <Textarea
                            label={t("comment", lang)}
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            rows={3}
                            required={isPostMode}
                            autoComplete="off"
                            containerProps={{ className: "!tw-min-w-0" }}
                            className="!tw-w-full !tw-text-sm resize-none"
                        />
                        {displayTab === "post" && (
                            <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-200">
                                <PassFailRow
                                    label={t("summaryResult", lang)}
                                    value={summaryCheck}
                                    onChange={(v) => setSummaryCheck(v)}
                                    lang={lang}
                                    labels={{ PASS: t("summaryPassLabel", lang), FAIL: t("summaryFailLabel", lang), NA: t("summaryNALabel", lang) }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="tw-mt-6 sm:tw-mt-8 tw-flex tw-flex-col tw-gap-3 tw-px-3 sm:tw-px-4 lg:tw-px-6">
                        <PMValidationCard
                            lang={lang}
                            displayTab={displayTab}
                            isPostMode={isPostMode}
                            allPhotosAttached={allPhotosAttached}
                            missingPhotoItems={missingPhotoItemsFormatted}
                            allRequiredInputsFilled={allRequiredInputsFilled}
                            missingInputsDetailed={missingInputsDetailed}
                            allRemarksFilledPre={allRemarksFilledPre}
                            missingRemarksPre={missingRemarksPre}
                            allPFAnsweredPost={allPFAnsweredForUI}
                            missingPFItemsPost={missingPFItemsForUI}
                            allRemarksFilledPost={allRemarksFilledPost}
                            missingRemarksPost={missingRemarksPost}
                            isSummaryFilled={isSummaryFilled}
                            isSummaryCheckFilled={isSummaryCheckFilled}
                        />
                        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-2 sm:tw-gap-3">
                            {displayTab === "pre" ? (
                                <Button
                                    type="button"
                                    onClick={onPreSave}
                                    disabled={!canGoAfter || submitting}
                                    className="tw-text-sm tw-py-2.5 tw-w-full sm:tw-w-auto tw-bg-gray-800 hover:tw-bg-gray-900 disabled:tw-bg-gray-800 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
                                >
                                    {submitting ? t("saving", lang) : t("save", lang)}
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={onFinalSave}
                                    disabled={!canFinalSave || submitting}
                                    className="tw-text-sm tw-py-2.5 tw-w-full sm:tw-w-auto tw-bg-gray-800 hover:tw-bg-gray-900 disabled:tw-bg-gray-800 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
                                >
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