"use client";

import React, { useState } from "react";
import { Input } from "@material-tailwind/react";

interface SignatureSectionProps {
  onRemarkChange?: (value: string) => void;
  onSymbolChange?: (
    symbolType: "pass" | "notPass" | "notTest",
    checked: boolean
  ) => void;
  onPhaseSequenceChange?: (
    phaseType: "L1L2L3" | "L3L2L1",
    checked: boolean
  ) => void;
  onResponsibilityChange?: (
    field: string,
    person: "performed" | "approved" | "witnessed",
    value: string
  ) => void;
}

interface SymbolState {
  selected: "pass" | "notPass" | "notTest" | "";
}

interface PhaseSequenceState {
  selected: "L1L2L3" | "L3L2L1" | "";
}

interface ResponsibilityData {
  performed: {
    name: string;
    signature: string;
    date: string;
    company: string;
  };
  approved: {
    name: string;
    signature: string;
    date: string;
    company: string;
  };
  witnessed: {
    name: string;
    signature: string;
    date: string;
    company: string;
  };
}

const ACSignatureSection: React.FC<SignatureSectionProps> = ({
  onRemarkChange,
  onSymbolChange,
  onPhaseSequenceChange,
  onResponsibilityChange,
}) => {
  const [remark, setRemark] = useState<string>("");
  const [symbols, setSymbols] = useState<SymbolState>({
    selected: "",
  });
  const [phaseSequence, setPhaseSequence] = useState<PhaseSequenceState>({
    selected: "",
  });
  const [responsibility, setResponsibility] = useState<ResponsibilityData>({
    performed: { name: "", signature: "", date: "", company: "" },
    approved: { name: "", signature: "", date: "", company: "" },
    witnessed: { name: "", signature: "", date: "", company: "" },
  });

  const handleRemarkChange = (value: string) => {
    setRemark(value);
    onRemarkChange?.(value);
  };

  const handleSymbolChange = (symbolType: "pass" | "notPass" | "notTest") => {
    setSymbols({ selected: symbolType });
    onSymbolChange?.(symbolType, true);
  };

  const handlePhaseSequenceChange = (phaseType: "L1L2L3" | "L3L2L1") => {
    setPhaseSequence({ selected: phaseType });
    onPhaseSequenceChange?.(phaseType, true);
  };

  const handleResponsibilityChange = (
    field: string,
    person: "performed" | "approved" | "witnessed",
    value: string
  ) => {
    const newResponsibility = {
      ...responsibility,
      [person]: {
        ...responsibility[person],
        [field]: value,
      },
    };
    setResponsibility(newResponsibility);
    onResponsibilityChange?.(field, person, value);
  };

  return (
    <div className="tw-space-y-6 tw-p-4 tw-border tw-border-gray-300 tw-bg-white">
      {/* Remark Section */}
      <div>
        <div className="tw-mb-3">
          <span className="tw-text-sm tw-font-semibold tw-text-gray-800">
            Remark
          </span>
        </div>
        <div className="tw-space-y-2">
          <Input
            value={remark}
            onChange={(e) => handleRemarkChange(e.target.value)}
            crossOrigin=""
            className="!tw-border-gray-400"
            containerProps={{ className: "!tw-min-w-0" }}
            placeholder=""
          />
        </div>
      </div>
{/* Symbol and Phase Sequence Section */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-6">
        {/* Symbol Section */}
        <div>
          <div className="tw-mb-3">
            <span className="tw-text-sm tw-font-semibold tw-text-gray-800">Symbol :</span>
          </div>
          <div className="tw-flex tw-gap-3">
            {/* PASS Button */}
            <button
              type="button"
              onClick={() => handleSymbolChange('pass')}
              className={`tw-px-6 tw-py-2 tw-rounded-md tw-font-medium tw-text-sm tw-transition-colors tw-border
                ${symbols.selected === 'pass'
                  ? 'tw-bg-green-600 tw-text-white tw-border-green-600'
                  : 'tw-bg-white tw-text-green-600 tw-border-green-600 hover:tw-bg-green-50'
                }`}
            >
              PASS
            </button>

            {/* FAIL Button */}
            <button
              type="button"
              onClick={() => handleSymbolChange('notPass')}
              className={`tw-px-6 tw-py-2 tw-rounded-md tw-font-medium tw-text-sm tw-border tw-transition-colors
                ${symbols.selected === 'notPass'
                  ? 'tw-bg-red-600 tw-text-white tw-border-red-600'
                  : 'tw-bg-white tw-text-red-600 tw-border-red-600 hover:tw-bg-red-50'
                }`}
            >
              FAIL
            </button>

            {/* N/A Button */}
            <button
              type="button"
              onClick={() => handleSymbolChange('notTest')}
              className={`tw-px-4 tw-py-2 tw-rounded-md tw-font-medium tw-text-sm tw-transition-colors tw-border
                ${symbols.selected === 'notTest'
                  ? 'tw-bg-gray-600 tw-text-white tw-border-gray-600'
                  : 'tw-bg-white tw-text-gray-600 tw-border-gray-600 hover:tw-bg-gray-50'
                }`}
            >
              N/A
            </button>
          </div>
        </div>

        {/* Phase Sequence Section */}
        <div>
          <div className="tw-mb-3">
            <span className="tw-text-sm tw-font-semibold tw-text-gray-800">Phase Sequence</span>
          </div>
          <div className="tw-flex tw-gap-3">
            {/* L1-L2-L3 Button */}
            <button
              type="button"
              onClick={() => handlePhaseSequenceChange('L1L2L3')}
              className={`tw-px-6 tw-py-2 tw-rounded-md tw-font-medium tw-text-sm tw-transition-colors tw-border
                ${phaseSequence.selected === 'L1L2L3'
                  ? 'tw-bg-blue-600 tw-text-white tw-border-blue-600'
                  : 'tw-bg-white tw-text-blue-600 tw-border-blue-600 hover:tw-bg-blue-50'
                }`}
            >
              L1-L2-L3
            </button>

            {/* L3-L2-L1 Button */}
            <button
              type="button"
              onClick={() => handlePhaseSequenceChange('L3L2L1')}
              className={`tw-px-6 tw-py-2 tw-rounded-md tw-font-medium tw-text-sm tw-border tw-transition-colors
                ${phaseSequence.selected === 'L3L2L1'
                  ? 'tw-bg-orange-600 tw-text-white tw-border-orange-600'
                  : 'tw-bg-white tw-text-orange-600 tw-border-orange-600 hover:tw-bg-orange-50'
                }`}
            >
              L3-L2-L1
            </button>
          </div>
        </div>
      </div>
      {/* Responsibility Table */}
      <div>
        <div className="tw-border tw-border-gray-800 tw-bg-white">
          {/* Table Header */}
          <div className="tw-grid tw-grid-cols-4 tw-bg-gray-100">
            <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold tw-text-sm">
              Responsibility
            </div>
            <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold tw-text-sm">
              Tested
            </div>
            <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-text-center tw-font-semibold tw-text-sm">
              Confirmed
            </div>
            <div className="tw-p-3 tw-text-center tw-font-semibold tw-text-sm">
              Witnessed
            </div>
          </div>

          {/* Name Row */}
          <div className="tw-grid tw-grid-cols-4 tw-border-t tw-border-gray-800">
            <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-bg-gray-50 tw-font-medium tw-text-sm">
              Name
            </div>
            <div className="tw-border-r tw-border-gray-800 tw-p-2">
              <Input
                value={responsibility.performed.name}
                onChange={(e) =>
                  handleResponsibilityChange(
                    "name",
                    "performed",
                    e.target.value
                  )
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
            <div className="tw-border-r tw-border-gray-800 tw-p-2">
              <Input
                value={responsibility.approved.name}
                onChange={(e) =>
                  handleResponsibilityChange("name", "approved", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
            <div className="tw-p-2">
              <Input
                value={responsibility.witnessed.name}
                onChange={(e) =>
                  handleResponsibilityChange(
                    "name",
                    "witnessed",
                    e.target.value
                  )
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
          </div>

          {/* Signature Row */}
          <div className="tw-grid tw-grid-cols-4 tw-border-t tw-border-gray-800">
            <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-bg-gray-50 tw-font-medium tw-text-sm">
              Signature
            </div>
            <div className="tw-border-r tw-border-gray-800 tw-p-2">
              <Input
                value={responsibility.performed.signature}
                onChange={(e) =>
                  handleResponsibilityChange(
                    "signature",
                    "performed",
                    e.target.value
                  )
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
            <div className="tw-border-r tw-border-gray-800 tw-p-2">
              <Input
                value={responsibility.approved.signature}
                onChange={(e) =>
                  handleResponsibilityChange(
                    "signature",
                    "approved",
                    e.target.value
                  )
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
            <div className="tw-p-2">
              <Input
                value={responsibility.witnessed.signature}
                onChange={(e) =>
                  handleResponsibilityChange(
                    "signature",
                    "witnessed",
                    e.target.value
                  )
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
          </div>

          {/* Date Row */}
          <div className="tw-grid tw-grid-cols-4 tw-border-t tw-border-gray-800">
            <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-bg-gray-50 tw-font-medium tw-text-sm">
              Date
            </div>
            <div className="tw-border-r tw-border-gray-800 tw-p-2">
              <Input
                type="date"
                value={responsibility.performed.date}
                onChange={(e) =>
                  handleResponsibilityChange(
                    "date",
                    "performed",
                    e.target.value
                  )
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
            <div className="tw-border-r tw-border-gray-800 tw-p-2">
              <Input
                type="date"
                value={responsibility.approved.date}
                onChange={(e) =>
                  handleResponsibilityChange("date", "approved", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
            <div className="tw-p-2">
              <Input
                type="date"
                value={responsibility.witnessed.date}
                onChange={(e) =>
                  handleResponsibilityChange(
                    "date",
                    "witnessed",
                    e.target.value
                  )
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
          </div>

          {/* Company Row */}
          <div className="tw-grid tw-grid-cols-4 tw-border-t tw-border-gray-800">
            <div className="tw-border-r tw-border-gray-800 tw-p-3 tw-bg-gray-50 tw-font-medium tw-text-sm">
              Company
            </div>
            <div className="tw-border-r tw-border-gray-800 tw-p-2">
              <Input
                value={responsibility.performed.company}
                onChange={(e) =>
                  handleResponsibilityChange(
                    "company",
                    "performed",
                    e.target.value
                  )
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
            <div className="tw-border-r tw-border-gray-800 tw-p-2">
              <Input
                value={responsibility.approved.company}
                onChange={(e) =>
                  handleResponsibilityChange(
                    "company",
                    "approved",
                    e.target.value
                  )
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
            <div className="tw-p-2">
              <Input
                value={responsibility.witnessed.company}
                onChange={(e) =>
                  handleResponsibilityChange(
                    "company",
                    "witnessed",
                    e.target.value
                  )
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder=""
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ACSignatureSection;
