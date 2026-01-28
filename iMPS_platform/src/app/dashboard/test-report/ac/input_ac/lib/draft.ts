// app/dashboard/test-report/ac/input_ac/lib/draft.ts
import type { PhotoRef } from "../lib/draftPhotos";
import type { TestResults } from "../components/ACTest1Grid";
import type { TestCharger } from "../components/ACTest2Grid";

type EquipmentBlock = {
  manufacturers: string[];
  models: string[];
  serialNumbers: string[];
};

type Head = {
  issue_id: string;
  document_name: string;
  inspection_date: string;
  location: string;
  inspector: string;
  manufacturer?: string;
  model?: string;
  power?: string;
  firmware_version?: string;
  serial_number?: string;
};

type TestFileRef = {
  dbKey: string;
  name: string;
  itemIndex: number;
  roundIndex: number;
  handgun: "h1" | "h2";
};

type DraftData = {
  // ★ ไม่เก็บ head เพราะดึงจาก API / generate ใหม่ทุกครั้ง
  head?: Head;  // optional (เผื่อ draft เก่ายังมี)
  chargerNo: string;  // ★ AC specific field
  equipment: EquipmentBlock;
  acTest1Results: TestResults | null;
  acChargerTest: TestCharger | null;
  phaseSequence: string;
  testRemark: string;
  imgRemark: string;
  photoRefs?: Record<number | string, (PhotoRef | { isNA: true })[]>;
  testFileRefs?: TestFileRef[]; 
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
  return `acDraft:${sn ?? "unknown"}`;
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