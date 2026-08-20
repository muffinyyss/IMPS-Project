"use client";

/**
 * การ์ดสรุปการซ่อม 1 รอบ — ใช้ร่วมกันทุกด่านของใบงาน CM
 *
 * ช่างซ่อมไม่จบในรอบเดียว (รออะไหล่ / รอหน้างาน) แล้วกลับมาซ่อมอีกรอบ รอบที่ปิดไป
 * ถูกเก็บไว้ที่ repair_history ส่วนรอบที่กำลังทำอยู่คงอยู่ใน flat fields ของใบงาน
 * หน้าที่แสดงใบงานจึงต้องเอาสองส่วนนี้มาต่อกัน ไม่งั้นจะเห็นแค่รอบสุดท้าย
 */

import React from "react";
import { type Lang } from "@/utils/useLanguage";
import { problemLabelOf, causeLabelOf } from "@/app/dashboard/cm-report/lib/maximo";
import { repairResultLabel } from "@/app/dashboard/cm-report/lib/repairResult";
import { ZoomableImg } from "@/app/dashboard/cm-report/components/photo-viewer";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type RepairRound = {
    // วันที่/เวลาที่ช่างเริ่มลงมือแก้ไขรอบนั้น (ไม่ใช่เวลาที่กดบันทึก)
    start_repair_date?: string;
    start_repair_time?: string;
    // วันที่/เวลาที่ปิดรอบนั้น = ตอนกดบันทึกเป็นสถานะรอ
    finish_date?: string;
    finish_time?: string;
    // ชื่อฟิลด์เดิม (เก็บ "เวลาที่กดบันทึก") — ความหมายตรงกับ finish ไม่ใช่ start
    saved_date?: string;
    saved_time?: string;
    repair_result?: string;
    repair_result_remark?: string;
    problem_type?: string[];
    problem_type_other?: string;
    cause?: string[];
    repaired_equipment?: string[];
    inprogress_remarks?: string;
    corrective_actions?: { code?: string; text?: string; beforeImages?: { url?: string }[]; afterImages?: { url?: string }[] }[];
    /**
     * ช่างที่ลงเวลากับ Maximo ของรอบนั้น — เก็บชื่อไว้ด้วย ไม่ได้เก็บแค่ laborcode
     * เพราะรายชื่อจาก IN08 เปลี่ยนได้ (ช่างลาออก/ย้ายหน่วย) ประวัติต้องอ่านได้เหมือนเดิม
     * ผู้รับเหมาที่ใช้รหัสกลาง จะเก็บชื่อจริงที่ช่างกรอกไว้ในช่อง name เลย
     *
     * ⚠️ ระดับใบงาน field ชื่อเดียวกันนี้เป็น string[] ของ laborcode ล้วน ๆ (IN09 อ่านตัวนั้น)
     *    ตัวนี้อยู่ในรอบซ่อม ใช้แสดงผลอย่างเดียว — services/cm_maximo.repair_rounds ไม่แตะ
     */
    maximo_labor?: { laborcode: string; name?: string }[];
};

const TEXT = {
    repairRound: { th: "รอบที่", en: "Repair round" },
    rrResult: { th: "ผลหลังซ่อม", en: "Repair result" },
    rrProblem: { th: "ปัญหา", en: "Problem" },
    rrCause: { th: "สาเหตุ", en: "Cause" },
    rrAction: { th: "การแก้ไข", en: "Corrective action" },
    rrEquipment: { th: "อุปกรณ์ที่ซ่อม", en: "Repaired equipment" },
    rrRemarks: { th: "หมายเหตุ", en: "Remarks" },
    rrBefore: { th: "รูปก่อนแก้ไข", en: "Before" },
    rrAfter: { th: "รูปหลังแก้ไข", en: "After" },
    rrStartedAt: { th: "วันที่เข้าแก้ไข", en: "Repair started" },
    rrFinishedAt: { th: "วันที่แก้ไขเสร็จ", en: "Repair finished" },
    rrLabor: { th: "ช่างที่ลงเวลากับ Maximo", en: "Technicians for Maximo time log" },
} as const;

const t = (key: keyof typeof TEXT, lang: Lang) => TEXT[key][lang === "en" ? "en" : "th"];

export default function RepairRoundCard({
    round, index, lang, title,
}: { round: RepairRound; index: number; lang: Lang; title?: string }) {
    const src = (u?: string) => (!u ? "" : u.startsWith("http") ? u : `${API_BASE}${u}`);
    const problems = [...(round.problem_type ?? []).map(problemLabelOf), round.problem_type_other ?? ""].map(x => (x || "").trim()).filter(Boolean);
    const causes = (round.cause ?? []).map(x => causeLabelOf((x || "").trim())).filter(Boolean);
    const equipment = (round.repaired_equipment ?? []).map(x => (x || "").trim()).filter(Boolean);
    const actions = (round.corrective_actions ?? []).filter(
        a => (a.text || "").trim() || (a.beforeImages?.length ?? 0) > 0 || (a.afterImages?.length ?? 0) > 0
    );
    const labor = (round.maximo_labor ?? []).filter(l => (l?.laborcode || "").trim());
    const startedAt = [round.start_repair_date, round.start_repair_time].filter(Boolean).join(" ");
    // saved_* ของข้อมูลเก่าคือเวลาที่กดบันทึก = เวลาปิดรอบ จึง fallback มาที่นี่
    const finishedAt = [round.finish_date || round.saved_date, round.finish_time || round.saved_time].filter(Boolean).join(" ");

    const block = (label: string, body: React.ReactNode) => (
        <div className="tw-mb-3 last:tw-mb-0">
            <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{label}</p>
            {body}
        </div>
    );
    const line = (v?: string) => <p className="tw-text-sm tw-text-blue-gray-800 tw-break-words">{v?.trim() ? v : "-"}</p>;
    const thumbs = (label: string, imgs: { url?: string }[]) =>
        imgs.length ? (
            <div className="tw-mt-2">
                <p className="tw-text-[11px] tw-text-blue-gray-400 tw-mb-1">{label}</p>
                <div className="tw-flex tw-flex-wrap tw-gap-2">
                    {imgs.map((im, k) => (
                        <a key={k} href={src(im.url)} target="_blank" rel="noreferrer"
                            className="tw-block tw-w-20 tw-h-20 tw-rounded-lg tw-overflow-hidden tw-border tw-border-gray-200 tw-bg-gray-50">
                            <ZoomableImg src={src(im.url)} alt={label} className="tw-w-full tw-h-full tw-object-cover" />
                        </a>
                    ))}
                </div>
            </div>
        ) : null;

    return (
        <div className="tw-mb-4 tw-p-4 tw-rounded-xl tw-border tw-border-gray-200 tw-bg-white">
            <h4 className="tw-text-sm tw-font-bold tw-text-blue-gray-700 tw-mb-3">
                {title ?? `${t("repairRound", lang)} ${index + 1}`}
            </h4>
            <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-3 tw-mb-3">
                <div>
                    <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{t("rrStartedAt", lang)}</p>
                    {line(startedAt)}
                </div>
                <div>
                    <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{t("rrFinishedAt", lang)}</p>
                    {line(finishedAt)}
                </div>
                <div>
                    <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{t("rrResult", lang)}</p>
                    {line(repairResultLabel(round.repair_result, lang))}
                </div>
                <div>
                    <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{t("rrRemarks", lang)}</p>
                    {line(round.repair_result_remark)}
                </div>
                {/* อุปกรณ์ที่ซ่อม — ไม่มีก็ไม่ต้องแสดงช่องนี้ */}
                {equipment.length > 0 && (
                    <div>
                        <p className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-mb-1">{t("rrEquipment", lang)}</p>
                        {line(equipment.join(", "))}
                    </div>
                )}
            </div>
            {/* ช่างที่ลงเวลาเข้า Maximo ของรอบนั้น — ใบเก่าที่บันทึกก่อนมีฟิลด์นี้จะไม่มีให้แสดง */}
            {labor.length ? block(t("rrLabor", lang),
                <div className="tw-flex tw-flex-wrap tw-gap-2">
                    {labor.map((l, i) => (
                        <span key={`${l.laborcode}-${i}`}
                            className="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-border tw-border-blue-200 tw-bg-blue-50 tw-px-3 tw-py-1 tw-text-xs tw-text-blue-800">
                            <span className="tw-font-medium">{(l.name || "").trim() || l.laborcode}</span>
                            <span className="tw-font-mono tw-text-[11px] tw-text-blue-400">{l.laborcode}</span>
                        </span>
                    ))}
                </div>) : null}
            {problems.length ? block(t("rrProblem", lang), line(problems.join(", "))) : null}
            {causes.length ? block(t("rrCause", lang), line(causes.join(", "))) : null}
            {actions.length ? block(t("rrAction", lang),
                <div className="tw-space-y-3">
                    {actions.map((a, i) => (
                        <div key={i} className="tw-rounded-lg tw-bg-gray-50 tw-border tw-border-gray-200 tw-p-3">
                            {(a.text || "").trim() && <p className="tw-text-sm tw-text-blue-gray-800 tw-break-words">{a.text}</p>}
                            {thumbs(t("rrBefore", lang), a.beforeImages ?? [])}
                            {thumbs(t("rrAfter", lang), a.afterImages ?? [])}
                        </div>
                    ))}
                </div>) : null}
            {(round.inprogress_remarks || "").trim() ? block(t("rrRemarks", lang), line(round.inprogress_remarks)) : null}
        </div>
    );
}
