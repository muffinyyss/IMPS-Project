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
import { useRouter, useSearchParams } from "next/navigation";


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
    status?: boolean;
};

// async function getStationInfoPublic(stationId: string): Promise<StationPublic> {
//     const url = `${API_BASE}/station/info/public?station_id=${encodeURIComponent(stationId)}`;
//     const res = await fetch(url); // ❌ ไม่ต้องใส่ Authorization
//     if (res.status === 404) throw new Error("Station not found");
//     if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
//     const json = await res.json();
//     return json.station ?? json;
// }
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
    voltage: ["V", "MΩ", "kΩ"] as const,
};
type UnitVoltage = (typeof UNITS.voltage)[number];

type PhotoItem = {
    id: string;
    file?: File;
    preview?: string;
    remark?: string;
    uploading?: boolean;
    error?: string;
};

type Question =
    | { no: number; key: `r${number}`; label: string; kind: "simple"; hasPhoto?: boolean }
    | { no: 17; key: "r17"; label: string; kind: "measure"; hasPhoto?: boolean };

const VOLTAGE1_FIELDS = [
    "L1-L2",
    "L2-L3",
    "L3-L1",
    "L1-N",
    "L2-N",
    "L3-N",
    "L1-G",
    "L2-G",
    "L3-G",
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
const QUESTIONS: Question[] = [
    { no: 1, key: "r1", label: "1) ตรวจสอบสภาพทั่วไป", kind: "simple", hasPhoto: true },
    { no: 2, key: "r2", label: "2) ตรวจสอบดักซีล,ซิลิโคนกันซึม", kind: "simple", hasPhoto: true },
    { no: 3, key: "r3", label: "3) ตรวจสอบสายอัดประจุ", kind: "simple", hasPhoto: true },
    { no: 4, key: "r4", label: "4) ตรวจสอบหัวจ่ายอัดประจุ", kind: "simple", hasPhoto: true },
    { no: 5, key: "r5", label: "5) ตรวจสอบปุ่มหยุดฉุกเฉิน", kind: "simple", hasPhoto: true },

    { no: 6, key: "r6", label: "6) ตรวจสอบ QR CODE", kind: "simple", hasPhoto: true },
    { no: 7, key: "r7", label: "7) ป้ายเตือนระวังไฟฟ้าช็อก", kind: "simple", hasPhoto: true },

    { no: 8, key: "r8", label: "8) ป้ายเตือนต้องการระบายอากาศ", kind: "simple", hasPhoto: true },
    { no: 9, key: "r9", label: "9) ป้ายเตือนปุ่มฉุกเฉิน", kind: "simple", hasPhoto: true },
    { no: 10, key: "r10", label: "10) วัดแรงดันวงจรควบคุมการอัดประจุ", kind: "simple", hasPhoto: true },

    { no: 11, key: "r11", label: "11) ตรวจสอบแผ่นกรองระบายอากาศ", kind: "simple", hasPhoto: true },
    { no: 12, key: "r12", label: "12) ตรวจสอบจุดต่อทางไฟฟ้า", kind: "simple", hasPhoto: true },

    { no: 13, key: "r13", label: "13) ตรวจสอบคอนแทคเตอร์", kind: "simple", hasPhoto: true },
    { no: 14, key: "r14", label: "14) ตรวจสอบอุปกรณ์ป้องกันไฟกระชาก", kind: "simple", hasPhoto: true },
    { no: 15, key: "r15", label: "15) ตรวจสอบแรงดันไฟฟ้าที่พิน CP", kind: "simple", hasPhoto: true },
    { no: 16, key: "r16", label: "16) ตรวจสอบลำดับเฟส", kind: "simple", hasPhoto: true },

    { no: 17, key: "r17", label: "17) วัดแรงดันไฟฟ้าด้านเข้า", kind: "measure", hasPhoto: true },

    { no: 18, key: "r18", label: "18) ทดสอบการอัดประจุ", kind: "simple", hasPhoto: true },
    { no: 19, key: "r19", label: "19) ทำความสะอาด", kind: "simple", hasPhoto: true },
];

/* เฉพาะข้อ 17 ที่มีชุดวัดค่า */
const FIELD_GROUPS: Record<
    number,
    | { keys: readonly string[]; unitType: "voltage"; note?: string }
    | undefined
> = {
    17: { keys: VOLTAGE1_FIELDS, unitType: "voltage" },
};

/* =========================
 *        TYPES
 * ========================= */
type MeasureRow<U extends string> = { value: string; unit: U };
type MeasureState<U extends string> = Record<string, MeasureRow<U>>;
type PF = "PASS" | "FAIL" | "NA" | "";
// type YesNo = "YES" | "NO" | "";


type CheckListProps = {
    onComplete: (status: boolean) => void;
    onNext: () => void;
    onPrev?: () => void;
};

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

type PassFailRowProps = {
    label: string;
    value: string;
    onChange: (v: string) => void;
    remark: string;
    onRemarkChange: (v: string) => void;
    aboveRemark?: React.ReactNode;   // 👈 เพิ่มบรรทัดนี้
};


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

        // <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
        //     {(title || subtitle) && (
        //         <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
        //             {title && <Typography variant="h6">{title}</Typography>}
        //             {subtitle && (
        //                 <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">
        //                     {subtitle}
        //                 </Typography>
        //             )}
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
    label,
    value,
    unit,
    units,
    onValueChange,
    onUnitChange,
    
}: {
    label: string;
    value: string;
    unit: U;
    units: readonly U[];
    onValueChange: (v: string) => void;
    onUnitChange: (u: U) => void;
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


function PhotoMultiInput({
    label,
    photos,
    setPhotos,
    max = 3,
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
        //         <Button size="sm" color="blue" variant="outlined" onClick={handlePick}>
        //             แนบรูป / ถ่ายรูป
        //         </Button>
        //         <Typography variant="small" className="!tw-text-blue-gray-500 tw-flex tw-items-center">
        //             แนบได้สูงสุด {max} รูป • รองรับการถ่ายจากกล้องบนมือถือ
        //         </Typography>
        //     </div>

        //     <input
        //         ref={fileRef}
        //         type="file"
        //         accept="image/*"
        //         multiple
        //         capture="environment"
        //         className="tw-hidden"
        //         onChange={(e) => handleFiles(e.target.files)}
        //     />

        //     {photos.length > 0 ? (
        //         <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
        //             {photos.map((p) => (
        //                 <div
        //                     key={p.id}
        //                     className="tw-border tw-rounded-lg tw-overflow-hidden tw-bg-white tw-shadow-xs tw-flex tw-flex-col"
        //                 >
        //                     <div className="tw-relative tw-aspect-[4/3] tw-bg-blue-gray-50">
        //                         {p.preview && (
        //                             <img src={p.preview} alt="preview" className="tw-w-full tw-h-full tw-object-cover" />
        //                         )}
        //                     </div>
        //                     <div className="tw-p-2 tw-space-y-2">
        //                         <div className="tw-flex tw-justify-end">
        //                             <Button size="sm" color="red" variant="text" onClick={() => handleRemove(p.id)}>
        //                                 ลบรูป
        //                             </Button>
        //                         </div>
        //                     </div>
        //                 </div>
        //             ))}
        //         </div>
        //     ) : (
        //         <Typography variant="small" className="!tw-text-blue-gray-500">
        //             ยังไม่มีรูปแนบ
        //         </Typography>
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

const PM_TYPE_CODE = "CG";

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
    const u = new URL(`${API_BASE}/pmreport/list`);
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
// export default function ChargerPMForm({ onComplete }: CheckListProps) {
export default function ChargerPMForm() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    const searchParams = useSearchParams();
    const editId = searchParams.get("edit_id") ?? "";
    const isEdit = !!editId;
    const headerLabel = useMemo(() => (editId ? "PM Report (Edit)" : "PM Report (Add)"), [editId]);

    /* ---------- photos per question ---------- */
    const initialPhotos: Record<number, PhotoItem[]> = Object.fromEntries(
        QUESTIONS.filter((q) => q.hasPhoto).map((q) => [q.no, [] as PhotoItem[]])
    ) as Record<number, PhotoItem[]>;
    const [photos, setPhotos] = useState<Record<number, PhotoItem[]>>(initialPhotos);

    // ค่า CP ของข้อ 15 (ช่องเดียว หน่วย V)
    const [cp, setCp] = useState<{ value: string; unit: UnitVoltage }>({ value: "", unit: "V" });
    const [summary, setSummary] = useState<string>("");

    const [stationId, setStationId] = useState<string | null>(null);
    const [draftId, setDraftId] = useState<string | null>(null);
    const [summaryCheck, setSummaryCheck] = useState<PF>("");
    // const [dustFilterChanged, setDustFilterChanged] = useState<YesNo>("");
    // const key = useMemo(() => draftKey(stationId), [stationId]);
    // ใหม่
    const key = useMemo(
        () => `${draftKey(stationId)}:${draftId ?? "default"}`,
        [stationId, draftId]
    );


    /* ---------- job info ---------- */
    const [job, setJob] = useState({
        issue_id: "",
        chargerNo: "",
        sn: "",
        model: "",
        brand: "",
        station_name: "",
        date: "",
        inspector: "",
    });

    /* ---------- PASS/FAIL + remark ---------- */
    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(
        Object.fromEntries(QUESTIONS.map((q) => [q.key, { pf: "", remark: "" }])) as Record<
            string,
            { pf: PF; remark: string }
        >
    );

    /* ---------- measure group (เฉพาะข้อ 17) ---------- */
    const m17 = useMeasure<UnitVoltage>(VOLTAGE1_FIELDS, "V");

    // useEffect(() => {
    //     if (!stationId || !job.date ) return; // ถ้ามีใน draft แล้วจะไม่ทับ

    //     let canceled = false;
    //     (async () => {
    //         try {
    //             const latest = await fetchLatestIssueIdFromList(stationId, job.date);
    //             const next = nextIssueIdFor(PM_TYPE_CODE, job.date, latest || "");
    //             if (!canceled) setJob(prev => ({ ...prev }));
    //         } catch {
    //             const fallback = nextIssueIdFor(PM_TYPE_CODE, job.date, "");
    //             if (!canceled) setJob(prev => ({ ...prev }));
    //         }
    //     })();

    //     return () => { canceled = true; };
    // }, [stationId, job.date]);

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
                    brand: st.brand ?? prev.brand,
                    station_name: st.station_name ?? prev.station_name,
                    date: prev.date || new Date().toISOString().slice(0, 10),
                }));
            })
            .catch((err) => console.error("load public station info failed:", err));
    }, []);

    useEffect(() => {
        if (!stationId) return;
        const draft = loadDraftLocal<{
            job: typeof job;
            rows: typeof rows;
            cp: typeof cp;
            m17: typeof m17.state;
            summary: string;
            // dustFilterChanged: YesNo;
        }>(key);
        if (!draft) return;

        setJob((prev) => ({ ...prev, ...draft.job }));
        setRows(draft.rows);
        setCp(draft.cp);
        m17.setState(draft.m17);
        setSummary(draft.summary);
        // setDustFilterChanged(draft.dustFilterChanged ?? "");

    }, [stationId]); // โหลดครั้งเดียวเมื่อรู้ stationId

    useEffect(() => {
        const onInfo = (e: Event) => {
            const detail = (e as CustomEvent).detail as { info?: StationPublic; station?: StationPublic };
            const st = detail.info ?? detail.station;
            if (!st) return;
            setJob((prev) => ({
                ...prev,
                sn: st.SN ?? prev.sn,
                model: st.model ?? prev.model,
                brand: st.brand ?? prev.brand,
            }));
        };
        window.addEventListener("station:info", onInfo as EventListener);
        return () => window.removeEventListener("station:info", onInfo as EventListener);
    }, []);




    const makePhotoSetter =
        (no: number): React.Dispatch<React.SetStateAction<PhotoItem[]>> =>
            (action) => {
                setPhotos((prev) => {
                    const current = prev[no] || [];
                    const next = typeof action === "function" ? (action as (x: PhotoItem[]) => PhotoItem[])(current) : action;
                    return { ...prev, [no]: next };
                });
            };

    const REQUIRED_PHOTO_ITEMS = useMemo(
        () => QUESTIONS.filter((q) => q.hasPhoto).map((q) => q.no).sort((a, b) => a - b),
        []
    );
    const missingPhotoItems = useMemo(
        () => REQUIRED_PHOTO_ITEMS.filter((no) => (photos[no]?.length ?? 0) < 1),
        [REQUIRED_PHOTO_ITEMS, photos]
    );
    const allPhotosAttached = missingPhotoItems.length === 0;




    const MEASURE_BY_NO: Record<number, ReturnType<typeof useMeasure<UnitVoltage>> | undefined> = {
        17: m17,
    };

    /* ---------- validations ---------- */
    // ต้องตอบ PASS/FAIL ครบทุกข้อยกเว้น r17 (เป็นชุดวัดค่า)
    const PF_REQUIRED_KEYS = useMemo(() => QUESTIONS.filter((q) => q.key !== "r17").map((q) => q.key), []);
    // ตอบอะไรก็ได้ที่ไม่ว่าง: PASS/FAIL/NA
    const allPFAnswered = useMemo(
        () => PF_REQUIRED_KEYS.every((k) => rows[k].pf !== ""),
        [rows, PF_REQUIRED_KEYS]
    );
    const missingPFItems = useMemo(
        () =>
            PF_REQUIRED_KEYS.filter((k) => !rows[k].pf)
                .map((k) => Number(k.replace("r", "")))
                .sort((a, b) => a - b),
        [rows, PF_REQUIRED_KEYS]
    );

    // อินพุตที่บังคับ: เฉพาะข้อ 17
    const missingInputs = useMemo(() => {
        const r: Record<number, string[]> = {};
        r[15] = cp.value.trim() ? [] : ["CP"];
        r[17] = VOLTAGE1_FIELDS.filter((k) => !m17.state[k]?.value?.toString().trim());
        return r;
    }, [cp.value, m17.state]);


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

    const canFinalSave =
        allPhotosAttached &&
        allPFAnswered &&
        allRequiredInputsFilled &&
        isSummaryFilled;


    // useEffect(() => {
    //     onComplete(allPFAnswered);
    // }, [allPFAnswered, onComplete]);

    /* ---------- unit sync ---------- */
    const handleUnitChange = (no: number, key: string, u: UnitVoltage) => {
        const m = MEASURE_BY_NO[no];
        if (!m) return;
        const firstKey = (FIELD_GROUPS[no]?.keys ?? [key])[0] as string;
        if (key !== firstKey) m.patch(firstKey, { unit: u });
        m.syncUnits(u);
    };

    /* ---------- renderers ---------- */
    const renderMeasureGrid = (no: number) => {
        const cfg = FIELD_GROUPS[no];
        const m = MEASURE_BY_NO[no];
        if (!cfg || !m) return null;

        return (
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
        );
    };

    const renderQuestionBlock = (q: Question) => {
        const hasMeasure = q.kind === "measure" && FIELD_GROUPS[q.no];
        const subtitle = FIELD_GROUPS[q.no]?.note;

        return (
            <SectionCard key={q.key} title={q.label} subtitle={subtitle}>
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
                    aboveRemark={
                        q.hasPhoto && (
                            <div className="tw-pt-2 tw-pb-4 tw-border-b tw-mb-8 tw-border-blue-gray-50">
                                <PhotoMultiInput
                                    label={`แนบรูปประกอบ (ข้อ ${q.no})`}
                                    photos={photos[q.no] || []}
                                    setPhotos={makePhotoSetter(q.no)}
                                    max={3}
                                />
                            </div>
                        )
                    }
                />

                {hasMeasure && renderMeasureGrid(q.no)}

                {q.no === 15 && (
                    <div className="tw-pt-1 tw-space-y-2">
                        <div className="tw-max-w-xs">
                            <InputWithUnit<UnitVoltage>
                                label="CP"
                                value={cp.value}
                                unit={cp.unit}
                                units={["V"] as const}
                                onValueChange={(v) => setCp((s) => ({ ...s, value: v }))}
                                onUnitChange={(u) => setCp((s) => ({ ...s, unit: u }))}
                            />
                        </div>
                    </div>
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

    // เรียกใช้ – เก็บเฉพาะข้อมูลที่ serialize ได้
    useDebouncedEffect(() => {
        if (!stationId) return;
        saveDraftLocal(key, {
            job,
            rows,
            cp,
            m17: m17.state,
            summary,
            // dustFilterChanged,
        });
    }, [key, stationId, job, rows, cp, m17.state, summary]);

    /* ---------- actions ---------- */
    // const onSave = () => {
    //     console.log({
    //         job,
    //         rows,
    //         cp,
    //         m17: m17.state,
    //         photos,
    //         summary
    //     });
    //     alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
    // };
    const onSave = () => {
        if (!stationId) {
            alert("ยังไม่ทราบ station_id — บันทึกชั่วคราวไม่สำเร็จ");
            return;
        }
        // เซฟดราฟต์ (ซ้ำกับ auto-save ก็ได้ เพื่อความชัวร์ตอนกดปุ่ม)
        saveDraftLocal(key, {
            job,
            rows,
            cp,
            m17: m17.state,
            summary,
        });
        alert("บันทึกชั่วคราวไว้ในเครื่องแล้ว (Offline Draft)");
    };

    async function uploadGroupPhotos(
        reportId: string,
        stationId: string,
        group: string,            // เช่น "g1", "g2", ...
        files: File[]
    ) {
        const form = new FormData();
        form.append("station_id", stationId);
        form.append("group", group);
        // ถ้ามีหมายเหตุรวมใส่ได้ (ตอนนี้ UI ยังไม่มี)
        // form.append("remark", "...");

        files.forEach((f) => form.append("files", f)); // ชื่อ field ใน back คือ "files"

        const token = localStorage.getItem("access_token");
        const res = await fetch(`${API_BASE}/pmreport/${reportId}/photos`, {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: form,                 // ⛔ ห้ามใส่ Content-Type เอง
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
            const pm_date = job.date?.trim() || ""; // เก็บเป็น YYYY-MM-DD ตามที่กรอก

            const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
            const payload = {
                station_id: stationId,
                issue_id: issueIdFromJob,                // authoritative (ระดับบนสุด)
                job: jobWithoutIssueId,                  // ไม่มี issue_id แล้ว
                rows,
                measures: { m17: m17.state, cp },
                summary,
                pm_date,
                ...(summaryCheck ? { summaryCheck } : {}), // จากเคสก่อนหน้า
                // ...(dustFilterChanged ? { dustFilterChanged } : {}),
            };

            // 1) สร้างรายงาน (submit)
            const res = await fetch(`${API_BASE}/pmreport/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: "include",
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const { report_id } = await res.json();

            // 2) อัปโหลดรูปทั้งหมด แปลงเลขข้อเป็น group "g{no}"
            const photoNos = Object.keys(photos).map(n => Number(n));
            for (const no of photoNos) {
                const list = photos[no] || [];
                if (list.length === 0) continue;
                const files = list.map(p => p.file!).filter(Boolean) as File[];
                if (files.length === 0) continue;
                await uploadGroupPhotos(report_id, stationId, `g${no}`, files);
            }

            // 3) finalize (ออปชัน)
            const fin = await fetch(`${API_BASE}/pmreport/${report_id}/finalize`, {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                credentials: "include",
                body: new URLSearchParams({ station_id: stationId }), // endpoint นี้รับ Form-encoded
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

    /* =========================
     *        RENDER
     * ========================= */
    return (
        // <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
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
                        {/* ซ้าย: โลโก้ + ข้อความ */}
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
                                    Preventive Maintenance Checklist - เครื่องอัดประจุไฟฟ้า
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
                                    label="brand / ยี่ห้อ"
                                    value={job.brand}
                                    onChange={(e) => setJob({ ...job, brand: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-bg-blue-gray-50"
                                />
                            </div>
                            <div className="lg:tw-col-span-2">
                                <Input
                                    label="Model / รุ่น"
                                    value={job.model}
                                    onChange={(e) => setJob({ ...job, model: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-bg-blue-gray-50"
                                />
                            </div>

                            <div className="lg:tw-col-span-2">
                                <Input
                                    label="SN / หมายเลขเครื่อง"
                                    value={job.sn}
                                    onChange={(e) => setJob({ ...job, sn: e.target.value })}
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

                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            <div className="sm:tw-col-span-2 lg:tw-col-span-3">
                                <div className="lg:tw-col-span-2">
                                    <Input
                                        label="เครื่องประจุไฟฟ้าที่"
                                        value={job.chargerNo}
                                        onChange={(e) => setJob({ ...job, chargerNo: e.target.value })}
                                        crossOrigin=""
                                        readOnly
                                        containerProps={{ className: "!tw-min-w-0" }}
                                        className="!tw-bg-blue-gray-50"
                                    />
                                </div>
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
                    <CardFooter className="tw-flex tw-flex-col tw-gap-3 tw-mt-8">
                        <div
                            className={`tw-rounded-lg tw-border tw-p-3 ${allPFAnswered ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"
                                }`}
                        >
                            <Typography className="tw-font-medium">
                                1) สถานะ PASS / FAIL / N/A ทั้ง 18 ข้อ (ยกเว้นข้อ 17)
                            </Typography>
                            {allPFAnswered ? (
                                <Typography variant="small" className="!tw-text-green-700">
                                    ครบเรียบร้อย ✅
                                </Typography>
                            ) : (
                                <Typography variant="small" className="!tw-text-amber-700">
                                    ยังไม่ได้เลือกข้อ: {missingPFItems.join(", ")}
                                </Typography>
                            )}
                        </div>

                        <div
                            className={`tw-rounded-lg tw-border tw-p-3 ${allRequiredInputsFilled ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"
                                }`}
                        >
                            <Typography className="tw-font-medium">2) อินพุตข้อ 15 และ 17</Typography>
                            {allRequiredInputsFilled ? (
                                <Typography variant="small" className="!tw-text-green-700">
                                    ครบเรียบร้อย ✅
                                </Typography>
                            ) : (
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
                            )}
                        </div>

                        <div
                            className={`tw-rounded-lg tw-border tw-p-3 ${allPhotosAttached ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"
                                }`}
                        >
                            <Typography className="tw-font-medium">3) ตรวจสอบการแนบรูปภาพ (ทุกข้อ)</Typography>
                            {allPhotosAttached ? (
                                <Typography variant="small" className="!tw-text-green-700">
                                    ครบเรียบร้อย ✅
                                </Typography>
                            ) : (
                                <Typography variant="small" className="!tw-text-amber-700">
                                    ยังไม่ได้แนบรูปข้อ: {missingPhotoItems.join(", ")}
                                </Typography>
                            )}
                        </div>

                        <div
                            className={`tw-rounded-lg tw-border tw-p-3 ${isSummaryFilled ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"
                                }`}
                        >
                            <Typography className="tw-font-medium">4) สรุปผลการตรวจสอบ</Typography>
                            {isSummaryFilled ? (
                                <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                            ) : (
                                <Typography variant="small" className="!tw-text-amber-700">ยังไม่ได้กรอกสรุปผลการตรวจสอบ</Typography>
                            )}
                        </div>


                        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-end tw-gap-3">
                            {!canFinalSave ? (
                                <Button
                                    variant="outlined"
                                    color="blue-gray"
                                    type="button"
                                    onClick={onSave}
                                    title={
                                        !allPhotosAttached
                                            ? `ต้องแนบรูปให้ครบก่อน → ข้อที่ยังขาด: ${missingPhotoItems.join(", ")}`
                                            : "บันทึกชั่วคราว"
                                    }
                                >
                                    บันทึกชั่วคราว
                                </Button>
                            ) : (
                                // <Button color="blue" type="button" onClick={onFinalSave}>
                                //     บันทึก
                                // </Button>
                                <Button color="blue" type="button" onClick={onFinalSave} disabled={submitting}>
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

