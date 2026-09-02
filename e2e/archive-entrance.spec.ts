import { test, expect, type Page } from "./fixtures";

/**
 * The blog archive's entrance cascade, measured as time-to-readable.
 *
 * `Blog.tsx` staggered every card by its index over the full `posts` array. The
 * cost was linear in post count and the archive gains a post a week: at 23
 * posts the last card became readable 2987ms after a client-side navigation,
 * and `prefers-reduced-motion` bought nothing (2989ms) because
 * `reducedMotion="user"` drops the transform and keeps the fade.
 *
 * Two things about how this has to be tested.
 *
 * A direct `page.goto()` cannot observe any of it. That is the prerendered
 * first load, where `useEntrance` suppresses the entrance outright — the cards
 * mount already opaque, which is correct and is also why the old build passed
 * every existing archive test. The entrance only runs on a client-side
 * navigation, so these tests click their way in.
 *
 * And the assertions read computed opacity rather than `toBeVisible()`, which
 * calls an `opacity: 0` element visible and so passes against the broken build.
 */

/** Cards past this index mount already readable — see `STAGGERED_CARDS`. */
const STAGGERED_CARDS = 5;

/**
 * Ceiling on the spread between the first and last card becoming readable.
 *
 * The floor is arithmetic: cards past the cap mount opaque as soon as the
 * archive renders, and the last staggered card finishes `(STAGGERED_CARDS - 1)
 * * 0.1s` later plus its own `0.5s` — about 900ms. Measured 865ms, and 885ms
 * under `E2E_CPU_THROTTLE=6`: framer's delays are wall-clock, so a slow machine
 * barely moves this. The defect it has to catch sat at ~2200ms and climbed by
 * 100ms a week, so the gap is wide on both sides.
 */
const MAX_CASCADE_MS = 1500;

const CARD = "main article";

/** Reaches the archive the way a reader does: by clicking, from a post. */
async function navigateToArchive(page: Page) {
  await page.goto("/blog/ai-made-bugs-cheap-to-find/");
  // The entrance is also suppressed until the motion-features chunk lands, so
  // a click issued before then would measure the suppressed path and prove
  // nothing. Opening and closing nothing — just settling — is enough here.
  await page.waitForFunction(() => document.querySelector("main article") !== null);
  await page.waitForTimeout(1500);

  await page.locator('a[href="/blog/"]').first().click();
  await page.waitForURL(/\/blog\/$/);
}

/**
 * Records, per card, how long after `t0` it first reached full opacity.
 *
 * The sampler waits for the archive itself, rather than the caller counting
 * cards first: right after the click the DOM still holds the post page, so a
 * `locator.count()` there returns 1 and every later wait is against the wrong
 * total. Sampling has to be installed before the cards exist anyway, or the
 * first card's arrival is missed.
 */
async function timeToReadable(page: Page): Promise<number[]> {
  await page.evaluate((sel) => {
    const t0 = performance.now();
    const seen = new Map<number, number>();
    const w = window as unknown as { __seen: Map<number, number>; __raf: number };
    w.__seen = seen;

    const tick = () => {
      const cards = document.querySelectorAll(sel);
      // >1 distinguishes the archive from the single <article> the post page
      // we navigated away from still has on screen mid-transition.
      if (cards.length > 1) {
        cards.forEach((card, i) => {
          if (!seen.has(i) && Number(getComputedStyle(card).opacity) >= 0.99) {
            seen.set(i, Math.round(performance.now() - t0));
          }
        });
      }
      w.__raf = requestAnimationFrame(tick);
    };
    tick();
  }, CARD);

  // The archive has rendered and its length has settled.
  await page.waitForFunction(
    (sel) => document.querySelectorAll(sel).length > 5,
    CARD,
    { timeout: 20_000 }
  );
  const total = await page.locator(CARD).count();

  await page.waitForFunction(
    (n) => (window as unknown as { __seen: Map<number, number> }).__seen.size >= n,
    total,
    { timeout: 20_000 }
  );

  return page.evaluate(() => {
    const w = window as unknown as { __seen: Map<number, number>; __raf: number };
    cancelAnimationFrame(w.__raf);
    return [...w.__seen.entries()].sort((a, b) => a[0] - b[0]).map(([, ms]) => ms);
  });
}

const fadedCardsOnScreen = (page: Page) =>
  page.evaluate((sel) => {
    const vh = window.innerHeight;
    return [...document.querySelectorAll(sel)]
      .filter((card) => {
        const r = card.getBoundingClientRect();
        return r.bottom > 0 && r.top < vh;
      })
      .filter((card) => Number(getComputedStyle(card).opacity) < 0.5).length;
  }, CARD);

test.describe("blog archive entrance", () => {
  test("the whole archive is readable within one cascade, however long it gets", async ({
    page,
  }) => {
    await navigateToArchive(page);
    const readable = await timeToReadable(page);
    // The cap only means anything if there are cards past it to be capped.
    expect(readable.length).toBeGreaterThan(STAGGERED_CARDS);

    const spread = Math.max(...readable) - Math.min(...readable);

    /*
      The spread, not the absolute time: subtracting the first card removes the
      navigation, the chunk fetch and the page transition, leaving only what the
      stagger itself adds. That is the quantity the defect scales — it was
      ~2200ms (22 x 0.1s) at 23 posts and would keep climbing — and it is also
      the quantity that does not move when the machine running the test is slow,
      since framer's delays are wall-clock rather than CPU-bound.

      A regression to per-index staggering blows through the ceiling today and
      by more every week.
    */
    expect(spread, `time-to-readable per card (ms): ${readable.join(", ")}`).toBeLessThan(
      MAX_CASCADE_MS
    );
  });

  test("a reader who scrolls straight down lands on posts, not on blank space", async ({
    page,
  }) => {
    await navigateToArchive(page);

    // Immediately — before the cascade could have finished. This is the reader
    // -facing half of the defect: the page had full scroll height and five
    // cards on screen at opacity < 0.05.
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length > 5,
      CARD
    );
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    expect(await fadedCardsOnScreen(page)).toBe(0);
  });

  test("reduced motion does not wait out a cascade either", async ({ page }) => {
    /*
      `reducedMotion="user"` keeps opacity animations and only drops the
      transform, so this reader waited out the identical cascade — 2989ms
      against 2987ms. Asserted separately because it is the one case a reader
      explicitly asked to be spared.

      Emulated on the page rather than declared with `test.use({ reducedMotion })`:
      that option does not reach the browser here — `matchMedia` still reports
      false — so the spec would silently test the ordinary visitor twice. And
      going through the shared `page` keeps the telemetry-blocking fixture,
      which a hand-rolled `browser.newContext()` would bypass.
    */
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)
    ).toBe(true);

    await navigateToArchive(page);
    const readable = await timeToReadable(page);
    const spread = Math.max(...readable) - Math.min(...readable);
    expect(spread, `time-to-readable per card (ms): ${readable.join(", ")}`).toBeLessThan(
      MAX_CASCADE_MS
    );
  });

  /*
    Control. The prerendered first load must stay at a spread of ~0 — the
    entrance is suppressed there entirely. If this ever fails alongside the
    tests above, the probe has broken rather than the cascade: it would mean
    time-to-readable is measuring page load, not the animation.
  */
  test("control: the prerendered load has no cascade to wait for", async ({ page }) => {
    await page.goto("/blog/", { waitUntil: "commit" });
    const readable = await timeToReadable(page);
    const spread = Math.max(...readable) - Math.min(...readable);
    expect(spread, `time-to-readable per card (ms): ${readable.join(", ")}`).toBeLessThan(200);
  });
});
