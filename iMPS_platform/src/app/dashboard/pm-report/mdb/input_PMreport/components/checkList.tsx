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
    maxPhotos: { th: "แนบได้สูงสุด", en: "Max" },
    photoSupport: { th: "รูป • รองรับการถ่ายจากกล้องบนมือถือ", en: "photos • Supports mobile camera" },
    noPhotos: { th: "ยังไม่มีรูปแนบ", en: "No photos attached" },
    prePM: { th: "ก่อน PM", en: "Pre-PM" },
    postPM: { th: "หลัง PM", en: "Post-PM" },
    preRemarkLabel: { th: "หมายเหตุ (ก่อน PM)", en: "Remark (Pre-PM)" },
    breakerMainCount: { th: "จำนวน Breaker Main:", en: "Breaker Main count:" },
    unit: { th: "ตัว", en: "units" },
    addBreakerMain: { th: "เพิ่ม Breaker Main", en: "Add Breaker Main" },
    chargerCountLabel: { th: "จำนวนตู้ชาร์จใน Station นี้:", en: "Chargers in this station:" },
    chargerUnit: { th: "ตู้", en: "chargers" },
    breakerCCBCount: { th: "จำนวน Breaker CCB:", en: "Breaker CCB count:" },
    breakerCCBMax: { th: "ตัว (สูงสุด 4 ตัว)", en: "units (max 4)" },
    addBreakerCCB: { th: "เพิ่ม Breaker CCB", en: "Add Breaker CCB" },
    rcdCount: { th: "จำนวน RCD (ตามจำนวนตู้ชาร์จ):", en: "RCD count (per charger):" },
    breakerChargerCount: { th: "จำนวน Breaker Charger (ตามจำนวนตู้ชาร์จ):", en: "Breaker Charger (per charger):" },
    validationPhotoTitle: { th: "1) ตรวจสอบการแนบรูปภาพ (ทุกข้อ)", en: "1) Photo attachment (all items)" },
    validationInputTitle: { th: "2) อินพุตค่าแรงดันไฟฟ้า", en: "2) Voltage input values" },
    validationRemarkTitle: { th: "3) หมายเหตุ (ทุกข้อ)", en: "3) Remarks (all items)" },
    validationPFTitle: { th: "4) สถานะ PASS / FAIL / N/A ทุกข้อ", en: "4) PASS / FAIL / N/A for all" },
    validationSummaryTitle: { th: "5) สรุปผลการตรวจสอบ", en: "5) Summary result" },
    allComplete: { th: "ครบเรียบร้อย ✅", en: "Complete ✅" },
    missingPhoto: { th: "ยังไม่ได้แนบรูปข้อ:", en: "Missing photos:" },
    missingInput: { th: "ยังขาด:", en: "Missing:" },
    missingRemark: { th: "ยังไม่ได้กรอกหมายเหตุข้อ:", en: "Missing remarks:" },
    missingPF: { th: "ยังไม่ได้เลือกข้อ:", en: "Not selected:" },
    missingSummaryText: { th: "ยังไม่ได้กรอกข้อความสรุปผลการตรวจสอบ", en: "Summary text not filled" },
    missingSummaryStatus: { th: "ยังไม่ได้เลือกสถานะสรุปผล (Pass/Fail/N/A)", en: "Summary status not selected" },
    alertNoStation: { th: "ยังไม่ทราบ station_id", en: "Station ID not found" },
    alertFillVoltage: { th: "กรุณากรอกค่าแรงดันไฟฟ้าให้ครบก่อนบันทึก", en: "Please fill all voltage values" },
    alertFillRemark: { th: "กรุณากรอกหมายเหตุข้อ:", en: "Please fill remarks:" },
    alertFillPreFirst: { th: "กรุณากรอกข้อมูลในส่วน Pre ให้ครบก่อน", en: "Please complete Pre-PM first" },
    alertSaveFailed: { th: "บันทึกไม่สำเร็จ:", en: "Save failed:" },
    dustFilterChanged: { th: "เปลี่ยนแผ่นกรองระบายอากาศ", en: "Ventilation filter replaced" },
    photoNotComplete: { th: "กรุณาแนบรูปในส่วน Pre ให้ครบก่อนบันทึก", en: "Please attach all Pre-PM photos" },
    inputNotComplete: { th: "กรุณากรอกค่าข้อ 4-8 ให้ครบก่อนบันทึก", en: "Please fill items 4-8" },
    allNotComplete: { th: "กรุณากรอกข้อมูล / แนบรูป และสรุปผลให้ครบก่อนบันทึก", en: "Please complete all data" },
    skippedNA: { th: "ข้ามเนื่องจาก Pre-PM เป็น N/A", en: "Skipped (Pre-PM was N/A)" },
    remarkLabel: { th: "หมายเหตุ", en: "Remark" },
};

const t = (key: keyof typeof T, lang: Lang): string => T[key][lang];

// Questions with bilingual labels
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
    { no: 12, key: "r12", label: { th: "12) ตรวจสอบจุดต่อทางไฟฟ้า", en: "12) Check electrical connections" }, kind: "simple", hasPhoto: true, tooltip: { th: "ตรวจสอบการขันแน่นของน็อตบริเวณจุดต่อสายและและตรวจเช็ครอยไหม้ด้วยกล้องถ่ายภาพความร้อน", en: "Check bolt tightness at cable connection points and inspect for burn marks using thermal imaging camera" } },
    { no: 13, key: "r13", label: { th: "13) ทำความสะอาดตู้ MDB", en: "13) Clean MDB cabinet" }, kind: "simple", hasPhoto: true, tooltip: { th: "ทำความสะอาดโดยการขจัดฝุ่นและสิ่งสกปรกภายในตู้ด้วยเครื่องดูดฝุ่นหรือเป่าลมแห้ง และตรวจสอบความสะอาดบริเวณหน้าสัมผัสไฟฟ้า", en: "Clean by removing dust inside cabinet with vacuum or dry air" } },
] as const;

// Dynamic label generators
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
        const token = localStorage.getItem("access_token");
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const url = `${API_BASE}/chargers/${encodeURIComponent(stationId)}`;
        const res = await fetch(url, { cache: "no-store", headers, credentials: "include" });
        if (!res.ok) { console.warn("Failed to load chargers:", res.status); return 1; }
        const json = await res.json();
        const chargers = json.chargers;
        if (Array.isArray(chargers)) return chargers.length || 1;
        return 1;
    } catch (err) { console.error("getChargerCountByStation failed:", err); return 1; }
}

/* =========================
 *        CONSTANTS
 * ========================= */
const UNITS = { voltage: ["V"] as const };
type UnitVoltage = (typeof UNITS.voltage)[number];

type PhotoItem = { id: string; file?: File; preview?: string; remark?: string; uploading?: boolean; error?: string; ref?: PhotoRef; isNA?: boolean; };

type Question = {
    no: number;
    key: string;
    label: { th: string; en: string };
    kind: string;
    hasPhoto?: boolean;
    tooltip?: { th: string; en: string };
    items?: { key: string; label: { th: string; en: string } }[];
};

const VOLTAGE_FIELDS = ["L1-N", "L2-N", "L3-N", "L1-G", "L2-G", "L3-G", "L1-L2", "L2-L3", "L3-L1", "N-G"] as const;
const VOLTAGE_FIELDS_CCB = ["L1-N", "L1-G", "N-G"] as const;

const LABELS: Record<string, string> = {
    "L1-L2": "L1-L2", "L2-L3": "L2-L3", "L3-L1": "L3-L1",
    "L1-N": "L1-N", "L2-N": "L2-N", "L3-N": "L3-N",
    "L1-G": "L1-G", "L2-G": "L2-G", "L3-G": "L3-G", "N-G": "N-G",
};

const QUESTIONS = QUESTIONS_DATA as unknown as Question[];

function getQuestionLabel(q: Question, mode: TabId, lang: Lang): string {
    const baseLabel = q.label[lang];
    if (mode === "pre") return lang === "th" ? `${baseLabel} (ก่อน PM)` : `${baseLabel} (Pre-PM)`;
    return lang === "th" ? `${baseLabel} (หลัง PM)` : `${baseLabel} (Post-PM)`;
}

const FIELD_GROUPS: Record<number, { keys: readonly string[]; unitType: "voltage"; note?: string } | undefined> = {
    4: { keys: VOLTAGE_FIELDS, unitType: "voltage" },
    5: { keys: VOLTAGE_FIELDS, unitType: "voltage" },
    6: { keys: VOLTAGE_FIELDS_CCB, unitType: "voltage" },
    7: { keys: VOLTAGE_FIELDS_CCB, unitType: "voltage" },
};

/* =========================
 *        TYPES
 * ========================= */
type MeasureRow<U extends string> = { value: string; unit: U };
type MeasureState<U extends string> = Record<string, MeasureRow<U>>;
type PF = "PASS" | "FAIL" | "NA" | "";

/* =========================
 *        UTIL HOOKS
 * ========================= */
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

function PassFailRow({
    label, value, onChange, remark, onRemarkChange, labels, aboveRemark, beforeRemark, belowRemark, inlineLeft, lang,
}: {
    label: string; value: PF; onChange: (v: Exclude<PF, "">) => void;
    remark?: string; onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
    aboveRemark?: React.ReactNode; beforeRemark?: React.ReactNode; belowRemark?: React.ReactNode; inlineLeft?: React.ReactNode; lang: Lang;
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
                    {belowRemark}
                </div>
            ) : (
                <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">{buttonsRow}</div>
            )}
        </div>
    );
}

/* =========================
 *       UI ATOMS
 * ========================= */
function SectionCard({ title, subtitle, children, tooltip }: { title?: string; subtitle?: string; children: React.ReactNode; tooltip?: string; }) {
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
                {t("maxPhotos", lang)} {max} {t("photoSupport", lang)}
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

function PhotoRemarkSection({
    qKey, qNo, label, middleContent, photos, setPhotos, rows, setRows, draftKey, lang,
}: {
    qKey: string; qNo: number; label?: string; middleContent?: React.ReactNode;
    photos: Record<number | string, PhotoItem[]>;
    setPhotos: React.Dispatch<React.SetStateAction<Record<number | string, PhotoItem[]>>>;
    rows: Record<string, { pf: PF; remark: string }>;
    setRows: React.Dispatch<React.SetStateAction<Record<string, { pf: PF; remark: string }>>>;
    draftKey: string; lang: Lang;
}) {
    const isNA = rows[qKey]?.pf === "NA";
    const makePhotoSetter = (no: number): React.Dispatch<React.SetStateAction<PhotoItem[]>> => (action) => {
        setPhotos((prev) => {
            const current = prev[no] || [];
            const next = typeof action === "function" ? (action as (x: PhotoItem[]) => PhotoItem[])(current) : action;
            return { ...prev, [no]: next };
        });
    };
    return (
        <div className={`tw-p-4 tw-rounded-lg tw-border ${isNA ? "tw-bg-amber-50 tw-border-amber-200" : "tw-bg-gray-50 tw-border-blue-gray-100"}`}>
            {label && (
                <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                    <Typography className="tw-font-semibold tw-text-sm tw-text-blue-gray-800">{label}</Typography>
                </div>
            )}
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

function DynamicItemsSection({
    qNo, items, photos, setPhotos, rows, setRows, draftKey, lang,
}: {
    qNo: number; items: { key: string; label: string }[];
    photos: Record<number | string, PhotoItem[]>;
    setPhotos: React.Dispatch<React.SetStateAction<Record<number | string, PhotoItem[]>>>;
    rows: Record<string, { pf: PF; remark: string }>;
    setRows: React.Dispatch<React.SetStateAction<Record<string, { pf: PF; remark: string }>>>;
    draftKey: string; lang: Lang;
}) {
    return (
        <div className="tw-space-y-4">
            {items.map((item) => {
                const isNA = rows[item.key]?.pf === "NA";
                return (
                    <div key={item.key} className={`tw-p-4 tw-rounded-lg tw-border ${isNA ? "tw-bg-amber-50 tw-border-amber-200" : "tw-bg-gray-50 tw-border-blue-gray-100"}`}>
                        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                            <Typography className="tw-font-semibold tw-text-sm tw-text-blue-gray-800">{item.label}</Typography>
                            <Button size="sm" color={isNA ? "amber" : "blue-gray"} variant={isNA ? "filled" : "outlined"}
                                onClick={() => setRows(prev => ({ ...prev, [item.key]: { ...prev[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs">
                                {isNA ? t("cancelNA", lang) : t("na", lang)}
                            </Button>
                        </div>
                        <div className="tw-mb-3">
                            <PhotoMultiInput photos={photos[item.key] || []} setPhotos={(action) => {
                                setPhotos((prev) => {
                                    const current = prev[item.key] || [];
                                    const next = typeof action === "function" ? action(current) : action;
                                    return { ...prev, [item.key]: next };
                                });
                            }} max={10} draftKey={draftKey} qNo={qNo} lang={lang} />
                        </div>
                        <Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""}
                            onChange={(e) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { pf: "" }), remark: e.target.value } }))}
                            rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                    </div>
                );
            })}
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

// Pre-PM remark display element for Post mode
function PreRemarkElement({ remark, lang }: { remark?: string; lang: Lang }) {
    if (!remark) return null;
    return (
        <div className="tw-mb-3 tw-p-3 tw-bg-amber-50 tw-rounded-lg tw-border tw-border-amber-300">
            <div className="tw-flex tw-items-center tw-gap-2 tw-mb-1">
                <svg className="tw-w-4 tw-h-4 tw-text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <Typography variant="small" className="tw-font-semibold tw-text-amber-700">{t("preRemarkLabel", lang)}</Typography>
            </div>
            <Typography variant="small" className="tw-text-amber-900 tw-ml-6">{remark}</Typography>
        </div>
    );
}

const PM_PREFIX = "mdbpmreport";

async function fetchPreviewIssueId(stationId: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/mdbpmreport/preview-issueid`);
    u.searchParams.set("station_id", stationId);
    u.searchParams.set("pm_date", pmDate);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
    const r = await fetch(u.toString(), { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && typeof j.issue_id === "string") ? j.issue_id : null;
}

async function fetchPreviewDocName(stationId: string, pmDate: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/mdbpmreport/preview-docname`);
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
    const url = `${API_BASE}/mdbpmreport/get?station_id=${stationId}&report_id=${reportId}`;
    const res = await fetch(url, { method: "GET", headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

/* =========================
 *        MAIN COMPONENT
 * ========================= */
export default function MDBPMForm() {
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

    const [postApiLoaded, setPostApiLoaded] = useState(false);
    const [photos, setPhotos] = useState<Record<string | number, PhotoItem[]>>({});
    const [summary, setSummary] = useState<string>("");
    const [stationId, setStationId] = useState<string | null>(null);
    // const [draftId, setDraftId] = useState<string | null>(null);
    // const key = useMemo(() => draftKey(stationId), [stationId]);

    const key = useMemo(() => draftKey(stationId), [stationId]);  // Pre mode
    const postKey = useMemo(() => `${draftKey(stationId)}:${editId}:post`, [stationId, editId]);  // Post mode
    const currentDraftKey = isPostMode ? postKey : key;

    const [summaryCheck, setSummaryCheck] = useState<PF>("");
    const [inspector, setInspector] = useState<string>("");
    const [dustFilterChanged, setDustFilterChanged] = useState<boolean>(false);

    const [job, setJob] = useState({ issue_id: "", station_name: "", date: "" });

    const [rowsPre, setRowsPre] = useState<Record<string, { pf: PF; remark: string }>>({});
    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(() => {
        const initial: Record<string, { pf: PF; remark: string }> = {};
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") {
                initial[q.key] = { pf: "", remark: "" };
            } else if (q.kind === "group" && q.items) {
                q.items.forEach((item) => { initial[item.key] = { pf: "", remark: "" }; });
            }
        });
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

    // Update dynamic labels when language changes
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

    // Initialize measure states when items change
    useEffect(() => {
        setM4State((prev) => { const next = { ...prev }; q4Items.forEach((item) => { if (!next[item.key]) next[item.key] = initMeasureState(VOLTAGE_FIELDS, "V"); }); return next; });
    }, [q4Items]);
    useEffect(() => {
        setM5State((prev) => { const next = { ...prev }; q5Items.forEach((item) => { if (!next[item.key]) next[item.key] = initMeasureState(VOLTAGE_FIELDS, "V"); }); return next; });
    }, [q5Items]);
    useEffect(() => {
        setM6State((prev) => { const next = { ...prev }; q6Items.forEach((item) => { if (!next[item.key]) next[item.key] = initMeasureState(VOLTAGE_FIELDS_CCB, "V"); }); return next; });
    }, [q6Items]);
    useEffect(() => {
        setM7State((prev) => { const next = { ...prev }; q7Items.forEach((item) => { if (!next[item.key]) next[item.key] = initMeasureState(VOLTAGE_FIELDS_CCB, "V"); }); return next; });
    }, [q7Items]);

    // Initialize rows for all dynamic items
    useEffect(() => {
        setRows((prev) => {
            const next = { ...prev };
            let changed = false;
            [q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items].forEach(items => {
                items.forEach((item) => { if (!next[item.key]) { next[item.key] = { pf: "", remark: "" }; changed = true; } });
            });
            return changed ? next : prev;
        });
    }, [q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    // Add/Remove Q4 items
    const addQ4Item = () => {
        const newIndex = q4Items.length + 1;
        setQ4Items((prev) => [...prev, { key: `r4_${newIndex}`, label: getDynamicLabel.breakerMain(newIndex, lang) }]);
    };
    const removeQ4Item = (idx: number) => {
        if (q4Items.length <= 1) return;
        const keyToRemove = q4Items[idx].key;
        const newItems = q4Items.filter((_, i) => i !== idx).map((_, i) => ({ key: `r4_${i + 1}`, label: getDynamicLabel.breakerMain(i + 1, lang) }));
        setQ4Items(newItems);
        setRows((prev) => { const next = { ...prev }; delete next[keyToRemove]; return next; });
        setM4State((prev) => { const next = { ...prev }; delete next[keyToRemove]; return next; });
        setPhotos((prev) => { const next = { ...prev }; delete next[keyToRemove]; return next; });
    };

    // Add/Remove Q6 items
    const addQ6Item = () => {
        if (q6Items.length >= 4) return;
        const newIndex = q6Items.length + 1;
        setQ6Items((prev) => [...prev, { key: `r6_${newIndex}`, label: getDynamicLabel.breakerCCB(newIndex, lang) }]);
    };
    const removeQ6Item = (idx: number) => {
        if (q6Items.length <= 1) return;
        const keyToRemove = q6Items[idx].key;
        const newItems = q6Items.filter((_, i) => i !== idx).map((_, i) => ({ key: `r6_${i + 1}`, label: getDynamicLabel.breakerCCB(i + 1, lang) }));
        setQ6Items(newItems);
        setRows((prev) => { const next = { ...prev }; delete next[keyToRemove]; return next; });
        setM6State((prev) => { const next = { ...prev }; delete next[keyToRemove]; return next; });
        setPhotos((prev) => { const next = { ...prev }; delete next[keyToRemove]; return next; });
    };

    const MEASURE_BY_NO: Record<number, ReturnType<typeof useMeasure<UnitVoltage>> | undefined> = {};

    function getPreMeasureState(no: number): MeasureState<UnitVoltage> | null { return null; }

    function getDynamicPreMeasureState(no: number, itemKey: string): MeasureState<UnitVoltage> | null {
        if (no === 4) return m4Pre[itemKey] || null;
        if (no === 5) return m5Pre[itemKey] || null;
        if (no === 6) return m6Pre[itemKey] || null;
        if (no === 7) return m7Pre[itemKey] || null;
        return null;
    }

    const patchM4State = (itemKey: string, fieldKey: string, value: Partial<MeasureRow<UnitVoltage>>) => {
        setM4State((prev) => ({ ...prev, [itemKey]: { ...(prev[itemKey] || initMeasureState(VOLTAGE_FIELDS, "V")), [fieldKey]: { ...(prev[itemKey]?.[fieldKey] || { value: "", unit: "V" }), ...value } } }));
    };
    const patchM5State = (itemKey: string, fieldKey: string, value: Partial<MeasureRow<UnitVoltage>>) => {
        setM5State((prev) => ({ ...prev, [itemKey]: { ...(prev[itemKey] || initMeasureState(VOLTAGE_FIELDS, "V")), [fieldKey]: { ...(prev[itemKey]?.[fieldKey] || { value: "", unit: "V" }), ...value } } }));
    };
    const patchM6State = (itemKey: string, fieldKey: string, value: Partial<MeasureRow<UnitVoltage>>) => {
        setM6State((prev) => ({ ...prev, [itemKey]: { ...(prev[itemKey] || initMeasureState(VOLTAGE_FIELDS_CCB, "V")), [fieldKey]: { ...(prev[itemKey]?.[fieldKey] || { value: "", unit: "V" }), ...value } } }));
    };
    const patchM7State = (itemKey: string, fieldKey: string, value: Partial<MeasureRow<UnitVoltage>>) => {
        setM7State((prev) => ({ ...prev, [itemKey]: { ...(prev[itemKey] || initMeasureState(VOLTAGE_FIELDS_CCB, "V")), [fieldKey]: { ...(prev[itemKey]?.[fieldKey] || { value: "", unit: "V" }), ...value } } }));
    };

    // Effects for loading data
    useEffect(() => {
        if (!isPostMode || !editId || !stationId) return;
        (async () => {
            try {
                const data = await fetchReport(editId, stationId);
                if (data.job) setJob(prev => ({ ...prev, ...data.job, issue_id: data.issue_id ?? prev.issue_id }));
                if (data.pm_date) setJob(prev => ({ ...prev, date: data.pm_date }));
                if (data.charger_count) setChargerCount(data.charger_count);
                if (data.q4_items) setQ4Items(data.q4_items.map((item: any, i: number) => ({ ...item, label: getDynamicLabel.breakerMain(i + 1, lang) })));
                if (data.q6_items) setQ6Items(data.q6_items.map((item: any, i: number) => ({ ...item, label: getDynamicLabel.breakerCCB(i + 1, lang) })));
                if (data?.measures_pre?.m4) setM4Pre(data.measures_pre.m4);
                if (data?.measures_pre?.m5) setM5Pre(data.measures_pre.m5);
                if (data?.measures_pre?.m6) setM6Pre(data.measures_pre.m6);
                if (data?.measures_pre?.m7) setM7Pre(data.measures_pre.m7);
                if (data.doc_name) setDocName(data.doc_name);
                if (data.inspector) setInspector(data.inspector);
                if (data.rows_pre) setRowsPre(data.rows_pre);
                if (data.rows) {
                    setRows((prev) => { const next = { ...prev }; Object.entries(data.rows).forEach(([k, v]) => { next[k] = v as { pf: PF; remark: string }; }); return next; });
                } else if (data.rows_pre) {
                    setRows((prev) => { const next = { ...prev }; Object.entries(data.rows_pre).forEach(([k, v]) => { const preRow = v as { pf: PF; remark: string }; next[k] = { pf: preRow.pf, remark: "" }; }); return next; });
                }
                setPostApiLoaded(true);
            } catch (err) {
                console.error("load report failed:", err);
                setPostApiLoaded(true);
            }
        })();
    }, [isPostMode, editId, stationId, lang]);

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
        if (isPostMode) return;
        if (!stationId || !job.date) return;
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
        if (isPostMode) return;
        if (!stationId || !job.date) return;
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
        const defaultDate = new Date().toISOString().slice(0, 10);
        setJob((prev) => { if (prev.date) return prev; return { ...prev, date: defaultDate }; });
        getStationInfoPublic(sid).then((stationInfo) => { setJob((prev) => ({ ...prev, station_name: stationInfo.station_name ?? prev.station_name })); }).catch((err) => console.error("load public station info failed:", err));
        getChargerCountByStation(sid).then((count) => { setChargerCount(count); }).catch((err) => console.error("load charger count failed:", err));
    }, [isPostMode]);

    // useEffect(() => {
    //     const params = new URLSearchParams(window.location.search);
    //     let d = params.get("draft_id");
    //     if (!d) {
    //         d = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : String(Date.now());
    //         params.set("draft_id", d);
    //         const url = `${window.location.pathname}?${params.toString()}`;
    //         window.history.replaceState({}, "", url);
    //     }
    //     setDraftId(d);
    // }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        if (params.has("draft_id")) {
            params.delete("draft_id");
            const url = `${window.location.pathname}?${params.toString()}`;
            window.history.replaceState({}, "", url);
        }
    }, []);

    useEffect(() => {
        if (!stationId || isPostMode) return;
        const draft = loadDraftLocal<{
            rows: typeof rows; m4: Record<string, MeasureState<UnitVoltage>>; m5: Record<string, MeasureState<UnitVoltage>>;
            m6: Record<string, MeasureState<UnitVoltage>>; m7: Record<string, MeasureState<UnitVoltage>>;
            summary: string; summary_pf?: PF; dustFilterChanged?: boolean; photoRefs?: Record<string | number, PhotoRef[]>;
            q4_items?: typeof q4Items; q6_items?: typeof q6Items; charger_count?: number;
        }>(key);
        if (!draft) return;
        setRows(draft.rows);
        if (draft.m4) setM4State(draft.m4);
        if (draft.m5) setM5State(draft.m5);
        if (draft.m6) setM6State(draft.m6);
        if (draft.m7) setM7State(draft.m7);
        setDustFilterChanged(draft.dustFilterChanged ?? false);
        setSummary(draft.summary);
        if (draft.summary_pf) setSummaryCheck(draft.summary_pf);
        if (draft.q4_items) setQ4Items(draft.q4_items.map((item, i) => ({ ...item, label: getDynamicLabel.breakerMain(i + 1, lang) })));
        if (draft.q6_items) setQ6Items(draft.q6_items.map((item, i) => ({ ...item, label: getDynamicLabel.breakerCCB(i + 1, lang) })));
        if (draft.charger_count) setChargerCount(draft.charger_count);
        (async () => {
            if (!draft.photoRefs) return;
            const next: Record<string | number, PhotoItem[]> = {};
            for (const [keyStr, refs] of Object.entries(draft.photoRefs)) {
                const photoKey = isNaN(Number(keyStr)) ? keyStr : Number(keyStr);
                const items: PhotoItem[] = [];
                for (const ref of refs || []) {
                    const file = await getPhoto(key, ref.id);
                    if (!file) continue;
                    items.push({ id: ref.id, file, preview: URL.createObjectURL(file), remark: ref.remark ?? "", ref });
                }
                next[photoKey] = items;
            }
            setPhotos(next);
        })();
    }, [stationId, key, lang, isPostMode]);

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

    const makePhotoSetter = (key: string | number): React.Dispatch<React.SetStateAction<PhotoItem[]>> => {
        return (action: React.SetStateAction<PhotoItem[]>) => {
            setPhotos((prev) => {
                const current = prev[key] ?? [];
                const next = typeof action === "function" ? (action as (x: PhotoItem[]) => PhotoItem[])(current) : action;
                return { ...prev, [key]: next };
            });
        };
    };

    // Validations
    const validPhotoKeysPre = useMemo(() => {
        const keys: { key: string | number; label: string }[] = [];
        QUESTIONS.filter(q => q.hasPhoto && q.no !== 13).forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") keys.push({ key: q.no, label: `${q.no}` });
            else if (q.kind === "dynamic_measure") q4Items.forEach((item, idx) => keys.push({ key: item.key, label: `4.${idx + 1}` }));
            else if (q.kind === "charger_measure") q5Items.forEach((item, idx) => keys.push({ key: item.key, label: `5.${idx + 1}` }));
            else if (q.kind === "ccb_measure") q6Items.forEach((item, idx) => keys.push({ key: item.key, label: `6.${idx + 1}` }));
            else if (q.kind === "rcd_measure") q7Items.forEach((item, idx) => keys.push({ key: item.key, label: `7.${idx + 1}` }));
            else if (q.kind === "trip_rcd") q8Items.forEach((item, idx) => keys.push({ key: item.key, label: `8.${idx + 1}` }));
            else if (q.kind === "trip_ccb") q9Items.forEach((item, idx) => keys.push({ key: item.key, label: `9.${idx + 1}` }));
            else if (q.kind === "trip_charger") q10Items.forEach((item, idx) => keys.push({ key: item.key, label: `10.${idx + 1}` }));
            else if (q.kind === "trip_main") q11Items.forEach((item, idx) => keys.push({ key: item.key, label: `11.${idx + 1}` }));
            else if (q.kind === "group" && q.items) q.items.forEach((item, idx) => keys.push({ key: item.key, label: `${q.no}.${idx + 1}` }));
        });
        return keys;
    }, [q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    const validPhotoKeysPost = useMemo(() => {
        const keys: { key: string | number; label: string }[] = [];
        QUESTIONS.filter(q => q.hasPhoto).forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") { if (rowsPre[q.key]?.pf === "NA") return; keys.push({ key: q.no, label: `${q.no}` }); }
            else if (q.kind === "dynamic_measure") q4Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `4.${idx + 1}` }); });
            else if (q.kind === "charger_measure") q5Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `5.${idx + 1}` }); });
            else if (q.kind === "ccb_measure") q6Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `6.${idx + 1}` }); });
            else if (q.kind === "rcd_measure") q7Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `7.${idx + 1}` }); });
            else if (q.kind === "trip_rcd") q8Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `8.${idx + 1}` }); });
            else if (q.kind === "trip_ccb") q9Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `9.${idx + 1}` }); });
            else if (q.kind === "trip_charger") q10Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `10.${idx + 1}` }); });
            else if (q.kind === "trip_main") q11Items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `11.${idx + 1}` }); });
            else if (q.kind === "group" && q.items) q.items.forEach((item, idx) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push({ key: item.key, label: `${q.no}.${idx + 1}` }); });
        });
        return keys;
    }, [rowsPre, q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    const missingPhotoItemsPre = useMemo(() => {
        return validPhotoKeysPre.filter(({ key }) => (photos[key]?.length ?? 0) < 1).map(({ label }) => label)
            .sort((a, b) => { const [aMain, aSub] = a.split('.').map(Number); const [bMain, bSub] = b.split('.').map(Number); if (aMain !== bMain) return aMain - bMain; return (aSub || 0) - (bSub || 0); });
    }, [photos, validPhotoKeysPre]);

    const missingPhotoItemsPost = useMemo(() => {
        return validPhotoKeysPost.filter(({ key }) => (photos[key]?.length ?? 0) < 1).map(({ label }) => label)
            .sort((a, b) => { const [aMain, aSub] = a.split('.').map(Number); const [bMain, bSub] = b.split('.').map(Number); if (aMain !== bMain) return aMain - bMain; return (aSub || 0) - (bSub || 0); });
    }, [photos, validPhotoKeysPost]);

    const allPhotosAttachedPre = missingPhotoItemsPre.length === 0;
    const allPhotosAttachedPost = missingPhotoItemsPost.length === 0;
    const missingPhotoItems = isPostMode ? missingPhotoItemsPost : missingPhotoItemsPre;
    const allPhotosAttached = isPostMode ? allPhotosAttachedPost : allPhotosAttachedPre;

    // Remarks validation
    const validRemarkKeysPre = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.filter(q => q.no !== 13).forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") keys.push(q.key);
            else if (q.kind === "dynamic_measure") q4Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "charger_measure") q5Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "ccb_measure") q6Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "rcd_measure") q7Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "trip_rcd") q8Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "trip_ccb") q9Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "trip_charger") q10Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "trip_main") q11Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "group" && q.items) q.items.forEach((item) => keys.push(item.key));
        });
        return keys;
    }, [q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    const missingRemarksPre = useMemo(() => {
        const missing: string[] = [];
        validRemarkKeysPre.forEach((key) => {
            const val = rows[key];
            if (!val?.remark?.trim()) {
                const match = key.match(/^r(\d+)(?:_(\d+))?$/);
                if (match) { const qNo = match[1]; const subNo = match[2]; missing.push(subNo ? `${qNo}.${subNo}` : qNo); }
            }
        });
        return missing.sort((a, b) => { const [aMain, aSub] = a.split('.').map(Number); const [bMain, bSub] = b.split('.').map(Number); if (aMain !== bMain) return aMain - bMain; return (aSub || 0) - (bSub || 0); });
    }, [rows, validRemarkKeysPre]);

    const allRemarksFilledPre = missingRemarksPre.length === 0;

    const validRemarkKeysPost = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") { if (rowsPre[q.key]?.pf === "NA") return; keys.push(q.key); }
            else if (q.kind === "dynamic_measure") q4Items.forEach((item) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push(item.key); });
            else if (q.kind === "charger_measure") q5Items.forEach((item) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push(item.key); });
            else if (q.kind === "ccb_measure") q6Items.forEach((item) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push(item.key); });
            else if (q.kind === "rcd_measure") q7Items.forEach((item) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push(item.key); });
            else if (q.kind === "trip_rcd") q8Items.forEach((item) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push(item.key); });
            else if (q.kind === "trip_ccb") q9Items.forEach((item) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push(item.key); });
            else if (q.kind === "trip_charger") q10Items.forEach((item) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push(item.key); });
            else if (q.kind === "trip_main") q11Items.forEach((item) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push(item.key); });
            else if (q.kind === "group" && q.items) q.items.forEach((item) => { if (rowsPre[item.key]?.pf === "NA") return; keys.push(item.key); });
        });
        return keys;
    }, [rowsPre, q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    const missingRemarksPost = useMemo(() => {
        const missing: string[] = [];
        validRemarkKeysPost.forEach((key) => {
            const val = rows[key];
            if (!val?.remark?.trim()) {
                const match = key.match(/^r(\d+)(?:_(\d+))?$/);
                if (match) { const qNo = match[1]; const subNo = match[2]; missing.push(subNo ? `${qNo}.${subNo}` : qNo); }
            }
        });
        return missing.sort((a, b) => { const [aMain, aSub] = a.split('.').map(Number); const [bMain, bSub] = b.split('.').map(Number); if (aMain !== bMain) return aMain - bMain; return (aSub || 0) - (bSub || 0); });
    }, [rows, validRemarkKeysPost]);

    const allRemarksFilledPost = missingRemarksPost.length === 0;

    // PF validation
    const PF_KEYS_ALL = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") keys.push(q.key);
            else if (q.kind === "dynamic_measure") q4Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "charger_measure") q5Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "ccb_measure") q6Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "rcd_measure") q7Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "trip_rcd") q8Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "trip_ccb") q9Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "trip_charger") q10Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "trip_main") q11Items.forEach((item) => keys.push(item.key));
            else if (q.kind === "group" && q.items) q.items.forEach((item) => keys.push(item.key));
        });
        return keys;
    }, [q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    const PF_KEYS_POST = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") { if (rowsPre[q.key]?.pf !== "NA") keys.push(q.key); }
            else if (q.kind === "dynamic_measure") q4Items.forEach((item) => { if (rowsPre[item.key]?.pf !== "NA") keys.push(item.key); });
            else if (q.kind === "charger_measure") q5Items.forEach((item) => { if (rowsPre[item.key]?.pf !== "NA") keys.push(item.key); });
            else if (q.kind === "ccb_measure") q6Items.forEach((item) => { if (rowsPre[item.key]?.pf !== "NA") keys.push(item.key); });
            else if (q.kind === "rcd_measure") q7Items.forEach((item) => { if (rowsPre[item.key]?.pf !== "NA") keys.push(item.key); });
            else if (q.kind === "trip_rcd") q8Items.forEach((item) => { if (rowsPre[item.key]?.pf !== "NA") keys.push(item.key); });
            else if (q.kind === "trip_ccb") q9Items.forEach((item) => { if (rowsPre[item.key]?.pf !== "NA") keys.push(item.key); });
            else if (q.kind === "trip_charger") q10Items.forEach((item) => { if (rowsPre[item.key]?.pf !== "NA") keys.push(item.key); });
            else if (q.kind === "trip_main") q11Items.forEach((item) => { if (rowsPre[item.key]?.pf !== "NA") keys.push(item.key); });
            else if (q.kind === "group" && q.items) q.items.forEach((item) => { if (rowsPre[item.key]?.pf !== "NA") keys.push(item.key); });
        });
        return keys;
    }, [rowsPre, q4Items, q5Items, q6Items, q7Items, q8Items, q9Items, q10Items, q11Items]);

    const allPFAnsweredAll = useMemo(() => PF_KEYS_ALL.every((k) => rows[k]?.pf !== ""), [rows, PF_KEYS_ALL]);
    const allPFAnsweredPost = useMemo(() => PF_KEYS_POST.every((k) => rows[k]?.pf !== ""), [rows, PF_KEYS_POST]);

    const missingPFItemsAll = useMemo(() => {
        return PF_KEYS_ALL.filter((k) => !rows[k]?.pf).map((k) => k.replace(/^r(\d+)_?(\d+)?$/, (_, a, b) => (b ? `${a}.${b}` : a)))
            .sort((a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0]));
    }, [rows, PF_KEYS_ALL]);

    const missingPFItemsPost = useMemo(() => {
        return PF_KEYS_POST.filter((k) => !rows[k]?.pf).map((k) => k.replace(/^r(\d+)_?(\d+)?$/, (_, a, b) => (b ? `${a}.${b}` : a)))
            .sort((a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0]));
    }, [rows, PF_KEYS_POST]);

    // Input validation - FIXED: check rowsPre for N/A
    const missingInputs = useMemo(() => {
        const r: Record<string, string[]> = {};
        q4Items.forEach((item) => {
            if (rowsPre[item.key]?.pf === "NA") return; // Skip if Pre is N/A
            if (rows[item.key]?.pf === "NA") return;
            const state = m4State[item.key];
            if (!state) { r[item.label] = [...VOLTAGE_FIELDS]; }
            else { const missing = VOLTAGE_FIELDS.filter((k) => !String(state[k]?.value ?? "").trim()); if (missing.length > 0) r[item.label] = missing; }
        });
        q5Items.forEach((item) => {
            if (rowsPre[item.key]?.pf === "NA") return; // Skip if Pre is N/A
            if (rows[item.key]?.pf === "NA") return;
            const state = m5State[item.key];
            if (!state) { r[item.label] = [...VOLTAGE_FIELDS]; }
            else { const missing = VOLTAGE_FIELDS.filter((k) => !String(state[k]?.value ?? "").trim()); if (missing.length > 0) r[item.label] = missing; }
        });
        q6Items.forEach((item) => {
            if (rowsPre[item.key]?.pf === "NA") return; // Skip if Pre is N/A
            if (rows[item.key]?.pf === "NA") return;
            const state = m6State[item.key];
            if (!state) { r[item.label] = [...VOLTAGE_FIELDS_CCB]; }
            else { const missing = VOLTAGE_FIELDS_CCB.filter((k) => !String(state[k]?.value ?? "").trim()); if (missing.length > 0) r[item.label] = missing; }
        });
        q7Items.forEach((item) => {
            if (rowsPre[item.key]?.pf === "NA") return; // Skip if Pre is N/A
            if (rows[item.key]?.pf === "NA") return;
            const state = m7State[item.key];
            if (!state) { r[item.label] = [...VOLTAGE_FIELDS_CCB]; }
            else { const missing = VOLTAGE_FIELDS_CCB.filter((k) => !String(state[k]?.value ?? "").trim()); if (missing.length > 0) r[item.label] = missing; }
        });
        return r;
    }, [m4State, m5State, m6State, m7State, q4Items, q5Items, q6Items, q7Items, rows, rowsPre]);

    const allRequiredInputsFilled = useMemo(() => Object.values(missingInputs).every((arr) => arr.length === 0), [missingInputs]);

    const missingInputsTextLines = useMemo(() => {
        const lines: string[] = [];
        (Object.entries(missingInputs) as [string, string[]][]).forEach(([label, arr]) => { if (arr.length > 0) lines.push(`${label}: ${arr.map((k) => LABELS[k] ?? k).join(", ")}`); });
        return lines;
    }, [missingInputs]);

    const isSummaryFilled = summary.trim().length > 0;
    const isSummaryCheckFilled = summaryCheck !== "";
    const canGoAfter = isPostMode ? true : (allPhotosAttachedPre && allRequiredInputsFilled && allRemarksFilledPre);
    const canFinalSave = allPhotosAttachedPost && allPFAnsweredPost && allRequiredInputsFilled && allRemarksFilledPost && isSummaryFilled && isSummaryCheckFilled;

    const active: TabId = useMemo(() => slugToTab(searchParams.get("pmtab")), [searchParams]);
    const displayTab: TabId = isPostMode ? "post" : (active === "post" && !canGoAfter ? "pre" : active);

    // Unit change handler
    const handleUnitChange = (no: number, key: string, u: UnitVoltage) => { const m = MEASURE_BY_NO[no]; if (!m) return; const firstKey = (FIELD_GROUPS[no]?.keys ?? [key])[0] as string; if (key !== firstKey) m.patch(firstKey, { unit: u }); m.syncUnits(u); };

    // Render measure grids
    const renderMeasureGrid = (no: number) => {
        const cfg = FIELD_GROUPS[no];
        const m = MEASURE_BY_NO[no];
        if (!cfg || !m) return null;
        return (
            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                {cfg.keys.map((k) => (
                    <InputWithUnit<UnitVoltage> key={`${no}-${k}`} label={LABELS[k] ?? k} value={m.state[k]?.value || ""} unit={(m.state[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                        onValueChange={(v) => m.patch(k, { value: v })} onUnitChange={(u) => handleUnitChange(no, k, u)} />
                ))}
            </div>
        );
    };

    const renderDynamicMeasureGrid = (qNo: number, itemKey: string) => {
        let state: MeasureState<UnitVoltage> | undefined;
        let patchFn: (itemKey: string, fieldKey: string, value: Partial<MeasureRow<UnitVoltage>>) => void;
        let fields: readonly string[];
        if (qNo === 4) { state = m4State[itemKey]; patchFn = patchM4State; fields = VOLTAGE_FIELDS; }
        else if (qNo === 5) { state = m5State[itemKey]; patchFn = patchM5State; fields = VOLTAGE_FIELDS; }
        else if (qNo === 6) { state = m6State[itemKey]; patchFn = patchM6State; fields = VOLTAGE_FIELDS_CCB; }
        else if (qNo === 7) { state = m7State[itemKey]; patchFn = patchM7State; fields = VOLTAGE_FIELDS_CCB; }
        else return null;
        return (
            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                {fields.map((k) => (
                    <InputWithUnit<UnitVoltage> key={`${qNo}-${itemKey}-${k}`} label={LABELS[k] ?? k} value={state?.[k]?.value || ""} unit={(state?.[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                        onValueChange={(v) => patchFn(itemKey, k, { value: v })} onUnitChange={(u) => patchFn(itemKey, k, { unit: u })} />
                ))}
            </div>
        );
    };

    const renderDynamicMeasureGridWithPre = (qNo: number, itemKey: string) => {
        let state: MeasureState<UnitVoltage> | undefined;
        let preState: MeasureState<UnitVoltage> | undefined;
        let patchFn: (itemKey: string, fieldKey: string, value: Partial<MeasureRow<UnitVoltage>>) => void;
        let fields: readonly string[];
        if (qNo === 4) { state = m4State[itemKey]; preState = m4Pre[itemKey]; patchFn = patchM4State; fields = VOLTAGE_FIELDS; }
        else if (qNo === 5) { state = m5State[itemKey]; preState = m5Pre[itemKey]; patchFn = patchM5State; fields = VOLTAGE_FIELDS; }
        else if (qNo === 6) { state = m6State[itemKey]; preState = m6Pre[itemKey]; patchFn = patchM6State; fields = VOLTAGE_FIELDS_CCB; }
        else if (qNo === 7) { state = m7State[itemKey]; preState = m7Pre[itemKey]; patchFn = patchM7State; fields = VOLTAGE_FIELDS_CCB; }
        else return null;
        return (
            <div className="tw-space-y-3">
                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700">{t("prePM", lang)}</Typography>
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {fields.map((k) => (
                        <div key={`pre-${qNo}-${itemKey}-${k}`} className="tw-pointer-events-none tw-opacity-60">
                            <InputWithUnit<UnitVoltage> label={LABELS[k] ?? k} value={preState?.[k]?.value || ""} unit={(preState?.[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                                onValueChange={() => { }} onUnitChange={() => { }} readOnly required={false} />
                        </div>
                    ))}
                </div>
                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700 tw-mt-2">{t("postPM", lang)}</Typography>
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {fields.map((k) => (
                        <InputWithUnit<UnitVoltage> key={`post-${qNo}-${itemKey}-${k}`} label={LABELS[k] ?? k} value={state?.[k]?.value || ""} unit={(state?.[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                            onValueChange={(v) => patchFn(itemKey, k, { value: v })} onUnitChange={(u) => patchFn(itemKey, k, { unit: u })} />
                    ))}
                </div>
            </div>
        );
    };

    const renderMeasureGridWithPre = (no: number) => {
        const cfg = FIELD_GROUPS[no];
        const m = MEASURE_BY_NO[no];
        const pre = getPreMeasureState(no);
        if (!cfg || !m || !pre) return null;
        return (
            <div className="tw-space-y-3">
                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700">{t("prePM", lang)}</Typography>
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.keys.map((k) => (
                        <div key={`pre-${no}-${k}`} className="tw-pointer-events-none tw-opacity-60">
                            <InputWithUnit<UnitVoltage> label={LABELS[k] ?? k} value={pre[k]?.value || ""} unit={(pre[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                                onValueChange={() => { }} onUnitChange={() => { }} readOnly required={false} />
                        </div>
                    ))}
                </div>
                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700 tw-mt-2">{t("postPM", lang)}</Typography>
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.keys.map((k) => (
                        <InputWithUnit<UnitVoltage> key={`post-${no}-${k}`} label={LABELS[k] ?? k} value={m.state[k]?.value || ""} unit={(m.state[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                            onValueChange={(v) => m.patch(k, { value: v })} onUnitChange={(u) => handleUnitChange(no, k, u)} />
                    ))}
                </div>
            </div>
        );
    };

    // Render question block
    const renderQuestionBlock = (q: Question, mode: TabId) => {
        const hasMeasure: boolean = q.kind === "measure" && !!FIELD_GROUPS[q.no];
        const subtitle = FIELD_GROUPS[q.no]?.note;
        const qLabel = getQuestionLabel(q, mode, lang);
        const qTooltip = q.tooltip?.[lang];

        // ========== PRE MODE ==========
        if (mode === "pre") {
            // Dynamic Measure Q4
            if (q.kind === "dynamic_measure") {
                return (
                    <SectionCard key={q.key} title={qLabel} subtitle={subtitle} tooltip={qTooltip}>
                        <div className="tw-space-y-4">
                            <div className="tw-flex tw-items-center tw-justify-between tw-pb-3 tw-border-b tw-border-blue-gray-100">
                                <Typography variant="small" className="tw-text-blue-gray-600">{t("breakerMainCount", lang)} {q4Items.length} {t("unit", lang)}</Typography>
                                <Button size="sm" color="blue" variant="outlined" onClick={addQ4Item} className="tw-flex tw-items-center tw-gap-1">
                                    <span className="tw-text-lg tw-leading-none">+</span>
                                    <span className="tw-text-xs">{t("addBreakerMain", lang)}</span>
                                </Button>
                            </div>
                            {q4Items.map((item, idx) => {
                                const isNA = rows[item.key]?.pf === "NA";
                                return (
                                    <div key={item.key} className={`tw-p-4 tw-rounded-lg tw-border ${isNA ? "tw-bg-amber-50 tw-border-amber-200" : "tw-bg-gray-50 tw-border-blue-gray-100"}`}>
                                        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                            <Typography className="tw-font-semibold tw-text-sm tw-text-blue-gray-800">{item.label}</Typography>
                                            <div className="tw-flex tw-items-center tw-gap-2">
                                                <Button size="sm" color={isNA ? "amber" : "blue-gray"} variant={isNA ? "filled" : "outlined"} onClick={() => setRows(prev => ({ ...prev, [item.key]: { ...prev[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs">{isNA ? t("cancelNA", lang) : t("na", lang)}</Button>
                                                {q4Items.length > 1 && (
                                                    <button type="button" onClick={() => removeQ4Item(idx)} className="tw-h-6 tw-w-6 tw-flex tw-items-center tw-justify-center tw-rounded tw-bg-red-50 tw-text-red-600 hover:tw-bg-red-100">
                                                        <svg className="tw-w-3.5 tw-h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="tw-mb-3"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} /></div>
                                        <div className={`tw-mb-3 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>{renderDynamicMeasureGrid(4, item.key)}</div>
                                        <Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""} onChange={(e) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { pf: "" }), remark: e.target.value } }))} rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                                    </div>
                                );
                            })}
                        </div>
                    </SectionCard>
                );
            }

            // Charger Measure Q5
            if (q.kind === "charger_measure") {
                return (
                    <SectionCard key={q.key} title={qLabel} subtitle={subtitle} tooltip={qTooltip}>
                        <div className="tw-space-y-4">
                            <div className="tw-flex tw-items-center tw-gap-2 tw-pb-3 tw-border-b tw-border-blue-gray-100">
                                <Typography variant="small" className="tw-text-blue-gray-600">{t("chargerCountLabel", lang)}</Typography>
                                <Typography variant="small" className="tw-font-bold tw-text-blue-600">{chargerCount} {t("chargerUnit", lang)}</Typography>
                            </div>
                            {q5Items.map((item) => {
                                const isNA = rows[item.key]?.pf === "NA";
                                return (
                                    <div key={item.key} className={`tw-p-4 tw-rounded-lg tw-border ${isNA ? "tw-bg-amber-50 tw-border-amber-200" : "tw-bg-gray-50 tw-border-blue-gray-100"}`}>
                                        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                            <Typography className="tw-font-semibold tw-text-sm tw-text-blue-gray-800">{item.label}</Typography>
                                            <Button size="sm" color={isNA ? "amber" : "blue-gray"} variant={isNA ? "filled" : "outlined"} onClick={() => setRows(prev => ({ ...prev, [item.key]: { ...prev[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs">{isNA ? t("cancelNA", lang) : t("na", lang)}</Button>
                                        </div>
                                        <div className="tw-mb-3"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} /></div>
                                        <div className={`tw-mb-3 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>{renderDynamicMeasureGrid(5, item.key)}</div>
                                        <Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""} onChange={(e) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { pf: "" }), remark: e.target.value } }))} rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                                    </div>
                                );
                            })}
                        </div>
                    </SectionCard>
                );
            }

            // CCB Measure Q6
            if (q.kind === "ccb_measure") {
                return (
                    <SectionCard key={q.key} title={qLabel} subtitle={subtitle} tooltip={qTooltip}>
                        <div className="tw-space-y-4">
                            <div className="tw-flex tw-items-center tw-justify-between tw-pb-3 tw-border-b tw-border-blue-gray-100">
                                <Typography variant="small" className="tw-text-blue-gray-600">{t("breakerCCBCount", lang)} {q6Items.length} {t("breakerCCBMax", lang)}</Typography>
                                <Button size="sm" color="blue" variant="outlined" onClick={addQ6Item} disabled={q6Items.length >= 4} className="tw-flex tw-items-center tw-gap-1">
                                    <span className="tw-text-lg tw-leading-none">+</span>
                                    <span className="tw-text-xs">{t("addBreakerCCB", lang)}</span>
                                </Button>
                            </div>
                            {q6Items.map((item, idx) => {
                                const isNA = rows[item.key]?.pf === "NA";
                                return (
                                    <div key={item.key} className={`tw-p-4 tw-rounded-lg tw-border ${isNA ? "tw-bg-amber-50 tw-border-amber-200" : "tw-bg-gray-50 tw-border-blue-gray-100"}`}>
                                        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                            <Typography className="tw-font-semibold tw-text-sm tw-text-blue-gray-800">{item.label}</Typography>
                                            <div className="tw-flex tw-items-center tw-gap-2">
                                                <Button size="sm" color={isNA ? "amber" : "blue-gray"} variant={isNA ? "filled" : "outlined"} onClick={() => setRows(prev => ({ ...prev, [item.key]: { ...prev[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs">{isNA ? t("cancelNA", lang) : t("na", lang)}</Button>
                                                {q6Items.length > 1 && (
                                                    <button type="button" onClick={() => removeQ6Item(idx)} className="tw-h-6 tw-w-6 tw-flex tw-items-center tw-justify-center tw-rounded tw-bg-red-50 tw-text-red-600 hover:tw-bg-red-100">
                                                        <svg className="tw-w-3.5 tw-h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="tw-mb-3"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} /></div>
                                        <div className={`tw-mb-3 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>{renderDynamicMeasureGrid(6, item.key)}</div>
                                        <Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""} onChange={(e) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { pf: "" }), remark: e.target.value } }))} rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                                    </div>
                                );
                            })}
                        </div>
                    </SectionCard>
                );
            }

            // RCD Measure Q7
            if (q.kind === "rcd_measure") {
                return (
                    <SectionCard key={q.key} title={qLabel} subtitle={subtitle} tooltip={qTooltip}>
                        <div className="tw-space-y-4">
                            <div className="tw-flex tw-items-center tw-gap-2 tw-pb-3 tw-border-b tw-border-blue-gray-100">
                                <Typography variant="small" className="tw-text-blue-gray-600">{t("rcdCount", lang)} {chargerCount} {t("unit", lang)}</Typography>
                            </div>
                            {q7Items.map((item) => {
                                const isNA = rows[item.key]?.pf === "NA";
                                return (
                                    <div key={item.key} className={`tw-p-4 tw-rounded-lg tw-border ${isNA ? "tw-bg-amber-50 tw-border-amber-200" : "tw-bg-gray-50 tw-border-blue-gray-100"}`}>
                                        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                            <Typography className="tw-font-semibold tw-text-sm tw-text-blue-gray-800">{item.label}</Typography>
                                            <Button size="sm" color={isNA ? "amber" : "blue-gray"} variant={isNA ? "filled" : "outlined"} onClick={() => setRows(prev => ({ ...prev, [item.key]: { ...prev[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs">{isNA ? t("cancelNA", lang) : t("na", lang)}</Button>
                                        </div>
                                        <div className="tw-mb-3"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} /></div>
                                        <div className={`tw-mb-3 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>{renderDynamicMeasureGrid(7, item.key)}</div>
                                        <Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""} onChange={(e) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { pf: "" }), remark: e.target.value } }))} rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                                    </div>
                                );
                            })}
                        </div>
                    </SectionCard>
                );
            }

            // Trip tests Q8-Q11
            const tripConfigs: Record<string, { items: typeof q8Items; countLabel: string; count: number | string }> = {
                trip_rcd: { items: q8Items, countLabel: t("rcdCount", lang), count: chargerCount },
                trip_ccb: { items: q9Items, countLabel: t("breakerCCBCount", lang), count: q6Items.length },
                trip_charger: { items: q10Items, countLabel: t("breakerChargerCount", lang), count: chargerCount },
                trip_main: { items: q11Items, countLabel: t("breakerMainCount", lang), count: q4Items.length },
            };

            if (tripConfigs[q.kind]) {
                const cfg = tripConfigs[q.kind];
                return (
                    <SectionCard key={q.key} title={qLabel} subtitle={subtitle} tooltip={qTooltip}>
                        <div className="tw-space-y-4">
                            <div className="tw-flex tw-items-center tw-gap-2 tw-pb-3 tw-border-b tw-border-blue-gray-100">
                                <Typography variant="small" className="tw-text-blue-gray-600">{cfg.countLabel} {cfg.count} {t("unit", lang)}</Typography>
                            </div>
                            {cfg.items.map((item) => {
                                const isNA = rows[item.key]?.pf === "NA";
                                return (
                                    <div key={item.key} className={`tw-p-4 tw-rounded-lg tw-border ${isNA ? "tw-bg-amber-50 tw-border-amber-200" : "tw-bg-gray-50 tw-border-blue-gray-100"}`}>
                                        <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
                                            <Typography className="tw-font-semibold tw-text-sm tw-text-blue-gray-800">{item.label}</Typography>
                                            <Button size="sm" color={isNA ? "amber" : "blue-gray"} variant={isNA ? "filled" : "outlined"} onClick={() => setRows(prev => ({ ...prev, [item.key]: { ...prev[item.key], pf: isNA ? "" : "NA" } }))} className="tw-text-xs">{isNA ? t("cancelNA", lang) : t("na", lang)}</Button>
                                        </div>
                                        <div className="tw-mb-3"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} /></div>
                                        <Textarea label={t("remark", lang)} value={rows[item.key]?.remark ?? ""} onChange={(e) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { pf: "" }), remark: e.target.value } }))} rows={3} required containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                                    </div>
                                );
                            })}
                        </div>
                    </SectionCard>
                );
            }

            // Simple questions
            return (
                <SectionCard key={q.key} title={qLabel} subtitle={subtitle} tooltip={qTooltip}>
                    <div className="tw-space-y-4">
                        {q.kind === "simple" && q.hasPhoto && (
                            <PhotoRemarkSection qKey={q.key} qNo={q.no} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />
                        )}
                        {hasMeasure && q.hasPhoto && (
                            <PhotoRemarkSection qKey={q.key} qNo={q.no} middleContent={renderMeasureGrid(q.no)} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />
                        )}
                        {q.kind === "group" && q.hasPhoto && q.items && (
                            <DynamicItemsSection qNo={q.no} items={q.items.map(it => ({ key: it.key, label: it.label[lang] }))} photos={photos} setPhotos={setPhotos} rows={rows} setRows={setRows} draftKey={currentDraftKey} lang={lang} />
                        )}
                    </div>
                </SectionCard>
            );
        }

        // ========== POST MODE ==========
        // Show skipped card if Pre-PM was N/A for simple questions
        if ((q.kind === "simple" || q.kind === "measure") && rowsPre[q.key]?.pf === "NA") {
            return (
                <SectionCard key={q.key} title={q.label[lang]} subtitle={subtitle} tooltip={qTooltip}>
                    <SkippedNAItem
                        label={getQuestionLabel(q, "post", lang)}
                        remark={rowsPre[q.key]?.remark}
                        lang={lang}
                    />
                </SectionCard>
            );
        }

        const checkboxElement = q.no === 13 ? (
            <label className="tw-flex tw-items-center tw-gap-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-700 tw-py-2">
                <input type="checkbox" className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500" checked={dustFilterChanged} onChange={(e) => setDustFilterChanged(e.target.checked)} />
                <span className="tw-leading-tight">{t("dustFilterChanged", lang)}</span>
            </label>
        ) : null;

        // Dynamic measure POST - filter out N/A items from Pre
        const postMeasureConfigs: Record<string, { items: typeof q4Items; qNo: number }> = {
            dynamic_measure: { items: q4Items, qNo: 4 },
            charger_measure: { items: q5Items, qNo: 5 },
            ccb_measure: { items: q6Items, qNo: 6 },
            rcd_measure: { items: q7Items, qNo: 7 },
        };

        if (postMeasureConfigs[q.kind]) {
            const cfg = postMeasureConfigs[q.kind];
            const activeItems = cfg.items.filter(item => rowsPre[item.key]?.pf !== "NA");
            const skippedItems = cfg.items.filter(item => rowsPre[item.key]?.pf === "NA");

            return (
                <SectionCard key={q.key} title={q.label[lang]} subtitle={subtitle} tooltip={qTooltip}>
                    <div className="tw-space-y-4">
                        {/* Show skipped N/A items first */}
                        {skippedItems.map((item) => (
                            <SkippedNAItem
                                key={item.key}
                                label={item.label}
                                remark={rowsPre[item.key]?.remark}
                                lang={lang}
                            />
                        ))}
                        {/* Then show active items */}
                        {activeItems.map((item) => (
                            <div key={item.key} className="tw-pb-4 last:tw-pb-0 last:tw-border-b-0 tw-border-b tw-border-blue-gray-100">
                                <PassFailRow label={item.label} value={rows[item.key]?.pf ?? ""} lang={lang}
                                    onChange={(v) => setRows({ ...rows, [item.key]: { ...(rows[item.key] ?? { remark: "" }), pf: v } })}
                                    remark={rows[item.key]?.remark ?? ""}
                                    onRemarkChange={(v) => setRows({ ...rows, [item.key]: { ...(rows[item.key] ?? { pf: "" }), remark: v } })}
                                    aboveRemark={<div className="tw-pb-4 tw-border-b tw-border-blue-gray-50"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} /></div>}
                                    beforeRemark={
                                        <>
                                            <div className="tw-mb-3">{renderDynamicMeasureGridWithPre(cfg.qNo, item.key)}</div>
                                            <PreRemarkElement remark={rowsPre[item.key]?.remark} lang={lang} />
                                        </>
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </SectionCard>
            );
        }

        // Trip tests POST - filter out N/A items from Pre
        const postTripConfigs: Record<string, typeof q8Items> = {
            trip_rcd: q8Items, trip_ccb: q9Items, trip_charger: q10Items, trip_main: q11Items,

        };

        if (postTripConfigs[q.kind]) {
            const items = postTripConfigs[q.kind];
            const activeItems = items.filter(item => rowsPre[item.key]?.pf !== "NA");
            const skippedItems = items.filter(item => rowsPre[item.key]?.pf === "NA");

            return (
                <SectionCard key={q.key} title={q.label[lang]} subtitle={subtitle} tooltip={qTooltip}>
                    <div className="tw-space-y-4">
                        {/* Show skipped N/A items first */}
                        {skippedItems.map((item) => (
                            <SkippedNAItem
                                key={item.key}
                                label={item.label}
                                remark={rowsPre[item.key]?.remark}
                                lang={lang}
                            />
                        ))}
                        {/* Then show active items */}
                        {activeItems.map((item) => (
                            <div key={item.key} className="tw-pb-4 last:tw-pb-0 last:tw-border-b-0 tw-border-b tw-border-blue-gray-100">
                                <PassFailRow label={item.label} value={rows[item.key]?.pf ?? ""} lang={lang}
                                    onChange={(v) => setRows({ ...rows, [item.key]: { ...(rows[item.key] ?? { remark: "" }), pf: v } })}
                                    remark={rows[item.key]?.remark ?? ""}
                                    onRemarkChange={(v) => setRows({ ...rows, [item.key]: { ...(rows[item.key] ?? { pf: "" }), remark: v } })}
                                    aboveRemark={<div className="tw-pb-4 tw-border-b tw-border-blue-gray-50"><PhotoMultiInput photos={photos[item.key] || []} setPhotos={makePhotoSetter(item.key)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} /></div>}
                                    beforeRemark={<PreRemarkElement remark={rowsPre[item.key]?.remark} lang={lang} />}
                                />
                            </div>
                        ))}
                    </div>
                </SectionCard>
            );
        }

        // Simple POST
        return (
            <SectionCard key={q.key} title={q.label[lang]} subtitle={subtitle} tooltip={qTooltip}>
                {q.kind === "simple" && (
                    <div className="tw-p-4 tw-rounded-lg tw-border tw-bg-gray-50 tw-border-blue-gray-100">
                        <PassFailRow label={t("testResult", lang)} value={rows[q.key]?.pf ?? ""} lang={lang}
                            onChange={(v) => setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { remark: "" }), pf: v } })}
                            remark={rows[q.key]?.remark ?? ""}
                            onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { pf: "" }), remark: v } })}
                            aboveRemark={
                                <>
                                    {q.hasPhoto && <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-4 tw-border-blue-gray-50"><PhotoMultiInput photos={photos[q.no] || []} setPhotos={makePhotoSetter(q.no)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} /></div>}
                                    {checkboxElement && <div className="sm:tw-hidden tw-mb-3">{checkboxElement}</div>}
                                </>
                            }
                            inlineLeft={checkboxElement && <div className="tw-hidden sm:tw-flex">{checkboxElement}</div>}
                            beforeRemark={<PreRemarkElement remark={rowsPre[q.key]?.remark} lang={lang} />}
                        />
                    </div>
                )
                }
                {
                    q.kind === "group" && q.items && (
                        <div className="tw-space-y-4 md:tw-space-y-6">
                            {/* Show skipped N/A items first */}
                            {q.items.filter(it => rowsPre[it.key]?.pf === "NA").map((it) => (
                                <SkippedNAItem
                                    key={it.key}
                                    label={it.label[lang]}
                                    remark={rowsPre[it.key]?.remark}
                                    lang={lang}
                                />
                            ))}
                            {/* Then show active items */}
                            {q.items.filter(it => rowsPre[it.key]?.pf !== "NA").map((it) => (
                                <div key={it.key} className="tw-pb-4 last:tw-pb-0 last:tw-border-b-0 tw-border-b tw-border-blue-gray-100">
                                    <PassFailRow label={it.label[lang]} value={rows[it.key]?.pf ?? ""} lang={lang}
                                        onChange={(v) => setRows({ ...rows, [it.key]: { ...(rows[it.key] ?? { remark: "" }), pf: v } })}
                                        remark={rows[it.key]?.remark ?? ""}
                                        onRemarkChange={(v) => setRows({ ...rows, [it.key]: { ...(rows[it.key] ?? { pf: "" }), remark: v } })}
                                        aboveRemark={q.hasPhoto && <div className="tw-pb-4 tw-border-b tw-border-blue-gray-50"><PhotoMultiInput photos={photos[it.key] || []} setPhotos={makePhotoSetter(it.key)} max={3} draftKey={currentDraftKey} qNo={q.no} lang={lang} /></div>}
                                        beforeRemark={<PreRemarkElement remark={rowsPre[q.key]?.remark} lang={lang} />}
                                    />
                                </div>
                            ))}
                        </div>
                    )
                }
                {
                    q.kind === "measure" && hasMeasure && (
                        <PassFailRow label={t("testResult", lang)} value={rows[q.key]?.pf ?? ""} lang={lang}
                            onChange={(v) => setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { remark: "" }), pf: v } })}
                            remark={rows[q.key]?.remark ?? ""}
                            onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { pf: "" }), remark: v } })}
                            aboveRemark={<div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-4 tw-border-blue-gray-50"><PhotoMultiInput photos={photos[q.no] || []} setPhotos={makePhotoSetter(q.no)} max={10} draftKey={currentDraftKey} qNo={q.no} lang={lang} /></div>}
                            belowRemark={<div className="tw-mt-4">{renderMeasureGridWithPre(q.no)}</div>}
                            beforeRemark={<PreRemarkElement remark={rowsPre[q.key]?.remark} lang={lang} />}
                        />
                    )
                }
            </SectionCard >
        );
    };

    // Photo refs for draft
    const photoRefs = useMemo(() => {
        const out: Record<string | number, PhotoRef[]> = {};
        Object.entries(photos).forEach(([keyStr, list]) => {
            const photoKey = isNaN(Number(keyStr)) ? keyStr : Number(keyStr);
            out[photoKey] = (list || []).map(p => p.ref).filter(Boolean) as PhotoRef[];
        });
        return out;
    }, [photos]);

    // // Debounced save
    // useDebouncedEffect(() => {
    //     if (!stationId || !draftId) return;
    //     saveDraftLocal(key, { rows, m4: m4State, m5: m5State, m6: m6State, m7: m7State, summary, summary_pf: summaryCheck, dustFilterChanged, photoRefs, q4_items: q4Items, q6_items: q6Items, charger_count: chargerCount });
    // }, [key, stationId, rows, m4State, m5State, m6State, m7State, summary, summaryCheck, dustFilterChanged, photoRefs, q4Items, q6Items, chargerCount]);

    // Save draft for Pre mode only
    useDebouncedEffect(() => {
        if (!stationId || isPostMode) return;
        saveDraftLocal(key, {
            rows, m4: m4State, m5: m5State, m6: m6State, m7: m7State,
            summary, dustFilterChanged, photoRefs,
            q4_items: q4Items, q6_items: q6Items, charger_count: chargerCount
        });
    }, [key, stationId, rows, m4State, m5State, m6State, m7State, summary, dustFilterChanged, photoRefs, q4Items, q6Items, chargerCount, isPostMode]);

    // Save draft for Post mode only
    useDebouncedEffect(() => {
        if (!stationId || !isPostMode || !editId) return;
        saveDraftLocal(postKey, {
            rows, m4: m4State, m5: m5State, m6: m6State, m7: m7State,
            summary, summaryCheck, dustFilterChanged, photoRefs
        });
    }, [postKey, stationId, rows, m4State, m5State, m6State, m7State, summary, summaryCheck, dustFilterChanged, photoRefs, isPostMode, editId]);

    // Load draft for Post mode (AFTER API data loaded)
    useEffect(() => {
        if (!isPostMode || !postApiLoaded || !stationId || !editId) return;
        const draft = loadDraftLocal<{
            rows: typeof rows;
            m4: Record<string, MeasureState<UnitVoltage>>;
            m5: Record<string, MeasureState<UnitVoltage>>;
            m6: Record<string, MeasureState<UnitVoltage>>;
            m7: Record<string, MeasureState<UnitVoltage>>;
            summary: string;
            summaryCheck?: PF;
            dustFilterChanged?: boolean;
            photoRefs?: Record<string | number, PhotoRef[]>;
        }>(postKey);
        if (!draft) return;

        // Override with draft data
        if (draft.rows) setRows(prev => ({ ...prev, ...draft.rows }));
        if (draft.m4) setM4State(prev => ({ ...prev, ...draft.m4 }));
        if (draft.m5) setM5State(prev => ({ ...prev, ...draft.m5 }));
        if (draft.m6) setM6State(prev => ({ ...prev, ...draft.m6 }));
        if (draft.m7) setM7State(prev => ({ ...prev, ...draft.m7 }));
        if (draft.summary) setSummary(draft.summary);
        if (draft.summaryCheck) setSummaryCheck(draft.summaryCheck);
        if (typeof draft.dustFilterChanged === "boolean") setDustFilterChanged(draft.dustFilterChanged);

        // Load photos from draft
        (async () => {
            if (!draft.photoRefs) return;
            const next: Record<string | number, PhotoItem[]> = {};
            for (const [keyStr, refs] of Object.entries(draft.photoRefs)) {
                const photoKey = isNaN(Number(keyStr)) ? keyStr : Number(keyStr);
                const items: PhotoItem[] = [];
                for (const ref of refs || []) {
                    const file = await getPhoto(postKey, ref.id);
                    if (!file) continue;
                    items.push({ id: ref.id, file, preview: URL.createObjectURL(file), remark: ref.remark ?? "", ref });
                }
                next[photoKey] = items;
            }
            setPhotos(prev => ({ ...prev, ...next }));
        })();
    }, [isPostMode, postApiLoaded, stationId, editId, postKey]);
    // Upload photos
    // async function uploadGroupPhotos(reportId: string, stationId: string, group: string, files: File[], side: TabId) {
    //     if (files.length === 0) return;
    //     const form = new FormData();
    //     form.append("station_id", stationId);
    //     form.append("group", group);
    //     form.append("side", side);
    //     files.forEach((f) => form.append("files", f));
    //     const token = localStorage.getItem("access_token");
    //     const url = side === "pre" ? `${API_BASE}/mdbpmreport/${reportId}/pre/photos` : `${API_BASE}/mdbpmreport/${reportId}/post/photos`;
    //     const res = await fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form, credentials: "include" });
    //     if (!res.ok) throw new Error(await res.text());
    // }

    const flattenRows = (inputRows: Record<string, any>): Record<string, { pf: PF; remark: string }> => {
        const result: Record<string, { pf: PF; remark: string }> = {};

        // Simple questions (ไม่มีข้อย่อย): r1, r2, r3, r12, r13
        const simpleKeys = QUESTIONS
            .filter(q => q.kind === "simple" || q.kind === "measure")
            .map(q => q.key);

        // Dynamic items keys: r4_1, r4_2, r5_1, r5_2, ...
        const dynamicKeys = [
            ...q4Items.map(i => i.key),
            ...q5Items.map(i => i.key),
            ...q6Items.map(i => i.key),
            ...q7Items.map(i => i.key),
            ...q8Items.map(i => i.key),
            ...q9Items.map(i => i.key),
            ...q10Items.map(i => i.key),
            ...q11Items.map(i => i.key),
        ];

        const validKeys = [...simpleKeys, ...dynamicKeys];

        for (const key of validKeys) {
            if (inputRows[key] && typeof inputRows[key] === "object") {
                result[key] = { pf: inputRows[key].pf ?? "", remark: inputRows[key].remark ?? "" };
            }
        }

        for (const key of validKeys) {
            if (!result[key]) result[key] = { pf: "", remark: "" };
        }

        return result;
    };

    async function uploadGroupPhotos(reportId: string, stationId: string, group: string, files: File[], side: TabId) {
        if (files.length === 0) return;

        // ✅ แปลง key เป็น g format ก่อนส่ง
        const normalizedGroup = (() => {
            const k = String(group);
            if (/^\d+$/.test(k)) return `g${k}`;  // 1, 2, 3 -> g1, g2, g3
            const match = k.match(/^r(\d+)(_\d+)?$/);
            if (match) return `g${match[1]}`;  // r4_1 -> g4, r5_2 -> g5
            if (k.startsWith("g")) return k;  // g1 -> g1
            return `g${k}`;
        })();

        const form = new FormData();
        form.append("station_id", stationId);
        form.append("group", normalizedGroup);  // ✅ ใช้ normalized group
        form.append("side", side);
        files.forEach((f) => form.append("files", f));
        const token = localStorage.getItem("access_token");
        const url = side === "pre" ? `${API_BASE}/mdbpmreport/${reportId}/pre/photos` : `${API_BASE}/mdbpmreport/${reportId}/post/photos`;
        const res = await fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: form, credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
    }



    // Pre-PM Save
    const onPreSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }
        if (!allRequiredInputsFilled) { alert(t("alertFillVoltage", lang)); return; }
        if (!allRemarksFilledPre) { alert(`${t("alertFillRemark", lang)} ${missingRemarksPre.join(", ")}`); return; }
        if (submitting) return;
        setSubmitting(true);

        try {
            const token = localStorage.getItem("access_token");
            const pm_date = job.date?.trim() || "";
            const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
            const flatRows = flattenRows(rows);
            const payload = {
                station_id: stationId, issue_id: issueIdFromJob, job: jobWithoutIssueId, inspector,
                measures_pre: { m4: m4State, m5: m5State, m6: m6State, m7: m7State },
                rows_pre: flatRows, pm_date, doc_name: docName, side: "pre" as TabId,
                q4_items: q4Items, q6_items: q6Items, charger_count: chargerCount,
            };

            const res = await fetch(`${API_BASE}/mdbpmreport/pre/submit`, {
                method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include", body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());

            const { report_id, doc_name } = await res.json() as { report_id: string; doc_name?: string };
            if (doc_name) setDocName(doc_name);

            // Upload photos
            const uploadPromises: Promise<void>[] = [];
            [1, 2, 3].forEach((qNo) => { const list = photos[qNo]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, `g${qNo}`, files, "pre")); } });
            q4Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "pre")); } });
            q5Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "pre")); } });
            q6Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "pre")); } });
            q7Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "pre")); } });
            q8Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "pre")); } });
            q9Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "pre")); } });
            q10Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "pre")); } });
            q11Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "pre")); } });
            const list12 = photos[12]; if (list12?.length) { const files = list12.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, "g12", files, "pre")); }

            await Promise.all(uploadPromises);
            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(key, p.id)));
            clearDraftLocal(key);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&saved=1`);
        } catch (err: any) {
            alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`);
        } finally {
            setSubmitting(false);
        }
    };

    // Post-PM Save
    const onFinalSave = async () => {
        if (!stationId) { alert(t("alertNoStation", lang)); return; }
        if (submitting) return;
        setSubmitting(true);

        try {
            const token = localStorage.getItem("access_token");
            const flatRows = flattenRows(rows);
            const payload = {
                station_id: stationId, rows: flatRows, measures: { m4: m4State, m5: m5State, m6: m6State, m7: m7State },
                summary, ...(summaryCheck ? { summaryCheck } : {}),
                dust_filter: dustFilterChanged ? "yes" : "no", side: "post" as TabId, report_id: editId,
            };

            const res = await fetch(`${API_BASE}/${PM_PREFIX}/submit`, {
                method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include", body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());

            const { report_id } = await res.json() as { report_id: string };

            // Upload photos
            const uploadPromises: Promise<void>[] = [];
            [1, 2, 3].forEach((qNo) => { const list = photos[qNo]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, `g${qNo}`, files, "post")); } });
            q4Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "post")); } });
            q5Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "post")); } });
            q6Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "post")); } });
            q7Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "post")); } });
            q8Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "post")); } });
            q9Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "post")); } });
            q10Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "post")); } });
            q11Items.forEach((item) => { const list = photos[item.key]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, item.key, files, "post")); } });
            [12, 13].forEach((qNo) => { const list = photos[qNo]; if (list?.length) { const files = list.map(p => p.file!).filter(Boolean) as File[]; if (files.length) uploadPromises.push(uploadGroupPhotos(report_id, stationId, `g${qNo}`, files, "post")); } });

            await Promise.all(uploadPromises);
            await fetch(`${API_BASE}/${PM_PREFIX}/${report_id}/finalize`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: "include", body: new URLSearchParams({ station_id: stationId }) });
            clearDraftLocal(key);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&saved=1`);
        } catch (err: any) {
            alert(`${t("alertSaveFailed", lang)} ${err?.message ?? err}`);
        } finally {
            setSubmitting(false);
        }
    };

    // Tab navigation
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

    const allPFAnsweredForUI = displayTab === "pre" ? true : allPFAnsweredPost;
    const missingPFItemsForUI = displayTab === "pre" ? [] : missingPFItemsPost;
    const missingRemarksForUI = displayTab === "pre" ? missingRemarksPre : missingRemarksPost;
    const allRemarksFilledForUI = displayTab === "pre" ? allRemarksFilledPre : allRemarksFilledPost;

    return (
        <section className="tw-pb-24">
            <div className="tw-mx-auto tw-max-w-6xl tw-flex tw-items-center tw-justify-between tw-mb-4">
                <Button variant="outlined" size="sm" onClick={() => router.back()} title={lang === "th" ? "กลับไปหน้า List" : "Back to list"}>
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
                            <div className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md tw-h-16 tw-w-[76px] md:tw-h-20 md:tw-w-[108px] lg:tw-h-24 lg:tw-w-[152px]">
                                <Image src={LOGO_SRC} alt="Company logo" fill priority className="tw-object-contain tw-p-0" sizes="(min-width:1024px) 152px, (min-width:768px) 108px, 76px" />
                            </div>
                            <div>
                                <div className="tw-font-semibold tw-text-blue-gray-900">{t("pageTitle", lang)}</div>
                                <div className="tw-text-sm tw-text-blue-gray-600">
                                    {t("companyName", lang)}<br />
                                    {t("companyAddress", lang)}<br />
                                    {t("callCenter", lang)}
                                </div>
                            </div>
                        </div>
                        <div className="tw-text-right tw-text-sm tw-text-blue-gray-700">
                            <div className="tw-font-semibold">{t("docName", lang)}</div>
                            <div>{docName || "-"}</div>
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
                        {QUESTIONS.filter((q) => !(displayTab === "pre" && q.no === 13)).map((q) => renderQuestionBlock(q, displayTab))}
                    </CardBody>

                    <CardBody className="tw-space-y-3 !tw-pt-4 !tw-pb-0">
                        <Typography variant="h6" className="tw-mb-1">{t("comment", lang)}</Typography>
                        <Textarea label={t("comment", lang)} value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} required={isPostMode} autoComplete="off" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                        {displayTab === "post" && (
                            <div className="tw-pt-4 tw-border-t tw-border-blue-gray-100">
                                <PassFailRow label={t("summaryResult", lang)} value={summaryCheck} onChange={(v) => setSummaryCheck(v)} lang={lang}
                                    labels={{ PASS: t("summaryPassLabel", lang), FAIL: t("summaryFailLabel", lang), NA: t("summaryNALabel", lang) }} />
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
                            <Section title={t("validationRemarkTitle", lang)} ok={allRemarksFilledForUI} lang={lang}>
                                {missingRemarksForUI.length > 0 && <Typography variant="small" className="!tw-text-amber-700">{t("missingRemark", lang)} {missingRemarksForUI.join(", ")}</Typography>}
                            </Section>
                            {isPostMode && (
                                <>
                                    <Section title={t("validationPFTitle", lang)} ok={allPFAnsweredForUI} lang={lang}>
                                        <Typography variant="small" className="!tw-text-amber-700">{t("missingPF", lang)} {missingPFItemsForUI.join(", ")}</Typography>
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
                                    title={!allPhotosAttachedPre ? t("photoNotComplete", lang) : !allRequiredInputsFilled ? t("inputNotComplete", lang) : !allRemarksFilledPre ? `${t("alertFillRemark", lang)} ${missingRemarksPre.join(", ")}` : undefined}>
                                    {submitting ? t("saving", lang) : t("save", lang)}
                                </Button>
                            ) : (
                                <Button color="blue" type="button" onClick={onFinalSave} disabled={!canFinalSave || submitting}
                                    title={!canFinalSave ? t("allNotComplete", lang) : undefined}>
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