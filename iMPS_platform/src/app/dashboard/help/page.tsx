"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpenIcon,
  CodeBracketIcon,
  DocumentArrowDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";

type DocLink = {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean; // แสดงเฉพาะ role = "admin"
};

// วางไฟล์ไว้ใน /public/docs แล้วอ้าง path ตรงนี้ (encodeURI รองรับชื่อไทย/เว้นวรรค)
const DOCS: DocLink[] = [
  {
    title: "คู่มือการใช้งานระบบ",
    description: "ภาพรวมและวิธีใช้งาน iMPS Platform สำหรับผู้ใช้งานทั่วไป",
    href: encodeURI("/docs/คู่มือการใช้งานระบบ_iMPS Platform.pdf"),
    icon: BookOpenIcon,
  },
  {
    title: "คู่มือการใช้งาน Source Code",
    description: "โครงสร้างโค้ดและแนวทางพัฒนาต่อยอด สำหรับทีมพัฒนา",
    href: encodeURI("/docs/คู่มือการใช้งาน source code_iMPS Platform.pdf"),
    icon: CodeBracketIcon,
    adminOnly: true,
  },
];

export default function HelpPage() {
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      "";
    if (!token) return;
    try {
      const payload = token.split(".")[1];
      const claims = JSON.parse(
        atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
      );
      setRole(claims.role || "user");
    } catch {
      setRole("user");
    }
  }, []);

  const docs = DOCS.filter((d) => !d.adminOnly || role === "admin");

  return (
    <div className="tw-w-full tw-space-y-5 tw-mt-6">
      {/* หัวข้อ */}
      <div>
        <h2 className="tw-text-lg sm:tw-text-xl tw-font-bold tw-text-blue-gray-900">
          คู่มือการใช้งาน
        </h2>
        <p className="tw-text-sm tw-text-blue-gray-500 tw-mt-0.5">
          เอกสารแนะนำการใช้งาน iMPS Platform
        </p>
      </div>

      {/* รายการเอกสาร */}
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-3 sm:tw-gap-4">
        {docs.map((doc) => {
          const Icon = doc.icon;
          return (
            <a
              key={doc.title}
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="tw-group tw-rounded-xl tw-bg-white tw-border tw-border-blue-gray-100 tw-shadow-sm tw-overflow-hidden tw-transition-all tw-duration-300 hover:tw-shadow-lg hover:tw--translate-y-0.5 hover:tw-border-blue-200"
            >
              {/* เนื้อหา */}
              <div className="tw-flex tw-items-start tw-gap-3 lg:tw-gap-4 tw-p-4">
                <div className="tw-flex tw-items-center tw-justify-center tw-w-11 tw-h-11 tw-rounded-xl tw-bg-gray-900 tw-shadow-md tw-flex-shrink-0">
                  <Icon className="tw-w-5 tw-h-5 tw-text-white" />
                </div>
                <div className="tw-flex-1 tw-min-w-0">
                  <h3 className="tw-text-sm lg:tw-text-base tw-font-bold tw-text-blue-gray-900 tw-leading-snug">
                    {doc.title}
                  </h3>
                  <p className="tw-text-xs lg:tw-text-sm tw-text-blue-gray-500 tw-mt-1 tw-leading-relaxed">
                    {doc.description}
                  </p>
                </div>
              </div>

              {/* เส้นคั่น */}
              <div className="tw-border-t tw-border-blue-gray-50" />

              {/* footer */}
              <div className="tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-2.5 tw-bg-gray-50/50">
                <span className="tw-inline-flex tw-items-center tw-gap-1.5 tw-text-[11px] lg:tw-text-xs tw-font-medium tw-text-blue-gray-500">
                  <DocumentArrowDownIcon className="tw-w-3.5 tw-h-3.5" />
                  เอกสาร PDF
                </span>
                <span className="tw-inline-flex tw-items-center tw-gap-0.5 tw-text-[11px] lg:tw-text-xs tw-font-semibold tw-text-blue-gray-700 group-hover:tw-text-gray-900 tw-transition-colors">
                  เปิดเอกสาร
                  <ChevronRightIcon className="tw-w-3.5 tw-h-3.5 tw-transition-transform group-hover:tw-translate-x-0.5" />
                </span>
              </div>
            </a>
          );
        })}
      </div>

      {/* ติดต่อสอบถาม */}
      <p className="tw-text-xs lg:tw-text-sm tw-text-blue-gray-500">
        มีข้อสงสัยเพิ่มเติม?{" "}
        <a
          href="/pages/mainpages/contact"
          className="tw-font-semibold tw-text-gray-900 hover:tw-underline"
        >
          ติดต่อทีมงาน
        </a>
      </p>
    </div>
  );
}
