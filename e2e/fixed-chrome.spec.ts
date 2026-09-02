import { test, expect, proveReactIsLive, type Page } from "./fixtures";

/**
 * Everything on the site that claims to be `position: fixed`, measured against
 * the viewport.
 *
 * The defect these exist for is a containing block, not a style: an ancestor with
 * a `filter`/`transform`/`backdrop-filter`/`contain`/`will-change` anchors its
 * `fixed` descendants to *itself* instead of the viewport, and every declared
 * `top`/`bottom`/`inset` then resolves against the document. `PageTransition`
 * shipped `filter: blur(0px)` on the page wrapper, so the navbar scrolled away
 * with the page (`top=-1000` at a scroll of 1000), the terminal toggle lived
 * ~3760px down the document, and the mobile menu overlay measured 375x4779 with
 * its links at y=2273.
 *
 * None of that is reachable through `toBeVisible()`, which asks for a non-empty
 * box and not `visibility:hidden` and nothing about *where* the box is — all four
 * menu links were "visible" 2273px below the fold. So these read geometry.
 */
const rect = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`${sel} not found`);
    const { top, bottom, height } = el.getBoundingClientRect();
    return { top: Math.round(top), bottom: Math.round(bottom), height: Math.round(height) };
  }, selector);

/**
 * Read from the page, not from `page.viewportSize()`. Under mobile emulation
 * those disagree — Pixel 5 reports a configured 727 against an `innerHeight` of
 * 751 — and a `fixed bottom-*` element resolves against the one the browser
 * actually has.
 */
const viewportHeight = (page: Page) => page.evaluate(() => window.innerHeight);

const scrollTo = async (page: Page, y: number) => {
  await page.evaluate((target) => window.scrollTo(0, target), y);
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(y);
};

test.describe("Fixed chrome tracks the viewport", () => {
  for (const route of ["/", "/blog/"]) {
    test(`the navbar stays at the top of the viewport on ${route}`, async ({ page }) => {
      await page.goto(route);
      expect(await rect(page, "nav")).toMatchObject({ top: 0 });

      // Two scrolls, because one is satisfied by an element that happens to
      // start at 0 and never moves for the wrong reason.
      await scrollTo(page, 600);
      expect(await rect(page, "nav"), "navbar scrolled away with the page").toMatchObject({
        top: 0,
      });
      await scrollTo(page, 1400);
      expect(await rect(page, "nav")).toMatchObject({ top: 0 });
    });
  }

  /**
   * Polled, because both of these elements animate in on a `y` offset and the
   * assertion is about where they come to rest. Polling costs nothing in
   * strength here: the failure it guards is a fixed element resolving against
   * the document, which is off by thousands of pixels and never converges.
   * Reported as a string so the last measurement survives into the message.
   */
  const settlesInsideViewport = (page: Page, selector: string) =>
    expect
      .poll(async () => {
        const viewport = await viewportHeight(page);
        const { top, bottom } = await rect(page, selector);
        return top >= 0 && bottom <= viewport
          ? "inside"
          : `top=${top} bottom=${bottom} viewport=${viewport}`;
      })
      .toBe("inside");

  test("the terminal toggle sits above the bottom of the viewport", async ({ page }) => {
    await page.goto("/");
    const toggle = 'button[title="Open terminal (Ctrl+K)"]';

    // `fixed bottom-6` — 24px up from the bottom edge, wherever the reader is.
    await settlesInsideViewport(page, toggle);
    const viewport = await viewportHeight(page);
    const atRest = await rect(page, toggle);
    expect(atRest.bottom).toBeGreaterThan(viewport - 100);

    // The invariant that actually separates fixed-to-viewport from
    // fixed-to-document, and the one that does not depend on any emulated
    // viewport arithmetic: scrolling must not move it at all.
    await scrollTo(page, 1000);
    expect(await rect(page, toggle), "the toggle moved when the page did").toEqual(atRest);
  });

  test("the terminal dialog opens inside the viewport, not down the document", async ({ page }) => {
    await page.goto("/");
    await proveReactIsLive(page);
    await scrollTo(page, 1000);

    await page.keyboard.press("Control+k");
    await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();

    // Pin the scroll first, or the two defects hide each other and this test
    // reads as passing against the broken build: with the dialog laid out at the
    // bottom of the document, focusing the command input inside it made Chrome
    // scroll the document to ~3800 to reveal it — which drags the dialog into
    // the viewport and satisfies the assertion below. Measured: this line is the
    // only thing that fails there.
    expect(
      await page.evaluate(() => Math.round(window.scrollY)),
      "opening the terminal moved the page"
    ).toBe(1000);

    await settlesInsideViewport(page, '[role="dialog"][aria-label="Interactive terminal"]');
  });

  test.describe("mobile menu", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("the overlay is the size of the viewport and its links are on screen", async ({
      page,
    }) => {
      await page.goto("/");
      // Deliberately the weak `toBeVisible()` gate and not `openMobileMenu`.
      // The shared gate in ./fixtures now measures this same geometry, so
      // opening with it would fail *there* and leave the assertions below
      // never reached — this file is where the failure should be reported,
      // with the numbers.
      await page.getByText("[menu]").click();
      await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();

      const overlay = await rect(page, '[role="dialog"][aria-label="Site menu"]');
      expect(overlay, "overlay is not viewport-sized").toMatchObject({
        top: 0,
        height: await viewportHeight(page),
      });

      // The assertion `toBeVisible()` cannot make. Every link, in the viewport.
      for (const name of ["about()", "writing()", "contact()", "resume()"]) {
        await expect(page.getByRole("link", { name })).toBeInViewport();
      }
    });
  });
});
