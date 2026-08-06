import { test, expect } from "./fixtures";

/**
 * The skip link previously pointed at a `<main>` that wrapped the whole router,
 * so every page's `<nav>` rendered *inside* the thing being skipped to. The link
 * existed, was announced, and bypassed nothing — activating it left the next Tab
 * on the navbar, exactly where it already was.
 *
 * These tests assert the behaviour (where focus actually lands), not the markup,
 * because the markup is what was wrong while looking right.
 */

const ROUTES = ["/", "/blog/", "/blog/agents-fail-quietly/"];

test.describe("Skip to main content", () => {
  for (const route of ROUTES) {
    test(`moves focus past the navigation on ${route}`, async ({ page }) => {
      await page.goto(route);

      // The skip link is the first thing in the tab order.
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to main content" });
      await expect(skip).toBeFocused();

      await page.keyboard.press("Enter");

      // Focus must land on <main> itself. This is what tabIndex={-1} buys: without
      // it Safari leaves focus on the link and only scrolls.
      const focusedId = await page.evaluate(() => document.activeElement?.id);
      expect(focusedId).toBe("main-content");

      // The real assertion: the next Tab must NOT land inside the nav. Before the
      // fix it landed on the navbar's first link, because the nav was inside main.
      await page.keyboard.press("Tab");
      const landedInNav = await page.evaluate(() => {
        const el = document.activeElement;
        return !!el && !!el.closest("nav");
      });
      expect(landedInNav).toBe(false);

      // ...and it must be inside main, i.e. it skipped forward rather than nowhere.
      const landedInMain = await page.evaluate(() => {
        const el = document.activeElement;
        return !!el && !!el.closest("main#main-content");
      });
      expect(landedInMain).toBe(true);
    });
  }

  test("exposes exactly one main landmark, with nav and footer outside it", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator("main#main-content")).toHaveCount(1);

    // A <footer> scoped inside <main> loses its implicit contentinfo role, so the
    // page would expose no contentinfo landmark at all.
    const nesting = await page.evaluate(() => {
      const main = document.querySelector("main#main-content");
      return {
        navInsideMain: !!main?.querySelector("nav"),
        footerInsideMain: !!main?.querySelector("footer"),
        footerExists: !!document.querySelector("footer"),
      };
    });

    expect(nesting.navInsideMain).toBe(false);
    expect(nesting.footerInsideMain).toBe(false);
    expect(nesting.footerExists).toBe(true);

    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await expect(page.getByRole("navigation")).not.toHaveCount(0);
  });
});
