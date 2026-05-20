import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config untuk e2e DEPOT GNR.
 *
 * Asumsi dev server sudah jalan di http://localhost:3000.
 * Tidak auto-start webServer karena tabungan startup overhead.
 *
 * Run: npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // sequential per file untuk hindari race di DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // SQLite: hindari concurrent writer
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["html", { open: "never" }], ["list"]],
  outputDir: "test-results/",

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  globalSetup: require.resolve("./tests/e2e/global-setup.ts"),

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      testIgnore: /08-mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      testMatch: /08-mobile\.spec\.ts/,
    },
  ],
});
