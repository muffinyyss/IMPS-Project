"use client";

/**
 * ฟอร์มวางแผน PM แบบเต็มหน้า — ใช้แพทเทิร์นเดียวกับฟอร์ม CM
 * (cm-report/open/input_CMreport/components/checkList.tsx):
 *   section > ปุ่มย้อนกลับ (ไอคอน) > การ์ดขาว max-w-6xl > หัวเอกสาร (โลโก้ + ที่อยู่ กฟผ.)
 *   > badge Maximo > meta readonly > section เลขกำกับหัวสีเทาเข้ม > แถบปุ่มล่าง
 *
 * เข้าถึงผ่าน URL ?view=form&planning=1&wonum=<WONUM> ของแต่ละ tab PM report
 * บันทึกลง iMPS.maximo_pm_open ผ่าน POST /maximo/pm/{wonum}/equipment
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Button, Input } from "@material-tailwind/react";
import { ArrowLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
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

// ใช้หัวเอกสารชุดเดียวกับ CM
const LOGO_SRC = "/img/logo_egat.png";

const T = {
  pageTitle: { th: "วางแผนงานบำรุงรักษา (PM)", en: "Preventive Maintenance Plan (PM)" },
  companyName: {
    th: "การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย (กฟผ.)",
    en: "Electricity Generating Authority of Thailand (EGAT)",
  },
  companyAddressLine1: {
    th: "เลขที่ 53 หมู่ 2 ถนนจรัญสนิทวงศ์ ตำบลบางกรวย อำเภอบางกรวย",
    en: "53 Moo 2, Charan Sanitwong Rd., Bang Kruai, Bang Kruai",
  },
  companyAddressLine2: {
    th: "จังหวัดนนทบุรี 11130 ศูนย์บริการข้อมูล กฟผ. สายด่วน 1416",
    en: "Nonthaburi 11130, EGAT Call Center: 1416",
  },

  backToList: { th: "Back", en: "Back" },
  loading: { th: "กำลังโหลด…", en: "Loading…" },
  notFound: { th: "ไม่พบใบงานนี้", en: "Work order not found" },
  plannerOnlyTitle: { th: "วางแผนใบงานนี้ไม่ได้", en: "Cannot plan this work order" },
  noStationTitle: { th: "ใบงานนี้ยังไม่ผูกกับสถานีใน iMPS", en: "This work order is not linked to an iMPS station" },
  noStationBody: {
    th: "จึงยังไม่รู้ว่าเป็นสถานีไหน และดึงรายการตู้ชาร์จมาให้เลือกไม่ได้ — ตั้งค่า maximo_location ของสถานีให้ตรงกับ Location ด้านบนที่หน้า EV Stations ก่อน",
    en: "The station is unknown, so chargers cannot be listed — set the station's maximo_location to match the Location above on the EV Stations page",
  },
  plannerOnlyBody: {
    th: "เฉพาะ Planner / Owner / Admin เท่านั้นที่แก้แผนได้ — ดูข้อมูลได้อย่างเดียว",
    en: "Only planner, owner or admin can edit the plan — view only",
  },

  planSection: { th: "ข้อมูลการวางแผน", en: "Planning details" },
  equipSection: { th: "อุปกรณ์ที่จะ PM", en: "Equipment to PM" },
  selectedCount: { th: "เลือกแล้ว", en: "Selected" },
  items: { th: "รายการ", en: "item(s)" },
  allEquipment: { th: "ทั้งหมด", en: "All" },
  noEquipment: { th: "ไม่พบอุปกรณ์ในสถานีนี้", en: "No equipment found in this station" },

  workOrder: { th: "เลขที่ใบงาน (WO)", en: "Work order (WO)" },
  location: { th: "Location", en: "Location" },
  station: { th: "สถานี", en: "Station" },
  company: { th: "บริษัท", en: "Company" },
  pmDate: { th: "วันที่ PM", en: "PM date" },
  description: { th: "รายละเอียดใบงาน", en: "Work order description" },

  // ป้ายสถานะใช้ชื่อเดียวกับตาราง: ยังไม่ assign = Open, assign แล้ว = In Progress
  planned: { th: "In Progress", en: "In Progress" },
  pending: { th: "Open", en: "Open" },
  plannedAt: { th: "วันที่/เวลาที่วางแผน", en: "Planned at" },
  schedStart: { th: "วันที่เริ่มตามแผน", en: "Scheduled start" },
  schedFinish: { th: "วันที่เสร็จตามแผน", en: "Scheduled finish" },
  schedRangeError: {
    th: "วันที่เสร็จต้องไม่ก่อนวันที่เริ่ม",
    en: "Finish date must not be before the start date",
  },
  technician: { th: "ช่างผู้รับผิดชอบ", en: "Technician" },
  allTechnicians: { th: "ทั้งหมด", en: "All" },
  noTechnicians: { th: "ไม่พบช่าง", en: "No technicians found" },

  save: { th: "Assign", en: "Assign" },
  saving: { th: "กำลังมอบหมาย…", en: "Assigning…" },

  errSched: { th: "กรุณาระบุวันที่เริ่มและวันที่เสร็จตามแผน", en: "Scheduled start and finish are required" },
  errTech: { th: "กรุณาเลือกช่างอย่างน้อย 1 คน", en: "Select at least one technician" },
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

// class ชุดเดียวกับ CM form
const LABEL = "tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2";
const FIELD =
  "tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none focus:tw-border-blue-500";
const FIELD_RO =
  "tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-gray-100 tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-700 tw-cursor-default focus:tw-outline-none";

/** หัว section แบบเดียวกับ CM — วงกลมเลข + แถบเทาเข้ม */
function SectionHeader({ no, title, right }: { no: number; title: string; right?: React.ReactNode }) {
  return (
    <div className="tw-flex tw-items-center tw-gap-3 tw-bg-gray-700 tw-px-4 tw-py-3 tw-text-white">
      <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-white tw-text-gray-700 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-sm">
        {no}
      </div>
      <span className="tw-font-semibold tw-text-base">{title}</span>
      {right && <div className="tw-ml-auto">{right}</div>}
    </div>
  );
}

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

  // ตู้ชาร์จ + อุปกรณ์ระดับสถานี อยู่ในลิสต์เดียวกัน ไม่ต้องแยกหัวข้อ
  const equipmentOptions = useMemo(
    () => (choices ? [...choices.chargers, ...choices.fixed] : []),
    [choices]
  );
  const allEquipChecked =
    equipmentOptions.length > 0 && equipmentOptions.every((e) => checked[equipKey(e)]);

  const toggle = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleAllEquipment = () => {
    if (allEquipChecked) {
      setChecked({});
      return;
    }
    const next: Record<string, boolean> = {};
    equipmentOptions.forEach((e) => { next[equipKey(e)] = true; });
    setChecked(next);
  };

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

  // เทียบเป็น string ได้เพราะ datetime-local เป็น ISO เรียงตัวอักษรตรงกับเรียงเวลา
  const schedRangeInvalid = !!schedStart && !!schedFinish && schedFinish < schedStart;

  const onSave = async () => {
    if (saving) return;

    const equipment = choices
      ? equipmentOptions
        .filter((e) => checked[equipKey(e)])
        .map((e: EquipmentItem) => ({
          type: e.type,
          ...(e.sn ? { sn: e.sn } : {}),
          ...(e.location ? { location: e.location } : {}),
          ...(e.label ? { label: e.label } : {}),
        }))
      : null;

    if (!schedStart || !schedFinish) { setError(t("errSched", lang)); return; }
    if (schedRangeInvalid) { setError(t("schedRangeError", lang)); return; }
    if (assignees.length === 0) { setError(t("errTech", lang)); return; }

    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/maximo/pm/${encodeURIComponent(wonum)}/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ยังโหลดรายการอุปกรณ์ไม่ได้ = ไม่ส่งฟิลด์นี้ ให้ backend คงของเดิมไว้
        body: JSON.stringify({
          ...(equipment ? { equipment } : {}),
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
    <section className="tw-pb-24">
      {/* ปุ่มย้อนกลับ — ไอคอนอย่างเดียว ชิดซ้าย เหมือนฟอร์ม CM */}
      <div className="tw-mx-auto tw-max-w-6xl tw-mb-6 tw-flex tw-items-center tw-justify-between">
        <Button
          variant="outlined"
          size="sm"
          onClick={onCancel}
          title={t("backToList", lang)}
          aria-label={t("backToList", lang)}
          className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300"
        >
          <ArrowLeftIcon className="tw-w-4 tw-h-4" />
        </Button>
      </div>

      <form noValidate onSubmit={(e) => e.preventDefault()}>
        <div className="tw-mx-auto tw-max-w-6xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-md tw-shadow-blue-gray-500/5 tw-p-6 md:tw-p-8">

          {/* Header */}
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-6 tw-mb-6">
            <div className="tw-flex tw-items-start tw-gap-4">
              <div className="tw-relative tw-shrink-0 tw-h-16 tw-w-[90px] md:tw-h-20 md:tw-w-[110px]">
                <Image src={LOGO_SRC} alt="Logo" fill priority className="tw-object-contain" sizes="110px" />
              </div>
              <div>
                <div className="tw-font-bold tw-text-blue-gray-900 tw-text-base md:tw-text-lg">
                  {t("pageTitle", lang)} – PM Plan ({source.toUpperCase()})
                </div>
                <div className="tw-text-sm tw-text-blue-gray-600 tw-mt-2">{t("companyName", lang)}</div>
                <div className="tw-text-xs tw-text-blue-gray-500 tw-mt-1">{t("companyAddressLine1", lang)}</div>
                <div className="tw-text-xs tw-text-blue-gray-500">{t("companyAddressLine2", lang)}</div>
              </div>
            </div>
            <div className="tw-text-left md:tw-text-right tw-text-sm tw-text-blue-gray-700 tw-border-l tw-border-blue-gray-100 tw-pl-4 md:tw-pl-6 md:tw-border-l-0 tw-pt-3 md:tw-pt-0 md:tw-shrink-0">
              <div className="tw-font-semibold tw-text-blue-gray-800">{t("workOrder", lang)}</div>
              <div className="tw-break-all tw-text-blue-gray-600 tw-mt-1">{wonum || "-"}</div>
            </div>
          </div>

          <hr className="tw-my-6 tw-border-blue-gray-100" />

          {/* Maximo badge — ชุดเดียวกับ CM */}
          <div className="tw-mb-4 tw-flex tw-flex-wrap tw-items-center tw-gap-x-4 tw-gap-y-2 tw-px-4 tw-py-2.5 tw-rounded-lg tw-bg-blue-50 tw-border tw-border-blue-200">
            <span className="tw-flex tw-items-center tw-gap-2">
              <span className="tw-text-sm tw-text-blue-700">🧾 Maximo WO:</span>
              <span className="tw-font-mono tw-font-bold tw-text-blue-900 tw-bg-blue-100 tw-px-2 tw-py-0.5 tw-rounded">
                {wonum || "-"}
              </span>
            </span>
            <span
              className={`tw-inline-flex tw-items-center tw-rounded-full tw-border tw-px-2.5 tw-py-1 tw-text-[11px] tw-font-semibold ${planningChipClass(planStatus)}`}
            >
              {planStatus === "planned" ? t("planned", lang) : t("pending", lang)}
            </span>
          </div>

          {/* หาสถานีไม่เจอ — ต้องบอกให้ชัด ไม่งั้น planner เห็นแต่ช่อง Station ว่าง
              กับรายการอุปกรณ์ที่ไม่มีตู้ชาร์จ แล้วไม่รู้ว่าเพราะอะไร */}
          {!loading && wo && !(wo.station_id || "").trim() && (
            <div className="tw-mb-4 tw-flex tw-items-start tw-gap-3 tw-px-4 tw-py-3 tw-rounded-lg tw-bg-amber-50 tw-border tw-border-amber-200">
              <ExclamationTriangleIcon className="tw-w-5 tw-h-5 tw-text-amber-500 tw-mt-0.5 tw-flex-shrink-0" />
              <div>
                <p className="tw-text-sm tw-font-semibold tw-text-amber-800">{t("noStationTitle", lang)}</p>
                <p className="tw-text-sm tw-text-amber-700 tw-mt-0.5">{t("noStationBody", lang)}</p>
              </div>
            </div>
          )}

          {/* ไม่มีสิทธิ์แก้แผน */}
          {!loading && !canPlan && (
            <div className="tw-mb-4 tw-flex tw-items-start tw-gap-3 tw-px-4 tw-py-3 tw-rounded-lg tw-bg-amber-50 tw-border tw-border-amber-200">
              <ExclamationTriangleIcon className="tw-w-5 tw-h-5 tw-text-amber-500 tw-mt-0.5 tw-flex-shrink-0" />
              <div>
                <p className="tw-text-sm tw-font-semibold tw-text-amber-800">{t("plannerOnlyTitle", lang)}</p>
                <p className="tw-text-sm tw-text-amber-700 tw-mt-0.5">{t("plannerOnlyBody", lang)}</p>
              </div>
            </div>
          )}

          {/* ข้อผิดพลาด */}
          {error && (
            <div className="tw-mb-4 tw-flex tw-items-start tw-gap-3 tw-px-4 tw-py-3 tw-rounded-lg tw-bg-red-50 tw-border tw-border-red-200">
              <ExclamationTriangleIcon className="tw-w-5 tw-h-5 tw-text-red-500 tw-mt-0.5 tw-flex-shrink-0" />
              <p className="tw-text-sm tw-text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="tw-flex tw-items-center tw-gap-2 tw-py-10 tw-justify-center tw-text-sm tw-text-blue-gray-500">
              <span className="tw-h-4 tw-w-4 tw-animate-spin tw-rounded-full tw-border-2 tw-border-blue-500 tw-border-t-transparent" />
              {t("loading", lang)}
            </div>
          ) : !wo ? null : (
            <>
              {/* Meta Info - Readonly Inputs */}
              <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-4 tw-gap-4 tw-mb-6">
                <div>
                  <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("pmDate", lang)}</label>
                  <Input value={formatDate(wo.pm_date, lang)} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
                </div>
                <div>
                  <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("location", lang)}</label>
                  <Input value={wo.location || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
                </div>
                <div>
                  <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("station", lang)}</label>
                  <Input value={wo.station_id || "— ไม่พบสถานีที่ผูกกับ location นี้ —"} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
                </div>
                <div>
                  <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("company", lang)}</label>
                  <Input value={wo.company || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
                </div>
              </div>

              {wo.description && (
                <div className="tw-mb-6">
                  <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("description", lang)}</label>
                  <div className={FIELD_RO}>{wo.description}</div>
                </div>
              )}

              {/* ═══ 1. ข้อมูลการวางแผน ═══ */}
              <div className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
                <SectionHeader no={1} title={t("planSection", lang)} />
                <div className="tw-p-4">
                  <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                    {/* วันที่/เวลาที่วางแผน — ประทับตอน planner เปิดฟอร์มเข้ามา แก้ไม่ได้ (เหมือน CM) */}
                    <div>
                      <label className={LABEL}>{t("plannedAt", lang)}</label>
                      <input
                        type="text"
                        readOnly
                        value={plannedAt ? plannedAt.replace("T", " ") : "-"}
                        className={FIELD_RO}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>
                        {t("schedStart", lang)} <span className="tw-text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={schedStart}
                        disabled={!canPlan}
                        onChange={(e) => setSchedStart(e.target.value)}
                        className={FIELD}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>
                        {t("schedFinish", lang)} <span className="tw-text-red-500">*</span>
                      </label>
                      {/* min = ปิดวันก่อนวันเริ่มใน picker — validation ยังต้องมีเพราะพิมพ์มือเลี่ยง min ได้ */}
                      <input
                        type="datetime-local"
                        value={schedFinish}
                        min={schedStart || undefined}
                        disabled={!canPlan}
                        onChange={(e) => setSchedFinish(e.target.value)}
                        className={`tw-w-full tw-rounded-lg tw-border tw-bg-white tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none ${schedRangeInvalid ? "tw-border-red-400 focus:tw-border-red-500" : "tw-border-blue-gray-200 focus:tw-border-blue-500"}`}
                      />
                      {schedRangeInvalid && (
                        <p className="tw-mt-1.5 tw-text-xs tw-text-red-600">{t("schedRangeError", lang)}</p>
                      )}
                    </div>
                    <div>
                      <label className={LABEL}>
                        {t("technician", lang)} <span className="tw-text-red-500">*</span>
                      </label>
                      {technicianNames.length > 0 && (
                        <div className="tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-divide-y tw-divide-blue-gray-50 tw-max-h-56 tw-overflow-y-auto">
                          {/* All = ติ๊กช่างทุกคนในลิสต์รวดเดียว */}
                          <label className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-cursor-pointer hover:tw-bg-blue-gray-50/60 tw-transition-colors">
                            <input
                              type="checkbox"
                              checked={allTechChecked}
                              disabled={!canPlan}
                              onChange={() => setAssignees(allTechChecked ? [] : technicianNames)}
                              className="tw-h-4 tw-w-4 tw-shrink-0 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500 tw-cursor-pointer"
                            />
                            <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">
                              {t("allTechnicians", lang)}
                            </span>
                            <span className="tw-ml-auto tw-text-xs tw-text-blue-gray-400">
                              {assignees.length}/{technicianNames.length}
                            </span>
                          </label>
                          {technicianNames.map((u) => (
                            <label key={u} className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-cursor-pointer hover:tw-bg-blue-gray-50/60 tw-transition-colors">
                              <input
                                type="checkbox"
                                checked={assignees.includes(u)}
                                disabled={!canPlan}
                                onChange={() => toggleAssignee(u)}
                                className="tw-h-4 tw-w-4 tw-shrink-0 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500 tw-cursor-pointer"
                              />
                              <span className="tw-min-w-0 tw-truncate tw-text-sm tw-text-blue-gray-800">{u}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {technicianNames.length === 0 && (
                        <p className="tw-mt-1.5 tw-text-xs tw-text-orange-600">{t("noTechnicians", lang)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══ 2. อุปกรณ์ที่จะ PM ═══ */}
              {choices && (
                <div className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
                  <SectionHeader
                    no={2}
                    title={t("equipSection", lang)}
                    right={
                      <span className="tw-text-xs tw-font-medium tw-text-white/90">
                        {t("selectedCount", lang)} {selectedCount} {t("items", lang)}
                      </span>
                    }
                  />
                  <div className="tw-p-4">
                    {/* รวมตู้ชาร์จกับอุปกรณ์ระดับสถานีเป็นลิสต์เดียว — ผู้ใช้ติ๊กจากที่เดียวจบ */}
                    {equipmentOptions.length === 0 ? (
                      <p className="tw-text-xs tw-text-orange-600">{t("noEquipment", lang)}</p>
                    ) : (
                      <div className="tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-divide-y tw-divide-blue-gray-50 tw-max-h-72 tw-overflow-y-auto">
                        <label className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-cursor-pointer hover:tw-bg-blue-gray-50/60 tw-transition-colors">
                          <input
                            type="checkbox"
                            checked={allEquipChecked}
                            disabled={!canPlan}
                            onChange={toggleAllEquipment}
                            className="tw-h-4 tw-w-4 tw-shrink-0 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500 tw-cursor-pointer"
                          />
                          <span className="tw-text-sm tw-font-semibold tw-text-blue-gray-800">
                            {t("allEquipment", lang)}
                          </span>
                          <span className="tw-ml-auto tw-text-xs tw-text-blue-gray-400">
                            {selectedCount}/{equipmentOptions.length}
                          </span>
                        </label>
                        {equipmentOptions.map((e) => {
                          const k = equipKey(e);
                          return (
                            <label key={k} className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-cursor-pointer hover:tw-bg-blue-gray-50/60 tw-transition-colors">
                              <input
                                type="checkbox"
                                checked={!!checked[k]}
                                disabled={!canPlan}
                                onChange={() => toggle(k)}
                                className="tw-h-4 tw-w-4 tw-shrink-0 tw-rounded tw-border-blue-gray-300 tw-text-blue-600 focus:tw-ring-blue-500 tw-cursor-pointer"
                              />
                              <span className="tw-min-w-0 tw-truncate tw-text-sm tw-text-blue-gray-800">
                                {equipLabel(e)}
                              </span>
                              {e.sn && (
                                <span className="tw-ml-auto tw-text-xs tw-text-blue-gray-400">{e.sn}</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions — แถบล่างแบบเดียวกับ CM */}
              <div className="tw-flex tw-items-center tw-justify-between tw-pt-6 tw-border-t tw-border-blue-gray-100">
                <div className="tw-flex-1" />
                <div className="tw-flex tw-items-center tw-gap-3">
                  <Button
                    variant="outlined"
                    onClick={onCancel}
                    className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300"
                  >
                    {t("backToList", lang)}
                  </Button>
                  <Button
                    onClick={onSave}
                    disabled={!canPlan || saving || !wo}
                    className="tw-bg-gray-800 hover:!tw-bg-blue-600 tw-text-white hover:tw-shadow-lg hover:!tw-shadow-blue-500/30 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed disabled:tw-shadow-none"
                  >
                    {saving ? t("saving", lang) : t("save", lang)}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
