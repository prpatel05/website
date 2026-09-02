import { test, expect, type Page } from "./fixtures";

/**
 * The hero fade has to spend itself over the hero's own height, on the arrival
 * a reader actually gets by clicking `cd ~` from a post.
 *
 * Two defects hid behind each other here, and neither is visible on a fresh
 * load (PRA-979):
 *
 * - `useScroll({ target })` marks its progress accelerable, and an array-range
 *   `useTransform` off it hands the opacity to a native scroll-linked
 *   animation. Which timeline it gets depends on whether the target ref was
 *   populated when framer built it: a `ViewTimeline` over the section on a
 *   fresh load, but a document-wide `ScrollTimeline` on a client-side arrival.
 *   The fade then ran over the document's ~4000px instead of the section's
 *   ~850, leaving the hero ~75% opaque where the design has it gone.
 * - Underneath that, the shared `opacity` MotionValue was being zeroed at mount
 *   by the `initial` of the two sibling elements that also bind it, so the JS
 *   value was pinned at 0 the whole time. The native animation painted over it,
 *   which is the only reason nobody saw a blank hero.
 *
 * So this asserts both ends of the range against the *section*, not the
 * document: fully painted at the top, fully gone by the time the section's own
 * range is spent. Fixing only the timeline turns the first assertion red;
 * fixing only the clobber turns the second one red.
 */

const HERO_COLUMN = "section.grid-bg > .container";

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((res) =>
        requestAnimationFrame(() => requestAnimationFrame(() => res())),
      ),
  );
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await settle(page);
}

async function heroOpacity(page: Page): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return -1;
    // Computed, not inline: the value that was actually painted is the whole
    // question here — an inline reading agrees with a native scroll animation
    // only by accident.
    return Number(getComputedStyle(el).opacity);
  }, HERO_COLUMN);
}

/** Arrive at "/" the way the defect requires — a client-side navigation. */
async function navigateToHome(page: Page) {
  await page.goto("/blog/");
  const home = page.getByRole("link", { name: "cd ~" });
  await expect(home).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __sameDocument: boolean }).__sameDocument = true;
  });
  await home.click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
  await expect(page.locator(HERO_COLUMN)).toHaveCount(1);

  const sameDocument = await page.evaluate(
    () =>
      (window as unknown as { __sameDocument?: boolean }).__sameDocument === true,
  );
  expect(
    sameDocument,
    "expected a client-side navigation — a reload puts the hero back on the path where both defects are invisible",
  ).toBe(true);
  await settle(page);
}

test.describe("hero fade range on a client-side arrival", () => {
  test("the fade spends itself over the hero section, not the document", async ({
    page,
  }) => {
    await navigateToHome(page);

    const { sectionHeight, scrollMax } = await page.evaluate(() => {
      const sec = document.querySelector("section.grid-bg") as HTMLElement;
      return {
        sectionHeight: sec.getBoundingClientRect().height,
        scrollMax: document.documentElement.scrollHeight - window.innerHeight,
      };
    });

    // The defect is only meaningful if the document is much taller than the
    // hero — that gap is what the fade was wrongly spread across.
    expect(
      scrollMax,
      "the document should be far taller than the hero for this to distinguish the two ranges",
    ).toBeGreaterThan(sectionHeight * 2);

    await scrollTo(page, 0);
    expect(
      await heroOpacity(page),
      "the hero is fully painted at the top of its own section; a 0 here is the shared fade value being zeroed by a sibling's entrance",
    ).toBeGreaterThan(0.99);

    // `fade` is [0, 0.8] of the section's range, so it is spent by 80% of the
    // section's height. Measured against the section, this is gone; measured
    // against the document it is still ~75% opaque.
    const spent = Math.round(sectionHeight * 0.8);
    await scrollTo(page, spent);
    expect(
      await heroOpacity(page),
      `the hero should be gone once its own fade range is spent (scrollY=${spent}); a partial value here means the fade is bound to the document`,
    ).toBeLessThan(0.01);
  });

  test("the fade is live, and passes through the middle of its range", async ({
    page,
  }) => {
    await navigateToHome(page);

    const sectionHeight = await page.evaluate(
      () =>
        (
          document.querySelector("section.grid-bg") as HTMLElement
        ).getBoundingClientRect().height,
    );

    // Positive control for the test above: an element pinned at 0 or at 1 for
    // the whole walk satisfies one of those assertions without ever being a
    // fade. Catch it partway through instead.
    const midway = Math.round(sectionHeight * 0.4);
    await scrollTo(page, midway);
    const opacity = await heroOpacity(page);

    expect(
      opacity,
      `the hero should be partly faded halfway through its range (scrollY=${midway}), not pinned`,
    ).toBeGreaterThan(0.05);
    expect(opacity).toBeLessThan(0.95);
  });
});
