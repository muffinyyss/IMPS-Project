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
import { draftKey, saveDraftLocal, loadDraftLocal, clearDraftLocal } from "@/app/dashboard/pm-report/cb-box/input_PMreport/lib/draft";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Image from "next/image";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Tabs, TabsHeader, Tab } from "@material-tailwind/react";
import { apiFetch } from "@/utils/api";
import { putPhoto, getPhoto, delPhoto, type PhotoRef } from "../lib/draftPhotos";
import { useLanguage, type Lang } from "@/utils/useLanguage";

// ==================== TRANSLATIONS ====================
const T = {
    // Page Header
    pageTitle: { th: "Preventive Maintenance Checklist - Safety Switch / Circuit Breaker - Box", en: "Preventive Maintenance Checklist - Safety Switch / Circuit Breaker - Box" },
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
    summaryPassLabel: { th: "Pass", en: "Pass" },
    summaryFailLabel: { th: "Fail", en: "Fail" },
    summaryNALabel: { th: "N/A", en: "N/A" },

    // Dropdown Labels
    selectPowerSource: { th: "-- เลือกแหล่งรับไฟ --", en: "-- Select power source --" },
    selectDevice: { th: "-- เลือกอุปกรณ์ --", en: "-- Select device --" },
    powerSource: { th: "แหล่งรับไฟ", en: "Power source" },
    circuitDevice: { th: "อุปกรณ์ตัดวงจรไฟฟ้า", en: "Circuit breaker device" },

    // Validation Sections
    validationPhotoTitle: { th: "1) ตรวจสอบการแนบรูปภาพ (ทุกข้อ)", en: "1) Photo Attachments (all items)" },
    validationInputTitle: { th: "2) อินพุตข้อ 5", en: "2) Input Item 5" },
    validationRemarkTitle: { th: "3) หมายเหตุ (ทุกข้อ)", en: "3) Remarks (all items)" },
    validationPFTitle: { th: "3) สถานะ PASS / FAIL / N/A ทั้ง 7 ข้อ", en: "3) PASS / FAIL / N/A for all 7 items" },
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
    alertNoStation: { th: "ยังไม่ทราบ station_id", en: "Station ID not found" },
    alertFillPhoto: { th: "กรุณาแนบรูปในทุกข้อก่อนบันทึก", en: "Please attach photos for all items" },
    alertFillPreFirst: { th: "กรุณากรอกข้อมูลในส่วน Pre-PM ให้ครบก่อน", en: "Please complete all Pre-PM fields first" },
    alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },
    alertCompleteAll: { th: "กรุณากรอกข้อมูลและแนบรูปให้ครบก่อนบันทึก", en: "Please complete all fields and attach photos before saving" },
    alertPhotoNotComplete: { th: "กรุณาแนบรูปในส่วน Pre-PM ให้ครบก่อน", en: "Please attach all photos in Pre-PM section" },
    alertInputNotComplete: { th: "กรุณากรอกค่าข้อ 5 ให้ครบ", en: "Please fill in Item 5" },
    alertFillRemark: { th: "กรุณากรอกหมายเหตุข้อ:", en: "Please fill in remarks for:" },
    noReportId: { th: "ไม่มี report_id - กรุณาบันทึกข้อมูล Pre-PM ก่อน", en: "No report_id - Please save Pre-PM first" },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

// Questions with bilingual labels
const QUESTIONS_DATA = [
    { no: 1, key: "r1", label: { th: "1) การไฟฟ้าฝ่ายจำหน่าย", en: "1) Power distribution authority" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบระบบจำหน่ายว่าอยู่ภายใต้ความรับผิดชอบของหน่วยงานใด (MEA,PEA หรือเป็นระบบไฟในพื้นที่)", en: "Check which authority is responsible for the distribution system (MEA, PEA, or local electrical system)" } },
    { no: 2, key: "r2", label: { th: "2) ตรวจสอบอุปกรณ์ตัดวงจรไฟฟ้า", en: "2) Check circuit breaker device" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบและระบุประเภทอุปกรณ์ตัดตอน", en: "Inspect and identify the type of circuit breaker device" } },
    { no: 3, key: "r3", label: { th: "3) ตรวจสอบสภาพทั่วไป", en: "3) General condition inspection" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบความแข็งแรงของตู้ว่าไม่มีรอยผุ รอยไหม้ หรือการบิดเบี้ยว ระบบล็อกและบานพับ", en: "Check cabinet integrity for rust, burn marks, or deformation, including lock and hinge systems" } },
    { no: 4, key: "r4", label: { th: "4) ตรวจสอบสภาพดักซีล,ซิลิโคนกันซึม", en: "4) Check sealant and silicone" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบสภาพดักซีลที่ปิดหรืออุดตามรอยต่อและช่องทางเข้าสาย", en: "Check sealant condition at joints and cable entry points" } },
    { no: 5, key: "r5", label: { th: "5) ตรวจสอบแรงดันอุปกรณ์ตัดวงจรไฟฟ้า (Safety Switch / Circuit Breaker)", en: "5) Check voltage of circuit breaker (Safety Switch / Circuit Breaker)" }, kind: "measure", hasPhoto: true, tooltip: { th: "วัดค่าแรงดันไฟฟ้าด้านเข้าของ Safety Switch/Circuit Breaker", en: "Measure input voltage of Safety Switch/Circuit Breaker" } },
    { no: 6, key: "r6", label: { th: "6) ปุ่มฉุกเฉิน", en: "6) Emergency button" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบสภาพและการทำงานของปุ่มหยุดฉุกเฉิน", en: "Check condition and functionality of emergency stop button" } },
    { no: 7, key: "r7", label: { th: "7) ทดสอบปุ่ม Trip Test (Circuit Breaker)", en: "7) Test Trip Test button (Circuit Breaker)" }, kind: "simple", hasPhoto: true, tooltip: { th: "กดปุ่ม Test เพื่อทดสอบกลไกการตัดวงจรของ Breaker ในตู้ CB-Box", en: "Press Test button to verify the trip mechanism of the Breaker in CB-Box" } },
    { no: 8, key: "r8", label: { th: "8) ตรวจสอบจุดต่อทางไฟฟ้าและขันแน่น", en: "8) Check electrical connections and tighten" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบการขันแน่นของน็อตบริเวณจุดต่อสายและและตรวจเช็ครอยไหม้ด้วยกล้องถ่ายภาพความร้อน", en: "Check bolt tightness at cable connection points and inspect for burn marks using thermal imaging camera" } },
    { no: 9, key: "r9", label: { th: "9) ทำความสะอาดตู้อุปกรณ์", en: "9) Clean equipment cabinet" }, kind: "simple", hasPhoto: true, tooltip: { th: "ทำความสะอาดโดยการขจัดฝุ่นและสิ่งสกปรกภายในตู้ด้วยเครื่องดูดฝุ่นหรือเป่าลมแห้ง และตรวจสอบความสะอาดบริเวณหน้าสัมผัสไฟฟ้า", en: "Clean by removing dust and dirt inside the cabinet using vacuum cleaner or dry air blower, and check cleanliness of electrical contacts" } },
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

const UNITS = { voltage: ["V"] as const };
type UnitVoltage = (typeof UNITS.voltage)[number];
type PhotoItem = { id: string; file?: File; preview?: string; remark?: string; uploading?: boolean; error?: string; ref?: PhotoRef; isNA?: boolean; };
type PF = "PASS" | "FAIL" | "NA" | "";

const VOLTAGE_FIELDS = ["L1-N", "L2-N", "L3-N", "L1-G", "L2-G", "L3-G", "L1-L2", "L2-L3", "L3-L1", "N-G"] as const;
const LABELS: Record<string, string> = {
    "L1-N": "L1 to N", "L2-N": "L2 to N", "L3-N": "L3 to N",
    "L1-G": "L1 to G", "L2-G": "L2 to G", "L3-G": "L3 to G",
    "L1-L2": "L1 to L2", "L2-L3": "L2 to L3", "L3-L1": "L3 to L1", "N-G": "N to G",
};

type Question = { no: number; key: string; label: { th: string; en: string }; kind: string; hasPhoto?: boolean; tooltip?: { th: string; en: string } };

const QUESTIONS = QUESTIONS_DATA as unknown as Question[];

function getQuestionLabel(q: Question, mode: TabId, lang: Lang): string {
    const baseLabel = q.label[lang];
    if (mode === "pre") return lang === "th" ? `${baseLabel} (ก่อน PM)` : `${baseLabel} (Pre-PM)`;
    return lang === "th" ? `${baseLabel} (หลัง PM)` : `${baseLabel} (Post-PM)`;
}

const FIELD_GROUPS: Record<number, { keys: readonly string[]; unitType: "voltage"; note?: string } | undefined> = {
    5: { keys: VOLTAGE_FIELDS, unitType: "voltage" },
} as const;

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

function Section({ title, ok, children, lang }: { title: React.ReactNode; ok: boolean; children?: React.ReactNode; lang: Lang }) {
    return (
        <div className={`tw-rounded-lg tw-border tw-p-3 ${ok ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
            <Typography className="tw-font-medium">{title}</Typography>
            {ok ? <Typography variant="small" className="!tw-text-green-700">{t("allComplete", lang)}</Typography> : children}
        </div>
    );
}

function InputWithUnit<U extends string>({
    label, value, unit, units, onValueChange, onUnitChange, readOnly, disabled, labelOnTop, required = true,
}: {
    label: string; value: string; unit: U; units: readonly U[];
    onValueChange: (v: string) => void; onUnitChange: (u: U) => void;
    readOnly?: boolean; disabled?: boolean; labelOnTop?: boolean; required?: boolean;
}) {
    return (
        <div className="tw-space-y-1">
            {labelOnTop && <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700">{label}</Typography>}
            <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-items-end sm:tw-items-center">
                <Input type="text" inputMode="decimal" label={labelOnTop ? undefined : label} value={value}
                    onChange={(e) => { const newValue = e.target.value; if (newValue === "" || newValue === "-" || /^-?\d*\.?\d*$/.test(newValue)) onValueChange(newValue); }}
                    crossOrigin="" containerProps={{ className: "tw-col-span-1 !tw-min-w-0" }}
                    className={`!tw-w-full ${disabled ? "!tw-bg-blue-gray-50" : ""}`}
                    readOnly={readOnly} disabled={disabled} required={required} />
                <select required={required} value={unit} onChange={(e) => onUnitChange(e.target.value as U)}
                    className={`tw-col-span-1 tw-h-10 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500/30 focus:tw-border-blue-500 ${disabled ? "tw-bg-blue-gray-50 tw-text-blue-gray-400 tw-cursor-not-allowed" : ""}`}
                    disabled={disabled}>
                    {units.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
            </div>
        </div>
    );
}

function PassFailRow({
    label, value, onChange, remark, onRemarkChange, labels, aboveRemark, beforeRemark, inlineLeft, lang,
}: {
    label: string; value: PF; onChange: (v: Exclude<PF, "">) => void;
    remark?: string; onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
    aboveRemark?: React.ReactNode; beforeRemark?: React.ReactNode; inlineLeft?: React.ReactNode; lang: Lang;
}) {
    const text = { PASS: labels?.PASS ?? t("pass", lang), FAIL: labels?.FAIL ?? t("fail", lang), NA: labels?.NA ?? t("na", lang) };
    const buttonGroup = (
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
                </div>
            ) : (
                <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">{buttonsRow}</div>
            )}
        </div>
    );
}

function PhotoMultiInput({
    photos, setPhotos, max = 10, draftKey, qNo, lang,
}: {
    photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
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
            <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="tw-hidden" onChange={(e) => { void handleFiles(e.target.files); }} />
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

async function fetchPreviewIssueId(stationId: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/cbboxpmreport/preview-issueid`);
    u.searchParams.set("station_id", stationId);
    u.searchParams.set("pm_date", pmDate);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
    const r = await fetch(u.toString(), { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && typeof j.issue_id === "string") ? j.issue_id : null;
}

async function fetchPreviewDocName(stationId: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/cbboxpmreport/preview-docname`);
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
    const url = `${API_BASE}/cbboxpmreport/get?station_id=${stationId}&report_id=${reportId}`;
    const res = await fetch(url, { method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

export default function CBBOXPMForm() {
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

    const initialPhotos: Record<number, PhotoItem[]> = Object.fromEntries(
        QUESTIONS.filter((q) => q.hasPhoto).map((q) => [q.no, [] as PhotoItem[]])
    ) as Record<number, PhotoItem[]>;
    const [photos, setPhotos] = useState<Record<number, PhotoItem[]>>(initialPhotos);

    const [summary, setSummary] = useState<string>("");
    const [stationId, setStationId] = useState<string | null>(null);
    
    // Separate draft keys for Pre and Post mode (like Charger)
    const key = useMemo(() => draftKey(stationId), [stationId]);  // Pre mode - ไม่ใช้ draftId
    const postKey = useMemo(() => `${draftKey(stationId)}:${editId}:post`, [stationId, editId]);
    const currentDraftKey = isPostMode ? postKey : key;
    
    // Remove draft_id from URL if present (like Charger)
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
    const [postApiLoaded, setPostApiLoaded] = useState(false);  // Track when API data is loaded
    const [commentPre, setCommentPre] = useState<string>("");  // ✅ เก็บ comment จาก Pre mode

    const [job, setJob] = useState({ issue_id: "", station_name: "", date: "" });

    const [rowsPre, setRowsPre] = useState<Record<string, { pf: PF; remark: string }>>({});
    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(() => {
        const initial: Record<string, { pf: PF; remark: string }> = {};
        QUESTIONS.forEach((q) => { initial[q.key] = { pf: "", remark: "" }; });
        return initial;
    });

    const [dropdownQ1, setDropdownQ1] = useState<string>("");
    const [dropdownQ2, setDropdownQ2] = useState<string>("");

    // ✅ เมื่อข้อ 2 เป็น N/A ให้ข้อ 5, 6, 7 เป็น N/A ด้วย
    // เมื่อข้อ 2 ไม่เป็น N/A ให้ยกเลิก N/A ของข้อ 5, 6, 7 ที่ถูก lock ไว้
    const [q2WasNA, setQ2WasNA] = useState<boolean>(false);
    
    useEffect(() => {
        if (isPostMode) return; // ไม่ทำใน Post mode
        const isQ2NA = rows["r2"]?.pf === "NA";
        const dependentKeys = ["r5", "r6", "r7"];
        
        if (isQ2NA && !q2WasNA) {
            // ข้อ 2 เพิ่งเปลี่ยนเป็น N/A → ตั้งข้อ 5, 6, 7 เป็น N/A
            setRows(prev => {
                const next = { ...prev };
                dependentKeys.forEach(key => {
                    next[key] = { ...next[key], pf: "NA" };
                });
                return next;
            });
            setQ2WasNA(true);
        } else if (!isQ2NA && q2WasNA) {
            // ข้อ 2 เพิ่งยกเลิก N/A → ยกเลิก N/A ของข้อ 5, 6, 7 ด้วย
            setRows(prev => {
                const next = { ...prev };
                dependentKeys.forEach(key => {
                    if (next[key]?.pf === "NA") {
                        next[key] = { ...next[key], pf: "" };
                    }
                });
                return next;
            });
            setQ2WasNA(false);
        } else if (isQ2NA) {
            // ข้อ 2 ยังเป็น N/A อยู่ → ตรวจสอบว่าข้อ 5, 6, 7 เป็น N/A หรือยัง
            setRows(prev => {
                const next = { ...prev };
                let changed = false;
                dependentKeys.forEach(key => {
                    if (next[key]?.pf !== "NA") {
                        next[key] = { ...next[key], pf: "NA" };
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }
    }, [rows["r2"]?.pf, isPostMode, q2WasNA]);

    const [m5Pre, setM5Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS, "V"));
    const m5 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS, "V");

    // Load API data for Post mode
    useEffect(() => {
        if (!isPostMode || !editId || !stationId) return;
        setPostApiLoaded(false);  // Reset flag when deps change
        (async () => {
            try {
                const data = await fetchReport(editId, stationId);
                if (data.job) setJob(prev => ({ ...prev, ...data.job, issue_id: data.issue_id ?? prev.issue_id }));
                if (data.pm_date) setJob(prev => ({ ...prev, date: data.pm_date }));
                const m5FromPre = data?.measures_pre?.m5;
                if (m5FromPre) {
                    setM5Pre((prev) => {
                        const next = { ...prev };
                        VOLTAGE_FIELDS.forEach((k) => { const row = m5FromPre[k] ?? {}; next[k] = { value: row.value ?? "", unit: (row.unit as UnitVoltage) ?? "V" }; });
                        return next;
                    });
                }
                if (data.doc_name) setDocName(data.doc_name);
                if (data.inspector) setInspector(data.inspector);
                if (data.dropdownQ1) setDropdownQ1(data.dropdownQ1);
                if (data.dropdownQ2) setDropdownQ2(data.dropdownQ2);
                if (data.comment_pre) setCommentPre(data.comment_pre);  // ✅ โหลด comment จาก Pre mode
                if (data.summary) setSummary(data.summary);  // ✅ โหลด summary จาก Post mode (ถ้ามี)
                if (data.rows_pre) {
                    setRowsPre(data.rows_pre);
                }
                if (data.rows) {
                    setRows((prev) => { const next = { ...prev }; Object.entries(data.rows).forEach(([k, v]) => { next[k] = v as { pf: PF; remark: string }; }); return next; });
                } else if (data.rows_pre) {
                    // Initialize rows from rows_pre (like Charger)
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
    }, [isPostMode, editId, stationId]);

    // Load draft for Post mode (AFTER API data loaded) - like Charger
    useEffect(() => {
        if (!isPostMode || !stationId || !editId || !postApiLoaded) return;
        const postDraft = loadDraftLocal<{
            rows: typeof rows; m5: typeof m5.state; summary: string; summaryCheck?: PF;
            photoRefs?: Record<number, (PhotoRef | { isNA: true })[]>;
        }>(postKey);
        if (!postDraft) return;
        // Override with draft data
        if (postDraft.rows) setRows(prev => ({ ...prev, ...postDraft.rows }));
        if (postDraft.m5) m5.setState(postDraft.m5);
        if (postDraft.summary) setSummary(postDraft.summary);
        if (postDraft.summaryCheck) setSummaryCheck(postDraft.summaryCheck);
        // Load photos from draft
        (async () => {
            if (!postDraft.photoRefs) return;
            const next: Record<number, PhotoItem[]> = Object.fromEntries(QUESTIONS.filter((q) => q.hasPhoto).map((q) => [q.no, [] as PhotoItem[]])) as Record<number, PhotoItem[]>;
            for (const [noStr, refs] of Object.entries(postDraft.photoRefs)) {
                const no = Number(noStr);
                const items: PhotoItem[] = [];
                for (const ref of refs || []) {
                    if ('isNA' in ref && ref.isNA) { items.push({ id: `${no}-NA-restored`, isNA: true, preview: undefined }); continue; }
                    if (!('id' in ref) || !ref.id) continue;
                    const file = await getPhoto(postKey, ref.id);
                    if (!file) continue;
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

    // Load draft for Pre mode only (like Charger)
    useEffect(() => {
        if (!stationId || isPostMode) return;
        const draft = loadDraftLocal<{
            rows: typeof rows; m5: typeof m5.state; summary: string; summary_pf?: PF; inspector?: string;
            photoRefs?: Record<number, (PhotoRef | { isNA: true })[]>; dropdownQ1?: string; dropdownQ2?: string;
        }>(key);
        if (!draft) return;
        setRows(draft.rows);
        m5.setState(draft.m5 ?? initMeasureState(VOLTAGE_FIELDS, "V"));
        setSummary(draft.summary);
        setSummaryCheck(draft.summary_pf ?? "");
        setInspector(draft.inspector ?? "");
        if (draft.dropdownQ1) setDropdownQ1(draft.dropdownQ1);
        if (draft.dropdownQ2) setDropdownQ2(draft.dropdownQ2);
        (async () => {
            if (!draft.photoRefs) return;
            const next: Record<number, PhotoItem[]> = Object.fromEntries(QUESTIONS.filter((q) => q.hasPhoto).map((q) => [q.no, [] as PhotoItem[]])) as Record<number, PhotoItem[]>;
            for (const [noStr, refs] of Object.entries(draft.photoRefs)) {
                const no = Number(noStr);
                const items: PhotoItem[] = [];
                for (const ref of refs || []) {
                    if ('isNA' in ref && ref.isNA) { items.push({ id: `${no}-NA-restored`, isNA: true, preview: undefined }); continue; }
                    if (!('id' in ref) || !ref.id) continue;
                    const file = await getPhoto(key, ref.id);
                    if (!file) continue;
                    items.push({ id: ref.id, file, preview: URL.createObjectURL(file), remark: (ref as any).remark ?? "", ref: ref as PhotoRef });
                }
                next[no] = items;
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

    const makePhotoSetter = (no: number): React.Dispatch<React.SetStateAction<PhotoItem[]>> => {
        return (action: React.SetStateAction<PhotoItem[]>) => {
            setPhotos((prev) => {
                const current = prev[no] ?? [];
                const next = typeof action === "function" ? (action as (x: PhotoItem[]) => PhotoItem[])(current) : action;
                return { ...prev, [no]: next };
            });
        };
    };

    const MEASURE_BY_NO: Record<number, ReturnType<typeof useMeasure<UnitVoltage>> | undefined> = { 5: m5 };

    const REQUIRED_PHOTO_ITEMS_PRE = useMemo(() => QUESTIONS.filter((q) => q.hasPhoto && q.no !== 9).map((q) => q.no).sort((a, b) => a - b), []);
    const REQUIRED_PHOTO_ITEMS_POST = useMemo(() => QUESTIONS.filter((q) => q.hasPhoto).map((q) => q.no).sort((a, b) => a - b), []);

    const missingPhotoItemsPre = useMemo(() => REQUIRED_PHOTO_ITEMS_PRE.filter((no) => {
        // Skip items that are N/A
        const qKey = `r${no}`;
        if (rows[qKey]?.pf === "NA") return false;
        return (photos[no]?.length ?? 0) < 1;
    }), [REQUIRED_PHOTO_ITEMS_PRE, photos, rows]);
    const missingPhotoItemsPost = useMemo(() => REQUIRED_PHOTO_ITEMS_POST.filter((no) => {
        // Skip items that were N/A in Pre mode
        const qKey = `r${no}`;
        if (rowsPre[qKey]?.pf === "NA") return false;
        return (photos[no]?.length ?? 0) < 1;
    }), [REQUIRED_PHOTO_ITEMS_POST, photos, rowsPre]);

    const allPhotosAttachedPre = missingPhotoItemsPre.length === 0;
    const allPhotosAttachedPost = missingPhotoItemsPost.length === 0;
    const missingPhotoItems = isPostMode ? missingPhotoItemsPost : missingPhotoItemsPre;
    const allPhotosAttached = isPostMode ? allPhotosAttachedPost : allPhotosAttachedPre;

    const PF_KEYS_PRE = useMemo(() => QUESTIONS.filter((q) => q.no !== 9).map((q) => q.key), []);
    const PF_KEYS_POST = useMemo(() => QUESTIONS.filter((q) => {
        // Exclude items that were N/A in Pre mode, and exclude dropdown questions (1, 2)
        if (q.no === 1 || q.no === 2) return false;
        if (rowsPre[q.key]?.pf === "NA") return false;
        return true;
    }).map((q) => q.key), [rowsPre]);

    const allPFAnsweredPre = useMemo(() => PF_KEYS_PRE.every((k) => rows[k]?.pf !== ""), [rows, PF_KEYS_PRE]);
    const allPFAnsweredPost = useMemo(() => PF_KEYS_POST.every((k) => rows[k]?.pf !== ""), [rows, PF_KEYS_POST]);

    const missingPFItemsPre = useMemo(() => PF_KEYS_PRE.filter((k) => !rows[k]?.pf).map((k) => Number(k.replace("r", ""))).sort((a, b) => a - b), [rows, PF_KEYS_PRE]);
    const missingPFItemsPost = useMemo(() => PF_KEYS_POST.filter((k) => !rows[k]?.pf).map((k) => Number(k.replace("r", ""))).sort((a, b) => a - b), [rows, PF_KEYS_POST]);

    // Remark validation for Pre mode (like Charger)
    const validRemarkKeysPre = useMemo(() => {
        return QUESTIONS.filter((q) => q.no !== 9).map((q) => q.key);
    }, []);

    const missingRemarksPre = useMemo(() => {
        const missing: number[] = [];
        validRemarkKeysPre.forEach((key) => {
            const val = rows[key];
            // Skip items that are N/A
            if (val?.pf === "NA") return;
            if (!val?.remark?.trim()) {
                const match = key.match(/^r(\d+)$/);
                if (match) { missing.push(parseInt(match[1], 10)); }
            }
        });
        return missing.sort((a, b) => a - b);
    }, [rows, validRemarkKeysPre]);
    const allRemarksFilledPre = missingRemarksPre.length === 0;

    // Remark validation for Post mode
    const validRemarkKeysPost = useMemo(() => {
        return QUESTIONS.filter((q) => {
            if (rowsPre[q.key]?.pf === "NA") return false;
            return true;
        }).map((q) => q.key);
    }, [rowsPre]);

    const missingRemarksPost = useMemo(() => {
        const missing: number[] = [];
        validRemarkKeysPost.forEach((key) => {
            const val = rows[key];
            if (!val?.remark?.trim()) {
                const match = key.match(/^r(\d+)$/);
                if (match) { missing.push(parseInt(match[1], 10)); }
            }
        });
        return missing.sort((a, b) => a - b);
    }, [rows, validRemarkKeysPost]);
    const allRemarksFilledPost = missingRemarksPost.length === 0;

    const missingInputs = useMemo(() => {
        const r: string[] = [];
        // Skip if r5 is N/A in Pre mode or Post mode
        if (rows["r5"]?.pf === "NA") return r;
        if (rowsPre["r5"]?.pf === "NA") return r;
        FIELD_GROUPS[5]?.keys.forEach((k) => {
            const value = m5.state[k]?.value ?? "";
            if (!value.trim()) r.push(`5: ${String(k)}`);
        });
        return r;
    }, [m5.state, rowsPre, rows]);

    const allRequiredInputsFilled = useMemo(() => missingInputs.length === 0, [missingInputs]);
    const isSummaryFilled = summary.trim().length > 0;
    const isSummaryCheckFilled = summaryCheck !== "";

    // canGoAfter includes remarks validation (like Charger)
    const canGoAfter: boolean = isPostMode ? true : (allPhotosAttachedPre && allRequiredInputsFilled && allRemarksFilledPre);
    const canFinalSave = allPhotosAttachedPost && allPFAnsweredPost && allRequiredInputsFilled && allRemarksFilledPost && isSummaryFilled && isSummaryCheckFilled;

    const handleUnitChange = (no: number, key: string, u: UnitVoltage) => {
        const m = MEASURE_BY_NO[no];
        if (!m) return;
        const firstKey = (FIELD_GROUPS[no]?.keys ?? [key])[0] as string;
        if (key !== firstKey) m.patch(firstKey, { unit: u });
        m.syncUnits(u);
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
                            <InputWithUnit<UnitVoltage> label={LABELS[k] ?? k} value={m5Pre[k]?.value || ""} unit={(m5Pre[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                                onValueChange={() => { }} onUnitChange={() => { }} readOnly required={false} />
                        </div>
                    ))}
                </div>
                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700 tw-mt-2">{t("afterPM", lang)}</Typography>
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.keys.map((k) => (
                        <InputWithUnit<UnitVoltage> key={`post-${no}-${k}`} label={LABELS[k] ?? k} value={m.state[k]?.value || ""} unit={(m.state[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                            onValueChange={(v) => m.patch(k, { value: v })} onUnitChange={(u) => handleUnitChange(no, k, u)} />
                    ))}
                </div>
            </div>
        );
    };

    const renderMeasureGrid = (no: number) => {
        const cfg = FIELD_GROUPS[no];
        const m = MEASURE_BY_NO[no];
        if (!cfg || !m) return null;
        return (
            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                {cfg.keys.map((k) => (
                    <InputWithUnit<UnitVoltage> key={`${no}-${k}`} label={String(k)} value={m.state[k]?.value || ""} unit={(m.state[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                        onValueChange={(v) => m.patch(k, { value: v })} onUnitChange={(u) => handleUnitChange(no, k, u)} />
                ))}
            </div>
        );
    };

    const renderQuestionBlock = (q: Question, mode: TabId) => {
        const hasMeasure: boolean = q.kind === "measure" && !!FIELD_GROUPS[q.no];
        const subtitle = FIELD_GROUPS[q.no]?.note;
        const qTooltip = q.tooltip?.[lang];
        const preRemark = rowsPre[q.key]?.remark;

        // Pre-PM remark display element
        const preRemarkElement = mode === "post" && preRemark ? (
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

        if (mode === "pre") {
            const isNA = rows[q.key]?.pf === "NA";
            const isQ2NA = rows["r2"]?.pf === "NA";
            const isDependentOnQ2 = [5, 6, 7].includes(q.no);
            const isLockedByQ2 = isDependentOnQ2 && isQ2NA;
            
            return (
                <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} subtitle={subtitle} tooltip={qTooltip}>
                    <div className={`tw-p-4 tw-rounded-lg tw-border ${isNA ? "tw-bg-amber-50 tw-border-amber-200" : "tw-bg-gray-50 tw-border-blue-gray-100"}`}>
                        {/* N/A Button */}
                        <div className="tw-flex tw-items-center tw-justify-end tw-gap-2 tw-mb-3">
                            {isLockedByQ2 && (
                                <Typography variant="small" className="tw-text-amber-700 tw-italic">
                                    {lang === "th" ? "(N/A ตามข้อ 2)" : "(N/A from Q2)"}
                                </Typography>
                            )}
                            <Button 
                                size="sm" 
                                color={isNA ? "amber" : "blue-gray"} 
                                variant={isNA ? "filled" : "outlined"}
                                disabled={isLockedByQ2}
                                onClick={() => setRows(prev => ({ ...prev, [q.key]: { ...prev[q.key], pf: isNA ? "" : "NA" } }))}>
                                {isNA ? t("cancelNA", lang) : t("na", lang)}
                            </Button>
                        </div>
                        {q.hasPhoto && (
                            <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-4 tw-border-blue-gray-50">
                                <PhotoMultiInput photos={photos[q.no] || []} setPhotos={makePhotoSetter(q.no)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} />
                            </div>
                        )}
                        {hasMeasure && (
                            <div className={`tw-mb-3 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>
                                {renderMeasureGrid(q.no)}
                            </div>
                        )}
                        {q.no === 1 && (
                            <div className={`tw-mb-4 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>
                                <select required value={dropdownQ1} onChange={(e) => setDropdownQ1(e.target.value)}
                                    className="tw-max-w-sm tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500/30 focus:tw-border-blue-500">
                                    <option value="">{t("selectPowerSource", lang)}</option>
                                    {DROPDOWN_Q1_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt[lang]}</option>)}
                                </select>
                            </div>
                        )}
                        {q.no === 2 && (
                            <div className={`tw-mb-4 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>
                                <select required value={dropdownQ2} onChange={(e) => setDropdownQ2(e.target.value)}
                                    className="tw-max-w-sm tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500/30 focus:tw-border-blue-500">
                                    <option value="">{t("selectDevice", lang)}</option>
                                    {DROPDOWN_Q2_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt[lang]}</option>)}
                                </select>
                                {isNA && (
                                    <Typography variant="small" className="tw-text-amber-700 tw-mt-2">
                                        {lang === "th" ? "* ข้อ 5, 6, 7 จะเป็น N/A ตามข้อนี้" : "* Q5, 6, 7 will be N/A accordingly"}
                                    </Typography>
                                )}
                            </div>
                        )}
                        {/* Remark section for Pre mode (like Charger) */}
                        <Textarea label={t("remark", lang)} value={rows[q.key]?.remark || ""}
                            onChange={(e) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: e.target.value } })}
                            rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                    </div>
                </SectionCard>
            );
        }

        // POST MODE: Check if this item was N/A in Pre mode
        if (rowsPre[q.key]?.pf === "NA") {
            return (
                <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} subtitle={subtitle}>
                    <SkippedNAItem
                        label={q.label[lang]}
                        remark={rowsPre[q.key]?.remark}
                        lang={lang}
                    />
                </SectionCard>
            );
        }

        // POST MODE: สำหรับข้อ 1 และ 2 ให้แสดง dropdown แทน Pass/Fail/N/A
        if (mode === "post" && (q.no === 1 || q.no === 2)) {
            return (
                <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} subtitle={subtitle}>
                    <div className="tw-p-4 tw-rounded-lg tw-border tw-bg-gray-50 tw-border-blue-gray-100">
                        {q.hasPhoto && (
                            <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-4 tw-border-blue-gray-50">
                                <PhotoMultiInput photos={photos[q.no] || []} setPhotos={makePhotoSetter(q.no)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} />
                            </div>
                        )}
                        {q.no === 1 && (
                            <div className="tw-mb-4 tw-space-y-3">
                                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700 tw-mb-2">{t("powerSource", lang)}</Typography>
                                <div className="tw-p-3 tw-bg-blue-gray-50 tw-rounded tw-border tw-border-blue-gray-200">
                                    <Typography variant="small">{dropdownQ1 || "-"}</Typography>
                                </div>
                                {preRemarkElement}
                                <Textarea label={t("remark", lang)} value={rows[q.key]?.remark || ""}
                                    onChange={(e) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: e.target.value } })}
                                    rows={2} containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full" />
                            </div>
                        )}
                        {q.no === 2 && (
                            <div className="tw-mb-4 tw-space-y-3">
                                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700 tw-mb-2">{t("circuitDevice", lang)}</Typography>
                                <div className="tw-p-3 tw-bg-blue-gray-50 tw-rounded tw-border tw-border-blue-gray-200">
                                    <Typography variant="small">{dropdownQ2 || "-"}</Typography>
                                </div>
                                {preRemarkElement}
                                <Textarea label={t("remark", lang)} value={rows[q.key]?.remark || ""}
                                    onChange={(e) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: e.target.value } })}
                                    rows={2} containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full" />
                            </div>
                        )}
                    </div>
                </SectionCard>
            );
        }

        return (
            <SectionCard key={q.key} title={getQuestionLabel(q, mode, lang)} subtitle={subtitle}>
                <div className="tw-p-4 tw-rounded-lg tw-border tw-bg-gray-50 tw-border-blue-gray-100">
                    <PassFailRow label={t("testResult", lang)} value={rows[q.key]?.pf ?? ""} lang={lang}
                        onChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })}
                        remark={rows[q.key]?.remark || ""}
                        onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })}
                        aboveRemark={q.hasPhoto && (
                            <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-8 tw-border-blue-gray-50">
                                <PhotoMultiInput photos={photos[q.no] || []} setPhotos={makePhotoSetter(q.no)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} />
                            </div>
                        )}
                        beforeRemark={
                            <>
                                {hasMeasure && (q.no === 5 ? renderMeasureGridWithPre(q.no) : renderMeasureGrid(q.no))}
                                {preRemarkElement}
                            </>
                        }
                    />
                </div>
            </SectionCard>
        );
    };

    // Photo refs for draft
    const photoRefs = useMemo(() => {
        const out: Record<number, (PhotoRef | { isNA: true })[]> = {};
        Object.entries(photos).forEach(([noStr, list]) => { 
            const no = Number(noStr); 
            out[no] = (list || []).map(p => p.isNA ? { isNA: true } : p.ref).filter(Boolean) as (PhotoRef | { isNA: true })[]; 
        });
        return out;
    }, [photos]);

    // Save draft for Pre mode
    useDebouncedEffect(() => {
        if (!stationId || isPostMode) return;
        saveDraftLocal(key, { rows, m5: m5.state, summary, summary_pf: summaryCheck, photoRefs, dropdownQ1, dropdownQ2, inspector });
    }, [key, stationId, rows, m5.state, summary, summaryCheck, dropdownQ1, dropdownQ2, photoRefs, isPostMode, inspector]);

    // Save draft for Post mode
    useDebouncedEffect(() => {
        if (!stationId || !isPostMode || !editId) return;
        saveDraftLocal(postKey, { 
            rows, m5: m5.state, summary, summaryCheck, photoRefs 
        });
    }, [postKey, stationId, rows, m5.state, summary, summaryCheck, photoRefs, isPostMode, editId]);

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
        const url = side === "pre" ? `${API_BASE}/cbboxpmreport/${reportId}/pre/photos` : `${API_BASE}/cbboxpmreport/${reportId}/post/photos`;
        const res = await fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form, credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
    }

    const onPreSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }
        if (!allPhotosAttachedPre) { alert(t("alertFillPhoto", lang)); return; }
        if (!allRequiredInputsFilled) { alert(t("alertInputNotComplete", lang)); return; }
        if (!allRemarksFilledPre) { alert(`${t("alertFillRemark", lang)} ${missingRemarksPre.join(", ")}`); return; }
        if (submitting) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("access_token");
            const pm_date = job.date?.trim() || "";
            const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
            const payload = {
                station_id: stationId, issue_id: issueIdFromJob, job: jobWithoutIssueId, inspector,
                measures_pre: { m5: m5.state }, rows_pre: rows, pm_date, doc_name: docName, dropdownQ1, dropdownQ2, side: "pre" as TabId,
                comment_pre: summary,  // ✅ เพิ่ม comment สำหรับ Pre mode
            };
            const res = await fetch(`${API_BASE}/cbboxpmreport/pre/submit`, {
                method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include", body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const { report_id, doc_name } = await res.json() as { report_id: string; doc_name?: string };
            setReportId(report_id);
            if (doc_name) setDocName(doc_name);

            const uploadPromises: Promise<void>[] = [];
            Object.entries(photos).forEach(([no, list]) => { 
                const files = (list || []).map(p => p.file).filter(Boolean) as File[]; 
                if (files.length > 0) { 
                    uploadPromises.push(uploadGroupPhotos(report_id, stationId, `g${no}`, files, "pre")); 
                } 
            });
            if (uploadPromises.length > 0) { await Promise.all(uploadPromises); }
            
            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(key, p.id)));
            clearDraftLocal(key);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&tab=cb-box`);
        } catch (err: any) {
            alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`);
        } finally {
            setSubmitting(false);
        }
    };

    const onFinalSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }
        if (submitting) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("access_token");
            const finalReportId = reportId || editId;
            if (!finalReportId) throw new Error(t("noReportId", lang));
            const payload = {
                station_id: stationId, rows, measures: { m5: m5.state }, summary, dropdownQ1, dropdownQ2,
                ...(summaryCheck ? { summaryCheck } : {}), side: "post" as TabId, report_id: finalReportId,
            };
            const res = await fetch(`${API_BASE}/cbboxpmreport/submit`, {
                method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include", body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const { report_id } = await res.json() as { report_id: string };

            const uploadPromises: Promise<void>[] = [];
            Object.entries(photos).forEach(([no, list]) => { 
                const files = (list || []).map(p => p.file).filter(Boolean) as File[]; 
                if (files.length > 0) { 
                    uploadPromises.push(uploadGroupPhotos(finalReportId, stationId, `g${no}`, files, "post")); 
                } 
            });
            if (uploadPromises.length > 0) { await Promise.all(uploadPromises); }

            await fetch(`${API_BASE}/cbboxpmreport/${finalReportId}/finalize`, {
                method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                credentials: "include", body: new URLSearchParams({ station_id: stationId }),
            });
            
            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(postKey, p.id)));
            clearDraftLocal(postKey);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&tab=cb-box`);
        } catch (err: any) {
            alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`);
        } finally {
            setSubmitting(false);
        }
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
                    {/* Header with responsive layout like Charger */}
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

                    <CardBody className="tw-space-y-2">
                        {QUESTIONS.filter((q) => !(displayTab === "pre" && q.no === 9)).map((q) => renderQuestionBlock(q, displayTab))}
                    </CardBody>

                    <CardBody className="tw-space-y-3 !tw-pt-4 !tw-pb-0">
                        <Typography variant="h6" className="tw-mb-1">{t("comment", lang)}</Typography>
                        {/* แสดง comment จาก Pre mode ใน Post mode */}
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
                        <div className="tw-space-y-2">
                            <Textarea label={t("comment", lang)} value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} required={isPostMode} autoComplete="off" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                        </div>
                        {displayTab === "post" && (
                            <div className="tw-pt-4 tw-border-t tw-border-blue-gray-100">
                                <PassFailRow label={t("summaryResult", lang)} value={summaryCheck} onChange={(v) => setSummaryCheck(v)} lang={lang}
                                    labels={{ PASS: t("summaryPassLabel", lang), FAIL: t("summaryFailLabel", lang), NA: t("summaryNALabel", lang) }} />
                            </div>
                        )}
                    </CardBody>

                    <CardFooter className="tw-flex tw-flex-col tw-gap-3 tw-mt-8">
                        <div className="tw-p-3 tw-flex tw-flex-col tw-gap-3">
                            <Section title={t("validationPhotoTitle", lang)} ok={allPhotosAttached} lang={lang}>
                                <Typography variant="small" className="!tw-text-amber-700">{t("missingPhoto", lang)} {missingPhotoItems.join(", ")}</Typography>
                            </Section>
                            <Section title={t("validationInputTitle", lang)} ok={allRequiredInputsFilled} lang={lang}>
                                {allRequiredInputsFilled ? (
                                    <Typography variant="small" className="!tw-text-green-700">{t("allComplete", lang)}</Typography>
                                ) : (
                                    <div className="tw-space-y-1">
                                        <Typography variant="small" className="!tw-text-amber-700">{t("missingInput", lang)}</Typography>
                                        <ul className="tw-list-disc tw-ml-5 tw-text-sm tw-text-blue-gray-700">
                                            {missingInputs.map((line, i) => (<li key={i}>{line}</li>))}
                                        </ul>
                                    </div>
                                )}
                            </Section>
                            {/* Remark validation for Pre mode (like Charger) */}
                            {displayTab === "pre" && (
                                <Section title={t("validationRemarkTitle", lang)} ok={allRemarksFilledPre} lang={lang}>
                                    {missingRemarksPre.length > 0 && <Typography variant="small" className="!tw-text-amber-700">{t("missingRemark", lang)} {missingRemarksPre.join(", ")}</Typography>}
                                </Section>
                            )}
                            {isPostMode && (
                                <>
                                    <Section title={t("validationPFTitle", lang)} ok={allPFAnsweredForUI} lang={lang}>
                                        <Typography variant="small" className="!tw-text-amber-700">{t("missingPF", lang)} {missingPFItemsForUI.join(", ")}</Typography>
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
                                <Button color="blue" type="button" onClick={onFinalSave} disabled={!canFinalSave || submitting}
                                    title={!canFinalSave ? t("alertCompleteAll", lang) : undefined}>
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