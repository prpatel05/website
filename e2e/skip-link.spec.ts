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

/**
 * Every point of `selector`'s own rect at which `selector` is the topmost paint.
 *
 * `toBeVisible()` cannot answer this — it ignores stacking entirely, and the
 * skip link was focused, on screen, non-transparent and painted underneath the
 * navbar the whole time it was broken. Hit-testing the element against itself
 * is the only assertion that distinguishes "on the page" from "in front of the
 * page".
 */
const topmostCoverage = (page: import("@playwright/test").Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { onTop: 0, samples: 0, covering: null as string | null };
    const r = el.getBoundingClientRect();
    let onTop = 0;
    let samples = 0;
    let covering: string | null = null;
    for (let x = r.left + 2; x < r.right - 2; x += 4) {
      for (let y = r.top + 2; y < r.bottom - 2; y += 4) {
        samples++;
        const top = document.elementsFromPoint(x, y)[0];
        if (top === el || el.contains(top)) onTop++;
        else if (!covering && top)
          covering = `${top.tagName}.${String(top.className || "").slice(0, 40)}`;
      }
    }
    return { onTop, samples, covering };
  }, selector);

test.describe("Skip to main content", () => {
  for (const route of ROUTES) {
    /**
     * The link carried `focus:z-50` against a navbar that is also `z-50` and
     * renders later in the DOM, so the nav won the tie and painted over it.
     *
     * Measured on `main` before the fix: the topmost paint at **0 of 495**
     * sampled points on all three routes and both viewports. On `/blog/` and
     * every post page the navbar's `bg-background/80 backdrop-blur-xl` is
     * unconditional, so focusing the first Tab stop moved the strongest pixel
     * in the top-left 320x80 region by 32/255 — against 243/255 with the link
     * painted on top. `/` was the one route where it looked fine, and only
     * above `scrollY > 50` where the nav is still transparent.
     *
     * Scrolled deliberately: it is the state that fails on every route, and on
     * `/` it is the only one that does.
     */
    test(`is not painted under the navbar on ${route}`, async ({ page }) => {
      await page.goto(route);

      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to main content" });
      await expect(skip).toBeFocused();

      // Positive control, same page and same run: a link inside the nav must
      // read as fully on top. Without it a broken `elementsFromPoint` — or a
      // selector matching nothing — would report 0/0 and look like a pass.
      //
      // Measured with the skip link blurred. Focused, it is a 224x40 panel at
      // top-left that legitimately covers the nav's own first link, so running
      // the control first would report the control failing for the very reason
      // the fix is working.
      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur?.());
      const navLink = await topmostCoverage(page, "nav[aria-label='Main'] a");
      expect(navLink.samples).toBeGreaterThan(0);
      expect(navLink.onTop).toBe(navLink.samples);

      for (const scrollY of [0, 800]) {
        await page.evaluate((y) => window.scrollTo(0, y), scrollY);
        // The navbar cross-fades its background in over 500ms on `/`.
        await page.waitForTimeout(700);
        await page.evaluate(() => {
          const link = [...document.querySelectorAll("a")].find(
            (a) => a.textContent?.trim() === "Skip to main content"
          );
          link?.focus();
        });
        await expect(skip).toBeFocused();

        const { onTop, samples, covering } = await topmostCoverage(
          page,
          "a[href='#main-content']"
        );
        expect(samples).toBeGreaterThan(100);
        expect(
          onTop,
          `at scrollY ${scrollY} the skip link is behind ${covering} at ${samples - onTop} of ${samples} points`
        ).toBe(samples);
      }
    });
  }

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

      // Blurred before the click, because a focused skip link is a 224x40 panel
      // pinned to the top-left corner and `cd ~` sits underneath it. That is the
      // fix working — the link is supposed to be in front of the navbar while it
      // holds focus — but it makes Playwright's actionability check retry the
      // click forever. Reaching for the mouse is what blurs it for a real reader
      // anyway; the click still lands on a live element and still leaves focus on
      // one the route change is about to unmount, which is what this asserts.
      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur?.());

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
