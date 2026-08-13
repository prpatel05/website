import { transform, useReducedMotion, useTransform, type MotionValue } from "framer-motion";

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
 * A scroll-linked offset that switches itself off for `prefers-reduced-motion`.
 *
 * `MotionConfig reducedMotion="user"` only governs animations a motion
 * component runs. A value bound straight into `style` is not an animation —
 * it keeps tracking the scrollbar whatever the setting says, so the parallax
 * layers stayed in motion for exactly the people who asked them not to be.
 *
 * Returning `undefined` leaves the transform off the element entirely, which
 * is its resting position: the layer still renders, it just holds still.
 */
export function useParallax<T extends string | number>(
  progress: MotionValue<number>,
  input: number[],
  output: T[]
): MotionValue<T> | undefined {
  const offset = useTransform(progress, input, output);
  return useReducedMotion() ? undefined : offset;
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
 * opaque, and taking its taps away would itself be the bug.
 */
export function useParallaxFade(
  progress: MotionValue<number>,
  input: number[],
  output: number[]
): ScrollFade {
  const opacity = useTransform(progress, input, output);
  const toOpacity = transform(input, output);
  const interactive = useTransform(progress, (p) => toOpacity(p) >= MIN_INTERACTIVE_OPACITY);
  const pointerEvents = useTransform(interactive, (on) => (on ? "auto" : "none"));
  const visibility = useTransform(interactive, (on) => (on ? "visible" : "hidden"));

  return useReducedMotion() ? {} : { opacity, pointerEvents, visibility };
}
