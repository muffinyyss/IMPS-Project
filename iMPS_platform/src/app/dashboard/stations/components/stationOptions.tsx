"use client";
import { useEffect, useRef, useState } from "react";

/** ตัวเลือกสถานะการรับประกัน / สัดส่วนการลงทุน (ระดับสถานี) — ใช้ร่วมกันทั้งฟอร์มเพิ่มและแก้ไข */
export const WARRANTY_STATUS_OPTIONS = [
    { value: "in_warranty", th: "อยู่ในระยะเวลาการรับประกัน", en: "In warranty" },
    { value: "out_of_warranty", th: "หมดประกัน", en: "Out of warranty" },
] as const;

export const INVESTMENT_SCOPE_OPTIONS = [
    { value: "cb_box", th: "ระบบไฟฟ้าแรงสูง (CB-BOX)", en: "High voltage system (CB-BOX)" },
    { value: "mdb", th: "ระบบไฟฟ้าแรงต่ำ (MDB)", en: "Low voltage system (MDB)" },
    { value: "structure", th: "แท่น / โครงสร้างสถานี (Structure)", en: "Station structure" },
    { value: "charger", th: "เครื่องอัดประจุไฟฟ้า (charger)", en: "Charger" },
    { value: "ccb", th: "CCB ระบบสื่อสาร", en: "CCB communication system" },
] as const;

export const labelOf = (
    options: readonly { value: string; th: string; en: string }[],
    value: string,
    lang: "th" | "en"
) => options.find((o) => o.value === value)?.[lang] ?? value;

/** dropdown แบบเลือกได้หลายอัน (checkbox) หน้าตาเข้าชุดกับ Material Tailwind Select */
export const MultiSelectDropdown = ({ label, options, selected, onChange, lang, emptyLabel }: {
    label: string;
    options: readonly { value: string; th: string; en: string }[];
    selected: string[];
    onChange: (next: string[]) => void;
    lang: "th" | "en";
    emptyLabel: string;
}) => {
    const [open, setOpen] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    const toggle = (value: string) =>
        onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

    const summary = selected.length
        ? selected.map((v) => labelOf(options, v, lang)).join(", ")
        : emptyLabel;

    return (
        <div className="tw-relative tw-w-full" ref={boxRef}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="tw-peer tw-w-full tw-h-full tw-bg-transparent tw-text-blue-gray-700 tw-font-sans tw-font-normal tw-outline-none tw-border tw-border-blue-gray-200 focus:tw-border-2 focus:tw-border-gray-900 tw-rounded-[7px] tw-px-3 tw-py-2.5 tw-text-sm tw-text-left tw-cursor-pointer tw-truncate"
            >
                <span className={selected.length ? "" : "tw-text-blue-gray-300"}>{summary}</span>
            </button>
            <div className="tw-pointer-events-none tw-absolute tw-inset-y-0 tw-right-3 tw-flex tw-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-4 tw-w-4 tw-text-blue-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </div>
            <label className="tw-pointer-events-none tw-absolute tw-left-3 tw--top-1.5 tw-text-[11px] tw-text-blue-gray-400 tw-bg-white tw-px-1 tw-font-normal">
                {label}
            </label>
            {open && (
                <div className="tw-absolute tw-z-[10000] tw-mt-1 tw-w-full tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-xl tw-py-1">
                    {options.map((o) => (
                        <label
                            key={o.value}
                            className="tw-flex tw-items-start tw-gap-2 tw-px-3 tw-py-2 tw-text-sm tw-cursor-pointer hover:tw-bg-blue-gray-50 tw-transition-colors"
                        >
                            <input
                                type="checkbox"
                                checked={selected.includes(o.value)}
                                onChange={() => toggle(o.value)}
                                className="tw-mt-0.5 tw-h-4 tw-w-4 tw-cursor-pointer tw-accent-gray-900"
                            />
                            <span className="tw-text-blue-gray-800">{o[lang]}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};
