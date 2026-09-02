import { test, expect } from "./fixtures";

/**
 * The hero's gutter ornament never paints on top of the hero copy.
 *
 * `Hero.tsx` pins a status block ("SYSTEM ONLINE" / "WASHINGTON, DC" / "11+ YRS
 * EXP") to the section at `absolute top-24 left-8`, outside the centred content
 * column. That only works while the column has actually left a gutter wide
 * enough to hold it, and the reveal breakpoint is the only thing enforcing it.
 * It shipped as `lg` (1024px), where there is no gutter — the column starts at
 * `(100vw - 1200px) / 2 + 2rem`, which does not clear the block's 130px right
 * edge until ~1396px. PRA-991.
 *
 * Two axes, and the second is the one that hid this. Horizontally the block
 * overlapped the column's box from 1024px up, but a box overlap is not ink:
 * `top-24` pins the block to the top of the section while the column is
 * centred in `min-h-screen`, so whether the two sets of glyphs actually meet
 * depends on viewport HEIGHT. At 1024x900 they miss by a pixel and any
 * width-only sweep calls the page clean; at 1280x720 — Playwright's own
 * desktop viewport — five pairs of glyph runs overlap. Both axes are swept
 * here for that reason.
 *
 * Measured on painted glyph runs via `Range.getClientRects()`, not element
 * boxes: the column's block boxes span its full width even where no ink lands,
 * which would report a collision for text that visibly clears. See
 * `span-rect-hides-text-overflow`.
 *
 * Desktop project only. The block is `display:none` below the reveal
 * breakpoint, so the mobile project would sweep viewport sizes it overrides
 * anyway — and an explicit-viewport spec otherwise runs twice for one result.
 */

const STATUS = "div.absolute.top-24.left-8";
const COLUMN = "section .container.relative.z-10";

/** Widths that bracket the gutter threshold, at heights that bracket the centred column. */
const VIEWPORTS = [
  { w: 1024, h: 768 },
  { w: 1280, h: 720 }, // the desktop project's own size
  { w: 1366, h: 768 }, // the most common laptop panel
  { w: 1280, h: 900 },
  { w: 1440, h: 900 },
  { w: 1536, h: 864 },
  { w: 1920, h: 1080 },
];

/**
 * Every pair of overlapping glyph runs between two subtrees. Returns `null`
 * when the ornament is not displayed at all, which is a pass — the whole fix
 * is to withhold it where it does not fit.
 */
async function collisions(page: import("@playwright/test").Page) {
  return page.evaluate(
    ([statusSel, colSel]) => {
      const status = document.querySelector(statusSel);
      const col = document.querySelector(colSel);
      if (!status || !col) return { missing: true, hidden: false, hits: [] as string[] };
      if (getComputedStyle(status).display === "none")
        return { missing: false, hidden: true, hits: [] as string[] };

      const runs = (root: Element) => {
        const out: { x: number; y: number; r: number; b: number; t: string }[] = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!n.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const b of range.getClientRects())
            if (b.width > 0 && b.height > 0)
              out.push({ x: b.x, y: b.y, r: b.right, b: b.bottom, t: n.textContent.trim().slice(0, 30) });
        }
        return out;
      };

      const hits: string[] = [];
      for (const s of runs(status))
        for (const c of runs(col))
          if (!(s.r <= c.x || c.r <= s.x || s.b <= c.y || c.b <= s.y))
            hits.push(`"${s.t}" paints over "${c.t}"`);
      return { missing: false, hidden: false, hits };
    },
    [STATUS, COLUMN] as const
  );
}

test.describe("the hero gutter ornament never overlaps the hero copy", () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < 768,
    "the ornament is display:none on the mobile project, which would sweep these sizes twice for one result"
  );

  for (const { w, h } of VIEWPORTS) {
    test(`no glyph collision at ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/");
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      // Both the ornament and the column animate in on a delay, and the
      // ornament also carries a parallax `x`. Settle past delay+duration
      // (1.2s + 0.6s) before measuring, or a mid-flight `x` reads as clearance.
      await page.waitForTimeout(2200);

      const { missing, hits } = await collisions(page);
      expect(missing, `${STATUS} / ${COLUMN} no longer match — this test is measuring nothing`).toBe(
        false
      );
      expect(hits, `at ${w}x${h} the ornament collides with the hero copy:\n  ${hits.join("\n  ")}`).toEqual(
        []
      );
    });
  }

  /**
   * Control: the measurement can actually see a collision.
   *
   * Every assertion above is an empty-array check, and the fix makes the
   * ornament `display:none` at most of these sizes — so a probe that silently
   * measured nothing would pass identically. This forces the ornament back on
   * at a size the bug covered and requires the collision to reappear.
   */
  test("the probe reports a collision when one exists", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await page.locator(STATUS).evaluate((el) => el.style.setProperty("display", "block", "important"));
    await page.waitForTimeout(2200);

    const { hidden, hits } = await collisions(page);
    expect(hidden, "forcing display:block did not take").toBe(false);
    expect(hits.length, "the unfixed layout collided at 1280x720; the probe must still see it").toBeGreaterThan(0);
  });
});
