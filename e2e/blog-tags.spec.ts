import { test, expect } from "./fixtures";
import { discoverPostSlugs } from "../scripts/blog-posts.mjs";

const postSlugs = discoverPostSlugs();
const HIRING_POST = "The Entry-Level Job Is the Canary";

test.describe("blog archive tag filter", () => {
  test("clicking a filter chip shrinks the list and sets ?tag=", async ({ page }) => {
    await page.goto("/blog/");
    const cards = page.locator("main article h2 a");
    await expect(cards).toHaveCount(postSlugs.length);

    await page
      .getByRole("navigation", { name: "Filter by tag" })
      .getByRole("link", { name: "#hiring" })
      .click();

    await expect(page).toHaveURL(/\/blog\/\?tag=hiring$/);
    await expect(cards).toHaveCount(1);
    await expect(page.getByRole("heading", { name: HIRING_POST })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Filter by tag" }).getByRole("link", { name: "#hiring" })
    ).toHaveAttribute("aria-current", "page");
  });

  test("a shared ?tag= URL filters after hydrate", async ({ page }) => {
    await page.goto("/blog/?tag=hiring");
    await expect(page).toHaveURL(/\/blog\/\?tag=hiring$/);
    await expect(page.locator("main article h2 a")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: HIRING_POST })).toBeVisible();
  });

  test("an unknown tag shows an empty state and a way back", async ({ page }) => {
    await page.goto("/blog/?tag=not-a-real-tag");
    await expect(page.getByText("No posts tagged #not-a-real-tag.")).toBeVisible();
    await expect(page.locator("main article h2 a")).toHaveCount(0);

    await page.getByRole("link", { name: "show all posts" }).click();
    await expect(page).toHaveURL(/\/blog\/$/);
    await expect(page.locator("main article h2 a")).toHaveCount(postSlugs.length);
  });

  test("clearing the filter restores the full list", async ({ page }) => {
    await page.goto("/blog/?tag=hiring");
    await expect(page.locator("main article h2 a")).toHaveCount(1);

    await page
      .getByRole("navigation", { name: "Filter by tag" })
      .getByRole("link", { name: "all", exact: true })
      .click();

    await expect(page).toHaveURL(/\/blog\/$/);
    await expect(page.locator("main article h2 a")).toHaveCount(postSlugs.length);
  });

  test("a post chip opens the archive already filtered", async ({ page }) => {
    await page.goto("/blog/the-entry-level-job-is-the-canary/");
    await page.getByRole("link", { name: "#hiring" }).click();

    await expect(page).toHaveURL(/\/blog\/\?tag=hiring$/);
    await expect(page.locator("main article h2 a")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: HIRING_POST })).toBeVisible();
  });

  test("filter chips are keyboard reachable", async ({ page }) => {
    await page.goto("/blog/");
    const chip = page
      .getByRole("navigation", { name: "Filter by tag" })
      .getByRole("link", { name: "#hiring" });

    await chip.focus();
    await expect(chip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/blog\/\?tag=hiring$/);
    await expect(page.locator("main article h2 a")).toHaveCount(1);
  });
});
