"use client";

import React from "react";
import { Input } from "@material-tailwind/react";


interface Head {
  issue_id: string;
  inspection_date: string;
  location: string;
  manufacturer?: string;
  model?: string;
  power?: string;
  firmware_version?: string;
  serial_number?: string;
}

interface ACFormMetaProps {
  head: Head;
  onHeadChange: (updates: Partial<Head>) => void;
}

export default function ACFormMeta({  head, onHeadChange}: ACFormMetaProps) {
  return (
    <div className="tw-space-y-4">
      {/* First Row - Issue ID and Location */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4">
        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">
            Issue ID
          </label>
          <Input
            value={head.issue_id || "" }
            readOnly
            crossOrigin=""
            containerProps={{ className: "!tw-min-w-0" }}
            className="!tw-w-full !tw-bg-gray-100"
          />
        </div>

        <div className="md:tw-col-span-2">
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">
            Location
          </label>
          <Input
            value={head.location }
            onChange={(e) => onHeadChange({ location: e.target.value })}
            readOnly
            crossOrigin=""
            className="!tw-w-full !tw-bg-gray-100"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>
      </div>

      {/* Second Row - Manufacturer, Model, Power, Firmware */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4">
        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">
            Manufacturer
          </label>
          <Input
            value={head.manufacturer || ""}
            
            onChange={(e) => onHeadChange({ manufacturer: e.target.value })}
            crossOrigin=""
            className="!tw-w-full"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>

        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">
            Model
          </label>
          <Input
            value={head.model || ""}
            onChange={(e) => onHeadChange({ model: e.target.value })}
            crossOrigin=""
            className="!tw-w-full"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>

        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">
            Power
          </label>
          <Input
            value={head.power || ""}
            onChange={(e) => onHeadChange({ power: e.target.value })}
            crossOrigin=""
            className="!tw-w-full"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>
      </div>

      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4">
        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">
            Firmware Version
          </label>
          <Input
            value={head.firmware_version || ""}
            onChange={(e) => onHeadChange({ firmware_version: e.target.value })}
            crossOrigin=""
            className="!tw-w-full"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>

        {/* Third Row - Serial Number and Inspection Date */}
        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">
            Serial Number
          </label>
          <Input
            value={head.serial_number || ""}
            onChange={(e) => onHeadChange({ serial_number: e.target.value })}
            crossOrigin=""
            className="!tw-w-full"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>

        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">
            Inspection Date
          </label>
          <Input
            type="date"
            value={(head.inspection_date || "").slice(0, 10) }
            onChange={(e) => onHeadChange({ inspection_date: e.target.value })}
            crossOrigin=""
            className="!tw-w-full"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>
      </div>
    </div>
  );
}