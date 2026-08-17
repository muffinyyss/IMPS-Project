"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, Typography, Dialog, DialogHeader, DialogBody, DialogFooter, Button } from "@material-tailwind/react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "@/utils/api";
import { useLanguage, type Lang } from "@/utils/useLanguage";

export type MaximoSource = "charger" | "mdb" | "ccb" | "cbbox" | "station";

/** ใบงาน PM ที่ Maximo เปิดแล้วยิงเข้ามาทาง IN06 (POST /maximo/pm/open) */
export type MaximoWorkOrder = {
  // 5 field ตาม contract IN06
  location?: string | null;
  pm_date?: string | null;
  wonum?: string | null;
  status?: string | null;
  company?: string | null;
  description?: string | null;
  // ที่ iMPS map ให้เอง
  station_id?: string | null;
  sn?: string | null;
  origin?: string | null;
  selected_equipment?: EquipmentItem[] | null;
  selected_at?: string | null;
  selected_by?: string | null;
  planning_status?: string | null;
  receivedAt?: string | null;
};

export type EquipmentItem = {
  type: string;              // charger / mdb / ccb / cbbox / station
  sn?: string | null;        // เฉพาะ charger
  location?: string | null;
  label?: string | null;
};

export function derivePlanningStatus(
  selectedCountOrItems: number | Array<EquipmentItem | null | undefined> | null | undefined,
  current?: string | null
): "pending" | "planned" {
  const normalized = String(current ?? "").trim().toLowerCase();
  if (normalized === "planned") return "planned";
  if (normalized === "pending") return "pending";

  const count = Array.isArray(selectedCountOrItems)
    ? selectedCountOrItems.filter(Boolean).length
    : Number(selectedCountOrItems ?? 0);

  return count > 0 ? "planned" : "pending";
}

type EquipmentChoices = {
  wonum: string;
  station_id?: string | null;
  location?: string | null;
  chargers: EquipmentItem[];
  fixed: EquipmentItem[];
  selected_equipment: EquipmentItem[];
};

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

// ป้ายชื่ออุปกรณ์ระดับสถานี — ให้ตรงกับชื่อ tab ในหน้า PM report
const FIXED_LABELS: Record<string, string> = {
  mdb: "MDB",
  ccb: "CCB",
  cbbox: "CB_BOX",
  station: "Station",
};

/** key ประจำอุปกรณ์ 1 ตัว — charger แยกด้วย sn, ที่เหลือใช้ type ตรง ๆ */
function equipKey(e: EquipmentItem) {
  return e.type === "charger" ? `charger:${e.sn ?? ""}` : e.type;
}

function equipLabel(e: EquipmentItem) {
  return e.label || FIXED_LABELS[e.type] || e.sn || e.type;
}

// Same date formatting as the surrounding PM tables
function formatDate(iso?: string | null, lang: Lang = "th") {
  if (!iso) return "-";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00Z") : new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "th-TH-u-ca-gregory", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function statusChipClass(status?: string | null) {
  const s = String(status ?? "").toUpperCase();
  if (s === "COMP" || s === "CLOSE" || s === "CLOSED")
    return "tw-bg-green-50 tw-text-green-700 tw-border-green-200";
  if (s === "INPRG") return "tw-bg-amber-50 tw-text-amber-700 tw-border-amber-200";
  if (s === "OPEN" || s === "APPR" || s === "WAPPR")
    return "tw-bg-blue-50 tw-text-blue-700 tw-border-blue-200";
  if (s === "CAN" || s === "CANCELLED")
    return "tw-bg-red-50 tw-text-red-700 tw-border-red-200";
  return "tw-bg-blue-gray-50 tw-text-blue-gray-700 tw-border-blue-gray-200";
}

function planningChipClass(status: "pending" | "planned") {
  return status === "planned"
    ? "tw-bg-emerald-50 tw-text-emerald-700 tw-border-emerald-200"
    : "tw-bg-amber-50 tw-text-amber-700 tw-border-amber-200";
}

export default function MaximoWorkOrders({ source, identifier }: Props) {
  const { lang } = useLanguage();
  const [items, setItems] = useState<MaximoWorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  // ── dialog เลือกอุปกรณ์ที่จะ PM ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWo, setSelectedWo] = useState<MaximoWorkOrder | null>(null);
  const [choices, setChoices] = useState<EquipmentChoices | null>(null);
  const [choicesLoading, setChoicesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string>("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [canPlan, setCanPlan] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      try {
        const res = await apiFetch("/me");
        const me = await res.json().catch(() => ({} as any));
        const role = String(me?.role ?? "").trim().toLowerCase();
        if (active) {
          setCanPlan(["admin", "owner", "planner"].includes(role));
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
    setDialogOpen(true);
    setDialogError("");
    setChoices(null);
    setChecked({});
    setChoicesLoading(true);
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
  }

  function toggle(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
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

    setSaving(true);
    setDialogError("");
    try {
      const res = await apiFetch(
        `/maximo/pm/${encodeURIComponent(selectedWo.wonum)}/equipment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ equipment }),
        }
      );
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setDialogError(String(j?.detail || t("saveError", lang)));
        return;
      }
      const nextStatus = derivePlanningStatus(equipment.length, selectedWo.planning_status ?? "pending");
      setSelectedWo((prev) => prev ? { ...prev, planning_status: nextStatus, selected_equipment: equipment } : prev);
      setDialogOpen(false);
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

      <Dialog open={dialogOpen} handler={() => setDialogOpen(false)} size="md">
        <DialogHeader className="tw-text-sm sm:tw-text-base">
          {t("pickEquipment", lang)}
        </DialogHeader>
        <DialogBody divider className="tw-space-y-3 tw-max-h-[60vh] tw-overflow-y-auto">
          {selectedWo && (
            <div className="tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-blue-gray-50 tw-px-3 tw-py-2 tw-text-[11px] sm:tw-text-xs tw-text-blue-gray-700">
              <div><span className="tw-font-semibold">{t("workOrder", lang)}:</span> {selectedWo.wonum || "-"}</div>
              <div><span className="tw-font-semibold">{t("location", lang)}:</span> {selectedWo.location || "-"}</div>
              <div><span className="tw-font-semibold">{t("pmDate", lang)}:</span> {formatDate(selectedWo.pm_date, lang)}</div>
              {selectedWo.company && (
                <div><span className="tw-font-semibold">{t("company", lang)}:</span> {selectedWo.company}</div>
              )}
            </div>
          )}

          {dialogError && (
            <div className="tw-rounded-lg tw-border tw-border-red-200 tw-bg-red-50 tw-px-3 tw-py-2 tw-text-xs tw-text-red-700">
              {dialogError}
            </div>
          )}

          {choicesLoading ? (
            <div className="tw-flex tw-items-center tw-gap-2 tw-text-xs tw-text-blue-gray-500 tw-py-2">
              <span className="tw-w-4 tw-h-4 tw-border-2 tw-border-blue-500 tw-border-t-transparent tw-rounded-full tw-animate-spin" />
              {t("loading", lang)}
            </div>
          ) : choices ? (
            <>
              <div className="tw-rounded-xl tw-border tw-border-indigo-200 tw-bg-indigo-50/70 tw-p-3">
                <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
                  <div>
                    <div className="tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-500">
                      {t("planningSection", lang)}
                    </div>
                    <div className="tw-mt-1 tw-text-sm tw-font-semibold tw-text-blue-gray-900">
                      {t("planningStatus", lang)}
                    </div>
                  </div>
                  <span
                    className={`tw-inline-flex tw-items-center tw-rounded-full tw-border tw-px-2.5 tw-py-1 tw-text-[11px] tw-font-semibold ${planningChipClass(
                      derivePlanningStatus(Object.values(checked).filter(Boolean).length, selectedWo?.planning_status ?? "pending")
                    )}`}
                  >
                    {derivePlanningStatus(Object.values(checked).filter(Boolean).length, selectedWo?.planning_status ?? "pending") === "planned"
                      ? t("planned", lang)
                      : t("pending", lang)}
                  </span>
                </div>
                <div className="tw-mt-2 tw-flex tw-items-center tw-gap-2 tw-text-xs tw-text-blue-gray-600">
                  <span>{t("selectedCount", lang)}:</span>
                  <span className="tw-font-semibold tw-text-blue-gray-800">
                    {Object.values(checked).filter(Boolean).length}
                  </span>
                </div>
              </div>

              <div>
                <Typography className="tw-mb-1.5 tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-700">
                  {t("chargers", lang)}
                </Typography>
                {choices.chargers.length === 0 ? (
                  <Typography className="tw-text-[11px] tw-text-blue-gray-400">
                    {t("noChargers", lang)}
                  </Typography>
                ) : (
                  <div className="tw-flex tw-flex-col tw-gap-2">
                    {choices.chargers.map((c) => {
                      const k = equipKey(c);
                      return (
                        <label
                          key={k}
                          className="tw-inline-flex tw-items-center tw-gap-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={!!checked[k]}
                            onChange={() => toggle(k)}
                            className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500"
                          />
                          <span>{equipLabel(c)}</span>
                          {c.sn && (
                            <span className="tw-text-[11px] tw-text-blue-gray-400">({c.sn})</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <Typography className="tw-mb-1.5 tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-700">
                  {t("stationLevel", lang)}
                </Typography>
                <div className="tw-flex tw-flex-col tw-gap-2">
                  {choices.fixed.map((f) => {
                    const k = equipKey(f);
                    return (
                      <label
                        key={k}
                        className="tw-inline-flex tw-items-center tw-gap-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={!!checked[k]}
                          onChange={() => toggle(k)}
                          className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500"
                        />
                        {equipLabel(f)}
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </DialogBody>
        <DialogFooter className="tw-gap-2">
          <Button variant="text" color="gray" onClick={() => setDialogOpen(false)} className="tw-normal-case">
            {t("close", lang)}
          </Button>
          <Button
            onClick={handleSaveEquipment}
            disabled={saving || choicesLoading || !choices}
            className="tw-normal-case"
          >
            {saving ? t("saving", lang) : t("confirm", lang)}
          </Button>
        </DialogFooter>
      </Dialog>
    </Card>
  );
}
