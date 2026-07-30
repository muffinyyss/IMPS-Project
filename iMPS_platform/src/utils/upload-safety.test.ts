import { describe, it, expect } from "vitest";
import { safeUploadName, materializeFormData, isFileReadable, resolveUsableFile, isImageDecodable } from "./upload-safety";

describe("safeUploadName", () => {
    // เคสที่ทำให้เกิดบัคจริง: อักขระพวกนี้ทำให้ header Content-Disposition เพี้ยน
    // แล้ว server parse multipart ไม่ออก → ตอบ 422 โดยที่ทุกฟิลด์เป็น null
    it.each([
        ['พัง"แล้ว.jpg', '"'],
        ["line\nbreak.jpg", "\n"],
        ["carriage\rreturn.jpg", "\r"],
        ["semi;colon.jpg", ";"],
    ])("ตัดอักขระอันตรายออกจาก %s", (input: string, bad: string) => {
        expect(safeUploadName(input)).not.toContain(bad);
    });

    it("เหลือเฉพาะ A-Z a-z 0-9 . _ - เสมอ", () => {
        expect(safeUploadName('IMG "20260730"\n(1).jpeg')).toMatch(/^[A-Za-z0-9._-]+$/);
    });

    it("ชื่อไทยล้วนถูกกรองจนว่าง → ได้ชื่อ fallback ที่ใช้ได้", () => {
        expect(safeUploadName("รูปตู้ชาร์จ.jpg")).toMatch(/^file_\d+_[a-z0-9]+\.jpg$/);
    });

    // backend เขียนไฟล์ตามชื่อ ถ้าชนกันรูปหลังจะทับรูปแรก
    it("fallback ไม่ซ้ำกันแม้เรียกรัวๆ ใน ms เดียวกัน", () => {
        const names = new Set(Array.from({ length: 200 }, () => safeUploadName("รูป.jpg")));
        expect(names.size).toBe(200);
    });

    it("ชื่อปกติไม่ถูกแก้", () => {
        expect(safeUploadName("IMG_2024.jpg")).toBe("IMG_2024.jpg");
    });

    it("ชื่อว่าง/ไม่มีนามสกุล ได้ชื่อที่ใช้ได้เสมอ", () => {
        expect(safeUploadName("")).toMatch(/^file_\d+_[a-z0-9]+\.jpg$/);
        expect(safeUploadName("photo")).toBe("photo.jpg");
    });

    it("ตัด path ที่แนบมากับชื่อไฟล์", () => {
        expect(safeUploadName("C:\\Users\\me\\IMG_1.jpg")).toBe("IMG_1.jpg");
        expect(safeUploadName("/storage/emulated/0/IMG_2.jpg")).toBe("IMG_2.jpg");
    });

    it("กันชื่อยาวเกินจน header บวม", () => {
        expect(safeUploadName("a".repeat(500) + ".jpg").length).toBeLessThanOrEqual(90);
    });
});

describe("materializeFormData", () => {
    const buildForm = (file: File) => {
        const fd = new FormData();
        fd.append("sn", "SN-001");
        fd.append("group", "g1");
        fd.append("files", file);
        return fd;
    };

    it("คงฟิลด์ที่ไม่ใช่ไฟล์ไว้ครบ", async () => {
        const out = await materializeFormData(buildForm(new File(["abc"], "IMG_1.jpg", { type: "image/jpeg" })));
        expect(out.get("sn")).toBe("SN-001");
        expect(out.get("group")).toBe("g1");
    });

    it("เนื้อไฟล์ไม่เพี้ยนหลังอ่านเข้า memory", async () => {
        const out = await materializeFormData(buildForm(new File(["hello world"], "IMG_1.jpg", { type: "image/jpeg" })));
        const f = out.get("files") as File;
        expect(await f.text()).toBe("hello world");
        expect(f.name).toBe("IMG_1.jpg");
        expect(f.type).toBe("image/jpeg");
    });

    // เคสจริงบน iOS: File กลายเป็นตัวชี้ที่อ่านไม่ได้ แต่ .size ยังรายงานค่าเดิม
    // เดิมจะถูกส่งออกไปแล้วได้ 422 ที่อ่านไม่รู้เรื่อง — ต้องกลายเป็น error ที่บอกผู้ใช้ได้
    it("ไฟล์ที่อ่านไม่ได้ → error ที่บอกให้แนบใหม่ ไม่ใช่ปล่อยให้ไปพังที่ server", async () => {
        const dead = new File(["x".repeat(1000)], "IMG_dead.jpg", { type: "image/jpeg" });
        Object.defineProperty(dead, "arrayBuffer", {
            value: () => Promise.reject(new DOMException("The operation is not allowed", "NotReadableError")),
        });
        expect(dead.size).toBeGreaterThan(0); // .size ยังโกหกอยู่ — guard size===0 จับไม่ได้
        await expect(materializeFormData(buildForm(dead))).rejects.toThrow(/แนบรูปนี้ใหม่/);
    });

    it("ไฟล์ว่างเปล่า → error ที่บอกให้แนบใหม่", async () => {
        await expect(materializeFormData(buildForm(new File([], "IMG_empty.jpg", { type: "image/jpeg" }))))
            .rejects.toThrow(/แนบรูปนี้ใหม่/);
    });

    it("กรองชื่อไฟล์ไม่ปลอดภัยระหว่างทางด้วย", async () => {
        const out = await materializeFormData(buildForm(new File(["x"], 'bad"\nname.jpg', { type: "image/jpeg" })));
        expect((out.get("files") as File).name).toMatch(/^[A-Za-z0-9._-]+$/);
    });
});

describe("isFileReadable", () => {
    it("ไฟล์ปกติ → true", async () => {
        expect(await isFileReadable(new File(["data"], "a.jpg"))).toBe(true);
    });

    it("ไฟล์ว่าง → false", async () => {
        expect(await isFileReadable(new File([], "a.jpg"))).toBe(false);
    });

    it("null/undefined → false", async () => {
        expect(await isFileReadable(null)).toBe(false);
        expect(await isFileReadable(undefined)).toBe(false);
    });

    // จุดสำคัญ: .size ยังบอกว่ามีข้อมูล แต่อ่านจริงไม่ได้ — เคสที่ guard เดิมจับไม่ได้
    it("ไฟล์ที่ size โกหก แต่อ่านไม่ได้ → false", async () => {
        const dead = new File(["x".repeat(500)], "dead.jpg");
        Object.defineProperty(dead, "arrayBuffer", {
            value: () => Promise.reject(new DOMException("nope", "NotReadableError")),
        });
        expect(dead.size).toBe(500);
        expect(await isFileReadable(dead)).toBe(false);
    });
});

describe("resolveUsableFile", () => {
    const deadFile = (name = "dead.jpg") => {
        const f = new File(["x".repeat(300)], name);
        Object.defineProperty(f, "arrayBuffer", {
            value: () => Promise.reject(new DOMException("nope", "NotReadableError")),
        });
        return f;
    };

    it("ไฟล์ใช้ได้ → คืนตัวเดิม ไม่แตะที่สำรอง", async () => {
        const good = new File(["ok"], "good.jpg");
        let called = false;
        const out = await resolveUsableFile(good, async () => { called = true; return undefined; });
        expect(out).toBe(good);
        expect(called).toBe(false);
    });

    // หัวใจของการกู้: ผู้ใช้ไม่ต้องแนบรูปใหม่ทั้งชุด
    it("ไฟล์เสีย + กู้ได้ → คืนไฟล์ที่กู้มา", async () => {
        const backup = new File(["recovered"], "backup.jpg");
        const out = await resolveUsableFile(deadFile(), async () => backup);
        expect(out).toBe(backup);
        expect(await out.text()).toBe("recovered");
    });

    it("ไม่มีไฟล์ใน memory เลย แต่กู้ได้ → คืนไฟล์ที่กู้มา", async () => {
        const backup = new File(["from-db"], "backup.jpg");
        expect(await resolveUsableFile(undefined, async () => backup)).toBe(backup);
    });

    it("ไฟล์เสีย + ไม่มีที่สำรอง → error บอกให้แนบใหม่", async () => {
        await expect(resolveUsableFile(deadFile())).rejects.toThrow(/แนบรูปข้อนี้ใหม่/);
    });

    it("ไฟล์เสีย + ที่สำรองก็เสีย → error บอกให้แนบใหม่", async () => {
        await expect(resolveUsableFile(deadFile(), async () => deadFile("backup.jpg")))
            .rejects.toThrow(/แนบรูปข้อนี้ใหม่/);
    });

    it("ที่สำรอง throw (เช่น IndexedDB พัง) → ไม่หลุดเป็น error ดิบ", async () => {
        await expect(resolveUsableFile(deadFile(), async () => { throw new Error("IDB closed"); }))
            .rejects.toThrow(/แนบรูปข้อนี้ใหม่/);
    });
});

describe("isImageDecodable", () => {
    // vitest env=node ไม่มี Image/URL.createObjectURL — ฟังก์ชันต้องไม่พังและไม่บล็อกการแนบรูป
    it("นอกเบราว์เซอร์ → ผ่านไว้ก่อน ไม่ block การแนบรูป", async () => {
        expect(await isImageDecodable(new File(["x"], "a.jpg"))).toBe(true);
    });
});
