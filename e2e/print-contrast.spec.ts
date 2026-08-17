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
 * link underlines and the blockquote rule is that clause, mechanised.
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
    // bearing. `a`/`button` are the UI components; `blockquote` is the one
    // content element whose meaning lives entirely in its rule.
    for (const el of document.querySelectorAll<HTMLElement>("a, button, blockquote")) {
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
