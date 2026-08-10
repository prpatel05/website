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

  test("Back out of a post returns the reader into the archive, not to its top", async ({
    page,
  }) => {
    await page.goto("/blog/");

    const link = page.locator('a[href^="/blog/"]').last();
    await link.scrollIntoViewIfNeeded();
    const left = await scrollY(page);
    expect(left).toBeGreaterThan(1000);

    await link.click();
    await page.waitForURL(/\/blog\/.+\//);

    // Same document throughout — a client-side Back runs no init script, so the
    // sampler is restarted here instead.
    await restartTracer(page);
    await page.goBack();
    await page.waitForTimeout(2500);

    // Deliberately not `left` exactly. The archive's lower cards are not laid
    // out at the moment the browser restores, so it clamps to the shorter
    // document and the reader lands short — 8353 against a 9386 target on
    // Pixel 5, with the document growing back to 10084 once images arrive.
    // That gap is its own defect and its own fix. What this pins is that the
    // reset no longer races the restore and drops the reader at the top.
    const floor = left / 2;
    const trace = await readTrace(page, floor);

    expect(trace.samples, "the scroll tracer did not run").toBeGreaterThan(10);
    expect(trace.restored, "Back never restored into the archive").toBe(true);

    expect(
      trace.lowestAfterRestore,
      "Back restored into the archive and was then reset to the top"
    ).toBeGreaterThanOrEqual(floor);
  });
});
