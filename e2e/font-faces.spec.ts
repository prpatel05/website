import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect,
  openMobileMenu,
} from "./fixtures";

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
const FONTS_CSS = fileURLToPath(new URL("../src/styles/fonts.css", import.meta.url));

const routes = [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  ([, loc]) => new URL(loc).pathname
);

/**
 * The faces `src/styles/fonts.css` declares, as a `family|weight|style` set.
 *
 * Read off the real `@font-face` rules rather than restated here, so the test
 * cannot drift from the declarations it is guarding. One entry per (family,
 * weight, style) — a face split across `unicode-range` subsets is several rules
 * but one face, and which subset a glyph comes from is not what this measures.
 *
 * This parsed a `fonts.googleapis.com/css2` URL until the fonts were
 * self-hosted; the parity it asserts is unchanged.
 */
function declaredFaces(): Set<string> {
  const css = readFileSync(FONTS_CSS, "utf8");
  const faces = new Set<string>();

  for (const [, body] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const value = (prop: string) =>
      body.match(new RegExp(`${prop}\\s*:\\s*([^;]+);`))?.[1].trim().replace(/^['"]|['"]$/g, "");

    const family = value("font-family");
    const weight = value("font-weight");
    const style = value("font-style");
    expect(
      family && weight && style,
      `every @font-face in fonts.css should declare family, weight and style — got ${body}`
    ).toBeTruthy();

    faces.add(`${family}|${weight}|${style}`);
  }

  expect(faces.size, "fonts.css should declare at least one face").toBeGreaterThan(0);
  return faces;
}

/**
 * Every face actually painted in the current document.
 *
 * Only elements owning a non-empty text node count — an ancestor's computed
 * style is inherited, not painted, so counting every element would report faces
 * no glyph is ever drawn in. Invisible subtrees are skipped for the same
 * reason: `display:none` is the closed overlay, which the explicit overlay
 * cases below open properly.
 */
const collectFaces = () => {
  const seen = new Set<string>();
  for (const el of document.querySelectorAll("body *")) {
    const paintsText = [...el.childNodes].some(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
    );
    if (!paintsText) continue;

    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;

    const family = style.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    seen.add(`${family}|${style.fontWeight}|${style.fontStyle}`);
  }
  return [...seen];
};

/**
 * The 668 codepoints self-hosting stopped serving.
 *
 * Google's css2 returned six subsets for these families; `src/styles/fonts.css`
 * commits two. This is exactly the difference — Greek, Cyrillic, the Vietnamese
 * precomposed block, and the combining accents U+0300-0301/0303/0309/0323 that
 * only the vietnamese and cyrillic subsets carried. Text using any of them still
 * renders, in the system stack, mid-word, next to brand-font neighbours.
 *
 * That trade was made knowingly on the measurement that no content needed them.
 * The point of asserting it is that the measurement was a one-off: nothing stops
 * the next post from carrying a transliterated name, and the fallback is quiet.
 * Going red here is not "revert PRA-911" — it is "this post needs a subset;
 * commit the .woff2 and its rule, and widen `SUBSETS` in
 * src/lib/__tests__/font-loading.test.ts to match."
 *
 * Scoped to the *delta*, not to everything the declarations miss. Plenty of
 * painted codepoints have never been covered by either set — emoji across a
 * dozen posts, and U+2192, which Google's latin subset omits while carrying
 * U+2191 and U+2193 — so "uncovered" would report two dozen pre-existing
 * fallbacks that self-hosting did not cause and no committed file can fix.
 */
const DROPPED_SUBSETS =
  "U+0300-0301, U+0303, U+0309, U+0323, U+0370-0377, U+037A-037F, U+0384-038A, U+038C, " +
  "U+038E-03A1, U+03A3-052F, U+1C80-1C8A, U+1EA0-1EF1, U+2116, U+2DE0-2DFF, U+A640-A69F, " +
  "U+FE2E-FE2F";

const dropped = new Set<number>();
for (const part of DROPPED_SUBSETS.split(",")) {
  const [from, to] = part.trim().replace("U+", "").split("-");
  for (let c = parseInt(from, 16); c <= parseInt(to ?? from, 16); c++) dropped.add(c);
}

/**
 * Text painted in one of our families in the current document.
 *
 * Same traversal rules as `collectFaces` and for the same reasons. Families are
 * filtered here rather than after the fact because the question is per element:
 * a Greek letter in a `ui-monospace` code block was never ours to serve, while
 * the same letter in JetBrains Mono is the fallback this is looking for. Note
 * font matching falls back per *glyph*, so the computed family still reads as
 * ours on exactly the text that is painting in something else.
 */
const collectOurText = (families: string[]) => {
  const out: string[] = [];
  for (const el of document.querySelectorAll("body *")) {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? "")
      .join("");
    if (!text.trim()) continue;

    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;

    const family = style.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    if (families.includes(family)) out.push(text);
  }
  return out;
};

/** Every dropped codepoint in `texts`, with the word it appears in. */
function fallbackGlyphs(texts: string[]) {
  const found: string[] = [];
  for (const text of texts) {
    for (const ch of text) {
      const c = ch.codePointAt(0)!;
      if (!dropped.has(c)) continue;
      const word = text.split(/\s+/).find((w) => w.includes(ch)) ?? text;
      found.push(`U+${c.toString(16).toUpperCase().padStart(4, "0")} in "${word.slice(0, 40)}"`);
    }
  }
  return [...new Set(found)];
}

/**
 * Faces in families we do not load are not ours to check: `ui-sans-serif` and
 * friends come from the fallback stack, cost nothing and are always available.
 */
function ours(faces: Iterable<string>, families: Set<string>) {
  return [...faces].filter((f) => families.has(f.split("|")[0]));
}

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

  test("no content needs a subset self-hosting dropped", async ({ page }) => {
    const families = [...FAMILIES];
    const offenders: string[] = [];

    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      const texts = await page.evaluate(collectOurText, families);
      expect(texts.length, `${route} painted no text in ${families.join("/")}`).toBeGreaterThan(0);
      for (const g of fallbackGlyphs(texts)) offenders.push(`${route}: ${g}`);
    }

    // The terminal is authored copy like any other and the likeliest place for a
    // stray symbol, so it is swept rather than left to the resting page.
    await page.goto("/");
    const mobile = (page.viewportSize()?.width ?? 0) < 768;
    if (mobile) {
      await openMobileMenu(page);
    } else {
      await page.locator('button[title="Open terminal (Ctrl+K)"]').click();
      await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();
      await page.keyboard.type("help");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("textbox", { name: "Terminal command" })).toHaveValue("");
    }
    for (const g of fallbackGlyphs(await page.evaluate(collectOurText, families)))
      offenders.push(`overlay: ${g}`);

    expect(
      offenders.sort(),
      "this text paints in the system stack mid-word, because self-hosting ships latin and " +
        "latin-ext only. Add the subset's .woff2 and @font-face rule back and widen SUBSETS in " +
        "src/lib/__tests__/font-loading.test.ts — see DROPPED_SUBSETS above"
    ).toEqual([]);

    // Positive control: the probe does see a dropped codepoint when one is
    // painted in our family, so an empty `offenders` is "no such text" rather
    // than a traversal that quietly matched nothing.
    await page.evaluate((family) => {
      const p = document.createElement("p");
      p.textContent = "Ερμής Đặng";
      p.style.fontFamily = family;
      document.body.append(p);
    }, families[0]);
    expect(fallbackGlyphs(await page.evaluate(collectOurText, families)).length).toBeGreaterThan(0);
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
