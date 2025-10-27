"use client";

import React from "react";
import { Button } from "@material-tailwind/react";

interface ACSaveActionsProps {
  onSave: () => void;
  onFinalSave: () => void;
  saving?: boolean;
}

const ACSaveActions: React.FC<ACSaveActionsProps> = ({
  onSave,
  onFinalSave,
  saving = false
}) => {
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
          disabled={saving}
        >
          บันทึกชั่วคราว
        </Button>
        <Button 
          type="button" 
          onClick={onFinalSave} 
          className="tw-h-10 tw-text-sm"
          disabled={saving}
          loading={saving}
        >
          บันทึก
        </Button>
      </div>
    </div>
  );
};

export default ACSaveActions;