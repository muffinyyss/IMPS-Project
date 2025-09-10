"use client";
import { useState } from "react";
import { Card, CardHeader, CardBody, Typography } from "@/components/MaterialTailwind";
import { Switch } from "@material-tailwind/react";

type Props = {
  title?: string;
  initialValue?: number;
  initialOn?: boolean;
  className?: string;
};

export default function HealthIndex({
  initialValue = 72,
  initialOn = true,
  className,
}: Props) {
  const [on, setOn] = useState(initialOn);
  const v = Math.max(0, Math.min(100, Math.round(initialValue)));
  const segments = 10;
  const filled = Math.floor((v / 100) * segments);

  return (
    <Card className={`tw-border tw-border-blue-gray-100 tw-shadow-sm ${className ?? ""}`}>
      <CardHeader
        floated={false}
        shadow={false}
        className="tw-px-4 tw-py-3 tw-flex tw-items-center tw-justify-between"
      >
        <div className="tw-flex tw-items-center">
          <img
            src="/img/heart-rate.png"  
            alt="Health Icon"
            className="tw-h-12 tw-w-12 tw-mr-4"
          />
          <Typography variant="h6" color="blue-gray">
            Health Index
          </Typography>
        </div>

        <div className="tw-flex tw-items-center tw-gap-2">
          <Typography className="tw-text-sm tw-text-blue-gray-600">
            {on ? "Active" : "Inactive"}
          </Typography>
          <Switch checked={on} onChange={() => setOn(!on)} />
        </div>
      </CardHeader>

      <CardBody className="tw-space-y-4 tw-pt-0 tw-px-4 tw-pb-4">
        <div className="tw-p-6">
          <Typography className="tw-text-3xl tw-font-semibold">
            {on ? `${v}%` : "--"}
          </Typography>
          <div className={`tw-flex tw-items-center tw-gap-1 ${on ? "" : "tw-opacity-40"}`}>
            <div className="tw-flex tw-items-center tw-gap-1 tw-border tw-border-blue-gray-200 tw-rounded tw-p-1 tw-flex-1">
              {Array.from({ length: segments }).map((_, i) => (
                <div
                  key={i}
                  className={`tw-h-4 tw-flex-1 tw-rounded-[2px] ${i < filled
                      ? v >= 80
                        ? "tw-bg-green-500"
                        : v >= 50
                          ? "tw-bg-amber-500"
                          : "tw-bg-red-500"
                      : "tw-bg-blue-gray-100"
                    }`}
                />
              ))}
            </div>
            <div className="tw-h-6 tw-w-1.5 tw-bg-blue-gray-200 tw-rounded-r" />
          </div>
          <div className="tw-flex tw-justify-between tw-text-xs tw-text-blue-gray-500">
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}