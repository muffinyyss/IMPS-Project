"use client";
import Link from "next/link";
import { Typography, Button } from "@/components/MaterialTailwind";

export default function Landing() {
  return (
    <div className="tw-min-h-screen tw-bg-white">
      {/* NAVBAR */}
      <nav className="tw-sticky tw-top-0 tw-z-40 tw-bg-white">
        <div className="tw-mx-auto tw-max-w-7xl tw-h-20 tw-grid tw-grid-cols-[1fr_auto_1fr] tw-items-center tw-px-4">
          {/* Brand */}
          <a href="/" className="tw-flex tw-items-center tw-space-x-2">
            <span className="tw-text-4xl tw-font-extrabold">
              <span className="tw-text-yellow-400">i</span>
              <span className="tw-text-gray-900">MPS</span>
            </span>
          </a>

          {/* Center nav */}
          <ul className="tw-flex tw-items-center tw-space-x-10 tw-text-gray-700">
            <li><a href="/pages/mainpages/home" className="tw-font-medium hover:tw-text-black">Home</a></li>
            <li><a href="#" className="tw-font-medium hover:tw-text-black">About</a></li>
            <li><a href="#" className="tw-font-medium hover:tw-text-black">Contract</a></li>
            <li><a href="/dashboard/analytics" className="tw-font-medium hover:tw-text-black">Dashboard</a></li>
          </ul>

          {/* Right actions */}
          <div className="tw-flex tw-justify-end">
            <Link
              href="/auth/signin/basic"
              className="tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-5 tw-h-10 tw-shadow-sm tw-inline-flex tw-items-center tw-justify-center tw-text-sm"
            >
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="tw-mx-auto tw-max-w-7xl tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-10 tw-items-center tw-px-4 tw-pt-10 md:tw-pt-16 mt-5">
        {/* Left text */}
        <div className="tw-order-2 md:tw-order-1">
          <Typography
            variant="h1"
            className="tw-font-extrabold tw-tracking-tight tw-text-4xl sm:tw-text-5xl lg:tw-text-6xl"
          >
            Ai Maintenance<br />as a service Platform
          </Typography>

          <Typography className="tw-mt-6 tw-max-w-xl tw-text-gray-600 tw-text-base sm:tw-text-lg">
            Journey to the edge of wonder and witness the Aurora Borealis,
            where nature’s most dazzling light show awaits to captivate your
            senses and ignite&nbsp; your imagination.
          </Typography>
        </div>

        {/* Right image */}
        <div className="tw-order-1 md:tw-order-2 tw-flex tw-justify-center">
          {/* เปลี่ยน src ให้เป็นรูปของคุณเอง */}
          <img
            src="/img/images.png"
            alt="images"
            className="tw-w-auto tw-max-h-[560px] tw-object-contain"
          />
        </div>
      </section>
    </div>
  );
}
