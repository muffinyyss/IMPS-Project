// "use client";

// import React, { useEffect, useMemo, useState } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import {
//   Button,
//   Card,
//   CardBody,
//   Typography,
// } from "@material-tailwind/react";
// import { ArrowLeftIcon } from "@heroicons/react/24/outline";

// import CheckList from "@/app/dashboard/cm-report/open/input_CMreport/components/checkList";

// export default function PM_Report() {
//   const router = useRouter();
//   const search = useSearchParams();

//   const [page, setPage] = useState<0 | 1>(0);
//   const [isCheckListComplete, setIsCheckListComplete] = useState(false);

//   // --- ดึง station_id จาก URL หรือ localStorage ---
//   const stationId = useMemo(() => {
//     return (
//       search.get("station_id") ??
//       (typeof window !== "undefined" ? localStorage.getItem("selected_station_id") ?? "" : "")
//     );
//   }, [search]);

//   // --- เตรียม reportId ---
//   // 1) ถ้า URL มี ?report_id=... ใช้อันนั้น
//   // 2) ถ้าไม่มี ให้ใช้ที่เก็บไว้จากครั้งก่อนใน localStorage
//   // 3) ถ้ายังไม่มีเลย สร้างชั่วคราว (uuid) ไว้อัปโหลดรูป แล้วเก็บไว้ก่อน
//   const [reportId, setReportId] = useState<string>(() => {
//     if (typeof window === "undefined") return "";
//     const fromUrl = search.get("report_id");
//     if (fromUrl) {
//       localStorage.setItem("pm_report_id", fromUrl);
//       return fromUrl;
//     }
//     const saved = localStorage.getItem("pm_report_id");
//     if (saved) return saved;
//     const tmp = crypto.randomUUID();
//     localStorage.setItem("pm_report_id", tmp);
//     return tmp;
//   });

//   // (ถ้าหน้าอื่นสร้าง report จริงแล้ว push กลับมาพร้อม report_id ใหม่ ให้ sync เก็บไว้)
//   useEffect(() => {
//     const fromUrl = search.get("report_id");
//     if (fromUrl && fromUrl !== reportId) {
//       setReportId(fromUrl);
//       if (typeof window !== "undefined") localStorage.setItem("pm_report_id", fromUrl);
//     }
//   }, [search, reportId]);

//   const goTo = (target: 0 | 1) => {
//     if (target === 1 && !isCheckListComplete) {
//       alert("กรุณากรอกและตอบ PASS/FAIL ให้ครบก่อน จึงจะไปหน้า 2 ได้");
//       return;
//     }
//     setPage(target);
//   };

//   return (
//     <section className="tw-mx-0 tw-px-3 md:tw-px-6 xl:tw-px-0 tw-pb-24">
//       {/* Top bar actions */}
//       <div className="tw-sticky tw-top-0 tw-z-20 tw-bg-transparent tw-pt-3 tw-pb-2">
//         <div className="tw-flex tw-items-center tw-justify-between tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-2xl tw-shadow-sm tw-px-4 tw-py-3">
//           <Button
//             variant="text"
//             onClick={() => router.back()}
//             className="tw-bg-white tw-border tw-border-blue-gray-200 tw-rounded-xl tw-shadow-none tw-h-9 tw-px-4 tw-min-w-0 tw-flex tw-items-center tw-justify-center hover:tw-bg-blue-gray-50"
//           >
//             <ArrowLeftIcon className="tw-h-5 tw-w-5 tw-text-blue-gray-800" />
//           </Button>
//           <Typography variant="h5">Preventive Maintenance Report - CCB</Typography>
//           <div />
//         </div>
//       </div>

//       {/* Company Info */}
//       <Card className="tw-mt-3 tw-shadow-sm tw-border tw-border-blue-gray-100">
//         <CardBody className="tw-space-y-1">
//           <Typography className="tw-font-semibold">
//             การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.) — ศูนย์บริการข้อมูล กฟผ. สายด่วน: 1416
//           </Typography>
//           <Typography className="!tw-text-blue-gray-600">
//             เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย
//             อำเภอบางกรวย จังหวัดนนทบุรี 11130
//           </Typography>
//         </CardBody>
//       </Card>

//       {/* Pages */}
//       <Card className="tw-mt-4 tw-shadow-sm tw-border tw-border-blue-gray-100">
//         <CardBody className="tw-px-6 tw-pb-0">
//           {/* Page 1: Checklist */}
//           <div className={page === 0 ? "" : "tw-hidden"} aria-hidden={page !== 0}>
//             <CheckList
//               onComplete={(status: boolean) => setIsCheckListComplete(status)}
//               onNext={() => goTo(1)}
//               onPrev={() => goTo(0)}
//             />
//           </div>

//           {/* Page 2: Photos */}
//           {/* <div className={page === 1 ? "" : "tw-hidden"} aria-hidden={page !== 1}>
//             {!stationId ? (
//               <div className="tw-p-4 tw-text-red-700 tw-bg-red-50 tw-rounded-lg">
//                 ไม่พบ <code>station_id</code> ใน URL และ localStorage
//               </div>
//             ) : (
//               <PMReportPhotos
//                 onBack={() => goTo(0)}
//                 stationId={stationId}
//                 reportId={reportId}
//               />
//             )}
//           </div> */}
//         </CardBody>
//       </Card>
//     </section>
//   );
// }
