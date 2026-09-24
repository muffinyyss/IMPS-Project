import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La session vit dans des cookies HttpOnly : le code du navigateur ne doit plus jamais lire,
// écrire ni envoyer de token. Ces tests verrouillent ce contrat.

vi.mock("./session-toast", () => ({
  showSessionToast: (_p: unknown, opts?: { onDone?: () => void }) => opts?.onDone?.(),
  detailToProblem: (d: string) => d,
  showNetworkError: () => {},
}));

const store = new Map<string, string>();
const replace = vi.fn();

beforeEach(() => {
  store.clear();
  replace.mockReset();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("window", {
    addEventListener: () => {},
    dispatchEvent: () => true,
    location: { pathname: "/dashboard/stations", search: "", replace },
  });
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("apiFetch — session par cookie uniquement", () => {
  it("purge au chargement les tokens laissés par l'ancienne version", async () => {
    ["access_token", "accessToken", "refresh_token", "token"].forEach((k) => store.set(k, "old"));
    store.set("user", JSON.stringify({ role: "admin" }));
    await import("./api");
    expect(Array.from(store.keys())).toEqual(["user"]);
  });

  it("envoie le cookie et jamais d'en-tête Authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { apiFetch } = await import("./api");
    await apiFetch("/all-stations/", { headers: { Authorization: "Bearer null", "X-Other": "1" } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("include");
    const headers = new Headers(init.headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("X-Other")).toBe("1");
  });

  it("401 → un seul /refresh (cookie), puis rejoue la requête", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(401, { detail: "token_expired" }))
      .mockResolvedValueOnce(json(200, { ok: true }))   // /refresh
      .mockResolvedValueOnce(json(200, { data: 1 }));   // rejeu
    vi.stubGlobal("fetch", fetchMock);
    const { apiFetch } = await import("./api");
    const res = await apiFetch("/me");
    expect(res.status).toBe(200);
    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1];
    expect(String(refreshUrl)).toMatch(/\/refresh$/);
    expect((refreshInit as RequestInit).credentials).toBe("include");
    expect((refreshInit as RequestInit).body).toBeUndefined();
  });

  it("refresh refusé → profil effacé et retour au login avec la page courante", async () => {
    store.set("user", JSON.stringify({ role: "admin" }));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json(401, { detail: "token_expired" }))
      .mockResolvedValueOnce(json(401, { detail: "refresh_token_expired" })));
    const { apiFetch } = await import("./api");
    await expect(apiFetch("/me")).rejects.toThrow("UNAUTHENTICATED");
    expect(store.has("user")).toBe(false);
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("next=%2Fdashboard%2Fstations"));
  });
});

describe("logout — une vraie déconnexion", () => {
  it("demande au backend de révoquer la session, puis efface le profil", async () => {
    store.set("user", JSON.stringify({ role: "admin" }));
    const fetchMock = vi.fn().mockResolvedValue(json(200));
    vi.stubGlobal("fetch", fetchMock);
    const { logout } = await import("./api");
    await logout();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/logout$/);
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(store.has("user")).toBe(false);
  });

  it("efface quand même le profil si le réseau est coupé", async () => {
    store.set("user", "{}");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    const { logout } = await import("./api");
    await logout();
    expect(store.has("user")).toBe(false);
  });
});

describe("getSessionProfile", () => {
  it("lit le rôle depuis le profil du login, pas depuis un JWT", async () => {
    store.set("user", JSON.stringify({ user_id: "u1", username: "qa", role: "owner" }));
    const { getSessionProfile, hasSession } = await import("./api");
    expect(getSessionProfile()?.role).toBe("owner");
    expect(hasSession()).toBe(true);
  });

  it("profil absent ou corrompu → null", async () => {
    store.set("user", "{not json");
    const { getSessionProfile } = await import("./api");
    expect(getSessionProfile()).toBeNull();
  });
});
