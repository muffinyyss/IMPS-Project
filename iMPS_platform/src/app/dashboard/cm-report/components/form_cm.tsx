"use client";

import React, { useEffect, useState } from "react";
import { Button, Input, Textarea } from "@material-tailwind/react";

/* =========================
 *        TYPES
 * ========================= */
type Severity = "" | "Low" | "Medium" | "High" | "Critical";
type Status = "" | "Open" | "In Progress" | "Closed";

// ชนิดอุปกรณ์ให้ตรงกับหน้ารายการ
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
    /** ชนิดอุปกรณ์จากแท็บ (ถ้าไม่ส่งมา จะ default เป็น "mdb") */
    type?: EquipmentType;
    /** station id ที่เลือกไว้จากแถบขวาบน */
    stationId: string;
    /** ชื่อสถานี (ถ้ามี) ใช้โชว์หัวเรื่องสวยๆ */
    stationName?: string;
    /** callback เดิม (optional) */
    onComplete?: (status: boolean) => void;
    /** ปุ่มย้อนกลับ/ปิดฟอร์ม (parent ส่งมา) */
    onCancel?: () => void;
};

/* =========================
 *       HELPERS
 * ========================= */
const TYPE_LABEL: Record<EquipmentType, string> = {
    charger: "เครื่องอัดประจุไฟฟ้า (Charger)",
    mdb: "MDB",
    ccb: "CCB",
    cb_box: "CB-BOX",
    station: "Station",
};

function Badge({ children }: { children: React.ReactNode }) {
    return (
        <span className="tw-rounded-full tw-border tw-border-blue-gray-200 tw-bg-blue-gray-50 tw-px-3 tw-py-1 tw-text-xs tw-font-medium tw-text-blue-gray-700">
            {children}
        </span>
    );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
    return (
        <div className="tw-grid tw-grid-cols-12 tw-text-[15px] tw-border-b tw-border-blue-gray-50 last:tw-border-b-0">
            <div className="tw-col-span-5 tw-py-3 tw-pr-3 tw-text-blue-gray-600">{k}</div>
            <div className="tw-col-span-7 tw-py-3 tw-pl-3 tw-text-blue-gray-900">{v || "-"}</div>
        </div>
    );
}

/* =========================
 *          MAIN
 * ========================= */
export default function CMForm({ type = "charger", stationId, stationName, onComplete, onCancel }: CMFormProps) {
    const [editMode, setEditMode] = useState(false);

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

    useEffect(() => { onComplete?.(true); }, [onComplete]);

    const isSummaryFilled = summary.trim().length > 0;
    const canFinalSave = isSummaryFilled;

    const onSave = () => {
        console.log({ job, summary, type, stationId });
        alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
    };
    const onFinalSave = () => {
        console.log({ job, summary, type, stationId });
        alert("บันทึกเรียบร้อย (เดโม่) – ดูข้อมูลใน console");
    };

    const handlePrint = () => window.print();

    return (
        <section className="tw-pb-24">
            {/* ===== Printable Sheet (Single Card) ===== */}
            <div className="tw-mx-auto tw-max-w-4xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-sm tw-p-6 md:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0 tw-print:tw-p-0">

                {/* header */}
                <div className="tw-flex tw-items-start tw-justify-between tw-gap-6">
                    {/* left: company/site */}
                    <div className="tw-flex tw-gap-4">
                        <div className="tw-h-12 tw-w-12 tw-rounded-md tw-border tw-border-blue-gray-100 tw-grid tw-place-items-center">
                            <span className="tw-text-xs tw-text-blue-gray-400">LOGO</span>
                        </div>
                        <div>
                            <div className="tw-font-semibold tw-text-blue-gray-900">
                                รายงานบันทึกปัญหา (CM) – {TYPE_LABEL[type]}
                            </div>
                            <div className="tw-text-sm tw-text-blue-gray-600">
                                สถานี: {stationName || stationId || "-"}
                            </div>
                            <div className="tw-text-sm tw-text-blue-gray-600">บริษัท/ไซต์งานของคุณ</div>
                        </div>
                    </div>

                    {/* right: meta */}
                    <div className="tw-text-right tw-space-y-1">
                        <div className="tw-text-xs tw-text-blue-gray-500">Issue no.</div>
                        <div className="tw-font-semibold tw-text-blue-gray-900">#{job.issue_id || "-"}</div>
                        <div className="tw-grid tw-grid-cols-2 tw-gap-x-4 tw-text-sm tw-text-blue-gray-700 tw-mt-2">
                            <div className="tw-text-blue-gray-500">พบปัญหา</div>
                            <div>{job.found_date ? new Date(job.found_date).toLocaleString() : "-"}</div>
                            <div className="tw-text-blue-gray-500">เสร็จสิ้น</div>
                            <div>{job.resolved_date ? new Date(job.resolved_date).toLocaleString() : "-"}</div>
                        </div>
                        <div className="tw-mt-2">
                            <Badge>{job.status || "ยังไม่กำหนดสถานะ"}</Badge>
                        </div>
                    </div>
                </div>

                {/* top actions (not printed) */}
                <div className="tw-mt-6 tw-flex tw-justify-end tw-gap-2 tw-print:tw-hidden">
                    <Button variant="outlined" color="blue-gray" className="tw-h-10 tw-text-sm" onClick={() => setEditMode((s) => !s)}>
                        {editMode ? "ดูสรุป" : "แก้ไขข้อมูล"}
                    </Button>
                    <Button variant="outlined" className="tw-h-10 tw-text-sm" onClick={handlePrint}>
                        พิมพ์เอกสาร
                    </Button>
                </div>

                {/* body */}
                {!editMode ? (
                    <>
                        {/* two columns like invoice items */}
                        <div className="tw-mt-8 tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
                            <div>
                                <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">สถานที่ / อุปกรณ์</div>
                                <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg">
                                    <Row k="สถานที่" v={job.location} />
                                    <Row k="อุปกรณ์" v={job.equipment} />
                                </div>
                            </div>

                            <div>
                                <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">ผู้เกี่ยวข้อง</div>
                                <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg">
                                    <Row k="ผู้รายงาน" v={job.reported_by} />
                                    <Row k="ผู้รับผิดชอบ" v={job.assignee} />
                                    <Row k="ความรุนแรง" v={job.severity} />
                                </div>
                            </div>

                            <div className="md:tw-col-span-2">
                                <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">รายละเอียดปัญหา</div>
                                <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg">
                                    <Row k="ประเภทปัญหา" v={job.problem_type} />
                                    <Row k="รายละเอียด" v={<span className="tw-whitespace-pre-wrap">{job.problem_details}</span>} />
                                </div>
                            </div>

                            <div className="md:tw-col-span-2">
                                <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">สาเหตุและการแก้ไข</div>
                                <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg">
                                    <Row k="สาเหตุเบื้องต้น" v={job.initial_cause} />
                                    <Row k="การแก้ไข (Corrective Action)" v={job.corrective_action} />
                                    <Row k="ผลหลังซ่อม" v={job.repair_result} />
                                    <Row k="วิธีป้องกันซ้ำ" v={job.preventive_action} />
                                </div>
                            </div>

                            <div className="md:tw-col-span-2">
                                <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">หมายเหตุ</div>
                                <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg">
                                    <Row k="หมายเหตุ" v={<span className="tw-whitespace-pre-wrap">{job.remarks}</span>} />
                                </div>
                            </div>

                            <div className="md:tw-col-span-2">
                                <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">สรุปผลการตรวจสอบ</div>
                                <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg">
                                    <Row k="สรุปผล" v={<span className="tw-whitespace-pre-wrap">{summary || "-"}</span>} />
                                </div>
                            </div>
                        </div>

                        {/* footer like invoice */}
                        <div className="tw-mt-10 tw-flex tw-items-center tw-justify-between tw-print:tw-mt-8">
                            <div>
                                <div className="tw-font-semibold tw-text-blue-gray-900 tw-mb-1">ขอบคุณ!</div>
                                <div className="tw-text-sm tw-text-blue-gray-600">หากพบปัญหา/ข้อมูลคลาดเคลื่อน โปรดติดต่อ:</div>
                                <div className="tw-text-sm tw-text-blue-gray-900">support@yourcompany.com</div>
                            </div>
                            <Button onClick={handlePrint} className="tw-h-10 tw-text-sm tw-print:tw-hidden">
                                PRINT
                            </Button>
                        </div>
                    </>
                ) : (
                    /* ===== Edit Mode (simple, compact) ===== */
                    <div className="tw-mt-8 tw-space-y-6">
                        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                            <Input label="Issue ID" value={job.issue_id} onChange={(e) => setJob({ ...job, issue_id: e.target.value })} crossOrigin="" />
                            <Input type="datetime-local" label="วันที่พบปัญหา" value={job.found_date} onChange={(e) => setJob({ ...job, found_date: e.target.value })} crossOrigin="" />
                            <Input label="สถานที่" value={job.location} onChange={(e) => setJob({ ...job, location: e.target.value })} crossOrigin="" />
                            <Input label="อุปกรณ์" value={job.equipment} onChange={(e) => setJob({ ...job, equipment: e.target.value })} crossOrigin="" />
                            <Input label="ประเภทปัญหา" value={job.problem_type} onChange={(e) => setJob({ ...job, problem_type: e.target.value })} crossOrigin="" />
                            <Input label="ความรุนแรง" value={job.severity} onChange={(e) => setJob({ ...job, severity: e.target.value as Severity })} crossOrigin="" />
                            <Input label="ผู้รายงาน" value={job.reported_by} onChange={(e) => setJob({ ...job, reported_by: e.target.value })} crossOrigin="" />
                            <Input label="ผู้รับผิดชอบ" value={job.assignee} onChange={(e) => setJob({ ...job, assignee: e.target.value })} crossOrigin="" />
                            <Input label="วันที่เสร็จ" type="datetime-local" value={job.resolved_date} onChange={(e) => setJob({ ...job, resolved_date: e.target.value })} crossOrigin="" />
                            <Input label="ผลหลังซ่อม" value={job.repair_result} onChange={(e) => setJob({ ...job, repair_result: e.target.value })} crossOrigin="" />
                            <Input label="วิธีป้องกันซ้ำ" value={job.preventive_action} onChange={(e) => setJob({ ...job, preventive_action: e.target.value })} crossOrigin="" />
                            <Input label="สถานะ" value={job.status} onChange={(e) => setJob({ ...job, status: e.target.value as Status })} crossOrigin="" />
                        </div>

                        <Textarea label="รายละเอียดปัญหา" rows={4} value={job.problem_details} onChange={(e) => setJob({ ...job, problem_details: e.target.value })} className="!tw-w-full" containerProps={{ className: "!tw-min-w-0" }} />
                        <Input label="สาเหตุเบื้องต้น" value={job.initial_cause} onChange={(e) => setJob({ ...job, initial_cause: e.target.value })} crossOrigin="" />
                        <Input label="การแก้ไข (Corrective Action)" value={job.corrective_action} onChange={(e) => setJob({ ...job, corrective_action: e.target.value })} crossOrigin="" />
                        <Textarea label="หมายเหตุ" rows={3} value={job.remarks} onChange={(e) => setJob({ ...job, remarks: e.target.value })} className="!tw-w-full" containerProps={{ className: "!tw-min-w-0" }} />
                        <Textarea label="สรุปผลการตรวจสอบ" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} className="!tw-w-full" containerProps={{ className: "!tw-min-w-0" }} />

                        <div className="tw-flex tw-justify-end tw-gap-2 tw-pt-2 tw-print:tw-hidden">
                            <Button variant="outlined" color="blue-gray" onClick={onSave} className="tw-h-10 tw-text-sm">บันทึกชั่วคราว</Button>
                            <Button onClick={onFinalSave} className="tw-h-10 tw-text-sm" disabled={!canFinalSave}>บันทึก</Button>
                        </div>
                    </div>
                )}
            </div>

            {/* print styles */}
            <style jsx global>{`
        @media print {
          body { background: white !important; }
          .tw-print\\:tw-hidden { display: none !important; }
          .tw-print\\:tw-mt-8 { margin-top: 2rem !important; }
        }
      `}</style>
        </section>
    );
}
