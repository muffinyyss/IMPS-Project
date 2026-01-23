"use client";

import React from "react";
import { Button } from "@material-tailwind/react";

interface ACFormActionsProps {
  onSave: () => void;
  onSubmit: () => void;
  onReset: () => void;
  isSaving?: boolean;
  saving?: boolean;
  isComplete?: boolean; // ★ เพิ่ม: ต้องกรอกครบก่อนถึงจะกด submit ได้
}

export default function ACFormActions({
  onSave,
  onSubmit,
  onReset,
  isSaving = false,
  saving = false,
  isComplete = false, // ★ default เป็น false (ยังกรอกไม่ครบ)
}: ACFormActionsProps) {
  const isLoading = isSaving || saving;
  const isDisabled = isLoading || !isComplete;

  return (
    <div className="tw-flex tw-items-center tw-justify-between tw-print:tw-mt-8">
      <div />
      <div className="tw-flex tw-gap-2 tw-print:tw-hidden">
        <Button
          type="button"
          onClick={onSubmit}
          className={`tw-h-10 tw-text-sm ${!isComplete && !isLoading ? "tw-opacity-50 tw-cursor-not-allowed" : ""}`}
          disabled={isDisabled}
          placeholder={undefined}
          onPointerEnterCapture={undefined}
          onPointerLeaveCapture={undefined}
        >
          {isLoading ? "กำลังบันทึก..." : !isComplete ? "กรอกข้อมูลให้ครบก่อน" : "บันทึก"}
        </Button>
      </div>
    </div>
  );
}