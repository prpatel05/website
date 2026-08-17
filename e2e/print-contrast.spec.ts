import { readFileSync, readdirSync } from "node:fs";

import { renderMarkdownToHtml } from "../scripts/markdown-html.mjs";
import { test, expect, type Page } from "./fixtures";

/*
 * Printing is the one reader action that changes the background out from under
 * the whole palette. Chrome's default Print / Save as PDF drops backgrounds, so
 * every colour picked against `--background: 220 15% 5%` lands on white paper
 * instead, and nothing on screen goes red when it does.
 *
 * The failure this gate exists for was not uniform, which is why it survived so
 * long. Chrome darkens *achromatic* text on the print path by itself — the
 * body's `rgb(157,163,175)` reached paper as `rgb(81,84,90)`, 7.59:1 — while
 * leaving saturated colour exactly as authored. So the prose printed fine and
 * `--primary: 160 100% 50%` printed as literal `rgb(0,255,170)`: links at
 * 1.32:1, `em` at 1.30:1, `strong` and every `h2` at 2.50:1. A printed post
 * kept its paragraphs and lost every word the author had marked (PRA-1063).
 *
 * ## Why computed style is the oracle here, and not the emitted PDF
 *
 * The honest instrument is `page.pdf()` rasterized and sampled, and that is how
 * the fix was measured. It is not the gate: rasterizing a PDF needs a tool that
 * is not on the CI image, and Chrome's achromatic darkening means the PDF and
 * the computed style disagree *before* a fix. They agree after one — the
 * post-fix sheet read back `rgb(26,29,35)` for `h1`, exactly the token — so a
 * computed-style gate is exact on a passing tree and merely conservative on a
 * failing one. It cannot pass something the PDF would fail.
 *
 * ## Why white, unconditionally
 *
 * The nearest painted ancestor background is deliberately ignored. Chrome only
 * paints backgrounds when the reader ticks "Background graphics", which is off
 * by default, so the sheet under any given glyph is paper. Compositing against
 * the on-screen ancestor instead would let the dark `bg-card` behind a code
 * block vouch for text that prints on white.
 */

const ROUTES = ["/blog/your-eval-suite-measures-the-wrong-thing/", "/blog/", "/"];

const PAPER: [number, number, number] = [255, 255, 255];

const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const luminance = ([r, g, b]: number[]) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const contrast = (a: number[], b: number[]) => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/*
 * An alpha modifier — `text-primary/60` — is the whole reason the token flip in
 * `@media print` was not enough on its own, so the gate has to see through it:
 * a colour is composited onto the paper before it is measured, exactly as the
 * printer does it. A fully transparent colour paints nothing and is skipped.
 */
const inkOnPaper = (value: string): number[] | null => {
  const parts = value.match(/rgba?\(([^)]+)\)/);
  if (!parts) return null;
  const n = parts[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  if (n.length < 3 || n.some(Number.isNaN)) return null;
  const alpha = n.length > 3 ? n[3] : 1;
  if (alpha === 0) return null;
  return [0, 1, 2].map((i) => n[i] * alpha + PAPER[i] * (1 - alpha));
};

type Sample = {
  tag: string;
  text: string;
  color: string;
  fontSize: number;
  fontWeight: number;
};

/*
 * Collected off text nodes rather than off a selector list: the post body is
 * build-time HTML whose tag set is decided by `scripts/markdown-html.mjs`, so
 * any list of elements to check would go stale the first time that map grows.
 * The parent of a text node is whatever actually paints the glyphs.
 */
const collectText = async (page: Page) =>
  page.evaluate<Sample[]>(() => {
    const out: Sample[] = [];
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;

    while ((node = walker.nextNode())) {
      const text = (node.textContent ?? "").trim();
      if (!text) continue;

      const el = node.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);

      const style = getComputedStyle(el);
      // `display: none` is how the print block retires the fixed navbar, and a
      // retired element is not ink. Everything else is measured, including
      // anything scrolled out of view — paper has no viewport.
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.closest("[hidden]")) continue;
      // Pure decoration is outside 1.4.3, and on this site that set is exactly
      // the `aria-hidden` glyphs: the 160px `/>` watermark behind the hero at
      // 3% alpha, the `$` prompt, the `|` separators. None of them carry a
      // word. Anything that does carry a word is exposed to AT and stays in.
      if (el.closest('[aria-hidden="true"]')) continue;

      out.push({
        tag: el.tagName.toLowerCase(),
        text: text.slice(0, 60),
        color: style.color,
        fontSize: parseFloat(style.fontSize),
        fontWeight: Number(style.fontWeight) || 400,
      });
    }

    return out;
  });

// WCAG 1.4.3: 18.66px bold or 24px regular and up is "large text" at 3:1.
const threshold = (s: Sample) =>
  s.fontSize >= 24 || (s.fontSize >= 18.66 && s.fontWeight >= 700) ? 3 : 4.5;

/*
 * Switching the media query repaints through `transition-colors`, and reading
 * straight after `emulateMedia` catches the tween rather than the destination.
 * It does not look like a race: `--foreground` on the root reads the print
 * value immediately, `body` resolves to it, and only the elements carrying a
 * transition still report the screen colour — a mid-flight `rgb(204,255,238)`
 * that is indistinguishable from a print stylesheet that never loaded.
 *
 * The settle is asserted rather than waited out. A fixed sleep tuned to today's
 * longest `duration-500` is one `duration-700` away from silently measuring the
 * tween again, so this samples twice and requires the two to agree.
 */
const settleAfterMediaChange = async (
  page: Page
) => {
  await page.waitForTimeout(700);
  const first = await collectText(page);
  await page.waitForTimeout(400);
  const second = await collectText(page);

  // Keyed on colour and not on text: the hero headline types itself in
  // forever, so "CTO & Ch" -> "CTO & Chief A" between two samples is the page
  // working, not a colour still in flight.
  expect(
    second.map((s) => `${s.tag}|${s.color}`),
    "colours still moving 1.1s after the media change — the sample is a tween, not the printed value"
  ).toEqual(first.map((s) => `${s.tag}|${s.color}`));

  return second;
};

for (const route of ROUTES) {
  test(`print media: every glyph on ${route} survives white paper`, async ({
    page,
  }) => {
    await page.goto(route);
    await page.waitForSelector("main");
    await page.emulateMedia({ media: "print" });

    const samples = await settleAfterMediaChange(page);

    // A probe that silently measured nothing would pass. The post page alone
    // carried 91 text elements when this was written.
    expect(samples.length).toBeGreaterThan(20);

    const failures = samples
      .map((s) => {
        const ink = inkOnPaper(s.color);
        return {
          ...s,
          ratio: ink ? contrast(ink, PAPER) : Infinity,
          needs: threshold(s),
        };
      })
      .filter((s) => s.ratio < s.needs)
      .sort((a, b) => a.ratio - b.ratio);

    expect(
      failures.map(
        (f) =>
          `${f.ratio.toFixed(2)}:1 (needs ${f.needs}) ${f.tag} ${f.fontSize}px/${f.fontWeight} ${f.color} — ${JSON.stringify(f.text)}`
      ),
      "text below WCAG 1.4.3 once the print stylesheet drops the dark background"
    ).toEqual([]);
  });
}

/*
 * ## The same compositing bug, one property over
 *
 * The sweep above reads `color`, so PRA-1063 fixed `color`: every alpha-carrying
 * `text-primary` on a printed page got a `print:text-primary` beside it to drop
 * the alpha back off. Nothing
 * looked at the *edges*, and an edge is drawn from the same tokens through the
 * same alpha modifiers. `border-primary/40` resolves to
 * `rgba(0, 102, 77, 0.4)` under the print `--primary`, and 40% of ink over
 * paper is 1.95:1 — the blockquote's left rule and the post body's link
 * underline, both measured at exactly that (PRA-1073).
 *
 * Those two are not decoration. The blockquote rule is the only thing that
 * separates a quotation from the author's own prose (`scripts/markdown-html.mjs`
 * says so at the `blockquote` entry: preflight zeroes the margin, and the `p`
 * inside is the same component as any body paragraph). The link underline is
 * the only non-colour link affordance on the page — WCAG 1.4.1 is why it is
 * there at all. Lose either and the reader loses information the sheet is
 * supposed to carry.
 *
 * ## Why this sweep is narrower than "every border"
 *
 * 1.4.11 asks for 3:1 from graphical objects *required to understand the
 * content* and from the visual information *required to identify a UI
 * component* — not from every painted line. Scoping to `a`/`button` boundaries,
 * link underlines, the blockquote rule and the code block's hairline is that
 * clause, mechanised.
 *
 * What it deliberately lets through, measured on this tree: the tag chip's
 * `border-primary/20` box at 1.37:1 (the tag word inside it is ink and already
 * passes the sweep above — the box adds nothing a reader needs), the portrait's
 * `border-primary/20` frame at 1.37:1, and the hero's two `aria-hidden`
 * ornament rings at 1.17:1 and 1.19:1. Naming them here so that "the gate is
 * green" is never read as "nothing on the sheet is faint".
 */
type Edge = {
  tag: string;
  kind: string;
  cls: string;
  color: string;
};

const collectEdges = async (page: Page) =>
  page.evaluate<Edge[]>(() => {
    const out: Edge[] = [];

    // Queried by selector rather than swept off every node, because the scope
    // *is* semantic: which element it is decides whether its edge is load
    // bearing. `a`/`button` are the UI components; `blockquote` and `pre` are
    // the two content elements whose meaning lives entirely in their edge.
    //
    // `pre` earns its place by the same argument as `blockquote`, one property
    // over: the body font is already JetBrains Mono (`src/index.css`), and
    // `bg-card` is white on paper like every other fill, so once the fill drops
    // the hairline is the only thing left saying "this is a code sample and not
    // prose". It is here rather than in the exempt list below because the
    // reason it currently collects nothing is a fact about the corpus, not
    // about the element — see the trip wire under `REQUIRED_EDGES` (PRA-1074).
    for (const el of document.querySelectorAll<HTMLElement>(
      "a, button, blockquote, pre"
    )) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.closest("[hidden]")) continue;
      // A zero-area element paints no edge. Checked because paper has no
      // viewport — an element scrolled far off screen still has a box, and
      // still prints, so this must not be confused with an offscreen test.
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;

      const cls = el.className.toString().slice(0, 70);

      for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
        const width = parseFloat(style[`border${side}Width` as "borderTopWidth"]);
        const line = style[`border${side}Style` as "borderTopStyle"];
        if (!width || line === "none" || line === "hidden") continue;
        out.push({
          tag: el.tagName.toLowerCase(),
          kind: `border-${side.toLowerCase()}`,
          cls,
          color: style[`border${side}Color` as "borderTopColor"],
        });
      }

      // Read off the anchor itself and not off a descendant: an underline
      // propagates down from the element that declares it, and a `strong`
      // inside a link reports `text-decoration-line: none` while still being
      // underlined by its parent.
      if (style.textDecorationLine && style.textDecorationLine !== "none") {
        out.push({
          tag: el.tagName.toLowerCase(),
          kind: "underline",
          cls,
          color: style.textDecorationColor,
        });
      }
    }

    return out;
  });

/*
 * The carriers this gate exists for, per route. Asserted present before the
 * ratios are checked, because every one of them is optional markup: a post
 * with no `>` line renders no blockquote and no `[text](url)` renders no
 * underline, so an edit to the sample post could leave this sweep collecting
 * card borders alone and going green for a reason that has nothing to do with
 * what broke. `/` and `/blog/` carry no underlined links at all, which is why
 * the post is the only route that can name one.
 */
const REQUIRED_EDGES: Record<string, string[]> = {
  "/blog/your-eval-suite-measures-the-wrong-thing/": [
    "blockquote border-left",
    "a underline",
    "a border-left",
  ],
  "/blog/": ["a border-left"],
  "/": ["a border-left"],
};

/*
 * `pre` is in the collector above and matches nothing on any route in `ROUTES`,
 * because no post in the published corpus renders a code block — 0 across 24
 * posts, checked. A rule that has never once run is a rule nobody should trust,
 * and there is no route to point it at while that stays true, so this is the
 * trip wire that arms it instead.
 *
 * It is not hypothetical: `blog/your-context-window-is-a-budget` is unmerged
 * and opens two fenced blocks, so the first published code sample is already
 * written. The moment it lands, this fails and names the route to add — rather
 * than the `pre` sweep staying quietly green on markup that does not exist,
 * which is the exact shape of the bug this whole gate keeps being widened for
 * (#159 enumerated `text-*`, #160 enumerated one toggle, PRA-1073 enumerated
 * two elements; each was right about the mechanism and too narrow about where
 * it applied).
 *
 * Which is why this asks the renderer instead of grepping for ``` — that
 * grep is the same too-narrow enumeration one more time. CommonMark has three
 * ways to reach a `pre`, and react-markdown emits one for all three: a backtick
 * fence, a `~~~` fence, and a 4-space indented block. Driven through
 * `renderMarkdownToHtml`, the two non-backtick forms paint the same unmeasured
 * hairline and a ``` grep stays green on both. The renderer is the only thing
 * that knows what a `pre` is, so it is what gets asked (PRA-1033).
 */
test("print media: a published code block has a route that measures its border", () => {
  const dir = new URL("../src/data/blog-posts/content/", import.meta.url);
  const posts = readdirSync(dir).filter((name) => name.endsWith(".md"));

  // A trip wire that reads nothing passes exactly like one that reads a clean
  // corpus, so prove the corpus was actually there before trusting the verdict.
  expect(posts.length).toBeGreaterThan(0);

  const withCodeBlock = posts.filter((name) =>
    renderMarkdownToHtml(readFileSync(new URL(name, dir), "utf8")).includes(
      "<pre"
    )
  );

  expect(
    withCodeBlock,
    "a published post now renders a code block, so `pre` paints a border on " +
      "paper that nothing measures. Add one of these posts' routes to ROUTES " +
      "above and give it a `pre border-top` entry in REQUIRED_EDGES, so the " +
      "code block's hairline is checked on a page that actually renders one"
  ).toEqual([]);
});

// 1.4.11, flat: non-text contrast has no large-text relaxation.
const NON_TEXT = 3;

for (const route of ROUTES) {
  test(`print media: load-bearing edges on ${route} survive white paper`, async ({
    page,
  }) => {
    await page.goto(route);
    await page.waitForSelector("main");
    await page.emulateMedia({ media: "print" });
    // The same tween that makes the text sweep settle applies here — the card
    // links carry `transition-all duration-500` on their border colour.
    await page.waitForTimeout(1100);

    const edges = await collectEdges(page);

    const present = new Set(edges.map((e) => `${e.tag} ${e.kind}`));
    for (const required of REQUIRED_EDGES[route]) {
      expect(
        [...present],
        `no ${required} was collected on ${route} — this gate is measuring nothing it was written for`
      ).toContain(required);
    }

    const failures = edges
      .map((e) => {
        const paint = inkOnPaper(e.color);
        return { ...e, ratio: paint ? contrast(paint, PAPER) : Infinity };
      })
      .filter((e) => e.ratio < NON_TEXT)
      .sort((a, b) => a.ratio - b.ratio);

    expect(
      [...new Set(
        failures.map(
          (f) => `${f.ratio.toFixed(2)}:1 (needs ${NON_TEXT}) ${f.tag} ${f.kind} ${f.color} — ${f.cls}`
        )
      )],
      "borders and underlines below WCAG 1.4.11 once the print stylesheet drops the dark background"
    ).toEqual([]);
  });
}

/*
 * ## The third way this design system marks something, and the first sweep that
 * can see it
 *
 * The two sweeps above read ink-against-paper and edge-against-paper. This
 * design system marks things a third way — with a *fill* — and a fill is the
 * one cue that cannot survive paper: `--muted`, `--card` and `--secondary` are
 * all white under `@media print` by policy, and Chrome drops backgrounds
 * anyway unless the reader ticks "Background graphics".
 *
 * Inline `code` was marked that way and nothing else. `scripts/markdown-html.mjs`
 * says so at its `code` entry — the body font is already JetBrains Mono, so
 * family, size and colour already match the prose, and "the chip is what makes
 * it read as code". On paper both halves of the chip went: the fill became the
 * paper at 1.00:1, and the saturated mint `--foreground` became the same
 * achromatic ink as everything else. What was left was a 1.75:1 step between two
 * greys, on `/blog/the-handoff-is-where-agents-break/`, where `constraints` and
 * `unresolved` are field names in a sentence about a JSON shape and printed as
 * the English words (PRA-1086).
 *
 * Neither sweep above could see it, and one of them actively vouched for it:
 *
 * - The text sweep reads `color` against paper. The chip's ink is 16.88:1 —
 *   the print block's own header reports this element as fixed, "chips 1.19:1
 *   -> 6.30:1". That figure is ink-against-paper. Nothing in this file compared
 *   a run of ink to the ink *beside* it.
 * - The edge sweep reads `borderColor`, and the chip had no border in either
 *   medium. Adding `code` to that selector would have collected zero rows and
 *   gone green.
 *
 * So this asks the question neither of them asks: is this run of ink still
 * distinguishable from the ink around it, once the sheet is white?
 *
 * ## Why a colour difference does not count as an answer
 *
 * The cue has to be non-colour. Two reasons, and the second is the load-bearing
 * one. The print path is already achromatic by construction — every token in
 * the block is a grey, so "different colour" can only mean "different
 * lightness", and 1.75:1 of lightness is what this test exists because of.
 * And a reader who prints greyscale, or photocopies the sheet, keeps the edge
 * and the typography and loses the rest. 1.4.1 is that argument on screen;
 * paper makes it stricter, not looser.
 */
const INLINE_CODE_ROUTE = "/blog/the-handoff-is-where-agents-break/";

const inlineChipPosts = () => {
  const dir = new URL("../src/data/blog-posts/content/", import.meta.url);
  const posts = readdirSync(dir).filter((name) => name.endsWith(".md"));
  expect(posts.length).toBeGreaterThan(0);

  return posts.filter((name) => {
    const html = renderMarkdownToHtml(readFileSync(new URL(name, dir), "utf8"));
    // A fenced block is `<pre><code>`, and that `code` wears no chip — it is
    // the `pre` that carries the treatment, and the `pre` sweep that measures
    // it. Removing the block first is what keeps this counting the inline form.
    return /<code/.test(html.replace(/<pre[\s\S]*?<\/pre>/g, ""));
  });
};

/*
 * The route below is hardcoded, and a hardcoded route is a fact about the
 * corpus written down somewhere the corpus cannot reach. Three published spans
 * in one body of 24 is a thin thing to hang a gate on: one edit to that post and
 * the browser test below measures an empty set on a page with nothing to
 * measure.
 *
 * Asked of the renderer for the same reason the `pre` trip wire is — a grep for
 * a backtick is the too-narrow enumeration one more time — and it names the
 * replacement rather than just failing, because when this breaks the fix is to
 * point the route somewhere else, not to think about it from scratch.
 */
test("print media: the inline-code route still renders an inline code chip", () => {
  const withChip = inlineChipPosts();
  const slug = INLINE_CODE_ROUTE.replace(/^\/blog\/|\/$/g, "");

  expect(
    withChip,
    `INLINE_CODE_ROUTE is /blog/${slug}/ and that post no longer renders an ` +
      "inline code chip, so the print sweep below measures an empty page and " +
      "passes for it. Repoint INLINE_CODE_ROUTE at one of the posts listed here"
  ).toContain(`${slug}.md`);
});

type Chip = {
  text: string;
  color: string;
  background: string;
  printColorAdjust: string;
  decoration: string;
  type: string;
  edges: { side: string; color: string }[];
  parentTag: string;
  parentColor: string;
  parentType: string;
};

const collectChips = async (page: Page) =>
  page.evaluate<Chip[]>(() => {
    const typography = (s: CSSStyleDeclaration) =>
      [s.fontFamily, s.fontSize, s.fontWeight, s.fontStyle].join(" | ");

    // `:not(pre code)` and not a filter on the whole `code` set, so a fenced
    // block's inner `code` — which wears no chip and is measured by the `pre`
    // sweep instead — cannot be counted as an unmarked inline span.
    return [...document.querySelectorAll<HTMLElement>("code:not(pre code)")].map(
      (el) => {
        const s = getComputedStyle(el);
        // The parent, and deliberately not the enclosing block. "The ink beside
        // it" means the run the span is actually sitting in the middle of, and
        // for a chip inside `**bold**` that is the `strong`, not the paragraph.
        // Comparing to the paragraph there would report a `typography` cue —
        // weight 700 against 400 — for a span that is identical to every word
        // touching it, which is the exact false pass this sweep exists to
        // prevent. Where a chip is a direct child of the paragraph, as all three
        // on this route are, the two readings coincide.
        const near = el.parentElement ?? el;
        const bs = getComputedStyle(near);

        const edges: { side: string; color: string }[] = [];
        for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
          const width = parseFloat(s[`border${side}Width` as "borderTopWidth"]);
          const line = s[`border${side}Style` as "borderTopStyle"];
          if (!width || line === "none" || line === "hidden") continue;
          edges.push({
            side: side.toLowerCase(),
            color: s[`border${side}Color` as "borderTopColor"],
          });
        }

        return {
          text: (el.textContent ?? "").trim().slice(0, 40),
          color: s.color,
          background: s.backgroundColor,
          // The escape hatch `src/index.css` names by hand: "a component that
          // genuinely wants a fill on paper opts in with `print-color-adjust`".
          // Chrome reports the default as `economy`, which is "drop it".
          printColorAdjust: s.printColorAdjust || "economy",
          decoration: s.textDecorationLine,
          type: typography(s),
          edges,
          parentTag: near.tagName.toLowerCase(),
          parentColor: bs.color,
          parentType: typography(bs),
        };
      }
    );
  });

test(`print media: inline code is still code on ${INLINE_CODE_ROUTE}`, async ({
  page,
}) => {
  await page.goto(INLINE_CODE_ROUTE);
  await page.waitForSelector("main");
  await page.emulateMedia({ media: "print" });

  // Settled by agreement rather than by a sleep, for the reason
  // `settleAfterMediaChange` gives: reading straight after `emulateMedia`
  // catches the tween, and a fixed wait tuned to today's longest duration is one
  // `duration-700` away from catching it again.
  await page.waitForTimeout(700);
  const first = await collectChips(page);
  await page.waitForTimeout(400);
  const chips = await collectChips(page);
  expect(
    chips.map((c) => `${c.text}|${c.color}|${JSON.stringify(c.edges)}`),
    "chip styling still moving 1.1s after the media change — this is a tween, not the printed value"
  ).toEqual(first.map((c) => `${c.text}|${c.color}|${JSON.stringify(c.edges)}`));

  // The control the trip wire above cannot give: the corpus having a chip and
  // the prerendered page painting one are two different claims, and a sweep
  // over zero elements passes exactly like a sweep over three good ones.
  expect(
    chips.map((c) => c.text),
    `no inline code chip rendered on ${INLINE_CODE_ROUTE} — this sweep is measuring nothing`
  ).not.toEqual([]);

  const verdicts = chips.map((c) => {
    const fill = inkOnPaper(c.background);
    const cues: string[] = [];

    // An edge only counts if it would actually be seen. `border-border` prints
    // at 3.19:1 since PRA-1073; a hairline below 1.4.11's 3:1 is a smudge, and
    // a smudge is not a cue.
    for (const e of c.edges) {
      const paint = inkOnPaper(e.color);
      if (paint && contrast(paint, PAPER) >= NON_TEXT) cues.push(`border-${e.side}`);
    }

    // The stylesheet's own escape hatch, mechanised: opted in, and painting
    // something that is not the sheet. Nothing on this site takes this branch
    // today, so it is written to the policy sentence rather than to a
    // measurement, and two things are deliberately left out of it.
    //
    // It is not held to `NON_TEXT`, and that is not an oversight to tidy up
    // later. 1.4.11's 3:1 is the right instrument for an edge and the wrong one
    // for a fill: the chip's screen fill is `bg-muted` on `--background`, which
    // is 1.27:1 and completely legible as a chip. A contrast ratio measures text
    // legibility, not whether a surface reads as a surface, so thresholding this
    // at 3 would reject fills that work. The opt-in is the gate here — a
    // developer has to write `print-color-adjust` on purpose — and the amount is
    // theirs to own.
    //
    // And it does not check the ink on top. The first component that opts a fill
    // in owes the text sweep above something this file does not currently do:
    // composite its ink against *that fill* instead of against paper.
    if (c.printColorAdjust === "exact" && fill && contrast(fill, PAPER) > 1) {
      cues.push("fill");
    }

    if (c.type !== c.parentType) cues.push("typography");
    if (c.decoration && c.decoration !== "none") cues.push("underline");

    return { ...c, cues };
  });

  const step = (c: (typeof verdicts)[number]) => {
    const [ink, prose] = [inkOnPaper(c.color), inkOnPaper(c.parentColor)];
    return ink && prose ? contrast(ink, prose).toFixed(2) : "n/a";
  };

  expect(
    verdicts
      .filter((c) => c.cues.length === 0)
      .map(
        (c) =>
          `${JSON.stringify(c.text)} in <${c.parentTag}> carries no cue on paper — ` +
          `same ${c.type}, no edge, fill ${c.background} at print-color-adjust ` +
          `${c.printColorAdjust}, and ${step(c)}:1 of ink against the prose around it`
      ),
    "inline code that reads as prose once the print stylesheet drops its fill"
  ).toEqual([]);

  // Separate from the cue check on purpose: a chip with a faint edge and a bold
  // face would pass the assertion above on typography alone, and still be
  // painting a line the reader cannot see. This is 1.4.11 on whatever edges the
  // chip actually has, the same question the edge sweep asks of `a`/`pre`.
  const faint = verdicts.flatMap((c) =>
    c.edges
      .map((e) => ({ e, paint: inkOnPaper(e.color) }))
      .filter(({ paint }) => paint && contrast(paint, PAPER) < NON_TEXT)
      .map(
        ({ e, paint }) =>
          `${contrast(paint!, PAPER).toFixed(2)}:1 (needs ${NON_TEXT}) code border-${e.side} ${e.color}`
      )
  );
  expect(
    [...new Set(faint)],
    "the inline chip's printed edge is below WCAG 1.4.11"
  ).toEqual([]);
});

/*
 * The subtitle's `text-shadow: 0 0 20px/40px hsl(280 100% 65% / .5)` is not a
 * background, so `printBackground: false` does not drop it — it printed as a
 * solid purple wash about 40k px in area with the subtitle at 1.15:1 *inside*
 * it, bleeding to x=1, past the 0.4in margin no printer can reach. A contrast
 * check cannot see this: the glyph colour was fine against paper, and the thing
 * ruining it was the element's own shadow.
 */
for (const route of ROUTES) {
test(`print media: decorative glows are not ink on ${route}`, async ({ page }) => {
  await page.goto(route);
  await page.waitForSelector("main");
  await page.emulateMedia({ media: "print" });

  const glowing = await page.evaluate(() => {
    const out: { cls: string; prop: string; value: string }[] = [];

    for (const el of document.querySelectorAll<HTMLElement>("*")) {
      const style = getComputedStyle(el);
      if (style.display === "none") continue;

      if (style.textShadow && style.textShadow !== "none") {
        out.push({
          cls: el.className.toString().slice(0, 70),
          prop: "text-shadow",
          value: style.textShadow,
        });
      }
      if (style.boxShadow && style.boxShadow !== "none") {
        out.push({
          cls: el.className.toString().slice(0, 70),
          prop: "box-shadow",
          value: style.boxShadow,
        });
      }
    }

    return out;
  });

  expect(glowing, "glow decorations still painting on paper").toEqual([]);
});
}

/*
 * A `position: fixed` element paints on every sheet, not just the first. The
 * navbar put `← cd ~` and a rule across the top of all five pages of an
 * 8-minute post.
 *
 * Run across every route, and not just the post, because the first version of
 * this ran on the post alone and passed while the home page's terminal toggle —
 * `fixed bottom-6 right-6`, and still `display: flex` under print — printed on
 * every sheet of the home page. A blog post does not render the terminal at
 * all, so the assertion was pointed at a page the offender could not be on.
 *
 * The control below names each control it expects, per route, instead of
 * counting them. A count is satisfied by the navbar on every route — so the
 * home page's toggle could fail to mount and this would still go green on the
 * navbar alone, passing for precisely the reason it was written to catch.
 */
const fixedElements = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("*")]
      .filter((el) => {
        const style = getComputedStyle(el);
        return style.position === "fixed" && style.display !== "none";
      })
      .map(
        (el) => `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 50)}`
      )
  );

// Asserted through the same predicate the measurement uses, so the control
// cannot be satisfied by an element the sweep would not have collected anyway.
const isFixedNow = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.position === "fixed" && style.display !== "none";
  }, selector);

const NAV = 'nav[aria-label="Main"]';
// Only `/` renders `InteractiveTerminal` (`src/pages/Index.tsx`), so `/` is the
// only route that can prove the toggle is retired on paper.
const TERMINAL_TOGGLE = 'button[title="Open terminal (Ctrl+K)"]';

const FIXED_CHROME: Record<string, string[]> = {
  "/blog/your-eval-suite-measures-the-wrong-thing/": [NAV],
  "/blog/": [NAV],
  "/": [NAV, TERMINAL_TOGGLE],
};

for (const route of ROUTES) {
  test(`print media: fixed chrome on ${route} does not repeat on every sheet`, async ({
    page,
  }) => {
    await page.goto(route);
    await page.waitForSelector("main");

    // Awaited per selector rather than slept on: the toggle arrives through a
    // framer entrance, and framer advances in frames, so a wall-clock wait is
    // not a unit of animation time.
    for (const selector of FIXED_CHROME[route]) {
      await expect(
        page.locator(selector),
        `${selector} never mounted — this probe is not measuring what it thinks`
      ).toBeVisible();
      expect(
        await isFixedNow(page, selector),
        `${selector} is not fixed on screen — the control is vacuous here`
      ).toBe(true);
    }

    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(700);

    expect(
      await fixedElements(page),
      "fixed elements repeat on every printed page"
    ).toEqual([]);
  });
}
