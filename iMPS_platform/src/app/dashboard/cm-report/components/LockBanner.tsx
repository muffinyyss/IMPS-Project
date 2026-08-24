"use client";

/**
 * แถบแจ้งว่าใบงานนี้มีคนกำลังกรอกอยู่ — ใช้ร่วมกันทั้งฟอร์ม Open และ In Progress
 * (สิทธิ์กรอกมาจาก useReportLock ใน cm-report/lib/lock.ts)
 */

import React from "react";
import { LockClosedIcon } from "@heroicons/react/24/solid";
import type { Lang } from "@/utils/useLanguage";

export default function LockBanner({ lockedBy, lang }: { lockedBy: string | null; lang: Lang }) {
    if (!lockedBy) return null;
    return (
        <div className="tw-mb-4 tw-flex tw-items-start tw-gap-2 tw-rounded-xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-4 tw-py-3 tw-text-sm tw-text-amber-800">
            <LockClosedIcon className="tw-mt-0.5 tw-h-5 tw-w-5 tw-shrink-0" />
            <span>
                {lang === "th"
                    ? <>ใบงานนี้กำลังถูกกรอกโดย <b>{lockedBy}</b> — ตอนนี้ดูได้อย่างเดียว ระบบจะเปิดให้กรอกเองเมื่ออีกฝ่ายออกจากหน้านี้</>
                    : <>This work order is being edited by <b>{lockedBy}</b> — view only for now. Editing unlocks automatically once they leave.</>}
            </span>
        </div>
    );
}
