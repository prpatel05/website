import { test as base, expect, type Page } from "@playwright/test";
import { isTelemetryRequest } from "../scripts/telemetry-blocklist.mjs";

/**
 * The e2e suite runs against `vite preview`, which serves the same `dist/` the
 * deploy uploads — beacon `<script src>` tag and inlined token included. Real
 * Chromium loads those pages, so without a guard every `page.goto()` fetches
 * `beacon.min.js` and posts a `cdn-cgi/rum` pageview reporting
 * `location.host = localhost:<preview port>`.
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

/* ---------- Overlays: a gate that is not blind to opacity or position ---------- */

export const SITE_MENU = "Site menu";
export const TERMINAL_DIALOG = "Interactive terminal";

/**
 * A CSS locator, not `getByRole`. `getByRole` reads the accessibility tree,
 * which empties for reasons that have nothing to do with the overlay being gone
 * — `md:hidden` at a breakpoint, an ancestor's `aria-hidden`. Counting DOM nodes
 * is the only way to say "unmounted" and mean it.
 */
export const dialogSelector = (name: string) =>
  `[role="dialog"][aria-label="${name}"]`;

/**
 * Everything `toBeVisible()` does not ask, in one round trip.
 *
 * Playwright's `toBeVisible()` requires a non-empty box and not
 * `visibility:hidden`. It says nothing about opacity and nothing about *where*
 * the box is, and the site has now shipped a broken overlay through that hole
 * twice with every overlay spec green:
 *
 * - PRA-884: both overlays opened at `opacity: 0` — framer's `initial` written
 *   into the inline style with no feature chunk loaded to animate it away — and
 *   the focus trap put the caret in a dialog the reader could not see.
 * - PRA-902: `PageTransition` left `filter: blur(0px)` on the page wrapper,
 *   making it a containing block for its `position: fixed` descendants. The menu
 *   overlay measured 375x4779 with its links at y=2273..2465 in a 667px
 *   viewport. All four were "visible", 2273px below the fold.
 *
 * So: effective opacity, multiplied down the ancestor chain (an opaque dialog
 * inside a transparent wrapper is still an invisible dialog), and the box
 * measured against the viewport the browser actually has. Both overlays are
 * `fixed` and sized to fit — verified at 1280x720, 375x667 and 375x200, where
 * the menu is exactly the viewport and the terminal sits inside it — so
 * "contained in the viewport" is the invariant that holds for both without
 * encoding either one's layout.
 *
 * Returned as a description rather than a boolean so the numbers survive into
 * the failure message.
 */
const overlayState = (page: Page, name: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return "not in the document";

    let opacity = 1;
    for (
      let node: Element | null = el;
      node && node !== document.documentElement;
      node = node.parentElement
    ) {
      opacity *= Number(getComputedStyle(node).opacity);
    }

    const r = el.getBoundingClientRect();
    const [vw, vh] = [window.innerWidth, window.innerHeight];
    const problems: string[] = [];

    if (opacity < 1) problems.push(`effective opacity ${opacity.toFixed(3)}`);
    // 1px of slack for subpixel layout, and nothing more: the failure this
    // catches is off by thousands of pixels, never by one.
    if (r.top < -1 || r.bottom > vh + 1 || r.left < -1 || r.right > vw + 1) {
      problems.push(
        `box ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(
          r.height
        )} is outside the ${vw}x${vh} viewport`
      );
    }

    return problems.length ? problems.join("; ") : "open";
  }, dialogSelector(name));

/**
 * The gate every spec that opens an overlay should use.
 *
 * Polled because both overlays animate in on an opacity and `y` offset and the
 * subject is where they come to rest. Polling costs no strength here: neither
 * defect above ever converges — a held feature chunk pins opacity at 0 for as
 * long as it is held, and a `fixed` element resolving against the document is
 * thousands of pixels out and stays there. (`e2e/overlay-motion-late.spec.ts`
 * still re-reads after a pause for the chunk-in-flight window specifically,
 * where "settles" is the thing in question.)
 *
 * `toBeVisible()` is kept as well, and is not redundant: a `display:none`
 * element has a zero-sized box at 0,0, which is opaque and inside the viewport.
 */
export async function expectOverlayOpen(page: Page, name: string) {
  await expect(page.getByRole("dialog", { name })).toBeVisible();
  await expect
    .poll(() => overlayState(page, name), {
      message: `the "${name}" overlay is open but the reader cannot see it`,
    })
    .toBe("open");
}

/**
 * Unmounted, not merely dropped from the accessibility tree — see
 * `dialogSelector`. Getting this wrong let a following action race the close:
 * the `getByRole` version of the breakpoint gate in `overlay-a11y` was ~50%
 * flaky under two-worker contention while passing 22/22 alone.
 */
export const expectOverlayClosed = (page: Page, name: string) =>
  expect(page.locator(dialogSelector(name))).toHaveCount(0);

/* ---------- Mobile menu ---------- */

/** Opens the mobile menu and gates on it being genuinely on screen. */
export async function openMobileMenu(page: Page) {
  await page.getByText("[menu]").click();
  await expectOverlayOpen(page, SITE_MENU);
}

/* ---------- Terminal overlay: opening it without racing hydration ---------- */

export const TERMINAL_TOGGLE = 'button[title="Open terminal (Ctrl+K)"]';

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
  await expectOverlayOpen(page, TERMINAL_DIALOG);
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
  // Unmounted, not just invisible: callers go on to click things, and an
  // exiting `fixed inset-0` layer that is still in the document eats the tap.
  await expectOverlayClosed(page, TERMINAL_DIALOG);
}
