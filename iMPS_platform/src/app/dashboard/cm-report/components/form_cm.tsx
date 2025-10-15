"use client";

import React, { useMemo, useState } from "react";
import { Button, Input, Textarea } from "@material-tailwind/react";

type Severity = "" | "Low" | "Medium" | "High" | "Critical";
type Status = "" | "Open" | "In Progress" | "Closed";
export type EquipmentType = "charger" | "mdb" | "ccb" | "cb_box" | "station";

type Job = {
    issue_id: string;
    found_date: string;     // datetime-local
    location: string;
    equipment: string;
    problem_details: string;
    problem_type: string;
    severity: Severity;
    reported_by: string;
    assignee: string;
    initial_cause: string;
    corrective_action: string;
    resolved_date: string;  // datetime-local
    repair_result: string;
    preventive_action: string;
    status: Status;
    remarks: string;
};

type CMFormProps = {
    type?: EquipmentType;
    label?: string;
    stationId: string;
    stationName?: string;
    onComplete?: (ok: boolean) => void;
    onCancel?: () => void;
};

const TYPE_LABEL_FALLBACK: Record<EquipmentType, string> = {
    charger: "เครื่องอัดประจุไฟฟ้า (Charger)",
    mdb: "MDB",
    ccb: "CCB",
    cb_box: "CB-BOX",
    station: "Station",
};

const SEVERITY_OPTIONS: Severity[] = ["", "Low", "Medium", "High", "Critical"];
const STATUS_OPTIONS: Status[] = ["", "Open", "In Progress", "Closed"];

export default function CMForm({
    type = "charger",
    label,
    stationId,
    stationName,
    onComplete,
    onCancel,
}: CMFormProps) {
    const [job, setJob] = useState<Job>({
        issue_id: "EL-2025-001",
        found_date: "",
        location: "",
        equipment: "",
        problem_details: "",
        problem_type: "",
        severity: "",
        reported_by: "",
        assignee: "",
        initial_cause: "",
        corrective_action: "",
        resolved_date: "",
        repair_result: "",
        preventive_action: "",
        status: "",
        remarks: "",
    });
    const [summary, setSummary] = useState<string>("");

    const headerLabel = useMemo(
        () => label || TYPE_LABEL_FALLBACK[type],
        [label, type]
    );

    const stationReady = !!stationId;
    const canFinalSave = stationReady; // อยากให้บันทึกได้เลยก็ใช้เงื่อนไขนี้

    const onSave = () => {
        console.log({ job, summary, type, stationId, stationName });
        alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
    };
    const onFinalSave = () => {
        console.log({ job, summary, type, stationId, stationName });
        alert("บันทึกเรียบร้อย (เดโม่) – ดูข้อมูลใน console");
        onComplete?.(true);
    };
    const handlePrint = () => window.print();

    // function FieldDateTime({
    //     label,
    //     value,
    //     onChange,
    // }: {
    //     label: string;
    //     value: string;
    //     onChange: (v: string) => void;
    // }) {
    //     return (
    //         <div>
    //             <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
    //                 {label}
    //             </label>
    //             <input
    //                 type="datetime-local"
    //                 step="60"                // ตัดวินาทีออก
    //                 value={value}
    //                 onChange={(e) => onChange(e.target.value)}
    //                 className="
    //             tw-w-full tw-h-11
    //             tw-rounded-lg tw-border tw-border-blue-gray-200
    //             tw-bg-white tw-px-3 tw-text-blue-gray-900
    //             focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-100 focus:tw-border-blue-300
    //             "
    //             />
    //         </div>
    //     );
    // }

    return (
        <section className="tw-pb-24">
            <div className="tw-mx-auto tw-max-w-4xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-sm tw-p-6 md:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0">
                {/* HEADER */}
                <div className="tw-flex tw-items-start tw-justify-between tw-gap-6">
                    <div className="tw-flex tw-gap-4">
                        <div className="tw-h-12 tw-w-12 tw-rounded-md tw-border tw-border-blue-gray-100 tw-grid tw-place-items-center">
                            <span className="tw-text-xs tw-text-blue-gray-400">LOGO</span>
                        </div>
                        <div>
                            <div className="tw-font-semibold tw-text-blue-gray-900">
                                รายงานบันทึกปัญหา (CM) – {headerLabel}
                            </div>
                            <div className="tw-text-sm tw-text-blue-gray-600">
                                สถานี: {stationName || stationId || "-"}
                            </div>
                            <div className="tw-text-sm tw-text-blue-gray-600">
                                บริษัท/ไซต์งานของคุณ
                            </div>
                        </div>
                    </div>

                    {/* ขวาบน: meta เป็น input */}
                    <div className="tw-w-64">
                        <div className="tw-text-xs tw-text-blue-gray-500">Issue no.</div>
                        <Input
                            label="Issue ID"
                            value={job.issue_id}
                            onChange={(e) => setJob({ ...job, issue_id: e.target.value })}
                            crossOrigin=""
                        />
                        <div className="tw-grid tw-grid-cols-2 tw-gap-3 tw-mt-3">
                            <div>
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                    พบปัญหา
                                </label>
                                <Input
                                    type="datetime-local"
                                    value={job.found_date}
                                    onChange={(e) =>
                                        setJob({ ...job, found_date: e.target.value })
                                    }
                                    crossOrigin=""
                                />
                            </div>
                            <div>
                                <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1 tw-ml-5">
                                    เสร็จสิ้น
                                </label>
                                <Input
                                    type="datetime-local"
                                    value={job.resolved_date}
                                    onChange={(e) =>
                                        setJob({ ...job, resolved_date: e.target.value })
                                    }
                                    crossOrigin=""
                                />
                            </div>
                        </div>
                        <div className="tw-mt-3">
                            <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                สถานะ
                            </label>
                            <select
                                value={job.status}
                                onChange={(e) =>
                                    setJob({ ...job, status: e.target.value as Status })
                                }
                                className="tw-w-full tw-border tw-border-blue-gray-200 tw-rounded-lg tw-px-3 tw-py-2"
                            >
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                        {s || "เลือก..."}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* ปุ่มบนขวา */}
                <div className="tw-mt-6 tw-flex tw-justify-end tw-gap-2 tw-print:tw-hidden">
                    {onCancel && (
                        <Button
                            variant="text"
                            color="blue-gray"
                            className="tw-h-10 tw-text-sm"
                            onClick={onCancel}
                        >
                            ยกเลิก
                        </Button>
                    )}
                    <Button
                        variant="outlined"
                        className="tw-h-10 tw-text-sm"
                        onClick={handlePrint}
                        disabled={!stationReady}
                        title={stationReady ? "" : "กรุณาเลือกสถานีก่อน"}
                    >
                        พิมพ์เอกสาร
                    </Button>
                </div>

                {/* BODY */}
                <div className="tw-mt-8 tw-space-y-8">
                    {/* 2 คอลัมน์: สถานที่/อุปกรณ์ | ผู้เกี่ยวข้อง */}
                    <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
                        <div>
                            <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                                สถานที่ / อุปกรณ์
                            </div>
                            <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                                <Input
                                    label="สถานที่"
                                    value={job.location}
                                    onChange={(e) =>
                                        setJob({ ...job, location: e.target.value })
                                    }
                                    crossOrigin=""
                                />
                                <Input
                                    label="อุปกรณ์"
                                    value={job.equipment}
                                    onChange={(e) =>
                                        setJob({ ...job, equipment: e.target.value })
                                    }
                                    crossOrigin=""
                                />
                            </div>
                        </div>

                        <div>
                            <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                                ผู้เกี่ยวข้อง
                            </div>
                            <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                                <Input
                                    label="ผู้รายงาน"
                                    value={job.reported_by}
                                    onChange={(e) =>
                                        setJob({ ...job, reported_by: e.target.value })
                                    }
                                    crossOrigin=""
                                />
                                <Input
                                    label="ผู้รับผิดชอบ"
                                    value={job.assignee}
                                    onChange={(e) =>
                                        setJob({ ...job, assignee: e.target.value })
                                    }
                                    crossOrigin=""
                                />
                                <div>
                                    <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                        ความรุนแรง
                                    </label>
                                    <select
                                        value={job.severity}
                                        onChange={(e) =>
                                            setJob({ ...job, severity: e.target.value as Severity })
                                        }
                                        className="tw-w-full tw-border tw-border-blue-gray-200 tw-rounded-lg tw-px-3 tw-py-2"
                                    >
                                        {SEVERITY_OPTIONS.map((s) => (
                                            <option key={s} value={s}>
                                                {s || "เลือก..."}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* รายละเอียดปัญหา */}
                    <div>
                        <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                            รายละเอียดปัญหา
                        </div>
                        <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                            <Input
                                label="ประเภทปัญหา"
                                value={job.problem_type}
                                onChange={(e) =>
                                    setJob({ ...job, problem_type: e.target.value })
                                }
                                crossOrigin=""
                            />
                            <Textarea
                                label="รายละเอียด"
                                rows={3}
                                value={job.problem_details}
                                onChange={(e) =>
                                    setJob({ ...job, problem_details: e.target.value })
                                }
                                className="!tw-w-full"
                                containerProps={{ className: "!tw-min-w-0" }}
                            />
                        </div>
                    </div>

                    {/* สาเหตุและการแก้ไข */}
                    <div>
                        <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                            สาเหตุและการแก้ไข
                        </div>
                        <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                            <Input
                                label="สาเหตุเบื้องต้น"
                                value={job.initial_cause}
                                onChange={(e) =>
                                    setJob({ ...job, initial_cause: e.target.value })
                                }
                                crossOrigin=""
                            />
                            <Input
                                label="การแก้ไข (Corrective Action)"
                                value={job.corrective_action}
                                onChange={(e) =>
                                    setJob({ ...job, corrective_action: e.target.value })
                                }
                                crossOrigin=""
                            />
                            <Input
                                label="ผลหลังซ่อม"
                                value={job.repair_result}
                                onChange={(e) =>
                                    setJob({ ...job, repair_result: e.target.value })
                                }
                                crossOrigin=""
                            />
                            <Input
                                label="วิธีป้องกันซ้ำ"
                                value={job.preventive_action}
                                onChange={(e) =>
                                    setJob({ ...job, preventive_action: e.target.value })
                                }
                                crossOrigin=""
                            />
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

                    {/* สรุปผลการตรวจสอบ */}
                    <div>
                        <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                            สรุปผลการตรวจสอบ
                        </div>
                        <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4">
                            <Textarea
                                label="สรุปผล"
                                rows={4}
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                className="!tw-w-full"
                                containerProps={{ className: "!tw-min-w-0" }}
                            />
                        </div>
                    </div>

                    {/* FOOTER + ปุ่มบันทึก */}
                    <div className="tw-flex tw-items-center tw-justify-between tw-print:tw-mt-8">
                        <div>
                            <div className="tw-font-semibold tw-text-blue-gray-900 tw-mb-1">
                                ขอบคุณ!
                            </div>
                            <div className="tw-text-sm tw-text-blue-gray-600">
                                หากพบปัญหา/ข้อมูลคลาดเคลื่อน โปรดติดต่อ:
                            </div>
                            <div className="tw-text-sm tw-text-blue-gray-900">
                                support@yourcompany.com
                            </div>
                        </div>
                        <div className="tw-flex tw-gap-2 tw-print:tw-hidden">
                            <Button
                                variant="outlined"
                                color="blue-gray"
                                onClick={onSave}
                                className="tw-h-10 tw-text-sm"
                                disabled={!stationReady}
                                title={stationReady ? "" : "กรุณาเลือกสถานีก่อน"}
                            >
                                บันทึกชั่วคราว
                            </Button>
                            <Button
                                onClick={onFinalSave}
                                className="tw-h-10 tw-text-sm"
                                disabled={!canFinalSave}
                                title={
                                    canFinalSave ? "" : "กรุณาเลือกสถานีก่อน"
                                }
                            >
                                PRINT
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* print styles */}
            <style jsx global>{`
        @media print {
          body { background: white !important; }
          .tw-print\\:tw-hidden { display: none !important; }
        }
      `}</style>

            {!stationReady && (
                <div className="tw-mt-3 tw-text-sm tw-text-red-600 tw-print:tw-hidden">
                    กรุณาเลือกสถานีจากแถบด้านบนก่อนบันทึก/พิมพ์เอกสาร
                </div>
            )}
        </section>
    );
}
