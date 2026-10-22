"use client";

/**
 * หน้าต่างยืนยันก่อนกดปุ่มที่เปลี่ยนข้อมูลในหน้า PM — หน้าตาเดียวกับ modal ของหน้า CM
 * (overlay ดำโปร่ง + กล่องขาว max-w-md + ปุ่ม "กลับ" / "ยืนยัน…")
 *
 * ใช้ผ่าน hook:
 *   const { ask, dialog } = usePmConfirm(lang);
 *   <Button onClick={() => ask("save", onFinalSave)} />
 *   {dialog}
 * กดยืนยัน = ปิดหน้าต่างก่อนแล้วค่อยเรียก action (เหมือน CM: closeCommentModal(); onFinalSave())
 */

import React, { useCallback, useState } from "react";
import { Button } from "@material-tailwind/react";
import type { Lang } from "@/utils/useLanguage";

type Text = { th: string; en: string };
type Preset = { title: Text; body: Text; confirm: Text; color: string };

const COLOR = {
  dark: "tw-bg-gray-800 hover:tw-bg-blue-600",
  amber: "tw-bg-amber-600 hover:tw-bg-amber-700",
  green: "tw-bg-green-600 hover:tw-bg-green-700",
};

export const PM_CONFIRM = {
  /** ปุ่ม "บันทึก" ท้ายฟอร์มกรอก PM (สถานี / MDB / CCB / CB-Box / ตู้ชาร์จ) */
  saveReport: {
    title: { th: "บันทึกรายงาน PM", en: "Save PM report" },
    body: { th: "ยืนยันบันทึกรายงาน PM นี้?", en: "Save this PM report?" },
    confirm: { th: "ยืนยันบันทึก", en: "Confirm save" },
    color: COLOR.dark,
  },
  /** มอบหมายงานตามแผน (ผู้วางแผน / planner ของ vendor) */
  assign: {
    title: { th: "มอบหมายงาน", en: "Assign work order" },
    body: { th: "ยืนยันมอบหมายงานตามแผนนี้?", en: "Assign this work order as planned?" },
    confirm: { th: "ยืนยันมอบหมาย", en: "Confirm assign" },
    color: COLOR.amber,
  },
  /** เปิดโหมดแก้ไขแผนที่ Assign ไปแล้ว (ปุ่ม "แก้ไขแผน" / "แก้ไขแผนของบริษัทคุณ") */
  editPlan: {
    title: { th: "แก้ไขแผน", en: "Edit plan" },
    body: {
      th: "ยืนยันแก้ไขแผนงานนี้? แก้เสร็จแล้วกด \"บันทึกการแก้ไข\" เพื่อบันทึก หรือ \"ยกเลิก\" เพื่อกลับไปใช้แผนเดิม",
      en: "Edit this plan? Press \"Save changes\" when done, or \"Cancel\" to keep the current plan.",
    },
    confirm: { th: "ยืนยันแก้ไข", en: "Confirm edit" },
    color: COLOR.dark,
  },
  /** บันทึกการแก้ไขแผนที่ Assign ไปแล้ว */
  saveEdit: {
    title: { th: "บันทึกการแก้ไข", en: "Save changes" },
    body: { th: "ยืนยันบันทึกการแก้ไขแผนงาน?", en: "Save changes to this plan?" },
    confirm: { th: "ยืนยันบันทึก", en: "Confirm save" },
    color: COLOR.dark,
  },
  /** เปิดใบงานใหม่ (ไม่มีใบจาก Maximo มาก่อน) */
  createWo: {
    title: { th: "เปิดใบงานใหม่", en: "New work order" },
    body: { th: "ยืนยันเปิดใบงานและมอบหมายงานตามแผนนี้?", en: "Create this work order and assign it as planned?" },
    confirm: { th: "ยืนยันเปิดใบงาน", en: "Confirm create" },
    color: COLOR.amber,
  },
  /** ช่างกดเริ่ม PM จากใบงาน */
  startPm: {
    title: { th: "เริ่ม PM", en: "Start PM" },
    body: { th: "ยืนยันเริ่มงาน PM ของใบงานนี้?", en: "Start PM for this work order?" },
    confirm: { th: "ยืนยันเริ่มงาน", en: "Confirm start" },
    color: COLOR.amber,
  },
  /** อนุมัติทั้งใบ (หน้ารวมใบ PM สถานี) */
  approveJob: {
    title: { th: "อนุมัติใบงาน", en: "Approve work order" },
    body: { th: "ยืนยันอนุมัติทั้งใบ? ใบงานจะเข้าสถานะ Closed", en: "Approve the whole document? It will move to Closed." },
    confirm: { th: "ยืนยันอนุมัติ", en: "Confirm approve" },
    color: COLOR.green,
  },
  /** ส่งชุดปิดงานเข้า Maximo ใหม่ */
  maximoResync: {
    title: { th: "ส่งเข้า Maximo ใหม่", en: "Resend to Maximo" },
    body: { th: "ยืนยันส่งข้อมูลปิดงานของใบนี้เข้า Maximo อีกครั้ง?", en: "Resend this work order's close-out to Maximo?" },
    confirm: { th: "ยืนยันส่ง", en: "Confirm send" },
    color: COLOR.dark,
  },
} satisfies Record<string, Preset>;

export type PmConfirmKind = keyof typeof PM_CONFIRM;

const BACK: Text = { th: "กลับ", en: "Back" };
const pick = (x: Text, lang: Lang) => x[lang === "en" ? "en" : "th"];

type Pending = { kind: PmConfirmKind; run: () => unknown };

export function usePmConfirm(lang: Lang) {
  const [pending, setPending] = useState<Pending | null>(null);

  /** เปิดหน้าต่างยืนยัน — กดยืนยันแล้วค่อยเรียก run */
  const ask = useCallback((kind: PmConfirmKind, run: () => unknown) => {
    setPending({ kind, run });
  }, []);

  const close = () => setPending(null);
  const confirm = () => {
    if (!pending) return;
    const { run } = pending;
    setPending(null);
    void run();
  };

  const p = pending ? PM_CONFIRM[pending.kind] : null;
  const dialog = p ? (
    <div
      className="tw-fixed tw-inset-0 tw-z-[9999] tw-flex tw-items-center tw-justify-center tw-bg-black/40 tw-p-4"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="tw-w-full tw-max-w-md tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="tw-text-lg tw-font-bold tw-text-blue-gray-800 tw-mb-3">{pick(p.title, lang)}</h3>
        <p className="tw-text-sm tw-text-blue-gray-600">{pick(p.body, lang)}</p>
        <div className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-pt-4">
          <Button type="button" variant="outlined" onClick={close} className="tw-border-blue-gray-200 tw-text-blue-gray-700">
            {pick(BACK, lang)}
          </Button>
          <Button type="button" onClick={confirm} className={`tw-text-white ${p.color}`}>
            {pick(p.confirm, lang)}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, dialog };
}
