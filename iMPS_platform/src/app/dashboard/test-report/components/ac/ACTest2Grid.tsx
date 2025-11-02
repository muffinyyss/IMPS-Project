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

const TestResultsGrid: React.FC<TestResultsGridProps> = ({
  title = "Test Results (Record as Pass/Fail) or Numeric Results",
  testItems,
  results,
  onResultChange,
  onType2Change,
  onRemarkChange,
}) => {
  return (
    <div className="tw-border tw-border-gray-800 tw-bg-white">
      {/* Header */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-[2fr_3fr_1fr] tw-bg-gray-100">
        <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold">
          Testing Checklist
          <div className="tw-text-xs tw-font-medium tw-mt-1">Type2</div>
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
          {/* 1st TEST */}
          <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800">
            <div className="tw-p-2 tw-text-center tw-font-medium tw-border-b tw-border-gray-800">
              1st TEST
            </div>
            <div className="tw-grid tw-grid-cols-2">
              <div className="tw-border-r tw-border-gray-800 tw-p-1 tw-text-center tw-text-xs">
                H.1
              </div>
              <div className="tw-p-1 tw-text-center tw-text-xs">
                Result
              </div>
            </div>
          </div>
          {/* 2nd TEST */}
          <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800">
            <div className="tw-p-2 tw-text-center tw-font-medium tw-border-b tw-border-gray-800">
              2nd TEST
            </div>
            <div className="tw-grid tw-grid-cols-2">
              <div className="tw-border-r tw-border-gray-800 tw-p-1 tw-text-center tw-text-xs">
                H.1
              </div>
              <div className="tw-p-1 tw-text-center tw-text-xs">
                Result
              </div>
            </div>
          </div>
          {/* 3rd TEST */}
          <div>
            <div className="tw-p-2 tw-text-center tw-font-medium tw-border-b tw-border-gray-800">
              3rd TEST
            </div>
            <div className="tw-grid tw-grid-cols-2">
              <div className="tw-border-r tw-border-gray-800 tw-p-1 tw-text-center tw-text-xs">
                H.1
              </div>
              <div className="tw-p-1 tw-text-center tw-text-xs">
                Result
              </div>
            </div>
          </div>
        </div>
        <div className="md:tw-block tw-hidden"></div>
      </div>

      {/* Test Items */}
      {testItems.map((item, index) => {
        const isPEContinuity = item.subCategory?.includes("PE.Continuity");
        const isFirstPEItem = index === 0;
        // const isRDCItem = item.testName.includes("RDC-DD") || item.testName.includes("RDC-DD");

        const isRDCItem =
          /^RCD type\s*(A|F|B)$/i.test(item.testName) || /^RD[CD][-\s]?DD$/i.test(item.testName);

        return (
          <div key={index} className={`tw-grid tw-grid-cols-1 md:tw-grid-cols-[2fr_3fr_1fr] tw-border-t tw-border-gray-800 tw-min-h-[70px]`}>
            {/* Test Name Column */}
            <div className="tw-border-r tw-border-gray-800 tw-relative tw-bg-white">
              {/* Charger Safety - show from first item to last item */}
              {isFirstPEItem && (
                <div className="tw-absolute tw-left-0 tw-top-0 tw-w-16 tw-h-[770px] tw-bg-gray-50 tw-border-r tw-border-gray-300 tw-items-center tw-justify-center tw-z-10 tw-hidden md:tw-flex">
                  <div className="tw-transform tw--rotate-90 tw-text-sm tw-font-bold tw-text-gray-800 tw-whitespace-nowrap">
                    Charger Safety
                  </div>
                </div>
              )}

              {/* Test details */}
              <div className={`tw-p-3 tw-flex tw-items-center tw-h-full ${isPEContinuity ? 'md:tw-ml-16 tw-ml-0' : 'md:tw-ml-16 tw-ml-0'
                }`}>
                <div className="tw-w-full">
                  {/* Special layout for RCD items with input field between name and unit */}
                  {isRDCItem ? (
                    <div className="tw-flex tw-items-center tw-justify-center tw-gap-3 tw-h-full tw-text-center">
                      <span className="tw-text-sm tw-text-gray-800">{item.testName}</span>
                      <Input
                        value={results.type2Values[index] || ""}
                        onChange={(e) => onType2Change(index, e.target.value)}
                        crossOrigin=""
                        className="!tw-text-center !tw-border-gray-300"
                        containerProps={{ className: "!tw-min-w-0 !tw-w-20 !tw-h-8" }}
                        placeholder=""
                      />
                      <span className="tw-text-sm tw-font-medium tw-text-gray-600 tw-border tw-border-gray-300 tw-px-2 tw-py-1 tw-rounded">
                        mA
                      </span>
                    </div>
                  ) : (
                    /* Normal layout for non-RCD items - only show test name */
                    <div className="tw-flex tw-items-center tw-justify-center tw-h-full">
                      <span className="tw-text-sm tw-text-gray-800">{item.testName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Test Results Columns */}
            <div className="tw-border-r tw-border-gray-800 tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-bg-white">
              {/* 1st Test */}
              <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800 tw-grid tw-grid-cols-2">
                <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-2 tw-col-span-2">1st TEST</div>
                {/* H.1 */}
                <div className="tw-border-r tw-border-gray-800 tw-p-2">
                  <Input
                    value={results.test1[index]?.h1 || ""}
                    onChange={(e) => onResultChange(0, index, 'h1', e.target.value)}
                    crossOrigin=""
                    className="!tw-text-center !tw-border-gray-300"
                    containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                    placeholder=""
                  />
                </div>
                {/* Result */}
                <div className="tw-p-2">
                  <Button
                    size="sm"
                    color="green"
                    variant={results.test1[index]?.result === "✓" ? "filled" : "outlined"}
                    className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
                    onClick={() => onResultChange(0, index, 'result', results.test1[index]?.result === "✓" ? "" : "✓")}
                  >
                    ✓
                  </Button>
                </div>
              </div>

              {/* 2nd Test */}
              <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800 tw-grid tw-grid-cols-2">
                <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-2 tw-col-span-2">2nd TEST</div>
                {/* H.1 */}
                <div className="tw-border-r tw-border-gray-800 tw-p-2">
                  <Input
                    value={results.test2[index]?.h1 || ""}
                    onChange={(e) => onResultChange(1, index, 'h1', e.target.value)}
                    crossOrigin=""
                    className="!tw-text-center !tw-border-gray-300"
                    containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                    placeholder=""
                  />
                </div>
                {/* Result */}
                <div className="tw-p-2">
                  <Button
                    size="sm"
                    color="green"
                    variant={results.test2[index]?.result === "✓" ? "filled" : "outlined"}
                    className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
                    onClick={() => onResultChange(1, index, 'result', results.test2[index]?.result === "✓" ? "" : "✓")}
                  >
                    ✓
                  </Button>
                </div>
              </div>

              {/* 3rd Test */}
              <div className="tw-grid tw-grid-cols-2">
                <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-2 tw-col-span-2">3rd TEST</div>
                {/* H.1 */}
                <div className="tw-border-r tw-border-gray-800 tw-p-2">
                  <Input
                    value={results.test3[index]?.h1 || ""}
                    onChange={(e) => onResultChange(2, index, 'h1', e.target.value)}
                    crossOrigin=""
                    className="!tw-text-center !tw-border-gray-300"
                    containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                    placeholder=""
                  />
                </div>
                {/* Result */}
                <div className="tw-p-2">
                  <Button
                    size="sm"
                    color="green"
                    variant={results.test3[index]?.result === "✓" ? "filled" : "outlined"}
                    className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
                    onClick={() => onResultChange(2, index, 'result', results.test3[index]?.result === "✓" ? "" : "✓")}
                  >
                    ✓
                  </Button>
                </div>
              </div>
            </div>

            {/* Remark Column */}
            <div className="tw-p-2 tw-bg-white">
              <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-2">Remark</div>
              <Input
                value={results.remarks[index] || ""}
                onChange={(e) => onRemarkChange(index, e.target.value)}
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-10" }}
                placeholder=""
              />
            </div>
          </div>
        );
      })}
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