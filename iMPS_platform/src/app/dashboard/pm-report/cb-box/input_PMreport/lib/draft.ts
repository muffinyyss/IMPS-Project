import type { PhotoRef } from "./draftPhotos";

type PF = "PASS" | "FAIL" | "NA" | "";

type DraftData = {
  // job: any;
  rows: any;
  summary: string;
  summary_pf?: PF;
  m5?: any;
  inspector : string;
  photoRefs?: Record<number, PhotoRef[]>;
  dropdownQ1?: any;  // เพิ่ม dropdownQ1
  dropdownQ2?: any; 

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

// export function draftKeyCCB(stationId?: string | null, draftId = "default") {
//   return `pmDraft:v2:ccb:${stationId ?? "unknown"}:${draftId}`;
// }
export function draftKeyCB_BOX(stationId: string | null | undefined, draftId = "default") {
  // ทำ key ต่อสถานี (มี station_id จะดีที่สุด)
  return `pmDraft:v2:cb-box:${stationId ?? "unknown"}:${draftId}`;
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
