"use client";

import React, { useState, useEffect } from "react";
import { Input, Typography, Tooltip } from "@material-tailwind/react";

// ===== Types =====
type Lang = "th" | "en";

// ===== Translations =====
const translations = {
  th: {
    title: "รายละเอียดอุปกรณ์",
    add: "+ เพิ่ม",
    remove: "ลบรายการนี้",
    manufacturer: "ผู้ผลิต",
    model: "รุ่น",
    serialNumber: "หมายเลขเครื่อง",
    maxReached: "เพิ่มได้สูงสุด 5 รายการ",
    setNumber: "ชุดที่",
    formStatus: "สถานะการกรอกข้อมูล",
    allComplete: "กรอกข้อมูลครบถ้วนแล้ว ✓",
    remaining: "ยังขาดอีก {n} รายการ",
    missingManufacturer: "ยังไม่ได้กรอกผู้ผลิต",
    missingModel: "ยังไม่ได้กรอกรุ่น",
    missingSerial: "ยังไม่ได้กรอกหมายเลขเครื่อง",
    // Tooltips
    titleTooltip: "กรอกข้อมูลอุปกรณ์ทดสอบที่ใช้ในการตรวจสอบ",
    manufacturerTooltip: "ชื่อผู้ผลิตอุปกรณ์ทดสอบ",
    modelTooltip: "รุ่นของอุปกรณ์ทดสอบ",
    serialTooltip: "หมายเลขเครื่องของอุปกรณ์ทดสอบ",
    addTooltip: "เพิ่มอุปกรณ์ทดสอบใหม่",
    removeTooltip: "ลบอุปกรณ์ทดสอบนี้",
    clickToScroll: "คลิกเพื่อไปยังช่องที่ต้องกรอก",
  },
  en: {
    title: "Equipment Identification Details",
    add: "+ Add",
    remove: "Remove this item",
    manufacturer: "Manufacturer",
    model: "Model",
    serialNumber: "Serial Number",
    maxReached: "Maximum 5 items allowed",
    setNumber: "Set",
    formStatus: "Form Completion Status",
    allComplete: "All fields completed ✓",
    remaining: "{n} items remaining",
    missingManufacturer: "Manufacturer is missing",
    missingModel: "Model is missing",
    missingSerial: "Serial Number is missing",
    // Tooltips
    titleTooltip: "Enter testing equipment details used for inspection",
    manufacturerTooltip: "Testing equipment manufacturer name",
    modelTooltip: "Testing equipment model",
    serialTooltip: "Testing equipment serial number",
    addTooltip: "Add new testing equipment",
    removeTooltip: "Remove this testing equipment",
    clickToScroll: "Click to go to the field",
  },
};

const MAX_ITEMS = 5;

/* ===================== Helper: Validation Checker ===================== */

export interface ValidationError {
  setIndex: number;
  setName: string;
  field: string;
  message: string;
}

export const validateEquipment = (
  equipmentList: string[],
  reporterList: string[],
  serialNumbers: string[],
  lang: Lang = "th"
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  equipmentList.forEach((_, index) => {
    const setName = `${t.setNumber} ${index + 1}`;

    // Check Manufacturer
    if (!equipmentList[index]?.trim()) {
      errors.push({
        setIndex: index,
        setName,
        field: t.manufacturer,
        message: t.missingManufacturer,
      });
    }

    // Check Model
    if (!reporterList[index]?.trim()) {
      errors.push({
        setIndex: index,
        setName,
        field: t.model,
        message: t.missingModel,
      });
    }

    // Check Serial Number
    if (!serialNumbers[index]?.trim()) {
      errors.push({
        setIndex: index,
        setName,
        field: t.serialNumber,
        message: t.missingSerial,
      });
    }
  });

  return errors;
};

// Group errors by set name for display
export const groupErrorsBySet = (errors: ValidationError[]): Map<string, ValidationError[]> => {
  const grouped = new Map<string, ValidationError[]>();
  errors.forEach((error) => {
    const existing = grouped.get(error.setName) || [];
    existing.push(error);
    grouped.set(error.setName, existing);
  });
  return grouped;
};

/* ===================== UI: Validation Summary Component ===================== */

interface ValidationSummaryProps {
  equipmentList: string[];
  reporterList: string[];
  serialNumbers: string[];
  lang: Lang;
}

const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  equipmentList,
  reporterList,
  serialNumbers,
  lang,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const errors = validateEquipment(equipmentList, reporterList, serialNumbers, lang);
  const groupedErrors = groupErrorsBySet(errors);
  const t = translations[lang];

  // Scroll to item and highlight
  const scrollToItem = (error: ValidationError) => {
    const elementId = `ac-equipment-set-${error.setIndex}`;
    const element = document.getElementById(elementId);

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Add highlight effect
      element.classList.add("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50");
      setTimeout(() => {
        element.classList.remove("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50");
      }, 2000);
    }
  };

  // Total fields = 3 fields per equipment set
  const totalFields = equipmentList.length * 3;
  const completedFields = totalFields - errors.length;
  const completionPercentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  const isComplete = errors.length === 0;

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
            <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-green-500 tw-flex tw-items-center tw-justify-center">
              <svg className="tw-w-5 tw-h-5 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-amber-500 tw-flex tw-items-center tw-justify-center">
              <svg className="tw-w-5 tw-h-5 tw-text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <Typography className={`tw-font-semibold ${isComplete ? "tw-text-green-800" : "tw-text-amber-800"}`}>
              {t.formStatus}
            </Typography>
            <Typography variant="small" className={isComplete ? "tw-text-green-600" : "tw-text-amber-600"}>
              {isComplete ? t.allComplete : t.remaining.replace("{n}", String(errors.length))}
            </Typography>
          </div>
        </div>

        <div className="tw-flex tw-items-center tw-gap-4">
          {/* Progress */}
          <div className="tw-hidden sm:tw-flex tw-items-center tw-gap-2">
            <div className="tw-w-32 tw-h-2 tw-bg-gray-200 tw-rounded-full tw-overflow-hidden">
              <div
                className={`tw-h-full tw-transition-all tw-duration-300 ${isComplete ? "tw-bg-green-500" : "tw-bg-amber-500"}`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <span className={`tw-text-sm tw-font-medium ${isComplete ? "tw-text-green-700" : "tw-text-amber-700"}`}>
              {completionPercentage}%
            </span>
          </div>

          {/* Expand/Collapse */}
          {!isComplete && (
            <svg
              className={`tw-w-5 tw-h-5 tw-text-amber-600 tw-transition-transform ${isExpanded ? "tw-rotate-180" : ""}`}
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
        <div className="tw-px-4 tw-py-3 tw-max-h-64 tw-overflow-y-auto">
          <div className="tw-space-y-3">
            {Array.from(groupedErrors.entries()).map(([setName, setErrors]) => (
              <div key={setName} className="tw-bg-white tw-rounded-lg tw-p-3 tw-border tw-border-amber-200">
                <Typography className="tw-font-medium tw-text-gray-800 tw-text-sm tw-mb-2">🔧 {setName}</Typography>
                <ul className="tw-space-y-1">
                  {setErrors.map((error, idx) => (
                    <li
                      key={idx}
                      title={t.clickToScroll}
                      className="tw-flex tw-items-start tw-gap-2 tw-text-sm tw-text-amber-700 tw-cursor-pointer hover:tw-text-amber-900 hover:tw-bg-amber-50 tw-rounded tw-px-1 tw-py-0.5 tw-transition-colors"
                      onClick={() => scrollToItem(error)}
                    >
                      <span className="tw-text-amber-500">→</span>
                      <span className="tw-underline tw-underline-offset-2">{error.message}</span>
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

/* ===================== Main Component ===================== */

interface EquipmentSectionProps {
  equipmentList: string[];
  reporterList: string[];
  serialNumbers: string[];
  onAdd: () => void;
  onUpdateEquipment: (index: number, value: string) => void;
  onUpdateReporter: (index: number, value: string) => void;
  onUpdateSerial: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}

export default function EquipmentSection({
  equipmentList,
  reporterList,
  serialNumbers,
  onAdd,
  onUpdateEquipment,
  onUpdateReporter,
  onUpdateSerial,
  onRemove,
}: EquipmentSectionProps) {
  // ===== Language State (sync with Navbar) =====
  const [lang, setLang] = useState<Lang>("th");

  useEffect(() => {
    // Load initial language from localStorage
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") {
      setLang(savedLang);
    }

    // Listen for language change event from Navbar
    const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => {
      setLang(e.detail.lang);
    };

    window.addEventListener("language:change", handleLangChange as EventListener);

    return () => {
      window.removeEventListener("language:change", handleLangChange as EventListener);
    };
  }, []);

  // Get translations for current language
  const t = translations[lang];

  // Check if max items reached
  const isMaxReached = equipmentList.length >= MAX_ITEMS;

  // Handle add with max limit
  const handleAdd = () => {
    if (!isMaxReached) {
      onAdd();
    }
  };

  return (
    <div className="tw-space-y-3">
      <div className="tw-flex tw-items-center tw-justify-between">
        <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-flex tw-items-center tw-gap-2">
          <span className="tw-text-lg tw-font-bold tw-underline tw-text-blue-gray-800">{t.title}</span>
          <Tooltip content={t.titleTooltip} placement="top">
            <svg className="tw-w-4 tw-h-4 tw-text-gray-400 tw-cursor-help" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </Tooltip>
        </span>
        <Tooltip content={isMaxReached ? t.maxReached : t.addTooltip} placement="top">
          <button
            type="button"
            onClick={handleAdd}
            disabled={isMaxReached}
            className={`tw-text-sm tw-rounded-md tw-border tw-px-3 tw-py-1 tw-transition-colors ${
              isMaxReached
                ? "tw-border-gray-300 tw-bg-gray-100 tw-text-gray-400 tw-cursor-not-allowed"
                : "tw-border-gray-700 tw-bg-gray-800 tw-text-white hover:tw-bg-gray-700"
            }`}
          >
            {t.add}
          </button>
        </Tooltip>
      </div>

      {equipmentList.map((val, i) => (
        <div
          id={`ac-equipment-set-${i}`}
          key={i}
          className="tw-relative tw-border tw-border-gray-200 tw-rounded-lg tw-p-4 md:tw-p-0 md:tw-border-0 tw-bg-gray-50 md:tw-bg-transparent tw-transition-all tw-duration-300"
        >
          {/* Mobile: Set number badge + Remove button */}
          <div className="tw-flex tw-items-center tw-justify-between tw-mb-3 md:tw-hidden">
            <span className="tw-text-xs tw-font-semibold tw-text-gray-500 tw-bg-white tw-px-2 tw-py-1 tw-rounded-full tw-border tw-border-gray-200">
              {t.setNumber} {i + 1}
            </span>
            {equipmentList.length > 1 && (
              <Tooltip content={t.removeTooltip} placement="top">
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="tw-h-8 tw-w-8 tw-flex tw-items-center tw-justify-center tw-rounded-full tw-border tw-border-red-200 tw-text-red-600 tw-bg-white hover:tw-bg-red-50 hover:tw-border-red-300 tw-transition-colors tw-font-bold tw-text-base"
                  aria-label={t.remove}
                >
                  ×
                </button>
              </Tooltip>
            )}
          </div>

          {/* Form fields */}
          <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4 tw-items-end">
            {/* Manufacturer */}
            <div>
              <label className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                {t.manufacturer} :
                <Tooltip content={t.manufacturerTooltip} placement="top">
                  <svg className="tw-w-3.5 tw-h-3.5 tw-text-gray-400 tw-cursor-help" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </Tooltip>
              </label>
              <Input
                value={val}
                onChange={(e) => onUpdateEquipment(i, e.target.value)}
                crossOrigin=""
                className="tw-w-full !tw-bg-white"
              />
            </div>

            {/* Model */}
            <div>
              <label className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                {t.model} :
                <Tooltip content={t.modelTooltip} placement="top">
                  <svg className="tw-w-3.5 tw-h-3.5 tw-text-gray-400 tw-cursor-help" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </Tooltip>
              </label>
              <Input
                value={reporterList[i] || ""}
                onChange={(e) => onUpdateReporter(i, e.target.value)}
                crossOrigin=""
                className="tw-w-full !tw-bg-white"
              />
            </div>

            {/* Serial Number + ปุ่มลบ (Desktop) */}
            <div>
              <label className="tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-blue-gray-500 tw-mb-1">
                {t.serialNumber} :
                <Tooltip content={t.serialTooltip} placement="top">
                  <svg className="tw-w-3.5 tw-h-3.5 tw-text-gray-400 tw-cursor-help" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </Tooltip>
              </label>
              <div className="tw-flex tw-gap-2">
                <Input
                  value={serialNumbers[i] || ""}
                  onChange={(e) => onUpdateSerial(i, e.target.value)}
                  crossOrigin=""
                  className="tw-flex-1 !tw-bg-white"
                />
                {/* Desktop: ปุ่มลบ X */}
                {equipmentList.length > 1 && (
                  <Tooltip content={t.removeTooltip} placement="top">
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      className="tw-hidden md:tw-flex tw-h-10 tw-w-10 tw-items-center tw-justify-center tw-rounded-md tw-border tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50 hover:tw-border-red-300 tw-transition-colors tw-font-bold tw-text-lg"
                      aria-label={t.remove}
                    >
                      ×
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}