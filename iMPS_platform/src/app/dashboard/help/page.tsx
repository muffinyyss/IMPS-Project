"use client";

import {
  DocumentTextIcon,
  BookOpenIcon,
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
  QuestionMarkCircleIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/solid";

type DocLink = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

// วางไฟล์เอกสารไว้ใน public/docs/ แล้วแก้ href ให้ตรงกับไฟล์จริง
// หรือเปลี่ยนเป็นลิงก์ภายนอก (Google Drive / เว็บไซต์) ได้เลย
const DOCS: DocLink[] = [
  {
    title: "คู่มือการใช้งานระบบ (User Manual)",
    description: "ภาพรวมการใช้งาน iMPS Platform สำหรับผู้ใช้งานทั่วไป",
    href: "/docs/user-manual.pdf",
    icon: BookOpenIcon,
  },
  {
    title: "คู่มือการติดตั้ง (Installation Guide)",
    description: "ขั้นตอนการติดตั้งและตั้งค่าอุปกรณ์เริ่มต้น",
    href: "/docs/installation-guide.pdf",
    icon: WrenchScrewdriverIcon,
  },
  {
    title: "คู่มือการบำรุงรักษา (Maintenance / PM)",
    description: "แนวทางการบำรุงรักษาเชิงป้องกันและการรายงานผล",
    href: "/docs/maintenance-guide.pdf",
    icon: ShieldCheckIcon,
  },
  {
    title: "คำถามที่พบบ่อย (FAQ)",
    description: "รวมคำถามและการแก้ไขปัญหาเบื้องต้น",
    href: "/docs/faq.pdf",
    icon: QuestionMarkCircleIcon,
  },
];

export default function HelpPage() {
  return (
    <div className="tw-space-y-6 tw-mt-8">
      {/* Header */}
      <div className="tw-flex tw-items-center tw-gap-3">
        <span className="tw-flex tw-h-11 tw-w-11 tw-items-center tw-justify-center tw-rounded-xl tw-bg-blue-50 tw-text-blue-600">
          <DocumentTextIcon className="tw-h-6 tw-w-6" />
        </span>
        <div>
          <h1 className="tw-text-xl tw-font-bold tw-text-blue-gray-800">
            ศูนย์ช่วยเหลือ
          </h1>
          <p className="tw-text-sm tw-text-blue-gray-500">
            เอกสารคู่มือและแหล่งข้อมูลการใช้งาน
          </p>
        </div>
      </div>

      {/* Document links */}
      <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-4">
        {DOCS.map((doc) => {
          const Icon = doc.icon;
          return (
            <a
              key={doc.title}
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="tw-group tw-flex tw-items-start tw-gap-4 tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-p-5 tw-shadow-sm tw-transition hover:tw-border-blue-200 hover:tw-shadow-md"
            >
              <span className="tw-flex tw-h-10 tw-w-10 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-bg-blue-gray-50 tw-text-blue-gray-500 tw-transition group-hover:tw-bg-blue-50 group-hover:tw-text-blue-600">
                <Icon className="tw-h-5 tw-w-5" />
              </span>
              <div className="tw-min-w-0 tw-flex-1">
                <div className="tw-flex tw-items-center tw-gap-1.5">
                  <h2 className="tw-text-sm tw-font-semibold tw-text-blue-gray-800 group-hover:tw-text-blue-700">
                    {doc.title}
                  </h2>
                  <ArrowTopRightOnSquareIcon className="tw-h-3.5 tw-w-3.5 tw-text-blue-gray-300 group-hover:tw-text-blue-500" />
                </div>
                <p className="tw-mt-1 tw-text-xs tw-text-blue-gray-500">
                  {doc.description}
                </p>
              </div>
            </a>
          );
        })}
      </div>

      {/* Contact / support note */}
      <div className="tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-blue-gray-50/60 tw-p-4 tw-text-sm tw-text-blue-gray-600">
        ต้องการความช่วยเหลือเพิ่มเติม? ติดต่อทีมสนับสนุนที่{" "}
        <a
          href="mailto:support@imps.com"
          className="tw-font-semibold tw-text-blue-600 hover:tw-underline"
        >
          support@imps.com
        </a>
      </div>
    </div>
  );
}
