"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Button, Input, Typography, Textarea, Tooltip } from "@material-tailwind/react";
import { draftKey, saveDraftLocal, loadDraftLocal, clearDraftLocal } from "@/app/dashboard/pm-report/cb-box/input_PMreport/lib/draft";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Image from "next/image";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Tabs, TabsHeader, Tab } from "@material-tailwind/react";
import { putPhoto, getPhoto, delPhoto, type PhotoRef } from "../lib/draftPhotos";
import { useLanguage, type Lang } from "@/utils/useLanguage";

const T = {
    pageTitle: { th: "Preventive Maintenance Checklist - Safety Switch / Circuit Breaker - Box", en: "Preventive Maintenance Checklist - Safety Switch / Circuit Breaker - Box" },
    companyName: { th: "Electricity Generating Authority of Thailand (EGAT)", en: "Electricity Generating Authority of Thailand (EGAT)" },
    companyAddress: { th: "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand", en: "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand" },
    companyAddressShort: { th: "Bang Kruai, Nonthaburi 11130", en: "Bang Kruai, Nonthaburi 11130" },
    callCenter: { th: "Call Center Tel. 02-114-3350", en: "Call Center Tel. 02-114-3350" },
    docName: { th: "ชื่อเอกสาร", en: "Document Name" },
    issueId: { th: "Issue ID", en: "Issue ID" },
    location: { th: "สถานที่", en: "Location" },
    inspector: { th: "ผู้ตรวจสอบ", en: "Inspector" },
    pmDate: { th: "วันที่ PM", en: "PM Date" },
    save: { th: "บันทึก", en: "Save" },
    saving: { th: "กำลังบันทึก...", en: "Saving..." },
    attachPhoto: { th: "แนบรูป / ถ่ายรูป", en: "Attach / Take Photo" },
    na: { th: "N/A", en: "N/A" },
    cancelNA: { th: "ยกเลิก N/A", en: "Cancel N/A" },
    pass: { th: "PASS", en: "PASS" },
    fail: { th: "FAIL", en: "FAIL" },
    backToList: { th: "กลับไปหน้า List", en: "Back to List" },
    maxPhotos: { th: "สูงสุด", en: "Max" },
    photos: { th: "รูป", en: "photos" },
    cameraSupported: { th: "รองรับการถ่ายจากกล้องบนมือถือ", en: "Camera supported on mobile" },
    noPhotos: { th: "ยังไม่มีรูปแนบ", en: "No photos attached" },
    remark: { th: "หมายเหตุ *", en: "Remark *" },
    remarkLabel: { th: "หมายเหตุ", en: "Remark" },
    testResult: { th: "ผลการทดสอบ", en: "Test Result" },
    preRemarkLabel: { th: "หมายเหตุ (ก่อน PM)", en: "Remark (Pre-PM)" },
    comment: { th: "Comment", en: "Comment" },
    beforePM: { th: "ก่อน PM", en: "Before PM" },
    afterPM: { th: "หลัง PM", en: "After PM" },
    summaryResult: { th: "สรุปผลการตรวจสอบ", en: "Inspection Summary" },
    summaryPassLabel: { th: "Pass", en: "Pass" },
    summaryFailLabel: { th: "Fail", en: "Fail" },
    summaryNALabel: { th: "N/A", en: "N/A" },
    selectPowerSource: { th: "-- เลือกแหล่งรับไฟ --", en: "-- Select power source --" },
    selectDevice: { th: "-- เลือกอุปกรณ์ --", en: "-- Select device --" },
    powerSource: { th: "แหล่งรับไฟ", en: "Power source" },
    circuitDevice: { th: "อุปกรณ์ตัดวงจรไฟฟ้า", en: "Circuit breaker device" },
    validationPhotoTitle: { th: "1) ตรวจสอบการแนบรูปภาพ", en: "1) Photo Attachments" },
    validationInputTitle: { th: "2) อินพุตข้อ 5", en: "2) Input Item 5" },
    validationRemarkTitle: { th: "3) หมายเหตุ", en: "3) Remarks" },
    validationPFTitle: { th: "3) สถานะ PASS / FAIL / N/A", en: "3) PASS / FAIL / N/A status" },
    validationRemarkTitlePost: { th: "4) หมายเหตุ", en: "4) Remarks" },
    validationSummaryTitle: { th: "5) สรุปผลการตรวจสอบ", en: "5) Inspection Summary" },
    allComplete: { th: "ครบเรียบร้อย ✅", en: "Complete ✅" },
    missingPhoto: { th: "ยังไม่ได้แนบรูปข้อ:", en: "Missing photos for:" },
    missingInput: { th: "ยังขาดข้อ:", en: "Missing:" },
    missingRemark: { th: "ยังไม่ได้กรอกหมายเหตุข้อ:", en: "Missing remarks for:" },
    missingPF: { th: "ยังไม่ได้เลือกข้อ:", en: "Not selected:" },
    missingSummaryText: { th: "ยังไม่ได้กรอก Comment", en: "Comment not filled" },
    missingSummaryStatus: { th: "ยังไม่ได้เลือกสถานะสรุปผล", en: "Summary status not selected" },
    alertNoStation: { th: "ยังไม่ทราบ station_id", en: "Station ID not found" },
    alertFillPhoto: { th: "กรุณาแนบรูปในทุกข้อก่อนบันทึก", en: "Please attach photos for all items" },
    alertFillPreFirst: { th: "กรุณากรอกข้อมูลในส่วน Pre-PM ให้ครบก่อน", en: "Please complete all Pre-PM fields first" },
    alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },
    alertCompleteAll: { th: "กรุณากรอกข้อมูลและแนบรูปให้ครบก่อนบันทึก", en: "Please complete all fields" },
    alertPhotoNotComplete: { th: "กรุณาแนบรูปในส่วน Pre-PM ให้ครบก่อน", en: "Please attach all photos" },
    alertInputNotComplete: { th: "กรุณากรอกค่าข้อ 5 ให้ครบ", en: "Please fill in Item 5" },
    alertFillRemark: { th: "กรุณากรอกหมายเหตุข้อ:", en: "Please fill in remarks for:" },
    noReportId: { th: "ไม่มี report_id", en: "No report_id" },
    // PMValidationCard translations
    itemLabel: { th: "ข้อ", en: "Item" },
    formStatus: { th: "สถานะการกรอกข้อมูล", en: "Form Completion Status" },
    allCompleteReady: { th: "กรอกข้อมูลครบถ้วนแล้ว พร้อมบันทึก ✓", en: "All fields completed. Ready to save ✓" },
    remaining: { th: "ยังขาดอีก {n} รายการ", en: "{n} items remaining" },
    items: { th: "รายการ", en: "items" },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

// Helper functions to generate scroll IDs
const ID_PREFIX = "cbbox-pm";

const getPhotoIdFromKey = (key: string | number): string => {
    return `${ID_PREFIX}-photo-${key}`;
};

const getRemarkIdFromKey = (key: string | number): string => {
    if (typeof key === "number") return `${ID_PREFIX}-remark-${key}`;
    const match = String(key).match(/^r(\d+)$/);
    if (match) return `${ID_PREFIX}-remark-${match[1]}`;
    return `${ID_PREFIX}-remark-${key}`;
};

const getInputIdFromKey = (qNo: number, fieldKey: string): string => {
    return `${ID_PREFIX}-input-${qNo}-${fieldKey}`;
};

const getPfIdFromKey = (key: string | number): string => {
    if (typeof key === "number") return `${ID_PREFIX}-pf-${key}`;
    const match = String(key).match(/^r(\d+)$/);
    if (match) return `${ID_PREFIX}-pf-${match[1]}`;
    return `${ID_PREFIX}-pf-${key}`;
};

const QUESTIONS_DATA = [
    { no: 1, key: "r1", label: { th: "1) การไฟฟ้าฝ่ายจำหน่าย", en: "1) Power distribution authority" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบระบบจำหน่าย", en: "Check distribution system" } },
    { no: 2, key: "r2", label: { th: "2) ตรวจสอบอุปกรณ์ตัดวงจรไฟฟ้า", en: "2) Check circuit breaker device" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบอุปกรณ์ตัดตอน", en: "Inspect circuit breaker" } },
    { no: 3, key: "r3", label: { th: "3) ตรวจสอบสภาพทั่วไป", en: "3) General condition inspection" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบความแข็งแรงของตู้", en: "Check cabinet integrity" } },
    { no: 4, key: "r4", label: { th: "4) ตรวจสอบสภาพดักซีล,ซิลิโคนกันซึม", en: "4) Check sealant and silicone" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบสภาพดักซีล", en: "Check sealant condition" } },
    { no: 5, key: "r5", label: { th: "5) ตรวจสอบแรงดันอุปกรณ์ตัดวงจรไฟฟ้า", en: "5) Check voltage of circuit breaker" }, kind: "measure", hasPhoto: true, tooltip: { th: "วัดค่าแรงดันไฟฟ้า", en: "Measure input voltage" } },
    { no: 6, key: "r6", label: { th: "6) ปุ่มฉุกเฉิน", en: "6) Emergency button" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบปุ่มหยุดฉุกเฉิน", en: "Check emergency button" } },
    { no: 7, key: "r7", label: { th: "7) ทดสอบปุ่ม Trip Test", en: "7) Test Trip Test button" }, kind: "simple", hasPhoto: true, tooltip: { th: "กดปุ่ม Test", en: "Press Test button" } },
    { no: 8, key: "r8", label: { th: "8) ตรวจสอบจุดต่อทางไฟฟ้าและขันแน่น", en: "8) Check electrical connections" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบการขันแน่น", en: "Check bolt tightness" } },
    { no: 9, key: "r9", label: { th: "9) ทำความสะอาดตู้อุปกรณ์", en: "9) Clean equipment cabinet" }, kind: "simple", hasPhoto: true, tooltip: { th: "ทำความสะอาด", en: "Clean cabinet" } },
] as const;

const DROPDOWN_Q1_OPTIONS = [
    { value: "การไฟฟ้านครหลวง", th: "การไฟฟ้านครหลวง", en: "Metropolitan Electricity Authority" },
    { value: "การไฟฟ้าส่วนภูมิภาค", th: "การไฟฟ้าส่วนภูมิภาค", en: "Provincial Electricity Authority" },
    { value: "ระบบไฟฟ้าในพื้นที่", th: "ระบบไฟฟ้าในพื้นที่", en: "Local electrical system" },
] as const;

const DROPDOWN_Q2_OPTIONS = [
    { value: "Disconnecting Switch", th: "Disconnecting Switch", en: "Disconnecting Switch" },
    { value: "Breaker", th: "Breaker", en: "Breaker" },
    { value: "N/A", th: "N/A", en: "N/A" },
] as const;

type TabId = "pre" | "post";
const TABS: { id: TabId; label: string }[] = [{ id: "pre", label: "Pre\u2011PM" }, { id: "post", label: "Post\u2011PM" }];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const LOGO_SRC = "/img/logo_egat.png";

type StationPublic = { station_id: string; station_name: string; status?: boolean };
type Me = { id: string; username: string; email: string; role: string; company: string; tel: string };
type PhotoItem = { id: string; file?: File; preview?: string; remark?: string; ref?: PhotoRef; isNA?: boolean };
type PF = "PASS" | "FAIL" | "NA" | "";

const VOLTAGE_FIELDS = ["L1-N", "L2-N", "L3-N", "L1-G", "L2-G", "L3-G", "L1-L2", "L2-L3", "L3-L1", "N-G"] as const;
const LABELS: Record<string, string> = { "L1-N": "L1-N", "L2-N": "L2-N", "L3-N": "L3-N", "L1-G": "L1-G", "L2-G": "L2-G", "L3-G": "L3-G", "L1-L2": "L1-L2", "L2-L3": "L2-L3", "L3-L1": "L3-L1", "N-G": "N-G" };

type Question = { no: number; key: string; label: { th: string; en: string }; kind: string; hasPhoto?: boolean; tooltip?: { th: string; en: string } };
const QUESTIONS = QUESTIONS_DATA as unknown as Question[];

function getQuestionLabel(q: Question, mode: TabId, lang: Lang): string {
    const baseLabel = q.label[lang];
    return mode === "pre" ? (lang === "th" ? `${baseLabel} (ก่อน PM)` : `${baseLabel} (Pre-PM)`) : (lang === "th" ? `${baseLabel} (หลัง PM)` : `${baseLabel} (Post-PM)`);
}

const FIELD_GROUPS: Record<number, { keys: readonly string[] } | undefined> = { 5: { keys: VOLTAGE_FIELDS } };

type UnitVoltage = "V";
type MeasureRow = { value: string; unit: UnitVoltage };
type MeasureState = Record<string, MeasureRow>;

function initMeasureState(keys: readonly string[]): MeasureState {
    return keys.reduce((acc, k) => { acc[k] = { value: "", unit: "V" }; return acc; }, {} as MeasureState);
}

function useMeasure(keys: readonly string[]) {
    const [state, setState] = useState<MeasureState>(() => initMeasureState(keys));
    const patch = (key: string, p: Partial<MeasureRow>) => setState(prev => ({ ...prev, [key]: { ...prev[key], ...p } }));
    return { state, setState, patch };
}

function useDebouncedEffect(effect: () => void, deps: any[], delay = 800) {
    useEffect(() => { const h = setTimeout(effect, delay); return () => clearTimeout(h); }, deps);
}

async function getStationInfoPublic(stationId: string): Promise<StationPublic> {
    const res = await fetch(`${API_BASE}/station/info/public?station_id=${encodeURIComponent(stationId)}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Station not found");
    const json = await res.json();
    return json.station ?? json;
}

async function fetchPreviewIssueId(stationId: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/cbboxpmreport/preview-issueid`); u.searchParams.set("station_id", stationId); u.searchParams.set("pm_date", pmDate);
    const token = localStorage.getItem("access_token") ?? "";
    const r = await fetch(u.toString(), { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!r.ok) return null; return (await r.json())?.issue_id ?? null;
}

async function fetchPreviewDocName(stationId: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/cbboxpmreport/preview-docname`); u.searchParams.set("station_id", stationId); u.searchParams.set("pm_date", pmDate);
    const token = localStorage.getItem("access_token") ?? "";
    const r = await fetch(u.toString(), { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!r.ok) return null; return (await r.json())?.doc_name ?? null;
}

async function fetchReport(reportId: string, stationId: string) {
    const token = localStorage.getItem("access_token") ?? "";
    const res = await fetch(`${API_BASE}/cbboxpmreport/get?station_id=${stationId}&report_id=${reportId}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// ==================== UI COMPONENTS ====================

function SectionCard({ title, children, tooltip }: { title?: string; children: React.ReactNode; tooltip?: string }) {
    return (
        <div className="tw-rounded-xl tw-border tw-border-gray-200 tw-overflow-hidden tw-bg-white tw-shadow-sm">
            {title && (
                <div className="tw-bg-gray-800 tw-px-4 tw-py-3 tw-flex tw-items-center tw-justify-between">
                    <Typography className="tw-text-white tw-font-medium tw-text-sm">{title}</Typography>
                    {tooltip && (
                        <Tooltip content={tooltip} placement="bottom">
                            <svg className="tw-w-5 tw-h-5 tw-text-gray-400 tw-cursor-help hover:tw-text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        </Tooltip>
                    )}
                </div>
            )}
            <div className="tw-p-4">{children}</div>
        </div>
    );
}

function Section({ title, ok, children, lang }: { title: React.ReactNode; ok: boolean; children?: React.ReactNode; lang: Lang }) {
    return (
        <div className="tw-rounded-lg tw-p-2.5 sm:tw-p-3 tw-bg-gray-100">
            <div className="tw-flex tw-items-center tw-gap-2">
                {ok ? <svg className="tw-w-4 tw-h-4 tw-text-gray-700 tw-flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    : <svg className="tw-w-4 tw-h-4 tw-text-gray-500 tw-flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>}
                <Typography className="tw-font-medium tw-text-xs sm:tw-text-sm tw-text-gray-800">{title}</Typography>
            </div>
            {ok ? <Typography variant="small" className="!tw-text-green-600 tw-text-xs sm:tw-text-sm tw-ml-6">{t("allComplete", lang)}</Typography> : <div className="tw-ml-6 tw-mt-1">{children}</div>}
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
    missingRemarksPre: number[];
    allPFAnsweredPost: boolean;
    missingPFItemsPost: number[];
    allRemarksFilledPost: boolean;
    missingRemarksPost: number[];
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
        return `${ID_PREFIX}-photo-${item}`;
    };

    const getRemarkScrollId = (item: number): string => {
        return `${ID_PREFIX}-remark-${item}`;
    };

    const getPfButtonsScrollId = (item: number): string => {
        return `${ID_PREFIX}-pf-${item}`;
    };

    const getInputScrollId = (qNo: number, fieldKey: string): string => {
        return `${ID_PREFIX}-input-${qNo}-${fieldKey}`;
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
            missingInputsDetailed.forEach(({ qNo, label, fieldKey }) => {
                const scrollId = getInputScrollId(qNo, fieldKey);
                const message = lang === "th" ? `ยังไม่ได้กรอกค่า ${label}` : `${label} value not filled`;
                errors.push({
                    section: lang === "th" ? "ค่าที่ต้องกรอก" : "Required Inputs",
                    sectionIcon: "📝",
                    itemName: `${t("itemLabel", lang)} ${qNo}`,
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

function InputWithUnit({ label, value, unit, onValueChange, readOnly, disabled, required = true, id }: {
    label: string; value: string; unit: string; onValueChange: (v: string) => void; readOnly?: boolean; disabled?: boolean; required?: boolean; id?: string;
}) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        if (newValue === "" || /^-?\d*\.?\d*$/.test(newValue)) onValueChange(newValue);
    };
    return (
        <div id={id} className="tw-flex tw-items-center tw-gap-2">
            <div className="tw-flex-1 tw-relative">
                <input type="text" inputMode="numeric" pattern="-?[0-9]*\.?[0-9]*" value={value} onChange={handleChange} readOnly={readOnly} disabled={disabled} required={required} placeholder=" "
                    className={`tw-peer tw-w-full tw-h-10 tw-px-3 tw-pt-4 tw-pb-1 tw-text-sm tw-border tw-border-gray-300 tw-rounded-lg tw-outline-none focus:tw-border-blue-500 focus:tw-ring-1 focus:tw-ring-blue-500 ${disabled ? "tw-bg-gray-100 tw-text-gray-500" : "tw-bg-white"}`} />
                <label className="tw-absolute tw-left-3 tw-top-1 tw-text-[10px] tw-text-gray-500 tw-pointer-events-none">{label}{required && <span className="tw-text-red-500">*</span>}</label>
            </div>
            <div className="tw-flex-shrink-0 tw-w-10 tw-h-10 tw-flex tw-items-center tw-justify-center tw-text-gray-600 tw-font-medium tw-text-sm tw-bg-gray-100 tw-rounded-lg tw-border tw-border-gray-200">{unit}</div>
        </div>
    );
}

function PassFailRow({ label, value, onChange, remark, onRemarkChange, labels, aboveRemark, beforeRemark, lang, id, remarkId }: {
    label: string; value: PF; onChange: (v: Exclude<PF, "">) => void; remark?: string; onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>; aboveRemark?: React.ReactNode; beforeRemark?: React.ReactNode; lang: Lang; id?: string; remarkId?: string;
}) {
    const text = { PASS: labels?.PASS ?? t("pass", lang), FAIL: labels?.FAIL ?? t("fail", lang), NA: labels?.NA ?? t("na", lang) };
    return (
        <div className="tw-space-y-3 tw-py-3">
            <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-start sm:tw-items-center tw-justify-between tw-gap-2">
                <Typography className="tw-font-medium">{label}</Typography>
                <div id={id} className="tw-flex tw-gap-2">
                    <Button size="sm" color="green" variant={value === "PASS" ? "filled" : "outlined"} className="tw-min-w-[72px]" onClick={() => onChange("PASS")}>{text.PASS}</Button>
                    <Button size="sm" color="red" variant={value === "FAIL" ? "filled" : "outlined"} className="tw-min-w-[72px]" onClick={() => onChange("FAIL")}>{text.FAIL}</Button>
                    <Button size="sm" color="blue-gray" variant={value === "NA" ? "filled" : "outlined"} className="tw-min-w-[72px]" onClick={() => onChange("NA")}>{text.NA}</Button>
                </div>
            </div>
            {onRemarkChange && <div className="tw-space-y-3">{aboveRemark}{beforeRemark}<div id={remarkId}><Textarea label={t("remark", lang)} value={remark || ""} onChange={(e) => onRemarkChange(e.target.value)} containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full" /></div></div>}
        </div>
    );
}

function PhotoMultiInput({ photos, setPhotos, max = 10, draftKey, qNo, lang, id }: { photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>; max?: number; draftKey: string; qNo: number; lang: Lang; id?: string }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const handleFiles = async (list: FileList | null) => {
        if (!list) return;
        const remain = Math.max(0, max - photos.length);
        const files = Array.from(list).slice(0, remain);
        const items: PhotoItem[] = await Promise.all(files.map(async (f, i) => { const photoId = `${qNo}-${Date.now()}-${i}-${f.name}`; const ref = await putPhoto(draftKey, photoId, f); return { id: photoId, file: f, preview: URL.createObjectURL(f), remark: "", ref }; }));
        setPhotos(prev => [...prev, ...items]);
        if (fileRef.current) fileRef.current.value = "";
    };
    const handleRemove = async (id: string) => { await delPhoto(draftKey, id); setPhotos(prev => { const target = prev.find(p => p.id === id); if (target?.preview) URL.revokeObjectURL(target.preview); return prev.filter(p => p.id !== id); }); };
    return (
        <div id={id} className="tw-space-y-3">
            <Button size="sm" color="blue" variant="outlined" onClick={() => fileRef.current?.click()}>{t("attachPhoto", lang)}</Button>
            <Typography variant="small" className="!tw-text-gray-500">{t("maxPhotos", lang)} {max} {t("photos", lang)} • {t("cameraSupported", lang)}</Typography>
            <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="tw-hidden" onChange={(e) => void handleFiles(e.target.files)} />
            {photos.length > 0 ? (
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                    {photos.map(p => (<div key={p.id} className="tw-border tw-rounded-lg tw-overflow-hidden tw-bg-white"><div className="tw-relative tw-aspect-[4/3] tw-bg-gray-50">{p.preview && <img src={p.preview} alt="" className="tw-w-full tw-h-full tw-object-cover" />}<button onClick={() => void handleRemove(p.id)} className="tw-absolute tw-top-2 tw-right-2 tw-bg-red-500 tw-text-white tw-w-6 tw-h-6 tw-rounded-full tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600">×</button></div></div>))}
                </div>
            ) : <Typography variant="small" className="!tw-text-gray-500">{t("noPhotos", lang)}</Typography>}
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
            {remark && <Typography variant="small" className="tw-text-gray-600 tw-mt-1">{t("remarkLabel", lang)}: {remark}</Typography>}
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

// ==================== MAIN COMPONENT ====================

export default function CBBOXPMForm() {
    const { lang } = useLanguage();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const editId = searchParams.get("edit_id") ?? "";
    const action = searchParams.get("action");
    const isPostMode = action === "post";

    const [submitting, setSubmitting] = useState(false);
    const [docName, setDocName] = useState("");
    const [reportId, setReportId] = useState("");
    const [stationId, setStationId] = useState<string | null>(null);
    const [summary, setSummary] = useState("");
    const [summaryCheck, setSummaryCheck] = useState<PF>("");
    const [inspector, setInspector] = useState("");
    const [postApiLoaded, setPostApiLoaded] = useState(false);
    const [commentPre, setCommentPre] = useState("");
    const [job, setJob] = useState({ issue_id: "", station_name: "", date: "" });
    const [dropdownQ1, setDropdownQ1] = useState("");
    const [dropdownQ2, setDropdownQ2] = useState("");
    const [q2WasNA, setQ2WasNA] = useState(false);

    const initialPhotos: Record<number, PhotoItem[]> = Object.fromEntries(QUESTIONS.filter(q => q.hasPhoto).map(q => [q.no, []])) as Record<number, PhotoItem[]>;
    const [photos, setPhotos] = useState<Record<number, PhotoItem[]>>(initialPhotos);

    const [rowsPre, setRowsPre] = useState<Record<string, { pf: PF; remark: string }>>({});
    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(() => {
        const initial: Record<string, { pf: PF; remark: string }> = {};
        QUESTIONS.forEach(q => { initial[q.key] = { pf: "", remark: "" }; });
        return initial;
    });

    const [m5Pre, setM5Pre] = useState<MeasureState>(() => initMeasureState(VOLTAGE_FIELDS));
    const m5 = useMeasure(VOLTAGE_FIELDS);

    const key = useMemo(() => draftKey(stationId), [stationId]);
    const postKey = useMemo(() => `${draftKey(stationId)}:${editId}:post`, [stationId, editId]);
    const currentDraftKey = isPostMode ? postKey : key;

    // Q2 NA dependency
    useEffect(() => {
        if (isPostMode) return;
        const isQ2NA = rows["r2"]?.pf === "NA";
        const dependentKeys = ["r5", "r6", "r7"];
        if (isQ2NA && !q2WasNA) {
            setRows(prev => { const next = { ...prev }; dependentKeys.forEach(k => { next[k] = { ...next[k], pf: "NA" }; }); return next; });
            setQ2WasNA(true);
        } else if (!isQ2NA && q2WasNA) {
            setRows(prev => { const next = { ...prev }; dependentKeys.forEach(k => { if (next[k]?.pf === "NA") next[k] = { ...next[k], pf: "" }; }); return next; });
            setQ2WasNA(false);
        }
    }, [rows["r2"]?.pf, isPostMode, q2WasNA]);

    // Load station info
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sid = params.get("station_id") || localStorage.getItem("selected_station_id");
        if (sid) setStationId(sid);
        if (!sid || isPostMode) return;
        getStationInfoPublic(sid).then(st => {
            setJob(prev => ({ ...prev, station_name: st.station_name ?? prev.station_name, date: prev.date || new Date().toISOString().slice(0, 10) }));
        }).catch(console.error);
    }, [isPostMode]);

    // Load me
    useEffect(() => {
        const token = localStorage.getItem("access_token") ?? "";
        if (!token) return;
        fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" })
            .then(res => res.ok ? res.json() : null)
            .then((data: Me | null) => { if (data) setInspector(prev => prev || data.username || ""); })
            .catch(console.error);
    }, []);

    // Preview issue_id and doc_name
    useEffect(() => {
        if (isPostMode || !stationId || !job.date) return;
        fetchPreviewIssueId(stationId, job.date).then(id => { if (id) setJob(prev => ({ ...prev, issue_id: id })); }).catch(() => {});
        fetchPreviewDocName(stationId, job.date).then(name => { if (name) setDocName(name); }).catch(() => {});
    }, [stationId, job.date, isPostMode]);

    // Load draft Pre
    useEffect(() => {
        if (!stationId || isPostMode) return;
        const draft = loadDraftLocal<any>(key);
        if (!draft) return;
        if (draft.rows) setRows(draft.rows);
        if (draft.m5) m5.setState(draft.m5);
        if (draft.summary) setSummary(draft.summary);
        if (draft.summary_pf) setSummaryCheck(draft.summary_pf);
        if (draft.inspector) setInspector(draft.inspector);
        if (draft.dropdownQ1) setDropdownQ1(draft.dropdownQ1);
        if (draft.dropdownQ2) setDropdownQ2(draft.dropdownQ2);
    }, [stationId, key, isPostMode]);

    // Load API data for Post mode
    useEffect(() => {
        if (!isPostMode || !editId || !stationId) return;
        setPostApiLoaded(false);
        fetchReport(editId, stationId).then(data => {
            if (data.job) setJob(prev => ({ ...prev, ...data.job, issue_id: data.issue_id ?? prev.issue_id }));
            if (data.pm_date) setJob(prev => ({ ...prev, date: data.pm_date }));
            if (data?.measures_pre?.m5) {
                setM5Pre(prev => {
                    const next = { ...prev };
                    VOLTAGE_FIELDS.forEach(k => { const row = data.measures_pre.m5[k] ?? {}; next[k] = { value: row.value ?? "", unit: "V" }; });
                    return next;
                });
            }
            if (data.doc_name) setDocName(data.doc_name);
            if (data.inspector) setInspector(data.inspector);
            if (data.dropdownQ1) setDropdownQ1(data.dropdownQ1);
            if (data.dropdownQ2) setDropdownQ2(data.dropdownQ2);
            if (data.comment_pre) setCommentPre(data.comment_pre);
            if (data.summary) setSummary(data.summary);
            if (data.rows_pre) setRowsPre(data.rows_pre);
            if (data.rows) setRows(prev => ({ ...prev, ...data.rows }));
            else if (data.rows_pre) setRows(prev => { const next = { ...prev }; Object.entries(data.rows_pre).forEach(([k, v]) => { next[k] = { pf: (v as any).pf, remark: "" }; }); return next; });
            setPostApiLoaded(true);
        }).catch(err => { console.error(err); setPostApiLoaded(true); });
    }, [isPostMode, editId, stationId]);

    const makePhotoSetter = (no: number): React.Dispatch<React.SetStateAction<PhotoItem[]>> => {
        return action => setPhotos(prev => ({ ...prev, [no]: typeof action === "function" ? action(prev[no] ?? []) : action }));
    };

    // Validation
    const REQUIRED_PHOTO_ITEMS_PRE = useMemo(() => QUESTIONS.filter(q => q.hasPhoto && q.no !== 9).map(q => q.no), []);
    const REQUIRED_PHOTO_ITEMS_POST = useMemo(() => QUESTIONS.filter(q => q.hasPhoto).map(q => q.no), []);

    const missingPhotoItemsPre = useMemo(() => REQUIRED_PHOTO_ITEMS_PRE.filter(no => { if (rows[`r${no}`]?.pf === "NA") return false; return (photos[no]?.length ?? 0) < 1; }), [photos, rows]);
    const missingPhotoItemsPost = useMemo(() => REQUIRED_PHOTO_ITEMS_POST.filter(no => { if (rowsPre[`r${no}`]?.pf === "NA") return false; return (photos[no]?.length ?? 0) < 1; }), [photos, rowsPre]);

    const allPhotosAttachedPre = missingPhotoItemsPre.length === 0;
    const allPhotosAttachedPost = missingPhotoItemsPost.length === 0;
    const missingPhotoItems = isPostMode ? missingPhotoItemsPost : missingPhotoItemsPre;
    const allPhotosAttached = isPostMode ? allPhotosAttachedPost : allPhotosAttachedPre;

    // Format missingPhotoItems as string[] for PMValidationCard
    const missingPhotoItemsFormatted = useMemo(() => {
        return missingPhotoItems.map(no => String(no));
    }, [missingPhotoItems]);

    const PF_KEYS_PRE = useMemo(() => QUESTIONS.filter(q => q.no !== 9).map(q => q.key), []);
    const PF_KEYS_POST = useMemo(() => QUESTIONS.filter(q => { if (q.no === 1 || q.no === 2) return false; if (rowsPre[q.key]?.pf === "NA") return false; return true; }).map(q => q.key), [rowsPre]);

    const allPFAnsweredPre = useMemo(() => true, []); // Pre mode doesn't require PF
    const missingPFItemsPre = useMemo(() => [] as number[], []);
    const allPFAnsweredPost = useMemo(() => PF_KEYS_POST.every(k => rows[k]?.pf !== ""), [rows, PF_KEYS_POST]);
    const missingPFItemsPost = useMemo(() => PF_KEYS_POST.filter(k => !rows[k]?.pf).map(k => Number(k.replace("r", ""))).sort((a, b) => a - b), [rows, PF_KEYS_POST]);

    // For UI display
    const allPFAnsweredForUI = isPostMode ? allPFAnsweredPost : allPFAnsweredPre;
    const missingPFItemsForUI = isPostMode ? missingPFItemsPost : missingPFItemsPre;

    const validRemarkKeysPre = useMemo(() => QUESTIONS.filter(q => q.no !== 9).map(q => q.key), []);
    const missingRemarksPre = useMemo(() => {
        const missing: number[] = [];
        validRemarkKeysPre.forEach(key => { const val = rows[key]; if (val?.pf === "NA") return; if (!val?.remark?.trim()) { const m = key.match(/^r(\d+)$/); if (m) missing.push(parseInt(m[1], 10)); } });
        return missing.sort((a, b) => a - b);
    }, [rows, validRemarkKeysPre]);
    const allRemarksFilledPre = missingRemarksPre.length === 0;

    const validRemarkKeysPost = useMemo(() => QUESTIONS.filter(q => rowsPre[q.key]?.pf !== "NA").map(q => q.key), [rowsPre]);
    const missingRemarksPost = useMemo(() => {
        const missing: number[] = [];
        validRemarkKeysPost.forEach(key => { const val = rows[key]; if (!val?.remark?.trim()) { const m = key.match(/^r(\d+)$/); if (m) missing.push(parseInt(m[1], 10)); } });
        return missing.sort((a, b) => a - b);
    }, [rows, validRemarkKeysPost]);
    const allRemarksFilledPost = missingRemarksPost.length === 0;

    const missingInputs = useMemo(() => {
        const r: string[] = [];
        if (rows["r5"]?.pf === "NA" || rowsPre["r5"]?.pf === "NA") return r;
        const missingKeys = FIELD_GROUPS[5]?.keys.filter(k => !m5.state[k]?.value?.trim()) || [];
        if (missingKeys.length > 0) r.push(`5: ${missingKeys.join(", ")}`);
        return r;
    }, [m5.state, rowsPre, rows]);

    // Detailed missing inputs for PMValidationCard
    const missingInputsDetailed = useMemo(() => {
        const r: MissingInputItem[] = [];
        if (rows["r5"]?.pf === "NA" || rowsPre["r5"]?.pf === "NA") return r;
        FIELD_GROUPS[5]?.keys.forEach((k) => {
            const v = m5.state[k]?.value ?? "";
            if (!String(v).trim()) r.push({ qNo: 5, label: LABELS[k], fieldKey: k });
        });
        return r;
    }, [m5.state, rowsPre, rows]);

    const allRequiredInputsFilled = missingInputs.length === 0;
    const isSummaryFilled = summary.trim().length > 0;
    const isSummaryCheckFilled = summaryCheck !== "";

    const canGoAfter = isPostMode ? true : (allPhotosAttachedPre && allRequiredInputsFilled && allRemarksFilledPre);
    const canFinalSave = allPhotosAttachedPost && allPFAnsweredPost && allRequiredInputsFilled && allRemarksFilledPost && isSummaryFilled && isSummaryCheckFilled;

    // Auto-save draft
    const photoRefs = useMemo(() => {
        const out: Record<number, (PhotoRef | { isNA: true })[]> = {};
        Object.entries(photos).forEach(([noStr, list]) => { out[Number(noStr)] = (list || []).map(p => p.isNA ? { isNA: true } : p.ref).filter(Boolean) as any[]; });
        return out;
    }, [photos]);

    useDebouncedEffect(() => {
        if (!stationId || isPostMode) return;
        saveDraftLocal(key, { rows, m5: m5.state, summary, summary_pf: summaryCheck, photoRefs, dropdownQ1, dropdownQ2, inspector });
    }, [key, stationId, rows, m5.state, summary, summaryCheck, dropdownQ1, dropdownQ2, photoRefs, isPostMode, inspector]);

    useDebouncedEffect(() => {
        if (!stationId || !isPostMode || !editId) return;
        saveDraftLocal(postKey, { rows, m5: m5.state, summary, summaryCheck, photoRefs });
    }, [postKey, stationId, rows, m5.state, summary, summaryCheck, photoRefs, isPostMode, editId]);

    // Helper functions for scroll IDs
    const getFirstMissingPhotoScrollId = (): string | null => {
        if (missingPhotoItems.length === 0) return null;
        return `${ID_PREFIX}-photo-${missingPhotoItems[0]}`;
    };

    const getFirstMissingPFScrollId = (): string | null => {
        if (missingPFItemsPost.length === 0) return null;
        return `${ID_PREFIX}-pf-${missingPFItemsPost[0]}`;
    };

    const getFirstMissingRemarkScrollId = (): string | null => {
        const missing = isPostMode ? missingRemarksPost : missingRemarksPre;
        if (missing.length === 0) return null;
        return `${ID_PREFIX}-remark-${missing[0]}`;
    };

    const getFirstMissingInputScrollId = (): string | null => {
        if (missingInputsDetailed.length === 0) return null;
        const first = missingInputsDetailed[0];
        return `${ID_PREFIX}-input-${first.qNo}-${first.fieldKey}`;
    };

    // Render measure grid
    const renderMeasureGrid = (no: number, isPreView = false) => {
        const cfg = FIELD_GROUPS[no]; if (!cfg) return null;
        const state = isPreView ? m5Pre : m5.state;
        return (
            <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-5 tw-gap-3">
                {cfg.keys.map(k => (
                    <div key={k} className={isPreView ? "tw-pointer-events-none tw-opacity-60" : ""}>
                        <InputWithUnit 
                            label={LABELS[k] ?? k} 
                            value={state[k]?.value || ""} 
                            unit="V" 
                            onValueChange={v => !isPreView && m5.patch(k, { value: v })} 
                            readOnly={isPreView} 
                            required={!isPreView}
                            id={!isPreView ? getInputIdFromKey(no, k) : undefined}
                        />
                    </div>
                ))}
            </div>
        );
    };

    const renderMeasureGridWithPre = (no: number) => {
        const cfg = FIELD_GROUPS[no]; if (!cfg) return null;
        return (
            <div className="tw-space-y-3">
                <Typography variant="small" className="tw-font-medium tw-text-gray-700">{t("beforePM", lang)}</Typography>
                {renderMeasureGrid(no, true)}
                <Typography variant="small" className="tw-font-medium tw-text-gray-700 tw-mt-2">{t("afterPM", lang)}</Typography>
                {renderMeasureGrid(no, false)}
            </div>
        );
    };

    // Render question block
    const renderQuestionBlock = (q: Question, mode: TabId) => {
        const hasMeasure = q.kind === "measure" && !!FIELD_GROUPS[q.no];
        const qTooltip = q.tooltip?.[lang];
        const preRemark = rowsPre[q.key]?.remark;
        const preRemarkElement = mode === "post" && preRemark ? (
            <div className="tw-mb-3 tw-p-3 tw-bg-amber-50 tw-rounded-lg tw-border tw-border-amber-300">
                <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                    <svg className="tw-w-4 tw-h-4 tw-text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    <Typography variant="small" className="tw-font-semibold tw-text-amber-700">{t("preRemarkLabel", lang)}</Typography>
                </div>
                <Typography variant="small" className="tw-text-amber-900 tw-ml-6">{preRemark}</Typography>
            </div>
        ) : null;

        if (mode === "pre") {
            const isNA = rows[q.key]?.pf === "NA";
            const isQ2NA = rows["r2"]?.pf === "NA";
            const isDependentOnQ2 = [5, 6, 7].includes(q.no);
            const isLockedByQ2 = isDependentOnQ2 && isQ2NA;
            return (
                <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} tooltip={qTooltip}>
                    <div className={isNA ? "tw-bg-amber-50/50" : ""}>
                        <div className="tw-flex tw-items-center tw-justify-end tw-gap-2 tw-mb-3">
                            {isLockedByQ2 && <Typography variant="small" className="tw-text-amber-700 tw-italic">{lang === "th" ? "(N/A ตามข้อ 2)" : "(N/A from Q2)"}</Typography>}
                            <Button size="sm" color={isNA ? "amber" : "gray"} variant={isNA ? "filled" : "outlined"} disabled={isLockedByQ2} onClick={() => setRows(prev => ({ ...prev, [q.key]: { ...prev[q.key], pf: isNA ? "" : "NA" } }))}>{isNA ? t("cancelNA", lang) : t("na", lang)}</Button>
                        </div>
                        {q.hasPhoto && <div className="tw-mb-3"><PhotoMultiInput photos={photos[q.no] || []} setPhotos={makePhotoSetter(q.no)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(q.no)} /></div>}
                        {hasMeasure && <div className={`tw-mb-3 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>{renderMeasureGrid(q.no)}</div>}
                        {q.no === 1 && <div className={`tw-mb-4 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}><select value={dropdownQ1} onChange={e => setDropdownQ1(e.target.value)} className="tw-w-full tw-max-w-sm tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-gray-300 tw-bg-white tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500/30"><option value="">{t("selectPowerSource", lang)}</option>{DROPDOWN_Q1_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt[lang]}</option>)}</select></div>}
                        {q.no === 2 && <div className={`tw-mb-4 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}><select value={dropdownQ2} onChange={e => setDropdownQ2(e.target.value)} className="tw-w-full tw-max-w-sm tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-gray-300 tw-bg-white tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500/30"><option value="">{t("selectDevice", lang)}</option>{DROPDOWN_Q2_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt[lang]}</option>)}</select>{isNA && <Typography variant="small" className="tw-text-amber-700 tw-mt-2">{lang === "th" ? "* ข้อ 5, 6, 7 จะเป็น N/A ตามข้อนี้" : "* Q5, 6, 7 will be N/A accordingly"}</Typography>}</div>}
                        <div id={getRemarkIdFromKey(q.no)}><Textarea label={t("remark", lang)} value={rows[q.key]?.remark || ""} onChange={e => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: e.target.value } })} rows={3} containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full" /></div>
                    </div>
                </SectionCard>
            );
        }

        if (rowsPre[q.key]?.pf === "NA") return <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} tooltip={qTooltip}><SkippedNAItem label={q.label[lang]} remark={rowsPre[q.key]?.remark} lang={lang} /></SectionCard>;

        if (mode === "post" && (q.no === 1 || q.no === 2)) {
            return (
                <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} tooltip={qTooltip}>
                    {q.hasPhoto && <div className="tw-mb-3"><PhotoMultiInput photos={photos[q.no] || []} setPhotos={makePhotoSetter(q.no)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(q.no)} /></div>}
                    {q.no === 1 && <div className="tw-mb-4"><Typography variant="small" className="tw-font-medium tw-text-gray-700 tw-mb-2">{t("powerSource", lang)}</Typography><div className="tw-p-3 tw-bg-gray-100 tw-rounded tw-border tw-border-gray-200"><Typography variant="small">{dropdownQ1 || "-"}</Typography></div>{preRemarkElement}<div id={getRemarkIdFromKey(q.no)}><Textarea label={t("remark", lang)} value={rows[q.key]?.remark || ""} onChange={e => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: e.target.value } })} rows={2} containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full tw-mt-3" /></div></div>}
                    {q.no === 2 && <div className="tw-mb-4"><Typography variant="small" className="tw-font-medium tw-text-gray-700 tw-mb-2">{t("circuitDevice", lang)}</Typography><div className="tw-p-3 tw-bg-gray-100 tw-rounded tw-border tw-border-gray-200"><Typography variant="small">{dropdownQ2 || "-"}</Typography></div>{preRemarkElement}<div id={getRemarkIdFromKey(q.no)}><Textarea label={t("remark", lang)} value={rows[q.key]?.remark || ""} onChange={e => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: e.target.value } })} rows={2} containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full tw-mt-3" /></div></div>}
                </SectionCard>
            );
        }

        return (
            <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} tooltip={qTooltip}>
                <PassFailRow 
                    label={t("testResult", lang)} 
                    value={rows[q.key]?.pf ?? ""} 
                    lang={lang} 
                    onChange={v => setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })} 
                    remark={rows[q.key]?.remark || ""} 
                    onRemarkChange={v => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })}
                    id={getPfIdFromKey(q.no)}
                    remarkId={getRemarkIdFromKey(q.no)}
                    aboveRemark={q.hasPhoto && <div className="tw-pb-4 tw-border-b tw-mb-4 tw-border-gray-100"><PhotoMultiInput photos={photos[q.no] || []} setPhotos={makePhotoSetter(q.no)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} id={getPhotoIdFromKey(q.no)} /></div>}
                    beforeRemark={<>{hasMeasure && (q.no === 5 ? renderMeasureGridWithPre(q.no) : renderMeasureGrid(q.no))}{preRemarkElement}</>} 
                />
            </SectionCard>
        );
    };

    // Image compression
    async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
        if (!file.type.startsWith("image/") || file.size < 500 * 1024) return file;
        return new Promise(resolve => {
            const img = document.createElement("img");
            img.onload = () => { URL.revokeObjectURL(img.src); let { width, height } = img; if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; } const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; const ctx = canvas.getContext("2d")!; ctx.drawImage(img, 0, 0, width, height); canvas.toBlob(blob => { if (blob && blob.size < file.size) resolve(new File([blob], file.name, { type: "image/jpeg" })); else resolve(file); }, "image/jpeg", quality); };
            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }

    async function uploadGroupPhotos(reportId: string, stationId: string, group: string, files: File[], side: TabId) {
        if (files.length === 0) return;
        const compressedFiles = await Promise.all(files.map(f => compressImage(f)));
        const form = new FormData(); form.append("station_id", stationId); form.append("group", group); form.append("side", side); compressedFiles.forEach(f => form.append("files", f));
        const token = localStorage.getItem("access_token");
        const url = side === "pre" ? `${API_BASE}/cbboxpmreport/${reportId}/pre/photos` : `${API_BASE}/cbboxpmreport/${reportId}/post/photos`;
        const res = await fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form, credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
    }

    const onPreSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }
        
        // Validation checks with scroll to error
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
            const rowsPreData: Record<string, { pf: string; remark: string }> = {};
            QUESTIONS.forEach(q => { rowsPreData[q.key] = { pf: rows[q.key]?.pf || "", remark: rows[q.key]?.remark || "" }; });
            const payload = { station_id: stationId, issue_id: job.issue_id, job: { station_name: job.station_name, date: job.date }, inspector, measures_pre: { m5: m5.state }, rows_pre: rowsPreData, pm_date: job.date, doc_name: docName, dropdownQ1, dropdownQ2, side: "pre", comment_pre: summary };
            const res = await fetch(`${API_BASE}/cbboxpmreport/pre/submit`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: "include", body: JSON.stringify(payload) });
            if (!res.ok) throw new Error(await res.text());
            const { report_id, doc_name } = await res.json() as { report_id: string; doc_name?: string };
            setReportId(report_id);
            if (doc_name) setDocName(doc_name);
            const uploadPromises: Promise<void>[] = [];
            Object.entries(photos).forEach(([no, list]) => { const files = (list || []).map(p => p.file).filter(Boolean) as File[]; if (files.length > 0) uploadPromises.push(uploadGroupPhotos(report_id, stationId, `g${no}`, files, "pre")); });
            if (uploadPromises.length > 0) await Promise.all(uploadPromises);
            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(key, p.id)));
            clearDraftLocal(key);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&tab=cb-box`);
        } catch (err: any) { alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`); } finally { setSubmitting(false); }
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
            const payload = { station_id: stationId, rows, measures: { m5: m5.state }, summary, dropdownQ1, dropdownQ2, ...(summaryCheck ? { summaryCheck } : {}), side: "post", report_id: finalReportId };
            const res = await fetch(`${API_BASE}/cbboxpmreport/submit`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: "include", body: JSON.stringify(payload) });
            if (!res.ok) throw new Error(await res.text());
            const uploadPromises: Promise<void>[] = [];
            Object.entries(photos).forEach(([no, list]) => { const files = (list || []).map(p => p.file).filter(Boolean) as File[]; if (files.length > 0) uploadPromises.push(uploadGroupPhotos(finalReportId, stationId, `g${no}`, files, "post")); });
            if (uploadPromises.length > 0) await Promise.all(uploadPromises);
            await fetch(`${API_BASE}/cbboxpmreport/${finalReportId}/finalize`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: "include", body: new URLSearchParams({ station_id: stationId }) });
            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(postKey, p.id)));
            clearDraftLocal(postKey);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&tab=cb-box`);
        } catch (err: any) { alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`); } finally { setSubmitting(false); }
    };

    // Tab navigation
    const active: TabId = useMemo(() => searchParams.get("pmtab") === "post" ? "post" : "pre", [searchParams]);
    const displayTab: TabId = isPostMode ? "post" : (active === "post" && !canGoAfter ? "pre" : active);

    useEffect(() => {
        const tabParam = searchParams.get("pmtab");
        let desired: TabId = isPostMode ? "post" : (tabParam === "post" ? "post" : "pre");
        if (desired === "post" && !canGoAfter && !isPostMode) desired = "pre";
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
        params.set("pmtab", next);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <section className="tw-pb-24">
            <div className="tw-mx-auto tw-max-w-6xl tw-flex tw-items-center tw-justify-between tw-mb-4">
                <Button variant="outlined" size="sm" onClick={() => router.back()} title={t("backToList", lang)}><ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-gray-900 tw-stroke-2" /></Button>
                <Tabs value={displayTab}>
                    <TabsHeader className="tw-bg-gray-100 tw-rounded-lg">
                        {TABS.map(tb => {
                            const isPreDisabled = isPostMode && tb.id === "pre";
                            const isLockedAfter = tb.id === "post" && !canGoAfter;
                            if (isPreDisabled) return <div key={tb.id} className="tw-px-4 tw-py-2 tw-font-medium tw-opacity-50 tw-cursor-not-allowed">{tb.label}</div>;
                            if (isLockedAfter) return <div key={tb.id} className="tw-px-4 tw-py-2 tw-font-medium tw-opacity-50 tw-cursor-not-allowed" onClick={() => alert(t("alertFillPreFirst", lang))}>{tb.label}</div>;
                            return <Tab key={tb.id} value={tb.id} onClick={() => go(tb.id)} className="tw-px-4 tw-py-2 tw-font-medium">{tb.label}</Tab>;
                        })}
                    </TabsHeader>
                </Tabs>
            </div>
            <form noValidate onSubmit={e => { e.preventDefault(); return false; }} onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}>
                <div className="tw-mx-auto tw-max-w-6xl tw-bg-white tw-border tw-border-gray-200 tw-rounded-xl tw-shadow-sm tw-p-4 sm:tw-p-6 md:tw-p-8">
                    <div className="tw-flex tw-flex-col tw-gap-4 md:tw-flex-row md:tw-items-start md:tw-justify-between md:tw-gap-6">
                        <div className="tw-flex tw-items-start tw-gap-3 md:tw-gap-4">
                            <div className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md tw-shrink-0 tw-h-14 tw-w-[64px] sm:tw-h-16 sm:tw-w-[76px] md:tw-h-20 md:tw-w-[108px] lg:tw-h-24 lg:tw-w-[152px]"><Image src={LOGO_SRC} alt="Logo" fill priority className="tw-object-contain" sizes="152px" /></div>
                            <div className="tw-min-w-0"><div className="tw-font-semibold tw-text-gray-900 tw-text-sm sm:tw-text-base">{t("pageTitle", lang)}</div><div className="tw-text-xs sm:tw-text-sm tw-text-gray-600">{t("companyAddressShort", lang)}<br />{t("callCenter", lang)}</div></div>
                        </div>
                        <div className="tw-text-left md:tw-text-right tw-text-sm tw-text-gray-700 tw-border-t tw-border-gray-100 tw-pt-3 md:tw-border-t-0 md:tw-pt-0 md:tw-shrink-0"><div className="tw-font-semibold">{t("docName", lang)}</div><div className="tw-break-all">{docName || "-"}</div></div>
                    </div>
                    <div className="tw-mt-8 tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                        <div className="lg:tw-col-span-1"><Input label={t("issueId", lang)} value={job.issue_id || "-"} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-bg-gray-50" /></div>
                        <div className="sm:tw-col-span-2 lg:tw-col-span-2"><Input label={t("location", lang)} value={job.station_name} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-gray-50" /></div>
                        <div className="sm:tw-col-span-2 lg:tw-col-span-2"><Input label={t("inspector", lang)} value={inspector} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-gray-50" /></div>
                        <div className="lg:tw-col-span-1"><Input label={t("pmDate", lang)} type="text" value={job.date} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-gray-50" /></div>
                    </div>
                    <div className="tw-space-y-4 tw-mt-6">{QUESTIONS.filter(q => !(displayTab === "pre" && q.no === 9)).map(q => renderQuestionBlock(q, displayTab))}</div>
                    <div id={`${ID_PREFIX}-summary-section`} className="tw-space-y-3 tw-mt-6">
                        <Typography variant="h6">{t("comment", lang)}</Typography>
                        {displayTab === "post" && commentPre && (
                            <div className="tw-mb-3 tw-p-3 tw-bg-amber-50 tw-rounded-lg tw-border tw-border-amber-300">
                                <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1"><svg className="tw-w-4 tw-h-4 tw-text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg><Typography variant="small" className="tw-font-semibold tw-text-amber-700">{lang === "th" ? "Comment (ก่อน PM)" : "Comment (Pre-PM)"}</Typography></div>
                                <Typography variant="small" className="tw-text-amber-900 tw-ml-6">{commentPre}</Typography>
                            </div>
                        )}
                        <Textarea label={t("comment", lang)} value={summary} onChange={e => setSummary(e.target.value)} rows={4} required={isPostMode} containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full" />
                        {displayTab === "post" && <div className="tw-pt-4 tw-border-t tw-border-gray-100"><PassFailRow label={t("summaryResult", lang)} value={summaryCheck} onChange={v => setSummaryCheck(v)} lang={lang} labels={{ PASS: t("summaryPassLabel", lang), FAIL: t("summaryFailLabel", lang), NA: t("summaryNALabel", lang) }} /></div>}
                    </div>
                    <div className="tw-flex tw-flex-col tw-gap-3 tw-mt-8">
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
                                <Button className="tw-text-sm tw-py-2.5 tw-bg-gray-800 hover:tw-bg-gray-900 tw-w-full sm:tw-w-auto" type="button" onClick={onPreSave} disabled={!canGoAfter || submitting}>{submitting ? t("saving", lang) : t("save", lang)}</Button>
                            ) : (
                                <Button className="tw-text-sm tw-py-2.5 tw-bg-gray-800 hover:tw-bg-gray-900 tw-w-full sm:tw-w-auto" type="button" onClick={onFinalSave} disabled={!canFinalSave || submitting}>{submitting ? t("saving", lang) : t("save", lang)}</Button>
                            )}
                        </div>
                    </div>
                </div>
            </form>
        </section>
    );
}