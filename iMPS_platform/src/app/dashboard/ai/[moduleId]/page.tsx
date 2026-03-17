"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  useRouter,
  useSearchParams,
  useParams,
} from "next/navigation";
import {
  Typography,
  Card,
  CardHeader,
  CardBody,
  Button,
} from "@/components/MaterialTailwind";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ModuleConfig = {
  id: string;
  title: string;
  description: string;
};

const MODULE_CONFIG: Record<string, ModuleConfig> = {
  module1: {
    id: "module1",
    title: "MDB Dust Filters Prediction",
    description:
      "ใช้ข้อมูลสภาพแวดล้อมและอายุการใช้งานของไส้กรอง MDB เพื่อคำนวณ Health Index ของระบบกรองฝุ่น",
  },
  module2: {
    id: "module2",
    title: "Charger Dust Filters Prediction",
    description:
      "วิเคราะห์สภาพไส้กรองฝุ่นของ Charger และแปลงออกมาเป็น Health Index (เปอร์เซ็นต์)",
  },
  module3: {
    id: "module3",
    title: "Online / Offline Prediction",
    description:
      "วิเคราะห์ปัญหาการออนไลน์/ออฟไลน์ของ Edgebox/อุปกรณ์ และคำนวณ Health Index ของสถานะเครือข่าย",
  },
  module4: {
    id: "module4",
    title: "AB Normal Power Supply Prediction",
    description:
      "ตรวจจับความผิดปกติฝั่ง Power Supply เช่น Voltage/Current mismatch และคำนวณ Health Index",
  },
  module5: {
    id: "module5",
    title: "Network Prediction",
    description:
      "ตรวจสอบสถานะอุปกรณ์เครือข่ายทั้งหมด แล้วรวมเป็น Health Index ของระบบ Network",
  },
  module6: {
    id: "module6",
    title: "The Remaining Useful Life (RUL) Prediction",
    description:
      "ใช้ RUL ของอุปกรณ์หลัก ๆ ในตู้ชาร์จมาคำนวณเป็น Average Health Index ของทั้งระบบ",
  },
  module7: {
    id: "module7",
    title: "Root Cause Analysis Prediction",
    description:
      "ใช้ผลการทำนาย Root Cause (เช่น Error DC contractor) แล้วแปลงเป็น Health Index รวม",
  },
};

type HealthInfo = {
  value: number | null;
  label?: string | null;
  sourcePath?: string | null;
};

function getHealthInfo(moduleId: string, output: any | null): HealthInfo {
  if (!output) return { value: null, label: null, sourcePath: null };

  let raw: number | null = null;
  let label: string | null = null;
  let sourcePath: string | null = null;

  switch (moduleId) {
    case "module1":
      raw = typeof output?.health?.health_index === "number"
        ? output.health.health_index
        : null;
      label = output?.health?.health_status ?? null;
      sourcePath = "health.health_index";
      break;

    case "module2":
      raw = typeof output?.health_index_percent === "number"
        ? output.health_index_percent
        : null;
      label = output?.filter_status ?? null;
      sourcePath = "health_index_percent";
      break;

    case "module3":
      raw = typeof output?.health_index === "number"
        ? output.health_index
        : null;
      label = output?.health_status ?? null;
      sourcePath = "health_index";
      break;

    case "module4":
      raw = typeof output?.health_index === "number"
        ? output.health_index
        : null;
      label = output?.prediction_status ?? null;
      sourcePath = "health_index";
      break;

    case "module5":
      raw = typeof output?.health?.health_index === "number"
        ? output.health.health_index
        : null;
      label = output?.health?.health_level ?? null;
      sourcePath = "health.health_index";
      break;

    case "module6":
      raw = typeof output?.overall_health?.average_health_index === "number"
        ? output.overall_health.average_health_index
        : null;
      label = output?.overall_health?.overall_status ?? null;
      sourcePath = "overall_health.average_health_index";
      break;

    case "module7":
      raw = typeof output?.health_index === "number"
        ? output.health_index
        : null;
      label = null;
      sourcePath = "health_index";
      break;

    default:
      raw = null;
  }

  return {
    value: raw,
    label,
    sourcePath,
  };
}

function getHealthColorClasses(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return {
      ring: "tw-border-blue-gray-200",
      text: "tw-text-blue-gray-500",
      badge: "tw-bg-blue-gray-50 tw-text-blue-gray-600",
      gradient: "tw-from-blue-gray-400 tw-to-blue-gray-500",
      glow: "tw-shadow-blue-gray-500/20",
    };
  }

  if (value < 40) {
    return {
      ring: "tw-border-red-500",
      text: "tw-text-red-600",
      badge: "tw-bg-red-50 tw-text-red-700",
      gradient: "tw-from-red-500 tw-to-red-600",
      glow: "tw-shadow-red-500/30",
    };
  }
  if (value < 70) {
    return {
      ring: "tw-border-amber-500",
      text: "tw-text-amber-700",
      badge: "tw-bg-amber-50 tw-text-amber-700",
      gradient: "tw-from-amber-500 tw-to-amber-600",
      glow: "tw-shadow-amber-500/30",
    };
  }
  return {
    ring: "tw-border-green-500",
    text: "tw-text-green-600",
    badge: "tw-bg-green-50 tw-text-green-700",
    gradient: "tw-from-green-500 tw-to-green-600",
    glow: "tw-shadow-green-500/30",
  };
}

type FeatureItem = { key: string; value: string };

function extractFeaturesFromInput(
  inputData: any | null,
  maxItems = 20
): FeatureItem[] {
  if (!inputData || typeof inputData !== "object") return [];

  const result: FeatureItem[] = [];

  const walk = (obj: any, prefix = "", depth = 0) => {
    if (!obj || typeof obj !== "object" || depth > 2) return;

    for (const [k, v] of Object.entries(obj)) {
      if (result.length >= maxItems) return;

      if (k === "_id") continue;

      const path = prefix ? `${prefix}.${k}` : k;

      if (
        v === null ||
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        result.push({
          key: path,
          value: String(v),
        });
      } else if (Array.isArray(v)) {
        result.push({
          key: path,
          value: `[${v.length} items]`,
        });
      } else if (typeof v === "object") {
        walk(v, path, depth + 1);
      }
    }
  };

  walk(inputData, "", 0);
  return result;
}

type ModuleTimestamps = {
  inputRaw?: string | null;
  outputRaw?: string | null;
  inputDisplay?: string | null;
  outputDisplay?: string | null;
};

function normalizeIsoLike(str: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+$/.test(str)) {
    const [head, frac] = str.split(".");
    if (frac.length > 3) {
      return `${head}.${frac.slice(0, 3)}`;
    }
  }
  return str;
}

function formatTimestamp(
  ts: any,
  opts?: { add7Hours?: boolean }
): string | null {
  if (!ts) return null;
  let s = typeof ts === "string" ? ts : String(ts);
  s = normalizeIsoLike(s);

  const d0 = new Date(s);
  if (Number.isNaN(d0.getTime())) {
    return s;
  }

  let d = d0;
  if (opts?.add7Hours) {
    d = new Date(d0.getTime() + 7 * 60 * 60 * 1000);
  }

  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function getModuleTimestamps(
  moduleId: string,
  inputData: any | null,
  outputData: any | null
): ModuleTimestamps {
  let inputRaw: string | null | undefined = null;
  let outputRaw: string | null | undefined = null;
  let outputAdd7 = false;

  if (inputData && typeof inputData === "object") {
    inputRaw = inputData.timestamp ?? null;
  }

  switch (moduleId) {
    case "module1":
      outputRaw = outputData?.original_timestamp ?? null;
      break;
    case "module2":
      outputRaw = outputData?.timestamp ?? null;
      break;
    case "module3":
      outputRaw = outputData?.source_timestamp ?? null;
      break;
    case "module4":
      outputRaw = outputData?.timestamp ?? null;
      break;
    case "module5":
      outputRaw = outputData?.metadata?.prediction_time ?? null;
      break;
    case "module6":
      outputRaw = outputData?.timestamp ?? null;
      outputAdd7 = true;
      break;
    case "module7":
      outputRaw = outputData?.timestamp ?? null;
      break;
    default:
      break;
  }

  const inputDisplay = formatTimestamp(inputRaw);
  const outputDisplay = formatTimestamp(outputRaw, {
    add7Hours: outputAdd7,
  });

  return {
    inputRaw,
    outputRaw,
    inputDisplay,
    outputDisplay,
  };
}

export default function ModuleDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ moduleId: string }>();

  const moduleId = params?.moduleId ?? "module1";
  const stationId = searchParams.get("station_id") ?? "Klongluang3";

  const config: ModuleConfig =
    MODULE_CONFIG[moduleId] ??
    ({
      id: moduleId,
      title: moduleId,
      description: "",
    } as ModuleConfig);

  const [inputData, setInputData] = useState<any | null>(null);
  const [outputData, setOutputData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const goList = () => {
    const query = stationId
      ? `?station_id=${encodeURIComponent(stationId)}`
      : "";
    router.push(`/dashboard/ai${query}`, { scroll: false });
  };

  useEffect(() => {
    if (!moduleId || !stationId) return;

    let cancelled = false;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("access_token") || ""
            : "";

        const url = `${API_BASE}/modules/detail?module_id=${encodeURIComponent(
          String(moduleId)
        )}&station_id=${encodeURIComponent(stationId)}`;

        const res = await fetch(url, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          credentials: token ? "omit" : "include",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();

        if (!cancelled) {
          setInputData(json.input ?? null);
          setOutputData(json.output ?? null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(
            e?.message || "Failed to fetch module detail"
          );
          setInputData(null);
          setOutputData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [moduleId, stationId]);

  const features = useMemo(
    () => extractFeaturesFromInput(inputData, 24),
    [inputData]
  );

  const healthInfo = useMemo(
    () => getHealthInfo(moduleId, outputData),
    [moduleId, outputData]
  );

  const healthClasses = getHealthColorClasses(healthInfo.value);
  const healthDisplay =
    healthInfo.value !== null && !Number.isNaN(healthInfo.value)
      ? healthInfo.value.toFixed(1)
      : "--";

  const timestamps = useMemo(
    () => getModuleTimestamps(moduleId, inputData, outputData),
    [moduleId, inputData, outputData]
  );

  return (
    <div className="tw-mt-8 tw-space-y-4">
      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes slide-in-left {
          from {
            transform: translateX(-20px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slide-in-right {
          from {
            transform: translateX(20px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .animate-rotate {
          animation: rotate 20s linear infinite;
        }

        .animate-scale-in {
          animation: scale-in 0.5s ease-out;
        }

        .animate-slide-in-left {
          animation: slide-in-left 0.6s ease-out;
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.6s ease-out;
        }
        
        .feature-card {
          transition: all 0.3s ease;
        }
        
        .feature-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .timestamp-badge {
          backdrop-filter: blur(8px);
        }
      `}</style>

      {/* Header + Back */}
      <div className="tw-flex tw-items-center tw-gap-3 tw-mb-4">
        <Button
          variant="outlined"
          size="sm"
          onClick={goList}
          className="tw-py-2 tw-px-2"
          title="กลับไปหน้า AI Modules"
        >
          <ArrowLeftIcon className="tw-w-4 tw-h-4 tw-stroke-blue-gray-900 tw-stroke-2" />
        </Button>

        <div>
          <Typography variant="h5" className="tw-font-semibold">
            {config.title}
          </Typography>
          <div className="tw-flex tw-flex-wrap tw-gap-2 tw-mt-1">
            <span className="tw-inline-flex tw-items-center tw-rounded-full tw-bg-blue-gray-50 tw-px-3 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-blue-gray-700">
              Module ID:
              <span className="tw-ml-1 tw-font-mono">{config.id}</span>
            </span>
            {stationId && (
              <span className="tw-inline-flex tw-items-center tw-rounded-full tw-bg-green-50 tw-px-3 tw-py-0.5 tw-text-[11px] tw-font-medium tw-text-green-700">
                Station:
                <span className="tw-ml-1 tw-font-mono">{stationId}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {config.description && (
        <Typography className="tw-text-sm tw-text-blue-gray-700 tw-mb-2">
          {config.description}
        </Typography>
      )}

      {error && (
        <Typography className="tw-text-sm tw-text-red-600 tw-mb-2">
          {error}
        </Typography>
      )}

      {/* Enhanced DIAGRAM with Timestamps */}
      <Card className="tw-border tw-border-blue-gray-50 tw-bg-gradient-to-br tw-from-white tw-to-blue-gray-50/30 tw-shadow-lg">
        <CardBody className="tw-p-6">
          {loading ? (
            <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-12">
              <div className="tw-w-12 tw-h-12 tw-border-4 tw-border-blue-gray-200 tw-border-t-blue-500 tw-rounded-full animate-rotate"></div>
              <Typography className="tw-text-sm tw-text-blue-gray-500 tw-mt-4">
                กำลังโหลดข้อมูล...
              </Typography>
            </div>
          ) : (
            <div className="tw-flex tw-flex-col lg:tw-flex-row tw-gap-8 tw-items-stretch tw-justify-between">
              {/* LEFT: Input features */}
              <div className="tw-flex-1 animate-slide-in-left">
                <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
                  <div className="tw-w-1 tw-h-6 tw-bg-gradient-to-b tw-from-blue-500 tw-to-blue-600 tw-rounded-full"></div>
                  <Typography className="tw-text-base tw-font-bold tw-text-blue-gray-900">
                    Input Features
                  </Typography>
                </div>
                
                <div className="tw-bg-gradient-to-r tw-from-blue-50 tw-to-indigo-50/50 tw-rounded-xl tw-p-4 tw-mb-4 tw-border tw-border-blue-100 tw-shadow-sm">
                  <Typography className="tw-text-xs tw-text-blue-gray-700 tw-leading-relaxed tw-mb-2">
                    ข้อมูลจาก document ล่าสุดของสถานี{" "}
                    <span className="tw-font-mono tw-font-semibold tw-text-blue-600">{stationId}</span>
                  </Typography>
                  
                  {timestamps.inputDisplay && (
                    <div className="tw-flex tw-items-center tw-gap-2 tw-mt-2">
                      <svg className="tw-w-3.5 tw-h-3.5 tw-text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="tw-text-[11px] tw-font-mono tw-text-blue-700 tw-font-semibold">
                        {timestamps.inputDisplay}
                      </span>
                    </div>
                  )}
                </div>

                {features.length === 0 ? (
                  <div className="tw-text-center tw-py-8 tw-px-4 tw-bg-blue-gray-50/50 tw-rounded-lg tw-border tw-border-dashed tw-border-blue-gray-200">
                    <Typography className="tw-text-sm tw-text-blue-gray-400 tw-italic">
                      ไม่พบข้อมูล input หรือยังไม่ได้เก็บข้อมูลใน MongoDB
                    </Typography>
                  </div>
                ) : (
                  <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-3">
                    {features.map((f, idx) => (
                      <div
                        key={f.key}
                        className="feature-card tw-rounded-lg tw-border tw-border-blue-gray-100 tw-bg-white tw-px-3 tw-py-2.5 tw-shadow-sm"
                        style={{ animationDelay: `${idx * 0.05}s` }}
                      >
                        <div className="tw-flex tw-items-start tw-gap-2">
                          <div className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500 tw-mt-1.5 tw-flex-shrink-0"></div>
                          <div className="tw-flex-1 tw-min-w-0">
                            <div className="tw-text-[11px] tw-font-mono tw-text-blue-gray-500 tw-truncate tw-mb-0.5">
                              {f.key}
                            </div>
                            <div className="tw-text-xs tw-font-semibold tw-text-blue-gray-900 tw-break-all">
                              {f.value}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* MIDDLE: Enhanced Flow Animation */}
              <div className="tw-hidden lg:tw-flex tw-flex-col tw-items-center tw-justify-center tw-min-w-[120px] tw-relative">
                <div className="tw-relative tw-flex tw-flex-col tw-items-center">
                  {/* Top Section */}
                  <div className="tw-w-0.5 tw-h-16 tw-bg-gradient-to-b tw-from-blue-500 tw-to-blue-400 tw-rounded-full"></div>
                  
                  {/* Animated Dots */}
                  <div className="tw-my-1 tw-flex tw-flex-col tw-gap-1">
                    <div className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500 animate-pulse-glow" style={{ animationDelay: '0s' }}></div>
                    <div className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500 animate-pulse-glow" style={{ animationDelay: '0.3s' }}></div>
                    <div className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500 animate-pulse-glow" style={{ animationDelay: '0.6s' }}></div>
                  </div>

                  {/* AI Processing Icon */}
                  <div className="tw-my-3 tw-relative">
                    <div className={`tw-absolute tw-inset-0 tw-rounded-2xl tw-bg-gradient-to-br ${healthClasses.gradient} tw-opacity-20 tw-blur-xl animate-pulse-glow`}></div>
                    <div className="tw-relative tw-flex tw-items-center tw-justify-center tw-rounded-2xl tw-border-2 tw-border-blue-500 tw-bg-white tw-w-16 tw-h-16 tw-shadow-lg">
                      <svg className="tw-w-8 tw-h-8 tw-text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div className="tw-absolute -tw-bottom-6 tw-left-1/2 tw--translate-x-1/2 tw-whitespace-nowrap tw-text-[10px] tw-font-semibold tw-text-blue-600">
                      AI Model
                    </div>
                  </div>

                  {/* Animated Dots */}
                  <div className="tw-my-1 tw-flex tw-flex-col tw-gap-1 tw-mt-6">
                    <div className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500 animate-pulse-glow" style={{ animationDelay: '0.9s' }}></div>
                    <div className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500 animate-pulse-glow" style={{ animationDelay: '1.2s' }}></div>
                    <div className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-blue-500 animate-pulse-glow" style={{ animationDelay: '1.5s' }}></div>
                  </div>

                  {/* Bottom Section */}
                  <div className="tw-w-0.5 tw-h-16 tw-bg-gradient-to-b tw-from-blue-400 tw-to-blue-500 tw-rounded-full"></div>
                </div>
              </div>

              {/* RIGHT: Enhanced Health Index Display */}
              <div className="tw-flex-1 tw-flex tw-flex-col tw-items-center tw-justify-center animate-slide-in-right">
                <div className="tw-flex tw-items-center tw-gap-2 tw-mb-3">
                  <Typography className="tw-text-base tw-font-bold tw-text-blue-gray-900">
                    Health Index Output
                  </Typography>
                  <div className="tw-w-1 tw-h-6 tw-bg-gradient-to-b tw-from-green-500 tw-to-green-600 tw-rounded-full"></div>
                </div>

                {/* Timestamp Badge */}
                {timestamps.outputDisplay && (
                  <div className="timestamp-badge tw-mb-4 tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2 tw-rounded-full tw-bg-gradient-to-r tw-from-purple-50 tw-to-pink-50 tw-border tw-border-purple-100 tw-shadow-sm">
                    <svg className="tw-w-3.5 tw-h-3.5 tw-text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="tw-text-[11px] tw-font-mono tw-text-purple-700 tw-font-semibold">
                      {timestamps.outputDisplay}
                    </span>
                  </div>
                )}

                <div className="tw-relative tw-mb-6">
                  {/* Outer Glow Ring */}
                  <div className={`tw-absolute tw-inset-0 tw-rounded-full tw-bg-gradient-to-br ${healthClasses.gradient} tw-opacity-20 tw-blur-2xl ${healthClasses.glow} tw-shadow-2xl animate-pulse-glow`}></div>
                  
                  {/* Main Circle */}
                  <div className="tw-relative">
                    <div
                      className={`tw-w-48 tw-h-48 tw-rounded-full tw-border-[8px] ${healthClasses.ring} tw-flex tw-items-center tw-justify-center tw-bg-white tw-shadow-xl tw-relative tw-overflow-hidden`}
                    >
                      {/* Inner Gradient Background */}
                      <div className={`tw-absolute tw-inset-0 tw-bg-gradient-to-br ${healthClasses.gradient} tw-opacity-5`}></div>
                      
                      {/* Content */}
                      <div className="tw-text-center tw-relative tw-z-10">
                        <div className={`tw-text-5xl tw-font-bold ${healthClasses.text} tw-mb-1`}>
                          {healthDisplay}
                        </div>
                        <div className="tw-text-xs tw-font-semibold tw-text-blue-gray-500 tw-uppercase tw-tracking-wider">
                          Health Index
                        </div>
                        <div className="tw-text-[10px] tw-text-blue-gray-400 tw-mt-0.5">
                          Percentage (%)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Badge and Info */}
                <div className="tw-mt-2 tw-flex tw-flex-col tw-items-center tw-gap-3 tw-w-full tw-max-w-xs">
                  {healthInfo.label && (
                    <span
                      className={`tw-inline-flex tw-items-center tw-rounded-full tw-px-4 tw-py-2 tw-text-xs tw-font-bold tw-uppercase tw-tracking-wide ${healthClasses.badge} tw-shadow-sm`}
                    >
                      <span className={`tw-w-2 tw-h-2 tw-rounded-full tw-bg-current tw-mr-2 animate-pulse-glow`}></span>
                      {healthInfo.label}
                    </span>
                  )}
                  
                  {healthInfo.sourcePath && (
                    <div className="tw-bg-gradient-to-r tw-from-blue-gray-50 tw-to-slate-50 tw-rounded-lg tw-px-4 tw-py-2.5 tw-w-full tw-border tw-border-blue-gray-100 tw-shadow-sm">
                      <div className="tw-flex tw-items-center tw-gap-1.5 tw-mb-1">
                        <svg className="tw-w-3 tw-h-3 tw-text-blue-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="tw-text-[10px] tw-text-blue-gray-500 tw-font-semibold tw-uppercase tw-tracking-wide">
                          Source Field
                        </div>
                      </div>
                      <div className="tw-text-xs tw-font-mono tw-font-semibold tw-text-blue-gray-700 tw-break-all">
                        {healthInfo.sourcePath}
                      </div>
                    </div>
                  )}
                </div>

                {!outputData && !loading && (
                  <div className="tw-mt-6 tw-text-center tw-py-4 tw-px-6 tw-bg-gradient-to-r tw-from-amber-50 tw-to-orange-50 tw-rounded-lg tw-border tw-border-amber-200 tw-shadow-sm">
                    <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
                      <svg className="tw-w-4 tw-h-4 tw-text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <Typography className="tw-text-xs tw-text-amber-700 tw-font-medium">
                        ยังไม่พบผลลัพธ์ output ของโมดูลนี้
                      </Typography>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}