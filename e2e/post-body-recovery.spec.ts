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
    // Counting document loads of the post URL is what keeps this a control once
    // the assertion below is patient. A reload fills the body out of the served
    // HTML, so on a build where the chunk import always rejected the poll would
    // still go green — via the recovery the other two tests are about — and
    // report the ordinary path as working. The impatient read this replaces
    // ruled that out by accident, being too early for a reload to have landed.
    const documentLoads: string[] = [];
    page.on("request", (req) => {
      if (
        req.resourceType() === "document" &&
        req.url().endsWith(`/blog/${slug}/`)
      )
        documentLoads.push(req.url());
    });

    await navigateToPost(page);

    // Patient for the same reason its siblings are. The body is a dynamic
    // import fired from an effect, and nothing in `navigateToPost` waits for
    // it: the click's actionability checks gate hydration, not the chunk. The
    // window is small — measured at ~20ms, against a page transition that
    // usually spends ~780ms before the article even attaches — but it is real,
    // and reading straight after the click failed 3 runs in 10 on `main`.
    await expect
      .poll(async () => (await bodyTextOf(page)).trim().length, {
        timeout: 15_000,
      })
      .toBeGreaterThan(500);

    expect(
      documentLoads,
      "the body arrived from a recovery reload rather than from the chunk"
    ).toEqual([]);
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
   * The mark is a one-shot, and it has to be re-armed once it has done its job
   * — otherwise a tab that outlives two deploys gets the recovery once and the
   * dead end forever after (PRA-930).
   *
   * The clear used to hang off the `.then` of the body import, which is the one
   * path a successful recovery never takes: the reload delivers the body in the
   * HTML, so the effect returns before it fetches anything. Measured on the
   * unfixed build: `post-body-reload:<slug>` still "1" after the body was back
   * on screen, and on the next client-side visit to the same post the reader
   * got `// error:body` and an archive link instead of the reload that would
   * have worked — the post unreachable in that tab.
   */
  test("re-arms the reload, so a second deploy gets a second recovery", async ({ page }) => {
    // Gone on every load, standing in for a chunk hash that no longer exists.
    // The reload is unaffected: it is a document load, and the body rides in
    // the HTML.
    await page.route(bodyChunk, (route) => route.abort("failed"));

    // Counting the recoveries rather than trusting them. Every assertion below
    // is about the state a recovery leaves behind, and on a build where the
    // route pattern stopped matching there would be no recovery at all — the
    // body would simply arrive and a "the mark is clear" assertion would pass
    // having never seen a mark.
    const reloads: string[] = [];
    page.on("request", (req) => {
      if (req.resourceType() === "document" && req.url().endsWith(`/blog/${slug}/`))
        reloads.push(req.url());
    });

    const mark = () =>
      page.evaluate((k) => window.sessionStorage.getItem(k), `post-body-reload:${slug}`);

    // Deploy 1. The reader clicks the post, the chunk is gone, and the reload
    // brings the body back out of the served HTML.
    await navigateToPost(page);
    await expect
      .poll(async () => (await bodyTextOf(page)).trim().length, { timeout: 15_000 })
      .toBeGreaterThan(500);
    expect(reloads, "no recovery reload happened, so there is no mark to release").toHaveLength(1);

    expect(
      await mark(),
      "the mark survived a recovery that worked, so the next one is refused"
    ).toBeNull();

    // Deploy 2, same tab. The reader goes back to the archive and opens the
    // same post again, client-side, and the chunk is missing again.
    await page.getByText("ls ../posts").first().click();
    await page.waitForURL("**/blog/");
    await page.locator(`a[href="/blog/${slug}/"]`).first().click();
    await page.waitForURL(`**/blog/${slug}/`);

    // What the reader is owed: the post, via a second reload — not the dead
    // end. Asserted on the body rather than on the absence of the message, so
    // this cannot pass on a build that simply stopped rendering the error.
    await expect
      .poll(async () => (await bodyTextOf(page)).trim().length, {
        message: "the second failure was not recovered",
        timeout: 15_000,
      })
      .toBeGreaterThan(500);
    await expect(page.getByText("This post's text didn't load")).toHaveCount(0);
    expect(reloads, "the second failure did not spend a reload").toHaveLength(2);
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
