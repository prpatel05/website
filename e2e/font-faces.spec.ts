import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixtures";

/**
 * Every (family, weight, style) the site paints is one the Google Fonts request
 * in `index.html` actually declares — and every face it declares is one the
 * site paints.
 *
 * Both directions are defects, and the site had shipped the second one: the
 * request asked for 12 faces and the site painted 5, costing 30KB per route
 * (11KB of it a render-blocking third-party stylesheet, the rest binary,
 * because asking for a weight *range* makes Google serve a variable font
 * spanning it instead of a static instance).
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
const INDEX_HTML = fileURLToPath(new URL("../index.html", import.meta.url));

const routes = [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  ([, loc]) => new URL(loc).pathname
);

/**
 * The faces `index.html` asks Google for, as a `family|weight|style` set.
 *
 * Read off the real `<link>` rather than restated here, so the test cannot
 * drift from the request it is guarding. Parses the `css2` grammar:
 * `family=Name:ital,wght@0,400;1,400` — axis names before `@`, tuples after,
 * and a bare `family=Name` with no axes meaning regular 400 only.
 */
function declaredFaces(): Set<string> {
  const html = readFileSync(INDEX_HTML, "utf8");
  const href = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/)?.[1];
  expect(href, "index.html should link a fonts.googleapis.com/css2 stylesheet").toBeTruthy();

  const faces = new Set<string>();
  for (const [, spec] of (href as string).replace(/&amp;/g, "&").matchAll(/family=([^&]+)/g)) {
    const [rawName, axisPart] = decodeURIComponent(spec).split(":");
    const family = rawName.replace(/\+/g, " ");

    if (!axisPart) {
      faces.add(`${family}|400|normal`);
      continue;
    }
    const [axes, tuples] = axisPart.split("@");
    const names = axes.split(",");
    for (const tuple of tuples.split(";")) {
      const values = tuple.split(",");
      const wght = values[names.indexOf("wght")] ?? "400";
      const ital = names.includes("ital") ? values[names.indexOf("ital")] : "0";
      faces.add(`${family}|${wght}|${ital === "1" ? "italic" : "normal"}`);
    }
  }
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
 * Faces in families we do not load are not ours to check: `ui-sans-serif` and
 * friends come from the fallback stack, cost nothing and are always available.
 */
function ours(faces: Iterable<string>, families: Set<string>) {
  return [...faces].filter((f) => families.has(f.split("|")[0]));
}

const DECLARED = declaredFaces();
const FAMILIES = new Set([...DECLARED].map((f) => f.split("|")[0]));

test.describe("the site paints exactly the font faces it requests", () => {
  test("index.html declares a plausible face set to begin with", () => {
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
        `${route} at ${page.viewportSize()?.width}px paints faces index.html never asks for. ` +
          `They are being snapped to the nearest weight Google did send. ` +
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
      `the open terminal paints faces index.html never asks for. Declared: ${[...DECLARED].sort().join(", ")}`
    ).toEqual([]);
  });

  test("the open mobile menu paints no undeclared face", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= 768,
      "the [menu] button is md:hidden, so there is no overlay to open on desktop"
    );

    await page.goto("/");
    await page.getByText("[menu]").click();
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const painted = ours(await page.evaluate(collectFaces), FAMILIES);
    expect(painted.length).toBeGreaterThan(0);
    expect(
      painted.filter((f) => !DECLARED.has(f)).sort(),
      `the open mobile menu paints faces index.html never asks for. Declared: ${[...DECLARED].sort().join(", ")}`
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
      await page.getByText("[menu]").click();
      await expect(page.getByRole("dialog", { name: "Site menu" })).toBeVisible();
    } else {
      await page.locator('button[title="Open terminal (Ctrl+K)"]').click();
      await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();
    }
    await page.evaluate(() => document.fonts.ready);
    for (const f of ours(await page.evaluate(collectFaces), FAMILIES)) painted.add(f);

    expect(
      [...DECLARED].filter((f) => !painted.has(f)).sort(),
      `index.html requests faces nothing on the site paints. Each one costs bytes on every ` +
        `route — a stylesheet that blocks render, plus a variable font spanning the extra ` +
        `weights instead of a static instance. Painted: ${[...painted].sort().join(", ")}`
    ).toEqual([]);
  });
});
