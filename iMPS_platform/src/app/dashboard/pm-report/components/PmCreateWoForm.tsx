"use client";

/**
 * ฟอร์มเปิดใบงาน PM เอง — หน้าตาชุดเดียวกับ PmPlanForm (หน้าวางแผนของใบงาน Maximo)
 * ต่างกันแค่ "เลือกสถานีเองได้" ที่ด้านบน เพราะใบนี้ไม่ได้มี location มาจาก Maximo
 *
 * เข้าถึงจากหน้า PM List → ปุ่ม "เพิ่มใบงาน" (/dashboard/pm-list/create)
 * บันทึกลง iMPS.maximo_pm_open ผ่าน POST /maximo/pm/work-orders (ไม่ยิงไป Maximo)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@material-tailwind/react";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, ExclamationTriangleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "@/utils/api";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import PmAssigneePicker from "./PmAssigneePicker";
import {
  EMPTY_PM_ASSIGNEE_OPTIONS,
  equipKey,
  equipLabel,
  fetchPmAssigneeOptions,
  pmAssigneeGroups,
  pmAssigneeNames,
  PM_PLANNING_ROLES,
  type EquipmentChoices,
  type EquipmentItem,
  type PmAssigneeOptions,
} from "./planning";

// ใช้หัวเอกสารชุดเดียวกับหน้าวางแผน/ฟอร์ม CM
const LOGO_SRC = "/img/logo_egat.png";

const T = {
  pageTitle: { th: "วางแผนงานบำรุงรักษา (PM)", en: "Preventive Maintenance Plan (PM)" },
  formTitle: { th: "เปิดใบงานใหม่", en: "New work order" },
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
  workOrder: { th: "เลขที่ใบงาน", en: "Work order" },
  autoWonum: { th: "ระบบออกเลขให้อัตโนมัติเมื่อบันทึก", en: "Generated on save" },
  manualNotice: {
    th: "ใบงานนี้เปิดในระบบ iMPS เอง ไม่ได้มาจาก Maximo",
    en: "This work order is created in iMPS, not from Maximo",
  },

  station: { th: "สถานี", en: "Station" },
  stationPlaceholder: { th: "— เลือกสถานี —", en: "— Select station —" },
  stationSearchPlaceholder: { th: "พิมพ์ค้นหาชื่อสถานี...", en: "Type to search stations..." },
  noStationMatch: { th: "ไม่พบสถานีที่ค้นหา", en: "No matching station" },
  planSection: { th: "ข้อมูลการวางแผน", en: "Planning details" },
  plannedAt: { th: "วันที่/เวลาที่วางแผน", en: "Planned at" },
  schedStart: { th: "วันที่เริ่มตามแผน", en: "Scheduled start" },
  schedFinish: { th: "วันที่เสร็จตามแผน", en: "Scheduled finish" },
  schedRangeError: {
    th: "วันที่เสร็จตามแผนต้องไม่มาก่อนวันที่เริ่ม",
    en: "Scheduled finish must not be before scheduled start",
  },
  technician: { th: "ผู้รับผิดชอบ", en: "Assignees" },
  noTechnicians: {
    th: "ไม่พบ Technician / Vendor / Outsource ในบริษัทของคุณ",
    en: "No technicians, vendors or outsources found in your company",
  },

  equipSection: { th: "อุปกรณ์ที่จะ PM", en: "Equipment to maintain" },
  allEquipment: { th: "ทั้งหมด", en: "All" },
  selectedCount: { th: "เลือกแล้ว", en: "Selected" },
  items: { th: "รายการ", en: "item(s)" },
  noEquipment: { th: "ไม่พบอุปกรณ์ในสถานีนี้", en: "No equipment in this station" },
  pickStationFirst: {
    th: "เลือกสถานีด้านบนก่อน แล้วรายการอุปกรณ์จะขึ้นให้เลือก",
    en: "Select a station above to load its equipment",
  },

  plannerOnlyTitle: { th: "เปิดใบงานได้เฉพาะผู้วางแผน", en: "Planner only" },
  plannerOnlyBody: {
    th: "บัญชีนี้ไม่มีสิทธิ์เปิดใบงาน PM — ดูได้อย่างเดียว",
    en: "This account cannot create PM work orders — view only",
  },

  save: { th: "Assign", en: "Assign" },
  saving: { th: "กำลังบันทึก…", en: "Saving…" },

  errStation: { th: "กรุณาเลือกสถานี", en: "Please select a station" },
  errSched: { th: "กรุณาระบุวันที่เริ่มและวันที่เสร็จตามแผน", en: "Scheduled start and finish are required" },
  errTech: { th: "กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 ราย", en: "Select at least one assignee" },
  errStations: { th: "โหลดรายชื่อสถานีไม่สำเร็จ", en: "Failed to load stations" },
  errChoices: { th: "โหลดรายการอุปกรณ์ไม่สำเร็จ", en: "Failed to load equipment list" },
  errSave: { th: "เปิดใบงานไม่สำเร็จ", en: "Failed to create work order" },
} as const;

const t = (key: keyof typeof T, lang: Lang) => T[key][lang === "en" ? "en" : "th"];

type StationOption = {
  station_id: string;
  station_name: string;
  maximo_location?: string | null;
  company?: string | null;
};

type Props = {
  /** เปิดใบงานสำเร็จ → กลับไปหน้ารายการและ refresh */
  onSaved: (wonum: string) => void;
  onCancel: () => void;
};

// class ชุดเดียวกับ PmPlanForm
const LABEL = "tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2";
const FIELD =
  "tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-800 focus:tw-outline-none focus:tw-border-blue-500";
const FIELD_RO =
  "tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-gray-100 tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-700 tw-cursor-default focus:tw-outline-none";

/** หัว section แบบเดียวกับหน้าวางแผน — วงกลมเลข + แถบเทาเข้ม */
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

/** YYYY-MM-DD ของวันนี้ตามเวลาเครื่อง */
function todayValue() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DDTHH:mm ของตอนนี้ — ประทับเป็นเวลาที่วางแผน เหมือนหน้าวางแผน */
function nowLocalValue() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PmCreateWoForm({ onSaved, onCancel }: Props) {
  const { lang } = useLanguage();

  const [stations, setStations] = useState<StationOption[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<PmAssigneeOptions>(EMPTY_PM_ASSIGNEE_OPTIONS);
  const [choices, setChoices] = useState<EquipmentChoices | null>(null);
  const [canPlan, setCanPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingChoices, setLoadingChoices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [stationId, setStationId] = useState("");
  const [stationQuery, setStationQuery] = useState("");
  const [stationMenuOpen, setStationMenuOpen] = useState(false);
  const stationPickerRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [plannedAt] = useState(nowLocalValue);
  const [schedStart, setSchedStart] = useState("");
  const [schedFinish, setSchedFinish] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);

  const station = useMemo(
    () => stations.find((s) => s.station_id === stationId) ?? null,
    [stations, stationId]
  );
  const filteredStations = useMemo(() => {
    const query = stationQuery.trim().toLocaleLowerCase();
    const selectedLabel = station ? (station.station_name || station.station_id) : "";
    if (!query || selectedLabel === stationQuery) return stations;
    return stations.filter((item) =>
      [item.station_name, item.station_id, item.maximo_location]
        .some((value) => String(value ?? "").toLocaleLowerCase().includes(query))
    );
  }, [stationQuery, station, stations]);

  useEffect(() => {
    const closeStationMenu = (event: MouseEvent) => {
      if (!stationPickerRef.current?.contains(event.target as Node)) setStationMenuOpen(false);
    };
    document.addEventListener("mousedown", closeStationMenu);
    return () => document.removeEventListener("mousedown", closeStationMenu);
  }, []);

  const selectStation = (item: StationOption) => {
    setStationId(item.station_id);
    setStationQuery(item.station_name || item.station_id);
    setStationMenuOpen(false);
  };

  // ── โหลดสิทธิ์ + สถานี + ผู้รับผิดชอบ (ช่าง/vendor/outsource) ครั้งเดียวตอนเปิดฟอร์ม ──
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [meRes, stRes, options] = await Promise.all([
          apiFetch("/me"),
          apiFetch("/maximo/pm/stations"),
          fetchPmAssigneeOptions(),
        ]);
        if (!alive) return;

        const me = await meRes.json().catch(() => ({} as any));
        setCanPlan(PM_PLANNING_ROLES.includes(String(me?.role ?? "").trim().toLowerCase()));

        const stJson = await stRes.json().catch(() => ({} as any));
        if (!stRes.ok) setError(String(stJson?.detail || t("errStations", lang)));
        else setStations(Array.isArray(stJson?.stations) ? stJson.stations : []);

        setAssigneeOptions(options);
      } catch (err) {
        console.error("pm create load error:", err);
        if (alive) setError(t("errStations", lang));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [lang]);

  // ── เปลี่ยนสถานี = โหลดอุปกรณ์ของสถานีนั้นใหม่ แล้วล้างที่ติ๊กไว้ ──
  useEffect(() => {
    if (!stationId) {
      setChoices(null);
      setChecked({});
      return;
    }
    let alive = true;
    (async () => {
      setLoadingChoices(true);
      setChecked({});
      try {
        const res = await apiFetch(
          `/maximo/pm/equipment-choices?station_id=${encodeURIComponent(stationId)}`
        );
        const json = await res.json().catch(() => ({} as any));
        if (!alive) return;
        if (!res.ok) {
          setChoices(null);
          setError(String(json?.detail || t("errChoices", lang)));
          return;
        }
        setError("");
        setChoices({
          wonum: "",
          station_id: json?.station_id ?? stationId,
          location: json?.location ?? null,
          chargers: Array.isArray(json?.chargers) ? json.chargers : [],
          fixed: Array.isArray(json?.fixed) ? json.fixed : [],
          selected_equipment: [],
        });
      } catch (err) {
        console.error("pm create choices error:", err);
        if (alive) {
          setChoices(null);
          setError(t("errChoices", lang));
        }
      } finally {
        if (alive) setLoadingChoices(false);
      }
    })();
    return () => { alive = false; };
  }, [stationId, lang]);

  // ตู้ชาร์จ + อุปกรณ์ระดับสถานี อยู่ในลิสต์เดียวกัน ไม่ต้องแยกหัวข้อ
  const equipmentOptions = useMemo(
    () => (choices ? [...choices.chargers, ...choices.fixed] : []),
    [choices]
  );
  const selectedCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked]
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

  const assigneeGroups = useMemo(() => pmAssigneeGroups(assigneeOptions), [assigneeOptions]);
  const assigneeNames = useMemo(() => pmAssigneeNames(assigneeGroups), [assigneeGroups]);

  // เทียบเป็น string ได้เพราะ datetime-local เป็น ISO เรียงตัวอักษรตรงกับเรียงเวลา
  const schedRangeInvalid = !!schedStart && !!schedFinish && schedFinish < schedStart;
  const locked = !canPlan;

  const onSave = useCallback(async () => {
    if (saving) return;

    if (!stationId) { setError(t("errStation", lang)); return; }
    if (!schedStart || !schedFinish) { setError(t("errSched", lang)); return; }
    if (schedRangeInvalid) { setError(t("schedRangeError", lang)); return; }
    if (assignees.length === 0) { setError(t("errTech", lang)); return; }

    const equipment = equipmentOptions
      .filter((e) => checked[equipKey(e)])
      .map((e: EquipmentItem) => ({
        type: e.type,
        ...(e.sn ? { sn: e.sn } : {}),
        ...(e.location ? { location: e.location } : {}),
        ...(e.label ? { label: e.label } : {}),
      }));

    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/maximo/pm/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          station_id: stationId,
          pm_date: todayValue(),
          description: null,
          equipment,
          planned_at: plannedAt,
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
      onSaved(String(j?.wonum || ""));
    } catch (err) {
      console.error("pm create save error:", err);
      setError(t("errSave", lang));
    } finally {
      setSaving(false);
    }
  }, [
    saving, stationId, schedStart, schedFinish, schedRangeInvalid, assignees,
    equipmentOptions, checked, plannedAt, lang, onSaved,
  ]);

  return (
    <section className="tw-pb-24">
      {/* ปุ่มย้อนกลับ — ไอคอนอย่างเดียว ชิดซ้าย เหมือนหน้าวางแผน */}
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
                  {t("pageTitle", lang)} – {t("formTitle", lang)}
                </div>
                <div className="tw-text-sm tw-text-blue-gray-600 tw-mt-2">{t("companyName", lang)}</div>
                <div className="tw-text-xs tw-text-blue-gray-500 tw-mt-1">{t("companyAddressLine1", lang)}</div>
                <div className="tw-text-xs tw-text-blue-gray-500">{t("companyAddressLine2", lang)}</div>
              </div>
            </div>
            <div className="tw-text-left md:tw-text-right tw-text-sm tw-text-blue-gray-700 tw-border-l tw-border-blue-gray-100 tw-pl-4 md:tw-pl-6 md:tw-border-l-0 tw-pt-3 md:tw-pt-0 md:tw-shrink-0">
              <div className="tw-font-semibold tw-text-blue-gray-800">{t("workOrder", lang)}</div>
              <div className="tw-text-blue-gray-500 tw-mt-1 tw-text-xs">{t("autoWonum", lang)}</div>
            </div>
          </div>

          <hr className="tw-my-6 tw-border-blue-gray-100" />

          {/* ใบนี้ไม่ได้มาจาก Maximo — บอกไว้ตรงที่หน้าวางแผนโชว์เลข WO */}
          <div className="tw-mb-4 tw-flex tw-flex-wrap tw-items-center tw-gap-x-4 tw-gap-y-2 tw-px-4 tw-py-2.5 tw-rounded-lg tw-bg-blue-50 tw-border tw-border-blue-200">
            <span className="tw-text-sm tw-text-blue-700">🧾 {t("manualNotice", lang)}</span>
          </div>

          {/* ไม่มีสิทธิ์เปิดใบงาน */}
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
          ) : (
            <>
              {/* ═══ 1. สถานีและข้อมูลการวางแผน ═══ */}
              <div className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
                <SectionHeader no={1} title={t("planSection", lang)} />
                <div className="tw-p-4">
                  <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
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
                      {t("station", lang)} <span className="tw-text-red-500">*</span>
                    </label>
                    <div ref={stationPickerRef} className="tw-relative">
                      <MagnifyingGlassIcon className="tw-pointer-events-none tw-absolute tw-left-3 tw-top-1/2 tw-z-10 tw-h-4 tw-w-4 tw--translate-y-1/2 tw-text-blue-gray-400" />
                      <input
                        type="text"
                        role="combobox"
                        aria-expanded={stationMenuOpen}
                        aria-controls="pm-create-station-options"
                        aria-autocomplete="list"
                        value={stationQuery}
                        disabled={locked}
                        placeholder={t("stationSearchPlaceholder", lang)}
                        onFocus={(event) => {
                          setStationMenuOpen(true);
                          event.currentTarget.select();
                        }}
                        onChange={(event) => {
                          setStationQuery(event.target.value);
                          setStationId("");
                          setStationMenuOpen(true);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setStationMenuOpen(false);
                          if (event.key === "Enter" && stationMenuOpen && filteredStations.length === 1) {
                            event.preventDefault();
                            selectStation(filteredStations[0]);
                          }
                        }}
                        className={`${FIELD} tw-pl-9 tw-pr-10`}
                      />
                      <button
                        type="button"
                        disabled={locked}
                        aria-label={t("stationPlaceholder", lang)}
                        onClick={() => setStationMenuOpen((open) => !open)}
                        className="tw-absolute tw-right-1 tw-top-1/2 tw-flex tw-h-8 tw-w-8 tw--translate-y-1/2 tw-items-center tw-justify-center tw-rounded-md tw-text-blue-gray-400 hover:tw-bg-blue-gray-50 disabled:tw-cursor-not-allowed"
                      >
                        <ChevronDownIcon className={`tw-h-4 tw-w-4 tw-transition-transform ${stationMenuOpen ? "tw-rotate-180" : ""}`} />
                      </button>

                      {stationMenuOpen && !locked && (
                        <div id="pm-create-station-options" role="listbox" className="tw-absolute tw-z-30 tw-mt-1 tw-max-h-64 tw-w-full tw-overflow-y-auto tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-py-1 tw-shadow-xl">
                          {filteredStations.length > 0 ? filteredStations.map((item) => {
                            const selected = item.station_id === stationId;
                            return (
                              <button
                                key={item.station_id}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectStation(item)}
                                className={`tw-flex tw-w-full tw-items-center tw-gap-3 tw-px-3 tw-py-2.5 tw-text-left hover:tw-bg-blue-50 ${selected ? "tw-bg-blue-50" : ""}`}
                              >
                                <span className="tw-min-w-0 tw-flex-1">
                                  <span className="tw-block tw-truncate tw-text-sm tw-font-medium tw-text-blue-gray-800">{item.station_name || item.station_id}</span>
                                  {item.station_name && item.station_id !== item.station_name && (
                                    <span className="tw-block tw-truncate tw-text-xs tw-text-blue-gray-400">{item.station_id}</span>
                                  )}
                                </span>
                                {selected && <CheckIcon className="tw-h-4 tw-w-4 tw-flex-shrink-0 tw-text-blue-600" />}
                              </button>
                            );
                          }) : (
                            <p className="tw-px-3 tw-py-3 tw-text-sm tw-text-blue-gray-500">{t("noStationMatch", lang)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                    <div>
                      <label className={LABEL}>
                        {t("schedStart", lang)} <span className="tw-text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={schedStart}
                        disabled={locked}
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
                        disabled={locked}
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
                      {assigneeNames.length > 0 ? (
                        <PmAssigneePicker
                          groups={assigneeGroups}
                          assignees={assignees}
                          onChange={setAssignees}
                          disabled={locked}
                        />
                      ) : (
                        <p className="tw-mt-1.5 tw-text-xs tw-text-orange-600">{t("noTechnicians", lang)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══ 2. อุปกรณ์ที่จะ PM — ขึ้นตามสถานีที่เลือก ═══ */}
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
                  {!stationId ? (
                    <p className="tw-text-xs tw-text-blue-gray-500">{t("pickStationFirst", lang)}</p>
                  ) : loadingChoices ? (
                    <div className="tw-flex tw-items-center tw-gap-2 tw-py-4 tw-text-sm tw-text-blue-gray-500">
                      <span className="tw-h-4 tw-w-4 tw-animate-spin tw-rounded-full tw-border-2 tw-border-blue-500 tw-border-t-transparent" />
                      {t("loading", lang)}
                    </div>
                  ) : equipmentOptions.length === 0 ? (
                    <p className="tw-text-xs tw-text-orange-600">{t("noEquipment", lang)}</p>
                  ) : (
                    <div className="tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-divide-y tw-divide-blue-gray-50 tw-max-h-72 tw-overflow-y-auto">
                      <label className="tw-flex tw-items-center tw-gap-2.5 tw-px-3 tw-py-2.5 tw-cursor-pointer hover:tw-bg-blue-gray-50/60 tw-transition-colors">
                        <input
                          type="checkbox"
                          checked={allEquipChecked}
                          disabled={locked}
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
                              disabled={locked}
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

              {/* Actions — แถบล่างแบบเดียวกับหน้าวางแผน */}
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
                    disabled={locked || saving}
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
