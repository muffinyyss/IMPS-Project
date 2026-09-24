import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath — retour après login sans redirection ouverte", () => {
  it("garde un chemin interne avec sa query", () => {
    expect(safeNextPath("/dashboard/pm-all?tab=2")).toBe("/dashboard/pm-all?tab=2");
  });

  it.each([
    ["URL absolue", "https://evil.example/phish"],
    ["protocole relatif", "//evil.example"],
    ["backslash lu comme //", "/\\evil.example"],
    ["javascript:", "javascript:alert(1)"],
    ["vide", ""],
    ["null", null],
    ["retour vers /auth (boucle de login)", "/auth/signin/basic"],
  ])("refuse %s", (_label, value) => {
    expect(safeNextPath(value as string | null)).toBe("");
  });
});
