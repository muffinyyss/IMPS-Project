"use client";

/**
 * ตารางเทียบผลตรวจ "ก่อน PM" กับ "หลัง PM" ของหัวข้อเดียวกัน
 *
 * ใช้ในโหมดตรวจเพื่ออนุมัติ — เดิมผู้อนุมัติต้องสลับแท็บไปมาแล้วจำเอาเองว่า
 * ข้อไหนก่อนกรอกอะไร หลังกรอกอะไร ตารางนี้วางคู่กันในบรรทัดเดียว
 *
 * โครงข้อมูลสองฝั่งไม่เหมือนกัน:
 *   ก่อน PM  = รูป + หมายเหตุ (ไม่มี PASS/FAIL — มีได้แค่ NA ว่าไม่เกี่ยวข้อง)
 *   หลัง PM  = รูป + หมายเหตุ + PASS/FAIL
 * จึงไม่เทียบ pf สองฝั่งกัน แต่ไฮไลต์ข้อที่หลัง PM เป็น FAIL ให้เห็นชัดแทน
 */

import React from "react";
import type { Lang } from "@/utils/useLanguage";

export type CompareRow = {
  key: string;
  /** ชื่อหัวข้อใหญ่ที่แถวนี้อยู่ใต้ — ใช้ขึ้นแถบคั่นให้เหมือนหน้าฟอร์มกรอก */
  section?: string;
  label: string;
  prePf?: string;
  preRemark?: string;
  postPf?: string;
  postRemark?: string;
};

/** รูปที่เก็บใน document — key เป็นกลุ่มรูป (g16, g5_1) ค่าเป็นรายการรูปของกลุ่มนั้น */
export type PhotoMap = Record<string, { url?: string }[] | undefined>;

/** คีย์คำตอบ (r16) → คีย์กลุ่มรูป (g16) — ใช้สูตรเดียวกับตอนอัปโหลด */
function photoGroupOf(rowKey: string) {
  return rowKey.replace(/^r/, "g");
}

const T = {
  title: { th: "เทียบผลก่อน / หลัง PM", en: "Before / after PM comparison" },
  hint: {
    th: "ก่อน PM มีแค่หมายเหตุกับรูป · หลัง PM ถึงมีผล PASS/FAIL — ข้อที่ผลเป็น FAIL ถูกไฮไลต์ไว้",
    en: "Before PM has notes and photos only · PASS/FAIL comes after PM — failed items are highlighted",
  },
  item: { th: "หัวข้อ", en: "Item" },
  before: { th: "ก่อน PM (รูป + หมายเหตุ)", en: "Before PM (photos + notes)" },
  after: { th: "หลัง PM (ผล + รูป + หมายเหตุ)", en: "After PM (result + photos + notes)" },
  na: { th: "ไม่เกี่ยวข้อง", en: "N/A" },
  noPhoto: { th: "ไม่มีรูป", en: "No photo" },
  noNote: { th: "ไม่มีหมายเหตุ", en: "No note" },
  summary: { th: "สรุปผล", en: "Summary" },
  empty: { th: "ยังไม่มีข้อมูลให้เทียบ", en: "Nothing to compare yet" },
} as const;

const t = (k: keyof typeof T, lang: Lang) => T[k][lang === "en" ? "en" : "th"];

function pfClass(pf?: string) {
  const v = String(pf ?? "").toUpperCase();
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

/** ฝั่งก่อน PM — ไม่มี PASS/FAIL มีแต่หมายเหตุ (NA = ทำเครื่องหมายว่าไม่เกี่ยวข้อง) */
function BeforeCell({ pf, remark, lang }: { pf?: string; remark?: string; lang: Lang }) {
  const isNA = String(pf ?? "").trim().toUpperCase() === "NA";
  return (
    <div className="tw-space-y-1">
      {isNA && (
        <span className="tw-inline-block tw-rounded tw-bg-gray-100 tw-px-2 tw-py-0.5 tw-text-xs tw-font-semibold tw-text-gray-600">
          {t("na", lang)}
        </span>
      )}
      <p className={`tw-text-xs tw-break-words ${remark?.trim() ? "tw-text-blue-gray-600" : "tw-text-blue-gray-300"}`}>
        {remark?.trim() || t("noNote", lang)}
      </p>
    </div>
  );
}

/** ฝั่งหลัง PM — มีผล PASS/FAIL/NA พร้อมหมายเหตุ */
function AfterCell({ pf, remark }: { pf?: string; remark?: string }) {
  const v = String(pf ?? "").trim();
  return (
    <div className="tw-space-y-1">
      <span className={`tw-inline-block tw-rounded tw-px-2 tw-py-0.5 tw-text-xs tw-font-semibold ${pfClass(v)}`}>
        {v || "—"}
      </span>
      {remark?.trim() && (
        <p className="tw-text-xs tw-text-blue-gray-500 tw-break-words">{remark}</p>
      )}
    </div>
  );
}

export default function PmCompareTable({
  rows, lang, summaryPre, summaryPost, prePhotos, postPhotos, apiBase = "",
}: {
  rows: CompareRow[];
  lang: Lang;
  summaryPre?: string;
  summaryPost?: string;
  prePhotos?: PhotoMap;
  postPhotos?: PhotoMap;
  apiBase?: string;
}) {
  // ฝั่งก่อน PM ไม่มี pf จึงต้องดูหมายเหตุด้วย ไม่งั้นข้อที่ช่างจดไว้ก่อนทำจะหายไป
  const shown = rows.filter((r) => {
    const g = photoGroupOf(r.key);
    return r.prePf || r.postPf || r.preRemark?.trim() || r.postRemark?.trim()
      || (prePhotos?.[g]?.length ?? 0) > 0 || (postPhotos?.[g]?.length ?? 0) > 0;
  });

  return (
    <div className="tw-mx-auto tw-max-w-6xl tw-mb-6 tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm tw-overflow-hidden">
      <div className="tw-bg-gray-700 tw-px-4 tw-py-3 tw-text-white">
        <div className="tw-font-semibold tw-text-base">{t("title", lang)}</div>
        <div className="tw-text-xs tw-text-white/70 tw-mt-0.5">{t("hint", lang)}</div>
      </div>


      {shown.length === 0 ? (
        <p className="tw-px-4 tw-py-6 tw-text-center tw-text-sm tw-text-blue-gray-400">{t("empty", lang)}</p>
      ) : (
        <div className="tw-overflow-x-auto">
          <table className="tw-w-full tw-min-w-[640px] tw-text-left tw-text-sm">
            <thead>
              <tr className="tw-bg-blue-gray-50/60 tw-text-xs tw-font-semibold tw-uppercase tw-text-blue-gray-500">
                <th className="tw-px-4 tw-py-2.5">{t("item", lang)}</th>
                <th className="tw-px-4 tw-py-2.5 tw-w-[34%]">{t("before", lang)}</th>
                <th className="tw-px-4 tw-py-2.5 tw-w-[34%]">{t("after", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, idx) => {
                // แถบคั่นหัวข้อใหญ่ — ขึ้นเมื่อเปลี่ยนหัวข้อ หน้าตาเดียวกับ SectionCard ในฟอร์ม
                const section = r.section?.trim();
                const newSection = !!section && section !== shown[idx - 1]?.section?.trim();
                const secNo = section?.match(/^(\d+)\)/)?.[1];
                // FAIL = ข้อที่ยังไม่ผ่านหลังทำ PM ต้องอ่านให้ละเอียดกว่าข้ออื่น
                const failed = String(r.postPf ?? "").trim().toUpperCase() === "FAIL";
                return (
                  <React.Fragment key={r.key}>
                  {newSection && (
                    <tr>
                      <td colSpan={3} className="tw-bg-gray-800 tw-px-4 tw-py-2.5">
                        <div className="tw-flex tw-items-center tw-gap-3">
                          {secNo && (
                            <span className="tw-flex tw-h-7 tw-w-7 tw-flex-shrink-0 tw-items-center tw-justify-center tw-rounded-full tw-bg-white tw-text-xs tw-font-bold tw-text-gray-800">
                              {secNo}
                            </span>
                          )}
                          <span className="tw-text-sm tw-font-semibold tw-text-white">
                            {secNo ? section!.replace(/^\d+\)\s*/, "") : section}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr className={`tw-border-t tw-border-blue-gray-50 ${failed ? "tw-bg-red-50/60" : ""}`}>
                    <td className="tw-px-4 tw-py-2.5 tw-text-blue-gray-800">{r.label}</td>
                    <td className="tw-px-4 tw-py-2.5 tw-align-top tw-space-y-2">
                      <BeforeCell pf={r.prePf} remark={r.preRemark} lang={lang} />
                      <Thumbs items={prePhotos?.[photoGroupOf(r.key)]} apiBase={apiBase} lang={lang} />
                    </td>
                    <td className="tw-px-4 tw-py-2.5 tw-align-top tw-space-y-2">
                      <AfterCell pf={r.postPf} remark={r.postRemark} />
                      <Thumbs items={postPhotos?.[photoGroupOf(r.key)]} apiBase={apiBase} lang={lang} />
                    </td>
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(summaryPre?.trim() || summaryPost?.trim()) && (
        <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4 tw-border-t tw-border-blue-gray-100 tw-p-4">
          <div>
            <div className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">
              {t("summary", lang)} — {t("before", lang)}
            </div>
            <div className="tw-rounded-lg tw-bg-gray-50 tw-px-3 tw-py-2 tw-text-sm tw-text-blue-gray-700 tw-whitespace-pre-wrap">
              {summaryPre?.trim() || "—"}
            </div>
          </div>
          <div>
            <div className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">
              {t("summary", lang)} — {t("after", lang)}
            </div>
            <div className="tw-rounded-lg tw-bg-gray-50 tw-px-3 tw-py-2 tw-text-sm tw-text-blue-gray-700 tw-whitespace-pre-wrap">
              {summaryPost?.trim() || "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
