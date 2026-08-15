import { defineConfig, devices } from "@playwright/test";

// E2E a11y + keyboard checks. Runs against a running web server:
// - locally: point at the Docker web (default http://localhost:3000)
// - CI: set PLAYWRIGHT_BASE_URL, or let webServer start `next start` after a build.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
