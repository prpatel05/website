import { test, expect } from "./fixtures";

/**
 * Social traffic lands on the homepage, and the previous latest-post card
 * lived in #writing, under a min-h-screen hero. At 360x640 that was a full
 * viewport below the fold, so the card never got a click. This pins the new
 * placement: the card is in the first viewport, clear of the fixed nav.
 */
test.describe("Homepage latest-post path", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("the latest post card is fully on screen at 360x640", async ({ page }) => {
    await page.goto("/");

    const latest = page.locator("a[data-latest-post]");
    await expect(latest).toBeVisible();

    const box = await latest.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const navBottom = Math.max(
        0,
        ...Array.from(document.querySelectorAll("nav, header"))
          .filter((node) => {
            const pos = getComputedStyle(node).position;
            return pos === "fixed" || pos === "sticky";
          })
          .map((node) => node.getBoundingClientRect().bottom)
      );
      return {
        top: r.top,
        bottom: r.bottom,
        navBottom,
        viewport: window.innerHeight,
      };
    });

    expect(box.top).toBeGreaterThanOrEqual(box.navBottom);
    expect(box.bottom).toBeLessThanOrEqual(box.viewport);
  });

  test("the card is a permalink into the latest post", async ({ page }) => {
    await page.goto("/");
    const latest = page.locator("a[data-latest-post]");
    const href = await latest.getAttribute("href");
    expect(href).toMatch(/^\/blog\/.+\/$/);

    await latest.click();
    await expect(page).toHaveURL(href!);
    await expect(page.locator("h1").first()).toBeVisible();
  });
});
