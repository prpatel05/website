import { test, expect } from "@playwright/test";

test.describe("404 page", () => {
  test("shows 404 for invalid route", async ({ page }) => {
    await page.goto("/some-nonexistent-page");

    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("Page not found")).toBeVisible();
  });

  test("404 page has link back to home", async ({ page }) => {
    await page.goto("/does-not-exist");

    const homeLink = page.getByText("cd ~");
    await expect(homeLink).toBeVisible();

    await homeLink.click();
    await expect(page).toHaveURL("/");
  });

  test("deeply nested invalid route shows 404", async ({ page }) => {
    await page.goto("/foo/bar/baz");

    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });
});
