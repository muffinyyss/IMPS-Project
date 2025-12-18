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
} from "@material-tailwind/react";
import Image from "next/image";
import { draftKeyCCB, saveDraftLocal, loadDraftLocal, clearDraftLocal } from "@/app/dashboard/pm-report/ccb/input_PMreport/lib/draft";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Tabs, TabsHeader, TabsBody, Tab, TabPanel } from "@material-tailwind/react";
import { apiFetch } from "@/utils/api";
import { putPhoto, getPhoto, delPhoto, type PhotoRef } from "../lib/draftPhotos";

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

/* =========================
 *        API (เดิม)
 * ========================= */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const LOGO_SRC = "/img/logo_egat.png";

type StationPublic = {
    station_id: string;
    station_name: string;
    // SN?: string;
    // WO?: string;
    // chargeBoxID?: string;
    // model?: string;
    status?: boolean;
};

type Me = {
    id: string;
    username: string;
    email: string;
    role: string;
    company: string;
    tel: string;
};

async function getStationInfoPublic(stationId: string): Promise<StationPublic> {
    const url = `${API_BASE}/station/info/public?station_id=${encodeURIComponent(stationId)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) throw new Error("Station not found");
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
};

type PF = "PASS" | "FAIL" | "NA" | "";

/** ช่องวัดค่าแรงดัน (ข้อ 9) – เฟสเดียวตามภาพ */
const VOLTAGE_FIELDS_CCB = ["L-N", "L-G", "N-G"] as const;
const LABELS: Record<string, string> = { "L-N": "L - N", "L-G": "L - G", "N-G": "N - G" };

/* ---------- 9 หัวข้อ ตามภาพ ---------- */
type Question =
    | { no: number; key: `r${number}`; label: string; labelPre?: string; labelPost?: string; kind: "simple"; hasPhoto?: boolean }
    | { no: number; key: `r${number}`; label: string; labelPre?: string; labelPost?: string; kind: "group"; items: { key: string; label: string }[]; hasPhoto?: boolean }
    | { no: number; key: `r${number}`; label: string; labelPre?: string; labelPost?: string; kind: "measure9"; hasPhoto?: boolean };

const QUESTIONS_RAW: Question[] = [
    { no: 1, key: "r1", label: "1) ตรวจสอบสภาพทั่วไป", kind: "simple", hasPhoto: true },
    { no: 2, key: "r2", label: "2) ตรวจสอบสภาพดักซีล, ซิลิโคนกันซึม", kind: "simple", hasPhoto: true },

    {
        no: 3,
        key: "r3",
        label: "3) ตรวจสอบระบบระบายอากาศ",
        kind: "group",
        hasPhoto: true,
        items: [
            { key: "r3_1", label: "ตรวจสอบการทำงานอุปกรณ์ตั้งภูมิ" },
            { key: "r3_2", label: "ตรวจสอบการทำงานพัดลมระบายอากาศ" },
        ],
    },

    {
        no: 4,
        key: "r4",
        label: "4) ตรวจสอบระบบแสงสว่าง",
        kind: "group",
        hasPhoto: true,
        items: [
            { key: "r4_1", label: "ตรวจสอบการทำงานของไฟส่องสว่างในสถานี" },
            { key: "r4_2", label: "ตรวจสอบการทำงานของป้ายไฟ / Logo" },
        ],
    },

    {
        no: 5,
        key: "r5",
        label: "5) ตรวจสอบระบบสำรองไฟฟ้า (UPS)",
        kind: "group",
        hasPhoto: true,
        items: [
            { key: "r5_1", label: "เครื่องสามารถทำงานได้ตามปกติ" },
            { key: "r5_2", label: "เครื่องสามารถสำรองไฟได้ (>5 นาที)" },
        ],
    },

    {
        no: 6,
        key: "r6",
        label: "6) ตรวจสอบระบบกล้องวงจรปิด (CCTV)",
        kind: "group",
        hasPhoto: true,
        items: [
            { key: "r6_1", label: "ตรวจสอบสภาพทั่วไปของกล้องวงจรปิด" },
            { key: "r6_2", label: "ตรวจสอบสภาพทั่วไปเครื่องบันทึก (NVR)" },
            { key: "r6_3", label: "ตรวจสอบสถานะการใช้งาน" },
            { key: "r6_4", label: "ตรวจสอบมุมกล้อง" },
        ],
    },

    {
        no: 7,
        key: "r7",
        label: "7) ตรวจสอบเราเตอร์ (Router)",
        kind: "group",
        hasPhoto: true,
        items: [
            { key: "r7_1", label: "ตรวจสอบสภาพทั่วไป" },
            { key: "r7_2", label: "ตรวจสอบสถานะการทำงาน" },
        ],
    },

    {
        no: 8,
        key: "r8",
        label: "8) ตรวจสอบตู้คอนซูเมอร์ยูนิต (Consumer Unit)",
        kind: "group",
        hasPhoto: true,
        items: [
            { key: "r8_1", label: "ตรวจสอบสภาพทั่วไป" },
            { key: "r8_2", label: "ตรวจสอบจุดขันแน่น" },
        ],
    },

    { no: 9, key: "r9", label: "9) ตรวจสอบแรงดันไฟฟ้า (Consumer Unit)", kind: "measure9", hasPhoto: true },
    { no: 10, key: "r10", label: "10) ทำความสะอาด", kind: "simple", hasPhoto: true },
];

function getQuestionLabel(q: Question, mode: TabId): string {
    if (mode === "pre") {
        // ถ้ามี labelPre ให้ใช้, ถ้าไม่มีก็เอา label ปกติแล้วเติม "(ก่อน PM)"
        return q.labelPre ?? `${q.label} (ก่อน PM)`;
    }
    // mode === "post"
    return q.labelPost ?? `${q.label} (หลัง PM)`;
}

const QUESTIONS: Question[] = QUESTIONS_RAW.filter(
    (q) => q.kind === "simple" || q.kind === "group" || q.kind === "measure9"
) as Question[];


/* =========================
 *        TYPES & HOOKS
 * ========================= */
type MeasureRow<U extends string> = { value: string; unit: U };
type MeasureState<U extends string> = Record<string, MeasureRow<U>>;

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

/* =========================
 *       UI ATOMS
 * ========================= */
function SectionCard({
    title,
    subtitle,
    children
}: {
    title?: string;
    subtitle?: string;
    children: React.ReactNode
}) {
    return (
        <>
            {/* Title นอกกรอบการ์ด */}
            {title && (
                <Typography variant="h6" className="tw-mb-1">
                    {title}
                </Typography>
            )}

            {/* การ์ด (มีเฉพาะกรอบ +เนื้อหา+subtitle ด้านใน) */}
            <Card className="tw-mt-1 tw-shadow-sm tw-border tw-border-blue-gray-100">
                {subtitle && (
                    <CardHeader
                        floated={false}
                        shadow={false}
                        className="tw-px-4 tw-pt-4 tw-pb-2"
                    >
                        <Typography
                            variant="small"
                            className="!tw-text-blue-gray-500 tw-italic tw-mt-1"
                        >
                            {subtitle}
                        </Typography>
                    </CardHeader>
                )}

                <CardBody className="tw-space-y-4">
                    {children}
                </CardBody>
            </Card>
        </>
    );
}

function Section({
    title,
    ok,
    children,
}: {
    title: React.ReactNode;
    ok: boolean;
    children?: React.ReactNode;
}) {
    return (
        <div
            className={`tw-rounded-lg tw-border tw-p-3 ${ok ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"
                }`}
        >
            <Typography className="tw-font-medium">{title}</Typography>
            {ok ? (
                <Typography variant="small" className="!tw-text-green-700">
                    ครบเรียบร้อย ✅
                </Typography>
            ) : (
                children
            )}
        </div>
    );
}

function InputWithUnit<U extends string>({
    label,
    value,
    unit,
    units,
    onValueChange,
    onUnitChange,
    readOnly,
    disabled,
    labelOnTop,
    required = true,
}: {
    label: string;
    value: string;
    unit: U;
    units: readonly U[];
    onValueChange: (v: string) => void;
    onUnitChange: (u: U) => void;
    readOnly?: boolean;
    disabled?: boolean;
    labelOnTop?: boolean;
    required?: boolean;
}) {
    return (

        <div className="tw-space-y-1">
            {labelOnTop && (
                <Typography
                    variant="small"
                    className="tw-font-medium tw-text-blue-gray-700"
                >
                    {label}
                </Typography>
            )}

            <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-items-end sm:tw-items-center">
                {/* <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    label={labelOnTop ? undefined : label}
                    value={value}
                    onChange={(e) => onValueChange(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    crossOrigin=""
                    containerProps={{ className: "tw-col-span-1 !tw-min-w-0" }}
                    className={`!tw-w-full ${disabled ? "!tw-bg-blue-gray-50" : ""
                        }`}
                    readOnly={readOnly}
                    disabled={disabled}
                    required={required}          // 👈 ใช้ค่าจาก prop
                /> */}
                <Input
                    type="text"
                    inputMode="decimal"
                    label={labelOnTop ? undefined : label}
                    value={value}
                    onChange={(e) => {
                        const newValue = e.target.value;

                        // อนุญาต:
                        // 1. ค่าว่าง ""
                        // 2. เฉพาะ "-" (ขีดกลางตัวเดียว)
                        // 3. ตัวเลข + จุดทศนิยม + เครื่องหมายลบหน้าตัวเลข (เช่น -123.45)
                        if (
                            newValue === "" ||                           // ค่าว่าง
                            newValue === "-" ||                          // ขีดกลางตัวเดียว
                            /^-?\d*\.?\d*$/.test(newValue)              // ตัวเลข (มีหรือไม่มีลบข้างหน้า)
                        ) {
                            onValueChange(newValue);
                        }
                    }}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    crossOrigin=""
                    containerProps={{ className: "tw-col-span-1 !tw-min-w-0" }}
                    className={`!tw-w-full ${disabled ? "!tw-bg-blue-gray-50" : ""}`}
                    readOnly={readOnly}
                    disabled={disabled}
                    required={required}
                />
                <select
                    required={required}          // 👈 ใส่ตาม prop จะได้ไม่บังคับตอน pre
                    value={unit}
                    onChange={(e) => onUnitChange(e.target.value as U)}
                    className={`tw-col-span-1 tw-h-10 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500/30 focus:tw-border-blue-500 ${disabled
                        ? "tw-bg-blue-gray-50 tw-text-blue-gray-400 tw-cursor-not-allowed"
                        : ""
                        }`}
                    disabled={disabled}
                >
                    {units.map((u) => (
                        <option key={u} value={u}>
                            {u}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function PassFailRow({
    label,
    value,
    onChange,
    remark,
    onRemarkChange,
    labels,
    aboveRemark,              // 👈 เพิ่มตรงนี้
    inlineLeft,
}: {
    label: string;
    value: PF;
    onChange: (v: Exclude<PF, "">) => void;
    remark?: string;
    onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
    aboveRemark?: React.ReactNode;   // 👈 และเพิ่มใน type ตรงนี้
    inlineLeft?: React.ReactNode;
}) {
    const text = {
        PASS: labels?.PASS ?? "PASS",
        FAIL: labels?.FAIL ?? "FAIL",
        NA: labels?.NA ?? "N/A",
    };

    const buttonGroup = (
        <div className="tw-flex tw-gap-2 tw-ml-auto">
            <Button
                size="sm"
                color="green"
                variant={value === "PASS" ? "filled" : "outlined"}
                className="sm:tw-min-w-[84px]"
                onClick={() => onChange("PASS")}
            >
                {text.PASS}
            </Button>
            <Button
                size="sm"
                color="red"
                variant={value === "FAIL" ? "filled" : "outlined"}
                className="sm:tw-min-w-[84px]"
                onClick={() => onChange("FAIL")}
            >
                {text.FAIL}
            </Button>
            <Button
                size="sm"
                color="blue-gray"
                variant={value === "NA" ? "filled" : "outlined"}
                className="sm:tw-min-w-[84px]"
                onClick={() => onChange("NA")}
            >
                {text.NA}
            </Button>

        </div>
    );

    const buttonsRow = (
        <div className="tw-flex tw-items-center tw-gap-3 tw-w-full">
            {inlineLeft && (
                <div className="tw-flex tw-items-center tw-gap-2">
                    {inlineLeft}
                </div>
            )}
            {buttonGroup}
        </div>
    );

    return (

        <div className="tw-space-y-3 tw-py-3">
            <Typography className="tw-font-medium">{label}</Typography>

            {onRemarkChange ? (
                <div className="tw-w-full tw-min-w-0 tw-space-y-2">
                    {/* รูปอยู่เหนือปุ่ม */}
                    {aboveRemark}

                    {/* แถว checkbox ซ้าย + ปุ่มขวา */}
                    {buttonsRow}

                    <Textarea
                        label="หมายเหตุ (ถ้ามี)"
                        value={remark || ""}
                        onChange={(e) => onRemarkChange(e.target.value)}
                        containerProps={{ className: "!tw-w-full !tw-min-w-0" }}
                        className="!tw-w-full"
                    />
                </div>
            ) : (
                <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">
                    {buttonsRow}
                </div>
            )}
        </div>
    );
}

function PhotoMultiInput({
    label,
    photos,
    setPhotos,
    max = 18,
    draftKey,
    qNo,
}: {
    label?: string;
    photos: PhotoItem[];
    setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
    max?: number;
    draftKey: string;  // ✅ เพิ่ม
    qNo: number;
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

                return {
                    id: photoId,
                    file: f,
                    preview: URL.createObjectURL(f),
                    remark: "",
                    ref,
                };
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
            {/* แถวบน: label + ปุ่มแนบรูป */}
            <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2">
                {/* {label && (
              <Typography className="tw-font-medium">
                {label}
              </Typography>
            )} */}

                <Button
                    size="sm"
                    color="blue"
                    variant="outlined"
                    onClick={handlePick}
                    className="tw-shrink-0"
                >
                    แนบรูป / ถ่ายรูป
                </Button>
            </div>

            {/* แถวถัดไป: description */}
            <Typography
                variant="small"
                className="!tw-text-blue-gray-500 tw-flex tw-items-center"
            >
                แนบได้สูงสุด {max} รูป • รองรับการถ่ายจากกล้องบนมือถือ
            </Typography>

            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="tw-hidden"
                // onChange={(e) => handleFiles(e.target.files)}
                onChange={(e) => { void handleFiles(e.target.files); }}
            />

            {photos.length > 0 ? (
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                    {photos.map((p) => (
                        <div
                            key={p.id}
                            className="tw-border tw-rounded-lg tw-overflow-hidden tw-bg-white tw-shadow-xs tw-flex tw-flex-col"
                        >

                            <div className="tw-relative tw-aspect-[4/3] tw-bg-blue-gray-50">
                                {p.preview && (
                                    <img
                                        src={p.preview}
                                        alt="preview"
                                        className="tw-w-full tw-h-full tw-object-cover"
                                    />
                                )}
                                <button
                                    // onClick={() => handleRemove(p.id)}
                                    onClick={() => { void handleRemove(p.id); }}
                                    className="tw-absolute tw-top-2 tw-right-2 tw-bg-red-500 tw-text-white tw-w-6 tw-h-6 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-shadow-md hover:tw-bg-red-600 tw-transition-colors"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Typography variant="small" className="!tw-text-blue-gray-500">
                    ยังไม่มีรูปแนบ
                </Typography>
            )}
        </div>
    );
}

const PM_TYPE_CODE = "CC";



async function fetchPreviewIssueId(
    stationId: string,
    pmDate: string
): Promise<string | null> {
    const u = new URL(`${API_BASE}/ccbpmreport/preview-issueid`);
    u.searchParams.set("station_id", stationId);
    u.searchParams.set("pm_date", pmDate);

    const token =
        typeof window !== "undefined"
            ? localStorage.getItem("access_token") ?? ""
            : "";

    const r = await fetch(u.toString(), {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!r.ok) {
        console.error("fetchPreviewIssueId failed:", r.status);
        return null;
    }

    const j = await r.json();
    return (j && typeof j.issue_id === "string") ? j.issue_id : null;
}


async function fetchPreviewDocName(
    stationId: string,
    pmDate: string
): Promise<string | null> {
    const u = new URL(`${API_BASE}/ccbpmreport/preview-docname`);
    u.searchParams.set("station_id", stationId);
    u.searchParams.set("pm_date", pmDate);

    const token =
        typeof window !== "undefined"
            ? localStorage.getItem("access_token") ?? ""
            : "";

    const r = await fetch(u.toString(), {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!r.ok) {
        console.error("fetchPreviewDocName failed:", r.status);
        return null;
    }

    const j = await r.json();
    return (j && typeof j.doc_name === "string") ? j.doc_name : null;
}

async function fetchReport(reportId: string, stationId: string) {
    const token = localStorage.getItem("access_token") ?? "";

    const url = `${API_BASE}/ccbpmreport/get?station_id=${stationId}&report_id=${reportId}`;

    const res = await fetch(url, {
        // const res = await apiFetch(url, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
    });

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
/* =========================
 *        MAIN
 * ========================= */
// export default function CheckList({ onComplete, onNext, onPrev }: CheckListProps) {
export default function CCBPMReport() {
    const [me, setMe] = useState<Me | null>(null);
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [docName, setDocName] = useState<string>("");

    const searchParams = useSearchParams();
    const pathname = usePathname();

    const editId = searchParams.get("edit_id") ?? "";
    const action = searchParams.get("action");
    const isPostMode = action === "post";
    const isPreMode = !isPostMode;
    const PM_PREFIX = "ccbpmreport";

    /* ---------- photos per question ---------- */
    // const initialPhotos: Record<number, PhotoItem[]> = Object.fromEntries(
    //     QUESTIONS.filter((q) => q.hasPhoto).map((q) => [q.no, [] as PhotoItem[]])
    // ) as Record<number, PhotoItem[]>;
    // const initialPhotos: Record<string, PhotoItem[]> = Object.fromEntries(
    //     QUESTIONS.filter((q) => q.hasPhoto).flatMap((q) => {
    //         const entries: [string, PhotoItem[]][] = [];
    //         // เพิ่มสำหรับ question level
    //         entries.push([`q${q.no}`, []]);
    //         // เพิ่มสำหรับ sub-items ของ group
    //         if (q.kind === "group") {
    //             q.items.forEach((item) => {
    //                 entries.push([item.key, []]);
    //             });
    //         }
    //         return entries;
    //     })
    // ) as Record<string, PhotoItem[]>;
    const initialPhotos: Record<string, PhotoItem[]> = Object.fromEntries(
        QUESTIONS.filter((q) => q.hasPhoto).flatMap((q) => {
            const entries: [string, PhotoItem[]][] = [];

            if (q.kind === "simple") {
                entries.push([`q${q.no}`, []]);
            } else if (q.kind === "group") {
                q.items.forEach((item) => {
                    entries.push([item.key, []]);
                });
            } else if (q.kind === "measure9") {
                // ✅ เพิ่มส่วนนี้
                for (let i = 0; i <= 5; i++) {
                    entries.push([`r9_${i}`, []]);
                }
            }

            return entries;
        })
    ) as Record<string, PhotoItem[]>;
    const [photos, setPhotos] = useState<Record<string, PhotoItem[]>>(initialPhotos);

    const [summary, setSummary] = useState<string>("");

    const [stationId, setStationId] = useState<string | null>(null);
    const [draftId, setDraftId] = useState<string | null>(null);
    // const [สรุปผล, setสรุปผล] = useState<PF>("");
    const [summaryCheck, setSummaryCheck] = useState<PF>("");
    const [inspector, setInspector] = useState<string>("");


    const key = useMemo(() => draftKeyCCB(stationId), [stationId]);


    /* ---------- job info ---------- */
    const [job, setJob] = useState({
        issue_id: "",
        //  chargerNo: "", 
        //  sn: "", 
        //  model: "", 
        station_name: "",
        date: getTodayLocalStr(),
        //  inspector: "" 
    });

    /* ---------- PASS/FAIL + remark ---------- */
    // รวม key ทั้งหัวข้อหลัก + หัวข้อย่อย
    const ALL_KEYS = useMemo(() => {
        const base = QUESTIONS.flatMap((q) => (q.kind === "group" ? [q.key, ...q.items.map((i) => i.key as string)] : [q.key]));
        return base;
    }, []);

    // const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(
    //     Object.fromEntries(ALL_KEYS.map((k) => [k, { pf: "", remark: "" }])) as Record<string, { pf: PF; remark: string }>
    // );
    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(() => {
        const initial: Record<string, { pf: PF; remark: string }> = {};

        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") {
                initial[q.key] = { pf: "", remark: "" };
            } else if (q.kind === "group") {
                q.items.forEach((item) => {
                    initial[item.key] = { pf: "", remark: "" };
                });
            }
        });

        return initial;
    });

    /* ---------- ข้อ 9: วัดค่าแรงดัน (เมน + ย่อย 1–5) ---------- */
    const BREAKERS = [
        "เมนเบรกเกอร์ (Main Breaker)",
        "เบรกเกอร์วงจรย่อยที่ 1",
        "เบรกเกอร์วงจรย่อยที่ 2",
        "เบรกเกอร์วงจรย่อยที่ 3",
        "เบรกเกอร์วงจรย่อยที่ 4",
        "เบรกเกอร์วงจรย่อยที่ 5",
    ];

    const m9_0 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const m9_1 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const m9_2 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const m9_3 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const m9_4 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const m9_5 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");
    const M9_LIST = [m9_0, m9_1, m9_2, m9_3, m9_4, m9_5];

    // Pre-PM measurements for display comparison in post mode
    const [m9_0Pre, setM9_0Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
    const [m9_1Pre, setM9_1Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
    const [m9_2Pre, setM9_2Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
    const [m9_3Pre, setM9_3Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
    const [m9_4Pre, setM9_4Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
    const [m9_5Pre, setM9_5Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));

    // Helper objects
    const FIELD_GROUPS: Record<number, { keys: readonly string[] }> = {
        9: { keys: VOLTAGE_FIELDS_CCB },
    };

    const MEASURE_BY_NO: Record<number, ReturnType<typeof useMeasure<UnitVoltage>>> = {
        9: m9_0, // Note: this is just for reference, actual measure is determined per breaker
    };

    function getPreMeasureState(no: number): MeasureState<UnitVoltage> | null {
        // For measure9, return the pre-state for breaker 0 (main)
        // This is used by renderMeasureGridWithPre
        if (no === 9) return m9_0Pre;
        return null;
    }

    useEffect(() => {
        const token =
            typeof window !== "undefined"
                ? localStorage.getItem("access_token") ?? ""
                : "";

        if (!token) return;

        (async () => {
            try {
                const res = await fetch(`${API_BASE}/me`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: "include",
                });

                if (!res.ok) {
                    console.warn("fetch /me failed:", res.status);
                    return;
                }

                const data: Me = await res.json();
                setMe(data);

                // ถ้ายังไม่มี inspector ให้ auto-fill เป็น username
                setInspector((prev) => prev || data.username || "");
            } catch (err) {
                console.error("fetch /me error:", err);
            }
        })();
    }, []);

    useEffect(() => {
        if (!stationId || !job.date) return;

        let canceled = false;

        (async () => {
            try {
                const preview = await fetchPreviewIssueId(stationId, job.date);
                if (!canceled && preview) {
                    setJob(prev => ({ ...prev, issue_id: preview }));
                }
            } catch (err) {
                console.error("preview issue_id error:", err);
                // ถ้า error ปล่อยให้ว่างไว้ → backend จะ gen เองตอน submit
            }
        })();

        return () => { canceled = true; };
    }, [stationId, job.date]);

    useEffect(() => {
        if (isPostMode) return;
        if (!stationId || !job.date) return;

        let canceled = false;

        (async () => {
            try {
                const preview = await fetchPreviewDocName(stationId, job.date);

                if (!canceled && preview) {
                    // ถ้าเป็นหน้า edit แล้วดึง doc_name เดิมจาก DB มาอยู่แล้ว
                    // จะไม่บังคับทับ ถ้าอยากกันตรงนี้เพิ่มเงื่อนไข isEdit ได้
                    setDocName(preview);
                }
            } catch (err) {
                console.error("preview docName error:", err);
                // ถ้า error ปล่อยให้ docName ว่างไว้ → ฝั่ง backend จะ gen เองตอน submit อยู่แล้ว
            }
        })();

        return () => {
            canceled = true;
        };
    }, [stationId, job.date]);


    /* ---------- load station ---------- */
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sid = params.get("station_id") || localStorage.getItem("selected_station_id");
        if (sid) setStationId(sid);
        if (!sid) return;

        getStationInfoPublic(sid)
            .then((st) => {
                setJob((prev) => ({
                    ...prev,
                    // sn: st.SN ?? prev.sn,
                    // model: st.model ?? prev.model,
                    station_name: st.station_name ?? prev.station_name,
                    // date: prev.date || new Date().toISOString().slice(0, 10),
                    date: getTodayLocalStr(),
                }));
            })
            .catch((err) => console.error("load public station info failed:", err));
    }, []);

    /* ---------- draft id ---------- */
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        let d = params.get("draft_id");
        if (!d) {
            d = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : String(Date.now());
            params.set("draft_id", d);
            const url = `${window.location.pathname}?${params.toString()}`;
            window.history.replaceState({}, "", url);
        }
        setDraftId(d);
    }, []);

    /* ---------- load draft ---------- */
    useEffect(() => {
        if (!stationId || !draftId) return;
        const draft = loadDraftLocal<{
            // job: typeof job & { inspector?: string };
            rows: typeof rows;
            m9_0: typeof m9_0.state;
            m9_1: typeof m9_1.state;
            m9_2: typeof m9_2.state;
            m9_3: typeof m9_3.state;
            m9_4: typeof m9_4.state;
            m9_5: typeof m9_5.state;
            // photos: typeof photos;
            summary: string;
            photoRefs?: Record<string, PhotoRef[]>;
        }>(key);
        if (!draft) return;

        // const { issue_id, ...draftJobWithoutIssue } = draft.job;
        // const draftJob = draft?.job ?? {};           // ถ้าไม่มี job ให้เป็น object ว่าง
        // const { issue_id, ...draftJobWithoutIssue } = draftJob;

        // setJob((prev) => ({ ...prev, ...draft.job }));
        // setJob((prev) => ({ ...prev, ...draftJobWithoutIssue, date: getTodayLocalStr(), }));
        setRows(draft.rows);
        m9_0.setState(draft.m9_0 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        m9_1.setState(draft.m9_1 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        m9_2.setState(draft.m9_2 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        m9_3.setState(draft.m9_3 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        m9_4.setState(draft.m9_4 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        m9_5.setState(draft.m9_5 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        // setPhotos(draft.photos ?? initialPhotos);
        setSummary(draft.summary);

        // setInspector(draft.inspector ?? "");
        (async () => {
            if (!draft.photoRefs) return;

            const next: Record<string, PhotoItem[]> = { ...initialPhotos };

            for (const [photoKey, refs] of Object.entries(draft.photoRefs)) {
                const items: PhotoItem[] = [];

                for (const ref of refs || []) {
                    const file = await getPhoto(key, ref.id); // ✅ draftKey=key, photoId=ref.id
                    if (!file) continue;

                    items.push({
                        id: ref.id,
                        file,
                        preview: URL.createObjectURL(file),
                        remark: ref.remark ?? "",
                        ref,
                    });
                }
                next[photoKey] = items;
            }

            setPhotos(next);
        })();
    }, [stationId, key]);

    useEffect(() => {
        if (!stationId || !draftId) return;

        (async () => {
            // hydrate รูปจาก draftPhotos storage
            const next: Record<number, PhotoItem[]> = { ...photos };

            for (const no of Object.keys(next).map(Number)) {
                next[no] = await Promise.all((next[no] ?? []).map(async (p) => {
                    if (p.file && p.preview) return p;
                    const f = await getPhoto(key, p.id);        // ✅ ดึง file/blob กลับมา
                    return f
                        ? { ...p, file: f, preview: URL.createObjectURL(f) }
                        : p;
                }));
            }

            setPhotos(next);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stationId, draftId]);

    /* ---------- load pre data in post mode ---------- */
    useEffect(() => {
        if (!isPostMode || !editId || !stationId) return;

        (async () => {
            try {
                const report = await fetchReport(editId, stationId);
                if (!report) return;

                // Load measures_pre from database to populate post mode inputs
                const measuresPre = report.measures_pre || {};
                const r9Data = measuresPre.r9 || {};

                // Set the pre measure9 values for display comparison
                if (r9Data["0"]) setM9_0Pre(r9Data["0"]);
                if (r9Data["1"]) setM9_1Pre(r9Data["1"]);
                if (r9Data["2"]) setM9_2Pre(r9Data["2"]);
                if (r9Data["3"]) setM9_3Pre(r9Data["3"]);
                if (r9Data["4"]) setM9_4Pre(r9Data["4"]);
                if (r9Data["5"]) setM9_5Pre(r9Data["5"]);

                // Load rows (PASS/FAIL) from database if available
                if (report.rows) {
                    setRows(report.rows);
                }

                // Load summary if available
                if (report.summary) {
                    setSummary(report.summary);
                }

                // Load summaryCheck if available
                if (report.summaryCheck) {
                    setSummaryCheck(report.summaryCheck as PF);
                }
            } catch (err) {
                console.error("load report data error:", err);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPostMode, editId, stationId]);

    useEffect(() => {
        const onInfo = (e: Event) => {
            const detail = (e as CustomEvent).detail as { info?: StationPublic; station?: StationPublic };
            const st = detail.info ?? detail.station;
            if (!st) return;
            setJob((prev) => ({
                ...prev,
                // sn: st.SN ?? prev.sn,
                // model: st.model ?? prev.model,
            }));
        };
        window.addEventListener("station:info", onInfo as EventListener);
        return () => window.removeEventListener("station:info", onInfo as EventListener);
    }, []);


    // ---------- render helpers ----------
    // const makePhotoSetter = (
    //     no: string | number
    // ): React.Dispatch<React.SetStateAction<PhotoItem[]>> => {
    //     return (action: React.SetStateAction<PhotoItem[]>) => {
    //         setPhotos((prev) => {
    //             const current = prev[no] ?? [];
    //             const next =
    //                 typeof action === "function"
    //                     ? (action as (x: PhotoItem[]) => PhotoItem[])(current)
    //                     : action;
    //             return { ...prev, [no]: next };
    //         });
    //     };
    // };
    const makePhotoSetter = (
        key: string | number
    ): React.Dispatch<React.SetStateAction<PhotoItem[]>> => {
        return (action: React.SetStateAction<PhotoItem[]>) => {
            setPhotos((prev) => {
                const current = prev[key] ?? [];
                const next =
                    typeof action === "function"
                        ? (action as (x: PhotoItem[]) => PhotoItem[])(current)
                        : action;

                return { ...prev, [key]: next };
            });
        };
    };

    // const REQUIRED_PHOTO_KEYS_PRE = useMemo(
    //     () => {
    //         const keys: string[] = [];
    //         QUESTIONS.filter((q) => q.hasPhoto && q.no !== 10).forEach((q) => {
    //             if (q.kind === "group") {
    //                 // สำหรับ group ต้องมีรูปสำหรับ sub-items
    //                 q.items.forEach((item) => {
    //                     keys.push(item.key);
    //                 });
    //             } else {
    //                 // สำหรับ simple ใช้ q-prefix
    //                 keys.push(`q${q.no}`);
    //             }
    //         });
    //         return keys;
    //     },
    //     []
    // );
    // const REQUIRED_PHOTO_KEYS_PRE = useMemo(
    //     () => {
    //         const keys: string[] = [];
    //         QUESTIONS.filter((q) => q.hasPhoto && q.no !== 10).forEach((q) => {  // คงกรองไม่ให้ q.no === 10
    //             if (q.kind === "group") {
    //                 // สำหรับ group ต้องมีรูปสำหรับ sub-items
    //                 q.items.forEach((item) => {
    //                     keys.push(item.key);
    //                 });
    //             } else {
    //                 // สำหรับ simple ใช้ q-prefix
    //                 keys.push(`q${q.no}`);
    //             }
    //         });
    //         return keys;
    //     },
    //     []
    // );
    const REQUIRED_PHOTO_KEYS_PRE = useMemo(
        () => {
            const keys: string[] = [];
            QUESTIONS.filter((q) => q.hasPhoto && q.no !== 10).forEach((q) => {
                if (q.kind === "group") {
                    // สำหรับ group ต้องมีรูปสำหรับ sub-items
                    q.items.forEach((item) => {
                        keys.push(item.key);
                    });
                } else if (q.kind === "measure9") {
                    // ✅ เพิ่มส่วนนี้สำหรับข้อ 9
                    for (let i = 0; i <= 5; i++) {
                        keys.push(`r9_${i}`);
                    }
                } else {
                    // สำหรับ simple ใช้ q-prefix
                    keys.push(`q${q.no}`);
                }
            });
            return keys;
        },
        []
    );

    // const REQUIRED_PHOTO_KEYS_POST = useMemo(
    //     () => {
    //         const keys: string[] = [];
    //         QUESTIONS.filter((q) => q.hasPhoto).forEach((q) => {
    //             if (q.kind === "group") {
    //                 // สำหรับ group ต้องมีรูปสำหรับ sub-items
    //                 q.items.forEach((item) => {
    //                     keys.push(item.key);
    //                 });
    //             } else {
    //                 // สำหรับ simple ใช้ q-prefix
    //                 keys.push(`q${q.no}`);
    //             }
    //         });
    //         return keys;
    //     },
    //     []
    // );
    const REQUIRED_PHOTO_KEYS_POST = useMemo(
        () => {
            const keys: string[] = [];
            QUESTIONS.filter((q) => q.hasPhoto).forEach((q) => {
                if (q.kind === "group") {
                    // สำหรับ group ต้องมีรูปสำหรับ sub-items
                    q.items.forEach((item) => {
                        keys.push(item.key);
                    });
                } else if (q.kind === "measure9") {
                    // ✅ เพิ่มส่วนนี้สำหรับข้อ 9
                    for (let i = 0; i <= 5; i++) {
                        keys.push(`r9_${i}`);
                    }
                } else {
                    // สำหรับ simple ใช้ q-prefix
                    keys.push(`q${q.no}`);
                }
            });
            return keys;
        },
        []
    );

    // const missingPhotoItemsPre = useMemo(
    //     () =>
    //         REQUIRED_PHOTO_KEYS_PRE.filter(
    //             (key) => (photos[key]?.length ?? 0) < 1
    //         ),
    //     [REQUIRED_PHOTO_KEYS_PRE, photos]
    // );
    const missingPhotoItemsPre = useMemo(
        () =>
            REQUIRED_PHOTO_KEYS_PRE.filter(
                (key) => (photos[key]?.length ?? 0) < 1  // ถ้ายังไม่มีรูปภาพ (หรือจำนวนรูป = 0)
            ),
        [REQUIRED_PHOTO_KEYS_PRE, photos]
    );

    const missingPhotoItemsPost = useMemo(
        () =>
            REQUIRED_PHOTO_KEYS_POST.filter(
                (key) => (photos[key]?.length ?? 0) < 1
            ),
        [REQUIRED_PHOTO_KEYS_POST, photos]
    );

    const allPhotosAttachedPre = missingPhotoItemsPre.length === 0;
    const allPhotosAttachedPost = missingPhotoItemsPost.length === 0;
    const missingPhotoItems = isPostMode ? missingPhotoItemsPost : missingPhotoItemsPre;
    const allPhotosAttached = isPostMode ? allPhotosAttachedPost : allPhotosAttachedPre;

    // 🔹 PASS/FAIL: ก่อน After ยังไม่บังคับข้อ 19
    const PF_KEYS_PRE = useMemo(
        () =>
            QUESTIONS.filter((q) => q.no !== 10).map(
                (q) => q.key
            ),
        []
    );
    const PF_KEYS_ALL = useMemo(
        () => QUESTIONS.map((q) => q.key),
        []
    );

    const allPFAnsweredPre = useMemo(
        () => PF_KEYS_PRE.every((k) => rows[k]?.pf !== ""), // ✅ เพิ่ม optional chaining
        [rows, PF_KEYS_PRE]
    );

    const allPFAnsweredAll = useMemo(
        () => PF_KEYS_ALL.every((k) => rows[k]?.pf !== ""), // ✅ เพิ่ม optional chaining
        [rows, PF_KEYS_ALL]
    );

    const missingPFItemsPre = useMemo(
        () =>
            PF_KEYS_PRE.filter((k) => rows[k] && !rows[k].pf) // ✅ เพิ่มการตรวจสอบ
                .map((k) => Number(k.replace("r", "")))
                .sort((a, b) => a - b),
        [rows, PF_KEYS_PRE]
    );
    const missingPFItemsAll = useMemo(
        () =>
            PF_KEYS_ALL.filter((k) => rows[k] && !rows[k].pf) // ✅ เพิ่มการตรวจสอบ
                .map((k) => Number(k.replace("r", "")))
                .sort((a, b) => a - b),
        [rows, PF_KEYS_ALL]
    );
    const isSummaryFilled = summary.trim().length > 0;
    const isSummaryCheckFilled = summaryCheck !== "";
    const canFinalSave =
        allPhotosAttachedPost &&
        allPFAnsweredAll &&
        isSummaryFilled &&
        isSummaryCheckFilled;

    // const REQUIRED_PHOTO_ITEMS = useMemo(
    //     () =>
    //         QUESTIONS.filter((q) => q.hasPhoto).map((q) => q.no).sort((a, b) => a - b), []);
    // const missingPhotoItems = useMemo(() => REQUIRED_PHOTO_ITEMS.filter((no) => (photos[no]?.length ?? 0) < 1), [REQUIRED_PHOTO_ITEMS, photos]);
    // const allPhotosAttached = missingPhotoItems.length === 0;

    /* ---------- validation ---------- */
    // ต้องตอบ PASS/FAIL/N/A สำหรับ: หัวข้อเดี่ยว + หัวข้อย่อยทั้งหมด
    // const PF_REQUIRED_KEYS = useMemo(() => {
    //     const keys: string[] = [];
    //     QUESTIONS.forEach((q) => {
    //         if (q.kind === "group") keys.push(...q.items.map((i) => i.key));
    //         if (q.kind === "simple") keys.push(q.key);
    //         // ข้อ 9 (measure) ไม่มี PASS/FAIL ย่อย จึงไม่บังคับ
    //     });
    //     return keys;
    // }, []);

    const PF_REQUIRED_KEYS = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") {
                keys.push(q.key); // ✅ เพิ่ม simple
            }
            if (q.kind === "measure9") {
                keys.push(q.key);
            } else if (q.kind === "group") {
                q.items.forEach((item) => {
                    keys.push(item.key); // ✅ เพิ่ม group items
                });
            }

        });
        return keys;
    }, []);


    // const allPFAnswered = useMemo(() => PF_REQUIRED_KEYS.every((k) => rows[k]?.pf !== ""), [rows, PF_REQUIRED_KEYS]);

    // const missingPFItems = useMemo(
    //     () =>
    //         PF_REQUIRED_KEYS.filter((k) => !rows[k]?.pf)
    //             .map((k) => k.replace(/^r(\d+)_?(\d+)?$/, (_, a, b) => (b ? `${a}.${b}` : a)))
    //             .sort((a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0])),
    //     [rows, PF_REQUIRED_KEYS]
    // );

    const allPFAnswered = useMemo(() => {
        if (isPreMode) return true;
        return PF_REQUIRED_KEYS.every((k) => rows[k]?.pf !== "");
    }, [isPreMode, rows, PF_REQUIRED_KEYS]);

    const missingPFItems = useMemo(() => {
        if (isPreMode) return [];
        return PF_REQUIRED_KEYS
            .filter((k) => !rows[k]?.pf)
            .map((k) => k.replace(/^r(\d+)_?(\d+)?$/, (_, a, b) => (b ? `${a}.${b}` : a)))
            .sort((a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0]));
    }, [isPreMode, rows, PF_REQUIRED_KEYS]);

    // const isSummaryFilled = isPreMode ? true : summary.trim().length > 0;

    // // เช็คอินพุตของข้อ 9 ให้ครบทุกช่อง
    const missingInputs = useMemo(() => {
        const r: string[] = [];
        M9_LIST.forEach((m, idx) => {
            VOLTAGE_FIELDS_CCB.forEach((k) => {
                const v = m.state[k]?.value ?? "";
                if (!String(v).trim()) r.push(`9.${idx === 0 ? "Main" : idx} – ${LABELS[k]}`);
            });
        });
        return r;
    }, [m9_0.state, m9_1.state, m9_2.state, m9_3.state, m9_4.state, m9_5.state]);

    const allRequiredInputsFilled = missingInputs.length === 0;
    // const isSummaryFilled = summary.trim().length > 0;

    // const canFinalSave = allPhotosAttached && allPFAnswered && allRequiredInputsFilled && isSummaryFilled;



    // const canFinalSave = isPreMode
    //     ? (allPhotosAttached && allRequiredInputsFilled)                   // ✅ pre: รูป + ข้อ9
    //     : (allPhotosAttached && allPFAnswered && allRequiredInputsFilled && isSummaryFilled); // ✅ post: ครบทั้งหมด

    // useEffect(() => onComplete(allPFAnswered), [allPFAnswered, onComplete]);

    /* ---------- persistence (auto-save) ---------- */
    function useDebouncedEffect(effect: () => void, deps: any[], delay = 800) {
        useEffect(() => {
            const h = setTimeout(effect, delay);
            return () => clearTimeout(h);
        }, deps); // eslint-disable-line react-hooks/exhaustive-deps
    }
    const photoRefs = useMemo(() => {
        const out: Record<string, PhotoRef[]> = {};
        Object.entries(photos).forEach(([key, list]) => {
            out[key] = (list || []).map(p => p.ref).filter(Boolean) as PhotoRef[];
        });
        return out;
    }, [photos]);

    useDebouncedEffect(() => {
        if (!stationId || !draftId) return;
        saveDraftLocal(key, {
            // job: { ...job, issue_id: "", date: getTodayLocalStr() },
            rows,
            m9_0: m9_0.state,
            m9_1: m9_1.state,
            m9_2: m9_2.state,
            m9_3: m9_3.state,
            m9_4: m9_4.state,
            m9_5: m9_5.state,
            // photos,
            summary,
            // inspector,
            photoRefs,
        });
    }, [key, stationId, draftId, rows, m9_0.state, m9_1.state, m9_2.state, m9_3.state, m9_4.state, m9_5.state, summary, photoRefs]);


    /* ---------- actions (submit เหมือนเดิม) ---------- */
    async function uploadGroupPhotos(
        reportId: string,
        stationId: string,
        group: string,
        files: File[],
        side: TabId,
    ) {
        const form = new FormData();
        form.append("station_id", stationId);
        form.append("group", group);
        form.append("side", side);
        files.forEach((f) => form.append("files", f));
        const token = localStorage.getItem("access_token");

        const url =
            side === "pre"
                ? `${API_BASE}/${PM_PREFIX}/${reportId}/pre/photos`
                : `${API_BASE}/${PM_PREFIX}/${reportId}/post/photos`;

        const res = await fetch(url, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: form,
            credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
    }


    const onPreSave = async () => {
        if (!stationId) { alert("ยังไม่ทราบ station_id"); return; }
        if (submitting) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("access_token");
            const pm_date = job.date?.trim() || "";

            // helper แปลง string → number (หรือ null ถ้าเว้นว่าง/ไม่ใช่ตัวเลข)
            const toNum = (s: string) => {
                const n = Number(s);
                return Number.isFinite(n) ? n : null;
            };

            // ทำสำเนา state พร้อมแปลง value เป็น number
            const normalizeMeasure = (state: typeof m9_0.state) =>
                Object.fromEntries(
                    Object.entries(state).map(([k, v]) => [
                        k,
                        { value: toNum(v.value), unit: v.unit },
                    ])
                );

            // ✅ ส่งเป็น dict แทน โดยใช้ key เป็น "0".."5" (หรือจะใช้ชื่อ main/c1..c5 ก็ได้)
            const r9 = {
                "0": normalizeMeasure(m9_0.state), // เมนเบรกเกอร์
                "1": normalizeMeasure(m9_1.state),
                "2": normalizeMeasure(m9_2.state),
                "3": normalizeMeasure(m9_3.state),
                "4": normalizeMeasure(m9_4.state),
                "5": normalizeMeasure(m9_5.state),
            };

            const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
            const payload = {
                side: "pre",
                station_id: stationId,
                issue_id: issueIdFromJob,
                doc_name: docName,
                job: jobWithoutIssueId,
                // rows,
                measures_pre: { r9 },
                // summary,
                pm_date,
                // ...(summaryCheck ? { summaryCheck } : {}),
                inspector,
            };

            const res = await fetch(`${API_BASE}/${PM_PREFIX}/pre/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            // const { report_id } = await res.json();
            const { report_id, doc_name } = await res.json() as {
                report_id: string;
                doc_name?: string;
            };
            if (doc_name) {
                setDocName(doc_name);
            }
            const photoKeys = Object.keys(photos);
            for (const photoKey of photoKeys) {
                const list = photos[photoKey] || [];
                if (list.length === 0) continue;
                const files = list.map(p => p.file!).filter(Boolean) as File[];
                if (files.length === 0) continue;

                // ค้นหา question เพื่อให้ได้ question key (r1, r2, r7, etc)
                let groupKey: string | null = null;

                if (photoKey.startsWith("q")) {
                    // simple question: q1 -> find question no 1 -> get r1
                    const qNo = Number(photoKey.substring(1));
                    const q = QUESTIONS.find(q => q.no === qNo);
                    if (q) groupKey = q.key;
                } else if (photoKey.includes("_")) {
                    // group item: r7_1 or r7_2 -> find question no 7 -> get r7
                    const match = photoKey.match(/r(\d+)/);
                    if (match) {
                        const qNo = Number(match[1]);
                        const q = QUESTIONS.find(q => q.no === qNo);
                        if (q) groupKey = q.key;
                    }
                }

                if (!groupKey) continue;
                await uploadGroupPhotos(report_id, stationId, groupKey, files, "pre");
            }
            await Promise.all(
                Object.values(photos).flat().map(p => delPhoto(key, p.id))
            );

            clearDraftLocal(key);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&saved=1`);
        } catch (err: any) {
            alert(`บันทึกไม่สำเร็จ: ${err?.message ?? err}`);
        } finally {
            setSubmitting(false);
        }
    };

    const onFinalSave = async () => {
        if (!stationId) { alert("ยังไม่ทราบ station_id"); return; }
        if (submitting) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("access_token");
            // const pm_date = job.date?.trim() || "";

            // helper แปลง string → number (หรือ null ถ้าเว้นว่าง/ไม่ใช่ตัวเลข)
            const toNum = (s: string) => {
                const n = Number(s);
                return Number.isFinite(n) ? n : null;
            };

            // ทำสำเนา state พร้อมแปลง value เป็น number
            const normalizeMeasure = (state: typeof m9_0.state) =>
                Object.fromEntries(
                    Object.entries(state).map(([k, v]) => [
                        k,
                        { value: toNum(v.value), unit: v.unit },
                    ])
                );

            // ✅ ส่งเป็น dict แทน โดยใช้ key เป็น "0".."5" (หรือจะใช้ชื่อ main/c1..c5 ก็ได้)
            const r9 = {
                "0": normalizeMeasure(m9_0.state), // เมนเบรกเกอร์
                "1": normalizeMeasure(m9_1.state),
                "2": normalizeMeasure(m9_2.state),
                "3": normalizeMeasure(m9_3.state),
                "4": normalizeMeasure(m9_4.state),
                "5": normalizeMeasure(m9_5.state),
            };

            // const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
            const payload = {
                side: "post" as TabId,
                station_id: stationId,
                // issue_id: issueIdFromJob,
                // doc_name: docName,
                // job: jobWithoutIssueId,
                rows,
                measures: { r9 },
                summary,
                // pm_date,
                ...(summaryCheck ? { summaryCheck } : {}),
                // inspector,
                report_id: editId,
            };

            const res = await fetch(`${API_BASE}/${PM_PREFIX}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            // const { report_id } = await res.json();
            const { report_id, doc_name } = await res.json() as {
                report_id: string;
                doc_name?: string;
            };
            // if (doc_name) {
            //     setDocName(doc_name);
            // }
            // อัปโหลดรูปแยกกลุ่ม g1..g9
            // const photoNos = Object.keys(photos).map(Number);
            // for (const no of photoNos) {
            //     const list = photos[no] || [];
            //     if (list.length === 0) continue;
            //     const files = list.map((p) => p.file!).filter(Boolean) as File[];
            //     if (files.length === 0) continue;
            //     await uploadGroupPhotos(report_id, stationId, `g${no}`, files, "post");
            // }
            const photoKeys = Object.keys(photos);
            for (const photoKey of photoKeys) {
                const list = photos[photoKey] || [];
                if (list.length === 0) continue;
                const files = list.map((p) => p.file!).filter(Boolean) as File[];
                if (files.length === 0) continue;

                // ค้นหา question เพื่อให้ได้ question key (r1, r2, r7, etc)
                let groupKey: string | null = null;

                if (photoKey.startsWith("q")) {
                    // simple question: q1 -> find question no 1 -> get r1
                    const qNo = Number(photoKey.substring(1));
                    const q = QUESTIONS.find(q => q.no === qNo);
                    if (q) groupKey = q.key;
                } else if (photoKey.includes("_")) {
                    // group item: r7_1 or r7_2 -> find question no 7 -> get r7
                    const match = photoKey.match(/r(\d+)/);
                    if (match) {
                        const qNo = Number(match[1]);
                        const q = QUESTIONS.find(q => q.no === qNo);
                        if (q) groupKey = q.key;
                    }
                }

                if (!groupKey) continue;
                await uploadGroupPhotos(report_id, stationId, groupKey, files, "post");
            }

            const fin = await fetch(`${API_BASE}/${PM_PREFIX}/${report_id}/finalize`, {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                credentials: "include",
                body: new URLSearchParams({ station_id: stationId }),
            });
            if (!fin.ok) throw new Error(await fin.text());

            clearDraftLocal(key);
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&saved=1`);
        } catch (err: any) {
            alert(`บันทึกไม่สำเร็จ: ${err?.message ?? err}`);
        } finally {
            setSubmitting(false);
        }
    };

    // const renderMeasureGrid9 = (idx: number, title: string, m: ReturnType<typeof useMeasure<UnitVoltage>>) => {
    //     return (
    //         <div className="tw-space-y-2 tw-py-2 tw-border tw-rounded-lg tw-border-blue-gray-100 tw-px-3">
    //             <Typography className="tw-font-medium">{title}</Typography>
    //             <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-3">
    //                 {VOLTAGE_FIELDS_CCB.map((k) => (
    //                     <InputWithUnit<UnitVoltage>
    //                         key={`${idx}-${k}`}
    //                         label={LABELS[k]}
    //                         value={m.state[k]?.value || ""}
    //                         unit={(m.state[k]?.unit as UnitVoltage) || "V"}
    //                         units={["V"] as const}
    //                         onValueChange={(v) => m.patch(k, { value: v })}
    //                         onUnitChange={(u) => m.syncUnits(u)}
    //                     />
    //                 ))}
    //             </div>
    //         </div>
    //     );
    // };

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
        const pre = getPreMeasureState(no);

        if (!cfg || !m || !pre) return null;

        return (
            <div className="tw-space-y-3">
                {/* ---------- ชุด ก่อน PM ---------- */}
                <Typography
                    variant="small"
                    className="tw-font-medium tw-text-blue-gray-700"
                >
                    ก่อน PM
                </Typography>

                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.keys.map((k) => (
                        <div
                            key={`pre-${no}-${k}`}
                            className="tw-pointer-events-none tw-opacity-60"
                        >
                            <InputWithUnit<UnitVoltage>
                                label={LABELS[k] ?? k}          // มี label เหมือนหลัง PM
                                value={pre[k]?.value || ""}
                                unit={(pre[k]?.unit as UnitVoltage) || "V"}
                                units={UNITS.voltage}
                                onValueChange={() => { }}        // ห้ามแก้
                                onUnitChange={() => { }}
                                readOnly
                                required={false}                // ไม่มี *
                            />
                        </div>
                    ))}
                </div>

                {/* ---------- ชุด หลัง PM ---------- */}
                <Typography
                    variant="small"
                    className="tw-font-medium tw-text-blue-gray-700 tw-mt-2"
                >
                    หลัง PM
                </Typography>

                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.keys.map((k) => (
                        <InputWithUnit<UnitVoltage>
                            key={`post-${no}-${k}`}
                            label={LABELS[k] ?? k}
                            value={m.state[k]?.value || ""}
                            unit={(m.state[k]?.unit as UnitVoltage) || "V"}
                            units={UNITS.voltage}
                            onValueChange={(v) => m.patch(k, { value: v })}
                            onUnitChange={(u) => handleUnitChange(no, k, u)}
                        />
                    ))}
                </div>
            </div>
        );
    };

    const renderMeasureGrid9 = (idx: number, title: string, m: ReturnType<typeof useMeasure<UnitVoltage>>) => {
        return (
            <div className="tw-space-y-3 tw-py-4 tw-px-3 tw-border-b tw-border-blue-gray-100 tw-mb-4">
                <Typography className="tw-font-medium">{title}</Typography>

                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
                    {VOLTAGE_FIELDS_CCB.map((k) => (
                        <InputWithUnit<UnitVoltage>
                            key={`${idx}-${k}`}
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
        );
    };


    const renderQuestionBlock = (q: Question, mode: TabId) => {
        if (mode === "pre") {
            return (
                // <SectionCard key={q.key} title={q.label} subtitle={subtitle}>
                <SectionCard
                    key={q.key}
                    title={getQuestionLabel(q, mode)}
                // subtitle={subtitle}
                >
                    {q.kind === "simple" && q.hasPhoto && (
                        <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-4 tw-border-blue-gray-50">
                            <PhotoMultiInput
                                label={`แนบรูปประกอบ (ข้อ ${q.no})`}
                                photos={photos[`q${q.no}`] || []}
                                setPhotos={makePhotoSetter(`q${q.no}`)}
                                max={10}
                                draftKey={key}
                                qNo={q.no}
                            />
                        </div>
                    )}
                    {q.kind === "group" && q.hasPhoto && (
                        <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-4 tw-border-blue-gray-50">
                            {q.items.map((item) => (
                                <div key={item.key} className="tw-mb-4 tw-pb-4 last:tw-mb-0 last:tw-pb-0 last:tw-border-b-0 tw-border-b tw-border-blue-gray-50">
                                    <Typography variant="small" className="tw-font-medium tw-mb-2">
                                        {item.label}
                                    </Typography>
                                    <PhotoMultiInput
                                        label={`แนบรูปประกอบ (${item.label})`}
                                        photos={photos[item.key] || []}
                                        setPhotos={makePhotoSetter(item.key)}
                                        max={10}
                                        draftKey={key}
                                        qNo={q.no}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* {q.kind === "measure9" && q.hasPhoto && (
                        <div>
                            <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-4 tw-border-blue-gray-50">
                                <PhotoMultiInput
                                    label={`แนบรูปประกอบ (ข้อ ${q.no})`}
                                    photos={photos[`q${q.no}`] || []}
                                    setPhotos={makePhotoSetter(`q${q.no}`)}
                                    max={10}
                                    draftKey={key}
                                    qNo={q.no}
                                />
                            </div>
                            <div className="tw-space-y-3">
                                {renderMeasureGrid9(0, BREAKERS[0], m9_0)}
                                {renderMeasureGrid9(1, BREAKERS[1], m9_1)}
                                {renderMeasureGrid9(2, BREAKERS[2], m9_2)}
                                {renderMeasureGrid9(3, BREAKERS[3], m9_3)}
                                {renderMeasureGrid9(4, BREAKERS[4], m9_4)}
                                {renderMeasureGrid9(5, BREAKERS[5], m9_5)}
                            </div>
                        </div>

                    )} */}
                    {q.kind === "measure9" && q.hasPhoto && (
                        <div className="tw-space-y-3">
                            {/* เบรกเกอร์แต่ละตัว */}
                            {[
                                { idx: 0, title: BREAKERS[0], m: m9_0, key: 'r9_0' },
                                { idx: 1, title: BREAKERS[1], m: m9_1, key: 'r9_1' },
                                { idx: 2, title: BREAKERS[2], m: m9_2, key: 'r9_2' },
                                { idx: 3, title: BREAKERS[3], m: m9_3, key: 'r9_3' },
                                { idx: 4, title: BREAKERS[4], m: m9_4, key: 'r9_4' },
                                { idx: 5, title: BREAKERS[5], m: m9_5, key: 'r9_5' },
                            ].map(({ idx, title, m, key }) => (
                                <div key={key} className="tw-mb-4 tw-pb-4 last:tw-mb-0 last:tw-pb-0 last:tw-border-b-0 tw-border-b tw-border-blue-gray-50">
                                    <Typography className="tw-font-medium tw-mb-3">{title}</Typography>

                                    {/* แนบรูปของเบรกเกอร์นี้ */}
                                    <div className="tw-mb-4 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                                        <PhotoMultiInput
                                            label={`แนบรูปประกอบ (${title})`}
                                            photos={photos[key] || []}
                                            setPhotos={makePhotoSetter(key)}
                                            max={3}
                                            draftKey={key}
                                            qNo={q.no}
                                        />
                                    </div>

                                    {/* ฟอร์มวัดค่า */}
                                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
                                        {VOLTAGE_FIELDS_CCB.map((k) => (
                                            <InputWithUnit<UnitVoltage>
                                                key={`${idx}-${k}`}
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
                            ))}
                        </div>
                    )}




                </SectionCard>
            );
        }
        return (

            <SectionCard key={q.key} title={q.label}>
                {/* simple */}
                {q.kind === "simple" && (
                    <PassFailRow
                        label="ผลการทดสอบ"
                        value={rows[q.key]?.pf ?? ""}
                        onChange={(v) =>
                            setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })
                        }
                        remark={rows[q.key]?.remark ?? ""}
                        onRemarkChange={(v) =>
                            setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })
                        }
                        aboveRemark={
                            q.hasPhoto && (
                                <div className="tw-pb-4 tw-border-b tw-border-blue-gray-50">
                                    <PhotoMultiInput
                                        label={`แนบรูปประกอบ (ข้อ ${q.no})`}
                                        photos={photos[`q${q.no}`] || []}
                                        setPhotos={makePhotoSetter(`q${q.no}`)}
                                        max={3}
                                        draftKey={key}
                                        qNo={q.no}
                                    />
                                </div>
                            )
                        }
                    />
                )}

                {/* group */}
                {q.kind === "group" &&
                    q.items.map((it, idx) => (
                        <PassFailRow
                            key={it.key}
                            label={it.label}
                            value={rows[it.key]?.pf ?? ""}
                            onChange={(v) =>
                                setRows({
                                    ...rows,
                                    [it.key]: { ...(rows[it.key] ?? { remark: "" }), pf: v },
                                })
                            }
                            remark={rows[it.key]?.remark ?? ""}
                            onRemarkChange={(v) =>
                                setRows({
                                    ...rows,
                                    [it.key]: { ...(rows[it.key] ?? { pf: "" }), remark: v },
                                })
                            }
                            // แนบรูปสำหรับแต่ละ sub-item
                            aboveRemark={
                                q.hasPhoto && (
                                    <div className="tw-pb-4 tw-border-b tw-border-blue-gray-50">
                                        <PhotoMultiInput
                                            label={`แนบรูปประกอบ (${it.label})`}
                                            photos={photos[it.key] || []}
                                            setPhotos={makePhotoSetter(it.key)}
                                            max={3}
                                            draftKey={key}
                                            qNo={q.no}
                                        />
                                    </div>
                                )
                            }
                        />
                    ))}
                {q.kind === "measure9" && (
                    <div className="tw-space-y-3">
                        {[
                            { idx: 0, title: BREAKERS[0], m: m9_0, mPre: m9_0Pre, key: 'r9_0' },
                            { idx: 1, title: BREAKERS[1], m: m9_1, mPre: m9_1Pre, key: 'r9_1' },
                            { idx: 2, title: BREAKERS[2], m: m9_2, mPre: m9_2Pre, key: 'r9_2' },
                            { idx: 3, title: BREAKERS[3], m: m9_3, mPre: m9_3Pre, key: 'r9_3' },
                            { idx: 4, title: BREAKERS[4], m: m9_4, mPre: m9_4Pre, key: 'r9_4' },
                            { idx: 5, title: BREAKERS[5], m: m9_5, mPre: m9_5Pre, key: 'r9_5' },
                        ].map(({ idx, title, m, mPre, key }) => (
                            <div key={key} className="tw-mb-4 tw-pb-4 last:tw-mb-0 last:tw-pb-0 last:tw-border-b-0 tw-border-b tw-border-blue-gray-50">
                                <Typography className="tw-font-medium tw-mb-3">{title}</Typography>

                                {/* แนบรูปของเบรกเกอร์นี้ */}
                                {q.hasPhoto && (
                                    <div className="tw-mb-4 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                                        <PhotoMultiInput
                                            label={`แนบรูปประกอบ (${title})`}
                                            photos={photos[key] || []}
                                            setPhotos={makePhotoSetter(key)}
                                            max={3}
                                            draftKey={key}
                                            qNo={q.no}
                                        />
                                    </div>
                                )}

                                {/* PASS/FAIL + Remark สำหรับเบรกเกอร์นี้ */}
                                <div className="tw-mb-4">
                                    <PassFailRow
                                        label="ผลการทดสอบ"
                                        value={rows[key]?.pf ?? ""}
                                        onChange={(v) =>
                                            setRows({
                                                ...rows,
                                                [key]: { ...(rows[key] ?? { remark: "" }), pf: v },
                                            })
                                        }
                                        remark={rows[key]?.remark ?? ""}
                                        onRemarkChange={(v) =>
                                            setRows({
                                                ...rows,
                                                [key]: { ...(rows[key] ?? { pf: "" }), remark: v },
                                            })
                                        }
                                    />
                                </div>

                                {/* ฟอร์มวัดค่า - หลัง PM */}


                                {/* ก่อน PM - อ้างอิง (ล่าง) */}
                                <div>
                                    <Typography
                                        variant="small"
                                        className="tw-font-medium tw-text-blue-gray-700 tw-mb-2"
                                    >
                                        ก่อน PM (อ้างอิง)
                                    </Typography>
                                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4 tw-opacity-60 tw-pointer-events-none">
                                        {VOLTAGE_FIELDS_CCB.map((k) => (
                                            <InputWithUnit<UnitVoltage>
                                                key={`pre-${idx}-${k}`}
                                                label={LABELS[k]}
                                                value={mPre[k]?.value || ""}
                                                unit={(mPre[k]?.unit as UnitVoltage) || "V"}
                                                units={["V"] as const}
                                                onValueChange={() => { }}
                                                onUnitChange={() => { }}
                                                readOnly
                                                required={false}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="tw-mb-4">
                                    <Typography
                                        variant="small"
                                        className="tw-font-medium tw-text-blue-gray-700 tw-mb-2"
                                    >
                                        หลัง PM
                                    </Typography>
                                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-4">
                                        {VOLTAGE_FIELDS_CCB.map((k) => (
                                            <InputWithUnit<UnitVoltage>
                                                key={`post-${idx}-${k}`}
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
                        ))}
                    </div>
                )}

            </SectionCard>
        );
    };


    const active: TabId = useMemo(
        () => slugToTab(searchParams.get("pmtab")),
        [searchParams]
    );

    const canGoAfter = isPostMode ? true : (allPhotosAttachedPre && allRequiredInputsFilled);

    useEffect(() => {
        const tabParam = searchParams.get("pmtab");

        let desired: "pre" | "post";

        if (isPostMode) {
            // ถ้ามาแบบ action=post → บังคับให้เริ่มที่แท็บ after
            desired = "post";
        } else if (!tabParam) {
            // ปกติ (ไม่ใช่ post) → ค่าเริ่มต้นเป็น before
            desired = "pre";
        } else if (tabParam === "after" && !canGoAfter) {
            // พยายามเปิด after ตรง ๆ แต่ยังไม่ครบ → บังคับกลับเป็น before
            desired = "pre";
        } else {
            desired = tabParam === "post" ? "post" : "pre";
        }

        if (tabParam !== desired) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("pmtab", desired);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [searchParams, canGoAfter, pathname, router, isPostMode]);
    const go = (next: TabId) => {
        // ถ้าเป็น post-mode ห้ามย้อนกลับไป Pre-PM
        if (isPostMode && next === "pre") {
            return; // จะไม่ทำอะไรเลย (หรือจะ alert ก็ได้)
        }

        // 🔒 mode ปกติ: ถ้ายังไป post ไม่ได้
        if (next === "post" && !canGoAfter) {
            alert("กรุณากรอกข้อมูลในส่วน Pre ให้ครบก่อน");
            return;
        }

        const params = new URLSearchParams(searchParams.toString());
        params.set("pmtab", tabToSlug(next));
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };
    const displayTab: TabId = isPostMode
        ? "post" // ถ้าเป็นหน้า post ให้โชว์แท็บ post เสมอ
        : (active === "post" && !canGoAfter ? "pre" : active);

    const allPFAnsweredForUI =
        displayTab === "pre" ? allPFAnsweredPre : allPFAnsweredAll;
    const missingPFItemsForUI =
        displayTab === "pre" ? missingPFItemsPre : missingPFItemsAll;

    const allPhotosAttachedForUI =
        displayTab === "pre"
            ? allPhotosAttachedPre
            : allPhotosAttachedPost;
    const missingPhotoItemsForUI =
        displayTab === "pre"
            ? missingPhotoItemsPre
            : missingPhotoItemsPost;
    /* =========================
     *        RENDER
     * ========================= */
    return (
        <section className="tw-pb-24">
            <div className="tw-mx-auto tw-max-w-6xl tw-flex tw-items-center tw-justify-between tw-mb-4">
                {/* ซ้าย: ปุ่มย้อนกลับ (ลูกศร) */}

                <Button
                    variant="outlined"
                    size="sm"
                    onClick={() => router.back()}
                    // className="tw-py-2 tw-px-2"
                    title="กลับไปหน้า List"
                >
                    <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
                </Button>

                <Tabs value={displayTab}>
                    <TabsHeader className="tw-bg-blue-gray-50 tw-rounded-lg">
                        {TABS.map((t) => {
                            const isPreDisabled = isPostMode && t.id === "pre";
                            const isLockedAfter = t.id === "post" && !canGoAfter;

                            if (isPreDisabled) {
                                return (
                                    <div
                                        key={t.id}
                                        className="
                                                        tw-px-4 tw-py-2 tw-font-medium
                                                        tw-opacity-50 tw-cursor-not-allowed tw-select-none
                                                        "
                                    >
                                        {t.label}
                                    </div>
                                );
                            }

                            // ❌ ยังกรอกไม่ครบ → แสดงเป็น div ธรรมดา (ไม่ใช่ Tab)
                            if (isLockedAfter) {
                                return (
                                    <div
                                        key={t.id}
                                        className="
                                                        tw-px-4 tw-py-2 tw-font-medium
                                                        tw-opacity-50 tw-cursor-not-allowed tw-select-none
                                                        "
                                        onClick={() => {
                                            alert(
                                                "กรุณากรอกข้อมูลในส่วน Pre ให้ครบ (ค่าที่วัด และรูปภาพทุกข้อ) ก่อน"
                                            );
                                        }}
                                    >
                                        {t.label}
                                    </div>
                                );
                            }

                            // ✅ กรอกครบแล้ว → ใช้ Tab ปกติ
                            return (
                                <Tab
                                    key={t.id}
                                    value={t.id}
                                    onClick={() => go(t.id)}
                                    className="tw-px-4 tw-py-2 tw-font-medium"
                                >
                                    {t.label}
                                </Tab>
                            );
                        })}
                    </TabsHeader>
                </Tabs>
            </div>
            <form action="#"
                noValidate
                onSubmit={(e) => {
                    e.preventDefault();
                    return false;
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                }}
            >
                <div className="tw-mx-auto tw-max-w-6xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-sm tw-p-6 md:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0">
                    <div className="tw-flex tw-items-start tw-justify-between tw-gap-6">
                        <div className="tw-flex tw-items-start tw-gap-4">
                            <div className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md
                                                            tw-h-16 tw-w-[76px]
                                                            md:tw-h-20 md:tw-w-[108px]
                                                            lg:tw-h-24 lg:tw-w-[152px]">
                                <Image
                                    src={LOGO_SRC}
                                    alt="Company logo"
                                    fill
                                    priority
                                    className="tw-object-contain tw-p-0"
                                    sizes="(min-width:1024px) 152px, (min-width:768px) 108px, 76px"
                                />
                            </div>
                            <div>
                                <div className="tw-font-semibold tw-text-blue-gray-900">
                                    {/* รายงานการบำรุงรักษา - เครื่องอัดประจุไฟฟ้า – {headerLabel} */}
                                    Preventive Maintanance Checklist - Communication Conttrol Box (CCB)
                                </div>
                                <div className="tw-text-sm tw-text-blue-gray-600">
                                    Electricity Generating Authority of Thailand (EGAT) <br />
                                    53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand <br />
                                    Call Center Tel. 02-114-3350
                                </div>
                            </div>
                        </div>
                        {/* ขวาสุด: ชื่อเอกสาร / เลขที่เอกสาร */}
                        <div className="tw-text-right tw-text-sm tw-text-blue-gray-700">
                            <div className="tw-font-semibold">
                                Document Name.
                            </div>
                            <div>
                                {docName || "-"}
                            </div>

                        </div>
                    </div>
                    {/* BODY */}
                    <div className="tw-mt-8 tw-space-y-8">
                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            <div className="lg:tw-col-span-1">
                                <Input
                                    label="Issue id / รหัสเอกสาร"
                                    value={job.issue_id || "-"}
                                    readOnly
                                    crossOrigin=""
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-w-full !tw-bg-blue-gray-50"
                                />
                            </div>

                            <div className="sm:tw-col-span-2 lg:tw-col-span-2">
                                <Input
                                    label="Location / สถานที่"
                                    value={job.station_name}
                                    onChange={(e) => setJob({ ...job, station_name: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-bg-blue-gray-50"
                                />
                            </div>
                            <div className="sm:tw-col-span-2 lg:tw-col-span-2">
                                <Input
                                    label="Inspector / ผู้ตรวจสอบ"
                                    value={inspector}
                                    onChange={(e) => setInspector(e.target.value)}
                                    crossOrigin=""
                                    readOnly
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-bg-blue-gray-50"
                                />
                            </div>

                            <div className="lg:tw-col-span-1">
                                <Input
                                    label="PM Date / วันที่ตรวจ"
                                    type="text"
                                    value={job.date}
                                    // max={todayStr}
                                    // onChange={(e) => setJob({ ...job, date: e.target.value })}
                                    crossOrigin=""
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-bg-blue-gray-50"
                                    readOnly
                                />
                            </div>
                        </div>
                    </div>
                    {[
                        [1, 10]
                    ].map(([start, end]) => (
                        <CardBody key={`${start}-${end}`} className="tw-space-y-2">
                            {QUESTIONS
                                .filter((q) => q.no >= start && q.no <= end)
                                .filter((q) => !(displayTab === "pre" && q.no === 10))
                                .map((q) => renderQuestionBlock(q, displayTab))}
                        </CardBody>
                    ))}


                    <CardBody className="tw-space-y-3 !tw-pt-4 !tw-pb-0">
                        <Typography variant="h6" className="tw-mb-1">
                            Comment
                        </Typography>

                        <div className="tw-space-y-2">
                            <Textarea
                                label="Comment"
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                rows={4}
                                required={isPostMode}
                                autoComplete="off"
                                containerProps={{ className: "!tw-min-w-0" }}
                                className="!tw-w-full resize-none"
                            />
                        </div>
                        {displayTab === "post" && (
                            <div className="tw-pt-4 tw-border-t tw-border-blue-gray-100">
                                <PassFailRow
                                    label="สรุปผลการตรวจสอบ"
                                    value={summaryCheck}
                                    onChange={(v) => setSummaryCheck(v)}
                                    labels={{
                                        PASS: "Pass : ผ่าน",
                                        FAIL: "Fail : ไม่ผ่าน",
                                        NA: "N/A : ไม่พบ",
                                    }}
                                />
                            </div>
                        )}
                    </CardBody>
                    {/* Footer checks */}
                    <CardFooter className="tw-flex tw-flex-col tw-gap-3 tw-mt-8">


                        <div className={`tw-rounded-lg tw-border tw-p-3 ${allPhotosAttached ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
                            <Typography className="tw-font-medium">1) ตรวจสอบการแนบรูปภาพ (ทุกหัวข้อ)</Typography>
                            {allPhotosAttached ? (
                                <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                            ) : (
                                <Typography variant="small" className="!tw-text-amber-700">ยังไม่ได้แนบรูปข้อ: {missingPhotoItems.join(", ")}</Typography>
                            )}
                        </div>

                        <div className={`tw-rounded-lg tw-border tw-p-3 ${allRequiredInputsFilled ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
                            <Typography className="tw-font-medium">2) อินพุตข้อ 9 (ค่าที่วัด)</Typography>
                            {allRequiredInputsFilled ? (
                                <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                            ) : (
                                <div className="tw-space-y-1">
                                    <Typography variant="small" className="!tw-text-amber-700">ยังขาด:</Typography>
                                    <ul className="tw-list-disc tw-ml-5 tw-text-sm tw-text-blue-gray-700">
                                        {missingInputs.map((line, i) => (<li key={i}>{line}</li>))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {isPostMode && (
                            <div className={`tw-rounded-lg tw-border tw-p-3 ${allPFAnswered ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
                                <Typography className="tw-font-medium">3) สถานะ PASS / FAIL / N/A (หัวข้อย่อยทุกข้อ)</Typography>
                                {allPFAnswered ? (
                                    <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                                ) : (
                                    <Typography variant="small" className="!tw-text-amber-700">ยังไม่ได้เลือกข้อ: {missingPFItems.join(", ")}</Typography>
                                )}
                            </div>
                        )}

                        {isPostMode && (
                            <div className={`tw-rounded-lg tw-border tw-p-3 ${isSummaryFilled ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
                                <Typography className="tw-font-medium">4) สรุปผลการตรวจสอบ</Typography>
                                {isSummaryFilled ? (
                                    <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                                ) : (
                                    <Typography variant="small" className="!tw-text-amber-700">ยังไม่ได้กรอกสรุปผลการตรวจสอบ</Typography>
                                )}
                            </div>
                        )}

                        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-3">
                            {displayTab === "pre" ? (
                                // อยู่แท็บ BEFORE → บันทึกลง Mongo + img_before แล้วค่อยไป AFTER
                                <Button
                                    color="blue"
                                    type="button"
                                    onClick={onPreSave}
                                    disabled={!canGoAfter || submitting}
                                    title={
                                        // !canGoAfter
                                        //     ? "กรุณาแนบรูปในส่วน Pre ให้ครบก่อนบันทึก"
                                        //     : undefined
                                        !allPhotosAttachedPre
                                            ? "กรุณาแนบรูปในส่วน Pre ให้ครบก่อนบันทึก"
                                            : !allRequiredInputsFilled
                                                ? "กรุณากรอกค่าข้อ 14 (CP) และข้อ 16 ให้ครบก่อนบันทึก"
                                                : undefined
                                    }
                                >
                                    {submitting ? "กำลังบันทึก..." : "บันทึก"}
                                </Button>
                            ) : (
                                // อยู่แท็บ AFTER → บันทึกสุดท้าย + finalize
                                <Button
                                    color="blue"
                                    type="button"
                                    onClick={onFinalSave}
                                    disabled={!canFinalSave || submitting}
                                    title={
                                        !canFinalSave
                                            ? "กรุณากรอกข้อมูล / แนบรูป และสรุปผลให้ครบก่อนบันทึก"
                                            : undefined
                                    }
                                >
                                    {submitting ? "กำลังบันทึก..." : "บันทึก"}
                                </Button>
                            )}
                        </div>
                    </CardFooter>
                </div>
            </form>
        </section>
    );
}
