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
            const isIsolationTransformer = item.testName.includes("Isolation Transformer");

            return (
              <div
                key={index}
                className={`tw-grid tw-grid-cols-[2fr_3fr_1.2fr] tw-border-t tw-border-gray-200 ${isPEContinuity ? "tw-min-h-[50px]" : "tw-min-h-[60px]"
                  }`}
              >
                {/* ================= Test Name Column (Desktop) ================= */}
                <div className="tw-border-r tw-border-gray-200 tw-relative tw-bg-white">
                  {/* แถบด้านซ้ายสำหรับ Electrical Safety + PE.Continuity */}
                  {isFirstPEItem && (
                    <>
                      {/* กล่องซ้ายช่องที่ 1: Electrical Safety */}
                      <div
                        className="tw-absolute tw-left-0 tw-top-0 tw-w-16 tw-h-[600px]
                          tw-bg-gray-50
                          tw-border-r tw-border-b tw-border-gray-200
                          tw-items-center tw-justify-center tw-z-10
                          tw-pointer-events-none tw-flex"
                      >
                        <div className="tw-transform tw--rotate-90 tw-text-xs tw-font-bold tw-text-gray-800 tw-whitespace-nowrap">
                          Electrical Safety
                        </div>
                      </div>

                      {/* กล่องซ้ายช่องที่ 2: PE Continuity */}
                      <div
                        className="tw-absolute tw-left-16 tw-top-0 tw-w-32 tw-h-[300px]
                          tw-bg-gray-100
                          tw-border-r tw-border-b tw-border-gray-200
                          tw-items-center tw-justify-center tw-z-10
                          tw-pointer-events-none tw-flex"
                      >
                        <div className="tw-text-[11px] tw-font-semibold tw-text-gray-700 tw-text-center tw-leading-tight tw-px-2">
                          PE.Continuity protective Conductors of Charger
                        </div>
                      </div>
                    </>
                  )}

                  {/* เนื้อหา test name */}
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
                      ) : isIsolationTransformer ? (
                        // Isolation Transformer: name + ปุ่มในกล่อง
                        <div className="tw-flex tw-items-center tw-justify-center tw-gap-3 tw-h-full">
                          <span className="tw-text-sm tw-text-gray-800">{item.testName}</span>
                          <PassFailButtons
                            value={results.rcdValues[index] || ""}
                            onChange={(v) => onRcdChange(index, v)}
                          />
                        </div>
                      ) : (
                        // Normal
                        <div className="tw-flex tw-items-center tw-justify-center tw-h-full">
                          <span className="tw-text-sm tw-text-gray-800">{item.testName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ================= Results Columns (Desktop) ================= */}
                <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-3 tw-bg-white">
                  {isPowerStandby ? (
                    // Power standby: L1/L2/L3 เป็นเฟส
                    <>
                      <div className="tw-border-r tw-border-gray-200 tw-p-2 tw-flex tw-items-center tw-gap-1">
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
                      <div className="tw-border-r tw-border-gray-200 tw-p-2 tw-flex tw-items-center tw-gap-1">
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
                    // รอบ 1/2/3 ค่า + ปุ่ม Pass/Fail
                    <>
                      {/* 1st */}
                      <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-[1fr_auto] tw-items-center">
                        <div className="tw-border-r tw-border-gray-200 tw-p-2">
                          <Input
                            value={results.test1[index]?.h1 || ""}
                            onChange={(e) => onResultChange(0, index, "h1", e.target.value)}
                            crossOrigin=""
                            className="!tw-text-center !tw-border-gray-300"
                            containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
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
                      <div className="tw-border-r tw-border-gray-200 tw-grid tw-grid-cols-[1fr_auto] tw-items-center">
                        <div className="tw-border-r tw-border-gray-200 tw-p-2">
                          <Input
                            value={results.test2[index]?.h1 || ""}
                            onChange={(e) => onResultChange(1, index, "h1", e.target.value)}
                            crossOrigin=""
                            className="!tw-text-center !tw-border-gray-300"
                            containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
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
                        <div className="tw-border-r tw-border-gray-200 tw-p-2">
                          <Input
                            value={results.test3[index]?.h1 || ""}
                            onChange={(e) => onResultChange(2, index, "h1", e.target.value)}
                            crossOrigin=""
                            className="!tw-text-center !tw-border-gray-300"
                            containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
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

                {/* ================= Remark Column (Desktop) ================= */}
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

      {/* ================= MOBILE / TABLET (TEST-GROUPED VIEW, NO COLOR THEMES) ================= */}
      <div className="lg:tw-hidden tw-p-3 tw-space-y-6">
        {/* Global header (mobile) */}
        <div className="tw-mb-2">
          <div className="tw-text-[11px] tw-font-semibold tw-tracking-wide tw-text-gray-500 tw-uppercase">
            Testing Checklist
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
              {/* Section header – บอกให้ชัดว่าตอนนี้อยู่รอบไหน */}
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
                const isIsolationTransformer = item.testName.includes("Isolation Transformer");

                const categoryLabel = isPEContinuity ? "PE Continuity" : item.category;

                const currentResult =
                  testIndex === 0
                    ? results.test1[index]
                    : testIndex === 1
                      ? results.test2[index]
                      : results.test3[index];

                const phaseLabel =
                  testIndex === 0 ? "L1" : testIndex === 1 ? "L2" : "L3";

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

                        {/* ขวา: Badge บอก Test รอบนี้ */}
                        <span className="tw-inline-flex tw-items-center tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-uppercase tw-text-gray-700">
                          {short}
                        </span>
                      </div>

                      {/* RCD & Isolation Transformer – control เฉพาะรอบแรก (ค่า shared) */}
                      {(isRCDItem || isIsolationTransformer) && isFirstRound && (
                        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-pt-1">
                          {isRCDItem && (
                            <>
                              <span className="tw-text-[11px] tw-font-medium tw-text-gray-700">
                                RCD value
                              </span>
                              <Input
                                value={results.rcdValues[index] || ""}
                                onChange={(e) => onRcdChange(index, e.target.value)}
                                crossOrigin=""
                                className="!tw-text-center !tw-border-gray-300 !tw-text-sm"
                                containerProps={{
                                  className: "!tw-min-w-0 !tw-w-24 !tw-h-8",
                                }}
                                placeholder="mA"
                              />
                              {item.unit && (
                                <span className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-border tw-border-gray-300 tw-px-2 tw-py-0.5 tw-rounded">
                                  {item.unit}
                                </span>
                              )}
                            </>
                          )}

                          {isIsolationTransformer && (
                            <>
                              <span className="tw-text-[11px] tw-font-medium tw-text-gray-700">
                                Isolation check
                              </span>
                              <PassFailButtons
                                value={results.rcdValues[index] || ""}
                                onChange={(v) => onRcdChange(index, v)}
                              />
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Results section for this TEST round */}
                    <div className="tw-space-y-2">
                      {isPowerStandby ? (
                        // Power standby: ใช้ test1/2/3 เป็น L1/L2/L3
                        <div className="tw-flex tw-items-center tw-gap-2 tw-rounded-md tw-bg-white tw-px-2 tw-py-2 tw-border tw-border-gray-200">
                          <span className="tw-text-[11px] tw-font-medium tw-text-gray-600">
                            {phaseLabel} =
                          </span>
                          <Input
                            value={currentResult?.h1 || ""}
                            onChange={(e) =>
                              onResultChange(testIndex, index, "h1", e.target.value)
                            }
                            crossOrigin=""
                            className="!tw-text-center !tw-border-gray-300 !tw-text-xs"
                            containerProps={{
                              className: "!tw-min-w-0 !tw-h-8 tw-flex-1",
                            }}
                            placeholder={`${short} current (${phaseLabel})`}
                          />
                          <span className="tw-text-[11px] tw-text-gray-600">A</span>
                        </div>
                      ) : (
                        // ค่า + Pass/Fail สำหรับรอบนี้
                        <div className="tw-rounded-md tw-bg-white tw-border tw-border-gray-200 tw-p-2">
                          <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-stretch sm:tw-items-center tw-gap-2">
                            <Input
                              value={currentResult?.h1 || ""}
                              onChange={(e) =>
                                onResultChange(testIndex, index, "h1", e.target.value)
                              }
                              crossOrigin=""
                              className="!tw-text-center !tw-border-gray-300 !tw-text-xs"
                              containerProps={{
                                className: "!tw-min-w-0 !tw-h-8 tw-flex-1",
                              }}
                              placeholder={`${short} value`}
                            />
                            <div className="tw-flex tw-justify-start">
                              <PassFailButtons
                                value={currentResult?.result || ""}
                                onChange={(v) =>
                                  onResultChange(testIndex, index, "result", v)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Remark: มีอันเดียว แชร์กันทุกรอบ -> ให้กรอกใน TEST 1 */}
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
    <div >
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
