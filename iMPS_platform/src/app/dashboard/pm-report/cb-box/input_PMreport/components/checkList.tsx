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
import { draftKeyCB_BOX, saveDraftLocal, loadDraftLocal, clearDraftLocal } from "@/app/dashboard/pm-report/cb-box/input_PMreport/lib/draft";
import { useRouter } from "next/navigation";

/* =========================
 *        API (เดิม)
 * ========================= */
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

/* ---------- ฟิลด์วัดแรงดัน (ใช้ในข้อ 5 เท่านั้น) ---------- */
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

/* ---------- คำถาม 1–8 (ลบข้อ 9 ออกแล้ว) ---------- */
type Question =
    | { no: number; key: `r${number}`; label: string; kind: "simple"; hasPhoto?: boolean }
    | { no: number; key: `r${number}`; label: string; kind: "group"; items: { key: string; label: string }[]; hasPhoto?: boolean }
    | { no: number; key: `r${number}`; label: string; kind: "measure"; hasPhoto?: boolean };

const QUESTIONS: Question[] = [
    { no: 1, key: "r1", label: "1) การไฟฟ้าฝ่ายจำหน่าย", kind: "simple", hasPhoto: true },
    { no: 2, key: "r2", label: "2) ตรวจสอบอุปกรณ์ตัดวงจรไฟฟ้า", kind: "simple", hasPhoto: true },
    { no: 3, key: "r3", label: "3) ตรวจสอบสภาพทั่วไป", kind: "simple", hasPhoto: true },
    { no: 4, key: "r4", label: "4) ตรวจสอบสภาพดักซีล,ซิลิโคนกันซึม", kind: "simple", hasPhoto: true },
    { no: 5, key: "r5", label: "5) อุปกรณ์ตัดวงจรไฟฟ้า (Safety Switch / Circuit Breaker)", kind: "measure", hasPhoto: true },
    { no: 6, key: "r6", label: "6) ทดสอบปุ่ม Trip Test (Circuit Breaker)", kind: "simple", hasPhoto: true },
    { no: 7, key: "r7", label: "7) ตรวจสอบจุดต่อทางไฟฟ้าและขันแน่น", kind: "simple", hasPhoto: true },
    { no: 8, key: "r8", label: "8) ทำความสะอาดตู้ MDB", kind: "simple", hasPhoto: true },
];

const FIELD_GROUPS: Record<number, { keys: readonly string[]; unitType: "voltage"; note?: string } | undefined> = {
    5: { keys: VOLTAGE_FIELDS, unitType: "voltage" },
} as const;

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
        <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
            {(title || subtitle) && (
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    {title && <Typography variant="h6">{title}</Typography>}
                    {subtitle && <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">{subtitle}</Typography>}
                </CardHeader>
            )}
            <CardBody className="tw-space-y-4">{children}</CardBody>
        </Card>
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
//     label, value, onChange, remark, onRemarkChange,
// }: {
//     label: string; value: PF; onChange: (v: Exclude<PF, "">) => void; remark?: string; onRemarkChange?: (v: string) => void;
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


function PhotoMultiInput({
    label, photos, setPhotos, max = 20,
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
                <Button size="sm" color="blue" variant="outlined" onClick={handlePick}>แนบรูป / ถ่ายรูป</Button>
                <Typography variant="small" className="!tw-text-blue-gray-500 tw-flex tw-items-center">
                    แนบได้สูงสุด {max} รูป • รองรับการถ่ายจากกล้องบนมือถือ
                </Typography>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" className="tw-hidden" onChange={(e) => handleFiles(e.target.files)} />
            {photos.length > 0 ? (
                <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                    {photos.map((p) => (
                        <div key={p.id} className="tw-border tw-rounded-lg tw-overflow-hidden tw-bg-white tw-shadow-xs tw-flex tw-flex-col">
                            <div className="tw-relative tw-aspect-[4/3] tw-bg-blue-gray-50">
                                {p.preview && <img src={p.preview} alt="preview" className="tw-w-full tw-h-full tw-object-cover" />}
                            </div>
                            <div className="tw-p-2 tw-space-y-2">
                                <div className="tw-flex tw-justify-end">
                                    <Button size="sm" color="red" variant="text" onClick={() => handleRemove(p.id)}>ลบรูป</Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <Typography variant="small" className="!tw-text-blue-gray-500">ยังไม่มีรูปแนบ</Typography>
            )}
        </div>
    );
}



/* =========================
 *        MAIN
 * ========================= */
export default function CheckList({ onComplete, onNext, onPrev }: CheckListProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    /* ---------- photos per question ---------- */
    const initialPhotos: Record<number, PhotoItem[]> = Object.fromEntries(
        QUESTIONS.filter((q) => q.hasPhoto).map((q) => [q.no, [] as PhotoItem[]])
    ) as Record<number, PhotoItem[]>;
    const [photos, setPhotos] = useState<Record<number, PhotoItem[]>>(initialPhotos);

    const [summary, setSummary] = useState<string>("");

    const [stationId, setStationId] = useState<string | null>(null);
    const [draftId, setDraftId] = useState<string | null>(null);

    const key = useMemo(() => draftKeyCB_BOX(stationId), [stationId]);
    // const [audio, setAudio] = useState<PF>("");
    const [สรุปผล, setสรุปผล] = useState<PF>("");


    /* ---------- job info ---------- */
    const [job, setJob] = useState({ chargerNo: "", sn: "", model: "", station_name: "", date: "", inspector: "", issue_id: "" });

    /* ---------- PASS/FAIL + remark ---------- */
    // รวม key ทั้งหัวข้อหลัก + หัวข้อย่อย
    const ALL_KEYS = useMemo(() => {
        const base = QUESTIONS.flatMap((q) => (q.kind === "group" ? [q.key, ...q.items.map((i) => i.key as string)] : [q.key]));
        return base;
    }, []);

    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(
        Object.fromEntries(ALL_KEYS.map((k) => [k, { pf: "", remark: "" }])) as Record<string, { pf: PF; remark: string }>
    );

    /* ---------- ข้อ 5: วัดค่าแรงดัน ---------- */
    const m5 = useMeasure<UnitVoltage>(VOLTAGE_FIELDS, "V");

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
            m5: typeof m5.state;
            photos: typeof photos;
            summary: string;
            summary_pf?: PF;
        }>(key);
        if (!draft) return;

        setJob((prev) => ({ ...prev, ...draft.job }));
        setRows(draft.rows);
        m5.setState(draft.m5 ?? initMeasureState(VOLTAGE_FIELDS, "V"));
        setPhotos(draft.photos ?? initialPhotos);
        setSummary(draft.summary);
        setสรุปผล(draft.summary_pf ?? "");
    }, [stationId, draftId, key]);
 
    // ---------- render helpers ----------
    const makePhotoSetter = (no: number): React.Dispatch<React.SetStateAction<PhotoItem[]>> => {
        return (action: React.SetStateAction<PhotoItem[]>) => {
            setPhotos((prev) => {
                const current = prev[no] ?? [];
                const next = typeof action === "function" ? (action as (x: PhotoItem[]) => PhotoItem[])(current) : action;
                return { ...prev, [no]: next };
            });
        };
    };

    const MEASURE_BY_NO: Record<number, ReturnType<typeof useMeasure<UnitVoltage>> | undefined> = {
        5: m5,
    };

    const REQUIRED_PHOTO_ITEMS = useMemo(() => QUESTIONS.filter((q) => q.hasPhoto).map((q) => q.no).sort((a, b) => a - b), []);
    const missingPhotoItems = useMemo(() => REQUIRED_PHOTO_ITEMS.filter((no) => (photos[no]?.length ?? 0) < 1), [REQUIRED_PHOTO_ITEMS, photos]);
    const allPhotosAttached = missingPhotoItems.length === 0;

    /* ---------- validation ---------- */
    // ต้องตอบ PASS/FAIL/N/A สำหรับ: หัวข้อเดี่ยว + หัวข้อย่อยทั้งหมด (ไม่มีข้อ 9 แล้ว)
    const PF_REQUIRED_KEYS = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "group") keys.push(...q.items.map((i) => i.key));
            if (q.kind === "simple" || q.kind === "measure") keys.push(q.key);
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

    // เช็คอินพุตของข้อ 5 ให้ครบทุกช่อง
    const missingInputs = useMemo(() => {
        const r: string[] = [];
        FIELD_GROUPS[5]?.keys.forEach((k) => {
            const v = m5.state[k]?.value ?? "";
            if (!String(v).trim()) r.push(`5: ${String(k)}`);
        });
        return r;
    }, [m5.state]);

    const allRequiredInputsFilled = missingInputs.length === 0;
    const isSummaryFilled = summary.trim().length > 0;

    const canFinalSave = allPhotosAttached && allPFAnswered && allRequiredInputsFilled && isSummaryFilled;

    useEffect(() => onComplete(allPFAnswered), [allPFAnswered, onComplete]);

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
            m5: m5.state,
            photos,
            summary,
            summary_pf: สรุปผล, // ⬅️ เก็บเป็นคีย์ใหม่
        });
    }, [key, stationId, draftId, job, rows, m5.state, photos, summary, สรุปผล]); // ⬅️ เพิ่ม สรุปผล


    /* ---------- actions (submit เหมือนเดิม) ---------- */
    async function uploadGroupPhotos(reportId: string, stationId: string, group: string, files: File[]) {
        const form = new FormData();
        form.append("station_id", stationId);
        form.append("group", group);
        files.forEach((f) => form.append("files", f));
        const token = localStorage.getItem("access_token");
        const res = await fetch(`${API_BASE}/pmreport/${reportId}/photos`, {
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

            const res = await fetch(`${API_BASE}/pmreport/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify({
                    station_id: stationId,
                    job,
                    rows,
                    measures: { r5: m5.state }, // ลบ r9 ออกแล้ว
                    summary,
                    pm_date,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const { report_id } = await res.json();

            // อัปโหลดรูปแยกกลุ่ม g1..g8 (map ตาม photos ที่มีจาก QUESTIONS)
            const photoNos = Object.keys(photos).map(Number);
            for (const no of photoNos) {
                const list = photos[no] || [];
                if (list.length === 0) continue;
                const files = list.map((p) => p.file!).filter(Boolean) as File[];
                if (files.length === 0) continue;
                await uploadGroupPhotos(report_id, stationId, `g${no}`, files);
            }

            const fin = await fetch(`${API_BASE}/pmreport/${report_id}/finalize`, {
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
                        label={String(k)}
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
        return (
            <SectionCard key={q.key} title={q.label}>
                {/* simple/group header row */}
                {q.kind === "simple" && (
                    <PassFailRow
                        label="ผลการทดสอบ"
                        value={rows[q.key].pf}
                        onChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })}
                        remark={rows[q.key].remark}
                        onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })}
                    />
                )}

                {q.kind === "group" &&
                    q.items.map((it) => (
                        <PassFailRow
                            key={it.key}
                            label={it.label}
                            value={rows[it.key]?.pf ?? ""}
                            onChange={(v) => setRows({ ...rows, [it.key]: { ...(rows[it.key] ?? { remark: "" }), pf: v } })}
                            remark={rows[it.key]?.remark}
                            onRemarkChange={(v) => setRows({ ...rows, [it.key]: { ...(rows[it.key] ?? { pf: "" }), remark: v } })}
                        />
                    ))}

                {q.kind === "measure" && (
                    <>
                        <PassFailRow
                            label="ผลการทดสอบ"
                            value={rows[q.key].pf}
                            onChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })}
                            remark={rows[q.key].remark}
                            onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })}
                        />
                        {renderMeasureGrid(q.no)}
                    </>
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

    /* =========================
     *        RENDER
     * ========================= */
    return (
        <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
            {/* Job Info */}
            <SectionCard title="ข้อมูลงาน" subtitle="กรุณากรอกทุกช่องให้ครบ เพื่อความสมบูรณ์ของรายงาน PM">
                <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                    <Input label="Issue ID" value={job.issue_id} onChange={(e) => setJob({ ...job, issue_id: e.target.value })} crossOrigin="" className="!tw-bg-blue-gray-50" readOnly />
                    <Input label="Location / สถานที่" value={job.station_name} onChange={(e) => setJob({ ...job, station_name: e.target.value })} crossOrigin="" className="!tw-bg-blue-gray-50" readOnly />
                    <Input label="วันที่ตรวจ" type="date" value={job.date} onChange={(e) => setJob({ ...job, date: e.target.value })} crossOrigin="" />
                </div>
            </SectionCard>

            {/* Checklist */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography variant="h6">Checklist</Typography>
                </CardHeader>
                <CardBody className="tw-space-y-1">
                    {QUESTIONS.map(renderQuestionBlock)}
                </CardBody>
            </Card>

            {/* Summary */}
            {/* <SectionCard title="Comment">
                <div className="tw-space-y-2">
                    <Textarea
                        label="Comment"
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        rows={4}
                        required
                        autoComplete="off"
                        // error={!isSummaryFilled}
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
                        value={audio}
                        onChange={(v) => setAudio(v)}   // เลือกได้ทีละค่าเดียว
                    />
                </div>

            </SectionCard> */}
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
                        value={สรุปผล}
                        onChange={(v) => setสรุปผล(v)}
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
                    <Typography className="tw-font-medium">2) อินพุตค่าที่วัด (ข้อ 5)</Typography>
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
        </section>
    );
}
