import { test, expect, type Page } from "./fixtures";
import { discoverPostSlugs } from "../scripts/blog-posts.mjs";

/**
 * What happens to the prerendered page once JavaScript arrives.
 *
 * `prerender-visibility.spec.ts` is the same question with `javaScriptEnabled:
 * false` — it proves the served HTML is readable. It structurally cannot see
 * this defect, because the defect only exists once React runs: `createRoot` on
 * a container that already has children deletes them and rebuilds. Every one of
 * the 27 prerendered pages was thrown away and re-created on every visit, which
 * on a throttled connection showed as a painted article going blank for ~200ms
 * about 270ms after LCP.
 *
 * So both specs stay, and this one runs with JavaScript on.
 *
 * The check is node identity, not appearance. A rebuilt page looks identical
 * once it settles — the whole failure is a window in the middle — so an
 * assertion about the final DOM passes against the broken build. Holding a
 * reference to the prerendered node and asking whether it is still in the
 * document cannot be satisfied by re-creating an identical one.
 */

const [firstPost] = discoverPostSlugs();

const ROUTES = [
  { name: "homepage", path: "/" },
  { name: "blog index", path: "/blog/" },
  { name: "post page", path: `/blog/${firstPost}/` },
];

type Survival = {
  captured: boolean;
  stillConnected: boolean;
  stillFirstChild: boolean;
  /** Shortest `#main-content` seen after it first had text. */
  minChars: number;
  /** Longest, i.e. the settled page. */
  maxChars: number;
  /** Frames on which `#main-content` was gone after having been present. */
  framesMissing: number;
};

/**
 * Grabs the prerendered root's first element child before React mounts, then
 * samples the main content every frame for as long as the page is open.
 *
 * Installed with `addInitScript` so it runs before the app's own module script.
 * The sampling is what turns "the page went blank" from a claim into a number:
 * `minChars` is the emptiest the page ever got, and a page that is rebuilt
 * passes through 0.
 */
const WATCH = () => {
  const state = {
    node: null as Element | null,
    minChars: Infinity,
    maxChars: 0,
    framesMissing: 0,
    seen: false,
  };
  (window as unknown as { __survival: typeof state }).__survival = state;

  const frame = () => {
    const root = document.getElementById("root");
    if (root && !state.node) state.node = root.firstElementChild;

    const main = document.getElementById("main-content");
    const chars = main?.textContent?.length ?? 0;

    if (chars > 0) {
      state.seen = true;
      state.minChars = Math.min(state.minChars, chars);
      state.maxChars = Math.max(state.maxChars, chars);
    } else if (state.seen) {
      state.framesMissing += 1;
      state.minChars = 0;
    }

    requestAnimationFrame(frame);
  };
  frame();
};

const observe = async (page: Page, path: string): Promise<Survival> => {
  await page.addInitScript(WATCH);
  await page.goto(path, { waitUntil: "networkidle" });
  // Long enough to cover the rebuild the audit timed: it landed ~270ms after
  // LCP and ran for ~200ms, and this is a local server with no throttling.
  await page.waitForTimeout(1500);

  return page.evaluate(() => {
    const s = (window as unknown as { __survival: Record<string, unknown> })
      .__survival as {
      node: Element | null;
      minChars: number;
      maxChars: number;
      framesMissing: number;
    };
    const root = document.getElementById("root");
    return {
      captured: s.node !== null,
      stillConnected: s.node?.isConnected ?? false,
      stillFirstChild: root?.firstElementChild === s.node,
      minChars: s.minChars,
      maxChars: s.maxChars,
      framesMissing: s.framesMissing,
    };
  });
};

test.describe("the prerendered page survives hydration", () => {
  for (const route of ROUTES) {
    test(`${route.name}: React adopts the prerendered DOM`, async ({ page }) => {
      const survival = await observe(page, route.path);

      // Guards the guard: if nothing was captured the assertions below are
      // vacuously true, which is the failure mode of a test like this.
      expect(survival.captured, "no prerendered node to watch").toBe(true);

      expect(
        survival.stillConnected,
        "the prerendered subtree was detached — React rebuilt the page instead of hydrating it"
      ).toBe(true);
      expect(survival.stillFirstChild).toBe(true);
    });

    test(`${route.name}: the content never blanks`, async ({ page }) => {
      const survival = await observe(page, route.path);

      expect(survival.maxChars).toBeGreaterThan(0);
      expect(
        survival.framesMissing,
        "#main-content disappeared after having been painted"
      ).toBe(0);
      // The typewriter in the hero adds and removes a couple of dozen
      // characters, so this is not an equality — but a rebuild empties the
      // element outright, which is nowhere near this floor.
      expect(
        survival.minChars,
        "the page shrank to a fraction of its content mid-load"
      ).toBeGreaterThan(survival.maxChars * 0.9);
    });
  }

  test("no route reports a hydration mismatch", async ({ page }) => {
    const problems: string[] = [];

    // React's production build does not print the descriptive warnings, but it
    // does still report a hydration failure that forced a client re-render —
    // as errors 418, 423 and 425. Those are exactly the ones this change is
    // about, so the minified build is enough to assert on and there is no need
    // to ship a development bundle to test it.
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });

    for (const route of ROUTES) {
      await page.goto(route.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
    }

    const hydration = problems.filter((text) =>
      /hydrat|did not match|invariant=(418|421|422|423|425)/i.test(text)
    );
    expect(hydration).toEqual([]);
  });

  test("a first load of a post page fetches no content chunk", async ({
    page,
  }) => {
    // The body arrives inside the document now, read straight back out of the
    // DOM by `prerenderedBody`. `loadPostContent` is a chained dynamic import
    // that the preload scanner cannot see, so it used to cost a round trip
    // after mount — ~187ms of the gap the audit measured — to fetch markup the
    // page was already displaying.
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(request.url());
    });

    await page.goto(`/blog/${firstPost}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    expect(
      scripts.filter((url) => url.includes(firstPost)),
      "the per-post content chunk was fetched for markup already in the document"
    ).toEqual([]);
    await expect(page.locator("article p").first()).toBeVisible();
  });

  test("a client-side navigation still loads a post body", async ({ page }) => {
    // The other half of the change: nothing above may come at the cost of the
    // route that has no prerendered markup to read. Here the post chunk *is*
    // the only source of the body.
    await page.goto("/blog/");
    await page.locator("main article h2 a").first().click();
    await page.waitForURL("**/blog/*/");

    await expect(page.locator("article p").first()).toBeVisible();
    // Same floor the prerender build step enforces for a post body.
    expect(await page.locator("article p").count()).toBeGreaterThanOrEqual(3);
  });

  /**
   * Reload is a document load, and everything above has to hold for it too.
   *
   * The two tests before this both start from `goto`, which lands on a history
   * entry react-router has never seen and therefore keys `"default"`. That is
   * the only shape of document load they cover, and `useFirstLoad` was written
   * against it — it asked whether the key was literally `"default"`.
   *
   * A reader who clicks into a post and presses reload does not produce that
   * shape. react-router keeps its key in `history.state`, the browser restores
   * `history.state` before any script runs, so the reloaded document comes up
   * on the generated key from the push. `useFirstLoad` read that as a
   * client-side navigation, `prerenderedBody` was skipped, and React hydrated
   * an empty article against served HTML carrying the whole body: two `#418`
   * mismatches and a `#423` recovery per reload, the article thrown away and
   * rebuilt, and a round trip for the post chunk. Measured on the unfixed
   * build; 0 errors and 0 chunk requests with the fix.
   */
  test("a reload of a post reached by a link is still a first load", async ({
    page,
  }) => {
    await page.goto("/blog/");
    await page.locator("main article h2 a").first().click();
    await page.waitForURL("**/blog/*/");
    await expect(page.locator("article p").first()).toBeVisible();

    // Watched only across the reload — the navigation above legitimately
    // fetches the chunk, which is what the test before this one pins.
    const problems: string[] = [];
    const scripts: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(request.url());
    });

    const slug = new URL(page.url()).pathname.split("/").filter(Boolean)[1];
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    // Guards the guard: a reload that somehow left the entry keyed `"default"`
    // would make this whole test a restatement of the first-load case.
    expect(
      await page.evaluate(() => (window.history.state as { key?: string } | null)?.key),
      "the reload did not land on a pushed history entry, so nothing here is the reload case"
    ).toBeTruthy();

    expect(
      problems.filter((text) => /hydrat|did not match|invariant=(418|421|422|423|425)/i.test(text)),
      "reloading a post reported a hydration failure"
    ).toEqual([]);
    expect(
      scripts.filter((url) => url.includes(slug)),
      "the reload refetched a post body the served HTML already carried"
    ).toEqual([]);
    expect(await page.locator("article p").count()).toBeGreaterThanOrEqual(3);
  });
});
