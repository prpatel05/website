import { test, expect } from "./fixtures";
import { htmlRoutesFromSitemap } from "./sitemap-routes";

/**
 * Post-derived text must wrap rather than push the page sideways, on every
 * surface that renders it — by construction, not by luck of the queue.
 *
 * This mechanism has now been fixed three times, one element at a time: inline
 * `code` (PRA-962), then the post-body subtree (PRA-963), then the post title
 * (PRA-977). Each fix was correct and each was discovered the same way — a post
 * entered the queue whose text happened to be wide enough to break that one
 * element. The title case is the clearest: `overflow-wrap` is inherited, so the
 * body wrapper's single declaration really did cover the whole body subtree, but
 * the `<h1>` renders ninety lines above that wrapper and outside it, so it
 * inherited nothing.
 *
 * ## Why `text-spacing.spec.ts` does not already cover this
 *
 * It does cover it, but only for the content that is currently queued. It walks
 * the built sitemap and measures real posts at real widths, so it caught the
 * title overflow only because one banked post is titled "Non-Deterministic Is
 * Not the Same as Unmeasurable" — `Unmeasurable` renders 299px at the respaced
 * title size against a 288px budget. Retitling that post would take the suite
 * green while leaving the renderer exactly as broken. Every other surface here
 * passes today for the same accidental reason: no queued post has a long enough
 * word in a subtitle, a tag or a card title yet.
 *
 * So this file asserts the property instead of the sample. It replaces the text
 * of each post-derived element with a token too long for any container, and
 * requires the page not to scroll sideways. A surface that regresses fails here
 * on the day the rule is dropped, not on the day someone queues a post with a
 * long word in it.
 *
 * ## Why this measures the element and not the page
 *
 * Page scroll width is the obvious probe and it is not sufficient, which was
 * worth finding out before trusting it. The first revision of this file asserted
 * only that the document did not begin to scroll sideways, and the three
 * homepage `BlogPreview` surfaces passed it while being just as broken as the
 * rest: measured at 320px, the preview card's `<h3>` holding the token reports
 * `scrollWidth` 741 against `clientWidth` 206, but the section it sits in is
 * `overflow-hidden`, so the page stays at 320 and the 535px of title is simply
 * gone. Silently clipping the text is not a better outcome than scrolling to it.
 *
 * The element's own `scrollWidth - clientWidth` is not the answer either, and
 * failed in the opposite direction: the tag chips are flex items, so an unwrapped
 * token stretches *the box itself* to 448px inside a 256px container rather than
 * overflowing a box that stays put. `scrollWidth` and `clientWidth` come back
 * equal at 448 and the check reads "wrapped" while the page scrolls 162px.
 *
 * So neither box metric generalises, because each describes only one of the two
 * ways an unwrapped token manifests. What is common to every case is the text:
 * this measures the line boxes of the text itself, via a `Range` over the
 * element's contents, and requires the widest line to fit the viewport. A token
 * that wrapped occupies several short lines; a token that did not occupies one
 * long one, whatever its element did to accommodate it. Page overflow is still
 * measured and reported, as the user-visible half of the same defect.
 *
 * The token is several times the width of the widest box it lands in, so it
 * cannot fit on one line on any surface here, and the gap between a wrapped
 * reading (<=256px) and an unwrapped one (432-1334px, measured) is never close.
 */

const routes = htmlRoutesFromSitemap();

/** Any post will do — the rule under test is the renderer's, not this post's. */
const POST = routes.find((r) => /^\/blog\/(?!series\/)[^/]+\/$/.test(r))!;

/**
 * 72 characters with no break opportunity: no hyphen, no space, no case change
 * a wrapper could exploit. Unwrapped, it was measured at 432px on the narrowest
 * surface here (a 10px mono tag chip) and 1334px on the 36px display title, all
 * against a 320px viewport. So a failure means the token did not wrap at all,
 * never that the token was marginally too wide, which keeps the test off the
 * font-metric knife-edge that makes character count a bad proxy for width — the
 * same trap that makes `Unmeasurable` and `Distribution` differ by 39px at equal
 * length.
 */
const LONG_TOKEN = "Nondeterministically".repeat(3) + "Unmeasurable";

/**
 * The three surfaces that render post-derived text, and every distinct element
 * within each. The post page's title and subtitle sit outside the body wrapper
 * that PRA-963 fixed; the two card surfaces were never covered by any of the
 * three fixes and are here so that stays true on purpose.
 */
const SURFACES = [
  { route: POST, name: "post title", selector: "article h1" },
  { route: POST, name: "post subtitle", selector: "article h1 + p" },
  { route: POST, name: "post tag chip", selector: "article [class*='border-primary/20']" },
  { route: "/blog/", name: "index card title", selector: "main article h2" },
  { route: "/blog/", name: "index card subtitle", selector: "main article h2 + p" },
  {
    route: "/blog/",
    name: "index card tag chip",
    selector: "main article [class*='border-primary/20']",
  },
  { route: "/", name: "preview card title", selector: "a[href^='/blog/'] h3" },
  { route: "/", name: "preview card subtitle", selector: "a[href^='/blog/'] h3 + p" },
  {
    route: "/",
    name: "preview card tag chip",
    selector: "a[href^='/blog/'] [class*='border-primary/20']",
  },
];

/** Entrance staggers run to ~3s on the longest list (PRA-951). */
const SETTLE_MS = 3500;

/**
 * Every test here sets one viewport and reads geometry, so the device profile
 * would re-measure an identical layout and double a slow suite for nothing.
 */
test.beforeEach(() => {
  test.skip(
    test.info().project.name !== "chromium",
    "viewport is set explicitly, so the device profile would re-run identical work"
  );
});

/** 320 is the SC 1.4.10 reflow floor, where a long token has least room to fit. */
test.describe("post-derived text wraps at the reflow floor", () => {
  test.use({ viewport: { width: 320, height: 851 } });

  for (const surface of SURFACES) {
    test(`${surface.name} wraps a long word`, async ({ page }) => {
      await page.goto(surface.route);
      await page.waitForTimeout(SETTLE_MS);

      const result = await page.evaluate(
        ({ selector, token }) => {
          const doc = document.documentElement;
          const el = document.querySelector<HTMLElement>(selector);
          if (!el) {
            return { found: false, before: 0, after: 0, widest: 0, lines: 0, viewport: 0, wrap: "" };
          }

          // The control reading matters: several surfaces sit inside decorative
          // `overflow-hidden` wrappers and the page can already be a pixel or
          // two wide for unrelated reasons. Only the delta this token causes is
          // this test's business.
          const before = doc.scrollWidth - doc.clientWidth;
          el.textContent = token;
          void doc.offsetWidth; // force layout before re-reading
          const after = doc.scrollWidth - doc.clientWidth;

          // One rect per line box the text occupies, independent of what the
          // element's own box did to accommodate it.
          const range = document.createRange();
          range.selectNodeContents(el);
          const rects = [...range.getClientRects()];

          return {
            found: true,
            before,
            after,
            widest: Math.round(Math.max(0, ...rects.map((r) => r.width))),
            lines: rects.length,
            viewport: doc.clientWidth,
            wrap: getComputedStyle(el).overflowWrap,
          };
        },
        { selector: surface.selector, token: LONG_TOKEN }
      );

      expect(result.found, `no element matched \`${surface.selector}\` on ${surface.route}`).toBe(
        true
      );

      const pageDelta = result.after - result.before;
      const outcome =
        pageDelta > 1
          ? `the page began scrolling sideways (${result.before}px -> ${result.after}px)`
          : `an ancestor clipped it, so the text is lost rather than reachable`;

      expect(
        result.widest,
        `${surface.name} did not wrap a long word: it rendered on ${result.lines} line(s), ` +
          `the widest ${result.widest}px against a ${result.viewport}px viewport ` +
          `(overflow-wrap: ${result.wrap}), and ${outcome}. ` +
          `Post-derived text must wrap; see the header of this file.`
      ).toBeLessThanOrEqual(result.viewport);
    });
  }
});
