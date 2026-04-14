import { test, expect } from "@playwright/test";

test.describe("Mobile menu", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows mobile menu button on small screens", async ({ page }) => {
    await expect(page.getByText("[menu]")).toBeVisible();
  });

  test("opens mobile menu and shows navigation links", async ({ page }) => {
    await page.getByText("[menu]").click();

    await expect(page.getByText("about()").nth(1)).toBeVisible();
    await expect(page.getByText("writing()").nth(1)).toBeVisible();
    await expect(page.getByText("contact()").nth(1)).toBeVisible();
    await expect(page.getByText("resume()").nth(1)).toBeVisible();
  });

  test("closes mobile menu when a link is clicked", async ({ page }) => {
    await page.getByText("[menu]").click();

    // Wait for menu to open
    await expect(page.getByText("about()").nth(1)).toBeVisible();

    // Click a link in the mobile overlay
    await page.locator(".font-display.text-4xl").filter({ hasText: "about()" }).click();

    // Menu should close — the overlay links should no longer be visible
    await expect(page.locator(".font-display.text-4xl").filter({ hasText: "about()" })).not.toBeVisible();
  });

  test("closes mobile menu via close button", async ({ page }) => {
    await page.getByText("[menu]").click();
    await expect(page.getByText("about()").nth(1)).toBeVisible();

    // Click the X close button
    await page.locator("button").filter({ has: page.locator("svg.w-6.h-6") }).click();

    await expect(page.locator(".font-display.text-4xl").filter({ hasText: "about()" })).not.toBeVisible();
  });
});
