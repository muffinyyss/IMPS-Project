"use client";

import React, { useState, useEffect } from "react";
import { Input, Button, Typography } from "@material-tailwind/react";

/* ===================== Types ===================== */

type Lang = "th" | "en";

interface DCTestItem {
  category: string;
  subCategory?: string;
  testName: string;
  testNameTh?: string;
  unit?: string;
}

// Dynamic test results - support variable number of rounds
export interface TestCharger {
  rounds: { h1: string; h2: string }[][]; // Array of rounds, each round has array of items
  remarks: string[];
}

// Legacy format for backward compatibility
export interface LegacyTestResults {
  test1: { h1: string; h2: string }[];
  test2: { h1: string; h2: string }[];
  test3: { h1: string; h2: string }[];
  remarks: string[];
}

/* ===================== Translations ===================== */

const translations = {
  th: {
    testingChecklist: "รายการทดสอบ",
    testResultsTitle: "ผลการทดสอบ (บันทึกผ่าน/ไม่ผ่าน) หรือค่าตัวเลข",
    remark: "หมายเหตุ",
    testRound: "ทดสอบครั้งที่",
    roundOf: "รอบที่ {n} / 3",
    remarkPlaceholder: "หมายเหตุ...",
    pass: "ผ่าน",
    fail: "ไม่ผ่าน",
    chargerSafety: "ความปลอดภัยเครื่องชาร์จ",
    peContinuity: "PE Continuity ตัวนำป้องกันของเครื่องชาร์จ",
    addRound: "เพิ่มรอบทดสอบ",
    totalRounds: "รอบทดสอบ",
    rounds: "รอบ",
    noneNormal: "ไม่มี (ทำงานปกติ)",
    cpShort: "CP ลัดวงจร -120 โอห์ม",
    pePpCut: "PE-PP-ตัด",
    remoteStop: "หยุดระยะไกล",
    emergency: "ฉุกเฉิน",
    ldcPlus: "LDC +",
    ldcMinus: "LDC -",
  },
  en: {
    testingChecklist: "Testing Checklist",
    testResultsTitle: "Test Results (Record as Pass/Fail) or Numeric Results",
    remark: "Remark",
    testRound: "Test Round",
    roundOf: "Round {n} / 3",
    remarkPlaceholder: "Remark...",
    pass: "Pass",
    fail: "Fail",
    chargerSafety: "Charger Safety",
    peContinuity: "PE.Continuity protective Conductors of Charger",
    addRound: "Add Test Round",
    totalRounds: "Rounds",
    rounds: "rounds",
    noneNormal: "None (Normal operate)",
    cpShort: "CP short -120 Ohm",
    pePpCut: "PE-PP-Cut",
    remoteStop: "Remote Stop",
    emergency: "Emergency",
    ldcPlus: "LDC +",
    ldcMinus: "LDC -",
  },
};

// Helper to get test name based on language
const getTestName = (item: DCTestItem, lang: Lang, t: typeof translations["th"]): string => {
  if (lang === "th" && item.testNameTh) {
    return item.testNameTh;
  }
  
  const nameMap: Record<string, keyof typeof translations["th"]> = {
    "None (Normal operate)": "noneNormal",
    "CP short -120 Ohm": "cpShort",
    "PE-PP-Cut": "pePpCut",
    "Remote Stop": "remoteStop",
    "Emergency": "emergency",
    "LDC +": "ldcPlus",
    "LDC  -": "ldcMinus",
  };

  const key = nameMap[item.testName];
  if (key && t[key]) {
    return t[key] as string;
  }
  
  return item.testName;
};

/* ===================== Payload Type ===================== */

export type ChargerSafetyPayload = {
  ChargerSafety: {
    peContinuity: {
      [key: string]: Record<
        "none" | "CPshort" | "PE_PP_cut" | "remoteStop" | "emergency" | "LDCp" | "LDCm",
        { h1: string; h2: string }
      >;
    };
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
  size?: "sm" | "md";
}> = ({ value, onChange, lang = "th", showNA = true, disabled = false, size = "md" }) => {
  const isPass = value === "PASS" || value === "✓";
  const isFail = value === "FAIL" || value === "✗";
  const isNA = value === "NA";

  const baseClass = size === "sm" 
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
        }`}
        onClick={() => onChange(isPass ? "" : "PASS")}
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
        }`}
        onClick={() => onChange(isFail ? "" : "FAIL")}
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
          }`}
          onClick={() => onChange(isNA ? "" : "NA")}
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
  {
    category: "Charger Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "None (Normal operate)",
    testNameTh: "ไม่มี (ทำงานปกติ)",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "CP short -120 Ohm",
    testNameTh: "CP ลัดวงจร -120 โอห์ม",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "PE-PP-Cut",
    testNameTh: "PE-PP-ตัด",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Remote Stop",
    testNameTh: "หยุดระยะไกล",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "PE.Continuity protective Conductors of Charger",
    testName: "Emergency",
    testNameTh: "ฉุกเฉิน",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "",
    testName: "LDC +",
    testNameTh: "LDC +",
    unit: "",
  },
  {
    category: "Charger Safety",
    subCategory: "",
    testName: "LDC  -",
    testNameTh: "LDC -",
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

const nameKey = (testName: string) => {
  const n = testName.trim();
  return camelKey(n);
};

export function buildRemarks(results: TestCharger, items: DCTestItem[]) {
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

export function mapToChargerPayload(results: TestCharger, items: DCTestItem[] = DC_TEST_DATA): ChargerSafetyPayload {
  const findIndex = (name: string) => items.findIndex((it) => it.testName.toLowerCase() === name.toLowerCase());

  const iNone = findIndex("None (Normal operate)");
  const iCP = findIndex("CP short -120 Ohm");
  const iPE = findIndex("PE-PP-Cut");
  const iRemote = findIndex("Remote Stop");
  const iEmer = findIndex("Emergency");
  const iLDCp = findIndex("LDC +");
  const iLDCm = findIndex("LDC  -");

  const V = (roundData: { h1: string; h2: string }[], i: number) => ({
    h1: i >= 0 ? toPass(roundData[i]?.h1) : "",
    h2: i >= 0 ? toPass(roundData[i]?.h2) : "",
  });

  const peContinuity: { [key: string]: any } = {};
  results.rounds.forEach((roundData, idx) => {
    peContinuity[`r${idx + 1}`] = {
      none: V(roundData, iNone),
      CPshort: V(roundData, iCP),
      PE_PP_cut: V(roundData, iPE),
      remoteStop: V(roundData, iRemote),
      emergency: V(roundData, iEmer),
      LDCp: V(roundData, iLDCp),
      LDCm: V(roundData, iLDCm),
    };
  });

  const remarks = buildRemarks(results, items);

  return {
    ChargerSafety: {
      peContinuity,
      remarks,
      totalRounds: results.rounds.length,
    },
  };
}

/* ===================== Conversion helpers ===================== */

export function convertLegacyToNew(legacy: LegacyTestResults): TestCharger {
  return {
    rounds: [legacy.test1, legacy.test2, legacy.test3],
    remarks: legacy.remarks,
  };
}

export function convertNewToLegacy(results: TestCharger): LegacyTestResults {
  return {
    test1: results.rounds[0] || [],
    test2: results.rounds[1] || [],
    test3: results.rounds[2] || [],
    remarks: results.remarks,
  };
}

/* ===================== Internal: state factory ===================== */

const createEmptyRound = (itemCount: number): { h1: string; h2: string }[] => {
  return new Array(itemCount).fill(null).map(() => ({ h1: "", h2: "" }));
};

const createEmptyResults = (itemCount: number, roundCount: number = 3): TestCharger => ({
  rounds: new Array(roundCount).fill(null).map(() => createEmptyRound(itemCount)),
  remarks: new Array(itemCount).fill(""),
});

/* ===================== Helper: Validation Checker ===================== */

export interface ValidationError {
  round?: number;
  itemIndex: number;
  itemName: string;
  field: string;
  message: string;
}

export const validateTestResults = (
  results: TestCharger,
  items: DCTestItem[] = DC_TEST_DATA,
  lang: Lang = "th"
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  items.forEach((item, itemIndex) => {
    const displayName = getTestName(item, lang, t);

    if (!results.remarks[itemIndex]?.trim()) {
      errors.push({
        itemIndex,
        itemName: displayName,
        field: lang === "th" ? "หมายเหตุ" : "Remark",
        message: lang === "th" ? "ยังไม่ได้กรอกหมายเหตุ" : "Remark is missing",
      });
    }

    results.rounds.forEach((roundData, roundIndex) => {
      const h1 = roundData[itemIndex]?.h1;
      const h2 = roundData[itemIndex]?.h2;

      if (!h1 || (h1 !== "PASS" && h1 !== "FAIL" && h1 !== "NA" && h1 !== "✓" && h1 !== "✗")) {
        errors.push({
          round: roundIndex + 1,
          itemIndex,
          itemName: displayName,
          field: "H1",
          message: lang === "th" 
            ? `รอบ ${roundIndex + 1}: ยังไม่ได้เลือก H1 (PASS/FAIL/NA)` 
            : `Round ${roundIndex + 1}: H1 (PASS/FAIL/NA) not selected`,
        });
      }

      if (!h2 || (h2 !== "PASS" && h2 !== "FAIL" && h2 !== "NA" && h2 !== "✓" && h2 !== "✗")) {
        errors.push({
          round: roundIndex + 1,
          itemIndex,
          itemName: displayName,
          field: "H2",
          message: lang === "th" 
            ? `รอบ ${roundIndex + 1}: ยังไม่ได้เลือก H2 (PASS/FAIL/NA)` 
            : `Round ${roundIndex + 1}: H2 (PASS/FAIL/NA) not selected`,
        });
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

/* ===================== UI: Test Round Card - REDESIGNED ===================== */

interface TestRoundCardProps {
  roundNumber: number;
  totalRounds: number;
  testItems: DCTestItem[];
  results: TestCharger;
  onResultChange: (roundIndex: number, itemIndex: number, field: "h1" | "h2", value: string) => void;
  onRemarkChange: (itemIndex: number, value: string) => void;
  onRemoveRound: (roundIndex: number) => void;
  lang: Lang;
  t: typeof translations["th"];
  canRemove: boolean;
}

const TestRoundCard: React.FC<TestRoundCardProps> = ({
  roundNumber,
  totalRounds,
  testItems,
  results,
  onResultChange,
  onRemarkChange,
  onRemoveRound,
  lang,
  t,
  canRemove,
}) => {
  const roundIndex = roundNumber - 1;

  const getTestResult = (itemIndex: number) => {
    return results.rounds[roundIndex]?.[itemIndex] || { h1: "", h2: "" };
  };

  const renderTestItem = (item: DCTestItem, index: number, isLast: boolean) => {
    const displayName = getTestName(item, lang, t);
    const currentResult = getTestResult(index);
    const itemId = `test2-item-${index}-round-${roundNumber}`;

    return (
      <div
        id={itemId}
        key={`${roundNumber}-${item.testName}`}
        className={`tw-py-6 tw-px-5 tw-transition-all tw-duration-300 hover:tw-bg-gray-50/50 ${
          !isLast ? "tw-border-b tw-border-gray-100" : ""
        }`}
      >
        {/* Test Name */}
        <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4">
          <span className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-gray-200 tw-text-gray-700 tw-text-sm tw-font-bold tw-flex tw-items-center tw-justify-center">
            {index + 1}
          </span>
          <Typography className="tw-font-semibold tw-text-gray-800 tw-text-base">
            {displayName}
          </Typography>
        </div>

        {/* Desktop: H1 & H2 in one row */}
        <div className="tw-hidden lg:tw-flex tw-flex-row tw-gap-6 tw-items-center">
          {/* H1 Section */}
          <div className="tw-flex tw-items-center tw-gap-3 tw-bg-gray-100 tw-rounded-xl tw-p-3">
            <span className="tw-w-10 tw-h-10 tw-flex tw-items-center tw-justify-center tw-bg-gray-700 tw-text-white tw-font-bold tw-text-sm tw-rounded-full tw-flex-shrink-0">
              H1
            </span>
            <PassFailButtons
              value={currentResult?.h1 || ""}
              onChange={(v) => onResultChange(roundIndex, index, "h1", v)}
              lang={lang}
              size="sm"
            />
          </div>

          {/* H2 Section */}
          <div className="tw-flex tw-items-center tw-gap-3 tw-bg-gray-100 tw-rounded-xl tw-p-3">
            <span className="tw-w-10 tw-h-10 tw-flex tw-items-center tw-justify-center tw-bg-gray-700 tw-text-white tw-font-bold tw-text-sm tw-rounded-full tw-flex-shrink-0">
              H2
            </span>
            <PassFailButtons
              value={currentResult?.h2 || ""}
              onChange={(v) => onResultChange(roundIndex, index, "h2", v)}
              lang={lang}
              size="sm"
            />
          </div>

          {/* Remark Section - fixed width, align right */}
          <div className="tw-flex tw-items-center tw-gap-2 tw-w-[150px] tw-ml-auto tw-flex-shrink-0">
            <input
              type="text"
              value={results.remarks[index] || ""}
              onChange={(e) => onRemarkChange(index, e.target.value)}
              className="tw-w-full tw-px-2 tw-py-1.5 tw-text-xs tw-border tw-border-gray-300 tw-rounded-lg tw-bg-white focus:tw-border-gray-500 focus:tw-ring-2 focus:tw-ring-gray-300 tw-outline-none tw-transition-all placeholder:tw-text-gray-500"
              placeholder={t.remarkPlaceholder}
            />
          </div>
        </div>

        {/* Mobile: Only show remark here, H1/H2 will be in separate sections */}
        <div className="lg:tw-hidden tw-flex tw-items-center tw-justify-end tw-gap-2">
          <input
            type="text"
            value={results.remarks[index] || ""}
            onChange={(e) => onRemarkChange(index, e.target.value)}
            className="tw-w-[120px] tw-flex-shrink-0 tw-px-2 tw-py-1.5 tw-text-xs tw-border tw-border-gray-300 tw-rounded-lg tw-bg-white focus:tw-border-gray-500 focus:tw-ring-2 focus:tw-ring-gray-300 tw-outline-none tw-transition-all placeholder:tw-text-gray-500"
            placeholder={t.remarkPlaceholder}
          />
        </div>
      </div>
    );
  };

  // Mobile only: Render H1 or H2 item
  const renderMobileHItem = (item: DCTestItem, index: number, hType: "h1" | "h2", isLast: boolean) => {
    const displayName = getTestName(item, lang, t);
    const currentResult = getTestResult(index);

    return (
      <div
        key={`${roundNumber}-${item.testName}-${hType}`}
        className={`tw-py-3 tw-px-4 tw-flex tw-items-center tw-justify-between ${
          !isLast ? "tw-border-b tw-border-gray-100" : ""
        }`}
      >
        <span className="tw-text-sm tw-text-gray-700">{displayName}</span>
        <PassFailButtons
          value={currentResult?.[hType] || ""}
          onChange={(v) => onResultChange(roundIndex, index, hType, v)}
          lang={lang}
          size="sm"
        />
      </div>
    );
  };

  return (
    <div className="tw-rounded-2xl tw-border tw-border-gray-200 tw-bg-white tw-shadow-sm tw-overflow-hidden">
      {/* Round Header */}
      <div className="tw-bg-gray-800 tw-px-5 tw-py-4">
        <div className="tw-flex tw-items-center tw-justify-between">
          <div className="tw-flex tw-items-center tw-gap-4">
            <div className="tw-w-10 tw-h-10 tw-rounded-xl tw-bg-white/20 tw-backdrop-blur tw-flex tw-items-center tw-justify-center tw-text-lg tw-font-bold tw-text-white">
              {roundNumber}
            </div>
            <div>
              <Typography className="tw-font-bold tw-text-white tw-text-lg">
                {t.testRound} {roundNumber}
              </Typography>
              <Typography className="tw-text-white tw-text-sm">
                {t.roundOf.replace("{n}", String(roundNumber))}
              </Typography>
            </div>
          </div>
          
          {canRemove && (
            <button
              type="button"
              className="tw-p-2 tw-rounded-lg tw-text-red-300 hover:tw-text-white hover:tw-bg-red-500/30 tw-transition-all"
              onClick={() => onRemoveRound(roundIndex)}
            >
              <svg className="tw-w-5 tw-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Desktop Content - Normal view */}
      <div className="tw-hidden lg:tw-block tw-divide-y tw-divide-gray-100">
        {testItems.map((item, index) => renderTestItem(item, index, index === testItems.length - 1))}
      </div>

      {/* Mobile Content - Separate H1 and H2 sections */}
      <div className="lg:tw-hidden">
        {/* H1 Section */}
        <div className="tw-border-b tw-border-gray-200 tw-mb-8">
          <div className="tw-flex tw-items-center tw-gap-3 tw-px-4 tw-py-3 tw-bg-gray-100">
            <span className="tw-w-10 tw-h-10 tw-flex tw-items-center tw-justify-center tw-bg-gray-700 tw-text-white tw-font-bold tw-text-sm tw-rounded-full">
              H1
            </span>
            <span className="tw-font-bold tw-text-gray-700">Handgun 1</span>
          </div>
          <div>
            {testItems.map((item, index) => {
              const displayName = getTestName(item, lang, t);
              const currentResult = getTestResult(index);
              const isLast = index === testItems.length - 1;
              return (
                <div
                  key={`h1-${index}`}
                  className={`tw-py-3 tw-px-4 ${!isLast ? "tw-border-b tw-border-gray-100" : ""}`}
                >
                  <div className="tw-text-sm tw-font-medium tw-text-gray-800 tw-mb-2">{displayName}</div>
                  <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                    <PassFailButtons
                      value={currentResult?.h1 || ""}
                      onChange={(v) => onResultChange(roundIndex, index, "h1", v)}
                      lang={lang}
                      size="sm"
                    />
                    <input
                      type="text"
                      value={results.remarks[index] || ""}
                      onChange={(e) => onRemarkChange(index, e.target.value)}
                      className="tw-w-[120px] tw-flex-shrink-0 tw-px-2 tw-py-1.5 tw-text-xs tw-border tw-border-gray-300 tw-rounded-lg tw-bg-white focus:tw-border-gray-500 focus:tw-ring-1 focus:tw-ring-gray-300 tw-outline-none placeholder:tw-text-gray-500"
                      placeholder={t.remarkPlaceholder}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* H2 Section */}
        <div className="tw-mt-8">
          <div className="tw-flex tw-items-center tw-gap-3 tw-px-4 tw-py-3 tw-bg-gray-100">
            <span className="tw-w-10 tw-h-10 tw-flex tw-items-center tw-justify-center tw-bg-gray-700 tw-text-white tw-font-bold tw-text-sm tw-rounded-full">
              H2
            </span>
            <span className="tw-font-bold tw-text-gray-700">Handgun 2</span>
          </div>
          <div>
            {testItems.map((item, index) => {
              const displayName = getTestName(item, lang, t);
              const currentResult = getTestResult(index);
              const isLast = index === testItems.length - 1;
              return (
                <div
                  key={`h2-${index}`}
                  className={`tw-py-3 tw-px-4 ${!isLast ? "tw-border-b tw-border-gray-100" : ""}`}
                >
                  <div className="tw-text-sm tw-font-medium tw-text-gray-800 tw-mb-2">{displayName}</div>
                  <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                    <PassFailButtons
                      value={currentResult?.h2 || ""}
                      onChange={(v) => onResultChange(roundIndex, index, "h2", v)}
                      lang={lang}
                      size="sm"
                    />
                    <input
                      type="text"
                      value={results.remarks[index] || ""}
                      onChange={(e) => onRemarkChange(index, e.target.value)}
                      className="tw-w-[120px] tw-flex-shrink-0 tw-px-2 tw-py-1.5 tw-text-xs tw-border tw-border-gray-300 tw-rounded-lg tw-bg-white focus:tw-border-gray-500 focus:tw-ring-1 focus:tw-ring-gray-300 tw-outline-none placeholder:tw-text-gray-500"
                      placeholder={t.remarkPlaceholder}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ===================== UI: Main Grid Component ===================== */

interface TestResultsGridProps {
  title?: string;
  testItems: DCTestItem[];
  results: TestCharger;
  onResultChange: (roundIndex: number, itemIndex: number, field: "h1" | "h2", value: string) => void;
  onRemarkChange: (itemIndex: number, value: string) => void;
  onAddRound: () => void;
  onRemoveRound: (roundIndex: number) => void;
  lang: Lang;
  t: typeof translations["th"];
}

const TestResultsGrid: React.FC<TestResultsGridProps> = ({
  title,
  testItems,
  results,
  onResultChange,
  onRemarkChange,
  onAddRound,
  onRemoveRound,
  lang,
  t,
}) => {
  const totalRounds = results.rounds.length;

  return (
    <div className="tw-space-y-6">
      {/* Page Title & Add Button */}
      <div className="tw-flex tw-flex-col sm:tw-flex-row tw-items-start sm:tw-items-center tw-justify-between tw-gap-4">
        <div>
          <Typography variant="h6" className="tw-text-gray-800 tw-font-bold">
            {title || t.testResultsTitle}
          </Typography>
          <div className="tw-flex tw-items-center tw-gap-2 tw-mt-1">
            <span className="tw-inline-flex tw-items-center tw-px-2.5 tw-py-1 tw-rounded-full tw-text-xs tw-font-medium tw-bg-gray-200 tw-text-gray-700">
              {t.totalRounds}: {totalRounds}/3
            </span>
          </div>
        </div>
        {totalRounds < 3 && (
          <button
            type="button"
            className="tw-inline-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2.5 tw-bg-gray-800 tw-text-white tw-rounded-xl tw-font-medium tw-text-sm hover:tw-bg-gray-700 tw-transition-all tw-shadow-sm"
            onClick={onAddRound}
          >
            <svg className="tw-w-5 tw-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t.addRound}
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
            onRemarkChange={onRemarkChange}
            onRemoveRound={onRemoveRound}
            lang={lang}
            t={t}
            canRemove={totalRounds > 1}
          />
        ))}
      </div>
    </div>
  );
};

/* ===================== Component (export default) ===================== */

export interface DCTestGridProps {
  initialResults?: TestCharger | LegacyTestResults;
  onResultsChange?: (results: TestCharger) => void;
  initialRounds?: number;
}

const DCTest2Grid: React.FC<DCTestGridProps> = ({ initialResults, onResultsChange, initialRounds = 3 }) => {
  const getInitialResults = (): TestCharger => {
    if (!initialResults) {
      return createEmptyResults(DC_TEST_DATA.length, initialRounds);
    }
    
    if ('test1' in initialResults && 'test2' in initialResults && 'test3' in initialResults) {
      return convertLegacyToNew(initialResults as LegacyTestResults);
    }
    
    return initialResults as TestCharger;
  };

  const [results, setResults] = useState<TestCharger>(getInitialResults);

  useEffect(() => {
    if (initialResults) {
      if ('test1' in initialResults) {
        setResults(convertLegacyToNew(initialResults as LegacyTestResults));
      } else {
        setResults(initialResults as TestCharger);
      }
    }
  }, [initialResults]);

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

  const handleResultChange = (
    roundIndex: number,
    itemIndex: number,
    field: "h1" | "h2",
    value: string
  ) => {
    const newResults = { ...results };
    newResults.rounds = [...newResults.rounds];
    newResults.rounds[roundIndex] = [...newResults.rounds[roundIndex]];
    newResults.rounds[roundIndex][itemIndex] = { 
      ...newResults.rounds[roundIndex][itemIndex], 
      [field]: value 
    };
    setResults(newResults);
    onResultsChange?.(newResults);
  };

  const handleRemarkChange = (itemIndex: number, value: string) => {
    const newResults: TestCharger = { ...results, remarks: [...results.remarks] };
    newResults.remarks[itemIndex] = value;
    setResults(newResults);
    onResultsChange?.(newResults);
  };

  const handleAddRound = () => {
    if (results.rounds.length >= 3) return;
    
    const newResults = { ...results };
    newResults.rounds = [...newResults.rounds, createEmptyRound(DC_TEST_DATA.length)];
    setResults(newResults);
    onResultsChange?.(newResults);
  };

  const handleRemoveRound = (roundIndex: number) => {
    if (results.rounds.length <= 1) return;
    
    const newResults = { ...results };
    newResults.rounds = newResults.rounds.filter((_, idx) => idx !== roundIndex);
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
        onRemarkChange={handleRemarkChange}
        onAddRound={handleAddRound}
        onRemoveRound={handleRemoveRound}
        lang={lang}
        t={t}
      />
    </div>
  );
};

export default DCTest2Grid;