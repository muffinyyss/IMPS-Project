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
import Image from "next/image";
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
/* ---------- รายการ Checklist 10 ข้อตามรูปภาพใหม่ (ไม่มีข้อ 9 เดิม) ---------- */
type Question =
    | { no: number; key: `r${number}`; label: string; labelPre?: string; labelPost?: string; kind: "simple"; hasPhoto?: boolean }
    | { no: number; key: `r${number}`; label: string; labelPre?: string; labelPost?: string; kind: "group"; items: { key: string; label: string }[]; hasPhoto?: boolean };
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
function getQuestionLabel(q: Question, mode: TabId): string {
    if (mode === "pre") {
        // ถ้ามี labelPre ให้ใช้, ถ้าไม่มีก็เอา label ปกติแล้วเติม "(ก่อน PM)"
        return q.labelPre ?? `${q.label} (ก่อน PM)`;
    }
    // mode === "post"
    return q.labelPost ?? `${q.label} (หลัง PM)`;
}
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
function PassFailRow({
    label,
    value,
    onChange,
    remark,
    onRemarkChange,
    labels,
    aboveRemark,
    inlineLeft,
}: {
    label: string;
    value: PF;
    onChange: (v: Exclude<PF, "">) => void;
    remark?: string;
    onRemarkChange?: (v: string) => void;
    labels?: Partial<Record<Exclude<PF, "">, React.ReactNode>>;
    aboveRemark?: React.ReactNode;
    inlineLeft?: React.ReactNode;
}) {
    const text = {
        PASS: labels?.PASS ?? "PASS",
        FAIL: labels?.FAIL ?? "FAIL",
        NA: labels?.NA ?? "N/A",
    };
    // ⬇️ ปุ่มเรียง FAIL – NA – PASS แล้วค่อยเอาทั้งกลุ่มไปชิดขวา
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
    // แถวเดียว: ซ้าย = checkbox (inlineLeft), ขวา = ปุ่มทั้งกลุ่ม
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
    max = 3,
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
                const preview = URL.createObjectURL(f);

                return {
                    id: photoId,
                    file: f,
                    preview,
                    remark: "",
                    ref,
                };
            })
        );

        // setPhotos((prev) => {
        //     const updated = [...prev, ...items];
        //     return updated;
        // });
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
                onChange={(e) => void handleFiles(e.target.files)}
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
async function fetchReport(reportId: string, stationId: string) {
    const token = localStorage.getItem("access_token") ?? "";
    const url = `${API_BASE}/stationpmreport/get?station_id=${stationId}&report_id=${reportId}`;
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
 * MAIN
 * ========================= */
export default function StationPMReport() {
    const [me, setMe] = useState<Me | null>(null);
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [docName, setDocName] = useState<string>("");
    const pathname = usePathname();
    const PM_PREFIX = "stationpmreport";

    const searchParams = useSearchParams();
    const editId = searchParams.get("edit_id") ?? "";
    const action = searchParams.get("action");
    const isPostMode = action === "post";
    /* ---------- photos per question/item ---------- */
    // กรองเหลือเฉพาะข้อที่มี hasPhoto และสร้างสำหรับทั้ง question + sub-items
    const initialPhotos: Record<string, PhotoItem[]> = Object.fromEntries(
        QUESTIONS.filter((q) => q.hasPhoto).flatMap((q) => {
            const entries: [string, PhotoItem[]][] = [];
            // เพิ่มสำหรับ question level
            entries.push([`q${q.no}`, []]);
            // เพิ่มสำหรับ sub-items ของ group
            if (q.kind === "group") {
                q.items.forEach((item) => {
                    entries.push([item.key, []]);
                });
            }
            return entries;
        })
    ) as Record<string, PhotoItem[]>;
    const [photos, setPhotos] = useState<Record<string, PhotoItem[]>>(initialPhotos);
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
        // inspector: ""
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
    // const ALL_KEYS = useMemo(() => {
    //     const base = QUESTIONS.flatMap((q) => (q.kind === "group" ? [...q.items.map((i) => i.key as string)] : [q.key]));
    //     return base;
    // }, []);
    const ALL_KEYS = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") {
                keys.push(q.key); // ✅ เพิ่ม simple question
            } else if (q.kind === "group") {
                // ✅ เพิ่ม sub-items ของ group
                q.items.forEach((item) => {
                    keys.push(item.key);
                });
            }
        });
        return keys;
    }, []);
    // const [rows, setRows] = useState<Record<string, { pf: PF; remark: string }>>(
    //     // Object.fromEntries(ALL_KEYS.map((k) => [k, { pf: "", remark: "" }])) as Record<string, { pf: PF; remark: string }>
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
    /* ---------- load draft (อัปเดตสำหรับ key-based photos) ---------- */
    useEffect(() => {
        if (!stationId || !draftId) return;
        const draft = loadDraftLocal<{
            // job: typeof job & { inspector?: string };
            rows: typeof rows;
            // photos: typeof photos;
            summary: string;
            summary_pf?: PF;
            // inspector?: string;
            photoRefs?: Record<string, PhotoRef[]>;
        }>(key);
        if (!draft) return;

        // const draftJob = draft?.job ?? {};           // ถ้าไม่มี job ให้เป็น object ว่าง
        // const { issue_id, ...draftJobWithoutIssue } = draftJob;

        setRows(draft.rows);
        // setPhotos(draft.photos ?? initialPhotos);
        setSummary(draft.summary);
        if (draft.summary_pf) setSummaryCheck(draft.summary_pf);
        // setInspector(draft.inspector ?? "");
        (async () => {
            if (!draft.photoRefs) return;

            const next: Record<string, PhotoItem[]> = {};

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
                if (items.length > 0) {
                    next[photoKey] = items;
                }
            }

            setPhotos(prev => ({ ...prev, ...next }));
        })();
    }, [stationId, draftId, key]);
    useEffect(() => {
        const onInfo = (e: Event) => {
            const detail = (e as CustomEvent).detail as { info?: StationPublic; station?: StationPublic };
            const st = detail.info ?? detail.station;
            if (!st) return;
            setJob((prev) => ({
                ...prev,
            }));
        };
        window.addEventListener("station:info", onInfo as EventListener);
        return () => window.removeEventListener("station:info", onInfo as EventListener);
    }, []);
    // ---------- render helpers ----------
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
    // 🔹 รูป: ก่อน After ยังไม่บังคับข้อ 19
    const REQUIRED_PHOTO_KEYS_PRE = useMemo(
        () => {
            const keys: string[] = [];
            QUESTIONS.filter((q) => q.hasPhoto && q.no !== 10).forEach((q) => {
                if (q.kind === "group") {
                    // สำหรับ group ต้องมีรูปสำหรับ sub-items
                    q.items.forEach((item) => {
                        keys.push(item.key);
                    });
                } else {
                    // สำหรับ simple ใช้ q-prefix
                    keys.push(`q${q.no}`);
                }
            });
            return keys;
        },
        []
    );
    const REQUIRED_PHOTO_KEYS_POST = useMemo(
        () => {
            const keys: string[] = [];
            QUESTIONS.filter((q) => q.hasPhoto).forEach((q) => {
                if (q.kind === "group") {
                    // สำหรับ group ต้องมีรูปสำหรับ sub-items
                    q.items.forEach((item) => {
                        keys.push(item.key);
                    });
                } else {
                    // สำหรับ simple ใช้ q-prefix
                    keys.push(`q${q.no}`);
                }
            });
            return keys;
        },
        []
    );
    const missingPhotoItemsPre = useMemo(
        () =>
            REQUIRED_PHOTO_KEYS_PRE.filter(
                (key) => (photos[key]?.length ?? 0) < 1
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
    // const allPFAnsweredPre = useMemo(
    //     () => PF_KEYS_PRE.every((k) => rows[k].pf !== ""),
    //     [rows, PF_KEYS_PRE]
    // );
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

    /* ---------- validation ---------- */
    // ต้องตอบ PASS/FAIL/N/A สำหรับ: หัวข้อเดี่ยว + หัวข้อย่อยทั้งหมด
    // const PF_REQUIRED_KEYS = useMemo(() => {
    //     const keys: string[] = [];
    //     QUESTIONS.forEach((q) => {
    //         if (q.kind === "group") keys.push(...q.items.map((i) => i.key));
    //         if (q.kind === "simple") keys.push(q.key);
    //     });
    //     return keys;
    // }, []);

    const PF_REQUIRED_KEYS = useMemo(() => {
        const keys: string[] = [];
        QUESTIONS.forEach((q) => {
            if (q.kind === "simple") {
                keys.push(q.key); // ✅ เพิ่ม simple
            } else if (q.kind === "group") {
                q.items.forEach((item) => {
                    keys.push(item.key); // ✅ เพิ่ม group items
                });
            }
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
    /* ---------- persistence (auto-save) (ยังคงเดิม) ---------- */
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
            rows,
            summary,
            summary_pf: summaryCheck,
            photoRefs,
        });
    }, [key, stationId, draftId, rows, summary, summaryCheck, photoRefs,]);
    /* ---------- actions (submit ยังคงเดิม) ---------- */
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
            const pm_date = job.date?.trim() || ""; // เก็บเป็น YYYY-MM-DD ตามที่กรอก

            const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
            const payload = {
                station_id: stationId,
                issue_id: issueIdFromJob,                // authoritative (ระดับบนสุด)
                job: jobWithoutIssueId,                  // ไม่มี issue_id แล้ว
                inspector,
                pm_date,
                doc_name: docName,
                side: "pre" as TabId,
            };
            // 1) สร้างรายงาน (submit)
            const res = await fetch(`${API_BASE}/stationpmreport/pre/submit`, {
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
            // 2) อัปโหลดรูปทั้งหมด - จัดกลุ่มตามข้อที่มี
            // สำหรับ simple: ใช้ q-prefix, สำหรับ group items: ใช้ item key
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
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&saved=1&tab=station`);
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

            // const { issue_id: issueIdFromJob, ...jobWithoutIssueId } = job;
            const payload = {
                station_id: stationId,
                // issue_id: issueIdFromJob,
                // job: jobWithoutIssueId,
                rows,
                summary,
                // pm_date,
                // inspector,
                // doc_name: docName,
                ...(summaryCheck ? { summaryCheck } : {}),
                side: "post" as TabId,
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

            // อัปโหลดรูปแยกกลุ่ม - จัดกลุ่มตามข้อที่มี
            // สำหรับ simple: ใช้ q-prefix, สำหรับ group items: ใช้ item key
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
            router.replace(`/dashboard/pm-report?station_id=${encodeURIComponent(stationId)}&saved=1&tab=station`);
        } catch (err: any) {
            alert(`บันทึกไม่สำเร็จ: ${err?.message ?? err}`);
        } finally {
            setSubmitting(false);
        }
    };

    const renderQuestionBlock = (q: Question, mode: TabId) => {
        // const subtitle = FIELD_GROUPS[q.no]?.note;
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
     * RENDER
     * ========================= */
    return (
        <section>
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
                        {/* ขวาสุด: ชื่อเอกสาร / เลขที่เอกสาร (ซ่อนใน post mode) */}
                        {!isPostMode && (
                            <div className="tw-text-right tw-text-sm tw-text-blue-gray-700">
                                <div className="tw-font-semibold">
                                    Document Name.
                                </div>
                                <div>
                                    {docName || "-"}
                                </div>
                            </div>
                        )}
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
                                    label="PM Date / วันที่ตรวจ"
                                    type="text"
                                    value={job.date}
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


                    <CardFooter className="tw-flex tw-flex-col tw-gap-3 tw-mt-8">
                        <div className="tw-p-3 tw-flex tw-flex-col tw-gap-3">
                            {/* ข้อ 1 (ใช้ค่าที่เลือกตาม tab) */}
                            <Section title="1) ตรวจสอบการแนบรูปภาพ (ทุกข้อ)" ok={allPhotosAttached}>
                                <Typography variant="small" className="!tw-text-amber-700">
                                    ยังไม่ได้แนบรูปข้อ: {missingPhotoItems.join(", ")}
                                </Typography>
                            </Section>


                            {/* บล็อก 3 & 4 แสดงเฉพาะหลัง (post) */}
                            {isPostMode && (
                                <>
                                    <Section title="2) สถานะ PASS / FAIL / N/A ทั้ง 18 ข้อ" ok={allPFAnsweredForUI}>
                                        <Typography variant="small" className="!tw-text-amber-700">
                                            ยังไม่ได้เลือกข้อ: {missingPFItemsForUI.join(", ")}
                                        </Typography>
                                    </Section>

                                    <Section title="3) สรุปผลการตรวจสอบ" ok={isSummaryFilled && isSummaryCheckFilled}>
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