import { test as base, expect, type Page } from "@playwright/test";
import { isTelemetryRequest } from "../scripts/telemetry-blocklist.mjs";

/**
 * The e2e suite runs against `vite preview`, which serves the same `dist/` the
 * deploy uploads — beacon `<script src>` tag and inlined token included. Real
 * Chromium loads those pages, so without a guard every `page.goto()` fetches
 * `beacon.min.js` and posts a `cdn-cgi/rum` pageview reporting
 * `location.host = localhost:4173`.
 *
 * Those hits do not reach the traffic read-out: it filters the RUM dataset on
 * `requestHost: pratik.pa.tel`, and a synthetic hit never carries that host.
 * They do land under the site token, so they surface in the Cloudflare Web
 * Analytics dashboard, where a human reading "pageviews" sees CI's traffic
 * mixed with the site's. Blocking them is hygiene, not a correctness gate on
 * the read-out.
 *
 * `scripts/prerender.mjs` already blocks this for the prerender pass. The
 * Playwright pass is a second, independent browser over the same bundle and
 * needs the same guard, driven off the same blocklist so the two cannot drift.
 */
type TelemetryFixtures = {
  /** Telemetry URLs the guard aborted during the current test. */
  blockedTelemetry: string[];
  /** Slows the renderer so hydration races are reproducible locally. */
  cpuThrottle: void;
};

export const test = base.extend<TelemetryFixtures>({
  /**
   * Off unless `E2E_CPU_THROTTLE` is set, and then it slows the renderer by that
   * factor via CDP.
   *
   * A hydration race is invisible on a developer machine — the whole reason
   * PRA-744's seven flaky tests only ever failed on a CI runner, and the reason a
   * green local run is not evidence that one is fixed. This is the knob that makes
   * the failure reproducible here: `E2E_CPU_THROTTLE=50 npx playwright test` put
   * the old bare-keypress terminal specs reliably in the red, which is what
   * qualified the fix.
   */
  cpuThrottle: [
    async ({ page, context }, use) => {
      const rate = Number(process.env.E2E_CPU_THROTTLE);
      if (rate > 1) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      }
      await use();
    },
    { auto: true },
  ],
  blockedTelemetry: [
    async ({ context }, use) => {
      const blocked: string[] = [];

      await context.route("**/*", (route) => {
        const url = route.request().url();
        if (isTelemetryRequest(url)) {
          blocked.push(url);
          return route.abort();
        }
        return route.continue();
      });

      await use(blocked);
    },
    // Auto so a new spec file cannot forget it; forgetting is the failure mode
    // that put synthetic pageviews in the dataset in the first place.
    { auto: true },
  ],
});

export { expect };
export type { Page } from "@playwright/test";

/* ---------- Terminal overlay: opening it without racing hydration ---------- */

export const TERMINAL_TOGGLE = 'button[title="Open terminal (Ctrl+K)"]';

const terminalDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Interactive terminal" });

/**
 * Opens the terminal through the toggle button, and waits for it.
 *
 * Ctrl+K is bound in a `useEffect`, so a press issued before React has run its
 * effects is silently dropped and the terminal never opens. `page.goto()`
 * resolves on `load`, which says nothing about React: the entry module mounts
 * from a promise continuation and React 18 hydrates concurrently, so effects
 * routinely land after `load`. Locally hydration wins anyway; on a CI runner it
 * does not, which is why every test that opened with a bare keypress was flaky
 * there.
 *
 * A click is not merely a wider window — it is an actual gate. Playwright's
 * actionability checks (visible, stable, receives-events, enabled) each need the
 * renderer's main thread, which is exactly what hydration is monopolising, so
 * the click is not delivered until React is live. Measured under CDP CPU
 * throttling, with React provably un-hydrated at the moment the action was
 * issued: a keypress dropped 2 of 8 runs at 50x, while the click opened the
 * terminal 8 of 8 at 12x, 25x and 50x.
 *
 * So callers that only care what a command *prints* should open with this, and
 * only a test whose subject is the shortcut itself should press Ctrl+K — after
 * `proveReactIsLive`.
 */
export async function openTerminalByClick(page: Page) {
  await page.locator(TERMINAL_TOGGLE).click();
  await expect(terminalDialog(page)).toBeVisible();
}

/**
 * Proves React is live, then puts the page back to a closed terminal so a
 * following Ctrl+K is testing the shortcut from a clean start.
 *
 * Focus is left on the toggle button, so callers that care where the keyboard
 * starts set it themselves afterwards.
 */
export async function proveReactIsLive(page: Page) {
  await openTerminalByClick(page);
  await page.keyboard.press("Escape");
  await expect(terminalDialog(page)).not.toBeVisible();
}
