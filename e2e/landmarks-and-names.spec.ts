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
    const contents = page.getByRole("navigation", { name: "Contents" });
    const contentsCount = await contents.count();
    expect(contentsCount === 0 || contentsCount === 1).toBe(true);
    await expect(page.getByRole("navigation")).toHaveCount(2 + contentsCount);
  });

  test("blog listing names its nav region", async ({ page }) => {
    await page.goto("/blog/");
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);
    await expect(page.getByRole("navigation")).toHaveCount(1);
  });

  test("homepage names its nav region", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);
    await expect(page.getByRole("navigation")).toHaveCount(1);
  });
});

test.describe("Decorative separators stay out of accessible names", () => {
  // Each card's meta row sits inside the whole-card <Link>, so every glyph in it
  // is concatenated into the link's accessible name. The "|" between date and
  // read time renders at 1.35:1 on card — a sighted reader never sees it, but a
  // screen reader read it out: "2026.08 | 7 min | #ai | ...".
  test("blog listing card links do not announce the pipe", async ({ page }) => {
    await page.goto("/blog/");

    const cards = page.locator('a[href^="/blog/"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      // Control: the meta row is still part of the name, so a pass cannot come
      // from the name having collapsed to just the title.
      await expect(card).toHaveAccessibleName(/min/);
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
