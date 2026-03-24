"use client";

import { useState, useEffect } from "react";

type Lang = "th" | "en";

export default function SolarPlantPage() {
  const [lang, setLang] = useState<Lang>("th");

  useEffect(() => {
    const saved = localStorage.getItem("app_language") as Lang | null;
    if (saved === "th" || saved === "en") setLang(saved);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ lang: Lang }>).detail;
      if (detail?.lang) setLang(detail.lang);
    };
    window.addEventListener("language:change", handler);
    return () => window.removeEventListener("language:change", handler);
  }, []);

  const t = {
    subtitle: lang === "th" ? "ระบบติดตามโซลาร์เซลล์" : "Solar Cell Monitoring System",
    comingSoon: "Coming Soon",
    desc1: lang === "th" ? "ฟีเจอร์นี้กำลังอยู่ในระหว่างการพัฒนา" : "This feature is currently under development.",
    desc2: lang === "th" ? "โปรดรอติดตามการอัปเดตในเร็วๆ นี้" : "Please stay tuned for upcoming updates.",
  };

  return (
    <div className="tw-mt-8 tw-mb-4">
      {/* Page Header */}
      <div
        className="tw-relative tw-overflow-hidden tw-rounded-2xl tw-mb-4 tw-px-5 sm:tw-px-8 tw-py-5 sm:tw-py-6"
        style={{ background: "linear-gradient(135deg, #1a1a1a, #2d2d2d, #1a1a1a)" }}
      >
        <div
          className="tw-absolute tw-inset-0 tw-opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          className="tw-absolute tw-top-0 tw-right-0 tw-w-64 tw-h-64 tw-rounded-full tw-opacity-[0.07]"
          style={{
            background: "radial-gradient(circle, #22c55e, transparent 70%)",
            transform: "translate(30%, -50%)",
          }}
        />
        <div className="tw-relative tw-z-10 tw-flex tw-items-center tw-gap-3 sm:tw-gap-4">
          <div
            className="tw-h-11 tw-w-11 sm:tw-h-12 sm:tw-w-12 tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-shadow-lg"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
          >
            <span className="tw-text-xl sm:tw-text-2xl">☀️</span>
          </div>
          <div>
            <h2 className="tw-text-white tw-font-bold tw-text-base sm:tw-text-lg tw-tracking-tight">
              Solar Plant Monitoring
            </h2>
            <p className="tw-text-white/30 tw-text-[11px] sm:tw-text-xs tw-mt-0.5">
              {t.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <div
        className="tw-relative tw-overflow-hidden tw-rounded-2xl tw-border tw-border-gray-200 tw-shadow-sm"
        style={{ background: "linear-gradient(180deg, #ffffff, #f8fafc)" }}
      >
        <div
          className="tw-absolute tw-top-0 tw-left-1/2 tw-w-[500px] tw-h-[500px] tw-rounded-full tw-opacity-[0.03]"
          style={{
            background: "radial-gradient(circle, #22c55e, transparent 70%)",
            transform: "translate(-50%, -60%)",
          }}
        />
        <div className="tw-relative tw-z-10 tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-20 sm:tw-py-28 tw-px-6">
          <div className="tw-relative tw-mb-6">
            <div
              className="tw-h-20 tw-w-20 sm:tw-h-24 sm:tw-w-24 tw-rounded-3xl tw-flex tw-items-center tw-justify-center tw-shadow-xl"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
            >
              <span className="tw-text-4xl sm:tw-text-5xl">🚀</span>
            </div>
          </div>
          <h3 className="tw-text-gray-800 tw-font-bold tw-text-lg sm:tw-text-xl tw-tracking-tight tw-mb-2 tw-text-center">
            {t.comingSoon}
          </h3>
          <p className="tw-text-gray-400 tw-text-sm tw-max-w-md tw-text-center tw-leading-relaxed">
            {t.desc1}<br className="tw-hidden sm:tw-inline" />
            {t.desc2}
          </p>
        </div>
      </div>
    </div>
  );
} 