import { test, expect, type Page } from "./fixtures";
import { settleFrames } from "./frame-time";

/**
 * The homepage fades its links in on `whileInView`. Opacity is not a
 * hit-testing property, so for as long as the entrance holds one at 0 it is
 * an invisible thing taking taps — the contract `hero-fade-hit-testing.spec.ts`
 * writes for the hero's fade-*out*, arriving from the other direction.
 *
 * On `main` it was not even transient. `BlogPreview` ran its cards on
 * `viewport={{ margin: "-50px" }}`, a *negative* root margin, so the observer
 * waited until a card was 50px inside the viewport. Below that the card was on
 * screen and had not started: measured at 393x852 after a client-side
 * navigation, settling 1600ms at each stop, all five preview cards sat at
 * opacity 0 across a full-width strip up to 36px tall — the bottom edge of the
 * screen, where a thumb rests — and were the topmost paint at 120/120,
 * 156/160, 192/200, 120/120 and 80/80 of the points sampled inside it. A tap
 * on what read as empty page opened a post.
 *
 * Both halves are asserted here because they fail independently:
 *   - a link the reader has come to rest in front of must be painted, and
 *   - a link still inside its entrance must not be taking the tap,
 * each with a per-element positive control, because a walk that never reached
 * an element proves nothing about it.
 *
 * The entrance only runs on a client-side navigation — `useEntrance` suppresses
 * `initial` on the entry the document loaded with, so a first load mounts every
 * card already readable. Every case here therefore arrives at "/" by clicking
 * `cd ~` on the archive, which is how a reader gets here from a post.
 */

const PHONE = { width: 393, height: 852 };

/**
 * Matches `MIN_INTERACTIVE_OPACITY` in `useParallax.ts`: below this an element
 * is under a 1.1:1 contrast ratio against any background — a ghost, not a
 * target.
 */
const GHOST_OPACITY = 0.1;

/** Comfortably above the gate: the reader can see this and is aiming at it. */
const READABLE_OPACITY = 0.5;

/** Every link the homepage puts behind an entrance, by accessible-ish label. */
const GATED_LINKS = [
  "./contact --init",
  "cat resume.pdf",
  "ls ./posts",
  "email",
  "phone",
  "LinkedIn",
  "GitHub",
  "Medium",
  "X",
  "Dev.to",
] as const;

type Reading = {
  key: string;
  /** Effective opacity, multiplied up the ancestor chain. */
  opacity: number;
  /** Points inside the viewport-clipped rect where this link is the topmost paint. */
  onTop: number;
  samples: number;
  /** Height of the link actually on screen and clear of the fixed navbar. */
  visibleHeight: number;
};

/**
 * Samples every link currently on screen: what the reader can see of it, and
 * whether the browser would give it the tap.
 *
 * Read through `getComputedStyle`, never the inline style — framer hands a
 * running animation to the compositor, and the inline value it wrote is not
 * what is on the glass.
 */
async function sampleLinks(page: Page): Promise<Reading[]> {
  return page.evaluate(() => {
    const out: Reading[] = [];
    const navBottom = Math.max(
      0,
      ...Array.from(document.querySelectorAll("nav, header")).map(
        (el) => el.getBoundingClientRect().bottom,
      ),
    );

    for (const el of Array.from(document.querySelectorAll<HTMLElement>("a[href]"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom <= navBottom || r.top >= window.innerHeight) continue;

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
      if (!painted) continue;

      const left = Math.max(r.left, 0);
      const right = Math.min(r.right, window.innerWidth);
      const top = Math.max(r.top, navBottom);
      const bottom = Math.min(r.bottom, window.innerHeight);

      let onTop = 0;
      let samples = 0;
      for (let x = left + 2; x < right - 2; x += 8) {
        for (let y = top + 2; y < bottom - 2; y += 8) {
          samples++;
          const hit = document.elementsFromPoint(x, y)[0];
          if (hit === el || el.contains(hit)) onTop++;
        }
      }
      if (samples === 0) continue;

      out.push({
        key: (el.textContent || "").trim().replace(/\s+/g, " "),
        opacity: Math.round(opacity * 10000) / 10000,
        onTop,
        samples,
        visibleHeight: Math.round(bottom - top),
      });
    }
    return out;
  });
}

/** The five homepage preview cards, by the title each one links to. */
async function cardTitles(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("#writing article h3")).map(
      (h) => h.textContent?.trim() ?? "",
    ),
  );
}

/**
 * Document-space top of every link on the page, so a case can go straight to
 * the scroll positions that matter instead of walking the whole document.
 *
 * A 40px walk of a 4900px page is 123 stops, and a settle long enough to mean
 * anything put the first version of this file over Playwright's 30s budget on
 * CI. The stops that carry the defect are not spread evenly: they are the few
 * frames where a link is crossing the bottom edge.
 */
async function linkTops(
  page: Page,
): Promise<{ key: string; top: number; height: number; chrome: boolean }[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("a[href]"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          key: (el.textContent || "").trim().replace(/\s+/g, " "),
          top: Math.round(r.top + window.scrollY),
          height: Math.round(r.height),
          // The fixed navbar rides the viewport rather than arriving with the
          // scroll, and `sampleLinks` skips it for the same reason: it is
          // chrome, and nothing in it is behind an entrance.
          chrome: el.closest("nav, header") !== null,
        };
      })
      // Bigger than the 1x1 `sr-only` clip the skip link sits in until it is
      // focused: that one is not on the page in any sense a tap can reach.
      .filter((l) => l.height > 4 && !l.chrome)
      .sort((a, b) => a.top - b.top),
  );
}

/** Arrives at "/" the way a reader does: from the archive, not by loading it. */
async function navigateHome(page: Page) {
  await page.goto("/blog/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "cd ~" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.locator("#writing")).toBeAttached();
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
}

/**
 * Long enough for the slowest entrance over a link to have finished, with room
 * left over for the wait and the animation not being timed off the same clock.
 *
 * The slowest is the hero's CTA row — `delay: 1` and a 0.6s duration, 1.6s. The
 * preview cards this used to name (0.6s delay + 0.6s) are the slowest of the
 * `whileInView` entrances, not of all of them, and the value was 1600: exactly
 * the CTA row's own duration, so the one entrance that outlasts every other was
 * the one the wait had no margin over.
 *
 * Exactly is not enough. `waitForTimeout` starts when Playwright observes the
 * incoming DOM; framer starts the entrance on a frame after the commit that put
 * it there, and `useEntranceGate` holds `pointer-events: none` until
 * `onAnimationComplete`. `elementsFromPoint` skips a gated element, so a link a
 * frame short of its release reads as fully painted and completely untappable —
 * which is this file's failure signature, reported against an opacity the
 * reader can plainly see. Measured at 393x852 on a client-side arrival, at the
 * one stop that carries the CTAs: at 1550ms `./contact --init` was at opacity
 * 0.909 with 0 of 180 points topmost, at 1600ms it was 180 of 180 (PRA-978).
 *
 * This is how much time the entrance gets; `settle` below is what makes it
 * time the entrance actually receives. Raising this number was the wrong fix
 * for PRA-993 and would be the wrong fix again — a wall-clock wait can be
 * arbitrarily long and still hand a frame-stepped animation nothing.
 */
const SETTLED_MS = 2400;

/**
 * Advances `SETTLED_MS` of *animation* time, which is not the same quantity as
 * `SETTLED_MS` of wall clock and is the one the entrance actually runs on. See
 * `settleFrames` in `./frame-time` for why, and for the PRA-993 measurements
 * behind it.
 *
 * The two readings that motivated it are both this file's: a 2033ms frame stall
 * leaves a card at `opacity: 0` with `pointer-events: none`, which is its
 * `Received: 0`; a stall of a few hundred ms lands the entrance but not
 * `onAnimationComplete`, which is its `never became tappable again`. One cause,
 * two messages.
 */
const settle = (page: Page) => settleFrames(page, SETTLED_MS);

test.describe("Entrance animations do not leave invisible links taking taps", () => {
  test.use({ viewport: PHONE });

  test("a link crossing the bottom edge is not invisible and taking taps", async ({
    page,
  }) => {
    await navigateHome(page);
    const links = await linkTops(page);
    expect(links.length).toBeGreaterThan(0);

    // The strip a card peeked through on `main` was 14-36px tall, so the stops
    // are placed on the link rather than on a grid: each one puts a link that
    // many pixels above the bottom edge, which is the state a coarse walk steps
    // straight over.
    const PEEK = [6, 18, 34, 50, 70];
    const stops = Array.from(
      new Set([
        // The hero's CTAs never cross the bottom edge — they are on screen
        // from the first frame, and their entrance is a 1s delay the reader
        // spends looking at a blank hero. The landing scroll position is the
        // stop that carries them.
        0,
        ...links.flatMap((l) =>
          PEEK.map((d) => l.top - PHONE.height + d).filter((y) => y > 0),
        ),
      ]),
    ).sort((a, b) => a - b);

    const ghosts: string[] = [];
    const seen = new Set<string>();

    for (const y of stops) {
      await scrollTo(page, y);
      // Two frames plus the observer callback. Deliberately short: this case
      // asserts that nothing invisible is tappable, which holds whether or not
      // an entrance is still running, and the stops below the first one give
      // every earlier entrance far longer than its own duration anyway.
      await page.waitForTimeout(150);
      for (const r of await sampleLinks(page)) {
        seen.add(r.key);
        if (r.opacity <= GHOST_OPACITY && r.onTop > 0) {
          ghosts.push(
            `y=${y} "${r.key}" opacity=${r.opacity} topmost at ${r.onTop}/${r.samples} points over ${r.visibleHeight}px`,
          );
        }
      }
    }

    expect(ghosts, "links the reader cannot see that are still the topmost paint").toEqual([]);

    // Control: a stop list that never brought a link on screen says nothing
    // about that link.
    for (const l of links) {
      expect(
        Array.from(seen).some((k) => k === l.key),
        `"${l.key}" was never on screen at any stop`,
      ).toBe(true);
    }
  });

  test("every link the entrance hid ends up painted and tappable", async ({ page }) => {
    await navigateHome(page);
    const titles = await cardTitles(page);
    const links = await linkTops(page);

    // One stop per screenful rather than one per link: the contact section's
    // seven links share a screen, and a settle this long is the expensive part.
    const stops: number[] = [];
    let covered = -1;
    for (const l of links) {
      if (l.top <= covered) continue;
      const y = Math.max(0, l.top - PHONE.height / 3);
      stops.push(y);
      covered = y + PHONE.height - 40;
    }

    const readable = new Set<string>();
    /**
     * The best each link managed, so a failure names which half of "painted and
     * tappable" was missing. The assertion is a set membership and on its own
     * reports `false` and nothing else — which is all the first report of
     * PRA-978 had to go on. "opacity 0.909, 0/180 topmost" is a gate that had
     * not released; "opacity 0.04" is a fade that had not finished; and the two
     * want opposite fixes.
     */
    const best = new Map<string, Reading & { y: number }>();
    for (const y of stops) {
      await scrollTo(page, y);
      await settle(page);
      for (const r of await sampleLinks(page)) {
        if (r.opacity >= READABLE_OPACITY && r.onTop > 0) readable.add(r.key);
        const seen = best.get(r.key);
        if (!seen || r.opacity > seen.opacity || (r.opacity === seen.opacity && r.onTop > seen.onTop)) {
          best.set(r.key, { ...r, y });
        }
      }
    }

    /** What `label` was measured at, for an assertion that is about to fail. */
    const evidence = (label: string) => {
      const hits = Array.from(best.values()).filter((r) => r.key.includes(label));
      if (hits.length === 0) return "it was never on screen at any stop";
      return hits
        .map(
          (r) =>
            `"${r.key}" got to opacity ${r.opacity} at y=${r.y}, topmost at ${r.onTop}/${r.samples} points`,
        )
        .join("; ");
    };

    // The gate's opposite failure: one that never releases leaves a fully
    // painted page that cannot be tapped. Asserted per element, because a
    // page-wide "something was tappable" flag is satisfied by whichever link
    // still works.
    for (const title of titles) {
      expect(
        Array.from(readable).some((k) => k.includes(title)),
        `preview card "${title}" never became readable and tappable: ${evidence(title)}`,
      ).toBe(true);
    }
    for (const label of GATED_LINKS) {
      expect(
        Array.from(readable).some((k) => k.includes(label)),
        `"${label}" never became readable and tappable: ${evidence(label)}`,
      ).toBe(true);
    }
  });

  test("a link still inside its entrance is not taking the tap", async ({ page }) => {
    await navigateHome(page);
    const titles = await cardTitles(page);

    // Jump each card into the middle of the screen and read the very next
    // frame: the observer fires on the jump, so the card is at the start of
    // its entrance — the window in which it is on screen and invisible.
    //
    // One arrival per card, not one walk past all five. `viewport.once` means
    // a card that scrolled by while an earlier case was settling has already
    // spent its entrance, and the control below would then reject the case
    // instead of the case proving anything.
    for (const title of titles) {
      await navigateHome(page);
      const box = await page
        .locator("#writing article", { hasText: title })
        .boundingBox();
      expect(box).not.toBeNull();
      const target = Math.max(
        0,
        (await page.evaluate(() => window.scrollY)) +
          box!.y -
          (PHONE.height - box!.height) / 2,
      );

      await scrollTo(page, target);
      const during = (await sampleLinks(page)).find((r) => r.key.includes(title));
      expect(during, `card "${title}" was not on screen after the jump`).toBeDefined();

      // Control: this jump has to actually catch the card mid-entrance, or the
      // assertion below is about a card that was already painted.
      expect(
        during!.opacity,
        `card "${title}" was already painted on the frame after the jump — the entrance window was missed, so this case asserts nothing`,
      ).toBeLessThanOrEqual(GHOST_OPACITY);
      expect(
        during!.onTop,
        `card "${title}" is invisible and still the topmost paint at ${during!.onTop}/${during!.samples} points`,
      ).toBe(0);

      // ...and it has to come back. A gate that never releases is the same
      // defect with the sign flipped.
      await settle(page);
      const after = (await sampleLinks(page)).find((r) => r.key.includes(title));
      // Asked first, and separately, because the two answers are not
      // distinguishable further down: `after?.opacity` on a card that dropped
      // out of the sample is `undefined`, and a card that is genuinely
      // transparent reads 0 — both fail the same assertion under the same
      // message, and they want opposite fixes. Dropping out means the jump no
      // longer puts this card on screen, which is a broken case rather than a
      // broken page.
      expect(
        after,
        `card "${title}" was on screen for the reading before the settle and is not in the sample after it — the case moved, so it is not evidence about the entrance`,
      ).toBeDefined();
      expect(
        after!.opacity,
        `card "${title}" never finished its entrance`,
      ).toBeGreaterThanOrEqual(READABLE_OPACITY);
      expect(after!.onTop, `card "${title}" never became tappable again`).toBeGreaterThan(0);
    }
  });

  test("a reduced-motion reader is never gated", async ({ page }) => {
    // The gate releases on the entrance completing. `reducedMotion="user"`
    // drops the transform but keeps the opacity tween, so the animation still
    // runs and still completes — but if that ever stopped being true, this
    // reader would be left unable to tap a fully painted page.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await navigateHome(page);

    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    await scrollTo(page, height);
    await settle(page);

    const readings = await sampleLinks(page);
    expect(readings.length).toBeGreaterThan(0);
    for (const r of readings) {
      expect(r.opacity, `"${r.key}" is not painted`).toBeGreaterThanOrEqual(READABLE_OPACITY);
      expect(r.onTop, `"${r.key}" is painted but not tappable`).toBeGreaterThan(0);
    }
  });
});
