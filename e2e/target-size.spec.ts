import { htmlRoutesFromSitemap } from "./sitemap-routes";
import { test, expect, type Page,
  openMobileMenu,
} from "./fixtures";

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

const routes = htmlRoutesFromSitemap();

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

  // The overlay's links and its close button only exist in the DOM while it is
  // open, so the per-route sweep above is blind to the entire mobile menu — the
  // one nav surface on the site that is nothing but controls.
  test("the open mobile menu has no undersized targets", async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= 768,
      "the [menu] button is md:hidden, so there is no overlay to open on desktop"
    );

    await page.goto("/");
    // A click rather than a bare toggle, because `setOpen` is React state and
    // Playwright's actionability checks are what wait out hydration.
    await openMobileMenu(page);

    const undersized = await undersizedTargets(page, MIN_TARGET_PX);

    expect(
      undersized,
      `the open mobile menu has ${undersized.length} target(s) under ` +
        `${MIN_TARGET_PX}x${MIN_TARGET_PX}:\n  ${undersized.join("\n  ")}`
    ).toEqual([]);
  });
});
