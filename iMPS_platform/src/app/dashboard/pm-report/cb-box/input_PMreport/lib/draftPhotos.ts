import { createStore, set, get, del, keys, type UseStore } from "idb-keyval";

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
  id: string;
  dbKey: string;
  remark?: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
};

export function makePhotoDbKey(draftKey: string, photoId: string) {
  return `pmDraftPhoto:${draftKey}:${photoId}`;
}

export async function putPhoto(draftKey: string, photoId: string, file: File, remark?: string): Promise<PhotoRef> {
  const dbKey = makePhotoDbKey(draftKey, photoId);
  try {
    await set(dbKey, file, getStore());
  } catch (e) {
    console.error("putPhoto failed:", e);
    throw e;
  }
  return { id: photoId, dbKey, remark, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified };
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

export async function delAllPhotosForDraft(
  draftKey: string,
  photoRefs?: Record<number | string, (PhotoRef | { isNA: true })[]>,
) {
  try {
    const store = getStore();
    if (photoRefs) {
      const dbKeys = Object.values(photoRefs).flat()
        .filter((r): r is PhotoRef => "dbKey" in r && typeof (r as PhotoRef).dbKey === "string")
        .map((r) => r.dbKey);
      await Promise.all(dbKeys.map((k) => del(k, store).catch(() => {})));
      return;
    }
    const prefix = `pmDraftPhoto:${draftKey}:`;
    const allKeys = (await keys(store)) as string[];
    const matched = allKeys.filter((k) => typeof k === "string" && k.startsWith(prefix));
    await Promise.all(matched.map((k) => del(k, store).catch(() => {})));
  } catch (e) {
    console.error("delAllPhotosForDraft failed:", e);
  }
}