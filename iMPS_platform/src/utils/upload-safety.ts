/**
 * กัน multipart upload พังเพราะชื่อไฟล์
 *
 * ชื่อไฟล์จากกล้อง/แกลเลอรีบางเครื่องมี `"` หรือ newline ปนมา พอถูกใส่ลงใน header
 * Content-Disposition ของ multipart แล้วทำให้ทั้ง body parse ไม่ออก ฝั่ง server
 * (FastAPI) จึงเห็นเป็น "ไม่มีฟิลด์อะไรเลย" แล้วตอบ 422 โดยที่ทุกฟิลด์เป็น null
 * พร้อมกัน — เช่น sn/group/files หายทั้งหมดทั้งที่ frontend ส่งครบ
 *
 * ทำไมต้อง patch fetch แทนที่จะแก้ทีละหน้า: จุดอัปโหลดในแอปมีหลายสิบที่ กระจาย
 * อยู่ใน pm-report / cm-report / test-report และส่วนใหญ่เรียก fetch ตรง ไม่ผ่าน
 * apiFetch อีกทั้งหลายที่เขียน fd.append("files", f) โดยไม่ระบุชื่อไฟล์ ซึ่ง
 * browser จะเติม f.name ดิบให้เอง การกรองที่ปลายทางแต่ละหน้าจึงตกหล่นง่าย และ
 * หน้าใหม่ที่เพิ่มทีหลังก็จะพลาดซ้ำอีก
 *
 * patch นี้แตะเฉพาะ body ที่เป็น FormData และมี File ที่ชื่อไม่ปลอดภัยเท่านั้น
 * กรณีอื่นส่ง body เดิมกลับไปตรงๆ (ทำซ้ำได้ ไม่สะสมผลข้างเคียง)
 *
 * เทียบเคียงกับ installDomSafetyPatch ใน utils/dom-safety.ts
 */
let installed = false;

export function safeUploadName(name: string): string {
    // บางเครื่องแนบ path มากับชื่อไฟล์ด้วย ตัดให้เหลือเฉพาะชื่อก่อน
    const raw = (name || "").replace(/\\/g, "/").split("/").pop() || "";
    const dot = raw.lastIndexOf(".");
    const stem = dot > 0 ? raw.slice(0, dot) : raw;
    const ext = dot > 0 ? raw.slice(dot + 1) : "";
    const safeStem = stem.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._-]+/, "").slice(0, 80);
    const safeExt = ext.replace(/[^A-Za-z0-9]+/g, "").slice(0, 10).toLowerCase();
    // ชื่อไทยล้วนจะถูกกรองจนเหลือว่าง → ต้อง fallback ให้ไม่ซ้ำกัน เพราะ backend
    // เขียนไฟล์ตามชื่อ ถ้าชื่อชนกันรูปที่อัปทีหลังจะทับรูปก่อนหน้า
    const fallback = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return `${safeStem || fallback}.${safeExt || "jpg"}`;
}

/** คืน FormData ชุดใหม่เมื่อมีชื่อไฟล์ที่ต้องแก้ ถ้าไม่มีอะไรต้องแก้คืนตัวเดิม */
export function sanitizeFormData(body: FormData): FormData {
    let changed = false;
    const out = new FormData();
    body.forEach((value, key) => {
        if (value instanceof File) {
            const safe = safeUploadName(value.name);
            if (safe !== value.name) {
                changed = true;
                console.warn(`[upload-safety] ชื่อไฟล์ไม่ปลอดภัย แก้เป็น "${safe}"`, value.name);
            }
            out.append(key, value, safe);
        } else {
            // Blob ที่ไม่มีชื่อ browser ตั้งให้เป็น "blob" อยู่แล้ว ปลอดภัยดี ไม่ต้องยุ่ง
            out.append(key, value as any);
        }
    });
    return changed ? out : body;
}

/**
 * พิสูจน์ว่าไฟล์ยังอ่านได้จริง
 *
 * ใช้แทนการเช็ค file.size === 0 ซึ่งเชื่อไม่ได้ — บน iOS ไฟล์ที่ backing store
 * ถูกคืนไปแล้วยังรายงาน size เป็นค่าเดิมอยู่ ต้องลองอ่านจริงเท่านั้นถึงจะรู้
 */
export async function isFileReadable(file: File | null | undefined): Promise<boolean> {
    if (!file) return false;
    try {
        return (await file.arrayBuffer()).byteLength > 0;
    } catch {
        return false;
    }
}

/**
 * พิสูจน์ว่าเบราว์เซอร์ "แสดงผล" รูปนี้ได้จริง — คนละเรื่องกับอ่านไบต์ได้
 *
 * ไฟล์อาจอ่านไบต์ได้ครบแต่ decode ไม่ออก (เช่น HEIC บนเบราว์เซอร์ที่ไม่รองรับ,
 * ไฟล์ที่เสียบางส่วน, หรือ canvas คืนรูป 0x0) พอเป็นแบบนั้น <img src={blob}>
 * จะโหลดไม่ขึ้นแล้วโชว์ alt แทน — ผู้ใช้เห็นเป็นคำว่า "preview" แทนรูป
 * แถมไฟล์ที่ decode ไม่ได้ยังถูกอัปขึ้น server ไปเป็นรูปเสียในรายงานด้วย
 *
 * เช็ค naturalWidth ด้วย เพราะบางเคส onload ยิงแต่ได้รูปขนาด 0
 */
export async function isImageDecodable(file: File, timeoutMs = 15000): Promise<boolean> {
    if (typeof window === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) return true;

    const url = URL.createObjectURL(file);
    try {
        return await new Promise<boolean>((resolve) => {
            const img = new Image();
            let settled = false;
            const finish = (ok: boolean) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(ok);
            };
            // กันเคส decode ค้าง ไม่ยิงทั้ง onload/onerror — อย่าให้ผู้ใช้ค้างตรงนี้
            const timer = setTimeout(() => finish(false), timeoutMs);
            img.onload = () => finish(img.naturalWidth > 0 && img.naturalHeight > 0);
            img.onerror = () => finish(false);
            img.src = url;
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * หาไฟล์ที่ใช้อัปโหลดได้จริง พร้อมกู้จากที่สำรองถ้าตัวใน memory ใช้ไม่ได้แล้ว
 *
 * ฟอร์ม PM เซฟรูปลง IndexedDB ตั้งแต่ตอนแนบ (putPhoto) จึงกู้กลับมาได้เองเงียบๆ
 * โดยไม่ต้องให้ผู้ใช้แนบรูปใหม่ทั้งชุด — recover คือฟังก์ชันดึงไฟล์จากที่สำรอง
 * ซึ่งแต่ละฟอร์มมี draftPhotos lib ของตัวเอง จึงรับเข้ามาเป็น callback
 */
export async function resolveUsableFile(
    file: File | undefined,
    recover?: () => Promise<File | undefined>,
): Promise<File> {
    if (file && (await isFileReadable(file))) return file;

    if (recover) {
        const recovered = await recover().catch(() => undefined);
        if (recovered && (await isFileReadable(recovered))) {
            console.warn("[upload-safety] ไฟล์ใน memory ใช้ไม่ได้แล้ว — กู้จาก IndexedDB สำเร็จ");
            return recovered;
        }
    }

    throw new Error("ไฟล์รูปใช้ไม่ได้แล้วและกู้จากเครื่องไม่สำเร็จ กรุณาแนบรูปข้อนี้ใหม่");
}

/**
 * อ่านไฟล์เข้า memory ก่อนส่ง
 *
 * File ที่ได้จาก <input type="file"> เป็นแค่ "ตัวชี้" ไปยังไฟล์บนเครื่อง ไม่ใช่ข้อมูลจริง
 * บน iOS Safari ถ้าผู้ใช้กรอกฟอร์มนาน สลับแอป หรือเครื่องความจำไม่พอ ระบบจะทิ้ง
 * backing store ของไฟล์นั้น ทำให้ File กลายเป็นตัวชี้ที่อ่านไม่ได้ — แต่ file.size
 * ยังรายงานค่าเดิมอยู่ การเช็ค size === 0 จึงไม่จับ
 *
 * พอ fetch เอา File ที่ตายแล้วไปส่ง body จะขาดกลางคัน server เลย parse multipart
 * ไม่ออก แล้วตอบ 422 แบบทุกฟิลด์เป็น null เหมือนกับว่า frontend ไม่ได้ส่งอะไรมาเลย
 *
 * อ่านเป็น ArrayBuffer ก่อนจึงได้ 2 อย่าง: body ที่ส่งเป็นข้อมูลจริงในหน่วยความจำแน่นอน
 * และถ้าไฟล์ตายแล้วจะ error ตรงนี้พร้อมข้อความที่บอกผู้ใช้ได้ว่าต้องแนบรูปใหม่
 */
export async function materializeFormData(body: FormData): Promise<FormData> {
    const out = new FormData();
    const entries: [string, FormDataEntryValue][] = [];
    body.forEach((value, key) => entries.push([key, value]));

    for (const [key, value] of entries) {
        if (!(value instanceof File)) {
            out.append(key, value as any);
            continue;
        }

        const name = safeUploadName(value.name);
        let buf: ArrayBuffer;
        try {
            buf = await value.arrayBuffer();
        } catch (e) {
            console.error("[upload-safety] อ่านไฟล์ไม่ได้ (ไฟล์ถูกระบบคืนหน่วยความจำไปแล้ว)", value.name, e);
            throw new Error(`อ่านไฟล์รูปไม่ได้ (${name}) กรุณาแนบรูปนี้ใหม่อีกครั้ง`);
        }
        if (buf.byteLength === 0) {
            throw new Error(`ไฟล์รูปว่างเปล่า (${name}) กรุณาแนบรูปนี้ใหม่อีกครั้ง`);
        }
        out.append(key, new File([buf], name, { type: value.type || "image/jpeg" }), name);
    }

    return out;
}

/**
 * แจ้งว่ารูปที่เซฟไว้ในเครื่องกู้กลับมาไม่ได้
 *
 * ตอน restore draft ถ้ารูปหายจาก IndexedDB (เครื่องล้าง storage / quota เคยเต็ม
 * ตอนเขียน) เดิมจะ console.warn แล้ว continue เงียบๆ ผู้ใช้ไม่รู้เลยว่าขาดรูป
 * เพราะ validation ต้องการแค่ข้อละ 1 รูป — กดบันทึกไปทั้งที่รายงานขาดหลักฐาน
 *
 * รวมนับแล้วเตือนครั้งเดียว ไม่เด้งทีละใบ
 */
let missingPhotoCount = 0;
let missingPhotoTimer: ReturnType<typeof setTimeout> | null = null;

export function reportMissingDraftPhoto(lang: string = "th") {
    missingPhotoCount++;
    if (missingPhotoTimer) clearTimeout(missingPhotoTimer);
    missingPhotoTimer = setTimeout(() => {
        const n = missingPhotoCount;
        missingPhotoCount = 0;
        missingPhotoTimer = null;
        if (typeof window === "undefined") return;
        window.alert(
            lang === "th"
                ? `รูปที่บันทึกไว้ในเครื่องหายไป ${n} รูป กรุณาตรวจสอบและแนบรูปใหม่ก่อนกดบันทึก`
                : `${n} saved photo(s) could not be restored from this device. Please re-attach them before saving.`,
        );
    }, 500);
}

export function installUploadSafetyPatch() {
    if (installed) return;
    if (typeof window === "undefined" || typeof window.fetch !== "function") return;
    if (typeof FormData === "undefined" || typeof File === "undefined") return;
    installed = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
        if (!(init?.body instanceof FormData)) return originalFetch(input, init);
        return materializeFormData(init.body).then((body) => originalFetch(input, { ...init, body }));
    };
}
