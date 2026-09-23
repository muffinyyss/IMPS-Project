"use client";

import React, { useMemo, useCallback, useRef, useState, useEffect } from "react";
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
import { findMissingCcbMeasurementInputs } from "../lib/validation";

import { useRouter, useSearchParams } from "next/navigation";
import PmApprovalBar from "@/app/dashboard/pm-report/components/PmApprovalBar";
import PmCompareTable from "@/app/dashboard/pm-report/components/PmCompareTable";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { putPhoto, getPhotoByDbKey, delPhoto, type PhotoRef } from "../lib/draftPhotos";
import { isFileReadable, isImageDecodable, resolveUsableFile, reportMissingDraftPhoto, reportPhotoStorageFailure } from "@/utils/upload-safety";
import { ensureViewableImage } from "@/utils/heic";
import { collectPending, unrecoverablePhotos, expectedCountByGroup, findShortfall, shortfallMessage, pendingMessage, unrecoverableMessage } from "@/utils/pm-photo-sync";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import { apiFetch } from "@/utils/api";
import LoadingOverlay from "@/app/dashboard/components/Loadingoverlay";
import { pmBackRoute } from "@/app/dashboard/pm-report/lib/origin";
import { useDebouncedEffect } from "@/app/dashboard/pm-report/lib/useDebouncedEffect";

// ==================== GPS + ADDRESS CACHE ====================
let _cachedLocation: { text: string; timestamp: number } | null = null;
let _locationFetching = false;
const LOCATION_CACHE_MAX_AGE = 5 * 60 * 1000;

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
    await Promise.race([
        prefetchLocation(),
        new Promise<void>(resolve => setTimeout(resolve, 2000))
    ]);
    return _cachedLocation?.text || "ไม่สามารถระบุตำแหน่งได้";
}

// ==================== BACKGROUND UPLOAD QUEUE ====================
type BgUploadTask = {
    reportId: string;
    stationId: string;
    group: string;
    file: File;
    side: "post";
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

// ==================== IMAGE UTILS ====================
// ⚡ FIX 422: ชื่อไฟล์จากกล้อง/แกลเลอรีบางเครื่องมี " หรือ newline ปนมา ทำให้ header
// Content-Disposition ของ multipart เพี้ยน → server parse body ไม่ออก ตอบ 422 โดยที่
// station_id/group/files หายพร้อมกันทั้งหมด จึงเหลือไว้เฉพาะอักขระที่ปลอดภัยเสมอ
function ensureJpgFilename(name: string): string {
    const base = (name || "").replace(/\.[^.]*$/, "");
    const safe = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._-]+/, "").slice(0, 80);
    return safe ? `${safe}.jpg` : `image_${Date.now()}.jpg`;
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


// บีบรูปก่อนอัปโหลด — การันตีว่าผลลัพธ์เล็กกว่า targetBytes
// แก้คอมเมนต์ 2026-09-23: เพดานจริงของ nginx คือ 30M ไม่ใช่ ~1MB ตามที่เคยเขียนไว้
// (ตรวจแล้วที่ /etc/nginx/conf.d/imps-upload.conf — client_max_body_size 30M)
// targetBytes 900KB ยังคงไว้เพราะจงใจ: ช่างอัปจากมือถือผ่าน 4G ทีละ 10 รูป
// ไฟล์เล็กกว่า = อัปเร็วกว่าและเปลืองพื้นที่เซิร์ฟเวอร์น้อยกว่า ไม่ใช่ข้อจำกัดของ nginx
// ไฟล์ที่เล็กกว่าเป้าอยู่แล้วจะคืนค่าเดิมทันที (nginx จำกัดที่ "ขนาดไฟล์" ไม่ใช่ความละเอียด)
async function compressImage(
    file: File,
    maxWidth = 1600,
    quality = 0.8,
    targetBytes = 900 * 1024,
): Promise<File> {
    if (!file.type.startsWith("image/") || file.size <= targetBytes) return file;

    const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const im = document.createElement("img");
        im.onload = () => resolve(im);
        im.onerror = () => resolve(null);
        im.src = URL.createObjectURL(file);
    });
    if (!img) return file;
    URL.revokeObjectURL(img.src);

    let { width, height } = img;
    if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const toBlob = (q: number) =>
        new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", q));

    // วนลดคุณภาพทีละขั้นจนกว่าไฟล์จะเล็กกว่าเป้า (หรือถึงคุณภาพต่ำสุดที่ยอมรับได้)
    let q = quality;
    let blob = await toBlob(q);
    while (blob && blob.size > targetBytes && q > 0.4) {
        q = Math.round((q - 0.1) * 10) / 10;
        blob = await toBlob(q);
    }

    if (!blob || blob.size >= file.size) return file; // toBlob ล้มเหลว หรือไม่เล็กลง → ใช้ไฟล์เดิม
    return new File([blob], ensureJpgFilename(file.name), { type: "image/jpeg" });
}

async function _bgCompressImage(file: File, maxWidth = 1600, quality = 0.8): Promise<File> {
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

async function _bgUploadSingle(reportId: string, stationId: string, group: string, file: File, side: "post") {
    if (!file || file.size === 0) throw new Error(`Empty file: ${file?.name ?? "unknown"}`);
    const form = new FormData();
    form.append("station_id", stationId);
    form.append("group", group);
    form.append("side", side);
    form.append("files", file, ensureJpgFilename(file.name));
    const url = `${API_BASE}/ccbpmreport/${reportId}/post/photos`;
    const res = await apiFetch(url, { method: "POST", body: form });
    if (!res.ok) { const errText = await res.text().catch(() => ""); throw new Error(`[${res.status}] ${group}: ${errText || res.statusText}`); }
}

async function _bgUploadWithRetry(reportId: string, stationId: string, group: string, file: File, side: "post", maxRetries = 3) {
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

    // Buttons
    save: { th: "บันทึก", en: "Save" },
    saving: { th: "กำลังบันทึก...", en: "Saving..." },
    attachPhoto: { th: "แนบรูป / ถ่ายรูป", en: "Attach / Take Photo" },
    pass: { th: "PASS", en: "PASS" },
    fail: { th: "FAIL", en: "FAIL" },
    na: { th: "N/A", en: "N/A" },
    cancelNA: { th: "ยกเลิก N/A", en: "Cancel N/A" },
    backToList: { th: "กลับไปหน้า List", en: "Back to List" },

    // Legacy Pass/Fail labels retained for previously saved reports
    summaryPassLabel: { th: "Pass", en: "Pass" },
    summaryFailLabel: { th: "Fail", en: "Fail" },
    summaryNALabel: { th: "N/A", en: "N/A" },

    // Photo input
    maxPhotos: { th: "สูงสุด", en: "Max" },
    photos: { th: "รูป", en: "photos" },
    cameraSupported: { th: "รองรับการถ่ายจากกล้องบนมือถือ", en: "Camera supported on mobile" },
    noPhotos: { th: "ยังไม่มีรูปแนบ", en: "No photos attached" },

    // Remarks
    remark: { th: "หมายเหตุ", en: "Remark" },
    remarkLabel: { th: "หมายเหตุ", en: "Remark" },
    testResult: { th: "ผลการทดสอบ", en: "Test Result" },

    // Section labels
    comment: { th: "Comment", en: "Comment" },
    summaryResult: { th: "สรุปผลการตรวจสอบ", en: "Inspection Summary" },

    // Validation sections
    validationPhotoTitle: { th: "1) ตรวจสอบการแนบรูปภาพ (ทุกข้อ)", en: "1) Photo Attachments (all items)" },
    validationInputTitle: { th: "2) อินพุตข้อ 11 (ค่าที่วัด)", en: "2) Input Item 11 (measurements)" },
    validationRemarkTitle: { th: "3) หมายเหตุ (ทุกข้อ)", en: "3) Remarks (all items)" },
    validationPFTitle: { th: "3) ระดับผลการตรวจ / N/A ทุกข้อ", en: "3) Inspection rating / N/A for all items" },
    validationRemarkTitlePost: { th: "4) หมายเหตุ (ทุกข้อ)", en: "4) Remarks (all items)" },
    validationSummaryTitle: { th: "5) สรุปผลการตรวจสอบ", en: "5) Inspection Summary" },

    allComplete: { th: "ครบเรียบร้อย ✅", en: "Complete ✅" },
    missingPhoto: { th: "ยังไม่ได้แนบรูปข้อ:", en: "Missing photos for:" },
    missingInput: { th: "ยังขาดข้อ:", en: "Missing:" },
    missingPF: { th: "ยังไม่ได้เลือกข้อ:", en: "Not selected:" },
    missingSummaryText: { th: "ยังไม่ได้กรอก Comment", en: "Comment not filled" },
    missingSummaryStatus: { th: "ยังไม่ได้เลือกระดับสรุปผล / N/A", en: "Summary rating / N/A not selected" },
    // PMValidationCard translations
    itemLabel: { th: "ข้อ", en: "Item" },
    formStatus: { th: "สถานะการกรอกข้อมูล", en: "Form Completion Status" },
    allCompleteReady: { th: "กรอกข้อมูลครบถ้วนแล้ว พร้อมบันทึก ✓", en: "All fields completed. Ready to save ✓" },
    remaining: { th: "ยังขาดอีก {n} รายการ", en: "{n} items remaining" },
    items: { th: "รายการ", en: "items" },

    // Alerts
    alertNoStation: { th: "ยังไม่ทราบ station_id", en: "Station ID not found" },
    alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },
    alertFillPhoto: { th: "กรุณาแนบรูปในทุกข้อก่อนบันทึก", en: "Please attach photos for all items" },
    alertInputNotComplete: { th: "กรุณากรอกค่าข้อ 11 ให้ครบ", en: "Please fill in Item 11" },
    alertCompleteAll: { th: "กรุณากรอกข้อมูลและแนบรูปให้ครบก่อนบันทึก", en: "Please complete all fields and attach photos before saving" },

    // Questions
    q1: { th: "1) ตรวจสอบสภาพทั่วไป", en: "1) General condition inspection" },
    preQ1: { th: "1) ตรวจสอบสภาพทั่วไป (ก่อนบำรุงรักษา)", en: "1) General condition (before maintenance)" },
    preQ2: { th: "2) อุปกรณ์ชำรุดเสียหาย (ก่อนบำรุงรักษา)", en: "2) Damaged equipment (before maintenance)" },
    preQ3: { th: "3) ตรวจสอบสภาพแหล่งจ่ายไฟ MDB", en: "3) Inspect MDB power supply condition" },
    preQ3_tooltip: { th: "ตรวจสอบสภาพอุปกรณ์แหล่งจ่ายไฟของตู้ CCB", en: "Inspect the CCB power supply equipment" },
    preQ3_1: { th: "Main CB", en: "Main CB" },
    preQ3_2: { th: "CB", en: "CB" },
    preQ3_3: { th: "Power Meter (Voltage)", en: "Power Meter (Voltage)" },
    preQ3_4: { th: "Transformer", en: "Transformer" },
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

    // Misc UI
    loading: { th: "กำลังโหลดข้อมูล...", en: "Loading..." },
    logoAlt: { th: "โลโก้บริษัท", en: "Company logo" },
    photoPreviewAlt: { th: "ตัวอย่างรูป", en: "Photo preview" },
    removeItem: { th: "ลบรายการ", en: "Remove item" },
    takePhoto: { th: "ถ่ายรูป", en: "Take Photo" },
    workTime: { th: "เวลาทำงานจริง", en: "Actual work time" },
    workStart: { th: "เวลาเริ่มงาน", en: "Start time" },
    workFinish: { th: "เวลาเสร็จงาน", en: "Finish time" },
    workTimeHint: { th: "ใช้ส่งเวลาทำงานของช่างเข้า Maximo", en: "Sent to Maximo as actual labor time" },
    alertWorkTime: { th: "กรุณากรอกเวลาเริ่มงานและเวลาเสร็จงาน", en: "Please fill in the start and finish time" },
    alertWorkTimeOrder: { th: "เวลาเสร็จงานต้องไม่ก่อนเวลาเริ่มงาน", en: "Finish time must not be before the start time" },
    alertWorkTimeFuture: { th: "เวลาทำงานต้องไม่เป็นเวลาในอนาคต — Maximo ไม่รับเวลาที่ยังมาไม่ถึง", en: "Work time cannot be in the future — Maximo rejects labor times that have not happened yet" },
    maximoLabor: { th: "ช่างที่ลงเวลากับ Maximo", en: "Technicians for Maximo time log" },
    maximoLaborHint: {
        th: "เลือกคนที่จะลงเวลาทำงานเข้า Maximo (IN09) — ไม่เลือกจะใช้ช่างที่ผู้วางแผนมอบหมายแทน",
        en: "Who gets an actual-labor record in Maximo (IN09) — leave empty to fall back to the assigned technicians",
    },
    maximoLaborEmpty: { th: "ยังไม่มีรหัสช่างจาก Maximo", en: "No Maximo labor codes available" },
    maximoLaborNone: { th: "ช่างไม่ได้เลือกใครไว้", en: "No technician selected" },
    contractorName: { th: "ชื่อผู้รับเหมา", en: "Contractor name" },
    contractorPlaceholder: { th: "ระบุชื่อผู้รับเหมาที่มาทำงานจริง", en: "Name of the contractor who did the work" },
    contractorRequired: { th: "เลือกผู้รับเหมาแล้วต้องระบุชื่อด้วย", en: "Enter the contractor name" },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

// Helper functions to generate scroll IDs
const ID_PREFIX = "ccb-pm";

// Convert CCB photo state key to the internal control ID used by the form.
const formatPhotoKeyNumber = (key: number): string => {
    if (key === 1001) return "1";
    if (key === 1002) return "2";
    if (key === 90) return "9";
    if (key >= 101 && key <= 106) return `10-${key - 100}`;
    if (key >= 1031 && key <= 1034) return `103-${key - 1030}`;
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
    if (key === "r9_main") return `${ID_PREFIX}-remark-9`;
    const subMatch = String(key).match(/^r10_sub(\d+)$/);
    if (subMatch) return `${ID_PREFIX}-remark-10-${subMatch[1]}`;
    const match = String(key).match(/^r(\d+)(?:_(\d+))?$/);
    if (match) {
        const [, qNo, subNo] = match;
        return subNo ? `${ID_PREFIX}-remark-${qNo}-${subNo}` : `${ID_PREFIX}-remark-${qNo}`;
    }
    return `${ID_PREFIX}-remark-${key}`;
};

const getInputIdFromKey = (key: string | number, subIdx?: number): string => {
    if (typeof key === "number") return subIdx ? `${ID_PREFIX}-input-${key}-${subIdx}` : `${ID_PREFIX}-input-${key}`;
    if (key === "r9_main") return `${ID_PREFIX}-input-9`;
    const subMatch = String(key).match(/^r10_sub(\d+)$/);
    if (subMatch) return `${ID_PREFIX}-input-10-${subMatch[1]}`;
    const match = String(key).match(/^r(\d+)(?:_(\d+))?$/);
    if (match) {
        const [, qNo, subNo] = match;
        return subNo ? `${ID_PREFIX}-input-${qNo}-${subNo}` : `${ID_PREFIX}-input-${qNo}`;
    }
    return `${ID_PREFIX}-input-${key}`;
};

const getPfIdFromKey = (key: string | number): string => {
    if (typeof key === "number") return `${ID_PREFIX}-pf-${key}`;
    if (key === "r9_main") return `${ID_PREFIX}-pf-9`;
    const subMatch = String(key).match(/^r10_sub(\d+)$/);
    if (subMatch) return `${ID_PREFIX}-pf-10-${subMatch[1]}`;
    const match = String(key).match(/^r(\d+)(?:_(\d+))?$/);
    if (match) {
        const [, qNo, subNo] = match;
        return subNo ? `${ID_PREFIX}-pf-${qNo}-${subNo}` : `${ID_PREFIX}-pf-${qNo}`;
    }
    return `${ID_PREFIX}-pf-${key}`;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const LOGO_SRC = "/img/logo_egat.png";

type StationPublic = { station_id: string; station_name: string; status?: boolean; };
type Me = { id: string; username: string; email: string; role: string; company: string; tel: string; };

const UNITS = { voltage: ["V"] as const };
type UnitVoltage = (typeof UNITS.voltage)[number];

type PhotoItem = { id: string; file?: File; preview?: string; remark?: string; uploading?: boolean; uploaded?: boolean; error?: string; ref?: PhotoRef; isNA?: boolean; createdAt?: string; location?: string; };

/** หาไฟล์ที่อัปโหลดได้จริงของรูปหนึ่งใบ — กู้จาก IndexedDB ให้เองถ้าไฟล์ใน memory ใช้ไม่ได้แล้ว */
function resolveUploadFile(p: PhotoItem): Promise<File> {
    const dbKey = p.ref?.dbKey;
    return resolveUsableFile(p.file, dbKey ? () => getPhotoByDbKey(dbKey) : undefined);
}

type Rating = "VERY_GOOD" | "GOOD" | "FAIR" | "UNUSABLE";
type PF = Rating | "PASS" | "FAIL" | "NA" | "";

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
    { no: 101, key: "pre_r1", labelKey: "preQ1", kind: "simple", hasPhoto: true, tooltipKey: "q1_tooltip" },
    { no: 102, key: "pre_r2", labelKey: "preQ2", kind: "simple", hasPhoto: true, tooltipKey: "q1_tooltip" },
    {
        no: 103, key: "r103", labelKey: "preQ3", kind: "group", hasPhoto: true, tooltipKey: "preQ3_tooltip",
        items: [
            { key: "r103_1", labelKey: "preQ3_1" },
            { key: "r103_2", labelKey: "preQ3_2" },
            { key: "r103_3", labelKey: "preQ3_3" },
            { key: "r103_4", labelKey: "preQ3_4" },
        ],
    },
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

function getQuestionLabel(q: Question, lang: Lang): string {
    const label = t(q.labelKey, lang);
    return label.replace(/^\d+(?=[.)])/, String(getDisplayedQuestionNo(q.no)));
}

// ข้อ 1-3 (no 101-103) เพิ่มไว้หน้าฟอร์ม ข้อเดิม no=1..11 ยังใช้คีย์ชุดเดิมใน DB
// จึงเลื่อนเฉพาะเลขที่แสดงผล
const DISPLAY_SHIFT = 3;

const getDisplayedQuestionNo = (qNo: number): number => qNo >= 100 ? qNo - 100 : qNo + DISPLAY_SHIFT;

const getDisplayedItemLabel = (label: string): string =>
    label.replace(/^(\d+)(?=[.)])/, (_, qNo: string) => String(Number(qNo) + DISPLAY_SHIFT));

const getDisplayedRowNo = (key: string): string => {
    if (key === "pre_r1") return "1";
    if (key === "pre_r2") return "2";
    if (key === "r9_main") return String(9 + DISPLAY_SHIFT);
    const subBreaker = key.match(/^r10_sub(\d+)$/);
    if (subBreaker) return `${10 + DISPLAY_SHIFT}.${subBreaker[1]}`;
    const row = key.match(/^r(\d+)(?:_(\d+))?$/);
    if (row && Number(row[1]) >= 100) return row[2] ? `${Number(row[1]) - 100}.${row[2]}` : String(Number(row[1]) - 100);
    if (row) return row[2] ? `${Number(row[1]) + DISPLAY_SHIFT}.${row[2]}` : String(Number(row[1]) + DISPLAY_SHIFT);
    return key;
};

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


function SectionCard({ title, subtitle, children, tooltip }: { title?: string; subtitle?: string; children: React.ReactNode; tooltip?: string }) {
    const qNumber = title?.match(/^(\d+)\)/)?.[1];
    return (
        <div className="tw-bg-white tw-rounded-xl tw-border tw-border-gray-200 tw-shadow-sm tw-overflow-hidden">
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
    allPhotosAttached: boolean;
    missingPhotoItems: string[];
    allRequiredInputsFilled: boolean;
    missingInputsDetailed: MissingInputItem[];
    allPFAnsweredPost: boolean;
    missingPFItemsPost: string[];
    isSummaryFilled: boolean;
    isSummaryCheckFilled: boolean;
}

function PMValidationCard({
    lang,
    allPhotosAttached, missingPhotoItems,
    allRequiredInputsFilled, missingInputsDetailed,
    allPFAnsweredPost, missingPFItemsPost,
    isSummaryFilled, isSummaryCheckFilled,
}: PMValidationCardProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    const handleHeaderClick = () => { setIsExpanded(!isExpanded); };

    const getPhotoScrollId = (item: string): string => {
        const parts = item.split('.');
        const displayedNo = Number(parts[0]);
        const internalNo = displayedNo <= 2 ? displayedNo : displayedNo === 3 ? 103 : displayedNo - 3;
        if (parts.length === 2) return `${ID_PREFIX}-photo-${internalNo}-${parts[1]}`;
        return `${ID_PREFIX}-photo-${internalNo}`;
    };

    const getPfButtonsScrollId = (item: string): string => {
        const parts = item.split('.');
        const displayedPfNo = Number(parts[0]);
        const internalNo = displayedPfNo === 3 ? 103 : displayedPfNo - 3;
        if (parts.length === 2) return `${ID_PREFIX}-pf-${internalNo}-${parts[1]}`;
        return `${ID_PREFIX}-pf-${internalNo}`;
    };

    const allErrors: ValidationError[] = useMemo(() => {
        const errors: ValidationError[] = [];

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

        if (!allRequiredInputsFilled) {
            missingInputsDetailed.forEach(({ qNo, subNo, label }) => {
                const scrollId = subNo ? `${ID_PREFIX}-input-${qNo}-${subNo}` : `${ID_PREFIX}-input-${qNo}`;
                const itemDisplay = subNo ? `${getDisplayedQuestionNo(qNo)}.${subNo}` : `${getDisplayedQuestionNo(qNo)}`;
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

        if (!allPFAnsweredPost) {
            missingPFItemsPost.forEach((item) => {
                errors.push({
                    section: lang === "th" ? "ระดับผลการตรวจ" : "Inspection rating",
                    sectionIcon: "✅",
                    itemName: `${t("itemLabel", lang)} ${item}`,
                    message: lang === "th" ? "ยังไม่ได้เลือกระดับผลการตรวจ" : "Inspection rating not selected",
                    scrollId: getPfButtonsScrollId(item),
                });
            });
        }

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
                message: lang === "th" ? "ยังไม่ได้เลือกระดับผลการตรวจหรือ N/A" : "Inspection rating or N/A not selected",
                scrollId: `${ID_PREFIX}-summary-section`,
            });
        }

        return errors;
    }, [
        lang,
        allPhotosAttached, missingPhotoItems,
        allRequiredInputsFilled, missingInputsDetailed,
        allPFAnsweredPost, missingPFItemsPost,
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

function PassFailRow({ label, value, onChange, remark, onRemarkChange, labels, aboveRemark, beforeRemark, inlineLeft, showPfButtons = true, lang, id, remarkId }: {
    label: string; value: PF; onChange: (v: Rating | "NA") => void; remark?: string; onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>; aboveRemark?: React.ReactNode; beforeRemark?: React.ReactNode; inlineLeft?: React.ReactNode; showPfButtons?: boolean; lang: Lang; id?: string; remarkId?: string;
}) {
    const text = {
        VERY_GOOD: labels?.VERY_GOOD ?? (lang === "th" ? "ดีมาก" : "Excellent"),
        GOOD: labels?.GOOD ?? (lang === "th" ? "ดี" : "Good"),
        FAIR: labels?.FAIR ?? (lang === "th" ? "พอใช้" : "Fair"),
        UNUSABLE: labels?.UNUSABLE ?? (lang === "th" ? "ใช้งานไม่ได้" : "Unusable"),
        NA: labels?.NA ?? t("na", lang),
    };
    // layout เดียวกับทุกฟอร์ม PM: หัวข้อ → รูป → ปุ่มระดับผลชิดขวา → หมายเหตุ
    const buttonGroup = (
        <div id={id} className="tw-flex tw-flex-wrap tw-gap-2 tw-ml-auto tw-transition-all tw-duration-300">
            <Button size="sm" color="green" variant={value === "VERY_GOOD" || value === "PASS" ? "filled" : "outlined"} className="sm:tw-min-w-[84px]" onClick={() => onChange("VERY_GOOD")}>{text.VERY_GOOD}</Button>
            <Button size="sm" color="light-green" variant={value === "GOOD" ? "filled" : "outlined"} className="sm:tw-min-w-[84px]" onClick={() => onChange("GOOD")}>{text.GOOD}</Button>
            <Button size="sm" color="amber" variant={value === "FAIR" ? "filled" : "outlined"} className="sm:tw-min-w-[84px]" onClick={() => onChange("FAIR")}>{text.FAIR}</Button>
            <Button size="sm" color="red" variant={value === "UNUSABLE" || value === "FAIL" ? "filled" : "outlined"} className="sm:tw-min-w-[112px]" onClick={() => onChange("UNUSABLE")}>{text.UNUSABLE}</Button>
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
                    {showPfButtons && buttonsRow}
                    {beforeRemark}
                    <div id={remarkId} className="tw-transition-all tw-duration-300">
                        <Textarea label={t("remark", lang)} value={remark || ""} onChange={(e) => onRemarkChange(e.target.value)}
                            containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full" />
                    </div>
                </div>
            ) : (
                showPfButtons && <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">{buttonsRow}</div>
            )}
        </div>
    );
}

/**
 * ข้อความโควตารูปของข้อย่อย — เพดานจริงลดลงเองเมื่อข้อย่อยอื่นแนบไปแล้ว
 * (ต่อข้อย่อย 5 แต่รวมทั้งข้อ 20 ตาม PHOTO_MAX_PER_ROW ของ pdf_ccb.py)
 * ถ้าเขียนแค่ "สูงสุด 5 รูป" ผู้ใช้จะเห็นเพดานตรงกับฟอร์ม
 */
function subItemQuotaLabel(itemCount: number, groupTotal: number, itemMax: number, groupMax: number, lang: Lang): string {
    const canAdd = Math.max(0, Math.min(itemMax - itemCount, groupMax - groupTotal));
    if (canAdd > 0) {
        return lang === "th"
            ? `แนบได้อีก ${canAdd} รูป (ข้อย่อยนี้ ${itemCount}/${itemMax})`
            : `${canAdd} more allowed (this sub-item ${itemCount}/${itemMax})`;
    }
    if (itemCount >= itemMax) {
        return lang === "th" ? `ข้อย่อยนี้ครบ ${itemMax} รูปแล้ว` : `This sub-item is full (${itemMax} photos)`;
    }
    return lang === "th"
        ? `ข้อนี้ครบ ${groupMax} รูปแล้ว (นับรวมทุกข้อย่อย)`
        : `This question is full (${groupMax} photos across all sub-items)`;
}

function PhotoMultiInput({ photos, setPhotos, max = 10, draftKey, qNo, lang, id, hideMaxLabel = false, maxLabel }: {
    photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
    max?: number; draftKey: string; qNo: number; lang: Lang; id?: string; hideMaxLabel?: boolean; maxLabel?: string;
}) {
    const cameraRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const isMobile = useMemo(() => isMobileDevice(), []);
    const [landscapeWarning, setLandscapeWarning] = useState(false);

    const processFile = async (rawFile: File): Promise<PhotoItem | null> => {
        try {
            // กันไฟล์ว่าง (size=0) ตั้งแต่ต้นทาง — เป็นต้นเหตุของ error "Empty file (size=0)" ตอนอัปโหลด
            if (!rawFile || rawFile.size === 0) {
                console.warn("processFile: empty source file", rawFile?.name);
                return null;
            }
            // รูป HEIC จาก iPhone: เบราว์เซอร์นอกจาก Safari decode ไม่ได้ ทำให้ทั้งท่อพังเงียบ ๆ
            // — addTimestampToImage ไม่ประทับเวลา/พิกัด, compressImage ไม่บีบ, preview ขึ้นกรอบว่าง
            // แปลงเป็น JPEG ที่ server ก่อน (ล้มเหลวก็คืนไฟล์เดิม backend แปลงให้อีกชั้นตอนอัปโหลด)
            const file = await ensureViewableImage(rawFile);
            const locationText = await getCachedLocation();
            const stamped = await addTimestampToImage(file, locationText);
            // ถ้า encode แล้วได้ไฟล์ว่าง (เช่น canvas ล้มเหลวบางเครื่อง) ให้ fallback ไฟล์เดิม แล้วเช็กซ้ำ
            const fileWithTimestamp = (stamped && stamped.size > 0) ? stamped : file;
            if (fileWithTimestamp.size === 0) {
                console.warn("processFile: empty file after timestamp", file.name);
                return null;
            }
            // บีบรูปก่อนเก็บลง IndexedDB — ลดพื้นที่จัดเก็บ (กัน quota เต็มบนมือถือ) + ได้รูปที่พร้อมอัปโหลดเลย
            const compressed = await compressImage(fileWithTimestamp);
            const finalFile = (compressed && compressed.size > 0) ? compressed : fileWithTimestamp;
            // ⚡ ดักตั้งแต่ตอนแนบ: .size เชื่อไม่ได้ (iOS คืน backing store แต่ยังรายงาน size เดิม)
            if (!(await isFileReadable(finalFile))) {
                console.warn("processFile: ไฟล์อ่านไม่ได้ตั้งแต่ตอนแนบ", file.name);
                return null;
            }
            // หมายเหตุ: เคย return null ตรงนี้ถ้า decode ไม่ผ่าน แต่ทำให้แนบรูปไม่ได้เลย
            // เพราะ CSP img-src ไม่อนุญาต blob: การโหลดรูปเลยล้มเหลวทุกใบ
            // เหลือไว้เป็น log อย่างเดียว ห้ามใช้ block การแนบรูป
            if (!(await isImageDecodable(finalFile))) {
                console.warn("processFile: เบราว์เซอร์แสดงผลรูปนี้ไม่ได้", file.name, file.type);
            }
            const photoId = `${qNo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
            // เขียน IndexedDB ไม่ได้ (พื้นที่เต็ม / private mode) → ห้ามทิ้งรูป เก็บใน memory ต่อแล้วเตือน
            let ref: PhotoRef | undefined;
            try { ref = await putPhoto(draftKey, photoId, finalFile); }
            catch (e) { console.error("putPhoto failed:", e); reportPhotoStorageFailure(lang); }
            return { id: photoId, file: finalFile, preview: URL.createObjectURL(finalFile), remark: "", ref };
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
        const rejected = validFiles.length - accepted.length;
        if (accepted.length > 0) setPhotos(prev => [...prev, ...accepted]);
        // แจ้งเตือนถ้ามีรูปว่าง/เสียหายถูกข้าม — กันผู้ใช้เข้าใจผิดว่าแนบครบแล้ว
        if (rejected > 0) {
            alert(lang === "th"
                ? `มีรูปว่าง/เสียหาย ${rejected} รูป ใช้ไม่ได้ กรุณาถ่ายหรือเลือกใหม่อีกครั้ง`
                : `${rejected} photo(s) are empty/corrupted and were skipped. Please retake or reselect.`);
        }
        if (hasLandscape) setLandscapeWarning(true);
        if (cameraRef.current) cameraRef.current.value = "";
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleRemove = async (id: string) => {
        await delPhoto(draftKey, id);
        setPhotos((prev) => { const target = prev.find((p) => p.id === id); if (target?.preview) URL.revokeObjectURL(target.preview); return prev.filter((p) => p.id !== id); });
    };

    return (
        <div id={id} className="tw-space-y-2 sm:tw-space-y-3 tw-transition-all tw-duration-300">
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
                    <Button size="sm" color="blue" variant="outlined" onClick={() => cameraRef.current?.click()} className="tw-shrink-0 tw-flex tw-items-center tw-gap-1 tw-text-[10px] sm:tw-text-xs lg:tw-text-sm tw-px-2 sm:tw-px-3 tw-py-1.5 sm:tw-py-2">
                        <svg className="tw-w-4 tw-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {t("takePhoto", lang)}
                    </Button>
                ) : (
                    <Button size="sm" color="blue" variant="outlined" onClick={() => fileRef.current?.click()} className="tw-shrink-0 tw-flex tw-items-center tw-gap-1 tw-text-[10px] sm:tw-text-xs lg:tw-text-sm tw-px-2 sm:tw-px-3 tw-py-1.5 sm:tw-py-2">
                        <svg className="tw-w-4 tw-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {t("attachPhoto", lang)}
                    </Button>
                )}
            </div>
            {isMobile && <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="tw-hidden" onChange={e => { void handleFiles(e.target.files, true); }} />}
            {!isMobile && <input ref={fileRef} type="file" accept="image/*" multiple className="tw-hidden" onChange={e => { void handleFiles(e.target.files, false); }} />}
            {!hideMaxLabel && (
                <Typography variant="small" className="!tw-text-blue-gray-500 tw-flex tw-items-center">
                    {maxLabel ?? `${t("maxPhotos", lang)} ${max} ${t("photos", lang)}`}
                </Typography>
            )}
            {photos.length > 0 ? (
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-2 sm:tw-gap-3">
                    {photos.map((p) => (<div key={p.id} className="tw-border tw-rounded-lg tw-overflow-hidden tw-bg-white tw-shadow-xs tw-flex tw-flex-col"><div className="tw-relative tw-aspect-[4/3] tw-bg-blue-gray-50">{p.preview && <img src={p.preview} alt={t("photoPreviewAlt", lang)} className="tw-w-full tw-h-full tw-object-cover" />}<button data-photo-remove onClick={() => { void handleRemove(p.id); }} className="tw-absolute tw-top-1.5 tw-right-1.5 sm:tw-top-2 sm:tw-right-2 tw-bg-red-500 tw-text-white tw-w-5 tw-h-5 sm:tw-w-6 sm:tw-h-6 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-shadow-md hover:tw-bg-red-600 tw-transition-colors tw-text-xs sm:tw-text-sm">×</button></div></div>))}
                </div>
            ) : (<Typography variant="small" className="!tw-text-blue-gray-500 tw-text-xs sm:tw-text-sm">{t("noPhotos", lang)}</Typography>)}
        </div>
    );
}

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

function getPhotoKeyForQuestion(q: Question, subKey?: string): number {
    if (q.key === "pre_r1") return 1001;
    if (q.key === "pre_r2") return 1002;
    if (q.kind === "mainBreaker") return 90;
    if (q.kind === "subBreakers" && subKey) {
        const match = subKey.match(/r10_sub(\d+)/);
        if (match) return 100 + parseInt(match[1], 10);
    }
    if (q.kind === "group" && subKey) {
        const match = subKey.match(/r(\d+)_(\d+)/);
        if (match) {
            return parseInt(match[1], 10) * 10 + parseInt(match[2], 10);
        }
    }
    return q.no;
}

export default function CCBPMReport() {
    const { lang } = useLanguage();
    const [me, setMe] = useState<Me | null>(null);
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [uploadState, setUploadState] = useState({ show: false, total: 0, completed: 0, failed: 0 });
    const [docName, setDocName] = useState<string>("");
    const [reportId, setReportId] = useState<string>("");

    const searchParams = useSearchParams();

    // ปุ่มย้อนกลับ: เปิดมาจากหน้า PM List ให้กลับไปหน้านั้นตรงๆ
    // ไม่ได้เปิดมาจาก PM List (ไม่มี route ต้นทาง) ค่อยถอยประวัติด้วย router.back()
    const goBackToList = useCallback(() => {
        const back = pmBackRoute(searchParams);
        if (back) router.push(back);
        else router.back();
    }, [router, searchParams]);
    const editId = searchParams.get("edit_id") ?? "";
    // เปิดจากใบ PM สถานี "ใบเดียว 4 ส่วน" → ผูกใบนี้เป็นส่วนหนึ่งของใบแม่
    const jobId = searchParams.get("job_id") ?? "";
    const action = searchParams.get("action");

    const PM_PREFIX = "ccbpmreport";

    const BREAKERS = useMemo(() => [
        t("mainBreaker", lang),
        t("subBreaker1", lang),
        t("subBreaker2", lang),
        t("subBreaker3", lang),
        t("subBreaker4", lang),
        t("subBreaker5", lang),
    ], [lang]);

    const initialPhotos: Record<number, PhotoItem[]> = useMemo(() => {
        const result: Record<number, PhotoItem[]> = {};
        QUESTIONS.forEach((q) => {
            if (!q.hasPhoto) return;
            if (q.kind === "simple") {
                result[getPhotoKeyForQuestion(q)] = [];
            } else if (q.kind === "group") {
                q.items.forEach((item) => {
                    const photoKey = getPhotoKeyForQuestion(q, item.key);
                    result[photoKey] = [];
                });
            } else if (q.kind === "mainBreaker") {
                result[90] = [];
            } else if (q.kind === "subBreakers") {
                for (let i = 1; i <= 6; i++) {
                    result[100 + i] = [];
                }
            }
        });
        return result;
    }, []);

    const [photos, setPhotos] = useState<Record<number, PhotoItem[]>>(initialPhotos);
    const photosRef = useRef(photos);
    useEffect(() => { photosRef.current = photos; }, [photos]);
    useEffect(() => () => {
        Object.values(photosRef.current).flat().forEach((p: any) => {
            if (typeof p?.preview === "string" && p.preview.startsWith("blob:")) URL.revokeObjectURL(p.preview);
        });
    }, []);
    const [summary, setSummary] = useState<string>("");
    const [stationId, setStationId] = useState<string | null>(null);

    // ใบใหม่ (เปิดจาก job_id ไม่มี edit_id) ก็ต้องมี draft ของตัวเอง ไม่งั้นรีโหลดแล้วข้อมูล+รูปหายหมด
    const postKey = useMemo(
        () => `${draftKey(stationId)}:${editId ? editId : (jobId ? `job-${jobId}` : "new")}:post`,
        [stationId, editId, jobId],
    );
    // draft ของ key ไหนถูกกู้คืนเสร็จแล้ว — autosave ต้องรอให้กู้เสร็จก่อน ไม่งั้น state ว่างจะเขียนทับ draft
    const [restoredKey, setRestoredKey] = useState<string | null>(null);
    const draftRestored = restoredKey === postKey;
    // กดบันทึกสำเร็จแล้ว ห้าม autosave ที่ค้างอยู่เขียน draft กลับมา
    const draftClearedRef = useRef(false);
    const postKeyRef = useRef(postKey);
    postKeyRef.current = postKey;
    // กันกู้ draft ซ้อนกันระหว่างที่รูปยังโหลดจาก IndexedDB ไม่เสร็จ
    const restoringKeyRef = useRef<string | null>(null);

    useEffect(() => { void prefetchLocation(); }, []);
    useEffect(() => { if (typeof window === "undefined") return; const params = new URLSearchParams(window.location.search); if (params.has("draft_id")) { params.delete("draft_id"); const url = `${window.location.pathname}?${params.toString()}`; window.history.replaceState({}, "", url); } }, []);

    const [summaryCheck, setSummaryCheck] = useState<PF>("");

    // เวลาทำงานจริงของช่าง (datetime-local) — ส่งเข้า Maximo ทาง IN09 ตอนปิดใบงาน



    const [workStart, setWorkStart] = useState<string>("");

    const [workFinish, setWorkFinish] = useState<string>("");

    // planner เปิดเอกสารที่ช่างส่งมาเพื่อตรวจก่อนอนุมัติ (?approve=1)

    const approveMode = searchParams.get("approve") === "1";
    // ช่างเปิดดูใบที่ตัวเองส่งไปแล้ว (?review=1) — เห็นหน้าเดียวกับ planner
    // แต่แก้อะไรไม่ได้ และไม่มีปุ่ม Reject/Approve
    const reviewMode = approveMode || searchParams.get("review") === "1";


    // laborcode ฝั่ง Maximo ที่ช่างเลือกเอง — username ใน iMPS ใช้แทนกันไม่ได้
    const [laborOptions, setLaborOptions] = useState<{ laborcode: string; name: string; needs_name?: boolean }[]>([]);
    const [maximoLabor, setMaximoLabor] = useState<string[]>([]);
    const [maximoContractor, setMaximoContractor] = useState<string>("");

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await apiFetch(`${API_BASE}/cm-maximo/labor-codes`);
                if (!res.ok) return;
                const data = await res.json();
                if (alive && Array.isArray(data?.items)) setLaborOptions(data.items);
            } catch {
                // ดึงไม่ได้ = ไม่โชว์ตัวเลือก ไม่ต้องบล็อกการกรอกใบงาน
            }
        })();
        return () => { alive = false; };
    }, []);

    const toggleMaximoLabor = (code: string) =>
        setMaximoLabor(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);

    // ติ๊กรหัสกลางของผู้รับเหมาไว้ = ต้องมีชื่อจริงกำกับ

    // รหัสที่ช่างเลือกไว้ต้องโชว์ได้เสมอ ถึงรายชื่อจาก Maximo จะโหลดไม่ขึ้น
    // (เน็ตหลุด / สิทธิ์ไม่ถึง) ไม่งั้นหน้าอนุมัติจะกลายเป็นว่าไม่ได้เลือกใครเลย
    const laborList = useMemo(() => {
        const have = new Set(laborOptions.map((o) => o.laborcode));
        const missing = maximoLabor.filter((c) => !have.has(c)).map((c) => ({ laborcode: c, name: c }));
        const all = missing.length ? [...laborOptions, ...missing] : laborOptions;
        // โหมดตรวจไม่ต้องเห็นรายชื่อทั้งกรม เอาเฉพาะคนที่ช่างเลือกลงใบงานนี้
        return reviewMode ? all.filter((o) => maximoLabor.includes(o.laborcode)) : all;
    }, [laborOptions, maximoLabor, reviewMode]);
    const contractorPicked = laborOptions.some((o) => o.needs_name && maximoLabor.includes(o.laborcode));
    const contractorMissing = contractorPicked && !maximoContractor.trim();
    const [inspector, setInspector] = useState<string>("");
    const [postApiLoaded, setPostApiLoaded] = useState(false);

    const [job, setJob] = useState({ issue_id: "", station_name: "", date: getTodayLocalStr() });

    // รูปจากเอกสาร (ใช้ในตารางตอนตรวจอนุมัติ)
    // state รูปปกติของฟอร์มเป็นรูปที่กำลังกรอกอยู่ในเครื่อง จึงต้องเก็บของ document ไว้ต่างหาก
    const [cmpPhotos, setCmpPhotos] = useState<any>({});
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
                initial["r10_sub1"] = { pf: "", remark: "" };
            }
        });
        return initial;
    });

    const mMain = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");

    const [subBreakerCount, setSubBreakerCount] = useState<number>(1);
    const mSub1 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const mSub2 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const mSub3 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const mSub4 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const mSub5 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const mSub6 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const M_SUB_LIST = [mSub1, mSub2, mSub3, mSub4, mSub5, mSub6];

    const addSubBreaker = () => {
        if (subBreakerCount >= 6) return;
        const newCount = subBreakerCount + 1;
        setSubBreakerCount(newCount);
        const newKey = `r10_sub${newCount}`;
        setRows(prev => ({ ...prev, [newKey]: { pf: "", remark: "" } }));
    };

    const removeSubBreaker = (idx: number) => {
        if (subBreakerCount <= 1) return;
        const keyToRemove = `r10_sub${idx}`;
        setRows(prev => {
            const next = { ...prev };
            delete next[keyToRemove];
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
        for (let i = idx - 1; i < subBreakerCount - 1; i++) {
            if (i + 1 < M_SUB_LIST.length) {
                M_SUB_LIST[i].setState(M_SUB_LIST[i + 1].state);
            }
        }
        if (subBreakerCount - 1 < M_SUB_LIST.length) {
            M_SUB_LIST[subBreakerCount - 1].setState(initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        }
        // รูปของตัวที่ลบต้องทิ้งจาก IndexedDB ด้วย และช่องท้ายสุดต้องว่าง
        // ไม่งั้นรูปค้างใน state จะถูกอัปโหลดเข้า g10_N ตอนบันทึกทั้งที่ไม่มีเบรกเกอร์ตัวนั้นแล้ว
        (photos[100 + idx] || []).forEach((p) => {
            if (p.preview?.startsWith("blob:")) URL.revokeObjectURL(p.preview);
            void delPhoto(postKey, p.id);
        });
        setPhotos(prev => {
            const next = { ...prev };
            for (let i = idx; i < subBreakerCount; i++) {
                next[100 + i] = prev[100 + i + 1] || [];
            }
            next[100 + subBreakerCount] = [];
            return next;
        });
        setSubBreakerCount(subBreakerCount - 1);
    };

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

    useEffect(() => { if (postApiLoaded) setPageLoading(false); }, [postApiLoaded]);

    useEffect(() => {
        if (!editId || !stationId) return;
        setPostApiLoaded(false);
        setPhotos(initialPhotos);
        mMain.setState(initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        mSub1.setState(initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        mSub2.setState(initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        mSub3.setState(initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        mSub4.setState(initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        mSub5.setState(initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        mSub6.setState(initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        (async () => {
            try {
                const data = await fetchReport(editId, stationId);
                if (data.job) setJob(prev => ({ ...prev, ...data.job, issue_id: data.issue_id ?? prev.issue_id }));
                if (data.pm_date) setJob(prev => ({ ...prev, date: data.pm_date }));

                // จำนวนเบรกเกอร์ย่อย: ใช้ค่าที่เอกสารบันทึกไว้ ถ้าไม่มีนับจากค่าวัด m10_* แทน
                // (draft ในเครื่องโหลดทีหลังและทับค่านี้ได้ตามเดิม)
                const measuredSubCount = Object.keys(data?.measures ?? {}).filter(k => k.startsWith("m10_")).length;
                if (data.subBreakerCount) setSubBreakerCount(data.subBreakerCount);
                else if (measuredSubCount > 0) setSubBreakerCount(Math.min(6, measuredSubCount));
                if (data.doc_name) setDocName(data.doc_name);
                if (data.inspector) setInspector(data.inspector);
                if (data.summary) setSummary(data.summary);
                setCmpPhotos(data.photos ?? {});
                // สรุปผล/หมายเหตุเดิมอ่านจาก draft ในเครื่องอย่างเดียว คนที่ไม่ได้เป็นคนกรอก
                // (ผู้อนุมัติ) จึงเปิดมาเจอช่องว่าง ต้องดึงจากตัวเอกสารด้วย
                if (reviewMode) {
                    // เวลาทำงาน/laborcode ก็เก็บอยู่ใน draft ของเครื่องช่างเหมือนกัน
                    // ผู้อนุมัติต้องอ่านจากตัวเอกสาร ไม่งั้นเห็นเป็นช่องว่าง
                    if (typeof data.work_start === "string") setWorkStart(data.work_start);
                    if (typeof data.work_finish === "string") setWorkFinish(data.work_finish);
                    if (Array.isArray(data.maximo_labor)) setMaximoLabor(data.maximo_labor);
                    if (typeof data.maximo_contractor === "string") setMaximoContractor(data.maximo_contractor);
                    if (typeof data.summary === "string") setSummary(data.summary);
                    if (data.summaryCheck) setSummaryCheck(data.summaryCheck as PF);
                }
                if (data.rows) {
                    setRows((prev) => {
                        const next = { ...prev };
                        Object.entries(data.rows).forEach(([k, v]) => {
                            next[k] = v as { pf: PF; remark: string };
                        });
                        return next;
                    });
                }
                setPostApiLoaded(true);
            } catch (err) { console.error("load report failed:", err); setPostApiLoaded(true); }
        })();
    }, [editId, stationId]);

    useEffect(() => {
        if (!stationId) return;
        // ใบเดิมต้องรอข้อมูลจาก API ก่อนแล้วค่อยทับด้วย draft / ใบใหม่กู้คืนได้ทันที
        if (editId && !postApiLoaded) return;
        // โหมดตรวจ/อนุมัติเป็นอ่านอย่างเดียว ใช้ข้อมูลจากเอกสาร ไม่กู้ draft และไม่ autosave
        if (reviewMode) return;
        if (restoredKey === postKey || restoringKeyRef.current === postKey) return;
        const keyAtStart = postKey;
        restoringKeyRef.current = keyAtStart;
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
            workStart?: string;
            workFinish?: string;
            maximoLabor?: string[];
            maximoContractor?: string;
            photoRefs?: Record<number, (PhotoRef | { isNA: true })[]>;
        }>(postKey);
        if (!postDraft) { setRestoredKey(keyAtStart); return; }
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
        if (typeof postDraft.workStart === "string") setWorkStart(postDraft.workStart);
        if (typeof postDraft.workFinish === "string") setWorkFinish(postDraft.workFinish);
        if (Array.isArray(postDraft.maximoLabor)) setMaximoLabor(postDraft.maximoLabor);
        if (typeof postDraft.maximoContractor === "string") setMaximoContractor(postDraft.maximoContractor);
        (async () => {
            try {
                if (!postDraft.photoRefs) return;
                const next: Record<number, PhotoItem[]> = { ...initialPhotos };
            for (const [noStr, refs] of Object.entries(postDraft.photoRefs)) {
                const no = Number(noStr); const items: PhotoItem[] = [];
                for (const ref of refs || []) {
                    if ('isNA' in ref && ref.isNA) { items.push({ id: `${no}-NA-restored`, isNA: true, preview: undefined }); continue; }
                    if (!('id' in ref) || !ref.id) continue;
                    const file = await getPhotoByDbKey((ref as PhotoRef).dbKey);
                    if (!file || file.size === 0) {
                        console.warn("Photo missing/empty in IndexedDB:", (ref as PhotoRef).dbKey);
                        reportMissingDraftPhoto(lang);
                        continue;
                    }
                    items.push({ id: ref.id, file, preview: URL.createObjectURL(file), remark: (ref as any).remark ?? "", ref: ref as PhotoRef });
                }
                if (items.length > 0) next[no] = items;
            }
            if (Object.keys(next).some(k => (next[Number(k)]?.length ?? 0) > 0)) setPhotos(prev => ({ ...prev, ...next }));
            } catch (err) {
                console.error("restore draft photos failed:", err);
            } finally {
                // เปิด autosave หลังรูปกู้เสร็จ ไม่งั้น photoRefs ว่างจะเขียนทับ refs ใน draft
                // (ถ้าระหว่างนั้น key เปลี่ยน ก็ไม่ปักธงให้ key เก่า)
                if (restoringKeyRef.current === keyAtStart) restoringKeyRef.current = null;
                if (postKeyRef.current === keyAtStart) setRestoredKey(keyAtStart);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stationId, editId, postKey, postApiLoaded, reviewMode]);

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
        const params = new URLSearchParams(window.location.search);
        const sid = params.get("station_id") || localStorage.getItem("selected_station_id");
        if (sid) setStationId(sid);
        setPageLoading(false);
    }, []);

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

    const REQUIRED_PHOTO_KEYS_POST = useMemo(() => {
        const keys: number[] = [];
        QUESTIONS.filter((q) => q.hasPhoto).forEach((q) => {
            if (q.kind === "simple") {
                keys.push(getPhotoKeyForQuestion(q));
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

    const missingPhotoItemsPost = useMemo(() => REQUIRED_PHOTO_KEYS_POST.filter((key) => {
        let rowKey: string | null = null;
        if (key === 1001) { rowKey = "pre_r1"; }
        else if (key === 1002) { rowKey = "pre_r2"; }
        else if (key === 90) { rowKey = "r9_main"; }
        else if (key >= 101 && key <= 106) { rowKey = `r10_sub${key - 100}`; }
        else if (key >= 1031 && key <= 1034) { rowKey = `r103_${key - 1030}`; }
        else if (key >= 30 && key < 90) { const qNo = Math.floor(key / 10); const subNo = key % 10; rowKey = `r${qNo}_${subNo}`; }
        else { rowKey = `r${key}`; }
        if (rowKey && rows[rowKey]?.pf === "NA") return false;
        return (photos[key]?.length ?? 0) < 1;
    }), [REQUIRED_PHOTO_KEYS_POST, photos, rows]);

    const allPhotosAttachedPost = missingPhotoItemsPost.length === 0;

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

    // ข้อ 1-2 (pre_r1/pre_r2) ไม่มีปุ่มระดับผล — ไม่ต้องบังคับเลือก
    const PF_KEYS_POST = useMemo(() => QUESTIONS.filter((q) => !q.key.startsWith("pre_"))
        .flatMap((q) => getRowKeysForQuestion(q, subBreakerCount)), [subBreakerCount]);

    const allPFAnsweredPost = useMemo(() => PF_KEYS_POST.every((k) => rows[k]?.pf !== ""), [rows, PF_KEYS_POST]);
    const missingPFItemsPost = useMemo(() => PF_KEYS_POST.filter((k) => !rows[k]?.pf).map((k) => {
        return getDisplayedRowNo(k);
    }), [rows, PF_KEYS_POST]);

    const missingInputsDetailed = useMemo(() => {
        return findMissingCcbMeasurementInputs({
            rows,
            mainMeasurements: mMain.state,
            subMeasurements: [mSub1.state, mSub2.state, mSub3.state, mSub4.state, mSub5.state, mSub6.state],
            subBreakerCount,
        });
    }, [mMain.state, mSub1.state, mSub2.state, mSub3.state, mSub4.state, mSub5.state, mSub6.state, rows, subBreakerCount]);

    const allRequiredInputsFilled = missingInputsDetailed.length === 0;
    const isSummaryFilled = summary.trim().length > 0;
    const isSummaryCheckFilled = summaryCheck !== "";

    const canFinalSave = allPhotosAttachedPost && allPFAnsweredPost && allRequiredInputsFilled && isSummaryFilled && isSummaryCheckFilled;

    const photoRefs = useMemo(() => {
        const out: Record<number, (PhotoRef | { isNA: true })[]> = {};
        Object.entries(photos).forEach(([noStr, list]) => {
            const no = Number(noStr);
            out[no] = (list || [])
                .map(p => {
                    if (p.isNA) return { isNA: true } as const;
                    if (!p.ref) return null;
                    return { ...p.ref, uploaded: (p as any).uploaded === true };
                })
                .filter(Boolean) as (PhotoRef | { isNA: true })[];
        });
        return out;
    }, [photos]);

    useDebouncedEffect(() => {
        // ใบใหม่/ใบเดิม autosave เหมือนกัน แต่ต้องรอกู้ draft เสร็จก่อน (draftRestored)
        // ซึ่งใบเดิมจะเกิดหลัง postApiLoaded อยู่แล้ว / โหมดตรวจ-อนุมัติไม่บันทึก
        if (!stationId || reviewMode || !draftRestored || draftClearedRef.current) return;
        if (postKeyRef.current !== postKey) return;
        saveDraftLocal(postKey, {
            // merge ของเดิม เพื่อไม่ให้ pendingReportId หาย
            ...(loadDraftLocal<any>(postKey) ?? {}),
            rows, mMain: mMain.state, mSub1: mSub1.state, mSub2: mSub2.state, mSub3: mSub3.state,
            mSub4: mSub4.state, mSub5: mSub5.state, mSub6: mSub6.state,
            subBreakerCount, summary, summaryCheck, photoRefs,
            workStart, workFinish, maximoLabor, maximoContractor,
        });
    }, [postKey, stationId, rows, mMain.state, mSub1.state, mSub2.state, mSub3.state, mSub4.state, mSub5.state, mSub6.state, subBreakerCount, summary, summaryCheck, photoRefs, workStart, workFinish, maximoLabor, maximoContractor, reviewMode, draftRestored]);

    // รับ PhotoItem แทน File[] เพื่อให้รู้ว่ารูปไหนอัปสำเร็จแล้ว — ตอนกดบันทึกซ้ำหลังอัปหลุด
    // จะได้ข้ามรูปเดิม ไม่อัปซ้ำจนรูปโผล่ซ้ำในรายงาน (และไม่ไปชนเพดาน 10 รูป/ข้อ)
    /** key ที่ backend ใช้เก็บใน photos — ต้องใช้สูตรเดียวกันทั้งตอน upload และตอน verify */
    const toGroupKey = (stateKey: string | number) => {
        const no = Number(stateKey);
        if (no === 1001 || no === 1002) return `g${no}`;
        if (no === 90) return "g9";
        if (no >= 101 && no <= 106) return `g10_${no - 100}`;
        if (no >= 1031 && no <= 1034) return `g103_${no - 1030}`;
        if (no >= 30 && no < 90) return `g${Math.floor(no / 10)}_${no % 10}`;
        return `g${no}`;
    };

    async function uploadGroupPhotos(reportId: string, stationId: string, group: string, items: PhotoItem[], stateKey: string, uploadedIds: Set<string>) {
        // uploadedIds จำเป็นเพราะ setPhotos() ยังไม่ flush เข้า photosRef ภายใน tick เดียวกัน
        const pending = (items || []).filter(p => !p.isNA && !p.uploaded && !uploadedIds.has(p.id) && (p.file || p.ref));
        if (pending.length === 0) return;
        const token = localStorage.getItem("access_token");
        const url = `${API_BASE}/${PM_PREFIX}/${reportId}/post/photos`;
        // ส่งทีละรูป (1 request/รูป) เพื่อไม่ให้ body รวมเกิน limit ของ nginx (กัน 413 เมื่อข้อหนึ่งมีหลายรูป)
        for (const p of pending) {
            const compressed = await compressImage(await resolveUploadFile(p));
            const form = new FormData();
            form.append("station_id", stationId);
            form.append("group", group);
            form.append("side", "post");
            form.append("files", compressed);
            const res = await fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form, credentials: "include" });
            if (!res.ok) throw new Error(await res.text());
            uploadedIds.add(p.id);
            setPhotos(prev => ({ ...prev, [stateKey]: ((prev as any)[stateKey] || []).map((x: PhotoItem) => x.id === p.id ? { ...x, uploaded: true } : x) }));
        }
    }

    /** อัปโหลดหลายรอบ + ยืนยันจำนวนกับ server ก่อนให้ caller ไปลบรูปในเครื่อง
     *  คืน true = ปลอดภัยที่จะลบ, false = ยังไม่ครบ (แจ้ง user แล้ว) ห้ามลบ */
    async function syncPhotosAndVerify(reportId: string): Promise<boolean> {
        const sid = stationId;
        if (!sid) throw new Error(t("alertNoStation", lang));
        const uploadedIds = new Set<string>();
        for (let pass = 1; pass <= 3; pass++) {
            if (unrecoverablePhotos(photosRef.current as any, uploadedIds).length > 0) {
                throw new Error(unrecoverableMessage(lang));
            }
            const pending = collectPending(photosRef.current as any, uploadedIds);
            if (pending.length === 0) break;
            setUploadState({ show: true, total: pending.length, completed: 0, failed: 0 });
            try {
                // อัปไม่ผ่าน → throw ทะลุขึ้นไป catch ของ handler โดยยังไม่ได้ลบอะไร
                await Promise.all(
                    Object.entries(photosRef.current).map(([noStr, list]) =>
                        uploadGroupPhotos(reportId, sid, toGroupKey(noStr), list || [], noStr, uploadedIds))
                );
            } finally {
                setUploadState({ show: false, total: 0, completed: 0, failed: 0 });
            }
        }

        const stillPending = collectPending(photosRef.current as any, uploadedIds);
        if (stillPending.length > 0) {
            alert(pendingMessage(stillPending.length, lang));
            return false;
        }

        const expected = expectedCountByGroup(photosRef.current as any, toGroupKey);
        if (Object.keys(expected).length === 0) return true;

        const token = localStorage.getItem("access_token");
        const res = await fetch(`${API_BASE}/${PM_PREFIX}/get?station_id=${encodeURIComponent(sid)}&report_id=${reportId}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
        const doc = await res.json() as { photos?: Record<string, unknown[]> };
        const shortfall = findShortfall(expected, doc?.photos);
        if (shortfall.length > 0) {
            console.error("[CCB post verify] shortfall:", shortfall);
            alert(shortfallMessage(shortfall, lang));
            return false;
        }
        return true;
    }

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
            setTimeout(() => { element.classList.remove("tw-ring-2", "tw-ring-red-400", "tw-bg-red-50"); }, 3000);
        }
    };

    const getFirstMissingInputScrollId = (): string | null => {
        if (missingInputsDetailed.length === 0) return null;
        const { qNo, subNo } = missingInputsDetailed[0];
        return subNo ? `${ID_PREFIX}-input-${qNo}-${subNo}` : `${ID_PREFIX}-question-${qNo}`;
    };

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

    const onFinalSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }
        if (!allPhotosAttachedPost) {
            alert(t("alertFillPhoto", lang));
            const scrollId = getFirstMissingPhotoPostScrollId();
            if (scrollId) scrollToFirstError(scrollId);
            return;
        }
        if (!allPFAnsweredPost) {
            alert(lang === "th" ? "กรุณาเลือกระดับผลการตรวจหรือ N/A ทุกข้อ" : "Please select an inspection rating or N/A for all items");
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
        if (!isSummaryFilled) { alert(t("missingSummaryText", lang)); scrollToFirstError(`${ID_PREFIX}-summary-section`); return; }
        if (!isSummaryCheckFilled) { alert(t("missingSummaryStatus", lang)); scrollToFirstError(`${ID_PREFIX}-summary-section`); return; }

        if (submitting) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("access_token");
            // ฟอร์มนี้เหลือแค่ Post-PM แล้ว (ไม่มีด่าน Pre ที่เคยสร้าง report_id ให้)
            // ใบใหม่ให้ backend สร้างรายงานตอนกดบันทึก — ถ้าเคยกดแล้วอัปรูปหลุด ใช้ id เดิมจาก draft กันได้รายงานซ้ำ
            let finalReportId: string = reportId || editId || loadDraftLocal<any>(postKey)?.pendingReportId || "";
            const toNum = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : null; };
            const normalizeMeasure = (state: typeof mMain.state) =>
                Object.fromEntries(Object.entries(state).map(([k, v]) => [k, { value: toNum(v.value), unit: v.unit }]));

            const measures: Record<string, any> = {};
            measures["m9"] = normalizeMeasure(mMain.state);
            for (let i = 0; i < subBreakerCount; i++) {
                measures[`m10_${i + 1}`] = normalizeMeasure(M_SUB_LIST[i].state);
            }

            const flatRows = flattenRows(rows, subBreakerCount);
            const payload = {
                station_id: stationId, ...(jobId ? { job_id: jobId } : {}), inspector, job: { station_name: job.station_name, date: job.date }, ...(job.date ? { pm_date: job.date } : {}), rows: flatRows, measures, summary,
                ...(summaryCheck ? { summaryCheck } : {}),
                work_start: workStart, work_finish: workFinish, maximo_labor: maximoLabor, maximo_contractor: contractorPicked ? maximoContractor.trim() : "", wonum: searchParams.get("wonum") ?? "", side: "post", ...(finalReportId ? { report_id: finalReportId } : {}), subBreakerCount,
            };

            const res = await fetch(`${API_BASE}/${PM_PREFIX}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const { report_id } = await res.json() as { report_id: string };
            if (!finalReportId) {
                finalReportId = report_id;
                setReportId(report_id);
                saveDraftLocal(postKey, { ...loadDraftLocal<any>(postKey), pendingReportId: report_id });
            }

            // ต้องยืนยันรูปครบก่อน ถึงจะ finalize + ลบรูปในเครื่อง
            if (!(await syncPhotosAndVerify(finalReportId))) return;

            if (!workStart || !workFinish) { alert(t("alertWorkTime", lang)); setSubmitting(false); return; }
            if (contractorMissing) { alert(t("contractorRequired", lang)); setSubmitting(false); return; }
            if (workFinish < workStart) { alert(t("alertWorkTimeOrder", lang)); setSubmitting(false); return; }
            // Maximo ตีกลับ IN09 ด้วย BMXAA2641E ถ้าเวลาทำงานยังมาไม่ถึง
            // ปล่อยผ่านตรงนี้ = ปิดใบงานได้แต่ปิด WO ในระบบเขาไม่ได้ ต้องมาแก้ย้อนหลัง
            const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                .toISOString().slice(0, 16);
            if (workStart > nowLocal || workFinish > nowLocal) { alert(t("alertWorkTimeFuture", lang)); setSubmitting(false); return; }

            const finalizeRes = await fetch(`${API_BASE}/${PM_PREFIX}/${finalReportId}/finalize`, {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                credentials: "include",
                body: new URLSearchParams({ station_id: stationId }),
            });
            if (!finalizeRes.ok) throw new Error(await finalizeRes.text());

            const allPhotos = Object.values(photosRef.current).flat();
            draftClearedRef.current = true;
            await Promise.all(allPhotos.map(p => delPhoto(postKey, p.id)));
            await clearDraftLocal(postKey);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&tab=ccb`);
        } catch (err: any) { alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`); } finally { setSubmitting(false); }
    };

    const renderQuestionBlock = (q: Question) => {
        const qTooltip = q.tooltipKey ? t(q.tooltipKey, lang) : undefined;

        return (
            <SectionCard key={q.key} title={getQuestionLabel(q, lang)} tooltip={qTooltip}>
                {q.kind === "simple" && (
                    <div className="tw-py-2">
                        <PassFailRow label={t("testResult", lang)} value={rows[q.key]?.pf ?? ""}
                            onChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })}
                            remark={rows[q.key]?.remark || ""} onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })}
                            lang={lang} showPfButtons={!q.key.startsWith("pre_")} id={getPfIdFromKey(q.key)} remarkId={getRemarkIdFromKey(q.key)}
                            aboveRemark={
                                q.hasPhoto && (
                                    <div className="tw-pb-4 tw-border-b tw-mb-4 tw-border-gray-100">
                                        <PhotoMultiInput photos={photos[getPhotoKeyForQuestion(q)] || []} setPhotos={makePhotoSetter(getPhotoKeyForQuestion(q))}
                                            max={10} draftKey={postKey} qNo={getPhotoKeyForQuestion(q)} lang={lang} id={getPhotoIdFromKey(getPhotoKeyForQuestion(q))} />
                                    </div>
                                )
                            } />
                    </div>
                )}

                {q.kind === "group" && (() => {
                    // ── shared pool: ทุก sub-item ในกลุ่มนี้รวมกันได้ไม่เกิน 20 รูป ──
                    const totalGroupPhotos = q.items.reduce((sum, it) => {
                        const pk = getPhotoKeyForQuestion(q, it.key);
                        return sum + (photos[pk]?.length ?? 0);
                    }, 0);
                    const groupRemaining = Math.max(0, 20 - totalGroupPhotos);   // 20 = PHOTO_MAX_PER_ROW ของ pdf_ccb.py

                    return (
                        <>
                            <Typography variant="small" className="!tw-text-blue-gray-500">
                            {lang === "th" ? `รูปในข้อนี้ ${totalGroupPhotos}/20 — ข้อย่อยละไม่เกิน 5 รูป` : `${totalGroupPhotos}/20 photos in this question — max 5 per sub-item`}
                            </Typography>
                            <div className="tw-divide-y tw-divide-gray-200">
                                {q.items.map((item, idx) => {
                                    const subLabel = `${getDisplayedQuestionNo(q.no)}.${idx + 1}) ${t(item.labelKey, lang)}`;
                                    const photoKey = getPhotoKeyForQuestion(q, item.key);
                                    const itemMax = Math.min(10, (photos[photoKey]?.length ?? 0) + groupRemaining);
                                    return (
                                        <div key={item.key} className="tw-py-4 first:tw-pt-2">
                                            <PassFailRow label={subLabel} value={rows[item.key]?.pf ?? ""}
                                                onChange={(v) => setRows({ ...rows, [item.key]: { ...rows[item.key], pf: v } })}
                                                remark={rows[item.key]?.remark || ""} onRemarkChange={(v) => setRows({ ...rows, [item.key]: { ...rows[item.key], remark: v } })}
                                                lang={lang} id={getPfIdFromKey(item.key)} remarkId={getRemarkIdFromKey(item.key)}
                                                aboveRemark={
                                                    q.hasPhoto && (
                                                        <div className="tw-pb-4 tw-border-b tw-border-gray-100">
                                                            <PhotoMultiInput photos={photos[photoKey] || []} setPhotos={makePhotoSetter(photoKey)}
                                                                max={itemMax} maxLabel={subItemQuotaLabel(photos[photoKey]?.length ?? 0, totalGroupPhotos, 10, 20, lang)} draftKey={postKey} qNo={photoKey} lang={lang} id={getPhotoIdFromKey(photoKey)} />
                                                        </div>
                                                    )
                                                } />
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    );
                })()}

                {q.kind === "mainBreaker" && (
                    (() => {
                        const rowKey = "r9_main";
                        return (
                            <div className="tw-py-4 first:tw-pt-2">
                                <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800 tw-mb-3">{`9.1) ${t("mainBreaker", lang)}`}</Typography>
                                <PassFailRow label={t("testResult", lang)} value={rows[rowKey]?.pf ?? ""}
                                    onChange={(v) => setRows({ ...rows, [rowKey]: { ...rows[rowKey], pf: v } })}
                                    remark={rows[rowKey]?.remark || ""} onRemarkChange={(v) => setRows({ ...rows, [rowKey]: { ...rows[rowKey], remark: v } })}
                                    lang={lang} id={getPfIdFromKey(rowKey)} remarkId={getRemarkIdFromKey(rowKey)}
                                    aboveRemark={q.hasPhoto ? <div className="tw-pb-4 tw-border-b tw-border-gray-100"><PhotoMultiInput photos={photos[90] || []} setPhotos={makePhotoSetter(90)} max={10} draftKey={postKey} qNo={90} lang={lang} id={getPhotoIdFromKey(90)} /></div> : undefined}
                                    beforeRemark={
                                        <div id={getInputIdFromKey(rowKey)} className="tw-mb-3 tw-transition-all tw-duration-300">
                                            <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-3">
                                                {VOLTAGE_FIELDS_CCB.map((k) => (
                                                    <InputWithUnit<UnitVoltage> key={`post-main-${k}`} label={LABELS[k]}
                                                        value={mMain.state[k]?.value || ""} unit={(mMain.state[k]?.unit as UnitVoltage) || "V"} units={["V"] as const}
                                                        onValueChange={(v) => mMain.patch(k, { value: v })} onUnitChange={(u) => mMain.syncUnits(u)} />
                                                ))}
                                            </div>
                                        </div>
                                    } />
                            </div>
                        );
                    })()
                )}

                {q.kind === "subBreakers" && (() => {
                    // ── shared pool: ทุก sub breaker ในข้อ 10 รวมกันได้ไม่เกิน 20 รูป ──
                    const totalSubPhotos = Array.from({ length: subBreakerCount }, (_, i) =>
                        photos[101 + i]?.length ?? 0
                    ).reduce((a, b) => a + b, 0);
                    const subRemaining = Math.max(0, 20 - totalSubPhotos);   // 20 = PHOTO_MAX_PER_ROW ของ pdf_ccb.py

                    return (
                        <div className="tw-space-y-0">
                            <div className="tw-flex tw-items-center tw-justify-between tw-pb-3 tw-border-b tw-border-gray-200">
                                <div className="tw-flex tw-items-center tw-gap-2">
                                    <Typography variant="small" className="tw-text-blue-gray-600">{t("subBreakerCount", lang)}</Typography>
                                    <Typography variant="small" className="tw-font-bold tw-text-blue-600">{subBreakerCount} {t("unit", lang)}</Typography>
                                </div>
                                {subBreakerCount < 6 && (
                                    <Button type="button" size="sm" color="gray" variant="outlined" onClick={addSubBreaker} className="tw-flex tw-items-center tw-gap-1">
                                        <span className="tw-text-lg tw-leading-none">+</span>
                                        <span className="tw-text-xs">{t("addSubBreaker", lang)}</span>
                                    </Button>
                                )}
                            </div>
                            <Typography variant="small" className="!tw-text-blue-gray-500">
                                {lang === "th" ? `รูปในข้อนี้ ${totalSubPhotos}/20 — ข้อย่อยละไม่เกิน 5 รูป` : `${totalSubPhotos}/20 photos in this question — max 5 per sub-item`}
                            </Typography>
                            <div className="tw-divide-y tw-divide-gray-200">
                                {Array.from({ length: subBreakerCount }, (_, idx) => {
                                    const i = idx + 1;
                                    const photoKey = 100 + i;
                                    const rowKey = `r10_sub${i}`;
                                    const m = M_SUB_LIST[idx];
                                    const breakerLabel = `10.${i}) ${lang === "th" ? "เบรกเกอร์วงจรย่อยตัวที่" : "Sub-circuit Breaker"} ${i}`;
                                    const itemMax = Math.min(10, (photos[photoKey]?.length ?? 0) + subRemaining);

                                    return (
                                        <div key={rowKey} className="tw-py-4 first:tw-pt-2">
                                            <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                                <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{breakerLabel}</Typography>
                                                {subBreakerCount > 1 && (
                                                    <button type="button" onClick={() => removeSubBreaker(i)}
                                                        className="tw-h-6 tw-w-6 tw-flex tw-items-center tw-justify-center tw-rounded tw-bg-red-50 tw-text-red-600 hover:tw-bg-red-100 hover:tw-text-red-700 tw-transition-all tw-duration-200"
                                                        aria-label={t("removeItem", lang)}>
                                                        <svg className="tw-w-3.5 tw-h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                            <PassFailRow label={t("testResult", lang)} value={rows[rowKey]?.pf ?? ""}
                                                onChange={(v) => setRows({ ...rows, [rowKey]: { ...rows[rowKey], pf: v } })}
                                                remark={rows[rowKey]?.remark || ""} onRemarkChange={(v) => setRows({ ...rows, [rowKey]: { ...rows[rowKey], remark: v } })}
                                                lang={lang} id={getPfIdFromKey(rowKey)} remarkId={getRemarkIdFromKey(rowKey)}
                                                aboveRemark={q.hasPhoto ? <div className="tw-pb-4 tw-border-b tw-border-gray-100"><PhotoMultiInput photos={photos[photoKey] || []} setPhotos={makePhotoSetter(photoKey)} max={itemMax} maxLabel={subItemQuotaLabel(photos[photoKey]?.length ?? 0, totalSubPhotos, 10, 20, lang)} draftKey={postKey} qNo={photoKey} lang={lang} id={getPhotoIdFromKey(photoKey)} /></div> : undefined}
                                                beforeRemark={
                                                    <div id={getInputIdFromKey(rowKey)} className="tw-mb-3 tw-transition-all tw-duration-300">
                                                        <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-3">
                                                            {VOLTAGE_FIELDS_CCB.map((k) => (
                                                                <InputWithUnit<UnitVoltage> key={`post-sub${i}-${k}`} label={LABELS[k]}
                                                                    value={m.state[k]?.value || ""} unit={(m.state[k]?.unit as UnitVoltage) || "V"} units={["V"] as const}
                                                                    onValueChange={(v) => m.patch(k, { value: v })} onUnitChange={(u) => m.syncUnits(u)} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                } />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    );
                })()}
            </SectionCard>
        );
    };

    const formatMissingPhotoItems = (items: number[]): string => {
        return items.map(no => {
            if (no === 1001) return "1";
            if (no === 1002) return "2";
            if (no === 90) return String(9 + DISPLAY_SHIFT);
            if (no >= 101 && no <= 106) return `${10 + DISPLAY_SHIFT}.${no - 100}`;
            if (no >= 1031 && no <= 1034) return `3.${no - 1030}`;
            if (no >= 30 && no < 90) return `${Math.floor(no / 10) + DISPLAY_SHIFT}.${no % 10}`;
            return String(no + DISPLAY_SHIFT);
        }).join(", ");
    };

    const missingPhotoItemsFormatted = useMemo(() => {
        return missingPhotoItemsPost.map(no => {
            if (no === 1001) return "1";
            if (no === 1002) return "2";
            if (no === 90) return String(9 + DISPLAY_SHIFT);
            if (no >= 101 && no <= 106) return `${10 + DISPLAY_SHIFT}.${no - 100}`;
            if (no >= 1031 && no <= 1034) return `3.${no - 1030}`;
            if (no >= 30 && no < 90) return `${Math.floor(no / 10) + DISPLAY_SHIFT}.${no % 10}`;
            return String(no + DISPLAY_SHIFT);
        });
    }, [missingPhotoItemsPost]);


    // ── ตารางผลตรวจ (โหมดตรวจอนุมัติ) ──
    // ใช้ state ที่โหลดเอกสารมาแล้ว: rows = คำตอบของช่าง
    // คีย์ที่ไม่ได้อยู่ใน QUESTIONS (ข้อย่อยแบบ r5_1) เอามาต่อท้ายด้วย จะได้ไม่ตกหล่น
    // คีย์รูปของ ccb ผ่าน getPhotoKeyForQuestion → toGroupKey:
    // ข้อย่อย r3_1 → 31 → g3_1 · r10_sub2 → 102 → g10_2 · เมนเบรกเกอร์ r9 → 90 → g9
    const photoKeysOf = useCallback((row: { key: string }) => {
        const sub = row.key.match(/^r(\d+)_sub(\d+)$/);
        if (sub) return [`g${sub[1]}_${sub[2]}`];
        const m = row.key.match(/^r(\d+)_(\d+)$/);
        if (m) return [`g${m[1]}_${m[2]}`];
        return [`g${row.key.replace(/^r/, "")}`];
    }, []);

    const compareRows = useMemo(() => {
        // ป้ายหัวข้อต้องตรงกับที่ช่างเห็นตอนกรอก — ข้อย่อยอย่าง r3_1 ฟอร์มสร้างขึ้นมาเอง
        // ตอนรันไทม์ (ตามจำนวนหัวชาร์จ/ช่องของสถานีนั้น) ไม่ได้อยู่ใน QUESTIONS
        // ถ้าไม่ไล่เก็บจากแหล่งเดียวกับที่ฟอร์มใช้ ตารางจะโชว์เป็นคีย์ดิบ
        const textOf = (l: any): string =>
            typeof l === "string" ? l
                : l && typeof l === "object" ? (l[lang] ?? l.th ?? l.en ?? "") : "";
        const labels = new Map<string, string>();
        const put = (k: any, v: any) => {
            const text = textOf(v);
            if (typeof k === "string" && text.trim() && !labels.has(k)) labels.set(k, text.trim());
        };
        const labelOfItem = (it: any) => {
            const label = it?.label !== undefined ? it.label : it?.labelKey ? (t as any)(it.labelKey, lang) : "";
            return typeof label === "string" ? getDisplayedItemLabel(label) : label;
        };
        (QUESTIONS as any[]).forEach((q: any) => {
            put(q?.key, labelOfItem(q));
            (q?.items ?? []).forEach((it: any) => put(it?.key, labelOfItem(it)));
        });
        ([] as any[]).forEach((arr: any) =>
            (arr ?? []).forEach((it: any) => put(it?.key, labelOfItem(it))));
        const labelOf = (key: string) => labels.get(key) ?? key;
        // เรียงตามลำดับข้อในฟอร์มกรอก ข้อย่อยที่ช่างเพิ่มเอง (r5_1, r5_2)
        // ต้องต่อท้ายข้อแม่ของมัน ไม่ใช่ไปกองรวมกันท้ายตาราง
        const answered = Object.keys(rows ?? {});
        const subNo = (k: string) => Number(k.split("_")[1] ?? 0) || 0;
        const mk = (k: string, section: string, label: string, qNo?: number) => ({
            key: k,
            section,
            qNo,
            label,
            postPf: (rows as any)?.[k]?.pf,
            postRemark: (rows as any)?.[k]?.remark,
        });
        // วางโครงเดียวกับฟอร์มกรอก: หัวข้อใหญ่เป็นแถบคั่น แล้วข้อย่อยเรียงอยู่ใต้มัน
        // ข้อธรรมดาที่ไม่มีข้อย่อย ตัวมันเองคือเนื้อในของแถบ ช่องหัวข้อจึงเว้นว่าง
        const out: ReturnType<typeof mk>[] = [];
        (QUESTIONS as any[]).forEach((q: any) => {
            if (!q?.key) return;
            const section = labelOf(q.key);
            // เลขข้อ — ใช้รวมรูปของทั้งข้อในตารางเทียบ แบบเดียวกับที่ PDF ทำ
            const qNo: number | undefined = typeof q?.no === "number" ? getDisplayedQuestionNo(q.no)
                : Number(String(q?.key ?? "").replace(/^r/, "")) || undefined;
            out.push(mk(q.key, section, "", qNo));
            answered
                .filter((k) => k !== q.key && k.split("_")[0] === q.key)
                .sort((a, b) => subNo(a) - subNo(b))
                .forEach((k) => out.push(mk(k, section, labelOf(k), qNo)));
        });
        answered.forEach((k) => {
            if (out.some((r) => r.key === k)) return;
            const rawNo = Number(k.replace(/^r/, "").split("_")[0]) || undefined;
            out.push(mk(k, "", labelOf(k), rawNo ? getDisplayedQuestionNo(rawNo) : undefined));
        });
        return out;
    }, [rows, lang]);


    // กล่องหมายเหตุ + สรุปผลการตรวจสอบ — ประกาศครั้งเดียว วางได้สองที่
    // ตอนกรอกอยู่ในฟอร์มตามเดิม ตอนตรวจย้ายลงไปล่างสุดใต้ตารางเทียบ
    const summaryBlock = (
                        <div id={`${ID_PREFIX}-summary-section`} className="tw-mt-6 sm:tw-mt-8 tw-space-y-3 tw-transition-all tw-duration-300">
                            <Typography variant="h6" className="tw-mb-1 tw-text-sm sm:tw-text-base">{t("comment", lang)}</Typography>
                            <Textarea label={t("comment", lang)} value={summary} onChange={(e) => setSummary(e.target.value)}
                                rows={3} required autoComplete="off"
                                containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-text-sm resize-none" />
                            <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-200">
                                <PassFailRow label={t("summaryResult", lang)} value={summaryCheck} onChange={(v) => setSummaryCheck(v)}
                                    lang={lang} labels={{ PASS: t("summaryPassLabel", lang), FAIL: t("summaryFailLabel", lang), NA: t("summaryNALabel", lang) }} />
                            </div>
                        </div>
    );

    return (
        <section className="tw-pb-24">
            <LoadingOverlay show={pageLoading} text={t("loading", lang)} />
            <LoadingOverlay
                show={uploadState.show}
                text={lang === "th"
                    ? `กำลังอัปโหลดรูป Post-PM... ${uploadState.completed}/${uploadState.total} รูป`
                    : `Uploading Post-PM photos... ${uploadState.completed}/${uploadState.total}`}
            />
            <div className="tw-mx-auto tw-max-w-6xl tw-flex tw-items-center tw-justify-between tw-mb-4">
                <Button variant="outlined" size="sm" onClick={goBackToList} title={t("backToList", lang)}>
                    <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
                </Button>
            </div>

            
            <form action="#" noValidate onSubmit={(e) => { e.preventDefault(); return false; }} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
                {/* ดูอย่างเดียว: fieldset ปิดทั้งช่องกรอกและปุ่มบันทึกในทีเดียว */}
                <fieldset disabled={reviewMode} className="pm-readonly tw-m-0 tw-min-w-0 tw-border-0 tw-p-0">
                <div className="tw-mx-auto tw-max-w-6xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-sm tw-p-6 md:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0">
                    <div className="tw-flex tw-flex-col tw-gap-4 md:tw-flex-row md:tw-items-start md:tw-justify-between md:tw-gap-6">
                        <div className="tw-flex tw-items-start tw-gap-3 md:tw-gap-4">
                            <div className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md tw-shrink-0 tw-h-14 tw-w-[64px] sm:tw-h-16 sm:tw-w-[76px] md:tw-h-20 md:tw-w-[108px] lg:tw-h-24 lg:tw-w-[152px]">
                                <Image src={LOGO_SRC} alt={t("logoAlt", lang)} fill priority className="tw-object-contain tw-p-0" sizes="(min-width:1024px) 152px, (min-width:768px) 108px, (min-width:640px) 76px, 64px" />
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
                        {/* โหมดตรวจ: ตัดเฉพาะรายการข้อที่ช่างกรอก ดูจากตารางเทียบก่อน/หลังด้านล่างแทน
                            ส่วนหัวเอกสารกับข้อมูลสถานีคงไว้ ผู้อนุมัติต้องรู้ว่ากำลังดูใบไหน */}
                        {!reviewMode && QUESTIONS.map((q) => renderQuestionBlock(q))}
                    </div>

                    {/* โหมดตรวจ: ย้ายไปไว้ล่างสุด ให้อ่านหลังดูตารางเทียบเสร็จ */}
                    {!reviewMode && summaryBlock}

                    <div className="tw-mt-6 sm:tw-mt-8 tw-flex tw-flex-col tw-gap-3">
                    {/* เวลาทำงานจริงของช่าง — ต้องกรอกก่อนส่งปิดใบงาน (ส่งเข้า Maximo IN09) */}
                    {(
                        <div className="tw-mt-6 tw-pt-4 tw-border-t tw-border-gray-200">
                            <div className="tw-mb-2">
                                <Typography variant="h6" className="tw-text-sm sm:tw-text-base">
                                    {t("workTime", lang)} <span className="tw-text-red-500">*</span>
                                </Typography>
                                <Typography variant="small" className="tw-text-xs tw-font-normal tw-text-blue-gray-400">
                                    {t("workTimeHint", lang)}
                                </Typography>
                            </div>
                            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-3">
                                <div>
                                    <label className="tw-mb-1.5 tw-block tw-text-xs tw-font-semibold tw-text-blue-gray-700">{t("workStart", lang)}</label>
                                    <input type="datetime-local" value={workStart} disabled={reviewMode} onChange={(e) => setWorkStart(e.target.value)}
                                        className="tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none focus:tw-border-blue-500" />
                                </div>
                                <div>
                                    <label className="tw-mb-1.5 tw-block tw-text-xs tw-font-semibold tw-text-blue-gray-700">{t("workFinish", lang)}</label>
                                    {/* min กัน picker เลือกย้อนหลัง — ยังต้อง validate เพราะพิมพ์มือเลี่ยงได้ */}
                                    <input type="datetime-local" value={workFinish} disabled={reviewMode} min={workStart || undefined} onChange={(e) => setWorkFinish(e.target.value)}
                                        className={`tw-w-full tw-rounded-lg tw-border tw-bg-white tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none ${workStart && workFinish && workFinish < workStart ? "tw-border-red-400 focus:tw-border-red-500" : "tw-border-blue-gray-200 focus:tw-border-blue-500"}`} />
                                    {workStart && workFinish && workFinish < workStart && (
                                        <p className="tw-mt-1.5 tw-text-xs tw-text-red-600">{t("alertWorkTimeOrder", lang)}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ช่างที่จะลงเวลาเข้า Maximo — laborcode คนละชุดกับ username ใน iMPS
                        จึงต้องให้เลือกเอง ไม่งั้น IN09 จะ unmapped ทั้งใบ (อยู่ล่างสุดของฟอร์ม) */}
                    <div className="tw-mt-6 tw-pt-4 tw-border-t tw-border-gray-200">
                        <div className="tw-mb-2">
                            <Typography variant="h6" className="tw-text-sm sm:tw-text-base">{t("maximoLabor", lang)}</Typography>
                            <Typography variant="small" className="tw-text-xs tw-font-normal tw-text-blue-gray-400">
                                {t("maximoLaborHint", lang)}
                            </Typography>
                        </div>
                        {laborList.length === 0 ? (
                            <p className="tw-text-xs tw-text-orange-600">
                                            {reviewMode ? t("maximoLaborNone", lang) : t("maximoLaborEmpty", lang)}
                                        </p>
                        ) : (
                            <div className="tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-divide-y tw-divide-blue-gray-50 tw-max-h-56 tw-overflow-y-auto">
                                {laborList.map((o) => (
                                    <label key={o.laborcode} className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-cursor-pointer hover:tw-bg-blue-gray-50/60 tw-transition-colors">
                                        {!reviewMode && (<input type="checkbox" checked={maximoLabor.includes(o.laborcode)}
                                            onChange={() => toggleMaximoLabor(o.laborcode)}
                                            className="tw-h-4 tw-w-4 tw-shrink-0 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500 tw-cursor-pointer" />)}
                                        <span className="tw-min-w-0 tw-truncate tw-text-sm tw-text-blue-gray-800">{o.name}</span>
                                        <span className="tw-ml-auto tw-font-mono tw-text-xs tw-text-blue-gray-400">{o.laborcode}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {(contractorPicked || (reviewMode && !!maximoContractor.trim())) && (
                            <div className="tw-mt-3 tw-space-y-1.5">
                                <label className="tw-block tw-text-xs tw-font-semibold tw-text-blue-gray-700">
                                    {t("contractorName", lang)} <span className="tw-text-red-500">*</span>
                                </label>
                                <input type="text" value={maximoContractor} onChange={(e) => setMaximoContractor(e.target.value)}
                                    placeholder={t("contractorPlaceholder", lang)}
                                    className={`tw-w-full tw-rounded-lg tw-border tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none ${contractorMissing ? "tw-border-red-400 focus:tw-border-red-500" : "tw-border-blue-gray-200 focus:tw-border-blue-500"}`} />
                                {contractorMissing && <p className="tw-text-xs tw-text-red-600">{t("contractorRequired", lang)}</p>}
                            </div>
                        )}
                    </div>

                        {/* โหมดตรวจไม่ต้องมี ฟอร์มฝั่งช่างดักความครบถ้วนไว้ตั้งแต่ตอนกรอกแล้ว */}
                        {!reviewMode && (
                            <PMValidationCard
                                lang={lang}
                                allPhotosAttached={allPhotosAttachedPost} missingPhotoItems={missingPhotoItemsFormatted}
                                allRequiredInputsFilled={allRequiredInputsFilled} missingInputsDetailed={missingInputsDetailed}
                                allPFAnsweredPost={allPFAnsweredPost} missingPFItemsPost={missingPFItemsPost}
                                isSummaryFilled={isSummaryFilled} isSummaryCheckFilled={isSummaryCheckFilled}
                            />
                        )}
                        {/* ดูอย่างเดียว: ตรวจได้ แต่ไม่มีปุ่มบันทึกให้กด */}
                        {!reviewMode && (
                            <div className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-2 sm:tw-gap-3">
                                <Button type="button" onClick={onFinalSave} disabled={!canFinalSave || submitting}
                                    className="tw-text-sm tw-py-2.5 tw-w-full sm:tw-w-auto tw-bg-gray-800 hover:tw-bg-gray-900 disabled:tw-bg-gray-800 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed">
                                    {submitting ? t("saving", lang) : t("save", lang)}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
                </fieldset>
            </form>
            <BackgroundUploadBanner lang={lang} />
            {/* เทียบผลก่อน/หลังของหัวข้อเดียวกันในบรรทัดเดียว */}
            {reviewMode && editId && (
                <PmCompareTable
                    rows={compareRows}
                    lang={lang}
                    postPhotos={cmpPhotos}
                    apiBase={API_BASE}
                    photoKeysOf={photoKeysOf}
                    summaryPost={summary}
                />
            )}
            {reviewMode && editId && (
                <div className="tw-mx-auto tw-max-w-6xl tw-mt-6 tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-5 tw-shadow-sm sm:tw-p-6">
                    <fieldset disabled className="pm-readonly tw-m-0 tw-min-w-0 tw-border-0 tw-p-0">
                        {summaryBlock}
                    </fieldset>
                </div>
            )}
            {/* ตรวจเสร็จแล้วกดต่อได้เลย ไม่ต้องเลื่อนกลับขึ้นไปข้างบน */}
            {approveMode && editId && (
                <div id="pm-approve-bottom" className="tw-mx-auto tw-max-w-6xl tw-mt-6 tw-flex tw-items-center tw-justify-end tw-gap-2 tw-border-t tw-border-blue-gray-100 tw-pt-5">
                    <PmApprovalBar
                        prefix="ccbpmreport" reportId={editId}
                        scope={{ station_id: stationId }}
                        apiBase={API_BASE}
                        onDone={(msg) => { alert(msg); goBackToList(); }}
                    />
                </div>
            )}
        </section>
    );
}
