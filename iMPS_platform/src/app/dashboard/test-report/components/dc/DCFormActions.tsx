"use client";

import React from "react";
import { Button } from "@material-tailwind/react";

interface ACFormActionsProps {
  onSave: () => void;
  onSubmit: () => void;
  onReset: () => void;
  isSaving?: boolean;
  saving?: boolean;
}

export default function ACFormActions({ 
  onSave, 
  onSubmit, 
  onReset, 
  isSaving = false,
  saving = false
}: ACFormActionsProps) {
  const isLoading = isSaving || saving;

  return (
    <div className="tw-flex tw-items-center tw-justify-between tw-print:tw-mt-8">
      <div />
      <div className="tw-flex tw-gap-2 tw-print:tw-hidden">
        <Button
          type="button"
          variant="outlined"
          color="blue-gray"
          onClick={onSave}
          className="tw-h-10 tw-text-sm"
          disabled={isLoading}
          placeholder={undefined}
          onPointerEnterCapture={undefined}
          onPointerLeaveCapture={undefined}
        >
          {isLoading ? "กำลังบันทึก..." : "บันทึกชั่วคราว"}
        </Button>
        <Button 
          type="button" 
          onClick={onSubmit} 
          className="tw-h-10 tw-text-sm"
          disabled={isLoading}
          placeholder={undefined}
          onPointerEnterCapture={undefined}
          onPointerLeaveCapture={undefined}
        >
          {isLoading ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </div>
    </div>
  );
}