import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ทุก request ไป backend ที่ได้ 401 ต้องพาไป login — รวมหน้าที่เรียก fetch ตรง ๆ ไม่ผ่าน apiFetch

vi.mock("./session-toast", () => ({
  showSessionToast: (_p: unknown, opts?: { onDone?: () => void }) => opts?.onDone?.(),
  detailToProblem: (d: string) => d,
  showNetworkError: () => {},
}));

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const store = new Map<string, string>();
const replace = vi.fn();
let backendFetch: ReturnType<typeof vi.fn>;
const win: any = {};

// EventSource ปลอม — จำ listener ไว้ให้เทสต์สั่งยิง error เองได้
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  listeners: Record<string, Array<() => void>> = {};
  constructor(url: string | URL) {
    this.url = String(url);
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ||= []).push(fn);
  }
  emit(type: string) {
    (this.listeners[type] || []).forEach((fn) => fn());
  }
}

async function setup(pathname = "/dashboard/cm-report") {
  store.clear();
  replace.mockReset();
  backendFetch = vi.fn();
  Object.assign(win, {
    addEventListener: () => {},
    dispatchEvent: () => true,
    location: { pathname, search: "", href: `http://localhost:3001${pathname}`, replace },
    fetch: backendFetch,
    EventSource: FakeEventSource,
  });
  FakeEventSource.instances = [];
  vi.stubGlobal("window", win);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.resetModules();
  const mod = await import("./session-guard");
  mod.installSessionGuard();
  return mod;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {});
afterEach(() => vi.unstubAllGlobals());

describe("session guard", () => {
  it("fetch ตรง ๆ ไป backend ได้ 401 → ล้างโปรไฟล์และพาไป login (response ยังคืนให้ผู้เรียก)", async () => {
    await setup();
    store.set("user", "{}");
    backendFetch.mockResolvedValueOnce(json(401, { detail: "token_expired" }));
    const res = await win.fetch("http://localhost:8000/cmreport/abc/draft", { method: "POST" });
    expect(res.status).toBe(401);
    await flush();
    expect(store.has("user")).toBe(false);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toContain("reason=token_expired");
    expect(replace.mock.calls[0][0]).toContain("next=%2Fdashboard%2Fcm-report");
  });

  it("401 หลายตัวพร้อมกัน → เด้งครั้งเดียว", async () => {
    await setup();
    backendFetch.mockResolvedValue(json(401, { detail: "token_expired" }));
    await Promise.all([win.fetch("http://localhost:8000/a"), win.fetch("http://localhost:8000/b"), win.fetch("http://localhost:8000/c")]);
    await flush();
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it.each(["/login/", "/logout", "/forgot-password/", "/reset-password/", "/refresh"])(
    "%s ได้ 401 → ไม่เด้ง (รหัสผิด ไม่ใช่ session หมด)",
    async (path) => {
      await setup();
      backendFetch.mockResolvedValueOnce(json(401, { detail: "Invalid credentials" }));
      await win.fetch(`http://localhost:8000${path}`);
      await flush();
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it("อยู่หน้า /auth/* แล้ว → ไม่เด้งซ้ำ", async () => {
    await setup("/auth/signin/basic");
    backendFetch.mockResolvedValueOnce(json(401));
    await win.fetch("http://localhost:8000/me");
    await flush();
    expect(replace).not.toHaveBeenCalled();
  });

  it("401 จากเว็บอื่นที่ไม่ใช่ backend → ไม่สนใจ", async () => {
    await setup();
    backendFetch.mockResolvedValueOnce(json(401));
    await win.fetch("https://tiles.example.com/map.png");
    await flush();
    expect(replace).not.toHaveBeenCalled();
  });

  it("status อื่น → ผ่านเฉย ๆ", async () => {
    await setup();
    backendFetch.mockResolvedValueOnce(json(403)).mockResolvedValueOnce(json(500));
    expect((await win.fetch("http://localhost:8000/x")).status).toBe(403);
    expect((await win.fetch("http://localhost:8000/x")).status).toBe(500);
    await flush();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("session guard — SSE (EventSource)", () => {
  it("stream ไป backend error แล้ว /me ตอบ 401 → พาไป login", async () => {
    await setup("/dashboard/cbm");
    backendFetch.mockResolvedValueOnce(json(401, { detail: "token_expired" }));
    const es = new win.EventSource("http://localhost:8000/CBM?SN=abc", { withCredentials: true });
    es.emit("error");
    await flush();
    await flush();
    expect(backendFetch).toHaveBeenCalledTimes(1);
    expect(String(backendFetch.mock.calls[0][0])).toMatch(/\/me$/);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][0]).toContain("next=%2Fdashboard%2Fcbm");
  });

  it("stream error แต่ /me ยังตอบ 200 (เน็ตหลุดชั่วคราว) → ไม่เด้ง", async () => {
    await setup();
    backendFetch.mockResolvedValueOnce(json(200, { id: "u1" }));
    new win.EventSource("http://localhost:8000/setting?SN=abc").emit("error");
    await flush();
    await flush();
    expect(replace).not.toHaveBeenCalled();
  });

  it("backend ล่ม (/me เชื่อมต่อไม่ได้) → ไม่เด้ง ไม่ throw", async () => {
    await setup();
    backendFetch.mockRejectedValueOnce(new TypeError("network"));
    new win.EventSource("http://localhost:8000/setting?SN=abc").emit("error");
    await flush();
    await flush();
    expect(replace).not.toHaveBeenCalled();
  });

  it("error รัว ๆ (EventSource retry ทุก 3 วิ) → ถาม /me ไม่ถี่เกิน 1 ครั้งต่อ 10 วิ", async () => {
    await setup();
    backendFetch.mockResolvedValue(json(200));
    const es = new win.EventSource("http://localhost:8000/MDB/st1");
    es.emit("error");
    es.emit("error");
    await flush();
    es.emit("error");
    await flush();
    expect(backendFetch).toHaveBeenCalledTimes(1);
  });

  it("stream ไปเว็บอื่น → ไม่ถาม /me", async () => {
    await setup();
    new win.EventSource("https://other.example.com/stream").emit("error");
    await flush();
    expect(backendFetch).not.toHaveBeenCalled();
  });

  it("ยังเป็น EventSource ตัวเดิม (หน้าเดิมใช้งานได้ตามปกติ)", async () => {
    await setup();
    const es = new win.EventSource("http://localhost:8000/CBM?SN=x");
    expect(es).toBeInstanceOf(FakeEventSource);
    expect(es.url).toBe("http://localhost:8000/CBM?SN=x");
  });
});
