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
import { draftKey, saveDraftLocal, loadDraftLocal, clearDraftLocal } from "../lib/draft";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import PmApprovalBar from "@/app/dashboard/pm-report/components/PmApprovalBar";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Tabs, TabsHeader, Tab } from "@material-tailwind/react";
import { putPhoto, getPhotoByDbKey, delPhoto, type PhotoRef } from "../lib/draftPhotos";
import { isFileReadable, isImageDecodable, resolveUsableFile, reportMissingDraftPhoto, reportPhotoStorageFailure } from "@/utils/upload-safety";
import { ensureViewableImage } from "@/utils/heic";
import { collectPending, unrecoverablePhotos, expectedCountByGroup, findShortfall, shortfallMessage, pendingMessage, unrecoverableMessage } from "@/utils/pm-photo-sync";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import { pmFormReturnRoute } from "@/app/dashboard/pm-report/lib/origin";
import { registerDraftDiscard } from "@/app/dashboard/pm-report/lib/discardDraft";
import { apiFetch } from "@/utils/api";
import { serverPhotosToForm, formKeyFromForward, measureAsText, mergeDraftPhotos, deleteRemovedServerPhotos, isServerPhoto, type ViewPhoto } from "@/app/dashboard/pm-report/lib/reviewData";
import { useDebouncedEffect } from "@/app/dashboard/pm-report/lib/useDebouncedEffect";
import { usePmReviewAction } from "@/app/dashboard/pm-report/lib/reviewAction";

// ==================== GPS + IMAGE UTILS ====================
let _cachedLocation: { text: string; timestamp: number } | null = null;
let _locationFetching = false;
const LOCATION_CACHE_MAX_AGE = 5 * 60 * 1000;
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

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
        if (gps) { const text = await reverseGeocode(gps.lat, gps.lng); _cachedLocation = { text, timestamp: Date.now() }; }
    } catch { /* silent */ }
    finally { _locationFetching = false; }
}

async function getCachedLocation(): Promise<string> {
    if (_cachedLocation && (Date.now() - _cachedLocation.timestamp) < LOCATION_CACHE_MAX_AGE) {
        void prefetchLocation(); return _cachedLocation.text;
    }
    await Promise.race([prefetchLocation(), new Promise<void>(resolve => setTimeout(resolve, 2000))]);
    return _cachedLocation?.text || "ไม่สามารถระบุตำแหน่งได้";
}

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
                ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(bgX, bgY, boxWidth, totalHeight + padding * 2);
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


// ==================== TRANSLATIONS ====================
const T = {
    // Page Header
    pageTitle: { th: "Preventive Maintenance Checklist - Station", en: "Preventive Maintenance Checklist - Station" },
    companyName: { th: "Electricity Generating Authority of Thailand (EGAT)", en: "Electricity Generating Authority of Thailand (EGAT)" },
    companyAddress: { th: "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand", en: "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand" },
    companyAddressShort: { th: "Bang Kruai, Nonthaburi 11130", en: "Bang Kruai, Nonthaburi 11130" },
    callCenter: { th: "Call Center Tel. 02-114-3350", en: "Call Center Tel. 02-114-3350" },

    // Form Labels
    docName: { th: "ชื่อเอกสาร", en: "Document Name" },
    issueId: { th: "Issue ID", en: "Issue ID" },
    location: { th: "สถานที่", en: "Location" },
    inspector: { th: "ผู้ตรวจสอบ", en: "Inspector" },
    pmDate: { th: "วันที่ PM", en: "PM Date" },

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
    remark: { th: "หมายเหตุ", en: "Remark" },
    remarkLabel: { th: "หมายเหตุ", en: "Remark" },
    testResult: { th: "ผลการทดสอบ", en: "Test Result" },
    comment: { th: "Comment", en: "Comment" },

    // Post Labels
    postPM: { th: "หลัง PM", en: "Post-PM" },
    afterPM: { th: "หลัง PM", en: "After PM" },

    // Summary
    summaryResult: { th: "สรุปผลการตรวจสอบ", en: "Inspection Summary" },
    summaryPassLabel: { th: "Pass : ผ่าน", en: "Pass" },
    summaryFailLabel: { th: "Fail : ไม่ผ่าน", en: "Fail" },
    summaryNALabel: { th: "N/A : ไม่พบ", en: "N/A" },

    // Validation Sections
    validationPhotoTitle: { th: "1) ตรวจสอบการแนบรูปภาพ (ทุกข้อ)", en: "1) Photo Attachments (all items)" },
    validationRemarkTitle: { th: "2) หมายเหตุ (ทุกข้อ)", en: "2) Remarks (all items)" },
    validationPFTitle: { th: "2) ระดับผลการตรวจ / N/A ทั้ง 11 ข้อ", en: "2) Inspection rating / N/A for all 11 items" },
    validationRemarkTitlePost: { th: "3) หมายเหตุ (ทุกข้อ)", en: "3) Remarks (all items)" },
    validationSummaryTitle: { th: "4) สรุปผลการตรวจสอบ", en: "4) Inspection Summary" },

    // Validation Messages
    allComplete: { th: "ครบเรียบร้อย ✅", en: "Complete ✅" },
    missingPhoto: { th: "ยังไม่ได้แนบรูปข้อ:", en: "Missing photos for:" },
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
    alertFillPhoto: { th: "กรุณาแนบรูปในทุกข้อก่อนบันทึก", en: "Please attach photos for all items" },
    alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },
    alertCompleteAll: { th: "กรุณากรอกข้อมูลและแนบรูปให้ครบก่อนบันทึก", en: "Please complete all fields and attach photos before saving" },
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
const ID_PREFIX = "station-pm";

const getPhotoIdFromKey = (photoKey: string): string => {
    // q1 -> station-pm-photo-1, r7_1 -> station-pm-photo-7-1
    if (photoKey.startsWith("q")) {
        return `${ID_PREFIX}-photo-${photoKey.substring(1)}`;
    }
    const match = photoKey.match(/^r(\d+)_(\d+)$/);
    if (match) {
        return `${ID_PREFIX}-photo-${match[1]}-${match[2]}`;
    }
    return `${ID_PREFIX}-photo-${photoKey}`;
};

const getRemarkIdFromKey = (rowKey: string): string => {
    // r1 -> station-pm-remark-1, r7_1 -> station-pm-remark-7-1
    const match = rowKey.match(/^r(\d+)(?:_(\d+))?$/);
    if (match) {
        return match[2] ? `${ID_PREFIX}-remark-${match[1]}-${match[2]}` : `${ID_PREFIX}-remark-${match[1]}`;
    }
    return `${ID_PREFIX}-remark-${rowKey}`;
};

const getPfIdFromKey = (rowKey: string): string => {
    // r1 -> station-pm-pf-1, r7_1 -> station-pm-pf-7-1
    const match = rowKey.match(/^r(\d+)(?:_(\d+))?$/);
    if (match) {
        return match[2] ? `${ID_PREFIX}-pf-${match[1]}-${match[2]}` : `${ID_PREFIX}-pf-${match[1]}`;
    }
    return `${ID_PREFIX}-pf-${rowKey}`;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const LOGO_SRC = "/img/logo_egat.png";

type StationPublic = { station_id: string; station_name: string; status?: boolean; };

async function fetchStationPublic(stationId: string): Promise<StationPublic | null> {
    const res = await fetch(`${API_BASE}/station/info/public?station_id=${encodeURIComponent(stationId)}`, { cache: "no-store", credentials: "include" });
    if (!res.ok) return null;
    const json = await res.json();
    return json.station ?? json;
}
type Me = { id: string; username: string; email: string; role: string; company: string; tel: string; };

type PhotoItem = { id: string; file?: File; preview?: string; remark?: string; uploading?: boolean; uploaded?: boolean; error?: string; ref?: PhotoRef; isNA?: boolean; createdAt?: string; location?: string; };

/** หาไฟล์ที่อัปโหลดได้จริงของรูปหนึ่งใบ — กู้จาก IndexedDB ให้เองถ้าไฟล์ใน memory ใช้ไม่ได้แล้ว */
function resolveUploadFile(p: PhotoItem): Promise<File> {
    const dbKey = p.ref?.dbKey;
    return resolveUsableFile(p.file, dbKey ? () => getPhotoByDbKey(dbKey) : undefined);
}
type Rating = "VERY_GOOD" | "GOOD" | "FAIR" | "UNUSABLE";
type PF = Rating | "PASS" | "FAIL" | "NA" | "";

type Question =
    | { no: number; key: string; label: { th: string; en: string }; kind: "simple"; hasPhoto?: boolean; tooltip?: { th: string; en: string } }
    | { no: number; key: string; label: { th: string; en: string }; kind: "group"; items: { key: string; label: { th: string; en: string } }[]; hasPhoto?: boolean; tooltip?: { th: string; en: string } };

const QUESTIONS_RAW = [
    { no: 101, key: "pre_r1", label: { th: "1) ตรวจสอบสภาพทั่วไป (ก่อนบำรุงรักษา)", en: "1) General condition (before maintenance)" }, kind: "simple", hasPhoto: true, tooltip: { th: "บันทึกสภาพสถานีก่อนเริ่มบำรุงรักษา", en: "Record the station condition before maintenance" } },
    { no: 102, key: "pre_r2", label: { th: "2) อุปกรณ์ชำรุดเสียหาย (ก่อนบำรุงรักษา)", en: "2) Damaged equipment (before maintenance)" }, kind: "simple", hasPhoto: true, tooltip: { th: "บันทึกอุปกรณ์ที่ชำรุดเสียหายก่อนเริ่มบำรุงรักษา", en: "Record damaged equipment before maintenance" } },
    {
        no: 103, key: "r103", label: { th: "3. ตรวจสอบสภาพแหล่งจ่ายไฟ MDB", en: "3. Inspect MDB power supply condition" }, kind: "group", hasPhoto: true,
        tooltip: { th: "ตรวจสอบสภาพอุปกรณ์แหล่งจ่ายไฟของสถานี", en: "Inspect the station's power supply equipment" },
        items: [
            { key: "r103_1", label: { th: "3.1) Main CB", en: "3.1) Main CB" } },
            { key: "r103_2", label: { th: "3.2) CB", en: "3.2) CB" } },
            { key: "r103_3", label: { th: "3.3) Power Meter (Voltage)", en: "3.3) Power Meter (Voltage)" } },
            { key: "r103_4", label: { th: "3.4) Transformer", en: "3.4) Transformer" } },
        ],
    },
    { no: 1, key: "r1", label: { th: "1. ตรวจสอบโครงสร้างสถานี", en: "1. Check station structure" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบความมั่นคงแข็งแรงของเสาและหลังคาว่าไม่มีการทรุดตัวและไม่มีรอยร้าวในโครงสร้างหลักหรือรอยแยกบริเวณรอยต่อ", en: "Check the stability of pillars and roof for any subsidence, cracks in main structure, or separation at joints" } },
    { no: 2, key: "r2", label: { th: "2. ตรวจสอบสีโครงสร้างสถานี", en: "2. Check station structure paint" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบการหลุดร่อน พองตัว หรือการเกิดสนิมบนพื้นผิวโลหะ", en: "Check for peeling, blistering, or rust formation on metal surfaces" } },
    { no: 3, key: "r3", label: { th: "3. ตรวจสอบพื้นผิวสถานี", en: "3. Check station surface" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบสภาพพื้นผิวคอนกรีตหรือวัสดุปูพื้นต้องไม่มีรอยแตกร้าว", en: "Check concrete surface or flooring material for cracks or damage" } },
    { no: 4, key: "r4", label: { th: "4. ตรวจสอบสีพื้นผิวสถานี", en: "4. Check station surface paint" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบความชัดเจนของสัญลักษณ์บนพื้น เช่น เส้นแบ่งช่องจอดรถและสัญลักษณ์ EV ต้องไม่ซีดจางและสีพื้นที่ต้องไม่หลุดร่อน", en: "Check clarity of floor markings such as parking lines and EV symbols - must not be faded, and floor paint must not be peeling" } },
    { no: 5, key: "r5", label: { th: "5. ตรวจสอบตัวกั้นห้ามล้อ", en: "5. Check wheel stopper" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบสภาพและความแน่นหนาของการยึดตัวกั้นล้อว่าไม่เคลื่อนที่หรือเกิดการแตกหัก", en: "Check condition and secure mounting of wheel stoppers - must not be displaced or broken" } },
    { no: 6, key: "r6", label: { th: "6. ตรวจสอบเสากันชนเครื่องอัดประจุไฟฟ้า", en: "6. Check charger bumper pole" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบสภาพความสมบูรณ์และความมั่นคงของเสากันชน", en: "Check the integrity and stability of the bumper pole" } },
    {
        no: 7, key: "r7", label: { th: "7. โคมไฟส่องสว่าง", en: "7. Lighting" }, kind: "group", hasPhoto: true,
        tooltip: { th: "ตรวจสอบสภาพและการทำงานของโคมไฟส่องสว่างภายในสถานี", en: "Check condition and operation of lighting fixtures within the station" },
        items: [
            { key: "r7_1", label: { th: "7.1) ตรวจสอบสภาพโคมไฟส่องสว่าง", en: "7.1) Check lighting fixture condition" } },
            { key: "r7_2", label: { th: "7.2) ตรวจสอบการทำงาน", en: "7.2) Check operation" } },
        ],
    },
    {
        no: 8, key: "r8", label: { th: "8. ป้ายชื่อสถานี", en: "8. Station sign" }, kind: "group", hasPhoto: true,
        tooltip: { th: "ตรวจสอบสภาพและการทำงานของป้ายสถานี", en: "Check condition and operation of station sign" },
        items: [
            { key: "r8_1", label: { th: "8.1) ตรวจสอบสภาพป้ายชื่อสถานี", en: "8.1) Check station sign condition" } },
            { key: "r8_2", label: { th: "8.2) ตรวจสอบการทำงาน", en: "8.2) Check operation" } },
        ],
    },
    {
        no: 9, key: "r9", label: { th: "9. ป้ายวิธีใช้งาน", en: "9. Usage instruction sign" }, kind: "group", hasPhoto: true,
        tooltip: { th: "ตรวจสอบป้ายแนะนำการใช้งานว่าอยู่ในสภาพสมบูรณ์ ไม่หลุดหรือชำรุด โดยตัวอักษรและข้อมูลคำแนะนำต้องชัดเจน", en: "Check usage instruction sign is in good condition, not detached or damaged, with clear and legible text and instructions" },
        items: [
            { key: "r9_1", label: { th: "9.1) ตรวจสอบสภาพป้ายวิธีใช้งาน", en: "9.1) Check instruction sign condition" } },
            { key: "r9_2", label: { th: "9.2) ตรวจสอบการทำงาน", en: "9.2) Check operation" } },
        ],
    },
    {
        no: 10, key: "r10", label: { th: "10. ตรวจสอบถังดับเพลิง", en: "10. Check fire extinguisher" }, kind: "group", hasPhoto: true,
        tooltip: { th: "ตรวจสอบสภาพภายนอกของถังดับเพลิงและเกจวัดแรงดันไม่อยู่ในสถานะ Overcharge", en: "Check external condition of fire extinguisher and ensure pressure gauge is not in Overcharge status" },
        items: [
            { key: "r10_1", label: { th: "10.1) ตรวจสอบสภาพทั่วไป", en: "10.1) Check general condition" } },
            { key: "r10_2", label: { th: "10.2) ตรวจสอบเกจวัดแรงดัน", en: "10.2) Check pressure gauge" } },
            { key: "r10_3", label: { th: "10.3) ตรวจสอบของเหลวภายใน", en: "10.3) Check internal liquid" } },
        ],
    },
    { no: 11, key: "r11", label: { th: "11. ทำความสะอาด", en: "11. Cleaning" }, kind: "simple", hasPhoto: true, tooltip: { th: "ทำความสะอาดและกำจัดเศษขยะหรือสิ่งสกปรกบริเวณสถานี", en: "Clean and remove debris or dirt from the station area" } },
];

const QUESTIONS: Question[] = QUESTIONS_RAW.filter(
    (q) => q.kind === "simple" || q.kind === "group"
) as Question[];

// ข้อ 1-3 (101-103) เป็นหัวข้อที่เพิ่มไว้หน้าฟอร์ม เลขที่แสดงตรงกับที่เขียนไว้ในป้ายอยู่แล้ว
// ส่วนข้อเดิม no=1..11 ยังเก็บคีย์ชุดเดิมใน DB จึงเลื่อนเฉพาะเลขที่แสดงผล
const DISPLAY_SHIFT = 3;

function getQuestionLabel(q: Question, lang: Lang): string {
    if (q.no >= 101 && q.no <= 103) return q.label[lang];
    return q.label[lang].replace(/^(\d+)/, (number) => String(Number(number) + DISPLAY_SHIFT));
}

function getDisplayedQuestionNo(qNo: number): number {
    if (qNo >= 101 && qNo <= 103) return qNo - 100;
    return qNo + DISPLAY_SHIFT;
}

function getDisplayedItemLabel(label: string, qNo: number): string {
    if (qNo >= 101 && qNo <= 103) return label;
    return label.replace(/^(\d+)/, (number) => String(Number(number) + DISPLAY_SHIFT));
}

// เลขที่แสดง -> เลขที่ใช้เป็น id ในหน้าฟอร์ม (เลขเก็บจริง) สำหรับเลื่อนหน้าจอไปที่ข้อนั้น
function displayedNoToStorageNo(displayNo: number): number {
    if (displayNo <= 3) return displayNo + 100;
    return displayNo - DISPLAY_SHIFT;
}

function getDisplayedRowNo(key: string): string {
    const match = key.match(/^r(\d+)(?:_(\d+))?$/);
    if (!match) return key;
    const mainNo = getDisplayedQuestionNo(Number(match[1]));
    return match[2] ? `${mainNo}.${match[2]}` : `${mainNo}`;
}


// ==================== SectionCard ====================
function SectionCard({ title, subtitle, children, tooltip }: { title?: string; subtitle?: string; children: React.ReactNode; tooltip?: string }) {
    const qNumber = title?.match(/^(\d+)[.)]/)?.[1];
    return (
        <div className="tw-bg-white tw-rounded-xl tw-border tw-border-gray-200 tw-shadow-sm tw-overflow-hidden">
            {title && (
                <div className="tw-bg-gray-800 tw-px-4 sm:tw-px-5 tw-py-3 sm:tw-py-4">
                    <div className="tw-flex tw-items-center tw-gap-2 sm:tw-gap-3">
                        {qNumber && (
                            <div className="tw-flex-shrink-0 tw-w-7 tw-h-7 sm:tw-w-8 sm:tw-h-8 tw-rounded-full tw-bg-white tw-text-gray-800 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-xs sm:tw-text-sm">
                                {qNumber}
                            </div>
                        )}
                        <Typography variant="h6" className="tw-text-white tw-text-sm sm:tw-text-base tw-font-semibold tw-flex-1">
                            {qNumber ? title.replace(/^\d+[.)]\s*/, '') : title}
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
            <div className="tw-p-4 sm:tw-p-5 tw-space-y-3 sm:tw-space-y-4">{children}</div>
        </div>
    );
}

function Section({ title, ok, children, lang }: { title: React.ReactNode; ok: boolean; children?: React.ReactNode; lang: Lang }) {
    return (
        <div className="tw-rounded-lg tw-p-2.5 sm:tw-p-3 tw-bg-gray-100">
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

interface PMValidationCardProps {
    lang: Lang;
    allPhotosAttached: boolean;
    missingPhotoItems: string[];
    allPFAnswered: boolean;
    missingPFItems: string[];
    isSummaryFilled: boolean;
    isSummaryCheckFilled: boolean;
}

function PMValidationCard({
    lang,
    allPhotosAttached, missingPhotoItems,
    allPFAnswered, missingPFItems,
    isSummaryFilled, isSummaryCheckFilled,
}: PMValidationCardProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    const getPhotoScrollId = (item: string): string => {
        const parts = item.split(".");
        const displayNo = Number(parts[0]);
        const storageNo = displayedNoToStorageNo(displayNo);
        if (parts.length === 2) return `${ID_PREFIX}-photo-${storageNo}-${parts[1]}`;
        return `${ID_PREFIX}-photo-${storageNo}`;
    };

    const getPfScrollId = (item: string): string => {
        const parts = item.split(".");
        const displayNo = Number(parts[0]);
        const storageNo = displayedNoToStorageNo(displayNo);
        if (parts.length === 2) return `${ID_PREFIX}-pf-${storageNo}-${parts[1]}`;
        return `${ID_PREFIX}-pf-${storageNo}`;
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

        // 2) PF status errors
        if (!allPFAnswered) {
            missingPFItems.forEach((item) => {
                errors.push({
                    section: lang === "th" ? "ระดับผลการตรวจ" : "Inspection rating",
                    sectionIcon: "✅",
                    itemName: `${t("itemLabel", lang)} ${item}`,
                    message: lang === "th" ? "ยังไม่ได้เลือกระดับผลการตรวจ" : "Inspection rating not selected",
                    scrollId: getPfScrollId(item),
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
                message: lang === "th" ? "ยังไม่ได้เลือกระดับผลการตรวจหรือ N/A" : "Inspection rating or N/A not selected",
                scrollId: `${ID_PREFIX}-summary-section`,
            });
        }

        return errors;
    }, [
        lang,
        allPhotosAttached, missingPhotoItems,
        allPFAnswered, missingPFItems,
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
            <div className={`tw-px-4 tw-py-3 tw-cursor-pointer tw-flex tw-items-center tw-justify-between ${isComplete ? "tw-bg-green-100" : "tw-bg-amber-100"}`} onClick={() => setIsExpanded(!isExpanded)}>
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

// Scroll to first error helper
function scrollToFirstError(scrollId: string) {
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
}

function PassFailRow({
    label, value, onChange, remark, onRemarkChange, labels, aboveRemark, beforeRemark, inlineLeft, showPfButtons = true, lang, id, remarkId,
}: {
    label: string; value: PF; onChange: (v: Rating | "NA") => void;
    remark?: string; onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
    aboveRemark?: React.ReactNode; beforeRemark?: React.ReactNode; inlineLeft?: React.ReactNode; showPfButtons?: boolean; lang: Lang;
    id?: string; remarkId?: string;
}) {
    const text = {
        VERY_GOOD: labels?.VERY_GOOD ?? (lang === "th" ? "ดีมาก" : "Excellent"),
        GOOD: labels?.GOOD ?? (lang === "th" ? "ดี" : "Good"),
        FAIR: labels?.FAIR ?? (lang === "th" ? "พอใช้" : "Fair"),
        UNUSABLE: labels?.UNUSABLE ?? (lang === "th" ? "ใช้งานไม่ได้" : "Unusable"),
        NA: labels?.NA ?? t("na", lang),
    };
    const buttonGroup = (
        <div id={id} className="tw-flex tw-flex-wrap tw-gap-2 tw-ml-auto">
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
                    {showPfButtons !== false && buttonsRow}
                    {beforeRemark}
                    <div id={remarkId}>
                        <Textarea label={t("remark", lang)} value={remark || ""} onChange={(e) => onRemarkChange(e.target.value)}
                            containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full" />
                    </div>
                </div>
            ) : (
                showPfButtons !== false && <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">{buttonsRow}</div>
            )}
        </div>
    );
}

function PhotoMultiInput({
    photos, setPhotos, max = 10, draftKey, qNo, lang, id,
}: {
    photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
    max?: number; draftKey: string; qNo: number; lang: Lang; id?: string;
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
                    <Button data-photo-add size="sm" color="blue" variant="outlined" onClick={() => cameraRef.current?.click()} className="tw-shrink-0 tw-flex tw-items-center tw-gap-1">
                        <svg className="tw-w-4 tw-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {lang === "th" ? "ถ่ายรูป" : "Take Photo"}
                    </Button>
                ) : (
                    <Button data-photo-add size="sm" color="blue" variant="outlined" onClick={() => fileRef.current?.click()} className="tw-shrink-0 tw-flex tw-items-center tw-gap-1">
                        <svg className="tw-w-4 tw-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {t("attachPhoto", lang)}
                    </Button>
                )}
            </div>
            {isMobile && <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="tw-hidden" onChange={e => { void handleFiles(e.target.files, true); }} />}
            {!isMobile && <input ref={fileRef} type="file" accept="image/*" multiple className="tw-hidden" onChange={e => { void handleFiles(e.target.files, false); }} />}
            <Typography variant="small" className="!tw-text-blue-gray-500">
                {t("maxPhotos", lang)} {max} {t("photos", lang)}
            </Typography>
            {photos.length > 0 ? (
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-2 sm:tw-gap-3">
                    {photos.map((p) => (<div key={p.id} className="tw-border tw-rounded-lg tw-overflow-hidden tw-bg-white tw-shadow-xs tw-flex tw-flex-col"><div className="tw-relative tw-aspect-[4/3] tw-bg-blue-gray-50">{p.preview && <img src={p.preview} alt="preview" className="tw-w-full tw-h-full tw-object-cover" />}<button data-photo-remove onClick={() => { void handleRemove(p.id); }} className="tw-absolute tw-top-1.5 tw-right-1.5 tw-bg-red-500 tw-text-white tw-w-5 tw-h-5 sm:tw-w-6 sm:tw-h-6 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-shadow-md hover:tw-bg-red-600 tw-transition-colors tw-text-xs sm:tw-text-sm">×</button></div></div>))}
                </div>
            ) : (<Typography variant="small" className="!tw-text-blue-gray-500 tw-text-xs sm:tw-text-sm">{t("noPhotos", lang)}</Typography>)}
        </div>
    );
}
async function fetchReport(reportId: string, stationId: string) {
    const url = `${API_BASE}/stationpmreport/get?station_id=${stationId}&report_id=${reportId}`;
    const res = await fetch(url, { method: "GET", credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

export default function StationPMReport() {
    const { lang } = useLanguage();
    const [me, setMe] = useState<Me | null>(null);
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [docName, setDocName] = useState<string>("");
    const [reportId, setReportId] = useState<string>("");

    const searchParams = useSearchParams();

    // ปุ่มย้อนกลับ: เปิดมาจากหน้า PM List ให้กลับไปหน้านั้นตรงๆ
    const goBackToList = useCallback(() => {
        // กลับหน้าที่เปิดเข้ามา: หน้ารวมของใบ PM สถานี / PM List — นอกนั้นถอยประวัติ
        const back = pmFormReturnRoute(searchParams);
        if (back) router.push(back);
        else router.back();
    }, [router, searchParams]);
    const editId = searchParams.get("edit_id") ?? "";
    // เปิดจากใบ PM สถานี "ใบเดียว 4 ส่วน" → ผูกใบนี้เป็นส่วนหนึ่งของใบแม่
    const jobId = searchParams.get("job_id") ?? "";
    const action = searchParams.get("action");

    // Photos: key-based for simple (q1, q2, ...) and group items (r7_1, r7_2, ...)
    const initialPhotos: Record<string, PhotoItem[]> = Object.fromEntries(
        QUESTIONS.filter((q) => q.hasPhoto).flatMap((q) => {
            const entries: [string, PhotoItem[]][] = [];
            entries.push([`q${q.no}`, []]);
            if (q.kind === "group") {
                q.items.forEach((item) => { entries.push([item.key, []]); });
            }
            return entries;
        })
    ) as Record<string, PhotoItem[]>;
    const [photos, setPhotos] = useState<Record<string, PhotoItem[]>>(initialPhotos);
    // รูปเดิมของเอกสารที่โหลดมาใส่ฟอร์ม (หน้าดู / แก้ส่วนที่ส่งแล้ว) — ตอนบันทึกเทียบกับ photos
    // เพื่อรู้ว่าผู้ใช้กดลบรูปเดิมรูปไหนออก แล้วลบออกจากเอกสารจริง
    const serverPhotosRef = useRef<Record<string, ViewPhoto[]>>({});

    const photosRef = useRef(photos);
    useEffect(() => { photosRef.current = photos; }, [photos]);
    useEffect(() => () => {
        Object.values(photosRef.current).flat().forEach((p: any) => {
            if (typeof p?.preview === "string" && p.preview.startsWith("blob:")) URL.revokeObjectURL(p.preview);
        });
    }, []);

    const [summary, setSummary] = useState<string>("");
    const [stationId, setStationId] = useState<string | null>(null);

    // Draft key (Post-PM)
    // ใบใหม่ (ยังไม่มี edit_id) ก็ต้องมี draft — ผูกกับ job_id ถ้ามี ไม่งั้นใช้ "new"
    const postKey = useMemo(
        () => `${draftKey(stationId)}:${editId ? editId : (jobId ? `job-${jobId}` : "new")}:post`,
        [stationId, editId, jobId],
    );
    // key ที่ restore draft เสร็จแล้ว — autosave ห้ามทำงานก่อน restore เสร็จ
    // ไม่งั้น state ว่างตอนเปิดหน้าจะเขียนทับ draft เดิม (เปลี่ยน key = reset อัตโนมัติ)
    const [restoredKey, setRestoredKey] = useState<string | null>(null);
    const draftRestored = restoredKey === postKey;
    // ส่งเสร็จแล้วล้าง draft — autosave ที่ค้างอยู่ (รวมตอนออกจากหน้า) ห้ามเขียนกลับ
    const draftClearedRef = useRef(false);
    // ปุ่ม "ยกเลิกการแก้ไข" ที่หน้ารวมล้าง draft ของฟอร์มนี้ผ่านตัวนี้ (หน้ารวมไม่รู้สูตร key ของแต่ละฟอร์ม)
    useEffect(() => registerDraftDiscard(async () => {
        draftClearedRef.current = true; // กัน autosave ที่ค้างอยู่เขียนกลับมาตอนออกจากหน้า
        await clearDraftLocal(postKey);
    }), [postKey]);
    useEffect(() => { draftClearedRef.current = false; }, [postKey]);

    // Remove draft_id from URL if present
    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.has("draft_id")) {
            params.delete("draft_id");
            const url = `${window.location.pathname}?${params.toString()}`;
            window.history.replaceState({}, "", url);
        }
    }, []);

    const [summaryCheck, setSummaryCheck] = useState<PF>("");

    // เวลาทำงานจริงของช่าง (datetime-local) — ส่งเข้า Maximo ทาง IN09 ตอนปิดใบงาน



    const [workStart, setWorkStart] = useState<string>("");

    const [workFinish, setWorkFinish] = useState<string>("");

    // planner เปิดเอกสารที่ช่างส่งมาเพื่อตรวจก่อนอนุมัติ (?approve=1)

    const approveMode = searchParams.get("approve") === "1";
    // ช่างเปิดดูใบที่ตัวเองส่งไปแล้ว (?review=1) — เห็นหน้าเดียวกับ planner
    // แต่แก้อะไรไม่ได้ และไม่มีปุ่ม Reject/Approve
    const reviewMode = approveMode || searchParams.get("review") === "1";
    const reviewAction = usePmReviewAction();


    // laborcode ฝั่ง Maximo ที่ช่างเลือกเอง — username ใน iMPS ใช้แทนกันไม่ได้
    const [laborOptions, setLaborOptions] = useState<{ laborcode: string; name: string; needs_name?: boolean }[]>([]);
    const [maximoLabor, setMaximoLabor] = useState<string[]>([]);
    const [maximoContractor, setMaximoContractor] = useState<string>("");

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/cm-maximo/labor-codes`, { credentials: "include" });
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

    const [job, setJob] = useState({ issue_id: "", station_name: "", date: "" });

    // All keys for rows (simple + group items)
    const ALL_KEYS = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") { if (!q.key.startsWith("pre_")) keys.push(q.key); }
            else if (q.kind === "group") { q.items.forEach((item) => { keys.push(item.key); }); }
        });
        return keys;
    }, []);

    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(() => {
        const initial: Record<string, { pf: PF; remark: string }> = {};
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") { initial[q.key] = { pf: "", remark: "" }; }
            else if (q.kind === "group") { q.items.forEach((item) => { initial[item.key] = { pf: "", remark: "" }; }); }
        });
        return initial;
    });

    // Load API data for Post mode
    useEffect(() => {
        if (!editId || !stationId) return;
        setPostApiLoaded(false);
        (async () => {
            try {
                const data = await fetchReport(editId, stationId);
                if (data.job) setJob(prev => ({ ...prev, ...data.job, station_name: data.job.station_name || prev.station_name, issue_id: data.issue_id ?? prev.issue_id }));
                if (data.pm_date) setJob(prev => ({ ...prev, date: data.pm_date }));
                if (data.doc_name) setDocName(data.doc_name);
                if (data.inspector) setInspector(data.inspector);
                if (data.summary) setSummary(data.summary);
                // สรุปผล/หมายเหตุเดิมอ่านจาก draft ในเครื่องอย่างเดียว คนที่ไม่ได้เป็นคนกรอก
                // (ผู้อนุมัติ) จึงเปิดมาเจอช่องว่าง ต้องดึงจากตัวเอกสารด้วย
                // ส่วนหนึ่งของใบ PM สถานี: เปิดแก้ส่วนที่ส่งแล้ว (เครื่องนี้ไม่มี draft) ก็ต้องได้ค่าเดิมจากเอกสาร
                if (reviewMode || jobId) {
                    // เวลาทำงาน/laborcode ก็เก็บอยู่ใน draft ของเครื่องช่างเหมือนกัน
                    // ผู้อนุมัติต้องอ่านจากตัวเอกสาร ไม่งั้นเห็นเป็นช่องว่าง
                    if (typeof data.work_start === "string") setWorkStart(data.work_start);
                    if (typeof data.work_finish === "string") setWorkFinish(data.work_finish);
                    if (Array.isArray(data.maximo_labor)) setMaximoLabor(data.maximo_labor);
                    if (typeof data.maximo_contractor === "string") setMaximoContractor(data.maximo_contractor);
                    if (typeof data.summary === "string") setSummary(data.summary);
                    if (data.summaryCheck) setSummaryCheck(data.summaryCheck as PF);
                    // หน้าดูใช้ฟอร์มเดียวกับตอนกรอก — รูปมาจากเอกสาร ไม่ใช่ draft ในเครื่อง
                    const fromServer = serverPhotosToForm(data.photos,
                        formKeyFromForward(Object.keys(initialPhotos), k => toGroupKey(String(k))), API_BASE);
                    serverPhotosRef.current = fromServer;
                    setPhotos(prev => ({ ...prev, ...fromServer }) as typeof prev);
                }
                if (data.rows) {
                    setRows((prev) => { const next = { ...prev }; Object.entries(data.rows).forEach(([k, v]) => { next[k] = v as { pf: PF; remark: string }; }); return next; });
                }
                setPostApiLoaded(true);
            } catch (err) { console.error("load report failed:", err); setPostApiLoaded(true); }
        })();
    }, [editId, stationId]);

    // Load draft for Post mode — ใบที่มี edit_id รอ API โหลดเสร็จก่อนแล้วค่อยทับ,
    // ใบใหม่ restore ได้ทันทีที่รู้ stationId
    useEffect(() => {
        if (!stationId) return;
        if (editId && !postApiLoaded) return;
        // โหมดตรวจ/อนุมัติเป็น read-only อ่านจากตัวเอกสารอย่างเดียว ไม่เอา draft ในเครื่องมาทับ
        if (reviewMode) { setRestoredKey(postKey); return; }
        const postDraft = loadDraftLocal<{
            rows?: typeof rows; summary?: string; summaryCheck?: PF;
            workStart?: string; workFinish?: string;
            maximoLabor?: string[]; maximoContractor?: string;
            photoRefs?: Record<string, (PhotoRef | { isNA: true })[]>;
        }>(postKey);
        if (!postDraft) { setRestoredKey(postKey); return; }
        if (postDraft.rows) setRows(prev => ({ ...prev, ...postDraft.rows }));
        if (postDraft.summary) setSummary(postDraft.summary);
        if (postDraft.summaryCheck) setSummaryCheck(postDraft.summaryCheck);
        if (typeof postDraft.workStart === "string" && postDraft.workStart) setWorkStart(postDraft.workStart);
        if (typeof postDraft.workFinish === "string" && postDraft.workFinish) setWorkFinish(postDraft.workFinish);
        if (Array.isArray(postDraft.maximoLabor)) setMaximoLabor(postDraft.maximoLabor);
        if (typeof postDraft.maximoContractor === "string") setMaximoContractor(postDraft.maximoContractor);
        let alive = true;
        (async () => {
            try {
                await restorePhotos();
            } finally {
                // เปิด autosave หลังรูปโหลดเสร็จ ไม่งั้น photoRefs ว่างจะไปทับ refs ใน draft
                if (alive) setRestoredKey(postKey);
            }
        })();
        return () => { alive = false; };

        async function restorePhotos() {
            const refMap = postDraft?.photoRefs;
            if (!refMap) return;
            const next: Record<string, PhotoItem[]> = { ...initialPhotos };
            for (const [photoKey, refs] of Object.entries(refMap)) {
                const items: PhotoItem[] = [];
                for (const ref of refs || []) {
                    if ('isNA' in ref && ref.isNA) { items.push({ id: `${photoKey}-NA-restored`, isNA: true, preview: undefined }); continue; }
                    if (!('id' in ref) || !ref.id) continue;
                    const file = await getPhotoByDbKey((ref as PhotoRef).dbKey);
                    if (!file || file.size === 0) {
                        console.warn("Photo missing/empty in IndexedDB:", (ref as PhotoRef).dbKey);
                        reportMissingDraftPhoto(lang);
                        continue;
                    }
                    items.push({ id: ref.id, file, preview: URL.createObjectURL(file), remark: (ref as any).remark ?? "", ref: ref as PhotoRef });
                }
                if (items.length > 0) next[photoKey] = items;
            }
            if (!alive) return;
            if (Object.keys(next).some(k => (next[k]?.length ?? 0) > 0)) setPhotos(prev => mergeDraftPhotos(prev, next) as typeof prev);
        }
    }, [stationId, editId, postKey, postApiLoaded, reviewMode]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/me`, { method: "GET", credentials: "include" });
                if (!res.ok) return;
                const data: Me = await res.json();
                setMe(data);
                // หน้าดูข้อมูลต้องโชว์ผู้ตรวจที่บันทึกในเอกสาร ไม่ใช่คนที่เปิดดู
                if (!reviewMode) setInspector((prev) => prev || data.username || "");
            } catch (err) { console.error("fetch /me error:", err); }
        })();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sid = params.get("station_id") || localStorage.getItem("selected_station_id");
        if (sid) setStationId(sid);
    }, []);

    // ชื่อสถานีสำหรับช่อง "สถานที่" — เดิมรอ event "station:info" ที่ไม่มีใครส่งแล้ว ช่องจึงว่างทั้งตอนกรอกและตอนดู
    // ดึงเองจากข้อมูลสถานี; เอกสารที่บันทึกชื่อไว้แล้วใช้ค่าในเอกสาร
    useEffect(() => {
        if (!stationId) return;
        let alive = true;
        fetchStationPublic(stationId)
            .then(st => { if (alive && st?.station_name) setJob((prev) => ({ ...prev, station_name: prev.station_name || st.station_name })); })
            .catch(err => console.error("load station info failed:", err));
        return () => { alive = false; };
    }, [stationId]);

    const makePhotoSetter = (photoKey: string): React.Dispatch<React.SetStateAction<PhotoItem[]>> => {
        return (action: React.SetStateAction<PhotoItem[]>) => {
            setPhotos((prev) => {
                const current = prev[photoKey] ?? [];
                const next = typeof action === "function" ? (action as (x: PhotoItem[]) => PhotoItem[])(current) : action;
                return { ...prev, [photoKey]: next };
            });
        };
    };

    // Photo validation
    const REQUIRED_PHOTO_KEYS = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.filter((q) => q.hasPhoto).forEach((q) => {
            if (q.kind === "group") { q.items.forEach((item) => { keys.push(item.key); }); }
            else { keys.push(`q${q.no}`); }
        });
        return keys;
    }, []);

    const missingPhotoItems = useMemo(() => {
        const missingKeys = REQUIRED_PHOTO_KEYS.filter((photoKey) => {
            const match = photoKey.match(/^r(\d+)_/);
            if (match) {
                if (rows[photoKey]?.pf === "NA") return false;
            } else {
                const qKey = photoKey.startsWith("q") ? `r${photoKey.substring(1)}` : photoKey;
                if (rows[qKey]?.pf === "NA") return false;
            }
            if ((photos[photoKey]?.length ?? 0) > 0) return false;
            // server เก็บรูปของข้อที่มีข้อย่อยรวมกันก้อนเดียว (ไม่รู้ว่ารูปไหนของข้อย่อยไหน)
            // ตอนเปิดแก้จึงวางรูปเดิมไว้ที่ข้อย่อยแรก — ข้อนี้มีรูปเดิมอยู่แล้ว ข้อย่อยอื่นไม่ต้องแนบซ้ำ
            if (match && Object.entries(photos).some(([k, list]) =>
                k.startsWith(`r${match[1]}_`) && (list ?? []).some(isServerPhoto))) return false;
            return true;
        });
        return missingKeys.map((key) => {
            if (key.startsWith("q")) return `${getDisplayedQuestionNo(Number(key.substring(1)))}`;
            const match = key.match(/^r(\d+)_(\d+)$/);
            if (match) return `${getDisplayedQuestionNo(Number(match[1]))}.${match[2]}`;
            return key.replace("r", "");
        }).sort((a, b) => {
            const aParts = String(a).split(".").map(Number);
            const bParts = String(b).split(".").map(Number);
            if (aParts[0] !== bParts[0]) return aParts[0] - bParts[0];
            return (aParts[1] ?? 0) - (bParts[1] ?? 0);
        });
    }, [REQUIRED_PHOTO_KEYS, photos, rows]);

    const allPhotosAttached = missingPhotoItems.length === 0;

    // PF validation
    const PF_REQUIRED_KEYS = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.key.startsWith("pre_")) return;
            if (q.kind === "simple") { keys.push(q.key); }
            else if (q.kind === "group") { q.items.forEach((item) => { keys.push(item.key); }); }
        });
        return keys;
    }, []);

    const allPFAnswered = useMemo(() => PF_REQUIRED_KEYS.every((k) => rows[k]?.pf !== ""), [rows, PF_REQUIRED_KEYS]);

    const missingPFItems = useMemo(() => PF_REQUIRED_KEYS.filter((k) => !rows[k]?.pf).map((k) => {
        const match = k.match(/^r(\d+)(?:_(\d+))?$/);
        if (!match) return k;
        return getDisplayedRowNo(k);
    }).sort((a, b) => {
        const aParts = String(a).split(".").map(Number);
        const bParts = String(b).split(".").map(Number);
        if (aParts[0] !== bParts[0]) return aParts[0] - bParts[0];
        return (aParts[1] ?? 0) - (bParts[1] ?? 0);
    }), [rows, PF_REQUIRED_KEYS]);

    const isSummaryFilled = summary.trim().length > 0;
    const isSummaryCheckFilled = summaryCheck !== "";

    const canFinalSave = allPhotosAttached && allPFAnswered && isSummaryFilled && isSummaryCheckFilled;

    // Helper functions for scroll IDs
    // รายการที่ค้างเก็บเป็น "เลขที่แสดง" ส่วน id ในหน้าอิงเลขเก็บจริง ต้องแปลงก่อนเสมอ
    const getFirstMissingPhotoScrollId = (): string | null => {
        if (missingPhotoItems.length === 0) return null;
        const parts = missingPhotoItems[0].split(".");
        const storageNo = displayedNoToStorageNo(Number(parts[0]));
        if (parts.length === 2) return `${ID_PREFIX}-photo-${storageNo}-${parts[1]}`;
        return `${ID_PREFIX}-photo-${storageNo}`;
    };

    const getFirstMissingPFScrollId = (): string | null => {
        if (missingPFItems.length === 0) return null;
        const parts = missingPFItems[0].split(".");
        const storageNo = displayedNoToStorageNo(Number(parts[0]));
        if (parts.length === 2) return `${ID_PREFIX}-pf-${storageNo}-${parts[1]}`;
        return `${ID_PREFIX}-pf-${storageNo}`;
    };

    // Photo refs for draft
    const photoRefs = useMemo(() => {
        const out: Record<string, (PhotoRef | { isNA: true })[]> = {};
        Object.entries(photos).forEach(([photoKey, list]) => {
            out[photoKey] = (list || [])
                .map(p => {
                    if (p.isNA) return { isNA: true } as const;
                    if (!p.ref) return null;
                    return { ...p.ref, uploaded: p.uploaded === true };
                })
                .filter(Boolean) as (PhotoRef | { isNA: true })[];
        });
        return out;
    }, [photos]);

    // Save draft for Post mode
    useDebouncedEffect(() => {
        // ใบใหม่ก็บันทึก draft ด้วย; ห้ามบันทึกก่อน restore เสร็จ และไม่บันทึกในโหมดตรวจ/อนุมัติ
        if (!stationId || reviewMode || !draftRestored || draftClearedRef.current) return;
        // merge กับ draft เดิม ให้ pendingReportId (กันรายงานซ้ำ) ไม่หาย
        saveDraftLocal(postKey, {
            ...(loadDraftLocal<any>(postKey) ?? {}),
            rows, summary, summaryCheck, workStart, workFinish, maximoLabor, maximoContractor, photoRefs,
        });
    }, [postKey, stationId, rows, summary, summaryCheck, workStart, workFinish, maximoLabor, maximoContractor, photoRefs, reviewMode, draftRestored]);

    // รับ PhotoItem แทน File[] เพื่อให้รู้ว่ารูปไหนอัปสำเร็จแล้ว — ตอนกดบันทึกซ้ำหลังอัปหลุด
    // จะได้ข้ามรูปเดิม ไม่อัปซ้ำจนรูปโผล่ซ้ำในรายงาน (และไม่ไปชนเพดาน 10 รูป/ข้อ)
    /** key ที่ backend ใช้เก็บใน photos — ต้องใช้สูตรเดียวกันทั้งตอน upload และตอน verify
     *  หลาย photoKey (r7_1, r7_2) map ไปข้อเดียวกันได้ ฝั่ง server ก็รวมเป็น group เดียว */
    const toGroupKey = (photoKey: string): string | null => {
        if (photoKey.startsWith("q")) {
            const q = QUESTIONS.find(q => q.no === Number(photoKey.substring(1)));
            return q ? q.key : null;
        }
        if (photoKey.includes("_")) {
            const match = photoKey.match(/r(\d+)/);
            if (match) {
                const q = QUESTIONS.find(q => q.no === Number(match[1]));
                return q ? q.key : null;
            }
        }
        return null;
    };

    async function uploadGroupPhotos(reportId: string, stationId: string, group: string, items: PhotoItem[], stateKey: string, uploadedIds: Set<string>) {
        // uploadedIds จำเป็นเพราะ setPhotos() ยังไม่ flush เข้า photosRef ภายใน tick เดียวกัน
        const pending = (items || []).filter(p => !p.isNA && !p.uploaded && !uploadedIds.has(p.id) && (p.file || p.ref));
        if (pending.length === 0) return;
        const url = `${API_BASE}/stationpmreport/${reportId}/post/photos`;
        // ส่งทีละรูป (1 request/รูป) เพื่อไม่ให้ body รวมเกิน limit ของ nginx (กัน 413 เมื่อข้อหนึ่งมีหลายรูป)
        for (const p of pending) {
            const compressed = await compressImage(await resolveUploadFile(p));
            const form = new FormData();
            form.append("station_id", stationId);
            form.append("group", group);
            form.append("side", "post");
            form.append("files", compressed);
            const res = await fetch(url, { method: "POST", body: form, credentials: "include" });
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
            if (collectPending(photosRef.current as any, uploadedIds).length === 0) break;

            const jobs: Promise<void>[] = [];
            for (const [photoKey, list] of Object.entries(photosRef.current)) {
                if (!list || list.length === 0) continue;
                const groupKey = toGroupKey(photoKey);
                // เดิม continue เฉย ๆ → รูปข้อนี้ไม่ถูกอัปแต่โค้ดไหลไปลบรูปในเครื่องต่อ
                if (!groupKey) throw new Error(lang === "th"
                    ? `จับคู่รูปข้อ ${photoKey} กับหัวข้อในฟอร์มไม่ได้ กรุณาแจ้งผู้ดูแลระบบ`
                    : `Cannot map photo key ${photoKey} to a checklist item. Please contact the administrator.`);
                jobs.push(uploadGroupPhotos(reportId, sid, groupKey, list, photoKey, uploadedIds));
            }
            // อัปไม่ผ่าน → throw ทะลุขึ้นไป catch ของ handler โดยยังไม่ได้ลบอะไร
            await Promise.all(jobs);
        }

        const stillPending = collectPending(photosRef.current as any, uploadedIds);
        if (stillPending.length > 0) {
            alert(pendingMessage(stillPending.length, lang));
            return false;
        }

        const expected = expectedCountByGroup(photosRef.current as any, k => toGroupKey(k) ?? k);
        if (Object.keys(expected).length === 0) return true;

        const res = await fetch(`${API_BASE}/stationpmreport/get?station_id=${encodeURIComponent(sid)}&report_id=${reportId}`,
            { credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
        const doc = await res.json() as { photos?: Record<string, unknown[]> };
        const shortfall = findShortfall(expected, doc?.photos);
        if (shortfall.length > 0) {
            console.error("[STATION post verify] shortfall:", shortfall);
            alert(shortfallMessage(shortfall, lang));
            return false;
        }
        return true;
    }

    // Helper function to flatten rows and ensure correct structure
    const flattenRows = (inputRows: Record<string, any>): Record<string, { pf: PF; remark: string }> => {
        const result: Record<string, { pf: PF; remark: string }> = {};
        const validKeys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") { validKeys.push(q.key); }
            else if (q.kind === "group") { q.items.forEach((item) => { validKeys.push(item.key); }); }
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
        for (const key of validKeys) {
            if (!result[key]) { result[key] = { pf: "", remark: "" }; }
        }
        return result;
    };

    const onFinalSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }

        // Validation checks with scroll to error
        if (!allPhotosAttached) {
            alert(t("alertFillPhoto", lang));
            const scrollId = getFirstMissingPhotoScrollId();
            if (scrollId) scrollToFirstError(scrollId);
            return;
        }
        if (!allPFAnswered) {
            alert(lang === "th" ? "กรุณาเลือกระดับผลการตรวจหรือ N/A ทุกข้อ" : "Please select an inspection rating or N/A for all items");
            const scrollId = getFirstMissingPFScrollId();
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
            // ฟอร์มนี้มีแค่ Post-PM — ไม่มีด่านก่อนหน้าที่สร้าง report_id ให้
            // ใบใหม่ให้ backend สร้างรายงานตอนกดบันทึก — ถ้าเคยกดแล้วอัปรูปหลุด ใช้ id เดิมจาก draft กันได้รายงานซ้ำ
            let finalReportId: string = reportId || editId || loadDraftLocal<any>(postKey)?.pendingReportId || "";
            const flatRows = flattenRows(rows);
            const payload = {
                station_id: stationId, ...(jobId ? { job_id: jobId } : {}), inspector, job: { station_name: job.station_name, date: job.date }, ...(job.date ? { pm_date: job.date } : {}), rows: flatRows, summary,
                ...(summaryCheck ? { summaryCheck } : {}), ...(jobId ? {} : { work_start: workStart, work_finish: workFinish, maximo_labor: maximoLabor, maximo_contractor: contractorPicked ? maximoContractor.trim() : "" }), wonum: searchParams.get("wonum") ?? "", side: "post", ...(finalReportId ? { report_id: finalReportId } : {}),
            };
            const res = await fetch(`${API_BASE}/stationpmreport/submit`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                credentials: "include", body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const { report_id } = await res.json() as { report_id: string };
            if (!finalReportId) {
                finalReportId = report_id;
                setReportId(report_id);
                saveDraftLocal(postKey, { ...loadDraftLocal<any>(postKey), pendingReportId: report_id });
            }

            // ต้องยืนยันรูปครบก่อน ถึงจะ finalize + ลบรูปในเครื่อง
            // แก้ส่วนที่ส่งแล้ว: รูปเดิมที่กดลบออก ลบออกจากเอกสารจริงก่อน แล้วค่อยอัปรูปใหม่
            if (jobId) {
                await deleteRemovedServerPhotos(apiFetch, {
                    jobId, stationId: stationId ?? "", section: "station", reportId: finalReportId,
                    original: serverPhotosRef.current, current: photosRef.current as any,
                });
                serverPhotosRef.current = {};
            }
            if (!(await syncPhotosAndVerify(finalReportId))) return;

            if (!jobId && (!workStart || !workFinish)) { alert(t("alertWorkTime", lang)); setSubmitting(false); return; }
            if (!jobId && contractorMissing) { alert(t("contractorRequired", lang)); setSubmitting(false); return; }
            if (!jobId && workFinish < workStart) { alert(t("alertWorkTimeOrder", lang)); setSubmitting(false); return; }
            // Maximo ตีกลับ IN09 ด้วย BMXAA2641E ถ้าเวลาทำงานยังมาไม่ถึง
            // ปล่อยผ่านตรงนี้ = ปิดใบงานได้แต่ปิด WO ในระบบเขาไม่ได้ ต้องมาแก้ย้อนหลัง
            const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                .toISOString().slice(0, 16);
            if (!jobId && (workStart > nowLocal || workFinish > nowLocal)) { alert(t("alertWorkTimeFuture", lang)); setSubmitting(false); return; }

            const finalizeRes = await fetch(`${API_BASE}/stationpmreport/${finalReportId}/finalize`, {
                method: "POST",
                credentials: "include", body: new URLSearchParams({ station_id: stationId }),
            });
            if (!finalizeRes.ok) throw new Error(await finalizeRes.text());

            const allPhotos = Object.values(photosRef.current).flat();
            await Promise.all(allPhotos.map(p => delPhoto(postKey, p.id)));
            draftClearedRef.current = true; // กัน autosave ที่ค้างอยู่เขียน draft กลับมาหลังล้าง
            await clearDraftLocal(postKey);
            // กลับหน้าที่เปิดเข้ามา (หน้ารวมของใบ PM สถานี / PM List) — ไม่มีก็ไปตารางใบ PM ของสถานี
            router.replace(pmFormReturnRoute(searchParams) ?? `/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&tab=station`);
        } catch (err: any) {
            alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`);
        } finally {
            setSubmitting(false);
        }
    };

    const renderQuestionBlock = (q: Question) => {
        if (q.kind === "simple") {
            return (
                <SectionCard key={q.key} title={getQuestionLabel(q, lang)}>
                    <PassFailRow label={t("testResult", lang)} value={rows[q.key]?.pf ?? ""} lang={lang} showPfButtons={!q.key.startsWith("pre_")}
                        onChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })}
                        remark={rows[q.key]?.remark || ""}
                        onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })}
                        id={getPfIdFromKey(q.key)}
                        remarkId={getRemarkIdFromKey(q.key)}
                        aboveRemark={q.hasPhoto && (
                            <div className="tw-pb-4 tw-border-b tw-mb-4 tw-border-gray-100">
                                    <PhotoMultiInput photos={photos[`q${q.no}`] || []} setPhotos={makePhotoSetter(`q${q.no}`)} max={10} draftKey={postKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(`q${q.no}`)} />
                            </div>
                        )}
                    />
                </SectionCard>
            );
        }

        // Group type
        return (
            <SectionCard key={q.key} title={getQuestionLabel(q, lang)}>
                {q.items.map((item, idx) => {
                    return (
                        <div key={item.key} className={`tw-py-4 ${idx !== q.items.length - 1 ? "tw-border-b tw-border-gray-200" : ""}`}>
                            <PassFailRow label={getDisplayedItemLabel(item.label[lang], q.no)} value={rows[item.key]?.pf ?? ""} lang={lang}
                                onChange={(v) => setRows({ ...rows, [item.key]: { ...rows[item.key], pf: v } })}
                                remark={rows[item.key]?.remark || ""}
                                onRemarkChange={(v) => setRows({ ...rows, [item.key]: { ...rows[item.key], remark: v } })}
                                id={getPfIdFromKey(item.key)}
                                remarkId={getRemarkIdFromKey(item.key)}
                                aboveRemark={q.hasPhoto && (
                                    <div className="tw-pb-4 tw-border-b tw-mb-4 tw-border-gray-100">
                                        <PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={postKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(item.key)} />
                                    </div>
                                )}
                            />
                        </div>
                    );
                })}
            </SectionCard>
        );
    };

    useEffect(() => { void prefetchLocation(); }, []);



    // กล่องหมายเหตุ + สรุปผลการตรวจสอบ — ประกาศครั้งเดียว วางได้สองที่
    // ตอนกรอกอยู่ในฟอร์มตามเดิม ตอนตรวจย้ายลงไปล่างสุดใต้ตารางผลการตรวจ
    const summaryBlock = (
                        <div id={`${ID_PREFIX}-summary-section`} className="tw-mt-6 sm:tw-mt-8 tw-space-y-3">
                            <Typography variant="h6" className="tw-mb-1 tw-text-sm sm:tw-text-base">{t("comment", lang)}</Typography>
                            <Textarea label={t("comment", lang)} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} required autoComplete="off" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-text-sm resize-none" />
                            <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-200">
                                <PassFailRow label={t("summaryResult", lang)} value={summaryCheck} onChange={(v) => setSummaryCheck(v)} lang={lang}
                                    labels={{ PASS: t("summaryPassLabel", lang), FAIL: t("summaryFailLabel", lang), NA: t("summaryNALabel", lang) }} />
                            </div>
                        </div>
    );

    return (
        <section className="tw-pb-24">
            <div className="tw-mx-auto tw-max-w-6xl tw-flex tw-items-center tw-justify-between tw-mb-4">
                <Button variant="outlined" size="sm" onClick={goBackToList} title={t("backToList", lang)}>
                    <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-gray-900 tw-stroke-2" />
                </Button>
                <Tabs value="post">
                    <TabsHeader className="tw-bg-gray-50 tw-rounded-lg">
                        <Tab value="post" className="tw-px-4 tw-py-2 tw-font-medium">Post‑PM</Tab>
                    </TabsHeader>
                </Tabs>
            </div>

            
            <form action="#" noValidate onSubmit={(e) => { e.preventDefault(); return false; }} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
                <div className="tw-mx-auto tw-max-w-6xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-sm tw-p-6 md:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0">
                {/* ดูอย่างเดียว: fieldset ปิดช่องกรอกทั้งหมด — แถวปุ่มบันทึก/แก้ไขอยู่นอก fieldset ปุ่มแก้ไขจะได้กดได้ */}
                <fieldset disabled={reviewMode} className="pm-readonly tw-m-0 tw-min-w-0 tw-border-0 tw-p-0">
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
                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            <div className="lg:tw-col-span-1"><Input label={t("issueId", lang)} value={job.issue_id || "-"} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-bg-blue-gray-50" /></div>
                            <div className="sm:tw-col-span-2 lg:tw-col-span-2"><Input label={t("location", lang)} value={job.station_name} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="sm:tw-col-span-2 lg:tw-col-span-2"><Input label={t("inspector", lang)} value={inspector} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-1"><Input label={t("pmDate", lang)} type="text" value={job.date} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                        </div>
                    </div>

                    <div className="tw-mt-6 sm:tw-mt-8 tw-space-y-4 sm:tw-space-y-6">
                        {/* หน้าดูใช้ฟอร์มเดียวกับตอนกรอก — fieldset ล็อกไม่ให้แก้ */}
                        <fieldset disabled={reviewMode} className="pm-readonly tw-m-0 tw-min-w-0 tw-border-0 tw-p-0 tw-space-y-4 sm:tw-space-y-6">{QUESTIONS.map((q) => renderQuestionBlock(q))}</fieldset>
                    </div>

                    {summaryBlock}

                    <div className="tw-mt-6 sm:tw-mt-8 tw-flex tw-flex-col tw-gap-3">
                    {/* ใบที่เป็นส่วนหนึ่งของใบ PM สถานี: เวลาทำงาน/ช่างที่ลงเวลา Maximo กรอกครั้งเดียวตอนกด
                        "ปิดใบงาน" ที่หน้ารวมของใบ — ไม่ต้องกรอกซ้ำทุกส่วน (ใบเดี่ยวรุ่นเก่ายังกรอกที่นี่) */}
                    {!jobId && (<>
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
                    </>)}

                        {/* โหมดตรวจไม่ต้องมี ฟอร์มฝั่งช่างดักความครบถ้วนไว้ตั้งแต่ตอนกรอกแล้ว */}
                        {!reviewMode && (
                            <PMValidationCard
                                lang={lang}
                                allPhotosAttached={allPhotosAttached}
                                missingPhotoItems={missingPhotoItems}
                                allPFAnswered={allPFAnswered}
                                missingPFItems={missingPFItems}
                                isSummaryFilled={isSummaryFilled}
                                isSummaryCheckFilled={isSummaryCheckFilled}
                            />
                        )}
                    </div>
                </fieldset>
                    {/* หน้าดูข้อมูล: ปุ่มแก้ไข (ถ้ามีสิทธิ์) อยู่ตำแหน่งเดียวกับปุ่มบันทึกของหน้ากรอก */}
                    {(!reviewMode || reviewAction) && (
                        <div className="tw-mt-3 tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-2 sm:tw-gap-3">
                            {reviewMode ? reviewAction : (
                                <Button type="button" onClick={onFinalSave} disabled={!canFinalSave || submitting}
                                    className="tw-text-sm tw-py-2.5 tw-bg-gray-800 hover:tw-bg-gray-900"
                                    title={!canFinalSave ? t("alertCompleteAll", lang) : undefined}>
                                    {submitting ? t("saving", lang) : t("save", lang)}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </form>
            {/* ตรวจเสร็จแล้วกดต่อได้เลย ไม่ต้องเลื่อนกลับขึ้นไปข้างบน */}
            {approveMode && editId && (
                <div id="pm-approve-bottom" className="tw-mx-auto tw-max-w-6xl tw-mt-6 tw-flex tw-items-center tw-justify-end tw-gap-2 tw-border-t tw-border-blue-gray-100 tw-pt-5">
                    <PmApprovalBar
                        prefix="stationpmreport" reportId={editId}
                        scope={{ station_id: stationId }}
                        apiBase={API_BASE}
                        onDone={(msg) => { alert(msg); goBackToList(); }}
                    />
                </div>
            )}
        </section>
    );
}
