"use client";

import React, { useState } from "react";
import { Input, Button } from "@material-tailwind/react";

interface ACTestItem {
  category: string;
  subCategory?: string;
  testName: string;
  type2?: string;
  unit?: string;
}

export interface TestCharger {
  test1: { h1: string; result: string }[];
  test2: { h1: string; result: string }[];
  test3: { h1: string; result: string }[];
  type2Values: string[];
  remarks: string[];
}

interface TestResultsGridProps {
  title?: string;
  testItems: ACTestItem[];
  results: TestCharger;
  onResultChange: (testIndex: number, itemIndex: number, field: 'h1' | 'result', value: string) => void;
  onType2Change: (itemIndex: number, value: string) => void;
  onRemarkChange: (itemIndex: number, value: string) => void;
}

export type ChargerSafetyPayload = {
  electricalSafety: {
    peContinuity: {
      r1: Record<
        "continuityPE" | "insulationCable" | "stateA" | "stateB" | "stateC" | "CPShort" | "PECut",
        { h1: string; result: string }
      >;
      r2: Record<
        "continuityPE" | "insulationCable" | "stateA" | "stateB" | "stateC" | "CPShort" | "PECut",
        { h1: string; result: string }
      >;
      r3: Record<
        "continuityPE" | "insulationCable" | "stateA" | "stateB" | "stateC" | "CPShort" | "PECut",
        { h1: string; result: string }
      >;
    };
    rcd: {
      typeA: { value: string; unit: "mA" };
      typeF: { value: string; unit: "mA" };
      typeB: { value: string; unit: "mA" };
      DD: { value: string; unit: "mA" };
    };
    remarks: Record<string, string>;
  };
};

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

const TestResultsGrid: React.FC<TestResultsGridProps> = ({
  title = "Test Results (Record as Pass/Fail) or Numeric Results",
  testItems,
  results,
  onResultChange,
  onType2Change,
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
              <div className="tw-text-xs tw-font-medium tw-mt-1">Type 2</div>
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
                    H.1
                  </div>
                  <div className="tw-p-1 tw-text-center tw-text-xs tw-text-gray-600">
                    Result
                  </div>
                </div>
              </div>
              {/* 2nd TEST */}
              <div className="tw-border-r tw-border-gray-300">
                <div className="tw-p-2 tw-text-center tw-text-xs tw-font-medium tw-tracking-wide tw-text-gray-700 tw-border-b tw-border-gray-300">
                  2nd TEST
                </div>
                <div className="tw-grid tw-grid-cols-2">
                  <div className="tw-border-r tw-border-gray-300 tw-p-1 tw-text-center tw-text-xs tw-text-gray-600">
                    H.1
                  </div>
                  <div className="tw-p-1 tw-text-center tw-text-xs tw-text-gray-600">
                    Result
                  </div>
                </div>
              </div>
              {/* 3rd TEST */}
              <div>
                <div className="tw-p-2 tw-text-center tw-text-xs tw-font-medium tw-tracking-wide tw-text-gray-700 tw-border-b tw-border-gray-300">
                  3rd TEST
                </div>
                <div className="tw-grid tw-grid-cols-2">
                  <div className="tw-border-r tw-border-gray-300 tw-p-1 tw-text-center tw-text-xs tw-text-gray-600">
                    H.1
                  </div>
                  <div className="tw-p-1 tw-text-center tw-text-xs tw-text-gray-600">
                    Result
                  </div>
                </div>
              </div>
            </div>
            <div />
          </div>

          {/* Rows */}
          {testItems.map((item, index) => {
            const isPEContinuity = item.subCategory?.includes("PE.Continuity");
            const isFirstPEItem = index === 0;
            const isRDCItem =
              /^RCD type\s*(A|F|B)$/i.test(item.testName) ||
              /^RD[CD][-\s]?DD$/i.test(item.testName);

            return (
              <div
                key={index}
                className="tw-grid tw-grid-cols-[2fr_3fr_1.2fr] tw-border-t tw-border-gray-200 tw-min-h-[70px]"
              >
                {/* Test Name Column */}
                <div className="tw-border-r tw-border-gray-200 tw-relative tw-bg-white">
                  {/* Charger Safety band */}
                  {isFirstPEItem && (
                    <div className="tw-absolute tw-left-0 tw-top-0 tw-w-16 tw-h-[770px] tw-bg-gray-50 tw-border-r tw-border-b tw-border-gray-200 tw-items-center tw-justify-center tw-z-10 tw-pointer-events-none tw-flex">
                      <div className="tw-transform tw--rotate-90 tw-text-xs tw-font-bold tw-text-gray-800 tw-whitespace-nowrap">
                        Charger Safety
                      </div>
                    </div>
                  )}

                  {/* Test details */}
                  <div className="tw-p-3 tw-flex tw-items-center tw-h-full tw-ml-16">
                    <div className="tw-w-full">
                      {isRDCItem ? (
                        // RDC/RCD: name + input + unit
                        <div className="tw-flex tw-items-center tw-justify-center tw-gap-3 tw-h-full tw-text-center">
                          <span className="tw-text-sm tw-text-gray-800">{item.testName}</span>
                          <Input
                            value={results.type2Values[index] || ""}
                            onChange={(e) => onType2Change(index, e.target.value)}
                            crossOrigin=""
                            className="!tw-text-center !tw-border-gray-300 !tw-text-sm"
                            containerProps={{ className: "!tw-min-w-0 !tw-w-20 !tw-h-8" }}
                          />
                          <span className="tw-text-xs tw-font-medium tw-text-gray-600 tw-border tw-border-gray-300 tw-px-2 tw-py-1 tw-rounded">
                            mA
                          </span>
                        </div>
                      ) : (
                        // Normal: just name
                        <div className="tw-flex tw-items-center tw-justify-center tw-h-full">
                          <span className="tw-text-sm tw-text-gray-800">{item.testName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Test Results Columns */}
                <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-3 tw-bg-white">
                  {/* 1st Test */}
                  <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-2">
                    <div className="tw-border-r tw-border-gray-200 tw-p-2">
                      <Input
                        value={results.test1[index]?.h1 || ""}
                        onChange={(e) => onResultChange(0, index, "h1", e.target.value)}
                        crossOrigin=""
                        className="!tw-text-center !tw-border-gray-300"
                        containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                      />
                    </div>
                    <div className="tw-p-2 tw-flex tw-justify-center tw-items-center">
                      <PassFailButtons
                        value={results.test1[index]?.result || ""}
                        onChange={(v) => onResultChange(0, index, "result", v)}
                      />
                    </div>
                  </div>

                  {/* 2nd Test */}
                  <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-2">
                    <div className="tw-border-r tw-border-gray-200 tw-p-2">
                      <Input
                        value={results.test2[index]?.h1 || ""}
                        onChange={(e) => onResultChange(1, index, "h1", e.target.value)}
                        crossOrigin=""
                        className="!tw-text-center !tw-border-gray-300"
                        containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                      />
                    </div>
                    <div className="tw-p-2 tw-flex tw-justify-center tw-items-center">
                      <PassFailButtons
                        value={results.test2[index]?.result || ""}
                        onChange={(v) => onResultChange(1, index, "result", v)}
                      />
                    </div>
                  </div>

                  {/* 3rd Test */}
                  <div className="tw-grid tw-grid-cols-2">
                    <div className="tw-border-r tw-border-gray-200 tw-p-2">
                      <Input
                        value={results.test3[index]?.h1 || ""}
                        onChange={(e) => onResultChange(2, index, "h1", e.target.value)}
                        crossOrigin=""
                        className="!tw-text-center !tw-border-gray-300"
                        containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                      />
                    </div>
                    <div className="tw-p-2 tw-flex tw-justify-center tw-items-center">
                      <PassFailButtons
                        value={results.test3[index]?.result || ""}
                        onChange={(v) => onResultChange(2, index, "result", v)}
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
        {/* Global header */}
        <div className="tw-mb-2">
          <div className="tw-text-[11px] tw-font-semibold tw-tracking-wide tw-text-gray-500 tw-uppercase">
            Testing Checklist - Type 2
          </div>
          <div className="tw-text-sm tw-font-semibold tw-text-gray-800">{title}</div>
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
                const isRDCItem =
                  /^RCD type\s*(A|F|B)$/i.test(item.testName) ||
                  /^RD[CD][-\s]?DD$/i.test(item.testName);

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
                        {/* Left: category + test name */}
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

                        {/* Right: Test badge */}
                        <span className="tw-inline-flex tw-items-center tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-uppercase tw-text-gray-700">
                          {short}
                        </span>
                      </div>

                      {/* RDC/RCD control - แสดงเฉพาะรอบแรก */}
                      {isRDCItem && isFirstRound && (
                        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-pt-1">
                          <span className="tw-text-[11px] tw-font-medium tw-text-gray-700">
                            RCD/RDC value
                          </span>
                          <Input
                            value={results.type2Values[index] || ""}
                            onChange={(e) => onType2Change(index, e.target.value)}
                            crossOrigin=""
                            className="!tw-text-center !tw-border-gray-300 !tw-text-sm"
                            containerProps={{ className: "!tw-min-w-0 !tw-w-24 !tw-h-8" }}
                            placeholder="mA"
                          />
                          <span className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-border tw-border-gray-300 tw-px-2 tw-py-0.5 tw-rounded">
                            mA
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Results section for H.1 & Result */}
                    <div className="tw-space-y-2">
                      <div className="tw-rounded-md tw-bg-white tw-border tw-border-gray-200 tw-p-2">
                        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-stretch sm:tw-items-center tw-gap-2">
                          <div className="tw-flex-1">
                            <div className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1">
                              H.1 Value
                            </div>
                            <Input
                              value={currentResult?.h1 || ""}
                              onChange={(e) =>
                                onResultChange(testIndex, index, "h1", e.target.value)
                              }
                              crossOrigin=""
                              className="!tw-text-center !tw-border-gray-300 !tw-text-xs"
                              containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                              placeholder={`${short} H.1 value`}
                            />
                          </div>
                          <div className="tw-flex tw-flex-col tw-items-start sm:tw-items-center">
                            <div className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1">
                              Result
                            </div>
                            <PassFailButtons
                              value={currentResult?.result || ""}
                              onChange={(v) => onResultChange(testIndex, index, "result", v)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Remark - แสดงเฉพาะรอบแรก */}
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

export const AC_TEST2_DATA: ACTestItem[] = [
  {
    category: "Charger Safety",
    testName: "Continuity PE",
    type2: ""
  },
  {
    category: "Charger Safety",
    testName: "Insulation Cable",
    type2: ""
  },
  {
    category: "Charger Safety",
    testName: "State A",
    type2: ""
  },
  {
    category: "Charger Safety",
    testName: "State B",
    type2: ""
  },
  {
    category: "Charger Safety",
    testName: "State C",
    type2: ""
  },
  {
    category: "Charger Safety",
    testName: "CP Short",
    type2: ""
  },
  {
    category: "Charger Safety",
    testName: "PE Cut",
    type2: ""
  },
  {
    category: "Charger Safety",
    testName: "RCD type A",
    type2: ""
  },
  {
    category: "Charger Safety",
    testName: "RCD type F",
    type2: ""
  },
  {
    category: "Charger Safety",
    testName: "RCD type B",
    type2: ""
  },
  {
    category: "Charger Safety",
    testName: "RDC-DD",
    type2: ""
  }
];


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
  if (/^RD[CD][-\s]?DD$/i.test(n)) return "DD"; // ← snake_case
  return camelKey(n);
};

/* แปลง remarks array → object ต่อชื่อทดสอบ */
export function buildRemarks(results: TestCharger, items: ACTestItem[]) {
  const remarks: Record<string, string> = {};
  items.forEach((it, i) => {
    remarks[nameKey(it.testName)] = results.remarks[i] ?? "";
  });
  return remarks;
}

const toPass = (v?: string) => (v === "✓" ? "pass" : (v ?? ""));

export function mapToChargerPayload(results: TestCharger, items: ACTestItem[] = AC_TEST2_DATA): ChargerSafetyPayload {
  // index ค้นหาตามชื่อ จะได้ไม่ผูก index ตายตัว
  const findIndex = (name: string) => items.findIndex((it) => it.testName.toLowerCase() === name.toLowerCase());

  // 6 แถวแรกของ PE (ตามสเปกชุดนี้คงที่ชื่อ)
  const iContinuity = findIndex("Continuity PE");
  const iInsulation = findIndex("Insulation Cable");
  const iStateA = findIndex("State A");
  const iStateB = findIndex("State B");
  const iStateC = findIndex("State C");
  const iCPShort = findIndex("CP Short");
  const iPECut = findIndex("PE Cut");

  const t1 = results.test1;
  const t2 = results.test2;
  const t3 = results.test3;

  const V = (t: { h1: string; result: string }[], i: number) => ({
    h1: i >= 0 ? t[i]?.h1 ?? "" : "",
    result: i >= 0 ? toPass(t[i]?.result) : "",   // ← จุดสำคัญ
  });

  const peContinuity = {
    r1: {
      continuityPE: V(t1, iContinuity),
      insulationCable: V(t1, iInsulation),
      stateA: V(t1, iStateA),
      stateB: V(t1, iStateB),
      stateC: V(t1, iStateC),
      CPShort: V(t1, iCPShort),
      PECut: V(t1, iPECut),
    },
    r2: {
      continuityPE: V(t2, iContinuity),
      insulationCable: V(t2, iInsulation),
      stateA: V(t2, iStateA),
      stateB: V(t2, iStateB),
      stateC: V(t2, iStateC),
      CPShort: V(t2, iCPShort),
      PECut: V(t2, iPECut),
    },
    r3: {
      continuityPE: V(t3, iContinuity),
      insulationCable: V(t3, iInsulation),
      stateA: V(t3, iStateA),
      stateB: V(t3, iStateB),
      stateC: V(t3, iStateC),
      CPShort: V(t3, iCPShort),
      PECut: V(t3, iPECut),
    },
  } as ChargerSafetyPayload["electricalSafety"]["peContinuity"];

  // RCD
  const iRcdA = findIndex("RCD type A");
  const iRcdF = findIndex("RCD type F");
  const iRcdB = findIndex("RCD type B");
  const iRdcDD = findIndex("RDC-DD");
  const rcd = {
    typeA: { value: iRcdA >= 0 ? results.type2Values[iRcdA] || "" : "", unit: "mA" as const },
    typeF: { value: iRcdF >= 0 ? results.type2Values[iRcdF] || "" : "", unit: "mA" as const },
    typeB: { value: iRcdB >= 0 ? results.type2Values[iRcdB] || "" : "", unit: "mA" as const },
    DD: { value: iRdcDD >= 0 ? results.type2Values[iRdcDD] || "" : "", unit: "mA" as const },
  };


  // Remarks ต่อแถว
  const remarks = buildRemarks(results, items);

  return {
    electricalSafety: {
      peContinuity,
      rcd,
      remarks,
    },
  };
}

const createEmptyResults = (itemCount: number): TestCharger => ({
  test1: new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" })),
  test2: new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" })),
  test3: new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" })),
  type2Values: new Array(itemCount).fill(""),
  remarks: new Array(itemCount).fill("")
});

interface ACTest2GridProps {
  initialResults?: TestCharger;
  onResultsChange?: (results: TestCharger) => void;
}

const ACTest1Grid: React.FC<ACTest2GridProps> = ({
  initialResults,
  onResultsChange
}) => {
  const [results, setResults] = useState<TestCharger>(
    initialResults || createEmptyResults(AC_TEST2_DATA.length)
  );

  const handleResultChange = (testIndex: number, itemIndex: number, field: 'h1' | 'result', value: string) => {
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

  const handleType2Change = (itemIndex: number, value: string) => {
    const newResults = {
      ...results,
      type2Values: [...results.type2Values]
    };
    newResults.type2Values[itemIndex] = value;

    setResults(newResults);
    onResultsChange?.(newResults);
  };

  const handleRemarkChange = (itemIndex: number, value: string) => {
    const newResults = {
      ...results,
      remarks: [...results.remarks]
    };
    newResults.remarks[itemIndex] = value;

    setResults(newResults);
    onResultsChange?.(newResults);
  };

  return (
    <div className="tw-w-full tw-overflow-x-auto">
      <TestResultsGrid
        title="Test Results (Record as Pass/Fail) or Numeric Results"
        testItems={AC_TEST2_DATA}
        results={results}
        onResultChange={handleResultChange}
        onType2Change={handleType2Change}
        onRemarkChange={handleRemarkChange}
      />
    </div>
  );
};

export default ACTest1Grid;