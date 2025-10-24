
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
import { draftKeyStation, saveDraftLocal, loadDraftLocal, clearDraftLocal } from "@/app/dashboard/pm-report/station/input_PMreport/lib/draft";
import { useRouter } from "next/navigation";

/* =========================
 * API (เดิม)
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
 * CONSTANTS
 * ========================= */

type PhotoItem = {
    id: string;
    file?: File;
    preview?: string;
    remark?: string;
    uploading?: boolean;
    error?: string;
};

type PF = "PASS" | "FAIL" | "NA" | "";

/* ---------- รายการ Checklist 10 ข้อตามรูปภาพใหม่ (ไม่มีข้อ 9 เดิม) ---------- */
type Question =
    | { no: number; key: `r${number}`; label: string; kind: "simple"; hasPhoto?: boolean }
    | { no: number; key: `r${number}`; label: string; kind: "group"; items: { key: string; label: string }[]; hasPhoto?: boolean };

const QUESTIONS_RAW = [
    // ข้อ 1-6 เป็น kind: "simple" และไม่มีรูปภาพ (hasPhoto: false)
    { no: 1, key: "r1", label: "1. ตรวจสอบโครงสร้างสถานี", kind: "simple", hasPhoto: false },
    { no: 2, key: "r2", label: "2. ตรวจสอบสีโครงสร้างสถานี", kind: "simple", hasPhoto: false },
    { no: 3, key: "r3", label: "3. ตรวจสอบพื้นผิวสถานี", kind: "simple", hasPhoto: false },
    { no: 4, key: "r4", label: "4. ตรวจสอบสีพื้นผิวสถานี", kind: "simple", hasPhoto: false },
    { no: 5, key: "r5", label: "5. ตรวจสอบตัวกั้นห้ามล้อ", kind: "simple", hasPhoto: false },
    { no: 6, key: "r6", label: "6. ตรวจสอบเสากันชนเครื่องอัดประจุไฟฟ้า", kind: "simple", hasPhoto: false },

    // ข้อ 7 เป็น kind: "group" (ไฟส่องสว่าง) - มีรูปภาพ
    {
        no: 7,
        key: "r7",
        label: "7. โคมไฟส่องสว่าง",
        kind: "group",
        hasPhoto: true,
        items: [
            { key: "r7_1", label: "ตรวจสอบสภาพโคมไฟส่องสว่าง" },
            { key: "r7_2", label: "ตรวจสอบการทำงาน" },
        ],
    },

    // ข้อ 8 เป็น kind: "group" (ป้ายชื่อสถานี) - มีรูปภาพ
    {
        no: 8,
        key: "r8",
        label: "8. ป้ายชื่อสถานี",
        kind: "group",
        hasPhoto: true,
        items: [
            { key: "r8_1", label: "ตรวจสอบสภาพป้ายชื่อสถานี" },
            { key: "r8_2", label: "ตรวจสอบการทำงาน" },
        ],
    },

    // ข้อ 9 เป็น kind: "group" (ป้ายวิธีใช้งาน) - มีรูปภาพ
    {
        no: 9,
        key: "r9",
        label: "9. ป้ายวิธีใช้งาน",
        kind: "group",
        hasPhoto: true,
        items: [
            { key: "r9_1", label: "ตรวจสอบสภาพป้ายวิธีใช้งาน" },
            { key: "r9_2", label: "ตรวจสอบการทำงาน" },
        ],
    },

    // ข้อ 10 เป็น kind: "simple" (ทำความสะอาด) - ไม่มีรูปภาพ
    { no: 10, key: "r10", label: "10. ทำความสะอาด", kind: "simple", hasPhoto: false },
];

/**
 * กรองให้เหลือแค่ kind: "simple" และ kind: "group" (ซึ่ง QUESTIONS_RAW ใหม่มีแค่นี้อยู่แล้ว)
 */
const QUESTIONS: Question[] = QUESTIONS_RAW.filter(
    // (q): q is Question => q.kind === "simple" || q.kind === "group"
    (q) => q.kind === "simple" || q.kind === "group"
) as Question[];

/* =========================
 * TYPES & HOOKS (ไม่มีการเปลี่ยนแปลง)
 * ========================= */

// ... (UI ATOMS ยังคงเดิม)

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

function PassFailRow({
    label, value, onChange, remark, onRemarkChange,
}: {
    label: string; value: PF; onChange: (v: Exclude<PF, "">) => void; remark?: string; onRemarkChange?: (v: string) => void;
}) {
    return (
        <div className="tw-space-y-3 tw-py-3">
            <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">
                <Typography className="tw-font-medium">{label}</Typography>

                <div className="tw-flex tw-gap-2 tw-w-full sm:tw-w-auto">
                    <Button size="sm" color="green" variant={value === "PASS" ? "filled" : "outlined"} className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]" onClick={() => onChange("PASS")}>PASS</Button>
                    <Button size="sm" color="red" variant={value === "FAIL" ? "filled" : "outlined"} className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]" onClick={() => onChange("FAIL")}>FAIL</Button>
                    <Button size="sm" color="blue-gray" variant={value === "NA" ? "filled" : "outlined"} className="tw-w-1/3 sm:tw-w-auto sm:tw-min-w-[84px]" onClick={() => onChange("NA")}>N/A</Button>
                </div>
            </div>

            {onRemarkChange && (
                <div className="tw-w-full tw-min-w-0">
                    <Textarea label="หมายเหตุ (ถ้ามี)" value={remark || ""} onChange={(e) => onRemarkChange(e.target.value)} containerProps={{ className: "!tw-w-full !tw-min-w-0" }} className="!tw-w-full" />
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
 * MAIN
 * ========================= */
export default function CheckList({ onComplete, onNext, onPrev }: CheckListProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const PM_PREFIX = "stationpmreport";

    /* ---------- photos per question ---------- */
    // กรองเหลือเฉพาะข้อที่มี hasPhoto
    const initialPhotos: Record<number, PhotoItem[]> = Object.fromEntries(
        QUESTIONS.filter((q) => q.hasPhoto).map((q) => [q.no, [] as PhotoItem[]])
    ) as Record<number, PhotoItem[]>;
    const [photos, setPhotos] = useState<Record<number, PhotoItem[]>>(initialPhotos);

    const [summary, setSummary] = useState<string>("");

    const [stationId, setStationId] = useState<string | null>(null);
    const [draftId, setDraftId] = useState<string | null>(null);

    const key = useMemo(() => draftKeyStation(stationId), [stationId]);

    /* ---------- job info ---------- */
    const [job, setJob] = useState({ chargerNo: "", sn: "", model: "", station_name: "", date: "", inspector: "" });

    /* ---------- PASS/FAIL + remark ---------- */
    // รวม key ทั้งหัวข้อหลัก (simple) + หัวข้อย่อย (group)
    const ALL_KEYS = useMemo(() => {
        const base = QUESTIONS.flatMap((q) => (q.kind === "group" ? [...q.items.map((i) => i.key as string)] : [q.key]));
        return base;
    }, []);

    const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(
        // Object.fromEntries(ALL_KEYS.map((k) => [k, { pf: "", remark: "" }])) as Record<string, { pf: PF; remark: string }>
        Object.fromEntries(ALL_KEYS.map((k) => [k, { pf: "", remark: "" }])) as Record<string, { pf: PF; remark: string }>
    );

    /* ---------- load station (ยังคงเดิม) ---------- */
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

    /* ---------- draft id (ยังคงเดิม) ---------- */
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

    /* ---------- load draft (ยังคงเดิม) ---------- */
    useEffect(() => {
        if (!stationId || !draftId) return;
        const draft = loadDraftLocal<{
            job: typeof job;
            rows: typeof rows;
            photos: typeof photos;
            summary: string;
        }>(key);
        if (!draft) return;

        setJob((prev) => ({ ...prev, ...draft.job }));
        setRows(draft.rows);
        setPhotos(draft.photos ?? initialPhotos);
        setSummary(draft.summary);
    }, [stationId, draftId, key]);

    // ---------- render helpers (ยังคงเดิม) ----------
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

    const missingInputs = useMemo(() => {
        return [];
    }, []);
    const allRequiredInputsFilled = missingInputs.length === 0;

    const isSummaryFilled = summary.trim().length > 0;

    const canFinalSave = allPhotosAttached && allPFAnswered && allRequiredInputsFilled && isSummaryFilled;

    useEffect(() => onComplete(allPFAnswered), [allPFAnswered, onComplete]);

    /* ---------- persistence (auto-save) (ยังคงเดิม) ---------- */
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
            photos,
            summary,
        });
    }, [key, stationId, draftId, job, rows, photos, summary]);

    /* ---------- actions (submit ยังคงเดิม) ---------- */
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

            const res = await fetch(`${API_BASE}/${PM_PREFIX}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                credentials: "include",
                body: JSON.stringify({
                    station_id: stationId,
                    job,
                    rows,
                    summary,
                    pm_date,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            const { report_id } = await res.json();

            // อัปโหลดรูปแยกกลุ่ม g1..g10 (ตามข้อที่มีรูป: ข้อ 7, 8, 9)
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

    const renderQuestionBlock = (q: Question) => {
        return (
            <SectionCard key={q.key} title={q.label}>
                {/* Render สำหรับ kind: "simple" */}
                {/* {q.kind === "simple" && (
                    <PassFailRow
                        label="ผลการตรวจสอบ"
                        value={rows[q.key].pf}
                        onChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], pf: v } })}
                        remark={rows[q.key].remark}
                        onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...rows[q.key], remark: v } })}
                    />
                )} */}
                {q.kind === "simple" && (
                    <PassFailRow
                        label="ผลการตรวจสอบ"
                        // ใช้ Optional Chaining (?.) หรือ Default Value (??) เพื่อป้องกัน undefined
                        // ในกรณีนี้ เนื่องจากเรารู้ว่า rows[q.key] ควรมีอยู่เสมอ จึงอาจใช้ Default Value เพื่อ Cast
                        value={rows[q.key]?.pf ?? ""}
                        onChange={(v) => setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { remark: "" }), pf: v } })}
                        remark={rows[q.key]?.remark ?? ""}
                        onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { pf: "" }), remark: v } })}
                    />
                )}

                {/* Render สำหรับ kind: "group" */}
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

                {/* ส่วนรูปภาพ ยังคงอยู่สำหรับข้อที่มี hasPhoto: true (ข้อ 7, 8, 9) */}
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
     * RENDER
     * ========================= */
    return (
        <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
            {/* Job Info */}
            <SectionCard title="ข้อมูลงาน" subtitle="กรุณากรอกทุกช่องให้ครบ เพื่อความสมบูรณ์ของรายงาน PM">
                <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
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
            <SectionCard title="สรุปผลการตรวจสอบ">
                <div className="tw-space-y-2">
                    <Textarea
                        label="สรุปผลการตรวจสอบ"
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        rows={4}
                        required
                        autoComplete="off"
                        error={!isSummaryFilled}
                        containerProps={{ className: "!tw-min-w-0" }}
                        className="!tw-w-full resize-none"
                    />
                    <Typography variant="small" className={`tw-text-xs ${!isSummaryFilled ? "!tw-text-red-600" : "!tw-text-blue-gray-500"}`}>
                        {isSummaryFilled ? "กรุณาตรวจทานถ้อยคำและความครบถ้วนก่อนบันทึก" : "จำเป็นต้องกรอกสรุปผลการตรวจสอบ"}
                    </Typography>
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

                <div className={`tw-rounded-lg tw-border tw-p-3 ${allPhotosAttached ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
                    <Typography className="tw-font-medium">2) ตรวจสอบการแนบรูปภาพ (ทุกหัวข้อที่กำหนด)</Typography>
                    {allPhotosAttached ? (
                        <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                    ) : (
                        <Typography variant="small" className="!tw-text-amber-700">ยังไม่ได้แนบรูปข้อ: {missingPhotoItems.join(", ")} (ต้องมีรูปสำหรับข้อ 7, 8, 9)</Typography>
                    )}
                </div>

                <div className={`tw-rounded-lg tw-border tw-p-3 ${isSummaryFilled ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"}`}>
                    <Typography className="tw-font-medium">3) สรุปผลการตรวจสอบ</Typography>
                    {isSummaryFilled ? (
                        <Typography variant="small" className="!tw-text-green-700">ครบเรียบร้อย ✅</Typography>
                    ) : (
                        <Typography variant="small" className="!tw-text-amber-700">ยังไม่ได้กรอกสรุปผลการตรวจสอบ</Typography>
                    )}
                </div>

                <div className="tw-mt-4 tw-flex tw-gap-4 tw-justify-end">
                    <Button
                        size="lg"
                        variant="gradient"
                        color="blue"
                        onClick={onFinalSave}
                        disabled={!canFinalSave || submitting}
                    >
                        {submitting ? "กำลังบันทึก..." : "บันทึกและส่งรายงาน"}
                    </Button>
                </div>

                {!canFinalSave && (
                    <Typography variant="small" className="tw-text-red-500 tw-text-center">
                        กรุณากรอกข้อมูลและแนบรูปภาพให้ครบถ้วนตามรายการด้านบนก่อนบันทึก
                    </Typography>
                )}
            </CardFooter>
        </section>
    );
}