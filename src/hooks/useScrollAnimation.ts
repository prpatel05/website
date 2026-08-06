import { useRef } from "react";
import { useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useFirstLoad } from "./useEntrance";

interface ScrollAnimationOptions {
  offsetStart?: string;
  offsetEnd?: string;
  opacityRange?: [number, number];
}

interface ScrollAnimationResult {
  ref: React.RefObject<HTMLElement | null>;
  scrollYProgress: MotionValue<number>;
  sectionOpacity: MotionValue<number> | undefined;
}

/**
 * Fades a section in as it scrolls into view.
 *
 * `sectionOpacity` is `undefined` — meaning "leave opacity off the element" —
 * in the two cases where the fade is wrong rather than merely unwanted:
 *
 * - **First load.** The value is driven by `scrollYProgress`, which is 0 for
 *   any section below the fold, so the transform evaluates to a literal 0 and
 *   framer-motion writes `opacity: 0` into the inline style. The prerender
 *   captures that, and the whole section ships invisible until React has
 *   downloaded, hydrated and scrolled. Same defect `useEntrance` fixes for
 *   `initial`, one prop over; it needs the same signal.
 * - **`prefers-reduced-motion`.** Like `useParallax`, this binds a scroll-linked
 *   value straight into `style`, which is not an animation as far as
 *   `MotionConfig reducedMotion="user"` is concerned — so these sections went
 *   on fading with the scrollbar for exactly the people who asked them not to.
 *
 * Client-side navigations keep the fade: the route already mounted at scroll
 * top, so the transform starts where the reader is.
 */
export function useScrollAnimation(options: ScrollAnimationOptions = {}): ScrollAnimationResult {
  const {
    offsetStart = "start end",
    offsetEnd = "end start",
    opacityRange = [0, 0.15],
  } = options;

  const ref = useRef<HTMLElement>(null);
  const firstLoad = useFirstLoad();
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: [offsetStart, offsetEnd],
  });

  const opacity = useTransform(scrollYProgress, opacityRange, [0, 1]);
  const sectionOpacity = firstLoad || reduceMotion ? undefined : opacity;

  return { ref, scrollYProgress, sectionOpacity };
}
