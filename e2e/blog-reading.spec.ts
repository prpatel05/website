import { test, expect } from "./fixtures";

const POST = "/blog/the-entry-level-job-is-the-canary/";

const progressbar = (page: import("@playwright/test").Page) =>
  page.getByRole("progressbar", { name: "Reading progress" });

const contents = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Contents" });

test.describe("blog reading chrome", () => {
  test("heading ids and a contents list ship with the post", async ({ page }) => {
    await page.goto(POST);

    const h2s = page.locator("[data-post-body] h2[id]");
    await expect(h2s.first()).toBeVisible();
    const count = await h2s.count();
    expect(count).toBeGreaterThan(1);

    const toc = contents(page);
    await expect(toc).toBeVisible();
    await expect(toc.getByText("// contents")).toBeVisible();
    await expect(toc.getByRole("link")).toHaveCount(count);
  });

  test("reading progress fills as the article is scrolled", async ({ page }) => {
    await page.goto(POST);
    const bar = progressbar(page);
    await expect(bar).toBeVisible();

    const atTop = Number(await bar.getAttribute("aria-valuenow"));
    expect(atTop).toBeLessThan(15);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(async () => Number(await bar.getAttribute("aria-valuenow"))).toBeGreaterThan(90);
  });

  test("a contents link jumps to its heading and becomes current", async ({ page }) => {
    await page.goto(POST);
    const toc = contents(page);
    const links = toc.getByRole("link");
    const last = links.last();
    const href = await last.getAttribute("href");
    expect(href).toMatch(/^#/);
    const id = href!.slice(1);

    await last.click();

    const heading = page.locator(`[data-post-body] h2#${id}`);
    await expect(heading).toBeVisible();
    const top = await heading.evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThan(40);
    expect(top).toBeLessThan(200);

    await expect(last).toHaveAttribute("aria-current", "location");
  });

  test("contents stay keyboard reachable", async ({ page }) => {
    await page.goto(POST);
    const first = contents(page).getByRole("link").first();
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press("Enter");
    const href = await first.getAttribute("href");
    const id = href!.slice(1);
    const top = await page.locator(`[data-post-body] h2#${id}`).evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeLessThan(200);
  });

  test("print hides the progress bar and the contents list", async ({ page }) => {
    await page.goto(POST);
    await expect(progressbar(page)).toBeVisible();
    await expect(contents(page)).toBeVisible();

    await page.emulateMedia({ media: "print" });
    await expect(progressbar(page)).toBeHidden();
    await expect(contents(page)).toBeHidden();
  });

  test("reduced motion drops the progress width transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(POST);
    const duration = await progressbar(page).locator("div").evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration.split(",").every((part) => part.trim() === "0s")).toBe(true);
  });
});

test.describe("blog reading chrome layout", () => {
  test("desktop keeps the contents list sticky beside the article", async ({ page, isMobile }) => {
    test.skip(isMobile, "sticky rail is an xl layout");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(POST);
    const position = await contents(page).evaluate((el) => {
      const rail = el.closest("aside")?.querySelector(":scope > div");
      return rail ? getComputedStyle(rail).position : "";
    });
    expect(position).toBe("sticky");
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
    const top = await contents(page).evaluate((el) => el.getBoundingClientRect().top);
    expect(top).toBeGreaterThan(60);
    expect(top).toBeLessThan(220);
  });

  test("mobile leaves the contents list in flow under the hero", async ({ page, isMobile }) => {
    test.skip(!isMobile, "in-flow list is the small-viewport layout");
    await page.goto(POST);
    const tocBox = await contents(page).boundingBox();
    const heroBox = await page.locator("article img").boundingBox();
    expect(tocBox).toBeTruthy();
    expect(heroBox).toBeTruthy();
    expect(tocBox!.y).toBeGreaterThan(heroBox!.y);
    const position = await contents(page).evaluate((el) => {
      const rail = el.closest("aside")?.querySelector(":scope > div");
      return rail ? getComputedStyle(rail).position : "";
    });
    expect(position).toBe("static");
  });
});
