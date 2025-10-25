"use client";

import React, { useState } from "react";
import { Input, Button } from "@material-tailwind/react";

interface ACTestItem {
  category: string;
  subCategory?: string;
  testName: string;
  unit?: string;
}

interface TestResults {
  test1: { h1: string; result: string }[];
  test2: { h1: string; result: string }[];
  test3: { h1: string; result: string }[];
  rcdValues: string[];
  remarks: string[];
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
          <div>Testing Checklist</div>
          <div className="tw-text-xs tw-font-medium tw-mt-1">CCS2</div>
        </div>
        <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold md:tw-block tw-hidden">
          {title}
        </div>
        <div className="tw-p-3 tw-text-center tw-font-semibold md:tw-block tw-hidden">
          Remark
        </div>
        {/* Mobile header */}
        <div className="tw-border-t tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold md:tw-hidden">
          <div>Testing Checklist</div>
          <div className="tw-text-xs tw-font-medium tw-mt-1">CCS2</div>
        </div>
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
                H1
              </div>
              <div className="tw-p-1 tw-text-center tw-text-xs">H2</div>
            </div>
          </div>
          {/* 2nd TEST */}
          <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800">
            <div className="tw-p-2 tw-text-center tw-font-medium tw-border-b tw-border-gray-800">
              2nd TEST
            </div>
            <div className="tw-grid tw-grid-cols-2">
              <div className="tw-border-r tw-border-gray-800 tw-p-1 tw-text-center tw-text-xs">
                H1
              </div>
              <div className="tw-p-1 tw-text-center tw-text-xs">H2</div>
            </div>
          </div>
          {/* 3rd TEST */}
          <div>
            <div className="tw-p-2 tw-text-center tw-font-medium tw-border-b tw-border-gray-800">
              3rd TEST
            </div>
            <div className="tw-grid tw-grid-cols-2">
              <div className="tw-border-r tw-border-gray-800 tw-p-1 tw-text-center tw-text-xs">
                H1
              </div>
              <div className="tw-p-1 tw-text-center tw-text-xs">H2</div>
            </div>
          </div>
        </div>
        <div className="md:tw-block tw-hidden"></div>
      </div>

      {/* Test Items */}
      {testItems.map((item, index) => {
        const isPEContinuity = item.subCategory?.includes("PE.Continuity");
        const isFirstPEItem = index === 0;

        return (
          <div
            key={index}
            className={`tw-grid tw-grid-cols-1 md:tw-grid-cols-[2fr_3fr_1fr] tw-border-t tw-border-gray-800 ${
              isPEContinuity ? "tw-min-h-[50px]" : "tw-min-h-[60px]"
            }`}
          >
            {/* Test Name Column */}
            <div className="tw-border-r tw-border-gray-800 tw-relative tw-bg-white">
              {/* Charger Safety - show from first item to last item (all 10 rows) */}
              {isFirstPEItem && (
                <div className="tw-absolute tw-left-0 tw-top-0 tw-w-16 tw-h-[580px] tw-bg-gray-50 tw-border-r tw-border-gray-300 tw-items-center tw-justify-center tw-z-10 tw-hidden md:tw-flex">
                  <div className="tw-transform tw--rotate-90 tw-text-sm tw-font-bold tw-text-gray-800 tw-whitespace-nowrap">
                    Charger Safety
                  </div>
                </div>
              )}

              {/* Mobile labels */}
              <div className="tw-block md:tw-hidden tw-bg-gray-100 tw-px-3 tw-py-2 tw-text-xs tw-font-medium tw-text-gray-700">
                {item.category}
                {item.subCategory && ` - ${item.subCategory}`}
              </div>

              {/* Test details */}
              <div className="tw-p-3 tw-flex tw-items-center tw-h-full md:tw-ml-16 tw-ml-0">
                <div className="tw-w-full">
                  {/* Normal layout for all items - aligned left for consistent vertical alignment */}
                  <div className="tw-flex tw-items-center tw-justify-start tw-h-full tw-pl-0">
                    <span className="tw-text-sm tw-text-gray-800">
                      {item.testName}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Results Columns */}
            <div className="tw-border-r tw-border-gray-800 tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-bg-white">
              {/* 1st Test */}
              <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800 tw-grid tw-grid-cols-2">
                <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-2 tw-col-span-2">
                  1st TEST
                </div>
                {/* H1 */}
                <div className="tw-border-r tw-border-gray-800 tw-p-2">
                  <Button
                    size="sm"
                    color="green"
                    variant={
                      results.test1[index]?.h1 === "✓" ? "filled" : "outlined"
                    }
                    className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
                    onClick={() =>
                      onResultChange(
                        0,
                        index,
                        "h1",
                        results.test1[index]?.h1 === "✓" ? "" : "✓"
                      )
                    }
                  >
                    ✓
                  </Button>
                </div>
                {/* H2 */}
                <div className="tw-p-2">
                  <Button
                    size="sm"
                    color="green"
                    variant={
                      results.test1[index]?.result === "✓"
                        ? "filled"
                        : "outlined"
                    }
                    className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
                    onClick={() =>
                      onResultChange(
                        0,
                        index,
                        "result",
                        results.test1[index]?.result === "✓" ? "" : "✓"
                      )
                    }
                  >
                    ✓
                  </Button>
                </div>
              </div>

              {/* 2nd Test */}
              <div className="tw-border-r md:tw-border-r tw-border-b md:tw-border-b-0 tw-border-gray-800 tw-grid tw-grid-cols-2">
                <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-2 tw-col-span-2">
                  2nd TEST
                </div>
                {/* H1 */}
                <div className="tw-border-r tw-border-gray-800 tw-p-2">
                  <Button
                    size="sm"
                    color="green"
                    variant={
                      results.test2[index]?.h1 === "✓" ? "filled" : "outlined"
                    }
                    className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
                    onClick={() =>
                      onResultChange(
                        1,
                        index,
                        "h1",
                        results.test2[index]?.h1 === "✓" ? "" : "✓"
                      )
                    }
                  >
                    ✓
                  </Button>
                </div>
                {/* H2 */}
                <div className="tw-p-2">
                  <Button
                    size="sm"
                    color="green"
                    variant={
                      results.test2[index]?.result === "✓"
                        ? "filled"
                        : "outlined"
                    }
                    className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
                    onClick={() =>
                      onResultChange(
                        1,
                        index,
                        "result",
                        results.test2[index]?.result === "✓" ? "" : "✓"
                      )
                    }
                  >
                    ✓
                  </Button>
                </div>
              </div>

              {/* 3rd Test */}
              <div className="tw-grid tw-grid-cols-2">
                <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-2 tw-col-span-2">
                  3rd TEST
                </div>
                {/* H1 */}
                <div className="tw-border-r tw-border-gray-800 tw-p-2">
                  <Button
                    size="sm"
                    color="green"
                    variant={
                      results.test3[index]?.h1 === "✓" ? "filled" : "outlined"
                    }
                    className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
                    onClick={() =>
                      onResultChange(
                        2,
                        index,
                        "h1",
                        results.test3[index]?.h1 === "✓" ? "" : "✓"
                      )
                    }
                  >
                    ✓
                  </Button>
                </div>
                {/* H2 */}
                <div className="tw-p-2">
                  <Button
                    size="sm"
                    color="green"
                    variant={
                      results.test3[index]?.result === "✓"
                        ? "filled"
                        : "outlined"
                    }
                    className="tw-text-xs tw-px-1 tw-py-1 tw-min-w-0 tw-flex-1"
                    onClick={() =>
                      onResultChange(
                        2,
                        index,
                        "result",
                        results.test3[index]?.result === "✓" ? "" : "✓"
                      )
                    }
                  >
                    ✓
                  </Button>
                </div>
              </div>
            </div>

            {/* Remark Column */}
            <div className="tw-p-2 tw-bg-white">
              <div className="tw-text-xs tw-font-medium tw-text-center md:tw-hidden tw-mb-2">
                Remark
              </div>
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

const AC_TEST_DATA: ACTestItem[] = [
  // PE.Continuity protective Conductors of Charger
  {
    category: "Electrical Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "None (Normal operate)",
    unit: "",
  },
  {
    category: "Electrical Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "CP short -120 Ohm",
    unit: "",
  },
  {
    category: "Electrical Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "PE-PP-Cut",
    unit: "",
  },
  {
    category: "Electrical Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Back Cover",
    unit: "",
  },
  {
    category: "Electrical Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Remote Stop",
    unit: "",
  },
  {
    category: "Electrical Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Emergency",
    unit: "",
  },

  // Isolation Transformer
  {
    category: "Electrical Safety",
    subCategory: "",
    testName: "LDC +",
    unit: "",
  },

  // HDC Tests
  {
    category: "Electrical Safety",
    subCategory: "",
    testName: "LDC  -",
    unit: "",
  },
  {
    category: "Electrical Safety",
    subCategory: "",
    testName: "HDC  +",
    unit: "",
  },
    {
    category: "Electrical Safety",
    subCategory: "",
    testName: "HDC  -",
    unit: "",
  },
];

const createEmptyResults = (itemCount: number): TestResults => ({
  test1: new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" })),
  test2: new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" })),
  test3: new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" })),
  rcdValues: new Array(itemCount).fill(""),
  remarks: new Array(itemCount).fill(""),
});

interface ACTestGridProps {
  initialResults?: TestResults;
  onResultsChange?: (results: TestResults) => void;
}

const ACTest1Grid: React.FC<ACTestGridProps> = ({
  initialResults,
  onResultsChange,
}) => {
  const [results, setResults] = useState<TestResults>(
    initialResults || createEmptyResults(AC_TEST_DATA.length)
  );

  const handleResultChange = (
    testIndex: number,
    itemIndex: number,
    field: "h1" | "result",
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

  const handleRcdChange = (itemIndex: number, value: string) => {
    const newResults = {
      ...results,
      rcdValues: [...results.rcdValues],
    };
    newResults.rcdValues[itemIndex] = value;

    setResults(newResults);
    onResultsChange?.(newResults);
  };

  const handleRemarkChange = (itemIndex: number, value: string) => {
    const newResults = {
      ...results,
      remarks: [...results.remarks],
    };
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
