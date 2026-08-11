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

  /**
   * ...and it has to still be reachable after the reader moves around the site.
   *
   * A route change unmounts the link that was just activated, and Chrome leaves
   * the sequential focus navigation starting point at that removed node's DOM
   * position — inside the router, which renders after the skip link. So the next
   * Tab resumed past it and a keyboard reader navigating within the site could
   * not skip the navbar at all. See src/hooks/useRouteFocusReset.ts.
   *
   * Driven with `.click()`: a bare `keyboard.press` after `goto` races
   * hydration, while actionability waits it out. The click is also the thing
   * under test — it is what leaves focus on a doomed element.
   */
  const CLIENT_NAVIGATIONS = [
    { name: "/blog/ -> /", from: "/blog/", click: "text=cd ~", url: "/" },
    { name: "/blog/ -> a post", from: "/blog/", click: "article a", url: /\/blog\/.+/ },
    { name: "/ -> /blog/", from: "/", click: 'a[href="/blog/"]', url: "/blog/" },
  ];

  for (const nav of CLIENT_NAVIGATIONS) {
    test(`is still the first Tab stop after a client-side nav ${nav.name}`, async ({
      page,
      viewport,
    }) => {
      test.skip(
        viewport !== null && viewport.width < 768,
        "The links driven here live in the desktop nav / archive grid"
      );

      await page.goto(nav.from);

      // Positive control, on the same page and in the same run: the skip link is
      // reachable *before* the navigation. Without this a broken selector or a
      // missing link would read exactly like a passing test.
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();

      await page.locator(nav.click).first().click();
      await expect(page).toHaveURL(nav.url);

      // `mode="wait"` holds the outgoing route through its exit transition, so
      // the element the click left focus on is unmounted well after the location
      // changed. Wait that out before reading the tab order, or this asserts
      // against a page that has not finished leaving.
      await expect(page.locator("main#main-content")).toBeVisible();
      await page.waitForTimeout(600);

      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
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
