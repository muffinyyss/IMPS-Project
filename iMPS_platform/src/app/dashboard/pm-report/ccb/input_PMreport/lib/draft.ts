import type { PhotoRef } from "./draftPhotos";

type PF = "PASS" | "FAIL" | "NA" | "";

type DraftData = {
  rows: any;
  // Main Breaker (Q9)
  mMain?: any;
  // Sub Breakers (Q10) - up to 6
  mSub1?: any;
  mSub2?: any;
  mSub3?: any;
  mSub4?: any;
  mSub5?: any;
  mSub6?: any;
  subBreakerCount?: number;
  summary: string;
  summary_pf?: PF;
  summaryCheck?: any;
  inspector?: string;
  photoRefs?: Record<number, (PhotoRef | { isNA: true })[]>;
};

function safeStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function draftKey(stationId: string | null | undefined, draftId = "default") {
  return `pmDraft:v2:ccb:${stationId ?? "unknown"}:${draftId}`;
}

export function saveDraftLocal(key: string, data: DraftData) {
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