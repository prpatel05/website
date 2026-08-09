import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "./fixtures";

/**
 * Every standalone control is big enough to hit with a thumb.
 *
 * WCAG 2.2 SC 2.5.8 Target Size (Minimum, AA) puts the floor at 24x24 CSS px.
 * The terminal-style navigation missed it everywhere: `cd ~` measured 53x16 on
 * 24 routes, `ls ../posts` 329x16 on 23, and those are the primary way back out
 * of a blog post. The width was never the problem — a one-line `font-mono
 * text-xs` link is exactly its 16px line box tall, so the whole nav idiom was
 * 8px short.
 *
 * The SC's exception for targets "in a sentence or block of text" is why this
 * excludes the post body. Links inside prose are ~18px and stay that way: they
 * flow with the sentence, so padding them would space the paragraph out. Every
 * other link and button on the page is a standalone control with no exception
 * to claim, which is what makes "everything outside `[data-post-body]`" the
 * right scope rather than a hand-listed set of selectors that a new component
 * would silently fall out of.
 *
 * Runs under both Playwright projects, and both breakpoints carry links the
 * other cannot see: the `cd ~`/`ls` nav is the mobile surface, while Navbar's
 * `about()`/`writing()`/`contact()`/`resume()` row is `hidden md:flex` and only
 * exists on desktop. A mobile-only assertion would have reported this clean
 * while four desktop nav links sat at 16px.
 *
 * Routes come from the built sitemap, as in `mobile-overflow.spec.ts`, so a new
 * post is covered the day it lands.
 */

/** WCAG 2.2 SC 2.5.8 Target Size (Minimum), level AA. */
const MIN_TARGET_PX = 24;

const SITEMAP = fileURLToPath(new URL("../dist/sitemap.xml", import.meta.url));

const routes = [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  ([, loc]) => new URL(loc).pathname
);

/**
 * Standalone controls smaller than the floor, with enough detail to name the
 * element in the failure message.
 *
 * Measured with `offsetWidth`/`offsetHeight` rather than `getBoundingClientRect`
 * because entrance animations transform these subtrees. A rect is
 * post-transform, so a control caught mid-`scale` measures small and the test
 * flakes on animation timing; the offset pair is the laid-out CSS size, which is
 * both what the SC is written in and stable the moment layout exists.
 */
const undersizedTargets = (page: Page, min: number) =>
  page.evaluate((minPx) => {
    const elements = [...document.querySelectorAll<HTMLElement>("a, button")];

    return elements
      .filter((el) => {
        // Not rendered at this breakpoint (`hidden md:flex`) — not a target here.
        if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
        // Visually hidden until focused. SC 2.5.8 governs pointer targets, and
        // the skip link is not one; focused, it carries its own px-4 py-2.
        if (el.classList.contains("sr-only")) return false;
        // Inline prose link — the "in a sentence or block of text" exception.
        if (el.closest("[data-post-body]")) return false;
        return true;
      })
      .filter((el) => el.offsetWidth < minPx || el.offsetHeight < minPx)
      .map(
        (el) =>
          `<${el.tagName.toLowerCase()} class="${el.className}"> ` +
          `${el.offsetWidth}x${el.offsetHeight} "${(el.textContent ?? "").trim().slice(0, 40)}"`
      );
  }, min);

test.describe("standalone controls meet the WCAG target size minimum", () => {
  for (const route of routes) {
    test(`${route} has no undersized targets`, async ({ page }) => {
      await page.goto(route);

      // The nav is prerendered and `offsetHeight` is a layout value, so this
      // reads a real size without waiting on hydration or on animations.
      const undersized = await undersizedTargets(page, MIN_TARGET_PX);
      const width = page.viewportSize()?.width;

      expect(
        undersized,
        `${route} at ${width}px has ${undersized.length} target(s) under ` +
          `${MIN_TARGET_PX}x${MIN_TARGET_PX}:\n  ${undersized.join("\n  ")}`
      ).toEqual([]);
    });
  }
});
