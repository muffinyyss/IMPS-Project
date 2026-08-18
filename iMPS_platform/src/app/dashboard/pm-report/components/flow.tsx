"use client";

/**
 * ชิ้นส่วนกลางของ flow ใบงาน PM — ใช้ร่วมกันทั้ง 5 tab
 * (charger / mdb / ccb / cb-box / station)
 *
 *   Maximo เปิดใบงาน → Open
 *   planner assign    → In Progress
 *   ช่างกรอกเสร็จ      → Wait for approve
 *   planner approve   → Closed
 *
 * แยกออกมาเพื่อไม่ต้องไล่แก้ตรรกะเดียวกัน 5 ที่
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/utils/api";
import type { Lang } from "@/utils/useLanguage";
import {
  derivePlanningStatus,
  equipLabel,
  PM_PLANNING_ROLES,
  type MaximoSource,
  type MaximoWorkOrder,
} from "./planning";

export const PM_APPROVE_ROLES = ["admin", "planner"];

/** ด่านของงาน 1 ใบ */
export type PmFlow =
  | "wo_pending"    // ใบงาน Maximo ยังไม่ได้ assign
  | "wo_planned"    // assign แล้ว รอช่างเริ่ม
  | "draft"         // ช่างกำลังกรอก
  | "rejected"      // planner ตีกลับ
  | "wait_approve"  // ช่างส่งแล้ว รออนุมัติ
  | "closed";

export type FlowTab = "open" | "in-progress" | "closed";

/** แถวในตาราง PM ต้องมีอย่างน้อยเท่านี้ถึงจะคิดสถานะได้ */
export type FlowRow = {
  kind?: "report" | "wo";
  status?: string;
  reject_remark?: string;
  planning_status?: string;
};

export function toPmFlow(row: FlowRow): PmFlow {
  if (row.kind === "wo") {
    return derivePlanningStatus(0, row.planning_status ?? "pending") === "planned"
      ? "wo_planned"
      : "wo_pending";
  }
  const s = String(row.status ?? "").trim().toLowerCase();
  if (s === "wait for approve") return "wait_approve";
  // ใบเก่าไม่มี status / เป็น "submitted" = ปิดไปแล้วก่อนมี flow อนุมัติ
  if (s === "draft") return row.reject_remark ? "rejected" : "draft";
  return "closed";
}

//  open        = ใบงาน Maximo ที่ planner ยังไม่วางแผน
//  in-progress = วางแผนแล้ว / ช่างกำลังกรอก / โดนตีกลับ / รออนุมัติ
//  closed      = planner อนุมัติปิดแล้ว (รวมใบเก่าที่ปิดก่อนมี flow อนุมัติ)
export const FLOW_TAB_OF: Record<PmFlow, FlowTab> = {
  wo_pending: "open",
  wo_planned: "in-progress",
  draft: "in-progress",
  rejected: "in-progress",
  wait_approve: "in-progress",
  closed: "closed",
};

export const FLOW_TABS: { id: FlowTab; th: string; en: string }[] = [
  { id: "open", th: "Open", en: "Open" },
  { id: "in-progress", th: "In Progress", en: "In Progress" },
  { id: "closed", th: "Closed", en: "Closed" },
];

const STATUS_STYLE: Record<PmFlow, string> = {
  wo_pending: "tw-bg-amber-100 tw-text-amber-800",
  wo_planned: "tw-bg-emerald-100 tw-text-emerald-800",
  draft: "tw-bg-gray-100 tw-text-gray-700",
  rejected: "tw-bg-amber-100 tw-text-amber-800",
  wait_approve: "tw-bg-purple-100 tw-text-purple-800",
  closed: "tw-bg-green-100 tw-text-green-800",
};

/** ชื่อสถานะ — ใช้ชุดเดียวกับที่ตกลงไว้ ไทย/อังกฤษเหมือนกัน */
const STATUS_LABEL: Record<PmFlow, string> = {
  wo_pending: "Open",
  wo_planned: "In Progress",
  draft: "In Progress",
  rejected: "In Progress",
  wait_approve: "Wait for approve",
  closed: "Closed",
};

export function pmStatusLabel(flow: PmFlow) {
  return STATUS_LABEL[flow];
}

export function PmStatusBadge({ flow, title }: { flow: PmFlow; title?: string }) {
  return (
    <span
      title={title || STATUS_LABEL[flow]}
      className={`tw-inline-block tw-rounded-full tw-px-2.5 tw-py-1 tw-text-[10px] sm:tw-text-xs tw-font-semibold tw-whitespace-nowrap ${STATUS_STYLE[flow]}`}
    >
      {STATUS_LABEL[flow]}
    </span>
  );
}

export function PmFlowTabs({
  value, onChange, counts, lang,
}: {
  value: FlowTab;
  onChange: (t: FlowTab) => void;
  counts: Record<FlowTab, number>;
  lang: Lang;
}) {
  return (
    <div className="tw-mt-2.5 tw-flex tw-flex-wrap tw-items-center tw-gap-1.5">
      {FLOW_TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`tw-rounded-lg tw-px-3 tw-py-1.5 tw-text-[11px] sm:tw-text-xs tw-font-medium tw-whitespace-nowrap tw-transition-all tw-border ${active
              ? "tw-bg-gray-900 tw-text-white tw-border-gray-900 tw-shadow-sm"
              : "tw-bg-white tw-text-blue-gray-600 tw-border-blue-gray-200 hover:tw-bg-blue-gray-50 hover:tw-text-blue-gray-800"
              }`}
          >
            {lang === "en" ? tab.en : tab.th}
            <span className={`tw-ml-1.5 ${active ? "tw-text-white/70" : "tw-text-blue-gray-400"}`}>
              {counts[tab.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * ดึงใบงาน Maximo ของ tab นี้ + สิทธิ์ของผู้ใช้ปัจจุบัน
 * (ตัวแถวเอาไปรวมกับเอกสาร PM ในตารางของแต่ละ tab เอง)
 */
export function usePmFlow(source: MaximoSource, identifier?: string | null) {
  const [wos, setWos] = useState<MaximoWorkOrder[]>([]);
  const [role, setRole] = useState("");
  const [flowTab, setFlowTab] = useState<FlowTab>("open");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch("/me");
        if (!res.ok) return;
        const me = await res.json();
        if (alive) setRole(String(me?.role ?? "").trim().toLowerCase());
      } catch { /* ไม่รู้ role = ถือว่าไม่มีสิทธิ์พิเศษ */ }
    })();
    return () => { alive = false; };
  }, []);

  const loadWos = useCallback(async (signal?: AbortSignal) => {
    if (!identifier) { setWos([]); return; }
    try {
      const res = await apiFetch(
        `/maximo/pm/open?source=${encodeURIComponent(source)}` +
        `&identifier=${encodeURIComponent(identifier)}&only_open=true`,
        { signal }
      );
      if (!res.ok) { setWos([]); return; }
      const j = await res.json();
      setWos(Array.isArray(j?.items) ? j.items : []);
    } catch (err: any) {
      if (err?.name !== "AbortError") setWos([]);
    }
  }, [source, identifier]);

  useEffect(() => {
    const ac = new AbortController();
    loadWos(ac.signal);
    return () => ac.abort();
  }, [loadWos]);

  return {
    wos,
    reloadWos: loadWos,
    canApprove: PM_APPROVE_ROLES.includes(role),
    canPlan: PM_PLANNING_ROLES.includes(role),
    flowTab,
    setFlowTab,
  };
}

/** ใบงาน Maximo → แถวในตาราง (ฟิลด์กลางที่ทุก tab ใช้เหมือนกัน) */
export function woToRow(w: MaximoWorkOrder, fallbackName: string) {
  const selected = w.selected_equipment ?? [];
  return {
    kind: "wo" as const,
    wonum: w.wonum ?? "",
    issue_id: w.wonum ?? "",
    doc_name: w.description || fallbackName,
    pm_date: w.pm_date ?? "",
    inspector: (w.assignees ?? []).filter(Boolean).join(", "),
    planning_status: w.planning_status ?? "pending",
    selected_equipment_label: selected.map((e) => equipLabel(e)).join(", "),
  };
}

/** ใบที่มีเอกสารแล้วไม่ต้องโชว์ซ้ำ — งาน 1 ใบ = 1 แถวที่ไล่สถานะไปเรื่อย ๆ */
export function dropWosWithReport<T extends { wonum?: string }>(
  woRows: T[], reportRows: { wonum?: string }[]
): T[] {
  const withReport = new Set(
    reportRows.map((r) => String(r.wonum || "").trim()).filter(Boolean)
  );
  return woRows.filter((r) => !r.wonum || !withReport.has(r.wonum));
}
