import { test, expect, type Page } from "./fixtures";

/**
 * A client-side navigation used to change the page in silence: the content
 * swapped, the `<title>` changed, and a screen-reader user was told nothing.
 * There was no live region anywhere in the app and nothing focused the incoming
 * route, so neither of the two mechanisms that produce an announcement existed.
 *
 * These tests assert the **text** the region receives, not that a region
 * exists. An empty `[aria-live]` div satisfies a count assertion and announces
 * nothing at all, which is the shipped behaviour wearing a costume.
 *
 * They also assert it is the **incoming** page's title. Reading the outgoing
 * one is the specific way this goes wrong — `document.title` is written by
 * react-helmet-async outside React's commit, and `AnimatePresence mode="wait"`
 * holds the previous route through a 300ms exit — and an announcement of the
 * wrong page is worse than none: the reader is told they are somewhere they are
 * not. Sampled from the click onward via a MutationObserver rather than polled
 * at the end, because a stale value that is later corrected is invisible to a
 * test that only looks once the dust has settled.
 */

const REGION = '[aria-live="polite"]';

const HOME_TITLE = "Pratik Patel — CTO & Chief Architect";
const BLOG_TITLE = "Blog — Pratik Patel";

/**
 * Records every value the live region holds from now on. Installed before the
 * click, so the first mutation the navigation causes is already being watched.
 */
const watchRegion = (page: Page) =>
  page.evaluate((selector) => {
    const node = document.querySelector(selector);
    if (!node) throw new Error(`no live region matching ${selector}`);
    const seen: string[] = [];
    new MutationObserver(() => seen.push(node.textContent ?? "")).observe(node, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    (window as unknown as { __announcements: string[] }).__announcements = seen;
  }, REGION);

const announcements = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __announcements: string[] }).__announcements
  );

test.describe("Route announcement", () => {
  /**
   * The region has to be in the prerendered HTML and it has to arrive empty.
   * A region that mounts with the incoming route is too late to announce it,
   * and one that arrives with text in it announces a page the reader has not
   * gone to yet.
   */
  test("ships one empty live region on a fresh load", async ({ page }) => {
    await page.goto("/blog/");

    const region = page.locator(REGION);
    await expect(region).toHaveCount(1);
    await expect(region).toHaveText("");
  });

  const NAVIGATIONS = [
    {
      name: "/ -> /blog/",
      from: "/",
      fromTitle: HOME_TITLE,
      click: 'a[href="/blog/"]',
      expected: BLOG_TITLE,
    },
    {
      name: "/blog/ -> /",
      from: "/blog/",
      fromTitle: BLOG_TITLE,
      click: "text=cd ~",
      expected: HOME_TITLE,
    },
  ];

  for (const nav of NAVIGATIONS) {
    test(`announces the incoming page on ${nav.name}`, async ({ page, viewport }) => {
      test.skip(
        viewport !== null && viewport.width < 768,
        "The links driven here live in the desktop nav / archive footer"
      );

      await page.goto(nav.from);

      // The precondition that makes the staleness check bite: the outgoing
      // title is really in the DOM before the click, so a hook reading
      // `document.title` on the route change would find it and announce it.
      await expect(page).toHaveTitle(nav.fromTitle);

      await watchRegion(page);

      // `.click()` rather than a bare keypress or a `goto`: actionability waits
      // out hydration, and the click is also the thing under test — a `goto` is
      // a fresh load, which the browser announces on its own.
      await page.click(nav.click);

      await expect(page.locator(REGION)).toHaveText(nav.expected);

      const seen = await announcements(page);
      expect(seen.length).toBeGreaterThan(0);
      // The whole sequence, not just where it settled.
      expect(seen).not.toContain(nav.fromTitle);
      expect(seen.at(-1)).toBe(nav.expected);
    });
  }

  /**
   * The post route is the one whose title is not a constant, so it is the one
   * that would break if the announcement ever went back to reading the DOM: its
   * chunk loads on navigation, which widens the window between the location
   * changing and the incoming Helmet flushing.
   */
  test("announces a post's own title, not the archive's", async ({ page, viewport }) => {
    test.skip(
      viewport !== null && viewport.width < 768,
      "Driven from the desktop archive grid"
    );

    await page.goto("/blog/");
    await expect(page).toHaveTitle(BLOG_TITLE);

    const card = page.locator("article").first();
    const link = card.locator("a");
    // The card's `<a>` wraps the whole tile — date, tags, subtitle and all — so
    // its own text is not the title. The `<h2>` is.
    const postTitle = (await card.locator("h2").innerText()).trim();

    await watchRegion(page);
    await link.click();

    const expected = `${postTitle} — Pratik Patel`;
    await expect(page.locator(REGION)).toHaveText(expected);

    const seen = await announcements(page);
    expect(seen).not.toContain(BLOG_TITLE);
    expect(seen.at(-1)).toBe(expected);

    // The page really is the one that was announced.
    await expect(page).toHaveTitle(expected);
  });
});
