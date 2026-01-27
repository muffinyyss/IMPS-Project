"use client";

import React, { useState } from "react";
import { Typography } from "@material-tailwind/react";

// Import types from other components
import type { TestResults } from "./DCTest1Grid";
import type { TestCharger } from "./DCTest2Grid";

// Re-export for use in checkList.tsx
export type { TestResults, TestCharger };

// ===== Types =====
type Lang = "th" | "en";

export interface Head {
  issue_id: string;
  inspection_date: string;
  location: string;
  manufacturer?: string;
  model?: string;
  power?: string;
  firmware_version?: string;
  serial_number?: string;
  inspector?: string;
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
    missingFirmware: "ยังไม่ได้กรอกเวอร์ชันเฟิร์มแวร์",
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
    missingH1: "ยังไม่ได้เลือก H1",
    missingH2: "ยังไม่ได้เลือก H2",
    missingFileH1: "ยังไม่ได้แนบไฟล์ H1",
    missingFileH2: "ยังไม่ได้แนบไฟล์ H2",
    // Photo errors
    missingPhoto: "ยังไม่ได้เพิ่มรูปภาพ",
    // Tooltips
    clickToScroll: "คลิกเพื่อไปยังช่องที่ต้องกรอก",
    expandToSeeErrors: "คลิกเพื่อดูรายการที่ต้องกรอก",
    collapseErrors: "คลิกเพื่อซ่อนรายการ",
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
    missingFirmware: "Firmware Version is missing",
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
    missingH1: "H1 not selected",
    missingH2: "H2 not selected",
    missingFileH1: "H1 file not attached",
    missingFileH2: "H2 file not attached",
    // Photo errors
    missingPhoto: "Photo not added",
    // Tooltips
    clickToScroll: "Click to go to the field",
    expandToSeeErrors: "Click to see missing fields",
    collapseErrors: "Click to collapse",
  },
};

// ===== Test Data =====
const DC_TEST1_ITEMS = [
  { testName: "Left Cover", testNameTh: "ฝาครอบซ้าย", isRCD: false, isPowerStandby: false, isIsolation: false },
  { testName: "Right Cover", testNameTh: "ฝาครอบขวา", isRCD: false, isPowerStandby: false, isIsolation: false },
  { testName: "Front Cover", testNameTh: "ฝาครอบหน้า", isRCD: false, isPowerStandby: false, isIsolation: false },
  { testName: "Back Cover", testNameTh: "ฝาครอบหลัง", isRCD: false, isPowerStandby: false, isIsolation: false },
  { testName: "Pin PE H.1", testNameTh: "Pin PE H.1", isRCD: false, isPowerStandby: false, isIsolation: false },
  { testName: "Pin PE H.2", testNameTh: "Pin PE H.2", isRCD: false, isPowerStandby: false, isIsolation: false },
  { testName: "RCD type A", testNameTh: "RCD ชนิด A", isRCD: true, isPowerStandby: false, isIsolation: false },
  { testName: "RCD type F", testNameTh: "RCD ชนิด F", isRCD: true, isPowerStandby: false, isIsolation: false },
  { testName: "RCD type B", testNameTh: "RCD ชนิด B", isRCD: true, isPowerStandby: false, isIsolation: false },
  { testName: "Isolation Transformer", testNameTh: "หม้อแปลงแยก", isRCD: false, isPowerStandby: false, isIsolation: true },
  { testName: "Power standby", testNameTh: "พลังงานขณะสแตนด์บาย", isRCD: false, isPowerStandby: true, isIsolation: false },
];

const DC_TEST2_ITEMS = [
  { testName: "None (Normal operate)", testNameTh: "ไม่มี (ทำงานปกติ)" },
  { testName: "CP short -120 Ohm", testNameTh: "CP ลัดวงจร -120 โอห์ม" },
  { testName: "PE-PP-Cut", testNameTh: "PE-PP-ตัด" },
  { testName: "Remote Stop", testNameTh: "หยุดระยะไกล" },
  { testName: "Emergency", testNameTh: "ฉุกเฉิน" },
  { testName: "LDC +", testNameTh: "LDC +" },
  { testName: "LDC  -", testNameTh: "LDC -" },
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


// ===== Helper Functions =====
const isFailResult = (value?: string): boolean => {
  return value === "FAIL" || value === "✗";
};

const isPassResult = (value?: string): boolean => {
  return value === "PASS" || value === "✓";
};

const isNaResult = (value?: string): boolean => {
  return value === "NA";
};

const isValidResult = (value?: string): boolean => {
  return ["PASS", "FAIL", "NA", "✓", "✗"].includes(value || "");
};

// Get failed item indexes for DCTest1 (items that need retest in round 3)
const getTest1FailedItemIndexes = (results: TestResults): number[] => {
  const failedIndexes: number[] = [];
  
  DC_TEST1_ITEMS.forEach((item, index) => {
    // Skip Isolation Transformer and Power Standby (they are only in round 1)
    if (item.isIsolation || item.isPowerStandby) return;
    
    const round1Result = results.rounds[0]?.[index]?.result;
    const round2Result = results.rounds[1]?.[index]?.result;
    
    // If NA in either round, skip
    if (isNaResult(round1Result) || isNaResult(round2Result)) return;
    
    // Check if explicitly failed in either round
    if (isFailResult(round1Result) || isFailResult(round2Result)) {
      failedIndexes.push(index);
    }
  });
  
  return failedIndexes;
};

// Get failed items for DCTest2 with H1/H2 info
interface Test2FailedItem {
  itemIndex: number;
  h1Failed: boolean;
  h2Failed: boolean;
}

const getTest2FailedItems = (results: TestCharger): Test2FailedItem[] => {
  const failedItems: Test2FailedItem[] = [];
  
  DC_TEST2_ITEMS.forEach((item, index) => {
    const round1H1 = results.rounds[0]?.[index]?.h1;
    const round1H2 = results.rounds[0]?.[index]?.h2;
    const round2H1 = results.rounds[1]?.[index]?.h1;
    const round2H2 = results.rounds[1]?.[index]?.h2;
    
    // Check if H1 failed in either round
    const h1Failed = isFailResult(round1H1) || isFailResult(round2H1);
    
    // Check if H2 failed in either round
    const h2Failed = isFailResult(round1H2) || isFailResult(round2H2);
    
    // If either H1 or H2 failed, add to list
    if (h1Failed || h2Failed) {
      failedItems.push({
        itemIndex: index,
        h1Failed,
        h2Failed,
      });
    }
  });
  
  return failedItems;
};

// ===== Validation Functions =====

function validateMeta(head: Head, phaseSequence: string, lang: Lang): ValidationError[] {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  if (!head.firmware_version?.trim()) {
    errors.push({
      section: t.sectionMeta,
      sectionIcon: "📋",
      itemName: lang === "th" ? "เวอร์ชันเฟิร์มแวร์" : "Firmware Version",
      message: t.missingFirmware,
      scrollId: "form-meta-firmware_version",
    });
  }

  if (!phaseSequence?.trim()) {
    errors.push({
      section: t.sectionMeta,
      sectionIcon: "📋",
      itemName: lang === "th" ? "ลำดับเฟส" : "Phase Sequence",
      message: lang === "th" ? "ยังไม่ได้กรอกลำดับเฟส" : "Phase Sequence is missing",
      scrollId: "phase-sequence-input",
    });
  }

  return errors;
}

function validateEquipment(
  equipment: EquipmentBlock,
  lang: Lang
): ValidationError[] {
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
        scrollId: `equipment-set-${index}`,
      });
    }

    if (!equipment.models[index]?.trim()) {
      errors.push({
        section: t.sectionEquipment,
        sectionIcon: "🔧",
        itemName: setName,
        message: t.missingModel,
        scrollId: `equipment-set-${index}`,
      });
    }

    if (!equipment.serialNumbers[index]?.trim()) {
      errors.push({
        section: t.sectionEquipment,
        sectionIcon: "🔧",
        itemName: setName,
        message: t.missingSerial,
        scrollId: `equipment-set-${index}`,
      });
    }
  });

  return errors;
}

function validateTest1(
  results: TestResults | null,
  lang: Lang
): ValidationError[] {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  // ถ้า results === null ให้ validate ว่าขาดอะไรบ้าง แทนที่จะ return error ทันที
  if (!results) {
    // Validate ทุก item ว่าหากต้องกรอก
    DC_TEST1_ITEMS.forEach((item, itemIndex) => {
      const displayName = lang === "th" ? item.testNameTh : item.testName;
      
      // Power Standby และ Isolation Transformer ต้องกรอก round 1
      if (item.isPowerStandby) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: displayName,
          message: "L1 " + t.missingTestValue,
          scrollId: `test-item-${itemIndex}-round-1`,
        });
        return;
      }
      
      if (item.isIsolation) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: displayName,
          message: t.missingResult,
          scrollId: `test-item-${itemIndex}-round-1`,
        });
        return;
      }
      
      // RCD และ PE Continuity ต้องกรอก round 1 อย่างน้อย
      errors.push({
        section: t.sectionElectrical,
        sectionIcon: "⚡",
        itemName: displayName,
        message: t.missingTestValue,
        scrollId: `test-item-${itemIndex}-round-1`,
      });
    });
    return errors;
  }

  // Get failed item indexes for round 3 validation
  const failedItemIndexes = getTest1FailedItemIndexes(results);
  const hasRound3 = results.rounds.length >= 3;

  DC_TEST1_ITEMS.forEach((item, itemIndex) => {
    const displayName = lang === "th" ? item.testNameTh : item.testName;

    // Power Standby - only in round 1
    if (item.isPowerStandby) {
      if (!results.powerStandby?.L1?.trim()) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: displayName,
          message: "L1 " + t.missingTestValue,
          scrollId: `test-item-${itemIndex}-round-1`,
        });
      }
      if (!results.powerStandby?.L2?.trim()) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: displayName,
          message: "L2 " + t.missingTestValue,
          scrollId: `test-item-${itemIndex}-round-1`,
        });
      }
      if (!results.powerStandby?.L3?.trim()) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: displayName,
          message: "L3 " + t.missingTestValue,
          scrollId: `test-item-${itemIndex}-round-1`,
        });
      }
      return;
    }

    // Isolation Transformer - only in round 1
    if (item.isIsolation) {
      const result = results.rcdValues[itemIndex];
      if (!result || !["PASS", "FAIL", "✓", "✗"].includes(result)) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: displayName,
          message: t.missingResult,
          scrollId: `test-item-${itemIndex}-round-1`,
        });
      }
      return;
    }

    // RCD Items
    if (item.isRCD) {
      const firstRoundResult = results.rounds[0]?.[itemIndex]?.result;
      if (firstRoundResult === "NA") return;

      if (!results.rcdValues[itemIndex]?.trim()) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: displayName,
          message: t.missingRcdValue,
          scrollId: `test-item-${itemIndex}-round-1`,
        });
      }

      // Validate rounds 1 and 2
      for (let roundIndex = 0; roundIndex < 2; roundIndex++) {
        const roundData = results.rounds[roundIndex];
        if (!roundData) continue;
        
        const roundResult = roundData[itemIndex]?.result;
        if (roundResult === "NA") continue;

        if (!roundData[itemIndex]?.h1?.trim()) {
          errors.push({
            section: t.sectionElectrical,
            sectionIcon: "⚡",
            itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
            message: t.missingTestValue,
            scrollId: `test-item-${itemIndex}-round-${roundIndex + 1}`,
          });
        }

        if (!isValidResult(roundResult)) {
          errors.push({
            section: t.sectionElectrical,
            sectionIcon: "⚡",
            itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
            message: t.missingResult,
            scrollId: `test-item-${itemIndex}-round-${roundIndex + 1}`,
          });
        }
      }

      // Validate round 3 only if this item failed and round 3 exists
      if (hasRound3 && failedItemIndexes.includes(itemIndex)) {
        const roundData = results.rounds[2];
        if (roundData) {
          if (!roundData[itemIndex]?.h1?.trim()) {
            errors.push({
              section: t.sectionElectrical,
              sectionIcon: "⚡",
              itemName: `${displayName} (${t.round} 3)`,
              message: t.missingTestValue,
              scrollId: `test-item-${itemIndex}-round-3`,
            });
          }

          const roundResult = roundData[itemIndex]?.result;
          if (!isValidResult(roundResult)) {
            errors.push({
              section: t.sectionElectrical,
              sectionIcon: "⚡",
              itemName: `${displayName} (${t.round} 3)`,
              message: t.missingResult,
              scrollId: `test-item-${itemIndex}-round-3`,
            });
          }
        }
      }
      return;
    }

    // PE Continuity Items - Validate rounds 1 and 2
    for (let roundIndex = 0; roundIndex < 2; roundIndex++) {
      const roundData = results.rounds[roundIndex];
      if (!roundData) continue;

      if (!roundData[itemIndex]?.h1?.trim()) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
          message: t.missingTestValue,
          scrollId: `test-item-${itemIndex}-round-${roundIndex + 1}`,
        });
      }

      const result = roundData[itemIndex]?.result;
      if (!isValidResult(result)) {
        errors.push({
          section: t.sectionElectrical,
          sectionIcon: "⚡",
          itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
          message: t.missingResult,
          scrollId: `test-item-${itemIndex}-round-${roundIndex + 1}`,
        });
      }
    }

    // Validate round 3 only if this item failed and round 3 exists
    if (hasRound3 && failedItemIndexes.includes(itemIndex)) {
      const roundData = results.rounds[2];
      if (roundData) {
        if (!roundData[itemIndex]?.h1?.trim()) {
          errors.push({
            section: t.sectionElectrical,
            sectionIcon: "⚡",
            itemName: `${displayName} (${t.round} 3)`,
            message: t.missingTestValue,
            scrollId: `test-item-${itemIndex}-round-3`,
          });
        }

        const result = roundData[itemIndex]?.result;
        if (!isValidResult(result)) {
          errors.push({
            section: t.sectionElectrical,
            sectionIcon: "⚡",
            itemName: `${displayName} (${t.round} 3)`,
            message: t.missingResult,
            scrollId: `test-item-${itemIndex}-round-3`,
          });
        }
      }
    }
  });

  return errors;
}

function validateTest2(
  results: TestCharger | null,
  lang: Lang
): ValidationError[] {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  // ถ้า results === null ให้ validate ว่าขาดอะไรบ้าง แทนที่จะ return error ทันที
  if (!results) {
    // Validate ทุก item ว่าต้องกรอก H1, H2, และไฟล์
    DC_TEST2_ITEMS.forEach((item, itemIndex) => {
      const displayName = lang === "th" ? item.testNameTh : item.testName;
      
      // Round 1 ต้องกรอก H1 และ H2
      errors.push({
        section: t.sectionCharger,
        sectionIcon: "🔌",
        itemName: `${displayName} (${t.round} 1)`,
        message: t.missingH1,
        scrollId: `test2-item-${itemIndex}-round-1`,
      });
      
      errors.push({
        section: t.sectionCharger,
        sectionIcon: "🔌",
        itemName: `${displayName} (${t.round} 1)`,
        message: t.missingH2,
        scrollId: `test2-item-${itemIndex}-round-1`,
      });
    });
    return errors;
  }

  // Get failed items for round 3 validation
  const failedItems = getTest2FailedItems(results);
  const hasRound3 = results.rounds.length >= 3;

  // Helper to check if file exists
  const hasFile = (itemIndex: number, roundIndex: number, field: "h1" | "h2"): boolean => {
    return !!(results.files?.[itemIndex]?.[roundIndex]?.[field]);
  };

  DC_TEST2_ITEMS.forEach((item, itemIndex) => {
    const displayName = lang === "th" ? item.testNameTh : item.testName;

    // Validate rounds 1 and 2
    for (let roundIndex = 0; roundIndex < 2; roundIndex++) {
      const roundData = results.rounds[roundIndex];
      if (!roundData) continue;

      const h1 = roundData[itemIndex]?.h1;
      const h2 = roundData[itemIndex]?.h2;

      if (!isValidResult(h1)) {
        errors.push({
          section: t.sectionCharger,
          sectionIcon: "🔌",
          itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
          message: t.missingH1,
          scrollId: `test2-item-${itemIndex}-round-${roundIndex + 1}`,
        });
      }

      if (!isValidResult(h2)) {
        errors.push({
          section: t.sectionCharger,
          sectionIcon: "🔌",
          itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
          message: t.missingH2,
          scrollId: `test2-item-${itemIndex}-round-${roundIndex + 1}`,
        });
      }

      // Validate files for H1 (skip if NA)
      if (!isNaResult(h1) && !hasFile(itemIndex, roundIndex, "h1")) {
        errors.push({
          section: t.sectionCharger,
          sectionIcon: "🔌",
          itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
          message: t.missingFileH1,
          scrollId: `test2-item-${itemIndex}-round-${roundIndex + 1}`,
        });
      }

      // Validate files for H2 (skip if NA)
      if (!isNaResult(h2) && !hasFile(itemIndex, roundIndex, "h2")) {
        errors.push({
          section: t.sectionCharger,
          sectionIcon: "🔌",
          itemName: `${displayName} (${t.round} ${roundIndex + 1})`,
          message: t.missingFileH2,
          scrollId: `test2-item-${itemIndex}-round-${roundIndex + 1}`,
        });
      }
    }

    // Validate round 3 only if this item has failed H1/H2
    if (hasRound3) {
      const failedItem = failedItems.find(fi => fi.itemIndex === itemIndex);
      
      if (failedItem) {
        const roundData = results.rounds[2];
        if (roundData) {
          // Only validate H1 if H1 failed in previous rounds
          if (failedItem.h1Failed) {
            const h1 = roundData[itemIndex]?.h1;
            if (!isValidResult(h1)) {
              errors.push({
                section: t.sectionCharger,
                sectionIcon: "🔌",
                itemName: `${displayName} (${t.round} 3)`,
                message: t.missingH1,
                scrollId: `test2-item-${itemIndex}-round-3`,
              });
            }

            // Validate file for H1 in round 3 (skip if NA)
            if (!isNaResult(h1) && !hasFile(itemIndex, 2, "h1")) {
              errors.push({
                section: t.sectionCharger,
                sectionIcon: "🔌",
                itemName: `${displayName} (${t.round} 3)`,
                message: t.missingFileH1,
                scrollId: `test2-item-${itemIndex}-round-3`,
              });
            }
          }

          // Only validate H2 if H2 failed in previous rounds
          if (failedItem.h2Failed) {
            const h2 = roundData[itemIndex]?.h2;
            if (!isValidResult(h2)) {
              errors.push({
                section: t.sectionCharger,
                sectionIcon: "🔌",
                itemName: `${displayName} (${t.round} 3)`,
                message: t.missingH2,
                scrollId: `test2-item-${itemIndex}-round-3`,
              });
            }

            // Validate file for H2 in round 3 (skip if NA)
            if (!isNaResult(h2) && !hasFile(itemIndex, 2, "h2")) {
              errors.push({
                section: t.sectionCharger,
                sectionIcon: "🔌",
                itemName: `${displayName} (${t.round} 3)`,
                message: t.missingFileH2,
                scrollId: `test2-item-${itemIndex}-round-3`,
              });
            }
          }
        }
      }
    }
  });

  return errors;
}

function validatePhotos(
  items: PhotoItem[],
  lang: Lang
): ValidationError[] {
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
        scrollId: `photo-category-${index}`,
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
interface DCMasterValidationProps {
  head: Head;
  phaseSequence: string;
  equipment: EquipmentBlock;
  dcTest1Results: TestResults | null;
  dcChargerTest: TestCharger | null;
  photoItems: PhotoItem[];
  lang?: Lang;
}

// ===== Component =====
const DCMasterValidation: React.FC<DCMasterValidationProps> = ({
  head,
  phaseSequence,
  equipment,
  dcTest1Results,
  dcChargerTest,
  photoItems,
  lang = "th",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = translations[lang];

  // Collect all errors
  const allErrors: ValidationError[] = [
    ...validateMeta(head, phaseSequence, lang),
    ...validateEquipment(equipment, lang),
    ...validateTest1(dcTest1Results, lang),
    ...validateTest2(dcChargerTest, lang),
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
                  <Typography className="tw-font-semibold tw-text-gray-800 tw-text-sm">
                    {sectionKey}
                  </Typography>
                  <span className="tw-text-xs tw-bg-amber-100 tw-text-amber-700 tw-px-2 tw-py-0.5 tw-rounded-full">
                    {sectionErrors.length} {lang === "th" ? "รายการ" : "items"}
                  </span>
                </div>
                <ul className="tw-space-y-1 tw-max-h-40 tw-overflow-y-auto">
                  {sectionErrors.map((error, idx) => (
                    <li
                      key={idx}
                      title={t.clickToScroll}
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

export default DCMasterValidation;

// ★ Export function สำหรับเช็คว่ากรอกครบหรือยัง (ใช้ใน checkList.tsx)
export function isFormComplete(
  head: Head,
  phaseSequence: string,
  equipment: EquipmentBlock,
  dcTest1Results: TestResults | null,
  dcChargerTest: TestCharger | null,
  photoItems: PhotoItem[],
): boolean {
  const allErrors = [
    ...validateMeta(head, phaseSequence, "th"),
    ...validateEquipment(equipment, "th"),
    ...validateTest1(dcTest1Results, "th"),
    ...validateTest2(dcChargerTest, "th"),
    ...validatePhotos(photoItems, "th"),
  ];
  return allErrors.length === 0;
}