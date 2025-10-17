"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";

// ---------------------------------------------------------
// Minimal-luxe Lightbox (responsive, accessible, no deps)
// ---------------------------------------------------------
// • Simple, elegant UI with large click targets
// • Keyboard: Esc (close), ← → (navigate)
// • Touch: swipe left/right to navigate
// • Click outside to close
// • Scroll lock when open
// • Works with Next/Image for perf
// • Controlled or uncontrolled index
// ---------------------------------------------------------

export type LightboxImage = {
  src: string;
  alt?: string;
  caption?: string;
};

export type LightboxProps = {
  open: boolean;
  images: LightboxImage[];
  index?: number; // controlled (optional)
  onIndexChange?: (next: number) => void;
  onClose: () => void;
  loop?: boolean;
  className?: string;
  showCounter?: boolean;
};

export default function Lightbox({
  open,
  images,
  index,
  onIndexChange,
  onClose,
  loop = true,
  className,
  showCounter = true,
}: LightboxProps) {
  const mountedRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [internalIndex, setInternalIndex] = useState(index ?? 0);

  const count = images?.length ?? 0;
  const current = index ?? internalIndex;
  const safeCurrent = count === 0 ? 0 : ((current % count) + count) % count; // normalize

  // Ensure internal index tracks controlled prop changes
  useEffect(() => {
    if (typeof index === "number") setInternalIndex(index);
  }, [index]);

  // Mount guard for portal (SSR-safe)
  useEffect(() => {
    mountedRef.current = true;
    setMounted(true);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Scroll lock
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [open]);

  const setIndex = useCallback(
    (next: number) => {
      if (!count) return;
      let n = next;
      if (loop) {
        n = (next + count) % count;
      } else {
        n = Math.max(0, Math.min(next, count - 1));
      }
      if (onIndexChange) onIndexChange(n);
      else setInternalIndex(n);
    },
    [count, loop, onIndexChange]
  );

  const prev = useCallback(() => setIndex(safeCurrent - 1), [safeCurrent, setIndex]);
  const next = useCallback(() => setIndex(safeCurrent + 1), [safeCurrent, setIndex]);

  // Keyboard controls
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next, onClose]);

  // Touch swipe
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    touch.current = null;
    if (adx > 50 && adx > ady) {
      if (dx < 0) next();
      else prev();
    }
  };

  const currentImage = images?.[safeCurrent];

  // Early returns
  if (!mounted || !open || !images || images.length === 0) return null;

  const Overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={currentImage?.alt || "Image preview"}
      className={[
        "tw-fixed tw-inset-0 tw-z-[1000] tw-flex tw-items-center tw-justify-center",
        "tw-bg-black/80 tw-backdrop-blur-sm",
        className || "",
      ].join(" ")}
      onClick={onClose}
    >
      {/* Content frame */}
      <div
        className="tw-relative tw-w-full tw-max-w-[96vw] tw-h-[88vh] md:tw-h-[86vh] tw-flex tw-items-center tw-justify-center"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Current image */}
        <div className="tw-relative tw-w-full tw-h-full">
          <Image
            src={currentImage?.src || ""}
            alt={currentImage?.alt || "preview"}
            fill
            sizes="100vw"
            priority
            className="tw-object-contain tw-rounded-2xl tw-shadow-2xl tw-select-none"
          />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="tw-absolute tw-top-3 tw-right-3 tw-z-20 tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-bg-white/10 hover:tw-bg-white/20 tw-p-2 md:tw-p-3 tw-text-white tw-ring-1 tw-ring-white/30 tw-backdrop-blur-lg tw-transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="tw-w-5 tw-h-5 md:tw-w-6 md:tw-h-6">
            <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Prev zone */}
        {count > 1 && (
          <button
            onClick={prev}
            aria-label="Previous"
            className="tw-absolute tw-left-4 md:tw-left-5 tw-top-1/2 -tw-translate-y-1/2 tw-z-10 tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-bg-white/10 hover:tw-bg-white/20 tw-p-2 md:tw-p-3 tw-text-white tw-ring-1 tw-ring-white/30 tw-backdrop-blur-lg tw-shadow-lg tw-transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="tw-w-5 tw-h-5 md:tw-w-6 md:tw-h-6">
              <path fillRule="evenodd" d="M15.53 4.47a.75.75 0 0 1 0 1.06L9.06 12l6.47 6.47a.75.75 0 0 1-1.06 1.06l-7-7a.75.75 0 0 1 0-1.06l7-7a.75.75 0 0 1 1.06 0z" clipRule="evenodd" />
            </svg>
          </button>
        )}

        {/* Next zone */}
        {count > 1 && (
          <button
            onClick={next}
            aria-label="Next"
            className="tw-absolute tw-right-4 md:tw-right-5 tw-top-1/2 -tw-translate-y-1/2 tw-z-10 tw-inline-flex tw-items-center tw-justify-center tw-rounded-full tw-bg-white/10 hover:tw-bg-white/20 tw-p-2 md:tw-p-3 tw-text-white tw-ring-1 tw-ring-white/30 tw-backdrop-blur-lg tw-shadow-lg tw-transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="tw-w-5 tw-h-5 md:tw-w-6 md:tw-h-6">
              <path fillRule="evenodd" d="M8.47 4.47a.75.75 0 0 1 1.06 0l7 7a.75.75 0 0 1 0 1.06l-7 7a.75.75 0 0 1-1.06-1.06L14.94 12 8.47 5.53a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        )}

        {/* Counter + caption */}
        <div className="tw-pointer-events-none tw-absolute tw-bottom-4 tw-left-1/2 -tw-translate-x-1/2 tw-flex tw-flex-col tw-items-center tw-gap-2">
          {currentImage?.caption && (
            <div className="tw-max-w-[92vw] tw-text-center tw-text-white/90 tw-text-xs md:tw-text-sm tw-px-3 tw-py-1.5 tw-bg-black/40 tw-rounded-lg tw-backdrop-blur tw-ring-1 tw-ring-white/20 tw-shadow-lg">
              {currentImage.caption}
            </div>
          )}
          {showCounter && count > 1 && (
            <div className="tw-text-white/90 tw-text-xs md:tw-text-sm tw-px-2.5 tw-py-1 tw-bg-black/40 tw-rounded-full tw-backdrop-blur tw-ring-1 tw-ring-white/20 tw-shadow-lg">
              {safeCurrent + 1} / {count}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(Overlay, document.body);
}

// ----------------------
// Usage (example):
// ----------------------
// const [open, setOpen] = useState(false);
// const [idx, setIdx] = useState(0);
// const imgs = [ {src: "/a.jpg", alt: "A"}, {src: "/b.jpg", alt: "B"} ];
// <Lightbox open={open} index={idx} images={imgs} onClose={() => setOpen(false)} onIndexChange={setIdx} />
