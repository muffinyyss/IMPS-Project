"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Button, Input, Textarea, Select, Option } from "@material-tailwind/react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { draftKey, saveDraftLocal, loadDraftLocal, clearDraftLocal } from "../lib/draft";

type Severity = "" | "Low" | "Medium" | "High" | "Critical";
// type Status = "" | "Open" | "In Progress" | "Closed";
type Status = "" | "Open" | "In Progress";

type CorrectiveItem = {
    text: string;
    images: { file: File; url: string }[];
};

type Job = {
    issue_id: string;
    found_date: string;
    location: string;
    equipment_list: string[];
    problem_details: string;
    problem_type: string;
    severity: Severity;
    reported_by: string[];
    assignee: string;
    initial_cause: string;
    corrective_actions: CorrectiveItem[];
    resolved_date: string;
    repair_result: RepairOption | "";
    preventive_action: string[];
    status: Status;
    remarks: string;
};



type RepairOption = typeof REPAIR_OPTIONS[number];

const REPAIR_OPTIONS = [
    "แก้ไขสำเร็จ",
    "แก้ไขไม่สำเร็จ",
    "อยู่ระหว่างการติดตามผล",
    "อยู่ระหว่างการรออะไหล่",
] as const;
const STATUS_LABEL: Record<Exclude<Status, "">, string> = {
    Open: "Open",
    "In Progress": "In Progress",
    // Closed: "Closed",
};

const SEVERITY_OPTIONS: Severity[] = ["", "Low", "Medium", "High", "Critical"];
// const STATUS_OPTIONS: Status[] = ["", "Open", "In Progress", "Closed"];
// const STATUS_OPTIONS: Status[] = ["", "Open"];


const LOGO_SRC = "/img/logo_egat.png";
const LIST_ROUTE = "/dashboard/cm-report";

/* ค่าตั้งต้นของฟอร์ม (ใช้สำหรับ reset ด้วย) */
const INITIAL_JOB: Job = {
    issue_id: "",
    found_date: "",
    location: "",
    equipment_list: [""],
    problem_details: "",
    problem_type: "",
    severity: "",
    reported_by: [""],
    assignee: "",
    initial_cause: "",
    corrective_actions: [{ text: "", images: [] }],
    resolved_date: "",
    repair_result: "",
    preventive_action: [""],
    status: "",
    remarks: "",
};

type StationPublic = {
    station_id: string;
    station_name: string;
    SN?: string;
    WO?: string;
    chargeBoxID?: string;
    model?: string;
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";


async function fetchPreviewIssueId(
    stationId: string,
    foundDate: string
): Promise<string | null> {
    const u = new URL(`${API_BASE}/cmreport/preview-issueid`);
    u.searchParams.set("station_id", stationId);
    u.searchParams.set("found_date", foundDate);

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
    cmDate: string
): Promise<string | null> {
    const u = new URL(`${API_BASE}/cmreport/preview-docname`);
    u.searchParams.set("station_id", stationId);
    u.searchParams.set("found_date", cmDate);

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

export default function CMOpenForm() {
    const [me, setMe] = useState<Me | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();                  // 👈
    // const stationId = searchParams.get("station_id");
    const [stationId, setStationId] = useState<string | null>(null);
    const [docName, setDocName] = useState<string>("");

    const editId = searchParams.get("edit_id") ?? "";
    const isEdit = !!editId;

    const todayStr = useMemo(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;       // YYYY-MM-DD (ตามเวลาท้องถิ่น browser)
    }, []);

    useEffect(() => {
        const sidFromUrl = searchParams.get("station_id");
        if (sidFromUrl) {
            setStationId(sidFromUrl);
            localStorage.setItem("selected_station_id", sidFromUrl);
            return;
        }
        const sidLocal = localStorage.getItem("selected_station_id");
        setStationId(sidLocal);
    }, [searchParams]);

    const STATUS_OPTIONS = useMemo<Status[]>(
        () => (isEdit ? ["", "Open", "In Progress"] : ["", "Open"]),
        [isEdit]
    );

    // ด้านบนใน component (ใต้ const stationId = ... ได้เลย)
    const buildListUrl = () => {
        const params = new URLSearchParams();
        if (stationId) params.set("station_id", stationId);
        const tab = (searchParams.get("tab") ?? "open"); // กลับแท็บเดิม (default = open)
        params.set("tab", tab);
        return `${LIST_ROUTE}?${params.toString()}`;
    };

    const [job, setJob] = useState<Job>({ ...INITIAL_JOB });
    const [summary, setSummary] = useState<string>("");
    const [saving, setSaving] = useState(false);


    // เดิม header อิง label/type; ตอนนี้คงไว้เป็นค่าคงที่กลาง
    // const headerLabel = useMemo(() => "CM Report", []);
    const headerLabel = useMemo(() => (editId ? "CM Report (Edit)" : "CM Report (Add)"), [editId]);


    const onSave = () => {
        console.log({ job, summary });
        alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
    };


    const onFinalSave = async () => {
        try {
            if (!stationId) {
                alert("ไม่พบ station_id ใน URL");
                return;
            }
            setSaving(true);

            if (isEdit && editId) {
                // 👇 โหมดแก้ไข: อัปเดตสถานะอย่างเดียว
                const res = await fetch(
                    `${API_BASE}/cmreport/${encodeURIComponent(editId)}/status`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                            station_id: stationId,
                            status: job.status || "Open",
                        }),
                    }
                );
                if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);
            } else {
                // 👇 โหมดเพิ่มใหม่: ทำเหมือนเดิม (สร้าง -> อัปโหลดรูป)
                const payload = {
                    station_id: stationId,
                    found_date: (job.found_date || "").slice(0, 10),
                    summary,
                    job: {
                        ...job,
                        corrective_actions: job.corrective_actions.map((c) => ({
                            text: c.text,
                            images: c.images.map((img) => ({ name: img.file?.name ?? "" })),
                        })),
                    },
                };

                const res = await fetch(`${API_BASE}/cmreport/submit`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

                const { report_id } = await res.json();
                await uploadPhotosForReport(report_id);
            }

            // กลับหน้า list (คง tab/station เดิม)
            router.replace(buildListUrl());
        } catch (e: any) {
            console.error(e);
            alert(`บันทึกไม่สำเร็จ: ${e.message || e}`);
        } finally {
            setSaving(false);
        }
    };


    const onCancelLocal = () => {
        const evt = new CustomEvent("cmform:cancel", { cancelable: true });
        const wasPrevented = !window.dispatchEvent(evt);
        if (!wasPrevented) {
            router.replace(buildListUrl()); // 🔁 กลับไปหน้า list พร้อม station_id & tab
        }
    };

    const handlePrint = () => window.print();

    /* -------------------- Helpers: ลดความซ้ำซ้อน -------------------- */
    type StringListKey = "equipment_list" | "preventive_action" | "reported_by";

    const setStringItem =
        (key: StringListKey) => (i: number, val: string) =>
            setJob((prev) => {
                const list = [...prev[key]];
                list[i] = val;
                return { ...prev, [key]: list };
            });

    const addStringItem =
        (key: StringListKey) => () =>
            setJob((prev) => ({ ...prev, [key]: [...prev[key], ""] }));

    const removeStringItem =
        (key: StringListKey) => (i: number) =>
            setJob((prev) => {
                const list = [...prev[key]];
                if (list.length <= 1) return { ...prev, [key]: [""] }; // อย่างน้อย 1 ช่อง
                list.splice(i, 1);
                return { ...prev, [key]: list };
            });

    const patchCorrective = (i: number, patch: Partial<CorrectiveItem>) =>
        setJob((prev) => {
            const list = [...prev.corrective_actions];
            list[i] = { ...list[i], ...patch };
            return { ...prev, corrective_actions: list };
        });

    const addCorrective = () =>
        setJob((prev) => ({
            ...prev,
            corrective_actions: [...prev.corrective_actions, { text: "", images: [] }],
        }));

    const removeCorrective = (i: number) =>
        setJob((prev) => {
            const list = [...prev.corrective_actions];
            if (list.length <= 1) return { ...prev, corrective_actions: [{ text: "", images: [] }] };
            list.splice(i, 1);
            return { ...prev, corrective_actions: list };
        });

    const addCorrectiveImages = (i: number, files: FileList | null) => {
        if (!files?.length) return;
        const imgs = Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }));
        const current = job.corrective_actions[i];
        patchCorrective(i, { images: [...current.images, ...imgs] });
    };

    const removeCorrectiveImage = (i: number, j: number) => {
        const imgs = [...job.corrective_actions[i].images];
        const url = imgs[j]?.url;
        if (url) URL.revokeObjectURL(url);
        imgs.splice(j, 1);
        patchCorrective(i, { images: imgs });
    };
    type NextIssueIdParams = {
        latestId?: string | null; // รหัสล่าสุดของเดือนนั้น (ถ้ามี)
        date?: Date | string;     // วันที่อ้างอิง (เช่น found_date)
        prefix?: string;          // ค่าเริ่มต้น "EL"
        pad?: number;             // จำนวนหลักของเลขรัน (เริ่มต้น 2 => 01, 02, ...)
        start?: number;           // เริ่มนับที่เลขไหน (เริ่มต้น 1)
    };

    // function makeNextIssueId({
    //     latestId = null,
    //     date = new Date(),
    //     prefix = "EL",
    //     pad = 2,
    //     start = 1,
    // }: NextIssueIdParams = {}): string {
    //     const d = typeof date === "string" ? new Date(date) : date;
    //     const y = d.getFullYear();
    //     const m = String(d.getMonth() + 1).padStart(2, "0");
    //     const base = `${prefix}-${y}-${m}`;

    //     let seq = start;

    //     if (latestId) {
    //         // รองรับรูปแบบ EL-YYYY-MMNN...
    //         const rx = new RegExp(`^${prefix}-(\\d{4})-(\\d{2})(\\d+)$`);
    //         const m2 = latestId.match(rx);
    //         if (m2) {
    //             const [_, yy, mm, tail] = m2;
    //             if (Number(yy) === y && mm === m) {
    //                 seq = Math.max(Number(tail) + 1, start);
    //             }
    //         }
    //     }

    //     const tail = String(seq).padStart(pad, "0");
    //     return `${base}${tail}`;
    // }

    function localTodayISO(): string {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    // ⭐ ดึง station_name จาก API แล้วอัปเดตช่อง "สถานที่"
    useEffect(() => {
        let alive = true;
        if (!stationId) return;

        (async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/station/info/public?station_id=${encodeURIComponent(stationId)}`,
                    { cache: "no-store" }
                );
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data: { station: StationPublic } = await res.json();

                if (!alive) return;
                setJob(prev => ({
                    ...prev,
                    location: data.station.station_name || prev.location, 
                }));
            } catch (err) {
                console.error("โหลดข้อมูลสถานีไม่สำเร็จ:", err);
                // จะ alert ก็ได้ถ้าต้องการ
            }
        })();

        return () => { alive = false; };
    }, [stationId]);

    useEffect(() => {
        if (!stationId || !job.found_date) return;

        let canceled = false;

        (async () => {
            try {
                const preview = await fetchPreviewIssueId(stationId, job.found_date);
                if (!canceled && preview) {
                    setJob(prev => ({ ...prev, issue_id: preview }));
                }
            } catch (err) {
                console.error("preview issue_id error:", err);
                // ถ้า error ปล่อยให้ว่างไว้ → backend จะ gen เองตอน submit
            }
        })();

        return () => { canceled = true; };
    }, [stationId, job.found_date]);


    useEffect(() => {
        if (!stationId || !job.found_date) return;

        let canceled = false;

        (async () => {
            try {
                const preview = await fetchPreviewDocName(stationId, job.found_date);

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
    }, [stationId, job.found_date]);

    useEffect(() => {
        if (!editId || !stationId) return;         // 👈 ต้องมีทั้ง editId และ stationId

        (async () => {
            try {
                const url = `${API_BASE}/cmreport/${encodeURIComponent(editId)}?station_id=${encodeURIComponent(stationId)}`;
                const res = await fetch(url, { credentials: "include" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                setJob(prev => ({
                    ...prev,
                    // ใช้ค่า top-level ของ backend เป็นหลัก (มี backup เป็น job.*)
                    issue_id: data.issue_id ?? data.job?.issue_id ?? prev.issue_id,
                    found_date: data.found_date ?? data.job?.found_date ?? prev.found_date,
                    location: data.job?.location ?? prev.location,
                    problem_details: data.job?.problem_details ?? prev.problem_details,
                    problem_type: data.job?.problem_type ?? prev.problem_type,
                    severity: (data.job?.severity ?? "") as Severity,
                    status: (data.job?.status ?? "Open") as Status,
                    initial_cause: data.job?.initial_cause ?? prev.initial_cause,
                    remarks: data.job?.remarks ?? prev.remarks,
                }));
                setSummary(data.summary ?? "");
            } catch (e) {
                console.error("โหลดรายงานเดิมไม่สำเร็จ:", e);
            }
        })();
    }, [editId, stationId]);

    async function uploadPhotosForReport(reportId: string) {
        if (!stationId) return;

        // loop แต่ละข้อของ Corrective Action → map เป็น group=g1,g2,...
        for (let i = 0; i < job.corrective_actions.length; i++) {
            const item = job.corrective_actions[i];
            const files = item.images.map((im) => im.file).filter(Boolean) as File[];
            if (!files.length) continue; // ข้อนี้ไม่มีรูปก็ข้าม

            const group = `g${i + 1}`; // g1, g2, ... (อย่าเกินที่ backend รองรับ)
            const fd = new FormData();
            fd.append("station_id", stationId);
            fd.append("group", group);
            if (item.text) fd.append("remark", item.text); // จะไม่ส่งก็ได้

            // แนบหลายไฟล์ด้วย key "files" ซ้ำ ๆ
            files.forEach((f) => fd.append("files", f, f.name));

            const res = await fetch(`${API_BASE}/cmreport/${encodeURIComponent(reportId)}/photos`, {
                method: "POST",
                body: fd,
                credentials: "include", // ถ้าใช้ cookie httpOnly
                // ถ้าใช้ Bearer token ให้ใส่ headers.Authorization แทน
            });

            if (!res.ok) {
                const msg = await res.text().catch(() => `HTTP ${res.status}`);
                throw new Error(`อัปโหลดรูปข้อที่ ${i + 1} ล้มเหลว: ${msg}`);
            }
        }
    }

    /* ----------------------------------------------------------------- */

    return (
        <section className="tw-pb-24">
            <form
                action="#"
                noValidate
                onSubmit={(e) => {
                    e.preventDefault();
                    return false;
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                }}
            >
                <div className="tw-mx-auto tw-max-w-4xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-sm tw-p-6 md:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0">
                    {/* HEADER */}
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
                                    รายงานบันทึกปัญหา (CM) – {headerLabel}
                                </div>
                                <div className="tw-text-sm tw-text-blue-gray-600">
                                    การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)<br />
                                    เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย<br />
                                    จังหวัดนนทบุรี 11130 ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416
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

                        {/* ปุ่มด้านขวาใน HEADER */}
                        {/* <div className="tw-flex tw-items-start tw-gap-2 tw-print:tw-hidden">
                            <Button
                                type="button"
                                variant="text"
                                color="blue-gray"
                                className="tw-h-10 tw-text-sm"
                                onClick={onCancelLocal}
                            >
                                ยกเลิก
                            </Button>
                            <Button
                                type="button"
                                variant="outlined"
                                className="tw-h-10 tw-text-sm"
                                onClick={handlePrint}
                            >
                                พิมพ์เอกสาร
                            </Button>
                        </div> */}
                    </div>

                    {/* BODY */}
                    <div className="tw-mt-8 tw-space-y-8">
                        {/* META – การ์ดหัวเรื่อง */}
                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            <div className="lg:tw-col-span-1">
                                <Input
                                    label="Issue Id / รหัสเอกสาร"
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
                                    value={job.location}
                                    onChange={(e) => setJob({ ...job, location: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-bg-blue-gray-50"
                                />
                            </div>
                            <div className="lg:tw-col-span-2">
                                <Input
                                    label="found date/ วันที่พบปัญหา"
                                    type="date"
                                    value={job.found_date}
                                    max={todayStr}  // ⬅️ จำกัดไม่ให้เลือกเกินวันนี้
                                    onChange={(e) => setJob({ ...job, found_date: e.target.value })}
                                    crossOrigin=""
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                />
                            </div>



                            {/* <div className="lg:tw-col-span-1">
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    เสร็จสิ้น
                                </label>
                                <Input
                                    type="date"
                                    value={(job.resolved_date || "").slice(0, 10)}
                                    min={(job.found_date || "").slice(0, 10)}
                                    onChange={(e) => setJob({ ...job, resolved_date: e.target.value })}
                                    crossOrigin=""
                                    className="!tw-w-full"
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div> */}
                        </div>
                        {/* <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            <div className="sm:tw-col-span-2 lg:tw-col-span-3">
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    Work order
                                </label>
                                <Input
                                    value={job.wo}
                                    onChange={(e) => setJob({ ...job, wo: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    className="!tw-w-full !tw-bg-blue-gray-50"
                                    // className="!tw-w-full"
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div>

                            <div className="sm:tw-col-span-2 lg:tw-col-span-3">
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    Serial
                                </label>
                                <Input
                                    value={job.sn}
                                    onChange={(e) => setJob({ ...job, sn: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    className="!tw-w-full !tw-bg-blue-gray-50"
                                    // className="!tw-w-full"
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div>


                        </div> */}


                        {/* รายละเอียดปัญหา */}
                        <div>
                            <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                                รายละเอียดปัญหา
                            </div>
                            <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                                <div className="tw-space-y-4">
                                    <Input
                                        label="Equipment / อุปกรณ์"
                                        value={job.problem_type}
                                        onChange={(e) => setJob({ ...job, problem_type: e.target.value })}
                                        crossOrigin=""
                                        readOnly={isEdit}
                                        className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                    />

                                    <Select
                                        label="Severity / ความรุนแรง"
                                        value={job.severity}
                                        disabled={isEdit}
                                        onChange={(value) =>
                                            setJob((prev) => ({ ...prev, severity: value as Severity }))
                                        }
                                        className={isEdit ? "!tw-bg-blue-gray-50 !tw-text-blue-gray-400" : ""}
                                    >
                                        {SEVERITY_OPTIONS.map((s) => (
                                            <Option key={s} value={s}>
                                                {s || "เลือก..."}
                                            </Option>
                                        ))}
                                    </Select>
                                </div>
                                <Input
                                    label="ประเภทปัญหา"
                                    value={job.problem_type}
                                    onChange={(e) => setJob({ ...job, problem_type: e.target.value })}
                                    crossOrigin=""
                                    readOnly={isEdit}
                                    className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                />
                                <Textarea
                                    label="รายละเอียด"
                                    rows={3}
                                    value={job.problem_details}
                                    onChange={(e) => setJob({ ...job, problem_details: e.target.value })}
                                    readOnly={isEdit}
                                    className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />

                                {/* สถานะงาน */}
                                <div>
                                    <div className="tw-text-sm tw-font-medium tw-text-blue-gray-800 tw-mb-2">
                                        สถานะงาน
                                    </div>

                                    <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-2">
                                        {STATUS_OPTIONS.filter((s) => s).map((opt) => (
                                            <label
                                                key={opt}
                                                className={`tw-flex tw-items-center tw-gap-2 tw-rounded-lg tw-border
                                                    tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50
                                                    ${job.status === opt
                                                        ? "tw-border-blue-500 tw-ring-1 tw-ring-blue-100"
                                                        : "tw-border-blue-gray-200"}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="status"
                                                    value={opt}
                                                    className="tw-h-4 tw-w-4 tw-border-blue-gray-300 focus:tw-ring-0 focus:tw-outline-none"
                                                    checked={job.status === opt}
                                                    onChange={() => setJob((prev) => ({ ...prev, status: opt as Status }))}
                                                />
                                                <span className="tw-text-sm tw-text-blue-gray-800">
                                                    {STATUS_LABEL[opt as Exclude<Status, "">]}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* สาเหตุ */}
                        <div className="tw-space-y-2">
                            <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">
                                สาเหตุเบื้องต้น
                            </div>
                            <Textarea
                                label="สาเหตุ"
                                rows={3}
                                value={job.initial_cause}
                                onChange={(e) => setJob({ ...job, initial_cause: e.target.value })}
                                readOnly={isEdit}
                                className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                containerProps={{ className: "!tw-min-w-0" }}
                            />
                        </div>

                        {/* หมายเหตุ */}
                        <div>
                            <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                                หมายเหตุ
                            </div>
                            <Textarea
                                label="หมายเหตุ"
                                rows={3}
                                value={job.remarks}
                                onChange={(e) => setJob({ ...job, remarks: e.target.value })}
                                readOnly={isEdit}
                                className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                containerProps={{ className: "!tw-min-w-0" }}
                            />
                        </div>

                        {/* FOOTER + ปุ่มบันทึก */}
                        <div className="tw-flex tw-items-center tw-justify-between tw-print:tw-mt-8">
                            <div />
                            <div className="tw-flex tw-gap-2 tw-print:tw-hidden">
                                <Button
                                    type="button"
                                    variant="outlined"
                                    color="blue-gray"
                                    onClick={onSave}
                                    className="tw-h-10 tw-text-sm"
                                >
                                    บันทึกชั่วคราว
                                </Button>
                                <Button type="button" onClick={onFinalSave} className="tw-h-10 tw-text-sm">
                                    บันทึก
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* print styles */}
                <style jsx global>
                    {`
                        @media print {
                            body {
                                background: white !important;
                            }
                            .tw-print\\:tw-hidden {
                                display: none !important;
                            }
                        }
                    `}
                </style>
            </form>
        </section >
    );
}
