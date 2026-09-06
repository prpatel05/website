import { test, expect } from "./fixtures";
import { discoverPostSlugs } from "../scripts/blog-posts.mjs";

const firstPost = discoverPostSlugs().sort()[0];

test.describe("Navigation landmarks are all named", () => {
  // A post page carries the cd ~ header bar, the newer/older pager, and —
  // when the post has H2s — a Contents jump list. Landmark navigation listing
  // one of them as an anonymous navigation gives no way to tell which is
  // which without walking into it.
  test("post page names each of its nav regions", async ({ page }) => {
    await page.goto(`/blog/${firstPost}/`);

    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "More posts" })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Sitemap" })).toHaveCount(1);
    const contents = page.getByRole("navigation", { name: "Contents" });
    const contentsCount = await contents.count();
    expect(contentsCount === 0 || contentsCount === 1).toBe(true);
    const series = page.getByRole("navigation", { name: "Agent reliability" });
    const seriesCount = await series.count();
    expect(seriesCount === 0 || seriesCount === 2).toBe(true);
    await expect(page.getByRole("navigation")).toHaveCount(
      3 + contentsCount + seriesCount
    );
  });

  test("blog listing names its nav region", async ({ page }) => {
    await page.goto("/blog/");
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Filter by tag" })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Sitemap" })).toHaveCount(1);
    await expect(page.getByRole("navigation")).toHaveCount(3);
  });

  test("homepage names its nav regions", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Sitemap" })).toHaveCount(1);
    // Jump rail mounts only after scroll; at the top it must not exist yet.
    await expect(page.getByRole("navigation", { name: "On this page" })).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(2);

    await page.evaluate(() => {
      const about = document.getElementById("about");
      if (!about) throw new Error("#about missing");
      // Park about under the fixed nav so the jump rail's reveal predicate
      // (top <= 64) is true, then dispatch scroll so the listener runs.
      const y = about.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo(0, Math.max(0, y));
      window.dispatchEvent(new Event("scroll"));
    });
    await expect(page.getByRole("navigation", { name: "On this page" })).toHaveCount(1);
    await expect(page.getByRole("navigation")).toHaveCount(3);
  });

  test("series hub names its nav region", async ({ page }) => {
    await page.goto("/blog/series/agent-reliability/");
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "Sitemap" })).toHaveCount(1);
    await expect(page.getByRole("navigation")).toHaveCount(2);
  });
});

test.describe("Decorative separators stay out of accessible names", () => {
  // The "|" between date and read time used to sit inside a whole-card link,
  // so a screen reader read "2026.08 | 7 min | #ai | ...". Title links are
  // now the card hit-target; keep the pipe out of their accessible name.
  test("blog listing card links do not announce the pipe", async ({ page }) => {
    await page.goto("/blog/");

    // Title links only: tag chips are sibling links on `/blog/?tag=`, and the
    // stretched card hit-target is the heading so the pipe sits outside it.
    const cards = page.locator("main article h2 a");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await expect(card).not.toHaveAccessibleName(/\|/);
    }
  });

  test("homepage preview card links do not announce the pipe", async ({ page }) => {
    await page.goto("/");

    const cards = page.locator('a[href^="/blog/"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).not.toHaveAccessibleName(/\|/);
    }
  });
});
