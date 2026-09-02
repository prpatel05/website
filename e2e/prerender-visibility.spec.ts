import { test, expect, type Page } from "./fixtures";

/**
 * What a crawler — or any reader during the second before the bundle arrives —
 * actually sees.
 *
 * The prerendered homepage once shipped its entire body below the hero at
 * inline `opacity: 0`: About, Recent writes and Contact were all present in the
 * HTML and all invisible until React had downloaded, hydrated and had an
 * IntersectionObserver fire. Every other homepage test scrolls the section into
 * view with JavaScript running first, which is exactly the state that hides the
 * bug.
 *
 * Assertions here read computed opacity rather than `toBeVisible()`. Playwright
 * calls an `opacity: 0` element visible — it checks the bounding box and
 * `visibility`, not whether anything is painted — so a `toBeVisible()` suite
 * passes against the broken build. Verified: it does.
 *
 * `scripts/prerender.mjs` fails the build on any inline `opacity: 0`, which is
 * the tighter gate. This is the same claim stated as behaviour: not "the markup
 * carries no hidden styles" but "a visitor without JavaScript can read this".
 */

const opacityOf = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return "ABSENT";
    return getComputedStyle(el).opacity;
  }, selector);

test.describe("prerendered page is visible without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the homepage body is painted below the hero", async ({ page }) => {
    await page.goto("/");

    // Each section's `.container` carries the scroll-linked opacity, and its
    // children carry their own `initial` states. Those are two separate causes
    // that both blank the page, so both are named here: fixing one alone still
    // leaves a reader looking at nothing.
    for (const selector of [
      "h1",
      "#about .container",
      "#about .container [class*='grid']",
      "#writing .container",
      "#writing article",
      "#contact .container",
      "#contact .container a[href^='mailto:']",
    ]) {
      expect(await opacityOf(page, selector), selector).toBe("1");
    }
  });

  test("nothing in the served markup is transparent", async ({ page }) => {
    await page.goto("/");

    const transparent = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => parseFloat(getComputedStyle(el).opacity) === 0)
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
    );

    expect(transparent).toEqual([]);
  });

  /**
   * Opacity is not the only resting state the prerender can get wrong, and the
   * skill bars are the case that proves it. They animate `width`, and
   * `useEntrance` suppresses `initial` on first load — which for opacity and
   * transforms lands on the correct value, because "no inline style" already
   * means opacity 1 and no offset. `width` has no such default: with the style
   * absent the bar fills its track, so all seven read 100% while the numbers
   * beside them said 95/92/90/92/88/85/85.
   *
   * Compared against each bar's own label rather than a hardcoded list, so
   * editing a skill level cannot quietly make this vacuous.
   */
  test("each skill bar is as long as the number beside it", async ({ page }) => {
    await page.goto("/");

    const bars = await page.evaluate(() =>
      [...document.querySelectorAll("#about .h-full.bg-gradient-to-r")].map((bar) => {
        const track = bar.parentElement!;
        const spans = track.parentElement!.querySelectorAll("span");
        const trackWidth = track.getBoundingClientRect().width;
        return {
          skill: spans[0]?.textContent?.trim() ?? "?",
          label: spans[1]?.textContent?.trim() ?? "?",
          rendered: trackWidth
            ? `${Math.round((bar.getBoundingClientRect().width / trackWidth) * 100)}%`
            : "no-track",
        };
      })
    );

    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      expect(bar.rendered, bar.skill).toBe(bar.label);
    }
  });
});
