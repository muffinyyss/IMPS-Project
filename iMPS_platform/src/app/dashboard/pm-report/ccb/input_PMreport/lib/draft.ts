import type { PhotoRef } from "./draftPhotos";

type PF = "PASS" | "FAIL" | "NA" | "";

type DraftData = {
  rows: any;
  m9_0?: any;
  m9_1?: any;
  m9_2?: any;
  m9_3?: any;
  m9_4?: any;
  m9_5?: any;
  summary: string;
  summary_pf?: PF;
  photoRefs?: Record<string, PhotoRef[]>;
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
export function draftKey(stationId: string | null | undefined, draftId = "default") {
  // ทำ key ต่อสถานี (มี station_id จะดีที่สุด)
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

// ไฟล์: lib/draft.ts - เพิ่ม utility functions

// import type { PhotoRef } from "./draftPhotos";

// type PF = "PASS" | "FAIL" | "NA" | "";

// type DraftData = {
//   rows: any;
//   m9_0?: any;
//   m9_1?: any;
//   m9_2?: any;
//   m9_3?: any;
//   m9_4?: any;
//   m9_5?: any;
//   summary: string;
//   summary_pf?: PF;
//   photoRefs?: Record<string, PhotoRef[]>;
//   // เพิ่มข้อมูลเพื่อติดตามสถานะ
//   lastSaved?: string; // ISO timestamp
//   isDraft?: boolean;
// };

// function safeStorage() {
//   if (typeof window === "undefined") return null;
//   try {
//     return window.localStorage;
//   } catch {
//     return null;
//   }
// }

// export function draftKeyCCB(stationId: string | null | undefined, draftId = "default") {
//   return `pmDraft:v2:ccb:${stationId ?? "unknown"}:${draftId}`;
// }

// export function saveDraftLocal(key: string, data: DraftData) {
//   const ls = safeStorage();
//   if (!ls) return;
//   try {
//     const draftData = {
//       ...data,
//       lastSaved: new Date().toISOString(),
//       isDraft: true
//     };
//     ls.setItem(key, JSON.stringify(draftData));
//     console.log("✅ Draft saved:", key);
//   } catch (e) {
//     console.error("saveDraftLocal failed:", e);
//   }
// }

// export function loadDraftLocal<T = DraftData>(key: string): T | null {
//   const ls = safeStorage();
//   if (!ls) return null;
//   try {
//     const raw = ls.getItem(key);
//     if (!raw) return null;
//     const data = JSON.parse(raw) as T;
//     console.log("✅ Draft loaded:", key);
//     return data;
//   } catch (e) {
//     console.error("loadDraftLocal failed:", e);
//     return null;
//   }
// }

// export function clearDraftLocal(key: string) {
//   const ls = safeStorage();
//   if (!ls) return;
//   try {
//     ls.removeItem(key);
//     console.log("✅ Draft cleared:", key);
//   } catch (e) {
//     console.error("clearDraftLocal failed:", e);
//   }
// }

// // ✨ เพิ่มฟังก์ชันตรวจสอบว่ามี draft หรือไม่
// export function hasDraft(key: string): boolean {
//   const ls = safeStorage();
//   if (!ls) return false;
//   return ls.getItem(key) !== null;
// }

// // ✨ เพิ่มฟังก์ชันดึงข้อมูล lastSaved
// export function getDraftInfo(key: string): { lastSaved?: string; isDraft?: boolean } | null {
//   const draft = loadDraftLocal<DraftData>(key);
//   if (!draft) return null;
//   return {
//     lastSaved: draft.lastSaved,
//     isDraft: draft.isDraft
//   };
// }