import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "./fixtures";

/**
 * Windows High Contrast readers must still see our controls and our meters.
 *
 * In forced colours the UA replaces author colours with the reader's palette:
 * `background-color` becomes Canvas, `box-shadow` is dropped, and any
 * background-image that is not a `url()` — every CSS gradient — is removed
 * outright. Anything we draw *only* with a background therefore stops existing.
 *
 * Nothing else in the suite sees this. `a11y-axe.spec.ts` runs in our own
 * palette, and axe has no forced-colours rule; the contrast sweep behind
 * PRA-992 measured shipped pixels, which is a different regime entirely. Both
 * defects below were live until PRA-998.
 *
 * ## Emulate with `page.emulateMedia`, never `test.use`
 *
 * `test.use({ forcedColors })` is a context option that does not reach the
 * page's media queries here — the same trap `reduced-motion.spec.ts` documents
 * for `reducedMotion`. A spec written that way runs in the ordinary palette and
 * passes no matter what the CSS says. Every test below asserts
 * `matchMedia("(forced-colors: active)")` first, so a regression in the
 * emulation itself fails loudly instead of quietly voiding the file.
 *
 * ## Assert computed style, not class names
 *
 * The fix is a set of `forced-colors:` Tailwind variants. A class that never
 * compiles still appears in the markup, so asserting on `class` would pass on a
 * broken build. Everything here reads back the used value from the browser.
 */

/**
 * The third filled CTA lives behind `unrecovered` in `BlogPost.tsx` — the state
 * a reader reaches only when the body chunk failed *and* the reload that state
 * spends did not bring it back. Driving there needs the same two route
 * interceptions `post-body-recovery.spec.ts` uses, so the slug is derived the
 * same way: from the built sitemap, never hardcoded, so this cannot pin itself
 * to a post that gets renamed or unpublished.
 */
const SITEMAP = fileURLToPath(new URL("../dist/sitemap.xml", import.meta.url));
const slug = [...readFileSync(SITEMAP, "utf8").matchAll(/<loc>[^<]*\/blog\/([^/<]+)\/<\/loc>/g)]
  .map(([, s]) => s)
  .sort()[0];

async function forced(page: Page, url = "/") {
  await page.emulateMedia({ forcedColors: "active", colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "load" });
  expect(
    await page.evaluate(() => matchMedia("(forced-colors: active)").matches),
    "forced-colors emulation did not reach the page — the rest of this file would be vacuous"
  ).toBe(true);
}

test.describe("forced colours", () => {
  test("a filled primary button keeps a visible boundary", async ({ page }) => {
    await forced(page);

    // `bg-primary` alone: Canvas swallows the fill and `box-glow` is dropped, so
    // before PRA-998 this measured border-top-width 0px and the control was
    // indistinguishable from the body text around it.
    const cta = page.getByRole("link", { name: "./contact --init" });
    await expect(cta).toBeVisible();

    const box = await cta.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        borderTopWidth: parseFloat(cs.borderTopWidth),
        borderTopStyle: cs.borderTopStyle,
        outlineWidth: parseFloat(cs.outlineWidth),
        outlineStyle: cs.outlineStyle,
      };
    });

    const bounded =
      (box.borderTopWidth > 0 && box.borderTopStyle !== "none") ||
      (box.outlineWidth > 0 && box.outlineStyle !== "none");
    expect(bounded, `primary CTA has no boundary in forced colours: ${JSON.stringify(box)}`).toBe(true);
  });

  test("the 404 route's only control keeps a visible boundary", async ({ page }) => {
    await forced(page, "/this-route-does-not-exist/");

    const cta = page.getByRole("link", { name: /cd ~/ });
    await expect(cta).toBeVisible();

    const width = await cta.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
    expect(width, "404 CTA has no border in forced colours").toBeGreaterThan(0);
  });

  test("the post-body error control keeps a visible boundary", async ({ page }) => {
    await page.emulateMedia({
      forcedColors: "active",
      colorScheme: "light",
      reducedMotion: "reduce",
    });

    // Fail the chunk on every load, the recovery reload included...
    await page.route(`**/assets/${slug}-*.js`, (route) => route.abort("failed"));
    // ...and strip the body out of the served HTML, so the reload lands on the
    // same empty page the fetch was meant to fill. That is what spends the
    // one-shot reload and puts the error block on screen.
    await page.route(`**/blog/${slug}/`, async (route) => {
      const res = await route.fetch();
      const html = (await res.text()).replace(
        /(data-post-body="[^"]*")([^>]*>)[\s\S]*?(?=<\/div>)/,
        "$1$2"
      );
      return route.fulfill({ response: res, body: html });
    });

    await page.goto("/blog/");
    expect(
      await page.evaluate(() => matchMedia("(forced-colors: active)").matches),
      "forced-colors emulation did not reach the page — this test would be vacuous"
    ).toBe(true);

    // Client-side, by href: the body is only fetched on a navigation, and the
    // slug has no reliable relationship to the post's title.
    await page.locator(`a[href="/blog/${slug}/"]`).first().click();
    await page.waitForURL(`**/blog/${slug}/`);

    const cta = page.getByRole("link", { name: /cd ~\/blog/ });
    await expect(cta).toBeVisible({ timeout: 15_000 });

    const width = await cta.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
    expect(width, "post-body error CTA has no border in forced colours").toBeGreaterThan(0);
  });

  test("the skill meters still paint a fill and a track", async ({ page }) => {
    await forced(page);

    await page.evaluate(() => document.querySelector("#about")?.scrollIntoView());
    // The fill animates its width on entrance; settle past delay + duration
    // (0.6 + 6*0.08 + 0.8s) before measuring, or a mid-flight width reads as the
    // resting one.
    await page.waitForTimeout(2200);

    const bars = await page.evaluate(() =>
      [...document.querySelectorAll('[class*="bg-gradient-to-r"]')].map((f) => {
        const cs = getComputedStyle(f);
        const track = f.parentElement as HTMLElement;
        const ts = getComputedStyle(track);
        const alpha = (cs.backgroundColor.match(/[\d.]+/g) ?? [])[3];
        return {
          // The gradient is gone in this mode by definition; what matters is
          // that something opaque replaced it.
          fillOpaque: cs.backgroundImage === "none" ? alpha === undefined || parseFloat(alpha) > 0 : true,
          trackBorder: parseFloat(ts.borderTopWidth),
          fillWidth: f.getBoundingClientRect().width,
          trackWidth: track.getBoundingClientRect().width,
        };
      })
    );

    expect(bars.length, "found no skill meters to measure").toBeGreaterThan(0);
    for (const b of bars) {
      expect(b.fillOpaque, `meter fill paints nothing in forced colours: ${JSON.stringify(b)}`).toBe(true);
      expect(b.trackBorder, `meter track has no outline: ${JSON.stringify(b)}`).toBeGreaterThan(0);
      // A fill that fills its track conveys no level. That is a real failure
      // mode here, not a hypothetical one: the resting width lives in `style`
      // precisely because without it every skill read 100% until hydration
      // scrolled it into view (see the comment in About.tsx).
      expect(b.fillWidth).toBeLessThan(b.trackWidth);
      expect(b.fillWidth).toBeGreaterThan(0);
    }
  });

  test("our own palette is untouched by the fix", async ({ page }) => {
    // The `forced-colors:` variants must not leak into the ordinary regime: the
    // meters keep their gradient and the CTA keeps its borderless fill.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "load" });

    const cta = await page
      .getByRole("link", { name: "./contact --init" })
      .evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(cta).toBe("0px");

    await page.evaluate(() => document.querySelector("#about")?.scrollIntoView());
    await page.waitForTimeout(2200);
    const img = await page.evaluate(
      () => getComputedStyle(document.querySelector('[class*="bg-gradient-to-r"]')!).backgroundImage
    );
    expect(img).toContain("linear-gradient");
  });
});
