import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.RADAR_TEST_PORT ?? 4173);
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}/ai-engineering-radar/`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec tsx scripts/serve.ts",
    port,
    reuseExistingServer: false,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        colorScheme: "dark",
        reducedMotion: "reduce",
      },
    },
  ],
});
