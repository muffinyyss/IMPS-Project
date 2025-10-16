// "use client";

// import React, { useMemo, useState } from "react";
// import { Button, Input, Textarea } from "@material-tailwind/react";
// import Image from "next/image";

// type Severity = "" | "Low" | "Medium" | "High" | "Critical";
// type Status = "" | "Open" | "In Progress" | "Closed";
// export type EquipmentType = "charger" | "mdb" | "ccb" | "cb_box" | "station";

// type CorrectiveItem = {
//     text: string;
//     images: { file: File; url: string }[];
// };

// type Job = {
//     issue_id: string;
//     found_date: string;
//     location: string;
//     equipment_list: string[];
//     problem_details: string;
//     problem_type: string;
//     severity: Severity;
//     reported_by: string;
//     assignee: string;
//     initial_cause: string;
//     corrective_actions: CorrectiveItem[];
//     resolved_date: string;
//     repair_result: string;
//     preventive_action: string[];
//     status: Status;
//     remarks: string;
// };

// type CMFormProps = {
//     type?: EquipmentType;
//     label?: string;
//     stationId: string;
//     stationName?: string;
//     onComplete?: (ok: boolean) => void;
//     onCancel?: () => void;
// };

// const TYPE_LABEL_FALLBACK: Record<EquipmentType, string> = {
//     charger: "เครื่องอัดประจุไฟฟ้า (Charger)",
//     mdb: "MDB",
//     ccb: "CCB",
//     cb_box: "CB-BOX",
//     station: "Station",
// };

// const SEVERITY_OPTIONS: Severity[] = ["", "Low", "Medium", "High", "Critical"];
// const STATUS_OPTIONS: Status[] = ["", "Open", "In Progress", "Closed"];
// const LOGO_SRC = "/img/logo_egat.png";

// export default function CMForm({
//     type = "charger",
//     label,
//     stationId,
//     stationName,
//     onComplete,
//     onCancel,
// }: CMFormProps) {
//     const [job, setJob] = useState<Job>({
//         issue_id: "",
//         found_date: "",
//         location: "",
//         equipment_list: [""],
//         problem_details: "",
//         problem_type: "",
//         severity: "",
//         reported_by: "",
//         assignee: "",
//         initial_cause: "",
//         corrective_actions: [{ text: "", images: [] }],
//         resolved_date: "",
//         repair_result: "",
//         preventive_action: [""],
//         status: "",
//         remarks: "",
//     });
//     const [summary, setSummary] = useState<string>("");

//     const headerLabel = useMemo(
//         () => label || TYPE_LABEL_FALLBACK[type],
//         [label, type]
//     );

//     const stationReady = !!stationId;
//     const canFinalSave = stationReady;

//     const onSave = () => {
//         console.log({ job, summary, type, stationId, stationName });
//         alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
//     };
//     const onFinalSave = () => {
//         console.log({ job, summary, type, stationId, stationName });
//         alert("บันทึกเรียบร้อย (เดโม่) – ดูข้อมูลใน console");
//         onComplete?.(true);
//     };
//     const handlePrint = () => window.print();

//     /* -------------------- Helpers: ลดความซ้ำซ้อน -------------------- */
//     // สำหรับลิสต์สตริงทั่วไป เช่น equipment_list / preventive_action
//     type StringListKey = "equipment_list" | "preventive_action";

//     const setStringItem =
//         (key: StringListKey) => (i: number, val: string) =>
//             setJob((prev) => {
//                 const list = [...prev[key]];
//                 list[i] = val;
//                 return { ...prev, [key]: list };
//             });

//     const addStringItem =
//         (key: StringListKey) => () =>
//             setJob((prev) => ({ ...prev, [key]: [...prev[key], ""] }));

//     const removeStringItem =
//         (key: StringListKey) => (i: number) =>
//             setJob((prev) => {
//                 const list = [...prev[key]];
//                 if (list.length <= 1) return { ...prev, [key]: [""] }; // อย่างน้อย 1 ช่อง
//                 list.splice(i, 1);
//                 return { ...prev, [key]: list };
//             });

//     // สำหรับ corrective_actions (มี text + images)
//     const patchCorrective = (i: number, patch: Partial<CorrectiveItem>) =>
//         setJob((prev) => {
//             const list = [...prev.corrective_actions];
//             list[i] = { ...list[i], ...patch };
//             return { ...prev, corrective_actions: list };
//         });

//     const addCorrective = () =>
//         setJob((prev) => ({
//             ...prev,
//             corrective_actions: [
//                 ...prev.corrective_actions,
//                 { text: "", images: [] },
//             ],
//         }));

//     const removeCorrective = (i: number) =>
//         setJob((prev) => {
//             const list = [...prev.corrective_actions];
//             if (list.length <= 1)
//                 return { ...prev, corrective_actions: [{ text: "", images: [] }] };
//             list.splice(i, 1);
//             return { ...prev, corrective_actions: list };
//         });

//     const addCorrectiveImages = (i: number, files: FileList | null) => {
//         if (!files?.length) return;
//         const imgs = Array.from(files).map((file) => ({
//             file,
//             url: URL.createObjectURL(file),
//         }));
//         const current = job.corrective_actions[i];
//         patchCorrective(i, { images: [...current.images, ...imgs] });
//     };

//     const removeCorrectiveImage = (i: number, j: number) => {
//         const imgs = [...job.corrective_actions[i].images];
//         const url = imgs[j]?.url;
//         if (url) URL.revokeObjectURL(url);
//         imgs.splice(j, 1);
//         patchCorrective(i, { images: imgs });
//     };
//     /* ----------------------------------------------------------------- */

//     return (
//         <section className="tw-pb-24">
//             <form
//                 action="#"
//                 noValidate
//                 onSubmit={(e) => {
//                     e.preventDefault();
//                     return false; // <— ป้องกันการ reload หน้าทั้งหมด
//                 }}
//                 onKeyDown={(e) => {
//                     if (e.key === "Enter") e.preventDefault(); // ปิด enter จาก input
//                 }}
//             >
//                 <div className="tw-mx-auto tw-max-w-4xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-sm tw-p-6 md:tw-p-8 tw-print:tw-shadow-none tw-print:tw-border-0">
//                     {/* HEADER */}
//                     <div className="tw-flex tw-items-start tw-justify-between tw-gap-6">
//                         {/* ซ้าย: โลโก้ + ข้อความ */}
//                         <div className="tw-flex tw-items-start tw-gap-4">
//                             <div
//                                 className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md
//                  tw-h-16 tw-w-16 md:tw-h-20 md:tw-w-20 lg:tw-h-24 lg:tw-w-24"
//                             >
//                                 <Image
//                                     src={LOGO_SRC}
//                                     alt="Company logo"
//                                     fill
//                                     priority
//                                     className="tw-object-contain tw-p-1"
//                                     sizes="(min-width:1024px) 96px, (min-width:768px) 80px, 64px"
//                                 />
//                             </div>

//                             <div>
//                                 <div className="tw-font-semibold tw-text-blue-gray-900">
//                                     รายงานบันทึกปัญหา (CM) – {headerLabel}
//                                 </div>
//                                 <div className="tw-text-sm tw-text-blue-gray-600">
//                                     การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)<br />
//                                     เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย<br />
//                                     จังหวัดนนทบุรี 11130 ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416
//                                 </div>
//                             </div>
//                         </div>

//                         {/* ปุ่มด้านขวาใน HEADER */}
//                         <div className="tw-flex tw-items-start tw-gap-2 tw-print:tw-hidden">
//                             {onCancel && (
//                                 <Button
//                                     type="button"                // <— เพิ่ม
//                                     variant="text"
//                                     color="blue-gray"
//                                     className="tw-h-10 tw-text-sm"
//                                     onClick={onCancel}
//                                 >
//                                     ยกเลิก
//                                 </Button>
//                             )}
//                             <Button
//                                 type="button"                  // <— เพิ่ม
//                                 variant="outlined"
//                                 className="tw-h-10 tw-text-sm"
//                                 onClick={handlePrint}
//                                 disabled={!stationReady}
//                                 title={stationReady ? "" : "กรุณาเลือกสถานีก่อน"}
//                             >
//                                 พิมพ์เอกสาร
//                             </Button>
//                         </div>
//                     </div>


//                     {/* BODY */}
//                     <div className="tw-mt-8 tw-space-y-8">
//                         {/* META – การ์ดหัวเรื่อง */}
//                         <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-6 tw-gap-4">
//                             <div className="lg:tw-col-span-1">
//                                 <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
//                                     Issue ID
//                                 </label>
//                                 <Input
//                                     value={job.issue_id}
//                                     onChange={(e) => setJob({ ...job, issue_id: e.target.value })}
//                                     crossOrigin=""
//                                     className="!tw-w-full"
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div>

//                             <div className="sm:tw-col-span-2 lg:tw-col-span-3">
//                                 <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
//                                     สถานที่
//                                 </label>
//                                 <Input
//                                     value={job.location}
//                                     onChange={(e) => setJob({ ...job, location: e.target.value })}
//                                     crossOrigin=""
//                                     className="!tw-w-full"
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div>

//                             <div className="lg:tw-col-span-1">
//                                 <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
//                                     พบปัญหา
//                                 </label>
//                                 <Input
//                                     type="date"
//                                     value={(job.found_date || "").slice(0, 10)}
//                                     onChange={(e) => setJob({ ...job, found_date: e.target.value })}
//                                     crossOrigin=""
//                                     className="!tw-w-full"
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div>

//                             <div className="lg:tw-col-span-1">
//                                 <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
//                                     เสร็จสิ้น
//                                 </label>
//                                 <Input
//                                     type="date"
//                                     value={(job.resolved_date || "").slice(0, 10)}
//                                     min={(job.found_date || "").slice(0, 10)}
//                                     onChange={(e) =>
//                                         setJob({ ...job, resolved_date: e.target.value })
//                                     }
//                                     crossOrigin=""
//                                     className="!tw-w-full"
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div>
//                         </div>

//                         {/* 2 คอลัมน์: อุปกรณ์ | ผู้เกี่ยวข้อง */}
//                         <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
//                             {/* อุปกรณ์ – หลายรายการ */}
//                             <div className="tw-space-y-3">
//                                 <div className="tw-flex tw-items-center tw-justify-between">
//                                     <span className="tw-text-sm tw-font-medium tw-text-blue-gray-800">
//                                         อุปกรณ์
//                                     </span>
//                                     <button
//                                         type="button"
//                                         onClick={addStringItem("equipment_list")}
//                                         className="tw-text-sm tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-1 hover:tw-bg-blue-gray-50"
//                                     >
//                                         + เพิ่ม
//                                     </button>
//                                 </div>

//                                 {job.equipment_list.map((val, i) => (
//                                     <div key={i} className="tw-flex tw-items-center tw-gap-2">
//                                         <Input
//                                             label={`รายการที่ ${i + 1}`}
//                                             value={val}
//                                             onChange={(e) =>
//                                                 setStringItem("equipment_list")(i, e.target.value)
//                                             }
//                                             crossOrigin=""
//                                             className="tw-flex-1"
//                                         />
//                                         <button
//                                             type="button"
//                                             onClick={() => removeStringItem("equipment_list")(i)}
//                                             disabled={job.equipment_list.length <= 1}
//                                             className={`tw-h-10 tw-rounded-md tw-border tw-px-3 ${job.equipment_list.length <= 1
//                                                 ? "tw-border-blue-gray-100 tw-text-blue-gray-300 tw-cursor-not-allowed"
//                                                 : "tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50"
//                                                 }`}
//                                             title={
//                                                 job.equipment_list.length <= 1
//                                                     ? "ต้องมีอย่างน้อย 1 รายการ"
//                                                     : "ลบรายการนี้"
//                                             }
//                                         >
//                                             ลบ
//                                         </button>
//                                     </div>
//                                 ))}
//                             </div>

//                             {/* ผู้เกี่ยวข้อง */}
//                             <div>
//                                 <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
//                                     ผู้เกี่ยวข้อง
//                                 </div>
//                                 <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
//                                     <Input
//                                         label="ผู้รายงาน"
//                                         value={job.reported_by}
//                                         onChange={(e) =>
//                                             setJob({ ...job, reported_by: e.target.value })
//                                         }
//                                         crossOrigin=""
//                                     />
//                                     <Input
//                                         label="ผู้รับผิดชอบ"
//                                         value={job.assignee}
//                                         onChange={(e) =>
//                                             setJob({ ...job, assignee: e.target.value })
//                                         }
//                                         crossOrigin=""
//                                     />
//                                 </div>
//                             </div>
//                         </div>

//                         {/* รายละเอียดปัญหา */}
//                         <div>
//                             <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
//                                 รายละเอียดปัญหา
//                             </div>
//                             <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
//                                 <div>
//                                     <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
//                                         ความรุนแรง
//                                     </label>
//                                     <select
//                                         value={job.severity}
//                                         onChange={(e) =>
//                                             setJob({ ...job, severity: e.target.value as Severity })
//                                         }
//                                         className="tw-w-full tw-h-10 tw-border tw-border-blue-gray-200 tw-rounded-lg tw-px-3 tw-py-2"
//                                     >
//                                         {SEVERITY_OPTIONS.map((s) => (
//                                             <option key={s} value={s}>
//                                                 {s || "เลือก..."}
//                                             </option>
//                                         ))}
//                                     </select>
//                                 </div>
//                                 <Input
//                                     label="ประเภทปัญหา"
//                                     value={job.problem_type}
//                                     onChange={(e) =>
//                                         setJob({ ...job, problem_type: e.target.value })
//                                     }
//                                     crossOrigin=""
//                                 />
//                                 <Textarea
//                                     label="รายละเอียด"
//                                     rows={3}
//                                     value={job.problem_details}
//                                     onChange={(e) =>
//                                         setJob({ ...job, problem_details: e.target.value })
//                                     }
//                                     className="!tw-w-full"
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div>
//                         </div>

//                         {/* สาเหตุและการแก้ไข */}
//                         <div>
//                             <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
//                                 สาเหตุและการแก้ไข
//                             </div>
//                             <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
//                                 <Textarea
//                                     label="สาเหตุเบื้องต้น"
//                                     rows={3}
//                                     value={job.initial_cause}
//                                     onChange={(e) =>
//                                         setJob({ ...job, initial_cause: e.target.value })
//                                     }
//                                     className="!tw-w-full"
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />

//                                 {/* Corrective Action: หลายข้อ + แนบรูป */}
//                                 <div className="tw-space-y-4">
//                                     <div className="tw-flex tw-items-center tw-justify-between">
//                                         <span className="tw-text-sm tw-font-medium tw-text-blue-gray-800">
//                                             การแก้ไข (Corrective Action)
//                                         </span>
//                                         <button
//                                             type="button"
//                                             onClick={addCorrective}
//                                             className="tw-text-sm tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-1 hover:tw-bg-blue-gray-50"
//                                         >
//                                             + เพิ่ม
//                                         </button>
//                                     </div>

//                                     {job.corrective_actions.map((item, i) => {
//                                         const canDelete = job.corrective_actions.length > 1; // >1 ถึงลบได้
//                                         return (
//                                             <div
//                                                 key={i}
//                                                 className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-3 tw-space-y-3"
//                                             >
//                                                 <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
//                                                     <Textarea
//                                                         label={`ข้อที่ ${i + 1}`}
//                                                         rows={3}
//                                                         value={item.text}
//                                                         onChange={(e) => patchCorrective(i, { text: e.target.value })}
//                                                         className="!tw-w-full"
//                                                         containerProps={{ className: "!tw-min-w-0 tw-flex-1" }}
//                                                     />
//                                                     <button
//                                                         type="button"
//                                                         onClick={() => removeCorrective(i)}
//                                                         disabled={!canDelete}
//                                                         className={`tw-shrink-0 tw-ml-2 tw-h-9 tw-rounded-md tw-border tw-px-3 ${!canDelete
//                                                             ? "tw-border-blue-gray-100 tw-text-blue-gray-300 tw-cursor-not-allowed"
//                                                             : "tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50"
//                                                             }`}
//                                                         title={!canDelete ? "ต้องมีอย่างน้อย 1 ข้อ" : "ลบรายการนี้"}
//                                                         aria-disabled={!canDelete}
//                                                     >
//                                                         ลบ
//                                                     </button>
//                                                 </div>

//                                                 <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
//                                                     <label className="tw-inline-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50">
//                                                         <input
//                                                             type="file"
//                                                             accept="image/*"
//                                                             multiple
//                                                             capture="environment"
//                                                             className="tw-hidden"
//                                                             onChange={(e) => addCorrectiveImages(i, e.target.files)}
//                                                         />
//                                                         <span className="tw-text-sm">+ เพิ่มรูป / ถ่ายรูป</span>
//                                                     </label>

//                                                     {item.images.length > 0 && (
//                                                         <div className="tw-w-full tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
//                                                             {item.images.map((img, j) => (
//                                                                 <div
//                                                                     key={j}
//                                                                     className="tw-relative tw-aspect-video tw-rounded-md tw-overflow-hidden tw-border tw-border-blue-gray-100"
//                                                                 >
//                                                                     <img
//                                                                         src={img.url}
//                                                                         alt={`action-${i}-img-${j}`}
//                                                                         className="tw-w-full tw-h-full tw-object-cover"
//                                                                     />
//                                                                     <button
//                                                                         type="button"
//                                                                         onClick={() => removeCorrectiveImage(i, j)}
//                                                                         className="tw-absolute tw-top-1 tw-right-1 tw-bg-white/80 tw-backdrop-blur tw-text-red-600 tw-text-xs tw-rounded tw-px-2 tw-py-1 hover:tw-bg-white"
//                                                                     >
//                                                                         ลบ
//                                                                     </button>
//                                                                 </div>
//                                                             ))}
//                                                         </div>
//                                                     )}
//                                                 </div>
//                                             </div>
//                                         );
//                                     })}
//                                 </div>

//                                 <Input
//                                     label="ผลหลังซ่อม"
//                                     value={job.repair_result}
//                                     onChange={(e) =>
//                                         setJob({ ...job, repair_result: e.target.value })
//                                     }
//                                     crossOrigin=""
//                                 />

//                                 {/* วิธีป้องกันซ้ำ – หลายข้อ */}
//                                 <div className="tw-space-y-3">
//                                     <div className="tw-flex tw-items-center tw-justify-between">
//                                         <span className="tw-text-sm tw-font-medium tw-text-blue-gray-800">
//                                             วิธีป้องกันซ้ำ
//                                         </span>
//                                         <button
//                                             type="button"
//                                             onClick={addStringItem("preventive_action")}
//                                             className="tw-text-sm tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-1 hover:tw-bg-blue-gray-50"
//                                         >
//                                             + เพิ่ม
//                                         </button>
//                                     </div>

//                                     {job.preventive_action.map((val, i) => (
//                                         <div key={i} className="tw-flex tw-items-center tw-gap-2">
//                                             <Input
//                                                 label={`ข้อที่ ${i + 1}`}
//                                                 value={val}
//                                                 onChange={(e) =>
//                                                     setStringItem("preventive_action")(i, e.target.value)
//                                                 }
//                                                 crossOrigin=""
//                                                 className="tw-flex-1"
//                                             />
//                                             <button
//                                                 type="button"
//                                                 onClick={() =>
//                                                     removeStringItem("preventive_action")(i)
//                                                 }
//                                                 disabled={job.preventive_action.length <= 1}
//                                                 className={`tw-h-10 tw-rounded-md tw-border tw-px-3 ${job.preventive_action.length <= 1
//                                                     ? "tw-border-blue-gray-100 tw-text-blue-gray-300 tw-cursor-not-allowed"
//                                                     : "tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50"
//                                                     }`}
//                                                 title={
//                                                     job.preventive_action.length <= 1
//                                                         ? "ต้องมีอย่างน้อย 1 ข้อ"
//                                                         : "ลบวิธีนี้"
//                                                 }
//                                             >
//                                                 ลบ
//                                             </button>
//                                         </div>
//                                     ))}
//                                 </div>
//                             </div>
//                         </div>

//                         {/* หมายเหตุ */}
//                         <div>
//                             <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
//                                 หมายเหตุ
//                             </div>
//                             <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4">
//                                 <Textarea
//                                     label="หมายเหตุ"
//                                     rows={3}
//                                     value={job.remarks}
//                                     onChange={(e) =>
//                                         setJob({ ...job, remarks: e.target.value })
//                                     }
//                                     className="!tw-w-full"
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div>
//                         </div>

//                         {/* สรุปผลการตรวจสอบ */}
//                         <div>
//                             <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
//                                 สรุปผลการตรวจสอบ
//                             </div>
//                             <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4">
//                                 <Textarea
//                                     label="สรุปผล"
//                                     rows={4}
//                                     value={summary}
//                                     onChange={(e) => setSummary(e.target.value)}
//                                     className="!tw-w-full"
//                                     containerProps={{ className: "!tw-min-w-0" }}
//                                 />
//                             </div>
//                         </div>

//                         {/* FOOTER + ปุ่มบันทึก */}
//                         <div className="tw-flex tw-items-center tw-justify-between tw-print:tw-mt-8">
//                             <div />
//                             {/* ปุ่มบันทึกด้านล่าง */}
//                             <div className="tw-flex tw-gap-2 tw-print:tw-hidden">
//                                 <Button
//                                     type="button"                  // <— เพิ่ม
//                                     variant="outlined"
//                                     color="blue-gray"
//                                     onClick={onSave}
//                                     className="tw-h-10 tw-text-sm"
//                                     disabled={!stationReady}
//                                     title={stationReady ? "" : "กรุณาเลือกสถานีก่อน"}
//                                 >
//                                     บันทึกชั่วคราว
//                                 </Button>
//                                 <Button
//                                     type="button"                  // <— เพิ่ม
//                                     onClick={onFinalSave}
//                                     className="tw-h-10 tw-text-sm"
//                                     disabled={!canFinalSave}
//                                     title={canFinalSave ? "" : "กรุณาเลือกสถานีก่อน"}
//                                 >
//                                     PRINT
//                                 </Button>
//                             </div>
//                         </div>
//                     </div>
//                 </div>

//                 {/* print styles */}
//                 <style jsx global>
//                     {`
//                     @media print {
//                         body {
//                             background: white !important;
//                         }
//                         .tw-print\\:tw-hidden {
//                             display: none !important;
//                         }
//                     }
//                 `}
//                 </style>

//                 {!stationReady && (
//                     <div className="tw-mt-3 tw-text-sm tw-text-red-600 tw-print:tw-hidden">
//                         กรุณาเลือกสถานีจากแถบด้านบนก่อนบันทึก/พิมพ์เอกสาร
//                     </div>
//                 )}
//             </form>
//         </section>
//     );
// }


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
    reported_by: string;
    assignee: string;
    initial_cause: string;
    corrective_actions: CorrectiveItem[];
    resolved_date: string;
    repair_result: string;
    preventive_action: string[];
    status: Status;
    remarks: string;
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
    reported_by: "",
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
    type StringListKey = "equipment_list" | "preventive_action";

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
                            <div className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md tw-h-16 tw-w-16 md:tw-h-20 md:tw-w-20 lg:tw-h-24 lg:tw-w-24">
                                <Image
                                    src={LOGO_SRC}
                                    alt="Company logo"
                                    fill
                                    priority
                                    className="tw-object-contain tw-p-1"
                                    sizes="(min-width:1024px) 96px, (min-width:768px) 80px, 64px"
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
                        </div>
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
                                    className="!tw-w-full"
                                    containerProps={{ className: "!tw-min-w-0" }}
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
                                    className="!tw-w-full"
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

                        {/* 2 คอลัมน์: อุปกรณ์ | ผู้เกี่ยวข้อง */}
                        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
                            {/* อุปกรณ์ – หลายรายการ */}
                            <div className="tw-space-y-3">
                                <div className="tw-flex tw-items-center tw-justify-between">
                                    <span className="tw-text-sm tw-font-medium tw-text-blue-gray-800">
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

                            {/* ผู้เกี่ยวข้อง */}
                            <div>
                                <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                                    ผู้เกี่ยวข้อง
                                </div>
                                <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                                    <Input
                                        label="ผู้รายงาน"
                                        value={job.reported_by}
                                        onChange={(e) => setJob({ ...job, reported_by: e.target.value })}
                                        crossOrigin=""
                                    />
                                    <Input
                                        label="ผู้รับผิดชอบ"
                                        value={job.assignee}
                                        onChange={(e) => setJob({ ...job, assignee: e.target.value })}
                                        crossOrigin=""
                                    />
                                </div>
                            </div>
                        </div>

                        {/* รายละเอียดปัญหา */}
                        <div>
                            <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                                รายละเอียดปัญหา
                            </div>
                            <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                                <div>
                                    <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                                        ความรุนแรง
                                    </label>
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
                            </div>
                        </div>

                        {/* สาเหตุและการแก้ไข */}
                        <div>
                            <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
                                สาเหตุและการแก้ไข
                            </div>
                            <div className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
                                <Textarea
                                    label="สาเหตุเบื้องต้น"
                                    rows={3}
                                    value={job.initial_cause}
                                    onChange={(e) => setJob({ ...job, initial_cause: e.target.value })}
                                    className="!tw-w-full"
                                    containerProps={{ className: "!tw-min-w-0" }}
                                />

                                {/* Corrective Action */}
                                <div className="tw-space-y-4">
                                    <div className="tw-flex tw-items-center tw-justify-between">
                                        <span className="tw-text-sm tw-font-medium tw-text-blue-gray-800">
                                            การแก้ไข (Corrective Action)
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
                                            <div key={i} className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-3 tw-space-y-3">
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
                                                                <div key={j} className="tw-relative tw-aspect-video tw-rounded-md tw-overflow-hidden tw-border tw-border-blue-gray-100">
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
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <Input
                                    label="ผลหลังซ่อม"
                                    value={job.repair_result}
                                    onChange={(e) => setJob({ ...job, repair_result: e.target.value })}
                                    crossOrigin=""
                                />

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
                <style jsx global>{`
          @media print {
            body {
              background: white !important;
            }
            .tw-print\\:tw-hidden {
              display: none !important;
            }
          }
        `}</style>
            </form>
        </section>
    );
}
