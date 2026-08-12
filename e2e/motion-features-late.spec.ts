import { test, expect } from "./fixtures";

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
const heading = (page: import("@playwright/test").Page) =>
  page.getByRole("heading", { level: 1, name: "Blog archive" });

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

    await blogLink(page).click();
    await expect(page).toHaveURL(/\/blog\/$/);

    // Sampled immediately after the click: with features loaded the entrance
    // runs, so the incoming route starts transparent and is opaque by the time
    // it settles. Both ends are asserted so a build where the animation
    // silently stopped running is not mistaken for a passing one.
    const sawTransparent = await heading(page)
      .evaluate(
        (el) =>
          new Promise<boolean>((resolve) => {
            const ancestors: Element[] = [];
            for (
              let node: Element | null = el;
              node && node !== document.documentElement;
              node = node.parentElement
            ) {
              ancestors.push(node);
            }
            const transparent = () =>
              ancestors.some(
                (node) => Number(getComputedStyle(node).opacity) < 1
              );

            let seen = transparent();
            const started = performance.now();
            const tick = () => {
              seen ||= transparent();
              if (seen || performance.now() - started > 400) return resolve(seen);
              requestAnimationFrame(tick);
            };
            tick();
          })
      );

    expect(
      sawTransparent,
      "the entrance animation never ran — the feature chunk loaded but nothing is animating"
    ).toBe(true);
    await expect
      .poll(() => effectiveOpacity(page), { timeout: 2000 })
      .toBe(1);
  });
});
