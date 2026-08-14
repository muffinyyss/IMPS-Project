/**
 * pm-photo-sync — ตัวกลางกันรูป PM/CM หายระหว่างบันทึก
 *
 * ปัญหาที่เคยเกิด (ใบ F1500224001_2/2026 เป็นตัวอย่างจริง):
 *  1) คิวอัปโหลดว่าง → โค้ดข้ามบล็อกอัปโหลดเงียบ ๆ แล้วไหลไปลบ draft + navigate ต่อ
 *  2) รูปที่ processFile เสร็จ "หลัง" handler snapshot ไปแล้ว ไม่ถูกอัป แต่โดน cleanup ลบทิ้ง
 *  3) client คิดว่าอัปสำเร็จ แต่ DB ไม่มีรูปจริง
 *
 * กติกาที่โมดูลนี้บังคับ:
 *  - ลบรูปในเครื่องได้ต่อเมื่อ server ยืนยันว่ามีรูป "ครบจำนวน" ของทุกข้อแล้วเท่านั้น
 *  - รูปที่โผล่มาระหว่างอัปโหลด ต้องถูกจับเข้ารอบถัดไป ไม่ใช่ถูกข้าม
 */

export type SyncPhotoItem = {
    id: string;
    file?: File;
    isNA?: boolean;
    uploaded?: boolean;
    ref?: { dbKey?: string } | undefined;
};

export type PhotoMap = Record<string | number, SyncPhotoItem[] | undefined>;

export type PendingTask = {
    group: string;
    photoId: string;
    file?: File;
    ref?: any;
};

/** รูปที่ต้องมีอยู่บน server (ไม่นับข้อที่ติ๊ก NA) */
export function realPhotos(photos: PhotoMap): SyncPhotoItem[] {
    return Object.values(photos).flat().filter((p): p is SyncPhotoItem => !!p && !p.isNA);
}

/**
 * รูปที่ยังต้องอัป — ตัด NA, ตัดที่ server มีแล้ว (p.uploaded) และตัดที่เพิ่งอัปสำเร็จในรอบนี้
 *
 * uploadedIds จำเป็นเพราะ setPhotos() ยังไม่ flush เข้า photosRef ภายใน tick เดียวกัน
 * ถ้าไม่มีตัวนี้ loop รอบสองจะอัปรูปเดิมซ้ำ
 */
export function collectPending(photos: PhotoMap, uploadedIds: Set<string>): PendingTask[] {
    const out: PendingTask[] = [];
    for (const [group, list] of Object.entries(photos)) {
        (list || []).forEach(p => {
            if (!p || p.isNA || p.uploaded) return;
            if (uploadedIds.has(p.id)) return;
            if (!p.file && !p.ref?.dbKey) return;
            out.push({ group, photoId: p.id, file: p.file, ref: p.ref });
        });
    }
    return out;
}

/** รูปที่ยังไม่ขึ้น server และกู้ไฟล์ไม่ได้เลย → ต้องให้ผู้ใช้แนบใหม่ ห้ามปล่อยผ่าน */
export function unrecoverablePhotos(photos: PhotoMap, uploadedIds: Set<string>): SyncPhotoItem[] {
    return realPhotos(photos).filter(
        p => !p.uploaded && !uploadedIds.has(p.id) && !p.file && !p.ref?.dbKey,
    );
}

/** จำนวนรูปที่ควรมีบน server แยกตาม group key ที่ backend ใช้เก็บ */
export function expectedCountByGroup(
    photos: PhotoMap,
    toGroupKey: (formKey: string) => string,
): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [formKey, list] of Object.entries(photos)) {
        const n = (list || []).filter(p => p && !p.isNA).length;
        if (n === 0) continue;
        const g = toGroupKey(formKey);
        out[g] = (out[g] || 0) + n;
    }
    return out;
}

export type Shortfall = { group: string; expected: number; actual: number };

/**
 * เทียบจำนวนที่ควรมีกับที่ server มีจริง
 *
 * ใช้ ">= expected" ไม่ใช่ "=== expected" เพราะ retry ที่ server บันทึกไปแล้วแต่ client
 * ไม่ได้รับ response อาจทำให้ฝั่ง server มีมากกว่า — กรณีนั้นไม่ใช่รูปหาย จึงไม่ต้องเตือน
 */
export function findShortfall(
    expected: Record<string, number>,
    serverGroups: Record<string, unknown[] | undefined> | undefined | null,
): Shortfall[] {
    const server = serverGroups || {};
    return Object.entries(expected)
        .map(([group, n]) => ({ group, expected: n, actual: server[group]?.length ?? 0 }))
        .filter(s => s.actual < s.expected);
}

/** ตัด prefix "g" ออกให้เหลือเลขข้อที่ผู้ใช้เข้าใจ */
function humanGroup(group: string): string {
    return group.startsWith("g") ? group.slice(1) : group;
}

export function shortfallMessage(shortfall: Shortfall[], lang: string): string {
    const detail = shortfall
        .map(s => `${humanGroup(s.group)} (${s.actual}/${s.expected})`)
        .join(", ");
    return lang === "th"
        ? `อัปโหลดรูปไม่ครบ ข้อ ${detail}\n\nรูปในเครื่องยังอยู่ครบ กรุณากดบันทึกอีกครั้งเพื่ออัปเฉพาะรูปที่ค้าง`
        : `Upload incomplete for item ${detail}\n\nYour photos are still saved on this device. Press save again to upload the remaining ones.`;
}

export function pendingMessage(count: number, lang: string): string {
    return lang === "th"
        ? `ยังมีรูปที่ยังไม่ถูกอัปโหลด ${count} รูป\n\nรูปในเครื่องยังอยู่ครบ กรุณากดบันทึกอีกครั้ง`
        : `${count} photo(s) were not uploaded.\n\nYour photos are still saved on this device. Please save again.`;
}

export function unrecoverableMessage(lang: string): string {
    return lang === "th"
        ? "ไม่พบไฟล์รูปภาพในเครื่อง กรุณาแนบรูปใหม่อีกครั้งก่อนกดบันทึก"
        : "Photo files not found on this device. Please re-attach them before saving.";
}
