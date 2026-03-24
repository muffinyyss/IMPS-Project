// src/app/dashboard/ai/hooks/useAutoRefresh.ts
"use client";
import { useState, useEffect } from "react";

export function useAutoRefresh(intervalSec = 120) {
  const [tick, setTick] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(intervalSec);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setTick((t) => t + 1);
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [intervalSec, isPaused]);

  return {
    tick,
    countdown,
    isPaused,
    pause: () => setIsPaused(true),
    resume: () => setIsPaused(false),
    refresh: () => setTick((t) => t + 1),
  };
}