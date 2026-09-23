/**
 * แปลงรูป HEIC ให้เป็น JPEG ก่อนเข้าท่อแนบรูปของฟอร์ม
 *
 * iPhone ที่ตั้งกล้องเป็น "High Efficiency" จะได้ไฟล์ .HEIC ซึ่งมีแต่ Safari
 * ที่เปิดได้ — Chrome / Edge / Firefox เปิดไม่ได้เลย ผลที่ตามมาในแอปนี้คือ
 *
 *   1. preview ในฟอร์มขึ้นเป็นกรอบว่าง (<img> decode ไม่ผ่าน) ช่างไม่รู้ว่าแนบรูปถูกใบไหม
 *   2. addTimestampToImage วาดลง canvas ไม่ได้ → onerror → คืนไฟล์เดิม
 *      รูปที่ส่งขึ้นไปจึง "ไม่มีตราประทับวันเวลา/พิกัด" ซึ่งใบ PM ต้องมี
 *   3. compressImage ก็ใช้ <img> เหมือนกัน → ไฟล์ดิบเต็มขนาดถูกอัปขึ้น server
 *
 * ฝั่ง server มี pillow-heif อยู่แล้ว (backend/image_convert.py) จึงยืมมาแปลงผ่าน
 * POST /images/convert แทนการลงไลบรารี HEIC decoder บนเบราว์เซอร์ (~1.2MB)
 *
 * ถ้าแปลงไม่สำเร็จ (ออฟไลน์ / endpoint ล่ม) จะคืนไฟล์เดิมไป ไม่บล็อกการแนบรูป
 * เพราะตอนอัปโหลดจริง backend แปลงให้อีกชั้นอยู่แล้ว — ที่เสียไปคือตราประทับเวลา
 */
import { apiFetch } from "@/utils/api";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    "http://localhost:8000";

/** brand ใน ISO-BMFF ที่เป็นตระกูล HEIF/AVIF (iPhone ใช้ heic/heix เป็นหลัก) */
const BMFF_BRANDS = new Set([
    "heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs",
    "mif1", "msf1", "avif", "avis",
]);

const HEIC_EXT_RE = /\.(heic|heif|hif|avif)$/i;
const HEIC_TYPE_RE = /^image\/(heic|heif|avif)/i;

/**
 * ตรวจจาก magic bytes เป็นหลัก — นามสกุลเชื่อไม่ได้
 *
 * ทั้ง safeUploadName (utils/upload-safety) และ ensureJpgFilename ในฟอร์ม PM
 * เปลี่ยนนามสกุลเป็น .jpg ตั้งแต่ต้นทาง และ iOS เองก็ส่ง File ที่ type ว่างมาได้
 * ไฟล์ HEIC จำนวนมากจึงมาถึงตรงนี้ในชื่อ "IMG_1234.jpg" ที่ type เป็น ""
 */
export async function isHeicFile(file: File): Promise<boolean> {
    if (HEIC_TYPE_RE.test(file.type)) return true;

    try {
        const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
        if (head.length >= 12) {
            const tag = String.fromCharCode(head[4], head[5], head[6], head[7]);
            if (tag === "ftyp") {
                const brand = String.fromCharCode(head[8], head[9], head[10], head[11]).toLowerCase();
                return BMFF_BRANDS.has(brand);
            }
            // เป็นฟอร์แมตอื่นที่อ่าน magic ได้ชัดเจนแล้ว ไม่ต้องเดาจากนามสกุลต่อ
            return false;
        }
    } catch {
        // อ่านไบต์ไม่ได้ (iOS คืน backing store ไปแล้ว) → ตกไปเดาจากนามสกุลข้างล่าง
    }

    return HEIC_EXT_RE.test(file.name || "");
}

function toJpgName(name: string): string {
    const base = (name || "").replace(/\.[^.]*$/, "");
    return `${base || `image_${Date.now()}`}.jpg`;
}

/**
 * คืนไฟล์ที่เบราว์เซอร์แสดงผลได้แน่นอน
 *
 * ไฟล์ที่ไม่ใช่ HEIC คืนตัวเดิมทันที (ไม่มี network call) — เรียกซ้ำได้ ไม่มีผลข้างเคียง
 */
export async function ensureViewableImage(file: File): Promise<File> {
    if (!file || file.size === 0) return file;
    if (!(await isHeicFile(file))) return file;

    try {
        const fd = new FormData();
        fd.append("file", file, file.name || "image.heic");

        const res = await apiFetch(`${API_BASE}/images/convert`, { method: "POST", body: fd });
        if (!res.ok) {
            console.warn("[heic] แปลง HEIC ที่ server ไม่สำเร็จ", res.status, await res.text().catch(() => ""));
            return file;
        }

        const blob = await res.blob();
        if (!blob.size) return file;

        return new File([blob], toJpgName(file.name), { type: "image/jpeg" });
    } catch (e) {
        console.warn("[heic] แปลง HEIC ไม่สำเร็จ ใช้ไฟล์เดิมต่อ (backend จะแปลงให้ตอนอัปโหลด)", e);
        return file;
    }
}

/** แปลงทีละหลายไฟล์ ทำทีละใบเพื่อไม่ให้ยิง request พร้อมกันจนมือถือค้าง */
export async function ensureViewableImages(files: File[]): Promise<File[]> {
    const out: File[] = [];
    for (const f of files) out.push(await ensureViewableImage(f));
    return out;
}
