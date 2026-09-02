import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect } from "./fixtures";

/**
 * What a font face *is*, and how to see one being painted — shared by the two
 * specs that assert something about faces.
 *
 * `font-faces.spec.ts` measures the sample: it walks the built sitemap and
 * checks the faces the posts that happen to exist paint. `post-emphasis-faces.
 * spec.ts` measures the renderer: it feeds emphasis forms through the real
 * markdown pipeline and checks the faces *any* post could paint. They ask
 * different questions, but they have to agree on the two definitions below —
 * otherwise one of them can go green because it parsed `fonts.css` slightly
 * differently or counted a painting element slightly differently, which is the
 * failure mode neither would report.
 *
 * Both definitions carry the reasoning that produced them; it was measured for
 * PRA-911 and is not obvious from the code.
 */

/** The one file that decides which faces exist; exported so callers that read
 *  it for other reasons (the `url()`s, say) cannot point at a different copy. */
export const FONTS_CSS = fileURLToPath(new URL("../src/styles/fonts.css", import.meta.url));

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
export function declaredFaces(): Set<string> {
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
 * Every face actually painted under `selector` — the whole document by default.
 *
 * Only elements owning a non-empty text node count — an ancestor's computed
 * style is inherited, not painted, so counting every element would report faces
 * no glyph is ever drawn in. Invisible subtrees are skipped for the same
 * reason: `display:none` is the closed overlay, which the explicit overlay
 * cases in `font-faces.spec.ts` open properly.
 *
 * Runs in the page via `page.evaluate`, so it must stay self-contained: no
 * module-scope references, only browser globals.
 *
 * The scoping argument exists for `post-emphasis-faces.spec.ts`, which injects
 * a body into a real post route and must not re-measure the navbar and footer
 * around it — those are the sample `font-faces.spec.ts` already covers, and
 * counting them here would make a fault in the injected body indistinguishable
 * from ambient page chrome.
 */
export const collectFaces = (selector?: string) => {
  const root = selector ? document.querySelector(selector) : document.body;
  if (!root) return [];

  const seen = new Set<string>();
  for (const el of root.querySelectorAll("*")) {
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
export function ours(faces: Iterable<string>, families: Set<string>) {
  return [...faces].filter((f) => families.has(f.split("|")[0]));
}
