import { test, expect, type Page } from "@playwright/test";

// Budget de requêtes au chargement — le garde-fou qui manquait.
//
// En septembre 2026, un chargement de PM Report (All) émettait 208 appels à l'API, dont 201
// « un par chargeur », et les répétait toutes les 60 s : une seule page ralentissait toute la
// plateforme. Le défaut n'a été trouvé qu'en mesurant le site de production. Ce test l'aurait
// arrêté le jour même : la flotte simulée compte STATIONS × CHARGERS_PER_STATION chargeurs, et le
// budget est très inférieur à ce nombre, donc tout appel « par station » ou « par chargeur » échoue.
//
// L'API est simulée (page.route) : ni backend ni MongoDB, seulement le build Next.

const API = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/+$/, "");
const STATIONS = 60;
const CHARGERS_PER_STATION = 2;
const BUDGET = 15; // appels API par chargement — très en dessous des 120 chargeurs simulés

const stations = Array.from({ length: STATIONS }, (_, i) => {
  const n = String(i + 1).padStart(3, "0");
  return {
    id: `qa-station-${n}`,
    station_id: `QA-ST-${n}`,
    station_name: `QA Station ${n}`,
    user_id: "qa-admin",
    username: "qa_admin",
    is_active: true,
    chargers: Array.from({ length: CHARGERS_PER_STATION }, (_, j) => ({
      id: `qa-charger-${n}-${j + 1}`,
      SN: `QA-SN-${n}-${j + 1}`,
      chargeBoxID: `QA${n}${j + 1}`,
      chargerNo: j + 1,
      station_id: `QA-ST-${n}`,
      brand: "QA",
      is_active: true,
    })),
  };
});

const PROFILE = { user_id: "qa-admin", username: "qa_admin", email: "qa@local.test", role: "admin", company: "QA" };

const RESPONSES: Record<string, unknown> = {
  "/all-stations/": { stations },
  "/charger-onoff/bulk": { statuses: {} },
  "/station-availability/bulk": { stations: {} },
  "/pm-reports/counts": { counts: {}, by_type: {}, total: 0, stations_count: STATIONS },
  "/pm-reports/months": { months: [] },
  "/me": { id: "qa-admin", username: "qa_admin", role: "admin", effective_role: "admin", true_role: "admin" },
  "/all-users/": { users: [] },
  "/username": { username: [] },
};

function fakeJwt(): string {
  // Le middleware ne lit que l'expiration : la signature n'est vérifiée que par le backend (simulé ici).
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: PROFILE.email, role: "admin", exp })}.qa`;
}

async function signIn(page: Page, baseURL: string) {
  await page.context().addCookies([{ name: "access_token", value: fakeJwt(), url: baseURL }]);
  await page.addInitScript((profile) => {
    localStorage.setItem("user", JSON.stringify(profile));
    localStorage.setItem("userRole", profile.role);
  }, PROFILE);
}

async function countApiCalls(page: Page, baseURL: string, path: string): Promise<string[]> {
  const origin = new URL(baseURL).origin;
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  const calls: string[] = [];
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const { pathname, search } = new URL(req.url());
    calls.push(`${req.method()} ${pathname}${search}`);
    await route.fulfill({
      status: 200,
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify(RESPONSES[pathname] ?? {}),
    });
  });

  await page.goto(path);
  // les données doivent réellement s'afficher, sinon un N+1 sur les lignes ne se déclencherait pas
  await expect(page.getByText("QA Station 001").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2_000); // effets différés (chargement des compteurs, prefetch au repos)
  return calls;
}

for (const path of ["/dashboard/stations", "/dashboard/pm-all"]) {
  test(`${path} : au plus ${BUDGET} appels API pour ${STATIONS * CHARGERS_PER_STATION} chargeurs`, async ({ page, baseURL }) => {
    await signIn(page, baseURL!);
    const calls = await countApiCalls(page, baseURL!, path);
    console.log(`${path} → ${calls.length} appels\n  ${calls.join("\n  ")}`);
    expect(calls.length, `appels émis :\n${calls.join("\n")}`).toBeLessThanOrEqual(BUDGET);
  });
}

test("sans session, le dashboard n'est pas rendu : redirection vers le login avec la page demandée", async ({ page }) => {
  const res = await page.request.get("/dashboard/stations?tab=x", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  const location = res.headers()["location"] ?? "";
  expect(location).toContain("/auth/signin/basic");
  expect(decodeURIComponent(location)).toContain("next=/dashboard/stations?tab=x");
});

test("un token expiré ne suffit pas", async ({ page, baseURL }) => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const expired = `${b64({ alg: "HS256" })}.${b64({ sub: "x", exp: Math.floor(Date.now() / 1000) - 60 })}.qa`;
  await page.context().addCookies([{ name: "access_token", value: expired, url: baseURL! }]);
  const res = await page.request.get("/dashboard/pm-all", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
});
