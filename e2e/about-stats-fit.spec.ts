import { test, expect, type Page } from "./fixtures";

/**
 * The About stats have to stay inside the tiles they are drawn in.
 *
 * `About.tsx` nests a four-up stat grid inside the section's `lg:grid-cols-2`
 * split. At exactly 1024px that outer split halves the column the stats live
 * in, so the tiles drop from 222px to 100px — but the labels do not follow.
 * `companies_built` is a 97.5px run of unbreakable `snake_case` at
 * `text-[10px]`, and a 100px tile only offers 66px between its borders, so the
 * label ran 14.5px past the card's right border line. The tile's `overflow` is
 * `visible`, so the text painted over the border rather than being clipped, and
 * it stayed broken for a ~130px band of laptop widths before the column grew
 * back.
 *
 * Nothing already in the suite could see it. The document does not overflow at
 * any width (`mobile-overflow.spec.ts` measures `documentElement.scrollWidth`,
 * and the section absorbs this entirely), the section does not overflow, and no
 * unit test has layout at all. The only thing that moves is where the glyphs
 * land relative to one border, so that is what this measures: the painted run
 * of the text against the tile's border box, at the widths where the two
 * disagree.
 *
 * The run comes from a `Range` over the text node rather than the span's own
 * box, because the span is a block-level child that is exactly as wide as the
 * tile's content box whether or not the text inside it fits. Its
 * `getBoundingClientRect()` reads clean on the broken layout; only the glyphs
 * tell the truth.
 *
 * Both the parallax column and the tile's own entrance animation translate the
 * tile and its text together, so a measurement taken mid-animation still gives
 * the correct offset — the transform cancels in the difference. Waiting for the
 * entrance to finish is for reproducible numbers in the failure message, not
 * for correctness.
 */

/** The stat labels `About.tsx` renders, longest-first in painted width. */
const STAT_LABELS = ["companies_built", "users_shipped", "acquisition", "years_exp"];

/**
 * 640 and 1000 bracket the four-up band below `lg`, where the tiles are 132px
 * and 222px. 1024 through 1152 is the band that broke. 1279/1280 straddle the
 * breakpoint that restores four-up, and 1440 is the wide control the original
 * screenshot was taken against.
 */
const WIDTHS = [640, 1000, 1024, 1060, 1100, 1152, 1200, 1279, 1280, 1440];

type Fit = {
  label: string;
  tileWidth: number;
  /** Painted width of the glyph run, independent of the box it sits in. */
  run: number;
  /** How far the run spills past the tile's border box. Positive is a defect. */
  overRight: number;
  overLeft: number;
};

async function measureStats(page: Page, labels: string[]): Promise<Fit[]> {
  return page.evaluate((names) => {
    /** The union of the glyph rects, which is what the reader actually sees. */
    const paintedRun = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()];
      if (!rects.length) return null;
      return {
        left: Math.min(...rects.map((r) => r.left)),
        right: Math.max(...rects.map((r) => r.right)),
      };
    };

    const out: Fit[] = [];
    for (const span of document.querySelectorAll("#about span")) {
      const name = span.textContent?.trim() ?? "";
      if (!names.includes(name)) continue;

      // The label and the value are the two spans inside the tile <div>.
      const tile = span.parentElement!;
      const box = tile.getBoundingClientRect();

      for (const part of tile.querySelectorAll("span")) {
        const run = paintedRun(part);
        if (!run) continue;
        out.push({
          label: `${name} ${part === span ? "label" : "value"} "${part.textContent}"`,
          tileWidth: +box.width.toFixed(1),
          run: +(run.right - run.left).toFixed(1),
          overRight: +(run.right - box.right).toFixed(1),
          overLeft: +(box.left - run.left).toFixed(1),
        });
      }
    }
    return out;
  }, labels);
}

test.describe("About stat tiles contain their own text", () => {
  for (const width of WIDTHS) {
    test(`at ${width}px no stat paints outside its tile`, async ({ page, isMobile }) => {
      test.skip(
        !!isMobile,
        "the widths under test are laptop widths; the phone project would emulate them at 2.6x DPR"
      );

      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      // Metrics for the self-hosted mono face, not a fallback that happens to
      // be narrower than what ships.
      await page.evaluate(() => document.fonts.ready);

      await page.evaluate(() => document.getElementById("about")?.scrollIntoView());
      await page
        .waitForFunction(
          (names) =>
            [...document.querySelectorAll("#about span")]
              .filter((s) => names.includes(s.textContent?.trim() ?? ""))
              .every((s) => getComputedStyle(s.parentElement!).opacity === "1"),
          STAT_LABELS,
          { timeout: 5000 }
        )
        .catch(() => {});

      const fits = await measureStats(page, STAT_LABELS);

      // Without this the whole sweep is vacuous the day the markup moves: a
      // selector that matches nothing has nothing painting outside anything.
      expect(
        fits.map((f) => f.label).filter((l) => l.includes("label")),
        `expected one row per stat label at ${width}px, got:\n  ${fits
          .map((f) => f.label)
          .join("\n  ")}`
      ).toHaveLength(STAT_LABELS.length);

      const spilling = fits.filter((f) => f.overRight > 0 || f.overLeft > 0);
      expect(
        spilling,
        `text painted outside its tile at ${width}px:\n  ${spilling
          .map(
            (f) =>
              `${f.label} — ${f.run}px run in a ${f.tileWidth}px tile, ` +
              `${f.overRight}px past the right border, ${f.overLeft}px past the left`
          )
          .join("\n  ")}`
      ).toEqual([]);
    });
  }
});
