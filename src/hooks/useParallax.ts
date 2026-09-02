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
 * Both are driven off `progress` rather than off the returned `opacity`.
 * `transform()` is the same clamped interpolator `useTransform` builds, so the
 * gate and the fade cannot drift — and the clamp is why a rebound past the end
 * of the range (out of view, behind the navbar) stays untappable too.
 *
 * That invariant needs the opacity to stay on the JS path, which is why it is
 * built from a function transformer below rather than from an array range.
 * `useScroll({ target })` marks its progress value accelerable, and
 * `useTransform` propagates that mark to any value derived from it through an
 * array range — at which point framer stops writing the opacity itself and
 * hands it to a native scroll-linked animation. Which timeline it gets is then
 * decided by whether the target ref happened to be populated when framer built
 * the animation: on a fresh load at `/` the hero got a `ViewTimeline` over its
 * own section, but on a client-side arrival the ref was still null and it got a
 * `ScrollTimeline` over the whole document instead. The fade then ran over
 * ~4000px of document rather than the section's ~850px, so the hero was still
 * 77% opaque where the design has it gone, sitting over the top of About —
 * while the gate, computed here in JS off the correct `progress`, slammed shut
 * at the section boundary and made it pop. Gate and paint had drifted onto two
 * different ranges, which is exactly what this hook promises cannot happen
 * (PRA-979).
 *
 * A function transformer is not accelerable, so the paint stays on `progress`
 * and both readings come from one source. The opacity gives up the compositor
 * for it; that costs this caller nothing, because the same element's `y` and
 * `scale` are already JS-driven and write the same style on the same frame.
 *
 * One `opacity` value is shared by every element the caller spreads this into,
 * so none of them may declare an `opacity` of their own: framer writes an
 * `initial` straight into the bound value at mount, which would zero the fade
 * for all of them. See the nesting in `Hero.tsx`.
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
  const toOpacity = transform(input, output);
  // Passed as a *function* rather than as `(progress, input, output)`, which is
  // load-bearing: framer only hands a derived value to the compositor when it
  // was built from an array range, so the array form is what put the paint on a
  // timeline of framer's choosing rather than on `progress`. See above.
  const opacity = useTransform(progress, toOpacity);
  const interactive = useTransform(progress, (p) => toOpacity(p) >= MIN_INTERACTIVE_OPACITY);
  const pointerEvents = useTransform(interactive, (on) => (on ? "auto" : "none"));
  const visibility = useTransform(interactive, (on) => (on ? "visible" : "hidden"));

  return useReducedMotion() || hold ? {} : { opacity, pointerEvents, visibility };
}
