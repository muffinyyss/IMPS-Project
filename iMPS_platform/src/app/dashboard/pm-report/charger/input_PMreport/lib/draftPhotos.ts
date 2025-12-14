// app/pm-report/charger/input_PMreport/lib/draftPhotos.ts
import { createStore, set, get, del } from "idb-keyval";

const store = createStore("pmDraftDB", "photos");

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

export async function getPhoto(draftKey: string, photoId: string): Promise<File | undefined> {
  const dbKey = makePhotoDbKey(draftKey, photoId);
  return (await get(dbKey, store)) as File | undefined;
}

// เผื่อกรณีคุณเก็บ dbKey ไว้ใน PhotoRef แล้วอยากโหลดด้วย dbKey ตรงๆ
export async function getPhotoByDbKey(dbKey: string): Promise<File | undefined> {
  return (await get(dbKey, store)) as File | undefined;
}

export async function delPhoto(draftKey: string, photoId: string) {
  const dbKey = makePhotoDbKey(draftKey, photoId);
  await del(dbKey, store);
}

export async function delPhotoByDbKey(dbKey: string) {
  await del(dbKey, store);
}
