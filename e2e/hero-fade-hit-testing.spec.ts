import { test, expect, type Page } from "./fixtures";

/**
 * The hero column fades out against the scrollbar, and for a long stretch of
 * that fade its two CTAs went on taking taps. A reader scrolling the homepage
 * on a phone could tap what looked like blank space — or the section that had
 * scrolled up behind them — and be teleported: measured on `main`, a real
 * `mouse.click` at scrollY 651, where `./contact --init` was painted at 0.045
 * opacity and still the topmost element, moved the document to 4064 and put
 * `#contact` in the URL. `cat resume.pdf` opened a popup on the same treatment.
 *
 * Opacity is not a hit-testing property, so the only assertion that can see
 * this is the browser's own: `elementsFromPoint` over the CTA's own rect.
 * `toBeVisible()` cannot — it ignores opacity entirely, and reported both
 * buttons visible for the whole broken range. Nor can anything reading the
 * inline style: framer hands the scroll-linked opacity to a native
 * ViewTimeline, so `style="opacity: 1"` sits there while the painted value is
 * 0.0023.
 *
 * The two halves of the contract, then:
 *   - a CTA the reader cannot see must not be the topmost paint anywhere, and
 *   - a CTA the reader *can* see must be the topmost paint everywhere,
 * with both states actually reached, per CTA, or the walk proved nothing.
 */

const CTAS = ["./contact --init", "cat resume.pdf"] as const;

/** The whole hero column, the element the fade and the gate are bound to. */
const HERO_COLUMN = "section .container.relative.z-10";

/**
 * The gate's own threshold (`MIN_INTERACTIVE_OPACITY` in `useParallax.ts`).
 * At or below this the CTA is a ghost and must not be reachable.
 */
const GHOST_OPACITY = 0.1;

/** Comfortably above the gate: the reader can see this and is aiming at it. */
const READABLE_OPACITY = 0.5;

/**
 * The mobile viewport the defect was measured on. The desktop project scrolls
 * a 720px-tall hero and the CTAs leave the viewport before the fade is deep
 * enough to matter, so it cannot reach the ghost-on-screen state this file
 * exists to pin — and a per-CTA control below would fail rather than pass
 * vacuously. Both projects still run the reduced-motion case.
 */
const PHONE = { width: 393, height: 852 };

type CtaReading = {
  /** Points inside the viewport-clipped rect where this CTA is the topmost paint. */
  onTop: number;
  samples: number;
  /** Effective opacity, multiplied up the ancestor chain. */
  opacity: number;
  /** False once an ancestor is `visibility: hidden` — painted nowhere. */
  painted: boolean;
  /** Clear of the fixed navbar, which legitimately covers things. */
  belowChrome: boolean;
  covering: string | null;
};

async function sampleCtas(page: Page): Promise<Record<string, CtaReading>> {
  return page.evaluate((labels) => {
    const out: Record<string, CtaReading> = {};
    const navBottom = Math.max(
      0,
      ...Array.from(document.querySelectorAll("nav, header")).map(
        (el) => el.getBoundingClientRect().bottom,
      ),
    );

    for (const label of labels) {
      const el = Array.from(document.querySelectorAll("a")).find(
        (a) => a.textContent?.trim() === label,
      );
      if (!el) continue;

      let opacity = 1;
      let painted = true;
      for (
        let node: Element | null = el;
        node && node !== document.documentElement;
        node = node.parentElement
      ) {
        const cs = getComputedStyle(node);
        opacity *= Number(cs.opacity);
        if (cs.visibility === "hidden" || cs.display === "none") painted = false;
      }

      const r = el.getBoundingClientRect();
      const left = Math.max(r.left, 0);
      const right = Math.min(r.right, window.innerWidth);
      const top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, window.innerHeight);

      let onTop = 0;
      let samples = 0;
      let covering: string | null = null;
      for (let x = left + 2; x < right - 2; x += 8) {
        for (let y = top + 2; y < bottom - 2; y += 8) {
          samples++;
          const hit = document.elementsFromPoint(x, y)[0];
          if (hit === el || el.contains(hit)) onTop++;
          else if (!covering && hit)
            covering = `${hit.tagName}.${String(hit.className || "").slice(0, 32)}`;
        }
      }

      out[label] = {
        onTop,
        samples,
        opacity,
        painted,
        belowChrome: r.top >= navBottom,
        covering,
      };
    }
    return out;
  }, CTAS as unknown as string[]);
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  // framer writes the gate from a rAF after the scroll event, so a sample taken
  // in the same tick reads the previous frame.
  await page.evaluate(
    () =>
      new Promise<void>((res) =>
        requestAnimationFrame(() => requestAnimationFrame(() => res())),
      ),
  );
}

test.describe("Hero CTAs stop taking taps once they have faded out", () => {
  test.use({ viewport: PHONE });

  test("an invisible CTA is never the topmost paint", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: CTAS[0] })).toBeVisible();

    const tappableWhileGhost: string[] = [];
    const deadWhileReadable: string[] = [];
    const seenGhostOnScreen = new Set<string>();
    const seenReadable = new Set<string>();

    for (let y = 0; y <= 900; y += 25) {
      await scrollTo(page, y);
      const reading = await sampleCtas(page);

      for (const label of CTAS) {
        const d = reading[label];
        // No sampled points means the CTA has left the viewport entirely.
        // Nothing to say about a tap that cannot land on it.
        if (!d || d.samples === 0) continue;

        if (!d.painted || d.opacity <= GHOST_OPACITY) {
          seenGhostOnScreen.add(label);
          if (d.onTop > 0) {
            tappableWhileGhost.push(
              `"${label}" at scrollY=${y}: topmost at ${d.onTop}/${d.samples} points while painted at opacity ${d.opacity.toFixed(4)}${d.painted ? "" : " (and visibility:hidden)"}`,
            );
          }
          continue;
        }

        if (d.opacity >= READABLE_OPACITY && d.belowChrome) {
          seenReadable.add(label);
          if (d.onTop < d.samples) {
            deadWhileReadable.push(
              `"${label}" at scrollY=${y}: topmost at only ${d.onTop}/${d.samples} points at opacity ${d.opacity.toFixed(4)}, covered by ${d.covering}`,
            );
          }
        }
      }
    }

    // Per CTA, not once for the page. The two buttons are siblings under one
    // gate today, but a page-wide "we saw a ghost" flag is satisfied by
    // whichever one still fades, and would go on passing while the other was
    // silently ungated. This is the assertion that makes the two below
    // non-vacuous: without a ghost-on-screen sample there was nothing to catch.
    expect(
      [...seenGhostOnScreen].sort(),
      "every hero CTA should be caught faded-out while still inside the viewport; one that never is has no scroll-linked fade at all, and the assertion below never ran for it",
    ).toEqual([...CTAS].sort());

    expect(
      [...seenReadable].sort(),
      "every hero CTA should be caught fully readable and clear of the navbar",
    ).toEqual([...CTAS].sort());

    expect(
      tappableWhileGhost,
      "a CTA the reader cannot see is still collecting taps",
    ).toEqual([]);

    // The other half: a gate that simply never opens would satisfy the check
    // above perfectly.
    expect(
      deadWhileReadable,
      "a CTA the reader can see has stopped being reachable",
    ).toEqual([]);
  });

  for (const label of CTAS) {
    test(`a real tap on the faded "${label}" goes nowhere`, async ({
      page,
      context,
    }) => {
      await page.goto("/");
      await expect(page.getByRole("link", { name: CTAS[0] })).toBeVisible();

      // Walk to the first position where this CTA is a ghost but still has
      // pixels inside the viewport — the exact state the reader taps into.
      let target: { x: number; y: number; scrollY: number } | null = null;
      for (let y = 0; y <= 900 && !target; y += 25) {
        await scrollTo(page, y);
        const d = (await sampleCtas(page))[label];
        if (!d || d.samples === 0) continue;
        if (d.painted && d.opacity > GHOST_OPACITY) continue;
        target = await page.evaluate((text) => {
          const el = Array.from(document.querySelectorAll("a")).find(
            (a) => a.textContent?.trim() === text,
          )!;
          const r = el.getBoundingClientRect();
          return {
            x: r.left + r.width / 2,
            y: Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1),
            scrollY: window.scrollY,
          };
        }, label);
      }

      // Establishes the precondition rather than assuming it: a click aimed at
      // a CTA that had already left the viewport would pass this test without
      // exercising anything.
      expect(
        target,
        `"${label}" was never a ghost inside the viewport, so there was nothing to tap`,
      ).not.toBeNull();

      const before = await page.evaluate(() => ({
        scrollY: window.scrollY,
        url: location.href,
      }));

      // `mouse.click` rather than `locator.click()`: the locator API scrolls the
      // element into view first, which would undo the scroll position that is
      // the whole precondition, and it also refuses to click something it
      // considers hidden — deciding the outcome instead of measuring it.
      const popup = context.waitForEvent("page", { timeout: 1500 }).catch(() => null);
      await page.mouse.click(target!.x, target!.y);
      await page.waitForTimeout(1000);

      const after = await page.evaluate(() => ({
        scrollY: window.scrollY,
        url: location.href,
      }));

      expect(
        after.url,
        `tapping the invisible "${label}" navigated the reader`,
      ).toBe(before.url);
      expect(
        Math.abs(after.scrollY - before.scrollY),
        `tapping the invisible "${label}" teleported the document from ${before.scrollY} to ${after.scrollY}`,
      ).toBeLessThan(5);
      expect(
        await popup,
        `tapping the invisible "${label}" opened a popup`,
      ).toBeNull();
    });
  }

  test("an invisible CTA cannot be reached by keyboard either", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: CTAS[0] })).toBeVisible();

    const focusable = (label: string) =>
      page.evaluate((text) => {
        const el = Array.from(document.querySelectorAll("a")).find(
          (a) => a.textContent?.trim() === text,
        );
        if (!el) return null;
        // `preventScroll` because focusing scrolls by default, which would move
        // the page out from under the state being measured.
        el.focus({ preventScroll: true });
        return document.activeElement === el;
      }, label);

    // Positive control, per CTA and at rest: an unreachable-everywhere link
    // would satisfy the assertion below without the gate existing.
    for (const label of CTAS) {
      expect(await focusable(label), `"${label}" is not focusable at rest`).toBe(true);
    }

    await scrollTo(page, 651);
    for (const label of CTAS) {
      const d = (await sampleCtas(page))[label];
      expect(d?.painted, `"${label}" is still painted at scrollY 651`).toBe(false);
      expect(
        await focusable(label),
        `the invisible "${label}" still takes keyboard focus, so Tab lands on a link that is not there`,
      ).toBe(false);
    }
  });
});

/**
 * Reads the gate off the hero column. Deliberately the *computed* value rather
 * than the inline style: the prerender bakes `useParallaxFade`'s progress-0
 * output into `dist/index.html` as
 * `style="opacity:1;pointer-events:auto;visibility:visible;transform:none"`,
 * and React keeps server markup on hydration. So a reduced-motion reader landing
 * on the prerendered page carries those three declarations inline even though
 * nothing is bound to them — mounting the same hero through a client-side nav
 * leaves only `transform: none`. An assertion that the properties are *absent*
 * from the inline style therefore fails on every build regardless of the gate,
 * which is a broken probe, not a finding. Their baked values are the CSS
 * defaults anyway, so they are inert — and it is the safe direction to bake: a
 * reader whose bundle never arrives gets a hero that is visible and tappable.
 */
async function readGate(page: Page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { pointerEvents: cs.pointerEvents, visibility: cs.visibility, opacity: cs.opacity };
  }, HERO_COLUMN);
}

const isGated = (s: { pointerEvents: string; visibility: string }) =>
  s.pointerEvents === "none" || s.visibility === "hidden";

test("the gate never fires under prefers-reduced-motion", async ({ page }) => {
  const WALK = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];

  // Positive control first, and on the same walk: without the preference the
  // gate must actually close somewhere down this scroll range. If it never did
  // — a hero too short to fade, a walk that stops before the fade begins, a
  // `useParallaxFade` that quietly returned nothing for everyone — then the
  // reduced-motion assertion below would be measuring an inert page and would
  // pass just as happily with the gate deleted.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByRole("link", { name: CTAS[0] })).toBeVisible();

  let firedWithMotion = false;
  for (const y of WALK) {
    await scrollTo(page, y);
    const state = await readGate(page);
    expect(state, "the hero column should be on the page").not.toBeNull();
    if (isGated(state!)) firedWithMotion = true;
  }
  expect(
    firedWithMotion,
    "the gate never closed anywhere on this walk even with motion enabled, so the reduced-motion check below proves nothing",
  ).toBe(true);

  // `test.use({ reducedMotion })` does not reach the browser in this setup, so
  // the preference is emulated directly.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("link", { name: CTAS[0] })).toBeVisible();

  const gated: string[] = [];
  for (const y of WALK) {
    await scrollTo(page, y);
    const state = await readGate(page);
    expect(state, "the hero column should be on the page").not.toBeNull();
    if (isGated(state!)) gated.push(`scrollY=${y}: ${JSON.stringify(state)}`);
  }

  // There is no fade for these readers — the hero column stays fully opaque all
  // the way down — so a gate that fired would be hiding a button that is right
  // there on the screen.
  expect(
    gated,
    "the hero column was gated for a reader whose hero never fades",
  ).toEqual([]);
});
