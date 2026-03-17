/**
 * Draft Photos utilities for CM Report
 * ใช้ IndexedDB เก็บรูปภาพระหว่างกรอกฟอร์ม
 */

const DB_NAME = "cm-draft-photos";
const DB_VERSION = 1;
const STORE_NAME = "photos";

export type PhotoRef = {
    id: string;
    draftKey: string;
    blob: Blob;
    name: string;
    type: string;
    savedAt: number;
};

/**
 * เปิด IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                store.createIndex("draftKey", "draftKey", { unique: false });
            }
        };
    });
}

/**
 * บันทึกรูปภาพลง IndexedDB
 */
export async function putPhoto(
    draftKey: string,
    photoId: string,
    file: File
): Promise<PhotoRef> {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        const photoRef: PhotoRef = {
            id: photoId,
            draftKey,
            blob: file,
            name: file.name,
            type: file.type,
            savedAt: Date.now(),
        };

        const request = store.put(photoRef);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(photoRef);
    });
}

/**
 * ดึงรูปภาพจาก IndexedDB
 */
export async function getPhoto(photoId: string): Promise<PhotoRef | null> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(photoId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
    });
}

/**
 * ดึงรูปภาพทั้งหมดของ draft key
 */
export async function getPhotosByDraftKey(draftKey: string): Promise<PhotoRef[]> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index("draftKey");
        const request = index.getAll(draftKey);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
    });
}

/**
 * ลบรูปภาพจาก IndexedDB
 */
export async function delPhoto(photoId: string): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(photoId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

/**
 * ลบรูปภาพทั้งหมดของ draft key
 */
export async function delPhotosByDraftKey(draftKey: string): Promise<void> {
    const photos = await getPhotosByDraftKey(draftKey);
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        let completed = 0;
        const total = photos.length;

        if (total === 0) {
            resolve();
            return;
        }

        photos.forEach((photo) => {
            const request = store.delete(photo.id);
            request.onsuccess = () => {
                completed++;
                if (completed === total) resolve();
            };
            request.onerror = () => reject(request.error);
        });
    });
}

/**
 * สร้าง preview URL จาก PhotoRef
 */
export function createPreviewUrl(photoRef: PhotoRef): string {
    return URL.createObjectURL(photoRef.blob);
}

/**
 * แปลง PhotoRef เป็น File
 */
export function photoRefToFile(photoRef: PhotoRef): File {
    return new File([photoRef.blob], photoRef.name, { type: photoRef.type });
}

/**
 * ลบรูปที่หมดอายุ (เก่ากว่า 7 วัน)
 */
export async function cleanupExpiredPhotos(): Promise<number> {
    const db = await openDB();
    const expireTime = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        let deletedCount = 0;

        request.onerror = () => reject(request.error);
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const photo = cursor.value as PhotoRef;
                if (photo.savedAt < expireTime) {
                    cursor.delete();
                    deletedCount++;
                }
                cursor.continue();
            } else {
                resolve(deletedCount);
            }
        };
    });
}