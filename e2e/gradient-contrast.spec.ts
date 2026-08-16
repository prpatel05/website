import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { test, expect, type Page } from "./fixtures";

/**
 * Measures text contrast on the one surface neither existing check can see.
 *
 * The site has two contrast checks and the homepage falls through both:
 *
 *   - `src/lib/__tests__/text-contrast.test.ts` computes ratios analytically
 *     against `--card`, the flat surface. The homepage is not flat — it sits on
 *     a gradient — so the number that test clears is not the number a reader
 *     gets.
 *   - `a11y-axe.spec.ts` asserts `violations`. axe also returns `incomplete`
 *     ("needs review"), which nothing reads. Swept on 2026-08-15, all 26 routes
 *     produced 278 incomplete nodes, every one `color-contrast`, and all 44
 *     that are not decorative are on `/`: 39 "background color could not be
 *     determined due to a background gradient" plus 5 overlap-related.
 *
 * So a green axe run says nothing whatsoever about homepage contrast — not the
 * hero `h1`, not the section eyebrows, not the CTAs, not the footer. Every text
 * node on the site's most important page is unmeasured, and a palette change
 * that broke AA there would ship green.
 *
 * Analytic colour maths cannot settle a gradient; that is what axe failed at.
 * So this measures pixels. Per node, four screenshots of its padding box:
 *
 *   A = as shipped        B = its own ink `transparent` (the true backdrop)
 *   W = its ink `#fff`    K = its ink `#000`
 *
 * `(W-K)/255` is per-pixel glyph coverage and is independent of the backdrop,
 * so it identifies exactly the pixels this node inked. Sampling `ratio(A, B)`
 * only where coverage >= 0.95 keeps anti-aliased edges — which always blend
 * toward the backdrop and manufacture failures — out of the result. Glyphs from
 * *other* elements overlapping the box are identical in A and B, so they fall
 * out of the glyph set while still serving as backdrop where this node's text
 * genuinely sits on them. That is what makes the 5 overlap nodes measurable too.
 *
 * Scope is axe's own `incomplete` list rather than a hand-picked set of
 * selectors, which keeps the two in lockstep: anything axe *can* measure stays
 * the `violations` gate's job, and anything new that lands on the gradient
 * enters this sweep the day it ships, with nothing to remember to add.
 *
 * The decorative bullet spans are dropped for the reason axe flagged them —
 * "content contains only non-text characters". 234 of the 278 are those, they
 * carry no information, and requiring `[a-z0-9]` is what keeps the sweep to
 * real copy. Sub-pixel `|` separators and the `/>` watermark at opacity 0.03
 * are the same category.
 *
 * Measured this way on 2026-08-16 the page is clean: 23 nodes at 1280px and 21
 * at 393px, nothing below its floor. The margin is thinner than the palette
 * suggests, which is the point of measuring rather than computing — the hero
 * subtitle lands at 4.79:1 against a 4.5 floor, and `text-accent` "writes" at
 * 4.92:1 is only large-text (3:1) copy. Standing the gate up while it is green
 * is the point, as in `a11y-axe.spec.ts` — the job is the next regression, not
 * a backlog.
 */

/** WCAG 1.4.3 Contrast (Minimum), level AA. */
const NORMAL_MIN = 4.5;
const LARGE_MIN = 3;

/** Anti-aliased edges blend toward the backdrop; only full ink is the node's colour. */
const FULL_INK = 0.95;

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** axe's own words for "this is decoration, not copy". */
const DECORATIVE = "non-text characters";

const STYLE_ID = "__gradient_contrast_ink";
const MARK = "data-gradient-contrast";

type Placed = {
  rect: { x: number; y: number; width: number; height: number };
  fontPx: number;
  bold: boolean;
  text: string;
};

const relativeLuminance = (r: number, g: number, b: number) => {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/**
 * Force this node's own ink.
 *
 * Two properties are suppressed in *every* shot, A included, so all four are
 * the same measurement of different ink:
 *
 *   - `text-shadow`, because `text-glow` paints a halo in the same hue and a
 *     halo is not the text colour SC 1.4.3 is about. Dropping it is
 *     conservative: it can only lower the ratio this reports.
 *   - `transition`, because most links here are `transition-colors`. The forced
 *     `#fff` and `#000` shots are taken as soon as the style lands, so on a
 *     transitioning node they catch it partway from its previous colour and
 *     `W - K` never reaches full coverage. That does not fail — it silently
 *     measures *nothing*, and it took the whole navbar row out of the sweep.
 */
async function setInk(page: Page, color: string | null) {
  await page.evaluate(
    ({ color, styleId, mark }) => {
      let style = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement("style");
        style.id = styleId;
        document.head.appendChild(style);
      }
      style.textContent =
        `[${mark}]{text-shadow:none !important;transition:none !important;}` +
        (color ? `[${mark}]{color:${color} !important;}` : "");
    },
    { color, styleId: STYLE_ID, mark: MARK }
  );
}

/**
 * Get the node somewhere it can be photographed opaque, and measure it there.
 *
 * Where it is measured is not a detail: the backdrop is a gradient, so the
 * scroll offset *is* what the ratio is against.
 *
 * Scrolling is a last resort rather than the default, which is the opposite of
 * what this started as. Two of the homepage's effects are scroll-linked in
 * opposite directions — sections below the fold fade *in* as they are reached,
 * while the hero fades *out* as it is left. Centring everything satisfies the
 * first and defeats the second: it drove the hero subtitle, the resume CTA and
 * the SCROLL label to opacity < 1, and all three dropped out of the sweep
 * silently. They are on screen and fully opaque exactly where the page already
 * is at load, so nodes already in view are shot without touching the scroll.
 */
async function place(page: Page, selector: string): Promise<Placed | null> {
  const inView = await page.evaluate(
    ({ selector, mark }) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return null;
      document.querySelectorAll(`[${mark}]`).forEach((n) => n.removeAttribute(mark));
      el.setAttribute(mark, "");
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
    },
    { selector, mark: MARK }
  );
  if (inView === null) return null;

  if (!inView) {
    await page.evaluate((sel) => {
      document
        .querySelector(sel)
        ?.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as ScrollBehavior });
    }, selector);
  }

  // Settle in frames, not wall clock — framer advances on rAF, and headless
  // Chromium's clock is not the browser's (see `frame-time.ts`).
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const tick = () => (++frames >= 12 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      })
  );

  return page.evaluate(
    ({ selector, mark }) => {
      void mark;
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.visibility !== "visible" || cs.display === "none") return null;

      let opacity = 1;
      for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        opacity *= parseFloat(getComputedStyle(node).opacity || "1");
      }
      if (opacity < 0.999) return null;

      let own = "";
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) own += child.textContent ?? "";
      }
      own = own.trim();
      if (!/[a-z0-9]/i.test(own)) return null;

      // Padding box, not border box: a 1px `border-primary/20` ring on a 10px
      // chip is >2% of the area and is not backdrop.
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.ceil(r.left + (parseFloat(cs.borderLeftWidth) || 0)));
      const y = Math.max(0, Math.ceil(r.top + (parseFloat(cs.borderTopWidth) || 0)));
      const right = Math.min(window.innerWidth, Math.floor(r.right - (parseFloat(cs.borderRightWidth) || 0)));
      const bottom = Math.min(window.innerHeight, Math.floor(r.bottom - (parseFloat(cs.borderBottomWidth) || 0)));
      if (right - x < 4 || bottom - y < 4) return null;

      return {
        rect: { x, y, width: right - x, height: bottom - y },
        fontPx: parseFloat(cs.fontSize),
        bold: (parseInt(cs.fontWeight, 10) || 400) >= 700,
        text: own.slice(0, 60),
      };
    },
    { selector, mark: MARK }
  );
}

async function raw(page: Page, rect: Placed["rect"]) {
  const png = await page.screenshot({ clip: rect });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  return { data, channels: info.channels, pixels: info.width * info.height };
}

/** The worst ratio across the pixels this node fully inked, or null if it inked none. */
async function worstRatio(page: Page, placed: Placed) {
  await setInk(page, null);
  const shipped = await raw(page, placed.rect);
  await setInk(page, "transparent");
  const backdrop = await raw(page, placed.rect);
  await setInk(page, "#fff");
  const white = await raw(page, placed.rect);
  await setInk(page, "#000");
  const black = await raw(page, placed.rect);
  await setInk(page, null);

  let worst = Infinity;
  let inked = 0;
  for (let i = 0; i < shipped.pixels; i++) {
    const o = i * shipped.channels;
    const coverage =
      (white.data[o] - black.data[o] +
        (white.data[o + 1] - black.data[o + 1]) +
        (white.data[o + 2] - black.data[o + 2])) /
      (3 * 255);
    if (coverage < FULL_INK) continue;
    inked++;
    const ink = relativeLuminance(shipped.data[o], shipped.data[o + 1], shipped.data[o + 2]);
    const back = relativeLuminance(backdrop.data[o], backdrop.data[o + 1], backdrop.data[o + 2]);
    const ratio = (Math.max(ink, back) + 0.05) / (Math.min(ink, back) + 0.05);
    if (ratio < worst) worst = ratio;
  }
  return inked ? { worst, inked } : null;
}

const required = (placed: Placed) =>
  placed.fontPx >= 24 || (placed.bold && placed.fontPx >= 18.66) ? LARGE_MIN : NORMAL_MIN;

/** The nodes axe declined to measure, minus the ones it declined because they are decoration. */
async function unmeasuredByAxe(page: Page) {
  const { incomplete } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  return incomplete
    .filter((result) => result.id === "color-contrast")
    .flatMap((result) => result.nodes)
    .filter((node) =>
      [...(node.any ?? []), ...(node.all ?? []), ...(node.none ?? [])].every(
        (check) => !(check.message ?? "").includes(DECORATIVE)
      )
    )
    .map((node) => node.target.join(" "));
}

test.describe("text axe cannot measure still clears AA", () => {
  test("every unmeasured node on the homepage", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

    const selectors = await unmeasuredByAxe(page);

    // A zero here is not a pass. It means either the gradient is gone — in
    // which case axe now measures the homepage itself and this sweep can go —
    // or the scan broke. Either way it must be looked at, not skipped past.
    expect(
      selectors.length,
      "axe reported nothing it could not measure on `/`; if the gradient was removed, delete this spec, because `a11y-axe.spec.ts` now covers the page"
    ).toBeGreaterThan(0);

    const failures: string[] = [];
    let measured = 0;

    for (const selector of selectors) {
      const placed = await place(page, selector);
      if (!placed) continue;
      const result = await worstRatio(page, placed);
      if (!result) continue;

      measured++;
      const min = required(placed);
      if (result.worst < min) {
        failures.push(
          `${result.worst.toFixed(2)}:1 (needs ${min}:1) — ${placed.fontPx}px ` +
            `over ${result.inked}px of ink — ${selector}\n      ${JSON.stringify(placed.text)}`
        );
      }
    }

    // Same reasoning as above: every assertion here is over a set this loop
    // builds, so an empty set passes for free.
    expect(
      measured,
      `placed none of the ${selectors.length} unmeasured node(s); the sweep asserted nothing`
    ).toBeGreaterThan(0);

    expect(
      failures,
      `${failures.length} of ${measured} node(s) on \`/\` fail WCAG 1.4.3 AA:\n    ${failures.join("\n    ")}`
    ).toEqual([]);
  });

  /**
   * Control: the measurement can fail.
   *
   * The assertion above is an empty-array check over pixels, which is also what
   * a broken probe produces — a clip rect off-viewport, an ink override that
   * does not apply, a coverage threshold nothing clears. This drops real text on
   * the real gradient at a ratio that is unambiguously under AA and requires the
   * same code path to report it.
   */
  test("the measurement reports a node that fails", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

    const selector = "#gradient-contrast-control";
    await page.evaluate((id) => {
      const probe = document.createElement("p");
      probe.id = id.slice(1);
      // Dark grey on the near-black gradient: legible enough to render a full
      // glyph, nowhere near 4.5:1.
      probe.setAttribute("style", "position:absolute;top:40vh;left:2rem;font-size:16px;color:#2b2b2b;");
      probe.textContent = "control text that fails contrast";
      document.body.appendChild(probe);
    }, selector);

    const placed = await place(page, selector);
    expect(placed, "the control never placed, so the sweep's own placement step is broken").not.toBeNull();

    const result = await worstRatio(page, placed!);
    expect(result, "the control inked no pixels, so the sweep measures nothing").not.toBeNull();
    expect(required(placed!)).toBe(NORMAL_MIN);
    expect(result!.worst).toBeLessThan(NORMAL_MIN);
  });
});
