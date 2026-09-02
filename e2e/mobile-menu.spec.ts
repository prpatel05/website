import {
  test,
  expect,
  openMobileMenu,
  expectOverlayClosed,
  SITE_MENU,
} from "./fixtures";

test.describe("Mobile menu", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows mobile menu button on small screens", async ({ page }) => {
    await expect(page.getByText("[menu]")).toBeVisible();
  });

  test("opens mobile menu and shows navigation links", async ({ page }) => {
    // `openMobileMenu` is the gate that means it: `toBeVisible()` on these four
    // links passed against both PRA-884 (opacity 0) and PRA-902 (2273px below
    // the fold). See `expectOverlayOpen` in ./fixtures.
    await openMobileMenu(page);

    await expect(page.getByText("about()").nth(1)).toBeVisible();
    await expect(page.getByText("writing()").nth(1)).toBeVisible();
    await expect(page.getByText("contact()").nth(1)).toBeVisible();
    await expect(page.getByText("resume()").nth(1)).toBeVisible();
  });

  test("closes mobile menu when a link is clicked", async ({ page }) => {
    await openMobileMenu(page);

    // Click a link in the mobile overlay
    await page.locator(".font-display.text-4xl").filter({ hasText: "about()" }).click();

    await expectOverlayClosed(page, SITE_MENU);
  });

  test("closes mobile menu via close button", async ({ page }) => {
    await openMobileMenu(page);

    await page.getByRole("button", { name: "Close menu" }).click();

    await expectOverlayClosed(page, SITE_MENU);
  });
});
