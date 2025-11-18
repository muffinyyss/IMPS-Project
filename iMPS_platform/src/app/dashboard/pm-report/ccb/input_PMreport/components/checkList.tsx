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
import { useRouter, useSearchParams } from "next/navigation";

/* =========================
 *        API (เดิม)
 * ========================= */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const LOGO_SRC = "/img/logo_egat.png";
type StationPublic = {
    station_id: string;
    station_name: string;
    SN?: string;
    WO?: string;
    chargeBoxID?: string;
    model?: string;
    status?: boolean;
};

type CheckListProps = {
    onComplete: (status: boolean) => void;
    onNext?: () => void;
    onPrev?: () => void;
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
const UNITS = { voltage: ["V", "MΩ", "kΩ"] as const };
type UnitVoltage = (typeof UNITS.voltage)[number];

type PhotoItem = {
    id: string;
    file?: File;
    preview?: string;
    remark?: string;
    uploading?: boolean;
    error?: string;
};

type PF = "PASS" | "FAIL" | "NA" | "";

/** ช่องวัดค่าแรงดัน (ข้อ 9) – เฟสเดียวตามภาพ */
const VOLTAGE_FIELDS_CCB = ["L-N", "L-G", "N-G"] as const;
const LABELS: Record<string, string> = { "L-N": "L - N", "L-G": "L - G", "N-G": "N - G" };

/* ---------- 9 หัวข้อ ตามภาพ ---------- */
type Question =
    | { no: number; key: `r${number}`; label: string; kind: "simple"; hasPhoto?: boolean }
    | { no: number; key: `r${number}`; label: string; kind: "group"; items: { key: string; label: string }[]; hasPhoto?: boolean }
    | { no: number; key: `r${number}`; label: string; kind: "measure9"; hasPhoto?: boolean };

const QUESTIONS: Question[] = [
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
];

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
function SectionCard({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
    return (
        // <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
        //     {(title || subtitle) && (
        //         <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
        //             {title && <Typography variant="h6">{title}</Typography>}
        //             {subtitle && <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">{subtitle}</Typography>}
        //         </CardHeader>
        //     )}
        //     <CardBody className="tw-space-y-4">{children}</CardBody>
        // </Card>
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

function InputWithUnit<U extends string>({
    label, value, unit, units, onValueChange, onUnitChange,
}: {
    label: string; value: string; unit: U; units: readonly U[]; onValueChange: (v: string) => void; onUnitChange: (u: U) => void;
}) {
    return (
        <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-items-end sm:tw-items-center">
            <Input
                type="number"
                inputMode="decimal"
                step="any"
                label={label}
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                crossOrigin=""
                containerProps={{ className: "tw-col-span-1 !tw-min-w-0" }}
                className="!tw-w-full"
                required
            />
            <select
                required
                value={unit}
                onChange={(e) => onUnitChange(e.target.value as U)}
                className="tw-col-span-1 tw-h-10 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500/30 focus:tw-border-blue-500"
            >
                {units.map((u) => (
                    <option key={u} value={u}>
                        {u}
                    </option>
                ))}
            </select>
        </div>
    );
}

// function PassFailRow({
//     label, value, onChange, remark, onRemarkChange, labels,
// }: {
//     label: string; value: PF; onChange: (v: Exclude<PF, "">) => void; remark?: string; onRemarkChange?: (v: string) => void; labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
// }) {
//     return (
//         <div className="tw-space-y-3 tw-py-3">
//             <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">
//                 <Typography className="tw-font-medium">{label}</Typography>

//                 <div className="tw-flex tw-gap-2 tw-w-full sm:tw-w-auto">
//                     <Button size="sm" color="green" variant={value === "PASS" ? "filled" : "outlined"} className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]" onClick={() => onChange("PASS")}>PASS</Button>
//                     <Button size="sm" color="red" variant={value === "FAIL" ? "filled" : "outlined"} className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]" onClick={() => onChange("FAIL")}>FAIL</Button>
//                     <Button size="sm" color="blue-gray" variant={value === "NA" ? "filled" : "outlined"} className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]" onClick={() => onChange("NA")}>N/A</Button>
//                 </div>
//             </div>

//             {onRemarkChange && (
//                 <div className="tw-w-full tw-min-w-0">
//                     <Textarea label="หมายเหตุ (ถ้ามี)" value={remark || ""} onChange={(e) => onRemarkChange(e.target.value)} containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full" />
//                 </div>
//             )}
//         </div>
//     );
// }

function PassFailRow({
    label,
    value,
    onChange,
    remark,
    onRemarkChange,
    labels,
    aboveRemark,              // 👈 เพิ่มตรงนี้
}: {
    label: string;
    value: PF;
    onChange: (v: Exclude<PF, "">) => void;
    remark?: string;
    onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
    aboveRemark?: React.ReactNode;   // 👈 และเพิ่มใน type ตรงนี้
}) {
    const text = {
        PASS: labels?.PASS ?? "PASS",
        FAIL: labels?.FAIL ?? "FAIL",
        NA: labels?.NA ?? "N/A",
    };

    return (
        <div className="tw-space-y-3 tw-py-3">
            <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">
                <Typography className="tw-font-medium">{label}</Typography>

                <div className="tw-flex tw-gap-2 tw-w-full sm:tw-w-auto">
                    <Button
                        size="sm"
                        color="green"
                        variant={value === "PASS" ? "filled" : "outlined"}
                        className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]"
                        onClick={() => onChange("PASS")}
                    >
                        {text.PASS}
                    </Button>
                    <Button
                        size="sm"
                        color="red"
                        variant={value === "FAIL" ? "filled" : "outlined"}
                        className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]"
                        onClick={() => onChange("FAIL")}
                    >
                        {text.FAIL}
                    </Button>
                    <Button
                        size="sm"
                        color="blue-gray"
                        variant={value === "NA" ? "filled" : "outlined"}
                        className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]"
                        onClick={() => onChange("NA")}
                    >
                        {text.NA}
                    </Button>
                </div>
            </div>

            {onRemarkChange && (
                <div className="tw-w-full tw-min-w-0 tw-space-y-2">
                    {/* 👇 รูปจะมาอยู่ตรงนี้ เหนือช่องหมายเหตุ */}
                    {aboveRemark}

                    <Textarea
                        label="หมายเหตุ (ถ้ามี)"
                        value={remark || ""}
                        onChange={(e) => onRemarkChange(e.target.value)}
                        containerProps={{ className: "!tw-w-full !tw-min-w-0" }}
                        className="!tw-w-full"
                    />
                </div>
            )}
        </div>
    );
}

function PhotoMultiInput({
    label, photos, setPhotos, max = 3,
}: {
    label?: string;
    photos: PhotoItem[];
    setPhotos: React.Dispatch<React.SetStateAction<PhotoItem[]>>;
    max?: number;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const handlePick = () => fileRef.current?.click();
    const handleFiles = (list: FileList | null) => {
        if (!list) return;
        const remain = Math.max(0, max - photos.length);
        const files = Array.from(list).slice(0, remain);
        const items: PhotoItem[] = files.map((f, i) => ({
            id: `${Date.now()}-${i}-${f.name}`,
            file: f,
            preview: URL.createObjectURL(f),
            remark: "",
        }));
        setPhotos((prev) => [...prev, ...items]);
        if (fileRef.current) fileRef.current.value = "";
    };
    const handleRemove = (id: string) => {
        setPhotos((prev) => {
            const target = prev.find((p) => p.id === id);
            if (target?.preview) URL.revokeObjectURL(target.preview);
            return prev.filter((p) => p.id !== id);
        });
    };

    return (
        // <div className="tw-space-y-3">
        //     {label && <Typography className="tw-font-medium">{label}</Typography>}
        //     <div className="tw-flex tw-flex-wrap tw-gap-2">
        //         <Button size="sm" color="blue" variant="outlined" onClick={handlePick}>แนบรูป / ถ่ายรูป</Button>
        //         <Typography variant="small" className="!tw-text-blue-gray-500 tw-flex tw-items-center">
        //             แนบได้สูงสุด {max} รูป • รองรับการถ่ายจากกล้องบนมือถือ
        //         </Typography>
        //     </div>
        //     <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="tw-hidden" onChange={(e) => handleFiles(e.target.files)} />
        //     {photos.length > 0 ? (
        //         <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
        //             {photos.map((p) => (
        //                 <div key={p.id} className="tw-border tw-rounded-lg tw-overflow-hidden tw-bg-white tw-shadow-xs tw-flex tw-flex-col">
        //                     <div className="tw-relative tw-aspect-[4/3] tw-bg-blue-gray-50">
        //                         {p.preview && <img src={p.preview} alt="preview" className="tw-w-full tw-h-full tw-object-cover" />}
        //                     </div>
        //                     <div className="tw-p-2 tw-space-y-2">
        //                         <div className="tw-flex tw-justify-end">
        //                             <Button size="sm" color="red" variant="text" onClick={() => handleRemove(p.id)}>ลบรูป</Button>
        //                         </div>
        //                     </div>
        //                 </div>
        //             ))}
        //         </div>
        //     ) : (
        //         <Typography variant="small" className="!tw-text-blue-gray-500">ยังไม่มีรูปแนบ</Typography>
        //     )}
        // </div>
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
                onChange={(e) => handleFiles(e.target.files)}
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
                            </div>
                            <div className="tw-p-2 tw-space-y-2">
                                <div className="tw-flex tw-justify-end">
                                    <Button
                                        size="sm"
                                        color="red"
                                        variant="text"
                                        onClick={() => handleRemove(p.id)}
                                    >
                                        ลบรูป
                                    </Button>
                                </div>
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

function makePrefix(typeCode: string, dateISO: string) {
    const d = new Date(dateISO || new Date().toISOString().slice(0, 10));
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `PM-${typeCode}-${yy}${mm}-`; // ตัวอย่าง: PM-CG-2511-
}

function nextIssueIdFor(typeCode: string, dateISO: string, latestFromDb?: string) {
    const prefix = makePrefix(typeCode, dateISO);
    const s = String(latestFromDb || "").trim();
    if (!s || !s.startsWith(prefix)) return `${prefix}01`;     // เริ่มที่ 01 ถ้ายังไม่มีของเดือนนี้
    const m = s.match(/(\d+)$/);
    const pad = m ? m[1].length : 2;                           // รักษาความยาวเลขท้าย
    const n = (m ? parseInt(m[1], 10) : 0) + 1;
    return `${prefix}${n.toString().padStart(pad, "0")}`;
}

async function fetchLatestIssueIdFromList(stationId: string, dateISO: string): Promise<string | null> {
    const u = new URL(`${API_BASE}/ccbpmreport/list`);
    u.searchParams.set("station_id", stationId);
    u.searchParams.set("page", "1");
    u.searchParams.set("pageSize", "50");
    u.searchParams.set("_ts", String(Date.now()));

    const r = await fetch(u.toString(), { credentials: "include", cache: "no-store" });
    if (!r.ok) return null;

    const j = await r.json();
    const items: any[] = Array.isArray(j?.items) ? j.items : [];
    if (!items.length) return null;

    const prefix = makePrefix(PM_TYPE_CODE, dateISO);

    // เลือกเฉพาะของเดือน/ประเภทเดียวกัน
    const samePrefix = items
        .map(it => String(it?.issue_id || ""))         // <- ดึง issue_id จาก list
        .filter(iid => iid.startsWith(prefix));

    if (!samePrefix.length) return null;

    // หาตัวที่เลขท้ายมากสุด (ปลอดภัยกว่า sort string)
    const toTailNum = (iid: string) => {
        const m = iid.match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : -1;
    };
    return samePrefix.reduce((acc, cur) => (toTailNum(cur) > toTailNum(acc) ? cur : acc), samePrefix[0]);
}

/* =========================
 *        MAIN
 * ========================= */
// export default function CheckList({ onComplete, onNext, onPrev }: CheckListProps) {
export default function CCBPMReport() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    const searchParams = useSearchParams();
    const editId = searchParams.get("edit_id") ?? "";
    const PM_PREFIX = "ccbpmreport";

    /* ---------- photos per question ---------- */
    const initialPhotos: Record<number, PhotoItem[]> = Object.fromEntries(
        QUESTIONS.filter((q) => q.hasPhoto).map((q) => [q.no, [] as PhotoItem[]])
    ) as Record<number, PhotoItem[]>;
    const [photos, setPhotos] = useState<Record<number, PhotoItem[]>>(initialPhotos);

    const [cp, setCp] = useState<{ value: string; unit: UnitVoltage }>({ value: "", unit: "V" });
    const [summary, setSummary] = useState<string>("");

    const [stationId, setStationId] = useState<string | null>(null);
    const [draftId, setDraftId] = useState<string | null>(null);
    // const [สรุปผล, setสรุปผล] = useState<PF>("");
    const [summaryCheck, setSummaryCheck] = useState<PF>("");


    // const key = useMemo(
    //     () => draftKeyCCB(stationId, draftId ?? "default"),
    //     [stationId, draftId]
    // );

    const key = useMemo(() => draftKeyCCB(stationId), [stationId]);



    /* ---------- job info ---------- */
    const [job, setJob] = useState({ issue_id: "", chargerNo: "", sn: "", model: "", station_name: "", date: "", inspector: "" });

    /* ---------- PASS/FAIL + remark ---------- */
    // รวม key ทั้งหัวข้อหลัก + หัวข้อย่อย
    const ALL_KEYS = useMemo(() => {
        const base = QUESTIONS.flatMap((q) => (q.kind === "group" ? [q.key, ...q.items.map((i) => i.key as string)] : [q.key]));
        return base;
    }, []);

    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(
        Object.fromEntries(ALL_KEYS.map((k) => [k, { pf: "", remark: "" }])) as Record<string, { pf: PF; remark: string }>
    );

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
                    sn: st.SN ?? prev.sn,
                    model: st.model ?? prev.model,
                    station_name: st.station_name ?? prev.station_name,
                    date: prev.date || new Date().toISOString().slice(0, 10),
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
            job: typeof job;
            rows: typeof rows;
            m9_0: typeof m9_0.state;
            m9_1: typeof m9_1.state;
            m9_2: typeof m9_2.state;
            m9_3: typeof m9_3.state;
            m9_4: typeof m9_4.state;
            m9_5: typeof m9_5.state;
            photos: typeof photos;
            summary: string;
        }>(key);
        if (!draft) return;

        setJob((prev) => ({ ...prev, ...draft.job }));
        setRows(draft.rows);
        m9_0.setState(draft.m9_0 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        m9_1.setState(draft.m9_1 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        m9_2.setState(draft.m9_2 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        m9_3.setState(draft.m9_3 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        m9_4.setState(draft.m9_4 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        m9_5.setState(draft.m9_5 ?? initMeasureState(VOLTAGE_FIELDS_CCB, "V"));
        setPhotos(draft.photos ?? initialPhotos);
        setSummary(draft.summary);
    }, [stationId, draftId, key]);

    useEffect(() => {
        const onInfo = (e: Event) => {
            const detail = (e as CustomEvent).detail as { info?: StationPublic; station?: StationPublic };
            const st = detail.info ?? detail.station;
            if (!st) return;
            setJob((prev) => ({
                ...prev,
                sn: st.SN ?? prev.sn,
                model: st.model ?? prev.model,
            }));
        };
        window.addEventListener("station:info", onInfo as EventListener);
        return () => window.removeEventListener("station:info", onInfo as EventListener);
    }, []);


    useEffect(() => {
        if (!stationId || !job.date) return;

        let canceled = false;
        (async () => {
            try {
                const latest = await fetchLatestIssueIdFromList(stationId, job.date);
                const next = nextIssueIdFor(PM_TYPE_CODE, job.date, latest || "");
                if (!canceled) {
                    const prefix = makePrefix(PM_TYPE_CODE, job.date);
                    setJob(prev => {
                        // ถ้า issue_id เดิมยังอยู่เดือนเดียวกัน ก็ไม่ต้องเปลี่ยน
                        if (prev.issue_id?.startsWith(prefix)) return prev;
                        return { ...prev, issue_id: next };
                    });
                }
            } catch {
                if (!canceled) {
                    const fallback = nextIssueIdFor(PM_TYPE_CODE, job.date, "");
                    setJob(prev => ({ ...prev, issue_id: fallback }));
                }
            }
        })();

        return () => { canceled = true; };
    }, [stationId, job.date]);


    // ---------- render helpers ----------
    const makePhotoSetter = (
        no: number
    ): React.Dispatch<React.SetStateAction<PhotoItem[]>> => {
        return (action: React.SetStateAction<PhotoItem[]>) => {
            setPhotos((prev) => {
                const current = prev[no] ?? [];
                const next =
                    typeof action === "function"
                        ? (action as (x: PhotoItem[]) => PhotoItem[])(current)
                        : action;
                return { ...prev, [no]: next };
            });
        };
    };


    const REQUIRED_PHOTO_ITEMS = useMemo(() => QUESTIONS.filter((q) => q.hasPhoto).map((q) => q.no).sort((a, b) => a - b), []);
    const missingPhotoItems = useMemo(() => REQUIRED_PHOTO_ITEMS.filter((no) => (photos[no]?.length ?? 0) < 1), [REQUIRED_PHOTO_ITEMS, photos]);
    const allPhotosAttached = missingPhotoItems.length === 0;

    /* ---------- validation ---------- */
    // ต้องตอบ PASS/FAIL/N/A สำหรับ: หัวข้อเดี่ยว + หัวข้อย่อยทั้งหมด
    const PF_REQUIRED_KEYS = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "group") keys.push(...q.items.map((i) => i.key));
            if (q.kind === "simple") keys.push(q.key);
            // ข้อ 9 (measure) ไม่มี PASS/FAIL ย่อย จึงไม่บังคับ
        });
        return keys;
    }, []);

    const allPFAnswered = useMemo(() => PF_REQUIRED_KEYS.every((k) => rows[k]?.pf !== ""), [rows, PF_REQUIRED_KEYS]);

    const missingPFItems = useMemo(
        () =>
            PF_REQUIRED_KEYS.filter((k) => !rows[k]?.pf)
                .map((k) => k.replace(/^r(\d+)_?(\d+)?$/, (_, a, b) => (b ? `${a}.${b}` : a)))
                .sort((a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0])),
        [rows, PF_REQUIRED_KEYS]
    );

    // เช็คอินพุตของข้อ 9 ให้ครบทุกช่อง
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
    const isSummaryFilled = summary.trim().length > 0;

    const canFinalSave = allPhotosAttached && allPFAnswered && allRequiredInputsFilled && isSummaryFilled;

    // useEffect(() => onComplete(allPFAnswered), [allPFAnswered, onComplete]);

    /* ---------- persistence (auto-save) ---------- */
    function useDebouncedEffect(effect: () => void, deps: any[], delay = 800) {
        useEffect(() => {
            const h = setTimeout(effect, delay);
            return () => clearTimeout(h);
        }, deps); // eslint-disable-line react-hooks/exhaustive-deps
    }

    useDebouncedEffect(() => {
        if (!stationId || !draftId) return;
        saveDraftLocal(key, {
            job,
            rows,
            m9_0: m9_0.state,
            m9_1: m9_1.state,
            m9_2: m9_2.state,
            m9_3: m9_3.state,
            m9_4: m9_4.state,
            m9_5: m9_5.state,
            photos,
            summary,
        });
    }, [key, stationId, draftId, job, rows, m9_0.state, m9_1.state, m9_2.state, m9_3.state, m9_4.state, m9_5.state, photos, summary]);

    /* ---------- actions (submit เหมือนเดิม) ---------- */
    async function uploadGroupPhotos(reportId: string, stationId: string, group: string, files: File[]) {
        const form = new FormData();
        form.append("station_id", stationId);
        form.append("group", group);
        files.forEach((f) => form.append("files", f));
        const token = localStorage.getItem("access_token");
        const res = await fetch(`${API_BASE}/${PM_PREFIX}/${reportId}/photos`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: form,
            credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
    }

    const onFinalSave = async () => {
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
                station_id: stationId,
                issue_id: issueIdFromJob,
                job,
                rows,
                measures: { r9 },
                summary,
                pm_date,
                ...(summaryCheck ? { summaryCheck } : {}),
            };

            // รูปร่าง measure สำหรับข้อ 9
            // const measures9 = M9_LIST.map((m, i) => ({
            //     index: i,
            //     data: m.state,
            // }));



            const res = await fetch(`${API_BASE}/${PM_PREFIX}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const { report_id } = await res.json();

            // อัปโหลดรูปแยกกลุ่ม g1..g9
            const photoNos = Object.keys(photos).map(Number);
            for (const no of photoNos) {
                const list = photos[no] || [];
                if (list.length === 0) continue;
                const files = list.map((p) => p.file!).filter(Boolean) as File[];
                if (files.length === 0) continue;
                await uploadGroupPhotos(report_id, stationId, `g${no}`, files);
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

    const renderMeasureGrid9 = (idx: number, title: string, m: ReturnType<typeof useMeasure<UnitVoltage>>) => {
        return (
            <div className="tw-space-y-2 tw-py-2 tw-border tw-rounded-lg tw-border-blue-gray-100 tw-px-3">
                <Typography className="tw-font-medium">{title}</Typography>
                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-3">
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

    // const renderQuestionBlock = (q: Question) => {
    //     return (
    //         <SectionCard key={q.key} title={q.label}>
    //             {/* simple/group header row */}
    //             {q.kind === "simple" && (
    //                 <PassFailRow
    //                     label="ผลการทดสอบ"
    //                     value={rows[q.key].pf}
    //                     onChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })}
    //                     remark={rows[q.key].remark}
    //                     onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })}
    //                 />
    //             )}

    //             {q.kind === "group" &&
    //                 q.items.map((it) => (
    //                     <PassFailRow
    //                         key={it.key}
    //                         label={it.label}
    //                         value={rows[it.key]?.pf ?? ""}
    //                         onChange={(v) => setRows({ ...rows, [it.key]: { ...(rows[it.key] ?? { remark: "" }), pf: v } })}
    //                         remark={rows[it.key]?.remark}
    //                         onRemarkChange={(v) => setRows({ ...rows, [it.key]: { ...(rows[it.key] ?? { pf: "" }), remark: v } })}
    //                     />
    //                 ))}

    //             {q.kind === "measure9" && (
    //                 <div className="tw-space-y-3">
    //                     {renderMeasureGrid9(0, BREAKERS[0], m9_0)}
    //                     {renderMeasureGrid9(1, BREAKERS[1], m9_1)}
    //                     {renderMeasureGrid9(2, BREAKERS[2], m9_2)}
    //                     {renderMeasureGrid9(3, BREAKERS[3], m9_3)}
    //                     {renderMeasureGrid9(4, BREAKERS[4], m9_4)}
    //                     {renderMeasureGrid9(5, BREAKERS[5], m9_5)}
    //                 </div>
    //             )}

    //             {q.hasPhoto && (
    //                 <div className="tw-pt-2 tw-pb-4 tw-border-t tw-border-blue-gray-50">
    //                     <PhotoMultiInput
    //                         label={`แนบรูปประกอบ (ข้อ ${q.no})`}
    //                         photos={photos[q.no] || []}
    //                         setPhotos={makePhotoSetter(q.no)}
    //                         max={3}
    //                     />
    //                 </div>
    //             )}
    //         </SectionCard>
    //     );
    // };

    const renderQuestionBlock = (q: Question) => {
        return (
            <SectionCard key={q.key} title={q.label}>
                {/* รูป (ถ้ามี) -> อยู่ด้านบนสุดของแต่ละข้อ */}
                {q.hasPhoto && (
                    <div className="tw-mb-4 tw-pb-4 tw-border-b tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label={`แนบรูปประกอบ (ข้อ ${q.no})`}
                            photos={photos[q.no] || []}
                            setPhotos={makePhotoSetter(q.no)}
                            max={3}
                        />
                    </div>
                )}

                {/* simple/group header row */}
                {q.kind === "simple" && (
                    <PassFailRow
                        label="ผลการทดสอบ"
                        value={rows[q.key].pf}
                        onChange={(v) =>
                            setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })
                        }
                        remark={rows[q.key].remark}
                        onRemarkChange={(v) =>
                            setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })
                        }
                    />
                )}

                {q.kind === "group" &&
                    q.items.map((it) => (
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
                            remark={rows[it.key]?.remark}
                            onRemarkChange={(v) =>
                                setRows({
                                    ...rows,
                                    [it.key]: { ...(rows[it.key] ?? { pf: "" }), remark: v },
                                })
                            }
                        />
                    ))}

                {q.kind === "measure9" && (
                    <div className="tw-space-y-3">
                        {renderMeasureGrid9(0, BREAKERS[0], m9_0)}
                        {renderMeasureGrid9(1, BREAKERS[1], m9_1)}
                        {renderMeasureGrid9(2, BREAKERS[2], m9_2)}
                        {renderMeasureGrid9(3, BREAKERS[3], m9_3)}
                        {renderMeasureGrid9(4, BREAKERS[4], m9_4)}
                        {renderMeasureGrid9(5, BREAKERS[5], m9_5)}
                    </div>
                )}
            </SectionCard>
        );
    };
    /* =========================
     *        RENDER
     * ========================= */
    return (
        <section className="tw-pb-24">
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

                            <div className="sm:tw-col-span-2 lg:tw-col-span-3">
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

                            <div className="lg:tw-col-span-2">
                                <Input
                                    label="วันที่ตรวจ"
                                    type="date"
                                    value={job.date}
                                    onChange={(e) => setJob({ ...job, date: e.target.value })}
                                    crossOrigin=""
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div>
                        </div>
                    </div>
                    {[
                        [1, 5],
                        [6, 10],
                        [11, 16],
                        [17, 17], // มีกริดวัดค่า
                        [18, 19],
                    ].map(([start, end]) => (
                        // <Card key={`${start}-${end}`} className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                        //     {start === 1 && (
                        //         <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                        //             <Typography variant="h6">Checklist</Typography>
                        //         </CardHeader>
                        //     )}
                        //     <CardBody className="tw-space-y-1">
                        //         {QUESTIONS.filter((q) => q.no >= start && q.no <= end).map(renderQuestionBlock)}
                        //     </CardBody>
                        // </Card>

                        <CardBody className="tw-space-y-2">
                            {QUESTIONS.filter((q) => q.no >= start && q.no <= end).map(renderQuestionBlock)}
                        </CardBody>
                    ))}
                    {/* Summary */}
                    <SectionCard title="Comment">
                        <div className="tw-space-y-2">
                            <Textarea
                                label="Comment"
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                rows={4}
                                required
                                autoComplete="off"
                                containerProps={{ className: "!tw-min-w-0" }}
                                className="!tw-w-full resize-none"
                            />
                            <Typography variant="small" className={`tw-text-xs ${!isSummaryFilled ? "!tw-text-red-600" : "!tw-text-blue-gray-500"}`}>
                                {isSummaryFilled ? "กรุณาตรวจทานถ้อยคำและความครบถ้วนก่อนบันทึก" : "จำเป็นต้องกรอกสรุปผลการตรวจสอบ"}
                            </Typography>
                        </div>

                        <div className="tw-pt-3 tw-border-t tw-border-blue-gray-50">
                            <PassFailRow
                                label="สรุปผลการตรวจสอบ"
                                value={summaryCheck}
                                onChange={(v) => setSummaryCheck(v)}
                                labels={{                    // ⬅️ ไทยเฉพาะตรงนี้
                                    PASS: "Pass : ผ่าน",
                                    FAIL: "Fail : ไม่ผ่าน",
                                    NA: "N/A : ไม่พบ",
                                }}
                            />
                        </div>
                    </SectionCard>
                    {/* Footer checks */}
                    <CardFooter className="tw-flex tw-flex-col tw-gap-3 tw-mt-8">
                        <div className={`tw-rounded-lg tw-border tw-p-3 ${allPFAnswered ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
                            <Typography className="tw-font-medium">1) สถานะ PASS / FAIL / N/A (หัวข้อย่อยทุกข้อ)</Typography>
                            {allPFAnswered ? (
                                <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                            ) : (
                                <Typography variant="small" className="!tw-text-amber-700">ยังไม่ได้เลือกข้อ: {missingPFItems.join(", ")}</Typography>
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

                        <div className={`tw-rounded-lg tw-border tw-p-3 ${allPhotosAttached ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
                            <Typography className="tw-font-medium">3) ตรวจสอบการแนบรูปภาพ (ทุกหัวข้อ)</Typography>
                            {allPhotosAttached ? (
                                <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                            ) : (
                                <Typography variant="small" className="!tw-text-amber-700">ยังไม่ได้แนบรูปข้อ: {missingPhotoItems.join(", ")}</Typography>
                            )}
                        </div>

                        <div className={`tw-rounded-lg tw-border tw-p-3 ${isSummaryFilled ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
                            <Typography className="tw-font-medium">4) สรุปผลการตรวจสอบ</Typography>
                            {isSummaryFilled ? (
                                <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                            ) : (
                                <Typography variant="small" className="!tw-text-amber-700">ยังไม่ได้กรอกสรุปผลการตรวจสอบ</Typography>
                            )}
                        </div>

                        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-3">
                            <Button color="blue" type="button" onClick={onFinalSave} disabled={!canFinalSave || submitting}>
                                {submitting ? "กำลังบันทึก..." : "บันทึก"}
                            </Button>
                        </div>
                    </CardFooter>
                </div>
            </form>
        </section>

        // <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
        //     {/* Job Info */}
        //     <SectionCard title="ข้อมูลงาน" subtitle="กรุณากรอกทุกช่องให้ครบ เพื่อความสมบูรณ์ของรายงาน PM">
        //         <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4">
        //             <Input
        //                 label="Issue id"
        //                 value={job.issue_id || "-"}
        //                 readOnly
        //                 // key={job.issue_id}  // บังคับให้รี-mount เมื่อค่าเปลี่ยน
        //                 crossOrigin=""
        //                 containerProps={{ className: "!tw-min-w-0" }}
        //                 className="!tw-w-full !tw-bg-blue-gray-50"
        //             />
        //             <Input label="Location / สถานที่" value={job.station_name} onChange={(e) => setJob({ ...job, station_name: e.target.value })} crossOrigin="" className="!tw-bg-blue-gray-50" readOnly />
        //             <Input label="วันที่ตรวจ" type="date" value={job.date} onChange={(e) => setJob({ ...job, date: e.target.value })} crossOrigin="" />
        //         </div>
        //     </SectionCard>

        //     {/* Checklist */}
        //     <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
        //         <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
        //             <Typography variant="h6">Checklist</Typography>
        //         </CardHeader>
        //         <CardBody className="tw-space-y-1">
        //             {QUESTIONS.map(renderQuestionBlock)}
        //         </CardBody>
        //     </Card>

        //     {/* Summary */}
        //     <SectionCard title="Comment">
        //         <div className="tw-space-y-2">
        //             <Textarea
        //                 label="Comment"
        //                 value={summary}
        //                 onChange={(e) => setSummary(e.target.value)}
        //                 rows={4}
        //                 required
        //                 autoComplete="off"
        //                 containerProps={{ className: "!tw-min-w-0" }}
        //                 className="!tw-w-full resize-none"
        //             />
        //             <Typography variant="small" className={`tw-text-xs ${!isSummaryFilled ? "!tw-text-red-600" : "!tw-text-blue-gray-500"}`}>
        //                 {isSummaryFilled ? "กรุณาตรวจทานถ้อยคำและความครบถ้วนก่อนบันทึก" : "จำเป็นต้องกรอกสรุปผลการตรวจสอบ"}
        //             </Typography>
        //         </div>

        //         <div className="tw-pt-3 tw-border-t tw-border-blue-gray-50">
        //             <PassFailRow
        //                 label="สรุปผลการตรวจสอบ"
        //                 value={summaryCheck}
        //                 onChange={(v) => setSummaryCheck(v)}
        //                 labels={{                    // ⬅️ ไทยเฉพาะตรงนี้
        //                     PASS: "Pass : ผ่าน",
        //                     FAIL: "Fail : ไม่ผ่าน",
        //                     NA: "N/A : ไม่พบ",
        //                 }}
        //             />
        //         </div>
        //     </SectionCard>

        //     {/* Footer checks */}
        //     <CardFooter className="tw-flex tw-flex-col tw-gap-3 tw-mt-8">
        //         <div className={`tw-rounded-lg tw-border tw-p-3 ${allPFAnswered ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
        //             <Typography className="tw-font-medium">1) สถานะ PASS / FAIL / N/A (หัวข้อย่อยทุกข้อ)</Typography>
        //             {allPFAnswered ? (
        //                 <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
        //             ) : (
        //                 <Typography variant="small" className="!tw-text-amber-700">ยังไม่ได้เลือกข้อ: {missingPFItems.join(", ")}</Typography>
        //             )}
        //         </div>

        //         <div className={`tw-rounded-lg tw-border tw-p-3 ${allRequiredInputsFilled ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
        //             <Typography className="tw-font-medium">2) อินพุตข้อ 9 (ค่าที่วัด)</Typography>
        //             {allRequiredInputsFilled ? (
        //                 <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
        //             ) : (
        //                 <div className="tw-space-y-1">
        //                     <Typography variant="small" className="!tw-text-amber-700">ยังขาด:</Typography>
        //                     <ul className="tw-list-disc tw-ml-5 tw-text-sm tw-text-blue-gray-700">
        //                         {missingInputs.map((line, i) => (<li key={i}>{line}</li>))}
        //                     </ul>
        //                 </div>
        //             )}
        //         </div>

        //         <div className={`tw-rounded-lg tw-border tw-p-3 ${allPhotosAttached ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
        //             <Typography className="tw-font-medium">3) ตรวจสอบการแนบรูปภาพ (ทุกหัวข้อ)</Typography>
        //             {allPhotosAttached ? (
        //                 <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
        //             ) : (
        //                 <Typography variant="small" className="!tw-text-amber-700">ยังไม่ได้แนบรูปข้อ: {missingPhotoItems.join(", ")}</Typography>
        //             )}
        //         </div>

        //         <div className={`tw-rounded-lg tw-border tw-p-3 ${isSummaryFilled ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
        //             <Typography className="tw-font-medium">4) สรุปผลการตรวจสอบ</Typography>
        //             {isSummaryFilled ? (
        //                 <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
        //             ) : (
        //                 <Typography variant="small" className="!tw-text-amber-700">ยังไม่ได้กรอกสรุปผลการตรวจสอบ</Typography>
        //             )}
        //         </div>

        //         <div className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-3">
        //             <Button color="blue" type="button" onClick={onFinalSave} disabled={!canFinalSave || submitting}>
        //                 {submitting ? "กำลังบันทึก..." : "บันทึก"}
        //             </Button>
        //         </div>
        //     </CardFooter>
        // </section>
    );
}
