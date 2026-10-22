"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Input } from "@material-tailwind/react";
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

const TXT = {
    placeholder: { th: "พิมพ์เพื่อค้นหา...", en: "Type to search..." },
    noMatch: { th: "ไม่พบบริษัท", en: "No company found" },
    useTyped: { th: "ใช้ค่าที่พิมพ์ (ไม่อยู่ในรายชื่อ)", en: "Use typed value (not in list)" },
} as const;

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

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

type ComboboxProps = {
    options: CompanyOption[];
    label: string;
    lang: Lang;
    /** ชื่อ field ของ <form> — ส่งค่าผ่าน hidden input (ใช้กับฟอร์มแบบ uncontrolled) */
    name?: string;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
    /** true = พิมพ์ค่าอิสระได้ (admin), false = ต้องเลือกจากลิสต์ (planner) */
    freeText?: boolean;
    required?: boolean;
    disabled?: boolean;
};

/**
 * ช่อง Company แบบค้นหาได้ — พิมพ์บางส่วนของชื่อ (ไม่สนตัวพิมพ์ / ช่องว่าง) แล้วเลือกจากลิสต์
 * จัดกลุ่มตามประเภท (บริษัทตัวเอง / Owner / Vendor / Outsource) · ใช้ลูกศรขึ้นลง + Enter ได้
 */
export function CompanyCombobox({
    options, label, lang, name, value, defaultValue, onChange, freeText = false, required = true, disabled,
}: ComboboxProps) {
    const [inner, setInner] = useState(defaultValue ?? "");
    const selected = value ?? inner;
    const setSelected = (v: string) => {
        if (value === undefined) setInner(v);
        onChange?.(v);
    };

    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState("");
    /** strict mode: ข้อความที่กำลังพิมพ์ (ยังไม่ได้เลือก) — null = แสดงค่าที่เลือกอยู่ */
    const [draft, setDraft] = useState<string | null>(null);
    const [active, setActive] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    const display = freeText ? selected : draft ?? selected;

    const filtered = useMemo(() => {
        const q = norm(filter);
        return q ? options.filter((o) => norm(o.name).includes(q)) : options;
    }, [options, filter]);
    const groups = useMemo(() => grouped(filtered), [filtered]);
    const showGroups = grouped(options).length > 1;
    // ลำดับเดียวกับที่แสดง (เรียงตามกลุ่ม) — ใช้กับลูกศรขึ้นลง
    const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

    useEffect(() => setActive(0), [filter]);
    useEffect(() => {
        if (!open) return;
        listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
    }, [active, open]);

    const choose = (o: CompanyOption) => {
        setSelected(o.name);
        setDraft(null);
        setFilter("");
        setOpen(false);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const text = e.target.value;
        if (freeText) setSelected(text);
        else setDraft(text);
        setFilter(text);
        setOpen(true);
    };

    const handleBlur = () => {
        setOpen(false);
        if (!freeText && draft !== null) {
            // พิมพ์ชื่อครบตรงกับในลิสต์ (ไม่สนตัวพิมพ์) = เลือกตัวนั้น, ไม่งั้นกลับเป็นค่าเดิม
            const exact = options.find((o) => norm(o.name) === norm(draft));
            if (exact) setSelected(exact.name);
            setDraft(null);
        }
        setFilter("");
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) setOpen(true);
            else setActive((i) => Math.min(i + 1, flat.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter" && open) {
            // กัน Enter ไป submit ฟอร์มตอนลิสต์เปิดอยู่
            if (flat[active]) {
                e.preventDefault();
                choose(flat[active]);
            } else if (!freeText) {
                e.preventDefault();
            } else {
                setOpen(false);
            }
        } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
            setDraft(null);
            setFilter("");
        }
    };

    let idx = -1;
    const renderItem = (o: CompanyOption) => {
        idx += 1;
        const i = idx;
        const isActive = i === active;
        const isSelected = o.name === selected;
        return (
            <div
                key={`${o.type}:${o.name}`}
                data-active={isActive}
                onMouseDown={(e) => e.preventDefault()} // ไม่ให้ input blur ก่อนคลิก
                onClick={() => choose(o)}
                onMouseEnter={() => setActive(i)}
                className={`tw-flex tw-cursor-pointer tw-items-center tw-justify-between tw-px-4 tw-py-2 tw-text-sm ${
                    isActive ? "tw-bg-blue-50" : ""
                } ${isSelected ? "tw-font-semibold tw-text-blue-700" : "tw-text-blue-gray-700"}`}
            >
                <span className="tw-truncate">{o.name}</span>
                {isSelected && <span className="tw-ml-2 tw-text-blue-600">✓</span>}
            </div>
        );
    };

    return (
        <div className="tw-relative tw-w-full">
            <Input
                label={label}
                required={required}
                disabled={disabled}
                autoComplete="off"
                placeholder={TXT.placeholder[lang]}
                value={display}
                onChange={handleChange}
                onFocus={(e) => {
                    setOpen(true);
                    setFilter("");
                    e.target.select();
                }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                role="combobox"
                aria-expanded={open}
                crossOrigin={undefined}
            />
            {name && <input type="hidden" name={name} value={selected} />}

            {open && !disabled && (
                <div
                    ref={listRef}
                    role="listbox"
                    className="tw-absolute tw-left-0 tw-right-0 tw-top-full tw-z-20 tw-mt-1 tw-max-h-56 tw-overflow-y-auto tw-rounded-lg tw-border tw-border-gray-300 tw-bg-white tw-py-1 tw-shadow-lg"
                >
                    {showGroups
                        ? groups.map((g) => (
                              <div key={g.type}>
                                  <div className="tw-sticky tw-top-0 tw-bg-gray-50 tw-px-4 tw-py-1 tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wide tw-text-blue-gray-400">
                                      {GROUP_LABEL[g.type][lang]}
                                  </div>
                                  {g.items.map(renderItem)}
                              </div>
                          ))
                        : flat.map(renderItem)}

                    {flat.length === 0 && (
                        <div className="tw-px-4 tw-py-3 tw-text-center tw-text-sm tw-text-gray-500">
                            {freeText && filter.trim() ? (
                                <>
                                    <span className="tw-font-medium tw-text-blue-gray-700">“{filter.trim()}”</span>
                                    <br />
                                    {TXT.useTyped[lang]}
                                </>
                            ) : (
                                TXT.noMatch[lang]
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
