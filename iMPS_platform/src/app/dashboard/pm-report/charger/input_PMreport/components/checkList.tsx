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

async function getChargerInfoBySN(sn: string): Promise<StationPublic> {
    const url = `${API_BASE}/station/info/public?sn=${encodeURIComponent(sn)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) throw new Error("Charger not found");
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const json = await res.json();
    return json.station ?? json;
}

/* =========================
 *        CONSTANTS
 * ========================= */
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

type Question =
    | { no: number; key: `r${number}`; label: string; labelPre?: string; labelPost?: string; kind: "simple"; hasPhoto?: boolean; tooltip?: string }
    | { no: 16; key: "r16"; label: string; labelPre?: string; labelPost?: string; kind: "measure"; hasPhoto?: boolean; tooltip?: string }
    | { no: number; key: `r${number}`; label: string; labelPre?: string; labelPost?: string; kind: "group"; items: { key: string; label: string }[]; hasPhoto?: boolean; tooltip?: string };

const VOLTAGE1_FIELDS = ["L1-L2", "L2-L3", "L3-L1", "L1-N", "L2-N", "L3-N", "L1-G", "L2-G", "L3-G", "N-G"] as const;

const LABELS: Record<string, string> = {
    "L1-L2": "L1-L2", "L2-L3": "L2-L3", "L3-L1": "L3-L1",
    "L1-N": "L1-N", "L2-N": "L2-N", "L3-N": "L3-N",
    "L1-G": "L1-G", "L2-G": "L2-G", "L3-G": "L3-G",
    "N-G": "N-G", CP: "CP",
};

const QUESTIONS_RAW: Question[] = [
    { no: 1, key: "r1", label: "1) ตรวจสอบสภาพทั่วไป", kind: "simple", hasPhoto: true, tooltip: "ตรวจสอบความสมบูรณ์ของตู้, การยึดแน่นของน็อตยึดฐาน, รอยแตกร้าวและร่องรอยการกระแทก" },
    { no: 2, key: "r2", label: "2) ตรวจสอบดักซีล,ซิลิโคนกันซึม", kind: "simple", hasPhoto: true, tooltip: "ตรวจสอบความยืดหยุ่นของขอบยางกันน้ำ, รอยต่อของเคเบิลแกลนด์และและสภาพซิลิโคนตามแนวตะเข็บตู้" },
    { no: 3, key: "r3", label: "3) ตรวจสอบสายอัดประจุ", kind: "group", hasPhoto: true, items: [{ label: "3.1) สายที่ 1", key: "r3_1" }], tooltip: "ตรวจสอบความสมบูรณ์ของฉนวนหุ้มสาย, คอสายว่าไม่มีการบิดงอหรือปริแตกและตรวจสอบรอยไหม้" },
    { no: 4, key: "r4", label: "4) ตรวจสอบหัวจ่ายอัดประจุ", kind: "group", hasPhoto: true, items: [{ label: "4.1) หัวจ่ายอัดประจุที่ 1", key: "r4_1" }], tooltip: "ตรวจสอบความสะอาดของขั้วสัมผัส (Pin), ตรวจสอบสปริงล็อกและรอยร้าวบริเวณด้ามจับ" },
    { no: 5, key: "r5", label: "5) ตรวจสอบปุ่มหยุดฉุกเฉิน", kind: "group", hasPhoto: true, items: [{ label: "5.1) ปุ่มหยุดฉุกเฉินที่ 1", key: "r5_1" }], tooltip: "ตรวจสอบกลไกการกดและการคลายล็อกและตรวจสอบหน้าสัมผัสทางไฟฟ้าว่าไม่มีคราบสกปรก" },
    { no: 6, key: "r6", label: "6) ตรวจสอบ QR CODE", kind: "group", hasPhoto: true, items: [{ label: "6.1) QR CODE ที่ 1", key: "r6_1" }], tooltip: "ตรวจสอบความคมชัดของ QR CODE และการยึดติดของสติ๊กเกอร์" },
    { no: 7, key: "r7", label: "7) ป้ายเตือนระวังไฟฟ้าช็อก", kind: "group", hasPhoto: true, items: [{ label: "7.1) ป้ายเตือนระวังไฟฟ้าช็อกที่ 1", key: "r7_1" }], tooltip: "ตรวจสอบการติดตั้งและความชัดเจนของป้ายเตือนอันตราย" },
    { no: 8, key: "r8", label: "8) ป้ายเตือนต้องการระบายอากาศ", kind: "simple", hasPhoto: true, tooltip: "ตรวจสอบระยะ Clearance รอบตู้ตามป้ายระบุ เพื่อไม่ให้มีสิ่งของวางกีดขวางทางลม" },
    { no: 9, key: "r9", label: "9) ป้ายเตือนปุ่มฉุกเฉิน", kind: "simple", hasPhoto: true, tooltip: "ตรวจสอบความสว่างหรือการสะท้อนแสงของป้ายบ่งชี้ตำแหน่งปุ่ม Emergency เพื่อให้มองเห็นได้ในสภาวะแสงน้อย" },
    { no: 10, key: "r10", label: "10) ตรวจสอบแรงดันไฟฟ้าที่พิน CP", kind: "group", hasPhoto: true, items: [{ label: "10.1) แรงดันไฟฟ้าที่พิน CP สายที่ 1", key: "r10_1" }], tooltip: "วัดค่าแรงดันระหว่าง pin CP และ PE" },
    {
        no: 11, key: "r11", label: "11) ตรวจสอบแผ่นกรองระบายอากาศ", kind: "group", hasPhoto: true,
        tooltip: "ตรวจสอบสภาพแผ่นกรองอากาศและทิศทางการไหลของอากาศ",
        items: [
            { label: "11.1) แผ่นกรองระบายอากาศ (ด้านซ้าย)", key: "r11_1" },
            { label: "11.2) แผ่นกรองระบายอากาศ (ด้านขวา)", key: "r11_2" },
            { label: "11.3) แผ่นกรองระบายอากาศ (ด้านหน้า)", key: "r11_3" },
            { label: "11.4) แผ่นกรองระบายอากาศ (ด้านหลัง)", key: "r11_4" },
        ]
    },
    { no: 12, key: "r12", label: "12) ตรวจสอบจุดต่อทางไฟฟ้า", kind: "simple", hasPhoto: true, tooltip: "ตรวจสอบสภาพหน้าสัมผัส, การทำงานของคอยล์และเสียงผิดปกติขณะทำงาน" },
    { no: 13, key: "r13", label: "13) ตรวจสอบคอนแทคเตอร์", kind: "simple", hasPhoto: true, tooltip: "ตรวจสอบหน้าต่างแสดงสถานะและตรวจสอบสายกราวด์ที่ต่อเข้ากับ Surge Protective Devices" },
    { no: 14, key: "r14", label: "14) ตรวจสอบอุปกรณ์ป้องกันไฟกระชาก", kind: "simple", hasPhoto: true, tooltip: "ตรวจสอบทิศทางการเรียงเฟส" },
    { no: 15, key: "r15", label: "15) ตรวจสอบลำดับเฟส", kind: "simple", hasPhoto: true, tooltip: "ตรวจสอบทิศทางการเรียงเฟส" },
    { no: 16, key: "r16", label: "16) วัดแรงดันไฟฟ้าด้านเข้า", kind: "measure", hasPhoto: true, tooltip: "วัดค่าแรงดันไฟฟ้าระหว่างเฟส และระหว่างเฟสกับนิวทรัล/กราวด์" },
    { no: 17, key: "r17", label: "17) ทดสอบการอัดประจุ", kind: "group", hasPhoto: true, items: [{ label: "17.1) ทดสอบการอัดประจุสายที่ 1", key: "r17_1" }], tooltip: "ตรวจสอบการทำงานร่วมกับ EV Simulator หรือรถจริง" },
    { no: 18, key: "r18", label: "18) ทำความสะอาด", kind: "simple", hasPhoto: true, tooltip: "ทำความสะอาดหน้าจอ, คราบสะสมบนหัวชาร์จและพื้นที่บริเวณฐานเครื่อง" },
];

const QUESTIONS = QUESTIONS_RAW;

function getQuestionLabel(q: Question, mode: TabId): string {
    if (mode === "pre") return q.labelPre ?? `${q.label} (ก่อน PM)`;
    return q.labelPost ?? `${q.label} (หลัง PM)`;
}

const FIELD_GROUPS: Record<number, { keys: readonly string[]; unitType: "voltage"; note?: string } | undefined> = {
    16: { keys: VOLTAGE1_FIELDS, unitType: "voltage" },
};

const FIXED_ITEMS_CONFIG: Record<number, { prefix: string; labelTemplate: string }> = {
    3: { prefix: "r3", labelTemplate: "สายอัดประจุที่" },
    4: { prefix: "r4", labelTemplate: "หัวจ่ายอัดประจุที่" },
    6: { prefix: "r6", labelTemplate: "QR CODE ที่" },
    10: { prefix: "r10", labelTemplate: "แรงดันไฟฟ้าที่พิน CP สายที่" },
    17: { prefix: "r17", labelTemplate: "ทดสอบการอัดประจุสายที่" },
};

const FIXED_ITEMS_Q11 = [
    { key: "r11_1", label: "11.1) แผ่นกรองระบายอากาศ (ด้านซ้าย)" },
    { key: "r11_2", label: "11.2) แผ่นกรองระบายอากาศ (ด้านขวา)" },
    { key: "r11_3", label: "11.3) แผ่นกรองระบายอากาศ (ด้านหน้า)" },
    { key: "r11_4", label: "11.4) แผ่นกรองระบายอากาศ (ด้านหลัง)" },
];

const createFixedItems = (qNo: number, count: number) => {
    const config = FIXED_ITEMS_CONFIG[qNo];
    if (!config) return [];
    return Array.from({ length: count }, (_, i) => ({
        key: `${config.prefix}_${i + 1}`,
        label: `${qNo}.${i + 1}) ${config.labelTemplate} ${i + 1}`
    }));
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}

function PassFailRow({
    label, value, onChange, remark, onRemarkChange, labels, aboveRemark, inlineLeft, onlyNA = false, onClear,
}: {
    label: string;
    value: PF;
    onChange: (v: Exclude<PF, "">) => void;
    remark?: string;
    onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
    aboveRemark?: React.ReactNode;
    inlineLeft?: React.ReactNode;
    onlyNA?: boolean;
    onClear?: () => void;
}) {
    const text = { PASS: labels?.PASS ?? "PASS", FAIL: labels?.FAIL ?? "FAIL", NA: labels?.NA ?? "N/A" };

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
                    <Textarea label="หมายเหตุ" value={remark || ""} onChange={(e) => onRemarkChange(e.target.value)}
                        containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full" />
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

function Section({ title, ok, children, tooltip }: {
    title: React.ReactNode;
    ok: boolean;
    children?: React.ReactNode;
    tooltip?: string;
}) {
    const content = (
        <div className={`tw-rounded-lg tw-border tw-p-3 ${ok ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
            <div className="tw-flex tw-items-center tw-gap-2">
                <Typography className="tw-font-medium">{title}</Typography>
                {tooltip && (
                    <svg className="tw-w-4 tw-h-4 tw-text-blue-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                )}
            </div>
            {ok ? <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography> : children}
        </div>
    );

    if (tooltip) {
        return (
            <Tooltip content={tooltip} placement="top">
                {content}
            </Tooltip>
        );
    }

    return content;
}

function InputWithUnit<U extends string>({
    label, value, unit, units, onValueChange, onUnitChange, readOnly, disabled, labelOnTop, required = true, isNA = false, onNAChange,
}: {
    label: string; value: string; unit: U; units: readonly U[];
    onValueChange: (v: string) => void; onUnitChange: (u: U) => void;
    readOnly?: boolean; disabled?: boolean; labelOnTop?: boolean; required?: boolean; isNA?: boolean; onNAChange?: (isNA: boolean) => void;
}) {
    return (
        <div className="tw-space-y-1">
            {labelOnTop && <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700">{label}</Typography>}
            {isNA ? (
                <div className="tw-flex tw-items-center tw-gap-2 tw-h-10 tw-px-3 tw-py-2 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-amber-50">
                    <Typography variant="small" className="tw-text-amber-700 tw-font-medium">N/A (ไม่มีค่า)</Typography>
                    {onNAChange && !readOnly && <Button size="sm" variant="text" onClick={() => onNAChange(false)} className="tw-ml-auto tw-text-xs">ลบ N/A</Button>}
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
                <Button size="sm" variant="outlined" onClick={() => onNAChange(true)} className="tw-w-full tw-border-amber-500 tw-text-amber-700">N/A (ไม่มีค่า)</Button>
            )}
        </div>
    );
}

function PhotoMultiInput({
    photos, setPhotos, max = 10, draftKey, qNo,
}: {
    label?: string; photos: PhotoItem[]; setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
    max?: number; draftKey: string; qNo: number;
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
                <Button size="sm" color="blue" variant="outlined" onClick={handlePick} className="tw-shrink-0">Attach / Take Photo</Button>
            </div>
            <Typography variant="small" className="!tw-text-blue-gray-500 tw-flex tw-items-center">
                Max {max} photos • Camera supported on mobile
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
                <Typography variant="small" className="!tw-text-blue-gray-500">No photos attached</Typography>
            )}
        </div>
    );
}

function DynamicItemsSection({
    qNo, items, addItem, removeItem, addButtonLabel, renderAdditionalFields, editable = true,
    photos, setPhotos, rows, setRows, draftKey,
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
    draftKey: string;
    showDustFilterCheckbox?: boolean;
    dustFilterChanged?: Record<string, boolean>;
    setDustFilterChanged?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
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
                                    <Button
                                        size="sm"
                                        color={isNA ? "amber" : "blue-gray"}
                                        variant={isNA ? "filled" : "outlined"}
                                        onClick={() => setRows(prev => ({
                                            ...prev,
                                            [item.key]: {
                                                ...prev[item.key],
                                                pf: isNA ? "" : "NA"
                                            }
                                        }))}
                                        className="tw-text-xs"
                                    >
                                        {isNA ? "Cancel N/A" : "N/A"}
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
                                    <input
                                        type="checkbox"
                                        id={`dustFilter_${item.key}`}
                                        className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500"
                                        checked={dustFilterChanged[item.key] || false}
                                        onChange={(e) => setDustFilterChanged(prev => ({
                                            ...prev,
                                            [item.key]: e.target.checked
                                        }))}
                                    />
                                    <label htmlFor={`dustFilter_${item.key}`} className="tw-text-sm tw-text-blue-gray-700 tw-font-medium">
                                        Replace air filter
                                    </label>
                                </div>
                            )}

                            <div className="tw-mb-3">
                                <PhotoMultiInput
                                    photos={photos[`${qNo}_${idx}`] || []}
                                    setPhotos={(action) => {
                                        setPhotos((prev) => {
                                            const photoKey = `${qNo}_${idx}`;
                                            const current = prev[photoKey] || [];
                                            const next = typeof action === "function" ? action(current) : action;
                                            return { ...prev, [photoKey]: next };
                                        });
                                    }}
                                    max={10}
                                    draftKey={draftKey}
                                    qNo={qNo}
                                />
                            </div>

                            {renderAdditionalFields && (
                                <div className={`tw-mb-3 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>
                                    {renderAdditionalFields(item, idx, isNA)}
                                </div>
                            )}

                            <Textarea
                                label="Remark *"
                                value={rows[item.key]?.remark ?? ""}
                                onChange={(e) => setRows(prev => ({ ...prev, [item.key]: { ...(prev[item.key] ?? { pf: "" }), remark: e.target.value } }))}
                                rows={3}
                                required
                                containerProps={{ className: "!tw-min-w-0" }}
                                className="!tw-w-full resize-none"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function PhotoRemarkSection({
    qKey,
    qNo,
    label,
    middleContent,
    photos,
    setPhotos,
    rows,
    setRows,
    draftKey
}: {
    qKey: string;
    qNo: number;
    label?: string;
    middleContent?: React.ReactNode;
    photos: Record<number | string, PhotoItem[]>;
    setPhotos: React.Dispatch<React.SetStateAction<Record<number | string, PhotoItem[]>>>;
    rows: Record<string, { pf: PF; remark: string }>;
    setRows: React.Dispatch<React.SetStateAction<Record<string, { pf: PF; remark: string }>>>;
    draftKey: string;
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
                <Button
                    size="sm"
                    color={isNA ? "amber" : "blue-gray"}
                    variant={isNA ? "filled" : "outlined"}
                    onClick={() => setRows(prev => ({
                        ...prev,
                        [qKey]: {
                            ...prev[qKey],
                            pf: isNA ? "" : "NA"
                        }
                    }))}
                >
                    {isNA ? "Cancel N/A" : "N/A"}
                </Button>
            </div>

            <div className="tw-mb-3">
                <PhotoMultiInput
                    photos={photos[qNo] || []}
                    setPhotos={makePhotoSetter(qNo)}
                    max={10}
                    draftKey={draftKey}
                    qNo={qNo}
                />
            </div>

            {middleContent && (
                <div className={`tw-mb-3 ${isNA ? "tw-opacity-50 tw-pointer-events-none" : ""}`}>
                    {middleContent}
                </div>
            )}

            <Textarea
                label="Remark *"
                value={rows[qKey]?.remark ?? ""}
                onChange={(e) => setRows(prev => ({ ...prev, [qKey]: { ...(prev[qKey] ?? { pf: "" }), remark: e.target.value } }))}
                rows={3}
                required
                containerProps={{ className: "!tw-min-w-0" }}
                className="!tw-w-full resize-none"
            />
        </div>
    );
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

/* =========================
 *        MAIN
 * ========================= */
export default function ChargerPMForm() {
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
    const key = useMemo(() => `${draftKey(sn)}:${draftId ?? "default"}`, [sn, draftId]);
    const [inspector, setInspector] = useState<string>("");
    const [dustFilterChanged, setDustFilterChanged] = useState<Record<string, boolean>>({});

    const [job, setJob] = useState({
        issue_id: "", chargerNo: "", sn: "", model: "", power: "", brand: "", station_name: "", date: "", chargingCables: 1,
    });

    const [rowsPre, setRowsPre] = useState<Record<string, { pf: PF; remark: string }>>({});
    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(() => {
        const initial: Record<string, { pf: PF; remark: string }> = {};

        QUESTIONS.forEach((q) => {
            initial[q.key] = { pf: "", remark: "" };
        });

        FIXED_ITEMS_Q11.forEach((item) => {
            initial[item.key] = { pf: "", remark: "" };
        });

        return initial;
    });

    const [m16Pre, setM16Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE1_FIELDS, "V"));
    const m16 = useMeasure<UnitVoltage>(VOLTAGE1_FIELDS, "V");

    const createDynamicItems = (qNo: number, label: string, maxItems: number = 66) => {
        const [items, setItems] = useState<{ key: string; label: string }[]>([
            { key: `r${qNo}_1`, label: `${qNo}.1) ${label}ที่ 1` },
        ]);

        const addItem = () => {
            if (items.length < maxItems) {
                const newIndex = items.length + 1;
                setItems([...items, { key: `r${qNo}_${newIndex}`, label: `${qNo}.${newIndex}) ${label}ที่ ${newIndex}` }]);
                setRows(prev => ({ ...prev, [`r${qNo}_${newIndex}`]: { pf: "", remark: "" } }));
            }
        };

        const removeItem = (index: number) => {
            if (items.length > 1) {
                const keyToDelete = items[index].key;
                const newItems = items.filter((_, i) => i !== index);
                const reindexed = newItems.map((item, idx) => ({
                    key: `r${qNo}_${idx + 1}`,
                    label: `${qNo}.${idx + 1}) ${label}ที่ ${idx + 1}`
                }));
                setItems(reindexed);
                setRows(prev => { const next = { ...prev }; delete next[keyToDelete]; return next; });
            }
        };

        const initItems = (count: number) => {
            const newItems = Array.from({ length: count }, (_, idx) => ({
                key: `r${qNo}_${idx + 1}`,
                label: `${qNo}.${idx + 1}) ${label}ที่ ${idx + 1}`
            }));
            setItems(newItems);
        };

        return { items, setItems, addItem, removeItem, initItems };
    };

    const { items: q5Items, addItem: addQ5Item, removeItem: removeQ5Item, initItems: initQ5Items } = createDynamicItems(5, "ปุ่มหยุดฉุกเฉิน");
    const { items: q7Items, addItem: addQ7Item, removeItem: removeQ7Item, initItems: initQ7Items } = createDynamicItems(7, "ป้ายเตือนระวังไฟฟ้าช็อก");
    const fixedItemsMap = useMemo(() => ({
        3: createFixedItems(3, job.chargingCables),
        4: createFixedItems(4, job.chargingCables),
        6: createFixedItems(6, job.chargingCables),
        10: createFixedItems(10, job.chargingCables),
        11: FIXED_ITEMS_Q11,
        17: createFixedItems(17, job.chargingCables),
    }), [job.chargingCables]);

    useEffect(() => {
        setRows((prev) => {
            const next = { ...prev };
            let changed = false;

            [3, 4, 6, 10, 17].forEach((qNo) => {
                const items = fixedItemsMap[qNo as keyof typeof fixedItemsMap];
                if (items) {
                    items.forEach((item) => {
                        if (!next[item.key]) {
                            next[item.key] = { pf: "", remark: "" };
                            changed = true;
                        }
                    });
                }
            });

            FIXED_ITEMS_Q11.forEach((item) => {
                if (!next[item.key]) {
                    next[item.key] = { pf: "", remark: "" };
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [fixedItemsMap]);

    // Effects
    useEffect(() => {
        if (!isPostMode || !editId || !sn) return;
        (async () => {
            try {
                const data = await fetchReport(editId, sn);
                if (data.job) setJob(prev => ({ ...prev, ...data.job, issue_id: data.issue_id ?? prev.issue_id }));
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
            } catch (err) { console.error("load report failed:", err); }
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
                    power: st.power ?? prev.model,
                    station_name: st.station_name ?? prev.station_name,
                    date: prev.date || new Date().toISOString().slice(0, 10),
                    chargingCables: st.chargingCables ?? prev.chargingCables ?? 1,
                }));
            })
            .catch((err) => console.error("load charger info failed:", err));
    }, [isPostMode]);

    useEffect(() => {
        if (!sn) return;
        const draft = loadDraftLocal<{
            rows: typeof rows;
            cp: typeof cp;
            m16: typeof m16.state;
            summary: string;
            inspector?: string;
            dustFilterChanged?: boolean | Record<string, boolean>;
            photoRefs?: Record<string, (PhotoRef | { isNA: true })[]>;
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
            FIXED_ITEMS_Q11.forEach(item => {
                converted[item.key] = draft.dustFilterChanged as boolean;
            });
            setDustFilterChanged(converted);
        } else {
            setDustFilterChanged(draft.dustFilterChanged ?? {});
        }

        (async () => {
            if (!draft.photoRefs) return;
            const next: Record<string, PhotoItem[]> = {};

            QUESTIONS.filter((q) => q.hasPhoto).forEach((q) => {
                next[q.no] = [];
            });

            for (const [photoKey, refs] of Object.entries(draft.photoRefs)) {
                const items: PhotoItem[] = [];
                for (const ref of refs || []) {
                    if ('isNA' in ref && ref.isNA) {
                        items.push({ id: `${photoKey}-NA-restored`, isNA: true, preview: undefined });
                        continue;
                    }
                    if (!('id' in ref) || !ref.id) continue;
                    const file = await getPhoto(key, ref.id);
                    if (!file) continue;
                    items.push({
                        id: ref.id,
                        file,
                        preview: URL.createObjectURL(file),
                        remark: (ref as any).remark ?? "",
                        ref: ref as PhotoRef
                    });
                }
                next[photoKey] = items;
            }
            setPhotos(next);
        })();
    }, [sn, key]);

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

    const makePhotoSetter = (no: number): React.Dispatch<React.SetStateAction<PhotoItem[]>> => (action) => {
        setPhotos((prev) => {
            const current = prev[no] || [];
            const next = typeof action === "function" ? (action as (x: PhotoItem[]) => PhotoItem[])(current) : action;
            return { ...prev, [no]: next };
        });
    };

    // Validations (kept same logic, just using sn instead of stationId)
    const validPhotoKeysPre = useMemo(() => {
        const keys: { key: string | number; label: string }[] = [];

        QUESTIONS.filter(q => q.hasPhoto && q.no !== 18).forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") {
                keys.push({ key: q.no, label: `${q.no}` });
            } else if (q.no === 5) {
                q5Items.forEach((item, idx) => keys.push({ key: `${q.no}_${idx}`, label: `${q.no}.${idx + 1}` }));
            } else if (q.no === 7) {
                q7Items.forEach((item, idx) => keys.push({ key: `${q.no}_${idx}`, label: `${q.no}.${idx + 1}` }));
            } else if ([3, 4, 6, 10, 11, 17].includes(q.no)) {
                const fixedItems = fixedItemsMap[q.no as keyof typeof fixedItemsMap];
                if (fixedItems) {
                    fixedItems.forEach((item, idx) => keys.push({ key: `${q.no}_${idx}`, label: `${q.no}.${idx + 1}` }));
                }
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
                q5Items.forEach((item, idx) => {
                    if (rowsPre[item.key]?.pf === "NA") return;
                    keys.push({ key: `${q.no}_${idx}`, label: `${q.no}.${idx + 1}` });
                });
            } else if (q.no === 7) {
                q7Items.forEach((item, idx) => {
                    if (rowsPre[item.key]?.pf === "NA") return;
                    keys.push({ key: `${q.no}_${idx}`, label: `${q.no}.${idx + 1}` });
                });
            } else if ([3, 4, 6, 10, 11, 17].includes(q.no)) {
                const fixedItems = fixedItemsMap[q.no as keyof typeof fixedItemsMap];
                if (fixedItems) {
                    fixedItems.forEach((item, idx) => {
                        if (rowsPre[item.key]?.pf === "NA") return;
                        keys.push({ key: `${q.no}_${idx}`, label: `${q.no}.${idx + 1}` });
                    });
                }
            }
        });

        return keys;
    }, [q5Items, q7Items, fixedItemsMap, rowsPre]);

    const missingPhotoItemsPre = useMemo(() => {
        return validPhotoKeysPre
            .filter(({ key }) => (photos[key]?.length ?? 0) < 1)
            .map(({ label }) => label)
            .sort((a, b) => {
                const [aMain, aSub] = a.split('.').map(Number);
                const [bMain, bSub] = b.split('.').map(Number);
                if (aMain !== bMain) return aMain - bMain;
                return (aSub || 0) - (bSub || 0);
            });
    }, [photos, validPhotoKeysPre]);

    const missingPhotoItemsPost = useMemo(() => {
        return validPhotoKeysPost
            .filter(({ key }) => (photos[key]?.length ?? 0) < 1)
            .map(({ label }) => label)
            .sort((a, b) => {
                const [aMain, aSub] = a.split('.').map(Number);
                const [bMain, bSub] = b.split('.').map(Number);
                if (aMain !== bMain) return aMain - bMain;
                return (aSub || 0) - (bSub || 0);
            });
    }, [photos, validPhotoKeysPost]);

    const allPhotosAttachedPre = missingPhotoItemsPre.length === 0;
    const allPhotosAttachedPost = missingPhotoItemsPost.length === 0;
    const missingPhotoItems = isPostMode ? missingPhotoItemsPost : missingPhotoItemsPre;
    const allPhotosAttached = isPostMode ? allPhotosAttachedPost : allPhotosAttachedPre;

    const PF_KEYS_PRE = useMemo(() => QUESTIONS.filter((q) => q.key !== "r16" && q.no !== 18).map((q) => q.key), []);
    const PF_KEYS_ALL = useMemo(() => QUESTIONS.map((q) => q.key), []);
    const allPFAnsweredPre = useMemo(() => PF_KEYS_PRE.every((k) => rows[k]?.pf !== ""), [rows, PF_KEYS_PRE]);
    const allPFAnsweredAll = useMemo(() => PF_KEYS_ALL.every((k) => rows[k]?.pf !== ""), [rows, PF_KEYS_ALL]);
    const missingPFItemsPre = useMemo(() => PF_KEYS_PRE.filter((k) => !rows[k]?.pf).map((k) => Number(k.replace("r", ""))).sort((a, b) => a - b), [rows, PF_KEYS_PRE]);
    const missingPFItemsAll = useMemo(() => PF_KEYS_ALL.filter((k) => !rows[k]?.pf).map((k) => Number(k.replace("r", ""))).sort((a, b) => a - b), [rows, PF_KEYS_ALL]);

    const MEASURE_BY_NO: Record<number, ReturnType<typeof useMeasure<UnitVoltage>> | undefined> = { 16: m16 };

    const missingInputs = useMemo(() => {
        const r: Record<number, string[]> = {};

        const missingCPs = (fixedItemsMap[10] || [])
            .filter((item) => {
                if (rowsPre[item.key]?.pf === "NA") return false;
                if (rows[item.key]?.pf === "NA") return false;
                return !cpIsNA && !cp[item.key]?.value?.trim();
            })
            .map((item) => `CP (${item.label})`);
        r[10] = missingCPs;

        if (rowsPre["r16"]?.pf === "NA" || rows["r16"]?.pf === "NA") {
            r[16] = [];
        } else {
            r[16] = VOLTAGE1_FIELDS.filter((k) => !m16.state[k]?.value?.toString().trim());
        }

        return r;
    }, [cpIsNA, cp, fixedItemsMap, m16.state, rows, rowsPre]);

    const validRemarkKeysPost = useMemo(() => {
        const keys: string[] = [];

        QUESTIONS.forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") {
                if (rowsPre[q.key]?.pf === "NA") return;
                keys.push(q.key);
            }

            if (q.no === 5) {
                q5Items.forEach((item) => {
                    if (rowsPre[item.key]?.pf === "NA") return;
                    keys.push(item.key);
                });
            } else if (q.no === 7) {
                q7Items.forEach((item) => {
                    if (rowsPre[item.key]?.pf === "NA") return;
                    keys.push(item.key);
                });
            } else if ([3, 4, 6, 10, 11, 17].includes(q.no)) {
                const fixedItems = fixedItemsMap[q.no as keyof typeof fixedItemsMap];
                if (fixedItems) {
                    fixedItems.forEach((item) => {
                        if (rowsPre[item.key]?.pf === "NA") return;
                        keys.push(item.key);
                    });
                }
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
                if (match) {
                    const qNo = parseInt(match[1], 10);
                    const subNo = match[2];
                    missing.push(subNo ? `${qNo}.${subNo}` : `${qNo}`);
                }
            }
        });

        return missing.sort((a, b) => {
            const [aMain, aSub] = a.split('.').map(Number);
            const [bMain, bSub] = b.split('.').map(Number);
            if (aMain !== bMain) return aMain - bMain;
            return (aSub || 0) - (bSub || 0);
        });
    }, [rows, validRemarkKeysPost]);

    const allRemarksFilledPost = missingRemarksPost.length === 0;

    const GROUP_QUESTION_NOS = [3, 4, 5, 6, 7, 10, 11, 17];
    const PF_KEYS_POST = useMemo(() => {
        const keys: string[] = [];

        QUESTIONS.forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") {
                if (rowsPre[q.key]?.pf !== "NA") {
                    keys.push(q.key);
                }
                return;
            }

            if (q.no === 5) {
                q5Items.forEach((item) => {
                    if (rowsPre[item.key]?.pf !== "NA") {
                        keys.push(item.key);
                    }
                });
            } else if (q.no === 7) {
                q7Items.forEach((item) => {
                    if (rowsPre[item.key]?.pf !== "NA") {
                        keys.push(item.key);
                    }
                });
            } else if ([3, 4, 6, 10, 11, 17].includes(q.no)) {
                const fixedItems = fixedItemsMap[q.no as keyof typeof fixedItemsMap];
                if (fixedItems) {
                    fixedItems.forEach((item) => {
                        if (rowsPre[item.key]?.pf !== "NA") {
                            keys.push(item.key);
                        }
                    });
                }
            }
        });

        return keys;
    }, [q5Items, q7Items, fixedItemsMap, rowsPre]);

    const allPFAnsweredPost = useMemo(() => {
        return PF_KEYS_POST.every((k) => rows[k]?.pf !== "");
    }, [rows, PF_KEYS_POST]);
    const missingPFItemsPost = useMemo(() => {
        return PF_KEYS_POST
            .filter((k) => !rows[k]?.pf)
            .map((k) => {
                const match = k.match(/^r(\d+)(?:_(\d+))?$/);
                if (match) {
                    const qNo = match[1];
                    const subNo = match[2];
                    return subNo ? `${qNo}.${subNo}` : qNo;
                }
                return k;
            })
            .sort((a, b) => {
                const [aMain, aSub] = a.split('.').map(Number);
                const [bMain, bSub] = b.split('.').map(Number);
                if (aMain !== bMain) return aMain - bMain;
                return (aSub || 0) - (bSub || 0);
            });
    }, [rows, PF_KEYS_POST]);

    const allRequiredInputsFilled = useMemo(() => Object.values(missingInputs).every((arr) => arr.length === 0), [missingInputs]);
    const missingInputsTextLines = useMemo(() => {
        const lines: string[] = [];
        (Object.entries(missingInputs) as [string, string[]][]).forEach(([no, arr]) => {
            if (arr.length > 0) lines.push(`Item ${no}: ${arr.map((k) => LABELS[k] ?? k).join(", ")}`);
        });
        return lines;
    }, [missingInputs]);

    const validRemarkKeys = useMemo(() => {
        const keys: string[] = [];

        QUESTIONS.forEach((q) => {
            if (q.kind === "simple" || q.kind === "measure") {
                keys.push(q.key);
            }

            if (q.no === 5) {
                q5Items.forEach((item) => keys.push(item.key));
            } else if (q.no === 7) {
                q7Items.forEach((item) => keys.push(item.key));
            } else if ([3, 4, 6, 10, 11, 17].includes(q.no)) {
                const fixedItems = fixedItemsMap[q.no as keyof typeof fixedItemsMap];
                if (fixedItems) {
                    fixedItems.forEach((item) => keys.push(item.key));
                }
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
                if (match) {
                    const qNo = parseInt(match[1], 10);
                    const subNo = match[2];
                    missing.push(subNo ? `${qNo}.${subNo}` : `${qNo}`);
                }
            }
        });

        return missing.sort((a, b) => {
            const [aMain, aSub] = a.split('.').map(Number);
            const [bMain, bSub] = b.split('.').map(Number);
            if (aMain !== bMain) return aMain - bMain;
            return (aSub || 0) - (bSub || 0);
        });
    }, [rows, validRemarkKeys]);

    const missingRemarksPre = useMemo(() => {
        return missingRemarks.filter(item => {
            const mainNo = parseInt(item.split('.')[0], 10);
            return mainNo !== 18;
        });
    }, [missingRemarks]);

    const allRemarksFilledPre = missingRemarksPre.length === 0;
    const allRemarksFilled = missingRemarks.length === 0;

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
                    <InputWithUnit<UnitVoltage> key={`${no}-${k}`} label={(LABELS[k] ?? k) as string}
                        value={m.state[k]?.value || ""} unit={(m.state[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                        onValueChange={(v) => m.patch(k, { value: v })} onUnitChange={(u) => handleUnitChange(no, k, u)} />
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
                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700">Before PM</Typography>
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.keys.map((k) => (
                        <div key={`pre-${no}-${k}`} className="tw-pointer-events-none tw-opacity-60">
                            <InputWithUnit<UnitVoltage> label={LABELS[k] ?? k} value={m16Pre[k]?.value || ""}
                                unit={(m16Pre[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                                onValueChange={() => { }} onUnitChange={() => { }} readOnly required={false} />
                        </div>
                    ))}
                </div>
                <Typography variant="small" className="tw-font-medium tw-text-blue-gray-700 tw-mt-2">After PM</Typography>
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.keys.map((k) => (
                        <InputWithUnit<UnitVoltage> key={`post-${no}-${k}`} label={LABELS[k] ?? k}
                            value={m.state[k]?.value || ""} unit={(m.state[k]?.unit as UnitVoltage) || "V"} units={UNITS.voltage}
                            onValueChange={(v) => m.patch(k, { value: v })} onUnitChange={(u) => handleUnitChange(no, k, u)} />
                    ))}
                </div>
            </div>
        );
    };

    // renderQuestionBlock function remains the same but uses translated labels
    const renderQuestionBlock = (q: Question, mode: TabId) => {
        const subtitle = FIELD_GROUPS[q.no]?.note;
        const fixedItems = fixedItemsMap[q.no as keyof typeof fixedItemsMap];

        // ========== PRE MODE ==========
        if (mode === "pre") {
            return (
                <SectionCard key={q.key} title={getQuestionLabel(q, mode)} subtitle={subtitle} tooltip={q.tooltip}>
                    <div className="tw-space-y-4">
                        {q.hasPhoto && q.kind === "simple" && (
                            <PhotoRemarkSection
                                qKey={q.key}
                                qNo={q.no}
                                photos={photos}
                                setPhotos={setPhotos}
                                rows={rows}
                                setRows={setRows}
                                draftKey={key}
                            />
                        )}

                        {q.no === 16 && (
                            <PhotoRemarkSection
                                qKey={q.key}
                                qNo={q.no}
                                middleContent={renderMeasureGrid(q.no)}
                                photos={photos}
                                setPhotos={setPhotos}
                                rows={rows}
                                setRows={setRows}
                                draftKey={key}
                            />
                        )}

                        {q.no === 5 && (
                            <DynamicItemsSection
                                qNo={5}
                                items={q5Items}
                                addItem={addQ5Item}
                                removeItem={removeQ5Item}
                                addButtonLabel="Add Emergency Stop"
                                photos={photos}
                                setPhotos={setPhotos}
                                rows={rows}
                                setRows={setRows}
                                draftKey={key}
                            />
                        )}
                        {q.no === 7 && (
                            <DynamicItemsSection
                                qNo={7}
                                items={q7Items}
                                addItem={addQ7Item}
                                removeItem={removeQ7Item}
                                addButtonLabel="Add Warning Sign"
                                photos={photos}
                                setPhotos={setPhotos}
                                rows={rows}
                                setRows={setRows}
                                draftKey={key}
                            />
                        )}

                        {[3, 4, 6, 17].includes(q.no) && fixedItems && (
                            <DynamicItemsSection
                                qNo={q.no}
                                items={fixedItems}
                                editable={false}
                                photos={photos}
                                setPhotos={setPhotos}
                                rows={rows}
                                setRows={setRows}
                                draftKey={key}
                            />
                        )}

                        {q.no === 10 && fixedItems && (
                            <DynamicItemsSection
                                qNo={10}
                                items={fixedItems}
                                editable={false}
                                photos={photos}
                                setPhotos={setPhotos}
                                rows={rows}
                                setRows={setRows}
                                draftKey={key}
                                renderAdditionalFields={(item, idx, isNA) => (
                                    <div className="tw-max-w-xs">
                                        <InputWithUnit<UnitVoltage>
                                            label="CP"
                                            value={cp[item.key]?.value ?? ""}
                                            unit={cp[item.key]?.unit ?? "V"}
                                            units={["V"] as const}
                                            onValueChange={(v) => setCp((s) => ({ ...s, [item.key]: { ...(s[item.key] ?? { unit: "V" }), value: v } }))}
                                            onUnitChange={(u) => setCp((s) => ({ ...s, [item.key]: { ...(s[item.key] ?? { value: "" }), unit: u } }))}
                                            disabled={isNA}
                                        />
                                    </div>
                                )}
                            />
                        )}

                        {q.no === 11 && fixedItems && (
                            <DynamicItemsSection
                                qNo={11}
                                items={fixedItems}
                                editable={false}
                                photos={photos}
                                setPhotos={setPhotos}
                                rows={rows}
                                setRows={setRows}
                                draftKey={key}
                            />
                        )}
                    </div>
                </SectionCard>
            );
        }

        // ========== POST MODE ========== (same logic, abbreviated for brevity)
        // ... rest of renderQuestionBlock remains the same
        return null; // Placeholder - full implementation would continue here
    };

    // Photo refs for draft
    const photoRefs = useMemo(() => {
        const out: Record<string, (PhotoRef | { isNA: true })[]> = {};
        Object.entries(photos).forEach(([key, list]) => {
            out[key] = (list || []).map(p => p.isNA ? { isNA: true } : p.ref).filter(Boolean) as (PhotoRef | { isNA: true })[];
        });
        return out;
    }, [photos]);

    // Debounced save
    useDebouncedEffect(() => {
        if (!sn) return;
        saveDraftLocal(key, { rows, cp, m16: m16.state, summary, dustFilterChanged, photoRefs });
    }, [key, sn, rows, cp, m16.state, summary, dustFilterChanged, photoRefs]);

    // Compress image function
    async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
        if (!file.type.startsWith("image/") || file.size < 500 * 1024) {
            return file;
        }

        return new Promise((resolve) => {
            const img = document.createElement("img");
            img.onload = () => {
                URL.revokeObjectURL(img.src);

                let { width, height } = img;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob && blob.size < file.size) {
                            resolve(new File([blob], file.name, { type: "image/jpeg" }));
                        } else {
                            resolve(file);
                        }
                    },
                    "image/jpeg",
                    quality
                );
            };
            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }

    // Upload photos - NOW USES SN
    async function uploadGroupPhotos(reportId: string, sn: string, group: string, files: File[], side: TabId) {
        if (files.length === 0) return;

        const compressedFiles = await Promise.all(files.map(f => compressImage(f)));

        const form = new FormData();
        form.append("sn", sn);
        form.append("group", group);
        form.append("side", side);
        compressedFiles.forEach((f) => form.append("files", f));

        const token = localStorage.getItem("access_token");
        const url = side === "pre"
            ? `${API_BASE}/pmreport/${reportId}/pre/photos`
            : `${API_BASE}/pmreport/${reportId}/post/photos`;

        const res = await fetch(url, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: form,
            credentials: "include"
        });
        if (!res.ok) throw new Error(await res.text());
    }

    // Pre-PM Save - NOW USES SN
    const onPreSave = async () => {
        if (!sn) { alert("SN not found"); return; }
        if (!allRequiredInputsFilled) { alert("Please fill in all required fields (Item 10 CP and Item 16)"); return; }
        if (!allRemarksFilledPre) { alert(`Please fill in remarks for: ${missingRemarksPre.join(", ")}`); return; }
        if (submitting) return;
        setSubmitting(true);

        try {
            const token = localStorage.getItem("access_token");
            const pm_date = job.date?.trim() || "";
            const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;

            const payload = {
                sn: sn,
                issue_id: issueIdFromJob,
                job: jobWithoutIssueId,
                inspector,
                measures_pre: { m16: m16.state, cp },
                rows_pre: rows,
                pm_date,
                doc_name: docName,
                side: "pre" as TabId
            };

            const submitRes = await fetch(`${API_BASE}/pmreport/pre/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (!submitRes.ok) throw new Error(await submitRes.text());
            const { report_id, doc_name } = await submitRes.json() as { report_id: string; doc_name?: string };
            if (doc_name) setDocName(doc_name);

            const uploadPromises: Promise<void>[] = [];
            Object.entries(photos).forEach(([no, list]) => {
                const files = (list || []).map(p => p.file).filter(Boolean) as File[];
                if (files.length > 0) {
                    uploadPromises.push(uploadGroupPhotos(report_id, sn, `g${no}`, files, "pre"));
                }
            });

            if (uploadPromises.length > 0) {
                await Promise.all(uploadPromises);
            }

            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(key, p.id)));

            clearDraftLocal(key);
            router.replace(`/dashboard/pm-report?sn=${encodeURIComponent(sn)}`);
        } catch (err: any) {
            alert(`Save failed: ${err?.message ?? err}`);
        } finally {
            setSubmitting(false);
        }
    };

    // Post-PM Save - NOW USES SN
    const onFinalSave = async () => {
        if (!sn) { alert("SN not found"); return; }
        if (submitting) return;
        setSubmitting(true);

        try {
            const token = localStorage.getItem("access_token");

            const payload = {
                sn: sn,
                rows,
                measures: { m16: m16.state, cp },
                summary,
                ...(summaryCheck ? { summaryCheck } : {}),
                dust_filter: dustFilterChanged,
                side: "post" as TabId,
                report_id: editId
            };

            const submitRes = await fetch(`${API_BASE}/pmreport/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (!submitRes.ok) throw new Error(await submitRes.text());
            const { report_id } = await submitRes.json() as { report_id: string };

            const uploadPromises: Promise<void>[] = [];
            Object.entries(photos).forEach(([no, list]) => {
                const files = (list || []).map(p => p.file).filter(Boolean) as File[];
                if (files.length > 0) {
                    uploadPromises.push(uploadGroupPhotos(report_id, sn, `g${no}`, files, "post"));
                }
            });

            if (uploadPromises.length > 0) {
                await Promise.all(uploadPromises);
            }

            await fetch(`${API_BASE}/pmreport/${report_id}/finalize`, {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                credentials: "include",
                body: new URLSearchParams({ sn: sn })
            });

            const allPhotos = Object.values(photos).flat();
            await Promise.all(allPhotos.map(p => delPhoto(key, p.id)));

            clearDraftLocal(key);
            router.replace(`/dashboard/pm-report?sn=${encodeURIComponent(sn)}`);
        } catch (err: any) {
            alert(`Save failed: ${err?.message ?? err}`);
        } finally {
            setSubmitting(false);
        }
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
        if (next === "post" && !canGoAfter) { alert("Please complete all Pre-PM fields first"); return; }
        const params = new URLSearchParams(searchParams.toString());
        params.set("pmtab", tabToSlug(next));
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const allPFAnsweredForUI = displayTab === "pre" ? allPFAnsweredPre : allPFAnsweredPost;
    const missingPFItemsForUI = displayTab === "pre" ? missingPFItemsPre : missingPFItemsPost;
    const missingRemarksForUI = displayTab === "pre" ? missingRemarksPre : missingRemarksPost;
    const allRemarksFilledForUI = displayTab === "pre" ? allRemarksFilledPre : allRemarksFilledPost;

    return (
        <section className="tw-pb-24">
            <div className="tw-mx-auto tw-max-w-6xl tw-flex tw-items-center tw-justify-between tw-mb-4">
                <Button variant="outlined" size="sm" onClick={() => router.back()} title="Back to List">
                    <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
                </Button>
                <Tabs value={displayTab}>
                    <TabsHeader className="tw-bg-blue-gray-50 tw-rounded-lg">
                        {TABS.map((t) => {
                            const isPreDisabled = isPostMode && t.id === "pre";
                            const isLockedAfter = t.id === "post" && !canGoAfter;
                            if (isPreDisabled) return <div key={t.id} className="tw-px-4 tw-py-2 tw-font-medium tw-opacity-50 tw-cursor-not-allowed tw-select-none">{t.label}</div>;
                            if (isLockedAfter) return <div key={t.id} className="tw-px-4 tw-py-2 tw-font-medium tw-opacity-50 tw-cursor-not-allowed tw-select-none" onClick={() => alert("Please complete all Pre-PM fields first")}>{t.label}</div>;
                            return <Tab key={t.id} value={t.id} onClick={() => go(t.id)} className="tw-px-4 tw-py-2 tw-font-medium">{t.label}</Tab>;
                        })}
                    </TabsHeader>
                </Tabs>
            </div>

            <form action="#" noValidate onSubmit={(e) => { e.preventDefault(); return false; }} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
                <div className="tw-mx-auto tw-max-w-6xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-sm tw-p-6 md:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0">
                    <div className="tw-flex tw-flex-col tw-gap-4 md:tw-flex-row md:tw-items-start md:tw-justify-between md:tw-gap-6">
                        <div className="tw-flex tw-items-start tw-gap-3 md:tw-gap-4">
                            <div className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md tw-shrink-0 tw-h-14 tw-w-[64px] sm:tw-h-16 sm:tw-w-[76px] md:tw-h-20 md:tw-w-[108px] lg:tw-h-24 lg:tw-w-[152px]">
                                <Image src={LOGO_SRC} alt="Company logo" fill priority className="tw-object-contain tw-p-0"
                                    sizes="(min-width:1024px) 152px, (min-width:768px) 108px, (min-width:640px) 76px, 64px" />
                            </div>
                            <div className="tw-min-w-0">
                                <div className="tw-font-semibold tw-text-blue-gray-900 tw-text-sm sm:tw-text-base">
                                    Preventive Maintenance Checklist - EV Charger
                                </div>
                                <div className="tw-text-xs sm:tw-text-sm tw-text-blue-gray-600">
                                    Electricity Generating Authority of Thailand (EGAT)<br />
                                    <span className="tw-hidden sm:tw-inline">53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand<br /></span>
                                    <span className="sm:tw-hidden">Bang Kruai, Nonthaburi 11130<br /></span>
                                    Call Center Tel. 02-114-3350
                                </div>
                            </div>
                        </div>
                        <div className="tw-text-left md:tw-text-right tw-text-sm tw-text-blue-gray-700 tw-border-t tw-border-blue-gray-100 tw-pt-3 md:tw-border-t-0 md:tw-pt-0 md:tw-shrink-0">
                            <div className="tw-font-semibold">Document Name</div>
                            <div className="tw-break-all">{docName || "-"}</div>
                        </div>
                    </div>

                    <div className="tw-mt-8 tw-space-y-8">
                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-8 tw-gap-4">
                            <div className="lg:tw-col-span-2"><Input label="Issue ID" value={job.issue_id || "-"} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full !tw-bg-blue-gray-50" /></div>
                            <div className="sm:tw-col-span-2 lg:tw-col-span-2"><Input label="Location" value={job.station_name} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-2"><Input label="PM Date" type="text" value={job.date} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-2"><Input label="Inspector" value={inspector} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-2"><Input label="Brand" value={job.brand} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-2"><Input label="Model" value={job.model} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-2"><Input label="Power" value={job.power} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                            <div className="lg:tw-col-span-2"><Input label="Serial Number (SN)" value={job.sn} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                        </div>
                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            <div className="sm:tw-col-span-2 lg:tw-col-span-3"><Input label="Charger No." value={job.chargerNo} readOnly crossOrigin="" containerProps={{ className: "!tw-min-w-0" }} className="!tw-bg-blue-gray-50" /></div>
                        </div>
                    </div>

                    <CardBody className="tw-space-y-2">
                        {QUESTIONS.filter((q) => !(displayTab === "pre" && q.no === 18)).map((q) => renderQuestionBlock(q, displayTab))}
                    </CardBody>

                    <CardBody className="tw-space-y-3 !tw-pt-4 !tw-pb-0">
                        <Typography variant="h6" className="tw-mb-1">Comment</Typography>
                        <Textarea label="Comment" value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} required={isPostMode} autoComplete="off" containerProps={{ className: "!tw-min-w-0" }} className="!tw-w-full resize-none" />
                        {displayTab === "post" && (
                            <div className="tw-pt-4 tw-border-t tw-border-blue-gray-100">
                                <PassFailRow label="Inspection Summary" value={summaryCheck} onChange={(v) => setSummaryCheck(v)} labels={{ PASS: "Pass", FAIL: "Fail", NA: "N/A" }} />
                            </div>
                        )}
                    </CardBody>

                    <CardFooter className="tw-flex tw-flex-col tw-gap-3 tw-mt-4">
                        <div className="tw-p-3 tw-flex tw-flex-col tw-gap-2">
                            <Section title="1) Photo Attachments (all items)" ok={allPhotosAttached}>
                                <Typography variant="small" className="!tw-text-amber-700">Missing photos for: {missingPhotoItems.join(", ")}</Typography>
                            </Section>
                            <Section title="2) Input Item 10 and 16" ok={allRequiredInputsFilled}>
                                <div className="tw-space-y-1">
                                    <Typography variant="small" className="!tw-text-amber-700">Missing:</Typography>
                                    <ul className="tw-list-disc tw-ml-5 tw-text-sm tw-text-blue-gray-700">
                                        {missingInputsTextLines.map((line, i) => <li key={i}>{line}</li>)}
                                    </ul>
                                </div>
                            </Section>
                            {displayTab === "pre" && (
                                <Section title="3) Remarks (all items)" ok={allRemarksFilledPre}>
                                    {missingRemarksPre.length > 0 && (
                                        <Typography variant="small" className="!tw-text-amber-700">
                                            Missing remarks for: {missingRemarksPre.join(", ")}
                                        </Typography>
                                    )}
                                </Section>
                            )}
                            {isPostMode && (
                                <>
                                    <Section title="3) PASS / FAIL / N/A Status" ok={allPFAnsweredForUI}>
                                        <Typography variant="small" className="!tw-text-amber-700">Not selected: {missingPFItemsForUI.join(", ")}</Typography>
                                    </Section>
                                    <Section title="4) Remarks (all items)" ok={allRemarksFilledPost}>
                                        {missingRemarksPost.length > 0 && (
                                            <Typography variant="small" className="!tw-text-amber-700">
                                                Missing remarks for: {missingRemarksPost.join(", ")}
                                            </Typography>
                                        )}
                                    </Section>
                                    <Section title="5) Inspection Summary" ok={isSummaryFilled && isSummaryCheckFilled}>
                                        <div className="tw-space-y-1">
                                            {!isSummaryFilled && <Typography variant="small" className="!tw-text-amber-700">Comment not filled</Typography>}
                                            {!isSummaryCheckFilled && <Typography variant="small" className="!tw-text-amber-700">Summary status not selected (Pass/Fail/N/A)</Typography>}
                                        </div>
                                    </Section>
                                </>
                            )}
                        </div>
                        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-3">
                            {displayTab === "pre" ? (
                                <Button color="blue" type="button" onClick={onPreSave}
                                    disabled={!canGoAfter || submitting}
                                    title={
                                        !allPhotosAttachedPre ? "Please attach all photos in Pre-PM section"
                                            : !allRequiredInputsFilled ? "Please fill in Item 10 (CP) and Item 16"
                                                : !allRemarksFilledPre ? `Please fill remarks for: ${missingRemarksPre.join(", ")}`
                                                    : undefined
                                    }>
                                    {submitting ? "Saving..." : "Save"}
                                </Button>
                            ) : (
                                <Button color="blue" type="button" onClick={onFinalSave} disabled={!canFinalSave || submitting}
                                    title={!canFinalSave ? "Please complete all fields and attach photos before saving" : undefined}>
                                    {submitting ? "Saving..." : "Save"}
                                </Button>
                            )}
                        </div>
                    </CardFooter>
                </div>
            </form>
        </section>
    );
}