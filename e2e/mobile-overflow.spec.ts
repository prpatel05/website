import { test, expect, type Page, openTerminalByClick } from "./fixtures";
import { htmlRoutesFromSitemap } from "./sitemap-routes";

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

const routes = htmlRoutesFromSitemap();

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

/**
 * 393 is Pixel 5 — the narrow end of what the analytics actually see, and the
 * width the blog index broke at.
 *
 * 320 is not a phone we see; it is the reflow floor. WCAG 2.1 SC 1.4.10 asks for
 * no two-axis scrolling at a 320 CSS px equivalent, which is what a desktop
 * reader at 400% browser zoom on a 1280px screen gets — zoom shrinks the CSS
 * viewport, so it fires the same media queries as a 320px phone. That reader is
 * why this width is here even though no device in the analytics is this narrow,
 * and it is why the analytics argument for 393 does not bound the list. `axe`
 * cannot see reflow, so nothing else in the suite covers it.
 */
const WIDTHS = [320, 393];

for (const width of WIDTHS) {
  test.describe(`no page scrolls sideways at ${width}px`, () => {
    test.use({ viewport: { width, height: 851 } });

    for (const route of routes) {
      test(`${route} fits its viewport`, async ({ page }) => {
        await page.goto(route);

        // The row that broke is above the fold and laid out from prerendered
        // markup, so this reads a real layout without waiting on hydration.
        const { viewport, overflow, offenders } = await overflowOf(page);

        expect(viewport).toBe(width);
        expect(
          overflow,
          `${route} overflows by ${overflow}px at ${width}px:\n  ${offenders.join("\n  ")}`
        ).toBeLessThanOrEqual(0);
      });
    }
  });
}

/**
 * The closed-page sweep above never opens the terminal. Long unbroken output
 * (`echo` of a URL, box-drawing that overshoots at 320) used `pre-wrap` without
 * `overflow-wrap`, so the log grew a horizontal scroller; on a phone that pan
 * reads as the page stretching. Cover the open dialog at both widths with the
 * commands that produced the widest scrollback.
 */

const LONG_ECHO = `echo ${"https://example.com/".padEnd(160, "x")}`;

for (const width of WIDTHS) {
  test.describe(`open terminal does not scroll sideways at ${width}px`, () => {
    test.use({ viewport: { width, height: 851 } });

    test(`home with skills + long echo fits at ${width}px`, async ({ page }) => {
      await page.goto("/");
      await openTerminalByClick(page);

      const input = page.getByPlaceholder('type "help" to get started...');
      for (const cmd of ["skills", "help", LONG_ECHO]) {
        await input.fill(cmd);
        await input.press("Enter");
      }

      const { viewport, overflow, offenders } = await overflowOf(page);
      expect(viewport).toBe(width);
      expect(
        overflow,
        `open terminal overflows the page by ${overflow}px at ${width}px:\n  ${offenders.join("\n  ")}`
      ).toBeLessThanOrEqual(0);

      // The log itself must not grow a sideways scroller either. Page-level
      // scrollWidth can stay clean while overflow-x:auto on the log still lets
      // a thumb drag the scrollback sideways.
      const log = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[role="log"]');
        if (!el) return null;
        const sample = el.querySelector<HTMLElement>(":scope > div");
        return {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowWrap: sample ? getComputedStyle(sample).overflowWrap : null,
        };
      });
      expect(log, "terminal log missing").not.toBeNull();
      expect(
        log!.scrollWidth - log!.clientWidth,
        `terminal log has ${log!.scrollWidth - log!.clientWidth}px of horizontal overflow ` +
          `(overflow-wrap: ${log!.overflowWrap})`
      ).toBeLessThanOrEqual(1);
      expect(log!.overflowWrap).toMatch(/anywhere|break-word/);
    });
  });
}
