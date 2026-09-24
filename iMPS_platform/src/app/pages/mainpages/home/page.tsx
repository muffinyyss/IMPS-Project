"use client";

import React from "react";

// @material-tailwind/react
import { Typography } from "@material-tailwind/react";

export default function Landing() {
  return (
    <div className="tw-min-h-screen tw-bg-white">
      {/* HERO */}
      <section className="tw-mx-auto tw-max-w-7xl tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-10 tw-items-center tw-px-4 tw-pt-20 md:tw-pt-28 tw-mt-32 md:tw-mt-5">
        {/* Left text */}
        <div className="tw-order-2 md:tw-order-1">
          <Typography
            variant="h1"
            className="tw-font-extrabold tw-tracking-tight tw-text-4xl sm:tw-text-5xl lg:tw-text-6xl"
          >
            Ai Maintenance
            <br />
            as a service Platform
          </Typography>

          <Typography className="tw-mt-6 tw-max-w-xl tw-text-gray-600 tw-text-base sm:tw-text-lg">
            Journey to the edge of wonder and witness the Aurora Borealis,
            where nature&apos;s most dazzling light show awaits to captivate
            your senses and ignite&nbsp;your imagination.
          </Typography>
        </div>

        {/* Right image */}
        <div className="tw-order-1 md:tw-order-2 tw-flex tw-justify-center">
          <img
            src="/img/charger.jpg"
            alt="Charger"
            className="tw-w-auto tw-max-h-[560px] tw-object-contain"
          />
        </div>
      </section>

      <div className="tw-mt-20" />
    </div>
  );
}