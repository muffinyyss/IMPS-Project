// src/app/dashboard/ai/components/KpiCard.tsx
"use client";
import React from "react";
import { ModuleConfig, getHealthColor, getHealthLabel } from "../lib/constants";
import { ModuleResult } from "../lib/api";

interface Props {
  module: ModuleConfig;
  data: ModuleResult | null;
  loading?: boolean;
  onClick?: () => void;
  countdown?: number;
  isPaused?: boolean;
  onTogglePause?: () => void;
}

function HealthGaugeSvg({ value, color }: { value: number; color: string }) {
  // Semicircle arc: total arc length = 106.81
  const ARC_LEN = 106.81;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const offset = ARC_LEN - pct * ARC_LEN;
  return (
    <svg viewBox="0 0 80 46" className="tw-w-16 tw-h-10">
      {/* Track */}
      <path d="M 6 42 A 34 34 0 0 1 74 42" stroke="#e2e8f0" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* Fill */}
      <path
        d="M 6 42 A 34 34 0 0 1 74 42"
        stroke={color}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={ARC_LEN}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export default function KpiCard({ module: mod, data, loading, onClick }: Props) {
  const health = data?.health ?? null;
  const hasError = !data || !!data.error;
  const color = getHealthColor(health);
  const label = getHealthLabel(health);

  const statusBadge =
    health == null ? "na"
    : health >= 75 ? "ok"
    : health >= 50 ? "warn"
    : "crit";

  const badgeClass: Record<string, string> = {
    ok:   "tw-bg-green-100 tw-text-green-700",
    warn: "tw-bg-amber-100 tw-text-amber-700",
    crit: "tw-bg-red-100   tw-text-red-700",
    na:   "tw-bg-gray-100  tw-text-gray-500",
  };

  return (
    <div
      onClick={onClick}
      className="tw-bg-white tw-rounded-xl tw-border tw-border-gray-100 tw-shadow-sm
                 tw-cursor-pointer hover:tw-shadow-md hover:tw-border-gray-200
                 tw-transition-all tw-duration-200 tw-overflow-hidden tw-flex tw-flex-col"
    >
      {/* Top color bar */}
      <div className="tw-h-1.5 tw-w-full" style={{ background: mod.color }} />

      <div className="tw-p-4 tw-flex tw-flex-col tw-gap-3">
        {/* Header */}
        <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
          <div className="tw-flex tw-items-center tw-gap-2">
            <div
              className="tw-w-9 tw-h-9 tw-rounded-lg tw-flex tw-items-center tw-justify-center tw-text-base tw-flex-shrink-0"
              style={{ background: `${mod.color}18` }}
            >
              {mod.icon}
            </div>
            <div>
              <div className="tw-text-sm tw-font-semibold tw-text-gray-800 tw-leading-tight">{mod.label}</div>
              <div className="tw-text-xs tw-text-gray-400 tw-leading-tight tw-mt-0.5">{mod.labelTh}</div>
            </div>
          </div>
          <span className={`tw-text-xs tw-font-semibold tw-px-2 tw-py-0.5 tw-rounded-full tw-flex-shrink-0 ${badgeClass[statusBadge]}`}>
            {statusBadge === "ok" ? "NORMAL" : statusBadge === "warn" ? "WARNING" : statusBadge === "crit" ? "CRITICAL" : "N/A"}
          </span>
        </div>

        {/* Gauge + score */}
        {loading ? (
          <div className="tw-flex tw-items-center tw-justify-center tw-h-16">
            <div className="tw-w-6 tw-h-6 tw-rounded-full tw-border-2 tw-border-gray-200 tw-border-t-blue-500 tw-animate-spin" />
          </div>
        ) : hasError ? (
          <div className="tw-flex tw-items-center tw-justify-center tw-h-16 tw-text-sm tw-text-gray-400">No Data</div>
        ) : (
          <div className="tw-flex tw-items-center tw-gap-3">
            <div className="tw-flex tw-flex-col tw-items-center">
              <HealthGaugeSvg value={health ?? 0} color={color} />
              <div className="tw-text-xl tw-font-bold tw-leading-none" style={{ color }}>
                {health}%
              </div>
              <div className="tw-text-xs tw-text-gray-400 tw-mt-0.5">{label}</div>
            </div>
            <div className="tw-flex tw-flex-col tw-gap-1 tw-flex-1">
              <div className="tw-text-xs tw-text-gray-400">Models</div>
              <div className="tw-text-sm tw-font-medium tw-text-gray-700">
                {mod.aiModels.length > 0 ? `${mod.aiModels.length} loaded` : "Rule-based"}
              </div>
              <div className="tw-text-xs tw-text-gray-400 tw-mt-1">Weight</div>
              <div className="tw-text-sm tw-font-medium tw-text-gray-700">{(mod.weight * 100).toFixed(0)}%</div>
            </div>
          </div>
        )}

        {/* Timestamp */}
        {data?._result_ts && (
          <div className="tw-text-xs tw-text-gray-300 tw-border-t tw-border-gray-50 tw-pt-2">
            {new Date(data._result_ts).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
          </div>
        )}
      </div>
    </div>
  );
}