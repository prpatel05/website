import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Puts the reader back where they were on a history traversal, once the page
 * they are going back to is actually tall enough to hold that offset.
 *
 * `history.scrollRestoration` is `"auto"` and the browser does this correctly
 * on reload, where the document it restores into is the one the offset was
 * measured against. A client-side Back is the case it cannot get right: the
 * offset belongs to the archive, but the document the browser applies it to is
 * still the *post*, because the route swap has not happened yet.
 *
 * Traced on Pixel 5, backing out of a post into a 23-post archive left at
 * `scrollY 10084`:
 *
 * ```
 * popstate     scrollY     0   scrollHeight  7143   articles  1   <- still the post
 * rAF          scrollY  6416   scrollHeight  7143   articles  1   <- browser restores, clamped
 * +350ms       scrollY  6416   scrollHeight 10811   articles 23   <- archive mounts, offset stays
 * ```
 *
 * The browser restores one frame after `popstate`, and clamps to what the
 * document can scroll at that instant — 6416 against a 10084 target. React
 * commits the archive ~325ms later because `AnimatePresence mode="wait"` holds
 * the outgoing post through its 300ms exit, and by then the browser is done:
 * the document grows back to its full height and the offset does not follow.
 * The reader lands a screenful and a half short, and the gap grows with the
 * archive.
 *
 * So it is not lazy images or unsized cards — the archive's own layout is
 * final the frame it mounts. It is that the restore happens against the
 * previous page. Nothing that makes the archive cheaper to lay out helps, and
 * only dropping the exit transition would close the window, at the cost of the
 * transition.
 *
 * The correction: remember the offset ourselves, and re-apply it after the
 * incoming route has laid out. The browser's restore still runs first and is
 * still right whenever it can be — this only ever moves the reader *down*, to
 * an offset they had already reached, and only on `POP`. A `PUSH` belongs to
 * `ScrollToTop`.
 */

const STORAGE_KEY = "scroll-positions";

/**
 * How long to keep waiting for the document to grow.
 *
 * The exit transition is 300ms and the archive is laid out the frame after it,
 * so this is an order of magnitude of headroom for a slow phone. Past it the
 * reader keeps the browser's clamped offset, which is where they would have
 * been anyway.
 */
const GROW_WINDOW_MS = 3000;

/**
 * `sessionStorage` rather than a module-level map, so a reload keeps the
 * entries: react-router restores its keys from `history.state`, so the keys on
 * the other side of a reload are the same ones.
 */
const readPositions = (): Record<string, number> => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
};

const savePosition = (key: string) => {
  try {
    const positions = readPositions();
    positions[key] = window.scrollY;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Private-mode quota, storage disabled: restoration degrades to whatever
    // the browser manages on its own, which is what happens without this hook.
  }
};

export const useScrollRestoration = () => {
  const { key } = useLocation();
  const navigationType = useNavigationType();

  /**
   * Records where the reader was, at the two moments this entry stops being
   * the one on screen.
   *
   * The cleanup covers a client-side navigation away. It is a layout effect so
   * it runs in the commit that swaps the location, ahead of `ScrollToTop`'s
   * passive `scrollTo(0, 0)` — a passive cleanup would read the 0 that effect
   * had already written.
   *
   * `pagehide` covers leaving the document: without it the stored offset would
   * only ever be the one from the last navigation, and a reader who scrolled
   * somewhere else and then hit reload would be dragged back to it.
   */
  useLayoutEffect(() => {
    const record = () => savePosition(key);
    window.addEventListener("pagehide", record);
    return () => {
      window.removeEventListener("pagehide", record);
      record();
    };
  }, [key]);

  useEffect(() => {
    if (navigationType !== "POP") return;

    const target = readPositions()[key];
    // `<=` is the whole safety story: the browser has usually already restored
    // by now, and when it managed the full offset there is nothing to correct.
    // Never moving the reader up means a stale entry cannot take a page away
    // from them.
    if (target === undefined || target <= window.scrollY) return;

    let waiting = true;
    let peak = window.scrollY;

    const release = () => {
      waiting = false;
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("keydown", release);
      window.removeEventListener("scroll", watchDirection);
    };

    /**
     * Releases as soon as the offset moves back up, whoever moved it.
     *
     * The three input listeners below are the reader announcing themselves.
     * They miss the ways a page can move with no event on the document —
     * dragging the scrollbar is the plain one — so direction covers the rest:
     * the browser's restore only ever climbs, from 0 up to wherever the short
     * document clamps it, so a drop below the highest offset seen is something
     * else steering and the wait is over.
     *
     * Re-read every frame from `tick` as well as on `scroll`, because the seed
     * above is only the offset at the moment this effect ran and the browser
     * restores around it, not before it. Seeded once, a `peak` of 0 against a
     * restore that had already reached 10084 read the reader's scroll *away*
     * to 800 as a climb, and the wait then dragged them back down. That was 5
     * runs out of 5.
     */
    const watchDirection = () => {
      if (window.scrollY < peak) {
        release();
        return;
      }
      peak = window.scrollY;
    };

    const passive = { passive: true } as const;
    window.addEventListener("wheel", release, passive);
    window.addEventListener("touchstart", release, passive);
    window.addEventListener("keydown", release);
    window.addEventListener("scroll", watchDirection, passive);

    const started = performance.now();
    const tick = () => {
      if (!waiting) return;
      watchDirection();
      if (!waiting) return;

      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= target) {
        window.scrollTo(0, target);
        release();
        return;
      }
      if (performance.now() - started > GROW_WINDOW_MS) {
        // The document never grew. The reader keeps the browser's clamped
        // offset, which is where they would have been without any of this.
        release();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return release;
    // `navigationType` describes how we arrived at this `key`, so like
    // `ScrollToTop` it only carries meaning alongside one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
};
