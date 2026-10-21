"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/utils/api";
import { Input } from "@material-tailwind/react";

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

/** พิกัดสถานี — รับข้อความแบบที่คัดลอกจาก Google Maps ได้ตรงๆ เช่น "13.7563, 100.5018"
 *  ว่าง → null ทั้งคู่ (ไม่มีพิกัด) · รูปแบบผิด/เกินช่วง → undefined */
export function parseLatLng(text: string): { latitude: number | null; longitude: number | null } | undefined {
    const s = (text ?? "").trim();
    if (!s) return { latitude: null, longitude: null };
    const m = s.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return undefined;
    const latitude = Number(m[1]);
    const longitude = Number(m[2]);
    if (!(latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180)) return undefined;
    return { latitude, longitude };
}

export const formatLatLng = (lat?: number | null, lng?: number | null) =>
    lat != null && lng != null ? `${lat}, ${lng}` : "";

/** ช่องกรอกพิกัด + บอกว่ารูปแบบผิด / ลิงก์ไปเช็กตำแหน่งบน Google Maps */
export const LatLngInput = ({ value, onChange, lang, disabled = false }: {
    value: string;
    onChange: (next: string) => void;
    lang: "th" | "en";
    disabled?: boolean;
}) => {
    const parsed = parseLatLng(value);
    const tr = lang === "th"
        ? { label: "พิกัด (ละติจูด, ลองจิจูด)", invalid: "รูปแบบไม่ถูกต้อง — ตัวอย่าง 13.7563, 100.5018", open: "ดูตำแหน่งบน Google Maps", hint: "คัดลอกพิกัดจาก Google Maps มาวางได้เลย" }
        : { label: "Coordinates (lat, lng)", invalid: "Invalid format — e.g. 13.7563, 100.5018", open: "View on Google Maps", hint: "Paste coordinates copied from Google Maps" };
    return (
        <div className="tw-flex tw-flex-col tw-gap-1">
            <Input
                label={tr.label}
                value={value}
                disabled={disabled}
                error={parsed === undefined}
                inputMode="decimal"
                onChange={(e) => onChange(e.target.value)}
                crossOrigin={undefined}
            />
            <span className={`tw-text-[11px] tw-leading-tight ${parsed === undefined ? "tw-text-red-500" : "tw-text-blue-gray-400"}`}>
                {parsed === undefined
                    ? tr.invalid
                    : parsed.latitude != null
                        ? <a href={`https://www.google.com/maps?q=${parsed.latitude},${parsed.longitude}`} target="_blank" rel="noopener noreferrer" className="tw-text-blue-600 hover:tw-underline">📍 {tr.open}</a>
                        : tr.hint}
            </span>
        </div>
    );
};

export const labelOf = (
    options: readonly { value: string; th: string; en: string }[],
    value: string,
    lang: "th" | "en"
) => options.find((o) => o.value === value)?.[lang] ?? value;

/** dropdown แบบเลือกได้หลายอัน (checkbox) หน้าตาเข้าชุดกับ Material Tailwind Select */
export const MultiSelectDropdown = ({ label, options, selected, onChange, lang, emptyLabel, disabled = false }: {
    label: string;
    options: readonly { value: string; th: string; en: string }[];
    selected: string[];
    onChange: (next: string[]) => void;
    lang: "th" | "en";
    emptyLabel: string;
    disabled?: boolean;
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
                onClick={() => !disabled && setOpen((o) => !o)}
                disabled={disabled}
                className="tw-peer tw-w-full tw-h-full tw-bg-transparent tw-text-blue-gray-700 tw-font-sans tw-font-normal tw-outline-none tw-border tw-border-blue-gray-200 focus:tw-border-2 focus:tw-border-gray-900 tw-rounded-[7px] tw-px-3 tw-py-2.5 tw-text-sm tw-text-left tw-truncate disabled:tw-bg-gray-100 disabled:tw-cursor-not-allowed tw-cursor-pointer"
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
            {open && !disabled && (
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

// ─── Vendor ของตู้ชาร์จ ─────────────────────────────────────────────────────

/** vendor 1 ราย จากเมนู Company (type=vendor) — brands ไว้โชว์เป็นคำใบ้ว่าดูแลยี่ห้ออะไร */
export type VendorOption = { name: string; brands: string[] };

// ฟอร์มเพิ่มสถานี / เพิ่มตู้ / แก้ตู้ ใช้ลิสต์เดียวกัน — ถามครั้งเดียวต่อการโหลดหน้า
let vendorOptionsPromise: Promise<VendorOption[]> | null = null;

function loadVendorOptions(): Promise<VendorOption[]> {
    if (!vendorOptionsPromise) {
        vendorOptionsPromise = (async () => {
            const res = await apiFetch(`/companies/vendor-options`);
            if (!res.ok) throw new Error(`vendor-options ${res.status}`);
            const json = await res.json();
            return Array.isArray(json?.vendors) ? (json.vendors as VendorOption[]) : [];
        })().catch((e) => {
            vendorOptionsPromise = null; // พังแล้วเปิดฟอร์มใหม่ให้ลองถามอีกรอบ
            console.error("Failed to fetch vendor options:", e);
            return [];
        });
    }
    return vendorOptionsPromise;
}

export function useVendorOptions() {
    const [options, setOptions] = useState<VendorOption[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        loadVendorOptions().then((list) => {
            if (!cancelled) { setOptions(list); setLoading(false); }
        });
        return () => { cancelled = true; };
    }, []);
    return { options, loading };
}

/**
 * dropdown เลือก Vendor ของตู้ชาร์จ — แทนช่องพิมพ์อิสระเดิม ชื่อจะได้ตรงกับเมนู Company
 * (ใช้แบ่งงาน PM ระหว่าง EGAT / vendor ต่อ ต้องเทียบชื่อได้ตรง)
 *
 * ตู้เก่าที่พิมพ์ชื่อไว้ไม่ตรงกับลิสต์ ยังโชว์ค่าเดิมไว้ (ติดป้าย "ไม่อยู่ในรายชื่อ") ไม่หายไปเอง
 * จนกว่าจะเลือกใหม่ ค่าที่ส่งกลับเป็นชื่อตามที่สะกดในเมนู Company
 */
export const VendorSelect = ({ label, value, onChange, lang, disabled = false }: {
    label: string;
    value: string;
    onChange: (next: string) => void;
    lang: "th" | "en";
    disabled?: boolean;
}) => {
    const { options, loading } = useVendorOptions();
    const [open, setOpen] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    const current = (value || "").trim();
    const matched = options.find((o) => o.name.toLowerCase() === current.toLowerCase());
    const legacy = !!current && !loading && !matched;

    const txt = lang === "th"
        ? { none: "ไม่ระบุ", loading: "กำลังโหลด...", legacy: "ไม่อยู่ในรายชื่อ", empty: "ยังไม่มี vendor — เพิ่มได้ที่เมนู Company" }
        : { none: "Not specified", loading: "Loading...", legacy: "not in list", empty: "No vendors yet — add them in the Company menu" };

    const pick = (next: string) => { onChange(next); setOpen(false); };
    const shown = matched ? matched.name : current;

    return (
        <div className="tw-relative tw-w-full" ref={boxRef}>
            <button
                type="button"
                onClick={() => !disabled && setOpen((o) => !o)}
                disabled={disabled}
                className="tw-peer tw-w-full tw-h-10 tw-bg-transparent tw-text-blue-gray-700 tw-font-sans tw-font-normal tw-outline-none tw-border tw-border-blue-gray-200 focus:tw-border-2 focus:tw-border-gray-900 tw-rounded-[7px] tw-pl-3 tw-pr-8 tw-py-2.5 tw-text-sm tw-text-left tw-truncate disabled:tw-bg-gray-100 disabled:tw-cursor-not-allowed tw-cursor-pointer"
            >
                {shown ? (
                    <span>
                        {shown}
                        {legacy && <span className="tw-ml-2 tw-text-[11px] tw-text-amber-700">({txt.legacy})</span>}
                    </span>
                ) : (
                    <span className="tw-text-blue-gray-300">{loading ? txt.loading : txt.none}</span>
                )}
            </button>
            <div className="tw-pointer-events-none tw-absolute tw-inset-y-0 tw-right-3 tw-flex tw-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="tw-h-4 tw-w-4 tw-text-blue-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </div>
            <label className="tw-pointer-events-none tw-absolute tw-left-3 tw--top-1.5 tw-text-[11px] tw-text-blue-gray-400 tw-bg-white tw-px-1 tw-font-normal">
                {label}
            </label>
            {open && !disabled && (
                <div className="tw-absolute tw-z-[10000] tw-mt-1 tw-w-full tw-max-h-64 tw-overflow-y-auto tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-xl tw-py-1">
                    <button type="button" onClick={() => pick("")}
                        className={`tw-block tw-w-full tw-text-left tw-px-3 tw-py-2 tw-text-sm hover:tw-bg-blue-gray-50 ${!current ? "tw-font-semibold tw-text-gray-900" : "tw-text-blue-gray-400"}`}>
                        {txt.none}
                    </button>
                    {legacy && (
                        <button type="button" onClick={() => pick(current)}
                            className="tw-block tw-w-full tw-text-left tw-px-3 tw-py-2 tw-text-sm tw-font-semibold tw-text-gray-900 hover:tw-bg-blue-gray-50">
                            {current} <span className="tw-text-[11px] tw-font-normal tw-text-amber-700">({txt.legacy})</span>
                        </button>
                    )}
                    {loading && <div className="tw-px-3 tw-py-2 tw-text-sm tw-text-blue-gray-400">{txt.loading}</div>}
                    {!loading && options.length === 0 && <div className="tw-px-3 tw-py-2 tw-text-xs tw-text-blue-gray-400">{txt.empty}</div>}
                    {options.map((o) => {
                        const active = !!matched && matched.name === o.name;
                        return (
                            <button key={o.name} type="button" onClick={() => pick(o.name)}
                                className={`tw-block tw-w-full tw-text-left tw-px-3 tw-py-2 tw-text-sm hover:tw-bg-blue-gray-50 ${active ? "tw-font-semibold tw-text-gray-900 tw-bg-blue-gray-50" : "tw-text-blue-gray-800"}`}>
                                {o.name}
                                {o.brands.length > 0 && (
                                    <span className="tw-ml-2 tw-text-[11px] tw-font-normal tw-text-blue-gray-400">{o.brands.join(", ")}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
