import { test, expect, type Page } from "./fixtures";

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

/** Long enough for the slowest entrance (0.6s delay + 0.6s) to have finished. */
const SETTLED_MS = 1600;

test.describe("Entrance animations do not leave invisible links taking taps", () => {
  test.use({ viewport: PHONE });

  test("a link the reader has stopped in front of is painted", async ({ page }) => {
    await navigateHome(page);
    const titles = await cardTitles(page);
    expect(titles.length).toBeGreaterThan(0);

    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    const ghosts: string[] = [];
    const seenReadable = new Set<string>();

    // 40px steps: the strip a card peeked through on `main` was 14-36px tall,
    // so a coarser walk can step straight over the state this test exists for.
    for (let y = 0; y <= height - PHONE.height; y += 40) {
      await scrollTo(page, y);
      await page.waitForTimeout(SETTLED_MS / 4);
      // The settle is per-stop but the walk is monotonic, so an entrance
      // started at an earlier stop has had far longer than its own duration.
      const readings = await sampleLinks(page);
      for (const r of readings) {
        if (r.opacity >= READABLE_OPACITY && r.onTop > 0) seenReadable.add(r.key);
        if (r.opacity <= GHOST_OPACITY && r.onTop > 0) {
          ghosts.push(
            `y=${y} "${r.key}" opacity=${r.opacity} topmost at ${r.onTop}/${r.samples} points over ${r.visibleHeight}px`,
          );
        }
      }
    }

    expect(ghosts, "links the reader cannot see that are still the topmost paint").toEqual([]);

    // Positive control, per element: a walk that never brought a card into
    // view, or never let it finish, proves nothing about that card.
    for (const title of titles) {
      expect(
        Array.from(seenReadable).some((k) => k.includes(title)),
        `preview card "${title}" was never seen readable and on top`,
      ).toBe(true);
    }
    for (const label of GATED_LINKS) {
      expect(
        Array.from(seenReadable).some((k) => k.includes(label)),
        `"${label}" was never seen readable and on top`,
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
      await page.waitForTimeout(SETTLED_MS);
      const after = (await sampleLinks(page)).find((r) => r.key.includes(title));
      expect(after?.opacity, `card "${title}" never finished its entrance`).toBeGreaterThanOrEqual(
        READABLE_OPACITY,
      );
      expect(after?.onTop, `card "${title}" never became tappable again`).toBeGreaterThan(0);
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
    await page.waitForTimeout(SETTLED_MS);

    const readings = await sampleLinks(page);
    expect(readings.length).toBeGreaterThan(0);
    for (const r of readings) {
      expect(r.opacity, `"${r.key}" is not painted`).toBeGreaterThanOrEqual(READABLE_OPACITY);
      expect(r.onTop, `"${r.key}" is painted but not tappable`).toBeGreaterThan(0);
    }
  });
});
