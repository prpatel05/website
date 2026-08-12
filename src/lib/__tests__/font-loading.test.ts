import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
const css = readFileSync("src/index.css", "utf8");
const fonts = readFileSync("src/styles/fonts.css", "utf8");

/**
 * These fonts used to be a render-blocking `<link>` to fonts.googleapis.com, and
 * first paint on every route tracked that third party's latency 1:1 — hold the
 * stylesheet 3s and FCP was 3052ms against a 32ms control, with fully
 * prerendered HTML sitting there unpainted the whole time.
 *
 * This file guards the *declaration* side of the replacement. That no route
 * actually reaches a third-party font host is asserted in a browser, with a
 * positive control, by `e2e/font-faces.spec.ts` — a source-level check like this
 * one cannot see an @font-face `src` that arrives through some other import.
 */
describe("font loading", () => {
  it("declares every face itself instead of linking a third party", () => {
    expect(html).not.toMatch(/fonts\.googleapis\.com\/css2/);
    expect(html).not.toMatch(/<link[^>]+href="https:\/\/fonts\.(googleapis|gstatic)\.com/);
    expect(fonts).not.toMatch(/src:\s*url\(['"]?https?:/);
  });

  it("serves both families the design system uses, from our own origin", () => {
    for (const family of ["JetBrains Mono", "Space Grotesk"]) {
      expect(fonts, `${family} should be declared in fonts.css`).toContain(
        `font-family: '${family}'`
      );
    }
    // Every src is a root-relative /fonts/ path — a relative one would resolve
    // against the CSS bundle's own /assets/ directory and 404.
    const srcs = [...fonts.matchAll(/src:\s*url\(['"]?([^'")]+)['"]?\)/g)].map(([, u]) => u);
    expect(srcs.length).toBeGreaterThan(0);
    expect(srcs.filter((u) => !u.startsWith("/fonts/"))).toEqual([]);
  });

  it("swaps rather than blocking on every face", () => {
    // Without this a face is invisible for up to 3s while its file loads (FOIT),
    // which would hand back the delay self-hosting exists to remove.
    const faces = fonts.match(/@font-face\s*\{[^}]*\}/g) ?? [];
    expect(faces.length).toBeGreaterThan(0);
    expect(faces.filter((f) => !/font-display:\s*swap/.test(f))).toEqual([]);
  });

  it("preloads the two files that paint above the fold, with crossorigin", () => {
    // crossorigin is required even same-origin: font requests are CORS-mode, and
    // a preload without it is discarded and the file fetched a second time.
    for (const file of ["jetbrains-mono-latin.woff2", "space-grotesk-latin.woff2"]) {
      const tag = html.match(new RegExp(`<link[^>]+href="/fonts/${file}"[^>]*>`, "s"));
      expect(tag, `${file} should be preloaded from index.html`).toBeTruthy();
      expect(tag![0]).toMatch(/rel="preload"/);
      expect(tag![0]).toMatch(/as="font"/);
      expect(tag![0]).toMatch(/crossorigin/);
    }
  });

  it("preloads only what every route paints above the fold", () => {
    // Preloading a face most readers never see spends its bytes on the critical
    // path for nothing: latin-ext and the italic are left to unicode-range to
    // fetch on demand.
    const preloaded = [...html.matchAll(/<link[^>]+rel="preload"[^>]+href="([^"]+\.woff2)"/gs)].map(
      ([, u]) => u
    );
    expect(preloaded.sort()).toEqual([
      "/fonts/jetbrains-mono-latin.woff2",
      "/fonts/space-grotesk-latin.woff2",
    ]);
  });

  it("keeps a font stylesheet out of index.css beyond the local @font-face file", () => {
    // A remote @import would hide the font request behind our own CSS: the
    // browser has to download and parse index.css before it learns fonts exist.
    const imports = [...css.matchAll(/@import\s+(?:url\()?['"]?([^'")\s;]+)/g)].map(([, u]) => u);
    expect(imports).toEqual(["./styles/fonts.css"]);
  });
});
