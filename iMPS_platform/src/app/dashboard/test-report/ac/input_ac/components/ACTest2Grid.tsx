"use client";

import React, { useState, useEffect } from "react";
import { Input, Button, Typography, Tooltip } from "@material-tailwind/react";

/* ===================== Types ===================== */

type Lang = "th" | "en";

// File attachment for each test item
export interface TestFile {
  file: File;
  url: string;
  name: string;
}

// Files organized by: itemIndex -> round -> h1
export interface TestFiles {
  [itemIndex: number]: {
    [roundIndex: number]: {
      h1?: TestFile;
    };
  };
}

interface ACTestItem {
  category: string;
  subCategory?: string;
  testName: string;
  testNameTh?: string;
  unit?: string;
  remarkKey?: string;
  tooltip?: { th: string; en: string };
}

// Dynamic test results - support variable number of rounds
export interface TestCharger {
  rounds: { h1: string; result: string }[][]; // Array of rounds, each round has array of items
  type2Values: string[]; // For RCD type values
  remarks: string[];
  files?: TestFiles; // File attachments
}

// Legacy format for backward compatibility
export interface LegacyTestResults {
  test1: { h1: string; result: string }[];
  test2: { h1: string; result: string }[];
  test3: { h1: string; result: string }[];
  type2Values: string[];
  remarks: string[];
}

/* ===================== Translations ===================== */

const translations = {
  th: {
    testingChecklist: "รายการทดสอบ",
    testResultsTitle: "ผลการทดสอบ (บันทึกผ่าน/ไม่ผ่าน) หรือค่าตัวเลข",
    remark: "หมายเหตุ",
    testRound: "ทดสอบครั้งที่",
    roundOf: "รอบที่ {n} / {total}",
    remarkPlaceholder: "หมายเหตุ...",
    valuePlaceholder: "ค่า",
    pass: "ผ่าน",
    fail: "ไม่ผ่าน",
    chargerSafety: "ความปลอดภัยเครื่องชาร์จ",
    addRound3: "เพิ่มรอบที่ 3",
    totalRounds: "รอบทดสอบ",
    rounds: "รอบ",
    continuityPE: "Continuity PE",
    insulationCable: "Insulation Cable",
    stateA: "State A",
    stateB: "State B",
    stateC: "State C",
    cpShort: "CP Short",
    peCut: "PE Cut",
    emergency: "Emergency",
    rcdTypeA: "RCD type A",
    rcdTypeF: "RCD type F",
    rcdTypeB: "RCD type B",
    rdcDD: "RDC-DD",
    h1: "H.1",
    result: "ผลทดสอบ",
    type2: "Type 2",
    round3Info: "รอบที่ 3 - ทดสอบซ้ำเฉพาะหัวข้อที่ไม่ผ่าน",
    allPassed: "ผ่านทุกหัวข้อทั้ง 2 รอบ",
    failedItemsCount: "หัวข้อที่ต้องทดสอบซ้ำ: {count} รายการ",
    // File upload translations
    attachFile: "แนบไฟล์",
    changeFile: "เปลี่ยนไฟล์",
    deleteFile: "ลบไฟล์",
    fileTooltip: "แนบไฟล์เอกสารประกอบการทดสอบ",
    viewFile: "ดูไฟล์",
  },
  en: {
    testingChecklist: "Testing Checklist",
    testResultsTitle: "Test Results (Record as Pass/Fail) or Numeric Results",
    remark: "Remark",
    testRound: "Test Round",
    roundOf: "Round {n} / {total}",
    remarkPlaceholder: "Remark...",
    valuePlaceholder: "Value",
    pass: "Pass",
    fail: "Fail",
    chargerSafety: "Charger Safety",
    addRound3: "Add Round 3",
    totalRounds: "Rounds",
    rounds: "rounds",
    continuityPE: "Continuity PE",
    insulationCable: "Insulation Cable",
    stateA: "State A",
    stateB: "State B",
    stateC: "State C",
    cpShort: "CP Short",
    peCut: "PE Cut",
    emergency: "Emergency",
    rcdTypeA: "RCD type A",
    rcdTypeF: "RCD type F",
    rcdTypeB: "RCD type B",
    rdcDD: "RDC-DD",
    h1: "H.1",
    result: "Result",
    type2: "Type 2",
    round3Info: "Round 3 - Retest failed items only",
    allPassed: "All items passed in both rounds",
    failedItemsCount: "Items to retest: {count}",
    // File upload translations
    attachFile: "Attach",
    changeFile: "Change",
    deleteFile: "Delete",
    fileTooltip: "Attach document for this test",
    viewFile: "View",
  },
};

// Helper to get test name based on language
const getTestName = (item: ACTestItem, lang: Lang, t: typeof translations["th"]): string => {
  if (lang === "th" && item.testNameTh) {
    return item.testNameTh;
  }
  
  const nameMap: Record<string, keyof typeof translations["th"]> = {
    "Continuity PE": "continuityPE",
    "Insulation Cable": "insulationCable",
    "State A": "stateA",
    "State B": "stateB",
    "State C": "stateC",
    "CP Short": "cpShort",
    "PE Cut": "peCut",
    "Emergency": "emergency",
    "RCD type A": "rcdTypeA",
    "RCD type F": "rcdTypeF",
    "RCD type B": "rcdTypeB",
    "RDC-DD": "rdcDD",
  };

  const key = nameMap[item.testName];
  if (key && t[key]) {
    return t[key] as string;
  }
  
  return item.testName;
};

/* ===================== Payload Type ===================== */

export type ChargerSafetyPayload = {
  chargerSafety: {
    tests: {
      [key: string]: Record<
        "continuityPE" | "insulationCable" | "stateA" | "stateB" | "stateC" | "CPShort" | "PECut",
        { h1: string; result: string }
      >;
    };
    emergency: { pass: boolean }; // Like Isolation Transformer in DCTest1Grid
    rcd: {
      typeA: { value: string; unit: "mA" };
      typeF: { value: string; unit: "mA" };
      typeB: { value: string; unit: "mA" };
      DD: { value: string; unit: "mA" };
    };
    remarks: Record<string, string>;
    totalRounds: number;
  };
};

/* ===================== Tooltip translations ===================== */

const tooltipTranslations = {
  th: {
    pass: "ผ่าน - คลิกเพื่อเลือก",
    fail: "ไม่ผ่าน - คลิกเพื่อเลือก",
    na: "ไม่มี/ไม่ทดสอบ - คลิกเพื่อเลือก",
    passSelected: "ผ่าน (เลือกแล้ว) - คลิกเพื่อยกเลิก",
    failSelected: "ไม่ผ่าน (เลือกแล้ว) - คลิกเพื่อยกเลิก",
    naSelected: "ไม่มี/ไม่ทดสอบ (เลือกแล้ว) - คลิกเพื่อยกเลิก",
  },
  en: {
    pass: "Pass - Click to select",
    fail: "Fail - Click to select",
    na: "N/A - Click to select",
    passSelected: "Pass (Selected) - Click to deselect",
    failSelected: "Fail (Selected) - Click to deselect",
    naSelected: "N/A (Selected) - Click to deselect",
  },
};

/* ===================== Helper: Filter Numeric Input ===================== */

// อนุญาตเฉพาะ: ตัวเลข (0-9), จุดทศนิยม (.), เครื่องหมายลบ (-), มากกว่า (>), น้อยกว่า (<)
const filterNumericInput = (value: string): { filtered: string; hasInvalid: boolean } => {
  const filtered = value.replace(/[^0-9.\-><]/g, "");
  const hasInvalid = filtered !== value;
  return { filtered, hasInvalid };
};

/* ===================== UI: Numeric Input with Toast ===================== */

const NumericInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  lang?: Lang;
}> = ({ value, onChange, placeholder, disabled, className, lang = "th" }) => {
  const [showToast, setShowToast] = useState(false);

  const toastMessage = lang === "th" 
    ? "กรุณากรอกเฉพาะตัวเลข, จุด (.), ลบ (-), มากกว่า (>) หรือน้อยกว่า (<)" 
    : "Please enter only numbers, dot (.), minus (-), greater than (>) or less than (<)";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { filtered, hasInvalid } = filterNumericInput(e.target.value);
    
    if (hasInvalid) {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000); // แสดง 5 วินาที
    }
    
    onChange(filtered);
  };

  return (
    <div className="tw-relative">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      
      {/* Toast Notification - สีแดง */}
      {showToast && (
        <div className="tw-fixed tw-top-4 tw-left-1/2 tw-transform tw--translate-x-1/2 tw-z-[9999]">
          <div className="tw-bg-red-600 tw-text-white tw-px-5 tw-py-3 tw-rounded-xl tw-shadow-2xl tw-flex tw-items-center tw-gap-3 tw-text-sm tw-font-medium tw-border tw-border-red-700">
            <svg className="tw-w-6 tw-h-6 tw-flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{toastMessage}</span>
            <button 
              onClick={() => setShowToast(false)}
              className="tw-ml-2 tw-text-white/80 hover:tw-text-white tw-transition-colors"
            >
              <svg className="tw-w-5 tw-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

  const tt = tooltipTranslations[lang];

  const baseClass = size === "sm" 
    ? "tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold tw-rounded-lg tw-transition-all tw-duration-200"
    : "tw-px-4 tw-py-2 tw-text-sm tw-font-semibold tw-rounded-lg tw-transition-all tw-duration-200";

  return (
    <div className="tw-flex tw-gap-1.5">
      <button
        type="button"
        title={isPass ? tt.passSelected : tt.pass}
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
        title={isFail ? tt.failSelected : tt.fail}
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
          title={isNA ? tt.naSelected : tt.na}
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

/* ===================== UI: File Upload Button ===================== */

const FileUploadButton: React.FC<{
  file?: TestFile;
  onUpload: (file: File) => void;
  onDelete: () => void;
  lang: Lang;
  t: typeof translations["th"];
  size?: "sm" | "md";
  loading?: boolean;
  disabled?: boolean;
}> = ({ file, onUpload, onDelete, lang, t, size = "sm", loading = false, disabled = false }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onUpload(selectedFile);
    }
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const baseClass = size === "sm"
    ? "tw-px-2 tw-py-1.5 tw-text-xs tw-font-medium tw-rounded-lg tw-transition-all tw-duration-200"
    : "tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-rounded-lg tw-transition-all tw-duration-200";

  // Get file icon based on extension
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return (
        <svg className="tw-w-4 tw-h-4 tw-text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
    if (ext === 'doc' || ext === 'docx') {
      return (
        <svg className="tw-w-4 tw-h-4 tw-text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
    if (ext === 'xls' || ext === 'xlsx') {
      return (
        <svg className="tw-w-4 tw-h-4 tw-text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    }
    if (['jpg', 'jpeg', 'png'].includes(ext || '')) {
      return (
        <svg className="tw-w-4 tw-h-4 tw-text-purple-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="tw-w-4 tw-h-4 tw-text-gray-500" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
    );
  };

  // Loading spinner
  const LoadingSpinner = () => (
    <svg className="tw-w-3.5 tw-h-3.5 tw-animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  if (loading) {
    return (
      <div className={`${baseClass} tw-flex tw-items-center tw-gap-1 tw-bg-gray-100 tw-text-gray-400 tw-border tw-border-gray-300`}>
        <LoadingSpinner />
        <span className="tw-hidden sm:tw-inline">...</span>
      </div>
    );
  }

  if (file) {
    return (
      <div className="tw-flex tw-items-center tw-gap-1">
        {/* File Preview */}
        <Tooltip content={`${t.viewFile}: ${file.name}`} placement="top">
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="tw-flex tw-items-center tw-gap-1 tw-px-2 tw-py-1 tw-rounded-md tw-bg-gray-100 tw-border tw-border-gray-300 hover:tw-bg-gray-200 tw-transition-all tw-max-w-[100px]"
          >
            {getFileIcon(file.name)}
            <span className="tw-text-xs tw-text-gray-700 tw-truncate tw-max-w-[60px]">{file.name}</span>
          </a>
        </Tooltip>
        
        {/* Delete Button */}
        <Tooltip content={t.deleteFile} placement="top">
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="tw-w-6 tw-h-6 tw-flex tw-items-center tw-justify-center tw-rounded-full tw-bg-red-100 tw-text-red-600 hover:tw-bg-red-200 tw-transition-all disabled:tw-opacity-50 disabled:tw-cursor-not-allowed"
          >
            <svg className="tw-w-3.5 tw-h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </Tooltip>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          className="tw-hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  return (
    <Tooltip content={t.fileTooltip} placement="top">
      <label className={`${baseClass} tw-cursor-pointer tw-flex tw-items-center tw-gap-1 tw-bg-gray-100 tw-text-gray-600 tw-border tw-border-gray-300 hover:tw-bg-gray-200 hover:tw-border-gray-400 ${disabled ? 'tw-opacity-50 tw-cursor-not-allowed' : ''}`}>
        <svg className="tw-w-3.5 tw-h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        <span className="tw-hidden sm:tw-inline">{t.attachFile}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          className="tw-hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
      </label>
    </Tooltip>
  );
};

/* ===================== Data (รายการทดสอบ) ===================== */

export const AC_TEST2_DATA: ACTestItem[] = [
  {
    category: "Charger Safety",
    testName: "Continuity PE",
    testNameTh: "Continuity PE",
    unit: "Ω",
    remarkKey: "continuityPE",
    tooltip: { th: "ทดสอบความต่อเนื่องของตัวนำป้องกัน (PE)", en: "Test continuity of protective earth conductor (PE)" },
  },
  {
    category: "Charger Safety",
    testName: "Insulation Cable",
    testNameTh: "Insulation Cable",
    unit: "MΩ",
    remarkKey: "insulationCable",
    tooltip: { th: "ทดสอบความต้านทานฉนวนของสายเคเบิล", en: "Test insulation resistance of cable" },
  },
  {
    category: "Charger Safety",
    testName: "State A",
    testNameTh: "State A",
    unit: "V",
    remarkKey: "stateA",
    tooltip: { th: "ทดสอบแรงดันไฟฟ้าที่สถานะ A (ไม่เชื่อมต่อ)", en: "Test voltage at State A (not connected)" },
  },
  {
    category: "Charger Safety",
    testName: "State B",
    testNameTh: "State B",
    unit: "V",
    remarkKey: "stateB",
    tooltip: { th: "ทดสอบแรงดันไฟฟ้าที่สถานะ B (เชื่อมต่อแล้ว)", en: "Test voltage at State B (connected)" },
  },
  {
    category: "Charger Safety",
    testName: "State C",
    testNameTh: "State C",
    unit: "V",
    remarkKey: "stateC",
    tooltip: { th: "ทดสอบแรงดันไฟฟ้าที่สถานะ C (กำลังชาร์จ)", en: "Test voltage at State C (charging)" },
  },
  {
    category: "Charger Safety",
    testName: "CP Short",
    testNameTh: "CP Short",
    unit: "V",
    remarkKey: "cpShort",
    tooltip: { th: "ทดสอบการตอบสนองเมื่อสาย CP ลัดวงจร", en: "Test response when CP line is shorted" },
  },
  {
    category: "Charger Safety",
    testName: "PE Cut",
    testNameTh: "PE Cut",
    unit: "V",
    remarkKey: "peCut",
    tooltip: { th: "ทดสอบการตอบสนองเมื่อสาย PE ถูกตัด", en: "Test response when PE line is cut" },
  },
  {
    category: "Charger Safety",
    testName: "Emergency",
    testNameTh: "Emergency",
    unit: "",
    remarkKey: "emergency",
    tooltip: { th: "ทดสอบการทำงานของปุ่มหยุดฉุกเฉิน", en: "Test emergency stop button functionality" },
  },
  {
    category: "Charger Safety",
    testName: "RCD type A",
    testNameTh: "RCD type A",
    unit: "mA",
    remarkKey: "rcdTypeA",
    tooltip: { th: "ทดสอบอุปกรณ์ป้องกันไฟรั่ว (RCD) ชนิด A", en: "Test Residual Current Device (RCD) type A" },
  },
  {
    category: "Charger Safety",
    testName: "RCD type F",
    testNameTh: "RCD type F",
    unit: "mA",
    remarkKey: "rcdTypeF",
    tooltip: { th: "ทดสอบอุปกรณ์ป้องกันไฟรั่ว (RCD) ชนิด F", en: "Test Residual Current Device (RCD) type F" },
  },
  {
    category: "Charger Safety",
    testName: "RCD type B",
    testNameTh: "RCD type B",
    unit: "mA",
    remarkKey: "rcdTypeB",
    tooltip: { th: "ทดสอบอุปกรณ์ป้องกันไฟรั่ว (RCD) ชนิด B", en: "Test Residual Current Device (RCD) type B" },
  },
  {
    category: "Charger Safety",
    testName: "RDC-DD",
    testNameTh: "RDC-DD",
    unit: "mA",
    remarkKey: "rdcDD",
    tooltip: { th: "ทดสอบอุปกรณ์ตรวจจับกระแสไฟฟ้ารั่ว DC", en: "Test DC residual current detection device" },
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
  if (/^RCD type\s*/i.test(n)) {
    const letter = n.replace(/^RCD type\s*/i, "").trim();
    return ("rcdType" + letter.toUpperCase()) as "rcdTypeA" | "rcdTypeF" | "rcdTypeB";
  }
  if (/^RD[CD][-\s]?DD$/i.test(n)) return "DD";
  return camelKey(n);
};

// แก้ไข buildRemarks ให้ใช้ remarkKey ถ้ามี
export function buildRemarks(results: TestCharger, items: ACTestItem[]) {
  const remarks: Record<string, string> = {};
  items.forEach((it, i) => {
    // ใช้ remarkKey ถ้ามี ไม่งั้นใช้ nameKey จาก testName
    const key = it.remarkKey || nameKey(it.testName);
    remarks[key] = results.remarks[i] ?? "";
  });
  return remarks;
}

const toPass = (v?: string) => {
  if (v === "✓" || v === "PASS") return "pass";
  if (v === "✗" || v === "FAIL") return "fail";
  if (v === "NA") return "na";
  return v ?? "";
};

export function mapToChargerPayload(results: TestCharger, items: ACTestItem[] = AC_TEST2_DATA): ChargerSafetyPayload {
  const findIndex = (name: string) => items.findIndex((it) => it.testName.toLowerCase() === name.toLowerCase());

  const iContinuity = findIndex("Continuity PE");
  const iInsulation = findIndex("Insulation Cable");
  const iStateA = findIndex("State A");
  const iStateB = findIndex("State B");
  const iStateC = findIndex("State C");
  const iCPShort = findIndex("CP Short");
  const iPECut = findIndex("PE Cut");
  const iEmergency = findIndex("Emergency");

  const V = (roundData: { h1: string; result: string }[], i: number) => ({
    h1: i >= 0 ? roundData[i]?.h1 ?? "" : "",
    result: i >= 0 ? toPass(roundData[i]?.result) : "",
  });

  const tests: { [key: string]: any } = {};
  results.rounds.forEach((roundData, idx) => {
    tests[`r${idx + 1}`] = {
      continuityPE: V(roundData, iContinuity),
      insulationCable: V(roundData, iInsulation),
      stateA: V(roundData, iStateA),
      stateB: V(roundData, iStateB),
      stateC: V(roundData, iStateC),
      CPShort: V(roundData, iCPShort),
      PECut: V(roundData, iPECut),
    };
  });

  // Emergency - stored like Isolation Transformer in DCTest1Grid (using type2Values)
  const emergencyValue = iEmergency >= 0 ? results.type2Values[iEmergency] || "" : "";
  const emergency = { pass: emergencyValue === "✓" || emergencyValue === "PASS" };

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

  const remarks = buildRemarks(results, items);

  return {
    chargerSafety: {
      tests,
      emergency,
      rcd,
      remarks,
      totalRounds: results.rounds.length,
    },
  };
}

/* ===================== Conversion helpers ===================== */

export function convertLegacyToNew(legacy: LegacyTestResults): TestCharger {
  return {
    rounds: [legacy.test1, legacy.test2, legacy.test3],
    type2Values: legacy.type2Values,
    remarks: legacy.remarks,
  };
}

export function convertNewToLegacy(results: TestCharger): LegacyTestResults {
  return {
    test1: results.rounds[0] || [],
    test2: results.rounds[1] || [],
    test3: results.rounds[2] || [],
    type2Values: results.type2Values,
    remarks: results.remarks,
  };
}

/* ===================== Internal: state factory ===================== */

const createEmptyRound = (itemCount: number): { h1: string; result: string }[] => {
  return new Array(itemCount).fill(null).map(() => ({ h1: "", result: "" }));
};

const createEmptyResults = (itemCount: number, roundCount: number = 2): TestCharger => ({
  rounds: new Array(roundCount).fill(null).map(() => createEmptyRound(itemCount)),
  type2Values: new Array(itemCount).fill(""),
  remarks: new Array(itemCount).fill(""),
});

/* ===================== Helper: Result Checkers ===================== */

const isPassResult = (value?: string): boolean => {
  return value === "PASS" || value === "✓";
};

const isFailResult = (value?: string): boolean => {
  return value === "FAIL" || value === "✗";
};

const isNaResult = (value?: string): boolean => {
  return value === "NA";
};

/* ===================== Helper: Check if item is disabled from previous rounds ===================== */

const isDisabledForRound = (results: TestCharger, itemIndex: number, currentRoundIndex: number): boolean => {
  // Check if NA was selected in any previous round
  for (let i = 0; i < currentRoundIndex; i++) {
    const result = results.rounds[i]?.[itemIndex]?.result;
    if (result === "NA") return true;
  }
  return false;
};

const isNaInCurrentRound = (results: TestCharger, itemIndex: number, currentRoundIndex: number): boolean => {
  const result = results.rounds[currentRoundIndex]?.[itemIndex]?.result;
  return result === "NA";
};

// Get indexes of items that failed in at least one of the first 2 rounds (need retest in round 3)
export const getFailedItemIndexes = (results: TestCharger, testItems: ACTestItem[]): number[] => {
  const failedIndexes: number[] = [];
  
  testItems.forEach((item, index) => {
    // Skip Emergency item (only tested in round 1)
    if (item.testName === "Emergency") return;
    
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

// Check if all items passed in both rounds (no FAIL results AND all tested)
export const allItemsPassed = (results: TestCharger, testItems: ACTestItem[]): boolean => {
  if (results.rounds.length < 2) return false;
  
  // Check if there are any failed items
  const failedIndexes = getFailedItemIndexes(results, testItems);
  if (failedIndexes.length > 0) return false;
  
  // Check if all items have been tested (must have PASS or NA result in both rounds)
  // Emergency only needs to be tested in round 1 - uses type2Values
  let allTested = true;
  testItems.forEach((item, index) => {
    const isEmergencyItem = item.testName === "Emergency";
    const round1Result = results.rounds[0]?.[index]?.result;
    const round2Result = results.rounds[1]?.[index]?.result;
    
    // Emergency uses type2Values like Isolation Transformer
    if (isEmergencyItem) {
      const emergencyValue = results.type2Values[index];
      const emergencyTested = emergencyValue === "PASS" || emergencyValue === "✓";
      if (!emergencyTested) {
        allTested = false;
      }
      return;
    }
    
    // Check if result is tested in round 1
    const round1Tested = isPassResult(round1Result) || isNaResult(round1Result);
    
    // Other items need both rounds
    const round2Tested = isPassResult(round2Result) || isNaResult(round2Result);
    
    if (!round1Tested || !round2Tested) {
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
  results: TestCharger,
  items: ACTestItem[] = AC_TEST2_DATA,
  lang: Lang = "th"
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  items.forEach((item, itemIndex) => {
    const displayName = getTestName(item, lang, t);
    const isRCDItem = /^RCD type\s*(A|F|B)$/i.test(item.testName) || /^RD[CD][-\s]?DD$/i.test(item.testName);
    const isEmergencyItem = item.testName === "Emergency";
    const isNoH1Item = isRCDItem || isEmergencyItem;

    // RCD items need type2Values
    if (isRCDItem && !results.type2Values[itemIndex]?.trim()) {
      errors.push({
        itemIndex,
        itemName: displayName,
        field: "Type 2",
        message: lang === "th" ? "ยังไม่ได้กรอกค่า Type 2 (mA)" : "Type 2 value (mA) is missing",
      });
    }

    // Emergency only needs validation in round 1 - uses type2Values like Isolation Transformer
    if (isEmergencyItem) {
      const emergencyValue = results.type2Values[itemIndex];
      if (!emergencyValue || (emergencyValue !== "PASS" && emergencyValue !== "FAIL" && emergencyValue !== "✓" && emergencyValue !== "✗")) {
        errors.push({
          round: 1,
          itemIndex,
          itemName: displayName,
          field: lang === "th" ? "ผลทดสอบ" : "Result",
          message: lang === "th" 
            ? `รอบ 1: ยังไม่ได้เลือก PASS/FAIL` 
            : `Round 1: PASS/FAIL not selected`,
        });
      }
      return; // Skip other rounds for Emergency
    }

    results.rounds.forEach((roundData, roundIndex) => {
      const h1 = roundData[itemIndex]?.h1;
      const result = roundData[itemIndex]?.result;

      // All items need h1 value except Emergency
      if (!isEmergencyItem && !h1?.trim()) {
        errors.push({
          round: roundIndex + 1,
          itemIndex,
          itemName: displayName,
          field: "H.1",
          message: lang === "th" 
            ? `รอบ ${roundIndex + 1}: ยังไม่ได้กรอกค่า H.1` 
            : `Round ${roundIndex + 1}: H.1 value is missing`,
        });
      }

      if (!result || (result !== "PASS" && result !== "FAIL" && result !== "NA" && result !== "✓" && result !== "✗")) {
        errors.push({
          round: roundIndex + 1,
          itemIndex,
          itemName: displayName,
          field: lang === "th" ? "ผลทดสอบ" : "Result",
          message: lang === "th" 
            ? `รอบ ${roundIndex + 1}: ยังไม่ได้เลือก PASS/FAIL/NA` 
            : `Round ${roundIndex + 1}: PASS/FAIL/NA not selected`,
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

/* ===================== UI: Test Round Card ===================== */

interface TestRoundCardProps {
  roundNumber: number;
  totalRounds: number;
  testItems: ACTestItem[];
  results: TestCharger;
  onResultChange: (roundIndex: number, itemIndex: number, field: "h1" | "result", value: string) => void;
  onType2Change: (itemIndex: number, value: string) => void;
  onRemarkChange: (itemIndex: number, value: string) => void;
  onFileUpload: (roundIndex: number, itemIndex: number, file: File) => void;
  onFileDelete: (roundIndex: number, itemIndex: number) => void;
  onRemoveRound: () => void;
  lang: Lang;
  t: typeof translations["th"];
  canRemove: boolean;
  isFirstRound: boolean;
  isRound3?: boolean;
  failedItemIndexes?: number[];
}

const TestRoundCard: React.FC<TestRoundCardProps> = ({
  roundNumber,
  totalRounds,
  testItems,
  results,
  onResultChange,
  onType2Change,
  onRemarkChange,
  onFileUpload,
  onFileDelete,
  onRemoveRound,
  lang,
  t,
  canRemove,
  isFirstRound,
  isRound3 = false,
  failedItemIndexes = [],
}) => {
  const roundIndex = roundNumber - 1;

  const getTestResult = (itemIndex: number) => {
    return results.rounds[roundIndex]?.[itemIndex] || { h1: "", result: "" };
  };

  // Get file for specific item/round
  const getFile = (itemIndex: number): TestFile | undefined => {
    return results.files?.[itemIndex]?.[roundIndex]?.h1;
  };

  // Determine max rounds display
  const maxRoundsDisplay = totalRounds >= 3 ? "3" : "2";
  
  // Check if round 3 has failed items AND is auto-added (should show in red)
  const isRound3WithFailedItems = isRound3 && failedItemIndexes.length > 0 && !canRemove;

  // For round 3 with failed items, only show failed items
  const itemsToShow = isRound3WithFailedItems 
    ? testItems.filter((_, idx) => failedItemIndexes.includes(idx))
    : testItems;

  // Get previous round results for showing badges
  const getPreviousResults = (itemIndex: number) => {
    const r1 = results.rounds[0]?.[itemIndex];
    const r2 = results.rounds[1]?.[itemIndex];
    return { r1, r2 };
  };

  const renderTestItem = (item: ACTestItem, index: number, isLast: boolean) => {
    // For round 3 with failed items, use the actual index from testItems
    const actualIndex = isRound3WithFailedItems 
      ? testItems.findIndex(ti => ti.testName === item.testName)
      : index;
    
    const displayName = getTestName(item, lang, t);
    const currentResult = getTestResult(actualIndex);
    const itemId = `ac-test2-item-${actualIndex}-round-${roundNumber}`;
    const isRCDItem = /^RCD type\s*(A|F|B)$/i.test(item.testName) || /^RD[CD][-\s]?DD$/i.test(item.testName);
    const isEmergencyItem = item.testName === "Emergency";
    const isNoH1Item = isRCDItem || isEmergencyItem; // Items that don't need H.1 input

    // Check if disabled from previous round (NA selected)
    const isDisabledFromPreviousRound = isDisabledForRound(results, actualIndex, roundIndex);
    const isNaSelected = isNaInCurrentRound(results, actualIndex, roundIndex);
    const isInputDisabled = isDisabledFromPreviousRound || isNaSelected;
    const isButtonsDisabled = isDisabledFromPreviousRound;

    // Emergency only shows in first round
    if (isEmergencyItem && !isFirstRound) {
      return null;
    }

    // Show previous round results for round 3 with failed items
    const showPreviousResults = isRound3WithFailedItems;
    const prevResults = showPreviousResults ? getPreviousResults(actualIndex) : null;

    return (
      <div
        id={itemId}
        key={`${roundNumber}-${item.testName}`}
        className={`tw-py-4 tw-px-4 tw-transition-all tw-duration-300 hover:tw-bg-gray-50/50 ${
          !isLast ? "tw-border-b tw-border-gray-100" : ""
        } ${isDisabledFromPreviousRound ? "tw-opacity-50" : ""}`}
      >
        {/* Test Name */}
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
          <span className="tw-w-6 tw-h-6 tw-rounded-full tw-bg-gray-200 tw-text-gray-700 tw-text-xs tw-font-bold tw-flex tw-items-center tw-justify-center">
            {actualIndex + 1}
          </span>
          <Typography className="tw-font-semibold tw-text-gray-800 tw-text-sm">
            {displayName}
            {isDisabledFromPreviousRound && (
              <span className="tw-ml-2 tw-text-xs tw-text-gray-400 tw-font-normal">(N/A)</span>
            )}
          </Typography>
          
          {/* Tooltip Icon */}
          {item.tooltip && (
            <Tooltip content={item.tooltip[lang]} placement="bottom">
              <svg className="tw-w-4 tw-h-4 lg:tw-w-5 lg:tw-h-5 tw-text-gray-400 tw-cursor-help tw-flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </Tooltip>
          )}
          
          {/* Show previous round badges for round 3 */}
          {showPreviousResults && prevResults && (
            <div className="tw-flex tw-gap-1 tw-ml-2">
              {isFailResult(prevResults.r1?.result) && (
                <span className="tw-px-2 tw-py-0.5 tw-text-xs tw-font-medium tw-bg-red-100 tw-text-red-700 tw-rounded">
                  R1: ✗
                </span>
              )}
              {isFailResult(prevResults.r2?.result) && (
                <span className="tw-px-2 tw-py-0.5 tw-text-xs tw-font-medium tw-bg-red-100 tw-text-red-700 tw-rounded">
                  R2: ✗
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="tw-flex tw-flex-col tw-gap-3">
          {/* RCD Items - Type 2 (Spec) + H.1 (Measured Value) */}
          {isRCDItem && (
            <>
              {/* Row 1: RCD Spec Value - only in first round */}
              {isFirstRound && (
                <div className={`tw-flex tw-items-center tw-gap-2 tw-bg-gradient-to-r tw-from-gray-100 tw-to-transparent tw-rounded-xl tw-p-2 lg:tw-p-3 ${isNaSelected ? "tw-opacity-50" : ""}`}>
                  <span className="tw-text-xs tw-text-gray-600 tw-font-medium tw-whitespace-nowrap">{displayName}</span>
                  <NumericInput
                    value={results.type2Values[actualIndex] || ""}
                    onChange={(v) => onType2Change(actualIndex, v)}
                    className="tw-w-16 lg:tw-w-20 tw-px-2 lg:tw-px-3 tw-py-1.5 lg:tw-py-2 tw-text-xs lg:tw-text-sm tw-text-center tw-border tw-border-gray-200 tw-rounded-lg !tw-bg-white focus:tw-border-gray-400 focus:tw-ring-2 focus:tw-ring-gray-200 tw-outline-none tw-transition-all disabled:tw-bg-gray-100 disabled:tw-cursor-not-allowed"
                    placeholder={t.valuePlaceholder}
                    disabled={isNaSelected}
                    lang={lang}
                  />
                  <div className="tw-flex tw-items-center tw-justify-center tw-px-2 lg:tw-px-3 tw-py-1 lg:tw-py-1.5 tw-bg-gray-800 tw-text-white tw-font-bold tw-text-xs tw-rounded-lg">
                    mA
                  </div>
                </div>
              )}
              
              {/* Row 2: H.1 (Measured Value) + Pass/Fail + File + Remark */}
              <div className="tw-flex tw-flex-wrap lg:tw-flex-nowrap tw-items-center tw-gap-2 lg:tw-gap-3">
                <div className={`tw-flex tw-items-center tw-gap-2 tw-bg-gradient-to-r tw-from-gray-100 tw-to-transparent tw-rounded-xl tw-p-2 lg:tw-p-3 ${isInputDisabled ? "tw-opacity-50" : ""}`}>
                  <span className="tw-text-xs tw-text-gray-600 tw-font-medium tw-whitespace-nowrap">{t.h1}</span>
                  <NumericInput
                    value={currentResult?.h1 || ""}
                    onChange={(v) => onResultChange(roundIndex, actualIndex, "h1", v)}
                    className="tw-w-16 lg:tw-w-20 tw-px-2 lg:tw-px-3 tw-py-1.5 lg:tw-py-2 tw-text-xs lg:tw-text-sm tw-text-center tw-border tw-border-gray-200 tw-rounded-lg !tw-bg-white focus:tw-border-gray-400 focus:tw-ring-2 focus:tw-ring-gray-200 tw-outline-none tw-transition-all disabled:tw-bg-gray-100 disabled:tw-cursor-not-allowed"
                    placeholder={t.valuePlaceholder}
                    disabled={isInputDisabled}
                    lang={lang}
                  />
                  <div className="tw-flex tw-items-center tw-justify-center tw-px-2 lg:tw-px-3 tw-py-1 lg:tw-py-1.5 tw-bg-gray-800 tw-text-white tw-font-bold tw-text-xs tw-rounded-lg">
                    mA
                  </div>
                </div>
                
                {/* Desktop: PassFailButtons inline */}
                <div className="tw-hidden lg:tw-block">
                  <PassFailButtons
                    value={currentResult?.result || ""}
                    onChange={(v) => onResultChange(roundIndex, actualIndex, "result", v)}
                    lang={lang}
                    size="sm"
                    disabled={isButtonsDisabled}
                  />
                </div>

                {/* Desktop: File Upload inline */}
                <div className="tw-hidden lg:tw-block">
                  <FileUploadButton
                    file={getFile(actualIndex)}
                    onUpload={(file) => onFileUpload(roundIndex, actualIndex, file)}
                    onDelete={() => onFileDelete(roundIndex, actualIndex)}
                    lang={lang}
                    t={t}
                    size="sm"
                    disabled={isNaSelected}
                  />
                </div>
                
                {/* Desktop: Remark inline - pushed to right */}
                <div className="tw-hidden lg:tw-block tw-w-[150px] tw-flex-shrink-0 tw-ml-auto">
                  <input
                    type="text"
                    value={results.remarks[actualIndex] || ""}
                    onChange={(e) => onRemarkChange(actualIndex, e.target.value)}
                    className="tw-w-full tw-px-2 tw-py-1.5 tw-text-xs tw-border tw-border-gray-300 tw-rounded-lg !tw-bg-white focus:tw-border-gray-500 focus:tw-ring-2 focus:tw-ring-gray-300 tw-outline-none tw-transition-all placeholder:tw-text-gray-500"
                    placeholder={t.remarkPlaceholder}
                  />
                </div>
              </div>
              
              {/* Mobile: PassFailButtons + File + Remark */}
              <div className="tw-flex lg:tw-hidden tw-items-center tw-gap-2">
                <PassFailButtons
                  value={currentResult?.result || ""}
                  onChange={(v) => onResultChange(roundIndex, actualIndex, "result", v)}
                  lang={lang}
                  size="sm"
                  disabled={isButtonsDisabled}
                />
                <FileUploadButton
                  file={getFile(actualIndex)}
                  onUpload={(file) => onFileUpload(roundIndex, actualIndex, file)}
                  onDelete={() => onFileDelete(roundIndex, actualIndex)}
                  lang={lang}
                  t={t}
                  size="sm"
                  disabled={isNaSelected}
                />
                <input
                  type="text"
                  value={results.remarks[actualIndex] || ""}
                  onChange={(e) => onRemarkChange(actualIndex, e.target.value)}
                  className="tw-w-[120px] tw-flex-shrink-0 tw-px-2 tw-py-1.5 tw-text-xs tw-border tw-border-gray-300 tw-rounded-lg !tw-bg-white focus:tw-border-gray-500 focus:tw-ring-1 focus:tw-ring-gray-300 tw-outline-none placeholder:tw-text-gray-500"
                  placeholder={t.remarkPlaceholder}
                />
              </div>
            </>
          )}

          {/* Non-RCD Items */}
          {!isRCDItem && (
          <>
          <div className="tw-flex tw-flex-wrap lg:tw-flex-nowrap tw-items-center tw-gap-2 lg:tw-gap-3">
            {/* Emergency - only Pass/Fail buttons (no N/A), only first round */}
            {/* Uses type2Values like Isolation Transformer in DCTest1Grid */}
            {isEmergencyItem && isFirstRound && (
              <>
                {/* Desktop */}
                <div className="tw-hidden lg:tw-flex tw-items-center tw-gap-2 tw-bg-gradient-to-r tw-from-gray-100 tw-to-transparent tw-rounded-xl tw-p-2 lg:tw-p-3">
                  <PassFailButtons
                    value={results.type2Values[actualIndex] || ""}
                    onChange={(v) => onType2Change(actualIndex, v)}
                    lang={lang}
                    showNA={false}
                    size="sm"
                  />
                </div>
              </>
            )}

            {/* H.1 input (for items that need measurement value - not RCD, not Emergency) */}
            {!isNoH1Item && (
              <div className={`tw-flex tw-items-center tw-gap-2 tw-bg-gradient-to-r tw-from-gray-100 tw-to-transparent tw-rounded-xl tw-p-2 lg:tw-p-3 ${isInputDisabled ? "tw-opacity-50" : ""}`}>
                <span className="tw-text-xs tw-text-gray-600 tw-font-medium">{t.h1}</span>
                <NumericInput
                  value={currentResult?.h1 || ""}
                  onChange={(v) => onResultChange(roundIndex, actualIndex, "h1", v)}
                  className="tw-w-16 lg:tw-w-20 tw-px-2 lg:tw-px-3 tw-py-1.5 lg:tw-py-2 tw-text-xs lg:tw-text-sm tw-text-center tw-border tw-border-gray-200 tw-rounded-lg !tw-bg-white focus:tw-border-gray-400 focus:tw-ring-2 focus:tw-ring-gray-200 tw-outline-none tw-transition-all disabled:tw-bg-gray-100 disabled:tw-cursor-not-allowed"
                  placeholder={t.valuePlaceholder}
                  disabled={isInputDisabled}
                  lang={lang}
                />
                {item.unit && (
                  <div className="tw-flex tw-items-center tw-justify-center tw-px-2 lg:tw-px-3 tw-py-1 lg:tw-py-1.5 tw-bg-gray-800 tw-text-white tw-font-bold tw-text-xs tw-rounded-lg">
                    {item.unit}
                  </div>
                )}
              </div>
            )}

            {/* Pass/Fail buttons - Desktop (for non-Emergency items) */}
            {!isEmergencyItem && (
              <div className="tw-hidden lg:tw-block">
                <PassFailButtons
                  value={currentResult?.result || ""}
                  onChange={(v) => onResultChange(roundIndex, actualIndex, "result", v)}
                  lang={lang}
                  size="sm"
                  disabled={isButtonsDisabled}
                />
              </div>
            )}

            {/* File Upload - Desktop (for non-Emergency items) */}
            {!isEmergencyItem && (
              <div className="tw-hidden lg:tw-block">
                <FileUploadButton
                  file={getFile(actualIndex)}
                  onUpload={(file) => onFileUpload(roundIndex, actualIndex, file)}
                  onDelete={() => onFileDelete(roundIndex, actualIndex)}
                  lang={lang}
                  t={t}
                  size="sm"
                  disabled={isNaSelected}
                />
              </div>
            )}

            {/* Remark - Desktop - pushed to right */}
            <div className="tw-hidden lg:tw-block tw-w-[150px] tw-flex-shrink-0 tw-ml-auto">
              <input
                type="text"
                value={results.remarks[actualIndex] || ""}
                onChange={(e) => onRemarkChange(actualIndex, e.target.value)}
                className="tw-w-full tw-px-2 tw-py-1.5 tw-text-xs tw-border tw-border-gray-300 tw-rounded-lg !tw-bg-white focus:tw-border-gray-500 focus:tw-ring-2 focus:tw-ring-gray-300 tw-outline-none tw-transition-all placeholder:tw-text-gray-500"
                placeholder={t.remarkPlaceholder}
              />
            </div>
          </div>

          {/* Row 2: Mobile only - PassFail + File + Remark */}
          <div className="tw-flex lg:tw-hidden tw-items-center tw-gap-2">
            {/* Emergency - only Pass/Fail (no N/A), uses type2Values */}
            {isEmergencyItem && isFirstRound && (
              <PassFailButtons
                value={results.type2Values[actualIndex] || ""}
                onChange={(v) => onType2Change(actualIndex, v)}
                lang={lang}
                showNA={false}
                size="sm"
              />
            )}
            {/* Other items */}
            {!isEmergencyItem && (
              <>
                <PassFailButtons
                  value={currentResult?.result || ""}
                  onChange={(v) => onResultChange(roundIndex, actualIndex, "result", v)}
                  lang={lang}
                  size="sm"
                  disabled={isButtonsDisabled}
                />
                <FileUploadButton
                  file={getFile(actualIndex)}
                  onUpload={(file) => onFileUpload(roundIndex, actualIndex, file)}
                  onDelete={() => onFileDelete(roundIndex, actualIndex)}
                  lang={lang}
                  t={t}
                  size="sm"
                  disabled={isNaSelected}
                />
              </>
            )}
            <input
              type="text"
              value={results.remarks[actualIndex] || ""}
              onChange={(e) => onRemarkChange(actualIndex, e.target.value)}
              className="tw-w-[120px] tw-flex-shrink-0 tw-px-2 tw-py-1.5 tw-text-xs tw-border tw-border-gray-300 tw-rounded-lg !tw-bg-white focus:tw-border-gray-500 focus:tw-ring-1 focus:tw-ring-gray-300 tw-outline-none placeholder:tw-text-gray-500"
              placeholder={t.remarkPlaceholder}
            />
          </div>
          </>
          )}
        </div>
      </div>
    );
  };

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
        {itemsToShow.map((item, index) => renderTestItem(item, index, index === itemsToShow.length - 1))}
      </div>
    </div>
  );
};

/* ===================== UI: Main Grid Component ===================== */

interface TestResultsGridProps {
  title?: string;
  testItems: ACTestItem[];
  results: TestCharger;
  onResultChange: (roundIndex: number, itemIndex: number, field: "h1" | "result", value: string) => void;
  onType2Change: (itemIndex: number, value: string) => void;
  onRemarkChange: (itemIndex: number, value: string) => void;
  onFileUpload: (roundIndex: number, itemIndex: number, file: File) => void;
  onFileDelete: (roundIndex: number, itemIndex: number) => void;
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
  onType2Change,
  onRemarkChange,
  onFileUpload,
  onFileDelete,
  onAddRound,
  onRemoveRound,
  lang,
  t,
  isRound3Manual,
}) => {
  const totalRounds = results.rounds.length;
  const failedItemIndexes = getFailedItemIndexes(results, testItems);
  const allPassed = allItemsPassed(results, testItems);

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
            onType2Change={onType2Change}
            onRemarkChange={onRemarkChange}
            onFileUpload={onFileUpload}
            onFileDelete={onFileDelete}
            onRemoveRound={onRemoveRound}
            lang={lang}
            t={t}
            canRemove={idx === 2 && isRound3Manual}
            isFirstRound={idx === 0}
            isRound3={idx === 2}
            failedItemIndexes={failedItemIndexes}
          />
        ))}
      </div>
    </div>
  );
};

/* ===================== Component (export default) ===================== */

export interface ACTestGridProps {
  initialResults?: TestCharger | LegacyTestResults;
  onResultsChange?: (results: TestCharger) => void;
  initialRounds?: number;
  // API integration props
  reportId?: string;
  sn?: string;
  testType?: "electrical" | "charger";
}

const ACTest2Grid: React.FC<ACTestGridProps> = ({ 
  initialResults, 
  onResultsChange, 
  initialRounds = 2,
  reportId,
  sn,
  testType = "charger",
}) => {
  const getInitialResults = (): TestCharger => {
    if (!initialResults) {
      return createEmptyResults(AC_TEST2_DATA.length, initialRounds);
    }
    
    if ('test1' in initialResults && 'test2' in initialResults && 'test3' in initialResults) {
      const converted = convertLegacyToNew(initialResults as LegacyTestResults);
      // If legacy has 3 rounds but we want 2, keep only 2
      if (initialRounds === 2 && converted.rounds.length === 3) {
        converted.rounds = converted.rounds.slice(0, 2);
      }
      return converted;
    }
    
    // Ensure at least 2 rounds
    const results = initialResults as TestCharger;
    if (results.rounds.length < 2) {
      const newRounds = [...results.rounds];
      while (newRounds.length < 2) {
        newRounds.push(createEmptyRound(AC_TEST2_DATA.length));
      }
      return { ...results, rounds: newRounds };
    }
    
    return results;
  };

  const [results, setResults] = useState<TestCharger>(getInitialResults);
  const [isRound3Manual, setIsRound3Manual] = useState<boolean>(false);

  useEffect(() => {
    if (initialResults) {
      let newResults: TestCharger;
      if ('test1' in initialResults) {
        const converted = convertLegacyToNew(initialResults as LegacyTestResults);
        if (initialRounds === 2 && converted.rounds.length === 3) {
          converted.rounds = converted.rounds.slice(0, 2);
        }
        newResults = converted;
      } else {
        newResults = initialResults as TestCharger;
      }
      
      // Ensure at least 2 rounds
      if (newResults.rounds.length < 2) {
        const newRounds = [...newResults.rounds];
        while (newRounds.length < 2) {
          newRounds.push(createEmptyRound(AC_TEST2_DATA.length));
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
      const failedIndexes = getFailedItemIndexes(results, AC_TEST2_DATA);
      if (failedIndexes.length > 0) {
        // Auto add round 3
        const newRound = createEmptyRound(AC_TEST2_DATA.length);
        
        const newResults = {
          ...results,
          rounds: [...results.rounds, newRound]
        };
        setResults(newResults);
        onResultsChange?.(newResults);
      }
    }
  }, [JSON.stringify(results.rounds.slice(0, 2)), isRound3Manual]); // Watch for changes in round 1 and 2

  // Auto remove round 3 when all items pass in both rounds (only if not manually added)
  useEffect(() => {
    if (results.rounds.length === 3 && !isRound3Manual) {
      const failedIndexes = getFailedItemIndexes(results, AC_TEST2_DATA);
      
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

  const handleResultChange = (
    roundIndex: number,
    itemIndex: number,
    field: "h1" | "result",
    value: string
  ) => {
    const newResults = { ...results };
    newResults.rounds = [...newResults.rounds];
    newResults.rounds[roundIndex] = [...newResults.rounds[roundIndex]];
    newResults.rounds[roundIndex][itemIndex] = { 
      ...newResults.rounds[roundIndex][itemIndex], 
      [field]: value 
    };
    
    // Handle NA selection
    if (field === "result") {
      const previousResult = results.rounds[roundIndex]?.[itemIndex]?.result;
      
      if (value === "NA") {
        // Clear h1 value when NA is selected
        newResults.rounds[roundIndex][itemIndex].h1 = "";
        
        // Clear type2Values if this is first round and RCD item
        if (roundIndex === 0) {
          const testItem = AC_TEST2_DATA[itemIndex];
          const isRCDItem = /^RCD type\s*(A|F|B)$/i.test(testItem?.testName || "") || /^RD[CD][-\s]?DD$/i.test(testItem?.testName || "");
          if (isRCDItem) {
            newResults.type2Values = [...newResults.type2Values];
            newResults.type2Values[itemIndex] = "";
          }
        }
        
        // Set NA for all subsequent rounds
        for (let i = roundIndex + 1; i < newResults.rounds.length; i++) {
          newResults.rounds[i] = [...newResults.rounds[i]];
          newResults.rounds[i][itemIndex] = { h1: "", result: "NA" };
        }
      } else if (previousResult === "NA" && value !== "NA") {
        // If changing from NA to something else, clear NA from subsequent rounds
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

  const handleType2Change = (itemIndex: number, value: string) => {
    const newResults: TestCharger = { ...results, type2Values: [...results.type2Values] };
    newResults.type2Values[itemIndex] = value;
    setResults(newResults);
    onResultsChange?.(newResults);
  };

  const handleRemarkChange = (itemIndex: number, value: string) => {
    const newResults: TestCharger = { ...results, remarks: [...results.remarks] };
    newResults.remarks[itemIndex] = value;
    setResults(newResults);
    onResultsChange?.(newResults);
  };

  // Handle file upload with API
  const handleFileUpload = async (
    roundIndex: number,
    itemIndex: number,
    file: File
  ) => {
    // If reportId and sn provided, upload to server
    if (reportId && sn) {
      try {
        const formData = new FormData();
        formData.append("sn", sn);
        formData.append("test_type", testType);
        formData.append("item_index", String(itemIndex));
        formData.append("round_index", String(roundIndex));
        formData.append("handgun", "h1");
        formData.append("file", file);

        const token = localStorage.getItem("auth_token") || "";
        const res = await fetch(`/api/actestreport/${reportId}/test-files`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Upload failed");
        }

        const data = await res.json();
        
        // Update local state with server URL
        const newFiles: TestFiles = { ...results.files };
        if (!newFiles[itemIndex]) {
          newFiles[itemIndex] = {};
        }
        if (!newFiles[itemIndex][roundIndex]) {
          newFiles[itemIndex][roundIndex] = {};
        }
        
        newFiles[itemIndex][roundIndex].h1 = { 
          file, 
          url: data.file?.url || URL.createObjectURL(file), 
          name: file.name 
        };
        
        const newResults = { ...results, files: newFiles };
        setResults(newResults);
        onResultsChange?.(newResults);
      } catch (error) {
        console.error("File upload error:", error);
        alert(error instanceof Error ? error.message : "อัปโหลดไฟล์ไม่สำเร็จ");
      }
    } else {
      // Local only (no API)
      const url = URL.createObjectURL(file);
      const newFiles: TestFiles = { ...results.files };
      
      if (!newFiles[itemIndex]) {
        newFiles[itemIndex] = {};
      }
      if (!newFiles[itemIndex][roundIndex]) {
        newFiles[itemIndex][roundIndex] = {};
      }
      
      // Revoke old URL if exists
      const oldFile = newFiles[itemIndex][roundIndex].h1;
      if (oldFile?.url && oldFile.url.startsWith("blob:")) {
        URL.revokeObjectURL(oldFile.url);
      }
      
      newFiles[itemIndex][roundIndex].h1 = { file, url, name: file.name };
      
      const newResults = { ...results, files: newFiles };
      setResults(newResults);
      onResultsChange?.(newResults);
    }
  };

  // Handle file delete with API
  const handleFileDelete = async (
    roundIndex: number,
    itemIndex: number
  ) => {
    // If reportId and sn provided, delete from server
    if (reportId && sn) {
      try {
        const token = localStorage.getItem("auth_token") || "";
        const params = new URLSearchParams({
          sn,
          test_type: testType,
          item_index: String(itemIndex),
          round_index: String(roundIndex),
          handgun: "h1",
        });

        const res = await fetch(`/api/actestreport/${reportId}/test-files?${params}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Delete failed");
        }
      } catch (error) {
        console.error("File delete error:", error);
        alert(error instanceof Error ? error.message : "ลบไฟล์ไม่สำเร็จ");
        return;
      }
    }

    // Update local state
    const newFiles: TestFiles = { ...results.files };
    
    if (newFiles[itemIndex]?.[roundIndex]?.h1) {
      // Revoke URL if blob
      const fileData = newFiles[itemIndex][roundIndex].h1;
      if (fileData?.url && fileData.url.startsWith("blob:")) {
        URL.revokeObjectURL(fileData.url);
      }
      
      delete newFiles[itemIndex][roundIndex].h1;
      
      // Clean up empty objects
      if (Object.keys(newFiles[itemIndex][roundIndex]).length === 0) {
        delete newFiles[itemIndex][roundIndex];
      }
      if (Object.keys(newFiles[itemIndex]).length === 0) {
        delete newFiles[itemIndex];
      }
    }
    
    const newResults = { ...results, files: newFiles };
    setResults(newResults);
    onResultsChange?.(newResults);
  };

  // Manual add round 3 (when all passed but user wants to add)
  const handleAddRound = () => {
    if (results.rounds.length >= 3) return;
    
    const newRound = createEmptyRound(AC_TEST2_DATA.length);
    
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

  return (
    <div className="tw-w-full">
      <TestResultsGrid
        title={t.testResultsTitle}
        testItems={AC_TEST2_DATA}
        results={results}
        onResultChange={handleResultChange}
        onType2Change={handleType2Change}
        onRemarkChange={handleRemarkChange}
        onFileUpload={handleFileUpload}
        onFileDelete={handleFileDelete}
        onAddRound={handleAddRound}
        onRemoveRound={handleRemoveRound}
        lang={lang}
        t={t}
        isRound3Manual={isRound3Manual}
      />
    </div>
  );
};

export default ACTest2Grid;