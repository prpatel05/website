import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, openMobileMenu } from "./fixtures";
import { declaredFaces } from "./font-face-probe";
import {
  collectOurText,
  declaredFaceList,
  faceKey,
  hex,
  isEmoji,
  paintedFrom,
  postCharacters,
  postFiles,
  type Face,
  type Probe,
} from "./font-glyph-probe";

/**
 * Every character the site puts in a brand face comes out of a brand face.
 *
 * The three font checks that came before this one all asked `unicode-range`.
 * `font-subset-coverage.test.ts` parsed the ranges out of fonts.css and checked
 * post prose against them; `font-loading.test.ts` pinned the same ranges against
 * a second hardcoded copy; `font-faces.spec.ts` compensated for `getComputedStyle`
 * being blind to per-glyph fallback with a hardcoded list of the codepoints
 * self-hosting stopped serving. A range is a routing instruction, though — it
 * says which face to *try*, not that the file behind it has the glyph — so all
 * three agreed with each other about codepoints that paint from the system
 * stack. `‰` (U+2030) sits inside the declared `U+2000-206F`, and on this
 * machine it paints in Times: `0.3‰` is `0.75 × 0.75 ≈ 0.42` all over again,
 * two typefaces in one number, with every one of those checks green.
 *
 * So this file asks the browser instead, per character, in every declared face.
 * The measurement replaces both enumerations: nobody has to list Greek for Greek
 * to be caught, and nothing has to be listed for `‰` to be caught either.
 *
 * Two scopes, because the two have different oracles:
 *
 * - post content is read from `src/data/blog-posts`, so a banked post is checked
 *   before it has a route to paint on, and metadata counts as much as prose;
 * - the live sweep walks every built route and both overlays, so the site's own
 *   chrome — which the file scan cannot see — is checked as it actually renders.
 *
 * Both fail closed. A character that falls back is an offender unless something
 * below says otherwise in writing, which is the opposite of the list-what-to-
 * look-for shape that let the declared ranges hide behind themselves.
 */

const SITEMAP = fileURLToPath(new URL("../dist/sitemap.xml", import.meta.url));

const routes = [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  ([, loc]) => new URL(loc).pathname
);

const FACES = declaredFaceList();
const FAMILIES = [...new Set([...declaredFaces()].map((f) => f.split("|")[0]))];

/** The same character in every face the site could set it in. */
const inEveryFace = (chars: Iterable<string>): Probe[] =>
  [...chars].flatMap((char) => FACES.map((face) => ({ char, face })));

const describeFallback = (char: string, face: Face, fonts: string[]) =>
  `${char} (${hex(char)}) in ${faceKey(face)} paints from ${fonts.join(", ") || "no font at all"}`;

/**
 * Characters allowed to stay outside the served subsets, per post.
 *
 * Empty, and worth the effort to keep that way.
 *
 * It held two entries when the check this replaces was written — `≈` in
 * teach-your-agent-to-ask-for-help and `→` used 3x in the-zero-dollar-startup —
 * recorded rather than fixed because editing live prose to satisfy a new lint is
 * the Content Writer's call, not this file's. That call has since been made:
 * both posts were rewritten in covered characters, so both entries are gone. The
 * arithmetic now reads "0.75 × 0.75 × 0.75, which is just over 0.42", which
 * renders in one face and is still checkable by the reader.
 *
 * An entry here is not a note, it is a permanent exemption for that character in
 * that post. Prefer rewriting: an arrow becomes prose or `-&gt;` in backticks, `≈`
 * becomes "about" or "just over", and U+2212 is a minus sign that does paint.
 */
const PUBLISHED: { char: string; slug: string; note: string }[] = [];

/**
 * Characters the site paints from the system stack on purpose.
 *
 * All of these are geometry rather than letters — no text subset of either
 * family carries them, and none of them sits inside a word, so none produces the
 * mid-sentence typeface change this file exists to stop. They are listed
 * character by character rather than by block so that adding one is a decision
 * somebody makes rather than a range somebody widens.
 *
 * Not checked for staleness, unlike PUBLISHED: the terminal is desktop-only and
 * the mobile menu is phone-only, so neither Playwright project paints all of
 * these and "unused here" would be wrong in both.
 */
const SYSTEM_STACK_BY_DESIGN: { char: string; note: string }[] = [
  { char: "▸", note: "the bullet scripts/markdown-html.mjs gives every list item" },
  { char: "▊", note: "the blinking cursor in the hero" },
  { char: "─", note: "terminal rules and box art, src/lib/terminal-commands.ts" },
  { char: "┌", note: "terminal box art" },
  { char: "┐", note: "terminal box art" },
  { char: "└", note: "terminal box art" },
  { char: "┘", note: "terminal box art" },
];

const byDesign = new Set(SYSTEM_STACK_BY_DESIGN.map((e) => e.char));

test.describe("the site paints every character in the face it asked for", () => {
  /**
   * The probe itself, against characters whose answer is known independently.
   *
   * Everything below is "did this character come from a webfont", so a probe
   * that answered "yes" to everything would pass both checks vacuously, and one
   * that answered "no" to everything would bury the real offenders in noise.
   *
   * `‰` is the control that matters. It is inside the declared `U+2000-206F` —
   * so the checks this file replaces all called it covered — and no committed
   * .woff2 contains it. If it ever starts passing here, either a subset grew or
   * the probe stopped measuring.
   */
  test("tells a served glyph from one the browser substituted", async ({ page }) => {
    await page.goto("/");

    // The escape is a non-breaking space: non-ASCII, invisible, and a space, so
    // it is both easy for a post to acquire and easy for a probe to mishandle.
    // It does paint from the brand font, and a check that reported it as a
    // fallback would be crying about the normal case.
    const served = ["—", "é", "×", "’", "…", "\u00a0"];
    const substituted = [
      "‰", // U+2030, declared by every latin rule, absent from every file
      "≈", // U+2248, outside every range — the original two-typeface defect
      "α", // U+03B1, one of the subsets self-hosting stopped serving
      "Ж", // U+0416, likewise
    ];

    const painted = await paintedFrom(page, [...inEveryFace(served), ...inEveryFace(substituted)]);

    expect(
      painted
        .filter((p) => served.includes(p.char) && !p.fromBrandFace)
        .map((p) => describeFallback(p.char, p.face, p.fonts))
        .sort(),
      "these characters are in the committed subsets and should paint from them"
    ).toEqual([]);

    expect(
      painted
        .filter((p) => substituted.includes(p.char) && p.fromBrandFace)
        .map((p) => `${p.char} (${hex(p.char)}) in ${faceKey(p.face)}`)
        .sort(),
      "no committed .woff2 has these glyphs, so a webfont answer means the probe is reporting the " +
        "face that was asked for rather than the font that painted"
    ).toEqual([]);
  });

  test("scans the posts that exist rather than a stale list", () => {
    const files = postFiles();
    expect(files.length).toBeGreaterThan(20);
    expect(files.filter((f) => f.includes("content/")).length).toBeGreaterThan(20);
    expect(FACES.length, "fonts.css should declare faces to measure against").toBeGreaterThan(0);
  });

  test("no post needs a glyph the brand faces do not have", async ({ page }) => {
    await page.goto("/");
    const characters = postCharacters();

    const filesUsing = (char: string) => [...characters.get(char)!].sort();
    const allowed = (char: string) =>
      PUBLISHED.some((p) => p.char === char && filesUsing(char).some((f) => f.includes(p.slug)));

    const painted = await paintedFrom(page, inEveryFace(characters.keys()));
    const offenders = painted
      .filter((p) => !p.fromBrandFace && !allowed(p.char))
      .map(
        (p) =>
          `${describeFallback(p.char, p.face, p.fonts)} — in ${filesUsing(p.char).join(", ")}`
      );

    expect(
      [...new Set(offenders)].sort(),
      "these characters render from the system stack while the words around them render in the " +
        "brand font. Nothing else catches it — the character is present, the body renders and the " +
        "suite is green. Prefer a covered equivalent (-> for an arrow, 'about' for ≈, U+2212 for a " +
        "minus sign). If the character is genuinely needed, the fix is a font file, not a range: " +
        "commit a subset that contains the glyph and add its @font-face to src/styles/fonts.css."
    ).toEqual([]);

    // An allowance nobody removes is how a lint quietly stops being one: the
    // next post to use → in the-zero-dollar-startup would pass on an entry left
    // behind by an edit that took the original out.
    expect(
      PUBLISHED.filter(
        ({ char, slug }) => ![...(characters.get(char) ?? [])].some((f) => f.includes(slug))
      ).map(({ char, slug }) => `${char} is no longer in ${slug}`),
      "delete these entries from PUBLISHED — the prose that needed them has been edited, and " +
        "leaving them behind re-permits the character in that post"
    ).toEqual([]);
  });

  test("nothing the site paints falls back to the system stack unannounced", async ({ page }) => {
    const faces = new Map(FACES.map((f) => [faceKey(f), f]));
    // Keyed on character *and* face, and carrying the character rather than
    // recovering it from the key: U+00A0 is non-ASCII and is a space, so
    // anything that splits the key back apart loses exactly the characters that
    // are hardest to spot in the rendered page to begin with.
    const seen = new Map<string, { char: string; face: Face; where: Set<string> }>();

    const record = (runs: { text: string; face: string }[], where: string) => {
      for (const { text, face } of runs) {
        // A face nothing declares is `font-faces.spec.ts`'s problem, not this
        // one — it is being snapped to some other weight, and which glyphs that
        // weight has is a question about the wrong face.
        if (!faces.has(face)) continue;
        for (const ch of text) {
          if (ch.codePointAt(0)! < 0x80 || isEmoji(ch)) continue;
          const key = `${ch} ${face}`;
          if (!seen.has(key))
            seen.set(key, { char: ch, face: faces.get(face)!, where: new Set() });
          seen.get(key)!.where.add(where);
        }
      }
    };

    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      // Faces resolve as the webfonts land; before that everything reads as the
      // fallback stack and the sweep would find nothing of ours to check.
      await page.evaluate(() => document.fonts.ready);
      const runs = await page.evaluate(collectOurText, FAMILIES);
      expect(runs.length, `${route} painted no text in ${FAMILIES.join("/")}`).toBeGreaterThan(0);
      record(runs, route);
    }

    // The terminal and the mobile menu are authored copy like any other and the
    // likeliest place for a stray symbol, so they are swept rather than left to
    // the resting page — the same blind spot the other overlay sweeps call out.
    await page.goto("/");
    if ((page.viewportSize()?.width ?? 0) < 768) {
      await openMobileMenu(page);
    } else {
      await page.locator('button[title="Open terminal (Ctrl+K)"]').click();
      await expect(page.getByRole("textbox", { name: "Terminal command" })).toBeFocused();
      await page.keyboard.type("help");
      await page.keyboard.press("Enter");
      await page.keyboard.type("zzznotacommand");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("textbox", { name: "Terminal command" })).toHaveValue("");
    }
    await page.evaluate(() => document.fonts.ready);
    record(await page.evaluate(collectOurText, FAMILIES), "the open overlay");

    expect(
      seen.size,
      "the sweep found no non-ASCII text at all — the probe, not the page, is probably broken"
    ).toBeGreaterThan(0);

    const painted = await paintedFrom(
      page,
      [...seen.values()].map(({ char, face }) => ({ char, face }))
    );

    const where = (p: { char: string; face: Face }) =>
      [...seen.get(`${p.char} ${faceKey(p.face)}`)!.where].sort().join(", ");

    const offenders = painted
      .filter((p) => !p.fromBrandFace && !byDesign.has(p.char))
      .map((p) => `${describeFallback(p.char, p.face, p.fonts)} — on ${where(p)}`);

    expect(
      offenders.sort(),
      "this text paints in the system stack mid-word, next to brand-font neighbours, and " +
        "`getComputedStyle` still reports our family on it because font matching falls back per " +
        "glyph. Either rewrite it in a character the committed subsets have, or commit a subset " +
        "that has this one and add its @font-face to src/styles/fonts.css. If the site is meant " +
        "to paint it from the system stack, say so in SYSTEM_STACK_BY_DESIGN above"
    ).toEqual([]);
  });
});
