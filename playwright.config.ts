import { defineConfig, devices } from "@playwright/test";
import { previewBaseURL, previewPort } from "./scripts/preview-port.mjs";

// Derived from the worktree path, so two agents previewing this site side by
// side get separate servers instead of quietly sharing one. `--strictPort`
// turns a collision with anything else into an error at startup rather than
// Vite drifting to the next free port while Playwright waits on this one.
// `e2e/global-setup.ts` is the backstop for a reused server that answers here
// but is serving some other dist/. See PRA-836.
const PORT = previewPort();

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: previewBaseURL(),
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: previewBaseURL(),
    reuseExistingServer: !process.env.CI,
  },
});
