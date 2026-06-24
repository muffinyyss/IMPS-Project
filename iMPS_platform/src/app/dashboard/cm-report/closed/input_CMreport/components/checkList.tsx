"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Button, Input, Textarea } from "@material-tailwind/react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

type Severity = "" | "Low" | "Medium" | "High" | "Urgent";
type Status = "" | "Closed";

type CorrectiveItem = {
    text: string;
    images: { file: File; url: string }[];
};

type Job = {
    issue_id: string;
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
    // Open: "Open",
    // "In Progress": "In Progress",
    Closed: "Closed",
};

const SEVERITY_OPTIONS: Severity[] = ["", "Low", "Medium", "High", "Urgent"];
// const STATUS_OPTIONS: Status[] = ["",  "In Progress", "Closed"];
const LOGO_SRC = "/img/logo_egat.png";
const LIST_ROUTE = "/dashboard/cm-report";

/* ค่าตั้งต้นของฟอร์ม (ใช้สำหรับ reset ด้วย) */
const INITIAL_JOB: Job = {
    issue_id: "",
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

function absUrl(u?: string) {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    const left = (API_BASE || "").replace(/\/+$/, "");
    const right = u.replace(/^\/+/, "");
    return `${left}/${right}`;
}

export default function CMForm() {
    const router = useRouter();
    const searchParams = useSearchParams();                  // 👈
    const stationId = searchParams.get("station_id");
    const editId = searchParams.get("edit_id") ?? "";
    const isEdit = !!editId;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const STATUS_OPTIONS = useMemo<Status[]>(
        () => (isEdit ? ["", "Closed"] : ["", "Closed"]),
        [isEdit]
    );

    type PhotoItem = { url: string; remark?: string; uploadedAt?: string };
    const [photos, setPhotos] = useState<Record<string, PhotoItem[]>>({});

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

    // const onFinalSave = () => {
    //     console.log({ job, summary });
    //     alert("บันทึกเรียบร้อย (เดโม่) – ดูข้อมูลใน console");
    //     // ถ้าหน้าแม่อยากสลับกลับ list ให้ฟังอีเวนต์นี้ (ไม่ต้องส่ง prop)
    //     window.dispatchEvent(new CustomEvent("cmform:complete", { detail: { ok: true } }));
    // };

    // const onFinalSave = async () => {
    //     try {
    //         if (!stationId) {
    //             alert("ไม่พบ station_id ใน URL");
    //             return;
    //         }
    //         const payload = {
    //             station_id: stationId,
    //             cm_date: (job.found_date || "").slice(0, 10),  // หรือปล่อยให้ backend derive จาก found_date ก็ได้
    //             summary,
    //             job: {
    //                 ...job,
    //                 // เก็บชื่อไฟล์ไว้เฉยๆ รูปจริงไปอัปโหลดที่ /cmreport/{report_id}/photos
    //                 corrective_actions: job.corrective_actions.map(c => ({
    //                     text: c.text,
    //                     images: c.images.map(img => ({ name: img.file?.name ?? "" }))
    //                 })),
    //             },
    //         };

    //         const res = await fetch(`${API_BASE}/cmreport/submit`, {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             credentials: "include",
    //             body: JSON.stringify(payload),
    //         });
    //         if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

    //         const { report_id } = await res.json();

    //         alert("บันทึกเรียบร้อย");
    //         // ถ้าต้องอัปโหลดรูป: สร้าง FormData แล้ว POST ไป /cmreport/{report_id}/photos
    //         // เสร็จแล้วค่อย finalize: POST /cmreport/{report_id}/finalize
    //         window.dispatchEvent(new CustomEvent("cmform:complete", { detail: { ok: true, report_id } }));
    //     } catch (e: any) {
    //         console.error(e);
    //         alert(`บันทึกไม่สำเร็จ: ${e.message || e}`);
    //     }
    // };
    // const onFinalSave = async () => {
    //     try {
    //         if (!stationId) {
    //             alert("ไม่พบ station_id ใน URL");
    //             return;
    //         }
    //         const payload = {
    //             station_id: stationId,
    //             cm_date: (job.found_date || "").slice(0, 10),
    //             summary,
    //             job: {
    //                 ...job,
    //                 corrective_actions: job.corrective_actions.map(c => ({
    //                     text: c.text,
    //                     images: c.images.map(img => ({ name: img.file?.name ?? "" }))
    //                 })),
    //             },
    //         };

    //         const res = await fetch(`${API_BASE}/cmreport/submit`, {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             credentials: "include",
    //             body: JSON.stringify(payload),
    //         });
    //         if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

    //         const { report_id } = await res.json();

    //         // แจ้งหน้าแม่ (ถ้าใครฟังอีเวนต์อยู่)
    //         window.dispatchEvent(new CustomEvent("cmform:complete", { detail: { ok: true, report_id } }));

    //         // ➜ ออกจากฟอร์มไปหน้ารายการ (แนบ station_id เพื่อให้ list โหลดข้อมูลถูกสถานี)
    //         const listUrl = stationId ? `${LIST_ROUTE}?station_id=${encodeURIComponent(stationId)}` : LIST_ROUTE;
    //         router.replace(listUrl);
    //     } catch (e: any) {
    //         console.error(e);
    //         alert(`บันทึกไม่สำเร็จ: ${e.message || e}`);
    //     }
    // };

    // const onFinalSave = async () => {
    //     try {
    //         if (!stationId) {
    //             alert("ไม่พบ station_id ใน URL");
    //             return;
    //         }
    //         setSaving(true);

    //         if (isEdit && editId) {
    //             // 👇 โหมดแก้ไข: อัปเดตสถานะอย่างเดียว
    //             const res = await fetch(
    //                 `${API_BASE}/cmreport/${encodeURIComponent(editId)}/status`,
    //                 {
    //                     method: "PATCH",
    //                     headers: { "Content-Type": "application/json" },
    //                     credentials: "include",
    //                     body: JSON.stringify({
    //                         station_id: stationId,
    //                         status: job.status || "Open",
    //                     }),
    //                 }
    //             );
    //             if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);
    //         } else {
    //             // 👇 โหมดเพิ่มใหม่: ทำเหมือนเดิม (สร้าง -> อัปโหลดรูป)
    //             const payload = {
    //                 station_id: stationId,
    //                 cm_date: (job.found_date || "").slice(0, 10),
    //                 summary,
    //                 job: {
    //                     ...job,
    //                     corrective_actions: job.corrective_actions.map((c) => ({
    //                         text: c.text,
    //                         images: c.images.map((img) => ({ name: img.file?.name ?? "" })),
    //                     })),
    //                 },
    //             };

    //             const res = await fetch(`${API_BASE}/cmreport/submit`, {
    //                 method: "POST",
    //                 headers: { "Content-Type": "application/json" },
    //                 credentials: "include",
    //                 body: JSON.stringify(payload),
    //             });
    //             if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

    //             const { report_id } = await res.json();
    //             await uploadPhotosForReport(report_id);
    //         }
    //         router.replace(buildListUrl());
    //     } catch (e: any) {
    //         console.error(e);
    //         alert(`บันทึกไม่สำเร็จ: ${e.message || e}`);
    //     } finally {
    //         setSaving(false);
    //     }
    // };

    // const onFinalSave = async () => {
    //     try {
    //         if (!stationId) {
    //             alert("ไม่พบ station_id ใน URL");
    //             return;
    //         }
    //         setSaving(true);

    //         if (isEdit && editId) {
    //             // ✅ อัปเดตทั้งเอกสาร
    //             const payload = {
    //                 station_id: stationId,
    //                 cm_date: (job.found_date || "").slice(0, 10),   // ถ้าต้องการ sync ให้ใช้ found_date เป็น cm_date
    //                 summary,
    //                 status: job.status || "In Progress",            // หรือไม่ส่งก็ได้ถ้าแก้ใน job อยู่แล้ว
    //                 job: {
    //                     issue_id: job.issue_id,
    //                     found_date: (job.found_date || "").slice(0, 10),
    //                     location: job.location,
    //                     wo: job.wo,
    //                     sn: job.sn,
    //                     equipment_list: job.equipment_list,
    //                     problem_details: job.problem_details,
    //                     problem_type: job.problem_type,
    //                     severity: job.severity,
    //                     reported_by: job.reported_by,
    //                     assignee: job.assignee,
    //                     initial_cause: job.initial_cause,
    //                     corrective_actions: job.corrective_actions.map(c => ({
    //                         text: c.text,
    //                         // อัปเดต metadata ของรูป (ชื่อไฟล์) เท่านั้น
    //                         images: c.images.map(img => ({ name: img.file?.name ?? "" })),
    //                     })),
    //                     resolved_date: (job.resolved_date || "").slice(0, 10),
    //                     repair_result: job.repair_result || "",
    //                     preventive_action: job.preventive_action,
    //                     status: job.status || "In Progress",
    //                     remarks: job.remarks,
    //                 },
    //             };

    //             const res = await fetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}`, {
    //                 method: "PUT",
    //                 headers: { "Content-Type": "application/json" },
    //                 credentials: "include",
    //                 body: JSON.stringify(payload),
    //             });
    //             if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

    //             // ถ้าผู้ใช้แก้/เพิ่มรูปใหม่ ➜ อัปโหลดไฟล์จริงหลังจาก PUT
    //             await uploadPhotosForReport(editId);
    //         } else {
    //             // สร้างใหม่เหมือนเดิม
    //             const payload = {
    //                 station_id: stationId,
    //                 cm_date: (job.found_date || "").slice(0, 10),
    //                 summary,
    //                 job: {
    //                     ...job,
    //                     corrective_actions: job.corrective_actions.map(c => ({
    //                         text: c.text,
    //                         images: c.images.map(img => ({ name: img.file?.name ?? "" })),
    //                     })),
    //                 },
    //             };

    //             const res = await fetch(`${API_BASE}/cmreport/submit`, {
    //                 method: "POST",
    //                 headers: { "Content-Type": "application/json" },
    //                 credentials: "include",
    //                 body: JSON.stringify(payload),
    //             });
    //             if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

    //             const { report_id } = await res.json();
    //             await uploadPhotosForReport(report_id);
    //         }

    //         router.replace(buildListUrl());
    //     } catch (e: any) {
    //         console.error(e);
    //         alert(`บันทึกไม่สำเร็จ: ${e.message || e}`);
    //     } finally {
    //         setSaving(false);
    //     }
    // };
    const onFinalSave = async () => {
        try {
            if (!stationId) { alert("ไม่พบ station_id ใน URL"); return; }
            setSaving(true);

            if (isEdit && editId) {
                // ✅ PATCH ทั้งเอกสาร (status + job + summary + cm_date)
                const payload = {
                    station_id: stationId,
                    status: (job.status || "In Progress") as "Open" | "In Progress" | "Closed",
                    summary, // ถ้าไม่อยากอัปเดตก็ไม่ต้องส่ง
                    cm_date: (job.found_date || "").slice(0, 10), // ถ้าอยาก sync cm_date กับ found_date
                    job: {
                        issue_id: job.issue_id,
                        found_date: (job.found_date || "").slice(0, 10),
                        location: job.location,
                        wo: job.wo,
                        sn: job.sn,
                        equipment_list: job.equipment_list,
                        problem_details: job.problem_details,
                        problem_type: job.problem_type,
                        severity: job.severity,
                        reported_by: job.reported_by,
                        assignee: job.assignee,
                        initial_cause: job.initial_cause,
                        corrective_actions: job.corrective_actions.map(c => ({
                            text: c.text,
                            // ฝั่ง backend จะเก็บ metadata ที่ส่งมานี้ไว้ใน job;
                            // ส่วนไฟล์จริงยังต้องอัปโหลดผ่าน /photos ตามเดิม
                            images: c.images.map(img => ({ name: img.file?.name ?? "" })),
                        })),
                        resolved_date: (job.resolved_date || "").slice(0, 10),
                        repair_result: job.repair_result || "",
                        preventive_action: job.preventive_action,
                        remarks: job.remarks,
                        status: (job.status || "In Progress") as "Open" | "In Progress" | "Closed",
                    },
                };

                const res = await fetch(`${API_BASE}/cmreport/${encodeURIComponent(editId)}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(payload),
                });
                if (!res.ok) throw new Error((await res.json()).detail || `HTTP ${res.status}`);

                // ถ้ามีการเพิ่มรูปใหม่ในฟอร์ม ➜ อัปโหลดไฟล์จริง
                await uploadPhotosForReport(editId);
            } else {
                // ➕ สร้างใหม่เหมือนเดิม
                const payload = {
                    station_id: stationId,
                    cm_date: (job.found_date || "").slice(0, 10),
                    summary,
                    job: {
                        ...job,
                        corrective_actions: job.corrective_actions.map(c => ({
                            text: c.text,
                            images: c.images.map(img => ({ name: img.file?.name ?? "" })),
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
        const wasPrevented = !window.dispatchEvent(evt); // false = มีคนเรียก preventDefault()
        if (!wasPrevented) {
            router.replace(LIST_ROUTE);
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

    function makeNextIssueId({
        latestId = null,
        date = new Date(),
        prefix = "EL",
        pad = 2,
        start = 1,
    }: NextIssueIdParams = {}): string {
        const d = typeof date === "string" ? new Date(date) : date;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const base = `${prefix}-${y}-${m}`;

        let seq = start;

        if (latestId) {
            // รองรับรูปแบบ EL-YYYY-MMNN...
            const rx = new RegExp(`^${prefix}-(\\d{4})-(\\d{2})(\\d+)$`);
            const m2 = latestId.match(rx);
            if (m2) {
                const [_, yy, mm, tail] = m2;
                if (Number(yy) === y && mm === m) {
                    seq = Math.max(Number(tail) + 1, start);
                }
            }
        }

        const tail = String(seq).padStart(pad, "0");
        return `${base}${tail}`;
    }

    function localTodayISO(): string {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    // ⭐ ดึง station_name จาก API แล้วอัปเดตช่อง "สถานที่"
    // useEffect(() => {
    //     let alive = true;
    //     if (!stationId) return;

    //     (async () => {
    //         try {
    //             const res = await fetch(
    //                 `${API_BASE}/station/info/public?station_id=${encodeURIComponent(stationId)}`,
    //                 { cache: "no-store" }
    //             );
    //             if (!res.ok) throw new Error(`HTTP ${res.status}`);
    //             const data: { station: StationPublic } = await res.json();

    //             if (!alive) return;
    //             setJob(prev => ({
    //                 ...prev,
    //                 location: data.station.station_name || prev.location, // 👈 เซ็ตสถานที่ = station_name
    //             }));
    //         } catch (err) {
    //             console.error("โหลดข้อมูลสถานีไม่สำเร็จ:", err);
    //             // จะ alert ก็ได้ถ้าต้องการ
    //         }
    //     })();

    //     return () => { alive = false; };
    // }, [stationId]);

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
                    location: data.station.station_name || prev.location, // 👈 เซ็ตสถานที่ = station_name
                    wo: data.station.WO ?? prev.wo,
                    sn: data.station.SN ?? prev.sn
                }));
            } catch (err) {
                console.error("โหลดข้อมูลสถานีไม่สำเร็จ:", err);
                // จะ alert ก็ได้ถ้าต้องการ
            }
        })();

        return () => { alive = false; };
    }, [stationId]);


    useEffect(() => {
        let alive = true;

        (async () => {
            const todayStr = localTodayISO(); // เช่น 2025-10-17
            const [y, m] = todayStr.split("-");

            let latestId: string | null = null;
            try {
                const res = await fetch(`/api/cm/latest-id?y=${y}&m=${m}`);
                if (res.ok) {
                    const data = await res.json();
                    latestId = data?.id ?? null; // เช่น "EL-2025-1007"
                }
            } catch { /* fallback: เริ่ม 01 */ }

            const nextId = makeNextIssueId({ latestId, date: todayStr });

            if (!alive) return;
            setJob(prev => ({
                ...prev,
                found_date: todayStr,
                issue_id: nextId,
            }));
        })();

        return () => { alive = false; };
    }, []); // ⭐ รันครั้งเดียวตอน mount

    // useEffect(() => {
    //     if (!editId || !stationId) return;         // 👈 ต้องมีทั้ง editId และ stationId

    //     (async () => {
    //         try {
    //             const url = `${API_BASE}/cmreport/${encodeURIComponent(editId)}?station_id=${encodeURIComponent(stationId)}`;
    //             const res = await fetch(url, { credentials: "include" });
    //             if (!res.ok) throw new Error(`HTTP ${res.status}`);
    //             const data = await res.json();

    //             setJob(prev => ({
    //                 ...prev,
    //                 // ใช้ค่า top-level ของ backend เป็นหลัก (มี backup เป็น job.*)
    //                 issue_id: data.issue_id ?? data.job?.issue_id ?? prev.issue_id,
    //                 // ใช้ cm_date เป็น found_date (ฟอร์แมต YYYY-MM-DD) ถ้าไม่มีค่อย fallback
    //                 found_date: data.cm_date ?? data.job?.found_date ?? prev.found_date,
    //                 location: data.job?.location ?? prev.location,
    //                 wo: data.job?.wo ?? prev.wo,
    //                 sn: data.job?.sn ?? prev.sn,
    //                 problem_details: data.job?.problem_details ?? prev.problem_details,
    //                 problem_type: data.job?.problem_type ?? prev.problem_type,
    //                 severity: (data.job?.severity ?? "") as Severity,
    //                 status: (data.job?.status ?? "Open") as Status,
    //                 initial_cause: data.job?.initial_cause ?? prev.initial_cause,
    //                 remarks: data.job?.remarks ?? prev.remarks,
    //             }));
    //             setSummary(data.summary ?? "");
    //         } catch (e) {
    //             console.error("โหลดรายงานเดิมไม่สำเร็จ:", e);
    //         }
    //     })();
    // }, [editId, stationId]);
    useEffect(() => {
        if (!editId || !stationId) return;

        const ac = new AbortController();
        (async () => {
            try {
                setLoading(true);
                setError(null);

                const url = `${API_BASE}/cmreport/${encodeURIComponent(editId)}?station_id=${encodeURIComponent(stationId)}`;
                const res = await fetch(url, { credentials: "include", signal: ac.signal });
                if (!res.ok) {
                    let detail = "";
                    try { detail = (await res.json()).detail; } catch { }
                    throw new Error(detail || `HTTP ${res.status}`);
                }
                const data = await res.json();

                // map ข้อมูลจาก backend → job state
                setJob(prev => ({
                    ...prev,
                    issue_id: data.issue_id ?? data.job?.issue_id ?? prev.issue_id,
                    found_date: data.cm_date ?? data.job?.found_date ?? prev.found_date, // YYYY-MM-DD
                    location: data.job?.location ?? prev.location,
                    wo: data.job?.wo ?? prev.wo,
                    sn: data.job?.sn ?? prev.sn,
                    problem_details: data.job?.problem_details ?? prev.problem_details,
                    problem_type: data.job?.problem_type ?? prev.problem_type,
                    severity: (data.job?.severity ?? "") as Severity,
                    // ถ้าฟรอนต์คุณกำหนด Status ให้เลือกได้เฉพาะ "Closed",
                    // แต่ backend อาจเป็น "Open"/"In Progress" ก็จับให้ว่างหรือแปลงเองตามนโยบาย
                    status: (data.job?.status ?? "") as Status,
                    initial_cause: data.job?.initial_cause ?? prev.initial_cause,
                    remarks: data.job?.remarks ?? prev.remarks,
                    // ถ้าอยากเติม lists อื่น ๆ ด้วย (equipment_list, reported_by, ฯลฯ)
                    equipment_list: Array.isArray(data.job?.equipment_list) && data.job.equipment_list.length ? data.job.equipment_list : prev.equipment_list,
                    reported_by: Array.isArray(data.job?.reported_by) && data.job.reported_by.length ? data.job.reported_by : prev.reported_by,
                    preventive_action: Array.isArray(data.job?.preventive_action) && data.job.preventive_action.length ? data.job.preventive_action : prev.preventive_action,
                    resolved_date: (data.job?.resolved_date ?? "") as string,
                    repair_result: (data.job?.repair_result ?? "") as Job["repair_result"],
                    corrective_actions: Array.isArray(data.job?.corrective_actions) && data.job.corrective_actions.length
                        ? data.job.corrective_actions.map((c: any) => ({
                            text: c?.text ?? "",
                            // ฝั่ง backend เก็บแค่ metadata; ส่วนไฟล์จริงอยู่ที่ /uploads/... แล้ว
                            images: [], // ในฟอร์มนี้ใช้สำหรับไฟล์ใหม่ที่ผู้ใช้จะอัปโหลด
                        }))
                        : prev.corrective_actions,
                }));

                setSummary(data.summary ?? "");

                // เก็บ photos ที่ backend มีอยู่แล้ว (อ่านจาก data.photos)
                // data.photos มีรูปเป็นกลุ่ม g1,g2,... แต่ละรายการจะมี { url, remark, uploadedAt }
                const ph = data.photos || {};
                const normalized: Record<string, PhotoItem[]> = {};
                Object.keys(ph).forEach((groupKey) => {
                    const arr = Array.isArray(ph[groupKey]) ? ph[groupKey] : [];
                    // normalized[groupKey] = arr.map((x: any) => ({
                    //     url: x?.url,
                    //     remark: x?.remark,
                    //     uploadedAt: x?.uploadedAt,
                    // })).filter((x: PhotoItem) => !!x.url);
                    normalized[groupKey] = arr
                        .map((x: any) => ({
                            url: absUrl(x?.url),        // ← สำคัญ
                            remark: x?.remark,
                            uploadedAt: x?.uploadedAt,
                        }))
                        .filter((x: PhotoItem) => !!x.url);
                });
                setPhotos(normalized);

            } catch (e: any) {
                if (e?.name !== "AbortError") {
                    console.error(e);
                    setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
                }
            } finally {
                setLoading(false);
            }
        })();

        return () => ac.abort();
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

    const groupKeyOf = (index: number) => `g${index + 1}`;

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

                        {/* ปุ่มด้านขวาใน HEADER
                        <div className="tw-flex tw-items-start tw-gap-2 tw-print:tw-hidden">
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
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    Issue ID
                                </label>
                                {/* <Input
                                    value={job.issue_id}
                                    onChange={(e) => setJob({ ...job, issue_id: e.target.value })}
                                    crossOrigin=""
                                    // className="!tw-w-full"
                                    readOnly
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-w-full !tw-bg-blue-gray-50"
                                /> */}
                                <Input
                                    value={job.issue_id || "๘๘๘"}
                                    readOnly
                                    key={job.issue_id}  // บังคับให้รี-mount เมื่อค่าเปลี่ยน
                                    crossOrigin=""
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    className="!tw-w-full !tw-bg-blue-gray-50"
                                />
                            </div>

                            <div className="sm:tw-col-span-2 lg:tw-col-span-3">
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    สถานที่
                                </label>
                                <Input
                                    value={job.location}
                                    onChange={(e) => setJob({ ...job, location: e.target.value })}
                                    crossOrigin=""
                                    readOnly
                                    className="!tw-w-full !tw-bg-blue-gray-50"
                                    // className="!tw-w-full"
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div>

                            <div className="lg:tw-col-span-1">
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    พบปัญหา
                                </label>
                                <Input
                                    type="date"
                                    value={(job.found_date || "").slice(0, 10)}
                                    onChange={(e) => setJob({ ...job, found_date: e.target.value })}
                                    crossOrigin=""
                                    // className="!tw-w-full"
                                    readOnly={isEdit}
                                    className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div>

                            <div className="lg:tw-col-span-1">
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    เสร็จสิ้น
                                </label>
                                <Input
                                    type="date"
                                    value={(job.resolved_date || "").slice(0, 10)}
                                    min={(job.found_date || "").slice(0, 10)}
                                    onChange={(e) => setJob({ ...job, resolved_date: e.target.value })}
                                    crossOrigin=""
                                    // className="!tw-w-full"
                                    readOnly={isEdit}
                                    className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div>
                        </div>

                        {/* 2 คอลัมน์: อุปกรณ์ */}
                        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
                            {/* อุปกรณ์ – หลายรายการ */}
                            <div className="tw-space-y-3">
                                {/* <div className="tw-flex tw-items-center tw-justify-between">
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
                                </div> */}

                                {job.equipment_list.map((val, i) => (
                                    <div key={i} className="tw-flex tw-items-center tw-gap-2">
                                        <Input
                                            label={`รายการที่ ${i + 1}`}
                                            value={val}
                                            onChange={(e) => setStringItem("equipment_list")(i, e.target.value)}
                                            crossOrigin=""
                                            // className="tw-flex-1"
                                            readOnly={isEdit}
                                            className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                        />
                                        {/* <button
                                            type="button"
                                            onClick={() => removeStringItem("equipment_list")(i)}
                                            disabled={job.equipment_list.length <= 1}
                                            className={`tw-h-10 tw-rounded-md tw-border tw-px-3 ${job.equipment_list.length <= 1
                                                ? "tw-border-blue-gray-100 tw-text-blue-gray-300 tw-cursor-not-allowed"
                                                : "tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50"
                                                }`}
                                            title={
                                                job.equipment_list.length <= 1
                                                    ? "ต้องมีอย่างน้อย 1 รายการ"
                                                    : "ลบรายการนี้"
                                            }
                                        >
                                            ลบ
                                        </button> */}
                                    </div>
                                ))}
                            </div>

                            {/* ผู้รายงาน */}
                            <div className="tw-space-y-3">
                                {/* <div className="tw-flex tw-items-center tw-justify-between">
                                    <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">
                                        ผู้รายงาน
                                    </span>
                                    <button
                                        type="button"
                                        onClick={addStringItem("reported_by")}
                                        className="tw-text-sm tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-1 hover:tw-bg-blue-gray-50"
                                    >
                                        + เพิ่ม
                                    </button>
                                </div> */}

                                {job.reported_by.map((name, i) => (
                                    <div key={i} className="tw-flex tw-items-center tw-gap-2">
                                        <Input
                                            label={`ผู้รายงานที่ ${i + 1}`}
                                            value={name}
                                            onChange={(e) => setStringItem("reported_by")(i, e.target.value)}
                                            crossOrigin=""
                                            // className="tw-flex-1"
                                            readOnly={isEdit}
                                            className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                        />
                                        {/* <button
                                            type="button"
                                            onClick={() => removeStringItem("reported_by")(i)}
                                            disabled={job.reported_by.length <= 1}
                                            className={`tw-h-10 tw-rounded-md tw-border tw-px-3 ${job.reported_by.length <= 1
                                                ? "tw-border-blue-gray-100 tw-text-blue-gray-300 tw-cursor-not-allowed"
                                                : "tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50"
                                                }`}
                                            title={job.reported_by.length <= 1 ? "ต้องมีอย่างน้อย 1 คน" : "ลบผู้รายงานนี้"}
                                        >
                                            ลบ
                                        </button> */}
                                    </div>
                                ))}
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
                                        // className="tw-w-full tw-h-10 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-px-3 tw-py-2"
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
                                    // className="!tw-w-full"
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    readOnly={isEdit}
                                    className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
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
                                                    disabled
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
                                // className="!tw-w-full"
                                containerProps={{ className: "!tw-min-w-0" }}
                                readOnly={isEdit}
                                className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                            />
                        </div>


                        {/* การแก้ไข (Corrective Action) */}
                        <div>
                            <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                                การแก้ไข (Corrective Action)
                            </div>
                            <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                                {/* รายการการแก้ไขหลายข้อ */}
                                <div className="tw-space-y-4">
                                    {/* <div className="tw-flex tw-items-center tw-justify-between">
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
                                    </div> */}

                                    {job.corrective_actions.map((item, i) => {
                                        const groupKey = groupKeyOf(i);
                                        const existing = photos[groupKey] ?? [];

                                        return (
                                            <div
                                                key={i}
                                                className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-3 tw-space-y-3"
                                            >
                                                <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
                                                    <Textarea
                                                        label={`ข้อที่ ${i + 1}`}
                                                        rows={3}
                                                        value={item.text}
                                                        onChange={(e) => patchCorrective(i, { text: e.target.value })}
                                                        readOnly={isEdit}
                                                        className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                                        containerProps={{ className: "!tw-min-w-0 tw-flex-1" }}
                                                    />
                                                </div>

                                                {/* พรีวิวไฟล์ "ใหม่" ที่เพิ่งแนบในฟอร์ม */}
                                                {item.images.length > 0 && (
                                                    <div className="tw-w-full tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                                                        {item.images.map((img, j) => (
                                                            <div
                                                                key={j}
                                                                className="tw-relative tw-aspect-video tw-rounded-md tw-overflow-hidden tw-border tw-border-blue-gray-100"
                                                            >
                                                                <img src={img.url} alt={`action-${i}-img-${j}`} className="tw-w-full tw-h-full tw-object-cover" />
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

                                                {/* ✅ รูป "ที่มีอยู่แล้ว" จาก backend ของข้อ i (g{i+1}) */}
                                                {isEdit && existing.length > 0 && (
                                                    <div className="tw-space-y-2">
                                                        <div className="tw-text-sm tw-font-medium">รูปที่อัปโหลดไว้แล้ว — ข้อที่ {i + 1}</div>
                                                        <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                                                            {existing.map((p, k) => (
                                                                <a
                                                                    key={`${groupKey}-${k}`}
                                                                    href={p.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="tw-relative tw-aspect-video tw-rounded-md tw-overflow-hidden tw-border tw-border-blue-gray-100 hover:tw-shadow"
                                                                >
                                                                    <img src={p.url} alt={`photo-${groupKey}-${k}`} className="tw-w-full tw-h-full tw-object-cover" />
                                                                    {p.remark && (
                                                                        <div className="tw-absolute tw-bottom-0 tw-left-0 tw-right-0 tw-bg-black/50 tw-text-white tw-text-xs tw-px-2 tw-py-1">
                                                                            {p.remark}
                                                                        </div>
                                                                    )}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* ✅ แสดงรูปที่มีอยู่แล้วจาก backend */}
                                {/* {isEdit && Object.keys(photos).length > 0 && (
                                    <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                                        <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">
                                            รูปที่อัปโหลดไว้แล้ว
                                        </div>

                                        {Object.entries(photos).map(([groupKey, arr]) => (
                                            <div key={groupKey} className="tw-space-y-2">
                                                <div className="tw-text-sm tw-font-medium">กลุ่ม {groupKey.toUpperCase()}</div>

                                                {arr.length === 0 ? (
                                                    <div className="tw-text-sm tw-text-blue-gray-500">ไม่มีรูป</div>
                                                ) : (
                                                    <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                                                        {arr.map((p, i) => (
                                                            <a
                                                                key={`${groupKey}-${i}`}
                                                                href={p.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="tw-relative tw-aspect-video tw-rounded-md tw-overflow-hidden tw-border tw-border-blue-gray-100 hover:tw-shadow"
                                                            >
                                                                <img
                                                                    src={p.url}
                                                                    alt={`photo-${groupKey}-${i}`}
                                                                    className="tw-w-full tw-h-full tw-object-cover"
                                                                />
                                                                {p.remark && (
                                                                    <div className="tw-absolute tw-bottom-0 tw-left-0 tw-right-0 tw-bg-black/50 tw-text-white tw-text-xs tw-px-2 tw-py-1">
                                                                        {p.remark}
                                                                    </div>
                                                                )}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )} */}

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
                                                    disabled
                                                    value={opt}
                                                    className="tw-h-4 tw-w-4 tw-border-blue-gray-300 focus:tw-ring-0 focus:tw-outline-none"
                                                    checked={job.repair_result === opt}
                                                    onChange={() => setJob((prev) => ({ ...prev, repair_result: opt }))}
                                                />
                                                <span className="tw-text-sm tw-text-blue-gray-800">{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* วิธีป้องกันซ้ำ – หลายข้อ */}
                                <div className="tw-space-y-3">
                                    {/* <div className="tw-flex tw-items-center tw-justify-between">
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
                                    </div> */}

                                    {job.preventive_action.map((val, i) => (
                                        <div key={i} className="tw-flex tw-items-center tw-gap-2">
                                            <Input
                                                label={`ข้อที่ ${i + 1}`}
                                                value={val}
                                                onChange={(e) => setStringItem("preventive_action")(i, e.target.value)}
                                                crossOrigin=""
                                                // className="tw-flex-1"
                                                readOnly={isEdit}
                                                className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                            />
                                            {/* <button
                                                type="button"
                                                onClick={() => removeStringItem("preventive_action")(i)}
                                                disabled={job.preventive_action.length <= 1}
                                                className={`tw-h-10 tw-rounded-md tw-border tw-px-3 ${job.preventive_action.length <= 1
                                                    ? "tw-border-blue-gray-100 tw-text-blue-gray-300 tw-cursor-not-allowed"
                                                    : "tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50"
                                                    }`}
                                                title={
                                                    job.preventive_action.length <= 1
                                                        ? "ต้องมีอย่างน้อย 1 ข้อ"
                                                        : "ลบวิธีนี้"
                                                }
                                            >
                                                ลบ
                                            </button> */}
                                        </div>
                                    ))}
                                </div>
                            </div>
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
                                    // className="!tw-w-full"
                                    readOnly={isEdit}
                                    className={`!tw-w-full ${isEdit ? "!tw-bg-blue-gray-50" : ""}`}
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div>
                        </div>

                        {/* FOOTER + ปุ่มบันทึก */}
                        {/* <div className="tw-flex tw-items-center tw-justify-between tw-print:tw-mt-8">
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
                        </div> */}
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
