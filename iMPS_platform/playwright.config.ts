import { defineConfig } from "@playwright/test";

// Smoke test : compte les requêtes qu'une page émet au chargement, API simulée (aucun backend requis).
// Lance le build de production sur le port 3100 ; SMOKE_SKIP_BUILD=1 réutilise un build existant.
// PLAYWRIGHT_CHANNEL=chrome utilise le Chrome installé au lieu du Chromium de Playwright.
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.e2e.ts",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command: process.env.SMOKE_SKIP_BUILD
      ? `npx next start -p ${PORT}`
      : `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/auth/signin/basic`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  },
});
