"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import {
    Button,
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
import { putPhoto, getPhotoByDbKey, delPhoto, type PhotoRef } from "../lib/draftPhotos";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import { apiFetch } from "@/utils/api";
import LoadingOverlay from "@/app/dashboard/components/Loadingoverlay";

// ==================== GPS + ADDRESS CACHE ====================
let _cachedLocation: { text: string; timestamp: number } | null = null;
let _locationFetching = false;
const LOCATION_CACHE_MAX_AGE = 5 * 60 * 1000;

async function prefetchLocation(): Promise<void> {
    if (_locationFetching) return;
    _locationFetching = true;
    try {
        const gps = await getCurrentGPS();
        if (gps) {
            const text = await reverseGeocode(gps.lat, gps.lng);
            _cachedLocation = { text, timestamp: Date.now() };
        }
    } catch { /* silent */ }
    finally { _locationFetching = false; }
}

async function getCachedLocation(): Promise<string> {
    if (_cachedLocation && (Date.now() - _cachedLocation.timestamp) < LOCATION_CACHE_MAX_AGE) {
        void prefetchLocation();
        return _cachedLocation.text;
    }
    await prefetchLocation();
    return _cachedLocation?.text || "ไม่สามารถระบุตำแหน่งได้";
}

// ==================== BACKGROUND UPLOAD QUEUE ====================
type BgUploadTask = {
    reportId: string;
    stationId: string;
    group: string;
    file: File;
    side: "pre" | "post";
};
type BgUploadProgress = {
    total: number;
    completed: number;
    failed: number;
    inProgress: boolean;
    failures: { group: string; error: string }[];
};

let _bgQueue: BgUploadTask[] = [];
let _bgProgress: BgUploadProgress = { total: 0, completed: 0, failed: 0, inProgress: false, failures: [] };
let _bgListeners = new Set<(p: BgUploadProgress) => void>();
function _bgNotify() { _bgListeners.forEach(fn => fn({ ..._bgProgress, failures: [..._bgProgress.failures] })); }

function subscribeBgUpload(fn: (p: BgUploadProgress) => void) {
    _bgListeners.add(fn);
    fn({ ..._bgProgress, failures: [..._bgProgress.failures] });
    return () => { _bgListeners.delete(fn); };
}

function resetBgUpload() {
    _bgProgress = { total: 0, completed: 0, failed: 0, inProgress: false, failures: [] };
    _bgQueue = [];
    _bgNotify();
}

async function _bgCompressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
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
                if (blob && blob.size < file.size) resolve(new File([blob], ensureJpgFilename(file.name), { type: "image/jpeg" }));
                else resolve(file);
            }, "image/jpeg", quality);
        };
        img.onerror = () => { URL.revokeObjectURL(img.src); resolve(file); };
        img.src = URL.createObjectURL(file);
    });
}

async function _bgUploadSingle(reportId: string, stationId: string, group: string, file: File, side: "pre" | "post") {
    if (!file || file.size === 0) throw new Error(`Empty file: ${file?.name ?? "unknown"}`);
    const form = new FormData();
    form.append("station_id", stationId);
    form.append("group", group);
    form.append("side", side);
    form.append("files", file, ensureJpgFilename(file.name));
    const url = side === "pre"
        ? `${API_BASE}/mdbpmreport/${reportId}/pre/photos`
        : `${API_BASE}/mdbpmreport/${reportId}/post/photos`;
    const res = await apiFetch(url, { method: "POST", body: form });
    if (!res.ok) { const errText = await res.text().catch(() => ""); throw new Error(`[${res.status}] ${group}: ${errText || res.statusText}`); }
}

async function _bgUploadWithRetry(reportId: string, stationId: string, group: string, file: File, side: "pre" | "post", maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try { await _bgUploadSingle(reportId, stationId, group, file, side); return; }
        catch (err: any) {
            if (attempt === maxRetries) throw err;
            await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 8000)));
        }
    }
}

async function _bgProcessQueue() {
    if (_bgProgress.inProgress) return;
    _bgProgress.inProgress = true;
    _bgNotify();
    const CONCURRENCY = 3;
    while (_bgQueue.length > 0) {
        const batch = _bgQueue.splice(0, CONCURRENCY);
        const results = await Promise.allSettled(
            batch.map(async (task) => {
                const compressed = await _bgCompressImage(task.file);
                await _bgUploadWithRetry(task.reportId, task.stationId, task.group, compressed, task.side);
            })
        );
        results.forEach((r, idx) => {
            if (r.status === "fulfilled") _bgProgress.completed++;
            else { _bgProgress.failed++; _bgProgress.failures.push({ group: batch[idx].group, error: r.reason?.message || "unknown" }); }
        });
        _bgNotify();
    }
    _bgProgress.inProgress = false;
    _bgNotify();
}

function enqueueBgUploads(tasks: BgUploadTask[]) {
    if (tasks.length === 0) return;
    _bgProgress = { ..._bgProgress, total: _bgProgress.total + tasks.length };
    _bgQueue.push(...tasks);
    _bgNotify();
    void _bgProcessQueue();
}

type TabId = "pre" | "post";

const TABS: { id: TabId; label: string; slug: "pre" | "post" }[] = [
    { id: "pre", label: "Pre\u2011PM", slug: "pre" },
    { id: "post", label: "Post\u2011PM", slug: "post" },
];

function slugToTab(slug: string | null): TabId { return slug === "post" ? "post" : "pre"; }
function tabToSlug(tab: TabId): "pre" | "post" { return TABS.find(t => t.id === tab)!.slug; }

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const LOGO_SRC = "/img/logo_egat.png";

// ==================== TRANSLATIONS ====================
const T = {
    pageTitle: { th: "Preventive Maintenance Checklist - Main Distribution Board (MDB)", en: "Preventive Maintenance Checklist - Main Distribution Board (MDB)" },
    companyName: { th: "Electricity Generating Authority of Thailand (EGAT)", en: "Electricity Generating Authority of Thailand (EGAT)" },
    companyAddress: { th: "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand", en: "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand" },
    callCenter: { th: "Call Center Tel. 02-114-3350", en: "Call Center Tel. 02-114-3350" },
    docName: { th: "Document Name.", en: "Document Name." },
    issueId: { th: "Issue id", en: "Issue ID" },
    location: { th: "Location / สถานที่", en: "Location" },
    inspector: { th: "Inspector / ผู้ตรวจสอบ", en: "Inspector" },
    pmDate: { th: "PM Date / วันที่ตรวจสอบ", en: "PM Date" },
    save: { th: "บันทึก", en: "Save" },
    saving: { th: "กำลังบันทึก...", en: "Saving..." },
    attachPhoto: { th: "แนบรูป / ถ่ายรูป", en: "Attach / Take Photo" },
    takePhoto: { th: "ถ่ายรูป", en: "Take Photo" },
    na: { th: "N/A", en: "N/A" },
    cancelNA: { th: "ยกเลิก N/A", en: "Cancel N/A" },
    pass: { th: "PASS", en: "PASS" },
    fail: { th: "FAIL", en: "FAIL" },
    remark: { th: "หมายเหตุ *", en: "Remark *" },
    testResult: { th: "ผลการทดสอบ", en: "Test Result" },
    comment: { th: "Comment", en: "Comment" },
    summaryResult: { th: "สรุปผลการตรวจสอบ", en: "Summary Result" },
    summaryPassLabel: { th: "Pass : ผ่าน", en: "Pass" },
    summaryFailLabel: { th: "Fail : ไม่ผ่าน", en: "Fail" },
    summaryNALabel: { th: "N/A : ไม่พบ", en: "N/A" },
    maxPhotos: { th: "สูงสุด", en: "Max" },
    photos: { th: "รูป", en: "photos" },
    noPhotos: { th: "ยังไม่มีรูปแนบ", en: "No photos attached" },
    prePM: { th: "ก่อน PM", en: "Pre-PM" },
    postPM: { th: "หลัง PM", en: "Post-PM" },
    preRemarkLabel: { th: "หมายเหตุ (ก่อน PM)", en: "Remark (Pre-PM)" },
    breakerMainCount: { th: "จำนวน Breaker Main:", en: "Breaker Main count:" },
    unit: { th: "ตัว", en: "units" },
    addBreakerMain: { th: "เพิ่ม", en: "Add" },
    chargerCountLabel: { th: "จำนวนตู้ชาร์จใน Station นี้:", en: "Chargers in this station:" },
    chargerUnit: { th: "ตู้", en: "chargers" },
    breakerCCBCount: { th: "จำนวน Breaker CCB:", en: "Breaker CCB count:" },
    breakerCCBMax: { th: "ตัว (สูงสุด 4 ตัว)", en: "units (max 4)" },
    addBreakerCCB: { th: "เพิ่ม", en: "Add" },
    rcdCount: { th: "จำนวน RCD (ตามจำนวนตู้ชาร์จ):", en: "RCD count (per charger):" },
    breakerChargerCount: { th: "จำนวน Breaker Charger (ตามจำนวนตู้ชาร์จ):", en: "Breaker Charger (per charger):" },
    allComplete: { th: "ครบเรียบร้อย ✅", en: "Complete ✅" },
    alertNoStation: { th: "ยังไม่ทราบ station_id", en: "Station ID not found" },
    alertFillVoltage: { th: "กรุณากรอกค่าแรงดันไฟฟ้าให้ครบก่อนบันทึก", en: "Please fill all voltage values" },
    alertFillRemark: { th: "กรุณากรอกหมายเหตุข้อ:", en: "Please fill remarks:" },
    alertFillPreFirst: { th: "กรุณากรอกข้อมูลในส่วน Pre ให้ครบก่อน", en: "Please complete Pre-PM first" },
    alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },
    dustFilterChanged: { th: "เปลี่ยนแผ่นกรองระบายอากาศ", en: "Ventilation filter replaced" },
    photoNotComplete: { th: "กรุณาแนบรูปในส่วน Pre ให้ครบก่อนบันทึก", en: "Please attach all Pre-PM photos" },
    inputNotComplete: { th: "กรุณากรอกค่าข้อ 4-8 ให้ครบก่อนบันทึก", en: "Please fill items 4-8" },
    allNotComplete: { th: "กรุณากรอกข้อมูล / แนบรูป และสรุปผลให้ครบก่อนบันทึก", en: "Please complete all data" },
    remarkLabel: { th: "หมายเหตุ", en: "Remark" },
    itemLabel: { th: "ข้อ", en: "Item" },
    formStatus: { th: "สถานะการกรอกข้อมูล", en: "Form Completion Status" },
    allCompleteReady: { th: "กรอกข้อมูลครบถ้วนแล้ว พร้อมบันทึก ✓", en: "All fields completed. Ready to save ✓" },
    remaining: { th: "ยังขาดอีก {n} รายการ", en: "{n} items remaining" },
    items: { th: "รายการ", en: "items" },
    missingPhoto: { th: "ยังไม่ได้แนบรูปข้อ:", en: "Missing photos:" },
    missingSummaryText: { th: "ยังไม่ได้กรอกข้อความสรุปผลการตรวจสอบ", en: "Summary text not filled" },
    missingSummaryStatus: { th: "ยังไม่ได้เลือกสถานะสรุปผล (Pass/Fail/N/A)", en: "Summary status not selected" },
    backToList: { th: "กลับไปหน้า List", en: "Back to List" },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

const ID_PREFIX = "mdb-pm";
const getPhotoIdFromKey = (key: string | number): string => { if (typeof key === "number") return `${ID_PREFIX}-photo-${key}`; const m = String(key).match(/^r(\d+)(?:_(\d+))?$/); return m ? (m[2] ? `${ID_PREFIX}-photo-${m[1]}-${m[2]}` : `${ID_PREFIX}-photo-${m[1]}`) : `${ID_PREFIX}-photo-${key}`; };
const getRemarkIdFromKey = (key: string | number): string => { if (typeof key === "number") return `${ID_PREFIX}-remark-${key}`; const m = String(key).match(/^r(\d+)(?:_(\d+))?$/); return m ? (m[2] ? `${ID_PREFIX}-remark-${m[1]}-${m[2]}` : `${ID_PREFIX}-remark-${m[1]}`) : `${ID_PREFIX}-remark-${key}`; };
const getInputIdFromKey = (key: string | number): string => { if (typeof key === "number") return `${ID_PREFIX}-input-${key}`; const m = String(key).match(/^r(\d+)(?:_(\d+))?$/); return m ? (m[2] ? `${ID_PREFIX}-input-${m[1]}-${m[2]}` : `${ID_PREFIX}-input-${m[1]}`) : `${ID_PREFIX}-input-${key}`; };
const getPfIdFromKey = (key: string | number): string => { if (typeof key === "number") return `${ID_PREFIX}-pf-${key}`; const m = String(key).match(/^r(\d+)(?:_(\d+))?$/); return m ? (m[2] ? `${ID_PREFIX}-pf-${m[1]}-${m[2]}` : `${ID_PREFIX}-pf-${m[1]}`) : `${ID_PREFIX}-pf-${key}`; };

// Questions
const QUESTIONS_DATA = [
    { no: 1, key: "r1", label: { th: "1) ตรวจสอบสภาพทั่วไป", en: "1) General condition inspection" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบโครงสร้างตู้ ระบบล็อกและบานพับรวมถึงป้ายชื่อวงจร (Labeling)", en: "Check cabinet structure, lock system, hinges and circuit labeling" } },
    { no: 2, key: "r2", label: { th: "2) ตรวจสอบดักซีล, ซิลิโคนกันซึม", en: "2) Check sealant and silicone" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบสภาพดักซีลที่ปิดหรืออุดตามรอยต่อและช่องทางเข้าสาย", en: "Check sealant condition at joints and cable entry points" } },
    { no: 3, key: "r3", label: { th: "3) ตรวจสอบ Power Meter", en: "3) Check Power Meter" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบการแสดงของจอ Power Meter และความถูกต้องของค่าพารามิเตอร์ไฟฟ้า (V, A, Hz, PF)", en: "Check Power Meter display and parameters (V, A, Hz, PF)" } },
    { no: 4, key: "r4", label: { th: "4) ตรวจสอบแรงดันไฟฟ้า Breaker Main", en: "4) Check Breaker Main voltage" }, kind: "dynamic_measure", hasPhoto: true, tooltip: { th: "วัดค่าแรงดันไฟฟ้าด้านเข้าของ Breaker Main", en: "Measure input voltage of Breaker Main" } },
    { no: 5, key: "r5", label: { th: "5) ตรวจสอบแรงดันไฟฟ้า Breaker Charger", en: "5) Check Breaker Charger voltage" }, kind: "charger_measure", hasPhoto: true, tooltip: { th: "วัดค่าแรงดันไฟฟ้าด้านเข้าของ Breaker Charger", en: "Measure input voltage of Breaker Charger" } },
    { no: 6, key: "r6", label: { th: "6) ตรวจสอบแรงดันไฟฟ้า Breaker CCB", en: "6) Check Breaker CCB voltage" }, kind: "ccb_measure", hasPhoto: true, tooltip: { th: "วัดค่าแรงดันไฟฟ้าด้านเข้าของ Breaker CCB", en: "Measure input voltage of Breaker CCB" } },
    { no: 7, key: "r7", label: { th: "7) ตรวจสอบแรงดันไฟฟ้า RCD", en: "7) Check RCD voltage" }, kind: "rcd_measure", hasPhoto: true, tooltip: { th: "วัดค่าแรงดันไฟฟ้าด้าน Load ของอุปกรณ์ป้องกันไฟรั่ว (RCD)", en: "Measure load side voltage of RCD" } },
    { no: 8, key: "r8", label: { th: "8) ทดสอบปุ่ม Trip Test RCD", en: "8) Test RCD Trip button" }, kind: "trip_rcd", hasPhoto: true, tooltip: { th: "กดปุ่ม Test เพื่อทดสอบกลไกการตัดกระแสไฟรั่วของ RCD", en: "Press Test button to test RCD trip mechanism" } },
    { no: 9, key: "r9", label: { th: "9) ทดสอบปุ่ม Trip Test Breaker CCB", en: "9) Test Breaker CCB Trip button" }, kind: "trip_ccb", hasPhoto: true, tooltip: { th: "กดปุ่ม Test เพื่อทดสอบกลไกการตัดวงจรของ Breaker CCB", en: "Press Test button to test Breaker CCB trip mechanism" } },
    { no: 10, key: "r10", label: { th: "10) ทดสอบปุ่ม Trip Test Breaker Charger", en: "10) Test Breaker Charger Trip button" }, kind: "trip_charger", hasPhoto: true, tooltip: { th: "กดปุ่ม Test เพื่อทดสอบกลไกการตัดวงจรของ Breaker Charger", en: "Press Test button to test Breaker Charger trip mechanism" } },
    { no: 11, key: "r11", label: { th: "11) ทดสอบปุ่ม Trip Test Breaker Main", en: "11) Test Breaker Main Trip button" }, kind: "trip_main", hasPhoto: true, tooltip: { th: "กดปุ่ม Test เพื่อทดสอบกลไกการตัดวงจรของ Breaker Main", en: "Press Test button to test Breaker Main trip mechanism" } },
    { no: 12, key: "r12", label: { th: "12) ตรวจสอบจุดต่อทางไฟฟ้า", en: "12) Check electrical connections" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบการขันแน่นของน็อตบริเวณจุดต่อสายและตรวจเช็ครอยไหม้ด้วยกล้องถ่ายภาพความร้อน", en: "Check bolt tightness at connection points and inspect for burn marks using thermal camera" } },
    { no: 13, key: "r13", label: { th: "13) ทำความสะอาดตู้ MDB", en: "13) Clean MDB cabinet" }, kind: "simple", hasPhoto: true, tooltip: { th: "ทำความสะอาดโดยการขจัดฝุ่นและสิ่งสกปรกภายในตู้ด้วยเครื่องดูดฝุ่นหรือเป่าลมแห้ง", en: "Clean by removing dust inside cabinet with vacuum or dry air" } },
] as const;

const getDynamicLabel = {
    breakerMain: (idx: number, lang: Lang) => lang === "th" ? `4.${idx}) Breaker Main ตัวที่ ${idx}` : `4.${idx}) Breaker Main #${idx}`,
    breakerCharger: (idx: number, lang: Lang) => lang === "th" ? `5.${idx}) Breaker Charger ตัวที่ ${idx}` : `5.${idx}) Breaker Charger #${idx}`,
    breakerCCB: (idx: number, lang: Lang) => lang === "th" ? `6.${idx}) Breaker CCB ตัวที่ ${idx}` : `6.${idx}) Breaker CCB #${idx}`,
    rcd: (idx: number, lang: Lang) => lang === "th" ? `7.${idx}) RCD ตัวที่ ${idx}` : `7.${idx}) RCD #${idx}`,
    tripRCD: (idx: number, lang: Lang) => lang === "th" ? `8.${idx}) Trip Test RCD ตัวที่ ${idx}` : `8.${idx}) Trip Test RCD #${idx}`,
    tripCCB: (idx: number, lang: Lang) => lang === "th" ? `9.${idx}) Trip Test Breaker CCB ตัวที่ ${idx}` : `9.${idx}) Trip Test Breaker CCB #${idx}`,
    tripCharger: (idx: number, lang: Lang) => lang === "th" ? `10.${idx}) Trip Test Breaker Charger ตัวที่ ${idx}` : `10.${idx}) Trip Test Breaker Charger #${idx}`,
    tripMain: (idx: number, lang: Lang) => lang === "th" ? `11.${idx}) Trip Test Breaker Main ตัวที่ ${idx}` : `11.${idx}) Trip Test Breaker Main #${idx}`,
};

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

async function getChargerCountByStation(stationId: string): Promise<number> {
    try {
        const url = `${API_BASE}/chargers/${encodeURIComponent(stationId)}`;
        const res = await apiFetch(url, { cache: "no-store", credentials: "include" });
        if (!res.ok) return 1;
        const json = await res.json();
        return Array.isArray(json.chargers) ? json.chargers.length || 1 : 1;
    } catch { return 1; }
}

const UNITS = { voltage: ["V"] as const };
type UnitVoltage = (typeof UNITS.voltage)[number];

type PhotoItem = {
    id: string; file?: File; preview?: string; remark?: string;
    uploading?: boolean; error?: string; ref?: PhotoRef; isNA?: boolean;
    createdAt?: string; location?: string;
};

type Question = {
    no: number; key: string;
    label: { th: string; en: string };
    kind: string; hasPhoto?: boolean;
    tooltip?: { th: string; en: string };
    items?: { key: string; label: { th: string; en: string } }[];
};

const VOLTAGE_FIELDS = ["L1-N", "L2-N", "L3-N", "L1-G", "L2-G", "L3-G", "L1-L2", "L2-L3", "L3-L1", "N-G"] as const;
const VOLTAGE_FIELDS_CCB = ["L1-N", "L1-G", "N-G"] as const;
const LABELS: Record<string, string> = { "L1-L2": "L1-L2", "L2-L3": "L2-L3", "L3-L1": "L3-L1", "L1-N": "L1-N", "L2-N": "L2-N", "L3-N": "L3-N", "L1-G": "L1-G", "L2-G": "L2-G", "L3-G": "L3-G", "N-G": "N-G" };
const QUESTIONS = QUESTIONS_DATA as unknown as Question[];

function getQuestionLabel(q: Question, mode: TabId, lang: Lang): string {
    const b = q.label[lang];
    return mode === "pre" ? (lang === "th" ? `${b} (ก่อน PM)` : `${b} (Pre-PM)`) : (lang === "th" ? `${b} (หลัง PM)` : `${b} (Post-PM)`);
}

const FIELD_GROUPS: Record<number, { keys: readonly string[]; unitType: "voltage" } | undefined> = {
    4: { keys: VOLTAGE_FIELDS, unitType: "voltage" },
    5: { keys: VOLTAGE_FIELDS, unitType: "voltage" },
    6: { keys: VOLTAGE_FIELDS_CCB, unitType: "voltage" },
    7: { keys: VOLTAGE_FIELDS_CCB, unitType: "voltage" },
};

type MeasureRow<U extends string> = { value: string; unit: U };
type MeasureState<U extends string> = Record<string, MeasureRow<U>>;
type PF = "PASS" | "FAIL" | "NA" | "";

function initMeasureState<U extends string>(keys: readonly string[], defaultUnit: U): MeasureState<U> {
    return keys.reduce((acc, k) => { acc[k] = { value: "", unit: defaultUnit }; return acc; }, {} as MeasureState<U>);
}

function useMeasure<U extends string>(keys: readonly string[], defaultUnit: U) {
    const [state, setState] = useState<MeasureState<U>>(() => initMeasureState(keys, defaultUnit));
    const patch = (key: string, p: Partial<MeasureRow<U>>) => setState(prev => ({ ...prev, [key]: { ...prev[key], ...p } }));
    const syncUnits = (u: U) => setState(prev => { const n = { ...prev }; keys.forEach(k => (n[k] = { ...prev[k], unit: u })); return n; });
    return { state, setState, patch, syncUnits };
}

function useDebouncedEffect(effect: () => void, deps: any[], delay = 800) {
    useEffect(() => { const h = setTimeout(effect, delay); return () => clearTimeout(h); }, deps);
}

// ==================== GPS ====================
async function getCurrentGPS(): Promise<{ lat: number; lng: number } | null> {
    if (!navigator.geolocation) return null;
    if (window.isSecureContext === false) return null;
    const fast = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 2000);
        navigator.geolocation.getCurrentPosition(
            (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
            () => { clearTimeout(timer); resolve(null); },
            { enableHighAccuracy: false, timeout: 1500, maximumAge: 300000 }
        );
    });
    if (fast) return fast;
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 8000);
        navigator.geolocation.getCurrentPosition(
            (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
            () => { clearTimeout(timer); resolve(null); },
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 30000 }
        );
    });
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

async function reverseGeocodeGoogle(lat: number, lng: number): Promise<string | null> {
    if (!GOOGLE_MAPS_KEY) return null;
    try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 5000);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=th&result_type=street_address|route|premise&key=${GOOGLE_MAPS_KEY}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(tid);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.status !== "OK" || !data.results?.length) return null;
        const best = data.results[0];
        const c = best.address_components || [];
        const get = (type: string) => c.find((x: any) => x.types?.includes(type))?.long_name || "";
        const parts: string[] = [];
        const premise = get("premise"); if (premise) parts.push(premise);
        const hn = get("street_number"), road = get("route");
        if (hn && road) parts.push(`${hn} ${road}`); else if (road) parts.push(road);
        const sub2 = get("sublocality_level_2"); if (sub2 && !parts.some(p => p.includes(sub2))) parts.push(sub2);
        const sub1 = get("sublocality_level_1"); if (sub1 && !parts.some(p => p.includes(sub1))) parts.push(sub1);
        const dist = get("locality") || get("administrative_area_level_2"); if (dist && !parts.some(p => p.includes(dist))) parts.push(dist);
        const prov = get("administrative_area_level_1"); if (prov && !parts.some(p => p.includes(prov))) parts.push(prov);
        if (parts.length > 0) { let r = parts.join(" "); return r.length > 80 ? r.substring(0, 77) + "..." : r; }
        if (best.formatted_address) { const a = best.formatted_address.replace(/\s*\d{5}\s*/, " ").replace(/ประเทศไทย/g, "").trim(); return a.length > 80 ? a.substring(0, 77) + "..." : a; }
        return null;
    } catch { return null; }
}

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<string> {
    try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 5000);
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=th&zoom=21&addressdetails=1`;
        const res = await fetch(url, { headers: { "User-Agent": "PM-Checklist-App/1.0" }, signal: controller.signal });
        clearTimeout(tid);
        if (!res.ok) return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        const data = await res.json();
        const addr = data.address || {};
        const poi = addr.amenity || addr.building || addr.shop || addr.tourism || "";
        let roadPart = "";
        const hn = addr.house_number || "", road = addr.road || addr.pedestrian || "";
        if (hn && road) roadPart = `${hn} ${road}`; else if (road) roadPart = road;
        const village = addr.village || addr.neighbourhood || addr.residential || "";
        const subdistrict = addr.subdistrict || addr.suburb || "";
        const district = addr.district || addr.city_district || "";
        const province = addr.province || addr.state || addr.city || "";
        const rawParts = [poi, roadPart, village, subdistrict, district, province].filter(Boolean);
        const parts: string[] = [];
        for (const p of rawParts) { if (!parts.some(e => e.includes(p) || p.includes(e))) parts.push(p); }
        if (parts.length > 0) { let r = parts.slice(0, 4).join(" "); return r.length > 70 ? r.substring(0, 67) + "..." : r; }
        if (data.display_name) { const s = data.display_name.split(",").slice(0, 4).join(",").trim(); return s.length > 70 ? s.substring(0, 67) + "..." : s; }
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch { return `${lat.toFixed(6)}, ${lng.toFixed(6)}`; }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
    const google = await reverseGeocodeGoogle(lat, lng);
    if (google) return google;
    return reverseGeocodeNominatim(lat, lng);
}

// ==================== IMAGE UTILS ====================
function ensureJpgFilename(name: string): string {
    if (!name) return `image_${Date.now()}.jpg`;
    const dot = name.lastIndexOf(".");
    if (dot <= 0) return `${name}.jpg`;
    return `${name.substring(0, dot)}.jpg`;
}

async function addTimestampToImage(file: File, locationText: string): Promise<File> {
    return new Promise((resolve) => {
        const img = document.createElement("img");
        img.onload = () => {
            try {
                URL.revokeObjectURL(img.src);
                const canvas = document.createElement("canvas");
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) { resolve(file); return; }
                ctx.drawImage(img, 0, 0);
                const now = new Date();
                const timestamp = now.toLocaleString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
                const fontSize = Math.max(14, Math.floor(img.width * 0.022));
                const padding = Math.floor(fontSize * 0.5);
                const lineHeight = fontSize * 1.3;
                ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                const tsWidth = ctx.measureText(timestamp).width;
                const locDisplay = `📍 ${locationText}`;
                const locWidth = ctx.measureText(locDisplay).width;
                const totalHeight = lineHeight * 2;
                const boxWidth = Math.max(Math.floor(img.width * 0.6), Math.max(tsWidth, locWidth) + padding * 2);
                const bgX = 10, bgY = Math.max(0, img.height - totalHeight - padding * 2 - 10);
                ctx.fillStyle = "rgba(0,0,0,0.65)";
                ctx.fillRect(bgX, bgY, boxWidth, totalHeight + padding * 2);
                ctx.fillStyle = "#FFFFFF"; ctx.textBaseline = "top";
                ctx.fillText(timestamp, bgX + padding, bgY + padding);
                let locText = locDisplay;
                while (ctx.measureText(locText).width > boxWidth - padding * 2 && locText.length > 10) locText = locText.slice(0, -4) + "...";
                ctx.fillText(locText, bgX + padding, bgY + padding + lineHeight);
                canvas.toBlob((blob) => {
                    if (blob) resolve(new File([blob], ensureJpgFilename(file.name), { type: "image/jpeg" }));
                    else resolve(file);
                }, "image/jpeg", 0.9);
            } catch { resolve(file); }
        };
        img.onerror = () => { URL.revokeObjectURL(img.src); resolve(file); };
        img.src = URL.createObjectURL(file);
    });
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(img.src); };
        img.onerror = () => { reject(new Error("Cannot read image")); URL.revokeObjectURL(img.src); };
        img.src = URL.createObjectURL(file);
    });
}

function isMobileDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || ("ontouchstart" in window && navigator.maxTouchPoints > 0);
}

// ==================== UI COMPONENTS ====================
function PassFailRow({ label, value, onChange, remark, onRemarkChange, labels, aboveRemark, beforeRemark, belowRemark, inlineLeft, lang, remarkId, pfButtonsId }: {
    label: string; value: PF; onChange: (v: Exclude<PF, "">) => void;
    remark?: string; onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
    aboveRemark?: React.ReactNode; beforeRemark?: React.ReactNode; belowRemark?: React.ReactNode; inlineLeft?: React.ReactNode;
    lang: Lang; remarkId?: string; pfButtonsId?: string;
}) {
    const text = { PASS: labels?.PASS ?? t("pass", lang), FAIL: labels?.FAIL ?? t("fail", lang), NA: labels?.NA ?? t("na", lang) };
    const buttonGroup = (
        <div id={pfButtonsId} className="tw-flex tw-gap-2 tw-ml-auto tw-transition-all tw-duration-300">
            <Button size="sm" color="green" variant={value === "PASS" ? "filled" : "outlined"} className="sm:tw-min-w-[84px]" onClick={() => onChange("PASS")}>{text.PASS}</Button>
            <Button size="sm" color="red" variant={value === "FAIL" ? "filled" : "outlined"} className="sm:tw-min-w-[84px]" onClick={() => onChange("FAIL")}>{text.FAIL}</Button>
            <Button size="sm" color="blue-gray" variant={value === "NA" ? "filled" : "outlined"} className="sm:tw-min-w-[84px]" onClick={() => onChange("NA")}>{text.NA}</Button>
        </div>
    );
    const buttonsRow = (<div className="tw-flex tw-items-center tw-gap-3 tw-w-full">{inlineLeft && <div className="tw-flex tw-items-center tw-gap-2">{inlineLeft}</div>}{buttonGroup}</div>);
    return (
        <div className="tw-space-y-3 tw-py-3">
            <Typography className="tw-font-medium">{label}</Typography>
            {onRemarkChange ? (
                <div className="tw-w-full tw-min-w-0 tw-space-y-2">
                    {aboveRemark}{buttonsRow}{beforeRemark}
                    <div id={remarkId} className="tw-transition-all tw-duration-300">
                        <Textarea label={t("remark", lang)} value={remark || ""} onChange={(e) => onRemarkChange(e.target.value)} containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full" />
                    </div>
                    {belowRemark}
                </div>
            ) : (
                <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">{buttonsRow}</div>
            )}
        </div>
    );
}

function SectionCard({ title, subtitle, children, tooltip, id }: { title?: string; subtitle?: string; children: React.ReactNode; tooltip?: string; id?: string; }) {
    const qNumber = title?.match(/^(\d+)\)/)?.[1];
    return (
        <div id={id} className="tw-bg-white tw-rounded-xl tw-border tw-border-gray-200 tw-shadow-sm tw-overflow-hidden tw-transition-all tw-duration-300">
            {title && (
                <div className="tw-bg-gray-800 tw-px-3 sm:tw-px-4 tw-py-2.5 sm:tw-py-3">
                    <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-3">
                        {qNumber && (<div className="tw-flex-shrink-0 tw-w-7 tw-h-7 sm:tw-w-8 sm:tw-h-8 tw-rounded-full tw-bg-white tw-text-gray-800 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-xs sm:tw-text-sm">{qNumber}</div>)}
                        <Typography variant="h6" className="tw-text-white tw-text-sm sm:tw-text-base tw-font-semibold tw-flex-1">{qNumber ? title.replace(/^\d+\)\s*/, '') : title}</Typography>
                        {tooltip && (<Tooltip content={tooltip} placement="bottom"><svg className="tw-w-4 tw-h-4 sm:tw-w-5 sm:tw-h-5 tw-text-gray-400 tw-cursor-help tw-flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg></Tooltip>)}
                    </div>
                    {subtitle && <Typography variant="small" className="!tw-text-gray-300 tw-text-xs sm:tw-text-sm tw-mt-1 tw-ml-9 sm:tw-ml-11">{subtitle}</Typography>}
                </div>
            )}
            <div className="tw-p-3 sm:tw-p-4 tw-space-y-3 sm:tw-space-y-4">{children}</div>
        </div>
    );
}

// ==================== VALIDATION CARD ====================
interface ValidationError { section: string; sectionIcon: string; itemName: string; message: string; scrollId?: string; }
interface MissingInputItem { qNo: number; subNo?: number; label: string; fieldKey: string; }
interface PMValidationCardProps {
    lang: Lang; displayTab: TabId; isPostMode: boolean;
    allPhotosAttached: boolean; missingPhotoItems: string[];
    allRequiredInputsFilled: boolean; missingInputsDetailed: MissingInputItem[];
    allRemarksFilledPre: boolean; missingRemarksPre: string[];
    allPFAnsweredPost: boolean; missingPFItemsPost: string[];
    allRemarksFilledPost: boolean; missingRemarksPost: string[];
    isSummaryFilled: boolean; isSummaryCheckFilled: boolean;
}

function PMValidationCard({ lang, displayTab, isPostMode, allPhotosAttached, missingPhotoItems, allRequiredInputsFilled, missingInputsDetailed, allRemarksFilledPre, missingRemarksPre, allPFAnsweredPost, missingPFItemsPost, allRemarksFilledPost, missingRemarksPost, isSummaryFilled, isSummaryCheckFilled }: PMValidationCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const getPhotoScrollId = (item: string) => { const p = item.split('.'); return p.length === 2 ? `${ID_PREFIX}-photo-${p[0]}-${p[1]}` : `${ID_PREFIX}-photo-${p[0]}`; };
    const getRemarkScrollId = (item: string) => { const p = item.split('.'); return p.length === 2 ? `${ID_PREFIX}-remark-${p[0]}-${p[1]}` : `${ID_PREFIX}-remark-${p[0]}`; };
    const getPfScrollId = (item: string) => { const p = item.split('.'); return p.length === 2 ? `${ID_PREFIX}-pf-${p[0]}-${p[1]}` : `${ID_PREFIX}-pf-${p[0]}`; };

    const allErrors: ValidationError[] = useMemo(() => {
        const errors: ValidationError[] = [];
        if (!allPhotosAttached) {
            missingPhotoItems.forEach(item => errors.push({ section: lang === "th" ? "รูปภาพ" : "Photos", sectionIcon: "📷", itemName: `${t("itemLabel", lang)} ${item}`, message: t("missingPhoto", lang).replace(":", ""), scrollId: getPhotoScrollId(item) }));
        }
        if (!allRequiredInputsFilled) {
            missingInputsDetailed.forEach(({ qNo, subNo, label }) => {
                errors.push({ section: lang === "th" ? "ค่าที่ต้องกรอก" : "Required Inputs", sectionIcon: "📝", itemName: `${t("itemLabel", lang)} ${subNo ? `${qNo}.${subNo}` : qNo}`, message: lang === "th" ? `ยังไม่ได้กรอกค่า ${label}` : `${label} value not filled`, scrollId: subNo ? `${ID_PREFIX}-input-${qNo}-${subNo}` : `${ID_PREFIX}-question-${qNo}` });
            });
        }
        if (displayTab === "pre" && !allRemarksFilledPre) {
            missingRemarksPre.forEach(item => errors.push({ section: lang === "th" ? "หมายเหตุ" : "Remarks", sectionIcon: "💬", itemName: `${t("itemLabel", lang)} ${item}`, message: lang === "th" ? "ยังไม่ได้กรอกหมายเหตุ" : "Remark not filled", scrollId: getRemarkScrollId(item) }));
        }
        if (isPostMode) {
            if (!allPFAnsweredPost) missingPFItemsPost.forEach(item => errors.push({ section: lang === "th" ? "สถานะ PASS/FAIL/N/A" : "PASS/FAIL/N/A Status", sectionIcon: "✅", itemName: `${t("itemLabel", lang)} ${item}`, message: lang === "th" ? "ยังไม่ได้เลือกสถานะ" : "Status not selected", scrollId: getPfScrollId(item) }));
            if (!allRemarksFilledPost) missingRemarksPost.forEach(item => errors.push({ section: lang === "th" ? "หมายเหตุ" : "Remarks", sectionIcon: "💬", itemName: `${t("itemLabel", lang)} ${item}`, message: lang === "th" ? "ยังไม่ได้กรอกหมายเหตุ" : "Remark not filled", scrollId: getRemarkScrollId(item) }));
            if (!isSummaryFilled) errors.push({ section: lang === "th" ? "สรุปผลการตรวจสอบ" : "Inspection Summary", sectionIcon: "📋", itemName: "Comment", message: t("missingSummaryText", lang), scrollId: "mdb-pm-summary-section" });
            if (!isSummaryCheckFilled) errors.push({ section: lang === "th" ? "สรุปผลการตรวจสอบ" : "Inspection Summary", sectionIcon: "📋", itemName: lang === "th" ? "สถานะสรุปผล" : "Summary Status", message: t("missingSummaryStatus", lang), scrollId: "mdb-pm-summary-section" });
        }
        return errors;
    }, [lang, displayTab, isPostMode, allPhotosAttached, missingPhotoItems, allRequiredInputsFilled, missingInputsDetailed, allRemarksFilledPre, missingRemarksPre, allPFAnsweredPost, missingPFItemsPost, allRemarksFilledPost, missingRemarksPost, isSummaryFilled, isSummaryCheckFilled]);

    const groupedErrors = useMemo(() => {
        const m = new Map<string, ValidationError[]>();
        allErrors.forEach(e => { const k = `${e.sectionIcon} ${e.section}`; m.set(k, [...(m.get(k) || []), e]); });
        return m;
    }, [allErrors]);

    const isComplete = allErrors.length === 0;

    const scrollToItem = (scrollId?: string) => {
        if (!scrollId) return;
        const el = document.getElementById(scrollId);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50");
            setTimeout(() => el.classList.remove("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50"), 2000);
        }
    };

    return (
        <div className={`tw-rounded-xl tw-border tw-shadow-sm tw-overflow-hidden ${isComplete ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
            <div className={`tw-px-4 tw-py-3 tw-cursor-pointer tw-flex tw-items-center tw-justify-between ${isComplete ? "tw-bg-green-100" : "tw-bg-amber-100"}`} onClick={() => setIsExpanded(!isExpanded)}>
                <div className="tw-flex tw-items-center tw-gap-3">
                    {isComplete ? (
                        <div className="tw-w-10 tw-h-10 tw-rounded-full tw-bg-green-500 tw-flex tw-items-center tw-justify-center"><svg className="tw-w-6 tw-h-6 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                    ) : (
                        <div className="tw-w-10 tw-h-10 tw-rounded-full tw-bg-amber-500 tw-flex tw-items-center tw-justify-center"><svg className="tw-w-6 tw-h-6 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                    )}
                    <div>
                        <Typography className={`tw-font-bold tw-text-base ${isComplete ? "tw-text-green-800" : "tw-text-amber-800"}`}>{t("formStatus", lang)}</Typography>
                        <Typography variant="small" className={isComplete ? "tw-text-green-600" : "tw-text-amber-600"}>{isComplete ? t("allCompleteReady", lang) : t("remaining", lang).replace("{n}", String(allErrors.length))}</Typography>
                    </div>
                </div>
                <div className="tw-flex tw-items-center tw-gap-4">
                    {!isComplete && (<div className="tw-hidden md:tw-flex tw-items-center tw-gap-2">{Array.from(groupedErrors.keys()).map(k => (<span key={k} className="tw-text-xs tw-bg-amber-200 tw-text-amber-800 tw-px-2 tw-py-1 tw-rounded-full tw-font-medium">{k.split(" ")[0]} {groupedErrors.get(k)?.length}</span>))}</div>)}
                    {!isComplete && (<svg className={`tw-w-6 tw-h-6 tw-text-amber-600 tw-transition-transform ${isExpanded ? "tw-rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>)}
                </div>
            </div>
            {isExpanded && !isComplete && (
                <div className="tw-px-4 tw-py-3 tw-max-h-80 tw-overflow-y-auto">
                    <div className="tw-space-y-4">
                        {Array.from(groupedErrors.entries()).map(([sectionKey, sectionErrors]) => (
                            <div key={sectionKey} className="tw-bg-white tw-rounded-lg tw-p-3 tw-border tw-border-amber-200">
                                <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
                                    <Typography className="tw-font-semibold tw-text-gray-800 tw-text-sm">{sectionKey}</Typography>
                                    <span className="tw-text-xs tw-bg-amber-100 tw-text-amber-700 tw-px-2 tw-py-0.5 tw-rounded-full">{sectionErrors.length} {t("items", lang)}</span>
                                </div>
                                <ul className="tw-space-y-1 tw-max-h-40 tw-overflow-y-auto">
                                    {sectionErrors.map((error, idx) => (
                                        <li key={idx} className="tw-flex tw-items-start tw-gap-2 tw-text-sm tw-text-amber-700 tw-cursor-pointer hover:tw-text-amber-900 hover:tw-bg-amber-50 tw-rounded tw-px-1 tw-py-0.5 tw-transition-colors" onClick={() => scrollToItem(error.scrollId)}>
                                            <span className="tw-text-amber-500 tw-mt-0.5">→</span>
                                            <span><span className="tw-font-medium">{error.itemName}:</span> <span className="tw-underline tw-underline-offset-2">{error.message}</span></span>
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

function InputWithUnit<U extends string>({ label, value, unit, units, onValueChange, onUnitChange, readOnly, disabled, required = true }: {
    label: string; value: string; unit: U; units: readonly U[];
    onValueChange: (v: string) => void; onUnitChange: (u: U) => void;
    readOnly?: boolean; disabled?: boolean; required?: boolean;
}) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        if (v === "" || v === "-" || /^-?\d*\.?\d*$/.test(v)) onValueChange(v);
    };
    return (
        <div className="tw-flex tw-items-center tw-gap-2">
            <div className="tw-flex-1 tw-relative">
                <input type="text" inputMode="text" pattern="-?[0-9]*\.?[0-9]*" value={value} onChange={handleChange} readOnly={readOnly} disabled={disabled} required={required} placeholder=" "
                    className={`tw-peer tw-w-full tw-h-10 tw-px-3 tw-pt-4 tw-pb-1 tw-text-sm tw-border tw-rounded-lg tw-outline-none focus:tw-ring-1 tw-border-gray-300 focus:tw-border-blue-500 focus:tw-ring-blue-500 ${disabled ? "tw-bg-gray-100 tw-text-gray-500" : "tw-bg-white"}`} />
                <label className="tw-absolute tw-left-3 tw-top-1 tw-text-[10px] tw-text-gray-500 tw-pointer-events-none">{label}{required && <span className="tw-text-red-500">*</span>}</label>
            </div>
            <div className="tw-flex-shrink-0 tw-w-10 tw-h-10 tw-flex tw-items-center tw-justify-center tw-text-gray-600 tw-font-medium tw-text-sm tw-bg-gray-100 tw-rounded-lg tw-border tw-border-gray-200">{unit}</div>
        </div>
    );
}

// ==================== PHOTO INPUT (matches Charger) ====================
function PhotoMultiInput({ photos, setPhotos, max = 10, draftKey, qNo, lang, id }: {
    photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
    max?: number; draftKey: string; qNo: number; lang: Lang; id?: string;
}) {
    const cameraRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const isMobile = useMemo(() => isMobileDevice(), []);
    const [landscapeWarning, setLandscapeWarning] = useState(false);

    const processFile = async (file: File): Promise<PhotoItem | null> => {
        try {
            const locationText = await getCachedLocation();
            const fileWithTimestamp = await addTimestampToImage(file, locationText);
            const photoId = `${qNo}-${Date.now()}-0-${file.name}`;
            const ref = await putPhoto(draftKey, photoId, fileWithTimestamp);
            if (!ref) return { id: photoId, file: fileWithTimestamp, preview: URL.createObjectURL(fileWithTimestamp), remark: "" };
            const now = new Date().toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
            return { id: photoId, file: fileWithTimestamp, preview: URL.createObjectURL(fileWithTimestamp), remark: "", ref, createdAt: now, location: locationText };
        } catch (err) { console.error("processFile error:", err); return null; }
    };

    const handleFiles = async (list: FileList | null, fromCamera: boolean) => {
        if (!list || list.length === 0) return;
        const remain = Math.max(0, max - photos.length);
        if (remain === 0) { alert(lang === "th" ? `แนบรูปได้สูงสุด ${max} รูปต่อข้อ` : `Maximum ${max} photos per item`); return; }
        const files = Array.from(list).slice(0, remain);
        if (Array.from(list).length > remain) alert(lang === "th" ? `เลือกได้อีก ${remain} รูป (ครบ ${max} รูปแล้ว)` : `Only ${remain} more photo(s) allowed (max ${max})`);

        let hasLandscape = false;
        const validFiles: File[] = [];
        for (const f of files) {
            if (fromCamera) {
                try { const dim = await getImageDimensions(f); if (dim.width > dim.height) { hasLandscape = true; continue; } } catch { }
            }
            validFiles.push(f);
        }
        const results = await Promise.all(validFiles.map(f => processFile(f)));
        const accepted = results.filter(Boolean) as PhotoItem[];
        if (accepted.length > 0) setPhotos(prev => [...prev, ...accepted]);
        if (hasLandscape) setLandscapeWarning(true);
        if (cameraRef.current) cameraRef.current.value = "";
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleRemove = async (id: string) => {
        await delPhoto(draftKey, id);
        setPhotos(prev => { const target = prev.find(p => p.id === id); if (target?.preview) URL.revokeObjectURL(target.preview); return prev.filter(p => p.id !== id); });
    };

    return (
        <div id={id} className="tw-space-y-3 tw-transition-all tw-duration-300">
            {landscapeWarning && (
                <div className="tw-fixed tw-inset-0 tw-z-[9999] tw-bg-black/70 tw-flex tw-items-center tw-justify-center tw-p-6" onClick={() => setLandscapeWarning(false)}>
                    <div className="tw-bg-white tw-rounded-2xl tw-p-6 tw-max-w-sm tw-text-center tw-shadow-xl" onClick={e => e.stopPropagation()}>
                        <svg className="tw-w-14 tw-h-14 tw-text-amber-500 tw-mx-auto tw-mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        <p className="tw-text-lg tw-font-bold tw-text-gray-800 tw-mb-2">{lang === "th" ? "กรุณาถ่ายรูปแนวตั้ง" : "Please take portrait photos"}</p>
                        <p className="tw-text-sm tw-text-gray-600 tw-mb-4">{lang === "th" ? "รูปที่ถ่ายเป็นแนวนอนจะไม่ถูกรับ กรุณาหมุนมือถือเป็นแนวตั้งแล้วถ่ายใหม่" : "Landscape photos are not accepted. Please hold your phone upright and retake."}</p>
                        <Button size="sm" color="amber" variant="filled" onClick={() => setLandscapeWarning(false)} className="tw-w-full">{lang === "th" ? "รับทราบ" : "OK"}</Button>
                    </div>
                </div>
            )}
            <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                {isMobile ? (
                    <Button size="sm" color="blue" variant="outlined" onClick={() => cameraRef.current?.click()} className="tw-shrink-0 tw-flex tw-items-center tw-gap-1">
                        <svg className="tw-w-4 tw-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {t("takePhoto", lang)}
                    </Button>
                ) : (
                    <Button size="sm" color="blue" variant="outlined" onClick={() => fileRef.current?.click()} className="tw-shrink-0 tw-flex tw-items-center tw-gap-1">
                        <svg className="tw-w-4 tw-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {t("attachPhoto", lang)}
                    </Button>
                )}
            </div>
            {isMobile && <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="tw-hidden" onChange={e => { void handleFiles(e.target.files, true); }} />}
            {!isMobile && <input ref={fileRef} type="file" accept="image/*" multiple className="tw-hidden" onChange={e => { void handleFiles(e.target.files, false); }} />}
            <Typography variant="small" className="!tw-text-blue-gray-500">{t("maxPhotos", lang)} {max} {t("photos", lang)}</Typography>
            {photos.length > 0 ? (
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                    {photos.map(p => (
                        <div key={p.id} className="tw-border tw-rounded-lg tw-overflow-hidden tw-bg-gray-100 tw-shadow-xs tw-flex tw-flex-col">
                            <div className="tw-relative tw-aspect-[4/3] tw-bg-gray-100">
                                {p.preview && <img src={p.preview} alt="preview" className="tw-w-full tw-h-full tw-object-contain" />}
                                <button onClick={() => { void handleRemove(p.id); }} className="tw-absolute tw-top-2 tw-right-2 tw-bg-red-500 tw-text-white tw-w-6 tw-h-6 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-shadow-md hover:tw-bg-red-600 tw-transition-colors">×</button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (<Typography variant="small" className="!tw-text-blue-gray-500">{t("noPhotos", lang)}</Typography>)}
        </div>
    );
}

function SkippedNAItem({ label, remark, lang }: { label: string; remark?: string; lang: Lang }) {
    return (
        <div className="tw-py-4 first:tw-pt-2 tw-bg-amber-50/50">
            <div className="tw-flex tw-items-center tw-justify-between">
                <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{label}</Typography>
                <span className="tw-text-xs tw-text-amber-600 tw-font-medium">N/A</span>
            </div>
            {remark && <Typography variant="small" className="tw-text-gray-600 tw-mt-1">{t("remarkLabel", "th")}: {remark}</Typography>}
        </div>
    );
}

function PreRemarkElement({ remark, lang }: { remark?: string; lang: Lang }) {
    if (!remark) return null;
    return (
        <div className="tw-mb-3 tw-p-3 tw-bg-gray-100 tw-rounded-lg">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                <svg className="tw-w-4 tw-h-4 tw-text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                <Typography variant="small" className="tw-font-semibold tw-text-gray-600">{t("preRemarkLabel", lang)}</Typography>
            </div>
            <Typography variant="small" className="tw-text-gray-700 tw-ml-6">{remark}</Typography>
        </div>
    );
}

// ==================== BACKGROUND UPLOAD BANNER ====================
function BackgroundUploadBanner({ lang }: { lang: Lang }) {
    const [progress, setProgress] = useState<BgUploadProgress>({ total: 0, completed: 0, failed: 0, inProgress: false, failures: [] });
    useEffect(() => subscribeBgUpload(setProgress), []);
    useEffect(() => {
        if (progress.total > 0 && !progress.inProgress && progress.failed === 0 && progress.completed === progress.total) {
            const timer = setTimeout(() => resetBgUpload(), 3000);
            return () => clearTimeout(timer);
        }
    }, [progress]);
    if (progress.total === 0) return null;
    if (!progress.inProgress && progress.failed === 0 && progress.completed === progress.total) {
        return (<div className="tw-fixed tw-bottom-4 tw-left-1/2 tw--translate-x-1/2 tw-z-50 tw-bg-green-600 tw-text-white tw-px-5 tw-py-3 tw-rounded-xl tw-shadow-2xl tw-text-sm tw-flex tw-items-center tw-gap-2"><svg className="tw-w-5 tw-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{lang === "th" ? "อัปโหลดข้อมูลสำเร็จ" : "Data uploaded successfully"}</div>);
    }
    if (!progress.inProgress && progress.failed > 0) {
        return (<div className="tw-fixed tw-bottom-4 tw-left-1/2 tw--translate-x-1/2 tw-z-50 tw-bg-red-600 tw-text-white tw-px-5 tw-py-3 tw-rounded-xl tw-shadow-2xl tw-text-sm tw-max-w-md"><div className="tw-flex tw-items-center tw-gap-2"><span>⚠️</span><span>{lang === "th" ? `อัปโหลดรูปไม่สำเร็จ ${progress.failed} รูป (สำเร็จ ${progress.completed}/${progress.total})` : `${progress.failed} photos failed (${progress.completed}/${progress.total} ok)`}</span></div><button onClick={resetBgUpload} className="tw-mt-2 tw-text-xs tw-underline tw-opacity-80 hover:tw-opacity-100">{lang === "th" ? "ปิด" : "Dismiss"}</button></div>);
    }
    const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
    return (
        <div className="tw-fixed tw-bottom-4 tw-left-1/2 tw--translate-x-1/2 tw-z-50 tw-bg-gray-800 tw-text-white tw-px-5 tw-py-3 tw-rounded-xl tw-shadow-2xl tw-text-sm tw-min-w-[260px]">
            <div className="tw-flex tw-items-center tw-gap-3"><svg className="tw-animate-spin tw-h-4 tw-w-4 tw-flex-shrink-0" viewBox="0 0 24 24"><circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><span>{lang === "th" ? `กำลังอัปโหลดรูป...` : `Uploading photos...`} {progress.completed}/{progress.total}</span></div>
            <div className="tw-mt-2 tw-h-1.5 tw-bg-gray-600 tw-rounded-full tw-overflow-hidden"><div className="tw-h-full tw-bg-blue-400 tw-rounded-full tw-transition-all tw-duration-300" style={{ width: `${pct}%` }} /></div>
        </div>
    );
}

// ==================== API ====================
const PM_PREFIX = "mdbpmreport";

async function fetchPreviewIssueId(stationId: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/mdbpmreport/preview-issueid`);
    u.searchParams.set("station_id", stationId); u.searchParams.set("pm_date", pmDate);
    const r = await apiFetch(u.toString(), { credentials: "include" });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && typeof j.issue_id === "string") ? j.issue_id : null;
}

async function fetchPreviewDocName(stationId: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/mdbpmreport/preview-docname`);
    u.searchParams.set("station_id", stationId); u.searchParams.set("pm_date", pmDate);
    const r = await apiFetch(u.toString(), { credentials: "include" });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && typeof j.doc_name === "string") ? j.doc_name : null;
}

async function fetchReport(reportId: string, stationId: string) {
    const url = `${API_BASE}/mdbpmreport/get?station_id=${stationId}&report_id=${reportId}`;
    const res = await apiFetch(url, { method: "GET", credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

// ==================== MAIN COMPONENT ====================
export default function MDBPMForm() {
    const { lang } = useLanguage();
    const [me, setMe] = useState<Me | null>(null);
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [preUploadState, setPreUploadState] = useState({ show: false, total: 0, completed: 0, failed: 0 });
    const [docName, setDocName] = useState<string>("");

    const pathname = usePathname();
    const searchParams = useSearchParams();
    const editId = searchParams.get("edit_id") ?? "";
    const action = searchParams.get("action");
    const isPostMode = action === "post";

    const [postApiLoaded, setPostApiLoaded] = useState(false);
    const [photos, setPhotos] = useState<Record<string | number, PhotoItem[]>>({});
    const [summary, setSummary] = useState<string>("");
    const [stationId, setStationId] = useState<string | null>(null);

    const key = useMemo(() => draftKey(stationId), [stationId]);
    const postKey = useMemo(() => `${draftKey(stationId)}:${editId}:post`, [stationId, editId]);
    const currentDraftKey = isPostMode ? postKey : key;

    const preReportIdRef = useRef<string | null>(null);
    const postReportIdRef = useRef<string | null>(null);

    useEffect(() => { postReportIdRef.current = null; }, [editId]);

    const photosRef = useRef(photos);
    useEffect(() => { photosRef.current = photos; }, [photos]);
    useEffect(() => {
        return () => { Object.values(photosRef.current).flat().forEach(p => { if (p.preview?.startsWith("blob:")) URL.revokeObjectURL(p.preview); }); };
    }, []);

    const [summaryCheck, setSummaryCheck] = useState<PF>("");
    const [inspector, setInspector] = useState<string>("");
    const [dustFilterChanged, setDustFilterChanged] = useState<boolean>(false);
    const [job, setJob] = useState({ issue_id: "", station_name: "", date: "" });

    useEffect(() => { void prefetchLocation(); }, []);

    const [rowsPre, setRowsPre] = useState<Record<string, { pf: PF; remark: string }>>({});
    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(() => {
        const initial: Record<string, { pf: PF; remark: string }> = {};
        QUESTIONS.forEach(q => { if (q.kind === "simple" || q.kind === "measure") initial[q.key] = { pf: "", remark: "" }; else if (q.kind === "group" && q.items) q.items.forEach(it => { initial[it.key] = { pf: "", remark: "" }; }); });
        return initial;
    });

    const [m4Pre, setM4Pre] = useState<Record<string, MeasureState<UnitVoltage>>>({});
    const [m5Pre, setM5Pre] = useState<Record<string, MeasureState<UnitVoltage>>>({});
    const [m6Pre, setM6Pre] = useState<Record<string, MeasureState<UnitVoltage>>>({});
    const [m7Pre, setM7Pre] = useState<Record<string, MeasureState<UnitVoltage>>>({});

    const [m4State, setM4State] = useState<Record<string, MeasureState<UnitVoltage>>>({});
    const [m5State, setM5State] = useState<Record<string, MeasureState<UnitVoltage>>>({});
    const [m6State, setM6State] = useState<Record<string, MeasureState<UnitVoltage>>>({});
    const [m7State, setM7State] = useState<Record<string, MeasureState<UnitVoltage>>>({});

    const [q4Items, setQ4Items] = useState<{ key: string; label: string }[]>([{ key: "r4_1", label: getDynamicLabel.breakerMain(1, lang) }]);
    const [q6Items, setQ6Items] = useState<{ key: string; label: string }[]>([{ key: "r6_1", label: getDynamicLabel.breakerCCB(1, lang) }]);
    const [chargerCount, setChargerCount] = useState<number>(1);

    useEffect(() => {
        setQ4Items(prev => prev.map((item, i) => ({ ...item, label: getDynamicLabel.breakerMain(i + 1, lang) })));
        setQ6Items(prev => prev.map((item, i) => ({ ...item, label: getDynamicLabel.breakerCCB(i + 1, lang) })));
    }, [lang]);

    const q5Items = useMemo(() => Array.from({ length: chargerCount }, (_, i) => ({ key: `r5_${i + 1}`, label: getDynamicLabel.breakerCharger(i + 1, lang) })), [chargerCount, lang]);
    const q7Items = useMemo(() => Array.from({ length: chargerCount }, (_, i) => ({ key: `r7_${i + 1}`, label: getDynamicLabel.rcd(i + 1, lang) })), [chargerCount, lang]);
    const q8Items = useMemo(() => Array.from({ length: chargerCount }, (_, i) => ({ key: `r8_${i + 1}`, label: getDynamicLabel.tripRCD(i + 1, lang) })), [chargerCount, lang]);
    const q9Items = useMemo(() => q6Items.map((_, i) => ({ key: `r9_${i + 1}`, label: getDynamicLabel.tripCCB(i + 1, lang) })), [q6Items, lang]);
    const q10Items = useMemo(() => Array.from({ length: chargerCount }, (_, i) => ({ key: `r10_${i + 1}`, label: getDynamicLabel.tripCharger(i + 1, lang) })), [chargerCount, lang]);
    const q11Items = useMemo(() => q4Items.map((_, i) => ({ key: `r11_${i + 1}`, label: getDynamicLabel.tripMain(i + 1, lang) })), [q4Items, lang]);

    useEffect(() => { setM4State(prev => { const n = { ...prev }; q4Items.forEach(item => { if (!n[item.key]) n[item.key] = initMeasureState(VOLTAGE_FIELDS, "V"); }); return n; }); }, [q4Items]);
    useEffect(() => { setM5State(prev => { const n = { ...prev }; q5Items.forEach(item => { if (!n[item.key]) n[item.key] = initMeasureState(VOLTAGE_FIELDS, "V"); }); return n; }); }, [q5Items]);
    useEffect(() => { setM6State(prev => { const n = { ...prev }; q6Items.forEach(item => { if (!n[item.key]) n[item.key] = initMeasureState(VOLTAGE_FIELDS_CCB, "V"); }); return n; }); }, [q6Items]);
    useEffect(() => { setM7State(prev => { const n = { ...prev }; q7Items.forEach(item => { if (!n[item.key]) n[item.key] = initMeasureState(VOLTAGE_FIELDS_CCB, "V"); }); return n; }); }, [q7Items]);

    useEffect(() => {
        setRows(prev => {
            const next = { ...prev }; let changed = false;
            [q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items].forEach(items => {
                items.forEach(item => { if (!next[item.key]) { next[item.key] = { pf: "", remark: "" }; changed = true; } });
            });
            return changed ? next : prev;
        });
    }, [q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    const addQ4Item = () => { const i = q4Items.length + 1; setQ4Items(prev => [...prev, { key: `r4_${i}`, label: getDynamicLabel.breakerMain(i, lang) }]); };
    const removeQ4Item = (idx: number) => {
        if (q4Items.length <= 1) return;
        const keyToRemove = q4Items[idx].key;
        const newItems = q4Items.filter((_, i) => i !== idx).map((_, i) => ({ key: `r4_${i + 1}`, label: getDynamicLabel.breakerMain(i + 1, lang) }));
        setQ4Items(newItems);
        setRows(prev => { const n = { ...prev }; delete n[keyToRemove]; return n; });
        setM4State(prev => { const n = { ...prev }; delete n[keyToRemove]; return n; });
        setPhotos(prev => { const n = { ...prev }; delete n[keyToRemove]; return n; });
    };

    const addQ6Item = () => { if (q6Items.length >= 4) return; const i = q6Items.length + 1; setQ6Items(prev => [...prev, { key: `r6_${i}`, label: getDynamicLabel.breakerCCB(i, lang) }]); };
    const removeQ6Item = (idx: number) => {
        if (q6Items.length <= 1) return;
        const keyToRemove = q6Items[idx].key;
        const newItems = q6Items.filter((_, i) => i !== idx).map((_, i) => ({ key: `r6_${i + 1}`, label: getDynamicLabel.breakerCCB(i + 1, lang) }));
        setQ6Items(newItems);
        setRows(prev => { const n = { ...prev }; delete n[keyToRemove]; return n; });
        setM6State(prev => { const n = { ...prev }; delete n[keyToRemove]; return n; });
        setPhotos(prev => { const n = { ...prev }; delete n[keyToRemove]; return n; });
    };

    // ==================== EFFECTS ====================
    useEffect(() => {
        if (!isPostMode || !editId || !stationId) return;
        setPostApiLoaded(false);
        setM4State({}); setM5State({}); setM6State({}); setM7State({});
        setRows(() => { const init: Record<string, { pf: PF; remark: string }> = {}; QUESTIONS.forEach(q => { init[q.key] = { pf: "", remark: "" }; }); return init; });
        (async () => {
            try {
                const data = await fetchReport(editId, stationId);
                if (data.job) setJob(prev => ({ ...prev, ...data.job, issue_id: data.issue_id ?? prev.issue_id }));
                if (data.pm_date) setJob(prev => ({ ...prev, date: data.pm_date }));
                if (data.charger_count) setChargerCount(data.charger_count);
                if (data.q4_items) setQ4Items(data.q4_items.map((it: any, i: number) => ({ ...it, label: getDynamicLabel.breakerMain(i + 1, lang) })));
                if (data.q6_items) setQ6Items(data.q6_items.map((it: any, i: number) => ({ ...it, label: getDynamicLabel.breakerCCB(i + 1, lang) })));
                if (data?.measures_pre?.m4) setM4Pre(data.measures_pre.m4);
                if (data?.measures_pre?.m5) setM5Pre(data.measures_pre.m5);
                if (data?.measures_pre?.m6) setM6Pre(data.measures_pre.m6);
                if (data?.measures_pre?.m7) setM7Pre(data.measures_pre.m7);
                if (data.doc_name) setDocName(data.doc_name);
                if (data.inspector) setInspector(data.inspector);
                if (data.rows_pre) setRowsPre(data.rows_pre);
                if (data.rows) setRows(prev => { const n = { ...prev }; Object.entries(data.rows).forEach(([k, v]) => { n[k] = v as { pf: PF; remark: string }; }); return n; });
                setPostApiLoaded(true);
            } catch (err) { console.error("load report failed:", err); setPostApiLoaded(true); }
        })();
    }, [isPostMode, editId, stationId, lang]);

    useEffect(() => { if (isPostMode && postApiLoaded) setPageLoading(false); }, [isPostMode, postApiLoaded]);

    useEffect(() => {
        (async () => {
            try {
                const res = await apiFetch(`${API_BASE}/me`);
                if (!res.ok) return;
                const data: Me = await res.json();
                setMe(data);
                setInspector(prev => prev || data.username || "");
            } catch (err) { console.error("fetch /me error:", err); }
        })();
    }, []);

    useEffect(() => {
        if (isPostMode || !stationId || !job.date) return;
        let canceled = false;
        (async () => { try { const p = await fetchPreviewIssueId(stationId, job.date); if (!canceled && p) setJob(prev => ({ ...prev, issue_id: p })); } catch { } })();
        return () => { canceled = true; };
    }, [stationId, job.date, isPostMode]);

    useEffect(() => {
        if (isPostMode || !stationId || !job.date) return;
        let canceled = false;
        (async () => { try { const p = await fetchPreviewDocName(stationId, job.date); if (!canceled && p) setDocName(p); } catch { } })();
        return () => { canceled = true; };
    }, [stationId, job.date, isPostMode]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sid = params.get("station_id") || localStorage.getItem("selected_station_id");
        if (sid) setStationId(sid);
        if (!sid || isPostMode) { setPageLoading(false); return; }
        setJob(prev => { if (prev.date) return prev; return { ...prev, date: new Date().toISOString().slice(0, 10) }; });
        getStationInfoPublic(sid)
            .then(st => setJob(prev => ({ ...prev, station_name: st.station_name ?? prev.station_name })))
            .catch(err => console.error("load station info failed:", err))
            .finally(() => setPageLoading(false));
        getChargerCountByStation(sid).then(count => setChargerCount(count)).catch(err => console.error(err));
    }, [isPostMode]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.has("draft_id")) { params.delete("draft_id"); window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`); }
    }, []);

    // Load draft (Pre)
    useEffect(() => {
        if (!stationId || isPostMode) return;
        const draft = loadDraftLocal<any>(key);
        if (!draft) return;
        if (draft.rows) setRows(prev => ({ ...prev, ...draft.rows }));
        if (draft.m4) setM4State(draft.m4);
        if (draft.m5) setM5State(draft.m5);
        if (draft.m6) setM6State(draft.m6);
        if (draft.m7) setM7State(draft.m7);
        if (typeof draft.dustFilterChanged === "boolean") setDustFilterChanged(draft.dustFilterChanged);
        if (draft.summary) setSummary(draft.summary);
        if (draft.q4_items) setQ4Items(draft.q4_items.map((it: any, i: number) => ({ ...it, label: getDynamicLabel.breakerMain(i + 1, lang) })));
        if (draft.q6_items) setQ6Items(draft.q6_items.map((it: any, i: number) => ({ ...it, label: getDynamicLabel.breakerCCB(i + 1, lang) })));
        if (draft.charger_count) setChargerCount(draft.charger_count);
        if (draft.photoRefs) {
            let canceled = false;
            const cleanup = () => { canceled = true; };
            (async () => {
                const loadedPhotos: Record<string | number, PhotoItem[]> = {};
                for (const [photoKey, refs] of Object.entries(draft.photoRefs as Record<string, (PhotoRef | { isNA: true })[]>)) {
                    if (canceled) return;
                    if (!refs || refs.length === 0) continue;
                    const items: PhotoItem[] = [];
                    for (const ref of refs) {
                        if (canceled) return;
                        if ('isNA' in ref && ref.isNA) { items.push({ id: `na-${photoKey}`, isNA: true }); }
                        else if ('dbKey' in ref) {
                            const file = await getPhotoByDbKey((ref as PhotoRef).dbKey);
                            if (file && !canceled) items.push({ id: (ref as PhotoRef).id, file, preview: URL.createObjectURL(file), remark: (ref as PhotoRef).remark, ref: ref as PhotoRef });
                        }
                    }
                    if (items.length > 0) loadedPhotos[photoKey] = items;
                }
                if (!canceled) setPhotos(prev => ({ ...prev, ...loadedPhotos }));
            })();
            return cleanup;
        }
    }, [stationId, key, isPostMode, lang]);

    // Load draft (Post)
    useEffect(() => {
        if (!isPostMode || !postApiLoaded || !stationId || !editId) return;
        const draft = loadDraftLocal<any>(postKey);
        if (!draft) return;
        if (draft.rows) setRows(prev => ({ ...prev, ...draft.rows }));
        if (draft.m4) setM4State(prev => ({ ...prev, ...draft.m4 }));
        if (draft.m5) setM5State(prev => ({ ...prev, ...draft.m5 }));
        if (draft.m6) setM6State(prev => ({ ...prev, ...draft.m6 }));
        if (draft.m7) setM7State(prev => ({ ...prev, ...draft.m7 }));
        if (draft.summary) setSummary(draft.summary);
        if (draft.summaryCheck) setSummaryCheck(draft.summaryCheck);
        if (typeof draft.dustFilterChanged === "boolean") setDustFilterChanged(draft.dustFilterChanged);
        if (draft.photoRefs) {
            let canceled = false;
            const cleanup = () => { canceled = true; };
            (async () => {
                const loadedPhotos: Record<string | number, PhotoItem[]> = {};
                for (const [photoKey, refs] of Object.entries(draft.photoRefs as Record<string, (PhotoRef | { isNA: true })[]>)) {
                    if (canceled) return;
                    if (!refs || refs.length === 0) continue;
                    const items: PhotoItem[] = [];
                    for (const ref of refs) {
                        if (canceled) return;
                        if ('isNA' in ref && ref.isNA) { items.push({ id: `na-${photoKey}`, isNA: true }); }
                        else if ('dbKey' in ref) {
                            const file = await getPhotoByDbKey((ref as PhotoRef).dbKey);
                            if (file && !canceled) items.push({ id: (ref as PhotoRef).id, file, preview: URL.createObjectURL(file), remark: (ref as PhotoRef).remark, ref: ref as PhotoRef });
                        }
                    }
                    if (items.length > 0) loadedPhotos[photoKey] = items;
                }
                if (!canceled) setPhotos(prev => ({ ...prev, ...loadedPhotos }));
            })();
            return cleanup;
        }
    }, [isPostMode, postApiLoaded, stationId, editId, postKey]);

    // ==================== VALIDATIONS ====================
    const validPhotoKeysPre = useMemo(() => {
        const keys: { key: string | number; label: string }[] = [];
        QUESTIONS.filter(q => q.hasPhoto && q.no !== 13).forEach(q => {
            if (q.kind === "simple" || q.kind === "measure") keys.push({ key: q.no, label: `${q.no}` });
            else if (q.kind === "dynamic_measure") q4Items.forEach((item, idx) => keys.push({ key: item.key, label: `4.${idx + 1}` }));
            else if (q.kind === "charger_measure") q5Items.forEach((item, idx) => keys.push({ key: item.key, label: `5.${idx + 1}` }));
            else if (q.kind === "ccb_measure") q6Items.forEach((item, idx) => keys.push({ key: item.key, label: `6.${idx + 1}` }));
            else if (q.kind === "rcd_measure") q7Items.forEach((item, idx) => keys.push({ key: item.key, label: `7.${idx + 1}` }));
            else if (q.kind === "trip_rcd") q8Items.forEach((item, idx) => keys.push({ key: item.key, label: `8.${idx + 1}` }));
            else if (q.kind === "trip_ccb") q9Items.forEach((item, idx) => keys.push({ key: item.key, label: `9.${idx + 1}` }));
            else if (q.kind === "trip_charger") q10Items.forEach((item, idx) => keys.push({ key: item.key, label: `10.${idx + 1}` }));
            else if (q.kind === "trip_main") q11Items.forEach((item, idx) => keys.push({ key: item.key, label: `11.${idx + 1}` }));
        });
        return keys;
    }, [q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    const validPhotoKeysPost = useMemo(() => {
        const keys: { key: string | number; label: string }[] = [];
        QUESTIONS.filter(q => q.hasPhoto).forEach(q => {
            if (q.kind === "simple" || q.kind === "measure") { if (rowsPre[q.key]?.pf === "NA") return; keys.push({ key: q.no, label: `${q.no}` }); }
            else if (q.kind === "dynamic_measure") q4Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `4.${idx + 1}` }); });
            else if (q.kind === "charger_measure") q5Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `5.${idx + 1}` }); });
            else if (q.kind === "ccb_measure") q6Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `6.${idx + 1}` }); });
            else if (q.kind === "rcd_measure") q7Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `7.${idx + 1}` }); });
            else if (q.kind === "trip_rcd") q8Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `8.${idx + 1}` }); });
            else if (q.kind === "trip_ccb") q9Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `9.${idx + 1}` }); });
            else if (q.kind === "trip_charger") q10Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `10.${idx + 1}` }); });
            else if (q.kind === "trip_main") q11Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `11.${idx + 1}` }); });
        });
        return keys;
    }, [rowsPre, q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    const sortLabels = (arr: string[]) => arr.sort((a, b) => { const [aM, aS] = a.split('.').map(Number); const [bM, bS] = b.split('.').map(Number); return aM !== bM ? aM - bM : (aS || 0) - (bS || 0); });

    const missingPhotoItemsPre = useMemo(() => sortLabels(validPhotoKeysPre.filter(({ key }) => (photos[key]?.length ?? 0) < 1).map(({ label }) => label)), [photos, validPhotoKeysPre]);
    const missingPhotoItemsPost = useMemo(() => sortLabels(validPhotoKeysPost.filter(({ key }) => (photos[key]?.length ?? 0) < 1).map(({ label }) => label)), [photos, validPhotoKeysPost]);
    const allPhotosAttachedPre = missingPhotoItemsPre.length === 0;
    const allPhotosAttachedPost = missingPhotoItemsPost.length === 0;
    const missingPhotoItems = isPostMode ? missingPhotoItemsPost : missingPhotoItemsPre;
    const allPhotosAttached = isPostMode ? allPhotosAttachedPost : allPhotosAttachedPre;

    const validRemarkKeysPre = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.filter(q => q.no !== 13).forEach(q => {
            if (q.kind === "simple" || q.kind === "measure") keys.push(q.key);
            else if (q.kind === "dynamic_measure") q4Items.forEach(it => keys.push(it.key));
            else if (q.kind === "charger_measure") q5Items.forEach(it => keys.push(it.key));
            else if (q.kind === "ccb_measure") q6Items.forEach(it => keys.push(it.key));
            else if (q.kind === "rcd_measure") q7Items.forEach(it => keys.push(it.key));
            else if (q.kind === "trip_rcd") q8Items.forEach(it => keys.push(it.key));
            else if (q.kind === "trip_ccb") q9Items.forEach(it => keys.push(it.key));
            else if (q.kind === "trip_charger") q10Items.forEach(it => keys.push(it.key));
            else if (q.kind === "trip_main") q11Items.forEach(it => keys.push(it.key));
            else if (q.kind === "group" && q.items) q.items.forEach(it => keys.push(it.key));
        });
        return keys;
    }, [q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    const missingRemarksPre = useMemo(() => {
        const missing: string[] = [];
        validRemarkKeysPre.forEach(k => { const val = rows[k]; if (!val?.remark?.trim()) { const m = k.match(/^r(\d+)(?:_(\d+))?$/); if (m) missing.push(m[2] ? `${m[1]}.${m[2]}` : m[1]); } });
        return sortLabels(missing);
    }, [rows, validRemarkKeysPre]);
    const allRemarksFilledPre = missingRemarksPre.length === 0;

    const validRemarkKeysPost = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach(q => {
            if (q.kind === "simple" || q.kind === "measure") { if (rowsPre[q.key]?.pf === "NA") return; keys.push(q.key); }
            else if (q.kind === "dynamic_measure") q4Items.forEach(it => { if (rowsPre[it.key]?.pf === "NA") return; keys.push(it.key); });
            else if (q.kind === "charger_measure") q5Items.forEach(it => { if (rowsPre[it.key]?.pf === "NA") return; keys.push(it.key); });
            else if (q.kind === "ccb_measure") q6Items.forEach(it => { if (rowsPre[it.key]?.pf === "NA") return; keys.push(it.key); });
            else if (q.kind === "rcd_measure") q7Items.forEach(it => { if (rowsPre[it.key]?.pf === "NA") return; keys.push(it.key); });
            else if (q.kind === "trip_rcd") q8Items.forEach(it => { if (rowsPre[it.key]?.pf === "NA") return; keys.push(it.key); });
            else if (q.kind === "trip_ccb") q9Items.forEach(it => { if (rowsPre[it.key]?.pf === "NA") return; keys.push(it.key); });
            else if (q.kind === "trip_charger") q10Items.forEach(it => { if (rowsPre[it.key]?.pf === "NA") return; keys.push(it.key); });
            else if (q.kind === "trip_main") q11Items.forEach(it => { if (rowsPre[it.key]?.pf === "NA") return; keys.push(it.key); });
            else if (q.kind === "group" && q.items) q.items.forEach(it => { if (rowsPre[it.key]?.pf === "NA") return; keys.push(it.key); });
        });
        return keys;
    }, [rowsPre, q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    const missingRemarksPost = useMemo(() => {
        const missing: string[] = [];
        validRemarkKeysPost.forEach(k => { const val = rows[k]; if (!val?.remark?.trim()) { const m = k.match(/^r(\d+)(?:_(\d+))?$/); if (m) missing.push(m[2] ? `${m[1]}.${m[2]}` : m[1]); } });
        return sortLabels(missing);
    }, [rows, validRemarkKeysPost]);
    const allRemarksFilledPost = missingRemarksPost.length === 0;

    const PF_KEYS_ALL = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach(q => {
            if (q.kind === "simple" || q.kind === "measure") keys.push(q.key);
            else if (q.kind === "dynamic_measure") q4Items.forEach(it => keys.push(it.key));
            else if (q.kind === "charger_measure") q5Items.forEach(it => keys.push(it.key));
            else if (q.kind === "ccb_measure") q6Items.forEach(it => keys.push(it.key));
            else if (q.kind === "rcd_measure") q7Items.forEach(it => keys.push(it.key));
            else if (q.kind === "trip_rcd") q8Items.forEach(it => keys.push(it.key));
            else if (q.kind === "trip_ccb") q9Items.forEach(it => keys.push(it.key));
            else if (q.kind === "trip_charger") q10Items.forEach(it => keys.push(it.key));
            else if (q.kind === "trip_main") q11Items.forEach(it => keys.push(it.key));
            else if (q.kind === "group" && q.items) q.items.forEach(it => keys.push(it.key));
        });
        return keys;
    }, [q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    const PF_KEYS_POST = useMemo(() => PF_KEYS_ALL.filter(k => { const base = k.replace(/_\d+$/, "").replace(/^r/, "r"); return rowsPre[k]?.pf !== "NA"; }), [PF_KEYS_ALL, rowsPre]);
    const allPFAnsweredPost = useMemo(() => PF_KEYS_POST.every(k => rows[k]?.pf !== ""), [rows, PF_KEYS_POST]);
    const missingPFItemsPost = useMemo(() => sortLabels(PF_KEYS_POST.filter(k => !rows[k]?.pf).map(k => { const m = k.match(/^r(\d+)(?:_(\d+))?$/); return m ? (m[2] ? `${m[1]}.${m[2]}` : m[1]) : k; })), [rows, PF_KEYS_POST]);

    const missingInputs = useMemo(() => {
        const r: Record<string, string[]> = {};
        const checkItems = (items: typeof q4Items, state: Record<string, MeasureState<UnitVoltage>>, fields: readonly string[]) => {
            items.forEach(item => {
                if (rowsPre[item.key]?.pf === "NA" || rows[item.key]?.pf === "NA") return;
                const s = state[item.key];
                const missing = fields.filter(k => !String(s?.[k]?.value ?? "").trim());
                if (missing.length > 0) r[item.label] = missing;
            });
        };
        checkItems(q4Items, m4State, VOLTAGE_FIELDS);
        checkItems(q5Items, m5State, VOLTAGE_FIELDS);
        checkItems(q6Items, m6State, VOLTAGE_FIELDS_CCB);
        checkItems(q7Items, m7State, VOLTAGE_FIELDS_CCB);
        return r;
    }, [m4State, m5State, m6State, m7State, q4Items, q5Items, q6Items, q7Items, rows, rowsPre]);

    const allRequiredInputsFilled = useMemo(() => Object.values(missingInputs).every(a => a.length === 0), [missingInputs]);

    const missingInputsDetailed: MissingInputItem[] = useMemo(() => {
        const items: MissingInputItem[] = [];
        const check = (list: typeof q4Items, state: Record<string, MeasureState<UnitVoltage>>, fields: readonly string[], qNo: number) => {
            list.forEach((item, idx) => {
                if (rowsPre[item.key]?.pf === "NA" || rows[item.key]?.pf === "NA") return;
                fields.forEach(fieldKey => { if (!String(state[item.key]?.[fieldKey]?.value ?? "").trim()) items.push({ qNo, subNo: idx + 1, label: LABELS[fieldKey] ?? fieldKey, fieldKey }); });
            });
        };
        check(q4Items, m4State, VOLTAGE_FIELDS, 4);
        check(q5Items, m5State, VOLTAGE_FIELDS, 5);
        check(q6Items, m6State, VOLTAGE_FIELDS_CCB, 6);
        check(q7Items, m7State, VOLTAGE_FIELDS_CCB, 7);
        return items;
    }, [m4State, m5State, m6State, m7State, q4Items, q5Items, q6Items, q7Items, rows, rowsPre]);

    const isSummaryFilled = summary.trim().length > 0;
    const isSummaryCheckFilled = summaryCheck !== "";
    const canGoAfter = isPostMode ? true : (allPhotosAttachedPre && allRequiredInputsFilled && allRemarksFilledPre);
    const canFinalSave = allPhotosAttachedPost && allPFAnsweredPost && allRequiredInputsFilled && allRemarksFilledPost && isSummaryFilled && isSummaryCheckFilled;

    const active: TabId = useMemo(() => slugToTab(searchParams.get("pmtab")), [searchParams]);
    const displayTab: TabId = isPostMode ? "post" : (active === "post" && !canGoAfter ? "pre" : active);

    // ==================== DRAFT SAVE ====================
    const photoRefs = useMemo(() => {
        const out: Record<string | number, (PhotoRef | { isNA: true })[]> = {};
        Object.entries(photos).forEach(([k, list]) => {
            out[k] = (list || []).map(p => p.isNA ? { isNA: true } : p.ref).filter(Boolean) as (PhotoRef | { isNA: true })[];
        });
        return out;
    }, [photos]);

    useDebouncedEffect(() => {
        if (!stationId || isPostMode) return;
        saveDraftLocal(key, { rows, m4: m4State, m5: m5State, m6: m6State, m7: m7State, summary, dustFilterChanged, photoRefs, q4_items: q4Items, q6_items: q6Items, charger_count: chargerCount });
    }, [key, stationId, rows, m4State, m5State, m6State, m7State, summary, dustFilterChanged, photoRefs, q4Items, q6Items, chargerCount, isPostMode]);

    useDebouncedEffect(() => {
        if (!stationId || !isPostMode || !editId) return;
        saveDraftLocal(postKey, { rows, m4: m4State, m5: m5State, m6: m6State, m7: m7State, summary, summaryCheck, dustFilterChanged, photoRefs });
    }, [postKey, stationId, rows, m4State, m5State, m6State, m7State, summary, summaryCheck, dustFilterChanged, photoRefs, isPostMode, editId]);

    // ==================== UPLOAD HELPERS ====================
    async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
        if (!file.type.startsWith("image/") || file.size < 500 * 1024) return file;
        return new Promise(resolve => {
            const img = document.createElement("img");
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                let { width, height } = img;
                if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
                const canvas = document.createElement("canvas");
                canvas.width = width; canvas.height = height;
                canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => { resolve(blob && blob.size < file.size ? new File([blob], ensureJpgFilename(file.name), { type: "image/jpeg" }) : file); }, "image/jpeg", quality);
            };
            img.onerror = () => { URL.revokeObjectURL(img.src); resolve(file); };
            img.src = URL.createObjectURL(file);
        });
    }

    async function uploadSinglePhoto(reportId: string, stationId: string, group: string, file: File, side: TabId) {
        if (!file || file.size === 0) throw new Error(`Empty file: ${file?.name ?? "unknown"}`);
        const normalizedGroup = (() => {
            const k = String(group);
            if (/^\d+$/.test(k)) return `g${k}`;       // "1" -> "g1"
            if (/^r\d+_\d+$/.test(k)) return k;         // "r4_1" -> "r4_1" (MDB backend accepts r\d+_\d+)
            if (k.startsWith("g")) return k;             // "g1" -> "g1"
            return `g${k}`;
        })();
        const form = new FormData();
        form.append("station_id", stationId);
        form.append("group", normalizedGroup);
        form.append("side", side);
        form.append("files", file, ensureJpgFilename(file.name));
        const url = side === "pre" ? `${API_BASE}/mdbpmreport/${reportId}/pre/photos` : `${API_BASE}/mdbpmreport/${reportId}/post/photos`;
        const res = await apiFetch(url, { method: "POST", body: form, credentials: "include" });
        if (!res.ok) { const e = await res.text().catch(() => ""); throw new Error(`[${res.status}] ${normalizedGroup}: ${e || res.statusText}`); }
        const resJson = await res.json().catch(() => null);
        if (!resJson || resJson.count === 0) throw new Error(`[upload empty] group ${normalizedGroup}: backend saved 0 files`);
    }

    async function uploadSinglePhotoWithRetry(reportId: string, stationId: string, group: string, file: File, side: TabId, maxRetries = 3): Promise<void> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try { await uploadSinglePhoto(reportId, stationId, group, file, side); return; }
            catch (err: any) {
                if (attempt === maxRetries) throw err;
                await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 8000)));
            }
        }
    }

    // ==================== FLAT ROWS HELPER ====================
    const flattenRows = () => {
        const result: Record<string, { pf: PF; remark: string }> = {};
        const simpleKeys = QUESTIONS.filter(q => q.kind === "simple" || q.kind === "measure").map(q => q.key);
        const dynamicKeys = [...q4Items, ...q5Items, ...q6Items, ...q7Items, ...q8Items, ...q9Items, ...q10Items, ...q11Items].map(i => i.key);
        const validKeys = [...simpleKeys, ...dynamicKeys];
        for (const k of validKeys) {
            result[k] = rows[k] ? { pf: rows[k].pf ?? "", remark: rows[k].remark ?? "" } : { pf: "", remark: "" };
        }
        return result;
    };

    // ==================== SAVE HANDLERS ====================
    const makePhotoSetter = (k: string | number): React.Dispatch<React.SetStateAction<PhotoItem[]>> => (action) => {
        setPhotos(prev => {
            const current = prev[k] ?? [];
            const next = typeof action === "function" ? (action as (x: PhotoItem[]) => PhotoItem[])(current) : action;
            return { ...prev, [k]: next };
        });
    };

    const onPreSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }
        if (!allRequiredInputsFilled) { alert(t("alertFillVoltage", lang)); return; }
        if (!allRemarksFilledPre) { alert(`${t("alertFillRemark", lang)} ${missingRemarksPre.join(", ")}`); return; }
        if (submitting) return;
        setSubmitting(true);
        try {
            let report_id = preReportIdRef.current;
            if (!report_id) {
                const draft = loadDraftLocal<any>(key);
                if (draft?.pendingReportId) { report_id = draft.pendingReportId; preReportIdRef.current = report_id; }
            }
            if (!report_id) {
                const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
                const payload = {
                    station_id: stationId, issue_id: issueIdFromJob, job: jobWithoutIssueId, inspector,
                    measures_pre: { m4: m4State, m5: m5State, m6: m6State, m7: m7State },
                    rows_pre: flattenRows(), pm_date: job.date?.trim() || "", doc_name: docName, side: "pre" as TabId,
                    q4_items: q4Items, q6_items: q6Items, charger_count: chargerCount,
                };
                const res = await apiFetch(`${API_BASE}/mdbpmreport/pre/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
                if (!res.ok) throw new Error(await res.text());
                const jsonRes = await res.json() as { report_id: string; doc_name?: string };
                report_id = jsonRes.report_id;
                if (jsonRes.doc_name) setDocName(jsonRes.doc_name);
                preReportIdRef.current = report_id;
                saveDraftLocal(key, { ...loadDraftLocal(key), pendingReportId: report_id, rows, m4: m4State, m5: m5State, m6: m6State, m7: m7State, summary, dustFilterChanged, photoRefs });
            }

            const uploadEntries: { group: string; files: File[] }[] = [];
            for (const [no, list] of Object.entries(photos)) {
                const files = (list || []).map(p => p.file).filter(Boolean) as File[];
                if (files.length > 0) uploadEntries.push({ group: no, files });
            }
            const totalPhotos = uploadEntries.reduce((sum, e) => sum + e.files.length, 0);

            if (totalPhotos > 0) {
                setPreUploadState({ show: true, total: totalPhotos, completed: 0, failed: 0 });
                let completedCount = 0, failedCount = 0;
                const failures: { group: string; error: string }[] = [];
                const allTasks: { group: string; file: File }[] = [];
                for (const entry of uploadEntries) {
                    const compressed = await Promise.all(entry.files.map(f => compressImage(f)));
                    for (const file of compressed) allTasks.push({ group: entry.group, file });
                }
                const CONCURRENCY = 3;
                let idx = 0;
                const finalReportId = report_id;
                const finalStationId = stationId;
                const runNext = async (): Promise<void> => {
                    while (idx < allTasks.length) {
                        const taskIdx = idx++;
                        const task = allTasks[taskIdx];
                        try { await uploadSinglePhotoWithRetry(finalReportId, finalStationId, task.group, task.file, "pre"); }
                        catch (err: any) { failedCount++; failures.push({ group: task.group, error: err?.message || "unknown" }); }
                        completedCount++;
                        setPreUploadState({ show: true, total: totalPhotos, completed: completedCount, failed: failedCount });
                    }
                };
                await Promise.all(Array.from({ length: CONCURRENCY }, () => runNext()));
                setPreUploadState({ show: false, total: 0, completed: 0, failed: 0 });
                if (failures.length > 0) {
                    const details = failures.map(f => `ข้อ ${f.group}: ${f.error}`).join("\n");
                    alert(`${lang === "th" ? "อัปโหลดรูปไม่สำเร็จ" : "Photo upload failed"} ${failures.length} ${lang === "th" ? "รูป" : "photos"}\n\n${details}`);
                    return;
                }
            }

            preReportIdRef.current = null;
            const allPhotos = Object.values(photos).flat();
            Promise.all(allPhotos.map(p => delPhoto(key, p.id))).catch(() => { });
            clearDraftLocal(key);
            setPhotos({});
            const nextParams = new URLSearchParams(searchParams.toString());
            nextParams.set("station_id", stationId);
            nextParams.set("action", "post");
            nextParams.set("edit_id", report_id);
            nextParams.set("pmtab", "post");
            router.replace(`${pathname}?${nextParams.toString()}`);
        } catch (err: any) { alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`); } finally { setSubmitting(false); }
    };

    const onFinalSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }
        if (!allPhotosAttachedPost) { alert(t("photoNotComplete", lang)); return; }
        if (!allRequiredInputsFilled) { alert(t("alertFillVoltage", lang)); return; }
        if (!allRemarksFilledPost) { alert(`${t("alertFillRemark", lang)} ${missingRemarksPost.join(", ")}`); return; }
        if (!isSummaryFilled || !isSummaryCheckFilled) { alert(t("allNotComplete", lang)); return; }
        if (submitting) return;
        setSubmitting(true);
        try {
            let report_id = postReportIdRef.current;
            if (!report_id) {
                const draft = loadDraftLocal<any>(postKey);
                if (draft?.pendingReportId) { report_id = draft.pendingReportId; postReportIdRef.current = report_id; }
            }
            if (!report_id) {
                const payload = { station_id: stationId, rows: flattenRows(), measures: { m4: m4State, m5: m5State, m6: m6State, m7: m7State }, summary, ...(summaryCheck ? { summaryCheck } : {}), dust_filter: dustFilterChanged ? "yes" : "no", side: "post" as TabId, report_id: editId };
                const res = await apiFetch(`${API_BASE}/${PM_PREFIX}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
                if (!res.ok) throw new Error(await res.text());
                const jsonRes = await res.json() as { report_id: string };
                report_id = jsonRes.report_id;
                postReportIdRef.current = report_id;
                saveDraftLocal(postKey, { ...loadDraftLocal(postKey), pendingReportId: report_id, rows, m4: m4State, m5: m5State, m6: m6State, m7: m7State, summary, summaryCheck, dustFilterChanged, photoRefs });
            }

            const uploadEntries: { group: string; files: File[] }[] = [];
            for (const [no, list] of Object.entries(photos)) {
                const files = (list || []).map(p => p.file).filter(Boolean) as File[];
                if (files.length > 0) uploadEntries.push({ group: no, files });
            }
            const totalPhotos = uploadEntries.reduce((sum, e) => sum + e.files.length, 0);

            if (totalPhotos > 0) {
                setPreUploadState({ show: true, total: totalPhotos, completed: 0, failed: 0 });
                let completedCount = 0, failedCount = 0;
                const failures: { group: string; error: string }[] = [];
                const allTasks: { group: string; file: File }[] = [];
                for (const entry of uploadEntries) {
                    const compressed = await Promise.all(entry.files.map(f => compressImage(f)));
                    for (const file of compressed) allTasks.push({ group: entry.group, file });
                }
                const CONCURRENCY = 3;
                let idx = 0;
                const finalReportId = report_id;
                const finalStationId = stationId;
                const runNext = async (): Promise<void> => {
                    while (idx < allTasks.length) {
                        const taskIdx = idx++;
                        const task = allTasks[taskIdx];
                        try { await uploadSinglePhotoWithRetry(finalReportId, finalStationId, task.group, task.file, "post"); }
                        catch (err: any) { failedCount++; failures.push({ group: task.group, error: err?.message || "unknown" }); }
                        completedCount++;
                        setPreUploadState({ show: true, total: totalPhotos, completed: completedCount, failed: failedCount });
                    }
                };
                await Promise.all(Array.from({ length: CONCURRENCY }, () => runNext()));
                setPreUploadState({ show: false, total: 0, completed: 0, failed: 0 });
                if (failures.length > 0) {
                    const details = failures.map(f => `ข้อ ${f.group}: ${f.error}`).join("\n");
                    alert(`${lang === "th" ? "อัปโหลดรูปไม่สำเร็จ" : "Photo upload failed"} ${failures.length}\n\n${details}`);
                    return;
                }
            }

            const finalizeRes = await apiFetch(`${API_BASE}/${PM_PREFIX}/${report_id}/finalize`, { method: "POST", credentials: "include", body: new URLSearchParams({ station_id: stationId }) });
            if (!finalizeRes.ok) throw new Error(await finalizeRes.text());
            postReportIdRef.current = null;
            const allPhotos = Object.values(photos).flat();
            Promise.all(allPhotos.map(p => delPhoto(postKey, p.id))).catch(() => { });
            clearDraftLocal(postKey);
            // navigate to list - remove post mode params
            const listParams = new URLSearchParams();
            listParams.set("station_id", stationId);
            const viewParam = searchParams.get("view");
            if (viewParam) listParams.set("view", viewParam);
            router.replace(`${pathname}?${listParams.toString()}`);
        } catch (err: any) { alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`); } finally { setSubmitting(false); }
    };

    // ==================== TAB NAVIGATION ====================
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

    // ==================== RENDER HELPERS ====================
    const patchM4 = (itemKey: string, fieldKey: string, value: Partial<MeasureRow<UnitVoltage>>) => setM4State(prev => ({ ...prev, [itemKey]: { ...(prev[itemKey] || initMeasureState(VOLTAGE_FIELDS, "V")), [fieldKey]: { ...(prev[itemKey]?.[fieldKey] || { value: "", unit: "V" }), ...value } } }));
    const patchM5 = (itemKey: string, fieldKey: string, value: Partial<MeasureRow<UnitVoltage>>) => setM5State(prev => ({ ...prev, [itemKey]: { ...(prev[itemKey] || initMeasureState(VOLTAGE_FIELDS, "V")), [fieldKey]: { ...(prev[itemKey]?.[fieldKey] || { value: "", unit: "V" }), ...value } } }));
    const patchM6 = (itemKey: string, fieldKey: string, value: Partial<MeasureRow<UnitVoltage>>) => setM6State(prev => ({ ...prev, [itemKey]: { ...(prev[itemKey] || initMeasureState(VOLTAGE_FIELDS_CCB, "V")), [fieldKey]: { ...(prev[itemKey]?.[fieldKey] || { value: "", unit: "V" }), ...value } } }));
    const patchM7 = (itemKey: string, fieldKey: string, value: Partial<MeasureRow<UnitVoltage>>) => setM7State(prev => ({ ...prev, [itemKey]: { ...(prev[itemKey] || initMeasureState(VOLTAGE_FIELDS_CCB, "V")), [fieldKey]: { ...(prev[itemKey]?.[fieldKey] || { value: "", unit: "V" }), ...value } } }));

    const renderDynamicMeasureGrid = (qNo: number, itemKey: string) => {
        type PF_State = Record<string, MeasureState<UnitVoltage>>;
        type PF_Patch = (itemKey: string, fieldKey: string, value: Partial<MeasureRow<UnitVoltage>>) => void;
        const configs: Record<number, { state: PF_State; patchFn: PF_Patch; fields: readonly string[] }> = {
            4: { state: m4State, patchFn: patchM4, fields: VOLTAGE_FIELDS },
            5: { state: m5State, patchFn: patchM5, fields: VOLTAGE_FIELDS },
            6: { state: m6State, patchFn: patchM6, fields: VOLTAGE_FIELDS_CCB },
            7: { state: m7State, patchFn: patchM7, fields: VOLTAGE_FIELDS_CCB },
        };
        const cfg = configs[qNo];
        if (!cfg) return null;
        return (
            <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                {cfg.fields.map(k => (<InputWithUnit<UnitVoltage> key={`${qNo}-${itemKey}-${k}`} label={LABELS[k] ?? k} value={cfg.state[itemKey]?.[k]?.value || ""} unit={(cfg.state[itemKey]?.[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage} onValueChange={v => cfg.patchFn(itemKey, k, { value: v })} onUnitChange={u => cfg.patchFn(itemKey, k, { unit: u })} />))}
            </div>
        );
    };

    const renderDynamicMeasureGridWithPre = (qNo: number, itemKey: string) => {
        type PF_State = Record<string, MeasureState<UnitVoltage>>;
        type PF_Patch = (itemKey: string, fieldKey: string, value: Partial<MeasureRow<UnitVoltage>>) => void;
        const configs: Record<number, { state: PF_State; preState: PF_State; patchFn: PF_Patch; fields: readonly string[] }> = {
            4: { state: m4State, preState: m4Pre, patchFn: patchM4, fields: VOLTAGE_FIELDS },
            5: { state: m5State, preState: m5Pre, patchFn: patchM5, fields: VOLTAGE_FIELDS },
            6: { state: m6State, preState: m6Pre, patchFn: patchM6, fields: VOLTAGE_FIELDS_CCB },
            7: { state: m7State, preState: m7Pre, patchFn: patchM7, fields: VOLTAGE_FIELDS_CCB },
        };
        const cfg = configs[qNo];
        if (!cfg) return null;
        return (
            <div className="tw-space-y-3">
                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700">{t("prePM", lang)}</Typography>
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.fields.map(k => (<div key={`pre-${qNo}-${itemKey}-${k}`} className="tw-pointer-events-none tw-opacity-60"><InputWithUnit<UnitVoltage> label={LABELS[k] ?? k} value={cfg.preState[itemKey]?.[k]?.value || ""} unit={(cfg.preState[itemKey]?.[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage} onValueChange={() => { }} onUnitChange={() => { }} readOnly required={false} /></div>))}
                </div>
                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700 tw-mt-2">{t("postPM", lang)}</Typography>
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.fields.map(k => (<InputWithUnit<UnitVoltage> key={`post-${qNo}-${itemKey}-${k}`} label={LABELS[k] ?? k} value={cfg.state[itemKey]?.[k]?.value || ""} unit={(cfg.state[itemKey]?.[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage} onValueChange={v => cfg.patchFn(itemKey, k, { value: v })} onUnitChange={u => cfg.patchFn(itemKey, k, { unit: u })} />))}
                </div>
            </div>
        );
    };

    const renderQuestionBlock = (q: Question, mode: TabId) => {
        const qLabel = getQuestionLabel(q, mode, lang);
        const qTooltip = q.tooltip?.[lang];
        const sectionId = `${ID_PREFIX}-question-${q.no}`;

        // PRE MODE
        if (mode === "pre") {
            // Dynamic measure Q4
            if (q.kind === "dynamic_measure") {
                return (
                    <SectionCard key={q.key} id={sectionId} title={qLabel} tooltip={qTooltip}>
                        <div className="tw-space-y-0">
                            <div className="tw-flex tw-items-center tw-justify-between tw-pb-3 tw-border-b tw-border-gray-200">
                                <div className="tw-flex tw-items-center tw-gap-2">
                                    <Typography variant="small" className="tw-text-blue-gray-600">{t("breakerMainCount", lang)}</Typography>
                                    <Typography variant="small" className="tw-font-bold tw-text-blue-600">{q4Items.length} {t("unit", lang)}</Typography>
                                </div>
                                <Button size="sm" color="gray" variant="outlined" onClick={addQ4Item} className="tw-flex tw-items-center tw-gap-1"><span className="tw-text-lg tw-leading-none">+</span><span className="tw-text-xs">{t("addBreakerMain", lang)}</span></Button>
                            </div>
                            <div className="tw-divide-y tw-divide-gray-200">
                                {q4Items.map((item, idx) => {
                                    const isNA = rows[item.key]?.pf === "NA";
                                    return (
                                        <div key={item.key} className={`tw-py-4 first:tw-pt-2 ${isNA ? "tw-bg-amber-50/50" : ""}`}>
                                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                                <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{item.label}</Typography>
                                                <div className="tw-flex tw-items-center tw-gap-2">
                                                    <Button id={getPfIdFromKey(item.key)} size="sm" color={isNA ? "amber" : "gray"} variant={isNA ? "filled" : "outlined"} onClick={() => setRows(p => ({ ...p, [item.key]: { ...p[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs tw-transition-all tw-duration-300">{isNA ? t("cancelNA", lang) : t("na", lang)}</Button>
                                                    {q4Items.length > 1 && (<button type="button" onClick={() => removeQ4Item(idx)} className="tw-h-6 tw-w-6 tw-flex tw-items-center tw-justify-center tw-rounded tw-bg-red-50 tw-text-red-600 hover:tw-bg-red-100"><svg className="tw-w-3.5 tw-h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>)}
                                                </div>
                                            </div>
                                            <div className="tw-mb-3"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(item.key)} /></div>
                                            <div id={getInputIdFromKey(item.key)} className={`tw-mb-3 tw-transition-all tw-duration-300 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>{renderDynamicMeasureGrid(4, item.key)}</div>
                                            <div id={getRemarkIdFromKey(item.key)} className="tw-transition-all tw-duration-300"><Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""} onChange={e => setRows(p => ({ ...p, [item.key]: { ...(p[item.key] ?? { pf: "" }), remark: e.target.value } }))} rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" /></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </SectionCard>
                );
            }

            // Charger measure Q5
            if (q.kind === "charger_measure") {
                return (
                    <SectionCard key={q.key} id={sectionId} title={qLabel} tooltip={qTooltip}>
                        <div className="tw-space-y-0">
                            <div className="tw-flex tw-items-center tw-pb-3 tw-border-b tw-border-gray-200">
                                <div className="tw-flex tw-items-center tw-gap-2">
                                    <Typography variant="small" className="tw-text-blue-gray-600">{t("chargerCountLabel", lang)}</Typography>
                                    <Typography variant="small" className="tw-font-bold tw-text-blue-600">{chargerCount} {t("chargerUnit", lang)}</Typography>
                                </div>
                            </div>
                            <div className="tw-divide-y tw-divide-gray-200">
                                {q5Items.map(item => {
                                    const isNA = rows[item.key]?.pf === "NA";
                                    return (
                                        <div key={item.key} className={`tw-py-4 first:tw-pt-2 ${isNA ? "tw-bg-amber-50/50" : ""}`}>
                                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                                <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{item.label}</Typography>
                                                <Button id={getPfIdFromKey(item.key)} size="sm" color={isNA ? "amber" : "gray"} variant={isNA ? "filled" : "outlined"} onClick={() => setRows(p => ({ ...p, [item.key]: { ...p[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs tw-transition-all tw-duration-300">{isNA ? t("cancelNA", lang) : t("na", lang)}</Button>
                                            </div>
                                            <div className="tw-mb-3"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(item.key)} /></div>
                                            <div id={getInputIdFromKey(item.key)} className={`tw-mb-3 tw-transition-all tw-duration-300 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>{renderDynamicMeasureGrid(5, item.key)}</div>
                                            <div id={getRemarkIdFromKey(item.key)} className="tw-transition-all tw-duration-300"><Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""} onChange={e => setRows(p => ({ ...p, [item.key]: { ...(p[item.key] ?? { pf: "" }), remark: e.target.value } }))} rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" /></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </SectionCard>
                );
            }

            // CCB measure Q6
            if (q.kind === "ccb_measure") {
                return (
                    <SectionCard key={q.key} id={sectionId} title={qLabel} tooltip={qTooltip}>
                        <div className="tw-space-y-0">
                            <div className="tw-flex tw-items-center tw-justify-between tw-pb-3 tw-border-b tw-border-gray-200">
                                <div className="tw-flex tw-items-center tw-gap-2">
                                    <Typography variant="small" className="tw-text-blue-gray-600">{t("breakerCCBCount", lang)}</Typography>
                                    <Typography variant="small" className="tw-font-bold tw-text-blue-600">{q6Items.length} {t("breakerCCBMax", lang)}</Typography>
                                </div>
                                <Button size="sm" color="gray" variant="outlined" onClick={addQ6Item} disabled={q6Items.length >= 4} className="tw-flex tw-items-center tw-gap-1"><span className="tw-text-lg tw-leading-none">+</span><span className="tw-text-xs">{t("addBreakerCCB", lang)}</span></Button>
                            </div>
                            <div className="tw-divide-y tw-divide-gray-200">
                                {q6Items.map((item, idx) => {
                                    const isNA = rows[item.key]?.pf === "NA";
                                    return (
                                        <div key={item.key} className={`tw-py-4 first:tw-pt-2 ${isNA ? "tw-bg-amber-50/50" : ""}`}>
                                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                                <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{item.label}</Typography>
                                                <div className="tw-flex tw-items-center tw-gap-2">
                                                    <Button id={getPfIdFromKey(item.key)} size="sm" color={isNA ? "amber" : "gray"} variant={isNA ? "filled" : "outlined"} onClick={() => setRows(p => ({ ...p, [item.key]: { ...p[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs tw-transition-all tw-duration-300">{isNA ? t("cancelNA", lang) : t("na", lang)}</Button>
                                                    {q6Items.length > 1 && (<button type="button" onClick={() => removeQ6Item(idx)} className="tw-h-6 tw-w-6 tw-flex tw-items-center tw-justify-center tw-rounded tw-bg-red-50 tw-text-red-600 hover:tw-bg-red-100"><svg className="tw-w-3.5 tw-h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>)}
                                                </div>
                                            </div>
                                            <div className="tw-mb-3"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(item.key)} /></div>
                                            <div id={getInputIdFromKey(item.key)} className={`tw-mb-3 tw-transition-all tw-duration-300 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>{renderDynamicMeasureGrid(6, item.key)}</div>
                                            <div id={getRemarkIdFromKey(item.key)} className="tw-transition-all tw-duration-300"><Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""} onChange={e => setRows(p => ({ ...p, [item.key]: { ...(p[item.key] ?? { pf: "" }), remark: e.target.value } }))} rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" /></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </SectionCard>
                );
            }

            // RCD measure Q7
            if (q.kind === "rcd_measure") {
                return (
                    <SectionCard key={q.key} id={sectionId} title={qLabel} tooltip={qTooltip}>
                        <div className="tw-space-y-0">
                            <div className="tw-flex tw-items-center tw-pb-3 tw-border-b tw-border-gray-200">
                                <div className="tw-flex tw-items-center tw-gap-2">
                                    <Typography variant="small" className="tw-text-blue-gray-600">{t("rcdCount", lang)}</Typography>
                                    <Typography variant="small" className="tw-font-bold tw-text-blue-600">{chargerCount} {t("unit", lang)}</Typography>
                                </div>
                            </div>
                            <div className="tw-divide-y tw-divide-gray-200">
                                {q7Items.map(item => {
                                    const isNA = rows[item.key]?.pf === "NA";
                                    return (
                                        <div key={item.key} className={`tw-py-4 first:tw-pt-2 ${isNA ? "tw-bg-amber-50/50" : ""}`}>
                                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                                <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{item.label}</Typography>
                                                <Button id={getPfIdFromKey(item.key)} size="sm" color={isNA ? "amber" : "gray"} variant={isNA ? "filled" : "outlined"} onClick={() => setRows(p => ({ ...p, [item.key]: { ...p[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs tw-transition-all tw-duration-300">{isNA ? t("cancelNA", lang) : t("na", lang)}</Button>
                                            </div>
                                            <div className="tw-mb-3"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(item.key)} /></div>
                                            <div id={getInputIdFromKey(item.key)} className={`tw-mb-3 tw-transition-all tw-duration-300 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>{renderDynamicMeasureGrid(7, item.key)}</div>
                                            <div id={getRemarkIdFromKey(item.key)} className="tw-transition-all tw-duration-300"><Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""} onChange={e => setRows(p => ({ ...p, [item.key]: { ...(p[item.key] ?? { pf: "" }), remark: e.target.value } }))} rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" /></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </SectionCard>
                );
            }

            // Trip tests Q8-Q11
            const tripConfigs: Record<string, { items: { key: string; label: string }[]; countLabel: string; count: number; countUnit: string }> = {
                trip_rcd: { items: q8Items, countLabel: t("rcdCount", lang), count: chargerCount, countUnit: t("unit", lang) },
                trip_ccb: { items: q9Items, countLabel: t("breakerCCBCount", lang), count: q6Items.length, countUnit: t("unit", lang) },
                trip_charger: { items: q10Items, countLabel: t("breakerChargerCount", lang), count: chargerCount, countUnit: t("unit", lang) },
                trip_main: { items: q11Items, countLabel: t("breakerMainCount", lang), count: q4Items.length, countUnit: t("unit", lang) },
            };
            if (tripConfigs[q.kind]) {
                const cfg = tripConfigs[q.kind];
                return (
                    <SectionCard key={q.key} id={sectionId} title={qLabel} tooltip={qTooltip}>
                        <div className="tw-space-y-0">
                            <div className="tw-flex tw-items-center tw-pb-3 tw-border-b tw-border-gray-200">
                                <div className="tw-flex tw-items-center tw-gap-2">
                                    <Typography variant="small" className="tw-text-blue-gray-600">{cfg.countLabel}</Typography>
                                    <Typography variant="small" className="tw-font-bold tw-text-blue-600">{cfg.count} {cfg.countUnit}</Typography>
                                </div>
                            </div>
                            <div className="tw-divide-y tw-divide-gray-200">
                                {cfg.items.map(item => {
                                    const isNA = rows[item.key]?.pf === "NA";
                                    return (
                                        <div key={item.key} className={`tw-py-4 first:tw-pt-2 ${isNA ? "tw-bg-amber-50/50" : ""}`}>
                                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                                <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{item.label}</Typography>
                                                <Button id={getPfIdFromKey(item.key)} size="sm" color={isNA ? "amber" : "gray"} variant={isNA ? "filled" : "outlined"} onClick={() => setRows(p => ({ ...p, [item.key]: { ...p[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs tw-transition-all tw-duration-300">{isNA ? t("cancelNA", lang) : t("na", lang)}</Button>
                                            </div>
                                            <div className="tw-mb-3"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(item.key)} /></div>
                                            <div id={getRemarkIdFromKey(item.key)} className="tw-transition-all tw-duration-300"><Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""} onChange={e => setRows(p => ({ ...p, [item.key]: { ...(p[item.key] ?? { pf: "" }), remark: e.target.value } }))} rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" /></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </SectionCard>
                );
            }

            // Simple/measure (Q1,Q2,Q3,Q12 in Pre / Q13 excluded)
            return (
                <SectionCard key={q.key} id={sectionId} title={qLabel} tooltip={qTooltip}>
                    <div className={`tw-py-2 ${rows[q.key]?.pf === "NA" ? "tw-bg-amber-50/50" : ""}`}>
                        <div id={getPfIdFromKey(q.key)} className="tw-flex tw-justify-end tw-mb-3 tw-transition-all tw-duration-300">
                            <Button size="sm" color={rows[q.key]?.pf === "NA" ? "amber" : "gray"} variant={rows[q.key]?.pf === "NA" ? "filled" : "outlined"} onClick={() => setRows(p => ({ ...p, [q.key]: { ...p[q.key], pf: rows[q.key]?.pf === "NA" ? "" : "NA" } }))}>{rows[q.key]?.pf === "NA" ? t("cancelNA", lang) : t("na", lang)}</Button>
                        </div>
                        <div className="tw-mb-3"><PhotoMultiInput photos={photos[q.no] || []} setPhotos={makePhotoSetter(q.no)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(q.no)} /></div>
                        <div id={getRemarkIdFromKey(q.key)} className="tw-transition-all tw-duration-300"><Textarea label={t("remark", lang)} value={rows[q.key]?.remark ?? ""} onChange={e => setRows(p => ({ ...p, [q.key]: { ...(p[q.key] ?? { pf: "" }), remark: e.target.value } }))} rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" /></div>
                    </div>
                </SectionCard>
            );
        }

        // POST MODE
        if ((q.kind === "simple" || q.kind === "measure") && rowsPre[q.key]?.pf === "NA") {
            return (<SectionCard key={q.key} id={sectionId} title={q.label[lang]} tooltip={qTooltip}><SkippedNAItem label={getQuestionLabel(q, "post", lang)} remark={rowsPre[q.key]?.remark} lang={lang} /></SectionCard>);
        }

        const checkboxElement = q.no === 13 ? (
            <label className="tw-flex tw-items-center tw-gap-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-700 tw-py-2">
                <input type="checkbox" className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300" checked={dustFilterChanged} onChange={e => setDustFilterChanged(e.target.checked)} />
                <span>{t("dustFilterChanged", lang)}</span>
            </label>
        ) : null;

        const postMeasureMap: Record<string, { items: typeof q4Items; qNo: number; countLabel: string; count: number; countUnit: string }> = {
            dynamic_measure: { items: q4Items, qNo: 4, countLabel: t("breakerMainCount", lang), count: q4Items.length, countUnit: t("unit", lang) },
            charger_measure: { items: q5Items, qNo: 5, countLabel: t("chargerCountLabel", lang), count: chargerCount, countUnit: t("chargerUnit", lang) },
            ccb_measure: { items: q6Items, qNo: 6, countLabel: t("breakerCCBCount", lang), count: q6Items.length, countUnit: t("breakerCCBMax", lang) },
            rcd_measure: { items: q7Items, qNo: 7, countLabel: t("rcdCount", lang), count: chargerCount, countUnit: t("unit", lang) },
        };

        if (postMeasureMap[q.kind]) {
            const cfg = postMeasureMap[q.kind];
            const activeItems = cfg.items.filter(item => rowsPre[item.key]?.pf !== "NA");
            const skippedItems = cfg.items.filter(item => rowsPre[item.key]?.pf === "NA");
            return (
                <SectionCard key={q.key} id={sectionId} title={q.label[lang]} tooltip={qTooltip}>
                    <div className="tw-space-y-0">
                        <div className="tw-flex tw-items-center tw-pb-3 tw-border-b tw-border-gray-200">
                            <div className="tw-flex tw-items-center tw-gap-2">
                                <Typography variant="small" className="tw-text-blue-gray-600">{cfg.countLabel}</Typography>
                                <Typography variant="small" className="tw-font-bold tw-text-blue-600">{cfg.count} {cfg.countUnit}</Typography>
                            </div>
                        </div>
                        <div className="tw-divide-y tw-divide-gray-200">
                        {cfg.items.map((item, idx) => {
                            const isSkipped = rowsPre[item.key]?.pf === "NA";
                            if (isSkipped) {
                                return (
                                    <div key={item.key} className="tw-py-4 first:tw-pt-2 tw-bg-amber-50/50">
                                        <div className="tw-flex tw-items-center tw-justify-between">
                                            <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{item.label}</Typography>
                                            <span className="tw-text-xs tw-text-amber-600 tw-font-medium">N/A</span>
                                        </div>
                                        {rowsPre[item.key]?.remark && <Typography variant="small" className="tw-text-gray-600 tw-mt-1">{t("remarkLabel", lang)}: {rowsPre[item.key]?.remark}</Typography>}
                                    </div>
                                );
                            }
                            return (
                                <div key={item.key} className="tw-py-4 first:tw-pt-2">
                                    <PassFailRow label={item.label} value={rows[item.key]?.pf ?? ""} lang={lang}
                                        onChange={v => setRows({ ...rows, [item.key]: { ...(rows[item.key] ?? { remark: "" }), pf: v } })}
                                        remark={rows[item.key]?.remark ?? ""}
                                        onRemarkChange={v => setRows({ ...rows, [item.key]: { ...(rows[item.key] ?? { pf: "" }), remark: v } })}
                                        pfButtonsId={getPfIdFromKey(item.key)} remarkId={getRemarkIdFromKey(item.key)}
                                        aboveRemark={<div className="tw-pb-4 tw-border-b tw-border-gray-100"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(item.key)} /></div>}
                                        beforeRemark={<><div id={getInputIdFromKey(item.key)} className="tw-mb-3 tw-transition-all tw-duration-300">{renderDynamicMeasureGridWithPre(cfg.qNo, item.key)}</div><PreRemarkElement remark={rowsPre[item.key]?.remark} lang={lang} /></>}
                                    />
                                </div>
                            );
                        })}
                        </div>
                    </div>
                </SectionCard>
            );
        }

        const postTripMap: Record<string, { items: typeof q8Items; countLabel: string; count: number; countUnit: string }> = {
            trip_rcd: { items: q8Items, countLabel: t("rcdCount", lang), count: chargerCount, countUnit: t("unit", lang) },
            trip_ccb: { items: q9Items, countLabel: t("breakerCCBCount", lang), count: q6Items.length, countUnit: t("unit", lang) },
            trip_charger: { items: q10Items, countLabel: t("breakerChargerCount", lang), count: chargerCount, countUnit: t("unit", lang) },
            trip_main: { items: q11Items, countLabel: t("breakerMainCount", lang), count: q4Items.length, countUnit: t("unit", lang) },
        };
        if (postTripMap[q.kind]) {
            const cfg = postTripMap[q.kind];
            const items = cfg.items;
            const activeItems = items.filter(it => rowsPre[it.key]?.pf !== "NA");
            const skippedItems = items.filter(it => rowsPre[it.key]?.pf === "NA");
            return (
                <SectionCard key={q.key} id={sectionId} title={q.label[lang]} tooltip={qTooltip}>
                    <div className="tw-space-y-0">
                        <div className="tw-flex tw-items-center tw-pb-3 tw-border-b tw-border-gray-200">
                            <div className="tw-flex tw-items-center tw-gap-2">
                                <Typography variant="small" className="tw-text-blue-gray-600">{cfg.countLabel}</Typography>
                                <Typography variant="small" className="tw-font-bold tw-text-blue-600">{cfg.count} {cfg.countUnit}</Typography>
                            </div>
                        </div>
                        <div className="tw-divide-y tw-divide-gray-200">
                        {cfg.items.map((it, idx) => {
                            const isSkipped = rowsPre[it.key]?.pf === "NA";
                            if (isSkipped) {
                                return (
                                    <div key={it.key} className="tw-py-4 first:tw-pt-2 tw-bg-amber-50/50">
                                        <div className="tw-flex tw-items-center tw-justify-between">
                                            <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{it.label}</Typography>
                                            <span className="tw-text-xs tw-text-amber-600 tw-font-medium">N/A</span>
                                        </div>
                                        {rowsPre[it.key]?.remark && <Typography variant="small" className="tw-text-gray-600 tw-mt-1">{t("remarkLabel", lang)}: {rowsPre[it.key]?.remark}</Typography>}
                                    </div>
                                );
                            }
                            return (
                                <div key={it.key} className="tw-py-4 first:tw-pt-2">
                                    <PassFailRow label={it.label} value={rows[it.key]?.pf ?? ""} lang={lang}
                                        onChange={v => setRows({ ...rows, [it.key]: { ...(rows[it.key] ?? { remark: "" }), pf: v } })}
                                        remark={rows[it.key]?.remark ?? ""}
                                        onRemarkChange={v => setRows({ ...rows, [it.key]: { ...(rows[it.key] ?? { pf: "" }), remark: v } })}
                                        pfButtonsId={getPfIdFromKey(it.key)} remarkId={getRemarkIdFromKey(it.key)}
                                        aboveRemark={<div className="tw-pb-4 tw-border-b tw-border-gray-100"><PhotoMultiInput photos={photos[it.key] || []} setPhotos={makePhotoSetter(it.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(it.key)} /></div>}
                                        beforeRemark={<PreRemarkElement remark={rowsPre[it.key]?.remark} lang={lang} />}
                                    />
                                </div>
                            );
                        })}
                        </div>
                    </div>
                </SectionCard>
            );
        }

        // Simple POST
        return (
            <SectionCard key={q.key} id={sectionId} title={q.label[lang]} tooltip={qTooltip}>
                <div className="tw-py-2">
                    <PassFailRow label={t("testResult", lang)} value={rows[q.key]?.pf ?? ""} lang={lang}
                        onChange={v => setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { remark: "" }), pf: v } })}
                        remark={rows[q.key]?.remark ?? ""}
                        onRemarkChange={v => setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { pf: "" }), remark: v } })}
                        pfButtonsId={getPfIdFromKey(q.key)} remarkId={getRemarkIdFromKey(q.key)}
                        aboveRemark={<>{q.hasPhoto && <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-4 tw-border-gray-100"><PhotoMultiInput photos={photos[q.no] || []} setPhotos={makePhotoSetter(q.no)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(q.no)} /></div>}{checkboxElement && <div className="sm:tw-hidden tw-mb-3">{checkboxElement}</div>}</>}
                        inlineLeft={checkboxElement && <div className="tw-hidden sm:tw-flex">{checkboxElement}</div>}
                        beforeRemark={<PreRemarkElement remark={rowsPre[q.key]?.remark} lang={lang} />}
                    />
                </div>
            </SectionCard>
        );
    };

    // ==================== RENDER ====================
    return (
        <section className="tw-pb-24">
            <LoadingOverlay show={pageLoading} text="กำลังโหลดข้อมูล..." />
            <LoadingOverlay
                show={preUploadState.show}
                text={lang === "th"
                    ? `กำลังอัปโหลดรูป${isPostMode ? " Post-PM" : " Pre-PM"}... ${preUploadState.completed}/${preUploadState.total} รูป`
                    : `Uploading ${isPostMode ? "Post-PM" : "Pre-PM"} photos... ${preUploadState.completed}/${preUploadState.total}`}
            />
            <div className="tw-mx-auto tw-max-w-6xl tw-flex tw-items-center tw-justify-between tw-mb-4">
                <Button variant="outlined" size="sm" onClick={() => router.back()} title={t("backToList", lang)}>
                    <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
                </Button>
                <Tabs value={displayTab} key={displayTab}>
                    <TabsHeader className="tw-bg-blue-gray-50 tw-rounded-lg">
                        {TABS.map(tb => {
                            const isPreDisabled = isPostMode && tb.id === "pre";
                            const isLockedAfter = tb.id === "post" && !canGoAfter;
                            return (
                                <Tab key={tb.id} value={tb.id} disabled={isPreDisabled}
                                    onClick={() => {
                                        if (isPreDisabled) return;
                                        if (isLockedAfter) { alert(t("alertFillPreFirst", lang)); return; }
                                        go(tb.id);
                                    }}
                                    className={`tw-px-4 tw-py-2 tw-font-medium ${isPreDisabled || isLockedAfter ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}>
                                    {tb.label}
                                </Tab>
                            );
                        })}
                    </TabsHeader>
                </Tabs>
            </div>

            <form action="#" noValidate onSubmit={e => { e.preventDefault(); return false; }} onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}>
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
                                    {t("companyAddress", lang)}<br />
                                    {t("callCenter", lang)}
                                </div>
                            </div>
                        </div>
                        <div className="tw-text-left md:tw-text-right tw-text-sm tw-text-blue-gray-700 tw-border-t tw-border-blue-gray-100 tw-pt-3 md:tw-border-t-0 md:tw-pt-0 md:tw-shrink-0">
                            <div className="tw-font-semibold">{t("docName", lang)}</div>
                            <div className="tw-break-all">{docName || "-"}</div>
                        </div>
                    </div>

                    <div className="tw-mt-6 tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 tw-gap-3 sm:tw-gap-4">
                        <Input label={t("issueId", lang)} value={job.issue_id || "-"} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-bg-blue-gray-50 !tw-text-sm" />
                        <Input label={t("location", lang)} value={job.station_name} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50 !tw-text-sm" />
                        <Input label={t("pmDate", lang)} type="text" value={job.date} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50 !tw-text-sm" />
                        <Input label={t("inspector", lang)} value={inspector} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50 !tw-text-sm" />
                    </div>

                    <div className="tw-mt-6 sm:tw-mt-8 tw-space-y-4 sm:tw-space-y-6">
                        {QUESTIONS.filter(q => !(displayTab === "pre" && q.no === 13)).map(q => renderQuestionBlock(q, displayTab))}
                    </div>

                    <div id="mdb-pm-summary-section" className="tw-mt-6 sm:tw-mt-8 tw-space-y-3 tw-transition-all tw-duration-300">
                        <Typography variant="h6" className="tw-mb-1 tw-text-sm sm:tw-text-base">{t("comment", lang)}</Typography>
                        <Textarea label={t("comment", lang)} value={summary} onChange={e => setSummary(e.target.value)} rows={3} required={isPostMode} autoComplete="off" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-text-sm resize-none" />
                        {displayTab === "post" && (
                            <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-200">
                                <PassFailRow label={t("summaryResult", lang)} value={summaryCheck} onChange={v => setSummaryCheck(v)} lang={lang}
                                    labels={{ PASS: t("summaryPassLabel", lang), FAIL: t("summaryFailLabel", lang), NA: t("summaryNALabel", lang) }} />
                            </div>
                        )}
                    </div>

                    <div className="tw-mt-6 sm:tw-mt-8 tw-flex tw-flex-col tw-gap-3">
                        <PMValidationCard
                            lang={lang} displayTab={displayTab} isPostMode={isPostMode}
                            allPhotosAttached={allPhotosAttached} missingPhotoItems={missingPhotoItems}
                            allRequiredInputsFilled={allRequiredInputsFilled} missingInputsDetailed={missingInputsDetailed}
                            allRemarksFilledPre={allRemarksFilledPre} missingRemarksPre={missingRemarksPre}
                            allPFAnsweredPost={allPFAnsweredPost} missingPFItemsPost={missingPFItemsPost}
                            allRemarksFilledPost={allRemarksFilledPost} missingRemarksPost={missingRemarksPost}
                            isSummaryFilled={isSummaryFilled} isSummaryCheckFilled={isSummaryCheckFilled}
                        />
                        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-2 sm:tw-gap-3">
                            {displayTab === "pre" ? (
                                <Button type="button" onClick={onPreSave} disabled={!canGoAfter || submitting}
                                    className="tw-text-sm tw-py-2.5 tw-bg-gray-800 hover:tw-bg-gray-900"
                                    title={!allPhotosAttachedPre ? t("photoNotComplete", lang) : !allRequiredInputsFilled ? t("inputNotComplete", lang) : !allRemarksFilledPre ? `${t("alertFillRemark", lang)} ${missingRemarksPre.join(", ")}` : undefined}>
                                    {submitting ? t("saving", lang) : t("save", lang)}
                                </Button>
                            ) : (
                                <Button type="button" onClick={onFinalSave} disabled={!canFinalSave || submitting}
                                    className="tw-text-sm tw-py-2.5 tw-bg-gray-800 hover:tw-bg-gray-900"
                                    title={!canFinalSave ? t("allNotComplete", lang) : undefined}>
                                    {submitting ? t("saving", lang) : t("save", lang)}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </form>
            <BackgroundUploadBanner lang={lang} />
        </section>
    );
}