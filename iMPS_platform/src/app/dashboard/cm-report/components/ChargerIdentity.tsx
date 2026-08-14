"use client";

/**
 * ตัวตนของตู้ชาร์จบนใบงาน CM — ชื่อตู้ / เลขตู้ / S/N / บริษัทที่ถือครอง (ยี่ห้อ)
 *
 * ใบงานอ้างถึงตู้ได้ 2 ทาง (charger_sn ของ auto CM หรือ faulty_equipment = "charger_N")
 * และใบที่เลือก failure class ระดับสถานีไม่ผูกกับตู้ใดตู้หนึ่ง — backend เป็นคน resolve
 * ให้แล้ว (routers/cmreport.py::_charger_identity) ที่นี่แค่แสดงผล
 *
 * ใบที่ไม่มีข้อมูลตู้เลยจะไม่เรนเดอร์อะไร — ดีกว่าโชว์การ์ดที่มีแต่ขีด
 */

export type ChargerIdentityData = {
  charger_name?: string;
  charger_no?: number | string | null;
  charger_sn?: string;
  charger_model?: string;
  /** ยี่ห้อ = บริษัทที่ถือครอง/ดูแลตู้ (EGAT, iMPS, FlexxFast…) */
  charger_brand?: string;
  auto_generated?: boolean;
};

const TEXT = {
  th: {
    title: "ข้อมูลตู้ชาร์จ",
    name: "ชื่อตู้ชาร์จ",
    no: "หมายเลขตู้",
    sn: "S/N",
    brand: "บริษัทผู้ถือครอง",
    auto: "ระบบเปิดอัตโนมัติ",
    stationLevel: "ใบงานระดับสถานี (ไม่ระบุตู้)",
  },
  en: {
    title: "Charger information",
    name: "Charger name",
    no: "Charger No.",
    sn: "S/N",
    brand: "Owning company",
    auto: "Auto-generated",
    stationLevel: "Station-level work order (no specific charger)",
  },
} as const;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="tw-min-w-0">
      <p className="tw-text-[11px] tw-uppercase tw-tracking-wide tw-text-blue-gray-400">{label}</p>
      <p className="tw-mt-0.5 tw-truncate tw-text-sm tw-font-semibold tw-text-blue-gray-800" title={value}>
        {value}
      </p>
    </div>
  );
}

export default function ChargerIdentity({
  data,
  lang = "th",
  className = "",
}: {
  data: ChargerIdentityData | null | undefined;
  lang?: "th" | "en";
  className?: string;
}) {
  const t = TEXT[lang] ?? TEXT.th;
  const name = (data?.charger_name || "").trim();
  const sn = (data?.charger_sn || "").trim();
  const brand = (data?.charger_brand || "").trim();
  const no = data?.charger_no;
  const noText = no === null || no === undefined || no === "" ? "" : String(no);

  // ไม่มีข้อมูลตู้เลย (และไม่รู้ยี่ห้อ) → ไม่ต้องขึ้นการ์ด
  if (!name && !sn && !brand && !noText) return null;

  const model = (data?.charger_model || "").trim();

  return (
    <div
      className={`tw-mb-6 tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-blue-gray-50/60 tw-px-4 tw-py-3 ${className}`}
    >
      <div className="tw-mb-2 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
        <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">{t.title}</span>
        {data?.auto_generated && (
          <span className="tw-rounded-full tw-bg-indigo-100 tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-indigo-700">
            {t.auto}
          </span>
        )}
        {!name && !sn && brand && (
          <span className="tw-text-[11px] tw-text-blue-gray-400">{t.stationLevel}</span>
        )}
      </div>
      <div className="tw-grid tw-grid-cols-2 tw-gap-x-4 tw-gap-y-3 md:tw-grid-cols-4">
        <Field label={t.name} value={name ? (model ? `${name} · ${model}` : name) : "-"} />
        <Field label={t.no} value={noText || "-"} />
        <Field label={t.sn} value={sn || "-"} />
        <Field label={t.brand} value={brand || "-"} />
      </div>
    </div>
  );
}
