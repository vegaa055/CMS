import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * E2E tests run against a real server and database. Locally they reuse your
 * running `npm run dev`; in CI they run `next start` on a fresh Neon branch.
 * They create their own e2e-* data and clean it up (see e2e/global-*.ts).
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // tests share one database
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "public",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "admin",
      testMatch: /admin\/.*\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
    },
    // README screenshots: `npm run screenshots` (not part of the test run).
    {
      name: "screenshots",
      testMatch: /screenshots\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        colorScheme: "dark",
        storageState: "e2e/.auth/admin.json",
      },
    },
  ],
  webServer: {
    command: CI ? "npm run start" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
