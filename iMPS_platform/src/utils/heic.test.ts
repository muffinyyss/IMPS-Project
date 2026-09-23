import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// apiFetch แตะ localStorage/หน้าต่าง session — mock ทิ้งไป เทสต์นี้สนใจแค่ตรรกะ HEIC
const apiFetch = vi.fn();
vi.mock("@/utils/api", () => ({ apiFetch: (...args: any[]) => apiFetch(...args) }));

import { isHeicFile, ensureViewableImage } from "./heic";

/** สร้างไฟล์ ISO-BMFF ปลอมที่มี brand ตามต้องการ (โครงหัวไฟล์เหมือน HEIC จริง) */
function bmff(brand: string, name: string, type = ""): File {
    const head = new Uint8Array(16);
    head.set([0x00, 0x00, 0x00, 0x18], 0);
    head.set(Array.from("ftyp" + brand, (c) => c.charCodeAt(0)), 4);
    return new File([head], name, { type });
}

function jpeg(name = "a.jpg", type = "image/jpeg"): File {
    return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])], name, { type });
}

describe("isHeicFile", () => {
    // เคสที่ทำให้บั๊กนี้หลุดมาถึง production: frontend เปลี่ยนนามสกุลเป็น .jpg
    // ตั้งแต่ต้นทาง (ensureJpgFilename / safeUploadName) และ iOS ส่ง type ว่างมา
    // ถ้าเช็คจากนามสกุลอย่างเดียวจะไม่เจอเลย
    it("จับ HEIC ที่ถูกเปลี่ยนนามสกุลเป็น .jpg ได้จาก magic bytes", async () => {
        expect(await isHeicFile(bmff("heic", "IMG_1234.jpg"))).toBe(true);
    });

    it.each(["heic", "heix", "hevc", "mif1", "avif"])("รู้จัก brand %s", async (brand) => {
        expect(await isHeicFile(bmff(brand, "x.jpg"))).toBe(true);
    });

    it("ไฟล์ mp4 (brand isom) ไม่ใช่ HEIC", async () => {
        expect(await isHeicFile(bmff("isom", "clip.mp4", "video/mp4"))).toBe(false);
    });

    it("JPEG ปกติไม่เข้าข่าย", async () => {
        expect(await isHeicFile(jpeg())).toBe(false);
    });

    it("เชื่อ content-type ที่บอกว่าเป็น heic", async () => {
        expect(await isHeicFile(new File(["x"], "a.jpg", { type: "image/heic" }))).toBe(true);
    });

    it("ไฟล์สั้นเกินกว่าจะอ่าน magic ได้ → เดาจากนามสกุล", async () => {
        expect(await isHeicFile(new File(["ab"], "photo.HEIC"))).toBe(true);
        expect(await isHeicFile(new File(["ab"], "photo.png"))).toBe(false);
    });
});

describe("ensureViewableImage", () => {
    beforeEach(() => apiFetch.mockReset());
    afterEach(() => vi.restoreAllMocks());

    it("ไฟล์ที่ไม่ใช่ HEIC คืนตัวเดิม ไม่ยิง network", async () => {
        const f = jpeg();
        expect(await ensureViewableImage(f)).toBe(f);
        expect(apiFetch).not.toHaveBeenCalled();
    });

    it("HEIC → ส่งไปแปลงที่ server แล้วได้ JPEG ชื่อ .jpg กลับมา", async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            blob: async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }),
        });

        const out = await ensureViewableImage(bmff("heic", "IMG_0042.HEIC"));

        expect(apiFetch).toHaveBeenCalledTimes(1);
        expect(apiFetch.mock.calls[0][0]).toContain("/images/convert");
        expect(out.name).toBe("IMG_0042.jpg");
        expect(out.type).toBe("image/jpeg");
    });

    // แปลงไม่ได้ต้องไม่บล็อกการแนบรูป — backend ยังแปลงให้อีกชั้นตอนอัปโหลดจริง
    it("server ตอบ error → คืนไฟล์เดิม ไม่ throw", async () => {
        apiFetch.mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
        const f = bmff("heic", "IMG_1.jpg");
        expect(await ensureViewableImage(f)).toBe(f);
    });

    // หมายเหตุ: ไม่ใช้ mock ที่ throw เอง เพราะ @vitest/spy รายงาน error ของ mock เป็น
    // test failure แม้โค้ดจะ catch ไว้แล้ว — ใช้ response ที่อ่าน body ไม่ได้แทน
    // ซึ่งลงเอยที่ catch ก้อนเดียวกัน
    it("อ่าน response ไม่สำเร็จ → คืนไฟล์เดิม ไม่ throw", async () => {
        apiFetch.mockResolvedValue({
            ok: true,
            blob: () => { throw new Error("stream closed"); },
        });
        const f = bmff("heic", "IMG_2.jpg");
        expect(await ensureViewableImage(f)).toBe(f);
    });

    // 413 มาจาก nginx (client_max_body_size) ไม่ใช่ FastAPI — HEIC ดิบจาก iPhone
    // มักใหญ่กว่าเพดาน และบีบก่อนส่งไม่ได้เพราะเบราว์เซอร์ decode ไม่ออก
    it("413 (ไฟล์ใหญ่เกิน) → คืนไฟล์เดิม ไม่ throw", async () => {
        apiFetch.mockResolvedValue({ ok: false, status: 413, text: async () => "too large" });
        const f = bmff("heic", "IMG_big.jpg");
        expect(await ensureViewableImage(f)).toBe(f);
    });

    it("server คืน blob ว่าง → คืนไฟล์เดิม", async () => {
        apiFetch.mockResolvedValue({ ok: true, blob: async () => new Blob([]) });
        const f = bmff("heic", "IMG_3.jpg");
        expect(await ensureViewableImage(f)).toBe(f);
    });

    it("ไฟล์ว่างคืนตัวเดิมทันที", async () => {
        const f = new File([], "empty.heic");
        expect(await ensureViewableImage(f)).toBe(f);
        expect(apiFetch).not.toHaveBeenCalled();
    });
});
