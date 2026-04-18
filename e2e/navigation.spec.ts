import { test, expect } from "@playwright/test";

test.describe("Navigation between routes", () => {
  test("navigates from homepage to blog via writing section link", async ({ page }) => {
    await page.goto("/");
    const writing = page.locator("#writing");
    await writing.scrollIntoViewIfNeeded();

    // Click first blog post link in the preview section
    const blogLink = writing.locator('a[href^="/blog/"]').first();
    await blogLink.click();

    await expect(page).toHaveURL(/\/blog\/.+/);
  });

  test("navigates from blog listing back to homepage", async ({ page }) => {
    await page.goto("/blog");
    await page.locator("text=cd ~").click();
    await expect(page).toHaveURL("/");
  });

  test("navigates from blog post back to homepage", async ({ page }) => {
    await page.goto("/blog/ship-it-yourself");
    await page.locator("text=cd ~").click();
    await expect(page).toHaveURL("/");
  });

  test("clicking about() scrolls to about section", async ({ page, viewport }) => {
    test.skip(viewport !== null && viewport.width < 768, "Desktop nav hidden on mobile");
    await page.goto("/");
    await page.locator('a[href="#about"]').first().click();
    await expect(page.locator("#about")).toBeInViewport();
  });

  test("clicking contact() scrolls to contact section", async ({ page, viewport }) => {
    test.skip(viewport !== null && viewport.width < 768, "Desktop nav hidden on mobile");
    await page.goto("/");
    await page.locator('a[href="#contact"]').first().click();
    // Give time for smooth scroll
    await page.waitForTimeout(500);
    await expect(page.locator("#contact")).toBeInViewport();
  });
});
