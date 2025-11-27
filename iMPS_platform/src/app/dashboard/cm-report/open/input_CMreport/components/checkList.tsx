"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Button, Input, Textarea, Select, Option } from "@material-tailwind/react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { draftKey, saveDraftLocal, loadDraftLocal, clearDraftLocal } from "../lib/draft";

type Severity = "" | "Low" | "Medium" | "High" | "Critical";
// type Status = "" | "Open" | "In Progress" | "Closed";
type Status = "" | "Open" | "In Progress" | "Closed";

type ImageItem = {
    file: File;
    url: string;
};

type CorrectiveItem = {
    text: string;
    images: { file: File; url: string }[];
};

type StringListKey = "equipment_list" | "preventive_action" | "assignee";

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
    Closed: "Closed",
};

const SEVERITY_OPTIONS: Severity[] = ["", "Low", "Medium", "High", "Critical"];


const LOGO_SRC = "/img/logo_egat.png";
const LIST_ROUTE = "/dashboard/cm-report";


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
    const searchParams = useSearchParams();
    const [stationId, setStationId] = useState<string | null>(null);
    const [issueID, setIssueID] = useState<string>("");
    const [docName, setDocName] = useState<string>("");
    const [location, setLocation] = useState<string>("");
    const [foundDate, setFoundDate] = useState<string>("");
    const [status, setStatus] = useState<Status>("");
    const [draftId, setDraftId] = useState<Status>("");
    const reportedBy = me?.username ?? "";

    const [open, setOpen] = useState({
        equipment: "",
        severity: "" as Severity,
        problem_type: "",
        problem_details: "",
        problem_img: [] as ImageItem[],
        initial_cause: "",
        remarks: "",
    });

    const [inprogress, setInprogress] = useState({
        equipment_list: [""],
        assignee: [""],
        corrective_actions: [{ text: "", images: [] }] as CorrectiveItem[],
        repair_result: "",
        preventive_action: [""],
        remarks: ""
    });

    const todayStr = useMemo(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;       // YYYY-MM-DD (ตามเวลาท้องถิ่น browser)
    }, []);

    const editId = searchParams.get("edit_id") ?? "";
    const isEdit = !!editId;

    const STATUS_OPTIONS = useMemo<Status[]>(
        () => (isEdit ? ["", "Open", "In Progress", "Closed"] : ["", "Open"]),
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

    // const [job, setJob] = useState<Job>({ ...INITIAL_JOB });
    const [saving, setSaving] = useState(false);


    // เดิม header อิง label/type; ตอนนี้คงไว้เป็นค่าคงที่กลาง
    // const headerLabel = useMemo(() => "CM Report", []);
    const headerLabel = useMemo(() => (editId ? "CM Report (Edit)" : "CM Report (Add)"), [editId]);


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

            } catch (err) {
                console.error("fetch /me error:", err);
            }
        })();
    }, []);

    useEffect(() => {
        if (isEdit) return;
        if (!stationId || !foundDate) return;

        let canceled = false;

        (async () => {
            try {
                const preview = await fetchPreviewIssueId(stationId, foundDate);
                if (!canceled && preview) {
                    setIssueID(preview);
                }
            } catch (err) {
                console.error("preview issue_id error:", err);
                // ถ้า error ปล่อยให้ว่างไว้ → backend จะ gen เองตอน submit
            }
        })();

        return () => { canceled = true; };
    }, [stationId, foundDate]);

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
                setLocation(data.station.station_name);
            } catch (err) {
                console.error("โหลดข้อมูลสถานีไม่สำเร็จ:", err);
                // จะ alert ก็ได้ถ้าต้องการ
            }
        })();

        return () => { alive = false; };
    }, [stationId]);




    useEffect(() => {
        if (isEdit) return;
        if (!stationId || !foundDate) return;

        let canceled = false;

        (async () => {
            try {
                const preview = await fetchPreviewDocName(stationId, foundDate);

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
    }, [stationId, foundDate]);

    useEffect(() => {
        if (!editId || !stationId) return; // ต้องมีทั้ง editId และ stationId

        (async () => {
            try {
                const url = `${API_BASE}/cmreport/${encodeURIComponent(editId)}?station_id=${encodeURIComponent(stationId)}`;
                const res = await fetch(url, { credentials: "include" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                setOpen({
                    equipment: data.open?.equipment ?? "",
                    severity: (data.open?.severity ?? "") as Severity,
                    problem_type: data.open?.problem_type ?? "",
                    problem_details: data.open?.problem_details ?? "",
                    problem_img: [], // ถ้าต้องแสดงรูปเดิม ค่อย map URL มาเป็น {url} ที่หลัง
                    initial_cause: data.open?.initial_cause ?? "",
                    remarks: data.open?.remarks ?? "",
                });

                setStatus((data.status ?? "Open") as Status);
                setIssueID(data.issue_id ?? "");
                setDocName(data.doc_name ?? "");
                setFoundDate((data.found_date ?? "").slice(0, 10));
            } catch (e) {
                console.error("โหลดรายงานเดิมไม่สำเร็จ:", e);
            }
        })();
    }, [editId, stationId]);


    const onSave = () => {
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
                            status: status || "Open",
                        }),
                    }
                );
                if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);
            } else {
                // 👇 โหมดเพิ่มใหม่: ทำเหมือนเดิม (สร้าง -> อัปโหลดรูป)
                const problemImgForApi = open.problem_img.map(im => ({ name: im.file?.name ?? "" }));
                const payload = {
                    station_id: stationId,
                    issue_id: issueID || undefined,   // ถ้ามี preview ก็ส่งไป ไม่มีก็ให้ backend gen
                    doc_name: docName || undefined,   // เช่นเดียวกัน
                    found_date: (foundDate || "").slice(0, 10),
                    open: {
                        equipment: open.equipment,
                        severity: open.severity,
                        problem_type: open.problem_type,
                        problem_details: open.problem_details,
                        problem_img: problemImgForApi,  // <— ส่งแบบ array ของ meta
                        initial_cause: open.initial_cause,
                        remarks: open.remarks,
                    },
                    status: (status || "Open"),   // <— อยู่นอก open
                    reported_by: reportedBy,
                };

                const res = await fetch(`${API_BASE}/cmreport/submit`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

                const { report_id } = await res.json();
                // await uploadPhotosForReport(report_id);
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

    const setStringItem =
        (key: StringListKey) => (i: number, val: string) =>
            setInprogress((prev) => {
                const list = [...prev[key]];
                list[i] = val;
                return { ...prev, [key]: list };
            });

    const addStringItem =
        (key: StringListKey) => () =>
            setInprogress((prev) => ({ ...prev, [key]: [...prev[key], ""] }));

    const removeStringItem =
        (key: StringListKey) => (i: number) =>
            setInprogress((prev) => {
                const list = [...prev[key]];
                if (list.length <= 1) return { ...prev, [key]: [""] }; // อย่างน้อย 1 ช่อง
                list.splice(i, 1);
                return { ...prev, [key]: list };
            });

    const patchCorrective = (i: number, patch: Partial<CorrectiveItem>) =>
        setOpen((prev) => {
            const list = [...prev.problem_img];
            list[i] = { ...list[i], ...patch };
            return { ...prev, corrective_actions: list };
        });

    const addCorrective = () =>
        setInprogress((prev) => ({
            ...prev,
            corrective_actions: [...prev.corrective_actions, { text: "", images: [] }],
        }));

    const removeCorrective = (i: number) =>
        setInprogress((prev) => {
            const list = [...prev.corrective_actions];
            if (list.length <= 1) return { ...prev, corrective_actions: [{ text: "", images: [] }] };
            list.splice(i, 1);
            return { ...prev, corrective_actions: list };
        });

    // const addProblemImages = (i: number, files: FileList | null) => {
    //     if (!files?.length) return;
    //     const imgs = Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }));
    //     const current = open.problem_img[i];
    //     patchCorrective(i, { images: [...current.images, ...imgs] });
    // };

    // const removeProblemImage  = (i: number, j: number) => {
    //     const imgs = [...open.problem_img[i].images];
    //     const url = imgs[j]?.url;
    //     if (url) URL.revokeObjectURL(url);
    //     imgs.splice(j, 1);
    //     patchCorrective(i, { images: imgs });
    // };
    const addProblemImages = (files: FileList | null) => {
        if (!files?.length) return;
        const imgs = Array.from(files).map(file => ({ file, url: URL.createObjectURL(file) }));
        setOpen(prev => ({ ...prev, problem_img: [...prev.problem_img, ...imgs] }));
    };

    const removeProblemImage = (idx: number) => {
        setOpen(prev => {
            const list = [...prev.problem_img];
            const u = list[idx]?.url;
            if (u) URL.revokeObjectURL(u);
            list.splice(idx, 1);
            return { ...prev, problem_img: list };
        });
    };

    const addCorrectiveImages = (i: number, files: FileList | null) => {
        if (!files?.length) return;
        const imgs = Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }));
        const current = inprogress.corrective_actions[i];
        patchCorrective(i, { images: [...current.images, ...imgs] });
    };

    const removeCorrectiveImage = (i: number, j: number) => {
        const imgs = [...inprogress.corrective_actions[i].images];
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


    function localTodayISO(): string {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }


    // async function uploadPhotosForReport(reportId: string) {
    //     if (!stationId) return;

    //     // loop แต่ละข้อของ Corrective Action → map เป็น group=g1,g2,...
    //     for (let i = 0; i < job.corrective_actions.length; i++) {
    //         const item = job.corrective_actions[i];
    //         const files = item.images.map((im) => im.file).filter(Boolean) as File[];
    //         if (!files.length) continue; // ข้อนี้ไม่มีรูปก็ข้าม

    //         const group = `g${i + 1}`; // g1, g2, ... (อย่าเกินที่ backend รองรับ)
    //         const fd = new FormData();
    //         fd.append("station_id", stationId);
    //         fd.append("group", group);
    //         if (item.text) fd.append("remark", item.text); // จะไม่ส่งก็ได้

    //         // แนบหลายไฟล์ด้วย key "files" ซ้ำ ๆ
    //         files.forEach((f) => fd.append("files", f, f.name));

    //         const res = await fetch(`${API_BASE}/cmreport/${encodeURIComponent(reportId)}/photos`, {
    //             method: "POST",
    //             body: fd,
    //             credentials: "include", // ถ้าใช้ cookie httpOnly
    //             // ถ้าใช้ Bearer token ให้ใส่ headers.Authorization แทน
    //         });

    //         if (!res.ok) {
    //             const msg = await res.text().catch(() => `HTTP ${res.status}`);
    //             throw new Error(`อัปโหลดรูปข้อที่ ${i + 1} ล้มเหลว: ${msg}`);
    //         }
    //     }
    // }

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

                    </div>


                    {/* BODY */}
                    <div className="tw-mt-8 tw-space-y-8">
                        {/* META – การ์ดหัวเรื่อง */}
                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
                            <div className="lg:tw-col-span-1">
                                <Input
                                    label="Issue Id / รหัสเอกสาร"
                                    value={issueID || "-"}
                                    readOnly
                                    crossOrigin=""
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-w-full !tw-bg-blue-gray-50"
                                />
                            </div>

                            <div className="sm:tw-col-span-2 lg:tw-col-span-2">
                                <Input
                                    label="Location / สถานที่"
                                    value={location}
                                    // onChange={(e) => setJob({ ...job, location: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-bg-blue-gray-50"
                                />
                            </div>
                            <div className="sm:tw-col-span-2 lg:tw-col-span-2">
                                <Input
                                    label="reported by / ผู้รายงาน"
                                    value={me?.username}
                                    // onChange={(e) => setJob({ ...job, location: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-bg-blue-gray-50"
                                />
                            </div>
                            <div className="lg:tw-col-span-1">
                                <Input
                                    label="found date/ วันที่พบปัญหา"
                                    type="date"
                                    value={foundDate}
                                    max={todayStr}  // ⬅️ จำกัดไม่ให้เลือกเกินวันนี้
                                    onChange={(e) => setFoundDate((e.target.value))}
                                    crossOrigin=""
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                />
                            </div>
                        </div>



                        {/* รายละเอียดปัญหา */}
                        <div>
                            {/* สถานะงาน */}
                            <div>
                                <div className="tw-text-sm tw-font-medium tw-text-blue-gray-800 tw-mb-2">
                                    สถานะงาน
                                </div>

                                <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-3 tw-gap-2 tw-mb-2">
                                    {STATUS_OPTIONS.filter((s) => s).map((opt) => (
                                        <label
                                            key={opt}
                                            className={`tw-flex tw-items-center tw-gap-2 tw-rounded-lg tw-border
                                                    tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50
                                                    ${status === opt
                                                    ? "tw-border-blue-500 tw-ring-1 tw-ring-blue-100"
                                                    : "tw-border-blue-gray-200"}`}
                                        >
                                            <input
                                                type="radio"
                                                name="status"
                                                value={opt}
                                                className="tw-h-4 tw-w-4 tw-border-blue-gray-300 focus:tw-ring-0 focus:tw-outline-none"
                                                checked={status === opt}
                                                onChange={() => setStatus(opt as Status)}
                                            />
                                            <span className="tw-text-sm tw-text-blue-gray-800">
                                                {STATUS_LABEL[opt as Exclude<Status, "">]}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="tw-space-y-3 tw-mb-3">
                                <div className="tw-flex tw-items-center tw-justify-between">
                                    <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">
                                        อุปกรณ์
                                    </span>
                                    <button
                                        type="button"
                                        onClick={addStringItem("equipment_list")}
                                        className="tw-text-sm tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-1 hover:tw-bg-blue-gray-50"
                                    >
                                        + เพิ่ม
                                    </button>
                                </div>

                                {inprogress.equipment_list.map((val, i) => (
                                    <div key={i} className="tw-flex tw-items-center tw-gap-2">
                                        <Input
                                            label={`รายการที่ ${i + 1}`}
                                            value={val}
                                            onChange={(e) => setStringItem("equipment_list")(i, e.target.value)}
                                            crossOrigin=""
                                            className="tw-flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeStringItem("equipment_list")(i)}
                                            disabled={inprogress.equipment_list.length <= 1}
                                            className={`tw-h-10 tw-rounded-md tw-border tw-px-3 ${inprogress.equipment_list.length <= 1
                                                ? "tw-border-blue-gray-100 tw-text-blue-gray-300 tw-cursor-not-allowed"
                                                : "tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50"
                                                }`}
                                            title={
                                                inprogress.equipment_list.length <= 1
                                                    ? "ต้องมีอย่างน้อย 1 รายการ"
                                                    : "ลบรายการนี้"
                                            }
                                        >
                                            ลบ
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                                รายละเอียดปัญหา
                            </div>
                            <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                                <div className="tw-space-y-4">
                                    {/* <Input
                                        label="Equipment / อุปกรณ์"
                                        value={open.equipment}
                                        onChange={(e) => setOpen({ ...open, equipment: e.target.value })}
                                        crossOrigin=""
                                        readOnly={isEdit}
                                        className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                    /> */}


                                    <Select
                                        label="Severity / ความรุนแรง"
                                        value={open.severity}
                                        disabled={isEdit}
                                        onChange={(value) =>
                                            setOpen((prev) => ({ ...prev, severity: value as Severity }))
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
                                    value={open.problem_type}
                                    onChange={(e) => setOpen({ ...open, problem_type: e.target.value })}
                                    crossOrigin=""
                                    readOnly={isEdit}
                                    className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                />
                                <Textarea
                                    label="รายละเอียด"
                                    rows={3}
                                    value={open.problem_details}
                                    onChange={(e) => setOpen({ ...open, problem_details: e.target.value })}
                                    readOnly={isEdit}
                                    className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />

                                {/* 🔽 แนบรูปประกอบปัญหา ใต้รายละเอียดปัญหา */}
                                <div className="tw-mt-4">
                                    <div className="tw-flex tw-flex-col tw-items-start tw-gap-1 tw-mb-2">
                                        {/* ปุ่มแนบรูป (อยู่ด้านบน) */}
                                        {!isEdit && (
                                            // <label
                                            //     className="
                                            //         tw-inline-flex tw-items-center tw-gap-2
                                            //         tw-text-sm tw-font-medium
                                            //         tw-border tw-border-blue-500 tw-text-blue-600
                                            //         tw-bg-white
                                            //         tw-rounded-full tw-px-3 tw-py-1.5
                                            //         tw-shadow-sm tw-cursor-pointer
                                            //         hover:tw-bg-blue-50 active:tw-scale-95
                                            //         tw-transition tw-duration-150
                                            //     "
                                            // >
                                            //     <span>+ แนบรูปภาพ</span>
                                            //     <input
                                            //         type="file"
                                            //         accept="image/*"
                                            //         multiple
                                            //         className="tw-hidden"
                                            //         onChange={(e) => {
                                            //             addProblemImages(e.target.files);  // ใช้ group แรกเป็นรูปปัญหา
                                            //             e.target.value = "";                     // reset input
                                            //         }}
                                            //     />
                                            // </label>
                                            <label className="tw-inline-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-rounded-md tw-border tw-border-blue-500 tw-px-3 tw-py-2 hover:tw-bg-blue-50">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    capture="environment"
                                                    className="tw-hidden"
                                                    onChange={(e) => {
                                                        addProblemImages(e.target.files);  // ใช้ group แรกเป็นรูปปัญหา
                                                        e.target.value = "";                     // reset input
                                                    }}
                                                />
                                                <span className="tw-text-sm tw-text-blue-500">+ เพิ่มรูป / ถ่ายรูป</span>
                                            </label>
                                        )}

                                        {/* ชื่อหัวข้ออยู่ใต้ปุ่ม */}
                                        <span className="tw-text-sm tw-font-medium tw-text-blue-gray-800 tw-mt-2">
                                            รูปประกอบปัญหา
                                        </span>
                                    </div>

                                    {/* {open.problem_img[0]?.images?.length ? (
                                            <div className="tw-flex tw-flex-wrap tw-gap-3">
                                                {open.problem_img[0].images.map((img, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="tw-relative tw-w-24 tw-h-24 tw-rounded-md tw-overflow-hidden tw-border tw-border-blue-gray-100"
                                                    >
                                                        <img
                                                            src={img.url}
                                                            alt={`Problem image ${idx + 1}`}
                                                            className="tw-w-full tw-h-full tw-object-cover"
                                                        />
                                                        {!isEdit && (
                                                            <button
                                                                type="button"
                                                                className="tw-absolute tw-top-1 tw-right-1 tw-bg-black/60 tw-text-white tw-text-xs tw-rounded-full tw-px-1.5 tw-py-0.5"
                                                                onClick={() => removeProblemImage(0, idx)}
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="tw-text-xs tw-text-blue-gray-400">
                                                {isEdit ? "ไม่มีรูปประกอบที่แนบไว้" : "ยังไม่ได้แนบรูปภาพ"}
                                            </p>
                                        )} */}
                                    {open.problem_img.length ? (
                                        <div className="tw-flex tw-flex-wrap tw-gap-3">
                                            {open.problem_img.map((img, idx) => (
                                                <div
                                                    key={idx}
                                                    className="tw-relative tw-w-24 tw-h-24 tw-rounded-md tw-overflow-hidden tw-border tw-border-blue-gray-100"
                                                >
                                                    <img
                                                        src={img.url}
                                                        alt={`Problem image ${idx + 1}`}
                                                        className="tw-w-full tw-h-full tw-object-cover"
                                                    />
                                                    {!isEdit && (
                                                        <button
                                                            type="button"
                                                            className="tw-absolute tw-top-1 tw-right-1 tw-bg-black/60 tw-text-white tw-text-xs tw-rounded-full tw-px-1.5 tw-py-0.5"
                                                            onClick={() => removeProblemImage(idx)}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="tw-text-xs tw-text-blue-gray-400">
                                            {isEdit ? "ไม่มีรูปประกอบที่แนบไว้" : "ยังไม่ได้แนบรูปภาพ"}
                                        </p>
                                    )}

                                </div>




                            </div>
                        </div>

                        อุปกรณ์
                        {/* 2 คอลัมน์: อุปกรณ์ */}
                        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
                            {/* อุปกรณ์ – หลายรายการ */}
                            <div className="tw-space-y-3">
                                <div className="tw-flex tw-items-center tw-justify-between">
                                    <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">
                                        อุปกรณ์
                                    </span>
                                    <button
                                        type="button"
                                        onClick={addStringItem("equipment_list")}
                                        className="tw-text-sm tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-1 hover:tw-bg-blue-gray-50"
                                    >
                                        + เพิ่ม
                                    </button>
                                </div>

                                {inprogress.equipment_list.map((val, i) => (
                                    <div key={i} className="tw-flex tw-items-center tw-gap-2">
                                        <Input
                                            label={`รายการที่ ${i + 1}`}
                                            value={val}
                                            onChange={(e) => setStringItem("equipment_list")(i, e.target.value)}
                                            crossOrigin=""
                                            className="tw-flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeStringItem("equipment_list")(i)}
                                            disabled={inprogress.equipment_list.length <= 1}
                                            className={`tw-h-10 tw-rounded-md tw-border tw-px-3 ${inprogress.equipment_list.length <= 1
                                                ? "tw-border-blue-gray-100 tw-text-blue-gray-300 tw-cursor-not-allowed"
                                                : "tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50"
                                                }`}
                                            title={
                                                inprogress.equipment_list.length <= 1
                                                    ? "ต้องมีอย่างน้อย 1 รายการ"
                                                    : "ลบรายการนี้"
                                            }
                                        >
                                            ลบ
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* ผู้รายงาน */}
                            <div className="tw-space-y-3">
                                <div className="tw-flex tw-items-center tw-justify-between">
                                    <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">
                                        ผู้รายงาน
                                    </span>
                                    <button
                                        type="button"
                                        onClick={addStringItem("assignee")}
                                        className="tw-text-sm tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-1 hover:tw-bg-blue-gray-50"
                                    >
                                        + เพิ่ม
                                    </button>
                                </div>

                                {inprogress.assignee.map((name, i) => (
                                    <div key={i} className="tw-flex tw-items-center tw-gap-2">
                                        <Input
                                            label={`ผู้ตรวจสอบที่ ${i + 1}`}
                                            value={name}
                                            onChange={(e) => setStringItem("assignee")(i, e.target.value)}
                                            crossOrigin=""
                                            className="tw-flex-1"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeStringItem("assignee")(i)}
                                            disabled={inprogress.assignee.length <= 1}
                                            className={`tw-h-10 tw-rounded-md tw-border tw-px-3 ${inprogress.assignee.length <= 1
                                                ? "tw-border-blue-gray-100 tw-text-blue-gray-300 tw-cursor-not-allowed"
                                                : "tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50"
                                                }`}
                                            title={inprogress.assignee.length <= 1 ? "ต้องมีอย่างน้อย 1 คน" : "ลบผู้รายงานนี้"}
                                        >
                                            ลบ
                                        </button>
                                    </div>
                                ))}
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
                                value={open.initial_cause}
                                onChange={(e) => setOpen({ ...open, initial_cause: e.target.value })}
                                readOnly={isEdit}
                                className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                containerProps={{ className: "!tw-min-w-0" }}
                            />
                        </div>

                        {isEdit && (
                            <div>
                                <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                                    การแก้ไข (Corrective Action)
                                </div>
                                <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                                    {/* รายการการแก้ไขหลายข้อ */}
                                    <div className="tw-space-y-4">
                                        <div className="tw-flex tw-items-center tw-justify-between">
                                            <span className="tw-text-sm tw-font-medium tw-text-blue-gray-800">
                                                รายการการแก้ไข
                                            </span>
                                            <button
                                                type="button"
                                                onClick={addCorrective}
                                                className="tw-text-sm tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-1 hover:tw-bg-blue-gray-50"
                                            >
                                                + เพิ่ม
                                            </button>
                                        </div>

                                        {inprogress.corrective_actions.map((item, i) => {
                                            const canDelete = inprogress.corrective_actions.length > 1;
                                            return (
                                                <div
                                                    key={i}
                                                    // className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-3 tw-space-y-3"
                                                    className="tw-border-b tw-border-blue-gray-100 tw-rounded-none tw-pb-4 tw-space-y-4"
                                                >
                                                    <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
                                                        <Textarea
                                                            label={`ข้อที่ ${i + 1}`}
                                                            rows={3}
                                                            value={item.text}
                                                            onChange={(e) => patchCorrective(i, { text: e.target.value })}
                                                            className="!tw-w-full"
                                                            containerProps={{ className: "!tw-min-w-0 tw-flex-1" }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeCorrective(i)}
                                                            disabled={!canDelete}
                                                            className={`tw-shrink-0 tw-ml-2 tw-h-9 tw-rounded-md tw-border tw-px-3 ${!canDelete
                                                                ? "tw-border-blue-gray-100 tw-text-blue-gray-300 tw-cursor-not-allowed"
                                                                : "tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50"
                                                                }`}
                                                            title={!canDelete ? "ต้องมีอย่างน้อย 1 ข้อ" : "ลบรายการนี้"}
                                                            aria-disabled={!canDelete}
                                                        >
                                                            ลบ
                                                        </button>
                                                    </div>

                                                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
                                                        {/* <label className="tw-inline-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50">
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                multiple
                                                                capture="environment"
                                                                className="tw-hidden"
                                                                onChange={(e) => addCorrectiveImages(i, e.target.files)}
                                                            />
                                                            <span className="tw-text-sm">+ เพิ่มรูป / ถ่ายรูป</span>
                                                        </label> */}
                                                        <label className="tw-inline-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-rounded-md tw-border tw-border-blue-500 tw-px-3 tw-py-2 hover:tw-bg-blue-50">
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                multiple
                                                                capture="environment"
                                                                className="tw-hidden"
                                                                onChange={(e) => addCorrectiveImages(i, e.target.files)}
                                                            />
                                                            <span className="tw-text-sm tw-text-blue-500">+ เพิ่มรูป / ถ่ายรูป</span>
                                                        </label>


                                                        {item.images.length > 0 && (
                                                            <div className="tw-w-full tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                                                                {item.images.map((img, j) => (
                                                                    <div
                                                                        key={j}
                                                                        className="tw-relative tw-aspect-video tw-rounded-md tw-overflow-hidden tw-border tw-border-blue-gray-100"
                                                                    >
                                                                        <img
                                                                            src={img.url}
                                                                            alt={`action-${i}-img-${j}`}
                                                                            className="tw-w-full tw-h-full tw-object-cover"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeCorrectiveImage(i, j)}
                                                                            className="tw-absolute tw-top-1 tw-right-1 tw-bg-white/80 tw-backdrop-blur tw-text-red-600 tw-text-xs tw-rounded tw-px-2 tw-py-1 hover:tw-bg-white"
                                                                        >
                                                                            ลบ
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* ผลหลังซ่อม */}
                                    <div>
                                        <div className="tw-text-sm tw-font-medium tw-text-blue-gray-800 tw-mb-3">
                                            ผลหลังซ่อม
                                        </div>
                                        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-x-4 tw-gap-y-2">
                                            {REPAIR_OPTIONS.map((opt) => (
                                                <label key={opt} className="tw-inline-flex tw-items-center tw-gap-2 tw-select-none">
                                                    <input
                                                        type="radio"
                                                        name="repair_result"
                                                        value={opt}
                                                        className="tw-h-4 tw-w-4 tw-border-blue-gray-300 focus:tw-ring-0 focus:tw-outline-none"
                                                        checked={inprogress.repair_result === opt}
                                                        onChange={() => setInprogress((prev) => ({ ...prev, repair_result: opt }))}
                                                    />
                                                    <span className="tw-text-sm tw-text-blue-gray-800">{opt}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* วิธีป้องกันซ้ำ – หลายข้อ */}
                                    <div className="tw-space-y-3">
                                        <div className="tw-flex tw-items-center tw-justify-between">
                                            <span className="tw-text-sm tw-font-medium tw-text-blue-gray-800">
                                                วิธีป้องกันซ้ำ
                                            </span>
                                            <button
                                                type="button"
                                                onClick={addStringItem("preventive_action")}
                                                className="tw-text-sm tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-1 hover:tw-bg-blue-gray-50"
                                            >
                                                + เพิ่ม
                                            </button>
                                        </div>

                                        {inprogress.preventive_action.map((val, i) => (
                                            <div key={i} className="tw-flex tw-items-center tw-gap-2">
                                                <Input
                                                    label={`ข้อที่ ${i + 1}`}
                                                    value={val}
                                                    onChange={(e) => setStringItem("preventive_action")(i, e.target.value)}
                                                    crossOrigin=""
                                                    className="tw-flex-1"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeStringItem("preventive_action")(i)}
                                                    disabled={inprogress.preventive_action.length <= 1}
                                                    className={`tw-h-10 tw-rounded-md tw-border tw-px-3 ${inprogress.preventive_action.length <= 1
                                                        ? "tw-border-blue-gray-100 tw-text-blue-gray-300 tw-cursor-not-allowed"
                                                        : "tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50"
                                                        }`}
                                                    title={
                                                        inprogress.preventive_action.length <= 1
                                                            ? "ต้องมีอย่างน้อย 1 ข้อ"
                                                            : "ลบวิธีนี้"
                                                    }
                                                >
                                                    ลบ
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* หมายเหตุ */}
                        <div>
                            <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                                หมายเหตุ
                            </div>
                            <Textarea
                                label="หมายเหตุ"
                                rows={3}
                                value={open.remarks}
                                onChange={(e) => setOpen({ ...open, remarks: e.target.value })}
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
