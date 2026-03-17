import type { PhotoRef } from "./draftPhotos";

type PF = "PASS" | "FAIL" | "NA" | "";

type MeasureRow = { value: string; unit: string };
type MeasureState = Record<string, MeasureRow>;

type DraftData = {
  rows: Record<string, { pf: PF; remark: string }>;
  
  // === NEW STRUCTURE (MDB v2) ===
  // Q4: Dynamic Breaker Main - Record of item keys to measure states
  m4?: Record<string, MeasureState>;
  // Q5: Charger Breakers - Record of item keys to measure states  
  m5?: Record<string, MeasureState>;
  // Q6: CCB - Single measure state
  m6?: MeasureState;
  
  // Pre values for dynamic items
  m4Pre?: Record<string, MeasureState>;
  m5Pre?: Record<string, MeasureState>;
  m6Pre?: MeasureState;
  
  // Dynamic items configuration
  q4_items?: { key: string; label: string }[];
  charger_count?: number;
  
  // === LEGACY STRUCTURE (for backward compatibility) ===
  m7?: MeasureState;
  m8?: MeasureState;
  m7Pre?: MeasureState;
  m8Pre?: MeasureState;
  
  // === COMMON ===
  summary: string;
  summary_pf?: PF;
  dustFilterChanged?: boolean | Record<string, boolean>;
  photoRefs?: Record<number | string, (PhotoRef | { isNA: true })[]>;
  
  // Charger PM specific
  cp?: Record<string, { value: string; unit: string }>;
  m16?: MeasureState;
  inspector?: string;
};

function safeStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function draftKey(stationId: string | null | undefined) {
  return `pmDraft:${stationId ?? "unknown"}`;
}

export function saveDraftLocal<T = DraftData>(key: string, data: T) {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("saveDraftLocal failed:", e);
  }
}

export function loadDraftLocal<T = DraftData>(key: string): T | null {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error("loadDraftLocal failed:", e);
    return null;
  }
}

export function clearDraftLocal(key: string) {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.removeItem(key);
  } catch (e) {
    console.error("clearDraftLocal failed:", e);
  }
}