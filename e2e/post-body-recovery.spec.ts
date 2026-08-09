import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "./fixtures";

/**
 * A post body that fails to arrive must not leave a silently empty article.
 *
 * Bodies are only fetched on a client-side navigation — a first load reads the
 * body out of the prerendered markup and asks the network for nothing. That
 * fetch is a dynamic import of a content-hashed chunk, and Pages replaces
 * `dist/` wholesale on deploy, so a reader holding a tab from before a deploy
 * requests a chunk URL that is gone. The import rejected into nothing: `content`
 * stayed "" for the life of the page and the reader got the title, subtitle and
 * hero above an empty `[data-post-body]`, then the footer. Measured on the
 * unfixed build: 6707 body characters served, 0 with the chunk blocked, and one
 * unhandled `Failed to fetch dynamically imported module`.
 *
 * No unit test sees this. The failure is a rejected dynamic import of a real
 * built chunk during a real client-side navigation — there is no chunk, no
 * router and no deploy in jsdom.
 *
 * The recovery is a full load of the URL the reader is already on, whose HTML
 * carries the body. That is why the assertion below is that the body comes
 * back, not that an error message appears: the reader should get the post.
 */

const SITEMAP = fileURLToPath(new URL("../dist/sitemap.xml", import.meta.url));

/**
 * Derived from the sitemap rather than hardcoded, so this cannot silently pin
 * itself to a post that gets renamed or unpublished.
 */
const slug = [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>[^<]*\/blog\/([^/<]+)\/<\/loc>/g)]
  .map(([, s]) => s)
  .sort()[0];

/** The body chunk is emitted under the slug, one per post. */
const bodyChunk = `**/assets/${slug}-*.js`;

const bodyTextOf = (page: Page) => page.locator("[data-post-body]").innerText();

/**
 * Reaches the post the way a reader does — from the index, client-side. Going
 * straight to the URL would serve the body in the HTML and never fetch, which
 * is the path this spec is not about.
 */
const navigateToPost = async (page: Page) => {
  await page.goto("/blog/");
  // By href rather than accessible name: the name is the post's title, which
  // has no reliable relationship to the slug this spec derived from the
  // sitemap. A click rather than a pushState, because Playwright's
  // actionability checks are what wait out hydration.
  await page.locator(`a[href="/blog/${slug}/"]`).first().click();
  await page.waitForURL(`**/blog/${slug}/`);
};

test.describe("a post body that fails to load", () => {
  /**
   * Control. Everything below asserts about a blocked chunk, and a navigation
   * that never reached the post would satisfy those assertions too. This pins
   * that the same journey delivers a real body when nothing is blocked.
   */
  test("arrives normally when the chunk is served", async ({ page }) => {
    await navigateToPost(page);
    expect((await bodyTextOf(page)).trim().length).toBeGreaterThan(500);
  });

  test("recovers the post instead of rendering an empty article", async ({ page }) => {
    let blocked = 0;
    await page.route(bodyChunk, (route) => {
      blocked += 1;
      // The chunk is gone, not slow: this is what a redeployed dist does to a
      // hash the open tab still remembers.
      return route.abort("failed");
    });

    await navigateToPost(page);

    // The recovery is a full page load, whose HTML carries the body. Waiting on
    // the text rather than on a navigation event keeps this about the outcome.
    await expect
      .poll(async () => (await bodyTextOf(page)).trim().length, {
        message: `chunk blocked ${blocked} time(s); body never filled`,
        timeout: 15_000,
      })
      .toBeGreaterThan(500);

    // The block was actually exercised — otherwise this test passes on a build
    // where the route pattern stopped matching the emitted chunk name.
    expect(blocked, `no request matched ${bodyChunk}`).toBeGreaterThan(0);
  });

  /**
   * The reload is spent once per slug per tab. A second failure has to say so
   * rather than reload again, which on a post whose HTML had no body would be a
   * loop.
   */
  test("says so when reloading did not help", async ({ page }) => {
    // Fails the chunk on every load, including the one the recovery triggers.
    await page.route(bodyChunk, (route) => route.abort("failed"));
    // ...and strips the body out of the served HTML, so the reload lands on the
    // same empty page the fetch was meant to fill. This is the case the
    // one-shot guard exists for.
    await page.route(`**/blog/${slug}/`, async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace(
        /(data-post-body="[^"]*")([^>]*>)[\s\S]*?(?=<\/div>)/,
        "$1$2"
      );
      return route.fulfill({ response: res, body: html });
    });

    await navigateToPost(page);

    await expect(page.getByText("This post's text didn't load")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: /cd ~\/blog/ })).toBeVisible();
  });
});
