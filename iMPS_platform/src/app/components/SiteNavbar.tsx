"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const navItems = [
  { label: "Home", href: "/pages/mainpages/home" },
  { label: "About", href: "/pages/mainpages/about" },
  { label: "Contact", href: "/pages/mainpages/contact" },
  { label: "Dashboard", href: "/dashboard/analytics" },
];

export default function SiteNavbar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (!pathname) return false;
    // ให้ active เมื่อ path เริ่มด้วย href (รองรับ sub-routes) ยกเว้น Home ให้เช็คตรงๆ
    if (href === "/pages/mainpages/home") {
      return pathname === "/pages/mainpages/home";
    }
    return pathname.startsWith(href);
  };

  const linkClass = (href: string) =>
    `tw-font-medium hover:tw-text-black ${
      isActive(href) ? "tw-text-black tw-font-semibold" : "tw-text-gray-700"
    }`;

  return (
    <nav className="tw-sticky tw-top-0 tw-z-40 tw-bg-white">
      <div className="tw-mx-auto tw-max-w-7xl tw-h-20 tw-grid tw-grid-cols-[1fr_auto_1fr] tw-items-center tw-px-4">
        {/* Brand */}
        <Link href="/" className="tw-flex tw-items-center tw-space-x-2" aria-label="IMPS Home">
          <span className="tw-text-4xl tw-font-extrabold">
            <span className="tw-text-yellow-400">i</span>
            <span className="tw-text-gray-900">MPS</span>
          </span>
        </Link>

        {/* Center nav */}
        <ul className="tw-flex tw-items-center tw-space-x-10">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={linkClass(item.href)}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right actions */}
        <div className="tw-flex tw-justify-end">
          <Link
            href="/auth/signin/basic"
            className="tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-5 tw-h-10 
             tw-shadow-sm tw-inline-flex tw-items-center tw-justify-center tw-text-sm
             hover:tw-bg-black hover:tw-text-white hover:tw-border-black"
          >
            Login
          </Link>
        </div>
      </div>
    </nav>
  );
}
