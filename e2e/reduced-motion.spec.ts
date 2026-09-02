import { test, expect, openTerminalByClick, type Page } from "./fixtures";

/**
 * The parallax layer behind the hero. It is the load-bearing case: its offset
 * comes from a scroll-linked motion value written straight into `style`, which
 * `MotionConfig reducedMotion="user"` does not govern — only `useParallax`
 * does. If that hook regresses, this is the element that starts moving again.
 */
const heroBackdrop = "section .absolute.inset-0.overflow-hidden";
const roleLine = "span.text-foreground\\/80";

/**
 * The preference is set per page rather than with `test.use({ reducedMotion })`:
 * the context option does not reach the browser here (`matchMedia` still reads
 * `false` inside the test), so a spec written that way would assert against a
 * visitor who never asked for reduced motion and pass no matter what the site
 * does. `emulateMedia` sets it for real.
 */
const load = async (page: Page, reducedMotion: "reduce" | "no-preference") => {
  await page.emulateMedia({ reducedMotion });
  await page.goto("/");
};

const backdropTransform = (page: Page) =>
  page
    .locator(heroBackdrop)
    .first()
    .evaluate((el) => getComputedStyle(el).transform);

/** The hero column that carries the scroll-linked fade. */
const heroColumn = "section .container.relative.z-10";

const heroColumnOpacity = (page: Page) =>
  page
    .locator(heroColumn)
    .first()
    .evaluate((el) => getComputedStyle(el).opacity);

const scrollPastTheFold = async (page: Page) => {
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(600);
};

test.describe("prefers-reduced-motion", () => {
  test("the hero backdrop does not parallax when the visitor asks for less motion", async ({
    page,
  }) => {
    await load(page, "reduce");
    await scrollPastTheFold(page);

    expect(await backdropTransform(page)).toBe("none");
  });

  test("the role line arrives typed instead of typing forever", async ({ page }) => {
    await load(page, "reduce");

    await expect(page.locator(roleLine).first()).toHaveText("CTO & Chief Architect");
  });

  test("the hero backdrop still parallaxes by default", async ({ page }) => {
    await load(page, "no-preference");
    await scrollPastTheFold(page);

    expect(await backdropTransform(page)).not.toBe("none");
  });

  /**
   * The scroll-linked fade on the hero column — h1, role line, both CTAs and
   * the portrait. It is a second scroll-bound value in the same component as
   * the backdrop above, and it was the one that never went through
   * `useParallax`, so it kept fading for reduced-motion readers after the
   * parallax had been fixed. Asserted with its own default-preference control,
   * because "opacity is 1" is also what a hero that never faded would report.
   */
  test("the hero column does not fade out when the visitor asks for less motion", async ({
    page,
  }) => {
    await load(page, "reduce");
    await scrollPastTheFold(page);

    expect(await heroColumnOpacity(page)).toBe("1");
  });

  test("the hero column still fades by default", async ({ page }) => {
    await load(page, "no-preference");
    await scrollPastTheFold(page);

    expect(parseFloat(await heroColumnOpacity(page))).toBeLessThan(1);
  });

  /**
   * The imperative third of the contract. The two halves above are declarative
   * — the `@media` block in `index.css` and `MotionConfig reducedMotion="user"`
   * — and neither governs a `scrollIntoView`. The terminal's `contact` command
   * hardcoded `behavior: "smooth"` and animated the document 3112px through 56
   * intermediate positions for a reader who had asked for less, in a sample
   * sequence identical to the one without the preference. The nav's own
   * `#contact` link reached the same section in 2 samples the whole time, so
   * the two paths to one place disagreed (PRA-941).
   */
  const RECORD_SCROLL = () => {
    const w = window as unknown as { __scrollY: number[] };
    w.__scrollY = [];
    const tick = () => {
      w.__scrollY.push(Math.round(window.scrollY));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /**
   * Runs `contact` in the terminal and reports how many distinct scroll
   * positions the document passed through on the way.
   *
   * Sampled every frame from document start rather than polled: an animated
   * scroll and a jump differ only in their intermediate frames, and
   * `expect.poll` passes on its first satisfying sample, so it would read the
   * settled position of both and call them the same. The recorder has to be
   * running before the scroll begins.
   */
  const scrollStopsForTerminalContact = async (
    page: Page,
    reducedMotion: "reduce" | "no-preference",
  ) => {
    await page.emulateMedia({ reducedMotion });
    await page.addInitScript(RECORD_SCROLL);
    await page.goto("/");
    // The click path, not Ctrl+K: a bare keypress races hydration.
    await openTerminalByClick(page);

    await page.getByPlaceholder('type "help" to get started...').fill("contact");
    // Cleared after opening, so the toggle click's own scrolling — Playwright
    // scrolls the document to reach a target, even a `fixed` one — is not
    // counted as motion the command caused.
    await page.evaluate(() => {
      (window as unknown as { __scrollY: number[] }).__scrollY.length = 0;
    });
    await page.keyboard.press("Enter");

    // The command defers 300ms for the close animation before it scrolls at
    // all, then a smooth scroll of this distance runs well under a second.
    await page.waitForTimeout(2000);

    const samples = await page.evaluate(
      () => (window as unknown as { __scrollY: number[] }).__scrollY,
    );
    return { stops: new Set(samples).size, landedAt: samples[samples.length - 1] };
  };

  test("the terminal jumps to a section instead of animating the whole page there", async ({
    page,
  }) => {
    const { stops, landedAt } = await scrollStopsForTerminalContact(page, "reduce");

    // Two: where it started and where it ended. Anything above single digits is
    // a rendered animation, not the tail of one instant scroll.
    expect(stops).toBeLessThanOrEqual(3);
    // Without this the test also passes if the command stopped navigating at
    // all — one stop, no motion, and a reader who never reaches `#contact`.
    expect(landedAt).toBeGreaterThan(1000);
  });

  test("the terminal still animates its way to a section by default", async ({ page }) => {
    const { stops, landedAt } = await scrollStopsForTerminalContact(page, "no-preference");

    expect(stops).toBeGreaterThan(10);
    expect(landedAt).toBeGreaterThan(1000);
  });
});
