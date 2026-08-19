"use client";

/**
 * แถบอนุมัติ/ตีกลับใบงาน PM ที่ planner เห็นตอนเปิดเอกสารที่ช่างส่งมา
 *
 * ใช้ในฟอร์ม PM ทั้ง 5 ชนิด — เปิดด้วย ?approve=1 จากตาราง/หน้า PM List
 * ผู้อนุมัติจะได้เห็นข้อมูลที่ช่างกรอกมาทั้งหมดก่อนตัดสินใจ (ต่างจากเดิม
 * ที่กดอนุมัติจากปุ่มในตารางโดยไม่เห็นเนื้อใบงาน)
 *
 * approve → สถานะเป็น Closed แล้ว backend ยิง Maximo ต่อตามลำดับ
 *           IN03 → IN09 → IN02 (COMP) — และจะยิงก็ต่อเมื่อกรอกครบทุกอุปกรณ์
 *           ที่ planner เลือกไว้ในใบงานนั้น
 */

import React, { useState } from "react";
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader, Input } from "@material-tailwind/react";
import { apiFetch } from "@/utils/api";
import { useLanguage, type Lang } from "@/utils/useLanguage";

const T = {
  reviewing: {
    th: "กำลังตรวจใบงานที่ช่างส่งมา — อนุมัติแล้วจะปิดงานและส่งข้อมูลเข้า Maximo",
    en: "Reviewing the technician's submission — approving closes the job and pushes it to Maximo",
  },
  approve: { th: "อนุมัติ", en: "Approve" },
  reject: { th: "ตีกลับ", en: "Reject" },
  approveTitle: { th: "อนุมัติปิดใบงาน PM", en: "Approve and close PM work order" },
  approveConfirm: { th: "ยืนยันอนุมัติปิดใบงานนี้หรือไม่?", en: "Close this work order?" },
  rejectTitle: { th: "ตีกลับใบงานให้ช่างแก้", en: "Send back to technician" },
  rejectRemarkLabel: { th: "เหตุผลที่ตีกลับ", en: "Reason" },
  rejectRemarkRequired: { th: "กรุณาระบุเหตุผลที่ตีกลับ", en: "A reason is required" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  confirm: { th: "ยืนยัน", en: "Confirm" },
  approved: { th: "อนุมัติปิดใบงานแล้ว", en: "Work order closed" },
  rejected: { th: "ตีกลับใบงานให้ช่างแล้ว", en: "Sent back to technician" },
  // ปิดเอกสารได้ แต่ยังไม่ยิง Maximo เพราะอุปกรณ์ตัวอื่นในใบงานเดียวกันยังไม่เสร็จ
  waitingOthers: {
    th: "ปิดเอกสารนี้แล้ว แต่ยังไม่ส่งเข้า Maximo — รออุปกรณ์ที่เหลือในใบงานเดียวกัน:",
    en: "Closed, but not sent to Maximo yet — waiting for the rest of this work order:",
  },
  failed: { th: "ทำรายการไม่สำเร็จ:", en: "Action failed:" },
} as const;

const t = (key: keyof typeof T, lang: Lang) => T[key][lang === "en" ? "en" : "th"];

type Props = {
  /** prefix ของ endpoint เช่น "pmreport" | "mdbpmreport" */
  prefix: string;
  reportId: string;
  /** charger ส่ง sn, ชนิดอื่นส่ง station_id */
  scope: { sn?: string | null; station_id?: string | null };
  apiBase: string;
  onDone: (message: string) => void;
};

export default function PmApprovalBar({ prefix, reportId, scope, apiBase, onDone }: Props) {
  const { lang } = useLanguage();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const qs = scope.sn
    ? `sn=${encodeURIComponent(scope.sn)}`
    : `station_id=${encodeURIComponent(scope.station_id ?? "")}`;

  const call = async (action: "approve" | "reject") => {
    if (busy || !reportId) return;
    if (action === "reject" && !remark.trim()) {
      setError(t("rejectRemarkRequired", lang));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(
        `${apiBase}/${prefix}/${encodeURIComponent(reportId)}/${action}?${qs}`,
        {
          method: "POST",
          credentials: "include",
          ...(action === "reject"
            ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remark: remark.trim() }) }
            : {}),
        }
      );
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(j?.detail || `HTTP ${res.status}`);

      if (action === "reject") {
        onDone(t("rejected", lang));
        return;
      }
      // อนุมัติแล้วแต่ยังไม่ครบทุกอุปกรณ์ — บอกให้ชัดว่าค้างตัวไหน
      const missing: string[] = j?.progress?.missing ?? [];
      onDone(
        j?.progress && j.progress.complete === false
          ? `${t("waitingOthers", lang)} ${missing.join(", ")}`
          : t("approved", lang)
      );
    } catch (e: any) {
      setError(`${t("failed", lang)} ${e?.message ?? e}`);
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="sm" color="amber" variant="outlined" disabled={busy}
        onClick={() => { setRemark(""); setError(""); setRejectOpen(true); }}
        className="tw-normal-case"
      >
        {t("reject", lang)}
      </Button>
      <Button
        size="sm" color="green" disabled={busy}
        onClick={() => { setError(""); setApproveOpen(true); }}
        className="tw-normal-case"
      >
        {t("approve", lang)}
      </Button>

      <Dialog open={approveOpen} handler={() => setApproveOpen(false)} size="xs">
        <DialogHeader className="tw-text-base tw-font-semibold">{t("approveTitle", lang)}</DialogHeader>
        <DialogBody className="tw-space-y-2 tw-text-sm">
          <p className="tw-text-blue-gray-700">{t("approveConfirm", lang)}</p>
          <p className="tw-text-xs tw-text-blue-gray-500">{t("reviewing", lang)}</p>
          {error && <p className="tw-text-xs tw-text-red-600">{error}</p>}
        </DialogBody>
        <DialogFooter className="tw-gap-2">
          <Button variant="text" size="sm" onClick={() => setApproveOpen(false)} disabled={busy}>
            {t("cancel", lang)}
          </Button>
          <Button color="green" size="sm" onClick={() => call("approve")} disabled={busy}>
            {t("confirm", lang)}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={rejectOpen} handler={() => setRejectOpen(false)} size="xs">
        <DialogHeader className="tw-text-base tw-font-semibold">{t("rejectTitle", lang)}</DialogHeader>
        <DialogBody className="tw-space-y-3 tw-text-sm">
          <Input crossOrigin="" label={t("rejectRemarkLabel", lang)} value={remark}
            onChange={(e) => setRemark(e.target.value)} />
          {error && <p className="tw-text-xs tw-text-red-600">{error}</p>}
        </DialogBody>
        <DialogFooter className="tw-gap-2">
          <Button variant="text" size="sm" onClick={() => setRejectOpen(false)} disabled={busy}>
            {t("cancel", lang)}
          </Button>
          <Button color="amber" size="sm" onClick={() => call("reject")} disabled={busy || !remark.trim()}>
            {t("confirm", lang)}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
