import { test, expect, type Page } from "./fixtures";

/**
 * What a crawler — or any reader during the second before the bundle arrives —
 * actually sees.
 *
 * The prerendered homepage once shipped its entire body below the hero at
 * inline `opacity: 0`: About, Recent writes and Contact were all present in the
 * HTML and all invisible until React had downloaded, hydrated and had an
 * IntersectionObserver fire. Every other homepage test scrolls the section into
 * view with JavaScript running first, which is exactly the state that hides the
 * bug.
 *
 * Assertions here read computed opacity rather than `toBeVisible()`. Playwright
 * calls an `opacity: 0` element visible — it checks the bounding box and
 * `visibility`, not whether anything is painted — so a `toBeVisible()` suite
 * passes against the broken build. Verified: it does.
 *
 * `scripts/prerender.mjs` fails the build on any inline `opacity: 0`, which is
 * the tighter gate. This is the same claim stated as behaviour: not "the markup
 * carries no hidden styles" but "a visitor without JavaScript can read this".
 */

const opacityOf = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return "ABSENT";
    return getComputedStyle(el).opacity;
  }, selector);

test.describe("prerendered page is visible without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the homepage body is painted below the hero", async ({ page }) => {
    await page.goto("/");

    // Each section's `.container` carries the scroll-linked opacity, and its
    // children carry their own `initial` states. Those are two separate causes
    // that both blank the page, so both are named here: fixing one alone still
    // leaves a reader looking at nothing.
    for (const selector of [
      "h1",
      "#about .container",
      "#about .container [class*='grid']",
      "#writing .container",
      "#writing article",
      "#contact .container",
      "#contact .container a[href^='mailto:']",
    ]) {
      expect(await opacityOf(page, selector), selector).toBe("1");
    }
  });

  test("nothing in the served markup is transparent", async ({ page }) => {
    await page.goto("/");

    const transparent = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => parseFloat(getComputedStyle(el).opacity) === 0)
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
    );

    expect(transparent).toEqual([]);
  });
});
