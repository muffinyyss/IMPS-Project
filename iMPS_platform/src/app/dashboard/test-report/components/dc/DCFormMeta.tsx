"use client";

import React from "react";
import { Input } from "@material-tailwind/react";

interface Job {
  issue_id: string;
  found_date: string;
  location: string;
  equipment_list: string[];
  problem_details: string;
  problem_type: string;
  severity: string;
  reported_by: string[];
  assignee: string;
  initial_cause: string;
  resolved_date: string;
  repair_result: string;
  preventive_action: string[];
  status: string;
  remarks: string;
  manufacturer?: string;
  model?: string;
  power?: string;
  firmware_version?: string;
  serial_number?: string;
}

interface ACFormMetaProps {
  job: Job;
  onJobChange: (updates: Partial<Job>) => void;
}

export default function ACFormMeta({ job, onJobChange }: ACFormMetaProps) {
  return (
    <div className="tw-space-y-4">
      {/* First Row - Issue ID and Location */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4">
        <div>
          <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">
            Issue ID
          </label>
          <Input
            value={job.issue_id || "EL-2025-1001"}
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
            value={job.location || "PT KhIong Luang3"}
            onChange={(e) => onJobChange({ location: e.target.value })}
            crossOrigin=""
            className="!tw-w-full"
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
            value={job.manufacturer || ""}
            onChange={(e) => onJobChange({ manufacturer: e.target.value })}
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
            value={job.model || ""}
            onChange={(e) => onJobChange({ model: e.target.value })}
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
            value={job.power || ""}
            onChange={(e) => onJobChange({ power: e.target.value })}
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
            value={job.firmware_version || ""}
            onChange={(e) => onJobChange({ firmware_version: e.target.value })}
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
            value={job.serial_number || ""}
            onChange={(e) => onJobChange({ serial_number: e.target.value })}
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
            value={(job.found_date || "").slice(0, 10) || "2025-10-24"}
            onChange={(e) => onJobChange({ found_date: e.target.value })}
            crossOrigin=""
            className="!tw-w-full"
            containerProps={{ className: "!tw-min-w-0" }}
          />
        </div>
      </div>
    </div>
  );
}