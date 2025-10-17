"use client";

import React, { useMemo, useState } from "react";
import { Button, Input, Textarea } from "@material-tailwind/react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Severity = "" | "Low" | "Medium" | "High" | "Critical";
type Status = "" | "Open" | "In Progress" | "Closed";

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
    Closed: "Closed",
};

const SEVERITY_OPTIONS: Severity[] = ["", "Low", "Medium", "High", "Critical"];
const STATUS_OPTIONS: Status[] = ["", "Open", "In Progress", "Closed"];
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

export default function CMForm() {
    const router = useRouter();
    const [job, setJob] = useState<Job>({ ...INITIAL_JOB });
    const [summary, setSummary] = useState<string>("");

    // เดิม header อิง label/type; ตอนนี้คงไว้เป็นค่าคงที่กลาง
    const headerLabel = useMemo(() => "CM Report", []);

    const onSave = () => {
        console.log({ job, summary });
        alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
    };

    const onFinalSave = () => {
        console.log({ job, summary });
        alert("บันทึกเรียบร้อย (เดโม่) – ดูข้อมูลใน console");
        // ถ้าหน้าแม่อยากสลับกลับ list ให้ฟังอีเวนต์นี้ (ไม่ต้องส่ง prop)
        window.dispatchEvent(new CustomEvent("cmform:complete", { detail: { ok: true } }));
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
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    Issue ID
                                </label>
                                <Input
                                    value={job.issue_id}
                                    onChange={(e) => setJob({ ...job, issue_id: e.target.value })}
                                    crossOrigin=""
                                    containerProps={{ className: "!tw-min-w-0" }}
                                    readOnly
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
                                    className="!tw-w-full"
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
                                    className="!tw-w-full"
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />
                            </div>
                        </div>

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

                                {job.equipment_list.map((val, i) => (
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
                                        onClick={addStringItem("reported_by")}
                                        className="tw-text-sm tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-1 hover:tw-bg-blue-gray-50"
                                    >
                                        + เพิ่ม
                                    </button>
                                </div>

                                {job.reported_by.map((name, i) => (
                                    <div key={i} className="tw-flex tw-items-center tw-gap-2">
                                        <Input
                                            label={`ผู้รายงานที่ ${i + 1}`}
                                            value={name}
                                            onChange={(e) => setStringItem("reported_by")(i, e.target.value)}
                                            crossOrigin=""
                                            className="tw-flex-1"
                                        />
                                        <button
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
                                        </button>
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
                                        onChange={(e) => setJob({ ...job, severity: e.target.value as Severity })}
                                        className="tw-w-full tw-h-10 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-px-3 tw-py-2"
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
                                />
                                <Textarea
                                    label="รายละเอียด"
                                    rows={3}
                                    value={job.problem_details}
                                    onChange={(e) => setJob({ ...job, problem_details: e.target.value })}
                                    className="!tw-w-full"
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
                                className="!tw-w-full"
                                containerProps={{ className: "!tw-min-w-0" }}
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

                                    {job.corrective_actions.map((item, i) => {
                                        const canDelete = job.corrective_actions.length > 1;
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
                                                    <label className="tw-inline-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            multiple
                                                            capture="environment"
                                                            className="tw-hidden"
                                                            onChange={(e) => addCorrectiveImages(i, e.target.files)}
                                                        />
                                                        <span className="tw-text-sm">+ เพิ่มรูป / ถ่ายรูป</span>
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

                                    {job.preventive_action.map((val, i) => (
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
                                            </button>
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
                                    className="!tw-w-full"
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
                                    className="tw-h-10 tw-text-sm"
                                >
                                    PRINT
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
