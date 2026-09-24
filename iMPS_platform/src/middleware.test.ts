import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, middleware } from "./middleware";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (expInSeconds: number) =>
  `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "qa@local.test", exp: Math.floor(Date.now() / 1000) + expInSeconds })}.sig`;

function run(path: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(path, "http://localhost:3001"), {
    headers: { cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") },
  });
  return middleware(req);
}

describe("middleware — aucune page du dashboard sans session", () => {
  it("ne s'applique qu'au dashboard", () => {
    expect(config.matcher).toEqual(["/dashboard/:path*"]);
  });

  it("sans cookie → login, en gardant la page demandée", () => {
    const res = run("/dashboard/cm-report?tab=open");
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/auth/signin/basic");
    expect(location.searchParams.get("next")).toBe("/dashboard/cm-report?tab=open");
  });

  it("access token valide → la page passe", () => {
    expect(run("/dashboard/stations", { access_token: jwt(3600) }).headers.get("x-middleware-next")).toBe("1");
  });

  it("access expiré mais refresh valide → passe (le client renouvellera la session)", () => {
    const res = run("/dashboard/stations", { access_token: jwt(-60), refresh_token: jwt(7 * 86400) });
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    ["access expiré seul", { access_token: jwt(-60) }],
    ["refresh expiré seul", { refresh_token: jwt(-60) }],
    ["cookie illisible", { access_token: "not-a-jwt" }],
    ["JWT sans exp", { access_token: `${b64({ alg: "HS256" })}.${b64({ sub: "x" })}.sig` }],
  ])("%s → login", (_label, cookies) => {
    expect(run("/dashboard/stations", cookies).status).toBe(307);
  });
});
