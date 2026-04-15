import { test, expect } from "@playwright/test";

test.describe("Blog listing and post navigation", () => {
  test("blog listing shows all posts", async ({ page }) => {
    await page.goto("/blog");

    await expect(page.getByText("Blog")).toBeVisible();
    await expect(page.getByText("archive")).toBeVisible();

    // Verify all 5 blog posts are listed
    const postLinks = page.locator('a[href^="/blog/"]');
    await expect(postLinks).toHaveCount(5);

    // Check first post title is visible
    await expect(
      page.getByText("Ship It Yourself: Why the Best Time to Build Is Right Now")
    ).toBeVisible();
  });

  test("blog listing displays post metadata", async ({ page }) => {
    await page.goto("/blog");

    // Check metadata for the first post
    await expect(page.getByText("2026.04").first()).toBeVisible();
    await expect(page.getByText("7 min").first()).toBeVisible();
    await expect(page.getByText("#ai").first()).toBeVisible();
  });

  test("navigates from blog listing to individual post", async ({ page }) => {
    await page.goto("/blog");

    await page
      .getByText("Ship It Yourself: Why the Best Time to Build Is Right Now")
      .click();

    await expect(page).toHaveURL("/blog/ship-it-yourself");
    await expect(
      page.getByRole("heading", { name: /Ship It Yourself/i })
    ).toBeVisible();
  });

  test("individual blog post renders content", async ({ page }) => {
    await page.goto("/blog/ship-it-yourself");

    // Title
    await expect(
      page.getByRole("heading", { name: /Ship It Yourself/i })
    ).toBeVisible();

    // Subtitle
    await expect(
      page.getByText("AI didn't just lower the barrier to entry")
    ).toBeVisible();

    // Metadata
    await expect(page.getByText("7 min")).toBeVisible();
  });

  test("blog post has back navigation to blog listing", async ({ page }) => {
    await page.goto("/blog/ship-it-yourself");

    const backLink = page.locator("text=cd ~");
    await expect(backLink).toBeVisible();
  });

  test("non-existent blog slug shows 404", async ({ page }) => {
    await page.goto("/blog/this-post-does-not-exist");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("Page not found")).toBeVisible();
  });
});
