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

import { draftKey, saveDraftLocal, loadDraftLocal, clearDraftLocal } from "../lib/draft";
import { useRouter } from "next/navigation";


const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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

function PassFailRow({
    label,
    value,
    onChange,
    remark,
    onRemarkChange,
}: {
    label: string;
    value: PF;
    onChange: (v: Exclude<PF, "">) => void; // PASS | FAIL | NA
    remark?: string;
    onRemarkChange?: (v: string) => void;
}) {
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
                        aria-pressed={value === "PASS"}
                    >
                        PASS
                    </Button>

                    <Button
                        size="sm"
                        color="red"
                        variant={value === "FAIL" ? "filled" : "outlined"}
                        className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]"
                        onClick={() => onChange("FAIL")}
                        aria-pressed={value === "FAIL"}
                    >
                        FAIL
                    </Button>

                    <Button
                        size="sm"
                        color="blue-gray"
                        variant={value === "NA" ? "filled" : "outlined"}
                        className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]"
                        onClick={() => onChange("NA")}
                        aria-pressed={value === "NA"}
                    >
                        N/A
                    </Button>
                </div>
            </div>

            {onRemarkChange && (
                <div className="tw-w-full tw-min-w-0">
                    <div className="tw-w-full tw-min-w-0">
                        <Textarea
                            label="หมายเหตุ (ถ้ามี)"
                            value={remark || ""}
                            onChange={(e) => onRemarkChange(e.target.value)}
                            containerProps={{ className: "!tw-w-full !tw-min-w-0" }}
                            className="!tw-w-full"
                        />
                    </div>
                </div>
            )}
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

/* =========================
 *        MAIN
 * ========================= */
export default function CheckList({ onComplete }: CheckListProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

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
    // const key = useMemo(() => draftKey(stationId), [stationId]);
    // ใหม่
    const key = useMemo(
        () => `${draftKey(stationId)}:${draftId ?? "default"}`,
        [stationId, draftId]
    );


    /* ---------- job info ---------- */
    const [job, setJob] = useState({
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
        }>(key);
        if (!draft) return;

        setJob((prev) => ({ ...prev, ...draft.job }));
        setRows(draft.rows);
        setCp(draft.cp);
        m17.setState(draft.m17);
        setSummary(draft.summary);
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


    useEffect(() => {
        onComplete(allPFAnswered);
    }, [allPFAnswered, onComplete]);

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

    // const onFinalSave = () => {
    //     console.log({
    //         job,
    //         rows,
    //         m17: m17.state,
    //         photos,
    //         summary
    //     });
    //     alert("บันทึกเรียบร้อย (เดโม่) – ดูข้อมูลใน console");
    // };

    // const onFinalSave = async () => {
    //     if (!stationId) {
    //         alert("ยังไม่ทราบ station_id");
    //         return;
    //     }
    //     if (submitting) return;
    //     setSubmitting(true);
    //     try {
    //         // TODO: แทน endpoint จริงของคุณ
    //         const token =
    //             typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    //         const res = await fetch(`${API_BASE}/pmreport/submit`, {
    //             method: "POST",
    //             // headers: { "Content-Type": "application/json" },
    //             headers: {
    //                 "Content-Type": "application/json",
    //                 ...(token ? { Authorization: `Bearer ${token}` } : {}),
    //             },
    //             credentials: "include",
    //             body: JSON.stringify({
    //                 station_id: stationId,
    //                 job,
    //                 rows,
    //                 measures: { m17: m17.state, cp },
    //                 summary,
    //                 // รูปภาพ: แนะนำอัปโหลดแยกเป็น /upload แล้วแนบรหัสไฟล์ใน payload นี้
    //             }),
    //         });

    //         if (!res.ok) throw new Error(await res.text());

    //         // สำเร็จ → ล้างดราฟต์ + กลับหน้า list พร้อม flag
    //         clearDraftLocal(key);
    //         router.replace(
    //             `/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&saved=1`
    //         );
    //     } catch (err: any) {
    //         alert(`บันทึกไม่สำเร็จ: ${err?.message ?? err}`);
    //     } finally {
    //         setSubmitting(false);
    //     }
    // };
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

            // 1) สร้างรายงาน (submit)
            const res = await fetch(`${API_BASE}/pmreport/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: "include",
                body: JSON.stringify({
                    station_id: stationId,
                    job,
                    rows,
                    measures: { m17: m17.state, cp },
                    summary,
                    pm_date,
                }),
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
        <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
            {/* Job Info */}
            <SectionCard title="ข้อมูลงาน" subtitle="กรุณากรอกทุกช่องให้ครบ เพื่อความสมบูรณ์ของรายงาน PM">
                <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">

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
                    {/* <Input
                        type="text"                          // ใช้ text + กรองเอง จะกัน e,-,+ ได้ดีกว่า number
                        inputMode="numeric"
                        pattern="[0-9]*"
                        label="เครื่องประจุไฟฟ้าที่"
                        value={job.chargerNo}
                        onChange={(e) =>
                            setJob({
                                ...job,
                                // กรองให้เหลือแต่ตัวเลข
                                chargerNo: e.target.value.replace(/\D/g, ""),
                            })
                        }
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        crossOrigin=""
                        // ทำให้กล่องสั้นลง + ไม่ล้น
                        containerProps={{ className: "tw-max-w-[160px] !tw-min-w-0" }}
                        className="!tw-w-full"
                    /> */}

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

            <SectionCard title="สรุปผลการตรวจสอบ">
                <div className="tw-space-y-2">
                    <Textarea
                        label="สรุปผลการตรวจสอบ"
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        rows={4}
                        required
                        autoComplete="off"
                        // แสดงกรอบแดงด้วย prop ของคอมโพเนนต์
                        error={!isSummaryFilled}
                        // กันล้นในกริด/ฟเลกซ์
                        containerProps={{ className: "!tw-min-w-0" }}
                        className="!tw-w-full resize-none"
                    />
                    <Typography
                        variant="small"
                        className={`tw-text-xs ${!isSummaryFilled ? "!tw-text-red-600" : "!tw-text-blue-gray-500"
                            }`}
                    >
                        {isSummaryFilled
                            ? "กรุณาตรวจทานถ้อยคำและความครบถ้วนก่อนบันทึก"
                            : "จำเป็นต้องกรอกสรุปผลการตรวจสอบ"}
                    </Typography>
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


