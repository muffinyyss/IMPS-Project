"use client";

import React, { useState } from "react";
import { Input, Button } from "@material-tailwind/react";

/* ===================== Types ===================== */

export interface ACTestItem {
  category: string;
  subCategory?: string;
  testName: string;
  unit?: string;
}

export interface TestResults {
  test1: { h1: string; result: string }[];
  test2: { h1: string; result: string }[];
  test3: { h1: string; result: string }[];
  rcdValues: string[];
  remarks: string[]; // ← remark ต่อแถว เก็บตาม index ของ testItems
}

interface TestResultsGridProps {
  title?: string;
  testItems: ACTestItem[];
  results: TestResults;
  onResultChange: (
    testIndex: number,
    itemIndex: number,
    field: "h1" | "result",
    value: string
  ) => void;
  onRcdChange: (itemIndex: number, value: string) => void;
  onRemarkChange: (itemIndex: number, value: string) => void;
}

/* payload แบบแนะนำสำหรับ Mongo (รอบละชุด + ส่วนอื่น ๆ) */
export type ElectricalSafetyPayload = {
  electricalSafety: {
    peContinuity: {
      r1: Record<
        "leftCover" | "rightCover" | "frontCover" | "backCover" | "chargerStand" | "chargerCase",
        { h1: string; result: string }
      >;
      r2: Record<
        "leftCover" | "rightCover" | "frontCover" | "backCover" | "chargerStand" | "chargerCase",
        { h1: string; result: string }
      >;
      r3: Record<
        "leftCover" | "rightCover" | "frontCover" | "backCover" | "chargerStand" | "chargerCase",
        { h1: string; result: string }
      >;
    };
    rcd: {
      typeA: { value: string; unit: "mA" };
      typeF: { value: string; unit: "mA" };
      typeB: { value: string; unit: "mA" };
    };
    isolationTransformer: { pass: boolean };
    powerStandby: { L1: string; L2: string; L3: string };
    remarks: Record<string, string>;
  };
};

/* ===================== UI: Small Pass/Fail Buttons (contained) ===================== */
/** ปุ่มคู่ ✓/✕ อยู่ในกล่องของตัวเอง (ไม่ชนกรอบตาราง) */
export const PassFailButtons: React.FC<{
  value: string;                 // "", "✓", "✗"
  onChange: (v: string) => void; // set "", "✓", "✗"
}> = ({ value, onChange }) => {
  return (
    <div className="tw-inline-flex tw-items-center tw-gap-1 tw-border tw-rounded tw-border-gray-300 tw-bg-white tw-p-0.5 tw-shrink-0">
      <Button
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

/* ===================== UI: Grid ===================== */

const TestResultsGrid: React.FC<TestResultsGridProps> = ({
  title = "Test Results (Record as Pass/Fail) or Numeric Results",
  testItems,
  results,
  onResultChange,
  onRcdChange,
  onRemarkChange,
}) => {
  return (
    <div className="tw-border tw-border-gray-800 tw-bg-white">
      {/* Header */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-[2fr_3fr_1fr] tw-bg-gray-100">
        <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold">
          Testing Checklist
        </div>
        <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold md:tw-block tw-hidden">
          {title}
        </div>
        <div className="tw-p-3 tw-text-center tw-font-semibold md:tw-block tw-hidden">
          Remark
        </div>
        {/* Mobile header */}
        <div className="tw-border-t tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold md:tw-hidden">
          {title}
        </div>
        <div className="tw-border-t tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold md:tw-hidden">
          Remark
        </div>
      </div>

      {/* Sub Header */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-[2fr_3fr_1fr] tw-bg-gray-50">
        <div className="tw-border-r tw-border-gray-800"></div>
        <div className="tw-border-r tw-border-gray-800 tw-grid tw-grid-cols-1 md:tw-grid-cols-3">
          <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800 tw-p-2 tw-text-center tw-font-medium">
            1st TEST
          </div>
          <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800 tw-p-2 tw-text-center tw-font-medium">
            2nd TEST
          </div>
          <div className="tw-p-2 tw-text-center tw-font-medium">3rd TEST</div>
        </div>
        <div className="md:tw-block tw-hidden"></div>
      </div>

      {/* Test Items */}
      {testItems.map((item, index) => {
        const isPowerStandby = item.testName.includes("Power standby");
        const isPEContinuity = item.subCategory?.includes("PE.Continuity");
        const isFirstPEItem = index === 0;
        const isRCDItem = item.testName.includes("RCD");
        const isIsolationTransformer = item.testName.includes("Isolation Transformer");

        return (
          <div
            key={index}
            className={`tw-grid tw-grid-cols-1 md:tw-grid-cols-[2fr_3fr_1fr] tw-border-t tw-border-gray-800 ${isPEContinuity ? "tw-min-h-[50px]" : "tw-min-h-[60px]"
              }`}
          >
            {/* Test Name Column */}
            <div className="tw-border-r tw-border-gray-800 tw-relative tw-bg-white">
              {/* Electrical Safety - band on left */}
              {isFirstPEItem && (
                <>
                  {/* กล่องซ้ายช่องที่ 1 */}
                  <div
                    className="tw-absolute tw-left-0 tw-top-0 tw-w-16 tw-h-[600px]
                      tw-bg-gray-50
                      tw-border-r tw-border-b tw-border-gray-800
                      tw-items-center tw-justify-center tw-z-10 tw-hidden md:tw-flex
                      tw-pointer-events-none">
                    <div className="tw-transform tw--rotate-90 tw-text-sm tw-font-bold tw-text-gray-800 tw-whitespace-nowrap">
                      Electrical Safety
                    </div>
                  </div>

                  {/* กล่องซ้ายช่องที่ 2 */}
                  <div
                    className="tw-absolute tw-left-16 tw-top-0 tw-w-32 tw-h-[300px]
                 tw-bg-gray-100
                 tw-border-r tw-border-b tw-border-gray-800
                 tw-items-center tw-justify-center tw-z-10 tw-hidden md:tw-flex
                 tw-pointer-events-none"
                  >
                    <div className="tw-text-xs tw-font-semibold tw-text-gray-700 tw-text-center tw-leading-tight tw-px-2">
                      PE.Continuity protective Conductors of Charger
                    </div>
                  </div>
                </>
              )}

              {/* Mobile category label */}
              <div className="tw-block md:tw-hidden tw-bg-gray-100 tw-px-3 tw-py-1 tw-text-xs tw-font-medium tw-text-gray-700 tw-text-center">
                {isPEContinuity ? "PE Continuity" : item.category}
              </div>

              {/* Test details */}
              <div
                className={`tw-p-2 md:tw-p-3 tw-flex tw-items-center tw-h-full ${isPEContinuity ? "md:tw-ml-48 tw-ml-0" : "md:tw-ml-16 tw-ml-0"
                  }`}
              >
                <div className="tw-w-full">
                  {isRCDItem ? (
                    /* RCD: name + input + unit */
                    <div className="tw-flex tw-items-center tw-justify-center tw-gap-3 tw-h-full tw-text-center">
                      <span className="tw-text-sm tw-text-gray-800">{item.testName}</span>
                      <Input
                        value={results.rcdValues[index] || ""}
                        onChange={(e) => onRcdChange(index, e.target.value)}
                        crossOrigin=""
                        className="!tw-text-center !tw-border-gray-300"
                        containerProps={{ className: "!tw-min-w-0 !tw-w-20 !tw-h-8" }}
                        placeholder=""
                      />
                      {item.unit && (
                        <span className="tw-text-sm tw-font-medium tw-text-gray-600 tw-border tw-border-gray-300 tw-px-2 tw-py-1 tw-rounded">
                          {item.unit}
                        </span>
                      )}
                    </div>
                  ) : isIsolationTransformer ? (
                    /* Isolation Transformer: name + ปุ่มในกล่อง (ไม่ชนตาราง) */
                    <div className="tw-flex tw-items-center tw-justify-center tw-gap-3 tw-h-full">
                      <span className="tw-text-sm tw-text-gray-800">{item.testName}</span>
                      <PassFailButtons
                        value={results.rcdValues[index] || ""}
                        onChange={(v) => onRcdChange(index, v)}
                      />
                    </div>
                  ) : (
                    /* Normal */
                    <div className="tw-flex tw-items-center tw-justify-center tw-h-full">
                      <span className="tw-text-sm tw-text-gray-800">{item.testName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Results Columns */}
            <div className="tw-border-r tw-border-gray-800 tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-bg-white">
              {isPowerStandby ? (
                /* Power standby: L1/L2/L3 ใช้เป็นเฟส ไม่ใช่รอบ */
                <>
                  <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800 tw-p-2 tw-flex tw-items-center tw-gap-1">
                    <span className="tw-text-xs tw-text-gray-600">L1=</span>
                    <Input
                      value={results.test1[index]?.h1 || ""}
                      onChange={(e) => onResultChange(0, index, "h1", e.target.value)}
                      crossOrigin=""
                      className="!tw-text-center !tw-border-gray-300 !tw-text-xs"
                      containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                    />
                    <span className="tw-text-xs tw-text-gray-600">A</span>
                  </div>
                  <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800 tw-p-2 tw-flex tw-items-center tw-gap-1">
                    <span className="tw-text-xs tw-text-gray-600">L2=</span>
                    <Input
                      value={results.test2[index]?.h1 || ""}
                      onChange={(e) => onResultChange(1, index, "h1", e.target.value)}
                      crossOrigin=""
                      className="!tw-text-center !tw-border-gray-300 !tw-text-xs"
                      containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                    />
                    <span className="tw-text-xs tw-text-gray-600">A</span>
                  </div>
                  <div className="tw-p-2 tw-flex tw-items-center tw-gap-1">
                    <span className="tw-text-xs tw-text-gray-600">L3=</span>
                    <Input
                      value={results.test3[index]?.h1 || ""}
                      onChange={(e) => onResultChange(2, index, "h1", e.target.value)}
                      crossOrigin=""
                      className="!tw-text-center !tw-border-gray-300 !tw-text-xs"
                      containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                    />
                    <span className="tw-text-xs tw-text-gray-600">A</span>
                  </div>
                </>
              ) : (
                /* รอบ 1/2/3 – จัดเป็น 2 คอลัมน์คงที่: ค่า | ปุ่ม */
                <>
                  {/* 1st */}
                  <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800 tw-grid tw-grid-cols-[1fr_auto] tw-items-center">
                    <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-col-span-2 tw-py-1">
                      1st TEST
                    </div>
                    <div className="tw-border-r tw-border-gray-800 tw-p-2">
                      <Input
                        value={results.test1[index]?.h1 || ""}
                        onChange={(e) => onResultChange(0, index, "h1", e.target.value)}
                        crossOrigin=""
                        className="!tw-text-center !tw-border-gray-300"
                        containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                        placeholder=""
                      />
                    </div>
                    <div className="tw-p-2 tw-flex tw-justify-center">
                      <PassFailButtons
                        value={results.test1[index]?.result || ""}
                        onChange={(v) => onResultChange(0, index, "result", v)}
                      />
                    </div>
                  </div>

                  {/* 2nd */}
                  <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800 tw-grid tw-grid-cols-[1fr_auto] tw-items-center">
                    <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-col-span-2 tw-py-1">
                      2nd TEST
                    </div>
                    <div className="tw-border-r tw-border-gray-800 tw-p-2">
                      <Input
                        value={results.test2[index]?.h1 || ""}
                        onChange={(e) => onResultChange(1, index, "h1", e.target.value)}
                        crossOrigin=""
                        className="!tw-text-center !tw-border-gray-300"
                        containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                        placeholder=""
                      />
                    </div>
                    <div className="tw-p-2 tw-flex tw-justify-center">
                      <PassFailButtons
                        value={results.test2[index]?.result || ""}
                        onChange={(v) => onResultChange(1, index, "result", v)}
                      />
                    </div>
                  </div>

                  {/* 3rd */}
                  <div className="tw-grid tw-grid-cols-[1fr_auto] tw-items-center">
                    <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-col-span-2 tw-py-1">
                      3rd TEST
                    </div>
                    <div className="tw-border-r tw-border-gray-800 tw-p-2">
                      <Input
                        value={results.test3[index]?.h1 || ""}
                        onChange={(e) => onResultChange(2, index, "h1", e.target.value)}
                        crossOrigin=""
                        className="!tw-text-center !tw-border-gray-300"
                        containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                        placeholder=""
                      />
                    </div>
                    <div className="tw-p-2 tw-flex tw-justify-center">
                      <PassFailButtons
                        value={results.test3[index]?.result || ""}
                        onChange={(v) => onResultChange(2, index, "result", v)}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Remark Column */}
            <div className="tw-p-2 tw-bg-white">
              <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-1 tw-py-1">Remark</div>
              <Input
                value={results.remarks[index] || ""}
                onChange={(e) => onRemarkChange(index, e.target.value)}
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ===================== Data (รายการทดสอบ) ===================== */

export const AC_TEST_DATA: ACTestItem[] = [
  { category: "Electrical Safety", subCategory: "PE.Continuity protective Conductors of Charger", testName: "Left Cover", unit: "" },
  { category: "Electrical Safety", subCategory: "PE.Continuity protective Conductors of Charger", testName: "Right Cover", unit: "" },
  { category: "Electrical Safety", subCategory: "PE.Continuity protective Conductors of Charger", testName: "Front Cover", unit: "" },
  { category: "Electrical Safety", subCategory: "PE.Continuity protective Conductors of Charger", testName: "Back Cover", unit: "" },
  { category: "Electrical Safety", subCategory: "PE.Continuity protective Conductors of Charger", testName: "Pin PE H.1", unit: "" },
  { category: "Electrical Safety", subCategory: "PE.Continuity protective Conductors of Charger", testName: "Pin PE H.2", unit: "" },
  { category: "Electrical Safety", subCategory: "", testName: "RCD type A", unit: "mA" },
  { category: "Electrical Safety", subCategory: "", testName: "RCD type F", unit: "mA" },
  { category: "Electrical Safety", subCategory: "", testName: "RCD type B", unit: "mA" },
  { category: "Electrical Safety", subCategory: "", testName: "Isolation Transformer", unit: "" },
  { category: "Electrical Safety", subCategory: "", testName: "Power standby", unit: "" },
];

/* ===================== Helpers (สร้าง payload) ===================== */

const camelKey = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+(\w)/g, (_, c) => c.toUpperCase())
    .replace(/\s+/g, "")
    .replace(/^\w/, (c) => c.toLowerCase());

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

export function buildRemarks(results: TestResults, items: ACTestItem[]) {
  const remarks: Record<string, string> = {};
  items.forEach((it, i) => {
    remarks[nameKey(it.testName)] = results.remarks[i] ?? "";
  });
  return remarks;
}

const toPass = (v?: string) => (v === "✓" ? "pass" : (v ?? ""));

export function mapToElectricalPayload(results: TestResults, items: ACTestItem[] = AC_TEST_DATA): ElectricalSafetyPayload {
  const findIndex = (name: string) => items.findIndex((it) => it.testName.toLowerCase() === name.toLowerCase());

  const iLeft = findIndex("Left Cover");
  const iRight = findIndex("Right Cover");
  const iFront = findIndex("Front Cover");
  const iBack = findIndex("Back Cover");
  const iStand = findIndex("Charger Stand");
  const iCase = findIndex("Charger Case");

  const t1 = results.test1;
  const t2 = results.test2;
  const t3 = results.test3;

  const V = (t: { h1: string; result: string }[], i: number) => ({
    h1: i >= 0 ? t[i]?.h1 ?? "" : "",
    result: i >= 0 ? toPass(t[i]?.result) : "",
  });

  const peContinuity = {
    r1: {
      leftCover: V(t1, iLeft),
      rightCover: V(t1, iRight),
      frontCover: V(t1, iFront),
      backCover: V(t1, iBack),
      chargerStand: V(t1, iStand),
      chargerCase: V(t1, iCase),
    },
    r2: {
      leftCover: V(t2, iLeft),
      rightCover: V(t2, iRight),
      frontCover: V(t2, iFront),
      backCover: V(t2, iBack),
      chargerStand: V(t2, iStand),
      chargerCase: V(t2, iCase),
    },
    r3: {
      leftCover: V(t3, iLeft),
      rightCover: V(t3, iRight),
      frontCover: V(t3, iFront),
      backCover: V(t3, iBack),
      chargerStand: V(t3, iStand),
      chargerCase: V(t3, iCase),
    },
  } as ElectricalSafetyPayload["electricalSafety"]["peContinuity"];

  const iRcdA = findIndex("RCD type A");
  const iRcdF = findIndex("RCD type F");
  const iRcdB = findIndex("RCD type B");
  const rcd = {
    typeA: { value: iRcdA >= 0 ? results.rcdValues[iRcdA] || "" : "", unit: "mA" as const },
    typeF: { value: iRcdF >= 0 ? results.rcdValues[iRcdF] || "" : "", unit: "mA" as const },
    typeB: { value: iRcdB >= 0 ? results.rcdValues[iRcdB] || "" : "", unit: "mA" as const },
  };

  const iIso = findIndex("Isolation Transformer");
  const isolationTransformer = { pass: iIso >= 0 ? results.rcdValues[iIso] === "✓" : false };

  const iPsb = findIndex("Power standby");
  const powerStandby =
    iPsb >= 0
      ? { L1: results.test1[iPsb]?.h1 ?? "", L2: results.test2[iPsb]?.h1 ?? "", L3: results.test3[iPsb]?.h1 ?? "" }
      : { L1: "", L2: "", L3: "" };

  const remarks = buildRemarks(results, items);

  return {
    electricalSafety: {
      peContinuity,
      rcd,
      isolationTransformer,
      powerStandby,
      remarks,
    },
  };
}

/* ===================== Internal: state factory ===================== */

const createEmptyResults = (itemCount: number): TestResults => ({
  test1: new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" })),
  test2: new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" })),
  test3: new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" })),
  rcdValues: new Array(itemCount).fill(""),
  remarks: new Array(itemCount).fill(""),
});

/* ===================== Component (export default) ===================== */

export interface ACTestGridProps {
  initialResults?: TestResults;
  onResultsChange?: (results: TestResults) => void;
}

const ACTest1Grid: React.FC<ACTestGridProps> = ({ initialResults, onResultsChange }) => {
  const [results, setResults] = useState<TestResults>(initialResults || createEmptyResults(AC_TEST_DATA.length));

  const handleResultChange = (
    testIndex: number,
    itemIndex: number,
    field: "h1" | "result",
    value: string
  ) => {
    const newResults = { ...results };
    if (testIndex === 0) {
      newResults.test1 = [...newResults.test1];
      newResults.test1[itemIndex] = { ...newResults.test1[itemIndex], [field]: value };
    } else if (testIndex === 1) {
      newResults.test2 = [...newResults.test2];
      newResults.test2[itemIndex] = { ...newResults.test2[itemIndex], [field]: value };
    } else if (testIndex === 2) {
      newResults.test3 = [...newResults.test3];
      newResults.test3[itemIndex] = { ...newResults.test3[itemIndex], [field]: value };
    }
    setResults(newResults);
    onResultsChange?.(newResults);
  };

  const handleRcdChange = (itemIndex: number, value: string) => {
    const newResults: TestResults = { ...results, rcdValues: [...results.rcdValues] };
    newResults.rcdValues[itemIndex] = value;
    setResults(newResults);
    onResultsChange?.(newResults);
  };

  const handleRemarkChange = (itemIndex: number, value: string) => {
    const newResults: TestResults = { ...results, remarks: [...results.remarks] };
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
        onRcdChange={handleRcdChange}
        onRemarkChange={handleRemarkChange}
      />
    </div>
  );
};

export default ACTest1Grid;
