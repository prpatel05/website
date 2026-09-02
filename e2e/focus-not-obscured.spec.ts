import { test, expect, type Page } from "./fixtures";

/**
 * A focus ring never lands entirely behind the fixed navbar.
 *
 * WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum, AA): when a component
 * receives keyboard focus, it must not be *entirely* hidden by author content.
 * The navbar is `fixed top-0` and 64px tall, so it covers the top of the
 * scrollport at every scroll position — the classic way to fail this.
 *
 * The failure is not "the browser scrolls the target under the nav". It is that
 * the browser does not scroll at all. Chrome's scroll-into-view for sequential
 * focus navigation is a no-op when the target already intersects the scrollport,
 * and the band behind the nav counts as inside it. So a target that a previous
 * focus stop happened to leave sitting at y=15 stays at y=15, and the ring is
 * painted underneath 64px of opaque navbar. `scroll-padding-top` is the fix
 * precisely because it edits *that* test: it removes the nav's band from the
 * viewing region, so the browser now has something to do.
 *
 * That mechanism is why the obvious repro — focus the next element, press
 * Shift+Tab — reports the page clean. Focusing the neighbour scrolls the page
 * itself, leaving the target comfortably mid-viewport. Reproducing the defect
 * takes restoring the scroll position a reader coming down the page would
 * actually have when they reverse: the target inside the scrollport, behind the
 * nav. The test does that explicitly rather than tabbing 50 times to stumble
 * into it (which is how it was originally found).
 *
 * Desktop only. The offending element is laid out to the right of a `sm:` flex
 * row and only lands in the nav band above the `md` breakpoint; a 120-stop
 * sweep of both viewports found nothing on mobile, and the spec costs double if
 * it runs under both projects for no coverage.
 *
 * Assertions are hit-tests, not `toBeVisible()`, which ignores whether anything
 * is painted on top. A single centre point would false-negative against a
 * coverer with a gap, so this samples a 7x7 grid over the on-screen portion.
 */

/** Sample the visible portion of the focused element, return how many of the 49 points reach it. */
const HIT_TEST = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { error: "nothing focused" };
  const r = el.getBoundingClientRect();
  const x0 = Math.max(r.left, 0), x1 = Math.min(r.right, innerWidth);
  const y0 = Math.max(r.top, 0), y1 = Math.min(r.bottom, innerHeight);
  if (x1 <= x0 || y1 <= y0) return { error: "focused element is outside the viewport" };
  let hits = 0;
  const coverers = new Set();
  for (let i = 1; i <= 7; i++) {
    for (let j = 1; j <= 7; j++) {
      const t = document.elementFromPoint(x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * j) / 8);
      if (t && (t === el || el.contains(t))) hits++;
      else if (t && !t.contains(el)) coverers.add(t.closest("nav") ? "nav[fixed]" : t.tagName.toLowerCase());
    }
  }
  return {
    hits, of: 49,
    text: el.innerText.trim().slice(0, 20),
    top: Math.round(r.top),
    coverers: [...coverers],
  };
})()`;

/**
 * Put focus on the short `ls ./posts` link the way a reader reversing up the
 * page does, with the scroll left where the stop below it ended up.
 */
async function shiftTabOntoBlogLink(page: Page) {
  const docY = await page.evaluate(() => {
    const target = [...document.querySelectorAll('main a[href="/blog/"]')].find((a) =>
      (a as HTMLElement).innerText.includes("ls ./posts")
    ) as HTMLElement | undefined;
    if (!target) throw new Error("BlogPreview 'ls ./posts' link not found");
    const focusable = [...document.querySelectorAll<HTMLElement>(
      'a[href], button, input, [tabindex]:not([tabindex="-1"])'
    )].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === "fixed");
    const next = focusable[focusable.indexOf(target) + 1];
    if (!next) throw new Error("no focusable element after the 'ls ./posts' link");
    next.focus();
    return Math.round(target.getBoundingClientRect().top + scrollY);
  });

  // Focusing the neighbour scrolled. Restore the position that leaves the
  // target inside the scrollport but behind the nav; scrolling does not move
  // focus, so the Shift+Tab below still arrives at the target.
  await page.evaluate((y) => window.scrollTo(0, y - 15), docY);
  await page.waitForTimeout(300);
  await page.keyboard.press("Shift+Tab");
  await page.waitForTimeout(400);
}

test.describe("focus is never entirely hidden behind the fixed navbar", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Desktop layout only — the target does not land in the nav band on mobile"
    );
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("Shift+Tab onto the BlogPreview link leaves it on screen", async ({ page }) => {
    await shiftTabOntoBlogLink(page);
    const result = await page.evaluate(HIT_TEST);

    expect(result.error, `probe broke: ${result.error}`).toBeUndefined();
    expect(result.text).toContain("ls ./posts");
    expect(
      result.hits,
      `focused link is entirely behind ${result.coverers.join(", ")} at y=${result.top}`
    ).toBeGreaterThan(0);
  });

  /**
   * Control. Without this the assertion above is unfalsifiable: it would pass
   * just as happily if the hit-test were broken, or if some later change moved
   * the link somewhere it could never be covered. Overriding the rule at
   * runtime — rather than deleting it from source — keeps the control honest
   * without needing a rebuilt `dist/` to express the "before" state.
   */
  test("control: without scroll-padding-top the same link is entirely obscured", async ({ page }) => {
    await page.addStyleTag({ content: "html { scroll-padding-top: 0 !important; }" });
    await shiftTabOntoBlogLink(page);
    const result = await page.evaluate(HIT_TEST);

    expect(result.error, `probe broke: ${result.error}`).toBeUndefined();
    expect(result.text).toContain("ls ./posts");
    expect(result.hits, "control did not reproduce the defect the fix exists for").toBe(0);
    expect(result.coverers).toContain("nav[fixed]");
  });
});
