import { test, expect } from "./fixtures";

/**
 * /book/ hosts Cal.com's inline embed. The fixtures block every cal.com
 * request, so these specs pin what the site owns: the prerendered page, the
 * fallback when the embed cannot load, and that nothing else pays for it.
 */

const CAL_URL = "https://cal.com/prpatel05/30min";

test.describe("/book/", () => {
  test("ships title, canonical, heading and the cal.com link in the prerendered HTML", async ({
    request,
  }) => {
    const res = await request.get("/book/");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>Book a Call — Pratik Patel</title>");
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/pratik\.pa\.tel\/book\/"/);
    expect(html).toContain("Book time with me");
    expect(html).toContain(`href="${CAL_URL}"`);
    // The snapshot must not bake in Cal's script or iframe.
    expect(html).not.toContain("app.cal.com/embed/embed.js");
    expect(html).not.toMatch(/<iframe[^>]+cal\.com/);
  });

  test("renders and requests the embed only here", async ({ page, blockedCal }) => {
    await page.goto("/book/");
    await expect(page).toHaveTitle("Book a Call — Pratik Patel");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://pratik.pa.tel/book/"
    );
    await expect(page.getByRole("heading", { level: 1, name: "Book time with me" })).toBeVisible();
    await expect(page.getByTestId("cal-fallback-link")).toHaveAttribute("href", CAL_URL);
    await expect.poll(() => blockedCal.some((u) => u.includes("app.cal.com/embed/embed.js"))).toBe(
      true
    );
  });

  test("falls back to a cal.com link when the embed cannot load", async ({ page }) => {
    await page.goto("/book/");
    await expect(page.locator('[data-cal-state="failed"]')).toBeVisible();
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("did not load");
    await expect(page.getByRole("link", { name: "Open cal.com/prpatel05/30min" })).toHaveAttribute(
      "href",
      CAL_URL
    );
  });

  test("home and the other pages never touch cal.com", async ({ page, blockedCal }) => {
    for (const path of ["/", "/resume/", "/vc/", "/blog/"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(blockedCal).toEqual([]);
  });

  test("the home contact section links to /book/", async ({ page, blockedCal }) => {
    await page.goto("/");
    const link = page.locator("#contact").getByRole("link", { name: /book a call/i });
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(/\/book\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Book time with me" })).toBeVisible();
    await expect.poll(() => blockedCal.length).toBeGreaterThan(0);
  });

  test("lists /book/ in the sitemap", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("<loc>https://pratik.pa.tel/book/</loc>");
  });
});

test.describe("/book/ without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still offers the cal.com link", async ({ page }) => {
    await page.goto("/book/");
    await expect(page.getByRole("heading", { level: 1, name: "Book time with me" })).toBeVisible();
    await expect(page.getByTestId("cal-fallback-link")).toBeVisible();
    await expect(page.getByTestId("cal-fallback-link")).toHaveAttribute("href", CAL_URL);
    // The prerendered note sits in the frame, above the fold.
    const inFrame = page.getByRole("link", { name: "Open cal.com/prpatel05/30min" });
    await expect(inFrame).toBeInViewport();
    await expect(inFrame).toHaveAttribute("href", CAL_URL);
  });
});
