import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Which characters a post may use, given the font subsets the site serves.
 *
 * `font-loading.test.ts` guards the declaration side: that fonts.css still
 * declares latin and latin-ext and nothing wider. This is the other half — that
 * the prose actually written stays inside what those declarations cover.
 *
 * There is no other way to notice. A character outside every `unicode-range` is
 * not an error anywhere: the character is present, the markdown parses, the
 * page renders, the prerender writes it, the suite is green. The only symptom
 * is that one glyph arrives from the system stack instead of the brand font,
 * which nothing in the pipeline can see and a reader only registers as the page
 * looking slightly off. The sharpest instance the repo has had was
 * `0.75 × 0.75 × 0.75 ≈ 0.42` — `×` is in the subset and `≈` is not, so a
 * single arithmetic expression rendered in two typefaces. That prose has since
 * been rewritten, which is why PUBLISHED below is empty.
 *
 * Scoped to blog posts on purpose. They are the surface that grows every week,
 * often unattended, written against a constraint that is invisible from the
 * author's side. The site's own chrome is static and changes under review.
 *
 * Coverage is read out of fonts.css rather than restated here, unlike the
 * subset pin in font-loading.test.ts. That pin exists so narrowing the scope
 * takes a deliberate edit in two places. This check has the opposite need: if
 * someone widens the scope — commits greek.woff2 and adds its @font-face — then
 * Greek becomes legal prose the same moment, and a restated copy here would
 * just be a second thing to remember.
 */

const POSTS = "src/data/blog-posts";

/** Every codepoint any declared @font-face will paint from a served subset. */
const covered = (() => {
  const fonts = readFileSync(join(POSTS, "..", "..", "styles", "fonts.css"), "utf8");
  const ranges = [...fonts.matchAll(/unicode-range:\s*([^;]+);/g)].map(([, r]) => r);
  const set = new Set<number>();
  for (const range of ranges) {
    for (const part of range.split(",")) {
      const [from, to] = part.trim().replace(/^U\+/i, "").split("-");
      for (let c = parseInt(from, 16); c <= parseInt(to ?? from, 16); c++) set.add(c);
    }
  }
  return { set, ranges };
})();

/**
 * Emoji are exempt, and not as a concession.
 *
 * No text font in any subset carries them — they come from the system emoji
 * font on every platform, by design, and always have. Flagging them would be
 * flagging the normal case, and a check that cries about the normal case gets
 * ignored on the day it is right. `Emoji_Component` covers the variation
 * selector U+FE0F and the skin-tone modifiers that ride along with them.
 */
const isEmoji = (ch: string) => /\p{Extended_Pictographic}|\p{Emoji_Component}/u.test(ch);

/** Post bodies and post metadata — both render, both are written per post. */
const postFiles = () => {
  const bodies = readdirSync(join(POSTS, "content"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(POSTS, "content", f));
  const metadata = readdirSync(POSTS)
    .filter((f) => f.endsWith(".ts") && !["registry.ts", "types.ts"].includes(f))
    .map((f) => join(POSTS, f));
  return [...bodies, ...metadata];
};

const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;

/** Every (character, file) pair in post content that no served subset covers. */
const uncovered = () => {
  const found = new Map<string, Set<string>>();
  for (const file of postFiles()) {
    for (const ch of readFileSync(file, "utf8")) {
      const cp = ch.codePointAt(0)!;
      // ASCII is in latin on any plausible subset; skipping it keeps the scan
      // from walking the whole corpus through the Set for no reason.
      if (cp < 0x80 || covered.set.has(cp) || isEmoji(ch)) continue;
      if (!found.has(ch)) found.set(ch, new Set());
      found.get(ch)!.add(file);
    }
  }
  return found;
};

/**
 * Characters allowed to stay outside the served subsets, per post.
 *
 * Empty, and worth the effort to keep that way.
 *
 * It held two entries when this check was written — `≈` in
 * teach-your-agent-to-ask-for-help and `→` used 3x in the-zero-dollar-startup —
 * recorded rather than fixed because editing live prose to satisfy a new lint
 * is the Content Writer's call, not this file's. That call has since been made:
 * both posts were rewritten in covered characters, so both entries are gone.
 * The arithmetic now reads "0.75 × 0.75 × 0.75, which is just over 0.42", which
 * renders in one face and is still checkable by the reader.
 *
 * An entry here is not a note, it is a permanent exemption for that character
 * in that post. Prefer rewriting: an arrow becomes prose or `-&gt;` in backticks,
 * `≈` becomes "about" or "just over", and U+2212 is already covered for minus.
 */
const PUBLISHED: { char: string; slug: string; note: string }[] = [];

/**
 * Whether an entry in PUBLISHED excuses this character in this file.
 *
 * Both directions go through here — "is this new" and "is this allowance
 * stale" — so the check cannot end up permitting a character it does not also
 * consider accounted for, which would make the stale entry undeletable.
 */
const isAllowed = (ch: string, file: string) =>
  PUBLISHED.some(({ char, slug }) => char === ch && file.includes(slug));

describe("font subset coverage of post content", () => {
  it("parses real ranges out of fonts.css", () => {
    // Everything below is "is this character in `covered`". A regex that stopped
    // matching would empty that set and turn the whole file into a check that
    // every post is entirely ASCII — which would fail loudly — or, if it went
    // the other way and over-matched, into one that passes on anything.
    expect(covered.ranges.length).toBeGreaterThan(0);
    expect(covered.set.size).toBeGreaterThan(1000);
  });

  it("agrees with the subsets about characters whose answer is known", () => {
    // A positive and a negative control on the parse, using characters the
    // declarations name explicitly. Without the negative one, a range parsed as
    // "everything" would satisfy every assertion in this file.
    for (const ch of ["—", "…", "’", "×", "²", "€", "™", "ł"]) {
      expect(covered.set.has(ch.codePointAt(0)!), `${ch} ${hex(ch.codePointAt(0)!)} should be covered`).toBe(true);
    }
    // Greek and Cyrillic are the subsets #119 deliberately stopped serving.
    for (const ch of ["α", "Ж", "≈", "→"]) {
      expect(covered.set.has(ch.codePointAt(0)!), `${ch} ${hex(ch.codePointAt(0)!)} should not be covered`).toBe(false);
    }
  });

  it("scans the posts that exist rather than a stale list", () => {
    const files = postFiles();
    expect(files.length).toBeGreaterThan(20);
    expect(files.filter((f) => f.includes("content/")).length).toBeGreaterThan(20);
  });

  it("introduces no character the pinned subsets cannot paint", () => {
    const violations = [...uncovered()]
      .flatMap(([ch, files]) => [...files].map((file) => ({ ch, file })))
      .filter(({ ch, file }) => !isAllowed(ch, file))
      .map(({ ch, file }) => `${ch} (${hex(ch.codePointAt(0)!)}) in ${file}`);

    expect(
      violations.sort(),
      "these characters fall outside every unicode-range in src/styles/fonts.css, so they " +
        "render from the system stack while the text around them renders in the brand font. " +
        "Nothing else catches this — the character is present, the body renders and the suite " +
        "is green. Prefer a covered equivalent (-> for an arrow, 'about' for ≈, - for a minus " +
        "sign is U+2212 and is covered). If the character is genuinely needed, widen the scope: " +
        "commit the subset's .woff2, add its @font-face to fonts.css, and add it to SUBSETS in " +
        "font-loading.test.ts."
    ).toEqual([]);
  });

  it("keeps no allowance for a character that is no longer there", () => {
    // An allowance nobody removes is how a lint quietly stops being one: the
    // next post to use → in the-zero-dollar-startup would pass on an entry left
    // behind by an edit that took the original out.
    const present = uncovered();
    const stale = PUBLISHED.filter(
      ({ char, slug }) => ![...(present.get(char) ?? [])].some((f) => f.includes(slug))
    ).map(({ char, slug }) => `${char} is no longer in ${slug}`);

    expect(
      stale,
      "delete these entries from PUBLISHED — the prose that needed them has been edited, and " +
        "leaving them behind re-permits the character in that post"
    ).toEqual([]);
  });
});
