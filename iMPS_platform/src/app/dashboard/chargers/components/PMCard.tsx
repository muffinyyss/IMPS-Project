"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardBody, Typography, Switch } from "@material-tailwind/react";
import { apiFetch } from "@/utils/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type LatestPMResp = {
  pm_date?: string | null;
  pm_next_date?: string | null;
  timestamp?: string | null;
};

type PMCardProps = {
  sn: string;
};

type Lang = "th" | "en";

// --- Date utils ---
function parseAsDateLocal(dateStr?: string | null, tzOffsetMinutes = 7 * 60) {
  if (!dateStr) return null;
  try {
    if (dateStr.length === 10) {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      dt.setUTCMinutes(dt.getUTCMinutes() - tzOffsetMinutes);
      return dt;
    }
    return new Date(dateStr);
  } catch {
    return null;
  }
}

function daysBetween(fromDate?: string | null, toDate?: string | null) {
  const from = parseAsDateLocal(fromDate);
  const to = parseAsDateLocal(toDate);
  
  if (!from || !to) return null;

  const fromTH = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
  fromTH.setUTCHours(fromTH.getUTCHours() - 7, 0, 0, 0);

  const toTH = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  );
  toTH.setUTCHours(toTH.getUTCHours() - 7, 0, 0, 0);

  const diffMs = toTH.getTime() - fromTH.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default function PMCard({ sn }: PMCardProps) {
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pmDate, setPmDate] = useState<string | null>(null);
  const [pmNextDate, setPmNextDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ===== Language State =====
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as Lang | null;
    if (savedLang === "th" || savedLang === "en") {
      setLang(savedLang);
    }

    const handleLangChange = (e: CustomEvent<{ lang: Lang }>) => {
      setLang(e.detail.lang);
    };

    window.addEventListener("language:change", handleLangChange as EventListener);
    return () => {
      window.removeEventListener("language:change", handleLangChange as EventListener);
    };
  }, []);

  // ===== Translations =====
  const t = useMemo(() => {
    const translations = {
      th: {
        preventiveMaintenance: "บำรุงรักษาเชิงป้องกัน",
        enabled: "เปิดใช้งาน",
        disabled: "ปิดใช้งาน",
        active: "เปิด",
        inactive: "ปิด",
        pmLatest: "PM ล่าสุด",
        nextPm: "PM ครั้งถัดไป",
        daysLeft: "เหลืออีก",
        loading: "กำลังโหลด…",
        error: "ข้อผิดพลาด",
        day: "วัน",
        days: "วัน",
      },
      en: {
        preventiveMaintenance: "Preventive Maintenance",
        enabled: "Enabled",
        disabled: "Disabled",
        active: "Active",
        inactive: "Inactive",
        pmLatest: "PM Latest",
        nextPm: "Next PM",
        daysLeft: "Days Left",
        loading: "Loading…",
        error: "Error",
        day: "day",
        days: "days",
      },
    };
    return translations[lang];
  }, [lang]);

  // Date formatter based on language
  const formatDate = (dateStr?: string | null) => {
    const dt = parseAsDateLocal(dateStr);
    if (!dt) return "-";
    try {
      if (lang === "th") {
        const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        const day = dt.getDate();
        const month = thaiMonths[dt.getMonth()];
        const year = dt.getFullYear() + 543;
        return `${day} ${month} ${year}`;
      }
      return new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }).format(dt);
    } catch {
      return dateStr ?? "-";
    }
  };

  // Days left formatter
  const renderDaysLeft = (fromDate?: string | null, toDate?: string | null) => {
    const d = daysBetween(fromDate, toDate);
    if (d === null) return "-";
    return `${d} ${d === 1 ? t.day : t.days}`;
  };

  const token = useMemo(
    () =>
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      "",
    []
  );

  useEffect(() => {
    if (!isActive) return;
    
    if (!sn) {
      setPmDate(null);
      setPmNextDate(null);
      setError(null);
      setLoading(false);
      return;
    }
    
    if (!token) return;

    let aborted = false;
    const ctrl = new AbortController();

    const fetchLatest = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(
          `/pmreport/latest/?sn=${encodeURIComponent(sn)}`,
          { signal: ctrl.signal }
        );

        if (res.ok) {
          const data: LatestPMResp = await res.json();
          if (!aborted) {
            setPmDate(data.pm_date ?? null);
            setPmNextDate(data.pm_next_date ?? null);
          }
        } else if (res.status === 404 || res.status === 422) {
          if (!aborted) {
            setPmDate(null);
            setPmNextDate(null);
          }
        } else {
          const res2 = await apiFetch(
            `/pmurl/list?sn=${encodeURIComponent(sn)}&page=1&pageSize=1`,
            { signal: ctrl.signal }
          );
          if (res2.ok) {
            const j = await res2.json();
            const first = (j?.items ?? [])[0];
            if (!aborted) {
              setPmDate(first?.pm_date ?? null);
              if (first?.pm_date) {
                const tmp = new Date(first.pm_date + "T00:00:00+07:00");
                tmp.setMonth(tmp.getMonth() + 6);
                setPmNextDate(tmp.toISOString().slice(0, 10));
              } else {
                setPmNextDate(null);
              }
            }
          } else if (res2.status === 422 || res2.status === 404) {
            if (!aborted) {
              setPmDate(null);
              setPmNextDate(null);
            }
          } else {
            throw new Error(`pmurl/list failed: ${res2.status}`);
          }
        }
      } catch (e: any) {
        if (e.name === "AbortError") return;
        if (!aborted) setError(e?.message ?? "fetch error");
      } finally {
        if (!aborted) setLoading(false);
      }
    };

    fetchLatest();
    return () => {
      aborted = true;
      ctrl.abort();
    };
  }, [isActive, sn, token]);

  return (
    <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm tw-h-full">
      <CardHeader
        floated={false}
        shadow={false}
        color="transparent"
        className="tw-overflow-visible tw-rounded-none"
      >
        <div className="tw-flex tw-items-center tw-justify-between">
          <div className="tw-flex tw-items-center tw-gap-3">
            <i className="fa-fw fa-solid fa-screwdriver-wrench tw-text-xl tw-text-gray-800" aria-hidden="true" />
            <div>
              <Typography variant="h6" className="tw-leading-none tw-text-gray-900">
                {t.preventiveMaintenance}
              </Typography>
              <Typography className="!tw-text-xs !tw-font-normal !tw-text-blue-gray-500">
                {isActive ? t.enabled : t.disabled}
              </Typography>
            </div>
          </div>
          <div className="tw-flex tw-items-center tw-gap-2">
            <Typography className="tw-text-sm tw-text-blue-gray-600">
              {isActive ? t.active : t.inactive}
            </Typography>
            <Switch checked={isActive} onChange={() => setIsActive(v => !v)} />
          </div>
        </div>
      </CardHeader>

      <CardBody className="tw-flex tw-flex-col tw-gap-2 tw-p-6">
        {!isActive ? (
          <Typography color="blue-gray">-</Typography>
        ) : loading ? (
          <Typography color="blue-gray">{t.loading}</Typography>
        ) : error ? (
          <Typography color="red">{t.error}: {error}</Typography>
        ) : (
          <>
            <div className="tw-flex tw-justify-between">
              <Typography color="blue-gray" className="tw-font-medium">
                {t.pmLatest}
              </Typography>
              <Typography color="blue-gray">{formatDate(pmDate)}</Typography>
            </div>

            <div className="tw-flex tw-justify-between">
              <Typography color="blue-gray" className="tw-font-medium">
                {t.nextPm}
              </Typography>
              <Typography color="blue-gray">{formatDate(pmNextDate)}</Typography>
            </div>

            <div className="tw-flex tw-justify-between">
              <Typography color="blue-gray" className="tw-font-medium">
                {t.daysLeft}
              </Typography>
              <Typography color="blue-gray">
                {renderDaysLeft(pmDate, pmNextDate)}
              </Typography>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}