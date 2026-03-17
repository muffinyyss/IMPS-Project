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
import { draftKey, saveDraftLocal, loadDraftLocal, clearDraftLocal } from "../lib/draft";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Tabs, TabsHeader, Tab } from "@material-tailwind/react";
import { putPhoto, getPhoto, delPhoto, type PhotoRef } from "../lib/draftPhotos";
import { useLanguage, type Lang } from "@/utils/useLanguage";

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
    summaryPassLabel: { th: "Pass : ผ่าน", en: "Pass" },
    summaryFailLabel: { th: "Fail : ไม่ผ่าน", en: "Fail" },
    summaryNALabel: { th: "N/A : ไม่พบ", en: "N/A" },

    // Validation Sections
    validationPhotoTitle: { th: "1) ตรวจสอบการแนบรูปภาพ (ทุกข้อ)", en: "1) Photo Attachments (all items)" },
    validationRemarkTitle: { th: "2) หมายเหตุ (ทุกข้อ)", en: "2) Remarks (all items)" },
    validationPFTitle: { th: "2) สถานะ PASS / FAIL / N/A ทั้ง 11 ข้อ", en: "2) PASS / FAIL / N/A for all 11 items" },
    validationRemarkTitlePost: { th: "3) หมายเหตุ (ทุกข้อ)", en: "3) Remarks (all items)" },
    validationSummaryTitle: { th: "4) สรุปผลการตรวจสอบ", en: "4) Inspection Summary" },

    // Validation Messages
    allComplete: { th: "ครบเรียบร้อย ✅", en: "Complete ✅" },
    missingPhoto: { th: "ยังไม่ได้แนบรูปข้อ:", en: "Missing photos for:" },
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
    alertFillPhoto: { th: "กรุณาแนบรูปในทุกข้อก่อนบันทึก", en: "Please attach photos for all items" },
    alertFillPreFirst: { th: "กรุณากรอกข้อมูลในส่วน Pre-PM ให้ครบก่อน", en: "Please complete all Pre-PM fields first" },
    alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },
    alertCompleteAll: { th: "กรุณากรอกข้อมูลและแนบรูปให้ครบก่อนบันทึก", en: "Please complete all fields and attach photos before saving" },
    alertPhotoNotComplete: { th: "กรุณาแนบรูปในส่วน Pre-PM ให้ครบก่อน", en: "Please attach all photos in Pre-PM section" },
    alertFillRemark: { th: "กรุณากรอกหมายเหตุข้อ:", en: "Please fill in remarks for:" },
    noReportId: { th: "ไม่มี report_id - กรุณาบันทึกข้อมูล Pre-PM ก่อน", en: "No report_id - Please save Pre-PM first" },
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

type TabId = "pre" | "post";
const TABS: { id: TabId; label: string; slug: "pre" | "post" }[] = [
    { id: "pre", label: "Pre\u2011PM", slug: "pre" },
    { id: "post", label: "Post\u2011PM", slug: "post" },
];
function slugToTab(slug: string | null): TabId {
    switch (slug) {
        case "post": return "post";
        case "pre":
        default: return "pre";
    }
}
function tabToSlug(tab: TabId): "pre" | "post" {
    return TABS.find(t => t.id === tab)!.slug;
}

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

type PhotoItem = { id: string; file?: File; preview?: string; remark?: string; uploading?: boolean; error?: string; ref?: PhotoRef; isNA?: boolean; };
type PF = "PASS" | "FAIL" | "NA" | "";

type Question =
    | { no: number; key: `r${number}`; label: { th: string; en: string }; labelPre?: { th: string; en: string }; labelPost?: { th: string; en: string }; kind: "simple"; hasPhoto?: boolean; tooltip?: { th: string; en: string } }
    | { no: number; key: `r${number}`; label: { th: string; en: string }; labelPre?: { th: string; en: string }; labelPost?: { th: string; en: string }; kind: "group"; items: { key: string; label: { th: string; en: string } }[]; hasPhoto?: boolean; tooltip?: { th: string; en: string } };

const QUESTIONS_RAW = [
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

function getQuestionLabel(q: Question, mode: TabId, lang: Lang): string {
    const baseLabel = q.label[lang];
    if (mode === "pre") return lang === "th" ? `${baseLabel} (ก่อน PM)` : `${baseLabel} (Pre-PM)`;
    return lang === "th" ? `${baseLabel} (หลัง PM)` : `${baseLabel} (Post-PM)`;
}

function useDebouncedEffect(effect: () => void, deps: any[], delay = 800) {
    useEffect(() => { const h = setTimeout(effect, delay); return () => clearTimeout(h); }, deps);
}

// ==================== SectionCard ====================
function SectionCard({ title, subtitle, children, tooltip }: { title?: string; subtitle?: string; children: React.ReactNode; tooltip?: string }) {
    const qNumber = title?.match(/^(\d+)\./)?.[1];
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
                            {qNumber ? title.replace(/^\d+\.\s*/, '') : title}
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
    displayTab: "pre" | "post";
    isPostMode: boolean;
    allPhotosAttached: boolean;
    missingPhotoItems: string[];
    allRemarksFilledPre: boolean;
    missingRemarksPre: string[];
    allPFAnswered: boolean;
    missingPFItems: string[];
    allRemarksFilledPost: boolean;
    missingRemarksPost: string[];
    isSummaryFilled: boolean;
    isSummaryCheckFilled: boolean;
}

function PMValidationCard({
    lang, displayTab, isPostMode,
    allPhotosAttached, missingPhotoItems,
    allRemarksFilledPre, missingRemarksPre,
    allPFAnswered, missingPFItems,
    allRemarksFilledPost, missingRemarksPost,
    isSummaryFilled, isSummaryCheckFilled,
}: PMValidationCardProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    const getPhotoScrollId = (item: string): string => {
        // "1" -> station-pm-photo-1, "7.1" -> station-pm-photo-7-1
        const parts = item.split(".");
        if (parts.length === 2) return `${ID_PREFIX}-photo-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-photo-${parts[0]}`;
    };

    const getRemarkScrollId = (item: string): string => {
        // "1" -> station-pm-remark-1, "7.1" -> station-pm-remark-7-1
        const parts = item.split(".");
        if (parts.length === 2) return `${ID_PREFIX}-remark-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-remark-${parts[0]}`;
    };

    const getPfScrollId = (item: string): string => {
        // "1" -> station-pm-pf-1, "7.1" -> station-pm-pf-7-1
        const parts = item.split(".");
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

        // 2) Remark errors (Pre mode)
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

        // 3) Post mode errors
        if (isPostMode) {
            // PF status errors
            if (!allPFAnswered) {
                missingPFItems.forEach((item) => {
                    errors.push({
                        section: lang === "th" ? "สถานะ Pass/Fail" : "Pass/Fail Status",
                        sectionIcon: "✅",
                        itemName: `${t("itemLabel", lang)} ${item}`,
                        message: lang === "th" ? "ยังไม่ได้เลือก Pass/Fail" : "Pass/Fail not selected",
                        scrollId: getPfScrollId(item),
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
        allRemarksFilledPre, missingRemarksPre,
        allPFAnswered, missingPFItems,
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
    label, value, onChange, remark, onRemarkChange, labels, aboveRemark, beforeRemark, inlineLeft, lang, id, remarkId,
}: {
    label: string; value: PF; onChange: (v: Exclude<PF, "">) => void;
    remark?: string; onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
    aboveRemark?: React.ReactNode; beforeRemark?: React.ReactNode; inlineLeft?: React.ReactNode; lang: Lang;
    id?: string; remarkId?: string;
}) {
    const text = { PASS: labels?.PASS ?? t("pass", lang), FAIL: labels?.FAIL ?? t("fail", lang), NA: labels?.NA ?? t("na", lang) };
    const buttonGroup = (
        <div id={id} className="tw-flex tw-gap-2 tw-ml-auto">
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
                    <div id={remarkId}>
                        <Textarea label={t("remark", lang)} value={remark || ""} onChange={(e) => onRemarkChange(e.target.value)}
                            containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full" />
                    </div>
                </div>
            ) : (
                <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">{buttonsRow}</div>
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
        <div id={id} className="tw-space-y-3">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2">
                <Button size="sm" color="blue" variant="outlined" onClick={handlePick} className="tw-shrink-0">{t("attachPhoto", lang)}</Button>
            </div>
            <Typography variant="small" className="!tw-text-gray-500 tw-flex tw-items-center">
                {t("maxPhotos", lang)} {max} {t("photos", lang)} • {t("cameraSupported", lang)}
            </Typography>
            <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="tw-hidden" onChange={(e) => { void handleFiles(e.target.files); }} />
            {photos.length > 0 ? (
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                    {photos.map((p) => (
                        <div key={p.id} className="tw-border tw-rounded-lg tw-overflow-hidden tw-bg-white tw-shadow-xs tw-flex tw-flex-col">
                            <div className="tw-relative tw-aspect-[4/3] tw-bg-gray-50">
                                {p.preview && <img src={p.preview} alt="preview" className="tw-w-full tw-h-full tw-object-cover" />}
                                <button onClick={() => { void handleRemove(p.id); }}
                                    className="tw-absolute tw-top-2 tw-right-2 tw-bg-red-500 tw-text-white tw-w-6 tw-h-6 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-shadow-md hover:tw-bg-red-600 tw-transition-colors">×</button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Typography variant="small" className="!tw-text-gray-500">{t("noPhotos", lang)}</Typography>
            )}
        </div>
    );
}

function SkippedNAItem({ label, remark, lang }: { label: string; remark?: string; lang: Lang }) {
    return (
        <div className="tw-py-4 tw-bg-amber-50/50">
            <div className="tw-flex tw-items-center tw-justify-between">
                <Typography className="tw-font-semibold tw-text-sm tw-text-gray-800">{label}</Typography>
                <span className="tw-text-xs tw-text-amber-600 tw-font-medium">N/A</span>
            </div>
            {remark && (
                <Typography variant="small" className="tw-text-gray-600 tw-mt-1">
                    {t("remarkLabel", lang)}: {remark}
                </Typography>
            )}
        </div>
    );
}

async function fetchPreviewIssueId(stationId: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/stationpmreport/preview-issueid`);
    u.searchParams.set("station_id", stationId);
    u.searchParams.set("pm_date", pmDate);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
    const r = await fetch(u.toString(), { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && typeof j.issue_id === "string") ? j.issue_id : null;
}

async function fetchPreviewDocName(stationId: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/stationpmreport/preview-docname`);
    u.searchParams.set("station_id", stationId);
    u.searchParams.set("pm_date", pmDate);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
    const r = await fetch(u.toString(), { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && typeof j.doc_name === "string") ? j.doc_name : null;
}

async function fetchReport(reportId: string, stationId: string) {
    const token = localStorage.getItem("access_token") ?? "";
    const url = `${API_BASE}/stationpmreport/get?station_id=${stationId}&report_id=${reportId}`;
    const res = await fetch(url, { method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: "include" });
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

    const pathname = usePathname();
    const searchParams = useSearchParams();
    const editId = searchParams.get("edit_id") ?? "";
    const action = searchParams.get("action");
    const isPostMode = action === "post";

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

    const [summary, setSummary] = useState<string>("");
    const [stationId, setStationId] = useState<string | null>(null);

    // Separate draft keys for Pre and Post mode
    const key = useMemo(() => draftKey(stationId), [stationId]);
    const postKey = useMemo(() => `${draftKey(stationId)}:${editId}:post`, [stationId, editId]);
    const currentDraftKey = isPostMode ? postKey : key;

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
    const [inspector, setInspector] = useState<string>("");
    const [postApiLoaded, setPostApiLoaded] = useState(false);
    const [commentPre, setCommentPre] = useState<string>("");

    const [job, setJob] = useState({ issue_id: "", station_name: "", date: "" });

    // All keys for rows (simple + group items)
    const ALL_KEYS = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") { keys.push(q.key); }
            else if (q.kind === "group") { q.items.forEach((item) => { keys.push(item.key); }); }
        });
        return keys;
    }, []);

    const [rowsPre, setRowsPre] = useState<Record<string, { pf: PF; remark: string }>>({});
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
        if (!isPostMode || !editId || !stationId) return;
        setPostApiLoaded(false);
        (async () => {
            try {
                const data = await fetchReport(editId, stationId);
                if (data.job) setJob(prev => ({ ...prev, ...data.job, issue_id: data.issue_id ?? prev.issue_id }));
                if (data.pm_date) setJob(prev => ({ ...prev, date: data.pm_date }));
                if (data.doc_name) setDocName(data.doc_name);
                if (data.inspector) setInspector(data.inspector);
                if (data.comment_pre) setCommentPre(data.comment_pre);
                if (data.summary) setSummary(data.summary);
                if (data.rows_pre) { setRowsPre(data.rows_pre); }
                if (data.rows) {
                    setRows((prev) => { const next = { ...prev }; Object.entries(data.rows).forEach(([k, v]) => { next[k] = v as { pf: PF; remark: string }; }); return next; });
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

    // Load draft for Post mode (AFTER API data loaded)
    useEffect(() => {
        if (!isPostMode || !stationId || !editId || !postApiLoaded) return;
        const postDraft = loadDraftLocal<{
            rows: typeof rows; summary: string; summaryCheck?: PF;
            photoRefs?: Record<string, (PhotoRef | { isNA: true })[]>;
        }>(postKey);
        if (!postDraft) return;
        if (postDraft.rows) setRows(prev => ({ ...prev, ...postDraft.rows }));
        if (postDraft.summary) setSummary(postDraft.summary);
        if (postDraft.summaryCheck) setSummaryCheck(postDraft.summaryCheck);
        (async () => {
            if (!postDraft.photoRefs) return;
            const next: Record<string, PhotoItem[]> = { ...initialPhotos };
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
            if (Object.keys(next).some(k => (next[k]?.length ?? 0) > 0)) setPhotos(prev => ({ ...prev, ...next }));
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

    useEffect(() => {
        if (isPostMode || !stationId || !job.date) return;
        let canceled = false;
        (async () => {
            try {
                const preview = await fetchPreviewIssueId(stationId, job.date);
                if (!canceled && preview) setJob(prev => ({ ...prev, issue_id: preview }));
            } catch (err) { console.error("preview issue_id error:", err); }
        })();
        return () => { canceled = true; };
    }, [stationId, job.date, isPostMode]);

    useEffect(() => {
        if (isPostMode || !stationId || !job.date) return;
        let canceled = false;
        (async () => {
            try {
                const preview = await fetchPreviewDocName(stationId, job.date);
                if (!canceled && preview) setDocName(preview);
            } catch (err) { console.error("preview docName error:", err); }
        })();
        return () => { canceled = true; };
    }, [stationId, job.date, isPostMode]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sid = params.get("station_id") || localStorage.getItem("selected_station_id");
        if (sid) setStationId(sid);
        if (!sid || isPostMode) return;
        getStationInfoPublic(sid)
            .then((st) => { setJob((prev) => ({ ...prev, station_name: st.station_name ?? prev.station_name, date: prev.date || new Date().toISOString().slice(0, 10) })); })
            .catch((err) => console.error("load public station info failed:", err));
    }, [isPostMode]);

    // Load draft for Pre mode only
    useEffect(() => {
        if (!stationId || isPostMode) return;
        const draft = loadDraftLocal<{
            rows: typeof rows; summary: string; summary_pf?: PF; inspector?: string;
            photoRefs?: Record<string, (PhotoRef | { isNA: true })[]>;
        }>(key);
        if (!draft) return;
        setRows(draft.rows);
        setSummary(draft.summary);
        setSummaryCheck(draft.summary_pf ?? "");
        setInspector(draft.inspector ?? "");
        (async () => {
            if (!draft.photoRefs) return;
            const next: Record<string, PhotoItem[]> = { ...initialPhotos };
            for (const [photoKey, refs] of Object.entries(draft.photoRefs)) {
                const items: PhotoItem[] = [];
                for (const ref of refs || []) {
                    if ('isNA' in ref && ref.isNA) { items.push({ id: `${photoKey}-NA-restored`, isNA: true, preview: undefined }); continue; }
                    if (!('id' in ref) || !ref.id) continue;
                    const file = await getPhoto(key, ref.id);
                    if (!file) continue;
                    items.push({ id: ref.id, file, preview: URL.createObjectURL(file), remark: (ref as any).remark ?? "", ref: ref as PhotoRef });
                }
                if (items.length > 0) next[photoKey] = items;
            }
            setPhotos(next);
        })();
    }, [stationId, key, isPostMode]);

    useEffect(() => {
        const onInfo = (e: Event) => {
            const detail = (e as CustomEvent).detail as { info?: StationPublic; station?: StationPublic };
            const st = detail.info ?? detail.station;
            if (!st) return;
            setJob((prev) => ({ ...prev, station_name: st.station_name ?? prev.station_name }));
        };
        window.addEventListener("station:info", onInfo as EventListener);
        return () => window.removeEventListener("station:info", onInfo as EventListener);
    }, []);

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
    const REQUIRED_PHOTO_KEYS_PRE = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.filter((q) => q.hasPhoto && q.no !== 11).forEach((q) => {  // ข้อ 11 = ทำความสะอาด ไม่ต้องแนบรูปใน Pre
            if (q.kind === "group") { q.items.forEach((item) => { keys.push(item.key); }); }
            else { keys.push(`q${q.no}`); }
        });
        return keys;
    }, []);

    const REQUIRED_PHOTO_KEYS_POST = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.filter((q) => q.hasPhoto).forEach((q) => {
            if (q.kind === "group") { q.items.forEach((item) => { keys.push(item.key); }); }
            else { keys.push(`q${q.no}`); }
        });
        return keys;
    }, []);

    const missingPhotoItemsPre = useMemo(() => {
        const missingKeys = REQUIRED_PHOTO_KEYS_PRE.filter((photoKey) => {
            const qKey = photoKey.startsWith("q") ? `r${photoKey.substring(1)}` : photoKey.replace(/_\d+$/, "");
            if (rows[qKey]?.pf === "NA") return false;
            const match = photoKey.match(/^r(\d+)_/);
            if (match) {
                if (rows[photoKey]?.pf === "NA") return false;
            }
            return (photos[photoKey]?.length ?? 0) < 1;
        });
        return missingKeys.map((key) => {
            if (key.startsWith("q")) return key.substring(1);
            const match = key.match(/^r(\d+)_(\d+)$/);
            if (match) return `${match[1]}.${match[2]}`;
            return key.replace("r", "");
        }).sort((a, b) => {
            const aParts = String(a).split(".").map(Number);
            const bParts = String(b).split(".").map(Number);
            if (aParts[0] !== bParts[0]) return aParts[0] - bParts[0];
            return (aParts[1] ?? 0) - (bParts[1] ?? 0);
        });
    }, [REQUIRED_PHOTO_KEYS_PRE, photos, rows]);

    const missingPhotoItemsPost = useMemo(() => {
        const missingKeys = REQUIRED_PHOTO_KEYS_POST.filter((photoKey) => {
            const match = photoKey.match(/^r(\d+)_/);
            if (match) {
                if (rowsPre[photoKey]?.pf === "NA") return false;
            } else {
                const qKey = photoKey.startsWith("q") ? `r${photoKey.substring(1)}` : photoKey;
                if (rowsPre[qKey]?.pf === "NA") return false;
            }
            return (photos[photoKey]?.length ?? 0) < 1;
        });
        return missingKeys.map((key) => {
            if (key.startsWith("q")) return key.substring(1);
            const match = key.match(/^r(\d+)_(\d+)$/);
            if (match) return `${match[1]}.${match[2]}`;
            return key.replace("r", "");
        }).sort((a, b) => {
            const aParts = String(a).split(".").map(Number);
            const bParts = String(b).split(".").map(Number);
            if (aParts[0] !== bParts[0]) return aParts[0] - bParts[0];
            return (aParts[1] ?? 0) - (bParts[1] ?? 0);
        });
    }, [REQUIRED_PHOTO_KEYS_POST, photos, rowsPre]);

    const allPhotosAttachedPre = missingPhotoItemsPre.length === 0;
    const allPhotosAttachedPost = missingPhotoItemsPost.length === 0;
    const missingPhotoItems = isPostMode ? missingPhotoItemsPost : missingPhotoItemsPre;
    const allPhotosAttached = isPostMode ? allPhotosAttachedPost : allPhotosAttachedPre;

    // PF validation (for Post mode)
    const PF_REQUIRED_KEYS = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") { keys.push(q.key); }
            else if (q.kind === "group") { q.items.forEach((item) => { keys.push(item.key); }); }
        });
        return keys;
    }, []);

    const PF_KEYS_POST = useMemo(() => PF_REQUIRED_KEYS.filter((k) => {
        if (rowsPre[k]?.pf === "NA") return false;
        return true;
    }), [PF_REQUIRED_KEYS, rowsPre]);

    const allPFAnswered = useMemo(() => PF_KEYS_POST.every((k) => rows[k]?.pf !== ""), [rows, PF_KEYS_POST]);

    const missingPFItems = useMemo(() => PF_KEYS_POST.filter((k) => !rows[k]?.pf).map((k) => {
        const match = k.match(/^r(\d+)(?:_(\d+))?$/);
        if (!match) return k;
        const [, qNo, subNo] = match;
        return subNo ? `${qNo}.${subNo}` : qNo;
    }).sort((a, b) => {
        const aParts = String(a).split(".").map(Number);
        const bParts = String(b).split(".").map(Number);
        if (aParts[0] !== bParts[0]) return aParts[0] - bParts[0];
        return (aParts[1] ?? 0) - (bParts[1] ?? 0);
    }), [rows, PF_KEYS_POST]);

    // Remark validation for Pre mode
    const validRemarkKeysPre = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.filter((q) => q.no !== 11).forEach((q) => {
            if (q.kind === "simple") { keys.push(q.key); }
            else if (q.kind === "group") { q.items.forEach((item) => { keys.push(item.key); }); }
        });
        return keys;
    }, []);

    const missingRemarksPre = useMemo(() => {
        const missing: string[] = [];
        validRemarkKeysPre.forEach((key) => {
            const val = rows[key];
            if (val?.pf === "NA") return;
            if (!val?.remark?.trim()) {
                const match = key.match(/^r(\d+)(?:_(\d+))?$/);
                if (match) {
                    const [, qNo, subNo] = match;
                    missing.push(subNo ? `${qNo}.${subNo}` : qNo);
                }
            }
        });
        return missing.sort((a, b) => {
            const aParts = String(a).split(".").map(Number);
            const bParts = String(b).split(".").map(Number);
            if (aParts[0] !== bParts[0]) return aParts[0] - bParts[0];
            return (aParts[1] ?? 0) - (bParts[1] ?? 0);
        });
    }, [rows, validRemarkKeysPre]);
    const allRemarksFilledPre = missingRemarksPre.length === 0;

    // Remark validation for Post mode
    const validRemarkKeysPost = useMemo(() => {
        return PF_REQUIRED_KEYS.filter((k) => {
            if (rowsPre[k]?.pf === "NA") return false;
            return true;
        });
    }, [PF_REQUIRED_KEYS, rowsPre]);

    const missingRemarksPost = useMemo(() => {
        const missing: string[] = [];
        validRemarkKeysPost.forEach((key) => {
            const val = rows[key];
            if (!val?.remark?.trim()) {
                const match = key.match(/^r(\d+)(?:_(\d+))?$/);
                if (match) {
                    const [, qNo, subNo] = match;
                    missing.push(subNo ? `${qNo}.${subNo}` : qNo);
                }
            }
        });
        return missing.sort((a, b) => {
            const aParts = String(a).split(".").map(Number);
            const bParts = String(b).split(".").map(Number);
            if (aParts[0] !== bParts[0]) return aParts[0] - bParts[0];
            return (aParts[1] ?? 0) - (bParts[1] ?? 0);
        });
    }, [rows, validRemarkKeysPost]);
    const allRemarksFilledPost = missingRemarksPost.length === 0;

    const isSummaryFilled = summary.trim().length > 0;
    const isSummaryCheckFilled = summaryCheck !== "";

    const canGoAfter: boolean = isPostMode ? true : (allPhotosAttachedPre && allRemarksFilledPre);
    const canFinalSave = allPhotosAttachedPost && allPFAnswered && allRemarksFilledPost && isSummaryFilled && isSummaryCheckFilled;

    // Helper functions for scroll IDs
    const getFirstMissingPhotoScrollId = (): string | null => {
        if (missingPhotoItems.length === 0) return null;
        const first = missingPhotoItems[0];
        const parts = first.split(".");
        if (parts.length === 2) return `${ID_PREFIX}-photo-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-photo-${parts[0]}`;
    };

    const getFirstMissingRemarkScrollId = (): string | null => {
        const missing = isPostMode ? missingRemarksPost : missingRemarksPre;
        if (missing.length === 0) return null;
        const first = missing[0];
        const parts = first.split(".");
        if (parts.length === 2) return `${ID_PREFIX}-remark-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-remark-${parts[0]}`;
    };

    const getFirstMissingPFScrollId = (): string | null => {
        if (missingPFItems.length === 0) return null;
        const first = missingPFItems[0];
        const parts = first.split(".");
        if (parts.length === 2) return `${ID_PREFIX}-pf-${parts[0]}-${parts[1]}`;
        return `${ID_PREFIX}-pf-${parts[0]}`;
    };

    // Photo refs for draft
    const photoRefs = useMemo(() => {
        const out: Record<string, (PhotoRef | { isNA: true })[]> = {};
        Object.entries(photos).forEach(([photoKey, list]) => {
            out[photoKey] = (list || []).map(p => p.isNA ? { isNA: true } : p.ref).filter(Boolean) as (PhotoRef | { isNA: true })[];
        });
        return out;
    }, [photos]);

    // Save draft for Pre mode
    useDebouncedEffect(() => {
        if (!stationId || isPostMode) return;
        saveDraftLocal(key, { rows, summary, summary_pf: summaryCheck, photoRefs, });
    }, [key, stationId, rows, summary, summaryCheck, photoRefs, isPostMode, inspector]);

    // Save draft for Post mode
    useDebouncedEffect(() => {
        if (!stationId || !isPostMode || !editId) return;
        saveDraftLocal(postKey, { rows, summary, summaryCheck, photoRefs });
    }, [postKey, stationId, rows, summary, summaryCheck, photoRefs, isPostMode, editId]);

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

    async function uploadGroupPhotos(reportId: string, stationId: string, group: string, files: File[], side: TabId) {
        if (files.length === 0) return;
        const compressedFiles = await Promise.all(files.map(f => compressImage(f)));
        const form = new FormData();
        form.append("station_id", stationId);
        form.append("group", group);
        form.append("side", side);
        compressedFiles.forEach((f) => form.append("files", f));
        const token = localStorage.getItem("access_token");
        const url = side === "pre" ? `${API_BASE}/stationpmreport/${reportId}/pre/photos` : `${API_BASE}/stationpmreport/${reportId}/post/photos`;
        const res = await fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form, credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
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

    const onPreSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }
        
        // Validation checks with scroll to error
        if (!allPhotosAttachedPre) { 
            alert(t("alertFillPhoto", lang)); 
            const scrollId = getFirstMissingPhotoScrollId();
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
            const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
            const flatRows = flattenRows(rows);
            const payload = {
                station_id: stationId, issue_id: issueIdFromJob, job: jobWithoutIssueId, inspector,
                rows_pre: flatRows, pm_date, doc_name: docName, side: "pre" as TabId,
                comment_pre: summary,
            };
            const res = await fetch(`${API_BASE}/stationpmreport/pre/submit`, {
                method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include", body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const { report_id, doc_name } = await res.json() as { report_id: string; doc_name?: string };
            setReportId(report_id);
            if (doc_name) setDocName(doc_name);

            // Upload photos
            const photoKeys = Object.keys(photos);
            const uploadPromises: Promise<void>[] = [];
            for (const photoKey of photoKeys) {
                const list = photos[photoKey] || [];
                if (list.length === 0) continue;
                const files = list.map(p => p.file!).filter(Boolean) as File[];
                if (files.length === 0) continue;
                let groupKey: string | null = null;
                if (photoKey.startsWith("q")) {
                    const qNo = Number(photoKey.substring(1));
                    const q = QUESTIONS.find(q => q.no === qNo);
                    if (q) groupKey = q.key;
                } else if (photoKey.includes("_")) {
                    const match = photoKey.match(/r(\d+)/);
                    if (match) {
                        const qNo = Number(match[1]);
                        const q = QUESTIONS.find(q => q.no === qNo);
                        if (q) groupKey = q.key;
                    }
                }
                if (!groupKey) continue;
                uploadPromises.push(uploadGroupPhotos(report_id, stationId, groupKey, files, "pre"));
            }
            if (uploadPromises.length > 0) { await Promise.all(uploadPromises); }

            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(key, p.id)));
            clearDraftLocal(key);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&tab=station`);
        } catch (err: any) {
            alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`);
        } finally {
            setSubmitting(false);
        }
    };

    const onFinalSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }
        
        // Validation checks with scroll to error
        if (!allPhotosAttachedPost) {
            alert(t("alertFillPhoto", lang));
            const scrollId = getFirstMissingPhotoScrollId();
            if (scrollId) scrollToFirstError(scrollId);
            return;
        }
        if (!allPFAnswered) {
            alert(lang === "th" ? "กรุณาเลือก PASS/FAIL/N/A ทุกข้อ" : "Please select PASS/FAIL/N/A for all items");
            const scrollId = getFirstMissingPFScrollId();
            if (scrollId) scrollToFirstError(scrollId);
            return;
        }
        if (!allRemarksFilledPost) {
            alert(`${t("alertFillRemark", lang)} ${missingRemarksPost.join(", ")}`);
            const scrollId = getFirstMissingRemarkScrollId();
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
            const flatRows = flattenRows(rows);
            const payload = {
                station_id: stationId, rows: flatRows, summary,
                ...(summaryCheck ? { summaryCheck } : {}), side: "post" as TabId, report_id: finalReportId,
            };
            const res = await fetch(`${API_BASE}/stationpmreport/submit`, {
                method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include", body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const { report_id } = await res.json() as { report_id: string };

            // Upload photos
            const photoKeys = Object.keys(photos);
            const uploadPromises: Promise<void>[] = [];
            for (const photoKey of photoKeys) {
                const list = photos[photoKey] || [];
                if (list.length === 0) continue;
                const files = list.map(p => p.file!).filter(Boolean) as File[];
                if (files.length === 0) continue;
                let groupKey: string | null = null;
                if (photoKey.startsWith("q")) {
                    const qNo = Number(photoKey.substring(1));
                    const q = QUESTIONS.find(q => q.no === qNo);
                    if (q) groupKey = q.key;
                } else if (photoKey.includes("_")) {
                    const match = photoKey.match(/r(\d+)/);
                    if (match) {
                        const qNo = Number(match[1]);
                        const q = QUESTIONS.find(q => q.no === qNo);
                        if (q) groupKey = q.key;
                    }
                }
                if (!groupKey) continue;
                uploadPromises.push(uploadGroupPhotos(finalReportId, stationId, groupKey, files, "post"));
            }
            if (uploadPromises.length > 0) { await Promise.all(uploadPromises); }

            await fetch(`${API_BASE}/stationpmreport/${finalReportId}/finalize`, {
                method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                credentials: "include", body: new URLSearchParams({ station_id: stationId }),
            });

            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(postKey, p.id)));
            clearDraftLocal(postKey);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&tab=station`);
        } catch (err: any) {
            alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`);
        } finally {
            setSubmitting(false);
        }
    };

    const renderQuestionBlock = (q: Question, mode: TabId) => {
        const qTooltip = q.tooltip?.[lang];

        if (mode === "pre") {
            if (q.kind === "simple") {
                const isNA = rows[q.key]?.pf === "NA";
                return (
                    <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} tooltip={qTooltip}>
                        <div className={isNA ? "tw-bg-amber-50/50" : ""}>
                            <div className="tw-flex tw-items-center tw-justify-end tw-gap-2 tw-mb-3">
                                <Button size="sm" color={isNA ? "amber" : "gray"} variant={isNA ? "filled" : "outlined"}
                                    onClick={() => setRows(prev => ({ ...prev, [q.key]: { ...prev[q.key], pf: isNA ? "" : "NA" } }))}>
                                    {isNA ? t("cancelNA", lang) : t("na", lang)}
                                </Button>
                            </div>
                            {q.hasPhoto && (
                                <div className="tw-mb-4">
                                    <PhotoMultiInput photos={photos[`q${q.no}`] || []} setPhotos={makePhotoSetter(`q${q.no}`)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(`q${q.no}`)} />
                                </div>
                            )}
                            <div id={getRemarkIdFromKey(q.key)}>
                                <Textarea label={t("remark", lang)} value={rows[q.key]?.remark || ""}
                                    onChange={(e) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: e.target.value } })}
                                    rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                            </div>
                        </div>
                    </SectionCard>
                );
            }
            // Group type in Pre mode
            return (
                <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} tooltip={qTooltip}>
                    {q.items.map((item, idx) => {
                        const isNA = rows[item.key]?.pf === "NA";
                        return (
                            <div key={item.key} className={`tw-py-4 ${idx !== q.items.length - 1 ? "tw-border-b tw-border-gray-200" : ""} ${isNA ? "tw-bg-amber-50/50" : ""}`}>
                                <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                    <Typography variant="small" className="tw-font-medium">{item.label[lang]}</Typography>
                                    <Button size="sm" color={isNA ? "amber" : "gray"} variant={isNA ? "filled" : "outlined"}
                                        onClick={() => setRows(prev => ({ ...prev, [item.key]: { ...prev[item.key], pf: isNA ? "" : "NA" } }))}>
                                        {isNA ? t("cancelNA", lang) : t("na", lang)}
                                    </Button>
                                </div>
                                {q.hasPhoto && (
                                    <div className="tw-mb-4">
                                        <PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(item.key)} />
                                    </div>
                                )}
                                <div id={getRemarkIdFromKey(item.key)}>
                                    <Textarea label={t("remark", lang)} value={rows[item.key]?.remark || ""}
                                        onChange={(e) => setRows({ ...rows, [item.key]: { ...rows[item.key], remark: e.target.value } })}
                                        rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                                </div>
                            </div>
                        );
                    })}
                </SectionCard>
            );
        }

        // POST MODE
        if (q.kind === "simple") {
            if (rowsPre[q.key]?.pf === "NA") {
                return (
                    <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)}>
                        <SkippedNAItem label={q.label[lang]} remark={rowsPre[q.key]?.remark} lang={lang} />
                    </SectionCard>
                );
            }

            const preRemark = rowsPre[q.key]?.remark;
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
                <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)}>
                    <PassFailRow label={t("testResult", lang)} value={rows[q.key]?.pf ?? ""} lang={lang}
                        onChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })}
                        remark={rows[q.key]?.remark || ""}
                        onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })}
                        id={getPfIdFromKey(q.key)}
                        remarkId={getRemarkIdFromKey(q.key)}
                        aboveRemark={q.hasPhoto && (
                            <div className="tw-pb-4 tw-border-b tw-mb-4 tw-border-gray-100">
                                <PhotoMultiInput photos={photos[`q${q.no}`] || []} setPhotos={makePhotoSetter(`q${q.no}`)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(`q${q.no}`)} />
                            </div>
                        )}
                        beforeRemark={preRemarkElement}
                    />
                </SectionCard>
            );
        }

        // Group type in Post mode
        return (
            <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)}>
                {q.items.map((item, idx) => {
                    if (rowsPre[item.key]?.pf === "NA") {
                        return (
                            <div key={item.key} className={`tw-py-4 ${idx !== q.items.length - 1 ? "tw-border-b tw-border-gray-200" : ""}`}>
                                <SkippedNAItem label={item.label[lang]} remark={rowsPre[item.key]?.remark} lang={lang} />
                            </div>
                        );
                    }

                    const preRemark = rowsPre[item.key]?.remark;
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
                        <div key={item.key} className={`tw-py-4 ${idx !== q.items.length - 1 ? "tw-border-b tw-border-gray-200" : ""}`}>
                            <PassFailRow label={item.label[lang]} value={rows[item.key]?.pf ?? ""} lang={lang}
                                onChange={(v) => setRows({ ...rows, [item.key]: { ...rows[item.key], pf: v } })}
                                remark={rows[item.key]?.remark || ""}
                                onRemarkChange={(v) => setRows({ ...rows, [item.key]: { ...rows[item.key], remark: v } })}
                                id={getPfIdFromKey(item.key)}
                                remarkId={getRemarkIdFromKey(item.key)}
                                aboveRemark={q.hasPhoto && (
                                    <div className="tw-pb-4 tw-border-b tw-mb-4 tw-border-gray-100">
                                        <PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(item.key)} />
                                    </div>
                                )}
                                beforeRemark={preRemarkElement}
                            />
                        </div>
                    );
                })}
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

    return (
        <section className="tw-pb-24">
            <div className="tw-mx-auto tw-max-w-6xl tw-flex tw-items-center tw-justify-between tw-mb-4">
                <Button variant="outlined" size="sm" onClick={() => router.back()} title={t("backToList", lang)}>
                    <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-gray-900 tw-stroke-2" />
                </Button>
                <Tabs value={displayTab}>
                    <TabsHeader className="tw-bg-gray-50 tw-rounded-lg">
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
                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            <div className="lg:tw-col-span-1"><Input label={t("issueId", lang)} value={job.issue_id || "-"} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-bg-blue-gray-50" /></div>
                            <div className="sm:tw-col-span-2 lg:tw-col-span-2"><Input label={t("location", lang)} value={job.station_name} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="sm:tw-col-span-2 lg:tw-col-span-2"><Input label={t("inspector", lang)} value={inspector} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-1"><Input label={t("pmDate", lang)} type="text" value={job.date} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                        </div>
                    </div>

                    <div className="tw-mt-6 sm:tw-mt-8 tw-space-y-4 sm:tw-space-y-6">
                        {QUESTIONS.filter((q) => !(displayTab === "pre" && q.no === 11)).map((q) => renderQuestionBlock(q, displayTab))}
                    </div>

                    <div id={`${ID_PREFIX}-summary-section`} className="tw-mt-6 sm:tw-mt-8 tw-space-y-3">
                        <Typography variant="h6" className="tw-mb-1 tw-text-sm sm:tw-text-base">{t("comment", lang)}</Typography>
                        {displayTab === "post" && commentPre && (
                            <div className="tw-mb-3 tw-p-3 tw-bg-amber-50 tw-rounded-lg tw-border tw-border-amber-300">
                                <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                                    <svg className="tw-w-4 tw-h-4 tw-text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <Typography variant="small" className="tw-font-semibold tw-text-amber-700">
                                        {lang === "th" ? "Comment (ก่อน PM)" : "Comment (Pre-PM)"}
                                    </Typography>
                                </div>
                                <Typography variant="small" className="tw-text-amber-900 tw-ml-6">{commentPre}</Typography>
                            </div>
                        )}
                        <Textarea label={t("comment", lang)} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} required={isPostMode} autoComplete="off" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-text-sm resize-none" />
                        {displayTab === "post" && (
                            <div className="tw-pt-3 sm:tw-pt-4 tw-border-t tw-border-gray-200">
                                <PassFailRow label={t("summaryResult", lang)} value={summaryCheck} onChange={(v) => setSummaryCheck(v)} lang={lang}
                                    labels={{ PASS: t("summaryPassLabel", lang), FAIL: t("summaryFailLabel", lang), NA: t("summaryNALabel", lang) }} />
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
                            allRemarksFilledPre={allRemarksFilledPre}
                            missingRemarksPre={missingRemarksPre}
                            allPFAnswered={allPFAnswered}
                            missingPFItems={missingPFItems}
                            allRemarksFilledPost={allRemarksFilledPost}
                            missingRemarksPost={missingRemarksPost}
                            isSummaryFilled={isSummaryFilled}
                            isSummaryCheckFilled={isSummaryCheckFilled}
                        />
                        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-2 sm:tw-gap-3">
                            {displayTab === "pre" ? (
                                <Button type="button" onClick={onPreSave} disabled={!canGoAfter || submitting}
                                    className="tw-text-sm tw-py-2.5 tw-bg-gray-800 hover:tw-bg-gray-900"
                                    title={!allPhotosAttachedPre ? t("alertPhotoNotComplete", lang) : !allRemarksFilledPre ? `${t("alertFillRemark", lang)} ${missingRemarksPre.join(", ")}` : undefined}>
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