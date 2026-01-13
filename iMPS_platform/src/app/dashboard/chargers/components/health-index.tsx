"use client";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardBody, Typography } from "@/components/MaterialTailwind";
import { Switch } from "@material-tailwind/react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";

type Lang = "th" | "en";

type Props = {
  initialOn?: boolean;
};

export default function HealthIndex({
  initialOn = true,
}: Props) {
  const searchParams = useSearchParams();
  const [stationId, setStationId] = useState("");
  const [on, setOn] = useState(initialOn);
  const [isLoading, setIsLoading] = useState(true);
  const [calculatedValue, setCalculatedValue] = useState(0);

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
        healthIndex: "ดัชนีสุขภาพ",
        enabled: "เปิดใช้งาน",
        disabled: "ปิดใช้งาน",
        active: "เปิด",
        inactive: "ปิด",
        loading: "กำลังโหลด...",
      },
      en: {
        healthIndex: "Health Index",
        enabled: "Enabled",
        disabled: "Disabled",
        active: "Active",
        inactive: "Inactive",
        loading: "Loading...",
      },
    };
    return translations[lang];
  }, [lang]);

  // ดึง stationId จาก URL search params หรือ localStorage
  useEffect(() => {
    const sid = searchParams.get("station_id") || localStorage.getItem("selected_station_id");
    if (sid) {
      setStationId(sid);
    } else {
      setIsLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    // ถ้าไม่มี stationId ให้หยุด
    if (!stationId) {
      console.log("HealthIndex: stationId not provided");
      setIsLoading(false);
      return;
    }

    const fetchProgress = async () => {
      try {
        console.log(`HealthIndex: fetching progress for station: ${stationId}`);
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") ?? "" : "";
        const res = await fetch(`${API_BASE}/modules/progress?station_id=${encodeURIComponent(stationId)}`, {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
        });

        if (!res.ok) {
          console.warn("fetch /modules/progress failed:", res.status);
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        console.log("HealthIndex: API response data:", data);
        // ดึงค่า overall health index จาก API
        if (data.overall !== undefined) {
          console.log(`HealthIndex: setting calculatedValue to ${data.overall}`);
          setCalculatedValue(data.overall);
        }
      } catch (err) {
        console.error("fetch /modules/progress error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();
  }, [stationId]);

  const v = Math.max(0, Math.min(100, Math.round(calculatedValue)));
  const segments = 10;
  const filled = on ? Math.floor((v / 100) * segments) : 0;

  return (
    <Card className="tw-border tw-border-blue-gray-100 tw-shadow-sm">
      <CardHeader floated={false} shadow={false} color="transparent" className="tw-overflow-visible tw-rounded-none">
        <div className="tw-flex tw-items-center tw-justify-between">
          <div className="tw-flex tw-items-center tw-gap-3">
            <i
              className="fa-fw fa-solid fa-heart-pulse tw-text-xl tw-text-gray-800"
              aria-hidden="true"
            />
            <div>
              <Typography
                variant="h6"
                className="tw-leading-none tw-transition-colors tw-text-gray-900"
              >
                {t.healthIndex}
              </Typography>
              <Typography className="!tw-text-xs !tw-font-normal tw-transition-colors !tw-text-blue-gray-500">
                {on ? t.enabled : t.disabled}
              </Typography>
            </div>
          </div>
          <div className="tw-flex tw-items-center tw-gap-2">
            <Typography className="tw-text-sm tw-text-blue-gray-600">
              {on ? t.active : t.inactive}
            </Typography>
            <Switch checked={on} onChange={() => setOn(!on)} />
          </div>
        </div>
      </CardHeader>

      <CardBody className="tw-space-y-4 tw-pt-0 tw-px-4 tw-pb-4">
        <div className="tw-p-6">
          <Typography className="tw-text-3xl tw-font-semibold">
            {isLoading ? t.loading : (on ? `${v}%` : "--")}
          </Typography>
          <div className={`tw-flex tw-items-center tw-gap-1 ${on ? "" : "tw-opacity-40"}`}>
            <div className="tw-flex tw-items-center tw-gap-1 tw-border tw-border-blue-gray-200 tw-rounded tw-p-1 tw-flex-1">
              {Array.from({ length: segments }).map((_, i) => (
                <div
                  key={i}
                  className={`tw-h-4 tw-flex-1 tw-rounded-[2px] ${i < filled
                    ? v >= 80
                      ? "tw-bg-green-500"
                      : v >= 50
                        ? "tw-bg-amber-500"
                        : "tw-bg-red-500"
                    : "tw-bg-blue-gray-100"
                    }`}
                />
              ))}
            </div>
            <div className="tw-h-6 tw-w-1.5 tw-bg-blue-gray-200 tw-rounded-r" />
          </div>
          <div className="tw-flex tw-justify-between tw-text-xs tw-text-blue-gray-500">
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}