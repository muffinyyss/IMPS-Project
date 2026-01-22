"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

type Lang = "th" | "en";

// ===== Translations =====
const translations = {
  th: {
    reportTitle: "Test Report (DC Charger)",
    companyName: "การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)",
    address: "เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย จังหวัดนนทบุรี 11130",
    callCenter: "ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416",
    documentName: "ชื่อเอกสาร",
    loading: "กำลังโหลด...",
  },
  en: {
    reportTitle: "Test Report (DC Charger)",
    companyName: "Electricity Generating Authority of Thailand (EGAT)",
    address: "53 Moo 2 Charansanitwong Road, Bang Kruai, Nonthaburi 11130, Thailand",
    callCenter: "Call Center Tel. 02-114-3350",
    documentName: "Document Name",
    loading: "Loading...",
  },
};

interface DCFormHeaderProps {
  headerLabel?: string;
  logoSrc?: string;
  issueId?: string;
  documentName?: string;  // ★★★ NEW: รับ documentName โดยตรงจาก backend ★★★
}

export default function DCFormHeader({
  headerLabel,
  logoSrc = "/img/logo_egat.png",
  issueId,
  documentName,  // ★★★ NEW ★★★
}: DCFormHeaderProps) {
  // ===== Language State =====
  const [lang, setLang] = useState<Lang>("th");

  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") {
      setLang(savedLang);
    }

    const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => {
      setLang(e.detail.lang);
    };

    window.addEventListener("language:change", handleLangChange as EventListener);
    return () => {
      window.removeEventListener("language:change", handleLangChange as EventListener);
    };
  }, []);

  const t = translations[lang];
  
  // ★★★ FIXED: ใช้ documentName จาก prop โดยตรง ★★★
  const displayDocName = documentName || t.loading;
  const isLoading = !documentName;

  return (
    <div className="tw-pb-4 tw-border-b tw-border-gray-200">
      {/* Main content wrapper */}
      <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start tw-gap-4">
        {/* Left section: Logo + Company Info */}
        <div className="tw-flex tw-items-start tw-gap-3 tw-flex-1 tw-min-w-0">
          {/* Logo */}
          <div className="tw-flex-shrink-0">
            <div
              className="tw-relative tw-overflow-hidden tw-bg-white tw-rounded-md
                         tw-h-12 tw-w-[70px]
                         md:tw-h-16 md:tw-w-[100px]
                         lg:tw-h-[72px] lg:tw-w-[120px]"
            >
              <Image
                src={logoSrc}
                alt="Company logo"
                fill
                priority
                className="tw-object-contain tw-p-0"
                sizes="(min-width:1024px) 120px, (min-width:768px) 100px, 70px"
              />
            </div>
          </div>

          {/* Company Info */}
          <div className="tw-flex-1 tw-min-w-0">
            <div className="tw-font-bold tw-text-sm md:tw-text-base lg:tw-text-lg tw-text-blue-gray-900 tw-mb-1">
              {t.reportTitle}
            </div>
            <div className="tw-text-xs md:tw-text-sm tw-text-blue-gray-600 tw-leading-relaxed">
              <span className="tw-block">{t.companyName}</span>
              <span className="tw-hidden md:tw-block">{t.address}</span>
              <span className="tw-hidden md:tw-block">{t.callCenter}</span>
            </div>
          </div>
        </div>

        {/* Right section: Document Name */}
        <div className="tw-text-left md:tw-text-right tw-text-sm tw-text-blue-gray-700 tw-border-t tw-border-blue-gray-100 tw-pt-3 tw-w-full md:tw-border-t-0 md:tw-pt-0 md:tw-w-auto md:tw-shrink-0">
          <div className="tw-font-semibold">
            {t.documentName}
          </div>
          {/* ★★★ แสดง documentName จาก backend โดยตรง ★★★ */}
          <div className={`tw-break-all ${isLoading ? "tw-text-gray-400 tw-italic" : "tw-font-medium"}`}>
            {displayDocName}
          </div>
        </div>
      </div>
    </div>
  );
}