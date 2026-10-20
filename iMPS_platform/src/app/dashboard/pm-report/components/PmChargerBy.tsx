"use client";

/**
 * "ผู้ทำ PM" ของตู้ชาร์จแต่ละตู้ในใบงาน — planner ต้นทางเลือกทุกใบงาน
 *
 * ตู้แต่ละตู้ไม่ได้ทำโดยคนเดิมเสมอ: บางตู้ vendor ทำเอง (เช่น EDS) บางตู้ทีมเราทำเอง
 * บางตู้ outsource ทำ — ตัวเลือกมาจาก vendor / outsource ของบริษัทเรา (ตั้งที่หน้า Company)
 * ค่าว่าง = ทีมของ planner เอง
 *
 * ผลของการเลือก (backend routers/pm_scope.py):
 *   - ตู้ที่เลือกคนอื่น จะกรอกได้เฉพาะคนของรายนั้น ทีมเรากรอกส่วนที่เหลือ
 *   - vendor ที่มี planner ของตัวเอง (เช่น EDS) ได้ใบส่งต่อให้วางแผนทีมของตัวเองอีกรอบ
 *
 * ใช้ร่วมกันระหว่าง PmPlanForm (ใบงาน Maximo) และ PmCreateWoForm (เปิดใบงานเอง)
 */
import React from "react";
import type { Lang } from "@/utils/useLanguage";
import type { PmAssigneeOptions } from "./planning";

const T = {
  own: { th: "ทีมเรา", en: "Our team" },
  vendorGroup: { th: "Vendor", en: "Vendor" },
  outsourceGroup: { th: "Outsource", en: "Outsource" },
  chargerVendor: { th: "vendor ของตู้", en: "charger vendor" },
  doneBy: { th: "ผู้ทำ PM", en: "PM by" },
} as const;
const t = (k: keyof typeof T, lang: Lang) => T[k][lang === "en" ? "en" : "th"];

/** ชื่อฝั่งทีมเรา — ใช้ชื่อบริษัทถ้ารู้ (เช่น "EGAT") ไม่งั้น "ทีมเรา" */
export function ownTeamLabel(company: string | null | undefined, lang: Lang) {
  const c = String(company ?? "").trim();
  return c || t("own", lang);
}

export function ChargerBySelect({
  value, onChange, options, ownLabel, chargerVendor, lang, disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  options: PmAssigneeOptions;
  ownLabel: string;
  /** ช่อง Vendor ของตู้ (ข้อมูลตู้) — ไว้บอกเป็นคำใบ้ ไม่ได้เลือกให้อัตโนมัติ */
  chargerVendor?: string | null;
  lang: Lang;
  disabled?: boolean;
}) {
  const hint = String(chargerVendor ?? "").trim().toLowerCase();
  const mark = (name: string) => (hint && name.toLowerCase() === hint ? ` (${t("chargerVendor", lang)})` : "");
  // ค่าที่บันทึกไว้แต่ไม่อยู่ในตัวเลือกแล้ว (เช่นถูกลบจากหน้า Company) ยังต้องโชว์ ไม่หายเงียบ ๆ
  const known = [...options.vendors, ...options.outsources].some((n) => n.toLowerCase() === value.toLowerCase());
  return (
    <label className="tw-flex tw-shrink-0 tw-items-center tw-gap-1.5 tw-text-xs tw-text-blue-gray-500">
      <span className="tw-whitespace-nowrap">{t("doneBy", lang)}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`tw-max-w-[11rem] tw-rounded-md tw-border tw-px-2 tw-py-1 tw-text-xs focus:tw-outline-none focus:tw-border-blue-500 ${
          value ? "tw-border-amber-300 tw-bg-amber-50 tw-text-amber-900" : "tw-border-blue-gray-200 tw-bg-white tw-text-blue-gray-800"
        }`}
      >
        <option value="">{ownLabel}</option>
        {value && !known && <option value={value}>{value}</option>}
        {options.vendors.length > 0 && (
          <optgroup label={t("vendorGroup", lang)}>
            {options.vendors.map((n) => <option key={`v-${n}`} value={n}>{n}{mark(n)}</option>)}
          </optgroup>
        )}
        {options.outsources.length > 0 && (
          <optgroup label={t("outsourceGroup", lang)}>
            {options.outsources.map((n) => <option key={`o-${n}`} value={n}>{n}</option>)}
          </optgroup>
        )}
      </select>
    </label>
  );
}

/** ป้ายผู้ทำ PM ของตู้ (อ่านอย่างเดียว) — ทีมเราเป็นสีเทา คนอื่นสีส้ม */
export function ChargerByTag({ by, ownLabel }: { by?: string | null; ownLabel: string }) {
  const name = String(by ?? "").trim();
  return (
    <span
      className={`tw-shrink-0 tw-rounded-full tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-semibold ${
        name ? "tw-bg-amber-100 tw-text-amber-800" : "tw-bg-gray-200 tw-text-gray-600"
      }`}
    >
      {name || ownLabel}
    </span>
  );
}
