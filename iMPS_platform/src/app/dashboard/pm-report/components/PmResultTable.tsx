"use client";

/**
 * ตารางผลการตรวจ PM ของทุกหัวข้อ — ใช้ในโหมดตรวจเพื่ออนุมัติ
 *
 * ผู้อนุมัติเห็นผลตรวจ หมายเหตุ และรูปของทุกข้อในตารางเดียว ไม่ต้องไล่ดูทีละหัวข้อในฟอร์ม
 * ข้อที่ใช้งานไม่ได้ถูกไฮไลต์ไว้ (สรุปผลแสดงแยกใต้ตาราง ไม่อยู่ในนี้)
 *
 * เดิมเป็นตารางเทียบ "ก่อน PM" กับ "หลัง PM" — ตัดด่าน Pre-PM ออกแล้ว เหลือแค่ผลหลัง PM
 */

import React from "react";
import type { Lang } from "@/utils/useLanguage";

export type ResultRow = {
  key: string;
  /** ชื่อหัวข้อใหญ่ที่แถวนี้อยู่ใต้ — ใช้ขึ้นแถบคั่นให้เหมือนหน้าฟอร์มกรอก */
  section?: string;
  /** เลขข้อหลัก — ใช้รวมรูปของทั้งข้อเข้าด้วยกันแบบเดียวกับ PDF */
  qNo?: number;
  label: string;
  pf?: string;
  remark?: string;
};

/** รูปที่เก็บใน document — key เป็นกลุ่มรูป (g16, g5_1) ค่าเป็นรายการรูปของกลุ่มนั้น */
export type PhotoMap = Record<string, { url?: string }[] | undefined>;

const T = {
  title: { th: "ผลการตรวจ PM", en: "PM inspection results" },
  hint: {
    th: "ผลการตรวจ หมายเหตุ และรูปของทุกหัวข้อ — ข้อที่ใช้งานไม่ได้ถูกไฮไลต์ไว้",
    en: "Rating, note and photos for every item — unusable items are highlighted",
  },
  item: { th: "หัวข้อ", en: "Item" },
  result: { th: "ผลการตรวจ", en: "Result" },
  na: { th: "ไม่เกี่ยวข้อง", en: "N/A" },
  veryGood: { th: "ดีมาก", en: "Excellent" },
  good: { th: "ดี", en: "Good" },
  fair: { th: "พอใช้", en: "Fair" },
  unusable: { th: "ใช้งานไม่ได้", en: "Unusable" },
  noPhoto: { th: "ไม่มีรูป", en: "No photo" },
  photos: { th: "รูปภาพอ้างอิง", en: "Reference photos" },
  empty: { th: "ยังไม่มีผลการตรวจ", en: "No results yet" },
} as const;

const t = (k: keyof typeof T, lang: Lang) => T[k][lang === "en" ? "en" : "th"];

function pfClass(pf?: string) {
  const v = String(pf ?? "").toUpperCase();
  if (v === "VERY_GOOD") return "tw-bg-green-100 tw-text-green-800";
  if (v === "GOOD") return "tw-bg-light-green-100 tw-text-light-green-800";
  if (v === "FAIR") return "tw-bg-amber-100 tw-text-amber-800";
  if (v === "UNUSABLE") return "tw-bg-red-100 tw-text-red-800";
  if (v === "PASS") return "tw-bg-green-100 tw-text-green-800";
  if (v === "FAIL") return "tw-bg-red-100 tw-text-red-800";
  if (v === "NA") return "tw-bg-gray-100 tw-text-gray-600";
  return "tw-bg-gray-50 tw-text-gray-400";
}

/** แถวรูปย่อของกลุ่มหนึ่ง — กดแล้วเปิดรูปเต็มในแท็บใหม่ */
function Thumbs({ items, apiBase, lang }: { items?: { url?: string }[]; apiBase: string; lang: Lang }) {
  const list = (items ?? []).filter((p) => p?.url);
  if (list.length === 0) {
    return <p className="tw-text-xs tw-text-blue-gray-300">{t("noPhoto", lang)}</p>;
  }
  const href = (u: string) => (u.startsWith("http") ? u : `${apiBase}${u}`);
  return (
    <div className="tw-flex tw-flex-wrap tw-gap-1.5">
      {list.map((p, i) => (
        <a key={`${p.url}-${i}`} href={href(p.url!)} target="_blank" rel="noopener noreferrer"
           className="tw-block tw-h-14 tw-w-14 tw-overflow-hidden tw-rounded tw-border tw-border-blue-gray-100 hover:tw-border-blue-400">
          {/* รูปจาก uploads ของ iMPS เอง ไม่ผ่าน next/image เพื่อเลี่ยง config domain */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={href(p.url!)} alt="" className="tw-h-full tw-w-full tw-object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}

/** ระดับผลการตรวจ/NA พร้อมหมายเหตุ */
function ResultCell({ pf, remark, lang }: { pf?: string; remark?: string; lang: Lang }) {
  const v = String(pf ?? "").trim().toUpperCase();
  const label = v === "VERY_GOOD" ? t("veryGood", lang)
    : v === "GOOD" ? t("good", lang)
    : v === "FAIR" ? t("fair", lang)
    : v === "UNUSABLE" ? t("unusable", lang)
    : v === "NA" ? t("na", lang)
    : v;
  return (
    <div className="tw-space-y-1">
      <span className={`tw-inline-block tw-rounded tw-px-2 tw-py-0.5 tw-text-xs tw-font-semibold ${pfClass(v)}`}>
        {label || "—"}
      </span>
      {remark?.trim() && (
        <p className="tw-text-xs tw-text-blue-gray-500 tw-break-words">{remark}</p>
      )}
    </div>
  );
}

export default function PmResultTable({
  rows, lang, photos, apiBase = "", photoKeysOf,
}: {
  rows: ResultRow[];
  lang: Lang;
  photos?: PhotoMap;
  apiBase?: string;
  /**
   * คีย์รูปของแถวนั้นใน photos
   *
   * ทั้ง 5 ฟอร์มตั้งคีย์รูปคนละสูตรกัน (บางอันยังคนละฐานกับคีย์คำตอบ) เดาจาก
   * ตรงนี้ไม่ได้ ให้ฟอร์มที่รู้สูตรของตัวเองส่งเข้ามา
   * คีย์ไหนไม่มีฟอร์มไหนอ้าง จะถูกยกไปรวมไว้ที่แถวรูปของข้อนั้นแทน ไม่หายไป
   */
  photoKeysOf?: (row: ResultRow) => string[];
}) {
  // จัดเป็นข้อใหญ่แบบเดียวกับ PDF: รูปเป็นของทั้งข้อ ไม่ใช่ของข้อย่อยรายตัว
  const groups = React.useMemo(() => {
    const out: { key: string; title: string; qNo?: number; items: ResultRow[] }[] = [];
    rows.forEach((r) => {
      const title = r.section?.trim() ?? "";
      const last = out[out.length - 1];
      if (last && last.title === title && last.qNo === r.qNo) last.items.push(r);
      else out.push({ key: `${title}#${r.key}`, title, qNo: r.qNo, items: [r] });
    });

    const pick = (keys: string[]) =>
      keys.flatMap((k) => (photos?.[k] ?? []).filter((p) => p?.url));

    return out
      .map((g) => {
        const claimed = new Set<string>();
        const items = g.items
          .map((r) => {
            const keys = photoKeysOf?.(r) ?? [];
            keys.forEach((k) => claimed.add(k));
            return { row: r, photos: pick(keys) };
          })
          // ข้อย่อยที่ไม่มีทั้งคำตอบ หมายเหตุ และรูป ไม่ต้องโชว์
          .filter(({ row, photos: ph }) => row.pf || row.remark?.trim() || ph.length > 0);

        // รูปที่ไม่มีแถวไหนอ้าง = ฟอร์มนั้นเก็บรูปไว้ระดับข้อ ไม่ได้แยกรายข้อย่อย
        const rest = Object.entries(photos ?? {})
          .filter(([k]) => !claimed.has(k) && Number(k.match(/\d+/)?.[0]) === g.qNo)
          .flatMap(([, v]) => (v ?? []).filter((p) => p?.url));

        return { ...g, items, photos: rest };
      })
      .filter((g) => g.items.length > 0 || g.photos.length > 0);
  }, [rows, photos, photoKeysOf]);

  return (
    <div className="tw-mx-auto tw-max-w-6xl tw-mb-6 tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm tw-overflow-hidden">
      <div className="tw-bg-gray-700 tw-px-4 tw-py-3 tw-text-white">
        <div className="tw-font-semibold tw-text-base">{t("title", lang)}</div>
        <div className="tw-text-xs tw-text-white/70 tw-mt-0.5">{t("hint", lang)}</div>
      </div>

      {groups.length === 0 ? (
        <p className="tw-px-4 tw-py-6 tw-text-center tw-text-sm tw-text-blue-gray-400">{t("empty", lang)}</p>
      ) : (
        <div className="tw-overflow-x-auto">
          <table className="tw-w-full tw-min-w-[480px] tw-text-left tw-text-sm">
            <thead>
              <tr className="tw-bg-blue-gray-50/60 tw-text-xs tw-font-semibold tw-uppercase tw-text-blue-gray-500">
                <th className="tw-px-4 tw-py-2.5">{t("item", lang)}</th>
                <th className="tw-px-4 tw-py-2.5 tw-w-[50%]">{t("result", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                // แถบคั่นหัวข้อใหญ่ หน้าตาเดียวกับ SectionCard ในฟอร์ม
                const secNo = g.title.match(/^(\d+)\)/)?.[1];
                return (
                  <React.Fragment key={g.key}>
                    {g.title && (
                      <tr>
                        <td colSpan={2} className="tw-bg-gray-800 tw-px-4 tw-py-2.5">
                          <div className="tw-flex tw-items-center tw-gap-3">
                            {secNo && (
                              <span className="tw-flex tw-h-7 tw-w-7 tw-flex-shrink-0 tw-items-center tw-justify-center tw-rounded-full tw-bg-white tw-text-xs tw-font-bold tw-text-gray-800">
                                {secNo}
                              </span>
                            )}
                            <span className="tw-text-sm tw-font-semibold tw-text-white">
                              {secNo ? g.title.replace(/^\d+\)\s*/, "") : g.title}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {g.photos.length > 0 && (
                      <tr className="tw-border-t tw-border-blue-gray-50 tw-bg-blue-gray-50/20">
                        <td className="tw-px-4 tw-py-2.5 tw-align-top tw-text-xs tw-font-semibold tw-text-blue-gray-500">
                          {t("photos", lang)}
                        </td>
                        <td className="tw-px-4 tw-py-2.5 tw-align-top">
                          <Thumbs items={g.photos} apiBase={apiBase} lang={lang} />
                        </td>
                      </tr>
                    )}

                    {g.items.map(({ row: r, photos: ph }) => {
                      // ใช้งานไม่ได้ = ข้อที่ต้องอ่านให้ละเอียดกว่าข้ออื่น
                      const status = String(r.pf ?? "").trim().toUpperCase();
                      const failed = status === "UNUSABLE" || status === "FAIL";
                      return (
                        <tr key={r.key} className={`tw-border-t tw-border-blue-gray-50 ${failed ? "tw-bg-red-50/60" : ""}`}>
                          <td className="tw-px-4 tw-py-2.5 tw-align-top tw-text-blue-gray-800">{r.label}</td>
                          <td className="tw-px-4 tw-py-2.5 tw-align-top tw-space-y-2">
                            <ResultCell pf={r.pf} remark={r.remark} lang={lang} />
                            {ph.length > 0 && <Thumbs items={ph} apiBase={apiBase} lang={lang} />}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
