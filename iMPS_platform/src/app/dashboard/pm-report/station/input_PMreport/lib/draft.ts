import type { PhotoRef } from "./draftPhotos";
import { delAllPhotosForDraft } from "./draftPhotos";  // เพิ่ม

type PF = "PASS" | "FAIL" | "NA" | "";

type DraftData = {
  rows: any;
  summary: string;
  summary_pf?: PF;
  summaryCheck?: any;
  photoRefs?: Record<string | number, (PhotoRef | { isNA: true })[]>;
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
  return `pmDraft:v2:station:${stationId ?? "unknown"}:${draftId}`;
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

export async function clearDraftLocal(key: string) {
  const ls = safeStorage();
  let photoRefs: DraftData["photoRefs"] | undefined;
  if (ls) {
    try {
      const raw = ls.getItem(key);
      if (raw) {
        const data = JSON.parse(raw) as DraftData;
        photoRefs = data.photoRefs;
      }
    } catch { }
  }

  try {
    await delAllPhotosForDraft(key, photoRefs);
  } catch { }

  if (ls) {
    try {
      ls.removeItem(key);
    } catch (e) {
      console.error("clearDraftLocal failed:", e);
    }
  }
}