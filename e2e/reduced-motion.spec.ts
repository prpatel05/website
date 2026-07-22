import { test, expect, type Page } from "./fixtures";

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
});
