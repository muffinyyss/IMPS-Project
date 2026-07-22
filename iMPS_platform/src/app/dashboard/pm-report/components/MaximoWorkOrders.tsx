"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, Typography } from "@material-tailwind/react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { apiFetch } from "@/utils/api";
import { useLanguage, type Lang } from "@/utils/useLanguage";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type MaximoSource = "charger" | "mdb" | "ccb" | "cbbox" | "station";

export type MaximoWorkOrder = {
  // 3 ตัวหลักที่รับจาก Maximo
  pm_type?: string | null;
  location?: string | null;
  pm_date?: string | null;
  source?: string | null;
  // ข้อมูลประกอบ
  wonum?: string | null;
  description?: string | null;
  status?: string | null;
  worktype?: string | null;
  targcompdate?: string | null;
  station_id?: string | null;
  sn?: string | null;
  origin?: string | null;
  receivedAt?: string | null;
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
  finish: { th: "สิ้นสุด", en: "Finish" },
  location: { th: "Location", en: "Location" },
  error: { th: "โหลดใบงานจาก Maximo ไม่สำเร็จ", en: "Failed to load Maximo work orders" },
  syncError: { th: "รีเฟรชใบงานจาก Maximo ไม่สำเร็จ", en: "Failed to refresh Maximo work orders" },
} as const;

function t(key: keyof typeof T, lang: Lang) {
  return T[key][lang === "en" ? "en" : "th"];
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
  if (s === "APPR") return "tw-bg-blue-50 tw-text-blue-700 tw-border-blue-200";
  if (s === "CAN" || s === "CANCELLED")
    return "tw-bg-red-50 tw-text-red-700 tw-border-red-200";
  return "tw-bg-blue-gray-50 tw-text-blue-gray-700 tw-border-blue-gray-200";
}

export default function MaximoWorkOrders({ source, identifier }: Props) {
  const { lang } = useLanguage();
  const [items, setItems] = useState<MaximoWorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string>("");

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
          `${BASE}/pm-maximo/work-orders?source=${encodeURIComponent(source)}` +
          `&identifier=${encodeURIComponent(identifier)}&only_open=true`;
        const res = await apiFetch(url, { signal });
        const j = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          setItems([]);
          setError(String(j?.detail || t("error", lang)));
          return;
        }
        setItems(Array.isArray(j?.items) ? (j.items as MaximoWorkOrder[]) : []);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("maximo work-orders error:", err);
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

  async function handleRefresh() {
    if (!identifier || syncing) return;
    setSyncing(true);
    setError("");
    try {
      const url =
        `${BASE}/pm-maximo/sync?source=${encodeURIComponent(source)}` +
        `&identifier=${encodeURIComponent(identifier)}`;
      const res = await apiFetch(url, { method: "POST" });
      const j = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setError(String(j?.detail || t("syncError", lang)));
        return;
      }
      await load();
    } catch (err) {
      console.error("maximo sync error:", err);
      setError(t("syncError", lang));
    } finally {
      setSyncing(false);
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
          onClick={handleRefresh}
          disabled={syncing || !identifier}
          title={t("refresh", lang)}
          className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-lg tw-border tw-border-blue-gray-200 tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-xs tw-font-medium tw-text-blue-gray-700 hover:tw-bg-blue-gray-50 disabled:tw-opacity-50 disabled:tw-cursor-not-allowed tw-transition-colors"
        >
          <ArrowPathIcon className={`tw-w-4 tw-h-4 ${syncing ? "tw-animate-spin" : ""}`} />
          {syncing ? t("refreshing", lang) : t("refresh", lang)}
        </button>
      </div>

      {/* Body */}
      <div className="tw-px-3 sm:tw-px-4 lg:tw-px-6 tw-py-3 sm:tw-py-4">
        {error && (
          <div className="tw-mb-3 tw-rounded-lg tw-border tw-border-red-200 tw-bg-red-50 tw-px-3 tw-py-2 tw-text-xs sm:tw-text-sm tw-text-red-700">
            {error}
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
            {items.map((wo, i) => (
              <li
                key={`${wo.wonum ?? `${wo.pm_type}-${wo.location}-${wo.pm_date}`}-${i}`}
                className="tw-rounded-xl tw-border tw-border-blue-gray-100 tw-bg-white tw-px-3 tw-py-2.5 hover:tw-bg-blue-gray-50/40 tw-transition-colors"
              >
                <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                  <Typography className="tw-text-sm sm:tw-text-base tw-font-semibold tw-text-blue-gray-900">
                    {wo.wonum || wo.location || "-"}
                  </Typography>
                  {wo.pm_type && (
                    <span className="tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-indigo-200 tw-bg-indigo-50 tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-indigo-700">
                      {wo.pm_type}
                    </span>
                  )}
                  {wo.status && (
                    <span
                      className={`tw-inline-flex tw-items-center tw-rounded-full tw-border tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-medium ${statusChipClass(
                        wo.status
                      )}`}
                    >
                      {wo.status}
                    </span>
                  )}
                  {wo.worktype && (
                    <span className="tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-blue-gray-200 tw-bg-blue-gray-50 tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-blue-gray-700">
                      {wo.worktype}
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
                    {t("pmDate", lang)}: {formatDate(wo.pm_date, lang)}
                  </span>
                  {wo.targcompdate && (
                    <span>
                      {t("finish", lang)}: {formatDate(wo.targcompdate, lang)}
                    </span>
                  )}
                  {wo.location && <span>{t("location", lang)}: {wo.location}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
