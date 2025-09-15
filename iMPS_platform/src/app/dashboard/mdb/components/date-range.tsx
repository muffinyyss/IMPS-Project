"use client";
import React from "react";
import { Card, CardBody, Typography } from "@/components/MaterialTailwind";

type Props = {
  startDate: string;         // YYYY-MM-DD
  endDate: string;           // YYYY-MM-DD
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  title?: string;
  subtitle?: string;
  maxEndDate?: string; // รูปแบบ YYYY-MM-DD
};

export default function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  title = "เลือกช่วงวันที่สำหรับกราฟ",
  subtitle = "ใช้กับกราฟด้านล่างทั้งสาม",
  maxEndDate,
}: Props) {
  return (
    <Card className="tw-mb-4 tw-border tw-border-blue-gray-100 tw-shadow-sm">
      <CardBody className="tw-flex tw-flex-col md:tw-flex-row md:tw-items-end md:tw-justify-between tw-gap-3">
        <div>
          <Typography variant="h6" color="blue-gray">
            {title}
          </Typography>
          <Typography variant="small" color="gray" className="tw-opacity-70">
            {subtitle}
          </Typography>
        </div>

        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-3">
          <label className="tw-flex tw-flex-col tw-text-sm">
            <span className="tw-mb-1 tw-text-blue-gray-700">Start date</span>
            <input
              type="date"
              className="tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-2 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => onStartChange(e.target.value)}
            />
          </label>

          <label className="tw-flex tw-flex-col tw-text-sm">
            <span className="tw-mb-1 tw-text-blue-gray-700">End date</span>
            <input
              type="date"
              className="tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-2 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => onEndChange(e.target.value)}
              max={maxEndDate}
            />
          </label>
        </div>
      </CardBody>
    </Card>
  );
}
