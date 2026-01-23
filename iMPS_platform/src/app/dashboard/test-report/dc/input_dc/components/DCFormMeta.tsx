"use client";

import React, { useState, useEffect } from "react";
import { Input, Typography } from "@material-tailwind/react";

// ===== Types =====
type Lang = "th" | "en";

interface Head {
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

interface DCFormMetaProps {
  head: Head;
  onHeadChange: (updates: Partial<Head>) => void;
}

// ===== Translations =====
const translations = {
  th: {
    issueId: "รหัสเอกสาร",
    location: "สถานที่",
    manufacturer: "ผู้ผลิต",
    model: "รุ่น",
    power: "กำลังไฟ",
    firmwareVersion: "เวอร์ชันเฟิร์มแวร์",
    serialNumber: "หมายเลขเครื่อง",
    inspectionDate: "วันที่ตรวจสอบ",
    inspector: "ผู้ตรวจสอบ",
    formStatus: "สถานะการกรอกข้อมูล",
    allComplete: "กรอกข้อมูลครบถ้วนแล้ว ✓",
    remaining: "ยังขาดอีก {n} รายการ",
    missingFirmware: "ยังไม่ได้กรอกเวอร์ชันเฟิร์มแวร์",
    loading: "กำลังโหลด...",
    firmwarePlaceholder: "เช่น v1.0.0",
  },
  en: {
    issueId: "Issue ID",
    location: "Location",
    manufacturer: "Manufacturer",
    model: "Model",
    power: "Power",
    firmwareVersion: "Firmware Version",
    serialNumber: "Serial Number",
    inspectionDate: "Inspection Date",
    inspector: "Inspector",
    formStatus: "Form Completion Status",
    allComplete: "All fields completed ✓",
    remaining: "{n} items remaining",
    missingFirmware: "Firmware Version is missing",
    loading: "Loading...",
    firmwarePlaceholder: "e.g. v1.0.0",
  },
};

/* ===================== Helper: Check if firmware has real value ===================== */

function hasFirmwareValue(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  // ถ้าเป็น "-" หรือ "" ถือว่าไม่มีค่า
  return trimmed !== "" && trimmed !== "-";
}

/* ===================== Helper: Validation Checker ===================== */

export interface ValidationError {
  field: string;
  fieldKey: string;
  message: string;
}

export const validateFormMeta = (head: Head, lang: Lang = "th"): ValidationError[] => {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  // ★ ตรวจสอบว่ามีค่า firmware_version ที่ใช้ได้หรือไม่
  if (!hasFirmwareValue(head.firmware_version)) {
    errors.push({
      field: t.firmwareVersion,
      fieldKey: "firmware_version",
      message: t.missingFirmware,
    });
  }

  return errors;
};

/* ===================== UI: Validation Summary Component ===================== */

interface ValidationSummaryProps {
  head: Head;
  lang: Lang;
}

const ValidationSummary: React.FC<ValidationSummaryProps> = ({ head, lang }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const errors = validateFormMeta(head, lang);
  const t = translations[lang];

  const scrollToField = (fieldKey: string) => {
    const elementId = `form-meta-${fieldKey}`;
    const element = document.getElementById(elementId);

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50");
      setTimeout(() => {
        element.classList.remove("tw-ring-2", "tw-ring-amber-400", "tw-bg-amber-50");
      }, 2000);
    }
  };

  const totalFields = 1;
  const completedFields = totalFields - errors.length;
  const completionPercentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  const isComplete = errors.length === 0;

  return (
    <div
      className={`tw-rounded-xl tw-border tw-shadow-sm tw-overflow-hidden ${
        isComplete ? "tw-border-green-200 tw-bg-green-50" : "tw-border-amber-200 tw-bg-amber-50"
      }`}
    >
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

      {isExpanded && !isComplete && (
        <div className="tw-px-4 tw-py-3">
          <ul className="tw-space-y-2">
            {errors.map((error, idx) => (
              <li
                key={idx}
                className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-text-amber-700 tw-cursor-pointer hover:tw-text-amber-900 hover:tw-bg-amber-50 tw-rounded tw-px-2 tw-py-1 tw-transition-colors"
                onClick={() => scrollToField(error.fieldKey)}
              >
                <span className="tw-text-amber-500">→</span>
                <span className="tw-underline tw-underline-offset-2">{error.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/* ===================== Main Component ===================== */

export default function DCFormMeta({ head, onHeadChange }: DCFormMetaProps) {
  const [lang, setLang] = useState<Lang>("th");
  const [inspector, setInspector] = useState<string>("-");
  
  // ★★★ Track if firmware came from API (first load) ★★★
  const [firmwareFromApi, setFirmwareFromApi] = useState<boolean>(false);

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

  useEffect(() => {
    const username =
      localStorage.getItem("user_name") ||
      localStorage.getItem("username") ||
      localStorage.getItem("display_name") ||
      localStorage.getItem("current_user");

    if (username) {
      setInspector(username);
      if (!head.inspector) {
        onHeadChange({ inspector: username });
      }
    }

    const userJson = localStorage.getItem("user");
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        const name = user.name || user.username || user.display_name || user.email;
        if (name) {
          setInspector(name);
          if (!head.inspector) {
            onHeadChange({ inspector: name });
          }
        }
      } catch {
        // ignore
      }
    }
  }, [head.inspector, onHeadChange]);

  useEffect(() => {
    if (!head.inspection_date) {
      const today = new Date().toISOString().slice(0, 10);
      onHeadChange({ inspection_date: today });
    }
  }, [head.inspection_date, onHeadChange]);

  // ★★★ Check if firmware came from API on first meaningful value ★★★
  useEffect(() => {
    if (!firmwareFromApi && hasFirmwareValue(head.firmware_version)) {
      setFirmwareFromApi(true);
    }
  }, [head.firmware_version, firmwareFromApi]);

  const t = translations[lang];
  const displayInspector = head.inspector || inspector;

  // ★★★ ตรวจสอบว่ามี issue_id จาก backend หรือยัง ★★★
  const hasIssueId = Boolean(head.issue_id && head.issue_id.trim());
  const displayIssueId = hasIssueId ? head.issue_id : t.loading;

  return (
    <div className="tw-space-y-4">
      {/* First Row - Issue ID, Location, Inspector */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-4 tw-gap-4">
        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t.issueId}</label>
          <Input
            value={displayIssueId}
            readOnly
            crossOrigin=""
            containerProps={{ className: "!tw-min-w-0" }}
            className={`!tw-w-full !tw-bg-gray-100 ${!hasIssueId ? "!tw-text-gray-400 !tw-italic" : ""}`}
          />
        </div>

        <div className="md:tw-col-span-2">
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t.location}</label>
          <Input
            value={head.location || ""}
            readOnly
            crossOrigin=""
            className="!tw-w-full !tw-bg-gray-100"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>

        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t.inspector}</label>
          <Input
            value={displayInspector}
            readOnly
            crossOrigin=""
            className="!tw-w-full !tw-bg-gray-100"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>
      </div>

      {/* Second Row - Manufacturer, Model, Power */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4">
        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t.manufacturer}</label>
          <Input
            value={head.manufacturer || "-"}
            readOnly
            crossOrigin=""
            className="!tw-w-full !tw-bg-gray-100"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>

        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t.model}</label>
          <Input
            value={head.model || "-"}
            readOnly
            crossOrigin=""
            className="!tw-w-full !tw-bg-gray-100"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>

        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t.power}</label>
          <Input
            value={head.power || "-"}
            readOnly
            crossOrigin=""
            className="!tw-w-full !tw-bg-gray-100"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>
      </div>

      {/* Third Row - Firmware Version, Serial Number, Inspection Date */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4">
        <div id="form-meta-firmware_version" className="tw-transition-all tw-duration-300 tw-rounded">
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">
            {t.firmwareVersion} {!firmwareFromApi && <span className="tw-text-red-500">*</span>}
          </label>
          {/* ★★★ ถ้า firmware มาจาก API → readonly, ถ้าไม่มี → ให้กรอก ★★★ */}
          {firmwareFromApi ? (
            <Input
              value={head.firmware_version || ""}
              readOnly
              crossOrigin=""
              className="!tw-w-full !tw-bg-gray-100"
              containerProps={{ className: "!tw-min-w-0" }}
            />
          ) : (
            <Input
              value={head.firmware_version || ""}
              onChange={(e) => onHeadChange({ firmware_version: e.target.value })}
              crossOrigin=""
              className="!tw-w-full"
              containerProps={{ className: "!tw-min-w-0" }}
              placeholder={t.firmwarePlaceholder}
            />
          )}
        </div>

        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t.serialNumber}</label>
          <Input
            value={head.serial_number || "-"}
            readOnly
            crossOrigin=""
            className="!tw-w-full !tw-bg-gray-100"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>

        <div id="form-meta-inspection_date">
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">
            {t.inspectionDate}
          </label>
          <Input
            type="date"
            value={(head.inspection_date || "").slice(0, 10)}
            readOnly
            crossOrigin=""
            className="!tw-w-full !tw-bg-gray-100"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>
      </div>
    </div>
  );
}