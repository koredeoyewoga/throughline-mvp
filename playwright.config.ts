import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the coordinator flow. Runs against a dev server on
 * :3000 (started automatically, or reused if one is already up).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  // Generous because e2e runs against the Next dev server, which compiles each
  // route on first hit.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/api/exceptions",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
