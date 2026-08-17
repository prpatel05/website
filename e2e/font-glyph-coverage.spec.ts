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
  terminalCharacters,
  terminalCommandNames,
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
 * Three scopes, because each has a different oracle:
 *
 * - post content is read from `src/data/blog-posts`, so a banked post is checked
 *   before it has a route to paint on, and metadata counts as much as prose;
 * - terminal output is read from `processTerminalCommand`, which is pure, so
 *   every command's copy is checked without anybody having to type it;
 * - the live sweep walks every built route and both overlays, so the site's own
 *   chrome — which neither source scan can see — is checked as it renders.
 *
 * The terminal scope is the newest and the reason is worth keeping. This file
 * shipped with two, and the live sweep opened the terminal and typed `help` and
 * one miss — so 13 of the 14 commands printed nothing anybody measured, and the
 * `→`, `█ ░` and `═ ║ ╔ ╗ ╚ ╝` they print were absent from the list below
 * because nothing had ever shown them to a person, not because a person had
 * looked at them. The list was drawn around the sweep's reach and then read as
 * evidence about everything outside it. A render scan can only ever see what is
 * on screen when it looks, so authored copy that needs an interaction to exist
 * needs a source oracle, not a longer script of keystrokes.
 *
 * All three fail closed. A character that falls back is an offender unless
 * something below says otherwise in writing, which is the opposite of the
 * list-what-to-look-for shape that let the declared ranges hide behind
 * themselves.
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
 * "Sits inside a word" is the whole test, and it is the reason `→` is not here
 * despite being box-adjacent geometry by every other measure. The terminal
 * printed `→ Navigating to #about...` as a single text node: the arrow in Menlo,
 * the four words beside it in JetBrains Mono, one element, one sentence. That is
 * the defect, not an instance of the exemption, so the line was rewritten to
 * `->` rather than listed here. `75a54ec` had already taken the same character
 * out of a published post for the same reason while the site's own chrome went
 * on painting it, which is what an exemption granted on the strength of a
 * neighbouring shape would have preserved.
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
  // The next eight are what the terminal scope surfaced. Each stands alone on
  // its own run of the line — the logo occupies six lines by itself, the bars
  // are fenced by spaces from the label and the percentage — so there is no
  // brand glyph beside any of them to change typeface against.
  { char: "█", note: "the ASCII_LOGO, and the filled part of the skills bar chart" },
  { char: "░", note: "the unfilled remainder of the skills bar chart" },
  { char: "═", note: "ASCII_LOGO box art, printed by whoami" },
  { char: "║", note: "ASCII_LOGO box art, printed by whoami" },
  { char: "╔", note: "ASCII_LOGO box art, printed by whoami" },
  { char: "╗", note: "ASCII_LOGO box art, printed by whoami" },
  { char: "╚", note: "ASCII_LOGO box art, printed by whoami" },
  { char: "╝", note: "ASCII_LOGO box art, printed by whoami" },
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

  /**
   * The probe waits for the subset it is about to measure, not for idleness.
   *
   * `unicode-range` means the probe's own spans are what fetches a subset, and
   * the sentinel is what notices when the measurement beat the fetch. It did:
   * `[mobile-chrome] no terminal command needs a glyph…` went red on a full
   * suite while passing alone, reporting the sentinel `A` as Times in JetBrains
   * Mono 400 italic (PRA-1114). The wait was `document.fonts.status ===
   * "loaded"`, which is true whenever nothing is *currently* pending — the
   * window before a freshly-inserted span's fetch starts as much as the window
   * after it finishes.
   *
   * Holding the response widens the window the old wait could lose, from one run
   * in N on a loaded suite to most runs in isolation. Italic is the face to hold
   * because nothing on `/` is italic — `em` is the only italic in the site and it
   * only occurs in post bodies — so this is also the face the real failure
   * picked, and for the same reason.
   *
   * The delay only has to outlast the wait under test, and a fixed probe pays it
   * either way, so a second is generous rather than tuned. The first two
   * assertions are the anti-vacuity ones: if `/` ever starts painting italic, the
   * subset is already in the font set, no request is made, and this would pass
   * while holding nothing back.
   *
   * What holding it does *not* buy is determinism against the old wait, and the
   * distinction is worth stating because the reflex is to read a mutation test as
   * a proof. Reverting `paintedFrom` to `document.fonts.status` and running this
   * five times per project: `chromium` 4/5 red, `mobile-chrome` 3/5 red, always
   * with the sentinel as Times. Neither project is deterministic, because what is
   * being raced is not the 1s delay — it is whether `waitForFunction`'s first
   * poll happens before or after the span's fetch registers as pending. A test
   * cannot control that from outside, so this amplifies the defect rather than
   * pinning it, and a single green run of it against a reverted fix means
   * nothing. Against the fix it is 8/8 green in both projects, which is the
   * direction that has to be reliable: this guards `main`, and only the
   * amplification has to survive a revert.
   */
  test("waits for the subset it is about to measure, not for the absence of pending work", async ({
    page,
  }) => {
    const italic: Face = { family: "JetBrains Mono", weight: "400", style: "italic" };
    const shorthand = "italic 400 10px 'JetBrains Mono'";

    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate((font) => document.fonts.check(font), shorthand),
      `${faceKey(italic)} is already in the font set at rest, so the probe below will not fetch ` +
        `anything and the held response holds nothing. Pick a face the resting page does not paint.`
    ).toBe(false);

    // Every woff2 the page itself needed is loaded by now, so any request from
    // here is one the probe's paint triggered. Routing them all rather than a
    // filename keeps this from going quietly vacuous when a subset is renamed.
    const fetched: string[] = [];
    await page.route("**/*.woff2", async (route) => {
      fetched.push(new URL(route.request().url()).pathname);
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });

    const painted = await paintedFrom(page, [{ char: "é", face: italic }]);

    expect(
      fetched,
      "the probe painted an italic character and fetched no subset for it, so nothing was held " +
        "back and this test measured no race"
    ).not.toEqual([]);
    expect(painted.length, "one probe in, one verdict out").toBe(1);
    expect(
      painted
        .filter((p) => !p.fromBrandFace)
        .map((p) => describeFallback(p.char, p.face, p.fonts)),
      `the subset was held for 1s and ${fetched.join(", ")} did arrive, so a fallback here means ` +
        `the probe measured before waiting for the face — every verdict it reports is then the ` +
        `system stack rather than a glyph gap`
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

  test("no terminal command needs a glyph the brand faces do not have", async ({ page }) => {
    await page.goto("/");
    const characters = terminalCharacters();

    // Both projects run this. The terminal is desktop-only in the UI, but this
    // scope never opens it — the probe paints into its own hidden container, so
    // the phone project checks the same copy against the same faces.
    expect(
      terminalCommandNames().length,
      "the terminal answers more commands than this — an enumeration this short means the source " +
        "scan matched nothing and the set below is whatever `COMMANDS` happened to still hold"
    ).toBeGreaterThan(10);
    expect(
      characters.size,
      "terminal output is box art, a bar chart and an ASCII logo, so a run finding no non-ASCII " +
        "character in any of it has stopped reading the output rather than found it clean"
    ).toBeGreaterThan(0);

    const painted = await paintedFrom(page, inEveryFace(characters.keys()));
    const offenders = painted
      .filter((p) => !p.fromBrandFace && !byDesign.has(p.char))
      .map(
        (p) =>
          `${describeFallback(p.char, p.face, p.fonts)} — printed by ${[...characters.get(p.char)!]
            .sort()
            .join(", ")}`
      );

    expect(
      [...new Set(offenders)].sort(),
      "the terminal prints this from the system stack next to words in the brand font, and no " +
        "sweep of the rendered page will tell you: the copy does not exist until somebody types " +
        "the command. Rewrite it in a covered character (-> for an arrow), or, if it is standalone " +
        "geometry with no brand glyph beside it, say so in SYSTEM_STACK_BY_DESIGN above"
    ).toEqual([]);
  });

  test("nothing the site paints falls back to the system stack unannounced", async ({ page }) => {
    const faces = new Map(FACES.map((f) => [faceKey(f), f]));
    // Keyed on character *and* face, and carrying the character rather than
    // recovering it from the key: U+00A0 is non-ASCII and is a space, so
    // anything that splits the key back apart loses exactly the characters that
    // are hardest to spot in the rendered page to begin with.
    //
    // One spelling, read and written through the same function. It was written
    // out twice and the two drifted — a literal NUL on the write against a space
    // on the read, which no diff shows and no green run reaches, because the
    // read only happens for an offender. The separator is spelled as an escape
    // for the same reason it broke: a control character typed literally is
    // invisible in every tool that would otherwise catch it.
    const keyOf = (char: string, face: string) => `${char}\u0000${face}`;
    const seen = new Map<string, { char: string; face: Face; where: Set<string> }>();

    const record = (runs: { text: string; face: string }[], where: string) => {
      for (const { text, face } of runs) {
        // A face nothing declares is `font-faces.spec.ts`'s problem, not this
        // one — it is being snapped to some other weight, and which glyphs that
        // weight has is a question about the wrong face.
        if (!faces.has(face)) continue;
        for (const ch of text) {
          if (ch.codePointAt(0)! < 0x80 || isEmoji(ch)) continue;
          const key = keyOf(ch, face);
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
    //
    // What the terminal contributes here is its *chrome*: the title bar, the
    // welcome banner, the prompt, the shell of the thing. Command output is the
    // scope above's, which reads it out of `processTerminalCommand` instead of
    // typing for it. Two commands are still typed, because a rendered line is
    // the only proof that what the pure function returns is what reaches the
    // page — but they are a spot check on the wiring now, not the coverage.
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
      [...seen.get(keyOf(p.char, faceKey(p.face)))!.where].sort().join(", ");

    // `where` runs only for an offender, so on a green run — every run so far —
    // nothing reads a key back. That is how the write and the read drifted apart
    // unnoticed: the reporting path of a check with nothing to report is dead
    // code that still has to work on the one day it matters. Resolve every key
    // now, while there is nothing to report, so a lookup that cannot find its
    // own entry fails here and says so, instead of throwing a TypeError out of
    // the line that was supposed to name the defect.
    expect(
      painted
        .filter((p) => !seen.has(keyOf(p.char, faceKey(p.face))))
        .map((p) => `${hex(p.char)} in ${faceKey(p.face)}`),
      "every probed (character, face) came out of `seen`, so each must key back into it — if this " +
        "is non-empty, `keyOf` disagrees with itself and the offender report below would crash"
    ).toEqual([]);

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
