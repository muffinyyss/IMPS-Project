import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DraftManager, pickNewerDraft, saveDraftLocal, loadDraftLocal, type DraftData } from "./draft";

// ร่าง CM inprogress: สิ่งที่กรอกตอนส่ง server ไม่ผ่าน (token หมดอายุ / เน็ตหลุด) ต้องไม่หาย

const base: DraftData = {
  corrective_actions: [{ text: "เปลี่ยนฟิวส์", beforeImages: [{ id: "1", name: "a.jpg", base64: "data:image/jpeg;base64," + "A".repeat(20000) }], afterImages: [], files: [] }],
  repaired_equipment: [],
  repair_result: "",
  preventive_action: [],
  inprogress_remarks: "",
  repair_result_remark: "",
  problem_type: [],
  problem_type_other: "",
  cause: [],
};
const d = (remark: string, savedAt?: string): DraftData => ({ ...base, inprogress_remarks: remark, savedAt });

const store = new Map<string, string>();
let quotaLimit = Infinity;

beforeEach(() => {
  store.clear();
  quotaLimit = Infinity;
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (v.length > quotaLimit) throw new DOMException("quota", "QuotaExceededError");
      store.set(k, v);
    },
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("pickNewerDraft", () => {
  it("ร่างในเครื่องใหม่กว่า → ใช้ร่างในเครื่อง", () => {
    expect(pickNewerDraft({ draft: d("server"), savedAt: "2026-10-20T01:00:00Z" }, d("local", "2026-10-20T01:05:00Z"))?.inprogress_remarks).toBe("local");
  });
  it("server ใหม่กว่า (อีกเครื่องบันทึกทีหลัง) → ใช้ server", () => {
    expect(pickNewerDraft({ draft: d("server"), savedAt: "2026-10-20T02:00:00Z" }, d("local", "2026-10-20T01:05:00Z"))?.inprogress_remarks).toBe("server");
  });
  it("server ไม่ส่งเวลา → ใช้ร่างในเครื่อง", () => {
    expect(pickNewerDraft({ draft: d("server") }, d("local", "2026-10-20T01:05:00Z"))?.inprogress_remarks).toBe("local");
  });
  it("มีร่างฝั่งเดียว → ใช้ฝั่งนั้น", () => {
    expect(pickNewerDraft(null, d("local"))?.inprogress_remarks).toBe("local");
    expect(pickNewerDraft({ draft: d("server"), savedAt: null }, null)?.inprogress_remarks).toBe("server");
    expect(pickNewerDraft(null, null)).toBeNull();
  });
});

describe("saveDraftLocal", () => {
  it("localStorage เต็มเพราะรูป → ยังเก็บข้อความไว้ได้", () => {
    quotaLimit = 5000;   // ร่างที่มีรูป (~20KB) ใส่ไม่ลง แต่ข้อความอย่างเดียวใส่ได้
    saveDraftLocal("r1", d("ข้อความที่ช่างพิมพ์"));
    const saved = loadDraftLocal("r1");
    expect(saved?.inprogress_remarks).toBe("ข้อความที่ช่างพิมพ์");
    expect(saved?.corrective_actions[0].text).toBe("เปลี่ยนฟิวส์");
    expect(saved?.corrective_actions[0].beforeImages).toEqual([]);
  });
  it("พื้นที่พอ → เก็บรูปด้วย", () => {
    saveDraftLocal("r1", d("x"));
    expect(loadDraftLocal("r1")?.corrective_actions[0].beforeImages).toHaveLength(1);
  });
});

describe("DraftManager — token หมดอายุระหว่างกรอก แล้ว login ใหม่", () => {
  const json = (status: number, body: unknown = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("เซฟ server ไม่ผ่าน (401) → เก็บในเครื่อง → login ใหม่ได้ร่างล่าสุดกลับมา ไม่ใช่ร่างเก่าบน server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(401, { detail: "token_expired" })));
    const m = new DraftManager("r1", "st1");
    expect(await m.save(d("กรอกหลัง token หมดอายุ"))).toBe(false);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      json(200, { ok: true, hasDraft: true, draft: d("ร่างเก่าบน server"), savedAt: "2000-01-01T00:00:00Z" }),
    ));
    expect((await m.load())?.inprogress_remarks).toBe("กรอกหลัง token หมดอายุ");
  });

  it("server โหลดไม่ได้ → ใช้ร่างในเครื่อง", async () => {
    saveDraftLocal("r1", d("local"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    expect((await new DraftManager("r1", "st1").load())?.inprogress_remarks).toBe("local");
  });

  it("ไม่มีร่างในเครื่อง → ใช้ร่างจาก server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(200, { ok: true, hasDraft: true, draft: d("server"), savedAt: null })));
    expect((await new DraftManager("r1", "st1").load())?.inprogress_remarks).toBe("server");
  });
});
