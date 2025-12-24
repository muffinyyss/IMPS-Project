
"use client";

import React, { useEffect } from "react";
import { Card, CardBody, Typography, Button } from "@/components/MaterialTailwind";

type Props = {
  startDate: string;         // YYYY-MM-DD
  endDate: string;           // YYYY-MM-DD
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  title?: string;
  subtitle?: string;
  maxEndDate?: string; // YYYY-MM-DD
  onApply: () => void;
};

export default function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  title = "Select Date Range",
  subtitle = "For all three charts below",
  maxEndDate,
  onApply,
}: Props) {
  // คำนวณวันนี้และเมื่อวาน
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  // const toDateStr = (d: Date) => d.toISOString().split("T")[0];
  const toLocalDateStr = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayStr = toLocalDateStr(today);
  const yesterdayStr = toLocalDateStr(yesterday);

  // เซ็ตค่า default แค่ตอน mount
  // useEffect(() => {
  //   if (!startDate) {
  //     onStartChange(yesterdayStr);
  //   }
  //   if (!endDate) {
  //     onEndChange(todayStr);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []); // ❗ ทำงานครั้งเดียวตอน mount

  useEffect(() => {
    if (!startDate) onStartChange(yesterdayStr);
    if (!endDate) onEndChange(todayStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invalid = !!(startDate && endDate && new Date(startDate) > new Date(endDate));
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !invalid) onApply();
  };

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

        {/* กล่องคอนโทรลด้านขวา */}
        <div className="tw-flex tw-flex-col sm:tw-flex-row tw-gap-3 sm:tw-items-end">
          <label className="tw-flex tw-flex-col tw-text-sm">
            <span className="tw-mb-1 tw-text-blue-gray-700">Start date</span>
            <input
              type="date"
              className="tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-2 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
              value={startDate || yesterdayStr}
              max={endDate || todayStr}         // ห้ามเกิน endDate หรือวันนี้
              onChange={(e) => onStartChange(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </label>

          <label className="tw-flex tw-flex-col tw-text-sm">
            <span className="tw-mb-1 tw-text-blue-gray-700">End date</span>
            <input
              type="date"
              className="tw-rounded-md tw-border tw-border-blue-gray-200 tw-px-3 tw-py-2 focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-blue-500"
              value={endDate || todayStr}
              min={startDate || yesterdayStr}
              onChange={(e) => onEndChange(e.target.value)}
              max={maxEndDate || todayStr}       // ❗ ห้ามเลือกเกินวันนี้
              onKeyDown={onKeyDown}
            />
          </label>

          {/* ปุ่ม Apply */}
          <Button
            type="button"
            onClick={onApply}
            disabled={invalid}
            title={invalid ? "Start date ต้องไม่มากกว่า End date" : "นำช่วงวันที่ไปใช้"}
            variant="filled"
            color="blue-gray"
            className="
              !tw-h-10 !tw-px-4 !tw-rounded-md
              !tw-bg-black !tw-text-white
              hover:!tw-bg-neutral-900
              tw-shadow-sm hover:tw-shadow
              tw-transition-colors tw-duration-200
              focus:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-black/40
              disabled:tw-opacity-50 disabled:tw-cursor-not-allowed
              sm:tw-self-end
            "
          >
            Apply
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

