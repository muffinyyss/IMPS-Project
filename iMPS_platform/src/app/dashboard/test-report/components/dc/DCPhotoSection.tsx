"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Textarea } from "@material-tailwind/react";

interface PhotoItem {
  text: string;
  images: { file: File; url: string }[];
}

interface ACPhotoSectionProps {
  initialItems?: PhotoItem[];
  onItemsChange?: (items: PhotoItem[]) => void;
  title?: string;
}

const ACPhotoSection: React.FC<ACPhotoSectionProps> = ({
  initialItems,
  onItemsChange,
  title = ""
}) => {
  // Initialize with 6 items for photo categories + any additional items
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>(() => {
    const defaultItems: PhotoItem[] = Array(6).fill(null).map(() => ({ text: "", images: [] }));
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

  // Grid layout for photo categories (2x3 grid)
  const photoCategories = [
    "Nameplate",
    "Charger", 
    "Circuit Breaker",
    "RCD",
    "GUN 1",
    "GUN 2"
  ];

  

  return (
    <div className="tw-space-y-6">
      <div className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-3">
        {title}
      </div>
      
      {/* Photo Categories Grid */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
        {photoCategories.map((category, categoryIndex) => (
          <div key={category} className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-4 tw-space-y-4">
            <div className="tw-text-center tw-font-medium tw-text-blue-gray-800 tw-text-sm">
              {category}
            </div>
            
            {/* Photo Upload Area - กรอบสีเหลี่ยมเส้นประ */}
            <div className="tw-border-2 tw-border-dashed tw-border-blue-gray-300 tw-rounded-lg tw-p-6 tw-min-h-[200px] tw-flex tw-items-center tw-justify-center tw-relative">
              {photoItems[categoryIndex]?.images && photoItems[categoryIndex].images.length > 0 ? (
                <label className="tw-w-full tw-h-full tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-relative">
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
                      alt={`${category}-selected`}
                      fill
                      className="tw-object-contain tw-rounded-md"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        removeItemImage(categoryIndex, 0);
                      }}
                      className="tw-absolute tw-top-2 tw-right-2 tw-bg-red-500 tw-text-white tw-text-xs tw-rounded-full tw-w-7 tw-h-7 tw-flex tw-items-center tw-justify-center hover:tw-bg-red-600 tw-transition-colors tw-shadow-md"
                      title="ลบรูปนี้"
                    >
                      ×
                    </button>
                  </div>
                </label>
              ) : (
                <label className="tw-inline-flex tw-flex-col tw-items-center tw-gap-3 tw-cursor-pointer hover:tw-bg-blue-gray-50 tw-rounded-md tw-p-4 tw-transition-colors tw-mx-auto">
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
                    <span className="tw-text-sm tw-font-medium tw-text-blue-gray-700">เพิ่มรูป / ถ่ายรูป</span>
                    <p className="tw-text-xs tw-text-blue-gray-500 tw-mt-1">คลิกเพื่อเลือกไฟล์หรือถ่ายรูปใหม่</p>
                  </div>
                </label>
              )}
            </div>

          </div>
        ))}
      </div>

      {/* Additional Items Section */}
      <div className="tw-border-t tw-border-blue-gray-200 tw-pt-6">
        <div className="tw-space-y-4">
         

          {photoItems.slice(6).map((item, i) => {
            const actualIndex = i + 6;
            const canDelete = photoItems.length > 6;
            return (
              <div
                key={actualIndex}
                className="tw-border tw-border-blue-gray-100 tw-rounded-lg tw-p-3 tw-space-y-3"
              >
                <div className="tw-flex tw-items-start tw-justify-between tw-gap-3">
                  <Textarea
                    label={`รายการที่ ${actualIndex - 5}`}
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
                    title={!canDelete ? "ต้องมีอย่างน้อย 1 ข้อ" : "ลบรายการนี้"}
                    aria-disabled={!canDelete}
                  >
                    ลบ
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
                    <span className="tw-text-sm">+ เพิ่มรูป / ถ่ายรูป</span>
                  </label>

                  {item.images.length > 0 && (
                    <div className="tw-w-full tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 md:tw-grid-cols-4 tw-gap-3">
                      {item.images.map((img, j) => (
                        <div
                          key={j}
                          className="tw-relative tw-aspect-video tw-rounded-md tw-overflow-hidden tw-border tw-border-blue-gray-100"
                        >
                          <Image
                            src={img.url}
                            alt={`extra-${actualIndex}-img-${j}`}
                            fill
                            className="tw-object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeItemImage(actualIndex, j)}
                            className="tw-absolute tw-top-1 tw-right-1 tw-bg-white/80 tw-backdrop-blur tw-text-red-600 tw-text-xs tw-rounded tw-px-2 tw-py-1 hover:tw-bg-white"
                          >
                            ลบ
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

        {/* Single Remark at the bottom */}
        
    </div>
  );
};

export default ACPhotoSection;