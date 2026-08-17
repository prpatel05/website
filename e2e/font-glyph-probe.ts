import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { COMMANDS, processTerminalCommand } from "@/lib/terminal-commands";
import { expect } from "./fixtures";
import { FONTS_CSS } from "./font-face-probe";

/**
 * Which characters a brand face actually paints — asked of the browser, because
 * nothing else in the repo can answer it.
 *
 * `unicode-range` is a *routing* instruction. It tells the browser which face to
 * try for a codepoint; it is not a claim that the file behind that face contains
 * the glyph. When the two disagree the browser silently drops through to the
 * system stack for that one character, mid-word, and every source-level check
 * still passes: the character is present, the range covers it, the page renders.
 *
 * The gap is not a rounding error. Sweeping all 1542 codepoints the declarations
 * route to a brand face through the probe below, 856 of them painted from the
 * system stack in every declared face — more than the 668 the *undeclared*
 * Greek/Cyrillic/Vietnamese subsets account for, which is the hazard the font
 * specs were built around. Among them: `‰` (U+2030), `‡`, `‒`, `―`, `‥`, `⁇`,
 * `‽`, every one of them inside the declared `U+2000-206F`. `0.3‰` is the same
 * two-typefaces-in-one-number defect as the `0.75 × 0.75 ≈ 0.42` those specs
 * were written for, in the half a range-reading check cannot see.
 *
 * Reading the .woff2 cmap instead would over-ban. fontTools finds 553 of the
 * declared codepoints in the six committed files; 686 of them paint. The extra
 * 133 are characters Chromium builds rather than looks up: precomposed Latin it
 * assembles from components the file does carry (`Ǭ` U+01EC, and 44 more), the
 * U+2000-200A spaces and the joiner and bidi controls it maps onto the space
 * glyph, and `‐` U+2010 and `‑` U+2011, which it substitutes despite their being in
 * none of the six files. That is not a rule anyone can apply from the outside
 * either — `Ǟ` U+01DE decomposes exactly as `Ǭ` does and falls back to Times. The
 * browser is the only oracle that gets both directions right, and CDP
 * `CSS.getPlatformFontsForNode` reports it directly: per painted run, the real
 * platform font and whether it came from a webfont.
 *
 * Those counts are what one macOS Chromium measured. Nothing here asserts them —
 * they move with the Chromium build and with what the host has installed, and a
 * pinned total would go red for reasons that have nothing to do with the site.
 * Every check measures the characters actually in front of it instead.
 */

export type Face = { family: string; weight: string; style: string };

/** A face as `family|weight|style`, the same spelling `font-face-probe` uses. */
export const faceKey = (f: Face) => `${f.family}|${f.weight}|${f.style}`;

/** Every (family, weight, style) with the `unicode-range` its rule declares. */
function faceRules(): { face: Face; range: string }[] {
  const css = readFileSync(FONTS_CSS, "utf8");
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => {
    const value = (prop: string) =>
      body.match(new RegExp(`${prop}\\s*:\\s*([^;]+);`))?.[1].trim().replace(/^['"]|['"]$/g, "") ??
      "";
    return {
      face: {
        family: value("font-family"),
        weight: value("font-weight"),
        style: value("font-style"),
      },
      range: value("unicode-range"),
    };
  });
}

/** The faces fonts.css declares, deduplicated across their subset rules. */
export function declaredFaceList(): Face[] {
  const seen = new Map<string, Face>();
  for (const { face } of faceRules()) seen.set(faceKey(face), face);
  const faces = [...seen.values()];
  expect(faces.length, "fonts.css should declare at least one face").toBeGreaterThan(0);
  return faces;
}

/**
 * Emoji are exempt, and not as a concession.
 *
 * No text font in any subset carries them — they come from the system emoji
 * font on every platform, by design, and always have. Flagging them would be
 * flagging the normal case, and a check that cries about the normal case gets
 * ignored on the day it is right. `Emoji_Component` covers the variation
 * selector U+FE0F and the skin-tone modifiers that ride along with them.
 */
export const isEmoji = (ch: string) =>
  /\p{Extended_Pictographic}|\p{Emoji_Component}/u.test(ch);

const POSTS = "src/data/blog-posts";

/** Post bodies and post metadata — both render, both are written per post. */
export function postFiles() {
  const bodies = readdirSync(join(POSTS, "content"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(POSTS, "content", f));
  const metadata = readdirSync(POSTS)
    .filter((f) => f.endsWith(".ts") && !["registry.ts", "types.ts"].includes(f))
    .map((f) => join(POSTS, f));
  return [...bodies, ...metadata];
}

/** Every non-ASCII, non-emoji character in post content, with the files using it. */
export function postCharacters() {
  const found = new Map<string, Set<string>>();
  for (const file of postFiles()) {
    for (const ch of readFileSync(file, "utf8")) {
      // ASCII is in latin on any plausible subset, and the corpus is mostly
      // ASCII, so skipping it keeps this from probing a few hundred thousand
      // characters to learn nothing.
      if (ch.codePointAt(0)! < 0x80 || isEmoji(ch)) continue;
      if (!found.has(ch)) found.set(ch, new Set());
      found.get(ch)!.add(file);
    }
  }
  return found;
}

const TERMINAL_SOURCE = "src/lib/terminal-commands.ts";

/** A verb no `case` matches, so the `default` branch is the one that prints. */
const TERMINAL_MISS = "zzznotacommand";

/**
 * Every command the terminal answers — the `case` labels and `COMMANDS` both.
 *
 * Two lists that can drift. `COMMANDS` is what `help` prints and the one an
 * enumeration would naturally reach for, but a `case` with no `COMMANDS` entry
 * is invisible to it, and a command that prints without being listed is exactly
 * the too-narrow enumeration the sweep above exists to stop. Reading them
 * together costs one regex and cannot be narrowed by either list going stale.
 */
export function terminalCommandNames(): string[] {
  const source = readFileSync(TERMINAL_SOURCE, "utf8");
  const cases = [...source.matchAll(/^\s*case "([^"]*)":/gm)].map(([, name]) => name);
  expect(
    cases.length,
    `no \`case "…":\` labels matched in ${TERMINAL_SOURCE}. The switch was rewritten, or restyled ` +
      `to single quotes, and this now reads as "the terminal prints nothing" — a scan that passes ` +
      `because it scanned nothing looks identical to a clean one`
  ).toBeGreaterThan(0);
  return [...new Set([...cases, ...Object.keys(COMMANDS), TERMINAL_MISS])];
}

/**
 * Every non-ASCII, non-emoji character the terminal can print, with the commands
 * that print it.
 *
 * Terminal output is authored copy — the box art, the bar chart, the ASCII logo,
 * the four navigation lines — and none of it is in the DOM until a visitor
 * types. That puts it outside both of the other scopes: the post scan reads
 * `src/data/blog-posts`, and the live scan reads what is on screen at the moment
 * it looks. The live sweep does open the terminal, but it typed `help` and one
 * miss, so the output of 13 of the 14 commands was never measured by anything.
 *
 * `processTerminalCommand` is pure and hands back its lines, so the whole set is
 * reachable without a browser. That beats typing a longer list of commands into
 * the live sweep: it is faster, it needs no viewport (the terminal is
 * desktop-only, the probe is not), and it grows on its own when command 15
 * lands.
 *
 * Arguments are not included. `echo` is run bare because what it prints back is
 * the visitor's own text, and this file is about the copy the site authored.
 */
export function terminalCharacters(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const name of terminalCommandNames()) {
    const result = processTerminalCommand(name);
    // `clear` and the empty command return an action with no lines to read.
    if (!("lines" in result)) continue;
    const where =
      name === TERMINAL_MISS ? "an unrecognised command" : name === "" ? "the empty command" : name;
    for (const { text } of result.lines) {
      for (const ch of text) {
        if (ch.codePointAt(0)! < 0x80 || isEmoji(ch)) continue;
        if (!found.has(ch)) found.set(ch, new Set());
        found.get(ch)!.add(where);
      }
    }
  }
  return found;
}

/**
 * Text painted in one of our families in the current document, with the face it
 * is painted in.
 *
 * Same traversal rules as `collectFaces` and for the same reasons. Families are
 * filtered here rather than after the fact because the question is per element:
 * a box-drawing character in a `ui-monospace` code block was never ours to
 * serve, while the same character in JetBrains Mono is the fallback this is
 * looking for. Note font matching falls back per *glyph*, so the computed family
 * still reads as ours on exactly the text that is painting in something else —
 * which is why the answer has to come from a font probe rather than from here.
 *
 * Runs in the page via `page.evaluate`, so it must stay self-contained: no
 * module-scope references, only browser globals.
 */
export const collectOurText = (families: string[]) => {
  const out: { text: string; face: string }[] = [];
  for (const el of document.querySelectorAll("body *")) {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? "")
      .join("");
    if (!text.trim()) continue;

    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;

    const family = style.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    if (families.includes(family)) out.push({ text, face: `${family}|${style.fontWeight}|${style.fontStyle}` });
  }
  return out;
};

export type Probe = { char: string; face: Face };
export type Paint = Probe & { fonts: string[]; fromBrandFace: boolean };

const CONTAINER = "__glyph-probe";

/**
 * A character every brand file has, painted alongside each batch below.
 *
 * `getPlatformFontsForNode` reports what was actually drawn, so a batch that was
 * never drawn answers "no fonts" for every span in it — indistinguishable, to
 * the caller, from "none of these characters exist in the font", and it reads as
 * every character failing rather than as the probe failing. Two ways to produce
 * that were reproduced here: a `display: none` container, and measuring in the
 * same frame the spans were inserted, which flipped 2-3 of the four checks in
 * this suite red on four runs out of five. The sentinel caught both by name.
 */
const SENTINEL = "A";

/**
 * How many characters one sentinel is allowed to vouch for.
 *
 * Not a viewport limit: sweeping all 1542 declared codepoints in one batch and
 * in 26 batches returns identical verdicts, so nothing is being culled for being
 * off-screen. It is only that a positive control covering 60 spans is a positive
 * control, and one covering 7710 is a formality.
 */
const BATCH = 60;

/**
 * Paint each character in each face and report which font the browser reached
 * for.
 *
 * The spans have to be drawn: a `display: none` container comes back with no
 * fonts at all, for every span, in every face. `visibility: hidden` does not —
 * measured, not assumed — but there is no reason to rely on that, so they are
 * pinned to the viewport's top-left at `opacity: 0`, painted but invisible, and
 * removed before returning so a caller can go on asserting about the page it was
 * already on.
 *
 * `isCustomFont` is the signal, not the family name: the committed Space Grotesk
 * file calls itself "Space Grotesk Light" internally (Google's naming for the
 * static instance it cut), so matching CDP's `familyName` against the CSS
 * `font-family` would report every heading on the site as a fallback.
 *
 * Chromium-only — `CSS.getPlatformFontsForNode` is a CDP method with no
 * cross-browser equivalent, and both Playwright projects here are Chromium.
 */
export async function paintedFrom(page: Page, probes: Probe[]): Promise<Paint[]> {
  if (probes.length === 0) return [];

  const cdp = await page.context().newCDPSession(page);
  const painted: Paint[] = [];
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");

    for (let start = 0; start < probes.length; start += BATCH) {
      const batch = probes.slice(start, start + BATCH);
      // The sentinel is measured in the batch's own first face, so it is subject
      // to whatever went wrong for the rest of the batch.
      const spans = [{ char: SENTINEL, face: batch[0].face }, ...batch];

      await page.evaluate(
        ({ spans, id }) => {
          const host = document.createElement("div");
          host.id = id;
          host.style.cssText =
            "position:fixed;top:0;left:0;opacity:0;pointer-events:none;z-index:-1;font-size:10px;line-height:12px";
          for (const p of spans) {
            const span = document.createElement("span");
            span.style.fontFamily = `'${p.face.family}'`;
            span.style.fontWeight = p.face.weight;
            span.style.fontStyle = p.face.style;
            span.textContent = p.char;
            host.append(span);
          }
          document.body.append(host);
        },
        { spans, id: CONTAINER }
      );

      // `unicode-range` means a subset is only fetched once a page paints a
      // codepoint inside it, so the spans above are what triggers the load.
      // Until it lands the probe measures the fallback stack and calls every
      // character uncovered.
      await page.waitForFunction(() => document.fonts.status === "loaded");
      // Then wait for the frame that draws them: two rAFs, because the first
      // fires before the compositor has committed the one it belongs to.
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      );

      const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
      const { nodeIds } = await cdp.send("DOM.querySelectorAll", {
        nodeId: root.nodeId,
        selector: `#${CONTAINER} > span`,
      });
      expect(
        nodeIds.length,
        "the probe spans should be reachable over CDP — otherwise every character below is measured against nothing"
      ).toBe(spans.length);

      const measured = [];
      for (const nodeId of nodeIds) {
        const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
        const used = fonts.filter((f) => f.glyphCount > 0);
        measured.push({
          fonts: used.map((f) => f.familyName),
          fromBrandFace: used.length > 0 && used.every((f) => f.isCustomFont),
        });
      }
      await page.evaluate((id) => document.getElementById(id)?.remove(), CONTAINER);

      const [sentinel, ...rest] = measured;
      expect(
        sentinel.fromBrandFace,
        `"${SENTINEL}" did not paint from a webfont in ${faceKey(batch[0].face)} — this batch was ` +
          `never drawn, so its verdicts are the absence of a measurement rather than a fallback ` +
          `(got ${sentinel.fonts.join(", ") || "no fonts"})`
      ).toBe(true);

      for (const [i, m] of rest.entries()) painted.push({ ...batch[i], ...m });
    }
    return painted;
  } finally {
    await page.evaluate((id) => document.getElementById(id)?.remove(), CONTAINER);
    await cdp.detach();
  }
}

/** `U+XXXX` for a character, the spelling every message here and in fonts.css uses. */
export const hex = (ch: string) =>
  `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
