// app/dashboard/test-report/dc/input_dc/lib/draft.ts
import type { PhotoRef } from "./draftPhotos";
import type { TestResults } from "../components/DCTest1Grid";
import type { TestCharger } from "../components/DCTest2Grid";

type EquipmentBlock = {
  manufacturers: string[];
  models: string[];
  serialNumbers: string[];
};

type Head = {
  issue_id: string;
  inspection_date: string;
  location: string;
  manufacturer?: string;
  model?: string;
  power?: string;
  firmware_version?: string;
  serial_number?: string;
};

type DraftData = {
  // ★ ไม่เก็บ head เพราะดึงจาก API / generate ใหม่ทุกครั้ง
  head?: Head;  // optional (เผื่อ draft เก่ายังมี)
  equipment: EquipmentBlock;
  dcTest1Results: TestResults | null;
  dcChargerTest: TestCharger | null;
  phaseSequence: string;
  testRemark: string;
  imgRemark: string;
  photoRefs?: Record<number | string, (PhotoRef | { isNA: true })[]>;
};

function safeStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function draftKey(sn: string | null | undefined) {
  return `dcDraft:${sn ?? "unknown"}`;
}

export function saveDraftLocal(key: string, data: Omit<DraftData, 'head'>) {
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

export type { DraftData, Head, EquipmentBlock };