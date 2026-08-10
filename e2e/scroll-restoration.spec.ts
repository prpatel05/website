import { test, expect, type Page } from "./fixtures";

/**
 * The reader's scroll position across the three navigations that have one.
 *
 * `ScrollToTop` in src/App.tsx used to reset on every pathname change, which
 * included the two the browser already handles: `history.scrollRestoration` is
 * `"auto"`, so on reload and on Back/Forward the browser restores the offset
 * the reader left, and the effect then threw it away.
 *
 * What the reader ends up seeing is a race, and that is why this file samples
 * instead of asserting on the settled value. Traced from document start on the
 * unfixed build, a reload of a post at 1500px went `0 → 1500` at 44ms as the
 * browser restored, `→ 0` at 53ms as the effect fired, and `→ 1500` at 105ms as
 * the browser restored a second time and won. On that machine the defect is a
 * 52ms flicker. Delay hydration past the browser's last restore attempt — a
 * slow phone, a cold cache — and the reset is the last writer instead, and the
 * reader is left at the title of an article they were halfway through. Both
 * branches were reachable in measurement.
 *
 * So the settled offset cannot tell the two builds apart, and an `expect.poll`
 * for the restored value passes against both — the first draft of this file did
 * exactly that and went green against a rebuilt, unfixed `dist/`. The reset
 * *running at all* is the deterministic signal, and the trace is what sees it:
 * once the offset has been restored, it must never drop again.
 *
 * `PUSH` is ours and still goes to the top, which is the regression the middle
 * test exists to catch: deleting the effect outright fixes reload and breaks
 * reading, and that build fails here.
 *
 * The Back test then asks the harder question the trace cannot: not whether
 * the offset survived, but whether it is the right one. It was not — the
 * browser restores into the outgoing post and clamps to that shorter document
 * — and `useScrollRestoration` is what corrects it. The `pagehide` half of
 * that hook is pinned in src/hooks/__tests__/useScrollRestoration.test.tsx
 * instead of here; the note there says why a reload cannot pin it.
 */

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

const maxScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

type Traced = { restored: boolean; lowestAfterRestore: number; samples: number };

/**
 * Installs a per-document `scrollY` sampler that starts before any app script.
 *
 * The window that matters opens the moment the browser restores and closes when
 * hydration's effects have run — a few dozen milliseconds, entirely before
 * `page.reload()` resolves. Nothing sampled from the Playwright side can see
 * it; the tracer has to already be running inside the document.
 */
async function installTracer(page: Page) {
  await page.addInitScript(() => {
    const samples: number[] = [];
    (window as unknown as { __scrollTrace: number[] }).__scrollTrace = samples;
    const start = performance.now();
    const tick = () => {
      samples.push(window.scrollY);
      if (performance.now() - start < 6000) requestAnimationFrame(tick);
    };
    tick();
  });
}

/** Restarts the sampler in the current document, for same-document navigations. */
const restartTracer = (page: Page) =>
  page.evaluate(() => {
    const samples: number[] = [];
    (window as unknown as { __scrollTrace: number[] }).__scrollTrace = samples;
    const start = performance.now();
    const tick = () => {
      samples.push(window.scrollY);
      if (performance.now() - start < 6000) requestAnimationFrame(tick);
    };
    tick();
  });

/**
 * Reads the trace as the one question worth asking: after the offset was first
 * restored, did anything put it back down?
 *
 * Every trace opens at 0 — the document genuinely starts unscrolled — so a
 * plain minimum is always 0 and says nothing. The floor only means something
 * once the restore has happened.
 */
const readTrace = (page: Page, floor: number): Promise<Traced> =>
  page.evaluate((limit) => {
    const samples = (window as unknown as { __scrollTrace: number[] }).__scrollTrace ?? [];
    const first = samples.findIndex((y) => y >= limit);
    return {
      restored: first !== -1,
      lowestAfterRestore: first === -1 ? -1 : Math.min(...samples.slice(first)),
      samples: samples.length,
    };
  }, floor);

/** A post long enough that a mid-article offset is unambiguous. */
const POST = "/blog/the-handoff-is-where-agents-break/";

test.describe("scroll position across navigations", () => {
  test("reload keeps the reader where they were in the post", async ({ page }) => {
    await installTracer(page);
    await page.goto(POST);

    // Deep enough to be well past the hero, and short of the end on both
    // projects — mobile-chrome lays the same body out taller, not shorter.
    const target = Math.min(1500, (await maxScroll(page)) - 100);
    expect(target).toBeGreaterThan(400);
    const floor = target - 100;

    await page.evaluate((y) => window.scrollTo(0, y), target);
    await expect.poll(() => scrollY(page)).toBe(target);

    await page.reload();
    // Outlast the browser's restore, hydration, and the effect behind it.
    await page.waitForTimeout(2500);

    const trace = await readTrace(page, floor);

    // Guards the guard: a tracer that never ran, or a browser that never
    // restored, would make the assertion below vacuously true.
    expect(trace.samples, "the scroll tracer did not run").toBeGreaterThan(10);
    expect(trace.restored, "the browser never restored the offset on reload").toBe(true);

    expect(
      trace.lowestAfterRestore,
      "the reader's offset was reset to the top after the reload restored it"
    ).toBeGreaterThanOrEqual(floor);
  });

  test("clicking through to a post starts at the top", async ({ page }) => {
    await page.goto("/blog/");

    // Scroll first: a PUSH from a scrolled page is the case that needs the
    // reset. Landing on a post already 9000px in is the defect this half owns.
    const link = page.locator('a[href^="/blog/"]').last();
    await link.scrollIntoViewIfNeeded();
    expect(await scrollY(page)).toBeGreaterThan(200);

    const href = await link.getAttribute("href");
    await link.click();
    await page.waitForURL(`**${href}`);

    await expect
      .poll(() => scrollY(page), { message: "a clicked link should open at the top" })
      .toBeLessThan(50);
  });

  test("Back out of a post returns the reader to the offset they left", async ({ page }) => {
    await page.goto("/blog/");

    // Reach the bottom, then leave from the second-to-last card. The target is
    // then strictly inside the document rather than equal to its maximum, so
    // "scroll to the bottom" is not a passing implementation.
    await page.locator('a[href^="/blog/"]').last().scrollIntoViewIfNeeded();
    const link = page.locator('a[href^="/blog/"]').nth(-2);

    // Read the offset from inside the click rather than before it: Playwright
    // scrolls an element into view as part of its actionability checks, so a
    // reading taken beforehand is not necessarily where the reader was when
    // the navigation started.
    await page.evaluate(() => {
      window.addEventListener(
        "click",
        () => {
          (window as unknown as { __leftAt: number }).__leftAt = window.scrollY;
        },
        { capture: true }
      );
    });

    await link.click();
    await page.waitForURL(/\/blog\/.+\//);
    // `waitForURL` resolves on the `pushState`, which happens before the route
    // has swapped. Landing at the top is what says the navigation is finished.
    await expect.poll(() => scrollY(page)).toBeLessThan(50);

    const left = await page.evaluate(() => (window as unknown as { __leftAt: number }).__leftAt);
    expect(left, "the reader was not deep enough in the archive to tell anything").toBeGreaterThan(
      1000
    );

    // The reader reads. This is not padding: `AnimatePresence mode="wait"`
    // holds the archive on screen through its exit, and the post's body
    // arrives after that, so a Back issued immediately traverses out of a
    // document that is still the *archive's* height — nothing to clamp to, and
    // the defect does not exist. Measured on the unfixed build, the gap is 0
    // at a 300ms dwell and 2034 from 600ms on.
    await page.waitForTimeout(1000);
    const postMax = await maxScroll(page);

    // Same document throughout — a client-side Back runs no init script, so the
    // sampler is restarted here instead.
    await restartTracer(page);
    await page.goBack();
    await page.waitForTimeout(2500);

    const floor = left / 2;
    const trace = await readTrace(page, floor);

    expect(trace.samples, "the scroll tracer did not run").toBeGreaterThan(10);
    expect(trace.restored, "Back never restored into the archive").toBe(true);

    expect(
      trace.lowestAfterRestore,
      "Back restored into the archive and was then reset to the top"
    ).toBeGreaterThanOrEqual(floor);

    // The exact offset, which the floor above deliberately could not see.
    //
    // The browser restores one frame after `popstate`, while the document on
    // screen is still the post, so it clamps to what that shorter page can
    // scroll: 7945 against a 9979 target on Pixel 5, with the archive mounting
    // ~300ms later and the offset staying where it was clamped.
    // `useScrollRestoration` re-applies the stored offset once the document is
    // tall enough to hold it. The tolerance is for layout rounding; unfixed,
    // this lands 2034px short.
    //
    // Which needs the post to be the shorter page, and on the desktop project
    // it is not: that archive is 3818px of scroll against posts of 3476-5221,
    // so the reader's deepest possible offset is one the post can hold and
    // there is no clamp to correct. Skipping says that out loud rather than
    // reporting a pass no build could fail.
    test.skip(
      postMax >= left,
      `no clamp on this viewport: the post scrolls ${postMax}px, past the ${left}px being restored`
    );

    await expect
      .poll(() => scrollY(page), {
        message: "Back landed short of where the reader left the archive",
      })
      .toBeGreaterThanOrEqual(left - 20);
  });
});
