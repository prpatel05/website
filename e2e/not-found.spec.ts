import { test, expect } from "./fixtures";

test.describe("404 page", () => {
  test("shows 404 for invalid route", async ({ page }) => {
    await page.goto("/some-nonexistent-page");

    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText(/command not found/i)).toBeVisible();
  });

  test("404 page has link back to home", async ({ page }) => {
    await page.goto("/does-not-exist");

    const homeLink = page.getByRole("link", { name: "cd ~", exact: true });
    await expect(homeLink).toBeVisible();

    await homeLink.click();
    await expect(page).toHaveURL("/");
  });

  test("deeply nested invalid route shows 404", async ({ page }) => {
    await page.goto("/foo/bar/baz");

    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  });
});

  test("404 offers blog, latest post, and series escapes", async ({ page }) => {
    await page.goto("/does-not-exist");

    await expect(page.getByRole("link", { name: "cd ~/blog", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /open ~\/blog\// })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "cd ~/blog/series/agent-reliability", exact: true })
    ).toBeVisible();
  });
