// app/pm-report/charger/input_PMreport/lib/draft.ts
import type { PhotoRef } from "./draftPhotos";
import { delAllPhotosForDraft } from "./draftPhotos";

type PF = "PASS" | "FAIL" | "NA" | "";

type DraftData = {
  // job: any;
  rows: any;
  cp: any;
  m16: any;
  summary: string;
  summaryCheck?: PF;  // เพิ่มสำหรับ Post mode
  // inspector?: string;
  dustFilterChanged?: Record<string, boolean>;
  photoRefs?: Record<number | string, (PhotoRef | { isNA: true })[]>;
  // หมายเหตุ: ไฟล์รูป (File) เก็บใน localStorage ไม่ได้
  // ถ้าจะเก็บรูปจริง แนะนำ IndexedDB (localforage/idb-keyval)
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

/** ลบ draft ทั้งหมด — ทั้ง localStorage และรูปใน IndexedDB */
export async function clearDraftLocal(key: string) {
  // 1) อ่าน photoRefs จาก draft ก่อนลบ เพื่อลบรูปให้ตรง key
  const ls = safeStorage();
  let photoRefs: DraftData["photoRefs"] | undefined;
  if (ls) {
    try {
      const raw = ls.getItem(key);
      if (raw) {
        const data = JSON.parse(raw) as DraftData;
        photoRefs = data.photoRefs;
      }
    } catch {
      // ถ้า parse ไม่ได้ก็ไม่เป็นไร จะ fallback scan ใน delAllPhotosForDraft
    }
  }

  // 2) ลบรูปใน IndexedDB (async — ไม่ block)
  try {
    await delAllPhotosForDraft(key, photoRefs);
  } catch {
    // error ถูก log ใน delAllPhotosForDraft แล้ว
  }

  // 3) ลบ localStorage
  if (ls) {
    try {
      ls.removeItem(key);
    } catch (e) {
      console.error("clearDraftLocal failed:", e);
    }
  }
}