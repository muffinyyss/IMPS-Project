"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Input, Button, Typography, Textarea } from "@material-tailwind/react";

/* ===================== Types ===================== */

export type Lang = "th" | "en";

export interface DCTestItem {
  category: string;
  subCategory?: string;
  testName: string;
  testNameTh?: string;
  unit?: string;
}

// Dynamic test results - support variable number of rounds
export interface TestResults {
  rounds: { h1: string; result: string }[][]; // Array of rounds, each round has array of items
  rcdValues: string[];
  remarks: string[];
  powerStandby: { L1: string; L2: string; L3: string }; // Power standby values
}

// Legacy format for backward compatibility
export interface LegacyTestResults {
  test1: { h1: string; result: string }[];
  test2: { h1: string; result: string }[];
  test3: { h1: string; result: string }[];
  rcdValues: string[];
  remarks: string[];
}

/* ===================== Translations ===================== */


export const translations = {
  th: {
    testingChecklist: "รายการทดสอบ",
    testResultsTitle: "ผลการทดสอบ (บันทึกผ่าน/ไม่ผ่าน) หรือค่าตัวเลข",
    remark: "หมายเหตุ",
    testRound: "ทดสอบครั้งที่",
    roundOf: "รอบที่ {n} / {total}",
    rcdValue: "ค่า RCD (Spec)",
    measuredValue: "ค่าที่วัดได้",
    isolationCheck: "ตรวจสอบ Isolation",
    remarkUsedForAll: "หมายเหตุ (ใช้สำหรับทุกรอบทดสอบ)",
    remarkPlaceholder: "หมายเหตุ...",
    valuePlaceholder: "ค่า",
    currentPlaceholder: "กระแส",
    pass: "ผ่าน",
    fail: "ไม่ผ่าน",
    electricalSafety: "ความปลอดภัยทางไฟฟ้า",
    peContinuity: "PE Continuity ตัวนำป้องกันของเครื่องชาร์จ",
    leftCover: "ฝาครอบซ้าย",
    rightCover: "ฝาครอบขวา",
    frontCover: "ฝาครอบหน้า",
    backCover: "ฝาครอบหลัง",
    pinPeH1: "Pin PE H.1",
    pinPeH2: "Pin PE H.2",
    rcdTypeA: "RCD ชนิด A",
    rcdTypeF: "RCD ชนิด F",
    rcdTypeB: "RCD ชนิด B",
    isolationTransformer: "หม้อแปลงแยก",
    powerStandby: "พลังงานขณะสแตนด์บาย",
    testValue: "ค่าที่วัดได้",
    peContinuitySection: "PE Continuity",
    rcdSection: "RCD",
    noRcd: "ไม่มี RCD ",
    otherSection: "อื่นๆ",
    addRound3: "เพิ่มรอบที่ 3",
    totalRounds: "รอบทดสอบ",
    rounds: "รอบ",
    round3Info: "รอบที่ 3 - ทดสอบซ้ำเฉพาะหัวข้อที่ไม่ผ่าน",
    allPassed: "ผ่านทุกหัวข้อทั้ง 2 รอบ",
    failedItemsCount: "หัวข้อที่ต้องทดสอบซ้ำ: {count} รายการ",
  },
  en: {
    testingChecklist: "Testing Checklist",
    testResultsTitle: "Test Results (Record as Pass/Fail) or Numeric Results",
    remark: "Remark",
    testRound: "Test Round",
    roundOf: "Round {n} / {total}",
    rcdValue: "RCD Value (Spec)",
    measuredValue: "Measured",
    isolationCheck: "Isolation check",
    remarkUsedForAll: "Remark (used for all test rounds)",
    remarkPlaceholder: "Remark...",
    valuePlaceholder: "Value",
    currentPlaceholder: "Current",
    pass: "Pass",
    fail: "Fail",
    electricalSafety: "Electrical Safety",
    peContinuity: "PE.Continuity protective Conductors of Charger",
    leftCover: "Left Cover",
    rightCover: "Right Cover",
    frontCover: "Front Cover",
    backCover: "Back Cover",
    pinPeH1: "Pin PE H.1",
    pinPeH2: "Pin PE H.2",
    rcdTypeA: "RCD type A",
    rcdTypeF: "RCD type F",
    rcdTypeB: "RCD type B",
    isolationTransformer: "Isolation Transformer",
    powerStandby: "Power standby",
    testValue: "Measured",
    peContinuitySection: "PE Continuity",
    rcdSection: "RCD",
    noRcd: "No RCD ",
    otherSection: "Others",
    addRound3: "Add Round 3",
    totalRounds: "Rounds",
    rounds: "rounds",
    round3Info: "Round 3 - Retest Failed Items",
    allPassed: "All items passed in both rounds",
    failedItemsCount: "Items to retest: {count}",
  },
};

// Helper to get test name based on language
const getTestName = (item: DCTestItem, lang: Lang, t: typeof translations["th"]): string => {
  if (lang === "th" && item.testNameTh) {
    return item.testNameTh;
  }
  
  const nameMap: Record<string, keyof typeof translations["th"]> = {
    "Left Cover": "leftCover",
    "Right Cover": "rightCover",
    "Front Cover": "frontCover",
    "Back Cover": "backCover",
    "Pin PE H.1": "pinPeH1",
    "Pin PE H.2": "pinPeH2",
    "RCD type A": "rcdTypeA",
    "RCD type F": "rcdTypeF",
    "RCD type B": "rcdTypeB",
    "Isolation Transformer": "isolationTransformer",
    "Power standby": "powerStandby",
  };

  const key = nameMap[item.testName];
  if (key && t[key]) {
    return t[key] as string;
  }
  
  return item.testName;
};

/* payload แบบแนะนำสำหรับ Mongo (รอบละชุด + ส่วนอื่น ๆ) */
export type ElectricalSafetyPayload = {
  electricalSafety: {
    peContinuity: {
      [key: string]: Record<
        "leftCover" | "rightCover" | "frontCover" | "backCover" | "pinPEH1" | "pinPEH2",
        { h1: string; result: string }
      >;
    };
    rcd: Record<string, any>;
    isolationTransformer: { pass: boolean };
    powerStandby: { [key: string]: string };
    remarks: Record<string, string>;
    totalRounds: number;
  };
};

/* ===================== UI: Pass/Fail/NA Buttons - REDESIGNED ===================== */

export const PassFailButtons: React.FC<{
  value: string;
  onChange: (v: string) => void;
  lang?: Lang;
  showNA?: boolean;
  disabled?: boolean;
  size?: "xs" | "sm" | "md";
  responsive?: boolean;
}> = ({ value, onChange, lang = "th", showNA = true, disabled = false, size = "md", responsive = false }) => {
  const isPass = value === "PASS" || value === "✓";
  const isFail = value === "FAIL" || value === "✗";
  const isNA = value === "NA";

  const baseClass = responsive
    ? "tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold tw-rounded-lg tw-transition-all tw-duration-200"
    : size === "xs"
    ? "tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-rounded-md tw-transition-all tw-duration-200"
    : size === "sm" 
    ? "tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold tw-rounded-lg tw-transition-all tw-duration-200"
    : "tw-px-4 tw-py-2 tw-text-sm tw-font-semibold tw-rounded-lg tw-transition-all tw-duration-200";

  return (
    <div className="tw-flex tw-gap-1.5">
      <button
        type="button"
        className={`${baseClass} ${
          isPass
            ? "tw-bg-green-500 tw-text-white tw-shadow-md tw-shadow-green-200"
            : "tw-bg-white tw-text-green-600 tw-border-2 tw-border-green-200 hover:tw-border-green-400 hover:tw-bg-green-50"
        } ${disabled ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
        onClick={() => !disabled && onChange(isPass ? "" : "PASS")}
        disabled={disabled}
      >
        ✓
      </button>
      <button
        type="button"
        className={`${baseClass} ${
          isFail
            ? "tw-bg-red-500 tw-text-white tw-shadow-md tw-shadow-red-200"
            : "tw-bg-white tw-text-red-600 tw-border-2 tw-border-red-200 hover:tw-border-red-400 hover:tw-bg-red-50"
        } ${disabled ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
        onClick={() => !disabled && onChange(isFail ? "" : "FAIL")}
        disabled={disabled}
      >
        ✗
      </button>
      {showNA && (
        <button
          type="button"
          className={`${baseClass} ${
            isNA
              ? "tw-bg-gray-500 tw-text-white tw-shadow-md tw-shadow-gray-200"
              : "tw-bg-white tw-text-gray-600 tw-border-2 tw-border-gray-200 hover:tw-border-gray-400 hover:tw-bg-gray-50"
          } ${disabled ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
          onClick={() => !disabled && onChange(isNA ? "" : "NA")}
          disabled={disabled}
        >
          N/A
        </button>
      )}
    </div>
  );
};

/* ===================== Data (รายการทดสอบ) ===================== */

export const DC_TEST_DATA: DCTestItem[] = [
  { category: "Electrical Safety", subCategory: "PE.Continuity protective Conductors of Charger", testName: "Left Cover", testNameTh: "ฝาครอบซ้าย", unit: "" },
  { category: "Electrical Safety", subCategory: "PE.Continuity protective Conductors of Charger", testName: "Right Cover", testNameTh: "ฝาครอบขวา", unit: "" },
  { category: "Electrical Safety", subCategory: "PE.Continuity protective Conductors of Charger", testName: "Front Cover", testNameTh: "ฝาครอบหน้า", unit: "" },
  { category: "Electrical Safety", subCategory: "PE.Continuity protective Conductors of Charger", testName: "Back Cover", testNameTh: "ฝาครอบหลัง", unit: "" },
  { category: "Electrical Safety", subCategory: "PE.Continuity protective Conductors of Charger", testName: "Pin PE H.1", testNameTh: "Pin PE H.1", unit: "" },
  { category: "Electrical Safety", subCategory: "PE.Continuity protective Conductors of Charger", testName: "Pin PE H.2", testNameTh: "Pin PE H.2", unit: "" },
  { category: "Electrical Safety", subCategory: "", testName: "RCD type A", testNameTh: "RCD ชนิด A", unit: "mA" },
  { category: "Electrical Safety", subCategory: "", testName: "RCD type F", testNameTh: "RCD ชนิด F", unit: "mA" },
  { category: "Electrical Safety", subCategory: "", testName: "RCD type B", testNameTh: "RCD ชนิด B", unit: "mA" },
  { category: "Electrical Safety", subCategory: "", testName: "Isolation Transformer", testNameTh: "หม้อแปลงแยก", unit: "" },
  { category: "Electrical Safety", subCategory: "", testName: "Power standby", testNameTh: "พลังงานขณะสแตนด์บาย", unit: "" },
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
    const letter = n.replace(/^RCD type\s*/i, "").trim();
    return ("rcdType" + letter.toUpperCase()) as "rcdTypeA" | "rcdTypeF" | "rcdTypeB";
  }
  if (/^Isolation Transformer$/i.test(n)) return "isolationTransformer";
  if (/^Power standby$/i.test(n)) return "powerStandby";
  return camelKey(n);
};

export function buildRemarks(results: TestResults, items: DCTestItem[]) {
  const remarks: Record<string, string> = {};
  items.forEach((it, i) => {
    remarks[nameKey(it.testName)] = results.remarks[i] ?? "";
  });
  return remarks;
}

const toPass = (v?: string) => {
  if (v === "✓" || v === "PASS") return "pass";
  if (v === "✗" || v === "FAIL") return "fail";
  if (v === "NA") return "na";
  return v ?? "";
};

export function mapToElectricalPayload(results: TestResults, items: DCTestItem[] = DC_TEST_DATA): ElectricalSafetyPayload {
  const findIndex = (name: string) => items.findIndex((it) => it.testName.toLowerCase() === name.toLowerCase());

  const iLeft = findIndex("Left Cover");
  const iRight = findIndex("Right Cover");
  const iFront = findIndex("Front Cover");
  const iBack = findIndex("Back Cover");
  const iPEH1 = findIndex("Pin PE H.1");
  const iPEH2 = findIndex("Pin PE H.2");

  const V = (roundData: { h1: string; result: string }[], i: number) => ({
    h1: i >= 0 ? roundData[i]?.h1 ?? "" : "",
    result: i >= 0 ? toPass(roundData[i]?.result) : "",
  });

  const peContinuity: { [key: string]: any } = {};
  results.rounds.forEach((roundData, idx) => {
    peContinuity[`r${idx + 1}`] = {
      leftCover: V(roundData, iLeft),
      rightCover: V(roundData, iRight),
      frontCover: V(roundData, iFront),
      backCover: V(roundData, iBack),
      pinPEH1: V(roundData, iPEH1),
      pinPEH2: V(roundData, iPEH2),
    };
  });

  const iRcdA = findIndex("RCD type A");
  const iRcdF = findIndex("RCD type F");
  const iRcdB = findIndex("RCD type B");
  
  const rcd: Record<string, any> = {
    typeA: { value: iRcdA >= 0 ? results.rcdValues[iRcdA] || "" : "", unit: "mA" },
    typeF: { value: iRcdF >= 0 ? results.rcdValues[iRcdF] || "" : "", unit: "mA" },
    typeB: { value: iRcdB >= 0 ? results.rcdValues[iRcdB] || "" : "", unit: "mA" },
  };
  
  results.rounds.forEach((roundData, idx) => {
    const roundKey = `r${idx + 1}`;
    rcd[roundKey] = {
      typeA: {
        tripTime: iRcdA >= 0 ? roundData[iRcdA]?.h1 || "" : "",
        tripTimeUnit: "mA",
        result: iRcdA >= 0 ? toPass(roundData[iRcdA]?.result) : "",
      },
      typeF: {
        tripTime: iRcdF >= 0 ? roundData[iRcdF]?.h1 || "" : "",
        tripTimeUnit: "mA",
        result: iRcdF >= 0 ? toPass(roundData[iRcdF]?.result) : "",
      },
      typeB: {
        tripTime: iRcdB >= 0 ? roundData[iRcdB]?.h1 || "" : "",
        tripTimeUnit: "mA",
        result: iRcdB >= 0 ? toPass(roundData[iRcdB]?.result) : "",
      },
    };
  });

  const iIso = findIndex("Isolation Transformer");
  const isolationTransformer = { pass: iIso >= 0 ? (results.rcdValues[iIso] === "✓" || results.rcdValues[iIso] === "PASS") : false };

  const powerStandby = {
    L1: results.powerStandby?.L1 ?? "",
    L2: results.powerStandby?.L2 ?? "",
    L3: results.powerStandby?.L3 ?? "",
  };

  const remarks = buildRemarks(results, items);

  return {
    electricalSafety: {
      peContinuity,
      rcd,
      isolationTransformer,
      powerStandby,
      remarks,
      totalRounds: results.rounds.length,
    },
  };
}

/* ===================== Conversion helpers ===================== */

export function convertLegacyToNew(legacy: LegacyTestResults): TestResults {
  const iPsb = DC_TEST_DATA.findIndex(it => it.testName.includes("Power standby"));
  
  return {
    rounds: [legacy.test1, legacy.test2, legacy.test3],
    rcdValues: legacy.rcdValues,
    remarks: legacy.remarks,
    powerStandby: {
      L1: iPsb >= 0 ? legacy.test1[iPsb]?.h1 ?? "" : "",
      L2: iPsb >= 0 ? legacy.test2[iPsb]?.h1 ?? "" : "",
      L3: iPsb >= 0 ? legacy.test3[iPsb]?.h1 ?? "" : "",
    },
  };
}

export function convertNewToLegacy(results: TestResults): LegacyTestResults {
  const iPsb = DC_TEST_DATA.findIndex(it => it.testName.includes("Power standby"));
  
  const test1 = [...(results.rounds[0] || [])];
  const test2 = [...(results.rounds[1] || [])];
  const test3 = [...(results.rounds[2] || [])];
  
  if (iPsb >= 0) {
    if (test1[iPsb]) test1[iPsb] = { ...test1[iPsb], h1: results.powerStandby.L1 };
    if (test2[iPsb]) test2[iPsb] = { ...test2[iPsb], h1: results.powerStandby.L2 };
    if (test3[iPsb]) test3[iPsb] = { ...test3[iPsb], h1: results.powerStandby.L3 };
  }
  
  return {
    test1,
    test2,
    test3,
    rcdValues: results.rcdValues,
    remarks: results.remarks,
  };
}

/* ===================== Internal: state factory ===================== */

const createEmptyRound = (itemCount: number): { h1: string; result: string }[] => {
  return new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" }));
};

const createEmptyResults = (itemCount: number, roundCount: number = 2): TestResults => ({
  rounds: new Array(roundCount).fill(null).map(() => createEmptyRound(itemCount)),
  rcdValues: new Array(itemCount).fill(""),
  remarks: new Array(itemCount).fill(""),
  powerStandby: { L1: "", L2: "", L3: "" },
});

/* ===================== Helper: Check if item passed in both rounds ===================== */

const isPassResult = (result: string | undefined): boolean => {
  return result === "PASS" || result === "✓";
};

const isFailResult = (result: string | undefined): boolean => {
  return result === "FAIL" || result === "✗";
};

const isNaResult = (result: string | undefined): boolean => {
  return result === "NA";
};

// Get indexes of items that failed in at least one of the first 2 rounds (need retest in round 3)
export const getFailedItemIndexes = (results: TestResults, testItems: DCTestItem[]): number[] => {
  const failedIndexes: number[] = [];
  
  testItems.forEach((item, index) => {
    const isIsolationTransformer = item.testName.includes("Isolation Transformer");
    const isPowerStandby = item.testName.includes("Power standby");
    
    // Skip Isolation Transformer and Power Standby (they are only in round 1)
    if (isIsolationTransformer || isPowerStandby) return;
    
    const round1Result = results.rounds[0]?.[index]?.result;
    const round2Result = results.rounds[1]?.[index]?.result;
    
    // If NA in either round, skip (not a failure)
    if (isNaResult(round1Result) || isNaResult(round2Result)) return;
    
    // Check if explicitly failed in either round (FAIL or ✗)
    const failedRound1 = isFailResult(round1Result);
    const failedRound2 = isFailResult(round2Result);
    
    // If failed in at least one round, add to failed list
    if (failedRound1 || failedRound2) {
      failedIndexes.push(index);
    }
  });
  
  return failedIndexes;
};

// Check if all items passed in both rounds (no FAIL results)
export const allItemsPassed = (results: TestResults, testItems: DCTestItem[]): boolean => {
  if (results.rounds.length < 2) return false;
  
  // Check if there are any failed items
  const failedIndexes = getFailedItemIndexes(results, testItems);
  if (failedIndexes.length > 0) return false;
  
  // Also check if all items have been tested (have PASS or NA result)
  let allTested = true;
  testItems.forEach((item, index) => {
    const isIsolationTransformer = item.testName.includes("Isolation Transformer");
    const isPowerStandby = item.testName.includes("Power standby");
    
    // Skip Isolation Transformer and Power Standby
    if (isIsolationTransformer || isPowerStandby) return;
    
    const round1Result = results.rounds[0]?.[index]?.result;
    const round2Result = results.rounds[1]?.[index]?.result;
    
    // If either round is empty, not all tested
    if (!round1Result || !round2Result) {
      // Exception: if round 1 is NA, round 2 can be empty (will be auto NA)
      if (isNaResult(round1Result)) return;
      allTested = false;
    }
  });
  
  return allTested;
};

/* ===================== Helper: Validation Checker ===================== */

export interface ValidationError {
  round?: number;
  itemIndex: number;
  itemName: string;
  field: string;
  message: string;
}

export const validateTestResults = (
  results: TestResults,
  items: DCTestItem[] = DC_TEST_DATA,
  lang: Lang = "th"
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  items.forEach((item, itemIndex) => {
    const isRCDItem = item.testName.includes("RCD");
    const isIsolationTransformer = item.testName.includes("Isolation Transformer");
    const isPowerStandby = item.testName.includes("Power standby");
    const displayName = getTestName(item, lang, t);

    if (isPowerStandby) {
      if (!results.powerStandby?.L1?.trim()) {
        errors.push({ itemIndex, itemName: displayName, field: "L1", message: lang === "th" ? "ยังไม่ได้กรอกค่า L1" : "L1 value is missing" });
      }
      if (!results.powerStandby?.L2?.trim()) {
        errors.push({ itemIndex, itemName: displayName, field: "L2", message: lang === "th" ? "ยังไม่ได้กรอกค่า L2" : "L2 value is missing" });
      }
      if (!results.powerStandby?.L3?.trim()) {
        errors.push({ itemIndex, itemName: displayName, field: "L3", message: lang === "th" ? "ยังไม่ได้กรอกค่า L3" : "L3 value is missing" });
      }
      return;
    }

    if (isIsolationTransformer) {
      const result = results.rcdValues[itemIndex];
      if (!result || (result !== "PASS" && result !== "FAIL" && result !== "✓" && result !== "✗")) {
        errors.push({ itemIndex, itemName: displayName, field: lang === "th" ? "ผลทดสอบ" : "Result", message: lang === "th" ? "ยังไม่ได้เลือก PASS/FAIL" : "PASS/FAIL not selected" });
      }
      return;
    }

    if (isRCDItem) {
      const firstRoundResult = results.rounds[0]?.[itemIndex]?.result;
      if (firstRoundResult === "NA") return;

      if (!results.rcdValues[itemIndex]?.trim()) {
        errors.push({ round: 1, itemIndex, itemName: displayName, field: lang === "th" ? "ค่า RCD" : "RCD Value", message: lang === "th" ? "ยังไม่ได้กรอกค่า RCD (mA)" : "RCD value (mA) is missing" });
      }

      results.rounds.forEach((roundData, roundIndex) => {
        const roundResult = roundData[itemIndex]?.result;
        if (roundResult === "NA") return;

        if (!roundData[itemIndex]?.h1?.trim()) {
          errors.push({ round: roundIndex + 1, itemIndex, itemName: displayName, field: lang === "th" ? "เวลา Trip" : "Trip Time", message: lang === "th" ? `รอบ ${roundIndex + 1}: ยังไม่ได้กรอกค่าเวลา (s)` : `Round ${roundIndex + 1}: Trip time (s) is missing` });
        }

        if (!roundResult || (roundResult !== "PASS" && roundResult !== "FAIL" && roundResult !== "NA" && roundResult !== "✓" && roundResult !== "✗")) {
          errors.push({ round: roundIndex + 1, itemIndex, itemName: displayName, field: lang === "th" ? "ผลทดสอบ" : "Result", message: lang === "th" ? `รอบ ${roundIndex + 1}: ยังไม่ได้เลือก PASS/FAIL/NA` : `Round ${roundIndex + 1}: PASS/FAIL/NA not selected` });
        }
      });
      return;
    }

    results.rounds.forEach((roundData, roundIndex) => {
      const result = roundData[itemIndex]?.result;
      
      // Skip h1 validation if result is NA
      if (result !== "NA" && !roundData[itemIndex]?.h1?.trim()) {
        errors.push({ round: roundIndex + 1, itemIndex, itemName: displayName, field: lang === "th" ? "ค่าที่วัดได้" : "Measured", message: lang === "th" ? `รอบ ${roundIndex + 1}: ยังไม่ได้กรอกค่า (Ω)` : `Round ${roundIndex + 1}: Measured (Ω) is missing` });
      }

      if (!result || (result !== "PASS" && result !== "FAIL" && result !== "NA" && result !== "✓" && result !== "✗")) {
        errors.push({ round: roundIndex + 1, itemIndex, itemName: displayName, field: lang === "th" ? "ผลทดสอบ" : "Result", message: lang === "th" ? `รอบ ${roundIndex + 1}: ยังไม่ได้เลือก PASS/FAIL/NA` : `Round ${roundIndex + 1}: PASS/FAIL/NA not selected` });
      }
    });
  });

  return errors;
};

export const groupErrorsByItem = (errors: ValidationError[]): Map<string, ValidationError[]> => {
  const grouped = new Map<string, ValidationError[]>();
  errors.forEach((error) => {
    const existing = grouped.get(error.itemName) || [];
    existing.push(error);
    grouped.set(error.itemName, existing);
  });
  return grouped;
};

/* ===================== Helper: Check if RCD is disabled ===================== */

const isRcdDisabledForRound = (results: TestResults, itemIndex: number, currentRoundIndex: number): boolean => {
  for (let i = 0; i < currentRoundIndex; i++) {
    const result = results.rounds[i]?.[itemIndex]?.result;
    if (result === "NA") return true;
  }
  return false;
};

const isRcdNaInCurrentRound = (results: TestResults, itemIndex: number, currentRoundIndex: number): boolean => {
  const result = results.rounds[currentRoundIndex]?.[itemIndex]?.result;
  return result === "NA";
};

/* ===================== UI: Test Round Card - REDESIGNED ===================== */

interface TestRoundCardProps {
  roundNumber: number;
  totalRounds: number;
  testItems: DCTestItem[];
  results: TestResults;
  onResultChange: (roundIndex: number, itemIndex: number, field: "h1" | "result", value: string) => void;
  onRcdChange: (itemIndex: number, value: string) => void;
  onRemarkChange: (itemIndex: number, value: string) => void;
  onPowerStandbyChange: (phase: "L1" | "L2" | "L3", value: string) => void;
  onRemoveRound: () => void;
  lang: Lang;
  t: typeof translations["th"];
  isFirstRound: boolean;
  isRound3?: boolean;
  failedItemIndexes?: number[];
  canRemove?: boolean;
}

const TestRoundCard: React.FC<TestRoundCardProps> = ({
  roundNumber,
  totalRounds,
  testItems,
  results,
  onResultChange,
  onRcdChange,
  onRemarkChange,
  onPowerStandbyChange,
  onRemoveRound,
  lang,
  t,
  isFirstRound,
  isRound3 = false,
  failedItemIndexes = [],
  canRemove = false,
}) => {
  const roundIndex = roundNumber - 1;

  const getTestResult = (itemIndex: number) => {
    return results.rounds[roundIndex]?.[itemIndex] || { h1: "", result: "" };
  };

  // Filter items based on whether this is round 3
  const getFilteredItems = (items: DCTestItem[]) => {
    if (!isRound3) return items;
    return items.filter(item => {
      const globalIndex = testItems.findIndex(ti => ti.testName === item.testName);
      return failedItemIndexes.includes(globalIndex);
    });
  };

  const peContinuityItems = testItems.filter(item => item.subCategory?.includes("PE.Continuity"));
  const rcdItems = testItems.filter(item => item.testName.includes("RCD"));
  const otherItems = testItems.filter(item => !item.subCategory?.includes("PE.Continuity") && !item.testName.includes("RCD"));

  // For round 3, filter to only show failed items
  const filteredPeContinuityItems = getFilteredItems(peContinuityItems);
  const filteredRcdItems = getFilteredItems(rcdItems);

  const renderTestItem = (item: DCTestItem, index: number, itemNumber: number) => {
    const isPowerStandby = item.testName.includes("Power standby");
    const isRCDItem = item.testName.includes("RCD");
    const isIsolationTransformer = item.testName.includes("Isolation Transformer");
    const displayName = getTestName(item, lang, t);
    const currentResult = getTestResult(index);

    const isDisabledFromPreviousRound = isRCDItem && isRcdDisabledForRound(results, index, roundIndex);
    const isDisabledInCurrentRound = isRCDItem && isRcdNaInCurrentRound(results, index, roundIndex);
    const isRcdInputDisabled = isDisabledFromPreviousRound || isDisabledInCurrentRound;
    const isRcdButtonsDisabled = isDisabledFromPreviousRound;
    
    // Check if NA is selected for current item (disable input)
    const isNaSelected = currentResult?.result === "NA";

    const itemId = `test-item-${index}-round-${roundNumber}`;

    // Show previous round results for round 3 with failed items (auto-added only)
    const showPreviousResults = isRound3 && failedItemIndexes.length > 0 && !canRemove;
    const round1Result = results.rounds[0]?.[index]?.result;
    const round2Result = results.rounds[1]?.[index]?.result;

    return (
      <div
        id={itemId}
        key={`${roundNumber}-${item.testName}`}
        className={`tw-py-3 lg:tw-py-4 tw-px-3 lg:tw-px-5 tw-transition-all tw-duration-300 hover:tw-bg-gray-50/50 tw-border-b tw-border-gray-100 last:tw-border-b-0 ${isDisabledFromPreviousRound ? 'tw-opacity-50' : ''}`}
      >
        {/* Test Name with number */}
        <div className="tw-flex tw-items-center tw-gap-2 lg:tw-gap-3 tw-mb-2 lg:tw-mb-3">
          <span className="tw-w-6 tw-h-6 lg:tw-w-8 lg:tw-h-8 tw-rounded-full tw-bg-gray-200 tw-text-gray-700 tw-text-xs lg:tw-text-sm tw-font-bold tw-flex tw-items-center tw-justify-center">
            {itemNumber}
          </span>
          <Typography className="tw-font-semibold tw-text-gray-800 tw-text-sm lg:tw-text-base">
            {displayName}
            {isDisabledFromPreviousRound && (
              <span className="tw-ml-2 tw-text-xs tw-text-gray-400 tw-font-normal">(N/A)</span>
            )}
          </Typography>
          
          {/* Show previous round results for round 3 */}
          {showPreviousResults && (
            <div className="tw-flex tw-gap-2 tw-ml-auto">
              <span className={`tw-text-xs tw-px-2 tw-py-0.5 tw-rounded ${isPassResult(round1Result) ? 'tw-bg-green-100 tw-text-green-700' : 'tw-bg-red-100 tw-text-red-700'}`}>
                R1: {isPassResult(round1Result) ? '✓' : '✗'}
              </span>
              <span className={`tw-text-xs tw-px-2 tw-py-0.5 tw-rounded ${isPassResult(round2Result) ? 'tw-bg-green-100 tw-text-green-700' : 'tw-bg-red-100 tw-text-red-700'}`}>
                R2: {isPassResult(round2Result) ? '✓' : '✗'}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="tw-flex tw-flex-col tw-gap-2 lg:tw-gap-3">
          {/* RCD Items - Separate rows for Spec and Measured */}
          {isRCDItem && (
            <>
              {/* Row 1: RCD Value (Spec) - only in first round */}
              {isFirstRound && (
                <div className="tw-flex tw-items-center tw-gap-2 lg:tw-gap-3">
                  <div className="tw-flex tw-items-center tw-gap-1 lg:tw-gap-2 tw-bg-gradient-to-r tw-from-gray-100 tw-to-transparent tw-rounded-xl tw-p-2 lg:tw-p-3 tw-min-w-[180px] lg:tw-min-w-[220px]">
                    <span className="tw-text-xs tw-text-gray-500 tw-font-medium tw-whitespace-nowrap">{t.rcdValue}</span>
                    <input
                      type="text"
                      value={results.rcdValues[index] || ""}
                      onChange={(e) => onRcdChange(index, e.target.value)}
                      className="tw-w-14 lg:tw-w-20 tw-px-2 lg:tw-px-3 tw-py-1.5 lg:tw-py-2 tw-text-xs lg:tw-text-sm tw-text-center tw-border tw-border-gray-200 tw-rounded-lg tw-bg-white focus:tw-border-gray-400 focus:tw-ring-2 focus:tw-ring-gray-200 tw-outline-none tw-transition-all disabled:tw-bg-gray-100 disabled:tw-cursor-not-allowed"
                      disabled={isRcdInputDisabled}
                      placeholder={t.valuePlaceholder}
                    />
                    <div className="tw-flex tw-items-center tw-justify-center tw-px-2 lg:tw-px-3 tw-py-1 lg:tw-py-1.5 tw-bg-gray-800 tw-text-white tw-font-bold tw-text-xs tw-rounded-lg">
                      mA
                    </div>
                  </div>
                </div>
              )}
              
              {/* Row 2: Measured Value + Pass/Fail + Remark */}
              <div className="tw-flex tw-flex-wrap lg:tw-flex-nowrap tw-items-center tw-gap-2 lg:tw-gap-3">
                <div className="tw-flex tw-items-center tw-gap-1 lg:tw-gap-2 tw-bg-gradient-to-r tw-from-gray-100 tw-to-transparent tw-rounded-xl tw-p-2 lg:tw-p-3 tw-min-w-[180px] lg:tw-min-w-[220px]">
                  <span className="tw-text-xs tw-text-gray-500 tw-font-medium tw-whitespace-nowrap">{t.measuredValue}</span>
                  <input
                    type="text"
                    value={currentResult?.h1 || ""}
                    onChange={(e) => onResultChange(roundIndex, index, "h1", e.target.value)}
                    className="tw-w-14 lg:tw-w-20 tw-px-2 lg:tw-px-3 tw-py-1.5 lg:tw-py-2 tw-text-xs lg:tw-text-sm tw-text-center tw-border tw-border-gray-200 tw-rounded-lg tw-bg-white focus:tw-border-gray-400 focus:tw-ring-2 focus:tw-ring-gray-200 tw-outline-none tw-transition-all disabled:tw-bg-gray-100 disabled:tw-cursor-not-allowed"
                    placeholder={t.valuePlaceholder}
                    disabled={isRcdInputDisabled}
                  />
                  <div className="tw-flex tw-items-center tw-justify-center tw-px-2 lg:tw-px-3 tw-py-1 lg:tw-py-1.5 tw-bg-gray-800 tw-text-white tw-font-bold tw-text-xs tw-rounded-lg">
                    mA
                  </div>
                </div>
                
                {/* Desktop: PassFailButtons inline */}
                <div className="tw-hidden lg:tw-block">
                  <PassFailButtons
                    value={currentResult?.result || ""}
                    onChange={(v) => onResultChange(roundIndex, index, "result", v)}
                    lang={lang}
                    disabled={isRcdButtonsDisabled}
                    responsive
                  />
                </div>
                
                {/* Desktop only: Remark inline */}
                <div className="tw-hidden lg:tw-block tw-w-[150px] tw-flex-shrink-0 tw-ml-auto">
                  <input
                    type="text"
                    value={results.remarks[index] || ""}
                    onChange={(e) => onRemarkChange(index, e.target.value)}
                    className="tw-w-full tw-px-2 tw-py-1.5 tw-text-xs tw-border tw-border-gray-300 tw-rounded-lg tw-bg-white focus:tw-border-gray-500 focus:tw-ring-2 focus:tw-ring-gray-300 tw-outline-none tw-transition-all placeholder:tw-text-gray-500"
                    placeholder={t.remarkPlaceholder}
                  />
                </div>
              </div>
              
              {/* Mobile only: PassFailButtons + Remark */}
              <div className="tw-flex lg:tw-hidden tw-items-center tw-justify-between tw-gap-2">
                <PassFailButtons
                  value={currentResult?.result || ""}
                  onChange={(v) => onResultChange(roundIndex, index, "result", v)}
                  lang={lang}
                  disabled={isRcdButtonsDisabled}
                  responsive
                />
                <div className="tw-w-[120px] tw-flex-shrink-0">
                  <input
                    type="text"
                    value={results.remarks[index] || ""}
                    onChange={(e) => onRemarkChange(index, e.target.value)}
                    className="tw-w-full tw-px-2 tw-py-1.5 tw-text-xs tw-border tw-border-gray-300 tw-rounded-lg tw-bg-white focus:tw-border-gray-500 focus:tw-ring-2 focus:tw-ring-gray-300 tw-outline-none tw-transition-all placeholder:tw-text-gray-500"
                    placeholder={t.remarkPlaceholder}
                  />
                </div>
              </div>
            </>
          )}

          {/* Non-RCD Items */}
          {!isRCDItem && (
          <>
          <div className="tw-flex tw-flex-wrap lg:tw-flex-nowrap tw-items-center tw-gap-2 lg:tw-gap-3">

            {/* Isolation Transformer */}
            {isIsolationTransformer && isFirstRound && (
              <>
                {/* Desktop only */}
                <div className="tw-hidden lg:tw-flex tw-items-center tw-gap-2 lg:tw-gap-3 tw-bg-gradient-to-r tw-from-gray-100 tw-to-transparent tw-rounded-xl tw-p-2 lg:tw-p-3">
                  <PassFailButtons
                    value={results.rcdValues[index] || ""}
                    onChange={(v) => onRcdChange(index, v)}
                    lang={lang}
                    showNA={false}
                    responsive
                  />
                </div>
              </>
            )}

            {/* Power Standby - L1, L2, L3 */}
            {isPowerStandby && isFirstRound && (
              <div className="tw-grid tw-grid-cols-2 lg:tw-flex lg:tw-flex-nowrap tw-gap-1 lg:tw-gap-2">
                {(["L1", "L2", "L3"] as const).map((phase) => (
                  <div key={phase} className="tw-flex tw-items-center tw-gap-1 lg:tw-gap-2 tw-bg-gradient-to-r tw-from-gray-100 tw-to-transparent tw-rounded-xl tw-p-2 lg:tw-p-3">
                    <div className="tw-flex tw-items-center tw-justify-center tw-w-8 lg:tw-w-10 tw-h-6 lg:tw-h-8 tw-bg-gray-800 tw-text-white tw-font-bold tw-text-xs tw-rounded-lg">
                      {phase}
                    </div>
                    <input
                      type="text"
                      value={results.powerStandby?.[phase] || ""}
                      onChange={(e) => onPowerStandbyChange(phase, e.target.value)}
                      className="tw-w-12 lg:tw-w-16 tw-px-1 lg:tw-px-2 tw-py-1.5 lg:tw-py-2 tw-text-xs lg:tw-text-sm tw-text-center tw-border tw-border-gray-200 tw-rounded-lg tw-bg-white focus:tw-border-gray-400 focus:tw-ring-2 focus:tw-ring-gray-200 tw-outline-none tw-transition-all"
                      placeholder={t.valuePlaceholder}
                    />
                    <span className="tw-text-xs tw-text-gray-500">A</span>
                  </div>
                ))}
              </div>
            )}

            {/* PE Continuity - Standard items */}
            {!isRCDItem && !isPowerStandby && !isIsolationTransformer && (
              <>
                <div className={`tw-flex tw-items-center tw-gap-1 lg:tw-gap-2 tw-bg-gradient-to-r tw-from-gray-100 tw-to-transparent tw-rounded-xl tw-p-2 lg:tw-p-3 ${isNaSelected ? 'tw-opacity-50' : ''}`}>
                  <span className="tw-text-xs tw-text-gray-500 tw-font-medium tw-mr-1">{t.testValue}</span>
                  <input
                    type="text"
                    value={currentResult?.h1 || ""}
                    onChange={(e) => onResultChange(roundIndex, index, "h1", e.target.value)}
                    className="tw-w-14 lg:tw-w-20 tw-px-2 lg:tw-px-3 tw-py-1.5 lg:tw-py-2 tw-text-xs lg:tw-text-sm tw-text-center tw-border tw-border-gray-200 tw-rounded-lg tw-bg-white focus:tw-border-gray-400 focus:tw-ring-2 focus:tw-ring-gray-200 tw-outline-none tw-transition-all disabled:tw-bg-gray-100 disabled:tw-cursor-not-allowed"
                    placeholder={t.valuePlaceholder}
                    disabled={isNaSelected}
                  />

                  <div className="tw-flex tw-items-center tw-justify-center tw-px-2 lg:tw-px-3 tw-py-1 lg:tw-py-1.5 tw-bg-gray-800 tw-text-white tw-font-bold tw-text-xs tw-rounded-lg">
                    Ω
                  </div>
                </div>
                {/* Desktop only: PassFailButtons inline */}
                <div className="tw-hidden lg:tw-block">
                  <PassFailButtons
                    value={currentResult?.result || ""}
                    onChange={(v) => onResultChange(roundIndex, index, "result", v)}
                    lang={lang}
                    responsive
                  />
                </div>
              </>
            )}

            {/* Desktop only: Remark inline */}
            <div className="tw-hidden lg:tw-block tw-w-[150px] tw-flex-shrink-0 tw-ml-auto">
              <input
                type="text"
                value={results.remarks[index] || ""}
                onChange={(e) => onRemarkChange(index, e.target.value)}
                className="tw-w-full tw-px-2 tw-py-1.5 tw-text-xs tw-border tw-border-gray-300 tw-rounded-lg tw-bg-white focus:tw-border-gray-500 focus:tw-ring-2 focus:tw-ring-gray-300 tw-outline-none tw-transition-all placeholder:tw-text-gray-500"
                placeholder={t.remarkPlaceholder}
              />
            </div>
          </div>

          {/* Row 2: Mobile only - PassFailButtons + Remark (Non-RCD items) */}
          <div className="tw-flex lg:tw-hidden tw-items-center tw-justify-between tw-gap-2">
            {/* PassFailButtons for mobile */}
            {isIsolationTransformer && isFirstRound && (
              <PassFailButtons
                value={results.rcdValues[index] || ""}
                onChange={(v) => onRcdChange(index, v)}
                lang={lang}
                showNA={false}
                responsive
              />
            )}
            {!isPowerStandby && !isIsolationTransformer && (
              <PassFailButtons
                value={currentResult?.result || ""}
                onChange={(v) => onResultChange(roundIndex, index, "result", v)}
                lang={lang}
                responsive
              />
            )}
            {isPowerStandby && <div />}

            {/* Remark for mobile */}
            <div className="tw-w-[120px] tw-flex-shrink-0">
              <input
                type="text"
                value={results.remarks[index] || ""}
                onChange={(e) => onRemarkChange(index, e.target.value)}
                className="tw-w-full tw-px-2 tw-py-1.5 tw-text-xs tw-border tw-border-gray-300 tw-rounded-lg tw-bg-white focus:tw-border-gray-500 focus:tw-ring-2 focus:tw-ring-gray-300 tw-outline-none tw-transition-all placeholder:tw-text-gray-500"
                placeholder={t.remarkPlaceholder}
              />
            </div>
          </div>
          </>
        )}
        </div>
      </div>
    );
  };

  const renderSection = (title: string, items: DCTestItem[], startNumber: number) => {
    if (items.length === 0) return null;
    return (
      <div className="tw-mb-4">
        {/* Section Header */}
        <div className="tw-flex tw-items-center tw-gap-3 tw-mb-3 tw-px-5 tw-py-3 tw-bg-gray-50">
          <div className="tw-w-2 tw-h-6 tw-bg-gray-700 tw-rounded-full" />
          <Typography className="tw-font-bold tw-text-gray-700 tw-text-sm tw-uppercase tw-tracking-wider">
            {title}
          </Typography>
        </div>
        {/* Section Items */}
        <div>
          {items.map((item, idx) => {
            const globalIndex = testItems.findIndex(ti => ti.testName === item.testName);
            return renderTestItem(item, globalIndex, startNumber + idx);
          })}
        </div>
      </div>
    );
  };

  // Check if all RCD items are N/A in round 1
  const allRcdNaInRound1 = rcdItems.every(item => {
    const globalIndex = testItems.findIndex(ti => ti.testName === item.testName);
    return results.rounds[0]?.[globalIndex]?.result === "NA";
  });

  // Render RCD section with "No RCD" message for round 2 and 3
  const renderRcdSection = (items: DCTestItem[], startNumber: number) => {
    if (items.length === 0) return null;
    
    // For round 2 and 3, if all RCD are N/A in round 1, show "No RCD" message
    if (!isFirstRound && allRcdNaInRound1) {
      return (
        <div className="tw-mb-4">
          {/* Section Header */}
          <div className="tw-flex tw-items-center tw-gap-3 tw-mb-3 tw-px-5 tw-py-3 tw-bg-gray-50">
            <div className="tw-w-2 tw-h-6 tw-bg-gray-700 tw-rounded-full" />
            <Typography className="tw-font-bold tw-text-gray-700 tw-text-sm tw-uppercase tw-tracking-wider">
              {t.rcdSection}
            </Typography>
          </div>
          {/* No RCD Message */}
          <div className="tw-px-5 tw-py-6 tw-text-center">
            <div className="tw-inline-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2 tw-bg-gray-100 tw-rounded-lg">
              <svg className="tw-w-5 tw-h-5 tw-text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span className="tw-text-gray-600 tw-font-medium">{t.noRcd}</span>
            </div>
          </div>
        </div>
      );
    }
    
    // Normal render
    return renderSection(t.rcdSection, items, startNumber);
  };

  // Determine max rounds display based on whether round 3 exists
  const maxRoundsDisplay = totalRounds >= 3 ? "3" : "2";
  
  // Check if round 3 has failed items AND is auto-added (should show in red)
  // canRemove means it's manually added, so don't show red
  const isRound3WithFailedItems = isRound3 && failedItemIndexes.length > 0 && !canRemove;

  return (
    <div className={`tw-rounded-2xl tw-border ${isRound3WithFailedItems ? 'tw-border-red-300' : 'tw-border-gray-200'} tw-bg-white tw-shadow-sm tw-overflow-hidden`}>
      {/* Round Header */}
      <div className={`${isRound3WithFailedItems ? 'tw-bg-red-600' : 'tw-bg-gray-800'} tw-px-5 tw-py-4`}>
        <div className="tw-flex tw-items-center tw-justify-between">
          <div className="tw-flex tw-items-center tw-gap-4">
            <div className={`tw-w-10 tw-h-10 tw-rounded-xl ${isRound3WithFailedItems ? 'tw-bg-red-400/30' : 'tw-bg-white/20'} tw-backdrop-blur tw-flex tw-items-center tw-justify-center tw-text-lg tw-font-bold tw-text-white`}>
              {roundNumber}
            </div>
            <div>
              <Typography className="tw-font-bold tw-text-white tw-text-lg">
                {t.testRound} {roundNumber}
              </Typography>
              <Typography className="tw-text-white/80 tw-text-sm">
                {isRound3WithFailedItems ? t.round3Info : t.roundOf.replace("{n}", String(roundNumber)).replace("{total}", maxRoundsDisplay)}
              </Typography>
            </div>
          </div>
          {/* Delete button for manual round 3 */}
          {canRemove && (
            <button
              type="button"
              className="tw-p-2 tw-rounded-lg tw-text-white/70 hover:tw-text-white hover:tw-bg-white/20 tw-transition-all"
              onClick={onRemoveRound}
            >
              <svg className="tw-w-5 tw-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="tw-bg-white">
        {isRound3WithFailedItems ? (
          // Round 3 with failed items: Only show failed items (red theme)
          <>
            {renderSection(t.peContinuitySection, filteredPeContinuityItems, 1)}
            {renderRcdSection(filteredRcdItems, filteredPeContinuityItems.length + 1)}
          </>
        ) : (
          // Round 1, 2, or Round 3 normal: Show all items
          <>
            {renderSection(t.peContinuitySection, peContinuityItems, 1)}
            {renderRcdSection(rcdItems, peContinuityItems.length + 1)}
            {isFirstRound && renderSection(t.otherSection, otherItems, peContinuityItems.length + rcdItems.length + 1)}
          </>
        )}
      </div>
    </div>
  );
};

/* ===================== UI: Main Grid Component ===================== */

interface TestResultsGridProps {
  title?: string;
  testItems: DCTestItem[];
  results: TestResults;
  onResultChange: (roundIndex: number, itemIndex: number, field: "h1" | "result", value: string) => void;
  onRcdChange: (itemIndex: number, value: string) => void;
  onRemarkChange: (itemIndex: number, value: string) => void;
  onPowerStandbyChange: (phase: "L1" | "L2" | "L3", value: string) => void;
  onAddRound: () => void;
  onRemoveRound: () => void;
  lang: Lang;
  t: typeof translations["th"];
  isRound3Manual: boolean;
}

const TestResultsGrid: React.FC<TestResultsGridProps> = ({
  title,
  testItems,
  results,
  onResultChange,
  onRcdChange,
  onRemarkChange,
  onPowerStandbyChange,
  onAddRound,
  onRemoveRound,
  lang,
  t,
  isRound3Manual,
}) => {
  const totalRounds = results.rounds.length;
  
  // Calculate failed item indexes for round 3
  const failedItemIndexes = useMemo(() => {
    return getFailedItemIndexes(results, testItems);
  }, [results, testItems]);
  
  const allPassed = allItemsPassed(results, testItems);

  return (
    <div className="tw-space-y-6">
      {/* Page Title */}
      <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-start sm:tw-items-center tw-justify-between tw-gap-4">
        <div>
          <Typography variant="h6" className="tw-text-gray-800 tw-font-bold">
            {title || t.testResultsTitle}
          </Typography>
          <div className="tw-flex tw-items-center tw-gap-2 tw-mt-1">
            <span className="tw-inline-flex tw-items-center tw-px-2.5 tw-py-1 tw-rounded-full tw-text-xs tw-font-medium tw-bg-gray-200 tw-text-gray-700">
              {t.totalRounds}: {totalRounds}/{totalRounds === 3 ? 3 : 2}
            </span>
            {totalRounds === 3 && failedItemIndexes.length > 0 && !isRound3Manual && (
              <span className="tw-inline-flex tw-items-center tw-px-2.5 tw-py-1 tw-rounded-full tw-text-xs tw-font-medium tw-bg-red-100 tw-text-red-700">
                {t.failedItemsCount.replace("{count}", String(failedItemIndexes.length))}
              </span>
            )}
            {totalRounds === 2 && allPassed && (
              <span className="tw-inline-flex tw-items-center tw-px-2.5 tw-py-1 tw-rounded-full tw-text-xs tw-font-medium tw-bg-green-100 tw-text-green-700">
                ✓ {t.allPassed}
              </span>
            )}
          </div>
        </div>
        {/* Show add round 3 button when all passed and no round 3 yet */}
        {totalRounds === 2 && allPassed && (
          <button
            type="button"
            className="tw-inline-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2.5 tw-bg-gray-800 tw-text-white tw-rounded-xl tw-font-medium tw-text-sm hover:tw-bg-gray-700 tw-transition-all tw-shadow-sm"
            onClick={onAddRound}
          >
            <svg className="tw-w-5 tw-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t.addRound3}
          </button>
        )}
      </div>

      {/* Test Rounds */}
      <div className="tw-space-y-6">
        {results.rounds.map((_, idx) => (
          <TestRoundCard
            key={idx}
            roundNumber={idx + 1}
            totalRounds={totalRounds}
            testItems={testItems}
            results={results}
            onResultChange={onResultChange}
            onRcdChange={onRcdChange}
            onRemarkChange={onRemarkChange}
            onPowerStandbyChange={onPowerStandbyChange}
            onRemoveRound={onRemoveRound}
            lang={lang}
            t={t}
            isFirstRound={idx === 0}
            isRound3={idx === 2}
            failedItemIndexes={failedItemIndexes}
            canRemove={idx === 2 && isRound3Manual}
          />
        ))}
      </div>
    </div>
  );
};

/* ===================== Component (export default) ===================== */

export interface DCTestGridProps {
  initialResults?: TestResults | LegacyTestResults;
  onResultsChange?: (results: TestResults) => void;
  initialRounds?: number;
}

const DCTest1Grid: React.FC<DCTestGridProps> = ({ initialResults, onResultsChange, initialRounds = 2 }) => {
  const getInitialResults = (): TestResults => {
    if (!initialResults) {
      return createEmptyResults(DC_TEST_DATA.length, initialRounds);
    }
    
    if ('test1' in initialResults && 'test2' in initialResults && 'test3' in initialResults) {
      const converted = convertLegacyToNew(initialResults as LegacyTestResults);
      // If legacy has 3 rounds but we want 2, keep only 2
      if (initialRounds === 2 && converted.rounds.length === 3) {
        converted.rounds = converted.rounds.slice(0, 2);
      }
      return converted;
    }
    
    const newResults = { ...(initialResults as TestResults) };
    if (!newResults.powerStandby) {
      newResults.powerStandby = { L1: "", L2: "", L3: "" };
    }
    
    // Ensure at least 2 rounds
    if (newResults.rounds.length < 2) {
      const newRounds = [...newResults.rounds];
      while (newRounds.length < 2) {
        newRounds.push(createEmptyRound(DC_TEST_DATA.length));
      }
      newResults.rounds = newRounds;
    }
    
    return newResults;
  };

  const [results, setResults] = useState<TestResults>(getInitialResults);
  const [isRound3Manual, setIsRound3Manual] = useState<boolean>(false);

  useEffect(() => {
    if (initialResults) {
      let newResults: TestResults;
      if ('test1' in initialResults) {
        const converted = convertLegacyToNew(initialResults as LegacyTestResults);
        if (initialRounds === 2 && converted.rounds.length === 3) {
          converted.rounds = converted.rounds.slice(0, 2);
        }
        newResults = converted;
      } else {
        newResults = { ...(initialResults as TestResults) };
        if (!newResults.powerStandby) {
          newResults.powerStandby = { L1: "", L2: "", L3: "" };
        }
      }
      
      // Ensure at least 2 rounds
      if (newResults.rounds.length < 2) {
        const newRounds = [...newResults.rounds];
        while (newRounds.length < 2) {
          newRounds.push(createEmptyRound(DC_TEST_DATA.length));
        }
        newResults = { ...newResults, rounds: newRounds };
      }
      
      setResults(newResults);
    }
  }, [initialResults, initialRounds]);

  const [lang, setLang] = useState<Lang>("th");

  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") {
      setLang(savedLang);
    }

    const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => {
      setLang(e.detail.lang);
    };

    window.addEventListener("language:change", handleLangChange as EventListener);

    return () => {
      window.removeEventListener("language:change", handleLangChange as EventListener);
    };
  }, []);

  const t = translations[lang];

  // Auto add round 3 when there are items that failed in at least one round (only if not manual)
  useEffect(() => {
    if (results.rounds.length === 2 && !isRound3Manual) {
      const failedIndexes = getFailedItemIndexes(results, DC_TEST_DATA);
      if (failedIndexes.length > 0) {
        // Auto add round 3
        const newRound = createEmptyRound(DC_TEST_DATA.length);
        
        DC_TEST_DATA.forEach((item, idx) => {
          if (item.testName.includes("RCD")) {
            const hasNaInPreviousRounds = results.rounds.some(round => round[idx]?.result === "NA");
            if (hasNaInPreviousRounds) {
              newRound[idx] = { h1: "", result: "NA" };
            }
          }
        });
        
        const newResults = {
          ...results,
          rounds: [...results.rounds, newRound]
        };
        setResults(newResults);
        onResultsChange?.(newResults);
      }
    }
  }, [JSON.stringify(results.rounds.slice(0, 2))]); // Watch for changes in round 1 and 2

  // Auto remove round 3 when all items pass in both rounds (only if not manually added)
  useEffect(() => {
    if (results.rounds.length === 3 && !isRound3Manual) {
      const failedIndexes = getFailedItemIndexes(results, DC_TEST_DATA);
      
      // Remove round 3 immediately if no failed items (all passed)
      if (failedIndexes.length === 0) {
        const newResults = {
          ...results,
          rounds: results.rounds.slice(0, 2)
        };
        setResults(newResults);
        onResultsChange?.(newResults);
      }
    }
  }, [JSON.stringify(results.rounds.slice(0, 2)), results.rounds.length, isRound3Manual]); // Watch for changes

  // Manual add round 3 (when all passed but user wants to add)
  const handleAddRound = () => {
    if (results.rounds.length >= 3) return;
    
    const newRound = createEmptyRound(DC_TEST_DATA.length);
    
    DC_TEST_DATA.forEach((item, idx) => {
      if (item.testName.includes("RCD")) {
        const hasNaInPreviousRounds = results.rounds.some(round => round[idx]?.result === "NA");
        if (hasNaInPreviousRounds) {
          newRound[idx] = { h1: "", result: "NA" };
        }
      }
    });
    
    const newResults = {
      ...results,
      rounds: [...results.rounds, newRound]
    };
    setResults(newResults);
    setIsRound3Manual(true);
    onResultsChange?.(newResults);
  };

  // Remove manual round 3
  const handleRemoveRound = () => {
    // Only allow removing round 3 if it was manually added
    if (results.rounds.length !== 3 || !isRound3Manual) return;
    
    const newResults = {
      ...results,
      rounds: results.rounds.slice(0, 2)
    };
    setResults(newResults);
    setIsRound3Manual(false);
    onResultsChange?.(newResults);
  };

  const handleResultChange = (roundIndex: number, itemIndex: number, field: "h1" | "result", value: string) => {
    const newResults = { ...results };
    newResults.rounds = [...newResults.rounds];
    newResults.rounds[roundIndex] = [...newResults.rounds[roundIndex]];
    newResults.rounds[roundIndex][itemIndex] = { 
      ...newResults.rounds[roundIndex][itemIndex], 
      [field]: value 
    };
    
    const testItem = DC_TEST_DATA[itemIndex];
    const isRCDItem = testItem?.testName.includes("RCD");
    
    // Clear h1 value when NA is selected for any item
    if (field === "result" && value === "NA") {
      newResults.rounds[roundIndex][itemIndex].h1 = "";
    }
    
    if (isRCDItem && field === "result") {
      const previousResult = results.rounds[roundIndex]?.[itemIndex]?.result;
      
      if (value === "NA") {
        if (roundIndex === 0) {
          newResults.rcdValues = [...newResults.rcdValues];
          newResults.rcdValues[itemIndex] = "";
        }
        for (let i = roundIndex + 1; i < newResults.rounds.length; i++) {
          newResults.rounds[i] = [...newResults.rounds[i]];
          newResults.rounds[i][itemIndex] = { h1: "", result: "NA" };
        }
      } else if (previousResult === "NA" && value !== "NA") {
        for (let i = roundIndex + 1; i < newResults.rounds.length; i++) {
          newResults.rounds[i] = [...newResults.rounds[i]];
          if (newResults.rounds[i][itemIndex]?.result === "NA") {
            newResults.rounds[i][itemIndex] = { h1: "", result: "" };
          }
        }
      }
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

  const handlePowerStandbyChange = (phase: "L1" | "L2" | "L3", value: string) => {
    const newResults: TestResults = { 
      ...results, 
      powerStandby: { ...results.powerStandby, [phase]: value } 
    };
    setResults(newResults);
    onResultsChange?.(newResults);
  };

  return (
    <div className="tw-w-full">
      <TestResultsGrid
        title={t.testResultsTitle}
        testItems={DC_TEST_DATA}
        results={results}
        onResultChange={handleResultChange}
        onRcdChange={handleRcdChange}
        onRemarkChange={handleRemarkChange}
        onPowerStandbyChange={handlePowerStandbyChange}
        onAddRound={handleAddRound}
        onRemoveRound={handleRemoveRound}
        lang={lang}
        t={t}
        isRound3Manual={isRound3Manual}
      />
    </div>
  );
};

export default DCTest1Grid;