"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Textarea, Typography, Tooltip } from "@material-tailwind/react";

/* ===================== Types ===================== */

type Lang = "th" | "en";

interface PhotoItem {
  text: string;
  images: { file: File; url: string }[];
}

interface DCPhotoSectionProps {
  initialItems?: PhotoItem[];
  onItemsChange?: (items: PhotoItem[]) => void;
  title?: string;
}

/* ===================== Translations ===================== */

const translations = {
  th: {
    addPhoto: "เพิ่มรูป / ถ่ายรูป",
    clickToSelect: "คลิกเพื่อเลือกไฟล์หรือถ่ายรูปใหม่",
    delete: "ลบ",
    deleteThis: "ลบรูปนี้",
    itemNumber: "รายการที่",
    mustHaveOne: "ต้องมีอย่างน้อย 1 ข้อ",
    deleteItem: "ลบรายการนี้",
    formStatus: "สถานะการกรอกข้อมูล",
    allComplete: "กรอกข้อมูลครบถ้วนแล้ว ✓",
    remaining: "ยังขาดอีก {n} รายการ",
    missingPhoto: "ยังไม่ได้เพิ่มรูปภาพ",
    // Tooltips
    clickToChangePhoto: "คลิกเพื่อเปลี่ยนรูปภาพ",
    clickToUploadPhoto: "คลิกเพื่ออัปโหลดรูปภาพ",
    deletePhotoTooltip: "ลบรูปภาพนี้",
    photoRequired: "จำเป็นต้องใส่รูปภาพ",
    clickToViewFull: "คลิกเพื่อดูรูปเต็ม",
    clickToScroll: "คลิกเพื่อไปยังช่องที่ต้องกรอก",
    categoryTooltip: "อัปโหลดรูปภาพสำหรับหมวดหมู่นี้",
  },
  en: {
    addPhoto: "Add Photo / Take Photo",
    clickToSelect: "Click to select file or take a new photo",
    delete: "Delete",
    deleteThis: "Delete this photo",
    itemNumber: "Item",
    mustHaveOne: "At least 1 item required",
    deleteItem: "Delete this item",
    formStatus: "Form Completion Status",
    allComplete: "All fields completed ✓",
    remaining: "{n} items remaining",
    missingPhoto: "Photo not added",
    // Tooltips
    clickToChangePhoto: "Click to change photo",
    clickToUploadPhoto: "Click to upload photo",
    deletePhotoTooltip: "Delete this photo",
    photoRequired: "Photo is required",
    clickToViewFull: "Click to view full image",
    clickToScroll: "Click to go to the field",
    categoryTooltip: "Upload photo for this category",
  },
};

/* ===================== Photo Categories ===================== */

const photoCategories = [
  { key: "nameplate", en: "Nameplate", th: "Nameplate", tooltip: { th: "ถ่ายรูป Nameplate ของเครื่องชาร์จ", en: "Take photo of charger nameplate" } },
  { key: "charger", en: "Charger", th: "เครื่องอัดประจุไฟฟ้า", tooltip: { th: "ถ่ายรูปเครื่องอัดประจุไฟฟ้าทั้งตัว", en: "Take photo of the entire charger" } },
  { key: "testingEquipment", en: "Testing Equipment", th: "เครื่องมือทดสอบ", tooltip: { th: "ถ่ายรูปเครื่องมือทดสอบที่ใช้", en: "Take photo of testing equipment used" } },
  { key: "testingEquipmentNameplate", en: "Testing Equipment Nameplate", th: "Nameplate ของเครื่องมือทดสอบ", tooltip: { th: "ถ่ายรูป Nameplate ของเครื่องมือทดสอบ", en: "Take photo of testing equipment nameplate" } },
  { key: "gun1", en: "GUN 1", th: "หัวชาร์จที่ 1", tooltip: { th: "ถ่ายรูปหัวชาร์จที่ 1", en: "Take photo of charging gun 1" } },
  { key: "gun2", en: "GUN 2", th: "หัวชาร์จที่ 2", tooltip: { th: "ถ่ายรูปหัวชาร์จที่ 2", en: "Take photo of charging gun 2" } },
];

/* ===================== Helper: Validation Checker ===================== */

export interface ValidationError {
  categoryIndex: number;
  categoryName: string;
  field: string;
  message: string;
}

export const validatePhotoItems = (
  items: PhotoItem[],
  lang: Lang = "th"
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const t = translations[lang];

  // Check each photo category (first 6 items)
  photoCategories.forEach((category, index) => {
    const item = items[index];
    const categoryName = lang === "th" ? category.th : category.en;

    // Check if photo exists
    if (!item?.images || item.images.length === 0) {
      errors.push({
        categoryIndex: index,
        categoryName,
        field: lang === "th" ? "รูปภาพ" : "Photo",
        message: t.missingPhoto,
      });
    }
  });

  return errors;
};

// Group errors by category name for display
export const groupErrorsByCategory = (errors: ValidationError[]): Map<string, ValidationError[]> => {
  const grouped = new Map<string, ValidationError[]>();
  errors.forEach((error) => {
    const existing = grouped.get(error.categoryName) || [];
    existing.push(error);
    grouped.set(error.categoryName, existing);
  });
  return grouped;
};

/* ===================== UI: Validation Summary Component ===================== */

interface ValidationSummaryProps {
  items: PhotoItem[];
  lang: Lang;
}

const ValidationSummary: React.FC<ValidationSummaryProps> = ({ items, lang }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const errors = validatePhotoItems(items, lang);
  const groupedErrors = groupErrorsByCategory(errors);
  const t = translations[lang];

  // Scroll to item and highlight
  const scrollToItem = (error: ValidationError) => {
    const elementId = `photo-category-${error.categoryIndex}`;
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

  const totalFields = photoCategories.length; // 6 photo categories
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
            {Array.from(groupedErrors.entries()).map(([categoryName, categoryErrors]) => (
              <div key={categoryName} className="tw-bg-white tw-rounded-lg tw-p-3 tw-border tw-border-amber-200">
                <Typography className="tw-font-medium tw-text-gray-800 tw-text-sm tw-mb-2">📷 {categoryName}</Typography>
                <ul className="tw-space-y-1">
                  {categoryErrors.map((error, idx) => (
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

const DCPhotoSection: React.FC<DCPhotoSectionProps> = ({ initialItems, onItemsChange, title = "" }) => {
  // Language state
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

  // Initialize with 6 items for photo categories + any additional items
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>(() => {
    const defaultItems: PhotoItem[] = Array(6)
      .fill(null)
      .map(() => ({ text: "", images: [] }));
    if (initialItems && initialItems.length > 0) {
      // Merge initial items, ensuring we have at least 6 categories
      for (let i = 0; i < initialItems.length; i++) {
        if (i < 6) {
          defaultItems[i] = initialItems[i];
        } else {
          defaultItems.push(initialItems[i]);
        }
      }
    }
    return defaultItems;
  });

  // ★★★ CRITICAL: Sync initialItems when draft loads ★★★
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      const defaultItems: PhotoItem[] = Array(6)
        .fill(null)
        .map(() => ({ text: "", images: [] }));
      for (let i = 0; i < initialItems.length; i++) {
        if (i < 6) {
          defaultItems[i] = initialItems[i];
        } else {
          defaultItems.push(initialItems[i]);
        }
      }
      setPhotoItems(defaultItems);
    }
  }, [initialItems]);

  const updateItems = (newItems: PhotoItem[]) => {
    setPhotoItems(newItems);
    onItemsChange?.(newItems);
  };

  const patchItem = (i: number, patch: Partial<PhotoItem>) => {
    const newItems = [...photoItems];
    newItems[i] = { ...newItems[i], ...patch };
    updateItems(newItems);
  };

  const addItem = () => {
    const newItems = [...photoItems, { text: "", images: [] }];
    updateItems(newItems);
  };

  const removeItem = (i: number) => {
    if (photoItems.length <= 1) return;
    const newItems = [...photoItems];
    newItems.splice(i, 1);
    updateItems(newItems);
  };

  const addItemImages = (i: number, files: FileList | null) => {
    if (!files?.length) return;
    const imgs = Array.from(files).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    // Ensure we have enough items in the array
    const newItems = [...photoItems];
    while (newItems.length <= i) {
      newItems.push({ text: "", images: [] });
    }

    const current = newItems[i] || { text: "", images: [] };
    newItems[i] = { ...current, images: [...current.images, ...imgs] };
    updateItems(newItems);
  };

  const removeItemImage = (i: number, j: number) => {
    const imgs = [...photoItems[i].images];
    const url = imgs[j]?.url;
    if (url) URL.revokeObjectURL(url);
    imgs.splice(j, 1);
    patchItem(i, { images: imgs });
  };

  return (
    <div className="tw-space-y-6">
      <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">{title}</div>

      {/* Photo Categories Grid */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
        {photoCategories.map((category, categoryIndex) => {
          const categoryName = lang === "th" ? category.th : category.en;
          const categoryTooltip = category.tooltip[lang];
          return (
            <div
              id={`photo-category-${categoryIndex}`}
              key={category.key}
              className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4 tw-transition-all tw-duration-300"
            >
              <div className="tw-text-center tw-font-medium tw-text-blue-gray-800 tw-text-sm tw-flex tw-items-center tw-justify-center tw-gap-1">
                {categoryName}
                <Tooltip content={categoryTooltip} placement="top">
                  <svg className="tw-w-4 tw-h-4 tw-text-gray-400 tw-cursor-help" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </Tooltip>
              </div>

              {/* Photo Upload Area - กรอบสีเหลี่ยมเส้นประ */}
              <div 
                className="tw-border-2 tw-border-dashed tw-border-blue-gray-300 tw-rounded-lg tw-p-6 tw-min-h-[200px] tw-flex tw-items-center tw-justify-center tw-relative"
                title={photoItems[categoryIndex]?.images?.length > 0 ? t.clickToChangePhoto : t.clickToUploadPhoto}
              >
                {photoItems[categoryIndex]?.images && photoItems[categoryIndex].images.length > 0 ? (
                  <label 
                    className="tw-w-full tw-h-full tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-relative"
                    title={t.clickToChangePhoto}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="tw-hidden"
                      onChange={(e) => {
                        // เปลี่ยนรูปใหม่ (แทนรูปเดิม)
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          const url = URL.createObjectURL(file);
                          const imgs = [{ file, url }];
                          patchItem(categoryIndex, { images: imgs });
                        }
                      }}
                    />
                    <div className="tw-relative tw-w-full tw-h-[180px] tw-flex tw-items-center tw-justify-center">
                      <Image
                        src={photoItems[categoryIndex].images[0].url}
                        alt={`${categoryName}-selected`}
                        fill
                        className="tw-object-contain tw-rounded-md"
                      />
                      <Tooltip content={t.deletePhotoTooltip} placement="top">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            removeItemImage(categoryIndex, 0);
                          }}
                          className="tw-absolute tw-top-2 tw-right-2 tw-bg-red-500 tw-text-white tw-text-xs tw-rounded-full tw-w-7 tw-h-7 tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-transition-colors tw-shadow-md"
                        >
                          ×
                        </button>
                      </Tooltip>
                    </div>
                  </label>
                ) : (
                  <label 
                    className="tw-inline-flex tw-flex-col tw-items-center tw-gap-3 tw-cursor-pointer hover:tw-bg-blue-gray-50 tw-rounded-md tw-p-4 tw-transition-colors tw-mx-auto"
                    title={t.clickToUploadPhoto}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="tw-hidden"
                      onChange={(e) => addItemImages(categoryIndex, e.target.files)}
                    />
                    <div className="tw-w-12 tw-h-12 tw-rounded-full tw-bg-blue-50 tw-flex tw-items-center tw-justify-center">
                      <svg className="tw-w-6 tw-h-6 tw-text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div className="tw-text-center">
                      <span className="tw-text-sm tw-font-medium tw-text-blue-gray-700">{t.addPhoto}</span>
                      <p className="tw-text-xs tw-text-blue-gray-500 tw-mt-1">{t.clickToSelect}</p>
                    </div>
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional Items Section */}
      <div className="tw-border-t tw-border-blue-gray-200 tw-pt-6">
        <div className="tw-space-y-4">
          {photoItems.slice(6).map((item, i) => {
            const actualIndex = i + 6;
            const canDelete = photoItems.length > 6;
            return (
              <div key={actualIndex} className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-3 tw-space-y-3">
                <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
                  <Textarea
                    label={`${t.itemNumber} ${actualIndex - 5}`}
                    rows={3}
                    value={item.text}
                    onChange={(e) => patchItem(actualIndex, { text: e.target.value })}
                    className="!tw-w-full"
                    containerProps={{ className: "!tw-min-w-0 tw-flex-1" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(actualIndex)}
                    disabled={!canDelete}
                    className={`tw-shrink-0 tw-ml-2 tw-h-9 tw-rounded-md tw-border tw-px-3 ${
                      !canDelete
                        ? "tw-border-blue-gray-100 tw-text-blue-gray-300 tw-cursor-not-allowed"
                        : "tw-border-red-200 tw-text-red-600 hover:tw-bg-red-50"
                    }`}
                    title={!canDelete ? t.mustHaveOne : t.deleteItem}
                    aria-disabled={!canDelete}
                  >
                    {t.delete}
                  </button>
                </div>

                <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
                  <label className="tw-inline-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-2 hover:tw-bg-blue-gray-50">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      className="tw-hidden"
                      onChange={(e) => addItemImages(actualIndex, e.target.files)}
                    />
                    <span className="tw-text-sm">+ {t.addPhoto}</span>
                  </label>

                  {item.images.length > 0 && (
                    <div className="tw-w-full tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                      {item.images.map((img, j) => (
                        <div
                          key={j}
                          className="tw-relative tw-aspect-video tw-rounded-md tw-overflow-hidden tw-border tw-border-blue-gray-100"
                        >
                          <Image src={img.url} alt={`extra-${actualIndex}-img-${j}`} fill className="tw-object-cover" />
                          <button
                            type="button"
                            onClick={() => removeItemImage(actualIndex, j)}
                            className="tw-absolute tw-top-1 tw-right-1 tw-bg-white/80 tw-backdrop-blur tw-text-red-600 tw-text-xs tw-rounded tw-px-2 tw-py-1 hover:tw-bg-white"
                          >
                            {t.delete}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DCPhotoSection;