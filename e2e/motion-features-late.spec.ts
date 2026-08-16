import { test, expect } from "./fixtures";
import { settleFrames } from "./frame-time";

/**
 * The entrance is 500ms (`PageTransition`'s `pageVariants`). This is that plus
 * room for the frame the completion lands on — denominated in frames the page
 * produced, so it is the time the animation actually receives.
 */
const ENTRANCE_SETTLE_MS = 800;

/**
 * The animation feature set loads from its own chunk (src/lib/motion-features),
 * so there is a window between hydration and that chunk landing. Inside it `m`
 * renders but cannot run a variant, so an entrance would write `opacity: 0`
 * into the incoming route's inline style with nothing loaded to clear it.
 *
 * That is why `useEntrance` waits on `motion-ready` as well as on first load.
 * Without it, moving the features off the critical path would have bought 11 KB
 * by trading a blank page for it — which is what the first test here caught
 * before the flag existed. It holds the chunk open across a navigation and
 * asserts the page is readable anyway.
 */

const FEATURES_CHUNK = /\/assets\/motion-features-[^/]*\.js$/;

// The nav is terminal-styled: the link to the archive reads `ls ./posts`, so
// there is no link whose accessible name is "Blog". Matching on the href keeps
// a copy change from silently turning the click into a no-op and leaving the
// assertions below to run against the homepage.
const blogLink = (page: import("@playwright/test").Page) =>
  page.locator('a[href="/blog/"]').first();

/**
 * Everything below is measured from the archive's own heading rather than from
 * `#main-content`, and both details are load-bearing.
 *
 * **Which route.** `AnimatePresence` keeps the outgoing route mounted while it
 * plays its exit, so during the swap two `<main>`s are attached and a bare
 * `#main-content` can resolve to the homepage on its way out. An earlier draft
 * of the second test passed against a build with the entrance disabled outright,
 * because what it had watched fade was the old page leaving. A heading only the
 * archive has cannot resolve to anything but the route being navigated to.
 *
 * **Which element.** The entrance is animated on `PageTransition`'s wrapper,
 * several levels above `<main>`, which stays at `opacity: 1` the whole time. So
 * visibility is the product of the whole ancestor chain, not one element's
 * opacity.
 */
const ARCHIVE_HEADING = "Blog archive";

const heading = (page: import("@playwright/test").Page) =>
  page.getByRole("heading", { level: 1, name: ARCHIVE_HEADING });

const effectiveOpacity =(page: import("@playwright/test").Page) =>
  heading(page).evaluate((el) => {
    if (!document.body.contains(el)) {
      // `getComputedStyle` on a removed node returns "" for every property, and
      // `Number("")` is 0 — indistinguishable from a genuinely invisible page.
      // Throwing turns that into a retry rather than a false failure.
      throw new Error("the heading is detached — nothing to measure yet");
    }

    let opacity = 1;
    for (
      let node: Element | null = el;
      node && node !== document.documentElement;
      node = node.parentElement
    ) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  });

/**
 * The incoming route's mount, recorded from before the navigation starts.
 *
 * The entrance is 500ms and `AnimatePresence` is `mode="wait"`, so it does not
 * begin until the outgoing route's 300ms exit is done. Sampling for a
 * transparent moment *after* the click therefore has to win a race against
 * both: click, `toHaveURL`, and resolving a locator are CDP round trips, and
 * whatever is left of the 500ms when they finish is all the sampler gets.
 * Measured on an otherwise idle machine, the sampler this replaced started
 * 886ms after the click on `mobile-chrome` and read an effective opacity of
 * **0.99897** — it was catching the entrance with 0.1% of its range left. One
 * busier machine and the first sample reads exactly 1, at which point a working
 * animation is reported as "the entrance never ran". That is the flake, and
 * raising a timeout cannot fix it: the sampler is chasing a window that has
 * already closed.
 *
 * What is not a race is the mount itself. framer writes `initial` into the
 * inline style of the element it renders, so the wrapper enters the document
 * already carrying `opacity: 0` — and a `MutationObserver` childList record is
 * delivered as a microtask after the insertion, not on a frame. It cannot be
 * missed by a busy machine, and it does not keep frames coming the way a
 * pending `requestAnimationFrame` does, so it measures the page rather than the
 * instrument.
 *
 * Deliberately *not* asserted: that opacity passes through some intermediate
 * value. framer steps a tween from `requestAnimationFrame` and headless
 * Chromium intermittently stops producing frames, so a stall can take the
 * inline style straight from 0 to 1 with nothing written in between. That is
 * the same wall-clock-versus-frame-time trap this test just came out of.
 */
const recordRouteMount = (page: import("@playwright/test").Page, name: string) =>
  page.evaluate((headingName) => {
    const mounts: { inlineOpacity: string; holdsTheHeading: boolean }[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          mounts.push({
            inlineOpacity: node.style.opacity,
            // Guards against an unrelated element that happens to mount
            // transparent standing in for the route. React builds a subtree
            // before attaching it, so the heading is already inside the
            // wrapper by the time the insertion is reported.
            holdsTheHeading: Array.from(node.querySelectorAll("h1")).some(
              (h1) => h1.textContent?.trim() === headingName
            ),
          });
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    Object.assign(window, { __routeMounts: { mounts, observer } });
  }, name);

const readRouteMounts = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const recorded = (
      window as unknown as {
        __routeMounts?: {
          mounts: { inlineOpacity: string; holdsTheHeading: boolean }[];
          observer: MutationObserver;
        };
      }
    ).__routeMounts;
    if (!recorded) throw new Error("the mount recorder was never installed");
    recorded.observer.disconnect();
    return recorded.mounts;
  });

test.describe("motion features arriving late", () => {
  test("a client-side navigation is readable while the feature chunk is still in flight", async ({
    page,
  }) => {
    let released: () => void = () => {};
    const hold = new Promise<void>((resolve) => {
      released = resolve;
    });

    let heldTheChunk = false;
    await page.route(FEATURES_CHUNK, async (route) => {
      heldTheChunk = true;
      await hold;
      await route.continue();
    });

    await page.goto("/");
    // .click() waits out hydration; a bare goto would race it.
    await blogLink(page).click();

    await expect(page).toHaveURL(/\/blog\/$/);
    await expect(heading(page)).toBeAttached();

    // Positive control: without this the test would pass against a build that
    // never split the chunk out at all, which is the failure it exists to catch.
    expect(
      heldTheChunk,
      "no request for motion-features-*.js — the chunk is not being loaded lazily, so this test proved nothing"
    ).toBe(true);

    // Polled rather than read once so a locator that still resolves to the
    // outgoing route retries instead of flaking. It does not soften the
    // assertion: the defect is a page pinned at 0 for as long as the chunk is
    // held, which is every attempt, so the poll runs out. Measured a second
    // time after it settles because with the features held there is nothing to
    // animate — the page has to be opaque from its first frame to its last.
    await expect
      .poll(() => effectiveOpacity(page), {
        message:
          "the navigated-to page is transparent while the feature chunk is blocked",
      })
      .toBe(1);
    await page.waitForTimeout(500);
    expect(
      await effectiveOpacity(page),
      "the page went transparent again while the feature chunk stayed blocked"
    ).toBe(1);

    released();
  });

  /**
   * The chunk that never lands at all — the deploy case rather than the slow
   * network one. Pages replaces `dist/` wholesale, so a tab open across a
   * deploy asks for a hash that is gone.
   *
   * `LazyMotion` calls the loader from a mount effect and attaches no rejection
   * handler of its own, so the rejection escaped as an uncaught `pageerror`
   * that stayed for the life of the page. It broke nothing the reader could
   * see, which is exactly the problem: a permanent false positive lying in wait
   * for any error reporting this site ever adds, on a page that is working.
   */
  test("a feature chunk that never arrives is not an uncaught error", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    let blocked = 0;
    await page.route(FEATURES_CHUNK, (route) => {
      blocked += 1;
      // Gone, not slow: the hash this tab remembers is not in the live dist.
      return route.abort("failed");
    });

    await page.goto("/");
    await blogLink(page).click();
    await expect(page).toHaveURL(/\/blog\/$/);

    // The reader's half, unchanged: with the features never arriving the
    // entrance stays suppressed and the page is readable. Asserted here too, so
    // a clean error log cannot come from a page that rendered nothing.
    await expect.poll(() => effectiveOpacity(page)).toBe(1);

    expect(
      blocked,
      "no request matched the feature chunk — nothing was ever failed, so this test proved nothing"
    ).toBeGreaterThan(0);
    // A dwell rather than a poll: the assertion is that nothing arrives, and a
    // poll for an empty array is satisfied by its first sample. The rejection
    // this catches lands within a frame of the abort, which is already several
    // seconds behind by here; the pause is slack, not the mechanism.
    await page.waitForTimeout(500);
    expect(
      pageErrors,
      "the failed feature chunk escaped as an uncaught error"
    ).toEqual([]);
  });

  test("the entrance still animates once the chunk has landed", async ({
    page,
  }) => {
    // Armed before the navigation, not after: the chunk is requested during the
    // first load, so a wait registered once `goto` resolves is waiting for a
    // response that has already come and gone.
    const chunkLanded = page.waitForResponse(FEATURES_CHUNK);
    await page.goto("/");
    await chunkLanded;

    // Armed before the click, so there is no window to lose: the recorder is
    // already watching when the route it is there to catch mounts.
    await recordRouteMount(page, ARCHIVE_HEADING);

    await blogLink(page).click();
    await expect(page).toHaveURL(/\/blog\/$/);
    await expect(heading(page)).toBeAttached();

    const mounts = await readRouteMounts(page);
    const route = mounts.find((mount) => mount.holdsTheHeading);

    // Positive control. Without it every assertion below is vacuous against a
    // build where the navigation never mounted the archive at all.
    expect(
      route,
      `nothing carrying an <h1> of "${ARCHIVE_HEADING}" was attached during the navigation — the recorder saw ${mounts.length} insertion(s) and none of them was the route`
    ).toBeDefined();

    // Both ends of the entrance, so a build where the animation silently
    // stopped running is not mistaken for a passing one. This end is the half
    // that used to be raced: the route has to arrive transparent...
    //
    // Read as a string first. A suppressed entrance writes no inline opacity
    // at all, and `Number("")` is 0 — so comparing the number alone would take
    // the build with no animation whatsoever for the most transparent mount
    // there is, and pass hardest exactly where it should fail.
    expect(
      route?.inlineOpacity,
      "the archive mounted with no inline opacity — `initial` was never written, so the entrance is suppressed rather than running"
    ).not.toBe("");
    expect(
      Number(route?.inlineOpacity),
      "the archive mounted opaque — the feature chunk loaded but the entrance is not running"
    ).toBeLessThan(1);
    // ...and something has to clear it, which is the defect the first test in
    // this file covers from the other direction.
    //
    // Settled in frame time rather than by polling against a wall-clock
    // timeout, for the same reason the mount above is observed rather than
    // sampled. The 500ms entrance advances only in frames the page produced,
    // and under contention this poll's 2000ms of wall clock bought it far
    // fewer: measured here at 12-way CPU load, it timed out reading **0.459**
    // — an animation that was running correctly and simply had not been given
    // its 500ms. Raising the timeout does not fix that and stays wrong.
    await settleFrames(page, ENTRANCE_SETTLE_MS);
    expect(
      await effectiveOpacity(page),
      "the entrance started but never finished — the archive is still transparent after a full entrance of frame time"
    ).toBe(1);
  });
});
