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
function PassFailRow({
    label, value, onChange, remark, onRemarkChange, labels,
}: {
    label: string;
    value: PF;
    onChange: (v: Exclude<PF, "">) => void;
    remark?: string;
    onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>; // ⬅️ เพิ่ม
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
                    <Button size="sm" color="green" variant={value === "PASS" ? "filled" : "outlined"}
                        className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]" onClick={() => onChange("PASS")}>
                        {text.PASS}
                    </Button>
                    <Button size="sm" color="red" variant={value === "FAIL" ? "filled" : "outlined"}
                        className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]" onClick={() => onChange("FAIL")}>
                        {text.FAIL}
                    </Button>
                    <Button size="sm" color="blue-gray" variant={value === "NA" ? "filled" : "outlined"}
                        className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]" onClick={() => onChange("NA")}>
                        {text.NA}
                    </Button>
                </div>
            </div>

            {onRemarkChange && (
                <div className="tw-w-full tw-min-w-0">
                    <Textarea label="หมายเหตุ (ถ้ามี)" value={remark || ""} onChange={(e) => onRemarkChange(e.target.value)}
                        containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full" />
                </div>
            )}
        </div>
    );
}

// function YesNoRow({
//     label,
//     value,
//     onChange,
// }: {
//     label: string;
//     value: YesNo;
//     onChange: (v: Exclude<YesNo, "">) => void;
// }) {
//     return (
//         <div className="tw-space-y-3 tw-py-2">
//             <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">
//                 <Typography className="tw-font-medium">{label}</Typography>
//                 <div className="tw-flex tw-gap-2 tw-w-full sm:tw-w-auto">
//                     <Button
//                         size="sm"
//                         color="green"
//                         variant={value === "YES" ? "filled" : "outlined"}
//                         className="tw-w-1/2 sm:tw-w-auto sm:tw-min-w-[84px]"
//                         onClick={() => onChange("YES")}
//                     >
//                         Yes
//                     </Button>
//                     <Button
//                         size="sm"
//                         color="red"
//                         variant={value === "NO" ? "filled" : "outlined"}
//                         className="tw-w-1/2 sm:tw-w-auto sm:tw-min-w-[84px]"
//                         onClick={() => onChange("NO")}
//                     >
//                         No
//                     </Button>
//                 </div>
//             </div>
//         </div>
//     );
// }

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
        <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
            {(title || subtitle) && (
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    {title && <Typography variant="h6">{title}</Typography>}
                    {subtitle && (
                        <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">
                            {subtitle}
                        </Typography>
                    )}
                </CardHeader>
            )}
            <CardBody className="tw-space-y-4">{children}</CardBody>
        </Card>
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
    max = 20,
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
        <div className="tw-space-y-3">
            {label && <Typography className="tw-font-medium">{label}</Typography>}

            <div className="tw-flex tw-flex-wrap tw-gap-2">
                <Button size="sm" color="blue" variant="outlined" onClick={handlePick}>
                    แนบรูป / ถ่ายรูป
                </Button>
                <Typography variant="small" className="!tw-text-blue-gray-500 tw-flex tw-items-center">
                    แนบได้สูงสุด {max} รูป • รองรับการถ่ายจากกล้องบนมือถือ
                </Typography>
            </div>

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
                                    <img src={p.preview} alt="preview" className="tw-w-full tw-h-full tw-object-cover" />
                                )}
                            </div>
                            <div className="tw-p-2 tw-space-y-2">
                                <div className="tw-flex tw-justify-end">
                                    <Button size="sm" color="red" variant="text" onClick={() => handleRemove(p.id)}>
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
                    onChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })}
                    remark={rows[q.key].remark}
                    onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })}
                />

                {/* {q.no === 11 && (
                    <YesNoRow
                        label="เปลี่ยน dust filter"
                        value={dustFilterChanged}
                        onChange={(v) => setDustFilterChanged(v)}
                    />
                )} */}

                {hasMeasure && renderMeasureGrid(q.no)}

                {/* แสดงช่องกรอก CP เฉพาะข้อ 15 */}
                {q.no === 15 && (
                    <div className="tw-pt-1 tw-space-y-2">
                        {/* <Typography variant="small" className="!tw-text-blue-gray-600 tw-font-medium">
                            ค่าที่วัด
                        </Typography> */}
                        <div className="tw-max-w-xs">
                            <InputWithUnit<UnitVoltage>
                                label="CP"
                                value={cp.value}
                                unit={cp.unit}
                                units={["V"] as const} // ล็อกให้เลือกได้เฉพาะ V
                                onValueChange={(v) => setCp((s) => ({ ...s, value: v }))}
                                onUnitChange={(u) => setCp((s) => ({ ...s, unit: u }))}
                            />
                        </div>
                    </div>
                )}

                {q.hasPhoto && (
                    <div className="tw-pt-2 tw-pb-4 tw-border-t tw-border-blue-gray-50">
                        <PhotoMultiInput
                            label={`แนบรูปประกอบ (ข้อ ${q.no})`}
                            photos={photos[q.no] || []}
                            setPhotos={makePhotoSetter(q.no)}
                            max={20}
                        />
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
                                    การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)<br />
                                    เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย<br />
                                    จังหวัดนนทบุรี 11130 ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* BODY */}
                    {/* <div className="tw-mt-8 tw-space-y-8">
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
                                    label="เครื่องประจุไฟฟ้าที่"
                                    value={job.chargerNo}
                                    onChange={(e) => setJob({ ...job, chargerNo: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-bg-blue-gray-50"
                                />
                            </div>

                            <div className="lg:tw-col-span-2">
                                <Input
                                    label="brand / ยี่ห้อ"
                                    value=""
                                    onChange={(e) => setJob({ ...job, date: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-bg-blue-gray-50"
                                />
                            </div>

                            <div className="lg:tw-col-span-1">
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

                            <div className="lg:tw-col-span-1">
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
                    </div> */}
                    <SectionCard title="ข้อมูลงาน" subtitle="กรุณากรอกทุกช่องให้ครบ เพื่อความสมบูรณ์ของรายงาน PM">
                        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">


                            <Input
                                label="Issue id"
                                value={job.issue_id || "-"}
                                readOnly
                                // key={job.issue_id}  // บังคับให้รี-mount เมื่อค่าเปลี่ยน
                                crossOrigin=""
                                containerProps={{ className: "!tw-min-w-0" }}
                                className="!tw-w-full !tw-bg-blue-gray-50"
                            />
                            <Input
                                label="เครื่องประจุไฟฟ้าที่"
                                value={job.chargerNo}
                                onChange={(e) => setJob({ ...job, chargerNo: e.target.value })}
                                crossOrigin=""
                                readOnly
                                className="!tw-bg-blue-gray-50"
                            />
                            <Input
                                label="Location / สถานที่"
                                value={job.station_name}
                                onChange={(e) => setJob({ ...job, station_name: e.target.value })}
                                crossOrigin=""
                                className="!tw-bg-blue-gray-50"
                                readOnly
                            />

                            <Input
                                label="SN / หมายเลขเครื่อง"
                                value={job.sn}
                                onChange={(e) => setJob({ ...job, sn: e.target.value })}
                                crossOrigin=""
                                className="!tw-bg-blue-gray-50"
                                readOnly
                            />
                            <Input
                                label="Model / รุ่น"
                                value={job.model}
                                onChange={(e) => setJob({ ...job, model: e.target.value })}
                                crossOrigin=""
                                className="!tw-bg-blue-gray-50"
                                readOnly
                            />
                            <Input
                                label="วันที่ตรวจ"
                                type="date"
                                value={job.date}
                                onChange={(e) => setJob({ ...job, date: e.target.value })}
                                crossOrigin=""
                            />
                        </div>
                    </SectionCard>

                    {[
                        [1, 5],
                        [6, 10],
                        [11, 16],
                        [17, 17], // มีกริดวัดค่า
                        [18, 19],
                    ].map(([start, end]) => (
                        <Card key={`${start}-${end}`} className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                            {start === 1 && (
                                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                                    <Typography variant="h6">Checklist</Typography>
                                </CardHeader>
                            )}
                            <CardBody className="tw-space-y-1">
                                {QUESTIONS.filter((q) => q.no >= start && q.no <= end).map(renderQuestionBlock)}
                            </CardBody>
                        </Card>
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

                </div>




            </form>
            {/* Job Info */}
            <SectionCard title="ข้อมูลงาน" subtitle="กรุณากรอกทุกช่องให้ครบ เพื่อความสมบูรณ์ของรายงาน PM">
                <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">


                    <Input
                        label="Issue id"
                        value={job.issue_id || "-"}
                        readOnly
                        // key={job.issue_id}  // บังคับให้รี-mount เมื่อค่าเปลี่ยน
                        crossOrigin=""
                        containerProps={{ className: "!tw-min-w-0" }}
                        className="!tw-w-full !tw-bg-blue-gray-50"
                    />
                    <Input
                        label="เครื่องประจุไฟฟ้าที่"
                        value={job.chargerNo}
                        onChange={(e) => setJob({ ...job, chargerNo: e.target.value })}
                        crossOrigin=""
                        readOnly
                        className="!tw-bg-blue-gray-50"
                    />
                    <Input
                        label="Location / สถานที่"
                        value={job.station_name}
                        onChange={(e) => setJob({ ...job, station_name: e.target.value })}
                        crossOrigin=""
                        className="!tw-bg-blue-gray-50"
                        readOnly
                    />

                    <Input
                        label="SN / หมายเลขเครื่อง"
                        value={job.sn}
                        onChange={(e) => setJob({ ...job, sn: e.target.value })}
                        crossOrigin=""
                        className="!tw-bg-blue-gray-50"
                        readOnly
                    />
                    <Input
                        label="Model / รุ่น"
                        value={job.model}
                        onChange={(e) => setJob({ ...job, model: e.target.value })}
                        crossOrigin=""
                        className="!tw-bg-blue-gray-50"
                        readOnly
                    />
                    <Input
                        label="วันที่ตรวจ"
                        type="date"
                        value={job.date}
                        onChange={(e) => setJob({ ...job, date: e.target.value })}
                        crossOrigin=""
                    />
                </div>
            </SectionCard>



            {/* จัดช่วงการเรนเดอร์เป็นบล็อก ๆ */}
            {[
                [1, 5],
                [6, 10],
                [11, 16],
                [17, 17], // มีกริดวัดค่า
                [18, 19],
            ].map(([start, end]) => (
                <Card key={`${start}-${end}`} className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                    {start === 1 && (
                        <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                            <Typography variant="h6">Checklist</Typography>
                        </CardHeader>
                    )}
                    <CardBody className="tw-space-y-1">
                        {QUESTIONS.filter((q) => q.no >= start && q.no <= end).map(renderQuestionBlock)}
                    </CardBody>
                </Card>
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

            {/* Summary & Actions */}
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
        </section>
    );
}


// "use client";

// import React, { useMemo, useState, useEffect } from "react";
// import { Button, Input, Textarea } from "@material-tailwind/react";
// import Image from "next/image";
// import { useRouter, useSearchParams } from "next/navigation";

// type Severity = "" | "Low" | "Medium" | "High" | "Critical";
// // type Status = "" | "Open" | "In Progress" | "Closed";
// type Status = "" | "Open" | "In Progress";

// type CorrectiveItem = {
//     text: string;
//     images: { file: File; url: string }[];
// };

// type Job = {
//     issue_id: string;
//     found_date: string;
//     location: string;
//     wo: string;
//     sn: string;
//     equipment_list: string[];
//     problem_details: string;
//     problem_type: string;
//     severity: Severity;
//     reported_by: string[];
//     assignee: string;
//     initial_cause: string;
//     corrective_actions: CorrectiveItem[];
//     resolved_date: string;
//     repair_result: RepairOption | "";
//     preventive_action: string[];
//     status: Status;
//     remarks: string;
// };

// type RepairOption = typeof REPAIR_OPTIONS[number];

// const REPAIR_OPTIONS = [
//     "แก้ไขสำเร็จ",
//     "แก้ไขไม่สำเร็จ",
//     "อยู่ระหว่างการติดตามผล",
//     "อยู่ระหว่างการรออะไหล่",
// ] as const;
// const STATUS_LABEL: Record<Exclude<Status, "">, string> = {
//     Open: "Open",
//     "In Progress": "In Progress",
//     // Closed: "Closed",
// };

// const SEVERITY_OPTIONS: Severity[] = ["", "Low", "Medium", "High", "Critical"];
// // const STATUS_OPTIONS: Status[] = ["", "Open", "In Progress", "Closed"];
// // const STATUS_OPTIONS: Status[] = ["", "Open"];


// const LOGO_SRC = "/img/logo_egat.png";
// const LIST_ROUTE = "/dashboard/cm-report";

// /* ค่าตั้งต้นของฟอร์ม (ใช้สำหรับ reset ด้วย) */
// const INITIAL_JOB: Job = {
//     issue_id: "",
//     found_date: "",
//     location: "",
//     wo: "",
//     sn: "",
//     equipment_list: [""],
//     problem_details: "",
//     problem_type: "",
//     severity: "",
//     reported_by: [""],
//     assignee: "",
//     initial_cause: "",
//     corrective_actions: [{ text: "", images: [] }],
//     resolved_date: "",
//     repair_result: "",
//     preventive_action: [""],
//     status: "",
//     remarks: "",
// };

// type StationPublic = {
//     station_id: string;
//     station_name: string;
//     SN?: string;
//     WO?: string;
//     chargeBoxID?: string;
//     model?: string;
//     status?: boolean;
// };

// const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// export default function ChargerPMForm() {
//     const router = useRouter();
//     const searchParams = useSearchParams();                  // 👈
//     // const stationId = searchParams.get("station_id");
//     const [stationId, setStationId] = useState<string | null>(null);

//     const editId = searchParams.get("edit_id") ?? "";
//     const isEdit = !!editId;

//     useEffect(() => {
//         const sidFromUrl = searchParams.get("station_id");
//         if (sidFromUrl) {
//             setStationId(sidFromUrl);
//             localStorage.setItem("selected_station_id", sidFromUrl);
//             return;
//         }
//         const sidLocal = localStorage.getItem("selected_station_id");
//         setStationId(sidLocal);
//     }, [searchParams]);

//     const STATUS_OPTIONS = useMemo<Status[]>(
//         () => (isEdit ? ["", "Open", "In Progress"] : ["", "Open"]),
//         [isEdit]
//     );

//     // ด้านบนใน component (ใต้ const stationId = ... ได้เลย)
//     const buildListUrl = () => {
//         const params = new URLSearchParams();
//         if (stationId) params.set("station_id", stationId);
//         const tab = (searchParams.get("tab") ?? "open"); // กลับแท็บเดิม (default = open)
//         params.set("tab", tab);
//         return `${LIST_ROUTE}?${params.toString()}`;
//     };

//     const [job, setJob] = useState<Job>({ ...INITIAL_JOB });
//     const [summary, setSummary] = useState<string>("");
//     const [saving, setSaving] = useState(false);


//     // เดิม header อิง label/type; ตอนนี้คงไว้เป็นค่าคงที่กลาง
//     // const headerLabel = useMemo(() => "CM Report", []);
//     const headerLabel = useMemo(() => (editId ? "PM Report (Edit)" : "PM Report (Add)"), [editId]);


//     const onSave = () => {
//         console.log({ job, summary });
//         alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
//     };


//     // const onFinalSave = async () => {
//     //     try {
//     //         if (!stationId) {
//     //             alert("ไม่พบ station_id ใน URL");
//     //             return;
//     //         }
//     //         setSaving(true);

//     //         // 1) สร้างรายงานหลัก
//     //         const payload = {
//     //             station_id: stationId,
//     //             cm_date: (job.found_date || "").slice(0, 10),
//     //             summary,
//     //             job: {
//     //                 ...job,
//     //                 // ฝั่งหลักเก็บแค่ชื่อไฟล์ (optional) แต่รูปจริงไปอัปโหลดในขั้นตอนถัดไป
//     //                 corrective_actions: job.corrective_actions.map((c) => ({
//     //                     text: c.text,
//     //                     images: c.images.map((img) => ({ name: img.file?.name ?? "" })),
//     //                 })),
//     //             },
//     //         };

//     //         const res = await fetch(`${API_BASE}/cmreport/submit`, {
//     //             method: "POST",
//     //             headers: { "Content-Type": "application/json" },
//     //             credentials: "include",
//     //             body: JSON.stringify(payload),
//     //         });
//     //         if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

//     //         const { report_id } = await res.json();

//     //         // 2) อัปโหลดรูปตาม group (g1,g2,...) จาก Corrective Action
//     //         await uploadPhotosForReport(report_id);

//     //         // 3) (ถ้าต้องการ) finalize รายงาน
//     //         // await fetch(`${API_BASE}/cmreport/${encodeURIComponent(report_id)}/finalize`, {
//     //         //   method: "POST",
//     //         //   credentials: "include",
//     //         // });

//     //         // 4) กลับหน้า list พร้อมพารามิเตอร์สถานี
//     //         // const listUrl = `${LIST_ROUTE}?station_id=${encodeURIComponent(stationId)}`;
//     //         // router.replace(listUrl);

//     //         const listUrl = buildListUrl();
//     //         router.replace(listUrl);
//     //     } catch (e: any) {
//     //         console.error(e);
//     //         alert(`บันทึกไม่สำเร็จ: ${e.message || e}`);
//     //     } finally {
//     //         setSaving(false);
//     //     }
//     // };

//     const onFinalSave = async () => {
//         try {
//             if (!stationId) {
//                 alert("ไม่พบ station_id ใน URL");
//                 return;
//             }
//             setSaving(true);

//             if (isEdit && editId) {
//                 // 👇 โหมดแก้ไข: อัปเดตสถานะอย่างเดียว
//                 const res = await fetch(
//                     `${API_BASE}/cmreport/${encodeURIComponent(editId)}/status`,
//                     {
//                         method: "PATCH",
//                         headers: { "Content-Type": "application/json" },
//                         credentials: "include",
//                         body: JSON.stringify({
//                             station_id: stationId,
//                             status: job.status || "Open",
//                         }),
//                     }
//                 );
//                 if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);
//             } else {
//                 // 👇 โหมดเพิ่มใหม่: ทำเหมือนเดิม (สร้าง -> อัปโหลดรูป)
//                 const payload = {
//                     station_id: stationId,
//                     cm_date: (job.found_date || "").slice(0, 10),
//                     summary,
//                     job: {
//                         ...job,
//                         corrective_actions: job.corrective_actions.map((c) => ({
//                             text: c.text,
//                             images: c.images.map((img) => ({ name: img.file?.name ?? "" })),
//                         })),
//                     },
//                 };

//                 const res = await fetch(`${API_BASE}/cmreport/submit`, {
//                     method: "POST",
//                     headers: { "Content-Type": "application/json" },
//                     credentials: "include",
//                     body: JSON.stringify(payload),
//                 });
//                 if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

//                 const { report_id } = await res.json();
//                 await uploadPhotosForReport(report_id);
//             }

//             // กลับหน้า list (คง tab/station เดิม)
//             router.replace(buildListUrl());
//         } catch (e: any) {
//             console.error(e);
//             alert(`บันทึกไม่สำเร็จ: ${e.message || e}`);
//         } finally {
//             setSaving(false);
//         }
//     };

//     // const onCancelLocal = () => {
//     //     const evt = new CustomEvent("cmform:cancel", { cancelable: true });
//     //     const wasPrevented = !window.dispatchEvent(evt); // false = มีคนเรียก preventDefault()
//     //     if (!wasPrevented) {
//     //         router.replace(LIST_ROUTE);
//     //     }
//     // };
//     const onCancelLocal = () => {
//         const evt = new CustomEvent("cmform:cancel", { cancelable: true });
//         const wasPrevented = !window.dispatchEvent(evt);
//         if (!wasPrevented) {
//             router.replace(buildListUrl()); // 🔁 กลับไปหน้า list พร้อม station_id & tab
//         }
//     };

//     const handlePrint = () => window.print();

//     /* -------------------- Helpers: ลดความซ้ำซ้อน -------------------- */
//     type StringListKey = "equipment_list" | "preventive_action" | "reported_by";

//     const setStringItem =
//         (key: StringListKey) => (i: number, val: string) =>
//             setJob((prev) => {
//                 const list = [...prev[key]];
//                 list[i] = val;
//                 return { ...prev, [key]: list };
//             });

//     const addStringItem =
//         (key: StringListKey) => () =>
//             setJob((prev) => ({ ...prev, [key]: [...prev[key], ""] }));

//     const removeStringItem =
//         (key: StringListKey) => (i: number) =>
//             setJob((prev) => {
//                 const list = [...prev[key]];
//                 if (list.length <= 1) return { ...prev, [key]: [""] }; // อย่างน้อย 1 ช่อง
//                 list.splice(i, 1);
//                 return { ...prev, [key]: list };
//             });

//     const patchCorrective = (i: number, patch: Partial<CorrectiveItem>) =>
//         setJob((prev) => {
//             const list = [...prev.corrective_actions];
//             list[i] = { ...list[i], ...patch };
//             return { ...prev, corrective_actions: list };
//         });

//     const addCorrective = () =>
//         setJob((prev) => ({
//             ...prev,
//             corrective_actions: [...prev.corrective_actions, { text: "", images: [] }],
//         }));

//     const removeCorrective = (i: number) =>
//         setJob((prev) => {
//             const list = [...prev.corrective_actions];
//             if (list.length <= 1) return { ...prev, corrective_actions: [{ text: "", images: [] }] };
//             list.splice(i, 1);
//             return { ...prev, corrective_actions: list };
//         });

//     const addCorrectiveImages = (i: number, files: FileList | null) => {
//         if (!files?.length) return;
//         const imgs = Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }));
//         const current = job.corrective_actions[i];
//         patchCorrective(i, { images: [...current.images, ...imgs] });
//     };

//     const removeCorrectiveImage = (i: number, j: number) => {
//         const imgs = [...job.corrective_actions[i].images];
//         const url = imgs[j]?.url;
//         if (url) URL.revokeObjectURL(url);
//         imgs.splice(j, 1);
//         patchCorrective(i, { images: imgs });
//     };
//     type NextIssueIdParams = {
//         latestId?: string | null; // รหัสล่าสุดของเดือนนั้น (ถ้ามี)
//         date?: Date | string;     // วันที่อ้างอิง (เช่น found_date)
//         prefix?: string;          // ค่าเริ่มต้น "EL"
//         pad?: number;             // จำนวนหลักของเลขรัน (เริ่มต้น 2 => 01, 02, ...)
//         start?: number;           // เริ่มนับที่เลขไหน (เริ่มต้น 1)
//     };

//     function makeNextIssueId({
//         latestId = null,
//         date = new Date(),
//         prefix = "EL",
//         pad = 2,
//         start = 1,
//     }: NextIssueIdParams = {}): string {
//         const d = typeof date === "string" ? new Date(date) : date;
//         const y = d.getFullYear();
//         const m = String(d.getMonth() + 1).padStart(2, "0");
//         const base = `${prefix}-${y}-${m}`;

//         let seq = start;

//         if (latestId) {
//             // รองรับรูปแบบ EL-YYYY-MMNN...
//             const rx = new RegExp(`^${prefix}-(\\d{4})-(\\d{2})(\\d+)$`);
//             const m2 = latestId.match(rx);
//             if (m2) {
//                 const [_, yy, mm, tail] = m2;
//                 if (Number(yy) === y && mm === m) {
//                     seq = Math.max(Number(tail) + 1, start);
//                 }
//             }
//         }

//         const tail = String(seq).padStart(pad, "0");
//         return `${base}${tail}`;
//     }

//     function localTodayISO(): string {
//         const d = new Date();
//         const y = d.getFullYear();
//         const m = String(d.getMonth() + 1).padStart(2, "0");
//         const day = String(d.getDate()).padStart(2, "0");
//         return `${y}-${m}-${day}`;
//     }

//     // ⭐ ดึง station_name จาก API แล้วอัปเดตช่อง "สถานที่"
//     useEffect(() => {
//         let alive = true;
//         if (!stationId) return;

//         (async () => {
//             try {
//                 const res = await fetch(
//                     `${API_BASE}/station/info/public?station_id=${encodeURIComponent(stationId)}`,
//                     { cache: "no-store" }
//                 );
//                 if (!res.ok) throw new Error(`HTTP ${res.status}`);
//                 const data: { station: StationPublic } = await res.json();

//                 if (!alive) return;
//                 setJob(prev => ({
//                     ...prev,
//                     location: data.station.station_name || prev.location, // 👈 เซ็ตสถานที่ = station_name
//                     wo: data.station.WO ?? prev.wo,
//                     sn: data.station.SN ?? prev.sn
//                 }));
//             } catch (err) {
//                 console.error("โหลดข้อมูลสถานีไม่สำเร็จ:", err);
//                 // จะ alert ก็ได้ถ้าต้องการ
//             }
//         })();

//         return () => { alive = false; };
//     }, [stationId]);


//     useEffect(() => {
//         let alive = true;

//         (async () => {
//             const todayStr = localTodayISO(); // เช่น 2025-10-17
//             const [y, m] = todayStr.split("-");

//             let latestId: string | null = null;
//             try {
//                 const res = await fetch(`/api/cm/latest-id?y=${y}&m=${m}`);
//                 if (res.ok) {
//                     const data = await res.json();
//                     latestId = data?.id ?? null; // เช่น "EL-2025-1007"
//                 }
//             } catch { /* fallback: เริ่ม 01 */ }

//             const nextId = makeNextIssueId({ latestId, date: todayStr });

//             if (!alive) return;
//             setJob(prev => ({
//                 ...prev,
//                 found_date: todayStr,
//                 issue_id: nextId,
//             }));
//         })();

//         return () => { alive = false; };
//     }, []); // ⭐ รันครั้งเดียวตอน mount

//     useEffect(() => {
//         if (!editId || !stationId) return;         // 👈 ต้องมีทั้ง editId และ stationId

//         (async () => {
//             try {
//                 const url = `${API_BASE}/cmreport/${encodeURIComponent(editId)}?station_id=${encodeURIComponent(stationId)}`;
//                 const res = await fetch(url, { credentials: "include" });
//                 if (!res.ok) throw new Error(`HTTP ${res.status}`);
//                 const data = await res.json();

//                 setJob(prev => ({
//                     ...prev,
//                     // ใช้ค่า top-level ของ backend เป็นหลัก (มี backup เป็น job.*)
//                     issue_id: data.issue_id ?? data.job?.issue_id ?? prev.issue_id,
//                     // ใช้ cm_date เป็น found_date (ฟอร์แมต YYYY-MM-DD) ถ้าไม่มีค่อย fallback
//                     found_date: data.cm_date ?? data.job?.found_date ?? prev.found_date,
//                     location: data.job?.location ?? prev.location,
//                     wo: data.job?.wo ?? prev.wo,
//                     sn: data.job?.sn ?? prev.sn,
//                     problem_details: data.job?.problem_details ?? prev.problem_details,
//                     problem_type: data.job?.problem_type ?? prev.problem_type,
//                     severity: (data.job?.severity ?? "") as Severity,
//                     status: (data.job?.status ?? "Open") as Status,
//                     initial_cause: data.job?.initial_cause ?? prev.initial_cause,
//                     remarks: data.job?.remarks ?? prev.remarks,
//                 }));
//                 setSummary(data.summary ?? "");
//             } catch (e) {
//                 console.error("โหลดรายงานเดิมไม่สำเร็จ:", e);
//             }
//         })();
//     }, [editId, stationId]);

//     async function uploadPhotosForReport(reportId: string) {
//         if (!stationId) return;

//         // loop แต่ละข้อของ Corrective Action → map เป็น group=g1,g2,...
//         for (let i = 0; i < job.corrective_actions.length; i++) {
//             const item = job.corrective_actions[i];
//             const files = item.images.map((im) => im.file).filter(Boolean) as File[];
//             if (!files.length) continue; // ข้อนี้ไม่มีรูปก็ข้าม

//             const group = `g${i + 1}`; // g1, g2, ... (อย่าเกินที่ backend รองรับ)
//             const fd = new FormData();
//             fd.append("station_id", stationId);
//             fd.append("group", group);
//             if (item.text) fd.append("remark", item.text); // จะไม่ส่งก็ได้

//             // แนบหลายไฟล์ด้วย key "files" ซ้ำ ๆ
//             files.forEach((f) => fd.append("files", f, f.name));

//             const res = await fetch(`${API_BASE}/cmreport/${encodeURIComponent(reportId)}/photos`, {
//                 method: "POST",
//                 body: fd,
//                 credentials: "include", // ถ้าใช้ cookie httpOnly
//                 // ถ้าใช้ Bearer token ให้ใส่ headers.Authorization แทน
//             });

//             if (!res.ok) {
//                 const msg = await res.text().catch(() => `HTTP ${res.status}`);
//                 throw new Error(`อัปโหลดรูปข้อที่ ${i + 1} ล้มเหลว: ${msg}`);
//             }
//         }
//     }

//     /* ----------------------------------------------------------------- */

//     return (
//         <section className="tw-pb-24">
//             <form
//                 action="#"
//                 noValidate
//                 onSubmit={(e) => {
//                     e.preventDefault();
//                     return false;
//                 }}
//                 onKeyDown={(e) => {
//                     if (e.key === "Enter") e.preventDefault();
//                 }}
//             >
//                 <div className="tw-mx-auto tw-max-w-4xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-sm tw-p-6 md:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0">
//                     {/* HEADER */}
//                     <div className="tw-flex tw-items-start tw-justify-between tw-gap-6">
//                         {/* ซ้าย: โลโก้ + ข้อความ */}
//                         <div className="tw-flex tw-items-start tw-gap-4">
//                             <div className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md
//                                 tw-h-16 tw-w-[76px]
//                                 md:tw-h-20 md:tw-w-[108px]
//                                 lg:tw-h-24 lg:tw-w-[152px]">
//                                 <Image
//                                     src={LOGO_SRC}
//                                     alt="Company logo"
//                                     fill
//                                     priority
//                                     className="tw-object-contain tw-p-0"
//                                     sizes="(min-width:1024px) 152px, (min-width:768px) 108px, 76px"
//                                 />
//                             </div>

//                             <div>
//                                 <div className="tw-font-semibold tw-text-blue-gray-900">
//                                     รายงานการบำรุงรักษา (PM) – {headerLabel}
//                                 </div>
//                                 <div className="tw-text-sm tw-text-blue-gray-600">
//                                     การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)<br />
//                                     เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย<br />
//                                     จังหวัดนนทบุรี 11130 ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416
//                                 </div>
//                             </div>
//                         </div>

//                         {/* ปุ่มด้านขวาใน HEADER */}
//                         {/* <div className="tw-flex tw-items-start tw-gap-2 tw-print:tw-hidden">
//                             <Button
//                                 type="button"
//                                 variant="text"
//                                 color="blue-gray"
//                                 className="tw-h-10 tw-text-sm"
//                                 onClick={onCancelLocal}
//                             >
//                                 ยกเลิก
//                             </Button>
//                             <Button
//                                 type="button"
//                                 variant="outlined"
//                                 className="tw-h-10 tw-text-sm"
//                                 onClick={handlePrint}
//                             >
//                                 พิมพ์เอกสาร
//                             </Button>
//                         </div> */}
//                     </div>

//                     {/* BODY */}
//                     <div className="tw-mt-8 tw-space-y-8">
//                         {/* META – การ์ดหัวเรื่อง */}
//                         <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
//                             <div className="lg:tw-col-span-1">
//                                 <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
//                                     Issue ID
//                                 </label>
//                                 {/* <Input
//                                     value={job.issue_id}
//                                     onChange={(e) => setJob({ ...job, issue_id: e.target.value })}
//                                     crossOrigin=""
//                                     // className="!tw-w-full"
//                                     readOnly
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                     className="!tw-w-full !tw-bg-blue-gray-50"
//                                 /> */}
//                                 <Input
//                                     value={job.issue_id || "-"}
//                                     readOnly
//                                     key={job.issue_id}  // บังคับให้รี-mount เมื่อค่าเปลี่ยน
//                                     crossOrigin=""
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                     className="!tw-w-full !tw-bg-blue-gray-50"
//                                 />
//                             </div>

//                             <div className="sm:tw-col-span-2 lg:tw-col-span-3">
//                                 <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
//                                     Location
//                                 </label>
//                                 <Input
//                                     value={job.location}
//                                     onChange={(e) => setJob({ ...job, location: e.target.value })}
//                                     crossOrigin=""
//                                     readOnly
//                                     className="!tw-w-full !tw-bg-blue-gray-50"
//                                     // className="!tw-w-full"
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div>


//                             <div className="lg:tw-col-span-2">
//                                 <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
//                                     วันที่ต้องการ
//                                 </label>
//                                 <Input
//                                     type="date"
//                                     value={(job.found_date || "").slice(0, 10)}
//                                     onChange={(e) => setJob({ ...job, found_date: e.target.value })}
//                                     crossOrigin=""
//                                     readOnly={isEdit}
//                                     className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}


//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div>

//                             {/* <div className="lg:tw-col-span-1">
//                                 <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
//                                     เสร็จสิ้น
//                                 </label>
//                                 <Input
//                                     type="date"
//                                     value={(job.resolved_date || "").slice(0, 10)}
//                                     min={(job.found_date || "").slice(0, 10)}
//                                     onChange={(e) => setJob({ ...job, resolved_date: e.target.value })}
//                                     crossOrigin=""
//                                     className="!tw-w-full"
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div> */}
//                         </div>
//                         <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
//                             <div className="sm:tw-col-span-2 lg:tw-col-span-3">
//                                 <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
//                                     Work order
//                                 </label>
//                                 <Input
//                                     value={job.wo}
//                                     onChange={(e) => setJob({ ...job, wo: e.target.value })}
//                                     crossOrigin=""
//                                     readOnly
//                                     className="!tw-w-full !tw-bg-blue-gray-50"
//                                     // className="!tw-w-full"
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div>

//                             <div className="sm:tw-col-span-2 lg:tw-col-span-3">
//                                 <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
//                                     Serial
//                                 </label>
//                                 <Input
//                                     value={job.sn}
//                                     onChange={(e) => setJob({ ...job, sn: e.target.value })}
//                                     crossOrigin=""
//                                     readOnly
//                                     className="!tw-w-full !tw-bg-blue-gray-50"
//                                     // className="!tw-w-full"
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div>


//                         </div>


//                         {/* รายละเอียดปัญหา */}
//                         <div>
//                             <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
//                                 รายละเอียดปัญหา
//                             </div>
//                             <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
//                                 <div>
//                                     <div className="tw-text-sm tw-font-medium tw-text-blue-gray-800 tw-mb-3">
//                                         ความรุนแรง
//                                     </div>
//                                     <select
//                                         value={job.severity}
//                                         disabled={isEdit}
//                                         onChange={(e) => setJob({ ...job, severity: e.target.value as Severity })}
//                                         className={`tw-w-full tw-h-10 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-px-3 tw-py-2
//                                             ${isEdit ? "tw-bg-blue-gray-50 tw-text-blue-gray-400 tw-cursor-not-allowed" : ""}`}
//                                     >
//                                         {SEVERITY_OPTIONS.map((s) => (
//                                             <option key={s} value={s}>
//                                                 {s || "เลือก..."}
//                                             </option>
//                                         ))}
//                                     </select>
//                                 </div>
//                                 <div className="tw-text-sm tw-font-medium tw-text-blue-gray-800 tw-mb-3">
//                                     ประเภทปัญหา
//                                 </div>
//                                 <Input
//                                     label="ประเภทปัญหา"
//                                     value={job.problem_type}
//                                     onChange={(e) => setJob({ ...job, problem_type: e.target.value })}
//                                     crossOrigin=""
//                                     readOnly={isEdit}
//                                     className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
//                                 />
//                                 <Textarea
//                                     label="รายละเอียด"
//                                     rows={3}
//                                     value={job.problem_details}
//                                     onChange={(e) => setJob({ ...job, problem_details: e.target.value })}
//                                     readOnly={isEdit}
//                                     className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />

//                                 {/* สถานะงาน */}
//                                 <div>
//                                     <div className="tw-text-sm tw-font-medium tw-text-blue-gray-800 tw-mb-2">
//                                         สถานะงาน
//                                     </div>

//                                     <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-2">
//                                         {STATUS_OPTIONS.filter((s) => s).map((opt) => (
//                                             <label
//                                                 key={opt}
//                                                 className={`tw-flex tw-items-center tw-gap-2 tw-rounded-lg tw-border
//                                                     tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50
//                                                     ${job.status === opt
//                                                         ? "tw-border-blue-500 tw-ring-1 tw-ring-blue-100"
//                                                         : "tw-border-blue-gray-200"}`}
//                                             >
//                                                 <input
//                                                     type="radio"
//                                                     name="status"
//                                                     value={opt}
//                                                     className="tw-h-4 tw-w-4 tw-border-blue-gray-300 focus:tw-ring-0 focus:tw-outline-none"
//                                                     checked={job.status === opt}
//                                                     onChange={() => setJob((prev) => ({ ...prev, status: opt as Status }))}
//                                                 />
//                                                 <span className="tw-text-sm tw-text-blue-gray-800">
//                                                     {STATUS_LABEL[opt as Exclude<Status, "">]}
//                                                 </span>
//                                             </label>
//                                         ))}
//                                     </div>
//                                 </div>

//                             </div>
//                         </div>

//                         {/* สาเหตุ */}
//                         <div className="tw-space-y-2">
//                             <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">
//                                 สาเหตุเบื้องต้น
//                             </div>
//                             <Textarea
//                                 label="สาเหตุ"
//                                 rows={3}
//                                 value={job.initial_cause}
//                                 onChange={(e) => setJob({ ...job, initial_cause: e.target.value })}
//                                 readOnly={isEdit}
//                                 className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
//                                 containerProps={{ className: "!tw-min-w-0" }}
//                             />
//                         </div>

//                         {/* หมายเหตุ */}
//                         <div>
//                             <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
//                                 หมายเหตุ
//                             </div>
//                             <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4">
//                                 <Textarea
//                                     label="หมายเหตุ"
//                                     rows={3}
//                                     value={job.remarks}
//                                     onChange={(e) => setJob({ ...job, remarks: e.target.value })}
//                                     readOnly={isEdit}
//                                     className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div>
//                         </div>

//                         {/* FOOTER + ปุ่มบันทึก */}
//                         <div className="tw-flex tw-items-center tw-justify-between tw-print:tw-mt-8">
//                             <div />
//                             <div className="tw-flex tw-gap-2 tw-print:tw-hidden">
//                                 <Button
//                                     type="button"
//                                     variant="outlined"
//                                     color="blue-gray"
//                                     onClick={onSave}
//                                     className="tw-h-10 tw-text-sm"
//                                 >
//                                     บันทึกชั่วคราว
//                                 </Button>
//                                 <Button type="button" onClick={onFinalSave} className="tw-h-10 tw-text-sm">
//                                     บันทึก
//                                 </Button>
//                             </div>
//                         </div>
//                     </div>
//                 </div>

//                 {/* print styles */}
//                 <style jsx global>
//                     {`
//                         @media print {
//                             body {
//                                 background: white !important;
//                             }
//                             .tw-print\\:tw-hidden {
//                                 display: none !important;
//                             }
//                         }
//                     `}
//                 </style>
//             </form>
//         </section>
//     );
// }
