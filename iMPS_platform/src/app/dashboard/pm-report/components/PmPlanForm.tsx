"use client";

/**
 * ฟอร์มวางแผน PM แบบเต็มหน้า — โครงเดียวกับด่านวางแผนของ CM
 * (cm-report/open/input_CMreport → เข้าจากแถวในตาราง ไม่ใช่ป็อปอัปใต้ตาราง)
 *
 * เข้าถึงผ่าน URL ?view=form&planning=1&wonum=<WONUM> ของแต่ละ tab PM report
 * บันทึกลง iMPS.maximo_pm_open ผ่าน POST /maximo/pm/{wonum}/equipment
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardBody, CardHeader, Typography } from "@material-tailwind/react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "@/utils/api";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import {
  derivePlanningStatus,
  equipKey,
  equipLabel,
  formatDate,
  planningChipClass,
  PM_PLANNING_ROLES,
  toDateTimeLocalValue,
  type EquipmentChoices,
  type EquipmentItem,
  type MaximoSource,
  type MaximoWorkOrder,
  type TechnicianOption,
} from "./planning";

const T = {
  title: { th: "วางแผนงาน PM", en: "Plan PM work order" },
  subtitle: {
    th: "เลือกอุปกรณ์ที่จะ PM กำหนดการ และช่างผู้รับผิดชอบ",
    en: "Choose equipment, schedule and assigned technicians",
  },
  back: { th: "กลับไปหน้ารายการ", en: "Back to list" },
  loading: { th: "กำลังโหลด…", en: "Loading…" },
  notFound: { th: "ไม่พบใบงานนี้", en: "Work order not found" },
  plannerOnly: { th: "เฉพาะ Planner / Admin เท่านั้นที่วางแผนได้", en: "Only planner or admin can plan" },

  woSection: { th: "ข้อมูลใบงานจาก Maximo", en: "Work order from Maximo" },
  planSection: { th: "ข้อมูลการวางแผน", en: "Planning details" },
  equipSection: { th: "อุปกรณ์ที่จะ PM", en: "Equipment to PM" },

  workOrder: { th: "WO", en: "WO" },
  location: { th: "Location", en: "Location" },
  station: { th: "สถานี", en: "Station" },
  company: { th: "บริษัท", en: "Company" },
  pmDate: { th: "วันที่ PM", en: "PM date" },
  description: { th: "รายละเอียด", en: "Description" },

  planningStatus: { th: "สถานะวางแผน", en: "Planning status" },
  planned: { th: "วางแผนแล้ว", en: "Planned" },
  pending: { th: "รอวางแผน", en: "Pending" },
  selectedCount: { th: "จำนวนอุปกรณ์ที่เลือก", en: "Selected equipment count" },
  plannedAt: { th: "วันที่/เวลาที่วางแผน", en: "Planned at" },
  schedStart: { th: "วันที่เริ่มตามแผน", en: "Scheduled start" },
  schedFinish: { th: "วันที่เสร็จตามแผน", en: "Scheduled finish" },
  technician: { th: "ช่างผู้รับผิดชอบ", en: "Technician" },
  allTechnicians: { th: "ทั้งหมด", en: "All" },
  noTechnicians: { th: "ไม่พบช่าง", en: "No technicians found" },
  chargers: { th: "ตู้ชาร์จ", en: "Chargers" },
  stationLevel: { th: "อุปกรณ์ระดับสถานี", en: "Station-level equipment" },
  noChargers: { th: "ไม่พบตู้ชาร์จในสถานีนี้", en: "No chargers found in this station" },

  cancel: { th: "ยกเลิก", en: "Cancel" },
  save: { th: "บันทึกแผน", en: "Save plan" },
  saving: { th: "กำลังบันทึก…", en: "Saving…" },

  errSched: { th: "กรุณาระบุวันที่เริ่มและวันที่เสร็จตามแผน", en: "Scheduled start and finish are required" },
  errTech: { th: "กรุณาเลือกช่างอย่างน้อย 1 คน", en: "Select at least one technician" },
  errEquip: { th: "กรุณาเลือกอุปกรณ์ที่จะ PM อย่างน้อย 1 รายการ", en: "Select at least one equipment" },
  errLoad: { th: "โหลดใบงานไม่สำเร็จ", en: "Failed to load work order" },
  errChoices: { th: "โหลดรายการอุปกรณ์ไม่สำเร็จ", en: "Failed to load equipment list" },
  errSave: { th: "บันทึกแผนไม่สำเร็จ", en: "Failed to save plan" },
} as const;

const t = (key: keyof typeof T, lang: Lang) => T[key][lang === "en" ? "en" : "th"];

type Props = {
  source: MaximoSource;
  /** SN สำหรับ charger, station_id สำหรับ tab อื่น — ใช้หา WO ชุดเดียวกับที่ตารางแสดง */
  identifier?: string | null;
  wonum: string;
  /** บันทึกสำเร็จ → กลับไปหน้ารายการและ refresh */
  onSaved: () => void;
  onCancel: () => void;
};

const labelCls =
  "tw-mb-1.5 tw-block tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-700";
const inputCls =
  "tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none focus:tw-border-blue-500";

export default function PmPlanForm({ source, identifier, wonum, onSaved, onCancel }: Props) {
  const { lang } = useLanguage();

  const [wo, setWo] = useState<MaximoWorkOrder | null>(null);
  const [choices, setChoices] = useState<EquipmentChoices | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [canPlan, setCanPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [plannedAt, setPlannedAt] = useState("");
  const [schedStart, setSchedStart] = useState("");
  const [schedFinish, setSchedFinish] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);

  const selectedCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked]
  );

  const load = useCallback(async () => {
    if (!wonum) return;
    setLoading(true);
    setError("");
    try {
      const [meRes, woRes, choicesRes, techRes] = await Promise.all([
        apiFetch("/me"),
        apiFetch(
          `/maximo/pm/open?source=${encodeURIComponent(source)}` +
          `&identifier=${encodeURIComponent(identifier ?? "")}&only_open=true`
        ),
        apiFetch(`/maximo/pm/${encodeURIComponent(wonum)}/equipment-choices`),
        apiFetch("/users/by-role?role=technician"),
      ]);

      const me = await meRes.json().catch(() => ({} as any));
      setCanPlan(PM_PLANNING_ROLES.includes(String(me?.role ?? "").trim().toLowerCase()));

      const woJson = await woRes.json().catch(() => ({} as any));
      const found: MaximoWorkOrder | undefined = (Array.isArray(woJson?.items) ? woJson.items : [])
        .find((x: MaximoWorkOrder) => String(x?.wonum ?? "") === wonum);
      if (!found) {
        setError(t("notFound", lang));
        setLoading(false);
        return;
      }
      setWo(found);

      // ค่าตั้งต้นของฟอร์มมาจากแผนเดิม — เข้ามาแก้แผนซ้ำได้โดยไม่ต้องกรอกใหม่หมด
      setPlannedAt(toDateTimeLocalValue(found.planned_at ?? new Date().toISOString()));
      setSchedStart(toDateTimeLocalValue(found.sched_start));
      setSchedFinish(toDateTimeLocalValue(found.sched_finish));
      setAssignees(Array.isArray(found.assignees) ? found.assignees.filter(Boolean) : []);

      const cJson = await choicesRes.json().catch(() => ({} as any));
      if (!choicesRes.ok) {
        setError(String(cJson?.detail || t("errChoices", lang)));
      } else {
        const data: EquipmentChoices = {
          wonum: cJson?.wonum ?? wonum,
          station_id: cJson?.station_id ?? null,
          location: cJson?.location ?? null,
          chargers: Array.isArray(cJson?.chargers) ? cJson.chargers : [],
          fixed: Array.isArray(cJson?.fixed) ? cJson.fixed : [],
          selected_equipment: Array.isArray(cJson?.selected_equipment) ? cJson.selected_equipment : [],
        };
        setChoices(data);
        const preset: Record<string, boolean> = {};
        data.selected_equipment.forEach((e) => { preset[equipKey(e)] = true; });
        setChecked(preset);
      }

      const techJson = await techRes.json().catch(() => ({} as any));
      if (techRes.ok) setTechnicians(Array.isArray(techJson?.users) ? techJson.users : []);
    } catch (err) {
      console.error("pm plan load error:", err);
      setError(t("errLoad", lang));
    } finally {
      setLoading(false);
    }
  }, [source, identifier, wonum, lang]);

  useEffect(() => { load(); }, [load]);

  const toggle = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleAssignee = (username: string) =>
    setAssignees((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev.filter(Boolean), username]
    );

  const technicianNames = useMemo(
    () => technicians.map((x) => x.username).filter(Boolean) as string[],
    [technicians]
  );
  const allTechChecked =
    technicianNames.length > 0 && technicianNames.every((n) => assignees.includes(n));

  const onSave = async () => {
    if (!choices || saving) return;

    const equipment = [...choices.chargers, ...choices.fixed]
      .filter((e) => checked[equipKey(e)])
      .map((e: EquipmentItem) => ({
        type: e.type,
        ...(e.sn ? { sn: e.sn } : {}),
        ...(e.location ? { location: e.location } : {}),
        ...(e.label ? { label: e.label } : {}),
      }));

    // ตรวจครบทั้ง 3 อย่างก่อนยิง — backend เก็บ planning_status = planned ก็ต่อเมื่อมีอุปกรณ์
    if (equipment.length === 0) { setError(t("errEquip", lang)); return; }
    if (!schedStart || !schedFinish) { setError(t("errSched", lang)); return; }
    if (assignees.length === 0) { setError(t("errTech", lang)); return; }

    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/maximo/pm/${encodeURIComponent(wonum)}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment,
          planned_at: plannedAt || new Date().toISOString(),
          sched_start: schedStart,
          sched_finish: schedFinish,
          assignees,
        }),
      });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setError(String(j?.detail || t("errSave", lang)));
        return;
      }
      onSaved();
    } catch (err) {
      console.error("pm plan save error:", err);
      setError(t("errSave", lang));
    } finally {
      setSaving(false);
    }
  };

  const planStatus = derivePlanningStatus(selectedCount, wo?.planning_status ?? "pending");

  return (
    <Card className="tw-border tw-border-gray-200 tw-shadow-sm tw-mt-4 sm:tw-mt-6 lg:tw-mt-8 tw-mx-2 sm:tw-mx-4 lg:tw-mx-0 tw-rounded-2xl tw-overflow-hidden">
      <CardHeader
        floated={false}
        shadow={false}
        className="tw-p-3 sm:tw-p-4 lg:tw-p-6 tw-rounded-none tw-m-0 tw-bg-gradient-to-r tw-from-white tw-to-blue-gray-50/30"
      >
        <div className="tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-center sm:tw-justify-between tw-gap-3">
          <div className="tw-min-w-0 tw-flex-1">
            <Typography variant="h5" color="blue-gray" className="tw-text-sm sm:tw-text-base lg:tw-text-lg tw-font-semibold tw-leading-tight">
              {t("title", lang)}
            </Typography>
            <Typography variant="small" className="tw-mt-0.5 tw-text-[11px] sm:tw-text-xs lg:tw-text-sm tw-font-normal tw-text-blue-gray-400">
              {t("subtitle", lang)}
            </Typography>
          </div>
          <Button
            variant="outlined"
            size="sm"
            onClick={onCancel}
            className="tw-flex tw-items-center tw-gap-1.5 tw-normal-case tw-text-xs sm:tw-text-sm tw-flex-shrink-0"
          >
            <ArrowLeftIcon className="tw-h-4 tw-w-4" />
            {t("back", lang)}
          </Button>
        </div>
      </CardHeader>

      <CardBody className="tw-p-3 sm:tw-p-4 lg:tw-p-6 tw-space-y-4">
        {error && (
          <div className="tw-rounded-lg tw-border tw-border-red-200 tw-bg-red-50 tw-px-3 tw-py-2 tw-text-xs sm:tw-text-sm tw-text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="tw-flex tw-items-center tw-gap-2 tw-py-6 tw-text-xs sm:tw-text-sm tw-text-blue-gray-500">
            <span className="tw-h-4 tw-w-4 tw-animate-spin tw-rounded-full tw-border-2 tw-border-blue-500 tw-border-t-transparent" />
            {t("loading", lang)}
          </div>
        ) : !wo ? null : (
          <>
            {/* ── ข้อมูลใบงานจาก Maximo (อ่านอย่างเดียว) ── */}
            <section>
              <div className="tw-mb-2 tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-500">
                {t("woSection", lang)}
              </div>
              <div className="tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-blue-gray-50 tw-px-3 tw-py-3 tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-x-6 tw-gap-y-1.5 tw-text-[11px] sm:tw-text-xs tw-text-blue-gray-700">
                <div><span className="tw-font-semibold">{t("workOrder", lang)}:</span> {wo.wonum || "-"}</div>
                <div><span className="tw-font-semibold">{t("pmDate", lang)}:</span> {formatDate(wo.pm_date, lang)}</div>
                <div><span className="tw-font-semibold">{t("location", lang)}:</span> {wo.location || "-"}</div>
                <div><span className="tw-font-semibold">{t("station", lang)}:</span> {wo.station_id || "-"}</div>
                <div><span className="tw-font-semibold">{t("company", lang)}:</span> {wo.company || "-"}</div>
                {wo.description && (
                  <div className="sm:tw-col-span-2">
                    <span className="tw-font-semibold">{t("description", lang)}:</span> {wo.description}
                  </div>
                )}
              </div>
            </section>

            {/* ── ข้อมูลการวางแผน ── */}
            <section>
              <div className="tw-mb-2 tw-flex tw-items-center tw-justify-between tw-gap-3">
                <div className="tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-500">
                  {t("planSection", lang)}
                </div>
                <div className="tw-flex tw-items-center tw-gap-2">
                  <span className="tw-text-[11px] tw-text-blue-gray-500">
                    {t("selectedCount", lang)}: <b className="tw-text-blue-gray-800">{selectedCount}</b>
                  </span>
                  <span className={`tw-inline-flex tw-items-center tw-rounded-full tw-border tw-px-2.5 tw-py-1 tw-text-[11px] tw-font-semibold ${planningChipClass(planStatus)}`}>
                    {planStatus === "planned" ? t("planned", lang) : t("pending", lang)}
                  </span>
                </div>
              </div>

              <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-3">
                <div>
                  <label className={labelCls}>{t("plannedAt", lang)}</label>
                  <input
                    type="datetime-local"
                    value={plannedAt}
                    disabled={!canPlan}
                    onChange={(e) => setPlannedAt(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t("schedStart", lang)} <span className="tw-text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={schedStart}
                    min={plannedAt || undefined}
                    disabled={!canPlan}
                    onChange={(e) => setSchedStart(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t("schedFinish", lang)} <span className="tw-text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={schedFinish}
                    min={schedStart || undefined}
                    disabled={!canPlan}
                    onChange={(e) => setSchedFinish(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {t("technician", lang)} <span className="tw-text-red-500">*</span>
                  </label>
                  {technicians.length === 0 ? (
                    <div className="tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2 tw-text-[11px] tw-text-blue-gray-500">
                      {t("noTechnicians", lang)}
                    </div>
                  ) : (
                    <div className="tw-max-h-40 tw-overflow-y-auto tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-divide-y tw-divide-blue-gray-100">
                      <label className="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-cursor-pointer hover:tw-bg-blue-gray-50">
                        <input
                          type="checkbox"
                          checked={allTechChecked}
                          disabled={!canPlan}
                          onChange={() => setAssignees(allTechChecked ? [] : technicianNames)}
                          className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500"
                        />
                        <span className="tw-text-xs sm:tw-text-sm tw-font-medium tw-text-blue-gray-700">
                          {t("allTechnicians", lang)}
                        </span>
                      </label>
                      {technicianNames.map((username) => (
                        <label key={username} className="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-cursor-pointer hover:tw-bg-blue-gray-50">
                          <input
                            type="checkbox"
                            checked={assignees.includes(username)}
                            disabled={!canPlan}
                            onChange={() => toggleAssignee(username)}
                            className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500"
                          />
                          <span className="tw-text-xs sm:tw-text-sm tw-text-blue-gray-700">{username}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── อุปกรณ์ที่จะ PM ── */}
            {choices && (
              <section>
                <div className="tw-mb-2 tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-500">
                  {t("equipSection", lang)}
                </div>
                <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-3">
                  <div className="tw-rounded-xl tw-border tw-border-blue-gray-100 tw-p-3">
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
                            <label key={k} className="tw-inline-flex tw-items-center tw-gap-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-700">
                              <input
                                type="checkbox"
                                checked={!!checked[k]}
                                disabled={!canPlan}
                                onChange={() => toggle(k)}
                                className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500"
                              />
                              <span>{equipLabel(c)}</span>
                              {c.sn && <span className="tw-text-[11px] tw-text-blue-gray-400">({c.sn})</span>}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="tw-rounded-xl tw-border tw-border-blue-gray-100 tw-p-3">
                    <Typography className="tw-mb-1.5 tw-text-[11px] sm:tw-text-xs tw-font-semibold tw-text-blue-gray-700">
                      {t("stationLevel", lang)}
                    </Typography>
                    <div className="tw-flex tw-flex-col tw-gap-2">
                      {choices.fixed.map((f) => {
                        const k = equipKey(f);
                        return (
                          <label key={k} className="tw-inline-flex tw-items-center tw-gap-2 tw-text-xs sm:tw-text-sm tw-text-blue-gray-700">
                            <input
                              type="checkbox"
                              checked={!!checked[k]}
                              disabled={!canPlan}
                              onChange={() => toggle(k)}
                              className="tw-h-4 tw-w-4 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500"
                            />
                            {equipLabel(f)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {!canPlan && (
              <div className="tw-rounded-lg tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-3 tw-py-2 tw-text-[11px] sm:tw-text-xs tw-text-amber-800">
                {t("plannerOnly", lang)}
              </div>
            )}

            <div className="tw-flex tw-justify-end tw-gap-2 tw-pt-2">
              <Button variant="text" color="gray" size="sm" onClick={onCancel} className="tw-normal-case">
                {t("cancel", lang)}
              </Button>
              <Button
                size="sm"
                onClick={onSave}
                disabled={!canPlan || saving || !choices}
                className="tw-normal-case tw-bg-gradient-to-b tw-from-neutral-800 tw-to-neutral-900 hover:tw-to-black"
              >
                {saving ? t("saving", lang) : t("save", lang)}
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
