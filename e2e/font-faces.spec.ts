import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect,
  openMobileMenu,
} from "./fixtures";
import { collectFaces, declaredFaces, FONTS_CSS, ours } from "./font-face-probe";

/**
 * Every (family, weight, style) the site paints is one `src/styles/fonts.css`
 * actually declares — and every face it declares is one the site paints.
 *
 * Both directions are defects, and the site had shipped the second one: the
 * request asked for 12 faces and the site painted 5, costing 30KB per route
 * (11KB of it a render-blocking third-party stylesheet, the rest binary,
 * because asking for a weight *range* makes Google serve a variable font
 * spanning it instead of a static instance).
 *
 * The fonts are self-hosted now, so an unpainted face costs a .woff2 committed
 * to the repo rather than third-party bytes — but the parity is the same, and
 * `no route reaches a third-party font host` below is what keeps it that way.
 *
 * The other direction is the regression this mostly exists to catch: add a
 * `font-medium` somewhere and 500 is no longer served, so the browser snaps it
 * to 400 or 600 and the design silently degrades with nothing going red.
 *
 * Measured in a browser, never grepped from source. Grepping `src/` for weight
 * utilities gets the answer wrong in both directions:
 *
 * - It misses **italic-400**, which is real (118 nodes across 13 routes) and
 *   which no stylesheet in this repo declares — `<em>` in post prose picks it
 *   up from the UA stylesheet.
 * - It would flag `font-weight: bolder`, which resolves against its parent and
 *   computes to 700 here, not to some ninth weight.
 *
 * Overlay states are swept explicitly. The per-route pass only ever sees the
 * resting page, so the terminal and the mobile menu — the two surfaces most
 * likely to carry their own type scale — would otherwise be invisible to it,
 * the same blind spot `a11y-axe.spec.ts` and `target-size.spec.ts` call out.
 */

const SITEMAP = fileURLToPath(new URL("../dist/sitemap.xml", import.meta.url));

const routes = [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  ([, loc]) => new URL(loc).pathname
);

// `declaredFaces` (what fonts.css declares) and `collectFaces` (what a document
// paints) live in `./font-face-probe` because `post-emphasis-faces.spec.ts`
// asks the same two questions of the renderer that this file asks of the built
// sitemap. Two copies could drift, and the drift would show up as one of the
// two going quietly green. Their reasoning moved with them.

/**
 * Which *characters* a face can paint is `font-glyph-coverage.spec.ts`.
 *
 * This file used to carry that too, as a hardcoded list of the 668 codepoints
 * self-hosting stopped serving — Greek, Cyrillic, the Vietnamese precomposed
 * block — checked against the text every route paints. The list existed because
 * `getComputedStyle` cannot see per-glyph fallback: the computed family still
 * reads as ours on exactly the text that is painting in something else, so
 * something had to say what to look for.
 *
 * Naming what to look for is what made it miss. It only ever considered
 * *undeclared* codepoints, and a declared one can be missing from the file just
 * as easily: on this machine 856 of the 1542 codepoints `fonts.css` routes to a
 * brand face paint from the system stack, more than the 668 the list covered.
 * CDP answers the question directly, per character, so the list is gone and
 * nothing has to be named for it to be caught. What stays here is the face
 * parity — (family, weight, style), measured against what the site paints.
 */
const DECLARED = declaredFaces();
const FAMILIES = new Set([...DECLARED].map((f) => f.split("|")[0]));

test.describe("the site paints exactly the font faces it requests", () => {
  test("fonts.css declares a plausible face set to begin with", () => {
    // Guards the parser itself: every assertion below is a subset check, and a
    // regex that silently matched nothing would make all of them vacuously
    // pass in the direction that matters.
    expect(DECLARED.size).toBeGreaterThan(0);
    expect(FAMILIES.size).toBeGreaterThan(0);
    for (const face of DECLARED) {
      expect(face, `"${face}" should parse as family|weight|style`).toMatch(
        /^[\w ]+\|\d{3}\|(normal|italic)$/
      );
    }
  });

  /**
   * The regression that made the fonts self-hosted in the first place.
   *
   * A render-blocking `<link>` to fonts.googleapis.com put first paint on every
   * route behind a third party: holding that stylesheet 1s/3s/6s produced an FCP
   * of 1048/3052/6048ms against a 32ms control, with fully prerendered HTML
   * sitting there unpainted the whole time. Re-adding one — or an `@import`, or
   * a `src: url(https://fonts.gstatic.com/...)` in fonts.css — brings it back.
   *
   * Asserted on requests the browser actually issues rather than by grepping
   * built HTML, so an @font-face `src` buried in the CSS bundle counts too.
   * Every route, because the regression would most likely arrive in index.html
   * and apply to all of them at once.
   */
  test("no route reaches a third-party font host", async ({ page }) => {
    const FONT_HOSTS = /fonts\.(googleapis|gstatic)\.com|use\.typekit|fonts\.bunny\.net/;
    const offenders: string[] = [];
    page.on("request", (req) => {
      if (FONT_HOSTS.test(req.url())) offenders.push(`${page.url()} -> ${req.url()}`);
    });

    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
    }

    expect(
      offenders,
      "first paint would again be a function of a third party's latency — see src/styles/fonts.css"
    ).toEqual([]);

    // Positive control: the listener does fire on a URL matching the pattern,
    // so an empty `offenders` means "no such request", not "no listener".
    await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await page.evaluate(() => {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Probe";
      document.head.append(l);
    });
    await expect.poll(() => offenders.length).toBeGreaterThan(0);
  });

  /**
   * Every file the declarations point at is actually served. A typo'd path is a
   * silent fallback to the system stack — the page still paints, so nothing else
   * here goes red, and `document.fonts.ready` resolves either way.
   */
  test("every declared font file resolves", async ({ page }) => {
    const urls = [
      ...new Set(
        [...readFileSync(FONTS_CSS, "utf8").matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map(
          ([, u]) => u
        )
      ),
    ];
    expect(urls.length, "fonts.css should point at some font files").toBeGreaterThan(0);

    await page.goto("/");
    const results = await Promise.all(
      urls.map(async (u) => {
        const res = await page.request.get(u);
        return `${u} ${res.status()} ${res.headers()["content-type"] ?? "?"}`;
      })
    );

    expect(results.filter((r) => !/ 200 /.test(r)).sort()).toEqual([]);
    expect(
      results.filter((r) => !/font\/woff2|application\/octet-stream/.test(r)).sort(),
      "served with a content-type no browser will treat as woff2"
    ).toEqual([]);
  });

  for (const route of routes) {
    test(`${route} paints no undeclared face`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      // Faces resolve as the webfonts land; before that everything reads as the
      // fallback stack and the sweep would find nothing of ours to check.
      await page.evaluate(() => document.fonts.ready);

      const painted = ours(await page.evaluate(collectFaces), FAMILIES);

      expect(
        painted.length,
        `${route} painted no ${[...FAMILIES].join("/")} text at all — the probe, not the page, is probably broken`
      ).toBeGreaterThan(0);

      expect(
        painted.filter((f) => !DECLARED.has(f)).sort(),
        `${route} at ${page.viewportSize()?.width}px paints faces fonts.css never declares. ` +
          `They are being snapped to the nearest weight that is actually served. ` +
          `Declared: ${[...DECLARED].sort().join(", ")}`
      ).toEqual([]);
    });
  }

  test("the open terminal paints no undeclared face", async ({ page }) => {
    await page.goto("/");
    // Clicked, not dispatched: actionability is what waits out hydration here.
    await page.locator('button[title="Open terminal (Ctrl+K)"]').click();
    await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();
    await page.evaluate(() => document.fonts.ready);

    // Run a good command and a bad one, so result and error rows both paint —
    // error styling is exactly the kind of thing that carries its own weight.
    await page.keyboard.type("help");
    await page.keyboard.press("Enter");
    await page.keyboard.type("zzznotacommand");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("textbox", { name: "Terminal command" })).toHaveValue("");

    const painted = ours(await page.evaluate(collectFaces), FAMILIES);
    expect(painted.length).toBeGreaterThan(0);
    expect(
      painted.filter((f) => !DECLARED.has(f)).sort(),
      `the open terminal paints faces fonts.css never declares. Declared: ${[...DECLARED].sort().join(", ")}`
    ).toEqual([]);
  });

  test("the open mobile menu paints no undeclared face", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= 768,
      "the [menu] button is md:hidden, so there is no overlay to open on desktop"
    );

    await page.goto("/");
    await openMobileMenu(page);
    await page.evaluate(() => document.fonts.ready);

    const painted = ours(await page.evaluate(collectFaces), FAMILIES);
    expect(painted.length).toBeGreaterThan(0);
    expect(
      painted.filter((f) => !DECLARED.has(f)).sort(),
      `the open mobile menu paints faces fonts.css never declares. Declared: ${[...DECLARED].sort().join(", ")}`
    ).toEqual([]);
  });

  /**
   * The other direction: a declared face nothing paints is the 30KB defect this
   * spec was written for. Asserted once over the union of every route and both
   * overlays rather than per route, because no single page paints all five.
   */
  test("every declared face is actually painted somewhere", async ({ page }) => {
    const painted = new Set<string>();

    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const f of ours(await page.evaluate(collectFaces), FAMILIES)) painted.add(f);
    }

    const mobile = (page.viewportSize()?.width ?? 0) < 768;
    await page.goto("/");
    if (mobile) {
      await openMobileMenu(page);
    } else {
      await page.locator('button[title="Open terminal (Ctrl+K)"]').click();
      await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();
    }
    await page.evaluate(() => document.fonts.ready);
    for (const f of ours(await page.evaluate(collectFaces), FAMILIES)) painted.add(f);

    expect(
      [...DECLARED].filter((f) => !painted.has(f)).sort(),
      `fonts.css declares faces nothing on the site paints. Each one costs @font-face bytes in ` +
        `the render-blocking CSS bundle, and ships a .woff2 in the repo that no reader ever ` +
        `downloads. Painted: ${[...painted].sort().join(", ")}`
    ).toEqual([]);
  });
});
