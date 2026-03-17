"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Card, CardBody, CardHeader, Switch, Typography } from "@material-tailwind/react";
import CircleProgress from "./CircleProgress";
import { useRouter, useSearchParams } from "next/navigation";

type AiItem = {
  id: string;
  title: string;
  iconClass: string;
  defaultEnabled?: boolean;
  progress?: number;
};

// Mapping ระหว่าง module ID กับชื่อที่แสดง
// ค่า progress ที่ตั้งไว้จะเป็นค่า fallback กรณีดึงจาก API ไม่สำเร็จ
const AI_ITEMS: AiItem[] = [
  { id: "module1", title: "MDB Dust Filters Prediction", iconClass: "fa-solid fa-filter", defaultEnabled: false, progress: 0 },
  { id: "module2", title: "Charger Dust Filters Prediction", iconClass: "fa-solid fa-charging-station", defaultEnabled: false, progress: 0 },
  { id: "module3", title: "Online / Offline Prediction", iconClass: "fa-solid fa-wifi", defaultEnabled: false, progress: 0 },
  { id: "module4", title: "AB Normal Power Supply Prediction", iconClass: "fa-solid fa-bolt", defaultEnabled: false, progress: 0 },
  { id: "module5", title: "Network Prediction", iconClass: "fa-solid fa-signal", defaultEnabled: false, progress: 0 },
  { id: "module6", title: "The Remaining Useful Life (RUL) Prediction", iconClass: "fa-regular fa-clock", defaultEnabled: false, progress: 0 },
  { id: "module7", title: "Root Cause Analysis Prediction", iconClass: "fa-solid fa-magnifying-glass", defaultEnabled: false, progress: 0 },
];

/* -------- Reusable card -------- */
function AiItemCard({
  item,
  enabled,
  onToggle,
  disabled,
  onMoreDetail,
}: {
  item: AiItem;
  enabled?: boolean;
  onToggle?: (next: boolean) => void;
  disabled?: boolean;
  onMoreDetail?: () => void;
}) {
  const isControlled = typeof enabled === "boolean";
  const [localEnabled, setLocalEnabled] = React.useState(!!item.defaultEnabled);
  const value = isControlled ? enabled : localEnabled;

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const next = e.target.checked;
    if (isControlled) onToggle?.(next);
    else setLocalEnabled(next);
  };

  const displayValue = value ? (Number(item.progress) || 0) : 0;

  return (
    <Card
      variant="gradient"
      className={`tw-flex tw-h-full tw-flex-col tw-justify-between tw-border tw-shadow-sm ${value ? "!tw-bg-gray-800 !tw-text-white" : "!tw-bg-white"
        }`}
    >
      <CardHeader
        floated={false}
        shadow={false}
        color="transparent"
        className="tw-overflow-visible tw-rounded-none"
      >
        <div className="tw-flex tw-items-center tw-justify-between">
          <div className="tw-flex tw-items-center tw-gap-3">
            <i
              className={`fa-fw ${item.iconClass} tw-text-xl ${value ? "tw-text-white" : "tw-text-gray-800"
                }`}
            />
            <div>
              <Typography
                variant="h6"
                className={`tw-leading-none ${value ? "tw-text-white" : "tw-text-gray-900"
                  }`}
              >
                {item.title}
              </Typography>
              <Typography
                className={`!tw-text-xs !tw-font-normal ${value ? "tw-text-white/80" : "!tw-text-blue-gray-500"
                  }`}
              >
                {value ? "Enabled" : "Disabled"}
              </Typography>
            </div>
          </div>

          <div className="tw-flex tw-items-center tw-gap-2">
            <Typography
              className={`!tw-text-sm tw-hidden sm:tw-block ${value ? "tw-text-white/90" : "!tw-text-blue-gray-500"
                }`}
            >
              {value ? "On" : "Off"}
            </Typography>
            <Switch
              checked={value}
              onChange={handleChange}
              disabled={disabled}
              color={value ? "blue-gray" : "blue"}
              aria-label={`Enable ${item.title}`}
            />
          </div>
        </div>
      </CardHeader>

      <CardBody className="tw-p-4 tw-flex tw-flex-col">
        <div className={value ? "" : "tw-opacity-50"}>
          <div className="tw-mx-auto tw-max-w-[220px] tw-w-full">
            <CircleProgress
              label="Health Index"
              value={displayValue}
              valueClassName={value ? "tw-text-white" : "tw-text-blue-gray-900"}
              labelClassName={value ? "tw-text-white/80" : "tw-text-blue-gray-600"}
              colorClass={value ? undefined : "tw-text-blue-gray-400"}
            />
          </div>
        </div>

        {/* ปุ่ม More detail มุมขวาล่าง */}
        <div className="tw-mt-3 tw-flex tw-justify-end">
          <button
            type="button"
            onClick={() => onMoreDetail?.()}
            disabled={disabled || !value}  // ❗ ถ้า Off หรือกำลังโหลด → disable ปุ่ม
            className={`tw-text-xs tw-rounded-md tw-border tw-px-2 tw-py-1 tw-transition-colors disabled:tw-opacity-50 disabled:tw-cursor-not-allowed
    ${value
                ? "tw-border-white/70 tw-text-white hover:tw-bg-white/10"
                : "tw-border-gray-300 tw-text-gray-700 hover:tw-bg-gray-100"
              }`}
          >
            More detail
          </button>

        </div>
      </CardBody>
    </Card>
  );
}






type StationInfoResponse = {
  station?: {
    module1_isActive?: boolean;
    module2_isActive?: boolean;
    module3_isActive?: boolean;
    module4_isActive?: boolean;
    module5_isActive?: boolean;
    module6_isActive?: boolean;
    module7_isActive?: boolean;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function AiSection() {
  const searchParams = useSearchParams();
  const [stationId, setStationId] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const router = useRouter();

  const handleMoreDetail = useCallback(
    (moduleId: string) => {
      // สมมติให้ไปที่ /dashboard/ai/[moduleId]
      // และถ้ามี stationId ให้ติดไปใน query string ด้วย
      let href = `/dashboard/ai/${moduleId}`;
      if (stationId) {
        href += `?station_id=${encodeURIComponent(stationId)}`;
      }
      router.push(href);
    },
    [router, stationId]
  );

  const [modulesStatus, setModulesStatus] = useState<{
    [key: string]: boolean;
  }>({
    module1IsActive: false,
    module2IsActive: false,
    module3IsActive: false,
    module4IsActive: false,
    module5IsActive: false,
    module6IsActive: false,
    module7IsActive: false,
  });

  const [modulesProgress, setModulesProgress] = useState<{
    [key: string]: number;
  }>({
    module1: 0,
    module2: 0,
    module3: 0,
    module4: 0,
    module5: 0,
    module6: 0,
    module7: 0,
  });

  const refetchModulesProgress = useCallback(async (sid: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
      const res = await fetch(
        `${API_BASE}/modules/progress?station_id=${encodeURIComponent(sid)}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          credentials: token ? "omit" : "include",
          cache: "no-store",
        }
      );

      if (res.ok) {
        const progressData = await res.json();
        console.log("Progress Data:", progressData);
        setModulesProgress(progressData);
      }
    } catch (e) {
      console.error("Failed to fetch progress:", e);
    }
  }, []);

  const refetchStationInfo = useCallback(async (sid: string) => {
    setLoadingInfo(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
      const res = await fetch(
        `${API_BASE}/station/info?station_id=${encodeURIComponent(sid)}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          credentials: token ? "omit" : "include",
          cache: "no-store",
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json: StationInfoResponse = await res.json();
      console.log("Station Info:", json);

      const newStatus = {
        module1IsActive: Boolean(json?.station?.module1_isActive),
        module2IsActive: Boolean(json?.station?.module2_isActive),
        module3IsActive: Boolean(json?.station?.module3_isActive),
        module4IsActive: Boolean(json?.station?.module4_isActive),
        module5IsActive: Boolean(json?.station?.module5_isActive),
        module6IsActive: Boolean(json?.station?.module6_isActive),
        module7IsActive: Boolean(json?.station?.module7_isActive),
      };

      setModulesStatus(newStatus);
      console.log("modulesStatus updated:", newStatus);

      // ดึงข้อมูล progress หลังจากดึง status เสร็จ
      await refetchModulesProgress(sid);
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message || "fetch failed");
      } else {
        setError("Unknown error occurred");
      }
    } finally {
      setLoadingInfo(false);
    }
  }, [refetchModulesProgress]);

  const toggleModule = useCallback(async (moduleId: string, next: boolean) => {
    if (!stationId) return;

    const fieldName = `${moduleId}IsActive`;

    if (modulesStatus[fieldName] === next) return;

    // Optimistic update
    setModulesStatus((prevState) => ({
      ...prevState,
      [fieldName]: next,
    }));

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "";
      const res = await fetch(`${API_BASE}/station/${encodeURIComponent(stationId)}/${moduleId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: token ? "omit" : "include",
        body: JSON.stringify({ enabled: next }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Refetch to get the latest data
      await refetchStationInfo(stationId);
    } catch (e) {
      console.error("Toggle module error:", e);
      // Rollback on error
      setModulesStatus((prevState) => ({
        ...prevState,
        [fieldName]: !next,
      }));
      setError(e instanceof Error ? e.message : "Failed to toggle module");
    }
  }, [stationId, modulesStatus, refetchStationInfo]);

  useEffect(() => {
    const sidFromUrl = searchParams.get("station_id");
    if (sidFromUrl) {
      setStationId(sidFromUrl);
      if (typeof window !== "undefined") {
        localStorage.setItem("selected_station_id", sidFromUrl);
      }
      return;
    }
    const sidLocal = typeof window !== "undefined" ? localStorage.getItem("selected_station_id") : null;
    setStationId(sidLocal);
  }, [searchParams]);

  useEffect(() => {
    if (!stationId) return;
    refetchStationInfo(stationId).catch((e) => setError(e?.message || "fetch failed"));
  }, [stationId, refetchStationInfo]);

  return (
    <section className="tw-space-y-4">
      <div className="tw-flex tw-items-center tw-gap-3">
        {!stationId ? (
          <span className="tw-text-gray-600">ยังไม่ได้เลือกสถานี</span>
        ) : loadingInfo ? (
          <span className="tw-text-blue-600">กำลังโหลด...</span>
        ) : (
          <span className="tw-text-red-600">{error}</span>
        )}

        <button
          className="tw-ml-auto tw-text-sm tw-rounded-md tw-border tw-px-3 tw-py-1 hover:tw-bg-gray-50 tw-transition-colors"
          onClick={() => {
            if (stationId) {
              refetchStationInfo(stationId);
            }
          }}
          disabled={loadingInfo}
        >
          {loadingInfo ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <div className="tw-w-full tw-grid tw-gap-6 tw-grid-cols-1 md:!tw-grid-cols-3">
        {AI_ITEMS.map((item) => {
          const statusKey = `${item.id}IsActive`;
          const isEnabled = modulesStatus[statusKey];
          const progress = modulesProgress[item.id] || item.progress || 0;

          return (
            <AiItemCard
              key={item.id}
              item={{ ...item, progress }}
              enabled={isEnabled}
              onToggle={(next: boolean) => toggleModule(item.id, next)}
              disabled={loadingInfo}
              onMoreDetail={() => handleMoreDetail(item.id)}   // 👈 ตรงนี้สำคัญ
            />
          );
        })}
      </div>
    </section>
  );
}