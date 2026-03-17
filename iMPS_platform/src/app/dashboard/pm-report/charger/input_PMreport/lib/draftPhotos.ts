// app/pm-report/charger/input_PMreport/lib/draftPhotos.ts
import { createStore, set, get, del, keys, type UseStore } from "idb-keyval";

/** ---------- Lazy store (SSR-safe) ----------
 *  createStore เรียก IndexedDB ซึ่งไม่มีฝั่ง server
 *  สร้างแบบ lazy เฉพาะตอนใช้งานจริงบน client เท่านั้น
 */
let _store: UseStore | null = null;
function getStore(): UseStore {
  if (!_store) {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB is not available (SSR or unsupported browser)");
    }
    _store = createStore("pmDraftDB", "photos");
  }
  return _store;
}

export type PhotoRef = {
  id: string;          // id ของรูปใน UI
  dbKey: string;       // key จริงที่ใช้เก็บใน IndexedDB
  remark?: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
};

export function makePhotoDbKey(draftKey: string, photoId: string) {
  return `pmDraftPhoto:${draftKey}:${photoId}`;
}

export async function putPhoto(
  draftKey: string,
  photoId: string,
  file: File,
  remark?: string,
): Promise<PhotoRef> {
  const dbKey = makePhotoDbKey(draftKey, photoId);
  try {
    await set(dbKey, file, getStore());
  } catch (e) {
    console.error("putPhoto failed:", e);
    throw e;
  }

  return {
    id: photoId,
    dbKey,
    remark,
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
  };
}

export async function getPhoto(draftKey: string, photoId: string): Promise<File | undefined> {
  const dbKey = makePhotoDbKey(draftKey, photoId);
  try {
    return (await get(dbKey, getStore())) as File | undefined;
  } catch (e) {
    console.error("getPhoto failed:", e);
    return undefined;
  }
}

// เผื่อกรณีเก็บ dbKey ไว้ใน PhotoRef แล้วอยากโหลดด้วย dbKey ตรงๆ
export async function getPhotoByDbKey(dbKey: string): Promise<File | undefined> {
  try {
    return (await get(dbKey, getStore())) as File | undefined;
  } catch (e) {
    console.error("getPhotoByDbKey failed:", e);
    return undefined;
  }
}

export async function delPhoto(draftKey: string, photoId: string) {
  const dbKey = makePhotoDbKey(draftKey, photoId);
  try {
    await del(dbKey, getStore());
  } catch (e) {
    console.error("delPhoto failed:", e);
  }
}

export async function delPhotoByDbKey(dbKey: string) {
  try {
    await del(dbKey, getStore());
  } catch (e) {
    console.error("delPhotoByDbKey failed:", e);
  }
}

/** ---------- Bulk delete ----------
 *  ลบรูปทั้งหมดที่เกี่ยวข้องกับ draft นี้
 *  ใช้ตอน clearDraft หรือ submit สำเร็จ เพื่อไม่ให้เป็น orphan data
 *
 *  วิธี 1 (เร็ว): ส่ง photoRefs มาจาก DraftData.photoRefs โดยตรง
 *  วิธี 2 (fallback): scan ทุก key ใน IndexedDB ที่ขึ้นต้นด้วย prefix ของ draft นี้
 */
export async function delAllPhotosForDraft(
  draftKey: string,
  photoRefs?: Record<number | string, (PhotoRef | { isNA: true })[]>,
) {
  try {
    const store = getStore();

    // วิธี 1: ลบจาก photoRefs ที่ส่งมา (เร็วกว่า ไม่ต้อง scan)
    if (photoRefs) {
      const allRefs = Object.values(photoRefs).flat();
      const dbKeys = allRefs
        .filter((r): r is PhotoRef => "dbKey" in r && typeof (r as PhotoRef).dbKey === "string")
        .map((r) => r.dbKey);

      await Promise.all(dbKeys.map((k) => del(k, store).catch(() => {})));
      return;
    }

    // วิธี 2: scan ทุก key (fallback กรณีไม่มี photoRefs)
    const prefix = `pmDraftPhoto:${draftKey}:`;
    const allKeys = (await keys(store)) as string[];
    const matched = allKeys.filter((k) => typeof k === "string" && k.startsWith(prefix));
    await Promise.all(matched.map((k) => del(k, store).catch(() => {})));
  } catch (e) {
    console.error("delAllPhotosForDraft failed:", e);
  }
}