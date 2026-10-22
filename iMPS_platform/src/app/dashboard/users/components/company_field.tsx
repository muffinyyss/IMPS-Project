"use client";

import type { ChangeEvent } from "react";
import type { Lang } from "@/utils/useLanguage";

/** ตัวเลือกช่อง Company จาก GET /users/manageable-companies (options) */
export type CompanyType = "self" | "owner" | "vendor" | "outsource" | "current";
export type CompanyOption = { name: string; type: CompanyType };

const GROUP_ORDER: CompanyType[] = ["current", "self", "owner", "vendor", "outsource"];
const GROUP_LABEL: Record<CompanyType, Record<Lang, string>> = {
    current: { th: "ค่าปัจจุบัน", en: "Current" },
    self: { th: "บริษัทตัวเอง", en: "Your company" },
    owner: { th: "Owner", en: "Owner" },
    vendor: { th: "Vendor", en: "Vendor" },
    outsource: { th: "Outsource", en: "Outsource" },
};

export function parseCompanyOptions(json: any): CompanyOption[] {
    if (Array.isArray(json?.options)) {
        return json.options
            .filter((o: any) => o && typeof o.name === "string" && o.name.trim())
            .map((o: any) => ({ name: o.name, type: (o.type as CompanyType) || "self" }));
    }
    // backend รุ่นก่อนมีแค่ companies (ชื่อเปล่า ๆ)
    return Array.isArray(json?.companies)
        ? json.companies.map((name: string) => ({ name, type: "self" as CompanyType }))
        : [];
}

/** ค่าเดิมที่ไม่อยู่ในลิสต์ (เช่นพิมพ์ต่างตัวพิมพ์) ต้องไม่หายจาก dropdown — ใส่ไว้กลุ่ม "ค่าปัจจุบัน" */
export function withCurrentCompany(options: CompanyOption[], current?: string): CompanyOption[] {
    const cur = (current ?? "").trim();
    if (!cur || cur === "-" || options.some((o) => o.name === cur)) return options;
    return [{ name: cur, type: "current" }, ...options];
}

function grouped(options: CompanyOption[]) {
    return GROUP_ORDER.map((type) => ({ type, items: options.filter((o) => o.type === type) })).filter(
        (g) => g.items.length > 0,
    );
}

const SELECT_CLASS =
    "tw-h-full tw-w-full tw-cursor-pointer tw-appearance-none tw-rounded-[7px] tw-border tw-border-blue-gray-200 tw-bg-transparent tw-px-3 tw-py-2.5 tw-font-sans tw-text-sm tw-font-normal tw-text-blue-gray-700 tw-outline-none focus:tw-border-2 focus:tw-border-gray-900";

type SelectProps = {
    options: CompanyOption[];
    label: string;
    lang: Lang;
    name?: string;
    value?: string;
    defaultValue?: string;
    onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
};

/** dropdown ช่อง Company ของ planner — จัดกลุ่มตามประเภท (บริษัทตัวเอง / Vendor / Outsource) */
export function CompanySelect({ options, label, lang, name, value, defaultValue, onChange }: SelectProps) {
    const groups = grouped(options);
    const showGroups = groups.length > 1;
    return (
        <div className="tw-relative tw-h-10 tw-w-full">
            <select
                name={name}
                required
                value={value}
                defaultValue={defaultValue}
                onChange={onChange}
                className={SELECT_CLASS}
            >
                {showGroups
                    ? groups.map((g) => (
                          <optgroup key={g.type} label={GROUP_LABEL[g.type][lang]}>
                              {g.items.map((o) => (
                                  <option key={o.name} value={o.name}>{o.name}</option>
                              ))}
                          </optgroup>
                      ))
                    : options.map((o) => (
                          <option key={o.name} value={o.name}>{o.name}</option>
                      ))}
            </select>
            <label className="tw-pointer-events-none tw-absolute tw-left-3 tw--top-1.5 tw-bg-white tw-px-1 tw-text-[11px] tw-font-normal tw-text-blue-gray-400">
                {label} *
            </label>
        </div>
    );
}

/** รายชื่อแนะนำของช่อง Company แบบพิมพ์เอง (admin) — ผูกกับ <input list={id}> */
export function CompanySuggestions({ id, options, lang }: { id: string; options: CompanyOption[]; lang: Lang }) {
    return (
        <datalist id={id}>
            {options.map((o) => (
                <option key={`${o.type}:${o.name}`} value={o.name} label={GROUP_LABEL[o.type][lang]} />
            ))}
        </datalist>
    );
}
