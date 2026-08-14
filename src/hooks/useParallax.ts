import { transform, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Below this painted opacity an element is no longer something a reader can
 * see, let alone aim at. 0.1 puts text under a 1.1:1 contrast ratio against
 * any background — a ghost, not a target.
 */
const MIN_INTERACTIVE_OPACITY = 0.1;

type ScrollFade = {
  opacity?: MotionValue<number>;
  pointerEvents?: MotionValue<"auto" | "none">;
  visibility?: MotionValue<"visible" | "hidden">;
};

/**
 * True while `ref`'s content is short enough to sit inside the viewport.
 *
 * The caller is a scroll-linked treatment that presupposes it: a `min-h-screen`
 * section is exactly one viewport tall for as long as its content fits, so
 * everything in it is on screen at scroll 0 and the fade only ever spends
 * itself on something the reader has already been shown. Once the content is
 * taller than that, reaching the bottom of it costs scroll — the same axis the
 * fade is spending — and the treatment starts hiding content on the way in
 * rather than on the way out. See `Hero.tsx` for the measurement (PRA-961).
 *
 * `offsetHeight` rather than a rect: the hero column carries a scroll-linked
 * `scale`, and a transformed rect would shrink as the reader scrolls and flip
 * this answer mid-gesture. Layout height is what the question is about.
 *
 * Starts `true`, which is the prerendered markup's own state, so hydration
 * matches; the layout effect corrects it before the first paint. `null` while
 * a ref is unset — jsdom's motion mock never assigns one — leaves it `true`,
 * i.e. the shipped behaviour.
 */
export function useFitsViewport(ref: RefObject<HTMLElement | null>): boolean {
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const measure = () => setFits(element.offsetHeight <= window.innerHeight);

    measure();

    // The element's own box changes when the text reflows at a breakpoint; the
    // window listener catches a viewport that got shorter around a box that did
    // not move — a desktop reader stepping the zoom up, which is the whole case
    // this exists for.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);

    observer?.observe(element);
    window.addEventListener("resize", measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  return fits;
}

/**
 * A scroll-linked offset that switches itself off for `prefers-reduced-motion`.
 *
 * `MotionConfig reducedMotion="user"` only governs animations a motion
 * component runs. A value bound straight into `style` is not an animation —
 * it keeps tracking the scrollbar whatever the setting says, so the parallax
 * layers stayed in motion for exactly the people who asked them not to be.
 *
 * Returning `undefined` leaves the transform off the element entirely, which
 * is its resting position: the layer still renders, it just holds still.
 *
 * `hold` asks for that same resting position for a reason other than the
 * preference — a caller whose layout the offset is actively costing.
 */
export function useParallax<T extends string | number>(
  progress: MotionValue<number>,
  input: number[],
  output: T[],
  hold = false
): MotionValue<T> | undefined {
  const offset = useTransform(progress, input, output);
  return useReducedMotion() || hold ? undefined : offset;
}

/**
 * A scroll-linked fade that stops being a hit target once it is invisible.
 *
 * Opacity alone does not remove an element from hit-testing. The hero's two
 * CTAs went on taking taps for hundreds of pixels after they had faded out —
 * `./contact --init` was still the topmost paint at 0.0023 opacity, and a tap
 * on what looked like blank space teleported the reader from scrollY 651 to
 * 4064 (PRA-943). `pointer-events` takes the tap away; `visibility` also takes
 * the invisible link out of the tab order and the accessibility tree, which is
 * the same defect for anyone not using a pointer.
 *
 * Both are driven off `progress` rather than off the returned `opacity`,
 * because that one does not stay in JS: framer hands a scroll-linked opacity to
 * a native ViewTimeline animation, so the inline style still reads `opacity: 1`
 * while the painted value is 0.004. `transform()` is the same clamped
 * interpolator `useTransform` builds, so the gate and the fade cannot drift —
 * and the clamp is why the ViewTimeline's rebound back to 0.4 past the end of
 * the range (out of view, behind the navbar) stays untappable too.
 *
 * Spread into `style`. For `prefers-reduced-motion` it returns nothing at all,
 * matching `useParallax`: there the fade never runs, the element stays fully
 * opaque, and taking its taps away would itself be the bug. `hold` is the same
 * answer for a caller the fade is costing rather than serving — see
 * `useFitsViewport`.
 */
export function useParallaxFade(
  progress: MotionValue<number>,
  input: number[],
  output: number[],
  hold = false
): ScrollFade {
  const opacity = useTransform(progress, input, output);
  const toOpacity = transform(input, output);
  const interactive = useTransform(progress, (p) => toOpacity(p) >= MIN_INTERACTIVE_OPACITY);
  const pointerEvents = useTransform(interactive, (on) => (on ? "auto" : "none"));
  const visibility = useTransform(interactive, (on) => (on ? "visible" : "hidden"));

  return useReducedMotion() || hold ? {} : { opacity, pointerEvents, visibility };
}
