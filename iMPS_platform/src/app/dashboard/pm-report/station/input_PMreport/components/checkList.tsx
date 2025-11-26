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
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
/* =========================
 * API (เดิม)
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
    { no: 1, key: "r1", label: "1. ตรวจสอบโครงสร้างสถานี", kind: "simple", hasPhoto: true },
    { no: 2, key: "r2", label: "2. ตรวจสอบสีโครงสร้างสถานี", kind: "simple", hasPhoto: true },
    { no: 3, key: "r3", label: "3. ตรวจสอบพื้นผิวสถานี", kind: "simple", hasPhoto: true },
    { no: 4, key: "r4", label: "4. ตรวจสอบสีพื้นผิวสถานี", kind: "simple", hasPhoto: true },
    { no: 5, key: "r5", label: "5. ตรวจสอบตัวกั้นห้ามล้อ", kind: "simple", hasPhoto: true },
    { no: 6, key: "r6", label: "6. ตรวจสอบเสากันชนเครื่องอัดประจุไฟฟ้า", kind: "simple", hasPhoto: true },

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
    { no: 10, key: "r10", label: "10. ทำความสะอาด", kind: "simple", hasPhoto: true },
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
        //     <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
        //         {(title || subtitle) && (
        //             <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
        //                 {title && <Typography variant="h6">{title}</Typography>}
        //                 {subtitle && <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">{subtitle}</Typography>}
        //             </CardHeader>
        //         )}
        //         <CardBody className="tw-space-y-4">{children}</CardBody>
        //     </Card>
        // );
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

function PassFailRow({
    label,
    value,
    onChange,
    remark,
    onRemarkChange,
    labels,
    aboveRemark,
}: {
    label: string;
    value: PF;
    onChange: (v: Exclude<PF, "">) => void;
    remark?: string;
    onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
    aboveRemark?: React.ReactNode;
}) {

    const text = {
        PASS: labels?.PASS ?? "PASS",
        FAIL: labels?.FAIL ?? "FAIL",
        NA: labels?.NA ?? "N/A",
    };
    return (
        <div className="tw-space-y-3 tw-py-3">
            {/* 1) หัวข้อ */}
            <Typography className="tw-font-medium">{label}</Typography>

            {/* 2) บล็อกแนบรูป หรือ content อื่น ๆ ที่ส่งมาผ่าน aboveRemark */}
            {aboveRemark && (
                <div className="tw-w-full tw-min-w-0">
                    {aboveRemark}
                </div>
            )}

            {/* 3) ปุ่ม PASS / FAIL / N/A — ชิดขวา */}
            <div className="tw-flex tw-w-full tw-justify-end">
                <div className="tw-flex tw-gap-2">
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
            </div>

            {/* 4) หมายเหตุ ด้านล่างสุด */}
            {onRemarkChange && (
                <div className="tw-w-full tw-min-w-0">
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


const PM_TYPE_CODE = "ST";

async function fetchPreviewIssueId(
    stationId: string,
    pmDate: string
): Promise<string | null> {
    const u = new URL(`${API_BASE}/stationpmreport/preview-issueid`);
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

/* ---------- NEW: helper สำหรับ doc_name ---------- */

async function fetchPreviewDocName(
    stationId: string,
    pmDate: string
): Promise<string | null> {
    const u = new URL(`${API_BASE}/stationpmreport/preview-docname`);
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

/* =========================
 * MAIN
 * ========================= */
export default function StationPMReport() {
    const [me, setMe] = useState<Me | null>(null);
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [docName, setDocName] = useState<string>("");


    const PM_PREFIX = "stationpmreport";
    const searchParams = useSearchParams();

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
    const [inspector, setInspector] = useState<string>("");

    /* ---------- job info ---------- */
    const [job, setJob] = useState({
        issue_id: "",
        // chargerNo: "", 
        // sn: "", 
        // model: "", 
        station_name: "",
        date: "",
        inspector: ""
    });

    const todayStr = useMemo(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;       // YYYY-MM-DD (ตามเวลาท้องถิ่น browser)
    }, []);

    // const [สรุปผล, setสรุปผล] = useState<PF>("");
    const [summaryCheck, setSummaryCheck] = useState<PF>("");
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
                    // sn: st.SN ?? prev.sn,
                    // model: st.model ?? prev.model,
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
            job: typeof job & { inspector?: string };
            rows: typeof rows;
            photos: typeof photos;
            summary: string;
            inspector?: string;
        }>(key);
        if (!draft) return;

        setJob((prev) => ({ ...prev, ...draft.job }));
        setRows(draft.rows);
        setPhotos(draft.photos ?? initialPhotos);
        setSummary(draft.summary);
        setInspector(draft.inspector ?? "");
    }, [stationId, draftId, key]);

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

    // useEffect(() => onComplete(allPFAnswered), [allPFAnswered, onComplete]);

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

            const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
            const payload = {
                station_id: stationId,
                issue_id: issueIdFromJob,
                job: jobWithoutIssueId,
                rows,
                summary,
                pm_date,
                inspector,
                doc_name: docName,
                ...(summaryCheck ? { summaryCheck } : {}),
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
            if (doc_name) {
                setDocName(doc_name);
            }

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
            // <SectionCard key={q.key} title={q.label}>

            //     {q.kind === "simple" && (
            //         <PassFailRow
            //             label="ผลการตรวจสอบ"
            //             value={rows[q.key]?.pf ?? ""}
            //             onChange={(v) => setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { remark: "" }), pf: v } })}
            //             remark={rows[q.key]?.remark ?? ""}
            //             onRemarkChange={(v) => setRows({ ...rows, [q.key]: { ...(rows[q.key] ?? { pf: "" }), remark: v } })}
            //         />
            //     )}

            //     {/* Render สำหรับ kind: "group" */}
            //     {q.kind === "group" &&
            //         q.items.map((it) => (
            //             <PassFailRow
            //                 key={it.key}
            //                 label={it.label}
            //                 value={rows[it.key]?.pf ?? ""}
            //                 onChange={(v) => setRows({ ...rows, [it.key]: { ...(rows[it.key] ?? { remark: "" }), pf: v } })}
            //                 remark={rows[it.key]?.remark}
            //                 onRemarkChange={(v) => setRows({ ...rows, [it.key]: { ...(rows[it.key] ?? { pf: "" }), remark: v } })}
            //             />
            //         ))}

            //     {/* ส่วนรูปภาพ ยังคงอยู่สำหรับข้อที่มี hasPhoto: true (ข้อ 7, 8, 9) */}
            //     {q.hasPhoto && (
            //         <div className="tw-pt-2 tw-pb-4 tw-border-t tw-border-blue-gray-50">
            //             <PhotoMultiInput
            //                 label={`แนบรูปประกอบ (ข้อ ${q.no})`}
            //                 photos={photos[q.no] || []}
            //                 setPhotos={makePhotoSetter(q.no)}
            //                 max={20}
            //             />
            //         </div>
            //     )}
            // </SectionCard>
            <SectionCard key={q.key} title={q.label}>
                {/* simple */}
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
                        aboveRemark={
                            q.hasPhoto && (
                                <div className="tw-pb-4 tw-border-b tw-border-blue-gray-50">
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
                            remark={rows[it.key]?.remark}
                            onRemarkChange={(v) =>
                                setRows({
                                    ...rows,
                                    [it.key]: { ...(rows[it.key] ?? { pf: "" }), remark: v },
                                })
                            }
                            // แนบรูปแค่ก่อน item แรกของ group
                            aboveRemark={
                                q.hasPhoto && idx === 0 && (
                                    <div className="tw-pb-4 tw-border-b tw-border-blue-gray-50">
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
                    ))}

                
            </SectionCard>
        );
    };

    /* =========================
     * RENDER
     * ========================= */
    return (
        <section>
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
                                    Preventive Maintanance Checklist - Safety Switch / Circuit Breaker - Box
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
                    <CardBody className="tw-space-y-1">
                        {QUESTIONS.map(renderQuestionBlock)}
                    </CardBody>

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

                </div>
            </form>
        </section>

    );
}