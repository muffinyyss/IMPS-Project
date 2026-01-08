import type { PhotoRef } from "./draftPhotos";

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

// เพิ่มฟังก์ชันใหม่สำหรับรายงาน PM ประเภทใหม่ (สมมติว่าเป็น "General" หรือ "Station")
export function draftKey(stationId: string | null | undefined, draftId = "default") {
  // เช่น 'pmDraft:v2:station-general:ST-001:UUID'
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

export function clearDraftLocal(key: string) {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.removeItem(key);
  } catch (e) {
    console.error("clearDraftLocal failed:", e);
  }
}
