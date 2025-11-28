"use client";

import React, { useState } from "react";
import { Input, Button } from "@material-tailwind/react";

export interface ACTestItem {
  category: string;
  subCategory?: string;
  testName: string;
  unit?: string;
}

export interface TestResults {
  test1: { pf: string; value: string }[];
  test2: { pf: string; value: string }[];
  test3: { pf: string; value: string }[];
  rcdValues: string[];
  remarks: string[];
}

interface TestResultsGridProps {
  title?: string;
  testItems: ACTestItem[];
  results: TestResults;
  onResultChange: (testIndex: number, itemIndex: number, field: 'pf' | 'value', value: string) => void;
  onRcdChange: (itemIndex: number, value: string) => void;
  onRemarkChange: (itemIndex: number, value: string) => void;
}

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
    powerStandby: { L1: string; L2: string; L3: string };
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
  onRcdChange,
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
              Testing Checklist
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
              <div className="tw-border-r tw-border-gray-300 tw-p-2 tw-text-center tw-text-xs tw-font-medium tw-tracking-wide tw-text-gray-700">
                1st TEST
              </div>
              <div className="tw-border-r tw-border-gray-300 tw-p-2 tw-text-center tw-text-xs tw-font-medium tw-tracking-wide tw-text-gray-700">
                2nd TEST
              </div>
              <div className="tw-p-2 tw-text-center tw-text-xs tw-font-medium tw-tracking-wide tw-text-gray-700">
                3rd TEST
              </div>
            </div>
            <div />
          </div>

          {/* Rows */}
          {testItems.map((item, index) => {
            const isPowerStandby = item.testName.includes("Power standby");
            const isPEContinuity = item.subCategory?.includes("PE.Continuity");
            const isFirstPEItem = index === 0;
            const isRCDItem = item.testName.includes("RCD");

            return (
              <div
                key={index}
                className={`tw-grid tw-grid-cols-[2fr_3fr_1.2fr] tw-border-t tw-border-gray-200 ${isPEContinuity ? "tw-min-h-[50px]" : "tw-min-h-[60px]"
                  }`}
              >
                {/* Test Name Column */}
                <div className="tw-border-r tw-border-gray-200 tw-relative tw-bg-white">
                  {/* Electrical Safety band */}
                  {isFirstPEItem && (
                    <div className="tw-absolute tw-left-0 tw-top-0 tw-w-16 tw-h-[572px] tw-bg-gray-50 tw-border-r tw-border-b tw-border-gray-200 tw-items-center tw-justify-center tw-z-10 tw-pointer-events-none tw-flex">
                      <div className="tw-transform tw--rotate-90 tw-text-xs tw-font-bold tw-text-gray-800 tw-whitespace-nowrap">
                        Electrical Safety
                      </div>
                    </div>
                  )}

                  {/* PE.Continuity band */}
                  {isFirstPEItem && (
                    <div className="tw-absolute tw-left-16 tw-top-0 tw-w-32 tw-h-[383px] tw-bg-gray-100 tw-border-r tw-border-b tw-border-gray-200 tw-items-center tw-justify-center tw-z-10 tw-pointer-events-none tw-flex">
                      <div className="tw-text-[11px] tw-font-semibold tw-text-gray-700 tw-text-center tw-leading-tight tw-px-2">
                        PE.Continuity protective Conductors of Charger
                      </div>
                    </div>
                  )}

                  {/* Test details */}
                  <div
                    className={`tw-p-3 tw-flex tw-items-center tw-h-full ${isPEContinuity ? "tw-ml-48" : "tw-ml-16"
                      }`}
                  >
                    <div className="tw-w-full">
                      {isRCDItem ? (
                        // RCD: name + input + unit
                        <div className="tw-flex tw-items-center tw-justify-center tw-gap-3 tw-h-full tw-text-center">
                          <span className="tw-text-sm tw-text-gray-800">{item.testName}</span>
                          <Input
                            value={results.rcdValues[index] || ""}
                            onChange={(e) => onRcdChange(index, e.target.value)}
                            crossOrigin=""
                            className="!tw-text-center !tw-border-gray-300 !tw-text-sm"
                            containerProps={{ className: "!tw-min-w-0 !tw-w-20 !tw-h-8" }}
                          />
                          {item.unit && (
                            <span className="tw-text-xs tw-font-medium tw-text-gray-600 tw-border tw-border-gray-300 tw-px-2 tw-py-1 tw-rounded">
                              {item.unit}
                            </span>
                          )}
                        </div>
                      ) : (
                        // Normal: name + unit (right aligned)
                        <div className="tw-flex tw-items-center tw-justify-between">
                          <span className="tw-text-sm tw-text-gray-800">{item.testName}</span>
                          {item.unit && (
                            <span className="tw-text-xs tw-font-medium tw-text-gray-600 tw-border tw-border-gray-300 tw-px-2 tw-py-1 tw-rounded">
                              {item.unit}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Test Results Columns */}
                <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-3 tw-bg-white">
                  {isPowerStandby ? (
                    // Power standby: L1/L2/L3
                    <>
                      <div className="tw-border-r tw-border-gray-200 tw-p-2 tw-flex tw-items-center tw-gap-1">
                        <span className="tw-text-xs tw-text-gray-600">L1=</span>
                        <Input
                          value={results.test1[index]?.pf || ""}
                          onChange={(e) => onResultChange(0, index, "pf", e.target.value)}
                          crossOrigin=""
                          className="!tw-text-center !tw-border-gray-300 !tw-text-xs"
                          containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                        />
                        <span className="tw-text-xs tw-text-gray-600">A</span>
                      </div>
                      <div className="tw-border-r tw-border-gray-200 tw-p-2 tw-flex tw-items-center tw-gap-1">
                        <span className="tw-text-xs tw-text-gray-600">L2=</span>
                        <Input
                          value={results.test2[index]?.pf || ""}
                          onChange={(e) => onResultChange(1, index, "pf", e.target.value)}
                          crossOrigin=""
                          className="!tw-text-center !tw-border-gray-300 !tw-text-xs"
                          containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                        />
                        <span className="tw-text-xs tw-text-gray-600">A</span>
                      </div>
                      <div className="tw-p-2 tw-flex tw-items-center tw-gap-1">
                        <span className="tw-text-xs tw-text-gray-600">L3=</span>
                        <Input
                          value={results.test3[index]?.pf || ""}
                          onChange={(e) => onResultChange(2, index, "pf", e.target.value)}
                          crossOrigin=""
                          className="!tw-text-center !tw-border-gray-300 !tw-text-xs"
                          containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                        />
                        <span className="tw-text-xs tw-text-gray-600">A</span>
                      </div>
                    </>
                  ) : (
                    // Normal: Pass/Fail + Input
                    <>
                      {/* 1st Test */}
                      <div className="tw-border-r tw-border-gray-200 tw-p-2 tw-space-y-2">
                        <div className="tw-flex tw-justify-center">
                          {/* <Input
                            value={results.test1[index]?.value || ""}
                            onChange={(e) => onResultChange(0, index, "value", e.target.value)}
                            crossOrigin=""
                            className="!tw-text-center !tw-border-gray-300"
                            containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                          />
                          <PassFailButtons
                            value={
                              results.test1[index]?.pf === "PASS"
                                ? "✓"
                                : results.test1[index]?.pf === "FAIL"
                                  ? "✗"
                                  : ""
                            }
                            onChange={(v) =>
                              onResultChange(
                                0,
                                index,
                                "pf",
                                v === "✓" ? "PASS" : v === "✗" ? "FAIL" : ""
                              )
                            }
                          /> */}
                          {/* TEst */}
                          <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-[1fr_auto] tw-items-center">
                            <div className="tw-border-r tw-border-gray-200 t-p-2">
                              <Input
                                value={results.test1[index]?.value || ""}
                                onChange={(e) => onResultChange(0, index, "value", e.target.value)}
                                crossOrigin=""
                                className="!tw-text-center !tw-border-gray-300"
                                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                              />
                            </div>
                            <div className="tw-p-2 tw-flex tw-justify-center">
                              <PassFailButtons
                                value={
                                  results.test1[index]?.pf === "PASS"
                                    ? "✓"
                                    : results.test1[index]?.pf === "FAIL"
                                      ? "✗"
                                      : ""
                                }
                                onChange={(v) =>
                                  onResultChange(
                                    0,
                                    index,
                                    "pf",
                                    v === "✓" ? "PASS" : v === "✗" ? "FAIL" : ""
                                  )
                                }
                              />
                            </div>
                          </div>

                        </div>
                        {/* <Input
                          value={results.test1[index]?.value || ""}
                          onChange={(e) => onResultChange(0, index, "value", e.target.value)}
                          crossOrigin=""
                          className="!tw-text-center !tw-border-gray-300"
                          containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                        /> */}
                      </div>

                      {/* 2nd Test */}
                      <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-[1fr_auto] tw-items-center">
                        <div className="tw-border-r tw-border-gray-200 t-p-2">
                          <Input
                            value={results.test2[index]?.value || ""}
                            onChange={(e) => onResultChange(1, index, "value", e.target.value)}
                            crossOrigin=""
                            className="!tw-text-center !tw-border-gray-300"
                            containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                          />
                        </div>
                        <div className="tw-p-2 tw-flex tw-justify-center">
                          <PassFailButtons
                            value={
                              results.test2[index]?.pf === "PASS"
                                ? "✓"
                                : results.test2[index]?.pf === "FAIL"
                                  ? "✗"
                                  : ""
                            }
                            onChange={(v) =>
                              onResultChange(
                                1,
                                index,
                                "pf",
                                v === "✓" ? "PASS" : v === "✗" ? "FAIL" : ""
                              )
                            }
                          />
                        </div>
                      </div>
                      {/*  */}
                      {/* <div className="tw-border-r tw-border-gray-200 tw-p-2 tw-space-y-2">
                        <div className="tw-flex tw-justify-center">
                          <PassFailButtons
                            value={
                              results.test2[index]?.pf === "PASS"
                                ? "✓"
                                : results.test2[index]?.pf === "FAIL"
                                  ? "✗"
                                  : ""
                            }
                            onChange={(v) =>
                              onResultChange(
                                1,
                                index,
                                "pf",
                                v === "✓" ? "PASS" : v === "✗" ? "FAIL" : ""
                              )
                            }
                          />
                        </div>
                        <Input
                          value={results.test2[index]?.value || ""}
                          onChange={(e) => onResultChange(1, index, "value", e.target.value)}
                          crossOrigin=""
                          className="!tw-text-center !tw-border-gray-300"
                          containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                        />
                      </div> */}

                      {/* 3rd Test */}
                      <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-[1fr_auto] tw-items-center">
                        <div className="tw-border-r tw-border-gray-200 t-p-2">
                          <Input
                            value={results.test3[index]?.value || ""}
                            onChange={(e) => onResultChange(2, index, "value", e.target.value)}
                            crossOrigin=""
                            className="!tw-text-center !tw-border-gray-300"
                            containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                          />
                        </div>
                        <div className="tw-p-2 tw-flex tw-justify-center">
                          <PassFailButtons
                            value={
                              results.test3[index]?.pf === "PASS"
                                ? "✓"
                                : results.test3[index]?.pf === "FAIL"
                                  ? "✗"
                                  : ""
                            }
                            onChange={(v) =>
                              onResultChange(
                                2,
                                index,
                                "pf",
                                v === "✓" ? "PASS" : v === "✗" ? "FAIL" : ""
                              )
                            }
                          />
                        </div>
                      </div>
                      {/*  */}
                      {/* <div className="tw-p-2 tw-space-y-2">
                        <div className="tw-flex tw-justify-center">
                          <PassFailButtons
                            value={
                              results.test3[index]?.pf === "PASS"
                                ? "✓"
                                : results.test3[index]?.pf === "FAIL"
                                  ? "✗"
                                  : ""
                            }
                            onChange={(v) =>
                              onResultChange(
                                2,
                                index,
                                "pf",
                                v === "✓" ? "PASS" : v === "✗" ? "FAIL" : ""
                              )
                            }
                          />
                        </div>
                        <Input
                          value={results.test3[index]?.value || ""}
                          onChange={(e) => onResultChange(2, index, "value", e.target.value)}
                          crossOrigin=""
                          className="!tw-text-center !tw-border-gray-300"
                          containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                        />
                      </div> */}
                    </>
                  )}
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
            Testing Checklist
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
                const isPowerStandby = item.testName.includes("Power standby");
                const isPEContinuity = item.subCategory?.includes("PE.Continuity");
                const isRCDItem = item.testName.includes("RCD");

                const categoryLabel = isPEContinuity ? "PE Continuity" : item.category;

                const currentResult =
                  testIndex === 0
                    ? results.test1[index]
                    : testIndex === 1
                      ? results.test2[index]
                      : results.test3[index];

                const phaseLabel = testIndex === 0 ? "L1" : testIndex === 1 ? "L2" : "L3";

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
                            {categoryLabel && (
                              <span className="tw-inline-flex tw-items-center tw-rounded-full tw-bg-white tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-gray-700 tw-border tw-border-gray-200">
                                {categoryLabel}
                              </span>
                            )}
                            {item.subCategory && !isPEContinuity && (
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

                      {/* RCD control - แสดงเฉพาะรอบแรก */}
                      {isRCDItem && isFirstRound && (
                        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-pt-1">
                          <span className="tw-text-[11px] tw-font-medium tw-text-gray-700">
                            RCD value
                          </span>
                          <Input
                            value={results.rcdValues[index] || ""}
                            onChange={(e) => onRcdChange(index, e.target.value)}
                            crossOrigin=""
                            className="!tw-text-center !tw-border-gray-300 !tw-text-sm"
                            containerProps={{ className: "!tw-min-w-0 !tw-w-24 !tw-h-8" }}
                            placeholder="mA"
                          />
                          {item.unit && (
                            <span className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-border tw-border-gray-300 tw-px-2 tw-py-0.5 tw-rounded">
                              {item.unit}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Results section */}
                    <div className="tw-space-y-2">
                      {isPowerStandby ? (
                        // Power standby: L1/L2/L3
                        <div className="tw-flex tw-items-center tw-gap-2 tw-rounded-md tw-bg-white tw-px-2 tw-py-2 tw-border tw-border-gray-200">
                          <span className="tw-text-[11px] tw-font-medium tw-text-gray-600">
                            {phaseLabel} =
                          </span>
                          <Input
                            value={currentResult?.pf || ""}
                            onChange={(e) =>
                              onResultChange(testIndex, index, "pf", e.target.value)
                            }
                            crossOrigin=""
                            className="!tw-text-center !tw-border-gray-300 !tw-text-xs"
                            containerProps={{ className: "!tw-min-w-0 !tw-h-8 tw-flex-1" }}
                            placeholder={`${short} current (${phaseLabel})`}
                          />
                          <span className="tw-text-[11px] tw-text-gray-600">A</span>
                        </div>
                      ) : (
                        // Normal: Pass/Fail + Input
                        <div className="tw-rounded-md tw-bg-white tw-border tw-border-gray-200 tw-p-2">
                          <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-stretch sm:tw-items-center tw-gap-2">
                            <Input
                              value={currentResult?.value || ""}
                              onChange={(e) =>
                                onResultChange(testIndex, index, "value", e.target.value)
                              }
                              crossOrigin=""
                              className="!tw-text-center !tw-border-gray-300 !tw-text-xs"
                              containerProps={{ className: "!tw-min-w-0 !tw-h-8 tw-flex-1" }}
                              placeholder={`${short} value`}
                            />
                            <div className="tw-flex tw-justify-start">
                              <PassFailButtons
                                value={
                                  currentResult?.pf === "PASS"
                                    ? "✓"
                                    : currentResult?.pf === "FAIL"
                                      ? "✗"
                                      : ""
                                }
                                onChange={(v) =>
                                  onResultChange(
                                    testIndex,
                                    index,
                                    "pf",
                                    v === "✓" ? "PASS" : v === "✗" ? "FAIL" : ""
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}
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

export const AC_TEST_DATA: ACTestItem[] = [
  // PE.Continuity protective Conductors of Charger
  {
    category: "Electrical Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Left Cover",
    unit: ""
  },
  {
    category: "Electrical Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Right Cover",
    unit: ""
  },
  {
    category: "Electrical Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Front Cover",
    unit: ""
  },
  {
    category: "Electrical Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Back Cover",
    unit: ""
  },
  {
    category: "Electrical Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Charger Stand",
    unit: ""
  },
  {
    category: "Electrical Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Charger Case",
    unit: ""
  },

  // RCD Tests
  {
    category: "Electrical Safety",
    subCategory: "",
    testName: "RCD type A",
    unit: "mA"
  },
  {
    category: "Electrical Safety",
    subCategory: "",
    testName: "RCD type F",
    unit: "mA"
  },
  {
    category: "Electrical Safety",
    subCategory: "",
    testName: "RCD type B",
    unit: "mA"
  },

  // Power standby
  {
    category: "Electrical Safety",
    subCategory: "",
    testName: "Power standby",
    unit: ""
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
  if (/^Power standby$/i.test(n)) return "powerStandby";
  return camelKey(n);
};

/* แปลง remarks array → object ต่อชื่อทดสอบ */
export function buildRemarks(results: TestResults, items: ACTestItem[]) {
  const remarks: Record<string, string> = {};
  items.forEach((it, i) => {
    remarks[nameKey(it.testName)] = results.remarks[i] ?? "";
  });
  return remarks;
}

const toPass = (v?: string) => (v === "pass" ? "pass" : (v ?? ""));
/* ตัวแปลงหลัก → payload แนะนำสำหรับ Mongo (แยกรอบชัดเจน) */
export function mapToElectricalPayload(results: TestResults, items: ACTestItem[] = AC_TEST_DATA): ElectricalSafetyPayload {
  // index ค้นหาตามชื่อ จะได้ไม่ผูก index ตายตัว
  const findIndex = (name: string) => items.findIndex((it) => it.testName.toLowerCase() === name.toLowerCase());

  // 6 แถวแรกของ PE (ตามสเปกชุดนี้คงที่ชื่อ)
  const iLeft = findIndex("Left Cover");
  const iRight = findIndex("Right Cover");
  const iFront = findIndex("Front Cover");
  const iBack = findIndex("Back Cover");
  const iStand = findIndex("Charger Stand");
  const iCase = findIndex("Charger Case");

  const t1 = results.test1;
  const t2 = results.test2;
  const t3 = results.test3;

  const V = (t: { pf: string; value: string }[], i: number) => ({
    h1: i >= 0 ? t[i]?.value ?? "" : "",
    result: i >= 0 ? toPass(t[i]?.pf) : "",
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

  // RCD
  const iRcdA = findIndex("RCD type A");
  const iRcdF = findIndex("RCD type F");
  const iRcdB = findIndex("RCD type B");
  const rcd = {
    typeA: { value: iRcdA >= 0 ? results.rcdValues[iRcdA] || "" : "", unit: "mA" as const },
    typeF: { value: iRcdF >= 0 ? results.rcdValues[iRcdF] || "" : "", unit: "mA" as const },
    typeB: { value: iRcdB >= 0 ? results.rcdValues[iRcdB] || "" : "", unit: "mA" as const },
  };

  // Isolation Transformer
  const iIso = findIndex("Isolation Transformer");

  // Power standby (คอลัมน์ = เฟส)
  const iPsb = findIndex("Power standby");
  const powerStandby =
    iPsb >= 0
      ? {
        L1: results.test1[iPsb]?.pf ?? "",
        L2: results.test2[iPsb]?.pf ?? "",
        L3: results.test3[iPsb]?.pf ?? "",
      }
      : { L1: "", L2: "", L3: "" };

  // Remarks ต่อแถว
  const remarks = buildRemarks(results, items);

  return {
    electricalSafety: {
      peContinuity,
      rcd,
      powerStandby,
      remarks,
    },
  };
}

const createEmptyResults = (itemCount: number): TestResults => ({
  test1: new Array(itemCount).fill(null).map(() => ({ pf: "", value: "" })),
  test2: new Array(itemCount).fill(null).map(() => ({ pf: "", value: "" })),
  test3: new Array(itemCount).fill(null).map(() => ({ pf: "", value: "" })),
  rcdValues: new Array(itemCount).fill(""),
  remarks: new Array(itemCount).fill("")
});

interface ACTestGridProps {
  initialResults?: TestResults;
  onResultsChange?: (results: TestResults) => void;
}

const ACTest1Grid: React.FC<ACTestGridProps> = ({
  initialResults,
  onResultsChange
}) => {
  const [results, setResults] = useState<TestResults>(
    initialResults || createEmptyResults(AC_TEST_DATA.length)
  );

  const handleResultChange = (testIndex: number, itemIndex: number, field: 'pf' | 'value', value: string) => {
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
    const newResults = {
      ...results,
      rcdValues: [...results.rcdValues]
    };
    newResults.rcdValues[itemIndex] = value;

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