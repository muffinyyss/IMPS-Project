// app/dashboard/test-report/dc/input_dc/lib/draftPhotos.ts
import { createStore, set, get, del, keys } from "idb-keyval";

const store = createStore("dcDraftDB", "photos");

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
  return `dcDraftPhoto:${draftKey}:${photoId}`;
}

/** บันทึกรูปลง IndexedDB */
export async function putPhoto(
  draftKey: string,
  photoId: string,
  file: File,
  remark?: string
): Promise<PhotoRef> {
  const dbKey = makePhotoDbKey(draftKey, photoId);
  await set(dbKey, file, store);

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

/** โหลดรูปจาก IndexedDB */
export async function getPhoto(draftKey: string, photoId: string): Promise<File | undefined> {
  const dbKey = makePhotoDbKey(draftKey, photoId);
  return (await get(dbKey, store)) as File | undefined;
}

/** โหลดรูปด้วย dbKey ตรงๆ */
export async function getPhotoByDbKey(dbKey: string): Promise<File | undefined> {
  return (await get(dbKey, store)) as File | undefined;
}

/** ลบรูป */
export async function delPhoto(draftKey: string, photoId: string) {
  const dbKey = makePhotoDbKey(draftKey, photoId);
  await del(dbKey, store);
}

export async function delPhotoByDbKey(dbKey: string) {
  await del(dbKey, store);
}

/** ลบรูปทั้งหมดของ draft นี้ */
export async function clearPhotosForDraft(draftKey: string) {
  try {
    const allKeys = await keys(store);
    const prefix = `dcDraftPhoto:${draftKey}:`;
    const keysToDelete = allKeys.filter(
      (k) => typeof k === "string" && k.startsWith(prefix)
    );
    await Promise.all(keysToDelete.map((k) => del(k, store)));
  } catch (e) {
    console.error("clearPhotosForDraft failed:", e);
  }
}

/** ลบรูปทั้งหมดใน IndexedDB */
export async function clearAllPhotos() {
  try {
    const allKeys = await keys(store);
    const dcKeys = allKeys.filter(
      (k) => typeof k === "string" && k.startsWith("dcDraftPhoto:")
    );
    await Promise.all(dcKeys.map((k) => del(k, store)));
  } catch (e) {
    console.error("clearAllPhotos failed:", e);
  }
}