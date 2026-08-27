"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, Typography, Button } from "@material-tailwind/react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "@/utils/api";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import {
  derivePlanningStatus as derivePlanningStatusImpl,
  equipKey,
  equipLabel,
  formatDate,
  planningChipClass,
  PM_PLANNING_ROLES,
  statusChipClass,
  toDateTimeLocalValue,
  type EquipmentChoices,
  type EquipmentItem,
  type MaximoSource,
  type MaximoWorkOrder,
  type TechnicianOption,
} from "./planning";

// ชนิดข้อมูล/ตัวช่วยของการวางแผนอยู่ที่ ./planning — re-export ไว้เพื่อไม่ให้ผู้เรียกเดิมพัง
export type { MaximoSource, MaximoWorkOrder, EquipmentItem } from "./planning";
export { derivePlanningStatus } from "./planning";
const derivePlanningStatus = derivePlanningStatusImpl;

type Props = {
  source: MaximoSource;
  identifier?: string | null;
};

// ==================== TRANSLATIONS ====================
const T = {
  title: { th: "ใบงาน PM จาก Maximo", en: "PM Work Orders from Maximo" },
  refresh: { th: "รีเฟรช", en: "Refresh" },
  refreshing: { th: "กำลังรีเฟรช…", en: "Refreshing…" },
  loading: { th: "กำลังโหลด…", en: "Loading…" },
  empty: { th: "ยังไม่มีใบงานจาก Maximo", en: "No work orders from Maximo yet" },
  pmDate: { th: "วันที่ PM", en: "PM date" },
  location: { th: "Location", en: "Location" },
  station: { th: "สถานี", en: "Station" },
  company: { th: "บริษัท", en: "Company" },
  workOrder: { th: "WO", en: "WO" },
  selectedEquipment: { th: "อุปกรณ์ที่เลือกใน IMPS", en: "Selected equipment in IMPS" },
  noneSelected: { th: "ยังไม่ได้เลือกอุปกรณ์", en: "No equipment selected yet" },
  awaitingPlanner: { th: "รอ Planner วางแผนอุปกรณ์", en: "Awaiting planner equipment plan" },
  plannedBy: { th: "วางแผนโดย", en: "Planned by" },
  plannerOnly: { th: "ให้ Planner วางแผนอุปกรณ์", en: "Equipment planning is for planner" },
  pickEquipment: { th: "เลือกอุปกรณ์ที่จะ PM", en: "Choose equipment to PM" },
  planningSection: { th: "ข้อมูลการวางแผน", en: "Planning details" },
  planningStatus: { th: "สถานะวางแผน", en: "Planning status" },
  plannedAt: { th: "วันที่/เวลาที่วางแผน", en: "Planned at" },
  schedStart: { th: "วันที่เริ่มตามแผน", en: "Scheduled Start" },
  schedFinish: { th: "วันที่เสร็จตามแผน", en: "Scheduled Finish" },
  technician: { th: "ช่างผู้รับผิดชอบ", en: "Technician" },
  allTechnicians: { th: "ทั้งหมด", en: "All" },
  noTechnicians: { th: "ไม่พบช่าง", en: "No technicians found" },
  planned: { th: "วางแผนแล้ว", en: "Planned" },
  pending: { th: "รอวางแผน", en: "Pending" },
  selectedCount: { th: "จำนวนอุปกรณ์ที่เลือก", en: "Selected equipment count" },
  chargers: { th: "ตู้ชาร์จ", en: "Chargers" },
  stationLevel: { th: "อุปกรณ์ระดับสถานี", en: "Station-level equipment" },
  noChargers: { th: "ไม่พบตู้ชาร์จในสถานีนี้", en: "No chargers found in this station" },
  close: { th: "ปิด", en: "Close" },
  confirm: { th: "ยืนยัน", en: "Confirm" },
  saving: { th: "กำลังบันทึก…", en: "Saving…" },
  saved: { th: "บันทึกอุปกรณ์ที่จะ PM แล้ว", en: "Equipment selection saved" },
  error: { th: "โหลดใบงานจาก Maximo ไม่สำเร็จ", en: "Failed to load Maximo work orders" },
  choicesError: { th: "โหลดรายการอุปกรณ์ไม่สำเร็จ", en: "Failed to load equipment list" },
  saveError: { th: "บันทึกอุปกรณ์ที่จะ PM ไม่สำเร็จ", en: "Failed to save equipment selection" },
} as const;

function t(key: keyof typeof T, lang: Lang) {
  return T[key][lang === "en" ? "en" : "th"];
}

export default function MaximoWorkOrders({ source, identifier }: Props) {
  const { lang } = useLanguage();
  const [items, setItems] = useState<MaximoWorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  // ── ฟอร์มวางแผน (panel ในการ์ด) ──
  const [plannerFormOpen, setPlannerFormOpen] = useState(false);
  const [selectedWo, setSelectedWo] = useState<MaximoWorkOrder | null>(null);
  const [choices, setChoices] = useState<EquipmentChoices | null>(null);
  const [choicesLoading, setChoicesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string>("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [canPlan, setCanPlan] = useState(false);
  const [plannedAt, setPlannedAt] = useState("");
  const [schedStart, setSchedStart] = useState("");
  const [schedFinish, setSchedFinish] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      try {
        const res = await apiFetch("/me");
        const me = await res.json().catch(() => ({} as any));
        const role = String(me?.role ?? "").trim().toLowerCase();
        if (active) {
          setCanPlan(PM_PLANNING_ROLES.includes(role));
        }
      } catch (err) {
        console.error("maximo pm role error:", err);
      }
    }

    loadRole();
    return () => { active = false; };
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!identifier) {
        setItems([]);
        setError("");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const url =
          `/maximo/pm/open?source=${encodeURIComponent(source)}` +
          `&identifier=${encodeURIComponent(identifier)}&only_open=true`;
        const res = await apiFetch(url, { signal });
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          setItems([]);
          setError(String(j?.detail || t("error", lang)));
          return;
        }
        setItems(Array.isArray(j?.items) ? j.items : []);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("maximo pm open error:", err);
        setItems([]);
        setError(t("error", lang));
      } finally {
        setLoading(false);
      }
    },
    [source, identifier, lang]
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  async function openSelectionDialog(wo: MaximoWorkOrder) {
    if (!wo.wonum || !canPlan) return;
    setSelectedWo(wo);
    setPlannerFormOpen(true);
    setDialogError("");
    setChoices(null);
    setChecked({});
    setChoicesLoading(true);
    setPlannedAt(wo.planned_at ? toDateTimeLocalValue(wo.planned_at) : toDateTimeLocalValue(new Date().toISOString()));
    setSchedStart(wo.sched_start ? toDateTimeLocalValue(wo.sched_start) : "");
    setSchedFinish(wo.sched_finish ? toDateTimeLocalValue(wo.sched_finish) : "");
    setAssignees(Array.isArray(wo.assignees) ? wo.assignees.filter(Boolean) : []);

    try {
      const res = await apiFetch(
        `/maximo/pm/${encodeURIComponent(wo.wonum)}/equipment-choices`
      );
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setDialogError(String(j?.detail || t("choicesError", lang)));
        return;
      }
      const data: EquipmentChoices = {
        wonum: j?.wonum ?? wo.wonum,
        station_id: j?.station_id ?? null,
        location: j?.location ?? null,
        chargers: Array.isArray(j?.chargers) ? j.chargers : [],
        fixed: Array.isArray(j?.fixed) ? j.fixed : [],
        selected_equipment: Array.isArray(j?.selected_equipment) ? j.selected_equipment : [],
      };
      setChoices(data);
      const preset: Record<string, boolean> = {};
      data.selected_equipment.forEach((e) => { preset[equipKey(e)] = true; });
      setChecked(preset);
      if (wo.planning_status) {
        const nextStatus = derivePlanningStatus(data.selected_equipment.length, wo.planning_status);
        setSelectedWo({ ...wo, planning_status: nextStatus, selected_equipment: data.selected_equipment });
      }
    } catch (err) {
      console.error("maximo pm equipment-choices error:", err);
      setDialogError(t("choicesError", lang));
    } finally {
      setChoicesLoading(false);
    }

    try {
      const techRes = await apiFetch("/users/by-role?role=technician");
      const techJson = await techRes.json().catch(() => ({} as any));
      if (techRes.ok) {
        setTechnicians(Array.isArray(techJson?.users) ? techJson.users : []);
      }
    } catch (err) {
      console.error("maximo pm technicians error:", err);
      setTechnicians([]);
    }
  }

  function toggle(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAssignee(username: string) {
    setAssignees((prev) => (prev.includes(username) ? prev.filter((u) => u !== username) : [...prev.filter(Boolean), username]));
  }

  async function handleSaveEquipment() {
    if (!selectedWo?.wonum || !choices || saving) return;
    const equipment = [...choices.chargers, ...choices.fixed]
      .filter((e) => checked[equipKey(e)])
      .map((e) => ({
        type: e.type,
        ...(e.sn ? { sn: e.sn } : {}),
        ...(e.location ? { location: e.location } : {}),
        ...(e.label ? { label: e.label } : {}),
      }));

    if (!schedStart || !schedFinish) {
      setDialogError("Please select scheduled start and finish");
      return;
    }
    if (assignees.length === 0) {
      setDialogError("Please select at least one technician");
      return;
    }

    setSaving(true);
    setDialogError("");
    try {
      const res = await apiFetch(
        `/maximo/pm/${encodeURIComponent(selectedWo.wonum)}/equipment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            equipment,
            planned_at: plannedAt || new Date().toISOString(),
            sched_start: schedStart,
            sched_finish: schedFinish,
            assignees,
          }),
        }
      );
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setDialogError(String(j?.detail || t("saveError", lang)));
        return;
      }
      const nextStatus = derivePlanningStatus(equipment.length, selectedWo.planning_status ?? "pending");
      setSelectedWo((prev) => prev ? { ...prev, planning_status: nextStatus, selected_equipment: equipment, sched_start: schedStart, sched_finish: schedFinish, assignees, planned_at: plannedAt || new Date().toISOString() } : prev);
      setPlannerFormOpen(false);
      setNotice(t("saved", lang));
      await load();
    } catch (err) {
      console.error("maximo pm set equipment error:", err);
      setDialogError(t("saveError", lang));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="tw-border tw-border-gray-200 tw-shadow-sm tw-mt-4 sm:tw-mt-6 lg:tw-mt-8 tw-mx-2 sm:tw-mx-4 lg:tw-mx-0 tw-rounded-2xl tw-overflow-hidden">
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-3 sm:tw-px-4 lg:tw-px-6 tw-py-3 sm:tw-py-4 tw-border-b tw-border-blue-gray-100 tw-bg-gradient-to-r tw-from-white tw-to-blue-gray-50/30">
        <Typography variant="h6" color="blue-gray" className="tw-text-sm sm:tw-text-base tw-font-semibold">
          {t("title", lang)}
        </Typography>
        <button
          type="button"
          onClick={() => { setNotice(""); load(); }}
          disabled={loading || !identifier}
          title={t("refresh", lang)}
          className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-xs tw-font-medium tw-text-blue-gray-700 hover:tw-bg-blue-gray-50 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed tw-transition-colors"
        >
          <ArrowPathIcon className={`tw-w-4 tw-h-4 ${loading ? "tw-animate-spin" : ""}`} />
          {loading ? t("refreshing", lang) : t("refresh", lang)}
        </button>
      </div>

      {/* Body */}
      <div className="tw-px-3 sm:tw-px-4 lg:tw-px-6 tw-py-3 sm:tw-py-4">
        {error && (
          <div className="tw-mb-3 tw-rounded-lg tw-border tw-border-red-200 tw-bg-red-50 tw-px-3 tw-py-2 tw-text-xs sm:tw-text-sm tw-text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="tw-mb-3 tw-rounded-lg tw-border tw-border-green-200 tw-bg-green-50 tw-px-3 tw-py-2 tw-text-xs sm:tw-text-sm tw-text-green-700">
            {notice}
          </div>
        )}

        {loading ? (
          <div className="tw-flex tw-items-center tw-gap-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-500 tw-py-2">
            <span className="tw-w-4 tw-h-4 tw-border-2 tw-border-blue-500 tw-border-t-transparent tw-rounded-full tw-animate-spin" />
            {t("loading", lang)}
          </div>
        ) : items.length === 0 ? (
          <Typography className="tw-text-xs sm:tw-text-sm tw-text-blue-gray-400">
            {t("empty", lang)}
          </Typography>
        ) : (
          <ul className="tw-flex tw-flex-col tw-gap-2">
            {items.map((wo, i) => {
              const key = wo.wonum || `${wo.location ?? ""}-${wo.pm_date ?? ""}`;
              const selected = wo.selected_equipment ?? [];
              return (
                <li
                  key={`${key}-${i}`}
                  className="tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-px-3 tw-py-2.5 hover:tw-bg-blue-gray-50/40 tw-transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => openSelectionDialog(wo)}
                    disabled={!wo.wonum || !canPlan}
                    title={canPlan ? t("pickEquipment", lang) : t("plannerOnly", lang)}
                    className="tw-w-full tw-text-left disabled:tw-cursor-default"
                  >
                    <div className="tw-min-w-0 tw-flex-1">
                      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                        <Typography className="tw-text-sm sm:tw-text-base tw-font-semibold tw-text-blue-gray-900">
                          {wo.wonum || wo.location || "-"}
                        </Typography>
                        {wo.status && (
                          <span
                            className={`tw-inline-flex tw-items-center tw-rounded-full tw-border tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-medium ${statusChipClass(
                              wo.status
                            )}`}
                          >
                            {wo.status}
                          </span>
                        )}
                        {wo.company && (
                          <span className="tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-blue-gray-200 tw-bg-blue-gray-50 tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-blue-gray-700">
                            {wo.company}
                          </span>
                        )}
                      </div>

                      {wo.description && (
                        <Typography className="tw-mt-1 tw-text-xs sm:tw-text-sm tw-text-blue-gray-600 tw-break-words">
                          {wo.description}
                        </Typography>
                      )}

                      <div className="tw-mt-1.5 tw-flex tw-flex-wrap tw-gap-x-4 tw-gap-y-1 tw-text-[11px] sm:tw-text-xs tw-text-blue-gray-500">
                        <span>
                          {t("workOrder", lang)}: {wo.wonum || "-"}
                        </span>
                        <span>
                          {t("pmDate", lang)}: {formatDate(wo.pm_date, lang)}
                        </span>
                        {wo.location && <span>{t("location", lang)}: {wo.location}</span>}
                        {wo.station_id && <span>{t("station", lang)}: {wo.station_id}</span>}
                        {wo.company && <span>{t("company", lang)}: {wo.company}</span>}
                      </div>

                      <div className="tw-mt-2 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                        <span
                          className={`tw-inline-flex tw-items-center tw-rounded-full tw-border tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold ${planningChipClass(
                            derivePlanningStatus(selected.length, wo.planning_status ?? "pending")
                          )}`}
                        >
                          {derivePlanningStatus(selected.length, wo.planning_status ?? "pending") === "planned"
                            ? t("planned", lang)
                            : t("pending", lang)}
                        </span>
                        <span className="tw-text-[11px] tw-font-medium tw-text-blue-gray-500">
                          {t("selectedEquipment", lang)}:
                        </span>
                        {selected.length === 0 ? (
                          <span className="tw-text-[11px] tw-text-blue-gray-400">
                            {canPlan ? t("noneSelected", lang) : t("awaitingPlanner", lang)}
                          </span>
                        ) : (
                          selected.map((e, k) => (
                            <span
                              key={`${equipKey(e)}-${k}`}
                              className="tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-indigo-200 tw-bg-indigo-50 tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-indigo-700"
                            >
                              {equipLabel(e)}
                            </span>
                          ))
                        )}
                      </div>
                      {wo.selected_by && (
                        <div className="tw-mt-1 tw-text-[11px] tw-text-blue-gray-400">
                          {t("plannedBy", lang)}: {wo.selected_by}
                        </div>
                      )}
                      {!canPlan && (
                        <div className="tw-mt-1 tw-text-[11px] tw-font-medium tw-text-blue-gray-400">
                          {t("plannerOnly", lang)}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {plannerFormOpen && selectedWo && (
        <div className="tw-mt-4 tw-mx-3 sm:tw-mx-4 lg:tw-mx-6 tw-rounded-2xl tw-border tw-border-blue-gray-200 tw-bg-white tw-p-3 sm:tw-p-4 tw-shadow-sm">
          <div className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-mb-4">
            <div>
              <div className="tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-500">{t("planningSection", lang)}</div>
              <div className="tw-mt-1 tw-text-base sm:tw-text-lg tw-font-bold tw-text-blue-gray-900">{selectedWo.wonum || selectedWo.location || "WO"}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPlannerFormOpen(false);
                setSelectedWo(null);
              }}
              className="tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-xs tw-font-medium tw-text-blue-gray-700 hover:tw-bg-blue-gray-50"
            >
              {t("close", lang)}
            </button>
          </div>

          <div className="tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-blue-gray-50 tw-px-3 tw-py-2 tw-text-[11px] sm:tw-text-xs tw-text-blue-gray-700 tw-mb-4">
            <div><span className="tw-font-semibold">{t("workOrder", lang)}:</span> {selectedWo.wonum || "-"}</div>
            <div><span className="tw-font-semibold">{t("location", lang)}:</span> {selectedWo.location || "-"}</div>
            <div><span className="tw-font-semibold">{t("pmDate", lang)}:</span> {formatDate(selectedWo.pm_date, lang)}</div>
            {selectedWo.company && (
              <div><span className="tw-font-semibold">{t("company", lang)}:</span> {selectedWo.company}</div>
            )}
          </div>

          {dialogError && (
            <div className="tw-mb-4 tw-rounded-lg tw-border tw-border-red-200 tw-bg-red-50 tw-px-3 tw-py-2 tw-text-xs tw-text-red-700">
              {dialogError}
            </div>
          )}

          {choicesLoading ? (
            <div className="tw-flex tw-items-center tw-gap-2 tw-text-xs tw-text-blue-gray-500 tw-py-4">
              <span className="tw-w-4 tw-h-4 tw-border-2 tw-border-blue-500 tw-border-t-transparent tw-rounded-full tw-animate-spin" />
              {t("loading", lang)}
            </div>
          ) : choices ? (
            <div className="tw-space-y-4">
              <div className="tw-rounded-xl tw-border tw-border-indigo-200 tw-bg-indigo-50/70 tw-p-3">
                <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
                  <div>
                    <div className="tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-500">{t("planningStatus", lang)}</div>
                    <div className="tw-mt-1 tw-text-sm tw-font-semibold tw-text-blue-gray-900">{t("planningSection", lang)}</div>
                  </div>
                  <span className={`tw-inline-flex tw-items-center tw-rounded-full tw-border tw-px-2.5 tw-py-1 tw-text-[11px] tw-font-semibold ${planningChipClass(derivePlanningStatus(Object.values(checked).filter(Boolean).length, selectedWo?.planning_status ?? "pending"))}`}>
                    {derivePlanningStatus(Object.values(checked).filter(Boolean).length, selectedWo?.planning_status ?? "pending") === "planned" ? t("planned", lang) : t("pending", lang)}
                  </span>
                </div>
                <div className="tw-mt-2 tw-flex tw-items-center tw-gap-2 tw-text-xs tw-text-blue-gray-600">
                  <span>{t("selectedCount", lang)}:</span>
                  <span className="tw-font-semibold tw-text-blue-gray-800">{Object.values(checked).filter(Boolean).length}</span>
                </div>
              </div>

              <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-3">
                <div>
                  <label className="tw-mb-1.5 tw-block tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-700">{t("plannedAt", lang)}</label>
                  <input type="datetime-local" value={plannedAt} onChange={(e) => setPlannedAt(e.target.value)} className="tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none focus:tw-border-blue-500" />
                </div>
                <div>
                  <label className="tw-mb-1.5 tw-block tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-700">{t("schedStart", lang)} <span className="tw-text-red-500">*</span></label>
                  <input type="datetime-local" value={schedStart} min={plannedAt || undefined} onChange={(e) => setSchedStart(e.target.value)} className="tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none focus:tw-border-blue-500" />
                </div>
                <div>
                  <label className="tw-mb-1.5 tw-block tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-700">{t("schedFinish", lang)} <span className="tw-text-red-500">*</span></label>
                  <input type="datetime-local" value={schedFinish} min={schedStart || undefined} onChange={(e) => setSchedFinish(e.target.value)} className="tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none focus:tw-border-blue-500" />
                </div>
                <div>
                  <label className="tw-mb-1.5 tw-block tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-700">{t("technician", lang)} <span className="tw-text-red-500">*</span></label>
                  {technicians.length === 0 ? (
                    <div className="tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2 tw-text-[11px] tw-text-blue-gray-500">{t("noTechnicians", lang)}</div>
                  ) : (
                    <div className="tw-max-h-40 tw-overflow-y-auto tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-divide-y tw-divide-blue-gray-100">
                      <label className="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-cursor-pointer hover:tw-bg-blue-gray-50">
                        <input type="checkbox" checked={technicians.length > 0 && technicians.every((tech) => (tech.username ? assignees.includes(tech.username) : true))} onChange={() => { const allUsernames = technicians.map((tech) => tech.username).filter(Boolean) as string[]; if (allUsernames.length > 0 && allUsernames.every((name) => assignees.includes(name))) setAssignees([]); else setAssignees(allUsernames); }} className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500" />
                        <span className="tw-text-xs sm:tw-text-sm tw-font-medium tw-text-blue-gray-700">{t("allTechnicians", lang)}</span>
                      </label>
                      {technicians.map((tech) => {
                        const username = tech.username || "";
                        if (!username) return null;
                        return (
                          <label key={username} className="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-cursor-pointer hover:tw-bg-blue-gray-50">
                            <input type="checkbox" checked={assignees.includes(username)} onChange={() => toggleAssignee(username)} className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500" />
                            <span className="tw-text-xs sm:tw-text-sm tw-text-blue-gray-700">{username}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="tw-mt-4">
                <Typography className="tw-mb-1.5 tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-700">{t("chargers", lang)}</Typography>
                {choices.chargers.length === 0 ? (
                  <Typography className="tw-text-[11px] tw-text-blue-gray-400">{t("noChargers", lang)}</Typography>
                ) : (
                  <div className="tw-flex tw-flex-col tw-gap-2">
                    {choices.chargers.map((c) => {
                      const k = equipKey(c);
                      return (
                        <label key={k} className="tw-inline-flex tw-items-center tw-gap-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-700">
                          <input type="checkbox" checked={!!checked[k]} onChange={() => toggle(k)} className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500" />
                          <span>{equipLabel(c)}</span>
                          {c.sn && <span className="tw-text-[11px] tw-text-blue-gray-400">({c.sn})</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="tw-mt-4">
                <Typography className="tw-mb-1.5 tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-700">{t("stationLevel", lang)}</Typography>
                <div className="tw-flex tw-flex-col tw-gap-2">
                  {choices.fixed.map((f) => {
                    const k = equipKey(f);
                    return (
                      <label key={k} className="tw-inline-flex tw-items-center tw-gap-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-700">
                        <input type="checkbox" checked={!!checked[k]} onChange={() => toggle(k)} className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500" />
                        {equipLabel(f)}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="tw-flex tw-justify-end tw-gap-2 tw-pt-2">
                <Button variant="text" color="gray" onClick={() => { setPlannerFormOpen(false); setSelectedWo(null); }} className="tw-normal-case">{t("close", lang)}</Button>
                <Button onClick={handleSaveEquipment} disabled={saving || choicesLoading || !choices} className="tw-normal-case">{saving ? t("saving", lang) : t("confirm", lang)}</Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

    </Card>
  );
}
