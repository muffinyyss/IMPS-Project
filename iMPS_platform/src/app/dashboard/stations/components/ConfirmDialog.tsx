"use client";

import React, { useCallback, useEffect, useRef } from "react";

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
};

const VARIANTS = {
  danger: {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="tw-w-6 tw-h-6">
        <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
      </svg>
    ),
    iconBg: "tw-bg-red-100 tw-text-red-600",
    ringColor: "tw-ring-red-100",
    confirmBtn: "tw-bg-gradient-to-b tw-from-red-500 tw-to-red-600 hover:tw-from-red-600 hover:tw-to-red-700 tw-shadow-red-500/25",
    progressBar: "tw-bg-red-500",
  },
  warning: {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="tw-w-6 tw-h-6">
        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
      </svg>
    ),
    iconBg: "tw-bg-amber-100 tw-text-amber-600",
    ringColor: "tw-ring-amber-100",
    confirmBtn: "tw-bg-gradient-to-b tw-from-amber-500 tw-to-amber-600 hover:tw-from-amber-600 hover:tw-to-amber-700 tw-shadow-amber-500/25",
    progressBar: "tw-bg-amber-500",
  },
  info: {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="tw-w-6 tw-h-6">
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
      </svg>
    ),
    iconBg: "tw-bg-blue-100 tw-text-blue-600",
    ringColor: "tw-ring-blue-100",
    confirmBtn: "tw-bg-gradient-to-b tw-from-blue-500 tw-to-blue-600 hover:tw-from-blue-600 hover:tw-to-blue-700 tw-shadow-blue-500/25",
    progressBar: "tw-bg-blue-500",
  },
};

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const v = VARIANTS[variant];

  // Focus confirm button on open
  useEffect(() => {
    if (open) setTimeout(() => confirmRef.current?.focus(), 100);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div className="tw-fixed tw-inset-0 tw-z-[9999] tw-flex tw-items-center tw-justify-center tw-p-4">
      {/* Backdrop */}
      <div
        className="tw-absolute tw-inset-0 tw-bg-black/40 tw-backdrop-blur-sm"
        style={{ animation: "cfd-fade-in 0.2s ease-out" }}
        onClick={() => !loading && onClose()}
      />

      {/* Card */}
      <div
        className="tw-relative tw-w-full tw-max-w-[400px] tw-rounded-2xl tw-bg-white tw-shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)] tw-ring-1 tw-ring-black/[0.06] tw-overflow-hidden"
        style={{ animation: "cfd-pop-in 0.25s cubic-bezier(0.16,1,0.3,1)" }}
      >
        {/* Top accent line */}
        <div className={`tw-h-1 tw-w-full ${v.progressBar}`} />

        <div className="tw-px-6 tw-pt-6 tw-pb-2">
          {/* Icon + Title */}
          <div className="tw-flex tw-items-start tw-gap-4">
            <div className={`tw-flex-shrink-0 tw-h-11 tw-w-11 tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-ring-4 ${v.iconBg} ${v.ringColor}`}>
              {v.icon}
            </div>
            <div className="tw-flex-1 tw-min-w-0 tw-pt-0.5">
              <h3 className="tw-text-[15px] tw-font-bold tw-text-gray-900 tw-leading-snug">
                {title}
              </h3>
              {message && (
                <p className="tw-mt-1.5 tw-text-[13px] tw-text-gray-500 tw-leading-relaxed">
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="tw-flex tw-gap-2.5 tw-px-6 tw-py-4 tw-mt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="tw-flex-1 tw-h-10 tw-rounded-xl tw-border tw-border-gray-200 tw-bg-white tw-text-[13px] tw-font-semibold tw-text-gray-600 hover:tw-bg-gray-50 hover:tw-border-gray-300 tw-transition-all tw-duration-150 active:tw-scale-[0.97] disabled:tw-opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`tw-flex-1 tw-h-10 tw-rounded-xl tw-text-[13px] tw-font-semibold tw-text-white tw-shadow-lg tw-transition-all tw-duration-150 active:tw-scale-[0.97] disabled:tw-opacity-60 tw-flex tw-items-center tw-justify-center tw-gap-2 ${v.confirmBtn}`}
          >
            {loading ? (
              <>
                <svg className="tw-animate-spin tw-h-4 tw-w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="tw-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="tw-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Deleting...</span>
              </>
            ) : confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes cfd-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cfd-pop-in {
          from { opacity: 0; transform: scale(0.9) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}