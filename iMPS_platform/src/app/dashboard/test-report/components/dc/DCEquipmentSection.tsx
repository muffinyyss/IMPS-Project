"use client";

import React from "react";
import { Input } from "@material-tailwind/react";

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
  return (
    <div className="tw-space-y-3">
      <div className="tw-flex tw-items-center tw-justify-between">
        <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">
          <span className="tw-text-lg tw-font-bold tw-underline tw-text-blue-gray-800">Equipment Identification Details</span>
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="tw-text-sm tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-1 hover:tw-bg-blue-gray-50"
        >
          + เพิ่ม
        </button>
      </div>

      {equipmentList.map((val, i) => (
        <div
          key={i}
          className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4 tw-items-end"
        >
          {/* Manufacturer */}
          <div>
            <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
              Manufacturer :
            </label>
            <Input
              value={val}
              onChange={(e) => onUpdateEquipment(i, e.target.value)}
              crossOrigin=""
              className="tw-w-full"
            />
          </div>

          {/* Model */}
          <div>
            <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
              Model :
            </label>
            <Input
              value={reporterList[i] || ""}
              onChange={(e) => onUpdateReporter(i, e.target.value)}
              crossOrigin=""
              className="tw-w-full"
            />
          </div>

          {/* Serial Number + ปุ่มลบ */}
          <div>
            <label className="tw-block tw-text-xs tw-text-blue-gray-500 tw-mb-1">
              Serial Number :
            </label>
            <div className="tw-flex tw-gap-2">
              <Input
                value={serialNumbers[i] || ""}
                onChange={(e) => onUpdateSerial(i, e.target.value)}
                crossOrigin=""
                className="tw-flex-1"
              />
              {/* ปุ่มลบ */}
              {equipmentList.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="tw-h-10 tw-rounded-md tw-border tw-border-red-200 tw-text-red-600 tw-px-3 hover:tw-bg-red-50"
                  title="ลบรายการนี้"
                >
                  ลบ
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
