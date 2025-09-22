"use client";
import React from "react";

type Props = {
  title?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export default function ChargerSettingCard({
  title,
  right,
  className = "",
  children,
}: Props) {
  return (
    <div className={`tw-bg-white tw-rounded-2xl tw-border tw-border-blue-gray-100 tw-shadow-sm ${className}`}>
      {(title || right) && (
        <div className="tw-flex tw-items-center tw-justify-between tw-px-5 tw-pt-5">
          {title ? (
            <h3 className="tw-text-lg tw-font-semibold tw-text-blue-gray-900">{title}</h3>
          ) : <span />}
          {right ?? null}
        </div>
      )}
      {(title || right) && <div className="tw-h-px tw-bg-blue-gray-50 tw-mx-5 tw-my-3" />}
      <div className="tw-p-5">{children}</div>
    </div>
  );
}
