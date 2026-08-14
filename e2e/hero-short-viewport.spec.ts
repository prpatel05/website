import { test, expect, type Page } from "./fixtures";

/**
 * The hero's primary CTAs are reachable on a viewport too short to hold the
 * hero.
 *
 * `hero-fade-hit-testing.spec.ts` is the other half of this contract: there a
 * CTA the reader cannot see must not take taps. The failure mode here is the
 * mirror image — a CTA that never becomes readable *at all*, so the gate that
 * spec pins is the only state a short-viewport reader ever gets.
 *
 * The hero section is `min-h-screen`, and while its content fits, that is
 * exactly one viewport: everything is on screen at scroll 0 and the fade only
 * ever spends itself on the way out. Once the content is taller, reaching the
 * bottom of it costs scroll — the same axis the fade spends — and `textY`
 * translates the column *down* by half the scroll travelled, so a CTA below the
 * fold closes on it at half a pixel per pixel scrolled. Measured on `main` at
 * 320 wide, where the column is 485px and `./contact --init` sits 407px into
 * it, the CTA's viewport top ran `407 - 0.5y` while the fade finished at
 * `y = 388`, leaving it at `top: 213` — so it needed a 259px-tall viewport to
 * be on screen while still readable. At 320x200 and 320x256 there was no scroll
 * position in 0..700 where a reader could both see it and reach it; 320x320 and
 * up were fine (PRA-961).
 *
 * 320x256 is the WCAG 2.1 SC 1.4.10 Reflow floor (1280x1024 at 400% zoom) and
 * 320x200 is a 1280x800 desktop at the same zoom. Neither `axe` nor
 * `mobile-overflow.spec.ts` can see this: nothing overflows horizontally, and
 * that sweep asserts at height 851. The loss is vertical.
 */

const CTAS = ["./contact --init", "cat resume.pdf"] as const;

/** Comfortably above `MIN_INTERACTIVE_OPACITY` — the reader can read this. */
const READABLE_OPACITY = 0.5;

/**
 * Same width throughout, so height is the only variable between the cases and
 * the control. The hero column is 485px tall at 320 wide.
 */
const WIDTH = 320;

/** Viewports the hero cannot fit into, where it must hold still instead. */
const SHORT = [
  { height: 200, why: "1280x800 at 400% zoom" },
  { height: 256, why: "the WCAG reflow floor, 1280x1024 at 400% zoom" },
];

/** Taller than the column, so the hero fits and the fade is meant to run. */
const TALL = 851;

type Reading = {
  contained: boolean;
  visible: boolean;
  opacity: number;
  pointerEvents: string;
  belowChrome: boolean;
  onTop: number;
  samples: number;
  covering: string | null;
};

/**
 * Every condition a reader needs at once, per CTA. Scored together rather than
 * separately because each one held somewhere on the broken build — just never
 * at the same scroll position.
 */
async function sampleCtas(page: Page): Promise<Record<string, Reading>> {
  return page.evaluate((labels) => {
    const out: Record<string, Reading> = {};
    const navBottom = Math.max(
      0,
      ...Array.from(document.querySelectorAll("nav, header")).map(
        (el) => el.getBoundingClientRect().bottom
      )
    );

    for (const label of labels) {
      const el = Array.from(document.querySelectorAll("a")).find(
        (a) => a.textContent?.trim() === label
      );
      if (!el) continue;

      // The product up the ancestor chain: the fade is bound to the column, not
      // to the CTA, so the element's own computed opacity is 1 either way.
      let opacity = 1;
      for (
        let node: Element | null = el;
        node && node !== document.documentElement;
        node = node.parentElement
      ) {
        opacity *= Number(getComputedStyle(node).opacity);
      }

      const r = el.getBoundingClientRect();
      let onTop = 0;
      let samples = 0;
      let covering: string | null = null;
      for (let x = Math.max(r.left, 0) + 2; x < Math.min(r.right, window.innerWidth) - 2; x += 8) {
        for (
          let y = Math.max(r.top, 0) + 2;
          y < Math.min(r.bottom, window.innerHeight) - 2;
          y += 8
        ) {
          samples++;
          const hit = document.elementsFromPoint(x, y)[0];
          if (hit === el || el.contains(hit)) onTop++;
          else if (!covering && hit)
            covering = `${hit.tagName}.${String(hit.className || "").slice(0, 32)}`;
        }
      }

      out[label] = {
        // Whole target on screen, not merely intersecting it: a button whose
        // label is cut in half by the fold is not one a reader can read.
        contained: r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0,
        visible: el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
        opacity,
        pointerEvents: getComputedStyle(el).pointerEvents,
        belowChrome: r.top >= navBottom,
        onTop,
        samples,
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
      new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())))
  );
}

for (const { height, why } of SHORT) {
  test(`hero CTAs are readable and reachable at ${WIDTH}x${height} (${why})`, async ({ page }) => {
    await page.setViewportSize({ width: WIDTH, height });
    await page.goto("/");
    await expect(page.getByRole("link", { name: CTAS[0] })).toBeAttached();
    // The CTAs arrive on a 1s entrance delay, and `useEntranceGate` holds their
    // taps until it finishes. Sampling before that reports the entrance, not
    // the steady state this is about.
    await page.waitForTimeout(2000);

    const readable = new Set<string>();
    const solidlyTappable = new Set<string>();
    /** The closest each CTA came, for a failure message that says what broke. */
    const best: Record<string, { score: number; at: string }> = {};

    for (let y = 0; y <= 700; y += 20) {
      await scrollTo(page, y);
      const reading = await sampleCtas(page);

      for (const label of CTAS) {
        const d = reading[label];
        if (!d) continue;

        const score =
          Number(d.contained) +
          Number(d.visible) +
          Number(d.opacity >= READABLE_OPACITY) +
          Number(d.pointerEvents === "auto");
        if (!best[label] || score > best[label].score) {
          best[label] = {
            score,
            at: `scrollY=${y}: contained=${d.contained} visible=${d.visible} opacity=${d.opacity.toFixed(3)} pointerEvents=${d.pointerEvents}`,
          };
        }

        if (
          d.contained &&
          d.visible &&
          d.opacity >= READABLE_OPACITY &&
          d.pointerEvents === "auto" &&
          d.belowChrome
        ) {
          readable.add(label);
          // Hit-testing is the reader's own question — is the tap mine? — but
          // it is the noisier signal: the floating terminal launcher clips a
          // corner of these buttons at some scroll positions, which is its own
          // business. So it is asked as "somewhere in the walk, all of it",
          // not at every stop.
          if (d.samples > 0 && d.onTop === d.samples) solidlyTappable.add(label);
        }
      }
    }

    expect(
      [...readable].sort(),
      `every hero CTA needs one scroll position where it is fully on screen, visible, readable and taking taps at ${WIDTH}x${height}. Best of the four reached simultaneously: ${JSON.stringify(best, null, 2)}`
    ).toEqual([...CTAS].sort());

    expect(
      [...solidlyTappable].sort(),
      `every hero CTA needs one readable scroll position where it is also the topmost paint over its whole rect at ${WIDTH}x${height}`
    ).toEqual([...CTAS].sort());
  });
}

/**
 * The control. Holding the hero still is conditional on the hero not fitting;
 * a change that simply deleted the fade would satisfy every assertion above,
 * and this is the assertion it would fail. Same width, only the height differs.
 *
 * `hero-fade-hit-testing.spec.ts` pins what the fade must do once it has run.
 * This pins only that it still runs.
 */
test(`the hero still fades where it fits, at ${WIDTH}x${TALL}`, async ({ page }) => {
  await page.setViewportSize({ width: WIDTH, height: TALL });
  await page.goto("/");
  await expect(page.getByRole("link", { name: CTAS[0] })).toBeVisible();
  await page.waitForTimeout(2000);

  const ghosted = new Set<string>();

  for (let y = 0; y <= 700; y += 20) {
    await scrollTo(page, y);
    const reading = await sampleCtas(page);

    for (const label of CTAS) {
      const d = reading[label];
      // Still inside the viewport, so this is the fade rather than the CTA
      // having simply scrolled away.
      if (d?.contained && !d.visible) ghosted.add(label);
    }
  }

  expect(
    [...ghosted].sort(),
    "every hero CTA should still be faded out by scroll on a viewport tall enough to hold the hero; one that never is has lost its scroll-linked fade entirely"
  ).toEqual([...CTAS].sort());
});
