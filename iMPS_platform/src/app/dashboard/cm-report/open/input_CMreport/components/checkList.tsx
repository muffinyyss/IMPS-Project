"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Button, Input, Textarea } from "@material-tailwind/react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

type Severity = "" | "Low" | "Medium" | "High" | "Critical";
type Status = "" | "Open" | "In Progress";

type CorrectiveItem = {
    text: string;
    images: { file: File; url: string }[];
};

type Job = {
    issue_id: string;
    doc_name: string;      // เพิ่ม
    found_date: string;
    location: string;
    wo: string;
    sn: string;
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
};

const SEVERITY_OPTIONS: Severity[] = ["", "Low", "Medium", "High", "Critical"];

const LOGO_SRC = "/img/logo_egat.png";
const LIST_ROUTE = "/dashboard/cm-report";

/* ค่าตั้งต้นของฟอร์ม */
const INITIAL_JOB: Job = {
    issue_id: "",
    doc_name: "",          // เพิ่ม
    found_date: "",
    location: "",
    wo: "",
    sn: "",
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function CMOpenForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [stationId, setStationId] = useState<string | null>(null);

    const editId = searchParams.get("edit_id") ?? "";
    const isEdit = !!editId;

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

    const buildListUrl = () => {
        const params = new URLSearchParams();
        if (stationId) params.set("station_id", stationId);
        const tab = (searchParams.get("tab") ?? "open");
        params.set("tab", tab);
        return `${LIST_ROUTE}?${params.toString()}`;
    };

    const [job, setJob] = useState<Job>({ ...INITIAL_JOB });
    const [summary, setSummary] = useState<string>("");
    const [saving, setSaving] = useState(false);
    const [inspector, setInspector] = useState<string>("");

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
                // โหมดแก้ไข: อัปเดตสถานะ
                const res = await fetch(
                    `${API_BASE}/cmreport/${encodeURIComponent(editId)}/status`,
                    {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({
                            station_id: stationId,
                            status: job.status || "Open",
                            job: {
                                ...job,
                                corrective_actions: job.corrective_actions.map((c) => ({
                                    text: c.text,
                                    images: c.images.map((img) => ({ name: img.file?.name ?? "" })),
                                })),
                            },
                            summary,
                            inspector,
                        }),
                    }
                );
                if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);
            } else {
                // โหมดเพิ่มใหม่
                const payload = {
                    station_id: stationId,
                    cm_date: (job.found_date || "").slice(0, 10),
                    summary,
                    inspector,
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

                const { report_id, doc_name, issue_id } = await res.json();
                
                // อัปเดต state ด้วยค่าที่ได้จาก backend
                setJob(prev => ({ ...prev, doc_name, issue_id }));
                
                await uploadPhotosForReport(report_id);
            }

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
            router.replace(buildListUrl());
        }
    };

    const handlePrint = () => window.print();

    /* -------------------- Helpers -------------------- */
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
                if (list.length <= 1) return { ...prev, [key]: [""] };
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

    function localTodayISO(): string {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    // ดึง station_name จาก API
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
                    wo: data.station.WO ?? prev.wo,
                    sn: data.station.SN ?? prev.sn
                }));
            } catch (err) {
                console.error("โหลดข้อมูลสถานีไม่สำเร็จ:", err);
            }
        })();

        return () => { alive = false; };
    }, [stationId]);

    // ดึง /me สำหรับ inspector
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/me`, {
                    credentials: "include",
                });
                if (!res.ok) return;
                const data = await res.json();
                if (!alive) return;
                setInspector(data.username || "");
            } catch (err) {
                console.error("fetch /me error:", err);
            }
        })();
        return () => { alive = false; };
    }, []);

    // Preview doc_name และ issue_id จาก backend (สำหรับ Add mode)
    useEffect(() => {
        if (isEdit || !stationId) return;

        let alive = true;
        const todayStr = localTodayISO();

        (async () => {
            try {
                const url = `${API_BASE}/cmreport/preview-docname?station_id=${encodeURIComponent(stationId)}&cm_date=${todayStr}`;
                const res = await fetch(url, { credentials: "include" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                if (!alive) return;
                setJob(prev => ({
                    ...prev,
                    found_date: todayStr,
                    issue_id: data.issue_id || prev.issue_id,
                    doc_name: data.doc_name || prev.doc_name,
                }));
            } catch (err) {
                console.error("preview-docname error:", err);
                // fallback: ใช้วันที่วันนี้
                if (alive) {
                    setJob(prev => ({ ...prev, found_date: todayStr }));
                }
            }
        })();

        return () => { alive = false; };
    }, [stationId, isEdit]);

    // อัปเดต preview เมื่อเปลี่ยนวันที่ (Add mode)
    const handleDateChange = async (newDate: string) => {
        setJob(prev => ({ ...prev, found_date: newDate }));

        if (isEdit || !stationId || !newDate) return;

        try {
            const url = `${API_BASE}/cmreport/preview-docname?station_id=${encodeURIComponent(stationId)}&cm_date=${newDate}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) return;
            const data = await res.json();

            setJob(prev => ({
                ...prev,
                issue_id: data.issue_id || prev.issue_id,
                doc_name: data.doc_name || prev.doc_name,
            }));
        } catch (err) {
            console.error("preview-docname on date change error:", err);
        }
    };

    // โหลดข้อมูลเดิมสำหรับ Edit mode
    useEffect(() => {
        if (!editId || !stationId) return;

        (async () => {
            try {
                const url = `${API_BASE}/cmreport/${encodeURIComponent(editId)}?station_id=${encodeURIComponent(stationId)}`;
                const res = await fetch(url, { credentials: "include" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                setJob(prev => ({
                    ...prev,
                    doc_name: data.doc_name ?? prev.doc_name,
                    issue_id: data.issue_id ?? data.job?.issue_id ?? prev.issue_id,
                    found_date: data.cm_date ?? data.job?.found_date ?? prev.found_date,
                    location: data.job?.location ?? prev.location,
                    wo: data.job?.wo ?? prev.wo,
                    sn: data.job?.sn ?? prev.sn,
                    problem_details: data.job?.problem_details ?? prev.problem_details,
                    problem_type: data.job?.problem_type ?? prev.problem_type,
                    severity: (data.job?.severity ?? "") as Severity,
                    status: (data.status ?? data.job?.status ?? "Open") as Status,
                    initial_cause: data.job?.initial_cause ?? prev.initial_cause,
                    remarks: data.job?.remarks ?? prev.remarks,
                }));
                setSummary(data.summary ?? "");
                setInspector(data.inspector ?? "");
            } catch (e) {
                console.error("โหลดรายงานเดิมไม่สำเร็จ:", e);
            }
        })();
    }, [editId, stationId]);

    async function uploadPhotosForReport(reportId: string) {
        if (!stationId) return;

        for (let i = 0; i < job.corrective_actions.length; i++) {
            const item = job.corrective_actions[i];
            const files = item.images.map((im) => im.file).filter(Boolean) as File[];
            if (!files.length) continue;

            const group = `g${i + 1}`;
            const fd = new FormData();
            fd.append("station_id", stationId);
            fd.append("group", group);
            if (item.text) fd.append("remark", item.text);

            files.forEach((f) => fd.append("files", f, f.name));

            const res = await fetch(`${API_BASE}/cmreport/${encodeURIComponent(reportId)}/photos`, {
                method: "POST",
                body: fd,
                credentials: "include",
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
                    </div>

                    {/* BODY */}
                    <div className="tw-mt-8 tw-space-y-8">
                        {/* META */}
                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            {/* Document Name - เพิ่มใหม่ */}
                            <div className="lg:tw-col-span-2">
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    Document Name
                                </label>
                                <Input
                                    value={job.doc_name || "-"}
                                    readOnly
                                    key={job.doc_name}
                                    crossOrigin=""
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-w-full !tw-bg-blue-gray-50"
                                />
                            </div>

                            {/* Issue ID */}
                            <div className="lg:tw-col-span-2">
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    Issue ID
                                </label>
                                <Input
                                    value={job.issue_id || "-"}
                                    readOnly
                                    key={job.issue_id}
                                    crossOrigin=""
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-w-full !tw-bg-blue-gray-50"
                                />
                            </div>

                            {/* วันที่ */}
                            <div className="lg:tw-col-span-2">
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    วันที่ CM
                                </label>
                                <Input
                                    type="date"
                                    value={(job.found_date || "").slice(0, 10)}
                                    onChange={(e) => handleDateChange(e.target.value)}
                                    crossOrigin=""
                                    readOnly={isEdit}
                                    className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div>
                        </div>

                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            {/* Location */}
                            <div className="sm:tw-col-span-2 lg:tw-col-span-3">
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    Location
                                </label>
                                <Input
                                    value={job.location}
                                    onChange={(e) => setJob({ ...job, location: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    className="!tw-w-full !tw-bg-blue-gray-50"
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div>

                            {/* Inspector - เพิ่มใหม่ */}
                            <div className="sm:tw-col-span-2 lg:tw-col-span-3">
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    ผู้ตรวจสอบ (Inspector)
                                </label>
                                <Input
                                    value={inspector}
                                    onChange={(e) => setInspector(e.target.value)}
                                    crossOrigin=""
                                    readOnly
                                    className="!tw-w-full !tw-bg-blue-gray-50"
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div>
                        </div>

                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            <div className="sm:tw-col-span-2 lg:tw-col-span-3">
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    Work Order
                                </label>
                                <Input
                                    value={job.wo}
                                    onChange={(e) => setJob({ ...job, wo: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    className="!tw-w-full !tw-bg-blue-gray-50"
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
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div>
                        </div>

                        {/* รายละเอียดปัญหา */}
                        <div>
                            <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                                รายละเอียดปัญหา
                            </div>
                            <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                                <div>
                                    <div className="tw-text-sm tw-font-medium tw-text-blue-gray-800 tw-mb-3">
                                        ความรุนแรง
                                    </div>
                                    <select
                                        value={job.severity}
                                        disabled={isEdit}
                                        onChange={(e) => setJob({ ...job, severity: e.target.value as Severity })}
                                        className={`tw-w-full tw-h-10 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-px-3 tw-py-2
                                            ${isEdit ? "tw-bg-blue-gray-50 tw-text-blue-gray-400 tw-cursor-not-allowed" : ""}`}
                                    >
                                        {SEVERITY_OPTIONS.map((s) => (
                                            <option key={s} value={s}>
                                                {s || "เลือก..."}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="tw-text-sm tw-font-medium tw-text-blue-gray-800 tw-mb-3">
                                    ประเภทปัญหา
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
                            <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4">
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
                                <Button 
                                    type="button" 
                                    onClick={onFinalSave} 
                                    disabled={saving}
                                    className="tw-h-10 tw-text-sm"
                                >
                                    {saving ? "กำลังบันทึก..." : "บันทึก"}
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
        </section>
    );
}