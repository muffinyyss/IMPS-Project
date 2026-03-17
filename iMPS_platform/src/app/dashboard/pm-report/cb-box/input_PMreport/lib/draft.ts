import type { PhotoRef } from "./draftPhotos";

type PF = "PASS" | "FAIL" | "NA" | "";

type DraftData = {
  rows: any;
  summary: string;
  summary_pf?: PF;
  summaryCheck?: PF;  // เพิ่ม - ใช้ใน Post mode
  m5?: any;
  photoRefs?: Record<number, (PhotoRef | { isNA: true })[]>;  // แก้ - รองรับ isNA
  dropdownQ1?: any;
  dropdownQ2?: any;
  inspector?: string;  // เพิ่ม - เก็บชื่อผู้ตรวจสอบ
};

function safeStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// แก้ - ลบ draftId parameter ออก (Pre mode ไม่ใช้แล้ว)
export function draftKey(stationId: string | null | undefined) {
  return `pmDraft:v2:cb-box:${stationId ?? "unknown"}`;
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