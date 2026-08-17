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

  /**
   * The subset scope, pinned so narrowing it takes a deliberate edit.
   *
   * Self-hosting cut the served subsets from the six Google's css2 returned for
   * these families (cyrillic, cyrillic-ext, greek, latin, latin-ext, vietnamese)
   * to latin and latin-ext. That is 668 codepoints — Greek, Cyrillic, the
   * Vietnamese precomposed block U+1EA0-1EF1, and the combining accents
   * U+0300-0301/0303/0309/0323 — that are no longer routed to a brand face at
   * all. It was an acceptable trade for the FCP win on an English-language site,
   * and nothing in the repo uses any of them, so this is not a regression to
   * revert.
   *
   * It is a decision, though, and until now nothing recorded it: the face-parity
   * spec matches on (family, weight, style) and the resolve check only asks for
   * a 200, so dropping latin-ext, or regressing a range to something narrower,
   * stayed green in both directions.
   *
   * What this pin is *not* is a statement about glyphs. `unicode-range` routes;
   * it says which face the browser should try for a codepoint, and says nothing
   * about whether the file behind that face contains it. Most of what these two
   * ranges route to a brand face is not in any committed .woff2 — measured, and
   * `e2e/font-glyph-coverage.spec.ts` is where that is checked, in a browser,
   * per character. Widening SUBSETS here does not make a character paintable;
   * only committing a file that has the glyph does.
   *
   * Restated here rather than read off fonts.css on purpose — the opposite of
   * how `e2e/font-face-probe.ts` derives its face set. Both of those have an
   * oracle to measure against (what a browser actually paints), so restating
   * them would only let the two copies drift. Which codepoints get *routed* has
   * no such oracle — a narrowed range renders perfectly, from the system stack,
   * for text nobody has written yet. A second independent copy is the whole
   * mechanism: widening or narrowing means editing both, which is exactly the
   * deliberate act being asked for.
   *
   * Values are Google's own, byte-for-byte, for
   * `css2?family=JetBrains+Mono:ital,wght@0,400;0,600;0,700;1,400&family=Space+Grotesk:wght@700`.
   */
  const SUBSETS = {
    latin:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, " +
      "U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    "latin-ext":
      "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, " +
      "U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, " +
      "U+2C60-2C7F, U+A720-A7FF",
  };

  /**
   * A `unicode-range` value as the set of codepoints it covers.
   *
   * Compared as sets, not as strings, so re-splitting or reordering a range is
   * not a failure while covering one codepoint fewer is. `U+0-FF` and
   * `U+0000-00FF` are the same declaration and should stay the same test result.
   */
  const codepoints = (range: string) => {
    const covered = new Set<number>();
    for (const part of range.split(",")) {
      const [from, to] = part.trim().replace(/^U\+/i, "").split("-");
      expect(from, `"${part}" should parse as a unicode-range item`).toMatch(/^[0-9a-f]+$/i);
      for (let c = parseInt(from, 16); c <= parseInt(to ?? from, 16); c++) covered.add(c);
    }
    return covered;
  };

  const sameSet = (a: Set<number>, b: Set<number>) =>
    a.size === b.size && [...a].every((c) => b.has(c));

  /** Every @font-face in fonts.css as (family, weight, style, unicode-range, src). */
  const declarations = [...fonts.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => {
    const value = (prop: string) =>
      body.match(new RegExp(`${prop}\\s*:\\s*([^;]+);`))?.[1].trim().replace(/^['"]|['"]$/g, "") ??
      "";
    return {
      face: `${value("font-family")}|${value("font-weight")}|${value("font-style")}`,
      range: value("unicode-range"),
      src: body.match(/url\(['"]?([^'")]+)['"]?\)/)?.[1] ?? "",
    };
  });

  it("declares a unicode-range on every face at all", () => {
    // Guards the parser and the assertions below, which are all per-declaration:
    // a regex matching nothing, or an omitted `unicode-range` (which means "all
    // codepoints" and would quietly hand every subset to one file), passes each
    // of them vacuously.
    expect(declarations.length).toBeGreaterThan(0);
    expect(declarations.filter((d) => !d.range).map((d) => d.face)).toEqual([]);
  });

  it("serves latin and latin-ext, and no other subset", () => {
    const expected = Object.entries(SUBSETS).map(([name, range]) => [name, codepoints(range)] as const);

    const unexpected = declarations
      .filter((d) => !expected.some(([, cps]) => sameSet(codepoints(d.range), cps)))
      .map((d) => `${d.face} -> ${d.range}`);
    expect(
      unexpected,
      "a face routes a codepoint set that is neither latin nor latin-ext. Widening the subset " +
        "scope is fine — commit the .woff2 and add the subset to SUBSETS here — but it has to be " +
        "deliberate, because a narrowed range still renders, in the system stack"
    ).toEqual([]);

    // The other direction: dropping latin-ext entirely would leave every
    // remaining declaration matching `latin` and pass the check above.
    for (const [name, cps] of expected) {
      expect(
        declarations.some((d) => sameSet(codepoints(d.range), cps)),
        `no face declares the ${name} subset any more`
      ).toBe(true);
    }
  });

  it("cuts every face across both subsets, not just latin", () => {
    // A face declared for latin alone is the narrowing this exists to catch, and
    // it is the shape a new face would arrive in if someone copied one rule and
    // forgot the second. The accented Latin in `latin-ext` is the subset a real
    // post is most likely to reach for — a name with a diacritic.
    const perFace = new Map<string, Set<string>>();
    for (const d of declarations) {
      const subset = Object.entries(SUBSETS).find(([, r]) =>
        sameSet(codepoints(d.range), codepoints(r))
      )?.[0];
      if (subset) perFace.set(d.face, (perFace.get(d.face) ?? new Set()).add(subset));
    }

    const partial = [...perFace]
      .filter(([, subsets]) => subsets.size !== Object.keys(SUBSETS).length)
      .map(([face, subsets]) => `${face} (only ${[...subsets].join(", ")})`);
    expect(partial.sort()).toEqual([]);
  });

  it("points each subset at the file cut for it", () => {
    // The files are named by subset, and swapping two would be invisible: both
    // resolve 200, both are real woff2, and the page paints — the latin-ext
    // codepoints just come back with no glyph and fall through to the fallback.
    const mismatched = declarations
      .map((d) => {
        const declared = Object.entries(SUBSETS).find(([, r]) =>
          sameSet(codepoints(d.range), codepoints(r))
        )?.[0];
        // Longest suffix first, or `-latin-ext.woff2` reads as `-latin`.
        const named = Object.keys(SUBSETS)
          .sort((a, b) => b.length - a.length)
          .find((s) => d.src.endsWith(`-${s}.woff2`));
        return declared === named ? null : `${d.src} declares ${declared}, filename says ${named}`;
      })
      .filter(Boolean);
    expect(mismatched.sort()).toEqual([]);
  });

  it("keeps a font stylesheet out of index.css beyond the local @font-face file", () => {
    // A remote @import would hide the font request behind our own CSS: the
    // browser has to download and parse index.css before it learns fonts exist.
    const imports = [...css.matchAll(/@import\s+(?:url\()?['"]?([^'")\s;]+)/g)].map(([, u]) => u);
    expect(imports).toEqual(["./styles/fonts.css"]);
  });
});
