"use client";

/**
 * ตารางเทียบผลตรวจ "ก่อน PM" กับ "หลัง PM" ของหัวข้อเดียวกัน
 *
 * ใช้ในโหมดตรวจเพื่ออนุมัติ — เดิมผู้อนุมัติต้องสลับแท็บไปมาแล้วจำเอาเองว่า
 * ข้อไหนก่อนเป็นอะไร หลังเป็นอะไร ตารางนี้วางคู่กันให้เห็นในบรรทัดเดียว
 * และไฮไลต์ข้อที่ผลเปลี่ยน (เช่น FAIL → PASS หรือแย่ลง)
 */

import React from "react";
import type { Lang } from "@/utils/useLanguage";

export type CompareRow = {
  key: string;
  label: string;
  prePf?: string;
  preRemark?: string;
  postPf?: string;
  postRemark?: string;
};

const T = {
  title: { th: "เทียบผลก่อน / หลัง PM", en: "Before / after PM comparison" },
  hint: {
    th: "แถวที่ผลเปลี่ยนจะถูกไฮไลต์ไว้ — ข้อที่ยังไม่ได้ตอบจะขึ้นเป็น “—”",
    en: "Rows where the result changed are highlighted — unanswered items show “—”",
  },
  item: { th: "หัวข้อ", en: "Item" },
  before: { th: "ก่อน PM", en: "Before PM" },
  after: { th: "หลัง PM", en: "After PM" },
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

function Pf({ pf, remark }: { pf?: string; remark?: string }) {
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
  rows, lang, summaryPre, summaryPost,
}: {
  rows: CompareRow[];
  lang: Lang;
  summaryPre?: string;
  summaryPost?: string;
}) {
  const shown = rows.filter((r) => r.prePf || r.postPf || r.preRemark || r.postRemark);

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
                <th className="tw-px-4 tw-py-2.5 tw-w-[28%]">{t("before", lang)}</th>
                <th className="tw-px-4 tw-py-2.5 tw-w-[28%]">{t("after", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                // ผลเปลี่ยน = ต้องอ่านให้ละเอียดกว่าข้ออื่น
                const changed =
                  String(r.prePf ?? "").toUpperCase() !== String(r.postPf ?? "").toUpperCase();
                return (
                  <tr key={r.key} className={`tw-border-t tw-border-blue-gray-50 ${changed ? "tw-bg-amber-50/60" : ""}`}>
                    <td className="tw-px-4 tw-py-2.5 tw-text-blue-gray-800">{r.label}</td>
                    <td className="tw-px-4 tw-py-2.5"><Pf pf={r.prePf} remark={r.preRemark} /></td>
                    <td className="tw-px-4 tw-py-2.5"><Pf pf={r.postPf} remark={r.postRemark} /></td>
                  </tr>
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
