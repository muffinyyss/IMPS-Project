import type { PhotoRef } from "./draftPhotos";

type PF = "PASS" | "FAIL" | "NA" | "";

type DraftData = {
  rows: any;
  m4: any;
  m5: any;
  m6: any;
  m7: any;
  m8: any;
  m4Pre?: any;
  m5Pre?: any;
  m6Pre?: any;
  m7Pre?: any;
  m8Pre?: any;
  summary: string;
  summary_pf?: PF;
  dustFilterChanged?: boolean;
  photoRefs?: Record<number | string, PhotoRef[]>;
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
  // ทำ key ต่อสถานี (มี station_id จะดีที่สุด)
  return `pmDraft:${stationId ?? "unknown"}`;
}
// export function draftKey(
//   stationId: string | null | undefined,
//   draftId: string = "default"
// ) {
//   return `pmDraft:v2:${stationId ?? "unknown"}:${draftId}`;
// }

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
