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
import { draftKey, saveDraftLocal, loadDraftLocal, clearDraftLocal } from "../lib/draft";
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
    const res = await fetch(url, { cache: "no-store" }); // ✅ กัน cache
    if (res.status === 404) throw new Error("Station not found");

    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const json = await res.json();
    return json.station ?? json;
}

/* =========================
 *        CONSTANTS
 * ========================= */
const UNITS = {
    voltage: ["V"] as const,
};
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

type Question =
    | { no: number; key: `r${number}`; label: string; labelPre?: string; labelPost?: string; kind: "simple"; hasPhoto?: boolean }
    | { no: number; key: `r${number}`; label: string; labelPre?: string; labelPost?: string; kind: "measure"; hasPhoto?: boolean }
    | { no: number; key: `r${number}`; label: string; labelPre?: string; labelPost?: string; kind: "group"; items: { key: string; label: string }[]; hasPhoto?: boolean };

const VOLTAGE_FIELDS = [
    "L1-N",
    "L2-N",
    "L3-N",
    "L1-G",
    "L2-G",
    "L3-G",
    "L1-L2",
    "L2-L3",
    "L3-L1",
    "N-G",
] as const;

const VOLTAGE_FIELDS_CCB = [
    "L1-N",
    "L1-G",
    "N-G",
] as const;

const LABELS: Record<string, string> = {
    "L1-L2": "L1-L2",
    "L2-L3": "L2-L3",
    "L3-L1": "L3-L1",
    "L1-N": "L1-N",
    "L2-N": "L2-N",
    "L3-N": "L3-N",
    "L1-G": "L1-G",
    "L2-G": "L2-G",
    "L3-G": "L3-G",
    "N-G": "N-G",
    CP: "CP",
};

/** ทุกข้อมีการแนบรูป, ข้อ 17 เป็นหัวข้อวัดค่า */
const QUESTIONS_RAW: Question[] = [
    { no: 1, key: "r1", label: "1) ตรวจสอบสภาพทั่วไป", kind: "simple", hasPhoto: true },
    { no: 2, key: "r2", label: "2) ตรวจสอบดักซีล, ซิลิโคนกันซึม", kind: "simple", hasPhoto: true },
    { no: 3, key: "r3", label: "3) ตรวจสอบ Power Meter", kind: "simple", hasPhoto: true },
    { no: 4, key: "r4", label: "4) ตรวจสอบแรงดันไฟฟ้า Breaker Main", kind: "measure", hasPhoto: true },
    { no: 5, key: "r5", label: "5) ตรวจสอบแรงดันไฟฟ้า Breaker Charger  ตัวที่ 1", kind: "measure", hasPhoto: true },
    { no: 6, key: "r6", label: "6) ตรวจสอบแรงดันไฟฟ้า Breaker Charger  ตัวที่ 2", kind: "measure", hasPhoto: true },
    { no: 7, key: "r7", label: "7) ตรวจสอบแรงดันไฟฟ้า Breaker Charger  ตัวที่ 3", kind: "measure", hasPhoto: true },
    { no: 8, key: "r8", label: "8) ตรวจสอบแรงดันไฟฟ้า Breaker CCB ", kind: "measure", hasPhoto: true },
    {
        no: 9,
        key: "r9",
        label: "9) ทดสอบปุ่ม Trip Test",
        kind: "group",
        hasPhoto: true,
        items: [
            { key: "r9_1", label: "RCD" },
            { key: "r9_2", label: "Breaker CCB" },
            { key: "r9_3", label: "Brekaer Charger" },
            { key: "r9_4", label: "Breaker Main" },
        ],
    },
    { no: 10, key: "r10", label: "10) ตรวจสอบจุดต่อทางไฟฟ้า", kind: "simple", hasPhoto: true },
    { no: 11, key: "r11", label: "11) ทำความสะอาดตู้ MDB", kind: "simple", hasPhoto: true },
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
    (q) => q.kind === "simple" || q.kind === "group" || q.kind === "measure"
) as Question[];

const FIELD_GROUPS: Record<number, { keys: readonly string[]; unitType: "voltage"; note?: string } | undefined> = {
    4: { keys: VOLTAGE_FIELDS, unitType: "voltage" },
    5: { keys: VOLTAGE_FIELDS, unitType: "voltage" },
    6: { keys: VOLTAGE_FIELDS, unitType: "voltage" },
    7: { keys: VOLTAGE_FIELDS, unitType: "voltage" },
    8: { keys: VOLTAGE_FIELDS_CCB, unitType: "voltage" },

} as const;


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

function PassFailRow({
    label,
    value,
    onChange,
    remark,
    onRemarkChange,
    labels,
    aboveRemark,
    belowRemark,
    inlineLeft,
}: {
    label: string;
    value: PF;
    onChange: (v: Exclude<PF, "">) => void;
    remark?: string;
    onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
    aboveRemark?: React.ReactNode;
    belowRemark?: React.ReactNode;
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

                    {/* Input อื่น ๆ อยู่ล่างหมายเหตุ */}
                    {belowRemark}
                </div>
            ) : (
                <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">
                    {buttonsRow}
                </div>
            )}
        </div>
    );
}

/* =========================
 *       UI ATOMS
 * ========================= */
function SectionCard({
    title,
    subtitle,
    children,
}: {
    title?: string;
    subtitle?: string;
    children: React.ReactNode;
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

// check
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

function PhotoMultiInput({
    label,
    photos,
    setPhotos,
    max = 10,
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

const PM_TYPE_CODE = "MB";


async function fetchPreviewIssueId(
    stationId: string,
    pmDate: string
): Promise<string | null> {
    const u = new URL(`${API_BASE}/mdbpmreport/preview-issueid`);
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
    const u = new URL(`${API_BASE}/mdbpmreport/preview-docname`);
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

    const url = `${API_BASE}/mdbpmreport/get?station_id=${stationId}&report_id=${reportId}`;

    const res = await fetch(url, {
        // const res = await apiFetch(url, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
    });

    if (!res.ok) throw new Error(await res.text());
    return await res.json();
}

/* =========================
 *        MAIN
 * ========================= */
// export default function CheckList({ onComplete }: CheckListProps) {
export default function MDBPMMForm() {
    const [me, setMe] = useState<Me | null>(null);
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [docName, setDocName] = useState<string>("");

    const pathname = usePathname();
    const searchParams = useSearchParams();
    const editId = searchParams.get("edit_id") ?? "";

    const action = searchParams.get("action");
    const isPostMode = action === "post";
    const isPreMode = !isPostMode;
    const PM_PREFIX = "mdbpmreport";

    /* ---------- photos per question ---------- */
    // const initialPhotos: Record<number, PhotoItem[]> = Object.fromEntries(
    //     QUESTIONS.filter((q) => q.hasPhoto).map((q) => [q.no, [] as PhotoItem[]])
    // ) as Record<number, PhotoItem[]>;
    const initialPhotos: Record<string | number, PhotoItem[]> = Object.fromEntries(
        QUESTIONS.filter((q) => q.hasPhoto).flatMap((q) => {
            const entries: [string | number, PhotoItem[]][] = [];

            if (q.kind === "simple") {
                entries.push([q.no, []]);
            } else if (q.kind === "group") {
                q.items.forEach((item) => {
                    entries.push([item.key, []]);
                });
            } else if (q.kind === "measure") {
                // Measure questions get their own photo entry
                entries.push([q.no, []]);
            }

            return entries;
        })
    ) as Record<string | number, PhotoItem[]>;
    const [photos, setPhotos] = useState<Record<string | number, PhotoItem[]>>(initialPhotos);

    // ค่า CP ของข้อ 15 (ช่องเดียว หน่วย V)
    // const [cp, setCp] = useState<{ value: string; unit: UnitVoltage }>({ value: "", unit: "V" });
    const [summary, setSummary] = useState<string>("");

    const [stationId, setStationId] = useState<string | null>(null);
    const [draftId, setDraftId] = useState<string | null>(null);
    const key = useMemo(() => draftKey(stationId), [stationId]);
    // const key = useMemo(
    //     () => `${draftKey(stationId)}:${draftId ?? "default"}`,
    //     [stationId, draftId]
    // );
    // const [สรุปผล, setสรุปผล] = useState<PF>("");
    const [summaryCheck, setSummaryCheck] = useState<PF>("");
    const [inspector, setInspector] = useState<string>("");
    const [dustFilterChanged, setDustFilterChanged] = useState<boolean>(false);

    /* ---------- job info ---------- */
    const [job, setJob] = useState({
        issue_id: "",
        // chargerNo: "",
        // sn: "",
        // model: "",
        station_name: "",
        date: "",
        // inspector: "",
    });

    const todayStr = useMemo(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;       // YYYY-MM-DD (ตามเวลาท้องถิ่น browser)
    }, []);

    /* ---------- PASS/FAIL + remark ---------- */
    // const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(() => {
    //     const initial: Record<string, { pf: PF; remark: string }> = {};
    //     QUESTIONS.forEach((q) => {
    //         initial[q.key] = { pf: "", remark: "" };
    //     });
    //     return initial;
    // });

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

    const [m4Pre, setM4Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS, "V"));
    const [m5Pre, setM5Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS, "V"));
    const [m6Pre, setM6Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS, "V"));
    const [m7Pre, setM7Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS, "V"));
    const [m8Pre, setM8Pre] = useState<MeasureState<UnitVoltage>>(() => initMeasureState(VOLTAGE_FIELDS_CCB, "V"));

    function getPreMeasureState(no: number): MeasureState<UnitVoltage> | null {
        switch (no) {
            case 4: return m4Pre;
            case 5: return m5Pre;
            case 6: return m6Pre;
            case 7: return m7Pre;
            case 8: return m8Pre;
            default: return null;
        }
    }

    /* ---------- measure group (เฉพาะข้อ 17) ---------- */
    const m4 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS, "V");
    const m5 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS, "V");
    const m6 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS, "V");
    const m7 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS, "V");
    const m8 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS_CCB, "V");

    useEffect(() => {
        if (!isPostMode) return;
        if (!editId) return;
        if (!stationId) return;

        (async () => {
            try {
                const data = await fetchReport(editId, stationId);

                // 1) job
                if (data.job) {
                    setJob(prev => ({
                        ...prev,
                        ...data.job,
                        issue_id: data.issue_id ?? prev.issue_id,
                    }));
                }

                if (data.pm_date) {
                    setJob(prev => ({
                        ...prev,
                        date: data.pm_date  // 👈 ใส่ตรงนี้เลย
                    }));
                }

                const m4FromPre = data?.measures_pre?.m4;
                if (m4FromPre) {
                    setM4Pre((prev) => {
                        const next = { ...prev };
                        VOLTAGE_FIELDS.forEach((k) => {
                            const row = m4FromPre[k] ?? {};
                            next[k] = {
                                value: row.value ?? "",
                                unit: (row.unit as UnitVoltage) ?? "V",
                            };
                        });
                        return next;
                    });
                }

                const m5FromPre = data?.measures_pre?.m5;
                if (m5FromPre) {
                    setM5Pre((prev) => {
                        const next = { ...prev };
                        VOLTAGE_FIELDS.forEach((k) => {
                            const row = m5FromPre[k] ?? {};
                            next[k] = {
                                value: row.value ?? "",
                                unit: (row.unit as UnitVoltage) ?? "V",
                            };
                        });
                        return next;
                    });
                }

                const m6FromPre = data?.measures_pre?.m6;
                if (m6FromPre) {
                    setM6Pre((prev) => {
                        const next = { ...prev };
                        VOLTAGE_FIELDS.forEach((k) => {
                            const row = m6FromPre[k] ?? {};
                            next[k] = {
                                value: row.value ?? "",
                                unit: (row.unit as UnitVoltage) ?? "V",
                            };
                        });
                        return next;
                    });
                }

                const m7FromPre = data?.measures_pre?.m7;
                if (m7FromPre) {
                    setM7Pre((prev) => {
                        const next = { ...prev };
                        VOLTAGE_FIELDS.forEach((k) => {
                            const row = m7FromPre[k] ?? {};
                            next[k] = {
                                value: row.value ?? "",
                                unit: (row.unit as UnitVoltage) ?? "V",
                            };
                        });
                        return next;
                    });
                }

                const m8FromPre = data?.measures_pre?.m8;
                if (m8FromPre) {
                    setM8Pre((prev) => {
                        const next = { ...prev };
                        VOLTAGE_FIELDS.forEach((k) => {
                            const row = m8FromPre[k] ?? {};
                            next[k] = {
                                value: row.value ?? "",
                                unit: (row.unit as UnitVoltage) ?? "V",
                            };
                        });
                        return next;
                    });
                }

                // 4) doc_name
                if (data.doc_name) setDocName(data.doc_name);

                // 5) inspector
                if (data.inspector) setInspector(data.inspector);

            } catch (err) {
                console.error("load report failed:", err);
            }
        })();
    }, [isPostMode, editId, stationId]);

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
        if (isPostMode) return;
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

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sid = params.get("station_id") || localStorage.getItem("selected_station_id");
        if (sid) setStationId(sid);
        if (!sid) return;
        if (isPostMode) return;

        getStationInfoPublic(sid)
            .then((st) => {
                setJob((prev) => ({
                    ...prev,
                    // sn: st.SN ?? prev.sn,
                    // model: st.model ?? prev.model,
                    station_name: st.station_name ?? prev.station_name,
                    date: prev.date || new Date().toISOString().slice(0, 10),
                }));
            })
            .catch((err) => console.error("load public station info failed:", err));
    }, []);

    // ครั้งแรก: อ่าน draft_id จาก URL หรือสร้างใหม่แล้วเขียนกลับไปที่ URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        let d = params.get("draft_id");
        if (!d) {
            d = (typeof crypto !== "undefined" && "randomUUID" in crypto)
                ? crypto.randomUUID()
                : String(Date.now());
            params.set("draft_id", d);
            const url = `${window.location.pathname}?${params.toString()}`;
            window.history.replaceState({}, "", url);
        }
        setDraftId(d);
    }, []);

    useEffect(() => {
        if (!stationId || !draftId) return;
        const draft = loadDraftLocal<{
            // job: typeof job;
            rows: typeof rows;
            m4: typeof m4.state;
            m5: typeof m5.state;
            m6: typeof m6.state;
            m7: typeof m7.state;
            m8: typeof m8.state;
            summary: string;
            dustFilterChanged?: boolean;
            photoRefs?: Record<string | number, PhotoRef[]>;
        }>(key);
        if (!draft) return;


        setRows(draft.rows);
        m4.setState(draft.m4 ?? initMeasureState(VOLTAGE_FIELDS, "V"));
        m5.setState(draft.m5 ?? initMeasureState(VOLTAGE_FIELDS, "V"));
        m6.setState(draft.m6 ?? initMeasureState(VOLTAGE_FIELDS, "V"));
        m7.setState(draft.m7 ?? initMeasureState(VOLTAGE_FIELDS, "V"));
        m8.setState(draft.m8 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        setDustFilterChanged(draft.dustFilterChanged ?? false);
        (async () => {
            if (!draft.photoRefs) return;

            const next: Record<string | number, PhotoItem[]> = Object.fromEntries(
                QUESTIONS.filter((q) => q.hasPhoto).flatMap((q) => {
                    const entries: [string | number, PhotoItem[]][] = [];
                    if (q.kind === "simple") {
                        entries.push([q.no, []]);
                    } else if (q.kind === "group") {
                        q.items.forEach((item) => {
                            entries.push([item.key, []]);
                        });
                    } else if (q.kind === "measure") {
                        entries.push([q.no, []]);
                    }
                    return entries;
                })
            ) as Record<string | number, PhotoItem[]>;

            for (const [keyStr, refs] of Object.entries(draft.photoRefs)) {
                // keyStr could be a number (like "4") or a string (like "r9_1")
                const photoKey = isNaN(Number(keyStr)) ? keyStr : Number(keyStr);
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
    }, [stationId, key]); // โหลดครั้งเดียวเมื่อรู้ stationId

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

    // const makePhotoSetter =
    //     (no: number): React.Dispatch<React.SetStateAction<PhotoItem[]>> =>
    //         (action) => {
    //             setPhotos((prev) => {
    //                 const current = prev[no] || [];
    //                 const next = typeof action === "function" ? (action as (x: PhotoItem[]) => PhotoItem[])(current) : action;
    //                 return { ...prev, [no]: next };
    //             });
    //         };

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


    const REQUIRED_PHOTO_KEYS_PRE = useMemo(
        () => {
            const keys: (string | number)[] = [];
            QUESTIONS.filter((q) => q.hasPhoto && q.no !== 11).forEach((q) => {
                if (q.kind === "group") {
                    // สำหรับ group ต้องมีรูปสำหรับ sub-items
                    q.items.forEach((item) => {
                        keys.push(item.key);
                    });
                } else {
                    // สำหรับ simple/measure ใช้หมายเลขข้อ
                    keys.push(q.no);
                }
            });
            return keys;
        },
        []
    );

    const REQUIRED_PHOTO_KEYS_POST = useMemo(
        () => {
            const keys: (string | number)[] = [];
            QUESTIONS.filter((q) => q.hasPhoto).forEach((q) => {
                if (q.kind === "group") {
                    // สำหรับ group ต้องมีรูปสำหรับ sub-items
                    q.items.forEach((item) => {
                        keys.push(item.key);
                    });
                } else {
                    // สำหรับ simple/measure ใช้หมายเลขข้อ
                    keys.push(q.no);
                }
            });
            return keys;
        },
        []
    );

    const REQUIRED_PHOTO_ITEMS_PRE = useMemo(
        () =>
            QUESTIONS.filter((q) => q.hasPhoto && q.no !== 11)
                .map((q) => q.no)
                .sort((a, b) => a - b),
        []
    );

    const REQUIRED_PHOTO_ITEMS_POST = useMemo(
        () =>
            QUESTIONS.filter((q) => q.hasPhoto)
                .map((q) => q.no)
                .sort((a, b) => a - b),
        []
    );

    const missingPhotoItemsPre = useMemo(
        () => {
            const missing: number[] = [];
            REQUIRED_PHOTO_ITEMS_PRE.forEach((no) => {
                const q = QUESTIONS.find(q => q.no === no);
                if (!q) return;

                if (q.kind === "group") {
                    // ตรวจสอบ sub-items
                    const allHavePhotos = q.items.every(
                        (item) => (photos[item.key]?.length ?? 0) > 0
                    );
                    if (!allHavePhotos) {
                        missing.push(no);
                    }
                } else {
                    // ตรวจสอบ simple/measure ด้วยเลขข้อ (numeric key)
                    if ((photos[no]?.length ?? 0) < 1) {
                        missing.push(no);
                    }
                }
            });
            return missing;
        },
        [REQUIRED_PHOTO_ITEMS_PRE, photos]
    );

    const missingPhotoItemsPost = useMemo(
        () => {
            const missing: (string | number)[] = [];
            REQUIRED_PHOTO_KEYS_POST.forEach((keyStr) => {
                if ((photos[keyStr]?.length ?? 0) < 1) {
                    missing.push(keyStr);
                }
            });
            return missing;
        },
        [REQUIRED_PHOTO_KEYS_POST, photos]
    );


    const allPhotosAttachedPre = missingPhotoItemsPre.length === 0;
    const allPhotosAttachedPost = missingPhotoItemsPost.length === 0;

    const missingPhotoItems = isPostMode ? missingPhotoItemsPost : missingPhotoItemsPre;
    const allPhotosAttached = isPostMode ? allPhotosAttachedPost : allPhotosAttachedPre;

    // 🔹 PASS/FAIL: ก่อน After ยังไม่บังคับข้อ 19
    const PF_KEYS_PRE = useMemo(
        () =>
            QUESTIONS.filter((q) => q.no !== 11).map(
                (q) => q.key
            ),
        []
    );

    const PF_KEYS_ALL = useMemo(
        () => QUESTIONS.map((q) => q.key),
        []
    );

    const allPFAnsweredPre = useMemo(
        () => PF_KEYS_PRE.every((k) => rows[k]?.pf !== ""),
        [rows, PF_KEYS_PRE]
    );

    const allPFAnsweredAll = useMemo(
        () => PF_KEYS_ALL.every((k) => rows[k]?.pf !== ""),
        [rows, PF_KEYS_ALL]
    );

    const missingPFItemsPre = useMemo(
        () =>
            PF_KEYS_PRE.filter((k) => !rows[k]?.pf)
                .map((k) => Number(k.replace("r", "")))
                .sort((a, b) => a - b),
        [rows, PF_KEYS_PRE]
    );

    const missingPFItemsAll = useMemo(
        () =>
            PF_KEYS_ALL.filter((k) => !rows[k]?.pf)
                .map((k) => Number(k.replace("r", "")))
                .sort((a, b) => a - b),
        [rows, PF_KEYS_ALL]
    );

    const MEASURE_BY_NO: Record<number, ReturnType<typeof useMeasure<UnitVoltage>> | undefined> = {
        4: m4,
        5: m5,
        6: m6,
        7: m7,
        8: m8,
    };

    /* ---------- validations ---------- */
    // ต้องตอบ PASS/FAIL ครบทุกข้อยกเว้น r4 (เป็นชุดวัดค่า)
    // const PF_REQUIRED_KEYS = useMemo(() => QUESTIONS.filter((q) => q.key !== "r4").map((q) => q.key), []);
    // const PF_REQUIRED_KEYS = useMemo(
    //     () => QUESTIONS
    //         .filter((q) => !(q.kind === "measure" && FIELD_GROUPS[q.no])) // ตัด 4–7 ออก
    //         .map((q) => q.key),
    //     []
    // );
    const PF_REQUIRED_KEYS = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") {
                keys.push(q.key); // ✅ เพิ่ม simple
            }
            if (q.kind === "measure") {
                keys.push(q.key);
            } else if (q.kind === "group") {
                q.items.forEach((item) => {
                    keys.push(item.key); // ✅ เพิ่ม group items
                });
            }

        });
        return keys;
    }, []);

    // ตอบอะไรก็ได้ที่ไม่ว่าง: PASS/FAIL/NA
    // const allPFAnswered = useMemo(
    //     () => PF_REQUIRED_KEYS.every((k) => rows[k]?.pf !== ""),
    //     [rows, PF_REQUIRED_KEYS]
    // );
    // const missingPFItems = useMemo(
    //     () =>
    //         PF_REQUIRED_KEYS.filter((k) => !rows[k]?.pf)
    //             .map((k) => Number(k.replace("r", "")))
    //             .sort((a, b) => a - b),
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


    const missingInputs = useMemo(() => {
        const r: Record<number, string[]> = {};
        const check = (s: typeof m4.state, keys: readonly string[]) =>
            keys.filter((k) => !String(s?.[k as string]?.value ?? "").trim());
        r[4] = check(m4.state, VOLTAGE_FIELDS);
        r[5] = check(m5.state, VOLTAGE_FIELDS);
        r[6] = check(m6.state, VOLTAGE_FIELDS);
        r[7] = check(m7.state, VOLTAGE_FIELDS);
        r[8] = check(m8.state, VOLTAGE_FIELDS_CCB);
        return r;
    }, [m4.state, m5.state, m6.state, m7.state, m8.state]);

    const allRequiredInputsFilled = useMemo(
        () => Object.values(missingInputs).every((arr) => arr.length === 0),
        [missingInputs]
    );

    const missingInputsTextLines = useMemo(() => {
        const lines: string[] = [];
        (Object.entries(missingInputs) as [string, string[]][]).forEach(([no, arr]) => {
            if (arr.length > 0) {
                const labels = arr.map((k) => LABELS[k] ?? k).join(", ");
                lines.push(`ข้อ ${no}: ${labels}`);
            }
        });
        return lines;
    }, [missingInputs]);

    // const canFinalSave = allPhotosAttached && allPFAnswered && allRequiredInputsFilled;
    const isSummaryFilled = summary.trim().length > 0;
    const isSummaryCheckFilled = summaryCheck !== "";

    // const canFinalSave =
    //     allPhotosAttached &&
    //     allPFAnswered &&
    //     allRequiredInputsFilled &&
    //     isSummaryFilled;

    const canFinalSave =
        allPhotosAttachedPost &&
        allPFAnsweredAll &&
        allRequiredInputsFilled &&
        isSummaryFilled &&
        isSummaryCheckFilled;

    /* ---------- unit sync ---------- */
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

    /* ---------- renderers ---------- */
    const renderMeasureGrid = (no: number) => {
        const cfg = FIELD_GROUPS[no];
        const m = MEASURE_BY_NO[no];
        if (!cfg || !m) return null;

        return (
            <div className="tw-space-y-3">
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                    {cfg.keys.map((k) => (
                        <InputWithUnit<UnitVoltage>
                            key={`${no}-${k}`}
                            label={(LABELS[k] ?? k) as string}
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

    const renderQuestionBlock = (q: Question, mode: TabId) => {
        const hasMeasure: boolean = q.kind === "measure" && !!FIELD_GROUPS[q.no];
        const subtitle = FIELD_GROUPS[q.no]?.note;

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
                                photos={photos[q.no] || []}
                                setPhotos={makePhotoSetter(q.no)}
                                max={10}
                                draftKey={key}
                                qNo={q.no}
                            />
                        </div>
                    )}

                    {hasMeasure && renderMeasureGrid(q.no)}

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
                </SectionCard>
            );
        }

        // const hasMeasure = q.kind === "measure" && FIELD_GROUPS[q.no];

        const inlineLeft =
            q.no === 11 ? (
                <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-text-blue-gray-700">
                    <input
                        type="checkbox"
                        className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500"
                        checked={dustFilterChanged}
                        onChange={(e) => setDustFilterChanged(e.target.checked)}
                    />
                    <span>เปลี่ยนแผ่นกรองระบายอากาศ</span>
                </label>
            ) : null;



        return (
            <SectionCard key={q.key} title={q.label} subtitle={subtitle}>
                {q.kind === "simple" && (
                    <PassFailRow
                        label="ผลการทดสอบ"
                        value={rows[q.key]?.pf ?? ""}
                        onChange={(v) =>
                            setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { remark: "" }), pf: v } })
                        }
                        remark={rows[q.key]?.remark ?? ""}
                        onRemarkChange={(v) =>
                            setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { pf: "" }), remark: v } })
                        }
                        aboveRemark={
                            q.hasPhoto && (
                                <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-8 tw-border-blue-gray-50">
                                    <PhotoMultiInput
                                        label={`แนบรูปประกอบ (ข้อ ${q.no})`}
                                        photos={photos[q.no] || []}
                                        setPhotos={makePhotoSetter(q.no)}
                                        max={10}
                                        draftKey={key}   // ✅ เพิ่ม
                                        qNo={q.no}
                                    />
                                </div>
                            )
                        }
                        inlineLeft={inlineLeft}
                    />
                )}

                {/* {hasMeasure && renderMeasureGrid(q.no)} */}
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
                {q.kind === "measure" && hasMeasure && (
                    <PassFailRow
                        label="ผลการทดสอบ"
                        value={rows[q.key]?.pf ?? ""}
                        onChange={(v) =>
                            setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { remark: "" }), pf: v } })
                        }
                        remark={rows[q.key]?.remark ?? ""}
                        onRemarkChange={(v) =>
                            setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { pf: "" }), remark: v } })
                        }
                        aboveRemark={
                            <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-4 tw-border-blue-gray-50">
                                <PhotoMultiInput
                                    label={`แนบรูปประกอบ (ข้อ ${q.no})`}
                                    photos={photos[q.no] || []}
                                    setPhotos={makePhotoSetter(q.no)}
                                    max={10}
                                    draftKey={key}
                                    qNo={q.no}
                                />
                            </div>
                        }
                        belowRemark={
                            (q.no === 4 || q.no === 5 || q.no === 6 || q.no === 7 || q.no === 8
                                ? renderMeasureGridWithPre(q.no)
                                : renderMeasureGrid(q.no))
                        }
                    />
                )}


            </SectionCard>
        );
    };

    // debounce ง่าย ๆ ในไฟล์นี้เลยก็ได้
    function useDebouncedEffect(effect: () => void, deps: any[], delay = 800) {
        useEffect(() => {
            const h = setTimeout(effect, delay);
            return () => clearTimeout(h);
        }, deps); // eslint-disable-line react-hooks/exhaustive-deps
    }
    const photoRefs = useMemo(() => {
        const out: Record<string | number, PhotoRef[]> = {};
        Object.entries(photos).forEach(([keyStr, list]) => {
            const photoKey = isNaN(Number(keyStr)) ? keyStr : Number(keyStr);
            out[photoKey] = (list || []).map(p => p.ref).filter(Boolean) as PhotoRef[];
        });
        return out;
    }, [photos]);

    // เรียกใช้ – เก็บเฉพาะข้อมูลที่ serialize ได้
    useDebouncedEffect(() => {
        if (!stationId || !draftId) return;
        saveDraftLocal(key, {
            // job: { ...job, issue_id: "" },
            rows,
            // cp,
            m4: m4.state,
            m5: m5.state,
            m6: m6.state,
            m7: m7.state,
            m8: m8.state,
            summary,
            // inspector,
            photoRefs,
        });
    }, [key, stationId, rows, m4.state, m5.state, m6.state, m7.state, summary, photoRefs,]);

    /* ---------- actions ---------- */
    // const onSave = () => {
    //     if (!stationId || !draftId) {
    //         alert("ยังไม่ทราบ station_id — บันทึกชั่วคราวไม่สำเร็จ");
    //         return;
    //     }
    //     // เซฟดราฟต์ (ซ้ำกับ auto-save ก็ได้ เพื่อความชัวร์ตอนกดปุ่ม)
    //     saveDraftLocal(key, {
    //         job,
    //         rows,
    //         // cp,
    //         m4: m4.state,
    //         m5: m5.state,
    //         m6: m6.state,
    //         m7: m7.state,
    //         m8: m8.state,
    //         summary,
    //         inspector,
    //     });
    //     alert("บันทึกชั่วคราวไว้ในเครื่องแล้ว (Offline Draft)");
    // };

    async function uploadGroupPhotos(
        reportId: string,
        stationId: string,
        group: string,            // เช่น "g1", "g2", ...
        files: File[],
        side: TabId,
    ) {
        const form = new FormData();
        form.append("station_id", stationId);
        form.append("group", group);
        form.append("side", side);
        // ถ้ามีหมายเหตุรวมใส่ได้ (ตอนนี้ UI ยังไม่มี)
        // form.append("remark", "...");

        files.forEach((f) => form.append("files", f)); // ชื่อ field ใน back คือ "files"

        const token = localStorage.getItem("access_token");

        const url =
            side === "pre"
                ? `${API_BASE}/mdbpmreport/${reportId}/pre/photos`
                : `${API_BASE}/mdbpmreport/${reportId}/post/photos`;

        // const res = await fetch(`${API_BASE}/mdbpmreport/${reportId}/photos`, {
        const res = await fetch(url, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: form,                 // ⛔ ห้ามใส่ Content-Type เอง
            credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
    }

    const onPreSave = async () => {
        if (!stationId) { alert("ยังไม่ทราบ station_id"); return; }
        if (!allRequiredInputsFilled) {
            alert("กรุณากรอกค่าข้อ 4-8 ให้ครบก่อนบันทึก");
            return;
        }
        if (submitting) return;
        setSubmitting(true);
        try {
            const token = localStorage.getItem("access_token");
            const pm_date = job.date?.trim() || "";

            const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
            const payload = {
                station_id: stationId,
                issue_id: issueIdFromJob,
                job: jobWithoutIssueId,
                inspector,
                measures_pre: { m4: m4.state, m5: m5.state, m6: m6.state, m7: m7.state, m8: m8.state, },
                pm_date,
                doc_name: docName,
                side: "pre" as TabId,
            };

            // 1) สร้างรายงาน (submit)
            const res = await fetch(`${API_BASE}/mdbpmreport/pre/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());

            const { report_id, doc_name } = await res.json() as {
                report_id: string;
                doc_name?: string;
            };
            if (doc_name) {
                setDocName(doc_name);
            }

            // 2) อัปโหลดรูปทั้งหมด แปลงเลขข้อเป็น group key
            // กำหนดลำดับการอัปโหลดแบบตายตัว: 1→2→3→4→5→6→7→8→9→10→11
            const orderedQuestions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

            for (const qNo of orderedQuestions) {
                // ข้อ 9 เป็น group (r9_1, r9_2, r9_3, r9_4)
                if (qNo === 9) {
                    const subKeys = ["r9_1", "r9_2", "r9_3", "r9_4"];
                    for (const subKey of subKeys) {
                        const list = photos[subKey];
                        if (!list || list.length === 0) continue;
                        const files = list.map(p => p.file!).filter(Boolean) as File[];
                        if (files.length === 0) continue;
                        await uploadGroupPhotos(report_id, stationId, subKey, files, "pre");
                    }
                } else {
                    // ข้อธรรมดา (1, 2, 3, 4, 5, 6, 7, 8, 10, 11)
                    const list = photos[qNo];
                    if (!list || list.length === 0) continue;
                    const files = list.map(p => p.file!).filter(Boolean) as File[];
                    if (files.length === 0) continue;
                    const groupKey = `g${qNo}`;
                    await uploadGroupPhotos(report_id, stationId, groupKey, files, "pre");
                }
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

            const payload = {
                station_id: stationId,
                rows,
                measures: { m4: m4.state, m5: m5.state, m6: m6.state, m7: m7.state, m8: m8.state },
                summary,
                ...(summaryCheck ? { summaryCheck } : {}),
                dust_filter: dustFilterChanged ? "yes" : "no",
                side: "post" as TabId,
                report_id: editId,
            };

            // 1) สร้างรายงาน (submit)
            const res = await fetch(`${API_BASE}/${PM_PREFIX}/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());

            const { report_id, doc_name } = await res.json() as {
                report_id: string;
                doc_name?: string;
            };

            // 2) อัปโหลดรูปทั้งหมด แปลงเลขข้อเป็น group key
            // กำหนดลำดับการอัปโหลดแบบตายตัว: 1→2→3→4→5→6→7→8→9→10→11
            const orderedQuestions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

            for (const qNo of orderedQuestions) {
                // ข้อ 9 เป็น group (r9_1, r9_2, r9_3, r9_4)
                if (qNo === 9) {
                    const subKeys = ["r9_1", "r9_2", "r9_3", "r9_4"];
                    for (const subKey of subKeys) {
                        const list = photos[subKey];
                        if (!list || list.length === 0) continue;
                        const files = list.map(p => p.file!).filter(Boolean) as File[];
                        if (files.length === 0) continue;
                        await uploadGroupPhotos(report_id, stationId, subKey, files, "post");
                    }
                } else {
                    // ข้อธรรมดา (1, 2, 3, 4, 5, 6, 7, 8, 10, 11)
                    const list = photos[qNo];
                    if (!list || list.length === 0) continue;
                    const files = list.map(p => p.file!).filter(Boolean) as File[];
                    if (files.length === 0) continue;
                    const groupKey = `g${qNo}`;
                    await uploadGroupPhotos(report_id, stationId, groupKey, files, "post");
                }
            }

            // 3) finalize (ออปชัน)
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

                    <div className="tw-flex tw-items-start tw-justify-between tw-gap-4">
                        {/* ซ้าย: โลโก้ + ข้อความ */}
                        <div className="tw-flex tw-items-start tw-gap-4 tw-flex-1">
                            <div
                                className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md
                                        tw-h-16 tw-w-[76px]
                                        md:tw-h-20 md:tw-w-[108px]
                                        lg:tw-h-24 lg:tw-w-[152px]"
                            >
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
                                    Preventive Maintanance Checklist - Main Distribution Board (MDB)
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
                                    label="Issue id"
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
                                    label="PM Date / วันที่ตรวจสอบ"
                                    type="text"
                                    value={job.date}
                                    // max={todayStr}
                                    onChange={(e) => setJob({ ...job, date: e.target.value })}
                                    crossOrigin=""
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    readOnly
                                    className="!tw-bg-blue-gray-50"
                                />
                            </div>
                        </div>
                    </div>
                    {[
                        // [1, 5],
                        // [6, 10],
                        // [11, 16],
                        // [17, 17], // มีกริดวัดค่า
                        // [18, 19],
                        [1, 11]
                        // ].map(([start, end]) => (
                        //     <CardBody className="tw-space-y-2">
                        //         {QUESTIONS.filter((q) => q.no >= start && q.no <= end).map(renderQuestionBlock)}
                        //     </CardBody>

                        // ))}
                    ].map(([start, end]) => (
                        <CardBody key={`${start}-${end}`} className="tw-space-y-2">
                            {QUESTIONS
                                .filter((q) => q.no >= start && q.no <= end)
                                .filter((q) => !(displayTab === "pre" && (q.no === 11)))
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
                    {/* Summary & Actions */}
                    <CardFooter className="tw-flex tw-flex-col tw-gap-3 tw-mt-8">
                        <div className="tw-p-3 tw-flex tw-flex-col tw-gap-3">
                            {/* ข้อ 1 (ใช้ค่าที่เลือกตาม tab) */}
                            <Section title="1) ตรวจสอบการแนบรูปภาพ (ทุกข้อ)" ok={allPhotosAttached}>
                                <Typography variant="small" className="!tw-text-amber-700">
                                    ยังไม่ได้แนบรูปข้อ: {missingPhotoItems.join(", ")}
                                </Typography>
                            </Section>

                            {/* ข้อ 2 */}
                            <Section title="2) อินพุตข้อ 4–8" ok={allRequiredInputsFilled}>
                                <div className="tw-space-y-1">
                                    <Typography variant="small" className="!tw-text-amber-700">
                                        ยังขาด:
                                    </Typography>
                                    <ul className="tw-list-disc tw-ml-5 tw-text-sm tw-text-blue-gray-700">
                                        {missingInputsTextLines.map((line, i) => (
                                            <li key={i}>{line}</li>
                                        ))}
                                    </ul>
                                </div>
                            </Section>

                            {/* บล็อก 3 & 4 แสดงเฉพาะหลัง (post) */}
                            {isPostMode && (
                                <>
                                    <Section title="3) สถานะ PASS / FAIL / N/A ทั้ง 11 ข้อ" ok={allPFAnsweredForUI}>
                                        <Typography variant="small" className="!tw-text-amber-700">
                                            ยังไม่ได้เลือกข้อ: {missingPFItemsForUI.join(", ")}
                                        </Typography>
                                    </Section>

                                    <Section title="4) สรุปผลการตรวจสอบ" ok={isSummaryFilled && isSummaryCheckFilled}>
                                        <div className="tw-space-y-1">
                                            {!isSummaryFilled && (
                                                <Typography variant="small" className="!tw-text-amber-700">
                                                    ยังไม่ได้กรอกข้อความสรุปผลการตรวจสอบ
                                                </Typography>
                                            )}
                                            {!isSummaryCheckFilled && (
                                                <Typography variant="small" className="!tw-text-amber-700">
                                                    ยังไม่ได้เลือกสถานะสรุปผล (Pass/Fail/N&nbsp;A)
                                                </Typography>
                                            )}
                                        </div>
                                    </Section>
                                </>
                            )}
                        </div>


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
                                                ? "กรุณากรอกค่าข้อ 15 (CP) และข้อ 17 ให้ครบก่อนบันทึก"
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