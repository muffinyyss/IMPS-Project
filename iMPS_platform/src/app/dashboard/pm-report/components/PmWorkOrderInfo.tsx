"use client";

/**
 * หน้าข้อมูลใบงาน PM (อ่านอย่างเดียว) ที่ช่างเห็นก่อนเริ่มกรอก
 *
 *   planner assign → ช่างกดเข้าใบงาน → เห็นหน้านี้ (แผนที่ planner วางไว้)
 *   → กด "เริ่ม PM" → เปิดฟอร์ม Pre-PM ให้กรอก
 *
 * ใช้แพทเทิร์นหน้าเดียวกับ PmPlanForm เพื่อให้ทั้งสองด่านหน้าตาเป็นชุดเดียวกัน
 */

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Button, Input } from "@material-tailwind/react";
import { ArrowLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "@/utils/api";
import { useLanguage, type Lang } from "@/utils/useLanguage";
import {
  equipLabel,
  formatDate,
  toDateTimeLocalValue,
  type MaximoSource,
  type MaximoWorkOrder,
} from "./planning";

const LOGO_SRC = "/img/logo_egat.png";

const T = {
  pageTitle: { th: "ใบงานบำรุงรักษา (PM)", en: "Preventive Maintenance work order" },
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

  back: { th: "Back", en: "Back" },
  loading: { th: "กำลังโหลด…", en: "Loading…" },
  notFound: { th: "ไม่พบใบงานนี้", en: "Work order not found" },
  errLoad: { th: "โหลดใบงานไม่สำเร็จ", en: "Failed to load work order" },

  workOrder: { th: "เลขที่ใบงาน (WO)", en: "Work order (WO)" },
  location: { th: "Location", en: "Location" },
  station: { th: "สถานี", en: "Station" },
  company: { th: "บริษัท", en: "Company" },
  pmDate: { th: "วันที่ PM", en: "PM date" },
  description: { th: "รายละเอียดใบงาน", en: "Work order description" },

  planSection: { th: "แผนที่ผู้วางแผนกำหนดไว้", en: "Plan set by the planner" },
  equipSection: { th: "อุปกรณ์ที่ต้อง PM", en: "Equipment to PM" },
  plannedAt: { th: "วันที่/เวลาที่วางแผน", en: "Planned at" },
  schedStart: { th: "วันที่เริ่มตามแผน", en: "Scheduled start" },
  schedFinish: { th: "วันที่เสร็จตามแผน", en: "Scheduled finish" },
  technician: { th: "ช่างผู้รับผิดชอบ", en: "Technician" },
  noTechnician: { th: "ยังไม่ได้มอบหมายช่าง", en: "No technician assigned" },
  noEquipment: { th: "ยังไม่ได้เลือกอุปกรณ์", en: "No equipment selected" },

  startPm: { th: "เริ่ม PM", en: "Start PM" },
  pickCharger: { th: "เลือกตู้ที่จะเริ่ม PM", en: "Pick a charger to start" },
  waitPlanner: {
    th: "ผู้วางแผนยังไม่ได้เลือกอุปกรณ์ที่ต้อง PM — รอให้วางแผนเสร็จก่อนจึงเริ่มได้",
    en: "The planner has not selected the equipment yet — wait for the plan to be completed",
  },
} as const;

const t = (key: keyof typeof T, lang: Lang) => T[key][lang === "en" ? "en" : "th"];

type Props = {
  source: MaximoSource;
  /** SN สำหรับ charger, station_id สำหรับ tab อื่น */
  identifier?: string | null;
  wonum: string;
  /** sn = ตู้ที่ช่างเลือกเริ่มทำ (เฉพาะ charger) — ฟอร์มต้องใช้ดึงข้อมูลหัวเอกสาร */
  onStart: (sn?: string) => void;
  onCancel: () => void;
};

const RO =
  "tw-w-full tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-gray-100 tw-px-3 tw-py-2.5 tw-text-sm tw-text-blue-gray-700";
const LABEL = "tw-block tw-text-sm tw-font-semibold tw-text-blue-gray-800 tw-mb-2";

export default function PmWorkOrderInfo({ source, identifier, wonum, onStart, onCancel }: Props) {
  const { lang } = useLanguage();
  const [wo, setWo] = useState<MaximoWorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!wonum) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(
        `/maximo/pm/open?source=${encodeURIComponent(source)}` +
        `&identifier=${encodeURIComponent(identifier ?? "")}&only_open=true`
      );
      const j = await res.json().catch(() => ({} as any));
      const found: MaximoWorkOrder | undefined = (Array.isArray(j?.items) ? j.items : [])
        .find((x: MaximoWorkOrder) => String(x?.wonum ?? "") === wonum);
      if (!found) { setError(t("notFound", lang)); return; }
      setWo(found);
    } catch (err) {
      console.error("pm wo info error:", err);
      setError(t("errLoad", lang));
    } finally {
      setLoading(false);
    }
  }, [source, identifier, wonum, lang]);

  useEffect(() => { load(); }, [load]);

  const assignees = (wo?.assignees ?? []).filter(Boolean);
  const equipment = wo?.selected_equipment ?? [];
  // ฟอร์ม charger ผูกกับ sn ของตู้ ถ้าเข้ามาทางหน้า PM List จะไม่มี sn ติดมาใน URL
  // (หน้านั้นล้าง selected_sn ทิ้งด้วย) ต้องหยิบจากอุปกรณ์ที่ planner เลือกไว้ในใบงาน
  const chargers = source === "charger"
    ? equipment.filter((e) => e.type === "charger" && (e.sn ?? "").trim())
    : [];

  return (
    <section className="tw-pb-24">
      <div className="tw-mx-auto tw-max-w-6xl tw-mb-6 tw-flex tw-items-center tw-gap-3">
        <Button
          variant="outlined" size="sm" onClick={onCancel}
          title={t("back", lang)} aria-label={t("back", lang)}
          className="tw-border-blue-gray-200 tw-text-blue-gray-700 hover:tw-border-blue-gray-300"
        >
          <ArrowLeftIcon className="tw-w-4 tw-h-4" />
        </Button>
      </div>

      <div className="tw-mx-auto tw-max-w-6xl tw-bg-white tw-border tw-border-blue-gray-100 tw-rounded-xl tw-shadow-md tw-shadow-blue-gray-500/5 tw-p-6 md:tw-p-8">
        {/* Header */}
        <div className="tw-flex tw-items-start tw-justify-between tw-gap-6 tw-mb-6">
          <div className="tw-flex tw-items-start tw-gap-4">
            <div className="tw-relative tw-shrink-0 tw-h-16 tw-w-[90px] md:tw-h-20 md:tw-w-[110px]">
              <Image src={LOGO_SRC} alt="Logo" fill priority className="tw-object-contain" sizes="110px" />
            </div>
            <div>
              <div className="tw-font-bold tw-text-blue-gray-900 tw-text-base md:tw-text-lg">
                {t("pageTitle", lang)} ({source.toUpperCase()})
              </div>
              <div className="tw-text-sm tw-text-blue-gray-600 tw-mt-2">{t("companyName", lang)}</div>
              <div className="tw-text-xs tw-text-blue-gray-500 tw-mt-1">{t("companyAddressLine1", lang)}</div>
              <div className="tw-text-xs tw-text-blue-gray-500">{t("companyAddressLine2", lang)}</div>
            </div>
          </div>
          <div className="tw-text-left md:tw-text-right tw-text-sm tw-text-blue-gray-700 md:tw-shrink-0">
            <div className="tw-font-semibold tw-text-blue-gray-800">{t("workOrder", lang)}</div>
            <div className="tw-break-all tw-text-blue-gray-600 tw-mt-1">{wonum || "-"}</div>
          </div>
        </div>

        <hr className="tw-my-6 tw-border-blue-gray-100" />

        <div className="tw-mb-4 tw-flex tw-flex-wrap tw-items-center tw-gap-x-4 tw-gap-y-2 tw-px-4 tw-py-2.5 tw-rounded-lg tw-bg-blue-50 tw-border tw-border-blue-200">
          <span className="tw-flex tw-items-center tw-gap-2">
            <span className="tw-text-sm tw-text-blue-700">🧾 Maximo WO:</span>
            <span className="tw-font-mono tw-font-bold tw-text-blue-900 tw-bg-blue-100 tw-px-2 tw-py-0.5 tw-rounded">
              {wonum || "-"}
            </span>
          </span>
        </div>

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
            {/* ข้อมูลใบงาน */}
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
                <Input value={wo.station_id || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
              </div>
              <div>
                <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("company", lang)}</label>
                <Input value={wo.company || ""} readOnly crossOrigin="" className="!tw-w-full !tw-bg-gray-100" containerProps={{ className: "!tw-min-w-0" }} />
              </div>
            </div>

            {wo.description && (
              <div className="tw-mb-6">
                <label className="tw-block tw-text-sm tw-text-blue-gray-600 tw-mb-1">{t("description", lang)}</label>
                <div className={RO}>{wo.description}</div>
              </div>
            )}

            {/* แผนของ planner — อ่านอย่างเดียว */}
            <div className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
              <div className="tw-flex tw-items-center tw-gap-3 tw-bg-gray-700 tw-px-4 tw-py-3 tw-text-white">
                <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-white tw-text-gray-700 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-sm">1</div>
                <span className="tw-font-semibold tw-text-base">{t("planSection", lang)}</span>
              </div>
              <div className="tw-p-4 tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
                <div>
                  <label className={LABEL}>{t("plannedAt", lang)}</label>
                  <div className={RO}>{toDateTimeLocalValue(wo.planned_at).replace("T", " ") || "-"}</div>
                </div>
                <div>
                  <label className={LABEL}>{t("technician", lang)}</label>
                  <div className={RO}>{assignees.join(", ") || t("noTechnician", lang)}</div>
                </div>
                <div>
                  <label className={LABEL}>{t("schedStart", lang)}</label>
                  <div className={RO}>{toDateTimeLocalValue(wo.sched_start).replace("T", " ") || "-"}</div>
                </div>
                <div>
                  <label className={LABEL}>{t("schedFinish", lang)}</label>
                  <div className={RO}>{toDateTimeLocalValue(wo.sched_finish).replace("T", " ") || "-"}</div>
                </div>
              </div>
            </div>

            {/* อุปกรณ์ที่ต้อง PM */}
            <div className="tw-mb-6 tw-rounded-lg tw-overflow-hidden tw-border tw-border-blue-gray-100 tw-bg-white tw-shadow-sm">
              <div className="tw-flex tw-items-center tw-gap-3 tw-bg-gray-700 tw-px-4 tw-py-3 tw-text-white">
                <div className="tw-w-8 tw-h-8 tw-rounded-full tw-bg-white tw-text-gray-700 tw-flex tw-items-center tw-justify-center tw-font-bold tw-text-sm">2</div>
                <span className="tw-font-semibold tw-text-base">{t("equipSection", lang)}</span>
                <span className="tw-ml-auto tw-text-xs tw-font-medium tw-text-white/90">{equipment.length}</span>
              </div>
              <div className="tw-p-4">
                {equipment.length === 0 ? (
                  <p className="tw-text-xs tw-text-orange-600">{t("noEquipment", lang)}</p>
                ) : (
                  <div className="tw-flex tw-flex-wrap tw-gap-2">
                    {equipment.map((e, i) => (
                      <span key={`${equipLabel(e)}-${i}`}
                        className="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-full tw-border tw-border-indigo-200 tw-bg-indigo-50 tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-text-indigo-700">
                        {equipLabel(e)}
                        {/* มีแต่ตู้ชาร์จที่มี SN — อุปกรณ์ระดับสถานีผูกกับ station_id */}
                        {e.type === "charger" && e.sn && (
                          <span className="tw-font-mono tw-text-[11px] tw-text-indigo-400">{e.sn}</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* เริ่มไม่ได้ต้องบอกว่ารออะไรอยู่ — ปุ่มอยู่ล่างสุด */}
            {equipment.length === 0 && (
              <div className="tw-rounded-xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-5 tw-py-4 tw-text-center">
                <p className="tw-text-sm tw-text-amber-800">{t("waitPlanner", lang)}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ปุ่มเริ่มงานอยู่ท้ายหน้า — อ่านรายละเอียดใบงานจบแล้วค่อยกด
          ยังไม่มีอุปกรณ์ให้ทำก็ยังเริ่มไม่ได้ (planner ยังวางแผนไม่เสร็จ) */}
      <div className="tw-mx-auto tw-max-w-6xl tw-mt-6 tw-flex tw-flex-wrap tw-items-center tw-justify-end tw-gap-2">
        {/* ใบงานเดียวครอบได้หลายตู้ — ต้องรู้ว่าจะเริ่มตู้ไหนก่อนถึงจะเปิดฟอร์มถูกใบ */}
        {chargers.length > 1 && (
          <span className="tw-mr-auto tw-text-sm tw-text-blue-gray-500">{t("pickCharger", lang)}</span>
        )}
        {(chargers.length > 1 ? chargers : [null]).map((c, i) => (
          <Button
            key={c?.sn ?? `start-${i}`}
            type="button"
            onClick={() => onStart(c?.sn ?? chargers[0]?.sn ?? undefined)}
            disabled={loading || !wo || equipment.length === 0}
            className="tw-bg-amber-500 hover:tw-bg-amber-600 tw-text-white tw-font-semibold tw-text-base tw-px-8 tw-py-3 tw-rounded-xl hover:tw-shadow-lg hover:tw-shadow-amber-500/30 tw-transition-all disabled:tw-opacity-50 disabled:tw-shadow-none"
          >
            {c ? `${t("startPm", lang)} · ${equipLabel(c)}` : t("startPm", lang)}
          </Button>
        ))}
      </div>
    </section>
  );
}
