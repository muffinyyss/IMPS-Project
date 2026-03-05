"use client";

import React from "react";

/**
 * LoadingOverlay — แสดงตอนโหลดข้อมูล กดอะไรข้างหลังไม่ได้
 * ใช้: <LoadingOverlay show={loading} text="กำลังโหลด..." />
 */
export default function LoadingOverlay({
  show,
  text = "Loading...",
}: {
  show: boolean;
  text?: string;
}) {
  if (!show) return null;

  return (
    <div className="tw-fixed tw-inset-0 tw-z-[9999] tw-flex tw-items-center tw-justify-center tw-select-none">
      {/* Backdrop */}
      <div className="tw-absolute tw-inset-0 tw-bg-gradient-to-br tw-from-gray-900/60 tw-via-black/50 tw-to-gray-900/60 tw-backdrop-blur-md" />

      {/* Card */}
      <div
        className="tw-relative tw-flex tw-flex-col tw-items-center tw-gap-6 tw-px-12 tw-py-10 tw-rounded-3xl tw-bg-white/95 tw-shadow-[0_25px_60px_-12px_rgba(0,0,0,0.4)] tw-ring-1 tw-ring-black/[0.06]"
        style={{ animation: "overlay-card-in 0.35s cubic-bezier(0.16,1,0.3,1)" }}
      >
        {/* Animated rings spinner */}
        <div className="tw-relative tw-h-16 tw-w-16">
          {/* Outer ring */}
          <div
            className="tw-absolute tw-inset-0 tw-rounded-full tw-border-[3px] tw-border-transparent"
            style={{
              borderTopColor: "#1e293b",
              borderRightColor: "#1e293b",
              animation: "overlay-spin 1s cubic-bezier(0.5,0,0.5,1) infinite",
            }}
          />
          {/* Middle ring */}
          <div
            className="tw-absolute tw-inset-[6px] tw-rounded-full tw-border-[3px] tw-border-transparent"
            style={{
              borderBottomColor: "#3b82f6",
              borderLeftColor: "#3b82f6",
              animation: "overlay-spin 0.8s cubic-bezier(0.5,0,0.5,1) infinite reverse",
            }}
          />
          {/* Inner ring */}
          <div
            className="tw-absolute tw-inset-[12px] tw-rounded-full tw-border-[3px] tw-border-transparent"
            style={{
              borderTopColor: "#f59e0b",
              animation: "overlay-spin 1.2s linear infinite",
            }}
          />
          {/* Center bolt icon */}
          <div className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="tw-w-5 tw-h-5 tw-text-gray-800"
              style={{ animation: "overlay-pulse 1.5s ease-in-out infinite" }}
            >
              <path
                fillRule="evenodd"
                d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {/* Text + dots */}
        <div className="tw-flex tw-flex-col tw-items-center tw-gap-1.5">
          <span className="tw-text-[15px] tw-font-bold tw-text-gray-800 tw-tracking-tight">
            {text}
          </span>
          {/* Animated dots */}
          <div className="tw-flex tw-items-center tw-gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="tw-h-1.5 tw-w-1.5 tw-rounded-full tw-bg-gray-400"
                style={{
                  animation: "overlay-bounce 1.2s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="tw-w-40 tw-h-1 tw-rounded-full tw-bg-gray-100 tw-overflow-hidden">
          <div
            className="tw-h-full tw-rounded-full tw-bg-gradient-to-r tw-from-gray-800 tw-via-blue-500 tw-to-amber-400"
            style={{
              animation: "overlay-progress 1.8s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes overlay-card-in {
          from { opacity: 0; transform: scale(0.9) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes overlay-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes overlay-pulse {
          0%, 100% { opacity: 0.6; transform: scale(0.9); }
          50%      { opacity: 1;   transform: scale(1.1); }
        }
        @keyframes overlay-bounce {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40%           { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes overlay-progress {
          0%   { width: 0%; margin-left: 0; }
          50%  { width: 70%; margin-left: 15%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}