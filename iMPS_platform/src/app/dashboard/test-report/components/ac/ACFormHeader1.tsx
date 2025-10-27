"use client";

import React from "react";
import Image from "next/image";
import { Typography } from "@material-tailwind/react";

interface CMFormHeaderProps {
  headerLabel: string;
  logoSrc?: string;
}

export default function CMFormHeader({
  headerLabel,
  logoSrc = "/img/logo_egat.png",
}: CMFormHeaderProps) {
  return (
    <div className="tw-flex tw-items-start tw-justify-between tw-gap-6">
      {/* ซ้าย: โลโก้ + ข้อความ */}
      <div className="tw-flex tw-items-start tw-gap-4">
        <div
          className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md
                          tw-h-16 tw-w-[76px]
                          md:tw-h-20 md:tw-w-[108px]
                          lg:tw-h-24 lg:tw-w-[152px]"
        >
          <Image
            src={logoSrc}
            alt="Company logo"
            fill
            priority
            className="tw-object-contain tw-p-0"
            sizes="(min-width:1024px) 152px, (min-width:768px) 108px, 76px"
          />
        </div>

        <div className="tw-flex tw-items-center tw-h-16 md:tw-h-20 lg:tw-h-24">
          <div className="tw-font-semibold tw-text-blue-gray-900">
            PICTURE
          </div>
        </div>
      </div>
    </div>
  );
}
