// "use client";

// import React, { useState } from "react";
// import { Input, Button } from "@material-tailwind/react";

// interface DCTestItem {
//   category: string;
//   subCategory?: string;
//   testName: string;
//   unit?: string;
// }

// export interface TestCharger {
//   test1: { h1: string; h2: string }[];
//   test2: { h1: string; h2: string }[];
//   test3: { h1: string; h2: string }[];
//   remarks: string[];
// }

// interface TestResultsGridProps {
//   title?: string;
//   testItems: DCTestItem[];
//   results: TestCharger;
//   onResultChange: (
//     testIndex: number,
//     itemIndex: number,
//     field: "h1" | "h2",
//     value: string
//   ) => void;
//   onRemarkChange: (itemIndex: number, value: string) => void;
// }

// export type ChargerSafetyPayload = {
//   ChargerSafety: {
//     peContinuity: {
//       r1: Record<
//         "none" | "CPshort" | "PE_PP_cut" | "backCover" | "remoteStop" | "emergency" | "LDCp" | "LDCm" | "HDCp" | "HDCm",
//         { h1: string; h2: string }
//       >;
//       r2: Record<
//         "none" | "CPshort" | "PE_PP_cut" | "backCover" | "remoteStop" | "emergency" | "LDCp" | "LDCm" | "HDCp" | "HDCm",
//         { h1: string; h2: string }
//       >;
//       r3: Record<
//         "none" | "CPshort" | "PE_PP_cut" | "backCover" | "remoteStop" | "emergency" | "LDCp" | "LDCm" | "HDCp" | "HDCm",
//         { h1: string; h2: string }
//       >;
//     };
//     remarks: Record<string, string>;
//   };
// };

// const TestResultsGrid: React.FC<TestResultsGridProps> = ({
//   title = "Test Results (Record as Pass/Fail) or Numeric Results",
//   testItems,
//   results,
//   onResultChange,
//   onRemarkChange,
// }) => {
//   return (
//     <div className="tw-border tw-border-gray-800 tw-bg-white">
//       {/* Header */}
//       <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-[2fr_3fr_1fr] tw-bg-gray-100">
//         <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold">
//           <div>Testing Checklist</div>
//           <div className="tw-text-xs tw-font-medium tw-mt-1">CCS2</div>
//         </div>
//         <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold md:tw-block tw-hidden">
//           {title}
//         </div>
//         <div className="tw-p-3 tw-text-center tw-font-semibold md:tw-block tw-hidden">
//           Remark
//         </div>
//         {/* Mobile header */}
//         <div className="tw-border-t tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold md:tw-hidden">
//           <div>Testing Checklist</div>
//           <div className="tw-text-xs tw-font-medium tw-mt-1">CCS2</div>
//         </div>
//         <div className="tw-border-t tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold md:tw-hidden">
//           {title}
//         </div>
//         <div className="tw-border-t tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold md:tw-hidden">
//           Remark
//         </div>
//       </div>

//       {/* Sub Header */}
//       <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-[2fr_3fr_1fr] tw-bg-gray-50">
//         <div className="tw-border-r tw-border-gray-800"></div>
//         <div className="tw-border-r tw-border-gray-800 tw-grid tw-grid-cols-1 md:tw-grid-cols-3">
//           {/* 1st TEST */}
//           <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800">
//             <div className="tw-p-2 tw-text-center tw-font-medium tw-border-b tw-border-gray-800">
//               1st TEST
//             </div>
//             <div className="tw-grid tw-grid-cols-2">
//               <div className="tw-border-r tw-border-gray-800 tw-p-1 tw-text-center tw-text-xs">
//                 H1
//               </div>
//               <div className="tw-p-1 tw-text-center tw-text-xs">H2</div>
//             </div>
//           </div>
//           {/* 2nd TEST */}
//           <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800">
//             <div className="tw-p-2 tw-text-center tw-font-medium tw-border-b tw-border-gray-800">
//               2nd TEST
//             </div>
//             <div className="tw-grid tw-grid-cols-2">
//               <div className="tw-border-r tw-border-gray-800 tw-p-1 tw-text-center tw-text-xs">
//                 H1
//               </div>
//               <div className="tw-p-1 tw-text-center tw-text-xs">H2</div>
//             </div>
//           </div>
//           {/* 3rd TEST */}
//           <div>
//             <div className="tw-p-2 tw-text-center tw-font-medium tw-border-b tw-border-gray-800">
//               3rd TEST
//             </div>
//             <div className="tw-grid tw-grid-cols-2">
//               <div className="tw-border-r tw-border-gray-800 tw-p-1 tw-text-center tw-text-xs">
//                 H1
//               </div>
//               <div className="tw-p-1 tw-text-center tw-text-xs">H2</div>
//             </div>
//           </div>
//         </div>
//         <div className="md:tw-block tw-hidden"></div>
//       </div>

//       {/* Test Items */}
//       {testItems.map((item, index) => {
//         const isPEContinuity = item.subCategory?.includes("PE.Continuity");
//         const isFirstPEItem = index === 0;

//         return (
//           <div
//             key={index}
//             className={`tw-grid tw-grid-cols-1 md:tw-grid-cols-[2fr_3fr_1fr] tw-border-t tw-border-gray-800 ${
//               isPEContinuity ? "tw-min-h-[50px]" : "tw-min-h-[60px]"
//             }`}
//           >
//             {/* Test Name Column */}
//             <div className="tw-border-r tw-border-gray-800 tw-relative tw-bg-white">
//               {/* Charger Safety - show from first item to last item (all 10 rows) */}
//               {isFirstPEItem && (
//                 <div className="tw-absolute tw-left-0 tw-top-0 tw-w-16 tw-h-[580px] tw-bg-gray-50 tw-border-r tw-border-gray-300 tw-items-center tw-justify-center tw-z-10 tw-hidden md:tw-flex">
//                   <div className="tw-transform tw--rotate-90 tw-text-sm tw-font-bold tw-text-gray-800 tw-whitespace-nowrap">
//                     Charger Safety
//                   </div>
//                 </div>
//               )}

//               {/* Mobile labels */}
//               <div className="tw-block md:tw-hidden tw-bg-gray-100 tw-px-3 tw-py-2 tw-text-xs tw-font-medium tw-text-gray-700">
//                 {item.category}
//                 {item.subCategory && ` - ${item.subCategory}`}
//               </div>

//               {/* Test details */}
//               <div className="tw-p-3 tw-flex tw-items-center tw-h-full md:tw-ml-16 tw-ml-0">
//                 <div className="tw-w-full">
//                   {/* Normal layout for all items - aligned left for consistent vertical alignment */}
//                   <div className="tw-flex tw-items-center tw-justify-start tw-h-full tw-pl-0">
//                     <span className="tw-text-sm tw-text-gray-800">
//                       {item.testName}
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* Test Results Columns */}
//             <div className="tw-border-r tw-border-gray-800 tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-bg-white">
//               {/* 1st Test */}
//               <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800 tw-grid tw-grid-cols-2">
//                 <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-2 tw-col-span-2">
//                   1st TEST
//                 </div>
//                 {/* H1 */}
//                 <div className="tw-border-r tw-border-gray-800 tw-p-2">
//                   <Button
//                     size="sm"
//                     color="green"
//                     variant={
//                       results.test1[index]?.h1 === "✓" ? "filled" : "outlined"
//                     }
//                     className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
//                     onClick={() =>
//                       onResultChange(
//                         0,
//                         index,
//                         "h1",
//                         results.test1[index]?.h1 === "✓" ? "" : "✓"
//                       )
//                     }
//                   >
//                     ✓
//                   </Button>
//                 </div>
//                 {/* H2 */}
//                 <div className="tw-p-2">
//                   <Button
//                     size="sm"
//                     color="green"
//                     variant={
//                       results.test1[index]?.h2 === "✓"
//                         ? "filled"
//                         : "outlined"
//                     }
//                     className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
//                     onClick={() =>
//                       onResultChange(
//                         0,
//                         index,
//                         "h2",
//                         results.test1[index]?.h2 === "✓" ? "" : "✓"
//                       )
//                     }
//                   >
//                     ✓
//                   </Button>
//                 </div>
//               </div>

//               {/* 2nd Test */}
//               <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800 tw-grid tw-grid-cols-2">
//                 <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-2 tw-col-span-2">
//                   2nd TEST
//                 </div>
//                 {/* H1 */}
//                 <div className="tw-border-r tw-border-gray-800 tw-p-2">
//                   <Button
//                     size="sm"
//                     color="green"
//                     variant={
//                       results.test2[index]?.h1 === "✓" ? "filled" : "outlined"
//                     }
//                     className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
//                     onClick={() =>
//                       onResultChange(
//                         1,
//                         index,
//                         "h1",
//                         results.test2[index]?.h1 === "✓" ? "" : "✓"
//                       )
//                     }
//                   >
//                     ✓
//                   </Button>
//                 </div>
//                 {/* H2 */}
//                 <div className="tw-p-2">
//                   <Button
//                     size="sm"
//                     color="green"
//                     variant={
//                       results.test2[index]?.h2 === "✓"
//                         ? "filled"
//                         : "outlined"
//                     }
//                     className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
//                     onClick={() =>
//                       onResultChange(
//                         1,
//                         index,
//                         "h2",
//                         results.test2[index]?.h2 === "✓" ? "" : "✓"
//                       )
//                     }
//                   >
//                     ✓
//                   </Button>
//                 </div>
//               </div>

//               {/* 3rd Test */}
//               <div className="tw-grid tw-grid-cols-2">
//                 <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-2 tw-col-span-2">
//                   3rd TEST
//                 </div>
//                 {/* H1 */}
//                 <div className="tw-border-r tw-border-gray-800 tw-p-2">
//                   <Button
//                     size="sm"
//                     color="green"
//                     variant={
//                       results.test3[index]?.h1 === "✓" ? "filled" : "outlined"
//                     }
//                     className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
//                     onClick={() =>
//                       onResultChange(
//                         2,
//                         index,
//                         "h1",
//                         results.test3[index]?.h1 === "✓" ? "" : "✓"
//                       )
//                     }
//                   >
//                     ✓
//                   </Button>
//                 </div>
//                 {/* H2 */}
//                 <div className="tw-p-2">
//                   <Button
//                     size="sm"
//                     color="green"
//                     variant={
//                       results.test3[index]?.h2 === "✓"
//                         ? "filled"
//                         : "outlined"
//                     }
//                     className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
//                     onClick={() =>
//                       onResultChange(
//                         2,
//                         index,
//                         "h2",
//                         results.test3[index]?.h2 === "✓" ? "" : "✓"
//                       )
//                     }
//                   >
//                     ✓
//                   </Button>
//                 </div>
//               </div>
//             </div>

//             {/* Remark Column */}
//             <div className="tw-p-2 tw-bg-white">
//               <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-2">
//                 Remark
//               </div>
//               <Input
//                 value={results.remarks[index] || ""}
//                 onChange={(e) => onRemarkChange(index, e.target.value)}
//                 crossOrigin=""
//                 className="!tw-border-gray-300"
//                 containerProps={{ className: "!tw-min-w-0 !tw-h-10" }}
//                 placeholder=""
//               />
//             </div>
//           </div>
//         );
//       })}
//     </div>
//   );
// };

// export const AC_TEST_DATA: DCTestItem[] = [
//   // PE.Continuity protective Conductors of Charger
//   {
//     category: "Charger Safety",
//     subCategory: "PE.Continuity protective Conductors of Charger",
//     testName: "None (Normal operate)",
//     unit: "",
//   },
//   {
//     category: "Charger Safety",
//     subCategory: "PE.Continuity protective Conductors of Charger",
//     testName: "CP short -120 Ohm",
//     unit: "",
//   },
//   {
//     category: "Charger Safety",
//     subCategory: "PE.Continuity protective Conductors of Charger",
//     testName: "PE-PP-Cut",
//     unit: "",
//   },
//   {
//     category: "Charger Safety",
//     subCategory: "PE.Continuity protective Conductors of Charger",
//     testName: "Back Cover",
//     unit: "",
//   },
//   {
//     category: "Charger Safety",
//     subCategory: "PE.Continuity protective Conductors of Charger",
//     testName: "Remote Stop",
//     unit: "",
//   },
//   {
//     category: "Charger Safety",
//     subCategory: "PE.Continuity protective Conductors of Charger",
//     testName: "Emergency",
//     unit: "",
//   },

//   // Isolation Transformer
//   {
//     category: "Charger Safety",
//     subCategory: "",
//     testName: "LDC +",
//     unit: "",
//   },

//   // HDC Tests
//   {
//     category: "Charger Safety",
//     subCategory: "",
//     testName: "LDC  -",
//     unit: "",
//   },
//   {
//     category: "Charger Safety",
//     subCategory: "",
//     testName: "HDC  +",
//     unit: "",
//   },
//     {
//     category: "Charger Safety",
//     subCategory: "",
//     testName: "HDC  -",
//     unit: "",
//   },
// ];

// /* ===================== Helpers (สร้าง payload) ===================== */

// const camelKey = (s: string) =>
//   s
//     .normalize("NFKD")
//     .replace(/[^\w\s]/g, "")
//     .replace(/\s+(\w)/g, (_, c) => c.toUpperCase())
//     .replace(/\s+/g, "")
//     .replace(/^\w/, (c) => c.toLowerCase());

//     /* ชื่อคีย์แบบพิเศษสำหรับ RCD/Isolation/Power standby ให้สวยและคงที่ */
// const nameKey = (testName: string) => {
//   const n = testName.trim();
//   if (/^RCD type\s*/i.test(n)) {
//     const letter = n.replace(/^RCD type\s*/i, "").trim(); // A/F/B
//     return ("rcdType" + letter.toUpperCase()) as "rcdTypeA" | "rcdTypeF" | "rcdTypeB";
//   }
//   if (/^Isolation Transformer$/i.test(n)) return "isolationTransformer";
//   if (/^Power standby$/i.test(n)) return "powerStandby";
//   return camelKey(n);
// };

// /* แปลง remarks array → object ต่อชื่อทดสอบ */
// export function buildRemarks(results: TestCharger, items: DCTestItem[]) {
//   const remarks: Record<string, string> = {};
//   items.forEach((it, i) => {
//     remarks[nameKey(it.testName)] = results.remarks[i] ?? "";
//   });
//   return remarks;
// }

// const toPass = (v?: string) => (v === "✓" ? "pass" : (v ?? ""));

// /* ตัวแปลงหลัก → payload แนะนำสำหรับ Mongo (แยกรอบชัดเจน) */
// export function mapToChargerPayload(results: TestCharger, items: DCTestItem[] = AC_TEST_DATA): ChargerSafetyPayload {
//   // index ค้นหาตามชื่อ จะได้ไม่ผูก index ตายตัว
//   const findIndex = (name: string) => items.findIndex((it) => it.testName.toLowerCase() === name.toLowerCase());

//   // 6 แถวแรกของ PE (ตามสเปกชุดนี้คงที่ชื่อ)
//   const iNone = findIndex("None (Normal operate)");
//   const iCP = findIndex("CP short -120 Ohm");
//   const iPE = findIndex("PE-PP-Cut");
//   const iBack = findIndex("Back Cover");
//   const iRemote = findIndex("Remote Stop");
//   const iEmer = findIndex("Emergency");
//   const iLDCp = findIndex("LDC +");
//   const iLDCm = findIndex("LDC -");
//   const iHDCp = findIndex("HDC +");
//   const iHDCm = findIndex("HDC -");

//   const t1 = results.test1;
//   const t2 = results.test2;
//   const t3 = results.test3;

//   const V = (t: { h1: string; h2: string }[], i: number) => ({
//     h1: i >= 0 ? t[i]?.h1 ?? "" : "",
//     h2: i >= 0 ? toPass(t[i]?.h2) : "",   // ← จุดสำคัญ
//   });

//   const peContinuity = {
//     r1: {
//       none: V(t1, iNone),
//       CPshort: V(t1, iCP),
//       PE_PP_cut: V(t1, iPE),
//       backCover: V(t1, iBack),
//       remoteStop: V(t1, iRemote),
//       emergency: V(t1, iEmer),
//       LDCp: V(t1, iLDCp),
//       LDCm: V(t1, iLDCm),
//       HDCp: V(t1, iHDCp),
//       HDCm: V(t1, iHDCm),
//     },
//     r2: {
//       none: V(t2, iNone),
//       CPshort: V(t2, iCP),
//       PE_PP_cut: V(t2, iPE),
//       backCover: V(t2, iBack),
//       remoteStop: V(t2, iRemote),
//       emergency: V(t2, iEmer),
//       LDCp: V(t2, iLDCp),
//       LDCm: V(t2, iLDCm),
//       HDCp: V(t2, iHDCp),
//       HDCm: V(t2, iHDCm),
//     },
//     r3: {
//       none: V(t3, iNone),
//       CPshort: V(t3, iCP),
//       PE_PP_cut: V(t3, iPE),
//       backCover: V(t3, iBack),
//       remoteStop: V(t3, iRemote),
//       emergency: V(t3, iEmer),
//       LDCp: V(t3, iLDCp),
//       LDCm: V(t3, iLDCm),
//       HDCp: V(t3, iHDCp),
//       HDCm: V(t3, iHDCm),
//     },
//   } as ChargerSafetyPayload["ChargerSafety"]["peContinuity"];

//   // Remarks ต่อแถว
//   const remarks = buildRemarks(results, items);

//   return {
//     ChargerSafety: {
//       peContinuity,
//       remarks,
//     },
//   };
// }


// const createEmptyResults = (itemCount: number): TestCharger => ({
//   test1: new Array(itemCount).fill(null).map(() => ({ h1: "", h2: "" })),
//   test2: new Array(itemCount).fill(null).map(() => ({ h1: "", h2: "" })),
//   test3: new Array(itemCount).fill(null).map(() => ({ h1: "", h2: "" })),
//   // rcdValues: new Array(itemCount).fill(""),
//   remarks: new Array(itemCount).fill(""),
// });

// interface ACTestGridProps {
//   initialResults?: TestCharger;
//   onResultsChange?: (results: TestCharger) => void;
// }

// const ACTest1Grid: React.FC<ACTestGridProps> = ({
//   initialResults,
//   onResultsChange,
// }) => {
//   const [results, setResults] = useState<TestCharger>(
//     initialResults || createEmptyResults(AC_TEST_DATA.length)
//   );

//   const handleResultChange = (
//     testIndex: number,
//     itemIndex: number,
//     field: "h1" | "h2",
//     value: string
//   ) => {
//     const newResults = { ...results };

//     if (testIndex === 0) {
//       newResults.test1 = [...newResults.test1];
//       newResults.test1[itemIndex] = {
//         ...newResults.test1[itemIndex],
//         [field]: value,
//       };
//     } else if (testIndex === 1) {
//       newResults.test2 = [...newResults.test2];
//       newResults.test2[itemIndex] = {
//         ...newResults.test2[itemIndex],
//         [field]: value,
//       };
//     } else if (testIndex === 2) {
//       newResults.test3 = [...newResults.test3];
//       newResults.test3[itemIndex] = {
//         ...newResults.test3[itemIndex],
//         [field]: value,
//       };
//     }

//     setResults(newResults);
//     onResultsChange?.(newResults);
//   };

//   const handleRemarkChange = (itemIndex: number, value: string) => {
//       const newResults: TestCharger = { ...results, remarks: [...results.remarks] };
//       newResults.remarks[itemIndex] = value;
//       setResults(newResults);
//       onResultsChange?.(newResults);
//     };

//   return (
//     <div className="tw-w-full tw-overflow-x-auto">
//       <TestResultsGrid
//         title="Test Results (Record as Pass/Fail) or Numeric Results"
//         testItems={AC_TEST_DATA}
//         results={results}
//         onResultChange={handleResultChange}
//         onRemarkChange={handleRemarkChange}
//       />
//     </div>
//   );
// };

// export default ACTest1Grid;

"use client";

import React, { useState } from "react";
import { Input, Button } from "@material-tailwind/react";

interface DCTestItem {
  category: string;
  subCategory?: string;
  testName: string;
  unit?: string;
}

export interface TestCharger {
  test1: { h1: string; h2: string }[];
  test2: { h1: string; h2: string }[];
  test3: { h1: string; h2: string }[];
  remarks: string[];
}

interface TestResultsGridProps {
  title?: string;
  testItems: DCTestItem[];
  results: TestCharger;
  onResultChange: (
    testIndex: number,
    itemIndex: number,
    field: "h1" | "h2",
    value: string
  ) => void;
  onRemarkChange: (itemIndex: number, value: string) => void;
}

/* ===================== UI: Small Pass/Fail Buttons (✓/✗) ===================== */
const PassFailButtons: React.FC<{
  value: "" | "✓" | "✗";
  onChange: (v: "" | "✓" | "✗") => void;
}> = ({ value, onChange }) => {
  return (
    <div className="tw-inline-flex tw-items-center tw-gap-1 tw-border tw-rounded tw-border-gray-300 tw-bg-white tw-p-0.5 tw-shrink-0">
      <Button
        type="button"
        size="sm"
        color="green"
        variant={value === "✓" ? "filled" : "text"}
        className="tw-min-w-0 tw-h-6 tw-w-6 tw-p-0 tw-rounded tw-flex tw-items-center tw-justify-center tw-text-xs tw-shadow-none tw-border-0 tw-shrink-0"
        onClick={() => onChange(value === "✓" ? "" : "✓")}
        aria-label="Pass"
        title="Pass"
      >
        ✓
      </Button>
      <Button
        type="button"
        size="sm"
        color="red"
        variant={value === "✗" ? "filled" : "text"}
        className="tw-min-w-0 tw-h-6 tw-w-6 tw-p-0 tw-rounded tw-flex tw-items-center tw-justify-center tw-text-xs tw-shadow-none tw-border-0 tw-shrink-0"
        onClick={() => onChange(value === "✗" ? "" : "✗")}
        aria-label="Fail"
        title="Fail"
      >
        ✕
      </Button>
    </div>
  );
};

export type ChargerSafetyPayload = {
  ChargerSafety: {
    peContinuity: {
      r1: Record<
        "none" | "CPshort" | "PE_PP_cut" | "backCover" | "remoteStop" | "emergency" | "LDCp" | "LDCm" | "HDCp" | "HDCm",
        { h1: string; h2: string }
      >;
      r2: Record<
        "none" | "CPshort" | "PE_PP_cut" | "backCover" | "remoteStop" | "emergency" | "LDCp" | "LDCm" | "HDCp" | "HDCm",
        { h1: string; h2: string }
      >;
      r3: Record<
        "none" | "CPshort" | "PE_PP_cut" | "backCover" | "remoteStop" | "emergency" | "LDCp" | "LDCm" | "HDCp" | "HDCm",
        { h1: string; h2: string }
      >;
    };
    remarks: Record<string, string>;
  };
};

const TestResultsGrid: React.FC<TestResultsGridProps> = ({
  title = "Test Results (Record as Pass/Fail) or Numeric Results",
  testItems,
  results,
  onResultChange,
  onRemarkChange,
}) => {
  return (
    <div className="tw-rounded-xl tw-border tw-border-gray-200 tw-bg-white tw-shadow-sm">
      {/* ================= DESKTOP / LARGE SCREEN (TABLE VIEW) ================= */}
      <div className="tw-hidden lg:tw-block tw-overflow-x-auto">
        <div className="tw-min-w-[960px]">
          {/* Header */}
          <div className="tw-grid tw-grid-cols-[2fr_3fr_1.2fr] tw-bg-gray-100">
            <div className="tw-border-r tw-border-gray-300 tw-p-3 tw-text-center tw-font-semibold tw-text-gray-800">
              <div>Testing Checklist</div>
              <div className="tw-text-xs tw-font-medium tw-mt-1">CCS2</div>
            </div>
            <div className="tw-border-r tw-border-gray-300 tw-p-3 tw-text-center tw-font-semibold tw-text-gray-800">
              {title}
            </div>
            <div className="tw-p-3 tw-text-center tw-font-semibold tw-text-gray-800">
              Remark
            </div>
          </div>

          {/* Sub Header */}
          <div className="tw-grid tw-grid-cols-[2fr_3fr_1.2fr] tw-bg-gray-50">
            <div className="tw-border-r tw-border-gray-300" />
            <div className="tw-border-r tw-border-gray-300 tw-grid tw-grid-cols-3">
              {/* 1st TEST */}
              <div className="tw-border-r tw-border-gray-300">
                <div className="tw-p-2 tw-text-center tw-text-xs tw-font-medium tw-tracking-wide tw-text-gray-700 tw-border-b tw-border-gray-300">
                  1st TEST
                </div>
                <div className="tw-grid tw-grid-cols-2">
                  <div className="tw-border-r tw-border-gray-300 tw-p-1 tw-text-center tw-text-xs tw-text-gray-600">
                    H1
                  </div>
                  <div className="tw-p-1 tw-text-center tw-text-xs tw-text-gray-600">H2</div>
                </div>
              </div>
              {/* 2nd TEST */}
              <div className="tw-border-r tw-border-gray-300">
                <div className="tw-p-2 tw-text-center tw-text-xs tw-font-medium tw-tracking-wide tw-text-gray-700 tw-border-b tw-border-gray-300">
                  2nd TEST
                </div>
                <div className="tw-grid tw-grid-cols-2">
                  <div className="tw-border-r tw-border-gray-300 tw-p-1 tw-text-center tw-text-xs tw-text-gray-600">
                    H1
                  </div>
                  <div className="tw-p-1 tw-text-center tw-text-xs tw-text-gray-600">H2</div>
                </div>
              </div>
              {/* 3rd TEST */}
              <div>
                <div className="tw-p-2 tw-text-center tw-text-xs tw-font-medium tw-tracking-wide tw-text-gray-700 tw-border-b tw-border-gray-300">
                  3rd TEST
                </div>
                <div className="tw-grid tw-grid-cols-2">
                  <div className="tw-border-r tw-border-gray-300 tw-p-1 tw-text-center tw-text-xs tw-text-gray-600">
                    H1
                  </div>
                  <div className="tw-p-1 tw-text-center tw-text-xs tw-text-gray-600">H2</div>
                </div>
              </div>
            </div>
            <div />
          </div>

          {/* Rows */}
          {testItems.map((item, index) => {
            const isPEContinuity = item.subCategory?.includes("PE.Continuity");
            const isFirstPEItem = index === 0;

            return (
              <div
                key={index}
                className={`tw-grid tw-grid-cols-[2fr_3fr_1.2fr] tw-border-t tw-border-gray-200 ${
                  isPEContinuity ? "tw-min-h-[50px]" : "tw-min-h-[60px]"
                }`}
              >
                {/* Test Name Column */}
                <div className="tw-border-r tw-border-gray-200 tw-relative tw-bg-white">
                  {/* Charger Safety band */}
                  {isFirstPEItem && (
                    <div className="tw-absolute tw-left-0 tw-top-0 tw-w-16 tw-h-[580px] tw-bg-gray-50 tw-border-r tw-border-b tw-border-gray-200 tw-items-center tw-justify-center tw-z-10 tw-pointer-events-none tw-flex">
                      <div className="tw-transform tw--rotate-90 tw-text-xs tw-font-bold tw-text-gray-800 tw-whitespace-nowrap">
                        Charger Safety
                      </div>
                    </div>
                  )}

                  {/* Test details */}
                  <div className="tw-p-3 tw-flex tw-items-center tw-h-full tw-ml-16">
                    <div className="tw-w-full">
                      <div className="tw-flex tw-items-center tw-justify-start tw-h-full">
                        <span className="tw-text-sm tw-text-gray-800">
                          {item.testName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Test Results Columns */}
                <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-3 tw-bg-white">
                  {/* 1st Test */}
                  <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-2">
                    <div className="tw-border-r tw-border-gray-200 tw-p-2 tw-flex tw-justify-center">
                      <PassFailButtons
                        value={(results.test1[index]?.h1 as "" | "✓" | "✗") || ""}
                        onChange={(v) => onResultChange(0, index, "h1", v)}
                      />
                    </div>
                    <div className="tw-p-2 tw-flex tw-justify-center">
                      <PassFailButtons
                        value={(results.test1[index]?.h2 as "" | "✓" | "✗") || ""}
                        onChange={(v) => onResultChange(0, index, "h2", v)}
                      />
                    </div>
                  </div>

                  {/* 2nd Test */}
                  <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-2">
                    <div className="tw-border-r tw-border-gray-200 tw-p-2 tw-flex tw-justify-center">
                      <PassFailButtons
                        value={(results.test2[index]?.h1 as "" | "✓" | "✗") || ""}
                        onChange={(v) => onResultChange(1, index, "h1", v)}
                      />
                    </div>
                    <div className="tw-p-2 tw-flex tw-justify-center">
                      <PassFailButtons
                        value={(results.test2[index]?.h2 as "" | "✓" | "✗") || ""}
                        onChange={(v) => onResultChange(1, index, "h2", v)}
                      />
                    </div>
                  </div>

                  {/* 3rd Test */}
                  <div className="tw-grid tw-grid-cols-2">
                    <div className="tw-border-r tw-border-gray-200 tw-p-2 tw-flex tw-justify-center">
                      <PassFailButtons
                        value={(results.test3[index]?.h1 as "" | "✓" | "✗") || ""}
                        onChange={(v) => onResultChange(2, index, "h1", v)}
                      />
                    </div>
                    <div className="tw-p-2 tw-flex tw-justify-center">
                      <PassFailButtons
                        value={(results.test3[index]?.h2 as "" | "✓" | "✗") || ""}
                        onChange={(v) => onResultChange(2, index, "h2", v)}
                      />
                    </div>
                  </div>
                </div>

                {/* Remark Column */}
                <div className="tw-p-2 tw-bg-white">
                  <Input
                    value={results.remarks[index] || ""}
                    onChange={(e) => onRemarkChange(index, e.target.value)}
                    crossOrigin=""
                    className="!tw-border-gray-300"
                    containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= MOBILE / TABLET (TEST-GROUPED VIEW) ================= */}
      <div className="lg:tw-hidden tw-p-3 tw-space-y-6">
        {/* Global header (mobile) */}
        <div className="tw-mb-2">
          <div className="tw-text-[11px] tw-font-semibold tw-tracking-wide tw-text-gray-500 tw-uppercase">
            Testing Checklist - CCS2
          </div>
          <div className="tw-text-sm tw-font-semibold tw-text-gray-800">
            {title}
          </div>
        </div>

        {[
          { label: "1st TEST", testIndex: 0, short: "Test 1" },
          { label: "2nd TEST", testIndex: 1, short: "Test 2" },
          { label: "3rd TEST", testIndex: 2, short: "Test 3" },
        ].map(({ label, testIndex, short }) => {
          const roundNumber = testIndex + 1;
          const isFirstRound = testIndex === 0;

          return (
            <section key={label} className="tw-space-y-3">
              {/* Section header */}
              <div className="tw-flex tw-items-center tw-gap-3 tw-mb-1">
                <div className="tw-flex tw-items-center tw-gap-2">
                  <div className="tw-w-7 tw-h-7 tw-rounded-full tw-border tw-border-gray-400 tw-flex tw-items-center tw-justify-center tw-text-xs tw-font-semibold tw-text-gray-800">
                    {roundNumber}
                  </div>
                  <div className="tw-flex tw-flex-col tw-leading-tight">
                    <span className="tw-text-xs tw-font-semibold tw-text-gray-800">
                      {label}
                    </span>
                    <span className="tw-text-[11px] tw-text-gray-500">
                      Round {roundNumber} of 3
                    </span>
                  </div>
                </div>
                <span className="tw-flex-1 tw-h-px tw-bg-gray-200" />
              </div>

              {testItems.map((item, index) => {
                const currentResult =
                  testIndex === 0
                    ? results.test1[index]
                    : testIndex === 1
                    ? results.test2[index]
                    : results.test3[index];

                return (
                  <div
                    key={`${label}-${index}`}
                    className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-gray-50 tw-p-3 tw-space-y-3 tw-shadow-sm"
                  >
                    {/* Top: Category + Test name + Test badge */}
                    <div className="tw-space-y-2">
                      <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
                        {/* ซ้าย: category + test name */}
                        <div className="tw-flex-1 tw-space-y-1">
                          <div className="tw-flex tw-flex-wrap tw-gap-1">
                            {item.category && (
                              <span className="tw-inline-flex tw-items-center tw-rounded-full tw-bg-white tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-gray-700 tw-border tw-border-gray-200">
                                {item.category}
                              </span>
                            )}
                            {item.subCategory && (
                              <span className="tw-inline-flex tw-items-center tw-rounded-full tw-bg-white tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-gray-500 tw-border tw-border-gray-200">
                                {item.subCategory}
                              </span>
                            )}
                          </div>

                          <div className="tw-text-sm tw-font-medium tw-text-gray-800">
                            {item.testName}
                          </div>
                        </div>

                        {/* ขวา: Badge บอก Test รอบนี้ */}
                        <span className="tw-inline-flex tw-items-center tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-uppercase tw-text-gray-700">
                          {short}
                        </span>
                      </div>
                    </div>

                    {/* Results section for H1 & H2 */}
                    <div className="tw-space-y-2">
                      <div className="tw-rounded-md tw-bg-white tw-border tw-border-gray-200 tw-p-2">
                        <div className="tw-space-y-2">
                          {/* H1 */}
                          <div className="tw-flex tw-items-center tw-gap-2">
                            <span className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-w-8">
                              H1:
                            </span>
                            <PassFailButtons
                              value={(currentResult?.h1 as "" | "✓" | "✗") || ""}
                              onChange={(v) => onResultChange(testIndex, index, "h1", v)}
                            />
                          </div>
                          {/* H2 */}
                          <div className="tw-flex tw-items-center tw-gap-2">
                            <span className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-w-8">
                              H2:
                            </span>
                            <PassFailButtons
                              value={(currentResult?.h2 as "" | "✓" | "✗") || ""}
                              onChange={(v) => onResultChange(testIndex, index, "h2", v)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Remark: แสดงเฉพาะรอบแรก */}
                    {isFirstRound && (
                      <div className="tw-pt-1">
                        <div className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1">
                          Remark (used for Test 1–3)
                        </div>
                        <Input
                          value={results.remarks[index] || ""}
                          onChange={(e) => onRemarkChange(index, e.target.value)}
                          crossOrigin=""
                          className="!tw-border-gray-300 !tw-text-sm"
                          containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                          placeholder="Remark for this item"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
};



export const AC_TEST_DATA: DCTestItem[] = [
  // PE.Continuity protective Conductors of Charger
  {
    category: "Charger Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "None (Normal operate)",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "CP short -120 Ohm",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "PE-PP-Cut",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Back Cover",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Remote Stop",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Emergency",
    unit: "",
  },

  // LDC/HDC
  {
    category: "Charger Safety",
    subCategory: "",
    testName: "LDC +",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "",
    testName: "LDC  -",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "",
    testName: "HDC  +",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "",
    testName: "HDC  -",
    unit: "",
  },
];

/* ===================== Helpers (สร้าง payload) ===================== */

const camelKey = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+(\w)/g, (_, c) => c.toUpperCase())
    .replace(/\s+/g, "")
    .replace(/^\w/, (c) => c.toLowerCase());

/* ชื่อคีย์แบบพิเศษสำหรับ RCD/Isolation/Power standby ให้สวยและคงที่ */
const nameKey = (testName: string) => {
  const n = testName.trim();
  if (/^RCD type\s*/i.test(n)) {
    const letter = n.replace(/^RCD type\s*/i, "").trim(); // A/F/B
    return ("rcdType" + letter.toUpperCase()) as "rcdTypeA" | "rcdTypeF" | "rcdTypeB";
  }
  if (/^Isolation Transformer$/i.test(n)) return "isolationTransformer";
  if (/^Power standby$/i.test(n)) return "powerStandby";
  return camelKey(n);
};

/* แปลง remarks array → object ต่อชื่อทดสอบ */
export function buildRemarks(results: TestCharger, items: DCTestItem[]) {
  const remarks: Record<string, string> = {};
  items.forEach((it, i) => {
    remarks[nameKey(it.testName)] = results.remarks[i] ?? "";
  });
  return remarks;
}

const toPass = (v?: string) => (v === "✓" ? "pass" : (v ?? ""));

/* ตัวแปลงหลัก → payload แนะนำสำหรับ Mongo (แยกรอบชัดเจน) */
export function mapToChargerPayload(results: TestCharger, items: DCTestItem[] = AC_TEST_DATA): ChargerSafetyPayload {
  const findIndex = (name: string) => items.findIndex((it) => it.testName.toLowerCase() === name.toLowerCase());

  const iNone = findIndex("None (Normal operate)");
  const iCP = findIndex("CP short -120 Ohm");
  const iPE = findIndex("PE-PP-Cut");
  const iBack = findIndex("Back Cover");
  const iRemote = findIndex("Remote Stop");
  const iEmer = findIndex("Emergency");
  const iLDCp = findIndex("LDC +");
  const iLDCm = findIndex("LDC -");
  const iHDCp = findIndex("HDC +");
  const iHDCm = findIndex("HDC -");

  const t1 = results.test1;
  const t2 = results.test2;
  const t3 = results.test3;

  const V = (t: { h1: string; h2: string }[], i: number) => ({
    h1: i >= 0 ? t[i]?.h1 ?? "" : "",
    h2: i >= 0 ? toPass(t[i]?.h2) : "", // ใช้ h2 เป็น pass/fail เช่นเดิม
  });

  const peContinuity = {
    r1: {
      none: V(t1, iNone),
      CPshort: V(t1, iCP),
      PE_PP_cut: V(t1, iPE),
      backCover: V(t1, iBack),
      remoteStop: V(t1, iRemote),
      emergency: V(t1, iEmer),
      LDCp: V(t1, iLDCp),
      LDCm: V(t1, iLDCm),
      HDCp: V(t1, iHDCp),
      HDCm: V(t1, iHDCm),
    },
    r2: {
      none: V(t2, iNone),
      CPshort: V(t2, iCP),
      PE_PP_cut: V(t2, iPE),
      backCover: V(t2, iBack),
      remoteStop: V(t2, iRemote),
      emergency: V(t2, iEmer),
      LDCp: V(t2, iLDCp),
      LDCm: V(t2, iLDCm),
      HDCp: V(t2, iHDCp),
      HDCm: V(t2, iHDCm),
    },
    r3: {
      none: V(t3, iNone),
      CPshort: V(t3, iCP),
      PE_PP_cut: V(t3, iPE),
      backCover: V(t3, iBack),
      remoteStop: V(t3, iRemote),
      emergency: V(t3, iEmer),
      LDCp: V(t3, iLDCp),
      LDCm: V(t3, iLDCm),
      HDCp: V(t3, iHDCp),
      HDCm: V(t3, iHDCm),
    },
  } as ChargerSafetyPayload["ChargerSafety"]["peContinuity"];

  const remarks = buildRemarks(results, items);

  return {
    ChargerSafety: {
      peContinuity,
      remarks,
    },
  };
}

const createEmptyResults = (itemCount: number): TestCharger => ({
  test1: new Array(itemCount).fill(null).map(() => ({ h1: "", h2: "" })),
  test2: new Array(itemCount).fill(null).map(() => ({ h1: "", h2: "" })),
  test3: new Array(itemCount).fill(null).map(() => ({ h1: "", h2: "" })),
  remarks: new Array(itemCount).fill(""),
});

interface ACTestGridProps {
  initialResults?: TestCharger;
  onResultsChange?: (results: TestCharger) => void;
}

const ACTest1Grid: React.FC<ACTestGridProps> = ({
  initialResults,
  onResultsChange,
}) => {
  const [results, setResults] = useState<TestCharger>(
    initialResults || createEmptyResults(AC_TEST_DATA.length)
  );

  const handleResultChange = (
    testIndex: number,
    itemIndex: number,
    field: "h1" | "h2",
    value: string
  ) => {
    const newResults = { ...results };

    if (testIndex === 0) {
      newResults.test1 = [...newResults.test1];
      newResults.test1[itemIndex] = {
        ...newResults.test1[itemIndex],
        [field]: value,
      };
    } else if (testIndex === 1) {
      newResults.test2 = [...newResults.test2];
      newResults.test2[itemIndex] = {
        ...newResults.test2[itemIndex],
        [field]: value,
      };
    } else if (testIndex === 2) {
      newResults.test3 = [...newResults.test3];
      newResults.test3[itemIndex] = {
        ...newResults.test3[itemIndex],
        [field]: value,
      };
    }

    setResults(newResults);
    onResultsChange?.(newResults);
  };

  const handleRemarkChange = (itemIndex: number, value: string) => {
    const newResults: TestCharger = { ...results, remarks: [...results.remarks] };
    newResults.remarks[itemIndex] = value;
    setResults(newResults);
    onResultsChange?.(newResults);
  };

  return (
    <div className="tw-w-full tw-overflow-x-auto">
      <TestResultsGrid
        title="Test Results (Record as Pass/Fail) or Numeric Results"
        testItems={AC_TEST_DATA}
        results={results}
        onResultChange={handleResultChange}
        onRemarkChange={handleRemarkChange}
      />
    </div>
  );
};

export default ACTest1Grid;

