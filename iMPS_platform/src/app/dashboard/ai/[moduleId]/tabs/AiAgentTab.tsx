"use client";

// 🤖 AI วิเคราะห์ — แท็บที่มีในทุกโมดูล (M1–M7)
// เรียก backend agent (:8000) ให้สืบค้น telemetry/CM/failure code แล้วสรุป root cause
// + คำแนะนำการซ่อม ผลเป็นคำแนะนำ ผู้ใช้ยังเป็นคนเปิดใบงาน CM เอง
import React, { useCallback, useEffect, useState } from "react";
import { agentApi, DiagnoseResult, Severity } from "../../lib/agent-api";
import useLanguage, { type Lang } from "@/utils/useLanguage";

const T = {
  title: { th: "AI วิเคราะห์สาเหตุ", en: "AI Root-Cause Diagnosis" },
  desc: {
    th: "ให้ AI สืบค้นข้อมูลย้อนหลังและสรุปสาเหตุที่น่าจะเป็น พร้อมคำแนะนำการซ่อม (เป็นคำแนะนำ ไม่เปิดใบงานอัตโนมัติ)",
    en: "The AI investigates recent data and summarizes the likely cause with repair recommendations (advisory only — it does not open work orders).",
  },
  selectStation: { th: "กรุณาเลือกสถานีก่อน", en: "Please select a station first" },
  run: { th: "🔍 วิเคราะห์ด้วย AI", en: "🔍 Analyze with AI" },
  rerun: { th: "↻ วิเคราะห์ใหม่", en: "↻ Re-analyze" },
  running: { th: "AI กำลังสืบค้น...", en: "AI is investigating..." },
  rootCause: { th: "สาเหตุที่น่าจะเป็น", en: "Likely Root Cause" },
  confidence: { th: "ความมั่นใจ", en: "Confidence" },
  evidence: { th: "หลักฐานที่พบ", en: "Evidence" },
  actions: { th: "คำแนะนำการซ่อม", en: "Recommended Actions" },
  failureCode: { th: "รหัส Failure Code ที่เกี่ยว", en: "Suggested Failure Code" },
  openCm: { th: "แนะนำให้เปิดใบงาน CM", en: "Opening a CM work order is recommended" },
  noCm: { th: "ยังไม่จำเป็นต้องเปิดใบงาน CM", en: "No CM work order needed yet" },
  fallback: {
    th: "โหมดสำรอง — เชื่อมต่อ LLM ไม่ได้ ประเมินจากเกณฑ์มาตรฐานเท่านั้น",
    en: "Fallback mode — LLM unreachable; assessed from standard thresholds only.",
  },
  investigated: { th: "สืบค้น", en: "Investigated" },
  steps: { th: "รอบ", en: "steps" },
  generated: { th: "วิเคราะห์เมื่อ", en: "Generated" },
  cached: { th: "(ผลที่บันทึกไว้)", en: "(cached)" },
  error: { th: "วิเคราะห์ไม่สำเร็จ", en: "Diagnosis failed" },
  priorityHigh: { th: "สำคัญมาก", en: "High" },
  priorityMedium: { th: "ปานกลาง", en: "Medium" },
  priorityLow: { th: "ต่ำ", en: "Low" },
} as const;
const tr = (k: keyof typeof T, lang: Lang) => T[k][lang];

const SEV: Record<Severity, { th: string; en: string; bg: string; fg: string }> = {
  normal:   { th: "ปกติ",    en: "Normal",   bg: "tw-bg-green-100", fg: "tw-text-green-700" },
  watch:    { th: "เฝ้าระวัง", en: "Watch",    bg: "tw-bg-sky-100",   fg: "tw-text-sky-700" },
  warning:  { th: "เตือน",    en: "Warning",  bg: "tw-bg-amber-100", fg: "tw-text-amber-700" },
  critical: { th: "วิกฤต",    en: "Critical", bg: "tw-bg-red-100",   fg: "tw-text-red-700" },
};

function PriorityChip({ p, lang }: { p: "low" | "medium" | "high"; lang: Lang }) {
  const map = {
    high:   { cls: "tw-bg-red-100 tw-text-red-700", label: tr("priorityHigh", lang) },
    medium: { cls: "tw-bg-amber-100 tw-text-amber-700", label: tr("priorityMedium", lang) },
    low:    { cls: "tw-bg-gray-100 tw-text-gray-600", label: tr("priorityLow", lang) },
  }[p];
  return <span className={`tw-px-2 tw-py-0.5 tw-rounded-full tw-text-xs tw-font-semibold ${map.cls}`}>{map.label}</span>;
}

export default function AiAgentTab({ modNum, sn, lang: langProp }: {
  modNum: number;
  sn: string;
  lang?: Lang;
}) {
  const { lang: langHook } = useLanguage();
  const lang = langProp ?? langHook;

  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // โหลดผลที่ cache ไว้ตอนเปลี่ยนสถานี/โมดูล (ไม่รัน agent ใหม่ ประหยัด LLM)
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(null);
    if (!sn) return;
    (async () => {
      try {
        const cached = await agentApi.getCached(sn, modNum);
        if (!cancelled && cached) setResult(cached);
      } catch { /* ไม่มี cache = เรื่องปกติ */ }
    })();
    return () => { cancelled = true; };
  }, [sn, modNum]);

  const run = useCallback(async (force: boolean) => {
    if (!sn) return;
    setLoading(true);
    setError(null);
    try {
      const res = await agentApi.diagnose(sn, modNum, { force, lang });
      setResult(res);
    } catch (e: any) {
      setError(e?.message || tr("error", lang));
    } finally {
      setLoading(false);
    }
  }, [sn, modNum, lang]);

  if (!sn) {
    return (
      <div className="tw-text-center tw-text-gray-400 tw-py-16 tw-text-sm">
        ⚡ {tr("selectStation", lang)}
      </div>
    );
  }

  const d = result?.diagnosis ?? null;
  const sev = d ? SEV[d.severity] ?? SEV.watch : null;

  return (
    <div className="tw-flex tw-flex-col tw-gap-4 tw-max-w-4xl">
      {/* Header + run button */}
      <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-p-5">
        <div className="tw-flex tw-items-start tw-justify-between tw-gap-4 tw-flex-wrap">
          <div className="tw-flex-1 tw-min-w-0">
            <div className="tw-text-base tw-font-bold tw-text-gray-800">{tr("title", lang)}</div>
            <div className="tw-text-xs tw-text-gray-500 tw-mt-1 tw-leading-relaxed">{tr("desc", lang)}</div>
          </div>
          <button
            onClick={() => run(!!result)}
            disabled={loading}
            className="tw-px-4 tw-py-2 tw-rounded-xl tw-text-sm tw-font-semibold tw-text-white
                       tw-bg-purple-600 hover:tw-bg-purple-700 disabled:tw-opacity-50
                       tw-transition-colors tw-whitespace-nowrap tw-flex-shrink-0"
          >
            {loading ? tr("running", lang) : result ? tr("rerun", lang) : tr("run", lang)}
          </button>
        </div>
      </div>

      {loading && (
        <div className="tw-flex tw-items-center tw-justify-center tw-h-32 tw-gap-3">
          <div className="tw-w-6 tw-h-6 tw-rounded-full tw-border-2 tw-border-purple-200 tw-border-t-purple-600 tw-animate-spin" />
          <span className="tw-text-sm tw-text-gray-500">{tr("running", lang)}</span>
        </div>
      )}

      {error && !loading && (
        <div className="tw-p-4 tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-xl tw-text-red-700 tw-text-sm">
          ⚠ {tr("error", lang)}: {error}
        </div>
      )}

      {d && !loading && (
        <>
          {result?.method === "heuristic_fallback" && (
            <div className="tw-p-3 tw-bg-amber-50 tw-border tw-border-amber-200 tw-rounded-xl tw-text-amber-700 tw-text-xs">
              ⚠ {tr("fallback", lang)}
            </div>
          )}

          {/* Root cause + severity */}
          <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-p-5">
            <div className="tw-flex tw-items-center tw-gap-3 tw-mb-3 tw-flex-wrap">
              {sev && (
                <span className={`tw-px-3 tw-py-1 tw-rounded-full tw-text-xs tw-font-bold ${sev.bg} ${sev.fg}`}>
                  {lang === "th" ? sev.th : sev.en}
                </span>
              )}
              <span className="tw-text-xs tw-text-gray-400">
                {tr("confidence", lang)}: <b className="tw-text-gray-700">{Math.round((d.confidence ?? 0) * 100)}%</b>
              </span>
            </div>
            <div className="tw-text-xs tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-wide tw-mb-1">
              {tr("rootCause", lang)}
            </div>
            <div className="tw-text-base tw-font-semibold tw-text-gray-800 tw-mb-3">{d.root_cause}</div>
            <div className="tw-text-sm tw-text-gray-600 tw-leading-relaxed">{d.summary}</div>
          </div>

          {/* Evidence */}
          {d.evidence?.length > 0 && (
            <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-p-5">
              <div className="tw-text-xs tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-wide tw-mb-3">
                {tr("evidence", lang)}
              </div>
              <ul className="tw-flex tw-flex-col tw-gap-2">
                {d.evidence.map((e, i) => (
                  <li key={i} className="tw-flex tw-gap-2 tw-text-sm tw-text-gray-700">
                    <span className="tw-text-purple-400 tw-flex-shrink-0">•</span>
                    <span className="tw-font-mono tw-text-xs tw-leading-relaxed">{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended actions */}
          {d.recommended_actions?.length > 0 && (
            <div className="tw-bg-white tw-rounded-2xl tw-border tw-border-gray-100 tw-shadow-sm tw-p-5">
              <div className="tw-text-xs tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-wide tw-mb-3">
                {tr("actions", lang)}
              </div>
              <div className="tw-flex tw-flex-col tw-gap-3">
                {d.recommended_actions.map((a, i) => (
                  <div key={i} className="tw-flex tw-gap-3 tw-items-start tw-bg-gray-50 tw-rounded-xl tw-p-3 tw-border tw-border-gray-100">
                    <PriorityChip p={a.priority} lang={lang} />
                    <div className="tw-flex-1 tw-min-w-0">
                      <div className="tw-text-sm tw-font-medium tw-text-gray-800">{a.action}</div>
                      {a.rationale && <div className="tw-text-xs tw-text-gray-500 tw-mt-0.5">{a.rationale}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CM recommendation + failure code */}
          <div className={`tw-rounded-2xl tw-p-4 tw-text-sm tw-flex tw-items-center tw-gap-2 tw-border
            ${d.open_cm_recommended
              ? "tw-bg-red-50 tw-border-red-200 tw-text-red-700"
              : "tw-bg-green-50 tw-border-green-200 tw-text-green-700"}`}>
            <span>{d.open_cm_recommended ? "🛠" : "✓"}</span>
            <span className="tw-font-medium">{d.open_cm_recommended ? tr("openCm", lang) : tr("noCm", lang)}</span>
            {d.suggested_failure_code && (
              <span className="tw-ml-auto tw-text-xs tw-font-mono tw-bg-white/60 tw-px-2 tw-py-0.5 tw-rounded-md">
                {tr("failureCode", lang)}: {d.suggested_failure_code}
              </span>
            )}
          </div>

          {/* Footer meta */}
          <div className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap tw-text-xs tw-text-gray-400 tw-px-1">
            {result?.investigation && result.investigation.steps > 0 && (
              <span>{tr("investigated", lang)}: {result.investigation.steps} {tr("steps", lang)}
                {result.investigation.tools_used?.length > 0 && ` · ${result.investigation.tools_used.join(", ")}`}
              </span>
            )}
            {result?.model && <span>· {result.model}</span>}
            {result?.generated_at && (
              <span className="tw-ml-auto">
                {tr("generated", lang)}: {new Date(result.generated_at).toLocaleString(lang === "th" ? "th-TH" : "en-US", { dateStyle: "short", timeStyle: "short" })}
                {result.cached && ` ${tr("cached", lang)}`}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
