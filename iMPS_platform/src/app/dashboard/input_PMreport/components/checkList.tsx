// "use client";

// import React, { useState, useMemo } from "react";
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
// } from "@material-tailwind/react";
// import { ArrowLeftIcon } from "@heroicons/react/24/outline";

// // component
// import CheckList from "@/app/dashboard/input_PMreport/components/checkList";
// import PMReportPhotos from "@/app/dashboard/input_PMreport/components/photoPM";

// /** --- ค่าคงที่ & ยูทิล --- */
// const UNITS = {
//     voltage: ["V", "MΩ", "kΩ"] as const,
// };
// type UnitVoltage = (typeof UNITS.voltage)[number];
// type MeasureState<U extends string> = Record<string, { value: string; unit: U }>;

// function initMeasureState<U extends string>(
//     keys: string[],
//     defaultUnit: U
// ): MeasureState<U> {
//     return Object.fromEntries(keys.map((k) => [k, { value: "", unit: defaultUnit }])) as MeasureState<U>;
// }

// // รวมคอมโพเนนต์ไว้ใน array
// const pages = [
//     // <CheckList key="checklist" onComplete={(status) => setIsCheckListComplete(status)} />,
//     <CheckList />,
//     <PMReportPhotos key="photos" />,
// ];

// const VOLTAGE_FIELDS = ["L1L2", "L1L3", "L2L3", "L1N", "L2N", "L3N", "L1G", "L2G", "L3G", "NG"];
// const INSUL_FIELDS = ["L1G", "L2G", "L3G", "L1N", "L2N", "L3N", "L1L2", "L1L3", "L2L3", "GN"];
// const CHARGE_FIELDS = ["h1_DCpG", "h1_DCmG", "h2_DCpG", "h2_DCmG"];

// const labelDict: Record<string, string> = {
//     L1L2: "L1/L2",
//     L1L3: "L1/L3",
//     L2L3: "L2/L3",
//     L1N: "L1/N",
//     L2N: "L2/N",
//     L3N: "L3/N",
//     L1G: "L1/G",
//     L2G: "L2/G",
//     L3G: "L3/G",
//     NG: "N/G",
//     GN: "G/N",
//     h1_DCpG: "Head 1: DC+/G",
//     h1_DCmG: "Head 1: DC-/G",
//     h2_DCpG: "Head 2: DC+/G",
//     h2_DCmG: "Head 2: DC-/G",
// };

// /** อินพุตตัวเลข + หน่วย: อยู่บรรทัดเดียว แบ่ง 2 คอลัมน์ (มือถือก็เช่นกัน) */
// function InputWithUnit<U extends string>({
//     label,
//     value,
//     unit,
//     units,
//     onValueChange,
//     onUnitChange,
// }: {
//     label: string;
//     value: string;
//     unit: U;
//     units: readonly U[];
//     onValueChange: (v: string) => void;
//     onUnitChange: (u: U) => void;
// }) {
//     return (
//         <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-items-end sm:tw-items-center">
//             {/* คอลัมน์ซ้าย: ช่องกรอกค่า */}
//             <Input
//                 type="number"
//                 inputMode="decimal"
//                 step="any"
//                 label={`${label}`}
//                 value={value}
//                 onChange={(e) => onValueChange(e.target.value)}
//                 onWheel={(e) => (e.target as HTMLInputElement).blur()}
//                 crossOrigin=""
//                 containerProps={{ className: "tw-col-span-1 !tw-min-w-0" }}
//                 className="!tw-w-full"
//                 required
//             />

//             {/* คอลัมน์ขวา: หน่วย */}
//             <select
//                 required
//                 value={unit}
//                 onChange={(e) => onUnitChange(e.target.value as U)}
//                 className="
//                     tw-col-span-1 tw-h-10 tw-rounded-lg tw-border tw-border-blue-gray-200
//                     tw-bg-white tw-px-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2
//                     focus:tw-ring-blue-500/30 focus:tw-border-blue-500">
//                 {units.map((u) => (
//                     <option key={u} value={u}>
//                         {u}
//                     </option>
//                 ))}
//             </select>
//         </div>
//     );
// }


// /** Toggle Pass/Fail + Remark */
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
//         <div className="tw-space-y-3 tw-py-3 tw-border-b tw-border-blue-gray-50">
//             <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">
//                 <Typography className="tw-font-medium">{label}</Typography>

//                 <div className="tw-flex tw-gap-2 tw-w-full sm:tw-w-auto">
//                     <Button
//                         size="sm"
//                         color="green"
//                         variant={value === "PASS" ? "filled" : "outlined"}
//                         className="tw-w-1/2 sm:tw-w-auto sm:tw-min-w-[84px]"
//                         onClick={() => onChange("PASS")}
//                         aria-pressed={value === "PASS"}
//                     >
//                         PASS
//                     </Button>
//                     <Button
//                         size="sm"
//                         color="red"
//                         variant={value === "FAIL" ? "filled" : "outlined"}
//                         className="tw-w-1/2 sm:tw-w-auto sm:tw-min-w-[84px]"
//                         onClick={() => onChange("FAIL")}
//                         aria-pressed={value === "FAIL"}
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

// export default function checkList() {
//     const router = useRouter();
//     const [page, setPage] = useState(0); // 0 = CheckList, 1 = PMReportPhotos

//     // const goPrev = () => setPage((p) => Math.max(0, p - 1));
//     // const goNext = () => setPage((p) => Math.min(pages.length - 1, p + 1));

//     // const isFirst = page === 0;
//     // const isLast = page === pages.length - 1;


//     const [job, setJob] = useState({
//         workOrder: "",
//         sn: "",
//         model: "",
//         location: "",
//         date: "",
//         inspector: "",
//     });

//     const [rows, setRows] = useState<
//         Record<string, { pf: "PASS" | "FAIL" | ""; remark: string }>
//     >({
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

//     const [voltage, setVoltage] = useState<MeasureState<UnitVoltage>>(
//         initMeasureState(VOLTAGE_FIELDS, "V")
//     );
//     const [insulIn, setInsulIn] = useState<MeasureState<UnitVoltage>>(
//         initMeasureState(INSUL_FIELDS, "V")
//     );
//     const [insulCharge, setInsulCharge] = useState<MeasureState<UnitVoltage>>(
//         initMeasureState(CHARGE_FIELDS, "V")
//     );
//     const [insulInPost, setInsulInPost] = useState<MeasureState<UnitVoltage>>(
//         initMeasureState(INSUL_FIELDS, "V")
//     );
//     const [voltagePost, setVoltagePost] = useState<MeasureState<UnitVoltage>>(
//         initMeasureState(VOLTAGE_FIELDS, "V")
//     );
//     const allAnswered = useMemo(
//         () => Object.values(rows).every((r) => r.pf === "PASS" || r.pf === "FAIL"),
//         [rows]
//     );
//     const remaining = useMemo(
//         () => Object.values(rows).filter((r) => !r.pf).length,
//         [rows]
//     );




//     const patchMeasure =
//         <U extends string>(
//             setter: React.Dispatch<React.SetStateAction<MeasureState<U>>>
//         ) =>
//             (key: string, patch: Partial<{ value: string; unit: U }>) => {
//                 setter((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
//             };

//     const patchVoltage = patchMeasure(setVoltage);
//     const patchVoltagePost = patchMeasure(setVoltagePost);
//     const patchInsulIn = patchMeasure(setInsulIn);
//     const patchInsulInPost = patchMeasure(setInsulInPost);
//     const patchInsulCharge = patchMeasure(setInsulCharge);

//     function syncAllUnits<U extends string>(
//         setter: React.Dispatch<React.SetStateAction<MeasureState<U>>>,
//         keys: string[],
//         newUnit: U
//     ) {
//         setter((prev) => {
//             const next: MeasureState<U> = { ...prev };
//             keys.forEach((k) => {
//                 next[k] = { ...prev[k], unit: newUnit };
//             });
//             return next;
//         });
//     }

//     const handleVoltageUnitChange = (key: string, u: UnitVoltage) => {
//         const firstKey = VOLTAGE_FIELDS[0];
//         if (key !== firstKey) patchVoltage(firstKey, { unit: u });
//         syncAllUnits(setVoltage, VOLTAGE_FIELDS, u);
//     };
//     const handleVoltagePostUnitChange = (key: string, u: UnitVoltage) => {
//         const firstKey = VOLTAGE_FIELDS[0];
//         if (key !== firstKey) patchVoltagePost(firstKey, { unit: u });
//         syncAllUnits(setVoltagePost, VOLTAGE_FIELDS, u);
//     };
//     const handleInsulInUnitChange = (key: string, u: UnitVoltage) => {
//         const firstKey = INSUL_FIELDS[0];
//         if (key !== firstKey) patchInsulIn(firstKey, { unit: u });
//         syncAllUnits(setInsulIn, INSUL_FIELDS, u);
//     };
//     const handleInsulInPostUnitChange = (key: string, u: UnitVoltage) => {
//         const firstKey = INSUL_FIELDS[0];
//         if (key !== firstKey) patchInsulInPost(firstKey, { unit: u });
//         syncAllUnits(setInsulInPost, INSUL_FIELDS, u);
//     };
//     const handleInsulChargeUnitChange = (key: string, u: UnitVoltage) => {
//         const firstKey = CHARGE_FIELDS[0];
//         if (key !== firstKey) patchInsulCharge(firstKey, { unit: u });
//         syncAllUnits(setInsulCharge, CHARGE_FIELDS, u);
//     };

//     const onSave = () => {
//         console.log({
//             job,
//             rows,
//             voltage,
//             insulIn,
//             insulCharge,
//             insulInPost,
//             voltagePost,
//         });
//         alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
//     };

//     // ⬇️ 3) ฟังก์ชันตรวจสอบก่อนไปหน้าถัดไป
//     const handleNext = (e: React.FormEvent) => {
//         e.preventDefault();

//         // (ทางเลือก) ตรวจข้อมูลงานด้วย หากต้องบังคับกรอก:
//         // if (!job.sn || !job.model || !job.location || !job.date) {
//         //   alert("กรุณากรอกข้อมูลงานให้ครบก่อน");
//         //   return;
//         // }

//         if (!allAnswered) {
//             alert(`กรุณาตอบ PASS/FAIL ให้ครบทุกข้อ (เหลืออีก ${remaining} ข้อ)`);
//             return;
//         }

//         // router.push("/dashboard/input_PMreport/photoPM");
//         setPage(1);
//     };


//     return (
//         <form onSubmit={handleNext}>
//             <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
//                 {/* Job Info */}
//                 <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                     <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                         <Typography variant="h6">ข้อมูลงาน</Typography>
//                         <Typography variant="small" className="!tw-text-blue-gray-500">
//                             กรุณากรอกทุกช่องให้ครบ เพื่อความสมบูรณ์ของรายงาน PM
//                         </Typography>
//                     </CardHeader>
//                     <CardBody className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
//                         <Input label="Work Order" value={job.workOrder} onChange={(e) => setJob({ ...job, workOrder: e.target.value })} crossOrigin="" readOnly className="!tw-bg-blue-gray-50" />
//                         <Input label="SN / หมายเลขเครื่อง" value={job.sn} onChange={(e) => setJob({ ...job, sn: e.target.value })} crossOrigin="" className="!tw-bg-blue-gray-50" />
//                         <Input label="Model / รุ่น" value={job.model} onChange={(e) => setJob({ ...job, model: e.target.value })} crossOrigin="" className="!tw-bg-blue-gray-50" />
//                         <Input label="Location / สถานที่" value={job.location} onChange={(e) => setJob({ ...job, location: e.target.value })} crossOrigin="" className="!tw-bg-blue-gray-50" />
//                         <Input label="วันที่ตรวจ" type="date" value={job.date} onChange={(e) => setJob({ ...job, date: e.target.value })} crossOrigin="" />
//                     </CardBody>
//                 </Card>

//                 {/* Checklist simple items */}
//                 <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                     <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                         <Typography variant="h6">Checklist</Typography>
//                     </CardHeader>
//                     <CardBody className="tw-space-y-1">
//                         <PassFailRow label="1) Visual Check / ตรวจสอบด้วยสายตา" value={rows.r1.pf} onChange={(v) => setRows({ ...rows, r1: { ...rows.r1, pf: v } })} remark={rows.r1.remark} onRemarkChange={(v) => setRows({ ...rows, r1: { ...rows.r1, remark: v } })} />
//                         <PassFailRow label="2) Test Charge / ทดสอบชาร์จทั้ง2หัว (ก่อน PM)" value={rows.r2.pf} onChange={(v) => setRows({ ...rows, r2: { ...rows.r2, pf: v } })} remark={rows.r2.remark} onRemarkChange={(v) => setRows({ ...rows, r2: { ...rows.r2, remark: v } })} />
//                         <PassFailRow label="3) Thermal scan / ภาพถ่ายความร้อน (ก่อน PM)" value={rows.r3.pf} onChange={(v) => setRows({ ...rows, r3: { ...rows.r3, pf: v } })} remark={rows.r3.remark} onRemarkChange={(v) => setRows({ ...rows, r3: { ...rows.r3, remark: v } })} />
//                         <PassFailRow label="4) Test trip / ทดสอบการทำงานของอุปกรณ์ป้องกันระบบไฟฟ้า" value={rows.r4.pf} onChange={(v) => setRows({ ...rows, r4: { ...rows.r4, pf: v } })} remark={rows.r4.remark} onRemarkChange={(v) => setRows({ ...rows, r4: { ...rows.r4, remark: v } })} />
//                     </CardBody>
//                 </Card>

//                 {/* 5. Incoming Voltage (ก่อน PM) */}
//                 <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                     <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                         <Typography variant="h6">5) Incoming voltage check / ตรวจสอบแรงดันขาเข้า (ก่อน PM)</Typography>
//                     </CardHeader>
//                     <CardBody className="tw-space-y-4">
//                         <PassFailRow label="ผลการตรวจ" value={rows.r5.pf} onChange={(v) => setRows({ ...rows, r5: { ...rows.r5, pf: v } })} remark={rows.r5.remark} onRemarkChange={(v) => setRows({ ...rows, r5: { ...rows.r5, remark: v } })} />
//                         <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
//                             {VOLTAGE_FIELDS.map((k) => (
//                                 <InputWithUnit<UnitVoltage>
//                                     key={`pre-${k}`}
//                                     label={labelDict[k]}
//                                     value={voltage[k].value}
//                                     unit={voltage[k].unit}
//                                     units={UNITS.voltage}
//                                     onValueChange={(v) => patchVoltage(k, { value: v })}
//                                     onUnitChange={(u) => handleVoltageUnitChange(k, u)}
//                                 />
//                             ))}
//                         </div>
//                     </CardBody>
//                 </Card>

//                 {/* 6. Incoming cable Insulation (ก่อน PM) */}
//                 <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                     <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                         <Typography variant="h6">
//                             6) Incoming cable Insulation Test / การทดสอบความเป็นฉนวนของสาย Incoming ที่แรงดัน 500V (ต้อง ≥ 100 MΩ) — ก่อน PM
//                         </Typography>
//                     </CardHeader>
//                     <CardBody className="tw-space-y-4">
//                         <PassFailRow label="ผลการทดสอบ" value={rows.r6.pf} onChange={(v) => setRows({ ...rows, r6: { ...rows.r6, pf: v } })} remark={rows.r6.remark} onRemarkChange={(v) => setRows({ ...rows, r6: { ...rows.r6, remark: v } })} />
//                         <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
//                             {INSUL_FIELDS.map((k) => (
//                                 <InputWithUnit<UnitVoltage>
//                                     key={`ins-pre-${k}`}
//                                     label={labelDict[k]}
//                                     value={insulIn[k].value}
//                                     unit={insulIn[k].unit}
//                                     units={UNITS.voltage}
//                                     onValueChange={(v) => patchInsulIn(k, { value: v })}
//                                     onUnitChange={(u) => handleInsulInUnitChange(k, u)}
//                                 />
//                             ))}
//                         </div>
//                     </CardBody>
//                 </Card>

//                 {/* 7. Charging cable insulation */}
//                 <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                     <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                         <div>
//                             <Typography variant="h6">
//                                 7) Charging cable insulation Test / ทดสอบความเป็นฉนวนของสายชาร์จ ที่แรงดัน 500V (ต้อง ≥ 100 MΩ)
//                             </Typography>
//                             <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">
//                                 *อ้างอิงจากมาตรฐาน IEC 61851-2
//                             </Typography>
//                         </div>
//                     </CardHeader>
//                     <CardBody className="tw-space-y-4">
//                         <PassFailRow label="ผลการทดสอบ" value={rows.r7.pf} onChange={(v) => setRows({ ...rows, r7: { ...rows.r7, pf: v } })} remark={rows.r7.remark} onRemarkChange={(v) => setRows({ ...rows, r7: { ...rows.r7, remark: v } })} />
//                         <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-3">
//                             {CHARGE_FIELDS.map((k) => (
//                                 <InputWithUnit<UnitVoltage>
//                                     key={`charge-${k}`}
//                                     label={labelDict[k]}
//                                     value={insulCharge[k].value}
//                                     unit={insulCharge[k].unit}
//                                     units={UNITS.voltage}
//                                     onValueChange={(v) => patchInsulCharge(k, { value: v })}
//                                     onUnitChange={(u) => handleInsulChargeUnitChange(k, u)}
//                                 />
//                             ))}
//                         </div>
//                     </CardBody>
//                 </Card>

//                 {/* 8-10 simple */}
//                 <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                     <CardBody className="tw-space-y-1">
//                         <PassFailRow label="8) Check torque and tightness / ตรวจสอบค่าแรงบิดและขันแน่น" value={rows.r8.pf} onChange={(v) => setRows({ ...rows, r8: { ...rows.r8, pf: v } })} remark={rows.r8.remark} onRemarkChange={(v) => setRows({ ...rows, r8: { ...rows.r8, remark: v } })} />
//                         <PassFailRow label="9) Cleaning the air filter / ทำความสะอาดไส้กรองอากาศ" value={rows.r9.pf} onChange={(v) => setRows({ ...rows, r9: { ...rows.r9, pf: v } })} remark={rows.r9.remark} onRemarkChange={(v) => setRows({ ...rows, r9: { ...rows.r9, remark: v } })} />
//                         <PassFailRow label="10) Internal Cleaning / ทำความสะอาดภายใน" value={rows.r10.pf} onChange={(v) => setRows({ ...rows, r10: { ...rows.r10, pf: v } })} remark={rows.r10.remark} onRemarkChange={(v) => setRows({ ...rows, r10: { ...rows.r10, remark: v } })} />
//                     </CardBody>
//                 </Card>

//                 {/* 11. Incoming cable Insulation (หลัง PM) */}
//                 <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                     <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                         <Typography variant="h6">
//                             11) Incoming cable Insulation Test / การทดสอบความเป็นฉนวนของสาย Incoming ที่แรงดัน 500V (ต้อง ≥ 100 MΩ) — หลัง PM
//                         </Typography>
//                         <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">
//                             *อ้างอิงจากมาตรฐาน IEC 60364
//                         </Typography>
//                     </CardHeader>
//                     <CardBody className="tw-space-y-4">
//                         <PassFailRow label="ผลการทดสอบ" value={rows.r11.pf} onChange={(v) => setRows({ ...rows, r11: { ...rows.r11, pf: v } })} remark={rows.r11.remark} onRemarkChange={(v) => setRows({ ...rows, r11: { ...rows.r11, remark: v } })} />
//                         <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
//                             {INSUL_FIELDS.map((k) => (
//                                 <InputWithUnit<UnitVoltage>
//                                     key={`ins-post-${k}`}
//                                     label={labelDict[k]}
//                                     value={insulInPost[k].value}
//                                     unit={insulInPost[k].unit}
//                                     units={UNITS.voltage}
//                                     onValueChange={(v) => patchInsulInPost(k, { value: v })}
//                                     onUnitChange={(u) => handleInsulInPostUnitChange(k, u)}
//                                 />
//                             ))}
//                         </div>
//                     </CardBody>
//                 </Card>

//                 {/* 12. Incoming Voltage (หลัง PM) */}
//                 <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                     <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
//                         <Typography variant="h6">12) Incoming voltage check / ตรวจสอบแรงดันขาเข้า (หลัง PM)</Typography>
//                     </CardHeader>
//                     <CardBody className="tw-space-y-4">
//                         <PassFailRow label="ผลการตรวจ" value={rows.r12.pf} onChange={(v) => setRows({ ...rows, r12: { ...rows.r12, pf: v } })} remark={rows.r12.remark} onRemarkChange={(v) => setRows({ ...rows, r12: { ...rows.r12, remark: v } })} />
//                         <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
//                             {VOLTAGE_FIELDS.map((k) => (
//                                 <InputWithUnit<UnitVoltage>
//                                     key={`post-${k}`}
//                                     label={labelDict[k]}
//                                     value={voltagePost[k].value}
//                                     unit={voltagePost[k].unit}
//                                     units={UNITS.voltage}
//                                     onValueChange={(v) => patchVoltagePost(k, { value: v })}
//                                     onUnitChange={(u) => handleVoltagePostUnitChange(k, u)}
//                                 />
//                             ))}
//                         </div>
//                     </CardBody>
//                 </Card>

//                 {/* 13–15 (หลัง PM) */}
//                 <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//                     <CardBody className="tw-space-y-1">
//                         <PassFailRow
//                             label="13) Test Charge / ทดสอบชาร์จทั้ง 2 หัว (หลัง PM)"
//                             value={rows.r13.pf}
//                             onChange={(v) => setRows({ ...rows, r13: { ...rows.r13, pf: v } })}
//                             remark={rows.r13.remark}
//                             onRemarkChange={(v) => setRows({ ...rows, r13: { ...rows.r13, remark: v } })}
//                         />
//                         <PassFailRow
//                             label="14) Thermal scan / ภาพถ่ายความร้อน (หลัง PM)"
//                             value={rows.r14.pf}
//                             onChange={(v) => setRows({ ...rows, r14: { ...rows.r14, pf: v } })}
//                             remark={rows.r14.remark}
//                             onRemarkChange={(v) => setRows({ ...rows, r14: { ...rows.r14, remark: v } })}
//                         />
//                         <PassFailRow
//                             label="15) ทำความสะอาดหน้าสัมผัส SIM Internet"
//                             value={rows.r15.pf}
//                             onChange={(v) => setRows({ ...rows, r15: { ...rows.r15, pf: v } })}
//                             remark={rows.r15.remark}
//                             onRemarkChange={(v) => setRows({ ...rows, r15: { ...rows.r15, remark: v } })}
//                         />
//                     </CardBody>
//                 </Card>



//                 {/* 🆕 แถบปุ่มรวมท้ายหน้า */}
//                 {/* <Card className="tw-mt-6 tw-shadow-sm tw-border tw-border-blue-gray-100"> */}
//                 <CardFooter className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-between tw-gap-3 tw-mt-8">
//                     <div className="tw-text-sm tw-text-blue-gray-600">
//                         {allAnswered ? "ตอบครบแล้ว ✔️" : `ยังไม่ได้ตอบอีก ${remaining} ข้อ`}
//                     </div>

//                     <div className="tw-flex tw-gap-2">
//                         <Button variant="outlined" color="blue-gray" type="button" onClick={onSave}>
//                             บันทึกชั่วคราว
//                         </Button>

//                         <Button
//                             color="blue"
//                             type="button"            // ✅ ป้องกัน required ของฟอร์มบล็อก
//                             onClick={handleNext}     // ✅ เรียก handleNext
//                             disabled={!allAnswered}
//                             aria-disabled={!allAnswered}
//                             title={!allAnswered ? `ต้องตอบให้ครบก่อน (เหลือ ${remaining})` : "ไปหน้า PMReportPhotos"}
//                             className={!allAnswered ? "tw-opacity-60 tw-cursor-not-allowed" : ""}
//                         >

//                             ถัดไป
//                         </Button>
//                     </div>
//                 </CardFooter>
//                 {/* </Card> */}

//                 {/* 🆕 แถบปุ่มรวมท้ายหน้า */}
//                 {/* <Card className="tw-mt-6 tw-shadow-sm tw-border tw-border-blue-gray-100">
//   <CardFooter className="tw-px-6 tw-pt-4 tw-pb-6 tw-flex tw-justify-between">
//     <Button variant="outlined" onClick={() => router.back()} disabled={false}>
//       Previous
//     </Button>

//     <Button
//       color="blue-gray"
//       type="submit" // ใช้ submit เพื่อให้ handleNext ทำงาน
//       disabled={!allAnswered}
//       aria-disabled={!allAnswered}
//       title={!allAnswered ? `ต้องตอบให้ครบก่อน (เหลือ ${remaining})` : "ไปหน้าถัดไป"}
//       className={!allAnswered ? "tw-opacity-60 tw-cursor-not-allowed" : ""}
//     >
//       Next
//     </Button>
//   </CardFooter>
// </Card> */}


//             </section>
//         </form >
//     );
// }

"use client";

import React, { useState, useMemo } from "react";
import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardFooter,
    Input,
    Typography,
} from "@material-tailwind/react";

import PMReportPhotos from "@/app/dashboard/input_PMreport/components/photoPM";

/** --- ค่าคงที่ & ยูทิล --- */
const UNITS = {
    voltage: ["V", "MΩ", "kΩ"] as const,
};
type UnitVoltage = (typeof UNITS.voltage)[number];
type MeasureState<U extends string> = Record<string, { value: string; unit: U }>;
type CheckListProps = {
    onComplete?: (ok: boolean) => void;
};

function initMeasureState<U extends string>(
    keys: string[],
    defaultUnit: U
): MeasureState<U> {
    return Object.fromEntries(
        keys.map((k) => [k, { value: "", unit: defaultUnit }])
    ) as MeasureState<U>;
}


const VOLTAGE_FIELDS = ["L1L2", "L1L3", "L2L3", "L1N", "L2N", "L3N", "L1G", "L2G", "L3G", "NG"];
const INSUL_FIELDS = ["L1G", "L2G", "L3G", "L1N", "L2N", "L3N", "L1L2", "L1L3", "L2L3", "GN"];
const CHARGE_FIELDS = ["h1_DCpG", "h1_DCmG", "h2_DCpG", "h2_DCmG"];

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

/** อินพุตตัวเลข + หน่วย */
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
        <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-items-end sm:tw-items-center">
            <Input
                type="number"
                inputMode="decimal"
                step="any"
                label={`${label}`}
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                crossOrigin=""
                containerProps={{ className: "tw-col-span-1 !tw-min-w-0" }}
                className="!tw-w-full"
                required
            />
            <select
                required
                value={unit}
                onChange={(e) => onUnitChange(e.target.value as U)}
                className="
          tw-col-span-1 tw-h-10 tw-rounded-lg tw-border tw-border-blue-gray-200
          tw-bg-white tw-px-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2
          focus:tw-ring-blue-500/30 focus:tw-border-blue-500">
                {units.map((u) => (
                    <option key={u} value={u}>
                        {u}
                    </option>
                ))}
            </select>
        </div>
    );
}

/** Toggle Pass/Fail + Remark */
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
        <div className="tw-space-y-3 tw-py-3 tw-border-b tw-border-blue-gray-50">
            <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-2 sm:tw-items-center sm:tw-justify-between">
                <Typography className="tw-font-medium">{label}</Typography>
                <div className="tw-flex tw-gap-2 tw-w-full sm:tw-w-auto">
                    <Button
                        size="sm"
                        color="green"
                        variant={value === "PASS" ? "filled" : "outlined"}
                        className="tw-w-1/2 sm:tw-w-auto sm:tw-min-w-[84px]"
                        onClick={() => onChange("PASS")}
                        aria-pressed={value === "PASS"}
                    >
                        PASS
                    </Button>
                    <Button
                        size="sm"
                        color="red"
                        variant={value === "FAIL" ? "filled" : "outlined"}
                        className="tw-w-1/2 sm:tw-w-auto sm:tw-min-w-[84px]"
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

export default function checkList({ onComplete }: CheckListProps) {
    const [page, setPage] = useState(0); // 0 = Checklist, 1 = PMReportPhotos

    const [job, setJob] = useState({
        workOrder: "",
        sn: "",
        model: "",
        location: "",
        date: "",
        inspector: "",
    });

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

    const [voltage, setVoltage] = useState<MeasureState<UnitVoltage>>(
        initMeasureState(VOLTAGE_FIELDS, "V")
    );
    const [insulIn, setInsulIn] = useState<MeasureState<UnitVoltage>>(
        initMeasureState(INSUL_FIELDS, "V")
    );
    const [insulCharge, setInsulCharge] = useState<MeasureState<UnitVoltage>>(
        initMeasureState(CHARGE_FIELDS, "V")
    );
    const [insulInPost, setInsulInPost] = useState<MeasureState<UnitVoltage>>(
        initMeasureState(INSUL_FIELDS, "V")
    );
    const [voltagePost, setVoltagePost] = useState<MeasureState<UnitVoltage>>(
        initMeasureState(VOLTAGE_FIELDS, "V")
    );

    // ✅ เช็คตอบครบ
    const allAnswered = useMemo(
        () => Object.values(rows).every((r) => r.pf === "PASS" || r.pf === "FAIL"),
        [rows]
    );
    const remaining = useMemo(
        () => Object.values(rows).filter((r) => !r.pf).length,
        [rows]
    );

    const canNext = allAnswered;



    // utils
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

    function syncAllUnits<U extends string>(
        setter: React.Dispatch<React.SetStateAction<MeasureState<U>>>,
        keys: string[],
        newUnit: U
    ) {
        setter((prev) => {
            const next: MeasureState<U> = { ...prev };
            keys.forEach((k) => {
                next[k] = { ...prev[k], unit: newUnit };
            });
            return next;
        });
    }

    const handleVoltageUnitChange = (key: string, u: UnitVoltage) => {
        const firstKey = VOLTAGE_FIELDS[0];
        if (key !== firstKey) patchVoltage(firstKey, { unit: u });
        syncAllUnits(setVoltage, VOLTAGE_FIELDS, u);
    };
    const handleVoltagePostUnitChange = (key: string, u: UnitVoltage) => {
        const firstKey = VOLTAGE_FIELDS[0];
        if (key !== firstKey) patchVoltagePost(firstKey, { unit: u });
        syncAllUnits(setVoltagePost, VOLTAGE_FIELDS, u);
    };
    const handleInsulInUnitChange = (key: string, u: UnitVoltage) => {
        const firstKey = INSUL_FIELDS[0];
        if (key !== firstKey) patchInsulIn(firstKey, { unit: u });
        syncAllUnits(setInsulIn, INSUL_FIELDS, u);
    };
    const handleInsulInPostUnitChange = (key: string, u: UnitVoltage) => {
        const firstKey = INSUL_FIELDS[0];
        if (key !== firstKey) patchInsulInPost(firstKey, { unit: u });
        syncAllUnits(setInsulInPost, INSUL_FIELDS, u);
    };
    const handleInsulChargeUnitChange = (key: string, u: UnitVoltage) => {
        const firstKey = CHARGE_FIELDS[0];
        if (key !== firstKey) patchInsulCharge(firstKey, { unit: u });
        syncAllUnits(setInsulCharge, CHARGE_FIELDS, u);
    };

    const onSave = () => {
        console.log({
            job,
            rows,
            voltage,
            insulIn,
            insulCharge,
            insulInPost,
            voltagePost,
        });
        alert("บันทึกชั่วคราว (เดโม่) – ดูข้อมูลใน console");
    };

    // ▶️ ถัดไป: สลับไปหน้า PMReportPhotos (ไม่ใช้ path)
    const handleNext = () => {
        if (!allAnswered) {
            alert(`กรุณาตอบ PASS/FAIL ให้ครบทุกข้อ (เหลืออีก ${remaining} ข้อ)`);
            return;
        }
        setPage(1);
        // window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // ◀️ ย้อนกลับไปหน้า Checklist
    const handlePrev = () => {
        setPage(0);
        // window.scrollTo({ top: 0, behavior: "smooth" });
    };

    React.useEffect(() => {
        onComplete?.(canNext); // แจ้ง page.tsx ทุกครั้งที่สถานะเปลี่ยน
    }, [canNext, onComplete]);



    return (
        <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
            {page === 0 && (
                <>
                    {/* Job Info */}
                    <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                        <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                            <Typography variant="h6">ข้อมูลงาน</Typography>
                            <Typography variant="small" className="!tw-text-blue-gray-500">
                                กรุณากรอกทุกช่องให้ครบ เพื่อความสมบูรณ์ของรายงาน PM
                            </Typography>
                        </CardHeader>
                        <CardBody className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                            <Input label="Work Order" value={job.workOrder} onChange={(e) => setJob({ ...job, workOrder: e.target.value })} crossOrigin="" readOnly className="!tw-bg-blue-gray-50" />
                            <Input label="SN / หมายเลขเครื่อง" value={job.sn} onChange={(e) => setJob({ ...job, sn: e.target.value })} crossOrigin="" className="!tw-bg-blue-gray-50" />
                            <Input label="Model / รุ่น" value={job.model} onChange={(e) => setJob({ ...job, model: e.target.value })} crossOrigin="" className="!tw-bg-blue-gray-50" />
                            <Input label="Location / สถานที่" value={job.location} onChange={(e) => setJob({ ...job, location: e.target.value })} crossOrigin="" className="!tw-bg-blue-gray-50" />
                            <Input label="วันที่ตรวจ" type="date" value={job.date} onChange={(e) => setJob({ ...job, date: e.target.value })} crossOrigin="" />
                        </CardBody>
                    </Card>

                    {/* Checklist simple items */}
                    <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                        <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                            <Typography variant="h6">Checklist</Typography>
                        </CardHeader>
                        <CardBody className="tw-space-y-1">
                            <PassFailRow label="1) Visual Check / ตรวจสอบด้วยสายตา" value={rows.r1.pf} onChange={(v) => setRows({ ...rows, r1: { ...rows.r1, pf: v } })} remark={rows.r1.remark} onRemarkChange={(v) => setRows({ ...rows, r1: { ...rows.r1, remark: v } })} />
                            <PassFailRow label="2) Test Charge / ทดสอบชาร์จทั้ง2หัว (ก่อน PM)" value={rows.r2.pf} onChange={(v) => setRows({ ...rows, r2: { ...rows.r2, pf: v } })} remark={rows.r2.remark} onRemarkChange={(v) => setRows({ ...rows, r2: { ...rows.r2, remark: v } })} />
                            <PassFailRow label="3) Thermal scan / ภาพถ่ายความร้อน (ก่อน PM)" value={rows.r3.pf} onChange={(v) => setRows({ ...rows, r3: { ...rows.r3, pf: v } })} remark={rows.r3.remark} onRemarkChange={(v) => setRows({ ...rows, r3: { ...rows.r3, remark: v } })} />
                            <PassFailRow label="4) Test trip / ทดสอบการทำงานของอุปกรณ์ป้องกันระบบไฟฟ้า" value={rows.r4.pf} onChange={(v) => setRows({ ...rows, r4: { ...rows.r4, pf: v } })} remark={rows.r4.remark} onRemarkChange={(v) => setRows({ ...rows, r4: { ...rows.r4, remark: v } })} />
                        </CardBody>
                    </Card>

                    {/* 5. Incoming Voltage (ก่อน PM) */}
                    <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                        <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                            <Typography variant="h6">5) Incoming voltage check / ตรวจสอบแรงดันขาเข้า (ก่อน PM)</Typography>
                        </CardHeader>
                        <CardBody className="tw-space-y-4">
                            <PassFailRow label="ผลการตรวจ" value={rows.r5.pf} onChange={(v) => setRows({ ...rows, r5: { ...rows.r5, pf: v } })} remark={rows.r5.remark} onRemarkChange={(v) => setRows({ ...rows, r5: { ...rows.r5, remark: v } })} />
                            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                                {VOLTAGE_FIELDS.map((k) => (
                                    <InputWithUnit<UnitVoltage>
                                        key={`pre-${k}`}
                                        label={labelDict[k]}
                                        value={voltage[k].value}
                                        unit={voltage[k].unit}
                                        units={UNITS.voltage}
                                        onValueChange={(v) => patchVoltage(k, { value: v })}
                                        onUnitChange={(u) => handleVoltageUnitChange(k, u)}
                                    />
                                ))}
                            </div>
                        </CardBody>
                    </Card>

                    {/* 6. Incoming cable Insulation (ก่อน PM) */}
                    <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                        <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                            <Typography variant="h6">
                                6) Incoming cable Insulation Test / การทดสอบความเป็นฉนวนของสาย Incoming ที่แรงดัน 500V (ต้อง ≥ 100 MΩ) — ก่อน PM
                            </Typography>
                        </CardHeader>
                        <CardBody className="tw-space-y-4">
                            <PassFailRow label="ผลการทดสอบ" value={rows.r6.pf} onChange={(v) => setRows({ ...rows, r6: { ...rows.r6, pf: v } })} remark={rows.r6.remark} onRemarkChange={(v) => setRows({ ...rows, r6: { ...rows.r6, remark: v } })} />
                            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                                {INSUL_FIELDS.map((k) => (
                                    <InputWithUnit<UnitVoltage>
                                        key={`ins-pre-${k}`}
                                        label={labelDict[k]}
                                        value={insulIn[k].value}
                                        unit={insulIn[k].unit}
                                        units={UNITS.voltage}
                                        onValueChange={(v) => patchInsulIn(k, { value: v })}
                                        onUnitChange={(u) => handleInsulInUnitChange(k, u)}
                                    />
                                ))}
                            </div>
                        </CardBody>
                    </Card>

                    {/* 7. Charging cable insulation */}
                    <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                        <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                            <div>
                                <Typography variant="h6">
                                    7) Charging cable insulation Test / ทดสอบความเป็นฉนวนของสายชาร์จ ที่แรงดัน 500V (ต้อง ≥ 100 MΩ)
                                </Typography>
                                <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">
                                    *อ้างอิงจากมาตรฐาน IEC 61851-2
                                </Typography>
                            </div>
                        </CardHeader>
                        <CardBody className="tw-space-y-4">
                            <PassFailRow label="ผลการทดสอบ" value={rows.r7.pf} onChange={(v) => setRows({ ...rows, r7: { ...rows.r7, pf: v } })} remark={rows.r7.remark} onRemarkChange={(v) => setRows({ ...rows, r7: { ...rows.r7, remark: v } })} />
                            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-4 tw-gap-3">
                                {CHARGE_FIELDS.map((k) => (
                                    <InputWithUnit<UnitVoltage>
                                        key={`charge-${k}`}
                                        label={labelDict[k]}
                                        value={insulCharge[k].value}
                                        unit={insulCharge[k].unit}
                                        units={UNITS.voltage}
                                        onValueChange={(v) => patchInsulCharge(k, { value: v })}
                                        onUnitChange={(u) => handleInsulChargeUnitChange(k, u)}
                                    />
                                ))}
                            </div>
                        </CardBody>
                    </Card>

                    {/* 8–10 simple */}
                    <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                        <CardBody className="tw-space-y-1">
                            <PassFailRow label="8) Check torque and tightness / ตรวจสอบค่าแรงบิดและขันแน่น" value={rows.r8.pf} onChange={(v) => setRows({ ...rows, r8: { ...rows.r8, pf: v } })} remark={rows.r8.remark} onRemarkChange={(v) => setRows({ ...rows, r8: { ...rows.r8, remark: v } })} />
                            <PassFailRow label="9) Cleaning the air filter / ทำความสะอาดไส้กรองอากาศ" value={rows.r9.pf} onChange={(v) => setRows({ ...rows, r9: { ...rows.r9, pf: v } })} remark={rows.r9.remark} onRemarkChange={(v) => setRows({ ...rows, r9: { ...rows.r9, remark: v } })} />
                            <PassFailRow label="10) Internal Cleaning / ทำความสะอาดภายใน" value={rows.r10.pf} onChange={(v) => setRows({ ...rows, r10: { ...rows.r10, pf: v } })} remark={rows.r10.remark} onRemarkChange={(v) => setRows({ ...rows, r10: { ...rows.r10, remark: v } })} />
                        </CardBody>
                    </Card>

                    {/* 11. Incoming cable Insulation (หลัง PM) */}
                    <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                        <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                            <Typography variant="h6">
                                11) Incoming cable Insulation Test / การทดสอบความเป็นฉนวนของสาย Incoming ที่แรงดัน 500V (ต้อง ≥ 100 MΩ) — หลัง PM
                            </Typography>
                            <Typography variant="small" className="!tw-text-blue-gray-500 tw-italic tw-mt-1">
                                *อ้างอิงจากมาตรฐาน IEC 60364
                            </Typography>
                        </CardHeader>
                        <CardBody className="tw-space-y-4">
                            <PassFailRow label="ผลการทดสอบ" value={rows.r11.pf} onChange={(v) => setRows({ ...rows, r11: { ...rows.r11, pf: v } })} remark={rows.r11.remark} onRemarkChange={(v) => setRows({ ...rows, r11: { ...rows.r11, remark: v } })} />
                            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                                {INSUL_FIELDS.map((k) => (
                                    <InputWithUnit<UnitVoltage>
                                        key={`ins-post-${k}`}
                                        label={labelDict[k]}
                                        value={insulInPost[k].value}
                                        unit={insulInPost[k].unit}
                                        units={UNITS.voltage}
                                        onValueChange={(v) => patchInsulInPost(k, { value: v })}
                                        onUnitChange={(u) => handleInsulInPostUnitChange(k, u)}
                                    />
                                ))}
                            </div>
                        </CardBody>
                    </Card>

                    {/* 12. Incoming Voltage (หลัง PM) */}
                    <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                        <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                            <Typography variant="h6">12) Incoming voltage check / ตรวจสอบแรงดันขาเข้า (หลัง PM)</Typography>
                        </CardHeader>
                        <CardBody className="tw-space-y-4">
                            <PassFailRow label="ผลการตรวจ" value={rows.r12.pf} onChange={(v) => setRows({ ...rows, r12: { ...rows.r12, pf: v } })} remark={rows.r12.remark} onRemarkChange={(v) => setRows({ ...rows, r12: { ...rows.r12, remark: v } })} />
                            <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 md:tw-grid-cols-5 tw-gap-3">
                                {VOLTAGE_FIELDS.map((k) => (
                                    <InputWithUnit<UnitVoltage>
                                        key={`post-${k}`}
                                        label={labelDict[k]}
                                        value={voltagePost[k].value}
                                        unit={voltagePost[k].unit}
                                        units={UNITS.voltage}
                                        onValueChange={(v) => patchVoltagePost(k, { value: v })}
                                        onUnitChange={(u) => handleVoltagePostUnitChange(k, u)}
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
                </>
            )}

            {page === 1 && (
                <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
                    <CardHeader floated={false} shadow={false} className="tw-px-4 tw-pt-4 tw-pb-2">
                        <Typography variant="h6">อัปโหลดรูปภาพ PM</Typography>
                    </CardHeader>
                    <CardBody className="tw-px-6">
                        <PMReportPhotos />
                    </CardBody>
                </Card>
            )}

            {/* ปุ่มควบคุมท้ายหน้า */}
            <CardFooter className="tw-flex tw-flex-col sm:tw-flex-row tw-justify-between tw-gap-3 tw-mt-8">
                <div className="tw-text-sm tw-text-blue-gray-600">
                    {page === 0
                        ? (allAnswered ? "ตอบครบแล้ว ✔️" : `ยังไม่ได้ตอบอีก ${remaining} ข้อ`)
                        : "หน้าอัปโหลดรูปภาพ"}
                </div>

                <div className="tw-flex tw-gap-2">
                    <Button variant="outlined" color="blue-gray" type="button" onClick={onSave}>
                        บันทึกชั่วคราว
                    </Button>

                    {page === 0 ? (
                        <Button
                            color="blue"
                            type="button"
                            onClick={handleNext}
                            disabled={!allAnswered}
                            aria-disabled={!allAnswered}
                            title={!allAnswered ? `ต้องตอบให้ครบก่อน (เหลือ ${remaining})` : "ไปหน้า PMReportPhotos"}
                            className={!allAnswered ? "tw-opacity-60 tw-cursor-not-allowed" : ""}
                        >
                            ถัดไป
                        </Button>
                    ) : (
                        <Button
                            variant="filled"
                            color="blue-gray"
                            type="button"
                            onClick={handlePrev}
                        >
                            กลับไปแก้ Checklist
                        </Button>
                    )}
                </div>
            </CardFooter>
        </section>
    );
}

