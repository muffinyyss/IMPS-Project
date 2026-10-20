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

async function setup(pathname = "/dashboard/cm-report") {
  store.clear();
  replace.mockReset();
  backendFetch = vi.fn();
  Object.assign(win, {
    addEventListener: () => {},
    dispatchEvent: () => true,
    location: { pathname, search: "", href: `http://localhost:3001${pathname}`, replace },
    fetch: backendFetch,
  });
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
