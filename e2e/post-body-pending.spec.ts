import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "./fixtures";

/**
 * A post that has not loaded yet must not look like a post that has no words.
 *
 * On a client-side navigation the body is a dynamic import of a per-post chunk.
 * Until it resolves the page rendered the meta, title, subtitle, hero and the
 * whole end-of-post footer — the rule, the newer/older cards, `ls ../posts` —
 * against an empty article. Measured on the unfixed build with the chunk held
 * 1500ms: 0 body characters and a 1203px document with the neighbour cards at
 * y=952, directly under the hero, then 14957 characters and 5764px when the
 * chunk landed. A 4.8x growth, and for the whole round trip the reader was
 * being offered the next post before this one had started.
 *
 * `post-body-recovery.spec.ts` is the neighbouring case and not this one: it is
 * about a chunk that never arrives, whose answer is a reload. This is a chunk
 * that is merely slow, where the answer is to say so and wait.
 *
 * No unit test sees the whole of this. The window only exists behind a real
 * dynamic import over a real client-side navigation; jsdom has neither, and the
 * component-level half of this lives in `src/pages/__tests__/BlogPost.test.tsx`.
 *
 * The chunk is held until this file releases it rather than delayed by a fixed
 * number of milliseconds, so the window is as wide as the assertions need on
 * any machine — a timing constant here would be a flake on a loaded CI runner.
 */

const SITEMAP = fileURLToPath(new URL("../dist/sitemap.xml", import.meta.url));

/** Derived from the sitemap so this cannot pin itself to a renamed post. */
const slug = [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>[^<]*\/blog\/([^/<]+)\/<\/loc>/g)]
  .map(([, s]) => s)
  .sort()[0];

/** The body chunk is emitted under the slug, one per post. */
const bodyChunk = `**/assets/${slug}-*.js`;

const bodyTextOf = (page: Page) => page.locator("[data-post-body]").innerText();

/** The end-of-post block, by the two things a reader would act on. */
const neighbourCards = (page: Page) => page.locator('nav[aria-label="More posts"]');
const archiveLink = (page: Page) => page.getByText("ls ../posts");

/**
 * react-router's key for the history entry currently on screen. `useFirstLoad`
 * compares this against the one the document loaded on, so it is what says
 * whether a navigation looks like a first load to the app.
 */
const entryKey = (page: Page) =>
  page.evaluate(() => (window.history.state as { key?: string } | null)?.key ?? "default");

/**
 * Reaches the post the way a reader does — from the index, client-side. Going
 * straight to the URL serves the body in the HTML and never fetches, which is
 * the path this spec is not about. The click (rather than a pushState) is what
 * waits out hydration: its actionability checks need the main thread React is
 * holding.
 */
const navigateToPost = async (page: Page) => {
  await page.goto("/blog/");
  await page.locator(`a[href="/blog/${slug}/"]`).first().click();
  await page.waitForURL(`**/blog/${slug}/`);
};

test.describe("a post body that is slow to arrive", () => {
  test("says it is loading rather than drawing the end of a post with no words in it", async ({
    page,
  }) => {
    let requested = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(bodyChunk, async (route) => {
      requested += 1;
      await held;
      // Slow, not gone: the chunk is served in full once this test has looked
      // at the page it left behind.
      return route.continue();
    });

    await navigateToPost(page);

    // The placeholder is the gate as well as the subject: it appears on the
    // same render the empty article does, so waiting for it puts every
    // assertion below inside the window rather than racing the route
    // transition into it.
    await expect(page.getByText("// loading")).toBeVisible();

    // The precondition. Everything below is about what the reader sees while
    // the body is missing, and a body that had quietly arrived would satisfy
    // the footer assertions for the wrong reason.
    expect((await bodyTextOf(page)).trim()).toBe("");

    await expect(
      neighbourCards(page),
      "the next post was offered before this one had any words"
    ).toHaveCount(0);
    await expect(archiveLink(page)).toHaveCount(0);

    release();

    // ...and it is a placeholder, not a permanent state: the body lands, the
    // placeholder goes, and the end of the post comes back. Without this a
    // build that suppressed the footer for good would pass everything above.
    await expect
      .poll(async () => (await bodyTextOf(page)).trim().length, {
        message: "the held chunk was released but the body never filled",
        timeout: 15_000,
      })
      .toBeGreaterThan(500);
    await expect(page.getByText("// loading")).toHaveCount(0);
    await expect(neighbourCards(page)).toHaveCount(1);
    await expect(archiveLink(page)).toBeVisible();

    // The hold was actually exercised — otherwise this passes on a build where
    // the route pattern stopped matching the emitted chunk name, having tested
    // an ordinary navigation.
    expect(requested, `no request matched ${bodyChunk}`).toBeGreaterThan(0);
  });

  /**
   * The same defect, reached from the other side — and the path the fix above
   * originally missed (PRA-930).
   *
   * `pending` used to require `!firstLoad`, on the reasoning that a first load
   * always has its body in the markup. But `firstLoad` is `key === loadedOnKey`
   * and react-router restores the *same* key on a POP back to the entry the
   * document loaded on. So a reader who arrives from a search result, clicks
   * away and presses Back is on `firstLoad` again with no markup left to read:
   * `AnimatePresence mode="wait"` unmounted it on the way out. Measured on the
   * unfixed build at that moment: the body chunk requested for the first time,
   * 0 body characters, no placeholder, and the newer/older cards directly under
   * the hero in an 1111px document that grew to 4196px when the chunk landed.
   */
  test("says it is loading when the reader comes Back to the post the tab was loaded on", async ({
    page,
  }) => {
    let requested = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(bodyChunk, async (route) => {
      requested += 1;
      await held;
      return route.continue();
    });

    // A document load, the way an external link arrives. The body is in the
    // HTML, so nothing is fetched — which is what makes the import on the way
    // back a cold one.
    await page.goto(`/blog/${slug}/`);
    expect((await bodyTextOf(page)).trim().length).toBeGreaterThan(500);
    expect(requested, "a document load should fetch no body chunk").toBe(0);
    const loadedKey = await entryKey(page);

    await archiveLink(page).first().click();
    await page.waitForURL("**/blog/");

    // Load-bearing, and the reason the first version of this test was vacuous.
    // The exit animation outlives the URL change by several hundred ms, and for
    // that window the outgoing post's `[data-post-body]` is still in the
    // document — so a Back pressed immediately finds it, adopts the body and
    // never fetches. Waiting for the unmount is the reader who spent a moment
    // looking at the archive, and it is the only version of this journey that
    // reaches the state below. A CSS locator rather than a role, because what
    // is being waited on is the node leaving the DOM.
    await expect(
      page.locator("[data-post-body]"),
      "the outgoing post never unmounted, so Back would adopt its markup"
    ).toHaveCount(0);

    await page.goBack();
    await page.waitForURL(`**/blog/${slug}/`);
    await expect(page.locator("[data-post-body]")).toHaveCount(1);

    // The precondition this whole test rests on: Back landed on the entry the
    // document was loaded onto, so `firstLoad` is true here. Without this the
    // test would silently become another forward-navigation case the moment
    // react-router changed how it keys a restored entry.
    expect(
      await entryKey(page),
      "Back did not land on the key this document loaded on"
    ).toBe(loadedKey);

    // ...and the body really is being fetched over the network, cold.
    await expect
      .poll(() => requested, { message: `no request matched ${bodyChunk}` })
      .toBeGreaterThan(0);

    expect((await bodyTextOf(page)).trim()).toBe("");
    await expect(page.getByText("// loading")).toBeVisible();
    await expect(
      neighbourCards(page),
      "the next post was offered before this one had any words"
    ).toHaveCount(0);
    await expect(archiveLink(page)).toHaveCount(0);

    // And it is a waiting state, not a wall: the chunk lands and the reader
    // gets the post they pressed Back for.
    release();
    await expect
      .poll(async () => (await bodyTextOf(page)).trim().length, {
        message: "the held chunk was released but the body never filled",
        timeout: 15_000,
      })
      .toBeGreaterThan(500);
    await expect(page.getByText("// loading")).toHaveCount(0);
    await expect(neighbourCards(page)).toHaveCount(1);
  });

  /**
   * Control. The whole spec above is about a held chunk; this is the same
   * journey with nothing held, and it pins that the placeholder belongs to the
   * waiting state rather than being on every post page.
   */
  test("shows no placeholder when the chunk arrives normally", async ({ page }) => {
    await navigateToPost(page);

    await expect
      .poll(async () => (await bodyTextOf(page)).trim().length, { timeout: 15_000 })
      .toBeGreaterThan(500);
    await expect(page.getByText("// loading")).toHaveCount(0);
    await expect(neighbourCards(page)).toHaveCount(1);
  });

  /**
   * The second half of PRA-914, and cheapest to check on a page a browser has
   * actually laid out. The hero is decorative abstract art; its `alt` was the
   * post title verbatim, which is the `<h1>` immediately above it — so a screen
   * reader read every post's title, then the identical title again as the
   * description of the picture. Measured on 24 of 24 posts.
   */
  test("does not describe the hero with the post's own headline", async ({ page }) => {
    await page.goto(`/blog/${slug}/`);

    const hero = page.locator("article img").first();
    await expect(hero).toBeVisible();

    // Present and empty, which is what takes a decorative image out of the
    // accessibility tree; absent would leave the filename as the fallback.
    expect(await hero.getAttribute("alt")).toBe("");
    const h1 = (await page.locator("h1").first().innerText()).trim();
    expect(h1.length, "no headline to compare against").toBeGreaterThan(0);
    expect((await hero.getAttribute("alt"))!.trim()).not.toBe(h1);
  });
});
