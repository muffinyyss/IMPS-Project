"use client";

/**
 * แถบแจ้งว่ามีคนกำลังกรอกอยู่ — แบบเดียวกับหน้า CM (cm-report/components/LockBanner.tsx)
 * section = ส่วนหนึ่งของใบ PM สถานี / plan = หน้าวางแผนใบงาน
 */

import React from "react";
import { LockClosedIcon } from "@heroicons/react/24/solid";
import type { Lang } from "@/utils/useLanguage";

export default function PmLockBanner({
  lockedBy, kind, lang, children,
}: {
  lockedBy: string | null;
  kind: "section" | "plan";
  lang: Lang;
  children?: React.ReactNode;
}) {
  if (!lockedBy) return null;
  const th = kind === "plan"
    ? <>แผนของใบงานนี้กำลังถูกแก้ไขโดย <b>{lockedBy}</b> — ตอนนี้ดูได้อย่างเดียว ระบบจะเปิดให้แก้เองเมื่ออีกฝ่ายออกจากหน้านี้</>
    : <>ส่วนนี้กำลังถูกกรอกโดย <b>{lockedBy}</b> — ตอนนี้ดูได้อย่างเดียว ระบบจะเปิดให้กรอกเองเมื่ออีกฝ่ายออกจากหน้านี้</>;
  const en = kind === "plan"
    ? <>This plan is being edited by <b>{lockedBy}</b> — view only for now. Editing unlocks automatically once they leave.</>
    : <>This section is being filled in by <b>{lockedBy}</b> — view only for now. Editing unlocks automatically once they leave.</>;
  return (
    <div className="tw-mb-4 tw-flex tw-items-start tw-gap-2 tw-rounded-xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-4 tw-py-3 tw-text-sm tw-text-amber-800">
      <LockClosedIcon className="tw-mt-0.5 tw-h-5 tw-w-5 tw-shrink-0" />
      <div className="tw-min-w-0 tw-flex-1">
        <span>{lang === "en" ? en : th}</span>
        {children && <div className="tw-mt-2 tw-flex tw-flex-wrap tw-gap-2">{children}</div>}
      </div>
    </div>
  );
}
