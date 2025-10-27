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

interface TestResults {
  test1: { h1: string; result: string }[];
  test2: { h1: string; result: string }[];
  test3: { h1: string; result: string }[];
  type2Values: string[];
  remarks: string[];
}

interface TestResultsGridProps {
  title?: string;
  testItems: ACTestItem[];
  results: TestResults;
  onResultChange: (testIndex: number, itemIndex: number, field: 'h1' | 'result', value: string) => void;
  onType2Change: (itemIndex: number, value: string) => void;
  onRemarkChange: (itemIndex: number, value: string) => void;
}

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
        const isRCDItem = item.testName.includes("RCD") || item.testName.includes("RDC-DD");
        
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
              <div className={`tw-p-3 tw-flex tw-items-center tw-h-full ${
                isPEContinuity ? 'md:tw-ml-16 tw-ml-0' : 'md:tw-ml-16 tw-ml-0'
              }`}>
                <div className="tw-w-full">
                  {/* Special layout for RCD items with input field between name and unit */}
                  {isRCDItem ? (
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

const AC_TEST2_DATA: ACTestItem[] = [
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
    type2: "30"
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
    testName: "RDC-DD ",
    type2: "6"
  }
];

const createEmptyResults = (itemCount: number): TestResults => ({
  test1: new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" })),
  test2: new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" })),
  test3: new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" })),
  type2Values: new Array(itemCount).fill(""),
  remarks: new Array(itemCount).fill("")
});

interface ACTest2GridProps {
  initialResults?: TestResults;
  onResultsChange?: (results: TestResults) => void;
}

const ACTest1Grid: React.FC<ACTest2GridProps> = ({
  initialResults,
  onResultsChange
}) => {
  const [results, setResults] = useState<TestResults>(
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