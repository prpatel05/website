import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "./fixtures";

/**
 * The layer above `post-body-recovery`: the post *route* itself is a lazily
 * imported chunk, and it fails on the same deploy that strands a body chunk.
 *
 * `/blog/` does not modulepreload `BlogPost-*.js` — only a post's own HTML does
 * — so a reader holding the archive from before a deploy asks for that chunk
 * for the first time when they click a post, and gets a hash that no longer
 * exists. Before the recovery, `lazyRoute` rethrew the rejection from render
 * and `App`'s ErrorBoundary answered with a generic full-screen "Something went
 * wrong": measured at 53 characters of page text against 5638, no `<h1>`, no
 * nav, and an empty `[data-post-body]`, on a URL whose own HTML carries the
 * whole post.
 *
 * `post-body-recovery.spec.ts` does not cover this. It pins the per-post body
 * chunk (`**\/assets/<slug>-*.js`), which fails one level down and inside a
 * mounted page; this one fails before the route can render at all.
 *
 * The recovery is the same in kind and for the same reason: a full load of the
 * URL the reader is already on serves the route prerendered, from `<script>`
 * tags whose hashes belong to the deploy that is actually live.
 */

const SITEMAP = fileURLToPath(new URL("../dist/sitemap.xml", import.meta.url));

/** Derived rather than hardcoded, so a renamed post cannot silently un-pin it. */
const slug = [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>[^<]*\/blog\/([^/<]+)\/<\/loc>/g)]
  .map(([, s]) => s)
  .sort()[0];

/**
 * The route chunk, one for the whole site — it is named for the module
 * `src/routes.ts` imports, not for any post.
 */
const ROUTE_CHUNK = "**/assets/BlogPost-*.js";

const ERROR_SCREEN = "Something went wrong";

const bodyTextOf = (page: Page) => page.locator("[data-post-body]").innerText();

/**
 * Counts full document loads of the post URL, which is what the recovery is.
 * Every test here needs it: the control to prove it does *not* happen, the
 * recovery to prove it does, and the terminal case to prove it happens once.
 */
const countPostDocumentLoads = (page: Page) => {
  const loads: string[] = [];
  page.on("request", (req) => {
    if (req.resourceType() === "document" && req.url().endsWith(`/blog/${slug}/`))
      loads.push(req.url());
  });
  return loads;
};

/**
 * Reaches the post the way the journey does — from the archive, client-side.
 * A direct `goto` would be a document load, which is the one navigation that
 * cannot hit this: `src/main.tsx` awaits the route chunk before hydrating, and
 * the HTML it would hydrate is already the whole post.
 */
const navigateToPost = async (page: Page) => {
  await page.goto("/blog/");
  // By href: the accessible name is the post's title, which has no reliable
  // relationship to the slug read out of the sitemap. A click rather than a
  // pushState, because Playwright's actionability checks are what wait out
  // hydration.
  await page.locator(`a[href="/blog/${slug}/"]`).first().click();
  await page.waitForURL(`**/blog/${slug}/`);
};

/** The reader-facing question, in one place: did they get the post? */
const expectThePost = async (page: Page) => {
  await expect
    .poll(async () => (await bodyTextOf(page)).trim().length, { timeout: 15_000 })
    .toBeGreaterThan(500);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(ERROR_SCREEN);
  await expect(page.locator("nav").first()).toBeVisible();
};

test.describe("a post route chunk that fails to load", () => {
  /**
   * Control. Every assertion below is satisfied by a journey that never asked
   * for the chunk at all, and by one that reached the post through the very
   * recovery under test. This pins the ordinary path: the post arrives, and it
   * arrives without a document load.
   */
  test("arrives normally when the chunk is served", async ({ page }) => {
    const documentLoads = countPostDocumentLoads(page);

    await navigateToPost(page);
    await expectThePost(page);

    expect(
      documentLoads,
      "the post arrived from a recovery reload rather than from the chunk"
    ).toEqual([]);
  });

  test("recovers the post instead of the error screen", async ({ page }) => {
    const documentLoads = countPostDocumentLoads(page);

    let blocked = 0;
    // Only the first request fails. That is the deploy this models rather than
    // a permanent outage: the tab is holding hashes from the bundle that was
    // replaced, and the full load the recovery makes is served by the new one,
    // whose own chunk URLs are all present. The permanent case is the test
    // below.
    await page.route(ROUTE_CHUNK, (route) => {
      if (blocked > 0) return route.continue();
      blocked += 1;
      return route.abort("failed");
    });

    await navigateToPost(page);
    await expectThePost(page);

    expect(
      blocked,
      `no request matched ${ROUTE_CHUNK} — the route is no longer a separate chunk, so this test proved nothing`
    ).toBe(1);
    expect(
      documentLoads.length,
      "the post was never recovered by a full load"
    ).toBe(1);
  });

  /**
   * The recovery is spent once per tab. A bundle that is stale is stale for
   * every route in it, so one full load is the whole fix — and if that load
   * cannot get the chunk either, asking for another one is a reload loop.
   */
  test("stops at the error screen when reloading did not help", async ({ page }) => {
    const documentLoads = countPostDocumentLoads(page);

    // Fails on every load, including the one the recovery triggers.
    await page.route(ROUTE_CHUNK, (route) => route.abort("failed"));

    await navigateToPost(page);

    await expect(page.getByRole("heading", { level: 1, name: ERROR_SCREEN })).toBeVisible({
      timeout: 15_000,
    });
    // The offered escape hatch is real, and is the reader's own retry.
    await expect(page.getByRole("button", { name: "refreshing the page" })).toBeVisible();

    // Long enough for a second recovery to have fired and landed, so this reads
    // "it stopped" rather than "it has not got there yet".
    await page.waitForTimeout(2000);
    expect(
      documentLoads.length,
      "the recovery reloaded more than once — a chunk that stays gone is a reload loop"
    ).toBe(1);
  });
});
