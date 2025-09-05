// "use client";

// import React, { useState } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import {
//     Button,
//     Card,
//     CardBody,
//     CardHeader,
//     CardFooter,
//     Input,
//     Typography,
//     Checkbox,
// } from "@material-tailwind/react";
// import { ArrowLeftIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";

// /** Toggle Pass/Fail + Remark (ใช้ซ้ำได้) */
// function PassFailRow({
//     label,
//     value,
//     onChange,
//     remark,
//     onRemarkChange,
// }: {
//     label: string;
//     value: "PASS" | "FAIL" | "";
//     onChange: (v: "PASS" | "FAIL") => void;
//     remark?: string;
//     onRemarkChange?: (v: string) => void;
// }) {
//     return (
//         <div className="tw-space-y-2 tw-py-3 tw-border-b tw-border-blue-gray-50">
//             <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
//                 <Typography className="tw-font-medium">{label}</Typography>

//                 <div className="tw-flex tw-gap-2">
//                     <Button
//                         size="sm"
//                         variant={value === "PASS" ? "filled" : "outlined"}
//                         className="tw-min-w-[84px]"
//                         onClick={() => onChange("PASS")}
//                     >
//                         PASS
//                     </Button>
//                     <Button
//                         size="sm"
//                         color="red"
//                         variant={value === "FAIL" ? "filled" : "outlined"}
//                         className="tw-min-w-[84px]"
//                         onClick={() => onChange("FAIL")}
//                     >
//                         FAIL
//                     </Button>
//                 </div>
//             </div>

//             {onRemarkChange && (
//                 <Input
//                     label="หมายเหตุ (ถ้ามี)"
//                     value={remark || ""}
//                     onChange={(e) => onRemarkChange(e.target.value)}
//                     crossOrigin=""
//                 />
//             )}
//         </div>
//     );
// }

// export default function PMReportForm() {
//     const router = useRouter();

//     // --- Job Info ---
//     const [job, setJob] = useState({
//         workOrder: "",
//         sn: "",
//         model: "",
//         location: "",
//         date: "",
//         inspector: "",
//     });

//     // --- Checklist states ---
//     const [rows, setRows] = useState<Record<string, { pf: "PASS" | "FAIL" | ""; remark: string }>>({
//         r1: { pf: "", remark: "" },
//         r2: { pf: "", remark: "" },
//         r3: { pf: "", remark: "" },
//         r4: { pf: "", remark: "" },
//         r5: { pf: "", remark: "" },
//         r6: { pf: "", remark: "" },
//         r7: { pf: "", remark: "" },
//         r8: { pf: "", remark: "" },
//         r9: { pf: "", remark: "" },
//         r10: { pf: "", remark: "" },
//         r11: { pf: "", remark: "" },
//         r12: { pf: "", remark: "" },
//         r13: { pf: "", remark: "" },
//         r14: { pf: "", remark: "" },
//         r15: { pf: "", remark: "" },
//     });

//     // --- Measurements ---
//     const [voltage, setVoltage] = useState({
//         L1L2: "", unit_L1L2: "V",
//         L1L3: "", unit_L1L3: "V",
//         L2L3: "", unit_L2L3: "V",
//         L1N: "", unit_L1N: "V",
//         L2N: "", unit_L2N: "V",
//         L3N: "", unit_L3N: "V",
//         L1G: "", unit_L1G: "V",
//         L2G: "", unit_L2G: "V",
//         L3G: "", unit_L3G: "V",
//         NG: "", unit_NG: "V",
//     });


//     const [insulIn, setInsulIn] = useState({
//         L1G: "", L2G: "", L3G: "",
//         L1N: "", L2N: "", L3N: "",
//         L1L2: "", L1L3: "", L2L3: "", GN: "",
//     });

//     const [voltagePost, setVoltagePost] = useState({
//         L1L2: "", L1L3: "", L2L3: "",
//         L1N: "", L2N: "", L3N: "",
//         L1G: "", L2G: "", L3G: "", NG: "",
//     });

//     const [insulInPost, setInsulInPost] = useState({
//         L1G: "", L2G: "", L3G: "",
//         L1N: "", L2N: "", L3N: "",
//         L1L2: "", L1L3: "", L2L3: "", GN: "",
//     });


//     const [insulCharge, setInsulCharge] = useState({
//         h1_DCpG: "", h1_DCmG: "",
//         h2_DCpG: "", h2_DCmG: "",
//     });

//     const onSave = () => {
//         // TODO: ส่งข้อมูลขึ้น API / ดาวน์โหลด PDF
//         console.log({
//             job, rows, voltage, insulIn, insulCharge, voltagePost,
//             insulInPost,
//         });
//         alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
//     };

//     return (
//         <section className="tw-w-full tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
//             {/* Top bar actions */}
//             <div className="tw-sticky tw-top-0 tw-z-20 tw-bg-transparent tw-pt-3 tw-pb-2">
//                 <div className="
//                     tw-flex tw-items-center tw-justify-between
//                     tw-bg-white tw-border tw-border-blue-gray-100
//                     tw-rounded-2xl tw-shadow-sm
//                     tw-px-4 tw-py-3
//                 ">
//                     <Button
//                         variant="text"
//                         onClick={() => router.back()}
//                         className="tw-bg-white tw-border tw-border-blue-gray-200 tw-rounded-xl tw-shadow-none tw-h-9 tw-px-4 tw-min-w-0 tw-flex tw-items-center tw-justify-center hover:tw-bg-blue-gray-50"
//                     >
//                         <ArrowLeftIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-800" />
//                     </Button>

//                     <Typography variant="h5">PM Report</Typography>

//                     <Button
//                         color="green"
//                         className="tw-gap-2"
//                         onClick={onSave}
//                     >
//                         <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
//                         Save
//                     </Button>
//                 </div>
//             </div>

//             {/* Company Info (แสดงเพื่ออ้างอิง) */}
//             <Card className="tw-mt-3 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                 <CardBody className="tw-space-y-1">
//                     <Typography className="tw-font-semibold">
//                         บริษัท อีแกท ไดมอนด์ เซอร์วิส จำกัด (สำนักงานใหญ่) — Tax ID: 0125552017292
//                     </Typography>
//                     <Typography className="!tw-text-blue-gray-600">
//                         56/25 หมู่ 20 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120
//                     </Typography>
//                 </CardBody>
//             </Card>

//             {/* Job Info */}
//             <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                 <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                     <Typography variant="h6">ข้อมูลงาน</Typography>
//                     <Typography variant="small" className="!tw-text-blue-gray-500">
//                         กรอกให้ง่ายบนมือถือ — ช่องกว้าง แตะง่าย
//                     </Typography>
//                 </CardHeader>
//                 <CardBody className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
//                     <Input
//                         label="Work Order"
//                         value={job.workOrder}
//                         onChange={(e) => setJob({ ...job, workOrder: e.target.value })}
//                         crossOrigin=""
//                         readOnly
//                         className="!tw-bg-blue-gray-50" />
//                     <Input
//                         label="SN / หมายเลขเครื่อง"
//                         value={job.sn}
//                         onChange={(e) => setJob({ ...job, sn: e.target.value })}
//                         crossOrigin=""
//                         className="!tw-bg-blue-gray-50" />
//                     <Input
//                         label="Model / รุ่น"
//                         value={job.model}
//                         onChange={(e) => setJob({ ...job, model: e.target.value })}
//                         crossOrigin=""
//                         className="!tw-bg-blue-gray-50" />
//                     <Input
//                         label="Location / สถานที่"
//                         value={job.location}
//                         onChange={(e) => setJob({ ...job, location: e.target.value })}
//                         crossOrigin=""
//                         className="!tw-bg-blue-gray-50" />
//                     <Input
//                         label="วันที่ตรวจ"
//                         type="date"
//                         value={job.date}
//                         onChange={(e) => setJob({ ...job, date: e.target.value })}
//                         crossOrigin=""
//                     />

//                 </CardBody>
//             </Card>

//             {/* Checklist simple items */}
//             <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                 <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                     <Typography variant="h6">Checklist</Typography>
//                 </CardHeader>
//                 <CardBody className="tw-space-y-1">
//                     <PassFailRow
//                         label="1) Visual Check / ตรวจสอบด้วยสายตา"
//                         value={rows.r1.pf}
//                         onChange={(v) => setRows({ ...rows, r1: { ...rows.r1, pf: v } })}
//                         remark={rows.r1.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r1: { ...rows.r1, remark: v } })}
//                     />
//                     <PassFailRow
//                         label="2) Test Charge / ทดสอบชาร์จทั้ง2หัว (ก่อน PM)"
//                         value={rows.r2.pf}
//                         onChange={(v) => setRows({ ...rows, r2: { ...rows.r2, pf: v } })}
//                         remark={rows.r2.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r2: { ...rows.r2, remark: v } })}
//                     />
//                     <PassFailRow
//                         label="3) Thermal scan / ภาพถ่ายความร้อน (ก่อน PM)"
//                         value={rows.r3.pf}
//                         onChange={(v) => setRows({ ...rows, r3: { ...rows.r3, pf: v } })}
//                         remark={rows.r3.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r3: { ...rows.r3, remark: v } })}
//                     />
//                     <PassFailRow
//                         label="4) Test trip / ทดสอบการทำงานของอุปกรณ์ป้องกันระบบไฟฟ้า"
//                         value={rows.r4.pf}
//                         onChange={(v) => setRows({ ...rows, r4: { ...rows.r4, pf: v } })}
//                         remark={rows.r4.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r4: { ...rows.r4, remark: v } })}
//                     />
//                 </CardBody>
//             </Card>

//             {/* 5. Incoming Voltage */}
//             <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                 <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                     <Typography>5) Incoming voltage check / ตรวจสอบแรงดันขาเข้า (ก่อนPM)</Typography>
//                 </CardHeader>
//                 <CardBody className="tw-space-y-4">
//                     <PassFailRow
//                         label="ผลการตรวจ"
//                         value={rows.r5.pf}
//                         onChange={(v) => setRows({ ...rows, r5: { ...rows.r5, pf: v } })}
//                         remark={rows.r5.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r5: { ...rows.r5, remark: v } })}
//                     />
//                     <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
//                         <div className="tw-flex tw-items-center tw-gap-2">
//                             <Input
//                                 label="L1/L2"
//                                 value={voltage.L1L2}
//                                 onChange={(e) => setVoltage({ ...voltage, L1L2: e.target.value })}
//                                 crossOrigin=""
//                                 className="tw-w-20"
//                             />
//                             <select
//                                 value={voltage.unit_L1L2 || "V"}
//                                 onChange={(e) => setVoltage({ ...voltage, unit_L1L2: e.target.value })}
//                                 className="tw-border tw-rounded-lg tw-px-2 tw-py-2 tw-bg-white tw-text-sm"
//                             >
//                                 <option value="V">V</option>
//                                 <option value="MΩ">MΩ</option>
//                                 <option value="kΩ">kΩ</option>
//                             </select>
//                         </div>

//                         <Input label="L1/L2 (V)" value={voltage.L1L2} onChange={(e) => setVoltage({ ...voltage, L1L2: e.target.value })} crossOrigin="" />

//                         <Input label="L1/L3 (V)" value={voltage.L1L3} onChange={(e) => setVoltage({ ...voltage, L1L3: e.target.value })} crossOrigin="" />
//                         <Input label="L2/L3 (V)" value={voltage.L2L3} onChange={(e) => setVoltage({ ...voltage, L2L3: e.target.value })} crossOrigin="" />
//                         <Input label="L1/N (V)" value={voltage.L1N} onChange={(e) => setVoltage({ ...voltage, L1N: e.target.value })} crossOrigin="" />
//                         <Input label="L2/N (V)" value={voltage.L2N} onChange={(e) => setVoltage({ ...voltage, L2N: e.target.value })} crossOrigin="" />
//                         <Input label="L3/N (V)" value={voltage.L3N} onChange={(e) => setVoltage({ ...voltage, L3N: e.target.value })} crossOrigin="" />
//                         <Input label="L1/G (V)" value={voltage.L1G} onChange={(e) => setVoltage({ ...voltage, L1G: e.target.value })} crossOrigin="" />
//                         <Input label="L2/G (V)" value={voltage.L2G} onChange={(e) => setVoltage({ ...voltage, L2G: e.target.value })} crossOrigin="" />
//                         <Input label="L3/G (V)" value={voltage.L3G} onChange={(e) => setVoltage({ ...voltage, L3G: e.target.value })} crossOrigin="" />
//                         <Input label="N/G (V)" value={voltage.NG} onChange={(e) => setVoltage({ ...voltage, NG: e.target.value })} crossOrigin="" />
//                     </div>
//                 </CardBody>
//             </Card>

//             {/* 6. Incoming cable Insulation */}
//             <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                 <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                     <Typography>
//                         6) Incoming cable Insulation Test / การทดสอบความเป็นฉนวนของสาย Incoming @500V (ต้อง ≥ 100 MΩ)
//                     </Typography>
//                 </CardHeader>
//                 <CardBody className="tw-space-y-4">
//                     <PassFailRow
//                         label="ผลการทดสอบ"
//                         value={rows.r6.pf}
//                         onChange={(v) => setRows({ ...rows, r6: { ...rows.r6, pf: v } })}
//                         remark={rows.r6.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r6: { ...rows.r6, remark: v } })}
//                     />
//                     <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
//                         <Input label="L1/G (MΩ)" value={insulIn.L1G} onChange={(e) => setInsulIn({ ...insulIn, L1G: e.target.value })} crossOrigin="" />
//                         <Input label="L2/G (MΩ)" value={insulIn.L2G} onChange={(e) => setInsulIn({ ...insulIn, L2G: e.target.value })} crossOrigin="" />
//                         <Input label="L3/G (MΩ)" value={insulIn.L3G} onChange={(e) => setInsulIn({ ...insulIn, L3G: e.target.value })} crossOrigin="" />
//                         <Input label="L1/N (MΩ)" value={insulIn.L1N} onChange={(e) => setInsulIn({ ...insulIn, L1N: e.target.value })} crossOrigin="" />
//                         <Input label="L2/N (MΩ)" value={insulIn.L2N} onChange={(e) => setInsulIn({ ...insulIn, L2N: e.target.value })} crossOrigin="" />
//                         <Input label="L3/N (MΩ)" value={insulIn.L3N} onChange={(e) => setInsulIn({ ...insulIn, L3N: e.target.value })} crossOrigin="" />
//                         <Input label="L1/L2 (MΩ)" value={insulIn.L1L2} onChange={(e) => setInsulIn({ ...insulIn, L1L2: e.target.value })} crossOrigin="" />
//                         <Input label="L1/L3 (MΩ)" value={insulIn.L1L3} onChange={(e) => setInsulIn({ ...insulIn, L1L3: e.target.value })} crossOrigin="" />
//                         <Input label="L2/L3 (MΩ)" value={insulIn.L2L3} onChange={(e) => setInsulIn({ ...insulIn, L2L3: e.target.value })} crossOrigin="" />
//                         <Input label="G/N (Ω)" value={insulIn.GN} onChange={(e) => setInsulIn({ ...insulIn, GN: e.target.value })} crossOrigin="" />
//                     </div>
//                 </CardBody>
//             </Card>

//             {/* 7. Charging cable insulation */}
//             <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                 <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                     <div>
//                         <Typography>
//                             7) Charging cable insulation Test / ทดสอบความเป็นฉนวนของสายชาร์จ @500V (ต้อง ≥ 100 MΩ)
//                         </Typography>
//                         <Typography
//                             variant="small"
//                             className="!tw-text-blue-gray-500 tw-italic tw-mt-1"
//                         >
//                             *อ้างอิงจากมาตรฐาน IEC 61851-2
//                         </Typography>
//                     </div>
//                 </CardHeader>

//                 <CardBody className="tw-space-y-4">
//                     <PassFailRow
//                         label="ผลการทดสอบ"
//                         value={rows.r7.pf}
//                         onChange={(v) => setRows({ ...rows, r7: { ...rows.r7, pf: v } })}
//                         remark={rows.r7.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r7: { ...rows.r7, remark: v } })}
//                     />
//                     <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-3">
//                         <Input label="Head 1: DC+/G (MΩ)" value={insulCharge.h1_DCpG} onChange={(e) => setInsulCharge({ ...insulCharge, h1_DCpG: e.target.value })} crossOrigin="" />
//                         <Input label="Head 1: DC-/G (MΩ)" value={insulCharge.h1_DCmG} onChange={(e) => setInsulCharge({ ...insulCharge, h1_DCmG: e.target.value })} crossOrigin="" />
//                         <Input label="Head 2: DC+/G (MΩ)" value={insulCharge.h2_DCpG} onChange={(e) => setInsulCharge({ ...insulCharge, h2_DCpG: e.target.value })} crossOrigin="" />
//                         <Input label="Head 2: DC-/G (MΩ)" value={insulCharge.h2_DCmG} onChange={(e) => setInsulCharge({ ...insulCharge, h2_DCmG: e.target.value })} crossOrigin="" />
//                     </div>
//                 </CardBody>
//             </Card>

//             {/* 8-10 simple */}
//             <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                 <CardBody className="tw-space-y-1">
//                     <PassFailRow
//                         label="8) Check torque and tightness / ตรวจค่าแรงบิดและขันแน่น"
//                         value={rows.r8.pf}
//                         onChange={(v) => setRows({ ...rows, r8: { ...rows.r8, pf: v } })}
//                         remark={rows.r8.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r8: { ...rows.r8, remark: v } })}
//                     />
//                     <PassFailRow
//                         label="9) Cleaning the air filter / ทำความสะอาดไส้กรองอากาศ"
//                         value={rows.r9.pf}
//                         onChange={(v) => setRows({ ...rows, r9: { ...rows.r9, pf: v } })}
//                         remark={rows.r9.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r9: { ...rows.r9, remark: v } })}
//                     />
//                     <PassFailRow
//                         label="10) Internal Cleaning / ทำความสะอาดภายใน"
//                         value={rows.r10.pf}
//                         onChange={(v) => setRows({ ...rows, r10: { ...rows.r10, pf: v } })}
//                         remark={rows.r10.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r10: { ...rows.r10, remark: v } })}
//                     />
//                 </CardBody>


//             </Card>

//             {/* 11. Incoming cable Insulation (หลัง PM) */}
//             <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                 <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                     <Typography>
//                         11) Incoming cable Insulation Test / การทดสอบความเป็นฉนวนของสาย Incoming @500V (ต้อง ≥ 100 MΩ) — หลัง PM
//                     </Typography>
//                     <Typography
//                         variant="small"
//                         className="!tw-text-blue-gray-500 tw-italic tw-mt-1"
//                     >
//                         *อ้างอิงจากมาตรฐาน IEC 60364
//                     </Typography>
//                 </CardHeader>
//                 <CardBody className="tw-space-y-4">
//                     <PassFailRow
//                         label="ผลการทดสอบ"
//                         value={rows.r11.pf}
//                         onChange={(v) => setRows({ ...rows, r11: { ...rows.r11, pf: v } })}
//                         remark={rows.r11.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r11: { ...rows.r11, remark: v } })}
//                     />
//                     <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
//                         <Input label="L1/G (MΩ)" value={insulInPost.L1G} onChange={(e) => setInsulInPost({ ...insulInPost, L1G: e.target.value })} crossOrigin="" />
//                         <Input label="L2/G (MΩ)" value={insulInPost.L2G} onChange={(e) => setInsulInPost({ ...insulInPost, L2G: e.target.value })} crossOrigin="" />
//                         <Input label="L3/G (MΩ)" value={insulInPost.L3G} onChange={(e) => setInsulInPost({ ...insulInPost, L3G: e.target.value })} crossOrigin="" />
//                         <Input label="L1/N (MΩ)" value={insulInPost.L1N} onChange={(e) => setInsulInPost({ ...insulInPost, L1N: e.target.value })} crossOrigin="" />
//                         <Input label="L2/N (MΩ)" value={insulInPost.L2N} onChange={(e) => setInsulInPost({ ...insulInPost, L2N: e.target.value })} crossOrigin="" />
//                         <Input label="L3/N (MΩ)" value={insulInPost.L3N} onChange={(e) => setInsulInPost({ ...insulInPost, L3N: e.target.value })} crossOrigin="" />
//                         <Input label="L1/L2 (MΩ)" value={insulInPost.L1L2} onChange={(e) => setInsulInPost({ ...insulInPost, L1L2: e.target.value })} crossOrigin="" />
//                         <Input label="L1/L3 (MΩ)" value={insulInPost.L1L3} onChange={(e) => setInsulInPost({ ...insulInPost, L1L3: e.target.value })} crossOrigin="" />
//                         <Input label="L2/L3 (MΩ)" value={insulInPost.L2L3} onChange={(e) => setInsulInPost({ ...insulInPost, L2L3: e.target.value })} crossOrigin="" />
//                         <Input label="G/N (Ω)" value={insulInPost.GN} onChange={(e) => setInsulInPost({ ...insulInPost, GN: e.target.value })} crossOrigin="" />
//                     </div>
//                 </CardBody>
//             </Card>

//             {/* 12. Incoming Voltage (หลัง PM) */}
//             <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                 <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                     <Typography>12) Incoming voltage check / ตรวจสอบแรงดันขาเข้า (หลัง PM)</Typography>
//                 </CardHeader>
//                 <CardBody className="tw-space-y-4">
//                     <PassFailRow
//                         label="ผลการตรวจ"
//                         value={rows.r12.pf}
//                         onChange={(v) => setRows({ ...rows, r12: { ...rows.r12, pf: v } })}
//                         remark={rows.r12.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r12: { ...rows.r12, remark: v } })}
//                     />
//                     <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
//                         <Input label="L1/L2 (V)" value={voltagePost.L1L2} onChange={(e) => setVoltagePost({ ...voltagePost, L1L2: e.target.value })} crossOrigin="" />
//                         <Input label="L1/L3 (V)" value={voltagePost.L1L3} onChange={(e) => setVoltagePost({ ...voltagePost, L1L3: e.target.value })} crossOrigin="" />
//                         <Input label="L2/L3 (V)" value={voltagePost.L2L3} onChange={(e) => setVoltagePost({ ...voltagePost, L2L3: e.target.value })} crossOrigin="" />
//                         <Input label="L1/N (V)" value={voltagePost.L1N} onChange={(e) => setVoltagePost({ ...voltagePost, L1N: e.target.value })} crossOrigin="" />
//                         <Input label="L2/N (V)" value={voltagePost.L2N} onChange={(e) => setVoltagePost({ ...voltagePost, L2N: e.target.value })} crossOrigin="" />
//                         <Input label="L3/N (V)" value={voltagePost.L3N} onChange={(e) => setVoltagePost({ ...voltagePost, L3N: e.target.value })} crossOrigin="" />
//                         <Input label="L1/G (V)" value={voltagePost.L1G} onChange={(e) => setVoltagePost({ ...voltagePost, L1G: e.target.value })} crossOrigin="" />
//                         <Input label="L2/G (V)" value={voltagePost.L2G} onChange={(e) => setVoltagePost({ ...voltagePost, L2G: e.target.value })} crossOrigin="" />
//                         <Input label="L3/G (V)" value={voltagePost.L3G} onChange={(e) => setVoltagePost({ ...voltagePost, L3G: e.target.value })} crossOrigin="" />
//                         <Input label="N/G (V)" value={voltagePost.NG} onChange={(e) => setVoltagePost({ ...voltagePost, NG: e.target.value })} crossOrigin="" />
//                     </div>
//                 </CardBody>
//             </Card>

//             {/* 13–15 (หลัง PM) */}
//             <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                 <CardBody className="tw-space-y-1">
//                     <PassFailRow
//                         label="13) Test Charge / ทดสอบชาร์จทั้ง 2 หัว (หลัง PM)"
//                         value={rows.r13.pf}
//                         onChange={(v) => setRows({ ...rows, r13: { ...rows.r13, pf: v } })}
//                         remark={rows.r13.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r13: { ...rows.r13, remark: v } })}
//                     />
//                     <PassFailRow
//                         label="14) Thermal scan / ภาพถ่ายความร้อน (หลัง PM)"
//                         value={rows.r14.pf}
//                         onChange={(v) => setRows({ ...rows, r14: { ...rows.r14, pf: v } })}
//                         remark={rows.r14.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r14: { ...rows.r14, remark: v } })}
//                     />
//                     <PassFailRow
//                         label="15) ทำความสะอาดหน้าสัมผัส SIM Internet"
//                         value={rows.r15.pf}
//                         onChange={(v) => setRows({ ...rows, r15: { ...rows.r15, pf: v } })}
//                         remark={rows.r15.remark}
//                         onRemarkChange={(v) => setRows({ ...rows, r15: { ...rows.r15, remark: v } })}
//                     />
//                 </CardBody>
//             </Card>


//             {/* Bottom sticky save bar for mobile */}
//             <div className="tw-fixed tw-bottom-0 tw-left-0 tw-right-0 tw-z-30 tw-bg-white tw-border-t tw-border-blue-gray-100 tw-p-3 md:tw-hidden">
//                 <Button color="green" className="tw-w-full tw-gap-2" onClick={onSave}>
//                     <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
//                     บันทึก PM Report
//                 </Button>
//             </div>

//             <CardFooter className="tw-hidden md:tw-flex tw-justify-end tw-gap-3 tw-pt-6">
//                 <Link href="/pm">
//                     <Button variant="outlined">ยกเลิก</Button>
//                 </Link>
//                 <Button color="green" className="tw-gap-2" onClick={onSave}>
//                     <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
//                     บันทึก
//                 </Button>
//             </CardFooter>
//         </section>
//     );
// }



"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardFooter,
    Input,
    Typography,
} from "@material-tailwind/react";
import { ArrowLeftIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";

/** --- ค่าคงที่ & ยูทิล --- */
const UNITS = {
    voltage: ["V", "MΩ", "kΩ"] as const,          // เผื่อกรณีอยากเปลี่ยนหน่วยแรงดันเป็นอย่างอื่น
    insulation: ["MΩ", "kΩ"] as const,            // ฉนวนเป็นโอห์ม/เมกะโอห์ม
};

type UnitVoltage = (typeof UNITS.voltage)[number];
type UnitInsul = (typeof UNITS.insulation)[number];

type MeasureState<U extends string> = Record<string, { value: string; unit: U }>;

/** สร้าง state เริ่มต้นของชุดฟิลด์ */
function initMeasureState<U extends string>(
    keys: string[],
    defaultUnit: U
): MeasureState<U> {
    return Object.fromEntries(keys.map((k) => [k, { value: "", unit: defaultUnit }])) as MeasureState<U>;
}

/** รายการฟิลด์แต่ละกลุ่ม */
const VOLTAGE_FIELDS = ["L1L2", "L1L3", "L2L3", "L1N", "L2N", "L3N", "L1G", "L2G", "L3G", "NG"];
const INSUL_FIELDS = ["L1G", "L2G", "L3G", "L1N", "L2N", "L3N", "L1L2", "L1L3", "L2L3", "GN"];
const CHARGE_FIELDS = ["h1_DCpG", "h1_DCmG", "h2_DCpG", "h2_DCmG"];

/** แปลง key เป็น label ที่อ่านง่าย */
const labelDict: Record<string, string> = {
    L1L2: "L1/L2",
    L1L3: "L1/L3",
    L2L3: "L2/L3",
    L1N: "L1/N",
    L2N: "L2/N",
    L3N: "L3/N",
    L1G: "L1/G",
    L2G: "L2/G",
    L3G: "L3/G",
    NG: "N/G",
    GN: "G/N",
    h1_DCpG: "Head 1: DC+/G",
    h1_DCmG: "Head 1: DC-/G",
    h2_DCpG: "Head 2: DC+/G",
    h2_DCmG: "Head 2: DC-/G",
};

/** อินพุตตัวเลข + dropdown หน่วย (ใช้ซ้ำได้) */
function InputWithUnit<U extends string>({
    label,
    value,
    unit,
    units,
    onValueChange,
    onUnitChange,
}: {
    label: string;
    value: string;
    unit: U;
    units: readonly U[];
    onValueChange: (v: string) => void;
    onUnitChange: (u: U) => void;
}) {
    return (
        <div className="tw-flex tw-items-center tw-gap-2 tw-min-w-0">
            {/* ช่องกรอก 'สั้น' ตามรูป */}
            <Input
                label={`${label}`}
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                crossOrigin=""
                containerProps={{
                    className: "tw-w-[120px] !tw-min-w-0",
                }}
                className="!tw-w-full"
            />

            {/* หน่วย (V / MΩ / kΩ) */}
            <select
                value={unit}
                onChange={(e) => onUnitChange(e.target.value as U)}
                className="tw-h-10 tw-w-[60px] tw-shrink-0 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500/30 focus:tw-border-blue-500"
            >
                {units.map((u) => (
                    <option key={u} value={u}>
                        {u}
                    </option>
                ))}
            </select>
        </div>
    );
}

/** Toggle Pass/Fail + Remark (ใช้ซ้ำได้) */
function PassFailRow({
    label,
    value,
    onChange,
    remark,
    onRemarkChange,
}: {
    label: string;
    value: "PASS" | "FAIL" | "";
    onChange: (v: "PASS" | "FAIL") => void;
    remark?: string;
    onRemarkChange?: (v: string) => void;
}) {
    return (
        <div className="tw-space-y-2 tw-py-3 tw-border-b tw-border-blue-gray-50">
            <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
                <Typography className="tw-font-medium">{label}</Typography>

                <div className="tw-flex tw-gap-2">
                    {/* PASS: เขียวเมื่อเลือก */}
                    <Button
                        size="sm"
                        color="green"
                        variant={value === "PASS" ? "filled" : "outlined"}
                        className="tw-min-w-[84px]"
                        onClick={() => onChange("PASS")}
                        aria-pressed={value === "PASS"}
                    >
                        PASS
                    </Button>

                    {/* FAIL: แดงเมื่อเลือก (เหมือนเดิม) */}
                    <Button
                        size="sm"
                        color="red"
                        variant={value === "FAIL" ? "filled" : "outlined"}
                        className="tw-min-w-[84px]"
                        onClick={() => onChange("FAIL")}
                        aria-pressed={value === "FAIL"}
                    >
                        FAIL
                    </Button>
                </div>
            </div>

            {onRemarkChange && (
                <Input
                    label="หมายเหตุ (ถ้ามี)"
                    value={remark || ""}
                    onChange={(e) => onRemarkChange(e.target.value)}
                    crossOrigin=""
                />
            )}
        </div>
    );
}


export default function PMReportForm() {
    const router = useRouter();

    // --- Job Info ---
    const [job, setJob] = useState({
        workOrder: "",
        sn: "",
        model: "",
        location: "",
        date: "",
        inspector: "",
    });

    // --- Checklist states ---
    const [rows, setRows] = useState<
        Record<string, { pf: "PASS" | "FAIL" | ""; remark: string }>
    >({
        r1: { pf: "", remark: "" },
        r2: { pf: "", remark: "" },
        r3: { pf: "", remark: "" },
        r4: { pf: "", remark: "" },
        r5: { pf: "", remark: "" },
        r6: { pf: "", remark: "" },
        r7: { pf: "", remark: "" },
        r8: { pf: "", remark: "" },
        r9: { pf: "", remark: "" },
        r10: { pf: "", remark: "" },
        r11: { pf: "", remark: "" },
        r12: { pf: "", remark: "" },
        r13: { pf: "", remark: "" },
        r14: { pf: "", remark: "" },
        r15: { pf: "", remark: "" },
    });

    // --- Measurements (รีดีไซน์ให้ทุกช่องมี {value, unit}) ---
    const [voltage, setVoltage] = useState<MeasureState<UnitVoltage>>(
        initMeasureState(VOLTAGE_FIELDS, "V")
    ); // 5) ก่อน PM

    const [insulIn, setInsulIn] = useState<MeasureState<UnitVoltage>>(
        initMeasureState(INSUL_FIELDS, "MΩ")
    ); // 6) ฉนวน incoming (ก่อน PM)

    const [insulCharge, setInsulCharge] = useState<MeasureState<UnitVoltage>>(
        initMeasureState(CHARGE_FIELDS, "MΩ")
    ); // 7) ฉนวนสายชาร์จ

    const [insulInPost, setInsulInPost] = useState<MeasureState<UnitVoltage>>(
        initMeasureState(INSUL_FIELDS, "MΩ")
    ); // 11) ฉนวน incoming (หลัง PM)

    const [voltagePost, setVoltagePost] = useState<MeasureState<UnitVoltage>>(
        initMeasureState(VOLTAGE_FIELDS, "V")
    ); // 12) หลัง PM

    /** อัปเดต state แบบย่อย */
    const patchMeasure =
        <U extends string>(
            setter: React.Dispatch<React.SetStateAction<MeasureState<U>>>
        ) =>
            (key: string, patch: Partial<{ value: string; unit: U }>) => {
                setter((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
            };

    const patchVoltage = patchMeasure(setVoltage);
    const patchVoltagePost = patchMeasure(setVoltagePost);
    const patchInsulIn = patchMeasure(setInsulIn);
    const patchInsulInPost = patchMeasure(setInsulInPost);
    const patchInsulCharge = patchMeasure(setInsulCharge);

    const onSave = () => {
        // ตัวอย่าง payload ที่เก็บทั้งค่าและหน่วยในแต่ละช่อง
        console.log({
            job,
            rows,
            voltage,        // { L1L2: {value, unit}, ... }
            insulIn,        // ...
            insulCharge,    // ...
            insulInPost,    // ...
            voltagePost,    // ...
        });
        alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
    };

    return (
        <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
            {/* Top bar actions */}
            <div className="tw-sticky tw-top-0 tw-z-20 tw-bg-transparent tw-pt-3 tw-pb-2">
                <div
                    className="
                        tw-flex tw-items-center tw-justify-between
                        tw-bg-white tw-border tw-border-blue-gray-100
                        tw-rounded-2xl tw-shadow-sm
                        tw-px-4 tw-py-3
                    "
                >
                    <Button
                        variant="text"
                        onClick={() => router.back()}
                        className="tw-bg-white tw-border tw-border-blue-gray-200 tw-rounded-xl tw-shadow-none tw-h-9 tw-px-4 tw-min-w-0 tw-flex tw-items-center tw-justify-center hover:tw-bg-blue-gray-50"
                    >
                        <ArrowLeftIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-800" />
                    </Button>

                    <Typography variant="h5">PM Report</Typography>

                    <Button color="green" className="tw-gap-2" onClick={onSave}>
                        <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
                        Save
                    </Button>
                </div>
            </div>

            {/* Company Info */}
            <Card className="tw-mt-3 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardBody className="tw-space-y-1">
                    <Typography className="tw-font-semibold">
                        บริษัท อีแกท ไดมอนด์ เซอร์วิส จำกัด (สำนักงานใหญ่) — Tax ID: 0125552017292
                    </Typography>
                    <Typography className="!tw-text-blue-gray-600">
                        56/25 หมู่ 20 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี 12120
                    </Typography>
                </CardBody>
            </Card>

            {/* Job Info */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography variant="h6">ข้อมูลงาน</Typography>
                    <Typography variant="small" className="!tw-text-blue-gray-500">
                        กรอกให้ง่ายบนมือถือ — ช่องกว้าง แตะง่าย
                    </Typography>
                </CardHeader>
                <CardBody className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                    <Input
                        label="Work Order"
                        value={job.workOrder}
                        onChange={(e) => setJob({ ...job, workOrder: e.target.value })}
                        crossOrigin=""
                        readOnly
                        className="!tw-bg-blue-gray-50"
                    />
                    <Input
                        label="SN / หมายเลขเครื่อง"
                        value={job.sn}
                        onChange={(e) => setJob({ ...job, sn: e.target.value })}
                        crossOrigin=""
                        className="!tw-bg-blue-gray-50"
                    />
                    <Input
                        label="Model / รุ่น"
                        value={job.model}
                        onChange={(e) => setJob({ ...job, model: e.target.value })}
                        crossOrigin=""
                        className="!tw-bg-blue-gray-50"
                    />
                    <Input
                        label="Location / สถานที่"
                        value={job.location}
                        onChange={(e) => setJob({ ...job, location: e.target.value })}
                        crossOrigin=""
                        className="!tw-bg-blue-gray-50"
                    />
                    <Input
                        label="วันที่ตรวจ"
                        type="date"
                        value={job.date}
                        onChange={(e) => setJob({ ...job, date: e.target.value })}
                        crossOrigin=""
                    />
                </CardBody>
            </Card>

            {/* Checklist simple items */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography variant="h6">Checklist</Typography>
                </CardHeader>
                <CardBody className="tw-space-y-1">
                    <PassFailRow
                        label="1) Visual Check / ตรวจสอบด้วยสายตา"
                        value={rows.r1.pf}
                        onChange={(v) => setRows({ ...rows, r1: { ...rows.r1, pf: v } })}
                        remark={rows.r1.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r1: { ...rows.r1, remark: v } })}
                    />
                    <PassFailRow
                        label="2) Test Charge / ทดสอบชาร์จทั้ง2หัว (ก่อน PM)"
                        value={rows.r2.pf}
                        onChange={(v) => setRows({ ...rows, r2: { ...rows.r2, pf: v } })}
                        remark={rows.r2.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r2: { ...rows.r2, remark: v } })}
                    />
                    <PassFailRow
                        label="3) Thermal scan / ภาพถ่ายความร้อน (ก่อน PM)"
                        value={rows.r3.pf}
                        onChange={(v) => setRows({ ...rows, r3: { ...rows.r3, pf: v } })}
                        remark={rows.r3.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r3: { ...rows.r3, remark: v } })}
                    />
                    <PassFailRow
                        label="4) Test trip / ทดสอบการทำงานของอุปกรณ์ป้องกันระบบไฟฟ้า"
                        value={rows.r4.pf}
                        onChange={(v) => setRows({ ...rows, r4: { ...rows.r4, pf: v } })}
                        remark={rows.r4.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r4: { ...rows.r4, remark: v } })}
                    />
                </CardBody>
            </Card>

            {/* 5. Incoming Voltage (ก่อน PM) */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography>5) Incoming voltage check / ตรวจสอบแรงดันขาเข้า (ก่อน PM)</Typography>
                </CardHeader>
                <CardBody className="tw-space-y-4">
                    <PassFailRow
                        label="ผลการตรวจ"
                        value={rows.r5.pf}
                        onChange={(v) => setRows({ ...rows, r5: { ...rows.r5, pf: v } })}
                        remark={rows.r5.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r5: { ...rows.r5, remark: v } })}
                    />
                    <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                        {VOLTAGE_FIELDS.map((k) => (
                            <InputWithUnit
                                key={`pre-${k}`}
                                label={labelDict[k]}
                                value={voltage[k].value}
                                unit={voltage[k].unit}
                                units={UNITS.voltage}
                                onValueChange={(v) => patchVoltage(k, { value: v })}
                                onUnitChange={(u) => patchVoltage(k, { unit: u })}
                            />
                        ))}
                    </div>
                </CardBody>
            </Card>

            {/* 6. Incoming cable Insulation (ก่อน PM) */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography>
                        6) Incoming cable Insulation Test / การทดสอบความเป็นฉนวนของสาย Incoming @500V (ต้อง ≥ 100 MΩ)
                    </Typography>
                </CardHeader>
                <CardBody className="tw-space-y-4">
                    <PassFailRow
                        label="ผลการทดสอบ"
                        value={rows.r6.pf}
                        onChange={(v) => setRows({ ...rows, r6: { ...rows.r6, pf: v } })}
                        remark={rows.r6.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r6: { ...rows.r6, remark: v } })}
                    />
                    <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                        {INSUL_FIELDS.map((k) => (
                            <InputWithUnit
                                key={`ins-pre-${k}`}
                                label={labelDict[k]}
                                value={insulIn[k].value}
                                unit={insulIn[k].unit}
                                units={UNITS.voltage}
                                onValueChange={(v) => patchInsulIn(k, { value: v })}
                                onUnitChange={(u) => patchInsulIn(k, { unit: u })}
                            />
                        ))}
                    </div>
                </CardBody>
            </Card>

            {/* 7. Charging cable insulation */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <div>
                        <Typography>
                            7) Charging cable insulation Test / ทดสอบความเป็นฉนวนของสายชาร์จ @500V (ต้อง ≥ 100 MΩ)
                        </Typography>
                        <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">
                            *อ้างอิงจากมาตรฐาน IEC 61851-2
                        </Typography>
                    </div>
                </CardHeader>

                <CardBody className="tw-space-y-4">
                    <PassFailRow
                        label="ผลการทดสอบ"
                        value={rows.r7.pf}
                        onChange={(v) => setRows({ ...rows, r7: { ...rows.r7, pf: v } })}
                        remark={rows.r7.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r7: { ...rows.r7, remark: v } })}
                    />
                    <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-3">
                        {CHARGE_FIELDS.map((k) => (
                            <InputWithUnit
                                key={`charge-${k}`}
                                label={labelDict[k]}
                                value={insulCharge[k].value}
                                unit={insulCharge[k].unit}
                                units={UNITS.voltage}
                                onValueChange={(v) => patchInsulCharge(k, { value: v })}
                                onUnitChange={(u) => patchInsulCharge(k, { unit: u })}
                            />
                        ))}
                    </div>
                </CardBody>
            </Card>

            {/* 8-10 simple */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardBody className="tw-space-y-1">
                    <PassFailRow
                        label="8) Check torque and tightness / ตรวจค่าแรงบิดและขันแน่น"
                        value={rows.r8.pf}
                        onChange={(v) => setRows({ ...rows, r8: { ...rows.r8, pf: v } })}
                        remark={rows.r8.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r8: { ...rows.r8, remark: v } })}
                    />
                    <PassFailRow
                        label="9) Cleaning the air filter / ทำความสะอาดไส้กรองอากาศ"
                        value={rows.r9.pf}
                        onChange={(v) => setRows({ ...rows, r9: { ...rows.r9, pf: v } })}
                        remark={rows.r9.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r9: { ...rows.r9, remark: v } })}
                    />
                    <PassFailRow
                        label="10) Internal Cleaning / ทำความสะอาดภายใน"
                        value={rows.r10.pf}
                        onChange={(v) => setRows({ ...rows, r10: { ...rows.r10, pf: v } })}
                        remark={rows.r10.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r10: { ...rows.r10, remark: v } })}
                    />
                </CardBody>
            </Card>

            {/* 11. Incoming cable Insulation (หลัง PM) */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography>
                        11) Incoming cable Insulation Test / การทดสอบความเป็นฉนวนของสาย Incoming @500V (ต้อง ≥ 100 MΩ) — หลัง PM
                    </Typography>
                    <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">
                        *อ้างอิงจากมาตรฐาน IEC 60364
                    </Typography>
                </CardHeader>
                <CardBody className="tw-space-y-4">
                    <PassFailRow
                        label="ผลการทดสอบ"
                        value={rows.r11.pf}
                        onChange={(v) => setRows({ ...rows, r11: { ...rows.r11, pf: v } })}
                        remark={rows.r11.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r11: { ...rows.r11, remark: v } })}
                    />
                    <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                        {INSUL_FIELDS.map((k) => (
                            <InputWithUnit
                                key={`ins-post-${k}`}
                                label={labelDict[k]}
                                value={insulInPost[k].value}
                                unit={insulInPost[k].unit}
                                units={UNITS.voltage}
                                onValueChange={(v) => patchInsulInPost(k, { value: v })}
                                onUnitChange={(u) => patchInsulInPost(k, { unit: u })}
                            />
                        ))}
                    </div>
                </CardBody>
            </Card>

            {/* 12. Incoming Voltage (หลัง PM) */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                    <Typography>12) Incoming voltage check / ตรวจสอบแรงดันขาเข้า (หลัง PM)</Typography>
                </CardHeader>
                <CardBody className="tw-space-y-4">
                    <PassFailRow
                        label="ผลการตรวจ"
                        value={rows.r12.pf}
                        onChange={(v) => setRows({ ...rows, r12: { ...rows.r12, pf: v } })}
                        remark={rows.r12.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r12: { ...rows.r12, remark: v } })}
                    />
                    <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                        {VOLTAGE_FIELDS.map((k) => (
                            <InputWithUnit
                                key={`post-${k}`}
                                label={labelDict[k]}
                                value={voltagePost[k].value}
                                unit={voltagePost[k].unit}
                                units={UNITS.voltage}
                                onValueChange={(v) => patchVoltagePost(k, { value: v })}
                                onUnitChange={(u) => patchVoltagePost(k, { unit: u })}
                            />
                        ))}
                    </div>
                </CardBody>
            </Card>

            {/* 13–15 (หลัง PM) */}
            <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                <CardBody className="tw-space-y-1">
                    <PassFailRow
                        label="13) Test Charge / ทดสอบชาร์จทั้ง 2 หัว (หลัง PM)"
                        value={rows.r13.pf}
                        onChange={(v) => setRows({ ...rows, r13: { ...rows.r13, pf: v } })}
                        remark={rows.r13.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r13: { ...rows.r13, remark: v } })}
                    />
                    <PassFailRow
                        label="14) Thermal scan / ภาพถ่ายความร้อน (หลัง PM)"
                        value={rows.r14.pf}
                        onChange={(v) => setRows({ ...rows, r14: { ...rows.r14, pf: v } })}
                        remark={rows.r14.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r14: { ...rows.r14, remark: v } })}
                    />
                    <PassFailRow
                        label="15) ทำความสะอาดหน้าสัมผัส SIM Internet"
                        value={rows.r15.pf}
                        onChange={(v) => setRows({ ...rows, r15: { ...rows.r15, pf: v } })}
                        remark={rows.r15.remark}
                        onRemarkChange={(v) => setRows({ ...rows, r15: { ...rows.r15, remark: v } })}
                    />
                </CardBody>
            </Card>

            {/* Bottom sticky save bar for mobile */}
            <div className="tw-fixed tw-bottom-0 tw-left-0 tw-right-0 tw-z-30 tw-bg-white tw-border-t tw-border-blue-gray-100 tw-p-3 md:tw-hidden">
                <Button color="green" className="tw-w-full tw-gap-2" onClick={onSave}>
                    <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
                    บันทึก PM Report
                </Button>
            </div>

            <CardFooter className="tw-hidden md:tw-flex tw-justify-end tw-gap-3 tw-pt-6">
                <Link href="/pm">
                    <Button variant="outlined">ยกเลิก</Button>
                </Link>
                <Button color="green" className="tw-gap-2" onClick={onSave}>
                    <DocumentArrowDownIcon className="tw-h-5 tw-w-5" />
                    บันทึก
                </Button>
            </CardFooter>
        </section>
    );
}
