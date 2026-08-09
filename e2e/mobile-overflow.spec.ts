import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "./fixtures";

/**
 * Nothing on a phone should scroll sideways.
 *
 * The blog index shipped a metadata row — date, read time, then one chip per
 * tag — as a plain `flex` with no `flex-wrap`. Flex items do not wrap by
 * default, so on a 393px viewport the row stayed one line and the chips ran off
 * the right edge: 196px of horizontal overflow, with `#observability` and
 * friends sitting entirely outside the viewport. The two sibling components
 * that render the same row, `BlogPreview` and `BlogPost`, both already carried
 * `flex-wrap`, so the defect was one file out of step rather than a pattern.
 *
 * No unit test can see this. Every assertion about that row passes on the
 * broken markup — the chips are in the DOM, they have the right text, and
 * jsdom has no layout, so nothing there knows where they landed. It needs a
 * real engine at a real width, which is what this is.
 *
 * Routes come from the built sitemap rather than a hardcoded list so a new post
 * is covered the day it lands, and so this cannot quietly shrink to the handful
 * of pages that happened to exist when it was written.
 */

const SITEMAP = fileURLToPath(new URL("../dist/sitemap.xml", import.meta.url));

const routes = [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  ([, loc]) => new URL(loc).pathname
);

/**
 * The horizontal overflow, plus enough about the widest offenders to name the
 * element in the failure message. `scrollWidth` on the documentElement is the
 * whole page's laid-out width, so an element pushed past the edge shows up here
 * whether or not anything clipped it.
 */
const overflowOf = (page: Page) =>
  page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.right > viewport + 1)
      .map(({ el, box }) => {
        const label = el.textContent?.trim().slice(0, 40) ?? "";
        return `<${el.tagName.toLowerCase()} class="${el.className}"> right=${Math.round(
          box.right
        )} "${label}"`;
      });

    return {
      viewport,
      overflow: document.documentElement.scrollWidth - viewport,
      offenders: offenders.slice(0, 5),
    };
  });

test.describe("no page scrolls sideways on a phone", () => {
  // Pixel 5's 393px is the narrow end of what the analytics actually see, and
  // it is the width the blog index broke at.
  test.use({ viewport: { width: 393, height: 851 } });

  for (const route of routes) {
    test(`${route} fits its viewport`, async ({ page }) => {
      await page.goto(route);

      // The row that broke is above the fold and laid out from prerendered
      // markup, so this reads a real layout without waiting on hydration.
      const { viewport, overflow, offenders } = await overflowOf(page);

      expect(viewport).toBe(393);
      expect(
        overflow,
        `${route} overflows by ${overflow}px:\n  ${offenders.join("\n  ")}`
      ).toBeLessThanOrEqual(0);
    });
  }
});
