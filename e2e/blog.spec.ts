import { test, expect } from "./fixtures";
import { discoverPostSlugs } from "../scripts/blog-posts.mjs";

// src/data/blog-posts/registry discovers posts with import.meta.glob, which
// only exists inside Vite's transform. This suite runs outside it, so it scans
// the post directory the same way the prerender does.
const postSlugs = discoverPostSlugs();

test.describe("Blog listing and post navigation", () => {
  test("blog listing shows all posts", async ({ page }) => {
    await page.goto("/blog");

    await expect(page.getByText("Blog")).toBeVisible();
    await expect(page.getByText("archive")).toBeVisible();

    // Verify all blog posts are listed
    const postLinks = page.locator('a[href^="/blog/"]');
    await expect(postLinks).toHaveCount(postSlugs.length);

    // Every discovered post is reachable from the listing, so a post the
    // prerender builds can never be missing a link here.
    const hrefs = await postLinks.evaluateAll((links) =>
      links.map((link) => link.getAttribute("href"))
    );
    expect(hrefs.sort()).toEqual(
      postSlugs.map((slug) => `/blog/${slug}`).sort()
    );

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
