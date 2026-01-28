"use client";

import React, { useState } from "react";
import { Typography } from "@material-tailwind/react";

// Import types from other components
import type { TestResults } from "./ACTest1Grid";
import type { TestCharger } from "./ACTest2Grid";

// Re-export for use in checkList.tsx
export type { TestResults, TestCharger };

// ===== Types =====
type Lang = "th" | "en";

export interface Head {
  issue_id: string;
  document_name: string;
  inspection_date: string;
  location: string;
  inspector: string;
  manufacturer?: string;
  model?: string;
  power?: string;
  firmware_version?: string;
  serial_number?: string;
}

export interface PhotoItem {
  text: string;
  images: { file: File; url: string }[];
}

export interface EquipmentBlock {
  manufacturers: string[];
  models: string[];
  serialNumbers: string[];
}

// ===== Translations =====
const translations = {
  th: {
    formStatus: "สถานะการกรอกข้อมูล",
    allComplete: "กรอกข้อมูลครบถ้วนแล้ว พร้อมบันทึก ✓",
    remaining: "ยังขาดอีก {n} รายการ",
    // Section names
    sectionMeta: "ข้อมูลทั่วไป",
    sectionEquipment: "รายละเอียดอุปกรณ์",
    sectionElectrical: "Electrical Safety Test",
    sectionCharger: "Charger Safety Test",
    sectionPhotos: "รูปภาพ",
    // Meta errors
    missingChargerNo: "ยังไม่ได้กรอก Charger No.",
    missingFirmware: "ยังไม่ได้กรอกเวอร์ชันเฟิร์มแวร์",
    missingPhaseSequence: "ยังไม่ได้กรอกลำดับเฟส",
    // Equipment errors
    missingManufacturer: "ยังไม่ได้กรอกผู้ผลิต",
    missingModel: "ยังไม่ได้กรอกรุ่น",
    missingSerial: "ยังไม่ได้กรอกหมายเลขเครื่อง",
    setNumber: "ชุดที่",
    // Test1 errors
    missingTestValue: "ยังไม่ได้กรอกค่าทดสอบ",
    missingResult: "ยังไม่ได้เลือกผลทดสอบ",
    missingRcdValue: "ยังไม่ได้กรอกค่า RCD",
    missingRemark: "ยังไม่ได้กรอกหมายเหตุ",
    round: "รอบ",
    // Test2 errors
    missingH1: "ยังไม่ได้กรอกค่า H.1",
    missingType2: "ยังไม่ได้กรอกค่า Type 2 (mA)",
    // Photo errors
    missingPhoto: "ยังไม่ได้เพิ่มรูปภาพ",
    items: "รายการ",
  },
  en: {
    formStatus: "Form Completion Status",
    allComplete: "All fields completed. Ready to save ✓",
    remaining: "{n} items remaining",
    // Section names
    sectionMeta: "General Information",
    sectionEquipment: "Equipment Details",
    sectionElectrical: "Electrical Safety Test",
    sectionCharger: "Charger Safety Test",
    sectionPhotos: "Photos",
    // Meta errors
    missingChargerNo: "Charger No. is missing",
    missingFirmware: "Firmware Version is missing",
    missingPhaseSequence: "Phase Sequence is missing",
    // Equipment errors
    missingManufacturer: "Manufacturer is missing",
    missingModel: "Model is missing",
    missingSerial: "Serial Number is missing",
    setNumber: "Set",
    // Test1 errors
    missingTestValue: "Test value is missing",
    missingResult: "Result not selected",
    missingRcdValue: "RCD value is missing",
    missingRemark: "Remark is missing",
    round: "Round",
    // Test2 errors
    missingH1: "H.1 value is missing",
    missingType2: "Type 2 value (mA) is missing",
    // Photo errors
    missingPhoto: "Photo not added",
    items: "items",
  },
};

// ===== Test Data =====
// AC Test1 items (different from DC: Pin PE instead of Pin PE H.1/H.2, no Isolation Transformer)
const AC_TEST1_ITEMS = [
  { testName: "Left Cover", testNameTh: "ฝาครอบซ้าย", isRCD: false, isPowerStandby: false },
  { testName: "Right Cover", testNameTh: "ฝาครอบขวา", isRCD: false, isPowerStandby: false },
  { testName: "Front Cover", testNameTh: "ฝาครอบหน้า", isRCD: false, isPowerStandby: false },
  { testName: "Back Cover", testNameTh: "ฝาครอบหลัง", isRCD: false, isPowerStandby: false },
  { testName: "Charger Stand", testNameTh: "ขาตั้งเครื่องชาร์จ", isRCD: false, isPowerStandby: false },
  { testName: "Pin PE", testNameTh: "Pin PE", isRCD: false, isPowerStandby: false },
  { testName: "RCD type A", testNameTh: "RCD ชนิด A", isRCD: true, isPowerStandby: false },
  { testName: "RCD type F", testNameTh: "RCD ชนิด F", isRCD: true, isPowerStandby: false },
  { testName: "RCD type B", testNameTh: "RCD ชนิด B", isRCD: true, isPowerStandby: false },
  { testName: "Power standby", testNameTh: "พลังงานขณะสแตนด์บาย", isRCD: false, isPowerStandby: true },
];

// AC Test2 items (different from DC: h1+result instead of h1+h2, has RCD items with type2Values)
const AC_TEST2_ITEMS = [
  { testName: "Continuity PE", testNameTh: "Continuity PE", isRCD: false, isEmergency: false },
  { testName: "Insulation Cable", testNameTh: "Insulation Cable", isRCD: false, isEmergency: false },
  { testName: "State A", testNameTh: "State A", isRCD: false, isEmergency: false },
  { testName: "State B", testNameTh: "State B", isRCD: false, isEmergency: false },
  { testName: "State C", testNameTh: "State C", isRCD: false, isEmergency: false },
  { testName: "CP Short", testNameTh: "CP Short", isRCD: false, isEmergency: false },
  { testName: "PE Cut", testNameTh: "PE Cut", isRCD: false, isEmergency: false },
  { testName: "Emergency", testNameTh: "Emergency", isRCD: false, isEmergency: true },
  { testName: "RCD type A", testNameTh: "RCD type A", isRCD: true, isEmergency: false },
  { testName: "RCD type F", testNameTh: "RCD type F", isRCD: true, isEmergency: false },
  { testName: "RCD type B", testNameTh: "RCD type B", isRCD: true, isEmergency: false },
  { testName: "RDC-DD", testNameTh: "RDC-DD", isRCD: true, isEmergency: false },
];

const PHOTO_CATEGORIES = [
  { key: "nameplate", en: "Nameplate", th: "Nameplate" },
  { key: "charger", en: "Charger", th: "Charger" },
  { key: "circuitBreaker", en: "Circuit Breaker", th: "Circuit Breaker" },
  { key: "rcd", en: "RCD", th: "RCD" },
  { key: "gun1", en: "GUN 1", th: "GUN 1" },
  { key: "gun2", en: "GUN 2", th: "GUN 2" },
];

// ===== Validation Error Type =====
interface ValidationError {
  section: string;
  sectionIcon: string;
  itemName: string;
  message: string;
  scrollId?: string;
}

// ===== Validation Functions =====

function validateMeta(head: Head, chargerNo: string, phaseSequence: string, lang: Lang): ValidationError[] {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  // chargerNo มาจาก API โดยอัตโนมัติ ไม่ต้อง scroll ไปหา
  if (!chargerNo?.trim()) {
    errors.push({
      section: t.sectionMeta,
      sectionIcon: "📋",
      itemName: "Charger No.",
      message: t.missingChargerNo,
      // ไม่มี scrollId เพราะ chargerNo ไม่ใช่ input field ที่ user กรอก
    });
  }

  if (!head.firmware_version?.trim() || head.firmware_version === "-") {
    errors.push({
      section: t.sectionMeta,
      sectionIcon: "📋",
      itemName: lang === "th" ? "เวอร์ชันเฟิร์มแวร์" : "Firmware Version",
      message: t.missingFirmware,
      scrollId: "ac-form-meta-firmware_version",
    });
  }

  if (!phaseSequence?.trim()) {
    errors.push({
      section: t.sectionMeta,
      sectionIcon: "📋",
      itemName: lang === "th" ? "ลำดับเฟส" : "Phase Sequence",
      message: t.missingPhaseSequence,
      scrollId: "ac-phase-sequence-input",
    });
  }

  return errors;
}

function validateEquipment(equipment: EquipmentBlock, lang: Lang): ValidationError[] {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  equipment.manufacturers.forEach((_, index) => {
    const setName = `${t.setNumber} ${index + 1}`;

    if (!equipment.manufacturers[index]?.trim()) {
      errors.push({
        section: t.sectionEquipment,
        sectionIcon: "🔧",
        itemName: setName,
        message: t.missingManufacturer,
        scrollId: `ac-equipment-set-${index}`,
      });
    }

    if (!equipment.models[index]?.trim()) {
      errors.push({
        section: t.sectionEquipment,
        sectionIcon: "🔧",
        itemName: setName,
        message: t.missingModel,
        scrollId: `ac-equipment-set-${index}`,
      });
    }

    if (!equipment.serialNumbers[index]?.trim()) {
      errors.push({
        section: t.sectionEquipment,
        sectionIcon: "🔧",
        itemName: setName,
        message: t.missingSerial,
        scrollId: `ac-equipment-set-${index}`,
      });
    }
  });

  return errors;
}

function validateTest1(results: TestResults | null, lang: Lang): ValidationError[] {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  // ถ้า results เป็น null ให้สร้าง empty object เพื่อ validate ทุก field
  const safeResults = results || {
    rounds: [[]],
    remarks: [],
    rcdValues: [],
    powerStandby: { L1: "", L2: "", L3: "" },
  };

  // Helper: Check if item failed in round 1 or 2 (for round 3 validation)
  const isFailedInRound1Or2 = (itemIndex: number): boolean => {
    const r1Result = safeResults.rounds[0]?.[itemIndex]?.result;
    const r2Result = safeResults.rounds[1]?.[itemIndex]?.result;
    const isFailResult = (v?: string) => v === "FAIL" || v === "✗";
    return isFailResult(r1Result) || isFailResult(r2Result);
  };

  AC_TEST1_ITEMS.forEach((item, itemIndex) => {
    const displayName = lang === "th" ? item.testNameTh : item.testName;

    // Check if item is NA in first round (skip remark validation)
    const firstRoundResult = safeResults.rounds[0]?.[itemIndex]?.result;
    const isNaInFirstRound = firstRoundResult === "NA";

    // Check remark (skip if NA)
    if (!isNaInFirstRound && !safeResults.remarks[itemIndex]?.trim()) {
      errors.push({
        section: t.sectionElectrical,
        sectionIcon: "⚡",
        itemName: displayName,
        message: t.missingRemark,
        scrollId: `ac-test-item-${itemIndex}-round-1`,
      });
    }

    // Power Standby
    if (item.isPowerStandby) {
      if (!safeResults.powerStandby?.L1?.trim()) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: displayName,
          message: "L1 " + t.missingTestValue,
          scrollId: `ac-test-item-${itemIndex}-round-1`,
        });
      }
      if (!safeResults.powerStandby?.L2?.trim()) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: displayName,
          message: "L2 " + t.missingTestValue,
          scrollId: `ac-test-item-${itemIndex}-round-1`,
        });
      }
      if (!safeResults.powerStandby?.L3?.trim()) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: displayName,
          message: "L3 " + t.missingTestValue,
          scrollId: `ac-test-item-${itemIndex}-round-1`,
        });
      }
      return;
    }

    // RCD Items
    if (item.isRCD) {
      const firstRoundResult = safeResults.rounds[0]?.[itemIndex]?.result;
      if (firstRoundResult === "NA") return;

      if (!safeResults.rcdValues[itemIndex]?.trim()) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: displayName,
          message: t.missingRcdValue,
          scrollId: `ac-test-item-${itemIndex}-round-1`,
        });
      }

      safeResults.rounds.forEach((roundData, roundIndex) => {
        const roundResult = roundData[itemIndex]?.result;
        if (roundResult === "NA") return;

        // Round 3: Only validate items that failed in round 1 or 2
        if (roundIndex === 2 && !isFailedInRound1Or2(itemIndex)) {
          return;
        }

        if (!roundData[itemIndex]?.h1?.trim()) {
          errors.push({
            section: t.sectionElectrical,
            sectionIcon: "⚡",
            itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
            message: t.missingTestValue,
            scrollId: `ac-test-item-${itemIndex}-round-${roundIndex + 1}`,
          });
        }

        if (!roundResult || !["PASS", "FAIL", "NA", "✓", "✗"].includes(roundResult)) {
          errors.push({
            section: t.sectionElectrical,
            sectionIcon: "⚡",
            itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
            message: t.missingResult,
            scrollId: `ac-test-item-${itemIndex}-round-${roundIndex + 1}`,
          });
        }
      });
      return;
    }

    // PE Continuity Items (Left/Right/Front/Back Cover, Charger Stand, Pin PE)
    safeResults.rounds.forEach((roundData, roundIndex) => {
      const roundResult = roundData[itemIndex]?.result;
      
      // Skip validation if this round is NA
      if (roundResult === "NA") return;

      // Round 3: Only validate items that failed in round 1 or 2
      if (roundIndex === 2 && !isFailedInRound1Or2(itemIndex)) {
        return;
      }

      if (!roundData[itemIndex]?.h1?.trim()) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
          message: t.missingTestValue,
          scrollId: `ac-test-item-${itemIndex}-round-${roundIndex + 1}`,
        });
      }

      if (!roundResult || !["PASS", "FAIL", "NA", "✓", "✗"].includes(roundResult)) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
          message: t.missingResult,
          scrollId: `ac-test-item-${itemIndex}-round-${roundIndex + 1}`,
        });
      }
    });
  });

  return errors;
}

function validateTest2(results: TestCharger | null, lang: Lang): ValidationError[] {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  // ถ้า results เป็น null ให้สร้าง empty object เพื่อ validate ทุก field
  const safeResults = results || {
    rounds: [[]],
    remarks: [],
    type2Values: [],
  };

  // Helper: Check if item failed in round 1 or 2 (for round 3 validation)
  const isFailedInRound1Or2 = (itemIndex: number): boolean => {
    const r1Result = safeResults.rounds[0]?.[itemIndex]?.result;
    const r2Result = safeResults.rounds[1]?.[itemIndex]?.result;
    const isFailResult = (v?: string) => v === "FAIL" || v === "✗";
    return isFailResult(r1Result) || isFailResult(r2Result);
  };

  AC_TEST2_ITEMS.forEach((item, itemIndex) => {
    const displayName = lang === "th" ? item.testNameTh : item.testName;
    const isEmergency = item.isEmergency;

    // Check if item is NA in first round (skip all validation for this item)
    const firstRoundResult = safeResults.rounds[0]?.[itemIndex]?.result;
    if (firstRoundResult === "NA") return;

    // RCD items need type2Values (first round only)
    if (item.isRCD) {
      if (!safeResults.type2Values[itemIndex]?.trim()) {
        errors.push({
          section: t.sectionCharger,
          sectionIcon: "🔌",
          itemName: displayName,
          message: t.missingType2,
          scrollId: `ac-test2-item-${itemIndex}-round-1`,
        });
      }
    }

    // Emergency: only validate round 1, no H.1, only PASS/FAIL (no NA)
    if (isEmergency) {
      const result = safeResults.rounds[0]?.[itemIndex]?.result;
      if (!result || !["PASS", "FAIL", "✓", "✗"].includes(result)) {
        errors.push({
          section: t.sectionCharger,
          sectionIcon: "🔌",
          itemName: `${displayName} (${t.round} 1)`,
          message: t.missingResult,
          scrollId: `ac-test2-item-${itemIndex}-round-1`,
        });
      }
      return; // Skip other rounds for Emergency
    }

    // Check each round for non-Emergency items
    safeResults.rounds.forEach((roundData, roundIndex) => {
      const roundResult = roundData[itemIndex]?.result;
      
      // Skip validation if this round is NA
      if (roundResult === "NA") return;

      // Round 3: Only validate items that failed in round 1 or 2
      if (roundIndex === 2 && !isFailedInRound1Or2(itemIndex)) {
        return; // Skip this item for round 3 if it didn't fail in rounds 1-2
      }

      // Non-RCD items need h1 value (except Emergency which is handled above)
      if (!item.isRCD && !roundData[itemIndex]?.h1?.trim()) {
        errors.push({
          section: t.sectionCharger,
          sectionIcon: "🔌",
          itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
          message: t.missingH1,
          scrollId: `ac-test2-item-${itemIndex}-round-${roundIndex + 1}`,
        });
      }

      // RCD items also need h1 value (measured value)
      if (item.isRCD && !roundData[itemIndex]?.h1?.trim()) {
        errors.push({
          section: t.sectionCharger,
          sectionIcon: "🔌",
          itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
          message: t.missingH1,
          scrollId: `ac-test2-item-${itemIndex}-round-${roundIndex + 1}`,
        });
      }

      if (!roundResult || !["PASS", "FAIL", "NA", "✓", "✗"].includes(roundResult)) {
        errors.push({
          section: t.sectionCharger,
          sectionIcon: "🔌",
          itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
          message: t.missingResult,
          scrollId: `ac-test2-item-${itemIndex}-round-${roundIndex + 1}`,
        });
      }
    });
  });

  return errors;
}

function validatePhotos(items: PhotoItem[], lang: Lang): ValidationError[] {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  PHOTO_CATEGORIES.forEach((category, index) => {
    const categoryName = lang === "th" ? category.th : category.en;
    const item = items[index];

    if (!item?.images || item.images.length === 0) {
      errors.push({
        section: t.sectionPhotos,
        sectionIcon: "📷",
        itemName: categoryName,
        message: t.missingPhoto,
        scrollId: `ac-photo-category-${category.key}`,
      });
    }
  });

  return errors;
}

// ===== Group errors by section =====
function groupErrorsBySection(errors: ValidationError[]): Map<string, ValidationError[]> {
  const grouped = new Map<string, ValidationError[]>();
  errors.forEach((error) => {
    const key = `${error.sectionIcon} ${error.section}`;
    const existing = grouped.get(key) || [];
    existing.push(error);
    grouped.set(key, existing);
  });
  return grouped;
}

// ===== Props =====
interface ACMasterValidationProps {
  head: Head;
  chargerNo: string;
  phaseSequence: string;
  equipment: EquipmentBlock;
  acTest1Results: TestResults | null;
  acChargerTest: TestCharger | null;
  photoItems: PhotoItem[];
  lang?: Lang;
}

// ===== Component =====
const ACMasterValidation: React.FC<ACMasterValidationProps> = ({
  head,
  chargerNo,
  phaseSequence,
  equipment,
  acTest1Results,
  acChargerTest,
  photoItems,
  lang = "th",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = translations[lang];

  // Collect all errors
  const allErrors: ValidationError[] = [
    ...validateMeta(head, chargerNo, phaseSequence, lang),
    ...validateEquipment(equipment, lang),
    ...validateTest1(acTest1Results, lang),
    ...validateTest2(acChargerTest, lang),
    ...validatePhotos(photoItems, lang),
  ];

  const groupedErrors = groupErrorsBySection(allErrors);
  const isComplete = allErrors.length === 0;

  // Scroll to item and highlight
  const scrollToItem = (scrollId?: string) => {
    if (!scrollId) return;
    const element = document.getElementById(scrollId);

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50");
      setTimeout(() => {
        element.classList.remove("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50");
      }, 2000);
    }
  };

  return (
    <div
      className={`tw-rounded-xl tw-border tw-shadow-sm tw-overflow-hidden ${
        isComplete ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"
      }`}
    >
      {/* Header */}
      <div
        className={`tw-px-4 tw-py-3 tw-cursor-pointer tw-flex tw-items-center tw-justify-between ${
          isComplete ? "tw-bg-green-100" : "tw-bg-amber-100"
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="tw-flex tw-items-center tw-gap-3">
          {isComplete ? (
            <div className="tw-w-10 tw-h-10 tw-rounded-full tw-bg-green-500 tw-flex tw-items-center tw-justify-center">
              <svg className="tw-w-6 tw-h-6 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="tw-w-10 tw-h-10 tw-rounded-full tw-bg-amber-500 tw-flex tw-items-center tw-justify-center">
              <svg className="tw-w-6 tw-h-6 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          )}
          <div>
            <Typography className={`tw-font-bold tw-text-base ${isComplete ? "tw-text-green-800" : "tw-text-amber-800"}`}>
              {t.formStatus}
            </Typography>
            <Typography variant="small" className={isComplete ? "tw-text-green-600" : "tw-text-amber-600"}>
              {isComplete ? t.allComplete : t.remaining.replace("{n}", String(allErrors.length))}
            </Typography>
          </div>
        </div>

        <div className="tw-flex tw-items-center tw-gap-4">
          {/* Section badges */}
          {!isComplete && (
            <div className="tw-hidden md:tw-flex tw-items-center tw-gap-2">
              {Array.from(groupedErrors.keys()).map((sectionKey) => (
                <span
                  key={sectionKey}
                  className="tw-text-xs tw-bg-amber-200 tw-text-amber-800 tw-px-2 tw-py-1 tw-rounded-full tw-font-medium"
                >
                  {sectionKey.split(" ")[0]} {groupedErrors.get(sectionKey)?.length}
                </span>
              ))}
            </div>
          )}

          {/* Expand/Collapse */}
          {!isComplete && (
            <svg
              className={`tw-w-6 tw-h-6 tw-text-amber-600 tw-transition-transform ${isExpanded ? "tw-rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>

      {/* Error List */}
      {isExpanded && !isComplete && (
        <div className="tw-px-4 tw-py-3 tw-max-h-80 tw-overflow-y-auto">
          <div className="tw-space-y-4">
            {Array.from(groupedErrors.entries()).map(([sectionKey, sectionErrors]) => (
              <div key={sectionKey} className="tw-bg-white tw-rounded-lg tw-p-3 tw-border tw-border-amber-200">
                <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
                  <Typography className="tw-font-semibold tw-text-gray-800 tw-text-sm">{sectionKey}</Typography>
                  <span className="tw-text-xs tw-bg-amber-100 tw-text-amber-700 tw-px-2 tw-py-0.5 tw-rounded-full">
                    {sectionErrors.length} {t.items}
                  </span>
                </div>
                <ul className="tw-space-y-1 tw-max-h-40 tw-overflow-y-auto">
                  {sectionErrors.map((error, idx) => (
                    <li
                      key={idx}
                      className="tw-flex tw-items-start tw-gap-2 tw-text-sm tw-text-amber-700 tw-cursor-pointer hover:tw-text-amber-900 hover:tw-bg-amber-50 tw-rounded tw-px-1 tw-py-0.5 tw-transition-colors"
                      onClick={() => scrollToItem(error.scrollId)}
                    >
                      <span className="tw-text-amber-500 tw-mt-0.5">→</span>
                      <span>
                        <span className="tw-font-medium">{error.itemName}:</span>{" "}
                        <span className="tw-underline tw-underline-offset-2">{error.message}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ACMasterValidation;

// ★ Export function สำหรับเช็คว่ากรอกครบหรือยัง (ใช้ใน checkList.tsx)
export function isFormComplete(
  head: Head,
  chargerNo: string,
  phaseSequence: string,
  equipment: EquipmentBlock,
  acTest1Results: TestResults | null,
  acChargerTest: TestCharger | null,
  photoItems: PhotoItem[]
): boolean {
  const allErrors = [
    ...validateMeta(head, chargerNo, phaseSequence, "th"),
    ...validateEquipment(equipment, "th"),
    ...validateTest1(acTest1Results, "th"),
    ...validateTest2(acChargerTest, "th"),
    ...validatePhotos(photoItems, "th"),
  ];
  return allErrors.length === 0;
}