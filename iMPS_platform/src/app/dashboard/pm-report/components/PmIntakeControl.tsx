"use client";

/**
 * สวิตช์ "ปิดรับใบงาน PM จาก Maximo" (หน้า PM List) — backend: routers/pm_auto_wo.py
 *
 * ปิดรับ = Maximo ยิง IN06 เข้ามาจะได้ 423 และ iMPS ออกใบงานเองทุก 6 เดือน
 * นับจากวัน commissioning ของเครื่องอัดประจุไฟฟ้า (ออกในเดือนที่ครบรอบ)
 *
 * - ทุกคนเห็นแถบสถานะเมื่อปิดรับอยู่
 * - planner / owner / admin เปิดดูตู้ที่ครบรอบเดือนนี้ได้
 * - admin เท่านั้นที่กดสวิตช์ / สั่งออกใบงานตอนนี้
 */

import React, { useCallback, useEffect, useState } from "react";
import { CalendarDaysIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { Button } from "@material-tailwind/react";
import { apiFetch } from "@/utils/api";
import type { Lang } from "@/utils/useLanguage";

type IntakeState = {
  maximo_intake_closed: boolean;
  changed_by?: string | null;
  changed_at?: string | null;
  interval_months: number;
  can_toggle: boolean;
  last_run?: { at?: string; month?: string; created?: number; skipped?: number; errors?: number } | null;
};

type PreviewStation = {
  station_id: string;
  station_name?: string;
  pm_date: string;
  include_fixed: boolean;
  chargers: { sn: string; label?: string; due_date: string; cycle: number; commissioning_date: string }[];
  state: "pending" | "generated" | "exists";
  wonum?: string | null;
};

type Preview = { month: string; stations: PreviewStation[]; missing: { station_id: string; sn: string }[]; inactive: number };

const PREVIEW_ROLES = ["admin", "owner", "planner"];

const T = {
  th: {
    closedTitle: "ปิดรับใบงาน PM จาก Maximo",
    closedBody: (n: number) => `iMPS ออกใบงาน PM เองทุก ${n} เดือน นับจากวัน commissioning ของเครื่องอัดประจุไฟฟ้า (ออกในเดือนที่ครบรอบ)`,
    openBody: "รับใบงาน PM จาก Maximo (IN06) ตามปกติ",
    changed: (by: string, at: string) => `ตั้งค่าโดย ${by} · ${at}`,
    lastRun: (m: string, c: number) => `ออกใบงานล่าสุด รอบ ${m}: ${c} ใบ`,
    toClose: "ปิดรับจาก Maximo",
    toOpen: "กลับมารับจาก Maximo",
    dlgClose: {
      title: "ปิดรับใบงาน PM จาก Maximo",
      lead: "ยืนยันปิดรับใบงาน PM จาก Maximo?",
      points: (n: number) => [
        "Maximo ยิงใบงานเข้ามาจะถูกปฏิเสธ",
        `iMPS จะออกใบงานเองทุก ${n} เดือนนับจากวัน commissioning ของตู้ — ตู้ที่ครบรอบเดือนนี้จะได้ใบงานทันที`,
        "ใบงาน Maximo ที่รับไว้แล้วยังส่งปิดงานเข้า Maximo ตามปกติ",
      ],
      confirm: "ยืนยันปิดรับ",
    },
    dlgOpen: {
      title: "กลับมารับใบงานจาก Maximo",
      lead: "ยืนยันกลับมารับใบงาน PM จาก Maximo?",
      points: () => ["ระบบจะหยุดออกใบงานเอง", "ใบงานที่ระบบออกไปแล้วยังอยู่ตามเดิม"],
      confirm: "ยืนยันรับใบงาน",
    },
    dlgRun: {
      title: "ออกใบงานเดือนนี้",
      lead: "ยืนยันออกใบงาน PM ของตู้ที่ครบรอบเดือนนี้ตอนนี้?",
      points: () => ["สถานีที่มีใบงานเดือนนี้อยู่แล้วจะถูกข้าม ไม่ออกซ้ำ"],
      confirm: "ยืนยันออกใบงาน",
    },
    back: "กลับ",
    runNow: "ออกใบงานเดือนนี้ตอนนี้",
    showDue: "ตู้ที่ครบรอบเดือนนี้",
    hideDue: "ซ่อน",
    noneDue: "ไม่มีตู้ที่ครบรอบในเดือนนี้",
    stateGenerated: "ออกใบแล้ว",
    stateExists: "มีใบงานเดือนนี้แล้ว",
    statePending: "รอออกใบ",
    fixed: "+ Station/MDB/CCB/CB_BOX",
    missing: (n: number) => `ตู้ที่ไม่มีวัน commissioning ${n} ตู้ — ระบบออกใบให้ไม่ได้ ตั้งวันที่หน้า EV Stations`,
    runResult: (c: number, s: number) => `ออกใบงานใหม่ ${c} ใบ · ข้าม ${s} สถานี`,
    error: "ทำรายการไม่สำเร็จ",
    cycle: (n: number) => `รอบที่ ${n}`,
  },
  en: {
    closedTitle: "Maximo PM work orders: intake closed",
    closedBody: (n: number) => `iMPS issues PM work orders itself every ${n} months from each charger's commissioning date (in the due month)`,
    openBody: "PM work orders are received from Maximo (IN06) as usual",
    changed: (by: string, at: string) => `Set by ${by} · ${at}`,
    lastRun: (m: string, c: number) => `Last run ${m}: ${c} work order(s)`,
    toClose: "Stop receiving from Maximo",
    toOpen: "Receive from Maximo again",
    dlgClose: {
      title: "Stop receiving from Maximo",
      lead: "Stop receiving PM work orders from Maximo?",
      points: (n: number) => [
        "Work orders pushed by Maximo will be rejected",
        `iMPS issues work orders every ${n} months from each charger's commissioning date — chargers due this month get one right away`,
        "Maximo work orders already received still close out in Maximo as usual",
      ],
      confirm: "Stop receiving",
    },
    dlgOpen: {
      title: "Receive from Maximo again",
      lead: "Receive PM work orders from Maximo again?",
      points: () => ["iMPS stops issuing its own work orders", "Work orders it already issued stay as they are"],
      confirm: "Receive again",
    },
    dlgRun: {
      title: "Issue this month's work orders",
      lead: "Issue PM work orders for chargers due this month now?",
      points: () => ["Stations that already have a work order this month are skipped"],
      confirm: "Issue now",
    },
    back: "Back",
    runNow: "Issue this month's work orders now",
    showDue: "Chargers due this month",
    hideDue: "Hide",
    noneDue: "No chargers are due this month",
    stateGenerated: "Issued",
    stateExists: "Already has a work order",
    statePending: "Pending",
    fixed: "+ Station/MDB/CCB/CB_BOX",
    missing: (n: number) => `${n} charger(s) have no commissioning date — set it on EV Stations`,
    runResult: (c: number, s: number) => `${c} new work order(s) · ${s} station(s) skipped`,
    error: "Request failed",
    cycle: (n: number) => `Cycle ${n}`,
  },
};

function fmtDateTime(iso?: string | null, lang: Lang = "th") {
  if (!iso) return "-";
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}

async function readJson(res: Response) {
  const j = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const d = j?.detail;
    throw new Error(typeof d === "string" ? d : `HTTP ${res.status}`);
  }
  return j;
}

export default function PmIntakeControl({
  role, lang, onGenerated,
}: {
  role: string;
  lang: Lang;
  /** ออกใบงานใหม่แล้ว — ให้หน้า PM List โหลดรายการใหม่ */
  onGenerated?: () => void;
}) {
  const t = lang === "en" ? T.en : T.th;
  const [state, setState] = useState<IntakeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  // หน้าต่างยืนยัน (แทน window.confirm) — close = ปิดรับ, open = กลับมารับ, run = ออกใบงานตอนนี้
  const [asking, setAsking] = useState<"close" | "open" | "run" | null>(null);
  const canPreview = PREVIEW_ROLES.includes(role);

  const load = useCallback(async () => {
    try {
      setState(await readJson(await apiFetch("/pm-maximo/intake")));
    } catch (e) {
      console.error("pm intake load error:", e);
    }
  }, []);

  const loadPreview = useCallback(async () => {
    try {
      setPreview(await readJson(await apiFetch("/pm-maximo/auto-wo/preview")));
    } catch (e: any) {
      setMsg({ tone: "err", text: `${t.error}: ${e?.message ?? e}` });
    }
  }, [t.error]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (open) loadPreview(); }, [open, loadPreview]);

  const afterRun = (run: { created?: unknown[]; skipped?: unknown[] } | null | undefined) => {
    if (!run) return;
    const created = run.created?.length ?? 0;
    setMsg({ tone: "ok", text: t.runResult(created, run.skipped?.length ?? 0) });
    if (created) onGenerated?.();
    if (open) loadPreview();
  };

  const toggle = async (closing: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      const j = await readJson(await apiFetch("/pm-maximo/intake", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed: closing }),
      }));
      setState(j);
      afterRun(j.run);
    } catch (e: any) {
      setMsg({ tone: "err", text: `${t.error}: ${e?.message ?? e}` });
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    setMsg(null);
    try {
      afterRun(await readJson(await apiFetch("/pm-maximo/auto-wo/run", { method: "POST" })));
      load();
    } catch (e: any) {
      setMsg({ tone: "err", text: `${t.error}: ${e?.message ?? e}` });
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;
  const closed = state.maximo_intake_closed;
  // รับจาก Maximo ตามปกติ — คนที่สลับไม่ได้ไม่ต้องเห็นอะไร
  if (!closed && !state.can_toggle) return null;

  const dlg = asking === "close" ? t.dlgClose : asking === "open" ? t.dlgOpen : asking === "run" ? t.dlgRun : null;
  const onConfirm = () => {
    const what = asking;
    setAsking(null);
    if (what === "run") void runNow();
    else if (what) void toggle(what === "close");
  };

  const stateLabel = (s: PreviewStation["state"]) =>
    s === "generated" ? t.stateGenerated : s === "exists" ? t.stateExists : t.statePending;
  const stateTone = (s: PreviewStation["state"]) =>
    s === "generated" ? "tw-bg-green-100 tw-text-green-700"
      : s === "exists" ? "tw-bg-gray-100 tw-text-gray-600"
        : "tw-bg-amber-100 tw-text-amber-700";

  return (
    <div
      className={`tw-mb-4 tw-rounded-xl tw-border tw-px-4 tw-py-3 tw-text-sm ${
        closed ? "tw-border-indigo-200 tw-bg-indigo-50 tw-text-indigo-900" : "tw-border-gray-200 tw-bg-white tw-text-gray-700"
      }`}
    >
      <div className="tw-flex tw-flex-col tw-gap-2 sm:tw-flex-row sm:tw-items-center">
        <CalendarDaysIcon aria-hidden="true" className="tw-hidden tw-h-5 tw-w-5 tw-shrink-0 sm:tw-block" />
        <div className="tw-min-w-0 tw-flex-1">
          {closed && <div className="tw-font-semibold">{t.closedTitle}</div>}
          <div>{closed ? t.closedBody(state.interval_months) : t.openBody}</div>
          <div className="tw-mt-0.5 tw-text-xs tw-opacity-70">
            {state.changed_by && t.changed(state.changed_by, fmtDateTime(state.changed_at, lang))}
            {closed && state.last_run?.month && (
              <span className={state.changed_by ? "tw-ml-2" : ""}>
                {t.lastRun(state.last_run.month, state.last_run.created ?? 0)}
              </span>
            )}
          </div>
        </div>
        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
          {closed && canPreview && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="tw-inline-flex tw-h-8 tw-items-center tw-gap-1 tw-rounded-lg tw-border tw-border-indigo-200 tw-bg-white tw-px-3 tw-text-xs tw-font-semibold tw-text-indigo-700 hover:tw-bg-indigo-100"
            >
              {open ? t.hideDue : t.showDue}
              {open ? <ChevronUpIcon className="tw-h-3.5 tw-w-3.5" /> : <ChevronDownIcon className="tw-h-3.5 tw-w-3.5" />}
            </button>
          )}
          {closed && state.can_toggle && (
            <button
              type="button" onClick={() => setAsking("run")} disabled={busy}
              className="tw-inline-flex tw-h-8 tw-items-center tw-rounded-lg tw-border tw-border-indigo-200 tw-bg-white tw-px-3 tw-text-xs tw-font-semibold tw-text-indigo-700 hover:tw-bg-indigo-100 disabled:tw-opacity-50"
            >
              {t.runNow}
            </button>
          )}
          {state.can_toggle && (
            <button
              type="button" onClick={() => setAsking(closed ? "open" : "close")} disabled={busy} aria-pressed={closed}
              className={`tw-inline-flex tw-h-8 tw-items-center tw-rounded-lg tw-px-3 tw-text-xs tw-font-semibold tw-text-white disabled:tw-opacity-50 ${
                closed ? "tw-bg-gray-700 hover:tw-bg-gray-900" : "tw-bg-indigo-600 hover:tw-bg-indigo-700"
              }`}
            >
              {closed ? t.toOpen : t.toClose}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`tw-mt-2 tw-text-xs tw-font-medium ${msg.tone === "err" ? "tw-text-red-600" : "tw-text-green-700"}`}>
          {msg.text}
        </div>
      )}

      {closed && open && preview && (
        <div className="tw-mt-3 tw-rounded-lg tw-border tw-border-indigo-100 tw-bg-white tw-p-3 tw-text-gray-700">
          <div className="tw-mb-2 tw-text-xs tw-font-semibold tw-text-gray-500">{preview.month}</div>
          {preview.stations.length === 0 ? (
            <div className="tw-text-xs tw-text-gray-500">{t.noneDue}</div>
          ) : (
            <ul className="tw-divide-y tw-divide-gray-100">
              {preview.stations.map((s) => (
                <li key={s.station_id} className="tw-flex tw-flex-col tw-gap-1 tw-py-2 sm:tw-flex-row sm:tw-items-center sm:tw-gap-3">
                  <div className="tw-min-w-0 tw-flex-1">
                    <div className="tw-font-medium tw-text-gray-800">
                      {s.station_name || s.station_id}
                      <span className="tw-ml-2 tw-text-xs tw-font-normal tw-text-gray-500">PM {s.pm_date}</span>
                    </div>
                    <div className="tw-text-xs tw-text-gray-500">
                      {s.chargers.map((c) => `${c.label || c.sn} (${t.cycle(c.cycle)})`).join(", ")}
                      {s.include_fixed && <span className="tw-ml-1">{t.fixed}</span>}
                    </div>
                  </div>
                  <span className={`tw-inline-flex tw-w-fit tw-rounded-full tw-px-2 tw-py-0.5 tw-text-xs tw-font-semibold ${stateTone(s.state)}`}>
                    {stateLabel(s.state)}{s.wonum ? ` · ${s.wonum}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {preview.missing.length > 0 && (
            <div className="tw-mt-2 tw-text-xs tw-text-amber-700">{t.missing(preview.missing.length)}</div>
          )}
        </div>
      )}

      {dlg && (
        <div
          className="tw-fixed tw-inset-0 tw-z-[9999] tw-flex tw-items-center tw-justify-center tw-bg-black/40 tw-p-4"
          onClick={() => setAsking(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pm-intake-dialog-title"
            className="tw-w-full tw-max-w-md tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pm-intake-dialog-title" className="tw-mb-3 tw-text-lg tw-font-bold tw-text-blue-gray-800">{dlg.title}</h3>
            <p className="tw-text-sm tw-font-medium tw-text-blue-gray-700">{dlg.lead}</p>
            <ul className="tw-mt-2 tw-list-disc tw-space-y-1 tw-pl-5 tw-text-sm tw-text-blue-gray-600">
              {dlg.points(state.interval_months).map((x) => <li key={x}>{x}</li>)}
            </ul>
            <div className="tw-flex tw-items-center tw-justify-end tw-gap-3 tw-pt-5">
              <Button type="button" variant="outlined" onClick={() => setAsking(null)} className="tw-border-blue-gray-200 tw-text-blue-gray-700">
                {t.back}
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                className={`tw-text-white ${asking === "close" ? "tw-bg-indigo-600 hover:tw-bg-indigo-700" : "tw-bg-gray-800 hover:tw-bg-gray-900"}`}
              >
                {dlg.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
