import { test as base, expect } from "@playwright/test";
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
};

export const test = base.extend<TelemetryFixtures>({
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
