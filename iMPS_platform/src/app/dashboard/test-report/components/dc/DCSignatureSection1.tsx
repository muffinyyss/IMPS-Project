"use client";

import React, { useState } from "react";
import { Input } from "@material-tailwind/react";

interface SignatureSectionProps {
  // onRemarkChange?: (value: string) => void;
  // onSymbolChange?: (
  //   symbolType: "pass" | "notPass" | "notTest",
  //   checked: boolean
  // ) => void;
  // onPhaseSequenceChange?: (
  //   phaseType: "L1L2L3" | "L3L2L1",
  //   checked: boolean
  // ) => void;
  onResponsibilityChange?: (
    field: string,
    person: "performed" | "approved" | "witnessed",
    value: string
  ) => void;
}

// interface SymbolState {
//   selected: "pass" | "notPass" | "notTest" | "";
// }

// interface PhaseSequenceState {
//   selected: "L1L2L3" | "L3L2L1" | "";
// }

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
  onResponsibilityChange,
}) => {

  const [responsibility, setResponsibility] = useState<ResponsibilityData>({
    performed: { name: "", signature: "", date: "", company: "" },
    approved: { name: "", signature: "", date: "", company: "" },
    witnessed: { name: "", signature: "", date: "", company: "" },
  });

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
    <div className="tw-rounded-xl tw-border tw-border-gray-200 tw-bg-white tw-shadow-sm">
      {/* ================= DESKTOP / LARGE SCREEN (TABLE VIEW) ================= */}
      <div className="tw-hidden lg:tw-block tw-overflow-x-auto">
        <div className="tw-min-w-[800px]">
          {/* Table Header */}
          <div className="tw-grid tw-grid-cols-4 tw-bg-gray-100">
            <div className="tw-border-r tw-border-gray-300 tw-p-3 tw-text-center tw-font-semibold tw-text-sm tw-text-gray-800">
              Responsibility
            </div>
            <div className="tw-border-r tw-border-gray-300 tw-p-3 tw-text-center tw-font-semibold tw-text-sm tw-text-gray-800">
              Tested
            </div>
            <div className="tw-border-r tw-border-gray-300 tw-p-3 tw-text-center tw-font-semibold tw-text-sm tw-text-gray-800">
              Confirmed
            </div>
            <div className="tw-p-3 tw-text-center tw-font-semibold tw-text-sm tw-text-gray-800">
              Witnessed
            </div>
          </div>

          {/* Name Row */}
          <div className="tw-grid tw-grid-cols-4 tw-border-t tw-border-gray-200">
            <div className="tw-border-r tw-border-gray-200 tw-p-3 tw-bg-gray-50 tw-font-medium tw-text-sm tw-text-gray-700">
              Name
            </div>
            <div className="tw-border-r tw-border-gray-200 tw-p-2">
              <Input
                value={responsibility.performed.name}
                onChange={(e) =>
                  handleResponsibilityChange("name", "performed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>
            <div className="tw-border-r tw-border-gray-200 tw-p-2">
              <Input
                value={responsibility.approved.name}
                onChange={(e) =>
                  handleResponsibilityChange("name", "approved", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>
            <div className="tw-p-2">
              <Input
                value={responsibility.witnessed.name}
                onChange={(e) =>
                  handleResponsibilityChange("name", "witnessed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>
          </div>

          {/* Signature Row */}
          <div className="tw-grid tw-grid-cols-4 tw-border-t tw-border-gray-200">
            <div className="tw-border-r tw-border-gray-200 tw-p-3 tw-bg-gray-50 tw-font-medium tw-text-sm tw-text-gray-700">
              Signature
            </div>
            <div className="tw-border-r tw-border-gray-200 tw-p-2">
              <Input
                value={responsibility.performed.signature}
                onChange={(e) =>
                  handleResponsibilityChange("signature", "performed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>
            <div className="tw-border-r tw-border-gray-200 tw-p-2">
              <Input
                value={responsibility.approved.signature}
                onChange={(e) =>
                  handleResponsibilityChange("signature", "approved", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>
            <div className="tw-p-2">
              <Input
                value={responsibility.witnessed.signature}
                onChange={(e) =>
                  handleResponsibilityChange("signature", "witnessed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>
          </div>

          {/* Date Row */}
          <div className="tw-grid tw-grid-cols-4 tw-border-t tw-border-gray-200">
            <div className="tw-border-r tw-border-gray-200 tw-p-3 tw-bg-gray-50 tw-font-medium tw-text-sm tw-text-gray-700">
              Date
            </div>
            <div className="tw-border-r tw-border-gray-200 tw-p-2">
              <Input
                type="date"
                value={responsibility.performed.date}
                onChange={(e) =>
                  handleResponsibilityChange("date", "performed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>
            <div className="tw-border-r tw-border-gray-200 tw-p-2">
              <Input
                type="date"
                value={responsibility.approved.date}
                onChange={(e) =>
                  handleResponsibilityChange("date", "approved", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>
            <div className="tw-p-2">
              <Input
                type="date"
                value={responsibility.witnessed.date}
                onChange={(e) =>
                  handleResponsibilityChange("date", "witnessed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>
          </div>

          {/* Company Row */}
          <div className="tw-grid tw-grid-cols-4 tw-border-t tw-border-gray-200">
            <div className="tw-border-r tw-border-gray-200 tw-p-3 tw-bg-gray-50 tw-font-medium tw-text-sm tw-text-gray-700">
              Company
            </div>
            <div className="tw-border-r tw-border-gray-200 tw-p-2">
              <Input
                value={responsibility.performed.company}
                onChange={(e) =>
                  handleResponsibilityChange("company", "performed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>
            <div className="tw-border-r tw-border-gray-200 tw-p-2">
              <Input
                value={responsibility.approved.company}
                onChange={(e) =>
                  handleResponsibilityChange("company", "approved", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>
            <div className="tw-p-2">
              <Input
                value={responsibility.witnessed.company}
                onChange={(e) =>
                  handleResponsibilityChange("company", "witnessed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================= MOBILE / TABLET (CARD VIEW) ================= */}
      <div className="lg:tw-hidden tw-p-3 tw-space-y-4">
        {/* Header */}
        <div className="tw-text-center tw-pb-2">
          <div className="tw-text-sm tw-font-semibold tw-text-gray-800">
            Responsibility
          </div>
        </div>

        {/* Tested Card */}
        <div className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-gray-50 tw-p-3 tw-space-y-3 tw-shadow-sm">
          <div className="tw-flex tw-items-center tw-gap-2 tw-pb-2 tw-border-b tw-border-gray-200">
            <div className="tw-w-6 tw-h-6 tw-rounded-full tw-bg-blue-100 tw-flex tw-items-center tw-justify-center">
              <span className="tw-text-xs tw-font-semibold tw-text-blue-700">T</span>
            </div>
            <span className="tw-text-sm tw-font-semibold tw-text-gray-800">
              Tested
            </span>
          </div>

          <div className="tw-space-y-2">
            <div>
              <label className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1 tw-block">
                Name
              </label>
              <Input
                value={responsibility.performed.name}
                onChange={(e) =>
                  handleResponsibilityChange("name", "performed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300 !tw-text-sm"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder="Enter name"
              />
            </div>

            <div>
              <label className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1 tw-block">
                Signature
              </label>
              <Input
                value={responsibility.performed.signature}
                onChange={(e) =>
                  handleResponsibilityChange("signature", "performed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300 !tw-text-sm"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder="Enter signature"
              />
            </div>

            <div>
              <label className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1 tw-block">
                Date
              </label>
              <Input
                type="date"
                value={responsibility.performed.date}
                onChange={(e) =>
                  handleResponsibilityChange("date", "performed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300 !tw-text-sm"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>

            <div>
              <label className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1 tw-block">
                Company
              </label>
              <Input
                value={responsibility.performed.company}
                onChange={(e) =>
                  handleResponsibilityChange("company", "performed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300 !tw-text-sm"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder="Enter company"
              />
            </div>
          </div>
        </div>

        {/* Confirmed Card */}
        <div className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-gray-50 tw-p-3 tw-space-y-3 tw-shadow-sm">
          <div className="tw-flex tw-items-center tw-gap-2 tw-pb-2 tw-border-b tw-border-gray-200">
            <div className="tw-w-6 tw-h-6 tw-rounded-full tw-bg-green-100 tw-flex tw-items-center tw-justify-center">
              <span className="tw-text-xs tw-font-semibold tw-text-green-700">C</span>
            </div>
            <span className="tw-text-sm tw-font-semibold tw-text-gray-800">
              Confirmed
            </span>
          </div>

          <div className="tw-space-y-2">
            <div>
              <label className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1 tw-block">
                Name
              </label>
              <Input
                value={responsibility.approved.name}
                onChange={(e) =>
                  handleResponsibilityChange("name", "approved", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300 !tw-text-sm"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder="Enter name"
              />
            </div>

            <div>
              <label className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1 tw-block">
                Signature
              </label>
              <Input
                value={responsibility.approved.signature}
                onChange={(e) =>
                  handleResponsibilityChange("signature", "approved", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300 !tw-text-sm"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder="Enter signature"
              />
            </div>

            <div>
              <label className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1 tw-block">
                Date
              </label>
              <Input
                type="date"
                value={responsibility.approved.date}
                onChange={(e) =>
                  handleResponsibilityChange("date", "approved", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300 !tw-text-sm"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>

            <div>
              <label className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1 tw-block">
                Company
              </label>
              <Input
                value={responsibility.approved.company}
                onChange={(e) =>
                  handleResponsibilityChange("company", "approved", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300 !tw-text-sm"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder="Enter company"
              />
            </div>
          </div>
        </div>

        {/* Witnessed Card */}
        <div className="tw-rounded-lg tw-border tw-border-gray-200 tw-bg-gray-50 tw-p-3 tw-space-y-3 tw-shadow-sm">
          <div className="tw-flex tw-items-center tw-gap-2 tw-pb-2 tw-border-b tw-border-gray-200">
            <div className="tw-w-6 tw-h-6 tw-rounded-full tw-bg-purple-100 tw-flex tw-items-center tw-justify-center">
              <span className="tw-text-xs tw-font-semibold tw-text-purple-700">W</span>
            </div>
            <span className="tw-text-sm tw-font-semibold tw-text-gray-800">
              Witnessed
            </span>
          </div>

          <div className="tw-space-y-2">
            <div>
              <label className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1 tw-block">
                Name
              </label>
              <Input
                value={responsibility.witnessed.name}
                onChange={(e) =>
                  handleResponsibilityChange("name", "witnessed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300 !tw-text-sm"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder="Enter name"
              />
            </div>

            <div>
              <label className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1 tw-block">
                Signature
              </label>
              <Input
                value={responsibility.witnessed.signature}
                onChange={(e) =>
                  handleResponsibilityChange("signature", "witnessed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300 !tw-text-sm"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder="Enter signature"
              />
            </div>

            <div>
              <label className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1 tw-block">
                Date
              </label>
              <Input
                type="date"
                value={responsibility.witnessed.date}
                onChange={(e) =>
                  handleResponsibilityChange("date", "witnessed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300 !tw-text-sm"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
              />
            </div>

            <div>
              <label className="tw-text-[11px] tw-font-medium tw-text-gray-600 tw-mb-1 tw-block">
                Company
              </label>
              <Input
                value={responsibility.witnessed.company}
                onChange={(e) =>
                  handleResponsibilityChange("company", "witnessed", e.target.value)
                }
                crossOrigin=""
                className="!tw-border-gray-300 !tw-text-sm"
                containerProps={{ className: "!tw-min-w-0 !tw-h-8" }}
                placeholder="Enter company"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ACSignatureSection;
